const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const main_path = path.join(process.cwd(), 'dist', 'main.js');
const manifest_path = path.join(process.cwd(), 'manifest.json');
const styles_path = path.join(process.cwd(), 'src', 'styles.css');
// Update manifest.json version
const package_json = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json')));
const manifest_json = JSON.parse(fs.readFileSync(manifest_path));
manifest_json.version = package_json.version;
fs.writeFileSync(manifest_path, JSON.stringify(manifest_json, null, 2));
// copy manifest and styles to dist
fs.copyFileSync(manifest_path, path.join(process.cwd(), 'dist', 'manifest.json'));
fs.copyFileSync(styles_path, path.join(process.cwd(), 'dist', 'styles.css'));

const destination_vaults = [
  // 'sc-test-vault',
  'obsidian-1',
];

// get first argument as entry point
const entry_point = process.argv[2] || 'src/index.js';

// Build the project
esbuild.build({
  entryPoints: [entry_point],
  outfile: 'dist/main.js',
  format: 'cjs',
  bundle: true,
  write: true,
  sourcemap: 'inline',
  target: "es2018",
	logLevel: "info",
  treeShaking: true,
  platform: 'node',
  preserveSymlinks: true,
  external: [
    'electron',
    'obsidian',
    'crypto',
    '@xenova/transformers',
  ],
  define: {
    'process.env.DEFAULT_OPEN_ROUTER_API_KEY': JSON.stringify(process.env.DEFAULT_OPEN_ROUTER_API_KEY),
  },
}).then(() => {
  // Copy the dist folder to ./DESTINATION_VAULT/.obsidian/plugins/smart-connections/
  const release_file_paths = [manifest_path, styles_path, main_path];
  for(let vault of destination_vaults) {
    const destDir = path.join(process.cwd(), '..', vault, '.obsidian', 'plugins', 'smart-connections');
    fs.mkdirSync(destDir, { recursive: true });
    release_file_paths.forEach(file_path => {
      fs.copyFileSync(file_path, path.join(destDir, path.basename(file_path)));
    });
  }
}).catch(() => process.exit(1));