import { useState } from 'react'
import styles from './CampaignIdeationPanel.module.css'
import { saveCampaignOutput, saveCampaignOutputToShared } from '../lib/campaignService'
import FillFromBriefButton from './FillFromBriefButton.jsx'
import { generateWithFallback } from '../lib/generateWithFallback'
import { campaignIdeationFallback } from '../lib/fallbackService'

const TONES     = ['Casual', 'Professional', 'Inspirational', 'Humorous', 'Urgent', 'Playful', 'Bold', 'Empathetic', 'Witty', 'Provocative']
const PLATFORMS = ['Instagram', 'Twitter', 'LinkedIn', 'Facebook', 'TikTok', 'YouTube', 'Multi-Platform']

const HUB_TONE_MAP = {
  'Professional':           'Professional',
  'Casual & Friendly':      'Casual',
  'Inspirational':          'Inspirational',
  'Witty & Humorous':       'Humorous',
  'Bold & Edgy':            'Bold',
  'Luxury & Sophisticated': 'Professional',
  'Educational':            'Professional',
  'Empathetic':             'Empathetic',
}

export default function CampaignIdeationPanel({ onClose, onSaved, onNoBrief, sharedCampaignId, prefillBrand }) {
  const [form, setForm] = useState({
    brand_name: prefillBrand || '', product_or_service: '', campaign_goal: '',
    target_audience: '', tone: 'Inspirational',
    season_or_event: '', platform_focus: 'Instagram',
  })
  const [loading,  setLoading]  = useState(false)
  const [result,   setResult]   = useState(null)
  const [error,    setError]    = useState('')
  const [saving,   setSaving]   = useState(false)
  const [saveMsg,  setSaveMsg]  = useState('')

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  function handleFillFromBrief(brief) {
    setForm(f => ({
      ...f,
      brand_name:         brief.brand_name      || f.brand_name,
      product_or_service: brief.product_service || f.product_or_service,
      campaign_goal:      brief.campaign_goal   || f.campaign_goal,
      target_audience:    brief.target_audience || f.target_audience,
      tone:               brief.tone            || f.tone,
    }))
  }

  function handleFillFromBrand(brand) {
    const mappedTone = HUB_TONE_MAP[brand.tone] || 'Inspirational'
    const platforms  = (brand.platforms || [])
      .map(p => p.toLowerCase().includes('twitter') ? 'Twitter' : p)
      .filter(p => PLATFORMS.includes(p))
    setForm(f => ({
      ...f,
      brand_name:         brand.name     || f.brand_name,
      product_or_service: brand.industry || f.product_or_service,
      tone:               mappedTone,
      platform_focus:     platforms[0]   || f.platform_focus,
    }))
  }

  async function generate() {
    const required = ['brand_name', 'product_or_service', 'campaign_goal', 'target_audience', 'season_or_event']
    const empty = required.filter(k => !form[k].trim())
    if (empty.length) { setError('Please fill in all required fields.'); return }
    setError(''); setLoading(true); setResult(null); setSaveMsg('')

    try {
      let data = null

      // ── Step 1: Try backend (Groq) ──────────────────────────────────────
      try {
        const res = await fetch('http://localhost:3000/campaign-ideation', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(form),
        })
        if (res.ok) {
          const raw = await res.json()
          // Backend returns { campaigns, campaign_ideas } — normalise to campaign_ideas for the UI
          if (!raw.campaign_ideas && raw.campaigns) raw.campaign_ideas = raw.campaigns
          if (raw.campaign_ideas) {
            raw.campaign_ideas = raw.campaign_ideas.map(c => ({
              ...c,
              idea_title:         c.idea_title         || c.title        || '',
              tagline:            c.tagline            || '',
              big_idea:           c.big_idea           || c.idea         || '',
              cultural_hook:      c.cultural_hook      || c.why_it_works || '',
              platform_execution: c.platform_execution || c.execution    || '',
              sample_post:        c.sample_post        || '',
              viral_mechanism:    c.viral_mechanism    || '',
              influencer_strategy:c.influencer_strategy|| '',
              success_metric:     c.success_metric     || '',
              why_it_wins:        c.why_it_wins        || '',
              hashtag_breakdown:  c.hashtag_breakdown  || [],
            }))
          }
          data = raw
        }
      } catch (_) { /* backend unavailable — try Groq direct */ }

      // ── Step 2: Try Groq direct from browser ──────────────────────────────
      if (!data) {
        const prompt = `You are the Executive Creative Director at a world-class agency. Generate 5 radically distinct campaign concepts for ${form.brand_name}.

CAMPAIGN BRIEF:
- Brand          : ${form.brand_name}
- Product/Service: ${form.product_or_service}
- Campaign Goal  : ${form.campaign_goal}
- Target Audience: ${form.target_audience}
- Tone           : ${form.tone}
- Season/Event   : ${form.season_or_event}
- Platform Focus : ${form.platform_focus}

Generate EXACTLY 5 ideas, from safe-but-smart to chaotic-good. Return ONLY valid JSON, start with { end with }.
{
  "campaign_ideas": [
    {
      "idea_title": "campaign name",
      "tagline": "one punchy line",
      "big_idea": "3-4 sentence creative concept",
      "cultural_hook": "why this connects culturally right now",
      "platform_execution": "how it runs on ${form.platform_focus}",
      "sample_post": "the actual first post copy, ready to publish",
      "viral_mechanism": "what makes it spread",
      "influencer_strategy": "how influencers fit in",
      "success_metric": "the one KPI that proves this worked",
      "why_it_wins": "the strategic reason this beats the competition",
      "hashtag_breakdown": [
        { "tag": "#example", "explanation": "why this tag", "when_to_post": "timing guidance" }
      ]
    }
  ]
}`

        data = await generateWithFallback(prompt, null, {
          groq: { temperature: 1.0, maxOutputTokens: 1600 },
        })
      }

      // ── Step 3: Domain-specific fallback ─────────────────────────────────
      if (!data) {
        data = campaignIdeationFallback(form)
      }

      setResult(data)
    } catch (err) {
      setError(err.message || 'Generation failed. Please try again.')
    }
    setLoading(false)
  }

  async function handleSave() {
    if (!result) return
    setSaving(true); setSaveMsg('')
    const campaignName = form.brand_name

    let saveErr
    if (sharedCampaignId) {
      const res = await saveCampaignOutputToShared(
        sharedCampaignId, 'ideation',
        { ...result, brand_name: form.brand_name, season_or_event: form.season_or_event },
      )
      saveErr = res.error
    } else {
      const res = await saveCampaignOutput(
        campaignName, 'ideation',
        { ...result, brand_name: form.brand_name, season_or_event: form.season_or_event },
        { platforms: [form.platform_focus], tone: form.tone }
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

  const IDEA_ACCENTS = [
    { bg: '#EBF0FF', accent: '#3B6BF5', border: '#BFDBFE', badge: '#3B6BF5', label: 'Safe but Smart' },
    { bg: '#F0FDF4', accent: '#16A34A', border: '#BBF7D0', badge: '#16A34A', label: 'Crowd-Pleaser' },
    { bg: '#FFF7ED', accent: '#EA580C', border: '#FED7AA', badge: '#EA580C', label: 'Bold Move' },
    { bg: '#FDF4FF', accent: '#9333EA', border: '#E9D5FF', badge: '#9333EA', label: 'Brand-Defining' },
    { bg: '#FFF1F2', accent: '#BE123C', border: '#FECDD3', badge: '#BE123C', label: '🔥 High Risk / High Reward' },
  ]

  return (
    <div className={styles.panel}>
      <div className={styles.hdr}>
        <div>
          <div className={styles.title}>Campaign Ideation</div>
          <div className={styles.sub}>5 distinct campaign concepts — Cannes-level creative thinking via Groq</div>
        </div>
        <button className={styles.closeBtn} onClick={onClose}>✕</button>
      </div>

      {!result && (
        <>
          <FillFromBriefButton
            onFill={handleFillFromBrief}
            onFillBrand={handleFillFromBrand}
            onNoBrief={onNoBrief}
          />

          <div className={styles.fields}>
            <Field label="Brand Name *"        placeholder="e.g. Zomato, Nykaa"                             value={form.brand_name}         onChange={v => set('brand_name', v)} />
            <Field label="Product / Service *" placeholder="e.g. Food Delivery App"                         value={form.product_or_service} onChange={v => set('product_or_service', v)} />
            <Field label="Campaign Goal *"     placeholder="e.g. Dominate Diwali season orders"             value={form.campaign_goal}      onChange={v => set('campaign_goal', v)} />
            <Field label="Target Audience *"   placeholder="e.g. Millennials in metro cities"               value={form.target_audience}    onChange={v => set('target_audience', v)} />
            <Field label="Season / Event *"    placeholder="e.g. Diwali 2025, IPL Season, Valentine's Day"  value={form.season_or_event}    onChange={v => set('season_or_event', v)} />
            <Select label="Tone"           options={TONES}     value={form.tone}           onChange={v => set('tone', v)} />
            <Select label="Platform Focus" options={PLATFORMS} value={form.platform_focus} onChange={v => set('platform_focus', v)} />
          </div>
          {error && <div className={styles.error}>{error}</div>}
          <div className={styles.actions}>
            <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
            <button className={styles.genBtn} onClick={generate} disabled={loading}>
              {loading ? <><Spinner /> Generating Ideas…</> : <><LightbulbIcon /> Generate 5 Campaign Concepts</>}
            </button>
          </div>
        </>
      )}

      {result && (
        <div className={styles.result}>
          <div className={styles.resultHdr}>
            <span className={styles.resultTitle}>5 Campaign Concepts</span>
            <span className={styles.resultSub}>for {form.brand_name} · {form.season_or_event} · {form.platform_focus}</span>
          </div>

          <div className={styles.ideaList}>
            {(result.campaign_ideas || []).map((idea, i) => {
              const c = IDEA_ACCENTS[i % IDEA_ACCENTS.length]
              return (
                <div
                  key={i}
                  className={styles.ideaCard}
                  style={{ '--card-bg': c.bg, '--card-accent': c.accent, '--card-border': c.border }}
                >
                  <div className={styles.ideaHeaderRow}>
                    <div className={styles.ideaNum} style={{ background: c.bg, color: c.accent, border: `1.5px solid ${c.border}` }}>
                      #{i + 1}
                    </div>
                    <div className={styles.ideaHeaderMid}>
                      <div className={styles.ideaTitleText}>{idea.idea_title}</div>
                      <div className={styles.ideaRiskBadge} style={{ background: c.bg, color: c.accent }}>{c.label}</div>
                    </div>
                  </div>

                  <div className={styles.ideaTagline} style={{ color: c.accent }}>"{idea.tagline}"</div>

                  {(idea.big_idea || idea.cultural_hook || idea.platform_execution || idea.sample_post || idea.viral_mechanism || idea.influencer_strategy || idea.success_metric || idea.why_it_wins || (Array.isArray(idea.hashtag_breakdown) && idea.hashtag_breakdown.length > 0)) && (
                    <div className={styles.ideaBody}>
                      <Section label="The Big Idea" text={idea.big_idea} accent={c.accent} bg={c.bg} />
                      <Section label="Cultural Hook 🎯" text={idea.cultural_hook} accent={c.accent} bg={c.bg} />
                      <Section label={`${form.platform_focus} Execution`} text={idea.platform_execution} accent={c.accent} bg={c.bg} />

                      {idea.sample_post && (
                        <div className={styles.samplePostBlock} style={{ borderColor: c.border }}>
                          <div className={styles.sectionLabelText}>📱 Launch Post — Ready to Publish</div>
                          <div className={styles.samplePostText}>{idea.sample_post}</div>
                        </div>
                      )}

                      <div className={styles.twoCol}>
                        <Section label="⚡ Viral Mechanism" text={idea.viral_mechanism} accent={c.accent} bg={c.bg} />
                        <Section label="🤝 Influencer Strategy" text={idea.influencer_strategy} accent={c.accent} bg={c.bg} />
                      </div>

                      <div className={styles.metaRow}>
                        {idea.success_metric && (
                          <div className={styles.metaPill} style={{ background: c.bg, color: c.accent, borderColor: c.border }}>
                            📊 {idea.success_metric}
                          </div>
                        )}
                        {idea.why_it_wins && (
                          <div className={styles.winPill}>
                            🏆 {idea.why_it_wins}
                          </div>
                        )}
                      </div>

                      {Array.isArray(idea.hashtag_breakdown) && idea.hashtag_breakdown.length > 0 && (
                        <div className={styles.hashBreakdownBlock} style={{ borderColor: c.border }}>
                          <div className={styles.sectionLabelText}>🏷️ Hashtag Breakdown</div>
                          <div className={styles.hashBreakdownList}>
                            {idea.hashtag_breakdown.map((h, li) => (
                              <div key={li} className={styles.hashBreakdownItem}>
                                <div className={styles.hashBreakdownRow}>
                                  <span className={styles.hashTag} style={{ background: c.bg, color: c.accent, border: `1px solid ${c.border}` }}>{h.tag}</span>
                                  <span className={styles.hashBreakdownDesc}>{h.explanation}</span>
                                </div>
                                {h.when_to_post && (
                                  <div className={styles.whenToPost} style={{ borderLeftColor: c.accent }}>
                                    <span className={styles.whenToPostLabel}>🗓️ When &amp; How to Post</span>
                                    <span className={styles.whenToPostText}>{h.when_to_post}</span>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

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

function Section({ label, text, accent, bg }) {
  if (!text) return null
  return (
    <div className={styles.ideaSection} style={{ borderLeftColor: accent }}>
      <div className={styles.sectionLabelText}>{label}</div>
      <div className={styles.sectionBodyText}>{text}</div>
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
function LightbulbIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  )
}
