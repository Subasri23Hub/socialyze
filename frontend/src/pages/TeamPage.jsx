import styles from './PlaceholderPage.module.css'

export default function TeamPage({ userEmail }) {
  const displayName = userEmail
    ? userEmail.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    : 'You'
  const initials = userEmail
    ? userEmail.split('@')[0].slice(0, 2).toUpperCase()
    : 'ME'

  return (
    <div className={styles.page}>
      <div className={styles.pageHdr}>
        <h2 className={styles.pageTitle}>Team</h2>
        <p className={styles.pageSub}>Sourcesys Technologies — manage your workspace members.</p>
      </div>

      {/* Current user card */}
      <div className={styles.memberCard}>
        <div className={styles.avatar}>{initials}</div>
        <div className={styles.memberInfo}>
          <div className={styles.memberName}>{displayName}</div>
          <div className={styles.memberEmail}>{userEmail || ''}</div>
        </div>
        <span className={styles.roleBadge}>You · Member</span>
      </div>

      <div className={styles.comingSoonCard}>
        <div className={styles.iconWrap}>
          <UsersIcon />
        </div>
        <div className={styles.cardTitle}>Team Collaboration — Coming Soon</div>
        <div className={styles.cardDesc}>
          Grow your workspace into a full team environment. Invite colleagues, assign roles,
          and track who generated what — all within one shared CampaignAI workspace.
        </div>
        <div className={styles.featureList}>
          {[
            '👤  Invite team members by email',
            '🔐  Role-based access: Admin / Editor / Viewer',
            '📊  Per-member activity and output stats',
            '🏷️  Campaign ownership and assignment',
            '📁  Shared brand briefs across the whole team',
          ].map((f, i) => (
            <div key={i} className={styles.featureItem}>{f}</div>
          ))}
        </div>
        <div className={styles.badge}>In Development</div>
      </div>
    </div>
  )
}

function UsersIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
    </svg>
  )
}
