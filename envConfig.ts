/**
 * Central resolution of the Gemini API key.
 *
 * Three modules need the key (server.ts, impactService.ts,
 * dashboardIntelligenceService.ts) and all three must agree on what counts as
 * "configured". In particular, the placeholder that ships in .env / .env.example
 * has to be treated as missing — otherwise the SDK is handed a bogus key and the
 * app fails with an opaque 400 instead of the friendly offline message.
 */

import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

/** Placeholder values that appear in checked-in templates and are never real keys. */
const PLACEHOLDER_KEYS = new Set([
  'your_key_here',
  'your_gemini_api_key',
  'your_gemini_api_key_here',
  'my_gemini_api_key',
  'paste_your_key_here',
  'changeme',
  'todo',
  'xxx',
  'replace_me'
]);

/** Strip quotes / zero-width / BOM junk that editors sometimes leave in .env values. */
export function sanitizeEnvValue(raw: string | undefined | null): string {
  return String(raw || '')
    .replace(/^\uFEFF/, '')
    .trim()
    .replace(/^["']|["']$/g, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim();
}

/** In-memory override set via POST /api/chat/configure-key (survives until server restart). */
let runtimeGeminiKey: string | null = null;

export function setRuntimeGeminiKey(key: string | null): void {
  runtimeGeminiKey = key ? sanitizeEnvValue(key) : null;
  if (runtimeGeminiKey) {
    process.env.GEMINI_API_KEY = runtimeGeminiKey;
  }
}

export function getGeminiKeySource(): 'runtime' | 'env' | null {
  if (runtimeGeminiKey && !PLACEHOLDER_KEYS.has(runtimeGeminiKey.toLowerCase())) {
    return 'runtime';
  }
  const raw = sanitizeEnvValue(process.env.GEMINI_API_KEY);
  if (raw && !PLACEHOLDER_KEYS.has(raw.toLowerCase())) return 'env';
  return null;
}

/**
 * Returns the Gemini key, or null when it is absent, blank, or still a placeholder.
 * Runtime override (from the configure-key UI) takes precedence over .env.
 */
export function getGeminiApiKey(): string | null {
  const runtime = sanitizeEnvValue(runtimeGeminiKey || '');
  if (runtime && !PLACEHOLDER_KEYS.has(runtime.toLowerCase())) return runtime;

  const raw = sanitizeEnvValue(
    process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENAI_API_KEY
  );
  if (!raw) return null;
  if (PLACEHOLDER_KEYS.has(raw.toLowerCase())) return null;
  return raw;
}

export function isGeminiConfigured(): boolean {
  return getGeminiApiKey() !== null;
}

/** Masked preview for logs — never print the full secret. */
export function maskGeminiApiKey(key: string): string {
  if (!key) return '(empty)';
  if (key.length <= 8) return `${key.slice(0, 2)}…(len ${key.length})`;
  return `${key.slice(0, 4)}...${key.slice(-4)} (len ${key.length})`;
}

/**
 * Load env files that actually exist. Missing `.env.local` must not abort loading
 * `.env` (dotenv v17 errors when a listed path is absent).
 *
 * Order: `.env` first, then `.env.local` with override — so a local override wins
 * when present, matching common Vite/Next conventions.
 */
export function loadProjectEnv(cwd = process.cwd()): { loaded: string[]; errors: string[] } {
  const candidates = ['.env', '.env.local'];
  const loaded: string[] = [];
  const errors: string[] = [];

  for (const name of candidates) {
    const full = path.join(cwd, name);
    if (!fs.existsSync(full)) continue;
    // `.env` supplies defaults only — do not clobber a real key already present in
    // the shell / CI environment. `.env.local` may override everything (local dev).
    const result = dotenv.config({ path: full, override: name === '.env.local' });
    if (result.error) {
      errors.push(`${name}: ${result.error.message}`);
    } else {
      loaded.push(full);
    }
  }

  return { loaded, errors };
}

/**
 * Prints an unmissable startup banner with a MASKED process.env.GEMINI_API_KEY so
 * you can confirm the server actually read what you put in `.env`.
 */
export function logGeminiKeyStatus(envFilePath: string): void {
  const rawFromEnv = sanitizeEnvValue(process.env.GEMINI_API_KEY);
  const key = getGeminiApiKey();

  console.log(`[AI] process.env.GEMINI_API_KEY (masked) = ${maskGeminiApiKey(rawFromEnv)}`);

  if (key) {
    console.log(
      `[AI] Gemini key accepted — Black Swan AI Assistant is live (streaming enabled).`
    );
    return;
  }

  let reason = 'undefined / empty';
  if (rawFromEnv) {
    reason = PLACEHOLDER_KEYS.has(rawFromEnv.toLowerCase())
      ? `still a placeholder ("${rawFromEnv}")`
      : 'present but rejected by sanitizer';
  }

  console.warn(
    '\n' +
      '──────────────────────────────────────────────────────────────────────\n' +
      ` [AI] GEMINI_API_KEY is NOT usable (${reason}).\n` +
      '      Chat Q&A requires a real key from https://aistudio.google.com/apikey\n' +
      '      Trade / alert commands still work without it.\n' +
      '\n' +
      ` 1. Edit:  ${envFilePath}\n` +
      ' 2. Set:   GEMINI_API_KEY=AIzaSy...\n' +
      '    (no spaces; quotes optional; do NOT leave your_key_here)\n' +
      ' 3. Save the file, then fully restart:  npm run dev:clean\n' +
      '──────────────────────────────────────────────────────────────────────\n'
  );
}

/** Write or replace GEMINI_API_KEY in the project .env file (local dev only). */
export function persistGeminiKeyToEnv(key: string, envFilePath: string): void {
  const sanitized = sanitizeEnvValue(key);
  if (!sanitized || PLACEHOLDER_KEYS.has(sanitized.toLowerCase())) {
    throw new Error('Refusing to persist an empty or placeholder key');
  }

  let contents = '';
  if (fs.existsSync(envFilePath)) {
    contents = fs.readFileSync(envFilePath, 'utf8').replace(/^\uFEFF/, '');
  }

  const newLine = `GEMINI_API_KEY="${sanitized}"`;
  if (/^\s*GEMINI_API_KEY\s*=.*$/m.test(contents)) {
    contents = contents.replace(/^\s*GEMINI_API_KEY\s*=.*$/m, newLine);
  } else {
    contents = contents.trimEnd() + (contents.endsWith('\n') ? '' : '\n') + `\n${newLine}\n`;
  }

  fs.writeFileSync(envFilePath, contents, 'utf8');
  process.env.GEMINI_API_KEY = sanitized;
  setRuntimeGeminiKey(sanitized);
  console.log(`[AI] GEMINI_API_KEY saved to ${envFilePath} (${maskGeminiApiKey(sanitized)})`);
}
