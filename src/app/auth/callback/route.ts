// Magic-link / OAuth callback. Supabase redirects here after the user
// clicks the email link or completes Google's OAuth flow. We exchange
// the one-time code for a session, then forward to the originally
// requested page (?next=) or the dashboard.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // Same-origin redirect to the requested next path (must start with /).
      const safeNext = next.startsWith('/') ? next : '/dashboard'
      return NextResponse.redirect(`${origin}${safeNext}`)
    }
  }

  // Fall through: code missing or exchange failed. Send them back to
  // login with an error flag the screen can render.
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
