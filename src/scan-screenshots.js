const fs = require('fs');
const path = require('path');
const { groupBy, tree } = require('./lib');

if (process.argv.length <= 2) {
  console.error('usage: scan-screenshots.js directory');
  process.exit(1);
}
const dir = process.argv[2];

const index = Object.fromEntries(Object.entries(groupBy(
  tree(dir).filter(path => path.endsWith('/index.json')).flatMap(file => {
    const data = JSON.parse(fs.readFileSync(path.join(dir, file)));
    data.forEach(entry => {
      const libraryFiles = new Set(entry.library.map(({ url }) => url));
      const fsFiles = new Set(tree(path.dirname(path.join(dir, file))).filter(path => !path.endsWith('.json')));
      [...libraryFiles].filter(file => !fsFiles.has(file)).forEach(f => {
        console.error(` * (${file}) file not found in fs: ${f}`);
      });
      [...fsFiles].filter(file => !libraryFiles.has(file)).forEach(f => {
        console.error(` * (${file}) file not found in index: ${f}`);
      });
    });
    return data.map(({ platform, game }) => ({ platform, game, file }));
  }),
  (({ platform }) => platform),
)).map(([ platform, games ]) => [platform, Object.fromEntries(games.map(({ game, file }) => [game, file]))]));

const out = path.join(dir, 'index.json');
fs.writeFileSync(out, JSON.stringify(index, null, 2));
console.log(`screenshot index written to: ${out}`);

const stats = Object.entries(index).flatMap(([platform, games]) => Object.entries(games).flatMap(([game, index]) => ({ platform, game, index }))).map(({ index }) => {
  const fsFiles = tree(path.dirname(path.join(dir, index))).filter(path => !path.endsWith('.json'));
  return {
    screenshots: fsFiles.length,
    bytes: fsFiles.map(file => fs.statSync(path.join(dir, path.dirname(index), file)).size).reduce((sum, size) => sum + size, 0),
  };
}).reduce((sum, game) => ({
  screenshots: sum.screenshots + game.screenshots,
  bytes: sum.bytes + game.bytes,
}));
const statsPath = path.join(dir, 'stats.json');
fs.writeFileSync(statsPath, JSON.stringify(stats, null, 2));
console.log(`stats written to: ${statsPath}`);

console.log(`games: ${Object.entries(index).reduce((sum, [, games]) => sum + Object.entries(games).length, 0)}`);
