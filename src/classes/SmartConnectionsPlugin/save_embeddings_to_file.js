// set module export to be a function to support dependency injection
module.exports = function injectMethod( Obsidian, modifyMe ){

  // inject this method: 
  modifyMe.prototype.save_embeddings_to_file = async function(force=false) {
    if(!this.has_new_embeddings){
      return;
    }
    // console.log("new embeddings, saving to file");
    if(!force) {
      // prevent excessive writes to embeddings file by waiting 1 minute before writing
      if(this.save_timeout) {
        clearTimeout(this.save_timeout);
        this.save_timeout = null;  
      }
      this.save_timeout = setTimeout(() => {
        // console.log("writing embeddings to file");
        this.save_embeddings_to_file(true);
        // clear timeout
        if(this.save_timeout) {
          clearTimeout(this.save_timeout);
          this.save_timeout = null;
        }
      }, 60000);
      // console.log("scheduled save");
      return;
    }

    const embeddings = JSON.stringify(this.embeddings);
    // check if embeddings file exists
    const embeddings_file_exists = await this.app.vault.adapter.exists(".smart-connections/embeddings-2.json");
    // if embeddings file exists then check if new embeddings file size is significantly smaller than existing embeddings file size
    if(embeddings_file_exists) {
      // esitmate file size of embeddings
      const new_file_size = embeddings.length;
      // get existing file size
      const existing_file_size = await this.app.vault.adapter.stat(".smart-connections/embeddings-2.json").then((stat) => stat.size);
      // console.log("new file size: "+new_file_size);
      // console.log("existing file size: "+existing_file_size);

      // if new file size is at least 50% of existing file size then write embeddings to file
      if(new_file_size > (existing_file_size * 0.5)) {
        // write embeddings to file
        await this.app.vault.adapter.write(".smart-connections/embeddings-2.json", embeddings);
        this.has_new_embeddings = false;
        console.log("embeddings file size: "+new_file_size+" bytes");
      }else{
        // if new file size is significantly smaller than existing file size then throw error
        // show warning message including file sizes
        const warning_message = [
          "Warning: New embeddings file size is significantly smaller than existing embeddings file size.", 
          "Aborting to prevent possible loss of embeddings data.",
          "New file size: "+new_file_size+" bytes.",
          "Existing file size: "+existing_file_size+" bytes.",
          "Restarting Obsidian may fix this."
        ];
        console.log(warning_message.join(" "));
        // save embeddings to file named unsaved-embeddings.json
        await this.app.vault.adapter.write(".smart-connections/unsaved-embeddings.json", embeddings);
        new Obsidian.Notice("Smart Connections: Warning: New embeddings file size is significantly smaller than existing embeddings file size. Aborting to prevent possible loss of embeddings data. See Smart Connections view for more details.");
        throw new Error("Error: New embeddings file size is significantly smaller than existing embeddings file size. Aborting to prevent possible loss of embeddings data.");
      }
    }else{
      await this.init_embeddings_file();
      await this.save_embeddings_to_file();
    }
  }
  
  // inject function returns nothing, it just modifies the class

}