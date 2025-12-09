import test from 'ava';

import {
  format_connections_as_links,
} from './format_connections_as_links.js';

test('format_connections_as_links returns bullet list with display names', t => {
  const results = [
    {item: {key: 'Folder/Note.md'}},
    {item: {key: 'Folder/Sub/Block.md#heading1#h3'}},
  ];

  const formatted = format_connections_as_links(results);

  t.is(
    formatted,
    ['- [[Note]]', '- [[Block#h3]]'].join('\n')
  );
});