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

export type AiProvider = 'gemini' | 'openai' | 'groq' | 'openrouter';

const GEMINI_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY?.trim();
const OPENAI_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY?.trim();
const GROQ_KEY = (
  process.env.EXPO_PUBLIC_GROQ_API_KEY || process.env.EXPO_PUBLIC_GROK_API_KEY
)?.trim();
const OPENROUTER_KEY = process.env.EXPO_PUBLIC_OPENROUTER_API_KEY?.trim();

const GEMINI_MODEL = process.env.EXPO_PUBLIC_GEMINI_MODEL || 'gemini-2.5-flash';
const OPENAI_MODEL = process.env.EXPO_PUBLIC_OPENAI_MODEL || 'gpt-4o-mini';
const GROQ_MODEL = process.env.EXPO_PUBLIC_GROQ_MODEL || 'openai/gpt-oss-20b';
const OPENROUTER_MODEL =
  process.env.EXPO_PUBLIC_OPENROUTER_MODEL || 'google/gemini-2.5-flash';

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

async function generateWithChatCompletions(
  input: GenerateAiTextInput,
  opts: {
    baseUrl: string;
    apiKey: string;
    model: string;
    provider: AiProvider;
    extraHeaders?: Record<string, string>;
    label: string;
  }
): Promise<GenerateAiTextResult> {
  const messages = buildMessages(input);
  const url = `${opts.baseUrl.replace(/\/$/, '')}/chat/completions`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${opts.apiKey}`,
      ...opts.extraHeaders,
    },
    body: JSON.stringify({
      model: input.model || opts.model,
      messages,
      temperature: 0.35,
      max_tokens: 4096,
    }),
    signal: AbortSignal.timeout(120000),
  });

  if (!response.ok) {
    const err = await response.text().catch(() => '');
    throw new Error(
      `${opts.label} failed (${response.status})${err ? `: ${err.slice(0, 200)}` : ''}`
    );
  }

  const data = await response.json();
  const text = String(data?.choices?.[0]?.message?.content ?? '').trim();
  if (!text) throw new Error(`${opts.label} returned an empty response.`);
  return { text, provider: opts.provider };
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
        generationConfig: { temperature: 0.35, maxOutputTokens: 8192 },
      }),
      signal: AbortSignal.timeout(120000),
    }
  );

  if (!response.ok) {
    const err = await response.text().catch(() => '');
    throw new Error(`Gemini failed (${response.status})${err ? `: ${err.slice(0, 200)}` : ''}`);
  }

  const data = await response.json();
  const text = String(
    data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text).join('') ?? ''
  ).trim();
  if (!text) throw new Error('Gemini returned an empty response.');
  return { text, provider: 'gemini' };
}

/**
 * Generate text using API keys (tries in order until one succeeds):
 * Gemini (AI Studio) → OpenAI → Groq → OpenRouter
 */
export async function generateAiText(input: GenerateAiTextInput): Promise<GenerateAiTextResult> {
  const errors: string[] = [];

  const providers: Array<() => Promise<GenerateAiTextResult>> = [];

  if (GEMINI_KEY) {
    providers.push(() => generateWithGemini(input));
  }
  if (OPENAI_KEY) {
    providers.push(() =>
      generateWithChatCompletions(input, {
        baseUrl: 'https://api.openai.com/v1',
        apiKey: OPENAI_KEY,
        model: OPENAI_MODEL,
        provider: 'openai',
        label: 'OpenAI',
      })
    );
  }
  if (GROQ_KEY) {
    providers.push(() =>
      generateWithChatCompletions(input, {
        baseUrl: 'https://api.groq.com/openai/v1',
        apiKey: GROQ_KEY,
        model: GROQ_MODEL,
        provider: 'groq',
        label: 'Groq',
      })
    );
  }
  if (OPENROUTER_KEY) {
    providers.push(() =>
      generateWithChatCompletions(input, {
        baseUrl: 'https://openrouter.ai/api/v1',
        apiKey: OPENROUTER_KEY,
        model: OPENROUTER_MODEL,
        provider: 'openrouter',
        label: 'OpenRouter',
        extraHeaders: {
          'HTTP-Referer': 'https://jw-study-assistant.local',
          'X-Title': 'JW Study Assistant',
        },
      })
    );
  }

  if (!providers.length) {
    throw new Error(
      'AI is not configured. Set one or more: EXPO_PUBLIC_GEMINI_API_KEY, EXPO_PUBLIC_OPENAI_API_KEY, EXPO_PUBLIC_GROQ_API_KEY, EXPO_PUBLIC_OPENROUTER_API_KEY'
    );
  }

  for (const run of providers) {
    try {
      return await run();
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }

  throw new Error(errors.join(' | ') || 'AI generation failed.');
}

/** @deprecated Use generateAiText */
export async function generateLocalAiText(input: GenerateAiTextInput): Promise<GenerateAiTextResult> {
  return generateAiText(input);
}
