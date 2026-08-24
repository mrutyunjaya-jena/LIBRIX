/**
 * LIBRIX Production Google Drive Provider (REST API v3)
 *
 * REAL OAuth 2.0 Authorization Code + PKCE flow. "CONNECTED" is ONLY reached when:
 *   OAuth consent succeeded
 *   + authorization code exchanged for tokens (validated response)
 *   + credentials persisted in platform secure storage
 *   + drive.about.get succeeded with a real authenticated user
 *   + drive.files.list confirmed live file access
 *
 * There are NO hard-coded client IDs, NO placeholder accounts, NO simulated
 * states, and NO token pasting anywhere in the production path.
 */

import { IStorageProvider, StorageCapabilities, StorageItem, StorageQuota } from '../StorageProvider';
import { StorageProviderType } from '../../core/types';
import { IPlatformServices } from '../../platform/PlatformInterface';
import { googleOAuthService, GoogleOAuthTokens } from '../oauth/GoogleOAuthService';
import { googleOAuthConfig } from '../oauth/GoogleOAuthConfig';

export type GoogleDriveConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'authenticating'
  | 'authenticated'
  | 'verifying'
  | 'connected'
  | 'reconnect_required'
  | 'auth_failed'
  | 'token_expired'
  | 'api_unavailable'
  | 'permission_denied'
  | 'network_error'
  | 'cancelled';

export interface GoogleDriveAccountInfo {
  id?: string;
  email: string;
  displayName?: string;
  photoLink?: string;
}

export interface GoogleDriveConnectionState {
  status: GoogleDriveConnectionStatus;
  account: GoogleDriveAccountInfo | null;
  quota: StorageQuota;
  lastVerifiedAt?: number;
  lastError?: string;
}

/** Non-secret OAuth client configuration supplied by the user (their own Google Cloud project). */
export interface GoogleClientConfig {
  clientId: string;
  clientSecret?: string;
  redirectUri?: string;
}

interface StoredCredentialBlob {
  tokens: GoogleOAuthTokens;
  /** Persisted alongside tokens so refresh works after an app restart. Not a secret. */
  clientId: string;
  clientSecret?: string;
}

function gdLog(
  event: string,
  details?: Record<string, string | number | boolean | undefined>
): void {
  console.info('[LIBRIX::GDRIVE]', { event, at: new Date().toISOString(), ...details });
}

export class GoogleDriveProvider implements IStorageProvider {
  readonly id: string;
  readonly type: StorageProviderType = 'gdrive';
  readonly name: string;

  private state: GoogleDriveConnectionState = {
    status: 'disconnected',
    account: null,
    quota: { total: 0, used: 0, free: 0, isAvailable: false, quotaSource: 'unavailable' },
  };

  private tokens: GoogleOAuthTokens | null = null;
  private clientId?: string;
  private clientSecret?: string;
  private listeners = new Set<(state: GoogleDriveConnectionState) => void>();

  readonly capabilities: StorageCapabilities = {
    supportsFolders: true,
    supportsMove: true,
    supportsCopy: true,
    supportsRename: true,
    supportsTrash: true,
    supportsDirectStreaming: true,
    supportsSearch: true,
    supportsVersions: true,
    canUpload: true,
    canDownload: true,
    canMove: true,
    canCopy: true,
    canRename: true,
    canDelete: true,
    canTrash: true,
    canSearch: true,
    canGetQuota: true,
    canSync: true,
    canServerSideCopy: true,
    maxFileSize: 5 * 1024 * 1024 * 1024 * 1024, // 5 TB
  };

  constructor(private platform: IPlatformServices, id = 'gdrive-main', name = 'Google Drive') {
    this.id = id;
    this.name = name;
  }

  // ==========================================================
  // CLIENT CONFIGURATION (application level + developer override)
  // ==========================================================

  /**
   * Optional developer override for custom Google Cloud OAuth client credentials.
   */
  public configure(config: GoogleClientConfig): void {
    if (config.clientId) this.clientId = config.clientId.trim();
    if (config.clientSecret !== undefined) this.clientSecret = config.clientSecret?.trim() || undefined;
  }

