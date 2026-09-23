import type {
  AppPilotIdentity,
  AppPilotResult,
} from "../../app-pilot-operation-port.ts";

/** Implements one platform lifecycle through Unity Pipeline. */
export interface UnityPipelinePlatformExecutor {
  readonly platformType: string;
  identify(): Promise<AppPilotResult<AppPilotIdentity> | undefined>;
  start(identity: AppPilotIdentity): Promise<AppPilotResult<void>>;
  stop(identity: AppPilotIdentity): Promise<AppPilotResult<void>>;
}
