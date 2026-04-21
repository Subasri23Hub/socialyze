/**
 * Creator Studio Route — Rebuilt for full personalisation
 * =========================================================
 * POST /creator-studio
 *
 * Accepts structured campaign context from the frontend.
 * Builds a tight, brand-specific prompt and returns a
 * fully personalised editing guide.
 *
 * LLM Provider : Google Gemini (via generateWithFallback in res.locals)
 * Fallback      : Domain-specific structured content (buildSmartFallback)
 *                 Uses real brand data — never generic placeholders.
 *
 * Team   : Subasri B | Gautham Krishnan K | Ashwin D | Vinjarapu Ajay Kumar
 * Company: Sourcesys Technologies
 */

const express = require("express");
const router  = express.Router();
const { TEMPERATURE_PRESETS } = require("../config");

// ─────────────────────────────────────────────────────────────────
// Detect content format from the user's content hint
// Returns one of: 'reel' | 'carousel' | 'photo' | 'story' | 'short' | 'thread'
// ─────────────────────────────────────────────────────────────────
function detectContentFormat(hint = "") {
  const h = hint.toLowerCase();
  if (/carousel|slide|swipe|multi.?slide|multi.?page|doc(ument)?/.test(h)) return "carousel";
  if (/story|stories/.test(h)) return "story";
  if (/short|youtube.?short|yt.?short/.test(h)) return "short";
  if (/thread|tweet.?thread|twitter.?thread/.test(h)) return "thread";
  if (/reel|tiktok|video|film|clip/.test(h)) return "reel";
  if (/\bpost\b|photo|image|static|single.?image|infograph|picture|pic/.test(h)) return "photo";
  return "reel";
}

