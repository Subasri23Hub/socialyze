import { useState, useEffect, useCallback, useMemo } from 'react'
import GeneratePanel          from './GeneratePanel.jsx'
import AudienceTargetingPanel from './AudienceTargetingPanel.jsx'
import CampaignIdeationPanel  from './CampaignIdeationPanel.jsx'
import CustomFlowPanel        from './CustomFlowPanel.jsx'
import QuickCampaignPanel     from './QuickCampaignPanel.jsx'
import CampaignCard           from './CampaignCard.jsx'
import { fetchUserCampaigns, deleteCampaign, searchCampaigns } from '../lib/campaignService'
import styles from './Dashboard.module.css'

const FRAMEWORKS = [
  { id: 'ai',       color: '#EBF0FF', stroke: '#3B6BF5', label: 'AI Post Generator',  desc: 'Multi-platform captions & hashtags via Gemini', icon: 'bolt' },
  { id: 'audience', color: '#F0FDF4', stroke: '#16A34A', label: 'Audience Targeting', desc: 'Persona-matched messaging strategy',              icon: 'users' },
  { id: 'ideas',    color: '#FFF7ED', stroke: '#EA580C', label: 'Campaign Ideation',  desc: 'Creative concepts & content calendar ideas',      icon: 'lightbulb' },
  { id: 'custom',   color: '#FDF4FF', stroke: '#9333EA', label: 'Custom Flow',        desc: 'AI-generated bespoke campaign skeleton',           icon: 'zap' },
]

function computeStats(campaigns) {
  const totalCampaigns = campaigns.length
  const totalOutputs   = campaigns.reduce((sum, c) => sum + (c.output_count || 0), 0)

  const platformSet = new Set()
  campaigns.forEach(c => (c.platforms || []).forEach(p => platformSet.add(p)))
  const uniquePlatforms = platformSet.size

  const toneFreq = {}
  campaigns.forEach(c => {
    const t = (c.tone || '').trim()
    if (t) toneFreq[t] = (toneFreq[t] || 0) + 1
  })
  const topTone     = Object.keys(toneFreq).sort((a, b) => toneFreq[b] - toneFreq[a])[0] || '—'
  const displayTone = topTone === '—' ? '—' : topTone.charAt(0).toUpperCase() + topTone.slice(1)

  return [
    {
      label:  'Active Campaigns',
      value:  String(totalCampaigns),
      change: totalCampaigns === 0 ? 'No campaigns yet' : totalCampaigns === 1 ? '1 campaign' : `${totalCampaigns} total`,
      up: totalCampaigns > 0,
    },
    {
      label:  'Posts Generated',
      value:  String(totalOutputs),
      change: totalOutputs === 0 ? 'No outputs yet' : `${totalOutputs} output${totalOutputs !== 1 ? 's' : ''} saved`,
      up: totalOutputs > 0,
    },
    {
      label:  'Platforms Used',
      value:  String(uniquePlatforms),
      change: uniquePlatforms === 0 ? 'None yet' : `${uniquePlatforms} platform${uniquePlatforms !== 1 ? 's' : ''} active`,
      up: uniquePlatforms > 0,
    },
    {
      label:  'Avg. Tone',
      value:  displayTone,
      change: displayTone === '—' ? 'No tone data' : 'Most used tone',
      up: displayTone !== '—',
    },
  ]
}

function thumbIndex(str) {
  if (!str) return 1
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) & 0xffff
  return (h % 4) + 1
}

function FwIcon({ id, stroke }) {
  if (id === 'bolt')      return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
  if (id === 'users')     return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
  if (id === 'lightbulb') return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
}

