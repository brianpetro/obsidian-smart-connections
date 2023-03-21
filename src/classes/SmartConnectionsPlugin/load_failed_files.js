// set module export to be a function to support dependency injection
module.exports = function injectMethod( modifyMe ){

  // inject this method: 
  modifyMe.prototype.load_failed_files = async function() {
    // check if failed-embeddings.txt exists
    const failed_embeddings_file_exists = await this.app.vault.adapter.exists(".smart-connections/failed-embeddings.txt");
    if(!failed_embeddings_file_exists) {
      this.settings.failed_files = [];
      console.log("No failed files.");
      return;
    }
    // read failed-embeddings.txt
    const failed_embeddings = await this.app.vault.adapter.read(".smart-connections/failed-embeddings.txt");
    // split failed_embeddings into array and remove empty lines
    const failed_embeddings_array = failed_embeddings.split("\r\n");
    // split at '#' and reduce into unique file paths
    const failed_files = failed_embeddings_array.map(embedding => embedding.split("#")[0]).reduce((unique, item) => unique.includes(item) ? unique : [...unique, item], []);
    // return failed_files
    this.settings.failed_files = failed_files;
    // console.log(failed_files);
  }
    
  // inject function returns nothing, it just modifies the class

}