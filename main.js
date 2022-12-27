var Obsidian = require("obsidian");

var DEFAULT_SETTINGS = {
  api_key: "",
  file_exclusions: "",
  header_exclusions: "",
  path_only: "",
  show_full_path: false,
};

class SmartConnectionsPlugin extends Obsidian.Plugin {
  // constructor
  constructor() {
    super(...arguments);
    this.embeddings = {};
    this.files = [];
    this.nearest_cache = {};
    this.render_log = {};
    this.file_exclusions = [];
    this.header_exclusions = [];
    this.path_only = [];
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    // load file exclusions if not blank
    if(this.settings.file_exclusions && this.settings.file_exclusions.length > 0) {
      this.file_exclusions = this.settings.file_exclusions.split(",");
    }
    // load header exclusions if not blank
    if(this.settings.header_exclusions && this.settings.header_exclusions.length > 0) {
      this.header_exclusions = this.settings.header_exclusions.split(",");
    }
    // load path_only if not blank
    if(this.settings.path_only && this.settings.path_only.length > 0) {
      this.path_only = this.settings.path_only.split(",");
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
      name: "Find: Make Smart Connections!",
      icon: "pencil_icon",
      hotkeys: [],
      // editorCallback: async (editor) => {
      callback: async () => {
        // clear nearest_cache
        this.nearest_cache = {};
        console.log("Cleared nearest_cache");
        this.updateStatusBar(`Finding note connections... `);
        await this.render_note_connections();
        this.updateStatusBar(`Finding note connections complete!`);
      }
    });
    this.addCommand({
      id: "smart-connections-view",
      name: "View: Open Smart Connections Pane!",
      callback: () => {
        this.activateView();
      }
    });
    // get all files in vault
    // this.files = this.app.vault.getMarkdownFiles();
    this.addSettingTab(new SmartConnectionsSettingsTab(this.app, this));

    this.registerView(
      SMART_CONNECTIONS_VIEW_TYPE,
      (leaf) => new SmartConnectionsView(leaf)
    );

    this.app.workspace.registerHoverLinkSource(SMART_CONNECTIONS_VIEW_TYPE, {
        display: 'Smart Connections Files',
        defaultMod: true,
    });

    this.registerEvent(this.app.workspace.on('file-open', async (file) => {
      // console.log(file);
      // run when file is opened
      await this.render_note_connections(file);
    }));

    // init embeddings file
    await this.init_embeddings_file();
    // load embeddings
    this.embeddings = await this.load_embeddings_file();

