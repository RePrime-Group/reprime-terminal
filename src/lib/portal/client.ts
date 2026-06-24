import 'server-only';
import type { MatchRequest, MatchResponse } from './types';

export type PortalErrorCode =
  | 'service_disabled'
  | 'unauthorized'
  | 'validation'
  | 'upstream_error'
  | 'timeout';

export interface PortalSuccess {
  ok: true;
  data: MatchResponse;
}
export interface PortalFailure {
  ok: false;
  code: PortalErrorCode;
  status: number;
  message: string;
}
export type PortalResult = PortalSuccess | PortalFailure;

const DEFAULT_TIMEOUT_MS = 30_000;

export async function matchListings(
  request: MatchRequest,
  opts: { timeoutMs?: number } = {},
): Promise<PortalResult> {
  const base = process.env.REPRIME_PORTAL_BASE_URL;
  const token = process.env.REPRIME_INTERNAL_TOKEN;
  if (!base || !token) {
    return {
      ok: false,
      code: 'service_disabled',
      status: 503,
      message: 'Portal bridge not configured. Set REPRIME_PORTAL_BASE_URL and REPRIME_INTERNAL_TOKEN.',
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  try {
    const res = await fetch(`${base.replace(/\/$/, '')}/api/external/match-listings`, {
      method: 'POST',
      signal: controller.signal,
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-token': token,
      },
      body: JSON.stringify(request),
    });

    if (!res.ok) {
      const code: PortalErrorCode =
        res.status === 401 ? 'unauthorized' : res.status === 400 ? 'validation' : 'upstream_error';
      const message = await readErrorMessage(res, code);
      return { ok: false, code, status: res.status, message };
    }

    const data = (await res.json()) as MatchResponse;
    return { ok: true, data };
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return { ok: false, code: 'timeout', status: 504, message: 'Portal request timed out.' };
    }
    return { ok: false, code: 'upstream_error', status: 502, message: 'Failed to reach the portal.' };
  } finally {
    clearTimeout(timeout);
  }
}

async function readErrorMessage(res: Response, code: PortalErrorCode): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string; details?: unknown };
    if (code === 'validation' && body.details) {
      return `Portal rejected the criteria: ${JSON.stringify(body.details)}`;
    }
    if (body.error) return `Portal error: ${body.error}`;
  } catch {
    // not JSON, fall through
  }
  if (code === 'unauthorized') return 'Portal rejected the token. Check REPRIME_INTERNAL_TOKEN on both sides.';
  return `Portal responded ${res.status}.`;
}
