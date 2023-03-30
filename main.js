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
  expanded_view: true,
  group_nearest_by_file: false,
  language: "en",
  log_render: false,
  log_render_files: false,
  recently_sent_retry_notice: false,
  results_count: 30,
  skip_sections: false,
  smart_chat_model: "gpt-3.5-turbo",
  view_open: true,
  version: "",
};
const MAX_EMBED_STRING_LENGTH = 25000;

let VERSION;

//create one object with all the translations
// research : SMART_TRANSLATION[language][key]
const SMART_TRANSLATION = {
  "en": {
    "pronous": ["my", "I", "me", "mine", "our", "ours", "us", "we"],
    "prompt": "Based on your notes",
    "initial_message": "Hi, I'm ChatGPT with access to your notes via Smart Connections. Ask me a question about your notes and I'll try to answer it.",
  },
  "es": {
    "pronous": ["mi", "yo", "mí", "tú"],
    "prompt": "Basándose en sus notas",
    "initial_message": "Hola, soy ChatGPT con acceso a tus apuntes a través de Smart Connections. Hazme una pregunta sobre tus apuntes e intentaré responderte.",
  },
  "fr": {
    "pronous": ["me", "mon", "ma", "mes", "moi", "nous", "notre", "nos", "je", "j'", "m'"],
    "prompt": "D'après vos notes",
    "initial_message": "Bonjour, je suis ChatGPT et j'ai accès à vos notes via Smart Connections. Posez-moi une question sur vos notes et j'essaierai d'y répondre.",
  },
  "de": {
    "pronous": ["mein", "meine", "meinen", "meiner", "meines", "mir", "uns", "unser", "unseren", "unserer", "unseres"],
    "prompt": "Basierend auf Ihren Notizen",
    "initial_message": "Hallo, ich bin ChatGPT und habe über Smart Connections Zugang zu Ihren Notizen. Stellen Sie mir eine Frage zu Ihren Notizen und ich werde versuchen, sie zu beantworten.",
  },
  "it": {
    "pronous": ["mio", "mia", "miei", "mie", "noi", "nostro", "nostri", "nostra", "nostre"],
    "prompt": "Sulla base degli appunti",
    "initial_message": "Ciao, sono ChatGPT e ho accesso ai tuoi appunti tramite Smart Connections. Fatemi una domanda sui vostri appunti e cercherò di rispondervi.",
  },
}

class SmartConnectionsPlugin extends Obsidian.Plugin {
  // constructor
  constructor() {
    super(...arguments);
    this.api = null;
    this.embeddings = null;
    this.embeddings_external = null;
    this.file_exclusions = [];
    this.has_new_embeddings = false;
    this.header_exclusions = [];
    this.nearest_cache = {};
    this.path_only = [];
    this.render_log = {};
    this.render_log.deleted_embeddings = 0;
    this.render_log.exclusions_logs = {};
    this.render_log.failed_embeddings = [];
    this.render_log.files = [];
    this.render_log.new_embeddings = 0;
    this.render_log.skipped_low_delta = {};
    this.render_log.token_usage = 0;
    this.render_log.tokens_saved_by_cache = 0;
    this.retry_notice_timeout = null;
    this.save_timeout = null;
    this.self_ref_kw_regex = null;
    this.update_available = false;
  }

