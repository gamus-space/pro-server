const fs = require('fs');
const path = require('path');
const { tree } = require('./lib');

if (process.argv.length <= 2) {
  console.error('usage: scan-screenshots.js directory');
  process.exit(1);
}
const dir = process.argv[2];

const index = tree(dir).filter(path => path.endsWith('/index.json')).flatMap(index => {
  const data = JSON.parse(fs.readFileSync(path.join(dir, index)));
  const games = data.map(({ game }) => game);
  return games.map(game => ({ game, index }));
});
const out = path.join(dir, 'index.json');
fs.writeFileSync(out, JSON.stringify(index, null, 2));
console.log(`screenshot index written to: ${out}`);
console.log(`games: ${index.length}`);
