// set module export to be a function to support dependency injection
module.exports = function injectMethod( modifyMe ){

  // inject this method: 
  modifyMe.prototype.render_external_link_elm = function(meta){
    if(meta.source) {
      if(meta.source === "Gmail") meta.source = "📧 Gmail";
      return `<small>${meta.source}</small><br>${meta.title}`;
    }
    // remove http(s)://
    let domain = meta.path.replace(/(^\w+:|^)\/\//, "");
    // separate domain from path
    domain = domain.split("/")[0];
    // wrap domain in <small> and add line break
    return `<small>🌐 ${domain}</small><br>${meta.title}`;
  }
    
  // inject function returns nothing, it just modifies the class

}