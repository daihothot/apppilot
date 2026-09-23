import { HostCommandExecutor, type HostCommandResult } from "../../../../host/host-command-executor.ts";

/** The Android Device Bridge transport owned by AdbAdapter. */
export class AdbTransport {
  readonly id = "adb";
  private readonly hostCommands = new HostCommandExecutor();

  constructor(private readonly executable = "adb") {}

  execute(args: string[]): Promise<HostCommandResult> {
    return this.hostCommands.run({ executable: this.executable, args });
  }
}
