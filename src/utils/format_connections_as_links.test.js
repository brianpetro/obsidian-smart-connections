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

test('format_connections_as_links skips missing items', t => {
  const results = [
    {},
    {item: null},
    {item: {key: 'Folder/Note.md'}},
  ];

  const formatted = format_connections_as_links(results);

  t.is(formatted, '- [[Note]]');
});

test('format_connections_as_links omits line info when missing', t => {
  const results = [
    {item: {key: 'Folder/Block.md#{"id"}'}},
  ];

  const formatted = format_connections_as_links(results);

  t.is(formatted, '- [[Block#{"id"}]]');
});

test('format_connections_as_links includes line info when available', t => {
  const results = [
    {item: {key: 'Folder/Block.md#{123}', lines: [3, 7]}},
  ];

  const formatted = format_connections_as_links(results);

  t.is(formatted, '- [[Block]] (Lines: 3-7)');
});
