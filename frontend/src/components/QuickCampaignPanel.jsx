import { useState } from 'react'
import styles from './QuickCampaignPanel.module.css'
import { generateWithFallback } from '../lib/generateWithFallback'
import { quickCampaignFallback } from '../lib/fallbackService'

export default function QuickCampaignPanel({ onClose }) {
  const [input,   setInput]   = useState('')
  const [loading, setLoading] = useState(false)
  const [result,  setResult]  = useState(null)
  const [error,   setError]   = useState('')
  const [copied,  setCopied]  = useState(null)

  async function generate() {
    if (!input.trim()) { setError('Please describe your campaign first.'); return }
    setError(''); setLoading(true); setResult(null)

    try {
      const prompt = `You are a social media marketing expert.
Based on the following campaign description:
"${input.trim()}"

Generate:
1. 3 creative campaign ideas
2. 3 different post variations (different angles)
3. 3 engaging captions
4. 10 relevant hashtags

Keep the tone engaging and suitable for social media.

Respond in JSON format only with this exact structure:
{
  "campaign_ideas": [
    { "title": "...", "description": "..." },
    { "title": "...", "description": "..." },
    { "title": "...", "description": "..." }
  ],
  "post_variations": [
    { "angle": "...", "content": "..." },
    { "angle": "...", "content": "..." },
    { "angle": "...", "content": "..." }
  ],
  "captions": ["...", "...", "..."],
  "hashtags": ["#...", "#...", "#...", "#...", "#...", "#...", "#...", "#...", "#...", "#..."]
}`

      // ── Try Gemini, fall back to domain content if unavailable ────────────
      let data = await generateWithFallback(prompt, null, {
        gemini: { temperature: 0.9, maxOutputTokens: 4096 },
      })

      if (!data) {
        data = quickCampaignFallback({ input: input.trim() })
      }

      setResult(data)
    } catch (err) {
      setError(err.message || 'Generation failed. Please try again.')
    }
    setLoading(false)
  }

  function copyText(text, key) {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 1800)
  }

  function copyAllHashtags() {
    copyText((result.hashtags || []).join(' '), 'hashtags')
  }

  return (
    <div className={styles.panel}>
      {/* Header */}
      <div className={styles.hdr}>
        <div className={styles.hdrLeft}>
          <div className={styles.hdrIcon}>
            <SparkleIcon />
          </div>
          <div>
            <div className={styles.title}>New Campaign</div>
            <div className={styles.sub}>Describe your campaign and get instant ideas, posts, captions & hashtags</div>
          </div>
        </div>
        <button className={styles.closeBtn} onClick={onClose}>✕</button>
      </div>

      {/* Input area */}
      {!result && (
        <div className={styles.inputSection}>
          <label className={styles.inputLabel}>What's your campaign about?</label>
          <textarea
            className={styles.textarea}
            placeholder={`e.g. "Launching a new fitness app for Gen Z that makes working out fun and social. Want to build buzz on Instagram and TikTok before launch day."`}
            value={input}
            onChange={e => setInput(e.target.value)}
            rows={4}
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) generate() }}
          />
          <div className={styles.inputHint}>Press Ctrl+Enter to generate</div>
          {error && <div className={styles.error}>{error}</div>}
          <div className={styles.actions}>
            <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
            <button className={styles.genBtn} onClick={generate} disabled={loading || !input.trim()}>
              {loading ? <><Spinner /> Generating…</> : <><SparkleIcon size={13} /> Generate Campaign</>}
            </button>
          </div>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className={styles.loadingState}>
          <div className={styles.loadingDots}>
            <span /><span /><span />
          </div>
          <div className={styles.loadingText}>Crafting your campaign…</div>
        </div>
      )}

      {/* Results */}
      {result && !loading && (
        <div className={styles.results}>
          {/* User input echo */}
          <div className={styles.queryCard}>
            <span className={styles.queryLabel}>Your brief</span>
            <span className={styles.queryText}>"{input}"</span>
          </div>

          {/* Campaign Ideas */}
          <div className={styles.section}>
            <div className={styles.sectionHdr}>
              <div className={styles.sectionIcon} style={{ background: '#EBF0FF', color: '#3B6BF5' }}>💡</div>
              <div className={styles.sectionTitle}>Campaign Ideas</div>
            </div>
            <div className={styles.ideasGrid}>
              {(result.campaign_ideas || []).map((idea, i) => (
                <div key={i} className={styles.ideaCard}>
                  <div className={styles.ideaNum}>#{i + 1}</div>
                  <div className={styles.ideaTitle}>{idea.title}</div>
                  <div className={styles.ideaDesc}>{idea.description}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Post Variations */}
          <div className={styles.section}>
            <div className={styles.sectionHdr}>
              <div className={styles.sectionIcon} style={{ background: '#FFF7ED', color: '#EA580C' }}>📱</div>
              <div className={styles.sectionTitle}>Post Variations</div>
            </div>
            {(result.post_variations || []).map((post, i) => (
              <div key={i} className={styles.postCard}>
                <div className={styles.postCardHdr}>
                  <span className={styles.postAngle}>{post.angle}</span>
                  <button
                    className={`${styles.copyBtn} ${copied === `post-${i}` ? styles.copyBtnDone : ''}`}
                    onClick={() => copyText(post.content, `post-${i}`)}
                  >
                    {copied === `post-${i}` ? '✓ Copied' : 'Copy'}
                  </button>
                </div>
                <div className={styles.postContent}>{post.content}</div>
              </div>
            ))}
          </div>

          {/* Captions */}
          <div className={styles.section}>
            <div className={styles.sectionHdr}>
              <div className={styles.sectionIcon} style={{ background: '#F0FDF4', color: '#16A34A' }}>✍️</div>
              <div className={styles.sectionTitle}>Captions</div>
            </div>
            {(result.captions || []).map((caption, i) => (
              <div key={i} className={styles.captionCard}>
                <div className={styles.captionNum}>Caption {i + 1}</div>
                <div className={styles.captionText}>{caption}</div>
                <button
                  className={`${styles.copyBtn} ${copied === `cap-${i}` ? styles.copyBtnDone : ''}`}
                  onClick={() => copyText(caption, `cap-${i}`)}
                >
                  {copied === `cap-${i}` ? '✓ Copied' : 'Copy'}
                </button>
              </div>
            ))}
          </div>

          {/* Hashtags */}
          <div className={styles.section}>
            <div className={styles.sectionHdr}>
              <div className={styles.sectionIcon} style={{ background: '#FDF4FF', color: '#9333EA' }}>#</div>
              <div className={styles.sectionTitle}>Hashtags</div>
              <button
                className={`${styles.copyBtn} ${styles.copyBtnInline} ${copied === 'hashtags' ? styles.copyBtnDone : ''}`}
                onClick={copyAllHashtags}
              >
                {copied === 'hashtags' ? '✓ All Copied' : 'Copy All'}
              </button>
            </div>
            <div className={styles.hashGrid}>
              {(result.hashtags || []).map((tag, i) => (
                <span
                  key={i}
                  className={styles.hashTag}
                  onClick={() => copyText(tag, `tag-${i}`)}
                  title="Click to copy"
                >
                  {copied === `tag-${i}` ? '✓' : tag}
                </span>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className={styles.resultActions}>
            <button className={styles.cancelBtn} onClick={() => { setResult(null); setError('') }}>
              ← Try Again
            </button>
            <button className={styles.genBtn} onClick={onClose}>
              Done ✓
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function SparkleIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
    </svg>
  )
}

function Spinner() {
  return <span className={styles.spinner} />
}
