import { useState, useRef, useEffect } from 'react'
import styles from './CampaignCard.module.css'

const FAV_KEY     = 'campaign_favourites'
const ARCHIVE_KEY = 'campaign_archived'

function getIds(key) {
  try { return JSON.parse(localStorage.getItem(key) || '[]') } catch { return [] }
}
function toggleId(key, id) {
  const ids  = getIds(key)
  const next = ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]
  localStorage.setItem(key, JSON.stringify(next))
  return next.includes(id)
}

const STATUS_OPTIONS = ['Drafting', 'Active', 'In Review', 'Paused', 'Completed']

const PLATFORM_STYLES = {
  Instagram: styles.ig,
  Twitter:   styles.tw,
  LinkedIn:  styles.li,
  Facebook:  styles.fb,
  TikTok:    styles.tk,
}

const THUMB_CLASS = [null, styles.thumb1, styles.thumb2, styles.thumb3, styles.thumb4]

const OUTPUT_TYPE_META = {
  post_generator: { label: 'Posts',     bg: '#EBF0FF', color: '#3B6BF5' },
  audience:       { label: 'Audience',  bg: '#F0FDF4', color: '#16A34A' },
  ideation:       { label: 'Ideation',  bg: '#FFF7ED', color: '#EA580C' },
  custom_flow:    { label: 'Custom',    bg: '#FDF4FF', color: '#9333EA' },
}

const FLOW_CONFIG = [
  { stage: 'Foundation',       points: '0,30 40,30 80,29 120,29 160,28 200,28' },
  { stage: 'Foundation',       points: '0,30 50,28 100,27 150,26 200,24'        },
  { stage: 'Building',         points: '0,30 35,26 70,28 110,20 150,22 200,14'  },
  { stage: 'Building',         points: '0,30 30,24 65,26 95,16 130,18 170,10 200,8' },
  { stage: 'Peak',             points: '0,28 30,20 55,22 80,10 110,14 145,4 175,6 200,2' },
  { stage: 'Sustained Impact', points: '0,26 25,16 50,18 75,8 100,12 130,4 160,6 185,3 200,2' },
]

function getFlowConfig(n) {
  if (n <= 0) return FLOW_CONFIG[0]
  if (n === 1) return FLOW_CONFIG[1]
  if (n === 2) return FLOW_CONFIG[2]
  if (n === 3) return FLOW_CONFIG[3]
  if (n === 4) return FLOW_CONFIG[4]
  return FLOW_CONFIG[5]
}

