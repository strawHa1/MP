/**
 * Central resolution of the Gemini API key.
 *
 * Three modules need the key (server.ts, impactService.ts,
 * dashboardIntelligenceService.ts) and all three must agree on what counts as
 * "configured". In particular, the placeholder that ships in .env / .env.example
 * has to be treated as missing — otherwise the SDK is handed a bogus key and the
 * app fails with an opaque 400 instead of the friendly offline message.
 */

/** Placeholder values that appear in checked-in templates and are never real keys. */
const PLACEHOLDER_KEYS = new Set([
  'your_key_here',
  'your_gemini_api_key',
  'your_gemini_api_key_here',
  'my_gemini_api_key',
  'paste_your_key_here',
  'changeme',
  'todo'
]);

/** Returns the Gemini key, or null when it is absent, blank, or still a placeholder. */
export function getGeminiApiKey(): string | null {
  const raw = (process.env.GEMINI_API_KEY || '').trim().replace(/^["']|["']$/g, '').trim();
  if (!raw) return null;
  if (PLACEHOLDER_KEYS.has(raw.toLowerCase())) return null;
  return raw;
}

export function isGeminiConfigured(): boolean {
  return getGeminiApiKey() !== null;
}

/**
 * Prints an unmissable startup banner telling the developer exactly which file to
 * edit, since a blank key is the single most common reason the assistant appears
 * broken.
 */
export function logGeminiKeyStatus(envFilePath: string): void {
  if (isGeminiConfigured()) {
    console.log('[AI] GEMINI_API_KEY loaded — Black Swan AI Assistant is live (streaming enabled).');
    return;
  }

  console.warn(
    '\n' +
      '──────────────────────────────────────────────────────────────────────\n' +
      ' [AI] GEMINI_API_KEY is NOT set. Chat still answers from live platform\n' +
      '      data (portfolio, impact, country risk). Add a Gemini key for\n' +
      '      full LLM reasoning.\n' +
      '\n' +
      ` 1. Open:  ${envFilePath}\n` +
      ' 2. Set:   GEMINI_API_KEY=your_real_key\n' +
      ' 3. Get a free key at https://aistudio.google.com/apikey\n' +
      ' 4. Restart the server:  npm run dev\n' +
      '──────────────────────────────────────────────────────────────────────\n'
  );
}
