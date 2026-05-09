// Browser-side Supabase client. Used inside "use client" components and
// TanStack Query hooks. Reads cookies set by the server / middleware so
// auth state is shared across all rendering modes.

import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/database'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
