import { useState, useEffect, useRef, Component } from 'react'
import { fetchCampaignWorkspace, saveCampaignOutputToShared, markShareAccepted } from '../lib/campaignService'
import GeneratePanel          from '../components/GeneratePanel.jsx'
import AudienceTargetingPanel from '../components/AudienceTargetingPanel.jsx'
import CampaignIdeationPanel  from '../components/CampaignIdeationPanel.jsx'
import CustomFlowPanel        from '../components/CustomFlowPanel.jsx'
import ExportPanel            from './ExportPanel.jsx'
import { supabase }           from '../lib/supabaseClient'
import styles from './CampaignWorkspace.module.css'

const OUTPUT_META = {
  post_generator: { label: 'AI Post Generator', icon: 'bolt',      color: '#3B6BF5', bg: '#EBF0FF' },
  audience:       { label: 'Audience Targeting', icon: 'users',     color: '#16A34A', bg: '#F0FDF4' },
  ideation:       { label: 'Campaign Ideation',  icon: 'lightbulb', color: '#EA580C', bg: '#FFF7ED' },
  custom_flow:    { label: 'Custom Flow',         icon: 'zap',       color: '#9333EA', bg: '#FDF4FF' },
}

const STATUS_COLOR = {
  Draft:       { bg: '#F1F5F9', color: '#475569' },
  Active:      { bg: '#DCFCE7', color: '#15803D' },
  'In Review': { bg: '#FEF9C3', color: '#A16207' },
  Paused:      { bg: '#FEF2F2', color: '#B91C1C' },
  Completed:   { bg: '#EFF9FF', color: '#0369A1' },
}

const PERSONA_ACCENTS = [
  { border: '#3B6BF5', bg: '#EBF0FF' },
  { border: '#16A34A', bg: '#F0FDF4' },
  { border: '#EA580C', bg: '#FFF7ED' },
]

const IDEATION_ACCENTS = [
  { accent: '#3B6BF5', bg: '#EBF0FF', border: '#BFDBFE', label: 'Safe but Smart' },
  { accent: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0', label: 'Crowd-Pleaser'  },
  { accent: '#EA580C', bg: '#FFF7ED', border: '#FED7AA', label: 'Bold Move'       },
  { accent: '#9333EA', bg: '#FDF4FF', border: '#E9D5FF', label: 'Brand-Defining'  },
  { accent: '#BE123C', bg: '#FFF1F2', border: '#FECDD3', label: '🔥 High Risk / High Reward' },
]

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function formatRelative(iso) {
  if (!iso) return '—'
  const diff = Math.floor((new Date() - new Date(iso)) / 1000)
  if (diff < 60)    return 'Just now'
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

/* ── Error Boundary ── */
class OutputErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { hasError: false, errorMsg: '' } }
  static getDerivedStateFromError(e) { return { hasError: true, errorMsg: e?.message || 'Unknown error' } }
  componentDidCatch(e, info) { console.error('[OutputErrorBoundary]', e, info) }
  render() {
    if (this.state.hasError) return (
      <div className={styles.fallbackBox}>
        <span className={styles.fallbackIcon}>⚠</span>
        <span className={styles.fallbackText}>Unable to display this output</span>
        <span className={styles.fallbackSub}>{this.state.errorMsg}</span>
      </div>
    )
    return this.props.children
  }
}

function normalisePlatformsMap(platforms) {
  if (!platforms) return {}
  if (Array.isArray(platforms)) {
    const map = {}
    for (const p of platforms) { if (p?.platform_name) map[p.platform_name] = { posts: p.posts || [] } }
    return map
  }
  if (typeof platforms === 'object') return platforms
  return {}
}

function safeData(raw) {
  if (!raw) return null
  if (typeof raw === 'string') { try { return JSON.parse(raw) } catch { return null } }
  return raw
}

