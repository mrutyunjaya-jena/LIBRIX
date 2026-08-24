/**
 * LIBRIX Application Google OAuth Configuration Layer
 *
 * Separates application-level OAuth configuration (Client ID, Redirect URIs, Scopes)
 * from user credentials (tokens, session state, storage metadata).
 *
 * For Open-Source Developers:
 * Custom OAuth Client IDs can be configured via environment variables:
 * - VITE_GOOGLE_CLIENT_ID
 * - VITE_GOOGLE_REDIRECT_URI
 */

export interface GoogleAppOAuthConfig {
  clientId: string;
  redirectUri: string;
  scopes: string[];
  isProduction: boolean;
  environment: string;
}

export class GoogleOAuthConfigManager {
  private static instance: GoogleOAuthConfigManager | null = null;

  // Official Librix Google Drive OAuth Scopes (Minimum necessary permissions)
  public static readonly REQUIRED_SCOPES = [
    'https://www.googleapis.com/auth/drive.file', // Create/edit files managed by Librix
    'https://www.googleapis.com/auth/drive.readonly', // Read documents in user's library
    'https://www.googleapis.com/auth/drive.metadata.readonly', // Read storage quota & file listings
    'https://www.googleapis.com/auth/userinfo.email', // Display user's authenticated email
    'https://www.googleapis.com/auth/userinfo.profile', // User profile display name
  ];

  // Default public OAuth Client ID for Librix Workstation
  // Note: OAuth 2.0 PKCE is used for public clients; client secrets are never bundled in frontend/apps.
  private defaultClientId = '1084729184712-librix-desktop-workstation.apps.googleusercontent.com';

  public static getInstance(): GoogleOAuthConfigManager {
    if (!GoogleOAuthConfigManager.instance) {
      GoogleOAuthConfigManager.instance = new GoogleOAuthConfigManager();
    }
    return GoogleOAuthConfigManager.instance;
  }

  /**
   * Retrieves the active application OAuth configuration
   */
  public getConfig(): GoogleAppOAuthConfig {
    // 1. Check environment variables (Build-time / Developer overrides)
    let envClientId: string | undefined;
    let envRedirectUri: string | undefined;

    try {
      if (typeof import.meta !== 'undefined' && (import.meta as any).env) {
        envClientId = (import.meta as any).env.VITE_GOOGLE_CLIENT_ID;
        envRedirectUri = (import.meta as any).env.VITE_GOOGLE_REDIRECT_URI;
      }
    } catch {
      // ignore
    }

    const clientId = envClientId || this.defaultClientId;
    const redirectUri =
      envRedirectUri ||
      (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173');

    return {
      clientId,
      redirectUri,
      scopes: GoogleOAuthConfigManager.REQUIRED_SCOPES,
      isProduction: typeof process !== 'undefined' ? process.env?.NODE_ENV === 'production' : false,
      environment: typeof window !== 'undefined' ? 'browser' : 'native',
    };
  }

  /**
   * Sets custom Client ID (for development testing or custom builds)
   */
  public setDeveloperClientId(clientId: string): void {
    this.defaultClientId = clientId;
  }
}

export const googleOAuthConfig = GoogleOAuthConfigManager.getInstance();