  async onload() {
    // initialize when layout is ready
    this.app.workspace.onLayoutReady(this.initialize.bind(this));
  }
  async initialize() {
    console.log("Loading Smart Connections plugin");
    VERSION = this.manifest.version;
    // VERSION = '1.0.0';
    // console.log(VERSION);
    await this.loadSettings();
    await this.check_for_update();

    this.addIcon();
    this.addCommand({
      id: "sc-find-notes",
      name: "Find: Make Smart Connections",
      icon: "pencil_icon",
      hotkeys: [],
      // editorCallback: async (editor) => {
      editorCallback: async (editor) => {
        if(editor.somethingSelected()) {
          // get selected text
          let selected_text = editor.getSelection();
          // render connections from selected text
          await this.make_connections(selected_text);
        } else {
          // clear nearest_cache on manual call to make connections
          this.nearest_cache = {};
          // console.log("Cleared nearest_cache");
          await this.make_connections();
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
    // open chat command
    this.addCommand({
      id: "smart-connections-chat",
      name: "Open: Smart Chat Conversation",
      callback: () => {
        this.open_chat();
      }
    });
    this.addSettingTab(new SmartConnectionsSettingsTab(this.app, this));
    // register main view type
    this.registerView(SMART_CONNECTIONS_VIEW_TYPE, (leaf) => (new SmartConnectionsView(leaf, this)));
    // register chat view type
    this.registerView(SMART_CONNECTIONS_CHAT_VIEW_TYPE, (leaf) => (new SmartConnectionsChatView(leaf, this)));
    // code-block renderer
    this.registerMarkdownCodeBlockProcessor("smart-connections", this.render_code_block.bind(this));

    // if this settings.view_open is true, open view on startup
    if(this.settings.view_open) {
      this.open_view();
    }
    // on new version
    if(this.settings.version !== VERSION) {
      // update version
      this.settings.version = VERSION;
      // save settings
      await this.saveSettings();
      // open view
      this.open_view();
    }
    // check github release endpoint if update is available
    this.add_to_gitignore();
    /**
     * EXPERIMENTAL
     * - window-based API access
     * - code-block rendering
     */
    this.api = new ScSearchApi(this.app, this);
    // register API to global window object
    (window["SmartSearchApi"] = this.api) && this.register(() => delete window["SmartSearchApi"]);

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
    // load self_ref_kw_regex
    this.self_ref_kw_regex = new RegExp(`\\b(${SMART_TRANSLATION[this.settings.language].pronous.join("|")})\\b`, "gi");
    // load failed files
    await this.load_failed_files();
  }
  async saveSettings(rerender=false) {
    await this.saveData(this.settings);
    // re-load settings into memory
    await this.loadSettings();
    // re-render view if set to true (for example, after adding API key)
    if(rerender) {
      this.nearest_cache = {};
      await this.make_connections();
    }
  }

  // check for update
  async check_for_update() {
    // fail silently, ex. if no internet connection
    try {
      // get latest release version from github
      const response = await (0, Obsidian.requestUrl)({
        url: "https://api.github.com/repos/brianpetro/obsidian-smart-connections/releases/latest",
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        contentType: "application/json",
      });
      // get version number from response
      const latest_release = JSON.parse(response.text).tag_name;
      // console.log(`Latest release: ${latest_release}`);
      // if latest_release is newer than current version, show message
      if(latest_release !== VERSION) {
        new Obsidian.Notice(`[Smart Connections] A new version is available! (v${latest_release})`);
        this.update_available = true;
      }
    } catch (error) {
      console.log(error);
    }
  }

  async render_code_block(contents, container, ctx) {
    let nearest;
    if(contents.trim().length > 0) {
      nearest = await this.api.search(contents);
    } else {
      // use ctx to get file
      console.log(ctx);
      const file = this.app.vault.getAbstractFileByPath(ctx.sourcePath);
      nearest = await this.find_note_connections(file);
    }
    if (nearest.length) {
      this.update_results(container, nearest);
    }
  }

  async make_connections(selected_text=null) {
    let view = this.get_view();
    if (!view) {
      // open view if not open
      await this.open_view();
      view = this.get_view();
    }
    await view.render_connections(selected_text);
  }

  addIcon(){
    Obsidian.addIcon("smart-connections", `<path d="M50,20 L80,40 L80,60 L50,100" stroke="currentColor" stroke-width="4" fill="none"/>
    <path d="M30,50 L55,70" stroke="currentColor" stroke-width="5" fill="none"/>
    <circle cx="50" cy="20" r="9" fill="currentColor"/>
    <circle cx="80" cy="40" r="9" fill="currentColor"/>
    <circle cx="80" cy="70" r="9" fill="currentColor"/>
    <circle cx="50" cy="100" r="9" fill="currentColor"/>
    <circle cx="30" cy="50" r="9" fill="currentColor"/>`);
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
  // source: https://github.com/obsidianmd/obsidian-releases/blob/master/plugin-review.md#avoid-managing-references-to-custom-views
  get_view() {
    for (let leaf of this.app.workspace.getLeavesOfType(SMART_CONNECTIONS_VIEW_TYPE)) {
      if (leaf.view instanceof SmartConnectionsView) {
        return leaf.view;
      }
    }
  }
  // open chat view
  async open_chat() {
    this.app.workspace.detachLeavesOfType(SMART_CONNECTIONS_CHAT_VIEW_TYPE);
    await this.app.workspace.getRightLeaf(false).setViewState({
      type: SMART_CONNECTIONS_CHAT_VIEW_TYPE,
      active: true,
    });
    this.app.workspace.revealLeaf(
      this.app.workspace.getLeavesOfType(SMART_CONNECTIONS_CHAT_VIEW_TYPE)[0]
    );
  }
  
  // get embeddings for all files
  async get_all_embeddings() {
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
        // limit to one notice every 10 minutes
        if(!this.recently_sent_retry_notice){
          new Obsidian.Notice("Smart Connections: Skipping previously failed file, use button in settings to retry");
          this.recently_sent_retry_notice = true;
          setTimeout(() => {
            this.recently_sent_retry_notice = false;  
          }, 600000);
        }
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

  async save_embeddings_to_file(force=false) {
    if(!this.has_new_embeddings){
      return;
    }
    // console.log("new embeddings, saving to file");
    if(!force) {
      // prevent excessive writes to embeddings file by waiting 1 minute before writing
      if(this.save_timeout) {
        clearTimeout(this.save_timeout);
        this.save_timeout = null;  
      }
      this.save_timeout = setTimeout(() => {
        // console.log("writing embeddings to file");
        this.save_embeddings_to_file(true);
        // clear timeout
        if(this.save_timeout) {
          clearTimeout(this.save_timeout);
          this.save_timeout = null;
        }
      }, 60000);
      // console.log("scheduled save");
      return;
    }

    const embeddings = JSON.stringify(this.embeddings);
    // check if embeddings file exists
    const embeddings_file_exists = await this.app.vault.adapter.exists(".smart-connections/embeddings-2.json");
    // if embeddings file exists then check if new embeddings file size is significantly smaller than existing embeddings file size
    if(embeddings_file_exists) {
      // esitmate file size of embeddings
      const new_file_size = embeddings.length;
      // get existing file size
      const existing_file_size = await this.app.vault.adapter.stat(".smart-connections/embeddings-2.json").then((stat) => stat.size);
      // console.log("new file size: "+new_file_size);
      // console.log("existing file size: "+existing_file_size);

      // if new file size is at least 50% of existing file size then write embeddings to file
      if(new_file_size > (existing_file_size * 0.5)) {
        // write embeddings to file
        await this.app.vault.adapter.write(".smart-connections/embeddings-2.json", embeddings);
        this.has_new_embeddings = false;
        console.log("embeddings file size: "+new_file_size+" bytes");
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
        console.log(warning_message.join(" "));
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
  // save failed embeddings to file from render_log.failed_embeddings
  async save_failed_embeddings () {
    // write failed_embeddings to file one line per failed embedding
    let failed_embeddings = [];
    // if file already exists then read it
    const failed_embeddings_file_exists = await this.app.vault.adapter.exists(".smart-connections/failed-embeddings.txt");
    if(failed_embeddings_file_exists) {
      failed_embeddings = await this.app.vault.adapter.read(".smart-connections/failed-embeddings.txt");
      // split failed_embeddings into array
      failed_embeddings = failed_embeddings.split("\r\n");
    }
    // merge failed_embeddings with render_log.failed_embeddings
    failed_embeddings = failed_embeddings.concat(this.render_log.failed_embeddings);
    // remove duplicates
    failed_embeddings = [...new Set(failed_embeddings)];
    // sort failed_embeddings array alphabetically
    failed_embeddings.sort();
    // convert failed_embeddings array to string
    failed_embeddings = failed_embeddings.join("\r\n");
    // write failed_embeddings to file
    await this.app.vault.adapter.write(".smart-connections/failed-embeddings.txt", failed_embeddings);
    // reload failed_embeddings to prevent retrying failed files until explicitly requested
    await this.load_failed_files();
  }
  // test writing file to check if file system is read-only
  async test_file_writing () {
    // wrap in try catch to prevent error from crashing plugin
    let log = "Begin test:";
    try {
      // check if test file already exists
      const test_file_exists = await this.app.vault.adapter.exists(".smart-connections/embeddings-test.json");
      // if test file exists then delete it
      if(test_file_exists) {
        await this.app.vault.adapter.remove(".smart-connections/embeddings-test.json");
      }
      // write test file
      await this.app.vault.adapter.write(".smart-connections/embeddings-test.json", "test");
      // update test file
      if(this.embeddings){
        await this.app.vault.adapter.write(".smart-connections/embeddings-test.json", JSON.stringify(this.embeddings));
      }else{
        log += "<br>No embeddings to test, writing test content to file."
        await this.app.vault.adapter.write(".smart-connections/embeddings-test.json", "test2");
      }
      // delete test file
      // await this.app.vault.adapter.remove(".smart-connections/embeddings-test.json");
      // return "File writing test passed."
      log += "<br>File writing test passed.";
    }catch(error) {
      // return error message
      log += "<br>File writing test failed: "+error;
    }
    return log;
  }
  
  // load failed files from failed-embeddings.txt
  async load_failed_files () {
    // check if failed-embeddings.txt exists
    const failed_embeddings_file_exists = await this.app.vault.adapter.exists(".smart-connections/failed-embeddings.txt");
    if(!failed_embeddings_file_exists) {
      this.settings.failed_files = [];
      console.log("No failed files.");
      return;
    }
    // read failed-embeddings.txt
    const failed_embeddings = await this.app.vault.adapter.read(".smart-connections/failed-embeddings.txt");
    // split failed_embeddings into array and remove empty lines
    const failed_embeddings_array = failed_embeddings.split("\r\n");
    // split at '#' and reduce into unique file paths
    const failed_files = failed_embeddings_array.map(embedding => embedding.split("#")[0]).reduce((unique, item) => unique.includes(item) ? unique : [...unique, item], []);
    // return failed_files
    this.settings.failed_files = failed_files;
    // console.log(failed_files);
  }
  // retry failed embeddings
  async retry_failed_files () {
    // remove failed files from failed_files
    this.settings.failed_files = [];
    // if failed-embeddings.txt exists then delete it
    const failed_embeddings_file_exists = await this.app.vault.adapter.exists(".smart-connections/failed-embeddings.txt");
    if(failed_embeddings_file_exists) {
      await this.app.vault.adapter.remove(".smart-connections/failed-embeddings.txt");
    }
    // run get all embeddings
    await this.get_all_embeddings();
  }


  // check if key from embeddings exists in files
  clean_up_embeddings(files) {
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


  async init_embeddings_file() {
    // check if folder exists
    if (!(await this.app.vault.adapter.exists(".smart-connections"))) {
      // create folder
      await this.app.vault.adapter.mkdir(".smart-connections");
      console.log("created folder: .smart-connections");
      // if .gitignore file exists then add .smart-connections to .gitignore
      await this.add_to_gitignore();
    }else{
      console.log("folder already exists: .smart-connections");
    }
    // check if embeddings file exists
    if (!(await this.app.vault.adapter.exists(".smart-connections/embeddings-2.json"))) {
      // create embeddings file
      await this.app.vault.adapter.write(".smart-connections/embeddings-2.json", "{}");
      console.log("created embeddings file: .smart-connections/embeddings-2.json");
    }else{
      console.log("embeddings file already exists: .smart-connections/embeddings-2.json");
    }
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

  // add .smart-connections to .gitignore to prevent issues with large, frequently updated embeddings file(s)
  async add_to_gitignore() {
    if(!(await this.app.vault.adapter.exists(".gitignore"))) {
      return; // if .gitignore doesn't exist then don't add .smart-connections to .gitignore
    }
    let gitignore_file = await this.app.vault.adapter.read(".gitignore");
    // if .smart-connections not in .gitignore
    if (gitignore_file.indexOf(".smart-connections") < 0) {
      // add .smart-connections to .gitignore
      let add_to_gitignore = "\n\n# Ignore Smart Connections folder because embeddings file is large and updated frequently";
      add_to_gitignore += "\n.smart-connections";
      await this.app.vault.adapter.write(".gitignore", gitignore_file + add_to_gitignore);
      console.log("added .smart-connections to .gitignore");
    }
  }

  // force refresh embeddings file but first rename existing embeddings file to .smart-connections/embeddings-YYYY-MM-DD.json
  async force_refresh_embeddings_file() {
    // get current datetime as unix timestamp
    let current_datetime = Math.floor(Date.now() / 1000);
    // rename existing embeddings file to .smart-connections/embeddings-YYYY-MM-DD.json
    await this.app.vault.adapter.rename(".smart-connections/embeddings-2.json", ".smart-connections/embeddings-"+current_datetime+".json");
    // create new embeddings file
    await this.app.vault.adapter.write(".smart-connections/embeddings-2.json", "{}");
    new Obsidian.Notice("Smart Connections: embeddings file Force Refreshed, making new connections...");
    // clear this.embeddings
    this.embeddings = null;
    this.embeddings = {};
    // trigger making new connections
    await this.get_all_embeddings();
    this.output_render_log();
    new Obsidian.Notice("Smart Connections: embeddings file Force Refreshed, new connections made.");
  }

  // get embeddings for embed_input
  async get_file_embeddings(curr_file, save=true) {
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
  update_render_log(blocks, file_embed_input) {
    if (blocks.length > 0) {
      // multiply by 2 because implies we saved token spending on blocks(sections), too
      this.render_log.tokens_saved_by_cache += file_embed_input.length / 2;
    } else {
      // calc tokens saved by cache: divide by 4 for token estimate
      this.render_log.tokens_saved_by_cache += file_embed_input.length / 4;
    }
  }
  
  // async get_embeddings(key, embed_input, meta={}) {
  //   const requestResults = await this.request_embedding_from_input(embed_input);
  //   // if requestResults is null then return
  //   if(!requestResults) {
  //     console.log("failed embedding: " + meta.path);
  //     // log failed file names to render_log
  //     this.render_log.failed_embeddings.push(meta.path);
  //     return;
  //   }
  //   // if requestResults is not null
  //   if(requestResults){
  //     // add embedding key to render_log
  //     if(this.settings.log_render){
  //       if(this.settings.log_render_files){
  //         this.render_log.files.push(meta);
  //       }
  //       this.render_log.new_embeddings++;
  //       // add token usage to render_log
  //       this.render_log.token_usage += requestResults.usage.total_tokens;
  //     }
  //     const vec = requestResults.data[0].embedding;
  //     if(vec) {
  //       this.embeddings[key] = {};
  //       this.embeddings[key].vec = vec;
  //       this.embeddings[key].meta = meta;
  //       this.embeddings[key].meta.tokens = requestResults.usage.total_tokens;
  //     }
  //   }
  // }

  async get_embeddings_batch(req_batch) {
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

  
  // md5 hash of embed_input using built in crypto module
  get_embed_hash(embed_input) {
    /**
     * TODO remove more/all whitespace from embed_input
     * - all newlines
     * - all tabs
     * - all spaces?
     */
    // trim excess whitespace
    embed_input = embed_input.trim();
    return crypto.createHash('md5').update(embed_input).digest("hex");
  }

  async request_embedding_from_input(embed_input, retries = 0) {
    // (FOR TESTING) test fail process by forcing fail
    // return null;
    // check if embed_input is a string
    // if(typeof embed_input !== "string") {
    //   console.log("embed_input is not a string");
    //   return null;
    // }
    // check if embed_input is empty
    if(embed_input.length === 0) {
      console.log("embed_input is empty");
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
      if((error.status === 429) && (retries < 3)) {
        retries++;
        // exponential backoff
        const backoff = Math.pow(retries, 2);
        console.log(`retrying request (429) in ${backoff} seconds...`);
        await new Promise(r => setTimeout(r, 1000 * backoff));
        return await this.request_embedding_from_input(embed_input, retries);
      }
      // log full error to console
      console.log(resp);
      // console.log("first line of embed: " + embed_input.substring(0, embed_input.indexOf("\n")));
      // console.log("embed input length: "+ embed_input.length);
      // if(Array.isArray(embed_input)) {
      //   console.log(embed_input.map((input) => input.length));
      // }
      // console.log("erroneous embed input: " + embed_input);
      console.log(error);
      // console.log(usedParams);
      // console.log(usedParams.input.length);
      return null; 
    }
  }
  async test_api_key() {
    const embed_input = "This is a test of the OpenAI API.";
    const resp = await this.request_embedding_from_input(embed_input);
    if(resp && resp.usage) {
      console.log("API key is valid");
      return true;
    }else{
      console.log("API key is invalid");
      return false;
    }
  }

  find_nearest_embedding(to_vec, to_key=null) {
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
    this.render_log.failed_embeddings = [];
    this.render_log.files = [];
    this.render_log.new_embeddings = 0;
    this.render_log.skipped_low_delta = {};
    this.render_log.token_usage = 0;
    this.render_log.tokens_saved_by_cache = 0;
  }

  // find connections by most similar to current note by cosine similarity
  async find_note_connections(current_note=null) {
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
  
  // create render_log object of exlusions with number of times skipped as value
  log_exclusion(exclusion) {
    // increment render_log for skipped file
    this.render_log.exclusions_logs[exclusion] = (this.render_log.exclusions_logs[exclusion] || 0) + 1;
  }

  onunload() {
    this.output_render_log();
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

  block_parser(markdown, file_path){
    // if this.settings.skip_sections is true then return empty array
    if(this.settings.skip_sections) {
      return [];
    }
    // split the markdown into lines
    const lines = markdown.split('\n');
    // initialize the blocks array
    let blocks = [];
    // current headers array
    let currentHeaders = [];
    // remove .md file extension and convert file_path to breadcrumb formatting
    const file_breadcrumbs = file_path.replace('.md', '').replace(/\//g, ' > ');
    // initialize the block string
    let block = '';
    let block_headings = '';
    let block_path = file_path;

    let last_heading_line = 0;
    let i = 0;
    let block_headings_list = [];
    // loop through the lines
    for (i = 0; i < lines.length; i++) {
      // get the line
      const line = lines[i];
      // if line does not start with #
      // or if line starts with # and second character is a word or number indicating a "tag"
      // then add to block
      if (!line.startsWith('#') || (['#',' '].indexOf(line[1]) < 0)){
        // skip if line is empty
        if(line === '') continue;
        // skip if line is empty bullet or checkbox
        if(['- ', '- [ ] '].indexOf(line) > -1) continue;
        // if currentHeaders is empty skip (only blocks with headers, otherwise block.path conflicts with file.path)
        if(currentHeaders.length === 0) continue;
        // add line to block
        block += "\n" + line;
        continue;
      }
      /**
       * BEGIN Heading parsing
       * - likely a heading if made it this far
       */
      last_heading_line = i;
      // push the current block to the blocks array unless last line was a also a header
      if(i > 0 && (last_heading_line !== (i-1)) && (block.indexOf("\n") > -1) && this.validate_headings(block_headings)) {
        output_block();
      }
      // get the header level
      const level = line.split('#').length - 1;
      // remove any headers from the current headers array that are higher than the current header level
      currentHeaders = currentHeaders.filter(header => header.level < level);
      // add header and level to current headers array
      // trim the header to remove "#" and any trailing spaces
      currentHeaders.push({header: line.replace(/#/g, '').trim(), level: level});
      // initialize the block breadcrumbs with file.path the current headers
      block = file_breadcrumbs;
      block += ": " + currentHeaders.map(header => header.header).join(' > ');
      block_headings = "#"+currentHeaders.map(header => header.header).join('#');
      // if block_headings is already in block_headings_list then add a number to the end
      if(block_headings_list.indexOf(block_headings) > -1) {
        let count = 1;
        while(block_headings_list.indexOf(`${block_headings}{${count}}`) > -1) {
          count++;
        }
        block_headings = `${block_headings}{${count}}`;
      }
      block_headings_list.push(block_headings);
      block_path = file_path + block_headings;
    }
    // handle remaining after loop
    if((last_heading_line !== (i-1)) && (block.indexOf("\n") > -1) && this.validate_headings(block_headings)) output_block();
    // remove any blocks that are too short (length < 50)
    blocks = blocks.filter(b => b.length > 50);
    // console.log(blocks);
    // return the blocks array
    return blocks;

    function output_block() {
      // breadcrumbs length (first line of block)
      const breadcrumbs_length = block.indexOf("\n") + 1;
      const block_length = block.length - breadcrumbs_length;
      // trim block to max length
      if (block.length > MAX_EMBED_STRING_LENGTH) {
        block = block.substring(0, MAX_EMBED_STRING_LENGTH);
      }
      blocks.push({ text: block.trim(), path: block_path, length: block_length });
    }
  }
  // reverse-retrieve block given path
  async block_retriever(path, limits={}) {
    limits = {
      lines: null,
      chars_per_line: null,
      max_chars: null,
      ...limits
    }
    // return if no # in path
    if (path.indexOf('#') < 0) {
      console.log("not a block path: "+path);
      return false;
    }
    let block = [];
    let block_headings = path.split('#').slice(1);
    // if path ends with number in curly braces
    let heading_occurrence = 0;
    if(block_headings[block_headings.length-1].indexOf('{') > -1) {
      // get the occurrence number
      heading_occurrence = parseInt(block_headings[block_headings.length-1].split('{')[1].replace('}', ''));
      // remove the occurrence from the last heading
      block_headings[block_headings.length-1] = block_headings[block_headings.length-1].split('{')[0];
    }
    let currentHeaders = [];
    let occurrence_count = 0;
    let begin_line = 0;
    let i = 0;
    // get file path from path
    const file_path = path.split('#')[0];
    // get file
    const file = this.app.vault.getAbstractFileByPath(file_path);
    if(!(file instanceof Obsidian.TFile)) {
      console.log("not a file: "+file_path);
      return false;
    }
    // get file contents
    const file_contents = await this.app.vault.cachedRead(file);
    // split the file contents into lines
    const lines = file_contents.split('\n');
    // loop through the lines
    let is_code = false;
    for (i = 0; i < lines.length; i++) {
      // get the line
      const line = lines[i];
      // if line begins with three backticks then toggle is_code
      if(line.indexOf('```') === 0) {
        is_code = !is_code;
      }
      // if is_code is true then add line with preceding tab and continue
      if(is_code) {
        continue;
      }
      // skip if line is empty bullet or checkbox
      if(['- ', '- [ ] '].indexOf(line) > -1) continue;
      // if line does not start with #
      // or if line starts with # and second character is a word or number indicating a "tag"
      // then continue to next line
      if (!line.startsWith('#') || (['#',' '].indexOf(line[1]) < 0)){
        continue;
      }
      /**
       * BEGIN Heading parsing
       * - likely a heading if made it this far
       */
      // get the heading text
      const heading_text = line.replace(/#/g, '').trim();
      // continue if heading text is not in block_headings
      const heading_index = block_headings.indexOf(heading_text);
      if (heading_index < 0) continue;
      // if currentHeaders.length !== heading_index then we have a mismatch
      if (currentHeaders.length !== heading_index) continue;
      // push the heading text to the currentHeaders array
      currentHeaders.push(heading_text);
      // if currentHeaders.length === block_headings.length then we have a match
      if (currentHeaders.length === block_headings.length) {
        // if heading_occurrence is defined then increment occurrence_count
        if(heading_occurrence === 0) {
          // set begin_line to i + 1
          begin_line = i + 1;
          break; // break out of loop
        }
        // if occurrence_count !== heading_occurrence then continue
        if(occurrence_count === heading_occurrence){
          begin_line = i + 1;
          break; // break out of loop
        }
        occurrence_count++;
        // reset currentHeaders
        currentHeaders.pop();
        continue;
      }
    }
    // if no begin_line then return false
    if (begin_line === 0) return false;
    // iterate through lines starting at begin_line
    is_code = false;
    // character accumulator
    let char_count = 0;
    for (i = begin_line; i < lines.length; i++) {
      if((typeof line_limit === "number") && (block.length > line_limit)){
        block.push("...");
        break; // ends when line_limit is reached
      }
      let line = lines[i];
      if ((line.indexOf('#') === 0) && (['#',' '].indexOf(line[1]) !== -1)){
        break; // ends when encountering next header
      }
      // DEPRECATED: should be handled by new_line+char_count check (happens in previous iteration)
      // if char_count is greater than limit.max_chars, skip
      if (limits.max_chars && char_count > limits.max_chars) {
        block.push("...");
        break;
      }
      // if new_line + char_count is greater than limit.max_chars, skip
      if (limits.max_chars && ((line.length + char_count) > limits.max_chars)) {
        const max_new_chars = limits.max_chars - char_count;
        line = line.slice(0, max_new_chars) + "...";
        break;
      }
      // validate/format
      // if line is empty, skip
      if (line.length === 0) continue;
      // limit length of line to N characters
      if (limits.chars_per_line && line.length > limits.chars_per_line) {
        line = line.slice(0, limits.chars_per_line) + "...";
      }
      // if line is a code block, skip
      if (line.startsWith("```")) {
        is_code = !is_code;
        continue;
      }
      if (is_code){
        // add tab to beginning of line
        line = "\t"+line;
      }
      // add line to block
      block.push(line);
      // increment char_count
      char_count += line.length;
    }
    // close code block if open
    if (is_code) {
      block.push("```");
    }
    return block.join("\n").trim();
  }

  // retrieve a file from the vault
  async file_retriever(link, limits={}) {
    limits = {
      lines: null,
      max_chars: null,
      chars_per_line: null,
      ...limits
    };
    const this_file = this.app.vault.getAbstractFileByPath(link);
    // if file is not found, skip
    if (!(this_file instanceof Obsidian.TAbstractFile)) return false;
    // use cachedRead to get the first 10 lines of the file
    const file_content = await this.app.vault.cachedRead(this_file);
    const file_lines = file_content.split("\n");
    let first_ten_lines = [];
    let is_code = false;
    let char_accum = 0;
    const line_limit = limits.lines || file_lines.length;
    for (let i = 0; first_ten_lines.length < line_limit; i++) {
      let line = file_lines[i];
      // if line is undefined, break
      if (typeof line === 'undefined')
        break;
      // if line is empty, skip
      if (line.length === 0)
        continue;
      // limit length of line to N characters
      if (limits.chars_per_line && line.length > limits.chars_per_line) {
        line = line.slice(0, limits.chars_per_line) + "...";
      }
      // if line is "---", skip
      if (line === "---")
        continue;
      // skip if line is empty bullet or checkbox
      if (['- ', '- [ ] '].indexOf(line) > -1)
        continue;
      // if line is a code block, skip
      if (line.indexOf("```") === 0) {
        is_code = !is_code;
        continue;
      }
      // if char_accum is greater than limit.max_chars, skip
      if (limits.max_chars && char_accum > limits.max_chars) {
        first_ten_lines.push("...");
        break;
      }
      if (is_code) {
        // if is code, add tab to beginning of line
        line = "\t" + line;
      }
      // if line is a heading
      if (line_is_heading(line)) {
        // look at last line in first_ten_lines to see if it is a heading
        // note: uses last in first_ten_lines, instead of look ahead in file_lines, because..
        // ...next line may be excluded from first_ten_lines by previous if statements
        if ((first_ten_lines.length > 0) && line_is_heading(first_ten_lines[first_ten_lines.length - 1])) {
          // if last line is a heading, remove it
          first_ten_lines.pop();
        }
      }
      // add line to first_ten_lines
      first_ten_lines.push(line);
      // increment char_accum
      char_accum += line.length;
    }
    // for each line in first_ten_lines, apply view-specific formatting
    for (let i = 0; i < first_ten_lines.length; i++) {
      // if line is a heading
      if (line_is_heading(first_ten_lines[i])) {
        // if this is the last line in first_ten_lines
        if (i === first_ten_lines.length - 1) {
          // remove the last line if it is a heading
          first_ten_lines.pop();
          break;
        }
        // remove heading syntax to improve readability in small space
        first_ten_lines[i] = first_ten_lines[i].replace(/#+/, "");
        first_ten_lines[i] = `\n${first_ten_lines[i]}:`;
      }
    }
    // join first ten lines into string
    first_ten_lines = first_ten_lines.join("\n");
    return first_ten_lines;
  }

  // iterate through blocks and skip if block_headings contains this.header_exclusions
  validate_headings(block_headings) {
    let valid = true;
    if (this.header_exclusions.length > 0) {
      for (let k = 0; k < this.header_exclusions.length; k++) {
        if (block_headings.indexOf(this.header_exclusions[k]) > -1) {
          valid = false;
          this.log_exclusion("heading: "+this.header_exclusions[k]);
          break;
        }
      }
    }
    return valid;
  }
  // render "Smart Connections" text fixed in the bottom right corner
  render_brand(container) {
    // brand container
    const brand_container = container.createEl("div", { cls: "sc-brand" });
    // add text
    // add SVG signal icon using getIcon
    Obsidian.setIcon(brand_container, "smart-connections");
    const brand_p = brand_container.createEl("p");
    let text = "Smart Connections";
    let attr = {};
    // if update available, change text to "Update Available"
    if (this.update_available) {
      text = "Update Available";
      attr = {
        style: "font-weight: 700;"
      };
    }
    brand_p.createEl("a", {
      cls: "",
      text: text,
      href: "https://github.com/brianpetro/obsidian-smart-connections/discussions",
      target: "_blank",
      attr: attr
    });
  }


  // create list of nearest notes
  async update_results(container, nearest) {
    let list;
    // check if list exists
    if((container.children.length > 1) && (container.children[1].classList.contains("sc-list"))){
      list = container.children[1];
    }
    // if list exists, empty it
    if (list) {
      list.empty();
    } else {
      // create list element
      list = container.createEl("div", { cls: "sc-list" });
    }
    let search_result_class = "search-result";
    // if settings expanded_view is false, add sc-collapsed class
    if(!this.settings.expanded_view) search_result_class += " sc-collapsed";

    // TODO: add option to group nearest by file
    if(!this.settings.group_nearest_by_file) {
      // for each nearest note
      for (let i = 0; i < nearest.length; i++) {
        /**
         * BEGIN EXTERNAL LINK LOGIC
         * if link is an object, it indicates external link
         */
        if (typeof nearest[i].link === "object") {
          const item = list.createEl("div", { cls: "search-result" });
          const link = item.createEl("a", {
            cls: "search-result-file-title is-clickable",
            href: nearest[i].link.path,
            title: nearest[i].link.title,
          });
          link.innerHTML = this.render_external_link_elm(nearest[i].link);
          item.setAttr('draggable', 'true')
          continue; // ends here for external links
        }
        /**
         * BEGIN INTERNAL LINK LOGIC
         * if link is a string, it indicates internal link
         */
        let file_link_text;
        const file_similarity_pct = Math.round(nearest[i].similarity * 100) + "%";
        if(this.settings.show_full_path) {
          const pcs = nearest[i].link.split("/");
          file_link_text = pcs[pcs.length - 1];
          const path = pcs.slice(0, pcs.length - 1).join("/");
          // file_link_text = `<small>${path} | ${file_similarity_pct}</small><br>${file_link_text}`;
          file_link_text = `<small>${file_similarity_pct} | ${path} | ${file_link_text}</small>`;
        }else{
          file_link_text = '<small>' + file_similarity_pct + " | " + nearest[i].link.split("/").pop() + '</small>';
        }
        // skip contents rendering if incompatible file type
        // ex. not markdown file or contains no '.excalidraw'
        if(!this.renderable_file_type(nearest[i].link)){
          const item = list.createEl("div", { cls: "search-result" });
          const link = item.createEl("a", {
            cls: "search-result-file-title is-clickable",
            href: nearest[i].link,
          });
          link.innerHTML = file_link_text;
          // drag and drop
          item.setAttr('draggable', 'true')
          // add listeners to link
          this.add_link_listeners(link, nearest[i], item);
          continue;
        }

        // remove file extension if .md and make # into >
        file_link_text = file_link_text.replace(".md", "").replace(/#/g, " > ");
        // create item
        const item = list.createEl("div", { cls: search_result_class });
        // create span for toggle
        const toggle = item.createEl("span", { cls: "is-clickable" });
        // insert right triangle svg as toggle
        Obsidian.setIcon(toggle, "right-triangle"); // must come before adding other elms to prevent overwrite
        const link = toggle.createEl("a", {
          cls: "search-result-file-title",
          title: nearest[i].link,
        });
        link.innerHTML = file_link_text;
        // add listeners to link
        this.add_link_listeners(link, nearest[i], item);
        toggle.addEventListener("click", (event) => {
          // find parent containing search-result class
          let parent = event.target.parentElement;
          while (!parent.classList.contains("search-result")) {
            parent = parent.parentElement;
          }
          // toggle sc-collapsed class
          parent.classList.toggle("sc-collapsed");
        });
        const contents = item.createEl("ul", { cls: "" });
        const contents_container = contents.createEl("li", {
          cls: "search-result-file-title is-clickable",
          title: nearest[i].link,
        });
        if(nearest[i].link.indexOf("#") > -1){ // is block
          Obsidian.MarkdownRenderer.renderMarkdown((await this.block_retriever(nearest[i].link, {lines: 10, max_chars: 1000})), contents_container, nearest[i].link, void 0);
        }else{ // is file
          const first_ten_lines = await this.file_retriever(nearest[i].link, {lines: 10, max_chars: 1000});
          if(!first_ten_lines) continue; // skip if file is empty
          Obsidian.MarkdownRenderer.renderMarkdown(first_ten_lines, contents_container, nearest[i].link, void 0);
        }
        this.add_link_listeners(contents, nearest[i], item);
      }
      this.render_brand(container);
      return;
    }

    // group nearest by file
    const nearest_by_file = {};
    for (let i = 0; i < nearest.length; i++) {
      const curr = nearest[i];
      const link = curr.link;
      // skip if link is an object (indicates external logic)
      if (typeof link === "object") {
        nearest_by_file[link.path] = [curr];
        continue;
      }
      if (link.indexOf("#") > -1) {
        const file_path = link.split("#")[0];
        if (!nearest_by_file[file_path]) {
          nearest_by_file[file_path] = [];
        }
        nearest_by_file[file_path].push(nearest[i]);
      } else {
        if (!nearest_by_file[link]) {
          nearest_by_file[link] = [];
        }
        // always add to front of array
        nearest_by_file[link].unshift(nearest[i]);
      }
    }
    // for each file
    const keys = Object.keys(nearest_by_file);
    for (let i = 0; i < keys.length; i++) {
      const file = nearest_by_file[keys[i]];
      /**
       * Begin external link handling
       */
      // if link is an object (indicates v2 logic)
      if (typeof file[0].link === "object") {
        const curr = file[0];
        const meta = curr.link;
        if (meta.path.startsWith("http")) {
          const item = list.createEl("div", { cls: "search-result" });
          const link = item.createEl("a", {
            cls: "search-result-file-title is-clickable",
            href: meta.path,
            title: meta.title,
          });
          link.innerHTML = this.render_external_link_elm(meta);
          item.setAttr('draggable', 'true');
          continue; // ends here for external links
        }
      }
      /**
       * Handles Internal
       */
      let file_link_text;
      const file_similarity_pct = Math.round(file[0].similarity * 100) + "%";
      if (this.settings.show_full_path) {
        const pcs = file[0].link.split("/");
        file_link_text = pcs[pcs.length - 1];
        const path = pcs.slice(0, pcs.length - 1).join("/");
        file_link_text = `<small>${path} | ${file_similarity_pct}</small><br>${file_link_text}`;
      } else {
        file_link_text = file[0].link.split("/").pop();
        // add similarity percentage
        file_link_text += ' | ' + file_similarity_pct;
      }


        
      // skip contents rendering if incompatible file type
      // ex. not markdown or contains '.excalidraw'
      if(!this.renderable_file_type(file[0].link)) {
        const item = list.createEl("div", { cls: "search-result" });
        const file_link = item.createEl("a", {
          cls: "search-result-file-title is-clickable",
          title: file[0].link,
        });
        file_link.innerHTML = file_link_text;
        // add link listeners to file link
        this.add_link_listeners(file_link, file[0], item);
        continue;
      }


      // remove file extension if .md
      file_link_text = file_link_text.replace(".md", "").replace(/#/g, " > ");
      const item = list.createEl("div", { cls: search_result_class });
      const toggle = item.createEl("span", { cls: "is-clickable" });
      // insert right triangle svg icon as toggle button in span
      Obsidian.setIcon(toggle, "right-triangle"); // must come before adding other elms else overwrites
      const file_link = toggle.createEl("a", {
        cls: "search-result-file-title",
        title: file[0].link,
      });
      file_link.innerHTML = file_link_text;
      // add link listeners to file link
      this.add_link_listeners(file_link, file[0], toggle);
      toggle.addEventListener("click", (event) => {
        // find parent containing class search-result
        let parent = event.target;
        while (!parent.classList.contains("search-result")) {
          parent = parent.parentElement;
        }
        parent.classList.toggle("sc-collapsed");
        // TODO: if block container is empty, render markdown from block retriever
      });
      const file_link_list = item.createEl("ul");
      // for each link in file
      for (let j = 0; j < file.length; j++) {
        // if is a block (has # in link)
        if(file[j].link.indexOf("#") > -1) {
          const block = file[j];
          const block_link = file_link_list.createEl("li", {
            cls: "search-result-file-title is-clickable",
            title: block.link,
          });
          // skip block context if file.length === 1 because already added
          if(file.length > 1) {
            const block_context = this.render_block_context(block);
            const block_similarity_pct = Math.round(block.similarity * 100) + "%";
            block_link.innerHTML = `<small>${block_context} | ${block_similarity_pct}</small>`;
          }
          const block_container = block_link.createEl("div");
          // TODO: move to rendering on expanding section (toggle collapsed)
          Obsidian.MarkdownRenderer.renderMarkdown((await this.block_retriever(block.link, {lines: 10, max_chars: 1000})), block_container, block.link, void 0);
          // add link listeners to block link
          this.add_link_listeners(block_link, block, file_link_list);
        }else{
          // get first ten lines of file
          const file_link_list = item.createEl("ul");
          const block_link = file_link_list.createEl("li", {
            cls: "search-result-file-title is-clickable",
            title: file[0].link,
          });
          const block_container = block_link.createEl("div");
          let first_ten_lines = await this.file_retriever(file[0].link, {lines: 10, max_chars: 1000});
          if(!first_ten_lines) continue; // if file not found, skip
          Obsidian.MarkdownRenderer.renderMarkdown(first_ten_lines, block_container, file[0].link, void 0);
          this.add_link_listeners(block_link, file[0], file_link_list);

        }
      }
    }
    this.render_brand(container);
  }

  add_link_listeners(item, curr, list) {
    item.addEventListener("click", async (event) => {
      await this.handle_click(curr, event);
    });
    // drag-on
    // currently only works with full-file links
    item.setAttr('draggable', 'true');
    item.addEventListener('dragstart', (event) => {
      const dragManager = this.app.dragManager;
      const file_path = curr.link.split("#")[0];
      const file = this.app.metadataCache.getFirstLinkpathDest(file_path, '');
      const dragData = dragManager.dragFile(event, file);
      // console.log(dragData);
      dragManager.onDragStart(event, dragData);
    });
    // if curr.link contains curly braces, return (incompatible with hover-link)
    if (curr.link.indexOf("{") > -1) return;
    // trigger hover event on link
    item.addEventListener("mouseover", (event) => {
      this.app.workspace.trigger("hover-link", {
        event,
        source: SMART_CONNECTIONS_VIEW_TYPE,
        hoverParent: list,
        targetEl: item,
        linktext: curr.link,
      });
    });
  }


  // get target file from link path
  // if sub-section is linked, open file and scroll to sub-section
  async handle_click(curr, event) {
    let targetFile;
    let heading;
    if (curr.link.indexOf("#") > -1) {
      // remove after # from link
      targetFile = this.app.metadataCache.getFirstLinkpathDest(curr.link.split("#")[0], "");
      // console.log(targetFile);
      const target_file_cache = this.app.metadataCache.getFileCache(targetFile);
      // console.log(target_file_cache);
      // get heading
      let heading_text = curr.link.split("#").pop();
      // if heading text contains a curly brace, get the number inside the curly braces as occurence
      let occurence = 0;
      if (heading_text.indexOf("{") > -1) {
        // get occurence
        occurence = parseInt(heading_text.split("{")[1].split("}")[0]);
        // remove occurence from heading text
        heading_text = heading_text.split("{")[0];
      }
      // get headings from file cache
      const headings = target_file_cache.headings;
      // get headings with the same depth and text as the link
      for(let i = 0; i < headings.length; i++) {
        if (headings[i].heading === heading_text) {
          // if occurence is 0, set heading and break
          if(occurence === 0) {
            heading = headings[i];
            break;
          }
          occurence--; // decrement occurence
        }
      }
      // console.log(heading);
    } else {
      targetFile = this.app.metadataCache.getFirstLinkpathDest(curr.link, "");
    }
    // properly handle if the meta/ctrl key is pressed
    const mod = Obsidian.Keymap.isModEvent(event);
    // get most recent leaf
    let leaf = this.app.workspace.getLeaf(mod);
    await leaf.openFile(targetFile);
    if (heading) {
      let { editor } = leaf.view;
      const pos = { line: heading.position.start.line, ch: 0 };
      editor.setCursor(pos);
      editor.scrollIntoView({ to: pos, from: pos }, true);
    }
  }

  render_block_context(block) {
    const block_headings = block.link.split(".md")[1].split("#");
    // starting with the last heading first, iterate through headings
    let block_context = "";
    for (let i = block_headings.length - 1; i >= 0; i--) {
      if(block_context.length > 0) {
        block_context = ` > ${block_context}`;
      }
      block_context = block_headings[i] + block_context;
      // if block context is longer than N characters, break
      if (block_context.length > 100) {
        break;
      }
    }
    // remove leading > if exists
    if (block_context.startsWith(" > ")) {
      block_context = block_context.slice(3);
    }
    return block_context;

  }

  renderable_file_type(link) {
    return (link.indexOf(".md") !== -1) && (link.indexOf(".excalidraw") === -1);
  }

  render_external_link_elm(meta){
    if(meta.source) {
      if(meta.source === "Gmail") meta.source = "📧 Gmail";
      return `<small>${meta.source}</small><br>${meta.title}`;
    }
    // remove http(s)://
    let domain = meta.path.replace(/(^\w+:|^)\/\//, "");
    // separate domain from path
    domain = domain.split("/")[0];
    // wrap domain in <small> and add line break
    return `<small>🌐 ${domain}</small><br>${meta.title}`;
  }

}

const SMART_CONNECTIONS_VIEW_TYPE = "smart-connections-view";
class SmartConnectionsView extends Obsidian.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.nearest = null;
    this.load_wait = null;
  }
  getViewType() {
    return SMART_CONNECTIONS_VIEW_TYPE;
  }

  getDisplayText() {
    return "Smart Connections Files";
  }

  getIcon() {
    return "smart-connections";
  }


  set_message(message) {
    const container = this.containerEl.children[1];
    // clear container
    container.empty();
    // initiate top bar
    this.initiate_top_bar(container);
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
    /**
     * Begin internal links
     */
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


  set_nearest(nearest, nearest_context=null, results_only=false) {
    // get container element
    const container = this.containerEl.children[1];
    // if results only is false, clear container and initiate top bar
    if(!results_only){
      // clear container
      container.empty();
      this.initiate_top_bar(container, nearest_context);
    }
    // update results
    this.plugin.update_results(container, nearest);
  }

  initiate_top_bar(container, nearest_context=null) {
    let top_bar;
    // if top bar already exists, empty it
    if ((container.children.length > 0) && (container.children[0].classList.contains("sc-top-bar"))) {
      top_bar = container.children[0];
      top_bar.empty();
    } else {
      // init container for top bar
      top_bar = container.createEl("div", { cls: "sc-top-bar" });
    }
    // if highlighted text is not null, create p element with highlighted text
    if (nearest_context) {
      top_bar.createEl("p", { cls: "sc-context", text: nearest_context });
    }
    // add chat button
    const chat_button = top_bar.createEl("button", { cls: "sc-chat-button" });
    // add icon to chat button
    Obsidian.setIcon(chat_button, "message-square");
    // add click listener to chat button
    chat_button.addEventListener("click", () => {
      // open chat
      this.plugin.open_chat();
    });
    // add search button
    const search_button = top_bar.createEl("button", { cls: "sc-search-button" });
    // add icon to search button
    Obsidian.setIcon(search_button, "search");
    // add click listener to search button
    search_button.addEventListener("click", () => {
      // empty top bar
      top_bar.empty();
      // create input element
      const search_container = top_bar.createEl("div", { cls: "search-input-container" });
      const input = search_container.createEl("input", {
        cls: "sc-search-input",
        type: "search",
        placeholder: "Type to start search...", 
      });
      // focus input
      input.focus();
      // add keydown listener to input
      input.addEventListener("keydown", (event) => {
        // if escape key is pressed
        if (event.key === "Escape") {
          this.clear_auto_searcher();
          // clear top bar
          this.initiate_top_bar(container, nearest_context);
        }
      });

      // add keyup listener to input
      input.addEventListener("keyup", (event) => {
        // if this.search_timeout is not null then clear it and set to null
        this.clear_auto_searcher();
        // get search term
        const search_term = input.value;
        // if enter key is pressed
        if (event.key === "Enter" && search_term !== "") {
          this.search(search_term);
        }
        // if any other key is pressed and input is not empty then wait 500ms and make_connections
        else if (search_term !== "") {
          // clear timeout
          clearTimeout(this.search_timeout);
          // set timeout
          this.search_timeout = setTimeout(() => {
            this.search(search_term, true);
          }, 700);
        }
      });
    });
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
      await this.render_connections();
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

    // runs when file is opened
    this.registerEvent(this.app.workspace.on('file-open', (file) => {
      // if no file is open, return
      if(!file) {
        // console.log("no file open, returning");
        return;
      }
      // return if file type is not markdown
      if(file.extension !== "md") {
        // if file is 'canvas' and length of current view content is greater than 300 then return
        if((file.extension === "canvas") && (container.innerHTML.length > 1000)) {
          // prevents clearing view of search results when still on the same canvas
          // console.log("prevented clearing view of search results when still on the same canvas")
          return;
        }
        return this.set_message([
          "File: "+file.name
          ,"Smart Connections only works with Markdown files."
        ]);
      }
      // run render_connections after 1 second to allow for file to load
      if(this.load_wait){
        clearTimeout(this.load_wait);
      }
      this.load_wait = setTimeout(() => {
        this.render_connections(file);
        this.load_wait = null;
      }, 1000);
        
    }));

    this.app.workspace.registerHoverLinkSource(SMART_CONNECTIONS_VIEW_TYPE, {
        display: 'Smart Connections Files',
        defaultMod: true,
    });

    this.app.workspace.onLayoutReady(this.initialize.bind(this));
    
  }
  
  async initialize() {
    await this.load_embeddings_file();
    await this.render_connections();

    /**
     * EXPERIMENTAL
     * - window-based API access
     * - code-block rendering
     */
    this.api = new SmartConnectionsViewApi(this.app, this.plugin, this);
    // register API to global window object
    (window["SmartConnectionsViewApi"] = this.api) && this.register(() => delete window["SmartConnectionsViewApi"]);

  }

  async onClose() {
    this.app.workspace.unregisterHoverLinkSource(SMART_CONNECTIONS_VIEW_TYPE);
    this.plugin.view = null;
  }

  async render_connections(context=null) {
    // if API key is not set then update view message
    if(!this.plugin.settings.api_key) {
      this.set_message("An OpenAI API key is required to make Smart Connections");
      return;
    }
    if(!this.plugin.embeddings){
      await this.load_embeddings_file();
    }
    this.set_message("Making Smart Connections...");
    /**
     * Begin highlighted-text-level search
     */
    if(typeof context === "string") {
      const highlighted_text = context;
      // get embedding for highlighted text
      await this.search(highlighted_text);
      return; // ends here if context is a string
    }

    /** 
     * Begin file-level search
     */    
    this.nearest = null;
    this.interval_count = 0;
    this.rendering = false;
    this.file = context;
    // if this.interval is set then clear it
    if(this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    // set interval to check if nearest is set
    this.interval = setInterval(() => {
      if(!this.rendering){
        if(this.file instanceof Obsidian.TFile) {
          this.rendering = true;
          this.render_note_connections(this.file);
        }else{
          // get current note
          this.file = this.app.workspace.getActiveFile();
          // if still no current note then return
          if(!this.file && this.count > 1) {
            clearInterval(this.interval);
            this.set_message("No active file");
            return; 
          }
        }
      }else{
        if(this.nearest) {
          clearInterval(this.interval);
          // if nearest is a string then update view message
          if (typeof this.nearest === "string") {
            this.set_message(this.nearest);
          } else {
            // set nearest connections
            this.set_nearest(this.nearest, "File: " + this.file.name);
          }
          // if render_log.failed_embeddings then update failed_embeddings.txt
          if (this.plugin.render_log.failed_embeddings.length > 0) {
            this.plugin.save_failed_embeddings();
          }
          // get object keys of render_log
          this.plugin.output_render_log();
          return; 
        }else{
          this.interval_count++;
          this.set_message("Making Smart Connections..."+this.interval_count);
        }
      }
    }, 10);
  }

  async render_note_connections(file) {
    this.nearest = await this.plugin.find_note_connections(file);
  }

  clear_auto_searcher() {
    if (this.search_timeout) {
      clearTimeout(this.search_timeout);
      this.search_timeout = null;
    }
  }

  async search(search_text, results_only=false) {
    const nearest = await this.plugin.api.search(search_text);
    // render results in view with first 100 characters of search text
    const nearest_context = `Selection: "${search_text.length > 100 ? search_text.substring(0, 100) + "..." : search_text}"`;
    this.set_nearest(nearest, nearest_context, results_only);
  }

  async load_embeddings_file(retries=0) {
    this.set_message("Loading embeddings file...");
    try {
      // handle migrating
      if(retries === 3) {
        // if embeddings-2.json does not exist then check for embeddings.json
        if(await this.app.vault.adapter.exists(".smart-connections/embeddings.json")) {
          // migrate embeddings.json to embeddings-2.json
          this.set_message("Migrating embeddings.json to embeddings-2.json...");
          await this.plugin.migrate_embeddings_to_v2();
          // retry loading embeddings-2.json
          await this.load_embeddings_file();
          return;
        }
      }
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

class SmartConnectionsViewApi {
  constructor(app, plugin, view) {
    this.app = app;
    this.plugin = plugin;
    this.view = view;
  }
  async search (search_text) {
    return await this.plugin.api.search(search_text);
  }
  // trigger reload of embeddings file
  async reload_embeddings_file() {
    await this.view.load_embeddings_file();
    await this.view.render_connections();
  }
  
}
class ScSearchApi {
  constructor(app, plugin) {
    this.app = app;
    this.plugin = plugin;
  }
  async search (search_text) {
    let nearest = [];
    const resp = await this.plugin.request_embedding_from_input(search_text);
    if (resp && resp.data && resp.data[0] && resp.data[0].embedding) {
      nearest = this.plugin.find_nearest_embedding(resp.data[0].embedding);
    } else {
      // resp is null, undefined, or missing data
      new Obsidian.Notice("Smart Connections: Error getting embedding");
    }
    return nearest;
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
      this.plugin.settings.api_key = value.trim();
      await this.plugin.saveSettings(true);
    }));
    // add a button to test the API key is working
    new Obsidian.Setting(containerEl).setName("Test API Key").setDesc("Test API Key").addButton((button) => button.setButtonText("Test API Key").onClick(async () => {
      // test API key
      const resp = await this.plugin.test_api_key();
      if(resp) {
        new Obsidian.Notice("Smart Connections: API key is valid");
      }else{
        new Obsidian.Notice("Smart Connections: API key is not working as expected!");
      }
    }));
    // add dropdown to select the model
    new Obsidian.Setting(containerEl).setName("Smart Chat Model").setDesc("Select a model to use with Smart Chat.").addDropdown((dropdown) => {
      dropdown.addOption("gpt-3.5-turbo", "gpt-3.5-turbo");
      dropdown.addOption("gpt-4", "gpt-4 (limited access)");
      dropdown.onChange(async (value) => {
        this.plugin.settings.smart_chat_model = value;
        await this.plugin.saveSettings();
      });
      dropdown.setValue(this.plugin.settings.smart_chat_model);
    });
    // language
    new Obsidian.Setting(containerEl).setName("Default Language").setDesc("Default language to use for Smart Chat. Changes which self-referential pronouns will trigger lookup of your notes.").addDropdown((dropdown) => {
      // get Object keys from pronous
      const languages = Object.keys(SMART_TRANSLATION);
      for(let i = 0; i < languages.length; i++) {
        dropdown.addOption(languages[i], languages[i]);
      }
      dropdown.onChange(async (value) => {
        this.plugin.settings.language = value;
        await this.plugin.saveSettings();
        self_ref_pronouns_list.setText(this.get_self_ref_list());
        // if chat view is open then run new_chat()
        const chat_view = this.app.workspace.getLeavesOfType(SMART_CONNECTIONS_CHAT_VIEW_TYPE).length > 0 ? this.app.workspace.getLeavesOfType(SMART_CONNECTIONS_CHAT_VIEW_TYPE)[0].view : null;
        if(chat_view) {
          chat_view.new_chat();
        }
      });
      dropdown.setValue(this.plugin.settings.language);
    });
    // list current self-referential pronouns
    const self_ref_pronouns_list = containerEl.createEl("span", {
      text: this.get_self_ref_list()
    });
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
    // toggle expanded view by default
    new Obsidian.Setting(containerEl).setName("expanded_view").setDesc("Expanded view by default.").addToggle((toggle) => toggle.setValue(this.plugin.settings.expanded_view).onChange(async (value) => {
      this.plugin.settings.expanded_view = value;
      await this.plugin.saveSettings(true);
    }));
    // toggle group nearest by file
    new Obsidian.Setting(containerEl).setName("group_nearest_by_file").setDesc("Group nearest by file.").addToggle((toggle) => toggle.setValue(this.plugin.settings.group_nearest_by_file).onChange(async (value) => {
      this.plugin.settings.group_nearest_by_file = value;
      await this.plugin.saveSettings(true);
    }));
    // toggle view_open on Obsidian startup
    new Obsidian.Setting(containerEl).setName("view_open").setDesc("Open view on Obsidian startup.").addToggle((toggle) => toggle.setValue(this.plugin.settings.view_open).onChange(async (value) => {
      this.plugin.settings.view_open = value;
      await this.plugin.saveSettings(true);
    }));
    containerEl.createEl("h2", {
      text: "Advanced"
    });
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
    // toggle skip_sections
    new Obsidian.Setting(containerEl).setName("skip_sections").setDesc("Skips making connections to specific sections within notes. Warning: reduces usefulness for large files and requires 'Force Refresh' for sections to work in the future.").addToggle((toggle) => toggle.setValue(this.plugin.settings.skip_sections).onChange(async (value) => {
      this.plugin.settings.skip_sections = value;
      await this.plugin.saveSettings(true);
    }));
    // test file writing by creating a test file, then writing additional data to the file, and returning any error text if it fails
    containerEl.createEl("h3", {
      text: "Test File Writing"
    });
    // container for displaying test file writing results
    let test_file_writing_results = containerEl.createEl("div");
    new Obsidian.Setting(containerEl).setName("test_file_writing").setDesc("Test File Writing").addButton((button) => button.setButtonText("Test File Writing").onClick(async () => {
      test_file_writing_results.empty();
      test_file_writing_results.createEl("p", {
        text: "Testing file writing..."
      });
      // test file writing
      const resp = await this.plugin.test_file_writing();
      test_file_writing_results.empty();
      let log = test_file_writing_results.createEl("p");
      log.innerHTML = resp;
    }));
    // manual save button
    containerEl.createEl("h3", {
      text: "Manual Save"
    });
    let manual_save_results = containerEl.createEl("div");
    new Obsidian.Setting(containerEl).setName("manual_save").setDesc("Save current embeddings").addButton((button) => button.setButtonText("Manual Save").onClick(async () => {
      // confirm
      if (confirm("Are you sure you want to save your current embeddings?")) {
        // save
        try{
          await this.plugin.save_embeddings_to_file(true);
          manual_save_results.innerHTML = "Embeddings saved successfully.";
        }catch(e){
          manual_save_results.innerHTML = "Embeddings failed to save. Error: " + e;
        }
      }
    }));

    // list previously failed files
    containerEl.createEl("h3", {
      text: "Previously failed files"
    });
    let failed_list = containerEl.createEl("div");
    this.draw_failed_files_list(failed_list);

    // force refresh button
    containerEl.createEl("h3", {
      text: "Force Refresh"
    });
    new Obsidian.Setting(containerEl).setName("force_refresh").setDesc("WARNING: DO NOT use unless you know what you are doing! This will delete all of your current embeddings from OpenAI and trigger reprocessing of your entire vault!").addButton((button) => button.setButtonText("Force Refresh").onClick(async () => {
      // confirm
      if (confirm("Are you sure you want to Force Refresh? By clicking yes you confirm that you understand the consequences of this action.")) {
        // force refresh
        await this.plugin.force_refresh_embeddings_file();
      }
    }));

  }
  get_self_ref_list() {
    return "Current: " + SMART_TRANSLATION[this.plugin.settings.language].pronous.join(", ");
  }

  draw_failed_files_list(failed_list) {
    failed_list.empty();
    if(this.plugin.settings.failed_files.length > 0) {
      // add message that these files will be skipped until manually retried
      failed_list.createEl("p", {
        text: "The following files failed to process and will be skipped until manually retried."
      });
      let list = failed_list.createEl("ul");
      for (let failed_file of this.plugin.settings.failed_files) {
        list.createEl("li", {
          text: failed_file
        });
      }
      // add button to retry failed files only
      new Obsidian.Setting(failed_list).setName("retry_failed_files").setDesc("Retry failed files only").addButton((button) => button.setButtonText("Retry failed files only").onClick(async () => {
        // clear failed_list element
        failed_list.empty();
        // set "retrying" text
        failed_list.createEl("p", {
          text: "Retrying failed files..."
        });
        await this.plugin.retry_failed_files();
        // redraw failed files list
        this.draw_failed_files_list(failed_list);
      }));
    }else{
      failed_list.createEl("p", {
        text: "No failed files"
      });
    }
  }
}

function line_is_heading(line) {
  return (line.indexOf("#") === 0) && (['#', ' '].indexOf(line[1]) !== -1);
}

const SMART_CONNECTIONS_CHAT_VIEW_TYPE = "smart-connections-chat-view";

class SmartConnectionsChatView extends Obsidian.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.active_elm = null;
    this.active_stream = null;
    this.chat = null;
    this.chat_box = null;
    this.chat_container = null;
    this.current_chat_ml = [];
    this.files = [];
    this.last_from = null;
    this.message_container = null;
    this.prevent_input = false;
  }
  getDisplayText() {
    return "Smart Connections Chat";
  }
  getIcon() {
    return "message-square";
  }
  getViewType() {
    return SMART_CONNECTIONS_CHAT_VIEW_TYPE;
  }
  onOpen() {
    this.new_chat();
  }
  onClose() {
    this.chat.save_chat();
  }
  render_chat() {
    this.containerEl.empty();
    this.chat_container = this.containerEl.createDiv("sc-chat-container");
    // render plus sign for clear button
    this.render_top_bar();
    // render chat messages container
    this.render_chat_box();
    // render chat input
    this.render_chat_input();
    this.plugin.render_brand(this.containerEl);
  }
  // render plus sign for clear button
  render_top_bar() {
    // create container for clear button
    let top_bar_container = this.chat_container.createDiv("sc-top-bar-container");
    // render the name of the chat in an input box (pop content after last hyphen in chat_id)
    let chat_name =this.chat.name();
    let chat_name_input = top_bar_container.createEl("input", {
      attr: {
        type: "text",
        value: chat_name
      },
      cls: "sc-chat-name-input"
    });
    chat_name_input.addEventListener("change", this.rename_chat.bind(this));
    
    // create button to Smart View
    let smart_view_btn = this.create_top_bar_button(top_bar_container, "Smart View", "smart-connections");
    smart_view_btn.addEventListener("click", this.open_smart_view.bind(this));
    // create button to save chat
    let save_btn = this.create_top_bar_button(top_bar_container, "Save Chat", "save");
    save_btn.addEventListener("click", this.save_chat.bind(this));
    // create button to open chat history modal
    let history_btn = this.create_top_bar_button(top_bar_container, "Chat History", "history");
    history_btn.addEventListener("click", this.open_chat_history.bind(this));
    // create button to start new chat
    const new_chat_btn = this.create_top_bar_button(top_bar_container, "New Chat", "plus");
    new_chat_btn.addEventListener("click", this.new_chat.bind(this));
  }
  async open_chat_history() {
    const folder = await this.app.vault.adapter.list(".smart-connections/chats");
    this.files = folder.files.map((file) => {
      return file.replace(".smart-connections/chats/", "").replace(".json", "");
    });
    // open chat history modal
    if (!this.modal)
      this.modal = new SmartConnectionsChatHistoryModal(this.app, this);
    this.modal.open();
  }

  create_top_bar_button(top_bar_container, title, icon=null) {
    let btn = top_bar_container.createEl("button", {
      attr: {
        title: title
      }
    });
    if(icon){
      Obsidian.setIcon(btn, icon);
    }else{
      btn.innerHTML = title;
    }
    return btn;
  }
  // render new chat
  new_chat() {
    this.clear_chat();
    this.render_chat();
    // render initial message from assistant (don't use render_message to skip adding to chat history)
    this.new_messsage_bubble("assistant");
    this.active_elm.innerHTML = '<p>' + SMART_TRANSLATION[this.plugin.settings.language].initial_message+'</p>';
  }
  // open a chat from the chat history modal
  async open_chat(chat_id) {
    this.clear_chat();
    await this.chat.load_chat(chat_id);
    this.render_chat();
    for (let i = 0; i < this.chat.chat_ml.length; i++) {
      this.render_message(this.chat.chat_ml[i].content, this.chat.chat_ml[i].role);
    }
  }
  // clear current chat state
  clear_chat() {
    if (this.chat) {
      this.chat.save_chat();
    }
    this.chat = new SmartConnectionsChatModel(this.plugin);
    // if this.dotdotdot_interval is not null, clear interval
    if (this.dotdotdot_interval) {
      clearInterval(this.dotdotdot_interval);
    }
    // clear current chat ml
    this.current_chat_ml = [];
    // update prevent input
    this.end_stream();
  }

  rename_chat(event) {
    let new_chat_name = event.target.value;
    this.chat.rename_chat(new_chat_name);
  }
  
  // save current chat
  save_chat() {
    this.chat.save_chat();
    new Obsidian.Notice("[Smart Connections] Chat saved");
  }
  
  open_smart_view() {
    this.plugin.open_view();
  }
  // render chat messages container
  render_chat_box() {
    // create container for chat messages
    this.chat_box = this.chat_container.createDiv("sc-chat-box");
    // create container for message
    this.message_container = this.chat_box.createDiv("sc-message-container");
  }
  // render chat textarea and button
  render_chat_input() {
    // create container for chat input
    let chat_input = this.chat_container.createDiv("sc-chat-form");
    // create textarea
    this.textarea = chat_input.createEl("textarea", {cls: "sc-chat-input"});
    // add event listener to listen for shift+enter
    chat_input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && e.shiftKey) {
        e.preventDefault();
        if(this.prevent_input){
          console.log("wait until current response is finished");
          new Obsidian.Notice("[Smart Connections] Wait until current response is finished");
          return;
        }
        // get text from textarea
        let user_input = this.textarea.value;
        // clear textarea
        this.textarea.value = "";
        // initiate response from assistant
        this.initialize_response(user_input);
      }
      this.textarea.style.height = 'auto';
      this.textarea.style.height = (this.textarea.scrollHeight) + 'px';
    });
    // button container
    let button_container = chat_input.createDiv("sc-button-container");
    // create hidden abort button
    let abort_button = button_container.createEl("span", { attr: {id: "sc-abort-button", style: "display: none;"} });
    Obsidian.setIcon(abort_button, "square");
    // add event listener to button
    abort_button.addEventListener("click", () => {
      // abort current response
      this.end_stream();
    });
    // create button
    let button = button_container.createEl("button", { attr: {id: "sc-send-button"}, cls: "send-button" });
    button.innerHTML = "Send";
    // add event listener to button
    button.addEventListener("click", () => {
      if(this.prevent_input){
        console.log("wait until current response is finished");
        new Obsidian.Notice("Wait until current response is finished");
        return;
      }
      // get text from textarea
      let user_input = this.textarea.value;
      // clear textarea
      this.textarea.value = "";
      // initiate response from assistant
      this.initialize_response(user_input);
    });
  }
  async initialize_response(user_input) {
    this.set_streaming_ux();
    // render message
    this.render_message(user_input, "user");
    this.chat.new_message_in_thread({
      role: "user",
      content: user_input
    });
    if(this.dotdotdot_interval) clearInterval(this.dotdotdot_interval);
    this.render_message("...", "assistant");
    // if is '...', then initiate interval to change to '.' and then to '..' and then to '...'
    let dots = 0;
    this.active_elm.innerHTML = '...';
    this.dotdotdot_interval = setInterval(() => {
      dots++;
      if(dots > 3) dots = 1;
      this.active_elm.innerHTML = '.'.repeat(dots);
    }, 500);
    // wait 2 seconds for testing
    // await new Promise(r => setTimeout(r, 2000));
    // if does not include keywords referring to one's own notes, then just use chatgpt and return
    if(!this.contains_self_referential_keywords(user_input)) {
      this.request_chatgpt_completion();
    }else{
      // get hyde
      const context = await this.get_context_hyde(user_input);
      // get user input with added context
      // const context_input = this.build_context_input(context);
      // console.log(context_input);
      const chatml = [
        {
          role: "system",
          // content: context_input
          content: context
        },
        {
          role: "user",
          content: user_input
        }
      ];
      this.request_chatgpt_completion({messages: chatml, temperature: 0});
    }
  }
  
  set_streaming_ux() {
    this.prevent_input = true;
    // hide send button
    document.getElementById("sc-send-button").style.display = "none";
    // show abort button
    document.getElementById("sc-abort-button").style.display = "block";
  }
  unset_streaming_ux() {
    this.prevent_input = false;
    // show send button, remove display none
    document.getElementById("sc-send-button").style.display = "";
    // hide abort button
    document.getElementById("sc-abort-button").style.display = "none";
  }

  contains_self_referential_keywords(user_input) {
    const matches = user_input.match(this.plugin.self_ref_kw_regex);
    if(matches) return true;
    return false;
  }

  // render message
  render_message(message, from="assistant", append_last=false) {
    // if dotdotdot interval is set, then clear it
    if(this.dotdotdot_interval) {
      clearInterval(this.dotdotdot_interval);
      this.dotdotdot_interval = null;
      // clear last message
      this.active_elm.innerHTML = '';
    }
    if(append_last) {
      this.current_message_raw += message;
      this.active_elm.innerHTML = '';
      // append to last message
      Obsidian.MarkdownRenderer.renderMarkdown(this.current_message_raw, this.active_elm, '?no-dataview', void 0);
    }else{
      // if final from assistant stream, then render message button
      if(this.current_message_raw === message) {
        if(this.chat.context && this.chat.hyd) {
          // render button to copy hyd in smart-connections code block
          const context_view = this.active_elm.createEl("span", {
            cls: "sc-msg-button",
            attr: {
              title: "Copy context to clipboard" /* tooltip */
            }
          });
          const this_hyd = this.chat.hyd;
          Obsidian.setIcon(context_view, "eye");
          context_view.addEventListener("click", () => {
            // copy to clipboard
            navigator.clipboard.writeText("```smart-connections\n" + this_hyd + "\n```\n");
            new Obsidian.Notice("[Smart Connections] Context code block copied to clipboard");
          });
          // render copy context button
          const copy_prompt_button = this.active_elm.createEl("span", {
            cls: "sc-msg-button",
            attr: {
              title: "Copy prompt to clipboard" /* tooltip */
            }
          });
          const this_context = this.chat.context.trimLeft();
          Obsidian.setIcon(copy_prompt_button, "files");
          copy_prompt_button.addEventListener("click", () => {
            // copy to clipboard
            navigator.clipboard.writeText("```prompt-context\n"+this_context+"\n```\n");
            new Obsidian.Notice("[Smart Connections] Context copied to clipboard");
          });
        }
        // render copy button
        const copy_button = this.active_elm.createEl("span", {
          cls: "sc-msg-button",
          attr: {
            title: "Copy message to clipboard" /* tooltip */
          }
        });
        Obsidian.setIcon(copy_button, "copy");
        copy_button.addEventListener("click", () => {
          // copy message to clipboard
          navigator.clipboard.writeText(message.trimLeft());
          new Obsidian.Notice("[Smart Connections] Message copied to clipboard");
        });
        return; // end here since message is already rendered
      }
      this.current_message_raw = '';
      if((this.chat.thread.length === 0) || (this.last_from !== from)) {
        // create message
        this.new_messsage_bubble(from);
      }
      // set message text
      Obsidian.MarkdownRenderer.renderMarkdown(message, this.active_elm, '?no-dataview', void 0);
    }
    // scroll to bottom
    this.message_container.scrollTop = this.message_container.scrollHeight;
  }
  new_messsage_bubble(from) {
    let message_el = this.message_container.createDiv(`sc-message ${from}`);
    // create message content
    this.active_elm = message_el.createDiv("sc-message-content");
  }

  async request_chatgpt_completion(opts={}) {
    opts = {
      model: this.plugin.settings.smart_chat_model,
      messages: this.chat.prepare_chat_ml(),
      max_tokens: 250,
      temperature: 0.3,
      top_p: 1,
      presence_penalty: 0,
      frequency_penalty: 0,
      stream: true,
      stop: null,
      n: 1,
      // logit_bias: logit_bias,
      ...opts
    }
    // console.log(opts.messages);
    if(opts.stream) {
      const full_str = await new Promise((resolve, reject) => {
        try {
          // console.log("stream", opts);
          const url = "https://api.openai.com/v1/chat/completions";
          this.active_stream = new ScStreamer(url, {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${this.plugin.settings.api_key}`
            },
            method: "POST",
            payload: JSON.stringify(opts)
          });
          let txt = "";
          this.active_stream.addEventListener("message", (e) => {
            if (e.data != "[DONE]") {
              const payload = JSON.parse(e.data);
              const text = payload.choices[0].delta.content;
              if (!text) {
                return;
              }
              txt += text;
              this.render_message(text, "assistant", true);
            } else {
              this.end_stream();
              resolve(txt);
            }
          });
          this.active_stream.addEventListener("readystatechange", (e) => {
            if (e.readyState >= 2) {
              console.log("ReadyState: " + e.readyState);
            }
          });
          this.active_stream.addEventListener("error", (e) => {
            console.error(e);
            new Obsidian.Notice("Smart Connections Error Streaming Response. See console for details.");
            this.render_message("*API Error. See console logs for details.*", "assistant");
            this.end_stream();
            reject(e);
          });
          this.active_stream.stream();
        } catch (err) {
          console.error(err);
          new Obsidian.Notice("Smart Connections Error Streaming Response. See console for details.");
          this.end_stream();
          reject(err);
        }
      });
      // console.log(full_str);
      this.render_message(full_str, "assistant");
      this.chat.new_message_in_thread({
        role: "assistant",
        content: full_str
      });
      return;
    }else{
      try{
        const response = await (0, Obsidian.requestUrl)({
          url: `https://api.openai.com/v1/chat/completions`,
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.plugin.settings.api_key}`,
            "Content-Type": "application/json"
          },
          contentType: "application/json",
          body: JSON.stringify(opts),
          throw: false
        });
        // console.log(response);
        return JSON.parse(response.text).choices[0].message.content;
      }catch(err){
        new Obsidian.Notice(`Smart Connections API Error :: ${err}`);
      }
    }
  }

  end_stream() {
    if(this.active_stream){
      this.active_stream.close();
      this.active_stream = null;
      this.unset_streaming_ux();
    }
    if(this.dotdotdot_interval){
      clearInterval(this.dotdotdot_interval);
      this.dotdotdot_interval = null;
      // remove parent of active_elm
      this.active_elm.parentElement.remove();
      this.active_elm = null;
    }
  }

  async get_context_hyde(user_input) {
    this.chat.reset_context();
    // count current chat ml messages to determine 'question' or 'chat log' wording
    const hyd_input = `Anticipate what the user is seeking. Respond in the form of a hypothetical note written by the user. The note may contain statements as paragraphs, lists, or checklists in markdown format with no headings. Please respond with one hypothetical note and abstain from any other commentary. Use the format: PARENT FOLDER NAME > CHILD FOLDER NAME > FILE NAME > HEADING 1 > HEADING 2 > HEADING 3: HYPOTHETICAL NOTE CONTENTS.`;
    // complete
    const chatml = [
      {
        role: "system",
        content: hyd_input 
      },
      {
        role: "user",
        content: user_input
      }
    ];
    const hyd = await this.request_chatgpt_completion({
      messages: chatml,
      stream: false,
      temperature: 0,
      max_tokens: 137,
    });
    this.chat.hyd = hyd;
    // console.log(hyd);
    // search for nearest based on hyd
    let nearest = await this.plugin.api.search(hyd);
    console.log("nearest", nearest.length);
    nearest = this.get_nearest_until_next_dev_exceeds_std_dev(nearest);
    console.log("nearest after std dev slice", nearest.length);
    nearest = this.sort_by_len_adjusted_similarity(nearest);
    
    return await this.get_context_for_prompt(nearest);
  }
  
  
  sort_by_len_adjusted_similarity(nearest) {
    // re-sort by quotient of similarity divided by len DESC
    nearest = nearest.sort((a, b) => {
      const a_score = a.similarity / a.len;
      const b_score = b.similarity / b.len;
      // if a is greater than b, return -1
      if (a_score > b_score)
        return -1;
      // if a is less than b, return 1
      if (a_score < b_score)
        return 1;
      // if a is equal to b, return 0
      return 0;
    });
    return nearest;
  }

  get_nearest_until_next_dev_exceeds_std_dev(nearest) {
    // get std dev of similarity
    const sim = nearest.map((n) => n.similarity);
    const mean = sim.reduce((a, b) => a + b) / sim.length;
    const std_dev = Math.sqrt(sim.map((x) => Math.pow(x - mean, 2)).reduce((a, b) => a + b) / sim.length);
    // slice where next item deviation is greater than std_dev
    let slice_i = 0;
    while (slice_i < nearest.length) {
      const next = nearest[slice_i + 1];
      if (next) {
        const next_dev = Math.abs(next.similarity - nearest[slice_i].similarity);
        if (next_dev > std_dev) {
          break;
        }
      }
      slice_i++;
    }
    // select top results
    nearest = nearest.slice(0, slice_i+1);
    return nearest;
  }
  // this.test_get_nearest_until_next_dev_exceeds_std_dev();
  // // test get_nearest_until_next_dev_exceeds_std_dev
  // test_get_nearest_until_next_dev_exceeds_std_dev() {
  //   const nearest = [{similarity: 0.99}, {similarity: 0.98}, {similarity: 0.97}, {similarity: 0.96}, {similarity: 0.95}, {similarity: 0.94}, {similarity: 0.93}, {similarity: 0.92}, {similarity: 0.91}, {similarity: 0.9}, {similarity: 0.79}, {similarity: 0.78}, {similarity: 0.77}, {similarity: 0.76}, {similarity: 0.75}, {similarity: 0.74}, {similarity: 0.73}, {similarity: 0.72}];
  //   const result = this.get_nearest_until_next_dev_exceeds_std_dev(nearest);
  //   if(result.length !== 10){
  //     console.error("get_nearest_until_next_dev_exceeds_std_dev failed", result);
  //   }
  // }

  async get_context_for_prompt(nearest) {
    let context = [];
    const MAX_SOURCES = 20; // 10 * 1000 (max chars) = 10,000 chars (must be under ~16,000 chars or 4K tokens) 
    const MAX_CHARS = 10000;
    let char_accum = 0;
    for (let i = 0; i < nearest.length; i++) {
      if (context.length >= MAX_SOURCES)
        break;
      if (char_accum >= MAX_CHARS)
        break;
      if (typeof nearest[i].link !== 'string')
        continue;
      // generate breadcrumbs
      const breadcrumbs = nearest[i].link.replace(/#/g, " > ").replace(".md", "").replace(/\//g, " > ");
      let new_context = `${breadcrumbs}:\n`;
      // get max available chars to add to context
      const max_available_chars = MAX_CHARS - char_accum - new_context.length;
      if (nearest[i].link.indexOf("#") !== -1) { // is block
        new_context += await this.plugin.block_retriever(nearest[i].link, { max_chars: max_available_chars });
      } else { // is file
        new_context += await this.plugin.file_retriever(nearest[i].link, { max_chars: max_available_chars });
      }
      // add to char_accum
      char_accum += new_context.length;
      // add to context
      context.push({
        link: nearest[i].link,
        text: new_context
      });
    }
    // context sources
    console.log("context sources: " + context.length);
    // char_accum divided by 4 and rounded to nearest integer for estimated tokens
    console.log("total context tokens: ~" + Math.round(char_accum / 4));
    // build context input
    this.chat.context = `Anticipate the type of answer desired by the user. Imagine the following ${context.length} notes were written by the user and contain all the necessary information to answer the user's question. Begin responses with "${SMART_TRANSLATION[this.plugin.settings.language].prompt}..."`;
    for(let i = 0; i < context.length; i++) {
      this.chat.context += `\n---BEGIN #${i+1}---\n${context[i].text}\n---END #${i+1}---`;
    }
    return this.chat.context;
  }

}

/**
 * SmartConnectionsChatModel
 * ---
 * - 'thread' format: Array[Array[Object{role, content, hyde}]]
 *  - [Turn[variation{}], Turn[variation{}, variation{}], ...]
 * - Saves in 'thread' format to JSON file in .smart-connections folder using chat_id as filename
 * - Loads chat in 'thread' format Array[Array[Object{role, content, hyde}]] from JSON file in .smart-connections folder
 * - prepares chat_ml returns in 'ChatML' format 
 *  - strips all but role and content properties from Object in ChatML format
 * - ChatML Array[Object{role, content}]
 *  - [Current_Variation_For_Turn_1{}, Current_Variation_For_Turn_2{}, ...]
 */
class SmartConnectionsChatModel {
  constructor(plugin) {
    this.app = plugin.app;
    this.plugin = plugin;
    this.chat_id = null;
    this.chat_ml = [];
    this.context = null;
    this.hyd = null;
    this.thread = [];
  }
  async save_chat() {
    // return if thread is empty
    if (this.thread.length === 0) return;
    // save chat to file in .smart-connections folder
    // create .smart-connections/chats/ folder if it doesn't exist
    if (!(await this.app.vault.adapter.exists(".smart-connections/chats"))) {
      await this.app.vault.adapter.mkdir(".smart-connections/chats");
    }
    // if chat_id is not set, set it to UNTITLED-${unix timestamp}
    if (!this.chat_id) {
      this.chat_id = this.name() + "—" + this.get_file_date_string();
    }
    // validate chat_id is set to valid filename characters (letters, numbers, underscores, dashes, em dash, and spaces)
    if (!this.chat_id.match(/^[a-zA-Z0-9_—\- ]+$/)) {
      console.log("Invalid chat_id: " + this.chat_id);
      new Obsidian.Notice("[Smart Connections] Failed to save chat. Invalid chat_id: '" + this.chat_id + "'");
    }
    // filename is chat_id
    const chat_file = this.chat_id + ".json";
    this.app.vault.adapter.write(
      ".smart-connections/chats/" + chat_file,
      JSON.stringify(this.thread, null, 2)
    );
  }
  async load_chat(chat_id, view) {
    this.chat_id = chat_id;
    // load chat from file in .smart-connections folder
    // filename is chat_id
    const chat_file = this.chat_id + ".json";
    // read file
    let chat_json = await this.app.vault.adapter.read(
      ".smart-connections/chats/" + chat_file
    );
    // parse json
    this.thread = JSON.parse(chat_json);
    // load chat_ml
    this.chat_ml = this.prepare_chat_ml();
    // render messages in chat view
    // for each turn in chat_ml
    // console.log(this.thread);
    // console.log(this.chat_ml);
  }
  // prepare chat_ml from chat
  // gets the last message of each turn unless turn_variation_offsets=[[turn_index,variation_index]] is specified in offset
  prepare_chat_ml(turn_variation_offsets=[]) {
    // if no turn_variation_offsets, get the last message of each turn
    if(turn_variation_offsets.length === 0){
      this.chat_ml = this.thread.map(turn => {
        return turn[turn.length - 1];
      });
    }else{
      // create an array from turn_variation_offsets that indexes variation_index at turn_index
      // ex. [[3,5]] => [undefined, undefined, undefined, 5]
      let turn_variation_index = [];
      for(let i = 0; i < turn_variation_offsets.length; i++){
        turn_variation_index[turn_variation_offsets[i][0]] = turn_variation_offsets[i][1];
      }
      // loop through chat
      this.chat_ml = this.thread.map((turn, turn_index) => {
        // if there is an index for this turn, return the variation at that index
        if(turn_variation_index[turn_index] !== undefined){
          return turn[turn_variation_index[turn_index]];
        }
        // otherwise return the last message of the turn
        return turn[turn.length - 1];
      });
    }
    // strip all but role and content properties from each message
    this.chat_ml = this.chat_ml.map(message => {
      return {
        role: message.role,
        content: message.content
      };
    });
    return this.chat_ml;
  }
  last() {
    // get last message from chat
    return this.thread[this.thread.length - 1][this.thread[this.thread.length - 1].length - 1];
  }
  last_from() {
    return this.last().role;
  }
  // returns user_input or completion
  last_message() {
    return this.last().content;
  }
  // message={}
  // add new message to thread
  new_message_in_thread(message, turn=-1) {
    // if turn is -1, add to new turn
    if(this.context){
      message.context = this.context;
      this.context = null;
    }
    if(this.hyd){
      message.hyd = this.hyd;
      this.hyd = null;
    }
    if (turn === -1) {
      this.thread.push([message]);
    }else{
      // otherwise add to specified turn
      this.thread[turn].push(message);
    }
  }
  reset_context(){
    this.context = null;
    this.hyd = null;
  }
  async rename_chat(new_name){
    // check if current chat_id file exists
    if (this.chat_id && await this.app.vault.adapter.exists(".smart-connections/chats/" + this.chat_id + ".json")) {
      new_name = this.chat_id.replace(this.name(), new_name);
      // rename file if it exists
      await this.app.vault.adapter.rename(
        ".smart-connections/chats/" + this.chat_id + ".json",
        ".smart-connections/chats/" + new_name + ".json"
      );
      // set chat_id to new_name
      this.chat_id = new_name;
    }else{
      this.chat_id = new_name + "—" + this.get_file_date_string();
      // save chat
      await this.save_chat();
    }

  }

  name() {
    if(this.chat_id){
      // remove date after last em dash
      return this.chat_id.replace(/—[^—]*$/,"");
    }
    return "UNTITLED";
  }

  get_file_date_string() {
    return new Date().toISOString().replace(/(T|:|\..*)/g, " ").trim();
  }
}

class SmartConnectionsChatHistoryModal extends Obsidian.FuzzySuggestModal {
  constructor(app, view, files) {
    super(app);
    this.app = app;
    this.view = view;
    this.setPlaceholder("Type the name of a chat session...");
  }
  getItems() {
    if (!this.view.files) {
      return [];
    }
    return this.view.files;
  }
  getItemText(item) {
    // if not UNTITLED, remove date after last em dash
    if(item.indexOf("UNTITLED") === -1){
      item.replace(/—[^—]*$/,"");
    }
    return item;
  }
  onChooseItem(session) {
    this.view.open_chat(session);
  }
}


// Handle API response streaming
class ScStreamer {
  // constructor
  constructor(url, options) {
    // set default options
    options = options || {};
    this.url = url;
    this.method = options.method || 'GET';
    this.headers = options.headers || {};
    this.payload = options.payload || null;
    this.withCredentials = options.withCredentials || false;
    this.listeners = {};
    this.readyState = this.CONNECTING;
    this.progress = 0;
    this.chunk = '';
    this.xhr = null;
    this.FIELD_SEPARATOR = ':';
    this.INITIALIZING = -1;
    this.CONNECTING = 0;
    this.OPEN = 1;
    this.CLOSED = 2;
  }
  // addEventListener
  addEventListener(type, listener) {
    // check if the type is in the listeners
    if (!this.listeners[type]) {
      this.listeners[type] = [];
    }
    // check if the listener is already in the listeners
    if(this.listeners[type].indexOf(listener) === -1) {
      this.listeners[type].push(listener);
    }
  }
  // removeEventListener
  removeEventListener(type, listener) {
    // check if listener type is undefined
    if (!this.listeners[type]) {
      return;
    }
    let filtered = [];
    // loop through the listeners
    for (let i = 0; i < this.listeners[type].length; i++) {
      // check if the listener is the same
      if (this.listeners[type][i] !== listener) {
        filtered.push(this.listeners[type][i]);
      }
    }
    // check if the listeners are empty
    if (this.listeners[type].length === 0) {
      delete this.listeners[type];
    } else {
      this.listeners[type] = filtered;
    }
  }
  // dispatchEvent
  dispatchEvent(event) {
    // if no event return true
    if (!event) {
      return true;
    }
    // set event source to this
    event.source = this;
    // set onHandler to on + event type
    let onHandler = 'on' + event.type;
    // check if the onHandler has own property named same as onHandler
    if (this.hasOwnProperty(onHandler)) {
      // call the onHandler
      this[onHandler].call(this, event);
      // check if the event is default prevented
      if (event.defaultPrevented) {
        return false;
      }
    }
    // check if the event type is in the listeners
    if (this.listeners[event.type]) {
      return this.listeners[event.type].every(function(callback) {
        callback(event);
        return !event.defaultPrevented;
      });
    }
    return true;
  }
  // _setReadyState
  _setReadyState(state) {
    // set event type to readyStateChange
    let event = new CustomEvent('readyStateChange');
    // set event readyState to state
    event.readyState = state;
    // set readyState to state
    this.readyState = state;
    // dispatch event
    this.dispatchEvent(event);
  }
  // _onStreamFailure
  _onStreamFailure(e) {
    // set event type to error
    let event = new CustomEvent('error');
    // set event data to e
    event.data = e.currentTarget.response;
    // dispatch event
    this.dispatchEvent(event);
    this.close();
  }
  // _onStreamAbort
  _onStreamAbort(e) {
    // set to abort
    let event = new CustomEvent('abort');
    // close
    this.close();
  }
  // _onStreamProgress
  _onStreamProgress(e) {
    // if not xhr return
    if (!this.xhr) {
      return;
    }
    // if xhr status is not 200 return
    if (this.xhr.status !== 200) {
      // onStreamFailure
      this._onStreamFailure(e);
      return;
    }
    // if ready state is CONNECTING
    if (this.readyState === this.CONNECTING) {
      // dispatch event
      this.dispatchEvent(new CustomEvent('open'));
      // set ready state to OPEN
      this._setReadyState(this.OPEN);
    }
    // parse the received data.
    let data = this.xhr.responseText.substring(this.progress);
    // update progress
    this.progress += data.length;
    // split the data by new line and parse each line
    data.split(/(\r\n|\r|\n){2}/g).forEach(function(part){
      if(part.trim().length === 0) {
        this.dispatchEvent(this._parseEventChunk(this.chunk.trim()));
        this.chunk = '';
      } else {
        this.chunk += part;
      }
    }.bind(this));
  }
  // _onStreamLoaded
  _onStreamLoaded(e) {
    this._onStreamProgress(e);
    // parse the last chunk
    this.dispatchEvent(this._parseEventChunk(this.chunk));
    this.chunk = '';
  }
  // _parseEventChunk
  _parseEventChunk(chunk) {
    // if no chunk or chunk is empty return
    if (!chunk || chunk.length === 0) {
      return null;
    }
    // init e
    let e = {id: null, retry: null, data: '', event: 'message'};
    // split the chunk by new line
    chunk.split(/(\r\n|\r|\n)/).forEach(function(line) {
      line = line.trimRight();
      let index = line.indexOf(this.FIELD_SEPARATOR);
      if(index <= 0) {
        return;
      }
      // field
      let field = line.substring(0, index);
      if(!(field in e)) {
        return;
      }
      // value
      let value = line.substring(index + 1).trimLeft();
      if(field === 'data') {
        e[field] += value;
      } else {
        e[field] = value;
      }
    }.bind(this));
    // return event
    let event = new CustomEvent(e.event);
    event.data = e.data;
    event.id = e.id;
    return event;
  }
  // _checkStreamClosed
  _checkStreamClosed() {
    if(!this.xhr) {
      return;
    }
    if(this.xhr.readyState === XMLHttpRequest.DONE) {
      this._setReadyState(this.CLOSED);
    }
  }
  // stream
  stream() {
    // set ready state to connecting
    this._setReadyState(this.CONNECTING);
    // set xhr to new XMLHttpRequest
    this.xhr = new XMLHttpRequest();
    // set xhr progress to _onStreamProgress
    this.xhr.addEventListener('progress', this._onStreamProgress.bind(this));
    // set xhr load to _onStreamLoaded
    this.xhr.addEventListener('load', this._onStreamLoaded.bind(this));
    // set xhr ready state change to _checkStreamClosed
    this.xhr.addEventListener('readystatechange', this._checkStreamClosed.bind(this));
    // set xhr error to _onStreamFailure
    this.xhr.addEventListener('error', this._onStreamFailure.bind(this));
    // set xhr abort to _onStreamAbort
    this.xhr.addEventListener('abort', this._onStreamAbort.bind(this));
    // open xhr
    this.xhr.open(this.method, this.url);
    // headers to xhr
    for (let header in this.headers) {
      this.xhr.setRequestHeader(header, this.headers[header]);
    }
    // credentials to xhr
    this.xhr.withCredentials = this.withCredentials;
    // send xhr
    this.xhr.send(this.payload);
  }
  // close
  close() {
    if(this.readyState === this.CLOSED) {
      return;
    }
    this.xhr.abort();
    this.xhr = null;
    this._setReadyState(this.CLOSED);
  }
}

module.exports = SmartConnectionsPlugin;