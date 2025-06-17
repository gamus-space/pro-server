'use strict';

const fs = require('fs');
const path = require('path');
const process = require('process');
const { flacGainValue, flacHeaders, gameCompare, groupBy, time, tree } = require('./lib');

if (process.argv.length <= 2) {
  console.error('usage: scan.js directory');
  process.exit(1);
}
const dir = process.argv[2];

function readFilePrefixSync(file, length) {
  const buf = Buffer.alloc(length);
  const fd = fs.openSync(file, 'r');
  fs.readSync(fd, buf, 0, length, 0);
  fs.closeSync(fd);
  return buf;
}

function calculateOriginalSize(headers) {
  if (headers.metadata?.['OriginalSize'])
    return headers.metadata?.['OriginalSize'];
  if (headers.metadata?.['DISCNUMBER'])
    return headers.sampleCount * 4;
  const format = /^WAV PCM (\d+)kHz (\d+)bit (mono|stereo)$/.exec(headers.metadata?.['OriginalFormat']);
  if (!format) {
    console.error(`cannot calculate original size, unknown format: ${headers.metadata?.['OriginalFormat']}`);
    return undefined;
  }
  const bps = { 8: 1, 16: 2 }[format[2]] * { mono: 1, stereo: 2 }[format[3]];
  if (isNaN(bps)) {
    console.error(`cannot calculate original size, invalid WAV PCM params: ${headers.metadata?.['OriginalFormat']}`);
    return undefined;
  }
  return 44 + headers.sampleCount * bps;
}

const originalDb = tree(dir)
  .filter(file => file.endsWith('.flac'))
  .map(file => {
    const content = readFilePrefixSync(path.resolve(dir, file), 4352);
    const headers = flacHeaders(content);
    const time = Math.round(headers.sampleCount / headers.sampleRate * 100) / 100;
    const durationMatch = headers.metadata?.['Duration']?.match(/^(\d+):(\d\d)$/);
    const duration = durationMatch && parseInt(durationMatch[1]) * 60 + parseInt(durationMatch[2]);
    const replayGain = {
      album: flacGainValue(headers.metadata?.['replaygain_album_gain']),
      track: flacGainValue(headers.metadata?.['replaygain_track_gain']),
    };
    const size = fs.statSync(path.resolve(dir, file)).size;
    const altFile = file.replace(/\.flac$/, '.mp3');
    const altSize = fs.existsSync(path.resolve(dir, altFile)) ? fs.statSync(path.resolve(dir, altFile)).size : undefined;
    if (!replayGain.album) console.warn(`replayGain missing: ${file}`);
    if (!altSize) console.warn(`mp3 missing: ${file}`);
    return {
      dir: path.dirname(file),
      files: [
        {
          url: path.basename(file),
          size,
        },
        ...altSize ? [{
          url: path.basename(altFile),
          size: altSize,
        }] : [],
      ],
      game: headers.metadata?.['ALBUM'],
      title: headers.metadata?.['TITLE'],
      artist: headers.metadata?.['ARTIST'],
      tracknumber: headers.metadata?.['TRACKNUMBER'],
      tracktotal: headers.metadata?.['TRACKTOTAL'],
      time: duration ?? time,
      originalTime: duration ? time : undefined,
      replayGain,
      platform: headers.metadata?.['Platform'],
      year: headers.metadata?.['DATE'],
      kind: headers.metadata?.['Kind'],
      ordinal: headers.metadata?.['Ordinal'],
      subtitle: headers.metadata?.['Subtitle'],
      originalSize: calculateOriginalSize(headers),
    };
  });

const derivativeDb = tree(dir)
  .filter(file => path.basename(file) === 'derivative.json')
  .flatMap(file => {
    const { derivative } = JSON.parse(fs.readFileSync(path.resolve(dir, file), 'utf-8'));
    if (!derivative) return;
    return derivative.tracks.flatMap(track => {
      const criteria = { ...derivative.original, ...track.original };
      const overrides = { ...derivative.overrides, ...track.overrides };
      return originalDb
        .filter(track => Object.entries(criteria).every(([key, value]) => track[key] === value))
        .flatMap(track => ({
          ...track,
          ...overrides,
          dir: path.dirname(file),
          files: track.files.map(trackFile => ({
            ...trackFile,
            url: path.join(path.relative(path.dirname(file), track.dir), trackFile.url).replaceAll('\\', '/'),
          })),
        }));
    });
  });

const allDb = [...originalDb, ...derivativeDb];
const hierarchicalDb = groupBy(allDb, ({ dir }) => dir);
for (let gameDir in hierarchicalDb) {
  const gameIndex = hierarchicalDb[gameDir].sort((a, b) => `${a.ordinal}`.localeCompare(`${b.ordinal}`, undefined, { numeric: true }));
  fs.writeFileSync(path.join(dir, gameDir, 'index.json'), JSON.stringify(gameIndex, null, 2));
}

const gameIndex = Object.fromEntries(Object.entries(groupBy(
  (Object.keys(hierarchicalDb).map(gameDir => {
    const { game, platform } = hierarchicalDb[gameDir][0];
    return { platform, game, file: `${gameDir}/index.json` };
  }).sort((a, b) => gameCompare(a.game, b.game))),
  ({ platform }) => platform
)).map(([platform, entries]) => [platform, Object.fromEntries(entries.map(({ game, file }) => [game, file]))]));
const gameIndexOut = path.join(dir, 'index.json');
fs.writeFileSync(gameIndexOut, JSON.stringify(gameIndex, null, 2));
console.log(`game index written to: ${gameIndexOut}`);

const index = allDb.sort((a, b) => `${a.game}\t${a.ordinal}`.localeCompare(`${b.game}\t${b.ordinal}`, undefined, { numeric: true }));
const out = path.join(dir, 'all.json');
fs.writeFileSync(out, JSON.stringify(index, null, 2));
console.log(`music index written to: ${out}`);

const stats = {
  tracks: allDb.length,
  seconds: Math.floor(allDb.reduce((sum, { time }) => sum + time, 0)),
  bytes: allDb.reduce((sum, { files }) => sum + files.reduce((bytes, file) => bytes + file.size, 0), 0),
};
const statsPath = path.join(dir, 'stats.json');
fs.writeFileSync(statsPath, JSON.stringify(stats, null, 2));
console.log(`stats written to: ${statsPath}`);

console.log('\n * stats');
console.log(`games: ${Object.entries(gameIndex).reduce((sum, [, games]) => sum + Object.entries(games).length, 0)}`);
console.log(`tracks: ${index.length}`);
console.log(`length: ${time(index.reduce((res, { time }) => res+time, 0))}`);
