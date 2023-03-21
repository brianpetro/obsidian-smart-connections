// set module export to be a function to support dependency injection
module.exports = function injectMethod( modifyMe ){

  // inject this method: 
  modifyMe.prototype.render_block_context = function(block) {
    const block_headings = block.link.split(".md")[1].split("#");
    // starting with the last heading first, iterate through headings
    let block_context = "";
    for (let i = block_headings.length - 1; i >= 0; i--) {
      if(block_context.length > 0) {
        block_context = ` > ${block_context}`;
      }
      block_context = block_headings[i] + block_context;
      // if block context is longer than N characters, break
      if (block_context.length > 100) {
        break;
      }
    }
    // remove leading > if exists
    if (block_context.startsWith(" > ")) {
      block_context = block_context.slice(3);
    }
    return block_context;

  }
    
  // inject function returns nothing, it just modifies the class

}