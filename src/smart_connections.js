// const { Brain, Collection, CollectionItem } = require("smart-collections"); // NPM
const { Brain } = require("../smart-collections/Brain"); // local
const { Collection } = require("../smart-collections/Collection"); // local
const { CollectionItem } = require("../smart-collections/CollectionItem"); // local
const { SmartMarkdown } = require("smart-chunks"); // NPM
// const { SmartMarkdown } = require("../smart-chunks/smart-chunks"); // local
const { script: web_script } = require('smart-embed/web_connector.json');
// const {script: web_script} = require('../smart-embed/web_connector.json'); // issues compiling this file with esbuild in smart_embed.js
const {
  SmartEmbedTransformersWebAdapter,
  SmartEmbedTransformersNodeAdapter,
  SmartEmbedOpenAIAdapter, 
  SmartEmbed,
// } = require('smart-embed');
} = require('../smart-embed/smart_embed');
class SmartBrain extends Brain {
  constructor(main, ltm_adapter) {
    super(ltm_adapter);
    this.main = main;
    this.config = this.main.settings;
    this.data_path = this.config.smart_connections_folder;
    this.collections = {
      smart_notes: SmartNotes,
      smart_blocks: SmartBlocks,
    };
    this.item_types = {
      SmartNote,
      SmartBlock,
    };
    this.save_timeout = null;
    this.smart_embed_active_models = {};
    this.local_model_type = 'Web';
  }
  reload() {
    this.unload();
    this.init();
  }
  unload() {
    if(this.smart_notes) this.smart_notes.unload();
    this.smart_notes = null;
    if(this.smart_blocks) this.smart_blocks.unload();
    this.smart_blocks = null;
    this.smart_embed_active_models = {};
  }
  async init() {
    // console.log("Initializing SmartBrain");
    this.smart_markdown = new SmartMarkdown({...this.config, skip_blocks_with_headings_only: true}); // initialize smart markdown (before collections, b/c collections use smart markdown)
    await Promise.all(Object.values(this.collections).map(async static_collection => await static_collection.load(this)));
    // console.log("SmartBrain Collections Loaded");
    await this.init_import(); // refresh smart notes and init "Start embedding" notification
  }
  // initiate import of smart notes, shows notice before starting embedding
  async init_import() { if (this.smart_notes.smart_embed || this.smart_blocks.smart_embed) this.smart_notes.import({ reset: true, show_notice: true }); }

  get_tfile(file_path) { return this.main.app.vault.getAbstractFileByPath(file_path); }
  async cached_read(file) {
    const t_file = (typeof file === 'string') ? this.get_tfile(file) : file; // handle string (file_path) or Tfile input
    if(!(t_file instanceof this.main.obsidian.TFile)) return null;
    return await this.main.app.vault.cachedRead(t_file);
  }
  async force_refresh() {
    this.smart_blocks.clear();
    this.smart_notes.clear();
    this.smart_notes.import(); // trigger making new connections
  }
  // prevent saving too often (large files can cause lag)
  save() {
    if(this.save_timeout) clearTimeout(this.save_timeout); // clear save timeout
    this.save_timeout = setTimeout(async () => {
      // require minimum 1 minute since last user activity
      if(this.main.last_user_activity && ((Date.now() - this.main.last_user_activity) < 60000)) return this.save(); // reset save timeout
      await this._save();
      this.save_timeout = null;
    }, 60000); // set save timeout
  }
  async _save() { await Promise.all(Object.keys(this.collections).map(async collection_name => await this[collection_name]._save())); }
  // getters
  get all_files(){ return this.main.app.vault.getFiles().filter((file) => (file instanceof this.main.obsidian.TFile) && (file.extension === "md" || file.extension === "canvas")); } // no exclusions
  get files(){ return this.main.app.vault.getFiles().filter((file) => (file instanceof this.main.obsidian.TFile) && (file.extension === "md" || file.extension === "canvas") && this.is_included(file.path)); }
  is_included(file_path) {
    return !this.file_exclusions.some(exclusion => file_path.includes(exclusion));
  }

