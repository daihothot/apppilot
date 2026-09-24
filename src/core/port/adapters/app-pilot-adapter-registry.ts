import type { AppPilotFailure, AppPilotIdentity, AppPilotResult } from "../app-pilot-operation-port.ts";
import type { AppPilotAdapter } from "./app-pilot-adapter.ts";

export type AdapterSelectionResult =
  | { ok: true; adapter: AppPilotAdapter; identity: AppPilotIdentity }
  | AppPilotFailure;

/** Selects transports and platform executors deterministically. Explicit transport selection never falls back. */
export class AppPilotAdapterRegistry {
  constructor(private readonly adapters: readonly AppPilotAdapter[]) {}

  async handshake(transport?: string): Promise<AdapterSelectionResult> {
    if (transport) {
      const adapter = this.adapters.find((candidate) => candidate.transport === transport);
      if (!adapter) return failure("transport_unknown", `Transport ${transport} is not registered.`);
      const result = await adapter.handshake();
      if (result.status === "connected") {
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
        return { ok: true, adapter, identity: result.identity };
      }
      if (result.status === "failed") firstFailure ??= failure(result.code, result.message);
    }
    return firstFailure ?? failure("transport_unavailable", "No registered transport has an available platform.");
  }

  resolve(identity: AppPilotIdentity): AppPilotResult<AppPilotAdapter> {
    const adapter = this.adapters.find((candidate) => candidate.transport === identity.transport);
    return adapter
      ? { ok: true, value: adapter }
      : failure("transport_unknown", `Transport ${identity.transport} is not registered.`);
  }
}

function failure(code: string, message: string): AppPilotFailure {
  return { ok: false, code, message };
}
