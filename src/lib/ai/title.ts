import Anthropic from '@anthropic-ai/sdk';
import { createAdminClient } from '@/lib/supabase/admin';

const TITLE_PROMPT = `Generate a concise 4 to 6 word title summarizing this conversation. Output the title text only: no quotes, no prefix like "Title:", no trailing punctuation.`;

export async function generateAndSaveConversationTitle(params: {
  conversationId: string;
  userMessage: string;
  assistantMessage: string;
}): Promise<void> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return;

  try {
    const anthropic = new Anthropic({ apiKey });
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 32,
      messages: [
        {
          role: 'user',
          content: `${TITLE_PROMPT}\n\nUser: ${params.userMessage.slice(0, 800)}\nAssistant: ${params.assistantMessage.slice(0, 1200)}`,
        },
      ],
    });

    const block = response.content[0];
    const raw = block && block.type === 'text' ? block.text : '';
    const title = raw
      .trim()
      .replace(/^["'`]+|["'`.]+$/g, '')
      .slice(0, 80);

    if (!title) return;

    const admin = createAdminClient();
    await admin.from('terminal_ai_conversations').update({ title }).eq('id', params.conversationId);
  } catch (err) {
    console.error('[ai-title] generation failed', err);
  }
}
