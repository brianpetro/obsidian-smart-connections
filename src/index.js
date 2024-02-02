const {
  addIcon,
  Keymap,
  MarkdownRenderer,
  Notice,
  Plugin,
  request,
  requestUrl,
  TAbstractFile,
  TFile,
} = require("obsidian");
const { ObsidianAJSON } = require("smart-collections"); // NPM
// const { ObsidianAJSON } = require("../smart-collections"); // Local
const { SmartBrain } = require("./smart_connections");
const { default_settings } = require("./default_settings");
const { SmartView } = require("./SmartView");
const { SmartChatView } = require("./SmartChatView");
const { SmartConnectionsSettings } = require("./SmartConnectionsSettings");
const { SmartSearch } = require("./SmartSearch");
class SmartConnectionsPlugin extends Plugin {
  static get defaults() { return default_settings() }
  async open_note(target_path, event=null) {
    let targetFile;
    let heading;
    if (target_path.indexOf("#") > -1) {
      targetFile = this.app.metadataCache.getFirstLinkpathDest(target_path.split("#")[0], ""); // remove after # from link
      // console.log(targetFile);
      const target_file_cache = this.app.metadataCache.getFileCache(targetFile);
      // console.log(target_file_cache);
      let heading_text = target_path.split("#").pop(); // get heading
      // if heading text contains a curly brace, get the number inside the curly braces as occurence
      let occurence = 0;
      if (heading_text.indexOf("{") > -1) {
        // get occurence
        occurence = parseInt(heading_text.split("{")[1].split("}")[0]);
        // remove occurence from heading text
        heading_text = heading_text.split("{")[0];
      }
      const headings = target_file_cache.headings; // get headings from file cache
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
      targetFile = this.app.metadataCache.getFirstLinkpathDest(target_path, "");
    }
    let leaf;
    if(event) {
      const mod = Keymap.isModEvent(event); // properly handle if the meta/ctrl key is pressed
      leaf = this.app.workspace.getLeaf(mod); // get most recent leaf
    }else{
      leaf = this.app.workspace.getMostRecentLeaf(); // get most recent leaf
    }
    await leaf.openFile(targetFile);
    if (heading) {
      let { editor } = leaf.view;
      const pos = { line: heading.position.start.line, ch: 0 };
      editor.setCursor(pos);
      editor.scrollIntoView({ to: pos, from: pos }, true);
    }
  }
  async load_settings() {
    Object.assign(this.settings, await this.loadData());
    this.handle_deprecated_v1_settings(); // HANDLE DEPRECATED SETTINGS
  }
  async onload() { this.app.workspace.onLayoutReady(this.initialize.bind(this)); } // initialize when layout is ready
  onunload() {
    console.log("unloading plugin");
    this.brain?.unload();
    this.brain = null;
  }
  async initialize() {
    console.log("Loading Smart Connections v2...");
    Object.assign(this, this.constructor.defaults);
    await this.load_settings();
    this.smart_connections_view = null;
    this.add_commands(); // add commands
    this.register_views(); // register chat view type
    this.addSettingTab(new SmartConnectionsSettings(this.app, this)); // add settings tab
    this.check_for_updates();
    this.add_to_gitignore("\n\n# Ignore Smart Connections folder\n.smart-connections"); 
    this.api = new SmartSearch(this);
    (window["SmartSearch"] = this.api) && this.register(() => delete window["SmartSearch"]); // register API to global window object
    addIcon("smart-connections", `<path d="M50,20 L80,40 L80,60 L50,100" stroke="currentColor" stroke-width="4" fill="none"/>
    <path d="M30,50 L55,70" stroke="currentColor" stroke-width="5" fill="none"/>
    <circle cx="50" cy="20" r="9" fill="currentColor"/>
    <circle cx="80" cy="40" r="9" fill="currentColor"/>
    <circle cx="80" cy="70" r="9" fill="currentColor"/>
    <circle cx="50" cy="100" r="9" fill="currentColor"/>
    <circle cx="30" cy="50" r="9" fill="currentColor"/>`);
    // regist "change" dynamic code block
    this.registerMarkdownCodeBlockProcessor("smart-connections", this.render_code_block.bind(this)); // code-block renderer (DEPRECATE?)
    this.registerMarkdownCodeBlockProcessor("change", this.change_code_block.bind(this));
    this.registerMarkdownCodeBlockProcessor("merge", this.merge_code_block.bind(this));
    this.registerMarkdownCodeBlockProcessor("move", this.move_code_block.bind(this));
    this.obsidian = { document, Notice, request, requestUrl, TFile };
    this.brain = new SmartBrain(this, ObsidianAJSON);
    console.log(this.app);
    // this.brain.init();
    setTimeout(() => {
      if(!SmartChatView.is_open(this.app.workspace) && !SmartView.is_open(this.app.workspace)){
        const btn = { text: "Open Smart View", callback: () => { this.open_view(); } };
        this.show_notice("Smart View must be open for Smart Connections to work.", { button: btn, timeout: 0 });
      }
    }, 1000);
  }
  register_views() {
    this.registerView(SmartView.view_type, (leaf) => (new SmartView(leaf, this))); // register main view type
    this.registerView(SmartChatView.view_type, (leaf) => (new SmartChatView(leaf, this)));
  }
  async check_for_updates() {
    if(this.settings.version !== this.manifest.version){
      this.settings.version = this.manifest.version; // update version
      await this.save_settings(); // save settings
    }
    setTimeout(this.check_for_update.bind(this), 3000); // run after 3 seconds
    setInterval(this.check_for_update.bind(this), 10800000); // run check for update every 3 hours
  }
  check_for_update() { this.v2_updater(); } // check for update
  async v2_updater() {
    console.log("v2 updater");
    const { json: v2, status } = await requestUrl({
      url: "https://sync.smartconnections.app/download_v2",
      method: "POST",
      headers: { "Content-Type": "application/json", },
      body: JSON.stringify({ license_key: 'test' })
    });
    if(status !== 200) return console.error("Error downloading version 2", v2);
    const v2_version = JSON.parse(v2.manifest).version;
    console.log(v2_version, this.settings.version);
    if(v2_version === this.settings.version) return console.log("Already up to date");
    if(v2.main) await this.app.vault.adapter.write(".obsidian/plugins/smart-connections/main.js", v2.main); // add new
    if(v2.manifest) await this.app.vault.adapter.write(".obsidian/plugins/smart-connections/manifest.json", v2.manifest); // add new
    if(v2.styles) await this.app.vault.adapter.write(".obsidian/plugins/smart-connections/styles.css", v2.styles); // add new
    console.log('before', this.manifest.version);
    await this.app.plugins.loadManifests(); // load new manifest
    console.log('after', this.manifest.version);
    const restart_btn = { text: "Restart plugin", callback: () => { this.restart_plugin(); } };
    this.show_notice([`Updating to v${v2_version}`], { button: restart_btn, timeout: 0 });
    this.settings.version = v2_version; // update version
    await this.saveData(this.settings); // save settings
    await this.load_settings(); // re-load settings into memory
  }
  async restart_plugin() {
    await this.saveData(this.settings); // save settings
    await new Promise(r => setTimeout(r, 3000));
    window.restart_plugin = async (id) => {
      console.log("restarting plugin", id);
      await window.app.plugins.disablePlugin(id);
      await window.app.plugins.enablePlugin(id);
      console.log("plugin restarted", id);
    };
    window.restart_plugin(this.manifest.id);
  }

