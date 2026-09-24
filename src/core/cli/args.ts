export function hasFlag(args: string[], flag: string): boolean {
  return args.includes(flag);
}

export function readOption(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index === -1) return undefined;
  const value = args[index + 1];
  return value && !value.startsWith("--") ? value : undefined;
}

export function readOptions(args: string[], name: string): string[] {
  const values: string[] = [];
  for (let index = 0; index < args.length; index++) {
    if (args[index] !== name) continue;
    const value = args[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for ${name}.`);
    }
    values.push(value);
  }
  return values;
}

export function readDictionaryOptions(
  args: string[],
  name: string,
): Readonly<Record<string, string>> | undefined {
  const entries = readOptions(args, name);
  if (entries.length === 0) return undefined;
  const result: Record<string, string> = {};
  for (const entry of entries) {
    const equals = entry.indexOf("=");
    if (equals <= 0) {
      throw new Error(`Invalid ${name} value ${entry}. Expected KEY=VALUE.`);
    }
    result[entry.slice(0, equals)] = entry.slice(equals + 1);
  }
  return result;
}

export function readNumberOption(args: string[], name: string): number | undefined {
  const value = readOption(args, name);
  return value === undefined ? undefined : Number(value);
}

export function readIdentityOption(args: string[]): AppPilotIdentity {
  const raw = readOption(args, "--identity");
  if (!raw) throw new Error("Missing value for --identity.");
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error("Invalid --identity JSON.");
  }
  if (!isRecord(value)
    || typeof value.transport !== "string"
    || !value.transport.trim()
    || !isRecord(value.platform)
    || typeof value.platform.type !== "string"
    || !value.platform.type.trim()
    || typeof value.platform.version !== "string"
    || !value.platform.version.trim()) {
    throw new Error("--identity requires transport and platform type/version.");
  }
  return {
    transport: value.transport,
    platform: { type: value.platform.type, version: value.platform.version },
  };
}

export function requirePositional(value: string | undefined, name: string): string {
  if (!value || value.startsWith("-")) {
    throw new Error(`Missing required ${name}.`);
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
import type { AppPilotIdentity } from "../port/app-pilot-operation-port.ts";
