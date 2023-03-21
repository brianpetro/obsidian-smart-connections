// set module export to be a function to support dependency injection
module.exports = function injectMethod( Obsidian, modifyMe ){

  // inject this method: 
  modifyMe.prototype.request_embedding_from_input = async function(embed_input, retries = 0) {
    // (FOR TESTING) test fail process by forcing fail
    // return null;
    // check if embed_input is a string
    // if(typeof embed_input !== "string") {
    //   console.log("embed_input is not a string");
    //   return null;
    // }
    // check if embed_input is empty
    if(embed_input.length === 0) {
      console.log("embed_input is empty");
      return null;
    }
    const usedParams = {
      model: "text-embedding-ada-002",
      input: embed_input,
    };
    // console.log(this.settings.api_key);
    const reqParams = {
      url: `https://api.openai.com/v1/embeddings`,
      method: "POST",
      body: JSON.stringify(usedParams),
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.settings.api_key}`
      }
    };
    let resp;
    try {
      resp = await (0, Obsidian.request)(reqParams)
      return JSON.parse(resp);
    } catch (error) {
      // retry request if error is 429
      if((error.status === 429) && (retries < 3)) {
        retries++;
        // exponential backoff
        const backoff = Math.pow(retries, 2);
        console.log(`retrying request (429) in ${backoff} seconds...`);
        await new Promise(r => setTimeout(r, 1000 * backoff));
        return await this.request_embedding_from_input(embed_input, retries);
      }
      // log full error to console
      console.log(resp);
      // console.log("first line of embed: " + embed_input.substring(0, embed_input.indexOf("\n")));
      // console.log("embed input length: "+ embed_input.length);
      // if(Array.isArray(embed_input)) {
      //   console.log(embed_input.map((input) => input.length));
      // }
      // console.log("erroneous embed input: " + embed_input);
      console.log(error);
      // console.log(usedParams);
      // console.log(usedParams.input.length);
      return null; 
    }
  }
    
  // inject function returns nothing, it just modifies the class

}