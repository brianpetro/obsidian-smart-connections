// set module export to be a function to support dependency injection
module.exports = function injectMethod( modifyMe ){

  // inject this method: 
  modifyMe.prototype.log_exclusion = function (exclusion) {
    // increment render_log for skipped file
    this.render_log.exclusions_logs[exclusion] = (this.render_log.exclusions_logs[exclusion] || 0) + 1;
  }
    
  // inject function returns nothing, it just modifies the class

}