const { SMART_CONNECTIONS_VIEW_TYPE } = require( "./../../json/constants.json" );

// set module export to be a function to support dependency injection
module.exports = function injectMethod( modifyMe ){

  // inject this method: 
  modifyMe.prototype.onunload = function() {
    this.output_render_log();
    console.log("unloading plugin");
    this.app.workspace.detachLeavesOfType(SMART_CONNECTIONS_VIEW_TYPE);
  }
    
  // inject function returns nothing, it just modifies the class

}