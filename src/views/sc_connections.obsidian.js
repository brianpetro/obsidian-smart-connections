import { SmartObsidianView } from "./smart_view.obsidian.js";

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
        this.render_view();
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

    const results = await entity.find_connections({ 
      ...opts, 
      exclude_source_connections: entity.env.smart_blocks.settings.embed_blocks 
    });
    
    const results_frag = await entity.env.render_component('connections_results', results, opts);
    
    // Clear and update results container
    this.results_container.innerHTML = '';
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
    if (container.checkVisibility() === false) return console.log("View inactive, skipping render nearest");
    
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
      console.log("Creating entity for current file", current_file.path);
      this.env.smart_sources.fs.include_file(current_file.path);
      entity = this.env.smart_sources.init_file_path(current_file.path);
      await entity.import();
      await entity.collection.process_embed_queue();
    }
    if (!entity){
      return this.plugin.notices.show("no entity", "No entity found for key: " + key);
    }
    
    if(entity.excluded) return this.plugin.notices.show("excluded", "Cannot show Smart Connections for excluded entity: " + entity.key);
    if(!entity.vec && entity.should_embed) {
      entity.queue_embed();
      await entity.collection.process_embed_queue();
    }
    
    // Handle PDF special case
    if(entity.collection_key === "smart_sources" && entity?.path?.endsWith(".pdf")){
      const page_number = this.app.workspace.getActiveFileView().contentEl.firstChild.firstChild.children[8].value;
      if(!["1", 1].includes(page_number)){ // skip page 1
        const page_block = entity.blocks?.find(b => b.sub_key.includes(`age ${page_number}`));
        if(page_block){
          return await this.render_view(page_block);
        }
      }
    }

    // Check if we need to re-render the whole view
    if (!this.results_container || this.current_context !== entity?.key) {
      this.current_context = entity?.key;
      

      // Render full connections view
      const frag = await entity.env.render_component(this.main_component_key, this, this.main_components_opts);
      container.empty();
      container.appendChild(frag);
      
      // Render initial results
      await this.render_results(entity, this.main_components_opts);
    } else {
      // Just update results if container exists
      await this.render_results(entity, this.main_components_opts);
    }
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
      await entity.import();
      await entity.collection.process_embed_queue();
    }
    this.re_render();
  }
  re_render() {
    console.log("re_render");
    this.env.connections_cache = {}; // clear cache
    this.current_context = null;
    this.render_view();
  }

}

function post_process_note_inspect_opener(view, frag, opts = {}) {
  frag.querySelectorAll(".sc-context").forEach(el => {
    el.addEventListener("click", (event) => {
      const entity = view.env.smart_sources.get(event.currentTarget.dataset.key);
      if(entity){
        new SmartNoteInspectModal(view.env, entity).open();
      }
    });
  });
  return frag;
}

import { Modal } from "obsidian";
export class SmartNoteInspectModal extends Modal {
  constructor(env, entity) {
    super(env.smart_connections_plugin.app);
    this.entity = entity;
    this.env = env;
    this.template = this.env.opts.templates["smart_note_inspect"];
    this.ejs = this.env.ejs;
  }
  onOpen() {
    this.titleEl.innerText = this.entity.key;
    this.render();
  }
  async render() {
    const html = await this.ejs.render(this.template, { note: this.entity }, { async: true });
    // console.log(html);
    this.contentEl.innerHTML = html;
  }
}