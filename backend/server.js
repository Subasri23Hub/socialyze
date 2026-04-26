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
      brand_name,
      product_or_service,
      campaign_goal,
      campaign_type      = "Product Launch",
      target_audience,
      key_message,
      call_to_action,
      tone               = "Professional",
      platforms          = ["Instagram"],
      variations         = 3,
    } = req.body;

    const missing = ["brand_name", "campaign_goal", "product_or_service", "target_audience", "key_message", "call_to_action"]
      .filter(f => !req.body[f] || String(req.body[f]).trim() === "");
    if (missing.length) {
      return res.status(400).json({ error: `Missing required fields: ${missing.join(", ")}` });
    }

    const platformList  = Array.isArray(platforms) ? platforms : [platforms];
    const varCount      = Math.min(Math.max(Number(variations) || 3, 1), 5);
    const toneVoice     = getToneVoice(tone);
    const strategyGuide = getCampaignTypeGuidance(campaign_type);
    const platformRules = getPlatformRules(platformList);
    const brandTag      = `#${brand_name.replace(/\s+/g, "")}`;
    const prodTag       = `#${product_or_service.replace(/\s+/g, "")}`;
    const keywordsLine  = key_message && key_message !== campaign_goal
      ? `Keywords / Themes: ${key_message}` : "";

    const CONTENT_TYPES = {
      Instagram: "Reel / Carousel", Twitter: "Tweet", LinkedIn: "Article / Carousel",
      Facebook: "Video Post", TikTok: "Short-form Video", YouTube: "Long-form / Shorts",
    };
    const BEST_TIMES = {
      Instagram: "Tue\u2013Fri, 7\u20139 AM or 6\u20139 PM", Twitter: "Weekdays, 8\u201310 AM or 6\u20138 PM",
      LinkedIn: "Tue\u2013Thu, 7\u20139 AM or 12\u20131 PM", Facebook: "Wed\u2013Fri, 1\u20133 PM",
      TikTok: "Daily, 6\u201310 PM", YouTube: "Fri\u2013Sun, 2\u20134 PM",
    };

    const platformSchema = platformList
      .map(p => `{"platform_name":"${p}","posts":[${Array.from({ length: varCount }, () =>
        `{"hook":"","caption":"","hashtags":[],"cta":"","content_type":"${CONTENT_TYPES[p] || "Post"}","best_time":"${BEST_TIMES[p] || "Weekdays, 9 AM\u20136 PM"}"`
        + "}")
        .join(",")}]}`)
      .join(",");

    const prompt = `You are a senior social media Creative Director at a top agency. Write campaign content that feels crafted \u2014 not generated. Every word earns its place.

\u2501\u2501 CAMPAIGN BRIEF \u2501\u2501
Brand: ${brand_name}
Product / Service: ${product_or_service}
Campaign Type: ${campaign_type}
Campaign Goal: ${campaign_goal}
Target Audience: ${target_audience}
Tone: ${tone} \u2014 ${toneVoice}
${keywordsLine}

\u2501\u2501 STRATEGY \u2501\u2501
${strategyGuide}

\u2501\u2501 PLATFORMS & RULES \u2501\u2501
${platformRules}

\u2501\u2501 OUTPUT REQUIREMENTS \u2501\u2501
For EACH of the ${platformList.length} platform(s), write exactly ${varCount} post variation(s).

Each variation MUST have:
- hook: 5\u201310 words max. A scroll-stopper. NOT generic (never "Discover", "Introducing", "Unlock your potential", "Say goodbye to"). Make it surprising, specific, or tension-creating.
- caption: 2\u20134 sentences. Expands the hook with a specific benefit tied to ${brand_name}\u2019s ${product_or_service}. Speaks to ${target_audience}. Ends naturally into the CTA. NEVER repeats the hook verbatim.
- hashtags: 4\u20136 tags. Short, real, discoverable. NO compound tags over 3 words. Mix: 1 brand tag, 2\u20133 niche tags, 1\u20132 broad trending tags.
- cta: One specific action \u2014 not \u201cLearn more\u201d or \u201cClick the link\u201d. Make it feel like an invitation.
- content_type: Native format for that platform.
- best_time: Optimal posting window.

Variation DIVERSITY \u2014 each variation must use a DIFFERENT angle:
  Variation 1 \u2014 Lead with the PROBLEM or pain point
  Variation 2 \u2014 Lead with the OUTCOME or transformation
  Variation 3 \u2014 Lead with SOCIAL PROOF, bold claim, or counterintuitive take
  (Beyond 3: rotate curiosity gap, behind-the-scenes, challenge/question)

ALSO deliver:
- post_variations: array of ${varCount} full post strings (hook + newline + caption combined) for the first platform \u2014 for backward compatibility
- hook_variations: array of ${varCount} short hook strings only (5\u201310 words each) for the first platform
- caption_variations: array of ${varCount} short 1\u20132 line captions for the first platform
- hashtags: 8\u201310 hashtags for the campaign overall
- cta: one strong CTA string
- platforms: full structured array for ALL platforms
- campaign_tagline: one memorable campaign truth line
- campaign_summary: 2 sentences on the campaign angle
- brand_voice_guide: 2 sentences on what ${brand_name} sounds like and never says
- audience_insight: one sharp specific truth about ${target_audience}
- campaign_ideas: 3 creative concepts each with title, big_idea, cultural_relevance, viral_mechanism, expected_impact
- kpis: 4 specific measurable KPIs
- budget_tips: 3 practical media spend tips

FORBIDDEN \u2014 never use these words or phrases:
\u201cUnlock\u201d, \u201cEmpower\u201d, \u201cRevolutionize\u201d, \u201cGame-changer\u201d, \u201cIntroducing\u201d, \u201cExcited to announce\u201d,
\u201cTake your X to the next level\u201d, \u201cIn today\u2019s world\u201d, \u201cJourney\u201d, \u201cElevate\u201d, \u201cSolution\u201d,
\u201cWe believe\u201d, \u201cAre you ready to\u201d, \u201cSay goodbye to\u201d, \u201cHello to\u201d

Return ONLY valid JSON. No explanation, no preamble, no markdown. Start with { end with }.
{
  "post_variations":[],
  "hook_variations":[],
  "caption_variations":[],
  "hashtags":[],
  "cta":"",
  "campaign_tagline":"",
  "campaign_summary":"",
  "brand_voice_guide":"",
  "audience_insight":"",
  "platforms":[${platformSchema}],
  "campaign_ideas":[{"title":"","big_idea":"","cultural_relevance":"","viral_mechanism":"","expected_impact":""}],
  "kpis":[],
  "budget_tips":[]
}`;

    let parsed = await generateWithFallback(prompt, { temperature: TEMPERATURE_PRESETS.creative, maxTokens: 2400 });

    if (parsed && isPlaceholderResponse(parsed)) {
      console.warn("[/generate-post] Groq returned placeholder values \u2014 falling back.");
      parsed = null;
    }

    if (!parsed) {
      console.warn("[/generate-post] Groq returned null/placeholder. Serving domain fallback.");
      // Pool of 5 unique fallback variations — sliced to varCount so the
      // correct number is always returned regardless of what the user selected.
      const ALL_FALLBACK_POSTS = [
        `${target_audience} don't need another ${product_or_service}.\n\nThey need one that actually works for how they live. ${brand_name} built ${product_or_service} around that truth.\n\n${call_to_action}.`,
        `Here's what happens after ${target_audience} try ${brand_name}'s ${product_or_service} for 7 days.\n\n${campaign_goal}. No complicated setup. No learning curve.\n\n${call_to_action}.`,
        `The ${product_or_service} category is crowded. Most of it is noise.\n\n${brand_name} is the one ${target_audience} keep recommending to each other. Here's why.\n\n${call_to_action}.`,
        `Most ${product_or_service} brands talk about features. ${brand_name} talks about what actually changes for ${target_audience}.\n\nThere's a difference. Feel it.\n\n${call_to_action}.`,
        `${target_audience} who tried ${brand_name}'s ${product_or_service} stopped looking for alternatives.\n\n${campaign_goal} — without the usual friction.\n\n${call_to_action}.`,
      ];
      const ALL_FALLBACK_HOOKS = [
        `${target_audience} deserve better than this`,
        `7 days with ${brand_name} changes things`,
        `Why ${target_audience} keep choosing ${brand_name}`,
        `${brand_name} said what others won't`,
        `${target_audience} stopped looking after this`,
      ];
      const ALL_FALLBACK_CAPTIONS = [
        `${campaign_goal}. ${call_to_action}.`,
        `Built for ${target_audience}. ${product_or_service} by ${brand_name}.`,
        `The ${product_or_service} ${target_audience} actually recommend. ${call_to_action}.`,
        `${brand_name} — direct, specific, no filler. ${call_to_action}.`,
        `${target_audience} trust ${brand_name} because it talks like an adult. ${call_to_action}.`,
      ];
      const fallbackVariations   = ALL_FALLBACK_POSTS.slice(0, varCount);
      const fallbackHooks        = ALL_FALLBACK_HOOKS.slice(0, varCount);
      const fallbackCaptions     = ALL_FALLBACK_CAPTIONS.slice(0, varCount);
      return res.json({
        post_variations:    fallbackVariations,
        hook_variations:    fallbackHooks,
        caption_variations: fallbackCaptions,
        hashtags: [brandTag, prodTag, `#${target_audience.replace(/\s+/g, "")}`, "#ContentMarketing", "#DigitalMarketing", "#SocialMedia", "#Marketing", "#BrandStory", "#RealContent", "#MustSee"].slice(0, 10),
        cta: call_to_action,
        campaign_tagline: `${brand_name} — built for ${target_audience}, not for the shelf`,
        campaign_summary: `This campaign speaks directly to ${target_audience}'s real experience with ${product_or_service}. Every post leads with honesty and earns the CTA.`,
        brand_voice_guide: `${brand_name} sounds like a smart friend who knows their stuff — direct, specific, never preachy. It never says "Elevate" or "Empower".`,
        audience_insight: `${target_audience} have seen every claim in this category. They trust brands that skip the marketing voice and talk to them like adults.`,
        platforms: platformList.map(p => ({
          platform_name: p,
          posts: fallbackVariations.map((post, i) => ({
            hook:         fallbackHooks[i] || post.split("\n")[0],
            caption:      post,
            hashtags:     [brandTag, prodTag, `#${p}Marketing`, "#RealContent", "#MustSee"],
            cta:          call_to_action,
            content_type: CONTENT_TYPES[p] || "Post",
            best_time:    BEST_TIMES[p] || "Weekdays, 9 AM–6 PM",
          })),
        })),
        campaign_ideas: [],
        kpis: [],
        budget_tips: [],
      });
    }

    return res.json({
      post_variations:    (parsed.post_variations    || []).slice(0, varCount).map(String),
      hook_variations:    (parsed.hook_variations    || []).slice(0, varCount).map(String),
      caption_variations: (parsed.caption_variations || []).slice(0, varCount).map(String),
      hashtags:           (parsed.hashtags           || []).slice(0, 10).map(String),
      cta:                String(parsed.cta          || call_to_action),
      campaign_tagline:   String(parsed.campaign_tagline  || ""),
      campaign_summary:   String(parsed.campaign_summary  || ""),
      brand_voice_guide:  String(parsed.brand_voice_guide || ""),
      audience_insight:   String(parsed.audience_insight  || ""),
      platforms:          parsed.platforms || [],
      campaign_ideas:     parsed.campaign_ideas || [],
      kpis:               parsed.kpis        || [],
      budget_tips:        parsed.budget_tips  || [],
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
