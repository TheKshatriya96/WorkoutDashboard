# Workout Dashboard v2

Local-first workout, diet and progress dashboard for Swapnil's controlled lean-bulk plan.

This version preserves the v01 workout split, diet plans, automatic weekday workout selection, A/B exercise images and manually replaceable image paths. Workout progress is now stored in IndexedDB instead of a repository database file.

## Open locally

For basic use, double-click `index.html`.

For PWA/service-worker testing, run a local server from this folder:

```powershell
python -m http.server 4173
```

Then open:

```text
http://localhost:4173/
```

## Main features

- Structured exercise metadata in `assets/js/data.js`
- Set-by-set workout logging in IndexedDB
- Absolute timestamp rest timer that survives refresh
- Sound, vibration and notification preferences
- Custom uploaded sound stored in IndexedDB
- Workout sessions and history
- Progress tab with weight logging and 30-day trend chart
- JSON backup/import and CSV exports
- Optional Supabase magic-link sync with Row Level Security
- PWA manifest and service worker for offline app shell

## IndexedDB stores

Database name: `swapnil-workout-dashboard`

Stores:

- `workoutSessions`
- `setLogs`
- `weightLogs`
- `settings`
- `customSounds`
- `syncQueue`

Every set is saved immediately. Stable set IDs prevent accidental duplicate rows from rapid taps.

## Supabase

The app works in Local only mode until Supabase is configured.

1. Run `supabase/schema.sql` in your Supabase SQL editor.
2. Copy `assets/js/config.example.js` to `assets/js/config.js`.
3. Add your project URL and public anon key.
4. Use the Settings panel to send an email magic link.

Do not put service-role keys, GitHub tokens, database passwords, exports or personal backups in frontend code.

Full setup notes are in `docs/SUPABASE_SETUP.md`.

## PWA cache updates

The service worker cache version is defined at the top of `service-worker.js`:

```js
const CACHE_VERSION = 'workout-dashboard-v2-2026-09-30-4';
```

Increment this value after changing cached files or replacing exercise images for a deployed build. Exercise images use a network-first strategy with cache fallback so replacements are not kept stale forever.

## Replace exercise images

Use `image-chart.html` to inspect all A/B image filenames.

Full instructions remain in:

```text
docs/IMAGE_REPLACEMENT_GUIDE.md
```

## GitHub Pages

This project includes `.github/workflows/deploy-pages.yml`.

Manual steps still required:

1. Create or choose the GitHub repository.
2. Commit this `v2` folder as the repository root, or move the contents of `v2` to your repository root.
3. Push to the `main` branch.
4. In GitHub, enable Pages with GitHub Actions as the source.
5. Confirm the deployed URL, usually `https://username.github.io/WorkoutDashboard/`.

All app paths are relative so the dashboard can run from a repository subpath.
