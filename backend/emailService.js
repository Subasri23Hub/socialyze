/**
 * emailService.js — Socialyze
 * Sends workspace share invite emails.
 *
 * Provider priority (set EMAIL_PROVIDER in Render env):
 *   resend  — Recommended. Delivers to ANY email. Free 100/day. Set RESEND_API_KEY.
 *   gmail   — Only reliably delivers to Gmail addresses via SMTP App Password.
 *   brevo   — Transactional SMTP. Set BREVO_SMTP_USER + BREVO_SMTP_KEY.
 *   smtp    — Any custom SMTP. Set SMTP_HOST/PORT/USER/PASS.
 *
 * Team: Subasri B | Gautham Krishnan K | Ashwin D | Vinjarapu Ajay Kumar
 * Company: Sourcesys Technologies
 */

const nodemailer = require('nodemailer');

// ─────────────────────────────────────────────────────────────────────────────
// APP URL — never localhost in production
// ─────────────────────────────────────────────────────────────────────────────
const PRODUCTION_APP_URL = (process.env.APP_URL || '').trim().replace(/\/$/, '');
const VERCEL_APP_URL     = 'https://socialyze-nu.vercel.app';

function resolveAppUrl(override) {
  if (override && override.trim() && !override.includes('localhost'))
    return override.trim().replace(/\/$/, '');
  if (PRODUCTION_APP_URL && !PRODUCTION_APP_URL.includes('localhost'))
    return PRODUCTION_APP_URL;
  return VERCEL_APP_URL;
}

// ─────────────────────────────────────────────────────────────────────────────
// TRANSPORT FACTORY
// ─────────────────────────────────────────────────────────────────────────────
function createTransport() {
  const provider = (process.env.EMAIL_PROVIDER || 'gmail').toLowerCase();

  if (provider === 'resend') {
    // Resend SMTP relay — delivers to any address, 100 free/day
    // Get API key at https://resend.com (free account, no credit card)
    // Set EMAIL_PROVIDER=resend and RESEND_API_KEY=re_xxxx in Render env
    return nodemailer.createTransport({
      host:   'smtp.resend.com',
      port:   465,
      secure: true,
      auth: {
        user: 'resend',
        pass: process.env.RESEND_API_KEY,
      },
    });
  }

  if (provider === 'brevo') {
    return nodemailer.createTransport({
      host: 'smtp-relay.brevo.com', port: 587, secure: false,
      auth: { user: process.env.BREVO_SMTP_USER, pass: process.env.BREVO_SMTP_KEY },
    });
  }

  if (provider === 'smtp') {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }

  // Gmail App Password — NOTE: only reliably delivers to Gmail addresses.
  // For sending to any email address, switch to EMAIL_PROVIDER=resend above.
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASS },
  });
}

const transporter = createTransport();

// ─────────────────────────────────────────────────────────────────────────────
// FROM ADDRESS
// When using Resend free tier, FROM must be onboarding@resend.dev
// (until you verify your own domain at resend.com/domains)
// Set EMAIL_FROM_EMAIL=onboarding@resend.dev when EMAIL_PROVIDER=resend
// ─────────────────────────────────────────────────────────────────────────────
function fromAddress() {
  const provider = (process.env.EMAIL_PROVIDER || 'gmail').toLowerCase();
  const name     = process.env.EMAIL_FROM_NAME || 'Socialyze';

  let email;
  if (provider === 'resend') {
    // Resend free tier requires this exact from address until you verify a domain
    email = process.env.EMAIL_FROM_EMAIL || 'onboarding@resend.dev';
  } else {
    email = process.env.EMAIL_FROM_EMAIL || process.env.GMAIL_USER || 'noreply@socialyze.app';
  }

  return '"' + name + '" <' + email + '>';
}

