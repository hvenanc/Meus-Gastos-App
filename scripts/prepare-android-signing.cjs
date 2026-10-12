const fs = require('node:fs');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const dir = '.build-tools/signing';
fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
const key = `${dir}/release.jks`;
const props = `${dir}/release.properties`;
if (fs.existsSync(key) && fs.existsSync(props)) {
  console.log('Chave de assinatura existente preservada.');
} else if (fs.existsSync(key) || fs.existsSync(props)) {
  throw new Error('Assinatura incompleta: restaure a chave e suas propriedades antes de compilar.');
} else {
  const password = crypto.randomBytes(32).toString('hex');
  execFileSync('keytool', ['-genkeypair', '-keystore', key, '-storetype', 'JKS', '-alias', 'meusgastos', '-keyalg', 'RSA', '-keysize', '2048', '-validity', '10000', '-dname', 'CN=Meus Gastos', '-storepass:env', 'MEUS_GASTOS_SIGNING_PASSWORD', '-keypass:env', 'MEUS_GASTOS_SIGNING_PASSWORD'], { env: { ...process.env, MEUS_GASTOS_SIGNING_PASSWORD: password }, stdio: 'pipe' });
  fs.writeFileSync(props, `storePassword=${password}\nkeyAlias=meusgastos\nkeyPassword=${password}\n`, { mode: 0o600 });
  fs.chmodSync(key, 0o600);
  console.log('Chave de assinatura criada localmente. Preserve .build-tools/signing para futuras atualizações.');
}
