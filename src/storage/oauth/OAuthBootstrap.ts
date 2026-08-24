/**
 * LIBRIX OAuth Startup Bootstrap
 *
 * Handles full-page-redirect OAuth callbacks (the fallback used when popup
 * windows are unavailable). The popup path is intercepted earlier in main.tsx
 * via postMessage; this module covers the SAME-WINDOW redirect round-trip:
 *
 *   app → accounts.google.com → app?code=...&state=...  (page reload)
 *
 * Routing rules:
 *  - The callback is ALWAYS routed through the storage provider layer
 *    (GoogleDriveProvider), which owns the connection state machine.
 *  - The UI never sets connected=true directly.
 */

import { googleOAuthService } from './GoogleOAuthService';
import { GoogleDriveProvider } from '../providers/GoogleDriveProvider';
import { storageRegistry } from '../StorageRegistry';

export interface StartupOAuthOutcome {
  connectionId: string;
  success: boolean;
  cancelled: boolean;
  error?: string;
}

/** sessionStorage flag the Cloud UI consumes once to surface the outcome. */
export const OAUTH_STARTUP_OUTCOME_KEY = 'librix_oauth_startup_outcome';

export async function processStartupOAuthCallback(): Promise<StartupOAuthOutcome | null> {
  if (typeof window === 'undefined') return null;

  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const error = params.get('error');
  const state = params.get('state');

  // Not an OAuth callback, or a popup callback (handled via postMessage in main.tsx).
  if ((!code && !error) || typeof window.opener !== 'undefined') return null;

  // Which connection initiated this flow? (read BEFORE consumption)
  const connectionId = googleOAuthService.peekPendingConnectionId();
  if (!connectionId) {
    // Stray callback with no matching flow (expired/cleared session).
    try {
      window.history.replaceState({}, document.title, window.location.pathname);
    } catch {
      /* noop */
    }
    return null;
  }

  // Ensure a provider instance exists for this connection and let IT decide the
  // resulting authentication state.
  let provider = storageRegistry.getProvider(connectionId) as GoogleDriveProvider | undefined;
  if (!provider || provider.type !== 'gdrive') {
    provider = storageRegistry.createCustomProvider({
      id: connectionId,
      name: 'Google Drive',
      type: 'gdrive',
    }) as GoogleDriveProvider;
  }

  const handled = await provider.completePendingRedirectAuth();
  const finalState = provider.getConnectionState();

  const outcome: StartupOAuthOutcome = {
    connectionId,
    success: handled && finalState.status === 'connected',
    cancelled: finalState.status === 'cancelled',
    error: handled ? undefined : finalState.lastError,
  };

  try {
    sessionStorage.setItem(OAUTH_STARTUP_OUTCOME_KEY, JSON.stringify(outcome));
  } catch {
    /* non-fatal */
  }

  return outcome;
}
