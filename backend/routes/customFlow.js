/**
 * Custom Flow Route
 * =================
 * POST /custom-flow
 *
 * Generates a complete, board-ready integrated campaign skeleton via Groq:
 * campaign name, positioning, brand voice guide, enriched content pillars,
 * platform strategy, posting plan with tactical notes, platform-labeled captions,
 * tiered hashtag strategy, and content calendar hooks.
 * Uses callGroqJSON for reliable structured output.
 *
 * Team   : Subasri B | Gautham Krishnan K | Ashwin D | Vinjarapu Ajay Kumar
 * Company: Sourcesys Technologies
 */

const express = require("express");
const router  = express.Router();
const { TEMPERATURE_PRESETS, getPlatformRules, getToneVoice } = require("../config");

const REQUIRED = [
  "brand_name", "product_or_service", "business_objective",
  "target_audience", "tone", "platforms", "campaign_duration",
  "key_message", "call_to_action",
];

// ── Prompt builder ─────────────────────────────────────────────────
function buildPrompt(d) {
  const platformList = Array.isArray(d.platforms) ? d.platforms.join(", ") : d.platforms;
  const toneVoice    = getToneVoice(d.tone);

  return `You are a senior performance marketer. Build a complete campaign skeleton for ${d.brand_name}.

Brand: ${d.brand_name} | Product: ${d.product_or_service} | Goal: ${d.business_objective}
Audience: ${d.target_audience} | Key message: ${d.key_message} | CTA: ${d.call_to_action}
Tone: ${d.tone} (${toneVoice}) | Duration: ${d.campaign_duration} | Platforms: ${platformList}

Rules: No "empower", "leverage", "synergize". Everything must read like real social media content, not a strategy doc. Captions must be copy-paste ready. Posting plan must have specific post ideas per week.

Generate all fields below. Return ONLY valid JSON. Start { end }.

{
  "campaign_name": "2-5 word ownable campaign name",
  "campaign_summary": "4 sentences: what, why, for whom, what winning looks like",
  "brand_voice_guide": "4 DO/NEVER direction notes specific to this campaign",
  "content_pillars": [
    {"name":"2-4 word ownable pillar","description":"1 sentence","example":"specific post idea"}
  ],
  "platform_strategy": [
    {"platform":"","strategy":"2 sentences","frequency":"posting cadence","formats":"content types"}
  ],
  "posting_plan": [
    {"week":"","focus":"strategic theme","post_types":"formats","sample_idea":"specific post","tactical_note":"1 execution tip"}
  ],
  "sample_captions": [
    {"platform":"","caption":"full publish-ready caption with hook, body, hashtags, CTA"}
  ],
  "hashtag_strategy": {
    "brand_hashtags": [],
    "trend_hashtags": [],
    "niche_hashtags": []
  },
  "calendar_hooks": []
}

Requirements: 5 content_pillars, 1 platform_strategy entry per platform, 1 posting_plan entry per week of ${d.campaign_duration}, 6 sample_captions (1+ per platform), 3 brand/6 trend/8 niche hashtags, 8 calendar_hooks.`;
}

