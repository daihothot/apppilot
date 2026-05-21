import type { McpTool } from "./mcp-tool.ts";
import { buildTools } from "./commands/build-command.ts";
import { taskTools } from "./commands/task-command.ts";
import { executeTools } from "./commands/execute-command.ts";
import { logsTools } from "./commands/logs-command.ts";
import { globalTools } from "./commands/tools-command.ts";

export const tools: McpTool[] = [
  ...buildTools,
  ...taskTools,
  ...executeTools,
  ...logsTools,
  ...globalTools,
];
