import type { AppPilotLaunchOptions } from "../apppilot/types.ts";

export type Platform = "ios" | "android";

export interface LaunchOptions {
  env?: Record<string, string>;
  appPilot?: AppPilotLaunchOptions;
}
