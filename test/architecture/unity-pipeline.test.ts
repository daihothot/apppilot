import { expect, test } from "bun:test";
import { UnityPipelineEditorExecutor } from "../../src/core/port/adapters/unity-pipeline/unity-pipeline-editor-executor.ts";
import {
  UnityPipelineTool,
  type UnityPipelineRequest,
  type UnityPipelineTransportResponse,
} from "../../src/core/port/adapters/unity-pipeline/unity-pipeline-tool.ts";

test("Unity Pipeline rejects a top-level editor command failure", async () => {
  const script = [
    "process.stdout.write(JSON.stringify({",
    "  success: false,",
    "  command: 'command editor_play',",
    "  data: { command: 'editor_play', parameters: {}, result: 'rejected' },",
    "  errors: ['rejected'],",
    "  warnings: []",
    "}));",
  ].join("\n");
  const result = await new UnityPipelineTool(process.execPath, ["-e", script, "--"])
    .execute({ operation: "editor_play" });

  expect(result).toMatchObject({
    success: false,
    status: "failed",
    operation: "editor_play",
    result: "rejected",
    errors: ["rejected"],
    error: "Unity Pipeline operation editor_play failed.",
  });
});

test("Unity Pipeline status retains the project root used for startup files", async () => {
  const instance = { version: "6000.0.80f1", state: "ready", project: "/example/Unity Project" };
  const envelope = { success: true, command: "status", data: { count: 1, instances: [instance] }, errors: [], warnings: [] };
  const script = `process.stdout.write(${JSON.stringify(JSON.stringify(envelope))});`;
  expect(await new UnityPipelineTool(process.execPath, ["-e", script, "--"]).execute({ operation: "status" }))
    .toMatchObject({ success: true, result: { count: 1, instances: [instance] } });
});

for (const operation of ["editor_status", "editor_play", "editor_stop"] as const) {
  test(`Unity Pipeline accepts the current ${operation} response envelope`, async () => {
    const commandResult = operation === "editor_status"
      ? {
        status: "ready",
        compiling: false,
        domainReloadInProgress: false,
        playMode: "stopped",
        lastHeartbeat: "2026-10-06T04:33:00.000Z",
        projectPath: "/example/UnityProject",
        unityVersion: "6000.0.80f1",
      }
      : operation === "editor_play" ? "Play Mode requested" : "Stop Play Mode requested";
    const envelope = {
      success: true,
      command: `command ${operation}`,
      data: { command: operation, parameters: {}, result: commandResult },
      errors: [],
      warnings: [],
    };
    const script = `process.stdout.write(${JSON.stringify(JSON.stringify(envelope))});`;
    const result = await new UnityPipelineTool(process.execPath, ["-e", script, "--"])
      .execute({ operation });

    expect(result).toEqual({
      success: true,
      status: "completed",
      operation,
      result: operation === "editor_status"
        ? {
          status: "ready",
          compiling: false,
          domainReloadInProgress: false,
          playMode: "stopped",
          unityVersion: "6000.0.80f1",
        }
        : commandResult,
    });
  });
}

test("Unity Editor launch waits through transient states until Play Mode is stable", async () => {
  const calls: string[] = [];
  const transport = new QueuedTransport([
    response("status", { count: 1, instances: [{ version: "6000.0.80f1", state: "ready", project: "/example/UnityProject" }] }),
    editorState("ready", "stopped"),
    response("status", { count: 1, instances: [{ version: "6000.0.80f1", state: "ready", project: "/example/UnityProject" }] }),
    response("editor_play", "Play Mode requested"),
    editorState("starting", "stopped", { compiling: true }),
    editorState("playing", "playing"),
  ], calls);
  const executor = new UnityPipelineEditorExecutor(transport, {
    readinessTimeoutMs: 100,
    pollIntervalMs: 1,
    commandTimeoutSeconds: 1,
  });

  const identified = await executor.identify();
  expect(identified?.ok).toBe(true);
  if (!identified?.ok) throw new Error("Unity Editor was not identified.");
  expect(identified.value.platform.type).toBe("unity_editor");
  expect(await executor.start(identified.value)).toEqual({ ok: true, value: undefined });
  expect(calls).toEqual(["status", "editor_status", "status", "editor_play", "editor_status", "editor_status"]);
});

class QueuedTransport extends UnityPipelineTool {
  constructor(
    private readonly responses: UnityPipelineTransportResponse[],
    private readonly calls: string[],
  ) {
    super();
  }

  override execute(request: UnityPipelineRequest): Promise<UnityPipelineTransportResponse> {
    this.calls.push(request.operation);
    const next = this.responses.shift();
    if (!next) throw new Error(`No response configured for ${request.operation}.`);
    return Promise.resolve(next);
  }
}

function editorState(
  status: string,
  playMode: string,
  overrides: { compiling?: boolean; domainReloadInProgress?: boolean } = {},
): UnityPipelineTransportResponse {
  return response("editor_status", {
    status,
    playMode,
    compiling: overrides.compiling ?? false,
    domainReloadInProgress: overrides.domainReloadInProgress ?? false,
    unityVersion: "6000.0.80f1",
  });
}

function response(
  operation: UnityPipelineTransportResponse["operation"],
  result: NonNullable<UnityPipelineTransportResponse["result"]>,
): UnityPipelineTransportResponse {
  return { success: true, status: "completed", operation, result };
}
