#!/usr/bin/env bun
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { appPilotConfig } from "../config/app-pilot-config.ts";

const DEFAULT_MCP = appPilotConfig.paths.mcpExecutable;
const DEFAULT_CWD = appPilotConfig.paths.home;

interface JsonRpcMessage {
  jsonrpc: "2.0";
  id?: number;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args.shift();

  if (!command || command === "help" || command === "--help" || command === "-h") {
    printHelp();
    return;
  }

  if (command === "list") {
    printResult(await request("tools/list", {}));
    return;
  }

  if (command === "call") {
    const tool = args.shift();
    if (!tool) {
      throw new Error("Missing tool name. Usage: apppilot-mcp-call call <tool> [json]");
    }
    printResult(await callTool(tool, readJsonArg(args[0] ?? "{}")));
    return;
  }

  const toolCall = parseShortcut(command, args);
  printResult(await callTool(toolCall.name, toolCall.input));
}

function parseShortcut(command: string, args: string[]): { name: string; input: Record<string, unknown> } {
  if (command === "unity-build") {
    return {
      name: "unity_build",
      input: {
        platform: readOption(args, "--platform") ?? "ios",
        projectPath: requireOption(args, "--project-path"),
        debug: !args.includes("--release"),
        refresh: readBooleanOption(args, "--refresh", true),
        buildRes: readBooleanOption(args, "--build-res", false),
      },
    };
  }

  if (command === "xcode-build") {
    const projectPath = readOption(args, "--project-path");
    return {
      name: "xcode_build",
      input: {
        platform: readOption(args, "--platform") ?? "ios",
        ...(projectPath ? { projectPath } : {}),
      },
    };
  }

  if (command === "task-status") {
    return { name: "task_status", input: {} };
  }

  if (command === "execute") {
    const domain = requireOption(args, "--domain");
    const action = requireOption(args, "--action");
    const input: Record<string, unknown> = {
      platform: readOption(args, "--platform") ?? "ios",
      domain,
      action,
    };
    copyStringOption(args, input, "--device", "device");
    const env = readLaunchEnv(args);
    if (Object.keys(env).length > 0) {
      input.env = env;
    }
    const appPilot = readAppPilotLaunchOptions(args);
    if (appPilot) {
      input.appPilot = appPilot;
    }
    const intent = readAndroidIntent(args);
    if (intent) {
      input.intent = intent;
    }
    const params = readOption(args, "--params");
    if (params) {
      input.params = readJsonArg(params);
    }
    copyStringOption(args, input, "--method", "method");
    copyNumberOption(args, input, "--x", "x");
    copyNumberOption(args, input, "--y", "y");
    copyNumberOption(args, input, "--from-x", "fromX");
    copyNumberOption(args, input, "--from-y", "fromY");
    copyNumberOption(args, input, "--to-x", "toX");
    copyNumberOption(args, input, "--to-y", "toY");
    return { name: "execute", input };
  }

  if (command === "log-clear") {
    return {
      name: "log_clear",
      input: {
        scope: readOption(args, "--scope") ?? "all",
      },
    };
  }

  if (command === "logs-dump") {
    const input: Record<string, unknown> = {
      platform: readOption(args, "--platform") ?? "ios",
      device: requireOption(args, "--device"),
      offset: Number(readOption(args, "--offset") ?? "0"),
    };
    copyStringOption(args, input, "--match", "match");
    return { name: "logs_dump", input };
  }

  if (command === "read-app-log-artifact") {
    return {
      name: "read_app_log_artifact",
      input: {
        path: requireOption(args, "--path"),
      },
    };
  }

  if (command === "tools-setup") {
    return {
      name: "tools_setup",
      input: {
        platform: readOption(args, "--platform") ?? "ios",
      },
    };
  }

  throw new Error("Unknown command: " + command);
}

async function callTool(name: string, input: Record<string, unknown>): Promise<unknown> {
  const result = await request("tools/call", {
    name,
    arguments: input,
  });

  if (isToolCallResult(result)) {
    if (result.isError) {
      throw new Error(result.content.map(readContentText).join("\n"));
    }
    if (result.content.length === 1) {
      return parseContentText(readContentText(result.content[0]));
    }
    return result.content.map((content) => parseContentText(readContentText(content)));
  }

  return result;
}

