# Code signing (removes the "Windows protected your PC" warning)

Windows SmartScreen warns about unsigned apps. Signing the `.exe` with a code-signing certificate makes it show
**Xurqxys** as the publisher, and the warning fades as more people download the app.

The release workflow (`.github/workflows/release.yml`) signs automatically once these two repository secrets exist:

| Secret | Value |
|---|---|
| `WIN_CSC_LINK` | Your `.pfx` certificate, base64-encoded (`base64 -w0 cert.pfx` or `[Convert]::ToBase64String([IO.File]::ReadAllBytes("cert.pfx"))` in PowerShell) |
| `WIN_CSC_KEY_PASSWORD` | The certificate's password |

Add them under **GitHub → repo → Settings → Secrets and variables → Actions**. Without them, the workflow still
builds, just unsigned.

## Where to get a certificate

- **SignPath Foundation**: free signing for open-source projects (the repo must be public with an OSI license).
- **Azure Trusted Signing**: about $10/month and needs an identity check. It uses a different setup (`azure/trusted-signing-action`) instead of a `.pfx`.
- **Classic OV certificate** (Sectigo, Certum and others): roughly $100–$400 per year. Certum's "Open Source Code Signing" is the cheapest option for individuals.

Since 2023, new certificates come on a hardware token or cloud HSM, not a plain `.pfx`. For those, use the
vendor's signing tool in the workflow instead of `CSC_LINK`; ask Claude to adapt the workflow when you have one.

## Releasing

```
git tag v1.2.0
git push origin v1.2.0
```

The workflow builds `Xurqxys DBD Tool Setup 1.2.0.exe` (installer) and `Xurqxys DBD Tool 1.2.0.exe` (portable)
and attaches both to a new GitHub Release.
