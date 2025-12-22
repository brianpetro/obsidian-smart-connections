import { SmartItemView } from 'obsidian-smart-env/views/smart_item_view.js';
import { apply_pause_state, toggle_pause_state } from '../utils/pause_controls.js';
export class ConnectionsItemView extends SmartItemView {
  static get view_type() { return 'smart-connections-view'; }
  static get display_text() { return 'Connections'; }
  static get icon_name() { return 'smart-connections'; }

  constructor(leaf, plugin) {
    super(leaf, plugin);
    this.paused = false;
    this.pause_controls = null;
    this.current = null;
  }

  async render_view(params = {}, container = this.container) {
    if(!params.connections_item) {
      const active_path = this.plugin.app.workspace.getActiveFile()?.path;
      params.connections_item = this.env.smart_sources.get(active_path);
    }
    this.current = params.connections_item;
    this.pause_controls = null;
    const frag = await this.env.smart_components.render_component('connections_view_v3', this, {
      connections_item: params.connections_item,
    });
    container.empty();
    container.appendChild(frag);
    this.register_env_listeners();
    this.env.events.emit('connections:opened')
  }

  async open_settings(){
    await this.app.setting.open();
    await this.app.setting.openTabById(this.plugin.manifest.id);
  }

  register_env_listeners() {
    // Added debounce
    let handle_current_source_debounce;
    register_env_event_listener(this, 'sources:opened', (event = {}) => {
      if (this.paused) return;
      if (!is_visible(this.container)) return;
      const connections_item = this.env[event.collection_key || 'smart_sources']?.get(event.item_key || event.key);
      if (connections_item.key === this.current?.key) return;
      if (handle_current_source_debounce) clearTimeout(handle_current_source_debounce);
      handle_current_source_debounce = setTimeout(() => {
        this.render_view({connections_item});
      }, 250); // debounce interval (ms)
    });
    register_env_event_listener(this, 'settings:changed', (event) => {
      if(event.path?.includes('expanded_view')) return;
      if(event.path?.includes('connections_lists') && is_visible(this.container)){
        this.render_view({connections_item: this.current});
      }
    });
    register_env_event_listener(this, 'connections:show', (event) => {
      console.log('connections:show event received', {event});
      if(event.collection_key && event.item_key){
        const collection = this.env[event.collection_key];
        const item = collection.get(event.item_key);
        console.log({collection, item});
        if(item){
          this.set_connections_paused(true);
          this.render_view({connections_item: item});
        }
      }
    });
    register_env_event_listener(this, 'item:embedded', (event) => {
      if(event.item_key === this.current?.key && is_visible(this.container)){
        this.render_view({connections_item: this.current});
      }
    });
  }

  /**
   * Register UI controls for reflecting pause state.
   * @param {{ update: (paused: boolean) => void }} controls
   */
  register_pause_controls(controls) {
    this.pause_controls = controls;
    this.pause_controls?.update(this.paused);
  }

  /**
   * Set the paused state and sync UI controls.
   * @param {boolean} paused
   * @returns {boolean}
   */
  set_connections_paused(paused) {
    return apply_pause_state(this, paused);
  }

  /**
   * Toggle the paused state and sync UI controls.
   * @returns {boolean}
   */
  toggle_connections_paused() {
    return toggle_pause_state(this);
  }
}

function is_visible(container) {
  if(!container) {
    return false;
  }
  if(!container.isConnected) {
    console.warn('Connections container is not connected to DOM');
    return false;
  }
  if(typeof container.checkVisibility === 'function' && container.checkVisibility() === false) {
    console.log('Connections container is not visible');
    return false;
  }
  return true;
}

const view_event_registry = new WeakMap();

const get_registry = (view) => {
  if (!view_event_registry.has(view)) {
    view_event_registry.set(view, new Map());
  }
  return view_event_registry.get(view);
};

export const register_env_event_listener = (view, event_key, callback) => {
  if (!view || typeof view.env?.events?.on !== 'function') {
    console.warn('View or event system not available for registering event listener');
    return () => {};
  }

  const registry = get_registry(view);
  const previous_dispose = registry.get(event_key);
  if (typeof previous_dispose === 'function') {
    previous_dispose();
  }

  const off = view.env.events.on(event_key, (event) => {
    callback(event);
  });

  let active = true;
  const dispose = () => {
    if (!active) return;
    active = false;
    off?.();
    if (registry.get(event_key) === dispose) {
      registry.delete(event_key);
    }
  };

  registry.set(event_key, dispose);

  if (typeof view.register === 'function') {
    view.register(() => dispose());
  }

  return dispose;
};
