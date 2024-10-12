export async function open_note(plugin, target_path, event=null) {
  const env = plugin.env;
  let targetFile;
  let block;
  if(target_path.includes(".pdf#page=")){
    return plugin.app.workspace.openLinkText(target_path, "/");
  }
  if (target_path.endsWith("#")) target_path = target_path.slice(0, -1);
  if (target_path.includes("#")) {
    targetFile = plugin.app.metadataCache.getFirstLinkpathDest(target_path.split("#")[0], ""); // remove after # from link
    block = env.smart_blocks.get(target_path);
  } else {
    targetFile = plugin.app.metadataCache.getFirstLinkpathDest(target_path, "");
  }
  let leaf;
  if(event) {
    const mod = plugin.obsidian.Keymap.isModEvent(event); // properly handle if the meta/ctrl key is pressed
    leaf = plugin.app.workspace.getLeaf(mod); // get most recent leaf
  }else{
    leaf = plugin.app.workspace.getMostRecentLeaf(); // get most recent leaf
  }
  await leaf.openFile(targetFile);
  if(block?.line_start) {
    let { editor } = leaf.view;
    const pos = { line: block.line_start, ch: 0 };
    editor.setCursor(pos);
    editor.scrollIntoView({ to: pos, from: pos }, true);
  }
}