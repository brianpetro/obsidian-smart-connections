// set module export to be a function to support dependency injection
module.exports = function injectMethod( crypto, modifyMe ){

  // inject this method: 
  modifyMe.prototype.get_embed_hash = function(embed_input) {
    /**
     * TODO remove more/all whitespace from embed_input
     * - all newlines
     * - all tabs
     * - all spaces?
     */
    // trim excess whitespace
    embed_input = embed_input.trim();
    return crypto.createHash('md5').update(embed_input).digest("hex");
  }
    
  // inject function returns nothing, it just modifies the class

}