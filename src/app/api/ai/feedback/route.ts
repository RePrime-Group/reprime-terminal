import { NextRequest, NextResponse } from 'next/server';
import type { FeedbackRequest, FeedbackResponse } from '@/lib/ai/types';
import { isAssistantEnabled, jsonError, serviceDisabled } from '../_runtime';
import { callN8n, getAuthedSession } from '../_n8n';

export const maxDuration = 15;

export async function POST(request: NextRequest) {
  if (!isAssistantEnabled()) return serviceDisabled();

  let body: FeedbackRequest;
  try {
    body = (await request.json()) as FeedbackRequest;
  } catch {
    return jsonError('bad_request', 'Invalid JSON body.', 400);
  }

  if (!body.message_id || (body.rating !== 1 && body.rating !== -1)) {
    return jsonError('bad_request', 'message_id and rating (-1|1) are required.', 400);
  }

  const session = await getAuthedSession();
  if (!session) return jsonError('unauthorized', 'Sign in required.', 401);

  const result = await callN8n<{ ok?: boolean }>(
    'N8N_WEBHOOK_PATH_FEEDBACK',
    {
      user_id: session.userId,
      message_id: body.message_id,
      rating: body.rating,
      reason: body.reason ?? null,
    },
    session,
    10_000,
  );

  if (!result.ok) return jsonError(result.code, result.message, result.status);

  const payload: FeedbackResponse = { ok: true };
  return NextResponse.json(payload);
}
