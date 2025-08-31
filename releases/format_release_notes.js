import fs from 'fs';

/**
 * Compare two semver strings.
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
 * Parse patch sections from release notes.
 * @param {string} md
 * @returns {{version:string, body:string}[]}
 */
function parse_patches(md) {
  const lines = md.split(/\r?\n/);
  const patches = [];
  let current = null;
  lines.forEach((line) => {
    const m = line.match(/^## patch `v([^`]+)`$/);
    if (m) {
      if (current) patches.push(current);
      current = { version: m[1], body: '' };
    } else if (current) {
      current.body += (current.body ? '\n' : '') + line;
    }
  });
  if (current) patches.push(current);
  return patches.map((p) => ({ ...p, body: p.body.trim() }));
}

/**
 * Format release notes into plugin release notes.
 * @param {string} md
 * @param {string} current_version
 * @returns {string}
 */
function format_release_notes_content(md, current_version) {
  const replaced = md.replace('## next patch', `## patch \`v${current_version}\``);
  const patches = parse_patches(replaced);
  const first_index = replaced.search(/^## patch `v/m);
  const main = first_index === -1 ? replaced.trim() : replaced.slice(0, first_index).trim();
  patches.sort((a, b) => semver_compare(b.version, a.version));
  const latest = patches[0];
  const previous = patches.slice(1);
  const lines = [];
  if (latest) {
    lines.push(`> [!NOTE] Patch v${latest.version}`);
    if (latest.body) {
      latest.body.split('\n').forEach((l) => lines.push(`> ${l}`));
    }
    lines.push('');
  }
  if (previous.length) {
    lines.push('> [!NOTE]- Previous patches');
    previous.forEach((p) => {
      lines.push(`> > [!NOTE]- v${p.version}`);
      if (p.body) {
        p.body.split('\n').forEach((l) => lines.push(`> > ${l}`));
      }
      lines.push('> ');
    });
    lines.push('> ');
  }
  if (main) lines.push(main);
  return `${lines.join('\n').trim()}\n`;
}

/**
 * Write plugin release notes to file.
 * @param {{release_path:string, output_path:string, version:string}} opts
 */
function write_plugin_release_notes(opts) {
  const { release_path, output_path, version } = opts;
  const md = fs.readFileSync(release_path, 'utf8');
  const formatted = format_release_notes_content(md, version);
  fs.writeFileSync(output_path, formatted);
}

export { semver_compare, parse_patches, format_release_notes_content, write_plugin_release_notes };
