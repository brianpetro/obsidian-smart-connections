import esbuild from 'esbuild';
import path from 'path';
import { build_plugin } from 'obsidian-smart-env/build/build_plugin.js';
import { build_smart_env_config } from 'obsidian-smart-env/build/build_env_config.js';
import { create_banner } from './src/utils/banner.js';

const roots = [
  path.resolve(process.cwd(), 'src'),
];

build_plugin({
  esbuild,
  build_banner: create_banner,
  entry_point: 'src/main.js',
  entry_point_from_argv: true,
  env_config_builder: build_smart_env_config,
  env_config_output_dir: process.cwd(),
  env_config_roots: roots,
  external: [
    '@codemirror/state',
    '@codemirror/view',
    '@xenova/transformers',
    '@huggingface/transformers',
    'http',
    'url',
  ],
  plugin_id: 'smart-connections',
  styles_path: path.join(process.cwd(), 'src', 'styles.css'),
}).catch((err) => {
  console.error('Error in build process:', err);
  process.exit(1);
});
