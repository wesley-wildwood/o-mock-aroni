# Scottish Open Fantasy Leaderboard

A live fantasy leaderboard for the 2026 Genesis Scottish Open simulation, built from the supplied team sheet of 8 main golfers and 4 alternates per team.

The default game is **B4R**: the lowest four rounds from any of a team's eight main golfers across the week. The app also includes **BROW**, **ART**, **Alt BROD**, **Straight**, and **Flush** views.

## Run locally

Requires Node.js 20 or newer.

```bash
npm run dev
```

Open `http://localhost:3000`. The local server proxies live scoring through `/api/scores`, the same path Vercel uses.

## Scoring

- **B4R:** best four rounds from any of the team's 8 main golfers across all four rounds. A single golfer can contribute multiple counting rounds. Ties compare the next best unused round, then the next, until broken.
- **BROW:** best round for each golfer on the team, for an 8-round total. No tiebreaker.
- **ART:** total score of all 8 main golfers across Rounds 1 and 2. No tiebreaker.
- **Alt BROD:** best alternate round each day from the team's 4 alternates, for a four-day total. No tiebreaker.
- **Straight:** longest consecutive score string among the 8 main golfers' posted rounds through the selected day. Ties are broken by the lowest starting score.
- **Flush:** largest group of identical scores among the 8 main golfers' posted rounds through the selected day. Equal-size groups are broken by the lower score, then the next group.

## Withdrawal Replacement

If one of the starting 8 golfers withdraws, that golfer is replaced by the team's first alternate in the main-golfer games: **B4R**, **BROW**, **ART**, **Straight**, and **Flush**.

The first alternate still remains part of the alternate pool for **Alt BROD**.

## Event Setup

The live event defaults to ESPN's 2026 Genesis Scottish Open event:

```text
ESPN_EVENT_ID=401811955
EVENT_PAR=70
EVENT_VENUE=The Renaissance Club
```

For the Open Championship build later, ESPN currently lists The Open as:

```text
ESPN_EVENT_ID=401811957
```

Keep `EVENT_PAR` and `EVENT_VENUE` updated for the course you deploy.

## Deploy

See `DEPLOYMENT.md` for the GitHub, Supabase, Vercel, and custom URL update walkthrough.

## Data

Team picks live in `public/data/scottish-open-picks.csv`. The supplied file currently contains 100 teams plus the header row.

## Supabase

Supabase is optional for page functionality. If configured, each score refresh stores a timestamped snapshot in `score_snapshots` for history and later analysis.
