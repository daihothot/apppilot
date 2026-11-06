import type { AppPilotOperationPort } from "../../port/app-pilot-operation-port.ts";
import { readDictionaryOptions, readIdentityOption, readOption } from "../args.ts";
import type { AppPilotCommand } from "./app-pilot-command.ts";
import { invokeOperation } from "./operation-command.ts";

export class WriteRbtConfigCommand implements AppPilotCommand {
  constructor(private readonly operationPort: AppPilotOperationPort) {}

  invoke(args: string[]): Promise<object> {
    return invokeOperation(args, () => {
      const entries = readDictionaryOptions(args, "--entry");
      if (!entries || Object.keys(entries).some(key => !key.trim())) {
        throw new Error("At least one --entry KEY=VALUE with a non-empty key is required.");
      }
      return this.operationPort.writeRbtConfig({
        identity: readIdentityOption(args),
        appId: readOption(args, "--app-id"),
        entries,
      });
    });
  }
}
