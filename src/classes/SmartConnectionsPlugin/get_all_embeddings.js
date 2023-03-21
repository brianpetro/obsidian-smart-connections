// set module export to be a function to support dependency injection
module.exports = function injectMethod( Obsidian, crypto, modifyMe ){

  // set the get_all_embeddings method
  modifyMe.prototype.get_all_embeddings = async function() {
    // get all files in vault
    const files = await this.app.vault.getMarkdownFiles();
    // get open files to skip if file is currently open
    const open_files = this.app.workspace.getLeavesOfType("markdown").map((leaf) => leaf.view.file);
    this.render_log.total_files = files.length;
    this.clean_up_embeddings(files);
    // batch embeddings
    let batch_promises = [];
    for (let i = 0; i < files.length; i++) {
      // skip if path contains a #
      if(files[i].path.indexOf("#") > -1) {
        // console.log("skipping file '"+files[i].path+"' (path contains #)");
        this.log_exclusion("path contains #");
        continue;
      }
      const curr_key = crypto.createHash("md5").update(files[i].path).digest("hex");
      // skip if file already has embedding and embedding.mtime is greater than or equal to file.mtime
      if((this.embeddings[curr_key]) && (this.embeddings[curr_key].meta.mtime >= files[i].stat.mtime)) {
        // log skipping file
        //console.log("skipping file (mtime)");
        continue;
      }
      // check if file is in failed_files
      if(this.settings.failed_files.indexOf(files[i].path) > -1) {
        // log skipping file
        // console.log("skipping previously failed file, use button in settings to retry");
        // use setTimeout to prevent multiple notices
        if(this.retry_notice_timeout) {
          clearTimeout(this.retry_notice_timeout);
          this.retry_notice_timeout = null;
        }
        this.retry_notice_timeout = setTimeout(() => {
          new Obsidian.Notice("Smart Connections: Skipping previously failed file, use button in settings to retry");
        }, 3000);
        continue;
      }
      // skip files where path contains any exclusions
      let skip = false;
      for(let j = 0; j < this.file_exclusions.length; j++) {
        if(files[i].path.indexOf(this.file_exclusions[j]) > -1) {
          skip = true;
          this.log_exclusion(this.file_exclusions[j]);
          // break out of loop
          break;
        }
      }
      if(skip) {
        continue; // to next file
      }
      // check if file is open
      if(open_files.indexOf(files[i]) > -1) {
        // console.log("skipping file (open)");
        continue;
      }
      try {
        // push promise to batch_promises
        batch_promises.push(this.get_file_embeddings(files[i], false));
      } catch (error) {
        console.log(error);
      }
      // if batch_promises length is 10
      if(batch_promises.length > 3) {
        // wait for all promises to resolve
        await Promise.all(batch_promises);
        // clear batch_promises
        batch_promises = [];
      }

      // save embeddings JSON to file every 100 files to save progress on bulk embedding
      if(i > 0 && i % 100 === 0) {
        await this.save_embeddings_to_file();
      }
    }
    // console.log(this.embeddings);
    // wait for all promises to resolve
    await Promise.all(batch_promises);
    // write embeddings JSON to file
    await this.save_embeddings_to_file();
    // if render_log.failed_embeddings then update failed_embeddings.txt
    if(this.render_log.failed_embeddings.length > 0) {
      await this.save_failed_embeddings();
    }
  }
  
  // inject function returns nothing, it just modifies the class

}