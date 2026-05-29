import { spawn } from "node:child_process";
import { closeSync, mkdirSync, openSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { appPilotConfig } from "../config/app-pilot-config.ts";

export function spawnMcpTask(args: string[]): void {
  if (isSourceRuntime()) {
    spawnDetached("bun", toSourceTaskArgs(args), appPilotConfig.paths.home);
    return;
  }

  spawnDetached(readCurrentExecutable(), toPackagedTaskArgs(args), appPilotConfig.paths.home);
}

function isSourceRuntime(): boolean {
  return process.argv.some((arg) => arg.endsWith("src/mcp/server.ts") || arg.endsWith("src/mcp/server.js"));
}

function toPackagedTaskArgs(args: string[]): string[] {
  if (args[0] === "src/mcp/task/build/build-task.ts") {
    return ["--apppilot-build-task", args[1] ?? "{}"];
  }

  throw new Error("Unsupported packaged MCP task: " + (args[0] ?? ""));
}

function toSourceTaskArgs(args: string[]): string[] {
  const [script, ...rest] = args;
  if (!script) {
    throw new Error("Missing MCP task script.");
  }
  return [resolve(sourceRoot(), script), ...rest];
}

function sourceRoot(): string {
  return resolve(fileURLToPath(new URL("../..", import.meta.url)));
}

function readCurrentExecutable(): string {
  return process.execPath;
}

function spawnDetached(command: string, args: string[], cwd: string): void {
  mkdirSync(appPilotConfig.paths.home, { recursive: true });
  mkdirSync(appPilotConfig.paths.logRoot, { recursive: true });
  const taskLog = openSync(join(appPilotConfig.paths.logRoot, "apppilot-task.log"), "a");
  const child = spawn(command, args, {
    cwd,
    detached: true,
    stdio: ["ignore", taskLog, taskLog],
  });
  child.unref();
  closeSync(taskLog);
}
