import { JoinLeagueScreen } from '@/components/screens/join-league-screen'

export default async function JoinByCodePage({
  params,
}: {
  params: Promise<{ code: string }>
}) {
  const { code } = await params
  return <JoinLeagueScreen code={code} />
}
