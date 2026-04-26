/**
 * Socialyze — Express API Server
 * =========================================================
 * REST API wrapping Groq for all campaign generation flows.
 * Single call to Groq — no retries. If Groq responds, we use it.
 * Fallback content is served ONLY if Groq genuinely fails (auth error,
 * network error, or truly unparseable response).
 *
 * Routes:
 *   GET  /health                — Health check
 *   POST /generate              — Multi-platform campaign generator
 *   POST /generate-post         — AI Post Generator card
 *   POST /audience-targeting    — Audience Targeting card
 *   POST /campaign-ideation     — Campaign Ideation card
 *   POST /custom-flow           — Custom Flow card
 *   POST /creator-studio        — Creator Studio editing guide
 *   POST /send-invite           — Send workspace share invite email
 *
 * LLM Provider: Groq (llama-3.1-8b-instant)
 * Fallback:     Domain-specific structured content (ONLY if Groq call fails)
 *
 * Team   : Subasri B | Gautham Krishnan K | Ashwin D | Vinjarapu Ajay Kumar
 * Company: Sourcesys Technologies
 */

const path    = require("path");
const express = require("express");
const cors    = require("cors");
require("dotenv").config();

const {
  GROQ_CONFIG,
  TEMPERATURE_PRESETS,
  getCampaignTypeGuidance,
  getToneVoice,
  getPlatformRules,
} = require("./config");

// ── Email service ──────────────────────────────────────────────────────────
const { sendShareInvite, verifyConnection } = require("./emailService");

// ── Route modules ──────────────────────────────────────────────────────────
const audienceTargetingRouter = require("./routes/audienceTargeting");
const campaignIdeationRouter  = require("./routes/campaignIdeation");
const customFlowRouter        = require("./routes/customFlow");
const creatorStudioRouter     = require("./routes/creatorStudio");

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ─────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "..", "public")));

// ─────────────────────────────────────────────────────────────────────────────
// Groq model configuration
// ─────────────────────────────────────────────────────────────────────────────
const GROQ_MODEL   = GROQ_CONFIG.modelName || "llama-3.1-8b-instant";
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

