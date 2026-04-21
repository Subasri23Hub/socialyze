import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { saveCampaignBrief, fetchCampaignBrief } from '../lib/campaignService'
import styles from './CampaignBriefPage.module.css'

const TONES = ['Casual', 'Professional', 'Inspirational', 'Humorous', 'Urgent', 'Playful', 'Bold', 'Empathetic']
const ALL_PLATFORMS = ['Instagram', 'Twitter', 'LinkedIn', 'Facebook', 'TikTok', 'YouTube']

const EMPTY_FORM = {
  brand_name:      '',
  product_service: '',
  campaign_goal:   '',
  target_audience: '',
  tone:            'Inspirational',
  platforms:       [],
}

export default function CampaignBriefPage({ onGoToServices }) {
  const [form,    setForm]    = useState(EMPTY_FORM)
  const [saving,  setSaving]  = useState(false)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')
  const [popup,   setPopup]   = useState(false)
  const [hasBrief, setHasBrief] = useState(false)

  // ── Load existing brief + brands ──────────────────────────────────
  useEffect(() => {
    let didLoad = false

    async function load() {
      didLoad = true
      setLoading(true)

      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user

      // Load campaign brief
      const { brief } = await fetchCampaignBrief()
      if (brief) {
        setForm({
          brand_name:      brief.brand_name      || '',
          product_service: brief.product_service || '',
          campaign_goal:   brief.campaign_goal   || '',
          target_audience: brief.target_audience || '',
          tone:            brief.tone            || 'Inspirational',
          platforms:       brief.platforms       || [],
        })
        setHasBrief(true)
      }

      setLoading(false)
    }

    load()

    const { data: { subscription } } = supabase
      ? supabase.auth.onAuthStateChange((_event, _session) => {
          if (!didLoad) load()
        })
      : { data: { subscription: { unsubscribe: () => {} } } }

    return () => subscription.unsubscribe()
  }, [])

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  function togglePlatform(p) {
    setForm(f => ({
      ...f,
      platforms: f.platforms.includes(p)
        ? f.platforms.filter(x => x !== p)
        : [...f.platforms, p],
    }))
  }

  async function handleSave() {
    if (!form.brand_name.trim())      { setError('Brand Name is required.'); return }
    if (!form.product_service.trim()) { setError('Product / Service is required.'); return }
    if (!form.campaign_goal.trim())   { setError('Campaign Goal is required.'); return }
    if (!form.target_audience.trim()) { setError('Target Audience is required.'); return }

    setError('')
    setSaving(true)
    const { error: saveErr } = await saveCampaignBrief(form)
    setSaving(false)

    if (saveErr) {
      setError(saveErr)
    } else {
      setHasBrief(true)
      setPopup(true)
    }
  }

  if (loading) {
    return (
      <div className={styles.center}>
        <div className={styles.spinner} />
        <span>Loading brief…</span>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      {/* ── Page Header ── */}
      <div className={styles.pageHdr}>
        <div className={styles.pageHdrLeft}>
          <div className={styles.iconWrap}>
            <BookIcon />
          </div>
          <div>
            <h2 className={styles.pageTitle}>Campaign Brief</h2>
            <p className={styles.pageSub}>
              {hasBrief
                ? 'Your default campaign brief is saved. Edit and re-save anytime.'
                : 'Set up default campaign inputs — use them to pre-fill any service form.'}
            </p>
          </div>
        </div>
        {hasBrief && (
          <span className={styles.savedBadge}>
            <CheckIcon /> Brief Saved
          </span>
        )}
      </div>

      {/* ── Info banner ── */}
      <div className={styles.infoBanner}>
        <InfoIcon />
        <span>
          Campaign Brief is <strong>optional</strong>. You can use any service without filling this.
          When saved, click <strong>"Fill from Campaign Brief"</strong> inside any service to pre-fill its fields instantly.
        </span>
      </div>

      {/* ── Form card ── */}
      <div className={styles.card}>
        <div className={styles.cardTitleRow}>
          <div className={styles.cardTitle}>Campaign Details</div>
        </div>

        <div className={styles.fields}>
          {/* Row 1 */}
          <div className={styles.fieldGroup}>
            <label className={styles.label}>Brand / Company Name <span className={styles.req}>*</span></label>
            <input
              className={styles.input}
              type="text"
              placeholder="e.g. Nike, Zomato, Sourcesys"
              value={form.brand_name}
              onChange={e => set('brand_name', e.target.value)}
            />
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>Product / Service <span className={styles.req}>*</span></label>
            <input
              className={styles.input}
              type="text"
              placeholder="e.g. Running Shoes, Food Delivery App"
              value={form.product_service}
              onChange={e => set('product_service', e.target.value)}
            />
          </div>

          {/* Row 2 */}
          <div className={styles.fieldGroup}>
            <label className={styles.label}>Campaign Goal <span className={styles.req}>*</span></label>
            <input
              className={styles.input}
              type="text"
              placeholder="e.g. Drive app installs, Build brand awareness"
              value={form.campaign_goal}
              onChange={e => set('campaign_goal', e.target.value)}
            />
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>Target Audience <span className={styles.req}>*</span></label>
            <input
              className={styles.input}
              type="text"
              placeholder="e.g. Millennials in metro cities, IT Decision Makers"
              value={form.target_audience}
              onChange={e => set('target_audience', e.target.value)}
            />
          </div>

          {/* Row 3 — Tone full-width */}
          <div className={`${styles.fieldGroup} ${styles.fullWidth}`}>
            <label className={styles.label}>Default Tone</label>
            <div className={styles.toneGrid}>
              {TONES.map(t => (
                <button
                  key={t}
                  type="button"
                  className={`${styles.toneBtn} ${form.tone === t ? styles.toneSel : ''}`}
                  onClick={() => set('tone', t)}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Row 4 — Platforms full-width */}
          <div className={`${styles.fieldGroup} ${styles.fullWidth}`}>
            <label className={styles.label}>Platforms <span className={styles.optional}>(optional)</span></label>
            <div className={styles.platGrid}>
              {ALL_PLATFORMS.map(p => (
                <button
                  key={p}
                  type="button"
                  className={`${styles.platBtn} ${form.platforms.includes(p) ? styles.platSel : ''}`}
                  onClick={() => togglePlatform(p)}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>

        {error && <div className={styles.errorMsg}>{error}</div>}

        <div className={styles.actions}>
          <button
            className={styles.saveBtn}
            onClick={handleSave}
            disabled={saving}
          >
            {saving
              ? <><span className={styles.spinner} />Saving…</>
              : <><SaveIcon />{hasBrief ? 'Update Brief' : 'Save Brief'}</>
            }
          </button>
        </div>
      </div>

      {/* ── Success popup ── */}
      {popup && (
        <div className={styles.overlay} onClick={() => setPopup(false)}>
          <div className={styles.popup} onClick={e => e.stopPropagation()}>
            <div className={styles.popupIcon}>
              <SuccessIcon />
            </div>
            <div className={styles.popupTitle}>Campaign Brief Saved!</div>
            <div className={styles.popupMsg}>
              Your brief has been saved successfully. You can now click
              <strong> "Fill from Campaign Brief"</strong> inside any service
              to auto-populate its fields.
            </div>
            <div className={styles.popupActions}>
              <button
                className={styles.popupSecondary}
                onClick={() => setPopup(false)}
              >
                Stay Here
              </button>
              <button
                className={styles.popupPrimary}
                onClick={() => { setPopup(false); onGoToServices && onGoToServices() }}
              >
                Go to Services →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function brandInitials(name = '') {
  const words = name.trim().split(/\s+/)
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

// ─────────────────────────────────────────────────────────────
// Icons
// ─────────────────────────────────────────────────────────────
function BookIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3B6BF5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 016.5 17H20"/>
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/>
    </svg>
  )
}
function SaveIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/>
      <polyline points="17 21 17 13 7 13 7 21"/>
      <polyline points="7 3 7 8 15 8"/>
    </svg>
  )
}
function InfoIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#3B6BF5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="8" x2="12" y2="12"/>
      <line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  )
}
function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  )
}
function SuccessIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <polyline points="9 12 11 14 15 10"/>
    </svg>
  )
}
