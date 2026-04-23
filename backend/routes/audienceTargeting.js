/**
 * Audience Targeting Route
 * ========================
 * POST /audience-targeting
 *
 * Generates 3 deeply psychographic, strategy-grade audience personas via Groq.
 * Uses callGroqJSON for reliable structured output.
 *
 * Team   : Subasri B | Gautham Krishnan K | Ashwin D | Vinjarapu Ajay Kumar
 * Company: Sourcesys Technologies
 */

const express = require("express");
const router  = express.Router();
const { TEMPERATURE_PRESETS } = require("../config");

const REQUIRED = [
  "brand_name", "product_or_service", "campaign_objective",
  "industry", "age_group", "region", "customer_type", "pain_points",
];

// ── Prompt builder ─────────────────────────────────────────────────
function buildPrompt(d) {
  return `You are an audience research strategist. Generate 3 distinct, psychographic-rich personas for ${d.brand_name}.

Brand: ${d.brand_name} | Product: ${d.product_or_service} | Goal: ${d.campaign_objective}
Region: ${d.region} | Industry: ${d.industry} | Age: ${d.age_group} | Type: ${d.customer_type}
Core pain: ${d.pain_points}

Rules: No generic archetypes. Each persona = a real person in ${d.region}. Different motivations, fears, platforms per persona. No buzzwords.

For each persona:
- persona_name: "[First name] — [Psychological archetype]" (e.g. "Meera — The Quietly Burnt-Out Overachiever")
- description: 2 sentences — their life, their specific frustration with ${d.industry}
- motivations: 3 identity-driven desires (not product features)
- pain_points: 3 visceral friction moments tied to "${d.pain_points}"
- behavior: 1 paragraph — platform habits, what they save/share/lurk, when they scroll
- content_preferences: 3 specific formats they stop for (not just "Reels" — be precise)
- buying_trigger: the single scroll-breaking moment that makes them act

Return ONLY valid JSON. Start { end }.
{
  "personas": [
    {"persona_name":"","description":"","motivations":["","",""],"pain_points":["","",""],"behavior":"","content_preferences":["","",""],"buying_trigger":""}
  ]
}`;
}

