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
    const screenshotsPath = path.join(dir, 'screenshots', index);
    const screenshotsDef = JSON.parse(fs.readFileSync(screenshotsPath));
    const title = path.join(dir, 'screenshots', index, '..', screenshotsDef[0].screenshots[0]);
    const list = path.join(dir, 'thumbs', index, '..', 'list.webp');
    totalGames++;
    fs.mkdirSync(path.dirname(list), { recursive: true });
    if (!fs.existsSync(list) || fs.statSync(list).mtime < fs.statSync(screenshotsPath).mtime) {
      console.log(' * ' + game + ' [list]');
      updatedThumbs++;
      resize(title, '80x', list);
    }
  });
});
console.log(`total games: ${totalGames}`);
console.log(`updated thumbs: ${updatedThumbs}`);

let updatedCompilations = 0;
const compilationsIndexPath = path.join(dir, 'screenshots', 'compilations', 'index.json');
const compilationsIndex = JSON.parse(fs.readFileSync(compilationsIndexPath));
compilationsIndex.index.forEach(({ url }) => {
  const compilation = path.join(dir, 'screenshots', 'compilations', url);
  const thumb = path.join(dir, 'thumbs', 'compilations', url);
  if (!fs.existsSync(thumb) || fs.statSync(thumb).mtime < fs.statSync(compilationsIndexPath).mtime) {
    console.log(' * ' + url + ' [compilation]');
    updatedCompilations++;
    resize(compilation, '160x', thumb);
  }
});
const compilationsOutPath = path.join(dir, 'thumbs', 'compilations', 'index.json');
fs.writeFileSync(compilationsOutPath, JSON.stringify(compilationsIndex, null, 2));
console.log(`updated compilations: ${updatedCompilations}`);

function resize(inFile, sizeSpec, outFile) {
  child_process.execFileSync('node', [RESIZE_JS, sizeSpec, inFile, outFile]);
}
