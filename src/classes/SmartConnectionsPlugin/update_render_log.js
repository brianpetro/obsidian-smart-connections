// set module export to be a function to support dependency injection
module.exports = function injectMethod( modifyMe ){

  // inject this method: 
  modifyMe.prototype.update_render_log = function(blocks, file_embed_input) {
    if (blocks.length > 0) {
      // multiply by 2 because implies we saved token spending on blocks(sections), too
      this.render_log.tokens_saved_by_cache += file_embed_input.length / 2;
    } else {
      // calc tokens saved by cache: divide by 4 for token estimate
      this.render_log.tokens_saved_by_cache += file_embed_input.length / 4;
    }
  }
    
  // inject function returns nothing, it just modifies the class

}