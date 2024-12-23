import { SmartEntitiesView } from "./smart_entities.obsidian.js";

export class ScLookupView extends SmartEntitiesView {
  static get view_type() { return "smart-lookup-view"; }
  static get display_text() { return "Smart Lookup"; }
  static get icon_name() { return "search"; }

  async render_view(query='', container=this.container) {
    container.empty();
    container.createEl('span', {text: 'Loading lookup...'});
    const frag = await this.env.render_component('lookup', this.env.smart_sources, {
      add_result_listeners: this.add_result_listeners.bind(this),
      attribution: this.attribution,
      query,
    });
    if(container) {
      container.empty();
      container.appendChild(frag);
    }
  }
}
