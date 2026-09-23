import type { AppPilotFailure, AppPilotIdentity } from "./app-pilot-operation-port.ts";

export function invalidArgument(argument: string, reason = "is required"): AppPilotFailure {
  return {
    ok: false,
    code: "invalid_argument",
    message: `${argument} ${reason}.`,
  };
}

export function operationUnsupported(operation: string, identity: AppPilotIdentity): AppPilotFailure {
  return {
    ok: false,
    code: "operation_unsupported",
    message: `${operation} is not supported by ${identity.transport}/${identity.platform.type}.`,
  };
}
