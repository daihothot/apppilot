import { homedir } from "node:os";
import { join } from "node:path";

export const OFFLINE_LOG_ROOT_PATH = "Library/Caches/Logs";
export const OFFLINE_LOG_DIR_NAME = "gurusdk";

export const APPPILOT_HOME = join(homedir(), ".apppilot");

export const LOG_ROOT = join(APPPILOT_HOME, "log");
export const ARTIFACT_ROOT = join(APPPILOT_HOME, "artifact");
export const UNITY_BUILD_TIMEOUT_MS = 30 * 60 * 1000;
export const XCODE_BUILD_TIMEOUT_MS = 30 * 60 * 1000;
export const LOCAL_TOOLS_ROOT = join(APPPILOT_HOME, ".tools");
export const LOCAL_PYTHON_VENV_DIR = join(LOCAL_TOOLS_ROOT, "python", "venv");
export const LOCAL_PYTHON_BIN = join(LOCAL_PYTHON_VENV_DIR, "bin", "python");
export const LOCAL_PYMOBILEDEVICE3_PATH = join(LOCAL_PYTHON_VENV_DIR, "bin", "pymobiledevice3");
export const WDA_DEFAULT_URL = "http://localhost:8100";

export const UNITY_IOS_ARTIFACT_DIR = join(ARTIFACT_ROOT, "unity", "ios");
export const UNITY_IOS_XCODE_DIR = join(UNITY_IOS_ARTIFACT_DIR, "xcode");
export const UNITY_IOS_BUILD_JSON = join(UNITY_IOS_ARTIFACT_DIR, "unity-build.json");
export const UNITY_ANDROID_ARTIFACT_DIR = join(ARTIFACT_ROOT, "unity", "android");
export const UNITY_ANDROID_APK_PATH = join(UNITY_ANDROID_ARTIFACT_DIR, "app.apk");
export const UNITY_ANDROID_BUILD_JSON = join(UNITY_ANDROID_ARTIFACT_DIR, "unity-build.json");
export const TASK_STATUS_JSON = join(LOG_ROOT, "status.json");
export const XCODE_IOS_BUILD_LOG = join(LOG_ROOT, "xcode-ios-build.log");
export const IOS_TOOLS_SETUP_LOG = join(LOG_ROOT, "tools-ios-setup.log");

export const APP_LOG_IOS_DIR = join(ARTIFACT_ROOT, "logs", "ios");
export const APP_LOG_ANDROID_DIR = join(ARTIFACT_ROOT, "logs", "android");
