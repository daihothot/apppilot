import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { APPPILOT_HOME, LOG_ROOT, UNITY_BUILD_TIMEOUT_MS } from "../../../constants.ts";
import type { BuildConfiguration } from "../../../types.ts";
import { LogStore } from "../../../log/log-store.ts";
import { execFile } from "../../../process/executor.ts";

export interface UnityAndroidBuildOptions {
  projectPath: string;
  configuration: BuildConfiguration;
  outputPath: string;
}

export class UnityAndroidBuilder {
  constructor(private readonly log: LogStore) {}

  statusText(): string {
    return "Unity Android build status is available through MCP task_status.\n";
  }

  async build(options: UnityAndroidBuildOptions): Promise<void> {
    const unityPath = this.findUnityExecutable(options.projectPath);
    const injectedScriptPath = this.injectBuildScript(options.projectPath);
    const logPath = resolve(LOG_ROOT, "unity-android-build.log");

    try {
      const result = await execFile(unityPath, [
        "-batchmode",
        "-quit",
        "-projectPath",
        options.projectPath,
        "-buildTarget",
        "Android",
        "-executeMethod",
        "AppPilot.UnityTools.AppPilotUnityBuild.BuildAndroidDevice",
        "-apppilotOutputPath",
        resolve(options.outputPath),
        "-apppilotConfiguration",
        options.configuration,
        "-logFile",
        logPath,
      ], { timeoutMs: UNITY_BUILD_TIMEOUT_MS });

      if (result.exitCode !== 0) {
        this.log.error("unity android apk build failed", { exitCode: result.exitCode, logPath });
        throw new Error(`Unity Android APK build failed. See ${logPath}.`);
      }

      this.log.log("unity android apk build succeeded", { logPath });
    } finally {
      this.removeInjectedBuildScript(injectedScriptPath);
    }
  }

  private injectBuildScript(projectPath: string): string {
    const targetDir = join(projectPath, "Assets", "Editor", "AppPilot");
    const targetPath = join(targetDir, "AppPilotUnityBuild.cs");
    mkdirSync(targetDir, { recursive: true });
    copyFileSync(this.readBuildScriptPath(), targetPath);
    this.log.log("unity android build script injected", { targetPath });
    return targetPath;
  }

  private readBuildScriptPath(): string {
    const candidates = [
      join(APPPILOT_HOME, "tools", "AppPilotUnityBuild.cs"),
      fileURLToPath(new URL("../tools/AppPilotUnityBuild.cs", import.meta.url)),
    ];
    const match = candidates.find((candidate) => existsSync(candidate));
    if (!match) {
      throw new Error("AppPilot Unity build script not found. Run apppilot tools setup --agent again.");
    }
    return match;
  }

  private removeInjectedBuildScript(scriptPath: string): void {
    rmSync(scriptPath, { force: true });
    rmSync(`${scriptPath}.meta`, { force: true });

    const scriptDir = dirname(scriptPath);
    if (existsSync(scriptDir) && readdirSync(scriptDir).length === 0) {
      rmSync(scriptDir, { recursive: true, force: true });
      rmSync(`${scriptDir}.meta`, { force: true });
    }

    this.log.log("unity android build script injection cleaned", { scriptPath });
  }

  private findUnityExecutable(projectPath: string): string {
    const version = this.readUnityVersion(projectPath);
    const hubRoot = "/Applications/Unity/Hub/Editor";
    if (version && existsSync(hubRoot)) {
      const candidates = readdirSync(hubRoot)
        .filter((name) => name === version || name.startsWith(`${version}-`))
        .map((name) => join(hubRoot, name, "Unity.app", "Contents", "MacOS", "Unity"));
      const match = candidates.find((candidate) => existsSync(candidate));
      if (match) return match;
    }

    const fallback = "/Applications/Unity/Unity.app/Contents/MacOS/Unity";
    if (existsSync(fallback)) return fallback;

    throw new Error("Unity executable not found. Install Unity with Unity Hub or set up the expected /Applications/Unity path.");
  }

  private readUnityVersion(projectPath: string): string | null {
    const versionPath = join(projectPath, "ProjectSettings", "ProjectVersion.txt");
    if (!existsSync(versionPath)) return null;
    const content = readFileSync(versionPath, "utf8");
    return content.match(/^m_EditorVersion:\s*(.+)$/m)?.[1]?.trim() ?? null;
  }
}
