/**
 * ExportPanel.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * AI Social Media Campaign Generator | Sourcesys Technologies
 *
 * Campaign Export — generates a professional HTML report and triggers
 * the browser's native print/save-as-PDF dialog.
 * Zero external dependencies. Works fully offline.
 *
 * Usage:
 *   <ExportPanel campaign={campaign} outputs={outputs} onClose={() => …} />
 */

import { useState } from 'react'
import styles from './ExportPanel.module.css'

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

function formatDateTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function safeData(raw) {
  if (!raw) return null
  if (typeof raw === 'string') { try { return JSON.parse(raw) } catch { return null } }
  return raw
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

const OUTPUT_LABELS = {
  post_generator: 'AI Post Generator',
  audience:       'Audience Targeting',
  ideation:       'Campaign Ideation',
  custom_flow:    'Custom Flow',
}

const OUTPUT_COLORS = {
  post_generator: '#3B6BF5',
  audience:       '#16A34A',
  ideation:       '#EA580C',
  custom_flow:    '#9333EA',
}

// ─────────────────────────────────────────────────────────────
// HTML report builder
// ─────────────────────────────────────────────────────────────
function buildReportHTML(campaign, outputs, options) {
  const name = campaign.campaign_name
    ? campaign.campaign_name.charAt(0).toUpperCase() + campaign.campaign_name.slice(1)
    : 'Campaign Report'

  const includedOutputs = outputs.filter(o =>
    options.outputTypes.includes(o.output_type)
  )

  // ── Section builders ────────────────────────────────────────
  function sectionHeader(label, color) {
    return `
      <div class="section-hdr" style="border-left:4px solid ${color}">
        <span class="section-badge" style="background:${color}20;color:${color}">${label}</span>
      </div>`
  }

  function buildPostGenerator(data) {
    if (!data) return '<p class="no-data">No data available.</p>'
    const platformsMap = normalisePlatformsMap(data.platforms)
    const platforms = Object.keys(platformsMap)
    let html = ''
    if (data.campaign_summary) html += `<div class="block"><div class="block-label">Campaign Summary</div><p>${data.campaign_summary}</p></div>`
    if (data.audience_insight)  html += `<div class="block"><div class="block-label">Audience Insight</div><p>${data.audience_insight}</p></div>`
    if ((data.kpis || []).length > 0) {
      html += `<div class="block"><div class="block-label">KPIs</div><div class="chip-row">${data.kpis.map(k => `<span class="chip">${k}</span>`).join('')}</div></div>`
    }
    for (const platform of platforms) {
      const posts = platformsMap[platform]?.posts || []
      html += `<div class="block"><div class="block-label">Posts — ${platform}</div>`
      posts.forEach((post, i) => {
        html += `<div class="post-card">
          <div class="post-num">Variation ${i + 1} · ${post?.content_type || 'Post'}</div>
          ${post?.hook ? `<div class="hook-block"><strong>HOOK:</strong> ${post.hook}</div>` : ''}
          <p class="post-caption">${post?.caption || ''}</p>
          ${(post?.hashtags || []).length > 0 ? `<div class="chip-row small">${post.hashtags.map(h => `<span class="hash">${h}</span>`).join('')}</div>` : ''}
          ${post?.cta ? `<div class="post-meta">📣 ${post.cta}</div>` : ''}
          ${post?.best_time ? `<div class="post-meta">🕐 Best time: ${post.best_time}</div>` : ''}
        </div>`
      })
      html += '</div>'
    }
    return html
  }

  function buildAudience(data) {
    if (!data) return '<p class="no-data">No data available.</p>'
    const personas = data.personas || []
    let html = ''
    personas.forEach((p, i) => {
      html += `<div class="persona-card">
        <div class="persona-name">${p.persona_name || `Persona ${i + 1}`}</div>
        ${p.identity_label && p.identity_label !== p.persona_name ? `<div class="persona-role">${p.identity_label}</div>` : ''}
        ${p.behavior    ? `<div class="block-label">Behavior</div><p>${p.behavior}</p>` : ''}
        ${p.mindset     ? `<div class="block-label">Mindset</div><p>${p.mindset}</p>` : ''}
        ${p.pain_point  ? `<div class="block-label">Pain Point</div><p>${p.pain_point}</p>` : ''}
        ${p.hook        ? `<div class="hook-block">"${p.hook}"</div>` : ''}
        ${p.best_platform ? `<div class="block-label">Best Platform</div><p>${p.best_platform}</p>` : ''}
      </div>`
    })
    if (data.audience_overlap_matrix) html += `<div class="block"><div class="block-label">Overlap Insight</div><p>${data.audience_overlap_matrix}</p></div>`
    return html
  }

  function buildIdeation(data) {
    if (!data) return '<p class="no-data">No data available.</p>'
    const ideas = data.campaign_ideas || []
    return ideas.map((idea, i) => `
      <div class="idea-card">
        <div class="idea-num">#${i + 1}</div>
        <div class="idea-title">${idea.idea_title || idea.title || `Idea ${i + 1}`}</div>
        ${idea.tagline ? `<div class="idea-tagline">"${idea.tagline}"</div>` : ''}
        ${idea.big_idea ? `<div class="block-label">The Big Idea</div><p>${idea.big_idea}</p>` : ''}
        ${idea.cultural_hook ? `<div class="block-label">Cultural Hook</div><p>${idea.cultural_hook}</p>` : ''}
        ${idea.platform_execution ? `<div class="block-label">Platform Execution</div><p>${idea.platform_execution}</p>` : ''}
        ${idea.why_it_wins ? `<div class="win-pill">🏆 ${idea.why_it_wins}</div>` : ''}
      </div>`).join('')
  }

  function buildCustomFlow(data) {
    if (!data) return '<p class="no-data">No data available.</p>'
    let html = ''
    if (data.campaign_summary)      html += `<div class="block"><div class="block-label">Campaign Summary</div><p>${data.campaign_summary}</p></div>`
    if (data.positioning_statement) html += `<div class="block"><div class="block-label">Positioning Statement</div><p>${data.positioning_statement}</p></div>`
    if (data.brand_voice_guide)     html += `<div class="block"><div class="block-label">Brand Voice</div><p>${data.brand_voice_guide}</p></div>`
    if ((data.content_pillars || []).length > 0) {
      html += `<div class="block"><div class="block-label">Content Pillars</div><div class="chip-row">`
      data.content_pillars.forEach((p, i) => {
        const name = typeof p === 'string' ? p : (p?.name || `Pillar ${i + 1}`)
        html += `<span class="chip">Pillar ${i + 1}: ${name}</span>`
      })
      html += '</div></div>'
    }
    if ((data.platform_strategy || []).length > 0) {
      html += `<div class="block"><div class="block-label">Platform Strategy</div>`
      data.platform_strategy.forEach(ps => {
        html += `<div class="strat-row"><strong>${ps?.platform || ''}</strong> — ${ps?.strategy || ''}</div>`
      })
      html += '</div>'
    }
    return html
  }

  // ── Assemble full sections ───────────────────────────────────
  let sectionsHTML = ''
  if (options.includeSummary) {
    sectionsHTML += `
      <div class="report-section">
        <div class="section-hdr" style="border-left:4px solid #3B6BF5">
          <span class="section-badge" style="background:#EBF0FF;color:#3B6BF5">Campaign Overview</span>
        </div>
        <div class="overview-grid">
          <div class="overview-item"><div class="ov-label">Campaign</div><div class="ov-val">${name}</div></div>
          <div class="overview-item"><div class="ov-label">Status</div><div class="ov-val">${campaign.status || 'Draft'}</div></div>
          <div class="overview-item"><div class="ov-label">Platforms</div><div class="ov-val">${(campaign.platforms || []).join(', ') || '—'}</div></div>
          <div class="overview-item"><div class="ov-label">Tone</div><div class="ov-val">${campaign.tone || '—'}</div></div>
          <div class="overview-item"><div class="ov-label">Created</div><div class="ov-val">${formatDate(campaign.created_at)}</div></div>
          <div class="overview-item"><div class="ov-label">Outputs</div><div class="ov-val">${outputs.length} saved</div></div>
        </div>
      </div>`
  }

  includedOutputs.forEach((output, idx) => {
    const data  = safeData(output.generated_data)
    const color = OUTPUT_COLORS[output.output_type] || '#3B6BF5'
    const label = OUTPUT_LABELS[output.output_type] || output.output_type

    let contentHTML = ''
    switch (output.output_type) {
      case 'post_generator': contentHTML = buildPostGenerator(data); break
      case 'audience':       contentHTML = buildAudience(data);      break
      case 'ideation':       contentHTML = buildIdeation(data);      break
      case 'custom_flow':    contentHTML = buildCustomFlow(data);    break
      default: contentHTML = `<pre>${JSON.stringify(data, null, 2)}</pre>`
    }

    sectionsHTML += `
      <div class="report-section" style="break-inside:avoid-page">
        ${sectionHeader(`${label} — ${formatDateTime(output.created_at)}`, color)}
        <div class="section-body">${contentHTML}</div>
      </div>`
  })

  // ── Full HTML document ───────────────────────────────────────
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>${name} — Campaign Report</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 13px; color: #0D0F1A; background: #fff;
    padding: 0; line-height: 1.55;
  }
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Syne:wght@700;800&display=swap');

  /* ── Report wrapper ── */
  .report-wrap { max-width: 860px; margin: 0 auto; padding: 48px 52px; }

  /* ── Cover ── */
  .cover {
    border-bottom: 2px solid #F1F5F9; margin-bottom: 40px; padding-bottom: 32px;
    display: flex; align-items: flex-start; justify-content: space-between; gap: 24px;
  }
  .cover-badge {
    background: linear-gradient(135deg, #3B6BF5, #0EA5B0);
    color: #fff; font-size: 11px; font-weight: 700;
    letter-spacing: 0.12em; text-transform: uppercase;
    border-radius: 7px; padding: 4px 11px; display: inline-block; margin-bottom: 12px;
  }
  .cover-title {
    font-family: 'Syne', sans-serif; font-size: 28px; font-weight: 800;
    color: #0D0F1A; letter-spacing: -0.03em; line-height: 1.15; margin-bottom: 8px;
  }
  .cover-sub { font-size: 13px; color: #64748B; }
  .cover-meta { text-align: right; color: #9BA3BB; font-size: 12px; line-height: 1.7; }
  .cover-meta strong { color: #475569; }

  /* ── Section ── */
  .report-section { margin-bottom: 36px; }
  .section-hdr {
    padding: 10px 14px; background: #F8FAFC;
    border-radius: 8px; margin-bottom: 16px;
  }
  .section-badge {
    font-size: 11px; font-weight: 700; letter-spacing: 0.06em;
    text-transform: uppercase; padding: 3px 10px; border-radius: 6px;
  }
  .section-body { padding: 0 4px; }

  /* ── Overview grid ── */
  .overview-grid {
    display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px;
  }
  .overview-item {
    background: #F8FAFC; border: 1px solid rgba(0,0,0,0.07);
    border-radius: 10px; padding: 12px 14px;
  }
  .ov-label {
    font-size: 10px; font-weight: 700; letter-spacing: 0.08em;
    text-transform: uppercase; color: #9BA3BB; margin-bottom: 4px;
  }
  .ov-val { font-size: 13px; font-weight: 600; color: #0D0F1A; }

  /* ── Generic blocks ── */
  .block { margin-bottom: 14px; }
  .block-label {
    font-size: 10px; font-weight: 700; letter-spacing: 0.08em;
    text-transform: uppercase; color: #9BA3BB; margin-bottom: 5px;
  }
  p { font-size: 13px; color: #374151; line-height: 1.6; margin-bottom: 4px; }
  .no-data { color: #9BA3BB; font-style: italic; }

  /* ── Chips ── */
  .chip-row { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; }
  .chip {
    font-size: 11.5px; font-weight: 600; background: #EBF0FF;
    color: #3B6BF5; padding: 3px 10px; border-radius: 20px;
  }
  .chip-row.small .chip { font-size: 10.5px; }
  .hash { font-size: 11px; color: #3B6BF5; background: #EBF0FF; padding: 2px 7px; border-radius: 5px; }

  /* ── Post cards ── */
  .post-card {
    background: #F8FAFC; border: 1px solid rgba(0,0,0,0.07);
    border-radius: 10px; padding: 12px 14px; margin-bottom: 10px;
    break-inside: avoid;
  }
  .post-num { font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #9BA3BB; margin-bottom: 6px; }
  .hook-block {
    background: #EBF0FF; border-radius: 7px; padding: 8px 10px;
    font-size: 12.5px; color: #3B6BF5; margin-bottom: 8px; line-height: 1.5;
  }
  .post-caption { font-size: 13px; color: #0D0F1A; line-height: 1.6; margin-bottom: 8px; }
  .post-meta { font-size: 11.5px; color: #9BA3BB; margin-top: 4px; }

  /* ── Persona cards ── */
  .persona-card {
    background: #F8FAFC; border: 1px solid rgba(0,0,0,0.07);
    border-left: 3px solid #3B6BF5;
    border-radius: 10px; padding: 14px 16px; margin-bottom: 12px;
    break-inside: avoid;
  }
  .persona-name { font-size: 14px; font-weight: 700; color: #0D0F1A; margin-bottom: 2px; }
  .persona-role { font-size: 11.5px; color: #3B6BF5; font-weight: 600; margin-bottom: 8px; }

  /* ── Ideation ── */
  .idea-card {
    background: #FFF7ED; border: 1px solid #FED7AA;
    border-radius: 10px; padding: 14px 16px; margin-bottom: 12px;
    break-inside: avoid;
  }
  .idea-num { font-size: 10px; font-weight: 700; color: #EA580C; margin-bottom: 4px; }
  .idea-title { font-size: 14px; font-weight: 700; color: #0D0F1A; margin-bottom: 4px; }
  .idea-tagline { font-size: 12px; font-style: italic; color: #EA580C; margin-bottom: 8px; }
  .win-pill { font-size: 12px; color: #15803D; background: #F0FDF4; border-radius: 8px; padding: 5px 10px; margin-top: 8px; display: inline-block; }

  /* ── Strategy rows ── */
  .strat-row { font-size: 12.5px; color: #374151; padding: 6px 0; border-bottom: 1px solid #F1F5F9; line-height: 1.5; }

  /* ── Footer ── */
  .report-footer {
    margin-top: 48px; padding-top: 20px; border-top: 1px solid #F1F5F9;
    font-size: 11px; color: #CBD5E1; text-align: center;
  }

  /* ── Print ── */
  @media print {
    body { padding: 0; }
    .report-wrap { padding: 20px 28px; max-width: 100%; }
    .report-section { break-inside: avoid-page; }
    @page { margin: 20mm; size: A4; }
  }
</style>
</head>
<body>
<div class="report-wrap">

  <!-- Cover -->
  <div class="cover">
    <div>
      <div class="cover-badge">Socialyze · Campaign Report</div>
      <div class="cover-title">${name}</div>
      <div class="cover-sub">
        ${(campaign.platforms || []).length > 0 ? `Platforms: ${campaign.platforms.join(', ')} &nbsp;·&nbsp; ` : ''}
        Status: ${campaign.status || 'Draft'}
      </div>
    </div>
    <div class="cover-meta">
      <strong>Generated</strong><br/>${formatDate(new Date().toISOString())}<br/><br/>
      <strong>Outputs</strong><br/>${includedOutputs.length} included
    </div>
  </div>

  <!-- Sections -->
  ${sectionsHTML}

  <!-- Footer -->
  <div class="report-footer">
    Generated by Socialyze · AI Social Media Campaign Generator · Sourcesys Technologies
  </div>
</div>
</body>
</html>`
}

// ─────────────────────────────────────────────────────────────
// ExportPanel Component
// ─────────────────────────────────────────────────────────────
export default function ExportPanel({ campaign, outputs, onClose }) {
  const [includeSummary, setIncludeSummary] = useState(true)
  const [outputTypes, setOutputTypes]       = useState(
    [...new Set(outputs.map(o => o.output_type))]
  )
  const [generating, setGenerating] = useState(false)

  function toggleType(t) {
    setOutputTypes(prev =>
      prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]
    )
  }

  const availableTypes = [...new Set(outputs.map(o => o.output_type))]
  const includedCount  = outputs.filter(o => outputTypes.includes(o.output_type)).length

  function handleExport() {
    setGenerating(true)
    try {
      const html = buildReportHTML(campaign, outputs, { includeSummary, outputTypes })
      const win  = window.open('', '_blank', 'width=900,height=700')
      if (!win) { alert('Please allow pop-ups to export the report.'); setGenerating(false); return }
      win.document.write(html)
      win.document.close()
      win.focus()
      // Small delay so fonts load before print dialog
      setTimeout(() => {
        win.print()
        setGenerating(false)
        onClose()
      }, 800)
    } catch (e) {
      console.error(e)
      setGenerating(false)
    }
  }

  return (
    <div className={styles.overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className={styles.panel}>

        {/* Header */}
        <div className={styles.hdr}>
          <div>
            <div className={styles.title}>Export Campaign Report</div>
            <div className={styles.sub}>
              Generates a print-ready PDF report you can save or share with clients.
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose}><XIcon /></button>
        </div>

        {/* Campaign name */}
        <div className={styles.campLabel}>
          <div className={styles.campAvatar}>
            {(campaign.campaign_name || 'C').charAt(0).toUpperCase()}
          </div>
          <div>
            <div className={styles.campName}>
              {campaign.campaign_name
                ? campaign.campaign_name.charAt(0).toUpperCase() + campaign.campaign_name.slice(1)
                : 'Untitled'}
            </div>
            <div className={styles.campMeta}>{outputs.length} outputs available</div>
          </div>
        </div>

        {/* Options */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Report Sections</div>

          {/* Summary toggle */}
          <label className={styles.optRow}>
            <div className={styles.optInfo}>
              <div className={styles.optLabel}>Campaign Overview</div>
              <div className={styles.optDesc}>Name, status, platforms, tone, dates</div>
            </div>
            <Toggle checked={includeSummary} onChange={setIncludeSummary} />
          </label>

          {/* Per output type */}
          {availableTypes.length === 0 && (
            <div className={styles.noOutputs}>No saved outputs to include.</div>
          )}
          {availableTypes.map(t => (
            <label key={t} className={styles.optRow}>
              <div className={styles.optInfo}>
                <div className={styles.optLabel} style={{ color: OUTPUT_COLORS[t] }}>
                  {OUTPUT_LABELS[t] || t}
                </div>
                <div className={styles.optDesc}>
                  {outputs.filter(o => o.output_type === t).length} saved output{outputs.filter(o => o.output_type === t).length !== 1 ? 's' : ''}
                </div>
              </div>
              <Toggle checked={outputTypes.includes(t)} onChange={v => toggleType(t)} />
            </label>
          ))}
        </div>

        {/* Preview summary */}
        <div className={styles.previewBox}>
          <PreviewIcon />
          <span>
            Your report will include{' '}
            <strong>{includeSummary ? 1 : 0} overview section</strong> and{' '}
            <strong>{includedCount} output{includedCount !== 1 ? 's' : ''}</strong>.
            Use your browser's <strong>Save as PDF</strong> option in the print dialog.
          </span>
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={onClose} disabled={generating}>
            Cancel
          </button>
          <button
            className={styles.exportBtn}
            onClick={handleExport}
            disabled={generating || (!includeSummary && includedCount === 0)}
          >
            {generating
              ? <><SpinIcon /> Generating…</>
              : <><DownloadIcon /> Export as PDF</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Toggle switch
// ─────────────────────────────────────────────────────────────
function Toggle({ checked, onChange }) {
  return (
    <button
      className={`${styles.toggle} ${checked ? styles.toggleOn : ''}`}
      onClick={() => onChange(!checked)}
      aria-pressed={checked}
    >
      <span className={styles.toggleThumb} />
    </button>
  )
}

// ─────────────────────────────────────────────────────────────
// Icons
// ─────────────────────────────────────────────────────────────
function XIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
}
function DownloadIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
}
function SpinIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{animation:'spin 0.7s linear infinite',display:'inline'}}><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg>
}
function PreviewIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#3B6BF5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
}
