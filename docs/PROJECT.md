# Eksakt

## What Is This

A mobile-first social prediction app where friends compete in private football leagues by predicting exact match scores. Built around the Croatian prediction league scoring system that rewards both accuracy and contrarian predictions.

**Target launch:** FIFA World Cup 2026 (June 11, 2026)

---

## Core Loop

1. Friends create or join private prediction leagues
2. Before each match, everyone predicts the exact score (e.g., Croatia 2-1 France)
3. Predictions are **blind** -- hidden from others until kickoff
4. Points are awarded using the Croatian scoring system (see below)
5. League standings update in real-time as matches are played
6. Bold, contrarian predictions that prove correct earn massive bonus points

---

## Scoring System (Croatian League Rules)

### Base Points
| Result | Points |
|--------|--------|
| Wrong outcome | 0 |
| Correct outcome (win/draw/loss) but wrong score | 1 |
| Exact correct score | 4 (1 for outcome + 3 for exact) |

### Rarity Bonus Points
| Condition | Bonus |
|-----------|-------|
| <5% of players predicted the correct outcome | +3 |
| 5-15% of players predicted the correct outcome | +1 |
| <5% of players predicted the exact score | +3 |
| 5-15% of players predicted the exact score | +1 |

**Maximum per match:** 10 points (1 + 3 + 3 + 3)

### Boosters (League Setting)
League admins can enable boosters -- limited-use multipliers (x2, x3, x5) that players can apply to predictions they feel confident about. Configurable pool per competition (e.g., 2x x2, 1x x3, 1x x5).

### Tiebreaker
Most exact score predictions wins if points are tied.

---

## Key Screens

### 1. Dashboard (Home)
- Live matches with scores and prediction counts
- Upcoming matches grouped by round
- Quick access to make/edit predictions
- Deadline countdowns

### 2. Prediction Modal
- **Quick Predict:** +/- score controls, applies to all leagues
- **Custom per League:** individual predictions per league with context
- Shows current league position, points, gap to leader
- Booster activation button (remaining boosters visible)

### 3. My Leagues
- Overview stats (total leagues, active, top 3 finishes)
- League cards with position, points, member count
- Create/join league actions

### 4. Live Match View (Three Columns)
- **All Predictions:** everyone's predictions revealed after kickoff
- **Best Scores for You:** top 3 scores that maximize your points based on prediction rarity
- **League Standings:** real-time position changes with color-coded movements

### 5. League Detail
- Full standings table
- Match history with points breakdown
- Member list
- League settings (admin)

---

## Design Principles

- **Dark theme** for evening viewing (peak match times)
- High contrast for mobile readability
- Professional but exciting aesthetic
- Clean, uncluttered interfaces
- Mobile-first (users checking during matches)
- Celebration animations for big wins
- Countdown timers for urgency

---

## User Flows

### Prediction Flow
Open app → see upcoming matches → tap match → enter score prediction → see league context (position, stakes) → save → get deadline reminders

### Live Match Flow
Match starts → predictions revealed → check what everyone predicted → see "best scores for you" → watch standings update as goals go in → post-match points reveal with bonus breakdown

### League Flow
Create league → share invite code → friends join → everyone predicts → compete on standings → banter

---

## Target Audience

**Primary:** Male sports fans, 25-45, who regularly watch football with friend groups
**Geographic focus:** Start with Croatian/Balkan markets, expand to Premier League fans globally

---

## Competitive Advantages

1. Sophisticated scoring that rewards contrarian boldness
2. Blind predictions prevent groupthink
3. Social-first (friend groups, not strangers)
4. Real-time drama during live matches
5. Simple concept (just predict scores) vs. fantasy football complexity
