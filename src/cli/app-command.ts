import { ExecutorFactory } from "../factory/executor-factory.ts";
import { readOptions, requireOption } from "./args.ts";
import { readPlatform } from "./platform.ts";

export async function runAppCommand(command: string | undefined, args: string[]): Promise<void> {
  const platform = readPlatform(args);
  const app = new ExecutorFactory().createAppExecutor(platform);

  switch (command) {
    case "devices":
      await app.devices();
      return;
    case "run":
      await app.run(requireOption(args, "--device"), readLaunchEnv(args));
      return;
    case "stop":
      await app.stop(requireOption(args, "--device"));
      return;
    default:
      throw new Error("Unknown app command. Expected devices, run, or stop.");
  }
}

function readLaunchEnv(args: string[]): Record<string, string> {
  const env: Record<string, string> = {};
  for (const item of readOptions(args, "--env")) {
    const equals = item.indexOf("=");
    if (equals <= 0) {
      throw new Error(`Invalid --env value ${item}. Expected KEY=VALUE.`);
    }
    const key = item.slice(0, equals);
    const value = item.slice(equals + 1);
    env[key] = value;
  }
  return env;
}