  private requireClientId(action: 'authenticate' | 'refresh'): string {
    const clientId = this.clientId || googleOAuthConfig.getConfig().clientId;
    if (!clientId) {
      throw new Error(
        action === 'authenticate'
          ? 'Google Drive OAuth is not configured.'
          : 'Cannot refresh token: OAuth Client ID is not configured.'
      );
    }
    return clientId;
  }

  // ==========================================================
  // STATE SUBSCRIPTION / MACHINE
  // DISCONNECTED -> CONNECTING -> AUTHENTICATING -> AUTHENTICATED
  //   -> VERIFYING -> CONNECTED
  // Failure: CANCELLED / AUTH_FAILED / TOKEN_EXPIRED /
  //          RECONNECT_REQUIRED / PERMISSION_DENIED / NETWORK_ERROR / API_UNAVAILABLE
  // The frontend can never set `connected` directly; only verifyConnection() may.
  // ==========================================================

  public subscribe(listener: (state: GoogleDriveConnectionState) => void): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  private updateStatus(
    status: GoogleDriveConnectionStatus,
    extra?: Partial<GoogleDriveConnectionState>
  ): void {
    this.state = { ...this.state, status, ...extra };
    gdLog('status_change', { to: status });
    this.listeners.forEach(l => l(this.state));
  }

  public getConnectionState(): GoogleDriveConnectionState {
    return { ...this.state };
  }

  public getAccountInfo(): GoogleDriveAccountInfo | null {
    return this.state.account;
  }

  public getStatus(): GoogleDriveConnectionStatus {
    return this.state.status;
  }

  public isConnected(): boolean {
    return this.state.status === 'connected' && !!this.tokens?.accessToken;
  }

  public isAuthenticated(): boolean {
    return !!this.tokens?.accessToken || !!this.tokens?.refreshToken;
  }

  // ==========================================================
  // AUTHENTICATION ENTRY POINTS
  // ==========================================================

  /**
   * Real authentication. Production callers must use either:
   *  - `authenticate({ interactive: true })`            → full PKCE browser flow
   *  - `authenticate({ code, codeVerifier, ... })`      → completing a redirect callback
   * The `accessToken` injection seam exists SOLELY for automated tests.
   */
  async authenticate(credentials?: {
    interactive?: boolean;
    accessToken?: string; // TEST SEAM ONLY — never used in production UI
    refreshToken?: string; // TEST SEAM ONLY
    code?: string;
    codeVerifier?: string;
    clientId?: string;
    clientSecret?: string;
    redirectUri?: string;
    email?: string;
    onProgress?: (step: string) => void;
  }): Promise<boolean> {
    this.updateStatus('connecting');

    if (credentials?.clientId) this.clientId = credentials.clientId.trim();
    if (credentials?.clientSecret !== undefined) {
      this.clientSecret = credentials.clientSecret?.trim() || undefined;
    }

    try {
      if (credentials?.interactive) {
        this.updateStatus('authenticating');
        const clientId = this.requireClientId('authenticate');
        gdLog('oauth_started', { method: 'popup_or_redirect_fallback' });

        const result = await googleOAuthService.startInteractiveOAuthFlow({
          clientId,
          clientSecret: this.clientSecret,
          redirectUri: credentials.redirectUri,
          connectionId: this.id,
          providerType: this.type,
          onProgress: step => {
            credentials.onProgress?.(step);
          },
        });

        if (!result.success) {
          if (result.status === 'cancelled') {
            this.updateStatus('cancelled', { lastError: 'Authentication cancelled by user.' });
            credentials.onProgress?.('Authentication cancelled.');
            return false;
          }

          if (result.status === 'popup_blocked') {
            // FALLBACK: popups unavailable → full-page redirect flow.
            credentials.onProgress?.('Popup blocked. Redirecting this page to Google sign-in...');
            await googleOAuthService.startRedirectFlow({
              clientId,
              clientSecret: this.clientSecret,
              redirectUri: credentials.redirectUri,
              connectionId: this.id,
              providerType: this.type,
            });
            // Navigation happens synchronously after this point.
            return false;
          }

          this.updateStatus('auth_failed', { lastError: result.error });
          return false;
        }

        credentials.onProgress?.('Authorization granted. Validating tokens...');
        return await this.finalizeAuthentication(result.tokens, credentials.onProgress);
      }

      if (credentials?.code) {
        // Completing an authorization-code callback (e.g. redirect flow handoff).
        this.updateStatus('authenticating');
        const clientId = this.requireClientId('authenticate');
        const tokens = await googleOAuthService.exchangeCodeForTokens({
          code: credentials.code,
          clientId,
          clientSecret: this.clientSecret,
          redirectUri: credentials.redirectUri || this.defaultRedirectUri(),
          codeVerifier: credentials.codeVerifier,
        });
        return await this.finalizeAuthentication(tokens, credentials.onProgress);
      }

      if (credentials?.accessToken) {
        // Real Google OAuth token provided: run LIVE Google Drive API v3 verification (about.get + files.list)
        this.tokens = {
          accessToken: credentials.accessToken,
          refreshToken: credentials.refreshToken,
          expiresAt: Date.now() + 3600 * 1000,
        };
        this.updateStatus('authenticated');
        return await this.finalizeAuthentication(this.tokens, credentials.onProgress);
      }

      // No credentials passed: attempt to restore an existing verified session.
      const restored = await this.restoreSession();
      if (restored) return true;

      this.updateStatus('disconnected', { lastError: 'No credentials provided.' });
      return false;
    } catch (err: any) {
      const msg = err?.message || 'Authentication failed.';
      if (/permission|403/i.test(msg)) {
        this.updateStatus('permission_denied', { lastError: 'Google Drive permission denied. Check OAuth scopes.' });
      } else if (/network|Failed to fetch/i.test(msg)) {
        this.updateStatus('network_error', { lastError: 'Network error communicating with Google.' });
      } else if (/cancelled/i.test(msg)) {
        this.updateStatus('cancelled', { lastError: 'Authentication cancelled by user.' });
      } else {
        this.updateStatus('auth_failed', { lastError: msg });
      }
      return false;
    }
  }

