import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { UNITY_IOS_XCODE_DIR } from "../../constants.ts";
import type { BuildArtifact, BuildConfiguration } from "../../types.ts";
import { LogStore } from "../../log/log-store.ts";
import { BuildArtifactStore } from "../../artifact/build-artifact-store.ts";
import { UnityIosBuilder } from "./ios/unity-ios-builder.ts";
import { UnityXcodeBuilder } from "./ios/unity-xcode-builder.ts";

export interface UnityAdapterOptions {
  projectDir: string;
  ios: boolean;
  debug: boolean;
  buildRes: boolean;
  build: boolean;
  refreshBuild: boolean;
}

export class UnityAdapter {
  private readonly log: LogStore;
  private readonly artifacts: BuildArtifactStore;
  private readonly iosBuilder: UnityIosBuilder;
  private readonly xcodeBuilder: UnityXcodeBuilder;

  constructor(log: LogStore, artifacts: BuildArtifactStore) {
    this.log = log;
    this.artifacts = artifacts;
    this.iosBuilder = new UnityIosBuilder(log);
    this.xcodeBuilder = new UnityXcodeBuilder(log);
  }

  async prepare(options: UnityAdapterOptions): Promise<BuildArtifact> {
    if (!options.ios) {
      throw new Error("Unity adapter currently requires --ios.");
    }
    if (options.build && options.refreshBuild) {
      throw new Error("--build and --refresh-build are mutually exclusive.");
    }

    const projectPath = resolve(options.projectDir);
    if (!existsSync(projectPath)) {
      throw new Error(`Unity project does not exist: ${projectPath}`);
    }

    const configuration: BuildConfiguration = options.debug ? "debug" : "release";
    if (options.refreshBuild && existsSync(UNITY_IOS_XCODE_DIR)) {
      this.log.log("refreshing unity ios xcode artifact", { path: UNITY_IOS_XCODE_DIR });
      rmSync(UNITY_IOS_XCODE_DIR, { recursive: true, force: true });
    }

    mkdirSync(UNITY_IOS_XCODE_DIR, { recursive: true });

    if (options.buildRes) {
      this.log.log("unity build resources requested");
    }
    if (options.build || options.refreshBuild) {
      this.log.log("unity build requested", { configuration, projectPath });
      await this.iosBuilder.build({
        projectPath,
        configuration,
        outputPath: UNITY_IOS_XCODE_DIR,
        append: !options.refreshBuild,
      });
    } else {
      this.log.log("unity build skipped; recording context only", { projectPath });
    }

    const bundleId = this.readBundleId(projectPath) ?? "com.company.game";
    const artifact: BuildArtifact = {
      adapter: "unity",
      platform: "ios",
      configuration,
      projectPath,
      xcodeProjectPath: UNITY_IOS_XCODE_DIR,
      appPath: this.findAppPath(),
      bundleId,
      builtAt: new Date().toISOString(),
    };

    this.artifacts.writeUnityIosBuild(artifact);
    this.log.log("unity ios build artifact written", artifact);
    return artifact;
  }

  statusText(): string {
    return this.iosBuilder.statusText();
  }

  xcodeStatusText(): string {
    return this.xcodeBuilder.statusText();
  }

  async buildXcodeFromArtifact(xcodeProjectPath?: string): Promise<BuildArtifact> {
    const artifact = this.artifacts.readUnityIosBuild();
    const appPath = await this.xcodeBuilder.build({
      xcodeProjectPath: xcodeProjectPath ?? artifact.xcodeProjectPath,
      configuration: artifact.configuration,
    });
    const nextArtifact = {
      ...artifact,
      xcodeProjectPath: xcodeProjectPath ?? artifact.xcodeProjectPath,
      appPath,
      builtAt: new Date().toISOString(),
    };
    this.artifacts.writeUnityIosBuild(nextArtifact);
    return nextArtifact;
  }

  private findAppPath(): string {
    return join(UNITY_IOS_XCODE_DIR, "build", "App.app");
  }

  private readBundleId(projectPath: string): string | null {
    const settingsPath = join(projectPath, "ProjectSettings", "ProjectSettings.asset");
    if (!existsSync(settingsPath)) {
      this.log.warning("unity ProjectSettings.asset not found; using fallback bundle id", { settingsPath });
      return null;
    }

    const content = readFileSync(settingsPath, "utf8");
    const directMatch = content.match(/^  applicationIdentifier:[ \t]*([^\n\r]*)$/m);
    if (directMatch) {
      const value = directMatch[1]?.trim();
      if (value && !value.includes("{")) {
        return value;
      }
    }

    const iosMatch = content.match(/^    iPhone:\s*([A-Za-z0-9_.-]+)$/m);
    if (iosMatch?.[1]) {
      return iosMatch[1];
    }

    this.log.warning("bundle id not found in ProjectSettings.asset; using fallback bundle id");
    return null;
  }
}
