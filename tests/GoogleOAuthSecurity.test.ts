/**
 * LIBRIX Google OAuth Security Test Suite
 *
 * Verifies the security invariants of the REAL OAuth 2.0 Authorization Code +
 * PKCE implementation:
 *   - RFC 7636 compliance (Appendix B reference vector)
 *   - Cryptographic randomness for PKCE verifiers and CSRF states
 *   - State validation BEFORE any token exchange (CSRF)
 *   - Strict token-response validation
 *   - Refresh-token preservation (Google does not always rotate)
 *   - access_denied maps to CANCELLED, never CONNECTED
 *   - Popup-blocked falls back to the full-page redirect flow
 *   - Honest quota parsing incl. unlimited accounts
 *   - No secrets in logs
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  googleOAuthService,
  GoogleOAuthService,
  LIBRIX_DRIVE_SCOPES,
} from '../src/storage/oauth/GoogleOAuthService';
import { GoogleDriveProvider, parseDriveStorageQuota } from '../src/storage/providers/GoogleDriveProvider';
import { getPlatformServices } from '../src/platform/PlatformFactory';

const RFC7636_VERIFIER = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
const RFC7636_CHALLENGE = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';

// ---------------------------------------------------------------------------
// sessionStorage / window test doubles (node env has neither)
// ---------------------------------------------------------------------------

function makeSessionStore() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => void map.set(k, String(v)),
    removeItem: (k: string) => void map.delete(k),
    clear: () => void map.clear(),
    _map: map,
  };
}

interface WindowStubOptions {
  search?: string;
}

function stubBrowserGlobals(opts: WindowStubOptions = {}) {
  const sessionStore = makeSessionStore();
  const win: any = {
    location: {
      search: opts.search ?? '',
      pathname: '/',
      origin: 'http://localhost:5173',
      href: 'http://localhost:5173/',
    },
    history: { replaceState: vi.fn() },
    screenX: 0,
    screenY: 0,
    outerWidth: 1200,
    outerHeight: 800,
    open: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
  vi.stubGlobal('window', win);
  vi.stubGlobal('document', { title: 'Librix' });
  vi.stubGlobal('sessionStorage', sessionStore);
  return { win, sessionStore };
}

function seedPendingSession(sessionStore: ReturnType<typeof makeSessionStore>, overrides: Record<string, unknown> = {}) {
  const session = {
    connectionId: 'gdrive-main',
    providerType: 'gdrive',
    clientId: 'test-client-id.apps.googleusercontent.com',
    redirectUri: 'http://localhost:5173/oauth/google/callback',
    state: 'EXPECTED_STATE_VALUE_1234567890abcd',
    codeVerifier: RFC7636_VERIFIER,
    createdAt: Date.now(),
    ...overrides,
  };
  sessionStore.setItem('librix_oauth_pending_flow', JSON.stringify(session));
  return session;
}

describe('PKCE (RFC 7636)', () => {
  it('matches the official RFC 7636 Appendix B reference vector (S256)', async () => {
    const challenge = await googleOAuthService.computeCodeChallenge(RFC7636_VERIFIER);
    expect(challenge).toBe(RFC7636_CHALLENGE);
  });

  it('generates high-entropy 43-char base64url verifiers with matching S256 challenges', async () => {
    const { codeVerifier, codeChallenge } = await googleOAuthService.generatePKCE();

    expect(codeVerifier).toHaveLength(43);
    expect(codeVerifier).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(codeChallenge).toMatch(/^[A-Za-z0-9_-]+$/);
    // Challenge must be the hash of THIS verifier, not a constant.
    expect(codeChallenge).toBe(await googleOAuthService.computeCodeChallenge(codeVerifier));
  });

  it('never produces the same verifier twice (uniqueness over many draws)', async () => {
    const seen = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const { codeVerifier } = await googleOAuthService.generatePKCE();
      seen.add(codeVerifier);
    }
    expect(seen.size).toBe(50);
  });

  it('rejects malformed code verifiers', async () => {
    await expect(googleOAuthService.computeCodeChallenge('short')).rejects.toThrow(/43-128/);
    await expect(googleOAuthService.computeCodeChallenge('')).rejects.toThrow(/43-128/);
    await expect(googleOAuthService.computeCodeChallenge('a'.repeat(129))).rejects.toThrow(/43-128/);
  });
});

describe('CSRF state generation', () => {
  it('produces unique 32-char base64url states', () => {
    const states = new Set<string>();
    for (let i = 0; i < 25; i++) {
      const s = googleOAuthService.generateSecureState();
      expect(s).toHaveLength(32);
      expect(s).toMatch(/^[A-Za-z0-9_-]+$/);
      states.add(s);
    }
    expect(states.size).toBe(25);
  });
});

describe('Authorization URL construction', () => {
  const base = {
    clientId: 'my-own-client-id.apps.googleusercontent.com',
    redirectUri: 'http://localhost:5173/oauth/google/callback',
    state: 'S'.repeat(32),
    codeChallenge: 'C'.repeat(43),
  };

  it('includes response_type=code, S256 method, offline access, and consent prompt', () => {
    const url = googleOAuthService.buildAuthUrl(base);
    expect(url.startsWith(GoogleOAuthService.AUTH_ENDPOINT)).toBe(true);
    expect(url).toContain('response_type=code');
    expect(url).toContain('code_challenge_method=S256');
    expect(url).toContain(`code_challenge=${base.codeChallenge}`);
    expect(url).toContain('access_type=offline');
    expect(url).toContain('prompt=consent');
    expect(url).toContain(`redirect_uri=${encodeURIComponent(base.redirectUri)}`);
    expect(url).toContain(`client_id=${base.clientId}`);
    expect(url).toContain(`state=${base.state}`);
  });

  it('requests exactly the documented minimal scope set', () => {
    expect(LIBRIX_DRIVE_SCOPES).toEqual([
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/drive.readonly',
      'https://www.googleapis.com/auth/userinfo.email',
    ]);
    const url = googleOAuthService.buildAuthUrl(base);
    const scopeParam = new URL(url).searchParams.get('scope') || '';
    const granted = scopeParam.split(/[ +]/);
    for (const s of LIBRIX_DRIVE_SCOPES) expect(granted).toContain(s);
    // Never requests blanket Drive control
    expect(granted.some(s => s.endsWith('/auth/drive'))).toBe(false);
  });

  it('REFUSES to build an authorization URL without PKCE (S256 is mandatory)', () => {
    expect(() =>
      googleOAuthService.buildAuthUrl({ ...base, codeChallenge: undefined })
    ).toThrow(/PKCE code_challenge is mandatory/);
  });

  it('requires clientId, redirectUri and state', () => {
    expect(() => googleOAuthService.buildAuthUrl({ ...base, clientId: '' })).toThrow(/client_id/);
    expect(() => googleOAuthService.buildAuthUrl({ ...base, redirectUri: '' })).toThrow(/redirect_uri/);
    expect(() => googleOAuthService.buildAuthUrl({ ...base, state: '' })).toThrow(/state/);
  });

  it('appends login_hint when provided', () => {
    const url = googleOAuthService.buildAuthUrl({ ...base, loginHint: 'scholar@gmail.com' });
    expect(url).toContain('login_hint=scholar%40gmail.com');
  });
});

describe('Callback handling: CSRF validation ordering', () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.unstubAllGlobals();
  });

  function neverCallTokenEndpoint() {
    const fetchMock = vi.fn(async () => {
      throw new Error('TOKEN ENDPOINT MUST NOT BE CALLED');
    });
    global.fetch = fetchMock as any;
    return fetchMock;
  }

  function expectFailedFlow(result: Awaited<ReturnType<typeof googleOAuthService.completeRedirectFlow>>): {
    status: string;
    error: string;
  } {
    if (!result || result.success) throw new Error('Expected a FAILED OAuth flow result');
    return result;
  }

  it('ABORTS before token exchange when the returned state does not match (tampered callback)', async () => {
    const { sessionStore } = stubBrowserGlobals({ search: '?code=STOLEN_CODE&state=TAMPERED_STATE' });
    seedPendingSession(sessionStore); // expected state: EXPECTED_STATE_VALUE_...
    const fetchMock = neverCallTokenEndpoint();

    const failure = expectFailedFlow(await googleOAuthService.completeRedirectFlow());

    expect(failure.status).toBe('auth_failed');
    expect(failure.error).toMatch(/Invalid OAuth state/i);
    // The stolen authorization code was never sent anywhere.
    expect(fetchMock).not.toHaveBeenCalled();
    // Pending session consumed (single-use anti-replay).
    expect(sessionStore.getItem('librix_oauth_pending_flow')).toBeNull();
  });

  it('maps access_denied to CANCELLED without any network call', async () => {
    const { sessionStore } = stubBrowserGlobals({
      search: `?error=access_denied&state=${'EXPECTED_STATE_VALUE_1234567890abcd'}`,
    });
    seedPendingSession(sessionStore);
    const fetchMock = neverCallTokenEndpoint();

    const failure = expectFailedFlow(await googleOAuthService.completeRedirectFlow());

    expect(failure.status).toBe('cancelled');
    expect(failure.error).toMatch(/cancelled|access denied/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects callbacks with NO matching pending session (replay/forged callback)', async () => {
    stubBrowserGlobals({ search: '?code=SOME_CODE&state=SOME_STATE' });
    // NOTE: no pending session seeded.
    const fetchMock = neverCallTokenEndpoint();

    const failure = expectFailedFlow(await googleOAuthService.completeRedirectFlow());

    expect(failure.error).toMatch(/No active OAuth session/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('expires pending sessions after the 10-minute TTL (verifier single-use window)', async () => {
    const { sessionStore } = stubBrowserGlobals({ search: '?code=C&state=EXPECTED_STATE_VALUE_1234567890abcd' });
    seedPendingSession(sessionStore, { createdAt: Date.now() - 11 * 60 * 1000 });

    const failure = expectFailedFlow(await googleOAuthService.completeRedirectFlow());

    expect(failure.error).toMatch(/No active OAuth session/i);
  });

  it('completes a VALID callback: validates state first, exchanges code with PKCE verifier, returns tokens', async () => {
    const { sessionStore } = stubBrowserGlobals({
      search: `?code=GOOD_AUTH_CODE&state=${'EXPECTED_STATE_VALUE_1234567890abcd'}`,
    });
    const seeded = seedPendingSession(sessionStore);

    let capturedBody = '';
    global.fetch = vi.fn(async (_url: any, init?: any) => {
      capturedBody = String(init?.body || '');
      return {
        ok: true,
        status: 200,
        json: async () => ({
          access_token: 'ya29.valid_access_token',
          refresh_token: '1//valid_refresh_token',
          expires_in: 3600,
          token_type: 'Bearer',
          scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.readonly',
        }),
      } as any;
    }) as any;

    const result = await googleOAuthService.completeRedirectFlow();

    expect(result!.success).toBe(true);
    if (result!.success) {
      expect(result!.tokens.accessToken).toBe('ya29.valid_access_token');
      expect(result!.tokens.refreshToken).toBe('1//valid_refresh_token');
      expect(result!.tokens.expiresAt).toBeGreaterThan(Date.now());
    }

    // Exchange MUST be a proper authorization_code grant carrying the PKCE verifier.
    const params = new URLSearchParams(capturedBody);
    expect(params.get('grant_type')).toBe('authorization_code');
    expect(params.get('code')).toBe('GOOD_AUTH_CODE');
    expect(params.get('code_verifier')).toBe(seeded.codeVerifier);
    expect(params.get('client_id')).toBe(seeded.clientId);
    expect(params.get('redirect_uri')).toBe(seeded.redirectUri);

    // Pending session consumed exactly once.
    expect(sessionStore.getItem('librix_oauth_pending_flow')).toBeNull();
  });

  it('leaks NO secrets into console logs during the full callback lifecycle', async () => {
    const { sessionStore } = stubBrowserGlobals({
      search: `?code=SUPER_SECRET_AUTH_CODE&state=${'EXPECTED_STATE_VALUE_1234567890abcd'}`,
    });
    seedPendingSession(sessionStore);

    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    global.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        access_token: 'SUPER_SECRET_ACCESS_TOKEN_XYZ',
        refresh_token: 'SUPER_SECRET_REFRESH_TOKEN_XYZ',
        expires_in: 3600,
        token_type: 'Bearer',
        scope: 'https://www.googleapis.com/auth/drive.file',
      }),
    })) as any;

    try {
      await googleOAuthService.completeRedirectFlow();

      const logged = infoSpy.mock.calls.map(args => args.map(a => JSON.stringify(a)).join(' ')).join('\n');
      expect(logged).not.toContain('SUPER_SECRET_AUTH_CODE');
      expect(logged).not.toContain('SUPER_SECRET_ACCESS_TOKEN_XYZ');
      expect(logged).not.toContain('SUPER_SECRET_REFRESH_TOKEN_XYZ');
      expect(logged).not.toContain(RFC7636_VERIFIER);
    } finally {
      infoSpy.mockRestore();
    }
  });
});

describe('Token response validation', () => {
  it('accepts a well-formed Bearer payload with Drive scope', () => {
    expect(() =>
      googleOAuthService.validateTokenResponse({
        access_token: 'at',
        token_type: 'Bearer',
        expires_in: 3600,
        scope: 'https://www.googleapis.com/auth/drive.file',
      })
    ).not.toThrow();
  });

  it('rejects payloads without an access_token', () => {
    expect(() => googleOAuthService.validateTokenResponse({ token_type: 'Bearer' })).toThrow(/access_token/);
    expect(() => googleOAuthService.validateTokenResponse(null)).toThrow(/not an object/);
    expect(() => googleOAuthService.validateTokenResponse('string')).toThrow(/not an object/);
  });

  it('rejects non-Bearer token types', () => {
    expect(() =>
      googleOAuthService.validateTokenResponse({ access_token: 'at', token_type: 'MAC' })
    ).toThrow(/unsupported token_type/);
  });

  it('rejects non-positive or non-finite expires_in', () => {
    expect(() => googleOAuthService.validateTokenResponse({ access_token: 'at', expires_in: 0 })).toThrow(/expires_in/);
    expect(() => googleOAuthService.validateTokenResponse({ access_token: 'at', expires_in: -5 })).toThrow(/expires_in/);
    expect(() => googleOAuthService.validateTokenResponse({ access_token: 'at', expires_in: 'soon' })).toThrow(/expires_in/);
  });

  it('rejects grants whose scope lacks any Drive access', () => {
    expect(() =>
      googleOAuthService.validateTokenResponse({
        access_token: 'at',
        scope: 'https://www.googleapis.com/auth/userinfo.email',
      })
    ).toThrow(/does not include Drive/);
  });
});

describe('Token exchange & refresh', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('surfaces Google error_description from failed exchanges', async () => {
    global.fetch = vi.fn(async () => ({
      ok: false,
      status: 400,
      json: async () => ({ error: 'invalid_grant', error_description: 'Bad Request' }),
    })) as any;

    await expect(
      googleOAuthService.exchangeCodeForTokens({
        code: 'bad',
        clientId: 'cid',
        redirectUri: 'http://localhost/cb',
        codeVerifier: RFC7636_VERIFIER,
      })
    ).rejects.toThrow('Bad Request');
  });

  it('refuses to exchange without a PKCE code_verifier', async () => {
    await expect(
      googleOAuthService.exchangeCodeForTokens({ code: 'c', clientId: 'cid', redirectUri: 'r' })
    ).rejects.toThrow(/code_verifier is required/);
  });

  it('PRESERVES the existing refresh token when Google omits rotation (spec §18)', async () => {
    global.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        access_token: 'new_at',
        expires_in: 3500,
        token_type: 'Bearer',
        // NOTE: no refresh_token in the response — Google kept the old one.
      }),
    })) as any;

    const refreshed = await googleOAuthService.refreshAccessToken({
      refreshToken: 'EXISTING_REFRESH_TOKEN',
      clientId: 'cid',
    });
    expect(refreshed.accessToken).toBe('new_at');
    expect(refreshed.refreshToken).toBe('EXISTING_REFRESH_TOKEN');
  });

  it('adopts a rotated refresh token when Google issues one', async () => {
    global.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        access_token: 'new_at',
        refresh_token: 'ROTATED_REFRESH_TOKEN',
        expires_in: 3500,
        token_type: 'Bearer',
      }),
    })) as any;

    const refreshed = await googleOAuthService.refreshAccessToken({
      refreshToken: 'OLD',
      clientId: 'cid',
    });
    expect(refreshed.refreshToken).toBe('ROTATED_REFRESH_TOKEN');
  });
});

describe('Popup flow behaviour', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    vi.unstubAllGlobals();
  });

  it('returns popup_blocked and leaves NO pending session behind when window.open fails', async () => {
    const { sessionStore } = stubBrowserGlobals();
    (window as any).open = vi.fn(() => null);

    const result = await googleOAuthService.startInteractiveOAuthFlow({
      clientId: 'cid.apps.googleusercontent.com',
      connectionId: 'gdrive-test',
    });

    expect(result.success).toBe(false);
    expect(result.status).toBe('popup_blocked');
    expect(sessionStore.getItem('librix_oauth_pending_flow')).toBeNull();
  });

  it('falls back to the FULL-PAGE REDIRECT flow when popups are blocked (provider level)', async () => {
    stubBrowserGlobals();
    (window as any).open = vi.fn(() => null); // simulate popup blocker

    const platform = getPlatformServices();
    const gdrive = new GoogleDriveProvider(platform, 'gdrive_fallback_test', 'GDrive Fallback');
    gdrive.configure({ clientId: 'fallback-client.apps.googleusercontent.com' });

    const ok = await gdrive.authenticate({ interactive: true });
    expect(ok).toBe(false); // navigation hands control to Google; nothing connected yet

    // The page must now be navigating to Google's consent screen.
    const href = (window as any).location.href as string;
    expect(href.startsWith(GoogleOAuthService.AUTH_ENDPOINT)).toBe(true);
    expect(href).toContain('response_type=code');
    expect(href).toContain('code_challenge_method=S256');

    // A pending session must exist so the post-redirect round-trip can validate state.
    const pendingRaw = sessionStorage.getItem('librix_oauth_pending_flow');
    expect(pendingRaw).toBeTruthy();
    const pending = JSON.parse(pendingRaw!);
    expect(pending.connectionId).toBe('gdrive_fallback_test');
    expect(pending.codeVerifier.length).toBeGreaterThanOrEqual(43);
    expect(googleOAuthService.peekPendingConnectionId()).toBe('gdrive_fallback_test');
  });
});

describe('Honest quota parsing (parseDriveStorageQuota)', () => {
  it('reports UNLIMITED truthfully when Google omits the limit', () => {
    const q = parseDriveStorageQuota({ usage: '52428800' });
    expect(q.isAvailable).toBe(true);
    expect(q.quotaSource).toBe('api');
    expect(q.unlimited).toBe(true);
    expect(q.total).toBe(0); // 0 == "no finite number reported", never invented
    expect(q.free).toBe(0);
    expect(q.used).toBe(52428800);
  });

  it('computes free space for finite limits', () => {
    const q = parseDriveStorageQuota({ limit: '1000', usage: '400' });
    expect(q.unlimited ?? false).toBe(false);
    expect(q.total).toBe(1000);
    expect(q.used).toBe(400);
    expect(q.free).toBe(600);
  });

  it('maps Drive-specific usage splits (My Drive vs Trash)', () => {
    const q = parseDriveStorageQuota({
      limit: '16106127360',
      usage: '5368709120',
      usageInDrive: '5000000000',
      usageInDriveTrash: '368709120',
    });
    expect(q.usageInDrive).toBe(5000000000);
    expect(q.usageInDriveTrash).toBe(368709120);
  });

  it('degrades garbage input to zeros without throwing', () => {
    const q = parseDriveStorageQuota(undefined);
    expect(q.isAvailable).toBe(true);
    expect(q.total).toBe(0);
    expect(q.used).toBe(0);
    expect(q.free).toBe(0);

    const q2 = parseDriveStorageQuota({ limit: 'NaN', usage: '-42' });
    expect(q2.total).toBe(0); // treated as unlimited rather than invented
    expect(q2.unlimited).toBe(true);
    expect(q2.used).toBe(0); // negatives are discarded
  });
});

describe('Provider guards (no accidental connectivity)', () => {
  it('performs NO network calls and stays disconnected before authentication', async () => {
    const fetchSpy = vi.fn();
    const originalFetch = global.fetch;
    global.fetch = fetchSpy as any;

    try {
      const platform = getPlatformServices();
      const gdrive = new GoogleDriveProvider(platform, 'gdrive_guard_test', 'Guard');

      const files = await gdrive.listFiles();
      expect(files).toEqual([]);

      const quota = await gdrive.getQuota();
      expect(quota.isAvailable).toBe(false);
      expect(quota.total).toBe(0);

      expect(gdrive.isConnected()).toBe(false);
      expect(gdrive.getStatus()).toBe('disconnected');
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('fails authentication fast with an instructive error when NO client id is configured', async () => {
    stubBrowserGlobals();
    (window as any).open = vi.fn(() => null);

    const { googleOAuthConfig } = await import('../src/storage/oauth/GoogleOAuthConfig');
    const originalClientId = googleOAuthConfig.getConfig().clientId;
    googleOAuthConfig.setDeveloperClientId(''); // Clear client ID for test

    try {
      const platform = getPlatformServices();
      const gdrive = new GoogleDriveProvider(platform, 'gdrive_noclient_test', 'NoClient');

      const ok = await gdrive.authenticate({ interactive: true });
      expect(ok).toBe(false);
      expect(gdrive.getConnectionState().lastError).toMatch(/OAuth/i);
      expect(gdrive.isConnected()).toBe(false);
    } finally {
      googleOAuthConfig.setDeveloperClientId(originalClientId);
      vi.unstubAllGlobals();
    }
  });
});
