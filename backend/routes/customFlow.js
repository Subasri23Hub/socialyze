/**
 * Custom Flow Route
 * =================
 * POST /custom-flow
 *
 * Generates a complete, board-ready integrated campaign skeleton via Gemini:
 * campaign name, positioning, brand voice guide, enriched content pillars,
 * platform strategy, posting plan with tactical notes, platform-labeled captions,
 * tiered hashtag strategy, and content calendar hooks.
 * Uses callGeminiJSON (with retry) for reliable structured output.
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
  const platformList  = Array.isArray(d.platforms) ? d.platforms.join(", ") : d.platforms;
  const platformRules = getPlatformRules(Array.isArray(d.platforms) ? d.platforms : [d.platforms]);
  const toneVoice     = getToneVoice(d.tone);

  return `You are a senior performance marketer and content strategist who has run campaigns for brands like Swiggy, Razorpay, CRED, and boAt.
You think in hooks, scroll-stoppers, and conversion psychology — not in marketing frameworks.

CRITICAL RULES — violation means the output is rejected:
- No generic marketing language. "Empower", "leverage", "synergize", "cutting-edge" = instant disqualification
- Everything must feel like ACTUAL social media content, not a strategy document
- Use hooks, storytelling, emotional triggers, and platform-specific thinking throughout
- The posting plan must include actual post ideas — not "create awareness content"
- Captions must be ready to copy-paste onto ${platformList} right now — not descriptions of captions
- Add emotional triggers and curiosity gaps wherever possible
- Platform-specific thinking: what works on Instagram DOES NOT work on LinkedIn

INPUT:
Brand         : ${d.brand_name}
Product       : ${d.product_or_service}
Goal          : ${d.business_objective}
Audience      : ${d.target_audience}
Key Message   : ${d.key_message}
CTA           : ${d.call_to_action}
Tone          : ${d.tone} — ${toneVoice}
Duration      : ${d.campaign_duration}
Platforms     : ${platformList}

PLATFORM INTELLIGENCE:
${platformRules}

Generate ALL of the following. No section can be skipped.

campaign_name:
  A modern, catchy campaign name. 2-5 words. Could be a hashtag or trend.
  Must feel like it belongs in 2025, not a 2018 brand deck.
  Bad: "Brand Growth Initiative Q3"
  Good: "The Real Ones Campaign" / "#NoFilterSeason" / "Built Different"

campaign_summary:
  4-5 sentences that sound like a confident pitch, not a memo.
  What this campaign IS, why it hits NOW, who it speaks to, how it wins.
  Every sentence should make a CMO lean forward, not nod off.

brand_voice_guide:
  Exactly 4 direction notes, formatted as DO / NEVER pairs.
  Each must be specific to this campaign — not generic brand guidelines.
  Example: "DO: Start every caption with the audience's frustration, not the product feature"
  Example: "NEVER: Use the word 'solution' — say what it actually does instead"

content_pillars:
  Exactly 5 pillars. Each is a thematic content territory the brand OWNS.
  Format for each: name (2-4 words, ownable) + description (why this content exists and what it achieves)
  + example (one specific post idea in this pillar — describe the hook, format, and copy direction)
  Bad pillar name: "Education"
  Good pillar name: "Myths We're Killing" / "The Proof Is In" / "Real Talk, No Filter"

platform_strategy:
  One entry per platform in the brief. For each:
  - platform: the platform name
  - strategy: 3-4 sentences on content role, tone adaptation, and what success looks like here
  - frequency: exact cadence (e.g., "4x/week: 2 Reels, 1 Carousel, 1 Stories poll")
  - formats: specific formats for this platform (not generic — e.g., "15-30s Reels with text overlay hook")

posting_plan:
  One entry per week of ${d.campaign_duration}. Each week must have:
  - week: "Week N — [phase name]" (e.g., "Week 1 — The Scroll-Stop")
  - focus: The strategic goal of this week in one sharp sentence
  - post_types: Actual content formats with platform labels (e.g., "Instagram Reel + LinkedIn carousel + Twitter thread")
  - sample_idea: A specific post idea — describe the hook, the content, and the CTA. Not a content category — a real idea.
  - tactical_note: One execution tip (e.g., "Pin this Reel. Boost to ${d.target_audience} lookalike. Reply to every comment in first hour.")

sample_captions:
  Exactly 6 full, publish-ready captions — at least one per major platform.
  Each must have: a hook that stops the scroll in the first line, real body copy with line breaks,
  3-5 relevant hashtags, and a CTA that doesn't say "click the link in bio" generically.
  These must feel like they belong on modern social media — not a corporate newsletter.
  Format for each: platform name + the full caption text.

hashtag_strategy:
  Three tiers:
  - brand_hashtags: 2-3 campaign-specific hashtags unique to this campaign
  - trend_hashtags: 5-7 high-volume hashtags ${d.target_audience} actually uses on ${platformList}
  - niche_hashtags: 8-10 community hashtags that get seen by the right people, not everyone

calendar_hooks:
  Exactly 8 specific content hook ideas tied to days, recurring formats, or cultural moments.
  Format: "[Day or timing] — [hook idea with actual copy direction]"
  Bad: "Monday — Post educational content"
  Good: "Monday — 'Nobody talks about this, but [specific industry pain point]' — open with the problem, pivot to ${d.product_or_service} as the fix in the last slide"

Return ONLY valid JSON. No markdown. No explanation. No trailing commas. Start with { and end with }.

{
  "campaign_name": "",
  "campaign_summary": "",
  "brand_voice_guide": "",
  "content_pillars": [
    { "name": "", "description": "", "example": "" },
    { "name": "", "description": "", "example": "" },
    { "name": "", "description": "", "example": "" },
    { "name": "", "description": "", "example": "" },
    { "name": "", "description": "", "example": "" }
  ],
  "platform_strategy": [
    { "platform": "", "strategy": "", "frequency": "", "formats": "" }
  ],
  "posting_plan": [
    { "week": "", "focus": "", "post_types": "", "sample_idea": "", "tactical_note": "" }
  ],
  "sample_captions": [
    { "platform": "", "caption": "" },
    { "platform": "", "caption": "" },
    { "platform": "", "caption": "" },
    { "platform": "", "caption": "" },
    { "platform": "", "caption": "" },
    { "platform": "", "caption": "" }
  ],
  "hashtag_strategy": {
    "brand_hashtags": [],
    "trend_hashtags": [],
    "niche_hashtags": []
  },
  "calendar_hooks": []
}`;
}

// ── Fallback (if Gemini unavailable) ──────────────────────────────
function buildFallback(d) {
  const platforms = Array.isArray(d.platforms) ? d.platforms : [d.platforms || "Instagram"];
  const brandSlug = d.brand_name.replace(/\s+/g, "");
  const prodSlug  = d.product_or_service.replace(/\s+/g, "");

  return {
    campaign_name:    `#${brandSlug}NoFilter`,
    campaign_summary: `${d.brand_name} is running a ${d.campaign_duration} campaign on ${platforms.join(" and ")} that speaks directly to what ${d.target_audience} are actually going through — not what brands assume they feel. Anchored in the message "${d.key_message}", every piece of content earns attention before asking for action. The campaign moves week-by-week from hook to trust to conversion, with each platform doing what it does best. Success looks like ${d.target_audience} sharing the content without being asked — because it says what they've been thinking.`,
    brand_voice_guide: `DO: Start every caption with the audience's frustration, not the product. DO: Write like a smart friend giving real advice — short sentences, no filler. NEVER: Use "Introducing", "Excited to announce", "Empower", or "Solution" — ever. NEVER: Write a caption that could belong to any other brand — every word should be specific to ${d.brand_name}.`,
    content_pillars: [
      { name: "The Uncomfortable Truth",    description: `Content that names ${d.target_audience}'s real problem out loud — the one nobody else in ${d.industry} is willing to say. This is the trust-builder.`, example: `"Why does [specific pain point] keep happening to ${d.target_audience}?" — Reel opens on a relatable frustration moment. No product until the last 3 seconds.` },
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
      { week: "Week 1 — The Scroll-Stop",   focus: "Make ${d.target_audience} feel seen before they know it's ${d.brand_name}", post_types: "Instagram Reel + Twitter thread + LinkedIn hook post", sample_idea: `Reel: Opens with black screen + text: "Real talk for ${d.target_audience}..." Cuts to 3 quick pain point moments. Ends: "${d.brand_name} made something for this." No product shown yet.`, tactical_note: "Pin the Reel. Don't boost yet. Let organic reach build. Reply to every comment in the first 2 hours." },
      { week: "Week 2 — The Trust Stack",   focus: "Build credibility through proof that feels human, not corporate", post_types: "Testimonial carousel + how-it-works video + myths post", sample_idea: `Carousel: "We asked 50 ${d.target_audience} what they actually thought of ${d.product_or_service}. Here's what they said — including the ones who weren't fans." Real quotes. Screenshot aesthetic.`, tactical_note: "Feature one negative-but-fair testimonial to show confidence. Save all testimonials as a Highlight." },
      { week: "Week 3 — The Community",     focus: "Turn audience from observers into participants", post_types: "UGC prompt + poll + follower spotlight + Q&A", sample_idea: `"Show us your [relevant moment] with ${d.product_or_service}. Best one gets featured + [reward]." Launch the prompt, repost entries in Stories, build a Round-up Reel by Friday.`, tactical_note: "Go Live mid-week. No script. Just answer real questions. Announce it 48h ahead in Stories." },
      { week: "Week 4 — The Convert",       focus: "Turn warmed-up audience into ${d.call_to_action} completions", post_types: "Urgency post + offer announcement + results recap + final CTA Reel", sample_idea: `Final Reel: Montage of week 1-3 community moments, real results, and a final line: "This is what happens when ${d.target_audience} stop settling. ${d.call_to_action}." No music. Just the footage and a clean title card.`, tactical_note: `Now boost. Retarget everyone who engaged in weeks 1-3. A/B test two CTA versions. Put 60% of the remaining budget here.` },
    ],
    sample_captions: [
      { platform: platforms[0] || "Instagram", caption: `Nobody tells you this, but ${d.target_audience} spend [X hours] a week on something ${d.product_or_service} handles in minutes.\n\nWe didn't build a "solution".\nWe built a shortcut to the thing you actually want.\n\n${d.key_message}.\n\n${d.call_to_action} — link in bio 👇\n\n#${brandSlug} #${prodSlug} #RealTalk` },
      { platform: platforms[1] || platforms[0] || "LinkedIn", caption: `Here's something most ${d.industry} brands won't tell you:\n\n[Specific uncomfortable truth about the category].\n\nWe found this out the hard way while building ${d.product_or_service}.\n\nSo we built it differently.\n\nHave you run into this? Drop a comment — would love to know if we're not alone.\n\n#${brandSlug} #${prodSlug} #${d.target_audience.replace(/\s+/g,"")}` },
      { platform: platforms[0] || "Instagram", caption: `POV: You just realised you've been doing it the hard way this whole time.\n\n${d.key_message}.\n\nYes, really. It's that simple.\n\n${d.call_to_action} 👇\n\n#${brandSlug} #TrustTheProcess #${prodSlug}` },
      { platform: platforms[2] || platforms[0] || "Twitter", caption: `Hot take: most ${d.industry} brands are solving the wrong problem for ${d.target_audience}.\n\nHere's what they actually need (and what we built instead) 🧵` },
      { platform: platforms[1] || "LinkedIn", caption: `We surveyed 100 ${d.target_audience} and asked what they wish existed.\n\nTheir #1 answer was exactly what ${d.product_or_service} does.\n\nWe didn't guess. We listened.\n\n${d.call_to_action}\n\n#${brandSlug} #BuiltForYou #${d.target_audience.replace(/\s+/g,"")}` },
      { platform: platforms[0] || "Instagram", caption: `Last one.\n\n${d.key_message}.\n\nIf you've been waiting for the right moment — this is it.\n\n${d.call_to_action} — link in bio.\n\n#${brandSlug} #${prodSlug} #NowOrNever` },
    ],
    hashtag_strategy: {
      brand_hashtags: [`#${brandSlug}`,        `#${brandSlug}NoFilter`,         `#${prodSlug}Campaign`],
      trend_hashtags: [`#${d.target_audience.replace(/\s+/g,"")}`, "#SocialMediaMarketing", "#DigitalMarketing", "#ContentMarketing", "#RealContent", "#AuthenticBranding"],
      niche_hashtags: [`#${d.industry ? d.industry.replace(/\s+/g,"") : "Industry"}Community`, "#MarketingTwitter", "#CreatorEconomy", "#GrowthMarketing", "#CommunityFirst", "#PerformanceMarketing", "#ContentStrategy", "#BrandBuilding"],
    },
    calendar_hooks: [
      `Monday — "Nobody talks about this, but [specific ${d.industry} pain point]" — open with the uncomfortable truth, end with ${d.product_or_service} as the fix. No product in the first slide.`,
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

    const data           = req.body;
    const callGeminiJSON = res.locals.callGeminiJSON;
    let parsed           = null;

    if (typeof callGeminiJSON === "function") {
      parsed = await callGeminiJSON(buildPrompt(data), {
        temperature: TEMPERATURE_PRESETS.strategic,   // 0.75 — structured + creative balance
        maxTokens:   8192,
      });
    } else if (typeof res.locals.callGemini === "function") {
      const raw = await res.locals.callGemini(buildPrompt(data));
      if (raw) {
        try { parsed = JSON.parse(raw.replace(/```json|```/gi, "").trim()); }
        catch { console.warn("[custom-flow] JSON parse failed."); }
      }
    }

    if (!parsed) parsed = buildFallback(data);

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
        week:          String(p.week          || ""),
        focus:         String(p.focus         || ""),
        post_types:    String(p.post_types    || ""),
        sample_idea:   String(p.sample_idea   || ""),
        tactical_note: String(p.tactical_note || ""),
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

      // Flat array for legacy frontend compatibility
      hashtags:      (parsed.hashtags       || []).slice(0, 20).map(String),
      calendar_hooks:(parsed.calendar_hooks || []).slice(0, 8).map(String),
    };

    return res.json(sanitised);

  } catch (err) {
    console.error("[custom-flow] Error:", err);
    return res.status(500).json({ error: "Custom flow generation failed. Please try again." });
  }
});

module.exports = router;
