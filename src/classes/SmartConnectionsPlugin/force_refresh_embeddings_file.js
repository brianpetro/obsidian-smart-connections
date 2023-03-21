// set module export to be a function to support dependency injection
module.exports = function injectMethod( Obsidian, modifyMe ){

  // inject this method: 
  modifyMe.prototype.force_refresh_embeddings_file = async function() {
    // get current datetime as unix timestamp
    let current_datetime = Math.floor(Date.now() / 1000);
    // rename existing embeddings file to .smart-connections/embeddings-YYYY-MM-DD.json
    await this.app.vault.adapter.rename(".smart-connections/embeddings-2.json", ".smart-connections/embeddings-"+current_datetime+".json");
    // create new embeddings file
    await this.app.vault.adapter.write(".smart-connections/embeddings-2.json", "{}");
    new Obsidian.Notice("Smart Connections: embeddings file Force Refreshed, making new connections...");
    // clear this.embeddings
    this.embeddings = null;
    this.embeddings = {};
    // trigger making new connections
    await this.get_all_embeddings();
    this.output_render_log();
    new Obsidian.Notice("Smart Connections: embeddings file Force Refreshed, new connections made.");
  }
    
  // inject function returns nothing, it just modifies the class

}