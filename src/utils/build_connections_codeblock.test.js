import test from 'ava';
import { build_connections_codeblock } from './build_connections_codeblock.js';

test('builds empty connections codeblock', t => {
  t.is(build_connections_codeblock(), '```smart-connections\n{}\n```\n');
});

test('builds connections codeblock with settings', t => {
  const block = build_connections_codeblock({ limit: 5 });
  t.is(block, '```smart-connections\n{\n  "limit": 5\n}\n```\n');
});
