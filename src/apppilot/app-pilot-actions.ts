import {
  APP_PILOT_APP_METHODS,
  type AppPilotGetNodeAttrsParams,
  type AppPilotGetNodeAttrsResult,
  type AppPilotPingParams,
  type AppPilotPingResult,
  type AppPilotQueryNodesParams,
  type AppPilotQueryNodesResult,
} from "./app-pilot-protocol.ts";
import { appPilotClient, type AppPilotClient } from "./app-pilot-client.ts";
import type { AppPilotWsStatus } from "./types.ts";

export class AppPilotActions {
  constructor(private readonly client: AppPilotClient = appPilotClient) {}

  status(): AppPilotWsStatus {
    return this.client.status();
  }

  ping(params: AppPilotPingParams = {}): Promise<AppPilotPingResult> {
    return this.client.call(APP_PILOT_APP_METHODS.ping, params);
  }

  queryNodes(params: AppPilotQueryNodesParams = {}): Promise<AppPilotQueryNodesResult> {
    return this.client.call(APP_PILOT_APP_METHODS.queryNodes, params);
  }

  getNodeAttrs(params: AppPilotGetNodeAttrsParams): Promise<AppPilotGetNodeAttrsResult> {
    return this.client.call(APP_PILOT_APP_METHODS.getNodeAttrs, params);
  }

  rawCall(method: string, params?: unknown): Promise<unknown> {
    return this.client.call(method, params);
  }
}

export const appPilotActions = new AppPilotActions();
