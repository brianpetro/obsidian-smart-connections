import test from 'ava';
import { migrate_connections_lists_settings } from './migrate_connections_lists_settings.js';

function create_env(overrides = {}) {
  return {
    settings: {},
    ...overrides
  };
}

test('migrate copies inline and footer settings to connections_lists', t => {
  const env = create_env({
    settings: {
      connections_pro: {
        inline_connections: false,
        inline_connections_score_threshold: '0.5',
        footer_connections: true,
        rank_query: 'keep me',
        rank_model: { adapter: 'cohere' }
      }
    }
  });

  migrate_connections_lists_settings(env);

  t.deepEqual(env.settings.connections_lists, {
    inline_connections: false,
    inline_connections_score_threshold: '0.5',
    footer_connections: true,
    rank_model: { adapter: 'cohere' }
  });
  t.is(env.settings.connections_pro.rank_query, 'keep me');
  t.false('inline_connections' in env.settings.connections_pro);
  t.false('inline_connections_score_threshold' in env.settings.connections_pro);
  t.false('footer_connections' in env.settings.connections_pro);
  t.false('rank_model' in env.settings.connections_pro);
});

test('migrate preserves existing connections_lists values', t => {
  const env = create_env({
    settings: {
      connections_pro: {
        inline_connections: false,
        footer_connections: true
      },
      connections_lists: {
        inline_connections: true,
        footer_connections: false,
        rank_model: { adapter: 'existing' }
      }
    }
  });

  migrate_connections_lists_settings(env);

  t.deepEqual(env.settings.connections_lists, {
    inline_connections: true,
    footer_connections: false,
    rank_model: { adapter: 'existing' }
  });
});
