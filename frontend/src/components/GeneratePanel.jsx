import { useState } from 'react'
import styles from './GeneratePanel.module.css'
import { saveCampaignOutput, saveCampaignOutputToShared, normaliseBrand } from '../lib/campaignService'
import FillFromBriefButton from './FillFromBriefButton.jsx'
import { generateWithFallback } from '../lib/generateWithFallback'
import { postGeneratorFallback } from '../lib/fallbackService'

// ── Gemini responseSchema ─────────────────────────────────────────────────
const schema = {
  type: 'OBJECT',
  properties: {
    campaign_tagline:  { type: 'STRING' },
    campaign_summary:  { type: 'STRING' },
    brand_voice_guide: { type: 'STRING' },
    audience_insight:  { type: 'STRING' },
    platforms: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          platform_name: { type: 'STRING' },
          posts: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                hook:              { type: 'STRING' },
                caption:           { type: 'STRING' },
                hashtags:          { type: 'ARRAY', items: { type: 'STRING' } },
                cta:               { type: 'STRING' },
                content_type:      { type: 'STRING' },
                best_time:         { type: 'STRING' },
                visual_direction:  { type: 'STRING' },
                engagement_tactic: { type: 'STRING' },
              },
              required: ['hook', 'caption', 'hashtags', 'cta', 'content_type'],
            },
          },
        },
        required: ['platform_name', 'posts'],
      },
    },
    campaign_ideas: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          title:             { type: 'STRING' },
          big_idea:          { type: 'STRING' },
          cultural_relevance:{ type: 'STRING' },
          viral_mechanism:   { type: 'STRING' },
          expected_impact:   { type: 'STRING' },
        },
        required: ['title', 'big_idea', 'expected_impact'],
      },
    },
    kpis:        { type: 'ARRAY', items: { type: 'STRING' } },
    budget_tips: { type: 'ARRAY', items: { type: 'STRING' } },
  },
  required: ['platforms', 'campaign_tagline', 'campaign_summary'],
}

const PLATFORMS  = ['Instagram', 'Twitter', 'LinkedIn', 'Facebook', 'TikTok', 'YouTube']
const TONES      = ['Casual', 'Professional', 'Inspirational', 'Humorous', 'Urgent', 'Bold', 'Empathetic', 'Witty']
const AUDIENCES  = ['Gen Z', 'Millennials', 'Professionals', 'Students', 'Parents', 'Entrepreneurs', 'Executives', 'Creators']
const CAMP_TYPES = ['Product Launch', 'Brand Awareness', 'Lead Generation', 'Engagement Boost', 'Content Promotion', 'Seasonal Sale', 'Event Promotion', 'Rebranding']

