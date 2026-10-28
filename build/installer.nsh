; Custom steps for the Windows installer/uninstaller (electron-builder includes this file automatically).

; electron-builder stores a copy of the installer here for its own auto-updater. This app updates itself
; differently (see updater.js), so the ~70 MB copy is useless clutter in %LOCALAPPDATA%.
!macro removeInstallerCache
  RMDir /r "$LOCALAPPDATA\xurqxys-dbd-tool-updater"
  RMDir /r "$LOCALAPPDATA\${APP_FILENAME}-updater"
!macroend

!macro customInstall
  ; electron uses per-user folders even for an "all users" install
  ${if} $installMode == "all"
    SetShellVarContext current
  ${endif}
  !insertmacro removeInstallerCache
  ${if} $installMode == "all"
    SetShellVarContext all
  ${endif}
!macroend

; A real uninstall removes everything the app ever wrote. An update also runs the old uninstaller (with --updated):
; then nothing but the program files is touched, so matches, builds and settings survive updates.
!macro customUnInstall
  ${ifNot} ${isUpdated}
    ${if} $installMode == "all"
      SetShellVarContext current
    ${endif}

    !insertmacro removeInstallerCache
    ; Leftover helper scripts from the in-app updater.
    Delete "$TEMP\xurqxys-update-*.cmd"

    MessageBox MB_YESNO|MB_ICONQUESTION "Also delete your saved matches, builds, settings and downloaded icons?$\r$\n$\r$\nChoose No to keep them for a later reinstall." /SD IDYES IDNO keepData
      RMDir /r "$APPDATA\Xurqxys DBD Tool"
      RMDir /r "$APPDATA\${APP_FILENAME}"
      !ifdef APP_PRODUCT_FILENAME
        RMDir /r "$APPDATA\${APP_PRODUCT_FILENAME}"
      !endif
      RMDir /r "$LOCALAPPDATA\Xurqxys DBD Tool"
      RMDir /r "$LOCALAPPDATA\${APP_FILENAME}"
    keepData:

    ; The (now empty) install folder is still the uninstaller's working folder, so Windows won't delete it yet.
    ; Step out of it and try; if it's still there, a hidden command removes it a moment after the uninstaller
    ; has closed. rmdir without /s only ever removes an empty folder.
    SetOutPath "$TEMP"
    RMDir "$INSTDIR"
    ${if} ${FileExists} "$INSTDIR\*.*"
      ExecShell "" "$SYSDIR\cmd.exe" '/c ping -n 3 127.0.0.1 >nul & rmdir "$INSTDIR"' SW_HIDE
    ${endif}

    ${if} $installMode == "all"
      SetShellVarContext all
    ${endif}
  ${endIf}
!macroend
