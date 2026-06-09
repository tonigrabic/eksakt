-- Eksakt — simplify prediction reminders to one daily digest.
--
-- Replaces the per-session smart-gate from 00020 with a single daily cron.
-- Our daily slate's first kickoff is ~21:00 CET, so a fixed 20:00 CET
-- send lands ~1h before the first match and the 12h window (20:00 → 08:00
-- CET) covers that evening + the small-hours games in one email. No
-- middle-of-the-night sends — the send time is fixed, not derived from a
-- possibly-nocturnal kickoff — and no per-session bookkeeping.
--
-- The recipients RPC (prediction_reminder_recipients) and the
-- send-prediction-reminders Edge Function are unchanged — they already
-- take an arbitrary [start, end) window.

-- ── Tear down the smart-gate machinery ──────────────────────────────────────

select cron.unschedule('eksakt-prediction-reminders');
drop function if exists public.session_due_for_reminder();

-- ── reminder_batches: now one row per daily run (idempotency guard) ─────────

alter table public.reminder_batches
  add column if not exists run_date date not null default current_date;

create unique index if not exists reminder_batches_run_date_key
  on public.reminder_batches (run_date);

comment on table public.reminder_batches is
  'One row per daily reminder run. The unique(run_date) constraint stops a '
  'second send on the same UTC day (e.g. a manual re-trigger or cron retry).';

-- ── Dispatcher: fire once a day for the next 12h ────────────────────────────

create or replace function public.dispatch_prediction_reminders()
returns integer
language plpgsql
security definer
as $$
declare
  v_start timestamptz := now();
  v_end   timestamptz := now() + interval '12 hours';
  v_req   bigint;
begin
  -- Claim the day first so a retry/double-fire can't double-send.
  begin
    insert into public.reminder_batches (session_start, session_end, run_date)
    values (v_start, v_end, current_date);
  exception when unique_violation then
    return 0; -- already sent today
  end;

  v_req := public.dispatch_edge_function(
    'send-prediction-reminders',
    jsonb_build_object('sessionStart', v_start, 'sessionEnd', v_end)
  );

  -- Vault secrets missing → dispatch was a no-op. Release the day's claim
  -- so a later run (once secrets are set) can retry.
  if v_req is null then
    delete from public.reminder_batches where run_date = current_date;
    return 0;
  end if;

  return 1;
end;
$$;

-- ── Schedule: daily at 18:00 UTC = 20:00 CEST (summer / WC 2026) ────────────
--
-- In winter (CET = UTC+1) 18:00 UTC is 19:00 local; bump to '0 19 * * *'
-- if this is reused for competitions running outside summer.

select cron.schedule(
  'eksakt-prediction-reminders',
  '0 18 * * *',
  $cron$ select public.dispatch_prediction_reminders(); $cron$
);
