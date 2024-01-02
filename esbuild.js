const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');
const packageJson = JSON.parse(fs.readFileSync('./package.json'));
const manifestJson = JSON.parse(fs.readFileSync('./manifest.json'));
manifestJson.version = packageJson.version;
fs.writeFileSync('./manifest.json', JSON.stringify(manifestJson, null, 2));
fs.writeFileSync('./dist/manifest.json', JSON.stringify(manifestJson, null, 2));

// Copy styles.css to dist folder
fs.copyFileSync('./src/styles.css', './dist/styles.css');

const destination_vaults = [
  'sc-test-vault',
  'obsidian-1',
];

// Build the project
esbuild.build({
  entryPoints: ['src/index.js'],
  outfile: 'dist/main.js',
  format: 'cjs',
  bundle: true,
  write: true,
  sourcemap: 'inline',
  target: "es2018",
	logLevel: "info",
  treeShaking: true,
  external: [
    'obsidian',
    'crypto',
  ],
}).then(() => {
  // Copy the dist folder to ../DESTINATION_VAULT/.obsidian/plugins/smart-connections/
  const srcDir = path.join(__dirname, 'dist');
  for(let vault of destination_vaults) {
    const destDir = path.join(__dirname, '..', vault, '.obsidian', 'plugins', 'smart-connections');
    fs.mkdirSync(destDir, { recursive: true });
    fs.readdirSync(srcDir).forEach(file => {
      fs.copyFileSync(path.join(srcDir, file), path.join(destDir, file));
    });
  }
}).catch(() => process.exit(1));