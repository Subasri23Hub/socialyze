import { useState, useEffect, useMemo } from 'react'
import { fetchUserCampaigns, deleteCampaign, searchCampaigns } from '../lib/campaignService'
import styles from './ActiveCampaigns.module.css'
// _isSharedEdit campaigns appear here with a "Shared" badge and no delete button

const STATUS_COLOR = {
  Draft:      { bg: '#F1F5F9', color: '#475569' },
  Active:     { bg: '#DCFCE7', color: '#15803D' },
  'In Review':{ bg: '#FEF9C3', color: '#A16207' },
  Paused:     { bg: '#FEF2F2', color: '#B91C1C' },
  Completed:  { bg: '#EFF9FF', color: '#0369A1' },
}

const PLATFORM_STYLE = {
  Instagram: { bg: '#FDF2F8', color: '#9D174D' },
  Twitter:   { bg: '#EFF6FF', color: '#1D4ED8' },
  LinkedIn:  { bg: '#EFF9FF', color: '#0369A1' },
  Facebook:  { bg: '#EFF6FF', color: '#1E40AF' },
  TikTok:    { bg: '#FEF2F2', color: '#991B1B' },
  YouTube:   { bg: '#FEF2F2', color: '#991B1B' },
}

const CARD_PALETTES = [
  { bg: 'linear-gradient(135deg, #38BDF8 0%, #3B6BF5 60%, #6366F1 100%)', initial: 'rgba(255,255,255,0.4)' },
  { bg: 'linear-gradient(135deg, #34D399 0%, #0EA5B0 60%, #0EA5E9 100%)', initial: 'rgba(255,255,255,0.4)' },
  { bg: 'linear-gradient(135deg, #F472B6 0%, #C084FC 60%, #818CF8 100%)', initial: 'rgba(255,255,255,0.4)' },
  { bg: 'linear-gradient(135deg, #FB923C 0%, #F59E0B 60%, #EAB308 100%)', initial: 'rgba(255,255,255,0.4)' },
  { bg: 'linear-gradient(135deg, #F87171 0%, #EF4444 60%, #DC2626 100%)', initial: 'rgba(255,255,255,0.4)' },
  { bg: 'linear-gradient(135deg, #A3E635 0%, #22C55E 60%, #059669 100%)', initial: 'rgba(255,255,255,0.4)' },
]

function formatDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  const now = new Date()
  const diff = Math.floor((now - d) / 1000)
  if (diff < 60)  return 'Just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

function formatCampaignName(raw) {
  if (!raw) return ''
  // Stored as lowercase brand key (e.g. "nike") — capitalise first letter for display
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}