// ─────────────────────────────────────────────────────────────────
// Build format-specific script section of the prompt
// ─────────────────────────────────────────────────────────────────
function buildFormatBlock(format, campaignName, primaryPlatform, tone) {
  const toneNote = tone
    ? `Brand tone is "${tone}" — every caption, hook, and CTA must match this energy exactly.`
    : "Match the brand voice from the campaign intelligence above.";

  switch (format) {
    case "carousel": return {
      instructions: `
FORMAT: CAROUSEL POST (multi-slide)
You are creating a ${primaryPlatform} carousel for ${campaignName}. This is NOT a video — there is no hook/scene/CTA video structure.
Instead produce exactly 5 slides. Each slide has a headline, body copy, and a visual direction.
The first slide is the cover (scroll-stopping hook). The last slide is the CTA slide.
${toneNote}

ABSOLUTE RULES:
1. Every "headline" must be the ACTUAL words that go on the slide — real ${campaignName} campaign language, not a description
2. Every "body" must be publish-ready copy for that slide — no placeholder text
3. Caption must be the full ${primaryPlatform} post caption (emojis, line breaks, hashtags) ready to paste
4. Editing steps must reference Canva carousel creation specifically — not CapCut
5. Thumbnail = cover slide concept
`,
      scriptKey: "carouselSlides",
      scriptSchema: `"carouselSlides": [
    { "slideNumber": 1, "role": "Cover — scroll-stopping hook",       "headline": "EXACT headline words for ${campaignName} slide 1", "body": "EXACT body copy or leave blank if cover is headline-only", "visualDirection": "exact design direction: background color #hexcode, image/graphic placement, overlay style" },
    { "slideNumber": 2, "role": "Problem or insight",                 "headline": "EXACT headline for slide 2", "body": "EXACT body copy for ${campaignName} slide 2", "visualDirection": "exact design direction" },
    { "slideNumber": 3, "role": "Value proof or feature",             "headline": "EXACT headline for slide 3", "body": "EXACT body copy for ${campaignName} slide 3", "visualDirection": "exact design direction" },
    { "slideNumber": 4, "role": "Social proof or result",             "headline": "EXACT headline for slide 4", "body": "EXACT body copy for ${campaignName} slide 4", "visualDirection": "exact design direction" },
    { "slideNumber": 5, "role": "CTA slide",                          "headline": "EXACT CTA headline for ${campaignName}", "body": "EXACT supporting line + action instruction", "visualDirection": "exact design direction" }
  ]`,
    };

    case "photo": return {
      instructions: `
FORMAT: SINGLE PHOTO / STATIC IMAGE POST
You are creating a single static photo post for ${campaignName} on ${primaryPlatform}. This is NOT a video.
There is no reel script. Instead produce one complete photo post: the image concept, the on-image text overlay, the caption, and the editing steps in Canva.
${toneNote}

ABSOLUTE RULES:
1. "photoPost.imageDirection" must describe the exact photo: subject, framing, lighting, mood, props
2. "photoPost.textOverlay" must be the ACTUAL words on the image — real ${campaignName} language
3. Caption must be full publish-ready copy for ${primaryPlatform} with line breaks, emojis, hashtags
4. Editing steps are Canva-only — photo editing, typography, color grading
5. Thumbnail = the photo post itself
`,
      scriptKey: "photoPost",
      scriptSchema: `"photoPost": {
    "imageDirection": "exact shot description: subject, framing (e.g. flat lay, portrait, close-up), lighting (natural/studio), mood, props specific to ${campaignName}",
    "textOverlay": "EXACT words on the image — real ${campaignName} campaign language, scroll-stopping",
    "textPlacement": "exact position: e.g. bottom-left, centered, top-right",
    "caption": "FULL publish-ready ${primaryPlatform} caption for ${campaignName} — hook line, body, hashtags, CTA"
  }`,
    };

    case "story": return {
      instructions: `
FORMAT: STORY (vertical, 15s or static)
You are creating a ${primaryPlatform} Story for ${campaignName}. Stories are vertical 9:16, 15 seconds max or static.
Produce 3 story frames in sequence: tease → value → CTA.
${toneNote}

ABSOLUTE RULES:
1. Each frame has exact on-screen text — real ${campaignName} words, not descriptions
2. Duration of each frame must be specified in seconds
3. Editing steps reference CapCut or Canva Story templates specifically
`,
      scriptKey: "storyFrames",
      scriptSchema: `"storyFrames": [
    { "frameNumber": 1, "duration": "0–4s",  "role": "Tease/Hook",    "onScreenText": "EXACT words for ${campaignName} story frame 1", "action": "exact visual: what appears on screen", "textPlacement": "centered" },
    { "frameNumber": 2, "duration": "4–11s", "role": "Value/Reveal",  "onScreenText": "EXACT words for ${campaignName} story frame 2", "action": "exact visual for frame 2", "textPlacement": "bottom-third" },
    { "frameNumber": 3, "duration": "11–15s","role": "CTA/Swipe-Up",  "onScreenText": "EXACT CTA words for ${campaignName}",           "action": "exact closing visual and swipe-up prompt", "textPlacement": "bottom-center" }
  ]`,
    };

    case "short": return {
      instructions: `
FORMAT: YOUTUBE SHORT (60s max, vertical 9:16)
You are creating a YouTube Short for ${campaignName}. Hook must land in the first 3 seconds. Retention is everything.
Produce hook → 3 content beats → CTA. Title and description are critical for discoverability.
${toneNote}

ABSOLUTE RULES:
1. Hook action must be exactly what the creator says/does in seconds 0–3
2. Each beat describes exactly what content appears
3. CTA must include verbal CTA + subscribe prompt
4. Title must be under 60 chars and SEO-optimised for ${campaignName}
`,
      scriptKey: "reelScript",
      scriptSchema: `"reelScript": {
    "hook": { "timing": "0:00–0:03", "action": "EXACT opening action for ${campaignName} Short — what creator says/shows in first 3 seconds", "onScreenText": "EXACT hook text overlay for ${campaignName}", "textPlacement": "bottom-third" },
    "scenes": [
      { "sceneNumber": 1, "timing": "0:03–0:18", "action": "exact content beat 1 specific to ${campaignName}", "onScreenText": "EXACT text for beat 1", "textPlacement": "top-center" },
      { "sceneNumber": 2, "timing": "0:18–0:40", "action": "exact content beat 2 specific to ${campaignName}", "onScreenText": "EXACT text for beat 2", "textPlacement": "middle" },
      { "sceneNumber": 3, "timing": "0:40–0:55", "action": "exact content beat 3 — building to payoff for ${campaignName}", "onScreenText": "EXACT text for beat 3", "textPlacement": "bottom-third" }
    ],
    "cta": { "timing": "0:55–1:00", "action": "verbal CTA + subscribe prompt specific to ${campaignName}", "onScreenText": "EXACT CTA overlay for ${campaignName}", "textPlacement": "bottom-center" }
  }`,
    };

    case "thread": return {
      instructions: `
FORMAT: TWITTER/X THREAD
You are creating a Twitter/X thread for ${campaignName}. Each tweet must be under 280 chars. Hook tweet must stop the scroll.
Produce 5 tweets: hook → 3 value tweets → CTA tweet.
${toneNote}

ABSOLUTE RULES:
1. Every tweet must be the ACTUAL text to post — real ${campaignName} language, under 280 chars
2. Hook tweet must not start with "Introducing" or "Excited to"
3. Thread must feel like a single cohesive story that builds from tweet 1 to 5
4. Editing steps reference Twitter/X natively — no CapCut
`,
      scriptKey: "twitterThread",
      scriptSchema: `"twitterThread": [
    { "tweetNumber": 1, "role": "Hook",       "text": "EXACT hook tweet for ${campaignName} — under 280 chars, scroll-stopping" },
    { "tweetNumber": 2, "role": "Value 1",    "text": "EXACT tweet 2 — first value point specific to ${campaignName}" },
    { "tweetNumber": 3, "role": "Value 2",    "text": "EXACT tweet 3 — second value point for ${campaignName}" },
    { "tweetNumber": 4, "role": "Value 3",    "text": "EXACT tweet 4 — third value point or proof for ${campaignName}" },
    { "tweetNumber": 5, "role": "CTA",        "text": "EXACT CTA tweet for ${campaignName} — specific action, under 280 chars" }
  ]`,
    };

    default: return {
      instructions: `
FORMAT: INSTAGRAM/TIKTOK REEL (short-form vertical video)
You are creating a Reel for ${campaignName} on ${primaryPlatform}. Hook in first 2 seconds. 15–30s total.
Produce hook → 3 scenes → CTA.
${toneNote}

ABSOLUTE RULES:
1. Every on-screen text must be THE EXACT WORDS to type — real ${campaignName} campaign language
2. Every timing must be specific: "0:00–0:02" not "the beginning"
3. Reel script actions describe EXACTLY what to film — specific shot type, words spoken, product shown
`,
      scriptKey: "reelScript",
      scriptSchema: `"reelScript": {
    "hook": { "timing": "0:00–0:02", "action": "EXACT description of what ${campaignName} creator does in opening 2 seconds — specific shot, words spoken, product shown", "onScreenText": "EXACT hook words from ${campaignName} campaign", "textPlacement": "bottom-third" },
    "scenes": [
      { "sceneNumber": 1, "timing": "0:02–0:08",  "action": "exact shot for ${campaignName} — describe the visual specifically", "onScreenText": "EXACT words — must reference ${campaignName} brand language", "textPlacement": "top-center" },
      { "sceneNumber": 2, "timing": "0:08–0:18",  "action": "second shot — specific to ${campaignName} product or service", "onScreenText": "EXACT second text overlay — real brand messaging", "textPlacement": "middle" },
      { "sceneNumber": 3, "timing": "0:18–0:24",  "action": "third shot — build toward the payoff specific to ${campaignName}", "onScreenText": "EXACT third overlay — drives toward the CTA", "textPlacement": "bottom-third" }
    ],
    "cta": { "timing": "0:24–0:30", "action": "exact closing action for ${campaignName} — what the creator says or shows", "onScreenText": "EXACT CTA words — specific action for ${campaignName} audience", "textPlacement": "bottom-center" }
  }`,
    };
  }
}

