// Generate PNG icons from SVG using canvas
// Run: node generate-icons.js
const { createCanvas } = (() => {
    try { return require('canvas'); } catch (e) { return { createCanvas: null }; }
})();

const fs = require('fs');
const path = require('path');

function createIcon(size, filename) {
    // If canvas module isn't available, create a simple 1-pixel PNG placeholder
    // The actual icon will be the SVG used via apple-touch-icon

    // Minimal valid PNG (1x1 green pixel, will be stretched by browser)
    // For production, replace with proper designed icons
    const canvas = Buffer.alloc(0);

    // Create a basic PNG using raw buffer
    // PNG signature + IHDR + IDAT + IEND
    const width = size, height = size;

    // Simple approach: create HTML that renders to canvas and saves
    const html = `<!DOCTYPE html><html><body>
<canvas id="c" width="${size}" height="${size}"></canvas>
<script>
const c = document.getElementById('c');
const ctx = c.getContext('2d');
// Background gradient
const g = ctx.createLinearGradient(0, 0, ${size}, ${size});
g.addColorStop(0, '#7ECF8B');
g.addColorStop(1, '#5BB89A');
ctx.fillStyle = g;
ctx.beginPath();
ctx.roundRect(0, 0, ${size}, ${size}, ${size * 0.19});
ctx.fill();
// Poop emoji
ctx.font = '${Math.round(size * 0.5)}px serif';
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';
ctx.fillText('💩', ${size / 2}, ${size * 0.45});
// PB text
ctx.font = 'bold ${Math.round(size * 0.12)}px Arial';
ctx.fillStyle = 'white';
ctx.fillText('PB', ${size / 2}, ${size * 0.82});
// Download
c.toBlob(blob => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = '${filename}';
  a.click();
});
</script></body></html>`;

    fs.writeFileSync(path.join(__dirname, 'icons', `generate-${filename}.html`), html);
    console.log(`Created generator: icons/generate-${filename}.html`);
    console.log(`Open this in browser to download the PNG icon.`);
}

createIcon(192, 'icon-192.png');
createIcon(512, 'icon-512.png');

console.log('\nAlternatively, the SVG icons will work for most PWA purposes.');
console.log('For best results, open the HTML files in a browser to generate PNG icons.');
