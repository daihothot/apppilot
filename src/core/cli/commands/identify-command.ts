import type { AppPilotOperationPort } from "../../port/app-pilot-operation-port.ts";
import { readOption } from "../args.ts";
import type { AppPilotCommand } from "./app-pilot-command.ts";
import { invokeOperation } from "./operation-command.ts";

export class IdentifyCommand implements AppPilotCommand {
  constructor(private readonly operationPort: AppPilotOperationPort) {}

  invoke(args: string[]): Promise<object> {
    return invokeOperation(args, () => {
      const transport = readOption(args, "--transport");
      return this.operationPort.identify(transport ? { transport } : {});
    });
  }
}
