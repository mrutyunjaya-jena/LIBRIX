import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';

// ---------------------------------------------------------------------------
// OAuth 2.0 callback routing (Google Drive & future providers).
//
// PATH A — Popup flow: the popup lands here with ?code/?error and relays the
// payload to the opener via postMessage, then closes itself. The opener's
// GoogleOAuthService validates state + exchanges the code.
//
// PATH B — Redirect fallback: the SAME window returns from Google. The provider
// layer (via processStartupOAuthCallback) validates the CSRF state against the
// pending session, exchanges the authorization code for tokens, persists them
// in secure storage, verifies the live Drive API, and only then marks CONNECTED.
// The app renders only after this completes so the UI reflects the real state.
// ---------------------------------------------------------------------------
if (
  typeof window !== 'undefined' &&
  window.opener &&
  (window.location.search.includes('code=') || window.location.search.includes('error='))
) {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const state = params.get('state');
  const error = params.get('error');
  window.opener.postMessage({ type: 'LIBRIX_OAUTH_CALLBACK', code, state, error }, window.location.origin);
  window.close();
} else if (
  typeof window !== 'undefined' &&
  (window.location.search.includes('code=') || window.location.search.includes('error='))
) {
  // PATH B — bootstrap before first paint, asynchronously.
  void import('./storage/oauth/OAuthBootstrap').then(async ({ processStartupOAuthCallback }) => {
    try {
      await processStartupOAuthCallback();
    } catch (err) {
      console.error('[LIBRIX::OAUTH] Startup callback processing failed:', err);
    } finally {
      ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
        <React.StrictMode>
          <App />
        </React.StrictMode>
      );
    }
  });
} else {
  ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