    // activate view
    this.activateView();

  }

  async activateView() {
    this.app.workspace.detachLeavesOfType(SMART_CONNECTIONS_VIEW_TYPE);

    await this.app.workspace.getRightLeaf(false).setViewState({
      type: SMART_CONNECTIONS_VIEW_TYPE,
      active: true,
    });

    this.app.workspace.revealLeaf(
      this.app.workspace.getLeavesOfType(SMART_CONNECTIONS_VIEW_TYPE)[0]
    );

    // render view
    await this.render_note_connections();
  }
  
  // get embeddings for all files
  async get_all_embeddings() {
    // get all files in vault
    this.files = await this.app.vault.getMarkdownFiles();
    // console.log(this.files);
    // check if key from embeddings exists in files
    this.clean_up_embeddings();
    // batch embeddings
    let batch_promises = [];
    for (let i = 0; i < this.files.length; i++) {
      // skip if file already has embedding and embedding.mtime is greater than file.mtime
      if((this.embeddings[this.files[i].path]) && (this.embeddings[this.files[i].path].mtime >= this.files[i].stat.mtime)) {
        // log skipping file
        //console.log("skipping file (mtime)");
        continue;
      }
      // skip files where path contains any exclusions
      let skip = false;
      for(let j = 0; j < this.file_exclusions.length; j++) {
        if(this.files[i].path.indexOf(this.file_exclusions[j]) > -1) {
          skip = true;
          // console.log("skipping file with exclusion: " + this.file_exclusions[j]);
          // increment render_log for skipped file
          this.log_exclusion(this.file_exclusions[j]);
          // break out of loop
          break;
        }
      }
      if(skip) {
        continue;
      }
      // get_file_embeddings() for current file
      try {
        // push promise to batch_promises
        batch_promises.push(this.get_file_embeddings(this.files[i], false));
      } catch (error) {
        console.log(error);
      }
      // if batch_promises length is 10
      if(batch_promises.length > 10) {
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
    // first check if embeddings file exists
    await this.app.vault.adapter.write(".smart-connections/embeddings.json", JSON.stringify(this.embeddings));
  }

  clean_up_embeddings() {
    for (let key in this.embeddings) {
      // console.log("key: "+key);
      // if no key starts with file path
      if(!this.files.find(file => key.startsWith(file.path))) {
      // if (!this.files.find(file => file.path === key)) {
        // delete key if it doesn't exist
        delete this.embeddings[key];
        console.log("deleting (deleted file): " + key);
        continue;
      }
      // if key contains '#'
      if(key.indexOf("#") > -1) {
        // split at '#' and get first part
        let new_key = key.split("#")[0];
        // if new_key exists in embeddings
        // check if new_key.mtime is greater than key.mtime
        if((this.embeddings[new_key]) && (this.embeddings[new_key].mtime > this.embeddings[key].mtime)) {
          // delete key
          delete this.embeddings[key];
          console.log("deleting (old block): " + key);
        }
      }
    }
  }

  async load_embeddings_file(retries=0) {
    try {
      // get embeddings file contents from root of vault
      const embeddings_file = await this.app.vault.adapter.read(".smart-connections/embeddings.json");
      // parse file containing all embeddings JSON
      console.log("loaded embeddings from file");
      // loaded embeddings from file
      this.embeddings = JSON.parse(embeddings_file);
    } catch (error) {
      console.log(error);
      // retry if error up to 3 times
      if(retries < 3) {
        console.log("retrying load_embeddings_file()");
        // increase wait time between retries
        await new Promise(r => setTimeout(r, 1000+(3000*retries)));
        this.embeddings = await this.load_embeddings_file(retries+1);
      }else{
        console.log("failed to load embeddings file, creating new file");
        await this.init_embeddings_file();
      }
    }
    return this.embeddings;
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
    // build embed_input 
    let embed_input = `${embed_file.path}`;
    let batch_promises = [];
    if(!path_only){
      embed_input += `\n`;
      console.log(embed_file.path);
      // get file from path
      const note_file = await this.app.vault.getAbstractFileByPath(embed_file.path);
      // console.log(note_file);
      // get file contents
      const note_contents = await this.app.vault.cachedRead(note_file);
      const note_sections = this.extractSectionsCompact(note_contents);
      // console.log(note_sections);
      // if note has more than one section (if only one then its same as full-content)
      if(note_sections.length > 0) {
        // for each section in file
        console.log("Sections: " + note_sections.length);
        // batch block embeddings
        for (let j = 0; j < note_sections.length; j++) {
          // console.log(note_sections[j].path);
          // skip if section length is less than N characters
          if(note_sections[j].text.length < 200) {
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

          // build embeddings key
          const embeddings_key = embed_file.path+note_sections[j].path;
          // skip if embeddings key already exists and block mtime is greater than or equal to file mtime
          if((this.embeddings[embeddings_key]) && (this.embeddings[embeddings_key].mtime >= embed_file.stat.mtime)) {
            // log skipping file
            console.log("skipping block (mtime)");
            continue;
          }
          // get embeddings for block 
          // add block_embeddings to embeddings
          batch_promises.push(this.get_embeddings(embeddings_key, note_sections[j].text, embed_file.stat.mtime));
        }
      }

      // if file length is less than 8000 use full file contents
      // else if file length is greater than 8000 build embed_input from file headings
      const token_estimate = note_contents.length/4;
      // console.log(token_estimate);
      if(token_estimate < 8000) {
        embed_input += note_contents
      }else{ 
        const note_meta_cache = this.app.metadataCache.getFileCache(note_file);
        // console.log(note_meta_cache);
        // for each heading in file
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
        embed_input += note_headings
      }
    }


    // add file embeddings to embeddings.values JSON
    batch_promises.push(this.get_embeddings(embed_file.path, embed_input, embed_file.stat.mtime));
    // log embedding
    // console.log("embedding: " + embed_file.path);
    // wait for all promises to resolve
    await Promise.all(batch_promises);
    if(save) {
      // write embeddings JSON to file
      await this.save_embeddings_to_file();
    }
  }
  
  async get_embeddings(embeddings_key, embed_input, embed_file_mtime) {
    const values = await this.request_embedding_from_input(embed_input);
    if(values) {
      this.embeddings[embeddings_key] = {};
      this.embeddings[embeddings_key].values = values;
      this.embeddings[embeddings_key].mtime = embed_file_mtime;
    }
  }

  async request_embedding_from_input(embed_input) {
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
    try {
      const requestResults = JSON.parse(await (0, Obsidian.request)(reqParams));
      // console.log("tokens: "+requestResults.usage.total_tokens);
      // add token usage to render_log
      this.render_log.token_usage = (this.render_log.token_usage || 0) + requestResults.usage.total_tokens;
      return requestResults.data[0].embedding;
    } catch (error) {
      console.log(error);
      return null; 
    }
  }

  async render_note_connections(file=null) {
    //const view = this.app.workspace.getLeavesOfType(SMART_CONNECTIONS_VIEW_TYPE)[0].view;
    /**
     * better view management based on recommendations in plugin-review.md
     * source: https://github.com/obsidianmd/obsidian-releases/blob/master/plugin-review.md#avoid-managing-references-to-custom-views
    */
    let view = null;
    for (let leaf of this.app.workspace.getLeavesOfType(SMART_CONNECTIONS_VIEW_TYPE)) {
      if (leaf.view instanceof SmartConnectionsView) {
        view = leaf.view;
        break;
      }
    }
    if(!view) {
      console.log("no active view, open smart connections view to render connections");
      return;
    }
    // if API key is not set then update view message
    if(!this.settings.api_key) {
      view.set_message("API key is required to render connections");
      return;
    }
    // immediately set view to loading
    view.set_message("Making smart connections...");
    const nearest = await this.find_note_connections(file);
    // if nearest is a string then update view message
    if(typeof nearest === "string") {
      view.set_message(nearest);
    }else{
      // set nearest connections
      view.set_nearest(nearest, this.settings.show_full_path);
    }
    // get object keys of render_log
    const render_log_keys = Object.keys(this.render_log);
    // if render_log_keys length is greater than 0
    if(render_log_keys.length > 0) {
      // for each key in render_log_keys
      for (let i = 0; i < render_log_keys.length; i++) {
        console.log(render_log_keys[i] + ": " + this.render_log[render_log_keys[i]]);
      }
      // clear render_log
      this.render_log = {};
    }
  }
  // find connections by most similar to current note by cosine similarity
  async find_note_connections(current_note=null) {
    if(!current_note) {
      // get current note
      current_note = await this.app.workspace.getActiveFile();
      // if still no current note then return
      if(!current_note) {
        return "no note";
      }
      console.log("current note from getActiveFile: " + current_note.path);
    }
    // if in this.nearest_cache then set to nearest
    // else get nearest
    let nearest = [];
    if(this.nearest_cache[current_note.path]) {
      nearest = this.nearest_cache[current_note.path];
      console.log("nearest from cache");
    }else{
      // get all embeddings
      // console.log(this.files);
      await this.get_all_embeddings();
      // console.log(this.embeddings);
      // get keys of embeddings JSON
      const embeddings_keys = Object.keys(this.embeddings);
      // get current note
      // console.log(current_note);

      // skip files where path contains any exclusions
      for(let j = 0; j < this.file_exclusions.length; j++) {
        if(current_note.path.indexOf(this.file_exclusions[j]) > -1) {
          // console.log("skipping file with exclusion: " + this.file_exclusions[j]);
          // create render_log object of exlusions with number of times skipped as value
          const exclusion = this.log_exclusion(this.file_exclusions[j]);
          // break out of loop
          return exclusion;
        }
      }
      // get from cache if mtime is same
      let current_note_embedding_values = [];
      if((this.embeddings[current_note.path]) && (this.embeddings[current_note.path].mtime >= current_note.stat.mtime)) {
        // log skipping file
        //console.log("skipping file (mtime)");
      }else{
        await this.get_file_embeddings(current_note);
      }
      current_note_embedding_values = this.embeddings[current_note.path].values;
  
      // compute cosine similarity between current note and all other notes via embeddings
      // for (let i = 0; i < this.files.length; i++) {
      for (let i = 0; i < embeddings_keys.length; i++) {
        // if current note starts with the current note path, skip
        if(embeddings_keys[i].startsWith(current_note.path)) {
          continue;
        }
        // push cosine similarity between current note and other note to array with other note path
        nearest.push({
          link: embeddings_keys[i], 
          similarity: this.computeCosineSimilarity(current_note_embedding_values, this.embeddings[embeddings_keys[i]].values)
        });
      }
      // sort array by cosine similarity
      nearest.sort(function(a, b) {
        return b.similarity - a.similarity;
      });
      // console.log(nearest);
      // limit to N nearest connections
      nearest = nearest.slice(0, 200);
  
      // save to this.nearest_cache
      this.nearest_cache[current_note.path] = nearest;
    }

    // return array sorted by cosine similarity
    return nearest;
  }
  
  log_exclusion(exclusion) {
    const exclusion_key = "Skipping file with exclusion: " + exclusion;
    this.render_log[exclusion_key] = (this.render_log[exclusion_key] || 0) + 1;
    return exclusion_key;
  }

  // update status bar
  updateStatusBar(text) {
    let text2 = "";
    if (text.length > 0) {
      text2 = `: ${text}`;
    }
    if (this.settings.showStatusBar) {
      this.statusBarItemEl.setText(`Smart Connections`);
    }
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

  extractSectionsCompact(markdown){
    // split the markdown into lines
    const lines = markdown.split('\n');
    // initialize the sections array
    const sections = [];
    // initialize the section string
    let section = '';
    let section_path = '';
    // current headers array
    let currentHeaders = [];

    // loop through the lines
    for (let i = 0; i < lines.length; i++) {
      // get the line
      const line = lines[i];
      // if the line is a header then represents end of a text block
      if (line.startsWith('#')) {
        // push the current section to the sections array unless last line was a also a header
        if(i > 0 && !lines[i-1].startsWith('#')){
        sections.push({text: section.trim(), path: section_path});
        }
        // get the header level
        const level = line.split('#').length - 1;
        // remove any headers from the current headers array that are higher than the current header level
        currentHeaders = currentHeaders.filter(header => header.level < level);
        // add header and level to current headers array
        // trim the header to remove "#" and any trailing spaces
        currentHeaders.push({header: line.replace(/#/g, '').trim(), level: level});
        // initialize the section string with the current headers
        section = currentHeaders.map(header => header.header).join(' > ');
        section_path = "#"+currentHeaders.map(header => header.header).join('#');
      } else {
        // add the line to the section string
        section += '\n' + line;
      }
      // if last line then push the current section to the sections array
      if(i === lines.length - 1){
        sections.push({text: section.trim(), path: section_path});
      }
    }
    return sections;
  }

}

const SMART_CONNECTIONS_VIEW_TYPE = "smart-connections-view";
class SmartConnectionsView extends Obsidian.ItemView {
  constructor(leaf) {
    super(leaf);
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
    // add loading text
    container.createEl("div", { cls: "scLoadingText", text: message });
  }
  render_link_text(link, show_full_path=false) {
    // if show full path is true, return link
    if (show_full_path) {
      return link;
    }
    // get file name
    const file_name = link.split("/").pop();
    return file_name;
  }
  set_nearest(nearest, show_full_path=false) {
    // get container element
    const container = this.containerEl.children[1];
    // clear container
    container.empty();
    // create list of nearest notes
    const list = container.createEl("ol", { cls: "scList" });
    for (let i = 0; i < nearest.length; i++) {
      const item = list.createEl("li", { cls: "scListItem" });
      const link_text = this.render_link_text(nearest[i].link, show_full_path);
      item.createEl("a", {
        cls: "scLink",
        href: nearest[i].link,
        text: link_text,
        title: nearest[i].link,
      });
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
      text: "Settings for OpenAI."
    });
    new Obsidian.Setting(containerEl).setName("api_key").setDesc("api_key").addText((text) => text.setPlaceholder("Enter your api_key").setValue(this.plugin.settings.api_key).onChange(async (value) => {
      this.plugin.settings.api_key = value;
      await this.plugin.saveSettings(true);
    }));
    // list file exclusions
    new Obsidian.Setting(containerEl).setName("file_exclusions").setDesc("'Excluded file' matchers separated by a comma.").addText((text) => text.setPlaceholder("drawings,prompts/logs").setValue(this.plugin.settings.file_exclusions).onChange(async (value) => {
      this.plugin.settings.file_exclusions = value;
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
    // toggle showing full path in view
    new Obsidian.Setting(containerEl).setName("show_full_path").setDesc("Show full path in view.").addToggle((toggle) => toggle.setValue(this.plugin.settings.show_full_path).onChange(async (value) => {
      this.plugin.settings.show_full_path = value;
      await this.plugin.saveSettings(true);
    }));

  }
}

module.exports = SmartConnectionsPlugin;