import { BuildArtifactStore } from "../artifact/build-artifact-store.ts";
import type { Backend } from "../backend/backend.ts";
import { LogStore } from "../log/log-store.ts";

export class AppExecutor {
  private readonly log: LogStore;
  private readonly builds: BuildArtifactStore;
  private readonly backend: Backend;

  constructor(log: LogStore, builds: BuildArtifactStore, backend: Backend) {
    this.log = log;
    this.builds = builds;
    this.backend = backend;
  }

  async devices(): Promise<void> {
    const result = await this.backend.listDevices();
    process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    if (result.exitCode !== 0) throw new Error(`Failed to list ${this.backend.platform} devices.`);
  }

  async run(device: string, launchEnv: Record<string, string> = {}): Promise<void> {
    const build = this.builds.readUnityIosBuild();
    this.log.log("app run started", { device, appPath: build.appPath, bundleId: build.bundleId, launchEnv });

    const install = await this.backend.install(device, build.appPath);
    if (install.exitCode !== 0) {
      throw new Error(install.stderr.trim() || "App install failed.");
    }

    const launch = await this.backend.launch(device, build.bundleId, launchEnv);
    if (launch.exitCode !== 0) {
      throw new Error(launch.stderr.trim() || "App launch failed.");
    }

    this.log.log("app run finished", { device });
  }

  async stop(device: string): Promise<void> {
    const build = this.builds.readUnityIosBuild();
    const result = await this.backend.stop(device, build.bundleId);
    if (result.exitCode !== 0) {
      throw new Error(result.stderr.trim() || "App stop failed.");
    }
    this.log.log("app stopped", { device, bundleId: build.bundleId });
  }
}
