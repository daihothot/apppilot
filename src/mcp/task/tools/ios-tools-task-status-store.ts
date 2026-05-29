import { appPilotConfig } from "../../../config/app-pilot-config.ts";
import { TaskStatusStore, type TaskStatus } from "../../../core/task/task-status-store.ts";

export interface IosToolsTaskStatusMetadata extends Record<string, unknown> {
  pythonPath?: string;
  venvPath?: string;
  pymobiledevice3Path?: string;
  version?: string;
}

export class IosToolsTaskStatusStore extends TaskStatusStore<IosToolsTaskStatusMetadata> {
  startSetup(logPath: string): void {
    this.start(logPath, {
      task: "tools_setup",
      platform: "ios",
      pythonPath: appPilotConfig.paths.localPythonBin,
      venvPath: appPilotConfig.paths.localPythonVenvDir,
      pymobiledevice3Path: appPilotConfig.paths.localPymobiledevice3,
    });
  }

  updateToolsMetadata(metadata: Partial<IosToolsTaskStatusMetadata>): void {
    this.updateMetadata(metadata);
  }

  protected override write(status: TaskStatus<IosToolsTaskStatusMetadata>): void {
    super.write({
      task: "tools_setup",
      platform: "ios",
      pythonPath: appPilotConfig.paths.localPythonBin,
      venvPath: appPilotConfig.paths.localPythonVenvDir,
      pymobiledevice3Path: appPilotConfig.paths.localPymobiledevice3,
      ...status,
    });
  }
}
