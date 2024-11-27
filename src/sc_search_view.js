import { SmartEntitiesView } from "./smart_entities_view.js";

export class ScSearchView extends SmartEntitiesView {
  static get view_type() { return "smart-search-view"; }
  static get display_text() { return "Smart Search"; }
  static get icon_name() { return "search"; }

  async render_view(search_text='', container=this.container) {
    container.innerHTML = 'Loading search...';
    const frag = await this.env.opts.components.lookup.call(this.smart_view, this.env, {
      collection_key: "smart_sources", // TODO: make it configurable which collection to search
      add_result_listeners: this.add_result_listeners.bind(this),
      attribution: this.attribution,
      search_text,
    });
    container.innerHTML = '';
    container.appendChild(frag);
  }
}
