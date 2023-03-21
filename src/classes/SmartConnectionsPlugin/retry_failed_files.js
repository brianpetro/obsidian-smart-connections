// set module export to be a function to support dependency injection
module.exports = function injectMethod( modifyMe ){

  // inject this method: 
  modifyMe.prototype.retry_failed_files = async function() {
    // remove failed files from failed_files
    this.settings.failed_files = [];
    // if failed-embeddings.txt exists then delete it
    const failed_embeddings_file_exists = await this.app.vault.adapter.exists(".smart-connections/failed-embeddings.txt");
    if(failed_embeddings_file_exists) {
      await this.app.vault.adapter.remove(".smart-connections/failed-embeddings.txt");
    }
    // run get all embeddings
    await this.get_all_embeddings();
  }
    
  // inject function returns nothing, it just modifies the class

}