export interface AppPilotIdentity {
  transport: string;
  platform: {
    type: string;
    version: string;
  };
}

export interface AppPilotFailure {
  ok: false;
  code: string;
  message: string;
  requiresIdentify?: true;
}

export type AppPilotResult<T> = { ok: true; value: T } | AppPilotFailure;

export interface IdentifyRequest {
  transport?: string;
}

export interface BuildRequest {
  platform?: string;
  projectPath?: string;
  outputPath?: string;
  configuration?: "debug" | "release";
  append?: boolean;
  buildResources?: boolean;
  buildNative?: boolean;
}

export interface BuildArtifact {
  platform: string;
  projectPath: string;
  outputPath: string;
  appPath?: string;
  appId: string;
}

export interface AppTargetRequest {
  appId?: string;
}

export interface InstallRequest extends AppTargetRequest {
  artifactPath?: string;
}

export interface PointRequest {
  x?: number;
  y?: number;
}

export interface SwipeRequest {
  fromX?: number;
  fromY?: number;
  toX?: number;
  toY?: number;
}

export interface LogsRequest extends AppTargetRequest {
  outputPath?: string;
  offset?: number;
  match?: string;
}

export interface LogsResult {
  path: string;
  count?: number;
}

/** Runtime physical semantics implemented by every transport Adapter. */
export interface AppPilotRuntimePort {
  install(request: InstallRequest): Promise<AppPilotResult<void>>;
  uninstall(request: AppTargetRequest): Promise<AppPilotResult<void>>;
  launch(request: AppTargetRequest): Promise<AppPilotResult<void>>;
  restart(request: AppTargetRequest): Promise<AppPilotResult<void>>;
  shutdown(request: AppTargetRequest): Promise<AppPilotResult<void>>;
  tap(request: PointRequest): Promise<AppPilotResult<void>>;
  swipe(request: SwipeRequest): Promise<AppPilotResult<void>>;
  logs(request: LogsRequest): Promise<AppPilotResult<LogsResult>>;
}

/** Physical AppPilot semantics. Platform and transport details remain behind the selected identity. */
export interface AppPilotOperationPort extends AppPilotRuntimePort {
  identify(request: IdentifyRequest): Promise<AppPilotResult<AppPilotIdentity>>;
  build(request: BuildRequest): Promise<AppPilotResult<BuildArtifact>>;
}