// ─────────────────────────────────────────────────────────────────
// Prompt builder — dynamically adapts to requested content format
// ─────────────────────────────────────────────────────────────────
function buildPrompt(ctx) {
  const {
    campaignName,
    platforms       = [],
    tone            = "",
    brandVoice      = "",
    campaignGoal    = "",
    targetAudience  = "",
    tagline         = "",
    bigIdea         = "",
    sampleCaptions  = [],
    contentHint     = "",
    productService  = "",
    keyMessage      = "",
  } = ctx;

  const format = detectContentFormat(contentHint);

  let primaryPlatform = platforms[0] || "Instagram";
  const hintLower = contentHint.toLowerCase();
  if (/tiktok/.test(hintLower))             primaryPlatform = "TikTok";
  else if (/linkedin/.test(hintLower))      primaryPlatform = "LinkedIn";
  else if (/twitter|tweet/.test(hintLower)) primaryPlatform = "Twitter";
  else if (/youtube|yt/.test(hintLower))    primaryPlatform = "YouTube";
  else if (/facebook/.test(hintLower))      primaryPlatform = "Facebook";
  else if (/instagram/.test(hintLower))     primaryPlatform = "Instagram";

  const platformFormatMap = {
    Instagram: "vertical 9:16 Reel, 15–30 seconds, hook in first 2s, captions auto-generated, save-worthy",
    TikTok:    "vertical 9:16, 15–60 seconds, native raw energy, POV or trend format, hook in first 1.5s",
    YouTube:   "horizontal 16:9 or Shorts 9:16, 30–60s for Shorts, thumbnail drives 90% of clicks",
    LinkedIn:  "square 1:1 or 4:5 portrait, professional tone, data-driven hook, carousel or talking head",
    Facebook:  "square 1:1, community-first angle, story-driven caption, end with question",
    Twitter:   "square 1:1 or 16:9, punchy visual, text overlay under 7 words",
  };
  const platformFormat = platformFormatMap[primaryPlatform] || platformFormatMap.Instagram;

  const formatBlock = buildFormatBlock(format, campaignName, primaryPlatform, tone);

  const brandIntelLines = [];
  if (tagline)        brandIntelLines.push(`Campaign Tagline: "${tagline}"`);
  if (bigIdea)        brandIntelLines.push(`Campaign Big Idea: ${bigIdea}`);
  if (brandVoice)     brandIntelLines.push(`Brand Voice: ${brandVoice}`);
  if (targetAudience) brandIntelLines.push(`Target Audience: ${targetAudience}`);
  if (campaignGoal)   brandIntelLines.push(`Campaign Goal: ${campaignGoal}`);
  if (productService) brandIntelLines.push(`Product / Service: ${productService}`);
  if (keyMessage)     brandIntelLines.push(`Key Message: ${keyMessage}`);
  if (tone)           brandIntelLines.push(`Brand Tone: ${tone}`);

  const sampleCaptionLines = sampleCaptions.slice(0, 3).map((c, i) => `  Caption ${i+1}: ${c}`).join("\n");

  const editingTool    = (format === "carousel" || format === "photo") ? "Canva" : "CapCut";
  const editingContext = {
    carousel: `Canva carousel creation — 5 slides, consistent brand template, transitions between slides`,
    photo:    `Canva static post — photo editing, typography placement, color grading`,
    story:    `CapCut or Canva Story template — vertical 9:16, animated text, sticker placement`,
    short:    `CapCut YouTube Shorts editing — pacing, captions, end-screen CTA`,
    thread:   `Twitter/X native — thread formatting, image attachments if needed`,
    reel:     `CapCut Reel editing — cuts, captions, color grade, transitions`,
  }[format] || `CapCut Reel editing`;

  const hintProduct = contentHint
    ? contentHint.replace(/^(a |an |the |create |make |build |write |generate )?(instagram|linkedin|tiktok|twitter|youtube|facebook)?\s*(reel|carousel|post|story|short|thread|video|photo|image)?\s*(for\s)?/i, '').trim()
    : '';

  const captionsBlock = sampleCaptionLines
    ? `REAL CAPTIONS ALREADY GENERATED FOR ${campaignName.toUpperCase()} \u2014 MATCH THIS VOICE AND LANGUAGE:\n${sampleCaptionLines}`
    : `No past captions yet \u2014 write in a voice befitting ${tone || 'the brand tone'} for ${campaignName}`;

  const formatHeader = `${format.toUpperCase()}${contentHint ? ` \u2014 exact brief: "${contentHint}"` : ''}`;
  const topicLine    = hintProduct ? `Topic / Product being promoted: ${hintProduct}` : '';

  return `You are a world-class social media content director working EXCLUSIVELY for ${campaignName}. This output goes live tomorrow morning. Every word must be 100% specific to ${campaignName}. Do NOT produce anything generic or reusable for another brand.

IF ANY FIELD BELOW IS LEFT AS A PLACEHOLDER OR GENERIC DESCRIPTION, THE ENTIRE OUTPUT IS REJECTED.

\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
BRAND INTELLIGENCE \u2014 USE ALL OF THIS
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
Brand: ${campaignName}
Platform: ${primaryPlatform} (${platformFormat})
Content Format: ${formatHeader}\n${topicLine}

${brandIntelLines.join('\n')}

${captionsBlock}

════════════════════════════════════
FORMAT-SPECIFIC INSTRUCTIONS
════════════════════════════════════
${formatBlock.instructions}

════════════════════════════════════
YOUR MISSION
════════════════════════════════════
Using ONLY the brand intelligence above, create a complete, publish-ready ${format} guide for ${campaignName}.

GLOBAL RULES (apply to ALL formats):
1. Font names must be real CapCut/Canva fonts: Bebas Neue, Montserrat Bold, DM Sans, Poppins SemiBold, Anton, Oswald
2. All colors must be real hex codes: #FFFFFF not "white"
3. ${editingTool} editing steps must name the exact menu path and setting values relevant to ${editingContext}
4. Mistakes to avoid must be SPECIFIC to ${campaignName}'s ${format} content on ${primaryPlatform}
5. The Canva layout must reflect the ${format} format — not a generic reel cover

Return ONLY a valid JSON object. No markdown. No explanation. Start with { end with }.

{
  ${formatBlock.scriptSchema},
  "editingInstructions": [
    { "step": 1, "tool": "${editingTool}", "action": "exact first ${editingTool} action specific to ${campaignName} ${format}",       "detail": "exact menu path, exact setting values, exact numbers" },
    { "step": 2, "tool": "${editingTool}", "action": "second step for ${campaignName} ${format}",                                    "detail": "specific settings and values" },
    { "step": 3, "tool": "${editingTool}", "action": "third step — color/style matching ${campaignName} brand tone for ${format}",    "detail": "specific filter name and intensity, or exact animation setting" },
    { "step": 4, "tool": "${editingTool}", "action": "fourth step — pacing or layout specific to ${campaignName} ${format}",          "detail": "exact setting name, duration or value" },
    { "step": 5, "tool": "Canva",          "action": "create ${campaignName} ${format} cover/thumbnail graphic",                      "detail": "exact dimensions, exact font, exact colors from brand palette" }
  ],
  "canvaLayout": {
    "format": "${format === 'carousel' ? '1080x1080 (1:1 square) carousel for ' + primaryPlatform : format === 'story' ? '1080x1920 (9:16 vertical) Story for ' + primaryPlatform : '1080x1920 (9:16 vertical) for ' + primaryPlatform}",
    "background": "#hexcode — chosen to match ${campaignName} brand tone",
    "titleText": {
      "content": "EXACT words from ${campaignName} tagline or key message — the real text, no placeholders",
      "font": "real font name",
      "size": "exact px value e.g. 88px",
      "color": "#hexcode",
      "placement": "exact position e.g. centered horizontally, 18% from top"
    },
    "bodyText": {
      "content": "EXACT supporting line from ${campaignName} campaign — real brand copy",
      "font": "real font name",
      "size": "exact px value e.g. 34px",
      "color": "#hexcode",
      "placement": "exact position"
    },
    "accentElement": "exact graphic element — specific shape, exact color #hexcode, exact placement and dimensions"
  },
  "thumbnailIdea": {
    "visualComposition": "exact ${format === 'carousel' ? 'cover slide' : format === 'photo' ? 'photo' : 'thumbnail'} description for ${campaignName} — who/what is in shot and where",
    "textOverlay": "EXACT words on the ${format === 'carousel' ? 'cover slide' : 'thumbnail'} — real ${campaignName} campaign language, scroll-stopping",
    "font": "real font name and weight",
    "textColor": "#hexcode",
    "backgroundColor": "#hexcode",
    "highlightElement": "one specific visual trick to make the ${campaignName} ${format === 'carousel' ? 'cover' : 'thumbnail'} stand out"
  },
  "mistakesToAvoid": [
    { "mistake": "specific mistake ${campaignName} creators make for ${format} content on ${primaryPlatform}",           "whyItHurts": "exact consequence for ${campaignName} — specific metric or audience reaction", "fix": "exact corrective action specific to ${campaignName} ${format} on ${primaryPlatform}" },
    { "mistake": "second mistake specific to ${campaignName} ${format} format or brand tone",                          "whyItHurts": "exact consequence",                                                        "fix": "exact fix" },
    { "mistake": "third mistake specific to ${campaignName} ${format} campaign goal or target audience",                "whyItHurts": "exact consequence",                                                        "fix": "exact fix" }
  ]
}`;
}

