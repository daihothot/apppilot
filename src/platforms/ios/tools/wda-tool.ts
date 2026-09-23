export interface WdaResult {
  operation: string;
  ok: boolean;
  response: string;
  error?: string;
}

/** iOS platform tool. It is invoked by a selected executor and is not a transport. */
export class WdaTool {
  constructor(private readonly baseUrl = "http://localhost:8100") {}

  stop(appId: string): Promise<WdaResult> {
    return this.request("stop", "/wda/apps/terminate", { bundleId: appId });
  }

  tap(x: number, y: number): Promise<WdaResult> {
    return this.request("tap", "/actions", { actions: [{
      type: "pointer", id: "finger1", parameters: { pointerType: "touch" }, actions: [
        { type: "pointerMove", duration: 0, x, y }, { type: "pointerDown", button: 0 },
        { type: "pause", duration: 100 }, { type: "pointerUp", button: 0 },
      ],
    }] });
  }

  swipe(fromX: number, fromY: number, toX: number, toY: number): Promise<WdaResult> {
    return this.request("swipe", "/wda/dragfromtoforduration", { fromX, fromY, toX, toY, duration: 0.4 });
  }

  private async request(operation: string, path: string, payload: unknown): Promise<WdaResult> {
    const url = `${this.baseUrl}${path}`;
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const text = await response.text();
      return response.ok
        ? { operation, ok: true, response: text }
        : { operation, ok: false, response: text, error: text };
    } catch (error) {
      return {
        operation,
        ok: false,
        response: "",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
