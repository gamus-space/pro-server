const fs = require('fs');
const path = require('path');
const process = require('process');
const { flacHeaders, tree } = require('./lib');

if (process.argv.length <= 3) {
    console.error('usage: gen-gallery.js gallery-dir music-dir');
    process.exit(1);
  }
const [,, galleryDir, musicDir] = process.argv;

const music = tree(musicDir)
  .filter(file => file.endsWith('.flac'))
  .map(file => {
    const content = fs.readFileSync(path.resolve(musicDir, file));
    const headers = flacHeaders(content);
    return { no: parseInt(headers.metadata.Ordinal), title: headers.metadata.TITLE };
  })
  .sort((a, b) => a.no - b.no);
const gallery = tree(galleryDir);
console.log({ gallery, music });

const stub = [{
    game: '',
    screenshots: [],
    demoScreenshots: [],
    tracks: music.map(({ title }) => ({ title, screenshots: [] })),
    library: gallery.map(url => ({ url, title: '' })),
}];
const out = path.join(galleryDir, 'index.json');
fs.writeFileSync(out, JSON.stringify(stub, null, 4));
console.log('written to: ' + out);
