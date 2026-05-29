---
name: apppilot-mcp
description: 当需要使用 AppPilot 构建 Unity iOS 或 Android 应用、在真机运行、控制应用、拉取 OfflineLog gurusdk 日志，或诊断 AppPilot 权限、构建、设备问题时使用。适用于 AppPilot 工具、Unity 移动端构建、iOS 真机运行、Android adb 运行、WDA/adb 点击滑动、pymobiledevice3、拉取 [Ads] 日志等请求。
---

# AppPilot

如果当前 Codex 会话已经注入了 AppPilot 直连工具，优先使用直连工具。若没有 `mcp__apppilot_mcp__logs_dump` 这类直连工具，则使用已安装的 fallback 命令：

`~/.apppilot/apppilot-mcp-call`

不要创建临时 JSON-RPC 脚本。`apppilot-mcp-call` 是对同一个 AppPilot tool server 的标准封装。

## Fallback Command

列出可用工具：

`~/.apppilot/apppilot-mcp-call list`

直接调用任意工具：

`~/.apppilot/apppilot-mcp-call call <tool> '<json>'`

示例：

`~/.apppilot/apppilot-mcp-call call execute '{"platform":"ios","domain":"app","action":"devices"}'`

`~/.apppilot/apppilot-mcp-call call logs_dump '{"platform":"ios","device":"<UDID>","offset":0,"match":"[Ads]"}'`

## Wrapped Commands

Unity 导出默认使用 debug。只有需要 release 导出时才传 `--release`。常规构建优先使用 `--no-refresh` 追加模式；只有 Xcode 导出已经过期或损坏时才使用 `--refresh` 替换模式：

`~/.apppilot/apppilot-mcp-call unity-build --project-path <UNITY_DIR> --platform ios --no-refresh`

Android 构建会直接生成 APK：

`~/.apppilot/apppilot-mcp-call unity-build --project-path <UNITY_DIR> --platform android --refresh`

Xcode 构建：

`~/.apppilot/apppilot-mcp-call xcode-build --platform ios --project-path <XCODE_DIR>`

如果可以从 `task-status` 获取 `projectPath`，就显式传入。若省略，AppPilot 会在可用时使用最新 Unity artifact。

任务状态：

`~/.apppilot/apppilot-mcp-call task-status`

工具安装：

`~/.apppilot/apppilot-mcp-call tools-setup --platform ios`

列出设备：

`~/.apppilot/apppilot-mcp-call execute --platform ios --domain app --action devices`

`~/.apppilot/apppilot-mcp-call execute --platform android --domain app --action devices`

安装并启动应用。应用需要启动环境变量时，可以重复传入 `--env KEY=VALUE`：

`~/.apppilot/apppilot-mcp-call execute --platform ios --domain app --action run --device <UDID> [--env DEBUG_MODE=true] [--env USER_ID=12345]`

任何 iOS app run 之前，必须确认后台已经运行 `pymobiledevice3 remote tunneld`：

`ps -axo pid,ppid,command | rg "pymobiledevice3 remote tunneld"`

如果没有运行，立即停止，并要求用户在单独终端执行下面的命令；只有用户确认它已经运行后，才可以重试：

`~/.apppilot/.tools/python/venv/bin/pymobiledevice3 remote tunneld`

这是必需的，因为 iOS 启动使用 `pymobiledevice3 developer dvt launch`；现代 iOS 设备的 DVT launch 和启动环境变量传递依赖 RemoteXPC tunnel。没有 tunneld 时，install 可能成功，但 launch 会失败，例如 `InvalidServiceError`，或者 env 值无法进入 app 进程。

停止应用：

`~/.apppilot/apppilot-mcp-call execute --platform ios --domain app --action stop --device <UDID>`

安装并启动 Android。没有 intent 参数时，AppPilot 使用 `adb shell monkey -p <bundleId> 1`；传入 intent 参数时，使用 `adb shell am start`：

`~/.apppilot/apppilot-mcp-call execute --platform android --domain app --action run --device <SERIAL> --component com.example.app/.MainActivity --es username john_doe --ez remember true`

`~/.apppilot/apppilot-mcp-call execute --platform android --domain app --action run --device <SERIAL> --intent-action android.intent.action.VIEW --data https://www.google.com`

停止 Android 应用：

`~/.apppilot/apppilot-mcp-call execute --platform android --domain app --action stop --device <SERIAL>`

点击：

`~/.apppilot/apppilot-mcp-call execute --platform ios --domain action --action tap --device <UDID> --x 100 --y 200`

`~/.apppilot/apppilot-mcp-call execute --platform android --domain action --action tap --device <SERIAL> --x 100 --y 200`

滑动：

`~/.apppilot/apppilot-mcp-call execute --platform ios --domain action --action swipe --device <UDID> --from-x 100 --from-y 500 --to-x 100 --to-y 100`

