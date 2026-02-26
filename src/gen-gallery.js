const fs = require('fs');
const path = require('path');
const process = require('process');
const { flacHeaders, groupBy, matches, tree } = require('./lib');

if (process.argv.length <= 3) {
    console.error('usage: gen-gallery.js gallery-dir music-dir [stage-screenshots-prefix ...]');
    process.exit(1);
  }
const [,, galleryDir, musicDir, ...stagePrefixes] = process.argv;

const music = tree(musicDir)
  .filter(file => file.endsWith('.flac'))
  .map(file => {
    const content = fs.readFileSync(path.resolve(musicDir, file));
    const headers = flacHeaders(content);
    return { no: parseInt(headers.metadata.Ordinal), title: headers.metadata.TITLE, tracknumber: parseInt(headers.metadata.TRACKNUMBER) };
  })
  .sort((a, b) => a.no - b.no);
const gallery = tree(galleryDir)
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
const stagesFile = path.join(musicDir, 'stages.json');
const stages = fs.existsSync(stagesFile) ? JSON.parse(fs.readFileSync(stagesFile)) : undefined;
console.log({ gallery, music, stages });
if (!!stages ^ (stagePrefixes.length > 0))
  throw new Error('has stages.json but prefixes argument missing (or opposite)');
if (stages && stages?.derivative?.tracks?.length !== stagePrefixes.length)
  throw new Error(`expected ${stages?.derivative?.tracks?.length} prefixes but got ${stagePrefixes.length}`);

const stagesTracks = !stages ? [] : stages.derivative.tracks.map(({ original, overrides }, i) => {
  const screenshots = gallery.filter(url => url.startsWith(stagePrefixes[i]));
  if (screenshots.length === 0)
    throw new Error(`screenshots not found for prefix: ${stagePrefixes[i]}`);
  return {
    title: overrides.title ?? original.title,
    type: 'stage',
    screenshots,
  };
});
const stagesGroups = !stages ? {} : groupBy(stages.derivative.tracks, ({ original }) => JSON.stringify(original));
const musicTracks = music.map(track => {
  const group = Object.values(stagesGroups).find(group => matches(track, group[0].original));
  const titles = group?.map(({ original, overrides }) => overrides.title ?? original.title);
  const screenshots = titles?.flatMap(title => stagesTracks.find(stage => stage.title === title).screenshots) ?? [];
  return { title: track.title, type: 'soundtrack', screenshots };
});

const stub = [{
    platform: '',
    game: '',
    screenshots: [],
    demoScreenshots: [],
    tracks: [...musicTracks, ...stagesTracks],
    library: gallery.map(url => ({ url, title: '' })),
}];
const out = path.join(galleryDir, 'index.json');
fs.writeFileSync(out, JSON.stringify(stub, null, 4));
console.log('written to: ' + out);