export default function GeneratePanel({ onClose, onSaved, onNoBrief, sharedCampaignId, prefillBrand }) {
  const [form, setForm] = useState({
    brand: prefillBrand || '', product: '', goal: '', keywords: '',
    tone: 'Inspirational', audience: 'Millennials', campaignType: 'Product Launch',
    variations: 3,
  })
  const [selectedPlatforms, setSelectedPlatforms] = useState(['Instagram', 'Twitter'])
  const [loading,     setLoading]     = useState(false)
  const [retryStatus, setRetryStatus] = useState('')
  const [result,      setResult]      = useState(null)
  const [error,       setError]       = useState('')
  const [activeTab,   setActiveTab]   = useState(null)
  const [saving,      setSaving]      = useState(false)
  const [saveMsg,     setSaveMsg]     = useState('')

  function set(key, val) { setForm(f => ({ ...f, [key]: val })) }

  function togglePlatform(p) {
    setSelectedPlatforms(prev =>
      prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
    )
  }

  function handleFillFromBrief(brief) {
    setForm(f => ({
      ...f,
      brand:    brief.brand_name      || f.brand,
      product:  brief.product_service || f.product,
      goal:     brief.campaign_goal   || f.goal,
      audience: brief.target_audience || f.audience,
      tone:     brief.tone            || f.tone,
    }))
    if (brief.platforms && brief.platforms.length > 0) {
      setSelectedPlatforms(brief.platforms.filter(p => PLATFORMS.includes(p)))
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
      brand:   brand.name     || f.brand,
      product: brand.industry || f.product,
      tone:    toneMap[brand.tone] || f.tone,
    }))
    if (brand.platforms?.length) {
      setSelectedPlatforms(brand.platforms.filter(p => PLATFORMS.includes(p)))
    }
  }

  async function generate() {
    if (!form.brand || !form.product || !form.goal) {
      setError('Please fill in Brand, Product, and Campaign Goal.')
      return
    }
    if (selectedPlatforms.length === 0) {
      setError('Select at least one platform.')
      return
    }

    setError('')
    setRetryStatus('')
    setLoading(true)
    setResult(null)
    setSaveMsg('')

    let shaped = null

    try {
      const platformContext = {
        Instagram: 'visually-led storytelling, Reels-first, aesthetic carousels, relatable captions with line breaks, emojis used intentionally, 3–5 hashtags in first comment',
        Twitter:   'punchy under-280-char hooks, trending conversation inserts, thread potential, wit over polish, 1–2 hashtags max, reply-bait questions',
        LinkedIn:  'thought-leadership tone, data-backed claims, professional narrative arc, personal story hooks, no hashtag spam (3 max), carousel documents',
        Facebook:  'community-driven, longer storytelling format, event/group tie-ins, shareable emotional angles, 2–3 hashtags',
        TikTok:    'trend-native hooks in first 2 seconds, POV or challenge format, casual language, trending audio references, UGC-style raw energy',
        YouTube:   'strong title + thumbnail hook drives 90% of clicks, first 30 seconds must earn the watch, chapters for retention, end-screen CTAs, description SEO with timestamps',
      }

      const selectedPlatformContext = selectedPlatforms
        .map(p => `${p}: ${platformContext[p] || 'platform-native best practices'}`)
        .join('\n')

      const prompt = `You are the Creative Director at a world-class social media agency — the kind that handles Nike, Apple, Spotify, and Zomato. You produce campaigns that win Cannes Lions, not generic AI filler.

CAMPAIGN BRIEF:
- Brand          : ${form.brand}
- Product/Service: ${form.product}
- Campaign Type  : ${form.campaignType}
- Campaign Goal  : ${form.goal}
- Target Audience: ${form.audience}
- Tone           : ${form.tone}
- Keywords/Themes: ${form.keywords || 'derive from brand context'}
- Platforms      : ${selectedPlatforms.join(', ')}
- Variations     : ${form.variations} posts per platform

PLATFORM INTELLIGENCE — write natively for each:
${selectedPlatformContext}

YOUR MANDATE:
1. CAMPAIGN TAGLINE — one unforgettable line. Not a description. A battle cry.
2. BRAND VOICE GUIDE — 3 sentences describing exactly how this brand should sound.
3. AUDIENCE INSIGHT — a sharp, specific truth about this audience that most brands miss.
4. PLATFORM POSTS — for EACH platform, write ${form.variations} DISTINCT variations with hook, caption, hashtags, CTA, content type, best time, visual direction, and engagement tactic.
5. CREATIVE CAMPAIGN IDEAS — 3 big creative concepts with title, big idea, cultural relevance, viral mechanism, and expected impact.
6. KPIs — 5 specific, measurable KPIs with target benchmarks.
7. BUDGET TIPS — 4 strategic media spend recommendations.

Write like your reputation depends on it. Every word must earn its place.`

      // ── Call Gemini with cascade + retry logic ────────────────────────────
      let parsed = await generateWithFallback(prompt, schema, {
        gemini: { model: 'gemini-2.5-flash', temperature: 1.0, maxOutputTokens: 8192 },
        onRetry: (attempt, waitSecs) => {
          setRetryStatus(`Model busy — retrying (${attempt}/3) in ${waitSecs}s…`)
        },
      })
      setRetryStatus('')

      // ── Domain-specific fallback if Gemini unavailable ────────────────────
      if (!parsed) {
        parsed = postGeneratorFallback({
          brand:             form.brand,
          product:           form.product,
          goal:              form.goal,
          tone:              form.tone,
          keywords:          form.keywords,
          campaignType:      form.campaignType,
          selectedPlatforms,
        })
      }

      if (parsed && Array.isArray(parsed.platforms)) {
        const platformsMap = {}
        for (const p of parsed.platforms) {
          if (p.platform_name) {
            platformsMap[p.platform_name] = { posts: p.posts || [] }
          }
        }
        shaped = {
          ...parsed,
          platforms:          platformsMap,
          campaign_name:      form.brand,
          product_or_service: form.product,
        }
      } else {
        shaped = {
          ...parsed,
          campaign_name:      form.brand,
          product_or_service: form.product,
        }
      }
    } catch (err) {
      setRetryStatus('')
      setError(err.message || 'Generation failed. Make sure VITE_GEMINI_API_KEY is set in your .env file.')
      setLoading(false)
      return
    }

    const firstTab = Object.keys(shaped.platforms || {})[0] || null
    setResult(shaped)
    setActiveTab(firstTab)
    setLoading(false)
  }

  async function handleSave() {
    if (!result) return
    setSaving(true)
    setSaveMsg('')
    const campaignName = normaliseBrand(form.brand)

    let saveErr
    if (sharedCampaignId) {
      const res = await saveCampaignOutputToShared(
        sharedCampaignId,
        'post_generator',
        { ...result, product_or_service: form.product },
      )
      saveErr = res.error
    } else {
      const res = await saveCampaignOutput(
        campaignName,
        'post_generator',
        { ...result, product_or_service: form.product },
        { platforms: selectedPlatforms, tone: form.tone }
      )
      saveErr = res.error
    }

    setSaving(false)
    if (saveErr) {
      setSaveMsg(`⚠ Save failed: ${saveErr}`)
    } else {
      setSaveMsg(`✓ Saved to campaign "${campaignName}"`)
      if (onSaved) onSaved(campaignName)
    }
  }

  return (
    <div className={styles.panel}>
      {/* Header */}
      <div className={styles.panelHdr}>
        <div>
          <div className={styles.panelTitle}>AI Post Generator</div>
          <div className={styles.panelSub}>Agency-grade campaigns — powered by Google Gemini</div>
        </div>
        <button className={styles.closeBtn} onClick={onClose}>✕</button>
      </div>

      {/* Form */}
      {!result && (
        <>
          <FillFromBriefButton onFill={handleFillFromBrief} onFillBrand={handleFillFromBrand} onNoBrief={onNoBrief} />

          <div className={styles.fields}>
            <Field label="Brand / Company"   placeholder="e.g. Nike, Zomato, Sourcesys" value={form.brand}    onChange={v => set('brand', v)} />
            <Field label="Product / Service" placeholder="e.g. Running Shoes, SaaS App" value={form.product}  onChange={v => set('product', v)} />
            <Field label="Campaign Goal"     placeholder="e.g. Drive 10K app installs in 30 days" value={form.goal} onChange={v => set('goal', v)} />
            <Field label="Keywords / Themes" placeholder="e.g. speed, performance, bold" value={form.keywords} onChange={v => set('keywords', v)} />
            <Select label="Campaign Type" options={CAMP_TYPES} value={form.campaignType} onChange={v => set('campaignType', v)} />
            <Select label="Tone"          options={TONES}      value={form.tone}         onChange={v => set('tone', v)} />
            <Select label="Target Audience" options={AUDIENCES} value={form.audience}    onChange={v => set('audience', v)} />
            <div className={styles.fieldWide}>
              <label className={styles.fieldLabel}>Variations per Platform: <strong>{form.variations}</strong></label>
              <input
                type="range" min="1" max="5" step="1"
                value={form.variations}
                onChange={e => set('variations', Number(e.target.value))}
                className={styles.slider}
              />
            </div>
          </div>

          <div className={styles.platSection}>
            <div className={styles.fieldLabel}>Platforms</div>
            <div className={styles.platRow}>
              {PLATFORMS.map(p => (
                <button
                  key={p}
                  className={`${styles.platBtn} ${selectedPlatforms.includes(p) ? styles.platSel : ''}`}
                  onClick={() => togglePlatform(p)}
                >{p}</button>
              ))}
            </div>
          </div>

          {error && <div className={styles.error}>{error}</div>}

          <div className={styles.actions}>
            <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
            <button className={styles.genBtn} onClick={generate} disabled={loading}>
              {loading
                ? retryStatus
                  ? <><span className={styles.spinner} /> {retryStatus}</>
                  : <><span className={styles.spinner} /> Generating…</>
                : <><BoltSvg /> Generate Campaign</>}
            </button>
          </div>
        </>
      )}

      {/* Result */}
      {result && (
        <div className={styles.result}>
          <div className={styles.resultCard}>
            <div className={styles.resultName}>{result.campaign_name}</div>
            {result.campaign_tagline && (
              <div className={styles.tagline}>"{result.campaign_tagline}"</div>
            )}
            <div className={styles.resultSummary}>{result.campaign_summary}</div>

            {result.brand_voice_guide && (
              <div className={styles.voiceGuide}>
                <span className={styles.insightLabel}>Brand Voice</span>
                <span className={styles.insightText}>{result.brand_voice_guide}</span>
              </div>
            )}

            {result.audience_insight && (
              <div className={styles.insight}>
                <span className={styles.insightLabel}>Audience Insight</span>
                <span className={styles.insightText}>{result.audience_insight}</span>
              </div>
            )}

            <div className={styles.kpiRow}>
              {(result.kpis || []).map(k => (
                <span key={k} className={styles.kpi}>{k}</span>
              ))}
            </div>
          </div>

          <div className={styles.tabRow}>
            {Object.keys(result.platforms || {}).map(p => (
              <button
                key={p}
                className={`${styles.tab} ${activeTab === p ? styles.tabActive : ''}`}
                onClick={() => setActiveTab(p)}
              >{p}</button>
            ))}
          </div>

          {activeTab && result.platforms[activeTab] && (
            <div className={styles.posts}>
              {(result.platforms[activeTab].posts || []).map((post, i) => (
                <div key={i} className={styles.postCard}>
                  <div className={styles.postHeader}>
                    <div className={styles.postNum}>Variation {i + 1}</div>
                    <div className={styles.postType}>{post.content_type}</div>
                  </div>

                  {post.hook && (
                    <div className={styles.postHook}>
                      <span className={styles.hookLabel}>HOOK</span>
                      <span className={styles.hookText}>{post.hook}</span>
                    </div>
                  )}

                  <div className={styles.postCaption}>{post.caption}</div>
                  <div className={styles.postTags}>{(post.hashtags || []).join(' ')}</div>

                  <div className={styles.postMetaGrid}>
                    {post.cta && (
                      <div className={styles.metaItem}>
                        <span className={styles.metaKey}>CTA</span>
                        <span className={styles.metaVal}>{post.cta}</span>
                      </div>
                    )}
                    {post.best_time && (
                      <div className={styles.metaItem}>
                        <span className={styles.metaKey}>Best Time</span>
                        <span className={styles.metaVal}>{post.best_time}</span>
                      </div>
                    )}
                    {post.visual_direction && (
                      <div className={`${styles.metaItem} ${styles.metaFull}`}>
                        <span className={styles.metaKey}>Visual Direction</span>
                        <span className={styles.metaVal}>{post.visual_direction}</span>
                      </div>
                    )}
                    {post.engagement_tactic && (
                      <div className={`${styles.metaItem} ${styles.metaFull}`}>
                        <span className={styles.metaKey}>Engagement Tactic</span>
                        <span className={styles.metaVal}>{post.engagement_tactic}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {(result.campaign_ideas || []).length > 0 && (
            <div className={styles.ideasSection}>
              <div className={styles.ideasTitle}>Creative Campaign Concepts</div>
              <div className={styles.ideasGrid}>
                {result.campaign_ideas.map((idea, i) => (
                  <div key={i} className={styles.ideaCard}>
                    <div className={styles.ideaTitle}>{idea.title}</div>
                    <div className={styles.ideaDesc}>{idea.big_idea || idea.description}</div>
                    {idea.cultural_relevance && (
                      <div className={styles.ideaCulture}>🌍 {idea.cultural_relevance}</div>
                    )}
                    {idea.viral_mechanism && (
                      <div className={styles.ideaViral}>⚡ {idea.viral_mechanism}</div>
                    )}
                    <div className={styles.ideaImpact}>📈 {idea.expected_impact}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(result.budget_tips || []).length > 0 && (
            <div className={styles.tipsSection}>
              <div className={styles.ideasTitle}>Media Spend Strategy</div>
              {result.budget_tips.map((tip, i) => (
                <div key={i} className={styles.tip}>✅ {tip}</div>
              ))}
            </div>
          )}

          {saveMsg && (
            <div className={saveMsg.startsWith('✓') ? styles.saveSuccess : styles.saveError}>{saveMsg}</div>
          )}

          <div className={styles.resultActions}>
            <button className={styles.cancelBtn} onClick={() => { setResult(null); setError(''); setSaveMsg('') }}>
              ← Generate Another
            </button>
            <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
              {saving ? <><span className={styles.spinner} /> Saving…</> : <>💾 Save to Campaign</>}
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
function BoltSvg() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
    </svg>
  )
}
