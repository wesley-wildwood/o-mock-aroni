# BMW Championship Fantasy Leaderboard

A live fantasy leaderboard for the 2026 BMW Championship contests, powered by the BMW Championship live feed from ESPN.

The app includes two contests:

- **MAC**
- **Aroni**

Both contests play the same games and can be toggled from the same live page. The default **At-a-Glance** view shows compact top-15 standings for the main and alternate games.

## Run Locally

Requires Node.js 20 or newer.

```bash
npm run dev
```

Open `http://localhost:3000`. The local server proxies live scoring through `/api/scores`, the same path Vercel uses.

## Scoring

- **B4R4:** Best 4 Rounds from 4 Different Golfers. Each team has 7 golfers. A team's score is the sum of the best four rounds from four different golfers across the tournament. One golfer can only contribute one counting round.
- **Alt B4R4:** Alternate Golfer Best 4 Rounds from 4 Different Golfers. Each team has 5 alternates. A team's alternate score is the sum of the best four rounds from four different alternate golfers.
- **At-a-Glance:** A compact home view showing the top 15 teams for B4R4 and Alt B4R4 without individual golfer cards.

Ties are ordered by the next best available golfer round, then the next, until broken.

## Event Setup

The live event defaults to ESPN's 2026 BMW Championship event:

```text
ESPN_EVENT_ID=401811963
EVENT_PAR=70
EVENT_VENUE=Bellerive Country Club
EVENT_CUT_PLACES=70
```

## Data

Contest picks live in:

```text
public/data/mac-picks.csv
public/data/aroni-picks.csv
```

Current field sizes:

- MAC: 28 teams
- Aroni: 14 teams

## Deploy

See `DEPLOYMENT.md` for the GitHub, Supabase, Vercel, and URL setup walkthrough.

## Supabase

Supabase is optional for page functionality. If configured, each score refresh stores a timestamped snapshot in `score_snapshots` for history and later analysis.
