// set module export to be a function to support dependency injection
module.exports = function injectMethod( modifyMe ){

  // inject this method: 
  modifyMe.prototype.init_embeddings_file = async function() {
    // check if folder exists
    if (!(await this.app.vault.adapter.exists(".smart-connections"))) {
      // create folder
      await this.app.vault.adapter.mkdir(".smart-connections");
      console.log("created folder: .smart-connections");
      // if .gitignore file exists then add .smart-connections to .gitignore
      await this.add_to_gitignore();
    }else{
      console.log("folder already exists: .smart-connections");
    }
    // check if embeddings file exists
    if (!(await this.app.vault.adapter.exists(".smart-connections/embeddings-2.json"))) {
      // create embeddings file
      await this.app.vault.adapter.write(".smart-connections/embeddings-2.json", "{}");
      console.log("created embeddings file: .smart-connections/embeddings-2.json");
    }else{
      console.log("embeddings file already exists: .smart-connections/embeddings-2.json");
    }
  }
    
  // inject function returns nothing, it just modifies the class

}