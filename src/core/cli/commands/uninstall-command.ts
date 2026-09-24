import type { AppPilotOperationPort } from "../../port/app-pilot-operation-port.ts";
import { readIdentityOption, readOption } from "../args.ts";
import type { AppPilotCommand } from "./app-pilot-command.ts";
import { invokeOperation } from "./operation-command.ts";

export class UninstallCommand implements AppPilotCommand {
  constructor(private readonly operationPort: AppPilotOperationPort) {}

  invoke(args: string[]): Promise<object> {
    return invokeOperation(args, () => this.operationPort.uninstall({
      identity: readIdentityOption(args),
      appId: readOption(args, "--app-id"),
    }));
  }
}
