const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const outDir = path.join(__dirname, '../public/icons');
const pngLogo = path.join(__dirname, '../public/grupo_petropolis_logo.png');
const svgLogo = path.join(__dirname, '../public/logo-gp.svg');

const source = fs.existsSync(pngLogo) ? pngLogo : svgLogo;
console.log(`Usando fonte: ${path.basename(source)}`);

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

(async () => {
  for (const size of sizes) {
    const outPath = path.join(outDir, `icon-${size}x${size}.png`);
    await sharp(source)
      .resize(size, size, {
        fit: 'contain',
        background: { r: 204, g: 0, b: 0, alpha: 1 }
      })
      .png()
      .toFile(outPath);
    console.log(`✓ icon-${size}x${size}.png`);
  }
  console.log('\nTodos os ícones gerados em public/icons/');
})();
