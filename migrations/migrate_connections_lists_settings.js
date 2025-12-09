const MIGRATED_SETTING_KEYS = [
  'inline_connections',
  'inline_connections_score_threshold',
  'footer_connections'
];

/**
 * Safely migrate legacy Smart Connections settings into the connections_lists
 * collection settings bucket.
 *
 * @param {object} env - Smart Env instance provided to the plugin.
 * @returns {boolean} true when any value was migrated.
 */
export function migrate_connections_lists_settings(env) {
  const settings = env?.settings;
  if (!settings) return false;

  const legacy = settings.connections_pro;
  if (!legacy) return false;

  const target = settings.connections_lists ||= {};
  let migrated = false;

  for (const key of MIGRATED_SETTING_KEYS) {
    if (!(key in legacy)) continue;
    if (!(key in target)) {
      target[key] = legacy[key];
      migrated = true;
    }
    delete legacy[key];
  }

  if ('rank_model' in legacy) {
    if (!target.actions) target.actions = {};
    if (!('rank_connections' in target.actions)) {
      target.actions.rank_connections = legacy.rank_model;
      migrated = true;
    }
    delete legacy.rank_model;
  }

  return migrated;
}

export default migrate_connections_lists_settings;
