const { createHash } = require('node:crypto');
const { readFileSync, writeFileSync } = require('node:fs');
const { resolve } = require('node:path');

const root = resolve(__dirname, '..');
const files = ['index.html', 'manifest.webmanifest', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png', 'sw.js'];
const versionPattern = /const VERSION = '[^']+';/;

function releaseVersion() {
  const hash = createHash('sha256');
  for (const file of files) {
    let content = readFileSync(resolve(root, file));
    if (!file.endsWith('.png')) {
      content = content.toString('utf8').replace(/\r\n/g, '\n');
      if (file === 'sw.js') content = content.replace(versionPattern, "const VERSION = 'RELEASE';");
    }
    hash.update(file + '\0');
    hash.update(content);
  }
  return hash.digest('hex').slice(0, 16);
}

if (require.main === module) {
  const file = resolve(root, 'sw.js');
  const source = readFileSync(file, 'utf8');
  writeFileSync(file, source.replace(versionPattern, `const VERSION = '${releaseVersion()}';`));
  console.log('Offline release fingerprint updated.');
}

module.exports = { releaseVersion, files };
