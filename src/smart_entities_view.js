import { SmartObsidianView2 } from "./smart_obsidian_view2.js";

export class SmartEntitiesView extends SmartObsidianView2 {
  add_result_listeners(elm) {
    elm.addEventListener("click", this.handle_result_click.bind(this));
    const path = elm.querySelector("li").dataset.key;
    elm.addEventListener('dragstart', (event) => {
      const drag_manager = this.app.dragManager;
      const file_path = path.split("#")[0];
      const file = this.app.metadataCache.getFirstLinkpathDest(file_path, '');
      const drag_data = drag_manager.dragFile(event, file);
      drag_manager.onDragStart(event, drag_data);
    });

    if (path.indexOf("{") === -1) {
      elm.addEventListener("mouseover", (event) => {
        this.app.workspace.trigger("hover-link", {
          event,
          source: this.constructor.view_type,
          hoverParent: elm.parentElement,
          targetEl: elm,
          linktext: path,
        });
      });
    }
  }
  handle_result_click(event) {
    event.preventDefault();
    event.stopPropagation();
    const target = event.target;
    const result = target.closest(".search-result");
    if (target.classList.contains("svg-icon")) {
      this.toggle_result(result);
      return;
    }
    
    const link = result.dataset.link || result.dataset.path;
    if(result.classList.contains("sc-collapsed")){
      if (this.plugin.obsidian.Keymap.isModEvent(event)) {
        console.log("open_note", link);
        this.plugin.open_note(link, event);
      } else {
        this.toggle_result(result);
      }
    } else {
      console.log("open_note", link);
      this.plugin.open_note(link, event);
    }
  }
  async toggle_result(result) {
    result.classList.toggle("sc-collapsed");
    // if li contents is empty, render it
    if(!result.querySelector("li").innerHTML){
      const collection_key = result.dataset.collection;
      const entity = this.env[collection_key].get(result.dataset.path);
      await entity.render_item(result.querySelector("li"));
    }
  }
}