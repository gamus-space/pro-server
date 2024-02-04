'use strict';

const fs = require('fs');
const path = require('path');
const process = require('process');
const { flacGainValue, flacHeaders, tree } = require('./lib');

if (process.argv.length <= 2) {
  console.error('usage: scan.js directory');
  process.exit(1);
}
const dir = process.argv[2];

const originalDb = tree(dir)
  .filter(file => file.endsWith('.flac'))
  .map(file => {
    const content = fs.readFileSync(path.resolve(dir, file));
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
    return {
      files: [
        {
          url: file,
          size,
        },
        ...altSize ? [{
          url: altFile,
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
    };
  });

const derivativeDb = tree(dir)
  .filter(file => file.endsWith('.json') && file !== 'index.json')
  .flatMap(file => {
    const { derivative } = JSON.parse(fs.readFileSync(path.resolve(dir, file), 'utf-8'));
    if (!derivative) return;
    return derivative.tracks.flatMap(track => {
      const criteria = { ...derivative.original, ...track.original };
      const overrides = { ...derivative.overrides, ...track.overrides };
      return originalDb
        .filter(track => Object.entries(criteria).every(([key, value]) => track[key] === value))
        .flatMap(track => ({ ...track, ...overrides }));
    });
  });

const db = [...originalDb, ...derivativeDb]
  .sort((a, b) => `${a.game}\t${a.ordinal}`.localeCompare(`${b.game}\t${b.ordinal}`, undefined, { numeric: true }));
console.log(JSON.stringify(db, null, 2));
