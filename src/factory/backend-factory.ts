import type { Backend } from "../backend/backend.ts";
import { IosBackend } from "../backend/ios-backend.ts";
import type { Platform } from "../types.ts";

export class BackendFactory {
  create(platform: Platform): Backend {
    if (platform === "ios") {
      return new IosBackend();
    }

    throw new Error(`Unsupported platform: ${platform}`);
  }
}
