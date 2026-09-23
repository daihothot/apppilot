# AppPilot

AppPilot is a physical execution plugin for build, install, launch, shutdown, input, and log operations. Project-level behavior belongs to the application behavior system and is outside AppPilot.

## Architecture

AppPilot has three layers:

1. `AppPilotOperationPort` defines platform-neutral, transport-neutral physical semantics.
2. Each Adapter owns one transport and implements the Port through that transport.
3. Each Executor implements the semantics for one platform on its Adapter's transport.

Runtime discovery first selects an available Adapter, then that Adapter selects an available Executor. Default discovery follows registration order. Explicit transport discovery never falls back.

Build selects a platform build tool directly and does not require a runtime transport.

## Commands

```bash
apppilot identify
apppilot identify --transport unity-pipeline
apppilot identify --transport adb

apppilot build --platform android --project-path /project --output-path /output/app.apk
apppilot install --app-id com.example.app --artifact-path /output/app.apk
apppilot launch --app-id com.example.app
apppilot shutdown --app-id com.example.app
apppilot logs --app-id com.example.app --output-path /output/logs
```

The external host owns the AppPilot process lifetime. Call `identify` before runtime operations in that process. AppPilot caches the discovered Adapter and Executor until they become unavailable or the external host ends the process.

## Package

```bash
bun run check
bun run build:plugin
./dist/apppilot setup --plugin
```

The installed plugin contains the `apppilot` CLI and Skill. It does not register an MCP server.
