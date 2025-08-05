import { SmartEnv } from "obsidian-smart-env";
/**
 * Toggles the visibility of a plugin ribbon icon.
 * Integrates settings with Obsidian native hide function.
 */
export async function toggle_plugin_ribbon_icon(plugin, icon_name, show_icon) {
  const icon = plugin.ribbon_icons[icon_name];
  icon.elm = plugin.addRibbonIcon(icon.icon_name, icon.description, icon.callback);
  const ribbon_icon_id = plugin.manifest.id + ":" + icon.description;
  const ribbon_item = plugin.app.workspace.leftRibbon.items.find(i => i.id === ribbon_icon_id);
  await SmartEnv.wait_for({ loaded: true });
  if (!plugin.env.settings.ribbon_icons) plugin.env.settings.ribbon_icons = {};
  if (typeof show_icon === "undefined") {
    if (ribbon_item.hidden) {
      plugin.env.settings.ribbon_icons[icon_name] = false;
    }
    show_icon = plugin.env.settings.ribbon_icons[icon_name];
  } else {
    plugin.env.settings.ribbon_icons[icon_name] = show_icon;
  }
  if (show_icon) {
    ribbon_item.hidden = false;
  } else {
    ribbon_item.hidden = true;
  }
  plugin.app.workspace.leftRibbon.load(plugin.app.workspace.leftRibbon.ribbonItemsEl);
  plugin.app.workspace.saveLayout(); // persit ribbon_item.hidden state
}
