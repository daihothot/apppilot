import { resolve } from "node:path";
import { LOG_ROOT, XCODE_IOS_BUILD_LOG } from "../../constants.ts";
import { normalizeBuildTask } from "../../build/build-task.ts";
import { BuildTaskStatusStore } from "../task/build/build-task-status-store.ts";
import { spawnMcpTask } from "../process.ts";
import type { McpTool } from "../mcp-tool.ts";

export const buildTools: McpTool[] = [
  {
    name: "unity_build",
    description: "Build a Unity project. platform=ios exports an Xcode project; platform=android builds an APK directly.",
    inputSchema: {
      type: "object",
      properties: {
        platform: { type: "string", enum: ["ios", "android"] },
        projectPath: { type: "string", description: "Unity project directory." },
        debug: { type: "boolean", default: true },
        refresh: { type: "boolean", default: true },
        buildRes: { type: "boolean", default: false },
      },
      required: ["platform", "projectPath"],
    },
    async call(input) {
      const task = normalizeBuildTask({
        adapter: "unity",
        platform: input.platform,
        action: "build",
        projectPath: input.projectPath,
        debug: input.debug,
        refresh: input.refresh,
        buildRes: input.buildRes,
        xcode: false,
      });
      new BuildTaskStatusStore().startUnityBuild(resolve(LOG_ROOT, task.platform === "android" ? "unity-android-build.log" : "unity-ios-build.log"), task.platform);
      spawnMcpTask(["src/mcp/task/build/build-task.ts", JSON.stringify(task)]);
      return "Unity build started. Call task_status until state is success or failed.";
    },
  },
  {
    name: "xcode_build",
    description: "Build an iOS Xcode project. projectPath may come from unity_build output/status; defaults to the latest Unity artifact.",
    inputSchema: {
      type: "object",
      properties: {
        platform: { type: "string", enum: ["ios"] },
        projectPath: { type: "string", description: "Xcode project directory, for example artifact/unity/ios/xcode. Optional when latest Unity artifact exists." },
      },
      required: ["platform"],
    },
    async call(input) {
      const task = normalizeBuildTask({
        adapter: "unity",
        platform: input.platform,
        action: "xcode",
        projectPath: input.projectPath,
      });
      new BuildTaskStatusStore().startXcodeBuild(resolve(XCODE_IOS_BUILD_LOG));
      spawnMcpTask(["src/mcp/task/build/build-task.ts", JSON.stringify(task)]);
      return "Xcode build started. Call task_status until state is success or failed.";
    },
  },
];
