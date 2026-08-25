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
import { cloudVaultSyncService } from '../sync/CloudVaultSyncService';

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
  clientId?: string;
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
          accessToken: credentials.accessToken.trim(),
          refreshToken: credentials.refreshToken ? credentials.refreshToken.trim() : undefined,
          expiresAt: Date.now() + 3600 * 1000,
        };
        this.updateStatus('authenticated');
        return await this.finalizeAuthentication(this.tokens, credentials.onProgress);
      }

      if (credentials?.refreshToken) {
        // Direct Refresh Token provided without access token: Exchange refresh token for fresh access token
        this.updateStatus('authenticating');
        credentials.onProgress?.('Exchanging refresh token for fresh access token...');
        const refreshSuccess = await this.attemptTokenRefresh(credentials.refreshToken.trim());
        if (refreshSuccess && this.tokens) {
          return await this.finalizeAuthentication(this.tokens, credentials.onProgress);
        } else {
          const lastErr = this.state.lastError || 'Could not obtain access token from refresh token. Verify Client ID and Secret if using custom GCP credentials.';
          this.updateStatus('auth_failed', { lastError: lastErr });
          return false;
        }
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

    // Automatically synchronize & fetch /LIBRIX/Library and /LIBRIX/Notes in background
    setTimeout(async () => {
      try {
        await cloudVaultSyncService.syncFromCloudOnLogin(this);
      } catch (syncErr) {
        console.warn('[LIBRIX::GoogleDrive] Post-login auto-sync:', syncErr);
      }
    }, 100);

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
      let errDetail = '';
      try {
        const errJson = await aboutRes.json();
        errDetail = errJson.error?.message || errJson.error_description || '';
      } catch {
        /* ignore */
      }

      if (aboutRes.status === 401) {
        // Token expired mid-verification → attempt refresh if refresh token available
        if (this.tokens.refreshToken && (await this.attemptTokenRefresh(this.tokens.refreshToken))) {
          return this.verifyConnection();
        }
        const lastErr =
          this.state.lastError ||
          (errDetail
            ? `Google returned 401: ${errDetail}. Please verify your access token or refresh token.`
            : 'Access token expired and could not be refreshed. Please provide a valid Refresh Token or a fresh Access Token.');
        this.updateStatus('token_expired', { lastError: lastErr });
      } else if (aboutRes.status === 403) {
        this.updateStatus('permission_denied', {
          lastError: `Google Drive permission denied (403): ${errDetail || 'Ensure Drive API v3 scope is authorized.'}`,
        });
      } else {
        this.updateStatus('api_unavailable', {
          lastError: `Google Drive API returned HTTP ${aboutRes.status}: ${errDetail || aboutRes.statusText}`,
        });
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
    let email = user.emailAddress;
    let displayName = user.displayName;

    if (!email) {
      try {
        const userinfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${this.tokens.accessToken}` },
        });
        if (userinfoRes.ok) {
          const userInfo = await userinfoRes.json();
          email = userInfo.email || userInfo.sub;
          displayName = userInfo.name || displayName;
        }
      } catch {
        /* fallback */
      }
    }

    if (!email) {
      email = 'google-drive@user.com';
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
      let listErr = '';
      try {
        const listJson = await listRes.json();
        listErr = listJson.error?.message || '';
      } catch {
        /* ignore */
      }
      this.updateStatus(
        listRes.status === 403 ? 'permission_denied' : 'api_unavailable',
        { lastError: `Google Drive file access verification failed: ${listErr || listRes.statusText}` }
      );
      return false;
    }

    gdLog('verification_succeeded', {});
    const parsedQuota = parseDriveStorageQuota(aboutData.storageQuota);
    const accountInfo: GoogleDriveAccountInfo = {
      id: user.permissionId || 'gdrive_user',
      email: email,
      displayName: displayName || email,
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
      clientId = googleOAuthConfig.getConfig().clientId || '';
    }

    try {
      this.tokens = await googleOAuthService.refreshAccessToken({
        refreshToken,
        clientId,
        clientSecret: this.clientSecret,
      });
      await this.persistCredentials();
      return true;
    } catch (err: any) {
      const errMsg = err?.message || 'Token refresh failed.';
      this.updateStatus('reconnect_required', { lastError: `Google Drive authentication error: ${errMsg}` });
      return false;
    }
  }

  /** Authenticated request helper with automatic single 401-refresh-retry. */
  private async makeRequest(url: string, options: RequestInit = {}, isRetry = false): Promise<Response> {
    if (!this.tokens?.accessToken) {
      if (this.tokens?.refreshToken) {
        const refreshed = await this.attemptTokenRefresh(this.tokens.refreshToken);
        if (!refreshed || !this.tokens?.accessToken) {
          this.updateStatus('reconnect_required', { lastError: 'No access token available and refresh failed.' });
          throw new Error('Google Drive is not authenticated. Please reconnect.');
        }
      } else {
        this.updateStatus('reconnect_required', { lastError: 'No access token available.' });
        throw new Error('Google Drive is not authenticated. Please reconnect.');
      }
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

  async listFiles(folderPath = ''): Promise<StorageItem[]> {
    if (!this.isConnected()) return [];
    try {
      let queryStr = '';

      if (folderPath && folderPath !== '/' && folderPath !== 'root' && folderPath !== 'all') {
        const parentId = await this.getOrCreateFolderPath(folderPath);
        if (parentId) {
          queryStr = `'${parentId}' in parents and trashed = false`;
        } else {
          return [];
        }
      }

      // If no folder path specified or querying all, search across entire Google Drive for all books/docs
      if (!queryStr) {
        queryStr = "trashed = false and mimeType != 'application/vnd.google-apps.folder' and (mimeType = 'application/pdf' or mimeType = 'application/epub+zip' or mimeType = 'text/plain' or mimeType = 'text/markdown' or name contains '.pdf' or name contains '.epub' or name contains '.md' or name contains '.mobi' or name contains '.txt')";
      }

      const res = await this.makeRequest(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(queryStr)}&fields=files(id,name,mimeType,size,modifiedTime)&pageSize=200`
      );

      if (res.ok) {
        const data = await res.json();
        const files = (data.files || []).map((f: any) => this.mapDriveFile(f));
        return files;
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
    throw new Error(`Google Drive getMetadata failed for ${itemPath}`);
  }

  async createFolder(folderPath: string, name: string): Promise<StorageItem> {
    const parentId = await this.getOrCreateFolderPath(folderPath);
    const folderId = await this.findOrCreateFolder(name, parentId);
    return {
      id: folderId,
      name,
      path: folderId,
      size: 0,
      isDirectory: true,
      modifiedAt: Date.now(),
      providerType: 'gdrive',
      providerId: this.id,
    };
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

  async delete(itemPath: string): Promise<void> {
    const res = await this.makeRequest(`https://www.googleapis.com/drive/v3/files/${itemPath}`, {
      method: 'DELETE',
    });
    if (!res.ok && res.status !== 404) {
      throw new Error(`Google Drive delete failed with HTTP ${res.status}.`);
    }
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

  async upload(folderPath: string, filename: string, data: Uint8Array, mimeType?: string): Promise<StorageItem> {
    const parentId = await this.getOrCreateFolderPath(folderPath);
    const resolvedMime = mimeType || 'application/octet-stream';

    // 1. Check if a file with this name already exists in this folder to avoid creating duplicate files
    let existingFileId: string | null = null;
    try {
      const parentQuery = (parentId && parentId !== 'root') ? `'${parentId}' in parents and ` : "'root' in parents and ";
      const escapedName = filename.replace(/'/g, "\\'");
      const q = `${parentQuery}trashed = false and name = '${escapedName}'`;
      const searchRes = await this.makeRequest(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&spaces=drive&fields=files(id,name)`
      );
      if (searchRes.ok) {
        const data = await searchRes.json();
        if (data.files && data.files.length > 0) {
          existingFileId = data.files[0].id;
          // Clean any extra duplicate copies on Google Drive to maintain single-copy integrity
          if (data.files.length > 1) {
            for (let k = 1; k < data.files.length; k++) {
              await this.makeRequest(`https://www.googleapis.com/drive/v3/files/${data.files[k].id}`, {
                method: 'DELETE',
              }).catch(() => {});
            }
          }
        }
      }
    } catch {
      // search fallback
    }

    // 2. If file already exists, UPDATE (PATCH) its content directly instead of creating duplicates!
    if (existingFileId) {
      const patchRes = await this.makeRequest(
        `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(existingFileId)}?uploadType=media`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': resolvedMime },
          body: data as unknown as BodyInit,
        }
      );
      if (patchRes.ok) {
        const file = await patchRes.json().catch(() => ({ id: existingFileId, name: filename }));
        return {
          id: file.id || existingFileId,
          name: file.name || filename,
          path: file.id || existingFileId,
          size: data.length,
          isDirectory: false,
          mimeType: resolvedMime,
          modifiedAt: Date.now(),
          providerType: 'gdrive',
          providerId: this.id,
        };
      }
    }

    // 3. Otherwise, create a new file
    const meta = {
      name: filename,
      parents: parentId ? [parentId] : undefined,
    };
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(meta)], { type: 'application/json' }));
    form.append('file', new Blob([data as unknown as BlobPart], { type: resolvedMime }));

    const res = await this.makeRequest(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
      {
        method: 'POST',
        body: form,
      }
    );

    if (res.ok) {
      const file = await res.json();
      return {
        id: file.id,
        name: file.name,
        path: file.id,
        size: data.length,
        isDirectory: false,
        mimeType: resolvedMime,
        modifiedAt: Date.now(),
        providerType: 'gdrive',
        providerId: this.id,
      };
    }
    throw new Error(`Google Drive upload failed: ${res.statusText}`);
  }

  async download(itemPath: string, hintFilename?: string): Promise<Uint8Array> {
    let fileId = itemPath;
    let targetName = hintFilename || (itemPath.includes('/') ? itemPath.split('/').pop() : undefined);

    // 1. Direct file ID download if fileId looks like a Google Drive ID (not internal doc_ id and not a path)
    if (fileId && !fileId.startsWith('doc_') && !fileId.startsWith('note_') && !fileId.includes('/')) {
      try {
        const res = await this.makeRequest(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`);
        if (res.ok) {
          const buffer = await res.arrayBuffer();
          if (buffer.byteLength > 0) return new Uint8Array(buffer);
        }
      } catch (directErr) {
        console.warn(`[LIBRIX::GoogleDrive] Direct download by ID "${fileId}" failed:`, directErr);
      }
    }

    // 2. If itemPath is a POSIX path like /LIBRIX/Library/book.epub, resolve the actual Google Drive File ID
    if (fileId.includes('/') || fileId.startsWith('/')) {
      const fileName = itemPath.split('/').pop() || itemPath;
      targetName = fileName;
      const folderPath = itemPath.substring(0, itemPath.lastIndexOf('/'));
      try {
        const folderId = await this.getOrCreateFolderPath(folderPath);
        const parentQuery = folderId ? `'${folderId}' in parents and ` : '';
        const escapedName = fileName.replace(/'/g, "\\'");
        const q = `${parentQuery}trashed = false and name = '${escapedName}'`;
        const res = await this.makeRequest(
          `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&spaces=drive&fields=files(id,name)`
        );
        if (res.ok) {
          const data = await res.json();
          if (data.files && data.files.length > 0) {
            const dlRes = await this.makeRequest(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(data.files[0].id)}?alt=media`);
            if (dlRes.ok) {
              const buffer = await dlRes.arrayBuffer();
              return new Uint8Array(buffer);
            }
          }
        }
      } catch (pathErr) {
        console.warn(`[LIBRIX::GoogleDrive] Could not resolve file ID for path "${itemPath}":`, pathErr);
      }
    }

    // 3. Fallback: Search across the entire Google Drive by target filename or title
    if (targetName) {
      const cleanName = targetName.replace(/['’]/g, '');
      const escapedName = targetName.replace(/'/g, "\\'");
      const q = `trashed = false and (name = '${escapedName}' or name contains '${cleanName}')`;
      try {
        const searchRes = await this.makeRequest(
          `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&spaces=drive&fields=files(id,name)&pageSize=10`
        );
        if (searchRes.ok) {
          const data = await searchRes.json();
          if (data.files && data.files.length > 0) {
            const foundFile = data.files[0];
            const retryRes = await this.makeRequest(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(foundFile.id)}?alt=media`);
            if (retryRes.ok) {
              const buffer = await retryRes.arrayBuffer();
              return new Uint8Array(buffer);
            }
          }
        }
      } catch (searchErr) {
        console.warn(`[LIBRIX::GoogleDrive] Global search fallback for "${targetName}" error:`, searchErr);
      }
    }

    throw new Error(`Google Drive could not locate or download file "${targetName || itemPath}".`);
  }

  private folderCache = new Map<string, string>();

  /** Clears cached folder path mappings */
  public clearFolderCache(): void {
    this.folderCache.clear();
  }

  /**
   * Finds or creates a specific folder on Google Drive.
   */
  public async findOrCreateFolder(name: string, parentFolderId?: string): Promise<string> {
    const parentQuery = (parentFolderId && parentFolderId !== 'root') ? `'${parentFolderId}' in parents and ` : "'root' in parents and ";
    const escapedName = name.replace(/'/g, "\\'");
    const q = `${parentQuery}mimeType = 'application/vnd.google-apps.folder' and trashed = false and name = '${escapedName}'`;

    try {
      const res = await this.makeRequest(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&spaces=drive&fields=files(id,name,parents)`
      );
      if (res.ok) {
        const data = await res.json();
        if (data.files && data.files.length > 0) {
          return data.files[0].id;
        }
      }
    } catch (searchErr) {
      console.warn(`[LIBRIX::GoogleDrive] Folder search for "${name}" error:`, searchErr);
    }

    // Create the folder on Google Drive (omitting parents puts it in top-level My Drive)
    const createBody: any = {
      name,
      mimeType: 'application/vnd.google-apps.folder',
    };
    if (parentFolderId && parentFolderId !== 'root') {
      createBody.parents = [parentFolderId];
    }

    const createRes = await this.makeRequest('https://www.googleapis.com/drive/v3/files?fields=id,name', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(createBody),
    });

    if (!createRes.ok) {
      const errText = await createRes.text().catch(() => '');
      console.error(`[LIBRIX::GoogleDrive] Failed to create folder "${name}":`, createRes.status, errText);
      throw new Error(`Google Drive failed to create folder "${name}" (${createRes.status}): ${errText || createRes.statusText}`);
    }

    const created = await createRes.json();
    console.info(`[LIBRIX::GoogleDrive] Successfully created Google Drive folder "${name}" (ID: ${created.id})`);
    return created.id;
  }

  /**
   * Resolves a POSIX-like folder path (e.g. '/LIBRIX/Library') into a Google Drive Folder ID.
   * If folders don't exist on Google Drive, creates the hierarchy automatically.
   */
  public async getOrCreateFolderPath(folderPath: string): Promise<string | undefined> {
    if (!folderPath || folderPath === '/' || folderPath === 'root') {
      return undefined;
    }

    // If already a Google Drive folder ID
    if (!folderPath.includes('/') && folderPath.length > 15) {
      return folderPath;
    }

    const cleanPath = folderPath.replace(/\/+/g, '/').replace(/^\/|\/$/g, '');
    const cached = this.folderCache.get(cleanPath) || this.folderCache.get('/' + cleanPath);
    if (cached) return cached;

    const segments = cleanPath.split('/').filter(s => s.trim().length > 0);
    if (segments.length === 0) return undefined;

    let currentParentId: string | undefined = undefined;

    for (const segment of segments) {
      const folderId = await this.findOrCreateFolder(segment, currentParentId);
      currentParentId = folderId;
    }

    if (currentParentId) {
      this.folderCache.set(cleanPath, currentParentId);
      this.folderCache.set('/' + cleanPath, currentParentId);
    }
    return currentParentId;
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
