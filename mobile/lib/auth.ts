import { supabase } from '../supabase-client';

/**
 * Ensures the user is authenticated
 * Returns the user ID
 * Throws error if not authenticated
 */
export async function ensureAuthenticated(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.user) {
    throw new Error('User is not authenticated');
  }

  return session.user.id;
}

/**
 * Gets the current user ID if authenticated, null otherwise
 */
export async function getCurrentUserId(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id || null;
}

/**
 * Signs out the current user
 */
export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}
