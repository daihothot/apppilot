import type { AppPilotOperationPort } from "../../port/app-pilot-operation-port.ts";
import { readNumberOption } from "../args.ts";
import type { AppPilotCommand } from "./app-pilot-command.ts";
import { invokeOperation } from "./operation-command.ts";

export class TapCommand implements AppPilotCommand {
  constructor(private readonly operationPort: AppPilotOperationPort) {}

  invoke(args: string[]): Promise<object> {
    return invokeOperation(args, () => this.operationPort.tap({
      x: readNumberOption(args, "--x"),
      y: readNumberOption(args, "--y"),
    }));
  }
}
