import { expect, test } from "bun:test";
import {
  prepareAppPilotLaunch,
  registerAppPilotEventHandlers,
  waitForAppPilotConnection,
  type AppPilotRuntime,
} from "../../src/apppilot/app-pilot-launch.ts";
import { EventBus } from "../../src/core/events/event-bus.ts";
import type { AppPilotEventMap } from "../../src/core/events/events.ts";
import { buildArtifact, createMockDeviceDriver } from "../helpers/mocks.ts";

function createRuntime(options: { clientConnected?: boolean; appServerConnected?: boolean } = {}): { runtime: AppPilotRuntime; calls: string[] } {
  const calls: string[] = [];
  const runtime: AppPilotRuntime = {
    ensureStarted(): { advertiseHost: string; port: number } {
      calls.push("ensureStarted");
      return { advertiseHost: "192.168.1.10", port: 20242 };
    },
    prepareForLaunch(): void {
      calls.push("prepareForLaunch");
    },
    async waitForClient(): Promise<boolean> {
      calls.push("waitForClient");
      return options.clientConnected ?? true;
    },
    async waitForAppServer(): Promise<boolean> {
      calls.push("waitForAppServer");
      return options.appServerConnected ?? true;
    },
  };
  return { runtime, calls };
}

test("prepareAppPilotLaunch returns original options when disabled", async () => {
  const { driver, calls } = createMockDeviceDriver();
  const { runtime } = createRuntime();
  const launchOptions = { env: { existing: "1" } };

  const result = await prepareAppPilotLaunch(driver, launchOptions, runtime);

  expect(result).toBe(launchOptions);
  expect(calls).toEqual([]);
});

test("prepareAppPilotLaunch injects AppPilot websocket params through device driver", async () => {
  const { driver, calls } = createMockDeviceDriver();
  const { runtime, calls: runtimeCalls } = createRuntime();

  const result = await prepareAppPilotLaunch(driver, {
    env: { existing: "1" },
    appPilot: { enabled: true, rootName: "CanvasRoot", port: 20242 },
  }, runtime);

  expect(runtimeCalls).toEqual(["ensureStarted", "prepareForLaunch"]);
  expect(calls[0]).toEqual({
    method: "prepareLaunchOptions",
    args: [
      { env: { existing: "1" }, appPilot: { enabled: true, rootName: "CanvasRoot", port: 20242 } },
      {
        guru_apppilot: "true",
        guru_ws_client_ip_port: "192.168.1.10:20242",
        guru_apppilot_root_name: "CanvasRoot",
      },
    ],
  });
  expect(result.env).toEqual({
    existing: "1",
    guru_apppilot: "true",
    guru_ws_client_ip_port: "192.168.1.10:20242",
    guru_apppilot_root_name: "CanvasRoot",
  });
});

test("waitForAppPilotConnection fails when app does not connect back", async () => {
  const { runtime, calls } = createRuntime({ clientConnected: false });

  await expect(waitForAppPilotConnection({ enabled: true, waitMs: 50 }, runtime)).rejects.toThrow("Unity app connection");
  expect(calls).toEqual(["waitForClient"]);
});

test("registerAppPilotEventHandlers is idempotent per event bus", async () => {
  const bus = new EventBus<AppPilotEventMap>();
  const { runtime, calls } = createRuntime();
  const { driver } = createMockDeviceDriver();

  registerAppPilotEventHandlers(bus, runtime);
  registerAppPilotEventHandlers(bus, runtime);

  const context = {
    platform: "ios" as const,
    device: "device-1",
    appPath: "/artifact/app.ipa",
    bundleId: "com.example.app",
    launchOptions: { appPilot: { enabled: true } },
    deviceDriver: driver,
    build: buildArtifact(),
  };
  await bus.emitWait("app.run.before", context);

  expect(calls).toEqual(["ensureStarted", "prepareForLaunch"]);
});
