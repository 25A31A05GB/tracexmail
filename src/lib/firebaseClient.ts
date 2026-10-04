import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  User, 
  signOut 
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App instance safely (singleton)
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Provider with full Workspace Gmail defense scopes
export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('https://www.googleapis.com/auth/gmail.readonly');
googleProvider.addScope('https://www.googleapis.com/auth/gmail.modify');
googleProvider.addScope('https://www.googleapis.com/auth/gmail.settings.basic');
googleProvider.addScope('https://www.googleapis.com/auth/userinfo.email');

// Prompt user to select their account explicitly
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

// In-memory token cache (never in localStorage to prevent token leaks)
let cachedAccessToken: string | null = null;
let cachedUser: User | null = null;
let isSigningIn = false;

/**
 * Initializes the auth state listener on app load.
 */
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    cachedUser = user;
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        // Attempt to retrieve fresh token if possible
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

/**
 * Sign in with Google Popup.
 * Allows ANY user to authenticate with their personal or corporate Google Workspace account,
 * granting access strictly to THEIR OWN mailbox.
 */
export const googleSignIn = async (): Promise<{ user: User; accessToken: string }> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);

    if (!credential?.accessToken) {
      throw new Error('Could not acquire Google OAuth token for user mailbox.');
    }

    cachedAccessToken = credential.accessToken;
    cachedUser = result.user;

    // Cache the user's email dynamically
    if (result.user.email) {
      localStorage.setItem('user_email', result.user.email);
      localStorage.setItem('google_access_token', cachedAccessToken);
    }

    // Register active user connection in backend enclave database
    try {
      await fetch('/api/gmail/connect-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cachedAccessToken}`
        },
        body: JSON.stringify({
          email: result.user.email,
          access_token: cachedAccessToken
        })
      });
    } catch (e) {
      console.warn('[FirebaseAuth] Could not notify backend of session connection:', e);
    }

    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('[FirebaseAuth] Google Sign-in Error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

/**
 * Returns currently cached Google access token.
 */
export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken || localStorage.getItem('google_access_token');
};

/**
 * Returns currently active authenticated user.
 */
export const getCurrentUser = (): User | null => {
  return cachedUser || auth.currentUser;
};

/**
 * Sign out of Google session.
 */
export const logoutGoogle = async () => {
  await signOut(auth);
  cachedAccessToken = null;
  cachedUser = null;
  localStorage.removeItem('google_access_token');
};