export default function CampaignWorkspace({ campaignId, onBack }) {
  const [campaign, setCampaign] = useState(null)
  const [outputs,  setOutputs]  = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')
  const [expanded, setExpanded]     = useState({})
  const [activePanel, setActivePanel] = useState(null)
  const [showExport, setShowExport]   = useState(false)
  const realtimeRef = useRef(null)

  useEffect(() => { if (campaignId) load() }, [campaignId])

  // ── Real-time subscription ─────────────────────────────────────────
  // Subscribe to new outputs on this campaign so ALL edit-permission users
  // (and the owner) see each other's saves appear without a manual refresh.
  useEffect(() => {
    if (!campaignId || !supabase) return

    // Clean up any previous subscription first
    if (realtimeRef.current) {
      supabase.removeChannel(realtimeRef.current)
      realtimeRef.current = null
    }

    const channel = supabase
      .channel(`campaign_outputs:${campaignId}`)
      .on(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'campaign_outputs',
          filter: `campaign_id=eq.${campaignId}`,
        },
        (payload) => {
          // Append the new output to the top of the timeline
          // (outputs are displayed newest-first)
          setOutputs(prev => {
            // Guard against duplicate events
            if (prev.some(o => o.id === payload.new.id)) return prev
            return [payload.new, ...prev]
          })
        }
      )
      .subscribe()

    realtimeRef.current = channel

    return () => {
      if (realtimeRef.current) {
        supabase.removeChannel(realtimeRef.current)
        realtimeRef.current = null
      }
    }
  }, [campaignId])

  async function load(opts = {}) {
    setLoading(true)
    const { campaign: c, outputs: o, error: err } = await fetchCampaignWorkspace(campaignId)
    if (err) setError(err)
    else {
      setCampaign(c)
      // Only overwrite outputs on a full load (initial mount).
      // When called from handlePanelSaved we skip this so the realtime
      // subscription's optimistic append isn't wiped out by a stale fetch.
      if (!opts.headerOnly) setOutputs(o)
      if (c?._sharePermission) {
        markShareAccepted(campaignId).catch(console.warn)
      }
    }
    setLoading(false)
  }

  function toggle(id) { setExpanded(prev => ({ ...prev, [id]: !prev[id] })) }

  // Called by the generation panels when a new output is saved
  // (owner saves go through saveCampaignOutput; invitee saves go through
  //  saveCampaignOutputToShared.  Both write to the same campaign_id so
  //  the realtime subscription above will push the new row to everyone.)
  function handlePanelSaved() {
    setActivePanel(null)
    // Refresh only the campaign header (status, platforms, updated_at).
    // The realtime subscription already appended the new output row — calling
    // a full load() here would race against it and could wipe the new row.
    load({ headerOnly: true })
  }

  if (loading) return (
    <div className={styles.center}><div className={styles.spinner} /><span>Loading workspace…</span></div>
  )

  if (error || !campaign) return (
    <div className={styles.center}>
      <div className={styles.errorBox}>
        <span>⚠ {error || 'Campaign not found'}</span>
        <button className={styles.backBtn} onClick={onBack}>← Back</button>
      </div>
    </div>
  )

  const sc = STATUS_COLOR[campaign.status] || STATUS_COLOR.Draft
  const isEditMode  = campaign._sharePermission === 'edit'
  const isViewMode  = campaign._sharePermission === 'view'

  // ── When an edit-invitee opens a panel, we need to intercept the
  //   panel’s own “Save” so it writes to the shared campaign_id instead
  //   of creating a new campaign under the invitee’s account.
  //   We do this by providing a custom `onSaved` callback AND a prop
  //   `sharedCampaignId` that the panels will use when it is set.
  // The panels already call saveCampaignOutput(brandName, type, data, meta).
  // For edit invitees we pass `sharedCampaignId` so the panel skips the
  // brand-name lookup and calls saveCampaignOutputToShared instead.
  // (See GeneratePanel / AudienceTargetingPanel etc. — they already
  //  accept an optional `sharedCampaignId` prop added below.)

  return (
    <div className={styles.workspace}>
      <button className={styles.backLink} onClick={onBack}>← All Campaigns</button>

      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.campName}>
            {campaign.campaign_name.charAt(0).toUpperCase() + campaign.campaign_name.slice(1)}
            {isEditMode && (
              <span style={{
                marginLeft: 10, fontSize: 11, fontWeight: 700,
                background: '#FDF4FF', color: '#9333EA',
                border: '1px solid #E9D5FF', borderRadius: 6,
                padding: '2px 8px', verticalAlign: 'middle', letterSpacing: '0.04em',
              }}>
                ✦ Shared · Edit
              </span>
            )}
            {isViewMode && (
              <span style={{
                marginLeft: 10, fontSize: 11, fontWeight: 700,
                background: '#F0F9FF', color: '#0369A1',
                border: '1px solid #BAE6FD', borderRadius: 6,
                padding: '2px 8px', verticalAlign: 'middle', letterSpacing: '0.04em',
              }}>
                👁 Shared · View Only
              </span>
            )}
          </h1>
          <div className={styles.metaRow}>
            <span className={styles.statusPill} style={{ background: sc.bg, color: sc.color }}>{campaign.status}</span>
            {(campaign.platforms || []).map(p => <span key={p} className={styles.platPill}>{p}</span>)}
          </div>
          <div className={styles.metaRow} style={{ marginTop: 8 }}>
            <MetaItem icon="clock"    label={`Last updated: ${formatRelative(campaign.updated_at)}`} />
            <MetaItem icon="layers"   label={`${outputs.length} output${outputs.length !== 1 ? 's' : ''} generated`} />
            <MetaItem icon="calendar" label={`Created: ${formatDate(campaign.created_at)}`} />
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {outputs.length > 0 && (
          <button
            className={styles.refreshBtn}
            onClick={() => setShowExport(true)}
            title="Export campaign report"
            style={{ width: 'auto', padding: '0 12px', gap: 6, fontSize: 12, fontWeight: 600, color: '#3B6BF5', display: 'flex', alignItems: 'center' }}
          >
            <DownloadIcon /> Export
          </button>
        )}
        <button className={styles.refreshBtn} onClick={load} title="Refresh"><RefreshIcon /></button>
      </div>
      </div>

      {/* ── Export modal ── */}
      {showExport && (
        <ExportPanel
          campaign={campaign}
          outputs={outputs}
          onClose={() => setShowExport(false)}
        />
      )}

      {/* ── View-mode: read-only notice ─────────────────────────────── */}
      {isViewMode && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: '#F0F9FF', border: '1.5px solid #BAE6FD',
          borderRadius: 10, padding: '10px 16px', marginBottom: 20,
          fontSize: 12.5, color: '#0369A1', fontWeight: 500,
        }}>
          <span style={{ fontSize: 16 }}>👁</span>
          <span>
            You have <strong>view-only access</strong> to this campaign. You can browse all saved outputs below.
            To generate new content, ask the campaign owner to upgrade your permission to <strong>Edit</strong>.
          </span>
        </div>
      )}

      {/* ── Edit-mode: show the 4 generation panels ───────────────────── */}
      {isEditMode && (
        <div style={{ marginBottom: 24 }}>
          {/* Panel launcher row — same style as Dashboard framework cards */}
          {!activePanel && (
            <>
              <div style={{
                fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
                textTransform: 'uppercase', color: '#9BA3BB', marginBottom: 10,
              }}>Generate for this campaign</div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {[
                  { id: 'ai',       label: 'AI Post Generator',  color: '#EBF0FF', stroke: '#3B6BF5' },
                  { id: 'audience', label: 'Audience Targeting', color: '#F0FDF4', stroke: '#16A34A' },
                  { id: 'ideas',    label: 'Campaign Ideation',  color: '#FFF7ED', stroke: '#EA580C' },
                  { id: 'custom',   label: 'Custom Flow',        color: '#FDF4FF', stroke: '#9333EA' },
                ].map(fw => (
                  <button
                    key={fw.id}
                    onClick={() => setActivePanel(fw.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 7,
                      background: fw.color, border: `1.5px solid ${fw.stroke}22`,
                      borderRadius: 10, padding: '8px 14px',
                      fontSize: 12.5, fontWeight: 600, color: fw.stroke,
                      cursor: 'pointer', transition: 'opacity 0.15s',
                    }}
                  >
                    {fw.label}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Render the chosen panel */}
          {activePanel === 'ai' && (
            <GeneratePanel
              onClose={() => setActivePanel(null)}
              onSaved={handlePanelSaved}
              onNoBrief={() => setActivePanel(null)}
              sharedCampaignId={campaignId}
              prefillBrand={campaign.campaign_name}
            />
          )}
          {activePanel === 'audience' && (
            <AudienceTargetingPanel
              onClose={() => setActivePanel(null)}
              onSaved={handlePanelSaved}
              onNoBrief={() => setActivePanel(null)}
              sharedCampaignId={campaignId}
              prefillBrand={campaign.campaign_name}
            />
          )}
          {activePanel === 'ideas' && (
            <CampaignIdeationPanel
              onClose={() => setActivePanel(null)}
              onSaved={handlePanelSaved}
              onNoBrief={() => setActivePanel(null)}
              sharedCampaignId={campaignId}
              prefillBrand={campaign.campaign_name}
            />
          )}
          {activePanel === 'custom' && (
            <CustomFlowPanel
              onClose={() => setActivePanel(null)}
              onSaved={handlePanelSaved}
              onNoBrief={() => setActivePanel(null)}
              sharedCampaignId={campaignId}
              prefillBrand={campaign.campaign_name}
            />
          )}
        </div>
      )}

      <div className={styles.timelineLabel}>
        <span>Output History</span>
        <span className={styles.timelineCount}>{outputs.length} items</span>
      </div>

      {outputs.length === 0 && (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>📭</div>
          <div className={styles.emptyTitle}>No outputs yet</div>
          <div className={styles.emptySub}>
            Use any of the 4 panels and enter "<strong>{campaign.campaign_name.charAt(0).toUpperCase() + campaign.campaign_name.slice(1)}</strong>" as the campaign name, then click Save.
          </div>
        </div>
      )}

      <div className={styles.timeline}>
        {outputs.map((output, idx) => {
          const meta       = OUTPUT_META[output.output_type] || OUTPUT_META.post_generator
          const isOpen     = !!expanded[output.id]
          const parsedData = safeData(output.generated_data)
          return (
            <div key={output.id} className={styles.timelineItem}>
              <div className={styles.timelineDotCol}>
                <div className={styles.timelineDot} style={{ background: meta.bg, border: `2px solid ${meta.color}` }}>
                  <OutputIcon id={meta.icon} color={meta.color} />
                </div>
                {idx < outputs.length - 1 && <div className={styles.timelineLine} />}
              </div>
              <div className={`${styles.outputCard} ${isOpen ? styles.outputCardOpen : ''}`}>
                <div className={styles.cardHdr} onClick={() => toggle(output.id)}>
                  <div className={styles.cardHdrLeft}>
                    <span className={styles.typeBadge} style={{ background: meta.bg, color: meta.color }}>
                      <OutputIcon id={meta.icon} color={meta.color} size={11} />
                      {meta.label}
                    </span>
                    <span className={styles.cardTime}>{formatDate(output.created_at)}</span>
                  </div>
                  <div className={styles.cardToggle} style={{ color: meta.color }}>
                    {isOpen ? <ChevronUpIcon /> : <ChevronDownIcon />}
                  </div>
                </div>
                {isOpen && (
                  <div className={styles.cardBody}>
                    <OutputErrorBoundary key={output.id}>
                      <OutputContent type={output.output_type} data={parsedData} />
                    </OutputErrorBoundary>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ── Output router ── */
function OutputContent({ type, data }) {
  if (!data) return <div className={styles.noData}>No data available for this output.</div>
  try {
    switch (type) {
      case 'post_generator': return <PostGeneratorOutput data={data} />
      case 'audience':       return <AudienceOutput      data={data} />
      case 'ideation':       return <IdeationOutput      data={data} />
      case 'custom_flow':    return <CustomFlowOutput    data={data} />
      default:               return <pre className={styles.rawJson}>{JSON.stringify(data, null, 2)}</pre>
    }
  } catch (err) {
    console.error('[OutputContent]', err)
    return <div className={styles.fallbackBox}><span className={styles.fallbackIcon}>⚠</span><span className={styles.fallbackText}>Unable to display this output</span></div>
  }
}

/* ── AI Post Generator ── */
function PostGeneratorOutput({ data }) {
  const platformsMap = normalisePlatformsMap(data?.platforms)
  const platforms    = Object.keys(platformsMap)
  const [activeTab, setActiveTab] = useState(() => platforms[0] || null)

  useEffect(() => {
    if (platforms.length > 0 && !activeTab) setActiveTab(platforms[0])
  }, [platforms.length])

  return (
    <div>
      {data?.campaign_summary && <Section title="Campaign Summary"><p className={styles.prose}>{data.campaign_summary}</p></Section>}
      {data?.audience_insight  && <Section title="Audience Insight"><p className={styles.prose}>{data.audience_insight}</p></Section>}
      {(data?.kpis || []).length > 0 && (
        <Section title="KPIs">
          <div className={styles.chipRow}>{data.kpis.map((k, i) => <span key={i} className={styles.chip}>{k}</span>)}</div>
        </Section>
      )}
      {platforms.length > 0 && (
        <Section title="Posts by Platform">
          <div className={styles.tabRow}>
            {platforms.map(p => (
              <button key={p} className={`${styles.tab} ${activeTab === p ? styles.tabActive : ''}`} onClick={() => setActiveTab(p)}>{p}</button>
            ))}
          </div>
          {activeTab && (platformsMap[activeTab]?.posts || []).map((post, i) => (
            <div key={i} className={styles.postCard}>
              <div className={styles.postNum}>Variation {i + 1} · {post?.content_type || 'Post'}</div>
              {post?.hook && <div className={styles.postHook}><span className={styles.hookLabel}>HOOK</span><span className={styles.hookText}>{post.hook}</span></div>}
              <p className={styles.postCaption}>{post?.caption || ''}</p>
              {(post?.hashtags || []).length > 0 && <div className={styles.hashRow}>{post.hashtags.map((h, j) => <span key={j} className={styles.hashTag}>{h}</span>)}</div>}
              <div className={styles.postMeta}>
                {post?.cta       && <span>📣 {post.cta}</span>}
                {post?.best_time && <span>🕐 Best time: {post.best_time}</span>}
              </div>
            </div>
          ))}
        </Section>
      )}
      {(data?.campaign_ideas || []).length > 0 && (
        <Section title="Campaign Ideas">
          {data.campaign_ideas.map((idea, i) => (
            <div key={i} className={styles.ideaCard}>
              <div className={styles.ideaTitle}>{idea?.title || idea?.idea_title || ''}</div>
              <div className={styles.ideaDesc}>{idea?.description || idea?.big_idea || ''}</div>
              {idea?.expected_impact && <div className={styles.ideaImpact}>📈 {idea.expected_impact}</div>}
            </div>
          ))}
        </Section>
      )}
    </div>
  )
}

/* ── Audience Targeting ── */
function AudienceOutput({ data }) {
  const personas = data?.personas || []
  if (personas.length === 0) return <div className={styles.noData}>No persona data found.</div>

  const isNewSchema = personas[0] && ('behavior' in personas[0] || 'hook' in personas[0])

  return (
    <div>
      <Section title="Audience Personas">
        <div className={styles.personaGrid}>
          {personas.map((p, i) => {
            const acc = PERSONA_ACCENTS[i % PERSONA_ACCENTS.length]
            return isNewSchema
              ? <NewPersonaCard key={i} p={p} acc={acc} />
              : <OldPersonaCard key={i} p={p} acc={acc} />
          })}
        </div>
      </Section>
      {data?.audience_overlap_matrix && (
        <Section title="Audience Overlap Insight"><p className={styles.prose}>{data.audience_overlap_matrix}</p></Section>
      )}
      {(data?.channel_priority || []).length > 0 && (
        <Section title="Channel Priority">
          <div className={styles.chipRow}>
            {data.channel_priority.map((ch, i) => (
              <span key={i} className={styles.chip}>{ch?.platform || ch}{ch?.priority ? ` · ${ch.priority}` : ''}</span>
            ))}
          </div>
        </Section>
      )}
      {(data?.cultural_moments || []).length > 0 && (
        <Section title="Cultural Moments to Tap">
          {data.cultural_moments.map((m, i) => (
            <div key={i} className={styles.ideaCard}><div className={styles.ideaDesc}>🎯 {m}</div></div>
          ))}
        </Section>
      )}
    </div>
  )
}

function NewPersonaCard({ p, acc }) {
  const avatarLetter = (p.identity_label || p.persona_name || 'P')
    .replace(/^(Persona\s*\d+\s*[—–\-]?\s*|The\s+)/i, '').charAt(0).toUpperCase()
  return (
    <div className={styles.personaCard} style={{ borderTopColor: acc.border }}>
      <div className={styles.personaHdr}>
        <div className={styles.personaAvatar} style={{ background: acc.bg, color: acc.border }}>{avatarLetter}</div>
        <div>
          <div className={styles.personaName}>{p.persona_name}</div>
          {p.identity_label && p.identity_label !== p.persona_name && (
            <div className={styles.archetype} style={{ color: acc.border }}>{p.identity_label}</div>
          )}
        </div>
      </div>
      {p.behavior          && <InfoBlock label="📲 BEHAVIOR"           value={p.behavior} />}
      {p.mindset           && <InfoBlock label="🧠 MINDSET"            value={p.mindset} />}
      {p.pain_point        && <InfoBlock label="😤 PAIN POINT"         value={p.pain_point} />}
      {p.hook && (
        <div className={styles.messagingBlock} style={{ borderColor: acc.border, background: acc.bg }}>
          <div className={styles.infoLabel}>👉 HOOK THAT WORKS</div>
          <div className={styles.messagingText} style={{ color: acc.border }}>"{p.hook}"</div>
        </div>
      )}
      {p.best_content_style && <InfoBlock label="🎬 BEST CONTENT STYLE" value={p.best_content_style} />}
      {p.best_platform      && <InfoBlock label="👉 BEST PLATFORM"      value={p.best_platform} />}
    </div>
  )
}

function OldPersonaCard({ p, acc }) {
  const avatarLetter = (p.persona_name || 'P').replace(/^The\s+/i, '').charAt(0).toUpperCase()
  return (
    <div className={styles.personaCard} style={{ borderTopColor: acc.border }}>
      <div className={styles.personaHdr}>
        <div className={styles.personaAvatar} style={{ background: acc.bg, color: acc.border }}>{avatarLetter}</div>
        <div>
          <div className={styles.personaName}>{p.persona_name || 'Persona'}</div>
          {p.archetype && <div className={styles.archetype} style={{ color: acc.border }}>{p.archetype}</div>}
        </div>
      </div>
      {p.demographic_snapshot  && <InfoBlock label="WHO THEY ARE"        value={p.demographic_snapshot} />}
      {p.psychographic_profile && <InfoBlock label="MINDSET"             value={p.psychographic_profile} />}
      {p.trigger_moment        && <InfoBlock label="⚡ TRIGGER MOMENT"   value={p.trigger_moment} />}
      {p.emotional_driver && (
        <div className={styles.messagingBlock} style={{ borderColor: acc.border, background: acc.bg }}>
          <div className={styles.infoLabel}>🧠 EMOTIONAL DRIVER</div>
          <div className={styles.messagingText} style={{ color: acc.border }}>{p.emotional_driver}</div>
        </div>
      )}
      {p.scroll_behavior       && <InfoBlock label="📱 SCROLL BEHAVIOR"  value={p.scroll_behavior} />}
      {p.messaging_angle       && <InfoBlock label="💬 MESSAGING ANGLE"  value={`"${p.messaging_angle}"`} />}
      {p.content_they_engage   && <InfoBlock label="🎬 CONTENT STYLE"    value={p.content_they_engage} />}
      {p.best_platform         && <InfoBlock label="BEST PLATFORM"       value={p.best_platform} />}
      {p.buying_behaviour      && <InfoBlock label="🛒 HOW THEY BUY"     value={p.buying_behaviour} />}
      {p.objection_to_overcome && <InfoBlock label="🚧 OBJECTION"        value={p.objection_to_overcome} />}
      {p.sample_content_hook   && <InfoBlock label="✍️ SAMPLE HOOK"      value={p.sample_content_hook} />}
    </div>
  )
}

/* ── Campaign Ideation ── */
function IdeationOutput({ data }) {
  const ideas = data?.campaign_ideas || []
  if (ideas.length === 0) return <div className={styles.noData}>No campaign ideas found.</div>

  return (
    <div style={{ marginTop: 14 }}>
      {ideas.map((idea, i) => {
        const c = IDEATION_ACCENTS[i % IDEATION_ACCENTS.length]
        return (
          <div
            key={i}
            style={{ background: c.bg, border: `1.5px solid ${c.border}`, borderRadius: 12, marginBottom: 10 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: c.accent, background: '#fff', padding: '2px 8px', borderRadius: 6, border: `1px solid ${c.border}`, flexShrink: 0 }}>
                #{i + 1}
              </span>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#0D0F1A', flex: 1 }}>
                {idea?.idea_title || idea?.title || `Idea ${i + 1}`}
              </span>
              <span style={{ fontSize: 10.5, fontWeight: 600, color: c.accent }}>{c.label}</span>
            </div>

            {idea?.tagline && (
              <div style={{ paddingLeft: 14, paddingRight: 14, paddingBottom: 10, fontSize: 12, fontStyle: 'italic', color: c.accent }}>
                "{idea.tagline}"
              </div>
            )}

            {(idea?.big_idea || idea?.cultural_hook || idea?.platform_execution || idea?.sample_post || idea?.viral_mechanism || idea?.influencer_strategy || idea?.success_metric || idea?.why_it_wins || (Array.isArray(idea?.hashtag_breakdown) && idea.hashtag_breakdown.length > 0)) && (
            <div style={{ padding: '12px 14px', borderTop: `1px solid ${c.border}` }}>
              {idea?.big_idea && <IdeaSection label="The Big Idea" text={idea.big_idea} accent={c.accent} />}
              {idea?.cultural_hook && <IdeaSection label="🎯 Cultural Hook" text={idea.cultural_hook} accent={c.accent} />}
              {idea?.platform_execution && <IdeaSection label="📱 Platform Execution" text={idea.platform_execution} accent={c.accent} />}

              {idea?.sample_post && (
                <div style={{ background: '#fff', border: `1.5px solid ${c.border}`, borderRadius: 10, padding: '12px 14px', marginBottom: 10 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: '#9BA3BB', marginBottom: 6 }}>
                    📱 Launch Post — Ready to Publish
                  </div>
                  <div style={{ fontSize: 12.5, color: '#5A607A', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{idea.sample_post}</div>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                {idea?.viral_mechanism && <IdeaSection label="⚡ Viral Mechanism" text={idea.viral_mechanism} accent={c.accent} />}
                {idea?.influencer_strategy && <IdeaSection label="🤝 Influencer Strategy" text={idea.influencer_strategy} accent={c.accent} />}
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                {idea?.success_metric && (
                  <div style={{ fontSize: 11.5, fontWeight: 600, color: c.accent, background: c.bg, border: `1px solid ${c.border}`, borderRadius: 20, padding: '5px 12px' }}>
                    📊 {idea.success_metric}
                  </div>
                )}
                {idea?.why_it_wins && (
                  <div style={{ fontSize: 12, color: '#15803D', background: '#F0FDF4', borderRadius: 8, padding: '6px 12px' }}>
                    🏆 {idea.why_it_wins}
                  </div>
                )}
              </div>

              {Array.isArray(idea?.hashtag_breakdown) && idea.hashtag_breakdown.length > 0 && (
                <div style={{ border: `1.5px solid ${c.border}`, borderRadius: 12, padding: '14px 16px', background: 'rgba(255,255,255,0.75)', marginTop: 10 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: '#9BA3BB', marginBottom: 10 }}>
                    🏷️ Hashtag Breakdown
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {idea.hashtag_breakdown.map((h, li) => (
                      <div key={li} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                          <span style={{ fontSize: 11.5, fontWeight: 700, padding: '3px 10px', borderRadius: 20, whiteSpace: 'nowrap', flexShrink: 0, background: c.bg, color: c.accent, border: `1px solid ${c.border}`, marginTop: 1 }}>
                            {h.tag}
                          </span>
                          <span style={{ fontSize: 12.5, color: '#374151', lineHeight: 1.6 }}>{h.explanation}</span>
                        </div>
                        {h.when_to_post && (
                          <div style={{ borderLeft: `3px solid ${c.accent}`, paddingLeft: 10, paddingTop: 5, paddingBottom: 5, background: 'rgba(255,255,255,0.85)', borderRadius: '0 6px 6px 0', marginLeft: 4 }}>
                            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: c.accent, marginBottom: 3 }}>🗓️ When &amp; How to Post</div>
                            <div style={{ fontSize: 12, color: '#1E293B', lineHeight: 1.6, fontWeight: 500 }}>{h.when_to_post}</div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function IdeaSection({ label, text, accent }) {
  if (!text) return null
  return (
    <div style={{ borderLeft: `3px solid ${accent}`, borderRadius: 6, paddingLeft: 10, paddingTop: 4, paddingBottom: 4, marginBottom: 10 }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: '#9BA3BB', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 12.5, color: '#5A607A', lineHeight: 1.55 }}>{text}</div>
    </div>
  )
}

/* ── Custom Flow ── */
function CustomFlowOutput({ data }) {
  const [openWeeks, setOpenWeeks] = useState({})
  function toggleWeek(i) { setOpenWeeks(prev => ({ ...prev, [i]: !prev[i] })) }

  return (
    <div>
      {data?.campaign_name         && <Section title="Campaign Name"><p className={styles.prose}><strong>{data.campaign_name}</strong></p></Section>}
      {data?.campaign_summary      && <Section title="Campaign Summary"><p className={styles.prose}>{data.campaign_summary}</p></Section>}
      {data?.positioning_statement && <Section title="Positioning Statement"><p className={styles.prose}>{data.positioning_statement}</p></Section>}
      {data?.brand_voice_guide     && <Section title="Brand Voice"><p className={styles.prose}>{data.brand_voice_guide}</p></Section>}

      {(data?.content_pillars || []).length > 0 && (
        <Section title="Content Pillars">
          <div className={styles.pillarsGrid}>
            {data.content_pillars.map((p, i) => {
              const name = typeof p === 'string' ? p : (p?.name || `Pillar ${i + 1}`)
              const desc = typeof p === 'object' ? (p?.description || '') : ''
              const ex   = typeof p === 'object' ? (p?.example || '') : ''
              return (
                <div key={i} className={styles.pillarCard}>
                  <span className={styles.pillarNum}>Pillar {i + 1}</span>
                  <span className={styles.pillarText}>{name}</span>
                  {desc && <p className={styles.prose} style={{ marginTop: 4, fontSize: '0.8rem' }}>{desc}</p>}
                  {ex   && <p className={styles.prose} style={{ marginTop: 2, fontSize: '0.75rem', opacity: 0.7 }}>→ {ex}</p>}
                </div>
              )
            })}
          </div>
        </Section>
      )}

      {(data?.platform_strategy || []).length > 0 && (
        <Section title="Platform Strategy">
          {data.platform_strategy.map((ps, i) => (
            <div key={i} className={styles.stratCard}>
              <span className={styles.stratPlat}>{ps?.platform || `Platform ${i + 1}`}</span>
              <span className={styles.stratText}>{ps?.strategy || ''}</span>
              {ps?.frequency && <span className={styles.stratText} style={{ opacity: 0.7, fontSize: '0.8rem' }}>Frequency: {ps.frequency}</span>}
              {ps?.formats   && <span className={styles.stratText} style={{ opacity: 0.7, fontSize: '0.8rem' }}>Formats: {ps.formats}</span>}
            </div>
          ))}
        </Section>
      )}

      {(data?.posting_plan || []).length > 0 && (
        <Section title="Posting Plan">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {data.posting_plan.map((w, i) => {
              const isOpen = !!openWeeks[i]
              return (
                <div key={i} style={{ border: '1.5px solid rgba(147,51,234,0.18)', borderRadius: 12, overflow: 'hidden', background: '#fff' }}>
                  {/* Accordion header — always visible */}
                  <div
                    onClick={() => toggleWeek(i)}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 14px', cursor: 'pointer', background: isOpen ? '#FDF4FF' : '#fff', transition: 'background 0.15s', userSelect: 'none' }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#9333EA' }}>
                        {w?.week || `Week ${i + 1}`}{w?.theme ? ` — ${w.theme.toUpperCase()}` : ''}
                      </div>
                      {w?.goal && (
                        <div style={{ fontSize: 12.5, fontWeight: 600, color: '#0D0F1A', lineHeight: 1.4, paddingRight: 12 }}>{w.goal}</div>
                      )}
                    </div>
                    <span style={{ fontSize: 14, color: '#9333EA', flexShrink: 0, marginLeft: 8 }}>{isOpen ? '▲' : '▼'}</span>
                  </div>

                  {/* Accordion body — visible when open */}
                  {isOpen && (
                    <div style={{ padding: '10px 14px 14px', borderTop: '1px solid rgba(147,51,234,0.12)' }}>

                      {(w?.content_plan || []).length > 0 && (
                        <div style={{ marginBottom: 10 }}>
                          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#9BA3BB', marginBottom: 6 }}>Content Plan</div>
                          {w.content_plan.map((item, j) => (
                            <div key={j} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, marginBottom: 5 }}>
                              <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#9333EA', flexShrink: 0, marginTop: 5 }} />
                              <span style={{ fontSize: 12, color: '#374151', lineHeight: 1.5 }}>{item}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {(w?.execution_tips || []).length > 0 && (
                        <div style={{ marginBottom: 10 }}>
                          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#9BA3BB', marginBottom: 6 }}>Execution Tips</div>
                          {w.execution_tips.map((tip, j) => (
                            <div key={j} style={{ fontSize: 12, color: '#EA580C', marginBottom: 4, lineHeight: 1.5 }}>⚡ {tip}</div>
                          ))}
                        </div>
                      )}

                      {/* fallback for old saved data */}
                      {!w?.content_plan && w?.post_types && <div className={styles.weekTypes}>{w.post_types}</div>}
                      {!w?.execution_tips && w?.sample_idea && <div style={{ fontSize: 12, marginTop: 4 }}>💡 {w.sample_idea}</div>}
                      {!w?.execution_tips && w?.tactical_note && <div style={{ fontSize: 12, marginTop: 4 }}>⚡ {w.tactical_note}</div>}

                      {w?.ai_insights && (
                        <div style={{ marginTop: 4, background: '#F0F4FF', borderRadius: 7, padding: '7px 10px', fontSize: 11.5, color: '#3B6BF5', lineHeight: 1.55 }}>
                          🧠 {w.ai_insights}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </Section>
      )}

      {(data?.sample_captions || []).length > 0 && (
        <Section title="Sample Captions">
          {data.sample_captions.map((cap, i) => {
            const text     = typeof cap === 'string' ? cap : (cap?.caption || '')
            const platform = typeof cap === 'object' ? (cap?.platform || '') : ''
            return (
              <div key={i} className={styles.captionCard}>
                <span className={styles.captionNum}>Caption {i + 1}{platform ? ` · ${platform}` : ''}</span>
                <p className={styles.prose}>{text}</p>
              </div>
            )
          })}
        </Section>
      )}

      {data?.hashtag_strategy ? (
        <Section title="Hashtag Strategy">
          {[['🏷 Brand', data.hashtag_strategy.brand_hashtags], ['📈 Trend', data.hashtag_strategy.trend_hashtags], ['🎯 Niche', data.hashtag_strategy.niche_hashtags]].map(([label, tags]) =>
            (tags || []).length > 0 && (
              <div key={label} style={{ marginBottom: 8 }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 600, marginBottom: 4 }}>{label}</div>
                <div className={styles.hashRow}>{tags.map((h, i) => <span key={i} className={styles.hashTag}>{h}</span>)}</div>
              </div>
            )
          )}
          <button className={styles.copyBtn} onClick={() => {
            const all = [...(data.hashtag_strategy.brand_hashtags||[]), ...(data.hashtag_strategy.trend_hashtags||[]), ...(data.hashtag_strategy.niche_hashtags||[])]
            navigator.clipboard.writeText(all.join(' '))
          }}>Copy all hashtags</button>
        </Section>
      ) : (data?.hashtags || []).length > 0 && (
        <Section title="Hashtags">
          <div className={styles.hashRow}>{data.hashtags.map((h, i) => <span key={i} className={styles.hashTag}>{h}</span>)}</div>
          <button className={styles.copyBtn} onClick={() => navigator.clipboard.writeText(data.hashtags.join(' '))}>Copy all hashtags</button>
        </Section>
      )}

      {(data?.calendar_hooks || []).length > 0 && (
        <Section title="Content Calendar Hooks">
          {data.calendar_hooks.map((hook, i) => {
            // Groq sometimes returns objects instead of plain strings.
            // Safely coerce to a string before rendering.
            const hookText = typeof hook === 'string'
              ? hook
              : (hook?.text || hook?.hook || hook?.content || hook?.idea || hook?.description || hook?.name || JSON.stringify(hook))
            return (
              <div key={i} className={styles.ideaCard}>
                <div className={styles.ideaDesc}>{i + 1}. {hookText}</div>
              </div>
            )
          })}
        </Section>
      )}
    </div>
  )
}

/* ── Shared helpers ── */
function Section({ title, children }) {
  return <div className={styles.section}><div className={styles.sectionTitle}>{title}</div>{children}</div>
}

function InfoBlock({ label, value }) {
  if (!value) return null
  return (
    <div className={styles.infoBlock}>
      <div className={styles.infoLabel}>{label}</div>
      <div className={styles.infoValue}>{value}</div>
    </div>
  )
}

function MetaItem({ icon, label }) {
  return <span className={styles.metaItem}><MetaIcon id={icon} />{label}</span>
}

/* ── SVG Icons ── */
function OutputIcon({ id, color, size = 13 }) {
  const p = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: '2', strokeLinecap: 'round', strokeLinejoin: 'round' }
  if (id === 'bolt')      return <svg {...p}><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
  if (id === 'users')     return <svg {...p}><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
  if (id === 'lightbulb') return <svg {...p}><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
  return <svg {...p}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
}

function MetaIcon({ id }) {
  const p = { width: 12, height: 12, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2', strokeLinecap: 'round', strokeLinejoin: 'round' }
  if (id === 'clock')    return <svg {...p}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
  if (id === 'layers')   return <svg {...p}><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
  if (id === 'calendar') return <svg {...p}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
  return null
}

function RefreshIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>
}
function DownloadIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
}
function ChevronDownIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
}
function ChevronUpIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
}
