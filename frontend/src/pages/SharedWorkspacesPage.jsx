/**
 * SharedWorkspacesPage.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * AI Social Media Campaign Generator | Sourcesys Technologies
 *
 * Fully functional Shared Workspaces page.
 *
 * Features
 * ────────
 *  • "Shared With Me" tab  — campaigns other users have shared with the current
 *    user; click any card to open it in CampaignWorkspace (read-only view).
 *  • "My Shares" tab       — outgoing shares the current user has created;
 *    shows per-share invitee, permission badge, status pill, and a Revoke button.
 *  • "Share a Campaign" panel — pick any of the user's own campaigns, enter an
 *    email address, choose View / Edit permission, and click Send Invite.
 *
 * Data layer (all via campaignService.js → Supabase)
 * ───────────────────────────────────────────────────
 *  fetchIncomingShares()        → rows where invitee_email = current user email
 *  fetchOutgoingShares()        → rows where owner_id      = current user id
 *  fetchUserCampaigns()         → the user's own campaigns (for the share picker)
 *  shareCampaign(id, email, p)  → upsert a share row
 *  revokeShare(shareId)         → delete a share row
 *  updateSharePermission(id, p) → patch permission on a share row
 */

import { useState, useEffect, useCallback } from 'react'
import {
  fetchIncomingShares,
  fetchOutgoingShares,
  fetchUserCampaigns,
  shareCampaign,
  revokeShare,
  updateSharePermission,
  sendInviteEmail,
} from '../lib/campaignService'
import styles from './SharedWorkspacesPage.module.css'

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function formatRelative(iso) {
  if (!iso) return '—'
  const diff = Math.floor((Date.now() - new Date(iso)) / 1000)
  if (diff < 60)    return 'Just now'
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function initials(email = '') {
  const local = email.split('@')[0]
  const parts = local.split(/[._-]/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return local.slice(0, 2).toUpperCase()
}

const AVATAR_COLORS = [
  { bg: '#EBF0FF', color: '#3B6BF5' },
  { bg: '#F0FDF4', color: '#16A34A' },
  { bg: '#FFF7ED', color: '#EA580C' },
  { bg: '#FDF4FF', color: '#9333EA' },
  { bg: '#FFF1F2', color: '#BE123C' },
]
function avatarColor(str = '') {
  let h = 0
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h)
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}

const STATUS_STYLES = {
  Draft:       { bg: '#F1F5F9', color: '#475569' },
  Active:      { bg: '#DCFCE7', color: '#15803D' },
  'In Review': { bg: '#FEF9C3', color: '#A16207' },
  Paused:      { bg: '#FEF2F2', color: '#B91C1C' },
  Completed:   { bg: '#EFF9FF', color: '#0369A1' },
}

// ─────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────
export default function SharedWorkspacesPage({ onOpenWorkspace }) {
  const [tab, setTab]             = useState('incoming')   // 'incoming' | 'outgoing' | 'share'

  // Data
  const [incoming,    setIncoming]    = useState([])
  const [outgoing,    setOutgoing]    = useState([])
  const [myCampaigns, setMyCampaigns] = useState([])

  // Loading / error
  const [loadingIn,  setLoadingIn]  = useState(true)
  const [loadingOut, setLoadingOut] = useState(true)
  const [loadingCmp, setLoadingCmp] = useState(true)
  const [errorIn,    setErrorIn]    = useState('')
  const [errorOut,   setErrorOut]   = useState('')

  // Share form
  const [selectedCampaign, setSelectedCampaign] = useState('')
  const [inviteeEmail,     setInviteeEmail]     = useState('')
  const [permission,       setPermission]       = useState('view')
  const [shareLoading,     setShareLoading]     = useState(false)
  const [shareSuccess,     setShareSuccess]     = useState('')
  const [shareError,       setShareError]       = useState('')

  // Per-row revoke / permission-change state
  const [revoking,      setRevoking]      = useState({})   // { shareId: true }
  const [permChanging,  setPermChanging]  = useState({})   // { shareId: true }

  // ── Load data ────────────────────────────────────────────────
  const loadIncoming = useCallback(async () => {
    setLoadingIn(true); setErrorIn('')
    const { data, error } = await fetchIncomingShares()
    if (error) setErrorIn(error)
    else       setIncoming(data)
    setLoadingIn(false)
  }, [])

  const loadOutgoing = useCallback(async () => {
    setLoadingOut(true); setErrorOut('')
    const { data, error } = await fetchOutgoingShares()
    if (error) setErrorOut(error)
    else       setOutgoing(data)
    setLoadingOut(false)
  }, [])

  const loadMyCampaigns = useCallback(async () => {
    setLoadingCmp(true)
    const { data } = await fetchUserCampaigns()
    setMyCampaigns(data || [])
    setLoadingCmp(false)
  }, [])

  useEffect(() => {
    loadIncoming()
    loadOutgoing()
    loadMyCampaigns()
  }, [])

  // ── Share form submit ────────────────────────────────────────
  async function handleShare(e) {
    e.preventDefault()
    setShareError(''); setShareSuccess('')
    if (!selectedCampaign) { setShareError('Please select a campaign.'); return }
    if (!inviteeEmail.trim()) { setShareError('Please enter an email address.'); return }
    const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRx.test(inviteeEmail.trim())) { setShareError('Please enter a valid email address.'); return }

    setShareLoading(true)
    const { error } = await shareCampaign(selectedCampaign, inviteeEmail.trim(), permission)
    setShareLoading(false)

    if (error) {
      setShareError(error)
    } else {
      setShareSuccess(`Invite sent to ${inviteeEmail.trim()}!`)

      const selectedCamp = myCampaigns.find(c => c.id === selectedCampaign)
      const campaignName = selectedCamp?.campaign_name || 'a campaign'

      sendInviteEmail(inviteeEmail.trim(), campaignName, permission)
        .catch(console.warn)

      setInviteeEmail('')
      setSelectedCampaign('')
      setPermission('view')
      loadOutgoing()
      setTimeout(() => setShareSuccess(''), 4000)
    }
  }

  // ── Revoke a share ───────────────────────────────────────────
  async function handleRevoke(shareId) {
    setRevoking(r => ({ ...r, [shareId]: true }))
    await revokeShare(shareId)
    setRevoking(r => ({ ...r, [shareId]: false }))
    loadOutgoing()
  }

  // ── Change permission ────────────────────────────────────────
  async function handlePermChange(shareId, newPerm) {
    setPermChanging(p => ({ ...p, [shareId]: true }))
    await updateSharePermission(shareId, newPerm)
    setPermChanging(p => ({ ...p, [shareId]: false }))
    loadOutgoing()
  }

  // ── Tab counts ───────────────────────────────────────────────
  const inCount  = incoming.length
  const outCount = outgoing.length

  return (
    <div className={styles.page}>
      {/* ── Header ── */}
      <div className={styles.pageHdr}>
        <div className={styles.pageHdrLeft}>
          <h2 className={styles.pageTitle}>Shared Workspaces</h2>
          <p className={styles.pageSub}>Collaborate on campaigns with your team in real time.</p>
        </div>
        <button className={styles.shareBtn} onClick={() => setTab('share')}>
          <PlusIcon /> Share a Campaign
        </button>
      </div>

      {/* ── Tab bar ── */}
      <div className={styles.tabBar}>
        <button
          className={`${styles.tabBtn} ${tab === 'incoming' ? styles.tabBtnActive : ''}`}
          onClick={() => setTab('incoming')}
        >
          <InboxIcon /> Shared With Me
          {inCount > 0 && <span className={styles.tabCount}>{inCount}</span>}
        </button>
        <button
          className={`${styles.tabBtn} ${tab === 'outgoing' ? styles.tabBtnActive : ''}`}
          onClick={() => setTab('outgoing')}
        >
          <SendIcon /> My Shares
          {outCount > 0 && <span className={styles.tabCount}>{outCount}</span>}
        </button>
        <button
          className={`${styles.tabBtn} ${tab === 'share' ? styles.tabBtnActive : ''}`}
          onClick={() => setTab('share')}
        >
          <ShareIcon /> New Share
        </button>
      </div>

      {/* ── Tab: Shared With Me ── */}
      {tab === 'incoming' && (
        <div className={styles.tabContent}>
          {loadingIn ? (
            <LoadingState label="Loading shared campaigns…" />
          ) : errorIn ? (
            <ErrorState message={errorIn} onRetry={loadIncoming} />
          ) : inCount === 0 ? (
            <EmptyState
              icon={<InboxIcon size={28} />}
              title="No campaigns shared with you yet"
              desc="When a teammate shares a campaign with your email address, it will appear here."
            />
          ) : (
            <div className={styles.cardGrid}>
              {incoming.map(share => {
                const camp = share.campaigns
                if (!camp) return null
                const sc = STATUS_STYLES[camp.status] || STATUS_STYLES.Draft
                return (
                  <div key={share.id} className={styles.campCard}>
                    <div className={styles.campCardTop}>
                      <div className={styles.campCardName}>
                        {camp.campaign_name.charAt(0).toUpperCase() + camp.campaign_name.slice(1)}
                      </div>
                      <div className={styles.campCardMeta}>
                        <span className={styles.statusPill} style={{ background: sc.bg, color: sc.color }}>
                          {camp.status}
                        </span>
                        <PermBadge permission={share.permission} />
                      </div>
                    </div>

                    {(camp.platforms || []).length > 0 && (
                      <div className={styles.platRow}>
                        {camp.platforms.map(p => (
                          <span key={p} className={styles.platPill}>{p}</span>
                        ))}
                      </div>
                    )}

                    <div className={styles.campCardFooter}>
                      <span className={styles.metaText}>
                        <ClockIcon /> {formatRelative(camp.updated_at)}
                      </span>
                      <div className={styles.cardActions}>
                        {share.permission === 'edit' ? (
                          <button
                            className={styles.actionBtnEdit}
                            onClick={() => onOpenWorkspace && onOpenWorkspace(camp.id)}
                            title="Open with edit access"
                          >
                            <EditIcon size={12} /> Edit Workspace
                          </button>
                        ) : (
                          <button
                            className={styles.actionBtnView}
                            onClick={() => onOpenWorkspace && onOpenWorkspace(camp.id)}
                            title="Open in view-only mode"
                          >
                            <EyeIcon size={12} /> View Workspace
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: My Shares ── */}
      {tab === 'outgoing' && (
        <div className={styles.tabContent}>
          {loadingOut ? (
            <LoadingState label="Loading your shares…" />
          ) : errorOut ? (
            <ErrorState message={errorOut} onRetry={loadOutgoing} />
          ) : outCount === 0 ? (
            <EmptyState
              icon={<SendIcon size={28} />}
              title="You haven't shared any campaigns yet"
              desc="Use the 'New Share' tab to invite a teammate to collaborate on a campaign."
              action={{ label: 'Share a Campaign', onClick: () => setTab('share') }}
            />
          ) : (
            <div className={styles.shareList}>
              {outgoing.map(share => {
                const camp   = share.campaigns
                if (!camp) return null
                const ac     = avatarColor(share.invitee_email)
                const campName = camp.campaign_name.charAt(0).toUpperCase() + camp.campaign_name.slice(1)
                return (
                  <div key={share.id} className={styles.shareRow}>
                    {/* Avatar */}
                    <div className={styles.shareAvatar} style={{ background: ac.bg, color: ac.color }}>
                      {initials(share.invitee_email)}
                    </div>

                    {/* Info */}
                    <div className={styles.shareInfo}>
                      <div className={styles.shareEmail}>{share.invitee_email}</div>
                      <div className={styles.shareCampName}>
                        <CampaignIcon /> {campName}
                      </div>
                      <div className={styles.shareTime}>{formatRelative(share.created_at)}</div>
                    </div>

                    {/* Controls */}
                    <div className={styles.shareControls}>
                      {/* Status pill */}
                      <span className={`${styles.statusPill} ${share.status === 'accepted' ? styles.statusAccepted : styles.statusPending}`}>
                        {share.status === 'accepted' ? '✓ Accepted' : '⏳ Pending'}
                      </span>

                      {/* Permission select */}
                      <select
                        className={styles.permSelect}
                        value={share.permission}
                        disabled={!!permChanging[share.id]}
                        onChange={e => handlePermChange(share.id, e.target.value)}
                        title="Change permission"
                      >
                        <option value="view">View</option>
                        <option value="edit">Edit</option>
                      </select>

                      {/* Revoke */}
                      <button
                        className={styles.revokeBtn}
                        disabled={!!revoking[share.id]}
                        onClick={() => handleRevoke(share.id)}
                        title="Revoke access"
                      >
                        {revoking[share.id] ? <SpinnerIcon /> : <TrashIcon />}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: New Share ── */}
      {tab === 'share' && (
        <div className={styles.tabContent}>
          <div className={styles.shareFormWrap}>
            <div className={styles.shareFormHdr}>
              <div className={styles.shareFormTitle}>Invite a Teammate</div>
              <p className={styles.shareFormSub}>
                Share any of your campaigns with a team member. They'll be able to open the
                workspace and view all generated outputs.
              </p>
            </div>

            <form onSubmit={handleShare} className={styles.shareForm} noValidate>
              {/* Campaign picker */}
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Campaign</label>
                {loadingCmp ? (
                  <div className={styles.fieldLoading}>Loading campaigns…</div>
                ) : myCampaigns.length === 0 ? (
                  <div className={styles.fieldLoading}>No campaigns found. Generate one first.</div>
                ) : (
                  <select
                    className={styles.fieldSelect}
                    value={selectedCampaign}
                    onChange={e => setSelectedCampaign(e.target.value)}
                  >
                    <option value="">— Select a campaign —</option>
                    {myCampaigns.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.campaign_name.charAt(0).toUpperCase() + c.campaign_name.slice(1)}
                        {c.status ? ` · ${c.status}` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Email */}
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Teammate's Email</label>
                <input
                  type="email"
                  className={styles.fieldInput}
                  placeholder="teammate@company.com"
                  value={inviteeEmail}
                  onChange={e => setInviteeEmail(e.target.value)}
                  autoComplete="off"
                />
              </div>

              {/* Permission */}
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Permission</label>
                <div className={styles.permRow}>
                  <PermOption
                    value="view"
                    current={permission}
                    onChange={setPermission}
                    icon={<EyeIcon />}
                    label="View only"
                    desc="Can open and read outputs, cannot save new ones"
                  />
                  <PermOption
                    value="edit"
                    current={permission}
                    onChange={setPermission}
                    icon={<EditIcon />}
                    label="Can edit"
                    desc="Can generate and save outputs to this workspace"
                  />
                </div>
              </div>

              {/* Feedback messages */}
              {shareError   && <div className={styles.formError}>{shareError}</div>}
              {shareSuccess && <div className={styles.formSuccess}>{shareSuccess}</div>}

              {/* Submit */}
              <button
                type="submit"
                className={styles.submitBtn}
                disabled={shareLoading}
              >
                {shareLoading ? <><SpinnerIcon /> Sending…</> : <><SendIcon size={15} /> Send Invite</>}
              </button>
            </form>

            {/* Feature list */}
            <div className={styles.featureList}>
              {[
                { icon: '📨', text: 'Invite by email — view or edit permissions' },
                { icon: '🔗', text: 'Invitee can open any output saved to the workspace' },
                { icon: '🔒', text: 'Only the owner can save or delete the campaign' },
                { icon: '🔔', text: 'Revoke access at any time from "My Shares"' },
              ].map((f, i) => (
                <div key={i} className={styles.featureItem}>
                  <span className={styles.featureIcon}>{f.icon}</span>
                  <span>{f.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────

function PermBadge({ permission }) {
  const isEdit = permission === 'edit'
  return (
    <span className={styles.permBadge} style={{
      background: isEdit ? '#FFF7ED' : '#F0F4FF',
      color:      isEdit ? '#EA580C' : '#3B6BF5',
      border:     `1px solid ${isEdit ? '#FED7AA' : '#BFDBFE'}`,
    }}>
      {isEdit ? <EditIcon size={10} /> : <EyeIcon size={10} />}
      {isEdit ? 'Edit' : 'View'}
    </span>
  )
}

function PermOption({ value, current, onChange, icon, label, desc }) {
  const active = current === value
  return (
    <div
      className={`${styles.permOption} ${active ? styles.permOptionActive : ''}`}
      onClick={() => onChange(value)}
    >
      <div className={styles.permOptionTop}>
        <span className={styles.permOptionIcon}>{icon}</span>
        <span className={styles.permOptionLabel}>{label}</span>
        {active && <span className={styles.permCheck}>✓</span>}
      </div>
      <div className={styles.permOptionDesc}>{desc}</div>
    </div>
  )
}

function LoadingState({ label }) {
  return (
    <div className={styles.stateBox}>
      <div className={styles.spinner} />
      <span className={styles.stateLabel}>{label}</span>
    </div>
  )
}

function ErrorState({ message, onRetry }) {
  return (
    <div className={styles.stateBox}>
      <div className={styles.errorIcon}>⚠</div>
      <span className={styles.stateLabel}>{message}</span>
      {onRetry && <button className={styles.retryBtn} onClick={onRetry}>Retry</button>}
    </div>
  )
}

function EmptyState({ icon, title, desc, action }) {
  return (
    <div className={styles.emptyBox}>
      <div className={styles.emptyIcon}>{icon}</div>
      <div className={styles.emptyTitle}>{title}</div>
      <div className={styles.emptyDesc}>{desc}</div>
      {action && (
        <button className={styles.emptyAction} onClick={action.onClick}>{action.label}</button>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Icons
// ─────────────────────────────────────────────────────────────
function ShareIcon({ size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
    </svg>
  )
}
function InboxIcon({ size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/>
      <path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z"/>
    </svg>
  )
}
function SendIcon({ size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13"/>
      <polygon points="22 2 15 22 11 13 2 9 22 2"/>
    </svg>
  )
}
function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  )
}
function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
      <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
    </svg>
  )
}
function ClockIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }}>
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  )
}
function CampaignIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }}>
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </svg>
  )
}
function EyeIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  )
}
function EditIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  )
}
function SpinnerIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 0.8s linear infinite' }}>
      <line x1="12" y1="2" x2="12" y2="6"/>
      <line x1="12" y1="18" x2="12" y2="22"/>
      <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/>
      <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/>
      <line x1="2" y1="12" x2="6" y2="12"/>
      <line x1="18" y1="12" x2="22" y2="12"/>
      <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/>
      <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/>
    </svg>
  )
}
