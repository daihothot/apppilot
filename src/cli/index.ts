#!/usr/bin/env bun
import { LogStore } from "../log/log-store.ts";
import { runActionCommand } from "./action-command.ts";
import { runAppCommand } from "./app-command.ts";
import { runLogCommand } from "./log-command.ts";
import { runLogsCommand } from "./logs-command.ts";
import { runToolsCommand } from "./tools-command.ts";
import { runUnityCommand } from "./unity-command.ts";

async function main(argv: string[]): Promise<void> {
  const [domain, command, ...rest] = argv;

  switch (domain) {
    case "unity":
      await runUnityCommand(command, rest);
      return;
    case "app":
      await runAppCommand(command, rest);
      return;
    case "action":
      await runActionCommand(command, rest);
      return;
    case "logs":
      await runLogsCommand(command, rest);
      return;
    case "log":
      runLogCommand(command, rest);
      return;
    case "tools":
      await runToolsCommand(command, rest);
      return;
    default:
      printHelp();
      if (domain) process.exitCode = 1;
  }
}

function printHelp(): void {
  process.stdout.write(`AppPilot

Usage:
  apppilot unity <UNITY_DIR> --ios [--release] [--build-res] [--build | --refresh-build]
  apppilot unity status
  apppilot unity xcode build
  apppilot unity xcode status
  apppilot app devices --ios
  apppilot app run --ios --device <UDID> [--env KEY=VALUE]
  apppilot app stop --ios --device <UDID>
  apppilot action tap --ios --device <UDID> 11,213
  apppilot action swipe --ios --device <UDID> 100,500 100,100
  apppilot log clear [--unity | --xcode | --ios | --all]
  apppilot logs dump --ios --device <UDID> [--offset 0] [--match text]
  apppilot tools setup --ios
`);
}

main(process.argv.slice(2)).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  new LogStore().error(message);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
