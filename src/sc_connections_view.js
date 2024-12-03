import { SmartEntitiesView } from "./smart_entities_view.js";

export class ScConnectionsView extends SmartEntitiesView {
  static get view_type() { return "smart-connections-view"; }
  static get display_text() { return "Smart Connections"; }
  static get icon_name() { return "smart-connections"; }

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

  async render_view(entity=null, container=this.container) {
    if (container.checkVisibility() === false) return console.log("View inactive, skipping render nearest");
    if (!entity){
      const current_file = this.app.workspace.getActiveFile();
      if (current_file) entity = current_file?.path;
    }
    let key = null;
    if (typeof entity === "string") {
      const collection = entity.includes("#") ? this.env.smart_blocks : this.env.smart_sources;
      key = entity;
      entity = collection.get(key);
    }
    if (!entity) return this.plugin.notices.show("no entity", "No entity found for key: " + key);
    // if path ends with .pdf
    if(entity.collection_key === "smart_sources" && entity?.path?.endsWith(".pdf")){
      const page_number = this.app.workspace.getActiveFileView().contentEl.firstChild.firstChild.children[8].value;
      if(!["1", 1].includes(page_number)){ // skip page 1
        const page_block = entity.blocks?.find(b => b.sub_key.includes(`age ${page_number}`));
        if(page_block){
          return await this.render_view(page_block);
        }
      }
    }
    if(this.current_context === entity?.key) return; // already rendered
    this.current_context = entity?.key;

    await entity.render_connections(container, {
      add_result_listeners: this.add_result_listeners.bind(this),
      attribution: this.attribution,
      refresh_smart_view: this.refresh_smart_view.bind(this),
      open_lookup_view: this.plugin.open_lookup_view.bind(this.plugin),
    });

    this.add_top_bar_listeners();
  }

  refresh_smart_view() {
    console.log("refresh_smart_view");
    this.env.connections_cache = {}; // clear cache
    this.current_context = null;
    this.render_view();
  }

  add_top_bar_listeners() {
    const container = this.container;


    container.querySelectorAll(".sc-context").forEach(el => {
      const entity = this.env.smart_sources.get(el.dataset.key);
      if(entity){
        el.addEventListener("click", () => {
          new SmartNoteInspectModal(this.env, entity).open();
        });
      }
    });
  }
}
// function on_open_overlay(overlay_container) {
//   overlay_container.style.transition = "background-color 0.5s ease-in-out";
//   overlay_container.style.backgroundColor = "var(--bold-color)";
//   setTimeout(() => { overlay_container.style.backgroundColor = ""; }, 500);
// }

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