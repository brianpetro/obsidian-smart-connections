import { SmartObsidianView2 } from "./smart_view2.obsidian.js";

export class SmartEntitiesView extends SmartObsidianView2 {
  add_result_listeners(elm) {
    this.plugin.add_result_listeners(elm, this.constructor.view_type);
  }
}