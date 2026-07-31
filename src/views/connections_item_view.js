import { SmartItemView } from 'obsidian-smart-env/views/smart_item_view.js';
export class ConnectionsItemView extends SmartItemView {
  static get view_type() { return 'smart-connections-view'; }
  static get display_text() { return 'Connections'; }
  static get icon_name() { return 'smart-connections'; }
  static get register_open_command() { return false; }

  constructor(leaf, plugin) {
    super(leaf, plugin);
    this.paused = false;
    this.pause_controls = null;
    this.current = null;
  }

  /**
   * Set whether this view follows the active source.
   * @param {boolean} paused
   * @returns {boolean}
   */
  set_paused(paused) {
    this.paused = Boolean(paused);
    this.pause_controls?.update?.(this.paused);
    return this.paused;
  }

  /**
   * Toggle active-source following and refresh the active target when resumed.
   * @param {object} [params={}]
   * @param {string} [params.event_source]
   * @returns {Promise<boolean>} The new paused state.
   */
  async toggle_paused(params = {}) {
    const paused = this.set_paused(!this.paused);
    if (paused) return paused;

    const active_path = this.plugin.app.workspace.getActiveFile()?.path;
    if (!active_path) return paused;

    const active_item = this.env.smart_sources.get(active_path);
    if (active_item) {
      await this.render_target(active_item, {
        force: true,
        event_source: params.event_source,
      });
    }

    return paused;
  }

  /**
   * Pause active-source following and render an explicit target.
   * @param {object} target_item
   * @param {object} [params={}]
   * @returns {Promise<boolean>}
   */
  async select_target(target_item, params = {}) {
    if (!target_item) return false;

    this.set_paused(true);
    return await this.render_target(target_item, {
      ...params,
      force: true,
    });
  }

  /**
   * Render one Connections target through the view lifecycle.
   * @param {object} [target_item=this.current]
   * @param {object} [params={}]
   * @returns {Promise<boolean>}
   */
  async render_target(target_item = this.current, params = {}) {
    if (!target_item) return false;

    await this.render_view({
      ...params,
      connections_item: target_item,
    });
    return true;
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
      if (handle_current_source_debounce) window.clearTimeout(handle_current_source_debounce);
      handle_current_source_debounce = window.setTimeout(() => {
        this.render_target(connections_item);
      }, 250); // debounce interval (ms)
    });
    register_env_event_listener(this, 'settings:changed', (event) => {
      if(event.path?.includes('expanded_view')) return;
      if(event.path?.includes('connections_lists') && is_visible(this.container)){
        this.render_target();
      }
    });
    register_env_event_listener(this, 'connections:show', (event) => {
      // console.log('connections:show event received', {event});
      if(event.collection_key && event.item_key){
        const collection = this.env[event.collection_key];
        const item = collection.get(event.item_key);
        // console.log({collection, item});
        if(item){
          this.select_target(item, {
            event_source: event.event_source || 'connections:show',
          });
        }
      }
    });
    register_env_event_listener(this, 'items:embedded', (event = {}) => {
      if(
        event.collection_key === this.current?.collection_key
        && event.keys?.includes(this.current?.key)
        && is_visible(this.container)
      ){
        this.render_target();
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
    // console.log('Connections container is not visible');
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
