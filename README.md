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
apppilot install --identity '{"transport":"adb","platform":{"type":"android","version":"16"}}' --app-id com.example.app --artifact-path /output/app.apk
apppilot launch --identity '{"transport":"adb","platform":{"type":"android","version":"16"}}' --app-id com.example.app
apppilot shutdown --identity '{"transport":"adb","platform":{"type":"android","version":"16"}}' --app-id com.example.app
apppilot logs --identity '{"transport":"adb","platform":{"type":"android","version":"16"}}' --app-id com.example.app --output-path /output/logs
```

The caller persists the identity returned by `identify` and passes it to every runtime operation. AppPilot keeps no runtime selection between commands.

## Package

```bash
bun run check
bun run build:plugin
./dist/apppilot setup --plugin
```

The installed plugin contains the `apppilot` CLI and Skill. It does not register an MCP server.