  add_commands() {
    // make connections command
    this.addCommand({
      id: "sc-find-notes",
      name: "Find: Make Smart Connections",
      icon: "pencil_icon",
      hotkeys: [],
      editorCallback: (editor) => {
        if(editor.somethingSelected()) this.view.render_nearest(editor.getSelection());
        else if(editor.getCursor()?.line){ // if cursor is on a line greater than 0
          const line = editor.getCursor().line;
          const block = this.brain.smart_notes.current_note.get_block_by_line(line);
          console.log(block);
          console.log(line);
          this.view.render_nearest(block);
        }
        else this.view.render_nearest();
      }
    });
    // open view command
    this.addCommand({
      id: "smart-connections-view",
      name: "Open: View Smart Connections",
      callback: () => { this.open_view(); }
    });
    // open chat command
    this.addCommand({
      id: "smart-connections-chat",
      name: "Open: Smart Chat Conversation",
      callback: () => { this.open_chat(); }
    });
    // open random note from nearest cache
    this.addCommand({
      id: "smart-connections-random",
      name: "Open: Random Note from Smart Connections",
      callback: () => {
        const curr_file = this.app.workspace.getActiveFile();
        const curr_note = this.brain?.smart_notes.get(curr_file.path);
        const nearest_blocks = curr_note.find_connections();
        const rand = Math.floor(Math.random() * nearest_blocks.length/2); // divide by 2 to limit to top half of results
        const rand_block = nearest_blocks[rand]; // get random from nearest cache
        rand_block.note.open(); // open random file
      }
    });
  }
  async make_connections(selected_text=null) {
    if(!this.view) await this.open_view(); // open view if not open
    await this.view.render_nearest(selected_text);
  }
  async save_settings(rerender=false) {
    await this.saveData(this.settings); // Obsidian API->saveData
    await this.load_settings(); // re-load settings into memory
    // re-render view if set to true (for example, after adding API key)
    if(rerender) {
      this.nearest_cache = {};
      console.log("rerendering view");
      await this.make_connections();
    }
  }
  // FX CALLS
  async change_code_block(source, el, ctx) {
    const active_file = this.app.workspace.getActiveFile();
    const note_path = active_file.path;
    // Create container div with border
    const container = this.init_container(el);
    // Create div for new content
    const new_content = source.substring(0, source.indexOf("---CHANGED---"));
    const old_content = source.substring(source.indexOf("---CHANGED---") + "---CHANGED---".length);
    const new_elm = container.createDiv();
    new_elm.style.marginBottom = "10px";
    MarkdownRenderer.renderMarkdown(new_content, new_elm, note_path, void 0);
    // Create div for old content
    const old_elm = container.createDiv();
    old_elm.style.display = "none";
    old_elm.style.marginBottom = "10px";
    MarkdownRenderer.renderMarkdown(`~~${old_content.trim()}~~`, old_elm, note_path, void 0);
    const actions_div = this.init_actions_container(container);
    // Create review button
    const review_button = actions_div.createEl("button");
    review_button.innerHTML = "Review";
    review_button.style.marginRight = "10px";
    // Button click events
    review_button.onclick = () => {
      // toggle display of old content
      if (old_elm.style.display == "block") old_elm.style.display = "none";
      else
        old_elm.style.display = "block";
    };
    const accept_button = this.init_accept_btn(actions_div);
    accept_button.onclick = async () => {
      // update note to replace code block with new content
      const content = await this.app.vault.cachedRead(active_file);
      const updated_content = content.replace("```change\n" + source + "\n```", new_content);
      await this.app.vault.modify(active_file, updated_content);
    }
    const reject_button = this.init_reject_btn(actions_div);
    reject_button.onclick = async () => {
      // update note to replace code block with old content
      const content = await this.app.vault.cachedRead(active_file);
      const updated_content = content.replace("```change\n" + source + "\n```", old_content);
      await this.app.vault.modify(active_file, updated_content);
    }
  }
  // Create actions div
  init_actions_container(container) {
    const actions_div = container.createDiv();
    actions_div.style.display = "flex";
    actions_div.style.justifyContent = "space-between";
    return actions_div;
  }
  // Create reject button
  init_reject_btn(actions_div) {
    const reject_button = actions_div.createEl("button");
    reject_button.innerHTML = "Reject";
    reject_button.style.border = "none";
    return reject_button;
  }
  // Create accept button
  init_accept_btn(actions_div) {
    const accept_button = actions_div.createEl("button");
    accept_button.innerHTML = "Accept";
    accept_button.style.border = "none";
    accept_button.style.marginRight = "10px";
    return accept_button;
  }
  init_container(el) {
    const container = el.createDiv();
    container.style.border = "1px solid var(--blockquote-border-color)";
    container.style.padding = "10px";
    container.style.marginBottom = "10px";
    return container;
  }
  // merge code block
  async merge_code_block(source, el, ctx) {
    const active_file = this.app.vault.getAbstractFileByPath(ctx.sourcePath);
    const note_path = active_file.path;
    // Create container div with border
    const container = this.init_container(el);
    // Create div for content to be merged
    const preview_content = `![[${source}]]`;
    const merge_elm = container.createDiv();
    merge_elm.style.marginBottom = "10px";
    MarkdownRenderer.renderMarkdown(preview_content, merge_elm, note_path, void 0);
    // init actions container
    const actions_container = this.init_actions_container(container);
    // Create accept button
    const accept_button = this.init_accept_btn(actions_container);
    accept_button.onclick = async () => {
      // update note to replace code block with new content
      const content = await this.app.vault.cachedRead(active_file);
      let merge_content = `# ${source}\n\n`;
      merge_content += await this.app.vault.cachedRead(this.app.metadataCache.getFirstLinkpathDest(source, note_path));
      const updated_content = content.replace("```merge\n" + source + "\n```", merge_content);
      await this.app.vault.modify(active_file, updated_content);
      // remove source note
      await this.app.vault.trash(this.app.metadataCache.getFirstLinkpathDest(source, note_path));
    }
    // Create reject button
    const reject_button = this.init_reject_btn(actions_container);
    reject_button.onclick = async () => {
      // update note to remove merge code block
      const content = await this.app.vault.cachedRead(active_file);
      const updated_content = content.replace("```merge\n" + source + "\n```", '');
      await this.app.vault.modify(active_file, updated_content);
    }
  }
  async move_code_block(cb_source, el, ctx) {
    // get note containing code block
    // use ctx.sourcePath to get note path
    const active_file = this.app.vault.getAbstractFileByPath(ctx.sourcePath);
    const note_name = active_file.basename;
    // Create container div with border
    const container = this.init_container(el);
    // Create div for destination representation
    const destination_elm = container.createDiv();
    destination_elm.style.marginBottom = "10px";
    destination_elm.innerHTML = `Move to: ${cb_source}`;
    // init actions container
    const actions_container = this.init_actions_container(container);
    // Create accept button
    const accept_button = this.init_accept_btn(actions_container);
    accept_button.onclick = async () => {
      await remove_code_block(this);
      const new_path = cb_source.replace(/\/$/g, "") + "/" + note_name + ".md";
      // move note to new location
      await this.app.vault.rename(active_file, new_path);
    }
    // Create reject button
    const reject_button = this.init_reject_btn(actions_container);
    reject_button.onclick = async () => {
      await remove_code_block(this);
    }

    // update note to remove move code block
    async function remove_code_block(instance) {
      const content = await instance.app.vault.cachedRead(active_file);
      const updated_content = content.replace("```move\n" + cb_source + "\n```", '');
      await instance.app.vault.modify(active_file, updated_content);
    }
  }
  // utils
  async add_to_gitignore(ignore, message=null) {
    if(!(await this.app.vault.adapter.exists(".gitignore"))) return; // if .gitignore skip
    let gitignore_file = await this.app.vault.adapter.read(".gitignore");
    if (gitignore_file.indexOf(ignore) < 0) {
      await this.app.vault.adapter.append(".gitignore", `\n\n${message ? "# " + message + "\n" : ""}${ignore}`);
      console.log("Added to .gitignore: " + ignore);
    }
  }
  show_notice(message, opts={}) {
    const {
      // html_elm,
      timeout,
      button,
    } = opts;
    // new notice
    if(timeout){
      // if(this._notice?.noticeEl?.parentElement) this._notice.hide(); // hide previous notice
      const _notice_doc_frag = document.createDocumentFragment();
      _notice_doc_frag.createEl("p", { cls: "sc-notice-head", text: "[Smart Connections]" }); // create notice element for Smart Connections header
      const text = _notice_doc_frag.createEl("p", { cls: "sc-notice-content", text: message }); // create notice element for Smart Connections content
      const actions = _notice_doc_frag.createEl("div", { cls: "sc-notice-actions" }); // create notice element for Smart Connections actions
      if(typeof message === 'string') text.innerText = message;
      else if(Array.isArray(message)) text.innerHTML = message.join("<br>");
      // if(html_elm instanceof HTMLElement) actions.appendChild(html_elm);
      if(button) this.add_notice_btn(button, actions);
      return new Notice(_notice_doc_frag, timeout);
    }
    // update existing notice
    if(!this._notice?.noticeEl?.parentElement) {
      this._notice_doc_frag = document.createDocumentFragment();
      this._notice_doc_frag.createEl("p", { cls: "sc-notice-head", text: "[Smart Connections]" }); // create notice element for Smart Connections header
      this._notice_content = this._notice_doc_frag.createEl("p", { cls: "sc-notice-content" }); // create notice element for Smart Connections content
      this._notice_actions = this._notice_doc_frag.createEl("div", { cls: "sc-notice-actions" }); // create notice element for Smart Connections actions
      this._notice = new Notice(this._notice_doc_frag, 0);
    }
    if(typeof message === 'string') this._notice_content.innerText = message;
    else if(Array.isArray(message)) this._notice_content.innerHTML = message.join("<br>");
    this._notice_actions.innerHTML = ""; // clear actions
    // if(html_elm instanceof HTMLElement) this._notice_actions.appendChild(html_elm);
    if(button) this.add_notice_btn(button, this._notice_actions);
    return this._notice;
  }
  add_notice_btn(button, container) {
    const btn = document.createElement("button");
    btn.innerHTML = button.text;
    btn.addEventListener("click", (e) => {
      if(button.stay_open){
        e.preventDefault();
        e.stopPropagation();
      }
      button.callback();
    });
    container.appendChild(btn);
  }

