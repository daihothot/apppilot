import { ExecutorFactory } from "../factory/executor-factory.ts";
import { readOption, requireOption } from "./args.ts";
import { readPlatform } from "./platform.ts";

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
