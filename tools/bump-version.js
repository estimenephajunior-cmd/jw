const fs = require('fs');

function bumpPatch(version) {
  const [major = '0', minor = '0', patch = '0'] = String(version).split('.');
  return `${major}.${minor}.${Number(patch) + 1}`;
}

function updateJson(path, updater) {
  const json = JSON.parse(fs.readFileSync(path, 'utf8'));
  updater(json);
  fs.writeFileSync(path, `${JSON.stringify(json, null, 2)}\n`);
}

let nextVersion = '';

updateJson('package.json', (pkg) => {
  nextVersion = bumpPatch(pkg.version);
  pkg.version = nextVersion;
});

updateJson('app.json', (app) => {
  if (app.expo) app.expo.version = nextVersion;
});

const settingsPath = 'app/(tabs)/settings.tsx';
if (fs.existsSync(settingsPath)) {
  const text = fs.readFileSync(settingsPath, 'utf8');
  fs.writeFileSync(
    settingsPath,
    text.replace(/(<SizableText size="\$4" color="#9CA3AF">)\d+\.\d+\.\d+(<\/SizableText>)/, `$1${nextVersion}$2`),
  );
}

console.log(`Version bumped to ${nextVersion}`);
