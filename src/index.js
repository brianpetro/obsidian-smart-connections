const Obsidian = require("obsidian");
const VecLite = require("vec-lite");

const DEFAULT_SETTINGS = {
  api_key: "",
  chat_open: true,
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
  skip_sections: false,
  smart_chat_model: "gpt-3.5-turbo-16k",
  view_open: true,
  version: "",
};
const MAX_EMBED_STRING_LENGTH = 25000;

let VERSION;
const SUPPORTED_FILE_TYPES = ["md", "canvas"];

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
  "pt": {
    "pronous": ["meu", "eu", "mim", "minha", "nosso", "nosso", "nós", "nós"],
    "prompt": "Com base em suas anotações",
    "initial_message": "Olá, sou ChatGPT com acesso às suas notas via Smart Connections. Faça-me uma pergunta sobre suas anotações e tentarei respondê-la.",
  },
}

// require built-in crypto module
const crypto = require("crypto");
// md5 hash using built in crypto module
function md5(str) {
  return crypto.createHash("md5").update(str).digest("hex");
}

class SmartConnectionsPlugin extends Obsidian.Plugin {
  // constructor
  constructor() {
    super(...arguments);
    this.api = null;
    this.embeddings_loaded = false;
    this.file_exclusions = [];
    this.folders = [];
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
    this.sc_branding = {};
    this.self_ref_kw_regex = null;
    this.update_available = false;
  }

