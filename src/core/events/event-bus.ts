import type { AppPilotEventMap, AppPilotEventName } from "./events.ts";

export type EventEmitMode = "wait" | "forget";
export type EventHandler<TContext> = (context: TContext) => void | Promise<void>;

export class EventBus<TEvents extends object> {
  private readonly handlers = new Map<keyof TEvents, Array<EventHandler<TEvents[keyof TEvents]>>>();

  on<TName extends keyof TEvents>(name: TName, handler: EventHandler<TEvents[TName]>): () => void {
    const handlers = this.handlers.get(name) ?? [];
    handlers.push(handler as EventHandler<TEvents[keyof TEvents]>);
    this.handlers.set(name, handlers);

    return () => {
      const current = this.handlers.get(name);
      if (!current) return;
      const index = current.indexOf(handler as EventHandler<TEvents[keyof TEvents]>);
      if (index >= 0) current.splice(index, 1);
      if (current.length === 0) this.handlers.delete(name);
    };
  }

  async emit<TName extends keyof TEvents>(name: TName, context: TEvents[TName], mode: EventEmitMode = "wait"): Promise<TEvents[TName]> {
    if (mode === "forget") {
      this.emitForget(name, context);
      return context;
    }
    return this.emitWait(name, context);
  }

  async emitWait<TName extends keyof TEvents>(name: TName, context: TEvents[TName]): Promise<TEvents[TName]> {
    for (const handler of [...(this.handlers.get(name) ?? [])]) {
      await handler(context);
    }
    return context;
  }

  emitForget<TName extends keyof TEvents>(name: TName, context: TEvents[TName]): void {
    for (const handler of [...(this.handlers.get(name) ?? [])]) {
      Promise.resolve()
        .then(() => handler(context))
        .catch((error) => {
          const message = error instanceof Error ? error.message : String(error);
          console.error(`AppPilot event handler failed for ${String(name)}: ${message}`);
        });
    }
  }
}

export const eventBus = new EventBus<AppPilotEventMap>();

export type { AppPilotEventMap, AppPilotEventName };
