using System;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEditor.Build.Reporting;
using UnityEngine;

namespace AppPilot.UnityTools
{
    public static class AppPilotUnityBuild
    {
        public static void BuildIOSDevice()
        {
            var outputPath = ReadOption("-apppilotOutputPath");
            if (string.IsNullOrEmpty(outputPath))
            {
                Debug.LogError("Missing -apppilotOutputPath.");
                EditorApplication.Exit(1);
                return;
            }

            var configuration = ReadOption("-apppilotConfiguration") ?? "debug";
            var isDebug = string.Equals(configuration, "debug", StringComparison.OrdinalIgnoreCase);
            var append = string.Equals(ReadOption("-apppilotAppend"), "true", StringComparison.OrdinalIgnoreCase);

            var previousTarget = EditorUserBuildSettings.activeBuildTarget;
            var previousGroup = BuildPipeline.GetBuildTargetGroup(previousTarget);
            var previousDevelopment = EditorUserBuildSettings.development;
            var previousAllowDebugging = EditorUserBuildSettings.allowDebugging;
            var previousConnectProfiler = EditorUserBuildSettings.connectProfiler;
            var previousBuildScriptsOnly = EditorUserBuildSettings.buildScriptsOnly;
            var previousSdkVersion = PlayerSettings.iOS.sdkVersion;
            var previousTargetDevice = PlayerSettings.iOS.targetDevice;

            try
            {
                Directory.CreateDirectory(outputPath);

                if (EditorUserBuildSettings.activeBuildTarget != BuildTarget.iOS)
                {
                    EditorUserBuildSettings.SwitchActiveBuildTarget(BuildTargetGroup.iOS, BuildTarget.iOS);
                }

                EditorUserBuildSettings.development = isDebug;
                EditorUserBuildSettings.allowDebugging = isDebug;
                EditorUserBuildSettings.connectProfiler = false;
                EditorUserBuildSettings.buildScriptsOnly = false;

                PlayerSettings.iOS.sdkVersion = iOSSdkVersion.DeviceSDK;
                PlayerSettings.iOS.targetDevice = iOSTargetDevice.iPhoneAndiPad;

                var buildOptions = isDebug ? BuildOptions.Development | BuildOptions.AllowDebugging : BuildOptions.None;
                if (append)
                {
                    buildOptions |= BuildOptions.AcceptExternalModificationsToPlayer;
                }

                var options = new BuildPlayerOptions
                {
                    scenes = EditorBuildSettings.scenes
                        .Where(scene => scene.enabled)
                        .Select(scene => scene.path)
                        .ToArray(),
                    locationPathName = outputPath,
                    target = BuildTarget.iOS,
                    targetGroup = BuildTargetGroup.iOS,
                    options = buildOptions,
                };

                Debug.Log($"[AppPilot] Build iOS device Xcode project: {outputPath}, append={append}");
                var report = BuildPipeline.BuildPlayer(options);
                if (report.summary.result != BuildResult.Succeeded)
                {
                    Debug.LogError($"[AppPilot] Build failed: {report.summary.result}");
                    EditorApplication.Exit(1);
                    return;
                }

                Debug.Log($"[AppPilot] Build succeeded: {report.summary.outputPath}");
                EditorApplication.Exit(0);
            }
            catch (Exception ex)
            {
                Debug.LogException(ex);
                EditorApplication.Exit(1);
            }
            finally
            {
                PlayerSettings.iOS.sdkVersion = previousSdkVersion;
                PlayerSettings.iOS.targetDevice = previousTargetDevice;
                EditorUserBuildSettings.development = previousDevelopment;
                EditorUserBuildSettings.allowDebugging = previousAllowDebugging;
                EditorUserBuildSettings.connectProfiler = previousConnectProfiler;
                EditorUserBuildSettings.buildScriptsOnly = previousBuildScriptsOnly;

                if (previousTarget != BuildTarget.iOS)
                {
                    EditorUserBuildSettings.SwitchActiveBuildTarget(previousGroup, previousTarget);
                }

                AssetDatabase.SaveAssets();
            }
        }

        private static string ReadOption(string name)
        {
            var args = Environment.GetCommandLineArgs();
            for (var i = 0; i < args.Length - 1; i++)
            {
                if (args[i] == name)
                {
                    return args[i + 1];
                }
            }

            return null;
        }
    }
}