`~/.apppilot/apppilot-mcp-call execute --platform android --domain action --action swipe --device <SERIAL> --from-x 100 --from-y 500 --to-x 100 --to-y 100`

清理本地 AppPilot 日志和 artifact：

`~/.apppilot/apppilot-mcp-call log-clear --scope all`

可用 scope：`all`、`unity`、`xcode`、`ios`。

只有定向匹配不足时，才拉取最新完整 gurusdk 日志：

`~/.apppilot/apppilot-mcp-call logs-dump --platform ios --device <UDID> --offset 0`

Android 会 dump 设备 logcat，并支持 match 过滤：

`~/.apppilot/apppilot-mcp-call logs-dump --platform android --device <SERIAL> --offset 0`

拉取最新 Ads 相关日志，包含堆栈：

`~/.apppilot/apppilot-mcp-call logs-dump --platform ios --device <UDID> --offset 0 --match '[Ads]'`

`~/.apppilot/apppilot-mcp-call logs-dump --platform android --device <SERIAL> --offset 0 --match '[Ads]'`

读取一个较小的已拉取 artifact 文本文件：

`~/.apppilot/apppilot-mcp-call read-app-log-artifact --path artifact/logs/ios/gurusdk/<FILE>`

## Agent 纪律

- 不要过于频繁地轮询 `task-status`。Unity、Xcode 和工具安装任务应等待合理间隔后再查；频繁轮询不会改善结果，只会消耗 token。
- 长任务运行期间不要查看原始日志。长任务进行中只能使用 `task-status`；只有任务进入 `failed` 后才读取原始日志。
- Unity 构建、Xcode 构建、Android 构建、依赖和工具安装等长任务可能合法持续 30 到 60 分钟以上。某个 phase 长时间不变，本身不是失败。
- 必须等待最终任务状态，即 `success` 或 `failed`。不要根据耗时或 phase 不变推断失败。
- 长任务以 `failed` 结束时，停止并报告失败状态、phase 和日志路径。除非用户明确要求下一步，否则不要绕过、换参数重试、清 artifact、改代码或做 workaround。
- 除非没有实际替代方案，不要读取完整构建日志或完整 run 日志。先用 `task-status`；失败后只查看返回的 `log` 路径。app 日志优先使用 `logs-dump --match ...`，例如 `--match '[Ads]'`。
- 常规 Unity iOS 导出使用 append 模式：传 `--no-refresh`。只有 append 失败、Xcode 工程过期或明确需要 clean export 时，才使用 `--refresh` 替换模式。
- Android Unity 构建直接产出 APK；不要为 Android 执行 `xcode_build`。
- iOS 和 Android 都一样：如果设备列表包含两台或以上已连接设备，必须停止并询问用户使用哪个精确设备 ID。记住当前任务选择的设备，并用于后续 run/action/log 命令，除非用户明确变更。
- 在同一已选设备上重新 run app 前，必须先对相同 platform 和 device 执行 `execute --domain app --action stop`，确保上一次 run 已停止。不要在仍运行的 app 进程上叠加第二次 run。

## 标准流程

1. 清理本地 AppPilot 日志：

`~/.apppilot/apppilot-mcp-call log-clear --scope all`

2. 非阻塞导出 Unity 项目。优先使用 append 模式 `--no-refresh`；只有确实需要 clean Xcode export 时才使用 `--refresh`：

`~/.apppilot/apppilot-mcp-call unity-build --project-path <UNITY_DIR> --platform ios --no-refresh`

3. 轮询状态。运行期间不要 tail Unity 日志：

`~/.apppilot/apppilot-mcp-call task-status`

等待时只使用 `state`、`phase`、`elapsed` 和 `log`。如果 `state` 是 `running`，继续等待；如果是 `success`，继续下一步；如果是 `failed`，只读取返回的 `log`。成功后保留 `projectPath` 给 Xcode 步骤使用。

4. 构建导出的 Xcode 工程：

`~/.apppilot/apppilot-mcp-call xcode-build --platform ios --project-path <XCODE_DIR>`

5. 同样轮询 Xcode 状态：

`~/.apppilot/apppilot-mcp-call task-status`

6. 列出设备并选择目标设备：

`~/.apppilot/apppilot-mcp-call execute --platform ios --domain app --action devices`

`~/.apppilot/apppilot-mcp-call execute --platform android --domain app --action devices`

如果目标平台返回两台或以上设备，必须停止并询问用户使用哪个精确 UDID 或 serial。记住当前任务选择的设备，并复用它，除非用户明确变更。

7. iOS 安装和启动前，确认 `pymobiledevice3 remote tunneld` 正在运行：

`ps -axo pid,ppid,command | rg "pymobiledevice3 remote tunneld"`

如果没有找到进程，停止并告诉用户在另一个终端启动 tunneld：

`~/.apppilot/.tools/python/venv/bin/pymobiledevice3 remote tunneld`

