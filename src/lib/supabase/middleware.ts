// Eksakt — auth middleware.
//
// Runs on every navigation. Two responsibilities:
//   1. Refresh the Supabase session cookie if it's expired (must call
//      supabase.auth.getUser() to trigger this).
//   2. Gate access: unauthenticated users get redirected to /login,
//      authenticated users hitting / or /login get redirected to
//      /dashboard.
//
// The cookie-shuffling pattern (read from request.cookies, set on
// supabaseResponse) is required by @supabase/ssr — see
// https://supabase.com/docs/guides/auth/server-side/nextjs.

import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from '@/types/database'

const PUBLIC_PATHS = ['/login', '/auth']

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  )
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // Required call — refreshes expired sessions and surfaces auth state.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname

  // Unauthenticated users hitting protected paths → /login.
  if (!user && !isPublic(path) && path !== '/') {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', path)
    return NextResponse.redirect(url)
  }

  // Authenticated users hitting / or /login → /dashboard.
  if (user && (path === '/' || path === '/login')) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    url.search = ''
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
