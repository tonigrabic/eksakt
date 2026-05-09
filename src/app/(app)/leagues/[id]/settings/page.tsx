import { LeagueSettingsScreen } from '@/components/screens/league-settings-screen'

export default async function LeagueSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <LeagueSettingsScreen leagueId={id} />
}
