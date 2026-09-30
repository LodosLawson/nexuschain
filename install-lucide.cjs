const https = require('https');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Download the tarball
const url = 'https://registry.npmjs.org/lucide-react/-/lucide-react-0.546.0.tgz';
const dest = path.join(__dirname, 'node_modules', 'lucide-react');

console.log('Downloading lucide-react@0.263.1...');

// Remove existing
if (fs.existsSync(dest)) {
  fs.rmSync(dest, { recursive: true, force: true });
  console.log('Removed old lucide-react');
}
fs.mkdirSync(dest, { recursive: true });

https.get(url, (res) => {
  if (res.statusCode === 302 || res.statusCode === 301) {
    // Follow redirect
    https.get(res.headers.location, handleResponse);
  } else {
    handleResponse(res);
  }
});

function handleResponse(res) {
  const chunks = [];
  res.on('data', (chunk) => chunks.push(chunk));
  res.on('end', () => {
    const buf = Buffer.concat(chunks);
    console.log('Downloaded', buf.length, 'bytes, extracting...');
    
    // Gunzip
    const gunzip = zlib.createGunzip();
    const { Readable } = require('stream');
    const readable = Readable.from(buf);
    
    // Manual tar extraction
    let pos = 0;
    const unzipped = zlib.gunzipSync(buf);
    extractTar(unzipped, dest);
    console.log('Done!');
  });
}

function extractTar(buffer, destDir) {
  let offset = 0;
  while (offset < buffer.length - 512) {
    const header = buffer.slice(offset, offset + 512);
    
    // Read filename (null-terminated)
    let nameEnd = 0;
    while (nameEnd < 100 && header[nameEnd] !== 0) nameEnd++;
    const name = header.slice(0, nameEnd).toString('utf8');
    
    if (!name) break;
    
    // Read size (octal)
    const sizeStr = header.slice(124, 136).toString('utf8').trim().replace(/\0/g, '');
    const size = parseInt(sizeStr, 8) || 0;
    
    // Type flag
    const typeflag = String.fromCharCode(header[156]);
    
    offset += 512;
    
    // Strip 'package/' prefix from name
    const strippedName = name.replace(/^package\//, '');
    const filePath = path.join(destDir, strippedName);
    
    if (typeflag === '0' || typeflag === '' || typeflag === '\0') {
      // Regular file
      const fileDir = path.dirname(filePath);
      if (!fs.existsSync(fileDir)) {
        fs.mkdirSync(fileDir, { recursive: true });
      }
      fs.writeFileSync(filePath, buffer.slice(offset, offset + size));
    } else if (typeflag === '5') {
      // Directory
      if (!fs.existsSync(filePath)) {
        fs.mkdirSync(filePath, { recursive: true });
      }
    }
    
    // Advance to next 512-byte block
    offset += Math.ceil(size / 512) * 512;
  }
  console.log('Extraction complete!');
}
