import { SmartObsidianView } from "./smart_view.obsidian.js";
import { Platform } from "obsidian";
import { SmartNoteInspectModal } from "obsidian-smart-env/views/source_inspector.js";

/**
 * @deprecated Use `ConnectionsView` instead.
 */
export class ScConnectionsView extends SmartObsidianView {
  static get view_type() { return "smart-connections-view"; }
  static get display_text() { return "Smart Connections"; }
  static get icon_name() { return "smart-connections"; }
  main_component_key = "connections";


  register_plugin_events() {
    this.plugin.registerEvent(this.app.workspace.on('file-open', (file) => {
      if (!file) return;
      this.render_view(file?.path);
    }));

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

  async render_results(entity, opts = {}) {
    if (!this.results_container) return;
    this.entities_count_elm = this.header_container.querySelector('.sc-context');
    this.entities_count_elm.innerText = `${this.env.smart_sources.keys.length} (${this.env.smart_blocks.keys.length})`;
    this.status_elm = this.footer_container.querySelector('.sc-context');
    this.status_elm.innerText = "Loading...";
    
    // set context keys
    this.entities_count_elm.dataset.key = entity.key;
    this.status_elm.dataset.key = entity.key;
    const exclude_keys = Object.keys(entity.data.hidden_connections || {});

    const results = await entity.find_connections({
      ...opts,
      exclude_keys,
    });
    
    const results_frag = await entity.env.render_component('connections_results', results, opts);
    
    // Clear and update results container
    this.env.smart_view.empty(this.results_container);
    Array.from(results_frag.children).forEach((elm) => {
      this.results_container.appendChild(elm);
    });
    this.results_container.dataset.key = entity.key;
    const context_name = (entity.path).split('/').pop();
    this.status_elm.innerText = context_name;
    return results;
  }
  
  main_components_opts = {
    attribution: this.attribution,
    post_process: async (scope, frag, opts={}) => {
      return post_process_note_inspect_opener(scope, frag, opts);
    }
  };
  async render_view(entity=null, container=this.container) {
    if (container.checkVisibility() === false) return console.log("render_view: View inactive, skipping render nearest");
    // immediately render the main component if not already present
    if(!container.querySelector('.sc-list')) {
      await this.render_main_component(container);
    }
    let current_file;
    if (!entity) {
      current_file = this.app.workspace.getActiveFile();
      if (current_file) entity = current_file?.path;
    }
    
    let key = null;
    if (typeof entity === "string") {
      const collection = entity.includes("#") ? this.env.smart_blocks : this.env.smart_sources;
      key = entity;
      entity = collection.get(key);
    }
    
    if(!entity && current_file){
      console.log("Creating entity for current file " + current_file.path);
      entity = this.env.smart_sources.init_file_path(current_file.path);
      if(!entity) {
        this.env.events?.emit('source:init_failed', { key: current_file.path });
        this.plugin.notices.show("unable_to_init_source", {key: current_file.path});
        return;
      }
      await entity.import();
      await entity.collection.process_embed_queue();
    }
    if (!entity){
      const list_container = container.querySelector('.sc-list');
      if(list_container){
        list_container.empty();
        list_container.createEl('p', { text: 'No entity found for the current note: ' + key });
        list_container.createEl('em', { text: 'Click the refresh button to create entity for the note.' });
      }
      return;
    }
    
    if(entity.excluded) {
      this.env.events?.emit('item:excluded', { entity_key: entity.key });
      this.plugin.notices.show("item_excluded", {entity_key: entity.key});
      return;
    }
    if(!entity.vec && entity.should_embed) {
      entity.queue_embed();
      await entity.collection.process_embed_queue();
    }

    // Check if we need to re-render the whole view
    if (!this.results_container || this.current_context !== entity?.key) {
      this.current_context = entity?.key;

      // Render full connections view
      await this.render_main_component(container);
      
      // Render initial results
      await this.render_results(entity, this.main_components_opts);
    } else {
      // Just update results if container exists
      await this.render_results(entity, this.main_components_opts);
    }
  }
  async render_main_component(container) {
    const frag = await this.env.render_component(this.main_component_key, this, this.main_components_opts);
    container.empty();
    container.appendChild(frag);
  }

  get results_container() {
    return this.container.querySelector('.sc-list');
  }
  get header_container() {
    return this.container.querySelector('.sc-top-bar');
  }
  get footer_container() {
    return this.container.querySelector('.sc-bottom-bar');
  }

  async refresh() {
    // clear .sc-list and add refreshing message
    this.results_container.empty();
    this.results_container.createEl('p', { text: 'Refreshing...' });
    // get data-key from .sc-list
    const key = this.results_container.dataset.key;
    // get entity
    const entity = this.env.smart_sources.get(key);
    if(entity){
      await entity.read(); // updates last_read.hash to detect changes (if should import)
      entity.queue_import();
      await entity.collection.process_source_import_queue();
    }
    this.re_render();
  }
  re_render() {
    console.log("re_render");
    this.env.connections_cache = {}; // clear cache
    this.current_context = null;
    this.render_view();
  }

  async open_settings() {
    // console.log('Smart Connections: Opening settings');
    await this.app.setting.open();
    await this.app.setting.openTabById('smart-connections');
  }

}

function post_process_note_inspect_opener(view, frag, opts = {}) {
  frag.querySelectorAll(".sc-context").forEach(el => {
    el.addEventListener("click", (event) => {
      const entity = view.env.smart_sources.get(event.currentTarget.dataset.key);
      if(entity){
        new SmartNoteInspectModal(view.plugin, entity).open();
      }
    });
  });
  return frag;
}

