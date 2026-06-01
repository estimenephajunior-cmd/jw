import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const envPath = path.join(root, '.env');

const env = Object.fromEntries(
  fs
    .readFileSync(envPath, 'utf8')
    .split(/\r?\n/)
    .filter((l) => l && !l.trim().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const key = env.EXPO_PUBLIC_GEMINI_API_KEY;
const model = env.EXPO_PUBLIC_GEMINI_MODEL || 'gemini-2.0-flash';

if (!key) {
  console.error('FAIL: EXPO_PUBLIC_GEMINI_API_KEY not set in .env');
  process.exit(1);
}

const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
const res = await fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    contents: [{ role: 'user', parts: [{ text: 'Reply with exactly: JW Study Assistant API test OK' }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 256 },
  }),
});

const body = await res.text();
if (!res.ok) {
  console.error(`FAIL HTTP ${res.status}`);
  console.error(body.slice(0, 600));
  process.exit(1);
}

const data = JSON.parse(body);
const text = String(
  data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') ?? ''
).trim();

console.log('OK model:', model);
console.log('OK provider: gemini');
console.log('OK response:', text || '(empty)');
