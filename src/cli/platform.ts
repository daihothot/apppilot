import type { Platform } from "../types.ts";
import { hasFlag } from "./args.ts";

export function readPlatform(args: string[]): Platform {
  if (hasFlag(args, "--ios")) {
    return "ios";
  }

  throw new Error("Command currently requires --ios.");
}
