import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { fetchCampaignBrief } from '../lib/campaignService'
import styles from './CreatorStudioPage.module.css'

// ── Tab definitions per content format ────────────────────────────────────────
// The first tab is the "script" tab — its label/id changes based on what was generated
const BASE_TABS = [
  { id: 'editing',  label: '☆ Editing Steps' },
  { id: 'canva',    label: '☆ Canva Layout'  },
  { id: 'thumb',    label: '☆ Thumbnail'     },
  { id: 'mistakes', label: '☆ Mistakes'      },
]

function getScriptTab(format) {
  switch (format) {
    case 'carousel': return { id: 'script', label: '☆ Carousel Slides' }
    case 'photo':    return { id: 'script', label: '☆ Photo Post'       }
    case 'story':    return { id: 'script', label: '☆ Story Frames'     }
    case 'thread':   return { id: 'script', label: '☆ Tweet Thread'     }
    default:         return { id: 'script', label: '☆ Reel Script'      }
  }
}

const OUTPUT_TYPE_LABELS = {
  post_generator: 'AI Post Generator',
  ideation:       'Campaign Ideation',
  audience:       'Audience Targeting',
  custom_flow:    'Custom Flow',
}

// ─────────────────────────────────────────────────────────────
// Fetch full campaign + all its saved outputs from Supabase
// ─────────────────────────────────────────────────────────────
async function fetchCampaignContext(campaignId) {
  try {
    const { data: campaign, error: cErr } = await supabase
      .from('campaigns')
      .select('id, campaign_name, status, platforms, tone')
      .eq('id', campaignId)
      .maybeSingle()
    if (cErr || !campaign) return null

    const { data: outputs } = await supabase
      .from('campaign_outputs')
      .select('output_type, generated_data, created_at')
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: false })

    return { campaign, outputs: outputs || [] }
  } catch { return null }
}

// ─────────────────────────────────────────────────────────────
// Extract structured brand fields from all past outputs + brief.
// Everything goes into the ctx object sent to the backend.
// ─────────────────────────────────────────────────────────────
function extractBrandContext(campaignCtx, brief, contentHint) {
  const { campaign, outputs } = campaignCtx

  const ctx = {
    campaignName:   campaign.campaign_name || '',
    platforms:      campaign.platforms     || [],
    tone:           campaign.tone          || '',
    contentHint:    contentHint            || '',
    tagline:        '',
    campaignGoal:   '',
    targetAudience: '',
    brandVoice:     '',
    bigIdea:        '',
    sampleCaptions: [],
    productService: '',
    keyMessage:     '',
  }

  // Campaign Brief overlays — highest-quality manual data
  if (brief) {
    if (brief.brand_name)      ctx.campaignName   = ctx.campaignName   || brief.brand_name
    if (brief.product_service) ctx.productService = brief.product_service
    if (brief.campaign_goal)   ctx.campaignGoal   = brief.campaign_goal
    if (brief.target_audience) ctx.targetAudience = brief.target_audience
    if (brief.tone)            ctx.tone           = ctx.tone || brief.tone
    if (brief.platforms?.length && !ctx.platforms?.length) ctx.platforms = brief.platforms
  }

  // Pull data from each saved output type — most recent first
  for (const out of outputs) {
    const d = out.generated_data
    if (!d) continue

    if (out.output_type === 'post_generator') {
      if (!ctx.tagline     && d.campaign_tagline)   ctx.tagline     = d.campaign_tagline
      if (!ctx.brandVoice  && d.brand_voice_guide)  ctx.brandVoice  = d.brand_voice_guide
      if (!ctx.targetAudience && d.audience_insight) ctx.targetAudience = d.audience_insight
      const platData = d.platforms || {}
      for (const platKey of Object.keys(platData)) {
        const posts = platData[platKey]?.posts || []
        for (const post of posts.slice(0, 2)) {
          if (post.caption) ctx.sampleCaptions.push(post.caption.slice(0, 300))
          if (post.hook && !ctx.keyMessage) ctx.keyMessage = post.hook
        }
      }
    }

    if (out.output_type === 'ideation') {
      const ideas = d.campaign_ideas || []
      const best  = ideas[0]
      if (best) {
        if (!ctx.tagline && best.tagline)  ctx.tagline = best.tagline
        if (!ctx.bigIdea && best.big_idea) ctx.bigIdea = best.big_idea
        if (best.sample_post) ctx.sampleCaptions.push(best.sample_post.slice(0, 300))
      }
    }

    if (out.output_type === 'audience') {
      const personas = d.personas || []
      if (personas[0] && !ctx.targetAudience) {
        ctx.targetAudience = personas[0].identity_label || personas[0].persona_name || ''
      }
      for (const p of personas.slice(0, 2)) {
        if (p.hook) ctx.sampleCaptions.push(p.hook)
      }
    }

    if (out.output_type === 'custom_flow') {
      if (!ctx.campaignGoal && d.campaign_summary)      ctx.campaignGoal = d.campaign_summary.slice(0, 200)
      if (!ctx.tagline      && d.positioning_statement) ctx.tagline      = d.positioning_statement.slice(0, 120)
      if (!ctx.brandVoice   && d.brand_voice_guide)     ctx.brandVoice   = d.brand_voice_guide
      const captions = d.sample_captions || []
      for (const c of captions.slice(0, 3)) {
        const text = typeof c === 'string' ? c : c.caption || ''
        if (text) ctx.sampleCaptions.push(text.slice(0, 300))
      }
    }
  }

  ctx.sampleCaptions = [...new Set(ctx.sampleCaptions)].slice(0, 5)
  return ctx
}

