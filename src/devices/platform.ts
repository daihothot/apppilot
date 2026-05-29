import { hasFlag } from "../cli/args.ts";
import type { Platform } from "./types.ts";

export function readPlatform(args: string[]): Platform {
  if (hasFlag(args, "--ios")) {
    return "ios";
  }
  if (hasFlag(args, "--android")) {
    return "android";
  }

  throw new Error("Command currently requires --ios or --android.");
}
