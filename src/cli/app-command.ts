import { ExecutorFactory } from "../factory/executor-factory.ts";
import type { AndroidIntentExtra, AndroidLaunchIntent, LaunchOptions, Platform } from "../types.ts";
import { readOptions, requireOption } from "./args.ts";
import { readPlatform } from "./platform.ts";

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
  if (platform === "ios") {
    return { env: readLaunchEnv(args) };
  }
  return { androidIntent: readAndroidIntent(args) };
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

function copyStringOption(args: string[], target: Record<string, unknown>, option: string, key: string): void {
  const index = args.indexOf(option);
  if (index === -1) return;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`Missing value for ${option}.`);
  }
  target[key] = value;
}