async function request(method: string, params: unknown): Promise<unknown> {
  const mcpPath = process.env.APPPILOT_MCP_PATH ?? DEFAULT_MCP;
  if (!existsSync(mcpPath)) {
    throw new Error("AppPilot server executable not found: " + mcpPath + ". Run apppilot tools setup --agent first.");
  }

  const child = spawn(mcpPath, [], {
    cwd: process.env.APPPILOT_HOME ?? DEFAULT_CWD,
    stdio: ["pipe", "pipe", "pipe"],
  });

  const stdoutChunks: Buffer[] = [];
  const stderrChunks: Buffer[] = [];
  child.stdout.on("data", (chunk) => stdoutChunks.push(Buffer.from(chunk)));
  child.stderr.on("data", (chunk) => stderrChunks.push(Buffer.from(chunk)));

  try {
    writeMessage(child, {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "apppilot-mcp-call", version: "0.1.0" },
      },
    });
    writeMessage(child, { jsonrpc: "2.0", id: 2, method, params });

    const messages = await waitForMessages(child, stdoutChunks, stderrChunks, 2);
    const response = messages.find((message) => message.id === 2);
    if (!response) {
      throw new Error("No JSON-RPC response for " + method);
    }
    if (response.error) {
      throw new Error(response.error.message);
    }
    return response.result;
  } finally {
    child.kill();
  }
}

function writeMessage(child: ReturnType<typeof spawn>, message: JsonRpcMessage): void {
  if (!child.stdin) {
    throw new Error("AppPilot MCP process stdin is not available.");
  }

  const body = JSON.stringify(message);
  child.stdin.write("Content-Length: " + Buffer.byteLength(body, "utf8") + "\r\n\r\n" + body);
}

type NodeBuffer = Buffer<ArrayBufferLike>;

async function waitForMessages(
  child: ReturnType<typeof spawn>,
  stdoutChunks: NodeBuffer[],
  stderrChunks: NodeBuffer[],
  expectedResponseId: number,
): Promise<JsonRpcMessage[]> {
  const deadline = Date.now() + Number(process.env.APPPILOT_MCP_CALL_TIMEOUT_MS ?? "30000");
  let buffer: NodeBuffer = Buffer.alloc(0);
  const messages: JsonRpcMessage[] = [];

  while (Date.now() < deadline) {
    if (stdoutChunks.length > 0) {
      buffer = Buffer.concat([buffer, ...stdoutChunks.splice(0)]);
      const parsed = parseMessages(buffer);
      buffer = parsed.rest;
      messages.push(...parsed.messages);
      if (messages.some((message) => message.id === expectedResponseId)) {
        return messages;
      }
    }

    if (child.exitCode !== null) {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }

  const stderr = Buffer.concat(stderrChunks).toString("utf8").trim();
  if (stderr) {
    throw new Error(stderr);
  }
  throw new Error("Timed out waiting for AppPilot tool response.");
}

function parseMessages(buffer: NodeBuffer): { messages: JsonRpcMessage[]; rest: NodeBuffer } {
  const messages: JsonRpcMessage[] = [];
  let rest = buffer;

  while (true) {
    const headerEnd = rest.indexOf("\r\n\r\n");
    if (headerEnd === -1) {
      return { messages, rest };
    }

    const header = rest.subarray(0, headerEnd).toString("utf8");
    const lengthMatch = header.match(/Content-Length:\s*(\d+)/i);
    if (!lengthMatch) {
      throw new Error("Invalid AppPilot tool response header: " + header);
    }

    const bodyLength = Number(lengthMatch[1]);
    const bodyStart = headerEnd + 4;
    const bodyEnd = bodyStart + bodyLength;
    if (rest.length < bodyEnd) {
      return { messages, rest };
    }

    messages.push(JSON.parse(rest.subarray(bodyStart, bodyEnd).toString("utf8")) as JsonRpcMessage);
    rest = rest.subarray(bodyEnd);
  }
}

function readOptions(args: string[], name: string): string[] {
  const values: string[] = [];
  for (let index = 0; index < args.length; index++) {
    if (args[index] !== name) continue;
    const value = args[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error("Missing value for " + name);
    }
    values.push(value);
  }
  return values;
}

function readOption(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index === -1) return undefined;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error("Missing value for " + name);
  }
  return value;
}

