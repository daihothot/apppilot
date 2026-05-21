import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { TASK_STATUS_JSON } from "../constants.ts";
import type { TaskStatus } from "../task/task-status-store.ts";
import { projectRoot } from "./project.ts";

export interface McpTaskStatus {
  state: string;
  phase: string;
  elapsed: string;
  log: string;
  [key: string]: unknown;
}

export function readTaskStatus(): McpTaskStatus {
  const statusPath = resolve(projectRoot(), TASK_STATUS_JSON);
  if (!existsSync(statusPath)) {
    return {
      state: "unknown",
      phase: "none",
      elapsed: "00:00:00",
      log: "",
    };
  }

  const status = JSON.parse(readFileSync(statusPath, "utf8")) as TaskStatus;
  const { startedAt, updatedAt, finishedAt, ...publicStatus } = status;
  return {
    ...publicStatus,
    elapsed: formatElapsed(status.startedAt, status.finishedAt),
  };
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
