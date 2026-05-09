// Shared CORS headers for Edge Functions. Sync jobs are server-to-server
// (pg_cron → edge function) so CORS isn't strictly needed, but we set
// permissive headers anyway for ad-hoc invocation from the dashboard or
// curl during development.

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}
