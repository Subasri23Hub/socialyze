/**
 * BrandsPage.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * AI Social Media Campaign Generator | Sourcesys Technologies
 *
 * Brand & Client Management — create, view, edit, delete brand profiles.
 * Each brand stores: name, industry, tone, platforms, website, notes, color.
 * Data is persisted in Supabase `brands` table (per user, RLS-protected).
 * Falls back gracefully to localStorage if Supabase table doesn't exist yet.
 */

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabaseClient'
import styles from './BrandsPage.module.css'

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────
const INDUSTRIES = [
  'E-Commerce', 'Fashion & Apparel', 'Food & Beverage', 'Health & Wellness',
  'Technology', 'Finance & Fintech', 'Real Estate', 'Education', 'Travel & Hospitality',
  'Entertainment & Media', 'Beauty & Personal Care', 'Automotive', 'Non-Profit',
  'Professional Services', 'Sports & Fitness', 'Other',
]

const TONES = [
  'Professional', 'Casual & Friendly', 'Inspirational', 'Witty & Humorous',
  'Bold & Edgy', 'Luxury & Sophisticated', 'Educational', 'Empathetic',
]

const ALL_PLATFORMS = [
  'Instagram', 'Twitter / X', 'LinkedIn', 'Facebook',
  'TikTok', 'YouTube', 'Pinterest', 'Threads',
]

const BRAND_COLORS = [
  '#3B6BF5', '#16A34A', '#EA580C', '#9333EA',
  '#BE123C', '#0369A1', '#D97706', '#0F766E',
]