// ─────────────────────────────────────────────────────────────────────────────
// safeParseJSON — strips markdown fences and extracts the first JSON object
// ─────────────────────────────────────────────────────────────────────────────
function safeParseJSON(raw) {
  if (!raw) return null;
  let cleaned = raw
    .replace(/```json[\s\S]*?```/gi, m => m.replace(/```json|```/gi, ""))
    .replace(/```[\s\S]*?```/gi,    m => m.replace(/```/gi, ""))
    .trim();
  try { return JSON.parse(cleaned); } catch { /* fall through */ }
  const objMatch = cleaned.match(/\{[\s\S]*\}/);
  const arrMatch = cleaned.match(/\[[\s\S]*\]/);
  const match    = objMatch && arrMatch
    ? (cleaned.indexOf("{") < cleaned.indexOf("[") ? objMatch : arrMatch)
    : (objMatch || arrMatch);
  if (match) {
    try { return JSON.parse(match[0]); } catch { /* fall through */ }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// isPlaceholderResponse — detect if Groq echoed back our example skeleton
// instead of generating real content (e.g. ["v1","v2","v3"] or ["c1","c2","c3"])
// ─────────────────────────────────────────────────────────────────────────────
function isPlaceholderResponse(parsed) {
  if (!parsed || !Array.isArray(parsed.post_variations)) return false;
  const PLACEHOLDER_PATTERNS = /^(v\d+|c\d+|post \d+|caption \d+|variation \d+|placeholder|example|sample)$/i;
  return parsed.post_variations.some(v => PLACEHOLDER_PATTERNS.test(String(v).trim()));
}

// ─────────────────────────────────────────────────────────────────────────────
// callGroq — single Groq call, no retries.
// Returns parsed JSON object on success, or null on any failure.
// ─────────────────────────────────────────────────────────────────────────────
async function callGroq(prompt, opts = {}) {
  const apiKey = process.env.GROQ_API_KEY || "";
  if (!apiKey) {
    console.error("[Groq] ❌ No API key found. Set GROQ_API_KEY in backend/.env");
    return null;
  }

  const temperature     = opts.temperature ?? GROQ_CONFIG.temperature;
  const maxOutputTokens = opts.maxTokens   ?? GROQ_CONFIG.maxOutputTokens;

  console.log(`[Groq] → Calling model: ${GROQ_MODEL}`);

  try {
    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(GROQ_API_URL, {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model:       GROQ_MODEL,
        temperature,
        max_tokens:  maxOutputTokens,
        top_p:       GROQ_CONFIG.topP,
        messages:    [{ role: "user", content: prompt }],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      let errBody = "";
      try { errBody = await response.text(); } catch { /* ignore */ }
      console.error(`[Groq] ❌ HTTP ${response.status}: ${errBody.slice(0, 300)}`);
      return null;
    }

    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content || null;

    if (!text) {
      console.error("[Groq] ❌ Empty content in response.");
      return null;
    }

    console.log("[Groq] ✅ Got response, parsing JSON...");
    const parsed = safeParseJSON(text);

    if (!parsed) {
      console.error("[Groq] ❌ Response was not valid JSON. Raw (first 300 chars):", text.slice(0, 300));
      return null;
    }

    console.log("[Groq] ✅ Parsed successfully.");
    return parsed;

  } catch (err) {
    if (err.name === "AbortError") {
      console.error("[Groq] ❌ Request timed out after 30s.");
    } else {
      console.error("[Groq] ❌ Fetch error:", err.message);
    }
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// callGroqText — single Groq call returning raw text (for legacy route usage).
// Returns string on success, or null on failure.
// ─────────────────────────────────────────────────────────────────────────────
async function callGroqText(prompt, opts = {}) {
  const apiKey = process.env.GROQ_API_KEY || "";
  if (!apiKey) {
    console.error("[Groq] ❌ No API key found.");
    return null;
  }

  const temperature     = opts.temperature ?? GROQ_CONFIG.temperature;
  const maxOutputTokens = opts.maxTokens   ?? GROQ_CONFIG.maxOutputTokens;

  try {
    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(GROQ_API_URL, {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model:       GROQ_MODEL,
        temperature,
        max_tokens:  maxOutputTokens,
        top_p:       GROQ_CONFIG.topP,
        messages:    [{ role: "user", content: prompt }],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      let errBody = "";
      try { errBody = await response.text(); } catch { /* ignore */ }
      console.error(`[Groq/text] ❌ HTTP ${response.status}: ${errBody.slice(0, 300)}`);
      return null;
    }

    const data = await response.json();
    return data?.choices?.[0]?.message?.content || null;

  } catch (err) {
    console.error("[Groq/text] ❌ Fetch error:", err.message);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// generateWithFallback — main AI function injected into all routes.
// Alias for callGroq. Returns parsed JSON or null.
// ─────────────────────────────────────────────────────────────────────────────
async function generateWithFallback(prompt, opts = {}) {
  return await callGroq(prompt, opts);
}

// ── Inject Groq helpers into every request via res.locals ─────────────────
app.use((req, res, next) => {
  // Primary helpers — used by all route modules
  res.locals.callGroqJSON         = (prompt, opts) => callGroq(prompt, opts);
  res.locals.callGroqText         = (prompt, opts) => callGroqText(prompt, opts);
  res.locals.generateWithFallback = generateWithFallback;
  // Backward-compat aliases so any remaining legacy references still resolve
  res.locals.callGeminiJSON       = res.locals.callGroqJSON;
  res.locals.callGemini           = res.locals.callGroqText;
  next();
});

// ── Static fallback builders ───────────────────────────────────────────────
const FALLBACK_POSTS = {
  instagram: (name, goal) => `✨ ${name}\n\n${goal}.\n\nTap the link in bio to find out more. 👇\n\n#NewArrival #MustHave #${name.replace(/\s+/g, "")}`,
  twitter:   (name, goal) => `Just dropped: ${name}. ${goal}. Don't sleep on this. 👀 #NewProduct #${name.replace(/\s+/g, "")}`,
  linkedin:  (name, goal) => `Introducing ${name}.\n\n${goal}.\n\nWould love your thoughts — have you faced this problem before?\n\n#Innovation #${name.replace(/\s+/g, "")}`,
  facebook:  (name, goal) => `Big news! 🎉 ${name} is here. ${goal}. Drop a 🙋 if you want to know more!`,
  tiktok:    (name, goal) => `POV: You just discovered ${name} and your life is about to change 👀 ${goal} #FYP #${name.replace(/\s+/g, "")}`,
};

function buildFallbackHashtags(platform, campaignType, keywords = []) {
  const base = {
    "product launch":    ["#NewArrival", "#ProductLaunch", "#JustLaunched"],
    "brand awareness":   ["#BrandLove", "#BrandBuilding", "#StoryTime"],
    "lead generation":   ["#BusinessGrowth", "#LeadGen", "#GrowYourBusiness"],
    "engagement boost":  ["#Community", "#JoinTheConvo", "#EngageWithUs"],
    "content promotion": ["#ContentMarketing", "#StoryTelling", "#CreativeContent"],
  };
  const platformTags = {
    instagram: ["#InstagramMarketing", "#InstaGood"],
    twitter:   ["#TwitterMarketing", "#Trending"],
    linkedin:  ["#LinkedInMarketing", "#B2B"],
    tiktok:    ["#FYP", "#TikTokMarketing"],
    facebook:  ["#FacebookMarketing", "#SocialMedia"],
  };
  const tags = [
    ...(base[(campaignType || "").toLowerCase()] || []),
    ...(platformTags[(platform || "").toLowerCase()] || []),
    ...keywords.slice(0, 3).map(k => `#${String(k).replace(/\s+/g, "")}`),
  ];
  return [...new Set(tags)].slice(0, 10);
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /health
// ─────────────────────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  const apiKey = process.env.GROQ_API_KEY || "";
  res.json({
    status:       "healthy",
    timestamp:    new Date().toISOString(),
    llmProvider:  "Groq",
    groqModel:    GROQ_MODEL,
    apiKeyLoaded: !!apiKey,
    retries:      "none — single call per request",
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /send-invite
// ─────────────────────────────────────────────────────────────────────────────
app.post("/send-invite", async (req, res) => {
  const { toEmail, ownerEmail, campaignName, permission = "view" } = req.body;
  if (!toEmail || !ownerEmail || !campaignName) {
    return res.status(400).json({ error: "toEmail, ownerEmail, and campaignName are required." });
  }
  const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRx.test(toEmail)) return res.status(400).json({ error: "Invalid toEmail address." });
  if (!["view", "edit"].includes(permission)) {
    return res.status(400).json({ error: "permission must be 'view' or 'edit'." });
  }

  const { success, error } = await sendShareInvite({
    toEmail, ownerEmail, campaignName, permission,
    appUrl: process.env.APP_URL || "http://localhost:5173",
  });

  if (!success) {
    console.error("[/send-invite] Email failed:", error);
    return res.status(500).json({ error: "Failed to send invite email.", detail: error });
  }
  return res.json({ success: true, message: `Invite sent to ${toEmail}` });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /generate — Multi-platform campaign generator
// ─────────────────────────────────────────────────────────────────────────────
app.post("/generate", async (req, res) => {
  try {
    const {
      campaign_name, campaign_type = "product launch", target_audience = "general audience",
      campaign_goal, tone = "professional", platforms = [],
      include_hashtags = true, custom_hashtags = [],
    } = req.body;

    if (!campaign_name || !campaign_goal || !platforms.length) {
      return res.status(400).json({ error: "campaign_name, campaign_goal and platforms are required." });
    }

    const platformList  = platforms.join(", ");
    const toneVoice     = getToneVoice(tone);
    const campaignGuide = getCampaignTypeGuidance(campaign_type);

    // Compact per-platform schema
    const platformSchema = platforms
      .map(p => `"${p.toLowerCase()}": { "post": "platform-native post copy", "caption": "1-2 line caption" }`)
      .join(",\n  ");

    const prompt = `Social media strategist. Write native posts for each platform.

Brand: ${campaign_name} | Type: ${campaign_type} | Goal: ${campaign_goal}
Audience: ${target_audience} | Tone: ${tone} (${toneVoice}) | Platforms: ${platformList}
Strategy: ${campaignGuide}

For EACH platform: a full native post and a 1-2 line caption. No "Introducing". No corporate speak.

Return ONLY valid JSON. Start { end }.
{ ${platformSchema} }`;

    const aiData   = await generateWithFallback(prompt, { temperature: TEMPERATURE_PRESETS.creative, maxTokens: 800 });
    const result   = {};
    const keywords = [campaign_name, target_audience, campaign_type].filter(Boolean);

    for (const platform of platforms) {
      const pLower = platform.toLowerCase();
      const pData  = aiData?.[pLower] || {};
      result[pLower] = {
        post:     pData.post    || FALLBACK_POSTS[pLower]?.(campaign_name, campaign_goal) || `${campaign_name}: ${campaign_goal}`,
        caption:  pData.caption || `${campaign_name} — ${campaign_goal}`,
        hashtags: include_hashtags
          ? buildFallbackHashtags(platform, campaign_type, [...keywords, ...custom_hashtags])
          : [],
      };
    }
    return res.json(result);
  } catch (err) {
    console.error("[/generate] Error:", err);
    return res.status(500).json({ error: "Content generation failed." });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /generate-post — AI Post Generator card
// ─────────────────────────────────────────────────────────────────────────────
app.post("/generate-post", async (req, res) => {
  try {
    const {
      brand_name, campaign_goal, product_or_service,
      target_audience, key_message, call_to_action,
      tone = "professional", platform = "Instagram",
    } = req.body;

    const missing = ["brand_name", "campaign_goal", "product_or_service", "target_audience", "key_message", "call_to_action"]
      .filter(f => !req.body[f] || String(req.body[f]).trim() === "");
    if (missing.length) {
      return res.status(400).json({ error: `Missing required fields: ${missing.join(", ")}` });
    }

    const toneVoice = getToneVoice(tone);
    const brandTag  = `#${brand_name.replace(/\s+/g, "")}`;
    const prodTag   = `#${product_or_service.replace(/\s+/g, "")}`;

    // FIX: Prompt uses NO example placeholder values (no "v1","v2","v3","c1" etc.)
    // Groq was previously echoing those back verbatim instead of generating real content.
    // IMPORTANT: hook must be SHORT (≤10 words). caption is the full post body EXCLUDING the hook.
    const prompt = `You are a social media Creative Director. Write real, publish-ready content. No placeholders. No template labels.

Brand: ${brand_name}
Product/Service: ${product_or_service}
Campaign Goal: ${campaign_goal}
Target Audience: ${target_audience}
Tone: ${tone} — ${toneVoice}
Key Message: ${key_message}
Call To Action: ${call_to_action}
Platform: ${platform}

Write exactly 3 full, publish-ready post variations for ${platform}. Each post must:
- Have a SHORT hook (5-10 words max) that grabs attention in the feed — this is a headline, NOT a paragraph
- Have a separate full caption (2-4 sentences) that expands on the hook, references ${product_or_service} specifically, and ends with: ${call_to_action}
- Sound like a real person, not a marketing bot
- Use ${platform}-native language and energy

Also write:
- 3 short captions (1-2 lines each, punchy, platform-native)
- 10 relevant hashtags starting with # (mix of brand, niche, trending)
- 1 strong CTA line

CRITICAL: post_variations must each be the FULL post text (hook + body combined).
hook_variations must each be ONLY the short hook line (5-10 words, no period at end unless it's a question).

Return ONLY a valid JSON object. No explanation before or after.
{
  "post_variations": ["<full post 1 — hook line then newline then body>", "<full post 2>", "<full post 3>"],
  "hook_variations": ["<short hook 1 — 5-10 words>", "<short hook 2>", "<short hook 3>"],
  "caption_variations": ["<caption 1>", "<caption 2>", "<caption 3>"],
  "hashtags": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5", "#tag6", "#tag7", "#tag8", "#tag9", "#tag10"],
  "cta": "<strong CTA line>"
}`;

    let parsed = await generateWithFallback(prompt, { temperature: TEMPERATURE_PRESETS.creative, maxTokens: 1200 });

    // FIX: Detect if Groq echoed placeholder values and treat it as a failed response
    if (parsed && isPlaceholderResponse(parsed)) {
      console.warn("[/generate-post] Groq returned placeholder values — falling back.");
      parsed = null;
    }

    if (!parsed) {
      console.warn("[/generate-post] Groq returned null/placeholder. Serving domain fallback.");
      return res.json({
        post_variations: [
          `Nobody talks about this, but ${key_message}. 👀\n\n${brand_name}'s ${product_or_service} was built for exactly that.\n\n${call_to_action} — link in bio.`,
          `POV: You just discovered ${product_or_service} and realised you've been doing it the hard way.\n\n${key_message}.\n\n${call_to_action} 👇`,
          `Real talk for ${target_audience}:\n\n${key_message}.\n\n${brand_name} built ${product_or_service} to change that.\n\n${call_to_action}.`,
        ],
        caption_variations: [
          `${key_message}. ${call_to_action} 👇`,
          `Built for ${target_audience}. ${product_or_service} by ${brand_name}.`,
          `Stop scrolling. ${key_message}. ${call_to_action}.`,
        ],
        hashtags: [brandTag, prodTag, "#SocialMedia", "#Marketing", "#TrendingNow", "#ContentMarketing", "#DigitalMarketing", `#${target_audience.replace(/\s+/g, "")}`, "#RelatableContent", "#MustSee"].slice(0, 10),
        cta: call_to_action,
      });
    }

    return res.json({
      post_variations:    (parsed.post_variations    || []).slice(0, 3).map(String),
      hook_variations:    (parsed.hook_variations    || []).slice(0, 3).map(String),
      caption_variations: (parsed.caption_variations || []).slice(0, 3).map(String),
      hashtags:           (parsed.hashtags           || []).slice(0, 10).map(String),
      cta:                String(parsed.cta          || call_to_action),
    });
  } catch (err) {
    console.error("[/generate-post] Error:", err);
    return res.status(500).json({ error: "AI Post generation failed. Please try again." });
  }
});

// ── Card-specific route modules ────────────────────────────────────────────
app.use("/audience-targeting", audienceTargetingRouter);
app.use("/campaign-ideation",  campaignIdeationRouter);
app.use("/custom-flow",        customFlowRouter);
app.use("/creator-studio",     creatorStudioRouter);

/** Serve frontend SPA */
app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

// ── Start ──────────────────────────────────────────────────────────────────
app.listen(PORT, async () => {
  const apiKey = process.env.GROQ_API_KEY || "";

  console.log(`\n✅  Socialyze API running on http://localhost:${PORT}`);
  console.log(`   GET  /health               — Health check`);
  console.log(`   POST /generate             — Multi-platform campaign generator`);
  console.log(`   POST /generate-post        — AI Post Generator card`);
  console.log(`   POST /audience-targeting   — Audience Targeting card`);
  console.log(`   POST /campaign-ideation    — Campaign Ideation card`);
  console.log(`   POST /custom-flow          — Custom Flow card`);
  console.log(`   POST /creator-studio       — Creator Studio editing guide`);
  console.log(`   POST /send-invite          — Workspace share invite email`);
  console.log(`\n   🔑  API key loaded: ${apiKey ? `YES (ends in ...${apiKey.slice(-4)})` : "❌ NO — set GROQ_API_KEY in backend/.env"}`);
  console.log(`   🤖  Model: ${GROQ_MODEL}`);
  console.log(`   ⚡  Mode: single call per request — no retries`);

  await verifyConnection();
});

module.exports = app;
