// set module export to be a function to support dependency injection
module.exports = function injectMethod( crypto, modifyMe ){

  // inject this method: 
  modifyMe.prototype.find_note_connections = async function(current_note=null) {
    // md5 of current note path
    const curr_key = crypto.createHash('md5').update(current_note.path).digest("hex");
    // if in this.nearest_cache then set to nearest
    // else get nearest
    let nearest = [];
    if(this.nearest_cache[curr_key]) {
      nearest = this.nearest_cache[curr_key];
      // console.log("nearest from cache");
    }else{
      // skip files where path contains any exclusions
      for(let j = 0; j < this.file_exclusions.length; j++) {
        if(current_note.path.indexOf(this.file_exclusions[j]) > -1) {
          this.log_exclusion(this.file_exclusions[j]);
          // break out of loop and finish here
          return "excluded";
        }
      }
      // get all embeddings
      // await this.get_all_embeddings();
      // wrap get all in setTimeout to allow for UI to update
      setTimeout(() => {
        this.get_all_embeddings()
      }, 3000);
      // get from cache if mtime is same and values are not empty
      let current_note_embedding_vec = [];
      if (!this.embeddings[curr_key] 
        || !(this.embeddings[curr_key].meta.mtime >= current_note.stat.mtime) 
        || !this.embeddings[curr_key].vec 
        || !Array.isArray(this.embeddings[curr_key].vec) 
        || !(this.embeddings[curr_key].vec.length > 0)
        ) {
          // console.log("getting current")
          await this.get_file_embeddings(current_note);
        }else{
        // skipping get file embeddings because nothing has changed
        //console.log("skipping file (mtime)");
      }
      if(!this.embeddings[curr_key] || !this.embeddings[curr_key].vec) {
        return "Error getting embeddings for: "+current_note.path;
      }
      current_note_embedding_vec = this.embeddings[curr_key].vec;
      
      // compute cosine similarity between current note and all other notes via embeddings
      nearest = this.find_nearest_embedding(current_note_embedding_vec, curr_key);
  
      // save to this.nearest_cache
      this.nearest_cache[curr_key] = nearest;
    }

    // return array sorted by cosine similarity
    return nearest;
  }
    
  // inject function returns nothing, it just modifies the class

}