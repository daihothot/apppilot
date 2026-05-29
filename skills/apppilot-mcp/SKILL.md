---
name: apppilot-mcp
description: Use when working with AppPilot to build Unity iOS or Android apps, run them on a real device, control the app, pull OfflineLog gurusdk logs, or diagnose AppPilot permission/build/device failures. Trigger for requests involving AppPilot tools, Unity mobile builds, iOS real-device run, Android adb run, WDA/adb tap/swipe, pymobiledevice3, or pulling [Ads] logs.
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

Android builds produce an APK directly:

`~/.apppilot/apppilot-mcp-call unity-build --project-path <UNITY_DIR> --platform android --refresh`

Xcode build:

`~/.apppilot/apppilot-mcp-call xcode-build --platform ios --project-path <XCODE_DIR>`

If `projectPath` is available from `task-status`, pass it explicitly. If omitted, AppPilot uses the latest Unity artifact when available.

Task status:

`~/.apppilot/apppilot-mcp-call task-status`

Tools setup:

`~/.apppilot/apppilot-mcp-call tools-setup --platform ios`

List devices:

`~/.apppilot/apppilot-mcp-call execute --platform ios --domain app --action devices`

`~/.apppilot/apppilot-mcp-call execute --platform android --domain app --action devices`

Install and launch app. Pass repeated `--env KEY=VALUE` values when the app needs launch environment variables:

`~/.apppilot/apppilot-mcp-call execute --platform ios --domain app --action run --device <UDID> [--env DEBUG_MODE=true] [--env USER_ID=12345]`

To launch Unity with AppPilot runtime websocket enabled, pass `--apppilot-root <ROOT_NAME>` when a root is known. AppPilot will inject `guru_ws_client_ip_port`, `guru_apppilot=true`, and `guru_apppilot_root_name` into launch parameters, wait for the Unity app to connect back, then reverse-connect to the app-side websocket server:

`~/.apppilot/apppilot-mcp-call execute --platform ios --domain app --action run --device <UDID> --apppilot-root <ROOT_NAME>`

After launch, query the Unity runtime through the AppPilot websocket domain:

`~/.apppilot/apppilot-mcp-call execute --domain apppilot --action queryNodes --params '{"rootPath":"","depth":1,"select":["children"]}'`

Before any iOS app run, verify that `pymobiledevice3 remote tunneld` is already running in the background:

`ps -axo pid,ppid,command | rg "pymobiledevice3 remote tunneld"`

If it is not running, stop immediately and ask the user to run this command in a separate terminal, then retry only after they confirm it is running:

`~/.apppilot/.tools/python/venv/bin/pymobiledevice3 remote tunneld`

This is required because iOS launch uses `pymobiledevice3 developer dvt launch`; on modern iOS devices DVT launch and launch environment delivery need the RemoteXPC tunnel. Without tunneld, install may succeed while launch fails with errors such as `InvalidServiceError` or env values never reach the app process.

Stop app:

`~/.apppilot/apppilot-mcp-call execute --platform ios --domain app --action stop --device <UDID>`

Install and launch Android. Without intent options, AppPilot uses `adb shell monkey -p <bundleId> 1`; with intent options, it uses `adb shell am start`:

`~/.apppilot/apppilot-mcp-call execute --platform android --domain app --action run --device <SERIAL> --component com.example.app/.MainActivity --es username john_doe --ez remember true`

`~/.apppilot/apppilot-mcp-call execute --platform android --domain app --action run --device <SERIAL> --intent-action android.intent.action.VIEW --data https://www.google.com`

Stop Android app:

`~/.apppilot/apppilot-mcp-call execute --platform android --domain app --action stop --device <SERIAL>`

Tap:

`~/.apppilot/apppilot-mcp-call execute --platform ios --domain action --action tap --device <UDID> --x 100 --y 200`

`~/.apppilot/apppilot-mcp-call execute --platform android --domain action --action tap --device <SERIAL> --x 100 --y 200`

Swipe:

`~/.apppilot/apppilot-mcp-call execute --platform ios --domain action --action swipe --device <UDID> --from-x 100 --from-y 500 --to-x 100 --to-y 100`

`~/.apppilot/apppilot-mcp-call execute --platform android --domain action --action swipe --device <SERIAL> --from-x 100 --from-y 500 --to-x 100 --to-y 100`

Clear local AppPilot logs and artifacts:

`~/.apppilot/apppilot-mcp-call log-clear --scope all`

Scopes: `all`, `unity`, `xcode`, `ios`.

Pull latest full gurusdk log only when targeted matches are insufficient:

`~/.apppilot/apppilot-mcp-call logs-dump --platform ios --device <UDID> --offset 0`

Android dumps device logcat and supports match filtering:

`~/.apppilot/apppilot-mcp-call logs-dump --platform android --device <SERIAL> --offset 0`

Pull latest Ads entries with stack traces:

`~/.apppilot/apppilot-mcp-call logs-dump --platform ios --device <UDID> --offset 0 --match '[Ads]'`

`~/.apppilot/apppilot-mcp-call logs-dump --platform android --device <SERIAL> --offset 0 --match '[Ads]'`

Read a small pulled artifact:

