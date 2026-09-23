import { appendFileSync, mkdirSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export type LogLevel = "debug" | "log" | "warning" | "error";

export class LogStore {
  private readonly filePath: string;

  constructor(private readonly root = join(homedir(), ".apppilot", "log")) {
    mkdirSync(root, { recursive: true });
    this.filePath = join(root, "apppilot.log");
  }

  clear(): void {
    rmSync(this.root, { recursive: true, force: true });
    mkdirSync(this.root, { recursive: true });
  }
  debug(message: string, data?: unknown): void { this.write("debug", message, data); }
  log(message: string, data?: unknown): void { this.write("log", message, data); }
  warning(message: string, data?: unknown): void { this.write("warning", message, data); }
  error(message: string, data?: unknown): void { this.write("error", message, data); }

  private write(level: LogLevel, message: string, data?: unknown): void {
    const suffix = data === undefined ? "" : ` ${JSON.stringify(data)}`;
    appendFileSync(this.filePath, `${new Date().toISOString()} ${level} ${message}${suffix}\n`);
  }
}
