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
  const result = await new AdbAndroidExecutor(transport).launch(identity, {});

  expect(result).toEqual({
    ok: false,
    code: "invalid_argument",
    message: "appId is required.",
  });
  expect(transport.calls).toBe(0);
});

test("build routing and build tools use the same invalid argument code", async () => {
  const registryResult = await new PlatformBuildRegistry([]).build({});
  const toolResult = await new UnityBuildTool().build({ platform: "android" });

  expect(registryResult).toMatchObject({ ok: false, code: "invalid_argument" });
  expect(toolResult).toMatchObject({ ok: false, code: "invalid_argument" });
});
