import type {
  AppPilotIdentity,
  AppPilotRuntimePort,
} from "../app-pilot-operation-port.ts";

export type AdapterHandshakeResult =
  | { status: "connected"; identity: AppPilotIdentity }
  | { status: "unavailable" }
  | { status: "failed"; code: string; message: string };

/** One transport-specific implementation of the AppPilot runtime Port. */
export interface AppPilotAdapter extends AppPilotRuntimePort {
  readonly transport: string;
  handshake(): Promise<AdapterHandshakeResult>;
  invalidateDiscovery(): void;
}
