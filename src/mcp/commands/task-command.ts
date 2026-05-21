import { readTaskStatus } from "../status.ts";
import type { McpTool } from "../mcp-tool.ts";

export const taskTools: McpTool[] = [
  {
    name: "task_status",
    description: "Read the latest AppPilot long task status from log/status.json.",
    inputSchema: {
      type: "object",
      properties: {},
    },
    async call() {
      return readTaskStatus();
    },
  },
];
