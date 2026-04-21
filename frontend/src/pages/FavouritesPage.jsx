import { useState, useEffect, useMemo } from 'react'
import { fetchUserCampaigns, searchCampaigns } from '../lib/campaignService'
import styles from './ActiveCampaigns.module.css'
import favStyles from './FavouritesPage.module.css'

const STORAGE_KEY = 'campaign_favourites'

function getFavIds() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
}
function saveFavIds(ids) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids))
}

const THUMB_COLORS = [
  'linear-gradient(135deg, #38BDF8 0%, #3B6BF5 60%, #6366F1 100%)',
  'linear-gradient(135deg, #34D399 0%, #0EA5B0 60%, #0EA5E9 100%)',
  'linear-gradient(135deg, #F472B6 0%, #C084FC 60%, #818CF8 100%)',
  'linear-gradient(135deg, #FB923C 0%, #F59E0B 60%, #EAB308 100%)',
]
function hashColor(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) & 0xffffffff
  return THUMB_COLORS[Math.abs(h) % THUMB_COLORS.length]
}
function formatDate(iso) {
  if (!iso) return '—'
  const diff = Math.floor((new Date() - new Date(iso)) / 1000)
  if (diff < 60)    return 'Just now'
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

export default function FavouritesPage({ onOpenWorkspace }) {
  const [campaigns,   setCampaigns]   = useState([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState('')
  const [favIds,      setFavIdsState] = useState(getFavIds)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data, error: err } = await fetchUserCampaigns()
    if (err) setError(err)
    else setCampaigns(data)
    setLoading(false)
  }

  function toggleFav(id) {
    const next = favIds.includes(id) ? favIds.filter(x => x !== id) : [...favIds, id]
    saveFavIds(next)
    setFavIdsState(next)
  }

  const favCampaigns = useMemo(
    () => campaigns.filter(c => favIds.includes(c.id)),
    [campaigns, favIds]
  )

  const filtered = useMemo(
    () => searchCampaigns(searchQuery, favCampaigns),
    [searchQuery, favCampaigns]
  )

  if (loading) return (
    <div className={styles.center}><div className={styles.spinner} /><span>Loading favourites…</span></div>
  )
  if (error) return (
    <div className={styles.center}>
      <div className={styles.errorBox}><span>⚠ {error}</span><button className={styles.retryBtn} onClick={load}>Retry</button></div>
    </div>
  )

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.pageHdr}>
        <div>
          <h2 className={styles.pageTitle}>Favourites</h2>
          <p className={styles.pageSub}>
            {favCampaigns.length === 0
              ? 'Star any campaign below to pin it here for quick access.'
              : `${favCampaigns.length} pinned campaign${favCampaigns.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <button className={styles.refreshBtn} onClick={load} title="Refresh"><RefreshIcon /></button>
      </div>

      {/* Search (only when there are favourites) */}
      {favCampaigns.length > 0 && (
        <div className={styles.searchRow}>
          <div className={styles.searchBox}>
            <SearchIcon />
            <input
              className={styles.searchInput}
              type="text"
              placeholder="Search favourites…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              autoComplete="off"
            />
            {searchQuery && (
              <button className={styles.searchClear} onClick={() => setSearchQuery('')} title="Clear">✕</button>
            )}
          </div>
          {searchQuery && (
            <span className={styles.searchResultCount}>
              {filtered.length} result{filtered.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}

      {/* Favourites grid */}
      {favCampaigns.length > 0 && filtered.length === 0 && searchQuery && (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>🔍</div>
          <div className={styles.emptyTitle}>No matches</div>
          <div className={styles.emptySub}>No favourites match &ldquo;{searchQuery}&rdquo;.</div>
        </div>
      )}

      {favCampaigns.length > 0 && (
        <div className={styles.grid}>
          {filtered.map(c => (
            <FavCard
              key={c.id}
              campaign={c}
              isFav
              onToggleFav={() => toggleFav(c.id)}
              onClick={() => onOpenWorkspace && onOpenWorkspace(c.id)}
            />
          ))}
        </div>
      )}

      {/* When no favourites yet — show all campaigns with star buttons */}
      {favCampaigns.length === 0 && (
        <>
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>⭐</div>
            <div className={styles.emptyTitle}>No favourites yet</div>
            <div className={styles.emptySub}>Click the ☆ star on any campaign below to pin it here.</div>
          </div>
          {campaigns.length > 0 && (
            <>
              <div className={favStyles.allLabel}>All Campaigns — click ☆ to favourite</div>
              <div className={styles.grid}>
                {campaigns.map(c => (
                  <FavCard
                    key={c.id}
                    campaign={c}
                    isFav={false}
                    onToggleFav={() => toggleFav(c.id)}
                    onClick={() => onOpenWorkspace && onOpenWorkspace(c.id)}
                  />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

function FavCard({ campaign, isFav, onToggleFav, onClick }) {
  const { campaign_name, status, platforms, updated_at, output_count } = campaign
  const grad = hashColor(campaign_name)
  const STATUS_COLOR = {
    Draft:       { bg: '#F1F5F9', color: '#475569' },
    Active:      { bg: '#DCFCE7', color: '#15803D' },
    'In Review': { bg: '#FEF9C3', color: '#A16207' },
    Paused:      { bg: '#FEF2F2', color: '#B91C1C' },
    Completed:   { bg: '#EFF9FF', color: '#0369A1' },
  }
  const sc = STATUS_COLOR[status] || STATUS_COLOR.Draft

  return (
    <div className={styles.card} onClick={onClick} title="Open Campaign Workspace">
      <div className={styles.thumb} style={{ background: grad }}>
        {/* ★ Star — top-left corner */}
        <button
          className={favStyles.starBtn}
          onClick={e => { e.stopPropagation(); onToggleFav() }}
          title={isFav ? 'Remove from favourites' : 'Add to favourites'}
        >
          {isFav ? '★' : '☆'}
        </button>

        {/* Status badge — top-right corner */}
        <span className={styles.statusBadge} style={{ background: sc.bg, color: sc.color }}>{status}</span>

        <div className={styles.thumbInitial}>{campaign_name.charAt(0).toUpperCase()}</div>
      </div>
      <div className={styles.body}>
        <div className={styles.name}>{campaign_name.charAt(0).toUpperCase() + campaign_name.slice(1)}</div>
        <div className={styles.platRow}>
          {(platforms || []).slice(0, 4).map(p => (
            <span key={p} className={styles.platPill}>{p}</span>
          ))}
        </div>
        <div className={styles.footRow}>
          <div className={styles.meta}><ClockIcon /><span>{formatDate(updated_at)}</span></div>
          <div className={styles.outputCount}><LayersIcon /><span>{output_count} output{output_count !== 1 ? 's' : ''}</span></div>
        </div>
        <div className={styles.openHint}>Open Workspace →</div>
      </div>
    </div>
  )
}

/* ── Icons ── */
function SearchIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
}
function RefreshIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>
}
function ClockIcon() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
}
function LayersIcon() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
}
