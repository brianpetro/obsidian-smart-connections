// set module export to be a function to support dependency injection
module.exports = function injectMethod( modifyMe ){

  // inject this method: 
  modifyMe.prototype.get_embeddings = async function (key, embed_input, meta={}) {
    const requestResults = await this.request_embedding_from_input(embed_input);
    // if requestResults is null then return
    if(!requestResults) {
      console.log("failed embedding: " + meta.path);
      // log failed file names to render_log
      this.render_log.failed_embeddings.push(meta.path);
      return;
    }
    // if requestResults is not null
    if(requestResults){
      // add embedding key to render_log
      if(this.settings.log_render){
        if(this.settings.log_render_files){
          this.render_log.files.push(meta);
        }
        this.render_log.new_embeddings++;
        // add token usage to render_log
        this.render_log.token_usage += requestResults.usage.total_tokens;
      }
      const vec = requestResults.data[0].embedding;
      if(vec) {
        this.embeddings[key] = {};
        this.embeddings[key].vec = vec;
        this.embeddings[key].meta = meta;
        this.embeddings[key].meta.tokens = requestResults.usage.total_tokens;
      }
    }
  }
    
  // inject function returns nothing, it just modifies the class

}