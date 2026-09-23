import { randomUUID } from "node:crypto";
import type { AppPilotResult } from "../../port/app-pilot-operation-port.ts";
import { readOption } from "../args.ts";

export async function invokeOperation<T>(
  args: string[],
  operation: () => Promise<AppPilotResult<T>>,
): Promise<object> {
  let id = "invalid";
  try {
    id = readOption(args, "--id") ?? randomUUID();
    const result = await operation();
    return result.ok ? { id, ok: true, value: result.value } : { id, ...result };
  } catch (error) {
    return {
      id,
      ok: false,
      code: "invalid_request",
      message: error instanceof Error ? error.message : String(error),
    };
  }
}
