# Eksakt — Design Brief

## Product Overview
A mobile-first social prediction app that lets friends compete in private football leagues by predicting exact match scores. Built around the Croatian prediction league scoring system that rewards both accuracy and contrarian predictions.

**Platform:** Mobile-first (iOS/Android), responsive web interface secondary

---

## Core Concept

**The Hook:** Friends create private leagues, predict exact scores for matches, and compete for points using a sophisticated scoring system that rewards bold, accurate predictions.

**Key Differentiator:** Predictions remain hidden until matches start, creating genuine surprise and preventing groupthink. The bonus point system heavily rewards contrarian picks that prove correct.

---

## Scoring System (Croatian League Rules)

### Base Points
- **0 points:** Wrong result and wrong outcome
- **1 point:** Correct outcome (win/draw/loss) but wrong score
- **4 points:** Exact correct score (1 pt for outcome + 3 pts for exact match)

### Bonus Points (The Secret Sauce)
**Rare Outcome Bonuses:**
- If <5% of players predicted the correct outcome: **+3 bonus points**
- If 5-15% of players predicted the correct outcome: **+1 bonus point**

**Rare Exact Score Bonuses:**
- If <5% of players predicted the exact score: **+3 bonus points**
- If 5-15% of players predicted the exact score: **+1 bonus point**

**Maximum possible:** 10 points per match (1 + 3 + 3 + 3)

### Boosters (League Setting)
League admins can enable boosters -- limited-use multipliers that players apply to predictions they feel confident about. When a booster is active, total points for that prediction are multiplied after all base + bonus points are calculated.

**Available multipliers:** x2, x3, x5
**Configurable pool per competition:** e.g., each player gets 2x x2 boosters, 1x x3 booster, 1x x5 booster for the entire tournament. Once used, they're gone.

**Example:** You use your x5 booster on Croatia 0-0 France, it happens, and it was a rare pick. Base 10 pts × 5 = **50 points** for that match.

### Example
If only 2 people predict Portugal 0-0 France and it happens:
- 1 pt (correct outcome) + 3 pts (exact score) + 3 pts (rare outcome) + 3 pts (rare exact score) = **10 points**

### Tiebreaker
If players have equal points at season end, winner is determined by most exact score predictions.

---

## Key Screens & Features

### 1. Football Dashboard (Home)
**Live & Starting Soon:**
- Shows matches currently live with scores
- Displays prediction count per match (e.g., "14 predictions")
- Quick access to view predictions

**Upcoming Matches:**
- Grouped by gameweek (for leagues) or rounds (for tournaments like World Cup)
- Shows which leagues each match belongs to
- Compact league indicators: "🏆 Premier: 2-1  👥 Friends: ❌"
- Clear CTAs for incomplete predictions
- Deadline countdowns

**Note:** Initial launch focused on World Cup (June) with round-based structure, expanding to year-long league support.

### 2. Prediction Modal
**Quick Predict Tab:**
- Simple +/- controls for score input
- Applies same prediction to all relevant leagues
- Shows which leagues will be affected

**Custom per League Tab:**
- Individual score inputs per league
- Shows current predictions (e.g., "Current: 1-2")
- League context cards with current standings
- Scrollable for users in multiple leagues

**Critical Addition:** Mini league standings showing:
- League name and icon
- Current position (e.g., "Position #3")
- Total points (e.g., "45 pts")
- Gap to leader (e.g., "12 behind leader")

**Booster Activation:**
- Available boosters shown as pills (x2, x3, x5) with remaining count
- Player picks one booster per prediction (optional)
- Disabled/greyed out if none remaining
- Clear indicator of how many are left for the tournament

### 3. My Leagues Screen
**Overview Stats:**
- Total leagues
- Active leagues
- Top 3 positions count
- Total points across all leagues

**League Cards:**
- League name and member count
- Current position with icon (🏆 for 1st, etc.)
- Total points
- Status badge (active/completed)
- "View League Details" button

### 4. Live Match Experience
**Three-Column Layout:**

**All Predictions:**
- List of all predictions for the match
- User's prediction prominently highlighted
- Simple format: "Mike: 2-1", "Sarah: 0-0"

**Best Scores for You:**
- Top 3 scores that would give user maximum points
- Shows potential points for each score
- Explains scoring: "Croatian scoring: 5pts exact + bonus for rare picks, 3pts correct result"
- Based on rarity of predictions

**League Standings:**
- Current league table
- Real-time position changes with arrows
- Color-coded movements (green up, red down)
- User's position highlighted
- Updates when score changes

**Match Header:**
- Live indicator and current minute
- Current score
- Team badges and names

### 5. Auth Screens
- Login with magic link (email) and Google OAuth
- App branding prominent
- "Check your email" confirmation state after magic link sent

### 6. Create League
- League name, select competition, optional description
- Booster settings toggle with pool configuration
- Preview of invite code that will be generated

---

## User Flows

### New User Onboarding
1. Sign up / login
2. Join existing league (via invite link) or create new league
3. Set up profile
4. View upcoming matches
5. Make first predictions

### Weekly Prediction Flow
1. User opens app → sees upcoming matches
2. Clicks "Complete Predictions" on match card
3. Sees league context (current position, stakes)
4. Enters predictions (quick or custom per league)
5. Optionally activates a booster on high-confidence picks
6. Saves and sees confirmation
7. Receives deadline reminders

### Live Match Experience
1. Match starts → predictions unlock and become visible
2. User sees what everyone predicted
3. Checks "Best Scores for You" to know what to root for
4. Watches league standings update as score changes
5. Sees position movement in real-time

---

## Sample Data for Designs
Use these for realistic mockups:

**Teams:** Croatia, France, Brazil, Germany, Argentina, Spain, Portugal, England
**League names:** "Office League", "Balkan Boys", "World Cup 2026"
**Scores:** 2-1, 0-0, 3-2, 1-1
**Predictions:** Show 8-12 users with varied predictions
**Points:** Range from 0-10 per match, standings totals 30-85
**Boosters:** x2 (3 left), x3 (1 left), x5 (0 left / used up)
