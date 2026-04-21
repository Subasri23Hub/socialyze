/**
 * safeParseJSON.js
 * ─────────────────────────────────────────────────────────────
 * NOTE: With responseMimeType:"application/json" set in all Gemini
 * API calls, Gemini returns guaranteed-valid JSON and this function
 * is only a thin safety wrapper for edge cases.
 *
 * Still handles:
 *   • Markdown fences in case an older model ignores the mime type
 *   • Leading/trailing prose around the JSON block
 *   • Trailing commas before } or ]
 *   • Literal newlines/tabs inside strings
 */
export function safeParseJSON(raw) {
  // 1. Strip markdown fences
  let text = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim()

  // 2. Extract outermost { … } block
  const s = text.indexOf('{')
  const e = text.lastIndexOf('}')
  if (s === -1 || e === -1 || e <= s) {
    throw new Error('No JSON object found in Gemini response.')
  }
  text = text.slice(s, e + 1)

  // 3. Remove trailing commas before } or ]
  text = text.replace(/,(\s*[}\]])/g, '$1')

  // 4. Escape raw control characters inside string values
  let clean = ''
  let inString = false
  let i = 0
  while (i < text.length) {
    const ch = text[i]
    if (inString) {
      if (ch === '\\') {
        clean += ch + (text[i + 1] || '')
        i += 2
        continue
      } else if (ch === '"') {
        inString = false
        clean += ch
      } else if (ch === '\n') { clean += '\\n'
      } else if (ch === '\r') { clean += '\\r'
      } else if (ch === '\t') { clean += '\\t'
      } else { clean += ch }
    } else {
      if (ch === '"') inString = true
      clean += ch
    }
    i++
  }

  return JSON.parse(clean)
}
