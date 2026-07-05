# Deploy the John Deere / Open Prep Leaderboard

This project uses GitHub for source control, Vercel for the public website and score function, and Supabase for optional score snapshots.

## 1. Create a new GitHub repository

1. Download and unzip the project archive.
2. In GitHub, create a new empty repository, for example `john-deere-open-prep-leaderboard`.
3. Upload the extracted project contents into the repository root. These folders/files should be visible at the top level:
   - `api`
   - `public`
   - `supabase`
   - `package.json`
   - `vercel.json`
4. Commit the files to the `main` branch.

Do not upload `.env` files or secret keys.

## 2. Create Supabase

1. Go to [supabase.com](https://supabase.com), create a new project, and wait for it to finish provisioning.
2. Open **SQL Editor**.
3. Choose **New query**.
4. Paste the full contents of `supabase/migrations/001_initial.sql`.
5. Click **Run**.
6. Open **Project Settings > Data API** and copy the Project URL.
7. Open **Project Settings > API Keys** and copy or create a server-side secret key.

Keep the Supabase secret key private. It should only be added to Vercel environment variables.

## 3. Deploy on Vercel

1. Go to [vercel.com](https://vercel.com).
2. Click **Add New > Project**.
3. Import the new GitHub repository.
4. Leave **Root Directory** as the repository root.
5. Leave the framework preset as **Other**. The included `vercel.json` handles the static site and API function.
6. Add these environment variables:

```text
SUPABASE_URL=your Supabase project URL
SUPABASE_SECRET_KEY=your Supabase server-side secret key
ESPN_EVENT_ID=401811954
EVENT_PAR=71
EVENT_VENUE=TPC Deere Run
```

7. Apply the variables to **Production**, **Preview**, and **Development**.
8. Click **Deploy**.

Vercel will create a unique public URL like:

```text
https://your-project-name.vercel.app
```

## 4. Verify the deployment

1. Open the Vercel URL in a private browser window.
2. Confirm the status pill changes from **Connecting** to the live tournament status.
3. Confirm the tabs work: **B4R**, **BROW**, **ART**, **Alt BROD**, **Straight**, and **Flush**.
4. Open this URL, replacing the domain:

```text
https://your-project-name.vercel.app/api/scores
```

It should return JSON with `event`, `players`, and `updatedAt`.

5. In Supabase, open **Table Editor > score_snapshots**. A row should appear after the public page requests scores.

The leaderboard still works without Supabase, but it will not save score history.

## 5. Add a custom URL

1. In Vercel, open **Project > Settings > Domains**.
2. Add the domain or subdomain you want, such as:

```text
johndeere.yourdomain.com
```

3. Follow the DNS instructions Vercel shows.
4. Keep the default `vercel.app` address as a fallback.

## 6. Reuse for The Open Championship

For the Open Championship version, create a separate GitHub/Vercel project or branch so it has its own URL. Update:

```text
ESPN_EVENT_ID=401811957
EVENT_PAR=<Open course par>
EVENT_VENUE=<Open venue>
```

Then replace `public/data/john-deere-picks.csv` with the real Open Championship team sheet using the same columns:

```text
Contestant,Golfer 1,...,Golfer 8,Alt 1,...,Alt 4
```

## Troubleshooting

- **Page says Scores delayed:** open `/api/scores` directly and check Vercel **Project > Logs**.
- **`/api/scores` returns `NOT_FOUND`:** confirm `api/scores.js` is at the repository root and redeploy.
- **No Supabase rows:** recheck `SUPABASE_URL` and `SUPABASE_SECRET_KEY`, then redeploy.
- **Wrong tournament:** confirm `ESPN_EVENT_ID` is `401811954` for the John Deere simulation.
- **A golfer shows “No feed”:** the CSV name did not match ESPN's golfer name. Update the name in `public/data/john-deere-picks.csv` and redeploy.
