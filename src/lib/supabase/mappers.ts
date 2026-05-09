// Row → domain type mappers. Keeps the supabase api layer from being
// littered with snake_case → camelCase plumbing.

import type {
  Booster,
  BoosterPoolConfig,
  Competition,
  League,
  LeagueMember,
  LeagueSettings,
  Match,
  MatchStatus,
  Prediction,
  Profile,
  Round,
  Team,
} from '@/types'
import type { Database } from '@/types/database'

type Tables = Database['public']['Tables']

export function rowToProfile(row: Tables['profiles']['Row']): Profile {
  return {
    id: row.id,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
  }
}

export function rowToTeam(row: Tables['teams']['Row']): Team {
  return {
    id: row.id,
    name: row.name,
    shortName: row.short_name,
    logoUrl: row.logo_url,
    countryCode: row.country_code,
  }
}

export function rowToCompetition(
  row: Tables['competitions']['Row'],
): Competition {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    type: row.type as 'CUP' | 'LEAGUE',
    emblemUrl: row.emblem_url,
    seasonStart: row.season_start,
    seasonEnd: row.season_end,
  }
}

export function rowToCompetitionLite(
  row: Tables['competitions']['Row'],
): League['competition'] {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    emblemUrl: row.emblem_url,
    seasonEnd: row.season_end,
  }
}

export function rowToRound(row: Tables['rounds']['Row']): Round {
  return {
    id: row.id,
    competitionId: row.competition_id,
    name: row.name,
    sortOrder: row.sort_order,
  }
}

type MatchWithJoins = Tables['matches']['Row'] & {
  round: Tables['rounds']['Row']
  home_team: Tables['teams']['Row'] | null
  away_team: Tables['teams']['Row'] | null
}

export function rowToMatch(row: MatchWithJoins): Match {
  return {
    id: row.id,
    competitionId: row.competition_id,
    round: {
      id: row.round.id,
      name: row.round.name,
      sortOrder: row.round.sort_order,
    },
    homeTeam: row.home_team ? rowToTeam(row.home_team) : null,
    awayTeam: row.away_team ? rowToTeam(row.away_team) : null,
    kickoffTime: row.kickoff_time,
    status: row.status as MatchStatus,
    homeScore: row.home_score,
    awayScore: row.away_score,
    matchday: row.matchday,
    liveMinute: row.live_minute,
  }
}

export function rowToPrediction(
  row: Tables['predictions']['Row'],
): Prediction {
  return {
    id: row.id,
    userId: row.user_id,
    matchId: row.match_id,
    leagueId: row.league_id,
    homeScore: row.home_score,
    awayScore: row.away_score,
    booster: row.booster as Booster | null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

type LeagueWithJoins = Tables['leagues']['Row'] & {
  competition: Tables['competitions']['Row']
}

export function rowToLeague(
  row: LeagueWithJoins,
  memberCount: number,
): League {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    inviteCode: row.invite_code,
    icon: row.icon,
    competition: rowToCompetitionLite(row.competition),
    createdBy: row.created_by,
    settings: parseSettings(row.settings),
    memberCount,
    createdAt: row.created_at,
  }
}

type MemberWithJoins = Tables['league_members']['Row'] & {
  profile: Tables['profiles']['Row']
}

export function rowToLeagueMember(row: MemberWithJoins): LeagueMember {
  return {
    leagueId: row.league_id,
    userId: row.user_id,
    role: row.role as 'admin' | 'member',
    joinedAt: row.joined_at,
    profile: rowToProfile(row.profile),
  }
}

function parseSettings(settings: unknown): LeagueSettings {
  if (
    typeof settings !== 'object' ||
    settings === null ||
    !('boosters' in settings)
  ) {
    return defaultSettings
  }
  const s = settings as { boosters: unknown }
  if (
    typeof s.boosters !== 'object' ||
    s.boosters === null ||
    !('enabled' in s.boosters) ||
    !('pool' in s.boosters)
  ) {
    return defaultSettings
  }
  const boosters = s.boosters as BoosterPoolConfig
  return { boosters }
}

const defaultSettings: LeagueSettings = {
  boosters: { enabled: true, pool: { x2: 3, x3: 1, x5: 1 } },
}
