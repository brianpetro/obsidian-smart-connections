// set module export to be a function to support dependency injection
module.exports = function injectMethod( modifyMe ){

  // inject this method: 
  modifyMe.prototype.test_file_writing = async function() {
    // wrap in try catch to prevent error from crashing plugin
    let log = "Begin test:";
    try {
      // check if test file already exists
      const test_file_exists = await this.app.vault.adapter.exists(".smart-connections/embeddings-test.json");
      // if test file exists then delete it
      if(test_file_exists) {
        await this.app.vault.adapter.remove(".smart-connections/embeddings-test.json");
      }
      // write test file
      await this.app.vault.adapter.write(".smart-connections/embeddings-test.json", "test");
      // update test file
      if(this.embeddings){
        await this.app.vault.adapter.write(".smart-connections/embeddings-test.json", JSON.stringify(this.embeddings));
      }else{
        log += "<br>No embeddings to test, writing test content to file."
        await this.app.vault.adapter.write(".smart-connections/embeddings-test.json", "test2");
      }
      // delete test file
      // await this.app.vault.adapter.remove(".smart-connections/embeddings-test.json");
      // return "File writing test passed."
      log += "<br>File writing test passed.";
    }catch(error) {
      // return error message
      log += "<br>File writing test failed: "+error;
    }
    return log;
  }
    
  // inject function returns nothing, it just modifies the class

}