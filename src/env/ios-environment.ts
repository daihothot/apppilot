import { appendFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { HostCommandExecutor, type HostCommandResult } from "../host/host-command-executor.ts";
import { LogStore } from "../telemetry/log-store.ts";

const venvPath = join(homedir(), ".apppilot", ".tools", "python", "venv");

export const iosPythonEnvironment = {
  venvPath,
  pythonPath: join(venvPath, "bin", "python"),
  pymobiledevice3Path: join(venvPath, "bin", "pymobiledevice3"),
} as const;

export function requirePymobiledevice3Path(): string {
  if (!existsSync(iosPythonEnvironment.pymobiledevice3Path)) {
    throw new Error(
      `Local pymobiledevice3 not found at ${iosPythonEnvironment.pymobiledevice3Path}. Run: apppilot setup --ios`,
    );
  }
  return iosPythonEnvironment.pymobiledevice3Path;
}

export interface IosEnvironmentSetupResult {
  ios: boolean;
  python: string;
  pymobiledevice3: string;
  commands: HostCommandResult[];
}

export interface IosEnvironmentSetupOptions {
  logPath?: string;
  onPhase?: (phase: string) => void;
  onVersion?: (version: string) => void;
}

export class IosEnvironmentSetup {
  static async setup(
    log: LogStore,
    options: IosEnvironmentSetupOptions = {},
  ): Promise<IosEnvironmentSetupResult> {
    const hostCommands = new HostCommandExecutor();
    const commands: HostCommandResult[] = [];

    if (options.logPath) {
      mkdirSync(dirname(options.logPath), { recursive: true });
      rmSync(options.logPath, { force: true });
      appendSetupLog(options.logPath, "iOS environment setup started");
    }

    mkdirSync(dirname(iosPythonEnvironment.venvPath), { recursive: true });

    try {
      if (!existsSync(iosPythonEnvironment.pythonPath)) {
        options.onPhase?.("creating-python-venv");
        appendSetupLog(options.logPath, `creating venv: ${iosPythonEnvironment.venvPath}`);
        const venv = await hostCommands.run({
          executable: "python3",
          args: ["-m", "venv", iosPythonEnvironment.venvPath],
        });
        commands.push(venv);
        appendCommandLog(options.logPath, venv);
        if (venv.exitCode !== 0) {
          throw new Error(venv.stderr.trim() || "Failed to create local Python venv.");
        }
        log.log("local python venv created", { path: iosPythonEnvironment.venvPath });
      }

      options.onPhase?.("upgrading-pip");
      appendSetupLog(options.logPath, "upgrading pip");
      const pipUpgrade = await hostCommands.run({
        executable: iosPythonEnvironment.pythonPath,
        args: ["-m", "pip", "install", "-U", "pip"],
      });
      commands.push(pipUpgrade);
      appendCommandLog(options.logPath, pipUpgrade);
      if (pipUpgrade.exitCode !== 0) {
        throw new Error(pipUpgrade.stderr.trim() || "Failed to upgrade local pip.");
      }

      options.onPhase?.("installing-pymobiledevice3");
      appendSetupLog(options.logPath, "installing pymobiledevice3");
      const install = await hostCommands.run({
        executable: iosPythonEnvironment.pythonPath,
        args: ["-m", "pip", "install", "-U", "pymobiledevice3"],
      });
      commands.push(install);
      appendCommandLog(options.logPath, install);
      if (install.exitCode !== 0) {
        throw new Error(install.stderr.trim() || "Failed to install pymobiledevice3 locally.");
      }

      options.onPhase?.("verifying-pymobiledevice3");
      appendSetupLog(options.logPath, "verifying pymobiledevice3");
      const version = await hostCommands.run({
        executable: iosPythonEnvironment.pymobiledevice3Path,
        args: ["version"],
      });
      commands.push(version);
      appendCommandLog(options.logPath, version);
      if (version.exitCode !== 0) {
        throw new Error(version.stderr.trim() || "Local pymobiledevice3 was installed but could not run.");
      }

      const versionText = version.stdout.trim() || version.stderr.trim();
      options.onVersion?.(versionText);
      log.log("ios environment setup finished", {
        python: iosPythonEnvironment.pythonPath,
        pymobiledevice3: iosPythonEnvironment.pymobiledevice3Path,
        version: versionText,
      });

      return {
        ios: true,
        python: iosPythonEnvironment.pythonPath,
        pymobiledevice3: iosPythonEnvironment.pymobiledevice3Path,
        commands,
      };
    } catch (error) {
      appendSetupLog(options.logPath, error instanceof Error ? error.message : String(error));
      throw error;
    }
  }
}

function appendSetupLog(logPath: string | undefined, message: string): void {
  if (logPath) appendFileSync(logPath, `[apppilot] ${message}\n`);
}

function appendCommandLog(logPath: string | undefined, result: HostCommandResult): void {
  if (!logPath) return;
  appendFileSync(logPath, `$ ${result.executable} ${result.args.join(" ")}\n`);
  if (result.stdout) appendFileSync(logPath, result.stdout.endsWith("\n") ? result.stdout : `${result.stdout}\n`);
  if (result.stderr) appendFileSync(logPath, result.stderr.endsWith("\n") ? result.stderr : `${result.stderr}\n`);
  appendFileSync(logPath, `[exit ${result.exitCode}]\n`);
}
