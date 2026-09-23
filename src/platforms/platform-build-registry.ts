import type { AppPilotFailure, AppPilotResult, BuildArtifact, BuildRequest } from "../core/port/app-pilot-operation-port.ts";
import { invalidArgument } from "../core/port/app-pilot-errors.ts";

export interface PlatformBuildTool {
  build(request: BuildRequest): Promise<AppPilotResult<BuildArtifact>>;
}

export interface PlatformBuildRegistration {
  platform: string;
  tool: PlatformBuildTool;
}

/** Routes build semantics directly by target platform; build does not select a runtime transport. */
export class PlatformBuildRegistry {
  constructor(private readonly registrations: readonly PlatformBuildRegistration[]) {}

  async build(request: BuildRequest): Promise<AppPilotResult<BuildArtifact>> {
    if (!request.platform?.trim()) return invalidArgument("platform");
    const registration = this.registrations.find((candidate) => candidate.platform === request.platform);
    if (!registration) return failure("build_platform_unsupported", `Build platform ${request.platform} is not registered.`);
    try {
      return await registration.tool.build(request);
    } catch (error) {
      return failure("build_failed", error instanceof Error ? error.message : String(error));
    }
  }
}

function failure(code: string, message: string): AppPilotFailure {
  return { ok: false, code, message };
}
