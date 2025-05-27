import 'dotenv/config';
import fs from 'fs';
import readline from 'readline';
import archiver from 'archiver';
import axios from 'axios';
import { exec } from 'child_process';

/**
 * @typedef {Object} CliOptions
 * @property {boolean} draft - Indicates whether the release should be marked as a GitHub draft.
 */

/**
 * @function parse_cli_options
 * @description Parses command‑line arguments into an options object.
 *   Currently supports:
 *     --draft  Mark the created GitHub release as a draft.
 *
 *   This utility deliberately avoids adding external dependencies
 *   such as minimist/yargs – keeping the build zero‑dep.
 *
 * @param {string[]} argv process.argv slice(2)
 * @returns {CliOptions}
 */
function parse_cli_options(argv) {
  return {
    draft: argv.includes('--draft')
  };
}


/**
 * @function build_release_body
 * @description Combines user‑supplied description (optional) and version notes
 *              into a single markdown string.
 *
 * @param {string} user_description
 * @param {string} version_notes
 * @returns {string}
 */
function build_release_body(user_description, version_notes) {
  let body = '';
  if (user_description && user_description.trim()) {
    body += user_description.trim() + '\n\n';
  }
  if (version_notes) {
    body += version_notes;
  }
  return body.trim();
}

// -----------------------------------------------------------------------------
//  Runtime
// -----------------------------------------------------------------------------

const cli_options = parse_cli_options(process.argv.slice(2));

// Read package.json and manifest.json
const package_json = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
const manifest_json = JSON.parse(fs.readFileSync('./manifest.json', 'utf8'));
const version = package_json.version;
const manifest_id = manifest_json.id;
const manifest_version = manifest_json.version;

if (version !== manifest_version) {
  console.error('Version mismatch between package.json and manifest.json');
  process.exit(1);
}

// Prepare readline interface (only used if we need user input later)
const rl_interface = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function close_rl() {
  if (rl_interface && rl_interface.close) rl_interface.close();
}

(async () => {
  // Step 1 – confirm the version
  const confirmed_version = await new Promise(resolve => {
    rl_interface.question(`Confirm release version (${version}): `, answer => {
      resolve(answer || version);
    });
  });
  console.log(`Creating release for version ${confirmed_version}`);

  // Preferred individual release notes file takes precedence
  const release_notes_file_path = `./releases/${confirmed_version}.md`;
  const release_notes_file_exists = fs.existsSync(release_notes_file_path);

  // Step 2 – collect release notes
  let version_notes = '';
  if (release_notes_file_exists) {
    version_notes = fs.readFileSync(release_notes_file_path, 'utf8').trim();
  }

  // Step 3 – collect additional user description when necessary
  let user_description = '';
  if (!release_notes_file_exists) {
    user_description = await new Promise(resolve => {
      rl_interface.question('Enter additional release description (optional): ', answer => {
        resolve(answer);
      });
    });
    // create release notes file from user description if it doesn't exist
    fs.writeFileSync(release_notes_file_path, user_description);
  }
  // We no longer need stdin
  close_rl();

  const release_body = build_release_body(user_description, version_notes);

  // Prepare release data
  const release_data = {
    tag_name: confirmed_version,
    name: confirmed_version,
    body: release_body,
    draft: cli_options.draft,
    prerelease: false
  };

  // Environment variables
  const github_token = process.env.GH_TOKEN;
  const github_repo = process.env.GH_REPO;

  if (!github_token || !github_repo) {
    console.error('Error: GitHub token or repository not set in .env file.');
    process.exit(1);
  }

  try {
    // Create GitHub release
    const release_response = await axios.post(
      `https://api.github.com/repos/${github_repo}/releases`,
      release_data,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${github_token}`
        }
      }
    );

    const release_info = release_response.data;
    console.log('Release created:', release_info.html_url);

    /**
     * @function upload_asset_curl
     * @description Uploads a file to the GitHub release using curl (bypassing axios chunked issues).
     * @param {string} asset_path
     * @param {string} asset_name
     * @returns {Promise<void>}
     */
    async function upload_asset_curl(asset_path, asset_name) {
      const upload_url = `${release_info.upload_url.split('{')[0]}?name=${encodeURIComponent(asset_name)}`;
      const mime_type = 'application/octet-stream';
      const command = [
        'curl',
        '-X', 'POST',
        '-H', `"Authorization: Bearer ${github_token}"`,
        '-H', `"Content-Type: ${mime_type}"`,
        '--data-binary', `@${asset_path}`,
        `"${upload_url}"`
      ].join(' ');
      return new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
          if (error) {
            console.error(`Error uploading file ${asset_name}:`, error);
            reject(error);
            return;
          }
          console.log(`Uploaded file: ${asset_name}`);
          if (stdout) console.log(stdout);
          if (stderr) console.log(stderr);
          resolve();
        });
      });
    }

    // Create a zip file of dist folder
    const zip_name = `${manifest_id}-${confirmed_version}.zip`;
    const output = fs.createWriteStream(`./${zip_name}`);
    const archive = archiver('zip', { zlib: { level: 0 } });

    archive.on('error', err => {
      throw err;
    });

    archive.on('finish', async () => {
      console.log(`Archive wrote ${archive.pointer()} bytes`);
      // Upload zip file
      await upload_asset_curl(`./${zip_name}`, zip_name);

      // Upload each file in dist folder
      const files = fs.readdirSync('./dist');
      for (const file of files) {
        await upload_asset_curl(`./dist/${file}`, file);
      }

      // Remove zip file locally
      setTimeout(() => {
        fs.unlinkSync(`./${zip_name}`);
      }, 3000);

      console.log('All files requested for upload.');
    });

    archive.pipe(output);
    archive.directory('dist/', false);
    await archive.finalize();

  } catch (error) {
    console.error('Error in release process:', error);
  }
})();
