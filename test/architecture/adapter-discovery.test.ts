import { expect, test } from "bun:test";
import { AppPilotAdapterRegistry } from "../../src/core/port/adapters/app-pilot-adapter-registry.ts";
import type { AdapterHandshakeResult, AppPilotAdapter } from "../../src/core/port/adapters/app-pilot-adapter.ts";
import { UnityPipelineExecutionAdapter } from "../../src/core/port/adapters/unity-pipeline/unity-pipeline-execution-adapter.ts";
import type { UnityPipelinePlatformExecutor } from "../../src/core/port/adapters/unity-pipeline/unity-pipeline-platform-executor.ts";
import type { AppPilotIdentity, AppPilotResult, LogsResult } from "../../src/core/port/app-pilot-operation-port.ts";

const identity: AppPilotIdentity = { transport: "second", platform: { type: "android", version: "16" } };

test("default discovery selects the first adapter with an available platform", async () => {
  const calls: string[] = [];
  const first = fakeAdapter("first", { status: "unavailable" }, calls);
  const second = fakeAdapter("second", { status: "connected", identity }, calls);
  const selected = await new AppPilotAdapterRegistry([first, second]).handshake();

  expect(selected.ok).toBe(true);
  if (selected.ok) expect(selected.identity).toEqual(identity);
  expect(calls).toEqual(["first", "second"]);
});

test("specified transport failure does not fall back", async () => {
  const calls: string[] = [];
  const first = fakeAdapter("first", { status: "unavailable" }, calls);
  const second = fakeAdapter("second", { status: "connected", identity }, calls);
  const selected = await new AppPilotAdapterRegistry([first, second]).handshake("first");

  expect(selected).toEqual({ ok: false, code: "transport_unavailable", message: "Transport first has no available platform." });
  expect(calls).toEqual(["first"]);
});

test("Unity Pipeline discovers platform executors in registration order", async () => {
  const calls: string[] = [];
  const connected: AppPilotIdentity = {
    transport: "unity-pipeline",
    platform: { type: "unity_editor", version: "6000.0.80f1" },
  };
  const unavailable: UnityPipelinePlatformExecutor = {
    platformType: "android",
    identify: async () => { calls.push("android"); return undefined; },
    start: async () => ok(),
    stop: async () => ok(),
  };
  const available: UnityPipelinePlatformExecutor = {
    platformType: "unity_editor",
    identify: async () => { calls.push("unity_editor"); return { ok: true, value: connected }; },
    start: async () => ok(),
    stop: async () => ok(),
  };
  const adapter = new UnityPipelineExecutionAdapter([unavailable, available]);

  const selected = await adapter.handshake();
  expect(selected).toEqual({ status: "connected", identity: connected });
  expect(calls).toEqual(["android", "unity_editor"]);
});

function fakeAdapter(
  transport: string,
  result: AdapterHandshakeResult,
  calls: string[],
): AppPilotAdapter {
  return {
    transport,
    handshake: async () => { calls.push(transport); return result; },
    install: async () => ok(),
    uninstall: async () => ok(),
    launch: async () => ok(),
    restart: async () => ok(),
    shutdown: async () => ok(),
    tap: async () => ok(),
    swipe: async () => ok(),
    logs: async (): Promise<AppPilotResult<LogsResult>> => ({ ok: true, value: { path: "/log" } }),
  };
}

function ok(): AppPilotResult<void> {
  return { ok: true, value: undefined };
}
