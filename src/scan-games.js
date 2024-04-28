const fs = require('fs');
const path = require('path');

if (process.argv.length <= 2) {
  console.error('usage: scan-games.js directory');
  process.exit(1);
}
const dir = process.argv[2];

const screenshots = JSON.parse(fs.readFileSync(path.join(dir, 'screenshots', 'index.json')));
const library = JSON.parse(fs.readFileSync(path.join(dir, 'music', 'index.json')));
const games = new Map();
library.forEach(entry => {
  const key = `${entry.platform}\t${entry.game}`;
  if (!games.has(key))
    games.set(key, []);
  games.get(key).unshift(entry);
});
const index = [...games.keys()].map(key => {
  const [platform, game] = key.split('\t');
  const year = games.get(key)[0].year;
  const artists = new Map();
  games.get(key).forEach(entry => {
    entry.artist.split(/,\s?/).forEach(artist => {
      artists.set(artist, true);
    });
  });
  const screenshotsUrl = screenshots.find(entry => entry.game === game)?.index;
  const thumbnailsUrl = screenshotsUrl && path.join('thumbs', screenshotsUrl, '..').replaceAll('\\', '/');
  return { platform, game, year, artists: [...artists.keys()], thumbnailsUrl };
});

const out = path.join(dir, 'index.json');
fs.writeFileSync(out, JSON.stringify(index, null, 2));
console.log(`games index written to: ${out}`);
console.log(`games: ${index.length}`);
