import { existsSync } from "node:fs";
import { LOCAL_PYMOBILEDEVICE3_PATH } from "../constants.ts";

export function requireLocalPymobiledevice3Path(): string {
  if (!existsSync(LOCAL_PYMOBILEDEVICE3_PATH)) {
    throw new Error(
      `Local pymobiledevice3 not found at ${LOCAL_PYMOBILEDEVICE3_PATH}. Run: apppilot tools setup --ios`,
    );
  }

  return LOCAL_PYMOBILEDEVICE3_PATH;
}
