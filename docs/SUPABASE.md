# Switching on the online features (Supabase)

> **Parked:** the online features are switched off since v1.5.1. See `extras/online/README.md` for how to turn them back on first.

This turns on the **Community** tab: Discord login, leaderboards and anonymous community stats.
It takes about 15 minutes and costs nothing on Supabase's free plan.

You'll copy two values into `online.config.json` at the end. Everything else is clicking in the Supabase and
Discord websites.

---

## 1. Create the Supabase project

1. Go to <https://supabase.com/dashboard> and click **New project**.
2. **Name:** `xurqxys-dbd-tool`. **Database password:** click *Generate* and save it in your password manager
   (the app never needs it). **Region:** the one closest to most of your players (e.g. *Central EU (Frankfurt)*).
3. Click **Create new project** and wait a minute until it's ready.

## 2. Create the database tables

1. In the left sidebar open **SQL Editor** → **New query**.
2. Open `supabase/schema.sql` from this repo, copy **all** of it, paste it into the editor.
3. Click **Run**. You should see *Success. No rows returned*.

(Running it again later is safe; it only updates things.)

## 3. Create a Discord app for the login

1. Go to <https://discord.com/developers/applications> → **New Application** → name it `Xurqxys DBD Tool` → **Create**.
2. Optional: under **General Information** upload the app icon (`build/icon.png`). Players see it on the login screen.
3. Open **OAuth2** in the left menu.
4. Copy the **Client ID** somewhere for a moment.
5. Click **Reset Secret** → copy the **Client Secret** (it's only shown once).
6. Under **Redirects** click **Add Redirect** and paste the *Callback URL* from step 4.3 below.
   It looks like `https://abcdefghijklm.supabase.co/auth/v1/callback`. Click **Save Changes**.

## 4. Connect Discord to Supabase

1. In Supabase open **Authentication** → **Sign In / Providers** (on older dashboards: **Providers**).
2. Find **Discord** and open it.
3. Copy the **Callback URL** shown there into Discord (step 3.6 above).
4. Switch **Enable Sign in with Discord** on, paste the **Client ID** and **Client Secret** from step 3, click **Save**.

## 5. Allow the app's login address

1. Still in **Authentication**, open **URL Configuration**.
2. Under **Redirect URLs** click **Add URL** and add exactly:

   ```
   http://127.0.0.1:7374/auth/callback
   ```

3. Click **Save**. (The *Site URL* field can stay as it is, or set it to your GitHub page.)

This is how the app gets the login back from your browser: after you log in with Discord, the browser is sent
to that address, which the app listens on for a moment.

## 6. Put the keys into the app

1. In Supabase open **Project Settings** (gear icon) → **API Keys** (on some dashboards: **Data API** / **API**).
2. Copy the **Project URL** (`https://abcdefghijklm.supabase.co`) and the **anon / publishable** key
   (starts with `eyJ…` or `sb_publishable_…`).
3. Open `online.config.json` in the repo and fill them in:

   ```json
   {
     "url": "https://abcdefghijklm.supabase.co",
     "anonKey": "eyJhbGciOi…"
   }
   ```

> ⚠️ Only ever use the **anon / publishable** key. It's designed to be public: the database rules in
> `schema.sql` decide what it may do. **Never** put the `service_role` / secret key in the app or on GitHub.

## 7. Release it

Commit `online.config.json` and publish a new version (see *Releasing a new version* in the README):

```
git add online.config.json
git commit -m "Turn on online features"
git push
git tag v1.5.1 && git push origin v1.5.1
```

Everyone who updates gets the Community tab with login and leaderboards.

## 8. Test it

Open the app → **Community** → **Log in with Discord**. Your browser opens, Discord asks to authorize
*Xurqxys DBD Tool*, then the page says **Logged in ✓**. Back in the app you should see yourself on the leaderboard.

If something goes wrong, the app shows the error message. The common ones:

| Message | Fix |
|---|---|
| `Unsupported provider` / `provider is not enabled` | Step 4: Discord isn't switched on or wasn't saved. |
| The browser lands on your Site URL instead of "Logged in ✓" | Step 5: the redirect URL is missing or has a typo. |
| `Invalid redirect` on Discord's page | Step 3.6: the Discord redirect must be Supabase's callback URL. |
| `Port 7374 is in use` | Another program uses that port; close it and try again. |

---

## What gets stored, and what you're responsible for

- **Logged-in players:** their Discord display name, profile picture link, and three numbers (spins,
  achievements, days used). Nothing about their matches leaves their PC.
- **Community stats:** which character was rolled in which mode, per day, with **no user ID or name**.
- Players can hide themselves from the leaderboard and **delete their account** from the Community tab.

Because you're now storing other people's data, mention this on your website (the FAQ already has a
"Is my data uploaded?" entry you can extend), and answer if someone asks you to remove their data.
In Supabase you can see everything under **Table Editor**.

### Why the leaderboard can't just be faked

Match results are typed in by players, so they're kept off the leaderboard. The leaderboard only uses numbers the
tool counts itself, and the database refuses unrealistic jumps: at most one spin per second and one active day per
day since the last upload, and big imports are capped. Someone determined could still script fake spins, but it's
slow and pointless, and you can delete a row in the **Table Editor** if you ever need to.
