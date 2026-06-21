# Eksakt — Investor Overview

*Social score-prediction for football, built around the moments friends actually
argue about.*

---

## One line

Eksakt is a mobile-first app where friend groups run private leagues predicting
exact football scores — blind until kickoff, scored by a system that rewards
bold, correct calls, and narrated back to players as a live, shareable story.

## The problem

Watching football with friends is inherently social and competitive, but the
tools are not:

- **Fantasy football is too heavy** — drafts, transfers, lineups, hours a week.
  Most fans bounce off it.
- **Betting is solitary and adversarial** — you vs. the house, not you vs. your
  mates, and increasingly regulated/restricted.
- **Group chats are where the banter actually lives**, but there's no structure,
  no scoring, no memory — the "I called that 2–1" moment evaporates.

There's a wide gap between "too much" (fantasy) and "nothing" (a WhatsApp
thread) for the casual-but-passionate fan who watches with friends.

## The product

One simple action: **predict the exact score**. Everything else is built to make
that feel social and dramatic.

- **Private leagues.** Create a league, share an invite code, friends join. The
  competition is your group, not strangers.
- **Blind predictions.** Picks are hidden until kickoff (enforced at the
  database layer), so there's genuine reveal and no groupthink.
- **A scoring system with teeth.** Based on the Croatian prediction-league
  tradition — it rewards getting it *right* and getting it *boldly* right.
- **Live drama.** Once a match kicks off, everyone's picks unlock and standings
  move in real time as goals go in.
- **The story.** Every finished match becomes a narrated moment ("Barca89 &
  Kate went against the grain", "8 Eksakts — Mario went big with ×5"), and
  in-play matches show who's in line for the big points and what needs to
  happen.

## How the scoring works (the hook)

Simple to grasp, deep enough to argue about:

| Outcome | Points |
| --- | --- |
| Wrong result | 0 |
| Correct result, wrong score | 1 |
| **Exact score** | **4** |

Plus a **rarity bonus** that rewards contrarians: if almost no one in your league
called the correct outcome, you earn **+3** (or **+1** if only a handful did).
So a correct call nobody else saw is worth far more than following the crowd —
up to **7 points** a match.

**Boosters** add the gambling-style upside without the gambling: league admins
can hand out a limited pool of ×2 / ×3 / ×5 multipliers for the season. Spend
your ×5 on a gutsy call that lands and a single match can swing the table — up to
**35 points** from one prediction. Scarcity makes every booster a decision.

This is the differentiator: the math actively rewards **boldness**, which
produces the highlight-reel moments that drive group banter and re-engagement.

## What's built today

A working, deployed product (Next.js web app, mobile-first), not a prototype:

- **Auth & profiles** — email magic-link + Google sign-in, avatars.
- **Leagues** — create/join by invite code, multiple competitions per league,
  admin controls, booster configuration.
- **Predictions** — quick-predict across leagues or custom per league, with live
  standings context (your position, gap to leader) at the point of decision;
  blind until kickoff via row-level security.
- **Scoring engine** — the full Croatian rules + rarity bonuses + boosters,
  computed server-side on match completion and live-projected during play.
- **Live match experience** — real-time score sync, predictions revealed at
  kickoff, standings that move as it happens, plus "who picked what" and
  next-goal "who's in for the big points" projections.
- **Match-story feed** — finished matches become moments on a cross-league
  dashboard feed and per-league history; standout calls (exact hits, big hauls,
  contrarian wins, booster gambles, league-wide upsets) are auto-detected and
  narrated.
- **Retention loop** — automated, opt-out prediction-reminder emails before a
  slate of matches kicks off, so users don't forget to play.
- **Live fixtures & data** — real competitions, fixtures, scores, and team
  crests synced automatically from a football-data provider.

## Technology & moat

- **Stack:** Next.js / React / TypeScript on the front end; Supabase (Postgres,
  row-level security, Realtime, Deno edge functions, scheduled jobs) on the back
  end; deployed on Vercel with preview-per-change.
- **Why it's defensible-ish:** the value compounds with the **social graph**
  (your league is your friends — high switching cost), and the **scoring +
  storytelling engine** is the hard part to copy well. Blind-prediction
  integrity is enforced in the database, not just the UI. The moment/story layer
  is derived purely from existing data — no extra infrastructure — so new
  narrative features ship fast.
- **Lean to operate:** managed infra, no servers to babysit, automated data sync
  and notifications.

## Timing & go-to-market

- **Launch window: FIFA World Cup 2026** — a once-every-four-years surge of
  casual fans all watching the *same* fixtures at the same time. Tournaments are
  ideal: a fixed, globally-shared schedule and natural urgency.
- **Distribution is built in:** the core unit is a private league, so every
  active user invites their friends — growth is inherently viral within
  friend groups (invite-code join flow already shipped).
- **Beachhead → expansion:** Croatian/Balkan football culture first (where this
  scoring tradition is beloved), then Premier League and other major leagues for
  year-round retention beyond tournaments.

## Business model (opportunities, not yet built)

- **Freemium leagues** — free to play; paid tiers for larger leagues, custom
  competitions, advanced stats, and cosmetic identity.
- **Sponsored/branded leagues & prize pools** — brands or media run public
  leagues around big tournaments.
- **Premium boosters / season passes** — cosmetic and convenience, not
  pay-to-win.
- **Affiliate & media partnerships** — a highly engaged, match-time audience.

## Status & ask

- **Status:** product is live and feature-complete for a World Cup 2026 launch;
  actively iterating on the in-match and post-match storytelling that drives
  engagement.
- **What we're looking for:** *(to fill in — funding amount, use of funds:
  user acquisition for the tournament window, iOS/Android wrappers, and
  expanding competition coverage for year-round retention).*

---

*Prepared as a product/technology overview. Traction and financial figures are
intentionally left for the live conversation rather than asserted here.*
