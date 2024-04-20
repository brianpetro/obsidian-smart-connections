async function open_note(plugin, target_path, event=null) {
  let targetFile;
  let heading;
  // if has # and is last character, remove it
  if (target_path[target_path.length - 1] === "#") target_path = target_path.slice(0, -1);
  if (target_path.indexOf("#") > -1) {
    targetFile = plugin.app.metadataCache.getFirstLinkpathDest(target_path.split("#")[0], ""); // remove after # from link
    // console.log(targetFile);
    const target_file_cache = plugin.app.metadataCache.getFileCache(targetFile);
    // console.log(target_file_cache);
    let heading_text = target_path.split("#").pop(); // get heading
    // if heading text contains a curly brace, get the number inside the curly braces as occurence
    let occurence = 0;
    if (heading_text.indexOf("{") > -1) {
      // get occurence
      occurence = parseInt(heading_text.split("{")[1].split("}")[0]);
      // remove occurence from heading text
      heading_text = heading_text.split("{")[0];
    }
    const headings = target_file_cache.headings; // get headings from file cache
    // get headings with the same depth and text as the link
    for(let i = 0; i < headings.length; i++) {
      if (headings[i].heading === heading_text) {
        // if occurence is 0, set heading and break
        if(occurence === 0) {
          heading = headings[i];
          break;
        }
        occurence--; // decrement occurence
      }
    }
    // console.log(heading);
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
  if (heading) {
    let { editor } = leaf.view;
    const pos = { line: heading.position.start.line, ch: 0 };
    editor.setCursor(pos);
    editor.scrollIntoView({ to: pos, from: pos }, true);
  }
}
exports.open_note = open_note;