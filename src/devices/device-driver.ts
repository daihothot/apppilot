import type { CommandResult } from "../core/process/types.ts";
import type { LaunchOptions, Platform } from "./types.ts";

export interface DeviceLogDumpOptions {
  device: string;
  bundleId: string;
  offset: number;
  tempDir: string;
}

export type DeviceLogDump =
  | {
    kind: "file";
    path: string;
    prefix: string;
    sourceName: string;
    remotePath?: string;
  }
  | {
    kind: "text";
    content: string;
    prefix: string;
    sourceName: string;
  };

export interface DeviceDriver {
  readonly platform: Platform;

  listDevices(): Promise<CommandResult>;

  prepareLaunchOptions(launchOptions: LaunchOptions, params: Record<string, string>): LaunchOptions;

  install(device: string, appPath: string): Promise<CommandResult>;
  launch(device: string, bundleId: string, launchOptions?: LaunchOptions): Promise<CommandResult>;
  stop(device: string, bundleId: string): Promise<CommandResult>;

  tap(device: string, point: string): Promise<CommandResult>;
  swipe(device: string, from: string, to: string): Promise<CommandResult>;

  dumpAppLogs(options: DeviceLogDumpOptions): Promise<DeviceLogDump>;
}
