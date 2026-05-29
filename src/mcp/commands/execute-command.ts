import { appPilotActions } from "../../apppilot/app-pilot-actions.ts";
import type { AppPilotGetNodeAttrsParams } from "../../apppilot/app-pilot-protocol.ts";
import type { AppPilotLaunchOptions } from "../../apppilot/types.ts";
import { DeviceDriverFactory } from "../../core/factory/device-driver-factory.ts";
import { ExecutorFactory } from "../../core/factory/executor-factory.ts";
import { listIosDevices } from "../device.ts";
import type { McpTool } from "../mcp-tool.ts";
import { requireNumber, requireString } from "../mcp-tool.ts";
import type { AndroidIntentExtra, AndroidLaunchIntent, AndroidLaunchOptions } from "../../devices/android/types.ts";
import type { LaunchOptions, Platform } from "../../devices/types.ts";

export const executeTools: McpTool[] = [
  {
    name: "execute",
    description: "Run an executor command. Supports platform=ios/android for app/action, and platform-free apppilot actions.",
    inputSchema: {
      type: "object",
      properties: {
        platform: { type: "string", enum: ["ios", "android"] },
        domain: { type: "string", enum: ["app", "action", "apppilot"] },
        action: { type: "string", description: "app: devices/run/stop; action: tap/swipe; apppilot: status/ping/queryNodes/getNodeAttrs/call." },
        device: { type: "string", description: "iOS UDID or Android adb serial. Required except for app devices." },
        appPilot: {
          type: "object",
          description: "Enable AppPilot Unity websocket launch flow for app run.",
          properties: {
            enabled: { type: "boolean" },
            rootName: { type: "string" },
            port: { type: "number" },
            waitMs: { type: "number" },
          },
        },
        params: {
          type: "object",
          description: "AppPilot JSON-RPC params for domain=apppilot actions.",
        },
        method: {
          type: "string",
          description: "Raw app-side JSON-RPC method for domain=apppilot action=call.",
        },
        env: {
          type: "object",
          description: "iOS launch environment variables for app run, for example { DEBUG_MODE: 'true' }.",
          additionalProperties: { type: "string" },
        },
        intent: {
          type: "object",
          description: "Android am start intent options. Supports component/action/data/mimeType/categories/flags/extras.",
          properties: {
            component: { type: "string", description: "-n component, for example com.example.app/.MainActivity" },
            action: { type: "string", description: "-a action, for example android.intent.action.VIEW" },
            data: { type: "string", description: "-d URI data" },
            mimeType: { type: "string", description: "-t MIME type" },
            categories: { type: "array", items: { type: "string" } },
            flags: { type: "array", items: { type: "string" } },
            extras: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  type: { type: "string", enum: ["string", "int", "long", "float", "boolean", "string-array", "int-array"] },
                  key: { type: "string" },
                  value: {},
                },
                required: ["type", "key", "value"],
              },
            },
          },
        },
        x: { type: "number" },
        y: { type: "number" },
        fromX: { type: "number" },
        fromY: { type: "number" },
        toX: { type: "number" },
        toY: { type: "number" },
      },
      required: ["domain", "action"],
    },
    async call(input) {
      const domain = requireString(input, "domain");
      const action = requireString(input, "action");

      if (domain === "app") {
        const platform = requireSupportedPlatform(requireString(input, "platform"));
        return executeApp(platform, action, input);
      }
      if (domain === "action") {
        const platform = requireSupportedPlatform(requireString(input, "platform"));
        return executeAction(platform, action, input);
      }
      if (domain === "apppilot") {
        return executeAppPilot(action, input);
      }
      throw new Error("Unsupported execute domain: " + domain);
    },
  },
];

async function executeApp(platform: Platform, action: string, input?: Record<string, unknown>): Promise<unknown> {
  if (action === "devices") {
    if (platform === "ios") {
      return listIosDevices();
    }
    const result = await new DeviceDriverFactory().create(platform).listDevices();
    if (result.exitCode !== 0) {
      throw new Error(result.stderr.trim() || `Failed to list ${platform} devices.`);
    }
    return result.stdout;
  }

  const device = requireString(input ?? {}, "device");
  const executor = new ExecutorFactory().createAppExecutor(platform);
  if (action === "run") {
    await executor.run(device, readLaunchOptions(platform, input ?? {}));
    return `${platform} app installed and launched.`;
  }
  if (action === "stop") {
    await executor.stop(device);
    return `${platform} app stopped.`;
  }

  throw new Error("Unsupported app action: " + action);
}

async function executeAction(platform: Platform, action: string, input: Record<string, unknown>): Promise<string> {
  const device = requireString(input, "device");
  const executor = new ExecutorFactory().createActionExecutor(platform);

  if (action === "tap") {
    const point = String(requireNumber(input, "x")) + "," + String(requireNumber(input, "y"));
    await executor.tap(device, point);
    return `${platform} tap finished.`;
  }

  if (action === "swipe") {
    const from = String(requireNumber(input, "fromX")) + "," + String(requireNumber(input, "fromY"));
    const to = String(requireNumber(input, "toX")) + "," + String(requireNumber(input, "toY"));
    await executor.swipe(device, from, to);
    return `${platform} swipe finished.`;
  }

  throw new Error("Unsupported device action: " + action);
}

