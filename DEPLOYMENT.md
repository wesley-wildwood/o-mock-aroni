# Update Existing Deployment For The Scottish Open

Use these steps to update the same GitHub repository, Supabase project, and Vercel project that were used for the John Deere mock game.

## 1. Update The Existing GitHub Repository

1. Download and unzip the latest Scottish Open project archive.
2. Open your existing GitHub repo for the Vercel project, for example `o-mock-aroni`.
3. Upload the extracted project contents into the repository root.
4. Replace the existing files when GitHub asks.
5. Confirm these are visible at the top level:
   - `api`
   - `public`
   - `supabase`
   - `package.json`
   - `vercel.json`
   - `README.md`
   - `DEPLOYMENT.md`
6. Commit the changes directly to `main`.

Do not upload `.env` files or Supabase secret keys.

## 2. Keep The Same Supabase Project

No new Supabase project is required.

If you already ran `supabase/migrations/001_initial.sql` for the John Deere build, you do not need to run it again. The same `score_snapshots` table can store Scottish Open snapshots because each row includes `event_id`.

If Supabase was not set up yet:

1. Go to [supabase.com](https://supabase.com).
2. Open your project.
3. Go to **SQL Editor**.
4. Paste the full contents of `supabase/migrations/001_initial.sql`.
5. Click **Run**.

## 3. Update Existing Vercel Environment Variables

Because you are reusing the same Vercel project, update the existing tournament variables.

1. Go to [vercel.com](https://vercel.com).
2. Open the existing project, for example `o-mock-aroni`.
3. Go to **Settings > Environment Variables**.
4. Set or update:

```text
ESPN_EVENT_ID=401811955
EVENT_PAR=70
EVENT_VENUE=The Renaissance Club
SUPABASE_URL=your existing Supabase Project URL
SUPABASE_SECRET_KEY=your existing Supabase server-side secret key
```

Apply the variables to **Production**, **Preview**, and **Development**.

The code also defaults to the Scottish Open values, but Vercel environment variables override the code defaults. If the old John Deere values remain in Vercel, the site will keep loading John Deere scores.

## 4. Redeploy On Vercel

If your GitHub repo is connected to Vercel, committing to `main` should automatically create a new Production deployment.

To redeploy manually:

1. Open **Vercel > Project > Deployments**.
2. Click the three-dot menu on the latest deployment.
3. Choose **Redeploy**.
4. Wait until the deployment shows **Ready**.

## 5. Verify The Site

1. Open the live URL in an incognito/private browser window.
2. Confirm the header says **Scottish Open simulation**.
3. Confirm the course card says **The Renaissance Club** and **Par 70**.
4. Confirm the tabs work:
   - `B4R`
   - `BROW`
   - `ART`
   - `Alt BROD`
   - `Straight`
   - `Flush`
5. Open:

```text
https://YOUR-VERCEL-URL.vercel.app/api/scores
```

It should return JSON with `event.id` equal to `401811955`.

6. In Supabase, open **Table Editor > score_snapshots**. New rows should appear with the Scottish Open `event_id`.

## 6. Reuse For The Open Championship

For the Open Championship next week, you can reuse this same project again.

Update the picks file:

```text
public/data/scottish-open-picks.csv
```

Keep the same column pattern:

```text
Teams,Golfer 1,...,Golfer 8,First Alt,Second Alt,Third Alt,Fourth Alt
```

Then update Vercel environment variables:

```text
ESPN_EVENT_ID=401811957
EVENT_PAR=<Open course par>
EVENT_VENUE=<Open venue>
```

Commit the changes to GitHub and redeploy.

## Troubleshooting

- **Site still shows John Deere:** update the Vercel environment variables, especially `ESPN_EVENT_ID`, then redeploy.
- **Scores delayed:** open `/api/scores` directly and check Vercel **Project > Logs**.
- **`/api/scores` returns `NOT_FOUND`:** confirm `api/scores.js` is at the repository root.
- **A golfer shows “No feed”:** the CSV name did not match ESPN's golfer name. Update the name in `public/data/scottish-open-picks.csv`, commit, and redeploy.
- **Supabase has no new rows:** recheck `SUPABASE_URL` and `SUPABASE_SECRET_KEY`, then redeploy.
