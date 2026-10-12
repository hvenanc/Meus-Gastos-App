const { withAppBuildGradle } = require('expo/config-plugins');
module.exports = (config) => withAppBuildGradle(config, (mod) => {
  const header = `def releaseSigningProperties = new Properties()
def releaseSigningFile = rootProject.file('../.build-tools/signing/release.properties')
if (releaseSigningFile.exists()) {
    releaseSigningFile.withInputStream { releaseSigningProperties.load(it) }
}
`;
  let s = mod.modResults.contents;
  if (!s.includes('def releaseSigningProperties')) {
    s = header + s;
    s = s.replace('signingConfigs {', `signingConfigs {
        release {
            if (releaseSigningFile.exists()) {
                storeFile rootProject.file('../.build-tools/signing/release.jks')
                storePassword releaseSigningProperties['storePassword']
                keyAlias releaseSigningProperties['keyAlias']
                keyPassword releaseSigningProperties['keyPassword']
            }
        }`);
    s = s.replace(/(release\s*\{\s*\/\/ Caution![\s\S]*?)signingConfig signingConfigs.debug/, '$1signingConfig signingConfigs.release');
  }
  mod.modResults.contents = s;
  return mod;
});
