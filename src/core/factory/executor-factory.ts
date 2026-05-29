import { AppLogArtifactStore } from "../artifact/app-log-artifact-store.ts";
import { BuildArtifactStore } from "../artifact/build-artifact-store.ts";
import { ActionExecutor } from "../executor/action-executor.ts";
import { AppExecutor } from "../executor/app-executor.ts";
import { LogsExecutor } from "../executor/logs-executor.ts";
import type { Platform } from "../../devices/types.ts";
import { LogStore } from "../log/log-store.ts";
import { DeviceDriverFactory } from "./device-driver-factory.ts";

export class ExecutorFactory {
  constructor(private readonly deviceDriverFactory = new DeviceDriverFactory()) {}

  createAppExecutor(platform: Platform): AppExecutor {
    return new AppExecutor(new LogStore(), new BuildArtifactStore(), this.deviceDriverFactory.create(platform));
  }

  createActionExecutor(platform: Platform): ActionExecutor {
    return new ActionExecutor(new LogStore(), this.deviceDriverFactory.create(platform));
  }

  createLogsExecutor(platform: Platform): LogsExecutor {
    return new LogsExecutor(
      new LogStore(),
      new BuildArtifactStore(),
      new AppLogArtifactStore(),
      this.deviceDriverFactory.create(platform),
    );
  }
}
