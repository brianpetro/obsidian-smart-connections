/**
 * @file connections_footer_view.js
 * @description Renders the Smart Connections footer decoration using the
 */
import { Platform } from 'obsidian';
import { render as render_connections_footer_view_component } from '../components/connections_footer_view.js';
import { set_connections_footer_dom_effect } from './connections_footer_deco.js';

/**
 * Resolve the Smart Sources entity for the active file.
 * @param {object} env
 * @param {object} workspace
 * @returns {object|null}
 */
const get_active_entity = (env, workspace) => {
  const active_file = workspace.getActiveFile();
  if (!active_file) return null;
  return env.smart_sources?.get(active_file.path) || null;
};

/**
 * Determine whether the editor's last line is currently visible in the viewport.
 * Uses CodeMirror 6 visibleRanges to avoid any DOM measurement thrash.
 * @param {import('@codemirror/view').EditorView} editor_view
 * @returns {boolean}
 */
const is_last_line_visible = (editor_view) => {
  try {
    if (!editor_view?.state?.doc) return false;
    const doc = editor_view.state.doc;
    const last_line = doc.line(doc.lines);
    const start = last_line.from;
    const end = last_line.to;
    return (Array.isArray(editor_view.visibleRanges) ? editor_view.visibleRanges : [])
      .some((range) => range.from <= end && range.to >= start);
  } catch (err) {
    console.warn('[Smart Connections] last-line visibility check failed', err);
    return false;
  }
};

const schedule_next_frame = (callback) => {
  if (typeof window.requestAnimationFrame === 'function') {
    window.requestAnimationFrame(callback);
    return;
  }
  window.setTimeout(callback, 0);
};

export class ConnectionsFooterView {
  constructor(plugin) {
    this.plugin = plugin;
    this.app = plugin.app;
    this.register_env_listeners();
    this.container_map = {};
    this._detach_visibility_guard = null;
  }

  get env() {
    return this.plugin.env;
  }

  /**
   * Attach a lightweight scroll/resize guard that waits until the last line becomes visible.
   * When the condition is met, it detaches itself and triggers render_view() again.
   * @param {import('@codemirror/view').EditorView} editor_view
   */
  attach_visibility_guard(editor_view) {
    this.detach_visibility_guard();
    if (!editor_view) return;

    const scroll_target = editor_view.scrollDOM || editor_view.dom || null;
    if (!scroll_target) return;

    let ticking = false;
    const check_and_render = () => {
      if (ticking) return;
      ticking = true;
      schedule_next_frame(() => {
        ticking = false;
        if (is_last_line_visible(editor_view)) {
          this.detach_visibility_guard();
          this.render_view();
        }
      });
    };

    const on_scroll = () => check_and_render();
    const on_resize = () => check_and_render();

    scroll_target.addEventListener('scroll', on_scroll, { passive: true });
    window.addEventListener('resize', on_resize);

    this._detach_visibility_guard = () => {
      try { scroll_target.removeEventListener('scroll', on_scroll); } catch {}
      try { window.removeEventListener('resize', on_resize); } catch {}
      this._detach_visibility_guard = null;
    };
  }

  detach_visibility_guard() {
    if (typeof this._detach_visibility_guard === 'function') {
      this._detach_visibility_guard();
    }
  }

  async render_view() {
    if (!this.env.connections_lists?.settings?.footer_connections) return this.remove();
    const editor_view = this.plugin.get_editor_view();
    if (!editor_view) return;

    // Gate: only render once the last line is visible
    if (!is_last_line_visible(editor_view)) {
      try {
        editor_view.dispatch({ effects: [set_connections_footer_dom_effect.of(null)] });
      } catch (err) {
        console.warn('[Smart Connections] footer hide dispatch failed', err);
      }
      this.attach_visibility_guard(editor_view);
      return;
    }

    this.detach_visibility_guard();

    const entity = get_active_entity(this.env, this.app.workspace);
    if (!entity) {
      editor_view.dispatch({ effects: [set_connections_footer_dom_effect.of(null)] });
      return;
    }

    if (this.container_map[entity.key]?.isConnected) {
      editor_view.dispatch({ effects: [set_connections_footer_dom_effect.of(this.container_map[entity.key])] });
      return;
    }

    const footer_container = await render_connections_footer_view_component.call(
      this.env.smart_view,
      this,
      {
        connections_item: entity,
      }
    );

    if (this.container_map[entity.key] && this.container_map[entity.key] instanceof HTMLElement) {
      this.container_map[entity.key].remove();
    }
    this.container_map[entity.key] = footer_container;
    editor_view.dispatch({ effects: [set_connections_footer_dom_effect.of(footer_container)] });

    if (Platform.isMobile) {
      const container = this.container_map[entity.key];
      const status_bar_container = container.querySelector('.status-bar-mobile')
        ?? container.createDiv({ cls: 'status-bar-mobile' })
      ;
      status_bar_container.empty();
      const status_bar_item = status_bar_container.createDiv({ cls: 'status-bar-item' });
      this.env.smart_components.render_component('status_bar', this.env)
        .then((el) => status_bar_item.appendChild(el))
      ;
    }
  }

  remove() {
    const editor_view = this.plugin.get_editor_view();
    this.detach_visibility_guard();
    if (editor_view) {
      try {
        editor_view.dispatch({ effects: [set_connections_footer_dom_effect.of(null)] });
      } catch (err) {
        console.warn('[Smart Connections] footer remove dispatch failed', err);
      }
    }
  }

  register_env_listeners() {
    let handle_current_source_debounce;
    this.register_env_listener('sources:opened', () => {
      if (handle_current_source_debounce) window.clearTimeout(handle_current_source_debounce);
      handle_current_source_debounce = window.setTimeout(() => {
        this.render_view();
      }, 250);
    });
    this.register_env_listener('settings:changed', (event) => {
      if(event.path?.includes('connections_lists')) {
        this.render_view();
      }
    });
  }

  register_env_listener(event_key, callback) {
    if(!this.env_listeners) this.env_listeners = [];
    this.env_listeners.push(this.env.events.on(event_key, callback));
  }

  async open_settings() {
    await this.app.setting.open();
    await this.app.setting.openTabById(this.plugin.manifest.id);
  }

  unload() {
    this.detach_visibility_guard();
    if (this.env_listeners) {
      this.env_listeners.forEach((off) => off());
      this.env_listeners = [];
    }
  }
}
