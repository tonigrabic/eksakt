'use client'

// Deep-link join flow: a friend shares /join/<code> and clicking it
// runs the join_league_by_code RPC for the signed-in user, then routes
// to the dashboard.
//
// We always land on /dashboard — success, already-a-member, or even on
// failure (invalid code, network blip). The RPC is idempotent so the
// "already joined" case is just a no-op insert. For genuine failures
// the user still gets sent home rather than stranded on this screen;
// the error is logged to the console for debugging.
//
// Unauthenticated visitors are bounced to /login by the proxy
// middleware with ?next=/join/<code>, so by the time we render here
// the user is signed in.

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Hash, Loader2, Trophy } from 'lucide-react'
import { useJoinLeague } from '@/hooks/use-join-league'

interface Props {
  code: string
}

export function JoinLeagueScreen({ code }: Props) {
  const router = useRouter()
  const join = useJoinLeague()
  // Refs (not state / not deps) for two reasons:
  //   • `join` from useMutation is a fresh object on every render. If we
  //     put it in deps, the mutation transitioning to pending would re-
  //     run the effect → cleanup flips a local `cancelled` flag → the
  //     redirect at the end of the original async never fires. Classic.
  //   • Strict mode mounts → unmounts → mounts in dev. Refs survive that
  //     double-invoke; a useState guard would be reset.
  const startedRef = useRef(false)
  const cancelledRef = useRef(false)

  useEffect(() => {
    // Reset on every (re)mount. Strict-mode unmount sets cancelled=true
    // via the cleanup below; the second mount needs to clear it so the
    // in-flight async from the first mount can still redirect.
    cancelledRef.current = false
    if (startedRef.current) return
    startedRef.current = true

    ;(async () => {
      // Race the join request against a minimum dwell timer so the
      // "Joining league…" card is readable even when the RPC resolves
      // in <100ms. Without this the screen flashes by and the user has
      // no idea what just happened.
      const minDwell = new Promise((resolve) => setTimeout(resolve, 1800))
      try {
        await Promise.all([
          join.mutateAsync({ inviteCode: code }),
          minDwell,
        ])
      } catch (err) {
        // Swallow — we still send the user to the dashboard rather than
        // leaving them stuck on this screen. Most likely cause is that
        // they're already a member and a downstream lookup tripped, or
        // the code is invalid; either way /dashboard is a safe landing.
        console.error('[join-league] failed for code', code, err)
        await minDwell
      }
      if (cancelledRef.current) return
      router.replace('/dashboard')
    })()

    return () => {
      cancelledRef.current = true
    }
    // Intentionally empty deps — we want this to run exactly once on
    // mount. `code`, `router`, and `join` are captured at first render
    // and don't meaningfully change for the lifetime of this screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 bg-card border-border space-y-6">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-2">
            <Trophy className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">
            {'Joining league…'}
          </h1>

          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Hash className="h-4 w-4" />
            <span className="font-mono tracking-widest text-foreground">
              {code.toUpperCase()}
            </span>
          </div>
        </div>

        <div className="flex flex-col items-center gap-3 py-4">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {'Adding you to the league'}
          </p>
        </div>
      </Card>
    </div>
  )
}
