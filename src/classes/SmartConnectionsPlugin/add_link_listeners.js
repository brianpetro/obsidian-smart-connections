const { SMART_CONNECTIONS_VIEW_TYPE } = require( "./json/constants.json" );

// set module export to be a function to support dependency injection
module.exports = function injectMethod( modifyMe ){

  // inject this method: 
  modifyMe.prototype.add_link_listeners = function(item, curr, list) {
    item.addEventListener("click", async (event) => {
      await this.handle_click(curr, event);
    });
    // drag-on
    // currently only works with full-file links
    item.setAttr('draggable', 'true');
    item.addEventListener('dragstart', (event) => {
      const dragManager = this.app.dragManager;
      const file_path = curr.link.split("#")[0];
      const file = this.app.metadataCache.getFirstLinkpathDest(file_path, '');
      const dragData = dragManager.dragFile(event, file);
      // console.log(dragData);
      dragManager.onDragStart(event, dragData);
    });
    // if curr.link contains curly braces, return (incompatible with hover-link)
    if (curr.link.indexOf("{") > -1) return;
    // trigger hover event on link
    item.addEventListener("mouseover", (event) => {
      this.app.workspace.trigger("hover-link", {
        event,
        source: SMART_CONNECTIONS_VIEW_TYPE,
        hoverParent: list,
        targetEl: item,
        linktext: curr.link,
      });
    });
  }
    
  // inject function returns nothing, it just modifies the class

}