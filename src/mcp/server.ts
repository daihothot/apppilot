import { runMcpBuildTask } from "./task/build/build-task.ts";
import { isIosToolsSetupTaskArg, runIosToolsSetupTask } from "./task/tools/ios-tools-setup-task.ts";
import { tools } from "./tools.ts";

interface JsonRpcRequest {
  jsonrpc?: string;
  id?: string | number | null;
  method: string;
  params?: unknown;
}

if (isIosToolsSetupTaskArg(process.argv[2])) {
  runIosToolsSetupTask().catch((error: unknown) => {
    process.stderr.write(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
} else if (process.argv[2] === "--apppilot-build-task") {
  runMcpBuildTask(process.argv[3] ?? "{}").catch((error: unknown) => {
    process.stderr.write(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
} else {
  startServer();
}

function startServer(): void {
  let buffer = Buffer.alloc(0);

  process.stdin.on("data", (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    drainMessages().catch((error) => writeError(null, -32603, error instanceof Error ? error.message : String(error)));
  });

  async function drainMessages(): Promise<void> {
    while (true) {
      const headerEnd = buffer.indexOf("\r\n\r\n");
      if (headerEnd === -1) return;

      const header = buffer.subarray(0, headerEnd).toString("utf8");
      const match = header.match(/Content-Length: *(\d+)/i);
      if (!match) {
        buffer = buffer.subarray(headerEnd + 4);
        continue;
      }

      const length = Number(match[1]);
      const bodyStart = headerEnd + 4;
      const bodyEnd = bodyStart + length;
      if (buffer.length < bodyEnd) return;

      const body = buffer.subarray(bodyStart, bodyEnd).toString("utf8");
      buffer = buffer.subarray(bodyEnd);
      await handleMessage(JSON.parse(body) as JsonRpcRequest);
    }
  }
}

async function handleMessage(request: JsonRpcRequest): Promise<void> {
  if (request.id === undefined || request.id === null) {
    return;
  }

  try {
    switch (request.method) {
      case "initialize":
        writeResult(request.id, {
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: { name: "apppilot", version: "0.1.0" },
        });
        return;
      case "tools/list":
        writeResult(request.id, {
          tools: tools.map((tool) => ({
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema,
          })),
        });
        return;
      case "tools/call":
        await callTool(request);
        return;
      default:
        writeError(request.id, -32601, "Method not found: " + request.method);
    }
  } catch (error) {
    writeError(request.id, -32603, error instanceof Error ? error.message : String(error));
  }
}

async function callTool(request: JsonRpcRequest): Promise<void> {
  const params = request.params as { name?: string; arguments?: Record<string, unknown> } | undefined;
  const tool = tools.find((candidate) => candidate.name === params?.name);
  if (!tool) {
    writeError(request.id ?? null, -32602, "Unknown tool: " + (params?.name ?? ""));
    return;
  }

  const result = await tool.call(params?.arguments ?? {});
  writeResult(request.id ?? null, {
    content: [toContent(result)],
  });
}

function toContent(value: unknown): { type: "text"; text: string } {
  if (typeof value === "string") {
    return { type: "text", text: value };
  }
  return { type: "text", text: JSON.stringify(value, null, 2) };
}

function writeResult(id: string | number | null | undefined, result: unknown): void {
  writeMessage({ jsonrpc: "2.0", id, result });
}

function writeError(id: string | number | null | undefined, code: number, message: string): void {
  writeMessage({ jsonrpc: "2.0", id, error: { code, message } });
}

function writeMessage(message: unknown): void {
  const body = JSON.stringify(message);
  process.stdout.write("Content-Length: " + Buffer.byteLength(body, "utf8") + "\r\n\r\n" + body);
}
