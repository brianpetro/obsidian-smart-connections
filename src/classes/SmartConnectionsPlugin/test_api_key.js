// set module export to be a function to support dependency injection
module.exports = function injectMethod( modifyMe ){

  // inject this method: 
  modifyMe.prototype.test_api_key = async function() {
    const embed_input = "This is a test of the OpenAI API.";
    const resp = await this.request_embedding_from_input(embed_input);
    if(resp && resp.usage) {
      console.log("API key is valid");
      return true;
    }else{
      console.log("API key is invalid");
      return false;
    }
  }
    
  // inject function returns nothing, it just modifies the class

}