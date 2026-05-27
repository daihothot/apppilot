# AppPilot

AppPilot is a local helper for agent-driven Unity mobile real-device workflows.

Current scope:

- Set up local iOS tools and AppPilot agent assets.
- Export a Unity project to an iOS Xcode project.
- Build the Xcode project into an app.
- Build a Unity Android APK directly.
- Install, launch, stop, tap, and swipe on a real iOS or Android device.
- Pull gurusdk OfflineLog files and matched log snippets.

Runtime files are written under `~/.apppilot`.

## Setup

```bash
bun run build:agent
dist/apppilot tools setup --agent
```

This installs:

- `~/.apppilot/apppilot-mcp`
- `~/.apppilot/apppilot-mcp-call`
- `~/.apppilot/tools/AppPilotUnityBuild.cs`
- the AppPilot Codex skill/plugin files

## Agent Entry

Use the fallback helper when direct AppPilot tools are not available:

```bash
~/.apppilot/apppilot-mcp-call list
~/.apppilot/apppilot-mcp-call task-status
```

Generic tool call:

```bash
~/.apppilot/apppilot-mcp-call call execute '{"platform":"ios","domain":"app","action":"devices"}'
```

## Build

Unity iOS export, default debug:

```bash
~/.apppilot/apppilot-mcp-call unity-build \
  --project-path <UNITY_DIR> \
  --platform ios \
  --no-refresh
```

Use `--release` for release. Prefer `--no-refresh` append mode for normal builds. Use `--refresh` only when a clean Xcode export is needed.

Build Xcode:

```bash
~/.apppilot/apppilot-mcp-call xcode-build --platform ios --project-path <XCODE_DIR>
```

Unity Android APK build:

```bash
~/.apppilot/apppilot-mcp-call unity-build \
  --project-path <UNITY_DIR> \
  --platform android \
  --refresh
```

Poll long tasks with low frequency:

```bash
~/.apppilot/apppilot-mcp-call task-status
```

## Device

```bash
~/.apppilot/apppilot-mcp-call execute --platform ios --domain app --action devices
~/.apppilot/apppilot-mcp-call execute --platform ios --domain app --action run --device <UDID>
~/.apppilot/apppilot-mcp-call execute --platform ios --domain app --action stop --device <UDID>
```

Android device flow:

```bash
~/.apppilot/apppilot-mcp-call execute --platform android --domain app --action devices
~/.apppilot/apppilot-mcp-call execute --platform android --domain app --action run --device <SERIAL>
~/.apppilot/apppilot-mcp-call execute --platform android --domain app --action stop --device <SERIAL>
```

Android intent launch options map to `adb shell am start`:

```bash
~/.apppilot/apppilot-mcp-call execute \
  --platform android \
  --domain app \
  --action run \
  --device <SERIAL> \
  --component com.example.app/.MainActivity \
  --es username john_doe \
  --ez remember true
```

Launch environment variables:

```bash
~/.apppilot/apppilot-mcp-call execute \
  --platform ios \
  --domain app \
  --action run \
  --device <UDID> \
  --env DEBUG_MODE=true \
  --env USER_ID=12345
```

iOS actions use WDA, defaulting to `http://localhost:8100`; Android actions use adb:

```bash
~/.apppilot/apppilot-mcp-call execute --platform ios --domain action --action tap --device <UDID> --x 100 --y 200
~/.apppilot/apppilot-mcp-call execute --platform ios --domain action --action swipe --device <UDID> --from-x 100 --from-y 500 --to-x 100 --to-y 100
~/.apppilot/apppilot-mcp-call execute --platform android --domain action --action tap --device <SERIAL> --x 100 --y 200
~/.apppilot/apppilot-mcp-call execute --platform android --domain action --action swipe --device <SERIAL> --from-x 100 --from-y 500 --to-x 100 --to-y 100
```

## Logs

Prefer matched logs over full logs:

```bash
~/.apppilot/apppilot-mcp-call logs-dump --platform ios --device <UDID> --offset 0 --match '[Ads]'
~/.apppilot/apppilot-mcp-call logs-dump --platform android --device <SERIAL> --offset 0 --match '[Ads]'
```

Full log pull is available when needed:

```bash
~/.apppilot/apppilot-mcp-call logs-dump --platform ios --device <UDID> --offset 0
~/.apppilot/apppilot-mcp-call logs-dump --platform android --device <SERIAL> --offset 0
```

Clear local AppPilot logs and artifacts:

```bash
~/.apppilot/apppilot-mcp-call log-clear --scope all
```

## Artifacts

- `~/.apppilot/log/status.json`
- `~/.apppilot/log/*.log`
- `~/.apppilot/artifact/unity/ios/unity-build.json`
- `~/.apppilot/artifact/unity/ios/xcode/`
- `~/.apppilot/artifact/unity/android/unity-build.json`
- `~/.apppilot/artifact/unity/android/app.apk`
- `~/.apppilot/artifact/logs/ios/gurusdk/`
- `~/.apppilot/artifact/logs/android/logcat/`

## Notes

- Android logs are captured from `adb logcat -d` and saved under `artifact/logs/android/logcat/`.
- `pymobiledevice3` is installed in `~/.apppilot/.tools/python/venv`.
- iOS tap/swipe require WDA. Android tap/swipe use adb.
- Avoid frequent `task-status` polling and avoid full logs unless necessary.
