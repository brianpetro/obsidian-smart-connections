// set module export to be a function to support dependency injection
module.exports = function injectMethod( modifyMe ){

  // inject this method: 
  modifyMe.prototype.clean_up_embeddings = function(files) {
    for (let key in this.embeddings) {
      // console.log("key: "+key);
      const path = this.embeddings[key].meta.path;
      // if no key starts with file path
      if(!files.find(file => path.startsWith(file.path))) {
        // delete key if it doesn't exist
        delete this.embeddings[key];
        this.render_log.deleted_embeddings++;
        // console.log("deleting (deleted file): " + key);
        continue;
      }
      // if key contains '#'
      if(path.indexOf("#") > -1) {
        // split at '#' and get first part
        const file_key = this.embeddings[key].meta.file;
        // if file_key and file.hashes exists and block hash not in file.hashes
        if(!this.embeddings[file_key]){
          // delete key
          delete this.embeddings[key];
          this.render_log.deleted_embeddings++;
          // console.log("deleting (missing file embedding)");
          continue;
        }
        if(!this.embeddings[file_key].meta){
          // delete key
          delete this.embeddings[key];
          this.render_log.deleted_embeddings++;
          // console.log("deleting (missing file meta)");
          continue;
        }
        if(this.embeddings[file_key].meta.blocks && (this.embeddings[file_key].meta.blocks.indexOf(key) < 0)) {
          // delete key
          delete this.embeddings[key];
          this.render_log.deleted_embeddings++;
          // console.log("deleting (missing block in file)");
          continue;
        }
        // DEPRECATED - currently included to prevent existing embeddings from being refreshed all at once
        if(this.embeddings[file_key].meta.mtime && 
          this.embeddings[key].meta.mtime && 
          (this.embeddings[file_key].meta.mtime > this.embeddings[key].meta.mtime)
        ) {
          // delete key
          delete this.embeddings[key];
          this.render_log.deleted_embeddings++;
          // console.log("deleting (stale block - mtime): " + key);
        }
      }
    }
  }
    
  // inject function returns nothing, it just modifies the class

}