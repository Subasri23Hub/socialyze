/**
 * Creator Studio Route
 * =========================================================
 * POST /creator-studio
 *
 * LLM Provider : Groq (via generateWithFallback in res.locals)
 * Fallback      : Domain-specific structured content (buildSmartFallback)
 *
 * Team   : Subasri B | Gautham Krishnan K | Ashwin D | Vinjarapu Ajay Kumar
 * Company: Sourcesys Technologies
 */

const express = require("express");
const router  = express.Router();
const { TEMPERATURE_PRESETS } = require("../config");

// Detect content format from the user's content hint
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

// Build format-specific script section of the prompt
function buildFormatBlock(format, campaignName, primaryPlatform, tone) {
  const toneNote = tone ? `Tone: "${tone}" - match this energy in every word.` : "Match brand voice throughout.";

  const FORMATS = {
    carousel: {
      scriptKey: "carouselSlides",
      editingTool: "Canva",
      instructions: `5-slide ${primaryPlatform} carousel for ${campaignName}. NOT a video. Slide 1 = scroll-stopping cover. Slide 5 = CTA. ${toneNote} Every headline = ACTUAL words on the slide. Every body = publish-ready copy. No placeholder text.`,
      scriptSchema: `"carouselSlides":[{"slideNumber":1,"role":"Cover hook","headline":"exact words","body":"","visualDirection":"bg #hex, layout"},{"slideNumber":2,"role":"Problem","headline":"","body":"","visualDirection":""},{"slideNumber":3,"role":"Value proof","headline":"","body":"","visualDirection":""},{"slideNumber":4,"role":"Social proof","headline":"","body":"","visualDirection":""},{"slideNumber":5,"role":"CTA","headline":"","body":"","visualDirection":""}]`,
    },
    photo: {
      scriptKey: "photoPost",
      editingTool: "Canva",
      instructions: `Single static photo post for ${campaignName} on ${primaryPlatform}. NOT a video. ${toneNote} imageDirection = exact shot details. textOverlay = ACTUAL words on image. Caption = full publish-ready ${primaryPlatform} post with hook, hashtags, CTA.`,
      scriptSchema: `"photoPost":{"imageDirection":"exact shot: subject, framing, lighting, props","textOverlay":"exact words on image","textPlacement":"e.g. bottom-left","caption":"full ${primaryPlatform} caption with hook, body, hashtags, CTA"}`,
    },
    story: {
      scriptKey: "storyFrames",
      editingTool: "CapCut",
      instructions: `3-frame ${primaryPlatform} Story (9:16, 15s max) for ${campaignName}. Sequence: tease -> value -> CTA. ${toneNote} Each frame: exact on-screen text, duration in seconds.`,
      scriptSchema: `"storyFrames":[{"frameNumber":1,"duration":"0-4s","role":"Tease","onScreenText":"exact words","action":"visual","textPlacement":"centered"},{"frameNumber":2,"duration":"4-11s","role":"Value","onScreenText":"exact words","action":"visual","textPlacement":"bottom-third"},{"frameNumber":3,"duration":"11-15s","role":"CTA","onScreenText":"exact CTA","action":"visual","textPlacement":"bottom-center"}]`,
    },
    short: {
      scriptKey: "reelScript",
      editingTool: "CapCut",
      instructions: `YouTube Short for ${campaignName} (60s max, 9:16). Hook in first 3 seconds. Structure: hook -> 3 beats -> CTA. ${toneNote} Every action = exactly what creator says/does. Title under 60 chars.`,
      scriptSchema: `"reelScript":{"hook":{"timing":"0:00-0:03","action":"exact action","onScreenText":"exact hook","textPlacement":"bottom-third"},"scenes":[{"sceneNumber":1,"timing":"0:03-0:18","action":"","onScreenText":"","textPlacement":"top-center"},{"sceneNumber":2,"timing":"0:18-0:40","action":"","onScreenText":"","textPlacement":"middle"},{"sceneNumber":3,"timing":"0:40-0:55","action":"","onScreenText":"","textPlacement":"bottom-third"}],"cta":{"timing":"0:55-1:00","action":"verbal CTA + subscribe","onScreenText":"exact CTA","textPlacement":"bottom-center"}}`,
    },
    thread: {
      scriptKey: "twitterThread",
      editingTool: "Twitter/X",
      instructions: `5-tweet Twitter/X thread for ${campaignName}. Each tweet <= 280 chars. Hook -> 3 value tweets -> CTA. ${toneNote} Every tweet = actual text to post. Hook must NOT start with "Introducing".`,
      scriptSchema: `"twitterThread":[{"tweetNumber":1,"role":"Hook","text":"exact tweet"},{"tweetNumber":2,"role":"Value 1","text":""},{"tweetNumber":3,"role":"Value 2","text":""},{"tweetNumber":4,"role":"Value 3","text":""},{"tweetNumber":5,"role":"CTA","text":"exact CTA"}]`,
    },
  };

  const reel = {
    scriptKey: "reelScript",
    editingTool: "CapCut",
    instructions: `${primaryPlatform} Reel for ${campaignName} (9:16, 15-30s). Hook in first 2 seconds. Structure: hook -> 3 scenes -> CTA. ${toneNote} Every on-screen text = exact words. Every timing = specific range. Every action = exact shot description.`,
    scriptSchema: `"reelScript":{"hook":{"timing":"0:00-0:02","action":"exact opening","onScreenText":"exact hook","textPlacement":"bottom-third"},"scenes":[{"sceneNumber":1,"timing":"0:02-0:08","action":"","onScreenText":"","textPlacement":"top-center"},{"sceneNumber":2,"timing":"0:08-0:18","action":"","onScreenText":"","textPlacement":"middle"},{"sceneNumber":3,"timing":"0:18-0:24","action":"","onScreenText":"","textPlacement":"bottom-third"}],"cta":{"timing":"0:24-0:30","action":"exact closing","onScreenText":"exact CTA","textPlacement":"bottom-center"}}`,
  };

  return FORMATS[format] || reel;
}

