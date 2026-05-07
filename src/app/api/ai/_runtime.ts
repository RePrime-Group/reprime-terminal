import { NextResponse } from 'next/server';
import type { ApiError } from '@/lib/ai/types';

export function isMockEnabled(): boolean {
  if (process.env.AI_USE_MOCK === '1') return true;
  return process.env.NODE_ENV !== 'production';
}

export function isAssistantEnabled(): boolean {
  const flag = process.env.NEXT_PUBLIC_AI_ASSISTANT_ENABLED;
  if (flag === '1' || flag === 'true') return true;
  if (flag === '0' || flag === 'false') return false;
  return process.env.NODE_ENV !== 'production';
}

export function jsonError(
  code: ApiError['error']['code'],
  message: string,
  status: number,
) {
  return NextResponse.json<ApiError>({ error: { code, message } }, { status });
}

export function serviceDisabled() {
  return jsonError(
    'service_disabled',
    'AI assistant is not enabled in this environment.',
    503,
  );
}
