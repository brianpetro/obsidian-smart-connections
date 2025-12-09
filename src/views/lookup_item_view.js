import { SmartItemView } from 'obsidian-smart-env/views/smart_item_view.js';
export class LookupItemView extends SmartItemView {
  static get view_type() { return 'smart-lookup-view'; }
  static get display_text() { return 'Lookup'; }
  static get icon_name() { return 'smart-lookup'; }

  async render_view(lookup_params, container = this.container) {
    const frag = await this.env.render_component('lookup_item_view', this, lookup_params);
    container.empty();
    container.appendChild(frag);
  }
}