export default function ActiveCampaignsPage({ onOpenWorkspace }) {
  const [campaigns, setCampaigns]     = useState([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState('')
  const [confirmId, setConfirmId]     = useState(null)   // campaign id pending delete
  const [deleting, setDeleting]       = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  // Filtered list — recomputed whenever campaigns or query changes
  const filteredCampaigns = useMemo(
    () => searchCampaigns(searchQuery, campaigns),
    [searchQuery, campaigns]
  )

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    const { data, error: err } = await fetchUserCampaigns()
    if (err) setError(err)
    else setCampaigns(data)
    setLoading(false)
  }

  function requestDelete(e, id) {
    e.stopPropagation()          // don't open workspace
    setDeleteError('')
    setConfirmId(id)
  }

  async function confirmDelete() {
    setDeleting(true)
    const { error: err } = await deleteCampaign(confirmId)
    setDeleting(false)
    if (err) {
      setDeleteError(err)
      return
    }
    setConfirmId(null)
    load()   // reload full list from Supabase to stay in sync
  }

  if (loading) {
    return (
      <div className={styles.center}>
        <div className={styles.spinner} />
        <span>Loading campaigns…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className={styles.center}>
        <div className={styles.errorBox}>
          <span>⚠ {error}</span>
          <button className={styles.retryBtn} onClick={load}>Retry</button>
        </div>
      </div>
    )
  }

  const confirmCampaign = campaigns.find(c => c.id === confirmId)

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.pageHdr}>
        <div>
          <h2 className={styles.pageTitle}>Active Campaigns</h2>
          <p className={styles.pageSub}>All your AI-generated campaigns in one place · {campaigns.length} total</p>
        </div>
        <button className={styles.refreshBtn} onClick={load} title="Refresh">
          <RefreshIcon />
        </button>
      </div>

      {/* Search bar */}
      <div className={styles.searchRow}>
        <div className={styles.searchBox}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            className={styles.searchInput}
            type="text"
            placeholder="Search by brand or campaign name…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            autoComplete="off"
          />
          {searchQuery && (
            <button className={styles.searchClear} onClick={() => setSearchQuery('')} title="Clear">
              ✕
            </button>
          )}
        </div>
        {searchQuery && (
          <span className={styles.searchResultCount}>
            {filteredCampaigns.length} result{filteredCampaigns.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {campaigns.length === 0 && (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>📋</div>
          <div className={styles.emptyTitle}>No campaigns yet</div>
          <div className={styles.emptySub}>Generate content using any of the 4 panels and click Save to create your first campaign.</div>
        </div>
      )}

      {campaigns.length > 0 && filteredCampaigns.length === 0 && (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>🔍</div>
          <div className={styles.emptyTitle}>No matches found</div>
          <div className={styles.emptySub}>No campaigns match &ldquo;{searchQuery}&rdquo;. Try a different brand or title.</div>
        </div>
      )}

      <div className={styles.grid}>
        {filteredCampaigns.map((c, idx) => (
          <CampaignCard
            key={c.id}
            campaign={c}
            palette={CARD_PALETTES[idx % CARD_PALETTES.length]}
            onClick={() => onOpenWorkspace && onOpenWorkspace(c.id)}
            onDelete={c._isSharedEdit ? undefined : (e => requestDelete(e, c.id))}
          />
        ))}
      </div>

      {/* ── Delete confirmation modal ── */}
      {confirmId && (
        <div className={styles.modalOverlay} onClick={() => !deleting && setConfirmId(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalIcon}>🗑️</div>
            <div className={styles.modalTitle}>Delete Campaign?</div>
            <div className={styles.modalSub}>
              <strong>{formatCampaignName(confirmCampaign?.campaign_name)}</strong> and all its saved outputs will be permanently removed. This cannot be undone.
            </div>
            {deleteError && <div className={styles.modalErr}>⚠ {deleteError}</div>}
            <div className={styles.modalActions}>
              <button
                className={styles.cancelBtn}
                onClick={() => setConfirmId(null)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                className={styles.deleteBtn}
                onClick={confirmDelete}
                disabled={deleting}
              >
                {deleting ? 'Deleting…' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function CampaignCard({ campaign, palette, onClick, onDelete }) {
  const { campaign_name, status, platforms, updated_at, output_count, _isSharedEdit } = campaign
  const sc  = STATUS_COLOR[status] || STATUS_COLOR.Draft
  const pal = palette || CARD_PALETTES[0]

  return (
    <div className={styles.card} onClick={onClick} title="Open Campaign Workspace">
      {/* Thumbnail */}
      <div className={styles.thumb} style={{ background: pal.bg }}>
        <span className={styles.statusBadge} style={{ background: sc.bg, color: sc.color }}>
          {status}
        </span>
        {/* Only show delete button for campaigns the user owns */}
        {!_isSharedEdit && (
          <button
            className={styles.trashBtn}
            onClick={onDelete}
            title="Delete campaign"
            aria-label="Delete campaign"
          >
            <TrashIcon />
          </button>
        )}
        {/* Show a "Shared" badge for edit-permission shared campaigns */}
        {_isSharedEdit && (
          <span
            title="Shared with you (Edit access)"
            style={{
              position: 'absolute', top: 8, right: 8,
              background: 'rgba(255,255,255,0.92)', color: '#9333EA',
              fontSize: 10, fontWeight: 700, borderRadius: 6,
              padding: '2px 7px', letterSpacing: '0.04em',
              border: '1px solid #E9D5FF', pointerEvents: 'none',
            }}
          >
            ✦ Shared
          </span>
        )}
        <div className={styles.thumbInitial} style={{ color: pal.initial }}>
          {campaign_name.charAt(0).toUpperCase()}
        </div>
      </div>

      {/* Body */}
      <div className={styles.body}>
        <div className={styles.name}>{formatCampaignName(campaign_name)}</div>

        {/* Platforms */}
        <div className={styles.platRow}>
          {(platforms || []).slice(0, 4).map(p => {
            const ps = PLATFORM_STYLE[p] || { bg: '#F1F5F9', color: '#475569' }
            return (
              <span key={p} className={styles.platPill} style={{ background: ps.bg, color: ps.color }}>
                {p}
              </span>
            )
          })}
          {(platforms || []).length > 4 && (
            <span className={styles.platPill} style={{ background: '#F1F5F9', color: '#475569' }}>
              +{platforms.length - 4}
            </span>
          )}
        </div>

        {/* Footer row */}
        <div className={styles.footRow}>
          <div className={styles.meta}>
            <ClockIcon />
            <span>{formatDate(updated_at)}</span>
          </div>
          <div className={styles.outputCount}>
            <LayersIcon />
            <span>{output_count} output{output_count !== 1 ? 's' : ''}</span>
          </div>
        </div>

        <div className={styles.openHint}>
          Open Workspace →
        </div>
      </div>
    </div>
  )
}

/* ── Icons ── */
function TrashIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/>
      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
      <path d="M10 11v6M14 11v6"/>
      <path d="M9 6V4h6v2"/>
    </svg>
  )
}
function RefreshIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
      <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
    </svg>
  )
}
function ClockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  )
}
function LayersIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>
    </svg>
  )
}
