// set module export to be a function to support dependency injection
module.exports = function injectMethod( crypto, modifyMe ){
  
  /**
   * migrate embeddings.json to embeddings-2.json
   * - embeddings-2.json is a new file format that uses a different method to store embeddings
   * - move key to meta.source
   * - replace key with md5(meta.source)
   * - move values to vec
  */ 

  // inject this method: 
  modifyMe.prototype.migrate_embeddings_to_v2 = async function() {
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

  // inject function returns nothing, it just modifies the class

}