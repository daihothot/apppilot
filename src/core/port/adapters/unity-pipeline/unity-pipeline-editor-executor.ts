import {
  UnityPipelineTool,
  type UnityPipelineTransportResponse,
} from "./unity-pipeline-tool.ts";
import { mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type {
  AppPilotFailure,
  AppPilotIdentity,
  AppPilotResult,
  RbtConfigRequest,
} from "../../app-pilot-operation-port.ts";
import type { UnityPipelinePlatformExecutor } from "./unity-pipeline-platform-executor.ts";

const UNITY_EDITOR_PLATFORM_TYPE = "unity_editor";

export interface UnityPipelineEditorExecutorOptions {
  readinessTimeoutMs?: number;
  pollIntervalMs?: number;
  commandTimeoutSeconds?: number;
}

interface UnityEditorState {
  status: string;
  compiling: boolean;
  domainReloadInProgress: boolean;
  playMode: string;
  unityVersion: string;
}

type UnityEditorStateResult = AppPilotResult<UnityEditorState>;

/** Executes the Unity Editor lifecycle through Unity Pipeline. */
export class UnityPipelineEditorExecutor implements UnityPipelinePlatformExecutor {
  readonly platformType = UNITY_EDITOR_PLATFORM_TYPE;
  private readonly readinessTimeoutMs: number;
  private readonly pollIntervalMs: number;
  private readonly commandTimeoutSeconds: number;

  constructor(
    private readonly unityPipeline = new UnityPipelineTool(),
    options: UnityPipelineEditorExecutorOptions = {},
  ) {
    this.readinessTimeoutMs = options.readinessTimeoutMs ?? 60_000;
    this.pollIntervalMs = options.pollIntervalMs ?? 250;
    this.commandTimeoutSeconds = options.commandTimeoutSeconds ?? 5;
  }

  async identify(): Promise<AppPilotResult<AppPilotIdentity> | undefined> {
    const instance = await this.readInstance();
    if (!instance || !instance.ok) return instance;
    return {
      ok: true,
      value: {
        transport: "unity-pipeline",
        platform: { type: this.platformType, version: instance.value.version },
      },
    };
  }

  private async readInstance(): Promise<AppPilotResult<{ version: string; project: string }> | undefined> {
    const status = await this.invoke("status");
    if (!status.success || status.status !== "completed") {
      return failure("unity_editor_status_failed", "The connected Unity Editor status could not be read.");
    }
    // UnityPipelineTool owns decoding the external status response.
    const result = status.result as { count: number; instances: Array<{ version: string; project: string }> };
    if (result.count === 0) return undefined;
    if (result.count !== 1) {
      return failure("unity_editor_ambiguous", "Exactly one connected Unity Editor is required.");
    }
    return { ok: true, value: result.instances[0]! };
  }

  async start(identity: AppPilotIdentity, parameters?: Readonly<Record<string, string>>): Promise<AppPilotResult<void>> {
    const current = await this.readEditorState();
    if (!current.ok) return current;
    const identityResult = this.requireIdentity(current.value, identity);
    if (!identityResult.ok) return identityResult;
    const availability = this.requireAvailableState(current.value);
    if (!availability.ok) return availability;
    if (current.value.compiling) {
      return failure("unity_editor_compiling", "The Unity Editor is compiling; execution must stop until it is stable.");
    }
    if (current.value.domainReloadInProgress) {
      return failure("unity_editor_domain_reload", "The Unity Editor domain reload is in progress; execution must stop until it is stable.");
    }
    if (current.value.playMode === "playing") return success();

    const project = await this.readProject(identity);
    if (!project.ok) return project;
    const directory = join(project.value, "Library", "GuruLaunch");
    const file = join(directory, "launch-args.json");
    try {
      if (parameters && Object.keys(parameters).length) {
        mkdirSync(directory, { recursive: true });
        writeFileSync(`${file}.tmp`, JSON.stringify(parameters));
        renameSync(`${file}.tmp`, file);
      } else {
        rmSync(file, { force: true });
      }
    } catch (error) {
      return failure("unity_launch_args_write_failed", error instanceof Error ? error.message : String(error));
    }
    const play = await this.invoke("editor_play");
    if (!play.success || play.status !== "completed") {
      return failure("unity_play_mode_start_failed", "The Unity Editor did not accept the Play Mode start request.");
    }
    return this.waitForEditorPlayMode(identity, "playing");
  }

  async writeRbtConfig(request: RbtConfigRequest): Promise<AppPilotResult<void>> {
    const current = await this.readEditorState();
    if (!current.ok) return current;
    const identity = this.requireIdentity(current.value, request.identity);
    if (!identity.ok) return identity;
    if (current.value.playMode === "playing") {
      return failure("rbt_config_target_running", "Stop the Unity Editor before writing RBT startup configuration.");
    }
    const project = await this.readProject(request.identity);
    if (!project.ok) return project;
    const directory = join(project.value, "Library", "GuruRbt");
    const file = join(directory, "rbt-config.json");
    try {
      mkdirSync(directory, { recursive: true });
      writeFileSync(`${file}.tmp`, JSON.stringify(request.entries));
      renameSync(`${file}.tmp`, file);
      return success();
    } catch (error) {
      return failure("rbt_config_write_failed", error instanceof Error ? error.message : String(error));
    }
  }

  async clearRbtConfig(identity: AppPilotIdentity): Promise<AppPilotResult<void>> {
    const project = await this.readProject(identity);
    if (!project.ok) return project;
    const file = join(project.value, "Library", "GuruRbt", "rbt-config.json");
    try {
      rmSync(file, { force: true });
      rmSync(`${file}.tmp`, { force: true });
      return success();
    } catch (error) {
      return failure("rbt_config_clear_failed", error instanceof Error ? error.message : String(error));
    }
  }

  private async readProject(identity: AppPilotIdentity): Promise<AppPilotResult<string>> {
    const instance = await this.readInstance();
    if (!instance) return failure("unity_editor_unavailable", "No Unity Editor is connected.", true);
    if (!instance.ok) return instance;
    const verified = this.requireIdentity({ unityVersion: instance.value.version }, identity);
    return verified.ok ? { ok: true, value: instance.value.project } : verified;
  }

  async stop(identity: AppPilotIdentity): Promise<AppPilotResult<void>> {
    const current = await this.readEditorState();
    if (!current.ok) return current;
    const identityResult = this.requireIdentity(current.value, identity);
    if (!identityResult.ok) return identityResult;
    const availability = this.requireAvailableState(current.value);
    if (!availability.ok) return availability;
    if (current.value.compiling) {
      return failure("unity_editor_compiling", "The Unity Editor is compiling; execution must stop until it is stable.");
    }
    if (current.value.domainReloadInProgress) {
      return failure("unity_editor_domain_reload", "The Unity Editor domain reload is in progress; execution must stop until it is stable.");
    }
    if (current.value.playMode === "stopped") return success();

    const stop = await this.invoke("editor_stop");
    if (!stop.success || stop.status !== "completed") {
      return failure("unity_play_mode_stop_failed", "The Unity Editor did not accept the Play Mode stop request.");
    }
    return this.waitForEditorPlayMode(identity, "stopped");
  }

  private async waitForEditorPlayMode(
    identity: AppPilotIdentity,
    expected: "playing" | "stopped",
  ): Promise<AppPilotResult<void>> {
    const deadline = Date.now() + this.readinessTimeoutMs;
    while (true) {
      const observed = await this.readEditorState();
      if (observed.ok) {
        const identityResult = this.requireIdentity(observed.value, identity);
        if (!identityResult.ok) return identityResult;
        if ((observed.value.status === "ready" || observed.value.status === "playing")
          && !observed.value.compiling
          && !observed.value.domainReloadInProgress
          && observed.value.playMode === expected) {
          return success();
        }
      }

      const remainingMs = deadline - Date.now();
      if (remainingMs <= 0) {
        return expected === "playing"
          ? failure("unity_play_mode_start_timeout", "The Unity Editor did not become ready in Play Mode before the platform timeout.")
          : failure("unity_play_mode_stop_timeout", "The Unity Editor did not leave Play Mode before the platform timeout.");
      }
      await new Promise<void>((resolve) => setTimeout(resolve, Math.min(this.pollIntervalMs, remainingMs)));
    }
  }

  private async readEditorState(): Promise<UnityEditorStateResult> {
    const status = await this.invoke("editor_status");
    const state = isRecord(status.result) ? status.result : undefined;
    if (!status.success
      || status.status !== "completed"
      || !state
      || typeof state.status !== "string"
      || typeof state.compiling !== "boolean"
      || typeof state.domainReloadInProgress !== "boolean"
      || typeof state.playMode !== "string"
      || typeof state.unityVersion !== "string") {
      return failure(
        "unity_play_mode_status_failed",
        "The Unity Editor Play Mode status could not be read.",
        true,
      );
    }
    return {
      ok: true,
      value: {
        status: state.status,
        compiling: state.compiling,
        domainReloadInProgress: state.domainReloadInProgress,
        playMode: state.playMode,
        unityVersion: state.unityVersion,
      },
    };
  }

  private requireIdentity(state: Pick<UnityEditorState, "unityVersion">, identity: AppPilotIdentity): AppPilotResult<void> {
    if (identity.transport !== "unity-pipeline"
      || identity.platform.type !== this.platformType
      || state.unityVersion !== identity.platform.version) {
      return failure(
        "execution_platform_changed",
        "The identified execution platform changed during its lifecycle operation.",
        true,
      );
    }
    return success();
  }

  private requireAvailableState(state: UnityEditorState): AppPilotResult<void> {
    return state.status === "ready" || state.status === "playing"
      ? success()
      : failure(
        "unity_editor_unavailable",
        "The connected Unity Editor is not ready for execution.",
        true,
      );
  }

  private invoke(
    operation: "status" | "editor_status" | "editor_play" | "editor_stop",
  ): Promise<UnityPipelineTransportResponse> {
    return this.unityPipeline.execute({
      operation,
      timeoutSeconds: this.commandTimeoutSeconds,
    });
  }
}

function success(): AppPilotResult<void> {
  return { ok: true, value: undefined };
}

function failure<T = never>(code: string, message: string, requiresIdentify = false): AppPilotFailure {
  return {
    ok: false,
    code,
    message,
    ...(requiresIdentify ? { requiresIdentify: true } : {}),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
