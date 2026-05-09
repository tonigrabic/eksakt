# Tech Stack & Architecture

## Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router) | 16.x |
| Language | TypeScript | strict mode |
| UI Components | shadcn/ui | latest (v4 compatible) |
| Styling | Tailwind CSS | v4 |
| Icons | Lucide React | latest |
| Data Fetching | TanStack Query | v5 |
| Backend/DB | Supabase (Auth, Postgres, Realtime, Edge Functions) | latest |
| Football Data | football-data.org v4 API (Livescores plan, €12/mo) | v4 |
| Deployment | Vercel | - |
| PWA | @serwist/next | latest |

## Project Structure

```
~/Projects/football-predictions/
├── docs/                       # Project documentation
│   ├── PROJECT.md              # Product overview and spec
│   ├── TECH_STACK.md           # This file
│   └── DATABASE.md             # Schema documentation
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (auth)/             # Auth routes (login, signup, callback)
│   │   ├── (app)/              # Protected app routes
│   │   │   ├── dashboard/      # Home - live + upcoming matches
│   │   │   ├── leagues/        # League list, detail, create
│   │   │   ├── matches/[id]/   # Live match view
│   │   │   └── profile/        # User profile + stats
│   │   ├── invite/[code]/      # Public league invite deep link
│   │   └── api/                # API routes (webhooks, cron jobs)
│   ├── components/             # Shared components
│   │   └── ui/                 # shadcn/ui components
│   ├── lib/
│   │   ├── supabase/           # Supabase client (browser, server, middleware)
│   │   ├── scoring.ts          # Croatian scoring engine (pure function)
│   │   ├── football-api.ts     # football-data.org API client
│   │   └── utils.ts            # cn() and shared utilities
│   ├── hooks/                  # TanStack Query hooks
│   └── types/                  # Shared TypeScript types
├── supabase/
│   ├── migrations/             # SQL migrations
│   ├── functions/              # Supabase Edge Functions
│   └── seed.sql                # World Cup 2026 seed data
├── components.json             # shadcn/ui configuration
└── package.json
```

## Key Architectural Decisions

### Server Components by Default
Only use `"use client"` for interactive elements (prediction inputs, live score updates, form controls). Everything else is a server component for performance.

### Data Fetching Pattern
- **Server components:** fetch directly from Supabase using server client
- **Client components:** use TanStack Query hooks with Supabase browser client
- All query hooks live in `src/hooks/` with consistent cache key patterns

### Supabase Integration
- **Auth:** magic link + Google OAuth
- **Database:** Postgres with Row Level Security (RLS) on all tables
- **Realtime:** subscribe to match score changes during live games
- **Edge Functions:** scoring calculation triggered after match completion

### football-data.org API
- Competition code for World Cup: `WC` (id: 2000)
- Free tier covers: World Cup, Champions League, Premier League, La Liga, Bundesliga, Serie A, Ligue 1, Eredivisie, Primeira Liga, Championship, Brazilian Serie A, Euros
- Livescores plan: €12/mo, 20 requests/min, live scores
- API key stored in environment variable: `FOOTBALL_DATA_API_KEY`
- Base URL: `https://api.football-data.org/v4`
- Auth header: `X-Auth-Token: <key>`

### Styling
- v0 leads all design work -- do not manually write CSS or component styles
- Dark theme is the default and only theme
- All design tokens come from shadcn/ui CSS variables
- Mobile-first responsive design
