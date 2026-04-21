/**
 * Socialyze — Express API Server
 * =========================================================
 * REST API wrapping Google Gemini for all campaign generation flows.
 * Uses a multi-model Gemini cascade with 3 retry attempts per model.
 * After all Gemini models exhaust retries, domain-specific structured
 * fallback content is returned — the UI always receives usable data.
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
 * LLM Provider: Google Gemini (sole provider)
 * Fallback:     Domain-specific structured content (never fails the user)
 *
 * Team   : Subasri B | Gautham Krishnan K | Ashwin D | Vinjarapu Ajay Kumar
 * Company: Sourcesys Technologies
 */

const path    = require("path");
const express = require("express");
const cors    = require("cors");
require("dotenv").config();

const {
  GEMINI_CONFIG,
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

// ── Lazy-load Gemini SDK ───────────────────────────────────────────────────
let GoogleGenerativeAI;
try {
  ({ GoogleGenerativeAI } = require("@google/generative-ai"));
} catch {
  console.warn("⚠️  @google/generative-ai not installed. Run: npm install @google/generative-ai");
}

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ─────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "..", "public")));

// ─────────────────────────────────────────────────────────────────────────────
// Gemini model cascade
// When the primary model (gemini-2.5-flash) hits quota, we automatically
// try the next model. Free-tier quotas are per-model so each has its own pool.
// ─────────────────────────────────────────────────────────────────────────────
const GEMINI_MODEL_CASCADE = [
  GEMINI_CONFIG.modelName || "gemini-2.5-flash",  // primary — highest quality
  "gemini-2.0-flash",                              // fallback 1 — separate quota pool
  "gemini-1.5-flash",                              // fallback 2 — older, very available
  "gemini-1.5-flash-8b",                           // fallback 3 — smallest, best availability
];

// Exponential backoff delays in ms: attempt 1 → 1s, attempt 2 → 2s, attempt 3 → 4s
const BACKOFF_MS = [1000, 2000, 4000];

