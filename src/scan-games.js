const fs = require('fs');
const path = require('path');
const { gameCompare } = require('./lib');

if (process.argv.length <= 2) {
  console.error('usage: scan-games.js directory');
  process.exit(1);
}
const dir = process.argv[2];

const screenshots = JSON.parse(fs.readFileSync(path.join(dir, 'screenshots', 'index.json')));
const text = JSON.parse(fs.readFileSync(path.join(dir, 'text', 'index.json')));
const library = JSON.parse(fs.readFileSync(path.join(dir, 'music', 'all.json')));
const games = new Map();
library.forEach(entry => {
  const key = `${entry.platform}\t${entry.game}`;
  if (!games.has(key))
    games.set(key, []);
  games.get(key).unshift(entry);
});
const index = [...games.keys()].sort((a, b) => gameCompare(a, b)).map(key => {
  const [platform, game] = key.split('\t');
  const year = games.get(key)[0].year;
  const artists = new Map();
  games.get(key).forEach(entry => {
    entry.artist.split(/,\s?/).forEach(artist => {
      artists.set(artist, true);
    });
  });
  const screenshotsUrl = screenshots[platform]?.[game];
  const thumbnailsUrl = screenshotsUrl && path.join('thumbs', screenshotsUrl, '..').replaceAll('\\', '/');
  const textUrl = text[platform]?.[game];
  const textContents = textUrl && fs.readFileSync(path.join(dir, 'text', textUrl), 'utf-8');
  const dateAdded = /\r?\n\| \*Date added\* \| ([\d-]+) \|\r?\n/.exec(textContents)?.[1];
  const type = /\r?\n\| \*Type\* \| ([^|]+) \|\r?\n/.exec(textContents)?.[1];
  return { platform, game, year, type, artists: [...artists.keys()], thumbnailsUrl, dateAdded };
});

const out = path.join(dir, 'index.json');
fs.writeFileSync(out, JSON.stringify(index, null, 2));
console.log(`games index written to: ${out}`);

const stats = {
  music: JSON.parse(fs.readFileSync(path.join(dir, 'music', 'stats.json'))),
  screenshots: JSON.parse(fs.readFileSync(path.join(dir, 'screenshots', 'stats.json'))),
  text: JSON.parse(fs.readFileSync(path.join(dir, 'text', 'stats.json'))),
  games: { games: index.length },
  pad: 'x'.repeat(index.length % 33),
};
const statsPath = path.join(dir, 'stats.json');
fs.writeFileSync(statsPath, JSON.stringify(stats, null, 2));
console.log(`stats written to: ${statsPath}`);

console.log(`games: ${index.length}`);
