import { useState } from 'react'
import styles from './CustomFlowPanel.module.css'
import { saveCampaignOutput, saveCampaignOutputToShared } from '../lib/campaignService'
import FillFromBriefButton from './FillFromBriefButton.jsx'
import { generateWithFallback } from '../lib/generateWithFallback'
import { customFlowFallback } from '../lib/fallbackService'

const TONES         = ['Casual', 'Professional', 'Inspirational', 'Humorous', 'Urgent', 'Bold', 'Empathetic', 'Provocative', 'Witty']
const DURATIONS     = ['1 Week', '2 Weeks', '1 Month', '6 Weeks', '2 Months', '3 Months']
const ALL_PLATFORMS = ['Instagram', 'Twitter', 'LinkedIn', 'Facebook', 'TikTok', 'YouTube']


export default function CustomFlowPanel({ onClose, onSaved, onNoBrief, sharedCampaignId, prefillBrand }) {
  const [form, setForm] = useState({
    brand_name: prefillBrand || '', product_or_service: '', business_objective: '',
    target_audience: '', tone: 'Inspirational', campaign_duration: '1 Month',
    key_message: '', call_to_action: '',
  })
  const [selectedPlatforms, setSelectedPlatforms] = useState(['Instagram', 'LinkedIn'])
  const [loading,       setLoading]       = useState(false)
  const [result,        setResult]        = useState(null)
  const [error,         setError]         = useState('')
  const [activeSection, setActiveSection] = useState('pillars')
  const [openWeeks,     setOpenWeeks]     = useState({})
  const [saving,        setSaving]        = useState(false)
  const [saveMsg,       setSaveMsg]       = useState('')

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }
  function toggleWeek(i) { setOpenWeeks(prev => ({ ...prev, [i]: !prev[i] })) }

  // Clean old saved data that has unfilled template placeholders like ${d.brand_name}
  function cleanText(str) {
    if (!str || typeof str !== 'string') return str
    return str
      .replace(/\$\{d\.brand_name\}/g, form.brand_name || '')
      .replace(/\$\{d\.target_audience\}/g, form.target_audience || '')
      .replace(/\$\{d\.product_or_service\}/g, form.product_or_service || '')
      .replace(/\$\{d\.[^}]+\}/g, '')  // strip any remaining ${d.xxx} patterns
      .replace(/\s{2,}/g, ' ').trim()
  }
  function togglePlat(p) {
    setSelectedPlatforms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])
  }

  function handleFillFromBrief(brief) {
    setForm(f => ({
      ...f,
      brand_name:         brief.brand_name      || f.brand_name,
      product_or_service: brief.product_service || f.product_or_service,
      business_objective: brief.campaign_goal   || f.business_objective,
      target_audience:    brief.target_audience || f.target_audience,
      tone:               brief.tone            || f.tone,
    }))
    if (brief.platforms && brief.platforms.length > 0) {
      setSelectedPlatforms(brief.platforms.filter(p => ALL_PLATFORMS.includes(p)))
    }
  }

  function handleFillFromBrand(brand) {
    const toneMap = {
      'Professional':           'Professional',
      'Casual & Friendly':      'Casual',
      'Inspirational':          'Inspirational',
      'Witty & Humorous':       'Humorous',
      'Bold & Edgy':            'Bold',
      'Luxury & Sophisticated': 'Professional',
      'Educational':            'Professional',
      'Empathetic':             'Empathetic',
    }
    setForm(f => ({
      ...f,
      brand_name:         brand.name     || f.brand_name,
      product_or_service: brand.industry || f.product_or_service,
      tone:               toneMap[brand.tone] || f.tone,
    }))
    if (brand.platforms?.length) {
      setSelectedPlatforms(brand.platforms.filter(p => ALL_PLATFORMS.includes(p)))
    }
  }

  async function generate() {
    const required = ['brand_name', 'product_or_service', 'business_objective', 'target_audience', 'key_message', 'call_to_action']
    const empty = required.filter(k => !form[k].trim())
    if (empty.length) { setError('Please fill in all required fields.'); return }
    if (!selectedPlatforms.length) { setError('Select at least one platform.'); return }
    setError(''); setLoading(true); setResult(null); setSaveMsg('')

    const payload = { ...form, platforms: selectedPlatforms }

    try {
      let data = null

      try {
        const res = await fetch('http://localhost:3000/custom-flow', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (res.ok) data = await res.json()
      } catch (_) {}

      if (!data) {
        const platformNotes = {
          Instagram: 'Reels-first, Stories for engagement, Carousels for depth, Feed posts for brand presence. Use save-worthy content. Best times: Tue–Fri 7–9am and 6–9pm.',
          LinkedIn:  'Thought leadership angle. Personal stories outperform brand posts 10x. Document carousels get 3x reach. B2B decision makers scroll Tue–Thu 7–9am. No hashtag spam.',
          Twitter:   'Hook in first 5 words. Thread format for depth. Quote-tweet opportunities. Real-time relevance beats polished copy. 1–2 hashtags max.',
          TikTok:    'Hook in 0–2 seconds. Native TikTok language — "POV", "Tell me why...", duet/stitch potential. Trending sounds. Raw > polished.',
          Facebook:  'Longer captions work. Community-first framing. Events and groups integration. Shareable emotional angles. Video autoplay in feed.',
          YouTube:   'Strong thumbnail + title = 90% of clicks. Hooks in first 30s. End-screen CTAs. Description SEO. Chapters for retention.',
        }

        const selectedPlatformNotes = selectedPlatforms
          .map(p => `${p}: ${platformNotes[p] || 'platform-native best practices'}`)
          .join('\n')

        const prompt = `You are the Chief Strategy Officer at a world-class integrated marketing agency. Your client is ${form.brand_name}. This is not a template fill-in — this is a real, paid, high-stakes campaign brief that will be presented to their CMO tomorrow morning.

CAMPAIGN BRIEF:
- Brand              : ${form.brand_name}
- Product/Service    : ${form.product_or_service}
- Business Objective : ${form.business_objective}
- Target Audience    : ${form.target_audience}
- Tone               : ${form.tone}
- Platforms          : ${selectedPlatforms.join(', ')}
- Campaign Duration  : ${form.campaign_duration}
- Key Message        : ${form.key_message}
- Primary CTA        : ${form.call_to_action}

PLATFORM INTELLIGENCE:
${selectedPlatformNotes}

DELIVERABLES — produce a complete, professional campaign skeleton:

1. CAMPAIGN NAME: A proper campaign name that could headline a press release.

2. CAMPAIGN POSITIONING STATEMENT (3 sentences): How ${form.brand_name} wants the world to see this campaign. The "why this matters now" framing.

3. CAMPAIGN SUMMARY (4–5 sentences): The full picture — what we're doing, why, for whom, how, and what winning looks like. Boardroom-ready language.

4. BRAND VOICE IN THIS CAMPAIGN: 4 specific direction notes on vocabulary, tone, sentence structure, and what we NEVER say in this campaign. Make it actionable for a copywriter.

5. CONTENT PILLARS (exactly 5): Each pillar is a thematic territory for content. Format: "Pillar name — one sentence description — example content idea". Not vague (not just "Education" — give it teeth like "The Honest Truth — demystifying [industry jargon] with data-backed breakdowns your audience can screenshot and share").

6. PLATFORM STRATEGY (one per selected platform): For each platform, give a 3–4 sentence strategy covering: content role, tone adjustment for this platform, content formats to prioritise, posting frequency, what success looks like.

7. POSTING PLAN (${form.campaign_duration}): Week-by-week plan. CRITICAL RULE: Every single value must be 100% specific to ${form.brand_name} and ${form.product_or_service}. NEVER write placeholder text like "[brand]", "[product]", "your audience" or template variables. Write real names, real topics, real actions.
For each week provide:
- week: label e.g. "Week 1" or "Weeks 1-2"
- theme: a sharp strategic name for this week (e.g. "The Scroll-Stop", "The Trust Stack")
- goal: one specific measurable outcome written for ${form.brand_name} this week
- content_plan: exactly 3 bullet points, each = a specific post format + real topic for ${form.brand_name}. Include post count.
- execution_tips: exactly 2 short tactical actions for this specific week (e.g. "Pin the Reel. Don't boost yet. Reply to every comment in first 2 hours.")
- ai_insights: one sentence: best time to post on ${selectedPlatforms.join('/')} this week + platform to prioritise + expected outcome if executed well

8. SAMPLE CAPTIONS (6 total, platform-labeled): Write 6 full, publish-ready captions. At least one per major selected platform. Include hooks, body copy, hashtags, and CTA. These should be immediately usable by a content team.

9. HASHTAG STRATEGY: 20 hashtags organized into 3 tiers — (a) Brand hashtags (2–3, unique to this campaign), (b) Trend hashtags (5–7, high-volume relevant), (c) Niche hashtags (8–10, community-specific, low-competition). Label each tier clearly.

10. CONTENT CALENDAR HOOKS: 8 specific content ideas tied to real cultural moments, trending topics, or weekly content formats (e.g. "Monday Motivation series", "Wednesday myth-bust", "Friday behind-the-scenes") that fit this campaign's ${form.campaign_duration} run.

Every section should be specific to ${form.brand_name} and ${form.product_or_service}. Generic filler is not acceptable. Write as if your agency's next retainer depends on this brief.`

        const schema = {
          type: 'OBJECT',
          properties: {
            campaign_name:            { type: 'STRING' },
            positioning_statement:    { type: 'STRING' },
            campaign_summary:         { type: 'STRING' },
            brand_voice_guide:        { type: 'STRING' },
            content_pillars: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  name:        { type: 'STRING' },
                  description: { type: 'STRING' },
                  example:     { type: 'STRING' },
                },
                required: ['name', 'description', 'example'],
              },
            },
            platform_strategy: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  platform:  { type: 'STRING' },
                  strategy:  { type: 'STRING' },
                  frequency: { type: 'STRING' },
                  formats:   { type: 'STRING' },
                },
                required: ['platform', 'strategy', 'frequency', 'formats'],
              },
            },
            posting_plan: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  week:            { type: 'STRING' },
                  theme:           { type: 'STRING' },
                  goal:            { type: 'STRING' },
                  content_plan:    { type: 'ARRAY', items: { type: 'STRING' } },
                  execution_tips:  { type: 'ARRAY', items: { type: 'STRING' } },
                  ai_insights:     { type: 'STRING' },
                },
                required: ['week', 'theme', 'goal', 'content_plan', 'execution_tips', 'ai_insights'],
              },
            },
            sample_captions: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  platform: { type: 'STRING' },
                  caption:  { type: 'STRING' },
                },
                required: ['platform', 'caption'],
              },
            },
            hashtag_strategy: {
              type: 'OBJECT',
              properties: {
                brand_hashtags: { type: 'ARRAY', items: { type: 'STRING' } },
                trend_hashtags: { type: 'ARRAY', items: { type: 'STRING' } },
                niche_hashtags: { type: 'ARRAY', items: { type: 'STRING' } },
              },
              required: ['brand_hashtags', 'trend_hashtags', 'niche_hashtags'],
            },
            calendar_hooks: { type: 'ARRAY', items: { type: 'STRING' } },
          },
          required: [
            'campaign_name', 'positioning_statement', 'campaign_summary', 'brand_voice_guide',
            'content_pillars', 'platform_strategy', 'posting_plan',
            'sample_captions', 'hashtag_strategy', 'calendar_hooks',
          ],
        }

        data = await generateWithFallback(prompt, schema, {
          gemini: { temperature: 0.95, maxOutputTokens: 8192 },
        })
      }

      if (!data) {
        data = customFlowFallback({ ...form, platforms: selectedPlatforms })
      }
      setResult(data)
      // Open all weeks by default so content is immediately visible
      if (data?.posting_plan) {
        const allOpen = {}
        data.posting_plan.forEach((_, i) => { allOpen[i] = true })
        setOpenWeeks(allOpen)
      }
    } catch (err) {
      setError(err.message || 'Generation failed. Please try again.')
    }
    setLoading(false)
  }

  async function handleSave() {
    if (!result) return
    setSaving(true); setSaveMsg('')

    if (sharedCampaignId) {
      // Invitee saving into a shared campaign — write directly to the owner's campaign
      const { error: saveErr } = await saveCampaignOutputToShared(
        sharedCampaignId, 'custom_flow', result
      )
      setSaving(false)
      if (saveErr) {
        setSaveMsg(`⚠ Save failed: ${saveErr}`)
      } else {
        setSaveMsg('✓ Saved to shared campaign')
        if (onSaved) onSaved(prefillBrand || '')
      }
    } else {
      // Normal owner save
      const campaignName = form.brand_name
      const { error: saveErr } = await saveCampaignOutput(
        campaignName, 'custom_flow', result,
        { platforms: selectedPlatforms, tone: form.tone }
      )
      setSaving(false)
      if (saveErr) {
        setSaveMsg(`⚠ Save failed: ${saveErr}`)
      } else {
        setSaveMsg(`✓ Saved to campaign "${campaignName}"`)
        if (onSaved) onSaved(campaignName)
      }
    }
  }

  const SECTIONS = [
    { id: 'overview',  label: 'Overview' },
    { id: 'pillars',   label: 'Content Pillars' },
    { id: 'strategy',  label: 'Platform Strategy' },
    { id: 'plan',      label: 'Posting Plan' },
    { id: 'captions',  label: 'Sample Captions' },
    { id: 'hashtags',  label: 'Hashtag Strategy' },
    { id: 'calendar',  label: 'Content Calendar' },
  ]

  const PLATFORM_COLORS = {
    instagram: '#E1306C',
    linkedin:  '#0077B5',
    twitter:   '#1DA1F2',
    tiktok:    '#010101',
    facebook:  '#1877F2',
    youtube:   '#FF0000',
  }
  function platColor(p) {
    return PLATFORM_COLORS[(p || '').toLowerCase()] || '#3B6BF5'
  }

  return (
    <div className={styles.panel}>
      <div className={styles.hdr}>
        <div>
          <div className={styles.title}>Custom Flow</div>
          <div className={styles.sub}>Full integrated campaign skeleton — strategy, plan, captions, hashtags & calendar</div>
        </div>
        <button className={styles.closeBtn} onClick={onClose}>✕</button>
      </div>

      {!result && (
        <>
          <FillFromBriefButton onFill={handleFillFromBrief} onFillBrand={handleFillFromBrand} onNoBrief={onNoBrief} />

          <div className={styles.fields}>
            <Field label="Brand Name *"         placeholder="e.g. Sourcesys, Swiggy"       value={form.brand_name}         onChange={v => set('brand_name', v)} />
            <Field label="Product / Service *"  placeholder="e.g. SaaS Platform, App"      value={form.product_or_service} onChange={v => set('product_or_service', v)} />
            <Field label="Business Objective *" placeholder="e.g. Generate 500 qualified B2B leads in 30 days" value={form.business_objective} onChange={v => set('business_objective', v)} />
            <Field label="Target Audience *"    placeholder="e.g. IT Decision Makers, CTO/VPs at 100–500 person companies" value={form.target_audience} onChange={v => set('target_audience', v)} />
            <Field label="Key Message *"        placeholder="e.g. Cut deployment time by 60% — no code changes" value={form.key_message} onChange={v => set('key_message', v)} />
            <Field label="Call to Action *"     placeholder="e.g. Book a 15-min demo, Start free trial" value={form.call_to_action} onChange={v => set('call_to_action', v)} />
            <Select label="Tone"              options={TONES}     value={form.tone}              onChange={v => set('tone', v)} />
            <Select label="Campaign Duration" options={DURATIONS} value={form.campaign_duration} onChange={v => set('campaign_duration', v)} />
          </div>

          <div className={styles.platSection}>
            <div className={styles.fieldLabel}>Platforms *</div>
            <div className={styles.platRow}>
              {ALL_PLATFORMS.map(p => (
                <button key={p}
                  className={`${styles.platBtn} ${selectedPlatforms.includes(p) ? styles.platSel : ''}`}
                  onClick={() => togglePlat(p)}>
                  {p}
                </button>
              ))}
            </div>
          </div>

          {error && <div className={styles.error}>{error}</div>}
          <div className={styles.actions}>
            <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
            <button className={styles.genBtn} onClick={generate} disabled={loading}>
              {loading ? <><Spinner /> Building Campaign…</> : <><ZapIcon /> Generate Full Campaign</>}
            </button>
          </div>
        </>
      )}

      {result && (
        <div className={styles.result}>
          {/* Campaign header */}
          <div className={styles.campCard}>
            <div className={styles.campName}>{result.campaign_name}</div>
            {result.positioning_statement && (
              <div className={styles.positioning}>{result.positioning_statement}</div>
            )}
            <div className={styles.metaRow}>
              <span className={styles.metaPill}>{form.tone}</span>
              <span className={styles.metaPill}>{form.campaign_duration}</span>
              {selectedPlatforms.map(p => (
                <span key={p} className={styles.platMetaPill} style={{ borderColor: platColor(p), color: platColor(p) }}>{p}</span>
              ))}
            </div>
          </div>

          {/* Section tabs */}
          <div className={styles.tabs}>
            {SECTIONS.map(s => (
              <button key={s.id}
                className={`${styles.tab} ${activeSection === s.id ? styles.tabActive : ''}`}
                onClick={() => setActiveSection(s.id)}>
                {s.label}
              </button>
            ))}
          </div>

          {/* Overview */}
          {activeSection === 'overview' && (
            <div className={styles.section}>
              {result.campaign_summary && (
                <div className={styles.overviewCard}>
                  <div className={styles.overviewLabel}>Campaign Summary</div>
                  <div className={styles.overviewText}>{result.campaign_summary}</div>
                </div>
              )}
              {result.brand_voice_guide && (
                <div className={styles.voiceCard}>
                  <div className={styles.overviewLabel}>Brand Voice Guide</div>
                  <div className={styles.voiceText}>{result.brand_voice_guide}</div>
                </div>
              )}
            </div>
          )}

          {/* Content Pillars */}
          {activeSection === 'pillars' && (
            <div className={styles.section}>
              {(result.content_pillars || []).map((pillar, i) => {
                const PILLAR_COLORS = ['#3B6BF5', '#16A34A', '#EA580C', '#9333EA', '#CA8A04']
                const color = PILLAR_COLORS[i % PILLAR_COLORS.length]
                return (
                  <div key={i} className={styles.pillarCard} style={{ borderLeftColor: color }}>
                    <div className={styles.pillarHeader}>
                      <div className={styles.pillarNum} style={{ background: color + '18', color }}>P{i + 1}</div>
                      <div className={styles.pillarName}>{pillar.name || pillar}</div>
                    </div>
                    {pillar.description && <div className={styles.pillarDesc}>{pillar.description}</div>}
                    {pillar.example && (
                      <div className={styles.pillarExample}>
                        <span className={styles.exLabel}>Example →</span> {pillar.example}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Platform Strategy */}
          {activeSection === 'strategy' && (
            <div className={styles.section}>
              {(result.platform_strategy || []).map((ps, i) => (
                <div key={i} className={styles.stratCard}>
                  <div className={styles.stratHeader}>
                    <div className={styles.stratPlat} style={{ background: platColor(ps.platform) + '18', color: platColor(ps.platform) }}>
                      {ps.platform}
                    </div>
                    {ps.frequency && (
                      <div className={styles.stratFreq}>{ps.frequency}</div>
                    )}
                  </div>
                  <div className={styles.stratText}>{ps.strategy}</div>
                  {ps.formats && (
                    <div className={styles.stratFormats}>
                      <span className={styles.formatsLabel}>Formats:</span> {ps.formats}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Posting Plan */}
          {activeSection === 'plan' && (
            <div className={styles.section}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(result.posting_plan || []).map((week, i) => {
                  const isOpen = !!openWeeks[i]
                  return (
                    <div key={i} style={{ border: '1.5px solid rgba(147,51,234,0.18)', borderRadius: 12, overflow: 'hidden', background: '#fff' }}>
                      {/* Header — always visible, clickable */}
                      <div
                        onClick={() => toggleWeek(i)}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', cursor: 'pointer', background: isOpen ? '#FDF4FF' : '#fff', transition: 'background 0.15s', userSelect: 'none' }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1, minWidth: 0 }}>
                          <div className={styles.weekLabel} style={{ margin: 0 }}>
                            {week.week}{week.theme ? ` — ${week.theme.toUpperCase()}` : ''}
                          </div>
                          {(week.goal || week.focus) && (
                            <div style={{ fontSize: 12.5, fontWeight: 600, color: '#0D0F1A', lineHeight: 1.4, paddingRight: 12 }}>{cleanText(week.goal || week.focus)}</div>
                          )}
                        </div>
                        <span style={{ fontSize: 14, color: '#9333EA', flexShrink: 0, marginLeft: 10 }}>{isOpen ? '▲' : '▼'}</span>
                      </div>

                      {/* Body — only visible when open */}
                      {isOpen && (
                        <div style={{ padding: '10px 16px 14px', borderTop: '1px solid rgba(147,51,234,0.12)' }}>

                          {/* NEW SCHEMA: content_plan array */}
                          {(week.content_plan || []).length > 0 && (
                            <div className={styles.weekSection}>
                              <div className={styles.weekSectionLabel}>Content Plan</div>
                              {week.content_plan.map((item, j) => (
                                <div key={j} className={styles.weekBullet}>
                                  <span className={styles.weekBulletDot} />{item}
                                </div>
                              ))}
                            </div>
                          )}

                          {/* OLD SCHEMA FALLBACK: post_types + sample_idea */}
                          {!week.content_plan?.length && week.post_types && (
                            <div className={styles.weekSection}>
                              <div className={styles.weekSectionLabel}>Content Plan</div>
                              <div className={styles.weekTypes}>{cleanText(week.post_types)}</div>
                              {week.sample_idea && (
                                <div className={styles.weekBullet}>
                                  <span className={styles.weekBulletDot} />{cleanText(week.sample_idea)}
                                </div>
                              )}
                            </div>
                          )}

                          {/* NEW SCHEMA: execution_tips array */}
                          {(week.execution_tips || []).length > 0 && (
                            <div className={styles.weekSection}>
                              <div className={styles.weekSectionLabel}>Execution Tips</div>
                              {week.execution_tips.map((tip, j) => (
                                <div key={j} className={styles.weekTactic}>⚡ {tip}</div>
                              ))}
                            </div>
                          )}

                          {/* OLD SCHEMA FALLBACK: tactical_note */}
                          {!week.execution_tips?.length && week.tactical_note && (
                            <div className={styles.weekSection}>
                              <div className={styles.weekSectionLabel}>Execution Tips</div>
                              <div className={styles.weekTactic}>⚡ {cleanText(week.tactical_note)}</div>
                            </div>
                          )}

                          {/* NEW SCHEMA: ai_insights */}
                          {week.ai_insights && (
                            <div className={styles.weekInsight}>
                              <span className={styles.weekInsightIcon}>🧠</span>{week.ai_insights}
                            </div>
                          )}

                          {/* OLD SCHEMA FALLBACK: focus as goal subtitle - already shown in header, skip in body */}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Sample Captions */}
          {activeSection === 'captions' && (
            <div className={styles.section}>
              {(result.sample_captions || []).map((item, i) => {
                const caption  = typeof item === 'string' ? item : item.caption
                const platform = typeof item === 'object' ? item.platform : null
                return (
                  <div key={i} className={styles.captionCard}>
                    <div className={styles.captionHeader}>
                      <div className={styles.captionNum}>Caption {i + 1}</div>
                      {platform && (
                        <div className={styles.captionPlat} style={{ color: platColor(platform), background: platColor(platform) + '18' }}>{platform}</div>
                      )}
                    </div>
                    <div className={styles.captionText}>{caption}</div>
                    <button
                      className={styles.copyBtn}
                      onClick={() => navigator.clipboard.writeText(caption)}
                    >Copy</button>
                  </div>
                )
              })}
            </div>
          )}

          {/* Hashtag Strategy */}
          {activeSection === 'hashtags' && (
            <div className={styles.section}>
              {result.hashtag_strategy ? (
                <>
                  {result.hashtag_strategy.brand_hashtags?.length > 0 && (
                    <div className={styles.hashTier}>
                      <div className={styles.hashTierLabel}>🏷 Brand Hashtags</div>
                      <div className={styles.hashGrid}>
                        {result.hashtag_strategy.brand_hashtags.map((tag, i) => (
                          <span key={i} className={`${styles.hashTag} ${styles.hashBrand}`}>{tag}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {result.hashtag_strategy.trend_hashtags?.length > 0 && (
                    <div className={styles.hashTier}>
                      <div className={styles.hashTierLabel}>📈 Trend Hashtags</div>
                      <div className={styles.hashGrid}>
                        {result.hashtag_strategy.trend_hashtags.map((tag, i) => (
                          <span key={i} className={`${styles.hashTag} ${styles.hashTrend}`}>{tag}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {result.hashtag_strategy.niche_hashtags?.length > 0 && (
                    <div className={styles.hashTier}>
                      <div className={styles.hashTierLabel}>🎯 Niche Hashtags</div>
                      <div className={styles.hashGrid}>
                        {result.hashtag_strategy.niche_hashtags.map((tag, i) => (
                          <span key={i} className={`${styles.hashTag} ${styles.hashNiche}`}>{tag}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className={styles.hashCopy}
                    onClick={() => {
                      const all = [
                        ...(result.hashtag_strategy.brand_hashtags || []),
                        ...(result.hashtag_strategy.trend_hashtags || []),
                        ...(result.hashtag_strategy.niche_hashtags || []),
                      ]
                      navigator.clipboard.writeText(all.join(' '))
                    }}>
                    Copy all hashtags
                  </div>
                </>
              ) : (
                // Fallback: old flat hashtag array
                <div className={styles.hashGrid}>
                  {(result.hashtags || []).map((tag, i) => (
                    <span key={i} className={styles.hashTag}>{tag}</span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Content Calendar */}
          {activeSection === 'calendar' && (
            <div className={styles.section}>
              {(result.calendar_hooks || []).map((hook, i) => (
                <div key={i} className={styles.calendarCard}>
                  <div className={styles.calendarNum}>{i + 1}</div>
                  <div className={styles.calendarText}>{hook}</div>
                </div>
              ))}
            </div>
          )}

          {saveMsg && <div className={saveMsg.startsWith('✓') ? styles.saveSuccess : styles.saveError}>{saveMsg}</div>}

          <div className={styles.resultActions}>
            <button className={styles.cancelBtn} onClick={() => { setResult(null); setError(''); setSaveMsg('') }}>← Generate Again</button>
            <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
              {saving ? <><Spinner /> Saving…</> : <>💾 Save to Campaign</>}
            </button>
            <button className={styles.genBtn} onClick={onClose}>Done ✓</button>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, placeholder, value, onChange }) {
  return (
    <div>
      <label className={styles.fieldLabel}>{label}</label>
      <input className={styles.input} type="text" placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)} />
    </div>
  )
}
function Select({ label, options, value, onChange }) {
  return (
    <div>
      <label className={styles.fieldLabel}>{label}</label>
      <select className={styles.input} value={value} onChange={e => onChange(e.target.value)}>
        {options.map(o => <option key={o}>{o}</option>)}
      </select>
    </div>
  )
}
function Spinner() { return <span className={styles.spinner} /> }
function ZapIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  )
}
