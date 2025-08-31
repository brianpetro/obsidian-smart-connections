import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { write_plugin_release_notes } from './format_release_notes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

if (path.resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
  const version = pkg.version;
  const release_file = path.join(__dirname, 'releases', `${version}.md`);
  const canonical = path.join(__dirname, 'releases', '3.0.0.md');
  const release_path = fs.existsSync(release_file) ? release_file : canonical;
  write_plugin_release_notes({
    release_path,
    output_path: path.join(__dirname, 'releases', 'latest_release.md'),
    version,
  });
}
