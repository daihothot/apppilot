import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { TASK_STATUS_JSON } from "../constants.ts";

export type TaskState = "running" | "success" | "failed";

export interface BaseTaskStatus {
  state: TaskState;
  phase: string;
  startedAt: string;
  updatedAt: string;
  finishedAt?: string;
  log: string;
  task?: string;
  platform?: string;
}

export type TaskStatus<TMetadata extends Record<string, unknown> = Record<string, unknown>> = BaseTaskStatus & Partial<TMetadata>;

export class TaskStatusStore<TMetadata extends Record<string, unknown> = Record<string, unknown>> {
  constructor(private readonly statusPath = TASK_STATUS_JSON) {}

  start(logPath: string, metadata: Partial<BaseTaskStatus & TMetadata> = {}): void {
    this.write({
      state: "running",
      phase: "starting",
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      log: logPath,
      ...metadata,
    });
  }

  update(phase: string): void {
    const status = this.read();
    if (!status || status.state !== "running" || phase === status.phase) {
      return;
    }

    this.write({ ...status, phase, updatedAt: new Date().toISOString() });
  }

  success(): void {
    this.finish("success", "done");
  }

  failed(): void {
    this.finish("failed", "failed");
  }

  updateMetadata(metadata: Partial<TMetadata>): void {
    const status = this.read();
    if (!status) {
      return;
    }

    this.write({ ...status, ...metadata, updatedAt: new Date().toISOString() });
  }

  read(): TaskStatus<TMetadata> | null {
    if (!existsSync(this.statusPath)) {
      return null;
    }

    return JSON.parse(readFileSync(this.statusPath, "utf8")) as TaskStatus<TMetadata>;
  }

  print(): string {
    const status = this.read();
    if (!status) {
      return "state: unknown\nphase: none\nelapsed: 00:00:00\nlog:\n";
    }

    return [
      `state: ${formatState(status.state)}`,
      `phase: ${status.phase}`,
      `elapsed: ${formatElapsed(status.startedAt, status.finishedAt)}`,
      `log: ${status.log}`,
    ].join("\n") + "\n";
  }

  private finish(state: Exclude<TaskState, "running">, phase: string): void {
    const previous = this.read();
    const now = new Date().toISOString();
    this.write({
      ...previous,
      state,
      phase,
      startedAt: previous?.startedAt ?? now,
      updatedAt: now,
      finishedAt: now,
      log: previous?.log ?? "",
    });
  }

  protected write(status: TaskStatus<TMetadata>): void {
    mkdirSync(dirname(this.statusPath), { recursive: true });
    writeFileSync(this.statusPath, `${JSON.stringify(status, null, 2)}\n`);
  }
}

function formatState(state: TaskState): string {
  if (state === "running") return "进行中";
  if (state === "success") return "成功";
  return "失败";
}

function formatElapsed(startedAt: string, finishedAt?: string): string {
  const started = new Date(startedAt).getTime();
  const ended = finishedAt ? new Date(finishedAt).getTime() : Date.now();
  const totalSeconds = Math.max(0, Math.floor((ended - started) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
}
