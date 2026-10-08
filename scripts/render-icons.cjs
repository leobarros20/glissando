const { readFileSync, mkdirSync, writeFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { chromium } = require('playwright');

(async () => {
  const root = resolve(__dirname, '..');
  const browser = await chromium.launch({ headless: true, ...(process.env.GLISSANDO_BROWSER ? { executablePath: process.env.GLISSANDO_BROWSER } : {}) });
  try {
    const page = await browser.newPage();
    const source = readFileSync(resolve(root, 'index.html'), 'utf8');
    mkdirSync(resolve(root, 'icons'), { recursive: true });
    for (const size of [180, 192, 512]) {
      const png = await page.evaluate(async ({ source, size }) => {
        const doc = new DOMParser().parseFromString(source, 'text/html');
        const logo = new Image();
        logo.src = doc.querySelector('link[rel="icon"]').getAttribute('href');
        await logo.decode();
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        canvas.getContext('2d').drawImage(logo, 0, 0, size, size);
        return canvas.toDataURL('image/png').split(',')[1];
      }, { source, size });
      writeFileSync(resolve(root, `icons/icon-${size}.png`), Buffer.from(png, 'base64'));
    }
    console.log('Rendered home-screen icons from the existing Glissando logo.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
