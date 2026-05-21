# AppPilot MVP 设计

## 1. 定位

**AppPilot** 是面向 Agent 的移动端调试 CLI。

当前 MVP 使用 **TypeScript** 实现，先支持：

- iOS 真机
- Unity iOS 构建产物
- OfflineLog 文件日志

当前不做：

- Android
- 配置文件
- run state / report
- 截图 / 录屏 / OCR / VLM
- UI tree / Unity snapshot / state snapshot
- 日志 JSON 化
- 实时 log stream

---

## 2. CLI 入口

CLI 不暴露 `adapter` / `executor` / `backend` 这些内部概念，只暴露 Agent 直接使用的能力入口：

```text
apppilot unity ...
apppilot app ...
apppilot action ...
apppilot logs ...
```

内部映射：

```text
unity  -> adapter 能力域
app    -> executor app 能力域
action -> executor action 能力域
logs   -> executor logs 能力域
```

参数规则：

- 平台使用 flag：`--ios`
- Unity 项目目录使用第一个 positional 参数：`<UNITY_DIR>`
- 必须稳定识别的上下文参数保留 named option：`--device`、`--offset`、`--match`

---

## 3. Unity Adapter

Unity adapter 只负责准备 App 构建产物，不负责安装、运行、操作设备或导出日志。

命令：

```bash
apppilot unity <UNITY_DIR> --ios [--debug] [--build-res] [--build | --refresh-build]
```

示例：

```bash
apppilot unity /path/to/unity --ios --debug --build
```

```bash
apppilot unity /path/to/unity --ios --debug --build-res --refresh-build
```

规则：

- `<UNITY_DIR>` 是 Unity 项目根目录。
- `--ios` 必须显式传入。
- 默认不 build resources。
- 默认不 build。
- 默认不 refresh build。
- `--build` 和 `--refresh-build` 互斥。
- `--debug` 表示 Debug / Development build。

输出：

```text
artifact/
  unity/
    ios/
      xcode/
      unity-build.json
```

说明：

- `artifact/unity/ios/xcode/` 保存 Unity 生成的 iOS Xcode 工程。
- `artifact/unity/ios/unity-build.json` 保存最近一次 Unity iOS 构建信息。
- artifact 路径按当前产物覆盖，不做历史归档。
- `--refresh-build` 可以清理或刷新已有构建产物后再构建。

`unity-build.json` 示例：

```json
{
  "adapter": "unity",
  "platform": "ios",
  "configuration": "debug",
  "projectPath": "/path/to/unity",
  "xcodeProjectPath": "artifact/unity/ios/xcode",
  "appPath": "artifact/unity/ios/xcode/build/App.app",
  "bundleId": "com.company.game"
}
```

---

## 4. App Executor

Executor 负责 CLI 业务语义，backend 负责平台工具调用。

当前 iOS backend：

```text
IosBackend
  - 本地 pymobiledevice3 devices / install / launch
  - WDA terminate / tap / swipe
  - App 沙盒日志文件枚举
```

App executor 读取：

```text
artifact/unity/ios/unity-build.json
```

命令：

```bash
apppilot app devices --ios
apppilot app run --ios --device <UDID>
apppilot app stop --ios --device <UDID>
```

`app run` 固定语义：

```text
install + launch
```

执行：

```bash
.tools/python/venv/bin/pymobiledevice3 apps install <appPath>
.tools/python/venv/bin/pymobiledevice3 developer dvt launch <bundleId>
```

其中 `appPath` 和 `bundleId` 来自 `artifact/unity/ios/unity-build.json`。

---

## 5. Action Executor

Action executor 负责设备动作。

命令形态：

```bash
apppilot action tap --ios --device <UDID> 11,213
apppilot action swipe --ios --device <UDID> 100,500 100,100
```

当前 iOS 动作通过 WDA backend 执行，默认地址为 `http://localhost:8100`，可用 `APPPILOT_WDA_URL` 覆盖。

示例映射：

```bash
apppilot action tap --ios --device <UDID> 11,213
```

内部执行：

```bash
POST /session/<id>/actions
```

---

## 6. Logs Executor

Logs executor 读取：

```text
artifact/unity/ios/unity-build.json
```

使用其中的 `bundleId` 定位 App data container。

命令：

```bash
apppilot logs clear --ios --device <UDID>
apppilot logs dump --ios --device <UDID>
apppilot logs dump --ios --device <UDID> --offset 1
apppilot logs dump --ios --device <UDID> --offset 1 --match "Login failed"
```

内置日志常量：

```ts
const OFFLINE_LOG_ROOT_PATH = "Library/Caches/Logs";
const OFFLINE_LOG_DIR_NAME = "gurusdk";
```

日志目录固定：

```text
Library/Caches/Logs/gurusdk
```

