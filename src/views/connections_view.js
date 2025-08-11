import { SmartObsidianView } from './smart_view.obsidian.js';
import { Platform } from 'obsidian';

export class ConnectionsView extends SmartObsidianView {
  static get view_type() { return 'smart-connections-view'; }
  static get display_text() { return 'Connections'; }
  static get icon_name() { return 'smart-connections'; }

  register_plugin_events() {
    this.plugin.registerEvent(
      this.app.workspace.on('file-open', (file) => file && this.render_view(file.path))
    );
    this.plugin.registerEvent(this.app.workspace.on('active-leaf-change', (leaf) => {
      if (leaf.view instanceof this.constructor) {
        if (!this.container) return console.log("Connections view event: active-leaf-change: no container, skipping");
        if ((typeof this.container.checkVisibility === 'function') && (this.container.checkVisibility() === false)) {
          return console.log("Connections view event: active-leaf-change: not visible, skipping");
        }
        if(Platform.isMobile && this.plugin.app.workspace.activeLeaf.view.constructor.view_type === this.constructor.view_type) {
          this.render_view();
          return;
        }
      }
    }));
  }

  /* ------------------------------------------------------------------ */
  async render_view(target = null, container = this.container) {
    if (container.checkVisibility?.() === false) return;
    if (!target) target = this.app.workspace.getActiveFile()?.path;
    if (!target) {
      container.empty();
      container.createEl('p', { text: 'No active file to render connections.' });
      return;
    }
    const target_key = typeof target === 'string'
      ? target
      : target.key ?? target.path
    ;
    if (!target_key) {
      container.empty();
      let msg = 'No valid target key provided.';
      if (target && typeof target === 'object') {
        msg += ` Received target object: ${JSON.stringify(target)}`;
      }
      container.createEl('p', { text: msg });
      return;
    }
    let entity;
    const is_block = target_key.includes('#');
    if(is_block) {
      entity = this.env.smart_blocks.get(target_key);
      if(!entity) {
        console.warn("ConnectionsView: No entity found for block: " + target_key);
        const source_key = target_key.split('#')[0];
        const source = this.env.smart_sources.get(source_key);
        if(source) {
          return this.render_view(source, container);
        } else {
          container.empty();
          container.createEl('p', { text: 'No block or source found for "' + target_key + '".' });
          return;
        }
      }
    }else{
      entity = this.env.smart_sources.get(target_key);
      if(!entity) {
        console.warn("ConnectionsView: No entity found for source: " + target_key);
        const source = this.env.smart_sources.init_file_path(target_key);
        if(source) {
          this.env.queue_source_re_import(source);
          container.empty();
          container.createEl('p', { text: 'Source not found, but initialized. Requires embedding.' });
          container.createEl('button', {
            text: 'Embed now',
          }).addEventListener('click', async () => {
            await this.env.run_re_import();
            this.render_view(source, container);
          });
          return;
        }else{
          container.empty();
          container.createEl('p', { text: 'No source found for "' + target_key + '". Unable to import. Check Smart Environment exclusion settings.' });
          return;
        }
      }
    }

    // This should be unreachable (remove in future 2025-07-15)
    if (!entity) {
      container.empty();
      container.createEl('p', { text: 'No entity found for the current note.' });
      return;
    }

    const frag = await this.env.render_component('connections', entity, {
      attribution: this.attribution,
      view: this /* hand back reference for heavy refresh */
    });

    container.empty();
    container.appendChild(frag);
  }

  /* ------------------------------------------------------------------ */
  async refresh() {
    const key = this.container.querySelector('.sc-list')?.dataset.key;
    if (!key) return;
    const entity = this.env.smart_sources.get(key);
    if (!entity) return;
    await entity.read();
    entity.queue_import();
    await entity.collection.process_source_import_queue();
    this.render_view(entity.key);
  }

}