function timeAgo(dateStr) {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins  = Math.floor(diff / 60000)
  if (mins < 1)   return 'Just now'
  if (mins < 60)  return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)   return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default function Dashboard({ onOpenWorkspace, onGoToBrief }) {
  const [activePanel, setActivePanel] = useState(null)
  const [campaigns,   setCampaigns]   = useState([])
  const [loading,     setLoading]     = useState(true)
  const [confirmId,   setConfirmId]   = useState(null)
  const [deleting,    setDeleting]    = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  const stats            = useMemo(() => computeStats(campaigns), [campaigns])
  // preview: search-filtered, then capped at 4
  const filteredForPreview = useMemo(
    () => searchCampaigns(searchQuery, campaigns),
    [searchQuery, campaigns]
  )
  const previewCampaigns = useMemo(() => filteredForPreview.slice(0, 4), [filteredForPreview])

  const loadCampaigns = useCallback(async () => {
    setLoading(true)
    const { data } = await fetchUserCampaigns()
    setCampaigns(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { loadCampaigns() }, [loadCampaigns])

  function openPanel(id) { setActivePanel(id) }
  function closePanel()  { setActivePanel(null) }

  function requestDelete(id) {
    setDeleteError('')
    setConfirmId(id)
  }

  async function confirmDelete() {
    setDeleting(true)
    const { error: err } = await deleteCampaign(confirmId)
    setDeleting(false)
    if (err) { setDeleteError(err); return }
    setCampaigns(prev => prev.filter(c => c.id !== confirmId))
    setConfirmId(null)
    loadCampaigns()
  }

  function handleEdit(updated) {
    setCampaigns(prev => prev.map(c => {
      if (c.id !== updated.id) return c
      return {
        ...c,
        campaign_name: updated.title  ?? c.campaign_name,
        tone:          updated.desc   ? updated.desc.replace(/^Tone:\s*/i, '').trim() : c.tone,
        status:        updated.status ?? c.status,
        updated_at:    new Date().toISOString(),
      }
    }))
  }

  async function handleSaved() {
    await loadCampaigns()
    closePanel()
  }

  function handleNoBrief() {
    setActivePanel(null)
    if (onGoToBrief) onGoToBrief()
  }

  const confirmCampaign = campaigns.find(c => c.id === confirmId)

  return (
    <main className={styles.main}>
      {/* Top bar */}
      <div className={styles.topbar}>
        <div>
          <h1 className={styles.title}>All Campaigns</h1>
          <p className={styles.subtitle}>AI-powered social media generation — Socialyze</p>
        </div>
        <div className={styles.topRight}>
          <div className={styles.searchBox}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input
              className={styles.searchInput}
              type="text"
              placeholder="Search campaigns..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              autoComplete="off"
            />
            {searchQuery && (
              <button className={styles.searchClearBtn} onClick={() => setSearchQuery('')} title="Clear">✕</button>
            )}
          </div>
          <button className={styles.btnPrimary} onClick={() => openPanel('quick')}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            New Campaign
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className={styles.statsRow}>
        {stats.map(s => (
          <div key={s.label} className={styles.statCard}>
            <div className={styles.statLabel}>{s.label}</div>
            <div className={styles.statValue}>{s.value}</div>
            <span className={`${styles.statChange} ${s.up ? styles.up : styles.down}`}>{s.change}</span>
          </div>
        ))}
      </div>

      {activePanel === 'quick'    && <QuickCampaignPanel    onClose={closePanel} />}
      {activePanel === 'ai'       && <GeneratePanel         onClose={closePanel} onSaved={handleSaved} onNoBrief={handleNoBrief} />}
      {activePanel === 'audience' && <AudienceTargetingPanel onClose={closePanel} onSaved={handleSaved} onNoBrief={handleNoBrief} />}
      {activePanel === 'ideas'    && <CampaignIdeationPanel  onClose={closePanel} onSaved={handleSaved} onNoBrief={handleNoBrief} />}
      {activePanel === 'custom'   && <CustomFlowPanel        onClose={closePanel} onSaved={handleSaved} onNoBrief={handleNoBrief} />}

      {/* Framework cards */}
      <div className={styles.sectionLabel}>Start Generating</div>
      <div className={styles.sectionSub}>Select a framework to bootstrap your campaign.</div>
      <div className={styles.fwGrid}>
        {FRAMEWORKS.map(fw => (
          <div
            key={fw.id}
            className={`${styles.fwCard} ${activePanel === fw.id ? styles.fwCardActive : ''}`}
            onClick={() => openPanel(fw.id)}
          >
            <div className={styles.fwIcon} style={{ background: fw.color }}>
              <FwIcon id={fw.icon} stroke={fw.stroke} />
            </div>
            <div className={styles.fwName}>{fw.label}</div>
            <div className={styles.fwDesc}>{fw.desc}</div>
          </div>
        ))}
      </div>

      {/* Recent Campaigns */}
      <div className={styles.activeHdr}>
        <div>
          <span className={styles.activeTitle}>Recent Campaigns</span>
          {searchQuery ? (
            <span className={styles.activeSub}> — {filteredForPreview.length} match{filteredForPreview.length !== 1 ? 'es' : ''} for &ldquo;{searchQuery}&rdquo;</span>
          ) : campaigns.length > 4 && (
            <span className={styles.activeSub}> — showing 4 of {campaigns.length}</span>
          )}
        </div>

      </div>

      {loading && <div className={styles.empty}>Loading campaigns…</div>}

      {!loading && campaigns.length === 0 && (
        <div className={styles.empty}>No campaigns yet. Click <strong>New Campaign</strong> to get started!</div>
      )}

      {!loading && (
        <div className={styles.grid}>
          {previewCampaigns.map(c => (
            <CampaignCard
              key={c.id}
              campaign={{
                id:           c.id,
                title:        c.campaign_name || '',
                desc:         c.tone ? `Tone: ${c.tone}` : '',
                platforms:    c.platforms     || [],
                status:       c.status        || 'Draft',
                output_types: c.output_types  || [],
                thumb:        thumbIndex(c.campaign_name || ''),
                ago:          timeAgo(c.updated_at),
              }}
              onDelete={() => requestDelete(c.id)}
              onEdit={handleEdit}
              onOpen={() => onOpenWorkspace && onOpenWorkspace(c.id)}
            />
          ))}
        </div>
      )}

      {/* Delete confirmation modal */}
      {confirmId && (
        <div className={styles.modalOverlay} onClick={() => !deleting && setConfirmId(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalIcon}>🗑️</div>
            <div className={styles.modalTitle}>Delete Campaign?</div>
            <div className={styles.modalSub}>
              <strong>
                {confirmCampaign
                  ? (confirmCampaign.campaign_name || '').charAt(0).toUpperCase() + (confirmCampaign.campaign_name || '').slice(1)
                  : 'This campaign'}
              </strong>{' '}
              and all its saved outputs will be permanently removed. This cannot be undone.
            </div>
            {deleteError && <div className={styles.modalErr}>⚠ {deleteError}</div>}
            <div className={styles.modalActions}>
              <button className={styles.modalCancelBtn} onClick={() => setConfirmId(null)} disabled={deleting}>
                Cancel
              </button>
              <button className={styles.modalDeleteBtn} onClick={confirmDelete} disabled={deleting}>
                {deleting ? 'Deleting…' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={styles.footer}>
        <strong>Socialyze</strong> — Sourcesys Technologies
      </div>
    </main>
  )
}
