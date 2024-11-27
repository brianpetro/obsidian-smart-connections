import { SmartEntitiesView } from "./smart_entities_view.js";

export class ScLookupView extends SmartEntitiesView {
  static get view_type() { return "smart-search-view"; }
  static get display_text() { return "Smart Search"; }
  static get icon_name() { return "search"; }

  async render_view(search_text='', container=this.container) {
    await this.env.smart_sources.render_lookup(container, {
      add_result_listeners: this.add_result_listeners.bind(this),
      attribution: this.attribution,
      search_text,
    });
  }
}
