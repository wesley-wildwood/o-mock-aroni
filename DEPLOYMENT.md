# Update Existing Deployment For The O'Moroney

Use these steps to update the same GitHub repository, Supabase project, and Vercel project that powered the Scottish Open build.

## 1. Update The Existing GitHub Repository

1. Download and unzip the latest O'Moroney project archive.
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
6. Confirm the picks file is present:

```text
public/data/omoroney-picks.csv
```

7. Commit the changes directly to `main`.

Do not upload `.env` files or Supabase secret keys.

## 2. Keep The Same Supabase Project

No new Supabase project is required.

If you already ran `supabase/migrations/001_initial.sql`, you do not need to run it again. The same `score_snapshots` table can store Open Championship snapshots because each row includes `event_id`.

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
ESPN_EVENT_ID=401811957
EVENT_PAR=70
EVENT_VENUE=Royal Birkdale
SUPABASE_URL=your existing Supabase Project URL
SUPABASE_SECRET_KEY=your existing Supabase server-side secret key
```

Apply the variables to **Production**, **Preview**, and **Development**.

The code also defaults to the Open Championship values, but Vercel environment variables override the code defaults. If old Scottish Open values remain in Vercel, the site will keep loading Scottish Open scores.

## 4. Redeploy On Vercel

If your GitHub repo is connected to Vercel, committing to `main` should automatically create a new Production deployment.

To redeploy manually:

1. Open **Vercel > Project > Deployments**.
2. Click the three-dot menu on the latest deployment.
3. Choose **Redeploy**.
4. Wait until the deployment shows **Ready**.

## 5. Verify The Site

1. Open the live URL in an incognito/private browser window.
2. Confirm the header says **O'Moroney 2026**.
3. Confirm the course card says **Royal Birkdale** and **Par 70**.
4. Confirm the tabs work:
   - `Overview`
   - `B4R`
   - `BROW`
   - `ART`
   - `Alt B4R`
   - `Straight`
   - `Flush`
   - `MTMC`
   - `Spread`
5. Open:

```text
https://YOUR-VERCEL-URL.vercel.app/api/scores
```

It should return JSON with `event.id` equal to `401811957`.

6. In Supabase, open **Table Editor > score_snapshots**. New rows should appear with the Open Championship `event_id`.

## Troubleshooting

- **Site still shows the prior event:** update the Vercel environment variables, especially `ESPN_EVENT_ID`, then redeploy.
- **Scores delayed:** open `/api/scores` directly and check Vercel **Project > Logs**.
- **`/api/scores` returns `NOT_FOUND`:** confirm `api/scores.js` is at the repository root.
- **A golfer shows “No feed”:** the CSV name did not match ESPN's golfer name. Update the name in `public/data/omoroney-picks.csv`, commit, and redeploy.
- **Supabase has no new rows:** recheck `SUPABASE_URL` and `SUPABASE_SECRET_KEY`, then redeploy.
