import { JsonRpcRouter, type JsonRpcHandler } from "../protocol/json-rpc-router.ts";
import { startWsServer, type WsServer, type WsServerSocket } from "./ws-transport.ts";

export interface JsonRpcWsServerStartOptions {
  host: string;
  port: number;
  onHttpRequest?(): Response;
  onClientConnected?(): void;
}

export class JsonRpcWsServer {
  private readonly router = new JsonRpcRouter();
  private readonly clients = new Set<WsServerSocket>();
  private server?: WsServer;
  private openCount = 0;

  get running(): boolean {
    return Boolean(this.server);
  }

  get clientConnected(): boolean {
    return this.clients.size > 0;
  }

  get connectionCount(): number {
    return this.openCount;
  }

  on(method: string, handler: JsonRpcHandler): void {
    this.router.on(method, handler);
  }

  start(options: JsonRpcWsServerStartOptions): void {
    if (this.server) return;

    this.server = startWsServer({
      host: options.host,
      port: options.port,
      onHttpRequest: options.onHttpRequest,
      onOpen: (socket) => {
        this.clients.add(socket);
        this.openCount += 1;
        options.onClientConnected?.();
      },
      onClose: (socket) => {
        this.clients.delete(socket);
      },
      onMessage: (socket, message) => {
        this.router.dispatch(socket, message).catch((error: unknown) => {
          const message = error instanceof Error ? error.message : String(error);
          console.error("JSON-RPC websocket dispatch failed: " + message);
        });
      },
    });
  }
}
