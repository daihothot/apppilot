import { LogStore } from "../core/log/log-store.ts";
import { AgentToolsService } from "../tools/agent-tools-service.ts";
import { IosToolsService } from "../tools/ios-tools-service.ts";
import { hasFlag } from "./args.ts";

export async function runToolsCommand(command: string | undefined, args: string[]): Promise<void> {
  switch (command) {
    case "setup":
      await runSetup(args);
      return;
    default:
      throw new Error("Unknown tools command. Expected setup --ios, --agent, or --all.");
  }
}

async function runSetup(args: string[]): Promise<void> {
  const ios = hasFlag(args, "--ios");
  const agent = hasFlag(args, "--agent");
  const all = hasFlag(args, "--all");
  const selected = [ios, agent, all].filter(Boolean).length;
  if (selected !== 1) {
    throw new Error("tools setup requires exactly one scope: --ios, --agent, or --all.");
  }

  const log = new LogStore();
  const result: Record<string, unknown> = {};

  if (ios || all) {
    const iosResult = await new IosToolsService(log).setup();
    result.ios = {
      ios: iosResult.ios,
      python: iosResult.python,
      pymobiledevice3: iosResult.pymobiledevice3,
    };
  }

  if (agent || all) {
    result.agent = new AgentToolsService(log).setup();
  }

  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
}