// ─────────────────────────────────────────────────────────────────────────────
// HTML TEMPLATE — Socialyze branding, 🚀 rocket, "Open Socialyze →" button
// ─────────────────────────────────────────────────────────────────────────────
function buildInviteHTML({ ownerEmail, campaignName, permission, appUrl, campaignId }) {
  const isEdit    = permission === 'edit';
  const permLabel = isEdit ? 'view & edit' : 'view';
  const permPill  = isEdit ? 'view &amp; edit' : 'view only';
  const permBg    = isEdit ? '#FFF7ED' : '#EFF6FF';
  const permColor = isEdit ? '#EA580C' : '#2563EB';
  const permBdr   = isEdit ? '#FED7AA' : '#BFDBFE';

  const safeUrl  = resolveAppUrl(appUrl);
  const deepLink = campaignId
    ? safeUrl + '?share=' + encodeURIComponent(campaignId)
    : safeUrl;
  const safeCamp = campaignName.charAt(0).toUpperCase() + campaignName.slice(1);

  return '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/>'
    + '<meta name="viewport" content="width=device-width,initial-scale=1"/>'
    + '<title>Campaign Invite - Socialyze</title>'
    + '<style>'
    + 'body{margin:0;padding:0;background:#F8FAFC;font-family:\'Segoe UI\',Arial,sans-serif;}'
    + '.wrap{max-width:520px;margin:40px auto;background:#fff;border-radius:16px;border:1px solid #E2E8F0;box-shadow:0 4px 24px rgba(15,23,42,.08);overflow:hidden;}'
    + '.hdr{background:linear-gradient(135deg,#2563EB,#0EA5E9);padding:28px 36px 24px;text-align:center;}'
    + '.hdr-title{color:#fff;font-size:22px;font-weight:800;letter-spacing:-0.03em;margin:0;}'
    + '.hdr-sub{color:rgba(255,255,255,.82);font-size:13.5px;margin:6px 0 0;}'
    + '.body{padding:30px 36px;}'
    + '.greeting{font-size:15px;color:#0F172A;font-weight:600;margin-bottom:8px;}'
    + '.para{font-size:14px;color:#475569;line-height:1.65;margin-bottom:16px;}'
    + '.card{background:#F8FAFC;border:1.5px solid #E2E8F0;border-radius:12px;padding:18px 20px;margin:20px 0;}'
    + '.card-row{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;font-size:13px;}'
    + '.card-row:last-child{margin-bottom:0;}'
    + '.card-label{color:#94A3B8;font-weight:700;text-transform:uppercase;font-size:10.5px;letter-spacing:.07em;}'
    + '.card-val{color:#0F172A;font-weight:600;font-size:13.5px;}'
    + '.perm-pill{display:inline-flex;align-items:center;gap:5px;border-radius:20px;padding:4px 12px;font-size:12px;font-weight:700;}'
    + '.cta-wrap{text-align:center;margin:28px 0 8px;}'
    + '.cta-btn{display:inline-block;background:linear-gradient(135deg,#2563EB,#0EA5E9);color:#fff!important;text-decoration:none;font-size:15px;font-weight:700;padding:13px 36px;border-radius:10px;box-shadow:0 4px 14px rgba(37,99,235,.35);}'
    + '.divider{height:1px;background:#F1F5F9;margin:24px 0;}'
    + '.footer{padding:18px 36px;background:#F8FAFC;border-top:1px solid #F1F5F9;text-align:center;font-size:12px;color:#CBD5E1;line-height:1.7;}'
    + '</style></head><body>'
    + '<div class="wrap">'
    + '<div class="hdr">'
    + '<p style="font-size:32px;margin:0 0 4px;">&#128640;</p>'
    + '<p class="hdr-title">Socialyze</p>'
    + '<p class="hdr-sub">AI Social Media Campaign Generator</p>'
    + '</div>'
    + '<div class="body">'
    + '<p class="greeting">You\'ve been invited to collaborate! &#127881;</p>'
    + '<p class="para"><strong>' + ownerEmail + '</strong> has shared a campaign workspace with you on Socialyze. You can <strong>' + permLabel + '</strong> the campaign and all its generated outputs.</p>'
    + '<div class="card">'
    + '<div class="card-row"><span class="card-label">Campaign</span><span class="card-val">' + safeCamp + '</span></div>'
    + '<div class="card-row"><span class="card-label">Shared by</span><span class="card-val">' + ownerEmail + '</span></div>'
    + '<div class="card-row"><span class="card-label">Permission</span>'
    + '<span class="perm-pill" style="background:' + permBg + ';color:' + permColor + ';border:1px solid ' + permBdr + ';">' + permPill + '</span>'
    + '</div></div>'
    + '<div class="cta-wrap"><a href="' + deepLink + '" class="cta-btn">Open Socialyze &#8594;</a></div>'
    + '<p class="para" style="font-size:13px;margin-top:20px;">Sign in with <strong>this email address</strong> to access the shared workspace directly.</p>'
    + '<div class="divider"></div>'
    + '<p class="para" style="font-size:13px;">If you weren\'t expecting this invite, you can safely ignore this email.</p>'
    + '</div>'
    + '<div class="footer"><strong>Socialyze</strong> &mdash; Sourcesys Technologies<br/>'
    + 'Subasri B &middot; Gautham Krishnan K &middot; Ashwin D &middot; Vinjarapu Ajay Kumar</div>'
    + '</div></body></html>';
}

