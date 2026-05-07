import { supabase } from './supabaseClient'

/**
 * Normalise any brand string to a stable lowercase key.
 * "Nike", " NIKE ", "nike" → "nike"
 * "Nike — Running Shoes" → "nike"   (strips product suffix added by GeneratePanel)
 *
 * @param {string} raw
 * @returns {string}
 */
export function normaliseBrand(raw) {
  return String(raw || '')
    .split(/\s*[—–-]\s*/)[0]   // drop everything after an em-dash / en-dash / hyphen
    .trim()
    .toLowerCase()
}

/**
 * Shared save function used by ALL 4 service panels.
 *
 * Guarantees ONE campaign row per (user_id, normalised brand name).
 * Uses Supabase upsert so even a race condition won't create duplicates
 * — the DB unique constraint on (user_id, campaign_name) is the final guard.
 *
 * @param {string} rawBrand     – brand name from any panel (will be normalised here)
 * @param {string} outputType   – 'post_generator' | 'audience' | 'ideation' | 'custom_flow'
 * @param {object} generatedData – raw JSON from the AI
 * @param {object} [meta]        – optional { platforms: [], tone: '', status: '' }
 * @returns {{ campaign, output, error }}
 */
export async function saveCampaignOutput(rawBrand, outputType, generatedData, meta = {}) {
  if (!supabase) return { campaign: null, output: null, error: 'Supabase not configured' }

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { campaign: null, output: null, error: 'Not authenticated' }

  const userId       = user.id
  // ── Normalise: "Nike", " NIKE ", "nike", "Nike — Shoes" all → "nike" ──
  const campaignName = normaliseBrand(rawBrand)

  if (!campaignName) return { campaign: null, output: null, error: 'Brand name is required.' }

  // ── Step 1: find or create the campaign row ──────────────────────
  // Lookup first so we NEVER overwrite existing status/platforms/tone.
  let campaignId, campaignData

  const { data: existing } = await supabase
    .from('campaigns')
    .select('id, campaign_name, status, platforms, tone, created_at, updated_at')
    .eq('user_id', userId)
    .eq('campaign_name', campaignName)
    .maybeSingle()

  if (existing) {
    // Campaign already exists — merge in any new platforms/tone from this save,
    // then touch updated_at. Never overwrite status.
    const mergedPlatforms = existing.platforms || []
    if (Array.isArray(meta.platforms)) {
      meta.platforms.forEach(p => { if (!mergedPlatforms.includes(p)) mergedPlatforms.push(p) })
    }
    // Only update tone if the existing row has none, or if caller provides one
    const mergedTone = (meta.tone && meta.tone.trim()) ? meta.tone.trim() : (existing.tone || '')

    const { data: touched, error: touchErr } = await supabase
      .from('campaigns')
      .update({
        platforms:  mergedPlatforms,
        tone:       mergedTone,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select('id, campaign_name, status, platforms, tone, created_at, updated_at')
      .single()

    if (touchErr) return { campaign: null, output: null, error: touchErr.message }
    campaignId   = touched.id
    campaignData = touched
  } else {
    // Brand-new campaign — insert it
    const { data: created, error: createErr } = await supabase
      .from('campaigns')
      .insert({
        user_id:       userId,
        campaign_name: campaignName,
        status:        meta.status    || 'Draft',
        platforms:     meta.platforms || [],
        tone:          meta.tone      || '',
        updated_at:    new Date().toISOString(),
      })
      .select('id, campaign_name, status, platforms, tone, created_at, updated_at')
      .single()

    if (createErr) {
      // Race condition: another request created it just now — fetch it
      const { data: raced, error: raceErr } = await supabase
        .from('campaigns')
        .select('id, campaign_name, status, platforms, tone, created_at, updated_at')
        .eq('user_id', userId)
        .eq('campaign_name', campaignName)
        .maybeSingle()

      if (raceErr || !raced) return { campaign: null, output: null, error: createErr.message }
      campaignId   = raced.id
      campaignData = raced
    } else {
      campaignId   = created.id
      campaignData = created
    }
  }

  // ── Step 2: insert the output row ─────────────────────────────────
  const { data: output, error: outputError } = await supabase
    .from('campaign_outputs')
    .insert({
      campaign_id:    campaignId,
      user_id:        userId,
      output_type:    outputType,
      generated_data: generatedData,
    })
    .select()
    .single()

  if (outputError) return { campaign: campaignData, output: null, error: outputError.message }

  return { campaign: campaignData, output, error: null }
}

/**
 * Fetch all campaigns for the logged-in user,
 * including which output types have been saved for each.
 * Also includes campaigns shared with the user with 'edit' permission
 * (they appear as active campaign cards for the invitee).
 */
export async function fetchUserCampaigns() {
  if (!supabase) return { data: [], error: 'Supabase not configured' }

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { data: [], error: 'Not authenticated' }

  // ── 1. Own campaigns ────────────────────────────────────────────────
  const { data: ownData, error: ownError } = await supabase
    .from('campaigns')
    .select(`
      id,
      campaign_name,
      status,
      platforms,
      tone,
      created_at,
      updated_at,
      campaign_outputs ( id, output_type )
    `)
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })

  if (ownError) return { data: [], error: ownError.message }

  const ownShaped = (ownData || []).map(c => ({
    id:            c.id,
    campaign_name: c.campaign_name,
    status:        c.status,
    platforms:     c.platforms || [],
    tone:          c.tone      || '',
    created_at:    c.created_at,
    updated_at:    c.updated_at,
    output_count:  c.campaign_outputs?.length ?? 0,
    output_types:  [...new Set((c.campaign_outputs || []).map(o => o.output_type))],
    _isSharedEdit: false,
  }))

  // ── 2. Edit-permission shared campaigns ─────────────────────────────
  // Fetch shared_workspaces rows where this user is the invitee with edit access
  const { data: editShares, error: shareError } = await supabase
    .from('shared_workspaces')
    .select(`
      id,
      campaign_id,
      permission,
      campaigns (
        id,
        campaign_name,
        status,
        platforms,
        tone,
        created_at,
        updated_at,
        campaign_outputs ( id, output_type )
      )
    `)
    .eq('invitee_email', user.email)
    .eq('permission', 'edit')

  if (!shareError && editShares && editShares.length > 0) {
    const ownIds = new Set(ownShaped.map(c => c.id))
    const sharedShaped = editShares
      .filter(s => s.campaigns && !ownIds.has(s.campaigns.id))
      .map(s => {
        const c = s.campaigns
        return {
          id:            c.id,
          campaign_name: c.campaign_name,
          status:        c.status,
          platforms:     c.platforms || [],
          tone:          c.tone      || '',
          created_at:    c.created_at,
          updated_at:    c.updated_at,
          output_count:  c.campaign_outputs?.length ?? 0,
          output_types:  [...new Set((c.campaign_outputs || []).map(o => o.output_type))],
          _isSharedEdit: true,
          _shareId:      s.id,
        }
      })
    return { data: [...ownShaped, ...sharedShaped], error: null }
  }

  return { data: ownShaped, error: null }
}

