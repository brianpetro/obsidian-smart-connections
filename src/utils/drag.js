import { parse_item_key_to_wikilink } from "obsidian-smart-env/utils/parse_item_key_to_wikilink";

export function handle_drag_result(app, event, key){
  const drag_manager = app.dragManager;
  const link_text = parse_item_key_to_wikilink(key);
  const drag_data = drag_manager.dragLink(event, link_text);
  drag_manager.onDragStart(event, drag_data);
}
