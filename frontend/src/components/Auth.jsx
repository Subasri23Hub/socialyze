import { useState } from 'react'
import { supabase } from '../supabaseClient'
import styles from './Auth.module.css'

export default function Auth() {
  const [tab,      setTab]      = useState('signin')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [info,     setInfo]     = useState('')

  function reset() { setError(''); setInfo('') }

  /* ── Email / Password Sign In ── */
  async function handleSignIn(e) {
    e.preventDefault()
    if (!email || !password) { setError('Please enter your email and password.'); return }
    reset(); setLoading(true)
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (err) setError(err.message)
  }

  /* ── Email / Password Sign Up ── */
  async function handleSignUp(e) {
    e.preventDefault()
    if (!email || !password) { setError('Please enter your email and password.'); return }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return }
    reset(); setLoading(true)
    const { error: err } = await supabase.auth.signUp({ email, password })
    setLoading(false)
    if (err) setError(err.message)
    else setInfo('Check your email for a confirmation link to activate your account.')
  }

  /* ── Google OAuth ── */
  async function handleGoogle() {
    reset(); setLoading(true)
    // redirectTo must match EXACTLY what you added in:
    // Supabase Dashboard → Authentication → URL Configuration → Redirect URLs
    // e.g. http://localhost:5173
    const redirectTo = window.location.origin
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        queryParams: {
          access_type: 'offline',
          prompt: 'select_account',  // always show the Google account picker
        },
      },
    })
    if (err) { setError(err.message); setLoading(false) }
  }

  /* ── Forgot Password ── */
  async function handleForgot() {
    if (!email) { setError('Enter your email above first, then click Forgot Password.'); return }
    reset(); setLoading(true)
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    })
    setLoading(false)
    if (err) setError(err.message)
    else setInfo('Password reset email sent — check your inbox.')
  }

  return (
    <div className={styles.page}>
      <div className={styles.blob1} />
      <div className={styles.blob2} />

      <div className={styles.card}>

        {/* ── LEFT PANEL ── */}
        <div className={styles.left}>
          <div className={styles.logoRow}>
            <div className={styles.logoIcon}><BoltIcon /></div>
            <span className={styles.logoName}>Socialyze</span>
          </div>

          <div className={styles.leftBody}>
            <div className={styles.welcomeBadge}>Welcome Back!</div>
            <h1 className={styles.headline}>Sign in to Your<br />Workspace</h1>
            <p className={styles.tagline}>
              Access your campaigns, track performance,<br />and collaborate with your team.
            </p>

            <div className={styles.featureList}>
              <Feature icon={<ChartIcon />}  title="Smart Analytics"    desc="Track and optimize performance" />
              <Feature icon={<TeamIcon />}   title="Team Collaboration" desc="Work together seamlessly" />
              <Feature icon={<ShieldIcon />} title="Secure & Reliable"  desc="Your data is protected" />
            </div>

            <div className={styles.chartPreview}>
              <svg width="100%" height="80" viewBox="0 0 220 80" fill="none" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3B6BF5" stopOpacity="0.18" />
                    <stop offset="100%" stopColor="#3B6BF5" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d="M0 60 L30 50 L65 55 L100 32 L135 42 L168 18 L200 28 L220 20 L220 80 L0 80 Z" fill="url(#chartFill)" />
                <polyline points="0,60 30,50 65,55 100,32 135,42 168,18 200,28 220,20" fill="none" stroke="#3B6BF5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="168" cy="18" r="4"   fill="#3B6BF5" />
                <circle cx="100" cy="32" r="3.5" fill="#3B6BF5" fillOpacity="0.6" />
                <circle cx="30"  cy="50" r="3"   fill="#3B6BF5" fillOpacity="0.4" />
                <rect x="145" y="48" width="12" height="32" rx="3" fill="#3B6BF5" fillOpacity="0.12" />
                <rect x="162" y="36" width="12" height="44" rx="3" fill="#3B6BF5" fillOpacity="0.12" />
                <rect x="179" y="42" width="12" height="38" rx="3" fill="#3B6BF5" fillOpacity="0.12" />
                <rect x="196" y="30" width="12" height="50" rx="3" fill="#3B6BF5" fillOpacity="0.12" />
              </svg>
            </div>
          </div>
        </div>

        {/* ── RIGHT PANEL ── */}
        <div className={styles.right}>

          {/* Tabs */}
          <div className={styles.tabs}>
            <button
              className={`${styles.tabBtn} ${tab === 'signin' ? styles.tabActive : ''}`}
              onClick={() => { setTab('signin'); reset() }}
            >Sign In</button>
            <button
              className={`${styles.tabBtn} ${tab === 'signup' ? styles.tabActive : ''}`}
              onClick={() => { setTab('signup'); reset() }}
            >Sign Up</button>
          </div>

          {/* Form */}
          <form className={styles.form} onSubmit={tab === 'signin' ? handleSignIn : handleSignUp}>

            <div className={styles.fieldGroup}>
              <label className={styles.label}>Email</label>
              <div className={styles.inputWrap}>
                <span className={styles.inputIcon}><MailIcon /></span>
                <input
                  className={styles.input}
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>
            </div>

            <div className={styles.fieldGroup}>
              <div className={styles.labelRow}>
                <label className={styles.label}>Password</label>
                {tab === 'signin' && (
                  <button type="button" className={styles.forgotLink} onClick={handleForgot}>
                    Forgot Password?
                  </button>
                )}
              </div>
              <div className={styles.inputWrap}>
                <span className={styles.inputIcon}><LockIcon /></span>
                <input
                  className={styles.input}
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete={tab === 'signin' ? 'current-password' : 'new-password'}
                />
              </div>
            </div>

            {error && <div className={styles.errorMsg}>{error}</div>}
            {info  && <div className={styles.infoMsg}>{info}</div>}

            <button type="submit" className={styles.primaryBtn} disabled={loading}>
              {loading
                ? <><span className={styles.btnSpinner} />{tab === 'signin' ? 'Signing in…' : 'Creating account…'}</>
                : tab === 'signin' ? 'Sign In' : 'Create Account'
              }
            </button>
          </form>

          {/* Divider */}
          <div className={styles.divider}>
            <span className={styles.dividerLine} />
            <span className={styles.dividerText}>or continue with</span>
            <span className={styles.dividerLine} />
          </div>

          {/* Google */}
          <button className={styles.googleBtn} onClick={handleGoogle} disabled={loading} type="button">
            <GoogleIcon />
            Continue with Google
          </button>

          {/* Switch hint */}
          <p className={styles.switchHint}>
            {tab === 'signin'
              ? <>Don't have an account?{' '}<button type="button" className={styles.switchLink} onClick={() => { setTab('signup'); reset() }}>Sign Up</button></>
              : <>Already have an account?{' '}<button type="button" className={styles.switchLink} onClick={() => { setTab('signin'); reset() }}>Sign In</button></>
            }
          </p>
        </div>
      </div>

      <p className={styles.footer}>© 2024 Socialyze. All rights reserved.</p>
    </div>
  )
}

/* ── Sub-component ── */
function Feature({ icon, title, desc }) {
  return (
    <div className={styles.feature}>
      <div className={styles.featureIcon}>{icon}</div>
      <div>
        <div className={styles.featureTitle}>{title}</div>
        <div className={styles.featureDesc}>{desc}</div>
      </div>
    </div>
  )
}

/* ── Icons ── */
function BoltIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  )
}
function MailIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9BA3BB" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" /><polyline points="2,4 12,13 22,4" />
    </svg>
  )
}
function LockIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9BA3BB" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
    </svg>
  )
}
function ChartIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3B6BF5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  )
}
function TeamIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3B6BF5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" />
    </svg>
  )
}
function ShieldIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3B6BF5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  )
}
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}
