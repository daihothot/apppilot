import { spawn } from "node:child_process";
import { appendFileSync, rmSync } from "node:fs";

export interface HostCommandRequest {
  executable: string;
  args?: readonly string[];
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
  logPath?: string;
}

export interface HostCommandResult {
  executable: string;
  args: string[];
  exitCode: number;
  stdout: string;
  stderr: string;
}

/** Executes one host command without retaining workflow or task state. */
export class HostCommandExecutor {
  run(request: HostCommandRequest): Promise<HostCommandResult> {
    const args = [...(request.args ?? [])];
    return new Promise((resolve) => {
      const child = spawn(request.executable, args, {
        stdio: ["ignore", "pipe", "pipe"],
        env: request.env ?? process.env,
      });
      const stdoutChunks: Buffer[] = [];
      const stderrChunks: Buffer[] = [];

      if (request.logPath) rmSync(request.logPath, { force: true });

      let settled = false;
      let timedOut = false;
      const finish = (result: HostCommandResult): void => {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        resolve(result);
      };
      const timer = request.timeoutMs
        ? setTimeout(() => {
            timedOut = true;
            child.kill("SIGTERM");
            setTimeout(() => child.kill("SIGKILL"), 5_000).unref();
          }, request.timeoutMs)
        : undefined;
      timer?.unref();

      child.stdout.on("data", (chunk: Buffer) => {
        stdoutChunks.push(chunk);
        if (request.logPath) appendFileSync(request.logPath, chunk);
      });
      child.stderr.on("data", (chunk: Buffer) => {
        stderrChunks.push(chunk);
        if (request.logPath) appendFileSync(request.logPath, chunk);
      });
      child.on("error", (error) => finish({
        executable: request.executable,
        args,
        exitCode: 1,
        stdout: "",
        stderr: error.message,
      }));
      child.on("close", (code) => finish({
        executable: request.executable,
        args,
        exitCode: timedOut ? 124 : code ?? 1,
        stdout: Buffer.concat(stdoutChunks).toString("utf8"),
        stderr: timedOut
          ? `Command timed out after ${request.timeoutMs}ms.`
          : Buffer.concat(stderrChunks).toString("utf8"),
      }));
    });
  }
}
