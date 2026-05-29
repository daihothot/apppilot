import { BuildArtifactStore } from "../artifact/build-artifact-store.ts";
import { eventBus } from "../events/event-bus.ts";
import type { AppDevicesEvent, AppRunEvent, AppStopEvent } from "../events/events.ts";
import type { DeviceDriver } from "../../devices/device-driver.ts";
import type { LaunchOptions } from "../../devices/types.ts";
import { LogStore } from "../log/log-store.ts";

export class AppExecutor {
  private readonly log: LogStore;
  private readonly builds: BuildArtifactStore;
  private readonly deviceDriver: DeviceDriver;

  constructor(log: LogStore, builds: BuildArtifactStore, deviceDriver: DeviceDriver) {
    this.log = log;
    this.builds = builds;
    this.deviceDriver = deviceDriver;
  }

  async devices(): Promise<void> {
    const context: AppDevicesEvent = { platform: this.deviceDriver.platform };
    await eventBus.emitWait("app.devices.before", context);
    await eventBus.emitWait("device.list.before", context);
    const result = await this.deviceDriver.listDevices();
    context.result = result;
    await eventBus.emitWait("device.list.after", context);
    process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    if (result.exitCode !== 0) {
      context.error = result.stderr.trim() || `Failed to list ${this.deviceDriver.platform} devices.`;
      await eventBus.emitWait("device.list.failed", context);
      await eventBus.emitWait("app.devices.failed", context);
      throw new Error(String(context.error));
    }
    await eventBus.emitWait("app.devices.after", context);
  }

  async run(device: string, launchOptions: LaunchOptions = {}): Promise<void> {
    const build = this.builds.readUnityBuild(this.deviceDriver.platform);
    const context: AppRunEvent = {
      platform: this.deviceDriver.platform,
      device,
      appPath: build.appPath,
      bundleId: build.bundleId,
      launchOptions,
      deviceDriver: this.deviceDriver,
      build,
    };
    await eventBus.emitWait("app.run.before", context);
    this.log.log("app run started", { device, platform: context.platform, appPath: context.appPath, bundleId: context.bundleId, launchOptions: context.launchOptions });

    await eventBus.emitWait("app.install.before", context);
    await eventBus.emitWait("device.install.before", context);
    const install = await this.deviceDriver.install(device, context.appPath);
    context.installResult = install;
    await eventBus.emitWait("device.install.after", context);
    await eventBus.emitWait("app.install.after", context);
    if (install.exitCode !== 0) {
      context.error = install.stderr.trim() || "App install failed.";
      await eventBus.emitWait("device.install.failed", context);
      await eventBus.emitWait("app.install.failed", context);
      await eventBus.emitWait("app.run.failed", context);
      throw new Error(install.stderr.trim() || "App install failed.");
    }

    await eventBus.emitWait("app.launch.before", context);
    await eventBus.emitWait("device.launch.before", context);
    const launch = await this.deviceDriver.launch(device, context.bundleId, context.launchOptions);
    context.launchResult = launch;
    await eventBus.emitWait("device.launch.after", context);
    await eventBus.emitWait("app.launch.after", context);
    if (launch.exitCode !== 0) {
      context.error = launch.stderr.trim() || "App launch failed.";
      await eventBus.emitWait("device.launch.failed", context);
      await eventBus.emitWait("app.launch.failed", context);
      await eventBus.emitWait("app.run.failed", context);
      throw new Error(launch.stderr.trim() || "App launch failed.");
    }

    await eventBus.emitWait("app.run.after", context);
    this.log.log("app run finished", { device });
  }

  async stop(device: string): Promise<void> {
    const build = this.builds.readUnityBuild(this.deviceDriver.platform);
    const context: AppStopEvent = { platform: this.deviceDriver.platform, device, bundleId: build.bundleId };
    await eventBus.emitWait("app.stop.before", context);
    await eventBus.emitWait("device.stop.before", context);
    const result = await this.deviceDriver.stop(device, build.bundleId);
    context.result = result;
    await eventBus.emitWait("device.stop.after", context);
    await eventBus.emitWait("app.stop.after", context);
    if (result.exitCode !== 0) {
      context.error = result.stderr.trim() || "App stop failed.";
      await eventBus.emitWait("device.stop.failed", context);
      await eventBus.emitWait("app.stop.failed", context);
      throw new Error(result.stderr.trim() || "App stop failed.");
    }
    this.log.log("app stopped", { device, bundleId: build.bundleId });
  }
}
