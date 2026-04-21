/**
 * Supabase Edge Function — send-share-invite
 * ─────────────────────────────────────────────────────────────────────────────
 * AI Social Media Campaign Generator | Sourcesys Technologies
 *
 * Triggered by a Supabase Database Webhook on INSERT into shared_workspaces.
 *
 * ── Resend free-tier limitation ──────────────────────────────────────────────
 * Without a verified domain, Resend only allows sending to the account owner's
 * own email address.  To send to ANY recipient you must verify a domain at
 * resend.com/domains and set FROM_EMAIL to an address on that domain.
 *
 * Until then, this function:
 *   • Sends the real email only when invitee_email === RESEND_OWNER_EMAIL
 *   • For all other recipients it logs a warning and returns 200 (so the DB
 *     INSERT still succeeds and the workspace row is created normally)
 *
 * Required secrets (Supabase Dashboard → Edge Functions → Secrets):
 *   RESEND_API_KEY       — from resend.com
 *   RESEND_OWNER_EMAIL   — the email you signed up to Resend with
 *                          (e.g. shubkutt23@gmail.com)
 *                          Remove / leave blank once a domain is verified.
 *   WEBHOOK_SECRET       — random string matching webhook_trigger.sql
 *   APP_URL              — frontend URL e.g. http://localhost:5173
 *   FROM_EMAIL           — onboarding@resend.dev  (free tier)
 *                          OR noreply@yourdomain.com (after domain verification)
 *
 * Auto-injected by Supabase (do NOT set manually):
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
}

Deno.serve(async (req: Request) => {
  // ── CORS pre-flight ──────────────────────────────────────────
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // ── 1. Verify webhook secret ────────────────────────────────
    const webhookSecret = Deno.env.get('WEBHOOK_SECRET')
    if (webhookSecret) {
      const incoming = req.headers.get('x-webhook-secret')
      if (incoming !== webhookSecret) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    // ── 2. Parse webhook payload ────────────────────────────────
    const payload = await req.json()
    const record  = payload?.record

    if (!record || payload?.type !== 'INSERT') {
      return new Response(JSON.stringify({ message: 'Not an INSERT event — skipped.' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { invitee_email, campaign_id, owner_id, permission } = record
    if (!invitee_email || !campaign_id || !owner_id) {
      return new Response(JSON.stringify({ error: 'Missing required fields in record.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── 3. Check Resend free-tier restriction ───────────────────
    // RESEND_OWNER_EMAIL is the email you registered with on resend.com.
    // On the free tier (no verified domain), Resend only allows sending
    // to this address.  Once you verify a domain, delete this secret and
    // the check below becomes a no-op.
    const resendOwnerEmail = Deno.env.get('RESEND_OWNER_EMAIL') || ''

    if (resendOwnerEmail && invitee_email.toLowerCase() !== resendOwnerEmail.toLowerCase()) {
      // The share row has already been saved to the DB — the feature works,
      // we just can't send the email until a domain is verified.
      console.warn(
        `⚠️  Email skipped (Resend free tier): cannot send to ${invitee_email}. ` +
        `Verify a domain at resend.com/domains to enable sending to any recipient.`
      )
      return new Response(
        JSON.stringify({
          success: true,
          email_sent: false,
          reason: 'Resend free tier — email skipped for non-owner recipient. Verify a domain to enable.',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ── 4. Fetch campaign name + owner email (service role) ─────
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const [{ data: campaign }, { data: ownerProfile }] = await Promise.all([
      supabaseAdmin
        .from('campaigns')
        .select('campaign_name')
        .eq('id', campaign_id)
        .single(),
      supabaseAdmin
        .from('profiles')
        .select('email, full_name')
        .eq('id', owner_id)
        .single(),
    ])

    const campaignName = campaign?.campaign_name
      ? campaign.campaign_name.charAt(0).toUpperCase() + campaign.campaign_name.slice(1)
      : 'a campaign'

    const ownerEmail = ownerProfile?.email    || 'A teammate'
    const ownerName  = ownerProfile?.full_name || ownerEmail.split('@')[0]
    const permLabel  = permission === 'edit' ? 'view and edit' : 'view'
    const appUrl     = Deno.env.get('APP_URL') || 'http://localhost:5173'

    // ── FROM_EMAIL ───────────────────────────────────────────────
    // Free tier default : onboarding@resend.dev
    // After domain verification: noreply@yourdomain.com
    const fromEmail = Deno.env.get('FROM_EMAIL') || 'onboarding@resend.dev'
    const resendKey = Deno.env.get('RESEND_API_KEY')

    if (!resendKey) {
      console.error('RESEND_API_KEY is not set.')
      return new Response(JSON.stringify({ error: 'Email service not configured.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── 5. Build email HTML ─────────────────────────────────────
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>CampaignAI — You've been invited</title>
</head>
<body style="margin:0;padding:0;background:#F8FAFC;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:16px;border:1px solid #E2E8F0;overflow:hidden;box-shadow:0 2px 16px rgba(15,23,42,.07);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#2563EB,#0EA5E9);padding:28px 36px;text-align:center;">
              <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr>
                  <td>
                    <div style="width:38px;height:38px;background:rgba(255,255,255,.20);border-radius:10px;display:inline-flex;align-items:center;justify-content:center;font-size:20px;vertical-align:middle;">⚡</div>
                  </td>
                  <td style="padding-left:10px;">
                    <span style="font-size:20px;font-weight:800;color:#FFFFFF;letter-spacing:-0.03em;vertical-align:middle;">CampaignAI</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 36px 28px;">
              <p style="margin:0 0 8px;font-size:22px;font-weight:800;color:#0F172A;letter-spacing:-0.025em;line-height:1.25;">
                You've been invited to collaborate 🎉
              </p>
              <p style="margin:0 0 24px;font-size:14px;color:#64748B;line-height:1.6;">
                <strong style="color:#0F172A;">${ownerName}</strong> has shared the campaign
                <strong style="color:#2563EB;">"${campaignName}"</strong>
                with you on CampaignAI. You have permission to <strong>${permLabel}</strong> this workspace.
              </p>

              <!-- Campaign info card -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#F0F6FF;border:1.5px solid #BFDBFE;border-radius:12px;margin-bottom:28px;">
                <tr>
                  <td style="padding:18px 20px;">
                    <p style="margin:0 0 4px;font-size:10px;font-weight:700;letter-spacing:0.10em;text-transform:uppercase;color:#64748B;">Campaign</p>
                    <p style="margin:0 0 12px;font-size:17px;font-weight:700;color:#0F172A;letter-spacing:-0.015em;">${campaignName}</p>
                    <p style="margin:0 0 4px;font-size:10px;font-weight:700;letter-spacing:0.10em;text-transform:uppercase;color:#64748B;">Shared by</p>
                    <p style="margin:0 0 12px;font-size:13.5px;color:#334155;">${ownerName} &lt;${ownerEmail}&gt;</p>
                    <p style="margin:0 0 4px;font-size:10px;font-weight:700;letter-spacing:0.10em;text-transform:uppercase;color:#64748B;">Your Permission</p>
                    <span style="display:inline-block;font-size:12px;font-weight:700;color:${permission === 'edit' ? '#EA580C' : '#2563EB'};background:${permission === 'edit' ? '#FFF7ED' : '#EFF6FF'};border:1px solid ${permission === 'edit' ? '#FED7AA' : '#BFDBFE'};border-radius:20px;padding:4px 12px;">
                      ${permission === 'edit' ? '✏️ Can Edit' : '👁 View Only'}
                    </span>
                  </td>
                </tr>
              </table>

              <!-- CTA -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${appUrl}"
                       style="display:inline-block;background:linear-gradient(135deg,#2563EB,#0EA5E9);color:#FFFFFF;font-size:15px;font-weight:700;text-decoration:none;border-radius:10px;padding:14px 36px;letter-spacing:-0.01em;box-shadow:0 4px 14px rgba(37,99,235,.35);">
                      Open CampaignAI →
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:24px 0 0;font-size:12px;color:#94A3B8;line-height:1.6;text-align:center;">
                Log in with this email address (<strong>${invitee_email}</strong>) to access the shared workspace.<br/>
                The workspace will appear under <strong>Shared Workspaces → Shared With Me</strong>.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#F8FAFC;border-top:1px solid #F1F5F9;padding:18px 36px;text-align:center;">
              <p style="margin:0;font-size:11.5px;color:#CBD5E1;line-height:1.7;">
                <strong style="color:#94A3B8;">CampaignAI</strong> — AI Social Media Campaign Generator<br/>
                Sourcesys Technologies · Team: Subasri B · Gautham Krishnan K · Ashwin D · Vinjarapu Ajay Kumar<br/>
                If you did not expect this invite, you can safely ignore this email.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

    // ── 6. Send via Resend ──────────────────────────────────────
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        from:    `CampaignAI <${fromEmail}>`,
        to:      [invitee_email],
        subject: `${ownerName} invited you to collaborate on "${campaignName}" — CampaignAI`,
        html,
      }),
    })

    const resendData = await resendResponse.json()

    if (!resendResponse.ok) {
      console.error('Resend error:', resendData)
      return new Response(JSON.stringify({ error: 'Failed to send email.', detail: resendData }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log(`✅ Invite email sent to ${invitee_email} for campaign "${campaignName}"`)
    return new Response(JSON.stringify({ success: true, email_sent: true, email_id: resendData.id }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error('Edge function error:', err)
    return new Response(JSON.stringify({ error: err.message || 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