/**
 * Save a campaign output when the current user is an EDIT-PERMISSION invitee.
 */
export async function saveCampaignOutputToShared(campaignId, outputType, generatedData) {
  if (!supabase) return { output: null, error: 'Supabase not configured' }

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { output: null, error: 'Not authenticated' }

  const { data: shareRow, error: shareCheckErr } = await supabase
    .from('shared_workspaces')
    .select('id, permission')
    .eq('campaign_id', campaignId)
    .eq('invitee_email', user.email)
    .eq('permission', 'edit')
    .maybeSingle()

  if (shareCheckErr || !shareRow) {
    return { output: null, error: 'You do not have edit permission for this campaign.' }
  }

  const { data: output, error: outputError } = await supabase
    .from('campaign_outputs')
    .insert({
      campaign_id:    campaignId,
      user_id:        user.id,
      output_type:    outputType,
      generated_data: generatedData,
    })
    .select()
    .single()

  if (outputError) return { output: null, error: outputError.message }
  return { output, error: null }
}

/**
 * Mark a share row as 'accepted' when the invitee first opens the shared campaign.
 */
export async function markShareAccepted(campaignId) {
  if (!supabase) return
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase
    .from('shared_workspaces')
    .update({ status: 'accepted' })
    .eq('campaign_id', campaignId)
    .eq('invitee_email', user.email)
    .eq('status', 'pending')
}

/**
 * Delete a campaign and all its outputs (cascade handled by DB).
 */
export async function deleteCampaign(campaignId) {
  if (!supabase) return { error: 'Supabase not configured' }

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('campaigns')
    .delete()
    .eq('id', campaignId)
    .eq('user_id', user.id)

  return { error: error ? error.message : null }
}