function readLaunchOptions(platform: Platform, input: Record<string, unknown>): LaunchOptions {
  const appPilot = readAppPilotLaunchOptions(input);
  if (platform === "ios") {
    return { env: readLaunchEnv(input), appPilot };
  }

  const androidOptions: AndroidLaunchOptions = { androidIntent: readAndroidIntent(input.intent), appPilot };
  return androidOptions;
}

async function executeAppPilot(action: string, input: Record<string, unknown>): Promise<unknown> {
  if (action === "status") {
    return appPilotActions.status();
  }

  if (action === "ping") {
    return appPilotActions.ping(readObjectParams(input));
  }

  if (action === "queryNodes") {
    return appPilotActions.queryNodes(readObjectParams(input));
  }

  if (action === "getNodeAttrs") {
    return appPilotActions.getNodeAttrs(readGetNodeAttrsParams(input));
  }

  if (action === "call") {
    return appPilotActions.rawCall(requireString(input, "method"), readRpcParams(input));
  }

  throw new Error("Unsupported apppilot action: " + action);
}

function readRpcParams(input: Record<string, unknown>): unknown {
  return input.params ?? {};
}

function readObjectParams(input: Record<string, unknown>): Record<string, unknown> {
  const params = readRpcParams(input);
  if (typeof params !== "object" || params === null || Array.isArray(params)) {
    throw new Error("params must be an object.");
  }
  return params as Record<string, unknown>;
}

function readGetNodeAttrsParams(input: Record<string, unknown>): AppPilotGetNodeAttrsParams {
  const params = readObjectParams(input);
  if (typeof params.path !== "string" || params.path.length === 0) {
    throw new Error("params.path must be a non-empty string.");
  }
  return params as AppPilotGetNodeAttrsParams;
}

function readLaunchEnv(input: Record<string, unknown>): Record<string, string> {
  const value = input.env;
  if (value === undefined || value === null) {
    return {};
  }
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Error("env must be an object of string values.");
  }

  const env: Record<string, string> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (typeof item !== "string") {
      throw new Error(`env.${key} must be a string.`);
    }
    env[key] = item;
  }
  return env;
}

function readAppPilotLaunchOptions(input: Record<string, unknown>): AppPilotLaunchOptions | undefined {
  const value = input.appPilot;
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Error("appPilot must be an object.");
  }

  const item = value as Record<string, unknown>;
  return {
    enabled: item.enabled === undefined ? true : readOptionalBoolean(item, "enabled"),
    rootName: readOptionalString(item, "rootName"),
    port: readOptionalNumber(item, "port"),
    waitMs: readOptionalNumber(item, "waitMs"),
  };
}

function readAndroidIntent(value: unknown): AndroidLaunchIntent | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Error("intent must be an object.");
  }

  const input = value as Record<string, unknown>;
  return {
    component: readOptionalString(input, "component"),
    action: readOptionalString(input, "action"),
    data: readOptionalString(input, "data"),
    mimeType: readOptionalString(input, "mimeType"),
    categories: readOptionalStringArray(input, "categories"),
    flags: readOptionalStringArray(input, "flags"),
    extras: readAndroidExtras(input.extras),
  };
}

function readAndroidExtras(value: unknown): AndroidIntentExtra[] | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    throw new Error("intent.extras must be an array.");
  }

  return value.map((item, index) => {
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      throw new Error(`intent.extras[${index}] must be an object.`);
    }
    const input = item as Record<string, unknown>;
    const type = requireString(input, "type");
    if (!isAndroidExtraType(type)) {
      throw new Error(`intent.extras[${index}].type is unsupported: ${type}`);
    }
    return {
      type,
      key: requireString(input, "key"),
      value: input.value as AndroidIntentExtra["value"],
    };
  });
}

function isAndroidExtraType(value: string): value is AndroidIntentExtra["type"] {
  return ["string", "int", "long", "float", "boolean", "string-array", "int-array"].includes(value);
}

function readOptionalString(input: Record<string, unknown>, key: string): string | undefined {
  const value = input[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") {
    throw new Error(`intent.${key} must be a string.`);
  }
  return value;
}

function readOptionalStringArray(input: Record<string, unknown>, key: string): string[] | undefined {
  const value = input[key];
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`intent.${key} must be a string array.`);
  }
  return value;
}

function readOptionalBoolean(input: Record<string, unknown>, key: string): boolean | undefined {
  const value = input[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "boolean") {
    throw new Error(`appPilot.${key} must be a boolean.`);
  }
  return value;
}

function readOptionalNumber(input: Record<string, unknown>, key: string): number | undefined {
  const value = input[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`appPilot.${key} must be a finite number.`);
  }
  return value;
}

function requireSupportedPlatform(platform: string): Platform {
  if (platform === "ios" || platform === "android") {
    return platform;
  }
  throw new Error("Unsupported execute platform: " + platform);
}
