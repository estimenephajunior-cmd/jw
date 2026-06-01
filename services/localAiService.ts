export interface AiMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface GenerateAiTextInput {
  prompt?: string;
  system?: string;
  messages?: AiMessage[];
  model?: string;
}

export interface GenerateAiTextResult {
  text: string;
  provider: AiProvider;
}

export type AiProvider = 'openai' | 'gemini';

const OPENAI_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY?.trim();
const GEMINI_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY?.trim();
const OPENAI_MODEL = process.env.EXPO_PUBLIC_OPENAI_MODEL || 'gpt-4o-mini';
const GEMINI_MODEL = process.env.EXPO_PUBLIC_GEMINI_MODEL || 'gemini-2.0-flash';

function buildMessages(input: GenerateAiTextInput): AiMessage[] {
  if (input.messages?.length) {
    const msgs = [...input.messages];
    if (input.system && !msgs.some((m) => m.role === 'system')) {
      return [{ role: 'system', content: input.system }, ...msgs];
    }
    return msgs;
  }
  const userContent = input.prompt || '';
  return [
    ...(input.system ? [{ role: 'system' as const, content: input.system }] : []),
    { role: 'user' as const, content: userContent },
  ];
}

async function generateWithOpenAI(input: GenerateAiTextInput): Promise<GenerateAiTextResult> {
  if (!OPENAI_KEY) throw new Error('OpenAI API key not configured');

  const messages = buildMessages(input);
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_KEY}`,
    },
    body: JSON.stringify({
      model: input.model || OPENAI_MODEL,
      messages,
      temperature: 0.35,
    }),
    signal: AbortSignal.timeout(120000),
  });

  if (!response.ok) {
    const err = await response.text().catch(() => '');
    throw new Error(`OpenAI request failed (${response.status})${err ? `: ${err.slice(0, 200)}` : ''}`);
  }

  const data = await response.json();
  const text = String(data?.choices?.[0]?.message?.content ?? '').trim();
  if (!text) throw new Error('OpenAI returned an empty response.');
  return { text, provider: 'openai' };
}

async function generateWithGemini(input: GenerateAiTextInput): Promise<GenerateAiTextResult> {
  if (!GEMINI_KEY) throw new Error('Gemini API key not configured');

  const messages = buildMessages(input);
  const model = input.model || GEMINI_MODEL;

  const systemParts = messages.filter((m) => m.role === 'system').map((m) => m.content);
  const contents = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: systemParts.length
          ? { parts: [{ text: systemParts.join('\n\n') }] }
          : undefined,
        contents,
        generationConfig: { temperature: 0.35 },
      }),
      signal: AbortSignal.timeout(120000),
    }
  );

  if (!response.ok) {
    const err = await response.text().catch(() => '');
    throw new Error(`Gemini request failed (${response.status})${err ? `: ${err.slice(0, 200)}` : ''}`);
  }

  const data = await response.json();
  const text = String(
    data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text).join('') ?? ''
  ).trim();
  if (!text) throw new Error('Gemini returned an empty response.');
  return { text, provider: 'gemini' };
}

/**
 * Generate text using OpenAI (preferred) or Google Gemini.
 * Set EXPO_PUBLIC_OPENAI_API_KEY and/or EXPO_PUBLIC_GEMINI_API_KEY.
 */
export async function generateAiText(input: GenerateAiTextInput): Promise<GenerateAiTextResult> {
  const errors: string[] = [];

  if (OPENAI_KEY) {
    try {
      return await generateWithOpenAI(input);
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }

  if (GEMINI_KEY) {
    try {
      return await generateWithGemini(input);
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }

  if (!OPENAI_KEY && !GEMINI_KEY) {
    throw new Error(
      'AI is not configured. Add EXPO_PUBLIC_OPENAI_API_KEY or EXPO_PUBLIC_GEMINI_API_KEY to your environment.'
    );
  }

  throw new Error(errors.join(' | ') || 'AI generation failed.');
}

/** @deprecated Use generateAiText */
export async function generateLocalAiText(input: GenerateAiTextInput): Promise<GenerateAiTextResult> {
  return generateAiText(input);
}
