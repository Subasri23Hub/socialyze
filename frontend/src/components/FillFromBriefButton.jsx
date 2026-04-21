/**
 * FillSourceSelector  (exported as default, still imported as FillFromBriefButton
 * for zero-change compatibility with all 4 service panels)
 * ─────────────────────────────────────────────────────────────────────────────
 * Shown at the top of every service panel.
 * Gives the user two clear, professional import paths:
 *
 *   1. Import from Campaign Brief   — quick pre-fill from the saved brief
 *   2. Import from Brand & Client Hub — pick a saved brand card by search
 *
 * Props:
 *   onFill(brief)      — called when Campaign Brief is imported
 *   onFillBrand(brand) — called when a Brand Hub card is imported
 *   onNoBrief()        — called when no brief exists (redirect to brief page)
 */
import { useState, useRef, useEffect } from 'react'
import { fetchCampaignBrief } from '../lib/campaignService'
import { supabase } from '../supabaseClient'
import styles from './FillFromBriefButton.module.css'

// ─── helpers ───────────────────────────────────────────────────────────────
const LS_KEY = (uid) => `brands_${uid}`
function lsLoad(uid) {
  try { return JSON.parse(localStorage.getItem(LS_KEY(uid)) || '[]') } catch { return [] }
}
async function fetchBrands(uid) {
  try {
    const { data, error } = await supabase
      .from('brands')
      .select('id, name, industry, tone, platforms, notes, color')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
    if (error) return lsLoad(uid)
    return data || []
  } catch { return lsLoad(uid) }
}
function brandInitials(name = '') {
  const words = name.trim().split(/\s+/)
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

// ─── main component ────────────────────────────────────────────────────────
export default function FillSourceSelector({ onFill, onFillBrand, onNoBrief }) {
  // brief import state
  const [briefLoading, setBriefLoading] = useState(false)
  const [briefNotice,  setBriefNotice]  = useState('')   // '' | 'no_brief' | 'filled' | 'error'

  // brand hub state
  const [hubOpen,       setHubOpen]       = useState(false)
  const [brands,        setBrands]        = useState([])
  const [brandsLoading, setBrandsLoading] = useState(false)
  const [brandsLoaded,  setBrandsLoaded]  = useState(false)
  const [brandSearch,   setBrandSearch]   = useState('')
  const [hubNotice,     setHubNotice]     = useState('')   // '' | 'imported' | 'empty'

  const dropdownRef = useRef(null)

  // close hub dropdown on outside click
  useEffect(() => {
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setHubOpen(false)
      }
    }
    if (hubOpen) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [hubOpen])

  // ── Campaign Brief import ──────────────────────────────────────────────
  async function handleBriefClick() {
    setBriefNotice('')
    setHubNotice('')
    setBriefLoading(true)
    const { brief, error } = await fetchCampaignBrief()
    setBriefLoading(false)

    if (error) { setBriefNotice('error'); return }
    if (!brief) {
      setBriefNotice('no_brief')
      setTimeout(() => { if (onNoBrief) onNoBrief() }, 800)
      return
    }
    setBriefNotice('filled')
    if (onFill) onFill(brief)
  }

  // ── Brand Hub open / load ──────────────────────────────────────────────
  async function handleHubClick() {
    setBriefNotice('')
    setHubNotice('')

    if (hubOpen) { setHubOpen(false); return }

    setHubOpen(true)
    if (!brandsLoaded) {
      setBrandsLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      const uid = session?.user?.id
      const list = uid ? await fetchBrands(uid) : []
      setBrands(list)
      setBrandsLoading(false)
      setBrandsLoaded(true)
      if (list.length === 0) setHubNotice('empty')
    }
  }

  // ── Brand selected ─────────────────────────────────────────────────────
  function handleBrandSelect(brand) {
    setHubOpen(false)
    setBrandSearch('')
    setHubNotice('imported')
    if (onFillBrand) onFillBrand(brand)
  }

  const filteredBrands = brands.filter(b =>
    b.name.toLowerCase().includes(brandSearch.toLowerCase()) ||
    (b.industry || '').toLowerCase().includes(brandSearch.toLowerCase())
  )

  return (
    <div className={styles.selectorRoot}>
      {/* ── Two option buttons side-by-side ── */}
      <div className={styles.selectorRow}>

        {/* Option 1 — Campaign Brief */}
        <button
          type="button"
          className={`${styles.optionBtn} ${briefNotice === 'filled' ? styles.optionBtnActive : ''}`}
          onClick={handleBriefClick}
          disabled={briefLoading}
        >
          <span className={styles.optionIconWrap} style={{ background: '#EBF0FF' }}>
            <BookIcon color="#3B6BF5" />
          </span>
          <span className={styles.optionText}>
            <span className={styles.optionTitle}>
              {briefLoading ? 'Loading…' : 'Import from Campaign Brief'}
            </span>
            <span className={styles.optionDesc}>Pre-fill from your saved brief</span>
          </span>
          {briefLoading && <span className={styles.spinner} />}
          {briefNotice === 'filled' && <CheckBadge color="#3B6BF5" />}
        </button>

        {/* Option 2 — Brand & Client Hub */}
        <div className={styles.hubWrapper} ref={dropdownRef}>
          <button
            type="button"
            className={`${styles.optionBtn} ${hubOpen || hubNotice === 'imported' ? styles.optionBtnActive : ''}`}
            onClick={handleHubClick}
            disabled={brandsLoading && !brandsLoaded}
          >
            <span className={styles.optionIconWrap} style={{ background: '#F0FDF4' }}>
              <BriefcaseIcon color="#16A34A" />
            </span>
            <span className={styles.optionText}>
              <span className={styles.optionTitle}>Import from Brand &amp; Client Hub</span>
              <span className={styles.optionDesc}>Auto-fill from a saved brand profile</span>
            </span>
            {brandsLoading && !brandsLoaded
              ? <span className={styles.spinner} />
              : <ChevronIcon open={hubOpen} />
            }
            {hubNotice === 'imported' && !hubOpen && <CheckBadge color="#16A34A" />}
          </button>

          {/* Dropdown */}
          {hubOpen && (
            <div className={styles.hubDropdown}>
              <div className={styles.hubSearchRow}>
                <SearchIcon />
                <input
                  className={styles.hubSearchInput}
                  placeholder="Search brands or industries…"
                  value={brandSearch}
                  onChange={e => setBrandSearch(e.target.value)}
                  autoFocus
                />
                {brandSearch && (
                  <button className={styles.hubSearchClear} onClick={() => setBrandSearch('')} type="button">
                    <XIcon />
                  </button>
                )}
              </div>

              <div className={styles.hubList}>
                {brandsLoading ? (
                  <div className={styles.hubEmpty}><span className={styles.spinner} /> Loading brands…</div>
                ) : filteredBrands.length === 0 ? (
                  <div className={styles.hubEmpty}>
                    {brandSearch
                      ? `No brands matching "${brandSearch}"`
                      : 'No brands in your Hub yet. Add one in Brand & Client Hub.'}
                  </div>
                ) : (
                  filteredBrands.map(brand => (
                    <button
                      key={brand.id}
                      className={styles.hubItem}
                      onClick={() => handleBrandSelect(brand)}
                      type="button"
                    >
                      <div
                        className={styles.hubAvatar}
                        style={{ background: brand.color || '#3B6BF5' }}
                      >
                        {brandInitials(brand.name)}
                      </div>
                      <div className={styles.hubItemInfo}>
                        <div className={styles.hubItemName}>{brand.name}</div>
                        {brand.industry && (
                          <div className={styles.hubItemIndustry}>{brand.industry}</div>
                        )}
                      </div>
                      {brand.tone && (
                        <span className={styles.hubItemTone}>{brand.tone}</span>
                      )}
                      <ArrowRight />
                    </button>
                  ))
                )}
              </div>

              <div className={styles.hubFooter}>
                Manage brands in <span className={styles.hubFooterLink}>Brand &amp; Client Hub</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Status notices ── */}
      {briefNotice === 'no_brief' && (
        <div className={styles.notice}>
          <WarnIcon />
          No Campaign Brief found. Redirecting you to create one first…
        </div>
      )}
      {briefNotice === 'filled' && (
        <div className={styles.noticeSuccess}>
          <CheckIcon />
          Fields pre-filled from your Campaign Brief. Edit freely before generating.
        </div>
      )}
      {briefNotice === 'error' && (
        <div className={styles.notice}>
          <WarnIcon />
          Could not load Campaign Brief. Please try again.
        </div>
      )}
      {hubNotice === 'imported' && !hubOpen && (
        <div className={styles.noticeHub}>
          <CheckIcon />
          Brand profile imported. Review and complete any remaining fields.
        </div>
      )}
    </div>
  )
}

// ─── Icons ─────────────────────────────────────────────────────────────────
function BookIcon({ color = '#3B6BF5' }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 016.5 17H20"/>
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/>
    </svg>
  )
}
function BriefcaseIcon({ color = '#16A34A' }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2"/>
      <path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/>
      <path d="M2 12h20"/>
    </svg>
  )
}
function ChevronIcon({ open }) {
  return (
    <svg
      width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      style={{ transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)', flexShrink: 0 }}
    >
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  )
}
function SearchIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9BA3BB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  )
}
function XIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  )
}
function ArrowRight() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9BA3BB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
    </svg>
  )
}
function WarnIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  )
}
function CheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  )
}
function CheckBadge({ color = '#3B6BF5' }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <circle cx="12" cy="12" r="10"/><polyline points="9 12 11 14 15 10"/>
    </svg>
  )
}
