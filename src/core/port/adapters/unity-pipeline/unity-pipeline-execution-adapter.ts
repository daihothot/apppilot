import { operationUnsupported } from "../../app-pilot-errors.ts";
import type {
  AppPilotFailure,
  AppPilotIdentity,
  AppPilotResult,
  AppTargetRequest,
  InstallRequest,
  LogsRequest,
  LogsResult,
  PointRequest,
  SwipeRequest,
} from "../../app-pilot-operation-port.ts";
import type {
  AdapterHandshakeResult,
  AppPilotAdapter,
} from "../app-pilot-adapter.ts";
import { UnityPipelineEditorExecutor } from "./unity-pipeline-editor-executor.ts";
import type { UnityPipelinePlatformExecutor } from "./unity-pipeline-platform-executor.ts";

/** Identifies and dispatches platform work backed by Unity Pipeline. */
export class UnityPipelineExecutionAdapter implements AppPilotAdapter {
  readonly transport = "unity-pipeline";

  constructor(
    private readonly executors: readonly UnityPipelinePlatformExecutor[] = [
      new UnityPipelineEditorExecutor(),
    ],
  ) {}

  async handshake(): Promise<AdapterHandshakeResult> {
    const connected: Array<{
      executor: UnityPipelinePlatformExecutor;
      identity: AppPilotIdentity;
    }> = [];
    for (const executor of this.executors) {
      const result = await executor.identify();
      if (!result) continue;
      if (!result.ok) return { status: "failed", code: result.code, message: result.message };
      connected.push({ executor, identity: result.value });
    }
    if (connected.length === 0) return { status: "unavailable" };
    if (connected.length !== 1) {
      return {
        status: "failed",
        code: "execution_platform_ambiguous",
        message: "Exactly one execution platform is required.",
      };
    }
    return { status: "connected", identity: connected[0]!.identity };
  }

  install(request: InstallRequest): Promise<AppPilotResult<void>> {
    return this.unsupported("install", request.identity);
  }

  uninstall(request: AppTargetRequest): Promise<AppPilotResult<void>> {
    return this.unsupported("uninstall", request.identity);
  }

  launch(request: AppTargetRequest): Promise<AppPilotResult<void>> {
    return this.withExecutor(request.identity, (executor) => executor.start(request.identity));
  }

  restart(request: AppTargetRequest): Promise<AppPilotResult<void>> {
    return this.withExecutor(request.identity, async (executor) => {
      const stopped = await executor.stop(request.identity);
      return stopped.ok ? executor.start(request.identity) : stopped;
    });
  }

  shutdown(request: AppTargetRequest): Promise<AppPilotResult<void>> {
    return this.withExecutor(request.identity, (executor) => executor.stop(request.identity));
  }

  tap(request: PointRequest): Promise<AppPilotResult<void>> {
    return this.unsupported("tap", request.identity);
  }

  swipe(request: SwipeRequest): Promise<AppPilotResult<void>> {
    return this.unsupported("swipe", request.identity);
  }

  logs(request: LogsRequest): Promise<AppPilotResult<LogsResult>> {
    return this.unsupported("logs", request.identity);
  }

  private async withExecutor<T>(
    identity: AppPilotIdentity,
    operation: (executor: UnityPipelinePlatformExecutor) => Promise<AppPilotResult<T>>,
  ): Promise<AppPilotResult<T>> {
    if (identity.transport !== this.transport) return this.notDiscovered(identity);
    const executor = this.executors.find((candidate) => candidate.platformType === identity.platform.type);
    return executor ? operation(executor) : this.notDiscovered(identity);
  }

  private unsupported<T>(operation: string, identity: AppPilotIdentity): Promise<AppPilotResult<T>> {
    return Promise.resolve(operationUnsupported(operation, identity));
  }

  private notDiscovered(identity: AppPilotIdentity): AppPilotFailure {
    return {
      ok: false,
      code: "execution_selection_unavailable",
      message: `Transport ${identity.transport} does not implement platform ${identity.platform.type}. Call identify again.`,
      requiresIdentify: true,
    };
  }
}

export function createUnityPipelineAdapter(): AppPilotAdapter {
  return new UnityPipelineExecutionAdapter();
}
