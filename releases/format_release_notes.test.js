import test from 'ava';
import fs from 'fs';
import path from 'path';
import { format_release_notes_content, write_plugin_release_notes } from './format_release_notes.js';

test('formats release notes with nested callouts', (t) => {
  const raw = `## Features\n- Added stuff\n\n## patch \`v1.0.0\`\n- first\n\n## next patch\n- upcoming`;
  const result = format_release_notes_content(raw, '1.0.1');
  t.true(result.includes('> [!NOTE] Patch v1.0.1'));
  t.true(result.includes('> [!NOTE]- Previous patches'));
  t.true(result.includes('> > [!NOTE]- v1.0.0'));
});

test('write_plugin_release_notes writes output without modifying source', (t) => {
  const tmp_dir = fs.mkdtempSync('release-test-');
  const source = path.join(tmp_dir, '3.0.0.md');
  const output = path.join(tmp_dir, 'latest.md');
  const raw = `## next patch\n- upcoming\n\n## patch \`v3.0.0\`\n- first`;
  fs.writeFileSync(source, raw);
  write_plugin_release_notes({ release_path: source, output_path: output, version: '3.0.1' });
  t.is(fs.readFileSync(source, 'utf8'), raw);
  t.true(fs.existsSync(output));
  const out = fs.readFileSync(output, 'utf8');
  t.true(out.includes('Patch v3.0.1'));
});