// ─────────────────────────────────────────────────────────────────
// Smart fallback — uses real brand data, never generic placeholders
// ─────────────────────────────────────────────────────────────────
function buildSmartFallback(ctx, format = "reel") {
  const {
    campaignName    = "Your Brand",
    platforms       = ["Instagram"],
    tone            = "Inspirational",
    tagline         = "",
    campaignGoal    = "",
    targetAudience  = "",
    sampleCaptions  = [],
    contentHint     = "",
    keyMessage      = "",
    productService  = "",
  } = ctx;

  const primaryPlatform = platforms[0] || "Instagram";

  const hookText  = tagline      || keyMessage    || `${campaignName} — See Why Everyone's Talking`;
  const ctaText   = campaignGoal ? `${campaignGoal} — Link in bio` : `Follow ${campaignName} for more`;
  const bodyLine  = targetAudience ? `Built for ${targetAudience}` : `Powered by ${campaignName}`;
  const scene2txt = sampleCaptions[0] ? sampleCaptions[0].slice(0, 60) : `${campaignName} — this changes everything`;
  const thumbText = tagline || `Why ${campaignName}?`;
  const product   = productService || campaignName;

  const toneBg = {
    "Professional":  "#0D1117",
    "Bold":          "#1A0A2E",
    "Inspirational": "#0A1628",
    "Casual":        "#1C1C2E",
    "Humorous":      "#1A1A00",
    "Empathetic":    "#0D1A0D",
    "Urgent":        "#1A0000",
  };
  const bg = toneBg[tone] || "#0D0F1A";

  const editingInstructions = [
    {
      step: 1, tool: format === "carousel" || format === "photo" || format === "thread" ? "Canva" : "CapCut",
      action: format === "carousel" ? `Open Canva → Create → Instagram Carousel (1080×1080). Add 5 slides using ${campaignName} brand colours.`
            : format === "photo"    ? `Open Canva → Create → Instagram Post (1080×1080). Upload your product/brand photo as background.`
            : format === "story"    ? `Open CapCut → New Project → Aspect Ratio 9:16 (1080×1920). Import 3 clips max 5s each.`
            : format === "thread"   ? `Open Twitter/X → New Tweet. Type tweet 1. Click '+' to add each subsequent tweet in the thread.`
            : `Set video speed to 1.05x on all talking clips`,
      detail: format === "carousel" ? `Design tab → Background → set to ${bg}. Add text frame for each slide. Use Bebas Neue 88px for headlines.`
            : format === "photo"    ? `Adjust → Filters → Vivid at 40%. Add text element: Montserrat Bold 72px, colour #FFFFFF, bottom-left aligned.`
            : format === "story"    ? `Select clip → Speed → Normal → drag to 1.05x. Removes dead air without sounding rushed.`
            : format === "thread"   ? `Draft all 5 tweets in a notes app first to check character counts. Each must be under 280 chars.`
            : `Select clip → Speed → Normal → drag to 1.05x. Apply to every talking-head clip individually.`,
    },
    {
      step: 2, tool: format === "carousel" || format === "photo" || format === "thread" ? "Canva" : "CapCut",
      action: `Add ${campaignName} brand typography`,
      detail: `Font: Bebas Neue for headlines, DM Sans Regular for body text. Title: #FFFFFF at 88px. Body: #D1D5DB at 34px.`,
    },
    {
      step: 3, tool: format === "carousel" || format === "photo" ? "Canva" : "CapCut",
      action: `Apply ${campaignName} colour palette`,
      detail: `Background: ${bg}. Accent line: #3B6BF5 at 3px between title and body. All text must have minimum contrast ratio 4.5:1 against background.`,
    },
    {
      step: 4, tool: format === "carousel" || format === "photo" || format === "thread" ? "Canva" : "CapCut",
      action: `Add ${campaignName} logo or watermark`,
      detail: `Upload logo PNG (transparent background). Place bottom-right corner at 10% opacity for subtle brand presence. Size: 80px wide maximum.`,
    },
    {
      step: 5, tool: "Canva",
      action: `Export ${campaignName} ${format} at correct dimensions`,
      detail: format === "carousel" ? `Download → PNG → All pages. Each slide exports as 1080×1080px.`
            : format === "story"    ? `Download → MP4 Video → 1080×1920px.`
            : format === "thread"   ? `Download → PNG for any image attachments → 1200×675px (16:9).`
            : `Download → MP4 Video → 1080×1920px (9:16 vertical).`,
    },
  ];

  const canvaLayout = {
    format:     format === "carousel" ? "1080x1080 (1:1 square) carousel" : format === "story" ? "1080x1920 (9:16 vertical) Story" : "1080x1920 (9:16 vertical)",
    background: `${bg} solid`,
    titleText:  { content: hookText,  font: "Bebas Neue",      size: "92px", color: "#FFFFFF", placement: "centered horizontally, 18% from top" },
    bodyText:   { content: bodyLine,  font: "DM Sans Regular", size: "34px", color: "#D1D5DB", placement: "centered horizontally, 38% from top" },
    accentElement: `Horizontal rule 380px wide, 3px thick, colour #3B6BF5, placed 8px below title text`,
  };

  const thumbnailIdea = {
    visualComposition: `Creator or product occupies left 60% of frame. ${campaignName} logo or product result on right 40%. High-contrast light from screen-right.`,
    textOverlay:       thumbText,
    font:              "Montserrat ExtraBold",
    textColor:         "#FFDD00",
    backgroundColor:   bg,
    highlightElement:  `Bright yellow rounded rectangle behind the text overlay "${thumbText}" — instant contrast against ${bg} background`,
  };

  const mistakesToAvoid = [
    {
      mistake:    `Opening the ${format} with ${campaignName}'s name or a greeting before the hook`,
      whyItHurts: `${primaryPlatform} users decide in 1.5 seconds. Saying the brand name first is wasted screen time.`,
      fix:        `Start immediately with the hook: "${hookText}" as the very first words.`,
    },
    {
      mistake:    `Using vague CTAs like "Learn More" or "Check It Out" for ${campaignName}`,
      whyItHurts: `For ${targetAudience || "your audience"}, generic CTAs blend into the noise and reduce click-through rate.`,
      fix:        `Replace with a specific benefit-CTA: "${ctaText}" — tells the viewer exactly what they'll get.`,
    },
    {
      mistake:    `Not matching the ${tone} tone in the ${format} visual style`,
      whyItHurts: `Visual mismatches break the viewer's emotional state and reduce saves/shares.`,
      fix:        `Stick to the ${bg} background with #FFFFFF text and #3B6BF5 accents throughout all ${campaignName} content.`,
    },
  ];

  if (format === "carousel") {
    return {
      carouselSlides: [
        { slideNumber: 1, role: "Cover — scroll-stopping hook",    headline: hookText,                                              body: "",                                                          visualDirection: `${bg} background, Bebas Neue headline centred, brand logo top-right` },
        { slideNumber: 2, role: "Problem or insight",              headline: `The problem with most ${product}s`,                   body: targetAudience ? `If you're ${targetAudience}, you've felt this.` : `Most brands get this wrong.`, visualDirection: `Split layout — text left 60%, illustration right 40%, ${bg} bg` },
        { slideNumber: 3, role: "Value proof or feature",          headline: `Here's how ${campaignName} fixes it`,                 body: keyMessage || `${product} — built different, results you can see.`, visualDirection: `Product/service close-up image, text overlay bottom-third` },
        { slideNumber: 4, role: "Social proof or result",          headline: `Real results from real ${targetAudience || "people"}`, body: sampleCaptions[0] ? sampleCaptions[0].slice(0, 80) : `${campaignName} customers see results in weeks.`, visualDirection: `Testimonial-style card, light text on ${bg}, quotation mark graphic` },
        { slideNumber: 5, role: "CTA slide",                       headline: ctaText.split("—")[0].trim(),                           body: "Link in bio → swipe up → tap to shop",                      visualDirection: `Bold CTA layout, ${bg} background, #3B6BF5 button element, ${campaignName} logo centred` },
      ],
      editingInstructions,
      canvaLayout,
      thumbnailIdea,
      mistakesToAvoid,
    };
  }

  if (format === "photo") {
    return {
      photoPost: {
        imageDirection: `Close-up flat lay of ${product} on a branded background. Natural window light from the left. ${campaignName} logo subtly visible.`,
        textOverlay:    hookText,
        textPlacement:  "bottom-left, 48px from edge",
        caption:        `${hookText}\n\n${keyMessage || bodyLine}\n\n${ctaText}\n\n#${campaignName.replace(/\s+/g, "")} #${primaryPlatform.replace(/\s+/g, "")}`,
      },
      editingInstructions,
      canvaLayout,
      thumbnailIdea,
      mistakesToAvoid,
    };
  }

  if (format === "story") {
    return {
      storyFrames: [
        { frameNumber: 1, duration: "0–4s",   role: "Tease/Hook",   onScreenText: hookText,                                       action: `Open on ${product} close-up or creator face. Quick cut in from black.`, textPlacement: "centered" },
        { frameNumber: 2, duration: "4–11s",  role: "Value/Reveal", onScreenText: keyMessage || `${campaignName}: Here's the difference`, action: `Show product in use or key benefit demonstration.`,                  textPlacement: "bottom-third" },
        { frameNumber: 3, duration: "11–15s", role: "CTA/Swipe",    onScreenText: ctaText,                                        action: `Creator points to swipe-up or link sticker. Add ${campaignName} link sticker.`, textPlacement: "bottom-center" },
      ],
      editingInstructions,
      canvaLayout,
      thumbnailIdea,
      mistakesToAvoid,
    };
  }

  if (format === "thread") {
    return {
      twitterThread: [
        { tweetNumber: 1, role: "Hook",    text: `${hookText} 🧵` },
        { tweetNumber: 2, role: "Value 1", text: keyMessage || `${campaignName} was built for ${targetAudience || "people who want results"}. Here's why it works:` },
        { tweetNumber: 3, role: "Value 2", text: sampleCaptions[0] ? sampleCaptions[0].slice(0, 270) : `The difference with ${campaignName}: ${bodyLine}` },
        { tweetNumber: 4, role: "Value 3", text: campaignGoal ? `Our goal: ${campaignGoal}. And we're just getting started.` : `${campaignName} is not for everyone. It's for ${targetAudience || "those who choose better"}.` },
        { tweetNumber: 5, role: "CTA",     text: ctaText },
      ],
      editingInstructions,
      canvaLayout,
      thumbnailIdea,
      mistakesToAvoid,
    };
  }

  // DEFAULT: REEL / SHORT
  return {
    reelScript: {
      hook:   { timing: "0:00–0:02", action: `Open on product/brand shot. Creator looks directly at camera and says: "${hookText}"`, onScreenText: hookText, textPlacement: "bottom-third" },
      scenes: [
        { sceneNumber: 1, timing: "0:02–0:07",  action: `Cut to close-up of ${product} in use. Show the core value in action.`,                                                  onScreenText: keyMessage || `Here's what ${campaignName} actually does:`, textPlacement: "top-center" },
        { sceneNumber: 2, timing: "0:07–0:15",  action: `Show the result or transformation. ${targetAudience ? `Audience: ${targetAudience} seeing the outcome.` : "Show before and after or the payoff."}`, onScreenText: scene2txt, textPlacement: "middle" },
        { sceneNumber: 3, timing: "0:15–0:22",  action: `Back to creator facing camera. Summarise the value of ${campaignName} in one sentence.`,                              onScreenText: bodyLine, textPlacement: "bottom-third" },
      ],
      cta: { timing: "0:22–0:27", action: `Creator points down toward the caption/link. Say: "${ctaText}"`, onScreenText: ctaText, textPlacement: "bottom-center" },
    },
    editingInstructions,
    canvaLayout,
    thumbnailIdea,
    mistakesToAvoid,
  };
}

