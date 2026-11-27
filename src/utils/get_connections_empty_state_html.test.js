import test from 'ava';
import { get_connections_empty_state_html } from './get_connections_empty_state_html.js';

function make_source(size = 100, overrides = {}) {
  return {
    collection_key: 'smart_sources',
    file: { stat: { size } },
    source_adapter: { size },
    size,
    settings: { min_chars: 200 },
    should_embed: false,
    ...overrides,
  };
}

for (const [name, item] of [
  ['short note', make_source()],
  ['zero-byte note', make_source(0)],
  ['exact minimum', make_source(200)],
  ['default minimum', make_source(300, { settings: {} })],
]) {
  test(`${name} explains the minimum-length policy`, t => {
    const html = get_connections_empty_state_html(item);
    t.true(html.includes('too short to embed'));
    t.true(html.includes('Minimum length for sources'));
  });
}

for (const [name, item] of [
  ['unknown target', undefined],
  ['missing file', make_source(0, { file: undefined })],
  ['unknown file size', make_source(0, { file: { stat: {} } })],
  ['unknown source size', make_source(0, { size: undefined })],
  ['missing adapter', make_source(0, { source_adapter: undefined })],
  ['adapter-specific policy', make_source(0, { source_adapter: { should_embed: false } })],
  ['block target', make_source(0, { collection_key: 'smart_blocks' })],
  ['already embedded', make_source(0, { vec: new Float32Array([1, 0]) })],
  ['eligible source', make_source(0, { should_embed: true })],
  ['long ineligible source', make_source(201)],
]) {
  test(`${name} uses general recovery guidance`, t => {
    const html = get_connections_empty_state_html(item);
    t.false(html.includes('too short to embed'));
    t.true(html.includes('Connections filters'));
    t.true(html.includes('embedding status'));
    t.false(html.includes('Clear sources data'));
  });
}
