import { ExecutorFactory } from "../core/factory/executor-factory.ts";
import { readPlatform } from "../devices/platform.ts";
import { readOption, requireOption } from "./args.ts";

export async function runLogsCommand(command: string | undefined, args: string[]): Promise<void> {
  const platform = readPlatform(args);
  const logs = new ExecutorFactory().createLogsExecutor(platform);

  switch (command) {
    case "dump":
      const device = requireOption(args, "--device");
      const offset = readOption(args, "--offset");
      const match = readOption(args, "--match");
      await logs.dump(device, offset, match);
      return;
    default:
      throw new Error("Unknown logs command. Expected dump.");
  }
}
