import { readdirSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { appPilotConfig } from "../../config/app-pilot-config.ts";
import { execFile } from "../../core/process/executor.ts";
import type { CommandResult } from "../../core/process/types.ts";
import { requireLocalPymobiledevice3Path } from "../../tools/local-python.ts";
import type { DeviceDriver, DeviceLogDump, DeviceLogDumpOptions } from "../device-driver.ts";
import type { LaunchOptions } from "../types.ts";

export class IosDeviceDriver implements DeviceDriver {
  readonly platform = "ios";

  listDevices(): Promise<CommandResult> {
    return runPymobiledevice3(["usbmux", "list"]);
  }

  prepareLaunchOptions(launchOptions: LaunchOptions, params: Record<string, string>): LaunchOptions {
    return {
      ...launchOptions,
      env: {
        ...(launchOptions.env ?? {}),
        ...params,
      },
    };
  }

  install(device: string, appPath: string): Promise<CommandResult> {
    return runPymobiledevice3(["apps", "install", appPath], device);
  }

  launch(device: string, bundleId: string, launchOptions: LaunchOptions = {}): Promise<CommandResult> {
    const launchEnv = launchOptions.env ?? {};
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

  async dumpAppLogs(options: DeviceLogDumpOptions): Promise<DeviceLogDump> {
    const pulled = await pullLogDirectory(options.device, options.bundleId, options.tempDir);
    const selected = selectIosLogFile(pulled.path, options.offset);
    if (!selected) {
      throw new Error("No app log file found at offset " + options.offset + ".");
    }

    return {
      kind: "file",
      path: selected,
      prefix: pulled.prefix,
      sourceName: basename(selected),
      remotePath: pulled.remotePath,
    };
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
      args: [`${appPilotConfig.ios.wdaDefaultUrl}/session`],
      exitCode: 1,
      stdout: session.stdout,
      stderr: "WDA session response did not include a session id.",
    };
  }

  return runWda(name, "POST", `/session/${sessionId}${endpoint}`, payload);
}

async function runWda(name: string, method: "GET" | "POST", path: string, payload?: unknown, requireOk = true): Promise<CommandResult> {
  const url = `${process.env.APPPILOT_WDA_URL ?? appPilotConfig.ios.wdaDefaultUrl}${path}`;
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

async function pullLogDirectory(device: string, bundleId: string, tempDir: string): Promise<{ path: string; prefix: string; remotePath: string }> {
  const candidates = [{
    prefix: appPilotConfig.offlineLogs.dirName,
    remotePath: join(appPilotConfig.offlineLogs.rootPath, appPilotConfig.offlineLogs.dirName),
  }];

  let lastError = "";
  for (const candidate of candidates) {
    const tempPath = join(tempDir, candidate.prefix.replace(/\//g, "-"));
    const result = await runPymobiledevice3(["apps", "pull", bundleId, candidate.remotePath, tempPath], device);
    if (result.exitCode === 0) {
      return { path: tempPath, prefix: candidate.prefix, remotePath: candidate.remotePath };
    }
    lastError = result.stderr;
  }

  throw new Error(lastError.trim() || "No app log directory matched.");
}

function selectIosLogFile(root: string, offset: number): string | null {
  const files = collectFiles(root)
    .filter((file) => file.endsWith(".log"))
    .sort((left, right) => compareLogFileDateDesc(left, right));
  return files[offset] ?? null;
}

function compareLogFileDateDesc(left: string, right: string): number {
  return readLogTimestamp(right).localeCompare(readLogTimestamp(left));
}

function readLogTimestamp(path: string): string {
  return basename(path).match(/\d{4}-\d{2}-\d{2}--\d{2}-\d{2}-\d{2}-\d{3}/)?.[0] ?? basename(path);
}

function collectFiles(path: string): string[] {
  const current = statSync(path);
  if (current.isFile()) {
    return [path];
  }
  if (!current.isDirectory()) {
    return [];
  }

  return readdirSync(path).flatMap((entry) => collectFiles(join(path, entry)));
}
