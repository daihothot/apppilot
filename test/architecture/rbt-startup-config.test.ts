import { expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { AppPilotIdentity, AppPilotOperationPort, RbtConfigRequest } from "../../src/core/port/app-pilot-operation-port.ts";
import { UnityPipelineTool, type UnityPipelineRequest, type UnityPipelineTransportResponse } from "../../src/core/port/adapters/unity-pipeline/unity-pipeline-tool.ts";
import { UnityPipelineEditorExecutor } from "../../src/core/port/adapters/unity-pipeline/unity-pipeline-editor-executor.ts";
import { UnityPipelineExecutionAdapter } from "../../src/core/port/adapters/unity-pipeline/unity-pipeline-execution-adapter.ts";
import { AdbTransport } from "../../src/core/port/adapters/adb/adb-transport.ts";
import { AdbAndroidExecutor } from "../../src/core/port/adapters/adb/executors/adb-android-executor.ts";
import type { HostCommandResult } from "../../src/host/host-command-executor.ts";
import { WriteRbtConfigCommand } from "../../src/core/cli/commands/write-rbt-config-command.ts";
import { ClearRbtConfigCommand } from "../../src/core/cli/commands/clear-rbt-config-command.ts";

const editor: AppPilotIdentity = { transport: "unity-pipeline", platform: { type: "unity_editor", version: "6000.0.80f1" } };
const android: AppPilotIdentity = { transport: "adb", platform: { type: "android", version: "17" } };

test("Editor separates launch arguments and RBT config across launch, restart and cleanup", async () => {
  const project = mkdtempSync(join(tmpdir(), "apppilot-startup-editor-"));
  try {
    const transport = new EditorTransport(project);
    const executor = new UnityPipelineEditorExecutor(transport);
    const adapter = new UnityPipelineExecutionAdapter([executor]);
    const rbt = join(project, "Library/GuruRbt/rbt-config.json");
    const launch = join(project, "Library/GuruLaunch/launch-args.json");
    const entries = { guru_rbt_startup: JSON.stringify({ startupId: 'quoted "startup" = value' }) };

    expect(await executor.writeRbtConfig({ identity: editor, entries })).toEqual({ ok: true, value: undefined });
    expect(JSON.parse(readFileSync(rbt, "utf8"))).toEqual(entries);
    expect(existsSync(`${rbt}.tmp`)).toBe(false);
    transport.beforePlay = () => expect(JSON.parse(readFileSync(launch, "utf8"))).toEqual({ guru_debug: "true" });
    expect(await adapter.launch({ identity: editor, parameters: { guru_debug: "true" } })).toEqual({ ok: true, value: undefined });
    expect(JSON.parse(readFileSync(rbt, "utf8"))).toEqual(entries);

    expect(await executor.writeRbtConfig({ identity: editor, entries: { guru_rbt_startup: "different" } }))
      .toMatchObject({ ok: false, code: "rbt_config_target_running" });
    expect(JSON.parse(readFileSync(rbt, "utf8"))).toEqual(entries);
    expect(await executor.start(editor, { guru_debug: "changed" })).toEqual({ ok: true, value: undefined });
    expect(JSON.parse(readFileSync(launch, "utf8"))).toEqual({ guru_debug: "true" });

    transport.beforePlay = () => expect(JSON.parse(readFileSync(launch, "utf8"))).toEqual({ guru_debug: "false" });
    expect(await adapter.restart({ identity: editor, parameters: { guru_debug: "false" } })).toEqual({ ok: true, value: undefined });
    expect(JSON.parse(readFileSync(launch, "utf8"))).toEqual({ guru_debug: "false" });
    expect(JSON.parse(readFileSync(rbt, "utf8"))).toEqual(entries);
    writeFileSync(`${rbt}.tmp`, "unfinished");
    expect(await executor.clearRbtConfig(editor)).toEqual({ ok: true, value: undefined });
    expect(existsSync(rbt)).toBe(false);
    expect(existsSync(`${rbt}.tmp`)).toBe(false);
    expect(await executor.clearRbtConfig(editor)).toEqual({ ok: true, value: undefined });
    expect(JSON.parse(readFileSync(launch, "utf8"))).toEqual({ guru_debug: "false" });
  } finally {
    rmSync(project, { recursive: true, force: true });
  }
});

test("Editor launch without parameters removes the previous launch arguments before Play", async () => {
  const project = mkdtempSync(join(tmpdir(), "apppilot-startup-no-args-"));
  try {
    const launch = join(project, "Library/GuruLaunch/launch-args.json");
    mkdirSync(dirname(launch), { recursive: true });
    writeFileSync(launch, JSON.stringify({ guru_debug: "true" }));
    expect(JSON.parse(readFileSync(launch, "utf8"))).toEqual({ guru_debug: "true" });
    const transport = new EditorTransport(project);
    transport.beforePlay = () => expect(existsSync(launch)).toBe(false);
    expect(await new UnityPipelineEditorExecutor(transport).start(editor)).toEqual({ ok: true, value: undefined });
    expect(existsSync(launch)).toBe(false);
    expect(transport.playing).toBe(true);
  } finally {
    rmSync(project, { recursive: true, force: true });
  }
});

test("Android config is atomically published and rejects a running app while launch keeps intent extras", async () => {
  const transport = new AndroidTransport();
  const executor = new AdbAndroidExecutor(transport);
  expect(await executor.launch(android, { identity: android, appId: "example.app" })).toEqual({ ok: true, value: undefined });
  expect(transport.calls.some(args => args.includes("monkey"))).toBe(true);
  expect(await executor.launch(android, { identity: android, appId: "example.app", parameters: { guru_debug: "true", guru_ws_client_ip_port: "127.0.0.1:18083" } })).toEqual({ ok: true, value: undefined });
  expect(transport.calls.find(args => args.includes("start"))).toContain("--es");
  expect(transport.calls.some(args => args.includes("push"))).toBe(false);
  const entries = { guru_rbt_startup: JSON.stringify({ startupId: 'quote " and spaces = preserved' }) };
  const request = { identity: android, appId: "example.app", entries };
  expect(await executor.writeRbtConfig(android, request)).toEqual({ ok: true, value: undefined });
  expect(transport.pushedEntries).toEqual(entries);
  const writes = transport.calls.filter(args => args.includes("mkdir") || args.includes("push") || args.includes("mv"));
  expect(writes.map(args => args.includes("mkdir") ? "mkdir" : args.includes("push") ? "push" : "mv")).toEqual(["mkdir", "push", "mv"]);
  expect(writes[2]!.slice(-2)).toEqual(["/sdcard/Android/data/example.app/files/GuruRbt/rbt-config.json.tmp", "/sdcard/Android/data/example.app/files/GuruRbt/rbt-config.json"]);
  expect(existsSync(transport.pushedPath!)).toBe(false);
  transport.running = true;
  expect(await executor.writeRbtConfig(android, request)).toMatchObject({ ok: false, code: "rbt_config_target_running" });
  expect(transport.calls.filter(args => args.includes("push"))).toHaveLength(1);
  expect(await executor.clearRbtConfig(android, request)).toEqual({ ok: true, value: undefined });
  expect(await executor.clearRbtConfig(android, request)).toEqual({ ok: true, value: undefined });
  expect(transport.calls.at(-1)!.slice(-4)).toEqual(["rm", "-f", "/sdcard/Android/data/example.app/files/GuruRbt/rbt-config.json", "/sdcard/Android/data/example.app/files/GuruRbt/rbt-config.json.tmp"]);
});

test("Android config upload failure releases its local temporary file", async () => {
  const transport = new AndroidTransport();
  transport.failPush = true;
  const executor = new AdbAndroidExecutor(transport);
  expect(await executor.writeRbtConfig(android, { identity: android, appId: "example.app", entries: { guru_rbt_startup: "{}" } }))
    .toMatchObject({ ok: false, code: "rbt_config_write_failed" });
  expect(transport.pushedEntries).toEqual({ guru_rbt_startup: "{}" });
  expect(existsSync(transport.pushedPath!)).toBe(false);
  expect(transport.calls.some(args => args.includes("mv"))).toBe(false);
});

test("RBT config CLI preserves JSON entry values and requires at least one entry", async () => {
  const writes: RbtConfigRequest[] = [];
  const clears: unknown[] = [];
  const port = {
    writeRbtConfig: async (request: RbtConfigRequest) => { writes.push(request); return { ok: true, value: undefined }; },
    clearRbtConfig: async (request: unknown) => { clears.push(request); return { ok: true, value: undefined }; },
  } as unknown as AppPilotOperationPort;
  const command = new WriteRbtConfigCommand(port);
  expect(await command.invoke(["--identity", JSON.stringify(android), "--app-id", "example.app"]))
    .toMatchObject({ ok: false, code: "invalid_request" });
  expect(writes).toHaveLength(0);
  const value = JSON.stringify({ startupId: 'space " = value' });
  expect(await command.invoke(["--identity", JSON.stringify(android), "--app-id", "example.app", "--entry", `guru_rbt_startup=${value}`])).toMatchObject({ ok: true });
  expect(writes).toEqual([{ identity: android, appId: "example.app", entries: { guru_rbt_startup: value } }]);
  expect(await new ClearRbtConfigCommand(port).invoke(["--identity", JSON.stringify(android), "--app-id", "example.app"])).toMatchObject({ ok: true });
  expect(clears).toEqual([{ identity: android, appId: "example.app" }]);
});

class EditorTransport extends UnityPipelineTool {
  playing = false;
  beforePlay: (() => void) | undefined;
  constructor(private readonly project: string) { super(); }
  override async execute(request: UnityPipelineRequest): Promise<UnityPipelineTransportResponse> {
    let result: UnityPipelineTransportResponse["result"];
    if (request.operation === "status") result = { count: 1, instances: [{ version: editor.platform.version, state: "ready", project: this.project }] };
    else if (request.operation === "editor_status") result = { status: this.playing ? "playing" : "ready", compiling: false, domainReloadInProgress: false, playMode: this.playing ? "playing" : "stopped", unityVersion: editor.platform.version };
    else {
      if (request.operation === "editor_play") { this.beforePlay?.(); this.playing = true; }
      if (request.operation === "editor_stop") this.playing = false;
      result = "accepted";
    }
    return { success: true, status: "completed", operation: request.operation, result };
  }
}

class AndroidTransport extends AdbTransport {
  readonly calls: string[][] = [];
  running = false;
  failPush = false;
  pushedEntries: unknown;
  pushedPath: string | undefined;
  override async execute(args: string[]): Promise<HostCommandResult> {
    this.calls.push([...args]);
    let stdout = "";
    let exitCode = 0;
    if (args[0] === "devices") stdout = "List of devices attached\nserial device\n";
    if (args.includes("getprop")) stdout = "17\n";
    if (args.includes("resolve-activity")) stdout = "example.app/.MainActivity\n";
    if (args.includes("pidof")) { stdout = this.running ? "1234\n" : ""; exitCode = this.running ? 0 : 1; }
    if (args.includes("push")) {
      this.pushedPath = args[3]!;
      this.pushedEntries = JSON.parse(readFileSync(this.pushedPath, "utf8"));
      exitCode = this.failPush ? 1 : 0;
    }
    return { executable: "adb", args, exitCode, stdout, stderr: exitCode && this.failPush ? "upload failed" : "" };
  }
}
