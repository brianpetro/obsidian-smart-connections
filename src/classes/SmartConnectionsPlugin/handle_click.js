// set module export to be a function to support dependency injection
module.exports = function injectMethod( Obsidian, modifyMe ){

  // inject this method: 
  modifyMe.prototype.handle_click = async function(curr, event) {
    let targetFile;
    let heading;
    if (curr.link.indexOf("#") > -1) {
      // remove after # from link
      targetFile = this.app.metadataCache.getFirstLinkpathDest(curr.link.split("#")[0], "");
      // console.log(targetFile);
      const target_file_cache = this.app.metadataCache.getFileCache(targetFile);
      // console.log(target_file_cache);
      // get heading
      let heading_text = curr.link.split("#").pop();
      // if heading text contains a curly brace, get the number inside the curly braces as occurence
      let occurence = 0;
      if (heading_text.indexOf("{") > -1) {
        // get occurence
        occurence = parseInt(heading_text.split("{")[1].split("}")[0]);
        // remove occurence from heading text
        heading_text = heading_text.split("{")[0];
      }
      // get headings from file cache
      const headings = target_file_cache.headings;
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
      targetFile = this.app.metadataCache.getFirstLinkpathDest(curr.link, "");
    }
    // properly handle if the meta/ctrl key is pressed
    const mod = Obsidian.Keymap.isModEvent(event);
    // get most recent leaf
    let leaf = this.app.workspace.getLeaf(mod);
    await leaf.openFile(targetFile);
    if (heading) {
      let { editor } = leaf.view;
      const pos = { line: heading.position.start.line, ch: 0 };
      editor.setCursor(pos);
      editor.scrollIntoView({ to: pos, from: pos }, true);
    }
  }
    
  // inject function returns nothing, it just modifies the class

}