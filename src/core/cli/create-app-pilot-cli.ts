import type { LogStore } from "../../telemetry/log-store.ts";
import type { AppPilotOperationPort } from "../port/app-pilot-operation-port.ts";
import { AppPilotCli } from "./app-pilot-cli.ts";
import type { AppPilotCommand } from "./commands/app-pilot-command.ts";
import { BuildCommand } from "./commands/build-command.ts";
import { IdentifyCommand } from "./commands/identify-command.ts";
import { InstallCommand } from "./commands/install-command.ts";
import { LaunchCommand } from "./commands/launch-command.ts";
import { LogCommand } from "./commands/log-command.ts";
import { LogsCommand } from "./commands/logs-command.ts";
import { RestartCommand } from "./commands/restart-command.ts";
import { SetupCommand } from "./commands/setup-command.ts";
import { ShutdownCommand } from "./commands/shutdown-command.ts";
import { SwipeCommand } from "./commands/swipe-command.ts";
import { TapCommand } from "./commands/tap-command.ts";
import { UninstallCommand } from "./commands/uninstall-command.ts";

export function createAppPilotCli(
  operationPort: AppPilotOperationPort,
  logStore: LogStore,
): AppPilotCli {
  return new AppPilotCli(new Map<string, AppPilotCommand>([
    ["identify", new IdentifyCommand(operationPort)],
    ["build", new BuildCommand(operationPort)],
    ["install", new InstallCommand(operationPort)],
    ["uninstall", new UninstallCommand(operationPort)],
    ["launch", new LaunchCommand(operationPort)],
    ["restart", new RestartCommand(operationPort)],
    ["shutdown", new ShutdownCommand(operationPort)],
    ["tap", new TapCommand(operationPort)],
    ["swipe", new SwipeCommand(operationPort)],
    ["logs", new LogsCommand(operationPort)],
    ["setup", new SetupCommand(logStore)],
    ["log", new LogCommand(logStore)],
  ]));
}
