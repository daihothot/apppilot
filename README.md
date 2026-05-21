# AppPilot

AppPilot is a local helper for agent-driven Unity iOS real-device workflows.

Current scope:

- Set up local iOS tools and AppPilot agent assets.
- Export a Unity project to an iOS Xcode project.
- Build the Xcode project into an app.
- Install, launch, stop, tap, and swipe on a real iOS device.
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

Actions use WDA, defaulting to `http://localhost:8100`:

```bash
~/.apppilot/apppilot-mcp-call execute --platform ios --domain action --action tap --device <UDID> --x 100 --y 200
~/.apppilot/apppilot-mcp-call execute --platform ios --domain action --action swipe --device <UDID> --from-x 100 --from-y 500 --to-x 100 --to-y 100
```

## Logs

Prefer matched logs over full logs:

```bash
~/.apppilot/apppilot-mcp-call logs-dump --platform ios --device <UDID> --offset 0 --match '[Ads]'
```

Full log pull is available when needed:

```bash
~/.apppilot/apppilot-mcp-call logs-dump --platform ios --device <UDID> --offset 0
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
- `~/.apppilot/artifact/logs/ios/gurusdk/`

## Notes

- Current target is iOS real device only.
- `pymobiledevice3` is installed in `~/.apppilot/.tools/python/venv`.
- Tap/swipe require WDA.
- Avoid frequent `task-status` polling and avoid full logs unless necessary.
