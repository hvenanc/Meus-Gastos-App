const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const sdk = [
  process.env.ANDROID_HOME,
  process.env.ANDROID_SDK_ROOT,
  path.join(root, ".build-tools/android-sdk"),
].find(
  (candidate) => candidate && fs.existsSync(path.join(candidate, "platforms")),
);
if (!sdk) throw new Error("Instale o SDK Android e configure ANDROID_HOME.");
const env = {
  ...process.env,
  NODE_ENV: "production",
  ANDROID_HOME: sdk,
  ANDROID_SDK_ROOT: sdk,
  GRADLE_USER_HOME:
    process.env.GRADLE_USER_HOME || path.join(root, ".build-tools/gradle"),
};
function run(cmd, args, cwd = root) {
  const result = spawnSync(cmd, args, { cwd, env, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
run(process.execPath, ["scripts/prepare-android-signing.cjs"]);
if (!process.argv.includes("--skip-prebuild"))
  run(process.execPath, [
    "node_modules/expo/bin/cli",
    "prebuild",
    "--platform",
    "android",
    "--no-install",
  ]);
run(process.execPath, ["scripts/sync-native-features.cjs"]);
run(
  "./gradlew",
  [
    ":app:assembleRelease",
    "--max-workers=1",
    "--no-daemon",
    "-Dorg.gradle.jvmargs=-Xmx1536m -XX:MaxMetaspaceSize=512m",
  ],
  path.join(root, "android"),
);
fs.mkdirSync(path.join(root, "artifacts"), { recursive: true });
fs.copyFileSync(
  path.join(root, "android/app/build/outputs/apk/release/app-release.apk"),
  path.join(
    root,
    `artifacts/meus-gastos-${require("../package.json").version}.apk`,
  ),
);
console.log(
  `APK: artifacts/meus-gastos-${require("../package.json").version}.apk`,
);
