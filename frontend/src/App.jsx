import { useState, useEffect, lazy, Suspense } from 'react'
import { supabase } from './supabaseClient'

import Sidebar  from './components/Sidebar.jsx'
import Auth     from './components/Auth.jsx'
import styles   from './App.module.css'

// ── Lazy-loaded pages — each page's JS is only fetched when first visited ──
const Dashboard            = lazy(() => import('./components/Dashboard.jsx'))
const ActiveCampaignsPage  = lazy(() => import('./pages/ActiveCampaignsPage.jsx'))
const CampaignWorkspace    = lazy(() => import('./pages/CampaignWorkspace.jsx'))
const CampaignBriefPage    = lazy(() => import('./pages/CampaignBriefPage.jsx'))
const FavouritesPage       = lazy(() => import('./pages/FavouritesPage.jsx'))
const ArchivedPage         = lazy(() => import('./pages/ArchivedPage.jsx'))
const SharedWorkspacesPage = lazy(() => import('./pages/SharedWorkspacesPage.jsx'))
const TeamPage             = lazy(() => import('./pages/TeamPage.jsx'))
const ContentPlannerPage   = lazy(() => import('./pages/ContentPlannerPage.jsx'))
const BrandsPage           = lazy(() => import('./pages/BrandsPage.jsx'))
const CreatorStudioPage    = lazy(() => import('./pages/CreatorStudioPage.jsx'))
const ComplianceGuardPage  = lazy(() => import('./pages/ComplianceGuardPage.jsx'))

export default function App() {
  const [session,     setSession]     = useState(undefined) // undefined = not yet resolved
  const [activeNav,   setActiveNav]   = useState('campaigns')
  const [workspaceId, setWorkspaceId] = useState(null)

  useEffect(() => {
    // getSession() always resolves — even when logged out (returns null).
    // This is the reliable source of truth on every page load / server restart.
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s ?? null)
    })

    // onAuthStateChange handles live sign-in / sign-out / token refresh events
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  function openWorkspace(id) { setWorkspaceId(id) }
  function handleNav(id)     { setWorkspaceId(null); setActiveNav(id) }
  function handleBack()      { setWorkspaceId(null) }
  function handleLogout()    { supabase.auth.signOut() }
  function goToServices()    { setActiveNav('campaigns') }
  function goToBrief()       { setWorkspaceId(null); setActiveNav('brief') }

  // Still resolving auth — show spinner
  if (session === undefined) {
    return (
      <div className={styles.bootScreen}>
        <div className={styles.bootSpinner} />
      </div>
    )
  }

  // Not authenticated → sign-in page
  if (!session) return <Auth />

  // Authenticated → full app
  return (
    <div className={styles.app}>
      <Sidebar
        activeNav={activeNav}
        setActiveNav={handleNav}
        onLogout={handleLogout}
        userEmail={session.user?.email}
      />

      <Suspense fallback={<div className={styles.pageSpinner}><div className={styles.bootSpinner} /></div>}>
        {workspaceId ? (
          <CampaignWorkspace
            campaignId={workspaceId}
            onBack={handleBack}
          />
        ) : activeNav === 'brief' ? (
          <CampaignBriefPage onGoToServices={goToServices} />
        ) : activeNav === 'active' ? (
          <main className={styles.mainPad}>
            <ActiveCampaignsPage onOpenWorkspace={openWorkspace} />
          </main>
        ) : activeNav === 'planner' ? (
          <ContentPlannerPage />
        ) : activeNav === 'fav' ? (
          <main className={styles.mainPad}>
            <FavouritesPage onOpenWorkspace={openWorkspace} />
          </main>
        ) : activeNav === 'archived' ? (
          <main className={styles.mainPad}>
            <ArchivedPage onOpenWorkspace={openWorkspace} />
          </main>
        ) : activeNav === 'shared' ? (
          <main className={styles.mainPad}>
            <SharedWorkspacesPage onOpenWorkspace={openWorkspace} />
          </main>
        ) : activeNav === 'brands' ? (
          <main className={styles.mainPad}>
            <BrandsPage />
          </main>
        ) : activeNav === 'team' ? (
          <main className={styles.mainPad}>
            <TeamPage userEmail={session.user?.email} />
          </main>
        ) : activeNav === 'creator' ? (
          <main className={styles.mainPad}>
            <CreatorStudioPage />
          </main>
        ) : activeNav === 'compliance' ? (
          <main className={styles.mainPad}>
            <ComplianceGuardPage />
          </main>
        ) : (
          <Dashboard
            onOpenWorkspace={openWorkspace}
            onGoToBrief={goToBrief}
          />
        )}
      </Suspense>
    </div>
  )
}
