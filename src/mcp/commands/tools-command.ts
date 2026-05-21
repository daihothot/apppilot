import { IOS_TOOLS_SETUP_LOG, TASK_STATUS_JSON } from "../../constants.ts";
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
        status: TASK_STATUS_JSON,
        log: IOS_TOOLS_SETUP_LOG,
        message: "iOS tools setup started. Call task_status until state is success or failed.",
      };
    },
  },
];
