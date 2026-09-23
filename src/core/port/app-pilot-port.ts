import { PlatformBuildRegistry } from "../../platforms/platform-build-registry.ts";
import { UnityBuildTool } from "../../platforms/unityeditor/tools/unity-build-tool.ts";
import { createAdbAdapter } from "./adapters/adb/adb-adapter.ts";
import { AppPilotAdapterRegistry } from "./adapters/app-pilot-adapter-registry.ts";
import type { AppPilotAdapter } from "./adapters/app-pilot-adapter.ts";
import { createUnityPipelineAdapter } from "./adapters/unity-pipeline/unity-pipeline-execution-adapter.ts";
import type {
  AppPilotIdentity,
  AppPilotOperationPort,
  AppPilotResult,
  AppTargetRequest,
  BuildArtifact,
  BuildRequest,
  IdentifyRequest,
  InstallRequest,
  LogsRequest,
  LogsResult,
  PointRequest,
  SwipeRequest,
} from "./app-pilot-operation-port.ts";

/** Routes physical operations directly from the CLI to the selected Adapter or platform build tool. */
export class AppPilotPort implements AppPilotOperationPort {
  constructor(
    private readonly registry: AppPilotAdapterRegistry,
    private readonly builds: PlatformBuildRegistry,
  ) {}

  async identify(request: IdentifyRequest): Promise<AppPilotResult<AppPilotIdentity>> {
    const selected = await this.registry.handshake(request.transport);
    return selected.ok ? { ok: true, value: selected.identity } : selected;
  }

  build(request: BuildRequest): Promise<AppPilotResult<BuildArtifact>> {
    return this.builds.build(request);
  }
  install(request: InstallRequest): Promise<AppPilotResult<void>> {
    return this.withAdapter((adapter) => adapter.install(request));
  }
  uninstall(request: AppTargetRequest): Promise<AppPilotResult<void>> {
    return this.withAdapter((adapter) => adapter.uninstall(request));
  }
  launch(request: AppTargetRequest): Promise<AppPilotResult<void>> {
    return this.withAdapter((adapter) => adapter.launch(request));
  }
  restart(request: AppTargetRequest): Promise<AppPilotResult<void>> {
    return this.withAdapter((adapter) => adapter.restart(request));
  }
  shutdown(request: AppTargetRequest): Promise<AppPilotResult<void>> {
    return this.withAdapter((adapter) => adapter.shutdown(request));
  }
  tap(request: PointRequest): Promise<AppPilotResult<void>> {
    return this.withAdapter((adapter) => adapter.tap(request));
  }
  swipe(request: SwipeRequest): Promise<AppPilotResult<void>> {
    return this.withAdapter((adapter) => adapter.swipe(request));
  }
  logs(request: LogsRequest): Promise<AppPilotResult<LogsResult>> {
    return this.withAdapter((adapter) => adapter.logs(request));
  }

  private async withAdapter<T>(
    operation: (adapter: AppPilotAdapter) => Promise<AppPilotResult<T>>,
  ): Promise<AppPilotResult<T>> {
    const selected = this.registry.current();
    if (!selected.ok) return selected;
    const result = await operation(selected.value);
    if (!result.ok && result.requiresIdentify) {
      this.registry.invalidate(selected.value);
    }
    return result;
  }
}

/** Default discovery order is stable: Unity Pipeline, then ADB. */
export function createAppPilotPort(): AppPilotPort {
  const unityBuild = new UnityBuildTool();
  return new AppPilotPort(
    new AppPilotAdapterRegistry([createUnityPipelineAdapter(), createAdbAdapter()]),
    new PlatformBuildRegistry([
      { platform: "ios", tool: unityBuild },
      { platform: "android", tool: unityBuild },
    ]),
  );
}
