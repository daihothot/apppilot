import { expect, test } from "bun:test";
import { UnityPipelineEditorExecutor } from "../../src/core/port/adapters/unity-pipeline/unity-pipeline-editor-executor.ts";
import {
  UnityPipelineTool,
  type UnityPipelineRequest,
  type UnityPipelineTransportResponse,
} from "../../src/core/port/adapters/unity-pipeline/unity-pipeline-tool.ts";

test("Unity Pipeline rejects a nested editor command failure", async () => {
  const script = [
    "process.stdout.write(JSON.stringify({",
    "  success: true,",
    "  command: 'command editor_play',",
    "  data: { command: 'editor_play', success: false, result: 'rejected' },",
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
    errors: ["rejected"],
  });
});

test("Unity Editor launch waits through transient states until Play Mode is stable", async () => {
  const calls: string[] = [];
  const transport = new QueuedTransport([
    response("status", { count: 1, instances: [{ version: "6000.0.80f1", state: "ready" }] }),
    editorState("ready", "stopped"),
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
  expect(calls).toEqual(["status", "editor_status", "editor_play", "editor_status", "editor_status"]);
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
