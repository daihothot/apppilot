export type Platform = "ios" | "android";
export type BuildConfiguration = "debug" | "release";

export interface AndroidIntentExtra {
  type: "string" | "int" | "long" | "float" | "boolean" | "string-array" | "int-array";
  key: string;
  value: string | number | boolean | string[] | number[];
}

export interface AndroidLaunchIntent {
  component?: string;
  action?: string;
  data?: string;
  mimeType?: string;
  categories?: string[];
  flags?: string[];
  extras?: AndroidIntentExtra[];
}

export interface LaunchOptions {
  env?: Record<string, string>;
  androidIntent?: AndroidLaunchIntent;
}

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

export interface CommandResult {
  command: string;
  args: string[];
  exitCode: number;
  stdout: string;
  stderr: string;
}