// ── Fallback (if Groq is unavailable) ─────────────────────────────
function buildFallback(d) {
  return {
    personas: [
      {
        persona_name:    `Arjun — The Efficiency Hunter`,
        description:     `A ${d.age_group} ${d.customer_type} professional in ${d.region} juggling multiple responsibilities while trying to keep up with industry demands. They've tried multiple ${d.industry} solutions and found them either too complex or too shallow. ${d.pain_points} is the friction point that makes them switch providers every 6–9 months.`,
        motivations:     [`To stop feeling behind everyone else in the ${d.industry} space`, `To reclaim 2+ hours a day lost to manual, repetitive work`, `To finally feel like they have the right tools, not just workarounds`],
        pain_points:     [`Spends an hour each morning on tasks ${d.product_or_service} could handle in minutes`, `Has tried 3 other solutions that promised results but delivered complexity`, `${d.pain_points} — and no one talks about how exhausting it actually is`],
        behavior:        `Opens LinkedIn at 7am during commute looking for tactical content, not inspiration. Saves long-form posts to read later but rarely does. Watches 2-minute explainer videos at 1.5x speed. Shares tools with team only after personally testing them for 2 weeks. Lurks more than posts.`,
        content_preferences: [`Data-backed carousels with numbered frameworks`, `2-minute demo videos showing the product doing the actual task`, `Twitter/X threads: "5 things I wish I knew before using [category]"`],
        buying_trigger:  `Sees a peer in their industry casually mention ${d.product_or_service} solved the exact problem they've been manually working around for months`,
      },
      {
        persona_name:    `Priya — The Quietly Sceptical Researcher`,
        description:     `A ${d.age_group} consumer in ${d.region} who has been burned by overpromising brands in the ${d.industry} space before. She spends 2–3x more time researching than the average buyer and reads at least 5 reviews before touching a free trial. ${d.pain_points} is her primary deal-breaker and the first thing she checks for in every comparison.`,
        motivations:     [`To make a decision she won't regret 3 months later`, `To feel confident recommending something to her team or network`, `To find a brand that doesn't overpromise and underdeliver — for once`],
        pain_points:     [`${d.pain_points} — and every product she's tried made it worse, not better`, `Wastes hours reading reviews that all say the same generic things`, `Gets 80% through a free trial and hits a wall that forces an upgrade she didn't plan for`],
        behavior:        `YouTube is her primary research channel — watches 10–20 minute honest reviews before any purchase. Reads the 3-star reviews on G2/Capterra first. Bookmarks competitor comparison pages. Never clicks ads. Waits for organic recommendations from communities she trusts.`,
        content_preferences: [`Long-form YouTube reviews with real screen recordings, not polished demos`, `Reddit threads where real users talk about what broke`, `Honest comparison content: "We vs Them — here's where we lose"`],
        buying_trigger:  `Finds an unsponsored, critical review that acknowledges a real limitation of ${d.product_or_service} — and still recommends it. Honesty is the conversion trigger.`,
      },
      {
        persona_name:    `Kavya — The Identity-Driven Early Adopter`,
        description:     `A ${d.age_group} ${d.customer_type} in ${d.region} who sees the tools they use as an extension of their identity and taste. They follow trends closely and share what they discover with their network — being early to something good is social currency for them. ${d.pain_points} isn't just a problem; it's a signal that their current setup isn't at the level they want to be at.`,
        motivations:     [`To be the person who introduced their circle to the next big thing`, `To build a personal brand that looks like they have their life together`, `To close the gap between who they are and who they're becoming`],
        pain_points:     [`${d.pain_points} — but also the embarrassment of being seen using outdated tools`, `Discovers products they love 6 months after everyone else already moved on`, `Aesthetic and experience matter as much as function — most ${d.industry} products fail both`],
        behavior:        `Discovers products through saved Instagram Reels and close-friend story shares, never ads. Has 200+ posts saved that they actually revisit. Posts about products they love organically without being asked. Shares purchases in Stories within 24 hours. Follows micro-creators over mega-influencers.`,
        content_preferences: [`Aesthetic lo-fi Reels showing the product in a real environment, not a studio`, `"Day in my life" content where ${d.product_or_service} appears naturally, not as a sponsorship`, `Before/after carousels that show identity transformation, not just product results`],
        buying_trigger:  `Sees someone they genuinely admire — a micro-creator or respected peer, not a celebrity — using ${d.product_or_service} without a sponsorship label and talking about it like it's just part of their routine`,
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
        temperature: TEMPERATURE_PRESETS.strategic,
        maxTokens:   1800,
      });
    }

    if (!parsed) {
      console.warn("[audience-targeting] Groq returned null. Using domain-specific fallback.");
      parsed = buildFallback(data);
    }

    const personas = (parsed.personas || []).slice(0, 3).map(p => {
      const out = {};
      out.persona_name         = String(p.persona_name  || "");
      out.description          = String(p.description   || "");
      out.motivations          = Array.isArray(p.motivations)         ? p.motivations.slice(0,3).map(String)         : [String(p.motivations || "")];
      out.pain_points          = Array.isArray(p.pain_points)         ? p.pain_points.slice(0,3).map(String)         : [String(p.pain_points || "")];
      out.behavior             = String(p.behavior      || "");
      out.content_preferences  = Array.isArray(p.content_preferences) ? p.content_preferences.slice(0,5).map(String) : [String(p.content_preferences || "")];
      out.buying_trigger       = String(p.buying_trigger|| "");
      // Keep legacy fields for frontend compatibility
      out.messaging_angle      = String(p.messaging_angle || p.buying_trigger || "");
      out.best_platform        = String(p.best_platform   || "");
      out.content_style        = String(p.content_style   || (Array.isArray(p.content_preferences) ? p.content_preferences.join("; ") : ""));
      return out;
    });
    while (personas.length < 3) {
      personas.push({ persona_name:"", description:"", motivations:[], pain_points:[], behavior:"", content_preferences:[], buying_trigger:"", messaging_angle:"", best_platform:"", content_style:"" });
    }

    return res.json({ personas });

  } catch (err) {
    console.error("[audience-targeting] Error:", err);
    return res.status(500).json({ error: "Audience targeting generation failed. Please try again." });
  }
});

module.exports = router;
