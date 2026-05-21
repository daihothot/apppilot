export type Platform = "ios";
export type BuildConfiguration = "debug" | "release";

export interface BuildArtifact {
  adapter: "unity";
  platform: Platform;
  configuration: BuildConfiguration;
  projectPath: string;
  xcodeProjectPath: string;
  appPath: string;
  bundleId: string;
  builtAt: string;
}

export interface CommandResult {
  command: string;
  args: string[];
  exitCode: number;
  stdout: string;
  stderr: string;
}
