export type BuildAdapter = "unity";
export type BuildPlatform = "ios" | "android";
export type BuildAction = "build" | "xcode";

export interface BuildTask {
  adapter: BuildAdapter;
  platform: BuildPlatform;
  action: BuildAction;
  projectPath?: string;
  debug?: boolean;
  refresh?: boolean;
  buildRes?: boolean;
  xcode?: boolean;
}

export function normalizeBuildTask(input: Record<string, unknown>): BuildTask {
  const adapter = requireString(input, "adapter");
  const platform = requireString(input, "platform");
  const action = typeof input.action === "string" ? input.action : "build";

  if (adapter !== "unity") {
    throw new Error("Unsupported build adapter: " + adapter);
  }
  if (platform !== "ios" && platform !== "android") {
    throw new Error("Unsupported build platform: " + platform);
  }
  if (action !== "build" && action !== "xcode") {
    throw new Error("Unsupported build action: " + action);
  }
  if (platform === "android" && action === "xcode") {
    throw new Error("xcode build action is only supported for iOS.");
  }

  return {
    adapter,
    platform,
    action,
    projectPath: typeof input.projectPath === "string" ? input.projectPath : undefined,
    debug: typeof input.debug === "boolean" ? input.debug : undefined,
    refresh: typeof input.refresh === "boolean" ? input.refresh : undefined,
    buildRes: typeof input.buildRes === "boolean" ? input.buildRes : undefined,
    xcode: typeof input.xcode === "boolean" ? input.xcode : undefined,
  };
}

function requireString(input: Record<string, unknown>, key: string): string {
  const value = input[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(key + " is required.");
  }
  return value;
}
