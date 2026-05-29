import { homedir } from "node:os";
import { join } from "node:path";

export interface AppPilotConfig {
  readonly paths: {
    readonly home: string;
    readonly logRoot: string;
    readonly artifactRoot: string;
    readonly taskStatusJson: string;
    readonly xcodeIosBuildLog: string;
    readonly iosToolsSetupLog: string;
    readonly mcpExecutable: string;
    readonly mcpCallExecutable: string;
    readonly toolsRoot: string;
    readonly localPythonVenvDir: string;
    readonly localPythonBin: string;
    readonly localPymobiledevice3: string;
    readonly unityIosArtifactDir: string;
    readonly unityIosXcodeDir: string;
    readonly unityIosBuildJson: string;
    readonly unityAndroidArtifactDir: string;
    readonly unityAndroidApkPath: string;
    readonly unityAndroidBuildJson: string;
    readonly appLogIosDir: string;
    readonly appLogAndroidDir: string;
  };
  readonly timeouts: {
    readonly unityBuildMs: number;
    readonly xcodeBuildMs: number;
  };
  readonly ios: {
    readonly wdaDefaultUrl: string;
  };
  readonly offlineLogs: {
    readonly rootPath: string;
    readonly dirName: string;
  };
}

const home = join(homedir(), ".apppilot");
const logRoot = join(home, "log");
const artifactRoot = join(home, "artifact");
const toolsRoot = join(home, ".tools");
const localPythonVenvDir = join(toolsRoot, "python", "venv");
const unityIosArtifactDir = join(artifactRoot, "unity", "ios");
const unityAndroidArtifactDir = join(artifactRoot, "unity", "android");

export const appPilotConfig: AppPilotConfig = {
  paths: {
    home,
    logRoot,
    artifactRoot,
    taskStatusJson: join(logRoot, "status.json"),
    xcodeIosBuildLog: join(logRoot, "xcode-ios-build.log"),
    iosToolsSetupLog: join(logRoot, "tools-ios-setup.log"),
    mcpExecutable: join(home, "apppilot-mcp"),
    mcpCallExecutable: join(home, "apppilot-mcp-call"),
    toolsRoot,
    localPythonVenvDir,
    localPythonBin: join(localPythonVenvDir, "bin", "python"),
    localPymobiledevice3: join(localPythonVenvDir, "bin", "pymobiledevice3"),
    unityIosArtifactDir,
    unityIosXcodeDir: join(unityIosArtifactDir, "xcode"),
    unityIosBuildJson: join(unityIosArtifactDir, "unity-build.json"),
    unityAndroidArtifactDir,
    unityAndroidApkPath: join(unityAndroidArtifactDir, "app.apk"),
    unityAndroidBuildJson: join(unityAndroidArtifactDir, "unity-build.json"),
    appLogIosDir: join(artifactRoot, "logs", "ios"),
    appLogAndroidDir: join(artifactRoot, "logs", "android"),
  },
  timeouts: {
    unityBuildMs: 30 * 60 * 1000,
    xcodeBuildMs: 30 * 60 * 1000,
  },
  ios: {
    wdaDefaultUrl: "http://localhost:8100",
  },
  offlineLogs: {
    rootPath: "Library/Caches/Logs",
    dirName: "gurusdk",
  },
};
