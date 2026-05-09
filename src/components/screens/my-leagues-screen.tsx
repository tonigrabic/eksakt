'use client'

import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Trophy, Users, Crown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ScreenHeader } from '@/components/screen-header'
import { CreateOrJoinLeague } from '@/components/create-or-join-league'
import { useMyLeagues } from '@/hooks/use-my-leagues'
import { formatKickoff } from '@/lib/format'
import type { MyLeagueCard } from '@/types'

export function MyLeaguesScreen() {
  const { data, isLoading } = useMyLeagues()

  return (
    <>
      <ScreenHeader title="My Leagues" subtitle="Manage your competitions" />

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {isLoading || !data ? (
          <p className="text-center text-sm text-muted-foreground py-12">{'Loading…'}</p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3">
              <StatCard label="Total Leagues" value={data.stats.totalLeagues} icon={Trophy} />
              <StatCard label="Active" value={data.stats.activeLeagues} icon={Users} />
              <StatCard label="Top 3 Finishes" value={data.stats.topThreeFinishes} icon={Crown} />
            </div>

            <CreateOrJoinLeague />

            <div className="space-y-3">
              <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{'Active Leagues'}</h2>
              {data.active.length === 0 ? (
                <p className="text-xs text-muted-foreground">{'None yet.'}</p>
              ) : (
                data.active.map((card) => (
                  <ActiveLeagueRow key={card.league.id} card={card} />
                ))
              )}
            </div>

            {data.completed.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{'Completed'}</h2>
                {data.completed.map((card) => (
                  <CompletedLeagueRow key={card.league.id} card={card} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: number
  icon: React.ComponentType<{ className?: string }>
}) {
  return (
    <Card className="p-4 bg-card border-border text-center">
      <Icon className="h-5 w-5 mx-auto mb-2 text-primary" />
      <div className="text-2xl font-bold text-foreground">{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
    </Card>
  )
}

function ActiveLeagueRow({ card }: { card: MyLeagueCard }) {
  const { league } = card
  return (
    <Link href={`/leagues/${league.id}`}>
      <Card className="group bg-card border-border hover:border-primary/50 transition-all cursor-pointer overflow-hidden">
        <div className="p-4">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{league.icon ?? '🏆'}</span>
              <div>
                <h3 className="font-bold text-foreground">{league.name}</h3>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                  <Users className="h-3 w-3" />
                  <span>{league.memberCount}{' members'}</span>
                </div>
              </div>
            </div>
            {card.userPosition === 1 && (
              <Badge variant="default" className="gap-1">
                <Trophy className="h-3 w-3" />
                {'1st'}
              </Badge>
            )}
          </div>

          <div className="flex items-end gap-6">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                {'Position'}
              </div>
              <div className="text-2xl font-black text-foreground leading-tight">
                {'#'}{card.userPosition}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                {'Points'}
              </div>
              <div className="text-2xl font-black text-primary leading-tight">
                {card.userPoints}
              </div>
            </div>
            <div className="flex-1 text-right">
              {card.nextMatchKickoff && (
                <div className="text-[11px] text-muted-foreground">
                  {'Next: '}
                  {formatKickoff(card.nextMatchKickoff)}
                </div>
              )}
            </div>
          </div>
        </div>

        <div
          className={cn(
            'flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-medium',
            'bg-secondary/50 text-muted-foreground',
            'group-hover:bg-primary/10 group-hover:text-primary transition-colors',
          )}
        >
          <span>{'View League'}</span>
          <ChevronRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
        </div>
      </Card>
    </Link>
  )
}

function CompletedLeagueRow({ card }: { card: MyLeagueCard }) {
  const { league } = card
  return (
    <Link href={`/leagues/${league.id}`}>
      <Card className="group bg-card border-border opacity-70 hover:opacity-100 transition-all cursor-pointer overflow-hidden">
        <div className="flex items-center gap-3 p-4">
          <span className="text-xl grayscale">{league.icon ?? '🏆'}</span>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground truncate">{league.name}</h3>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
              <span>{'Final: #'}{card.userPosition}</span>
              <span className="text-border">{'|'}</span>
              <span>{card.userPoints}{' pts'}</span>
              <span className="text-border">{'|'}</span>
              <span>{league.memberCount}{' players'}</span>
            </div>
          </div>
          {card.finalBadge && (
            <Badge
              variant="outline"
              className="gap-1 border-primary/50 text-primary shrink-0"
            >
              <Trophy className="h-3 w-3" />
              {card.finalBadge}
            </Badge>
          )}
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 group-hover:text-primary transition-colors" />
        </div>
      </Card>
    </Link>
  )
}
