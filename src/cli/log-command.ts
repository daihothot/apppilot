import { LogStore } from "../core/log/log-store.ts";
import { hasFlag } from "./args.ts";

export function runLogCommand(command: string | undefined, args: string[]): void {
  switch (command) {
    case "clear":
      new LogStore().clear(readLogClearScope(args));
      process.stdout.write("cleared logs\n");
      return;
    default:
      throw new Error("Unknown log command. Expected clear.");
  }
}

function readLogClearScope(args: string[]): "all" | "unity" | "xcode" | "ios" {
  const allowed = new Set(["--unity", "--xcode", "-xcode", "--ios", "--all"]);
  const unknown = args.find((arg) => arg.startsWith("-") && !allowed.has(arg));
  if (unknown) {
    throw new Error(`Unknown log clear option ${unknown}. Expected --unity, --xcode, --ios, or --all.`);
  }

  const unity = hasFlag(args, "--unity");
  const xcode = hasFlag(args, "--xcode") || hasFlag(args, "-xcode");
  const ios = hasFlag(args, "--ios");
  const all = hasFlag(args, "--all");
  const selectedCount = [unity, xcode, ios, all].filter(Boolean).length;
  if (selectedCount > 1) {
    throw new Error("Choose only one log clear scope: --unity, --xcode, --ios, or --all.");
  }
  if (unity) return "unity";
  if (xcode) return "xcode";
  if (ios) return "ios";
  return "all";
}
