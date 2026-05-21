import { LOCAL_PYMOBILEDEVICE3_PATH, LOCAL_PYTHON_BIN, LOCAL_PYTHON_VENV_DIR } from "../../../constants.ts";
import { TaskStatusStore, type TaskStatus } from "../../../task/task-status-store.ts";

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
      pythonPath: LOCAL_PYTHON_BIN,
      venvPath: LOCAL_PYTHON_VENV_DIR,
      pymobiledevice3Path: LOCAL_PYMOBILEDEVICE3_PATH,
    });
  }

  updateToolsMetadata(metadata: Partial<IosToolsTaskStatusMetadata>): void {
    this.updateMetadata(metadata);
  }

  protected override write(status: TaskStatus<IosToolsTaskStatusMetadata>): void {
    super.write({
      task: "tools_setup",
      platform: "ios",
      pythonPath: LOCAL_PYTHON_BIN,
      venvPath: LOCAL_PYTHON_VENV_DIR,
      pymobiledevice3Path: LOCAL_PYMOBILEDEVICE3_PATH,
      ...status,
    });
  }
}