/**
 * Safely parse JSON from AI response text.
 * Handles markdown fences, leading/trailing prose, and partial matches.
 */
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
// callGeminiWithModel
// Single attempt on a specific Gemini model.
// Returns raw text string, or null on quota/error.
// ─────────────────────────────────────────────────────────────────────────────
async function callGeminiWithModel(modelName, prompt, opts = {}) {
  if (!GoogleGenerativeAI) return null;

  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";
  if (!apiKey) return null;

  const geminiClient    = new GoogleGenerativeAI(apiKey);
  const temperature     = opts.temperature ?? GEMINI_CONFIG.temperature;
  const maxOutputTokens = opts.maxTokens   ?? GEMINI_CONFIG.maxOutputTokens;

  const modelConfig = {
    contents:         [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature,
      topK:            GEMINI_CONFIG.topK,
      topP:            GEMINI_CONFIG.topP,
      maxOutputTokens,
    },
    safetySettings: GEMINI_CONFIG.safetySettings,
  };

  try {
    const model    = geminiClient.getGenerativeModel({ model: modelName });
    const response = await model.generateContent(modelConfig);
    return response.response.text();
  } catch (err) {
    const isQuota = err.message && (
      err.message.includes("429") ||
      err.message.includes("quota") ||
      err.message.includes("Too Many Requests")
    );
    if (isQuota) {
      console.warn(`[Gemini:${modelName}] Quota exceeded — will try next model.`);
    } else {
      console.error(`[Gemini:${modelName}] API error:`, err.message.slice(0, 120));
    }
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// callGeminiJSON
// Tries EACH model in cascade with up to 3 parse-retry attempts.
// Exponential backoff between retries: 1s → 2s → 4s.
// Returns parsed JSON or null if all models fail.
// ─────────────────────────────────────────────────────────────────────────────
async function callGeminiJSON(prompt, opts = {}) {
  for (const modelName of GEMINI_MODEL_CASCADE) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      const promptToUse = attempt === 1
        ? prompt
        : attempt === 2
          ? prompt + "\n\nCRITICAL: Your previous response was not valid JSON. Return ONLY the raw JSON object with no explanation, no markdown, no code fences. Start your response with { and end with }."
          : prompt + "\n\nFINAL ATTEMPT: Return ONLY a valid JSON object. No text before or after. No markdown. No code fences. Start with { and end with }. Nothing else.";

      const raw    = await callGeminiWithModel(modelName, promptToUse, opts);
      const parsed = safeParseJSON(raw);

      if (parsed) {
        if (modelName !== GEMINI_MODEL_CASCADE[0]) {
          console.log(`[Gemini] ✓ Succeeded with fallback model: ${modelName}`);
        }
        return parsed;
      }

      // null raw = quota/error — skip remaining attempts on this model
      if (!raw) break;

      // non-null but unparseable — retry with backoff
      if (attempt < 3) {
        const waitMs = BACKOFF_MS[attempt - 1];
        console.warn(`[Gemini:${modelName}] Attempt ${attempt} unparseable. Retrying in ${waitMs / 1000}s...`);
        await new Promise(r => setTimeout(r, waitMs));
      } else {
        console.warn(`[Gemini:${modelName}] All 3 parse attempts failed. Trying next model...`);
      }
    }
  }

  console.warn("[callGeminiJSON] All Gemini models exhausted. Domain fallback will be used.");
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// generateWithFallback — centralised AI generation for ALL backend routes.
// Returns Gemini result if available, or null so the route can apply its
// domain-specific fallback. Never throws or fails the HTTP request.
// ─────────────────────────────────────────────────────────────────────────────
async function generateWithFallback(prompt, opts = {}) {
  return await callGeminiJSON(prompt, opts);
}

// ── Inject AI helpers into every request via res.locals ───────────
app.use((req, res, next) => {
  res.locals.callGemini           = (prompt, opts) => callGeminiWithModel(GEMINI_MODEL_CASCADE[0], prompt, opts);
  res.locals.callGeminiJSON       = (prompt, opts) => generateWithFallback(prompt, opts);
  res.locals.generateWithFallback = generateWithFallback;
  next();
});

// ── Static fallback builders ───────────────────────────────────────
const FALLBACK_POSTS = {
  instagram: (name, goal) => `✨ Introducing ${name}!\n\n${goal}.\n\nTap the link in bio to find out more. 👇\n\n#NewArrival #MustHave #${name.replace(/\s+/g, "")}`,
  twitter:   (name, goal) => `Just dropped: ${name}. ${goal}. Don't sleep on this. 👀 #NewProduct #${name.replace(/\s+/g, "")}`,
  linkedin:  (name, goal) => `Excited to introduce ${name}.\n\n${goal}.\n\nWould love your thoughts — have you faced this problem before?\n\n#Innovation #${name.replace(/\s+/g, "")}`,
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
  res.json({
    status:        "healthy",
    timestamp:     new Date().toISOString(),
    llmProvider:   "Gemini",
    geminiModels:  GEMINI_MODEL_CASCADE,
    fallbackReady: true,
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

    const platformList   = platforms.join(", ");
    const platformRules  = getPlatformRules(platforms);
    const toneVoice      = getToneVoice(tone);
    const campaignGuide  = getCampaignTypeGuidance(campaign_type);
    const platformSchema = platforms
      .map(p => `"${p.toLowerCase()}": { "post": "Full platform-native post copy", "caption": "Short punchy 1-2 line caption" }`)
      .join(",\n  ");

    const prompt = `You are a high-performing social media content strategist at a top creative agency.

CAMPAIGN BRIEF:
Brand: ${campaign_name} | Type: ${campaign_type} | Goal: ${campaign_goal}
Audience: ${target_audience} | Tone: ${tone} — ${toneVoice}
Platforms: ${platformList}

${campaignGuide}
${platformRules}

For EACH platform, generate a POST (full copy, platform-native) and CAPTION (1-2 lines).
NEVER start with "Introducing" or use corporate speak.

Return ONLY valid JSON. Start with { end with }.
{ ${platformSchema} }`;

    const aiData   = await generateWithFallback(prompt, { temperature: TEMPERATURE_PRESETS.creative, maxTokens: 4096 });
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

    const platformRule = getPlatformRules([platform]);
    const toneVoice    = getToneVoice(tone);

    const prompt = `You are a high-performing social media content strategist.
Brand: ${brand_name} | Product: ${product_or_service} | Goal: ${campaign_goal}
Audience: ${target_audience} | Tone: ${tone} — ${toneVoice}
Platform: ${platform} | Key Message: ${key_message} | CTA: ${call_to_action}

${platformRule}

Generate 3 post variations, 3 captions, 10 hashtags, 1 CTA.
Return ONLY valid JSON. Start with { end with }.
{
  "post_variations": ["v1","v2","v3"],
  "caption_variations": ["c1","c2","c3"],
  "hashtags": ["#tag1","#tag2","#tag3","#tag4","#tag5","#tag6","#tag7","#tag8","#tag9","#tag10"],
  "cta": "specific CTA line"
}`;

    const parsed = await generateWithFallback(prompt, { temperature: TEMPERATURE_PRESETS.creative, maxTokens: 3000 });

    // Domain-specific fallback for /generate-post
    if (!parsed) {
      const brandTag   = `#${brand_name.replace(/\s+/g, "")}`;
      const productTag = `#${product_or_service.replace(/\s+/g, "")}`;
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
        hashtags: [brandTag, productTag, "#SocialMedia", "#Marketing", "#TrendingNow", "#ContentMarketing", "#DigitalMarketing", `#${target_audience.replace(/\s+/g, "")}`, "#RelatableContent", "#MustSee"].slice(0, 10),
        cta: call_to_action,
      });
    }

    return res.json({
      post_variations:    (parsed.post_variations    || []).slice(0, 3).map(String),
      caption_variations: (parsed.caption_variations || []).slice(0, 3).map(String),
      hashtags:           (parsed.hashtags           || []).slice(0, 10).map(String),
      cta:                String(parsed.cta          || call_to_action),
    });
  } catch (err) {
    console.error("[/generate-post] Error:", err);
    return res.status(500).json({ error: "AI Post generation failed. Please try again." });
  }
});

