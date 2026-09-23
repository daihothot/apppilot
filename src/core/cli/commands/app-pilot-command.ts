export type AppPilotCommandOutput = string | object;

export interface AppPilotCommand {
  invoke(args: string[]): Promise<AppPilotCommandOutput>;
}
