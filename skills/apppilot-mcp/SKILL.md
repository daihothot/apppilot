---
name: apppilot-mcp
description: Use when working with AppPilot to build Unity iOS apps, run them on a real iOS device, control the app, pull OfflineLog gurusdk logs, or diagnose AppPilot permission/build/device failures. Trigger for requests involving AppPilot tools, Unity iOS build, iOS real-device run, WDA tap/swipe, pymobiledevice3, or pulling [Ads] logs.
---

# AppPilot

Use AppPilot through direct tools when they are injected in the current Codex session. If direct tools such as `mcp__apppilot_mcp__logs_dump` are not available, use the installed fallback command:

`~/.apppilot/apppilot-mcp-call`

Do not create temporary JSON-RPC scripts. `apppilot-mcp-call` is the supported wrapper around the same AppPilot tool server.

## Fallback Command

List available tools:

`~/.apppilot/apppilot-mcp-call list`

Call any tool directly:

`~/.apppilot/apppilot-mcp-call call <tool> '<json>'`

Examples:

`~/.apppilot/apppilot-mcp-call call execute '{"platform":"ios","domain":"app","action":"devices"}'`

`~/.apppilot/apppilot-mcp-call call logs_dump '{"platform":"ios","device":"<UDID>","offset":0,"match":"[Ads]"}'`

## Wrapped Commands

Unity export defaults to debug. Pass `--release` only when a release export is required. Prefer `--no-refresh` append mode for normal builds; use `--refresh` replace mode only when the Xcode export is stale or corrupted:

`~/.apppilot/apppilot-mcp-call unity-build --project-path <UNITY_DIR> --platform ios --no-refresh`

Xcode build:

`~/.apppilot/apppilot-mcp-call xcode-build --platform ios --project-path <XCODE_DIR>`

If `projectPath` is available from `task-status`, pass it explicitly. If omitted, AppPilot uses the latest Unity artifact when available.

Task status:

`~/.apppilot/apppilot-mcp-call task-status`

Tools setup:

`~/.apppilot/apppilot-mcp-call tools-setup --platform ios`

List devices:

`~/.apppilot/apppilot-mcp-call execute --platform ios --domain app --action devices`

Install and launch app. Pass repeated `--env KEY=VALUE` values when the app needs launch environment variables:

`~/.apppilot/apppilot-mcp-call execute --platform ios --domain app --action run --device <UDID> [--env DEBUG_MODE=true] [--env USER_ID=12345]`

Stop app:

`~/.apppilot/apppilot-mcp-call execute --platform ios --domain app --action stop --device <UDID>`

Tap:

`~/.apppilot/apppilot-mcp-call execute --platform ios --domain action --action tap --device <UDID> --x 100 --y 200`

Swipe:

`~/.apppilot/apppilot-mcp-call execute --platform ios --domain action --action swipe --device <UDID> --from-x 100 --from-y 500 --to-x 100 --to-y 100`

Clear local AppPilot logs and artifacts:

`~/.apppilot/apppilot-mcp-call log-clear --scope all`

Scopes: `all`, `unity`, `xcode`, `ios`.

Pull latest full gurusdk log only when targeted matches are insufficient:

`~/.apppilot/apppilot-mcp-call logs-dump --platform ios --device <UDID> --offset 0`

Pull latest Ads entries with stack traces:

`~/.apppilot/apppilot-mcp-call logs-dump --platform ios --device <UDID> --offset 0 --match '[Ads]'`

Read a small pulled artifact:

`~/.apppilot/apppilot-mcp-call read-app-log-artifact --path artifact/logs/ios/gurusdk/<FILE>`

## Agent Discipline

- Do not poll `task-status` too frequently. For Unity, Xcode, and tools setup tasks, wait a reasonable interval before checking again; frequent polling burns tokens without improving the result.
- Do not read full build logs or full run logs unless there is no practical alternative. Use `task-status` first, then inspect only the `log` path on failure. For app logs, prefer `logs-dump --match ...` such as `--match '[Ads]'`.
- Use append mode for normal Unity iOS exports: pass `--no-refresh`. Use replace mode with `--refresh` only when append has failed, the Xcode project is stale, or a clean export is explicitly required.

## Standard Flow

1. Clear local AppPilot logs:

`~/.apppilot/apppilot-mcp-call log-clear --scope all`

2. Export the Unity project without blocking. Prefer append mode with `--no-refresh`; use `--refresh` only when a clean Xcode export is necessary:

