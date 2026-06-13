const fs = require('fs');
const path = require('path');
const { tree } = require('./lib');

if (process.argv.length <= 2) {
  console.error('usage: count-gallery-dups.js directory');
  process.exit(1);
}
const dir = process.argv[2];

results = tree(dir).filter(path => path.endsWith('/index.json')).map(file => {
  const index = JSON.parse(fs.readFileSync(path.join(dir, file)));
  if (index.index) return { file, count: 0 };
  const fileCount = {};
  index[0].tracks?.forEach(track => {
    track.screenshots?.filter(screenshot => typeof screenshot === 'string').forEach(screenshot => {
      fileCount[screenshot] ??= 0;
      fileCount[screenshot] += 1;
    });
  });
  const count = Object.entries(fileCount).map(([file, cnt]) => cnt - 1).reduce((a, e) => a+e, 0);
  return { file, count };
});
console.log(results.sort((a, b) => b.count - a.count));