// Prompt builder
function buildPrompt(ctx) {
  const {
    campaignName, platforms = [], tone = "", brandVoice = "",
    campaignGoal = "", targetAudience = "", tagline = "",
    bigIdea = "", sampleCaptions = [], contentHint = "",
    productService = "", keyMessage = "",
  } = ctx;

  const format = detectContentFormat(contentHint);
  const hintLower = contentHint.toLowerCase();
  let primaryPlatform = platforms[0] || "Instagram";
  if (/tiktok/.test(hintLower))             primaryPlatform = "TikTok";
  else if (/linkedin/.test(hintLower))      primaryPlatform = "LinkedIn";
  else if (/twitter|tweet/.test(hintLower)) primaryPlatform = "Twitter";
  else if (/youtube|yt/.test(hintLower))    primaryPlatform = "YouTube";
  else if (/facebook/.test(hintLower))      primaryPlatform = "Facebook";
  else if (/instagram/.test(hintLower))     primaryPlatform = "Instagram";

  const pfMap = {
    Instagram: "9:16, hook in 2s",
    TikTok:    "9:16, hook in 1.5s, raw POV",
    YouTube:   "16:9 or 9:16, thumbnail=90% clicks",
    LinkedIn:  "1:1, professional",
    Facebook:  "1:1, community",
    Twitter:   "1:1, punchy",
  };
  const formatBlock = buildFormatBlock(format, campaignName, primaryPlatform, tone);
  const editingTool = formatBlock.editingTool || "CapCut";

  const brandLines = [
    tagline        && `Tagline: "${tagline}"`,
    bigIdea        && `Big Idea: ${bigIdea}`,
    brandVoice     && `Brand Voice: ${brandVoice}`,
    targetAudience && `Audience: ${targetAudience}`,
    campaignGoal   && `Goal: ${campaignGoal}`,
    productService && `Product: ${productService}`,
    keyMessage     && `Key Message: ${keyMessage}`,
    tone           && `Tone: ${tone}`,
  ].filter(Boolean).join("\n");

  const captionsBlock = sampleCaptions.length
    ? `Reference captions (match this voice):\n${sampleCaptions.slice(0,2).map((c,i)=>`${i+1}: ${c}`).join("\n")}`
    : "";

  const topicLine = contentHint
    ? contentHint.replace(/^(a |an |the |create |make |build |write |generate )?(instagram|linkedin|tiktok|twitter|youtube|facebook)?\s*(reel|carousel|post|story|short|thread|video|photo|image)?\s*(for\s)?/i, '').trim()
    : "";

  return `You are a social media content director for ${campaignName}. Create a publish-ready ${format} guide. Every field must be 100% specific to ${campaignName} - no generic filler.

BRAND: ${campaignName} | Platform: ${primaryPlatform} (${pfMap[primaryPlatform] || "native format"}) | Format: ${format.toUpperCase()}${contentHint ? ` ("${contentHint}")` : ""}${topicLine ? ` | Topic: ${topicLine}` : ""}
${brandLines}
${captionsBlock}

FORMAT: ${formatBlock.instructions}

Rules: Real fonts (Bebas Neue, Montserrat Bold, DM Sans, Poppins SemiBold). All colors = hex codes. ${editingTool} steps must have exact menu paths. Mistakes specific to ${campaignName} on ${primaryPlatform}.

Return ONLY valid JSON. Start { end }.
{
  ${formatBlock.scriptSchema},
  "editingInstructions":[
    {"step":1,"tool":"${editingTool}","action":"exact first action for ${campaignName} ${format}","detail":"exact menu path and values"},
    {"step":2,"tool":"${editingTool}","action":"typography","detail":"exact font, size, hex color"},
    {"step":3,"tool":"${editingTool}","action":"color palette","detail":"filter or palette values"},
    {"step":4,"tool":"${editingTool}","action":"pacing or layout","detail":"exact setting and value"},
    {"step":5,"tool":"Canva","action":"thumbnail/cover for ${campaignName}","detail":"exact dimensions, font, colors"}
  ],
  "canvaLayout":{"format":"${format === 'carousel' ? '1080x1080 carousel' : format === 'story' ? '1080x1920 Story' : '1080x1920'} for ${primaryPlatform}","background":"#hex","titleText":{"content":"exact words from ${campaignName}","font":"real font","size":"px","color":"#hex","placement":"exact position"},"bodyText":{"content":"exact copy","font":"real font","size":"px","color":"#hex","placement":"exact position"},"accentElement":"shape, #hex, placement"},
  "thumbnailIdea":{"visualComposition":"exact description","textOverlay":"exact words","font":"real font","textColor":"#hex","backgroundColor":"#hex","highlightElement":"one visual trick"},
  "mistakesToAvoid":[
    {"mistake":"specific to ${campaignName} ${format} on ${primaryPlatform}","whyItHurts":"exact consequence","fix":"exact fix"},
    {"mistake":"second mistake","whyItHurts":"consequence","fix":"fix"},
    {"mistake":"third mistake","whyItHurts":"consequence","fix":"fix"}
  ]
}`;
}

