import { expect, test } from "bun:test";
import type { HostCommandResult } from "../../src/host/host-command-executor.ts";
import type { AppPilotIdentity } from "../../src/core/port/app-pilot-operation-port.ts";
import { AdbTransport } from "../../src/core/port/adapters/adb/adb-transport.ts";
import { AdbAndroidExecutor } from "../../src/core/port/adapters/adb/executors/adb-android-executor.ts";
import { PlatformBuildRegistry } from "../../src/platforms/platform-build-registry.ts";
import { UnityBuildTool } from "../../src/platforms/unityeditor/tools/unity-build-tool.ts";

const identity: AppPilotIdentity = {
  transport: "adb",
  platform: { type: "android", version: "17" },
};

test("ADB executor returns the unified code for a missing required argument", async () => {
  class FakeAdbTransport extends AdbTransport {
    calls = 0;

    override async execute(): Promise<HostCommandResult> {
      this.calls += 1;
      throw new Error("transport should not run");
    }
  }
  const transport = new FakeAdbTransport();
  const result = await new AdbAndroidExecutor(transport).launch(identity, { identity });

  expect(result).toEqual({
    ok: false,
    code: "invalid_argument",
    message: "appId is required.",
  });
  expect(transport.calls).toBe(0);
});

test("ADB executor maps launch parameters to Android intent string extras", async () => {
  class FakeAdbTransport extends AdbTransport {
    readonly calls: string[][] = [];

    override async execute(args: string[]): Promise<HostCommandResult> {
      this.calls.push(args);
      if (args[0] === "devices") {
        return result(args, "List of devices attached\ndevice-1 device product:test\n");
      }
      if (args.includes("getprop")) return result(args, "17\n");
      if (args.includes("resolve-activity")) {
        return result(args, "priority=0\ncom.example.app/com.example.MainActivity\n");
      }
      return result(args, "Starting: Intent");
    }
  }
  const transport = new FakeAdbTransport();
  const launched = await new AdbAndroidExecutor(transport).launch(identity, {
    identity,
    appId: "com.example.app",
    parameters: {
      guru_debug: "true",
      guru_ws_client_ip_port: "127.0.0.1:18083",
    },
  });

  expect(launched).toEqual({ ok: true, value: undefined });
  expect(transport.calls[2]).toEqual([
    "-s", "device-1", "shell", "input", "keyevent", "KEYCODE_WAKEUP",
  ]);
  expect(transport.calls[3]).toEqual([
    "-s", "device-1", "shell", "dumpsys", "window",
  ]);
  expect(transport.calls[5]).toEqual([
    "-s", "device-1", "shell", "am", "start",
    "-n", "com.example.app/com.example.MainActivity",
    "--es", "guru_debug", "true",
    "--es", "guru_ws_client_ip_port", "127.0.0.1:18083",
  ]);
});

test("build routing and build tools use the same invalid argument code", async () => {
  const registryResult = await new PlatformBuildRegistry([]).build({});
  const toolResult = await new UnityBuildTool().build({ platform: "android" });

  expect(registryResult).toMatchObject({ ok: false, code: "invalid_argument" });
  expect(toolResult).toMatchObject({ ok: false, code: "invalid_argument" });
});

function result(args: string[], stdout: string): HostCommandResult {
  return {
    executable: "adb",
    args,
    exitCode: 0,
    stdout,
    stderr: "",
  };
}
