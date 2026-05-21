import { chmodSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { LogStore } from "../log/log-store.ts";

const APPPILOT_MCP_SERVER_NAME = "apppilot";
const APPPILOT_SKILL_NAME = "apppilot-mcp";

export interface AgentToolsSetupResult {
  agent: boolean;
  apppilotHome: string;
  mcp: string;
  mcpCall: string;
  skill: string;
  plugin: string;
  tools: string;
  workspaceSkill: string;
  codexConfig: string;
  marketplace: string;
  pluginCache: string;
  registered: boolean;
}

export class AgentToolsService {
  constructor(private readonly log: LogStore) {}

  setup(): AgentToolsSetupResult {
    const apppilotHome = join(homedir(), ".apppilot");
    const codexHome = process.env.CODEX_HOME ?? join(homedir(), ".codex");
    const codexConfig = join(codexHome, "config.toml");
    const staleApppilotTarget = join(apppilotHome, "apppilot");
    const mcpTarget = join(apppilotHome, "apppilot-mcp");
    const mcpCallTarget = join(apppilotHome, "apppilot-mcp-call");
    const toolsTarget = join(apppilotHome, "tools");
    const workspaceSkillTarget = join(apppilotHome, "skills", APPPILOT_SKILL_NAME);
    const staleStandaloneSkillTarget = join(codexHome, "skills", APPPILOT_SKILL_NAME);
    const pluginTarget = join(homedir(), "plugins", APPPILOT_SKILL_NAME);
    const pluginSkillTarget = join(pluginTarget, "skills", APPPILOT_SKILL_NAME);
    const marketplaceTarget = join(homedir(), ".agents", "plugins", "marketplace.json");
    const pluginCacheTarget = join(codexHome, "plugins", "cache", "local", APPPILOT_SKILL_NAME, "0.1.0");
    const packaged = findPackagedAgentResources();

    mkdirSync(apppilotHome, { recursive: true });
    mkdirSync(join(apppilotHome, "log"), { recursive: true });
    mkdirSync(join(apppilotHome, "artifact"), { recursive: true });
    mkdirSync(join(apppilotHome, ".tools"), { recursive: true });
    rmSync(staleApppilotTarget, { force: true });

    copyFileIfDifferent(packaged.mcpExecutable, mcpTarget);
    chmodSync(mcpTarget, 0o755);
    copyFileIfDifferent(packaged.mcpCallExecutable, mcpCallTarget);
    chmodSync(mcpCallTarget, 0o755);

    copyDirectoryIfDifferent(packaged.toolsDir, toolsTarget);
    copyDirectoryIfDifferent(packaged.skillDir, workspaceSkillTarget);

    rmSync(staleStandaloneSkillTarget, { recursive: true, force: true });

    registerCodexMcp(codexConfig, mcpTarget, apppilotHome);
    registerCodexPluginConfig(codexConfig, homedir());
    installCodexPlugin(pluginTarget, marketplaceTarget, workspaceSkillTarget, mcpTarget, apppilotHome);
    copyDirectoryIfDifferent(pluginTarget, pluginCacheTarget);

    const result = {
      agent: true,
      apppilotHome,
      mcp: mcpTarget,
      mcpCall: mcpCallTarget,
      skill: pluginSkillTarget,
      plugin: pluginTarget,
      workspaceSkill: workspaceSkillTarget,
      tools: toolsTarget,
      codexConfig,
      marketplace: marketplaceTarget,
      pluginCache: pluginCacheTarget,
      registered: true,
    };
    this.log.log("agent tools setup finished", result);
    return result;
  }
}

interface PackagedAgentResources {
  mcpExecutable: string;
  mcpCallExecutable: string;
  skillDir: string;
  toolsDir: string;
}

function findPackagedAgentResources(): PackagedAgentResources {
  for (const base of candidateResourceRoots()) {
    const mcpExecutable = join(base, "apppilot-mcp");
    const mcpCallExecutable = join(base, "apppilot-mcp-call");
    const skillDir = join(base, "skills", APPPILOT_SKILL_NAME);
    const toolsDir = join(base, "tools");
    if (existsSync(mcpExecutable) && existsSync(mcpCallExecutable) && existsSync(skillDir) && existsSync(toolsDir)) {
      return {
        mcpExecutable,
        mcpCallExecutable,
        skillDir,
        toolsDir,
      };
    }
  }

  throw new Error([
    "Packaged AppPilot agent resources were not found.",
    "Run bun run build:agent first, then run dist/apppilot tools setup --agent.",
  ].join(" "));
}

function candidateResourceRoots(): string[] {
  const roots = new Set<string>();

  if (isSourceCliRuntime()) {
    const moduleRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
    roots.add(moduleRoot);
    roots.add(join(moduleRoot, "dist"));
  }

  roots.add(dirname(process.execPath));
  roots.add(join(dirname(process.execPath), "dist"));
  return [...roots];
}

function isSourceCliRuntime(): boolean {
  return process.argv.some((arg) => {
    const normalized = arg.replace(/\\/g, "/");
    return normalized.endsWith("/src/cli/index.ts") || normalized.endsWith("/src/cli/index.js");
  });
}

function copyFileIfDifferent(source: string, target: string): void {
  if (resolve(source) === resolve(target)) {
    return;
  }
  cpSync(source, target);
}

function copyDirectoryIfDifferent(source: string, target: string): void {
  if (resolve(source) === resolve(target)) {
    return;
  }
  rmSync(target, { recursive: true, force: true });
  mkdirSync(dirname(target), { recursive: true });
  cpSync(source, target, { recursive: true });
}

function registerCodexMcp(configPath: string, command: string, cwd: string): void {
  mkdirSync(dirname(configPath), { recursive: true });
  const previous = existsSync(configPath) ? readFileSync(configPath, "utf8") : "";
  const cleaned = removeTomlTable(previous, "mcp_servers." + APPPILOT_MCP_SERVER_NAME).trimEnd();
  const block = [
    "[mcp_servers." + APPPILOT_MCP_SERVER_NAME + "]",
    "command = \"" + escapeTomlString(command) + "\"",
    "cwd = \"" + escapeTomlString(cwd) + "\"",
  ].join("\n");
  const next = cleaned + (cleaned ? "\n\n" : "") + block + "\n";
  writeFileSync(configPath, next);
}

function registerCodexPluginConfig(configPath: string, marketplaceRoot: string): void {
  mkdirSync(dirname(configPath), { recursive: true });
  const previous = existsSync(configPath) ? readFileSync(configPath, "utf8") : "";
  const withoutMarketplace = removeTomlTable(previous, "marketplaces.local");
  const cleaned = removeTomlTable(withoutMarketplace, 'plugins."' + APPPILOT_SKILL_NAME + '@local"').trimEnd();
  const block = [
    "[marketplaces.local]",
    "source_type = \"local\"",
    "source = \"" + escapeTomlString(marketplaceRoot) + "\"",
    "",
    "[plugins.\"" + APPPILOT_SKILL_NAME + "@local\"]",
    "enabled = true",
  ].join("\n");
  const next = cleaned + (cleaned ? "\n\n" : "") + block + "\n";
  writeFileSync(configPath, next);
}

function installCodexPlugin(
  pluginRoot: string,
  marketplacePath: string,
  skillSource: string,
  mcpCommand: string,
  mcpCwd: string,
): void {
  const skillTarget = join(pluginRoot, "skills", APPPILOT_SKILL_NAME);
  rmSync(pluginRoot, { recursive: true, force: true });
  mkdirSync(join(pluginRoot, ".codex-plugin"), { recursive: true });
  mkdirSync(dirname(skillTarget), { recursive: true });
  cpSync(skillSource, skillTarget, { recursive: true });

  writeJson(join(pluginRoot, ".mcp.json"), {
    mcpServers: {
      [APPPILOT_SKILL_NAME]: {
        command: mcpCommand,
        cwd: mcpCwd,
      },
    },
  });

  writeJson(join(pluginRoot, ".codex-plugin", "plugin.json"), {
    name: APPPILOT_SKILL_NAME,
    version: "0.1.0",
    description: "Agent-driven mobile app build, verification, and action harness.",
    author: {
      name: "DAI",
      email: "cheng.dai@castbox.fm",
      url: "https://local.app-pilot.dev",
    },
    homepage: "https://local.app-pilot.dev",
    license: "Proprietary",
    keywords: ["apppilot", "mcp", "mobile", "unity", "ios", "android", "xcode", "logs", "actions"],
    skills: "./skills/",
    mcpServers: "./.mcp.json",
    interface: {
      displayName: "AppPilot",
      shortDescription: "Agent-driven mobile build, verify, and action harness.",
      longDescription:
        "AppPilot provides an agent-driven harness for mobile app build, device execution, actions, and targeted verification logs. The current implementation focuses on Unity iOS with Xcode build, real-device launch, WDA control, and gurusdk OfflineLog verification; the harness is structured to extend to Android and additional agent-driven actions. When direct AppPilot tools are not injected, use ~/.apppilot/apppilot-mcp-call as the supported fallback wrapper.",
      developerName: "DAI",
      category: "Developer Tools",
      capabilities: ["Build", "Verification", "Actions", "Automation"],
      defaultPrompt: [
        "Build and verify a mobile app on device.",
        "Run device actions and inspect targeted logs.",
        "Set up the AppPilot harness for agents.",
      ],
      brandColor: "#2563EB",
      screenshots: [],
    },
  });

  registerCodexMarketplace(marketplacePath);
}

function registerCodexMarketplace(marketplacePath: string): void {
  mkdirSync(dirname(marketplacePath), { recursive: true });
  const previous = existsSync(marketplacePath)
    ? JSON.parse(readFileSync(marketplacePath, "utf8"))
    : {
        name: "local",
        interface: {
          displayName: "Local Plugins",
        },
        plugins: [],
      };

  previous.name ??= "local";
  previous.interface ??= {};
  previous.interface.displayName ??= "Local Plugins";
  previous.plugins = (previous.plugins ?? []).filter((plugin: { name?: string }) => plugin.name !== APPPILOT_SKILL_NAME);
  previous.plugins.push({
    name: APPPILOT_SKILL_NAME,
    source: {
      source: "local",
      path: "./plugins/" + APPPILOT_SKILL_NAME,
    },
    policy: {
      installation: "INSTALLED_BY_DEFAULT",
      authentication: "ON_INSTALL",
    },
    category: "Developer Tools",
  });
  writeJson(marketplacePath, previous);
}

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, JSON.stringify(value, null, 2) + "\n");
}

function removeTomlTable(content: string, tableName: string): string {
  const lines = content.split(/\r?\n/);
  const output: string[] = [];
  let skipping = false;

  for (const line of lines) {
    const table = line.match(/^\s*\[([^\]]+)\]\s*$/)?.[1];
    if (table) {
      skipping = table === tableName;
    }
    if (!skipping) {
      output.push(line);
    }
  }

  return output.join("\n");
}

function escapeTomlString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
}
