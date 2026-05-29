import type { Platform } from "../../devices/types.ts";

export type BuildConfiguration = "debug" | "release";

export interface BuildArtifact {
  adapter: "unity";
  platform: Platform;
  configuration: BuildConfiguration;
  projectPath: string;
  xcodeProjectPath?: string;
  appPath: string;
  bundleId: string;
  builtAt: string;
}
