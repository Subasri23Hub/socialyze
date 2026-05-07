/**
 * emailService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * CampaignAI — Email Service (Nodemailer-based)
 * Fixes:
 *   1. Branding updated from "Socialyze" → "CampaignAI"
 *   2. "Open CampaignAI →" button deep-links to the exact shared campaign
 *      (?share=<campaignId>) so the recipient lands directly in the workspace
 *   3. Permission pill correctly shows "View Only" vs "✏️ View & Edit"
 *      with distinct colors (blue = view, orange = edit)
 *
 * Team   : Subasri B | Gautham Krishnan K | Ashwin D | Vinjarapu Ajay Kumar
 * Company: Sourcesys Technologies
 */

const nodemailer = require('nodemailer');

// ─────────────────────────────────────────────────────────────────────────────
// TRANSPORT FACTORY
// ─────────────────────────────────────────────────────────────────────────────
function createTransport() {
  const provider = (process.env.EMAIL_PROVIDER || 'gmail').toLowerCase();

  if (provider === 'brevo') {
    return nodemailer.createTransport({
      host:   'smtp-relay.brevo.com',
      port:   587,
      secure: false,
      auth: {
        user: process.env.BREVO_SMTP_USER,
        pass: process.env.BREVO_SMTP_KEY,
      },
    });
  }

  if (provider === 'smtp') {
    return nodemailer.createTransport({
      host:   process.env.SMTP_HOST,
      port:   Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  // Gmail App Password (default)
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASS,
    },
  });
}

const transporter = createTransport();

