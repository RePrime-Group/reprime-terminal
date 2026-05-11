import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { Message } from '@/lib/ai/types';

export interface AuthedSession {
  userId: string;
  accessToken: string | null;
}

export async function getAuthedSession(): Promise<AuthedSession | null> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll() {},
      },
    },
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: { session } } = await supabase.auth.getSession();
  return { userId: user.id, accessToken: session?.access_token ?? null };
}

export interface CallN8nResult<T> {
  ok: true;
  data: T;
}
export interface CallN8nError {
  ok: false;
  status: number;
  code: 'unauthorized' | 'forbidden' | 'not_found' | 'upstream_error' | 'service_disabled';
  message: string;
}

export async function callN8n<T>(
  pathEnv: 'N8N_WEBHOOK_PATH_CHAT' | 'N8N_WEBHOOK_PATH_HISTORY',
  payload: Record<string, unknown>,
  session: AuthedSession,
  timeoutMs = 60_000,
): Promise<CallN8nResult<T> | CallN8nError> {
  const base = process.env.N8N_BASE_URL;
  const path = process.env[pathEnv];
  if (!base || !path) {
    return { ok: false, status: 503, code: 'service_disabled', message: 'Assistant backend not configured.' };
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${base}${path}`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(session.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : {}),
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      const code: CallN8nError['code'] =
        res.status === 401 ? 'unauthorized' : res.status === 403 ? 'forbidden' : res.status === 404 ? 'not_found' : 'upstream_error';
      return { ok: false, status: res.status, code, message: text || `Upstream returned ${res.status}` };
    }
    const data = (await res.json()) as T;
    return { ok: true, data };
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return { ok: false, status: 504, code: 'upstream_error', message: 'Upstream timed out.' };
    }
    return { ok: false, status: 502, code: 'upstream_error', message: 'Failed to reach upstream.' };
  } finally {
    clearTimeout(timeout);
  }
}

export function unwrapMessageContent(content: unknown): string {
  if (typeof content === 'string') {
    const trimmed = content.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed === 'object' && 'text' in parsed && typeof (parsed as { text: unknown }).text === 'string') {
          return (parsed as { text: string }).text;
        }
      } catch { /* not JSON, fall through */ }
    }
    return content;
  }
  if (content && typeof content === 'object' && 'text' in content && typeof (content as { text: unknown }).text === 'string') {
    return (content as { text: string }).text;
  }
  return '';
}

export function normalizeMessage(row: Record<string, unknown>): Message {
  return {
    id: String(row.id),
    role: (row.role as Message['role']) ?? 'assistant',
    content: unwrapMessageContent(row.content),
    citations: Array.isArray(row.citations) ? (row.citations as Message['citations']) : [],
    tool_calls: Array.isArray(row.tool_calls) ? (row.tool_calls as Message['tool_calls']) : undefined,
    created_at: String(row.created_at ?? new Date().toISOString()),
  };
}
