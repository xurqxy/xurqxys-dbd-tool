# Putting the app on GitHub (step by step)

This gets you a GitHub page with the source, a proper description, the license, and a **Releases** section with all
installers (Windows Setup, Windows portable, Android APK), plus a website with the download buttons and the iPhone web
app. After the one-time setup, publishing a new version is a single command.

You need a free GitHub account and [GitHub Desktop](https://desktop.github.com) (or git on the command line).

---

## 1. Upload the project (this also creates the repository)
1. Unzip `xurqxys-dbd-tool-v1.7.0-source.zip` into a folder named `xurqxys-dbd-tool`.
2. GitHub Desktop: **File → Add local repository** → pick that folder. It says it isn't a repository yet: click
   **create a repository**, then **Create repository** (leave the license and .gitignore options on "None",
   they're already in the project).
3. Click **Publish repository**. Keep the name **`xurqxys-dbd-tool`** (the app looks for updates there) and
   **untick "Keep this code private"** (needed for free downloads, updates and the website; see the end for
   keeping the code private).

Tip: in GitHub Desktop under **File → Options → Git**, use your GitHub "noreply" email so your personal email
address doesn't appear publicly in the commit history.

## 2. Fill in the About box (right side of the repo page)
Click the ⚙️ next to **About** and paste:

- **Description:**
  `Free Dead by Daylight companion: build randomizer, perk database, match tracker and stats. Windows, Android and iPhone.`
- **Website:** `https://xurqxy.github.io/xurqxys-dbd-tool/`
- **Topics:** `dead-by-daylight` `dbd` `randomizer` `build-randomizer` `perk-randomizer` `electron` `windows` `android` `pwa` `gaming-tools`
- Tick **Releases**, untick **Packages** and **Deployments** if you like it tidy.

GitHub shows the license automatically from `LICENSE.txt` (as "View license", since it's a custom license).

## 3. Add the Android signing key (once)
Repo → **Settings → Secrets and variables → Actions → New repository secret**. Add the four values from
`README-KEEP-SECRET.txt` inside `android-signing-KEEP-SECRET.zip` (from v1.6.0):
`ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`.

## 4. Turn on the website
Repo → **Settings → Pages** → **Source: GitHub Actions**. The site (download page + iPhone/Android web app) is published
on every push to `main`. The first one starts when you push; you can also run **Actions → Website → Run workflow**.

## 5. Publish the release (all installers)
Push a version tag. In GitHub Desktop: **Repository → Open in Command Prompt**, then:
```
git tag v1.7.0
git push origin v1.7.0
```
GitHub Actions now builds everything (about 10 minutes, see the **Actions** tab) and creates the release
**Xurqxys DBD Tool v1.7.0** with:
- `XurqxysDBDTool-1.7.0-Setup.exe` (Windows installer)
- `XurqxysDBDTool-1.7.0.exe` (Windows portable)
- `XurqxysDBDTool-1.7.0.apk` (Android)
- `LICENSE.txt` and `THIRD-PARTY-NOTICES.txt`
- a description with what's new, a download table, SmartScreen help, license links and the Behaviour disclaimer
  (made from `CHANGELOG.md` by `scripts/release-notes.js`)

Everyone with an older version then sees the **Update** button in the app.

### Doing it by hand instead
**Releases → Draft a new release → Choose a tag:** `v1.7.0` (create) → **Title:** `Xurqxys DBD Tool v1.7.0` →
paste the output of `node scripts/release-notes.js` → drag in the two `.exe` files, `LICENSE.txt` and
`THIRD-PARTY-NOTICES.txt` → **Publish release**. The APK can only be built by the workflow (or with Android Studio).

## Every next version
1. Change the code, bump `"version"` in `package.json`, add a `## 1.7.1` section at the top of `CHANGELOG.md`.
2. Commit + push, then `git tag v1.7.1` and `git push origin v1.7.1`. Done.

---

## Staying out of trouble (checklist)
- ✅ **License** (`LICENSE.txt`): free to use, no reselling, no modified copies, no copying the code. Shipped inside the
  apps and attached to every release.
- ✅ **Third-party licenses** (`THIRD-PARTY-NOTICES.txt`): Electron, Chromium, Capacitor and the two fonts allow this use;
  their notices are included as their licenses require. Regenerate with `node scripts/notices.js` after updating them.
- ✅ **Behaviour Interactive / Dead by Daylight**: the app says everywhere that it's unofficial and not affiliated.
  **No game icons or art are in the repo or the downloads**: each user's app downloads them from the community wiki.
  Keep it that way: don't commit the icons, and don't use the DBD logo as your app icon or in the name.
- ✅ **Free**: keep it free and non-commercial; free fan tools that don't ship the game's assets are the safest kind of
  fan project. Optional donations (Buy me a coffee) are common, but don't sell the app or lock features behind a
  payment. If Behaviour publishes fan-content rules, read them before you ever add anything paid.
- ✅ **Privacy** (`PRIVACY.md`): nothing is collected. If you ever add online features, update it first.
- ⚠️ **Unsigned app**: Windows shows a SmartScreen warning until you buy a code-signing certificate
  (`docs/SIGNING.md`). Not a legal problem, just a trust one; the release notes explain it to users.

This is practical guidance, not legal advice.

## Keeping the source code private (optional)
Make this repo private, create a second **public** repo (e.g. `xurqxys-dbd-tool-releases`) with just a README, then in
this repo set **Settings → Secrets and variables → Actions → Variables → `RELEASES_REPO`** = `xurqxy/xurqxys-dbd-tool-releases`,
add a secret `RELEASES_TOKEN` (a fine-grained token with "Contents: read and write" on the releases repo), and set
`"releasesRepo": "xurqxy/xurqxys-dbd-tool-releases"` in `package.json`. Downloads, updates and the website then come
from the public repo while the code stays private. Copy `LICENSE.txt`, `PRIVACY.md` and `THIRD-PARTY-NOTICES.txt`
into the public repo too.
