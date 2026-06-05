// Client-side state the app persists in localStorage. Cleared on sign-out so it
// never carries across sessions on a shared machine (session-hygiene / OWASP
// client-storage guidance). Add any new app localStorage key here.
const APP_LOCAL_STORAGE_KEYS = [
  'admin.dealList.collapsed',
  'admin.dealList.view',
];

/**
 * Removes the app's own localStorage keys on sign-out. Targeted (not
 * localStorage.clear()) so Supabase's auth keys and unrelated entries are left
 * to their own lifecycles.
 */
export function clearClientState(): void {
  if (typeof window === 'undefined') return;
  for (const key of APP_LOCAL_STORAGE_KEYS) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Ignore storage access errors (private mode, disabled storage, etc.).
    }
  }
}
