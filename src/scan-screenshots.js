const fs = require('fs');
const path = require('path');
const { groupBy, tree } = require('./lib');

if (process.argv.length <= 2) {
  console.error('usage: scan-screenshots.js directory');
  process.exit(1);
}
const dir = process.argv[2];

const gameIndex = JSON.parse(fs.readFileSync(path.join(dir, 'index.json')));
tree(dir).filter(path => path.endsWith('/derivative.json')).flatMap(file => {
  const derivative = JSON.parse(fs.readFileSync(path.join(dir, file)));
  const processors = {
    library: (library, derivative) => {
      const derivatives = Array.isArray(derivative) ? derivative : [derivative];
      return [...library, ...derivatives.flatMap(({ original, select }) => {
        if (!select.library) return [];
        const base = gameIndex[original.platform]?.[original.game];
        if (!base) {
          console.error(`derivative ${file} base not found: ${JSON.stringify(original)}`);
          return [];
        }
        const baseScreenshots = JSON.parse(fs.readFileSync(path.join(dir, base)));
        return baseScreenshots[0].library.map(({ url, title, group, groupTitle, ...others }) => ({
          url: `${select.library.urlPrefix ?? ''}${url}`,
          title: `${select.library.titlePrefix ?? ''}${title}`,
          group: group && `${select.library.urlPrefix ?? ''}${group}`,
          groupTitle: groupTitle && `${select.library.titlePrefix ?? ''}${groupTitle}`,
          ...others,
        }));
      })];
    },
    tracks: (tracks, derivative) => {
      const derivatives = Array.isArray(derivative) ? derivative : [derivative];
      const flatTracks = [...tracks, ...derivatives.flatMap(({ original, select }) => {
        if (!select.tracks) return [];
        const base = gameIndex[original.platform]?.[original.game];
        if (!base) {
          console.error(`derivative ${file} base not found: ${JSON.stringify(original)}`);
          return [];
        }
        const baseScreenshots = JSON.parse(fs.readFileSync(path.join(dir, base)));
        return baseScreenshots[0].tracks.map(({ title, type, screenshots, ...others }) => ({
          title: type === 'group' ? `${select.tracks.groupPrefix ?? ''}${title}` : select.tracks.titleMapping?.[title] ?? title,
          type,
          screenshots: screenshots?.map(url =>
            typeof url === 'string' ? `${select.tracks.urlPrefix ?? ''}${url}` :
            url.groupRef ? { ...url, groupRef: `${select.tracks.groupPrefix ?? ''}${url.groupRef}` } :
            url
          ),
          ...others,
        }));
      })];
      const groupedTracks = Object.values(
        groupBy(flatTracks, ({ type, title }) => `${type}/${title}`)
      ).map(items => ({
        ...items[0],
        screenshots: items.every(({ screenshots }) => !screenshots) ? undefined :
          items.flatMap(({ screenshots }) => screenshots ?? []),
      }));
      return groupedTracks;
    },
  };
  const result = [Object.fromEntries(Object.entries(derivative.specifics).map(([key, value]) => {
    return [key, processors[key]?.(value, derivative.derivative) ?? value];
  }))];
  const resultPath = path.join(dir, file, '..', 'index.json');
  let oldContents;
  try {
    oldContents = fs.readFileSync(resultPath, 'utf-8');
  } catch {}
  const newContents = JSON.stringify(result, null, 2);
  if (oldContents === newContents) return;

  fs.writeFileSync(resultPath, newContents);
  console.log(`derivative written: ${resultPath}`);
});

const musicDb = JSON.parse(fs.readFileSync(path.join(dir, '..', 'music', 'all.json')));
const musicIndex = JSON.parse(fs.readFileSync(path.join(dir, '..', 'music', 'index.json')));

const index = Object.fromEntries(Object.entries(groupBy(
  tree(dir).filter(path => path.endsWith('/index.json')).flatMap(file => {
    const data = JSON.parse(fs.readFileSync(path.join(dir, file)));
    if (!Array.isArray(data)) return [];
    data.forEach(entry => {
      const isDerivative = !entry.resolution;
      const libraryFiles = new Set([
        ...entry.screenshots, ...entry.demoScreenshots,
        ...entry.library.map(({ url }) => url)]
      );
      const fsFiles = new Set(tree(path.dirname(path.join(dir, file))).filter(path => !path.endsWith('.json')));
      [...libraryFiles].filter(file => !fsFiles.has(file)).forEach(f => {
        if (isDerivative && f.startsWith('../')) return;
        console.error(` * (${file}) file not found in fs: ${f}`);
      });
      [...fsFiles].filter(file => !libraryFiles.has(file)).forEach(f => {
        console.error(` * (${file}) file not found in index: ${f}`);
      });

      const TYPES = ['soundtrack', 'stage', 'group'];
      entry.tracks?.filter(({ type }) => !TYPES.includes(type)).forEach(({ title }) => {
        console.warn(`${file}: track has missing/invalid type: ${title}`);
      })
      if (!entry.tracks) {
        console.warn(`${file}: gallery has no tracks`);
      } else if (!isDerivative) {
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
