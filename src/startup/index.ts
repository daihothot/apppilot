#!/usr/bin/env bun
import { createAppPilotScope, type AppPilotScope } from "./app-pilot-scope.ts";
import { runAppPilotProcess } from "./app-pilot-process.ts";

export function startAppPilot(): AppPilotScope {
  return createAppPilotScope();
}

if (import.meta.main) {
  const scope = startAppPilot();
  const args = process.argv.slice(2);
  const running = args.length === 1 && args[0] === "--stdio"
    ? runAppPilotProcess(scope)
    : scope.cli.invoke(args).then((result) => {
      process.stdout.write(typeof result === "string"
        ? result
        : JSON.stringify(result, null, 2) + "\n");
    });
  running.catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    scope.logStore.error(message);
    process.stderr.write(message + "\n");
  });
}
