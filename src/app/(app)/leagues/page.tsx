// The standalone /leagues route was merged into /dashboard. Keep this
// stub as a permanent redirect so any old bookmarks / links land on the
// new home rather than 404'ing.

import { redirect } from 'next/navigation'

export default function LeaguesPage() {
  redirect('/dashboard')
}
