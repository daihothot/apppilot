import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { AppLogArtifactStore } from "../artifact/app-log-artifact-store.ts";
import { BuildArtifactStore } from "../artifact/build-artifact-store.ts";
import { eventBus } from "../events/event-bus.ts";
import type { LogsDumpEvent } from "../events/events.ts";
import type { DeviceDriver, DeviceLogDump } from "../../devices/device-driver.ts";
import { LogStore } from "../log/log-store.ts";

export class LogsExecutor {
  private readonly log: LogStore;
  private readonly builds: BuildArtifactStore;
  private readonly appLogs: AppLogArtifactStore;
  private readonly deviceDriver: DeviceDriver;

  constructor(log: LogStore, builds: BuildArtifactStore, appLogs: AppLogArtifactStore, deviceDriver: DeviceDriver) {
    this.log = log;
    this.builds = builds;
    this.appLogs = appLogs;
    this.deviceDriver = deviceDriver;
  }

  async dump(device: string, offsetRaw?: string, matchText?: string): Promise<void> {
    const offset = parseOffset(offsetRaw);
    const context: LogsDumpEvent = { platform: this.deviceDriver.platform, device, offset, matchText };
    await eventBus.emitWait("logs.dump.before", context);
    try {
      const target = await this.dumpDeviceLogs(device, offset, matchText);
      context.target = target;
      await eventBus.emitWait("logs.dump.after", context);
    } catch (error) {
      context.error = error;
      await eventBus.emitWait("logs.dump.failed", context);
      throw error;
    }
  }

  private async dumpDeviceLogs(device: string, offset: number, matchText?: string): Promise<string> {
    const build = this.builds.readUnityBuild(this.deviceDriver.platform);
    const tempDir = mkdtempSync(join(tmpdir(), "apppilot-log-"));

    try {
      const source = await this.deviceDriver.dumpAppLogs({
        device,
        bundleId: build.bundleId,
        offset,
        tempDir,
      });
      return matchText
        ? this.writeMatchedLog(device, source, matchText)
        : this.writeFullLog(source, offset);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  }

  private writeFullLog(source: DeviceLogDump, offset: number): string {
    if (source.kind === "file") {
      const target = this.appLogs.copyLogFile(this.deviceDriver.platform, source.path, source.prefix);
      this.log.log("pulled latest app log file", { remotePath: source.remotePath, target, offset });
      return target;
    }

    const target = this.appLogs.writeLogText(this.deviceDriver.platform, source.prefix, source.sourceName, source.content);
    this.log.log("wrote app log text dump", { target, platform: this.deviceDriver.platform });
    return target;
  }

  private async writeMatchedLog(device: string, source: DeviceLogDump, matchText: string): Promise<string> {
    const matched = source.kind === "file"
      ? filterLogEntries(readFileSync(source.path, "utf8"), matchText)
      : filterLogLines(source.content, matchText);
    const target = this.appLogs.writeMatchedLog(this.deviceDriver.platform, source.prefix, source.sourceName, matched.content);
    process.stdout.write(matched.content ? matched.content + "\n" : "");
    await eventBus.emitWait("logs.match.after", {
      platform: this.deviceDriver.platform,
      device,
      matchText,
      target,
      count: matched.count,
    });
    this.log.log("wrote matched app log content", { source: source.sourceName, target, count: matched.count });
    return target;
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

interface MatchedLogContent {
  content: string;
  count: number;
}

function filterLogEntries(content: string, matchText: string): MatchedLogContent {
  const matchedEntries = splitLogEntries(content).filter((entry) => entry.some((line) => line.includes(matchText)));
  return {
    content: matchedEntries.map((entry) => entry.join("\n")).join("\n"),
    count: matchedEntries.length,
  };
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

function filterLogLines(content: string, matchText: string): MatchedLogContent {
  const lines = content
    .split(/\r?\n/)
    .filter((line) => line.includes(matchText));
  return {
    content: lines.join("\n"),
    count: lines.length,
  };
}
