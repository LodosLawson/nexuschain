const fs = require('fs');
const path = require('path');

const cacheDir = path.join(process.env.USERPROFILE, '.bun', 'install', 'cache');
const dirs = fs.readdirSync(cacheDir).filter(d => d.startsWith('lucide-react'));
console.log('Found:', dirs);

if (dirs.length === 0) {
  console.error('lucide-react not found in bun cache!');
  process.exit(1);
}

// Find the 0.263.1 version
const srcDir = dirs.find(d => d.includes('0.263.1')) || dirs[0];
const src = path.join(cacheDir, srcDir);
const dest = path.join(__dirname, 'node_modules', 'lucide-react');

console.log('Copying from:', src);
console.log('Copying to:', dest);

// Remove existing
if (fs.existsSync(dest)) {
  fs.rmSync(dest, { recursive: true, force: true });
}

// Copy recursively
function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

copyDir(src, dest);
console.log('Done! lucide-react copied successfully.');
