import { appPilotConfig } from "../../config/app-pilot-config.ts";
import { spawnIosToolsSetupTask } from "../task/tools/ios-tools-setup-task.ts";
import type { McpTool } from "../mcp-tool.ts";
import { requireString } from "../mcp-tool.ts";

export const globalTools: McpTool[] = [
  {
    name: "tools_setup",
    description: "Set up local helper tools. Currently supports platform=ios.",
    inputSchema: {
      type: "object",
      properties: {
        platform: { type: "string", enum: ["ios"] },
      },
      required: ["platform"],
    },
    async call(input) {
      const platform = requireString(input, "platform");
      if (platform !== "ios") {
        throw new Error("Unsupported tools setup platform: " + platform);
      }

      spawnIosToolsSetupTask();
      return {
        platform,
        status: appPilotConfig.paths.taskStatusJson,
        log: appPilotConfig.paths.iosToolsSetupLog,
        message: "iOS tools setup started. Call task_status until state is success or failed.",
      };
    },
  },
];
