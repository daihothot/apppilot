import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type {
  AppPilotIdentity,
  AppPilotResult,
  AppTargetRequest,
  InstallRequest,
  LaunchRequest,
  LogsRequest,
  LogsResult,
  PointRequest,
  SwipeRequest,
} from "../../../app-pilot-operation-port.ts";
import { invalidArgument } from "../../../app-pilot-errors.ts";
import { AdbTransport } from "../adb-transport.ts";

interface AndroidTarget {
  id: string;
  version: string;
}

type AndroidTargetDiscovery =
  | { status: "connected"; target: AndroidTarget }
  | { status: "unavailable" }
  | { status: "failed"; code: string; message: string };

export type AdbExecutorHandshakeResult =
  | { status: "connected"; identity: AppPilotIdentity }
  | { status: "unavailable" }
  | { status: "failed"; code: string; message: string };

export class AdbAndroidExecutor {
  readonly id = "android";
  readonly platform = "android";

  constructor(private readonly transport: AdbTransport) {}

  async handshake(): Promise<AdbExecutorHandshakeResult> {
    const discovered = await this.discoverTarget();
    if (discovered.status !== "connected") return discovered;
    const targetId = discovered.target.id;
    const prepared = await this.prepareTarget(targetId);
    if (!prepared.ok) {
      return {
        status: "failed",
        code: prepared.code,
        message: prepared.message,
      };
    }
    return {
      status: "connected",
      identity: {
        transport: "adb",
        platform: { type: this.platform, version: discovered.target.version },
      },
    };
  }

  private async prepareTarget(targetId: string): Promise<AppPilotResult<void>> {
    const wakeUp = await this.transport.execute([
      "-s", targetId, "shell", "input", "keyevent", "KEYCODE_WAKEUP",
    ]);
    if (wakeUp.exitCode !== 0) {
      return failure(
        "android_wakeup_failed",
        wakeUp.stderr.trim() || wakeUp.stdout.trim() || "Failed to wake the Android device.",
      );
    }
    const windowState = await this.transport.execute(["-s", targetId, "shell", "dumpsys", "window"]);
    if (windowState.exitCode !== 0) {
      return failure(
        "android_lock_state_failed",
        windowState.stderr.trim() || windowState.stdout.trim() || "Failed to inspect the Android lock state.",
      );
    }
    if (
      windowState.stdout.includes("mDreamingLockscreen=true")
      || windowState.stdout.includes("mShowingLockscreen=true")
    ) {
      const unlock = await this.transport.execute([
        "-s", targetId, "shell", "input", "swipe", "500", "1800", "500", "500", "300",
      ]);
      if (unlock.exitCode !== 0) {
        return failure(
          "android_unlock_failed",
          unlock.stderr.trim() || unlock.stdout.trim() || "Failed to unlock the Android device.",
        );
      }
    }
    return { ok: true, value: undefined };
  }

