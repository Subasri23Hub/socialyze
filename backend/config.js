/**
 * AI Social Media Campaign Generator — Backend Configuration
 * ===========================================================
 * Groq model parameters and platform/tone/campaign-type
 * prompt-engineering helpers.
 */

require("dotenv").config();

// ── Groq model configuration ────────────────────────────────────────
const GROQ_CONFIG = {
  modelName:        process.env.GROQ_MODEL           || "llama-3.1-8b-instant",
  temperature:      parseFloat(process.env.GROQ_TEMPERATURE)            || 0.9,
  topP:             parseFloat(process.env.GROQ_TOP_P)                  || 0.95,
  maxOutputTokens:  parseInt(process.env.GROQ_MAX_OUTPUT_TOKENS)        || 1200,
};

// ── Per-task temperature presets ────────────────────────────────────
// High temperature → creative / copy tasks
// Medium temperature → structured / strategic tasks
const TEMPERATURE_PRESETS = {
  creative:    1.0,   // post generation, ideation
  strategic:   0.75,  // audience targeting, custom flow strategy
  structured:  0.65,  // posting plans, hashtag lists
};

// ── Platform-native writing rules injected into prompts ────────────
const PLATFORM_RULES = {
  Instagram: "Reels-first. Hook in line 1. Line breaks after every 1-2 sentences. Emojis used intentionally (not spam). 3–5 hashtags max in caption. Save-worthy carousel content. Best time: Tue–Fri 7–9am and 6–9pm IST.",
  Twitter:   "Punchy. Under 280 chars per tweet. Thread potential. Wit > polish. NO corporate speak. 1–2 hashtags inline only. Reply-bait questions work. Hooks must be opinionated or counterintuitive.",
  LinkedIn:  "Thought-leadership angle. Personal story hooks outperform brand speak 10x. Use line breaks every 1-2 lines for readability. Data-backed claims. 3 hashtags MAX. No emoji spam. End with a genuine question.",
  Facebook:  "Community-first framing. Longer storytelling format works. Shareable emotional angles. Tag-a-friend prompts. 2–3 hashtags. Native video outperforms links.",
  TikTok:    "Hook in first 2 seconds — POV, 'nobody talks about this', 'wait for it'. Conversational, raw, native-feeling. Trending audio references. Challenge or duet potential. UGC energy.",
  YouTube:   "Strong hook in first 30s. Title = 90% of clicks. Description SEO. Timestamps for retention. End-screen CTAs. Storytelling arc matters.",
};

// ── Tone voice guides ───────────────────────────────────────────────
const TONE_VOICE = {
  casual:        "Relaxed, like texting a friend. Short sentences. Contractions. Relatable.",
  professional:  "Authoritative but approachable. Precise language. No fluff.",
  inspirational: "Aspirational and uplifting. Speaks to identity, not features.",
  humorous:      "Witty, self-aware, playful. Never try-hard. Timing matters.",
  urgent:        "Direct, action-driving. Every word earns its place. Urgency without panic.",
  bold:          "Confident, punchy, zero apology. Short declarations. Polarising is fine.",
  empathetic:    "Warm, understanding, human-first. Acknowledges struggles before selling.",
  witty:         "Clever wordplay, cultural references, unexpected angles. Smart not silly.",
  provocative:   "Challenges assumptions. Opens with a counterintuitive take. Makes people stop.",
};

// ── Campaign type strategic guidance ───────────────────────────────
const CAMPAIGN_GUIDANCE = {
  "product launch":    "Lead with the problem it solves, not the product. Show transformation, not features.",
  "brand awareness":   "Build emotional memory. Story > specs. Make them feel something, then remember you.",
  "lead generation":   "Value-first. What do they get before they give anything? Reverse the ask.",
  "engagement boost":  "Ask questions, run polls, create debate. Participation > reach.",
  "content promotion": "Tease, don't tell. Give a taste that creates desire for the full thing.",
  "seasonal sale":     "Time-pressure + exclusivity + emotional resonance with the season.",
  "event promotion":   "FOMO mechanics. Behind-the-scenes access. Community identity.",
  "rebranding":        "Honour the past, excite about the future. Address the 'why' first.",
};

// ── Exports ────────────────────────────────────────────────────────
module.exports = {
  GROQ_CONFIG,
  // Legacy alias so any code that imports GROK_CONFIG still works
  GROK_CONFIG: GROQ_CONFIG,
  TEMPERATURE_PRESETS,

  /**
   * Get platform-native writing rules for injection into prompts.
   * @param {string[]} platforms
   * @returns {string}
   */
  getPlatformRules(platforms) {
    return (Array.isArray(platforms) ? platforms : [platforms])
      .map(p => {
        const key = p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
        const rule = PLATFORM_RULES[key] || PLATFORM_RULES[p] || `Write natively for ${p}.`;
        return `${p}: ${rule}`;
      })
      .join("\n");
  },

  /**
   * Get tone voice guide for injection into prompts.
   * @param {string} tone
   * @returns {string}
   */
  getToneVoice(tone) {
    return TONE_VOICE[(tone || "").toLowerCase()] || "Match tone to audience and context.";
  },

  /**
   * Get campaign type strategic guidance.
   * @param {string} campaignType
   * @returns {string}
   */
  getCampaignTypeGuidance(campaignType) {
    return CAMPAIGN_GUIDANCE[(campaignType || "").toLowerCase()] || "Clear messaging. Audience-first.";
  },

  // Legacy aliases — keep for server.js compatibility
  getToneModifier(tone) { return TONE_VOICE[(tone || "").toLowerCase()] || ""; },
  getPlatformTemplate() { return ""; },
};
