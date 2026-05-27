import { execFile } from "../process/executor.ts";
import type { AndroidIntentExtra, AndroidLaunchIntent, CommandResult, LaunchOptions } from "../types.ts";
import type { Backend } from "./backend.ts";

export class AndroidBackend implements Backend {
  readonly platform = "android";

  listDevices(): Promise<CommandResult> {
    return runAdb(["devices", "-l"]);
  }

  install(device: string, appPath: string): Promise<CommandResult> {
    return runAdb(["-s", device, "install", "-r", appPath]);
  }

  launch(device: string, bundleId: string, launchOptions: LaunchOptions = {}): Promise<CommandResult> {
    const intent = launchOptions.androidIntent;
    if (!intent || isEmptyIntent(intent)) {
      return runAdb(["-s", device, "shell", "monkey", "-p", bundleId, "1"]);
    }

    return runAdb(["-s", device, ...buildAmStartArgs(intent)]);
  }

  stop(device: string, bundleId: string): Promise<CommandResult> {
    return runAdb(["-s", device, "shell", "am", "force-stop", bundleId]);
  }

  tap(device: string, point: string): Promise<CommandResult> {
    const { x, y } = parsePoint(point);
    return runAdb(["-s", device, "shell", "input", "tap", String(x), String(y)]);
  }

  swipe(device: string, from: string, to: string): Promise<CommandResult> {
    const start = parsePoint(from);
    const end = parsePoint(to);
    return runAdb([
      "-s",
      device,
      "shell",
      "input",
      "swipe",
      String(start.x),
      String(start.y),
      String(end.x),
      String(end.y),
      "400",
    ]);
  }

  pullAppLogFile(_device: string, _bundleId: string, _remotePath: string, _localPath: string): Promise<CommandResult> {
    return runAdb(["-s", _device, "pull", _remotePath, _localPath]);
  }
}

function runAdb(args: string[]): Promise<CommandResult> {
  return execFile("adb", args);
}

function buildAmStartArgs(intent: AndroidLaunchIntent): string[] {
  const args = ["shell", "am", "start"];

  if (intent.component) args.push("-n", intent.component);
  if (intent.action) args.push("-a", intent.action);
  if (intent.data) args.push("-d", intent.data);
  if (intent.mimeType) args.push("-t", intent.mimeType);
  for (const category of intent.categories ?? []) args.push("-c", category);
  for (const flag of intent.flags ?? []) args.push("-f", flag);
  for (const extra of intent.extras ?? []) args.push(...buildExtraArgs(extra));

  return args;
}

function buildExtraArgs(extra: AndroidIntentExtra): string[] {
  switch (extra.type) {
    case "string":
      return ["--es", extra.key, requireStringValue(extra)];
    case "int":
      return ["--ei", extra.key, String(requireNumberValue(extra))];
    case "long":
      return ["--el", extra.key, String(requireNumberValue(extra))];
    case "float":
      return ["--ef", extra.key, String(requireNumberValue(extra))];
    case "boolean":
      return ["--ez", extra.key, String(requireBooleanValue(extra))];
    case "string-array":
      return ["--esa", extra.key, requireStringArrayValue(extra).join(",")];
    case "int-array":
      return ["--eia", extra.key, requireNumberArrayValue(extra).join(",")];
  }
}

function requireStringValue(extra: AndroidIntentExtra): string {
  if (typeof extra.value !== "string") {
    throw new Error(`Android intent extra ${extra.key} must be a string.`);
  }
  return extra.value;
}

function requireNumberValue(extra: AndroidIntentExtra): number {
  if (typeof extra.value !== "number" || !Number.isFinite(extra.value)) {
    throw new Error(`Android intent extra ${extra.key} must be a finite number.`);
  }
  return extra.value;
}

function requireBooleanValue(extra: AndroidIntentExtra): boolean {
  if (typeof extra.value !== "boolean") {
    throw new Error(`Android intent extra ${extra.key} must be a boolean.`);
  }
  return extra.value;
}

function requireStringArrayValue(extra: AndroidIntentExtra): string[] {
  if (!Array.isArray(extra.value) || extra.value.some((value) => typeof value !== "string")) {
    throw new Error(`Android intent extra ${extra.key} must be a string array.`);
  }
  return extra.value as string[];
}

function requireNumberArrayValue(extra: AndroidIntentExtra): number[] {
  if (!Array.isArray(extra.value) || extra.value.some((value) => typeof value !== "number" || !Number.isFinite(value))) {
    throw new Error(`Android intent extra ${extra.key} must be a finite number array.`);
  }
  return extra.value as number[];
}

function isEmptyIntent(intent: AndroidLaunchIntent): boolean {
  return !intent.component &&
    !intent.action &&
    !intent.data &&
    !intent.mimeType &&
    (!intent.categories || intent.categories.length === 0) &&
    (!intent.flags || intent.flags.length === 0) &&
    (!intent.extras || intent.extras.length === 0);
}

function parsePoint(value: string): { x: number; y: number } {
  const [xRaw, yRaw] = value.split(",");
  const x = Number(xRaw);
  const y = Number(yRaw);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`Invalid point: ${value}. Expected x,y.`);
  }
  return { x, y };
}
