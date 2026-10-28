# Protecting the app from tampering and copying

This explains, in plain terms, what stops people from easily reading or changing the app, and what it can't do.

## What's switched on

**The code is obfuscated.** Before every release build, `scripts/protect.js` runs every JavaScript file through an
obfuscator: names become meaningless, text is encoded, and the layout is scrambled. The app in the repo stays readable;
only the shipped copy is scrambled. The desktop app, the Android app and the phone web app all get this.

**The desktop app checks itself (asar integrity).** The app's code is packed into one file (`app.asar`) inside the exe,
and the exe stores a fingerprint of it. If anyone edits that file, the fingerprint no longer matches and the app refuses
to start. This is verified on each build — a modified copy fails with *"Integrity check failed"*.

**Electron's security fuses are flipped** (`scripts/after-pack.js`). These turn off the usual ways of prying a packaged
Electron app open or running your own code through it: running the exe as plain Node, `--inspect` debugging, the
`NODE_OPTIONS` variable, and loading a swapped-in app folder instead of the real `app.asar`.

**Developer tools are off** in the released build, so right-click → Inspect does nothing for a normal user.

## What this does and doesn't do

It stops casual copying and tampering: someone can't just open the files, tweak them and repackage, or read the code at a
glance. That's the realistic goal.

It is **not** unbreakable, and nothing that runs on someone else's computer can be. A determined person with the right
tools can still get at what the app does — that's true of every app, including big commercial ones. So:

- **Don't hide secrets in the app.** No private API keys, passwords or anything that would be dangerous if read. (The app
  doesn't have any, and the parked online feature was designed the same way — only a public key ever ships.)
- The protection is about raising the effort, not making it impossible.

## Stronger options, if you ever want them

- **Code signing** removes the Windows *"unknown publisher"* warning and proves the app is really from you. It costs money
  each year. See `docs/SIGNING.md`; the release workflow picks it up automatically once you add the certificate.
- **A separate public releases repo.** If you ever make the source repo private, set the `RELEASES_REPO` variable and the
  `RELEASES_TOKEN` secret on GitHub, and the workflows publish the downloads and website to that public repo instead,
  while your code stays private. Leaving them unset keeps everything in this one repo, as it is now.
