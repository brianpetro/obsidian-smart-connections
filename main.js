const Obsidian = require("obsidian");
// require built-in crypto module
const crypto = require("crypto");

const DEFAULT_SETTINGS = {
  api_key: "",
  file_exclusions: "",
  folder_exclusions: "",
  header_exclusions: "",
  path_only: "",
  show_full_path: false,
  log_render: false,
  log_render_files: false,
};
const MAX_EMBED_STRING_LENGTH = 25000;

class SmartConnectionsPlugin extends Obsidian.Plugin {
  // constructor
  constructor() {
    super(...arguments);
    this.embeddings = null;
    this.nearest_cache = {};
    this.render_log = {};
    this.render_log.deleted_embeddings = 0;
    this.render_log.exclusions_logs = {};
    this.render_log.files = [];
    this.render_log.new_embeddings = 0;
    this.render_log.token_usage = 0;
    this.render_log.tokens_saved_by_cache = 0;
    this.file_exclusions = [];
    this.header_exclusions = [];
    this.path_only = [];
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    // load file exclusions if not blank
    if(this.settings.file_exclusions && this.settings.file_exclusions.length > 0) {
      // split file exclusions into array and trim whitespace
      this.file_exclusions = this.settings.file_exclusions.split(",").map((file) => {
        return file.trim();
      });
    }
    // load folder exclusions if not blank
    if(this.settings.folder_exclusions && this.settings.folder_exclusions.length > 0) {
      // add slash to end of folder name if not present
      const folder_exclusions = this.settings.folder_exclusions.split(",").map((folder) => {
        // trim whitespace
        folder = folder.trim();
        if(folder.slice(-1) !== "/") {
          return folder + "/";
        } else {
          return folder;
        }
      });
      // merge folder exclusions with file exclusions
      this.file_exclusions = this.file_exclusions.concat(folder_exclusions);
    }
    // load header exclusions if not blank
    if(this.settings.header_exclusions && this.settings.header_exclusions.length > 0) {
      this.header_exclusions = this.settings.header_exclusions.split(",").map((header) => {
        return header.trim();
      });
    }
    // load path_only if not blank
    if(this.settings.path_only && this.settings.path_only.length > 0) {
      this.path_only = this.settings.path_only.split(",").map((path) => {
        return path.trim();
      });
    }
  }
  async saveSettings(rerender=false) {
    await this.saveData(this.settings);
    // re-load settings into memory
    await this.loadSettings();
    // re-render view if set to true (for example, after adding API key)
    if(rerender) {
      this.nearest_cache = {};
      await this.render_note_connections();
    }
  }
  async onload() {
    await this.loadSettings();
    console.log("loading plugin");
    this.addCommand({
      id: "sc-find-notes",
      name: "Find: Make Smart Connections",
      icon: "pencil_icon",
      hotkeys: [],
      // editorCallback: async (editor) => {
      editorCallback: async (editor) => {
        if(!this.view()) {
          await this.open_view();
        }
        if(editor.somethingSelected()) {
          // get selected text
          let selected_text = editor.getSelection();
          // render connections from selected text
          await this.render_note_connections(selected_text);
        } else {
          // clear nearest_cache
          this.nearest_cache = {};
          // console.log("Cleared nearest_cache");
          await this.render_note_connections();
        }
      }
    });
    this.addCommand({
      id: "smart-connections-view",
      name: "Open: View Smart Connections",
      callback: () => {
        this.open_view();
      }
    });
    // get all files in vault
    this.addSettingTab(new SmartConnectionsSettingsTab(this.app, this));

    // runs when file is opened
    this.registerEvent(this.app.workspace.on('file-open', (file) => {
      // if no file is open, return
      if(!file) {
        // console.log("no file open, returning");
        return;
      }
      // if no view is open, return
      if(!this.view()) {
        console.log("Smart Connections: no view open, skipping file-open event.");
        return;
      }
      // return if file type is not markdown
      if(file.extension !== "md") {
        // if file is 'canvas' and length of current view content is greater than 300 then return
        if((file.extension === "canvas") && (this.view().containerEl.children[1].innerHTML.length > 300)) {
          // prevents clearing view of search results when still on the same canvas
          // console.log("prevented clearing view of search results when still on the same canvas")
          return;
        }
        return this.view().set_message([
          "File: "+file.name
          ,"Smart Connections only works with Markdown files."
        ]);
      }
      this.render_note_connections(file);
    }));

    // register view type
    this.activate_view();
    // if layout is not ready, register events instead to improve start-up time
    if (this.app.workspace.layoutReady) {
      await this.open_view();
      await this.load_embeddings_file();
      await this.render_note_connections();
    } else {
      console.log("layout not ready, waiting to complete load");
      this.registerEvent(this.app.workspace.on("layout-ready", this.open_view.bind(this)));
      this.registerEvent(this.app.workspace.on("layout-ready", this.load_embeddings_file.bind(this)));
    }

  }
  
