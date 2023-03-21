// set module export to be a function to support dependency injection
module.exports = function injectMethod( modifyMe ){

  // inject this method: 
  modifyMe.prototype.validate_headings = function (block_headings) {
    let valid = true;
    if (this.header_exclusions.length > 0) {
      for (let k = 0; k < this.header_exclusions.length; k++) {
        if (block_headings.indexOf(this.header_exclusions[k]) > -1) {
          valid = false;
          this.log_exclusion("heading: "+this.header_exclusions[k]);
          break;
        }
      }
    }
    return valid;
  }
    
  // inject function returns nothing, it just modifies the class

}