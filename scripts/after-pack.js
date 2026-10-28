'use strict';
// electron-builder afterPack hook: flips Electron's security fuses in the packaged executable.
// They switch off the ways people usually get into an Electron app's code or run their own code through it:
// running the exe as plain Node, --inspect debugging, NODE_OPTIONS, and loading a modified app instead of app.asar.
// Together with asar integrity (the exe refuses an app.asar that was edited) this blocks easy tampering.
const path = require('path');
const fs = require('fs');
const { flipFuses, FuseVersion, FuseV1Options } = require('@electron/fuses');
const ResEdit = require('resedit');

// electron-builder stores the asar path with the separator of the machine that builds it. Built on Linux or macOS
// that's "resources/app.asar", but Windows Electron looks up "resources\\app.asar" and refuses to start without it.
function fixWinIntegrityPath(exe) {
  const executable = ResEdit.NtExecutable.from(fs.readFileSync(exe));
  const resource = ResEdit.NtExecutableResource.from(executable);
  const entry = resource.entries.find((e) => e.type === 'INTEGRITY' && e.id === 'ELECTRONASAR');
  if (!entry) throw new Error('asar integrity resource missing from the exe');
  const list = JSON.parse(Buffer.from(entry.bin).toString('utf8'));
  if (!list.some((x) => x.file.includes('/'))) return;
  entry.bin = Buffer.from(JSON.stringify(list.map((x) => ({ ...x, file: x.file.replace(/\//g, '\\') }))));
  resource.outputResource(executable);
  fs.writeFileSync(exe, Buffer.from(executable.generate()));
}

exports.default = async function afterPack(context) {
  const { electronPlatformName, appOutDir, packager } = context;
  const name = packager.appInfo.productFilename;
  const exe = electronPlatformName === 'win32' ? path.join(appOutDir, `${name}.exe`)
    : electronPlatformName === 'darwin' ? path.join(appOutDir, `${name}.app`)
      : path.join(appOutDir, packager.executableName);
  if (electronPlatformName === 'win32') fixWinIntegrityPath(exe);
  await flipFuses(exe, {
    version: FuseVersion.V1,
    resetAdHocDarwinSignature: electronPlatformName === 'darwin',
    [FuseV1Options.RunAsNode]: false,
    [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
    [FuseV1Options.EnableNodeCliInspectArguments]: false,
    [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
    [FuseV1Options.OnlyLoadAppFromAsar]: true,
    [FuseV1Options.EnableCookieEncryption]: true,
  });
};
