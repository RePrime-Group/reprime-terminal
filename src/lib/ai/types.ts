export type Role = 'user' | 'assistant' | 'tool' | 'system';

export type CitationKind = 'document' | 'tenant' | 'deal_field' | 'computed';

export interface Citation {
  id: string;
  kind: CitationKind;
  label: string;
  document_id?: string;
  page?: number;
  deal_field?: string;
  tenant_id?: string;
  scenario_id?: string;
}

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
  status: 'pending' | 'success' | 'error';
}

export interface Message {
  id: string;
  role: Role;
  content: string;
  citations?: Citation[];
  tool_calls?: ToolCall[];
  created_at: string;
}

export interface Conversation {
  id: string;
  deal_id: string;
  title: string;
  updated_at: string;
}

export interface ChatRequest {
  deal_id: string;
  conversation_id?: string;
  message: string;
}

export interface ChatResponse {
  conversation_id: string;
  message: Message;
}

export interface ListConversationsResponse {
  conversations: Conversation[];
}

export interface GetConversationResponse {
  conversation: Conversation;
  messages: Message[];
}

export interface ApiError {
  error: {
    code:
      | 'unauthorized'
      | 'forbidden'
      | 'not_found'
      | 'rate_limited'
      | 'service_disabled'
      | 'internal'
      | 'bad_request'
      | 'upstream_error';
    message: string;
  };
}
