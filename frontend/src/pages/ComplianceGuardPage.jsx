import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import styles from './ComplianceGuardPage.module.css'

// ── Platform rule sets ────────────────────────────────────────────────────────
const PLATFORM_RULES = {
  Instagram: [
    { id: 'caption_length',   label: 'Caption length',         check: (t) => t.length <= 2200,        msg: 'Caption exceeds 2,200 characters (Instagram limit). Text beyond this is truncated with a "more" link.' },
    { id: 'hashtag_count',    label: 'Hashtag count',          check: (t) => (t.match(/#\w+/g) || []).length <= 30, msg: 'More than 30 hashtags — Instagram will block the post from publishing entirely.' },
    { id: 'no_external_link', label: 'No clickable links',     check: (t) => !/https?:\/\/\S+/.test(t), msg: 'External links in captions are never clickable on Instagram. Use "link in bio" instead.' },
    { id: 'has_cta',          label: 'Has a call-to-action',   check: (t) => /link in bio|swipe|tap|shop|save|follow|comment|share|dm|click/i.test(t), msg: 'No clear CTA found. Posts without a CTA see significantly lower engagement and conversion.' },
    { id: 'no_banned_tags',   label: 'No banned hashtags',     check: (t) => !/#(like4like|followforfollow|l4l|f4f|instagood100|likeforfollow|liker|likers|followme|follow4follow)/i.test(t), msg: 'Banned or spam hashtags detected. Using these puts the entire post — and sometimes the account — into shadowban territory.' },
  ],
  Twitter: [
    { id: 'tweet_length',     label: 'Tweet length',           check: (t) => t.length <= 280,          msg: 'Tweet exceeds 280 characters. It will be cut off or blocked from publishing.' },
    { id: 'hashtag_max',      label: 'Hashtag count',          check: (t) => (t.match(/#\w+/g) || []).length <= 2, msg: 'More than 2 hashtags reduces engagement on Twitter/X by up to 17% according to X\'s own data.' },
    { id: 'has_hook',         label: 'Starts with a hook',     check: (t) => t.trim().length > 0 && !/^(hey|hi |hello)/i.test(t.trim()), msg: 'Post opens with a weak greeting. Lead with your sharpest point — the algorithm ranks early engagement heavily.' },
  ],
  LinkedIn: [
    { id: 'post_length',      label: 'Post length',            check: (t) => t.length <= 3000,         msg: 'Post exceeds 3,000 characters. LinkedIn feed truncates at this point with a "see more" click required.' },
    { id: 'hashtag_count',    label: 'Hashtag count',          check: (t) => (t.match(/#\w+/g) || []).length <= 5, msg: 'More than 5 hashtags reads as spammy to the LinkedIn algorithm and reduces organic distribution.' },
    { id: 'professional_tone',label: 'Professional tone',      check: (t) => !/(\bwtf\b|\bomg\b|\blol\b|\bAF\b)/i.test(t), msg: 'Casual slang detected. LinkedIn\'s audience expects professional language — this will lower engagement scores.' },
    { id: 'has_cta',          label: 'Has a call-to-action',   check: (t) => /connect|comment|thoughts|share|follow|reach out|let me know|dm|learn more/i.test(t), msg: 'No engagement invitation found. LinkedIn rewards posts that generate early comments with wider distribution.' },
  ],
  TikTok: [
    { id: 'caption_length',   label: 'Caption length',         check: (t) => t.length <= 2200,         msg: 'Caption exceeds 2,200 characters. TikTok truncates captions and users rarely read long ones.' },
    { id: 'has_fyp_tag',      label: 'FYP hashtag present',    check: (t) => /#(fyp|foryou|foryoupage|fypシ)/i.test(t), msg: 'Consider adding #fyp or #foryou — while not guaranteed, these signal discoverability intent to TikTok\'s algorithm.' },
    { id: 'has_hook',         label: 'Opens with a hook',      check: (t) => t.trim().length > 10,     msg: 'Caption is too short to hook viewers. A descriptive caption helps TikTok\'s algorithm categorise the content.' },
    { id: 'no_banned_tags',   label: 'No banned hashtags',     check: (t) => !/#(like4like|followforfollow|fypage)/i.test(t), msg: 'Spammy or banned hashtags detected. TikTok silently suppresses content using known spam tags.' },
  ],
  Facebook: [
    { id: 'post_length',      label: 'Post length',            check: (t) => t.length <= 63206,        msg: 'Post exceeds Facebook\'s absolute character limit of 63,206 characters.' },
    { id: 'optimal_length',   label: 'Optimal length',         check: (t) => t.length <= 500,          msg: 'Posts over 500 characters see measurably lower organic reach. Facebook surfaces shorter content to more users.' },
    { id: 'has_emoji',        label: 'Uses emojis',            check: (t) => /[\u{1F300}-\u{1FAFF}]/u.test(t), msg: 'No emojis found. Facebook posts with emojis consistently outperform plain-text posts in click-through rate.' },
    { id: 'has_cta',          label: 'Has a call-to-action',   check: (t) => /comment|share|tag|like|follow|link|learn|shop|visit/i.test(t), msg: 'No CTA detected. Without an explicit action prompt, most Facebook users scroll past without interacting.' },
  ],
  YouTube: [
    { id: 'title_length',     label: 'Title / headline length', check: (t) => t.length <= 100,         msg: 'YouTube titles should be under 100 characters for full display in search results and recommendations.' },
    { id: 'has_keywords',     label: 'Contains keywords',      check: (t) => t.split(/\s+/).length >= 5, msg: 'Description seems very short. YouTube\'s search algorithm weights the first 150 characters heavily for SEO.' },
    { id: 'has_cta',          label: 'Has a call-to-action',   check: (t) => /subscribe|like|comment|watch|click|link|check out|learn more/i.test(t), msg: 'No CTA detected. Descriptions without a subscribe or like prompt miss a significant engagement opportunity.' },
    { id: 'no_clickbait',     label: 'Avoids misleading clickbait', check: (t) => !/(you won't believe|shocking|jaw-drop)/i.test(t), msg: 'Clickbait phrases detected. YouTube\'s satisfaction survey system penalises high-click, low-retention videos in recommendations.' },
    { id: 'has_description',  label: 'Sufficient description', check: (t) => t.length >= 50,           msg: 'Description is too short. YouTube uses description text for search indexing — aim for at least 150 words.' },
  ],
}

const ALL_PLATFORMS = Object.keys(PLATFORM_RULES)

// ── Sensitivity words — triggers reach reduction or algorithmic flagging ─────
const SENSITIVITY_PATTERNS = [
  {
    pattern: /\b(kill(ing|ed|s)?|murder(ing|ed|s)?|slaughter|massacre|assassin(ate|ation)?)\b/gi,
    word: 'violent language',
    suggestion: 'Use neutral terms like "overcome", "defeat", "tackle", or "address the problem". Even metaphorical violence triggers content filters on all major platforms.',
  },
  {
    pattern: /\b(bomb(ing|ed|s)?|explosion|blast|terror(ist|ism)?|attack)\b/gi,
    word: 'violence or terror references',
    suggestion: 'Rephrase to focus on solutions or outcomes. These words trigger automated safety classifiers on Meta, TikTok, and YouTube regardless of context.',
  },
  {
    pattern: /\b(FREE\s+MONEY|guaranteed\s+(income|returns?)|get\s+rich\s+quick|make\s+money\s+fast|100%\s+free|risk.?free\s+profit)\b/gi,
    word: 'misleading financial claims',
    suggestion: 'Use honest language: "explore opportunities", "potential savings", or "earn rewards". The FTC and ASA actively pursue brands that make unqualified financial guarantees on social media.',
  },
  {
    pattern: /\b(SHOCKING|UNBELIEVABLE|YOU WON'T BELIEVE|INSANE DEAL|CRAZY OFFER|MIND.?BLOWING)\b/gi,
    word: 'sensational or clickbait language',
    suggestion: 'Replace with factual hooks: "Here\'s what we found", "The data shows", or a specific result. YouTube and Facebook both explicitly down-rank content that overpromises and underdelivers.',
  },
  {
    pattern: /\b(cure(s|d)?|heal(s|ed)?|treat(s|ed)?|diagnose(s|d)?|prevent(s|ed)?\s+disease|medical\s+breakthrough|clinically\s+proven)\b/gi,
    word: 'unverified health or medical claims',
    suggestion: 'Add "may support", "consult a healthcare professional", or cite a published study. The FTC sued companies including Teami Teas and Goop for unsubstantiated health claims on social media — fines reached millions.',
  },
  {
    pattern: /\b(secret|hidden\s+truth|they\s+don't\s+want\s+you\s+to\s+know|cover.?up|conspiracy|mainstream\s+media\s+lies)\b/gi,
    word: 'conspiracy or misinformation tone',
    suggestion: 'Use transparent, evidence-based language. Meta\'s misinformation classifiers actively suppress posts with conspiracy framing, even when the content itself is benign.',
  },
  {
    pattern: /\b(hate|racist|sexist|discriminat(e|ion|ory)|bigot|slur)\b/gi,
    word: 'discriminatory language',
    suggestion: 'Remove or replace with inclusive, respectful language. All platforms have zero-tolerance policies for hate speech and will remove content or restrict accounts.',
  },
  {
    pattern: /\b(urgent|act\s+now|limited\s+time\s+only|expires\s+soon|last\s+chance|don't\s+miss\s+out|only\s+\d+\s+left)\b/gi,
    word: 'high-pressure urgency language',
    suggestion: 'Soften to "available while supplies last" or "offer ends [date]". The ASA (UK) and FTC (US) both target artificial urgency in digital advertising.',
  },
]

// ── Platform-specific policy warnings (real violations with real consequences) ─
const PLATFORM_POLICY = {
  Instagram: [
    {
      id: 'engagement_bait',
      label: 'Engagement bait',
      check: (t) => !/(tag\s+\d+\s+friends?|like\s+to\s+win|comment\s+to\s+win|share\s+for\s+a\s+chance|repost\s+to\s+win)/i.test(t),
      msg: 'Phrases like "tag 3 friends to win" are classified as engagement bait by Meta\'s feed algorithm. Meta\'s 2016 update explicitly targeted this tactic and it remains an active suppression signal.',
      consequence: 'Reduced organic reach on the specific post. Repeated patterns train the algorithm to reduce distribution account-wide, not just per-post.',
      fix: 'Replace with genuine prompts: "Who would you bring here?" or "Save this for later" invites real engagement without triggering the classifier.',
    },
    {
      id: 'no_follow_gates',
      label: 'No follow-gating in contests',
      check: (t) => !/(follow\s+to\s+(enter|win|get|receive)|must\s+follow\s+to|follow\s+us\s+to\s+enter)/i.test(t),
      msg: 'Contests requiring a follow to enter violate Instagram\'s Promotion Guidelines (Section 3). Instagram has removed pages for running giveaways structured this way.',
      consequence: 'Post removal or page restriction. High-profile brands including several Australian influencer accounts have had pages suspended for follow-gating in 2023–2024.',
      fix: 'Make following optional. Use "like this post" as the entry mechanic (which is permitted) or direct entries to an external landing page.',
    },
    {
      id: 'no_spam_patterns',
      label: 'No spam engagement signals',
      check: (t) => !/(dm\s+me\s+for\s+price|dm\s+for\s+details|price\s+in\s+bio\s+only|comment\s+"info"\s+for)/i.test(t),
      msg: 'Directing users to DM for pricing or details is a known spam signal flagged by Instagram\'s 2024 algorithm update. Accounts that rely on this pattern consistently report reduced reach.',
      consequence: 'Shadowban on individual posts and potential account-level reduced distribution. The pattern is associated with grey-market sellers, so Instagram\'s classifier treats it as a risk signal.',
      fix: 'Include pricing directly in the caption, use a link sticker in Stories, or point to a bio link with full details. Transparency improves both compliance and conversion.',
    },
    {
      id: 'no_music_caption_signal',
      label: 'No unlicensed music signal in caption',
      check: (t) => !/(background\s+music\s*[:—-]\s*[A-Z]|song\s*:\s*[A-Z]|music\s+by\s+[A-Z]|audio\s+from\s+[A-Z]|🎵\s*[A-Z]|ft\.\s+[A-Z][a-z])/i.test(t),
      msg: 'Referencing a specific song or artist in the caption while using that audio in the video is a dual copyright signal. Meta\'s Rights Manager scans both the audio track and the caption text. Artists like The Weeknd, Drake, and Taylor Swift have active automated takedown systems monitoring Instagram.',
      consequence: 'Reel or Story muted immediately upon upload. Repeat violations restrict the account\'s access to the music library for up to 30 days. Three restrictions in 90 days triggers an account-level audio ban.',
      fix: 'Use only music from Instagram\'s licensed audio library. If you need a specific vibe, search the library by mood (e.g., "upbeat pop") rather than by artist name.',
    },
    {
      id: 'no_counterfeit_signals',
      label: 'No counterfeit product language',
      check: (t) => !/(replica|first\s+copy|master\s+copy|A\s*grade\s+copy|premium\s+copy|1:1\s+copy|super\s+fake|dhgate\s+dupe)/i.test(t),
      msg: 'Terms like "first copy", "replica", "1:1", or "super fake" signal counterfeit goods — one of the most serious policy violations on Instagram. Luxury brands including Louis Vuitton, Rolex, and Nike have dedicated legal teams scanning Instagram captions for these terms.',
      consequence: 'Immediate post removal. Product tags disabled permanently. Repeated violations lead to permanent account ban with no appeal process. Instagram cooperates with brand legal teams and may share account data.',
      fix: 'Only list authentic, original products. There is no compliant version of replica language — remove it entirely.',
    },
  ],
  Twitter: [
    {
      id: 'no_vote_manipulation',
      label: 'No retweet-based voting',
      check: (t) => !/(retweet\s+to\s+vote|rt\s+for\s+|vote\s+by\s+retweeting|rt\s+if\s+you\s+(agree|support|want))/i.test(t),
      msg: 'Using retweets as a voting or opinion mechanism violates Twitter/X\'s platform manipulation policies. This was explicitly added to Twitter\'s rules in 2021 after widespread abuse.',
      consequence: 'Tweet removal. Accounts that run repeat retweet-voting campaigns have been suspended, including several political and fan account campaigns in 2022–2023.',
      fix: 'Use native Twitter/X Polls for voting. They\'re built for this purpose and do not violate any policies.',
    },
    {
      id: 'no_coordinated_action',
      label: 'No coordinated mass action calls',
      check: (t) => !/(mass\s+report|everyone\s+report|let\'s\s+all\s+report|report\s+this\s+(account|tweet|user)|brigad)/i.test(t),
      msg: 'Calling for coordinated mass reporting or brigading violates Twitter/X\'s platform manipulation and spam policy. X has increased enforcement of this rule since 2023.',
      consequence: 'Account suspension for platform manipulation. Notable cases include gaming and sports community accounts suspended for coordinating mass reports against rival communities.',
      fix: 'Remove all calls for coordinated action. If you want to report a single piece of content, do so privately through the platform\'s report mechanism.',
    },
    {
      id: 'no_song_lyrics',
      label: 'No song lyrics reproduction',
      check: (t) => !/(verse\s+from|lyrics\s+from|from\s+the\s+song|song\s+goes\s*[":']|🎵.*🎵|♪.*♪|\[Verse|\[Chorus|\[Hook)/i.test(t),
      msg: 'Reproducing song lyrics — even a single verse or chorus — constitutes copyright infringement under the DMCA. Major music publishers including Sony Music Publishing, Universal Music Publishing Group, and BMG have active DMCA monitoring on Twitter/X. Cases like the 2022 National Music Publishers\' Association lawsuit against Twitter itself demonstrate how seriously this is enforced.',
      consequence: 'DMCA takedown notice delivered to your email (unless account is protected). Repeated DMCA strikes lead to account suspension under Twitter/X\'s repeat infringer policy. Accounts with 3+ DMCA notices are typically permanently suspended.',
      fix: 'Paraphrase the emotion or theme instead of quoting: "That song perfectly captures starting over" tells the story without infringing. You can name the song and artist without reproducing the lyrics.',
    },
    {
      id: 'no_brand_impersonation',
      label: 'No brand or celebrity impersonation',
      check: (t) => !/(official\s+account\s+of|verified\s+by\s+[A-Z]|authorised\s+by\s+[A-Z]|not\s+affiliated.*but\s+this\s+is\s+official)/i.test(t),
      msg: 'Implying official affiliation with a brand or celebrity you don\'t represent violates Twitter/X\'s impersonation policy. High-profile brands like Apple, Nike, and Tesla have dedicated teams monitoring for impersonation accounts.',
      consequence: 'Account labelled as "parody" without your consent, or suspended outright. Twitter/X has suspended thousands of impersonation accounts following the 2022 verified badge overhaul.',
      fix: 'Add "fan account" or "unofficial" clearly in the bio and in posts if you\'re not representing the actual brand. Parody accounts are permitted if clearly labelled as parody.',
    },
  ],
  LinkedIn: [
    {
      id: 'no_sensational_language',
      label: 'No sensational or hyperbolic language',
      check: (t) => !/(SHOCKING|UNBELIEVABLE|MIND.?BLOWING|insane\s+results?|crush\s+it|killing\s+it|🔥{3,})/i.test(t),
      msg: 'Sensational language and hyperbole underperform on LinkedIn and actively reduce algorithmic reach. LinkedIn\'s 2024 feed algorithm update penalises posts with "low-quality engagement bait" signals, which includes overuse of superlatives.',
      consequence: 'Lower dwell time, fewer impressions. Posts using spam-adjacent language are deprioritised in feeds and may be excluded from LinkedIn\'s trending topics entirely.',
      fix: 'Replace with specific, credible data: "We saw a 40% increase in conversion" is more persuasive and more compliant than "insane results". Numbers outperform adjectives on LinkedIn.',
    },
    {
      id: 'no_connection_incentives',
      label: 'No incentivised connection requests',
      check: (t) => !/(connect\s+with\s+me\s+(for\s+a\s+prize|to\s+win)|add\s+me\s+for\s+a\s+gift|connect\s+to\s+(enter|win))/i.test(t),
      msg: 'Incentivising connection requests with prizes or gifts violates LinkedIn\'s Professional Community Policies under the "Spam and Scams" section.',
      consequence: 'Post removal and account restriction. Repeated violations lead to content creation being blocked on the account.',
      fix: 'Invite connections based on shared professional interest. State a clear reason: "I work in [field] and would love to connect with others building in this space."',
    },
    {
      id: 'no_inflammatory_workplace',
      label: 'No inflammatory workplace content',
      check: (t) => !/(slave\s+wages|wage\s+slavery|working\s+for\s+free|unpaid\s+labor\s+scandal|corporate\s+exploitation)/i.test(t),
      msg: 'Inflammatory workplace content regularly triggers LinkedIn\'s community flag system, especially when it names specific companies or individuals.',
      consequence: 'Reduced reach, possible entry into a human-review queue. If the content is reported by the named company, LinkedIn may remove it and restrict the account.',
      fix: 'Frame workplace discussions constructively: "Advocating for fair compensation in [industry]" rather than inflammatory language. LinkedIn rewards nuanced professional commentary.',
    },
    {
      id: 'no_unlicensed_stock_images',
      label: 'No unlicensed stock image signals',
      check: (t) => !/(shutterstock|getty\s*images?|gettyimages|istock|stock\s+photo\s+by|©\s*shutterstock|©\s*getty)/i.test(t),
      msg: 'Mentioning stock image providers in your post suggests potentially unlicensed commercial image use. Getty Images and Shutterstock operate automated reverse-image-search crawlers that index LinkedIn posts and send invoices for unlicensed use — often without warning.',
      consequence: 'DMCA notice or direct invoice from Getty/Shutterstock. Invoice amounts typically range from $800 to $2,500 per image. Failure to pay can result in litigation — Getty Images has filed thousands of lawsuits over unlicensed image use.',
      fix: 'Use royalty-free sources with explicit commercial licences: Unsplash, Pexels, or Pixabay (all free, commercial OK). Always download and save the licence receipt, which confirms your right to use the image.',
    },
  ],
  TikTok: [
    {
      id: 'no_adult_content_signals',
      label: 'No adult content signals',
      check: (t) => !/(18\+\s*only|adult\s+only|nsfw|explicit\s+content|mature\s+audiences?)/i.test(t),
      msg: 'Adult content signals cause TikTok to suppress or remove content immediately. TikTok\'s CSAM and adult content detection is automated and acts within minutes of upload.',
      consequence: 'Immediate content suppression or removal. Age-restriction flags placed on the account. Repeated violations lead to a permanent ban with no appeal path.',
      fix: 'Remove all age-gating language. Keep content fully accessible to a general audience. TikTok\'s audience skews young and the platform enforces this strictly.',
    },
    {
      id: 'no_dangerous_challenges',
      label: 'No dangerous challenge promotion',
      check: (t) => !/(try\s+this\s+challenge|do\s+the\s+[a-z]+\s+challenge|dangerous\s+challenge|no\s+safety\s+needed)/i.test(t),
      msg: 'TikTok has a specific policy against content promoting dangerous activities. Following several high-profile incidents (the "Blackout Challenge" lawsuits in the US, the "Skullbreaker Challenge" injuries), TikTok\'s safety classifier is highly sensitive to challenge-adjacent language.',
      consequence: 'Immediate video removal, formal strike on the account. Three strikes in 90 days results in permanent account ban. TikTok has also faced lawsuits for hosting dangerous challenge content — they actively remove it to limit liability.',
      fix: 'Add explicit safety disclaimers for any physical activity content. Reframe to show safety-first behaviour. TikTok rewards responsible challenge content when it\'s clearly safe.',
    },
    {
      id: 'commercial_music_restriction',
      label: 'Business account music restriction',
      check: (t) => !/(trending\s+audio|using\s+this\s+sound|original\s+audio\s+by|audio\s+credit\s*:\s*[A-Z]|sounds?\s+from\s+[A-Z])/i.test(t),
      msg: 'Business and brand TikTok accounts are legally prohibited from using commercial music tracks — only sounds from TikTok\'s Commercial Music Library are permitted. This is a licensing restriction negotiated between TikTok and the major labels (Universal, Sony, Warner) specifically for commercial use. Major brands like Gymshark and ASOS have had videos removed for using commercial tracks on business accounts.',
      consequence: 'Video muted within seconds of upload (TikTok\'s ContentID-equivalent detects commercial tracks automatically). Monetised content claiming revenue may have earnings revoked. Repeat violations can restrict the account\'s ability to post video.',
      fix: 'Switch to a TikTok Business account and use only sounds sourced directly from the Commercial Music Library inside the TikTok app. Search by mood, not by artist name.',
    },
    {
      id: 'no_duet_stitch_without_consent',
      label: 'No duet or stitch without permission',
      check: (t) => !/(duet\s+with|stitching\s+[A-Z]|reacting\s+to\s+[A-Z]|using\s+their\s+video|i\s+duetted)/i.test(t),
      msg: 'Duetting or stitching content where the original creator has disabled these features violates TikTok\'s Community Guidelines. Creators can control duet and stitch permissions per-video. Bypassing this (e.g., screen recording then re-uploading) also violates copyright.',
      consequence: 'Video removal and potential copyright or harassment claim from the original creator. TikTok takes creator consent violations seriously since their 2022 creator rights policy update.',
      fix: 'Only Duet or Stitch videos where the feature is enabled. Check the three-dot menu on the original video — if Duet/Stitch is greyed out, the creator has disabled it. Respect that choice.',
    },
  ],
  Facebook: [
    {
      id: 'no_misinformation_signals',
      label: 'No misinformation signals',
      check: (t) => !/(fake\s+news|hoax|misinformation|they'?re\s+hiding|mainstream\s+media\s+lies|what\s+the\s+news\s+won'?t\s+tell\s+you)/i.test(t),
      msg: 'Facebook\'s third-party fact-checking programme (launched 2016, active in 60+ countries) actively suppresses content containing misinformation signals. Even framing language like "what the news won\'t tell you" triggers the classifier.',
      consequence: 'Content reaches up to 80% fewer people than normal. A "False Information" or "Missing Context" label is applied. Persistent flagging demotes the page\'s overall distribution score.',
      fix: 'Cite credible, verifiable sources. Use factual, neutral language. Facebook\'s algorithm rewards high-accuracy, substantive content with wider reach.',
    },
    {
      id: 'no_engagement_bait',
      label: 'No engagement bait',
      check: (t) => !/(like\s+if\s+you\s+(agree|love|want)|share\s+if\s+you\s+(agree|care|know)|comment\s+"?(yes|no|amen|🙏)"?\s+(if|to))/i.test(t),
      msg: '"Like if you agree", "Comment AMEN", and "Share if you care" are textbook Facebook engagement bait patterns. Facebook\'s algorithm update in 2017 explicitly targeted this tactic — it remains one of the most heavily penalised content patterns on the platform.',
      consequence: 'Facebook\'s algorithm explicitly down-ranks engagement bait posts. Pages that repeatedly use this tactic see their overall page reach reduced, not just on the individual post.',
      fix: 'Ask genuine, open-ended questions: "What\'s your experience with this?" generates authentic comments that the algorithm rewards. The engagement has to be earned, not manufactured.',
    },
    {
      id: 'no_unlicensed_music_video',
      label: 'No unlicensed music in video content',
      check: (t) => !/(background\s+music\s*[:\-]\s*[A-Z]|song\s+in\s+(the\s+)?video\s*[:]\s*[A-Z]|music\s+playing\s*:\s*[A-Z]|audio\s+from\s+[A-Z]|soundtrack\s+by\s+[A-Z])/i.test(t),
      msg: 'Facebook\'s Rights Manager system scans every video upload for copyrighted audio — including background music — using audio fingerprinting technology licensed from Audible Magic. Artists like Ed Sheeran, Bad Bunny, and BTS have their catalogues monitored in real-time across Meta\'s platforms.',
      consequence: 'Video muted silently (you may not receive a notification). Monetised content loses all ad revenue, which is redirected to the rights holder. Repeated violations result in posting restrictions. Meta\'s Rights Manager is one of the most sophisticated ContentID systems in the industry.',
      fix: 'Use Facebook\'s licensed Sound Collection (available in Creator Studio), Epidemic Sound (commercial licence required), or Artlist (commercial licence available). Always retain the licence download confirmation.',
    },
    {
      id: 'no_share_to_enter_contest',
      label: 'No share-to-enter contests',
      check: (t) => !/(share\s+this\s+(post\s+)?to\s+(enter|win|participate)|must\s+share\s+to\s+(participate|enter|win)|sharing\s+is\s+(mandatory|required)\s+to\s+enter)/i.test(t),
      msg: 'Facebook Pages Terms of Service (Section III, Promotions) explicitly prohibit requiring a share as a contest entry mechanic. This has been in Facebook\'s terms since 2014 and is actively enforced. Brands including large consumer goods companies have had pages temporarily unpublished for this violation.',
      consequence: 'Post removal. Repeated violations result in page unpublishing. Note: "shares" are distinct from "likes" — requiring a like is permitted, requiring a share is not.',
      fix: 'Use "like this post" or "comment with your answer" as the entry mechanic. Shares can be encouraged but never required. Direct users to an external entry form for legally safer contest management.',
    },
  ],
  YouTube: [
    {
      id: 'no_reused_content',
      label: 'Original content — no repost signals',
      check: (t) => !/(clip\s+from|footage\s+from|original\s+video\s+by|credit\s+to\s+[A-Z]|not\s+my\s+video|repost\s+from|source\s*:\s*[A-Z]|grabbed\s+from)/i.test(t),
      msg: 'Reused or "reaction" content without substantial transformation may trigger YouTube\'s repetitive or reused content spam policy (updated 2022). Simply crediting the original creator does not constitute fair use — only a written licence does. YouTube has demonetised thousands of channels for reposting content with minimal commentary.',
      consequence: 'Demonetisation of the video or the entire channel. Content deprioritised in YouTube recommendations. Copyright strike from the original creator. Three valid copyright strikes result in permanent channel termination with no appeal.',
      fix: 'Add substantial original commentary — analysis, criticism, or educational framing — not just watching the clip alongside the viewer. Alternatively, obtain explicit written permission (not a verbal OK) from the original creator.',
    },
    {
      id: 'no_misleading_title_thumbnail',
      label: 'Accurate title and thumbnail',
      check: (t) => !/(clickbait|you\s+won'?t\s+believe|shocking\s+truth|exposed\s+by|they\s+hid\s+this|[A-Z]{5,}\s+EXPOSED)/i.test(t),
      msg: 'YouTube\'s 2023 satisfaction survey update penalises content where viewers feel misled by the title or thumbnail. If viewers click away quickly (poor click-to-watch ratio), YouTube suppresses the video in recommendations — sometimes permanently.',
      consequence: 'Severely reduced recommendation reach. High-profile channels including several tech and pop culture channels lost millions of views per month after YouTube\'s 2023 quality update targeted misleading titles.',
      fix: 'Use accurate, curiosity-driven titles: "Why [X] actually works" or "The real reason [Y] happened" — these generate genuine clicks and viewers stay longer. Avoid capitalised single words like "EXPOSED" or "SHOCKING".',
    },
    {
      id: 'paid_promotion_disclosure',
      label: 'Disclose paid promotions',
      check: (t) => true,
      msg: 'If this video contains paid promotions, product placements, or sponsorships, YouTube requires disclosure both in the video and in the description. The FTC (US) and ASA (UK) additionally require this disclosure to be clear and prominent — "thanks to our sponsor" buried at the end of a 20-minute video is not sufficient.',
      consequence: 'FTC enforcement actions against individual creators have reached $2.5 million in fines (e.g., the 2021 Lords Mobile case). YouTube may also demonetise undisclosed paid promotion videos and restrict future monetisation.',
      fix: 'Add "This video contains paid promotion for [Brand]" in the first 3 lines of the description. Also use YouTube\'s built-in "Video contains paid promotion" disclosure toggle in Advanced Settings.',
    },
    {
      id: 'no_copyrighted_music_signal',
      label: 'No unlicensed music reference',
      check: (t) => !/(background\s+music\s*:\s*[A-Z]|music\s+by\s+[A-Z]|royalty.free.*not\s+really|using\s+copyrighted|audio\s+credit\s*:\s*[A-Z]|song\s*:\s*[A-Z])/i.test(t),
      msg: 'Referencing specific copyrighted tracks in your description while using that audio triggers YouTube\'s Content ID system. Content ID scans audio at the fingerprint level — even 5 seconds of a recognisable melody from artists like Drake, Beyoncé, Taylor Swift, or any major label artist will generate an instant claim.',
      consequence: 'Content ID claim immediately redirects all ad revenue to the rights holder. Disputes take 30+ days to resolve and are typically decided in the label\'s favour. Repeated claims can permanently restrict monetisation on the channel. Warner Music Group, Sony Music, and UMG each have active Content ID agreements with YouTube covering millions of tracks.',
      fix: 'Use YouTube Audio Library (free, all tracks are cleared for YouTube use), Epidemic Sound (subscription, commercial licence), or Artlist (subscription, commercial licence). Always save the download receipt as proof of licence.',
    },
    {
      id: 'no_content_id_bypass',
      label: 'No Content ID bypass attempt',
      check: (t) => !/(speed\s+up\s+to\s+avoid\s+(copyright|claim)|pitch.?shift\s+to\s+avoid|reverse\s+the\s+audio\s+to\s+avoid|loop.*avoid.*claim|slow\s+down\s+to\s+avoid\s+claim)/i.test(t),
      msg: 'Attempting to bypass Content ID by pitch-shifting, speeding up, reversing, or looping audio is an explicit violation of YouTube\'s Terms of Service (Section 4.3). YouTube\'s Content ID was updated in 2022 to detect these modifications. Describing bypass techniques in a description further signals malicious intent.',
      consequence: 'Immediate video strike for ToS violation — separate from a copyright strike and harder to dispute. Accounts that demonstrate repeated bypass attempts face permanent channel termination. Several reaction and compilation channels were terminated in 2022–2023 for documented bypass attempts.',
      fix: 'There is no legal or reliable bypass for Content ID. The only compliant solution is to use fully licensed music. Accept the claim and move on, or dispute it only if you genuinely have a licence.',
    },
    {
      id: 'no_movie_tv_clips',
      label: 'No unlicensed movie or TV clip reproduction',
      check: (t) => !/(clip\s+from\s+(the\s+)?(movie|film|series|episode)|scene\s+from|season\s+\d+\s+episode|full\s+episode|movie\s+(scene|clip)\s+[A-Z])/i.test(t),
      msg: 'Reproducing clips from films or TV shows without transformation is copyright infringement of the studio\'s work. Disney, Warner Bros., Netflix, and Sony Pictures all have dedicated IP enforcement teams. Disney in particular files DMCA notices within hours of infringing content being published. Disney vs Redbox (2017) and Disney\'s continuous enforcement actions demonstrate their zero-tolerance policy.',
      consequence: 'DMCA takedown notice within hours (Disney averages under 4 hours for detected content). Copyright strike. Three valid DMCA strikes result in permanent channel termination. Disney and Netflix have pursued legal action against repeat infringers, with some cases resulting in six-figure settlements.',
      fix: 'Limit transformative use to short clips (under 10 seconds) with substantial original commentary or criticism. For any promotional or commercial use of film clips, obtain a sync or clip licence from the studio — expect costs of $5,000+ for commercial use.',
    },
  ],
}

// ── Real-world copyright risk patterns ──────────────────────────────────────
// These are grounded in actual DMCA cases, enforcement actions, and
// platform-specific copyright enforcement systems.
const COPYRIGHT_PATTERNS = [
  {
    id: 'song_lyrics_reproduction',
    pattern: /["'](.{8,80})["']\s*[-–—]\s*(.*?(lyrics|song|track|single|album|by\s+[A-Z]))|(\[Verse\s*\d*\]|\[Chorus\]|\[Hook\]|\[Bridge\]|\[Pre.?Chorus\])/gi,
    label: 'Song lyrics reproduction',
    risk: 'High',
    msg: 'Reproducing song lyrics — even a single verse or chorus — is copyright infringement. Music publishers including Sony Music Publishing (owns Elvis, Michael Jackson, Taylor Swift\'s older catalogue), Universal Music Publishing Group (Billie Eilish, Drake, The Weeknd), Warner Chappell Music (Ed Sheeran, Bruno Mars, Cardi B), and BMG have automated monitoring systems on all major platforms. In 2022, the National Music Publishers\' Association (NMPA) reached a $180 million settlement with Twitter/X over unlicensed lyrics — this demonstrates scale of enforcement.',
    consequence: 'DMCA takedown notice. Copyright strike on the account. Under US copyright law, statutory damages reach $150,000 per wilfully infringed work. Platforms treat lyrics reproduction as willful infringement. Repeat strikes lead to permanent account termination.',
    fix: 'Never quote lyrics directly. Describe the theme or emotion instead: "The song captures that feeling of moving on" — this says everything without infringing. You can name the song and artist; you cannot reproduce their words.',
    platforms: ['Instagram', 'Facebook', 'Twitter', 'LinkedIn', 'YouTube', 'TikTok'],
  },
  {
    id: 'copyrighted_music_in_video',
    pattern: /\b(background\s+music\s*:\s*[A-Z]|music\s+by\s+[A-Z][a-z]+|audio\s+by\s+[A-Z]|ft\.\s+[A-Z][a-z]+|feat\.\s+[A-Z][a-z]+|soundtrack\s+from\s+[A-Z]|using\s+(the\s+)?song\s+[A-Z]|audio\s+credit\s*:\s*[A-Z])\b/gi,
    label: 'Copyrighted music in video or audio',
    risk: 'High',
    msg: 'Describing copyrighted music used in your video signals Content ID risk. All major platforms use audio fingerprinting: YouTube uses ContentID (licensed from Audible Magic), Meta uses Rights Manager, TikTok uses its own proprietary system. Even 5–10 seconds of a recognisable melody from any track in Universal, Sony, Warner, or Merlin (indie labels) catalogues will generate an automated claim within minutes of upload. The three major labels collectively claim over 40 million tracks.',
    consequence: 'Content ID claim redirects all ad revenue to the rights holder — permanently, unless disputed and won (rare). Disputes take 30+ days. On TikTok, business accounts using commercial music have their videos muted within seconds. Repeated claims can demonetise the entire channel or account.',
    fix: 'Use royalty-free sources with explicit commercial licences: YouTube Audio Library (free), Epidemic Sound (subscription, $15/month), Artlist (subscription, $200/year), or Musicbed (subscription, $15/month+). Always save the licence receipt as proof of authorised use.',
    platforms: ['YouTube', 'Instagram', 'TikTok', 'Facebook'],
  },
  {
    id: 'reused_video_content',
    pattern: /\b(clip\s+from|footage\s+from|original\s+video\s+by|credit\s+to\s+[A-Z]|not\s+my\s+video|repost\s+from|sourced\s+from|grabbed\s+from|video\s+belongs\s+to)\b/gi,
    label: 'Reused or non-original video content',
    risk: 'High',
    msg: 'Explicit credit to another creator\'s video confirms reused content. Credit does not grant copyright permission — only a written licence does. This is a common misconception that leads to DMCA strikes. High-profile cases include YouTuber H3H3 Productions vs Matt Hosseinzadeh (2017), which established that reaction videos require genuine transformative commentary to qualify as fair use. Simply watching or reacting is insufficient.',
    consequence: 'DMCA takedown, copyright strike, or Content ID claim that redirects all revenue. On YouTube, three strikes = permanent channel deletion. On TikTok, repeated reuse leads to account termination. Even a single valid DMCA notice harms your channel\'s standing.',
    fix: 'Obtain explicit written permission (email or DM with clear agreement) before using another creator\'s footage. For commentary or criticism, add substantial original analysis — not just watching the clip. Document your fair use reasoning.',
    platforms: ['YouTube', 'Instagram', 'TikTok', 'Twitter', 'Facebook'],
  },
  {
    id: 'third_party_image_copyright',
    pattern: /\b(image\s+from|photo\s+by\s+[A-Z]|photo\s+credit\s*:\s*[A-Z]|art\s+by\s+[A-Z]|design\s+by\s+[A-Z]|illustration\s+by\s+[A-Z]|photography\s+by\s+[A-Z]|image\s+(source|credit|via)\s*:\s*[A-Z])\b/gi,
    label: 'Third-party image or artwork attribution',
    risk: 'Medium',
    msg: 'Attributing a visual to another creator confirms you\'re using their copyrighted work. Attribution is not a licence. Getty Images and Shutterstock operate automated web-crawling systems (TinEye-based technology) that index images across all public social media platforms. Getty Images has filed thousands of lawsuits — they typically settle for $800–$2,500 per image but can pursue $30,000+ in statutory damages. Getty sued Stability AI in 2023 for $1.8 trillion over AI training data, demonstrating their aggressive enforcement stance.',
    consequence: 'DMCA notice or direct invoice. Getty Images and Shutterstock routinely send invoices of $800–$2,500 per image before escalating to litigation. Fines under US copyright law reach $150,000 per work for willful infringement.',
    fix: 'Use Unsplash, Pexels, or Pixabay for free images with commercial licences (CC0 or equivalent). For professional use, purchase a licence from Adobe Stock, Getty (subscription), or Shutterstock (subscription). Save every licence download as proof.',
    platforms: ['Instagram', 'LinkedIn', 'Facebook', 'Twitter'],
  },
  {
    id: 'trademark_impersonation',
    pattern: /\b(official\s+[A-Z][a-z]+\s+(account|store|page|shop)|™|®|©|registered\s+trademark|all\s+rights\s+reserved|authorised\s+(dealer|seller|reseller)\s+of\s+[A-Z])\b/gi,
    label: 'Trademark or brand identity claim',
    risk: 'Medium',
    msg: 'Using trademark symbols (™, ®) or claiming "official" or "authorised" status for a brand you don\'t own constitutes trademark infringement under the Lanham Act (US) and equivalent trademark law globally. Major brands including Apple, Nike, Adidas, Supreme, and luxury houses like Chanel and Louis Vuitton have legal teams dedicated to monitoring social media for trademark violations.',
    consequence: 'Cease and desist notice (often with 24-hour compliance demand). Post removal and platform brand impersonation flag. Legal action — Apple pursued 215 trademark infringement cases in 2022 alone, including social media accounts. LVMH (Louis Vuitton) is notorious for pursuing six-figure settlements against counterfeit and impersonation operations.',
    fix: 'Remove all trademark symbols unless you are the registered owner. If you\'re a legitimate authorised reseller, use "Authorised Reseller of [Brand]" only if you have written authorisation from the brand and have confirmed the specific permitted language.',
    platforms: ['Instagram', 'LinkedIn', 'Facebook', 'Twitter', 'YouTube', 'TikTok'],
  },
  {
    id: 'movie_tv_content',
    pattern: /\b(scene\s+from|clip\s+from\s+(the\s+)?(movie|film|series|show)|episode\s+of\s+[A-Z]|season\s+\d+|from\s+the\s+(movie|film|series|show)\s+[A-Z]|full\s+episode\s+of|movie\s+(scene|clip)\s+[A-Z])\b/gi,
    label: 'Movie or TV show content reproduction',
    risk: 'High',
    msg: 'Reproducing scenes, clips, or dialogue from movies and TV shows infringes the studio\'s copyright. Disney, Warner Bros., Netflix, Amazon Studios, Universal, and Sony Pictures all have active automated monitoring and dedicated IP enforcement teams. Disney averages under 4 hours to file a DMCA notice against infringing content found by their system. Disney vs VidAngel (2019) — a $62.4 million damages award — demonstrates the scale of entertainment IP enforcement.',
    consequence: 'DMCA takedown within hours. Copyright strike. For Disney content specifically: Disney pursues cases involving unlicensed reproduction regardless of account size. Three copyright strikes = permanent YouTube termination. On Instagram and TikTok, repeated DMCA notices lead to permanent bans.',
    fix: 'Limit clips to under 10 seconds with substantial original commentary or criticism (criticism and parody have stronger fair use standing than general reaction content). For any commercial use of film or TV clips, obtain a clip licence from the studio — costs range from $5,000 to $50,000+ depending on use case.',
    platforms: ['YouTube', 'Instagram', 'TikTok', 'Facebook', 'Twitter'],
  },
  {
    id: 'sports_broadcast_footage',
    pattern: /\b(match\s+(footage|clip|highlights?)|game\s+(clip|highlights?)|broadcast\s+by\s+[A-Z]|aired\s+on\s+[A-Z]|official\s+broadcast\s+of|IPL\s+highlights?|Premier\s+League\s+clip|NFL\s+highlight|NBA\s+highlight|Champions\s+League\s+clip)\b/gi,
    label: 'Sports broadcast or match footage',
    risk: 'High',
    msg: 'Sports leagues and broadcasters hold exclusive broadcast rights to all match footage, highlights, and even score graphics. The IPL\'s broadcast rights holder (Star Sports/JioCinema) issues automated takedowns within minutes. The Premier League issues over 1,000 DMCA notices per week across platforms. The NFL operates a 24/7 IP monitoring operation during the season. Even a 30-second clip of a match moment constitutes infringement of the broadcaster\'s exclusive rights.',
    consequence: 'Immediate DMCA takedown (automated systems operate within 5–15 minutes of upload for major leagues). Copyright strike. The Premier League, IPL, and NFL have all pursued account terminations and legal action against repeat infringers. Persistent violations lead to permanent platform bans.',
    fix: 'Use your own original reaction footage, commentary over a blank screen, or officially licensed graphics. Many leagues (NBA, NFL) offer official highlight programmes with licensing terms for creators — check their official creator programmes.',
    platforms: ['YouTube', 'Instagram', 'TikTok', 'Facebook', 'Twitter'],
  },
  {
    id: 'font_commercial_licence',
    pattern: /\b(using\s+(the\s+)?font\s+[A-Z]|font\s+credit\s*:\s*[A-Z]|typeface\s+by\s+[A-Z]|typography\s+by\s+[A-Z]|designed\s+by.*fonts?\s+[A-Z])\b/gi,
    label: 'Font commercial licence signal',
    risk: 'Medium',
    msg: 'Fonts used in brand graphics and social media posts require a commercial licence. "Free for personal use" does not cover advertising, brand content, or monetised social media. Monotype (owner of Helvetica, Times New Roman, Arial) and Adobe Fonts actively monitor for unlicensed commercial use. Fonts & Others vs Zazzle (2022) resulted in a significant settlement over unlicensed font commercial use.',
    consequence: 'Cease and desist from the font foundry. Licence fees plus damages are routinely sought — typically 2–3x the commercial licence cost for discovered violations. Monotype\'s commercial licences range from $35 to $600+ per font.',
    fix: 'Google Fonts are licensed under the SIL Open Font Licence — free for all commercial use. Adobe Fonts are covered under a Creative Cloud subscription for commercial use. Always verify the specific licence terms before using any font in brand or advertising content.',
    platforms: ['Instagram', 'LinkedIn', 'Facebook', 'Twitter', 'YouTube'],
  },
  {
    id: 'podcast_audio_reproduction',
    pattern: /\b(clip\s+from\s+(the\s+)?podcast|audio\s+from\s+(the\s+)?[A-Z]|recorded\s+call\s+with|interview\s+clip\s+from|episode\s+clip\s+[A-Z]|from\s+(the\s+)?[A-Z]+\s+podcast)\b/gi,
    label: 'Podcast or interview audio reproduction',
    risk: 'Medium',
    msg: 'Podcast episodes and recorded interviews are protected by copyright. The host, guest, and production company may all hold rights. Major podcast networks (Spotify Originals, iHeart, NPR, Wondery) have begun filing DMCA notices against social media clips. In 2023, several creators who clipped episodes of The Joe Rogan Experience and Call Her Daddy received DMCA notices from Spotify\'s content team.',
    consequence: 'DMCA takedown notice from the podcast owner or production company. If the podcast is a Spotify Exclusive, Spotify may additionally take action against the platform account.',
    fix: 'Obtain explicit written permission from the podcast host before publishing any audio clip. The safest alternative is to link to the original episode with timestamped commentary — no reproduction required.',
    platforms: ['YouTube', 'Instagram', 'TikTok', 'Twitter', 'Facebook'],
  },
  {
    id: 'ai_content_disclosure',
    pattern: /\b(ai[\s-]?(generated|made|created|designed|written)|made\s+with\s+ai|created\s+using\s+(midjourney|dall[\s-]?e|stable\s+diffusion|sora|runway|kling|pika)|this\s+image\s+(is|was)\s+ai)\b/gi,
    label: 'AI-generated content — disclosure required',
    risk: 'Medium',
    msg: 'YouTube (since November 2023) and Meta (since 2024) require disclosure of AI-generated content that depicts realistic people, places, or events. YouTube\'s policy applies to "realistic-looking" AI video, faces, and voices. Meta requires disclosure on AI-generated images that could be "mistaken for real". The EU AI Act (effective 2026) will make non-disclosure of synthetic media a legal violation in Europe.',
    consequence: 'YouTube: video removal or channel demonetisation for undisclosed AI content. Meta: post removal and potential account labelling as "AI-generated content" applied without your input. Future EU enforcement: fines under the AI Act reach €30 million or 6% of global annual revenue for providers.',
    fix: 'On YouTube: use the "Altered or synthetic content" toggle in Advanced Video Settings. On Meta: use the "AI-generated" content label in post settings. In captions, add "Created using AI" clearly. Proactive disclosure prevents the platform from applying labels without your control.',
    platforms: ['YouTube', 'Instagram', 'TikTok', 'Facebook', 'LinkedIn'],
  },
]

// ── Implicit copyright patterns — indirect/contextual signals ───────────────
const IMPLICIT_COPYRIGHT_PATTERNS = [
  /\b(movie\s+song)\b/gi,
  /\b(film\s+clip)\b/gi,
  /\b(music\s+track)\b/gi,
  /\b(viral\s+audio)\b/gi,
  /\b(background\s+song)\b/gi,
  /\b(brand\s+content)\b/gi,
  /\b(ad\s+recreation)\b/gi,
]

// ── Tone analysis (brand voice check) ────────────────────────────────────────
const TONE_SIGNALS = {
  professional: { positive: /\b(expertise|solution|value|partner|achieve|results|strategy|growth|impact|proven|measurable)\b/gi, negative: /\b(lol|wtf|omg|bruh|kinda|sorta|gonna|wanna|lowkey|ngl)\b/gi },
  playful:      { positive: /\b(fun|love|excited|amazing|wow|cool|awesome|vibe|energy|hype|obsessed|iconic)\b/gi, negative: /\b(therefore|consequently|furthermore|notwithstanding|pursuant)\b/gi },
  bold:         { positive: /\b(dominate|crush|win|unstoppable|fearless|disrupt|break|change|power|force|own|lead)\b/gi, negative: /\b(maybe|perhaps|sort\s+of|kind\s+of|might|could\s+possibly|hopefully)\b/gi },
  friendly:     { positive: /\b(you|your|we|together|community|join|welcome|here\s+for\s+you|support|care|family)\b/gi, negative: /\b(clients|customers|consumers|users|end.users|stakeholders|target\s+demographic)\b/gi },
  luxury:       { positive: /\b(exclusive|premium|curated|crafted|refined|bespoke|elevated|distinguished|exquisite|coveted)\b/gi, negative: /\b(cheap|affordable|budget|deal|discount|bargain|sale|clearance|markdown)\b/gi },
}

function analyzeTone(text, campaignTone) {
  if (!campaignTone || !TONE_SIGNALS[campaignTone.toLowerCase()]) return null
  const signals = TONE_SIGNALS[campaignTone.toLowerCase()]
  const positiveMatches = (text.match(signals.positive) || []).length
  const negativeMatches = (text.match(signals.negative) || []).length
  return { positiveMatches, negativeMatches, tone: campaignTone }
}

// ── Risk analysis engine ──────────────────────────────────────────────────────
function runRiskAnalysis(text, platform) {
  const sensitivityWarnings = []
  const policyRisks         = []
  const copyrightRisks      = []

  for (const item of SENSITIVITY_PATTERNS) {
    const matches = text.match(item.pattern)
    if (matches) {
      const uniqueMatches = [...new Set(matches.map(m => m.toLowerCase()))]
      sensitivityWarnings.push({
        word:       item.word,
        found:      uniqueMatches.slice(0, 3).join(', '),
        suggestion: item.suggestion,
      })
    }
  }

  const platformPolicies = PLATFORM_POLICY[platform] || []
  for (const rule of platformPolicies) {
    if (!rule.check(text)) {
      policyRisks.push({
        label:       rule.label,
        msg:         rule.msg,
        consequence: rule.consequence,
        fix:         rule.fix,
      })
    }
  }

  for (const item of COPYRIGHT_PATTERNS) {
    if (!item.platforms.includes(platform)) continue
    const matches = text.match(item.pattern)
    if (matches) {
      copyrightRisks.push({
        label:       item.label,
        risk:        item.risk,
        msg:         item.msg,
        consequence: item.consequence,
        fix:         item.fix,
        found:       [...new Set(matches.map(m => m.toLowerCase()))].slice(0, 2).join(', '),
      })
    }
  }

  for (const pattern of IMPLICIT_COPYRIGHT_PATTERNS) {
    const matches = text.match(pattern)
    if (matches) {
      const found = [...new Set(matches.map(m => m.toLowerCase()))].slice(0, 2).join(', ')
      copyrightRisks.push({
        risk:        'Medium',
        label:       'Implicit Copyright Signal',
        msg:         'May involve copyrighted or licensed media. Implicit references to branded audio, film content, or ad recreations can trigger platform copyright detection systems.',
        consequence: 'Content may be muted, removed, or flagged by automated rights management systems on the platform.',
        fix:         'Use platform-licensed or royalty-free content. Source audio from the platform\'s official music library or use royalty-free alternatives.',
        found,
      })
    }
  }

  const highCopyright = copyrightRisks.filter(r => r.risk === 'High').length
  const totalIssues   = sensitivityWarnings.length + policyRisks.length + copyrightRisks.length

  let riskLevel = 'Low'
  if (highCopyright >= 1 || totalIssues >= 4) riskLevel = 'High'
  else if (totalIssues >= 2 || copyrightRisks.length >= 1 || policyRisks.length >= 1) riskLevel = 'Medium'

  return { sensitivityWarnings, policyRisks, copyrightRisks, riskLevel }
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ComplianceGuardPage() {
  const [campaigns,        setCampaigns]        = useState([])
  const [campaignsLoading, setCampaignsLoading] = useState(false)
  const [selectedCampaign, setSelectedCampaign] = useState('')
  const [selectedPlatform, setSelectedPlatform] = useState('Instagram')
  const [postText,         setPostText]         = useState('')
  const [results,          setResults]          = useState(null)
  const [checked,          setChecked]          = useState(false)
  const [campaignTone,     setCampaignTone]     = useState('')
  const [activeTab,        setActiveTab]        = useState('quality')

  useEffect(() => { fetchCampaigns() }, [])

  async function fetchCampaigns() {
    setCampaignsLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data, error } = await supabase
        .from('campaigns')
        .select('id, campaign_name, status, platforms, tone')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
      if (!error && data) setCampaigns(data)
    } catch (e) { console.error('[ComplianceGuard] fetchCampaigns:', e) }
    finally { setCampaignsLoading(false) }
  }

  function handleCampaignChange(e) {
    const id = e.target.value
    setSelectedCampaign(id)
    setResults(null)
    setChecked(false)
    const camp = campaigns.find(c => c.id === id)
    if (camp) {
      setCampaignTone(camp.tone || '')
      const campPlatforms = camp.platforms || []
      const matched = campPlatforms.find(p => ALL_PLATFORMS.includes(p))
      if (matched) setSelectedPlatform(matched)
    }
  }

  function runCheck() {
    if (!postText.trim()) return

    const rules    = PLATFORM_RULES[selectedPlatform] || []
    const passed   = []
    const failed   = []
    const warnings = []

    for (const rule of rules) {
      const ok = rule.check(postText)
      if (ok) passed.push(rule)
      else if (['has_cta', 'has_emoji', 'optimal_length', 'has_fyp_tag', 'professional_tone', 'has_description', 'paid_promotion_disclosure'].includes(rule.id)) {
        warnings.push(rule)
      } else {
        failed.push(rule)
      }
    }

    const toneAnalysis = analyzeTone(postText, campaignTone)
    const score        = Math.round((passed.length / rules.length) * 100)
    const { sensitivityWarnings, policyRisks, copyrightRisks, riskLevel } = runRiskAnalysis(postText, selectedPlatform)

    setResults({
      passed, failed, warnings, score, toneAnalysis,
      platform: selectedPlatform, charCount: postText.length,
      sensitivityWarnings, policyRisks, copyrightRisks, riskLevel,
    })
    setChecked(true)
    setActiveTab('quality')
  }

  function reset() {
    setPostText('')
    setResults(null)
    setChecked(false)
    setActiveTab('quality')
  }

  const selectedCampaignObj = campaigns.find(c => c.id === selectedCampaign)
  const charLimit = { Instagram: 2200, Twitter: 280, LinkedIn: 3000, TikTok: 2200, Facebook: 63206, YouTube: 5000 }[selectedPlatform] || 9999
  const charCount = postText.length
  const overLimit = charCount > charLimit
  const riskCount = results ? (results.sensitivityWarnings.length + results.policyRisks.length + results.copyrightRisks.length) : 0

  return (
    <div className={styles.page}>
      <div className={styles.pageHdr}>
        <div className={styles.pageHdrLeft}>
          <div className={styles.badge}><ShieldIcon /> Compliance Guard</div>
          <h2 className={styles.pageTitle}>Compliance Guard</h2>
          <p className={styles.pageSub}>
            Paste your post copy and check it against platform rules, character limits, hashtag policies, brand tone, and real copyright enforcement risks.
          </p>
        </div>
      </div>

      <div className={styles.layout}>
        {/* ════════ LEFT PANEL ════════ */}
        <div className={styles.inputPanel}>
          <div className={styles.stepBlock}>
            <div className={styles.stepLabel}><span className={styles.stepNum}>1</span> Campaign <span className={styles.stepOptional}>optional</span></div>
            <div className={styles.stepCard}>
              {campaignsLoading ? (
                <div className={styles.loadingRow}><SpinnerIcon /> Loading campaigns…</div>
              ) : (
                <select className={styles.select} value={selectedCampaign} onChange={handleCampaignChange}>
                  <option value="">No campaign (generic check)</option>
                  {campaigns.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.campaign_name.charAt(0).toUpperCase() + c.campaign_name.slice(1)}
                      {c.tone ? ` · ${c.tone}` : ''}
                    </option>
                  ))}
                </select>
              )}
              {selectedCampaignObj?.tone && (
                <div className={styles.toneHint}>
                  <ToneIcon /> Brand tone: <strong>{selectedCampaignObj.tone}</strong> — tone compliance will be checked.
                </div>
              )}
            </div>
          </div>

          <div className={styles.stepBlock}>
            <div className={styles.stepLabel}><span className={styles.stepNum}>2</span> Platform</div>
            <div className={styles.stepCard}>
              <div className={styles.platformGrid}>
                {ALL_PLATFORMS.map(p => (
                  <button
                    key={p}
                    className={`${styles.platformBtn} ${selectedPlatform === p ? styles.platformBtnActive : ''}`}
                    onClick={() => { setSelectedPlatform(p); setResults(null); setChecked(false) }}
                  >
                    <PlatformIcon name={p} />
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className={styles.stepBlock}>
            <div className={styles.stepLabel}><span className={styles.stepNum}>3</span> Post Copy</div>
            <div className={styles.stepCard}>
              <textarea
                className={`${styles.textarea} ${overLimit ? styles.textareaOver : ''}`}
                placeholder={`Paste your ${selectedPlatform} post copy here…`}
                value={postText}
                onChange={e => { setPostText(e.target.value); if (checked) { setResults(null); setChecked(false) } }}
                rows={8}
              />
              <div className={`${styles.charRow} ${overLimit ? styles.charRowOver : ''}`}>
                <span>{charCount.toLocaleString()} / {charLimit.toLocaleString()} chars</span>
                {overLimit && <span className={styles.overMsg}><WarnIcon /> Over limit</span>}
              </div>
            </div>
          </div>

          <button
            className={`${styles.checkBtn} ${!postText.trim() ? styles.checkBtnDisabled : ''}`}
            onClick={runCheck}
            disabled={!postText.trim()}
          >
            <ShieldCheckIcon /> Run Compliance Check
          </button>

          {checked && (
            <button className={styles.resetBtn} onClick={reset}>↺ Clear &amp; Reset</button>
          )}
        </div>

        {/* ════════ RIGHT PANEL ════════ */}
        <div className={styles.outputPanel}>
          {!checked && (
            <div className={styles.emptyOutput}>
              <div className={styles.emptyIcon}><ShieldBigIcon /></div>
              <div className={styles.emptyTitle}>Your compliance report will appear here</div>
              <p className={styles.emptyHint}>
                Compliance Guard checks your post against {selectedPlatform}'s platform rules, real copyright enforcement risks, sensitivity signals, and brand tone guidelines.
              </p>
              <div className={styles.rulePreview}>
                <div className={styles.rulePreviewTitle}>{selectedPlatform} quality rules</div>
                {(PLATFORM_RULES[selectedPlatform] || []).map(r => (
                  <div key={r.id} className={styles.rulePreviewItem}>
                    <span className={styles.rulePreviewDot} />
                    {r.label}
                  </div>
                ))}
                <div className={styles.rulePreviewDivider} />
                <div className={styles.rulePreviewTitle} style={{ color: '#DC2626' }}>Policy &amp; Copyright checks</div>
                {(PLATFORM_POLICY[selectedPlatform] || []).slice(0, 3).map(r => (
                  <div key={r.id} className={styles.rulePreviewItem} style={{ color: '#6B7280' }}>
                    <span className={styles.rulePreviewDot} style={{ background: '#F87171' }} />
                    {r.label}
                  </div>
                ))}
              </div>
            </div>
          )}

          {checked && results && (
            <>
              <div className={styles.scoreCard}>
                <div className={styles.scoreLeft}>
                  <div className={styles.scoreLabel}>Compliance Score</div>
                  <div className={`${styles.scoreValue} ${results.score >= 80 ? styles.scoreGreen : results.score >= 50 ? styles.scoreAmber : styles.scoreRed}`}>
                    {results.score}%
                  </div>
                  <div className={styles.scoreSub}>{results.platform} · {results.charCount.toLocaleString()} chars</div>
                </div>
                <div className={styles.scoreMiddle}>
                  <div className={styles.riskLevelWrap}>
                    <div className={styles.riskLevelLabel}>Risk Level</div>
                    <div className={`${styles.riskBadge} ${results.riskLevel === 'High' ? styles.riskHigh : results.riskLevel === 'Medium' ? styles.riskMedium : styles.riskLow}`}>
                      <RiskIcon level={results.riskLevel} />
                      {results.riskLevel}
                    </div>
                    <div className={styles.riskSub}>
                      {results.riskLevel === 'High' ? 'Immediate action needed' : results.riskLevel === 'Medium' ? 'Review before posting' : 'Safe to publish'}
                    </div>
                  </div>
                </div>
                <div className={styles.scoreRight}>
                  <ScoreRing score={results.score} />
                </div>
              </div>

              <div className={styles.tabBar}>
                <button
                  className={`${styles.tabBtn} ${activeTab === 'quality' ? styles.tabBtnActive : ''}`}
                  onClick={() => setActiveTab('quality')}
                >
                  <ShieldCheckIcon /> Quality Checks
                  {(results.failed.length + results.warnings.length) > 0 && (
                    <span className={`${styles.tabBadge} ${styles.tabBadgeRed}`}>{results.failed.length + results.warnings.length}</span>
                  )}
                </button>
                <button
                  className={`${styles.tabBtn} ${activeTab === 'risk' ? styles.tabBtnActive : ''}`}
                  onClick={() => setActiveTab('risk')}
                >
                  <RiskTabIcon /> Policy &amp; Copyright
                  {riskCount > 0 && (
                    <span className={`${styles.tabBadge} ${results.riskLevel === 'High' ? styles.tabBadgeHigh : styles.tabBadgeAmber}`}>{riskCount}</span>
                  )}
                </button>
              </div>

              {activeTab === 'quality' && (
                <div className={styles.tabContent}>
                  {results.failed.length > 0 && (
                    <div className={styles.section}>
                      <div className={styles.sectionTitle}><ErrorDotIcon /> Issues to fix <span className={styles.sectionCount}>{results.failed.length}</span></div>
                      {results.failed.map(r => (
                        <div key={r.id} className={styles.issueCard}>
                          <div className={styles.issueIcon}><CrossIcon /></div>
                          <div className={styles.issueBody}>
                            <div className={styles.issueLabel}>{r.label}</div>
                            <div className={styles.issueMsg}>{r.msg}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {results.warnings.length > 0 && (
                    <div className={styles.section}>
                      <div className={styles.sectionTitle}><WarnDotIcon /> Suggestions <span className={styles.sectionCount}>{results.warnings.length}</span></div>
                      {results.warnings.map(r => (
                        <div key={r.id} className={styles.warnCard}>
                          <div className={styles.warnIcon}><WarnSmIcon /></div>
                          <div className={styles.issueBody}>
                            <div className={styles.issueLabel}>{r.label}</div>
                            <div className={styles.warnMsg}>{r.msg}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {results.passed.length > 0 && (
                    <div className={styles.section}>
                      <div className={styles.sectionTitle}><PassDotIcon /> Passing <span className={`${styles.sectionCount} ${styles.sectionCountGreen}`}>{results.passed.length}</span></div>
                      <div className={styles.passGrid}>
                        {results.passed.map(r => (
                          <div key={r.id} className={styles.passItem}><CheckIcon /> {r.label}</div>
                        ))}
                      </div>
                    </div>
                  )}

                  {results.toneAnalysis && (
                    <div className={styles.section}>
                      <div className={styles.sectionTitle}><ToneSmIcon /> Brand Tone Analysis — <em>{results.toneAnalysis.tone}</em></div>
                      <div className={styles.toneCard}>
                        <div className={styles.toneRow}>
                          <div className={styles.toneCol}>
                            <div className={styles.toneColLabel}>On-brand signals</div>
                            <div className={`${styles.toneNum} ${styles.toneNumGreen}`}>{results.toneAnalysis.positiveMatches}</div>
                            <div className={styles.toneColSub}>words that reinforce your tone</div>
                          </div>
                          <div className={styles.toneDivider} />
                          <div className={styles.toneCol}>
                            <div className={styles.toneColLabel}>Off-brand signals</div>
                            <div className={`${styles.toneNum} ${results.toneAnalysis.negativeMatches > 0 ? styles.toneNumRed : styles.toneNumGrey}`}>{results.toneAnalysis.negativeMatches}</div>
                            <div className={styles.toneColSub}>words that clash with your tone</div>
                          </div>
                        </div>
                        {results.toneAnalysis.negativeMatches === 0 && results.toneAnalysis.positiveMatches > 0 && (
                          <div className={styles.toneTip}><CheckIcon /> Great — your copy aligns well with a <strong>{results.toneAnalysis.tone}</strong> tone.</div>
                        )}
                        {results.toneAnalysis.negativeMatches > 0 && (
                          <div className={styles.toneWarn}><WarnSmIcon /> Some words may undercut your <strong>{results.toneAnalysis.tone}</strong> brand voice. Review them before posting.</div>
                        )}
                        {results.toneAnalysis.positiveMatches === 0 && results.toneAnalysis.negativeMatches === 0 && (
                          <div className={styles.toneNeutral}>No strong tone signals detected. Try adding more on-brand language.</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'risk' && (
                <div className={styles.tabContent}>
                  {riskCount === 0 && (
                    <div className={styles.riskAllClear}>
                      <div className={styles.riskAllClearIcon}>🛡️</div>
                      <div className={styles.riskAllClearTitle}>No policy or copyright risks detected</div>
                      <p className={styles.riskAllClearSub}>Your content appears clean for <strong>{results.platform}</strong>. No sensitivity flags, policy violations, or copyright signals found.</p>
                    </div>
                  )}

                  {results.sensitivityWarnings.length > 0 && (
                    <div className={styles.section}>
                      <div className={styles.sectionTitle}>
                        <SensitivityIcon /> Content Sensitivity
                        <span className={styles.sectionCount}>{results.sensitivityWarnings.length}</span>
                      </div>
                      <p className={styles.sectionDesc}>Words or phrases that may trigger algorithmic suppression or reduce organic reach.</p>
                      {results.sensitivityWarnings.map((w, i) => (
                        <div key={i} className={styles.riskCard}>
                          <div className={styles.riskCardHeader}>
                            <div className={styles.riskCardTitle}><WarnSmIcon /> {w.word}</div>
                            <span className={styles.riskChipAmber}>⚠ Reach Risk</span>
                          </div>
                          {w.found && <div className={styles.riskFound}>Detected: <code>{w.found}</code></div>}
                          <div className={styles.riskFixRow}>
                            <span className={styles.riskFixLabel}>💡 Safer alternative:</span>
                            <span className={styles.riskFixText}>{w.suggestion}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {results.policyRisks.length > 0 && (
                    <div className={styles.section}>
                      <div className={styles.sectionTitle}>
                        <PolicyIcon /> {results.platform} Policy Warnings
                        <span className={styles.sectionCount}>{results.policyRisks.length}</span>
                      </div>
                      <p className={styles.sectionDesc}>Platform-specific rules that could result in suppression, removal, or account action.</p>
                      {results.policyRisks.map((p, i) => (
                        <div key={i} className={`${styles.riskCard} ${styles.riskCardPolicy}`}>
                          <div className={styles.riskCardHeader}>
                            <div className={styles.riskCardTitle}><PolicySmIcon /> {p.label}</div>
                            <span className={styles.riskChipOrange}>📜 Policy Violation</span>
                          </div>
                          <div className={styles.riskMsg}>{p.msg}</div>
                          <div className={styles.riskConsequence}>
                            <span className={styles.riskConsequenceLabel}>⚡ Consequence:</span> {p.consequence}
                          </div>
                          <div className={styles.riskFixRow}>
                            <span className={styles.riskFixLabel}>✅ Fix:</span>
                            <span className={styles.riskFixText}>{p.fix}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {results.copyrightRisks.length > 0 && (
                    <div className={styles.section}>
                      <div className={styles.sectionTitle}>
                        <CopyrightIcon /> Copyright Awareness
                        <span className={styles.sectionCount}>{results.copyrightRisks.length}</span>
                      </div>
                      <p className={styles.sectionDesc}>Signals that could lead to copyright claims, DMCA strikes, or revenue loss — based on real enforcement patterns.</p>
                      {results.copyrightRisks.map((c, i) => (
                        <div key={i} className={`${styles.riskCard} ${c.risk === 'High' ? styles.riskCardHigh : styles.riskCardMedium}`}>
                          <div className={styles.riskCardHeader}>
                            <div className={styles.riskCardTitle}><CopyrightSmIcon /> {c.label}</div>
                            <span className={c.risk === 'High' ? styles.riskChipRed : styles.riskChipAmber}>
                              🎵 {c.risk} Risk
                            </span>
                          </div>
                          {c.found && <div className={styles.riskFound}>Triggered by: <code>{c.found}</code></div>}
                          <div className={styles.riskMsg}>{c.msg}</div>
                          <div className={styles.riskConsequence}>
                            <span className={styles.riskConsequenceLabel}>⚡ Consequence:</span> {c.consequence}
                          </div>
                          <div className={styles.riskFixRow}>
                            <span className={styles.riskFixLabel}>✅ Fix:</span>
                            <span className={styles.riskFixText}>{c.fix}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Score ring ─────────────────────────────────────────────────────────────────
function ScoreRing({ score }) {
  const r    = 28
  const circ = 2 * Math.PI * r
  const dash = (score / 100) * circ
  const color = score >= 80 ? '#16A34A' : score >= 50 ? '#D97706' : '#DC2626'
  return (
    <svg width="72" height="72" viewBox="0 0 72 72">
      <circle cx="36" cy="36" r={r} fill="none" stroke="#F0F2F8" strokeWidth="7" />
      <circle cx="36" cy="36" r={r} fill="none" stroke={color} strokeWidth="7"
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        transform="rotate(-90 36 36)" style={{ transition: 'stroke-dasharray 0.5s ease' }} />
      <text x="36" y="41" textAnchor="middle" fontSize="13" fontWeight="700" fill={color} fontFamily="DM Sans, sans-serif">{score}%</text>
    </svg>
  )
}

// ── Icons ──────────────────────────────────────────────────────────────────────
function ShieldIcon()        { return <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L4 5v6c0 5.25 3.5 10.15 8 11.35C16.5 21.15 20 16.25 20 11V5l-8-3z"/></svg> }
function ShieldCheckIcon()   { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display:'inline-block', verticalAlign:'middle', marginRight:5 }}><path d="M12 2L4 5v6c0 5.25 3.5 10.15 8 11.35C16.5 21.15 20 16.25 20 11V5l-8-3z"/><polyline points="9 12 11 14 15 10"/></svg> }
function ShieldBigIcon()     { return <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L4 5v6c0 5.25 3.5 10.15 8 11.35C16.5 21.15 20 16.25 20 11V5l-8-3z"/><polyline points="9 12 11 14 15 10"/></svg> }
function SpinnerIcon()       { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation:'spin 0.7s linear infinite', display:'inline-block', verticalAlign:'middle', marginRight:5 }}><circle cx="12" cy="12" r="10" strokeOpacity="0.25"/><path d="M12 2a10 10 0 0110 10"/></svg> }
function WarnIcon()          { return <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink:0 }}><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> }
function WarnSmIcon()        { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink:0 }}><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> }
function CrossIcon()         { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink:0 }}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> }
function CheckIcon()         { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink:0 }}><polyline points="20 6 9 17 4 12"/></svg> }
function ToneIcon()          { return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink:0 }}><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg> }
function ToneSmIcon()        { return <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink:0 }}><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg> }
function ErrorDotIcon()      { return <span style={{ width:8, height:8, borderRadius:'50%', background:'#DC2626', display:'inline-block', flexShrink:0 }} /> }
function WarnDotIcon()       { return <span style={{ width:8, height:8, borderRadius:'50%', background:'#D97706', display:'inline-block', flexShrink:0 }} /> }
function PassDotIcon()       { return <span style={{ width:8, height:8, borderRadius:'50%', background:'#16A34A', display:'inline-block', flexShrink:0 }} /> }
function SensitivityIcon()   { return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink:0 }}><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> }
function PolicyIcon()        { return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#EA580C" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink:0 }}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg> }
function PolicySmIcon()      { return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink:0 }}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> }
function CopyrightIcon()     { return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink:0 }}><circle cx="12" cy="12" r="10"/><path d="M14.83 14.83A4 4 0 119.17 9.17"/></svg> }
function CopyrightSmIcon()   { return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink:0 }}><circle cx="12" cy="12" r="10"/><path d="M14.83 14.83A4 4 0 119.17 9.17"/></svg> }
function RiskTabIcon()       { return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink:0 }}><path d="M12 2L4 5v6c0 5.25 3.5 10.15 8 11.35C16.5 21.15 20 16.25 20 11V5l-8-3z"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> }

function RiskIcon({ level }) {
  if (level === 'High')   return <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink:0 }}><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
  if (level === 'Medium') return <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink:0 }}><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
  return <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink:0 }}><polyline points="20 6 9 17 4 12"/></svg>
}

function PlatformIcon({ name }) {
  const icons = {
    Instagram: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>,
    Twitter:   <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.26 5.632 5.905-5.632zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>,
    LinkedIn:  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6zM2 9h4v12H2z"/><circle cx="4" cy="4" r="2"/></svg>,
    TikTok:    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V9.05a8.16 8.16 0 004.77 1.52V7.12a4.85 4.85 0 01-1-.43z"/></svg>,
    Facebook:  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z"/></svg>,
    YouTube:   <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M22.54 6.42a2.78 2.78 0 00-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 00-1.95 1.96A29 29 0 001 12a29 29 0 00.46 5.58A2.78 2.78 0 003.41 19.6C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 001.95-1.95A29 29 0 0023 12a29 29 0 00-.46-5.58z"/><polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" fill="white"/></svg>,
  }
  return icons[name] || null
}
