import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import styles from './ComplianceGuardPage.module.css'

// ── Platform rule sets ────────────────────────────────────────────────────────
const PLATFORM_RULES = {
  Instagram: [
    { id: 'caption_length',   label: 'Caption length',       check: (t) => t.length <= 2200,        msg: 'Caption exceeds 2,200 characters (Instagram limit).' },
    { id: 'hashtag_count',    label: 'Hashtag count',        check: (t) => (t.match(/#\w+/g) || []).length <= 30, msg: 'More than 30 hashtags — Instagram may suppress reach.' },
    { id: 'no_external_link', label: 'No clickable links',   check: (t) => !/https?:\/\/\S+/.test(t),            msg: 'External links in captions are not clickable on Instagram.' },
    { id: 'has_cta',          label: 'Has a call-to-action', check: (t) => /link in bio|swipe|tap|shop|save|follow|comment|share|dm|click/i.test(t), msg: 'No clear CTA found. Add one to improve engagement.' },
    { id: 'no_banned_tags',   label: 'No banned hashtags',   check: (t) => !/#(like4like|followforfollow|l4l|f4f|instagood100|likeforfollow)/i.test(t), msg: 'Potentially banned or spam hashtags detected.' },
  ],
  Twitter: [
    { id: 'tweet_length',     label: 'Tweet length',         check: (t) => t.length <= 280,         msg: 'Tweet exceeds 280 characters.' },
    { id: 'hashtag_max',      label: 'Hashtag count',        check: (t) => (t.match(/#\w+/g) || []).length <= 2,  msg: 'More than 2 hashtags can reduce engagement on Twitter/X.' },
    { id: 'has_hook',         label: 'Starts with a hook',   check: (t) => t.trim().length > 0 && !/^(hey|hi |hello)/i.test(t.trim()), msg: 'Post starts with a weak opener. Lead with your key message.' },
  ],
  LinkedIn: [
    { id: 'post_length',      label: 'Post length',          check: (t) => t.length <= 3000,        msg: 'Post exceeds 3,000 characters (LinkedIn feed limit).' },
    { id: 'hashtag_count',    label: 'Hashtag count',        check: (t) => (t.match(/#\w+/g) || []).length <= 5,  msg: 'More than 5 hashtags looks spammy on LinkedIn.' },
    { id: 'professional_tone',label: 'Professional tone',    check: (t) => !/(\bwtf\b|\bomg\b|\blol\b|\bAF\b)/i.test(t), msg: 'Casual slang detected — may not suit LinkedIn audience.' },
    { id: 'has_cta',          label: 'Has a call-to-action', check: (t) => /connect|comment|thoughts|share|follow|reach out|let me know|dm|learn more/i.test(t), msg: 'No clear CTA found. Invite readers to engage.' },
  ],
  TikTok: [
    { id: 'caption_length',   label: 'Caption length',       check: (t) => t.length <= 2200,        msg: 'Caption exceeds 2,200 characters.' },
    { id: 'has_fyp_tag',      label: 'FYP hashtag present',  check: (t) => /#(fyp|foryou|foryoupage)/i.test(t),   msg: 'Consider adding #fyp or #foryou to improve discoverability.' },
    { id: 'has_hook',         label: 'Opens with a hook',    check: (t) => t.trim().length > 10,    msg: 'Caption seems too short to hook viewers.' },
    { id: 'no_banned_tags',   label: 'No banned hashtags',   check: (t) => !/#(like4like|followforfollow)/i.test(t), msg: 'Potentially spammy hashtags detected.' },
  ],
  Facebook: [
    { id: 'post_length',      label: 'Post length',          check: (t) => t.length <= 63206,       msg: 'Post exceeds Facebook character limit.' },
    { id: 'optimal_length',   label: 'Optimal length',       check: (t) => t.length <= 500,         msg: 'Posts over 500 characters see lower organic reach on Facebook.' },
    { id: 'has_emoji',        label: 'Uses emojis',          check: (t) => /[\u{1F300}-\u{1FAFF}]/u.test(t), msg: 'No emojis found. Facebook posts with emojis get higher engagement.' },
    { id: 'has_cta',          label: 'Has a call-to-action', check: (t) => /comment|share|tag|like|follow|link|learn|shop|visit/i.test(t), msg: 'Add a CTA to encourage interaction.' },
  ],
  YouTube: [
    { id: 'title_length',     label: 'Title / headline length', check: (t) => t.length <= 100,      msg: 'YouTube titles should be under 100 characters for full display.' },
    { id: 'has_keywords',     label: 'Contains keywords',    check: (t) => t.split(/\s+/).length >= 5, msg: 'Description seems too short. Add keywords for SEO discoverability.' },
    { id: 'has_cta',          label: 'Has a call-to-action', check: (t) => /subscribe|like|comment|watch|click|link|check out|learn more/i.test(t), msg: 'No CTA detected. Ask viewers to subscribe, like, or comment.' },
    { id: 'no_clickbait',     label: 'Avoids clickbait',     check: (t) => !/(you won't believe|shocking|insane|mind-blowing|jaw-drop)/i.test(t), msg: 'Clickbait phrases detected — YouTube may reduce recommendation reach.' },
    { id: 'has_description',  label: 'Sufficient description', check: (t) => t.length >= 50,        msg: 'Short description limits SEO. Aim for at least 150 words in the full description.' },
  ],
}

const ALL_PLATFORMS = Object.keys(PLATFORM_RULES)

// ── Sensitivity words — triggers reach reduction / flagging ──────────────────
const SENSITIVITY_PATTERNS = [
  { pattern: /\b(kill(ing|ed|s)?|murder(ing|ed|s)?|slaughter|massacre|assassin(ate|ation)?)\b/gi, word: 'violent language', suggestion: 'Use neutral terms like "overcome", "defeat", "tackle" or "address the issue".' },
  { pattern: /\b(bomb(ing|ed|s)?|explosion|blast|terror(ist)?|attack)\b/gi, word: 'violence/terror references', suggestion: 'Rephrase to focus on solutions or outcomes rather than destructive imagery.' },
  { pattern: /\b(FREE\s+MONEY|guaranteed\s+income|get\s+rich\s+quick|make\s+money\s+fast|100%\s+free)\b/gi, word: 'misleading financial claims', suggestion: 'Use honest language: "earn rewards", "potential savings", or "explore opportunities".' },
  { pattern: /\b(SHOCKING|UNBELIEVABLE|MIND-BLOWING|YOU WON'T BELIEVE|INSANE DEAL|CRAZY OFFER)\b/gi, word: 'sensational/clickbait language', suggestion: 'Replace with factual hooks: "Here\'s what we found", "The data shows", or a genuine insight.' },
  { pattern: /\b(cure|heal|treat|diagnose|prevent disease|medical breakthrough)\b/gi, word: 'unverified health claims', suggestion: 'Add "may support", "consult a professional", or cite a source to stay compliant.' },
  { pattern: /\b(secret|hidden truth|they don't want you to know|cover-?up|conspiracy)\b/gi, word: 'conspiracy / misinformation tone', suggestion: 'Use transparent, evidence-based language. Avoid implying suppressed information.' },
  { pattern: /\b(hate|racist|sexist|discriminat(e|ion)|bigot)\b/gi, word: 'discriminatory language', suggestion: 'Remove or replace with inclusive, respectful language.' },
  { pattern: /\b(urgent|act now|limited time|expires|last chance|don't miss out)\b/gi, word: 'high-pressure urgency', suggestion: 'Soften to "available while supplies last" or "join us before [date]" for a less pushy feel.' },
]

// ── Platform-specific policy warnings ────────────────────────────────────────
const PLATFORM_POLICY = {
  Instagram: [
    { id: 'engagement_bait',  label: 'Engagement bait',       check: (t) => !/(tag\s+\d+\s+friends|like\s+to\s+win|comment\s+to\s+win|share\s+for\s+a\s+chance)/i.test(t), msg: 'Phrases like "tag 3 friends to win" are classified as engagement bait and may suppress reach.', consequence: 'Reduced organic reach, possible removal from Explore page.', fix: 'Replace with genuine conversation starters: "Who would you bring here?" instead of "Tag 3 friends".' },
    { id: 'no_follow_gates',  label: 'No follow-gating',      check: (t) => !/(follow\s+to\s+(enter|win|get|receive)|must\s+follow\s+to)/i.test(t), msg: 'Contests requiring a follow to enter may violate Instagram\'s promotion guidelines.', consequence: 'Post removal or account action for repeated violations.', fix: 'Make following optional, not a requirement to participate.' },
    { id: 'no_spam_patterns', label: 'No spam signals',        check: (t) => !/(dm\s+me\s+for\s+price|dm\s+for\s+details|price\s+in\s+bio\s+only)/i.test(t), msg: 'Directing users to DM for pricing is a common spam signal flagged by Instagram\'s algorithm.', consequence: 'Lower reach, potential shadowban.', fix: 'Include pricing directly in the caption or direct to a bio link.' },
  ],
  Twitter: [
    { id: 'no_vote_manip',    label: 'No vote manipulation',  check: (t) => !/(retweet\s+to\s+vote|rt\s+for\s+|vote\s+by\s+retweeting)/i.test(t), msg: 'Using retweets as voting mechanisms violates Twitter/X platform manipulation policies.', consequence: 'Tweet removal and potential account suspension.', fix: 'Use native Twitter polls for voting instead of retweet-based votes.' },
    { id: 'no_coordinated',   label: 'No coordinated action', check: (t) => !/(mass\s+report|everyone\s+report|let\'s\s+all\s+report)/i.test(t), msg: 'Calls for coordinated reporting or mass actions violate platform rules.', consequence: 'Account suspension for platform manipulation.', fix: 'Remove calls for coordinated actions entirely.' },
  ],
  LinkedIn: [
    { id: 'no_sensational',   label: 'No sensational tone',   check: (t) => !/(SHOCKING|UNBELIEVABLE|MIND-BLOWING|insane results|crush it|kill it)/i.test(t), msg: 'Sensational or hyperbolic language underperforms on LinkedIn and may reduce algorithm reach.', consequence: 'Lower engagement rate, reduced feed visibility.', fix: 'Replace with specific data points: "We saw a 40% improvement" instead of "insane results".' },
    { id: 'no_buy_connections',label: 'No connection solicitation', check: (t) => !/(connect\s+with\s+me\s+for\s+a\s+prize|connect\s+to\s+win)/i.test(t), msg: 'Incentivising connections with prizes violates LinkedIn\'s professional community policies.', consequence: 'Post removal and potential account restriction.', fix: 'Invite connections based on shared professional interest, not incentives.' },
    { id: 'no_salary_shame',  label: 'No salary/comp shaming', check: (t) => !/(working\s+for\s+free|slave\s+wages|exploitation|unpaid\s+labor)/i.test(t), msg: 'Inflammatory workplace content can trigger LinkedIn\'s community flag system.', consequence: 'Reduced reach, possible review queue.', fix: 'Frame workplace discussions constructively: "Fair compensation practices" vs inflammatory language.' },
  ],
  TikTok: [
    { id: 'no_adult_themes',  label: 'No adult content signals', check: (t) => !/(18\+|adult\s+only|nsfw|explicit)/i.test(t), msg: 'Adult content signals will cause TikTok to suppress or remove the content.', consequence: 'Immediate suppression or removal. Age-restriction flags.', fix: 'Remove age-gating language. Keep content universally accessible.' },
    { id: 'no_dangerous',     label: 'No dangerous challenges', check: (t) => !/(challenge.*dangerous|try\s+this\s+at\s+home|no\s+safety\s+warning)/i.test(t), msg: 'Content that could be interpreted as promoting dangerous behaviour will be removed.', consequence: 'Video removal, strike on account.', fix: 'Add safety disclaimers or reframe to avoid any dangerous implication.' },
  ],
  Facebook: [
    { id: 'no_misleading',    label: 'No misleading content',  check: (t) => !/(fake news|hoax|misinformation|they're hiding|mainstream media lies)/i.test(t), msg: 'Facebook actively suppresses content containing misinformation signals.', consequence: 'Reduced distribution, fact-check label, potential removal.', fix: 'Cite credible sources and use factual, verifiable language.' },
    { id: 'no_engagement_bait',label: 'No engagement bait',    check: (t) => !/(like\s+if\s+you|share\s+if\s+you|comment\s+yes|comment\s+amen)/i.test(t), msg: '"Like if you agree" and "Comment Amen" are classic Facebook engagement bait patterns.', consequence: 'Facebook\'s algorithm explicitly down-ranks engagement bait posts.', fix: 'Ask genuine questions: "What has been your experience with X?" invites authentic engagement.' },
  ],
  YouTube: [
    { id: 'no_reused_content',  label: 'Original content',      check: (t) => !/(reaction\s+to|watching.*react|full\s+video\s+credit|clips\s+from)/i.test(t), msg: 'Reused or reaction content without significant transformation may trigger YouTube\'s spam policy.', consequence: 'Demonetization, reduced recommendations, or video removal.', fix: 'Add substantial original commentary, analysis, or transformation to reused footage.' },
    { id: 'no_misleading_title',label: 'Accurate title/thumbnail', check: (t) => !/(clickbait|you won't believe|shocking truth|exposed|they hid this)/i.test(t), msg: 'YouTube penalises misleading titles and thumbnails that don\'t match video content.', consequence: 'Reduced recommendations, viewer dissatisfaction signals, demonetisation.', fix: 'Use accurate, curiosity-driven titles: "Why [X] actually works" vs "SHOCKING secret exposed".' },
    { id: 'no_paid_promotion_hide', label: 'Disclose paid promotions', check: (t) => !/\b(sponsored|paid\s+partnership|ad|in\s+partnership\s+with|gifted)\b/i.test(t) ? true : true, msg: 'If content includes paid promotions, YouTube requires disclosure both in the video and description.', consequence: 'FTC/ASA violations, potential demonetization.', fix: 'Add "This video contains paid promotion for [Brand]" in the first 3 lines of description.' },
    { id: 'no_copyright_music',  label: 'No unlicensed music signals', check: (t) => !/(background\s+music|royalty\s+free.*not|using.*copyrighted|music\s+by.*without)/i.test(t), msg: 'Referencing copyrighted music without a licence triggers YouTube\'s Content ID system.', consequence: 'Revenue redirected to rights holder, video muted, or taken down.', fix: 'Use YouTube Audio Library, Epidemic Sound, or Artlist for licensed background music.' },
  ],
}

// ── Copyright risk patterns ───────────────────────────────────────────────────
const COPYRIGHT_PATTERNS = [
  {
    id: 'copyrighted_music',
    pattern: /\b(playing|featuring|background music|song by|music by|audio by|ft\.|feat\.|soundtrack)\b/gi,
    label: 'Copyrighted music reference',
    risk: 'High',
    msg: 'References to music in post descriptions signal potential unlicensed audio use.',
    consequence: 'Content ID claim, revenue loss, or muting of the post/video.',
    fix: 'Use royalty-free sources: YouTube Audio Library, Epidemic Sound, or Artlist. Always credit the licence.',
    platforms: ['YouTube', 'Instagram', 'TikTok', 'Facebook'],
  },
  {
    id: 'reused_content',
    pattern: /\b(clip from|footage from|original video by|credit to|not my video|repost from|source:)\b/gi,
    label: 'Reused / non-original content',
    risk: 'High',
    msg: 'Explicit credit to another source suggests reused content without transformation.',
    consequence: 'DMCA takedown, copyright strike, or demonetisation.',
    fix: 'Add substantial original commentary or obtain explicit written permission from the content owner.',
    platforms: ['YouTube', 'Instagram', 'TikTok', 'Twitter', 'Facebook'],
  },
  {
    id: 'missing_attribution',
    pattern: /\b(image from|photo by|photo credit|art by|design by|illustration by)\b/gi,
    label: 'Third-party image / art attribution',
    risk: 'Medium',
    msg: 'Attributing a visual to someone else suggests you may be using their copyrighted work.',
    consequence: 'DMCA notice, post removal, or legal action from the original creator.',
    fix: 'Use your own original images, licensed stock (Unsplash, Pexels), or obtain written permission and credit properly.',
    platforms: ['Instagram', 'LinkedIn', 'Facebook', 'Twitter'],
  },
  {
    id: 'brand_trademark',
    pattern: /\b(official|™|®|©|registered trademark|all rights reserved)\b/gi,
    label: 'Trademark / brand identity signal',
    risk: 'Medium',
    msg: 'Using trademark symbols or "official" claims you don\'t own could constitute infringement.',
    consequence: 'Cease and desist notice, post removal, or brand impersonation flag.',
    fix: 'Remove trademark symbols unless you own them. Never claim to be an "official" account of a brand you don\'t represent.',
    platforms: ['Instagram', 'LinkedIn', 'Facebook', 'Twitter', 'YouTube', 'TikTok'],
  },
  {
    id: 'lyrics_reproduction',
    pattern: /["'].*['"]\s*[-–]\s*(lyrics|song|track|single|album)/gi,
    label: 'Song lyrics reproduction',
    risk: 'High',
    msg: 'Reproducing song lyrics — even a few lines — is a copyright violation without a licence.',
    consequence: 'Post removal, copyright strike, or legal action from the music publisher.',
    fix: 'Paraphrase the theme or emotion instead. Reference the song title and artist without quoting lyrics.',
    platforms: ['Instagram', 'Facebook', 'Twitter', 'LinkedIn', 'YouTube', 'TikTok'],
  },
]

// ── Tone analysis (brand voice check) ────────────────────────────────────────
const TONE_SIGNALS = {
  professional: { positive: /\b(expertise|solution|value|partner|achieve|results|strategy|growth|impact)\b/gi, negative: /\b(lol|wtf|omg|bruh|kinda|sorta|gonna|wanna)\b/gi },
  playful:      { positive: /\b(fun|love|excited|amazing|wow|cool|awesome|vibe|energy|hype)\b/gi,             negative: /\b(therefore|consequently|furthermore|notwithstanding)\b/gi },
  bold:         { positive: /\b(dominate|crush|win|unstoppable|fearless|disrupt|break|change|power|force)\b/gi, negative: /\b(maybe|perhaps|sort of|kind of|might|could possibly)\b/gi },
  friendly:     { positive: /\b(you|your|we|together|community|join|welcome|here for you|support|care)\b/gi,   negative: /\b(clients|customers|consumers|users|end-users|stakeholders)\b/gi },
  luxury:       { positive: /\b(exclusive|premium|curated|crafted|refined|bespoke|elevated|distinguished|exquisite)\b/gi, negative: /\b(cheap|affordable|budget|deal|discount|bargain|sale)\b/gi },
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

  // 1. Sensitivity scan
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

  // 2. Platform policy scan
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

  // 3. Copyright scan (platform-aware)
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

  // 4. Overall risk level
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

    // ── Quality checks ──
    const rules    = PLATFORM_RULES[selectedPlatform] || []
    const passed   = []
    const failed   = []
    const warnings = []

    for (const rule of rules) {
      const ok = rule.check(postText)
      if (ok) passed.push(rule)
      else if (['has_cta', 'has_emoji', 'optimal_length', 'has_fyp_tag', 'professional_tone', 'has_description', 'no_paid_promotion_hide'].includes(rule.id)) {
        warnings.push(rule)
      } else {
        failed.push(rule)
      }
    }

    const toneAnalysis = analyzeTone(postText, campaignTone)
    const score        = Math.round((passed.length / rules.length) * 100)

    // ── Risk analysis ──
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

  // Tab badge counts
  const riskCount = results ? (results.sensitivityWarnings.length + results.policyRisks.length + results.copyrightRisks.length) : 0

  return (
    <div className={styles.page}>

      {/* ── Page header ── */}
      <div className={styles.pageHdr}>
        <div className={styles.pageHdrLeft}>
          <div className={styles.badge}><ShieldIcon /> Compliance Guard</div>
          <h2 className={styles.pageTitle}>Compliance Guard</h2>
          <p className={styles.pageSub}>
            Paste your post copy and check it against platform rules, character limits, hashtag policies, brand tone, and copyright risk signals.
          </p>
        </div>
      </div>

      <div className={styles.layout}>

        {/* ════════ LEFT PANEL ════════ */}
        <div className={styles.inputPanel}>

          {/* Step 1 — Campaign */}
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

          {/* Step 2 — Platform */}
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

          {/* Step 3 — Post text */}
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

          {/* Empty state */}
          {!checked && (
            <div className={styles.emptyOutput}>
              <div className={styles.emptyIcon}><ShieldBigIcon /></div>
              <div className={styles.emptyTitle}>Your compliance report will appear here</div>
              <p className={styles.emptyHint}>
                Compliance Guard checks your post against {selectedPlatform}'s platform rules, copyright risks, sensitivity signals, and brand tone guidelines.
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

          {/* Results */}
          {checked && results && (
            <>
              {/* Score + Risk Level bar */}
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

              {/* Tab switcher */}
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

              {/* ── QUALITY TAB ── */}
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

              {/* ── RISK TAB ── */}
              {activeTab === 'risk' && (
                <div className={styles.tabContent}>

                  {/* All-clear state */}
                  {riskCount === 0 && (
                    <div className={styles.riskAllClear}>
                      <div className={styles.riskAllClearIcon}>🛡️</div>
                      <div className={styles.riskAllClearTitle}>No policy or copyright risks detected</div>
                      <p className={styles.riskAllClearSub}>Your content appears clean for <strong>{results.platform}</strong>. No sensitivity flags, policy violations, or copyright signals found.</p>
                    </div>
                  )}

                  {/* Sensitivity Warnings */}
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
                          {w.found && (
                            <div className={styles.riskFound}>Detected: <code>{w.found}</code></div>
                          )}
                          <div className={styles.riskFixRow}>
                            <span className={styles.riskFixLabel}>💡 Safer alternative:</span>
                            <span className={styles.riskFixText}>{w.suggestion}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Platform Policy Risks */}
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

                  {/* Copyright Risks */}
                  {results.copyrightRisks.length > 0 && (
                    <div className={styles.section}>
                      <div className={styles.sectionTitle}>
                        <CopyrightIcon /> Copyright Awareness
                        <span className={styles.sectionCount}>{results.copyrightRisks.length}</span>
                      </div>
                      <p className={styles.sectionDesc}>Signals that could lead to copyright claims, content strikes, or revenue loss.</p>
                      {results.copyrightRisks.map((c, i) => (
                        <div key={i} className={`${styles.riskCard} ${c.risk === 'High' ? styles.riskCardHigh : styles.riskCardMedium}`}>
                          <div className={styles.riskCardHeader}>
                            <div className={styles.riskCardTitle}><CopyrightSmIcon /> {c.label}</div>
                            <span className={c.risk === 'High' ? styles.riskChipRed : styles.riskChipAmber}>
                              🎵 {c.risk} Risk
                            </span>
                          </div>
                          {c.found && (
                            <div className={styles.riskFound}>Triggered by: <code>{c.found}</code></div>
                          )}
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

// ── Score ring ────────────────────────────────────────────────────────────────
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

// ── Icons ─────────────────────────────────────────────────────────────────────
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
