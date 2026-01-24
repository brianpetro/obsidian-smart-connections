import path from 'path';
import { fileURLToPath } from 'url';
import { run_core_release } from '../obsidian-smart-env/build/release_runner.js';
import {
  build_combined_notes,
  latest_release_file,
  semver_compare,
} from '../obsidian-smart-env/build/release_notes.js';

const is_main = path.resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url);

if (is_main) {
  run_core_release().catch((err) => {
    console.error('Error in release process:', err);
    process.exit(1);
  });
}

/* -------------------------------------------------------------------------- */
/*  Exports for unit tests                                                    */
/* -------------------------------------------------------------------------- */
export { semver_compare, latest_release_file, build_combined_notes };
