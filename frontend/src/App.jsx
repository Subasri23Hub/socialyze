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
  const [session,     setSession]     = useState(undefined)
  const [activeNav,   setActiveNav]   = useState('campaigns')
  const [workspaceId, setWorkspaceId] = useState(null)

  useEffect(() => {
    // If Supabase redirected back with an OAuth error in the URL
    // (e.g. bad_oauth_state), strip it and show the login page cleanly.
    const params = new URLSearchParams(window.location.search)
    if (params.get('error')) {
      window.history.replaceState({}, '', '/')
      setSession(null)
      return
    }

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s ?? null)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  // FIX: Handle ?share=<campaignId> deep-link from invite emails.
  // When the recipient clicks "Open CampaignAI →" in their email they land on
  // https://socialyze-nu.vercel.app?share=<campaignId>
  // After they sign in, we read the param and open that workspace directly,
  // then strip the param from the URL so it doesn't re-trigger on refresh.
  useEffect(() => {
    if (!session) return   // wait until authenticated
    const params = new URLSearchParams(window.location.search)
    const shareId = params.get('share')
    if (shareId) {
      window.history.replaceState({}, '', '/')  // clean URL
      setActiveNav('shared')
      setWorkspaceId(shareId)
    }
  }, [session])  // runs once session is resolved (null → object)

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
