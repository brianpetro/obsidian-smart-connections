import { load_component } from './presentation_surface.js';
import { migrate_connections_display_settings } from '../../migrations/migrate_connections_display_settings.js';
import { migrate_hidden_connections_collection } from '../../migrations/migrate_hidden_connections.js';

/** Real Base plugin initialization with explicit simulated Obsidian capabilities. */
export function create_plugin_fixture(env, wait_for = async () => {}) {
  const calls = [];
  const { SmartConnectionsPlugin } = load_component(new URL('../../src/main.js', import.meta.url), ['SmartConnectionsPlugin'], {
    Obsidian: {},
    SmartPlugin: class {},
    SmartEnv: { wait_for },
    ReleaseNotesView: class {},
    ScEarlySettingsTab: class {},
    ConnectionsFooterView: class {},
    connections_footer_plugin: {},
    register_smart_connections_codeblock() { calls.push('codeblock'); },
    migrate_connections_display_settings(...args) {
      calls.push('display_migration');
      migrate_connections_display_settings(...args);
    },
    migrate_hidden_connections_collection(...args) {
      calls.push('hidden_migration');
      migrate_hidden_connections_collection(...args);
    },
  });
  const plugin = new SmartConnectionsPlugin();
  Object.assign(plugin, {
    env,
    is_new_user: async () => false,
    register_ribbon_actions() {},
    register_command_actions() { calls.push('commands'); },
    wrap_connections_view_open() {},
    apply_connections_view_location() { calls.push('view'); },
    register_connections_view_location_listener() {},
    registerEditorExtension() {},
    toggled_footer_connections() { calls.push('footer'); },
    check_for_updates: async () => {},
  });
  return { plugin, calls };
}
