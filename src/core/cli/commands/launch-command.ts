import type { AppPilotOperationPort } from "../../port/app-pilot-operation-port.ts";
import { readDictionaryOptions, readIdentityOption, readOption } from "../args.ts";
import type { AppPilotCommand } from "./app-pilot-command.ts";
import { invokeOperation } from "./operation-command.ts";

export class LaunchCommand implements AppPilotCommand {
  constructor(private readonly operationPort: AppPilotOperationPort) {}

  invoke(args: string[]): Promise<object> {
    return invokeOperation(args, () => this.operationPort.launch({
      identity: readIdentityOption(args),
      appId: readOption(args, "--app-id"),
      parameters: readDictionaryOptions(args, "--parameter"),
    }));
  }
}
