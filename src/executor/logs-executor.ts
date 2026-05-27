import { copyFileSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { tmpdir } from "node:os";
import { AppLogArtifactStore } from "../artifact/app-log-artifact-store.ts";
import { BuildArtifactStore } from "../artifact/build-artifact-store.ts";
import type { Backend } from "../backend/backend.ts";
import { OFFLINE_LOG_DIR_NAME, OFFLINE_LOG_ROOT_PATH } from "../constants.ts";
import { LogStore } from "../log/log-store.ts";
import { execFile } from "../process/executor.ts";

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
    if (this.backend.platform === "android") {
      await this.dumpAndroidLogcat(device, offset, matchText);
      return;
    }

    await this.dumpIosLogs(device, offset, matchText);
  }

  private async dumpIosLogs(device: string, offset: number, matchText?: string): Promise<void> {
    const build = this.builds.readUnityBuild(this.backend.platform);
    const tempDir = mkdtempSync(join(tmpdir(), "apppilot-log-"));

    try {
      const pulled = await this.pullLogDirectory(device, build.bundleId, tempDir);

      const selected = selectIosLogFile(pulled.path, offset);
      if (!selected) {
        throw new Error("No app log file found at offset " + offset + ".");
      }

      if (matchText) {
        this.writeMatchedLog(selected, pulled.prefix, matchText);
      } else {
        const target = this.appLogs.logPath(this.backend.platform, pulled.prefix, basename(selected));
        copyFileSync(selected, target);
        this.log.log("pulled latest app log file", { remotePath: pulled.remotePath, target, offset });
      }
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  }

  private async dumpAndroidLogcat(device: string, offset: number, matchText?: string): Promise<void> {
    if (offset !== 0) {
      throw new Error("Android logs-dump uses adb logcat and supports offset=0 only.");
    }

    const result = await execFile("adb", ["-s", device, "logcat", "-d"]);
    if (result.exitCode !== 0) {
      throw new Error(result.stderr.trim() || "Android logcat dump failed.");
    }

    const sourceName = `logcat-${formatTimestampForFileName(new Date())}.txt`;
    if (matchText) {
      const content = filterLogcatLines(result.stdout, matchText);
      const target = this.appLogs.writeMatchedLog("android", "logcat", sourceName, content);
      process.stdout.write(content ? content + "\n" : "");
      this.log.log("wrote matched android logcat content", { target, match: matchText, lines: content ? content.split(/\r?\n/).length : 0 });
      return;
    }

    const target = this.appLogs.writeLogText("android", "logcat", sourceName, result.stdout);
    this.log.log("wrote android logcat dump", { target });
  }

  private async pullLogDirectory(device: string, bundleId: string, tempDir: string): Promise<{ path: string; prefix: string; remotePath: string }> {
    const candidates = [{ prefix: OFFLINE_LOG_DIR_NAME, remotePath: join(OFFLINE_LOG_ROOT_PATH, OFFLINE_LOG_DIR_NAME) }];

    let lastError = "";
    for (const candidate of candidates) {
      const tempPath = join(tempDir, candidate.prefix.replace(/\//g, "-"));
      const result = await this.backend.pullAppLogFile(device, bundleId, candidate.remotePath, tempPath);
      if (result.exitCode === 0) {
        return { path: tempPath, prefix: candidate.prefix, remotePath: candidate.remotePath };
      }
      lastError = result.stderr;
      this.log.warning("no app log directory pulled", { remotePath: candidate.remotePath, stderr: result.stderr });
    }

    throw new Error(lastError.trim() || "No app log directory matched.");
  }

  private writeMatchedLog(sourcePath: string, prefix: string, matchText: string): void {
    const entries = splitLogEntries(readFileSync(sourcePath, "utf8"));
    const matchedEntries = entries.filter((entry) => entry.some((line) => line.includes(matchText)));
    const content = matchedEntries.map((entry) => entry.join("\n")).join("\n");
    const target = this.appLogs.writeMatchedLog(this.backend.platform, prefix, basename(sourcePath), content);
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

function selectIosLogFile(root: string, offset: number): string | null {
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

function filterLogcatLines(content: string, matchText: string): string {
  return content
    .split(/\r?\n/)
    .filter((line) => line.includes(matchText))
    .join("\n");
}

function formatTimestampForFileName(date: Date): string {
  const iso = date.toISOString();
  return iso.replace(/[-:]/g, "").replace(/\..+$/, "Z");
}
