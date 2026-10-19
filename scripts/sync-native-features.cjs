const fs = require("node:fs");
const path = require("node:path");
const { AndroidConfig } = require("expo/config-plugins");
const features = require("../plugins/withInvestmentBiometrics");
(async () => {
  const root = path.resolve(__dirname, ".."),
    native = path.join(root, "android");
  const manifestPath = path.join(native, "app/src/main/AndroidManifest.xml");
  const doc =
    await AndroidConfig.Manifest.readAndroidManifestAsync(manifestPath);
  features.applyManifest(doc.manifest);
  await AndroidConfig.Manifest.writeAndroidManifestAsync(manifestPath, doc);
  const main = path.join(
    native,
    "app/src/main/java/com/henrique/meusgastos/MainApplication.kt",
  );
  const source = fs.readFileSync(main, "utf8"),
    next = features.patchMain(source);
  if (source !== next) fs.writeFileSync(main, next);
  features.copySources(root, native);
  console.log(
    "Monitoramento removido; permissões biométricas preservadas no Android.",
  );
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
