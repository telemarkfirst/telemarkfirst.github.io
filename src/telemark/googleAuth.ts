import {
  getAdditionalUserInfo,
  signOut,
  signInWithPopup,
  type UserCredential,
} from 'firebase/auth';
import { auth, provider } from './firebase';
import { trackEvent } from './analytics';
import {syncLocalProgressWithUser} from './progressCloud';

interface SignInOptions {
  trackAnalytics?: boolean;
  syncProgress?: boolean;
}

export async function signInWithGoogle(
  options: SignInOptions = {},
): Promise<UserCredential> {
  const result = await signInWithPopup(auth, provider);

  if (!result.user.emailVerified) {
    await signOut(auth);
    throw new Error('Google did not provide a verified email for this account.');
  }

  // Signing in is optional for the curriculum, but if it happens through
  // Sharp AI or the sync page, carry this browser's work into the account.
  // A progress-network failure must not block access to the authenticated AI.
  if (options.syncProgress !== false) {
    try {
      await syncLocalProgressWithUser(result.user);
    } catch (error) {
      console.warn('Telemark signed in, but progress sync will retry later:', error);
    }
  }

  if (options.trackAnalytics !== false) {
    const eventName = getAdditionalUserInfo(result)?.isNewUser ? 'sign_up' : 'login';
    trackEvent(eventName, { method: 'Google' });
  }

  return result;
}
