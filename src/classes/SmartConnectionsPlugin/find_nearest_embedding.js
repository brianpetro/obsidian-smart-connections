// set module export to be a function to support dependency injection
module.exports = function injectMethod( modifyMe ){

  // inject this method: 
  modifyMe.prototype.find_nearest_embedding = function(to_vec, to_key=null) {
    let nearest = [];
    const from_keys = Object.keys(this.embeddings);
    this.render_log.total_embeddings = from_keys.length;
    for (let i = 0; i < from_keys.length; i++) {
      // if this.settings.skip_sections is true
      if(this.settings.skip_sections){
        const from_path = this.embeddings[from_keys[i]].meta.path;
        if(from_path.indexOf("#") > -1) continue; // skip if contains # indicating block (section)
        // TODO: consider using presence of meta.file to skip files (faster checking?)
      }
      if(to_key){
        if(to_key==from_keys[i]) continue; // skip matching to current note
        if(to_key==this.embeddings[from_keys[i]].meta.file) continue; // skip if to_key matches meta.file
      }
      nearest.push({
        link: this.embeddings[from_keys[i]].meta.path,
        similarity: this.computeCosineSimilarity(to_vec, this.embeddings[from_keys[i]].vec),
        len: this.embeddings[from_keys[i]].meta.len || this.embeddings[from_keys[i]].meta.size,
      });
    }
    // handle external links
    if(this.embeddings_external){
      for(let i = 0; i < this.embeddings_external.length; i++) {
        nearest.push({
          link: this.embeddings_external[i].meta,
          similarity: this.computeCosineSimilarity(to_vec, this.embeddings_external[i].vec)
        });
      }
    }
    // sort array by cosine similarity
    nearest.sort(function (a, b) {
      return b.similarity - a.similarity;
    });
    // console.log(nearest);
    // limit to N nearest connections
    nearest = nearest.slice(0, this.settings.results_count);
    return nearest;
  }
    
  // inject function returns nothing, it just modifies the class

}