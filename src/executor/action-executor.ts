import type { Backend } from "../backend/backend.ts";
import { LogStore } from "../log/log-store.ts";

export class ActionExecutor {
  private readonly log: LogStore;
  private readonly backend: Backend;

  constructor(log: LogStore, backend: Backend) {
    this.log = log;
    this.backend = backend;
  }

  async tap(device: string, point: string): Promise<void> {
    const result = await this.backend.tap(device, point);
    if (result.exitCode !== 0) {
      throw new Error(result.stderr.trim() || "tap action failed.");
    }
    this.log.log("tap action finished", { device, point });
  }

  async swipe(device: string, from: string, to: string): Promise<void> {
    const result = await this.backend.swipe(device, from, to);
    if (result.exitCode !== 0) {
      throw new Error(result.stderr.trim() || "swipe action failed.");
    }
    this.log.log("swipe action finished", { device, from, to });
  }
}
