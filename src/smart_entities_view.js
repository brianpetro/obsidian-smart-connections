import { SmartObsidianView2 } from "./smart_obsidian_view2.js";

export class SmartEntitiesView extends SmartObsidianView2 {
  add_result_listeners(elm) {
    this.plugin.add_result_listeners(elm, this.constructor.view_type);
  }
}