import styles from './Sidebar.module.css'

const NAV_WORKSPACE = [
  { id: 'brief',    icon: BookIcon,           label: 'Campaign Brief' },
  { id: 'campaigns', icon: GridIcon,          label: 'All Campaigns' },
  { id: 'active',   icon: ActivityIcon,       label: 'Active Campaigns' },
  { id: 'shared',   icon: ShareIcon,          label: 'Shared Workspaces' },
]
const NAV_LIBRARY = [
  { id: 'fav',      icon: HeartIcon,    label: 'Favourites' },
  { id: 'archived', icon: ArchiveIcon,  label: 'Archived' },
]
const NAV_CLIENTS = [
  { id: 'brands',   icon: BriefcaseIcon, label: 'Brand & Client Hub' },
]
const NAV_TOOLS = [
  { id: 'planner',    icon: ContentPlannerIcon,  label: 'Content Planner'   },
  { id: 'creator',   icon: CreatorStudioIcon,   label: 'Creator Studio'    },
  { id: 'compliance', icon: ComplianceGuardIcon, label: 'Compliance Guard'  },
]

export default function Sidebar({ activeNav, setActiveNav, onLogout, userEmail }) {
  const initials = userEmail
    ? userEmail.split('@')[0].slice(0, 2).toUpperCase()
    : 'SB'

  const displayName = userEmail
    ? userEmail.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    : 'Subasri B'

  return (
    <aside className={styles.sidebar}>
      {/* Brand — click to go to All Campaigns */}
      <div
        className={styles.brand}
        onClick={() => setActiveNav('campaigns')}
        title="Go to All Campaigns"
        style={{ cursor: 'pointer', userSelect: 'none' }}
      >
        <div className={styles.brandIcon}><BoltIcon /></div>
        <span className={styles.brandName}>Socialyze</span>
      </div>

      {/* Workspace */}
      <span className={styles.sectionLabel}>Workspace</span>
      {NAV_WORKSPACE.map(({ id, icon: Icon, label }) => (
        <div
          key={id}
          className={`${styles.navItem} ${activeNav === id ? styles.active : ''}`}
          onClick={() => setActiveNav(id)}
        >
          <span className={styles.navIcon}><Icon /></span>
          {label}
        </div>
      ))}

      {/* Library */}
      <span className={styles.sectionLabel}>Library</span>
      {NAV_LIBRARY.map(({ id, icon: Icon, label }) => (
        <div key={id} className={`${styles.navItem} ${activeNav === id ? styles.active : ''}`} onClick={() => setActiveNav(id)}>
          <span className={styles.navIcon}><Icon /></span>
          {label}
        </div>
      ))}

      {/* Clients */}
      <span className={styles.sectionLabel}>Clients</span>
      {NAV_CLIENTS.map(({ id, icon: Icon, label }) => (
        <div key={id} className={`${styles.navItem} ${activeNav === id ? styles.active : ''}`} onClick={() => setActiveNav(id)}>
          <span className={styles.navIcon}><Icon /></span>
          {label}
        </div>
      ))}

      {/* Tools */}
      <span className={styles.sectionLabel}>Tools</span>
      {NAV_TOOLS.map(({ id, icon: Icon, label }) => (
        <div
          key={id}
          className={`${styles.navItem} ${activeNav === id ? (id === 'creator' ? styles.activeCreator : id === 'compliance' ? styles.activeCompliance : styles.active) : ''}`}
          onClick={() => setActiveNav(id)}
        >
          <span className={styles.navIcon}><Icon /></span>
          {label}
        </div>
      ))}

      <div className={styles.spacer} />

      {/* Logout button */}
      {onLogout && (
        <button className={styles.logoutBtn} onClick={onLogout} title="Sign out">
          <LogoutIcon />
          <span>Sign Out</span>
        </button>
      )}

      {/* User */}
      <div className={styles.user}>
        <div className={styles.avatar}>{initials}</div>
        <div className={styles.userInfo}>
          <div className={styles.userName}>{displayName}</div>
          <div className={styles.userRole}>Member</div>
        </div>
      </div>
    </aside>
  )
}

/* ── Inline SVG Icons ─────────────────────────── */
function BoltIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
    </svg>
  )
}
function GridIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>
  )
}
function ActivityIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
  )
}
function BookIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/>
    </svg>
  )
}
function ContentPlannerIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2"/>
      <line x1="3" y1="9" x2="21" y2="9"/>
      <line x1="9" y1="21" x2="9" y2="9"/>
    </svg>
  )
}
function ShareIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
    </svg>
  )
}
function HeartIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
    </svg>
  )
}
function ArchiveIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5" rx="1"/><line x1="10" y1="12" x2="14" y2="12"/>
    </svg>
  )
}
function LogoutIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
      <polyline points="16 17 21 12 16 7"/>
      <line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  )
}
function BriefcaseIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2"/>
      <path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/>
      <line x1="12" y1="12" x2="12" y2="12"/>
      <path d="M2 12h20"/>
    </svg>
  )
}
function CreatorStudioIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
    </svg>
  )
}
function ComplianceGuardIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2L4 5v6c0 5.25 3.5 10.15 8 11.35C16.5 21.15 20 16.25 20 11V5l-8-3z"/>
      <polyline points="9 12 11 14 15 10"/>
    </svg>
  )
}
