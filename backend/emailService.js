/**
 * emailService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Socialyze — Email Service (Nodemailer-based)
 * Replaces Resend. Works with:
 *   • Gmail App Password  (easiest for dev — no domain needed)
 *   • Brevo SMTP          (300 free emails/day — best for production)
 *   • Any standard SMTP
 *
 * Setup: see .env.example additions at the bottom of this file.
 *
 * Team   : Subasri B | Gautham Krishnan K | Ashwin D | Vinjarapu Ajay Kumar
 * Company: Sourcesys Technologies
 */

const nodemailer = require('nodemailer');

// ─────────────────────────────────────────────────────────────────────────────
// TRANSPORT FACTORY
// Reads EMAIL_PROVIDER from .env: 'gmail' | 'brevo' | 'smtp' (default: gmail)
// ─────────────────────────────────────────────────────────────────────────────
function createTransport() {
  const provider = (process.env.EMAIL_PROVIDER || 'gmail').toLowerCase();

  if (provider === 'brevo') {
    // ── Brevo (Sendinblue) SMTP ──────────────────────────────────────────────
    // Free: 300 emails/day · No domain verification needed
    // Sign up: https://brevo.com → SMTP & API → SMTP Keys
    return nodemailer.createTransport({
      host:   'smtp-relay.brevo.com',
      port:   587,
      secure: false,
      auth: {
        user: process.env.BREVO_SMTP_USER,   // your Brevo login email
        pass: process.env.BREVO_SMTP_KEY,    // SMTP key from Brevo dashboard
      },
    });
  }

  if (provider === 'smtp') {
    // ── Generic SMTP (Mailgun, Postmark, etc.) ───────────────────────────────
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

  // ── Gmail App Password (default, easiest for dev) ────────────────────────
  // 1. Enable 2-Step Verification on your Google account
  // 2. Go to https://myaccount.google.com/apppasswords
  // 3. Create an App Password → copy the 16-char password
  // 4. Add to .env: GMAIL_USER=you@gmail.com  GMAIL_APP_PASS=xxxx xxxx xxxx xxxx
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
  const name  = process.env.EMAIL_FROM_NAME  || 'Socialyze';
  const email = process.env.EMAIL_FROM_EMAIL
    || process.env.GMAIL_USER
    || process.env.BREVO_SMTP_USER
    || process.env.SMTP_USER
    || 'noreply@socialyze.app';
  return `"${name}" <${email}>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// HTML TEMPLATE — Campaign Share Invite
// ─────────────────────────────────────────────────────────────────────────────
function buildInviteHTML({ ownerEmail, campaignName, permission, appUrl }) {
  const permLabel  = permission === 'edit' ? 'view & edit' : 'view';
  const safeApp    = appUrl || 'https://socialyze.app';
  const safeCamp   = campaignName.charAt(0).toUpperCase() + campaignName.slice(1);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Campaign Invite — Socialyze</title>
  <style>
    body  { margin:0; padding:0; background:#F8FAFC; font-family:'Segoe UI',Arial,sans-serif; }
    .wrap { max-width:520px; margin:40px auto; background:#fff; border-radius:16px;
            border:1px solid #E2E8F0; box-shadow:0 4px 24px rgba(15,23,42,.08); overflow:hidden; }
    .hdr  { background:linear-gradient(135deg,#2563EB,#0EA5E9); padding:32px 36px; text-align:center; }
    .hdr-icon { font-size:32px; margin-bottom:8px; }
    .hdr-title { color:#fff; font-size:22px; font-weight:700; letter-spacing:-0.02em; margin:0; }
    .hdr-sub   { color:rgba(255,255,255,.80); font-size:14px; margin:6px 0 0; }
    .body { padding:32px 36px; }
    .greeting { font-size:15px; color:#0F172A; font-weight:600; margin-bottom:8px; }
    .para { font-size:14px; color:#475569; line-height:1.65; margin-bottom:16px; }
    .card { background:#F8FAFC; border:1.5px solid #E2E8F0; border-radius:12px;
            padding:18px 20px; margin:20px 0; }
    .card-row { display:flex; justify-content:space-between; align-items:center;
                margin-bottom:8px; font-size:13px; }
    .card-row:last-child { margin-bottom:0; }
    .card-label { color:#94A3B8; font-weight:600; text-transform:uppercase;
                  font-size:11px; letter-spacing:.06em; }
    .card-val   { color:#0F172A; font-weight:600; font-size:13.5px; }
    .perm-pill  { background:#EFF6FF; color:#2563EB; border:1px solid #BFDBFE;
                  border-radius:20px; padding:3px 12px; font-size:12px; font-weight:600; }
    .cta-wrap   { text-align:center; margin:28px 0 8px; }
    .cta-btn    { display:inline-block; background:linear-gradient(135deg,#2563EB,#0EA5E9);
                  color:#fff; text-decoration:none; font-size:15px; font-weight:700;
                  padding:13px 32px; border-radius:10px; letter-spacing:-.01em;
                  box-shadow:0 4px 14px rgba(37,99,235,.35); }
    .note { font-size:12.5px; color:#94A3B8; text-align:center; margin-top:10px; line-height:1.6; }
    .divider { height:1px; background:#F1F5F9; margin:24px 0; }
    .footer { padding:20px 36px; background:#F8FAFC; border-top:1px solid #F1F5F9;
              text-align:center; font-size:12px; color:#CBD5E1; line-height:1.7; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="hdr">
      <div class="hdr-icon">🚀</div>
      <p class="hdr-title">Socialyze</p>
      <p class="hdr-sub">AI Social Media Campaign Generator</p>
    </div>
    <div class="body">
      <p class="greeting">You've been invited to collaborate! 🎉</p>
      <p class="para">
        <strong>${ownerEmail}</strong> has shared a campaign workspace with you on Socialyze.
        You can <strong>${permLabel}</strong> the campaign and all its generated outputs.
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
          <span class="card-label">Permission</span>
          <span class="perm-pill">${permLabel}</span>
        </div>
      </div>

      <div class="cta-wrap">
        <a href="${safeApp}" class="cta-btn">Open Socialyze →</a>
      </div>
      <p class="note">
        Sign in with this email address to see the shared workspace.<br/>
        The campaign will appear in your <strong>Shared With Me</strong> tab.
      </p>
      <div class="divider"></div>
      <p class="para" style="font-size:13px;">
        If you weren't expecting this invite, you can safely ignore this email.
        Your access is tied to your email address — no action needed unless you want to collaborate.
      </p>
    </div>
    <div class="footer">
      <strong>Socialyze</strong> — Sourcesys Technologies<br/>
      Team: Subasri B · Gautham Krishnan K · Ashwin D · Vinjarapu Ajay Kumar
    </div>
  </div>
</body>
</html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// PLAIN-TEXT fallback
// ─────────────────────────────────────────────────────────────────────────────
function buildInviteText({ ownerEmail, campaignName, permission, appUrl }) {
  const permLabel = permission === 'edit' ? 'view & edit' : 'view';
  return `You've been invited to collaborate on Socialyze!

${ownerEmail} has shared the campaign "${campaignName}" with you.
Permission: ${permLabel}

Open Socialyze to see it in your "Shared With Me" tab:
${appUrl || 'https://socialyze.app'}

Sign in with this email address to access the workspace.

— Socialyze · Sourcesys Technologies`;
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
 * @param {'view'|'edit'} opts.permission
 * @param {string} [opts.appUrl]      — base URL of the app (defaults to APP_URL env var)
 * @returns {Promise<{ success: boolean, error: string|null }>}
 */
async function sendShareInvite({ toEmail, ownerEmail, campaignName, permission = 'view', appUrl }) {
  const url = appUrl || process.env.APP_URL || 'http://localhost:5173';
  try {
    const info = await transporter.sendMail({
      from:    fromAddress(),
      to:      toEmail,
      subject: `${ownerEmail} shared a Socialyze campaign with you`,
      text:    buildInviteText({ ownerEmail, campaignName, permission, appUrl: url }),
      html:    buildInviteHTML({ ownerEmail, campaignName, permission, appUrl: url }),
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
 * Logs success/failure — does NOT crash the server if email is misconfigured.
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

/*
 * ─────────────────────────────────────────────────────────────────────────────
 * ADD THESE TO backend/.env
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * # ── Email provider: 'gmail' | 'brevo' | 'smtp'  (default: gmail) ──
 * EMAIL_PROVIDER=gmail
 *
 * # ── Option A: Gmail App Password (easiest for dev) ──────────────────
 * # 1. Enable 2-Step Verification: https://myaccount.google.com/security
 * # 2. Create App Password:        https://myaccount.google.com/apppasswords
 * # 3. Copy the 16-char password (spaces ok)
 * GMAIL_USER=youremail@gmail.com
 * GMAIL_APP_PASS=xxxx xxxx xxxx xxxx
 *
 * # ── Option B: Brevo SMTP (300 free emails/day, no domain needed) ────
 * # Sign up at https://brevo.com → SMTP & API → Generate SMTP Key
 * # EMAIL_PROVIDER=brevo
 * # BREVO_SMTP_USER=youremail@yourcompany.com
 * # BREVO_SMTP_KEY=xsmtpib-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
 *
 * # ── Sender name + frontend URL ──────────────────────────────────────
 * EMAIL_FROM_NAME=Socialyze
 * EMAIL_FROM_EMAIL=youremail@gmail.com
 * APP_URL=http://localhost:5173
 */
