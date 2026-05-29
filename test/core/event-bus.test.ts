import { expect, test } from "bun:test";
import { EventBus } from "../../src/core/events/event-bus.ts";

interface TestEvents {
  mutate: { value: number; order: string[] };
}

test("EventBus emitWait runs handlers in order and keeps context mutations", async () => {
  const bus = new EventBus<TestEvents>();
  bus.on("mutate", (context) => {
    context.order.push("first");
    context.value += 1;
  });
  bus.on("mutate", async (context) => {
    context.order.push("second");
    context.value += 2;
  });

  const context = await bus.emitWait("mutate", { value: 0, order: [] });

  expect(context).toEqual({ value: 3, order: ["first", "second"] });
});

test("EventBus unsubscribe removes a handler", async () => {
  const bus = new EventBus<TestEvents>();
  const off = bus.on("mutate", (context) => {
    context.value += 1;
  });
  off();

  const context = await bus.emitWait("mutate", { value: 0, order: [] });

  expect(context.value).toBe(0);
});
