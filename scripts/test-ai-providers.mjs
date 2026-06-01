/**
 * Test each configured AI provider independently.
 * Usage: node scripts/test-ai-providers.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function loadEnv() {
  const env = {};
  for (const line of fs.readFileSync(path.join(root, '.env'), 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i > 0) env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return env;
}

const env = loadEnv();
const prompt = 'Reply with exactly: JW Study Assistant AI test OK';

async function testGemini() {
  const key = env.EXPO_PUBLIC_GEMINI_API_KEY;
  const model = env.EXPO_PUBLIC_GEMINI_MODEL || 'gemini-2.5-flash';
  if (!key) return { name: 'Gemini', skip: true };

  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 64, temperature: 0.1 },
      }),
    }
  );
  const d = await r.json();
  const text = d?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('').trim();
  if (!r.ok) throw new Error(d?.error?.message || r.status);
  return { name: `Gemini (${model})`, text };
}

async function testChatCompletions(name, baseUrl, key, model, extraHeaders = {}) {
  if (!key) return { name, skip: true };

  const r = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
      ...extraHeaders,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 256,
      temperature: 0.1,
    }),
  });
  const d = await r.json();
  const text = d?.choices?.[0]?.message?.content?.trim();
  if (!r.ok) throw new Error(d?.error?.message || JSON.stringify(d).slice(0, 200));
  return { name: `${name} (${model})`, text };
}

const tests = [
  () => testGemini(),
  () =>
    testChatCompletions(
      'OpenAI',
      'https://api.openai.com/v1',
      env.EXPO_PUBLIC_OPENAI_API_KEY,
      env.EXPO_PUBLIC_OPENAI_MODEL || 'gpt-4o-mini'
    ),
  () =>
    testChatCompletions(
      'Groq',
      'https://api.groq.com/openai/v1',
      env.EXPO_PUBLIC_GROQ_API_KEY || env.EXPO_PUBLIC_GROK_API_KEY,
      env.EXPO_PUBLIC_GROQ_MODEL || 'openai/gpt-oss-20b'
    ),
  () =>
    testChatCompletions(
      'OpenRouter',
      'https://openrouter.ai/api/v1',
      env.EXPO_PUBLIC_OPENROUTER_API_KEY,
      env.EXPO_PUBLIC_OPENROUTER_MODEL || 'google/gemini-2.5-flash',
      { 'HTTP-Referer': 'https://jw-study-assistant.local', 'X-Title': 'JW Study Assistant' }
    ),
];

let failed = 0;
for (const run of tests) {
  try {
    const result = await run();
    if (result.skip) {
      console.log(`SKIP ${result.name} — no API key in .env`);
      continue;
    }
    console.log(`OK   ${result.name}`);
    console.log(`     ${result.text?.slice(0, 120) || '(empty)'}`);
  } catch (e) {
    console.log(`FAIL ${e.message?.slice(0, 200)}`);
    failed++;
  }
  console.log('');
}

process.exit(failed ? 1 : 0);
