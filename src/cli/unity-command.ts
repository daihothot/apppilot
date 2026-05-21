import { BuildRunner } from "../build/build-runner.ts";
import { AdapterFactory } from "../factory/adapter-factory.ts";
import { hasFlag, requirePositional } from "./args.ts";

export async function runUnityCommand(command: string | undefined, args: string[]): Promise<void> {
  const unity = new AdapterFactory().createUnityAdapter();
  if (command === "status") {
    process.stdout.write(unity.statusText());
    return;
  }
  if (command === "xcode") {
    await runUnityXcodeCommand(args[0]);
    return;
  }

  const projectDir = requirePositional(command, "UNITY_DIR");
  const artifact = await new BuildRunner().run({
    adapter: "unity",
    platform: "ios",
    action: "build",
    projectPath: projectDir,
    debug: !hasFlag(args, "--release"),
    buildRes: hasFlag(args, "--build-res"),
    refresh: hasFlag(args, "--refresh-build") || !hasFlag(args, "--build"),
    xcode: false,
  });
  process.stdout.write(JSON.stringify(artifact, null, 2) + "\n");
}

async function runUnityXcodeCommand(command: string | undefined): Promise<void> {
  const unity = new AdapterFactory().createUnityAdapter();
  switch (command) {
    case "build":
      const artifact = await new BuildRunner().run({ adapter: "unity", platform: "ios", action: "xcode" });
      process.stdout.write(JSON.stringify(artifact, null, 2) + "\n");
      return;
    case "status":
      process.stdout.write(unity.xcodeStatusText());
      return;
    default:
      throw new Error("Unknown unity xcode command. Expected build or status.");
  }
}
