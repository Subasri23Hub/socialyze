import { useState, useEffect, useMemo } from 'react'
import { fetchUserCampaigns, deleteCampaign, searchCampaigns } from '../lib/campaignService'
import styles from './ActiveCampaigns.module.css'
import archStyles from './ArchivedPage.module.css'

const ARCHIVE_KEY = 'campaign_archived'

function getArchivedIds() {
  try { return JSON.parse(localStorage.getItem(ARCHIVE_KEY) || '[]') } catch { return [] }
}
function saveArchivedIds(ids) {
  localStorage.setItem(ARCHIVE_KEY, JSON.stringify(ids))
}

const THUMB_COLORS = [
  'linear-gradient(135deg, #CBD5E1 0%, #94A3B8 60%, #64748B 100%)',
  'linear-gradient(135deg, #D1D5DB 0%, #9CA3AF 60%, #6B7280 100%)',
  'linear-gradient(135deg, #C4B5FD 0%, #A78BFA 60%, #7C3AED 100%)',
  'linear-gradient(135deg, #FCA5A5 0%, #F87171 60%, #EF4444 100%)',
]
function hashColor(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) & 0xffffffff
  return THUMB_COLORS[Math.abs(h) % THUMB_COLORS.length]
}
function formatDate(iso) {
  if (!iso) return '—'
  const diff = Math.floor((new Date() - new Date(iso)) / 1000)
  if (diff < 60)     return 'Just now'
  if (diff < 3600)   return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

export default function ArchivedPage({ onOpenWorkspace }) {
  const [campaigns,    setCampaigns]    = useState([])
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState('')
  const [archivedIds,  setArchivedState] = useState(getArchivedIds)
  const [searchQuery,  setSearchQuery]  = useState('')
  const [confirmId,    setConfirmId]    = useState(null)
  const [deleting,     setDeleting]     = useState(false)
  const [deleteError,  setDeleteError]  = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data, error: err } = await fetchUserCampaigns()
    if (err) setError(err)
    else setCampaigns(data)
    setLoading(false)
  }

  function toggleArchive(id) {
    const next = archivedIds.includes(id)
      ? archivedIds.filter(x => x !== id)
      : [...archivedIds, id]
    saveArchivedIds(next)
    setArchivedState(next)
  }

  async function confirmDelete() {
    setDeleting(true)
    const { error: err } = await deleteCampaign(confirmId)
    setDeleting(false)
    if (err) { setDeleteError(err); return }
    // Also remove from archived list
    const next = archivedIds.filter(x => x !== confirmId)
    saveArchivedIds(next)
    setArchivedState(next)
    setConfirmId(null)
    load()
  }

  const archivedCampaigns = useMemo(
    () => campaigns.filter(c => archivedIds.includes(c.id)),
    [campaigns, archivedIds]
  )

  const filtered = useMemo(
    () => searchCampaigns(searchQuery, archivedCampaigns),
    [searchQuery, archivedCampaigns]
  )

  const confirmCampaign = campaigns.find(c => c.id === confirmId)

  if (loading) return (
    <div className={styles.center}><div className={styles.spinner} /><span>Loading archive…</span></div>
  )
  if (error) return (
    <div className={styles.center}>
      <div className={styles.errorBox}><span>⚠ {error}</span><button className={styles.retryBtn} onClick={load}>Retry</button></div>
    </div>
  )

  return (
    <div className={styles.page}>
      <div className={styles.pageHdr}>
        <div>
          <h2 className={styles.pageTitle}>Archived</h2>
          <p className={styles.pageSub}>
            {archivedCampaigns.length === 0
              ? 'Archive campaigns you no longer need but want to keep.'
              : `${archivedCampaigns.length} archived campaign${archivedCampaigns.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <button className={styles.refreshBtn} onClick={load} title="Refresh"><RefreshIcon /></button>
      </div>

      {/* Search */}
      {archivedCampaigns.length > 0 && (
        <div className={styles.searchRow}>
          <div className={styles.searchBox}>
            <SearchIcon />
            <input
              className={styles.searchInput}
              type="text"
              placeholder="Search archive…"
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

      {archivedCampaigns.length > 0 && filtered.length === 0 && searchQuery && (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>🔍</div>
          <div className={styles.emptyTitle}>No matches</div>
          <div className={styles.emptySub}>No archived campaigns match &ldquo;{searchQuery}&rdquo;.</div>
        </div>
      )}

      {archivedCampaigns.length > 0 && (
        <div className={styles.grid}>
          {filtered.map(c => (
            <ArchiveCard
              key={c.id}
              campaign={c}
              onClick={() => onOpenWorkspace && onOpenWorkspace(c.id)}
              onUnarchive={() => toggleArchive(c.id)}
              onDelete={e => { e.stopPropagation(); setDeleteError(''); setConfirmId(c.id) }}
            />
          ))}
        </div>
      )}

      {archivedCampaigns.length === 0 && (
        <>
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>📦</div>
            <div className={styles.emptyTitle}>No archived campaigns</div>
            <div className={styles.emptySub}>Click the archive icon on any campaign below to move it here.</div>
          </div>
          {campaigns.length > 0 && (
            <>
              <div className={archStyles.allLabel}>All Campaigns — click 📦 to archive</div>
              <div className={styles.grid}>
                {campaigns.map(c => (
                  <ArchiveCard
                    key={c.id}
                    campaign={c}
                    isArchived={false}
                    onClick={() => onOpenWorkspace && onOpenWorkspace(c.id)}
                    onUnarchive={() => toggleArchive(c.id)}
                    onDelete={e => { e.stopPropagation(); setDeleteError(''); setConfirmId(c.id) }}
                  />
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* Delete confirm modal */}
      {confirmId && (
        <div className={styles.modalOverlay} onClick={() => !deleting && setConfirmId(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalIcon}>🗑️</div>
            <div className={styles.modalTitle}>Permanently Delete?</div>
            <div className={styles.modalSub}>
              <strong>{confirmCampaign ? (confirmCampaign.campaign_name.charAt(0).toUpperCase() + confirmCampaign.campaign_name.slice(1)) : 'This campaign'}</strong> and all its outputs will be removed forever.
            </div>
            {deleteError && <div className={styles.modalErr}>⚠ {deleteError}</div>}
            <div className={styles.modalActions}>
              <button className={styles.cancelBtn} onClick={() => setConfirmId(null)} disabled={deleting}>Cancel</button>
              <button className={styles.deleteBtn} onClick={confirmDelete} disabled={deleting}>
                {deleting ? 'Deleting…' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ArchiveCard({ campaign, isArchived = true, onClick, onUnarchive, onDelete }) {
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
    <div className={`${styles.card} ${archStyles.archivedCard}`} onClick={onClick} title="Open Campaign Workspace">
      <div className={styles.thumb} style={{ background: grad }}>
        <span className={styles.statusBadge} style={{ background: sc.bg, color: sc.color }}>{status}</span>
        <div className={archStyles.thumbActions}>
          <button
            className={archStyles.archiveBtn}
            onClick={e => { e.stopPropagation(); onUnarchive() }}
            title={isArchived ? 'Unarchive' : 'Archive'}
          >
            {isArchived ? <UnarchiveIcon /> : <ArchiveIcon />}
          </button>
          {isArchived && (
            <button
              className={archStyles.archiveDeleteBtn}
              onClick={onDelete}
              title="Delete permanently"
            >
              <TrashIcon />
            </button>
          )}
        </div>
        <div className={styles.thumbInitial}>{campaign_name.charAt(0).toUpperCase()}</div>
      </div>
      <div className={styles.body}>
        <div className={`${styles.name} ${archStyles.archivedName}`}>
          {campaign_name.charAt(0).toUpperCase() + campaign_name.slice(1)}
        </div>
        <div className={styles.platRow}>
          {(platforms || []).slice(0, 4).map(p => (
            <span key={p} className={styles.platPill}>{p}</span>
          ))}
        </div>
        <div className={styles.footRow}>
          <div className={styles.meta}><ClockIcon /><span>{formatDate(updated_at)}</span></div>
          <div className={styles.outputCount}><LayersIcon /><span>{output_count} output{output_count !== 1 ? 's' : ''}</span></div>
        </div>
        <div className={styles.openHint}>{isArchived ? 'View Workspace →' : 'Open Workspace →'}</div>
      </div>
    </div>
  )
}

/* Icons */
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
function ArchiveIcon() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5" rx="1"/><line x1="10" y1="12" x2="14" y2="12"/></svg>
}
function UnarchiveIcon() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5" rx="1"/><polyline points="9 12 12 9 15 12"/><line x1="12" y1="9" x2="12" y2="15"/></svg>
}
function TrashIcon() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
}
