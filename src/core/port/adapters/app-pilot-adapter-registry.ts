import type { AppPilotFailure, AppPilotIdentity, AppPilotResult } from "../app-pilot-operation-port.ts";
import type { AppPilotAdapter } from "./app-pilot-adapter.ts";

export type AdapterSelectionResult =
  | { ok: true; adapter: AppPilotAdapter; identity: AppPilotIdentity }
  | AppPilotFailure;

/** Selects transports and platform executors deterministically. Explicit transport selection never falls back. */
export class AppPilotAdapterRegistry {
  private activeAdapter?: AppPilotAdapter;

  constructor(private readonly adapters: readonly AppPilotAdapter[]) {}

  async handshake(transport?: string): Promise<AdapterSelectionResult> {
    this.invalidateActiveAdapter();
    if (transport) {
      const adapter = this.adapters.find((candidate) => candidate.transport === transport);
      if (!adapter) return failure("transport_unknown", `Transport ${transport} is not registered.`);
      const result = await adapter.handshake();
      if (result.status === "connected") {
        this.activeAdapter = adapter;
        return { ok: true, adapter, identity: result.identity };
      }
      return result.status === "failed"
        ? failure(result.code, result.message)
        : failure("transport_unavailable", `Transport ${transport} has no available platform.`);
    }

    let firstFailure: AppPilotFailure | undefined;
    for (const adapter of this.adapters) {
      const result = await adapter.handshake();
      if (result.status === "connected") {
        this.activeAdapter = adapter;
        return { ok: true, adapter, identity: result.identity };
      }
      if (result.status === "failed") firstFailure ??= failure(result.code, result.message);
    }
    return firstFailure ?? failure("transport_unavailable", "No registered transport has an available platform.");
  }

  current(): AppPilotResult<AppPilotAdapter> {
    return this.activeAdapter
      ? { ok: true, value: this.activeAdapter }
      : failure("execution_not_discovered", "No execution target is discovered. Call identify first.");
  }

  invalidate(adapter: AppPilotAdapter): void {
    if (this.activeAdapter !== adapter) return;
    this.activeAdapter.invalidateDiscovery();
    this.activeAdapter = undefined;
  }

  private invalidateActiveAdapter(): void {
    this.activeAdapter?.invalidateDiscovery();
    this.activeAdapter = undefined;
  }
}

function failure(code: string, message: string): AppPilotFailure {
  return { ok: false, code, message };
}
