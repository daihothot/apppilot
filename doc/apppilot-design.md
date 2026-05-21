# AppPilot Current Design

This document describes the current implemented AppPilot scope only.

## Runtime Root

AppPilot writes runtime output under `~/.apppilot`:

```text
~/.apppilot/
  apppilot-mcp
  apppilot-mcp-call
  tools/AppPilotUnityBuild.cs
  log/
  artifact/
  .tools/python/venv/
```

Source paths in installed Codex config/plugin files are generated at setup time for the current user.

## Public Entrypoints

Main setup command:

```bash
dist/apppilot tools setup --agent
```

Agent-facing helper:

```bash
~/.apppilot/apppilot-mcp-call <command>
```

Direct MCP tools may exist when Codex injects them, but `apppilot-mcp-call` is the stable fallback.

## Implemented Tool Groups

MCP tool names:

- `unity_build`
- `xcode_build`
- `task_status`
- `execute`
- `log_clear`
- `logs_dump`
- `read_app_log_artifact`
- `tools_setup`

## Unity iOS Build

Unity export command:

```bash
~/.apppilot/apppilot-mcp-call unity-build --project-path <UNITY_DIR> --platform ios --no-refresh
```

Current behavior:

- Default configuration is debug.
- `--release` switches to release.
- `--refresh` deletes the existing Xcode export and replaces it.
- `--no-refresh` keeps the existing Xcode export and passes Unity `BuildOptions.AcceptExternalModificationsToPlayer` for append mode.
- Normal agent builds should prefer `--no-refresh`.

Unity injects `AppPilotUnityBuild.cs` into `Assets/Editor/AppPilot/` for the build, then removes it afterwards.

Build metadata is stored at:

```text
~/.apppilot/artifact/unity/ios/unity-build.json
```

The exported Xcode project is stored at:

```text
~/.apppilot/artifact/unity/ios/xcode/
```

## Xcode Build

```bash
~/.apppilot/apppilot-mcp-call xcode-build --platform ios --project-path <XCODE_DIR>
```

The Xcode builder reads Unity build metadata and writes the built app path back to `unity-build.json`.

## iOS Device Execution

List devices:

```bash
~/.apppilot/apppilot-mcp-call execute --platform ios --domain app --action devices
```

Install and launch:

```bash
~/.apppilot/apppilot-mcp-call execute --platform ios --domain app --action run --device <UDID>
```

Launch environment variables are passed to pymobiledevice3:

```bash
~/.apppilot/apppilot-mcp-call execute \
  --platform ios \
  --domain app \
  --action run \
  --device <UDID> \
  --env DEBUG_MODE=true \
  --env USER_ID=12345
```

Backend launch shape:

```bash
pymobiledevice3 developer dvt launch <bundleId> --env KEY=VALUE
```

Stop app:

```bash
~/.apppilot/apppilot-mcp-call execute --platform ios --domain app --action stop --device <UDID>
```

Tap/swipe use WDA:

```bash
~/.apppilot/apppilot-mcp-call execute --platform ios --domain action --action tap --device <UDID> --x 100 --y 200
~/.apppilot/apppilot-mcp-call execute --platform ios --domain action --action swipe --device <UDID> --from-x 100 --from-y 500 --to-x 100 --to-y 100
```

`APPPILOT_WDA_URL` can override the default WDA URL.

## Logs

AppPilot pulls OfflineLog files from the app container path:

```text
Library/Caches/Logs/gurusdk
```

Prefer matched logs:

```bash
~/.apppilot/apppilot-mcp-call logs-dump --platform ios --device <UDID> --offset 0 --match '[Ads]'
```

Full logs are available when targeted matches are insufficient:

```bash
~/.apppilot/apppilot-mcp-call logs-dump --platform ios --device <UDID> --offset 0
```

Pulled logs are written to:

```text
~/.apppilot/artifact/logs/ios/gurusdk/
```

## Agent Guidelines

- Do not poll `task-status` too frequently.
- Do not read full build or run logs unless necessary.
- Prefer `logs-dump --match ...` for app diagnostics.
- Prefer Unity append mode with `--no-refresh` for normal builds.
- Use `--refresh` only when a clean Xcode export is required.

## Current Limits

- iOS real-device flow only.
- WDA is required for tap and swipe.
- Android is not implemented.
- No report/run-state system.
- No screenshot, OCR, VLM, or UI-tree capture.
