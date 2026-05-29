import { expect, test } from "bun:test";
import { AppExecutor } from "../../src/core/executor/app-executor.ts";
import { buildArtifact, commandResult, createMockBuildStore, createMockDeviceDriver, createMockLogStore } from "../helpers/mocks.ts";

test("AppExecutor.run installs artifact and launches bundle with launch options", async () => {
  const build = buildArtifact({ platform: "ios", appPath: "/artifact/game.ipa", bundleId: "tile.game" });
  const { store: builds, calls: buildCalls } = createMockBuildStore(build);
  const { store: log, entries } = createMockLogStore();
  const { driver, calls } = createMockDeviceDriver({ platform: "ios" });
  const executor = new AppExecutor(log, builds, driver);
  const launchOptions = { env: { guru_debug: "true" } };

  await executor.run("device-1", launchOptions);

  expect(buildCalls).toEqual(["ios"]);
  expect(calls).toEqual([
    { method: "install", args: ["device-1", "/artifact/game.ipa"] },
    { method: "launch", args: ["device-1", "tile.game", launchOptions] },
  ]);
  expect(entries.map((entry) => entry.message)).toEqual(["app run started", "app run finished"]);
});

test("AppExecutor.run stops before launch when install fails", async () => {
  const build = buildArtifact({ platform: "android", appPath: "/artifact/game.apk", bundleId: "tile.game" });
  const { store: builds } = createMockBuildStore(build);
  const { store: log } = createMockLogStore();
  const { driver, calls } = createMockDeviceDriver({
    platform: "android",
    installResult: commandResult({ exitCode: 1, stderr: "install failed" }),
  });
  const executor = new AppExecutor(log, builds, driver);

  await expect(executor.run("android-1")).rejects.toThrow("install failed");

  expect(calls).toEqual([
    { method: "install", args: ["android-1", "/artifact/game.apk"] },
  ]);
});

test("AppExecutor.stop uses artifact bundle id", async () => {
  const build = buildArtifact({ platform: "android", bundleId: "tile.game" });
  const { store: builds } = createMockBuildStore(build);
  const { store: log } = createMockLogStore();
  const { driver, calls } = createMockDeviceDriver({ platform: "android" });
  const executor = new AppExecutor(log, builds, driver);

  await executor.stop("android-1");

  expect(calls).toEqual([{ method: "stop", args: ["android-1", "tile.game"] }]);
});
