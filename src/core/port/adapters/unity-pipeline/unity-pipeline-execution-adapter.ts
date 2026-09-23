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
  private activeExecutor?: UnityPipelinePlatformExecutor;
  private activeIdentity?: AppPilotIdentity;

  constructor(
    private readonly executors: readonly UnityPipelinePlatformExecutor[] = [
      new UnityPipelineEditorExecutor(),
    ],
  ) {}

  async handshake(): Promise<AdapterHandshakeResult> {
    this.invalidateDiscovery();
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
    const selected = connected[0]!;
    this.activeExecutor = selected.executor;
    this.activeIdentity = selected.identity;
    return { status: "connected", identity: selected.identity };
  }

  install(_: InstallRequest): Promise<AppPilotResult<void>> {
    return this.unsupported("install");
  }

  uninstall(_: AppTargetRequest): Promise<AppPilotResult<void>> {
    return this.unsupported("uninstall");
  }

  launch(_: AppTargetRequest): Promise<AppPilotResult<void>> {
    return this.withExecutor((executor, identity) => executor.start(identity));
  }

  restart(_: AppTargetRequest): Promise<AppPilotResult<void>> {
    return this.withExecutor(async (executor, identity) => {
      const stopped = await executor.stop(identity);
      return stopped.ok ? executor.start(identity) : stopped;
    });
  }

  shutdown(_: AppTargetRequest): Promise<AppPilotResult<void>> {
    return this.withExecutor((executor, identity) => executor.stop(identity));
  }

  tap(_: PointRequest): Promise<AppPilotResult<void>> {
    return this.unsupported("tap");
  }

  swipe(_: SwipeRequest): Promise<AppPilotResult<void>> {
    return this.unsupported("swipe");
  }

  logs(_: LogsRequest): Promise<AppPilotResult<LogsResult>> {
    return this.unsupported("logs");
  }

  invalidateDiscovery(): void {
    this.activeExecutor = undefined;
    this.activeIdentity = undefined;
  }

  private async withExecutor<T>(
    operation: (
      executor: UnityPipelinePlatformExecutor,
      identity: AppPilotIdentity,
    ) => Promise<AppPilotResult<T>>,
  ): Promise<AppPilotResult<T>> {
    if (!this.activeExecutor || !this.activeIdentity) return this.notDiscovered();
    const result = await operation(this.activeExecutor, this.activeIdentity);
    if (!result.ok && result.requiresIdentify) this.invalidateDiscovery();
    return result;
  }

  private unsupported<T>(operation: string): Promise<AppPilotResult<T>> {
    return Promise.resolve(this.activeIdentity
      ? operationUnsupported(operation, this.activeIdentity)
      : this.notDiscovered());
  }

  private notDiscovered(): AppPilotFailure {
    return {
      ok: false,
      code: "execution_not_discovered",
      message: `Transport ${this.transport} has no discovered executor. Call identify first.`,
    };
  }
}

export function createUnityPipelineAdapter(): AppPilotAdapter {
  return new UnityPipelineExecutionAdapter();
}
