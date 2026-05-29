import { networkInterfaces } from "node:os";
import { JsonRpcWsClient } from "../gateway/ws/json-rpc-ws-client.ts";
import { JsonRpcWsServer } from "../gateway/ws/json-rpc-ws-server.ts";
import { APP_PILOT_PC_METHODS, readAppServerAddress } from "./app-pilot-protocol.ts";
import type { AppPilotWsStatus } from "./types.ts";

export interface AppPilotWsStartOptions {
  port?: number;
  host?: string;
  advertiseHost?: string;
}

const DEFAULT_PORT = 20242;
const DEFAULT_HOST = "0.0.0.0";
const REQUEST_TIMEOUT_MS = 10_000;

export class AppPilotWsService {
  private static readonly instance = new AppPilotWsService();

  static get shared(): AppPilotWsService {
    return AppPilotWsService.instance;
  }

  private host = DEFAULT_HOST;
  private port = DEFAULT_PORT;
  private advertiseHost = "";
  private appServerAddress?: string;
  private readonly appServerClient = new JsonRpcWsClient();
  private readonly server = new JsonRpcWsServer();
  private readonly clientWaiters: Array<() => void> = [];
  private clientConnectionBaseline = 0;
  private appServerConnectionBaseline = 0;

  private constructor() {
    this.server.on(APP_PILOT_PC_METHODS.serverAddress, (params) => {
      const address = readAppServerAddress(params);
      if (address) {
        this.connectAppServer(address);
      }
      return { ok: Boolean(address) };
    });

    this.server.on(APP_PILOT_PC_METHODS.hello, () => this.status());
  }

  ensureStarted(options: AppPilotWsStartOptions = {}): AppPilotWsStatus {
    if (this.server.running) {
      if (options.host && options.host !== this.host) {
        throw new Error(`AppPilot websocket is already running on host ${this.host}, cannot switch to ${options.host}.`);
      }
      if (options.port && options.port !== this.port) {
        throw new Error(`AppPilot websocket is already running on port ${this.port}, cannot switch to ${options.port}.`);
      }
      return this.status();
    }

    this.host = options.host ?? DEFAULT_HOST;
    this.port = options.port ?? DEFAULT_PORT;
    this.advertiseHost = options.advertiseHost ?? resolveLocalAdvertiseHost();

    this.server.start({
      host: this.host,
      port: this.port,
      onHttpRequest: () =>
        new Response(JSON.stringify(this.status()), {
          headers: { "content-type": "application/json" },
        }),
      onClientConnected: () => {
        this.resolveClientWaiters();
      },
    });

    return this.status();
  }

  status(): AppPilotWsStatus {
    return {
      running: this.server.running,
      host: this.host,
      port: this.port,
      advertiseHost: this.advertiseHost || resolveLocalAdvertiseHost(),
      clientConnected: this.server.clientConnected,
      appServerAddress: this.appServerAddress,
      appServerConnected: this.appServerClient.connected,
    };
  }

  getLaunchAddress(): string {
    const status = this.status();
    return `${status.advertiseHost}:${status.port}`;
  }

  prepareForLaunch(): void {
    this.clientConnectionBaseline = this.server.connectionCount;
    this.appServerClient.disconnect();
    this.appServerAddress = undefined;
    this.appServerConnectionBaseline = this.appServerClient.connectionCount;
  }

  async waitForClient(timeoutMs: number): Promise<boolean> {
    if (this.server.connectionCount > this.clientConnectionBaseline) return true;
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        remove();
        resolve(false);
      }, timeoutMs);
      const waiter = () => {
        clearTimeout(timeout);
        remove();
        resolve(true);
      };
      const remove = () => {
        const index = this.clientWaiters.indexOf(waiter);
        if (index >= 0) this.clientWaiters.splice(index, 1);
      };
      this.clientWaiters.push(waiter);
    });
  }

  async waitForAppServer(timeoutMs: number): Promise<boolean> {
    if (this.appServerClient.connectionCount > this.appServerConnectionBaseline) return true;
    return this.appServerClient.waitForOpen(timeoutMs);
  }

  async callApp(method: string, params?: unknown, timeoutMs = REQUEST_TIMEOUT_MS): Promise<unknown> {
    if (!this.appServerClient.connected) {
      throw new Error("AppPilot app-side websocket is not connected.");
    }
    return this.appServerClient.call(method, params, timeoutMs);
  }

  private connectAppServer(address: string): void {
    this.appServerAddress = address;
    this.appServerClient.connect(address);
  }

  private resolveClientWaiters(): void {
    for (const waiter of this.clientWaiters.splice(0)) waiter();
  }

}

function resolveLocalAdvertiseHost(): string {
  for (const values of Object.values(networkInterfaces())) {
    for (const item of values ?? []) {
      if (item.family === "IPv4" && !item.internal) {
        return item.address;
      }
    }
  }
  return "127.0.0.1";
}
