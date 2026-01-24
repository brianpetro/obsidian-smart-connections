import esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';
import 'dotenv/config';
import { build_smart_env_config } from 'obsidian-smart-env/build/build_env_config.js';
import { create_banner } from './src/utils/banner.js';

const roots = [
  path.resolve(process.cwd(), 'src'),
  // path.resolve(process.cwd(), '..', 'smart-context-obsidian', 'src'),
];
build_smart_env_config(process.cwd(), roots);

/**
 * Import CSS as text:
 *   import sheet from './style.css';
 */

// if directory doesn't exist, create it
if(!fs.existsSync(path.join(process.cwd(), 'dist'))) {
  fs.mkdirSync(path.join(process.cwd(), 'dist'), { recursive: true });
}

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

const destination_vaults = process.env.DESTINATION_VAULTS?.split(',') || [];

// get first argument as entry point
const entry_point = process.argv[2] || 'src/main.js';

// markdown plugin
const markdown_plugin = {
  name: 'markdown',
  setup(build) {
    build.onLoad({ filter: /\.md$/ }, async (args) => {
      if(args.with && args.with.type === 'markdown') {
        const text = await fs.promises.readFile(args.path, 'utf8');
        return {
          contents: `export default ${JSON.stringify(text)};`,
          loader: 'js'
        };
      }
    });
  }
};
// Build the project
const copyright_banner = create_banner(package_json);
esbuild.build({
  entryPoints: [entry_point],
  outfile: 'dist/main.js',
  format: 'cjs',
  bundle: true,
  write: true,
  target: "es2022",
  logLevel: "info",
  treeShaking: true,
  platform: 'node',
  preserveSymlinks: true,
  external: [
    'electron',
    'obsidian',
    'crypto',
    '@xenova/transformers',
    '@huggingface/transformers',
    'http',
    'url',
  ],
  define: {
    'process.env.DEFAULT_OPEN_ROUTER_API_KEY': JSON.stringify(process.env.DEFAULT_OPEN_ROUTER_API_KEY),
  },
  loader: {
    '.css': 'text',
  },
  plugins: [markdown_plugin],
  banner: { js: copyright_banner },
}).then(() => {
  console.log('Build complete');
  const release_file_paths = [manifest_path, styles_path, main_path];
  for(let vault of destination_vaults) {
    const destDir = path.join(process.cwd(), '..', vault, '.obsidian', 'plugins', 'smart-connections');
    console.log(`Copying files to ${destDir}`);
    fs.mkdirSync(destDir, { recursive: true });
    // create .hotreload file if it doesn't exist
    if(!fs.existsSync(path.join(destDir, '.hotreload'))) {
      fs.writeFileSync(path.join(destDir, '.hotreload'), '');
    }
    release_file_paths.forEach(file_path => {
      fs.copyFileSync(file_path, path.join(destDir, path.basename(file_path)));
    });
    console.log(`Copied files to ${destDir}`);
  }
}).catch(() => process.exit(1));
