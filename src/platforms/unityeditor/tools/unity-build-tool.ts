import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { HostCommandExecutor } from "../../../host/host-command-executor.ts";
import type { AppPilotResult, BuildArtifact, BuildRequest } from "../../../core/port/app-pilot-operation-port.ts";
import { invalidArgument } from "../../../core/port/app-pilot-errors.ts";
import { XcodeBuildTool } from "../../ios/tools/xcode-build-tool.ts";

export class UnityBuildTool {
  private readonly hostCommands = new HostCommandExecutor();

  constructor(private readonly xcode = new XcodeBuildTool()) {}

  async build(request: BuildRequest): Promise<AppPilotResult<BuildArtifact>> {
    if (!request.projectPath?.trim()) return invalidArgument("projectPath");
    if (!request.outputPath?.trim()) return invalidArgument("outputPath");
    const projectPath = resolve(request.projectPath);
    if (!existsSync(projectPath)) throw new Error(`Unity project does not exist: ${projectPath}`);
    const outputPath = resolve(request.outputPath);
    const configuration = request.configuration ?? "debug";
    const append = request.append ?? false;
    if (request.platform === "ios") {
      if (!append) rmSync(outputPath, { recursive: true, force: true });
      mkdirSync(outputPath, { recursive: true });
      await this.runUnity(projectPath, outputPath, configuration, append, "iOS", "BuildIOSDevice");
      const appPath = request.buildNative
        ? await this.xcode.build(outputPath, configuration)
        : undefined;
      return { ok: true, value: {
        platform: "ios",
        projectPath,
        outputPath,
        ...(appPath ? { appPath } : {}),
        appId: this.readAppId(projectPath, "iPhone"),
      } };
    }

    if (request.platform !== "android") throw new Error(`Unity build does not support platform ${request.platform}.`);
    mkdirSync(dirname(outputPath), { recursive: true });
    await this.runUnity(projectPath, outputPath, configuration, append, "Android", "BuildAndroidDevice");
    return { ok: true, value: {
      platform: "android",
      projectPath,
      outputPath,
      appPath: outputPath,
      appId: this.readAppId(projectPath, "Android"),
    } };
  }

  private async runUnity(
    projectPath: string,
    outputPath: string,
    configuration: "debug" | "release",
    append: boolean,
    buildTarget: "iOS" | "Android",
    method: "BuildIOSDevice" | "BuildAndroidDevice",
  ): Promise<void> {
    const unity = this.findUnityExecutable(projectPath);
    const injected = this.injectBuildScript(projectPath);
    const logPath = join(homedir(), ".apppilot", "log", `unity-${buildTarget.toLowerCase()}-build.log`);
    try {
      const result = await this.hostCommands.run({ executable: unity, args: [
        "-batchmode", "-quit", "-projectPath", projectPath,
        "-buildTarget", buildTarget,
        "-executeMethod", `AppPilot.UnityTools.AppPilotUnityBuild.${method}`,
        "-apppilotOutputPath", outputPath,
        "-apppilotConfiguration", configuration,
        "-apppilotAppend", append ? "true" : "false",
        "-logFile", logPath,
      ], timeoutMs: 30 * 60 * 1_000 });
      if (result.exitCode !== 0) throw new Error(`Unity ${buildTarget} build failed. See ${logPath}.`);
    } finally {
      this.removeBuildScript(injected);
    }
  }

  private injectBuildScript(projectPath: string): string {
    const targetDir = join(projectPath, "Assets", "Editor", "AppPilot");
    const targetPath = join(targetDir, "AppPilotUnityBuild.cs");
    mkdirSync(targetDir, { recursive: true });
    copyFileSync(this.buildScriptPath(), targetPath);
    return targetPath;
  }

  private buildScriptPath(): string {
    const candidates = [
      join(homedir(), ".apppilot", "tools", "AppPilotUnityBuild.cs"),
      fileURLToPath(new URL("../../../platforms/unityeditor/tools/AppPilotUnityBuild.cs", import.meta.url)),
    ];
    const path = candidates.find(existsSync);
    if (!path) throw new Error("AppPilot Unity build script was not found. Run apppilot setup --plugin.");
    return path;
  }

  private removeBuildScript(path: string): void {
    rmSync(path, { force: true });
    rmSync(`${path}.meta`, { force: true });
    const directory = dirname(path);
    if (existsSync(directory) && readdirSync(directory).length === 0) {
      rmSync(directory, { recursive: true, force: true });
      rmSync(`${directory}.meta`, { force: true });
    }
  }

  private findUnityExecutable(projectPath: string): string {
    const versionPath = join(projectPath, "ProjectSettings", "ProjectVersion.txt");
    const version = existsSync(versionPath)
      ? readFileSync(versionPath, "utf8").match(/^m_EditorVersion:\s*(.+)$/m)?.[1]?.trim()
      : undefined;
    const hub = "/Applications/Unity/Hub/Editor";
    if (version && existsSync(hub)) {
      const match = readdirSync(hub)
        .filter((name) => name === version || name.startsWith(`${version}-`))
        .map((name) => join(hub, name, "Unity.app", "Contents", "MacOS", "Unity"))
        .find(existsSync);
      if (match) return match;
    }
    const fallback = "/Applications/Unity/Unity.app/Contents/MacOS/Unity";
    if (existsSync(fallback)) return fallback;
    throw new Error("Unity executable was not found.");
  }

  private readAppId(projectPath: string, key: "iPhone" | "Android"): string {
    const settings = join(projectPath, "ProjectSettings", "ProjectSettings.asset");
    const content = readFileSync(settings, "utf8");
    const scoped = content.match(new RegExp(`^    ${key}:\\s*([A-Za-z0-9_.-]+)$`, "m"))?.[1];
    const direct = content.match(/^  applicationIdentifier:[ \t]*([^\n\r]*)$/m)?.[1]?.trim();
    const value = scoped ?? (direct && !direct.includes("{") ? direct : undefined);
    if (!value) throw new Error(`Application id ${key} was not found in ${settings}.`);
    return value;
  }
}
