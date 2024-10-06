import { SmartEntitiesView } from "./smart_entities_view.js";
import { render as render_search } from "./components/search.js";

export class ScSearchView extends SmartEntitiesView {
  static get view_type() { return "smart-search-view"; }
  static get display_text() { return "Smart Search"; }
  static get icon_name() { return "search"; }

  async render_view() {
    this.container.innerHTML = 'Loading search...';
    const frag = await render_search.call(this.smart_view, this.env, {
      collection_key: "smart_sources", // TODO: make it configurable which collection to search
      add_result_listeners: this.add_result_listeners.bind(this),
      attribution: this.attribution,
    });
    this.container.innerHTML = '';
    this.container.appendChild(frag);
  }
}
