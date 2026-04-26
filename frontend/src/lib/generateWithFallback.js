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
 *   1. Single Groq call (llama-3.1-8b-instant) — no retries, no cascades.
 *   2. If Groq responds with valid JSON → return it. Done.
 *   3. If Groq fails (network error, bad key, unparseable) → return null.
 *      The calling service then applies its own domain-specific fallback.
 *
 * GROQ MODEL : llama-3.1-8b-instant
 * GROQ API   : https://api.groq.com/openai/v1/chat/completions
 *
 * Team   : Subasri B | Gautham Krishnan K | Ashwin D | Vinjarapu Ajay Kumar
 * Company: Sourcesys Technologies
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { safeParseJSON } from './safeParseJSON'

const GROQ_MODEL   = 'llama-3.1-8b-instant'
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'

// ─────────────────────────────────────────────────────────────────────────────
// generateWithFallback — single Groq call, no retries.
// Returns parsed JSON object on success, null on any failure.
// NEVER throws — always returns null on error so callers can use their fallback.
//
// @param {string}   prompt
// @param {object}   [schema]     – unused, kept for call-site compatibility
// @param {object}   [options]
// @param {object}   [options.groq]   – { temperature, maxOutputTokens }
// @param {object}   [options.gemini] – legacy alias for groq (ignored, kept for compat)
//
// @returns {Promise<object|null>}
// ─────────────────────────────────────────────────────────────────────────────
export async function generateWithFallback(prompt, schema = null, options = {}) {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY
  if (!apiKey) {
    console.warn('[Groq] VITE_GROQ_API_KEY is not configured — using offline fallback.')
    return null
  }

  const groqConfig      = options.groq || options.gemini || {}
  const temperature     = groqConfig.temperature     ?? 1.0
  const maxOutputTokens = groqConfig.maxOutputTokens ?? 1200

  console.log(`[Groq] → Calling ${GROQ_MODEL}...`)

  try {
    const res = await fetch(GROQ_API_URL, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model:       GROQ_MODEL,
        temperature,
        max_tokens:  maxOutputTokens,
        top_p:       0.95,
        messages:    [{ role: 'user', content: prompt }],
      }),
    })

    if (!res.ok) {
      let errBody = ''
      try { errBody = await res.text() } catch { /* ignore */ }
      console.warn(`[Groq] HTTP ${res.status} — using offline fallback. Detail: ${errBody.slice(0, 200)}`)
      return null
    }

    const data = await res.json()
    const raw  = data?.choices?.[0]?.message?.content || ''

    if (!raw) {
      console.warn('[Groq] Empty content in response — using offline fallback.')
      return null
    }

    console.log('[Groq] ✅ Got response, parsing JSON...')
    const parsed = safeParseJSON(raw)

    if (!parsed) {
      console.warn('[Groq] Response was not valid JSON — using offline fallback.')
      return null
    }

    console.log('[Groq] ✅ Parsed successfully.')
    return parsed

  } catch (err) {
    console.warn('[Groq] Network error — using offline fallback.', err.message)
    return null
  }
}
