import type { AppPilotOperationPort } from "../../port/app-pilot-operation-port.ts";
import { readIdentityOption, readNumberOption, readOption } from "../args.ts";
import type { AppPilotCommand } from "./app-pilot-command.ts";
import { invokeOperation } from "./operation-command.ts";

export class LogsCommand implements AppPilotCommand {
  constructor(private readonly operationPort: AppPilotOperationPort) {}

  invoke(args: string[]): Promise<object> {
    return invokeOperation(args, () => {
      const match = readOption(args, "--match");
      return this.operationPort.logs({
        identity: readIdentityOption(args),
        appId: readOption(args, "--app-id"),
        outputPath: readOption(args, "--output-path"),
        offset: readNumberOption(args, "--offset"),
        ...(match ? { match } : {}),
      });
    });
  }
}
