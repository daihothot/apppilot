import { IosEnvironmentSetup } from "../../../env/ios-environment.ts";
import { PluginSetup } from "../../../plugin/plugin-setup.ts";
import type { LogStore } from "../../../telemetry/log-store.ts";
import { hasFlag } from "../args.ts";
import type { AppPilotCommand } from "./app-pilot-command.ts";

export class SetupCommand implements AppPilotCommand {
  constructor(private readonly logStore: LogStore) {}

  async invoke(args: string[]): Promise<object> {
    const ios = hasFlag(args, "--ios");
    const plugin = hasFlag(args, "--plugin");
    const all = hasFlag(args, "--all");
    if ([ios, plugin, all].filter(Boolean).length !== 1) {
      throw new Error("setup requires exactly one scope: --ios, --plugin, or --all.");
    }

    const result: Record<string, unknown> = {};
    if (ios || all) {
      const iosResult = await IosEnvironmentSetup.setup(this.logStore);
      result.ios = {
        ios: iosResult.ios,
        python: iosResult.python,
        pymobiledevice3: iosResult.pymobiledevice3,
      };
    }
    if (plugin || all) result.plugin = PluginSetup.setup(this.logStore);
    return result;
  }
}