// ── Fallback (if Groq unavailable) ────────────────────────────────
function buildFallback(d) {
  const platforms = Array.isArray(d.platforms) ? d.platforms : [d.platforms || "Instagram"];
  const brandSlug = d.brand_name.replace(/\s+/g, "");
  const prodSlug  = d.product_or_service.replace(/\s+/g, "");

  return {
    campaign_name:    `#${brandSlug}NoFilter`,
    campaign_summary: `${d.brand_name} is running a ${d.campaign_duration} campaign on ${platforms.join(" and ")} that speaks directly to what ${d.target_audience} are actually going through — not what brands assume they feel. Anchored in the message "${d.key_message}", every piece of content earns attention before asking for action. The campaign moves week-by-week from hook to trust to conversion, with each platform doing what it does best. Success looks like ${d.target_audience} sharing the content without being asked — because it says what they've been thinking.`,
    brand_voice_guide: `DO: Start every caption with the audience's frustration, not the product. DO: Write like a smart friend giving real advice — short sentences, no filler. NEVER: Use "Introducing", "Excited to announce", "Empower", or "Solution" — ever. NEVER: Write a caption that could belong to any other brand — every word should be specific to ${d.brand_name}.`,
    content_pillars: [
      { name: "The Uncomfortable Truth",    description: `Content that names ${d.target_audience}'s real problem out loud — the one nobody else in the industry is willing to say. This is the trust-builder.`, example: `"Why does [specific pain point] keep happening to ${d.target_audience}?" — Reel opens on a relatable frustration moment. No product until the last 3 seconds.` },
      { name: "Proof Without the Polish",   description: `Real results, real users, real numbers — zero stock photos. This counters skepticism by showing instead of claiming.`, example: `Carousel: Slide 1 — bold result stat. Slides 2-4 — raw customer testimonials in their own words, screenshot-style. Slide 5 — "${d.call_to_action}"` },
      { name: "How It Actually Works",      description: `Tactical content that makes ${d.product_or_service} feel approachable and immediately useful. Positions ${d.brand_name} as the expert who shows, not tells.`, example: `"3 things ${d.target_audience} get wrong about [category]" — Instagram carousel. Each slide one clear takeaway. Last slide: "We built ${d.product_or_service} to fix all three."` },
      { name: "Behind the Build",           description: `Authentic content showing the humans and decisions behind ${d.brand_name}. Builds emotional connection in a way polished brand content never can.`, example: `60-second Reel: "The moment we realised [pain point] was the actual problem." No script. Phone footage. On-screen text captions only.` },
      { name: "The Conversion Push",        description: `Content for the audience that already gets it — now give them a reason to act today, not eventually. Urgency without desperation.`, example: `"You've been saving this for a reason." — Story series. Slide 1: The pain point. Slide 2: The result. Slide 3: "${d.call_to_action}" with a timer or social proof number.` },
    ],
    platform_strategy: platforms.map(p => ({
      platform:  p,
      strategy:  `${p} carries the emotional weight of the campaign for ${d.target_audience}. Content here should feel native and discovered, not broadcast. ${d.key_message} is woven in — never forced. The goal is saves and shares first, reach second.`,
      frequency: p === "LinkedIn" ? "3x/week: 1 long-form post, 1 carousel, 1 poll" : p === "Twitter" ? "5x/week: 2 original posts, 2 reply-threads, 1 hot-take" : "4x/week: 2 Reels, 1 Carousel, 1 Stories poll",
      formats:   p === "LinkedIn" ? "Long-form storytelling posts, document carousels, data-backed polls" : p === "Twitter" ? "Single tweets under 240 chars, numbered threads, quote-tweet reactions" : p === "TikTok" ? "15-45s Reels, trending audio, POV format, text-overlay hooks" : "Reels 15-30s, 5-7 slide Carousels, Stories with sticker polls",
    })),
    posting_plan: [
      { week: "Week 1 — The Scroll-Stop",   focus: `Make ${d.target_audience} feel seen before they know it's ${d.brand_name}`, post_types: "Instagram Reel + Twitter thread + LinkedIn hook post", sample_idea: `Reel: Opens with black screen + text: "Real talk for ${d.target_audience}..." Cuts to 3 quick pain point moments. Ends: "${d.brand_name} made something for this." No product shown yet.`, tactical_note: "Pin the Reel. Don't boost yet. Let organic reach build. Reply to every comment in the first 2 hours." },
      { week: "Week 2 — The Trust Stack",   focus: "Build credibility through proof that feels human, not corporate", post_types: "Testimonial carousel + how-it-works video + myths post", sample_idea: `Carousel: "We asked 50 ${d.target_audience} what they actually thought of ${d.product_or_service}. Here's what they said — including the ones who weren't fans." Real quotes. Screenshot aesthetic.`, tactical_note: "Feature one negative-but-fair testimonial to show confidence. Save all testimonials as a Highlight." },
      { week: "Week 3 — The Community",     focus: "Turn audience from observers into participants", post_types: "UGC prompt + poll + follower spotlight + Q&A", sample_idea: `"Show us your [relevant moment] with ${d.product_or_service}. Best one gets featured + [reward]." Launch the prompt, repost entries in Stories, build a Round-up Reel by Friday.`, tactical_note: "Go Live mid-week. No script. Just answer real questions. Announce it 48h ahead in Stories." },
      { week: "Week 4 — The Convert",       focus: `Turn warmed-up audience into ${d.call_to_action} completions`, post_types: "Urgency post + offer announcement + results recap + final CTA Reel", sample_idea: `Final Reel: Montage of week 1-3 community moments, real results, and a final line: "This is what happens when ${d.target_audience} stop settling. ${d.call_to_action}." No music. Just the footage and a clean title card.`, tactical_note: `Now boost. Retarget everyone who engaged in weeks 1-3. A/B test two CTA versions. Put 60% of the remaining budget here.` },
    ],
    sample_captions: [
      { platform: platforms[0] || "Instagram", caption: `Nobody tells you this, but ${d.target_audience} spend [X hours] a week on something ${d.product_or_service} handles in minutes.\n\nWe didn't build a "solution".\nWe built a shortcut to the thing you actually want.\n\n${d.key_message}.\n\n${d.call_to_action} — link in bio 👇\n\n#${brandSlug} #${prodSlug} #RealTalk` },
      { platform: platforms[1] || platforms[0] || "LinkedIn", caption: `Here's something most ${d.industry || "brands"} won't tell you:\n\n[Specific uncomfortable truth about the category].\n\nWe found this out the hard way while building ${d.product_or_service}.\n\nSo we built it differently.\n\nHave you run into this? Drop a comment — would love to know if we're not alone.\n\n#${brandSlug} #${prodSlug} #${d.target_audience.replace(/\s+/g,"")}` },
      { platform: platforms[0] || "Instagram", caption: `POV: You just realised you've been doing it the hard way this whole time.\n\n${d.key_message}.\n\nYes, really. It's that simple.\n\n${d.call_to_action} 👇\n\n#${brandSlug} #TrustTheProcess #${prodSlug}` },
      { platform: platforms[2] || platforms[0] || "Twitter", caption: `Hot take: most brands are solving the wrong problem for ${d.target_audience}.\n\nHere's what they actually need (and what we built instead) 🧵` },
      { platform: platforms[1] || "LinkedIn", caption: `We surveyed 100 ${d.target_audience} and asked what they wish existed.\n\nTheir #1 answer was exactly what ${d.product_or_service} does.\n\nWe didn't guess. We listened.\n\n${d.call_to_action}\n\n#${brandSlug} #BuiltForYou #${d.target_audience.replace(/\s+/g,"")}` },
      { platform: platforms[0] || "Instagram", caption: `Last one.\n\n${d.key_message}.\n\nIf you've been waiting for the right moment — this is it.\n\n${d.call_to_action} — link in bio.\n\n#${brandSlug} #${prodSlug} #NowOrNever` },
    ],
    hashtag_strategy: {
      brand_hashtags: [`#${brandSlug}`,        `#${brandSlug}NoFilter`,         `#${prodSlug}Campaign`],
      trend_hashtags: [`#${d.target_audience.replace(/\s+/g,"")}`, "#SocialMediaMarketing", "#DigitalMarketing", "#ContentMarketing", "#RealContent", "#AuthenticBranding"],
      niche_hashtags: [`#${d.industry ? d.industry.replace(/\s+/g,"") : "Industry"}Community`, "#MarketingTwitter", "#CreatorEconomy", "#GrowthMarketing", "#CommunityFirst", "#PerformanceMarketing", "#ContentStrategy", "#BrandBuilding"],
    },
    calendar_hooks: [
      `Monday — "Nobody talks about this, but [specific pain point for ${d.target_audience}]" — open with the uncomfortable truth, end with ${d.product_or_service} as the fix. No product in the first slide.`,
      `Tuesday — Behind-the-scenes: "The decision that changed how we built ${d.product_or_service}" — phone footage, no script, on-screen text only`,
      `Wednesday — "Myth: [common misconception]. Fact: [what ${d.brand_name} does differently]" — carousel with bold type, each slide debunks one myth`,
      `Thursday — Community spotlight: Feature a real ${d.target_audience} using ${d.product_or_service} — let their words do the selling, not yours`,
      `Friday — "This week we learned..." — a genuine recap of one thing ${d.brand_name} learned from the community. Builds parasocial trust over time.`,
      `Saturday — Engagement bait that earns it: "Which of these is your biggest [category] headache?" — poll with 4 real options, not rhetorical ones`,
      `Week midpoint — Go Live with no script. Open the floor to real questions. Record it. Cut the best 60 seconds into a Reel.`,
      `Campaign finale — "We said we'd do [X]. Here's what actually happened." — honest results post. Numbers, quotes, what worked, what didn't. Ends: "${d.call_to_action}"`,
    ],
  };
}

