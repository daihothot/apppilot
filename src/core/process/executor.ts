import { spawn } from "node:child_process";
import { appendFileSync, rmSync } from "node:fs";
import type { CommandResult } from "./types.ts";

export interface ExecFileOptions {
  env?: Record<string, string | undefined>;
  timeoutMs?: number;
  logPath?: string;
}

export function execFile(command: string, args: string[], options: ExecFileOptions = {}): Promise<CommandResult> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"], env: options.env ?? process.env });
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    if (options.logPath) {
      rmSync(options.logPath, { force: true });
    }

    let timedOut = false;
    const timer = options.timeoutMs
      ? setTimeout(() => {
          timedOut = true;
          child.kill("SIGTERM");
          setTimeout(() => {
            child.kill("SIGKILL");
          }, 5000).unref();
        }, options.timeoutMs)
      : undefined;

    timer?.unref();

    child.stdout.on("data", (chunk: Buffer) => {
      stdoutChunks.push(chunk);
      if (options.logPath) appendFileSync(options.logPath, chunk);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderrChunks.push(chunk);
      if (options.logPath) appendFileSync(options.logPath, chunk);
    });

    child.on("error", (error) => {
      if (timer) clearTimeout(timer);
      resolve({
        command,
        args,
        exitCode: 1,
        stdout: "",
        stderr: error.message,
      });
    });

    child.on("close", (code) => {
      if (timer) clearTimeout(timer);
      resolve({
        command,
        args,
        exitCode: timedOut ? 124 : code ?? 1,
        stdout: Buffer.concat(stdoutChunks).toString("utf8"),
        stderr: timedOut ? `Command timed out after ${options.timeoutMs}ms.` : Buffer.concat(stderrChunks).toString("utf8"),
      });
    });
  });
}
