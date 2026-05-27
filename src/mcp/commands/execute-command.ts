import { BackendFactory } from "../../factory/backend-factory.ts";
import { ExecutorFactory } from "../../factory/executor-factory.ts";
import { listIosDevices } from "../device.ts";
import type { McpTool } from "../mcp-tool.ts";
import { requireNumber, requireString } from "../mcp-tool.ts";
import type { AndroidIntentExtra, AndroidLaunchIntent, LaunchOptions, Platform } from "../../types.ts";

export const executeTools: McpTool[] = [
  {
    name: "execute",
    description: "Run an executor command. Supports platform=ios/android, domain=app/action.",
    inputSchema: {
      type: "object",
      properties: {
        platform: { type: "string", enum: ["ios", "android"] },
        domain: { type: "string", enum: ["app", "action"] },
        action: { type: "string", description: "app: devices/run/stop; action: tap/swipe." },
        device: { type: "string", description: "iOS UDID or Android adb serial. Required except for app devices." },
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
      required: ["platform", "domain", "action"],
    },
    async call(input) {
      const platform = requireSupportedPlatform(requireString(input, "platform"));
      const domain = requireString(input, "domain");
      const action = requireString(input, "action");

      if (domain === "app") {
        return executeApp(platform, action, input);
      }
      if (domain === "action") {
        return executeAction(platform, action, input);
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
    const result = await new BackendFactory().create(platform).listDevices();
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
  if (platform === "ios") {
    return { env: readLaunchEnv(input) };
  }

  return { androidIntent: readAndroidIntent(input.intent) };
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

function requireSupportedPlatform(platform: string): Platform {
  if (platform === "ios" || platform === "android") {
    return platform;
  }
  throw new Error("Unsupported execute platform: " + platform);
}
