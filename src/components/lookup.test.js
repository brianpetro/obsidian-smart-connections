import test from 'ava';
import { get_lookup_params } from './lookup.js';

test('includes skip_blocks when setting excludes blocks', t => {
  const params = get_lookup_params('test', { smart_view_filter: { exclude_blocks_from_source_connections: true } });
  t.true(params.skip_blocks);
});

test('omits skip_blocks when setting allows blocks', t => {
  const params = get_lookup_params('test', { smart_view_filter: { exclude_blocks_from_source_connections: false } });
  t.false('skip_blocks' in params);
});
