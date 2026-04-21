-- ============================================================
-- Database Webhook — fire Edge Function on shared_workspaces INSERT
-- AI Social Media Campaign Generator | Sourcesys Technologies
--
-- Values are hardcoded directly in the function (hosted Supabase
-- does not allow ALTER DATABASE to set custom parameters).
-- ============================================================

-- ── Webhook trigger function ─────────────────────────────────
create or replace function public.notify_share_invite()
returns trigger
language plpgsql
security definer
as $$
declare
  edge_url  text := 'https://pphkuymgpcchfkaccqns.supabase.co/functions/v1/send-share-invite';
  secret    text := 'Subasri@23';
  payload   jsonb;
begin
  payload := jsonb_build_object(
    'type',       'INSERT',
    'table',      'shared_workspaces',
    'schema',     'public',
    'record',     row_to_json(NEW)::jsonb,
    'old_record', null
  );

  perform net.http_post(
    url     := edge_url,
    headers := jsonb_build_object(
      'Content-Type',     'application/json',
      'x-webhook-secret', secret
    ),
    body    := payload::text
  );

  return NEW;
end;
$$;

-- ── Attach the trigger ───────────────────────────────────────
drop trigger if exists on_share_invite_created on public.shared_workspaces;

create trigger on_share_invite_created
  after insert on public.shared_workspaces
  for each row
  execute procedure public.notify_share_invite();

-- ============================================================
-- Done. Test by sending a share invite from the app.
-- Check Supabase → Edge Functions → send-share-invite → Logs
-- ============================================================
