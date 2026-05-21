import { AppLogArtifactStore } from "../artifact/app-log-artifact-store.ts";
import { BuildArtifactStore } from "../artifact/build-artifact-store.ts";
import { ActionExecutor } from "../executor/action-executor.ts";
import { AppExecutor } from "../executor/app-executor.ts";
import { LogsExecutor } from "../executor/logs-executor.ts";
import { LogStore } from "../log/log-store.ts";
import type { Platform } from "../types.ts";
import { BackendFactory } from "./backend-factory.ts";

export class ExecutorFactory {
  constructor(private readonly backendFactory = new BackendFactory()) {}

  createAppExecutor(platform: Platform): AppExecutor {
    return new AppExecutor(new LogStore(), new BuildArtifactStore(), this.backendFactory.create(platform));
  }

  createActionExecutor(platform: Platform): ActionExecutor {
    return new ActionExecutor(new LogStore(), this.backendFactory.create(platform));
  }

  createLogsExecutor(platform: Platform): LogsExecutor {
    return new LogsExecutor(
      new LogStore(),
      new BuildArtifactStore(),
      new AppLogArtifactStore(),
      this.backendFactory.create(platform),
    );
  }
}
