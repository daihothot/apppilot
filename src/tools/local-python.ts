import { existsSync } from "node:fs";
import { appPilotConfig } from "../config/app-pilot-config.ts";

export function requireLocalPymobiledevice3Path(): string {
  if (!existsSync(appPilotConfig.paths.localPymobiledevice3)) {
    throw new Error(
      `Local pymobiledevice3 not found at ${appPilotConfig.paths.localPymobiledevice3}. Run: apppilot tools setup --ios`,
    );
  }

  return appPilotConfig.paths.localPymobiledevice3;
}
