import { DeviceDriverFactory } from "../core/factory/device-driver-factory.ts";

export interface IosDeviceInfo {
  ConnectionType?: string;
  Identifier?: string;
  UniqueDeviceID?: string;
  DeviceName?: string;
  [key: string]: unknown;
}

export async function listIosDevices(): Promise<IosDeviceInfo[]> {
  const deviceDriver = new DeviceDriverFactory().create("ios");
  const result = await deviceDriver.listDevices();
  if (result.exitCode !== 0) {
    throw new Error(result.stderr.trim() || "Failed to list iOS devices.");
  }
  return JSON.parse(result.stdout) as IosDeviceInfo[];
}
