import { appPilotConfig } from "../config/app-pilot-config.ts";

export function projectRoot(): string {
  return appPilotConfig.paths.home;
}
