// set module export to be a function to support dependency injection
module.exports = function injectMethod( modifyMe ){

  // inject this method: 
  modifyMe.prototype.get_embeddings_batch = async function(req_batch) {
    // if req_batch is empty then return
    if(req_batch.length === 0) return;
    // create arrary of embed_inputs from req_batch[i][1]
    const embed_inputs = req_batch.map((req) => req[1]);
    // request embeddings from embed_inputs
    const requestResults = await this.request_embedding_from_input(embed_inputs);
    // if requestResults is null then return
    if(!requestResults) {
      console.log("failed embedding batch");
      // log failed file names to render_log
      this.render_log.failed_embeddings = [...this.render_log.failed_embeddings, ...req_batch.map((req) => req[2].path)];
      return;
    }
    // if requestResults is not null
    if(requestResults){
      this.has_new_embeddings = true;
      // add embedding key to render_log
      if(this.settings.log_render){
        if(this.settings.log_render_files){
          this.render_log.files = [...this.render_log.files, ...req_batch.map((req) => req[2].path)];
        }
        this.render_log.new_embeddings += req_batch.length;
        // add token usage to render_log
        this.render_log.token_usage += requestResults.usage.total_tokens;
      }
      // console.log(requestResults.data.length);
      // loop through requestResults.data
      for(let i = 0; i < requestResults.data.length; i++) {
        const vec = requestResults.data[i].embedding;
        const index = requestResults.data[i].index;
        if(vec) {
          const key = req_batch[index][0];
          const meta = req_batch[index][2];
          this.embeddings[key] = {};
          this.embeddings[key].vec = vec;
          this.embeddings[key].meta = meta;
          // this.embeddings[key].meta.tokens = requestResults.usage.total_tokens;
        }
      }
    }
  }
    
  // inject function returns nothing, it just modifies the class

}