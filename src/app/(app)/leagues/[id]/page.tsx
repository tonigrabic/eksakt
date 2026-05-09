import { LeagueDetailScreen } from '@/components/screens/league-detail-screen'

export default async function LeagueDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <LeagueDetailScreen leagueId={id} />
}
