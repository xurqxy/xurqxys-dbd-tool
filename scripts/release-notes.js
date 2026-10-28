'use strict';
// Writes the GitHub release description for the current version: the CHANGELOG.md section plus download help,
// license and disclaimer. The release workflow uses it automatically; to paste it by hand:
//   node scripts/release-notes.js > release-notes.md
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const pkg = require('../package.json');
const v = pkg.version;
const repo = pkg.releasesRepo || (pkg.repository?.url || '').match(/github\.com\/([^/]+\/[^/.]+)/)?.[1] || 'xurqxy/xurqxys-dbd-tool';
const pagesUrl = `https://${repo.split('/')[0]}.github.io/${repo.split('/')[1]}/`;

const changelog = fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf8');
const section = changelog.split(/^## /m).find((s) => s.startsWith(`${v}\n`) || s.startsWith(`${v} `));
if (!section) throw new Error(`CHANGELOG.md has no "## ${v}" section`);
const changes = section.slice(section.indexOf('\n') + 1).trim();

process.stdout.write(`## What's new in ${v}

${changes}

## Downloads

| Device | File | Notes |
|---|---|---|
| **Windows** (recommended) | \`XurqxysDBDTool-${v}-Setup.exe\` | Installs in a folder you choose and starts fast. Updates itself. |
| Windows, no install | \`XurqxysDBDTool-${v}.exe\` | Portable single file. Unpacks itself on every start, so it opens a bit slower. |
| **Android** | \`XurqxysDBDTool-${v}.apk\` | Open it on your phone and allow installing from your browser once. |
| **iPhone / iPad** | [Open the web app](${pagesUrl}app/) | In Safari: Share → Add to Home Screen. |

Windows 10 or 11 (64-bit), Android 8 or newer.

**"Windows protected your PC"?** The app isn't code-signed yet (a certificate costs money every year), so Windows
SmartScreen warns about it at first. Click **More info → Run anyway**. The installers are built automatically by
GitHub Actions from the source in this repository.

Your matches, builds and settings carry over when you update.

---
Free fan-made app by [Xurqxy](https://github.com/xurqxy) · ☕ [Buy me a coffee](https://buymeacoffee.com/xurqxy)
· [License](https://github.com/${repo}/blob/main/LICENSE.txt) · [Privacy](https://github.com/${repo}/blob/main/PRIVACY.md)
· [Third-party notices](https://github.com/${repo}/blob/main/THIRD-PARTY-NOTICES.txt)

Not affiliated with or endorsed by Behaviour Interactive. Dead by Daylight and its icons and artwork are trademarks and
property of Behaviour Interactive. No game assets are included in these downloads.
`);