function requireOption(args: string[], name: string): string {
  const value = readOption(args, name);
  if (!value) {
    throw new Error("Missing required option " + name);
  }
  return value;
}

function readBooleanOption(args: string[], name: string, defaultValue: boolean): boolean {
  if (args.includes(name)) return true;
  if (args.includes("--no-" + name.slice(2))) return false;
  return defaultValue;
}

function readLaunchEnv(args: string[]): Record<string, string> {
  const env: Record<string, string> = {};
  for (const item of readOptions(args, "--env")) {
    const equals = item.indexOf("=");
    if (equals <= 0) {
      throw new Error("Invalid --env value " + item + ". Expected KEY=VALUE.");
    }
    env[item.slice(0, equals)] = item.slice(equals + 1);
  }
  return env;
}

function readAppPilotLaunchOptions(args: string[]): Record<string, unknown> | undefined {
  const enabled = args.includes("--apppilot") || args.includes("--apppilot-enable");
  const rootName = readOption(args, "--apppilot-root");
  const port = readOption(args, "--apppilot-port");
  const waitMs = readOption(args, "--apppilot-wait-ms");
  if (!enabled && !rootName && !port && !waitMs) {
    return undefined;
  }
  return {
    enabled: true,
    ...(rootName ? { rootName } : {}),
    ...(port ? { port: parseNumberOption("--apppilot-port", port) } : {}),
    ...(waitMs ? { waitMs: parseNumberOption("--apppilot-wait-ms", waitMs) } : {}),
  };
}

function parseNumberOption(option: string, value: string): number {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new Error(option + " must be a finite number.");
  }
  return number;
}

function readAndroidIntent(args: string[]): Record<string, unknown> | undefined {
  const intent: Record<string, unknown> = {};
  copyStringOption(args, intent, "--component", "component");
  copyStringOption(args, intent, "--intent-action", "action");
  copyStringOption(args, intent, "--data", "data");
  copyStringOption(args, intent, "--mime-type", "mimeType");

  const categories = readOptions(args, "--category");
  if (categories.length > 0) intent.categories = categories;

  const flags = readOptions(args, "--flag");
  if (flags.length > 0) intent.flags = flags;

  const extras = [
    ...readAndroidExtras(args, "--es", "string"),
    ...readAndroidExtras(args, "--ei", "int"),
    ...readAndroidExtras(args, "--el", "long"),
    ...readAndroidExtras(args, "--ef", "float"),
    ...readAndroidExtras(args, "--ez", "boolean"),
    ...readAndroidExtras(args, "--esa", "string-array"),
    ...readAndroidExtras(args, "--eia", "int-array"),
  ];
  if (extras.length > 0) intent.extras = extras;

  return Object.keys(intent).length > 0 ? intent : undefined;
}

function readAndroidExtras(args: string[], option: string, type: string): Array<{ type: string; key: string; value: unknown }> {
  return readExtraPairs(args, option).map(([key, value]) => ({
    type,
    key,
    value: parseAndroidExtraValue(type, value),
  }));
}

function readExtraPairs(args: string[], option: string): Array<[string, string]> {
  const pairs: Array<[string, string]> = [];
  for (let index = 0; index < args.length; index++) {
    if (args[index] !== option) continue;
    const key = args[index + 1];
    const value = args[index + 2];
    if (!key || key.startsWith("--") || !value || value.startsWith("--")) {
      throw new Error(`${option} requires KEY VALUE.`);
    }
    pairs.push([key, value]);
  }
  return pairs;
}

function parseAndroidExtraValue(type: string, value: string): unknown {
  if (type === "int" || type === "long" || type === "float") {
    return Number(value);
  }
  if (type === "boolean") {
    if (value !== "true" && value !== "false") {
      throw new Error("Boolean Android extras must be true or false.");
    }
    return value === "true";
  }
  if (type === "string-array") {
    return value.split(",").filter((item) => item.length > 0);
  }
  if (type === "int-array") {
    return value.split(",").filter((item) => item.length > 0).map((item) => Number(item));
  }
  return value;
}

