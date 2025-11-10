const fs = require('fs');
const path = require('path');
const process = require('process');

const BACKUP_DIR = '_bkp';

if (process.argv.length <= 3) {
    console.error('usage: add-gallery-stages.js gallery-dir music-dir');
    process.exit(1);
  }
const [,, galleryDir, musicDir] = process.argv;

const backupPath = path.join(BACKUP_DIR, galleryDir, 'index.json');
const backupExists = fs.existsSync(backupPath);
console.log(backupExists ? ' * backup exists:' : ' * saving backup: ' + backupPath);
if (!backupExists) {
    fs.mkdirSync(path.dirname(backupPath), { recursive: true });
    fs.copyFileSync(path.join(galleryDir, 'index.json'), backupPath);
}

const musicStages = JSON.parse(fs.readFileSync(path.join(musicDir, 'stages.json')));
const gallery = JSON.parse(fs.readFileSync(path.join(galleryDir, 'index.json')));;
console.log({ gallery, musicStages });

const newGalleryMappings = musicStages.derivative.tracks.map(({ original, overrides}) => {
    const originalTrack = gallery[0].tracks.find(({ title }) => title === original.title);
    if (!originalTrack) throw new Error('original track not found title: ' + original.title);
    return {
        title: overrides.title ?? original.title,
        type: overrides.type,
        screenshots: originalTrack.screenshots,
    };
});
const oldTracks = gallery[0].tracks.filter(({ type }) => type !== 'stage');
console.log(newGalleryMappings);
console.log('current gallery mappings: ' + gallery[0].tracks.length);
console.log('old gallery mappings: ' + oldTracks.length);
console.log('new gallery mappings: ' + newGalleryMappings.length);

const newGallery = [{
    ...gallery[0], tracks: [...oldTracks, ...newGalleryMappings],
}];
const out = path.join(galleryDir, 'index.json');
fs.writeFileSync(out, JSON.stringify(newGallery, null, 4).replaceAll('\n', '\r\n'));
console.log('written to: ' + out);
