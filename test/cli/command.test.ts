import { expect, test } from "bun:test";
import { BuildCommand } from "../../src/core/cli/commands/build-command.ts";
import { LaunchCommand } from "../../src/core/cli/commands/launch-command.ts";
import type {
  AppPilotOperationPort,
  LaunchRequest,
} from "../../src/core/port/app-pilot-operation-port.ts";

const launchRequests: LaunchRequest[] = [];
const identity = { transport: "adb", platform: { type: "android", version: "17" } };
const port = {
  identify: async () => ({ ok: false as const, code: "unused", message: "unused" }),
  build: async (request: { platform: string }) => ({ ok: true as const, value: request }),
  install: async () => ({ ok: true as const, value: undefined }),
  uninstall: async () => ({ ok: true as const, value: undefined }),
  launch: async (request: LaunchRequest) => {
    launchRequests.push(request);
    return { ok: false as const, code: "invalid_argument", message: "appId is required." };
  },
  restart: async () => ({ ok: true as const, value: undefined }),
  shutdown: async () => ({ ok: true as const, value: undefined }),
  tap: async () => ({ ok: true as const, value: undefined }),
  swipe: async () => ({ ok: true as const, value: undefined }),
  logs: async () => ({ ok: true as const, value: { path: "/log" } }),
} as unknown as AppPilotOperationPort;

test("build command invokes the platform build operation", async () => {
  const response = await new BuildCommand(port).invoke([
    "--id", "build-1",
    "--platform", "android",
    "--project-path", "/project",
    "--output-path", "/app.apk",
  ]);
  expect(response).toMatchObject({ id: "build-1", ok: true, value: { platform: "android" } });
});

test("runtime command forwards missing arguments to the selected executor contract", async () => {
  launchRequests.length = 0;
  const response = await new LaunchCommand(port).invoke([
    "--id", "launch-1",
    "--identity", JSON.stringify(identity),
    "--app-id", "app",
    "--parameter", "guru_debug=true",
    "--parameter", "guru_ws_client_ip_port=127.0.0.1:18083",
  ]);
  expect(response).toMatchObject({ id: "launch-1", ok: false, code: "invalid_argument" });
  expect(launchRequests[0]).toEqual({
    identity,
    appId: "app",
    parameters: {
      guru_debug: "true",
      guru_ws_client_ip_port: "127.0.0.1:18083",
    },
  });
});
