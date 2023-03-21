// set module export to be a function to support dependency injection
module.exports = function injectMethod( modifyMe ){

  // set the saveSettings method
  modifyMe.prototype.saveSettings = async function(rerender=false) {
    await this.saveData(this.settings);
    // re-load settings into memory
    await this.loadSettings();
    // re-render view if set to true (for example, after adding API key)
    if(rerender) {
      this.nearest_cache = {};
      await this.make_connections();
    }
  }

  // function returns nothing, it just modifies the class

}