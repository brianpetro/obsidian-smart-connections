import { SmartObsidianView } from './smart_view.obsidian.js';
import { Platform } from 'obsidian';

export class ConnectionsView extends SmartObsidianView {
  static get view_type() { return 'smart-connections-view'; }
  static get display_text() { return 'Smart Connections'; }
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

    let entity = await this.#resolve_entity(target);
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

  /* ------------------------------------------------------------------ */
  async #resolve_entity(input) {
    if (!input) input = this.app.workspace.getActiveFile()?.path;
    if (!input) return null;

    if (typeof input !== 'string') input = input.path ?? '';

    const collection = input.includes('#')
      ? this.env.smart_blocks
      : this.env.smart_sources;

    let entity = collection.get(input);
    if (!entity) {
      collection.fs.include_file(input);
      entity = collection.init_file_path(input);
      if (entity) {
        await entity.import();
        await collection.process_embed_queue();
      }
    }

    if (entity?.should_embed && !entity.vec) {
      entity.queue_embed();
      await collection.process_embed_queue();
    }

    return entity;
  }
}
