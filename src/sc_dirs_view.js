import { SmartEntitiesView } from "./smart_entities_view.js";

export class ScDirsView extends SmartEntitiesView {
  static get view_type() { return "smart-directories-view"; }
  static get display_text() { return "Smart Directories"; }
  static get icon_name() { return "folder"; }

  async render_view(container=this.container) {
    this.container.empty();
    await this.env.smart_directories.render_directories(container, {
      add_result_listeners: this.add_result_listeners.bind(this),
      attribution: this.attribution,
      refresh_view: this.render_view.bind(this),
    });
  }
}