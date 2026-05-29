import { expect, test } from "bun:test";
import { BuildRunner } from "../../src/core/build/build-runner.ts";
import type { AdapterFactory } from "../../src/core/factory/adapter-factory.ts";
import { buildArtifact } from "../helpers/mocks.ts";

function createRunner(): { runner: BuildRunner; calls: Array<{ method: string; args: unknown[] }> } {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  const unity = {
    async prepare(options: unknown): Promise<unknown> {
      calls.push({ method: "prepare", args: [options] });
      return buildArtifact({ platform: "ios" });
    },
    async prepareAndroid(options: unknown): Promise<unknown> {
      calls.push({ method: "prepareAndroid", args: [options] });
      return buildArtifact({ platform: "android" });
    },
    async buildXcodeFromArtifact(projectPath?: string): Promise<unknown> {
      calls.push({ method: "buildXcodeFromArtifact", args: [projectPath] });
      return { ok: true };
    },
  };
  const factory = {
    createUnityAdapter(): typeof unity {
      return unity;
    },
  } as unknown as AdapterFactory;
  return { runner: new BuildRunner(factory), calls };
}

test("BuildRunner routes Unity iOS prepare with task options", async () => {
  const { runner, calls } = createRunner();

  await runner.run({
    adapter: "unity",
    platform: "ios",
    action: "build",
    projectPath: "/project",
    debug: false,
    refresh: false,
    buildRes: true,
    xcode: false,
  });

  expect(calls).toEqual([
    {
      method: "prepare",
      args: [{
        projectDir: "/project",
        ios: true,
        debug: false,
        buildRes: true,
        build: true,
        refreshBuild: false,
      }],
    },
  ]);
});

test("BuildRunner routes Unity Android prepare", async () => {
  const { runner, calls } = createRunner();

  await runner.run({ adapter: "unity", platform: "android", action: "build", projectPath: "/project" });

  expect(calls).toEqual([
    {
      method: "prepareAndroid",
      args: [{
        projectDir: "/project",
        debug: true,
        buildRes: false,
        build: false,
        refreshBuild: true,
      }],
    },
  ]);
});

test("BuildRunner routes explicit iOS xcode action without requiring projectPath", async () => {
  const { runner, calls } = createRunner();

  await runner.run({ adapter: "unity", platform: "ios", action: "xcode" });

  expect(calls).toEqual([{ method: "buildXcodeFromArtifact", args: [undefined] }]);
});