// ── Card-specific route modules ────────────────────────────────────
app.use("/audience-targeting", audienceTargetingRouter);
app.use("/campaign-ideation",  campaignIdeationRouter);
app.use("/custom-flow",        customFlowRouter);
app.use("/creator-studio",     creatorStudioRouter);

/** Serve frontend SPA */
app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

// ── Start ──────────────────────────────────────────────────────────
app.listen(PORT, async () => {
  console.log(`\n✅  Socialyze API running on http://localhost:${PORT}`);
  console.log(`   GET  /health               — Health check`);
  console.log(`   POST /generate             — Multi-platform campaign generator`);
  console.log(`   POST /generate-post        — AI Post Generator card`);
  console.log(`   POST /audience-targeting   — Audience Targeting card`);
  console.log(`   POST /campaign-ideation    — Campaign Ideation card`);
  console.log(`   POST /custom-flow          — Custom Flow card`);
  console.log(`   POST /creator-studio       — Creator Studio editing guide`);
  console.log(`   POST /send-invite          — Workspace share invite email`);
  console.log(`\n   🔄  LLM provider: Google Gemini`);
  console.log(`   🔄  Model cascade: ${GEMINI_MODEL_CASCADE.join(" → ")}`);
  console.log(`   🛡️   Retry logic: 3 attempts per model with exponential backoff`);
  console.log(`   🛡️   Fallback: Domain-specific structured content (always usable)`);

  await verifyConnection();
});

module.exports = app;
