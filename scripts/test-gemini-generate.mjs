/**
 * End-to-end Gemini generation test (same HTTP API as localAiService.ts).
 * Usage: node scripts/test-gemini-generate.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function loadEnv() {
  return Object.fromEntries(
    fs
      .readFileSync(path.join(root, '.env'), 'utf8')
      .split(/\r?\n/)
      .filter((l) => l && !l.trim().startsWith('#'))
      .map((l) => {
        const i = l.indexOf('=');
        return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
      })
  );
}

async function generateWithGemini({ key, model, messages }) {
  const systemParts = messages.filter((m) => m.role === 'system').map((m) => m.content);
  const contents = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: systemParts.length
          ? { parts: [{ text: systemParts.join('\n\n') }] }
          : undefined,
        contents,
        generationConfig: { temperature: 0.35, maxOutputTokens: 1024 },
      }),
    }
  );

  const body = await response.text();
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${body.slice(0, 400)}`);
  }

  const data = JSON.parse(body);
  const text = String(
    data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') ?? ''
  ).trim();
  const usage = data?.usageMetadata;
  return { text, usage, finishReason: data?.candidates?.[0]?.finishReason };
}

const env = loadEnv();
const key = env.EXPO_PUBLIC_GEMINI_API_KEY;
const model = env.EXPO_PUBLIC_GEMINI_MODEL || 'gemini-2.5-flash';

if (!key) {
  console.error('FAIL: EXPO_PUBLIC_GEMINI_API_KEY missing in .env');
  process.exit(1);
}

console.log('Model:', model);
console.log('Key prefix:', key.slice(0, 6) + '…');
console.log('');

const tests = [
  {
    name: '1) Simple generation (Studio-style)',
    messages: [{ role: 'user', content: 'In one short sentence, how does AI work?' }],
  },
  {
    name: '2) Poze AI / Chèche style (system + sources)',
    messages: [
      {
        role: 'system',
        content:
          'You are a JW Study Assistant. Answer ONLY using the provided sources. Cite [1], [2].',
      },
      {
        role: 'user',
        content: `Question: What is faith?

JW source bodies:
[1] Hebrews 11:1 — Faith is the assured expectation of what is hoped for, the evident demonstration of realities that are not seen.

Synthesize a clear answer in 2-3 sentences. Cite sources.`,
      },
    ],
  },
  {
    name: '3) Longer study answer (meeting-prep style)',
    messages: [
      {
        role: 'user',
        content: `You are a JW Study Assistant. Using only this verse, write a 4-sentence spoken answer for a meeting:

James 1:5 — If any of you is lacking in wisdom, let him keep asking God, for he gives generously to all and without reproaching.

End with: Based on sources: James 1:5`,
      },
    ],
  },
];

let failed = 0;
for (const t of tests) {
  console.log('---', t.name);
  try {
    const { text, usage, finishReason } = await generateWithGemini({
      key,
      model,
      messages: t.messages,
    });
    if (!text) {
      console.log('FAIL: empty response, finishReason =', finishReason);
      failed++;
      continue;
    }
    console.log('OK finish:', finishReason);
    if (usage) {
      console.log(
        'OK tokens: prompt',
        usage.promptTokenCount,
        '+ output',
        usage.candidatesTokenCount ?? usage.totalTokenCount
      );
    }
    console.log('OK preview:', text.slice(0, 220).replace(/\s+/g, ' ') + (text.length > 220 ? '…' : ''));
    console.log('OK length:', text.length, 'chars');
  } catch (e) {
    console.log('FAIL:', e.message);
    failed++;
  }
  console.log('');
}

if (failed) {
  console.error(`${failed} test(s) failed.`);
  process.exit(1);
}

console.log('All generation tests passed. Your app can use this key the same way.');