// ── Route handler ──────────────────────────────────────────────────
router.post("/", async (req, res) => {
  try {
    const { ctx, content } = req.body;

    const campaignCtx = ctx || {
      campaignName:   "Campaign",
      platforms:      ["Instagram"],
      tone:           "",
      contentHint:    content || "",
      tagline:        "",
      campaignGoal:   "",
      targetAudience: "",
      brandVoice:     "",
      bigIdea:        "",
      sampleCaptions: [],
      productService: "",
      keyMessage:     "",
    };

    if (!campaignCtx.campaignName && !content) {
      return res.status(400).json({ error: "Campaign context or content is required." });
    }

    const format = detectContentFormat(campaignCtx.contentHint || "");
    const generateWithFallback = res.locals.generateWithFallback;
    let parsed = null;

    if (typeof generateWithFallback === "function") {
      const prompt = buildPrompt(campaignCtx);

      console.log(`[creator-studio] Generating for campaign: "${campaignCtx.campaignName}" | Platform: ${(campaignCtx.platforms || []).join(", ")} | Format: ${format}`);

      parsed = await generateWithFallback(prompt, {
        temperature: TEMPERATURE_PRESETS.creative || 0.9,
        maxTokens:   4096,
      });

      if (!parsed) {
        console.warn(`[creator-studio] Gemini returned null for "${campaignCtx.campaignName}". Using domain-specific smart fallback.`);
      } else {
        console.log(`[creator-studio] ✓ AI generation succeeded for "${campaignCtx.campaignName}" (format: ${format})`);
      }
    }

    // Domain-specific smart fallback — uses real brand data, never generic placeholders
    if (!parsed) {
      parsed = buildSmartFallback(campaignCtx, format);
    }

    return res.json(sanitise(parsed, format));

  } catch (err) {
    console.error("[creator-studio] Fatal error:", err);
    return res.status(500).json({ error: "Creator Studio generation failed. Please try again." });
  }
});

