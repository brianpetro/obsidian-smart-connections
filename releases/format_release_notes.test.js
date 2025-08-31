import test from 'ava';
import { format_release_notes_content } from './format_release_notes.js';

test('formats release notes into callouts', (t) => {
  const raw = `## Features\n- Added stuff\n\n## patch \`v1.0.0\`\n- first\n\n## next patch\n- upcoming`;
  const expected = `> [!NOTE] Patch v1.0.1\n> - upcoming\n\n> [!NOTE]- Previous patches\n> ### v1.0.0\n> - first\n> \n\n## Features\n- Added stuff\n`;
  const result = format_release_notes_content(raw, '1.0.1');
  t.is(result, expected);
});
