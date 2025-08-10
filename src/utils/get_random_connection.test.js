import test from 'ava';
import { get_random_connection } from './get_random_connection.js';

const create_env = ({ should_embed = true, connections = [] } = {}) => ({
  smart_sources: {
    get: () => ({
      should_embed,
      find_connections: async () => connections
    })
  }
});

test('returns null when file path missing or not embedded', async t => {
  const env = create_env();
  t.is(await get_random_connection(env, null), null);
  const env_not_embedded = create_env({ should_embed: false });
  t.is(await get_random_connection(env_not_embedded, 'a'), null);
});

test('returns null when no connections', async t => {
  const env = create_env({ connections: [] });
  const result = await get_random_connection(env, 'note.md');
  t.is(result, null);
});

test('selects random connection using provided rng', async t => {
  const connections = [
    { item: { path: 'a' }, score: 2 },
    { item: { path: 'b' }, score: 1 }
  ];
  const env = create_env({ connections });
  const rng = () => 0.9; // threshold -> select 'b'
  const result = await get_random_connection(env, 'note.md', { rng });
  t.is(result.item.path, 'b');
});
