import { appendFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname } from "node:path";
import { LOCAL_PYMOBILEDEVICE3_PATH, LOCAL_PYTHON_BIN, LOCAL_PYTHON_VENV_DIR } from "../constants.ts";
import { LogStore } from "../log/log-store.ts";
import { execFile } from "../process/executor.ts";
import type { CommandResult } from "../types.ts";

export interface IosToolsSetupResult {
  ios: boolean;
  python: string;
  pymobiledevice3: string;
  commands: CommandResult[];
}

export interface IosToolsSetupOptions {
  logPath?: string;
  onPhase?: (phase: string) => void;
  onVersion?: (version: string) => void;
}

export class IosToolsService {
  constructor(private readonly log: LogStore) {}

  async setup(options: IosToolsSetupOptions = {}): Promise<IosToolsSetupResult> {
    const commands: CommandResult[] = [];

    if (options.logPath) {
      mkdirSync(dirname(options.logPath), { recursive: true });
      rmSync(options.logPath, { force: true });
      appendSetupLog(options.logPath, "iOS tools setup started");
    }

    mkdirSync(dirname(LOCAL_PYTHON_VENV_DIR), { recursive: true });

    try {
      if (!existsSync(LOCAL_PYTHON_BIN)) {
        options.onPhase?.("creating-python-venv");
        appendSetupLog(options.logPath, `creating venv: ${LOCAL_PYTHON_VENV_DIR}`);
        const venv = await execFile("python3", ["-m", "venv", LOCAL_PYTHON_VENV_DIR]);
        commands.push(venv);
        appendCommandLog(options.logPath, venv);
        if (venv.exitCode !== 0) {
          throw new Error(venv.stderr.trim() || "Failed to create local Python venv.");
        }
        this.log.log("local python venv created", { path: LOCAL_PYTHON_VENV_DIR });
      }

      options.onPhase?.("upgrading-pip");
      appendSetupLog(options.logPath, "upgrading pip");
      const pipUpgrade = await execFile(LOCAL_PYTHON_BIN, ["-m", "pip", "install", "-U", "pip"]);
      commands.push(pipUpgrade);
      appendCommandLog(options.logPath, pipUpgrade);
      if (pipUpgrade.exitCode !== 0) {
        throw new Error(pipUpgrade.stderr.trim() || "Failed to upgrade local pip.");
      }

      options.onPhase?.("installing-pymobiledevice3");
      appendSetupLog(options.logPath, "installing pymobiledevice3");
      const install = await execFile(LOCAL_PYTHON_BIN, ["-m", "pip", "install", "-U", "pymobiledevice3"]);
      commands.push(install);
      appendCommandLog(options.logPath, install);
      if (install.exitCode !== 0) {
        throw new Error(install.stderr.trim() || "Failed to install pymobiledevice3 locally.");
      }

      options.onPhase?.("verifying-pymobiledevice3");
      appendSetupLog(options.logPath, "verifying pymobiledevice3");
      const version = await execFile(LOCAL_PYMOBILEDEVICE3_PATH, ["version"]);
      commands.push(version);
      appendCommandLog(options.logPath, version);
      if (version.exitCode !== 0) {
        throw new Error(version.stderr.trim() || "Local pymobiledevice3 was installed but could not run.");
      }

      const versionText = version.stdout.trim() || version.stderr.trim();
      options.onVersion?.(versionText);

      this.log.log("ios tools setup finished", {
        python: LOCAL_PYTHON_BIN,
        pymobiledevice3: LOCAL_PYMOBILEDEVICE3_PATH,
        version: versionText,
      });

      return {
        ios: true,
        python: LOCAL_PYTHON_BIN,
        pymobiledevice3: LOCAL_PYMOBILEDEVICE3_PATH,
        commands,
      };
    } catch (error) {
      appendSetupLog(options.logPath, error instanceof Error ? error.message : String(error));
      throw error;
    }
  }
}

function appendSetupLog(logPath: string | undefined, message: string): void {
  if (!logPath) return;
  appendFileSync(logPath, `[apppilot] ${message}\n`);
}

function appendCommandLog(logPath: string | undefined, result: CommandResult): void {
  if (!logPath) return;
  appendFileSync(logPath, `$ ${result.command} ${result.args.join(" ")}\n`);
  if (result.stdout) appendFileSync(logPath, result.stdout.endsWith("\n") ? result.stdout : `${result.stdout}\n`);
  if (result.stderr) appendFileSync(logPath, result.stderr.endsWith("\n") ? result.stderr : `${result.stderr}\n`);
  appendFileSync(logPath, `[exit ${result.exitCode}]\n`);
}
