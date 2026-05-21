import type { CommandResult, Platform } from "../types.ts";

export interface Backend {
  readonly platform: Platform;

  listDevices(): Promise<CommandResult>;

  install(device: string, appPath: string): Promise<CommandResult>;
  launch(device: string, bundleId: string, launchEnv?: Record<string, string>): Promise<CommandResult>;
  stop(device: string, bundleId: string): Promise<CommandResult>;

  tap(device: string, point: string): Promise<CommandResult>;
  swipe(device: string, from: string, to: string): Promise<CommandResult>;

  pullAppLogFile(device: string, bundleId: string, remotePath: string, localPath: string): Promise<CommandResult>;
}
