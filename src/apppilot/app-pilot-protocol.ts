import type { AppPilotWsStatus } from "./types.ts";

export const APP_PILOT_PC_METHODS = {
  serverAddress: "guru_server_ip_port",
  hello: "guru.apppilot.hello",
} as const;

export const APP_PILOT_APP_METHODS = {
  ping: "guru.apppilot.ping",
  queryNodes: "guru.apppilot.queryNodes",
  getNodeAttrs: "guru.apppilot.getNodeAttrs",
} as const;

export interface AppPilotHelloResult extends AppPilotWsStatus {}

export interface AppPilotPingParams extends Record<string, unknown> {}
export type AppPilotPingResult = unknown;

export interface AppPilotQueryNodesParams extends Record<string, unknown> {
  rootPath?: string;
  depth?: number;
  select?: string[];
  where?: Record<string, unknown>;
  limit?: number;
}

export type AppPilotQueryNodesResult = unknown;

export interface AppPilotGetNodeAttrsParams extends Record<string, unknown> {
  path: string;
  select?: string[];
}

export type AppPilotGetNodeAttrsResult = unknown;

export function readAppServerAddress(params: unknown): string | undefined {
  if (typeof params === "string") return params;
  if (typeof params !== "object" || params === null || Array.isArray(params)) return undefined;
  const value = (params as Record<string, unknown>).data ?? (params as Record<string, unknown>).address;
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}