function copyStringOption(args: string[], input: Record<string, unknown>, option: string, key: string): void {
  const value = readOption(args, option);
  if (value !== undefined) {
    input[key] = value;
  }
}

function copyNumberOption(args: string[], input: Record<string, unknown>, option: string, key: string): void {
  const value = readOption(args, option);
  if (value !== undefined) {
    const number = Number(value);
    if (!Number.isFinite(number)) {
      throw new Error(option + " must be a finite number.");
    }
    input[key] = number;
  }
}

function readJsonArg(value: string): Record<string, unknown> {
  const parsed = JSON.parse(value);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("JSON input must be an object.");
  }
  return parsed as Record<string, unknown>;
}

function isToolCallResult(value: unknown): value is { content: Array<{ type: string; text?: string }>; isError?: boolean } {
  return Boolean(value && typeof value === "object" && Array.isArray((value as { content?: unknown }).content));
}

function readContentText(content: { type: string; text?: string }): string {
  if (content.type !== "text") {
    return JSON.stringify(content);
  }
  return content.text ?? "";
}

function parseContentText(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function printResult(value: unknown): void {
  if (typeof value === "string") {
    console.log(value);
    return;
  }
  console.log(JSON.stringify(value, null, 2));
}

function printHelp(): void {
  console.log(`AppPilot tool call helper

Usage:
  apppilot-mcp-call list
  apppilot-mcp-call call <tool> '<json>'
  apppilot-mcp-call unity-build --project-path <UNITY_DIR> [--platform ios|android] [--release] [--refresh|--no-refresh] [--build-res]
  apppilot-mcp-call xcode-build [--project-path <XCODE_DIR>] [--platform ios]
  apppilot-mcp-call task-status
  apppilot-mcp-call execute --platform ios --domain app --action devices
  apppilot-mcp-call execute --platform ios --domain app --action run --device <UDID> [--env KEY=VALUE] [--apppilot-root ROOT]
  apppilot-mcp-call execute --platform ios --domain app --action stop --device <UDID>
  apppilot-mcp-call execute --platform android --domain app --action devices
  apppilot-mcp-call execute --platform android --domain app --action run --device <SERIAL> [--apppilot-root ROOT] [--component PACKAGE/.Activity] [--intent-action ACTION] [--data URI] [--mime-type TYPE] [--category CATEGORY] [--flag FLAG] [--es KEY VALUE] [--ei KEY VALUE] [--el KEY VALUE] [--ef KEY VALUE] [--ez KEY true|false] [--esa KEY a,b,c] [--eia KEY 1,2,3]
  apppilot-mcp-call execute --platform android --domain app --action stop --device <SERIAL>
  apppilot-mcp-call execute --platform ios --domain action --action tap --device <UDID> --x <X> --y <Y>
  apppilot-mcp-call execute --platform ios --domain action --action swipe --device <UDID> --from-x <X> --from-y <Y> --to-x <X> --to-y <Y>
  apppilot-mcp-call execute --platform android --domain action --action tap --device <SERIAL> --x <X> --y <Y>
  apppilot-mcp-call execute --platform android --domain action --action swipe --device <SERIAL> --from-x <X> --from-y <Y> --to-x <X> --to-y <Y>
  apppilot-mcp-call execute --domain apppilot --action status
  apppilot-mcp-call execute --domain apppilot --action queryNodes --params '{"rootPath":"","depth":1,"select":["children"]}'
  apppilot-mcp-call log-clear [--scope all|unity|xcode|ios]
  apppilot-mcp-call logs-dump --platform ios|android --device <UDID|SERIAL> [--offset 0] [--match '[Ads]']
  apppilot-mcp-call read-app-log-artifact --path <RELATIVE_PATH>
  apppilot-mcp-call tools-setup --platform ios

Environment:
  APPPILOT_MCP_PATH             Override MCP executable path.
  APPPILOT_HOME                 Override MCP cwd. Defaults to ~/.apppilot.
  APPPILOT_MCP_CALL_TIMEOUT_MS  Default 30000.
`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
