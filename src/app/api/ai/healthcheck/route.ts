import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isAssistantEnabled, jsonError, serviceDisabled } from '../_runtime';

const N8N_HEALTHCHECK_URL =
  `${process.env.N8N_BASE_URL ?? ''}${process.env.N8N_WEBHOOK_PATH_HEALTHCHECK ?? '/webhook/ai-healthcheck'}`;

export async function POST() {
  if (!isAssistantEnabled()) return serviceDisabled();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return jsonError('unauthorized', 'No active session.', 401);
  }

  let n8nResponse: Response;
  try {
    n8nResponse = await fetch(N8N_HEALTHCHECK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return jsonError('upstream_error', 'n8n healthcheck request failed.', 502);
  }

  if (!n8nResponse.ok) {
    return jsonError('upstream_error', 'n8n healthcheck returned an error.', 502);
  }

  const data = (await n8nResponse.json()) as { user_id: string; ok: boolean };
  return NextResponse.json(data);
}
