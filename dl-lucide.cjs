const https = require('https');
const fs = require('fs');

const file = fs.createWriteStream('lucide.tgz');
https.get('https://registry.npmjs.org/lucide-react/-/lucide-react-0.263.1.tgz', (res) => {
  res.pipe(file);
  file.on('finish', () => {
    file.close();
    console.log('DOWNLOADED');
  });
});
