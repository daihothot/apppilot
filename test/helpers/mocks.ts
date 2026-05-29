import type { BuildArtifact } from "../../src/core/build/types.ts";
import type { BuildArtifactStore } from "../../src/core/artifact/build-artifact-store.ts";
import type { LogStore } from "../../src/core/log/log-store.ts";
import type { CommandResult } from "../../src/core/process/types.ts";
import type { DeviceDriver, DeviceLogDump, DeviceLogDumpOptions } from "../../src/devices/device-driver.ts";
import type { LaunchOptions, Platform } from "../../src/devices/types.ts";

export interface DeviceCall {
  method: string;
  args: unknown[];
}

export function commandResult(overrides: Partial<CommandResult> = {}): CommandResult {
  return {
    command: overrides.command ?? "mock",
    args: overrides.args ?? [],
    exitCode: overrides.exitCode ?? 0,
    stdout: overrides.stdout ?? "",
    stderr: overrides.stderr ?? "",
  };
}

export function buildArtifact(overrides: Partial<BuildArtifact> = {}): BuildArtifact {
  return {
    adapter: "unity",
    platform: overrides.platform ?? "ios",
    configuration: overrides.configuration ?? "debug",
    projectPath: overrides.projectPath ?? "/project",
    appPath: overrides.appPath ?? "/artifact/app",
    bundleId: overrides.bundleId ?? "com.example.app",
    builtAt: overrides.builtAt ?? "2026-05-29T00:00:00.000Z",
    ...(overrides.xcodeProjectPath ? { xcodeProjectPath: overrides.xcodeProjectPath } : {}),
  };
}

export function createMockBuildStore(artifact: BuildArtifact): { store: BuildArtifactStore; calls: Platform[] } {
  const calls: Platform[] = [];
  const store = {
    readUnityBuild(platform: Platform): BuildArtifact {
      calls.push(platform);
      return artifact;
    },
  } as unknown as BuildArtifactStore;
  return { store, calls };
}

export function createMockLogStore(): { store: LogStore; entries: Array<{ level: string; message: string; data?: unknown }> } {
  const entries: Array<{ level: string; message: string; data?: unknown }> = [];
  const store = {
    debug(message: string, data?: unknown): void {
      entries.push({ level: "debug", message, data });
    },
    log(message: string, data?: unknown): void {
      entries.push({ level: "log", message, data });
    },
    warning(message: string, data?: unknown): void {
      entries.push({ level: "warning", message, data });
    },
    error(message: string, data?: unknown): void {
      entries.push({ level: "error", message, data });
    },
  } as unknown as LogStore;
  return { store, entries };
}

export interface MockDeviceDriverOptions {
  platform?: Platform;
  listResult?: CommandResult;
  installResult?: CommandResult;
  launchResult?: CommandResult;
  stopResult?: CommandResult;
  tapResult?: CommandResult;
  swipeResult?: CommandResult;
  logDump?: DeviceLogDump;
}

export function createMockDeviceDriver(options: MockDeviceDriverOptions = {}): { driver: DeviceDriver; calls: DeviceCall[] } {
  const calls: DeviceCall[] = [];
  const driver: DeviceDriver = {
    platform: options.platform ?? "ios",
    async listDevices(): Promise<CommandResult> {
      calls.push({ method: "listDevices", args: [] });
      return options.listResult ?? commandResult({ stdout: "mock-device\n" });
    },
    prepareLaunchOptions(launchOptions: LaunchOptions, params: Record<string, string>): LaunchOptions {
      calls.push({ method: "prepareLaunchOptions", args: [launchOptions, params] });
      return {
        ...launchOptions,
        env: {
          ...(launchOptions.env ?? {}),
          ...params,
        },
      };
    },
    async install(device: string, appPath: string): Promise<CommandResult> {
      calls.push({ method: "install", args: [device, appPath] });
      return options.installResult ?? commandResult();
    },
    async launch(device: string, bundleId: string, launchOptions?: LaunchOptions): Promise<CommandResult> {
      calls.push({ method: "launch", args: [device, bundleId, launchOptions] });
      return options.launchResult ?? commandResult();
    },
    async stop(device: string, bundleId: string): Promise<CommandResult> {
      calls.push({ method: "stop", args: [device, bundleId] });
      return options.stopResult ?? commandResult();
    },
    async tap(device: string, point: string): Promise<CommandResult> {
      calls.push({ method: "tap", args: [device, point] });
      return options.tapResult ?? commandResult();
    },
    async swipe(device: string, from: string, to: string): Promise<CommandResult> {
      calls.push({ method: "swipe", args: [device, from, to] });
      return options.swipeResult ?? commandResult();
    },
    async dumpAppLogs(dumpOptions: DeviceLogDumpOptions): Promise<DeviceLogDump> {
      calls.push({ method: "dumpAppLogs", args: [dumpOptions] });
      return options.logDump ?? {
        kind: "text",
        prefix: "mock",
        sourceName: "mock.log",
        content: "mock log",
      };
    },
  };
  return { driver, calls };
}