  get file_exclusions() { 
    if(this._file_exclusions) return this._file_exclusions;
    this._file_exclusions = (this.main.settings.file_exclusions?.length) ? this.main.settings.file_exclusions.split(",").map((file) => file.trim()) : [];
    return this._file_exclusions = this._file_exclusions.concat(this.folder_exclusions); // merge file exclusions with folder exclusions (parser only checks this.file_exclusions)
  }
  get folder_exclusions() {
    if(this._folder_exclusions) return this._folder_exclusions;
    return this._folder_exclusions = (this.main.settings.folder_exclusions?.length) ? this.main.settings.folder_exclusions.split(",").map((folder) => {
      folder = folder.trim();
      if(folder.slice(-1) !== "/") return folder + "/";
      return folder;
    }) : [];
  }
  get excluded_headings() {
    if(this._excluded_headings) return this._excluded_headings;
    return this._excluded_headings = (this.main.settings.excluded_headings?.length) ? this.main.settings.excluded_headings.split(",").map((heading) => heading.trim()) : [];
  }
}
class SmartEntities extends Collection {
  constructor(brain) {
    super(brain);
    this._pause_embeddings = false; // used to pause ensure_embeddings
  }
  async _save() { await this.LTM._save(); } // async b/c Obsidian API is async
  replacer(key, value) { // JSON.stringify replacer
    if(value instanceof this.item_type){
      if(!value.validate_save()){
        console.log("Invalid block, skipping save: ", value.data);
        return undefined; // skip if invalid
      }
      if(value.data.embedding.vec && value.data.text) value.data.text = undefined; // clear text if embedding exists
      return value.data;
    }
    return super.replacer(key, value);
  }
  unload(){
    if(typeof this.smart_embed?.unload === 'function'){
      this.smart_embed.unload();
      delete this.smart_embed;
    }
  }
  async load() {
    await this.load_smart_embed();
    await this.LTM.load(); // MUST RUN BEFORE SMART EMBED async b/c Obsidian API is async
  }
  async load_smart_embed() {
    // console.log("Loading SmartEmbed for " + this.collection_name + " Model: " + this.smart_embed_model);
    if(this.smart_embed_model === "None") return; // console.log("SmartEmbed disabled for ", this.collection_name);
    if(this.brain.smart_embed_active_models[this.smart_embed_model] instanceof SmartEmbed){
      this.smart_embed = this.brain.smart_embed_active_models[this.smart_embed_model];
      console.log("SmartEmbed already loaded for " + this.collection_name + ": Model: " + this.smart_embed_model);
    }else{
      if(this.smart_embed_model.includes("/")) { // TODO: better way to detect local model
        if(this.brain.local_model_type === 'Web'){
          while (!this.brain.main.view?.containerEl) await new Promise(resolve => setTimeout(resolve, 100)); // wait for this.main.view.containerEl to be available
          // const { SmartEmbedTransformersWebAdapter } = require("smart-embed");
          // this.brain.smart_embed_active_models[this.smart_embed_model] = await SmartEmbedTransformersWebAdapter.create(this.smart_embed_model, this.brain.main.view.containerEl, web_script); // initialize smart embed
          this.smart_embed = await SmartEmbedTransformersWebAdapter.create(this.smart_embed_model, this.brain.main.view.containerEl, web_script); // initialize smart embed
        }else{
          // const { SmartEmbedTransformersNodeAdapter } = require("smart-embed");
          // this.brain.smart_embed_active_models[this.smart_embed_model] = await SmartEmbedTransformersNodeAdapter.create(this.smart_embed_model); // initialize smart embed
          this.smart_embed = await SmartEmbedTransformersNodeAdapter.create(this.smart_embed_model); // initialize smart embed
        }
      } else { // is API model
        // const { SmartEmbedOpenAIAdapter } = require("smart-embed");
        // this.brain.smart_embed_active_models[this.smart_embed_model] = await SmartEmbedOpenAIAdapter.create(this.smart_embed_model, this.brain.main.obsidian.requestUrl, this.config.api_key); // initialize smart embed
        this.smart_embed = await SmartEmbedOpenAIAdapter.create(this.smart_embed_model, this.brain.main.obsidian.requestUrl, this.config.api_key); // initialize smart embed
      }
      // this.smart_embed = this.brain.smart_embed_active_models[this.smart_embed_model];
    }
  }
  pause_embedding() { this._pause_embeddings = true; }
  async ensure_embeddings(show_notice = null) {
    if(!this.smart_embed) return console.log("SmartEmbed not loaded for " + this.collection_name);
    if(this.smart_embed.is_embedding) return console.log("already embedding, skipping ensure_embeddings", this.smart_embed.queue_length);
    const unembedded_items = Object.values(this.items).filter(item => !item.vec); // gets all without vec
    console.log("unembedded_items: ", unembedded_items.map(item => item.name));
    if(unembedded_items.length === 0){
      // console.log("no unembedded items");
      return true; // skip if no unembedded items
    }
    const batch_size = this.smart_embed.batch_size;
    const performance_notice_msg = "(Processing a large number of notes using the local models may cause Obsidian to become temporarily unresponsive.)";
    if((show_notice !== false) && (unembedded_items.length > 30)) {
      const start_btn = {text: "Start embedding", callback: () => this.ensure_embeddings(false) };
      this.brain.main.show_notice([`Are you ready to begin embedding ${unembedded_items.length} ${this.collection_name}?`, performance_notice_msg], { timeout: 0, button: start_btn});
      return;
    }
    for(let i = 0; i < unembedded_items.length; i += batch_size) {
      if(this._pause_embeddings) {
        this._pause_embeddings = false;
        const restart_btn = {text: "Restart", callback: () => this.ensure_embeddings() };
        this.brain.main.show_notice([`Embedding ${this.collection_name}...`, `Paused at ${i} / ${unembedded_items.length} ${this.collection_name}`, performance_notice_msg], { timeout: 0, button: restart_btn});
        // this.brain.save(); // save
        this.LTM._save(); // save
        return;
      }
      if(i % 10 === 0){
        const pause_btn = {text: "Pause", callback: () => this.pause_embedding(), stay_open: true};
        this.brain.main.show_notice([`Embedding ${this.collection_name}...`, `Progress: ${i} / ${unembedded_items.length} ${this.collection_name}`, performance_notice_msg], { timeout: 0, button: pause_btn});
      }
      const items = unembedded_items.slice(i, i + batch_size);
      await this.smart_embed.embed_batch(items);
      if(i && (i % 500 === 0)) await this.LTM._save();
    }
    if(this.brain.main._notice?.noticeEl?.parentElement) this.brain.main._notice.hide();
    this.brain.main.show_notice([`Embedding ${this.collection_name}...`, `Done creating ${unembedded_items.length} embeddings.`], { timeout: 10000 });
    if(unembedded_items.length) this.LTM._save();
    return true;
  }
  nearest(vec, filter={}) {
    if(!vec) return console.log("no vec");
    const {
      results_count = 20,
    } = filter;
    // const timestamp = Date.now();
    const nearest = this.filter(filter)
      .reduce((acc, item) => {
        if(!item.data.embedding?.vec) return acc; // skip if no vec
        // if(filter.skip_sections && block.is_block) return acc; // skip if block (section) (DEPRECATED: re-enable if needed)
        item.sim = cos_sim(vec, item.data.embedding.vec);
        top_acc(acc, item, results_count); // update acc
        return acc;
      }, { min: 0, items: new Set() })
    ;
    // console.log("nearest took: ", Date.now() - timestamp);
    return Array.from(nearest.items);
  }
  prune(override = false) {} // override in child class
  get file_name() { return this.collection_name + '-' + this.smart_embed_model.split("/").pop(); }
  get smart_embed_model() { return this.config[this.collection_name + "_embed_model"]; }
}
class SmartEntity extends CollectionItem {
  static get defaults() {
    return {
      data: {
        path: null,
        embedding: {},
      },
    };
  }
  filter(filter={}) {
    const {
      include_path_begins_with = null,
    } = filter;
    // skip if include_path_begins_with is set (folder filter) and entity.path does not begin with filter.include_path_begins_with
    if(include_path_begins_with){
      const paths = Array.isArray(include_path_begins_with) ? include_path_begins_with : [include_path_begins_with];
      if(!paths.some(path => this.path.startsWith(path))) return false;
    }
    return super.filter(filter);
  }
  get_key() { return this.data.path; }
  // DO: clarified/improved logic
  save() {
    this.collection.set(this);
    this.brain.save();
  }
  get embed_link() { return `![[${this.data.path}]]`; }
  get name() { return (!this.brain.main.settings.show_full_path ? this.path.split("/").pop() : this.path.split("/").join(" > ")).split("#").join(" > ").replace(".md", ""); }
  get path() { return this.data.path; }
  get tokens() { return this.data.embedding.tokens; }
  get vec() { return this.data.embedding.vec; }
  // setters
  set error(error) { this.data.embedding.error = error; }
  set tokens(tokens) { this.data.embedding.tokens = tokens; }
  set vec(vec) { this.data.embedding.vec = vec; }
}
class SmartNotes extends SmartEntities {
  async import(opts= {}) {
    const {
      file_path = null,
      reset = false,
      show_notice = false,
    } = opts;
    // if(reset) this.clear();
    if(file_path){
      await this.create_or_update({ path: file_path });
      if(this.smart_embed) await this.ensure_embeddings(show_notice);
      return;
    }
    if(reset) this.prune(true);
    try{
      const files = [];
      this.brain.files.forEach(file => { if(!this.get(file.path)) files.push(file); }); // get files that aren't already imported
      // console.log("files to import: ", files.length);
      let batch = [];
      for(let i = 0; i < files.length; i++) {
        if(i % 10 === 0){
          this.brain.main.show_notice([`Making Smart Connections...`, `Progress: ${i} / ${files.length} files`], { timeout: 0 });
          await Promise.all(batch);
          batch = [];
        }
        batch.push(this.create_or_update({ path: files[i].path }));
      }
      await Promise.all(batch);
      if(this.brain.main._notice_content?.textContent) this.brain.main._notice_content.textContent = "Making Smart Connections... Done importing Smart Notes.";
      if(files.length){
        await this._save();
        if(this.smart_embed) await this.ensure_embeddings(show_notice); // note-level embeddings
      }
      await this.brain.smart_blocks.import(opts);
      // if(this.brain.smart_blocks?.smart_embed) await this.brain.smart_blocks.ensure_embeddings(show_notice); // block-level embeddings
    } catch(e) {
      console.log("error importing notes");
      console.log(e);
    }
  }
  async ensure_embeddings(show_notice = false) {
    // if no _embed_input, get from file for each note (awaiting each)
    // const notes = Object.values(this.items).filter(note => !note.vec && note._embed_input);
    // await Promise.all(notes.map(async note => await note.get_content()));
    const resp = await super.ensure_embeddings(show_notice);
    if(resp) this.brain.smart_blocks.ensure_embeddings(show_notice); // trigger block-level embeddings
  }
  prune(override = false) {
    const remove = [];
    const items_w_vec = Object.entries(this.items).filter(([key, note]) => note.vec);
    const total_items_w_vec = items_w_vec.length;
    const available_notes = this.brain.files.reduce((acc, file) => {
      acc[file.path] = true;
      return acc;
    }, {});
    if(!total_items_w_vec){
      this.clear(); // clear if no items with vec (rebuilds in import)
      return; // skip rest if no items with vec
    }
    items_w_vec.forEach(([key, note]) => {
      if(!available_notes[note.data.path]) return remove.push(key); // remove if not available
      if(note.is_gone) return remove.push(key); // remove if expired
      if(note.is_changed) return remove.push(key); // remove if changed
      // if(!note.vec) return remove.push(key); // redundant remove if no vec
    });
    const remove_ratio = remove.length / total_items_w_vec;
    // if(!remove.length) return console.log("no notes to prune");
    if((override && (remove_ratio < 0.5)) || confirm(`Are you sure you want to delete ${remove.length} (${Math.floor(remove_ratio*100)}%) Note-level Embeddings?`)){
      this.delete_many(remove);
      this.LTM._save(true); // save if not override
      // console.log(`Pruned ${remove.length} Smart Notes`);
    }
  }
  get current_note() { return this.get(this.brain.main.app.workspace.getActiveFile().path); }
}
class SmartNote extends SmartEntity {
  static get defaults() {
    return {
      data: {
        history: [], // array of { mtime, hash, length, blocks[] }
      },
      _embed_input: null, // stored temporarily
    };
  }
  update_data(data) {
    if(!this.is_new && this.last_history){
      const last = this.last_history;
      if((last.mtime === this.t_file.stat.mtime) || (last.size === this.t_file.stat.size)) return false;
    }
    super.update_data(data);
    this.data.history.push({ blocks: [], mtime: this.t_file.stat.mtime, size: this.t_file.stat.size }); // add history entry
    return true;
  }
  async get_content() { return (await this.brain.cached_read(this.data.path)); } // get content from file
  async init() {
    const content = await this.get_content(); // get content from file
    this._embed_input = content; // store temporarily for embedding
    const { blocks } = this.brain.smart_markdown.parse({ content, file_path: this.data.path }); // create blocks from note content
    blocks.forEach((block, i) => {
      if(this.brain.excluded_headings.some(exclusion => block.path.includes(exclusion))) return; // skip excluded headings
      const smart_block = this.brain.smart_blocks.create_or_update(block); // create or update block
      this.last_history.blocks[i] = smart_block.key; // add block key to history entry
    });
    this.save();
  }
  find_connections() {
    let results = [];
    if(!this.vec && !this.median_block_vec){
      console.log(this);
      const start_embedding_btn = {
        text: "Start embedding",
        callback: async () => {
          await this.collection.import({ file_path: this.path });
          this.brain.main.view.render_nearest(this);
        }
      };
      this.brain.main.show_notice(`No embeddings found for ${this.name}.`, { button: start_embedding_btn });
      return results;
    }
    if(this.vec && this.median_block_vec && this.brain.smart_blocks.smart_embed && this.collection.smart_embed){
      const nearest_blocks = this.brain.smart_blocks.nearest(this.median_block_vec, { exclude_key_starts_with: this.key });
      const nearest_notes = this.brain.smart_notes.nearest(this.vec, { exclude_key_starts_with: this.key });
      results = nearest_blocks
        .map(block => {
          const note = nearest_notes.find(note => note.key === block.note_key);
          if(!note) block.score = block.sim;
          else block.score = (block.sim + note.sim) / 2;
          return block;
        })
        // sort by item.score descending
        .sort((a, b) => {
          if(a.score === b.score) return 0;
          return (a.score > b.score) ? -1 : 1;
        })
      ;
    }else if(this.median_block_vec && this.brain.smart_blocks.smart_embed){
      const nearest_blocks = this.brain.smart_blocks.nearest(this.median_block_vec, { exclude_key_starts_with: this.key });
      // re-rank: sort by block note median block vec sim
      results = nearest_blocks
        .map(block => {
          if(!block.note?.median_block_vec.length){
            block.score = block.sim;
            return block;
          }
          block.score = (block.sim + cos_sim(this.median_block_vec, block.note.median_block_vec)) / 2;
          return block;
        })
        // sort by item.score descending
        .sort((a, b) => {
          if(a.score === b.score) return 0;
          return (a.score > b.score) ? -1 : 1;
        })
      ;
    }else if(this.vec && this.collection.smart_embed){
      const nearest_notes = this.brain.smart_notes.nearest(this.vec, { exclude_key_starts_with: this.key });
      results = nearest_notes
        .map(note => {
          note.score = note.sim;
          return note;
        })
        // sort by item.score descending
        .sort((a, b) => {
          if(a.score === b.score) return 0;
          return (a.score > b.score) ? -1 : 1;
        })
      ;
    }
    return results;
  }
  open() { this.brain.main.open_note(this.data.path); }
  get_block_by_line(line) { return this.blocks.find(block => block.data.lines[0] <= line && block.data.lines[1] >= line); }
  get block_vecs() { return this.blocks.map(block => block.data.embedding.vec).filter(vec => vec); } // filter out blocks without vec
  get blocks() { return this.last_history.blocks.map(block_key => this.brain.smart_blocks.get(block_key)).filter(block => block); } // filter out blocks that don't exist
  get embed_input() { return this._embed_input; } // stored temporarily
  get is_canvas() { return this.data.path.endsWith("canvas"); }
  get is_changed() { return (this.last_history.mtime !== this.t_file.stat.mtime) && (this.last_history.size !== this.t_file.stat.size); }
  get is_excalidraw() { return this.data.path.endsWith("excalidraw.md"); }
  get is_gone() { return this.t_file === null; }
  get last_history() { return this.data.history.length ? this.data.history[this.data.history.length - 1] : null; }
  get mean_block_vec() { return this._mean_block_vec ? this._mean_block_vec : this._mean_block_vec = this.block_vecs.reduce((acc, vec) => acc.map((val, i) => val + vec[i]), Array(384).fill(0)).map(val => val / this.block_vecs.length); }
  get median_block_vec() { return this._median_block_vec ? this._median_block_vec : this._median_block_vec = this.block_vecs[0]?.map((val, i) => this.block_vecs.map(vec => vec[i]).sort()[Math.floor(this.block_vecs.length / 2)]); }
  get t_file() { return this.brain.get_tfile(this.data.path); }
}
class SmartBlocks extends SmartEntities {
  async import(opts= {}) {
    const {
      file_path = null,
      reset = false,
      show_notice = false,
    } = opts;
    this.prune(true);
    await this.ensure_embeddings(show_notice);
  }
  // async ensure_embeddings(show_notice) {
  //   this.prune(true);
  //   await super.ensure_embeddings(show_notice);
  // }
  prune(override = false) {
    const remove = [];
    const total_items_w_vec = Object.entries(this.items).filter(([key, block]) => block.vec).length;
    console.log("total_items_w_vec: ", total_items_w_vec);
    if(!total_items_w_vec){
      // DOES NOT clear like in notes
      return; // skip rest if no items with vec
    }
    Object.entries(this.items).forEach(([key, block]) => {
      // if(block.note?.last_history.blocks.includes(key)) return; // keep if block has note
      // remove.push(key);
      if(block.is_gone) return remove.push(key); // remove if expired
    });
    const remove_ratio = remove.length / total_items_w_vec;
    console.log("remove_ratio: ", remove_ratio);
    // if(!remove.length) return console.log("no blocks to prune");
    if((override && (remove_ratio < 0.5)) || confirm(`Are you sure you want to delete ${remove.length} (${Math.floor(remove_ratio*100)}%) Block-level embeddings?`)){
      this.delete_many(remove);
      if(!override) this.LTM._save(true); // save if not override
      console.log(`Pruned ${remove.length} Smart Blocks`);
    }
  }
}
function top_acc(_acc, item, ct = 10) {
  if (_acc.items.size < ct) {
    _acc.items.add(item);
  } else if (item.sim > _acc.min) {
    _acc.items.add(item);
    _acc.items.delete(_acc.minItem);
    _acc.minItem = Array.from(_acc.items).reduce((min, curr) => (curr.sim < min.sim ? curr : min));
    _acc.min = _acc.minItem.sim;
  }
}
class SmartBlock extends SmartEntity {
  static get defaults() {
    return {
      data: {
        text: null,
        // hash: null,
        length: 0,
      },
    };
  }
  update_data(data) {
    // const hash = create_hash(data.text);
    // if(!this.is_new && (this.data.hash !== hash)) this.data.embedding = {}; // clear embedding
    // data.hash = hash; // update hash
    const length = data.text.length;
    if(!this.is_new){
      if(this.data.hash){ // backwards compatibility to prevent unnecessary re-embedding
        delete this.data.hash; // clear hash
        this.data.text.length = length; // update length
      }else if(this.data.text.length !== length) this.data.embedding = {}; // clear embedding
    }
    return super.update_data(data);
  }
  validate_save() {
    if(!this.data.embedding.vec && !this.data.text) return false; // should have either vec or text, not both
    return super.validate_save();
  }
  async get_content() {
    const note_content = await this.note?.get_content();
    if(!note_content) return null;
    return this.brain.smart_markdown.get_block_from_path(this.data.path, note_content);
  }
  async get_as_context_for_chat() { return this.breadcrumbs + "\n" + (await this.get_content()); }
  find_connections() {
    if(!this.vec) return [];
    return this.brain.smart_blocks.nearest(this.vec, { exclude_key_starts_with: this.note.key });
  }
  get breadcrumbs() { return this.data.path.split("/").join(" > ").split("#").join(" > ").replace(".md", ""); }
  get content() { return this.data.text.split('\n').slice(1).join('\n'); }
  get embed_input() { return this.data.text; }
  get folder() { return this.data.path.split("/").slice(0, -1).join("/"); }
  get is_block() { this.data.path.includes("#"); }
  get is_gone() { return !this.note || this.note.is_gone || !this.note.last_history.blocks.includes(this.key); }
  // use text length to detect changes
  get name() { return (!this.brain.main.settings.show_full_path ? this.data.path.split("/").pop() : this.data.path.split("/").join(" > ")).split("#").join(" > ").replace(".md", ""); }
  get note() { return this.brain.smart_notes.get(this.note_key); }
  get note_key() { return this.data.path.split("#")[0]; }
  // backwards compatibility (DEPRECATED)
  get link() { return this.data.path; }
}

// const crypto = require('crypto');
// function create_hash(string) { return crypto.createHash('md5').update(String(string)).digest('hex'); }
// // no crypto available in mobile
// async function create_hash(text) {
//   const msgUint8 = new TextEncoder().encode(text); // encode as (utf-8) Uint8Array
//   const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8); // hash the message
//   const hashArray = Array.from(new Uint8Array(hashBuffer)); // convert buffer to byte array
//   const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join(''); // convert bytes to hex string
//   return hashHex;
// }
// COSINE SIMILARITY
function cos_sim(vector1, vector2) {
  const dotProduct = vector1.reduce((acc, val, i) => acc + val * vector2[i], 0);
  const normA = Math.sqrt(vector1.reduce((acc, val) => acc + val * val, 0));
  const normB = Math.sqrt(vector2.reduce((acc, val) => acc + val * val, 0));
  return normA === 0 || normB === 0 ? 0 : dotProduct / (normA * normB);
}

exports.SmartBrain = SmartBrain;
exports.SmartEntity = SmartEntity;
exports.SmartNotes = SmartNotes;
exports.SmartNote = SmartNote;
exports.SmartBlocks = SmartBlocks;
exports.SmartBlock = SmartBlock;