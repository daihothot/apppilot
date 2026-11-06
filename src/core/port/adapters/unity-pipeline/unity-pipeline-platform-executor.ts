import type {
  AppPilotIdentity,
  AppPilotResult,
  RbtConfigRequest,
} from "../../app-pilot-operation-port.ts";

/** Implements one platform lifecycle through Unity Pipeline. */
export interface UnityPipelinePlatformExecutor {
  readonly platformType: string;
  identify(): Promise<AppPilotResult<AppPilotIdentity> | undefined>;
  start(identity: AppPilotIdentity, parameters?: Readonly<Record<string, string>>): Promise<AppPilotResult<void>>;
  stop(identity: AppPilotIdentity): Promise<AppPilotResult<void>>;
  writeRbtConfig(request: RbtConfigRequest): Promise<AppPilotResult<void>>;
  clearRbtConfig(identity: AppPilotIdentity): Promise<AppPilotResult<void>>;
}
