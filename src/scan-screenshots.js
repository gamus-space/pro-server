const fs = require('fs');
const path = require('path');
const { groupBy, tree } = require('./lib');

if (process.argv.length <= 2) {
  console.error('usage: scan-screenshots.js directory');
  process.exit(1);
}
const dir = process.argv[2];

const musicDb = JSON.parse(fs.readFileSync(path.join(dir, '..', 'music', 'all.json')));
const musicIndex = JSON.parse(fs.readFileSync(path.join(dir, '..', 'music', 'index.json')));

const index = Object.fromEntries(Object.entries(groupBy(
  tree(dir).filter(path => path.endsWith('/index.json')).flatMap(file => {
    const data = JSON.parse(fs.readFileSync(path.join(dir, file)));
    if (!Array.isArray(data)) return [];
    data.forEach(entry => {
      const libraryFiles = new Set(entry.library.map(({ url }) => url));
      const fsFiles = new Set(tree(path.dirname(path.join(dir, file))).filter(path => !path.endsWith('.json')));
      [...libraryFiles].filter(file => !fsFiles.has(file)).forEach(f => {
        console.error(` * (${file}) file not found in fs: ${f}`);
      });
      [...fsFiles].filter(file => !libraryFiles.has(file)).forEach(f => {
        console.error(` * (${file}) file not found in index: ${f}`);
      });

      const TYPES = ['soundtrack', 'stage'];
      entry.tracks?.filter(({ type }) => !TYPES.includes(type)).forEach(({ title }) => {
        console.warn(`${file}: track has missing/invalid type: ${title}`);
      })
      if (!entry.tracks) {
        console.warn(`${file}: gallery has no tracks`);
      } else {
        const galleryMusicTracks = entry.tracks?.filter(({ type }) => type === 'soundtrack').map(({ title }) => title);
        const musicTracks = musicDb.filter(({ platform, game }) => platform === entry.platform && game === entry.game).toSorted((t, u) => parseInt(t.ordinal) - parseInt(u.ordinal)).map(({ title }) => title);
        if (JSON.stringify(galleryMusicTracks) !== JSON.stringify(musicTracks)) {
          console.warn(`${file}: inconsistent track list type: soundtrack`);
        }
        const galleryStageTracks = entry.tracks?.filter(({ type }) => type === 'stage').map(({ title }) => title);
        const musicStageTracks = !musicIndex[entry.platform][entry.game].stages ? [] :
          JSON.parse(fs.readFileSync(path.join(dir, '..', 'music', musicIndex[entry.platform][entry.game].stages))).derivative.tracks.map(({ original, overrides }) => overrides.title ?? original.title);
        if (JSON.stringify(galleryStageTracks) !== JSON.stringify(musicStageTracks)) {
          console.warn(`${file}: inconsistent track list type: stage`);
        }
      }
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
