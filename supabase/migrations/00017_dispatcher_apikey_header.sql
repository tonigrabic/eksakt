-- Eksakt — include `apikey` header on edge-function dispatches.
--
-- Newer versions of the local Supabase edge runtime reject calls that
-- only carry `Authorization: Bearer <service_role_key>` — they also
-- require the `apikey` header. Remote ran on an older runtime that
-- accepted Authorization-only, so the original dispatcher in 00007
-- worked there. Sending both headers is identical for Supabase auth,
-- so this is a no-op on remote and fixes local cron dispatches.

create or replace function public.dispatch_edge_function(
  p_function_name text,
  p_body jsonb
)
returns bigint
language plpgsql
security definer
as $$
declare
  v_url text;
  v_key text;
  v_request_id bigint;
begin
  v_url := public._eksakt_secret('supabase_url');
  v_key := public._eksakt_secret('service_role_key');

  if v_url is null or v_key is null then
    raise warning 'eksakt: vault secrets supabase_url or service_role_key not set; skipping %',
      p_function_name;
    return null;
  end if;

  select net.http_post(
    url := v_url || '/functions/v1/' || p_function_name,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key,
      'apikey', v_key
    ),
    body := p_body,
    timeout_milliseconds := 10000
  )
  into v_request_id;

  return v_request_id;
end;
$$;
