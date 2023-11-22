'use strict';

const fs = require('fs');
const path = require('path');
const process = require('process');
const { StringDecoder } = require('string_decoder');

if (process.argv.length <= 2) {
  console.error('usage: scan.js directory');
  process.exit(1);
}
const dir = process.argv[2];

function tree(root) {
  let queue = [''];
  let result = [];
  while (queue.length > 0) {
    const dir = queue.shift();
    fs.readdirSync(`${root}/${dir}`).forEach(entry => {
      const entryPath = `${dir === '' ? '' : dir + '/'}${entry}`;
      const stat = fs.statSync(`${root}/${entryPath}`);
      if (stat.isDirectory())
        queue.push(entryPath);
      else
        result.push(entryPath);
    });
  }
  return result;
}

function getMultiByte(data, pos, n) {
  let res = 0;
  while (n-- > 0) {
    res <<= 8;
    res |= data.getUint8(pos++);
  }
  return res;
}

const utf8Decoder = new StringDecoder('utf8');

function getString(data, pos, n) {
  return utf8Decoder.write(new DataView(data.buffer.slice(pos, pos+n)));
}

function flacHeaders(content) {
  const data = new DataView(content.buffer.slice(content.byteOffset, content.byteOffset + content.byteLength));
  let pos = 0;
  const sig = data.getUint32(pos); pos += 4;
  if (sig !== 0x664c6143) throw new Error('invalid signature');
  let type;
  const headers = {};
  do {
    type = data.getUint8(pos); pos += 1;
    const length = getMultiByte(data, pos, 3); pos += 3;
    const next = pos + length;
    switch (type & 0x7f) {
    case 0:
      pos += 10;
      headers.sampleRate = getMultiByte(data, pos, 3) >> 4; pos += 3;
      headers.sampleCount = getMultiByte(data, pos, 5) & 0x0fffffffff; pos += 5;
      break;
    case 4:
      const toolLength = data.getUint32(pos, true); pos += 4;
      headers.tool = getString(data, pos, toolLength); pos += toolLength;
      const metaCount = data.getUint32(pos, true); pos += 4;
      const metadata = {};
      for (let i = 0; i < metaCount; i++) {
        const metaLength = data.getUint32(pos, true); pos += 4;
        const line = getString(data, pos, metaLength); pos += metaLength;
        const equ = line.indexOf('=');
        if (equ < 0)
          metadata[line] = true;
        else
          metadata[line.slice(0, equ)] = line.slice(equ+1);
      }
      headers.metadata = metadata;
      break;
    default:
    }
    pos = next;
  } while ((type & 0x80) === 0)
  return headers;
}

function flacGainValue(gainStr) {
  const str = /^([+-]?\d+(\.\d+)?)( db)?/i.exec(gainStr)?.[1];
  return str && Number(str);
}

const originalDb = tree(dir)
  .filter(file => file.endsWith('.flac'))
  .map(file => {
    const content = fs.readFileSync(path.resolve(dir, file));
    const headers = flacHeaders(content);
    const time = Math.round(headers.sampleCount / headers.sampleRate * 100) / 100;
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
      time,
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
