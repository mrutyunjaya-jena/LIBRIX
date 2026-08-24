/**
 * LIBRIX Google OAuth 2.0 Client Service
 * Implements the REAL Authorization Code Flow with PKCE (RFC 7636 / RFC 6749 §4.1),
 * CSRF state validation, token exchange, automatic refresh, and revocation.
 *
 * SECURITY INVARIANTS (enforced in code, verified by tests):
 *  - PKCE verifiers/states come ONLY from crypto.getRandomValues (never Math.random).
 *  - A verifier is single-use and never persisted beyond the lifetime of one flow.
 *  - The OAuth `state` is validated on every callback; mismatch aborts before any
 *    token exchange takes place.
 *  - Nothing sensitive (code / access_token / refresh_token / client_secret /
 *    Authorization header / verifier) is ever written to logs.
 */

import { googleOAuthConfig } from './GoogleOAuthConfig';

/** Non-sensitive lifecycle events for diagnostics. NEVER pass secrets here. */
export type OAuthLifecycleEvent =
  | 'oauth_started'
  | 'oauth_redirect_started'
  | 'oauth_callback_received'
  | 'oauth_state_validated'
  | 'oauth_state_mismatch'
  | 'authorization_code_received'
  | 'token_exchange_started'
  | 'token_exchange_succeeded'
  | 'token_exchange_failed'
  | 'token_refresh_succeeded'
  | 'token_refresh_failed'
  | 'token_revoked';

function oauthLog(event: OAuthLifecycleEvent, details?: Record<string, string | number | boolean>): void {
  const payload = { event, at: new Date().toISOString(), ...details };
  // Safe diagnostic channel — contains identifiers only, never credentials.
  console.info('[LIBRIX::OAUTH]', payload);
}

export interface GoogleOAuthConfig {
  clientId: string;
  clientSecret?: string;
  redirectUri: string;
  scopes?: string[];
}

export interface GoogleOAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  expiresAt?: number;
  tokenType?: string;
  scope?: string;
}

export interface GoogleUserInfo {
  id?: string;
  email: string;
  displayName?: string;
  picture?: string;
}

export type OAuthFlowStatus = 'authenticated' | 'cancelled' | 'auth_failed' | 'network_error' | 'popup_blocked';

export type OAuthFlowResult =
  | { success: true; tokens: GoogleOAuthTokens; status: 'authenticated' }
  | { success: false; error: string; status: Exclude<OAuthFlowStatus, 'authenticated'> };

/**
 * Scopes requested by Librix — minimum set required for real functionality.
 *
 * RATIONALE FOR EACH SCOPE (no blanket Drive access is requested):
 *  1. drive.file   — Create/upload/modify/delete/search files that Librix itself
 *                    manages in the user's Drive (library sync, backups). This is
 *                    per-file scope and cannot read unrelated private files.
 *  2. drive.readonly — Read existing user documents so they can be imported into
 *                    the Librix library (viewing requires full file content access).
 *  3. userinfo.email — Identify WHICH Google account was authorized so the UI can
 *                    display the real authenticated address.
 *
 * Deliberately NOT requested: drive (full account control), drive.metadata
 * (subsumed by the two scopes above), userinfo.profile (display name already
 * comes from drive.about.get), activity/gmail/etc.
 */
export const LIBRIX_DRIVE_SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
];

const PENDING_OAUTH_KEY = 'librix_oauth_pending_flow';
const VERIFIER_TTL_MS = 10 * 60 * 1000; // A pending authorization attempt expires after 10 minutes.

interface PendingOAuthSession {
  connectionId: string;
  providerType: string;
  clientId: string;
  clientSecret?: string;
  redirectUri: string;
  state: string;
  codeVerifier: string;
  createdAt: number;
}

