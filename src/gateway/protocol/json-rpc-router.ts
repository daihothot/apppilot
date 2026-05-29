import { parseJsonRpc, sendJsonRpc, type JsonRpcError, type JsonRpcMessage, type JsonRpcPeer } from "./json-rpc.ts";

export type JsonRpcHandler = (params: unknown, message: JsonRpcMessage) => unknown | Promise<unknown>;

export class JsonRpcRouter {
  private readonly handlers = new Map<string, JsonRpcHandler>();

  on(method: string, handler: JsonRpcHandler): void {
    this.handlers.set(method, handler);
  }

  async dispatch(peer: JsonRpcPeer, text: string): Promise<void> {
    const message = parseJsonRpc(text);
    if (!message?.method) return;

    const handler = this.handlers.get(message.method);
    if (!handler) {
      this.sendError(peer, message, { code: -32601, message: `Unknown JSON-RPC method: ${message.method}` });
      return;
    }

    try {
      const result = await handler(message.params, message);
      this.sendResult(peer, message, result);
    } catch (error) {
      this.sendError(peer, message, {
        code: -32000,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private sendResult(peer: JsonRpcPeer, message: JsonRpcMessage, result: unknown): void {
    if (message.id === undefined) return;
    sendJsonRpc(peer, { jsonrpc: "2.0", id: message.id, result });
  }

  private sendError(peer: JsonRpcPeer, message: JsonRpcMessage, error: JsonRpcError): void {
    if (message.id === undefined) return;
    sendJsonRpc(peer, { jsonrpc: "2.0", id: message.id, error });
  }
}
