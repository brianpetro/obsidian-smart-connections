// set module export to be a function to support dependency injection
module.exports = function injectMethod( modifyMe ){

  // inject this method: 
  modifyMe.prototype.renderable_file_type = function(link) {
    return (link.indexOf(".md") !== -1) && (link.indexOf(".excalidraw") === -1);
  }
    
  // inject function returns nothing, it just modifies the class

}