import { existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { appPilotConfig } from "../../../config/app-pilot-config.ts";
import type { BuildConfiguration } from "../../../core/build/types.ts";
import { LogStore } from "../../../core/log/log-store.ts";
import { execFile } from "../../../core/process/executor.ts";

export interface UnityXcodeBuildOptions {
  xcodeProjectPath: string;
  configuration: BuildConfiguration;
}

export class UnityXcodeBuilder {
  constructor(private readonly log: LogStore) {}

  statusText(): string {
    return "Xcode build status is available through MCP task_status.\n";
  }

  async build(options: UnityXcodeBuildOptions): Promise<string> {
    const xcodeRoot = resolve(options.xcodeProjectPath);
    const workspacePath = join(xcodeRoot, "Unity-iPhone.xcworkspace");
    const projectPath = join(xcodeRoot, "Unity-iPhone.xcodeproj");
    const configuration = options.configuration === "debug" ? "Debug" : "Release";
    const buildRoot = join(appPilotConfig.paths.unityIosArtifactDir, "build");
    const derivedDataPath = join(buildRoot, "DerivedData");
    const productsDir = join(derivedDataPath, "Build", "Products", `${configuration}-iphoneos`);
    const logPath = resolve(appPilotConfig.paths.xcodeIosBuildLog);

    if (!existsSync(workspacePath) && !existsSync(projectPath)) {
      throw new Error(`Xcode project not found under ${xcodeRoot}. Run unity build first.`);
    }

    rmSync(derivedDataPath, { recursive: true, force: true });
    mkdirSync(appPilotConfig.paths.logRoot, { recursive: true });

    const projectArgs = existsSync(workspacePath)
      ? ["-workspace", workspacePath]
      : ["-project", projectPath];

    const result = await execFile("xcodebuild", [
      ...projectArgs,
      "-scheme",
      "Unity-iPhone",
      "-configuration",
      configuration,
      "-sdk",
      "iphoneos",
      "-destination",
      "generic/platform=iOS",
      "-derivedDataPath",
      derivedDataPath,
      "build",
    ], {
      timeoutMs: appPilotConfig.timeouts.xcodeBuildMs,
      logPath,
    });

    if (result.exitCode !== 0) {
      this.log.error("xcode ios build failed", { exitCode: result.exitCode, logPath });
      throw new Error(`Xcode iOS build failed. See ${logPath}.`);
    }

    const appPath = findBuiltApp(productsDir);
    this.log.log("xcode ios build succeeded", { appPath, logPath });
    return appPath;
  }
}

function findBuiltApp(outputDir: string): string {
  const match = readdirSync(outputDir)
    .filter((name) => name.endsWith(".app"))
    .map((name) => join(outputDir, name))
    .find((path) => existsSync(path));

  if (!match) {
    throw new Error(`Xcode build succeeded but no .app was found in ${outputDir}.`);
  }

  return match;
}
