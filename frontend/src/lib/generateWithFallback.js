/**
 * generateWithFallback.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Centralised AI generation utility used by ALL frontend services:
 *   - AI Post Generator  (GeneratePanel)
 *   - Audience Targeting (AudienceTargetingPanel)
 *   - Campaign Ideation  (CampaignIdeationPanel)
 *   - Custom Flow        (CustomFlowPanel)
 *   - New Campaign       (QuickCampaignPanel)
 *
 * Flow:
 *   1. Try each Gemini model in cascade (primary → fallbacks), directly from browser.
 *      Each model gets up to 3 parse-retry attempts before moving to the next.
 *      On quota error (429), immediately moves to the next model.
 *   2. After ALL Gemini models fail → use domain-specific structured fallback content.
 *      Fallback content is polished, professional, and immediately usable.
 *      The UI renders seamlessly — no error messages shown to the user.
 *
 * GEMINI MODEL CASCADE (separate quota pools = more availability):
 *   gemini-2.5-flash  → gemini-2.0-flash → gemini-1.5-flash → gemini-1.5-flash-8b
 *
 * Team   : Subasri B | Gautham Krishnan K | Ashwin D | Vinjarapu Ajay Kumar
 * Company: Sourcesys Technologies
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { safeParseJSON } from './safeParseJSON'

// ── Gemini model cascade — each has its own free-tier quota pool ──────────────
const GEMINI_MODEL_CASCADE = [
  'gemini-2.5-flash',    // primary — highest quality
  'gemini-2.0-flash',    // fallback 1 — separate quota pool
  'gemini-1.5-flash',    // fallback 2 — older, very available
  'gemini-1.5-flash-8b', // fallback 3 — smallest, best availability
]

// ── Exponential backoff delays ────────────────────────────────────────────────
const BACKOFF_MS = [1000, 2000, 4000]  // attempt 1 → 1s, attempt 2 → 2s, attempt 3 → 4s

// ─── Single Gemini attempt on one specific model ──────────────────────────────
async function fetchGeminiOnce(modelName, prompt, schema, geminiConfig) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY
  if (!apiKey) throw new Error('VITE_GEMINI_API_KEY is not set in frontend/.env')

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`

  const genConfig = {
    temperature:      geminiConfig.temperature     ?? 1.0,
    maxOutputTokens:  geminiConfig.maxOutputTokens ?? 6000,
    responseMimeType: 'application/json',
    ...(schema ? { responseSchema: schema } : {}),
  }

  const res = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      contents:         [{ parts: [{ text: prompt }] }],
      generationConfig: genConfig,
    }),
  })

  if (!res.ok) {
    let errBody = {}
    try { errBody = await res.clone().json() } catch { /* ignore */ }

    const isQuota = res.status === 429
    const msg     = isQuota
      ? 'quota_exceeded'  // special sentinel — tells caller to skip to next model immediately
      : errBody?.error?.message || `Gemini API error (HTTP ${res.status})`
    throw new Error(msg)
  }

  const data = await res.json()
  if (data.error) throw new Error(data.error.message || 'Gemini API error.')

  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
  return safeParseJSON(raw)
}

// ─── Gemini cascade — tries each model with up to 3 parse retries ─────────────
// Max 3 attempts per model. Exponential backoff: 1s → 2s → 4s between retries.
// Moves to next model immediately on quota errors (429).
async function callGeminiCascade(prompt, schema, geminiConfig = {}, retryHooks = {}) {
  for (const modelName of GEMINI_MODEL_CASCADE) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      // Progressively stronger JSON enforcement on retry attempts
      const promptToUse = attempt === 1
        ? prompt
        : attempt === 2
          ? prompt + '\n\nCRITICAL: Respond with valid JSON only. No markdown. No explanation. Start with { end with }.'
          : prompt + '\n\nFINAL ATTEMPT: Return ONLY a valid JSON object. Nothing else. Start with { end with }.'

      try {
        const result = await fetchGeminiOnce(modelName, promptToUse, schema, geminiConfig)
        if (result) {
          if (modelName !== GEMINI_MODEL_CASCADE[0]) {
            console.log(`[Gemini] ✓ Succeeded with fallback model: ${modelName}`)
          }
          return result  // ✅ success
        }

        // result is null — unparseable response, retry same model with backoff
        if (attempt < 3) {
          console.warn(`[Gemini:${modelName}] Attempt ${attempt} returned unparseable JSON. Retrying in ${BACKOFF_MS[attempt - 1] / 1000}s...`)
          if (retryHooks.onRetry) retryHooks.onRetry(attempt, BACKOFF_MS[attempt - 1] / 1000)
          await new Promise(r => setTimeout(r, BACKOFF_MS[attempt - 1]))
        }
      } catch (err) {
        if (err.message === 'quota_exceeded') {
          console.warn(`[Gemini:${modelName}] Quota exceeded — trying next model.`)
          break  // skip remaining attempts on this model, move to next
        }

        // Transient errors (503, overloaded) — retry with backoff
        if (attempt < 3) {
          const waitMs = BACKOFF_MS[attempt - 1]
          console.warn(`[Gemini:${modelName}] Attempt ${attempt} error: ${err.message}. Retrying in ${waitMs / 1000}s...`)
          if (retryHooks.onRetry) retryHooks.onRetry(attempt, waitMs / 1000)
          await new Promise(r => setTimeout(r, waitMs))
        }
      }
    }
  }

  // All 4 models × 3 attempts exhausted
  return null
}

// ─── Main export ─────────────────────────────────────────────────────────────

/**
 * generateWithFallback
 *
 * Tries Gemini with full cascade + retry logic.
 * On complete failure, returns null so the caller can use its domain-specific
 * fallback content from fallbackService.js.
 *
 * NEVER throws — always returns null or a parsed result.
 * The caller is responsible for applying the domain fallback when null is returned.
 *
 * @param {string}   prompt
 * @param {object}   [schema]            – Gemini responseSchema (structured output)
 * @param {object}   [options]
 * @param {object}   [options.gemini]    – { model, temperature, maxOutputTokens }
 * @param {function} [options.onRetry]   – (attempt, waitSecs) => void — UI status update
 *
 * @returns {Promise<object|null>} parsed AI response, or null if all models failed
 */
export async function generateWithFallback(prompt, schema = null, options = {}) {
  const { gemini = {}, onRetry } = options

  try {
    const result = await callGeminiCascade(prompt, schema, gemini, { onRetry })
    if (result) return result

    // All models returned null (unparseable) — log and return null for fallback
    console.warn('[generateWithFallback] All Gemini models returned unparseable responses. Activating domain fallback.')
    return null
  } catch (err) {
    // Unexpected error in the cascade itself — log and return null for fallback
    console.warn('[generateWithFallback] Gemini cascade error:', err.message, '— Activating domain fallback.')
    return null
  }
}
