# Supabase setup

The dashboard works fully without Supabase. Add Supabase only when you want cross-device sync.

## 1. Create the project

1. Create a Supabase project.
2. Open the SQL editor.
3. Run `supabase/schema.sql`.
4. Confirm Row Level Security is enabled on every personal-data table.

## 2. Add frontend-safe config

Copy:

```text
assets/js/config.example.js
```

to:

```text
assets/js/config.js
```

Fill in your project URL and public anon key:

```js
window.SUPABASE_CONFIG = {
  url: 'https://YOUR_PROJECT_REF.supabase.co',
  anonKey: 'YOUR_PUBLIC_ANON_KEY'
};
```

The anon key is safe to ship in frontend code only because Row Level Security restricts every row to `auth.uid() = user_id`. Never put a service-role key, GitHub token, or database password in this project.

## 3. Authentication

The app uses email magic-link auth. Enter your email in Settings after Supabase is configured. The dashboard remains usable in Local only mode if you are logged out or offline.

## 4. Sync behavior

- Workout sessions, set logs and weight logs are stored in IndexedDB first.
- Each local write also enters `syncQueue`.
- When online and authenticated, pending queue items are upserted to Supabase.
- Custom audio files stay local and are not synced.
- Sync status is shown as Local only, Supabase ready, Syncing, Synced, Offline or Sync error.
