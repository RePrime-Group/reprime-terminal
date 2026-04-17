/**
 * Utilities for turning backend / network errors into friendly,
 * user-facing strings. Never surface raw Supabase or Postgres error
 * messages to investors — always route through here.
 */

const SUPABASE_AUTH_MAP: Array<[RegExp, string]> = [
  [/invalid login credentials/i, 'That email or password is incorrect.'],
  [/email not confirmed/i, "Your email hasn't been confirmed yet. Please check your inbox for the confirmation link."],
  [/user already registered|already been registered/i, 'An account with that email already exists. Try signing in instead.'],
  [/rate limit/i, 'Too many attempts. Please wait a few minutes and try again.'],
  [/password should be at least/i, 'Your password is too short. Use at least 8 characters.'],
  [/new password should be different/i, 'Your new password must be different from your current password.'],
  [/unable to validate email address/i, 'That email address looks invalid.'],
  [/signup requires a valid password/i, 'Please choose a stronger password (at least 8 characters).'],
  [/user not found/i, 'We couldn\u2019t find an account with that email.'],
];

/**
 * Map a Supabase auth error message to a friendly string.
 * Returns `fallback` if no known pattern matches.
 */
export function friendlyAuthError(message: string | undefined | null, fallback: string): string {
  if (!message) return fallback;
  for (const [pattern, friendly] of SUPABASE_AUTH_MAP) {
    if (pattern.test(message)) return friendly;
  }
  return fallback;
}

/**
 * True if an exception thrown from `fetch()` or similar looks like a
 * network/connectivity failure (not an HTTP error).
 */
export function isNetworkError(err: unknown): boolean {
  if (!err) return false;
  const msg = err instanceof Error ? err.message : String(err);
  return /failed to fetch|network request failed|fetch failed|load failed|networkerror/i.test(msg);
}

/**
 * Message for an exception caught around `fetch()`. Network failures
 * get a friendly connectivity message; anything else falls back.
 */
export function friendlyFetchError(err: unknown, fallback: string): string {
  if (isNetworkError(err)) {
    return 'Connection problem. Please check your internet and try again.';
  }
  return fallback;
}

/**
 * Read an `{ error: string }` body from a failed API response. If the
 * body is malformed, empty, or looks like a raw Postgres/Supabase
 * error (e.g. contains "duplicate key", "violates", etc.) returns
 * `fallback` instead of leaking it.
 */
export async function readApiError(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.json();
    const raw = body?.error;
    if (typeof raw !== 'string' || !raw.trim()) return fallback;
    // Guard against leaking low-level database errors that slipped past
    // server-side wrapping.
    if (/duplicate key|violates|syntax error|relation .* does not exist|permission denied|row-level security/i.test(raw)) {
      return fallback;
    }
    return raw;
  } catch {
    return fallback;
  }
}
