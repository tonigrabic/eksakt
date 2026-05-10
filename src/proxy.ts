// Renamed from middleware.ts → proxy.ts in Next 16. Same behavior, new
// file convention. The helper at @/lib/supabase/middleware.ts keeps its
// historical name — it's our own module, not a Next-convention file.

import type { NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function proxy(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    // Run on every path except: Next internals, static images, favicon.
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
