import { SmartEntitiesView } from "./smart_entities_view.js";
import { render as render_connections_component } from "./components/connections.js";
import { render as filter_settings_component } from "./components/smart_view_filter.js";

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

  async render_view(entity=null) {
    if (this.container.checkVisibility() === false) return console.log("View inactive, skipping render nearest");
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

    const frag = await render_connections_component.call(this.smart_view, entity, {
      add_result_listeners: this.add_result_listeners.bind(this),
      attribution: this.attribution,
    });
    this.container.innerHTML = '';
    this.container.appendChild(frag);

    this.add_top_bar_listeners();
  }

  async render_filter_settings() {
    const overlay_container = this.container.querySelector(".sc-overlay");
    if(!overlay_container) throw new Error("Container is required");
    overlay_container.innerHTML = '';
    overlay_container.innerHTML = '<div class="sc-loading">Loading filter settings...</div>';
    const frag = await filter_settings_component.call(this.smart_view, {
      settings: this.env.settings,
      refresh_smart_view: this.refresh_smart_view.bind(this),
      refresh_smart_view_filter: this.refresh_smart_view_filter.bind(this),
    });
    overlay_container.innerHTML = '';
    overlay_container.appendChild(frag);
    this.smart_view.on_open_overlay(overlay_container);
  }
  refresh_smart_view() {
    console.log("refresh_smart_view");
    this.env.connections_cache = {}; // clear cache
    this.current_context = null;
    this.render_view();
  }
  refresh_smart_view_filter() {
    console.log("refresh_smart_view_filter");
    this.render_filter_settings();
  }

  add_top_bar_listeners() {
    const container = this.container;

    container.querySelector(".sc-filter").addEventListener("click", () => {
      this.render_filter_settings();
    });

    container.querySelector(".sc-refresh").addEventListener("click", () => {
      this.refresh_smart_view();
    });

    container.querySelector(".sc-search").addEventListener("click", () => {
      this.plugin.open_search_view();
    });

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