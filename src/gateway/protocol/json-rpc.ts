export interface JsonRpcMessage {
  jsonrpc?: "2.0";
  id?: string | number | null;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: JsonRpcError;
}

export interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

export interface JsonRpcPeer {
  send(text: string): void;
}

export function parseJsonRpc(text: string): JsonRpcMessage | undefined {
  try {
    const data = JSON.parse(text) as JsonRpcMessage;
    if (typeof data !== "object" || data === null) return undefined;
    return data;
  } catch {
    return undefined;
  }
}

export function packageJsonRpc(message: JsonRpcMessage): string {
  return JSON.stringify(message);
}

export function sendJsonRpc(peer: JsonRpcPeer, message: JsonRpcMessage): void {
  peer.send(packageJsonRpc(message));
}

export function isJsonRpcRequestId(value: unknown): value is string | number {
  return typeof value === "string" || typeof value === "number";
}
