import type {
  AppPilotResult,
  AppTargetRequest,
  InstallRequest,
  LaunchRequest,
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

  constructor(
    private readonly executor = new AdbAndroidExecutor(new AdbTransport()),
  ) {}

  async handshake(): Promise<AdapterHandshakeResult> {
    return this.executor.handshake();
  }

  install(request: InstallRequest): Promise<AppPilotResult<void>> {
    return this.executor.install(request.identity, request);
  }

  uninstall(request: AppTargetRequest): Promise<AppPilotResult<void>> {
    return this.executor.uninstall(request.identity, request);
  }

  launch(request: LaunchRequest): Promise<AppPilotResult<void>> {
    return this.executor.launch(request.identity, request);
  }

  async restart(request: LaunchRequest): Promise<AppPilotResult<void>> {
    const stopped = await this.executor.shutdown(request.identity, request);
    return stopped.ok
      ? this.executor.launch(request.identity, request)
      : stopped;
  }

  shutdown(request: AppTargetRequest): Promise<AppPilotResult<void>> {
    return this.executor.shutdown(request.identity, request);
  }

  tap(request: PointRequest): Promise<AppPilotResult<void>> {
    return this.executor.tap(request.identity, request);
  }

  swipe(request: SwipeRequest): Promise<AppPilotResult<void>> {
    return this.executor.swipe(request.identity, request);
  }

  logs(request: LogsRequest): Promise<AppPilotResult<LogsResult>> {
    return this.executor.logs(request.identity, request);
  }
}

export function createAdbAdapter(): AppPilotAdapter {
  return new AdbExecutionAdapter();
}
