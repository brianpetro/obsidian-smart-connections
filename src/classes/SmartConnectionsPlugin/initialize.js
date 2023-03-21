const { VERSION } = require( "./../../json/constants.json" );

// set module export to be a function to support dependency injection
module.exports = function injectMethod( modifyMe ){

  // set the initialize method
  modifyMe.prototype.initialize = async function() {
    // if this settings.view_open is true, open view on startup
    if(this.settings.view_open) {
      this.open_view();
    }
    // on new version
    if(this.settings.version !== VERSION) {
      // update version
      this.settings.version = VERSION;
      // save settings
      await this.saveSettings();
      // open view
      this.open_view();
    }
    this.add_to_gitignore();
  }

  // inject function returns nothing, it just modifies the class

}