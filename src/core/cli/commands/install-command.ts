import type { AppPilotOperationPort } from "../../port/app-pilot-operation-port.ts";
import { readOption } from "../args.ts";
import type { AppPilotCommand } from "./app-pilot-command.ts";
import { invokeOperation } from "./operation-command.ts";

export class InstallCommand implements AppPilotCommand {
  constructor(private readonly operationPort: AppPilotOperationPort) {}

  invoke(args: string[]): Promise<object> {
    return invokeOperation(args, () => this.operationPort.install({
      appId: readOption(args, "--app-id"),
      artifactPath: readOption(args, "--artifact-path"),
    }));
  }
}
