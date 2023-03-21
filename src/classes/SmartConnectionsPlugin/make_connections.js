// set module export to be a function to support dependency injection
module.exports = function injectMethod( modifyMe ){

  // set the make_connections method
  modifyMe.prototype.make_connections = async function(selected_text=null) {
    let view = this.get_view();
    if (!view) {
      // open view if not open
      await this.open_view();
      view = this.get_view();
    }
    await view.render_connections(selected_text);
  }

  // inject function returns nothing, it just modifies the class

}