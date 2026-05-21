import { ExecutorFactory } from "../../factory/executor-factory.ts";
import { listIosDevices } from "../device.ts";
import type { McpTool } from "../mcp-tool.ts";
import { requireNumber, requireString } from "../mcp-tool.ts";

export const executeTools: McpTool[] = [
  {
    name: "execute",
    description: "Run an executor command. Currently supports platform=ios, domain=app/action.",
    inputSchema: {
      type: "object",
      properties: {
        platform: { type: "string", enum: ["ios"] },
        domain: { type: "string", enum: ["app", "action"] },
        action: { type: "string", description: "app: devices/run/stop; action: tap/swipe." },
        device: { type: "string", description: "iOS device UDID. Required except for app devices." },
        env: {
          type: "object",
          description: "Launch environment variables for app run, for example { DEBUG_MODE: 'true' }.",
          additionalProperties: { type: "string" },
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

async function executeApp(platform: "ios", action: string, input?: Record<string, unknown>): Promise<unknown> {
  if (action === "devices") {
    return listIosDevices();
  }

  const device = requireString(input ?? {}, "device");
  const executor = new ExecutorFactory().createAppExecutor(platform);
  if (action === "run") {
    await executor.run(device, readLaunchEnv(input ?? {}));
    return "iOS app installed and launched.";
  }
  if (action === "stop") {
    await executor.stop(device);
    return "iOS app stopped.";
  }

  throw new Error("Unsupported app action: " + action);
}

async function executeAction(platform: "ios", action: string, input: Record<string, unknown>): Promise<string> {
  const device = requireString(input, "device");
  const executor = new ExecutorFactory().createActionExecutor(platform);

  if (action === "tap") {
    const point = String(requireNumber(input, "x")) + "," + String(requireNumber(input, "y"));
    await executor.tap(device, point);
    return "iOS tap finished.";
  }

  if (action === "swipe") {
    const from = String(requireNumber(input, "fromX")) + "," + String(requireNumber(input, "fromY"));
    const to = String(requireNumber(input, "toX")) + "," + String(requireNumber(input, "toY"));
    await executor.swipe(device, from, to);
    return "iOS swipe finished.";
  }

  throw new Error("Unsupported device action: " + action);
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

function requireSupportedPlatform(platform: string): "ios" {
  if (platform === "ios") {
    return platform;
  }
  throw new Error("Unsupported execute platform: " + platform);
}
