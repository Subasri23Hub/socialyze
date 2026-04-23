/**
 * Campaign Ideation Route
 * =======================
 * POST /campaign-ideation
 *
 * Generates 5 distinct, creatively bold campaign concepts —
 * from safe-but-smart to high-risk/high-reward.
 * Uses callGroqJSON for reliable structured output.
 *
 * Team   : Subasri B | Gautham Krishnan K | Ashwin D | Vinjarapu Ajay Kumar
 * Company: Sourcesys Technologies
 */

const express = require("express");
const router  = express.Router();
const { TEMPERATURE_PRESETS } = require("../config");

const REQUIRED = [
  "brand_name", "product_or_service", "campaign_goal",
  "target_audience", "tone", "season_or_event", "platform_focus",
];

// ── Prompt builder ─────────────────────────────────────────────────
function buildPrompt(d) {
  return `You are a creative strategist. Generate 5 campaign concepts for ${d.brand_name}, each bolder than the last.

Brand: ${d.brand_name} | Product: ${d.product_or_service} | Goal: ${d.campaign_goal}
Audience: ${d.target_audience} | Season: ${d.season_or_event} | Platform: ${d.platform_focus} | Tone: ${d.tone}

Concepts must be progressively bolder: #1 safe-but-smart → #5 high-risk viral. No slogans like "Together we rise". No corporate speak. Write actual social media language, not descriptions of it.

Each concept needs exactly:
- title: 2-5 words, could trend as hashtag, specific to ${d.brand_name}
- tagline: one gut-punch line (fits on a hoodie or tweet screenshot)
- idea: 3-4 sentences — what IS it, what does it DO, why will ${d.target_audience} care during ${d.season_or_event}
- why_it_works: 2 sentences — strategic logic
- execution: tactical first post on ${d.platform_focus} — describe the actual content

Return ONLY valid JSON. Start { end }.
{"campaigns":[{"title":"","tagline":"","idea":"","why_it_works":"","execution":""},{"title":"","tagline":"","idea":"","why_it_works":"","execution":""},{"title":"","tagline":"","idea":"","why_it_works":"","execution":""},{"title":"","tagline":"","idea":"","why_it_works":"","execution":""},{"title":"","tagline":"","idea":"","why_it_works":"","execution":""}]}`;
}