说明这是强制要求：AppPilot 通过 `pymobiledevice3 developer dvt launch` 启动 iOS app，现代 iOS 上 DVT launch 和 env 传递需要 RemoteXPC tunnel。用户确认 tunneld 正在运行之前，不要尝试 iOS app run。

8. 在 iOS 设备上安装并启动：

`~/.apppilot/apppilot-mcp-call execute --platform ios --domain app --action run --device <UDID> [--env DEBUG_MODE=true] [--env USER_ID=12345]`

同一已选 iOS 设备上任何 rerun 之前，先停止上一次 run：

`~/.apppilot/apppilot-mcp-call execute --platform ios --domain app --action stop --device <UDID>`

Android rerun 之前，也先停止上一次 run：

`~/.apppilot/apppilot-mcp-call execute --platform android --domain app --action stop --device <SERIAL>`

9. 使用 `--match` 拉取定向 app 日志。Ads 诊断：

`~/.apppilot/apppilot-mcp-call logs-dump --platform ios --device <UDID> --offset 0 --match '[Ads]'`

上一份 app 日志使用 `offset: 1`。prompt 中不需要负 offset。只有定向匹配不足时，才拉取完整 gurusdk 日志。

## Direct Tool Names

当 AppPilot 直连工具已注入时，使用下面等价工具名，而不是 fallback 命令：

- `unity_build`
- `xcode_build`
- `task_status`
- `execute`
- `log_clear`
- `logs_dump`
- `read_app_log_artifact`
- `tools_setup`

## 权限和宿主机访问

真实 iOS 设备操作经常需要 Codex sandbox 之外的宿主机权限。

- 如果命令失败并出现 `PermissionError: [Errno 1] Operation not permitted`，通常是 `usbmuxd` socket 访问被阻止。应通过批准的提权路径重试，而不是改代码。
- 如果任务需要 Unity、Xcode、`pymobiledevice3`、WDA、设备安装、设备启动、拉取 app container，或访问 workspace 外文件，使用简短说明请求提权。
- 不要自己运行 `sudo`。如果确实需要 root 命令，展示精确命令并等待用户执行。
- 如果 WDA action 调用失败，检查 WebDriverAgent 是否运行并可通过 `APPPILOT_WDA_URL` 或 `http://localhost:8100` 访问。
- run/action/log 命令前，使用 `execute --domain app --action devices` 获取 UDID。
- 如果连接了两台或以上 iOS 或 Android 设备，停止并询问用户使用哪个精确 UDID 或 serial。记住当前任务选择的设备，除非用户明确变更。
- run/action/log 命令必须显式传 `--device`。app run 支持重复传 `--env KEY=VALUE` 启动环境变量。
- 在已选设备上重新 run app 前，先对同一 platform/device 执行 `execute --domain app --action stop`。

## Failure Handling

构建失败：

1. 调用 `task-status`。
2. 如果任务仍是 `running`，等待后再轮询。不要读取原始日志。
3. 如果任务是 `failed`，停止并报告失败和 `log` 路径。没有用户指示，不要绕过或重试。
4. 用户要求调查后，只读取 `log` 指向的文件，然后定位第一个真实错误。除非必要，避免输出整份构建日志。

Run/action/log 失败：

1. 确认 `~/.apppilot` 下存在 `artifact/unity/ios/unity-build.json`。
2. 确认 `device` UDID 出现在 `execute --domain app --action devices` 中。
3. 确认已经运行过 `tools-setup --platform ios`。
4. 对 tap/swipe，确认 WDA 可用。
5. 对日志拉取，记住 app container 内固定日志路径是 `Library/Caches/Logs/gurusdk`。

## Artifacts

所有 AppPilot 运行时输出都在 `~/.apppilot` 下：

- 构建元数据：`~/.apppilot/artifact/unity/ios/unity-build.json`
- Android 构建元数据：`~/.apppilot/artifact/unity/android/unity-build.json`
- Xcode 工程：`~/.apppilot/artifact/unity/ios/xcode/`
- 已构建 app：从 `~/.apppilot/artifact/unity/ios/unity-build.json` 读取 `appPath`
- Android APK：从 `~/.apppilot/artifact/unity/android/unity-build.json` 读取 `appPath`
- 已拉取 app 日志：`~/.apppilot/artifact/logs/ios/gurusdk/`
- 已拉取 Android app 日志：`~/.apppilot/artifact/logs/android/logcat/`
- CLI/构建日志：`~/.apppilot/log/`
- 当前长任务状态：`~/.apppilot/log/status.json`

## Rules

- 只有 AppPilot 直连工具实际注入时，才优先使用直连工具。
- 否则使用 `~/.apppilot/apppilot-mcp-call`；不要写临时 JSON-RPC 脚本。
- 构建循环要节省 token：低频轮询 `task-status`，不要 tail 日志。
- 不要清设备日志；`log-clear` 只清本地 AppPilot 日志和 artifact。
- run/action/log 命令必须显式传 `--device`。
