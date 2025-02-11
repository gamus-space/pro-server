'use strict';

const fs = require('fs');
const path = require('path');
const { StringDecoder } = require('string_decoder');

exports.tree = function tree(root) {
  let queue = [''];
  let result = [];
  while (queue.length > 0) {
    const dir = queue.shift();
    fs.readdirSync(path.join(root, dir)).forEach(entry => {
    const entryPath = `${dir === '' ? '' : dir + '/'}${entry}`;
    const stat = fs.statSync(path.join(root, entryPath));
    if (stat.isDirectory())
      queue.push(entryPath);
    else
      result.push(entryPath);
    });
  }
  return result;
}

exports.groupBy = function groupBy(data, f) {
  const o = {};
  data.forEach(d => {
    const key = f(d);
    o[key] = [...o[key] ?? [], d];
  });
  return o;
}

const utf8Decoder = new StringDecoder('utf8');

function getString(data, pos, n) {
  return utf8Decoder.write(new DataView(data.buffer.slice(pos, pos+n)));
}

function getMultiByte(data, pos, n) {
  let res = 0;
  while (n-- > 0) {
    res <<= 8;
    res |= data.getUint8(pos++);
  }
  return res;
}

exports.flacHeaders = function flacHeaders(content) {
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

exports.flacGainValue = function flacGainValue(gainStr) {
  const str = /^([+-]?\d+(\.\d+)?)( db)?/i.exec(gainStr)?.[1];
  return str && Number(str);
}

exports.time = function time(t) {
  t = Math.floor(t)
  const sec = t % 60;
  const minHr = Math.floor(t/60);
  const min = minHr % 60;
  const hr = Math.floor(minHr / 60);
  return `${hr === 0 ? '' : hr + ':'}${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

const gameSort = game => game.replaceAll(/:/g, '\t');
exports.gameCompare = (a, b) => `${gameSort(a)}`.localeCompare(`${gameSort(b)}`, undefined, { numeric: true });
