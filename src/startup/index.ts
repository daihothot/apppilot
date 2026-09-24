#!/usr/bin/env bun
import { createAppPilotScope, type AppPilotScope } from "./app-pilot-scope.ts";

export function startAppPilot(): AppPilotScope {
  return createAppPilotScope();
}

if (import.meta.main) {
  const scope = startAppPilot();
  const args = process.argv.slice(2);
  const running = scope.cli.invoke(args).then((result) => {
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
