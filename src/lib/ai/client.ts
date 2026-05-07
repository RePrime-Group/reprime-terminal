import type {
  ChatRequest,
  ChatResponse,
  FeedbackRequest,
  FeedbackResponse,
  GetConversationResponse,
  ListConversationsResponse,
} from './types';

class AiClientError extends Error {
  constructor(public code: string, message: string, public status: number) {
    super(message);
    this.name = 'AiClientError';
  }
}

async function request<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  const data: unknown = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const err =
      data && typeof data === 'object' && 'error' in data
        ? (data as { error: { code: string; message: string } }).error
        : { code: 'internal', message: res.statusText || 'Request failed' };
    throw new AiClientError(err.code, err.message, res.status);
  }

  return data as T;
}

export function sendMessage(body: ChatRequest, signal?: AbortSignal) {
  return request<ChatResponse>('/api/ai/chat', {
    method: 'POST',
    body: JSON.stringify(body),
    signal,
  });
}

export function listConversations(dealId: string, signal?: AbortSignal) {
  return request<ListConversationsResponse>(
    `/api/ai/conversations?deal_id=${encodeURIComponent(dealId)}`,
    { signal },
  );
}

export function getConversation(id: string, signal?: AbortSignal) {
  return request<GetConversationResponse>(
    `/api/ai/conversations/${encodeURIComponent(id)}`,
    { signal },
  );
}

export function submitFeedback(body: FeedbackRequest) {
  return request<FeedbackResponse>('/api/ai/feedback', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export { AiClientError };