// ── Sanitise ───────────────────────────────────────────────────────
function str(v) { return String(v || ""); }
function arr(v) { return Array.isArray(v) ? v : []; }

function sanitise(p, format = "reel") {
  const editingInstructions = arr(p.editingInstructions).map((e, i) => ({
    step:   Number(e.step) || i + 1,
    tool:   str(e.tool),
    action: str(e.action),
    detail: str(e.detail),
  }));

  const cl = p.canvaLayout   || {};
  const tt = cl.titleText    || {};
  const bt = cl.bodyText     || {};
  const ti = p.thumbnailIdea || {};

  const mistakesToAvoid = arr(p.mistakesToAvoid).map(m => ({
    mistake:    str(m.mistake),
    whyItHurts: str(m.whyItHurts),
    fix:        str(m.fix),
  }));

  const common = {
    contentFormat: format,
    editingInstructions,
    canvaLayout: {
      format:        str(cl.format),
      background:    str(cl.background),
      titleText: {
        content:   str(tt.content),
        font:      str(tt.font),
        size:      str(tt.size),
        color:     str(tt.color),
        placement: str(tt.placement),
      },
      bodyText: {
        content:   str(bt.content),
        font:      str(bt.font),
        size:      str(bt.size),
        color:     str(bt.color),
        placement: str(bt.placement),
      },
      accentElement: str(cl.accentElement),
    },
    thumbnailIdea: {
      visualComposition: str(ti.visualComposition),
      textOverlay:       str(ti.textOverlay),
      font:              str(ti.font),
      textColor:         str(ti.textColor),
      backgroundColor:   str(ti.backgroundColor),
      highlightElement:  str(ti.highlightElement),
    },
    mistakesToAvoid,
  };

  const reelStub = {
    hook:   { timing: "", action: "", onScreenText: "", textPlacement: "" },
    scenes: [],
    cta:    { timing: "", action: "", onScreenText: "", textPlacement: "" },
  };

  if (format === "carousel") {
    const slides = arr(p.carouselSlides).map(s => ({
      slideNumber:     Number(s.slideNumber) || 1,
      role:            str(s.role),
      headline:        str(s.headline),
      body:            str(s.body),
      visualDirection: str(s.visualDirection),
    }));
    while (slides.length < 5) {
      slides.push({ slideNumber: slides.length + 1, role: "", headline: "", body: "", visualDirection: "" });
    }
    return { ...common, reelScript: reelStub, carouselSlides: slides };
  }

  if (format === "photo") {
    const pp = p.photoPost || {};
    return {
      ...common,
      reelScript: reelStub,
      photoPost: {
        imageDirection: str(pp.imageDirection),
        textOverlay:    str(pp.textOverlay),
        textPlacement:  str(pp.textPlacement),
        caption:        str(pp.caption),
      },
    };
  }

  if (format === "story") {
    const frames = arr(p.storyFrames).map(f => ({
      frameNumber:   Number(f.frameNumber) || 1,
      duration:      str(f.duration),
      role:          str(f.role),
      onScreenText:  str(f.onScreenText),
      action:        str(f.action),
      textPlacement: str(f.textPlacement),
    }));
    while (frames.length < 3) {
      frames.push({ frameNumber: frames.length + 1, duration: "", role: "", onScreenText: "", action: "", textPlacement: "" });
    }
    return { ...common, reelScript: reelStub, storyFrames: frames };
  }

  if (format === "thread") {
    const tweets = arr(p.twitterThread).map(t => ({
      tweetNumber: Number(t.tweetNumber) || 1,
      role:        str(t.role),
      text:        str(t.text),
    }));
    while (tweets.length < 5) {
      tweets.push({ tweetNumber: tweets.length + 1, role: "", text: "" });
    }
    return { ...common, reelScript: reelStub, twitterThread: tweets };
  }

  // REEL / SHORT (default)
  const rs     = p.reelScript || {};
  const hook   = rs.hook || {};
  const cta    = rs.cta  || {};
  const scenes = arr(rs.scenes).map(s => ({
    sceneNumber:   Number(s.sceneNumber) || 1,
    timing:        str(s.timing),
    action:        str(s.action),
    onScreenText:  str(s.onScreenText),
    textPlacement: str(s.textPlacement),
  }));

  return {
    ...common,
    reelScript: {
      hook:   { timing: str(hook.timing), action: str(hook.action), onScreenText: str(hook.onScreenText), textPlacement: str(hook.textPlacement) },
      scenes,
      cta:    { timing: str(cta.timing),  action: str(cta.action),  onScreenText: str(cta.onScreenText),  textPlacement: str(cta.textPlacement) },
    },
  };
}

module.exports = router;
