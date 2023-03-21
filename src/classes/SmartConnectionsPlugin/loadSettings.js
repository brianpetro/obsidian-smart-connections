// const DEFAULT_SETTINGS = require( "./json/defaults.json" ); - not needed see line 9

// set module export to be a function to support dependency injection
module.exports = function injectMethod( modifyMe ){

  // set the loadSettings method
  modifyMe.prototype.loadSettings = async function() {
    
    /*
    to: @brianpetro
    
    changed your style here to show you one way
    that require( "jsonfile.json" ) could be used
    */
    this.settings = Object.assign(
      {},
      require( "./json/defaults.json" ),
      await this.loadData());
    
    // load file exclusions if not blank
    if(this.settings.file_exclusions && this.settings.file_exclusions.length > 0) {
      // split file exclusions into array and trim whitespace
      this.file_exclusions = this.settings.file_exclusions.split(",").map((file) => {
        return file.trim();
      });
    }
    // load folder exclusions if not blank
    if(this.settings.folder_exclusions && this.settings.folder_exclusions.length > 0) {
      // add slash to end of folder name if not present
      const folder_exclusions = this.settings.folder_exclusions.split(",").map((folder) => {
        // trim whitespace
        folder = folder.trim();
        if(folder.slice(-1) !== "/") {
          return folder + "/";
        } else {
          return folder;
        }
      });
      // merge folder exclusions with file exclusions
      this.file_exclusions = this.file_exclusions.concat(folder_exclusions);
    }
    // load header exclusions if not blank
    if(this.settings.header_exclusions && this.settings.header_exclusions.length > 0) {
      this.header_exclusions = this.settings.header_exclusions.split(",").map((header) => {
        return header.trim();
      });
    }
    // load path_only if not blank
    if(this.settings.path_only && this.settings.path_only.length > 0) {
      this.path_only = this.settings.path_only.split(",").map((path) => {
        return path.trim();
      });
    }
    // load failed files
    await this.load_failed_files();
  }

  // inject function returns nothing, it just modifies the class

}