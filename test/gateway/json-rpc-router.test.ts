import { expect, test } from "bun:test";
import { JsonRpcRouter } from "../../src/gateway/protocol/json-rpc-router.ts";
import type { JsonRpcMessage, JsonRpcPeer } from "../../src/gateway/protocol/json-rpc.ts";

function createPeer(): { peer: JsonRpcPeer; sent: JsonRpcMessage[] } {
  const sent: JsonRpcMessage[] = [];
  return {
    sent,
    peer: {
      send(text: string): void {
        sent.push(JSON.parse(text) as JsonRpcMessage);
      },
    },
  };
}

test("JsonRpcRouter dispatches request and sends result", async () => {
  const router = new JsonRpcRouter();
  const { peer, sent } = createPeer();
  router.on("sum", (params) => {
    const input = params as { a: number; b: number };
    return input.a + input.b;
  });

  await router.dispatch(peer, JSON.stringify({ jsonrpc: "2.0", id: 1, method: "sum", params: { a: 2, b: 3 } }));

  expect(sent).toEqual([{ jsonrpc: "2.0", id: 1, result: 5 }]);
});

test("JsonRpcRouter sends unknown-method errors for requests", async () => {
  const router = new JsonRpcRouter();
  const { peer, sent } = createPeer();

  await router.dispatch(peer, JSON.stringify({ jsonrpc: "2.0", id: "req-1", method: "missing" }));

  expect(sent[0]).toMatchObject({
    jsonrpc: "2.0",
    id: "req-1",
    error: { code: -32601 },
  });
});

test("JsonRpcRouter does not respond to notifications", async () => {
  const router = new JsonRpcRouter();
  const { peer, sent } = createPeer();
  router.on("notify", () => ({ ok: true }));

  await router.dispatch(peer, JSON.stringify({ jsonrpc: "2.0", method: "notify" }));

  expect(sent).toEqual([]);
});
