import type { AppPilotOperationPort } from "../../port/app-pilot-operation-port.ts";
import { readNumberOption } from "../args.ts";
import type { AppPilotCommand } from "./app-pilot-command.ts";
import { invokeOperation } from "./operation-command.ts";

export class SwipeCommand implements AppPilotCommand {
  constructor(private readonly operationPort: AppPilotOperationPort) {}

  invoke(args: string[]): Promise<object> {
    return invokeOperation(args, () => this.operationPort.swipe({
      fromX: readNumberOption(args, "--from-x"),
      fromY: readNumberOption(args, "--from-y"),
      toX: readNumberOption(args, "--to-x"),
      toY: readNumberOption(args, "--to-y"),
    }));
  }
}
