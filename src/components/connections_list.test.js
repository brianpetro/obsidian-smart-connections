import test from 'ava';
import { SmartSource } from 'smart-sources/smart_source.js';
import { FileSourceContentAdapter } from 'smart-sources/adapters/_file.js';
import { create_feedback_fixture } from '../../test/fixtures/connections_feedback.js';
import { create_node, presenter } from '../../test/fixtures/presentation_surface.js';
import { post_process } from './connections_list.js';

async function render_empty_results(overrides = {}) {
  const fixture = create_feedback_fixture();
  Object.assign(fixture.target, {
    vec: [],
    file: { stat: { size: 199 } },
    settings: { min_chars: 200 },
    source_adapter: new FileSourceContentAdapter(fixture.target),
    ...overrides,
  });
  fixture.target.data.connections = {};
  for (const key of ['size', 'should_embed', 'is_gone']) {
    Object.defineProperty(fixture.target, key,
      Object.getOwnPropertyDescriptor(SmartSource.prototype, key));
  }
  const container = create_node();
  await post_process.call(presenter, fixture.list, container, { results: [] });
  return container.children[0].innerHTML;
}

for (const [label, size, min_chars, expected_short] of [
  ['a known empty file', 0, 200, true],
  ['below the configured minimum', 199, 200, true],
  ['exactly at the configured minimum', 200, 200, true],
  ['above the configured minimum', 201, 200, false],
  ['using the source fallback minimum', 300, 0, true],
  ['above the source fallback minimum', 301, 0, false],
]) {
  test(`empty Connections explains source eligibility ${label}`, async t => {
    const html = await render_empty_results({ file: { stat: { size } }, settings: { min_chars } });
    t.is(html.includes('This note is too short to embed'), expected_short);
    t.false(html.includes('Clear sources data'));
    t.false(html.includes('Reload sources'));
    t.true(html.includes(expected_short ? 'Add more text' : 'Connections filters'));
  });
}

for (const [label, overrides] of [
  ['an already embedded source', { vec: [1, 0] }],
  ['an adapter that disables embedding', { source_adapter: { should_embed: false } }],
  ['an adapter that enables embedding', { source_adapter: { should_embed: true } }],
  ['an unrecorded file size', { file: { stat: {} } }],
  ['missing file statistics', { file: {} }],
  ['an adapter without size support', { source_adapter: {} }],
  ['a missing source', { file: undefined }],
  ['a block with its own embedding policy', { collection_key: 'smart_blocks' }],
]) {
  test(`empty Connections does not misdiagnose ${label} as too short`, async t => {
    const html = await render_empty_results(overrides);
    t.false(html.includes('This note is too short to embed'));
    t.true(html.includes('Connections filters'));
    t.false(html.includes('Clear sources data'));
  });
}
