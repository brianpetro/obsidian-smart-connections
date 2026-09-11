import test from 'ava';
import { create_graph_fixture } from '../../../test/fixtures/connections_graph.js';
import { connections_list_item_toggle_pinned } from '../../actions/connections-list-item/toggle_pinned.js';
import { connections_list_item_hide } from '../../actions/connections-list-item/hide.js';
import { connections_list_unhide_all } from '../../actions/connections-list/unhide_all.js';
import { connections_list_unpin_all } from '../../actions/connections-list/unpin_all.js';

const component_url = new URL('./v1.js', import.meta.url);

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

const settle = () => new Promise(resolve => setImmediate(resolve));

test('Base graph metadata names the 2D visualization without advertising note links', t => {
  const { graph } = create_graph_fixture(component_url);
  t.is(graph.display_name, '2D similarity map');
  t.true(graph.description.includes('2D'));
  t.false(graph.description.includes('arrows'));
});

test('graph render returns its shell before D3 completes and cancels initialization after removal', async t => {
  const pending = deferred();
  const fixture = create_graph_fixture(component_url, { activeWindow: { d3: pending.promise } });
  const results = await fixture.list.get_results({});
  const root = await fixture.graph.render.call(fixture.view, fixture.list, { results });
  t.is(root, fixture.container);
  t.is(fixture.simulations.length, 0);
  fixture.dispose();
  pending.resolve(fixture.d3);
  await settle();
  t.is(fixture.simulations.length, 0);
  t.is(fixture.observers.length, 0);
  t.deepEqual(fixture.errors, []);
});

test('removal during result preparation does not create graph resources later', async t => {
  const pending = deferred();
  const fixture = create_graph_fixture(component_url, { get_graph_connections_results: () => pending.promise });
  const work = fixture.graph.post_process.call(fixture.view, fixture.list, fixture.container, { results: [] });
  fixture.dispose();
  pending.resolve([]);
  await work;
  t.is(fixture.simulations.length, 0);
  t.is(fixture.observers.length, 0);
});

test('a detached shell initializes normally and disposes observers, simulation and subscriptions', async t => {
  const fixture = create_graph_fixture(component_url);
  await fixture.mount();
  t.is(fixture.simulations.length, 1);
  t.is(fixture.observers.length, 1);
  t.is(fixture.listeners.get('connections:feedback_changed').size, 1);
  const simulation = fixture.simulations[0];
  const observer = fixture.observers[0];
  fixture.dispose();
  t.is(simulation.stopped, 1);
  t.is(observer.disconnected, 1);
  t.is(fixture.listeners.get('connections:feedback_changed').size, 0);
  observer.callback();
  t.is(simulation.restarted, 0);
  t.deepEqual(fixture.errors, []);
});

test('live feedback changes node state without replacing the ranked snapshot or restarting layout', async t => {
  const fixture = create_graph_fixture(component_url);
  const results = await fixture.mount();
  const result = results.find(row => row.item === fixture.first);
  const feedback = result.feedback;
  const queries = fixture.queries.length;
  const node = fixture.node(fixture.first.key);
  node.classList.add('sc-graph-node-hover');
  t.true(connections_list_item_toggle_pinned.call(fixture.list, { target_item: fixture.first }));
  t.true(node.classList.contains('sc-result-pinned'));
  t.is(node.getAttribute('data-pinned'), 'true');
  t.true(node.datum.isPinned);
  t.true(connections_list_item_toggle_pinned.call(fixture.list, { target_item: fixture.first }));
  t.false(node.classList.contains('sc-result-pinned'));
  t.is(node.getAttribute('data-pinned'), null);
  t.true(connections_list_item_hide.call(fixture.list, { target_item: fixture.first }));
  t.true(node.classList.contains('sc-result-hidden'));
  t.true(node.datum.isHidden);
  t.true(connections_list_unhide_all.call(fixture.list));
  t.false(node.classList.contains('sc-result-hidden'));
  t.true(connections_list_item_toggle_pinned.call(fixture.list, { target_item: fixture.first }));
  t.true(connections_list_unpin_all.call(fixture.list));
  t.false(node.classList.contains('sc-result-pinned'));
  t.true(node.classList.contains('sc-graph-node-hover'));
  t.is(result.feedback, feedback);
  t.is(feedback.state, 'default');
  t.is(fixture.list.results, results);
  t.is(fixture.queries.length, queries);
  t.is(fixture.simulations.length, 1);
  t.is(fixture.simulations[0].restarted, 0);
  fixture.dispose();
});

test('feedback notifications are scoped to the graph center and pin retains precedence over hide', async t => {
  const fixture = create_graph_fixture(component_url);
  await fixture.mount();
  const node = fixture.node(fixture.first.key);
  fixture.target.data.connections['smart_sources:First.md'] = { pinned: 1, hidden: 2 };
  fixture.env.events.emit('connections:feedback_changed', { collection_key: 'smart_sources', item_key: 'Other.md' });
  t.false(node.classList.contains('sc-result-pinned'));
  fixture.target.emit_event('connections:feedback_changed');
  t.true(node.classList.contains('sc-result-pinned'));
  t.false(node.classList.contains('sc-result-hidden'));
  connections_list_item_toggle_pinned.call(fixture.list, { target_item: fixture.first });
  t.false(node.classList.contains('sc-result-pinned'));
  t.true(node.classList.contains('sc-result-hidden'));
  fixture.observers[0].callback();
  t.true(fixture.node(fixture.first.key).classList.contains('sc-result-hidden'));
  fixture.dispose();
});
