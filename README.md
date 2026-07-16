# O'Moroney 2026 Open Championship Leaderboard

A live fantasy leaderboard for the 2026 O'Moroney at The Open Championship, built from the supplied team sheet of 10 main golfers and 6 alternates per team.

The default game is **B4R**: the lowest four rounds from any of a team's ten main golfers across the week. The app also includes **BROW**, **ART**, **Alt B4R**, **Straight**, and **Flush** views.

## Run Locally

Requires Node.js 20 or newer.

```bash
npm run dev
```

Open `http://localhost:3000`. The local server proxies live scoring through `/api/scores`, the same path Vercel uses.

## Scoring

- **B4R:** best four rounds from any of the team's 10 main golfers across all four rounds. A single golfer can contribute multiple counting rounds. Ties compare the next best unused round, then the next, until broken.
- **BROW:** best round for each of the 10 main golfers, for a 10-round total. Ties use the cumulative total of each golfer's next-best round.
- **ART:** total score of all 10 main golfers across Rounds 1 and 2.
- **Alt B4R:** best four rounds from any of the team's 6 alternates. Ties compare the next best unused alternate round, then the next, until broken.
- **Straight:** longest consecutive score string among the 10 main golfers' posted rounds through the selected day. Ties are broken by the lowest starting score.
- **Flush:** largest group of identical scores among the 10 main golfers' posted rounds through the selected day. Equal-size groups are broken by the lower score, then the next group.

## Withdrawal Replacement

If one of the starting 10 golfers withdraws, that golfer is replaced by the team's first alternate in the main-golfer games: **B4R**, **BROW**, **ART**, **Straight**, and **Flush**.

The first alternate still remains part of the alternate pool for **Alt B4R**.

## Event Setup

The live event defaults to ESPN's 2026 Open Championship event:

```text
ESPN_EVENT_ID=401811957
EVENT_PAR=70
EVENT_VENUE=Royal Birkdale
```

## Deploy

See `DEPLOYMENT.md` for the GitHub, Supabase, Vercel, and live URL update walkthrough.

## Data

Team picks live in `public/data/omoroney-picks.csv`. The supplied file currently contains 45 teams plus placeholder rows that the app ignores.

## Supabase

Supabase is optional for page functionality. If configured, each score refresh stores a timestamped snapshot in `score_snapshots` for history and later analysis.
