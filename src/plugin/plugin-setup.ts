import { chmodSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { LogStore } from "../telemetry/log-store.ts";

const PLUGIN_NAME = "apppilot";

export interface PluginSetupResult {
  apppilotHome: string;
  executable: string;
  skill: string;
  plugin: string;
  tools: string;
  marketplace: string;
}

export class PluginSetup {
  static setup(log: LogStore): PluginSetupResult {
    const apppilotHome = join(homedir(), ".apppilot");
    const executable = join(apppilotHome, "apppilot");
    const manifestTarget = join(apppilotHome, ".codex-plugin", "plugin.json");
    const toolsTarget = join(apppilotHome, "tools");
    const workspaceSkillTarget = join(apppilotHome, "skills", PLUGIN_NAME);
    const pluginTarget = join(homedir(), "plugins", PLUGIN_NAME);
    const pluginSkillTarget = join(pluginTarget, "skills", PLUGIN_NAME);
    const marketplaceTarget = join(homedir(), ".agents", "plugins", "marketplace.json");
    const packaged = findPackagedPluginResources();

    mkdirSync(apppilotHome, { recursive: true });
    mkdirSync(join(apppilotHome, "log"), { recursive: true });
    copyFileIfDifferent(packaged.executable, executable);
    chmodSync(executable, 0o755);
    mkdirSync(dirname(manifestTarget), { recursive: true });
    copyFileIfDifferent(packaged.manifest, manifestTarget);
    copyDirectoryIfDifferent(packaged.toolsDir, toolsTarget);
    copyDirectoryIfDifferent(packaged.skillDir, workspaceSkillTarget);

    installCodexPlugin(pluginTarget, marketplaceTarget, workspaceSkillTarget, manifestTarget);

    const result = {
      apppilotHome,
      executable,
      skill: pluginSkillTarget,
      plugin: pluginTarget,
      tools: toolsTarget,
      marketplace: marketplaceTarget,
    };
    log.log("plugin setup finished", result);
    return result;
  }
}

interface PackagedPluginResources {
  executable: string;
  manifest: string;
  skillDir: string;
  toolsDir: string;
}

function findPackagedPluginResources(): PackagedPluginResources {
  for (const base of candidateResourceRoots()) {
    const executable = join(base, "apppilot");
    const manifest = join(base, ".codex-plugin", "plugin.json");
    const skillDir = join(base, "skills", PLUGIN_NAME);
    const toolsDir = join(base, "tools");
    if (existsSync(executable) && existsSync(manifest) && existsSync(skillDir) && existsSync(toolsDir)) {
      return { executable, manifest, skillDir, toolsDir };
    }
  }
  throw new Error("Packaged AppPilot resources were not found. Run bun run build:plugin first.");
}

function candidateResourceRoots(): string[] {
  const roots = new Set<string>();
  if (process.argv.some((arg) => arg.replace(/\\/g, "/").endsWith("/src/startup/index.ts"))) {
    const moduleRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
    roots.add(moduleRoot);
    roots.add(join(moduleRoot, "dist"));
  }
  roots.add(dirname(process.execPath));
  roots.add(join(dirname(process.execPath), "dist"));
  return [...roots];
}

function copyFileIfDifferent(source: string, target: string): void {
  if (resolve(source) !== resolve(target)) cpSync(source, target);
}

function copyDirectoryIfDifferent(source: string, target: string): void {
  if (resolve(source) === resolve(target)) return;
  rmSync(target, { recursive: true, force: true });
  mkdirSync(dirname(target), { recursive: true });
  cpSync(source, target, { recursive: true });
}

function installCodexPlugin(
  pluginRoot: string,
  marketplacePath: string,
  skillSource: string,
  manifestSource: string,
): void {
  const skillTarget = join(pluginRoot, "skills", PLUGIN_NAME);
  rmSync(pluginRoot, { recursive: true, force: true });
  mkdirSync(join(pluginRoot, ".codex-plugin"), { recursive: true });
  mkdirSync(dirname(skillTarget), { recursive: true });
  cpSync(manifestSource, join(pluginRoot, ".codex-plugin", "plugin.json"));
  cpSync(skillSource, skillTarget, { recursive: true });
  registerCodexMarketplace(marketplacePath);
}

function registerCodexMarketplace(marketplacePath: string): void {
  mkdirSync(dirname(marketplacePath), { recursive: true });
  const previous = existsSync(marketplacePath)
    ? JSON.parse(readFileSync(marketplacePath, "utf8"))
    : { name: "local", interface: { displayName: "Local Plugins" }, plugins: [] };
  previous.name ??= "local";
  previous.interface ??= {};
  previous.interface.displayName ??= "Local Plugins";
  previous.plugins = (previous.plugins ?? []).filter((plugin: { name?: string }) =>
    plugin.name !== PLUGIN_NAME);
  previous.plugins.push({
    name: PLUGIN_NAME,
    source: { source: "local", path: `./plugins/${PLUGIN_NAME}` },
    policy: { installation: "AVAILABLE", authentication: "ON_INSTALL" },
    category: "Developer Tools",
  });
  writeJson(marketplacePath, previous);
}

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, JSON.stringify(value, null, 2) + "\n");
}