/**
 * Fetch a single campaign + all its outputs.
 * Works for both the owner AND teammates who have been granted share access.
 */
export async function fetchCampaignWorkspace(campaignId) {
  if (!supabase) return { campaign: null, outputs: [], error: 'Supabase not configured' }

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { campaign: null, outputs: [], error: 'Not authenticated' }

  const { data: ownedCampaign } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', campaignId)
    .eq('user_id', user.id)
    .maybeSingle()

  let campaign = ownedCampaign
  let isSharedAccess = false

  if (!campaign) {
    const { data: shareRow } = await supabase
      .from('shared_workspaces')
      .select('id, permission')
      .eq('campaign_id', campaignId)
      .eq('invitee_email', user.email)
      .maybeSingle()

    if (!shareRow) {
      return { campaign: null, outputs: [], error: 'Campaign not found or access denied.' }
    }

    const { data: sharedCampaign, error: sharedErr } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', campaignId)
      .maybeSingle()

    if (sharedErr || !sharedCampaign) {
      return { campaign: null, outputs: [], error: sharedErr?.message || 'Campaign not found.' }
    }

    campaign = { ...sharedCampaign, _sharePermission: shareRow.permission }
    isSharedAccess = true
  }

  const outputQuery = supabase
    .from('campaign_outputs')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false })

  if (!isSharedAccess) {
    outputQuery.eq('user_id', user.id)
  }

  const { data: outputs, error: outputError } = await outputQuery

  if (outputError) return { campaign, outputs: [], error: outputError.message }

  return { campaign, outputs: outputs || [], error: null }
}

// ─────────────────────────────────────────────────────────────
// SEARCH CAMPAIGNS
// ─────────────────────────────────────────────────────────────
export function searchCampaigns(userInput = '', campaigns = []) {
  const query = userInput.trim().toLowerCase()
  if (!query) return campaigns
  return campaigns.filter(c =>
    String(c.campaign_name || '').toLowerCase().includes(query)
  )
}

// ─────────────────────────────────────────────────────────────
// CAMPAIGN BRIEF
// ─────────────────────────────────────────────────────────────
const BRIEF_KEY_PREFIX = 'campaign_brief_'

function briefKey(userId) {
  return `${BRIEF_KEY_PREFIX}${userId}`
}

export async function saveCampaignBrief(briefData) {
  if (!supabase) return { error: 'Supabase not configured' }

  const { data: { session }, error: authError } = await supabase.auth.getSession()
  if (authError || !session?.user) return { error: 'Not authenticated' }

  try {
    const record = {
      ...briefData,
      saved_at: new Date().toISOString(),
      user_id:  session.user.id,
    }
    localStorage.setItem(briefKey(session.user.id), JSON.stringify(record))
    return { error: null }
  } catch (e) {
    return { error: e.message || 'Failed to save brief.' }
  }
}

export async function fetchCampaignBrief() {
  if (!supabase) return { brief: null, error: 'Supabase not configured' }

  const { data: { session }, error: authError } = await supabase.auth.getSession()
  if (authError || !session?.user) return { brief: null, error: 'Not authenticated' }

  try {
    const raw = localStorage.getItem(briefKey(session.user.id))
    if (!raw) return { brief: null, error: null }
    return { brief: JSON.parse(raw), error: null }
  } catch (e) {
    return { brief: null, error: e.message || 'Failed to load brief.' }
  }
}

// ─────────────────────────────────────────────────────────────
// SHARED WORKSPACES
// ─────────────────────────────────────────────────────────────
export async function shareCampaign(campaignId, inviteeEmail, permission = 'view') {
  if (!supabase) return { share: null, error: 'Supabase not configured' }

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { share: null, error: 'Not authenticated' }

  const email = inviteeEmail.trim().toLowerCase()
  if (!email) return { share: null, error: 'Email is required.' }
  if (email === user.email.toLowerCase()) return { share: null, error: 'You cannot share a campaign with yourself.' }

  const { data, error } = await supabase
    .from('shared_workspaces')
    .upsert(
      {
        campaign_id:   campaignId,
        owner_id:      user.id,
        invitee_email: email,
        permission,
        status:        'pending',
      },
      { onConflict: 'campaign_id,invitee_email', ignoreDuplicates: false }
    )
    .select()
    .single()

  if (error) return { share: null, error: error.message }
  return { share: data, error: null }
}

