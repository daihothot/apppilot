import type { AppPilotCommand, AppPilotCommandOutput } from "./commands/app-pilot-command.ts";

export class AppPilotCli {
  constructor(private readonly commands: ReadonlyMap<string, AppPilotCommand>) {}

  async invoke(args: string[]): Promise<AppPilotCommandOutput> {
    const [name, ...commandArgs] = args;
    if (!name || name === "help" || name === "--help" || name === "-h") {
      return helpText();
    }
    const command = this.commands.get(name);
    if (!command) throw new Error(`Unknown command: ${name}.`);
    return command.invoke(commandArgs);
  }
}

function helpText(): string {
  return `AppPilot

  apppilot identify [--transport unity-pipeline|adb]
  apppilot build --platform ios|android --project-path <PATH> --output-path <PATH>
  apppilot install --app-id <ID> --artifact-path <PATH>
  apppilot uninstall|launch|restart|shutdown --app-id <ID>
  apppilot tap|swipe ...
  apppilot logs --app-id <ID> --output-path <PATH>
  apppilot setup --ios|--plugin|--all
  apppilot log clear
`;
}