// ─────────────────────────────────────────────────────────────────────────────
// FROM ADDRESS
// ─────────────────────────────────────────────────────────────────────────────
function fromAddress() {
  const name  = process.env.EMAIL_FROM_NAME  || 'CampaignAI';
  const email = process.env.EMAIL_FROM_EMAIL
    || process.env.GMAIL_USER
    || process.env.BREVO_SMTP_USER
    || process.env.SMTP_USER
    || 'noreply@campaignai.app';
  return `"${name}" <${email}>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// HTML TEMPLATE — Campaign Share Invite
// FIX 1: CampaignAI branding
// FIX 2: Deep-link URL includes ?share=<campaignId>
// FIX 3: Permission pill is blue for view, orange for edit
// ─────────────────────────────────────────────────────────────────────────────
function buildInviteHTML({ ownerEmail, campaignName, permission, appUrl, campaignId }) {
  const isEdit    = permission === 'edit';
  const permLabel = isEdit ? 'View & Edit' : 'View Only';
  const permBg    = isEdit ? '#FFF7ED'     : '#EFF6FF';
  const permColor = isEdit ? '#EA580C'     : '#2563EB';
  const permBdr   = isEdit ? '#FED7AA'     : '#BFDBFE';
  const permIcon  = isEdit ? '✏️'          : '👁';

  // Deep-link: landing on ?share=<campaignId> will be picked up by App.jsx
  // to open that workspace directly after sign-in.
  const deepLink = campaignId
    ? `${appUrl}?share=${campaignId}`
    : appUrl;

  const safeCamp = campaignName.charAt(0).toUpperCase() + campaignName.slice(1);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Campaign Invite — CampaignAI</title>
  <style>
    body  { margin:0; padding:0; background:#F8FAFC; font-family:'Segoe UI',Arial,sans-serif; }
    .wrap { max-width:520px; margin:40px auto; background:#fff; border-radius:16px;
            border:1px solid #E2E8F0; box-shadow:0 4px 24px rgba(15,23,42,.08); overflow:hidden; }
    .hdr  { background:linear-gradient(135deg,#2563EB,#0EA5E9); padding:28px 36px 24px; text-align:center; }
    .hdr-logo { display:inline-flex; align-items:center; gap:10px; margin-bottom:4px; }
    .hdr-lightning { font-size:28px; line-height:1; }
    .hdr-title { color:#fff; font-size:22px; font-weight:800; letter-spacing:-0.03em; margin:0; }
    .hdr-sub   { color:rgba(255,255,255,.82); font-size:13.5px; margin:6px 0 0; }
    .body { padding:30px 36px; }
    .greeting { font-size:15px; color:#0F172A; font-weight:600; margin-bottom:8px; }
    .para { font-size:14px; color:#475569; line-height:1.65; margin-bottom:16px; }
    .card { background:#F8FAFC; border:1.5px solid #E2E8F0; border-radius:12px;
            padding:18px 20px; margin:20px 0; }
    .card-row { display:flex; justify-content:space-between; align-items:center;
                margin-bottom:10px; font-size:13px; }
    .card-row:last-child { margin-bottom:0; }
    .card-label { color:#94A3B8; font-weight:700; text-transform:uppercase;
                  font-size:10.5px; letter-spacing:.07em; }
    .card-val   { color:#0F172A; font-weight:600; font-size:13.5px; }
    .perm-pill  { display:inline-flex; align-items:center; gap:5px;
                  border-radius:20px; padding:4px 12px; font-size:12px; font-weight:700; }
    .cta-wrap   { text-align:center; margin:28px 0 8px; }
    .cta-btn    { display:inline-block; background:linear-gradient(135deg,#2563EB,#0EA5E9);
                  color:#fff !important; text-decoration:none; font-size:15px; font-weight:700;
                  padding:13px 36px; border-radius:10px; letter-spacing:-.01em;
                  box-shadow:0 4px 14px rgba(37,99,235,.35); }
    .divider { height:1px; background:#F1F5F9; margin:24px 0; }
    .footer { padding:18px 36px; background:#F8FAFC; border-top:1px solid #F1F5F9;
              text-align:center; font-size:12px; color:#CBD5E1; line-height:1.7; }
    .access-note { background:${isEdit ? '#FFF7ED' : '#F0F9FF'};
                   border:1.5px solid ${isEdit ? '#FED7AA' : '#BAE6FD'};
                   border-radius:10px; padding:12px 14px; margin-top:18px;
                   font-size:13px; color:${isEdit ? '#92400E' : '#0369A1'}; line-height:1.6;
                   display:flex; align-items:flex-start; gap:10px; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="hdr">
      <div class="hdr-logo">
        <span class="hdr-lightning">⚡</span>
        <p class="hdr-title">CampaignAI</p>
      </div>
      <p class="hdr-sub">AI Social Media Campaign Generator</p>
    </div>
    <div class="body">
      <p class="greeting">You've been invited to collaborate! 🎉</p>
      <p class="para">
        <strong>${ownerEmail}</strong> has shared the campaign
        <strong>"${safeCamp}"</strong> with you on CampaignAI.
        You have permission to <strong>${isEdit ? 'view and edit' : 'view'}</strong> this workspace.
      </p>

      <div class="card">
        <div class="card-row">
          <span class="card-label">Campaign</span>
          <span class="card-val">${safeCamp}</span>
        </div>
        <div class="card-row">
          <span class="card-label">Shared by</span>
          <span class="card-val">${ownerEmail}</span>
        </div>
        <div class="card-row">
          <span class="card-label">Your Permission</span>
          <span class="perm-pill" style="background:${permBg};color:${permColor};border:1px solid ${permBdr};">
            ${permIcon} ${permLabel}
          </span>
        </div>
      </div>

      <div class="cta-wrap">
        <a href="${deepLink}" class="cta-btn">Open CampaignAI →</a>
      </div>

      <div class="access-note">
        <span style="font-size:16px;flex-shrink:0;">${isEdit ? '✏️' : 'ℹ️'}</span>
        <span>
          Sign in with <strong>this email address</strong> to open the workspace directly.
          ${isEdit
            ? 'You can generate new content and save outputs to this campaign.'
            : 'You can browse all saved outputs. Ask the owner to upgrade your permission to generate new content.'}
        </span>
      </div>

      <div class="divider"></div>
      <p class="para" style="font-size:13px;">
        If you weren't expecting this invite, you can safely ignore this email.
        Your access is tied to your email address — no action needed unless you want to collaborate.
      </p>
    </div>
    <div class="footer">
      <strong>CampaignAI</strong> — Sourcesys Technologies<br/>
      Team: Subasri B · Gautham Krishnan K · Ashwin D · Vinjarapu Ajay Kumar
    </div>
  </div>
</body>
</html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// PLAIN-TEXT fallback
// ─────────────────────────────────────────────────────────────────────────────
function buildInviteText({ ownerEmail, campaignName, permission, appUrl, campaignId }) {
  const permLabel = permission === 'edit' ? 'View & Edit' : 'View Only';
  const deepLink  = campaignId ? `${appUrl}?share=${campaignId}` : appUrl;
  return `You've been invited to collaborate on CampaignAI!

${ownerEmail} has shared the campaign "${campaignName}" with you.
Permission: ${permLabel}

Click below to open CampaignAI and go directly to the shared workspace:
${deepLink}

Sign in with this email address to access the workspace.

— CampaignAI · Sourcesys Technologies`;
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Send a workspace share invitation email.
 *
 * @param {object} opts
 * @param {string} opts.toEmail       — recipient
 * @param {string} opts.ownerEmail    — who is sharing
 * @param {string} opts.campaignName  — campaign being shared
 * @param {string} [opts.campaignId]  — campaign UUID for deep-linking (NEW)
 * @param {'view'|'edit'} opts.permission
 * @param {string} [opts.appUrl]      — base URL of the app (defaults to APP_URL env var)
 * @returns {Promise<{ success: boolean, error: string|null }>}
 */
async function sendShareInvite({ toEmail, ownerEmail, campaignName, campaignId, permission = 'view', appUrl }) {
  const url = appUrl || process.env.APP_URL || 'https://socialyze-nu.vercel.app';
  try {
    const info = await transporter.sendMail({
      from:    fromAddress(),
      to:      toEmail,
      subject: `${ownerEmail} shared "${campaignName}" with you on CampaignAI`,
      text:    buildInviteText({ ownerEmail, campaignName, permission, appUrl: url, campaignId }),
      html:    buildInviteHTML({ ownerEmail, campaignName, permission, appUrl: url, campaignId }),
    });
    console.log(`[emailService] Share invite sent to ${toEmail} — messageId: ${info.messageId}`);
    return { success: true, error: null };
  } catch (err) {
    console.error('[emailService] Failed to send invite:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Verify the SMTP connection on server startup.
 */
async function verifyConnection() {
  try {
    await transporter.verify();
    console.log('✅  Email service ready');
  } catch (err) {
    console.warn('⚠️  Email service not configured or unreachable:', err.message);
    console.warn('   Set EMAIL_PROVIDER + credentials in backend/.env to enable invite emails.');
  }
}

module.exports = { sendShareInvite, verifyConnection };
