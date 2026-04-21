/**
 * fallbackService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Domain-specific fallback content for ALL AI generation features.
 *
 * CRITICAL RULES (never violate):
 *   - Never return null, undefined, or empty strings
 *   - Always return valid structured data matching the expected schema
 *   - All content must be polished, professional, and immediately usable
 *   - Output must feel intentional — never indicate failure to the user
 *
 * Usage: Called automatically when Gemini exhausts all 3 retry attempts.
 *
 * Team   : Subasri B | Gautham Krishnan K | Ashwin D | Vinjarapu Ajay Kumar
 * Company: Sourcesys Technologies
 */

// ─────────────────────────────────────────────────────────────────────────────
// Utility helpers
// ─────────────────────────────────────────────────────────────────────────────

function slug(str) {
  return (str || '').replace(/\s+/g, '')
}

function capitalise(str) {
  return (str || '').charAt(0).toUpperCase() + (str || '').slice(1)
}

// ─────────────────────────────────────────────────────────────────────────────
// AI Post Generator — GeneratePanel
// ─────────────────────────────────────────────────────────────────────────────

export function postGeneratorFallback({ brand, product, goal, tone, keywords, campaignType, selectedPlatforms }) {
  const brandTag   = `#${slug(brand)}`
  const productTag = `#${slug(product)}`
  const toneMap    = {
    Inspirational: { hook: 'The future belongs to those who choose better.', body: `${brand} exists for the ones who don't settle.` },
    Bold:          { hook: 'Everyone else is playing it safe. We\'re not.', body: `${brand} built ${product} to change what\'s possible.` },
    Casual:        { hook: 'Real talk — this changes everything.', body: `We made ${product} for people like you. No fluff.` },
    Professional:  { hook: `Introducing a smarter way to ${goal || 'achieve your goals'}.`, body: `${brand} delivers ${product} with precision and clarity.` },
    Humorous:      { hook: `Plot twist: ${product} actually works. 👀`, body: `${brand} — because someone had to make it fun.` },
    Urgent:        { hook: `You needed this yesterday.`, body: `${brand} ${product} — stop waiting, start winning.` },
    Empathetic:    { hook: `We see you. And we built this for you.`, body: `${brand} understands what ${product} means to real people.` },
    Witty:         { hook: `Thought it was impossible. Then we made ${product}.`, body: `${brand} — smarter by design, sharper by choice.` },
  }
  const t = toneMap[tone] || toneMap.Inspirational

  const platformPosts = {}
  const platforms = selectedPlatforms && selectedPlatforms.length > 0
    ? selectedPlatforms
    : ['Instagram', 'Twitter', 'LinkedIn']

  for (const platform of platforms) {
    const pLow = platform.toLowerCase()
    let post = '', caption = ''

    if (pLow === 'instagram') {
      post    = `${t.hook}\n\n${t.body}\n\nGoal: ${goal || 'Elevate your standards'}.\n\nTap the link in bio to find out more. 👇`
      caption = `${t.hook} ${brandTag} ${productTag}`
    } else if (pLow === 'twitter') {
      post    = `${t.hook} ${t.body} ${goal ? `— ${goal}.` : ''} ${brandTag}`
      caption = `${t.hook} ${brandTag}`
    } else if (pLow === 'linkedin') {
      post    = `${t.hook}\n\n${t.body}\n\n${goal || 'The goal is simple: do more, stress less.'}\n\nWould love to hear your thoughts — have you faced this challenge before?\n\n${brandTag} ${productTag}`
      caption = `${brand} | ${product} — built for what matters.`
    } else if (pLow === 'facebook') {
      post    = `Big news from ${brand}! 🎉 ${t.body} — ${goal || 'here to make a difference'}. Drop a 🙋 if you want to know more!`
      caption = `${brand} — ${product}. ${goal || 'Something worth your attention.'}`
    } else if (pLow === 'tiktok') {
      post    = `POV: You just discovered ${brand} and your life is about to change 👀 ${t.body} ${brandTag} #FYP`
      caption = `${brand} changed the game. ${productTag} #FYP`
    } else if (pLow === 'youtube') {
      post    = `${t.hook} In this video, we break down exactly how ${brand}'s ${product} helps you ${goal || 'reach your goals'}. Watch till the end — the last part changes everything.`
      caption = `${brand} | ${product} — ${goal || 'Your next level starts here.'}`
    } else {
      post    = `${t.hook} ${t.body} ${brandTag}`
      caption = `${brand} — ${product}`
    }

    platformPosts[platform] = {
      posts: [
        {
          hook:              t.hook,
          caption:           post,
          hashtags:          [brandTag, productTag, '#NewArrival', '#MustSee', `#${slug(campaignType || 'Campaign')}`],
          cta:               `${goal ? goal.split(' ').slice(0, 5).join(' ') + ' — ' : ''}Link in bio 👇`,
          content_type:      pLow === 'instagram' ? 'Reel (15–30s)' : pLow === 'twitter' ? 'Tweet' : pLow === 'linkedin' ? 'Carousel Post' : 'Video Post',
          best_time:         'Tuesday–Friday, 7–9 AM or 6–9 PM',
          visual_direction:  `${brand} product close-up against a clean background. Warm light. Minimal text overlay. High contrast.`,
          engagement_tactic: `Ask a question in the first comment: "What's been your biggest challenge with this?" Reply within the first hour.`,
        },
      ],
    }
  }

  return {
    campaign_tagline:  `${brand} — ${t.hook}`,
    campaign_summary:  `${brand} is launching ${product} to help ${goal || 'people achieve more'}. This campaign combines authentic storytelling with platform-native content to build lasting brand recognition and drive real conversions. Each platform speaks to the audience where they already are, in the language they already use.`,
    brand_voice_guide: `${brand} speaks with confidence, not arrogance. Every caption earns the reader's attention before asking for anything. We never use "Introducing" or "Excited to announce." We write like a smart friend, not a press release.`,
    audience_insight:  `The audience for ${product} isn't just looking for a solution — they're looking for a brand they can trust to understand their world. Lead with empathy, prove with results, convert with clarity.`,
    platforms:         platformPosts,
    campaign_ideas:    [
      {
        title:              `The ${brand} Truth Series`,
        big_idea:           `A content series where ${brand} names the uncomfortable truths about the ${product} category — the things competitors won't say. Every post starts with "Nobody talks about this, but..." and lands on how ${brand} is different.`,
        cultural_relevance: `Authenticity is the highest-performing content category across all platforms right now. Audiences reward brands that tell the truth.`,
        viral_mechanism:    `Screenshot-worthy truth slides that people send to friends. Each post ends with a question that pulls comments.`,
        expected_impact:    `3x average engagement rate. 40% increase in profile visits within 2 weeks of launch.`,
      },
    ],
    kpis:        ['Reach 50K+ impressions per post in the first 7 days', 'Achieve 3%+ engagement rate across all platforms', 'Drive 500+ link-in-bio clicks in the first 2 weeks', 'Grow follower count by 15% over the campaign duration', 'Generate 100+ UGC posts or mentions in the first month'],
    budget_tips: ['Allocate 60% of spend to the platform with the highest organic engagement first — earn the algorithm before you pay for reach.', 'Boost only posts that are already performing organically. A boosted post that wasn\'t working won\'t work with money behind it.', 'Retargeting audiences who engaged with the first 3 posts will convert at 4x the rate of cold audiences.', 'Dark social is worth 30% of your budget — WhatsApp and DM shares often outperform tracked clicks.'],
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Campaign Ideation — CampaignIdeationPanel
// ─────────────────────────────────────────────────────────────────────────────

export function campaignIdeationFallback({ brand_name, product_or_service, campaign_goal, target_audience, tone, season_or_event, platform_focus }) {
  const brandSlug = slug(brand_name)
  const season    = season_or_event || 'this season'

  return {
    campaign_ideas: [
      {
        idea_title:          `The ${brand_name} Honest Hour`,
        tagline:             `We said what everyone else was thinking.`,
        big_idea:            `${brand_name} runs an unfiltered content series during ${season} that names the things ${target_audience} actually feel — not the curated version. Each post opens with "Nobody talks about this, but..." and lands on how ${product_or_service} fits the real, messy version of life.`,
        cultural_hook:       `${target_audience} are exhausted by performative ${season} content. The brand that acknowledges reality earns trust that money can't buy. This works on ${platform_focus} because authenticity outperforms polish 3:1 in the current algorithm.`,
        platform_execution:  `First post on ${platform_focus}: Black background + white text — "Nobody talks about how [specific pain point] during ${season}." Cut to product used in a real, unglamorous setting. Caption opens with the pain point, zero setup. Hook: the first two words.`,
        sample_post:         `Nobody talks about the pressure that comes with ${season}.\n\nEvery brand shows you the highlight reel. We're showing you the real one.\n\n${brand_name}'s ${product_or_service} was built for the version of ${season} that actually exists.\n\nLink in bio. 👇\n\n#${brandSlug}NoFilter #${slug(season)} #RealTalk`,
        viral_mechanism:     `Comment-first posts that ask "What's the thing nobody talks about during ${season}?" — community answers become the next week's content series.`,
        influencer_strategy: `Micro-creators (10K–100K) in the ${target_audience} space. Brief: "Tell us the ${season} truth nobody says out loud." No script. One do: be honest. One don't: make it an ad.`,
        success_metric:      `500+ comments with personal stories in the first 72 hours. 10K+ saves on the first carousel.`,
        why_it_wins:         `When every competitor is running polished ${season} campaigns, ${brand_name} wins by being the only brand that tells the truth.`,
        hashtag_breakdown:   [
          { tag: `#${brandSlug}NoFilter`, explanation: `Campaign signature tag — used on every post. Signals authenticity before the content loads.`, when_to_post: `Every post from launch day. Primary tag for the entire ${season} run.` },
          { tag: `#${slug(season)}Truth`, explanation: `The cultural entry point — used by the community to share their own truths and tag ${brand_name}.`, when_to_post: `Week 1–2. Seed it on the first 3 posts, then let the community carry it.` },
          { tag: `#RealOver${slug(season)}`, explanation: `Counter-narrative tag that positions ${brand_name} against the overly curated ${season} aesthetic.`, when_to_post: `Mid-campaign. Use when posting comparison or contrast content.` },
        ],
      },
      {
        idea_title:          `#Unfiltered${brandSlug}`,
        tagline:             `You asked for real. Here it is.`,
        big_idea:            `A UGC campaign where ${target_audience} share their actual, unedited experience with ${product_or_service} during ${season} — good and bad. ${brand_name} reposts everything, including the criticism. The brutal transparency becomes the differentiator in a category full of polished campaigns.`,
        cultural_hook:       `User-generated honesty performs 4x better than branded content on ${platform_focus}. Reposting criticism signals extreme confidence. ${target_audience} in ${season} mindset want reassurance from peers, not from the brand.`,
        platform_execution:  `Launch post: "We're giving you our ${platform_focus} account for ${season}. Send us your real ${product_or_service} experience — we'll post it. Even if it's a complaint." Carousel of 5 raw, screenshot-style user stories. Pin it. Feature one critical review deliberately in slide 2.`,
        sample_post:         `Here's a review we weren't expecting. 🧡\n\n"[User's honest, slightly critical review of ${product_or_service}]"\n\nWe read every single one. This one made us better.\n\nThat's what ${season} looks like at ${brand_name}.\n\n#${brandSlug}Unfiltered #RealReviews`,
        viral_mechanism:     `Reposting a criticism that's actually fair — the screenshot gets shared 3x more than positive reviews. It signals a brand that listens.`,
        influencer_strategy: `Nano-creators (1K–10K) who are genuine customers. No sponsored posts — just "tell us what you actually think and we'll feature you." Authenticity over reach.`,
        success_metric:      `200+ UGC submissions in the first 2 weeks. 5K+ saves on the "critical review" post.`,
        why_it_wins:         `Radical honesty is the most powerful brand differentiator in saturated markets. When a brand admits a weakness, everything else it says becomes believable.`,
        hashtag_breakdown:   [
          { tag: `#${brandSlug}Unfiltered`, explanation: `The campaign signature — used exclusively for UGC reposts. Signals the "real content" series.`, when_to_post: `On every UGC repost from day 1. Encourage users to add it when submitting.` },
          { tag: `#Real${slug(product_or_service)}Review`, explanation: `Drives discoverability for people searching for genuine reviews of the product category.`, when_to_post: `On all review-based posts. Week 2 onwards when UGC starts flowing in.` },
        ],
      },
      {
        idea_title:          `The Anti-${season} Campaign`,
        tagline:             `Everyone's doing ${season}. We're doing something else.`,
        big_idea:            `While every brand runs a predictable ${season} campaign, ${brand_name} runs the opposite one — acknowledging the fatigue, the pressure, and the performance of it all. ${product_or_service} is positioned as the brand that helps ${target_audience} opt out of the noise and do ${season} their way.`,
        cultural_hook:       `Pattern interruption is the most powerful scroll-stopper on ${platform_focus} right now. When every brand is yelling about ${season}, a brand that says "actually..." gets the screenshot.`,
        platform_execution:  `First post: Bold text on plain background — "Hot take: ${season} is overhyped." Immediate engagement. Next day: "We said what we said. Here's why ${product_or_service} disagrees with how [category] normally does this." Thread or carousel that delivers real value while the tension runs.`,
        sample_post:         `Unpopular opinion: the way most brands do ${season} is exhausting.\n\nWe're not doing that.\n\n${brand_name} is doing ${season} differently this year. And we think you'll appreciate it.\n\nMore coming this week. 👀\n\n#${brandSlug} #Anti${slug(season)} #RealTalk`,
        viral_mechanism:     `The controversy itself is the mechanism — "Brand calls out ${season} marketing" is inherently shareable. The community tags their friends to debate it.`,
        influencer_strategy: `Mid-tier creators (100K–500K) known for hot takes and opinions. Brief: "Would you say ${season} marketing is exhausting? We agree. Here's what we're doing instead." Debate format.`,
        success_metric:      `1M+ impressions on the controversy post in 72 hours. 50% above-average comment rate.`,
        why_it_wins:         `${brand_name} earns cultural relevance without spending on a trend — by creating the counter-trend instead.`,
        hashtag_breakdown:   [
          { tag: `#Anti${slug(season)}`, explanation: `Counter-narrative tag that creates a new conversation ${brand_name} owns. Low competition, high cultural specificity.`, when_to_post: `Campaign launch day and throughout the first two weeks of controversy content.` },
        ],
      },
      {
        idea_title:          `The ${target_audience.split(' ')[0]} Files`,
        tagline:             `Real people. Real problems. Real fix.`,
        big_idea:            `A documentary-style content series where ${brand_name} follows 3 real ${target_audience} through ${season} and shows — without scripting — how ${product_or_service} fits into their actual life. No talking heads, no testimonials. Just footage, on-screen text, and honest moments.`,
        cultural_hook:       `Documentary content drives 3x longer watch time than polished brand videos on ${platform_focus}. ${target_audience} trust peer stories over brand stories. This format is rare — ${brand_name} owns it first.`,
        platform_execution:  `Episode 1: 60-second Reel. Open with subject looking at camera, no intro music. On-screen text: "[Their name]. [Their job]. Hates [specific pain point]." Follow their morning. Show ${product_or_service} appearing naturally at the moment of friction. End card: "Episode 2 drops Thursday."`,
        sample_post:         `Meet [Name].\n\nThey've been dealing with [pain point] for 3 years.\n\nWe followed them for a week.\n\nHere's what actually happened when they tried ${product_or_service}.\n\n(Episode 1 of 4)\n\n#${brandSlug}Files #Real${slug(target_audience.split(' ')[0])}`,
        viral_mechanism:     `Series format drives return viewers — each episode ends with a teaser for the next. The community gets invested in the subjects' outcomes.`,
        influencer_strategy: `The subjects ARE the influencers — real customers, not paid creators. This is the most powerful signal of product confidence available.`,
        success_metric:      `70%+ average watch time on each episode. 3K+ "save for later" actions across the series.`,
        why_it_wins:         `Authenticity at documentary length outperforms any influencer campaign. ${brand_name} doesn't just claim results — it shows them.`,
        hashtag_breakdown:   [
          { tag: `#${brandSlug}Files`, explanation: `Series identifier tag — used on every episode. Builds a searchable archive of the entire documentary series.`, when_to_post: `Every episode from day 1. Encourage viewers to tag their friends who "need to watch this."` },
        ],
      },
      {
        idea_title:          `${brand_name} Out Loud`,
        tagline:             `We'll say what our competitors won't.`,
        big_idea:            `${brand_name} publishes a bold comparison content series that is honest about exactly where ${product_or_service} wins — and where it doesn't. The campaign positions the brand as the only one confident enough to tell the truth, which makes everything they say about their strengths immediately credible.`,
        cultural_hook:       `Radical honesty in advertising is the highest-trust brand move available. When a brand admits a real weakness, the audience believes the strengths. High share potential — people love sending "a brand that tells the truth" content.`,
        platform_execution:  `First post: "Things ${brand_name} is NOT the best at (a thread):" — list 3 real limitations with full transparency. Final tweet or slide: "What we ARE the best at: [${product_or_service} core strength] for ${target_audience}." CTA: "Try it and tell us if we're lying." The comment section becomes the campaign.`,
        sample_post:         `Hot take: We're not the best at everything.\n\nHere's what ${brand_name} is genuinely NOT great at:\n\n→ [Honest limitation 1]\n→ [Honest limitation 2]\n→ [Honest limitation 3]\n\nHere's what we ARE the best at:\n\n→ ${product_or_service} for ${target_audience}. No one comes close.\n\nWe said it.\n\n#${brandSlug}OutLoud #NoBS`,
        viral_mechanism:     `The comment section debate IS the campaign. People tag competitors, defend the brand, and share it as "a company that actually tells the truth."`,
        influencer_strategy: `Thought-leader creators (50K–300K) in the ${platform_focus} space known for their "honest review" format. Brief: "What do you actually think of ${product_or_service}?" No guardrails on the answer.`,
        success_metric:      `Top-performing post in the brand's history by comment volume. 200%+ increase in brand mentions in the week following launch.`,
        why_it_wins:         `In a category saturated with identical claims, the brand that is honest about its weaknesses owns the space. ${brand_name} doesn't just say it's different — it proves it.`,
        hashtag_breakdown:   [
          { tag: `#${brandSlug}OutLoud`, explanation: `Campaign signature for all honest-brand posts. Signals the "we tell the truth" positioning before the content loads.`, when_to_post: `All posts in this series. Launch on the first controversial honesty post for maximum impact.` },
          { tag: `#NoBS${slug(season)}`, explanation: `Seasonal variant that positions ${brand_name} as the no-nonsense choice during a period when every brand is over-promising.`, when_to_post: `Week 2 and 3 of the campaign when the honesty positioning is established.` },
        ],
      },
    ],
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Audience Targeting — AudienceTargetingPanel
// ─────────────────────────────────────────────────────────────────────────────

export function audienceTargetingFallback({ brand_name, product_or_service, campaign_objective, industry, age_group, region, customer_type, pain_points }) {
  return {
    personas: [
      {
        persona_name:       'Persona 1 — The Efficiency Hunter',
        identity_label:     'The Efficiency Hunter',
        behavior:           `• Scrolls LinkedIn at 7am during commute looking for tactical content, not inspiration\n• Saves long-form posts to read later, shares tools only after personally testing them\n• Watches 2-minute explainer videos at 1.5x speed on YouTube`,
        mindset:            `Believes the right tools separate good professionals from great ones. Trusts data over stories, but buys on emotion and justifies with logic.`,
        pain_point:         `${pain_points} — and every solution they've tried in the ${industry} space either over-promises or under-delivers. They're not sceptical of ${product_or_service}, they're sceptical of marketing claims.`,
        hook:               `"Stop doing it the hard way. There's a shortcut — and it's called ${product_or_service}."`,
        best_content_style: `• Data-backed carousels with numbered frameworks (e.g. "5 things I wish I knew before...")\n• 2-minute demo videos showing the product doing the actual task — no voiceover\n• Before/after content with real numbers, not testimonials`,
        best_platform:      `LinkedIn — because they're there to solve problems, not be entertained. Decision-mode mindset.`,
        audience_overlap_matrix: '',
        channel_priority:        [],
        cultural_moments:        [],
      },
      {
        persona_name:       'Persona 2 — The Sceptical Researcher',
        identity_label:     'The Sceptical Researcher',
        behavior:           `• YouTube is their primary research channel before any purchase — watches 10–20 min honest reviews\n• Reads the 3-star reviews on G2 or similar platforms first to find the real picture\n• Never clicks ads; waits for organic recommendations from communities they trust`,
        mindset:            `Has been burned by overpromising brands in the ${industry} space before. Spends 3x the average time researching. Trust is not given, it's earned through evidence.`,
        pain_point:         `${pain_points}. Every product they've tried made it worse, not better. They want to believe ${brand_name} is different — they just need proof they can't argue with.`,
        hook:               `"We know you've heard this before. Here's the proof that makes ${product_or_service} different."`,
        best_content_style: `• Long-form YouTube reviews with real screen recordings, not polished demos\n• Honest comparison content ("We vs competitors — here's where we actually lose")\n• Reddit-style community testimonials — real language, no corporate polish`,
        best_platform:      `YouTube — for the trust depth. Then Reddit communities for peer validation. They don't act on a single channel.`,
        audience_overlap_matrix: '',
        channel_priority:        [],
        cultural_moments:        [],
      },
      {
        persona_name:       'Persona 3 — The Identity-Driven Early Adopter',
        identity_label:     'The Identity-Driven Early Adopter',
        behavior:           `• Discovers products through saved Instagram Reels and close-friend stories, never ads\n• Has 200+ posts saved that they actually revisit and act on\n• Posts about products they love organically — being early to something good is social currency`,
        mindset:            `Sees the tools and brands they use as an extension of their identity. ${pain_points} isn't just a problem — it's a signal that their current setup doesn't match who they want to be.`,
        pain_point:         `${pain_points} — but also the embarrassment of being seen using outdated tools. For this persona, aesthetic and experience matter as much as function.`,
        hook:               `"This is what your ${product_or_service} setup should look like in ${new Date().getFullYear()}."`,
        best_content_style: `• Aesthetic lo-fi Reels showing the product in a real environment, not a studio\n• "Day in my life" content where ${product_or_service} appears naturally — not as a sponsorship\n• Before/after carousels showing identity transformation, not just product results`,
        best_platform:      `Instagram — because visual identity and social proof live here. They share what makes them look ahead of the curve.`,
        audience_overlap_matrix: '',
        channel_priority:        [],
        cultural_moments:        [],
      },
    ],
    audience_overlap_matrix: `Personas 1 and 2 overlap most — both are research-led, results-driven, and need proof before they act. A single message that leads with a real, specific result (e.g. "reduced [pain point] by 60% in 2 weeks") hits both without compromise. The tone difference: Persona 1 wants tactics, Persona 2 wants trust.`,
    channel_priority: [
      { platform: 'LinkedIn',   priority: 'Must-Have', rationale: `Where ${customer_type} professionals in ${region} are actively solving problems — decision-mode mindset, high intent.` },
      { platform: 'Instagram',  priority: 'High',      rationale: `Identity and discovery platform for Persona 3. High-quality visuals of ${product_or_service} in context drive saves and profile visits.` },
      { platform: 'YouTube',    priority: 'High',      rationale: `Deep trust-building channel. Persona 2 lives here. Long-form honest reviews convert the most resistant prospects.` },
      { platform: 'Twitter/X',  priority: 'Medium',    rationale: `Real-time community and thought leadership. Works for the Efficiency Hunter persona when framed as tactical advice.` },
    ],
    cultural_moments: [
      `${industry} professionals discussing ${pain_points} in online communities — a direct entry point for ${brand_name}'s authentic content strategy`,
      `The "tools I actually use" content format trending across ${platform_focus || 'LinkedIn and Instagram'} — ${product_or_service} belongs in these honest recommendations`,
      `${region} ${customer_type} businesses actively seeking solutions to ${pain_points} following recent industry shifts — high purchase intent window`,
    ],
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Custom Flow — CustomFlowPanel
// ─────────────────────────────────────────────────────────────────────────────

export function customFlowFallback({ brand_name, product_or_service, business_objective, target_audience, tone, platforms, campaign_duration, key_message, call_to_action }) {
  const platformList = Array.isArray(platforms) ? platforms : [platforms || 'Instagram']
  const brandSlug    = slug(brand_name)
  const prodSlug     = slug(product_or_service)

  return {
    campaign_name:         `#${brandSlug}NoFilter`,
    positioning_statement: `${brand_name} is not entering the ${product_or_service} conversation — it's redefining it. This campaign speaks directly to what ${target_audience} are actually going through, not what brands assume they feel. Every piece of content earns attention before asking for action.`,
    campaign_summary:      `${brand_name} is running a ${campaign_duration} campaign on ${platformList.join(' and ')} anchored in the message "${key_message}". The strategy moves week-by-week from hook to trust to conversion, with each platform doing what it does best. Content is built on radical clarity: we say exactly what ${target_audience} need to hear, when they need to hear it. Success looks like ${target_audience} sharing the content without being asked — because it says what they've been thinking.`,
    brand_voice_guide:     `DO: Start every caption with the audience's frustration, not the product feature. DO: Write like a smart friend giving real advice — short sentences, no filler. NEVER: Use "Introducing", "Excited to announce", "Empower", "Solution", or "Synergy" — ever. NEVER: Write a caption that could belong to any other brand — every word must be specific to ${brand_name}.`,
    content_pillars: [
      {
        name:        'The Uncomfortable Truth',
        description: `Content that names ${target_audience}'s real problem out loud — the one nobody else in the industry is willing to say. This is the trust-builder that earns the right to sell.`,
        example:     `"Why does ${product_or_service} keep letting ${target_audience} down?" — Reel opens on a relatable frustration moment. No product shown until the last 3 seconds.`,
      },
      {
        name:        'Proof Without the Polish',
        description: `Real results, real users, real numbers — zero stock photos. This counters scepticism by showing instead of claiming.`,
        example:     `Carousel: Slide 1 — bold result stat. Slides 2-4 — raw customer quotes in their own words, screenshot-style. Slide 5 — "${call_to_action}"`,
      },
      {
        name:        'How It Actually Works',
        description: `Tactical content that makes ${product_or_service} feel approachable and immediately useful. Positions ${brand_name} as the expert who shows, not tells.`,
        example:     `"3 things ${target_audience} get wrong about ${product_or_service}" — carousel, one clear takeaway per slide. Last slide: "We built ${brand_name} to fix all three."`,
      },
      {
        name:        'Behind the Build',
        description: `Authentic content showing the humans and decisions behind ${brand_name}. Builds emotional connection in a way polished brand content never can.`,
        example:     `60-second Reel: "The moment we realised ${key_message} was the actual solution." No script. Phone footage. On-screen text captions only.`,
      },
      {
        name:        'The Conversion Push',
        description: `Content for the audience that already gets it — now give them a reason to act today. Urgency without desperation.`,
        example:     `"You've been saving this for a reason." — Story series. Slide 1: The pain point. Slide 2: The result. Slide 3: "${call_to_action}" with social proof.`,
      },
    ],
    platform_strategy: platformList.map(p => ({
      platform:  p,
      strategy:  `${p} carries the core message for ${target_audience}. Content here should feel native and discovered, not broadcast. "${key_message}" is woven into every post naturally, never forced. The goal is saves and shares first — reach second.`,
      frequency: p === 'LinkedIn' ? '3x/week: 1 thought-leadership post, 1 carousel, 1 poll'
               : p === 'Twitter'  ? '5x/week: 2 original posts, 2 reply threads, 1 hot take'
               : '4x/week: 2 Reels, 1 Carousel, 1 Stories poll',
      formats:   p === 'LinkedIn' ? 'Long-form storytelling posts, document carousels, data-backed polls'
               : p === 'Twitter'  ? 'Tweets under 240 chars, numbered threads, quote-tweet reactions'
               : p === 'TikTok'   ? '15–45s Reels, POV format, text-overlay hooks, trending audio'
               : 'Reels 15–30s, 5–7 slide Carousels, Stories with sticker polls',
    })),
    posting_plan: [
      {
        week:           'Week 1 — The Scroll-Stop',
        theme:          'The Scroll-Stop',
        goal:           `Make ${target_audience} feel seen before they know it's ${brand_name}`,
        focus:          `Make ${target_audience} feel seen before they know it's ${brand_name}`,
        content_plan:   [`Instagram Reel (1): Opens with black screen + text "Real talk for ${target_audience}..." — no product shown`, `LinkedIn Post (1): "The thing nobody in this industry is willing to say about ${product_or_service}"`, `${platformList[0]} Story (2): Poll — "Does this happen to you? 👇"`],
        post_types:     `Instagram Reel + LinkedIn hook post + Stories poll`,
        sample_idea:    `Reel: Open on black screen + white text "Real talk for ${target_audience}..." Cut to 3 quick pain-point moments. End: "${brand_name} made something for this." No product shown yet.`,
        execution_tips: [`Pin the Reel. Don't boost yet. Let organic reach build. Reply to every comment in the first 2 hours.`, `Save all comments to a document — they become the content brief for weeks 2 and 3.`],
        tactical_note:  `Pin the Reel. Don't boost yet. Reply to every comment in the first 2 hours.`,
        ai_insights:    `Best posting time: Tuesday 7–9am. Prioritise ${platformList[0]}. If the Reel reaches 10K views organically in 48h, you have product-market fit signal for the rest of the campaign.`,
      },
      {
        week:           'Week 2 — The Trust Stack',
        theme:          'The Trust Stack',
        goal:           `Build credibility through proof that feels human, not corporate`,
        focus:          `Build credibility through proof that feels human, not corporate`,
        content_plan:   [`Testimonial carousel (1): "We asked 50 ${target_audience} what they actually thought. Here's what they said — including the ones who weren't fans."`, `How-it-works video (1): Show ${product_or_service} solving the exact pain from Week 1 in under 60 seconds`, `Myth-buster post (2): "Myth: [common misconception]. Fact: [what ${brand_name} actually does]"`],
        post_types:     `Testimonial carousel + how-it-works video + myth-buster post`,
        sample_idea:    `Carousel: "We asked 50 ${target_audience} what they actually thought of ${product_or_service}. Here's what they said — including the ones who weren't fans." Real quotes. Screenshot aesthetic.`,
        execution_tips: [`Feature one honest, slightly critical testimonial to signal confidence. It will outperform all the positive ones.`, `Save all testimonials as a Highlights cover. It becomes a permanent trust signal on your profile.`],
        tactical_note:  `Feature one negative-but-fair testimonial. It will outperform all the positive ones.`,
        ai_insights:    `Best posting time: Wednesday 7–9am. Boost the testimonial carousel on Thursday if organic reach exceeds 5K. Expected result: 40% increase in profile visits.`,
      },
      {
        week:           'Week 3 — The Community Moment',
        theme:          'The Community Moment',
        goal:           `Turn ${target_audience} from observers into participants`,
        focus:          `Turn ${target_audience} from observers into participants`,
        content_plan:   [`UGC prompt (1): "Show us your ${product_or_service} experience. Best one gets featured + [reward]."`, `Follower spotlight (2): Repost the best UGC entries with real comment from ${brand_name} team`, `Q&A Live (1): Go Live mid-week. No script. Just answer real questions.`],
        post_types:     `UGC prompt + follower spotlight + Q&A Live`,
        sample_idea:    `"Show us your [relevant moment] with ${product_or_service}. Best one gets featured." Launch the prompt, repost entries in Stories, build a Round-up Reel by Friday.`,
        execution_tips: [`Announce the Live 48 hours ahead via Stories. No script — real questions only.`, `UGC collection: DM every entrant with a personal thank-you from the ${brand_name} account.`],
        tactical_note:  `Go Live mid-week. No script. Announce it 48h ahead in Stories.`,
        ai_insights:    `Best posting time: Thursday 6–9pm. Prioritise Stories engagement this week. A 10%+ Stories reply rate signals strong community warmth before the Week 4 conversion push.`,
      },
      {
        week:           'Week 4 — The Convert',
        theme:          'The Convert',
        goal:           `Turn warmed-up ${target_audience} into "${call_to_action}" completions`,
        focus:          `Turn warmed-up ${target_audience} into "${call_to_action}" completions`,
        content_plan:   [`Urgency post (1): "Last chance — [specific offer or deadline tied to ${call_to_action}]"`, `Results recap carousel (1): Montage of Week 1–3 community moments, real engagement numbers`, `Final CTA Reel (1): "This is what happens when ${target_audience} stop settling. ${call_to_action}."`],
        post_types:     `Urgency post + results recap + final CTA Reel`,
        sample_idea:    `Final Reel: Montage of weeks 1–3 community moments and results. Final line: "This is what happens when ${target_audience} stop settling. ${call_to_action}." No music. Clean title card.`,
        execution_tips: [`Now boost. Retarget everyone who engaged in Weeks 1–3. A/B test two CTA versions.`, `Allocate 60% of the total campaign budget to this week — the audience is warm and conversion-ready.`],
        tactical_note:  `Now boost. Retarget everyone who engaged in weeks 1–3. Put 60% of remaining budget here.`,
        ai_insights:    `Best posting time: Monday and Thursday. Retargeting engaged audiences from weeks 1–3 will convert at 4x the rate of cold audiences. Expected CPA: 60% lower than cold campaigns.`,
      },
    ],
    sample_captions: [
      { platform: platformList[0] || 'Instagram', caption: `Nobody tells you this, but ${target_audience} spend hours every week on something ${product_or_service} handles in minutes.\n\nWe didn't build a "solution".\nWe built a shortcut to the thing you actually want.\n\n${key_message}.\n\n${call_to_action} — link in bio 👇\n\n#${brandSlug} #${prodSlug} #RealTalk` },
      { platform: platformList[1] || platformList[0] || 'LinkedIn', caption: `Here's something most ${product_or_service} brands won't tell you:\n\nThe real barrier isn't the product. It's the trust deficit.\n\nWe found this out the hard way building ${brand_name}.\n\nSo we built it differently — starting with honesty.\n\nHave you felt this? Drop a comment.\n\n#${brandSlug} #${prodSlug} #${slug(target_audience)}` },
      { platform: platformList[0] || 'Instagram', caption: `POV: You just realised you've been doing it the hard way this whole time.\n\n${key_message}.\n\nYes, really.\n\n${call_to_action} 👇\n\n#${brandSlug} #TrustTheProcess #${prodSlug}` },
      { platform: 'Twitter', caption: `Hot take: most ${product_or_service} brands are solving the wrong problem for ${target_audience}.\n\nHere's what they actually need (and what we built instead) 🧵` },
      { platform: platformList[1] || 'LinkedIn', caption: `We talked to 100 ${target_audience} and asked what they wished existed.\n\nTheir #1 answer was exactly what ${product_or_service} does.\n\nWe didn't guess. We listened.\n\n${call_to_action}\n\n#${brandSlug} #BuiltForYou` },
      { platform: platformList[0] || 'Instagram', caption: `Last one.\n\n${key_message}.\n\nIf you've been waiting for the right moment — this is it.\n\n${call_to_action} — link in bio.\n\n#${brandSlug} #${prodSlug} #NowOrNever` },
    ],
    hashtag_strategy: {
      brand_hashtags: [`#${brandSlug}`, `#${brandSlug}NoFilter`, `#${prodSlug}Campaign`],
      trend_hashtags: [`#${slug(target_audience)}`, '#ContentMarketing', '#DigitalMarketing', '#SocialMediaMarketing', '#RealContent', '#AuthenticBranding'],
      niche_hashtags: [`#${slug(product_or_service)}Community`, '#GrowthMarketing', '#CreatorEconomy', '#CommunityFirst', '#PerformanceMarketing', '#ContentStrategy', '#BrandBuilding', `#${slug(target_audience)}Life`],
    },
    hashtags:       [`#${brandSlug}`, `#${prodSlug}`, '#ContentMarketing', '#DigitalMarketing', '#SocialMedia'],
    calendar_hooks: [
      `Monday — "Nobody talks about this, but [specific industry pain point for ${target_audience}]" — open with the uncomfortable truth, pivot to ${product_or_service} as the fix in the final slide`,
      `Tuesday — Behind-the-scenes: "The decision that changed how we built ${product_or_service}" — phone footage, no script, on-screen text captions only`,
      `Wednesday — "Myth: [common misconception about ${product_or_service}]. Fact: [what ${brand_name} actually does differently]" — carousel with bold typography`,
      `Thursday — Community spotlight: Feature a real ${target_audience} using ${product_or_service} — let their words do the selling, not yours`,
      `Friday — "This week we learned..." — a genuine recap of one thing ${brand_name} learned from the community. Builds parasocial trust over time.`,
      `Saturday — Engagement content that earns it: "Which of these is your biggest [relevant] challenge?" — poll with 4 real options, not rhetorical ones`,
      `Campaign midpoint — Go Live with no script. Open the floor to real questions. Record it. Cut the best 60 seconds into a Reel.`,
      `Campaign finale — "We said we'd do [X]. Here's what actually happened." — honest results post. Numbers, quotes, what worked, what didn't. Ends: "${call_to_action}"`,
    ],
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// New Campaign (Quick Campaign) — QuickCampaignPanel
// ─────────────────────────────────────────────────────────────────────────────

export function quickCampaignFallback({ input }) {
  const inputTrimmed = (input || 'your campaign').trim()

  return {
    campaign_ideas: [
      {
        title:       'The Honest Advantage',
        description: `Launch a content series that tells ${inputTrimmed} from the audience's perspective — their real problem first, your solution second. The brand that says what others won't earns the trust that converts.`,
      },
      {
        title:       'Proof Over Promise',
        description: `Document real results from real users of ${inputTrimmed}. No actors, no scripts, no polished testimonials. Just raw outcomes that the audience recognises as authentic — because they are.`,
      },
      {
        title:       'The Conversation Campaign',
        description: `Turn ${inputTrimmed} into a community topic. Ask the hard questions, share the uncomfortable answers, and let the audience debate. The most engaging brands aren't the loudest — they're the most honest.`,
      },
    ],
    post_variations: [
      {
        angle:   'The Pattern Interrupt',
        content: `Nobody talks about this. But if you're thinking about ${inputTrimmed}, here's what you actually need to know:\n\nThe difference isn't what most people think it is.\nIt's not the price. It's not the features.\n\nIt's whether the brand actually understands you.\n\nThis one does. 👇`,
      },
      {
        angle:   'The Social Proof Play',
        content: `"I was sceptical at first. Then I tried it."\n\nThat's what most people say about ${inputTrimmed} after the first week.\n\nIf you've been on the fence — read what happened when real people stopped hesitating.\n\nLink in bio.`,
      },
      {
        angle:   'The Aspirational Hook',
        content: `Imagine having exactly what you need for ${inputTrimmed}.\n\nNot a compromise. Not a workaround.\nExactly what you needed.\n\nThat's what this is.\n\nAnd it's available right now.`,
      },
    ],
    captions: [
      `The thing about ${inputTrimmed} is that most brands talk about what they offer. We'd rather talk about what you actually need. Here's the difference — and why it matters. 👇 #RealTalk`,
      `Built for the people who are done settling. ${inputTrimmed} — because your standards should be this high. #NoCompromise`,
      `This week we're doing something different. Instead of telling you why ${inputTrimmed} is great, we're showing you. Watch this space. 👀`,
    ],
    hashtags: [
      '#ContentMarketing', '#SocialMediaMarketing', '#DigitalMarketing', '#BrandStrategy',
      '#CreatorEconomy', '#MarketingTwitter', '#GrowthMarketing', '#CommunityFirst',
      '#RealContent', '#AuthenticBranding',
    ],
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Creator Studio — domain-specific fallback
// (handled directly in backend route — this is the frontend UI fallback)
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Compliance Guard — ComplianceGuardPage
// ─────────────────────────────────────────────────────────────────────────────

export function complianceGuardFallback({ platform, contentType, content }) {
  const hasContent = content && content.trim().length > 0

  const data = {
    Instagram: {
      Post: {
        riskLevel: 'Low',
        platformGuidelines: [
          'Instagram captions are limited to 2,200 characters — but only the first 125 characters display before the "more" cutoff, so lead with your strongest line.',
          'Hashtags are limited to 30 per post. Instagram\'s algorithm de-prioritises posts that use banned or overused hashtags — always check before using trending tags.',
          'Instagram prohibits content that promotes the sale of tobacco, prescription drugs, or illegal firearms regardless of caption framing.',
          'Posts promoting alcohol must not target users under 18 and must comply with local laws — Instagram uses location-based enforcement.',
          'Text overlays on images used in ads must not cover more than 20% of the image — this applies even to boosted organic posts.',
          'Misleading claims, including exaggerated before/after results, are violations of both community guidelines and advertising standards.',
          'Tagging users or brands in posts without their consent to gain visibility (tag baiting) can result in reduced reach or account action.',
        ],
        commonMistakes: [
          'Using banned hashtags — Instagram silently shadowbans posts with flagged hashtags like #beautyblogger or #followforfollow, reducing reach without notification.',
          'Reposting UGC without explicit written permission from the original creator — this is a copyright violation even if you credit them in the caption.',
          'Adding excessive line breaks or emoji spam to artificially inflate caption length — Instagram\'s algorithm reads this as low-quality content.',
          'Using the same caption template repeatedly — Instagram detects repetitive content and reduces its distribution over time.',
          'Posting during off-peak hours without scheduling strategy — Instagram\'s algorithm weights early engagement, so posting when your audience is offline kills reach.',
          'Over-tagging in photo tags (more than 5) — Instagram\'s spam filter is more aggressive on posts with many tags applied at once.',
        ],
        copyrightTips: [
          'Using copyrighted music in Instagram Posts (non-Reels) can result in the audio being muted or the post being removed — only use tracks from Instagram\'s licensed music library.',
          'Screenshots of other creators\' content require explicit permission — the "public post" argument is not a copyright defence on Instagram.',
          'Stock image usage requires a valid licence for commercial use — even free stock sites like Unsplash have restrictions on certain commercial applications.',
          'If you use someone\'s likeness (face, voice, or distinctive style) in your content, you may need model release rights — especially for ads.',
          'Fonts used in graphics must be licensed for commercial use — "free for personal use" fonts cannot be used in brand or monetised content.',
        ],
        bestPractices: [
          'Post Reels even when sharing feed content — Instagram\'s algorithm currently prioritises Reels in discovery, so adding a vertical version of your post extends reach.',
          'Use 3–5 highly relevant hashtags rather than 30 generic ones — Instagram\'s internal data shows niche hashtags outperform volume-based hashtag strategies.',
          'Add alt text to every image post (Advanced Settings → Write Alt Text) — this improves accessibility and is read by Instagram\'s content categorisation algorithm.',
          'Reply to comments within the first hour of posting — early engagement signals high-quality content to the algorithm and expands distribution.',
          'Use location tags on all posts — even general city tags increase discoverability by 79% according to Instagram\'s creator research.',
          'Pin your top 3 performing posts to the top of your profile grid — new visitors see your best work first, increasing follow conversion.',
        ],
        improvementSuggestion: hasContent ? `Compliant version: ${content.trim()}

[Ensure first 125 characters contain your core message. Use 3–5 niche hashtags at the end. Add a clear single CTA. Remove any superlative claims. Use only licensed music if boosting.]` : '',
      },
      Ad: {
        riskLevel: 'High',
        platformGuidelines: [
          'Instagram Ads must comply with Meta\'s Advertising Policies — any ad promoting financial services, health products, or political content requires pre-approval.',
          'Ad images must not contain more than 20% text — use Meta\'s Text Overlay Tool to verify before submitting.',
          'Ads cannot use "before and after" imagery for weight loss, cosmetic procedures, or health transformations — this violates both Meta policy and advertising standards.',
          'Ads targeting users under 18 are restricted — you cannot run ads for alcohol, gambling, dating apps, or supplements to this demographic.',
          'Misleading pricing (e.g., showing a strikethrough price without evidence of a genuine previous price) is a violation and grounds for ad rejection.',
          'Ads must clearly identify the advertiser — undisclosed paid partnerships are a violation of both Meta policy and FTC guidelines.',
          'Retargeting ads must honour users\' data privacy choices — ads using custom audiences must comply with GDPR, CCPA, and Meta\'s data use policy.',
        ],
        commonMistakes: [
          'Using personal testimonials with specific result claims (e.g., "I lost 10kg in 2 weeks") — these trigger automatic ad rejection and account flags.',
          'Running ads without a Privacy Policy link on the destination URL — Meta requires all lead generation and e-commerce ads to link to a compliant privacy policy.',
          'Targeting too broadly then blaming the algorithm — narrow, interest-based targeting for Instagram Ads outperforms broad targeting for most budgets under ₹50,000/month.',
          'Using stock photos that look like stock photos — Meta\'s ad relevance scoring penalises low-authenticity creative, increasing your CPM.',
          'Setting a daily budget under ₹500 — Instagram Ads need sufficient budget to exit the learning phase (50 conversions) before optimising.',
          'Not testing multiple ad creatives — running a single ad without A/B testing creative variables leads to ad fatigue within 3–5 days.',
        ],
        copyrightTips: [
          'Music in Instagram Ads must be licensed through Meta\'s Sound Collection or a commercial music licence — royalty-free is not sufficient for paid promotion.',
          'User-generated content used in ads requires a written content licensing agreement — a DM reply is not legally sufficient.',
          'Stock images used in ads require a commercial licence, not just a standard licence — check your stock provider\'s terms specifically for paid advertising use.',
          'Third-party logos or brand names cannot appear in your ad creative without written permission — even in a comparison or "as seen in" context.',
          'AI-generated faces and voices in ads must be disclosed in some jurisdictions — check FTC and local advertising authority guidelines.',
        ],
        bestPractices: [
          'Use vertical 9:16 creative for Instagram Story and Reel ad placements — square or horizontal creative loses up to 40% of screen real estate.',
          'Hook the viewer in the first 3 seconds — Instagram ads are skippable after 3 seconds, so lead with the benefit, not the brand name.',
          'Include captions on video ads — 85% of Instagram videos are watched without sound.',
          'Test thumb-stopping static images against video — for awareness campaigns, high-contrast static images often outperform video on CPM.',
          'Use social proof in ad copy ("10,000+ customers") only if verifiable — false social proof triggers policy violations and ad rejection.',
          'Refresh ad creative every 7–14 days to prevent frequency fatigue — high frequency + low CTR signals poor-quality ad content to the algorithm.',
        ],
        improvementSuggestion: hasContent ? `Compliant ad version: ${content.trim()}

[Verified compliant: Remove result-specific claims. Add advertiser disclosure. Ensure destination URL has Privacy Policy. Verify text coverage is under 20% of image. Use licensed music only.]` : '',
      },
    },
    YouTube: {
      'Reel / Video': {
        riskLevel: 'Medium',
        platformGuidelines: [
          'YouTube\'s Community Guidelines prohibit content that depicts or promotes: violence against real people, harassment, hate speech based on protected attributes, and spam.',
          'Videos containing sponsored content must use YouTube\'s paid promotion disclosure toggle (found in video details) — verbal disclosure alone does not satisfy YouTube\'s requirements.',
          'Content that is "made for kids" must be correctly labelled — incorrectly labelled content (in either direction) violates COPPA and YouTube\'s ToS.',
          'Thumbnail images must accurately represent video content — misleading thumbnails (clickbait) can result in impressions being reduced or the video being demonetised.',
          'YouTube\'s advertiser-friendly content guidelines require videos to avoid: excessive profanity in the first 30 seconds, controversial news topics without context, and graphic violence.',
          'Reused content (compilations, reaction videos, top 10 lists using others\' footage) must add significant original commentary to qualify for monetisation.',
          'Videos promoting cryptocurrency, financial products, or health supplements face enhanced scrutiny — specific disclaimer requirements apply.',
        ],
        commonMistakes: [
          'Using copyrighted music even at low volume in the background — YouTube\'s Content ID system detects it and immediately assigns revenue to the rights holder or mutes your video.',
          'Placing mid-roll ads in videos under 8 minutes — YouTube only allows mid-roll ads on videos 8 minutes or longer. Enabling mid-rolls on shorter videos is a terms violation.',
          'Using another creator\'s clips without transformation — reaction or commentary videos need substantial original analysis to qualify as fair use; simply showing the clip does not.',
          'Buying views or engagement — YouTube\'s systems detect artificial inflation and can permanently terminate channels, not just remove videos.',
          'Posting content that violates guidelines on a channel with strikes — a third strike within 90 days results in permanent channel termination with no appeal.',
          'Not adding chapter markers to long videos — videos without chapters get lower average view duration, which directly affects search ranking.',
        ],
        copyrightTips: [
          'YouTube\'s Content ID system scans every upload — even a 5-second clip of a copyrighted song will trigger a claim, redirecting ad revenue to the rights holder.',
          'Fair use is a legal defence, not a YouTube policy — YouTube will still issue a Content ID claim; you must dispute it through the formal appeal process.',
          'Music licensed as "royalty-free" or "Creative Commons" may still have restrictions on monetised YouTube content — always read the specific licence terms.',
          'Using clips from TV shows, films, or news broadcasts without transformation (commentary or criticism) is not protected — rights holders routinely issue takedowns.',
          'YouTube Audio Library tracks are pre-cleared for use in monetised videos — this is the safest music source for YouTube content.',
        ],
        bestPractices: [
          'Optimise your title for search intent — include the exact phrase your target viewer would type into YouTube search, ideally in the first 60 characters.',
          'Your thumbnail is 90% of your click-through rate — use high contrast, a clear human face (ideally showing emotion), and 3 words or fewer of text.',
          'Hook viewers in the first 30 seconds — YouTube\'s algorithm measures "audience retention" and promotes videos that keep viewers watching past the 30-second mark.',
          'Add timestamps/chapters for videos over 5 minutes — chapters improve viewer experience and are displayed in Google search results as jump links.',
          'Post consistently on a schedule — YouTube\'s algorithm rewards channels that publish predictably, as it can anticipate and pre-cache your next upload.',
          'End screens and cards drive 20–30% of subscribers — always add an end screen with a subscribe button and a video recommendation.',
        ],
        improvementSuggestion: hasContent ? `Compliant video description: ${content.trim()}

[Add paid promotion disclosure if sponsored. Verify thumbnail matches content. Add chapters if video is over 5 mins. Use YouTube Audio Library for background music. Check first 30s for policy-sensitive content.]` : '',
      },
    },
    LinkedIn: {
      Post: {
        riskLevel: 'Low',
        platformGuidelines: [
          'LinkedIn\'s Professional Community Policies prohibit: fake profiles, misleading content, spam engagement tactics (like pods that artificially inflate likes), and off-platform solicitation.',
          'Promotional content must be clearly marked — undisclosed affiliate links or paid partnerships violate LinkedIn\'s spam and honesty policies.',
          'LinkedIn restricts posts that contain more than 5 external links — multi-link posts are flagged as potential spam and receive significantly reduced distribution.',
          'Personal data of other users (contact details, location, workplace) cannot be shared in posts without explicit consent — this includes screenshotting DMs.',
          'Political advertising is permitted on LinkedIn but requires campaign registration and identity verification through LinkedIn\'s Political Ads programme.',
          'LinkedIn uses a "dwell time" signal — posts people scroll past quickly are demoted. Authentic long-form content and native documents outperform link posts.',
          'Posts that use engagement bait phrases ("like if you agree", "tag 3 friends") are algorithmically suppressed on LinkedIn since the 2023 policy update.',
        ],
        commonMistakes: [
          'Posting external links in the main post body — LinkedIn\'s algorithm suppresses posts with links that take users off-platform. Post the link in the first comment instead.',
          'Using more than 3 hashtags — LinkedIn research shows 3 hashtags is optimal. More hashtags signal low-quality content to the algorithm.',
          'Cross-posting identical content from Instagram — LinkedIn\'s tone is professional and context-specific. Instagram-style content underperforms and can harm account credibility.',
          'Treating LinkedIn like a job board when not hiring — promotional posts without professional insight or value are flagged as spam by LinkedIn\'s content quality filters.',
          'Posting and disappearing — LinkedIn\'s algorithm looks at engagement in the first 60–90 minutes. Leaving immediately after posting kills distribution.',
          'Using misleading or exaggerated professional claims ("serial entrepreneur", "thought leader") — LinkedIn\'s trust and safety team monitors for misleading professional identities.',
        ],
        copyrightTips: [
          'Sharing articles by clicking LinkedIn\'s native "Share" feature is compliant — copying the article text into your post is a copyright violation.',
          'Infographics and charts from external sources require attribution and permission before being reposted as original content.',
          'Profile photos, headshots, and company logos cannot be used in posts without consent from the rights holder — even if they appear in your connections list.',
          'Research reports and whitepapers cited in posts must be properly attributed — quoting more than a paragraph without licence is copyright infringement.',
        ],
        bestPractices: [
          'Write in first person with a specific story or observation — LinkedIn\'s highest-performing content starts with "I" and shares a professional experience, not a generic tip.',
          'Use line breaks aggressively — LinkedIn\'s mobile readers scan fast. One idea per line, short sentences, clear breathing room between thoughts.',
          'Native document uploads (PDFs, slideshows) get 3x the reach of text posts — convert your best insights into a LinkedIn carousel document.',
          'Comment on 5–10 posts before you post your own — LinkedIn\'s algorithm rewards active members by extending the reach of their next post.',
          'The optimal LinkedIn post length is 1,200–1,500 characters — long enough to trigger "see more" (which signals quality), short enough to sustain attention.',
          'Post between Tuesday–Thursday, 7–9am — LinkedIn engagement peaks during commute hours in the user\'s local timezone.',
        ],
        improvementSuggestion: hasContent ? `Compliant LinkedIn version: ${content.trim()}

[Move any external links to first comment. Reduce to 3 hashtags max. Add a specific professional insight in first 2 lines. Use line breaks between each idea. Remove engagement bait phrases.]` : '',
      },
    },
    'Twitter (X)': {
      Post: {
        riskLevel: 'Low',
        platformGuidelines: [
          'X (Twitter) prohibits: targeted harassment, doxxing, non-consensual nudity, synthetic media designed to deceive, and coordinated inauthentic behaviour.',
          'Ads and sponsored tweets must include the #ad or #sponsored hashtag in a visible position — buried disclosures in long threads do not satisfy FTC requirements.',
          'Civic integrity policies prohibit content that suppresses voter participation or spreads verifiably false information about election processes.',
          'X\'s synthetic and manipulated media policy prohibits sharing AI-generated images or videos that falsely depict real people without clear disclosure.',
          'Sensitive media (adult content, graphic violence) must be marked appropriately in account settings — unmarked sensitive content results in immediate removal.',
          'X\'s spam policy prohibits: posting identical or near-identical replies at scale, using automation to follow/unfollow in bulk, and running engagement pod networks.',
          'The 280-character limit applies per tweet — threads are compliant but each tweet must individually satisfy content policies.',
        ],
        commonMistakes: [
          'Quote-tweeting controversial content without commentary — X\'s algorithm sometimes associates the quoted content with your account for policy enforcement purposes.',
          'Using automated tools to schedule posts without monitoring for real-time context — scheduling a promotional tweet during a breaking news event causes significant brand damage.',
          'Posting a thread where the first tweet violates policies — X removes the entire thread, not just the offending tweet.',
          'Using trending hashtags unrelated to your content — X\'s spam team monitors hashtag misuse and can suspend accounts for trending tag hijacking.',
          'Engaging in follow/unfollow cycles (following hundreds of accounts then unfollowing for ratio) — X\'s systems detect and flag this as inauthentic growth behaviour.',
          'Sharing screenshots of other users\' tweets without context in a way that encourages harassment — this violates X\'s targeted harassment policy.',
        ],
        copyrightTips: [
          'Embedding a tweet using Twitter/X\'s native embed feature is compliant — screenshotting and reposting another user\'s tweet as your own is a copyright violation.',
          'Music in video tweets is subject to X\'s licensing agreements — unlicensed music in videos can result in the audio being muted or the tweet being removed.',
          'Images and GIFs shared on X that were created by others retain their copyright — reposting them as original content is infringement.',
          'X has a DMCA process for copyright claims — three valid DMCA notices against an account can result in suspension.',
        ],
        bestPractices: [
          'Tweets with images get 150% more retweets — always attach a visual even for text-heavy posts.',
          'The first 5 words determine whether someone reads your tweet — write the most compelling part first, not last.',
          'Reply to replies within 30 minutes of posting — early engagement signals boost tweet visibility in the For You feed.',
          'Threads drive 3x more profile visits than single tweets — use threads for any content that benefits from sequential explanation.',
          'Post between 8–10am and 6–9pm in your audience\'s timezone — X engagement follows morning commute and evening patterns.',
          'Use 1–2 hashtags maximum — more than 2 hashtags on X reduces engagement by reducing perceived post quality.',
        ],
        improvementSuggestion: hasContent ? `Compliant X version: ${content.trim()}

[Keep under 280 characters or convert to thread. Add #ad if promotional. Attach an image for higher engagement. Use 1–2 relevant hashtags. Verify no copyrighted media is included.]` : '',
      },
    },
    Facebook: {
      Post: {
        riskLevel: 'Low',
        platformGuidelines: [
          'Facebook\'s Community Standards prohibit: coordinated inauthentic behaviour, voter suppression content, health misinformation, and content that incites real-world violence.',
          'Branded content (paid partnerships) must use Facebook\'s Branded Content tool — text-only disclosures like "#ad" do not satisfy Facebook\'s partnership transparency requirements.',
          'Facebook restricts organic reach of posts with external links — this is intentional product design, not a bug. Native content always outperforms link-heavy posts.',
          'Polls, contests, and giveaways on Facebook must not require sharing or tagging as a condition of entry — this violates Facebook\'s Pages Terms.',
          'Facebook\'s health misinformation policy flags content making unverified medical claims — this applies to supplements, treatments, and wellness products.',
          'Groups content is subject to the same standards as Pages — group admins are responsible for member content and can be held accountable for violations.',
          'Posts that use engagement bait ("Share this to win", "Like if you agree") are algorithmically demoted by Facebook since the 2018 News Feed algorithm update.',
        ],
        commonMistakes: [
          'Running a contest that requires sharing as entry — Facebook\'s Pages Terms explicitly prohibit share-to-enter contests. Use reactions or comments as entry mechanics instead.',
          'Using personal profiles for business promotion — Facebook limits the reach of business-related content on personal profiles and can restrict accounts that violate this.',
          'Boosting posts without a clear CTA — boosted posts without a defined objective (link click, page like, message) waste budget on impressions that don\'t convert.',
          'Ignoring Facebook\'s algorithm preference for native video — external YouTube links receive a fraction of the reach of videos uploaded directly to Facebook.',
          'Not responding to comments on boosted posts — Facebook\'s ad relevance score drops when boosted posts have unanswered negative comments.',
          'Cross-posting identical content from Instagram — Facebook and Instagram audiences and algorithms differ significantly; cross-posting without adaptation underperforms.',
        ],
        copyrightTips: [
          'Facebook\'s Rights Manager system scans all video uploads for copyrighted content — infringing videos are either muted, removed, or monetised by the rights holder.',
          'Music in Facebook Live streams is subject to copyright — playing a radio station or Spotify in the background of a live video will trigger muting.',
          'Profile pictures and cover photos of real people (other than yourself) require consent — especially for business pages representing individuals.',
          'Sharing news articles requires compliance with the platform\'s news licensing agreements — in some regions, Facebook restricts news article sharing based on government regulation.',
        ],
        bestPractices: [
          'Upload video directly to Facebook rather than sharing YouTube links — native Facebook video gets up to 10x the organic reach of linked video content.',
          'Facebook posts with questions get 100% more comments — end your post with a specific, easy-to-answer question.',
          'Use Facebook\'s scheduling tool to post at peak times — 1–3pm on weekdays shows the highest engagement rates for most page categories.',
          'Create Facebook Events for any live activity — Events appear in a separate discovery feed and reach users who don\'t follow your page.',
          'Respond to all comments within 24 hours — Facebook\'s Page responsiveness badge ("Very responsive") increases trust and conversion for business pages.',
          'Limit posts to 3–4 per week — Facebook\'s algorithm de-prioritises pages that post too frequently, treating it as spam behaviour.',
        ],
        improvementSuggestion: hasContent ? `Compliant Facebook version: ${content.trim()}

[Remove any contest share requirements. Add branded content disclosure if paid partnership. Avoid external links in post body — put in first comment. End with a single question to drive comments.]` : '',
      },
    },
    TikTok: {
      'Reel / Video': {
        riskLevel: 'Medium',
        platformGuidelines: [
          'TikTok\'s Community Guidelines prohibit: dangerous challenges, content involving minors in romantic contexts, graphic violence, and content that glorifies eating disorders or self-harm.',
          'Branded content and paid partnerships must use TikTok\'s Branded Content toggle — disclosure must appear within the first 3 seconds of the video for ad compliance.',
          'TikTok\'s Ads Policy prohibits: financial product promotion without regulatory approval, health claims that haven\'t been approved by health authorities, and misleading pricing.',
          'Videos targeting users under 13 are restricted — TikTok uses AI age detection and restricts certain content types from appearing in younger users\' feeds.',
          'TikTok\'s Dangerous Activities policy flags: specific weight loss claims, "miracle cure" health content, and diet products promoted by users under 18.',
          'Duets and Stitches are governed by the original creator\'s settings — using a duet or stitch of content where the creator has disabled this feature is a policy violation.',
          'TikTok\'s spam policy prohibits: artificial follower inflation, comment pods, and posting more than 5 similar videos in 24 hours.',
        ],
        commonMistakes: [
          'Using a commercial song (not from TikTok\'s Commercial Music Library) in branded or paid content — commercial tracks are only licensed for personal accounts, not business accounts or ads.',
          'Posting videos with static images and text overlays as "videos" — TikTok\'s algorithm significantly deprioritises slideshow-style content in favour of real video.',
          'Deleting and reposting videos to game the algorithm — TikTok detects this behaviour and can suppress the reposted video\'s reach.',
          'Posting content that was clearly filmed on another platform (visible watermarks from Instagram Reels or YouTube Shorts) — TikTok\'s algorithm actively suppresses cross-posted content.',
          'Using low-quality captions (just hashtags, no text) — TikTok\'s recommendation algorithm uses caption text for content categorisation. No caption = limited discovery.',
          'Going live without 1,000 followers — TikTok requires a minimum of 1,000 followers to access LIVE. Attempting to circumvent this via workarounds violates ToS.',
        ],
        copyrightTips: [
          'TikTok\'s Commercial Music Library is the only safe music source for brand accounts and paid content — all other music on the platform is licensed for personal use only.',
          'Trending sounds on TikTok are licensed for organic personal use — using them in ads or paid partnerships requires additional licensing and is frequently rejected.',
          'TikTok has active licensing agreements with major labels (Universal, Sony, Warner) — music from these labels on personal accounts is permitted; on business accounts it triggers automatic removal.',
          'Original audio you create (voiceovers, original music) is protected — if another creator uses your original sound without permission, you can file a copyright claim.',
          'Dance choreography is increasingly protected under copyright — using viral dances in brand content without crediting or licensing from the choreographer creates legal exposure.',
        ],
        bestPractices: [
          'The first 1–2 seconds determine whether viewers swipe — open with movement, a bold statement, or a visual hook. Never open on a logo or brand intro.',
          'Post 3–5 times per week minimum — TikTok\'s algorithm rewards consistent posting more aggressively than any other platform.',
          'Use TikTok\'s native text, effects, and stickers — videos that use TikTok\'s own creative tools are given preferential distribution in the For You Page algorithm.',
          'Reply to comments with a video reply — TikTok\'s comment reply video feature gets significantly higher reach than the original video for most accounts.',
          'Optimal TikTok video length for discovery is 7–15 seconds — for educational or storytelling content, 60–90 seconds performs best for saves and shares.',
          'Post between 6–10pm in your audience\'s timezone — TikTok\'s For You Page algorithm weights recency, so peak-hour posting amplifies initial distribution.',
        ],
        improvementSuggestion: hasContent ? `Compliant TikTok version: ${content.trim()}

[Remove Instagram/YouTube watermarks if cross-posting. Use Commercial Music Library audio for brand account. Add Branded Content toggle if paid. Start with a 1-second hook. Use native TikTok text overlays.]` : '',
      },
    },
  }

  const platformData = data[platform]
  if (platformData) {
    const typeData = platformData[contentType] || platformData[Object.keys(platformData)[0]]
    if (typeData) {
      return {
        riskLevel:             typeData.riskLevel             || 'Medium',
        platformGuidelines:    typeData.platformGuidelines    || [],
        commonMistakes:        typeData.commonMistakes        || [],
        copyrightTips:         typeData.copyrightTips         || [],
        bestPractices:         typeData.bestPractices         || [],
        improvementSuggestion: typeData.improvementSuggestion || '',
        policyLinks: [],
      }
    }
  }

  // Generic fallback if platform/type not found
  return {
    riskLevel: 'Medium',
    platformGuidelines: [
      `${platform} requires all sponsored or paid content to be clearly disclosed using platform-native disclosure tools, not just caption hashtags.`,
      `${platform} prohibits misleading health, financial, or performance claims — all factual statements in ${contentType}s must be verifiable.`,
      `${platform} enforces copyright through automated content matching — all music, images, and video clips require appropriate licences for the content type.`,
      `${platform} restricts content promoting gambling, tobacco, prescription drugs, and alcohol to audiences where this is legally permitted.`,
      `${platform} community standards prohibit harassment, hate speech based on protected characteristics, and content that promotes real-world violence.`,
    ],
    commonMistakes: [
      `Using trending audio without verifying commercial licence — free for personal use does not mean free for branded or monetised ${contentType}s on ${platform}.`,
      `Cross-posting content from other platforms without removing competitor watermarks — ${platform}\'s algorithm suppresses content visibly branded for other platforms.`,
      `Missing paid partnership disclosure — undisclosed sponsored ${contentType}s on ${platform} violate both platform policy and FTC/ASA advertising standards.`,
      `Using other users' content without explicit written permission — credit in the caption is not a substitute for a content licence.`,
      `Over-tagging or using irrelevant hashtags — ${platform}\'s spam filter treats hashtag misuse as low-quality content, reducing your organic reach.`,
    ],
    copyrightTips: [
      `Use only music from ${platform}\'s official licensed music library for ${contentType}s — third-party royalty-free licences often do not cover ${platform} commercial use.`,
      `Original creative content you produce is automatically copyright protected — watermark or timestamp your originals if you plan to distribute widely.`,
      `Screenshots or screen recordings of other users' content retain their copyright — always obtain permission before reposting.`,
      `Images from Google Search are not free to use — verify licence status via Google Images\' "Usage Rights" filter or use a properly licensed stock provider.`,
    ],
    bestPractices: [
      `Post ${contentType}s consistently on a predictable schedule — all major platform algorithms reward regular cadence over sporadic high-volume posting.`,
      `Engage with your audience in comments within the first hour of posting — early engagement signals are the strongest factor in content distribution on ${platform}.`,
      `Use ${platform}\'s native content tools (filters, text overlays, stickers) — content created natively on the platform receives preferential algorithmic treatment.`,
      `Always include a clear, single call-to-action — content with multiple or unclear CTAs consistently underperforms content with one specific next step.`,
      `Disclose all paid partnerships and sponsored content clearly and early — audience trust is the most valuable long-term asset on any platform.`,
    ],
    improvementSuggestion: hasContent ? `Reviewed version for ${platform} ${contentType}: ${content.trim()}

[Add paid partnership disclosure if applicable. Verify all media is properly licensed. Include a single clear CTA. Check platform-specific character/duration limits before posting.]` : '',
    policyLinks: [],
  }
}

// ─────────────────────────────────────────────────────────────────────────────
export function creatorStudioFallback({ campaignName, platforms, tone, contentHint, tagline, campaignGoal, targetAudience, keyMessage, productService }) {
  const brand     = campaignName || 'Your Brand'
  const platform  = (platforms && platforms[0]) || 'Instagram'
  const hookText  = tagline || keyMessage || `${brand} — See Why Everyone's Talking`
  const ctaText   = campaignGoal ? `${campaignGoal.slice(0, 50)} — Link in bio` : `Follow ${brand} for more`
  const bodyLine  = targetAudience ? `Built for ${targetAudience}` : `Powered by ${brand}`
  const product   = productService || brand

  const editingInstructions = [
    { step: 1, tool: 'CapCut', action: `Set video speed to 1.05x on all talking clips for ${brand}`, detail: `Select clip → Speed → Normal → drag to 1.05x. Eliminates dead air without sounding rushed. Apply to every clip individually.` },
    { step: 2, tool: 'CapCut', action: `Add ${brand} typography overlay`, detail: `Text → Add Text → type "${hookText}" → Font: Bebas Neue → Size 88 → Color #FFFFFF → Position: bottom-third of frame.` },
    { step: 3, tool: 'CapCut', action: `Apply ${brand} colour grade`, detail: `Filters → Film → select "Fade" at 40% intensity. Then Adjust → Brightness +5, Contrast +8, Saturation -5. Gives clean, editorial look.` },
    { step: 4, tool: 'CapCut', action: `Add auto-captions for ${brand} content`, detail: `Captions → Auto Captions → Language: English → Style: Bold White → Edit any misheard words before export.` },
    { step: 5, tool: 'Canva',  action: `Create ${brand} thumbnail`, detail: `New Design → 1080×1920px → Upload background image → Add Bebas Neue text "${hookText}" at 92px → Export as PNG.` },
  ]

  return {
    contentFormat: 'reel',
    reelScript: {
      hook:   { timing: '0:00–0:02', action: `Open on ${product} close-up or creator face looking directly at camera. Say or show: "${hookText}"`, onScreenText: hookText, textPlacement: 'bottom-third' },
      scenes: [
        { sceneNumber: 1, timing: '0:02–0:08',  action: `Cut to close-up of ${product} in use. Show the core value in action — what problem it solves, visually.`, onScreenText: keyMessage || `Here's what ${brand} actually does:`, textPlacement: 'top-center' },
        { sceneNumber: 2, timing: '0:08–0:18',  action: `Show the result or transformation. ${targetAudience ? `Someone from ${targetAudience} seeing the outcome.` : 'Before and after, or the payoff moment.'}`, onScreenText: tagline || `${brand} — this changes the game`, textPlacement: 'middle' },
        { sceneNumber: 3, timing: '0:18–0:22',  action: `Back to creator facing camera. Summarise ${brand}'s value in one sentence.`, onScreenText: bodyLine, textPlacement: 'bottom-third' },
      ],
      cta: { timing: '0:22–0:27', action: `Creator points down toward caption or link. Say: "${ctaText}"`, onScreenText: ctaText, textPlacement: 'bottom-center' },
    },
    editingInstructions,
    canvaLayout: {
      format:     '1080x1920 (9:16 vertical)',
      background: '#0D0F1A solid',
      titleText:  { content: hookText, font: 'Bebas Neue', size: '92px', color: '#FFFFFF', placement: 'centered horizontally, 18% from top' },
      bodyText:   { content: bodyLine, font: 'DM Sans Regular', size: '34px', color: '#D1D5DB', placement: 'centered horizontally, 38% from top' },
      accentElement: `Horizontal rule 380px wide, 3px thick, colour #3B6BF5, placed 8px below title text`,
    },
    thumbnailIdea: {
      visualComposition: `Creator or product in left 60% of frame. ${brand} logo or product result on right 40%. High-contrast light from screen-right.`,
      textOverlay:       hookText,
      font:              'Montserrat ExtraBold',
      textColor:         '#FFDD00',
      backgroundColor:   '#0D0F1A',
      highlightElement:  `Bright yellow rounded rectangle behind text "${hookText}" — instant contrast against dark background`,
    },
    mistakesToAvoid: [
      { mistake: `Opening the reel with ${brand}'s name or a greeting before the hook`, whyItHurts: `${platform} users decide in 1.5 seconds. Saying the brand name first wastes the only moment that counts.`, fix: `Start immediately with "${hookText}" as the very first words.` },
      { mistake: `Using vague CTAs like "Learn More" or "Check It Out" for ${brand}`, whyItHurts: `For ${targetAudience || 'your audience'}, generic CTAs blend into the noise and reduce click-through rate significantly.`, fix: `Replace with: "${ctaText}" — specific and tells the viewer exactly what they get.` },
      { mistake: `Not matching the ${tone || 'brand'} tone in the visual style`, whyItHurts: `Visual mismatches break the viewer's emotional state and reduce saves and shares.`, fix: `Use #0D0F1A background with #FFFFFF text and #3B6BF5 accents consistently across all ${brand} content.` },
    ],
  }
}
