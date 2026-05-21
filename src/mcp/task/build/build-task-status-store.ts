import { TaskStatusStore, type TaskStatus } from "../../../task/task-status-store.ts";

export interface BuildTaskStatusMetadata extends Record<string, unknown> {
  adapter: "unity";
  projectPath?: string;
  xcodeProjectPath?: string;
  appPath?: string;
  artifact?: string;
}

export class BuildTaskStatusStore extends TaskStatusStore<BuildTaskStatusMetadata> {
  startUnityBuild(logPath: string): void {
    this.start(logPath, {
      task: "unity_build",
      platform: "ios",
      adapter: "unity",
    });
  }

  startXcodeBuild(logPath: string): void {
    this.start(logPath, {
      task: "xcode_build",
      platform: "ios",
      adapter: "unity",
    });
  }

  updateBuildMetadata(metadata: Partial<BuildTaskStatusMetadata>): void {
    this.updateMetadata(metadata);
  }

  protected override write(status: TaskStatus<BuildTaskStatusMetadata>): void {
    super.write({
      adapter: "unity",
      ...status,
    });
  }
}
