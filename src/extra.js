class DeprecatedPlugin {

  find_nearest_embedding(to_vec, filter={}) {
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
      if(filter.skip_key){
        if(filter.skip_key===from_keys[i]) continue; // skip matching to current note
        if(filter.skip_key===this.embeddings[from_keys[i]].meta.file) continue; // skip if filter.skip_key matches meta.file
      }
      // if filter.path_begins_with is set (folder filter)
      if(filter.path_begins_with){
        // if type is string & meta.path does not begin with filter.path_begins_with, skip
        if(typeof filter.path_begins_with === "string" && !this.embeddings[from_keys[i]].meta.path.startsWith(filter.path_begins_with)) continue;
        // if type is array & meta.path does not begin with any of the filter.path_begins_with, skip
        if(Array.isArray(filter.path_begins_with) && !filter.path_begins_with.some((path) => this.embeddings[from_keys[i]].meta.path.startsWith(path))) continue;
      }
        
      nearest.push({
        link: this.embeddings[from_keys[i]].meta.path,
        similarity: this.smart_vec_lite.cos_sim(to_vec, this.embeddings[from_keys[i]].vec),
        len: this.embeddings[from_keys[i]].meta.len || this.embeddings[from_keys[i]].meta.size,
      });
    }
    // handle external links
    if(this.embeddings_external){
      for(let i = 0; i < this.embeddings_external.length; i++) {
        nearest.push({
          link: this.embeddings_external[i].meta,
          similarity: this.smart_vec_lite.cos_sim(to_vec, this.embeddings_external[i].vec)
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


  /**
   * migrate embeddings.json to embeddings-2.json
   * - embeddings-2.json is a new file format that uses a different method to store embeddings
   * - move key to meta.source
   * - replace key with md5(meta.source)
   * - move values to vec
  */ 
  // if embeddings.json exists then use it to create embeddings-2.json
  async migrate_embeddings_to_v2() {
    // get view and set to loading
    // read embeddings.json
    const embeddings = await this.app.vault.adapter.read(".smart-connections/embeddings.json");
    // parse embeddings.json
    const embeddings_json = JSON.parse(embeddings);
    // create new embeddings-2.json
    const embeddings_2_json = {};
    // loop through embeddings.json
    for (let key in embeddings_json) {
      // create new key using crypto SHA1 hash
      const new_key = crypto.createHash('md5').update(key).digest('hex');
      // create new embeddings-2.json entry
      embeddings_2_json[new_key] = {
        "vec": embeddings_json[key].values,
        "meta": {
          "path": key,
          "hash": embeddings_json[key].hash,
          "mtime": embeddings_json[key].mtime,
          "tokens": embeddings_json[key].tokens,
        },
      }
      // if has hashes
      if(embeddings_json[key].hashes) {
        embeddings_2_json[new_key].meta.blocks = [];
        // loop through hashes
        for (let hash of embeddings_json[key].hashes) {
          // iterate through embeddings_json
          for(let key2 in embeddings_json) {
            if (embeddings_json[key2].hash == hash) {
              // create hash from key
              const hash_key = crypto.createHash('md5').update(key2).digest('hex');
              embeddings_2_json[new_key].meta.blocks.push(hash_key);
            }
          }
        }
        // sort blocks
        embeddings_2_json[new_key].meta.blocks.sort();
      }
      // if key contains '#'
      if(key.indexOf("#") > -1) {
        // split at '#' and get first part
        const file_key = crypto.createHash('md5').update(key.split("#")[0]).digest('hex');
        embeddings_2_json[new_key].meta.file = file_key;
      }
      // re-write object create to exclude any undefined values
      embeddings_2_json[new_key] = JSON.parse(JSON.stringify(embeddings_2_json[new_key]));
    }
    // write embeddings-2.json
    await this.app.vault.adapter.write(".smart-connections/embeddings-2.json", JSON.stringify(embeddings_2_json));
  }
}

class DeprecatedSmartView {

  async load_embeddings_file(retries=0) {
    this.set_message("Loading embeddings file...");
    try {
      // get embeddings file contents from root of vault
      const embeddings_file = await this.app.vault.adapter.read(".smart-connections/embeddings-2.json");
      // parse file containing all embeddings JSON
      // console.log("loaded embeddings from file");
      // loaded embeddings from file
      this.plugin.embeddings = JSON.parse(embeddings_file);
      // set message
      this.set_message("Embeddings file loaded.");
    } catch (error) {
      // retry if error up to 3 times
      if(retries < 3) {
        console.log("retrying load_embeddings_file()");
        // increase wait time between retries
        await new Promise(r => setTimeout(r, 1000+(1000*retries)));
        await this.load_embeddings_file(retries+1);
      }else{
        console.log("failed to load embeddings file, prompting user to bulk embed");
        this.render_embeddings_buttons();
        throw new Error("Error: Prompting user to create a new embeddings file or retry.");
      }
    }
    // if embeddings-external-X.json exists then load it
    const files_list = await this.app.vault.adapter.list(".smart-connections");
    // console.log(files_list);
    if(files_list.files){
      console.log("loading external embeddings");
      // get all embeddings-external-X.json files
      const external_files = files_list.files.filter(file => file.indexOf("embeddings-external") !== -1);
      for(let i = 0; i < external_files.length; i++) {
        const embeddings_file = await this.app.vault.adapter.read(external_files[i]);
        // merge with existing embeddings_external if it exists
        if(this.plugin.embeddings_external) {
          this.plugin.embeddings_external = [...this.plugin.embeddings_external, ...JSON.parse(embeddings_file).embeddings];
        }else{
          this.plugin.embeddings_external = JSON.parse(embeddings_file).embeddings;
        }
        console.log("loaded "+external_files[i]);
      }
    }
  }
}