// Smart fallback
function buildSmartFallback(ctx, format = "reel") {
  const {
    campaignName    = "Your Brand",
    platforms       = ["Instagram"],
    tone            = "Inspirational",
    tagline         = "",
    campaignGoal    = "",
    targetAudience  = "",
    sampleCaptions  = [],
    keyMessage      = "",
    productService  = "",
  } = ctx;

  const primaryPlatform = platforms[0] || "Instagram";
  const hookText  = tagline      || keyMessage    || `${campaignName} - See Why Everyone's Talking`;
  const ctaText   = campaignGoal ? `${campaignGoal} - Link in bio` : `Follow ${campaignName} for more`;
  const bodyLine  = targetAudience ? `Built for ${targetAudience}` : `Powered by ${campaignName}`;
  const scene2txt = sampleCaptions[0] ? sampleCaptions[0].slice(0, 60) : `${campaignName} - this changes everything`;
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
      action: format === "carousel" ? `Open Canva > Create > Instagram Carousel (1080x1080). Add 5 slides using ${campaignName} brand colours.`
            : format === "photo"    ? `Open Canva > Create > Instagram Post (1080x1080). Upload your product/brand photo as background.`
            : format === "story"    ? `Open CapCut > New Project > Aspect Ratio 9:16 (1080x1920). Import 3 clips max 5s each.`
            : format === "thread"   ? `Open Twitter/X > New Tweet. Type tweet 1. Click '+' to add each subsequent tweet in the thread.`
            : `Set video speed to 1.05x on all talking clips`,
      detail: format === "carousel" ? `Design tab > Background > set to ${bg}. Add text frame for each slide. Use Bebas Neue 88px for headlines.`
            : format === "photo"    ? `Adjust > Filters > Vivid at 40%. Add text element: Montserrat Bold 72px, colour #FFFFFF, bottom-left aligned.`
            : format === "story"    ? `Select clip > Speed > Normal > drag to 1.05x. Removes dead air without sounding rushed.`
            : format === "thread"   ? `Draft all 5 tweets in a notes app first to check character counts. Each must be under 280 chars.`
            : `Select clip > Speed > Normal > drag to 1.05x. Apply to every talking-head clip individually.`,
    },
    {
      step: 2, tool: format === "carousel" || format === "photo" || format === "thread" ? "Canva" : "CapCut",
      action: `Add ${campaignName} brand typography`,
      detail: `Font: Bebas Neue for headlines, DM Sans Regular for body text. Title: #FFFFFF at 88px. Body: #D1D5DB at 34px.`,
    },
    {
      step: 3, tool: format === "carousel" || format === "photo" ? "Canva" : "CapCut",
      action: `Apply ${campaignName} colour palette`,
      detail: `Background: ${bg}. Accent line: #3B6BF5 at 3px between title and body. Minimum contrast ratio 4.5:1 against background.`,
    },
    {
      step: 4, tool: format === "carousel" || format === "photo" || format === "thread" ? "Canva" : "CapCut",
      action: `Add ${campaignName} logo or watermark`,
      detail: `Upload logo PNG (transparent background). Place bottom-right corner at 10% opacity. Size: 80px wide maximum.`,
    },
    {
      step: 5, tool: "Canva",
      action: `Export ${campaignName} ${format} at correct dimensions`,
      detail: format === "carousel" ? `Download > PNG > All pages. Each slide exports as 1080x1080px.`
            : format === "story"    ? `Download > MP4 Video > 1080x1920px.`
            : format === "thread"   ? `Download > PNG for any image attachments > 1200x675px (16:9).`
            : `Download > MP4 Video > 1080x1920px (9:16 vertical).`,
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
    visualComposition: `Creator or product occupies left 60% of frame. ${campaignName} logo on right 40%. High-contrast light from screen-right.`,
    textOverlay:       thumbText,
    font:              "Montserrat ExtraBold",
    textColor:         "#FFDD00",
    backgroundColor:   bg,
    highlightElement:  `Bright yellow rounded rectangle behind the text overlay "${thumbText}" - instant contrast against ${bg} background`,
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
      fix:        `Replace with a specific benefit-CTA: "${ctaText}" - tells the viewer exactly what they'll get.`,
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
        { slideNumber: 1, role: "Cover - scroll-stopping hook",    headline: hookText,                                              body: "",                                                          visualDirection: `${bg} background, Bebas Neue headline centred, brand logo top-right` },
        { slideNumber: 2, role: "Problem or insight",              headline: `The problem with most ${product}s`,                   body: targetAudience ? `If you're ${targetAudience}, you've felt this.` : `Most brands get this wrong.`, visualDirection: `Split layout - text left 60%, illustration right 40%, ${bg} bg` },
        { slideNumber: 3, role: "Value proof or feature",          headline: `Here's how ${campaignName} fixes it`,                 body: keyMessage || `${product} - built different, results you can see.`, visualDirection: `Product/service close-up image, text overlay bottom-third` },
        { slideNumber: 4, role: "Social proof or result",          headline: `Real results from real ${targetAudience || "people"}`, body: sampleCaptions[0] ? sampleCaptions[0].slice(0, 80) : `${campaignName} customers see results in weeks.`, visualDirection: `Testimonial-style card, light text on ${bg}, quotation mark graphic` },
        { slideNumber: 5, role: "CTA slide",                       headline: ctaText.split("-")[0].trim(),                           body: "Link in bio - swipe up - tap to shop",                      visualDirection: `Bold CTA layout, ${bg} background, #3B6BF5 button element, ${campaignName} logo centred` },
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
        { frameNumber: 1, duration: "0-4s",   role: "Tease/Hook",   onScreenText: hookText,                                       action: `Open on ${product} close-up or creator face. Quick cut in from black.`, textPlacement: "centered" },
        { frameNumber: 2, duration: "4-11s",  role: "Value/Reveal", onScreenText: keyMessage || `${campaignName}: Here's the difference`, action: `Show product in use or key benefit demonstration.`,                  textPlacement: "bottom-third" },
        { frameNumber: 3, duration: "11-15s", role: "CTA/Swipe",    onScreenText: ctaText,                                        action: `Creator points to swipe-up or link sticker. Add ${campaignName} link sticker.`, textPlacement: "bottom-center" },
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
        { tweetNumber: 1, role: "Hook",    text: `${hookText} (thread)` },
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
      hook:   { timing: "0:00-0:02", action: `Open on product/brand shot. Creator looks directly at camera and says: "${hookText}"`, onScreenText: hookText, textPlacement: "bottom-third" },
      scenes: [
        { sceneNumber: 1, timing: "0:02-0:07",  action: `Cut to close-up of ${product} in use. Show the core value in action.`,                                                  onScreenText: keyMessage || `Here's what ${campaignName} actually does:`, textPlacement: "top-center" },
        { sceneNumber: 2, timing: "0:07-0:15",  action: `Show the result or transformation. ${targetAudience ? `Audience: ${targetAudience} seeing the outcome.` : "Show before and after or the payoff."}`, onScreenText: scene2txt, textPlacement: "middle" },
        { sceneNumber: 3, timing: "0:15-0:22",  action: `Back to creator facing camera. Summarise the value of ${campaignName} in one sentence.`,                              onScreenText: bodyLine, textPlacement: "bottom-third" },
      ],
      cta: { timing: "0:22-0:27", action: `Creator points down toward the caption/link. Say: "${ctaText}"`, onScreenText: ctaText, textPlacement: "bottom-center" },
    },
    editingInstructions,
    canvaLayout,
    thumbnailIdea,
    mistakesToAvoid,
  };
}

