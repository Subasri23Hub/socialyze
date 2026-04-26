import { useState } from 'react'
import styles from './GeneratePanel.module.css'
import { saveCampaignOutput, saveCampaignOutputToShared, normaliseBrand } from '../lib/campaignService'
import FillFromBriefButton from './FillFromBriefButton.jsx'
import { generateWithFallback } from '../lib/generateWithFallback'
import { postGeneratorFallback } from '../lib/fallbackService'

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

  // Normalise result into consistent shape.
  // Handles both Groq array format and fallback keyed-object format for `platforms`.
  function shapeResult(parsed) {
    if (!parsed) return null

    let platformsMap = {}

    if (Array.isArray(parsed.platforms)) {
      // Groq format: [{ platform_name: "Instagram", posts: [...] }, ...]
      for (const p of parsed.platforms) {
        if (p && p.platform_name) {
          platformsMap[p.platform_name] = { posts: Array.isArray(p.posts) ? p.posts : [] }
        }
      }
    } else if (parsed.platforms && typeof parsed.platforms === 'object') {
      // Fallback format: { Instagram: { posts: [...] }, LinkedIn: {...} }
      platformsMap = parsed.platforms
    }

    // Ensure every selected platform has at least an empty entry so tabs always render
    for (const p of selectedPlatforms) {
      if (!platformsMap[p]) {
        platformsMap[p] = { posts: [] }
      }
    }

    return {
      ...parsed,
      platforms:          platformsMap,
      campaign_name:      form.brand   || parsed.campaign_name      || 'Campaign',
      product_or_service: form.product || parsed.product_or_service || '',
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

    try {
      const platformHints = {
        Instagram: 'Reels-first, hook line 1, 3-5 hashtags, save-worthy carousels',
        Twitter:   'Under 280 chars, opinionated hook, 1-2 hashtags, thread potential',
        LinkedIn:  'Personal story hook, data-backed, 3 hashtags max, end with question',
        Facebook:  'Community-first, longer story, shareable emotional angle, 2-3 hashtags',
        TikTok:    'Hook in 2s, POV/challenge format, raw UGC energy, trending audio ref',
        YouTube:   'Title = 90% clicks, hook in 30s, description SEO, end-screen CTA',
      }

      const platLines = selectedPlatforms
        .map(p => `${p}: ${platformHints[p] || 'platform-native best practices'}`)
        .join('\n')

      const prompt = `Social media Creative Director. Agency-quality campaign output only.

Brief: ${form.brand} | ${form.product} | ${form.campaignType} | Goal: ${form.goal} | Audience: ${form.audience} | Tone: ${form.tone}${form.keywords ? ` | Keywords: ${form.keywords}` : ''}
Platforms: ${selectedPlatforms.join(', ')} | ${form.variations} variation(s) per platform

Platform rules:
${platLines}

Deliver:
1. campaign_tagline — one memorable line
2. campaign_summary — 2 sentences
3. brand_voice_guide — 2 sentences on how this brand sounds
4. audience_insight — one sharp truth about ${form.audience}
5. platforms — array: for each platform, ${form.variations} posts each with hook, caption, hashtags[], cta, content_type, best_time, visual_direction, engagement_tactic
6. campaign_ideas — 3 concepts: title, big_idea, cultural_relevance, viral_mechanism, expected_impact
7. kpis — 4 measurable KPIs
8. budget_tips — 3 media spend tips

Return ONLY valid JSON. Start { end }.
{
  "campaign_tagline":"","campaign_summary":"","brand_voice_guide":"","audience_insight":"",
  "platforms":[{"platform_name":"${selectedPlatforms[0]}","posts":[{"hook":"","caption":"","hashtags":[],"cta":"","content_type":"","best_time":"","visual_direction":"","engagement_tactic":""}]}],
  "campaign_ideas":[{"title":"","big_idea":"","cultural_relevance":"","viral_mechanism":"","expected_impact":""}],
  "kpis":[],"budget_tips":[]
}`

      let parsed = null

      // ── Step 1: Try backend (Render) — same pattern as CustomFlowPanel ──
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/generate-post`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            brand_name:         form.brand,
            product_or_service: form.product,
            campaign_goal:      form.goal,
            target_audience:    form.audience,
            key_message:        form.keywords || form.goal,
            call_to_action:     `Learn more about ${form.product}`,
            tone:               form.tone,
            platform:           selectedPlatforms[0] || 'Instagram',
          }),
        })
        if (res.ok) {
          const backendData = await res.json()
          // Backend /generate-post returns { post_variations, caption_variations, hashtags, cta }
          // Guard: reject placeholder responses where Groq echoed back template values
          // e.g. post_variations: ["v1", "v2", "v3"] or ["c1", "c2", "c3"]
          const PLACEHOLDER_RE = /^(v\d+|c\d+|post \d+|caption \d+|variation \d+|placeholder|example|sample)$/i
          const isPlaceholder = Array.isArray(backendData?.post_variations) &&
            backendData.post_variations.some(v => PLACEHOLDER_RE.test(String(v).trim()))
          // Convert to the full campaign shape the UI expects
          if (backendData && backendData.post_variations && !isPlaceholder) {
            const platformsMap = {}
            for (const p of selectedPlatforms) {
              platformsMap[p] = {
                posts: backendData.post_variations.map((post, i) => ({
                  hook:              post.split('\n')[0] || post,
                  caption:           post,
                  hashtags:          backendData.hashtags || [],
                  cta:               backendData.cta || '',
                  content_type:      p === 'Instagram' ? 'Reel / Carousel' : p === 'Twitter' ? 'Tweet' : p === 'LinkedIn' ? 'Article / Carousel' : 'Post',
                  best_time:         'Tuesday–Friday, 7–9 AM or 6–9 PM',
                  visual_direction:  '',
                  engagement_tactic: '',
                })),
              }
            }
            parsed = {
              campaign_tagline:  backendData.caption_variations?.[0] || `${form.brand} — ${form.goal}`,
              campaign_summary:  backendData.caption_variations?.[1] || '',
              brand_voice_guide: backendData.caption_variations?.[2] || '',
              audience_insight:  '',
              platforms:         platformsMap,
              campaign_ideas:    [],
              kpis:              [],
              budget_tips:       [],
            }
          }
        }
      } catch (_) { /* backend unavailable — fall through */ }

      // ── Step 2: Try frontend Groq directly ──────────────────────────────
      if (!parsed) {
        try {
          parsed = await generateWithFallback(prompt, null, {
            groq: { temperature: 1.0, maxOutputTokens: 1800 },
          })
        } catch (_) { /* Groq failed — fall through to static fallback */ }
      }

      // ── Step 3: Static domain fallback ──────────────────────────────────
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

      setRetryStatus('')

      // ── Step 4: Normalise into consistent render shape ───────────────────
      const shaped = shapeResult(parsed)

      if (!shaped) {
        setError('Generation failed. Please try again.')
        setLoading(false)
        return
      }

      const firstTab = Object.keys(shaped.platforms || {})[0] || null
      setResult(shaped)
      setActiveTab(firstTab)
    } catch (err) {
      setError('Generation failed. Please try again.')
    }

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
          <div className={styles.panelSub}>Agency-grade campaigns — powered by AI</div>
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
