-- ============================================================
-- AI Social Media Campaign Generator — Supabase SQL Schema
-- Run this in Supabase → SQL Editor → New Query
-- ============================================================

-- ── 1. profiles ─────────────────────────────────────────────
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  email       text,
  avatar_url  text,
  created_at  timestamptz default now()
);

-- Auto-create profile on sign-up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'avatar_url', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── 2. campaigns ────────────────────────────────────────────
create table if not exists public.campaigns (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  campaign_name  text not null,
  status         text not null default 'Draft',
  platforms      text[] default '{}',
  tone           text default '',
  created_at     timestamptz default now(),
  updated_at     timestamptz default now(),

  -- One campaign per (user, name) — enforces the single-card rule
  unique (user_id, campaign_name)
);

create index if not exists campaigns_user_id_idx on public.campaigns(user_id);
create index if not exists campaigns_updated_at_idx on public.campaigns(updated_at desc);

-- ── 3. campaign_outputs ─────────────────────────────────────
create table if not exists public.campaign_outputs (
  id              uuid primary key default gen_random_uuid(),
  campaign_id     uuid not null references public.campaigns(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  output_type     text not null check (output_type in ('post_generator','audience','ideation','custom_flow')),
  generated_data  jsonb not null default '{}',
  created_at      timestamptz default now()
);

create index if not exists outputs_campaign_id_idx  on public.campaign_outputs(campaign_id);
create index if not exists outputs_user_id_idx      on public.campaign_outputs(user_id);
create index if not exists outputs_created_at_idx   on public.campaign_outputs(created_at desc);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- profiles
alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- campaigns
alter table public.campaigns enable row level security;

create policy "Users can view own campaigns"
  on public.campaigns for select
  using (auth.uid() = user_id);

create policy "Users can insert own campaigns"
  on public.campaigns for insert
  with check (auth.uid() = user_id);

create policy "Users can update own campaigns"
  on public.campaigns for update
  using (auth.uid() = user_id);

create policy "Users can delete own campaigns"
  on public.campaigns for delete
  using (auth.uid() = user_id);

-- campaign_outputs
alter table public.campaign_outputs enable row level security;

create policy "Users can view own outputs"
  on public.campaign_outputs for select
  using (auth.uid() = user_id);

create policy "Users can insert own outputs"
  on public.campaign_outputs for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own outputs"
  on public.campaign_outputs for delete
  using (auth.uid() = user_id);

-- ============================================================
-- DONE — copy the VITE_ keys from your Supabase project settings
-- into frontend/.env
-- ============================================================