// Route handler
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
        maxTokens:   2000,
      });

      if (!parsed) {
        console.warn(`[creator-studio] Groq returned null for "${campaignCtx.campaignName}". Using domain-specific smart fallback.`);
      } else {
        console.log(`[creator-studio] AI generation succeeded for "${campaignCtx.campaignName}" (format: ${format})`);
      }
    }

    if (!parsed) {
      parsed = buildSmartFallback(campaignCtx, format);
    }

    return res.json(sanitise(parsed, format));

  } catch (err) {
    console.error("[creator-studio] Fatal error:", err);
    return res.status(500).json({ error: "Creator Studio generation failed. Please try again." });
  }
});

// Sanitise
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
      titleText: { content: str(tt.content), font: str(tt.font), size: str(tt.size), color: str(tt.color), placement: str(tt.placement) },
      bodyText:  { content: str(bt.content), font: str(bt.font), size: str(bt.size), color: str(bt.color), placement: str(bt.placement) },
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
      slideNumber: Number(s.slideNumber) || 1,
      role: str(s.role), headline: str(s.headline), body: str(s.body), visualDirection: str(s.visualDirection),
    }));
    while (slides.length < 5) slides.push({ slideNumber: slides.length + 1, role: "", headline: "", body: "", visualDirection: "" });
    return { ...common, reelScript: reelStub, carouselSlides: slides };
  }

  if (format === "photo") {
    const pp = p.photoPost || {};
    return { ...common, reelScript: reelStub, photoPost: { imageDirection: str(pp.imageDirection), textOverlay: str(pp.textOverlay), textPlacement: str(pp.textPlacement), caption: str(pp.caption) } };
  }

  if (format === "story") {
    const frames = arr(p.storyFrames).map(f => ({
      frameNumber: Number(f.frameNumber) || 1,
      duration: str(f.duration), role: str(f.role), onScreenText: str(f.onScreenText), action: str(f.action), textPlacement: str(f.textPlacement),
    }));
    while (frames.length < 3) frames.push({ frameNumber: frames.length + 1, duration: "", role: "", onScreenText: "", action: "", textPlacement: "" });
    return { ...common, reelScript: reelStub, storyFrames: frames };
  }

  if (format === "thread") {
    const tweets = arr(p.twitterThread).map(t => ({ tweetNumber: Number(t.tweetNumber) || 1, role: str(t.role), text: str(t.text) }));
    while (tweets.length < 5) tweets.push({ tweetNumber: tweets.length + 1, role: "", text: "" });
    return { ...common, reelScript: reelStub, twitterThread: tweets };
  }

  // REEL / SHORT (default)
  const rs     = p.reelScript || {};
  const hook   = rs.hook || {};
  const cta    = rs.cta  || {};
  const scenes = arr(rs.scenes).map(s => ({
    sceneNumber: Number(s.sceneNumber) || 1,
    timing: str(s.timing), action: str(s.action), onScreenText: str(s.onScreenText), textPlacement: str(s.textPlacement),
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
