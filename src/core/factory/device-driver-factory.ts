import { AndroidDeviceDriver } from "../../devices/android/android-device-driver.ts";
import type { DeviceDriver } from "../../devices/device-driver.ts";
import { IosDeviceDriver } from "../../devices/ios/ios-device-driver.ts";
import type { Platform } from "../../devices/types.ts";

export class DeviceDriverFactory {
  create(platform: Platform): DeviceDriver {
    if (platform === "ios") {
      return new IosDeviceDriver();
    }
    if (platform === "android") {
      return new AndroidDeviceDriver();
    }

    throw new Error(`Unsupported platform: ${platform}`);
  }
}