function buildInviteText({ ownerEmail, campaignName, permission, appUrl, campaignId }) {
  const permLabel = permission === 'edit' ? 'View & Edit' : 'View Only';
  const safeUrl   = resolveAppUrl(appUrl);
  const deepLink  = campaignId
    ? safeUrl + '?share=' + encodeURIComponent(campaignId)
    : safeUrl;
  return 'You\'ve been invited to collaborate on Socialyze!\n\n'
    + ownerEmail + ' has shared "' + campaignName + '" with you.\n'
    + 'Permission: ' + permLabel + '\n\n'
    + 'Open Socialyze:\n' + deepLink + '\n\n'
    + 'Sign in with this email address to access the workspace.\n\n'
    + '-- Socialyze - Sourcesys Technologies';
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────
async function sendShareInvite({ toEmail, ownerEmail, campaignName, campaignId, permission, appUrl }) {
  permission = permission || 'view';
  const url      = resolveAppUrl(appUrl);
  const provider = (process.env.EMAIL_PROVIDER || 'gmail').toLowerCase();

  console.log('[emailService] provider=' + provider + ' from=' + fromAddress());
  console.log('[emailService] to=' + toEmail + ' deepLink=' + url + (campaignId ? '?share=' + campaignId : ''));

  try {
    const info = await transporter.sendMail({
      from:    fromAddress(),
      to:      toEmail,
      subject: ownerEmail + ' shared "' + campaignName + '" with you on Socialyze',
      text:    buildInviteText({ ownerEmail, campaignName, permission, appUrl: url, campaignId }),
      html:    buildInviteHTML({ ownerEmail, campaignName, permission, appUrl: url, campaignId }),
    });
    console.log('[emailService] Sent to ' + toEmail + ' id=' + info.messageId);
    return { success: true, error: null };
  } catch (err) {
    console.error('[emailService] FAILED to ' + toEmail + ': ' + err.message);
    return { success: false, error: err.message };
  }
}

async function verifyConnection() {
  const url      = resolveAppUrl(null);
  const provider = (process.env.EMAIL_PROVIDER || 'gmail').toLowerCase();
  console.log('[emailService] provider=' + provider + ' APP_URL=' + url);
  if (url.includes('localhost'))
    console.error('[emailService] WARNING: APP_URL is localhost — fix on Render dashboard!');
  if (provider === 'gmail')
    console.warn('[emailService] NOTE: Gmail SMTP only reliably delivers to Gmail addresses. For any-email delivery, set EMAIL_PROVIDER=resend and add RESEND_API_KEY on Render.');
  try {
    await transporter.verify();
    console.log('[emailService] Transport ready (' + provider + ')');
  } catch (err) {
    console.warn('[emailService] Transport not ready: ' + err.message);
  }
}

module.exports = { sendShareInvite, verifyConnection };
