const {
  withAndroidManifest,
  withMainApplication,
  withDangerousMod,
} = require("expo/config-plugins");
const fs = require("node:fs");
const path = require("node:path");
const service =
  "com.henrique.meusgastos.banknotifications.BankNotificationService";
function applyManifest(manifest) {
  const app = manifest.application[0];
  app.service = (app.service || []).filter(
    (s) => s.$["android:name"] !== service,
  );
  app.$["android:fullBackupContent"] = "@xml/meus_gastos_backup_rules";
  app.$["android:dataExtractionRules"] = "@xml/meus_gastos_extraction_rules";
  manifest["uses-permission"] = manifest["uses-permission"] || [];
  for (const permission of [
    "android.permission.USE_BIOMETRIC",
    "android.permission.USE_FINGERPRINT",
  ])
    if (
      !manifest["uses-permission"].some(
        (p) => p.$["android:name"] === permission,
      )
    )
      manifest["uses-permission"].push({ $: { "android:name": permission } });
}
function patchMain(contents) {
  const marker =
    "add(com.henrique.meusgastos.banknotifications.BankNotificationsPackage())";
  return contents.replace(marker, "");
}
function copySources(root, androidRoot) {
  const destination = path.join(
    androidRoot,
    "app/src/main/java/com/henrique/meusgastos/banknotifications",
  );
  fs.rmSync(destination, { recursive: true, force: true });
  const xml = path.join(androidRoot, "app/src/main/res/xml");
  fs.mkdirSync(xml, { recursive: true });
  const exclude =
    '<exclude domain="sharedpref" path="SecureStore"/><exclude domain="sharedpref" path="bank_notification_queue.xml"/>';
  fs.writeFileSync(
    path.join(xml, "meus_gastos_backup_rules.xml"),
    `<?xml version="1.0" encoding="utf-8"?><full-backup-content>${exclude}</full-backup-content>`,
  );
  fs.writeFileSync(
    path.join(xml, "meus_gastos_extraction_rules.xml"),
    `<?xml version="1.0" encoding="utf-8"?><data-extraction-rules><cloud-backup>${exclude}</cloud-backup><device-transfer>${exclude}</device-transfer></data-extraction-rules>`,
  );
}
module.exports = (config) => {
  config = withAndroidManifest(config, (mod) => {
    applyManifest(mod.modResults.manifest);
    return mod;
  });
  config = withMainApplication(config, (mod) => {
    mod.modResults.contents = patchMain(mod.modResults.contents);
    return mod;
  });
  return withDangerousMod(config, [
    "android",
    async (mod) => {
      copySources(
        mod.modRequest.projectRoot,
        mod.modRequest.platformProjectRoot,
      );
      return mod;
    },
  ]);
};
Object.assign(module.exports, { applyManifest, patchMain, copySources });
