# John Deere Fantasy Leaderboard

A live fantasy leaderboard for the 2026 John Deere Classic simulation, built from the supplied team sheet of 8 main golfers and 4 alternates per team.

The default game is **B4R**: the lowest four rounds from any of a team's eight main golfers across the week. The app also includes **BROW**, **ART**, **Alt BROD**, **Straight**, and **Flush** views.

## Run locally

Requires Node.js 20 or newer.

```bash
npm run dev
```

Open `http://localhost:3000`. The local server proxies live scoring through `/api/scores`, the same path Vercel will use.

## Scoring

- **B4R:** best four rounds from any of the team's 8 main golfers across all four rounds. A single golfer can contribute multiple counting rounds. Ties compare the next best unused round, then the next, until broken.
- **BROW:** sum of each of the 8 main golfers' best round of the week. No tiebreaker.
- **ART:** total score of all 8 main golfers across Rounds 1 and 2. No tiebreaker.
- **Alt BROD:** best alternate round each day from the team's 4 alternates, for a four-day total. No tiebreaker.
- **Straight:** longest consecutive score string among the 8 main golfers' posted rounds through the selected day. Ties are broken by the lowest starting score.
- **Flush:** largest group of identical scores among the 8 main golfers' posted rounds through the selected day. Equal-size groups are broken by the lower score, then the next group.

During live play, a golfer's current round pace is `course par + current score to par`. Missed-cut and withdrawn golfers remain visible on weekend rounds but do not count for new R3/R4 scores.

## Event Setup

The live event defaults to ESPN's 2026 John Deere Classic event:

```text
ESPN_EVENT_ID=401811954
EVENT_PAR=71
EVENT_VENUE=TPC Deere Run
```

For the Open Championship build later, ESPN currently lists The Open as:

```text
ESPN_EVENT_ID=401811957
```

Keep `EVENT_PAR` and `EVENT_VENUE` updated for the course you deploy.

## Deploy

See `DEPLOYMENT.md` for the full GitHub, Supabase, Vercel, and custom URL walkthrough.

## Data

Team picks live in `public/data/john-deere-picks.csv`. The supplied file currently contains 100 teams plus the header row.

## Supabase

Supabase is optional for page functionality. If configured, each score refresh stores a timestamped snapshot in `score_snapshots` for history and later analysis.
