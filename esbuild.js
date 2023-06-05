const esbuild = require('esbuild');
const fs = require('fs');
const packageJson = JSON.parse(fs.readFileSync('./package.json'));
const manifestJson = JSON.parse(fs.readFileSync('./src/manifest.json'));
manifestJson.version = packageJson.version;
fs.writeFileSync('./dist/manifest.json', JSON.stringify(manifestJson, null, 2));

// Copy styles.css to dist folder
fs.copyFileSync('./src/styles.css', './dist/styles.css');


esbuild.build({
  entryPoints: ['src/index.js'],
  outfile: 'dist/main.js',
  bundle: true,
  write: true,
  external: ['obsidian', 'crypto'],
}).catch(() => process.exit(1));