`logs clear`：

```text
1. 读取 artifact/unity/ios/unity-build.json
2. 使用 bundleId resolve app container
3. 定位 <container>/Library/Caches/Logs
4. 固定定位 gurusdk 日志目录
5. 删除命中的日志文件
6. 写 apppilot.log
```

`logs dump` 无 `--match`：

```text
1. 读取 artifact/unity/ios/unity-build.json
2. 使用 bundleId resolve app container
3. 定位 <container>/Library/Caches/Logs
4. 固定定位 gurusdk 日志目录
5. 按文件名日期倒序选择 --offset 指定日志，默认 0
6. 复制选中文件到 artifact/logs/ios/gurusdk/
6. 写 apppilot.log
```

`logs dump` 有 `--match`：

```text
1. 拉取 gurusdk 日志目录
2. 按文件名日期倒序选择 --offset 指定日志，默认 0
3. 只提取 match 命中的内容
4. 写入 artifact/logs/ios/gurusdk/
4. 输出 Agent 真正需要看的内容
5. 不保留完整原始日志文件
```

---

## 7. Log 模块

`log` 只记录 AppPilot 自己的 CLI 日志，不保存 App 业务日志。

日志级别只需要：

```ts
type LogLevel = "debug" | "log" | "warning" | "error";
```

接口：

```ts
interface LogStore {
  debug(message: string, data?: unknown): void;
  log(message: string, data?: unknown): void;
  warning(message: string, data?: unknown): void;
  error(message: string, data?: unknown): void;
}
```

输出：

```text
log/
  apppilot.log
  status.json
```

`status.json` 只保存最近一个长任务状态，Unity build 和 Xcode build 共用同一份状态；新的长任务会覆盖旧状态。`apppilot log clear` 会清掉它。

示例：

```text
2026-05-18T15:31:00Z log app run started
2026-05-18T15:31:02Z log app run finished
2026-05-18T15:31:10Z warning no log files matched offset 0
2026-05-18T15:31:20Z error failed to resolve app container
```

---

## 8. Artifact 结构

```text
artifact/
  unity/
    ios/
      xcode/
      unity-build.json

  logs/
    ios/
      gurusdk/
        <bundleId> 2026-05-19--17-57-03-255.log
```

说明：

- `artifact/unity/ios/unity-build.json` 给 executor 读取。
- `artifact/unity/ios/xcode/` 保存 Unity iOS Xcode 工程。
- `artifact/logs/ios/gurusdk/` 保存 Agent 需要看的日志内容。
- 当前 artifact 覆盖写入，不做历史归档。

---

## 9. TypeScript 目录建议

```text
src/
  cli/
    index.ts
    app-command.ts
    unity-command.ts
    action-command.ts
    log-command.ts
    logs-command.ts
    tools-command.ts
    platform.ts
  factory/
    adapter-factory.ts
    backend-factory.ts
    executor-factory.ts
  log/
    log-store.ts
  adapter/
    unity/
      unity-adapter.ts
      ios/
        unity-ios-builder.ts
        unity-xcode-builder.ts
        unity-ios-build-status.ts
        unity-xcode-build-status.ts
      tools/
        AppPilotUnityBuild.cs
  backend/
    backend.ts
    ios-backend.ts
  executor/
    app-executor.ts
    action-executor.ts
    logs-executor.ts
  artifact/
    build-artifact-store.ts
    app-log-artifact-store.ts
  process/
    executor.ts
  task/
    task-status-store.ts
  tools/
    ios-tools-service.ts
```

进程执行要求：

- 使用参数数组执行，不拼 shell 字符串。
- 失败时写 `log.error(...)`。
- 普通过程写 `log.log(...)`。
- 细节排查写 `log.debug(...)`。
- 可恢复异常写 `log.warning(...)`。
- 不吞底层命令错误。

---

## 10. MCP

MCP server 先复用 CLI，不直接重写业务逻辑。启动方式：

```bash
bun src/mcp/server.ts
```

第一版工具：

```text
unity_ios_build(projectPath, debug?, refresh?, buildRes?, xcode?)
build_status()
ios_devices()
ios_app_run()
ios_app_stop()
ios_action_tap(x, y)
ios_action_swipe(fromX, fromY, toX, toY)
ios_logs_dump(offset?, match?)
read_app_log_artifact(path)
```

规则：

- MCP 不要求 agent 传 UDID，默认自动选择 USB 设备。
- `unity_ios_build` 后台启动任务，立即返回提示字符串：`Call build_status until state is success or failed.`
- `build_status` 返回结构化状态，不读取大日志。
- `ios_logs_dump` 固定读取 `Library/Caches/Logs/gurusdk`，`offset=0` 表示最新日志。
- root tunneld 仍由用户手动执行，MCP 不静默 sudo。
