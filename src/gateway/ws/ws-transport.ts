export type WsServerSocket = {
  send(text: string): void;
};

export type WsServer = {
  stop?: () => void;
};

export interface WsServerOptions {
  host: string;
  port: number;
  onOpen(socket: WsServerSocket): void;
  onClose(socket: WsServerSocket): void;
  onMessage(socket: WsServerSocket, message: string): void;
  onHttpRequest?(): Response;
}

declare const Bun: {
  serve(options: {
    hostname: string;
    port: number;
    fetch(request: Request, server: { upgrade(request: Request): boolean }): Response | undefined;
    websocket: {
      open(socket: WsServerSocket): void;
      close(socket: WsServerSocket): void;
      message(socket: WsServerSocket, data: string | Buffer): void;
    };
  }): WsServer;
};

export function startWsServer(options: WsServerOptions): WsServer {
  return Bun.serve({
    hostname: options.host,
    port: options.port,
    fetch: (request, server) => {
      if (server.upgrade(request)) {
        return undefined;
      }
      return options.onHttpRequest?.() ?? new Response("ok");
    },
    websocket: {
      open: options.onOpen,
      close: options.onClose,
      message: (socket, data) => options.onMessage(socket, String(data)),
    },
  });
}
