/**
 * Firebase Client Enclave Adapter
 * Safely initializes Firebase config and auth helpers using firebase-applet-config.json or environment variables.
 */
import appletConfig from '../../firebase-applet-config.json';
import { signInWithGoogleOAuth } from './supabaseGoogleAuth';

export interface FirebaseClientConfig {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
  measurementId?: string;
}

export const firebaseConfig: FirebaseClientConfig = {
  apiKey: (import.meta as any).env?.VITE_FIREBASE_API_KEY || appletConfig?.apiKey || '',
  authDomain: (import.meta as any).env?.VITE_FIREBASE_AUTH_DOMAIN || appletConfig?.authDomain || '',
  projectId: (import.meta as any).env?.VITE_FIREBASE_PROJECT_ID || appletConfig?.projectId || '',
  storageBucket: (import.meta as any).env?.VITE_FIREBASE_STORAGE_BUCKET || appletConfig?.storageBucket || '',
  messagingSenderId: (import.meta as any).env?.VITE_FIREBASE_MESSAGING_SENDER_ID || appletConfig?.messagingSenderId || '',
  appId: (import.meta as any).env?.VITE_FIREBASE_APP_ID || appletConfig?.appId || '',
  measurementId: (import.meta as any).env?.VITE_FIREBASE_MEASUREMENT_ID || appletConfig?.measurementId || ''
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.projectId && (firebaseConfig.apiKey || (import.meta as any).env?.VITE_FIREBASE_API_KEY)
);

/**
 * Google Sign-In helper adapter
 */
export async function googleSignIn(options?: any) {
  try {
    return await signInWithGoogleOAuth(options);
  } catch (error: any) {
    console.warn('[firebaseClient] googleSignIn notice:', error);
    return { data: null, error };
  }
}

export const signInWithGoogle = googleSignIn;

export async function signOutFromFirebase() {
  return { error: null };
}

export const auth = null;
export const firebaseAuth = null;
export const db = null;
export const firestore = null;

export function getFirebaseAuth() {
  return null;
}

export default firebaseConfig;
