/**
 * Firebase Client & Google Workspace Auth Adapter
 * Strictly follows Google Workspace least-privilege scope guidelines (gmail.readonly)
 * and in-memory access token caching.
 */
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  signOut as fbSignOut
} from 'firebase/auth';
import appletConfig from '../../firebase-applet-config.json';

// Initialize or reuse Firebase App instance
export const app = getApps().length > 0 ? getApp() : initializeApp(appletConfig);
export const auth = getAuth(app);
export const firebaseAuth = auth;

export const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly'
];

// Configure GoogleAuthProvider with Workspace scopes
export const provider = new GoogleAuthProvider();
for (const scope of SCOPES) {
  provider.addScope(scope);
}
provider.setCustomParameters({
  prompt: 'consent',
  access_type: 'offline'
});

// Flag to indicate if we are in the middle of a sign-in flow.
let isSigningIn = false;

// In-Memory Token Cache (MUST NOT be stored in localStorage or sessionStorage)
let cachedAccessToken: string | null = null;

/**
 * Initialize auth state listener. Clears cached token on sign out.
 */
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export interface GoogleSignInResult {
  user: User;
  accessToken: string;
  data: {
    user: User;
    accessToken: string;
  };
  error: null;
}

/**
 * Triggers official Google OAuth sign-in popup requesting gmail.readonly permissions.
 * Caches the resulting OAuth access token in-memory and returns user profile + token.
 */
export async function googleSignIn(): Promise<GoogleSignInResult> {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to obtain Google access token from authentication result.');
    }

    cachedAccessToken = credential.accessToken;
    return {
      user: result.user,
      accessToken: cachedAccessToken,
      data: {
        user: result.user,
        accessToken: cachedAccessToken
      },
      error: null
    };
  } catch (error: any) {
    console.error('[Firebase Google Auth] Popup sign-in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
}

export const signInWithGoogle = googleSignIn;

/**
 * Returns currently cached in-memory access token.
 */
export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

/**
 * Sets or updates cached in-memory access token.
 */
export const setCachedAccessToken = (token: string | null): void => {
  cachedAccessToken = token;
};

/**
 * Signs out from Firebase and wipes in-memory token.
 */
export async function signOutFromFirebase() {
  cachedAccessToken = null;
  try {
    await fbSignOut(auth);
  } catch (err) {
    console.warn('[Firebase Auth] SignOut error:', err);
  }
  return { error: null };
}

export const logout = signOutFromFirebase;

export function getFirebaseAuth() {
  return auth;
}

export const isFirebaseConfigured = Boolean(appletConfig?.projectId && appletConfig?.apiKey);

export const db = null;
export const firestore = null;

export default appletConfig;
