const Obsidian = require("obsidian");
// require built-in crypto module
const crypto = require("crypto");
const { json } = require("stream/consumers");

// const DEFAULT_SETTINGS = require( "./json/defaults.json" ); // no longer needed in this file
const { /* VERSION, MAX_EMBED_STRING_LENGTH, */ SMART_CONNECTIONS_VIEW_TYPE, SMART_CONNECTIONS_CHAT_VIEW_TYPE } = require( "./json/constants.json" );
// VERSION, and MAX_EMBED_STRING_LENGTH are no longer used in this file

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
  }

  // async loadSettings() { ... } - moved to loadSettings.js
  // async saveSettings(rerender=false) { ... } - moved to saveSettings.js
  // async onload() { ... } - moved to onload.js
  // async render_code_block(contents, container, ctx) { ... } - moved to render_code_block.js
  // async make_connections(selected_text=null) { ... } - moved to make_connections.js
  // async initialize() { ... } - moved to initialize.js
  // addIcon(){ ... } - moved to addIcon.js
  // open_view(){ ... } - moved to open_view.js
  // get_view(){ ... } - moved to get_view.js
    // - source: https://github.com/obsidianmd/obsidian-releases/blob/master/plugin-review.md#avoid-managing-references-to-custom-views
  // open_chat(){ ... } - moved to open_chat.js
  // async get_all_embeddings() { ... } - moved to get_all_embeddings.js
  // async save_embeddings_to_file(force=false) { ... } - moved to save_embeddings_to_file.js
  // async save_failed_embeddings () { ... } - moved to save_failed_embeddings.js
    // - save failed embeddings to file from render_log.failed_embeddings
  // async test_file_writing () { ... } - moved to test_file_writing.js
    // - test writing file to check if file system is read-only
  // async load_failed_files () { ... } - moved to load_failed_files.js
    // - load failed files from failed-embeddings.txt
  // async retry_failed_files () { ... } - moved to retry_failed_files.js
    // - retry failed embeddings
  // clean_up_embeddings(files) { ... } - moved to clean_up_embeddings.js
    // - check if key from embeddings exists in files
  // async init_embeddings_file() { ... } - moved to init_embeddings_file.js
  // async migrate_embeddings_to_v2() { ... } - moved to migrate_embeddings_to_v2.js
    // - if embeddings.json exists then use it to create embeddings-2.json
  // async add_to_gitignore() { ... } - moved to add_to_gitignore.js
    // - add .smart-connections to .gitignore to prevent issues with large, frequently updated embeddings file(s)
  // async force_refresh_embeddings_file() { ... } - moved to force_refresh_embeddings_file.js
    // - force refresh embeddings file but first rename existing embeddings file to .smart-connections/embeddings-YYYY-MM-DD.json
  // async get_file_embeddings(curr_file, save=true) { ... } - moved to get_file_embeddings.js
    // - get embeddings for embed_input
  // update_render_log(blocks, file_embed_input) { ... } - moved to update_render_log.js
  // async get_embeddings(key, embed_input, meta={}) { ... } - moved to get_embeddings.js
  // async get_embeddings_batch(req_batch) { ... } - moved to get_embeddings_batch.js
  // get_embed_hash(embed_input) { ... } - moved to get_embed_hash.js
    // - md5 hash of embed_input using built in crypto module
  // async request_embedding_from_input(embed_input, retries = 0) { ... } - moved to request_embedding_from_input.js
  // async test_api_key() { ... } - moved to test_api_key.js
  // find_nearest_embedding(to_vec, to_key=null) { ... } - moved to find_nearest_embedding.js
  // output_render_log() { ... } - moved to output_render_log.js
  // async find_note_connections(current_note=null) { ... } - moved to find_note_connections.js
    // - find connections by most similar to current note by cosine similarity
  // log_exclusion(exclusion) { ... } - moved to log_exclusion.js
    // - create render_log object of exlusions with number of times skipped as value
  // onunload() { ... } - moved to onunload.js
  // computeCosineSimilarity(vector1, vector2) { ... } - moved to computeCosineSimilarity.js
  // block_parser(markdown, file_path){ ... } - moved to block_parser.js
    // - reverse-retrieve block given path
  // async block_retriever(path, limits={}) { ... } - moved to block_retriever.js
  // async file_retriever(link, limits={}) { ... } - moved to file_retriever.js
    // - retrieve a file from the vault
  // validate_headings(block_headings) { ... } - moved to validate_headings.js
    // - iterate through blocks and skip if block_headings contains this.header_exclusions
  // render_brand(container) { ... } - moved to render_brand.js
    // - render "Smart Connections" text fixed in the bottom right corner
  // async update_results(container, nearest) { ... } - moved to update_results.js
    // - create list of nearest notes
  // add_link_listeners(item, curr, list) { ... } - moved to add_link_listeners.js
  // async handle_click(curr, event) { ... } - moved to handle_click.js
    // - get target file from link path
    // - if sub-section is linked, open file and scroll to sub-section
  // render_block_context(block) { ... } - moved to render_block_context.js
  // renderable_file_type(link) { ... } - moved to renderable_file_type.js
  // render_external_link_elm(meta){ ... } - moved to render_external_link_elm.js

}