  async onload() {
    // initialize when layout is ready
    this.app.workspace.onLayoutReady(this.initialize.bind(this));
  }
  onunload() {
    this.output_render_log();
    console.log("unloading plugin");
    this.app.workspace.detachLeavesOfType(SMART_CONNECTIONS_VIEW_TYPE);
    this.app.workspace.detachLeavesOfType(SMART_CONNECTIONS_CHAT_VIEW_TYPE);
  }
  async initialize() {
    console.log("Loading Smart Connections plugin");
    VERSION = this.manifest.version;
    // VERSION = '1.0.0';
    // console.log(VERSION);
    await this.loadSettings();
    // run after 3 seconds
    setTimeout(this.check_for_update.bind(this), 3000);
    // run check for update every 3 hours
    setInterval(this.check_for_update.bind(this), 10800000);

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
    // open random note from nearest cache
    this.addCommand({
      id: "smart-connections-random",
      name: "Open: Random Note from Smart Connections",
      callback: () => {
        this.open_random_note();
      }
    });
    // add settings tab
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
    // if this settings.chat_open is true, open chat on startup
    if(this.settings.chat_open) {
      this.open_chat();
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

  async init_vecs() {
    this.smart_vec_lite = new VecLite({
      folder_path: ".smart-connections",
      exists_adapter: this.app.vault.adapter.exists.bind(this.app.vault.adapter),
      mkdir_adapter: this.app.vault.adapter.mkdir.bind(this.app.vault.adapter),
      read_adapter: this.app.vault.adapter.read.bind(this.app.vault.adapter),
      rename_adapter: this.app.vault.adapter.rename.bind(this.app.vault.adapter),
      stat_adapter: this.app.vault.adapter.stat.bind(this.app.vault.adapter),
      write_adapter: this.app.vault.adapter.write.bind(this.app.vault.adapter),
    });
    this.embeddings_loaded = await this.smart_vec_lite.load();
    return this.embeddings_loaded;
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
        this.render_brand("all")
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

  // open random note
  async open_random_note() {
    const curr_file = this.app.workspace.getActiveFile();
    const curr_key = md5(curr_file.path);
    // if no nearest cache, create Obsidian notice
    if(typeof this.nearest_cache[curr_key] === "undefined") {
      new Obsidian.Notice("[Smart Connections] No Smart Connections found. Open a note to get Smart Connections.");
      return;
    }
    // get random from nearest cache
    const rand = Math.floor(Math.random() * this.nearest_cache[curr_key].length/2); // divide by 2 to limit to top half of results
    const random_file = this.nearest_cache[curr_key][rand];
    // open random file
    this.open_note(random_file);
  }

  async open_view() {
    if(this.get_view()){
      console.log("Smart Connections view already open");
      return;
    }
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
  async open_chat(retries=0) {
    if(!this.embeddings_loaded) {
      console.log("embeddings not loaded yet");
      if(retries < 3) {
        // wait and try again
        setTimeout(() => {
          this.open_chat(retries+1);
        }, 1000 * (retries+1));
        return;
      }
      console.log("embeddings still not loaded, opening smart view");
      this.open_view();
      return;
    }
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
    // get all files in vault and filter all but markdown and canvas files
    const files = (await this.app.vault.getFiles()).filter((file) => file instanceof Obsidian.TFile && (file.extension === "md" || file.extension === "canvas"));
    // const files = await this.app.vault.getMarkdownFiles();
    // get open files to skip if file is currently open
    const open_files = this.app.workspace.getLeavesOfType("markdown").map((leaf) => leaf.view.file);
    const clean_up_log = this.smart_vec_lite.clean_up_embeddings(files);
    if(this.settings.log_render){
      this.render_log.total_files = files.length;
      this.render_log.deleted_embeddings = clean_up_log.deleted_embeddings;
      this.render_log.total_embeddings = clean_up_log.total_embeddings;
    }
    // batch embeddings
    let batch_promises = [];
    for (let i = 0; i < files.length; i++) {
      // skip if path contains a #
      if(files[i].path.indexOf("#") > -1) {
        // console.log("skipping file '"+files[i].path+"' (path contains #)");
        this.log_exclusion("path contains #");
        continue;
      }
      // skip if file already has embedding and embedding.mtime is greater than or equal to file.mtime
      if(this.smart_vec_lite.mtime_is_current(md5(files[i].path), files[i].stat.mtime)) {
        // log skipping file
        // console.log("skipping file (mtime)");
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
      }, 30000);
      console.log("scheduled save");
      return;
    }

    try{
      // use smart_vec_lite
      await this.smart_vec_lite.save();
      this.has_new_embeddings = false;
    }catch(error){
      console.log(error);
      new Obsidian.Notice("Smart Connections: "+error.message);
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
    new Obsidian.Notice("Smart Connections: embeddings file Force Refreshed, making new connections...");
    // force refresh
    await this.smart_vec_lite.force_refresh();
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
    const curr_file_key = md5(curr_file.path);
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
      req_batch.push([curr_file_key, file_embed_input, {
        mtime: curr_file.stat.mtime,
        path: curr_file.path,
      }]);
      await this.get_embeddings_batch(req_batch);
      return;
    }
    /**
     * BEGIN Canvas file type Embedding
     */
    if(curr_file.extension === "canvas") {
      // get file contents and parse as JSON
      const canvas_contents = await this.app.vault.cachedRead(curr_file);
      if((typeof canvas_contents === "string") && (canvas_contents.indexOf("nodes") > -1)) {
        const canvas_json = JSON.parse(canvas_contents);
        // for each object in nodes array
        for(let j = 0; j < canvas_json.nodes.length; j++) {
          // if object has text property
          if(canvas_json.nodes[j].text) {
            // add to file_embed_input
            file_embed_input += "\n" + canvas_json.nodes[j].text;
          }
          // if object has file property
          if(canvas_json.nodes[j].file) {
            // add to file_embed_input
            file_embed_input += "\nLink: " + canvas_json.nodes[j].file;
          }
        }
      }
      // console.log(file_embed_input);
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
        const block_key = md5(note_sections[j].path);
        blocks.push(block_key);
        // skip if length of block_embed_input same as length of embeddings[block_key].meta.size
        // TODO consider rounding to nearest 10 or 100 for fuzzy matching
        if (this.smart_vec_lite.get_size(block_key) === block_embed_input.length) {
          // log skipping file
          // console.log("skipping block (len)");
          continue;
        }
        // add hash to blocks to prevent empty blocks triggering full-file embedding
        // skip if embeddings key already exists and block mtime is greater than or equal to file mtime
        if(this.smart_vec_lite.mtime_is_current(block_key, curr_file.stat.mtime)) {
          // log skipping file
          // console.log("skipping block (mtime)");
          continue;
        }
        // skip if hash is present in embeddings and hash of block_embed_input is equal to hash in embeddings
        const block_hash = md5(block_embed_input.trim());
        if(this.smart_vec_lite.get_hash(block_key) === block_hash) {
          // log skipping file
          // console.log("skipping block (hash)");
          continue;
        }

        // create req_batch for batching requests
        req_batch.push([block_key, block_embed_input, {
          // oldmtime: curr_file.stat.mtime, 
          // get current datetime as unix timestamp
          mtime: Date.now(),
          hash: block_hash, 
          parent: curr_file_key,
          path: note_sections[j].path,
          size: block_embed_input.length,
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
    // skip embedding full file if blocks is not empty and all hashes are present in embeddings
    // better than hashing file_embed_input because more resilient to inconsequential changes (whitespace between headings)
    const file_hash = md5(file_embed_input.trim());
    const existing_hash = this.smart_vec_lite.get_hash(curr_file_key);
    if(existing_hash && (file_hash === existing_hash)) {
      // console.log("skipping file (hash): " + curr_file.path);
      this.update_render_log(blocks, file_embed_input);
      return;
    };

    // if not already skipping and blocks are present
    const existing_blocks = this.smart_vec_lite.get_children(curr_file_key);
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
      // get file size from embeddings
      const prev_file_size = this.smart_vec_lite.get_size(curr_file_key);
      if (prev_file_size) {
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
      children: blocks,
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

  async get_embeddings_batch(req_batch) {
    console.log("get_embeddings_batch");
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
          this.smart_vec_lite.save_embedding(key, vec, meta);
        }
      }
    }
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
    const curr_key = md5(current_note.path);
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
      if(this.smart_vec_lite.mtime_is_current(curr_key, current_note.stat.mtime)) {
        // skipping get file embeddings because nothing has changed
        // console.log("find_note_connections - skipping file (mtime)");
      }else{
        // get file embeddings
        await this.get_file_embeddings(current_note);
      }
      // get current note embedding vector
      const vec = this.smart_vec_lite.get_vec(curr_key);
      if(!vec) {
        return "Error getting embeddings for: "+current_note.path;
      }
      
      // compute cosine similarity between current note and all other notes via embeddings
      nearest = this.smart_vec_lite.nearest(vec, {
        skip_key: curr_key,
        skip_sections: this.settings.skip_sections,
      });
  
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
  render_brand(container, location="default") {
    // if location is all then get Object.keys(this.sc_branding) and call this function for each
    if (container === "all") {
      const locations = Object.keys(this.sc_branding);
      for (let i = 0; i < locations.length; i++) {
        this.render_brand(this.sc_branding[locations[i]], locations[i]);
      }
      return;
    }
    // brand container
    this.sc_branding[location] = container;
    // if this.sc_branding[location] contains child with class "sc-brand", remove it
    if (this.sc_branding[location].querySelector(".sc-brand")) {
      this.sc_branding[location].querySelector(".sc-brand").remove();
    }
    const brand_container = this.sc_branding[location].createEl("div", { cls: "sc-brand" });
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
          Obsidian.MarkdownRenderer.renderMarkdown((await this.block_retriever(nearest[i].link, {lines: 10, max_chars: 1000})), contents_container, nearest[i].link, new Obsidian.Component());
        }else{ // is file
          const first_ten_lines = await this.file_retriever(nearest[i].link, {lines: 10, max_chars: 1000});
          if(!first_ten_lines) continue; // skip if file is empty
          Obsidian.MarkdownRenderer.renderMarkdown(first_ten_lines, contents_container, nearest[i].link, new Obsidian.Component());
        }
        this.add_link_listeners(contents, nearest[i], item);
      }
      this.render_brand(container, "block");
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
          Obsidian.MarkdownRenderer.renderMarkdown((await this.block_retriever(block.link, {lines: 10, max_chars: 1000})), block_container, block.link, new Obsidian.Component());
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
          Obsidian.MarkdownRenderer.renderMarkdown(first_ten_lines, block_container, file[0].link, new Obsidian.Component());
          this.add_link_listeners(block_link, file[0], file_link_list);

        }
      }
    }
    this.render_brand(container, "file");
  }

  add_link_listeners(item, curr, list) {
    item.addEventListener("click", async (event) => {
      await this.open_note(curr, event);
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
  async open_note(curr, event=null) {
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
    let leaf;
    if(event) {
      // properly handle if the meta/ctrl key is pressed
      const mod = Obsidian.Keymap.isModEvent(event);
      // get most recent leaf
      leaf = this.app.workspace.getLeaf(mod);
    }else{
      // get most recent leaf
      leaf = this.app.workspace.getMostRecentLeaf();
    }
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
  // get all folders
  async get_all_folders() {
    if(!this.folders || this.folders.length === 0){
      this.folders = await this.get_folders();
    }
    return this.folders;
  }
  // get folders, traverse non-hidden sub-folders
  async get_folders(path = "/") {
    let folders = (await this.app.vault.adapter.list(path)).folders;
    let folder_list = [];
    for (let i = 0; i < folders.length; i++) {
      if (folders[i].startsWith(".")) continue;
      folder_list.push(folders[i]);
      folder_list = folder_list.concat(await this.get_folders(folders[i] + "/"));
    }
    return folder_list;
  }


  async sync_notes() {
    // if license key is not set, return
    if(!this.settings.license_key){
      new Obsidian.Notice("Smart Connections: Supporter license key is required to sync notes to the ChatGPT Plugin server.");
      return;
    }
    console.log("syncing notes");
    // get all files in vault
    const files = this.app.vault.getMarkdownFiles().filter((file) => {
      // filter out file paths matching any strings in this.file_exclusions
      for(let i = 0; i < this.file_exclusions.length; i++) {
        if(file.path.indexOf(this.file_exclusions[i]) > -1) {
          return false;
        }
      }
      return true;
    });
    const notes = await this.build_notes_object(files);
    console.log("object built");
    // save notes object to .smart-connections/notes.json
    await this.app.vault.adapter.write(".smart-connections/notes.json", JSON.stringify(notes, null, 2));
    console.log("notes saved");
    console.log(this.settings.license_key);
    // POST notes object to server
    const response = await (0, Obsidian.requestUrl)({
      url: "https://sync.smartconnections.app/sync",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      contentType: "application/json",
      body: JSON.stringify({
        license_key: this.settings.license_key,
        notes: notes
      })
    });
    console.log(response);

  }

  async build_notes_object(files) {
    let output = {};
  
    for(let i = 0; i < files.length; i++) {
      let file = files[i];
      let parts = file.path.split("/");
      let current = output;
  
      for (let ii = 0; ii < parts.length; ii++) {
        let part = parts[ii];
  
        if (ii === parts.length - 1) {
          // This is a file
          current[part] = await this.app.vault.cachedRead(file);
        } else {
          // This is a directory
          if (!current[part]) {
            current[part] = {};
          }
  
          current = current[part];
        }
      }
    }
  
    return output;
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
      await this.plugin.smart_vec_lite.init_embeddings_file();
      // reload view
      await this.render_connections();
    });

    // add click event to "retry" button
    retry_button.addEventListener("click", async (event) => {
      console.log("retrying to load embeddings.json file");
      // reload embeddings.json file
      await this.plugin.init_vecs();
      // reload view
      await this.render_connections();
    });
  }

  async onOpen() {
    const container = this.containerEl.children[1];
    container.empty();
    // placeholder text
    container.createEl("p", { cls: "scPlaceholder", text: "Open a note to find connections." }); 

    // runs when file is opened
    this.plugin.registerEvent(this.app.workspace.on('file-open', (file) => {
      // if no file is open, return
      if(!file) {
        // console.log("no file open, returning");
        return;
      }
      // return if file type is not supported
      if(SUPPORTED_FILE_TYPES.indexOf(file.extension) === -1) {
        return this.set_message([
          "File: "+file.name
          ,"Unsupported file type (Supported: "+SUPPORTED_FILE_TYPES.join(", ")+")"
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
    this.app.workspace.registerHoverLinkSource(SMART_CONNECTIONS_CHAT_VIEW_TYPE, {
        display: 'Smart Chat Links',
        defaultMod: true,
    });

    this.app.workspace.onLayoutReady(this.initialize.bind(this));
    
  }
  
  async initialize() {
    this.set_message("Loading embeddings file...");
    const vecs_intiated = await this.plugin.init_vecs();
    if(vecs_intiated){
      this.set_message("Embeddings file loaded.");
      await this.render_connections();
    }else{
      this.render_embeddings_buttons();
    }

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
    console.log("closing smart connections view");
    this.app.workspace.unregisterHoverLinkSource(SMART_CONNECTIONS_VIEW_TYPE);
    this.plugin.view = null;
  }

  async render_connections(context=null) {
    console.log("rendering connections");
    // if API key is not set then update view message
    if(!this.plugin.settings.api_key) {
      this.set_message("An OpenAI API key is required to make Smart Connections");
      return;
    }
    if(!this.plugin.embeddings_loaded){
      await this.plugin.init_vecs();
    }
    // if embedding still not loaded, return
    if(!this.plugin.embeddings_loaded) {
      console.log("embeddings files still not loaded or yet to be created");
      this.render_embeddings_buttons();
      return;
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
    await this.plugin.init_vecs();
    await this.view.render_connections();
  }
}
class ScSearchApi {
  constructor(app, plugin) {
    this.app = app;
    this.plugin = plugin;
  }
  async search (search_text, filter={}) {
    filter = {
      skip_sections: this.plugin.settings.skip_sections,
      ...filter
    }
    let nearest = [];
    const resp = await this.plugin.request_embedding_from_input(search_text);
    if (resp && resp.data && resp.data[0] && resp.data[0].embedding) {
      nearest = this.plugin.smart_vec_lite.nearest(resp.data[0].embedding, filter);
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
      text: "Supporter Settings"
    });
    // list supporter benefits
    containerEl.createEl("p", {
      text: "As a Smart Connections \"Supporter\", fast-track your PKM journey with priority perks and pioneering innovations."
    });
    // three list items
    const supporter_benefits_list = containerEl.createEl("ul");
    supporter_benefits_list.createEl("li", {
      text: "Enjoy swift, top-priority support."
    });
    supporter_benefits_list.createEl("li", {
      text: "Gain early access to experimental features like the ChatGPT plugin."
    });
    supporter_benefits_list.createEl("li", {
      text: "Stay informed and engaged with exclusive supporter-only communications."
    });
    // add a text input to enter supporter license key
    new Obsidian.Setting(containerEl).setName("Supporter License Key").setDesc("Note: this is not required to use Smart Connections.").addText((text) => text.setPlaceholder("Enter your license_key").setValue(this.plugin.settings.license_key).onChange(async (value) => {
      this.plugin.settings.license_key = value.trim();
      await this.plugin.saveSettings(true);
    }));
    // add button to trigger sync notes to use with ChatGPT
    new Obsidian.Setting(containerEl).setName("Sync Notes").setDesc("Make notes available via the Smart Connections ChatGPT Plugin. Respects exclusion settings configured below.").addButton((button) => button.setButtonText("Sync Notes").onClick(async () => {
      // sync notes
      await this.plugin.sync_notes();
    }));
    // add button to become a supporter
    new Obsidian.Setting(containerEl).setName("Become a Supporter").setDesc("Become a Supporter").addButton((button) => button.setButtonText("Become a Supporter").onClick(async () => {
      const payment_pages = [
        "https://buy.stripe.com/9AQ5kO5QnbAWgGAbIY",
        "https://buy.stripe.com/9AQ7sWemT48u1LGcN4"
      ];
      if(!this.plugin.payment_page_index){
        this.plugin.payment_page_index = Math.round(Math.random());
      }
      // open supporter page in browser
      window.open(payment_pages[this.plugin.payment_page_index]);
    }));

    
    containerEl.createEl("h2", {
      text: "OpenAI Settings"
    });
    // add a text input to enter the API key
    new Obsidian.Setting(containerEl).setName("OpenAI API Key").setDesc("Required: an OpenAI API key is currently required to use Smart Connections.").addText((text) => text.setPlaceholder("Enter your api_key").setValue(this.plugin.settings.api_key).onChange(async (value) => {
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
      dropdown.addOption("gpt-3.5-turbo-16k", "gpt-3.5-turbo-16k");
      dropdown.addOption("gpt-4", "gpt-4 (limited access, 8k)");
      dropdown.addOption("gpt-3.5-turbo", "gpt-3.5-turbo (4k)");
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
    // toggle chat_open on Obsidian startup
    new Obsidian.Setting(containerEl).setName("chat_open").setDesc("Open view on Obsidian startup.").addToggle((toggle) => toggle.setValue(this.plugin.settings.chat_open).onChange(async (value) => {
      this.plugin.settings.chat_open = value;
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
    this.brackets_ct = 0;
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
    this.plugin.get_all_folders(); // sets this.plugin.folders necessary for folder-context
  }
  onClose() {
    this.chat.save_chat();
    this.app.workspace.unregisterHoverLinkSource(SMART_CONNECTIONS_CHAT_VIEW_TYPE);
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
    this.plugin.render_brand(this.containerEl, "chat");
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
      await this.render_message(this.chat.chat_ml[i].content, this.chat.chat_ml[i].role);
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
  // open file suggestion modal
  open_file_suggestion_modal() {
    // open file suggestion modal
    if(!this.file_selector) this.file_selector = new SmartConnectionsFileSelectModal(this.app, this);
    this.file_selector.open();
  }
  // open folder suggestion modal
  async open_folder_suggestion_modal() {
    // open folder suggestion modal
    if(!this.folder_selector){
      this.folder_selector = new SmartConnectionsFolderSelectModal(this.app, this);
    }
    this.folder_selector.open();
  }
  // insert_selection from file suggestion modal
  insert_selection(insert_text) {
    // get caret position
    let caret_pos = this.textarea.selectionStart;
    // get text before caret
    let text_before = this.textarea.value.substring(0, caret_pos);
    // get text after caret
    let text_after = this.textarea.value.substring(caret_pos, this.textarea.value.length);
    // insert text
    this.textarea.value = text_before + insert_text + text_after;
    // set caret position
    this.textarea.selectionStart = caret_pos + insert_text.length;
    this.textarea.selectionEnd = caret_pos + insert_text.length;
    // focus on textarea
    this.textarea.focus();
  }

  // render chat textarea and button
  render_chat_input() {
    // create container for chat input
    let chat_input = this.chat_container.createDiv("sc-chat-form");
    // create textarea
    this.textarea = chat_input.createEl("textarea", {
      cls: "sc-chat-input",
      attr: {
        placeholder: `Try "Based on my notes" or "Summarize [[this note]]" or "Important tasks in /folder/"`
      }
    });
    // use contenteditable instead of textarea
    // this.textarea = chat_input.createEl("div", {cls: "sc-chat-input", attr: {contenteditable: true}});
    // add event listener to listen for shift+enter
    chat_input.addEventListener("keyup", (e) => {
      if(["[", "/"].indexOf(e.key) === -1) return; // skip if key is not [ or /
      const caret_pos = this.textarea.selectionStart;
      // if key is open square bracket
      if (e.key === "[") {
        // if previous char is [
        if(this.textarea.value[caret_pos - 2] === "["){
          // open file suggestion modal
          this.open_file_suggestion_modal();
          return;
        }
      }else{
        this.brackets_ct = 0;
      }
      // if / is pressed
      if (e.key === "/") {
        // get caret position
        // if this is first char or previous char is space
        if (this.textarea.value.length === 1 || this.textarea.value[caret_pos - 2] === " ") {
          // open folder suggestion modal
          this.open_folder_suggestion_modal();
          return;
        }
      }

    });

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
    await this.render_message(user_input, "user");
    this.chat.new_message_in_thread({
      role: "user",
      content: user_input
    });
    await this.render_dotdotdot();

    // if contains internal link represented by [[link]]
    if(this.chat.contains_internal_link(user_input)) {
      this.chat.get_response_with_note_context(user_input, this);
      return;
    }
    // // for testing purposes
    // if(this.chat.contains_folder_reference(user_input)) {
    //   const folders = this.chat.get_folder_references(user_input);
    //   console.log(folders);
    //   return;
    // }
    // if contains self referential keywords or folder reference
    if(this.contains_self_referential_keywords(user_input) || this.chat.contains_folder_reference(user_input)) {
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
      return;
    }
    // completion without any specific context
    this.request_chatgpt_completion();
  }
  
  async render_dotdotdot() {
    if (this.dotdotdot_interval)
      clearInterval(this.dotdotdot_interval);
    await this.render_message("...", "assistant");
    // if is '...', then initiate interval to change to '.' and then to '..' and then to '...'
    let dots = 0;
    this.active_elm.innerHTML = '...';
    this.dotdotdot_interval = setInterval(() => {
      dots++;
      if (dots > 3)
        dots = 1;
      this.active_elm.innerHTML = '.'.repeat(dots);
    }, 500);
    // wait 2 seconds for testing
    // await new Promise(r => setTimeout(r, 2000));
  }

  set_streaming_ux() {
    this.prevent_input = true;
    // hide send button
    if(document.getElementById("sc-send-button"))
      document.getElementById("sc-send-button").style.display = "none";
    // show abort button
    if(document.getElementById("sc-abort-button"))
      document.getElementById("sc-abort-button").style.display = "block";
  }
  unset_streaming_ux() {
    this.prevent_input = false;
    // show send button, remove display none
    if(document.getElementById("sc-send-button"))
      document.getElementById("sc-send-button").style.display = "";
    // hide abort button
    if(document.getElementById("sc-abort-button"))
      document.getElementById("sc-abort-button").style.display = "none";
  }


  // check if includes keywords referring to one's own notes
  contains_self_referential_keywords(user_input) {
    const matches = user_input.match(this.plugin.self_ref_kw_regex);
    if(matches) return true;
    return false;
  }

  // render message
  async render_message(message, from="assistant", append_last=false) {
    // if dotdotdot interval is set, then clear it
    if(this.dotdotdot_interval) {
      clearInterval(this.dotdotdot_interval);
      this.dotdotdot_interval = null;
      // clear last message
      this.active_elm.innerHTML = '';
    }
    if(append_last) {
      this.current_message_raw += message;
      if(message.indexOf('\n') === -1) {
        this.active_elm.innerHTML += message;
      }else{
        this.active_elm.innerHTML = '';
        // append to last message
        await Obsidian.MarkdownRenderer.renderMarkdown(this.current_message_raw, this.active_elm, '?no-dataview', new Obsidian.Component());
      }
    }else{
      this.current_message_raw = '';
      if((this.chat.thread.length === 0) || (this.last_from !== from)) {
        // create message
        this.new_messsage_bubble(from);
      }
      // set message text
      this.active_elm.innerHTML = '';
      await Obsidian.MarkdownRenderer.renderMarkdown(message, this.active_elm, '?no-dataview', new Obsidian.Component());
      // get links
      this.handle_links_in_message();
      // render button(s)
      this.render_message_action_buttons(message);
    }
    // scroll to bottom
    this.message_container.scrollTop = this.message_container.scrollHeight;
  }
  render_message_action_buttons(message) {
    if (this.chat.context && this.chat.hyd) {
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
    }
    if(this.chat.context) {
      // render copy context button
      const copy_prompt_button = this.active_elm.createEl("span", {
        cls: "sc-msg-button",
        attr: {
          title: "Copy prompt to clipboard" /* tooltip */
        }
      });
      const this_context = this.chat.context.replace(/\`\`\`/g, "\t```").trimLeft();
      Obsidian.setIcon(copy_prompt_button, "files");
      copy_prompt_button.addEventListener("click", () => {
        // copy to clipboard
        navigator.clipboard.writeText("```prompt-context\n" + this_context + "\n```\n");
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
  }

  handle_links_in_message() {
    const links = this.active_elm.querySelectorAll("a");
    // if this active element contains a link
    if (links.length > 0) {
      for (let i = 0; i < links.length; i++) {
        const link = links[i];
        const link_text = link.getAttribute("data-href");
        // trigger hover event on link
        link.addEventListener("mouseover", (event) => {
          this.app.workspace.trigger("hover-link", {
            event,
            source: SMART_CONNECTIONS_CHAT_VIEW_TYPE,
            hoverParent: link.parentElement,
            targetEl: link,
            // extract link text from a.data-href
            linktext: link_text
          });
        });
        // trigger open link event on link
        link.addEventListener("click", (event) => {
          const link_tfile = this.app.metadataCache.getFirstLinkpathDest(link_text, "/");
          // properly handle if the meta/ctrl key is pressed
          const mod = Obsidian.Keymap.isModEvent(event);
          // get most recent leaf
          let leaf = this.app.workspace.getLeaf(mod);
          leaf.openFile(link_tfile);
        });
      }
    }
  }

  new_messsage_bubble(from) {
    let message_el = this.message_container.createDiv(`sc-message ${from}`);
    // create message content
    this.active_elm = message_el.createDiv("sc-message-content");
    // set last from
    this.last_from = from;
  }

  async request_chatgpt_completion(opts={}) {
    const chat_ml = opts.messages || opts.chat_ml || this.chat.prepare_chat_ml();
    console.log("chat_ml", chat_ml);
    const max_total_tokens = Math.round(get_max_chars(this.plugin.settings.smart_chat_model) / 4);
    console.log("max_total_tokens", max_total_tokens);
    const curr_token_est = Math.round(JSON.stringify(chat_ml).length / 3);
    console.log("curr_token_est", curr_token_est);
    let max_available_tokens = max_total_tokens - curr_token_est;
    // if max_available_tokens is less than 0, set to 200
    if(max_available_tokens < 0) max_available_tokens = 200;
    console.log("max_available_tokens", max_available_tokens);
    opts = {
      model: this.plugin.settings.smart_chat_model,
      messages: chat_ml,
      // max_tokens: 250,
      max_tokens: max_available_tokens,
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
      await this.render_message(full_str, "assistant");
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
    }
    this.unset_streaming_ux();
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
    let filter = {};
    // if contains folder reference represented by /folder/
    if(this.chat.contains_folder_reference(user_input)) {
      // get folder references
      const folder_refs = this.chat.get_folder_references(user_input);
      // console.log(folder_refs);
      // if folder references are valid (string or array of strings)
      if(folder_refs){
        filter = {
          path_begins_with: folder_refs
        };
      }
    }
    // search for nearest based on hyd
    let nearest = await this.plugin.api.search(hyd, filter);
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
    const MAX_CHARS = get_max_chars(this.plugin.settings.smart_chat_model) / 2;
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
    console.log("total context tokens: ~" + Math.round(char_accum / 3.5));
    // build context input
    this.chat.context = `Anticipate the type of answer desired by the user. Imagine the following ${context.length} notes were written by the user and contain all the necessary information to answer the user's question. Begin responses with "${SMART_TRANSLATION[this.plugin.settings.language].prompt}..."`;
    for(let i = 0; i < context.length; i++) {
      this.chat.context += `\n---BEGIN #${i+1}---\n${context[i].text}\n---END #${i+1}---`;
    }
    return this.chat.context;
  }


}

function get_max_chars(model="gpt-3.5-turbo") {
  const MAX_CHAR_MAP = {
    "gpt-3.5-turbo-16k": 48000,
    "gpt-4": 24000,
    "gpt-3.5-turbo": 12000,
  };
  return MAX_CHAR_MAP[model];
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
  async load_chat(chat_id) {
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
  // get response from with note context
  async get_response_with_note_context(user_input, chat_view) {
    let system_input = "Imagine the following notes were written by the user and contain the necessary information to synthesize a useful answer the user's query:\n";
    // extract internal links
    const notes = this.extract_internal_links(user_input);
    // get content of internal links as context
    let max_chars = get_max_chars(this.plugin.settings.smart_chat_model);
    for(let i = 0; i < notes.length; i++){
      // max chars for this note is max_chars divided by number of notes left
      const this_max_chars = (notes.length - i > 1) ? Math.floor(max_chars / (notes.length - i)) : max_chars;
      // console.log("file context max chars: " + this_max_chars);
      const note_content = await this.get_note_contents(notes[i], {char_limit: this_max_chars});
      system_input += `---BEGIN NOTE: [[${notes[i].basename}]]---\n`
      system_input += note_content;
      system_input += `---END NOTE---\n`
      max_chars -= note_content.length;
      if(max_chars <= 0) break;
    }
    this.context = system_input;
    const chatml = [
      {
        role: "system",
        content: system_input
      },
      {
        role: "user",
        content: user_input
      }
    ];
    chat_view.request_chatgpt_completion({messages: chatml, temperature: 0});
  }
  // check if contains internal link
  contains_internal_link(user_input) {
    if(user_input.indexOf("[[") === -1) return false;
    if(user_input.indexOf("]]") === -1) return false;
    return true;
  }
  // check if contains folder reference (ex. /folder/, or /folder/subfolder/)
  contains_folder_reference(user_input) {
    if(user_input.indexOf("/") === -1) return false;
    if(user_input.indexOf("/") === user_input.lastIndexOf("/")) return false;
    return true;
  }
  // get folder references from user input
  get_folder_references(user_input) {
    // use this.folders to extract folder references by longest first (ex. /folder/subfolder/ before /folder/) to avoid matching /folder/subfolder/ as /folder/
    const folders = this.plugin.folders.slice(); // copy folders array
    const matches = folders.sort((a, b) => b.length - a.length).map(folder => {
      // check if folder is in user_input
      if(user_input.indexOf(folder) !== -1){
        // remove folder from user_input to prevent matching /folder/subfolder/ as /folder/
        user_input = user_input.replace(folder, "");
        return folder;
      }
      return false;
    }).filter(folder => folder);
    console.log(matches);
    // return array of matches
    if(matches) return matches;
    return false;
  }


  // extract internal links
  extract_internal_links(user_input) {
    const matches = user_input.match(/\[\[(.*?)\]\]/g);
    console.log(matches);
    // return array of TFile objects
    if(matches) return matches.map(match => {
      return this.app.metadataCache.getFirstLinkpathDest(match.replace("[[", "").replace("]]", ""), "/");
    });
    return [];
  }
  // get context from internal links
  async get_note_contents(note, opts={}) {
    opts = {
      char_limit: 10000,
      ...opts
    }
    // return if note is not a file
    if(!(note instanceof Obsidian.TFile)) return "";
    // get file content
    let file_content = await this.app.vault.cachedRead(note);
    // check if contains dataview code block
    if(file_content.indexOf("```dataview") > -1){
      // if contains dataview code block get all dataview code blocks
      file_content = await this.render_dataview_queries(file_content, note.path, opts);
    }
    file_content = file_content.substring(0, opts.char_limit);
    // console.log(file_content.length);
    return file_content;
  }


  async render_dataview_queries(file_content, note_path, opts={}) {
    opts = {
      char_limit: null,
      ...opts
    };
    // use window to get dataview api
    const dataview_api = window["DataviewAPI"];
    // skip if dataview api not found
    if(!dataview_api) return file_content;
    const dataview_code_blocks = file_content.match(/```dataview(.*?)```/gs);
    // for each dataview code block
    for (let i = 0; i < dataview_code_blocks.length; i++) {
      // if opts char_limit is less than indexOf dataview code block, break
      if(opts.char_limit && opts.char_limit < file_content.indexOf(dataview_code_blocks[i])) break;
      // get dataview code block
      const dataview_code_block = dataview_code_blocks[i];
      // get content of dataview code block
      const dataview_code_block_content = dataview_code_block.replace("```dataview", "").replace("```", "");
      // get dataview query result
      const dataview_query_result = await dataview_api.queryMarkdown(dataview_code_block_content, note_path, null);
      // if query result is successful, replace dataview code block with query result
      if (dataview_query_result.successful) {
        file_content = file_content.replace(dataview_code_block, dataview_query_result.value);
      }
    }
    return file_content;
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

// File Select Fuzzy Suggest Modal
class SmartConnectionsFileSelectModal extends Obsidian.FuzzySuggestModal {
  constructor(app, view) {
    super(app);
    this.app = app;
    this.view = view;
    this.setPlaceholder("Type the name of a file...");
  }
  getItems() {
    // get all markdown files
    return this.app.vault.getMarkdownFiles().sort((a, b) => a.basename.localeCompare(b.basename));
  }
  getItemText(item) {
    return item.basename;
  }
  onChooseItem(file) {
    this.view.insert_selection(file.basename + "]] ");
  }
}
// Folder Select Fuzzy Suggest Modal
class SmartConnectionsFolderSelectModal extends Obsidian.FuzzySuggestModal {
  constructor(app, view) {
    super(app);
    this.app = app;
    this.view = view;
    this.setPlaceholder("Type the name of a folder...");
  }
  getItems() {
    return this.view.plugin.folders;
  }
  getItemText(item) {
    return item;
  }
  onChooseItem(folder) {
    this.view.insert_selection(folder + "/ ");
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