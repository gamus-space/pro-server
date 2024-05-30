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
let totalGames = 0;
let updatedThumbs = 0;
Object.entries(screenshots).forEach(([platform, games]) => {
  Object.entries(games).forEach(([game, index]) => {
    const screenshotsDef = JSON.parse(fs.readFileSync(path.join(dir, 'screenshots', index)));
    const title = path.join(dir, 'screenshots', index, '..', screenshotsDef[0].screenshots[0]);
    const list = path.join(dir, 'thumbs', index, '..', 'list.webp');
    totalGames++;
    fs.mkdirSync(path.dirname(list), { recursive: true });
    if (!fs.existsSync(list) || fs.statSync(list).mtime < fs.statSync(path.join(dir, 'screenshots', index)).mtime) {
      console.log(' * ' + game + ' [list]');
      updatedThumbs++;
      resize(title, '80x', list);
    }
  });
});
console.log(`total games: ${totalGames}`);
console.log(`updated thumbs: ${updatedThumbs}`);

function resize(inFile, sizeSpec, outFile) {
  child_process.execFileSync('node', [RESIZE_JS, sizeSpec, inFile, outFile]);
}