  activate_view() {
    this.registerView(
      SMART_CONNECTIONS_VIEW_TYPE,
      (leaf) => new SmartConnectionsView(leaf, this)
    );
    this.app.workspace.registerHoverLinkSource(SMART_CONNECTIONS_VIEW_TYPE, {
        display: 'Smart Connections Files',
        defaultMod: true,
    });
  }

  view() {
    for (let leaf of this.app.workspace.getLeavesOfType(SMART_CONNECTIONS_VIEW_TYPE)) {
      if (leaf.view instanceof SmartConnectionsView) {
        return leaf.view;
      }
    }
    return null;
  } 
    
  async open_view() {
    this.app.workspace.detachLeavesOfType(SMART_CONNECTIONS_VIEW_TYPE);
    await this.app.workspace.getRightLeaf(false).setViewState({
      type: SMART_CONNECTIONS_VIEW_TYPE,
      active: true,
    });
    this.app.workspace.revealLeaf(
      this.app.workspace.getLeavesOfType(SMART_CONNECTIONS_VIEW_TYPE)[0]
    );
  }
  
  // get embeddings for all files
  async get_all_embeddings() {
    // get all files in vault
    const files = await this.app.vault.getMarkdownFiles();
    this.clean_up_embeddings(files);
    // batch embeddings
    let batch_promises = [];
    for (let i = 0; i < files.length; i++) {
      // skip if file already has embedding and embedding.mtime is greater than or equal to file.mtime
      if((this.embeddings[files[i].path]) && (this.embeddings[files[i].path].mtime >= files[i].stat.mtime)) {
        // log skipping file
        //console.log("skipping file (mtime)");
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
  }

  async save_embeddings_to_file() {
    if(this.render_log.new_embeddings === 0) {
      // console.log("no files embedded, skipping save_embeddings_to_file");
      return;
    }
    const embeddings = JSON.stringify(this.embeddings);
    // check if embeddings file exists
    const embeddings_file_exists = await this.app.vault.adapter.exists(".smart-connections/embeddings.json");
    // if embeddings file exists then check if new embeddings file size is significantly smaller than existing embeddings file size
    if(embeddings_file_exists) {
      // esitmate file size of embeddings
      const new_file_size = embeddings.length;
      // get existing file size
      const existing_file_size = await this.app.vault.adapter.stat(".smart-connections/embeddings.json").then((stat) => stat.size);
      // console.log("new file size: "+new_file_size);
      // console.log("existing file size: "+existing_file_size);

      // if new file size is at least 50% of existing file size then write embeddings to file
      if(new_file_size > (existing_file_size * 0.5)) {
        // write embeddings to file
        await this.app.vault.adapter.write(".smart-connections/embeddings.json", embeddings);
        // console.log("embeddings file size: "+new_file_size+" bytes");
      }else{
        // if new file size is significantly smaller than existing file size then throw error
        // show warning message including file sizes
        const warning_message = [
          "Warning: New embeddings file size is significantly smaller than existing embeddings file size.", 
          "Aborting to prevent possible loss of embeddings data.",
          "New file size: "+new_file_size+" bytes.",
          "Existing file size: "+existing_file_size+" bytes.",
          "Restarting Obsidian may fix this."
        ];
        this.view().set_message(warning_message);
        // save embeddings to file named unsaved-embeddings.json
        await this.app.vault.adapter.write(".smart-connections/unsaved-embeddings.json", embeddings);
        new Obsidian.Notice("Smart Connections: Warning: New embeddings file size is significantly smaller than existing embeddings file size. Aborting to prevent possible loss of embeddings data. See Smart Connections view for more details.");
        throw new Error("Error: New embeddings file size is significantly smaller than existing embeddings file size. Aborting to prevent possible loss of embeddings data.");
      }
    }else{
      await this.init_embeddings_file();
      await this.save_embeddings_to_file();
    }
  }

  // check if key from embeddings exists in files
  clean_up_embeddings(files) {
    for (let key in this.embeddings) {
      // console.log("key: "+key);
      // if no key starts with file path
      if(!files.find(file => key.startsWith(file.path))) {
        // delete key if it doesn't exist
        delete this.embeddings[key];
        this.render_log.deleted_embeddings++;
        // console.log("deleting (deleted file): " + key);
        continue;
      }
      // if key contains '#'
      if(key.indexOf("#") > -1) {
        // split at '#' and get first part
        let file_key = key.split("#")[0];
        // if file_key and file.hashes exists and block hash not in file.hashes
        if(this.embeddings[file_key] && this.embeddings[file_key].hashes){
          if(this.embeddings[file_key].hashes.indexOf(this.embeddings[key].hash) < 0) {
            // delete key
            delete this.embeddings[key];
            this.render_log.deleted_embeddings++;
            // console.log("deleting (stale block): " + key);
          }
          // console.log("prevented deletion via hash")
        }else{
          // DEPRECATED - currently included to prevent existing embeddings from being refreshed all at once
          // check if file_key.mtime is greater than key.mtime
          // check if both mtime values exist
          if(this.embeddings[file_key] && this.embeddings[file_key].mtime && this.embeddings[key].mtime && (this.embeddings[file_key].mtime > this.embeddings[key].mtime)) {
            // delete key
            delete this.embeddings[key];
            this.render_log.deleted_embeddings++;
            // console.log("deleting (stale block - mtime): " + key);
          }
        }
      }
    }
  }

  async load_embeddings_file(retries=0) {
    // get view
    const view = this.view();
    // if view is open
    if(view) {
      // set message
      view.set_message("Loading embeddings file...");
    }
    try {
      // get embeddings file contents from root of vault
      const embeddings_file = await this.app.vault.adapter.read(".smart-connections/embeddings.json");
      // parse file containing all embeddings JSON
      // console.log("loaded embeddings from file");
      // loaded embeddings from file
      this.embeddings = JSON.parse(embeddings_file);
      // set message
      this.view().set_message("Embeddings file loaded.");
    } catch (error) {
      // retry if error up to 3 times
      if(retries < 3) {
        console.log("retrying load_embeddings_file()");
        // increase wait time between retries
        await new Promise(r => setTimeout(r, 1000+(1000*retries)));
        await this.load_embeddings_file(retries+1);
      }else{
        console.log("failed to load embeddings file, prompting user to bulk embed");
        if(!this.view()) {
          await this.open_view();
        }
        this.view().render_embeddings_buttons();
        throw new Error("Error: Prompting user to create a new embeddings file or retry.");
      }
    }
  }
  
  async init_embeddings_file() {
    // check if folder exists
    if (!(await this.app.vault.adapter.exists(".smart-connections"))) {
      // create folder
      await this.app.vault.adapter.mkdir(".smart-connections");
      console.log("created folder: .smart-connections");
    }else{
      console.log("folder already exists: .smart-connections");
    }
    // check if embeddings file exists
    if (!(await this.app.vault.adapter.exists(".smart-connections/embeddings.json"))) {
      // create embeddings file
      await this.app.vault.adapter.write(".smart-connections/embeddings.json", "{}");
      console.log("created embeddings file: .smart-connections/embeddings.json");
    }else{
      console.log("embeddings file already exists: .smart-connections/embeddings.json");
    }
  }

  // get embeddings for embed_input
  async get_file_embeddings(embed_file, save=true) {
    let batch_promises = [];
    let file_hashes = [];
    // intiate file_file_embed_input by removing .md and converting file path to breadcrumbs (" > ")
    let file_embed_input = embed_file.path.replace(".md", "");
    file_embed_input = file_embed_input.replace(/\//g, " > ");
    // embed on file.name/title only if path_only path matcher specified in settings
    let path_only = false;
    for(let j = 0; j < this.path_only.length; j++) {
      if(embed_file.path.indexOf(this.path_only[j]) > -1) {
        path_only = true;
        console.log("title only file with matcher: " + this.path_only[j]);
        // break out of loop
        break;
      }
    }
    // return early if path_only
    if(path_only) {
      await this.get_embeddings(embed_file.path, file_embed_input, embed_file.stat.mtime);
      return;
    }

    /**
     * BEGIN Block "section" embedding
     */
    let embedding_blocks = false;
    //console.log(embed_file.path);
    // get file from path
    const note_file = await this.app.vault.getAbstractFileByPath(embed_file.path);
    // console.log(note_file);
    // get file contents
    const note_contents = await this.app.vault.cachedRead(note_file);
    const note_sections = this.extractSectionsCompact(note_contents, note_file.path);
    // console.log(note_sections);
    // if note has more than one section (if only one then its same as full-content)
    if(note_sections.length > 1) {
      embedding_blocks = true;
      // for each section in file
      //console.log("Sections: " + note_sections.length);
      for (let j = 0; j < note_sections.length; j++) {
        // get embed_input for block
        const block_embed_input = note_sections[j].text;
        // console.log(note_sections[j].path);
        // skip if section length is less than N characters
        if(block_embed_input.length < 100) {
          continue;
        }
        // skip if note_sections.path contains this.header_exclusions
        if(this.header_exclusions.length > 0) {
          let skip = false;
          for(let k = 0; k < this.header_exclusions.length; k++) {
            if(note_sections[j].path.indexOf(this.header_exclusions[k]) > -1) {
              skip = true;
              this.render_log["header_exclusions: " + this.header_exclusions[k]] = (this.render_log["header_exclusions" + this.header_exclusions[k]] || 0) + 1;
              break;
            }
          }
          if(skip) {
            continue;
          }
        }
        // get embeddings key for checking if embeddings already exist
        const embeddings_key = embed_file.path+note_sections[j].path;
        // skip if embeddings key already exists and block mtime is greater than or equal to file mtime
        if((this.embeddings[embeddings_key]) && (this.embeddings[embeddings_key].mtime >= embed_file.stat.mtime)) {
          // add hash to file_hashes to prevent empty file_hashes triggering full-file embedding
          file_hashes.push(this.embeddings[embeddings_key].hash);
          // log skipping file
          // console.log("skipping block (mtime)");
          continue;
        }
        // get hash of block_embed_input
        const embed_hash = this.get_hash(block_embed_input);
        // push hash to file_hashes
        file_hashes.push(embed_hash);
        // skip if hash is present in this.embeddings and hash of block_embed_input is equal to hash in this.embeddings
        if((this.embeddings[embeddings_key]) && (this.embeddings[embeddings_key].hash === embed_hash)) {
          // log skipping file
          // console.log("skipping block (hash)");
          continue;
        }
        // log first line of block_embed_input that's about to be embedded
        // console.log(block_embed_input.split(`\n`)[0]);
        
        // get embeddings for block 
        // add block_embeddings to embeddings
        batch_promises.push(this.get_embeddings(embeddings_key, block_embed_input, embed_file.stat.mtime, embed_hash));
        if(batch_promises.length >= 10) {
          await Promise.all(batch_promises);
          batch_promises = [];
        }
        
      }
    }
    
    /**
     * BEGIN File "full note" embedding
     */
    /**
     * TODO
     * - IF NO section hash changes then skip full file embed
     * - save hashes anyway?
     */

    // if file length is less than ~8000 tokens use full file contents
    // else if file length is greater than 8000 tokens build file_embed_input from file headings
    file_embed_input += `:\n`;
    if(note_contents.length < 32000) {
      file_embed_input += note_contents
    }else{ 
      const note_meta_cache = this.app.metadataCache.getFileCache(note_file);
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

    // skip embedding full file if file_hashes is not empty and all hashes are present in this.embeddings
    // better than hashing file_embed_input because more resilient to inconsequential changes (whitespace between headings)
    let skip = false;
    let file_hash = null;
    // if file_hashes is not empty
    if(embedding_blocks && (file_hashes.length > 0)) {
      // if this.embeddings[embed_file.path] contains 'hashes' property and its not empty
      if(this.embeddings[embed_file.path]){
        if(Array.isArray(this.embeddings[embed_file.path].hashes)) {
          // if file_hashes is equal to this.embeddings[embed_file.path].hashes
          if(file_hashes.length === this.embeddings[embed_file.path].hashes.length) {
            skip = true;
            for(let j = 0; j < file_hashes.length; j++) {
              if(file_hashes[j] !== this.embeddings[embed_file.path].hashes[j]) {
                skip = false;
                break;
              }
            }
          }
        }
      }
    }else{
      // if not embedding blocks or file_hashes is empty, then no sections
      // check if this.embeddings[embed_file.path] contains 'hash' property and its not empty
      file_hash = this.get_hash(file_embed_input);
      if(this.embeddings[embed_file.path] && this.embeddings[embed_file.path].hash) {
        // if hash of file_embed_input is equal to this.embeddings[embed_file.path].hash
        if(file_hash === this.embeddings[embed_file.path].hash) {
          skip = true;
        }
      }
    }
    // skip if skip is true
    if(!skip) {
      if(embedding_blocks && (file_hashes.length > 0)) {
        // add file_hashes array to files with sections
        batch_promises.push(this.get_embeddings(embed_file.path, file_embed_input, embed_file.stat.mtime, file_hashes));
      }else{
        // add file_hash string to files without sections
        batch_promises.push(this.get_embeddings(embed_file.path, file_embed_input, embed_file.stat.mtime, file_hash));
      }
    }else{
      if(embedding_blocks && (file_hashes.length > 0)) {
        // multiply by 2 because implies we saved token spending on blocks(sections), too
        this.render_log.tokens_saved_by_cache += file_embed_input.length/2;
      }else{
        // calc tokens saved by cache: divide by 4 for token estimate
        this.render_log.tokens_saved_by_cache += file_embed_input.length/4;
      }
      // log skipping file
      // console.log("skipping cached file");
    }
    // if batch_promises is empty then return
    if(batch_promises.length === 0) {
      return;
    }

    // wait for all promises to resolve
    await Promise.all(batch_promises);
    // log embedding
    // console.log("embedding: " + embed_file.path);
    if(save) {
      // write embeddings JSON to file
      await this.save_embeddings_to_file();
    }
  }
  
  async get_embeddings(embeddings_key, embed_input, embed_file_mtime, embed_hash=null) {
    const requestResults = await this.request_embedding_from_input(embed_input);
    // if requestResults is not null
    if(requestResults){
      // add embedding key to render_log
      if(this.settings.log_render){
        if(this.settings.log_render_files){
          this.render_log.files.push(embeddings_key);
        }
        this.render_log.new_embeddings++;
        // add token usage to render_log
        this.render_log.token_usage += requestResults.usage.total_tokens;
      }
      const values = requestResults.data[0].embedding;
      if(values) {
        this.embeddings[embeddings_key] = {};
        this.embeddings[embeddings_key].values = values;
        this.embeddings[embeddings_key].mtime = embed_file_mtime;
        if(embed_hash) {
          if(Array.isArray(embed_hash)) {
            this.embeddings[embeddings_key].hashes = embed_hash; // file embeddings
          }else{
            this.embeddings[embeddings_key].hash = embed_hash; // block embeddings
          }
        }
        this.embeddings[embeddings_key].tokens = requestResults.usage.total_tokens;
      }
    }
  }
  
  // md5 hash of embed_input using built in crypto module
  get_hash(embed_input) {
    // trim excess whitespace
    embed_input = embed_input.trim();
    return crypto.createHash('md5').update(embed_input).digest("hex");
  }

  async request_embedding_from_input(embed_input, retries = 0) {
    // check if embed_input is a string
    if(typeof embed_input !== "string") {
      console.log("embed_input is not a string");
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
      if(error.status === 429){ 
        if(retries < 3) {
          console.log("retrying request (429) in 1 second...");
          // wait 1 second before retrying
          await new Promise(r => setTimeout(r, 1000));
          return await this.request_embedding_from_input(embed_input, retries+1);
        }
      }else{
        if(error.status === 400){
          new Obsidian.Notice("OpenAI API Error: see console logs for more details");
          // log full error to console
          console.log(resp);
        }
        // console.log("first line of embed: " + embed_input.substring(0, embed_input.indexOf("\n")));
        // console.log("embed input length: "+ embed_input.length);
        // console.log("erroneous embed input: " + embed_input);
        console.log(error);
      }
      // console.log(usedParams);
      // console.log(usedParams.input.length);
      return null; 
    }
  }

  async render_note_connections(context=null) {
    //const view = this.app.workspace.getLeavesOfType(SMART_CONNECTIONS_VIEW_TYPE)[0].view;
    /**
     * better view management based on recommendations in plugin-review.md
     * source: https://github.com/obsidianmd/obsidian-releases/blob/master/plugin-review.md#avoid-managing-references-to-custom-views
    */
    if(!this.view()) {
      new Obsidian.Notice(`No active view, use "Open: View Smart Connections" command to see connections.`);
      return;
    }
    // if API key is not set then update view message
    if(!this.settings.api_key) {
      this.view().set_message("API key is required to render connections");
      return;
    }
    if(!this.embeddings){
      await this.load_embeddings_file();
    }
    /**
     * Begin highlighted-text-level search
     */
    if(typeof context === "string") {
      const highlighted_text = context;
      // get embedding for highlighted text
      const highlighted_text_embedding = await this.request_embedding_from_input(highlighted_text);
      // if highlighted text embedding is null then return
      if(!highlighted_text_embedding) {
        new Obsidian.Notice("Error getting embedding for highlighted text");
        return;
      }
      let nearest = this.find_nearest_embedding(highlighted_text_embedding);

      // render results in view with first 100 characters of highlighted text
      // truncate highlighted text to 100 characters
      const nearest_context = `Selection: "${highlighted_text.length > 100 ? highlighted_text.substring(0, 100) + "..." : highlighted_text}"`;
      this.view().set_nearest(nearest, nearest_context);
      return;

    }

    /** 
     * Begin file-level search
     */    
    // if file is not tfile then get active file
    let file = context;
    if(!(file instanceof Obsidian.TFile)) {
      // get current note
      file = await this.app.workspace.getActiveFile();
      // if still no current note then return
      if(!file) {
        return this.view().set_message("No active file");
      }
    }
    // console.log("rendering connections for file: "+file.name);
    const nearest = await this.find_note_connections(file);
    // if nearest is a string then update view message
    if(typeof nearest === "string") {
      this.view().set_message(nearest);
    }else{
      // set nearest connections
      this.view().set_nearest(nearest, "File: "+file.name);
    }
    // get object keys of render_log
    this.output_render_log();
  }
  find_nearest_embedding(input_vector, current_note=null) {
    let nearest = [];
    const embeddings_keys = Object.keys(this.embeddings);
    for (let i = 0; i < embeddings_keys.length; i++) {
      if(current_note && embeddings_keys[i].startsWith(current_note.path)) {
        // skip matching to current note
        continue;
      }
      nearest.push({
        link: embeddings_keys[i],
        similarity: this.computeCosineSimilarity(input_vector, this.embeddings[embeddings_keys[i]].values)
      });
    }
    // sort array by cosine similarity
    nearest.sort(function (a, b) {
      return b.similarity - a.similarity;
    });
    // console.log(nearest);
    // limit to N nearest connections
    nearest = nearest.slice(0, 200);
    return nearest;
  }

  output_render_log() {
    // if settings.log_render is true
    if(this.settings.log_render) {
      if (this.render_log.new_embeddings === 0) {
        return;
      }else{
        // pretty print this.render_log to console
        console.log(JSON.stringify(this.render_log, null, 2));
      }
    }
    // clear render_log
    this.render_log = {};
    this.render_log.deleted_embeddings = 0;
    this.render_log.exclusions_logs = {};
    this.render_log.files = [];
    this.render_log.new_embeddings = 0;
    this.render_log.token_usage = 0;
    this.render_log.tokens_saved_by_cache = 0;
  }

  // find connections by most similar to current note by cosine similarity
  async find_note_connections(current_note=null) {
    // immediately set view to loading
    this.view().set_message("Making smart connections...");
    // if in this.nearest_cache then set to nearest
    // else get nearest
    let nearest = [];
    if(this.nearest_cache[current_note.path]) {
      nearest = this.nearest_cache[current_note.path];
      // console.log("nearest from cache");
    }else{
      // get all embeddings
      await this.get_all_embeddings();
      // console.log("got all embeddings");
      // skip files where path contains any exclusions
      for(let j = 0; j < this.file_exclusions.length; j++) {
        if(current_note.path.indexOf(this.file_exclusions[j]) > -1) {
          this.log_exclusion(this.file_exclusions[j]);
          // break out of loop and finish here
          return "excluded";
        }
      }
      // get from cache if mtime is same
      let current_note_embedding_values = [];
      if((this.embeddings[current_note.path]) && (this.embeddings[current_note.path].mtime >= current_note.stat.mtime)) {
        // log skipping file
        //console.log("skipping file (mtime)");
      }else{
        // console.log("getting current")
        await this.get_file_embeddings(current_note);
      }
      current_note_embedding_values = this.embeddings[current_note.path].values;
      
      // compute cosine similarity between current note and all other notes via embeddings
      nearest = this.find_nearest_embedding(current_note_embedding_values, current_note);
  
      // save to this.nearest_cache
      this.nearest_cache[current_note.path] = nearest;
    }

    // return array sorted by cosine similarity
    return nearest;
  }
  
  // create render_log object of exlusions with number of times skipped as value
  log_exclusion(exclusion) {
    // increment render_log for skipped file
    this.render_log.exclusions_logs[exclusion] = (this.render_log.exclusions_logs[exclusion] || 0) + 1;
  }

  onunload() {
    console.log("unloading plugin");
    this.app.workspace.detachLeavesOfType(SMART_CONNECTIONS_VIEW_TYPE);
  }
  
  computeCosineSimilarity(vector1, vector2) {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vector1.length; i++) {
      dotProduct += vector1[i] * vector2[i];
      normA += vector1[i] * vector1[i];
      normB += vector2[i] * vector2[i];
    }
    if (normA === 0 || normB === 0) {
      return 0;
    } else {
      return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }
  }
  // compute centroid of array of vectors
  computeCentroid(vectors) {
    // type check vectors is array of arrays of numbers
    // if(!Array.isArray(vectors)) {
    //   throw new Error("vectors is not an array");
    // }
    // if(!Array.isArray(vectors[0])) {
    //   throw new Error("vectors is not an array of arrays");
    // }
    // if(typeof vectors[0][0] !== "number") {
    //   throw new Error("vectors is not an array of arrays of numbers");
    // }
    let centroid = [];
    for (let i = 0; i < vectors[0].length; i++) {
      centroid.push(0);
    }
    for (let i = 0; i < vectors.length; i++) {
      for (let j = 0; j < vectors[i].length; j++) {
        centroid[j] += vectors[i][j];
      }
    }
    for (let i = 0; i < centroid.length; i++) {
      centroid[i] = centroid[i] / vectors.length;
    }
    return centroid;
  }

  extractSectionsCompact(markdown, file_path){
    // split the markdown into lines
    const lines = markdown.split('\n');
    // initialize the sections array
    const sections = [];
    // initialize the section string
    let section = '';
    let section_path = '';
    // current headers array
    let currentHeaders = [];
    // remode .md file extension and convert file_path to breadcrumb formatting
    const file_breadcrumbs = file_path.replace('.md', '').replace(/\//g, ' > ');

    // loop through the lines
    for (let i = 0; i < lines.length; i++) {
      // get the line
      const line = lines[i];
      // if the line is a header then represents end of a text block
      if (line.startsWith('#')) {
        // push the current section to the sections array unless last line was a also a header
        if(i > 0 && !lines[i-1].startsWith('#')){
          output_section();
        }
        // get the header level
        const level = line.split('#').length - 1;
        // remove any headers from the current headers array that are higher than the current header level
        currentHeaders = currentHeaders.filter(header => header.level < level);
        // add header and level to current headers array
        // trim the header to remove "#" and any trailing spaces
        currentHeaders.push({header: line.replace(/#/g, '').trim(), level: level});
        // initialize the section breadcrumbs with file.path the current headers
        section = file_breadcrumbs;
        section += ": " + currentHeaders.map(header => header.header).join(' > ');
        section_path = "#"+currentHeaders.map(header => header.header).join('#');
      } else {
        // add the line to the section string
        section += '\n' + line;
      }
      // if last line then push the current section to the sections array
      if(i === lines.length - 1){
        output_section();
      }
    }
    return sections;

    function output_section() {
      if (section.length > MAX_EMBED_STRING_LENGTH) {
        section = section.substring(0, MAX_EMBED_STRING_LENGTH);
      }
      sections.push({ text: section.trim(), path: section_path });
    }
  }

}

const SMART_CONNECTIONS_VIEW_TYPE = "smart-connections-view";
class SmartConnectionsView extends Obsidian.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
  }
  getViewType() {
    return SMART_CONNECTIONS_VIEW_TYPE;
  }

  getDisplayText() {
    return "Smart Connections Files";
  }
  set_message(message) {
    const container = this.containerEl.children[1];
    // clear container
    container.empty();
    // if mesage is an array, loop through and create a new p element for each message
    if (Array.isArray(message)) {
      for (let i = 0; i < message.length; i++) {
        container.createEl("p", { cls: "sc_message", text: message[i] });
      }
    }else{
      // create p element with message
      container.createEl("p", { cls: "sc_message", text: message });
    }
  }
  render_link_text(link, show_full_path=false) {
    // if show full path is false, remove file path
    if (!show_full_path) {
      link = link.split("/").pop();
    }
    // if contains '#'
    if (link.indexOf("#") > -1) {
      // split at .md
      link = link.split(".md");
      // wrap first part in <small> and add line break
      link[0] = `<small>${link[0]}</small><br>`;
      // join back together
      link = link.join("");
      // replace '#' with ' » '
      link = link.replace(/\#/g, " » ");
    }else{
      // remove '.md'
      link = link.replace(".md", "");
    }
    return link;
  }
  set_nearest(nearest, nearest_context=null) {
    // get container element
    const container = this.containerEl.children[1];
    // clear container
    container.empty();
    // if highlighted text is not null, create p element with highlighted text
    if (nearest_context) {
      container.createEl("p", { cls: "sc-context", text: nearest_context });
    }
    // create list of nearest notes
    const list = container.createEl("div", { cls: "sc-list" });
    for (let i = 0; i < nearest.length; i++) {
      const item = list.createEl("div", { cls: "search-result" });
      const link_text = this.render_link_text(nearest[i].link, this.plugin.settings.show_full_path);
      const link = item.createEl("a", {
        cls: "tree-item-self search-result-file-title is-clickable",
        // href: nearest[i].link,
        // text: link_text,
        title: nearest[i].link,
      });
      link.innerHTML = link_text;
      // trigger click event on link
      item.addEventListener("click", async (event) => {
        // get target file from link path
        // if sub-section is linked, open file and scroll to sub-section
        let targetFile;
        let heading;
        if(nearest[i].link.indexOf("#") > -1){
          // remove after # from link
          targetFile = this.app.metadataCache.getFirstLinkpathDest(nearest[i].link.split("#")[0], "");
          // console.log(targetFile);
          const target_file_cache = this.app.metadataCache.getFileCache(targetFile);
          // console.log(target_file_cache);
          // get heading
          const heading_text = nearest[i].link.split("#").pop();
          // get heading from headings in file cache
          heading = target_file_cache.headings.find(h => h.heading === heading_text);
          // console.log(heading);
        }else{
          targetFile = this.app.metadataCache.getFirstLinkpathDest(nearest[i].link, "");
        }
        // get most recent leaf
        let leaf = this.app.workspace.getMostRecentLeaf();
        if(event.ctrlKey || event.metaKey){
          // open in new pane
          leaf = this.app.workspace.getLeaf('tab');
          await leaf.openFile(targetFile);
        }else{
          await leaf.openFile(targetFile);
        }
        if(heading){
          let { editor } = leaf.view;
          const pos = {line: heading.position.start.line, ch: 0};
          editor.setCursor(pos);
          editor.scrollIntoView({to: pos, from: pos}, true);
        }
      });
      // trigger hover event on link
      item.addEventListener("mouseover", (event) => {
        this.app.workspace.trigger("hover-link", {
          event,
          source: SMART_CONNECTIONS_VIEW_TYPE,
          hoverParent: list,
          targetEl: item,
          linktext: nearest[i].link,
        });
      });

    }
    this.render_brand(container);
  }
  // render "Smart Connections" text fixed in the bottom right corner
  render_brand(container) {
    container.createEl("p", { cls: "sc-brand", text: "Smart Connections" });
  }

  // render buttons: "create" and "retry" for loading embeddings.json file
  render_embeddings_buttons() {
    // get container element
    const container = this.containerEl.children[1];
    // clear container
    container.empty();
    // create heading that says "Embeddings file not found"
    container.createEl("h2", { cls: "scHeading", text: "Embeddings file not found" });
    // create div for buttons
    const button_div = container.createEl("div", { cls: "scButtonDiv" });
    // create "create" button
    const create_button = button_div.createEl("button", { cls: "scButton", text: "Create embeddings.json" });
    // note that creating embeddings.json file will trigger bulk embedding and may take a while
    button_div.createEl("p", { cls: "scButtonNote", text: "Warning: Creating embeddings.json file will trigger bulk embedding and may take a while" });
    // create "retry" button
    const retry_button = button_div.createEl("button", { cls: "scButton", text: "Retry" });
    // try to load embeddings.json file again
    button_div.createEl("p", { cls: "scButtonNote", text: "If embeddings.json file already exists, click 'Retry' to load it" });

    // add click event to "create" button
    create_button.addEventListener("click", async (event) => {
      // create embeddings.json file
      await this.plugin.init_embeddings_file();
      // reload view
      await this.plugin.render_note_connections();
    });

    // add click event to "retry" button
    retry_button.addEventListener("click", async (event) => {
      // reload embeddings.json file
      await this.plugin.load_embeddings_file();
    });
  }

  async onOpen() {
    const container = this.containerEl.children[1];
    container.empty();
    // placeholder text
    container.createEl("p", { cls: "scPlaceholder", text: "Open a note to find connections." }); 
  }

  async onClose() {
    // Nothing to clean up.
  }
}

class SmartConnectionsSettingsTab extends Obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const {
      containerEl
    } = this;
    containerEl.empty();
    containerEl.createEl("h2", {
      text: "OpenAI Settings"
    });
    new Obsidian.Setting(containerEl).setName("api_key").setDesc("api_key").addText((text) => text.setPlaceholder("Enter your api_key").setValue(this.plugin.settings.api_key).onChange(async (value) => {
      this.plugin.settings.api_key = value;
      await this.plugin.saveSettings(true);
    }));
    containerEl.createEl("h2", {
      text: "Exclusions"
    });
    // list file exclusions
    new Obsidian.Setting(containerEl).setName("file_exclusions").setDesc("'Excluded file' matchers separated by a comma.").addText((text) => text.setPlaceholder("drawings,prompts/logs").setValue(this.plugin.settings.file_exclusions).onChange(async (value) => {
      this.plugin.settings.file_exclusions = value;
      await this.plugin.saveSettings();
    }));
    // list folder exclusions
    new Obsidian.Setting(containerEl).setName("folder_exclusions").setDesc("'Excluded folder' matchers separated by a comma.").addText((text) => text.setPlaceholder("drawings,prompts/logs").setValue(this.plugin.settings.folder_exclusions).onChange(async (value) => {
      this.plugin.settings.folder_exclusions = value;
      await this.plugin.saveSettings();
    }));
    // list path only matchers
    new Obsidian.Setting(containerEl).setName("path_only").setDesc("'Path only' matchers separated by a comma.").addText((text) => text.setPlaceholder("drawings,prompts/logs").setValue(this.plugin.settings.path_only).onChange(async (value) => {
      this.plugin.settings.path_only = value;
      await this.plugin.saveSettings();
    }));
    // list header exclusions
    new Obsidian.Setting(containerEl).setName("header_exclusions").setDesc("'Excluded header' matchers separated by a comma. Works for 'blocks' only.").addText((text) => text.setPlaceholder("drawings,prompts/logs").setValue(this.plugin.settings.header_exclusions).onChange(async (value) => {
      this.plugin.settings.header_exclusions = value;
      await this.plugin.saveSettings();
    }));
    containerEl.createEl("h2", {
      text: "Display"
    });
    // toggle showing full path in view
    new Obsidian.Setting(containerEl).setName("show_full_path").setDesc("Show full path in view.").addToggle((toggle) => toggle.setValue(this.plugin.settings.show_full_path).onChange(async (value) => {
      this.plugin.settings.show_full_path = value;
      await this.plugin.saveSettings(true);
    }));
    // toggle log_render
    new Obsidian.Setting(containerEl).setName("log_render").setDesc("Log render details to console (includes token_usage).").addToggle((toggle) => toggle.setValue(this.plugin.settings.log_render).onChange(async (value) => {
      this.plugin.settings.log_render = value;
      await this.plugin.saveSettings(true);
    }));
    // toggle files in log_render
    new Obsidian.Setting(containerEl).setName("log_render_files").setDesc("Log embedded objects paths with log render (for debugging).").addToggle((toggle) => toggle.setValue(this.plugin.settings.log_render_files).onChange(async (value) => {
      this.plugin.settings.log_render_files = value;
      await this.plugin.saveSettings(true);
    }));

  }
}

module.exports = SmartConnectionsPlugin;