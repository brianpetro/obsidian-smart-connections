/**
 * @file smart_notices.js
 * @description Class for displaying plugin notices, referencing NOTICES from notices.js.
 * Each notice has a `.create(opts)` method (if not already present) which:
 *  1) Merges any {{placeholders}} in the text with opts
 *  2) Uses a default .button if defined in the notice entry (unless opts.button is already set)
 *  3) Allows a default .timeout if defined in the notice entry (unless opts.timeout is set)
 *  4) Returns an object like { text, button, timeout, immutable, confirm } for rendering
 */

import { setIcon } from 'obsidian';
import { NOTICES } from './notices.js';

/**
 * Ensures each notice in NOTICES has a `.create(opts)` method.
 * The default `.create(opts)` method merges placeholders in 'en' plus any .button/.timeout found in the notice entry.
 * Returns an object:
 *   {
 *     text: string,
 *     button?: { text: string, callback: function },
 *     timeout?: number,
 *     immutable?: boolean,
 *     confirm?: { text: string, callback: function },
 *   }
 *
 * That object is used by SmartNotices to build & render the final notice.
 */
export function define_default_create_methods(notices, scope=null) {
  for (const key of Object.keys(notices)) {
    const notice_obj = notices[key];
    if (typeof notice_obj.create !== 'function') {
      notice_obj.create = function (opts = {}) {
        // 1) Merge placeholders in 'en'
        let text = this.en ?? key;
        for (const [k, v] of Object.entries(opts)) {
          text = text.replace(new RegExp(`{{${k}}}`, 'g'), String(v));
        }

        // 2) defaultButton from notice_obj.button if not overridden by opts.button
        let button;
        if (!opts.button && this.button) {
          // if `this.button` is an object { en, callback, ... } use it
          // 'en' text is optional if they want a localized button label
          const btn_label = (typeof this.button.en === 'string') ? this.button.en : 'OK';
          button = {
            text: btn_label,
            callback: (typeof this.button.callback === 'function')
              ? this.button.callback
              : () => {} // no-op
          };
        } else {
          button = opts.button; // user-supplied
        }

        // 3) finalTimeout from notice_obj.timeout or opts.timeout or default
        let final_timeout = opts.timeout ?? this.timeout ?? 5000;

        // 4) build the final object to be returned
        return {
          text,
          button,
          timeout: final_timeout,
          confirm: opts.confirm,       // pass any user-provided confirm
          immutable: opts.immutable,   // pass any user-provided immutable
        };
      };
    }
  }
  return notices;
}

/**
 * Manages user-facing notices for the plugin, with support for:
 *   - Muting notices by key
 *   - Combining default notice config from NOTICES with user-provided opts
 */
export class SmartNotices {
  /**
   * @param {Object} scope - The main plugin instance
   */
  constructor(scope) {
    this.scope = scope;
    this.main = scope; // legacy alias
    this.active = {};
    // Make sure each notice entry has a .create() method
    define_default_create_methods(NOTICES, scope);
  }

  /** plugin settings for notices (muted, etc.) */
  get settings() {
    return this.main.settings.smart_notices;
  }

  /** The adapter used to actually show notices (Obsidian's Notice, etc.) */
  get adapter() {
    return this.main.smart_env_config.modules.smart_notices.adapter;
  }

  /**
   * Displays a notice by key or custom message.
   * Usage:
   *   notices.show('load_env', { scope: this });
   *
   * @param {string} id - The notice key or custom ID
   * @param {object} opts - Additional user opts
   */
  show(id, opts = {}) {
    let message = null;

    // temp backwards compatibility
    if (typeof opts === 'string') {
      message = opts;
    } else {
      opts = opts || {};
    }

    // If no explicit scope is passed, default to this.main
    if (!opts.scope) {
      opts.scope = this.main;
    }

    const normalized_id = this._normalize_notice_key(id);

    // If notice is muted, skip
    if (this.settings?.muted?.[normalized_id]) {
      // If a confirm callback is defined, still run it
      if (opts.confirm?.callback) {
        opts.confirm.callback();
      }
      return;
    }

    // Use the notice's .create(opts) or fallback text
    const notice_entry = NOTICES[id];
    let derived = {
      text: message || id,
      timeout: opts.timeout ?? 5000,
      button: opts.button,
      immutable: opts.immutable,
      confirm: opts.confirm,
    };

    // If we have a notice entry, let its .create(opts) override
    if (notice_entry?.create) {
      const result = notice_entry.create({ ...opts, scope: this.main });
      // if user provided a direct message, override the text from create():
      derived.text = message || result.text;
      derived.timeout = result.timeout;
      derived.button = result.button;
      derived.immutable = result.immutable;
      derived.confirm = result.confirm;
    }

    // Build the fragment
    const content_fragment = this._build_fragment(normalized_id, derived.text, derived);

    // If already active, update
    if (this.active[normalized_id]?.noticeEl?.parentElement) {
      return this.active[normalized_id].setMessage(content_fragment, derived.timeout);
    }

    // Otherwise new notice
    return this._render_notice(normalized_id, content_fragment, derived);
  }

  /**
   * Normalizes the notice key to a safe string.
   */
  _normalize_notice_key(key) {
    return key.replace(/[^a-zA-Z0-9_-]/g, '_');
  }

  /**
   * Creates and tracks the notice instance
   */
  _render_notice(normalized_id, content_fragment, { timeout }) {
    this.active[normalized_id] = new this.adapter(content_fragment, timeout);
    return this.active[normalized_id];
  }

  /**
   * Builds a DocumentFragment with notice text & possible buttons
   */
  _build_fragment(id, text, { button, confirm, immutable }) {
    const frag = document.createDocumentFragment();
    frag.createEl('p', {
      cls: 'sc-notice-head',
      text: `[Smart Connections v${this.main.manifest.version}]`
    });

    const content = frag.createEl('p', { cls: 'sc-notice-content', text });
    const actions = frag.createEl('div', { cls: 'sc-notice-actions' });

    // Add confirm button if passed
    if (confirm?.text && typeof confirm.callback === 'function') {
      this._add_button(confirm, actions);
    }

    // Add default or user button
    if (button?.text && typeof button.callback === 'function') {
      this._add_button(button, actions);
    }

    // Add 'mute' unless immutable
    if (!immutable) {
      this._add_mute_button(id, actions);
    }

    return frag;
  }

  /**
   * Creates a <button> appended to the container
   */
  _add_button(btnConfig, container) {
    const btn = document.createElement('button');
    btn.innerHTML = btnConfig.text;
    btn.addEventListener('click', (e) => {
      if (btnConfig.stay_open) {
        e.preventDefault();
        e.stopPropagation();
      }
      btnConfig.callback?.(this.main);
    });
    container.appendChild(btn);
  }

  /**
   * Mute button
   */
  _add_mute_button(id, container) {
    const btn = document.createElement('button');
    setIcon(btn, 'bell-off');
    btn.addEventListener('click', () => {
      if (!this.settings.muted) this.settings.muted = {};
      this.settings.muted[id] = true;
      // show "notice muted" if that entry is defined
      if (NOTICES['notice muted']) {
        this.show('notice muted', null, { timeout: 2000 });
      }
    });
    container.appendChild(btn);
  }

  /**
   * Hides & clears all active notices
   */
  unload() {
    for (const id in this.active) {
      this.remove(id);
    }
  }

  /**
   * Removes an active notice by key
   */
  remove(id) {
    const normalized_id = this._normalize_notice_key(id);
    this.active[normalized_id]?.hide();
    delete this.active[normalized_id];
  }

}
