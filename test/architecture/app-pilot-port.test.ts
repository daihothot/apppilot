import { expect, test } from "bun:test";
import type { AppPilotAdapter } from "../../src/core/port/adapters/app-pilot-adapter.ts";
import { AppPilotAdapterRegistry } from "../../src/core/port/adapters/app-pilot-adapter-registry.ts";
import type { AppPilotIdentity, AppPilotResult, LogsResult, BuildArtifact } from "../../src/core/port/app-pilot-operation-port.ts";
import { PlatformBuildRegistry } from "../../src/platforms/platform-build-registry.ts";
import { AppPilotPort } from "../../src/core/port/app-pilot-port.ts";

const identity: AppPilotIdentity = { transport: "fake", platform: { type: "android", version: "16" } };

test("runtime semantics require explicit discovery and reuse the selected adapter", async () => {
  const calls: string[] = [];
  const adapter = fakeAdapter(calls);
  const port = new AppPilotPort(
    new AppPilotAdapterRegistry([adapter]),
    new PlatformBuildRegistry([]),
  );

  expect(await port.install({ appId: "app", artifactPath: "/app.apk" })).toEqual({
    ok: false,
    code: "execution_not_discovered",
    message: "No execution target is discovered. Call identify first.",
  });
  expect(await port.identify({})).toEqual({ ok: true, value: identity });
  await port.install({ appId: "app", artifactPath: "/app.apk" });
  await port.restart({ appId: "app" });
  expect(calls).toEqual(["handshake", "install", "restart"]);
});

test("an unavailable cached adapter requires external discovery again", async () => {
  const adapter = fakeAdapter([]);
  adapter.launch = async () => ({
    ok: false,
    code: "execution_selection_unavailable",
    message: "disconnected",
    requiresIdentify: true,
  });
  const port = new AppPilotPort(
    new AppPilotAdapterRegistry([adapter]),
    new PlatformBuildRegistry([]),
  );

  await port.identify({});
  expect(await port.launch({ appId: "app" })).toMatchObject({
    ok: false,
    code: "execution_selection_unavailable",
  });
  expect(await port.launch({ appId: "app" })).toMatchObject({
    ok: false,
    code: "execution_not_discovered",
  });
});

test("build selects a platform tool without transport discovery", async () => {
  const artifact: BuildArtifact = { platform: "android", projectPath: "/project", outputPath: "/app.apk", appPath: "/app.apk", appId: "app" };
  const port = new AppPilotPort(
    new AppPilotAdapterRegistry([]),
    new PlatformBuildRegistry([{ platform: "android", tool: { build: async () => ({ ok: true, value: artifact }) } }]),
  );

  const result = await port.build({
    platform: "android", projectPath: "/project", outputPath: "/app.apk", configuration: "debug",
    append: false, buildResources: false, buildNative: false,
  });
  expect(result).toEqual({ ok: true, value: artifact });
});

function fakeAdapter(calls: string[]): AppPilotAdapter {
  const ok = async (): Promise<AppPilotResult<void>> => ({ ok: true, value: undefined });
  return {
    transport: "fake",
    handshake: async () => { calls.push("handshake"); return { status: "connected", identity }; },
    invalidateDiscovery: () => undefined,
    install: async () => { calls.push("install"); return ok(); },
    uninstall: ok,
    launch: ok,
    restart: async () => { calls.push("restart"); return ok(); },
    shutdown: ok,
    tap: ok,
    swipe: ok,
    logs: async (): Promise<AppPilotResult<LogsResult>> => ({ ok: true, value: { path: "/log" } }),
  };
}
