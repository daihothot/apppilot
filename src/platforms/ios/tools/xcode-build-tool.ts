import { existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { HostCommandExecutor } from "../../../host/host-command-executor.ts";

export class XcodeBuildTool {
  private readonly hostCommands = new HostCommandExecutor();

  async build(xcodeProjectPath: string, configuration: "debug" | "release"): Promise<string> {
    const root = resolve(xcodeProjectPath);
    const workspace = join(root, "Unity-iPhone.xcworkspace");
    const project = join(root, "Unity-iPhone.xcodeproj");
    if (!existsSync(workspace) && !existsSync(project)) throw new Error(`Xcode project not found under ${root}.`);
    const buildConfiguration = configuration === "debug" ? "Debug" : "Release";
    const derivedData = join(root, "build", "DerivedData");
    const products = join(derivedData, "Build", "Products", `${buildConfiguration}-iphoneos`);
    const logRoot = join(homedir(), ".apppilot", "log");
    const logPath = join(logRoot, "xcode-ios-build.log");
    rmSync(derivedData, { recursive: true, force: true });
    mkdirSync(logRoot, { recursive: true });
    const selector = existsSync(workspace) ? ["-workspace", workspace] : ["-project", project];
    const result = await this.hostCommands.run({
      executable: "xcodebuild",
      args: [
        ...selector, "-scheme", "Unity-iPhone", "-configuration", buildConfiguration,
        "-sdk", "iphoneos", "-destination", "generic/platform=iOS",
        "-derivedDataPath", derivedData, "build",
      ],
      timeoutMs: 30 * 60 * 1_000,
      logPath,
    });
    if (result.exitCode !== 0) throw new Error(`Xcode build failed. See ${logPath}.`);
    const appPath = readdirSync(products)
      .filter((name) => name.endsWith(".app"))
      .map((name) => join(products, name))
      .find(existsSync);
    if (!appPath) throw new Error(`Xcode build produced no .app under ${products}.`);
    return appPath;
  }
}
