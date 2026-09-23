import { createInterface } from "node:readline";
import type { Readable, Writable } from "node:stream";
import type { AppPilotScope } from "./app-pilot-scope.ts";

interface AppPilotProcessRequest {
  id: string;
  args: string[];
}

/** Keeps one AppPilot Scope alive while an external owner submits CLI requests. */
export async function runAppPilotProcess(
  scope: AppPilotScope,
  input: Readable = process.stdin,
  output: Writable = process.stdout,
): Promise<void> {
  output.write(JSON.stringify({ type: "ready", protocolVersion: 1 }) + "\n");
  const lines = createInterface({ input, crlfDelay: Infinity });
  for await (const line of lines) {
    if (!line.trim()) continue;
    let id = "invalid";
    try {
      const request = parseRequest(line);
      id = request.id;
      if (request.args.includes("--id")) {
        throw new Error("Process requests must use the request id instead of --id.");
      }
      const result = await scope.cli.invoke([...request.args, "--id", request.id]);
      output.write(JSON.stringify(normalizeResponse(request.id, result)) + "\n");
    } catch (error) {
      output.write(JSON.stringify({
        id,
        ok: false,
        code: "invalid_request",
        message: error instanceof Error ? error.message : String(error),
      }) + "\n");
    }
  }
}

function parseRequest(line: string): AppPilotProcessRequest {
  const value = JSON.parse(line) as unknown;
  if (!isRecord(value)
    || typeof value.id !== "string"
    || value.id.length === 0
    || !Array.isArray(value.args)
    || value.args.some((entry) => typeof entry !== "string")) {
    throw new Error("AppPilot process requests require a non-empty id and string args.");
  }
  return { id: value.id, args: value.args as string[] };
}

function normalizeResponse(id: string, result: string | object): object {
  if (isRecord(result) && result.id === id && typeof result.ok === "boolean") return result;
  return { id, ok: true, value: result };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