// ── Route handler ──────────────────────────────────────────────────
router.post("/", async (req, res) => {
  try {
    const missing = REQUIRED.filter(f => {
      const v = req.body[f];
      if (!v) return true;
      if (Array.isArray(v)) return v.length === 0;
      return String(v).trim() === "";
    });
    if (missing.length) {
      return res.status(400).json({ error: `Missing required fields: ${missing.join(", ")}` });
    }

    const data         = req.body;
    // Prefer callGroqJSON; fall back to legacy alias if routes were registered before the update
    const callGroqJSON = res.locals.callGroqJSON || res.locals.callGeminiJSON;
    let parsed         = null;

    if (typeof callGroqJSON === "function") {
      parsed = await callGroqJSON(buildPrompt(data), {
        temperature: TEMPERATURE_PRESETS.strategic,
        maxTokens:   2500,
      });
    }

    if (!parsed) {
      console.warn("[custom-flow] Groq returned null. Using domain-specific fallback.");
      parsed = buildFallback(data);
    }

    // Sanitise output shape — accommodate both old (string[]) and new (object[]) formats
    const sanitised = {
      campaign_name:    String(parsed.campaign_name    || ""),
      campaign_summary: String(parsed.campaign_summary || ""),
      brand_voice_guide:String(parsed.brand_voice_guide|| ""),

      content_pillars: (parsed.content_pillars || []).slice(0, 5).map(p => {
        if (typeof p === "string") return { name: p, description: "", example: "" };
        return {
          name:        String(p.name        || ""),
          description: String(p.description || ""),
          example:     String(p.example     || ""),
        };
      }),

      platform_strategy: (parsed.platform_strategy || []).slice(0, 10).map(p => ({
        platform:  String(p.platform  || ""),
        strategy:  String(p.strategy  || ""),
        frequency: String(p.frequency || ""),
        formats:   String(p.formats   || ""),
      })),

      posting_plan: (parsed.posting_plan || []).slice(0, 8).map(p => ({
        // Old schema fields
        week:          String(p.week          || ""),
        focus:         String(p.focus         || p.theme || ""),
        post_types:    String(p.post_types    || ""),
        sample_idea:   String(p.sample_idea   || ""),
        tactical_note: String(p.tactical_note || ""),
        // New schema fields — pass through as-is so frontend can render them
        theme:          String(p.theme         || p.focus || ""),
        goal:           String(p.goal          || p.focus || ""),
        content_plan:   Array.isArray(p.content_plan)   ? p.content_plan.map(String)   : [],
        execution_tips: Array.isArray(p.execution_tips) ? p.execution_tips.map(String) : [],
        ai_insights:    String(p.ai_insights   || ""),
      })),

      // Accept both { platform, caption } objects and plain strings
      sample_captions: (parsed.sample_captions || parsed.captions || []).slice(0, 6).map(c => {
        if (typeof c === "string") return { platform: "", caption: c };
        return {
          platform: String(c.platform || ""),
          caption:  String(c.caption  || ""),
        };
      }),

      // Accept both tiered object and flat array
      hashtag_strategy: parsed.hashtag_strategy
        ? {
            brand_hashtags: (parsed.hashtag_strategy.brand_hashtags || []).slice(0, 3).map(String),
            trend_hashtags: (parsed.hashtag_strategy.trend_hashtags || []).slice(0, 7).map(String),
            niche_hashtags: (parsed.hashtag_strategy.niche_hashtags || []).slice(0, 10).map(String),
          }
        : {
            brand_hashtags: (parsed.hashtags || []).slice(0, 3).map(String),
            trend_hashtags: (parsed.hashtags || []).slice(3, 8).map(String),
            niche_hashtags: (parsed.hashtags || []).slice(8, 15).map(String),
          },

      hashtags:       (parsed.hashtags       || []).slice(0, 20).map(String),
      // Groq sometimes returns calendar_hooks as objects instead of plain strings.
      // Safely extract the text content from whatever shape the item is in.
      calendar_hooks: (parsed.calendar_hooks || []).slice(0, 8).map(item => {
        if (!item) return "";
        if (typeof item === "string") return item;
        if (typeof item === "object") {
          return item.text || item.hook || item.content || item.idea ||
                 item.description || item.name || item.title ||
                 Object.values(item).find(v => typeof v === "string" && v.length > 5) || "";
        }
        return String(item);
      }).filter(Boolean),
    };

    return res.json(sanitised);

  } catch (err) {
    console.error("[custom-flow] Error:", err);
    return res.status(500).json({ error: "Custom flow generation failed. Please try again." });
  }
});

module.exports = router;
