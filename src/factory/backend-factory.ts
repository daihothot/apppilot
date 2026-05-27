import type { Backend } from "../backend/backend.ts";
import { AndroidBackend } from "../backend/android-backend.ts";
import { IosBackend } from "../backend/ios-backend.ts";
import type { Platform } from "../types.ts";

export class BackendFactory {
  create(platform: Platform): Backend {
    if (platform === "ios") {
      return new IosBackend();
    }
    if (platform === "android") {
      return new AndroidBackend();
    }

    throw new Error(`Unsupported platform: ${platform}`);
  }
}
