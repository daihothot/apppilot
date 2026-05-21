import { WDA_DEFAULT_URL } from "../constants.ts";
import { execFile } from "../process/executor.ts";
import { requireLocalPymobiledevice3Path } from "../tools/local-python.ts";
import type { CommandResult } from "../types.ts";
import type { Backend } from "./backend.ts";

export class IosBackend implements Backend {
  readonly platform = "ios";

  listDevices(): Promise<CommandResult> {
    return runPymobiledevice3(["usbmux", "list"]);
  }

  install(device: string, appPath: string): Promise<CommandResult> {
    return runPymobiledevice3(["apps", "install", appPath], device);
  }

  launch(device: string, bundleId: string, launchEnv: Record<string, string> = {}): Promise<CommandResult> {
    const envArgs = Object.entries(launchEnv).flatMap(([key, value]) => ["--env", `${key}=${value}`]);
    return runPymobiledevice3(["developer", "dvt", "launch", bundleId, ...envArgs], device);
  }

  stop(device: string, bundleId: string): Promise<CommandResult> {
    return runWda("terminate", "POST", "/wda/apps/terminate", { bundleId });
  }

  tap(device: string, point: string): Promise<CommandResult> {
    const { x, y } = parsePoint(point);
    return runWdaAction("tap", {
      actions: [
        {
          type: "pointer",
          id: "finger1",
          parameters: { pointerType: "touch" },
          actions: [
            { type: "pointerMove", duration: 0, x, y },
            { type: "pointerDown", button: 0 },
            { type: "pause", duration: 100 },
            { type: "pointerUp", button: 0 },
          ],
        },
      ],
    });
  }

  swipe(device: string, from: string, to: string): Promise<CommandResult> {
    const start = parsePoint(from);
    const end = parsePoint(to);
    return runWdaAction("swipe", {
      fromX: start.x,
      fromY: start.y,
      toX: end.x,
      toY: end.y,
      duration: 0.4,
    }, "/wda/dragfromtoforduration");
  }

  pullAppLogFile(device: string, bundleId: string, remotePath: string, localPath: string): Promise<CommandResult> {
    return runPymobiledevice3(["apps", "pull", bundleId, remotePath, localPath], device);
  }

}

function runPymobiledevice3(args: string[], device?: string): Promise<CommandResult> {
  const command = requireLocalPymobiledevice3Path();
  const env = device ? { ...process.env, PYMOBILEDEVICE3_UDID: device } : process.env;
  return execFile(command, args, { env });
}

async function runWdaAction(name: string, payload: unknown, endpoint = "/actions"): Promise<CommandResult> {
  const session = await runWda(`${name}:session`, "POST", "/session", { capabilities: {} }, false);
  if (session.exitCode !== 0) {
    return session;
  }

  const sessionId = readWdaSessionId(session.stdout);
  if (!sessionId) {
    return {
      command: "wda",
      args: [`${WDA_DEFAULT_URL}/session`],
      exitCode: 1,
      stdout: session.stdout,
      stderr: "WDA session response did not include a session id.",
    };
  }

  return runWda(name, "POST", `/session/${sessionId}${endpoint}`, payload);
}

async function runWda(name: string, method: "GET" | "POST", path: string, payload?: unknown, requireOk = true): Promise<CommandResult> {
  const url = `${process.env.APPPILOT_WDA_URL ?? WDA_DEFAULT_URL}${path}`;
  try {
    const response = await fetch(url, {
      method,
      headers: payload === undefined ? undefined : { "content-type": "application/json" },
      body: payload === undefined ? undefined : JSON.stringify(payload),
    });
    const text = await response.text();
    const ok = !requireOk || response.ok;
    return {
      command: "wda",
      args: [method, url],
      exitCode: ok ? 0 : 1,
      stdout: text,
      stderr: ok ? "" : `WDA request failed with HTTP ${response.status}: ${text}`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      command: "wda",
      args: [method, url],
      exitCode: 1,
      stdout: "",
      stderr: `WDA request failed: ${message}`,
    };
  }
}

function readWdaSessionId(text: string): string | undefined {
  try {
    const data = JSON.parse(text) as { sessionId?: string; value?: { sessionId?: string } };
    return data.sessionId ?? data.value?.sessionId;
  } catch {
    return undefined;
  }
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