export async function revokeShare(shareId) {
  if (!supabase) return { error: 'Supabase not configured' }

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('shared_workspaces')
    .delete()
    .eq('id', shareId)
    .eq('owner_id', user.id)

  return { error: error ? error.message : null }
}

export async function updateSharePermission(shareId, permission) {
  if (!supabase) return { error: 'Supabase not configured' }

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('shared_workspaces')
    .update({ permission })
    .eq('id', shareId)
    .eq('owner_id', user.id)

  return { error: error ? error.message : null }
}

export async function fetchOutgoingShares() {
  if (!supabase) return { data: [], error: 'Supabase not configured' }

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { data: [], error: 'Not authenticated' }

  const { data, error } = await supabase
    .from('shared_workspaces')
    .select(`
      id,
      invitee_email,
      permission,
      status,
      created_at,
      campaigns ( id, campaign_name, status, platforms, updated_at )
    `)
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return { data: [], error: error.message }
  return { data: data || [], error: null }
}

export async function fetchIncomingShares() {
  if (!supabase) return { data: [], error: 'Supabase not configured' }

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { data: [], error: 'Not authenticated' }

  const { data, error } = await supabase
    .from('shared_workspaces')
    .select(`
      id,
      owner_id,
      permission,
      status,
      created_at,
      campaigns ( id, campaign_name, status, platforms, updated_at )
    `)
    .eq('invitee_email', user.email)
    .order('created_at', { ascending: false })

  if (error) return { data: [], error: error.message }
  return { data: data || [], error: null }
}

export async function fetchCampaignShares(campaignId) {
  if (!supabase) return { data: [], error: 'Supabase not configured' }

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { data: [], error: 'Not authenticated' }

  const { data, error } = await supabase
    .from('shared_workspaces')
    .select('id, invitee_email, permission, status, created_at')
    .eq('campaign_id', campaignId)
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return { data: [], error: error.message }
  return { data: data || [], error: null }
}

// ─────────────────────────────────────────────────────────────
// EMAIL INVITE — calls Express /send-invite endpoint
// ─────────────────────────────────────────────────────────────

/**
 * Send a workspace share invite email via the backend.
 *
 * - Always uses VITE_API_URL (set in frontend/.env / Vercel env vars).
 * - Never falls back to localhost — in production there is no local server.
 * - Has a 20-second AbortController timeout so the UI never hangs
 *   (Render free tier cold-starts can take 30–60 s; we fail fast and tell the user).
 *
 * @param {string} toEmail
 * @param {string} campaignName
 * @param {'view'|'edit'} permission
 * @returns {Promise<{ success: boolean, error: string|null }>}
 */
export async function sendInviteEmail(toEmail, campaignName, permission = 'view') {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  // VITE_API_URL must be set in frontend/.env AND in Vercel environment variables.
  const apiUrl = import.meta.env.VITE_API_URL
  if (!apiUrl) {
    console.error('[sendInviteEmail] VITE_API_URL is not set — cannot reach email backend.')
    return { success: false, error: 'Email service not configured (missing VITE_API_URL).' }
  }

  // 60-second timeout — Render free-tier cold-starts can take 30-50 s;
  // we need to wait long enough for the backend to wake up and send the email.
  const controller = new AbortController()
  const timeoutId  = setTimeout(() => controller.abort(), 60000)

  try {
    const res = await fetch(`${apiUrl}/send-invite`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      signal:  controller.signal,
      body: JSON.stringify({
        toEmail,
        ownerEmail:   user.email,
        campaignName,
        permission,
      }),
    })

    clearTimeout(timeoutId)

    let json
    try { json = await res.json() } catch { json = {} }

    if (!res.ok) {
      const errMsg = json.error || json.detail || `Server returned ${res.status}`
      console.error('[sendInviteEmail] Backend error:', errMsg)
      return { success: false, error: errMsg }
    }

    return { success: true, error: null }

  } catch (err) {
    clearTimeout(timeoutId)

    if (err.name === 'AbortError') {
      console.error('[sendInviteEmail] Request timed out after 60 s — backend may be cold-starting.')
      return {
        success: false,
        error:   'The email server took too long to respond. The share was saved — the recipient can still log in to access it.',
      }
    }

    console.error('[sendInviteEmail] Network error:', err.message)
    return { success: false, error: `Could not reach email service: ${err.message}` }
  }
}
