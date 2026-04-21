# 📧 Email Invite Setup — Shared Workspaces
**AI Social Media Campaign Generator | Sourcesys Technologies**

This guide connects the "Share a Campaign" button to real email delivery.
Total setup time: **~15 minutes**.

---

## How It Works

```
User clicks "Send Invite"
        │
        ▼
shareCampaign() → INSERT into shared_workspaces (Supabase)
        │
        ▼
DB Trigger fires → notify_share_invite() [PostgreSQL function]
        │
        ▼
HTTP POST → Supabase Edge Function (send-share-invite)
        │
        ▼
Resend API → 📧 Email delivered to invitee
```

---

## Step 1 — Get a Free Resend API Key

1. Go to **[resend.com](https://resend.com)** → Sign Up (free, 3 000 emails/month)
2. Dashboard → **API Keys** → Create API Key
3. Copy the key — it looks like `re_xxxxxxxxxxxxxxxx`

> **Domain (optional but recommended for production)**
> Resend's free tier lets you send from `onboarding@resend.dev` immediately.
> For a branded `noreply@yourdomain.com`, verify your domain in Resend → Domains.

---

## Step 2 — Deploy the Edge Function

Make sure you have the Supabase CLI installed:
```bash
npm install -g supabase
```

Login and link your project:
```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
```
> Find `YOUR_PROJECT_REF` in **Supabase Dashboard → Project Settings → General**

Deploy the function:
```bash
cd "SOCIAL MEDIA PROJECT"
supabase functions deploy send-share-invite --no-verify-jwt
```

---

## Step 3 — Set Edge Function Secrets

In **Supabase Dashboard → Edge Functions → send-share-invite → Secrets**,
add these environment variables:

| Secret Name               | Value                                               |
|---------------------------|-----------------------------------------------------|
| `RESEND_API_KEY`          | `re_xxxxxxxxxxxxxxxx` (from Step 1)                 |
| `WEBHOOK_SECRET`          | Any random string, e.g. `campaignai_wh_secret_2025` |
| `APP_URL`                 | Your frontend URL e.g. `http://localhost:5173`      |
| `FROM_EMAIL`              | `onboarding@resend.dev` (or your verified domain)   |

Or set them via CLI:
```bash
supabase secrets set RESEND_API_KEY=re_xxx
supabase secrets set WEBHOOK_SECRET=campaignai_wh_secret_2025
supabase secrets set APP_URL=http://localhost:5173
supabase secrets set FROM_EMAIL=onboarding@resend.dev
```

---

## Step 4 — Run the DB Webhook SQL

Open **Supabase → SQL Editor → New Query** and run `webhook_trigger.sql`.

**Before running**, replace the two placeholder lines at the bottom:

```sql
-- Replace YOUR_PROJECT_REF:
alter database postgres
  set app.edge_function_url =
  'https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-share-invite';

-- Replace YOUR_WEBHOOK_SECRET_STRING with the same value you set above:
alter database postgres
  set app.webhook_secret = 'YOUR_WEBHOOK_SECRET_STRING';

-- Apply immediately (no restart needed):
SELECT pg_reload_conf();
```

Then run the full file.

---

## Step 5 — Test It

1. Start the frontend: `cd frontend && npm run dev`
2. Log in → **Shared Workspaces → New Share**
3. Select a campaign, enter a real email address (your own for testing), click **Send Invite**
4. Check your inbox — the branded invite email should arrive within seconds

---

## Troubleshooting

### Email not arriving
- Check **Supabase → Edge Functions → send-share-invite → Logs** for errors
- Verify `RESEND_API_KEY` is set correctly (no extra spaces)
- If using `onboarding@resend.dev`, check spam folder
- Confirm the trigger was created: run `SELECT * FROM information_schema.triggers WHERE trigger_name = 'on_share_invite_created';` in SQL Editor

### "pg_net extension not found" error
```sql
create extension if not exists pg_net schema extensions;
```

### Edge function returns 401
The `WEBHOOK_SECRET` in the Edge Function secrets does not match `app.webhook_secret` in the DB config. Make them identical.

### Testing the Edge Function directly (bypass the trigger)
```bash
curl -X POST \
  https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-share-invite \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: YOUR_WEBHOOK_SECRET_STRING" \
  -d '{
    "type": "INSERT",
    "table": "shared_workspaces",
    "schema": "public",
    "record": {
      "id": "test-id",
      "campaign_id": "YOUR_CAMPAIGN_UUID",
      "owner_id": "YOUR_USER_UUID",
      "invitee_email": "test@example.com",
      "permission": "view",
      "status": "pending",
      "created_at": "2025-04-13T00:00:00Z"
    },
    "old_record": null
  }'
```

---

## File Reference

```
supabase/
└── functions/
    └── send-share-invite/
        ├── index.ts              ← Edge Function (email sending logic)
        ├── webhook_trigger.sql   ← DB trigger SQL (run in SQL Editor)
        └── SETUP_EMAIL.md        ← This file
```

---

## Email Preview

The invite email includes:
- CampaignAI branded header (blue gradient)
- Inviter's name and email
- Campaign name
- Permission level badge (View Only / Can Edit)
- One-click "Open CampaignAI →" button linking to your APP_URL
- Login instruction (invitee must use their email address)
- Company footer (Sourcesys Technologies + team names)