function requireSecureRandom(byteCount: number): Uint8Array {
  if (typeof crypto === 'undefined' || typeof crypto.getRandomValues !== 'function') {
    throw new Error(
      'A cryptographically secure random source (crypto.getRandomValues) is required for OAuth.'
    );
  }
  const bytes = new Uint8Array(byteCount);
  crypto.getRandomValues(bytes);
  return bytes;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export class GoogleOAuthService {
  private static instance: GoogleOAuthService | null = null;

  public static readonly AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
  public static readonly TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
  public static readonly USERINFO_ENDPOINT = 'https://www.googleapis.com/oauth2/v3/userinfo';
  public static readonly REVOKE_ENDPOINT = 'https://oauth2.googleapis.com/revoke';

  /** Kept as an alias for backward compatibility; prefer LIBRIX_DRIVE_SCOPES. */
  public static readonly DEFAULT_SCOPES = LIBRIX_DRIVE_SCOPES;

  public static getInstance(): GoogleOAuthService {
    if (!GoogleOAuthService.instance) {
      GoogleOAuthService.instance = new GoogleOAuthService();
    }
    return GoogleOAuthService.instance;
  }

  // ==========================================================
  // PKCE (RFC 7636)
  // ==========================================================

  /**
   * Generates a high-entropy PKCE code_verifier (43 chars, base64url alphabet)
   * from cryptographically secure randomness, plus its S256 code_challenge:
   *   code_challenge = BASE64URL(SHA256(ASCII(code_verifier)))
   */
  public async generatePKCE(): Promise<{ codeVerifier: string; codeChallenge: string }> {
    const verifierBytes = requireSecureRandom(32);
    const codeVerifier = base64UrlEncode(verifierBytes);
    const codeChallenge = await this.computeCodeChallenge(codeVerifier);
    return { codeVerifier, codeChallenge };
  }

  /** Pure S256 challenge computation (RFC 7636 Appendix B compatible). */
  public async computeCodeChallenge(codeVerifier: string): Promise<string> {
    if (!codeVerifier || codeVerifier.length < 43 || codeVerifier.length > 128) {
      throw new Error('PKCE code_verifier must be 43-128 characters.');
    }
    if (typeof crypto === 'undefined' || !crypto.subtle) {
      throw new Error('WebCrypto (crypto.subtle) is required for S256 PKCE challenges.');
    }
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier));
    return base64UrlEncode(new Uint8Array(digest));
  }

  /**
   * Generates a cryptographically secure random `state` parameter for CSRF protection.
   */
  public generateSecureState(): string {
    return base64UrlEncode(requireSecureRandom(24));
  }

  // ==========================================================
  // AUTHORIZATION URL
  // ==========================================================

  /**
   * Builds the official Google OAuth 2.0 authorization URL.
   * Always uses response_type=code + PKCE S256 + access_type=offline.
   */
  public buildAuthUrl(options: {
    clientId: string;
    redirectUri: string;
    state: string;
    codeChallenge?: string;
    scopes?: string[];
    loginHint?: string;
  }): string {
    if (!options.clientId) throw new Error('OAuth client_id is required.');
    if (!options.redirectUri) throw new Error('OAuth redirect_uri is required.');
    if (!options.state) throw new Error('OAuth state is required.');

    const params = new URLSearchParams({
      client_id: options.clientId,
      redirect_uri: options.redirectUri,
      response_type: 'code',
      scope: (options.scopes || LIBRIX_DRIVE_SCOPES).join(' '),
      state: options.state,
      access_type: 'offline', // Request a refresh_token for long-lived access
      prompt: 'consent', // Force refresh_token issuance on re-auth
      include_granted_scopes: 'true',
    });

    if (options.codeChallenge) {
      params.append('code_challenge', options.codeChallenge);
      params.append('code_challenge_method', 'S256');
    } else {
      throw new Error('PKCE code_challenge is mandatory for Librix OAuth flows.');
    }

    if (options.loginHint) {
      params.append('login_hint', options.loginHint);
    }

    return `${GoogleOAuthService.AUTH_ENDPOINT}?${params.toString()}`;
  }

  // ==========================================================
  // INTERACTIVE POPUP FLOW (web / electron default)
  // ==========================================================

  public async startInteractiveOAuthFlow(options: {
    clientId: string;
    clientSecret?: string;
    redirectUri?: string;
    loginHint?: string;
    connectionId?: string;
    providerType?: string;
    onProgress?: (step: string) => void;
  }): Promise<OAuthFlowResult> {
    if (typeof window === 'undefined') {
      return { success: false, error: 'OAuth popup flow requires a browser window environment.', status: 'auth_failed' };
    }

    const redirectUri =
      options.redirectUri ||
      `${window.location.origin}${window.location.pathname.replace(/\/$/, '')}/oauth/google/callback`;

    const state = this.generateSecureState();
    const { codeVerifier, codeChallenge } = await this.generatePKCE();

    // Persist the pending session BEFORE navigating anywhere, so the same-window
    // redirect fallback can validate state even after a full page reload.
    this.persistPendingSession({
      connectionId: options.connectionId || 'gdrive-main',
      providerType: options.providerType || 'gdrive',
      clientId: options.clientId,
      clientSecret: options.clientSecret,
      redirectUri,
      state,
      codeVerifier,
      createdAt: Date.now(),
    });

    const authUrl = this.buildAuthUrl({
      clientId: options.clientId,
      redirectUri,
      state,
      codeChallenge,
      loginHint: options.loginHint,
    });

    oauthLog('oauth_started', { provider: 'google_drive', method: 'popup' });
    options.onProgress?.('Opening Google authorization window...');

    return new Promise<OAuthFlowResult>((resolve) => {
      let settled = false;
      const width = 550;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      const popup = window.open(
        authUrl,
        'LibrixGoogleOAuth',
        `width=${width},height=${height},left=${left},top=${top},status=no,menubar=no,toolbar=no`
      );

      if (!popup || popup.closed) {
        this.clearPendingSession();
        resolve({
          success: false,
          error: 'Popup was blocked by the browser.',
          status: 'popup_blocked',
        });
        return;
      }

      const finish = (result: OAuthFlowResult) => {
        if (settled) return;
        settled = true;
        clearInterval(popupInterval);
        window.removeEventListener('message', messageListener);
        if (popup && !popup.closed) popup.close();
        if (!result.success && result.status !== 'popup_blocked') this.clearPendingSession();
        resolve(result);
      };

      // User closed the popup without completing authentication → CANCELLED.
      const popupInterval = setInterval(() => {
        if (!settled && popup.closed) {
          finish({ success: false, error: 'Authentication cancelled by user.', status: 'cancelled' });
        }
      }, 500);

      const messageListener = async (event: MessageEvent) => {
        if (!event.data || event.data.type !== 'LIBRIX_OAUTH_CALLBACK') return;
        options.onProgress?.('Authorization callback received...');
        oauthLog('oauth_callback_received', { source: 'popup' });

        const { code, state: returnedState, error } = event.data;
        const result = await this.handleCallbackPayload({
          code,
          returnedState,
          error,
          expectedState: state,
          codeVerifier,
          clientId: options.clientId,
          clientSecret: options.clientSecret,
          redirectUri,
          onProgress: options.onProgress,
        });
        finish(result);
      };

      window.addEventListener('message', messageListener);
    });
  }

  // ==========================================================
  // FULL-PAGE REDIRECT FLOW (fallback when popups are blocked,
  // and the primary mechanism for constrained platforms)
  // ==========================================================

  /**
   * Navigates the current page to Google's consent screen.
   * The pending session (verifier + expected state) is kept in sessionStorage
   * until `completeRedirectFlow()` consumes it after the round-trip.
   */
  public async startRedirectFlow(options: {
    clientId: string;
    clientSecret?: string;
    redirectUri?: string;
    connectionId?: string;
    providerType?: string;
    loginHint?: string;
  }): Promise<void> {
    if (typeof window === 'undefined') {
      throw new Error('Redirect OAuth flow requires a browser environment.');
    }
    const redirectUri =
      options.redirectUri ||
      `${window.location.origin}${window.location.pathname.replace(/\/$/, '')}/oauth/google/callback`;

    const state = this.generateSecureState();
    const { codeVerifier, codeChallenge } = await this.generatePKCE();

    this.persistPendingSession({
      connectionId: options.connectionId || 'gdrive-main',
      providerType: options.providerType || 'gdrive',
      clientId: options.clientId,
      clientSecret: options.clientSecret,
      redirectUri,
      state,
      codeVerifier,
      createdAt: Date.now(),
    });

    const authUrl = this.buildAuthUrl({
      clientId: options.clientId,
      redirectUri,
      state,
      codeChallenge,
      loginHint: options.loginHint,
    });

    oauthLog('oauth_redirect_started', { provider: 'google_drive', method: 'redirect' });
    window.location.href = authUrl;
  }

  /** Returns the connection a pending (not yet consumed) OAuth flow belongs to. */
  public peekPendingConnectionId(): string | null {
    return this.readPendingSession()?.connectionId ?? null;
  }

  /**
   * Completes an in-page OAuth redirect (same-window callback).
   * Returns null when the current URL is not an OAuth callback.
   * Enforces state equality BEFORE any token exchange happens.
   * The pending session is consumed exactly once, whatever the outcome.
   */
  public async completeRedirectFlow(): Promise<OAuthFlowResult & { connectionId?: string } | null> {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const returnedState = params.get('state');
    const error = params.get('error');
    if (!code && !error) return null;

    const pending = this.readPendingSession();

    oauthLog('oauth_callback_received', { source: 'redirect' });

    const cleanupUrl = () => {
      try {
        window.history.replaceState({}, document.title, window.location.pathname);
      } catch {
        /* noop */
      }
    };

    if (!pending) {
      cleanupUrl();
      return { success: false, status: 'auth_failed', error: 'No active OAuth session found for this callback.' };
    }

    const result = await this.handleCallbackPayload({
      code,
      returnedState,
      error,
      expectedState: pending.state,
      codeVerifier: pending.codeVerifier,
      clientId: pending.clientId,
      clientSecret: pending.clientSecret,
      redirectUri: pending.redirectUri,
    });

    this.clearPendingSession();
    cleanupUrl();
    // Report which connection initiated the flow even on failure, so callers can
    // route the resulting ERROR STATE to the right provider.
    return { ...result, connectionId: pending.connectionId };
  }

  /** Shared handler for both popup postMessage and same-window redirects. */
  private async handleCallbackPayload(args: {
    code: string | null;
    returnedState: string | null;
    error: string | null;
    expectedState: string;
    codeVerifier: string;
    clientId: string;
    clientSecret?: string;
    redirectUri: string;
    onProgress?: (step: string) => void;
  }): Promise<OAuthFlowResult> {
    const {
      code,
      returnedState,
      error,
      expectedState,
      codeVerifier,
      clientId,
      clientSecret,
      redirectUri,
      onProgress,
    } = args;

    // User denied consent at Google's screen.
    if (error) {
      if (error === 'access_denied') {
        return { success: false, error: 'Authentication cancelled by user (access denied).', status: 'cancelled' };
      }
      return { success: false, error: `Google OAuth error: ${error}`, status: 'auth_failed' };
    }

    // CSRF PROTECTION: compare returned state against the expected value and
    // ABORT before exchanging anything when they differ.
    if (!returnedState || returnedState !== expectedState) {
      oauthLog('oauth_state_mismatch', {});
      return { success: false, error: 'Authentication failed. Invalid OAuth state.', status: 'auth_failed' };
    }
    oauthLog('oauth_state_validated', {});

    if (!code) {
      return { success: false, error: 'Authorization code missing in OAuth response.', status: 'auth_failed' };
    }
    // NOTE: `code` is an authorization code — it is NOT an access token and must
    // never be used against the Drive API directly. Exchange it now.
    oauthLog('authorization_code_received', {});
    onProgress?.('Exchanging authorization code for tokens...');

    try {
      const tokens = await this.exchangeCodeForTokens({
        code,
        clientId,
        clientSecret,
        redirectUri,
        codeVerifier,
      });
      return { success: true, tokens, status: 'authenticated' };
    } catch (err: any) {
      const msg = err?.message || 'Token exchange failed.';
      const networkish = /failed to fetch|network/i.test(msg);
      return { success: false, error: msg, status: networkish ? 'network_error' : 'auth_failed' };
    }
  }

  // ==========================================================
  // PENDING SESSION STORAGE (transient, sessionStorage only)
  // ==========================================================

  private persistPendingSession(session: PendingOAuthSession): void {
    if (typeof sessionStorage === 'undefined') return;
    sessionStorage.setItem(PENDING_OAUTH_KEY, JSON.stringify(session));
  }

  private readPendingSession(): PendingOAuthSession | null {
    if (typeof sessionStorage === 'undefined') return null;
    try {
      const raw = sessionStorage.getItem(PENDING_OAUTH_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as PendingOAuthSession;
      if (Date.now() - parsed.createdAt > VERIFIER_TTL_MS) {
        this.clearPendingSession();
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  private clearPendingSession(): void {
    if (typeof sessionStorage === 'undefined') return;
    sessionStorage.removeItem(PENDING_OAUTH_KEY);
  }

  // ==========================================================
  // TOKEN ENDPOINT
  // ==========================================================

  /** Validates a token endpoint payload strictly before trusting it. */
  public validateTokenResponse(data: any): void {
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid token response: payload is not an object.');
    }
    if (!data.access_token || typeof data.access_token !== 'string') {
      throw new Error('Invalid token response: access_token is missing.');
    }
    const tokenType = (data.token_type || 'Bearer').toLowerCase();
    if (tokenType !== 'bearer') {
      throw new Error(`Invalid token response: unsupported token_type "${data.token_type}".`);
    }
    if (data.expires_in !== undefined) {
      const exp = Number(data.expires_in);
      if (!Number.isFinite(exp) || exp <= 0) {
        throw new Error('Invalid token response: expires_in must be a positive number.');
      }
    }
    if (data.scope && typeof data.scope === 'string') {
      const granted: string[] = data.scope.split(/[\s+]/);
      const hasDriveScope = granted.some(s => s.includes('googleapis.com/auth/drive'));
      if (!hasDriveScope) {
        throw new Error('Invalid token response: granted scope does not include Drive access.');
      }
    }
  }

  /**
   * Exchanges an authorization code for tokens via POST https://oauth2.googleapis.com/token.
   */
  public async exchangeCodeForTokens(params: {
    code: string;
    clientId: string;
    clientSecret?: string;
    redirectUri: string;
    codeVerifier?: string;
  }): Promise<GoogleOAuthTokens> {
    if (!params.code) throw new Error('Cannot exchange an empty authorization code.');
    if (!params.codeVerifier) throw new Error('PKCE code_verifier is required for token exchange.');

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code: params.code,
      client_id: params.clientId,
      redirect_uri: params.redirectUri,
      code_verifier: params.codeVerifier,
    });
    // For "Web application" Google clients a client_secret is required; SPA-type
    // ("JavaScript origin") clients authenticate purely via PKCE.
    if (params.clientSecret) body.append('client_secret', params.clientSecret);

    oauthLog('token_exchange_started', {});
    let response: Response;
    try {
      response = await fetch(GoogleOAuthService.TOKEN_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });
    } catch (err: any) {
      oauthLog('token_exchange_failed', { reason: 'network' });
      throw new Error(`Network error during token exchange: ${err?.message || err}`);
    }

    if (!response.ok) {
      let errorDesc = `Token exchange failed with HTTP ${response.status}`;
      try {
        const errorJson = await response.json();
        errorDesc = errorJson.error_description || errorJson.error || errorDesc;
      } catch {
        /* keep HTTP status description */
      }
      oauthLog('token_exchange_failed', { httpStatus: response.status });
      throw new Error(errorDesc);
    }

    const data = await response.json();
    this.validateTokenResponse(data);
    oauthLog('token_exchange_succeeded', {});

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
      expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
      tokenType: data.token_type || 'Bearer',
      scope: data.scope,
    };
  }

  /**
   * Refreshes an expired access token.
   * CRITICAL (per spec §18): Google does not always rotate refresh tokens —
   * when no new one is returned, KEEP the existing refresh token.
   */
  public async refreshAccessToken(params: {
    refreshToken: string;
    clientId?: string;
    clientSecret?: string;
  }): Promise<GoogleOAuthTokens> {
    const cleanRefreshToken = params.refreshToken.trim().replace(/^["']|["']$/g, '');
    const clientId =
      params.clientId?.trim() ||
      googleOAuthConfig.getConfig().clientId ||
      '407408718192.apps.googleusercontent.com';

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: cleanRefreshToken,
      client_id: clientId,
    });
    if (params.clientSecret?.trim()) {
      body.append('client_secret', params.clientSecret.trim());
    }

    let response: Response;
    try {
      response = await fetch(GoogleOAuthService.TOKEN_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });
    } catch (err: any) {
      oauthLog('token_refresh_failed', { reason: 'network' });
      throw new Error(`Network error during token refresh: ${err?.message || err}`);
    }

    if (!response.ok) {
      let errorDesc = `Token refresh failed with HTTP ${response.status}`;
      try {
        const errorJson = await response.json();
        errorDesc = errorJson.error_description || errorJson.error || errorDesc;
      } catch {
        /* keep HTTP status description */
      }
      oauthLog('token_refresh_failed', { httpStatus: response.status, error: errorDesc });
      throw new Error(`Google token refresh error: ${errorDesc}`);
    }

    const data = await response.json();
    this.validateTokenResponse(data);
    oauthLog('token_refresh_succeeded', {});

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || cleanRefreshToken, // Preserve existing refresh token!
      expiresIn: data.expires_in,
      expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
      tokenType: data.token_type || 'Bearer',
      scope: data.scope,
    };
  }

  /** Revokes a token server-side on disconnect. Never logs the token itself. */
  public async revokeToken(token: string): Promise<boolean> {
    try {
      const res = await fetch(`${GoogleOAuthService.REVOKE_ENDPOINT}?token=${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      oauthLog('token_revoked', { revoked: res.ok });
      return res.ok;
    } catch {
      oauthLog('token_revoked', { revoked: false });
      return false;
    }
  }
}

export const googleOAuthService = GoogleOAuthService.getInstance();
