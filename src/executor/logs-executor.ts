import { copyFileSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { tmpdir } from "node:os";
import { AppLogArtifactStore } from "../artifact/app-log-artifact-store.ts";
import { BuildArtifactStore } from "../artifact/build-artifact-store.ts";
import type { Backend } from "../backend/backend.ts";
import { OFFLINE_LOG_DIR_NAME, OFFLINE_LOG_ROOT_PATH } from "../constants.ts";
import { LogStore } from "../log/log-store.ts";

export class LogsExecutor {
  private readonly log: LogStore;
  private readonly builds: BuildArtifactStore;
  private readonly appLogs: AppLogArtifactStore;
  private readonly backend: Backend;

  constructor(log: LogStore, builds: BuildArtifactStore, appLogs: AppLogArtifactStore, backend: Backend) {
    this.log = log;
    this.builds = builds;
    this.appLogs = appLogs;
    this.backend = backend;
  }

  async dump(device: string, offsetRaw?: string, matchText?: string): Promise<void> {
    const offset = parseOffset(offsetRaw);
    const build = this.builds.readUnityIosBuild();
    const remotePath = join(OFFLINE_LOG_ROOT_PATH, OFFLINE_LOG_DIR_NAME);
    const tempDir = mkdtempSync(join(tmpdir(), "apppilot-log-"));
    const tempPath = join(tempDir, OFFLINE_LOG_DIR_NAME);

    try {
      const result = await this.backend.pullAppLogFile(device, build.bundleId, remotePath, tempPath);
      if (result.exitCode !== 0) {
        this.log.warning("no app log directory pulled", { remotePath, stderr: result.stderr });
        throw new Error("No app log directory matched.");
      }

      const selected = selectLogFile(tempPath, offset);
      if (!selected) {
        throw new Error("No app log file found at offset " + offset + ".");
      }

      if (matchText) {
        this.writeMatchedLog(selected, matchText);
      } else {
        const target = this.appLogs.iosLogPath(OFFLINE_LOG_DIR_NAME, basename(selected));
        copyFileSync(selected, target);
        this.log.log("pulled latest app log file", { remotePath, target, offset });
      }
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  }

  private writeMatchedLog(sourcePath: string, matchText: string): void {
    const entries = splitLogEntries(readFileSync(sourcePath, "utf8"));
    const matchedEntries = entries.filter((entry) => entry.some((line) => line.includes(matchText)));
    const content = matchedEntries.map((entry) => entry.join("\n")).join("\n");
    const target = this.appLogs.writeIosMatchedLog(OFFLINE_LOG_DIR_NAME, basename(sourcePath), content);
    process.stdout.write(content ? content + "\n" : "");
    this.log.log("wrote matched app log content", { source: basename(sourcePath), target, count: matchedEntries.length });
  }
}

function parseOffset(value?: string): number {
  if (value === undefined) {
    return 0;
  }

  const offset = Number(value);
  if (!Number.isInteger(offset)) {
    throw new Error("Invalid --offset " + value + ". Expected an integer.");
  }
  return Math.abs(offset);
}

function selectLogFile(root: string, offset: number): string | null {
  const files = collectFiles(root)
    .filter((file) => file.endsWith(".log"))
    .sort((left, right) => compareLogFileDateDesc(left, right));
  return files[offset] ?? null;
}

function compareLogFileDateDesc(left: string, right: string): number {
  return readLogTimestamp(right).localeCompare(readLogTimestamp(left));
}

function readLogTimestamp(path: string): string {
  return basename(path).match(/\d{4}-\d{2}-\d{2}--\d{2}-\d{2}-\d{2}-\d{3}/)?.[0] ?? basename(path);
}

function collectFiles(path: string): string[] {
  const current = statSync(path);
  if (current.isFile()) {
    return [path];
  }
  if (!current.isDirectory()) {
    return [];
  }

  return readdirSync(path).flatMap((entry) => collectFiles(join(path, entry)));
}

function splitLogEntries(content: string): string[][] {
  const entries: string[][] = [];
  let current: string[] = [];

  for (const line of content.split(/\r?\n/)) {
    if (isLogEntryStart(line) && current.length > 0) {
      entries.push(current);
      current = [];
    }
    current.push(line);
  }

  if (current.length > 0) {
    entries.push(current);
  }
  return entries;
}

function isLogEntryStart(line: string): boolean {
  return /^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}\s+/.test(line);
}
