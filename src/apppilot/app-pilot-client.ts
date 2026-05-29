import { AppPilotWsService } from "./app-pilot-ws-service.ts";
import type { AppPilotWsStatus } from "./types.ts";

export class AppPilotClient {
  constructor(private readonly service = AppPilotWsService.shared) {}

  status(): AppPilotWsStatus {
    return this.service.status();
  }

  call(method: string, params?: unknown): Promise<unknown> {
    return this.service.callApp(method, params);
  }
}

export const appPilotClient = new AppPilotClient();
