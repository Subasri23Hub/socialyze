import { useState } from 'react'
import styles from './AudienceTargetingPanel.module.css'
import { saveCampaignOutput, saveCampaignOutputToShared } from '../lib/campaignService'
import FillFromBriefButton from './FillFromBriefButton.jsx'
import { generateWithFallback } from '../lib/generateWithFallback'
import { audienceTargetingFallback } from '../lib/fallbackService'

const AGE_GROUPS     = ['13–17', '18–24', '25–34', '35–44', '45–54', '55–64', '65+', 'All Ages']
const CUSTOMER_TYPES = ['B2C', 'B2B', 'D2C', 'B2B2C', 'Non-Profit']
const INDUSTRIES     = ['E-Commerce', 'EdTech', 'FinTech', 'HealthTech', 'FMCG', 'Fashion', 'Food & Beverage', 'SaaS', 'Real Estate', 'Travel', 'Automotive', 'Entertainment', 'Other']

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

export default function AudienceTargetingPanel({ onClose, onSaved, onNoBrief, sharedCampaignId, prefillBrand }) {
  const [form, setForm] = useState({
    brand_name: prefillBrand || '', product_or_service: '', campaign_objective: '',
    industry: 'E-Commerce', age_group: '25–34',
    region: '', customer_type: 'B2C', pain_points: '',
  })
  const [loading, setLoading] = useState(false)
  const [result,  setResult]  = useState(null)
  const [error,   setError]   = useState('')
  const [saving,  setSaving]  = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  function handleFillFromBrief(brief) {
    setForm(f => ({
      ...f,
      brand_name:         brief.brand_name      || f.brand_name,
      product_or_service: brief.product_service || f.product_or_service,
      campaign_objective: brief.campaign_goal   || f.campaign_objective,
    }))
  }

  function handleFillFromBrand(brand) {
    setForm(f => ({
      ...f,
      brand_name:         brand.name     || f.brand_name,
      product_or_service: brand.industry || f.product_or_service,
    }))
  }

  async function generate() {
    const required = ['brand_name', 'product_or_service', 'campaign_objective', 'region', 'pain_points']
    const empty = required.filter(k => !form[k].trim())
    if (empty.length) { setError('Please fill in all required fields.'); return }
    setError(''); setLoading(true); setResult(null); setSaveMsg('')

    try {
      let data = null

      // ── Step 1: Try backend (Groq) ──────────────────────────────────────
      try {
        const res = await fetch('http://localhost:3000/audience-targeting', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(form),
        })
        if (res.ok) {
          const raw = await res.json()
          // Backend returns new schema (description/motivations/pain_points/behavior/content_preferences/buying_trigger)
          // Normalise to the UI schema (identity_label/behavior/mindset/pain_point/hook/best_content_style/best_platform)
          if (raw?.personas?.length) {
            raw.personas = raw.personas.map(p => ({
              ...p,
              identity_label:     p.identity_label     || p.persona_name || '',
              behavior:           p.behavior           || p.description  || '',
              mindset:            p.mindset            || (Array.isArray(p.motivations) ? p.motivations.join(' ') : '') || '',
              pain_point:         p.pain_point         || (Array.isArray(p.pain_points) ? p.pain_points[0] : '') || '',
              hook:               p.hook               || p.buying_trigger || '',
              best_content_style: p.best_content_style || (Array.isArray(p.content_preferences) ? p.content_preferences[0] : '') || '',
              best_platform:      p.best_platform      || '',
            }))
          }
          data = raw
        }
      } catch (_) { /* backend unavailable — try Groq direct */ }

      // ── Step 2: Try Groq direct from browser ──────────────────────────────
      if (!data) {
        const prompt = `You are a senior marketing strategist and audience research expert.
Generate 3 HIGH-QUALITY audience personas. Return ONLY valid JSON.

INPUT:
Brand: ${form.brand_name}
Product/Service: ${form.product_or_service}
Campaign Objective: ${form.campaign_objective}
Region: ${form.region}
Industry: ${form.industry}
Age Group: ${form.age_group}
Customer Type: ${form.customer_type}
Pain Points: ${form.pain_points}

Generate EXACTLY 3 personas. Return ONLY valid JSON, start with { end with }.
{
  "personas": [
    {
      "persona_name": "Persona 1 — [Short Identity Label]",
      "identity_label": "short archetype label",
      "behavior": "how they behave online and in daily life",
      "mindset": "what drives and worries them",
      "pain_point": "their core frustration specific to this product",
      "hook": "the one message that makes them stop scrolling",
      "best_content_style": "exact content formats they respond to",
      "best_platform": "primary platform with reasoning"
    }
  ],
  "audience_overlap_matrix": "insight about how these 3 personas overlap",
  "channel_priority": [
    { "platform": "Instagram", "priority": "Must-Have", "rationale": "why" }
  ],
  "cultural_moments": ["moment 1", "moment 2", "moment 3"]
}`

        data = await generateWithFallback(prompt, null, {
          groq: { temperature: 1.0, maxOutputTokens: 1400 },
        })
      }

      // ── Step 3: Domain-specific fallback ─────────────────────────────────
      if (!data) {
        data = audienceTargetingFallback(form)
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
    const recommendedPlatforms = [...new Set(
      (result.personas || [])
        .map(p => (p.best_platform || '').split(/[\s,/(]+/)[0].trim())
        .filter(Boolean)
    )]

    let saveErr
    if (sharedCampaignId) {
      const res = await saveCampaignOutputToShared(
        sharedCampaignId, 'audience',
        { ...result, brand_name: form.brand_name, product_or_service: form.product_or_service },
      )
      saveErr = res.error
    } else {
      const res = await saveCampaignOutput(
        campaignName, 'audience',
        { ...result, brand_name: form.brand_name, product_or_service: form.product_or_service },
        { platforms: recommendedPlatforms }
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

  const PLATFORM_COLORS = {
    instagram: { bg: '#FDF2F8', color: '#9D174D' },
    linkedin:  { bg: '#EFF9FF', color: '#0369A1' },
    youtube:   { bg: '#FEF2F2', color: '#991B1B' },
    twitter:   { bg: '#EFF6FF', color: '#1D4ED8' },
    facebook:  { bg: '#EFF6FF', color: '#1E40AF' },
    tiktok:    { bg: '#F5F3FF', color: '#6D28D9' },
    whatsapp:  { bg: '#F0FDF4', color: '#15803D' },
  }
  function platStyle(str) {
    const key = (str || '').split(/[\s—–,(]/)[0].toLowerCase()
    return PLATFORM_COLORS[key] || { bg: '#F1F5F9', color: '#475569' }
  }

  const PRIORITY_COLORS = {
    'Must-Have': { bg: '#DCFCE7', color: '#15803D' },
    'High':      { bg: '#DBEAFE', color: '#1D4ED8' },
    'Medium':    { bg: '#FEF9C3', color: '#A16207' },
    'Low':       { bg: '#F1F5F9', color: '#475569' },
  }

  const PERSONA_ACCENTS = [
    { border: '#3B6BF5', bg: '#EBF0FF' },
    { border: '#16A34A', bg: '#F0FDF4' },
    { border: '#EA580C', bg: '#FFF7ED' },
  ]

  return (
    <div className={styles.panel}>
      <div className={styles.hdr}>
        <div>
          <div className={styles.title}>Audience Targeting</div>
          <div className={styles.sub}>3 high-impact personas — practical, modern, scroll-ready</div>
        </div>
        <button className={styles.closeBtn} onClick={onClose}>✕</button>
      </div>

      {!result && (
        <>
          <FillFromBriefButton onFill={handleFillFromBrief} onFillBrand={handleFillFromBrand} onNoBrief={onNoBrief} />
          <div className={styles.fields}>
            <Field label="Brand Name *"         placeholder="e.g. Nike, Swiggy"                                          value={form.brand_name}         onChange={v => set('brand_name', v)} />
            <Field label="Product / Service *"  placeholder="e.g. Running Shoes"                                         value={form.product_or_service} onChange={v => set('product_or_service', v)} />
            <Field label="Campaign Objective *" placeholder="e.g. Drive 10K app installs in 30 days"                     value={form.campaign_objective} onChange={v => set('campaign_objective', v)} />
            <Field label="Region / Geography *" placeholder="e.g. South India, Mumbai, Tier-2 cities"                    value={form.region}             onChange={v => set('region', v)} />
            <Field label="Pain Points *"        placeholder="e.g. Users find checkout slow, trust issues with new brands" value={form.pain_points} className={styles.wide} onChange={v => set('pain_points', v)} />
            <Select label="Industry"      options={INDUSTRIES}     value={form.industry}      onChange={v => set('industry', v)} />
            <Select label="Age Group"     options={AGE_GROUPS}     value={form.age_group}     onChange={v => set('age_group', v)} />
            <Select label="Customer Type" options={CUSTOMER_TYPES} value={form.customer_type} onChange={v => set('customer_type', v)} />
          </div>
          {error && <div className={styles.error}>{error}</div>}
          <div className={styles.actions}>
            <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
            <button className={styles.genBtn} onClick={generate} disabled={loading}>
              {loading ? <><Spinner /> Building Personas…</> : <><UsersIcon /> Generate Audience Strategy</>}
            </button>
          </div>
        </>
      )}

      {result && (
        <div className={styles.result}>
          <div className={styles.resultHdr}>
            <span className={styles.resultTitle}>Audience Strategy</span>
            <span className={styles.resultSub}>for {form.brand_name} · {form.product_or_service}</span>
          </div>

          <div className={styles.personaGrid}>
            {(result.personas || []).map((p, i) => {
              const ps  = platStyle(p.best_platform)
              const acc = PERSONA_ACCENTS[i % PERSONA_ACCENTS.length]
              return (
                <div key={i} className={styles.personaCard} style={{ borderTopColor: acc.border }}>
                  <div className={styles.personaHdr}>
                    <div className={styles.personaAvatar} style={{ background: acc.bg, color: acc.border }}>
                      {(p.identity_label || p.persona_name || 'P').replace(/^(Persona\s*\d+\s*[—–-]?\s*|The\s+)/i, '').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className={styles.personaName}>{p.persona_name}</div>
                      {p.identity_label && p.identity_label !== p.persona_name && (
                        <div className={styles.archetype} style={{ color: acc.border }}>{p.identity_label}</div>
                      )}
                    </div>
                  </div>

                  {p.behavior && (
                    <div className={styles.infoBlock}>
                      <div className={styles.infoLabel}>📲 BEHAVIOR</div>
                      <div className={styles.infoValue}>{p.behavior}</div>
                    </div>
                  )}

                  {p.mindset && (
                    <div className={styles.psychoBlock}>
                      <div className={styles.blockLabel}>🧠 MINDSET</div>
                      <div className={styles.blockText}>{p.mindset}</div>
                    </div>
                  )}

                  {p.pain_point && (
                    <div className={styles.objectionBlock}>
                      <div className={styles.infoLabel}>😤 PAIN POINT</div>
                      <div className={styles.infoValue}>{p.pain_point}</div>
                    </div>
                  )}

                  {p.hook && (
                    <div className={styles.messagingBlock} style={{ borderColor: acc.border, background: acc.bg }}>
                      <div className={styles.infoLabel}>👉 HOOK THAT WORKS</div>
                      <div className={styles.messagingText} style={{ color: acc.border }}>"{p.hook}"</div>
                    </div>
                  )}

                  {p.best_content_style && (
                    <div className={styles.infoBlock}>
                      <div className={styles.infoLabel}>🎬 BEST CONTENT STYLE</div>
                      <div className={styles.infoValue}>{p.best_content_style}</div>
                    </div>
                  )}

                  {p.best_platform && (
                    <div className={styles.infoBlock}>
                      <div className={styles.infoLabel}>👉 BEST PLATFORM</div>
                      <span className={styles.platBadge} style={{ background: ps.bg, color: ps.color }}>
                        {p.best_platform}
                      </span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {result.audience_overlap_matrix && (
            <div className={styles.overlapCard}>
              <div className={styles.sectionTitle}>Audience Overlap Insight</div>
              <div className={styles.overlapText}>{result.audience_overlap_matrix}</div>
            </div>
          )}

          {(result.channel_priority || []).length > 0 && (
            <div className={styles.channelSection}>
              <div className={styles.sectionTitle}>Channel Priority Ranking</div>
              <div className={styles.channelGrid}>
                {result.channel_priority.map((ch, i) => {
                  const pStyle   = platStyle(ch.platform)
                  const priStyle = PRIORITY_COLORS[ch.priority] || { bg: '#F1F5F9', color: '#475569' }
                  return (
                    <div key={i} className={styles.channelCard}>
                      <div className={styles.channelTop}>
                        <span className={styles.channelName} style={{ background: pStyle.bg, color: pStyle.color }}>{ch.platform}</span>
                        <span className={styles.channelPri} style={{ background: priStyle.bg, color: priStyle.color }}>{ch.priority}</span>
                      </div>
                      <div className={styles.channelRationale}>{ch.rationale}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {(result.cultural_moments || []).length > 0 && (
            <div className={styles.culturalSection}>
              <div className={styles.sectionTitle}>Cultural Moments to Tap</div>
              {result.cultural_moments.map((m, i) => (
                <div key={i} className={styles.culturalCard}>🎯 {m}</div>
              ))}
            </div>
          )}

          {saveMsg && (
            <div className={saveMsg.startsWith('✓') ? styles.saveSuccess : styles.saveError}>{saveMsg}</div>
          )}

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

function Field({ label, placeholder, value, onChange, className }) {
  return (
    <div className={className}>
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
function UsersIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" />
    </svg>
  )
}
