import { Platform } from 'react-native';

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

const DEFAULT_MODEL = process.env.EXPO_PUBLIC_OLLAMA_MODEL || 'llama3.1';

function buildPrompt(input: GenerateAiTextInput): string {
  if (input.prompt) return input.prompt;
  return (input.messages ?? [])
    .map((message) => `${message.role.toUpperCase()}:\n${message.content}`)
    .join('\n\n');
}

export async function generateLocalAiText(input: GenerateAiTextInput): Promise<{ text: string; provider: 'ollama' }> {
  const prompt = buildPrompt(input);
  const endpoint = Platform.OS === 'web'
    ? 'http://localhost:3001/ollama'
    : 'http://127.0.0.1:11434/api/generate';

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: input.model || DEFAULT_MODEL,
      prompt,
      system: input.system,
      stream: false,
      options: {
        temperature: 0.35,
        top_p: 0.9,
      },
    }),
    signal: AbortSignal.timeout(120000),
  });

  if (!response.ok) {
    throw new Error(`Ollama request failed (${response.status}). Make sure Ollama is running and model "${input.model || DEFAULT_MODEL}" is pulled.`);
  }

  const data = await response.json();
  const text = String(data?.response ?? data?.message?.content ?? '').trim();
  if (!text) throw new Error('Ollama returned an empty response.');
  return { text, provider: 'ollama' };
}

export async function generateAiText(input: GenerateAiTextInput): Promise<{ text: string; provider: 'ollama' }> {
  return generateLocalAiText(input);
}
