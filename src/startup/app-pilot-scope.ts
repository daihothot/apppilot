import { createAppPilotCli, type AppPilotCli } from "../core/cli/index.ts";
import type { AppPilotOperationPort } from "../core/port/app-pilot-operation-port.ts";
import { createAppPilotPort } from "../core/port/app-pilot-port.ts";
import { LogStore } from "../telemetry/log-store.ts";

export interface AppPilotScope {
  readonly operationPort: AppPilotOperationPort;
  readonly logStore: LogStore;
  readonly cli: AppPilotCli;
}

export function createAppPilotScope(): AppPilotScope {
  const operationPort = createAppPilotPort();
  const logStore = new LogStore();
  const cli = createAppPilotCli(operationPort, logStore);
  return { operationPort, logStore, cli };
}
