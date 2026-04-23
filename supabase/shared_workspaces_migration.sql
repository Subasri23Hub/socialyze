-- ============================================================
-- Shared Workspaces — Migration
-- AI Social Media Campaign Generator | Sourcesys Technologies
--
-- Run this in Supabase → SQL Editor → New Query
-- (after running supabase_schema.sql)
-- ============================================================

-- ── shared_workspaces ────────────────────────────────────────
-- One row per (campaign, invited_email) share relationship.
-- owner_id  = the user who owns the campaign and created the share
-- invitee_email = the email address the share was sent to
-- invitee_id    = filled in when the invitee first accepts / views (optional)
-- permission    = 'view' | 'edit'
-- status        = 'pending' | 'accepted'

create table if not exists public.shared_workspaces (
  id              uuid primary key default gen_random_uuid(),
  campaign_id     uuid not null references public.campaigns(id) on delete cascade,
  owner_id        uuid not null references auth.users(id) on delete cascade,
  invitee_email   text not null,
  invitee_id      uuid references auth.users(id) on delete set null,
  permission      text not null default 'view' check (permission in ('view', 'edit')),
  status          text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at      timestamptz default now(),

  -- Prevent duplicate shares for the same (campaign, email)
  unique (campaign_id, invitee_email)
);

create index if not exists sw_campaign_id_idx    on public.shared_workspaces(campaign_id);
create index if not exists sw_owner_id_idx       on public.shared_workspaces(owner_id);
create index if not exists sw_invitee_email_idx  on public.shared_workspaces(invitee_email);
create index if not exists sw_invitee_id_idx     on public.shared_workspaces(invitee_id);

-- ── Row Level Security ────────────────────────────────────────
alter table public.shared_workspaces enable row level security;

-- Owners can see all shares they created
create policy "Owners can view their shares"
  on public.shared_workspaces for select
  using (auth.uid() = owner_id);

-- Invitees can see shares addressed to their email
create policy "Invitees can view shares to their email"
  on public.shared_workspaces for select
  using (auth.email() = invitee_email);

-- Only the owner can create a share
create policy "Owners can create shares"
  on public.shared_workspaces for insert
  with check (auth.uid() = owner_id);

-- Owner can update (e.g. change permission)
-- Invitee can update status to 'accepted'
create policy "Owner or invitee can update share"
  on public.shared_workspaces for update
  using (auth.uid() = owner_id OR auth.email() = invitee_email);

-- Only owner can delete (revoke)
create policy "Owner can delete share"
  on public.shared_workspaces for delete
  using (auth.uid() = owner_id);

-- ── Allow invitees to READ shared campaigns ───────────────────
-- Invitees need SELECT on campaigns for their shared campaign_ids.
-- We add a new RLS policy (non-destructive — existing policies stay).

create policy "Invitees can view campaigns shared with their email"
  on public.campaigns for select
  using (
    exists (
      select 1 from public.shared_workspaces sw
      where sw.campaign_id = public.campaigns.id
        and sw.invitee_email = auth.email()
    )
  );

-- Allow invitees to read outputs of shared campaigns
create policy "Invitees can view outputs of shared campaigns"
  on public.campaign_outputs for select
  using (
    exists (
      select 1 from public.shared_workspaces sw
      where sw.campaign_id = public.campaign_outputs.campaign_id
        and sw.invitee_email = auth.email()
    )
  );

-- Allow edit-permission invitees to INSERT outputs into shared campaigns
create policy "Edit invitees can insert outputs to shared campaigns"
  on public.campaign_outputs for insert
  with check (
    exists (
      select 1 from public.shared_workspaces sw
      where sw.campaign_id = public.campaign_outputs.campaign_id
        and sw.invitee_email = auth.email()
        and sw.permission = 'edit'
    )
  );

-- ============================================================
-- DONE
-- ============================================================