  async install(identity: AppPilotIdentity, request: InstallRequest): Promise<AppPilotResult<void>> {
    const artifactPath = stringArgument(request.artifactPath, "artifactPath");
    if (!artifactPath.ok) return artifactPath;
    const target = await this.requireTarget(identity);
    return target.ok
      ? this.command(["-s", target.value, "install", "-r", artifactPath.value], "android_install_failed")
      : target;
  }
  async uninstall(identity: AppPilotIdentity, request: AppTargetRequest): Promise<AppPilotResult<void>> {
    const appId = stringArgument(request.appId, "appId");
    if (!appId.ok) return appId;
    const target = await this.requireTarget(identity);
    return target.ok
      ? this.command(["-s", target.value, "uninstall", appId.value], "android_uninstall_failed")
      : target;
  }
  async launch(identity: AppPilotIdentity, request: LaunchRequest): Promise<AppPilotResult<void>> {
    const appId = stringArgument(request.appId, "appId");
    if (!appId.ok) return appId;
    const parameterEntries = Object.entries(request.parameters ?? {});
    for (const [key, value] of parameterEntries) {
      if (!key.trim()) return invalidArgument("parameters", "contains an empty key");
      if (typeof value !== "string") {
        return invalidArgument(`parameters.${key}`, "must be a string");
      }
    }
    const target = await this.requireTarget(identity);
    if (!target.ok) return target;
    const prepared = await this.prepareTarget(target.value);
    if (!prepared.ok) return prepared;
    if (parameterEntries.length === 0) {
      return this.command(
        ["-s", target.value, "shell", "monkey", "-p", appId.value, "1"],
        "android_launch_failed",
      );
    }
    const resolved = await this.transport.execute([
      "-s",
      target.value,
      "shell",
      "cmd",
      "package",
      "resolve-activity",
      "--brief",
      "-a",
      "android.intent.action.MAIN",
      "-c",
      "android.intent.category.LAUNCHER",
      appId.value,
    ]);
    const component = resolved.stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.includes("/"))
      .at(-1);
    if (resolved.exitCode !== 0 || !component) {
      return failure(
        "android_launch_failed",
        resolved.stderr.trim() || `No launcher activity was found for ${appId.value}.`,
      );
    }
    return this.command([
      "-s",
      target.value,
      "shell",
      "am",
      "start",
      "-n",
      component,
      ...parameterEntries.flatMap(([key, value]) => ["--es", key, value]),
    ], "android_launch_failed");
  }
  async shutdown(identity: AppPilotIdentity, request: AppTargetRequest): Promise<AppPilotResult<void>> {
    const appId = stringArgument(request.appId, "appId");
    if (!appId.ok) return appId;
    const target = await this.requireTarget(identity);
    return target.ok
      ? this.command(["-s", target.value, "shell", "am", "force-stop", appId.value], "android_shutdown_failed")
      : target;
  }
  async tap(identity: AppPilotIdentity, request: PointRequest): Promise<AppPilotResult<void>> {
    const x = numberArgument(request.x, "x");
    if (!x.ok) return x;
    const y = numberArgument(request.y, "y");
    if (!y.ok) return y;
    const target = await this.requireTarget(identity);
    return target.ok
      ? this.command(["-s", target.value, "shell", "input", "tap", String(x.value), String(y.value)], "android_tap_failed")
      : target;
  }
  async swipe(identity: AppPilotIdentity, request: SwipeRequest): Promise<AppPilotResult<void>> {
    const fromX = numberArgument(request.fromX, "fromX");
    if (!fromX.ok) return fromX;
    const fromY = numberArgument(request.fromY, "fromY");
    if (!fromY.ok) return fromY;
    const toX = numberArgument(request.toX, "toX");
    if (!toX.ok) return toX;
    const toY = numberArgument(request.toY, "toY");
    if (!toY.ok) return toY;
    const target = await this.requireTarget(identity);
    return target.ok
      ? this.command(["-s", target.value, "shell", "input", "swipe", String(fromX.value), String(fromY.value), String(toX.value), String(toY.value), "400"], "android_swipe_failed")
      : target;
  }
  async logs(identity: AppPilotIdentity, request: LogsRequest): Promise<AppPilotResult<LogsResult>> {
    const outputPath = stringArgument(request.outputPath, "outputPath");
    if (!outputPath.ok) return outputPath;
    const offset = request.offset ?? 0;
    if (!Number.isFinite(offset)) return invalidArgument("offset", "must be a finite number");
    const target = await this.requireTarget(identity);
    if (!target.ok) return target;
    if (offset !== 0) return failure("android_logs_offset_unsupported", "ADB logcat supports offset 0 only.");
    const result = await this.transport.execute(["-s", target.value, "logcat", "-d"]);
    if (result.exitCode !== 0) return failure("android_logs_failed", result.stderr.trim() || "ADB logcat failed.");
    const output = request.match
      ? result.stdout.split(/\r?\n/).filter((line) => line.includes(request.match!)).join("\n")
      : result.stdout;
    const directory = resolve(outputPath.value);
    mkdirSync(directory, { recursive: true });
    const path = join(directory, `logcat-${Date.now()}.txt`);
    writeFileSync(path, output);
    return { ok: true, value: { path, ...(request.match ? { count: output ? output.split(/\r?\n/).length : 0 } : {}) } };
  }

  private async requireTarget(identity: AppPilotIdentity): Promise<AppPilotResult<string>> {
    if (identity.transport !== "adb" || identity.platform.type !== this.platform) {
      return unavailable("The discovered ADB Android platform is no longer selected.");
    }
    const discovered = await this.discoverTarget();
    if (discovered.status === "unavailable") {
      return unavailable("The discovered Android device is no longer available. Call identify again.");
    }
    if (discovered.status === "failed") {
      return unavailable(`${discovered.code}: ${discovered.message} Call identify again.`);
    }
    if (discovered.target.version !== identity.platform.version) {
      return unavailable(`Android platform version changed from ${identity.platform.version} to ${discovered.target.version}. Call identify again.`);
    }
    return { ok: true, value: discovered.target.id };
  }

  private async discoverTarget(): Promise<AndroidTargetDiscovery> {
    const listed = await this.transport.execute(["devices", "-l"]);
    if (listed.exitCode !== 0) {
      return { status: "failed", code: "adb_status_failed", message: listed.stderr.trim() || "ADB devices failed." };
    }
    const devices = listed.stdout.split(/\r?\n/).slice(1)
      .map((line) => line.trim().split(/\s+/))
      .filter((tokens) => tokens.length >= 2 && tokens[1] === "device");
    if (devices.length === 0) return { status: "unavailable" };
    if (devices.length !== 1) {
      return { status: "failed", code: "android_device_ambiguous", message: "Exactly one connected Android device is required." };
    }
    const id = devices[0]![0]!;
    const version = await this.transport.execute(["-s", id, "shell", "getprop", "ro.build.version.release"]);
    if (version.exitCode !== 0 || !version.stdout.trim()) {
      return { status: "failed", code: "android_identity_failed", message: version.stderr.trim() || "Android version is unavailable." };
    }
    return { status: "connected", target: { id, version: version.stdout.trim() } };
  }

  private async command(args: string[], code: string): Promise<AppPilotResult<void>> {
    const result = await this.transport.execute(args);
    return result.exitCode === 0
      ? { ok: true, value: undefined }
      : failure(code, result.stderr.trim() || `${result.executable} failed.`);
  }
}

function failure<T = never>(code: string, message: string): AppPilotResult<T> {
  return { ok: false, code, message };
}

function unavailable<T = never>(message: string): AppPilotResult<T> {
  return { ok: false, code: "execution_selection_unavailable", message, requiresIdentify: true };
}

function stringArgument(value: string | undefined, name: string): AppPilotResult<string> {
  return value?.trim()
    ? { ok: true, value }
    : invalidArgument(name);
}

function numberArgument(value: number | undefined, name: string): AppPilotResult<number> {
  return value !== undefined && Number.isFinite(value)
    ? { ok: true, value }
    : invalidArgument(name, "must be a finite number");
}
