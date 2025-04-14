import 'dotenv/config';
import fs from 'fs';
import readline from 'readline';
import archiver from 'archiver';
import axios from 'axios';
import { exec } from 'child_process';

/**
 * @function get_release_notes_for_version
 * @description Reads 'releases.md' and returns the content under the heading that contains the version.
 *   It checks for lines starting with '#' (any level of heading) and tests if it includes the version
 *   or 'v' + version in the heading. It returns all lines until the next heading of the same or
 *   lower level is encountered.
 *
 * @param {string} version
 * @returns {string} Returns the release notes found for this version (may be an empty string if none found).
 */
function get_release_notes_for_version(version) {
  if (!fs.existsSync(process.cwd() + '/releases.md')) {
    return '';
  }
  const file_lines = fs.readFileSync(process.cwd() + '/releases.md', 'utf8').split('\n');
  let found_heading = false;
  let current_heading_level = 0;
  const collected_lines = [];
  // Accept either exact version '1.2.3' or preceded by 'v'
  const possible_matches = [
    version.toLowerCase(),
    'v' + version.toLowerCase()
  ];

  for (let i = 0; i < file_lines.length; i++) {
    const line = file_lines[i];
    // Check if this line is a heading
    const heading_match = line.match(/^(#+)\s+(.*)$/);
    if (heading_match) {
      const heading_level = heading_match[1].length;
      const heading_content = heading_match[2].toLowerCase();

      // If we haven't yet found the heading for our version,
      // check if heading_content contains either 'version' or 'vversion'.
      const includes_version = possible_matches.some(vm => heading_content.includes(vm));
      if (!found_heading) {
        if (includes_version) {
          found_heading = true;
          current_heading_level = heading_level;
          continue;
        }
      } else {
        // We already found the heading, so if we encounter another heading
        // of the same or shallower depth, we end.
        if (heading_level <= current_heading_level) {
          break;
        }
      }
    } else if (!found_heading) {
      // Not in the version heading block yet
      continue;
    }

    // If we've found the heading, collect lines until we hit a heading
    if (found_heading) {
      collected_lines.push(line);
    }
  }

  // Return joined lines
  return collected_lines.join('\n').trim();
}

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

// Create readline interface
const rl_interface = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl_interface.question(`Confirm release version (${version}): `, (confirmed_version) => {
  if (!confirmed_version) confirmed_version = version;
  console.log(`Creating release for version ${confirmed_version}`);

  // Gather notes from releases.md
  const version_notes = get_release_notes_for_version(confirmed_version);
  
  rl_interface.question('Enter additional release description (optional): ', async (user_description) => {
    rl_interface.close();

    // Combine user_description + version_notes
    let release_body = '';
    if (user_description && user_description.trim()) {
      release_body += user_description.trim() + '\n\n';
    }
    if (version_notes) {
      release_body += version_notes;
    }

    // Prepare release data
    const release_data = {
      tag_name: confirmed_version,
      name: confirmed_version,
      body: release_body,
      draft: false,
      prerelease: false
    };

    // Environment variables
    const github_token = process.env.GH_TOKEN;
    const github_repo = process.env.GH_REPO;

    if (!github_token || !github_repo) {
      console.error('Error: GitHub token or repository not set in .env file.');
      return;
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
       */
      function upload_asset_curl(asset_path, asset_name) {
        const upload_url = `${release_info.upload_url.split('{')[0]}?name=${encodeURIComponent(asset_name)}`;
        const mime_type = 'application/octet-stream';
        const command = `curl -X POST -H "Authorization: Bearer ${github_token}" -H "Content-Type: ${mime_type}" --data-binary @${asset_path} "${upload_url}"`;
        exec(command, (error, stdout, stderr) => {
          if (error) {
            console.error(`Error uploading file ${asset_name}:`, error);
            return;
          }
          console.log(`Uploaded file: ${asset_name}`);
          if (stdout) console.log(stdout);
          if (stderr) console.log(stderr);
        });
      }

      // Create a zip file of dist folder
      const zip_name = `${manifest_id}-${confirmed_version}.zip`;
      const output = fs.createWriteStream(`./${zip_name}`);
      const archive = archiver('zip', { zlib: { level: 0 } });

      archive.on('error', function(err) {
        throw err;
      });

      archive.on('finish', async function() {
        console.log(`Archive wrote ${archive.pointer()} bytes`);
        // Upload zip file
        upload_asset_curl(`./${zip_name}`, zip_name);

        // Upload each file in dist folder
        const files = fs.readdirSync('./dist');
        for (const file of files) {
          upload_asset_curl(`./dist/${file}`, file);
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
  });
});