  // backwards compatibility
  handle_deprecated_v1_settings() {
    if (this.settings.header_exclusions) {
      this.settings.excluded_headings = this.settings.header_exclusions;
      delete this.settings.header_exclusions;
    }
  }
  open_view() { SmartView.open(this.app.workspace); }
  open_chat() { SmartChatView.open(this.app.workspace); }
  get view() { return SmartView.get_view(this.app.workspace); } 
  get chat_view() { return SmartChatView.get_view(this.app.workspace); }
  // V1
  // source: https://github.com/obsidianmd/obsidian-releases/blob/master/plugin-review.md#avoid-managing-references-to-custom-views
  // get view() { return this.app.workspace.getLeavesOfType(SmartView.view_type).find((leaf) => leaf.view instanceof SmartView)?.view; }
  // get chat_view() { return this.app.workspace.getLeavesOfType(SmartChatView.view_type).find((leaf) => leaf.view instanceof SmartChatView)?.view; }
  // open chat view
  // get folders, traverse non-hidden sub-folders
  async get_folders(path = "/") {
    const folders = (await this.app.vault.adapter.list(path)).folders;
    let folder_list = [];
    for (let i = 0; i < folders.length; i++) {
      if (folders[i].startsWith(".")) continue;
      folder_list.push(folders[i]);
      folder_list = folder_list.concat(await this.get_folders(folders[i] + "/"));
    }
    return folder_list;
  }
  // SUPPORTERS
  async sync_notes() {
    // if license key is not set, return
    if(!this.settings.license_key){
      new Notice("Smart Connections: Supporter license key is required to sync notes to the ChatGPT Plugin server.");
      return;
    }
    console.log("syncing notes");
    // get all files in vault
    // const files = this.app.vault.getMarkdownFiles().filter((file) => {
    //   // filter out file paths matching any strings in this.file_exclusions
    //   for(let i = 0; i < this.brain.file_exclusions.length; i++) {
    //     if(file.path.indexOf(this.brain.file_exclusions[i]) > -1) return false;
    //   }
    //   return true;
    // });
    const files = this.brain.files;
    const notes = await this.build_notes_object(files);
    // POST notes object to server
    const response = await requestUrl({
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
  async render_code_block(contents, container, ctx) {
    console.log(container);
    return this.view.render_nearest((contents.trim().length? contents : ctx.sourcePath), container);
  }
  // update smart connections folder
  async update_smart_connections_folder() {
    if(this.settings.smart_connections_folder === this.settings.smart_connections_folder_last) return; // if folder is the same as last, return
    if(!confirm("Are you sure you want to update the Smart Connections folder? This will move all Smart Connections files to the new folder and restart the plugin.")){
      this.settings.smart_connections_folder = this.settings.smart_connections_folder_last; // reset folder to last folder if user cancels
      return;
    }
    await this.app.vault.adapter.rename(this.settings.smart_connections_folder_last, this.settings.smart_connections_folder);
    // update last folder
    this.settings.smart_connections_folder_last = this.settings.smart_connections_folder;
    // save settings
    await this.save_settings();
    // reload plugin
    this.restart_plugin();
  }
  // test API key
  async test_api_key() {
    const req = {
      url: `https://api.openai.com/v1/embeddings`,
      method: "POST",
      body: JSON.stringify({ model: "text-embedding-ada-002", input: "test" }),
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${this.settings.api_key}` },
    };
    try{
      const resp = await requestUrl(req);
      if(resp?.json?.data?.[0]?.embedding?.length) return this.show_notice("Success! API key is valid");
      this.show_notice("Error: API key is invalid!");
    }catch(err){
      this.show_notice("Error: API key is invalid!");
      console.error("Smart Connections: Error testing API key", err);
    }
  }
}
module.exports = SmartConnectionsPlugin;