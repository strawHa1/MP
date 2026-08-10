/**
 * Shared Gemini client helpers for chat / reports / classification.
 *
 * Keeps model IDs, key masking, and error formatting in one place so a bad
 * model name or opaque SDK error cannot silently break the assistant again.
 */

import { GoogleGenAI } from '@google/genai';
import { getGeminiApiKey } from './envConfig.js';

/** Prefer current Flash models; walk the list if one ID is rejected by the API. */
export const GEMINI_CHAT_MODELS = [
  'gemini-3.5-flash',
  'gemini-3.6-flash',
  'gemini-3.1-flash-lite',
  'gemini-2.0-flash'
] as const;

export const GEMINI_DEFAULT_MODEL = GEMINI_CHAT_MODELS[0];

export function maskGeminiKey(key: string): string {
  if (key.length <= 8) return '***';
  return `${key.slice(0, 4)}...${key.slice(-4)}`;
}

export function createGeminiClient(): GoogleGenAI | null {
  const apiKey = getGeminiApiKey();
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build'
      }
    }
  });
}

/** Pull a human-readable reason out of the SDK / fetch error object. */
export function formatGeminiError(err: unknown): string {
  const e = err as any;
  const status =
    e?.status ??
    e?.statusCode ??
    e?.httpStatusCode ??
    e?.response?.status ??
    e?.error?.code;
  const message =
    e?.message ||
    e?.error?.message ||
    e?.statusText ||
    (typeof e === 'string' ? e : null) ||
    'Unknown Gemini error';

  const statusPart = status ? `${status} ` : '';
  // Trim huge stack dumps for the chat bubble while keeping enough for diagnosis.
  const short = String(message).replace(/\s+/g, ' ').trim().slice(0, 280);
  return `${statusPart}${short}`.trim();
}

export function logRawGeminiError(context: string, err: unknown): void {
  console.error(`[AI] ${context}:`, formatGeminiError(err));
  try {
    console.error(`[AI] ${context} raw:`, JSON.stringify(err, Object.getOwnPropertyNames(err as object), 2));
  } catch {
    console.error(`[AI] ${context} raw (non-serializable):`, err);
  }
}

/** Validate a key by probing each chat model until one succeeds. */
export async function validateGeminiKey(apiKey: string): Promise<string> {
  const testAi = new GoogleGenAI({
    apiKey,
    httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
  });
  let lastError: unknown = null;
  for (const model of GEMINI_CHAT_MODELS) {
    try {
      const test = await testAi.models.generateContent({
        model,
        contents: 'Reply with exactly: ok'
      });
      if ((test.text || '').trim()) return model;
      throw new Error('Empty test response');
    } catch (err) {
      lastError = err;
      logRawGeminiError(`validate key via ${model}`, err);
    }
  }
  throw lastError || new Error('All Gemini chat models failed validation');
}
