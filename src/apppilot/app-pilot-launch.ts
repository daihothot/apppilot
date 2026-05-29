import { AppPilotWsService } from "./app-pilot-ws-service.ts";
import { eventBus, type EventBus, type AppPilotEventMap } from "../core/events/event-bus.ts";
import type { DeviceDriver } from "../devices/device-driver.ts";
import type { LaunchOptions } from "../devices/types.ts";
import type { AppPilotLaunchOptions } from "./types.ts";

const APPPILOT_ENABLED_VALUE = "true";
const WS_ADDRESS_KEY = "guru_ws_client_ip_port";
const ROOT_NAME_KEY = "guru_apppilot_root_name";
const APPPILOT_ENABLED_KEY = "guru_apppilot";
const registeredBuses = new WeakSet<EventBus<AppPilotEventMap>>();

export interface AppPilotRuntime {
  ensureStarted(options?: { port?: number; host?: string }): { advertiseHost: string; port: number };
  prepareForLaunch(): void;
  waitForClient(timeoutMs: number): Promise<boolean>;
  waitForAppServer(timeoutMs: number): Promise<boolean>;
}

export function registerAppPilotEventHandlers(bus: EventBus<AppPilotEventMap> = eventBus, runtime: AppPilotRuntime = AppPilotWsService.shared): void {
  if (registeredBuses.has(bus)) return;
  registeredBuses.add(bus);

  bus.on("app.run.before", async (context) => {
    context.launchOptions = await prepareAppPilotLaunch(context.deviceDriver, context.launchOptions, runtime);
  });

  bus.on("app.run.after", async (context) => {
    await waitForAppPilotConnection(context.launchOptions.appPilot, runtime);
  });
}

export async function prepareAppPilotLaunch(deviceDriver: DeviceDriver, launchOptions: LaunchOptions, runtime: AppPilotRuntime = AppPilotWsService.shared): Promise<LaunchOptions> {
  const appPilot = launchOptions.appPilot;
  if (!appPilot?.enabled) {
    return launchOptions;
  }

  const status = runtime.ensureStarted({ port: appPilot.port });
  runtime.prepareForLaunch();
  const params: Record<string, string> = {
    [APPPILOT_ENABLED_KEY]: APPPILOT_ENABLED_VALUE,
    [WS_ADDRESS_KEY]: `${status.advertiseHost}:${status.port}`,
  };
  if (appPilot.rootName) {
    params[ROOT_NAME_KEY] = appPilot.rootName;
  }

  return deviceDriver.prepareLaunchOptions(launchOptions, params);
}

export async function waitForAppPilotConnection(options?: AppPilotLaunchOptions, runtime: AppPilotRuntime = AppPilotWsService.shared): Promise<void> {
  if (!options?.enabled) return;
  const waitMs = options.waitMs ?? 15_000;
  if (waitMs <= 0) return;

  const connectedToPc = await runtime.waitForClient(waitMs);
  if (!connectedToPc) {
    throw new Error(`AppPilot websocket did not receive Unity app connection within ${waitMs}ms.`);
  }

  const connectedToApp = await runtime.waitForAppServer(waitMs);
  if (!connectedToApp) {
    throw new Error(`AppPilot websocket did not connect to app-side server within ${waitMs}ms.`);
  }
}
