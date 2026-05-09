# Eksakt

A mobile-first social prediction app where friends compete in private football leagues by predicting exact match scores. Built for World Cup 2026.

## Documentation

- **[Product Spec](docs/PROJECT.md)** -- scoring system, screens, user flows
- **[Tech Stack](docs/TECH_STACK.md)** -- architecture, project structure, API details
- **[Database Schema](docs/DATABASE.md)** -- all tables, types, RLS policies
- **[v0 Design Brief](docs/V0_DESIGN_BRIEF.md)** -- full design spec for v0

## Stack

Next.js 16 · TypeScript · Tailwind CSS v4 · shadcn/ui · TanStack Query · Supabase · football-data.org API

## Getting Started

```bash
npm install
npm run dev
```

## Environment Variables

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# football-data.org
FOOTBALL_DATA_API_KEY=
```
