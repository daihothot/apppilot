import { spawn } from "node:child_process";
import { closeSync, mkdirSync, openSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { APPPILOT_HOME, IOS_TOOLS_SETUP_LOG, LOG_ROOT } from "../../../constants.ts";
import { LogStore } from "../../../log/log-store.ts";
import { IosToolsService } from "../../../tools/ios-tools-service.ts";
import { IosToolsTaskStatusStore } from "./ios-tools-task-status-store.ts";

const IOS_TOOLS_SETUP_TASK_ARG = "--apppilot-ios-tools-setup-task";

export function isIosToolsSetupTaskArg(value: string | undefined): boolean {
  return value === IOS_TOOLS_SETUP_TASK_ARG;
}

export function spawnIosToolsSetupTask(): void {
  const logPath = resolve(IOS_TOOLS_SETUP_LOG);
  new IosToolsTaskStatusStore().startSetup(logPath);

  if (isSourceRuntime()) {
    spawnDetached("bun", [resolve(sourceRoot(), "src/mcp/task/tools/ios-tools-setup-task.ts")], APPPILOT_HOME);
    return;
  }

  spawnDetached(process.execPath, [IOS_TOOLS_SETUP_TASK_ARG], APPPILOT_HOME);
}

export async function runIosToolsSetupTask(): Promise<void> {
  const status = new IosToolsTaskStatusStore();
  const logPath = resolve(IOS_TOOLS_SETUP_LOG);
  status.startSetup(logPath);

  await new IosToolsService(new LogStore()).setup({
    logPath,
    onPhase: (phase) => status.update(phase),
    onVersion: (version) => status.updateToolsMetadata({ version }),
  }).then(() => {
    status.success();
  }, (error: unknown) => {
    status.failed();
    throw error;
  });
}

function isSourceRuntime(): boolean {
  return process.argv.some((arg) => arg.endsWith(".ts") || arg.endsWith(".js"));
}

function sourceRoot(): string {
  return resolve(fileURLToPath(new URL("../../../..", import.meta.url)));
}

function spawnDetached(command: string, args: string[], cwd: string): void {
  mkdirSync(APPPILOT_HOME, { recursive: true });
  mkdirSync(LOG_ROOT, { recursive: true });
  mkdirSync(dirname(resolve(IOS_TOOLS_SETUP_LOG)), { recursive: true });
  const taskLog = openSync(join(LOG_ROOT, "apppilot-task.log"), "a");
  const child = spawn(command, args, {
    cwd,
    detached: true,
    stdio: ["ignore", taskLog, taskLog],
  });
  child.unref();
  closeSync(taskLog);
}

if (process.argv[1]?.endsWith("src/mcp/task/tools/ios-tools-setup-task.ts")) {
  runIosToolsSetupTask().catch((error: unknown) => {
    process.stderr.write(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
