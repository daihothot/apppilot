import type { LogStore } from "../../../telemetry/log-store.ts";
import type { AppPilotCommand } from "./app-pilot-command.ts";

export class LogCommand implements AppPilotCommand {
  constructor(private readonly logStore: LogStore) {}

  invoke(args: string[]): Promise<object> {
    if (args.length !== 1 || args[0] !== "clear") {
      throw new Error("log requires the clear action.");
    }
    this.logStore.clear();
    return Promise.resolve({ ok: true });
  }
}
