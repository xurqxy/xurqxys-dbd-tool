# The mobile app (phone & tablet)

The same tool runs on phones two ways, both built from the same code as the desktop app:

- **Web app (PWA)** — open the website on your phone and add it to the home screen. Nothing to install, updates itself.
- **Android app (APK)** — a real installable app, built and attached to each GitHub Release.

There is **no iPhone app in the App Store**. Apple charges $99/year for a developer account and only lets you install
apps through them. The **web app covers iPhone instead**: it runs in Safari and installs to the home screen like a normal
app (details below). This is the normal, free way to put a tool like this on an iPhone.

Your matches, builds and settings are saved **on the phone** (in the browser's storage), the same as the desktop app keeps
them on the PC. They don't sync between devices.

---

## For your players

### iPhone / iPad
1. Open the website in **Safari** (it must be Safari, not Chrome).
2. Tap the **Share** button (the square with an arrow) → **Add to Home Screen** → **Add**.
3. Open it from the home screen. It runs full-screen with no browser bars.

### Android
- **Easiest:** download the **APK** from the latest release and open it. Android asks to allow installing from your
  browser once — allow it, then tap Install.
- **Or** open the website in Chrome → menu (⋮) → **Add to Home screen / Install app**.

The website's download page detects the phone and shows the right option automatically.

---

## For you (building it)

### Automatic (recommended)
When you push a version tag (e.g. `v1.6.0`), GitHub Actions builds the Windows exe **and** the Android APK and attaches
both to the release. The website with the phone web app is published by the Pages workflow whenever you push to `main`.
You don't need Android Studio for any of this.

### The one-time signing key (so you can update the Android app later)
Android apps must be signed, and **every update has to be signed with the same key** or phones refuse it. A key has been
generated for you and is in the file **`android-signing-KEEP-SECRET.zip`** that came with this version.

1. Unzip it somewhere safe and back it up (password manager / USB stick). **If you lose it, you can never update the
   Android app again** — players would have to uninstall and reinstall, losing their data.
2. Open the ZIP's `README-KEEP-SECRET.txt`. It lists four values.
3. On GitHub: your repo → **Settings → Secrets and variables → Actions → New repository secret**, and add all four:
   `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`.

Until you add them, the release workflow still builds an APK, but signs it with a throwaway key — fine for testing on your
own phone, not for an app people keep and update. The keystore ZIP is **not** in the repository, on purpose.

### Building it yourself (optional)
```
npm run build:mobile      # builds the phone web app into dist-mobile/ (also what the PWA uses)
npm run build:android     # builds the web app and copies it into the android/ project
```
To make an APK locally you need Android Studio (or the Android SDK + JDK 17), then in `android/`:
`./gradlew assembleRelease`. The GitHub workflow does exactly this, so you rarely need to.

### How it's put together
- `mobile/web-api.js` is the phone version of the desktop app's `preload.js`: it provides the same `window.api`, but
  backed by the browser (localStorage for data, the wiki for icons, the share sheet for files) instead of Electron.
- `scripts/build-mobile.js` bundles it with the renderer from `src/`, adds the PWA manifest, service worker and icons,
  and obfuscates everything for release.
- `android/` is a Capacitor project that wraps that web app in a native Android shell.
- The icons are **linked from the DBD Wiki** on the phone rather than downloaded, so the app stays small.
