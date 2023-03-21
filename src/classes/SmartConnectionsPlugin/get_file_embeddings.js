const { MAX_EMBED_STRING_LENGTH } = require( "./json/constants.json" );

// set module export to be a function to support dependency injection
module.exports = function injectMethod( crypto, modifyMe ){

  // inject this method: 
  modifyMe.prototype.get_file_embeddings = async function(curr_file, save=true) {
    // let batch_promises = [];
    let req_batch = [];
    let blocks = [];
    // initiate curr_file_key from md5(curr_file.path)
    const curr_file_key = crypto.createHash('md5').update(curr_file.path).digest('hex');
    // intiate file_file_embed_input by removing .md and converting file path to breadcrumbs (" > ")
    let file_embed_input = curr_file.path.replace(".md", "");
    file_embed_input = file_embed_input.replace(/\//g, " > ");
    // embed on file.name/title only if path_only path matcher specified in settings
    let path_only = false;
    for(let j = 0; j < this.path_only.length; j++) {
      if(curr_file.path.indexOf(this.path_only[j]) > -1) {
        path_only = true;
        console.log("title only file with matcher: " + this.path_only[j]);
        // break out of loop
        break;
      }
    }
    // return early if path_only
    if(path_only) {
      // await this.get_embeddings(curr_file_key, file_embed_input, {
      //   mtime: curr_file.stat.mtime,
      //   path: curr_file.path,
      // });
      req_batch.push([curr_file_key, file_embed_input, {
        mtime: curr_file.stat.mtime,
        path: curr_file.path,
      }]);
      await this.get_embeddings_batch(req_batch);
      return;
    }

    /**
     * BEGIN Block "section" embedding
     */
    // get file contents
    const note_contents = await this.app.vault.cachedRead(curr_file);
    let processed_since_last_save = 0;
    const note_sections = this.block_parser(note_contents, curr_file.path);
    // console.log(note_sections);
    // if note has more than one section (if only one then its same as full-content)
    if(note_sections.length > 1) {
      // for each section in file
      //console.log("Sections: " + note_sections.length);
      for (let j = 0; j < note_sections.length; j++) {
        // get embed_input for block
        const block_embed_input = note_sections[j].text;
        // console.log(note_sections[j].path);
        // get block key from block.path (contains both file.path and header path)
        const block_key = crypto.createHash('md5').update(note_sections[j].path).digest('hex');
        blocks.push(block_key);
        let block_hash; // set hash of block_embed_input in correct scope
        if (this.embeddings[block_key] && this.embeddings[block_key].meta) {
          // skip if length of block_embed_input same as length of embeddings[block_key].meta.len
          if (block_embed_input.length === this.embeddings[block_key].meta.len) {
            // log skipping file
            // console.log("skipping block (len)");
            continue;
          }
          // add hash to blocks to prevent empty blocks triggering full-file embedding
          // skip if embeddings key already exists and block mtime is greater than or equal to file mtime
          if (this.embeddings[block_key].meta.mtime >= curr_file.stat.mtime) {
            // log skipping file
            // console.log("skipping block (mtime)");
            continue;
          }
          // skip if hash is present in this.embeddings and hash of block_embed_input is equal to hash in this.embeddings
          block_hash = this.get_embed_hash(block_embed_input);
          if(this.embeddings[block_key].meta.hash === block_hash) {
            // log skipping file
            // console.log("skipping block (hash)");
            continue;
          }
        }

        // create req_batch for batching requests
        req_batch.push([block_key, block_embed_input, {
          // oldmtime: curr_file.stat.mtime, 
          // get current datetime as unix timestamp
          mtime: Date.now(),
          hash: block_hash, 
          file: curr_file_key,
          path: note_sections[j].path,
          len: block_embed_input.length,
        }]);
        if(req_batch.length > 9) {
          // add batch to batch_promises
          await this.get_embeddings_batch(req_batch);
          processed_since_last_save += req_batch.length;
          // log embedding
          // console.log("embedding: " + curr_file.path);
          if (processed_since_last_save >= 30) {
            // write embeddings JSON to file
            await this.save_embeddings_to_file();
            // reset processed_since_last_save
            processed_since_last_save = 0;
          }
          // reset req_batch
          req_batch = [];
        }
      }
    }
    // if req_batch is not empty
    if(req_batch.length > 0) {
      // process remaining req_batch
      await this.get_embeddings_batch(req_batch);
      req_batch = [];
      processed_since_last_save += req_batch.length;
    }
    
    /**
     * BEGIN File "full note" embedding
     */

    // if file length is less than ~8000 tokens use full file contents
    // else if file length is greater than 8000 tokens build file_embed_input from file headings
    file_embed_input += `:\n`;
    /**
     * TODO: improve/refactor the following "large file reduce to headings" logic
     */
    if(note_contents.length < MAX_EMBED_STRING_LENGTH) {
      file_embed_input += note_contents
    }else{ 
      const note_meta_cache = this.app.metadataCache.getFileCache(curr_file);
      // for each heading in file
      if(typeof note_meta_cache.headings === "undefined") {
        // console.log("no headings found, using first chunk of file instead");
        file_embed_input += note_contents.substring(0, MAX_EMBED_STRING_LENGTH);
        // console.log("chuck len: " + file_embed_input.length);
      }else{
        let note_headings = "";
        for (let j = 0; j < note_meta_cache.headings.length; j++) {
          // get heading level
          const heading_level = note_meta_cache.headings[j].level;
          // get heading text
          const heading_text = note_meta_cache.headings[j].heading;
          // build markdown heading
          let md_heading = "";
          for (let k = 0; k < heading_level; k++) {
            md_heading += "#";
          }
          // add heading to note_headings
          note_headings += `${md_heading} ${heading_text}\n`;
        }
        //console.log(note_headings);
        file_embed_input += note_headings
        if(file_embed_input.length > MAX_EMBED_STRING_LENGTH) {
          file_embed_input = file_embed_input.substring(0, MAX_EMBED_STRING_LENGTH);
        }
      }
    }
    // skip embedding full file if blocks is not empty and all hashes are present in this.embeddings
    // better than hashing file_embed_input because more resilient to inconsequential changes (whitespace between headings)
    const file_hash = this.get_embed_hash(file_embed_input);
    const existing_hash = (this.embeddings[curr_file_key] && this.embeddings[curr_file_key].meta) ? this.embeddings[curr_file_key].meta.hash : null;
    if(existing_hash && (file_hash === existing_hash)) {
      // console.log("skipping file (hash): " + curr_file.path);
      this.update_render_log(blocks, file_embed_input);
      return;
    };

    // if not already skipping and blocks are present
    const existing_blocks = (this.embeddings[curr_file_key] && this.embeddings[curr_file_key].meta) ? this.embeddings[curr_file_key].meta.blocks : null;
    let existing_has_all_blocks = true;
    if(existing_blocks && Array.isArray(existing_blocks) && (blocks.length > 0)) {
      // if all blocks are in existing_blocks then skip (allows deletion of small blocks without triggering full file embedding)
      for (let j = 0; j < blocks.length; j++) {
        if(existing_blocks.indexOf(blocks[j]) === -1) {
          existing_has_all_blocks = false;
          break;
        }
      }
    }
    // if existing has all blocks then check file size for delta
    if(existing_has_all_blocks){
      // get current note file size
      const curr_file_size = curr_file.stat.size;
      // get file size from this.embeddings
      let prev_file_size = 0;
      if (this.embeddings[curr_file_key] && this.embeddings[curr_file_key].meta && this.embeddings[curr_file_key].meta.size) {
        prev_file_size = this.embeddings[curr_file_key].meta.size;
        // if curr file size is less than 10% different from prev file size
        const file_delta_pct = Math.round((Math.abs(curr_file_size - prev_file_size) / curr_file_size) * 100);
        if(file_delta_pct < 10) {
          // skip embedding
          // console.log("skipping file (size) " + curr_file.path);
          this.render_log.skipped_low_delta[curr_file.name] = file_delta_pct + "%";
          this.update_render_log(blocks, file_embed_input);
          return;
        }
      }
    }
    let meta = {
      mtime: curr_file.stat.mtime,
      hash: file_hash,
      path: curr_file.path,
      size: curr_file.stat.size,
      blocks: blocks,
    };
    // batch_promises.push(this.get_embeddings(curr_file_key, file_embed_input, meta));
    req_batch.push([curr_file_key, file_embed_input, meta]);
    // send batch request
    await this.get_embeddings_batch(req_batch);

    // log embedding
    // console.log("embedding: " + curr_file.path);
    if (save) {
      // write embeddings JSON to file
      await this.save_embeddings_to_file();
    }

  }
    
  // inject function returns nothing, it just modifies the class

}