export default function CampaignCard({ campaign, onDelete, onEdit, onOpen }) {
  const { id, title, desc, platforms, status, thumb, ago, output_types = [] } = campaign
  const thumbClass = THUMB_CLASS[thumb] || THUMB_CLASS[1]
  const flow = getFlowConfig(output_types.length)

  const [editing,    setEditing]    = useState(false)
  const [editTitle,  setEditTitle]  = useState(title)
  const [editDesc,   setEditDesc]   = useState(desc)
  const [editStatus, setEditStatus] = useState(status)
  const [menuOpen,   setMenuOpen]   = useState(false)
  const [isFav,      setIsFav]      = useState(() => getIds(FAV_KEY).includes(id))
  const [isArchived, setIsArchived] = useState(() => getIds(ARCHIVE_KEY).includes(id))
  const menuRef = useRef(null)

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return
    function handleOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [menuOpen])

  function handleToggleFav(e) {
    e.stopPropagation()
    const nowFav = toggleId(FAV_KEY, id)
    setIsFav(nowFav)
    setMenuOpen(false)
  }

  function handleToggleArchive(e) {
    e.stopPropagation()
    const nowArchived = toggleId(ARCHIVE_KEY, id)
    setIsArchived(nowArchived)
    setMenuOpen(false)
  }

  function openEdit(e) {
    e.stopPropagation()
    setEditTitle(title)
    setEditDesc(desc)
    setEditStatus(status)
    setEditing(true)
  }

  function saveEdit(e) {
    e.stopPropagation()
    onEdit && onEdit({ ...campaign, title: editTitle, desc: editDesc, status: editStatus, ago: 'Just now' })
    setEditing(false)
  }

  function cancelEdit(e) {
    e.stopPropagation()
    setEditing(false)
  }

  // Clicking the card opens workspace ONLY when NOT in edit mode
  function handleCardClick() {
    if (!editing && onOpen) onOpen()
  }

  return (
    <div
      className={styles.card}
      onClick={handleCardClick}
      style={{ cursor: editing ? 'default' : (onOpen ? 'pointer' : 'default') }}
    >
      {/* Thumbnail — always visible, delete button stops propagation */}
      <div className={`${styles.thumb} ${thumbClass}`}>
        <div className={styles.thumbDeco}>
          <button
            className={styles.deleteBtn}
            onClick={e => { e.stopPropagation(); onDelete && onDelete() }}
            title="Delete campaign"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
              <path d="M10 11v6"/><path d="M14 11v6"/>
            </svg>
          </button>
        </div>
        <span className={styles.badge}>{editing ? editStatus : status}</span>
      </div>

      {/* Body */}
      <div className={styles.body}>
        {editing ? (
          /* ── Edit mode — entire area blocks card click ── */
          <div onClick={e => e.stopPropagation()}>
            <div style={{ marginBottom: 8 }}>
              <label className={styles.ago} style={{ display: 'block', marginBottom: 4 }}>Campaign Title</label>
              <input
                className={styles.title}
                style={{ width: '100%', border: '1.5px solid rgba(59,107,245,0.3)', borderRadius: 7, padding: '5px 8px', outline: 'none', fontFamily: 'inherit', background: '#F5F6FA' }}
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
              />
            </div>
            <div style={{ marginBottom: 8 }}>
              <label className={styles.ago} style={{ display: 'block', marginBottom: 4 }}>Description</label>
              <textarea
                className={styles.desc}
                style={{ width: '100%', border: '1.5px solid rgba(59,107,245,0.3)', borderRadius: 7, padding: '5px 8px', outline: 'none', fontFamily: 'inherit', background: '#F5F6FA', resize: 'vertical', minHeight: 56 }}
                value={editDesc}
                onChange={e => setEditDesc(e.target.value)}
              />
            </div>
            <div style={{ marginBottom: 10 }}>
              <label className={styles.ago} style={{ display: 'block', marginBottom: 4 }}>Status</label>
              <select
                style={{ width: '100%', border: '1.5px solid rgba(59,107,245,0.3)', borderRadius: 7, padding: '5px 8px', outline: 'none', fontFamily: 'inherit', background: '#F5F6FA', fontSize: 12 }}
                value={editStatus}
                onChange={e => setEditStatus(e.target.value)}
              >
                {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className={styles.footer}>
              <span
                className={styles.editLink}
                style={{ color: '#9BA3BB', fontWeight: 500, cursor: 'pointer' }}
                onClick={cancelEdit}
              >Cancel</span>
              <span className={styles.editLink} style={{ cursor: 'pointer' }} onClick={saveEdit}>
                Save
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </span>
            </div>
          </div>
        ) : (
          /* ── View mode — clicking anywhere opens workspace, except the Edit button ── */
          <>
            <div className={styles.titleRow}>
              <div className={styles.title}>{title}</div>
              {/* Three-dot menu */}
              <div className={styles.menuWrap} ref={menuRef}>
                <button
                  className={styles.moreBtn}
                  onClick={e => { e.stopPropagation(); setMenuOpen(o => !o) }}
                  title="More options"
                  aria-label="More options"
                >
                  <ThreeDotsIcon />
                </button>
                {menuOpen && (
                  <div className={styles.dropdown} onClick={e => e.stopPropagation()}>
                    <button className={styles.dropItem} onClick={handleToggleFav}>
                      <StarIcon filled={isFav} />
                      {isFav ? 'Remove from Favourites' : 'Add to Favourites'}
                    </button>
                    <button className={styles.dropItem} onClick={handleToggleArchive}>
                      <ArchiveIcon boxed={isArchived} />
                      {isArchived ? 'Unarchive' : 'Archive'}
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className={styles.desc}>{desc}</div>

            {output_types.length > 0 && (
              <div className={styles.platformRow} style={{ marginTop: 4 }}>
                {output_types.map(type => {
                  const meta = OUTPUT_TYPE_META[type]
                  if (!meta) return null
                  return (
                    <span
                      key={type}
                      className={styles.platPill}
                      style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.color}22` }}
                    >
                      {meta.label}
                    </span>
                  )
                })}
              </div>
            )}

            <div className={styles.tensionSection}>
              <div className={styles.tensionHdr}>
                <span className={styles.tensionLabel}>Engagement Flow</span>
                <span className={styles.tensionStage}>{flow.stage}</span>
              </div>
              <svg width="100%" height="36" viewBox="0 0 200 36" style={{ display: 'block' }}>
                <polyline
                  points={flow.points}
                  fill="none"
                  stroke="#3B6BF5"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            <div className={styles.footer}>
              <span className={styles.ago}>Edited {ago}</span>
              {/* Edit button stops propagation so it doesn't open workspace */}
              <span className={styles.editLink} onClick={openEdit}>
                Edit
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/* ── Three-dot icon ── */
function ThreeDotsIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="5"  cy="12" r="2"/>
      <circle cx="12" cy="12" r="2"/>
      <circle cx="19" cy="12" r="2"/>
    </svg>
  )
}

/* ── Star icon ── */
function StarIcon({ filled }) {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24"
      fill={filled ? '#EAB308' : 'none'}
      stroke={filled ? '#EAB308' : 'currentColor'}
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  )
}

/* ── Archive icon ── */
function ArchiveIcon({ boxed }) {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="21 8 21 21 3 21 3 8"/>
      <rect x="1" y="3" width="22" height="5" rx="1"/>
      {boxed
        ? <><polyline points="9 12 12 9 15 12"/><line x1="12" y1="9" x2="12" y2="15"/></>
        : <line x1="10" y1="12" x2="14" y2="12"/>}
    </svg>
  )
}
