// set module export to be a function to support dependency injection
module.exports = function injectMethod( modifyMe ){

  // inject this method: 
  modifyMe.prototype.save_failed_embeddings = async function() {
    // write failed_embeddings to file one line per failed embedding
    let failed_embeddings = [];
    // if file already exists then read it
    const failed_embeddings_file_exists = await this.app.vault.adapter.exists(".smart-connections/failed-embeddings.txt");
    if(failed_embeddings_file_exists) {
      failed_embeddings = await this.app.vault.adapter.read(".smart-connections/failed-embeddings.txt");
      // split failed_embeddings into array
      failed_embeddings = failed_embeddings.split("\r\n");
    }
    // merge failed_embeddings with render_log.failed_embeddings
    failed_embeddings = failed_embeddings.concat(this.render_log.failed_embeddings);
    // remove duplicates
    failed_embeddings = [...new Set(failed_embeddings)];
    // sort failed_embeddings array alphabetically
    failed_embeddings.sort();
    // convert failed_embeddings array to string
    failed_embeddings = failed_embeddings.join("\r\n");
    // write failed_embeddings to file
    await this.app.vault.adapter.write(".smart-connections/failed-embeddings.txt", failed_embeddings);
    // reload failed_embeddings to prevent retrying failed files until explicitly requested
    await this.load_failed_files();
  }
    
  // inject function returns nothing, it just modifies the class

}