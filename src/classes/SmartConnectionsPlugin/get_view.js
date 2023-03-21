const { SMART_CONNECTIONS_VIEW_TYPE } = require( "./../../json/constants.json" );

// set module export to be a function to support dependency injection
module.exports = function injectMethod( SmartConnectionsView, modifyMe ){

  // set the get_view method
  modifyMe.prototype.get_view = function() {
    for (let leaf of this.app.workspace.getLeavesOfType(SMART_CONNECTIONS_VIEW_TYPE)) {
      if (leaf.view instanceof SmartConnectionsView) {
        return leaf.view;
      }
    }
  }

  // inject function returns nothing, it just modifies the class

}