const EMPTY_FORM = {
  name: '', industry: '', tone: '', platforms: [],
  website: '', notes: '', color: BRAND_COLORS[0],
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function brandInitials(name = '') {
  const words = name.trim().split(/\s+/)
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

function lighten(hex) {
  // Returns a very light tint of the brand color for card backgrounds
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},0.08)`
}

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ─────────────────────────────────────────────────────────────
// Local-storage fallback (used if Supabase table not yet created)
// ─────────────────────────────────────────────────────────────
const LS_KEY = (uid) => `brands_${uid}`

function lsLoad(uid)          { try { return JSON.parse(localStorage.getItem(LS_KEY(uid)) || '[]') } catch { return [] } }
function lsSave(uid, brands)  { localStorage.setItem(LS_KEY(uid), JSON.stringify(brands)) }

// ─────────────────────────────────────────────────────────────
// Supabase CRUD (with LS fallback)
// ─────────────────────────────────────────────────────────────
async function dbFetch(uid) {
  const { data, error } = await supabase
    .from('brands')
    .select('*')
    .eq('user_id', uid)
    .order('created_at', { ascending: false })
  if (error) return { data: lsLoad(uid), fromLS: true }
  return { data: data || [], fromLS: false }
}

async function dbInsert(uid, form) {
  const record = {
    user_id:   uid,
    name:      form.name.trim(),
    industry:  form.industry,
    tone:      form.tone,
    platforms: form.platforms,
    website:   form.website.trim(),
    notes:     form.notes.trim(),
    color:     form.color,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
  const { data, error } = await supabase.from('brands').insert(record).select().single()
  if (error) {
    // LS fallback
    const brands = lsLoad(uid)
    const ls = { ...record, id: `ls_${Date.now()}` }
    lsSave(uid, [ls, ...brands])
    return { data: ls, error: null }
  }
  return { data, error: null }
}

async function dbUpdate(uid, id, form) {
  const patch = {
    name:      form.name.trim(),
    industry:  form.industry,
    tone:      form.tone,
    platforms: form.platforms,
    website:   form.website.trim(),
    notes:     form.notes.trim(),
    color:     form.color,
    updated_at: new Date().toISOString(),
  }
  if (String(id).startsWith('ls_')) {
    const brands = lsLoad(uid).map(b => b.id === id ? { ...b, ...patch } : b)
    lsSave(uid, brands)
    return { error: null }
  }
  const { error } = await supabase.from('brands').update(patch).eq('id', id).eq('user_id', uid)
  return { error: error ? error.message : null }
}

async function dbDelete(uid, id) {
  if (String(id).startsWith('ls_')) {
    lsSave(uid, lsLoad(uid).filter(b => b.id !== id))
    return { error: null }
  }
  const { error } = await supabase.from('brands').delete().eq('id', id).eq('user_id', uid)
  return { error: error ? error.message : null }
}

// ─────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────
export default function BrandsPage() {
  const [userId,    setUserId]    = useState(null)
  const [brands,    setBrands]    = useState([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState('')

  // Modal state
  const [modal,     setModal]     = useState(null)   // null | 'add' | 'edit' | 'view'
  const [editing,   setEditing]   = useState(null)   // brand being edited/viewed
  const [form,      setForm]      = useState(EMPTY_FORM)
  const [formErr,   setFormErr]   = useState('')
  const [saving,    setSaving]    = useState(false)

  // Delete confirm
  const [confirmDel, setConfirmDel] = useState(null)
  const [deleting,   setDeleting]   = useState(false)

  // ── Bootstrap ────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true); setError('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Not authenticated'); setLoading(false); return }
    setUserId(user.id)
    const { data } = await dbFetch(user.id)
    setBrands(data)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // ── Form helpers ─────────────────────────────────────────────
  function openAdd() {
    setForm(EMPTY_FORM); setFormErr(''); setEditing(null); setModal('add')
  }
  function openEdit(brand) {
    setForm({
      name:      brand.name      || '',
      industry:  brand.industry  || '',
      tone:      brand.tone      || '',
      platforms: brand.platforms || [],
      website:   brand.website   || '',
      notes:     brand.notes     || '',
      color:     brand.color     || BRAND_COLORS[0],
    })
    setFormErr(''); setEditing(brand); setModal('edit')
  }
  function openView(brand) { setEditing(brand); setModal('view') }
  function closeModal()    { setModal(null); setEditing(null) }

  function setField(k, v) { setForm(f => ({ ...f, [k]: v })); setFormErr('') }

  function togglePlatform(p) {
    setForm(f => ({
      ...f,
      platforms: f.platforms.includes(p)
        ? f.platforms.filter(x => x !== p)
        : [...f.platforms, p],
    }))
  }

  // ── Submit (add / edit) ──────────────────────────────────────
  async function handleSubmit() {
    if (!form.name.trim())     { setFormErr('Brand name is required.'); return }
    if (!form.industry)        { setFormErr('Please select an industry.'); return }
    setSaving(true)

    if (modal === 'add') {
      const { error: err } = await dbInsert(userId, form)
      if (err) { setFormErr(err); setSaving(false); return }
    } else {
      const { error: err } = await dbUpdate(userId, editing.id, form)
      if (err) { setFormErr(err); setSaving(false); return }
    }

    setSaving(false)
    closeModal()
    load()
  }

  // ── Delete ───────────────────────────────────────────────────
  async function handleDelete() {
    setDeleting(true)
    await dbDelete(userId, confirmDel.id)
    setDeleting(false)
    setConfirmDel(null)
    load()
  }

  // ─────────────────────────────────────────────────────────────
  return (
    <div className={styles.page}>

      {/* Header */}
      <div className={styles.pageHdr}>
        <div>
          <h2 className={styles.pageTitle}>Brand &amp; Client Hub</h2>
          <p className={styles.pageSub}>Manage all your brand profiles. Each brand pre-fills your campaign brief automatically.</p>
        </div>
        <button className={styles.addBtn} onClick={openAdd}>
          <PlusIcon /> New Brand
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className={styles.loadState}>
          <div className={styles.spinner} />
          <span>Loading brands…</span>
        </div>
      )}

      {/* Error */}
      {error && <div className={styles.errorBar}>⚠ {error}</div>}

      {/* Empty state */}
      {!loading && !error && brands.length === 0 && (
        <div className={styles.emptyState}>
          <div className={styles.emptyIllustration}>
            <BriefcaseIcon size={40} />
          </div>
          <div className={styles.emptyTitle}>No brands yet</div>
          <div className={styles.emptyDesc}>
            Add your first brand or client profile. Once saved, it will automatically
            pre-fill your Campaign Brief and all generation panels.
          </div>
          <button className={styles.emptyAction} onClick={openAdd}>
            <PlusIcon /> Add Your First Brand
          </button>
        </div>
      )}

      {/* Brand grid */}
      {!loading && brands.length > 0 && (
        <div className={styles.grid}>
          {brands.map(brand => (
            <BrandCard
              key={brand.id}
              brand={brand}
              onView={openView}
              onEdit={openEdit}
              onDelete={() => setConfirmDel(brand)}
            />
          ))}
        </div>
      )}

      {/* ── Add / Edit Modal ── */}
      {(modal === 'add' || modal === 'edit') && (
        <div className={styles.overlay} onClick={e => { if (e.target === e.currentTarget) closeModal() }}>
          <div className={styles.modal}>
            {/* Modal header */}
            <div className={styles.modalHdr}>
              <div>
                <div className={styles.modalTitle}>
                  {modal === 'add' ? 'Add New Brand' : `Edit — ${editing?.name}`}
                </div>
                <div className={styles.modalSub}>
                  {modal === 'add'
                    ? 'Create a brand profile to power all your AI campaigns'
                    : 'Update this brand\'s profile and settings'}
                </div>
              </div>
              <button className={styles.modalClose} onClick={closeModal}><XIcon /></button>
            </div>

            <div className={styles.modalBody}>
              {/* Left col */}
              <div className={styles.formCol}>

                {/* Brand Name */}
                <Field label="Brand / Client Name" required>
                  <input
                    className={styles.fieldInput}
                    placeholder="e.g. Nike, Artisan Bakery Co."
                    value={form.name}
                    onChange={e => setField('name', e.target.value)}
                    autoFocus
                  />
                </Field>

                {/* Industry */}
                <Field label="Industry" required>
                  <select className={styles.fieldSelect} value={form.industry} onChange={e => setField('industry', e.target.value)}>
                    <option value="">— Select industry —</option>
                    {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
                  </select>
                </Field>

                {/* Tone of Voice */}
                <Field label="Tone of Voice">
                  <select className={styles.fieldSelect} value={form.tone} onChange={e => setField('tone', e.target.value)}>
                    <option value="">— Select tone —</option>
                    {TONES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </Field>

                {/* Website */}
                <Field label="Website / Social Handle">
                  <input
                    className={styles.fieldInput}
                    placeholder="https://brand.com or @handle"
                    value={form.website}
                    onChange={e => setField('website', e.target.value)}
                  />
                </Field>

                {/* Notes */}
                <Field label="Internal Notes">
                  <textarea
                    className={styles.fieldTextarea}
                    placeholder="Key messaging, campaign goals, target market, restrictions…"
                    rows={3}
                    value={form.notes}
                    onChange={e => setField('notes', e.target.value)}
                  />
                </Field>
              </div>

              {/* Right col */}
              <div className={styles.rightCol}>

                {/* Brand Color */}
                <Field label="Brand Colour">
                  <div className={styles.colorRow}>
                    {BRAND_COLORS.map(c => (
                      <button
                        key={c}
                        className={`${styles.colorDot} ${form.color === c ? styles.colorDotActive : ''}`}
                        style={{ background: c }}
                        onClick={() => setField('color', c)}
                        title={c}
                      />
                    ))}
                  </div>
                  {/* Preview */}
                  <div className={styles.colorPreview} style={{ background: lighten(form.color), border: `1.5px solid ${form.color}22` }}>
                    <div className={styles.colorPreviewAvatar} style={{ background: form.color }}>
                      <span style={{ color: '#fff', fontFamily: 'Syne, sans-serif', fontSize: 18, fontWeight: 700 }}>
                        {form.name ? brandInitials(form.name) : 'AB'}
                      </span>
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#0D0F1A' }}>{form.name || 'Brand Name'}</div>
                      <div style={{ fontSize: 11, color: '#9BA3BB', marginTop: 2 }}>{form.industry || 'Industry'}</div>
                    </div>
                  </div>
                </Field>

                {/* Platforms */}
                <Field label="Primary Platforms">
                  <div className={styles.platformGrid}>
                    {ALL_PLATFORMS.map(p => (
                      <button
                        key={p}
                        className={`${styles.platBtn} ${form.platforms.includes(p) ? styles.platBtnActive : ''}`}
                        style={form.platforms.includes(p) ? { borderColor: form.color, color: form.color, background: lighten(form.color) } : {}}
                        onClick={() => togglePlatform(p)}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </Field>

              </div>
            </div>

            {formErr && <div className={styles.formError}>⚠ {formErr}</div>}

            <div className={styles.modalFooter}>
              <button className={styles.cancelBtn} onClick={closeModal} disabled={saving}>Cancel</button>
              <button className={styles.saveBtn} onClick={handleSubmit} disabled={saving}>
                {saving
                  ? <><SpinIcon /> Saving…</>
                  : modal === 'add'
                    ? <><PlusIcon /> Create Brand</>
                    : <><CheckIcon /> Save Changes</>
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── View Modal ── */}
      {modal === 'view' && editing && (
        <div className={styles.overlay} onClick={e => { if (e.target === e.currentTarget) closeModal() }}>
          <div className={styles.viewModal}>
            <div className={styles.viewHdr} style={{ background: lighten(editing.color || BRAND_COLORS[0]) }}>
              <div className={styles.viewAvatar} style={{ background: editing.color || BRAND_COLORS[0] }}>
                {brandInitials(editing.name)}
              </div>
              <div>
                <div className={styles.viewName}>{editing.name}</div>
                <div className={styles.viewIndustry}>{editing.industry}</div>
                {editing.website && (
                  <a className={styles.viewWebsite} href={editing.website.startsWith('http') ? editing.website : `https://${editing.website}`} target="_blank" rel="noreferrer">
                    {editing.website}
                  </a>
                )}
              </div>
              <button className={styles.modalClose} style={{ marginLeft: 'auto' }} onClick={closeModal}><XIcon /></button>
            </div>

            <div className={styles.viewBody}>
              {editing.tone && (
                <ViewRow label="Tone of Voice">
                  <span className={styles.tonePill}>{editing.tone}</span>
                </ViewRow>
              )}
              {(editing.platforms || []).length > 0 && (
                <ViewRow label="Primary Platforms">
                  <div className={styles.viewPlatforms}>
                    {editing.platforms.map(p => (
                      <span key={p} className={styles.viewPlatPill} style={{ borderColor: editing.color + '44', color: editing.color, background: lighten(editing.color) }}>
                        {p}
                      </span>
                    ))}
                  </div>
                </ViewRow>
              )}
              {editing.notes && (
                <ViewRow label="Notes">
                  <p className={styles.viewNotes}>{editing.notes}</p>
                </ViewRow>
              )}
              <ViewRow label="Created">
                <span className={styles.viewMeta}>{formatDate(editing.created_at)}</span>
              </ViewRow>
            </div>

            <div className={styles.modalFooter}>
              <button className={styles.cancelBtn} onClick={closeModal}>Close</button>
              <button className={styles.saveBtn} onClick={() => { closeModal(); openEdit(editing) }}>
                <EditIcon /> Edit Brand
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirm ── */}
      {confirmDel && (
        <div className={styles.overlay} onClick={() => !deleting && setConfirmDel(null)}>
          <div className={styles.confirmModal} onClick={e => e.stopPropagation()}>
            <div className={styles.confirmIcon}>🗑️</div>
            <div className={styles.confirmTitle}>Delete Brand?</div>
            <div className={styles.confirmSub}>
              <strong>{confirmDel.name}</strong> will be permanently removed. This cannot be undone.
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.cancelBtn} onClick={() => setConfirmDel(null)} disabled={deleting}>Cancel</button>
              <button className={styles.deleteBtn} onClick={handleDelete} disabled={deleting}>
                {deleting ? 'Deleting…' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// BrandCard
// ─────────────────────────────────────────────────────────────
function BrandCard({ brand, onView, onEdit, onDelete }) {
  const color = brand.color || BRAND_COLORS[0]
  return (
    <div className={styles.card} style={{ borderTopColor: color }} onClick={() => onView(brand)}>
      <div className={styles.cardTop}>
        <div className={styles.cardAvatar} style={{ background: color }}>
          {brandInitials(brand.name)}
        </div>
        <div className={styles.cardInfo}>
          <div className={styles.cardName}>{brand.name}</div>
          {brand.industry && <div className={styles.cardIndustry}>{brand.industry}</div>}
        </div>
        <div className={styles.cardActions} onClick={e => e.stopPropagation()}>
          <button className={styles.iconBtn} onClick={() => onEdit(brand)} title="Edit"><EditIcon /></button>
          <button className={`${styles.iconBtn} ${styles.iconBtnDanger}`} onClick={() => onDelete(brand)} title="Delete"><TrashIcon /></button>
        </div>
      </div>

      {brand.tone && (
        <div className={styles.cardTone}>
          <span className={styles.tonePill}>{brand.tone}</span>
        </div>
      )}

      {(brand.platforms || []).length > 0 && (
        <div className={styles.cardPlatforms}>
          {brand.platforms.slice(0, 4).map(p => (
            <span key={p} className={styles.cardPlatPill} style={{ color, background: lighten(color), borderColor: color + '33' }}>
              {p}
            </span>
          ))}
          {brand.platforms.length > 4 && (
            <span className={styles.cardPlatPill} style={{ color: '#9BA3BB', background: '#F1F5F9', borderColor: '#E2E8F0' }}>
              +{brand.platforms.length - 4}
            </span>
          )}
        </div>
      )}

      {brand.notes && (
        <p className={styles.cardNotes}>{brand.notes}</p>
      )}

      <div className={styles.cardFooter}>
        <span className={styles.cardDate}><CalIcon /> {formatDate(brand.created_at)}</span>
        <span className={styles.cardViewHint}>View details →</span>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Small helpers
// ─────────────────────────────────────────────────────────────
function Field({ label, required, children }) {
  return (
    <div className={styles.field}>
      <label className={styles.fieldLabel}>
        {label} {required && <span className={styles.req}>*</span>}
      </label>
      {children}
    </div>
  )
}

function ViewRow({ label, children }) {
  return (
    <div className={styles.viewRow}>
      <div className={styles.viewRowLabel}>{label}</div>
      <div className={styles.viewRowVal}>{children}</div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Icons
// ─────────────────────────────────────────────────────────────
function PlusIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
}
function XIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
}
function EditIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
}
function TrashIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
}
function CheckIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
}
function CalIcon() {
  return <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{display:'inline',verticalAlign:'middle',marginRight:3}}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
}
function BriefcaseIcon({ size = 15 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/><line x1="12" y1="12" x2="12" y2="12"/><path d="M2 12h20"/></svg>
}
function SpinIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{animation:'spin 0.7s linear infinite',display:'inline'}}><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg>
}
