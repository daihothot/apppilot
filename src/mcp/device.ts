import { BackendFactory } from "../factory/backend-factory.ts";

export interface IosDeviceInfo {
  ConnectionType?: string;
  Identifier?: string;
  UniqueDeviceID?: string;
  DeviceName?: string;
  [key: string]: unknown;
}

export async function listIosDevices(): Promise<IosDeviceInfo[]> {
  const backend = new BackendFactory().create("ios");
  const result = await backend.listDevices();
  if (result.exitCode !== 0) {
    throw new Error(result.stderr.trim() || "Failed to list iOS devices.");
  }
  return JSON.parse(result.stdout) as IosDeviceInfo[];
}
