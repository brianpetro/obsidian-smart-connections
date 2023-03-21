const { SMART_CONNECTIONS_VIEW_TYPE } = require( "./../../json/constants.json" );

// set module export to be a function to support dependency injection
module.exports = function injectMethod( modifyMe ){

  // set the open_view method
  modifyMe.prototype.open_view = async function() {
    this.app.workspace.detachLeavesOfType(SMART_CONNECTIONS_VIEW_TYPE);
    await this.app.workspace.getRightLeaf(false).setViewState({
      type: SMART_CONNECTIONS_VIEW_TYPE,
      active: true,
    });
    this.app.workspace.revealLeaf(
      this.app.workspace.getLeavesOfType(SMART_CONNECTIONS_VIEW_TYPE)[0]
    );
  }

  // inject function returns nothing, it just modifies the class

}