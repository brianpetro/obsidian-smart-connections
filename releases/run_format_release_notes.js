import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { compile_latest_release, parse_cli_options } from 'obsidian-smart-env/build/compile_latest_release.js';

const is_main = path.resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url);

if (is_main) {
  const cli_options = parse_cli_options(process.argv.slice(2));
  const cwd = process.cwd();
  const package_json = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf8'));
  const manifest_json = JSON.parse(fs.readFileSync(path.join(cwd, 'manifest.json'), 'utf8'));

  compile_latest_release({
    version: package_json.version,
    plugin_name: manifest_json.name,
    plugin_id: manifest_json.id,
    releases_dir: path.join(cwd, 'releases'),
    output_path: path.join(cwd, 'releases', 'latest_release.md'),
    dry_run: cli_options.dry_run,
  });
}
