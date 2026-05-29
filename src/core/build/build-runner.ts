import { AdapterFactory } from "../factory/adapter-factory.ts";
import type { BuildTask } from "./build-task.ts";

export class BuildRunner {
  constructor(private readonly adapterFactory = new AdapterFactory()) {}

  async run(task: BuildTask): Promise<unknown> {
    if (task.adapter === "unity" && task.platform === "ios") {
      return this.runUnityIos(task);
    }
    if (task.adapter === "unity" && task.platform === "android") {
      return this.runUnityAndroid(task);
    }

    throw new Error("Unsupported build target: adapter=" + task.adapter + ", platform=" + task.platform);
  }

  private async runUnityIos(task: BuildTask): Promise<unknown> {
    const unity = this.adapterFactory.createUnityAdapter();

    if (task.action === "xcode") {
      return unity.buildXcodeFromArtifact(task.projectPath);
    }

    if (!task.projectPath) {
      throw new Error("projectPath is required for unity ios build.");
    }

    const artifact = await unity.prepare({
      projectDir: task.projectPath,
      ios: true,
      debug: task.debug !== false,
      buildRes: task.buildRes === true,
      build: task.refresh === false,
      refreshBuild: task.refresh !== false,
    });

    if (task.xcode !== false) {
      return unity.buildXcodeFromArtifact();
    }

    return artifact;
  }

  private async runUnityAndroid(task: BuildTask): Promise<unknown> {
    const unity = this.adapterFactory.createUnityAdapter();

    if (!task.projectPath) {
      throw new Error("projectPath is required for unity android build.");
    }

    return unity.prepareAndroid({
      projectDir: task.projectPath,
      debug: task.debug !== false,
      buildRes: task.buildRes === true,
      build: task.refresh === false,
      refreshBuild: task.refresh !== false,
    });
  }
}