// ─────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────
export default function CreatorStudioPage() {
  const [campaigns,        setCampaigns]        = useState([])
  const [campaignsLoading, setCampaignsLoading] = useState(false)
  const [selectedCampaign, setSelectedCampaign] = useState('')
  const [campaignCtx,      setCampaignCtx]      = useState(null)
  const [ctxLoading,       setCtxLoading]       = useState(false)
  const [contentHint,      setContentHint]      = useState('')
  const [loading,          setLoading]          = useState(false)
  const [result,           setResult]           = useState(null)
  const [error,            setError]            = useState('')
  const [copied,           setCopied]           = useState({})
  const [activeTab,        setActiveTab]        = useState('script')
  const [usedCtx,          setUsedCtx]          = useState(null)

  useEffect(() => { if (supabase) fetchCampaigns() }, [])

  async function fetchCampaigns() {
    setCampaignsLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data, error: err } = await supabase
        .from('campaigns')
        .select('id, campaign_name, status, platforms, tone')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
      if (!err && data) setCampaigns(data)
    } catch (e) { console.error('[CreatorStudio] fetchCampaigns:', e) }
    finally { setCampaignsLoading(false) }
  }

  useEffect(() => {
    if (!selectedCampaign) { setCampaignCtx(null); return }
    setCtxLoading(true)
    fetchCampaignContext(selectedCampaign).then(ctx => {
      setCampaignCtx(ctx)
      setCtxLoading(false)
    })
  }, [selectedCampaign])

  async function generate() {
    if (!selectedCampaign) { setError('Please select a campaign first.'); return }
    if (!campaignCtx)      { setError('Campaign data is still loading — please wait a moment and try again.'); return }

    setError(''); setResult(null); setLoading(true); setActiveTab('script')

    try {
      const { brief } = await fetchCampaignBrief()
      const matchedBrief = brief && (
        !brief.brand_name ||
        brief.brand_name.trim().toLowerCase() === campaignCtx.campaign.campaign_name.trim().toLowerCase()
      ) ? brief : null

      const ctx = extractBrandContext(campaignCtx, matchedBrief, contentHint)
      setUsedCtx(ctx)

      const res = await fetch('/creator-studio', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ ctx }),
      })

      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        throw new Error(e?.error || `Server error (HTTP ${res.status})`)
      }

      const parsed = await res.json()

      // Validate we got something meaningful back for the detected format.
      // The backend always returns a stub reelScript for non-reel formats,
      // so we MUST check the format-specific key first — not reelScript.
      const fmt = parsed?.contentFormat || 'reel'
      const hasContent = (
        (fmt === 'carousel' && parsed?.carouselSlides?.some(s => s.headline)) ||
        (fmt === 'photo'    && (parsed?.photoPost?.imageDirection || parsed?.photoPost?.textOverlay)) ||
        (fmt === 'story'    && parsed?.storyFrames?.some(f => f.onScreenText)) ||
        (fmt === 'thread'   && parsed?.twitterThread?.some(t => t.text)) ||
        // reel / short — check the actual script content
        ((fmt === 'reel' || fmt === 'short') && parsed?.reelScript?.hook?.action)
      )
      if (!hasContent) throw new Error('Could not parse AI response. Please try again.')
      setResult(parsed)
    } catch (e) {
      console.error('[CreatorStudio] generate error:', e)
      setError(e.message || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  function copy(text, key) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(p => ({ ...p, [key]: true }))
      setTimeout(() => setCopied(p => ({ ...p, [key]: false })), 1500)
    })
  }

  const selectedCampaignObj = campaigns.find(c => c.id === selectedCampaign)
  const outputCount  = campaignCtx?.outputs?.length || 0
  const outputTypes  = campaignCtx ? [...new Set(campaignCtx.outputs.map(o => o.output_type))] : []
  const resultFormat = result?.contentFormat || 'reel'
  const scriptTab    = getScriptTab(resultFormat)
  const allTabs      = [scriptTab, ...BASE_TABS]

  return (
    <div className={styles.page}>

      {/* ── Page header ── */}
      <div className={styles.pageHdr}>
        <div className={styles.pageHdrLeft}>
          <div className={styles.badge}><SparkleIcon /> Creator Studio</div>
          <h2 className={styles.pageTitle}>Creator Studio</h2>
          <p className={styles.pageSub}>
            Reads your brand data, past generations &amp; brief — outputs a 100% personalised editing guide.
          </p>
        </div>
      </div>

      <div className={styles.layout}>

        {/* ════════ LEFT PANEL ════════ */}
        <div className={styles.inputPanel}>

          {/* Step 1 — Campaign */}
          <div className={styles.stepBlock}>
            <div className={styles.stepLabel}><span className={styles.stepNum}>1</span> Select Campaign</div>
            <div className={styles.stepCard}>
              {campaignsLoading ? (
                <div className={styles.selectLoading}><SpinnerIcon /> Loading campaigns…</div>
              ) : campaigns.length === 0 ? (
                <div className={styles.emptyCampaigns}>
                  <FolderIcon />
                  <span>No campaigns yet. Create one first, then return here.</span>
                </div>
              ) : (
                <select
                  className={styles.select}
                  value={selectedCampaign}
                  onChange={e => {
                    setSelectedCampaign(e.target.value)
                    setResult(null); setError(''); setContentHint(''); setUsedCtx(null)
                  }}
                >
                  <option value="">Choose a campaign…</option>
                  {campaigns.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.campaign_name.charAt(0).toUpperCase() + c.campaign_name.slice(1)}
                      {c.status ? ` · ${c.status}` : ''}
                    </option>
                  ))}
                </select>
              )}

              {selectedCampaignObj && (
                <div className={styles.ctxCard}>
                  {ctxLoading ? (
                    <div className={styles.ctxLoading}><SpinnerIcon /> Reading brand data…</div>
                  ) : campaignCtx ? (
                    <>
                      <div className={styles.ctxHeader}>
                        <div className={styles.ctxCampaignName}>
                          {selectedCampaignObj.campaign_name.charAt(0).toUpperCase() + selectedCampaignObj.campaign_name.slice(1)}
                        </div>
                        <div className={styles.ctxStatusBadge}>{selectedCampaignObj.status || 'Draft'}</div>
                      </div>
                      {selectedCampaignObj.platforms?.length > 0 && (
                        <div className={styles.ctxPlatforms}>
                          {selectedCampaignObj.platforms.map(p => (
                            <span key={p} className={styles.ctxPlatPill}>{p}</span>
                          ))}
                        </div>
                      )}
                      <div className={styles.ctxDataRow}>
                        <DataPulseIcon />
                        <span>
                          {outputCount > 0
                            ? <><strong>{outputCount}</strong> past generation{outputCount > 1 ? 's' : ''} found — brand data extracted
                              {outputTypes.length > 0 && (
                                <span className={styles.ctxTypeList}>
                                  {outputTypes.map(t => <span key={t} className={styles.ctxTypePill}>{OUTPUT_TYPE_LABELS[t] || t}</span>)}
                                </span>
                              )}
                            </>
                            : <span className={styles.ctxWarn}>No past generations — add a content hint below for better results</span>
                          }
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className={styles.ctxLoading}>Could not load campaign data.</div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Step 2 — Content Hint */}
          {selectedCampaign && (
            <div className={styles.stepBlock}>
              <div className={styles.stepLabel}>
                <span className={styles.stepNum}>2</span> Content Hint
                <span className={styles.stepOptional}>optional but recommended</span>
              </div>
              <div className={styles.stepCard}>
                <textarea
                  className={styles.textarea}
                  placeholder={
                    `e.g. a linkedin carousel for new wedding shoes launch\n` +
                    `e.g. a 30-sec Instagram Reel for product launch\n` +
                    `e.g. a TikTok POV unboxing video`
                  }
                  value={contentHint}
                  onChange={e => { setContentHint(e.target.value); if (error) setError('') }}
                  rows={3}
                />
                <div className={styles.hintNote}>
                  <InfoSmallIcon />
                  Describing your content gives you a targeted script, precise editing steps and a thumbnail for your exact format.
                </div>
              </div>
            </div>
          )}

          {error && <div className={styles.errorMsg}><ErrorIcon /> {error}</div>}

          <button
            className={`${styles.generateBtn} ${loading ? styles.generateBtnLoading : ''}`}
            onClick={generate}
            disabled={loading || !selectedCampaign}
          >
            {loading
              ? <><SpinnerIcon /> Building your guide…</>
              : <><WandBtnIcon /> Generate Personalised Guide</>
            }
          </button>

          {!selectedCampaign && (
            <div className={styles.featureList}>
              {[
                { icon: '☆', label: 'Carousel slides with exact headlines & copy' },
                { icon: '☆', label: 'Reel script with hook, scenes & CTA' },
                { icon: '☆', label: 'Step-by-step CapCut / Canva instructions' },
                { icon: '☆', label: 'Canva layout with real brand colors & fonts' },
                { icon: '☆', label: 'Thumbnail concept with scroll-stopping text' },
                { icon: '☆', label: 'Brand-specific mistakes to avoid' },
              ].map(f => (
                <div key={f.label} className={styles.featureItem}>
                  <span className={styles.featureIcon}>{f.icon}</span>
                  <span>{f.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ════════ RIGHT PANEL ════════ */}
        <div className={styles.outputPanel}>

          {!result && !loading && (
            <div className={styles.emptyOutput}>
              <div className={styles.emptyIcon}><WandIcon /></div>
              <div className={styles.emptyTitle}>Your personalised guide will appear here</div>
              <p className={styles.emptyHint}>
                Creator Studio pulls your real taglines, captions, brand voice, audience insights and campaign goals from past generations — then builds a guide specific to your brand, not a generic template.
              </p>
              <div className={styles.emptySteps}>
                {['Select your campaign', 'Add a content hint (optional)', 'Click Generate'].map((s, i) => (
                  <div key={i} className={styles.emptyStep}>
                    <span className={styles.emptyStepNum}>{i + 1}</span>
                    <span>{s}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {loading && (
            <div className={styles.skeletonWrap}>
              <div className={styles.skeletonHdr}>
                <div className={`${styles.sk} ${styles.skBadge}`} />
                <div className={`${styles.sk} ${styles.skTitle}`} />
              </div>
              {[1, 2, 3].map(i => (
                <div key={i} className={styles.skCard}>
                  <div className={`${styles.sk} ${styles.skCardTitle}`} />
                  <div className={`${styles.sk} ${styles.skLine}`} />
                  <div className={`${styles.sk} ${styles.skLine}`} />
                  <div className={`${styles.sk} ${i % 2 === 0 ? styles.skLineShort : styles.skLine}`} />
                </div>
              ))}
            </div>
          )}

          {result && usedCtx && (
            <>
              {/* Attribution bar */}
              <div className={styles.attrBar}>
                <div className={styles.attrLeft}>
                  <SparkleSmallIcon />
                  <div>
                    <span className={styles.attrFor}>Guide personalised for</span>
                    <span className={styles.attrName}>{usedCtx.campaignName}</span>
                  </div>
                  {usedCtx.platforms?.length > 0 && usedCtx.platforms.map(p => (
                    <span key={p} className={styles.attrPlatPill}>{p}</span>
                  ))}
                  {usedCtx.tone && <span className={styles.attrTonePill}>{usedCtx.tone}</span>}
                  {/* Format badge */}
                  <span className={styles.attrFormatPill}>{resultFormat.charAt(0).toUpperCase() + resultFormat.slice(1)}</span>
                </div>
                <div className={styles.attrRight}>
                  {outputCount > 0 && <span className={styles.attrStat}><DataPulseIcon /> {outputCount} gen{outputCount > 1 ? 's' : ''} used</span>}
                  <button className={styles.newGuideBtn} onClick={() => { setResult(null); setError(''); setUsedCtx(null) }}>
                    ↺ New Guide
                  </button>
                </div>
              </div>

              {/* Tab bar — adapts to format */}
              <div className={styles.tabBar}>
                {allTabs.map(t => (
                  <button
                    key={t.id}
                    className={`${styles.tabBtn} ${activeTab === t.id ? styles.tabBtnActive : ''}`}
                    onClick={() => setActiveTab(t.id)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* ── SCRIPT TAB — renders differently per format ── */}
              {activeTab === 'script' && (
                <div className={styles.tabContent}>

                  {/* CAROUSEL */}
                  {resultFormat === 'carousel' && (
                    (result.carouselSlides || []).map((slide, idx) => (
                      <div key={idx} className={styles.scriptCard}>
                        <div className={styles.scriptCardHdr}>
                          <span className={styles.timingBadge}>Slide {slide.slideNumber}</span>
                          <div className={styles.scriptCardMeta}>
                            <span className={styles.scriptCardLabel}>{slide.role}</span>
                          </div>
                        </div>
                        <ScriptRow label="Headline"        value={slide.headline}        highlight onCopy={() => copy(slide.headline, `h-${idx}`)}        copied={copied[`h-${idx}`]} />
                        <ScriptRow label="Body copy"       value={slide.body}            highlight onCopy={() => copy(slide.body, `b-${idx}`)}            copied={copied[`b-${idx}`]} />
                        <ScriptRow label="Visual direction" value={slide.visualDirection}          onCopy={() => copy(slide.visualDirection, `v-${idx}`)} copied={copied[`v-${idx}`]} />
                      </div>
                    ))
                  )}

                  {/* PHOTO */}
                  {resultFormat === 'photo' && result.photoPost && (
                    <div className={styles.scriptCard}>
                      <div className={styles.scriptCardHdr}>
                        <span className={styles.timingBadge}>Static Photo</span>
                        <div className={styles.scriptCardMeta}>
                          <span className={styles.scriptCardLabel}>Single Image Post</span>
                        </div>
                      </div>
                      <ScriptRow label="Image direction" value={result.photoPost.imageDirection} />
                      <ScriptRow label="Text overlay"    value={result.photoPost.textOverlay}    highlight onCopy={() => copy(result.photoPost.textOverlay, 'p-overlay')} copied={copied['p-overlay']} />
                      <ScriptRow label="Text placement"  value={result.photoPost.textPlacement} />
                      <ScriptRow label="Caption"         value={result.photoPost.caption}        highlight onCopy={() => copy(result.photoPost.caption, 'p-cap')} copied={copied['p-cap']} />
                    </div>
                  )}

                  {/* STORY */}
                  {resultFormat === 'story' && (
                    (result.storyFrames || []).map((frame, idx) => (
                      <div key={idx} className={styles.scriptCard}>
                        <div className={styles.scriptCardHdr}>
                          <span className={styles.timingBadge}>{frame.duration}</span>
                          <div className={styles.scriptCardMeta}>
                            <span className={styles.scriptCardLabel}>Frame {frame.frameNumber}</span>
                            <span className={styles.scriptCardSub}>{frame.role}</span>
                          </div>
                        </div>
                        <ScriptRow label="On-screen text" value={frame.onScreenText} highlight onCopy={() => copy(frame.onScreenText, `st-${idx}`)} copied={copied[`st-${idx}`]} />
                        <ScriptRow label="Action"         value={frame.action} />
                        <ScriptRow label="Text placement" value={frame.textPlacement} />
                      </div>
                    ))
                  )}

                  {/* TWITTER THREAD */}
                  {resultFormat === 'thread' && (
                    (result.twitterThread || []).map((tweet, idx) => (
                      <div key={idx} className={styles.scriptCard}>
                        <div className={styles.scriptCardHdr}>
                          <span className={styles.timingBadge}>Tweet {tweet.tweetNumber}</span>
                          <div className={styles.scriptCardMeta}>
                            <span className={styles.scriptCardLabel}>{tweet.role}</span>
                          </div>
                        </div>
                        <ScriptRow label="Text" value={tweet.text} highlight onCopy={() => copy(tweet.text, `tw-${idx}`)} copied={copied[`tw-${idx}`]} />
                      </div>
                    ))
                  )}

                  {/* REEL / SHORT (default) */}
                  {(resultFormat === 'reel' || resultFormat === 'short') && (
                    [
                      { data: result.reelScript.hook,                     label: 'Hook',          sublabel: 'First Impression',       badgeClass: '' },
                      ...(result.reelScript.scenes || []).map((s, i) => ({ data: s, label: `Scene ${s.sceneNumber}`, sublabel: s.timing, badgeClass: '' })),
                      { data: result.reelScript.cta,                      label: 'CTA',           sublabel: 'Closing Call-to-Action', badgeClass: styles.timingBadgeCta },
                    ].map((item, idx) => (
                      <div key={idx} className={styles.scriptCard}>
                        <div className={styles.scriptCardHdr}>
                          <span className={`${styles.timingBadge} ${item.badgeClass || ''}`}>{item.data.timing}</span>
                          <div className={styles.scriptCardMeta}>
                            <span className={styles.scriptCardLabel}>{item.label}</span>
                            <span className={styles.scriptCardSub}>{item.sublabel}</span>
                          </div>
                        </div>
                        <ScriptRow label="Action"         value={item.data.action}       onCopy={() => copy(item.data.action,       `action-${idx}`)} copied={copied[`action-${idx}`]} />
                        <ScriptRow label="On-screen text" value={item.data.onScreenText} highlight onCopy={() => copy(item.data.onScreenText, `text-${idx}`)}   copied={copied[`text-${idx}`]} />
                        <ScriptRow label="Text position"  value={item.data.textPlacement} />
                      </div>
                    ))
                  )}

                </div>
              )}

              {/* ── Editing Steps ── */}
              {activeTab === 'editing' && (
                <div className={styles.tabContent}>
                  {(result.editingInstructions || []).map((instr, i) => (
                    <div key={i} className={styles.editCard}>
                      <div className={styles.editCardHdr}>
                        <div className={styles.editStepNum}>{instr.step}</div>
                        <div className={styles.editCardMeta}>
                          <span className={styles.editTool}>{instr.tool}</span>
                          <span className={styles.editAction}>{instr.action}</span>
                        </div>
                        <button className={styles.copyBtn} onClick={() => copy(`${instr.action}\n${instr.detail}`, `edit-${i}`)}>{copied[`edit-${i}`] ? '✓' : 'Copy'}</button>
                      </div>
                      <div className={styles.editDetail}>{instr.detail}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* ── Canva Layout ── */}
              {activeTab === 'canva' && (
                <div className={styles.tabContent}>
                  <div className={styles.outCard}>
                    <div className={styles.outCardTitle}><span className={`${styles.dot} ${styles.dotPurple}`} />Canvas Setup</div>
                    <CanvaRow label="Format"         value={result.canvaLayout.format} />
                    <CanvaRow label="Background"     value={result.canvaLayout.background} color={extractHex(result.canvaLayout.background)} />
                    <CanvaRow label="Accent element" value={result.canvaLayout.accentElement} />
                  </div>
                  <div className={styles.outCard}>
                    <div className={styles.outCardTitle}><span className={`${styles.dot} ${styles.dotAmber}`} />Title Text</div>
                    <CanvaRow label="Text"      value={result.canvaLayout.titleText.content}   highlight onCopy={() => copy(result.canvaLayout.titleText.content, 'cl-title')} copied={copied['cl-title']} />
                    <CanvaRow label="Font"      value={result.canvaLayout.titleText.font} />
                    <CanvaRow label="Size"      value={result.canvaLayout.titleText.size} />
                    <CanvaRow label="Color"     value={result.canvaLayout.titleText.color}     color={result.canvaLayout.titleText.color} />
                    <CanvaRow label="Placement" value={result.canvaLayout.titleText.placement} />
                  </div>
                  <div className={styles.outCard}>
                    <div className={styles.outCardTitle}><span className={`${styles.dot} ${styles.dotTeal}`} />Body Text</div>
                    <CanvaRow label="Text"      value={result.canvaLayout.bodyText.content}   highlight onCopy={() => copy(result.canvaLayout.bodyText.content, 'cl-body')} copied={copied['cl-body']} />
                    <CanvaRow label="Font"      value={result.canvaLayout.bodyText.font} />
                    <CanvaRow label="Size"      value={result.canvaLayout.bodyText.size} />
                    <CanvaRow label="Color"     value={result.canvaLayout.bodyText.color}     color={result.canvaLayout.bodyText.color} />
                    <CanvaRow label="Placement" value={result.canvaLayout.bodyText.placement} />
                  </div>
                </div>
              )}

              {/* ── Thumbnail ── */}
              {activeTab === 'thumb' && (
                <div className={styles.tabContent}>
                  <div className={styles.outCard}>
                    <div className={styles.outCardTitle}>
                      <span className={`${styles.dot} ${styles.dotPurple}`} />
                      {resultFormat === 'carousel' ? 'Cover Slide Concept' : resultFormat === 'photo' ? 'Photo Concept' : 'Thumbnail Composition'}
                    </div>
                    <CanvaRow label="Frame"        value={result.thumbnailIdea.visualComposition} />
                    <CanvaRow label="Text overlay" value={result.thumbnailIdea.textOverlay}       highlight onCopy={() => copy(result.thumbnailIdea.textOverlay, 'thumb-text')} copied={copied['thumb-text']} />
                    <CanvaRow label="Font"         value={result.thumbnailIdea.font} />
                    <CanvaRow label="Text color"   value={result.thumbnailIdea.textColor}         color={result.thumbnailIdea.textColor} />
                    <CanvaRow label="Background"   value={result.thumbnailIdea.backgroundColor}   color={extractHex(result.thumbnailIdea.backgroundColor)} />
                  </div>
                  <div className={styles.outCard}>
                    <div className={styles.outCardTitle}><span className={`${styles.dot} ${styles.dotAmber}`} />Stand-out Element</div>
                    <div className={styles.highlightBox}><StarIcon /><span>{result.thumbnailIdea.highlightElement}</span></div>
                  </div>
                </div>
              )}

              {/* ── Mistakes ── */}
              {activeTab === 'mistakes' && (
                <div className={styles.tabContent}>
                  {(result.mistakesToAvoid || []).map((m, i) => (
                    <div key={i} className={styles.mistakeCard}>
                      <div className={styles.mistakeHdr}><WarningIcon /><span className={styles.mistakeTitle}>{m.mistake}</span></div>
                      <div className={styles.mistakeRow}>
                        <span className={styles.mistakeLabel}>Why it hurts</span>
                        <span className={styles.mistakeWhy}>{m.whyItHurts}</span>
                      </div>
                      <div className={styles.mistakeRow}>
                        <span className={styles.mistakeLabel}>The fix</span>
                        <span className={styles.mistakeFix}>{m.fix}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Bottom action */}
              <div className={styles.actionRow}>
                <button className={styles.canvaBtn} onClick={() => window.open('https://www.canva.com/create/', '_blank')}>
                  <CanvaIcon /> Open in Canva
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Sub-components ───────────────────────────────────────────────────────────
function ScriptRow({ label, value, highlight, onCopy, copied }) {
  if (!value) return null
  return (
    <div className={styles.scriptRow}>
      <span className={styles.scriptLabel}>{label}</span>
      <span className={`${styles.scriptValue} ${highlight ? styles.scriptValueHighlight : ''}`}>{value}</span>
      {onCopy && <button className={styles.copyBtn} onClick={onCopy}>{copied ? 'Copied!' : 'Copy'}</button>}
    </div>
  )
}

function CanvaRow({ label, value, color, highlight, onCopy, copied }) {
  if (!value) return null
  return (
    <div className={styles.outRow}>
      <span className={styles.outLabel}>{label}</span>
      <span className={`${styles.outValue} ${highlight ? styles.outValueHighlight : ''}`} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {color && isHex(color) && (
          <span style={{ display: 'inline-block', width: 14, height: 14, borderRadius: 3, background: color, border: '1.5px solid rgba(0,0,0,0.15)', flexShrink: 0 }} />
        )}
        {value}
      </span>
      {onCopy && <button className={styles.copyBtn} onClick={onCopy}>{copied ? 'Copied!' : 'Copy'}</button>}
    </div>
  )
}

function isHex(v)      { return /^#[0-9A-Fa-f]{3,6}$/.test((v || '').trim()) }
function extractHex(v) { const m = (v || '').match(/#[0-9A-Fa-f]{3,6}/); return m ? m[0] : null }

// ── Icons ────────────────────────────────────────────────────────────────────
function SparkleIcon()      { return <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17 5.8 21.3l2.4-7.4L2 9.4h7.6z"/></svg> }
function SparkleSmallIcon() { return <svg width="10" height="10" viewBox="0 0 24 24" fill="#3B6BF5"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17 5.8 21.3l2.4-7.4L2 9.4h7.6z"/></svg> }
function SpinnerIcon()      { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.7s linear infinite', display: 'inline-block', verticalAlign: 'middle', marginRight: 5 }}><circle cx="12" cy="12" r="10" strokeOpacity="0.25"/><path d="M12 2a10 10 0 0110 10"/></svg> }
function WandIcon()         { return <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 4V2m0 2v2m0-2h-2m2 0h2M3 14l9-9 4 4-9 9-4-4z"/><path d="M14 5l5 5"/></svg> }
function WandBtnIcon()      { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 5 }}><path d="M15 4V2m0 2v2m0-2h-2m2 0h2M3 14l9-9 4 4-9 9-4-4z"/><path d="M14 5l5 5"/></svg> }
function CanvaIcon()        { return <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><circle cx="12" cy="12" r="10"/><text x="12" y="16" textAnchor="middle" fontSize="11" fontWeight="700" fill="#7952CC">C</text></svg> }
function FolderIcon()       { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg> }
function ErrorIcon()        { return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 4 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> }
function WarningIcon()      { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, color: '#EF4444' }}><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> }
function StarIcon()         { return <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0, color: '#F59E0B' }}><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg> }
function DataPulseIcon()    { return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#3B6BF5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg> }
function InfoSmallIcon()    { return <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> }
