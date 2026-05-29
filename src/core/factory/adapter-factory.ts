import { BuildArtifactStore } from "../artifact/build-artifact-store.ts";
import { UnityAdapter } from "../../adapter/unity/unity-adapter.ts";
import { LogStore } from "../log/log-store.ts";

export class AdapterFactory {
  createUnityAdapter(): UnityAdapter {
    return new UnityAdapter(new LogStore(), new BuildArtifactStore());
  }
}
