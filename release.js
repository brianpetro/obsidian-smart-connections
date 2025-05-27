// release.js – Smart Connections GH release helper
// ----------------------------------------------------------------------------
// Node ≥18, ESM, zero-dep (aside from existing std/archiver/axios libs)

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import archiver from 'archiver';
import axios from 'axios';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';

/* -------------------------------------------------------------------------- */
/*  Pure helpers – kept free of side-effects for easy unit testing            */
/* -------------------------------------------------------------------------- */

/**
 * Compares two SemVer strings (major.minor.patch).
 * Returns positive when a > b, negative when a < b, zero when equal.
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
function semver_compare(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i += 1) {
    const diff = pa[i] - pb[i];
    if (diff !== 0) return diff;
  }
  return 0;
}

/**
 * Returns absolute path to the most-recent release notes file
 * found in the provided directory or `null` when none exist.
 * @param {string} dir
 * @param {string} current_version
 * @returns {string|null}
 */
function latest_release_file(dir, current_version) {
  if (!fs.existsSync(dir)) return null;
  const files = fs
    .readdirSync(dir)
    .filter((f) => /^\d+\.\d+\.\d+\.md$/.test(f) && f !== `${current_version}.md`);
  if (files.length === 0) return null;
  files.sort((a, b) => semver_compare(b.replace('.md', ''), a.replace('.md', '')));
  return path.join(dir, files[0]);
}

/**
 * Merges an optional user description with previous release notes
 * under a new heading for the given version.
 * @param {string} current_version
 * @param {string} prior_notes
 * @param {string} user_desc
 * @returns {string}
 */
function build_combined_notes(current_version, prior_notes, user_desc) {
  const heading = `\n\n# Smart Connections v${current_version}\n\n`;
  const desc_block = user_desc?.trim() ? `${user_desc.trim()}\n` : '';
  return `${prior_notes ?? ''}${heading}${desc_block}`.trim();
}

/**
 * @typedef {Object} CliOptions
 * @property {boolean} draft
 */

/**
 * Parses CLI flags.
 * @param {string[]} argv
 * @returns {CliOptions}
 */
function parse_cli_options(argv) {
  return {
    draft: argv.includes('--draft'),
  };
}

/* -------------------------------------------------------------------------- */
/*  Runtime                                                                   */
/* -------------------------------------------------------------------------- */


const is_main = path.resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url);

if (is_main) {
  run_release().catch((err) => {
    console.error('Error in release process:', err);
    process.exit(1);
  });
}

async function run_release() {
  const cli_options = parse_cli_options(process.argv.slice(2));

  // Read package & manifest
  const package_json = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
  const manifest_json = JSON.parse(fs.readFileSync('./manifest.json', 'utf8'));
  const version = package_json.version;
  const manifest_id = manifest_json.id;

  if (version !== manifest_json.version) {
    console.error('Version mismatch between package.json and manifest.json');
    process.exit(1);
  }

  // Readline only if we need user input
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q) => new Promise((res) => rl.question(q, res));

  const confirmed_version =
    (await ask(`Confirm release version (${version}): `))?.trim() || version;
  console.log(`Creating release for ${confirmed_version}`);

  const releases_dir = './releases';
  const release_file = path.join(releases_dir, `${confirmed_version}.md`);
  let version_notes = '';
  let user_desc = '';

  if (fs.existsSync(release_file)) {
    version_notes = fs.readFileSync(release_file, 'utf8').trim();
  } else {
    const prior_file = latest_release_file(releases_dir, confirmed_version);
    user_desc = await ask('Enter additional release description (optional): ');
    const prior_notes = prior_file ? fs.readFileSync(prior_file, 'utf8').trim() : '';
    version_notes = build_combined_notes(confirmed_version, prior_notes, user_desc);
    fs.writeFileSync(release_file, version_notes);
  }
  rl.close();

  // GitHub release body
  const release_body = version_notes;

  // GH env
  const github_token = process.env.GH_TOKEN;
  const github_repo = process.env.GH_REPO;
  if (!github_token || !github_repo) {
    console.error('GH_TOKEN or GH_REPO missing from .env');
    process.exit(1);
  }

  // Create release via GH API
  const release_data = {
    tag_name: confirmed_version,
    name: confirmed_version,
    body: release_body,
    draft: cli_options.draft,
    prerelease: false,
  };
  const release_resp = await axios.post(
    `https://api.github.com/repos/${github_repo}/releases`,
    release_data,
    { headers: { Authorization: `Bearer ${github_token}`, 'Content-Type': 'application/json' } },
  );
  const { upload_url, html_url } = release_resp.data;
  console.log('Release created:', html_url);

  // Asset upload helper (curl avoids axios chunk issues)
  const upload_asset_curl = (asset_path, asset_name) =>
    new Promise((resolve, reject) => {
      const url = `${upload_url.split('{')[0]}?name=${encodeURIComponent(asset_name)}`;
      const cmd = [
        'curl',
        '-X', 'POST',
        '-H', `"Authorization: Bearer ${github_token}"`,
        '-H', '"Content-Type: application/octet-stream"',
        '--data-binary', `@${asset_path}`,
        `"${url}"`,
      ].join(' ');
      exec(cmd, (err, stdout, stderr) => {
        if (err) return reject(err);
        if (stdout) console.log(stdout);
        if (stderr) console.log(stderr);
        console.log(`Uploaded ${asset_name}`);
        resolve();
      });
    });

  // Zip dist & upload assets
  const zip_name = `${manifest_id}-${confirmed_version}.zip`;
  const zip_stream = fs.createWriteStream(`./${zip_name}`);
  const archive = archiver('zip', { zlib: { level: 0 } });

  await new Promise((res, rej) => {
    archive.pipe(zip_stream);
    archive.directory('dist/', false);
    archive.on('error', rej);
    zip_stream.on('close', res);
    archive.finalize();
  });
  console.log(`Archive wrote ${archive.pointer()} bytes`);
  await upload_asset_curl(`./${zip_name}`, zip_name);

  // Upload each dist file
  for (const file of fs.readdirSync('./dist')) {
    await upload_asset_curl(`./dist/${file}`, file);
  }
  // Clean up zip after a short delay
  setTimeout(() => fs.unlinkSync(`./${zip_name}`), 3000);
}

/* -------------------------------------------------------------------------- */
/*  Exports for unit tests                                                    */
/* -------------------------------------------------------------------------- */
export { semver_compare, latest_release_file, build_combined_notes };
