import type { AppPilotLaunchOptions } from "../apppilot/types.ts";
import { ExecutorFactory } from "../core/factory/executor-factory.ts";
import type { AndroidIntentExtra, AndroidLaunchIntent, AndroidLaunchOptions } from "../devices/android/types.ts";
import type { LaunchOptions, Platform } from "../devices/types.ts";
import { readPlatform } from "../devices/platform.ts";
import { readOptions, requireOption } from "./args.ts";

export async function runAppCommand(command: string | undefined, args: string[]): Promise<void> {
  const platform = readPlatform(args);
  const app = new ExecutorFactory().createAppExecutor(platform);

  switch (command) {
    case "devices":
      await app.devices();
      return;
    case "run":
      await app.run(requireOption(args, "--device"), readLaunchOptions(platform, args));
      return;
    case "stop":
      await app.stop(requireOption(args, "--device"));
      return;
    default:
      throw new Error("Unknown app command. Expected devices, run, or stop.");
  }
}

function readLaunchOptions(platform: Platform, args: string[]): LaunchOptions {
  const appPilot = readAppPilotLaunchOptions(args);
  if (platform === "ios") {
    return { env: readLaunchEnv(args), appPilot };
  }
  const androidOptions: AndroidLaunchOptions = { androidIntent: readAndroidIntent(args), appPilot };
  return androidOptions;
}

function readLaunchEnv(args: string[]): Record<string, string> {
  const env: Record<string, string> = {};
  for (const item of readOptions(args, "--env")) {
    const equals = item.indexOf("=");
    if (equals <= 0) {
      throw new Error(`Invalid --env value ${item}. Expected KEY=VALUE.`);
    }
    const key = item.slice(0, equals);
    const value = item.slice(equals + 1);
    env[key] = value;
  }
  return env;
}

function readAndroidIntent(args: string[]): AndroidLaunchIntent | undefined {
  const intent: AndroidLaunchIntent = {};
  copyStringOption(args, intent, "--component", "component");
  copyStringOption(args, intent, "--intent-action", "action");
  copyStringOption(args, intent, "--data", "data");
  copyStringOption(args, intent, "--mime-type", "mimeType");
  intent.categories = readOptions(args, "--category");
  intent.flags = readOptions(args, "--flag");
  intent.extras = [
    ...readExtraStrings(args, "--es", "string"),
    ...readExtraStrings(args, "--ei", "int"),
    ...readExtraStrings(args, "--el", "long"),
    ...readExtraStrings(args, "--ef", "float"),
    ...readExtraStrings(args, "--ez", "boolean"),
    ...readExtraStrings(args, "--esa", "string-array"),
    ...readExtraStrings(args, "--eia", "int-array"),
  ];

  if (!intent.component && !intent.action && !intent.data && !intent.mimeType && intent.categories.length === 0 && intent.flags.length === 0 && intent.extras.length === 0) {
    return undefined;
  }

  return intent;
}

function readExtraStrings(args: string[], option: string, type: AndroidIntentExtra["type"]): AndroidIntentExtra[] {
  const extras: AndroidIntentExtra[] = [];
  for (const values of readExtraPairs(args, option)) {
    extras.push({
      type,
      key: values[0],
      value: parseAndroidExtraValue(type, values[1]),
    });
  }
  return extras;
}

function readExtraPairs(args: string[], option: string): Array<[string, string]> {
  const pairs: Array<[string, string]> = [];
  for (let index = 0; index < args.length; index++) {
    if (args[index] !== option) continue;
    const key = args[index + 1];
    const value = args[index + 2];
    if (!key || key.startsWith("--") || !value || value.startsWith("--")) {
      throw new Error(`${option} requires KEY VALUE.`);
    }
    pairs.push([key, value]);
  }
  return pairs;
}

function parseAndroidExtraValue(type: AndroidIntentExtra["type"], value: string): AndroidIntentExtra["value"] {
  if (type === "int" || type === "long" || type === "float") {
    return Number(value);
  }
  if (type === "boolean") {
    if (value !== "true" && value !== "false") {
      throw new Error("Boolean Android extras must be true or false.");
    }
    return value === "true";
  }
  if (type === "string-array") {
    return value.split(",").filter((item) => item.length > 0);
  }
  if (type === "int-array") {
    return value.split(",").filter((item) => item.length > 0).map((item) => Number(item));
  }
  return value;
}

function copyStringOption<T extends object, K extends keyof T>(args: string[], target: T, option: string, key: K): void {
  const index = args.indexOf(option);
  if (index === -1) return;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`Missing value for ${option}.`);
  }
  target[key] = value as T[K];
}

function readAppPilotLaunchOptions(args: string[]): AppPilotLaunchOptions | undefined {
  const enabled = args.includes("--apppilot") || args.includes("--apppilot-enable");
  const rootName = readOption(args, "--apppilot-root");
  const portRaw = readOption(args, "--apppilot-port");
  const waitMsRaw = readOption(args, "--apppilot-wait-ms");
  if (!enabled && !rootName && !portRaw && !waitMsRaw) {
    return undefined;
  }

  return {
    enabled: true,
    rootName,
    port: portRaw ? parseNumberOption("--apppilot-port", portRaw) : undefined,
    waitMs: waitMsRaw ? parseNumberOption("--apppilot-wait-ms", waitMsRaw) : undefined,
  };
}

function readOption(args: string[], option: string): string | undefined {
  const index = args.indexOf(option);
  if (index === -1) return undefined;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`Missing value for ${option}.`);
  }
  return value;
}

function parseNumberOption(option: string, value: string): number {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new Error(`${option} must be a finite number.`);
  }
  return number;
}
