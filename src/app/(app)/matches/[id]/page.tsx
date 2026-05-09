import { LiveMatchScreen } from '@/components/screens/live-match-screen'

export default async function MatchPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ league?: string }>
}) {
  const { id } = await params
  const { league } = await searchParams

  if (!league) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <p className="text-sm text-muted-foreground">
          {'This page needs a ?league=<id> query parameter.'}
        </p>
      </div>
    )
  }
  return <LiveMatchScreen matchId={id} leagueId={league} />
}
