const esbuild = require('esbuild');
// update manifest.json to include version number from package.json
const fs = require('fs');
const packageJson = JSON.parse(fs.readFileSync('./package.json'));
const manifestJson = JSON.parse(fs.readFileSync('./manifest.json'));
manifestJson.version = packageJson.version;
fs.writeFileSync('./dist/manifest.json', JSON.stringify(manifestJson, null, 2));

esbuild.build({
  entryPoints: ['src/index.js'],
  outfile: 'dist/main.js',
  bundle: true,
  copyFiles: {
    'src/styles.css': 'dist/styles.css',
  },
  external: ['obsidian', 'crypto'],
}).catch(() => process.exit(1));