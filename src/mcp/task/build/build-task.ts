import { closeSync, existsSync, openSync, readSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { LOG_ROOT, UNITY_IOS_BUILD_JSON, XCODE_IOS_BUILD_LOG } from "../../../constants.ts";
import { normalizeBuildTask, type BuildTask } from "../../../build/build-task.ts";
import { BuildRunner } from "../../../build/build-runner.ts";
import type { BuildArtifact } from "../../../types.ts";
import { BuildTaskStatusStore } from "./build-task-status-store.ts";

export async function runMcpBuildTask(rawTask = process.argv[2] ?? "{}"): Promise<void> {
  const task = normalizeBuildTask(JSON.parse(rawTask) as Record<string, unknown>);
  const status = new BuildTaskStatusStore();
  if (task.action === "xcode") {
    status.startXcodeBuild(resolve(XCODE_IOS_BUILD_LOG));
  } else {
    status.startUnityBuild(resolve(LOG_ROOT, "unity-ios-build.log"));
  }

  const timer = setInterval(() => updatePhase(task, status), 5000);
  timer.unref();

  try {
    const result = await new BuildRunner().run(task);
    updateArtifactMetadata(result, status);
    updatePhase(task, status);
    status.success();
  } catch (error) {
    updatePhase(task, status);
    status.failed();
    throw error;
  } finally {
    clearInterval(timer);
  }
}

if (process.argv[1]?.endsWith("src/mcp/task/build/build-task.ts")) {
  runMcpBuildTask().catch((error: unknown) => {
    process.stderr.write(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

function updateArtifactMetadata(result: unknown, status: BuildTaskStatusStore): void {
  if (!isBuildArtifact(result)) return;
  status.updateBuildMetadata({
    projectPath: result.xcodeProjectPath,
    xcodeProjectPath: result.xcodeProjectPath,
    appPath: result.appPath,
    artifact: UNITY_IOS_BUILD_JSON,
  });
}

function isBuildArtifact(value: unknown): value is BuildArtifact {
  return typeof value === "object" && value !== null && "xcodeProjectPath" in value;
}

function updatePhase(task: BuildTask, status: BuildTaskStatusStore): void {
  const current = status.read();
  if (!current || current.state !== "running") return;

  const text = readTail(current.log);
  status.update(task.action === "xcode" ? detectXcodePhase(text) : detectUnityPhase(text));
}

function detectUnityPhase(text: string): string {
  if (!text) return "starting";
  if (/Build Finished|Build succeeded/.test(text)) return "finishing";
  if (/SetLocal \[Pod\]|pod install|CocoaPods|Installing /.test(text)) return "cocoapods";
  if (/OnPostProcessBuild|PostProcess|XCode|PBXProject/.test(text)) return "postprocess";
  if (/IL2CPP|Il2CppOutputProject|libil2cpp/.test(text)) return "il2cpp";
  if (/Compiling shader|UnityShaderCompiler|Serialized binary data for shader/.test(text)) return "shader-compile";
  if (/Building Player|Build iOS device Xcode project|BuildPipeline\.BuildPlayer/.test(text)) return "unity-build";
  return "running";
}

function detectXcodePhase(text: string): string {
  if (!text) return "starting";
  if (/BUILD SUCCEEDED|Build succeeded/i.test(text)) return "finishing";
  if (/CodeSign|codesign|Provisioning|Signing|embedded.mobileprovision/.test(text)) return "codesign";
  if (/Ld |Linking|libtool/.test(text)) return "link";
  if (/CompileC|CompileSwift|SwiftCompile|ProcessPCH|PrecompileSwiftBridgingHeader/.test(text)) return "compile";
  if (/PhaseScriptExecution|Run custom shell script|ProcessInfoPlistFile|CopySwiftLibs/.test(text)) return "scripts";
  if (/CpResource|CopyPlistFile|CopyStringsFile|Copy /.test(text)) return "copy";
  if (/Resolve Package|Planning build|CreateBuildDirectory|Prepare packages/.test(text)) return "prepare";
  return "running";
}

function readTail(path: string, maxBytes = 64 * 1024): string {
  if (!existsSync(path)) return "";

  const size = statSync(path).size;
  const length = Math.min(size, maxBytes);
  const buffer = Buffer.alloc(length);
  const fd = openSync(path, "r");
  try {
    readSync(fd, buffer, 0, length, size - length);
  } finally {
    closeSync(fd);
  }
  return buffer.toString("utf8");
}