// inject the methods into the class
// IoC/DI is a 2-way street,
// - sometimes dependencies inject methods/props into the main script,
// - sometimes the main script injects dependencies into the dependency scripts
//   - which is why some of these injectors have more than one argument
//     - examples:
//       - These files depends on the Obsidian dependency:
//         - addIcon.js
//         - save_embeddings_to_file.js
//       - This file depends on the Obsidian and the crypto dependency:
//         - get_all_embeddings.js

const PLUGIN_INJECTORS = "./src/classes/SmartConnectionsPlugin"

require(`${ PLUGIN_INJECTORS }/loadSettings.js`)( SmartConnectionsPlugin )
require(`${ PLUGIN_INJECTORS }/saveSettings.js`)( SmartConnectionsPlugin )
require(`${ PLUGIN_INJECTORS }/onload.js`)( SmartConnectionsPlugin )
require(`${ PLUGIN_INJECTORS }/render_code_block.js`)( SmartConnectionsPlugin )
require(`${ PLUGIN_INJECTORS }/make_connections.js`)( SmartConnectionsPlugin )
require(`${ PLUGIN_INJECTORS }/initialize.js`)( SmartConnectionsPlugin )
require(`${ PLUGIN_INJECTORS }/addIcon.js`)( Obsidian, SmartConnectionsPlugin ) // requires 2 classes
require(`${ PLUGIN_INJECTORS }/open_view.js`)( SmartConnectionsPlugin )
require(`${ PLUGIN_INJECTORS }/get_view.js`)( SmartConnectionsView, SmartConnectionsPlugin ) // requires 2 classes
require(`${ PLUGIN_INJECTORS }/open_chat.js`)( SmartConnectionsPlugin )
require(`${ PLUGIN_INJECTORS }/get_all_embeddings.js`)( Obsidian, crypto, SmartConnectionsPlugin ) // requires 3 classes
require(`${ PLUGIN_INJECTORS }/save_embeddings_to_file.js`)( Obsidian, SmartConnectionsPlugin ) // requires 2 classes
require(`${ PLUGIN_INJECTORS }/save_failed_embeddings.js`)( SmartConnectionsPlugin )
require(`${ PLUGIN_INJECTORS }/test_file_writing.js`)( SmartConnectionsPlugin )
require(`${ PLUGIN_INJECTORS }/load_failed_files.js`)( SmartConnectionsPlugin )
require(`${ PLUGIN_INJECTORS }/retry_failed_files.js`)( SmartConnectionsPlugin )
require(`${ PLUGIN_INJECTORS }/clean_up_embeddings.js`)( SmartConnectionsPlugin )
require(`${ PLUGIN_INJECTORS }/init_embeddings_file.js`)( SmartConnectionsPlugin )
require(`${ PLUGIN_INJECTORS }/migrate_embeddings_to_v2.js`)( crypto, SmartConnectionsPlugin )
require(`${ PLUGIN_INJECTORS }/add_to_gitignore.js"`)( SmartConnectionsPlugin )
require(`${ PLUGIN_INJECTORS }/force_refresh_embeddings_file.js`)( Obsidian, SmartConnectionsPlugin ) // requires 2 classes
require(`${ PLUGIN_INJECTORS }/get_file_embeddings.js"`)( crypto, SmartConnectionsPlugin )
require(`${ PLUGIN_INJECTORS }/update_render_log.js"`)( SmartConnectionsPlugin )
// require(`${ PLUGIN_INJECTORS }/get_embeddings.js"`)( SmartConnectionsPlugin )
require(`${ PLUGIN_INJECTORS }/get_embeddings_batch.js"`)( SmartConnectionsPlugin )
require(`${ PLUGIN_INJECTORS }/get_embed_hash.js`)( crypto, SmartConnectionsPlugin ) // requires 2 classes
require(`${ PLUGIN_INJECTORS }/request_embedding_from_input.js"`)( Obsidian, SmartConnectionsPlugin )
require(`${ PLUGIN_INJECTORS }/test_api_key.js"`)( SmartConnectionsPlugin )
require(`${ PLUGIN_INJECTORS }/find_nearest_embedding.js"`)( SmartConnectionsPlugin )
require(`${ PLUGIN_INJECTORS }/output_render_log.js"`)( SmartConnectionsPlugin )
require(`${ PLUGIN_INJECTORS }/find_note_connections.js`)( crypto, SmartConnectionsPlugin ) // requires 2 classes
require(`${ PLUGIN_INJECTORS }/log_exclusion.js"`)( SmartConnectionsPlugin )
require(`${ PLUGIN_INJECTORS }/onunload.js"`)( SmartConnectionsPlugin )
require(`${ PLUGIN_INJECTORS }/computeCosineSimilarity.js"`)( SmartConnectionsPlugin )
require(`${ PLUGIN_INJECTORS }/block_parser.js"`)( SmartConnectionsPlugin )
require(`${ PLUGIN_INJECTORS }/block_retriever.js"`)( Obsidian, SmartConnectionsPlugin ) // requires 2 classes
require(`${ PLUGIN_INJECTORS }/file_retriever.js"`)( Obsidian, SmartConnectionsPlugin ) // requires 2 classes
require(`${ PLUGIN_INJECTORS }/validate_headings.js"`)( Obsidian, SmartConnectionsPlugin ) // requires 2 classes
require(`${ PLUGIN_INJECTORS }/render_brand.js"`)( Obsidian, SmartConnectionsPlugin ) // requires 2 classes
require(`${ PLUGIN_INJECTORS }/update_results.js"`)( Obsidian, SmartConnectionsPlugin ) // requires 2 classes
require(`${ PLUGIN_INJECTORS }/add_link_listeners.js"`)( SmartConnectionsPlugin )
require(`${ PLUGIN_INJECTORS }/handle_click.js"`)( Obsidian, SmartConnectionsPlugin )
require(`${ PLUGIN_INJECTORS }/render_block_context.js"`)( SmartConnectionsPlugin )
require(`${ PLUGIN_INJECTORS }/renderable_file_type.js"`)( SmartConnectionsPlugin )
require(`${ PLUGIN_INJECTORS }/render_external_link_elm.js"`)( SmartConnectionsPlugin )

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
    const nearest = await this.api.search(search_text);
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
    console.log(files_list);
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