// ── Fallback ───────────────────────────────────────────────────────
function buildFallback(d) {
  return {
    campaigns: [
      {
        title:       `The ${d.season_or_event} Truth`,
        tagline:     `This ${d.season_or_event}, we're done pretending.`,
        idea:        `${d.brand_name} runs an unfiltered content series that names the things ${d.target_audience} actually feel during ${d.season_or_event} — not the curated Instagram version of it. Each post starts with "Nobody talks about this, but..." and lands on how ${d.product_or_service} fits into the real, messy version of the season.`,
        why_it_works: `${d.target_audience} are exhausted by performative ${d.season_or_event} content. The brand that acknowledges reality earns immediate trust. Authenticity is the conversion strategy, not the soft marketing play.`,
        execution:   `First post: Reel opening with black screen + white text "Nobody talks about how [specific pain point] during ${d.season_or_event}." Cut to product being used in a real, unglamorous setting. Caption starts with the pain point, no setup. Ends: "${d.brand_name}. For the real version." Hook is the first 2 words — "Nobody talks".`,
      },
      {
        title:       `#Unfiltered${d.brand_name.replace(/\s+/g,"")}`,
        tagline:     `You asked for real. Here it is.`,
        idea:        `A UGC campaign where ${d.target_audience} share their actual, unedited experience with ${d.product_or_service} during ${d.season_or_event} — good and bad. ${d.brand_name} reposts everything, including the criticism. The brutal transparency becomes the differentiator in a category full of polished case studies.`,
        why_it_works: `User-generated honesty performs 4x better than branded content on ${d.platform_focus}. Reposting criticism signals extreme confidence. ${d.target_audience} in ${d.season_or_event} mindset want reassurance from peers, not from the brand.`,
        execution:   `Launch post: "We're giving you our account for ${d.season_or_event}. Send us your real ${d.product_or_service} experience — we'll post it. Even if it's a complaint." Format: Carousel of 5 raw, screenshot-style user stories. Pin it. Feature a negative review in the second slide deliberately.`,
      },
      {
        title:       `The Anti-${d.season_or_event} Campaign`,
        tagline:     `Everyone's doing ${d.season_or_event}. We're doing something else.`,
        idea:        `While every brand runs a predictable ${d.season_or_event} campaign, ${d.brand_name} runs the opposite one — acknowledging the fatigue, the pressure, and the performance of it all. ${d.product_or_service} is positioned as the brand that helps ${d.target_audience} opt out of the noise and do ${d.season_or_event} their way.`,
        why_it_works: `Pattern interruption is the most powerful scroll-stopper on ${d.platform_focus} right now. When every other brand is yelling about ${d.season_or_event}, a brand that says "actually..." gets the screenshot.`,
        execution:   `First post on ${d.platform_focus}: Bold text over a plain background — "Hot take: ${d.season_or_event} is overhyped." Immediate comments. Next day: "We said what we said. Here's why ${d.product_or_service} disagrees with how [category] normally does this."`,
      },
      {
        title:       `The ${d.target_audience.split(" ")[0]} Files`,
        tagline:     `Real people. Real problems. Real fix.`,
        idea:        `A documentary-style content series on ${d.platform_focus} where ${d.brand_name} follows 3 real ${d.target_audience} through ${d.season_or_event} and shows — without scripting — how ${d.product_or_service} fits into their actual life. No talking heads, no testimonials. Just footage, on-screen text, and honest moments.`,
        why_it_works: `Documentary content on ${d.platform_focus} drives 3x longer watch time than polished brand videos. ${d.target_audience} trust peer stories over brand stories.`,
        execution:   `Episode 1: 60-second Reel. Open with subject looking at camera, no intro music. First line of on-screen text: "[Their name]. [Their job]. Hates [pain point]." Show ${d.product_or_service} appearing naturally at the moment of friction. End card: "Episode 2 drops Thursday."`,
      },
      {
        title:       `${d.brand_name} Out Loud`,
        tagline:     `We'll say what our competitors won't.`,
        idea:        `${d.brand_name} publishes a "Competitor Comparison" content series that is brutally, hilariously honest — including what ${d.product_or_service} is NOT great at. The campaign positions the brand as the only one confident enough to tell the truth, which makes everything they say about their strengths believable.`,
        why_it_works: `Radical honesty is the most powerful brand differentiator in saturated markets. When a brand admits a weakness, the audience believes the strengths. High share potential on ${d.platform_focus}.`,
        execution:   `First post: "Things ${d.brand_name} is NOT the best at (a thread):" — list 3 real limitations with full transparency. Final tweet/slide: "What we ARE the best at: [${d.product_or_service} core strength] for ${d.target_audience}." CTA: "Try it and tell us if we're lying."`,
      },
    ],
  };
}

// ── Route handler ──────────────────────────────────────────────────
router.post("/", async (req, res) => {
  try {
    const missing = REQUIRED.filter(f => !req.body[f] || String(req.body[f]).trim() === "");
    if (missing.length) {
      return res.status(400).json({ error: `Missing required fields: ${missing.join(", ")}` });
    }

    const data         = req.body;
    const callGroqJSON = res.locals.callGroqJSON || res.locals.callGeminiJSON;
    let parsed         = null;

    if (typeof callGroqJSON === "function") {
      parsed = await callGroqJSON(buildPrompt(data), {
        temperature: TEMPERATURE_PRESETS.creative,
        maxTokens:   2000,
      });
    }

    if (!parsed) {
      console.warn("[campaign-ideation] Groq returned null. Using domain-specific fallback.");
      parsed = buildFallback(data);
    }

    // Support both { campaigns } and { campaign_ideas } shapes
    const rawList = parsed.campaigns || parsed.campaign_ideas || [];

    const campaigns = rawList.slice(0, 5).map(item => {
      const out = {};
      out.title        = String(item.title        || item.idea_title    || "");
      out.tagline      = String(item.tagline       || "");
      out.idea         = String(item.idea          || item.big_idea     || item.content_theme || "");
      out.why_it_works = String(item.why_it_works  || item.cultural_hook || item.why_it_wins  || "");
      out.execution    = String(item.execution     || item.platform_execution || item.sample_post_idea || "");
      // Keep legacy fields for frontend compatibility
      out.idea_title       = out.title;
      out.content_theme    = out.idea;
      out.sample_post_idea = out.execution;
      return out;
    });
    while (campaigns.length < 5) {
      campaigns.push({ title:"", tagline:"", idea:"", why_it_works:"", execution:"", idea_title:"", content_theme:"", sample_post_idea:"" });
    }

    return res.json({
      campaigns,
      campaign_ideas: campaigns,
    });

  } catch (err) {
    console.error("[campaign-ideation] Error:", err);
    return res.status(500).json({ error: "Campaign ideation generation failed. Please try again." });
  }
});

module.exports = router;
