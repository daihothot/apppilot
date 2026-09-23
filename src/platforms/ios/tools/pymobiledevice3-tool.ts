import { requirePymobiledevice3Path } from "../../../env/ios-environment.ts";
import { HostCommandExecutor, type HostCommandResult } from "../../../host/host-command-executor.ts";

/** iOS platform tool. It is invoked by a selected executor and is not a transport. */
export class Pymobiledevice3Tool {
  private readonly hostCommands = new HostCommandExecutor();

  execute(deviceId: string | undefined, args: string[]): Promise<HostCommandResult> {
    const env = deviceId ? { ...process.env, PYMOBILEDEVICE3_UDID: deviceId } : process.env;
    return this.hostCommands.run({ executable: requirePymobiledevice3Path(), args, env });
  }

  list(): Promise<HostCommandResult> {
    return this.execute(undefined, ["usbmux", "list"]);
  }
  install(deviceId: string, artifactPath: string): Promise<HostCommandResult> {
    return this.execute(deviceId, ["apps", "install", artifactPath]);
  }
  uninstall(deviceId: string, appId: string): Promise<HostCommandResult> {
    return this.execute(deviceId, ["apps", "uninstall", appId]);
  }
  launch(deviceId: string, appId: string): Promise<HostCommandResult> {
    return this.execute(deviceId, ["developer", "dvt", "launch", appId]);
  }
  pull(deviceId: string, appId: string, remotePath: string, outputPath: string): Promise<HostCommandResult> {
    return this.execute(deviceId, ["apps", "pull", appId, remotePath, outputPath]);
  }
}
