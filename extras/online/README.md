# Online features (parked)

Discord login, leaderboards and anonymous community stats on Supabase. Built and tested, but switched off
for now, so nothing here is part of the app build.

To turn them back on later:

1. Move `online.js` and `online.config.json` back to the project root and `community.js` back into `src/`.
2. Restore the wiring removed in v1.5.1: `require('./online')`, the `online:*` IPC handlers and `online.init(...)` in
   `main.js`, the `online` block in `preload.js`, the `community.js` script tag and nav button in `src/index.html`,
   the `community` entries in `VIEWS`/`NAV` and `initOnline()` in `src/app.js`, the `queueSpin`/`syncProgress`
   calls in `src/achievements.js`, and the two files in `package.json` → `build.files`.
   (`git show v1.5.0` shows exactly how it looked.)
3. Follow `docs/SUPABASE.md` to create the Supabase project.
