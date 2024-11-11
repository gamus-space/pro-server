const fs = require('fs');
const path = require('path');
const { groupBy, tree } = require('./lib');

if (process.argv.length <= 2) {
  console.error('usage: scan-text.js directory');
  process.exit(1);
}
const dir = process.argv[2];

HEADER_ORDER = {
  Platform: true,
  Year: true,
  Developer: true,
  Publisher: true,
  'Ported from': false,
  System: false,
  'Date added': true,
};

SECTION_ORDER = {
  About: true,
  Music: true,
  Graphics: true,
  'Version specifics': false,
  Others: false,
  Links: true,
};

function validateOrder(label, data, order) {
  Object.entries(order).forEach(([value, required]) => {
    d = data[0];
    if (d === value)
      data.shift();
    else if (required)
      console.error(`[${label}] missing: ${value}`);
  });
  if (data.length > 0)
    console.error(`[${label}] excessive: ${data.join(', ')}`);
}

const index = Object.fromEntries(Object.entries(groupBy(
  tree(dir).filter(file => file.endsWith('/index.md')).map(file => {
    const contents = fs.readFileSync(path.join(dir, file), 'utf-8');
    const game = contents.match(/^\# ([^\r\n]+)\r?\n/)[1];
    const sections = [...contents.matchAll(/\n\#\# ([^\r\n]+)\r?\n/g)].map(m => m[1]);
    validateOrder(`SECTIONS @ ${game}`, sections, SECTION_ORDER);
    const headers = [...contents.matchAll(/\n\| \*([\w ]+)\* \| ([^\|]+) \|/g)].map(m => m.slice(1, 3));
    validateOrder(`HEADERS @ ${game}`, headers.map(([key]) => key), HEADER_ORDER);
    const platform = headers.find(([key]) => key === 'Platform')?.[1];
    return { platform, game, file };
  }),
  (({ platform }) => platform),
)).map(([ platform, games ]) => [platform, Object.fromEntries(games.map(({ game, file }) => [game, file]))]));

const out = path.join(dir, 'index.json');
fs.writeFileSync(out, JSON.stringify(index, null, 2));
console.log(`text index written to: ${out}`);

const stats = Object.entries(index).flatMap(([platform, games]) => Object.entries(games).flatMap(([game, index]) => ({ platform, game, index }))).map(({ index }) => {
  const size = fs.statSync(path.join(dir, index)).size;
  return { articles: 1, bytes: size };
}).reduce((sum, game) => ({
  articles: sum.articles + game.articles,
  bytes: sum.bytes + game.bytes,
}));
const statsPath = path.join(dir, 'stats.json');
fs.writeFileSync(statsPath, JSON.stringify(stats, null, 2));
console.log(`stats written to: ${statsPath}`);

console.log(`games: ${Object.entries(index).reduce((sum, [, games]) => sum + Object.entries(games).length, 0)}`);
