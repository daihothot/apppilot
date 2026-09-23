import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import { createAppPilotCli } from "../../src/core/cli/create-app-pilot-cli.ts";
import type { AppPilotOperationPort } from "../../src/core/port/app-pilot-operation-port.ts";
import { runAppPilotProcess } from "../../src/startup/app-pilot-process.ts";
import { LogStore } from "../../src/telemetry/log-store.ts";

test("AppPilot process keeps one Scope across identify and launch requests", async () => {
  const root = mkdtempSync(join(tmpdir(), "apppilot-process-test-"));
  try {
    let identified = false;
    const port = fakePort({
      identify: async () => {
        identified = true;
        return { ok: true, value: { transport: "unity-pipeline", platform: { type: "unity_editor", version: "6000.0.80f1" } } };
      },
      launch: async () => identified
        ? { ok: true, value: undefined }
        : { ok: false, code: "execution_not_discovered", message: "identify first" },
    });
    const logStore = new LogStore(root);
    const scope = { operationPort: port, logStore, cli: createAppPilotCli(port, logStore) };
    const input = new PassThrough();
    const output = new PassThrough();
    const chunks: Buffer[] = [];
    output.on("data", (chunk: Buffer) => chunks.push(chunk));

    const running = runAppPilotProcess(scope, input, output);
    input.end([
      JSON.stringify({ id: "identify-1", args: ["identify", "--transport", "unity-pipeline"] }),
      JSON.stringify({ id: "launch-1", args: ["launch"] }),
      "",
    ].join("\n"));
    await running;

    const lines = Buffer.concat(chunks).toString("utf8").trim().split("\n").map((line) => JSON.parse(line));
    expect(lines[0]).toEqual({ type: "ready", protocolVersion: 1 });
    expect(lines[1]).toMatchObject({ id: "identify-1", ok: true });
    expect(lines[2]).toEqual({ id: "launch-1", ok: true });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

function fakePort(overrides: Partial<AppPilotOperationPort>): AppPilotOperationPort {
  const ok = async () => ({ ok: true as const, value: undefined });
  return {
    identify: async () => ({ ok: false, code: "unused", message: "unused" }),
    build: async () => ({ ok: false, code: "unused", message: "unused" }),
    install: ok,
    uninstall: ok,
    launch: ok,
    restart: ok,
    shutdown: ok,
    tap: ok,
    swipe: ok,
    logs: async () => ({ ok: true, value: { path: "/tmp/log" } }),
    ...overrides,
  } as AppPilotOperationPort;
}
