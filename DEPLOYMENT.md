# Deploy The BMW Championship Leaderboard

Use these steps to update the same GitHub repository, Supabase project, and Vercel project used for the prior fantasy golf build.

The packaged app includes both contests, **MAC** and **Aroni**, with an in-page toggle. That is the simplest deployment. You can later add separate Vercel domains or subdomains that point to the same project.

## 1. Update GitHub

1. Download and unzip the latest BMW Championship project archive.
2. Open the existing GitHub repo connected to Vercel.
3. Upload the extracted project contents into the repository root.
4. Replace existing files when GitHub asks.
5. Confirm these are visible at the top level:
   - `api`
   - `public`
   - `supabase`
   - `package.json`
   - `vercel.json`
   - `README.md`
   - `DEPLOYMENT.md`
6. Confirm both contest files are present:

```text
public/data/mac-picks.csv
public/data/aroni-picks.csv
```

7. Commit the changes directly to `main`.

Do not upload `.env` files or Supabase secret keys.

## 2. Keep The Same Supabase Project

No new Supabase project is required.

If `supabase/migrations/001_initial.sql` has already been run, you do not need to run it again. The same `score_snapshots` table can store this event because each row includes `event_id`.

If Supabase was not set up yet:

1. Go to [supabase.com](https://supabase.com).
2. Open your project.
3. Go to **SQL Editor**.
4. Paste the full contents of `supabase/migrations/001_initial.sql`.
5. Click **Run**.

## 3. Update Vercel Environment Variables

1. Go to [vercel.com](https://vercel.com).
2. Open the existing project.
3. Go to **Settings > Environment Variables**.
4. Set or update:

```text
ESPN_EVENT_ID=401811963
EVENT_PAR=70
EVENT_VENUE=Bellerive Country Club
EVENT_CUT_PLACES=70
SUPABASE_URL=your existing Supabase Project URL
SUPABASE_SECRET_KEY=your existing Supabase server-side secret key
```

Apply the variables to **Production**, **Preview**, and **Development**.

## 4. Redeploy On Vercel

If your GitHub repo is connected to Vercel, committing to `main` should automatically create a new Production deployment.

To redeploy manually:

1. Open **Vercel > Project > Deployments**.
2. Click the three-dot menu on the latest deployment.
3. Choose **Redeploy**.
4. Wait until the deployment shows **Ready**.

## 5. Verify The Site

1. Open the live URL in an incognito/private browser window.
2. Confirm the header says **BMW Championship**.
3. Confirm the course card says **Bellerive Country Club** and **Par 70**.
4. Confirm the contest toggle works:
   - `MAC`
   - `Aroni`
5. Confirm the game toggle works:
   - `B4R4`
   - `Alt B4R4`
6. Open:

```text
https://YOUR-VERCEL-URL.vercel.app/api/scores
```

It should return JSON with the BMW Championship event id, currently configured as `401811963`.

7. In Supabase, open **Table Editor > score_snapshots**. New rows should appear with the BMW Championship event id.

## 6. Optional Separate URLs Or Subdomains

The current build uses one shared URL with a visible MAC/Aroni toggle. That is easiest to maintain.

If you want separate public-facing URLs, the cleanest Vercel setup is:

1. Keep one Vercel project and one GitHub repo.
2. Add two custom domains or subdomains in **Vercel > Project > Settings > Domains**, for example:
   - `mac.yourdomain.com`
   - `aroni.yourdomain.com`
3. Point both domains to the same Vercel project.
4. Use the in-page toggle for now, or add default-contest routing later if you want each subdomain to open directly to its contest.

## Troubleshooting

- **Site still shows the prior event:** update `ESPN_EVENT_ID` to `401811963`, then redeploy.
- **Scores delayed:** open `/api/scores` directly and check Vercel **Project > Logs**.
- **`/api/scores` returns `NOT_FOUND`:** confirm `api/scores.js` is at the repository root.
- **A golfer shows “No feed”:** the CSV name did not match ESPN's golfer name. Update the name in `public/data/mac-picks.csv` or `public/data/aroni-picks.csv`, commit, and redeploy.
- **Supabase has no new rows:** recheck `SUPABASE_URL` and `SUPABASE_SECRET_KEY`, then redeploy.