`~/.apppilot/apppilot-mcp-call unity-build --project-path <UNITY_DIR> --platform ios --no-refresh`

3. Poll status. Do not tail Unity logs while running:

`~/.apppilot/apppilot-mcp-call task-status`

Use only `state`, `phase`, `elapsed`, and `log` while waiting. Continue if `state` is `running`; proceed if `success`; read the returned `log` only if `failed`. On success, keep `projectPath` for the Xcode step.

4. Build the exported Xcode project:

`~/.apppilot/apppilot-mcp-call xcode-build --platform ios --project-path <XCODE_DIR>`

5. Poll Xcode status the same way:

`~/.apppilot/apppilot-mcp-call task-status`

6. List devices and choose the target UDID:

`~/.apppilot/apppilot-mcp-call execute --platform ios --domain app --action devices`

7. Install and launch on the iOS device:

`~/.apppilot/apppilot-mcp-call execute --platform ios --domain app --action run --device <UDID> [--env DEBUG_MODE=true] [--env USER_ID=12345]`

8. Pull targeted app logs with `--match`. For Ads diagnostics:

`~/.apppilot/apppilot-mcp-call logs-dump --platform ios --device <UDID> --offset 0 --match '[Ads]'`

Use `offset: 1` for the previous app log. Negative offsets are not needed in prompts. Pull the full gurusdk log only when targeted matches are insufficient.

## Direct Tool Names

When direct AppPilot tools are injected, use these equivalent tool names instead of the fallback command:

- `unity_build`
- `xcode_build`
- `task_status`
- `execute`
- `log_clear`
- `logs_dump`
- `read_app_log_artifact`
- `tools_setup`

## Permissions And Host Access

Real iOS device work often needs host privileges outside the Codex sandbox.

- If a command fails with `PermissionError: [Errno 1] Operation not permitted`, socket access to `usbmuxd` is probably blocked. Retry through the approved escalation path instead of changing code.
- If a task needs Unity, Xcode, `pymobiledevice3`, WDA, device install, device launch, app container pull, or files outside the workspace, request escalation with a short justification.
- Do not run `sudo` yourself. If a root command is needed, show the exact command and wait for the user to run it.
- If WDA action calls fail, check that WebDriverAgent is running and reachable at `APPPILOT_WDA_URL` or `http://localhost:8100`.
- Use `execute --domain app --action devices` to get a UDID before run/action/log commands.
- Run/action/log commands require `--device` explicitly. App run supports repeated `--env KEY=VALUE` launch environment variables.

## Failure Handling

Build failure:

1. Call `task-status`.
2. Read only the file named by `log`.
3. Find the first real error. Avoid dumping entire build logs unless needed.
4. Common AppPilot-side fix: stale DerivedData can retain old absolute paths after project moves or renames. Xcode builder should clear full `artifact/unity/ios/build/DerivedData` before rebuild.

Run/action/log failure:

1. Confirm `artifact/unity/ios/unity-build.json` exists under `~/.apppilot`.
2. Confirm the `device` UDID appears in `execute --domain app --action devices`.
3. Confirm `tools-setup --platform ios` has been run.
4. For taps/swipes, confirm WDA is available.
5. For log pulls, remember the app log path is fixed to `Library/Caches/Logs/gurusdk` inside the app container.

## Artifacts

All AppPilot runtime output is under `~/.apppilot`:

- Build metadata: `~/.apppilot/artifact/unity/ios/unity-build.json`
- Xcode project: `~/.apppilot/artifact/unity/ios/xcode/`
- Built app: read `appPath` from `~/.apppilot/artifact/unity/ios/unity-build.json`
- Pulled app logs: `~/.apppilot/artifact/logs/ios/gurusdk/`
- CLI/build logs: `~/.apppilot/log/`
- Current long task status: `~/.apppilot/log/status.json`

## Rules

- Prefer direct AppPilot tools only when they are actually injected.
- Otherwise use `~/.apppilot/apppilot-mcp-call`; do not write temporary JSON-RPC scripts.
- Keep build loops token-light: poll `task-status` at low frequency, do not tail logs.
- Do not clear device logs; `log-clear` clears local AppPilot logs/artifacts only.
- Pass `--device` explicitly for run/action/log commands.
- Prefer `logs-dump --match ...` over full app logs; use `--match '[Ads]'` for Ads logs.
- Matched logs include multi-line entries such as stack traces.