// const SMART_CONNECTIONS_CHAT_VIEW_TYPE = "smart-connections-chat-view"; // set at the top of the file
const INITIAL_MESSAGE = "Hi, I'm ChatGPT with access to your notes via Smart Connections. Ask me a question about your notes and I'll try to answer it.";
class SmartConnectionsChatView extends Obsidian.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.chat_container = null;
    this.chat_box = null;
    this.message_container = null;
    this.current_chat_ml = [];
    this.last_from = null;
    this.last_msg = null;
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
    this.containerEl.empty();
    this.chat_container = this.containerEl.createDiv("sc-chat-container");
    // render plus sign for clear button
    this.render_top_bar();
    // render chat messages container
    this.render_chat_box();
    // render chat input
    this.render_chat_input();
    this.plugin.render_brand(this.containerEl);
    // render initial message from assistant
    this.render_message(INITIAL_MESSAGE, "assistant");
  }
  onClose() {
  }
  // render plus sign for clear button
  render_top_bar() {
    // create container for clear button
    let top_bar_container = this.chat_container.createDiv("sc-top-bar-container");
    // create button to open view
    // TODO: make button to open other view
    // create clear button
    let clear_button = top_bar_container.createEl("button", { cls: "clear-button" });
    clear_button.innerHTML = "+";
    // add event listener to button
    clear_button.addEventListener("click", () => {
      // clear chat box
      this.new_chat();
    });
  }
  new_chat() {
    // if this.dotdotdot_interval is not null, clear interval
    if (this.dotdotdot_interval) {
      clearInterval(this.dotdotdot_interval);
    }
    // clear current chat ml
    this.current_chat_ml = [];
    // update prevent input
    this.prevent_input = false;
    this.onOpen();
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
    });    
    // create button
    let button = chat_input.createEl("button", { cls: "send-button" });
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
    this.prevent_input = true;
    // render message
    this.render_message(user_input, "user");
    this.append_chatml(user_input, "user");
    // after 200 ms render "..."
    setTimeout(() => {
      this.render_message("...", "assistant");
    }, 200);
    // if does not include keywords referring to one's own notes, then just use chatgpt and return
    if(!this.contains_self_referential_keywords(user_input)) {
      this.request_chatgpt_completion();
      return;
    }
    // get hyde
    const context = await this.get_hyde_context(user_input);
    // get user input with added context
    const context_input = this.build_context_input(context);
    // console.log(context_input);
    const chatml = [
      {
        role: "system",
        content: context_input
      },
      {
        role: "user",
        content: user_input
      }
    ];
    this.request_chatgpt_completion({messages: chatml});
  }
  
  contains_self_referential_keywords(user_input) {
    const kw_regex = /\b(my|I|me|mine|our|ours|us|we)\b/gi;
    const matches = user_input.match(kw_regex);
    if(matches) return true;
    return false;
  }

  // build context input
  build_context_input(context) {
    let input = `Anticipate the type of answer desired by the user. Imagine the following ${context.length} notes were written by the user and contain all the necessary information to answer the user's question. Begin responses with "Based on your notes..."`;
    for(let i = 0; i < context.length; i++) {
      input += `\n---BEGIN #${i+1}---\n${context[i].text}\n---END #${i+1}---`;
    }
    return input;
  }

  // render message
  render_message(message, from="assistant", append_last=false) {
    if(append_last && this.last_from === from) {
      // if(this.last_msg.innerHTML === '...') this.last_msg.innerHTML = '';
      // if dotdotdot interval is set, then clear it
      if(this.dotdotdot_interval) {
        clearInterval(this.dotdotdot_interval);
        this.dotdotdot_interval = null;
        // clear last message
        this.last_msg.innerHTML = '';
      }
      this.current_message_raw += message;
      this.last_msg.innerHTML = '';
      // append to last message
      Obsidian.MarkdownRenderer.renderMarkdown(this.current_message_raw, this.last_msg, '?no-dataview', void 0);
    }else{
      this.current_message_raw = '';
      // set last from
      this.last_from = from;
      // create message
      let message_el = this.message_container.createDiv(`sc-message ${from}`);
      // create message content
      this.last_msg = message_el.createDiv("sc-message-content");
      // if is '...', then initiate interval to change to '.' and then to '..' and then to '...'
      if((from === "assistant") && (message === '...')) {
        let dots = 0;
        this.last_msg.innerHTML = '...';
        this.dotdotdot_interval = setInterval(() => {
          dots++;
          if(dots > 3) dots = 1;
          this.last_msg.innerHTML = '.'.repeat(dots);
        }, 500);
      }else{
        // set message text
        Obsidian.MarkdownRenderer.renderMarkdown(message, this.last_msg, '?no-dataview', void 0);
      }
    }
    // scroll to bottom
    this.message_container.scrollTop = this.message_container.scrollHeight;
  }
  async request_chatgpt_completion(opts={}) {
    opts = {
      model: this.plugin.settings.smart_chat_model,
      messages: this.current_chat_ml,
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
          const source = new ScStreamer(url, {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${this.plugin.settings.api_key}`
            },
            method: "POST",
            payload: JSON.stringify(opts)
          });
          let txt = "";
          source.addEventListener("message", (e) => {
            if (e.data != "[DONE]") {
              const payload = JSON.parse(e.data);
              const text = payload.choices[0].delta.content;
              if (!text) {
                return;
              }
              txt += text;
              this.render_message(text, "assistant", true);
            } else {
              source.close();
              // this.render_message(txt, "assistant", true);
              this.prevent_input = false;
              resolve(txt);
            }
          });
          source.addEventListener("readystatechange", (e) => {
            if (e.readyState >= 2) {
              console.log("ReadyState: " + e.readyState);
            }
          });
          source.stream();
        } catch (err) {
          console.error(err);
          new Obsidian.Notice("Smart Connections Error Streaming Response. See console for details.");
          this.prevent_input = false;
          reject(err);
        }
      });
      // console.log(full_str);
      this.append_chatml(full_str, "assistant");
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
  append_chatml(message, from="assistant") {
    this.current_chat_ml.push({
      role: from,
      content: message
    });
    return this.current_chat_ml;
  }

  async get_hyde_context(user_input) {
    // count current chat ml messages to determine 'question' or 'chat log' wording
    // let subject = "question";
    // if(this.current_chat_ml.length > 1) {
    //   subject = "chat log";
    // }
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
    // this.render_message(hyd, "assistant", true);
    // console.log(hyd);
    // search for nearest based on hyd
    let nearest = await this.plugin.api.search(hyd);
    // get std dev of similarity
    const sim = nearest.map((n) => n.similarity);
    const mean = sim.reduce((a, b) => a + b) / sim.length;
    const std_dev = Math.sqrt(sim.map((x) => Math.pow(x - mean, 2)).reduce((a, b) => a + b) / sim.length);
    // slice where next item deviation is greater than std_dev
    let slice_i = 0;
    while(slice_i < nearest.length) {
      const next = nearest[slice_i + 1];
      if(next) {
        const next_dev = Math.abs(next.similarity - nearest[slice_i].similarity);
        if(next_dev > std_dev) {
          break;
        }
      }
      slice_i++;
    }
    // select top results
    nearest = nearest.slice(0, slice_i);
    // re-sort by quotient of similarity divided by len DESC
    nearest = nearest.sort((a, b) => {
      const a_score = a.similarity / a.len;
      const b_score = b.similarity / b.len;
      // if a is greater than b, return -1
      if(a_score > b_score) return -1;
      // if a is less than b, return 1
      if(a_score < b_score) return 1;
      // if a is equal to b, return 0
      return 0;
    });

    // console.log(nearest);
    // get the top 3 results excluding files (must have a # in the link)
    let top = [];
    const MAX_SOURCES = 20; // 10 * 1000 (max chars) = 10,000 chars (must be under ~16,000 chars or 4K tokens) 
    const MAX_CHARS = 10000;
    let char_accum = 0;
    for(let i = 0; i < nearest.length; i++) {
      if(top.length >= MAX_SOURCES) break;
      if(char_accum >= MAX_CHARS) break;
      if(typeof nearest[i].link !== 'string') continue;
      // generate breadcrumbs
      const breadcrumbs = nearest[i].link.replace(/#/g, " > ").replace(".md", "").replace(/\//g, " > ");
      let new_context = `${breadcrumbs}:\n`;
      // get max available chars to add to top
      const max_available_chars = MAX_CHARS - char_accum - new_context.length;
      if(nearest[i].link.indexOf("#") !== -1){ // is block
        new_context += await this.plugin.block_retriever(nearest[i].link, {max_chars: max_available_chars});
      }else{ // is file
        const this_file = this.app.vault.getAbstractFileByPath(nearest[i].link);
        // if file is not found, skip
        if (!(this_file instanceof Obsidian.TAbstractFile)) continue;
        // use cachedRead to get the first 10 lines of the file
        const file_content = await this.app.vault.cachedRead(this_file);
        // get up to max_available_chars from file_content
        new_context += file_content.substring(0, max_available_chars);
      }
      // add to char_accum
      char_accum += new_context.length;
      // add to top
      top.push({
        link: nearest[i].link,
        text: new_context
      });
    }
    // context sources
    console.log("context sources: " + top.length);
    // char_accum divided by 4 and rounded to nearest integer for estimated tokens
    console.log("total context tokens: ~" + Math.round(char_accum / 4));
    // console.log(top);
    return top;
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