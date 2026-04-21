-- ============================================================
-- Content Calendar Migration
-- Run this in Supabase → SQL Editor → New Query
-- ============================================================

create table if not exists public.content_calendar (
  id           uuid primary key default gen_random_uuid(),
  campaign_id  uuid references public.campaigns(id) on delete set null,
  user_id      uuid not null references auth.users(id) on delete cascade,
  title        text not null,
  task_type    text not null default '',
  platform     text not null default '',
  description  text default '',
  date         date not null,
  time         time not null,
  status       text not null default 'Planned'
                 check (status in ('Planned', 'In Progress', 'Completed')),
  created_at   timestamptz default now()
);

create index if not exists content_calendar_user_id_idx   on public.content_calendar(user_id);
create index if not exists content_calendar_status_idx    on public.content_calendar(status);
create index if not exists content_calendar_date_idx      on public.content_calendar(date);

-- RLS
alter table public.content_calendar enable row level security;

create policy "Users can view own content tasks"
  on public.content_calendar for select
  using (auth.uid() = user_id);

create policy "Users can insert own content tasks"
  on public.content_calendar for insert
  with check (auth.uid() = user_id);

create policy "Users can update own content tasks"
  on public.content_calendar for update
  using (auth.uid() = user_id);

create policy "Users can delete own content tasks"
  on public.content_calendar for delete
  using (auth.uid() = user_id);
