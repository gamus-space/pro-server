const child_process = require('child_process');
const fs = require('fs');
const path = require('path');

if (process.argv.length <= 2) {
  console.error('usage: scan-thumbs.js directory');
  process.exit(1);
}
const dir = process.argv[2];
const RESIZE_JS = '../screen-grabber/scale.js';

const screenshots = JSON.parse(fs.readFileSync(path.join(dir, 'screenshots', 'index.json')));
screenshots.forEach(({ game, index }) => {
  const screenshotsDef = JSON.parse(fs.readFileSync(path.join(dir, 'screenshots', index)));
  const title = path.join(dir, 'screenshots', index, '..', screenshotsDef[0].screenshots[0]);
  const list = path.join(dir, 'thumbs', index, '..', 'list.webp');
  fs.mkdirSync(path.dirname(list), { recursive: true });
  console.log(' * ' + game);
  if (!fs.existsSync(list) || fs.statSync(list).mtime < fs.statSync(path.join(dir, 'screenshots', index)).mtime) {
    console.log('   + ' + 'list');
    resize(title, '80x', list);
  }
});

function resize(inFile, sizeSpec, outFile) {
  child_process.execFileSync('node', [RESIZE_JS, sizeSpec, inFile, outFile]);
}
