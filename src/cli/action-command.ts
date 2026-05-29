import { ExecutorFactory } from "../core/factory/executor-factory.ts";
import { readPlatform } from "../devices/platform.ts";
import { requireOption, requirePositional } from "./args.ts";

export async function runActionCommand(command: string | undefined, args: string[]): Promise<void> {
  const platform = readPlatform(args);
  const action = new ExecutorFactory().createActionExecutor(platform);
  const device = requireOption(args, "--device");
  const positional = args.filter((arg, index) => {
    if (arg === "--ios") return false;
    if (arg === "--device") return false;
    if (args[index - 1] === "--device") return false;
    return !arg.startsWith("-");
  });

  switch (command) {
    case "tap":
      await action.tap(device, requirePositional(positional[0], "point"));
      return;
    case "swipe":
      await action.swipe(device, requirePositional(positional[0], "from"), requirePositional(positional[1], "to"));
      return;
    default:
      throw new Error("Unknown action command. Expected tap or swipe.");
  }
}
