import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { APP_LOG_ANDROID_DIR, APP_LOG_IOS_DIR, OFFLINE_LOG_DIR_NAME } from "../../constants.ts";
import { ExecutorFactory } from "../../factory/executor-factory.ts";
import { LogStore, type LogClearScope } from "../../log/log-store.ts";
import type { Platform } from "../../types.ts";
import type { McpTool } from "../mcp-tool.ts";
import { requireString } from "../mcp-tool.ts";
import { projectRoot } from "../project.ts";

export const logsTools: McpTool[] = [
  {
    name: "log_clear",
    description: "Clear AppPilot local logs. Scope defaults to all; device logs are not cleared.",
    inputSchema: {
      type: "object",
      properties: {
        scope: { type: "string", enum: ["all", "unity", "xcode", "ios"], default: "all" },
      },
    },
    async call(input) {
      const scope = readLogClearScope(input.scope);
      new LogStore().clear(scope);
      return "cleared " + scope + " logs";
    },
  },
  {
    name: "logs_dump",
    description: "Pull app logs from a device. iOS uses the fixed gurusdk log directory; Android dumps `adb logcat -d` and applies optional match filtering.",
    inputSchema: {
      type: "object",
      properties: {
        platform: { type: "string", enum: ["ios", "android"] },
        device: { type: "string", description: "iOS device UDID or Android adb serial." },
        offset: { type: "number", default: 0 },
        match: { type: "string" },
      },
      required: ["platform", "device"],
    },
    async call(input) {
      const platform = requireSupportedPlatform(requireString(input, "platform"));
      const device = requireString(input, "device");
      const offset = Number.isFinite(input.offset) ? String(input.offset) : "0";
      const match = typeof input.match === "string" && input.match.length > 0 ? input.match : undefined;
      await new ExecutorFactory().createLogsExecutor(platform).dump(device, offset, match);
      return {
        message: "logs dumped.",
        artifactRoot: platform === "android" ? APP_LOG_ANDROID_DIR + "/logcat" : APP_LOG_IOS_DIR + "/" + OFFLINE_LOG_DIR_NAME,
      };
    },
  },
  {
    name: "read_app_log_artifact",
    description: "Read a small AppPilot artifact text file by relative path.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Relative path under the project root." },
      },
      required: ["path"],
    },
    async call(input) {
      const relativePath = requireString(input, "path");
      if (relativePath.startsWith("/") || relativePath.includes("..")) {
        throw new Error("Path must be a safe project-relative path.");
      }
      return readFileSync(resolve(projectRoot(), relativePath), "utf8");
    },
  },
];

function readLogClearScope(value: unknown): LogClearScope {
  if (value === undefined || value === null) {
    return "all";
  }
  if (value === "all" || value === "unity" || value === "xcode" || value === "ios") {
    return value;
  }
  throw new Error("Invalid log clear scope. Expected all, unity, xcode, or ios.");
}

function requireSupportedPlatform(platform: string): Platform {
  if (platform === "ios" || platform === "android") {
    return platform;
  }
  throw new Error("Unsupported logs platform: " + platform);
}