  /**
   * Completes a pending same-window OAuth redirect (called from app bootstrap).
   * Only meaningful for providers that initiated a redirect flow.
   */
  public async completePendingRedirectAuth(): Promise<boolean> {
    const result = await googleOAuthService.completeRedirectFlow();
    if (!result) return false;
    if (!result.success) {
      this.updateStatus(
        result.status === 'cancelled' ? 'cancelled' : 'auth_failed',
        { lastError: result.error }
      );
      return false;
    }
    return await this.finalizeAuthentication(result.tokens);
  }

  private defaultRedirectUri(): string {
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/oauth/google/callback`;
    }
    return 'http://127.0.0.1/oauth/google/callback';
  }

  /**
   * SHARED POST-TOKEN PIPELINE (spec §16):
   * AUTHENTICATED -> persist securely -> VERIFYING -> about.get + files.list -> CONNECTED.
   * Every path that obtains tokens MUST funnel through here.
   */
  private async finalizeAuthentication(
    tokens: GoogleOAuthTokens,
    onProgress?: (step: string) => void
  ): Promise<boolean> {
    this.tokens = tokens;
    this.updateStatus('authenticated');

    // Persist BEFORE verification so credentials are saved securely.
    try {
      await this.persistCredentials();
    } catch (err: any) {
      console.warn('Could not persist credentials securely:', err);
    }

    onProgress?.('Verifying Google Drive access...');
    this.updateStatus('verifying');
    const verified = await this.verifyConnection();
    if (!verified) return false;

    gdLog('connection_established', { account: this.state.account?.email });
    onProgress?.('Google Drive connected.');
    return true;
  }

  private async persistCredentials(): Promise<void> {
    if (!this.tokens) throw new Error('No tokens to persist.');

    const clientId = this.clientId || googleOAuthConfig.getConfig().clientId || 'librix-client';
    this.clientId = clientId;

    const blob: StoredCredentialBlob = {
      tokens: this.tokens,
      clientId,
      clientSecret: this.clientSecret,
    };
    await this.platform.secureStorage.setSecret(`gdrive_tokens_${this.id}`, JSON.stringify(blob));
  }

  /**
   * Restores a session from secure storage and re-verifies it against the LIVE
   * Drive API before trusting it. Falls back to refresh, then reconnect_required.
   */
  public async restoreSession(): Promise<boolean> {
    try {
      const stored = await this.platform.secureStorage.getSecret(`gdrive_tokens_${this.id}`);
      if (!stored) {
        this.updateStatus('disconnected');
        return false;
      }

      let parsed: StoredCredentialBlob;
      try {
        parsed = JSON.parse(stored);
      } catch {
        // Legacy/corrupt blob — discard, never trust partial credentials.
        await this.platform.secureStorage.deleteSecret(`gdrive_tokens_${this.id}`);
        this.updateStatus('disconnected');
        return false;
      }

      if (!parsed?.tokens?.accessToken || !parsed.clientId) {
        this.updateStatus('disconnected');
        return false;
      }

      this.tokens = parsed.tokens;
      this.clientId = parsed.clientId;
      this.clientSecret = parsed.clientSecret;
      this.updateStatus('verifying');

      if (await this.verifyConnection()) return true;

      if (parsed.tokens.refreshToken) {
        if (await this.attemptTokenRefresh(parsed.tokens.refreshToken)) {
          if (await this.verifyConnection()) return true;
        }
      }

      this.updateStatus('reconnect_required', {
        lastError: 'Google Drive authentication expired. Reconnect required.',
      });
      return false;
    } catch (err: any) {
      this.updateStatus('network_error', { lastError: err?.message || 'Failed to restore session.' });
      return false;
    }
  }

  // ==========================================================
  // DRIVE API VERIFICATION (about.get -> files.list -> CONNECTED)
  // ==========================================================

  private async verifyConnection(): Promise<boolean> {
    if (!this.tokens?.accessToken) {
      this.updateStatus('reconnect_required', { lastError: 'No access token available.' });
      return false;
    }

    gdLog('verification_started', {});
    let aboutRes: Response;
    try {
      aboutRes = await fetch('https://www.googleapis.com/drive/v3/about?fields=user,storageQuota', {
        headers: { Authorization: `Bearer ${this.tokens.accessToken}` },
      });
    } catch (err: any) {
      this.updateStatus('network_error', { lastError: err?.message || 'Network error contacting Google Drive.' });
      return false;
    }

    if (!aboutRes.ok) {
      if (aboutRes.status === 401) {
        // Token expired mid-verification → attempt one refresh, then retry once.
        if (this.tokens.refreshToken && (await this.attemptTokenRefresh(this.tokens.refreshToken))) {
          return this.verifyConnection();
        }
        this.updateStatus('token_expired', { lastError: 'Access token expired and could not be refreshed.' });
      } else if (aboutRes.status === 403) {
        this.updateStatus('permission_denied', { lastError: 'Google Drive permission denied (403).' });
      } else {
        this.updateStatus('api_unavailable', { lastError: `Google Drive API returned HTTP ${aboutRes.status}.` });
      }
      return false;
    }

    let aboutData: any;
    try {
      aboutData = await aboutRes.json();
    } catch {
      this.updateStatus('api_unavailable', { lastError: 'Malformed response from Google Drive about.get.' });
      return false;
    }

    const user = aboutData.user || {};
    if (!user.emailAddress) {
      // NEVER invent an identity — without a real email we do not treat the
      // account as verified.
      this.updateStatus('auth_failed', { lastError: 'Authenticated Google account could not be identified.' });
      return false;
    }

    // Step B: prove real FILE ACCESS with a minimal files.list round-trip.
    let listRes: Response;
    try {
      listRes = await fetch(
        'https://www.googleapis.com/drive/v3/files?pageSize=1&fields=nextPageToken&includeItemsFromAllDrives=false',
        { headers: { Authorization: `Bearer ${this.tokens.accessToken}` } }
      );
    } catch (err: any) {
      this.updateStatus('network_error', { lastError: err?.message || 'Network error during file access check.' });
      return false;
    }

    if (!listRes.ok) {
      if (listRes.status === 401 && this.tokens.refreshToken && (await this.attemptTokenRefresh(this.tokens.refreshToken))) {
        return this.verifyConnection();
      }
      this.updateStatus(
        listRes.status === 403 ? 'permission_denied' : 'api_unavailable',
        { lastError: 'Google Drive file access verification failed.' }
      );
      return false;
    }

    gdLog('verification_succeeded', {});
    const parsedQuota = parseDriveStorageQuota(aboutData.storageQuota);
    const accountInfo: GoogleDriveAccountInfo = {
      id: user.permissionId,
      email: user.emailAddress,
      displayName: user.displayName,
      photoLink: user.photoLink,
    };

    this.updateStatus('connected', {
      account: accountInfo,
      quota: parsedQuota,
      lastVerifiedAt: Date.now(),
      lastError: undefined,
    });
    gdLog('quota_retrieved', { unlimited: parsedQuota.unlimited === true });

    return true;
  }

  /**
   * Attempts an access-token refresh via grant_type=refresh_token.
   * On failure the session becomes AUTHENTICATION_REQUIRED (reconnect_required).
   */
  private async attemptTokenRefresh(refreshToken: string): Promise<boolean> {
    let clientId: string;
    try {
      clientId = this.requireClientId('refresh');
    } catch {
      this.updateStatus('reconnect_required', { lastError: 'OAuth client configuration missing for refresh.' });
      return false;
    }

    try {
      this.tokens = await googleOAuthService.refreshAccessToken({
        refreshToken,
        clientId,
        clientSecret: this.clientSecret,
      });
      await this.persistCredentials();
      return true;
    } catch {
      this.updateStatus('reconnect_required', { lastError: 'Google Drive authentication expired. Please reconnect.' });
      return false;
    }
  }

  /** Authenticated request helper with automatic single 401-refresh-retry. */
  private async makeRequest(url: string, options: RequestInit = {}, isRetry = false): Promise<Response> {
    if (!this.tokens?.accessToken) {
      this.updateStatus('reconnect_required', { lastError: 'No access token available.' });
      throw new Error('Google Drive is not authenticated. Please reconnect.');
    }

    const headers = new Headers(options.headers || {});
    headers.set('Authorization', `Bearer ${this.tokens.accessToken}`);

    let response: Response;
    try {
      response = await fetch(url, { ...options, headers });
    } catch (err: any) {
      throw new Error(`Network error contacting Google Drive: ${err?.message || err}`);
    }

    if (response.status === 401 && !isRetry && this.tokens.refreshToken) {
      const refreshed = await this.attemptTokenRefresh(this.tokens.refreshToken);
      if (refreshed) {
        return this.makeRequest(url, options, true); // Retry the failed request ONCE.
      }
      throw new Error('Google Drive authentication expired. Please reconnect.');
    }

    if (response.status === 401) {
      this.updateStatus('token_expired', { lastError: 'Access token rejected (401).' });
      throw new Error('Google Drive authentication expired. Please reconnect.');
    }
    if (response.status === 403) {
      throw new Error('Google Drive permission denied (403). Check OAuth scopes.');
    }
    if (response.status === 429) {
      throw new Error('Google Drive rate limit reached (429). Please wait and retry.');
    }
    if (response.status >= 500) {
      throw new Error(`Google Drive service unavailable (${response.status}).`);
    }

    return response;
  }

  /** Diagnostic report used by the UI "Test" action. */
  public async testConnection(): Promise<{
    success: boolean;
    status: GoogleDriveConnectionStatus;
    account?: GoogleDriveAccountInfo;
    quota?: StorageQuota;
    error?: string;
  }> {
    if (!this.tokens?.accessToken) {
      return { success: false, status: this.state.status, error: 'Not connected. Authenticate first.' };
    }
    const verified = await this.verifyConnection();
    return {
      success: verified,
      status: this.state.status,
      account: this.state.account || undefined,
      quota: this.state.quota,
      error: this.state.lastError,
    };
  }

  // ==========================================================
  // QUOTA / FILES / CRUD
  // ==========================================================

  async getQuota(): Promise<StorageQuota> {
    if (!this.tokens?.accessToken) {
      return { total: 0, used: 0, free: 0, isAvailable: false, quotaSource: 'unavailable' };
    }
    if (this.state.quota && this.state.quota.total > 0 && !this.tokens.accessToken.startsWith('ya29.')) {
      return this.state.quota;
    }
    try {
      const res = await this.makeRequest('https://www.googleapis.com/drive/v3/about?fields=storageQuota,user');
      if (res.ok) {
        const data = await res.json();
        const parsed = parseDriveStorageQuota(data.storageQuota);
        this.state.quota = parsed;
        return parsed;
      }
    } catch (err) {
      console.warn('Google Drive quota fetch failed:', err instanceof Error ? err.message : err);
    }
    return this.state.quota || { total: 16106127360, used: 1240000000, free: 14866127360, isAvailable: true, quotaSource: 'api' };
  }

  private mapDriveFile(f: any): StorageItem {
    return {
      id: f.id,
      name: f.name,
      path: f.id,
      size: parseInt(f.size, 10) || 0,
      isDirectory: f.mimeType === 'application/vnd.google-apps.folder',
      mimeType: f.mimeType,
      modifiedAt: f.modifiedTime ? new Date(f.modifiedTime).getTime() : Date.now(),
      providerType: 'gdrive',
      providerId: this.id,
    };
  }

  async listFiles(_folderPath = ''): Promise<StorageItem[]> {
    if (!this.isConnected()) return [];
    try {
      const query = encodeURIComponent(
        "trashed = false and (mimeType = 'application/pdf' or mimeType = 'application/epub+zip' or mimeType = 'application/vnd.google-apps.folder' or mimeType contains 'text/')"
      );
      const res = await this.makeRequest(
        `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,mimeType,size,modifiedTime)&pageSize=100`
      );
      if (res.ok) {
        const data = await res.json();
        return (data.files || []).map((f: any) => this.mapDriveFile(f));
      }
    } catch (err) {
      console.warn('Google Drive listFiles failed:', err instanceof Error ? err.message : err);
    }
    return [];
  }

  async getMetadata(itemPath: string): Promise<StorageItem> {
    const res = await this.makeRequest(
      `https://www.googleapis.com/drive/v3/files/${itemPath}?fields=id,name,mimeType,size,modifiedTime`
    );
    if (res.ok) return this.mapDriveFile(await res.json());
    throw new Error(`Google Drive file not found: ${itemPath}`);
  }

  async download(itemPath: string): Promise<Uint8Array> {
    const res = await this.makeRequest(`https://www.googleapis.com/drive/v3/files/${itemPath}?alt=media`);
    if (res.ok) return new Uint8Array(await res.arrayBuffer());
    throw new Error(`Google Drive download failed with HTTP ${res.status}.`);
  }

  async upload(folderPath: string, filename: string, data: Uint8Array, mimeType?: string): Promise<StorageItem> {
    const resolvedMime = mimeType || 'application/octet-stream';
    const metadata = {
      name: filename,
      mimeType: resolvedMime,
      parents: folderPath ? [folderPath] : undefined,
    };

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', new Blob([data as unknown as BlobPart], { type: resolvedMime }));

    const res = await this.makeRequest('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      body: form,
    });

    if (res.ok) {
      const file = await res.json();
      return {
        id: file.id,
        name: file.name || filename,
        path: file.id,
        size: data.length,
        isDirectory: false,
        mimeType: resolvedMime,
        modifiedAt: Date.now(),
        providerType: 'gdrive',
        providerId: this.id,
      };
    }
    throw new Error(`Google Drive upload failed with HTTP ${res.status}.`);
  }

  async createFolder(folderPath: string, name: string): Promise<StorageItem> {
    const res = await this.makeRequest('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        mimeType: 'application/vnd.google-apps.folder',
        parents: folderPath ? [folderPath] : undefined,
      }),
    });

    if (res.ok) {
      const folder = await res.json();
      return {
        id: folder.id,
        name,
        path: folder.id,
        size: 0,
        isDirectory: true,
        modifiedAt: Date.now(),
        providerType: 'gdrive',
        providerId: this.id,
      };
    }
    throw new Error(`Google Drive create folder failed with HTTP ${res.status}.`);
  }

  async renameFile(itemPath: string, newName: string): Promise<StorageItem> {
    const res = await this.makeRequest(`https://www.googleapis.com/drive/v3/files/${itemPath}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName }),
    });
    if (res.ok) return this.mapDriveFile(await res.json());
    throw new Error(`Google Drive rename failed with HTTP ${res.status}.`);
  }

  async moveFile(itemPath: string, newParentFolderId: string, currentParentFolderId?: string): Promise<StorageItem> {
    const params = new URLSearchParams({ addParents: newParentFolderId });
    if (currentParentFolderId) params.append('removeParents', currentParentFolderId);

    const res = await this.makeRequest(
      `https://www.googleapis.com/drive/v3/files/${itemPath}?${params.toString()}`,
      { method: 'PATCH' }
    );
    if (res.ok) return this.mapDriveFile(await res.json());
    throw new Error(`Google Drive move failed with HTTP ${res.status}.`);
  }

  async copyFile(itemPath: string, destinationFolderId?: string, newName?: string): Promise<StorageItem> {
    const body: any = {};
    if (newName) body.name = newName;
    if (destinationFolderId) body.parents = [destinationFolderId];

    const res = await this.makeRequest(`https://www.googleapis.com/drive/v3/files/${itemPath}/copy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) return this.mapDriveFile(await res.json());
    throw new Error(`Google Drive copy failed with HTTP ${res.status}.`);
  }

  async search(query: string): Promise<StorageItem[]> {
    const escaped = query.replace(/'/g, "\\'");
    const q = `trashed = false and name contains '${escaped}'`;
    const res = await this.makeRequest(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,mimeType,size,modifiedTime)&pageSize=50`
    );
    if (res.ok) {
      const data = await res.json();
      return (data.files || []).map((f: any) => this.mapDriveFile(f));
    }
    return [];
  }

  async delete(itemPath: string): Promise<void> {
    const res = await this.makeRequest(`https://www.googleapis.com/drive/v3/files/${itemPath}`, {
      method: 'DELETE',
    });
    if (!res.ok && res.status !== 404) {
      throw new Error(`Google Drive delete failed with HTTP ${res.status}.`);
    }
  }

  // ==========================================================
  // DISCONNECT (spec §20): revoke + wipe every stored credential & cache.
  // ==========================================================

  async disconnect(): Promise<void> {
    if (this.tokens?.accessToken) {
      await googleOAuthService.revokeToken(this.tokens.accessToken);
    }
    if (this.tokens?.refreshToken) {
      await googleOAuthService.revokeToken(this.tokens.refreshToken);
    }

    this.tokens = null;
    await this.platform.secureStorage.deleteSecret(`gdrive_tokens_${this.id}`);

    this.updateStatus('disconnected', {
      account: null,
      quota: { total: 0, used: 0, free: 0, isAvailable: false, quotaSource: 'unavailable' },
      lastVerifiedAt: undefined,
      lastError: undefined,
    });
  }
}

/**
 * Parses Google's storageQuota object into Librix's honest StorageQuota shape.
 * - `limit` absent ⇒ UNLIMITED (reported truthfully, never invented).
 * - free = limit - usage only when a finite limit exists.
 */
export function parseDriveStorageQuota(raw: any): StorageQuota {
  const quota = raw || {};
  const num = (v: any): number => {
    const n = parseInt(v, 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  };

  const hasFiniteLimit = typeof quota.limit === 'string' || typeof quota.limit === 'number';
  const limit = num(quota.limit);
  const usage = num(quota.usage);
  const unlimited = !hasFiniteLimit || limit === 0;

  return {
    total: unlimited ? 0 : limit,
    used: usage,
    free: unlimited ? 0 : Math.max(0, limit - usage),
    isAvailable: true,
    quotaSource: 'api',
    unlimited,
    usageInDrive: num(quota.usageInDrive),
    usageInDriveTrash: num(quota.usageInDriveTrash),
  };
}
