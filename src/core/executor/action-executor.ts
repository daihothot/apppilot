import { eventBus } from "../events/event-bus.ts";
import type { ActionSwipeEvent, ActionTapEvent } from "../events/events.ts";
import type { DeviceDriver } from "../../devices/device-driver.ts";
import { LogStore } from "../log/log-store.ts";

export class ActionExecutor {
  private readonly log: LogStore;
  private readonly deviceDriver: DeviceDriver;

  constructor(log: LogStore, deviceDriver: DeviceDriver) {
    this.log = log;
    this.deviceDriver = deviceDriver;
  }

  async tap(device: string, point: string): Promise<void> {
    const context: ActionTapEvent = { platform: this.deviceDriver.platform, device, point };
    await eventBus.emitWait("action.tap.before", context);
    const result = await this.deviceDriver.tap(device, point);
    context.result = result;
    if (result.exitCode !== 0) {
      context.error = result.stderr.trim() || "tap action failed.";
      await eventBus.emitWait("action.tap.failed", context);
      throw new Error(result.stderr.trim() || "tap action failed.");
    }
    await eventBus.emitWait("action.tap.after", context);
    this.log.log("tap action finished", { device, point });
  }

  async swipe(device: string, from: string, to: string): Promise<void> {
    const context: ActionSwipeEvent = { platform: this.deviceDriver.platform, device, from, to };
    await eventBus.emitWait("action.swipe.before", context);
    const result = await this.deviceDriver.swipe(device, from, to);
    context.result = result;
    if (result.exitCode !== 0) {
      context.error = result.stderr.trim() || "swipe action failed.";
      await eventBus.emitWait("action.swipe.failed", context);
      throw new Error(result.stderr.trim() || "swipe action failed.");
    }
    await eventBus.emitWait("action.swipe.after", context);
    this.log.log("swipe action finished", { device, from, to });
  }
}
