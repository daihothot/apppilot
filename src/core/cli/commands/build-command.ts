import type { AppPilotOperationPort } from "../../port/app-pilot-operation-port.ts";
import { hasFlag, readOption } from "../args.ts";
import type { AppPilotCommand } from "./app-pilot-command.ts";
import { invokeOperation } from "./operation-command.ts";

export class BuildCommand implements AppPilotCommand {
  constructor(private readonly operationPort: AppPilotOperationPort) {}

  invoke(args: string[]): Promise<object> {
    return invokeOperation(args, () => this.operationPort.build({
      platform: readOption(args, "--platform"),
      projectPath: readOption(args, "--project-path"),
      outputPath: readOption(args, "--output-path"),
      configuration: hasFlag(args, "--release") ? "release" : "debug",
      append: hasFlag(args, "--append"),
      buildResources: hasFlag(args, "--build-resources"),
      buildNative: hasFlag(args, "--build-native"),
    }));
  }
}
