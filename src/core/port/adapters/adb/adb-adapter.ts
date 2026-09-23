import type {
  AppPilotIdentity,
  AppPilotResult,
  AppTargetRequest,
  InstallRequest,
  LogsRequest,
  LogsResult,
  PointRequest,
  SwipeRequest,
} from "../../app-pilot-operation-port.ts";
import type { AdapterHandshakeResult, AppPilotAdapter } from "../app-pilot-adapter.ts";
import { AdbAndroidExecutor } from "./executors/adb-android-executor.ts";
import { AdbTransport } from "./adb-transport.ts";

/** ADB owns the Android executor used to implement AppPilot's physical operations. */
export class AdbExecutionAdapter implements AppPilotAdapter {
  readonly transport = "adb";
  private activeIdentity?: AppPilotIdentity;

  constructor(
    private readonly executor = new AdbAndroidExecutor(new AdbTransport()),
  ) {}

  async handshake(): Promise<AdapterHandshakeResult> {
    this.invalidateDiscovery();
    const result = await this.executor.handshake();
    if (result.status === "connected") this.activeIdentity = result.identity;
    return result;
  }

  install(request: InstallRequest): Promise<AppPilotResult<void>> {
    return this.withIdentity((identity) => this.executor.install(identity, request));
  }

  uninstall(request: AppTargetRequest): Promise<AppPilotResult<void>> {
    return this.withIdentity((identity) => this.executor.uninstall(identity, request));
  }

  launch(request: AppTargetRequest): Promise<AppPilotResult<void>> {
    return this.withIdentity((identity) => this.executor.launch(identity, request));
  }

  async restart(request: AppTargetRequest): Promise<AppPilotResult<void>> {
    const stopped = await this.shutdown(request);
    return stopped.ok ? this.launch(request) : stopped;
  }

  shutdown(request: AppTargetRequest): Promise<AppPilotResult<void>> {
    return this.withIdentity((identity) => this.executor.shutdown(identity, request));
  }

  tap(request: PointRequest): Promise<AppPilotResult<void>> {
    return this.withIdentity((identity) => this.executor.tap(identity, request));
  }

  swipe(request: SwipeRequest): Promise<AppPilotResult<void>> {
    return this.withIdentity((identity) => this.executor.swipe(identity, request));
  }

  logs(request: LogsRequest): Promise<AppPilotResult<LogsResult>> {
    return this.withIdentity((identity) => this.executor.logs(identity, request));
  }

  invalidateDiscovery(): void {
    this.activeIdentity = undefined;
  }

  private async withIdentity<T>(
    operation: (identity: AppPilotIdentity) => Promise<AppPilotResult<T>>,
  ): Promise<AppPilotResult<T>> {
    if (!this.activeIdentity) {
      return {
        ok: false,
        code: "execution_not_discovered",
        message: `Transport ${this.transport} has no discovered executor. Call identify first.`,
      };
    }
    const result = await operation(this.activeIdentity);
    if (!result.ok && result.requiresIdentify) this.invalidateDiscovery();
    return result;
  }
}

export function createAdbAdapter(): AppPilotAdapter {
  return new AdbExecutionAdapter();
}
