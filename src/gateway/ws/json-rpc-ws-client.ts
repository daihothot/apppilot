import { isJsonRpcRequestId, packageJsonRpc, parseJsonRpc, type JsonRpcMessage } from "../protocol/json-rpc.ts";

interface PendingRequest {
  resolve(value: unknown): void;
  reject(error: Error): void;
  timeout: ReturnType<typeof setTimeout>;
}

export class JsonRpcWsClient {
  private socket?: WebSocket;
  private nextRequestId = 1;
  private openCount = 0;
  private readonly pending = new Map<string | number, PendingRequest>();
  private readonly openWaiters: Array<(opened: boolean) => void> = [];

  get connected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  get connectionCount(): number {
    return this.openCount;
  }

  connect(address: string): void {
    if (this.connected) return;

    const url = address.startsWith("ws://") || address.startsWith("wss://") ? address : `ws://${address}`;
    const socket = new WebSocket(url);
    this.socket = socket;

    socket.addEventListener("open", () => {
      if (this.socket === socket) {
        this.openCount += 1;
      }
      this.resolveOpenWaiters(true);
    });
    socket.addEventListener("message", (event) => {
      this.handleMessage(String(event.data));
    });
    socket.addEventListener("close", () => {
      if (this.socket === socket) {
        this.socket = undefined;
        this.rejectPending(new Error("WebSocket JSON-RPC client disconnected."));
        this.resolveOpenWaiters(false);
      }
    });
    socket.addEventListener("error", () => {
      if (this.socket === socket && socket.readyState !== WebSocket.OPEN) {
        this.socket = undefined;
        this.resolveOpenWaiters(false);
      }
    });
  }

  disconnect(): void {
    const socket = this.socket;
    this.socket = undefined;
    this.rejectPending(new Error("WebSocket JSON-RPC client disconnected."));
    this.resolveOpenWaiters(false);
    socket?.close();
  }

  async waitForOpen(timeoutMs: number): Promise<boolean> {
    if (this.connected) return true;
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        remove();
        resolve(false);
      }, timeoutMs);
      const waiter = (opened: boolean) => {
        clearTimeout(timeout);
        remove();
        resolve(opened);
      };
      const remove = () => {
        const index = this.openWaiters.indexOf(waiter);
        if (index >= 0) this.openWaiters.splice(index, 1);
      };
      this.openWaiters.push(waiter);
    });
  }

  call(method: string, params?: unknown, timeoutMs = 10_000): Promise<unknown> {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      throw new Error("WebSocket JSON-RPC client is not connected.");
    }

    const id = this.nextRequestId++;
    const message: JsonRpcMessage = { jsonrpc: "2.0", id, method, params };
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`WebSocket JSON-RPC request timed out: ${method}`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timeout });
      try {
        this.socket?.send(packageJsonRpc(message));
      } catch (error) {
        this.pending.delete(id);
        clearTimeout(timeout);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  private handleMessage(text: string): void {
    const message = parseJsonRpc(text);
    if (!message || !isJsonRpcRequestId(message.id)) return;
    const pending = this.pending.get(message.id);
    if (!pending) return;
    this.pending.delete(message.id);
    clearTimeout(pending.timeout);
    if (message.error) {
      pending.reject(new Error(message.error.message));
      return;
    }
    pending.resolve(message.result);
  }

  private resolveOpenWaiters(opened: boolean): void {
    for (const waiter of this.openWaiters.splice(0)) waiter(opened);
  }

  private rejectPending(error: Error): void {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timeout);
      pending.reject(error);
    }
    this.pending.clear();
  }
}