`~/.apppilot/apppilot-mcp-call read-app-log-artifact --path artifact/logs/ios/gurusdk/<FILE>`

## Agent Discipline

- Do not poll `task-status` too frequently. For Unity, Xcode, and tools setup tasks, wait a reasonable interval before checking again; frequent polling burns tokens without improving the result.
- Do not inspect raw long-task logs while the task is still running. During a long task, use `task-status` only; read the raw log only after the task reaches `failed`.
- Long tasks such as Unity builds, Xcode builds, Android builds, and dependency/tool setup can legitimately take 30 to 60+ minutes. A phase staying unchanged for a long time is not by itself a failure.
- Always wait for the final task state, either `success` or `failed`. Do not infer failure from elapsed time or an unchanged phase.
- If a long task ends in `failed`, stop and report the failure state, phase, and log path. Do not try to bypass, retry with different flags, clean artifacts, change code, or work around the failure unless the user explicitly asks for that next step.
- Do not read full build logs or full run logs unless there is no practical alternative. Use `task-status` first, then inspect only the `log` path on failure. For app logs, prefer `logs-dump --match ...` such as `--match '[Ads]'`.
- Use append mode for normal Unity iOS exports: pass `--no-refresh`. Use replace mode with `--refresh` only when append has failed, the Xcode project is stale, or a clean export is explicitly required.
- Android Unity builds produce APKs directly; do not run `xcode_build` for Android.
- For both iOS and Android, if the device list contains two or more connected devices, stop and ask the user which exact device ID to use. Remember that selected device for the current task and reuse it for subsequent run/action/log commands unless the user explicitly changes it.
- Before rerunning an app on the same selected device, ensure the previous run is stopped first with `execute --domain app --action stop` for the same platform and device. Do not start a second run on top of a still-running app process.

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

6. List devices and choose the target device:

`~/.apppilot/apppilot-mcp-call execute --platform ios --domain app --action devices`

`~/.apppilot/apppilot-mcp-call execute --platform android --domain app --action devices`

If two or more devices are returned for the target platform, stop and ask the user which exact UDID or serial to use. Remember the selected device for the current task and reuse it unless the user explicitly changes it.

7. Before installing and launching on iOS, confirm `pymobiledevice3 remote tunneld` is running:

`ps -axo pid,ppid,command | rg "pymobiledevice3 remote tunneld"`

If no process is found, stop and tell the user to start tunneld in another terminal:

`~/.apppilot/.tools/python/venv/bin/pymobiledevice3 remote tunneld`

Explain that this is mandatory because AppPilot launches iOS apps through `pymobiledevice3 developer dvt launch`, and DVT launch/env delivery requires the RemoteXPC tunnel on modern iOS. Do not attempt the iOS app run until the user confirms tunneld is running.

8. Install and launch on the iOS device:

`~/.apppilot/apppilot-mcp-call execute --platform ios --domain app --action run --device <UDID> [--env DEBUG_MODE=true] [--env USER_ID=12345]`

Before any rerun on the selected iOS device, stop the previous run first:

`~/.apppilot/apppilot-mcp-call execute --platform ios --domain app --action stop --device <UDID>`

For Android reruns, stop the previous run first:

`~/.apppilot/apppilot-mcp-call execute --platform android --domain app --action stop --device <SERIAL>`

9. Pull targeted app logs with `--match`. For Ads diagnostics:

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
- If two or more iOS or Android devices are connected, stop and ask the user which exact UDID or serial to use. Remember the selected device for the current task unless the user explicitly changes it.
- Run/action/log commands require `--device` explicitly. App run supports repeated `--env KEY=VALUE` launch environment variables.
- Before rerunning an app on the selected device, stop the previous run with `execute --domain app --action stop` for the same platform/device.

## Failure Handling

Build failure:

1. Call `task-status`.
2. If the task is still `running`, wait and poll later. Do not read raw logs.
3. If the task is `failed`, stop and report the failure with the `log` path. Do not bypass or retry without user instruction.
4. Read only the file named by `log` after the user asks for investigation, then find the first real error. Avoid dumping entire build logs unless needed.

Run/action/log failure:

1. Confirm `artifact/unity/ios/unity-build.json` exists under `~/.apppilot`.
2. Confirm the `device` UDID appears in `execute --domain app --action devices`.
3. Confirm `tools-setup --platform ios` has been run.
4. For taps/swipes, confirm WDA is available.
5. For log pulls, remember the app log path is fixed to `Library/Caches/Logs/gurusdk` inside the app container.

## Artifacts

All AppPilot runtime output is under `~/.apppilot`:

- Build metadata: `~/.apppilot/artifact/unity/ios/unity-build.json`
- Android build metadata: `~/.apppilot/artifact/unity/android/unity-build.json`
- Xcode project: `~/.apppilot/artifact/unity/ios/xcode/`
- Built app: read `appPath` from `~/.apppilot/artifact/unity/ios/unity-build.json`
- Android APK: read `appPath` from `~/.apppilot/artifact/unity/android/unity-build.json`
- Pulled app logs: `~/.apppilot/artifact/logs/ios/gurusdk/`
- Pulled Android app logs: `~/.apppilot/artifact/logs/android/logcat/`
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
