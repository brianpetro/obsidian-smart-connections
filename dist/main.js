var __getOwnPropNames = Object.getOwnPropertyNames;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};

// ../vec_lite/vec_lite.js
var require_vec_lite = __commonJS({
  "../vec_lite/vec_lite.js"(exports2, module2) {
    var VecLite2 = class {
      constructor(config) {
        this.config = {
          file_name: "embeddings-3.json",
          folder_path: ".vec_lite",
          exists_adapter: null,
          mkdir_adapter: null,
          read_adapter: null,
          rename_adapter: null,
          stat_adapter: null,
          write_adapter: null,
          ...config
        };
        this.file_name = this.config.file_name;
        this.folder_path = config.folder_path;
        this.file_path = this.folder_path + "/" + this.file_name;
        this.embeddings = false;
      }
      async file_exists(path) {
        if (this.config.exists_adapter) {
          return await this.config.exists_adapter(path);
        } else {
          throw new Error("exists_adapter not set");
        }
      }
      async mkdir(path) {
        if (this.config.mkdir_adapter) {
          return await this.config.mkdir_adapter(path);
        } else {
          throw new Error("mkdir_adapter not set");
        }
      }
      async read_file(path) {
        if (this.config.read_adapter) {
          return await this.config.read_adapter(path);
        } else {
          throw new Error("read_adapter not set");
        }
      }
      async rename(old_path, new_path) {
        if (this.config.rename_adapter) {
          return await this.config.rename_adapter(old_path, new_path);
        } else {
          throw new Error("rename_adapter not set");
        }
      }
      async stat(path) {
        if (this.config.stat_adapter) {
          return await this.config.stat_adapter(path);
        } else {
          throw new Error("stat_adapter not set");
        }
      }
      async write_file(path, data) {
        if (this.config.write_adapter) {
          return await this.config.write_adapter(path, data);
        } else {
          throw new Error("write_adapter not set");
        }
      }
      async load(retries = 0) {
        try {
          const embeddings_file = await this.read_file(this.file_path);
          this.embeddings = JSON.parse(embeddings_file);
          console.log("loaded embeddings file: " + this.file_path);
          return true;
        } catch (error) {
          if (retries < 3) {
            console.log("retrying load()");
            await new Promise((r) => setTimeout(r, 1e3 + 1e3 * retries));
            return await this.load(retries + 1);
          } else if (retries === 3) {
            const embeddings_2_file_path = this.folder_path + "/embeddings-2.json";
            const embeddings_2_file_exists = await this.file_exists(embeddings_2_file_path);
            if (embeddings_2_file_exists) {
              await this.migrate_embeddings_v2_to_v3();
              return await this.load(retries + 1);
            }
          }
          console.log("failed to load embeddings file, prompt user to initiate bulk embed");
          return false;
        }
      }
      async init_embeddings_file() {
        if (!await this.file_exists(this.folder_path)) {
          await this.mkdir(this.folder_path);
          console.log("created folder: " + this.folder_path);
        } else {
          console.log("folder already exists: " + this.folder_path);
        }
        if (!await this.file_exists(this.file_path)) {
          await this.write_file(this.file_path, "{}");
          console.log("created embeddings file: " + this.file_path);
        } else {
          console.log("embeddings file already exists: " + this.file_path);
        }
      }
      async save() {
        const embeddings = JSON.stringify(this.embeddings);
        const embeddings_file_exists = await this.file_exists(this.file_path);
        if (embeddings_file_exists) {
          const new_file_size = embeddings.length;
          const existing_file_size = await this.stat(this.file_path).then((stat) => stat.size);
          if (new_file_size > existing_file_size * 0.5) {
            await this.write_file(this.file_path, embeddings);
            console.log("embeddings file size: " + new_file_size + " bytes");
          } else {
            const warning_message = [
              "Warning: New embeddings file size is significantly smaller than existing embeddings file size.",
              "Aborting to prevent possible loss of embeddings data.",
              "New file size: " + new_file_size + " bytes.",
              "Existing file size: " + existing_file_size + " bytes.",
              "Restarting Obsidian may fix this."
            ];
            console.log(warning_message.join(" "));
            await this.write_file(this.folder_path + "/unsaved-embeddings.json", embeddings);
            throw new Error("Error: New embeddings file size is significantly smaller than existing embeddings file size. Aborting to prevent possible loss of embeddings data.");
          }
        } else {
          await this.init_embeddings_file();
          return await this.save();
        }
        return true;
      }
      cos_sim(vector1, vector2) {
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
      nearest(to_vec, filter = {}) {
        filter = {
          results_count: 30,
          ...filter
        };
        let nearest = [];
        const from_keys = Object.keys(this.embeddings);
        for (let i = 0; i < from_keys.length; i++) {
          if (filter.skip_sections) {
            const from_path = this.embeddings[from_keys[i]].meta.path;
            if (from_path.indexOf("#") > -1)
              continue;
          }
          if (filter.skip_key) {
            if (filter.skip_key === from_keys[i])
              continue;
            if (filter.skip_key === this.embeddings[from_keys[i]].meta.parent)
              continue;
          }
          if (filter.path_begins_with) {
            if (typeof filter.path_begins_with === "string" && !this.embeddings[from_keys[i]].meta.path.startsWith(filter.path_begins_with))
              continue;
            if (Array.isArray(filter.path_begins_with) && !filter.path_begins_with.some((path) => this.embeddings[from_keys[i]].meta.path.startsWith(path)))
              continue;
          }
          nearest.push({
            link: this.embeddings[from_keys[i]].meta.path,
            similarity: this.cos_sim(to_vec, this.embeddings[from_keys[i]].vec),
            size: this.embeddings[from_keys[i]].meta.size
          });
        }
        nearest.sort(function(a, b) {
          return b.similarity - a.similarity;
        });
        nearest = nearest.slice(0, filter.results_count);
        return nearest;
      }
      find_nearest_embeddings(to_vec, filter = {}) {
        const default_filter = {
          max: this.max_sources
        };
        filter = { ...default_filter, ...filter };
        if (Array.isArray(to_vec) && to_vec.length !== this.vec_len) {
          this.nearest = {};
          for (let i = 0; i < to_vec.length; i++) {
            this.find_nearest_embeddings(to_vec[i], {
              max: Math.floor(filter.max / to_vec.length)
            });
          }
        } else {
          const from_keys = Object.keys(this.embeddings);
          for (let i = 0; i < from_keys.length; i++) {
            if (this.validate_type(this.embeddings[from_keys[i]]))
              continue;
            const sim = this.computeCosineSimilarity(to_vec, this.embeddings[from_keys[i]].vec);
            if (this.nearest[from_keys[i]]) {
              this.nearest[from_keys[i]] += sim;
            } else {
              this.nearest[from_keys[i]] = sim;
            }
          }
        }
        let nearest = Object.keys(this.nearest).map((key) => {
          return {
            key,
            similarity: this.nearest[key]
          };
        });
        nearest = this.sort_by_similarity(nearest);
        nearest = nearest.slice(0, filter.max);
        nearest = nearest.map((item) => {
          return {
            link: this.embeddings[item.key].meta.path,
            similarity: item.similarity,
            len: this.embeddings[item.key].meta.len || this.embeddings[item.key].meta.size
          };
        });
        return nearest;
      }
      sort_by_similarity(nearest) {
        return nearest.sort(function(a, b) {
          const a_score = a.similarity;
          const b_score = b.similarity;
          if (a_score > b_score)
            return -1;
          if (a_score < b_score)
            return 1;
          return 0;
        });
      }
      // check if key from embeddings exists in files
      clean_up_embeddings(files) {
        console.log("cleaning up embeddings");
        const keys = Object.keys(this.embeddings);
        let deleted_embeddings = 0;
        for (const key of keys) {
          const path = this.embeddings[key].meta.path;
          if (!files.find((file) => path.startsWith(file.path))) {
            delete this.embeddings[key];
            deleted_embeddings++;
            continue;
          }
          if (path.indexOf("#") > -1) {
            const parent_key = this.embeddings[key].meta.parent;
            if (!this.embeddings[parent_key]) {
              delete this.embeddings[key];
              deleted_embeddings++;
              continue;
            }
            if (!this.embeddings[parent_key].meta) {
              delete this.embeddings[key];
              deleted_embeddings++;
              continue;
            }
            if (this.embeddings[parent_key].meta.children && this.embeddings[parent_key].meta.children.indexOf(key) < 0) {
              delete this.embeddings[key];
              deleted_embeddings++;
              continue;
            }
          }
        }
        return { deleted_embeddings, total_embeddings: keys.length };
      }
      get(key) {
        return this.embeddings[key] || null;
      }
      get_meta(key) {
        const embedding = this.get(key);
        if (embedding && embedding.meta) {
          return embedding.meta;
        }
        return null;
      }
      get_mtime(key) {
        const meta = this.get_meta(key);
        if (meta && meta.mtime) {
          return meta.mtime;
        }
        return null;
      }
      get_hash(key) {
        const meta = this.get_meta(key);
        if (meta && meta.hash) {
          return meta.hash;
        }
        return null;
      }
      get_size(key) {
        const meta = this.get_meta(key);
        if (meta && meta.size) {
          return meta.size;
        }
        return null;
      }
      get_children(key) {
        const meta = this.get_meta(key);
        if (meta && meta.children) {
          return meta.children;
        }
        return null;
      }
      get_vec(key) {
        const embedding = this.get(key);
        if (embedding && embedding.vec) {
          return embedding.vec;
        }
        return null;
      }
      save_embedding(key, vec, meta) {
        this.embeddings[key] = {
          vec,
          meta
        };
      }
      mtime_is_current(key, source_mtime) {
        const mtime = this.get_mtime(key);
        if (mtime && mtime >= source_mtime) {
          return true;
        }
        return false;
      }
      async force_refresh() {
        this.embeddings = null;
        this.embeddings = {};
        let current_datetime = Math.floor(Date.now() / 1e3);
        await this.rename(this.file_path, this.folder_path + "/embeddings-" + current_datetime + ".json");
        await this.init_embeddings_file();
      }
    };
    module2.exports = VecLite2;
  }
});

// src/index.js
var Obsidian = require("obsidian");
var VecLite = require_vec_lite();
var DEFAULT_SETTINGS = {
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
  version: ""
};
var MAX_EMBED_STRING_LENGTH = 25e3;
var VERSION;
var SUPPORTED_FILE_TYPES = ["md", "canvas"];
var SMART_TRANSLATION = {
  "en": {
    "pronous": ["my", "I", "me", "mine", "our", "ours", "us", "we"],
    "prompt": "Based on your notes",
    "initial_message": "Hi, I'm ChatGPT with access to your notes via Smart Connections. Ask me a question about your notes and I'll try to answer it."
  },
  "es": {
    "pronous": ["mi", "yo", "m\xED", "t\xFA"],
    "prompt": "Bas\xE1ndose en sus notas",
    "initial_message": "Hola, soy ChatGPT con acceso a tus apuntes a trav\xE9s de Smart Connections. Hazme una pregunta sobre tus apuntes e intentar\xE9 responderte."
  },
  "fr": {
    "pronous": ["me", "mon", "ma", "mes", "moi", "nous", "notre", "nos", "je", "j'", "m'"],
    "prompt": "D'apr\xE8s vos notes",
    "initial_message": "Bonjour, je suis ChatGPT et j'ai acc\xE8s \xE0 vos notes via Smart Connections. Posez-moi une question sur vos notes et j'essaierai d'y r\xE9pondre."
  },
  "de": {
    "pronous": ["mein", "meine", "meinen", "meiner", "meines", "mir", "uns", "unser", "unseren", "unserer", "unseres"],
    "prompt": "Basierend auf Ihren Notizen",
    "initial_message": "Hallo, ich bin ChatGPT und habe \xFCber Smart Connections Zugang zu Ihren Notizen. Stellen Sie mir eine Frage zu Ihren Notizen und ich werde versuchen, sie zu beantworten."
  },
  "it": {
    "pronous": ["mio", "mia", "miei", "mie", "noi", "nostro", "nostri", "nostra", "nostre"],
    "prompt": "Sulla base degli appunti",
    "initial_message": "Ciao, sono ChatGPT e ho accesso ai tuoi appunti tramite Smart Connections. Fatemi una domanda sui vostri appunti e cercher\xF2 di rispondervi."
  }
};
var crypto = require("crypto");
function md5(str) {
  return crypto.createHash("md5").update(str).digest("hex");
}
var SmartConnectionsPlugin = class extends Obsidian.Plugin {
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
    await this.loadSettings();
    setTimeout(this.check_for_update.bind(this), 3e3);
    setInterval(this.check_for_update.bind(this), 108e5);
    this.addIcon();
    this.addCommand({
      id: "sc-find-notes",
      name: "Find: Make Smart Connections",
      icon: "pencil_icon",
      hotkeys: [],
      // editorCallback: async (editor) => {
      editorCallback: async (editor) => {
        if (editor.somethingSelected()) {
          let selected_text = editor.getSelection();
          await this.make_connections(selected_text);
        } else {
          this.nearest_cache = {};
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
    this.addCommand({
      id: "smart-connections-chat",
      name: "Open: Smart Chat Conversation",
      callback: () => {
        this.open_chat();
      }
    });
    this.addCommand({
      id: "smart-connections-random",
      name: "Open: Random Note from Smart Connections",
      callback: () => {
        this.open_random_note();
      }
    });
    this.addSettingTab(new SmartConnectionsSettingsTab(this.app, this));
    this.registerView(SMART_CONNECTIONS_VIEW_TYPE, (leaf) => new SmartConnectionsView(leaf, this));
    this.registerView(SMART_CONNECTIONS_CHAT_VIEW_TYPE, (leaf) => new SmartConnectionsChatView(leaf, this));
    this.registerMarkdownCodeBlockProcessor("smart-connections", this.render_code_block.bind(this));
    if (this.settings.view_open) {
      this.open_view();
    }
    if (this.settings.chat_open) {
      this.open_chat();
    }
    if (this.settings.version !== VERSION) {
      this.settings.version = VERSION;
      await this.saveSettings();
      this.open_view();
    }
    this.add_to_gitignore();
    this.api = new ScSearchApi(this.app, this);
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
      write_adapter: this.app.vault.adapter.write.bind(this.app.vault.adapter)
    });
    this.embeddings_loaded = await this.smart_vec_lite.load();
    return this.embeddings_loaded;
  }
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    if (this.settings.file_exclusions && this.settings.file_exclusions.length > 0) {
      this.file_exclusions = this.settings.file_exclusions.split(",").map((file) => {
        return file.trim();
      });
    }
    if (this.settings.folder_exclusions && this.settings.folder_exclusions.length > 0) {
      const folder_exclusions = this.settings.folder_exclusions.split(",").map((folder) => {
        folder = folder.trim();
        if (folder.slice(-1) !== "/") {
          return folder + "/";
        } else {
          return folder;
        }
      });
      this.file_exclusions = this.file_exclusions.concat(folder_exclusions);
    }
    if (this.settings.header_exclusions && this.settings.header_exclusions.length > 0) {
      this.header_exclusions = this.settings.header_exclusions.split(",").map((header) => {
        return header.trim();
      });
    }
    if (this.settings.path_only && this.settings.path_only.length > 0) {
      this.path_only = this.settings.path_only.split(",").map((path) => {
        return path.trim();
      });
    }
    this.self_ref_kw_regex = new RegExp(`\\b(${SMART_TRANSLATION[this.settings.language].pronous.join("|")})\\b`, "gi");
    await this.load_failed_files();
  }
  async saveSettings(rerender = false) {
    await this.saveData(this.settings);
    await this.loadSettings();
    if (rerender) {
      this.nearest_cache = {};
      await this.make_connections();
    }
  }
  // check for update
  async check_for_update() {
    try {
      const response = await (0, Obsidian.requestUrl)({
        url: "https://api.github.com/repos/brianpetro/obsidian-smart-connections/releases/latest",
        method: "GET",
        headers: {
          "Content-Type": "application/json"
        },
        contentType: "application/json"
      });
      const latest_release = JSON.parse(response.text).tag_name;
      if (latest_release !== VERSION) {
        new Obsidian.Notice(`[Smart Connections] A new version is available! (v${latest_release})`);
        this.update_available = true;
        this.render_brand("all");
      }
    } catch (error) {
      console.log(error);
    }
  }
  async render_code_block(contents, container, ctx) {
    let nearest;
    if (contents.trim().length > 0) {
      nearest = await this.api.search(contents);
    } else {
      console.log(ctx);
      const file = this.app.vault.getAbstractFileByPath(ctx.sourcePath);
      nearest = await this.find_note_connections(file);
    }
    if (nearest.length) {
      this.update_results(container, nearest);
    }
  }
  async make_connections(selected_text = null) {
    let view = this.get_view();
    if (!view) {
      await this.open_view();
      view = this.get_view();
    }
    await view.render_connections(selected_text);
  }
  addIcon() {
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
    if (typeof this.nearest_cache[curr_key] === "undefined") {
      new Obsidian.Notice("[Smart Connections] No Smart Connections found. Open a note to get Smart Connections.");
      return;
    }
    const rand = Math.floor(Math.random() * this.nearest_cache[curr_key].length / 2);
    const random_file = this.nearest_cache[curr_key][rand];
    this.open_note(random_file);
  }
  async open_view() {
    if (this.get_view()) {
      console.log("Smart Connections view already open");
      return;
    }
    this.app.workspace.detachLeavesOfType(SMART_CONNECTIONS_VIEW_TYPE);
    await this.app.workspace.getRightLeaf(false).setViewState({
      type: SMART_CONNECTIONS_VIEW_TYPE,
      active: true
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
  async open_chat(retries = 0) {
    if (!this.embeddings_loaded) {
      console.log("embeddings not loaded yet");
      if (retries < 3) {
        setTimeout(() => {
          this.open_chat(retries + 1);
        }, 1e3 * (retries + 1));
        return;
      }
      console.log("embeddings still not loaded, opening smart view");
      this.open_view();
      return;
    }
    this.app.workspace.detachLeavesOfType(SMART_CONNECTIONS_CHAT_VIEW_TYPE);
    await this.app.workspace.getRightLeaf(false).setViewState({
      type: SMART_CONNECTIONS_CHAT_VIEW_TYPE,
      active: true
    });
    this.app.workspace.revealLeaf(
      this.app.workspace.getLeavesOfType(SMART_CONNECTIONS_CHAT_VIEW_TYPE)[0]
    );
  }
  // get embeddings for all files
  async get_all_embeddings() {
    const files = (await this.app.vault.getFiles()).filter((file) => file instanceof Obsidian.TFile && (file.extension === "md" || file.extension === "canvas"));
    const open_files = this.app.workspace.getLeavesOfType("markdown").map((leaf) => leaf.view.file);
    const clean_up_log = this.smart_vec_lite.clean_up_embeddings(files);
    if (this.settings.log_render) {
      this.render_log.total_files = files.length;
      this.render_log.deleted_embeddings = clean_up_log.deleted_embeddings;
      this.render_log.total_embeddings = clean_up_log.total_embeddings;
    }
    let batch_promises = [];
    for (let i = 0; i < files.length; i++) {
      if (files[i].path.indexOf("#") > -1) {
        this.log_exclusion("path contains #");
        continue;
      }
      if (this.smart_vec_lite.mtime_is_current(md5(files[i].path), files[i].stat.mtime)) {
        continue;
      }
      if (this.settings.failed_files.indexOf(files[i].path) > -1) {
        if (this.retry_notice_timeout) {
          clearTimeout(this.retry_notice_timeout);
          this.retry_notice_timeout = null;
        }
        if (!this.recently_sent_retry_notice) {
          new Obsidian.Notice("Smart Connections: Skipping previously failed file, use button in settings to retry");
          this.recently_sent_retry_notice = true;
          setTimeout(() => {
            this.recently_sent_retry_notice = false;
          }, 6e5);
        }
        continue;
      }
      let skip = false;
      for (let j = 0; j < this.file_exclusions.length; j++) {
        if (files[i].path.indexOf(this.file_exclusions[j]) > -1) {
          skip = true;
          this.log_exclusion(this.file_exclusions[j]);
          break;
        }
      }
      if (skip) {
        continue;
      }
      if (open_files.indexOf(files[i]) > -1) {
        continue;
      }
      try {
        batch_promises.push(this.get_file_embeddings(files[i], false));
      } catch (error) {
        console.log(error);
      }
      if (batch_promises.length > 3) {
        await Promise.all(batch_promises);
        batch_promises = [];
      }
      if (i > 0 && i % 100 === 0) {
        await this.save_embeddings_to_file();
      }
    }
    await Promise.all(batch_promises);
    await this.save_embeddings_to_file();
    if (this.render_log.failed_embeddings.length > 0) {
      await this.save_failed_embeddings();
    }
  }
  async save_embeddings_to_file(force = false) {
    if (!this.has_new_embeddings) {
      return;
    }
    if (!force) {
      if (this.save_timeout) {
        clearTimeout(this.save_timeout);
        this.save_timeout = null;
      }
      this.save_timeout = setTimeout(() => {
        this.save_embeddings_to_file(true);
        if (this.save_timeout) {
          clearTimeout(this.save_timeout);
          this.save_timeout = null;
        }
      }, 3e4);
      console.log("scheduled save");
      return;
    }
    try {
      await this.smart_vec_lite.save();
      this.has_new_embeddings = false;
    } catch (error) {
      console.log(error);
      new Obsidian.Notice("Smart Connections: " + error.message);
    }
  }
  // save failed embeddings to file from render_log.failed_embeddings
  async save_failed_embeddings() {
    let failed_embeddings = [];
    const failed_embeddings_file_exists = await this.app.vault.adapter.exists(".smart-connections/failed-embeddings.txt");
    if (failed_embeddings_file_exists) {
      failed_embeddings = await this.app.vault.adapter.read(".smart-connections/failed-embeddings.txt");
      failed_embeddings = failed_embeddings.split("\r\n");
    }
    failed_embeddings = failed_embeddings.concat(this.render_log.failed_embeddings);
    failed_embeddings = [...new Set(failed_embeddings)];
    failed_embeddings.sort();
    failed_embeddings = failed_embeddings.join("\r\n");
    await this.app.vault.adapter.write(".smart-connections/failed-embeddings.txt", failed_embeddings);
    await this.load_failed_files();
  }
  // load failed files from failed-embeddings.txt
  async load_failed_files() {
    const failed_embeddings_file_exists = await this.app.vault.adapter.exists(".smart-connections/failed-embeddings.txt");
    if (!failed_embeddings_file_exists) {
      this.settings.failed_files = [];
      console.log("No failed files.");
      return;
    }
    const failed_embeddings = await this.app.vault.adapter.read(".smart-connections/failed-embeddings.txt");
    const failed_embeddings_array = failed_embeddings.split("\r\n");
    const failed_files = failed_embeddings_array.map((embedding) => embedding.split("#")[0]).reduce((unique, item) => unique.includes(item) ? unique : [...unique, item], []);
    this.settings.failed_files = failed_files;
  }
  // retry failed embeddings
  async retry_failed_files() {
    this.settings.failed_files = [];
    const failed_embeddings_file_exists = await this.app.vault.adapter.exists(".smart-connections/failed-embeddings.txt");
    if (failed_embeddings_file_exists) {
      await this.app.vault.adapter.remove(".smart-connections/failed-embeddings.txt");
    }
    await this.get_all_embeddings();
  }
  // add .smart-connections to .gitignore to prevent issues with large, frequently updated embeddings file(s)
  async add_to_gitignore() {
    if (!await this.app.vault.adapter.exists(".gitignore")) {
      return;
    }
    let gitignore_file = await this.app.vault.adapter.read(".gitignore");
    if (gitignore_file.indexOf(".smart-connections") < 0) {
      let add_to_gitignore = "\n\n# Ignore Smart Connections folder because embeddings file is large and updated frequently";
      add_to_gitignore += "\n.smart-connections";
      await this.app.vault.adapter.write(".gitignore", gitignore_file + add_to_gitignore);
      console.log("added .smart-connections to .gitignore");
    }
  }
  // force refresh embeddings file but first rename existing embeddings file to .smart-connections/embeddings-YYYY-MM-DD.json
  async force_refresh_embeddings_file() {
    new Obsidian.Notice("Smart Connections: embeddings file Force Refreshed, making new connections...");
    await this.smart_vec_lite.force_refresh();
    await this.get_all_embeddings();
    this.output_render_log();
    new Obsidian.Notice("Smart Connections: embeddings file Force Refreshed, new connections made.");
  }
  // get embeddings for embed_input
  async get_file_embeddings(curr_file, save = true) {
    let req_batch = [];
    let blocks = [];
    const curr_file_key = md5(curr_file.path);
    let file_embed_input = curr_file.path.replace(".md", "");
    file_embed_input = file_embed_input.replace(/\//g, " > ");
    let path_only = false;
    for (let j = 0; j < this.path_only.length; j++) {
      if (curr_file.path.indexOf(this.path_only[j]) > -1) {
        path_only = true;
        console.log("title only file with matcher: " + this.path_only[j]);
        break;
      }
    }
    if (path_only) {
      req_batch.push([curr_file_key, file_embed_input, {
        mtime: curr_file.stat.mtime,
        path: curr_file.path
      }]);
      await this.get_embeddings_batch(req_batch);
      return;
    }
    if (curr_file.extension === "canvas") {
      const canvas_contents = await this.app.vault.cachedRead(curr_file);
      if (typeof canvas_contents === "string" && canvas_contents.indexOf("nodes") > -1) {
        const canvas_json = JSON.parse(canvas_contents);
        for (let j = 0; j < canvas_json.nodes.length; j++) {
          if (canvas_json.nodes[j].text) {
            file_embed_input += "\n" + canvas_json.nodes[j].text;
          }
          if (canvas_json.nodes[j].file) {
            file_embed_input += "\nLink: " + canvas_json.nodes[j].file;
          }
        }
      }
      req_batch.push([curr_file_key, file_embed_input, {
        mtime: curr_file.stat.mtime,
        path: curr_file.path
      }]);
      await this.get_embeddings_batch(req_batch);
      return;
    }
    const note_contents = await this.app.vault.cachedRead(curr_file);
    let processed_since_last_save = 0;
    const note_sections = this.block_parser(note_contents, curr_file.path);
    if (note_sections.length > 1) {
      for (let j = 0; j < note_sections.length; j++) {
        const block_embed_input = note_sections[j].text;
        const block_key = md5(note_sections[j].path);
        blocks.push(block_key);
        if (this.smart_vec_lite.get_size(block_key) === block_embed_input.length) {
          continue;
        }
        if (this.smart_vec_lite.mtime_is_current(block_key, curr_file.stat.mtime)) {
          continue;
        }
        const block_hash = md5(block_embed_input.trim());
        if (this.smart_vec_lite.get_hash(block_key) === block_hash) {
          continue;
        }
        req_batch.push([block_key, block_embed_input, {
          // oldmtime: curr_file.stat.mtime, 
          // get current datetime as unix timestamp
          mtime: Date.now(),
          hash: block_hash,
          parent: curr_file_key,
          path: note_sections[j].path,
          size: block_embed_input.length
        }]);
        if (req_batch.length > 9) {
          await this.get_embeddings_batch(req_batch);
          processed_since_last_save += req_batch.length;
          if (processed_since_last_save >= 30) {
            await this.save_embeddings_to_file();
            processed_since_last_save = 0;
          }
          req_batch = [];
        }
      }
    }
    if (req_batch.length > 0) {
      await this.get_embeddings_batch(req_batch);
      req_batch = [];
      processed_since_last_save += req_batch.length;
    }
    file_embed_input += `:
`;
    if (note_contents.length < MAX_EMBED_STRING_LENGTH) {
      file_embed_input += note_contents;
    } else {
      const note_meta_cache = this.app.metadataCache.getFileCache(curr_file);
      if (typeof note_meta_cache.headings === "undefined") {
        file_embed_input += note_contents.substring(0, MAX_EMBED_STRING_LENGTH);
      } else {
        let note_headings = "";
        for (let j = 0; j < note_meta_cache.headings.length; j++) {
          const heading_level = note_meta_cache.headings[j].level;
          const heading_text = note_meta_cache.headings[j].heading;
          let md_heading = "";
          for (let k = 0; k < heading_level; k++) {
            md_heading += "#";
          }
          note_headings += `${md_heading} ${heading_text}
`;
        }
        file_embed_input += note_headings;
        if (file_embed_input.length > MAX_EMBED_STRING_LENGTH) {
          file_embed_input = file_embed_input.substring(0, MAX_EMBED_STRING_LENGTH);
        }
      }
    }
    const file_hash = md5(file_embed_input.trim());
    const existing_hash = this.smart_vec_lite.get_hash(curr_file_key);
    if (existing_hash && file_hash === existing_hash) {
      this.update_render_log(blocks, file_embed_input);
      return;
    }
    ;
    const existing_blocks = this.smart_vec_lite.get_children(curr_file_key);
    let existing_has_all_blocks = true;
    if (existing_blocks && Array.isArray(existing_blocks) && blocks.length > 0) {
      for (let j = 0; j < blocks.length; j++) {
        if (existing_blocks.indexOf(blocks[j]) === -1) {
          existing_has_all_blocks = false;
          break;
        }
      }
    }
    if (existing_has_all_blocks) {
      const curr_file_size = curr_file.stat.size;
      const prev_file_size = this.smart_vec_lite.get_size(curr_file_key);
      if (prev_file_size) {
        const file_delta_pct = Math.round(Math.abs(curr_file_size - prev_file_size) / curr_file_size * 100);
        if (file_delta_pct < 10) {
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
      children: blocks
    };
    req_batch.push([curr_file_key, file_embed_input, meta]);
    await this.get_embeddings_batch(req_batch);
    if (save) {
      await this.save_embeddings_to_file();
    }
  }
  update_render_log(blocks, file_embed_input) {
    if (blocks.length > 0) {
      this.render_log.tokens_saved_by_cache += file_embed_input.length / 2;
    } else {
      this.render_log.tokens_saved_by_cache += file_embed_input.length / 4;
    }
  }
  async get_embeddings_batch(req_batch) {
    console.log("get_embeddings_batch");
    if (req_batch.length === 0)
      return;
    const embed_inputs = req_batch.map((req) => req[1]);
    const requestResults = await this.request_embedding_from_input(embed_inputs);
    if (!requestResults) {
      console.log("failed embedding batch");
      this.render_log.failed_embeddings = [...this.render_log.failed_embeddings, ...req_batch.map((req) => req[2].path)];
      return;
    }
    if (requestResults) {
      this.has_new_embeddings = true;
      if (this.settings.log_render) {
        if (this.settings.log_render_files) {
          this.render_log.files = [...this.render_log.files, ...req_batch.map((req) => req[2].path)];
        }
        this.render_log.new_embeddings += req_batch.length;
        this.render_log.token_usage += requestResults.usage.total_tokens;
      }
      for (let i = 0; i < requestResults.data.length; i++) {
        const vec = requestResults.data[i].embedding;
        const index = requestResults.data[i].index;
        if (vec) {
          const key = req_batch[index][0];
          const meta = req_batch[index][2];
          this.smart_vec_lite.save_embedding(key, vec, meta);
        }
      }
    }
  }
  async request_embedding_from_input(embed_input, retries = 0) {
    if (embed_input.length === 0) {
      console.log("embed_input is empty");
      return null;
    }
    const usedParams = {
      model: "text-embedding-ada-002",
      input: embed_input
    };
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
      resp = await (0, Obsidian.request)(reqParams);
      return JSON.parse(resp);
    } catch (error) {
      if (error.status === 429 && retries < 3) {
        retries++;
        const backoff = Math.pow(retries, 2);
        console.log(`retrying request (429) in ${backoff} seconds...`);
        await new Promise((r) => setTimeout(r, 1e3 * backoff));
        return await this.request_embedding_from_input(embed_input, retries);
      }
      console.log(resp);
      console.log(error);
      return null;
    }
  }
  async test_api_key() {
    const embed_input = "This is a test of the OpenAI API.";
    const resp = await this.request_embedding_from_input(embed_input);
    if (resp && resp.usage) {
      console.log("API key is valid");
      return true;
    } else {
      console.log("API key is invalid");
      return false;
    }
  }
  output_render_log() {
    if (this.settings.log_render) {
      if (this.render_log.new_embeddings === 0) {
        return;
      } else {
        console.log(JSON.stringify(this.render_log, null, 2));
      }
    }
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
  async find_note_connections(current_note = null) {
    const curr_key = md5(current_note.path);
    let nearest = [];
    if (this.nearest_cache[curr_key]) {
      nearest = this.nearest_cache[curr_key];
    } else {
      for (let j = 0; j < this.file_exclusions.length; j++) {
        if (current_note.path.indexOf(this.file_exclusions[j]) > -1) {
          this.log_exclusion(this.file_exclusions[j]);
          return "excluded";
        }
      }
      setTimeout(() => {
        this.get_all_embeddings();
      }, 3e3);
      if (this.smart_vec_lite.mtime_is_current(curr_key, current_note.stat.mtime)) {
      } else {
        await this.get_file_embeddings(current_note);
      }
      const vec = this.smart_vec_lite.get_vec(curr_key);
      if (!vec) {
        return "Error getting embeddings for: " + current_note.path;
      }
      nearest = this.smart_vec_lite.nearest(vec, {
        skip_key: curr_key,
        skip_sections: this.settings.skip_sections
      });
      this.nearest_cache[curr_key] = nearest;
    }
    return nearest;
  }
  // create render_log object of exlusions with number of times skipped as value
  log_exclusion(exclusion) {
    this.render_log.exclusions_logs[exclusion] = (this.render_log.exclusions_logs[exclusion] || 0) + 1;
  }
  block_parser(markdown, file_path) {
    if (this.settings.skip_sections) {
      return [];
    }
    const lines = markdown.split("\n");
    let blocks = [];
    let currentHeaders = [];
    const file_breadcrumbs = file_path.replace(".md", "").replace(/\//g, " > ");
    let block = "";
    let block_headings = "";
    let block_path = file_path;
    let last_heading_line = 0;
    let i = 0;
    let block_headings_list = [];
    for (i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line.startsWith("#") || ["#", " "].indexOf(line[1]) < 0) {
        if (line === "")
          continue;
        if (["- ", "- [ ] "].indexOf(line) > -1)
          continue;
        if (currentHeaders.length === 0)
          continue;
        block += "\n" + line;
        continue;
      }
      last_heading_line = i;
      if (i > 0 && last_heading_line !== i - 1 && block.indexOf("\n") > -1 && this.validate_headings(block_headings)) {
        output_block();
      }
      const level = line.split("#").length - 1;
      currentHeaders = currentHeaders.filter((header) => header.level < level);
      currentHeaders.push({ header: line.replace(/#/g, "").trim(), level });
      block = file_breadcrumbs;
      block += ": " + currentHeaders.map((header) => header.header).join(" > ");
      block_headings = "#" + currentHeaders.map((header) => header.header).join("#");
      if (block_headings_list.indexOf(block_headings) > -1) {
        let count = 1;
        while (block_headings_list.indexOf(`${block_headings}{${count}}`) > -1) {
          count++;
        }
        block_headings = `${block_headings}{${count}}`;
      }
      block_headings_list.push(block_headings);
      block_path = file_path + block_headings;
    }
    if (last_heading_line !== i - 1 && block.indexOf("\n") > -1 && this.validate_headings(block_headings))
      output_block();
    blocks = blocks.filter((b) => b.length > 50);
    return blocks;
    function output_block() {
      const breadcrumbs_length = block.indexOf("\n") + 1;
      const block_length = block.length - breadcrumbs_length;
      if (block.length > MAX_EMBED_STRING_LENGTH) {
        block = block.substring(0, MAX_EMBED_STRING_LENGTH);
      }
      blocks.push({ text: block.trim(), path: block_path, length: block_length });
    }
  }
  // reverse-retrieve block given path
  async block_retriever(path, limits = {}) {
    limits = {
      lines: null,
      chars_per_line: null,
      max_chars: null,
      ...limits
    };
    if (path.indexOf("#") < 0) {
      console.log("not a block path: " + path);
      return false;
    }
    let block = [];
    let block_headings = path.split("#").slice(1);
    let heading_occurrence = 0;
    if (block_headings[block_headings.length - 1].indexOf("{") > -1) {
      heading_occurrence = parseInt(block_headings[block_headings.length - 1].split("{")[1].replace("}", ""));
      block_headings[block_headings.length - 1] = block_headings[block_headings.length - 1].split("{")[0];
    }
    let currentHeaders = [];
    let occurrence_count = 0;
    let begin_line = 0;
    let i = 0;
    const file_path = path.split("#")[0];
    const file = this.app.vault.getAbstractFileByPath(file_path);
    if (!(file instanceof Obsidian.TFile)) {
      console.log("not a file: " + file_path);
      return false;
    }
    const file_contents = await this.app.vault.cachedRead(file);
    const lines = file_contents.split("\n");
    let is_code = false;
    for (i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.indexOf("```") === 0) {
        is_code = !is_code;
      }
      if (is_code) {
        continue;
      }
      if (["- ", "- [ ] "].indexOf(line) > -1)
        continue;
      if (!line.startsWith("#") || ["#", " "].indexOf(line[1]) < 0) {
        continue;
      }
      const heading_text = line.replace(/#/g, "").trim();
      const heading_index = block_headings.indexOf(heading_text);
      if (heading_index < 0)
        continue;
      if (currentHeaders.length !== heading_index)
        continue;
      currentHeaders.push(heading_text);
      if (currentHeaders.length === block_headings.length) {
        if (heading_occurrence === 0) {
          begin_line = i + 1;
          break;
        }
        if (occurrence_count === heading_occurrence) {
          begin_line = i + 1;
          break;
        }
        occurrence_count++;
        currentHeaders.pop();
        continue;
      }
    }
    if (begin_line === 0)
      return false;
    is_code = false;
    let char_count = 0;
    for (i = begin_line; i < lines.length; i++) {
      if (typeof line_limit === "number" && block.length > line_limit) {
        block.push("...");
        break;
      }
      let line = lines[i];
      if (line.indexOf("#") === 0 && ["#", " "].indexOf(line[1]) !== -1) {
        break;
      }
      if (limits.max_chars && char_count > limits.max_chars) {
        block.push("...");
        break;
      }
      if (limits.max_chars && line.length + char_count > limits.max_chars) {
        const max_new_chars = limits.max_chars - char_count;
        line = line.slice(0, max_new_chars) + "...";
        break;
      }
      if (line.length === 0)
        continue;
      if (limits.chars_per_line && line.length > limits.chars_per_line) {
        line = line.slice(0, limits.chars_per_line) + "...";
      }
      if (line.startsWith("```")) {
        is_code = !is_code;
        continue;
      }
      if (is_code) {
        line = "	" + line;
      }
      block.push(line);
      char_count += line.length;
    }
    if (is_code) {
      block.push("```");
    }
    return block.join("\n").trim();
  }
  // retrieve a file from the vault
  async file_retriever(link, limits = {}) {
    limits = {
      lines: null,
      max_chars: null,
      chars_per_line: null,
      ...limits
    };
    const this_file = this.app.vault.getAbstractFileByPath(link);
    if (!(this_file instanceof Obsidian.TAbstractFile))
      return false;
    const file_content = await this.app.vault.cachedRead(this_file);
    const file_lines = file_content.split("\n");
    let first_ten_lines = [];
    let is_code = false;
    let char_accum = 0;
    const line_limit2 = limits.lines || file_lines.length;
    for (let i = 0; first_ten_lines.length < line_limit2; i++) {
      let line = file_lines[i];
      if (typeof line === "undefined")
        break;
      if (line.length === 0)
        continue;
      if (limits.chars_per_line && line.length > limits.chars_per_line) {
        line = line.slice(0, limits.chars_per_line) + "...";
      }
      if (line === "---")
        continue;
      if (["- ", "- [ ] "].indexOf(line) > -1)
        continue;
      if (line.indexOf("```") === 0) {
        is_code = !is_code;
        continue;
      }
      if (limits.max_chars && char_accum > limits.max_chars) {
        first_ten_lines.push("...");
        break;
      }
      if (is_code) {
        line = "	" + line;
      }
      if (line_is_heading(line)) {
        if (first_ten_lines.length > 0 && line_is_heading(first_ten_lines[first_ten_lines.length - 1])) {
          first_ten_lines.pop();
        }
      }
      first_ten_lines.push(line);
      char_accum += line.length;
    }
    for (let i = 0; i < first_ten_lines.length; i++) {
      if (line_is_heading(first_ten_lines[i])) {
        if (i === first_ten_lines.length - 1) {
          first_ten_lines.pop();
          break;
        }
        first_ten_lines[i] = first_ten_lines[i].replace(/#+/, "");
        first_ten_lines[i] = `
${first_ten_lines[i]}:`;
      }
    }
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
          this.log_exclusion("heading: " + this.header_exclusions[k]);
          break;
        }
      }
    }
    return valid;
  }
  // render "Smart Connections" text fixed in the bottom right corner
  render_brand(container, location = "default") {
    if (container === "all") {
      const locations = Object.keys(this.sc_branding);
      for (let i = 0; i < locations.length; i++) {
        this.render_brand(this.sc_branding[locations[i]], locations[i]);
      }
      return;
    }
    this.sc_branding[location] = container;
    if (this.sc_branding[location].querySelector(".sc-brand")) {
      this.sc_branding[location].querySelector(".sc-brand").remove();
    }
    const brand_container = this.sc_branding[location].createEl("div", { cls: "sc-brand" });
    Obsidian.setIcon(brand_container, "smart-connections");
    const brand_p = brand_container.createEl("p");
    let text = "Smart Connections";
    let attr = {};
    if (this.update_available) {
      text = "Update Available";
      attr = {
        style: "font-weight: 700;"
      };
    }
    brand_p.createEl("a", {
      cls: "",
      text,
      href: "https://github.com/brianpetro/obsidian-smart-connections/discussions",
      target: "_blank",
      attr
    });
  }
  // create list of nearest notes
  async update_results(container, nearest) {
    let list;
    if (container.children.length > 1 && container.children[1].classList.contains("sc-list")) {
      list = container.children[1];
    }
    if (list) {
      list.empty();
    } else {
      list = container.createEl("div", { cls: "sc-list" });
    }
    let search_result_class = "search-result";
    if (!this.settings.expanded_view)
      search_result_class += " sc-collapsed";
    if (!this.settings.group_nearest_by_file) {
      for (let i = 0; i < nearest.length; i++) {
        if (typeof nearest[i].link === "object") {
          const item2 = list.createEl("div", { cls: "search-result" });
          const link2 = item2.createEl("a", {
            cls: "search-result-file-title is-clickable",
            href: nearest[i].link.path,
            title: nearest[i].link.title
          });
          link2.innerHTML = this.render_external_link_elm(nearest[i].link);
          item2.setAttr("draggable", "true");
          continue;
        }
        let file_link_text;
        const file_similarity_pct = Math.round(nearest[i].similarity * 100) + "%";
        if (this.settings.show_full_path) {
          const pcs = nearest[i].link.split("/");
          file_link_text = pcs[pcs.length - 1];
          const path = pcs.slice(0, pcs.length - 1).join("/");
          file_link_text = `<small>${file_similarity_pct} | ${path} | ${file_link_text}</small>`;
        } else {
          file_link_text = "<small>" + file_similarity_pct + " | " + nearest[i].link.split("/").pop() + "</small>";
        }
        if (!this.renderable_file_type(nearest[i].link)) {
          const item2 = list.createEl("div", { cls: "search-result" });
          const link2 = item2.createEl("a", {
            cls: "search-result-file-title is-clickable",
            href: nearest[i].link
          });
          link2.innerHTML = file_link_text;
          item2.setAttr("draggable", "true");
          this.add_link_listeners(link2, nearest[i], item2);
          continue;
        }
        file_link_text = file_link_text.replace(".md", "").replace(/#/g, " > ");
        const item = list.createEl("div", { cls: search_result_class });
        const toggle = item.createEl("span", { cls: "is-clickable" });
        Obsidian.setIcon(toggle, "right-triangle");
        const link = toggle.createEl("a", {
          cls: "search-result-file-title",
          title: nearest[i].link
        });
        link.innerHTML = file_link_text;
        this.add_link_listeners(link, nearest[i], item);
        toggle.addEventListener("click", (event) => {
          let parent = event.target.parentElement;
          while (!parent.classList.contains("search-result")) {
            parent = parent.parentElement;
          }
          parent.classList.toggle("sc-collapsed");
        });
        const contents = item.createEl("ul", { cls: "" });
        const contents_container = contents.createEl("li", {
          cls: "search-result-file-title is-clickable",
          title: nearest[i].link
        });
        if (nearest[i].link.indexOf("#") > -1) {
          Obsidian.MarkdownRenderer.renderMarkdown(await this.block_retriever(nearest[i].link, { lines: 10, max_chars: 1e3 }), contents_container, nearest[i].link, new Obsidian.Component());
        } else {
          const first_ten_lines = await this.file_retriever(nearest[i].link, { lines: 10, max_chars: 1e3 });
          if (!first_ten_lines)
            continue;
          Obsidian.MarkdownRenderer.renderMarkdown(first_ten_lines, contents_container, nearest[i].link, new Obsidian.Component());
        }
        this.add_link_listeners(contents, nearest[i], item);
      }
      this.render_brand(container, "block");
      return;
    }
    const nearest_by_file = {};
    for (let i = 0; i < nearest.length; i++) {
      const curr = nearest[i];
      const link = curr.link;
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
        nearest_by_file[link].unshift(nearest[i]);
      }
    }
    const keys = Object.keys(nearest_by_file);
    for (let i = 0; i < keys.length; i++) {
      const file = nearest_by_file[keys[i]];
      if (typeof file[0].link === "object") {
        const curr = file[0];
        const meta = curr.link;
        if (meta.path.startsWith("http")) {
          const item2 = list.createEl("div", { cls: "search-result" });
          const link = item2.createEl("a", {
            cls: "search-result-file-title is-clickable",
            href: meta.path,
            title: meta.title
          });
          link.innerHTML = this.render_external_link_elm(meta);
          item2.setAttr("draggable", "true");
          continue;
        }
      }
      let file_link_text;
      const file_similarity_pct = Math.round(file[0].similarity * 100) + "%";
      if (this.settings.show_full_path) {
        const pcs = file[0].link.split("/");
        file_link_text = pcs[pcs.length - 1];
        const path = pcs.slice(0, pcs.length - 1).join("/");
        file_link_text = `<small>${path} | ${file_similarity_pct}</small><br>${file_link_text}`;
      } else {
        file_link_text = file[0].link.split("/").pop();
        file_link_text += " | " + file_similarity_pct;
      }
      if (!this.renderable_file_type(file[0].link)) {
        const item2 = list.createEl("div", { cls: "search-result" });
        const file_link2 = item2.createEl("a", {
          cls: "search-result-file-title is-clickable",
          title: file[0].link
        });
        file_link2.innerHTML = file_link_text;
        this.add_link_listeners(file_link2, file[0], item2);
        continue;
      }
      file_link_text = file_link_text.replace(".md", "").replace(/#/g, " > ");
      const item = list.createEl("div", { cls: search_result_class });
      const toggle = item.createEl("span", { cls: "is-clickable" });
      Obsidian.setIcon(toggle, "right-triangle");
      const file_link = toggle.createEl("a", {
        cls: "search-result-file-title",
        title: file[0].link
      });
      file_link.innerHTML = file_link_text;
      this.add_link_listeners(file_link, file[0], toggle);
      toggle.addEventListener("click", (event) => {
        let parent = event.target;
        while (!parent.classList.contains("search-result")) {
          parent = parent.parentElement;
        }
        parent.classList.toggle("sc-collapsed");
      });
      const file_link_list = item.createEl("ul");
      for (let j = 0; j < file.length; j++) {
        if (file[j].link.indexOf("#") > -1) {
          const block = file[j];
          const block_link = file_link_list.createEl("li", {
            cls: "search-result-file-title is-clickable",
            title: block.link
          });
          if (file.length > 1) {
            const block_context = this.render_block_context(block);
            const block_similarity_pct = Math.round(block.similarity * 100) + "%";
            block_link.innerHTML = `<small>${block_context} | ${block_similarity_pct}</small>`;
          }
          const block_container = block_link.createEl("div");
          Obsidian.MarkdownRenderer.renderMarkdown(await this.block_retriever(block.link, { lines: 10, max_chars: 1e3 }), block_container, block.link, new Obsidian.Component());
          this.add_link_listeners(block_link, block, file_link_list);
        } else {
          const file_link_list2 = item.createEl("ul");
          const block_link = file_link_list2.createEl("li", {
            cls: "search-result-file-title is-clickable",
            title: file[0].link
          });
          const block_container = block_link.createEl("div");
          let first_ten_lines = await this.file_retriever(file[0].link, { lines: 10, max_chars: 1e3 });
          if (!first_ten_lines)
            continue;
          Obsidian.MarkdownRenderer.renderMarkdown(first_ten_lines, block_container, file[0].link, new Obsidian.Component());
          this.add_link_listeners(block_link, file[0], file_link_list2);
        }
      }
    }
    this.render_brand(container, "file");
  }
  add_link_listeners(item, curr, list) {
    item.addEventListener("click", async (event) => {
      await this.open_note(curr, event);
    });
    item.setAttr("draggable", "true");
    item.addEventListener("dragstart", (event) => {
      const dragManager = this.app.dragManager;
      const file_path = curr.link.split("#")[0];
      const file = this.app.metadataCache.getFirstLinkpathDest(file_path, "");
      const dragData = dragManager.dragFile(event, file);
      dragManager.onDragStart(event, dragData);
    });
    if (curr.link.indexOf("{") > -1)
      return;
    item.addEventListener("mouseover", (event) => {
      this.app.workspace.trigger("hover-link", {
        event,
        source: SMART_CONNECTIONS_VIEW_TYPE,
        hoverParent: list,
        targetEl: item,
        linktext: curr.link
      });
    });
  }
  // get target file from link path
  // if sub-section is linked, open file and scroll to sub-section
  async open_note(curr, event = null) {
    let targetFile;
    let heading;
    if (curr.link.indexOf("#") > -1) {
      targetFile = this.app.metadataCache.getFirstLinkpathDest(curr.link.split("#")[0], "");
      const target_file_cache = this.app.metadataCache.getFileCache(targetFile);
      let heading_text = curr.link.split("#").pop();
      let occurence = 0;
      if (heading_text.indexOf("{") > -1) {
        occurence = parseInt(heading_text.split("{")[1].split("}")[0]);
        heading_text = heading_text.split("{")[0];
      }
      const headings = target_file_cache.headings;
      for (let i = 0; i < headings.length; i++) {
        if (headings[i].heading === heading_text) {
          if (occurence === 0) {
            heading = headings[i];
            break;
          }
          occurence--;
        }
      }
    } else {
      targetFile = this.app.metadataCache.getFirstLinkpathDest(curr.link, "");
    }
    let leaf;
    if (event) {
      const mod = Obsidian.Keymap.isModEvent(event);
      leaf = this.app.workspace.getLeaf(mod);
    } else {
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
    let block_context = "";
    for (let i = block_headings.length - 1; i >= 0; i--) {
      if (block_context.length > 0) {
        block_context = ` > ${block_context}`;
      }
      block_context = block_headings[i] + block_context;
      if (block_context.length > 100) {
        break;
      }
    }
    if (block_context.startsWith(" > ")) {
      block_context = block_context.slice(3);
    }
    return block_context;
  }
  renderable_file_type(link) {
    return link.indexOf(".md") !== -1 && link.indexOf(".excalidraw") === -1;
  }
  render_external_link_elm(meta) {
    if (meta.source) {
      if (meta.source === "Gmail")
        meta.source = "\u{1F4E7} Gmail";
      return `<small>${meta.source}</small><br>${meta.title}`;
    }
    let domain = meta.path.replace(/(^\w+:|^)\/\//, "");
    domain = domain.split("/")[0];
    return `<small>\u{1F310} ${domain}</small><br>${meta.title}`;
  }
  // get all folders
  async get_all_folders() {
    if (!this.folders || this.folders.length === 0) {
      this.folders = await this.get_folders();
    }
    return this.folders;
  }
  // get folders, traverse non-hidden sub-folders
  async get_folders(path = "/") {
    let folders = (await this.app.vault.adapter.list(path)).folders;
    let folder_list = [];
    for (let i = 0; i < folders.length; i++) {
      if (folders[i].startsWith("."))
        continue;
      folder_list.push(folders[i]);
      folder_list = folder_list.concat(await this.get_folders(folders[i] + "/"));
    }
    return folder_list;
  }
  async sync_notes() {
    if (!this.settings.license_key) {
      new Obsidian.Notice("Smart Connections: Supporter license key is required to sync notes to the ChatGPT Plugin server.");
      return;
    }
    console.log("syncing notes");
    const files = this.app.vault.getMarkdownFiles().filter((file) => {
      for (let i = 0; i < this.file_exclusions.length; i++) {
        if (file.path.indexOf(this.file_exclusions[i]) > -1) {
          return false;
        }
      }
      return true;
    });
    const notes = await this.build_notes_object(files);
    console.log("object built");
    await this.app.vault.adapter.write(".smart-connections/notes.json", JSON.stringify(notes, null, 2));
    console.log("notes saved");
    console.log(this.settings.license_key);
    const response = await (0, Obsidian.requestUrl)({
      url: "https://sync.smartconnections.app/sync",
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      contentType: "application/json",
      body: JSON.stringify({
        license_key: this.settings.license_key,
        notes
      })
    });
    console.log(response);
  }
  async build_notes_object(files) {
    let output = {};
    for (let i = 0; i < files.length; i++) {
      let file = files[i];
      let parts = file.path.split("/");
      let current = output;
      for (let ii = 0; ii < parts.length; ii++) {
        let part = parts[ii];
        if (ii === parts.length - 1) {
          current[part] = await this.app.vault.cachedRead(file);
        } else {
          if (!current[part]) {
            current[part] = {};
          }
          current = current[part];
        }
      }
    }
    return output;
  }
};
var SMART_CONNECTIONS_VIEW_TYPE = "smart-connections-view";
var SmartConnectionsView = class extends Obsidian.ItemView {
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
    container.empty();
    this.initiate_top_bar(container);
    if (Array.isArray(message)) {
      for (let i = 0; i < message.length; i++) {
        container.createEl("p", { cls: "sc_message", text: message[i] });
      }
    } else {
      container.createEl("p", { cls: "sc_message", text: message });
    }
  }
  render_link_text(link, show_full_path = false) {
    if (!show_full_path) {
      link = link.split("/").pop();
    }
    if (link.indexOf("#") > -1) {
      link = link.split(".md");
      link[0] = `<small>${link[0]}</small><br>`;
      link = link.join("");
      link = link.replace(/\#/g, " \xBB ");
    } else {
      link = link.replace(".md", "");
    }
    return link;
  }
  set_nearest(nearest, nearest_context = null, results_only = false) {
    const container = this.containerEl.children[1];
    if (!results_only) {
      container.empty();
      this.initiate_top_bar(container, nearest_context);
    }
    this.plugin.update_results(container, nearest);
  }
  initiate_top_bar(container, nearest_context = null) {
    let top_bar;
    if (container.children.length > 0 && container.children[0].classList.contains("sc-top-bar")) {
      top_bar = container.children[0];
      top_bar.empty();
    } else {
      top_bar = container.createEl("div", { cls: "sc-top-bar" });
    }
    if (nearest_context) {
      top_bar.createEl("p", { cls: "sc-context", text: nearest_context });
    }
    const chat_button = top_bar.createEl("button", { cls: "sc-chat-button" });
    Obsidian.setIcon(chat_button, "message-square");
    chat_button.addEventListener("click", () => {
      this.plugin.open_chat();
    });
    const search_button = top_bar.createEl("button", { cls: "sc-search-button" });
    Obsidian.setIcon(search_button, "search");
    search_button.addEventListener("click", () => {
      top_bar.empty();
      const search_container = top_bar.createEl("div", { cls: "search-input-container" });
      const input = search_container.createEl("input", {
        cls: "sc-search-input",
        type: "search",
        placeholder: "Type to start search..."
      });
      input.focus();
      input.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
          this.clear_auto_searcher();
          this.initiate_top_bar(container, nearest_context);
        }
      });
      input.addEventListener("keyup", (event) => {
        this.clear_auto_searcher();
        const search_term = input.value;
        if (event.key === "Enter" && search_term !== "") {
          this.search(search_term);
        } else if (search_term !== "") {
          clearTimeout(this.search_timeout);
          this.search_timeout = setTimeout(() => {
            this.search(search_term, true);
          }, 700);
        }
      });
    });
  }
  // render buttons: "create" and "retry" for loading embeddings.json file
  render_embeddings_buttons() {
    const container = this.containerEl.children[1];
    container.empty();
    container.createEl("h2", { cls: "scHeading", text: "Embeddings file not found" });
    const button_div = container.createEl("div", { cls: "scButtonDiv" });
    const create_button = button_div.createEl("button", { cls: "scButton", text: "Create embeddings.json" });
    button_div.createEl("p", { cls: "scButtonNote", text: "Warning: Creating embeddings.json file will trigger bulk embedding and may take a while" });
    const retry_button = button_div.createEl("button", { cls: "scButton", text: "Retry" });
    button_div.createEl("p", { cls: "scButtonNote", text: "If embeddings.json file already exists, click 'Retry' to load it" });
    create_button.addEventListener("click", async (event) => {
      await this.plugin.smart_vec_lite.init_embeddings_file();
      await this.render_connections();
    });
    retry_button.addEventListener("click", async (event) => {
      console.log("retrying to load embeddings.json file");
      await this.plugin.init_vecs();
      await this.render_connections();
    });
  }
  async onOpen() {
    const container = this.containerEl.children[1];
    container.empty();
    container.createEl("p", { cls: "scPlaceholder", text: "Open a note to find connections." });
    this.plugin.registerEvent(this.app.workspace.on("file-open", (file) => {
      if (!file) {
        return;
      }
      if (SUPPORTED_FILE_TYPES.indexOf(file.extension) === -1) {
        return this.set_message([
          "File: " + file.name,
          "Unsupported file type (Supported: " + SUPPORTED_FILE_TYPES.join(", ") + ")"
        ]);
      }
      if (this.load_wait) {
        clearTimeout(this.load_wait);
      }
      this.load_wait = setTimeout(() => {
        this.render_connections(file);
        this.load_wait = null;
      }, 1e3);
    }));
    this.app.workspace.registerHoverLinkSource(SMART_CONNECTIONS_VIEW_TYPE, {
      display: "Smart Connections Files",
      defaultMod: true
    });
    this.app.workspace.registerHoverLinkSource(SMART_CONNECTIONS_CHAT_VIEW_TYPE, {
      display: "Smart Chat Links",
      defaultMod: true
    });
    this.app.workspace.onLayoutReady(this.initialize.bind(this));
  }
  async initialize() {
    this.set_message("Loading embeddings file...");
    const vecs_intiated = await this.plugin.init_vecs();
    if (vecs_intiated) {
      this.set_message("Embeddings file loaded.");
      await this.render_connections();
    } else {
      this.render_embeddings_buttons();
    }
    this.api = new SmartConnectionsViewApi(this.app, this.plugin, this);
    (window["SmartConnectionsViewApi"] = this.api) && this.register(() => delete window["SmartConnectionsViewApi"]);
  }
  async onClose() {
    console.log("closing smart connections view");
    this.app.workspace.unregisterHoverLinkSource(SMART_CONNECTIONS_VIEW_TYPE);
    this.plugin.view = null;
  }
  async render_connections(context = null) {
    console.log("rendering connections");
    if (!this.plugin.settings.api_key) {
      this.set_message("An OpenAI API key is required to make Smart Connections");
      return;
    }
    if (!this.plugin.embeddings_loaded) {
      await this.plugin.init_vecs();
    }
    if (!this.plugin.embeddings_loaded) {
      console.log("embeddings files still not loaded or yet to be created");
      this.render_embeddings_buttons();
      return;
    }
    this.set_message("Making Smart Connections...");
    if (typeof context === "string") {
      const highlighted_text = context;
      await this.search(highlighted_text);
      return;
    }
    this.nearest = null;
    this.interval_count = 0;
    this.rendering = false;
    this.file = context;
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.interval = setInterval(() => {
      if (!this.rendering) {
        if (this.file instanceof Obsidian.TFile) {
          this.rendering = true;
          this.render_note_connections(this.file);
        } else {
          this.file = this.app.workspace.getActiveFile();
          if (!this.file && this.count > 1) {
            clearInterval(this.interval);
            this.set_message("No active file");
            return;
          }
        }
      } else {
        if (this.nearest) {
          clearInterval(this.interval);
          if (typeof this.nearest === "string") {
            this.set_message(this.nearest);
          } else {
            this.set_nearest(this.nearest, "File: " + this.file.name);
          }
          if (this.plugin.render_log.failed_embeddings.length > 0) {
            this.plugin.save_failed_embeddings();
          }
          this.plugin.output_render_log();
          return;
        } else {
          this.interval_count++;
          this.set_message("Making Smart Connections..." + this.interval_count);
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
  async search(search_text, results_only = false) {
    const nearest = await this.plugin.api.search(search_text);
    const nearest_context = `Selection: "${search_text.length > 100 ? search_text.substring(0, 100) + "..." : search_text}"`;
    this.set_nearest(nearest, nearest_context, results_only);
  }
};
var SmartConnectionsViewApi = class {
  constructor(app, plugin, view) {
    this.app = app;
    this.plugin = plugin;
    this.view = view;
  }
  async search(search_text) {
    return await this.plugin.api.search(search_text);
  }
  // trigger reload of embeddings file
  async reload_embeddings_file() {
    await this.plugin.init_vecs();
    await this.view.render_connections();
  }
};
var ScSearchApi = class {
  constructor(app, plugin) {
    this.app = app;
    this.plugin = plugin;
  }
  async search(search_text, filter = {}) {
    filter = {
      skip_sections: this.plugin.settings.skip_sections,
      ...filter
    };
    let nearest = [];
    const resp = await this.plugin.request_embedding_from_input(search_text);
    if (resp && resp.data && resp.data[0] && resp.data[0].embedding) {
      nearest = this.plugin.smart_vec_lite.nearest(resp.data[0].embedding, filter);
    } else {
      new Obsidian.Notice("Smart Connections: Error getting embedding");
    }
    return nearest;
  }
};
var SmartConnectionsSettingsTab = class extends Obsidian.PluginSettingTab {
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
    containerEl.createEl("p", {
      text: 'As a Smart Connections "Supporter", fast-track your PKM journey with priority perks and pioneering innovations.'
    });
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
    new Obsidian.Setting(containerEl).setName("Supporter License Key").setDesc("Note: this is not required to use Smart Connections.").addText((text) => text.setPlaceholder("Enter your license_key").setValue(this.plugin.settings.license_key).onChange(async (value) => {
      this.plugin.settings.license_key = value.trim();
      await this.plugin.saveSettings(true);
    }));
    new Obsidian.Setting(containerEl).setName("Sync Notes").setDesc("Make notes available via the Smart Connections ChatGPT Plugin. Respects exclusion settings configured below.").addButton((button) => button.setButtonText("Sync Notes").onClick(async () => {
      await this.plugin.sync_notes();
    }));
    new Obsidian.Setting(containerEl).setName("Become a Supporter").setDesc("Become a Supporter").addButton((button) => button.setButtonText("Become a Supporter").onClick(async () => {
      const payment_pages = [
        "https://buy.stripe.com/9AQ5kO5QnbAWgGAbIY",
        "https://buy.stripe.com/9AQ7sWemT48u1LGcN4"
      ];
      if (!this.plugin.payment_page_index) {
        this.plugin.payment_page_index = Math.round(Math.random());
      }
      window.open(payment_pages[this.plugin.payment_page_index]);
    }));
    containerEl.createEl("h2", {
      text: "OpenAI Settings"
    });
    new Obsidian.Setting(containerEl).setName("OpenAI API Key").setDesc("Required: an OpenAI API key is currently required to use Smart Connections.").addText((text) => text.setPlaceholder("Enter your api_key").setValue(this.plugin.settings.api_key).onChange(async (value) => {
      this.plugin.settings.api_key = value.trim();
      await this.plugin.saveSettings(true);
    }));
    new Obsidian.Setting(containerEl).setName("Test API Key").setDesc("Test API Key").addButton((button) => button.setButtonText("Test API Key").onClick(async () => {
      const resp = await this.plugin.test_api_key();
      if (resp) {
        new Obsidian.Notice("Smart Connections: API key is valid");
      } else {
        new Obsidian.Notice("Smart Connections: API key is not working as expected!");
      }
    }));
    new Obsidian.Setting(containerEl).setName("Smart Chat Model").setDesc("Select a model to use with Smart Chat.").addDropdown((dropdown) => {
      dropdown.addOption("gpt-3.5-turbo-16k", "gpt-3.5-turbo-16k");
      dropdown.addOption("gpt-4", "gpt-4 (limited access, 8k)");
      dropdown.addOption("gpt-3.5-turbo", "gpt-3.5-turbo (4k)");
      dropdown.addOption("gpt-4-1106-preview", "gpt-4-turbo (128k)");
      dropdown.onChange(async (value) => {
        this.plugin.settings.smart_chat_model = value;
        await this.plugin.saveSettings();
      });
      dropdown.setValue(this.plugin.settings.smart_chat_model);
    });
    new Obsidian.Setting(containerEl).setName("Default Language").setDesc("Default language to use for Smart Chat. Changes which self-referential pronouns will trigger lookup of your notes.").addDropdown((dropdown) => {
      const languages = Object.keys(SMART_TRANSLATION);
      for (let i = 0; i < languages.length; i++) {
        dropdown.addOption(languages[i], languages[i]);
      }
      dropdown.onChange(async (value) => {
        this.plugin.settings.language = value;
        await this.plugin.saveSettings();
        self_ref_pronouns_list.setText(this.get_self_ref_list());
        const chat_view = this.app.workspace.getLeavesOfType(SMART_CONNECTIONS_CHAT_VIEW_TYPE).length > 0 ? this.app.workspace.getLeavesOfType(SMART_CONNECTIONS_CHAT_VIEW_TYPE)[0].view : null;
        if (chat_view) {
          chat_view.new_chat();
        }
      });
      dropdown.setValue(this.plugin.settings.language);
    });
    const self_ref_pronouns_list = containerEl.createEl("span", {
      text: this.get_self_ref_list()
    });
    containerEl.createEl("h2", {
      text: "Exclusions"
    });
    new Obsidian.Setting(containerEl).setName("file_exclusions").setDesc("'Excluded file' matchers separated by a comma.").addText((text) => text.setPlaceholder("drawings,prompts/logs").setValue(this.plugin.settings.file_exclusions).onChange(async (value) => {
      this.plugin.settings.file_exclusions = value;
      await this.plugin.saveSettings();
    }));
    new Obsidian.Setting(containerEl).setName("folder_exclusions").setDesc("'Excluded folder' matchers separated by a comma.").addText((text) => text.setPlaceholder("drawings,prompts/logs").setValue(this.plugin.settings.folder_exclusions).onChange(async (value) => {
      this.plugin.settings.folder_exclusions = value;
      await this.plugin.saveSettings();
    }));
    new Obsidian.Setting(containerEl).setName("path_only").setDesc("'Path only' matchers separated by a comma.").addText((text) => text.setPlaceholder("drawings,prompts/logs").setValue(this.plugin.settings.path_only).onChange(async (value) => {
      this.plugin.settings.path_only = value;
      await this.plugin.saveSettings();
    }));
    new Obsidian.Setting(containerEl).setName("header_exclusions").setDesc("'Excluded header' matchers separated by a comma. Works for 'blocks' only.").addText((text) => text.setPlaceholder("drawings,prompts/logs").setValue(this.plugin.settings.header_exclusions).onChange(async (value) => {
      this.plugin.settings.header_exclusions = value;
      await this.plugin.saveSettings();
    }));
    containerEl.createEl("h2", {
      text: "Display"
    });
    new Obsidian.Setting(containerEl).setName("show_full_path").setDesc("Show full path in view.").addToggle((toggle) => toggle.setValue(this.plugin.settings.show_full_path).onChange(async (value) => {
      this.plugin.settings.show_full_path = value;
      await this.plugin.saveSettings(true);
    }));
    new Obsidian.Setting(containerEl).setName("expanded_view").setDesc("Expanded view by default.").addToggle((toggle) => toggle.setValue(this.plugin.settings.expanded_view).onChange(async (value) => {
      this.plugin.settings.expanded_view = value;
      await this.plugin.saveSettings(true);
    }));
    new Obsidian.Setting(containerEl).setName("group_nearest_by_file").setDesc("Group nearest by file.").addToggle((toggle) => toggle.setValue(this.plugin.settings.group_nearest_by_file).onChange(async (value) => {
      this.plugin.settings.group_nearest_by_file = value;
      await this.plugin.saveSettings(true);
    }));
    new Obsidian.Setting(containerEl).setName("view_open").setDesc("Open view on Obsidian startup.").addToggle((toggle) => toggle.setValue(this.plugin.settings.view_open).onChange(async (value) => {
      this.plugin.settings.view_open = value;
      await this.plugin.saveSettings(true);
    }));
    new Obsidian.Setting(containerEl).setName("chat_open").setDesc("Open view on Obsidian startup.").addToggle((toggle) => toggle.setValue(this.plugin.settings.chat_open).onChange(async (value) => {
      this.plugin.settings.chat_open = value;
      await this.plugin.saveSettings(true);
    }));
    containerEl.createEl("h2", {
      text: "Advanced"
    });
    new Obsidian.Setting(containerEl).setName("log_render").setDesc("Log render details to console (includes token_usage).").addToggle((toggle) => toggle.setValue(this.plugin.settings.log_render).onChange(async (value) => {
      this.plugin.settings.log_render = value;
      await this.plugin.saveSettings(true);
    }));
    new Obsidian.Setting(containerEl).setName("log_render_files").setDesc("Log embedded objects paths with log render (for debugging).").addToggle((toggle) => toggle.setValue(this.plugin.settings.log_render_files).onChange(async (value) => {
      this.plugin.settings.log_render_files = value;
      await this.plugin.saveSettings(true);
    }));
    new Obsidian.Setting(containerEl).setName("skip_sections").setDesc("Skips making connections to specific sections within notes. Warning: reduces usefulness for large files and requires 'Force Refresh' for sections to work in the future.").addToggle((toggle) => toggle.setValue(this.plugin.settings.skip_sections).onChange(async (value) => {
      this.plugin.settings.skip_sections = value;
      await this.plugin.saveSettings(true);
    }));
    containerEl.createEl("h3", {
      text: "Test File Writing"
    });
    containerEl.createEl("h3", {
      text: "Manual Save"
    });
    let manual_save_results = containerEl.createEl("div");
    new Obsidian.Setting(containerEl).setName("manual_save").setDesc("Save current embeddings").addButton((button) => button.setButtonText("Manual Save").onClick(async () => {
      if (confirm("Are you sure you want to save your current embeddings?")) {
        try {
          await this.plugin.save_embeddings_to_file(true);
          manual_save_results.innerHTML = "Embeddings saved successfully.";
        } catch (e) {
          manual_save_results.innerHTML = "Embeddings failed to save. Error: " + e;
        }
      }
    }));
    containerEl.createEl("h3", {
      text: "Previously failed files"
    });
    let failed_list = containerEl.createEl("div");
    this.draw_failed_files_list(failed_list);
    containerEl.createEl("h3", {
      text: "Force Refresh"
    });
    new Obsidian.Setting(containerEl).setName("force_refresh").setDesc("WARNING: DO NOT use unless you know what you are doing! This will delete all of your current embeddings from OpenAI and trigger reprocessing of your entire vault!").addButton((button) => button.setButtonText("Force Refresh").onClick(async () => {
      if (confirm("Are you sure you want to Force Refresh? By clicking yes you confirm that you understand the consequences of this action.")) {
        await this.plugin.force_refresh_embeddings_file();
      }
    }));
  }
  get_self_ref_list() {
    return "Current: " + SMART_TRANSLATION[this.plugin.settings.language].pronous.join(", ");
  }
  draw_failed_files_list(failed_list) {
    failed_list.empty();
    if (this.plugin.settings.failed_files.length > 0) {
      failed_list.createEl("p", {
        text: "The following files failed to process and will be skipped until manually retried."
      });
      let list = failed_list.createEl("ul");
      for (let failed_file of this.plugin.settings.failed_files) {
        list.createEl("li", {
          text: failed_file
        });
      }
      new Obsidian.Setting(failed_list).setName("retry_failed_files").setDesc("Retry failed files only").addButton((button) => button.setButtonText("Retry failed files only").onClick(async () => {
        failed_list.empty();
        failed_list.createEl("p", {
          text: "Retrying failed files..."
        });
        await this.plugin.retry_failed_files();
        this.draw_failed_files_list(failed_list);
      }));
    } else {
      failed_list.createEl("p", {
        text: "No failed files"
      });
    }
  }
};
function line_is_heading(line) {
  return line.indexOf("#") === 0 && ["#", " "].indexOf(line[1]) !== -1;
}
var SMART_CONNECTIONS_CHAT_VIEW_TYPE = "smart-connections-chat-view";
var SmartConnectionsChatView = class extends Obsidian.ItemView {
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
    this.plugin.get_all_folders();
  }
  onClose() {
    this.chat.save_chat();
    this.app.workspace.unregisterHoverLinkSource(SMART_CONNECTIONS_CHAT_VIEW_TYPE);
  }
  render_chat() {
    this.containerEl.empty();
    this.chat_container = this.containerEl.createDiv("sc-chat-container");
    this.render_top_bar();
    this.render_chat_box();
    this.render_chat_input();
    this.plugin.render_brand(this.containerEl, "chat");
  }
  // render plus sign for clear button
  render_top_bar() {
    let top_bar_container = this.chat_container.createDiv("sc-top-bar-container");
    let chat_name = this.chat.name();
    let chat_name_input = top_bar_container.createEl("input", {
      attr: {
        type: "text",
        value: chat_name
      },
      cls: "sc-chat-name-input"
    });
    chat_name_input.addEventListener("change", this.rename_chat.bind(this));
    let smart_view_btn = this.create_top_bar_button(top_bar_container, "Smart View", "smart-connections");
    smart_view_btn.addEventListener("click", this.open_smart_view.bind(this));
    let save_btn = this.create_top_bar_button(top_bar_container, "Save Chat", "save");
    save_btn.addEventListener("click", this.save_chat.bind(this));
    let history_btn = this.create_top_bar_button(top_bar_container, "Chat History", "history");
    history_btn.addEventListener("click", this.open_chat_history.bind(this));
    const new_chat_btn = this.create_top_bar_button(top_bar_container, "New Chat", "plus");
    new_chat_btn.addEventListener("click", this.new_chat.bind(this));
  }
  async open_chat_history() {
    const folder = await this.app.vault.adapter.list(".smart-connections/chats");
    this.files = folder.files.map((file) => {
      return file.replace(".smart-connections/chats/", "").replace(".json", "");
    });
    if (!this.modal)
      this.modal = new SmartConnectionsChatHistoryModal(this.app, this);
    this.modal.open();
  }
  create_top_bar_button(top_bar_container, title, icon = null) {
    let btn = top_bar_container.createEl("button", {
      attr: {
        title
      }
    });
    if (icon) {
      Obsidian.setIcon(btn, icon);
    } else {
      btn.innerHTML = title;
    }
    return btn;
  }
  // render new chat
  new_chat() {
    this.clear_chat();
    this.render_chat();
    this.new_messsage_bubble("assistant");
    this.active_elm.innerHTML = "<p>" + SMART_TRANSLATION[this.plugin.settings.language].initial_message + "</p>";
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
    if (this.dotdotdot_interval) {
      clearInterval(this.dotdotdot_interval);
    }
    this.current_chat_ml = [];
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
    this.chat_box = this.chat_container.createDiv("sc-chat-box");
    this.message_container = this.chat_box.createDiv("sc-message-container");
  }
  // open file suggestion modal
  open_file_suggestion_modal() {
    if (!this.file_selector)
      this.file_selector = new SmartConnectionsFileSelectModal(this.app, this);
    this.file_selector.open();
  }
  // open folder suggestion modal
  async open_folder_suggestion_modal() {
    if (!this.folder_selector) {
      this.folder_selector = new SmartConnectionsFolderSelectModal(this.app, this);
    }
    this.folder_selector.open();
  }
  // insert_selection from file suggestion modal
  insert_selection(insert_text) {
    let caret_pos = this.textarea.selectionStart;
    let text_before = this.textarea.value.substring(0, caret_pos);
    let text_after = this.textarea.value.substring(caret_pos, this.textarea.value.length);
    this.textarea.value = text_before + insert_text + text_after;
    this.textarea.selectionStart = caret_pos + insert_text.length;
    this.textarea.selectionEnd = caret_pos + insert_text.length;
    this.textarea.focus();
  }
  // render chat textarea and button
  render_chat_input() {
    let chat_input = this.chat_container.createDiv("sc-chat-form");
    this.textarea = chat_input.createEl("textarea", {
      cls: "sc-chat-input",
      attr: {
        placeholder: `Try "Based on my notes" or "Summarize [[this note]]" or "Important tasks in /folder/"`
      }
    });
    chat_input.addEventListener("keyup", (e) => {
      if (["[", "/"].indexOf(e.key) === -1)
        return;
      const caret_pos = this.textarea.selectionStart;
      if (e.key === "[") {
        if (this.textarea.value[caret_pos - 2] === "[") {
          this.open_file_suggestion_modal();
          return;
        }
      } else {
        this.brackets_ct = 0;
      }
      if (e.key === "/") {
        if (this.textarea.value.length === 1 || this.textarea.value[caret_pos - 2] === " ") {
          this.open_folder_suggestion_modal();
          return;
        }
      }
    });
    chat_input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && e.shiftKey) {
        e.preventDefault();
        if (this.prevent_input) {
          console.log("wait until current response is finished");
          new Obsidian.Notice("[Smart Connections] Wait until current response is finished");
          return;
        }
        let user_input = this.textarea.value;
        this.textarea.value = "";
        this.initialize_response(user_input);
      }
      this.textarea.style.height = "auto";
      this.textarea.style.height = this.textarea.scrollHeight + "px";
    });
    let button_container = chat_input.createDiv("sc-button-container");
    let abort_button = button_container.createEl("span", { attr: { id: "sc-abort-button", style: "display: none;" } });
    Obsidian.setIcon(abort_button, "square");
    abort_button.addEventListener("click", () => {
      this.end_stream();
    });
    let button = button_container.createEl("button", { attr: { id: "sc-send-button" }, cls: "send-button" });
    button.innerHTML = "Send";
    button.addEventListener("click", () => {
      if (this.prevent_input) {
        console.log("wait until current response is finished");
        new Obsidian.Notice("Wait until current response is finished");
        return;
      }
      let user_input = this.textarea.value;
      this.textarea.value = "";
      this.initialize_response(user_input);
    });
  }
  async initialize_response(user_input) {
    this.set_streaming_ux();
    await this.render_message(user_input, "user");
    this.chat.new_message_in_thread({
      role: "user",
      content: user_input
    });
    await this.render_dotdotdot();
    if (this.chat.contains_internal_link(user_input)) {
      this.chat.get_response_with_note_context(user_input, this);
      return;
    }
    if (this.contains_self_referential_keywords(user_input) || this.chat.contains_folder_reference(user_input)) {
      const context = await this.get_context_hyde(user_input);
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
      this.request_chatgpt_completion({ messages: chatml, temperature: 0 });
      return;
    }
    this.request_chatgpt_completion();
  }
  async render_dotdotdot() {
    if (this.dotdotdot_interval)
      clearInterval(this.dotdotdot_interval);
    await this.render_message("...", "assistant");
    let dots = 0;
    this.active_elm.innerHTML = "...";
    this.dotdotdot_interval = setInterval(() => {
      dots++;
      if (dots > 3)
        dots = 1;
      this.active_elm.innerHTML = ".".repeat(dots);
    }, 500);
  }
  set_streaming_ux() {
    this.prevent_input = true;
    if (document.getElementById("sc-send-button"))
      document.getElementById("sc-send-button").style.display = "none";
    if (document.getElementById("sc-abort-button"))
      document.getElementById("sc-abort-button").style.display = "block";
  }
  unset_streaming_ux() {
    this.prevent_input = false;
    if (document.getElementById("sc-send-button"))
      document.getElementById("sc-send-button").style.display = "";
    if (document.getElementById("sc-abort-button"))
      document.getElementById("sc-abort-button").style.display = "none";
  }
  // check if includes keywords referring to one's own notes
  contains_self_referential_keywords(user_input) {
    const matches = user_input.match(this.plugin.self_ref_kw_regex);
    if (matches)
      return true;
    return false;
  }
  // render message
  async render_message(message, from = "assistant", append_last = false) {
    if (this.dotdotdot_interval) {
      clearInterval(this.dotdotdot_interval);
      this.dotdotdot_interval = null;
      this.active_elm.innerHTML = "";
    }
    if (append_last) {
      this.current_message_raw += message;
      if (message.indexOf("\n") === -1) {
        this.active_elm.innerHTML += message;
      } else {
        this.active_elm.innerHTML = "";
        await Obsidian.MarkdownRenderer.renderMarkdown(this.current_message_raw, this.active_elm, "?no-dataview", new Obsidian.Component());
      }
    } else {
      this.current_message_raw = "";
      if (this.chat.thread.length === 0 || this.last_from !== from) {
        this.new_messsage_bubble(from);
      }
      this.active_elm.innerHTML = "";
      await Obsidian.MarkdownRenderer.renderMarkdown(message, this.active_elm, "?no-dataview", new Obsidian.Component());
      this.handle_links_in_message();
      this.render_message_action_buttons(message);
    }
    this.message_container.scrollTop = this.message_container.scrollHeight;
  }
  render_message_action_buttons(message) {
    if (this.chat.context && this.chat.hyd) {
      const context_view = this.active_elm.createEl("span", {
        cls: "sc-msg-button",
        attr: {
          title: "Copy context to clipboard"
          /* tooltip */
        }
      });
      const this_hyd = this.chat.hyd;
      Obsidian.setIcon(context_view, "eye");
      context_view.addEventListener("click", () => {
        navigator.clipboard.writeText("```smart-connections\n" + this_hyd + "\n```\n");
        new Obsidian.Notice("[Smart Connections] Context code block copied to clipboard");
      });
    }
    if (this.chat.context) {
      const copy_prompt_button = this.active_elm.createEl("span", {
        cls: "sc-msg-button",
        attr: {
          title: "Copy prompt to clipboard"
          /* tooltip */
        }
      });
      const this_context = this.chat.context.replace(/\`\`\`/g, "	```").trimLeft();
      Obsidian.setIcon(copy_prompt_button, "files");
      copy_prompt_button.addEventListener("click", () => {
        navigator.clipboard.writeText("```prompt-context\n" + this_context + "\n```\n");
        new Obsidian.Notice("[Smart Connections] Context copied to clipboard");
      });
    }
    const copy_button = this.active_elm.createEl("span", {
      cls: "sc-msg-button",
      attr: {
        title: "Copy message to clipboard"
        /* tooltip */
      }
    });
    Obsidian.setIcon(copy_button, "copy");
    copy_button.addEventListener("click", () => {
      navigator.clipboard.writeText(message.trimLeft());
      new Obsidian.Notice("[Smart Connections] Message copied to clipboard");
    });
  }
  handle_links_in_message() {
    const links = this.active_elm.querySelectorAll("a");
    if (links.length > 0) {
      for (let i = 0; i < links.length; i++) {
        const link = links[i];
        const link_text = link.getAttribute("data-href");
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
        link.addEventListener("click", (event) => {
          const link_tfile = this.app.metadataCache.getFirstLinkpathDest(link_text, "/");
          const mod = Obsidian.Keymap.isModEvent(event);
          let leaf = this.app.workspace.getLeaf(mod);
          leaf.openFile(link_tfile);
        });
      }
    }
  }
  new_messsage_bubble(from) {
    let message_el = this.message_container.createDiv(`sc-message ${from}`);
    this.active_elm = message_el.createDiv("sc-message-content");
    this.last_from = from;
  }
  async request_chatgpt_completion(opts = {}) {
    const chat_ml = opts.messages || opts.chat_ml || this.chat.prepare_chat_ml();
    console.log("chat_ml", chat_ml);
    const max_total_tokens = Math.round(get_max_chars(this.plugin.settings.smart_chat_model) / 4);
    console.log("max_total_tokens", max_total_tokens);
    const curr_token_est = Math.round(JSON.stringify(chat_ml).length / 3);
    console.log("curr_token_est", curr_token_est);
    let max_available_tokens = max_total_tokens - curr_token_est;
    if (max_available_tokens < 0)
      max_available_tokens = 200;
    else if (max_available_tokens > 4096)
      max_available_tokens = 4096;
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
    };
    if (opts.stream) {
      const full_str = await new Promise((resolve, reject) => {
        try {
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
      await this.render_message(full_str, "assistant");
      this.chat.new_message_in_thread({
        role: "assistant",
        content: full_str
      });
      return;
    } else {
      try {
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
        return JSON.parse(response.text).choices[0].message.content;
      } catch (err) {
        new Obsidian.Notice(`Smart Connections API Error :: ${err}`);
      }
    }
  }
  end_stream() {
    if (this.active_stream) {
      this.active_stream.close();
      this.active_stream = null;
    }
    this.unset_streaming_ux();
    if (this.dotdotdot_interval) {
      clearInterval(this.dotdotdot_interval);
      this.dotdotdot_interval = null;
      this.active_elm.parentElement.remove();
      this.active_elm = null;
    }
  }
  async get_context_hyde(user_input) {
    this.chat.reset_context();
    const hyd_input = `Anticipate what the user is seeking. Respond in the form of a hypothetical note written by the user. The note may contain statements as paragraphs, lists, or checklists in markdown format with no headings. Please respond with one hypothetical note and abstain from any other commentary. Use the format: PARENT FOLDER NAME > CHILD FOLDER NAME > FILE NAME > HEADING 1 > HEADING 2 > HEADING 3: HYPOTHETICAL NOTE CONTENTS.`;
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
      max_tokens: 137
    });
    this.chat.hyd = hyd;
    let filter = {};
    if (this.chat.contains_folder_reference(user_input)) {
      const folder_refs = this.chat.get_folder_references(user_input);
      if (folder_refs) {
        filter = {
          path_begins_with: folder_refs
        };
      }
    }
    let nearest = await this.plugin.api.search(hyd, filter);
    console.log("nearest", nearest.length);
    nearest = this.get_nearest_until_next_dev_exceeds_std_dev(nearest);
    console.log("nearest after std dev slice", nearest.length);
    nearest = this.sort_by_len_adjusted_similarity(nearest);
    return await this.get_context_for_prompt(nearest);
  }
  sort_by_len_adjusted_similarity(nearest) {
    nearest = nearest.sort((a, b) => {
      const a_score = a.similarity / a.len;
      const b_score = b.similarity / b.len;
      if (a_score > b_score)
        return -1;
      if (a_score < b_score)
        return 1;
      return 0;
    });
    return nearest;
  }
  get_nearest_until_next_dev_exceeds_std_dev(nearest) {
    const sim = nearest.map((n) => n.similarity);
    const mean = sim.reduce((a, b) => a + b) / sim.length;
    let std_dev = Math.sqrt(sim.map((x) => Math.pow(x - mean, 2)).reduce((a, b) => a + b) / sim.length);
    let slice_i = 0;
    while (slice_i < nearest.length) {
      const next = nearest[slice_i + 1];
      if (next) {
        const next_dev = Math.abs(next.similarity - nearest[slice_i].similarity);
        if (next_dev > std_dev) {
          if (slice_i < 3)
            std_dev = std_dev * 1.5;
          else
            break;
        }
      }
      slice_i++;
    }
    nearest = nearest.slice(0, slice_i + 1);
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
    const MAX_SOURCES = this.plugin.settings.smart_chat_model === "gpt-4-1106-preview" ? 42 : 20;
    const MAX_CHARS = get_max_chars(this.plugin.settings.smart_chat_model) / 2;
    let char_accum = 0;
    for (let i = 0; i < nearest.length; i++) {
      if (context.length >= MAX_SOURCES)
        break;
      if (char_accum >= MAX_CHARS)
        break;
      if (typeof nearest[i].link !== "string")
        continue;
      const breadcrumbs = nearest[i].link.replace(/#/g, " > ").replace(".md", "").replace(/\//g, " > ");
      let new_context = `${breadcrumbs}:
`;
      const max_available_chars = MAX_CHARS - char_accum - new_context.length;
      if (nearest[i].link.indexOf("#") !== -1) {
        new_context += await this.plugin.block_retriever(nearest[i].link, { max_chars: max_available_chars });
      } else {
        new_context += await this.plugin.file_retriever(nearest[i].link, { max_chars: max_available_chars });
      }
      char_accum += new_context.length;
      context.push({
        link: nearest[i].link,
        text: new_context
      });
    }
    console.log("context sources: " + context.length);
    console.log("total context tokens: ~" + Math.round(char_accum / 3.5));
    this.chat.context = `Anticipate the type of answer desired by the user. Imagine the following ${context.length} notes were written by the user and contain all the necessary information to answer the user's question. Begin responses with "${SMART_TRANSLATION[this.plugin.settings.language].prompt}..."`;
    for (let i = 0; i < context.length; i++) {
      this.chat.context += `
---BEGIN #${i + 1}---
${context[i].text}
---END #${i + 1}---`;
    }
    return this.chat.context;
  }
};
function get_max_chars(model = "gpt-3.5-turbo") {
  const MAX_CHAR_MAP = {
    "gpt-3.5-turbo-16k": 48e3,
    "gpt-4": 24e3,
    "gpt-3.5-turbo": 12e3,
    "gpt-4-1106-preview": 2e5
  };
  return MAX_CHAR_MAP[model];
}
var SmartConnectionsChatModel = class {
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
    if (this.thread.length === 0)
      return;
    if (!await this.app.vault.adapter.exists(".smart-connections/chats")) {
      await this.app.vault.adapter.mkdir(".smart-connections/chats");
    }
    if (!this.chat_id) {
      this.chat_id = this.name() + "\u2014" + this.get_file_date_string();
    }
    if (!this.chat_id.match(/^[a-zA-Z0-9_—\- ]+$/)) {
      console.log("Invalid chat_id: " + this.chat_id);
      new Obsidian.Notice("[Smart Connections] Failed to save chat. Invalid chat_id: '" + this.chat_id + "'");
    }
    const chat_file = this.chat_id + ".json";
    this.app.vault.adapter.write(
      ".smart-connections/chats/" + chat_file,
      JSON.stringify(this.thread, null, 2)
    );
  }
  async load_chat(chat_id) {
    this.chat_id = chat_id;
    const chat_file = this.chat_id + ".json";
    let chat_json = await this.app.vault.adapter.read(
      ".smart-connections/chats/" + chat_file
    );
    this.thread = JSON.parse(chat_json);
    this.chat_ml = this.prepare_chat_ml();
  }
  // prepare chat_ml from chat
  // gets the last message of each turn unless turn_variation_offsets=[[turn_index,variation_index]] is specified in offset
  prepare_chat_ml(turn_variation_offsets = []) {
    if (turn_variation_offsets.length === 0) {
      this.chat_ml = this.thread.map((turn) => {
        return turn[turn.length - 1];
      });
    } else {
      let turn_variation_index = [];
      for (let i = 0; i < turn_variation_offsets.length; i++) {
        turn_variation_index[turn_variation_offsets[i][0]] = turn_variation_offsets[i][1];
      }
      this.chat_ml = this.thread.map((turn, turn_index) => {
        if (turn_variation_index[turn_index] !== void 0) {
          return turn[turn_variation_index[turn_index]];
        }
        return turn[turn.length - 1];
      });
    }
    this.chat_ml = this.chat_ml.map((message) => {
      return {
        role: message.role,
        content: message.content
      };
    });
    return this.chat_ml;
  }
  last() {
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
  new_message_in_thread(message, turn = -1) {
    if (this.context) {
      message.context = this.context;
      this.context = null;
    }
    if (this.hyd) {
      message.hyd = this.hyd;
      this.hyd = null;
    }
    if (turn === -1) {
      this.thread.push([message]);
    } else {
      this.thread[turn].push(message);
    }
  }
  reset_context() {
    this.context = null;
    this.hyd = null;
  }
  async rename_chat(new_name) {
    if (this.chat_id && await this.app.vault.adapter.exists(".smart-connections/chats/" + this.chat_id + ".json")) {
      new_name = this.chat_id.replace(this.name(), new_name);
      await this.app.vault.adapter.rename(
        ".smart-connections/chats/" + this.chat_id + ".json",
        ".smart-connections/chats/" + new_name + ".json"
      );
      this.chat_id = new_name;
    } else {
      this.chat_id = new_name + "\u2014" + this.get_file_date_string();
      await this.save_chat();
    }
  }
  name() {
    if (this.chat_id) {
      return this.chat_id.replace(/—[^—]*$/, "");
    }
    return "UNTITLED";
  }
  get_file_date_string() {
    return (/* @__PURE__ */ new Date()).toISOString().replace(/(T|:|\..*)/g, " ").trim();
  }
  // get response from with note context
  async get_response_with_note_context(user_input, chat_view) {
    let system_input = "Imagine the following notes were written by the user and contain the necessary information to synthesize a useful answer the user's query:\n";
    const notes = this.extract_internal_links(user_input);
    let max_chars = get_max_chars(this.plugin.settings.smart_chat_model);
    for (let i = 0; i < notes.length; i++) {
      const this_max_chars = notes.length - i > 1 ? Math.floor(max_chars / (notes.length - i)) : max_chars;
      const note_content = await this.get_note_contents(notes[i], { char_limit: this_max_chars });
      system_input += `---BEGIN NOTE: [[${notes[i].basename}]]---
`;
      system_input += note_content;
      system_input += `---END NOTE---
`;
      max_chars -= note_content.length;
      if (max_chars <= 0)
        break;
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
    chat_view.request_chatgpt_completion({ messages: chatml, temperature: 0 });
  }
  // check if contains internal link
  contains_internal_link(user_input) {
    if (user_input.indexOf("[[") === -1)
      return false;
    if (user_input.indexOf("]]") === -1)
      return false;
    return true;
  }
  // check if contains folder reference (ex. /folder/, or /folder/subfolder/)
  contains_folder_reference(user_input) {
    if (user_input.indexOf("/") === -1)
      return false;
    if (user_input.indexOf("/") === user_input.lastIndexOf("/"))
      return false;
    return true;
  }
  // get folder references from user input
  get_folder_references(user_input) {
    const folders = this.plugin.folders.slice();
    const matches = folders.sort((a, b) => b.length - a.length).map((folder) => {
      if (user_input.indexOf(folder) !== -1) {
        user_input = user_input.replace(folder, "");
        return folder;
      }
      return false;
    }).filter((folder) => folder);
    console.log(matches);
    if (matches)
      return matches;
    return false;
  }
  // extract internal links
  extract_internal_links(user_input) {
    const matches = user_input.match(/\[\[(.*?)\]\]/g);
    console.log(matches);
    if (matches)
      return matches.map((match) => {
        return this.app.metadataCache.getFirstLinkpathDest(match.replace("[[", "").replace("]]", ""), "/");
      });
    return [];
  }
  // get context from internal links
  async get_note_contents(note, opts = {}) {
    opts = {
      char_limit: 1e4,
      ...opts
    };
    if (!(note instanceof Obsidian.TFile))
      return "";
    let file_content = await this.app.vault.cachedRead(note);
    if (file_content.indexOf("```dataview") > -1) {
      file_content = await this.render_dataview_queries(file_content, note.path, opts);
    }
    file_content = file_content.substring(0, opts.char_limit);
    return file_content;
  }
  async render_dataview_queries(file_content, note_path, opts = {}) {
    opts = {
      char_limit: null,
      ...opts
    };
    const dataview_api = window["DataviewAPI"];
    if (!dataview_api)
      return file_content;
    const dataview_code_blocks = file_content.match(/```dataview(.*?)```/gs);
    for (let i = 0; i < dataview_code_blocks.length; i++) {
      if (opts.char_limit && opts.char_limit < file_content.indexOf(dataview_code_blocks[i]))
        break;
      const dataview_code_block = dataview_code_blocks[i];
      const dataview_code_block_content = dataview_code_block.replace("```dataview", "").replace("```", "");
      const dataview_query_result = await dataview_api.queryMarkdown(dataview_code_block_content, note_path, null);
      if (dataview_query_result.successful) {
        file_content = file_content.replace(dataview_code_block, dataview_query_result.value);
      }
    }
    return file_content;
  }
};
var SmartConnectionsChatHistoryModal = class extends Obsidian.FuzzySuggestModal {
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
    if (item.indexOf("UNTITLED") === -1) {
      item.replace(/—[^—]*$/, "");
    }
    return item;
  }
  onChooseItem(session) {
    this.view.open_chat(session);
  }
};
var SmartConnectionsFileSelectModal = class extends Obsidian.FuzzySuggestModal {
  constructor(app, view) {
    super(app);
    this.app = app;
    this.view = view;
    this.setPlaceholder("Type the name of a file...");
  }
  getItems() {
    return this.app.vault.getMarkdownFiles().sort((a, b) => a.basename.localeCompare(b.basename));
  }
  getItemText(item) {
    return item.basename;
  }
  onChooseItem(file) {
    this.view.insert_selection(file.basename + "]] ");
  }
};
var SmartConnectionsFolderSelectModal = class extends Obsidian.FuzzySuggestModal {
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
};
var ScStreamer = class {
  // constructor
  constructor(url, options) {
    options = options || {};
    this.url = url;
    this.method = options.method || "GET";
    this.headers = options.headers || {};
    this.payload = options.payload || null;
    this.withCredentials = options.withCredentials || false;
    this.listeners = {};
    this.readyState = this.CONNECTING;
    this.progress = 0;
    this.chunk = "";
    this.xhr = null;
    this.FIELD_SEPARATOR = ":";
    this.INITIALIZING = -1;
    this.CONNECTING = 0;
    this.OPEN = 1;
    this.CLOSED = 2;
  }
  // addEventListener
  addEventListener(type, listener) {
    if (!this.listeners[type]) {
      this.listeners[type] = [];
    }
    if (this.listeners[type].indexOf(listener) === -1) {
      this.listeners[type].push(listener);
    }
  }
  // removeEventListener
  removeEventListener(type, listener) {
    if (!this.listeners[type]) {
      return;
    }
    let filtered = [];
    for (let i = 0; i < this.listeners[type].length; i++) {
      if (this.listeners[type][i] !== listener) {
        filtered.push(this.listeners[type][i]);
      }
    }
    if (this.listeners[type].length === 0) {
      delete this.listeners[type];
    } else {
      this.listeners[type] = filtered;
    }
  }
  // dispatchEvent
  dispatchEvent(event) {
    if (!event) {
      return true;
    }
    event.source = this;
    let onHandler = "on" + event.type;
    if (this.hasOwnProperty(onHandler)) {
      this[onHandler].call(this, event);
      if (event.defaultPrevented) {
        return false;
      }
    }
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
    let event = new CustomEvent("readyStateChange");
    event.readyState = state;
    this.readyState = state;
    this.dispatchEvent(event);
  }
  // _onStreamFailure
  _onStreamFailure(e) {
    let event = new CustomEvent("error");
    event.data = e.currentTarget.response;
    this.dispatchEvent(event);
    this.close();
  }
  // _onStreamAbort
  _onStreamAbort(e) {
    let event = new CustomEvent("abort");
    this.close();
  }
  // _onStreamProgress
  _onStreamProgress(e) {
    if (!this.xhr) {
      return;
    }
    if (this.xhr.status !== 200) {
      this._onStreamFailure(e);
      return;
    }
    if (this.readyState === this.CONNECTING) {
      this.dispatchEvent(new CustomEvent("open"));
      this._setReadyState(this.OPEN);
    }
    let data = this.xhr.responseText.substring(this.progress);
    this.progress += data.length;
    data.split(/(\r\n|\r|\n){2}/g).forEach(function(part) {
      if (part.trim().length === 0) {
        this.dispatchEvent(this._parseEventChunk(this.chunk.trim()));
        this.chunk = "";
      } else {
        this.chunk += part;
      }
    }.bind(this));
  }
  // _onStreamLoaded
  _onStreamLoaded(e) {
    this._onStreamProgress(e);
    this.dispatchEvent(this._parseEventChunk(this.chunk));
    this.chunk = "";
  }
  // _parseEventChunk
  _parseEventChunk(chunk) {
    if (!chunk || chunk.length === 0) {
      return null;
    }
    let e = { id: null, retry: null, data: "", event: "message" };
    chunk.split(/(\r\n|\r|\n)/).forEach(function(line) {
      line = line.trimRight();
      let index = line.indexOf(this.FIELD_SEPARATOR);
      if (index <= 0) {
        return;
      }
      let field = line.substring(0, index);
      if (!(field in e)) {
        return;
      }
      let value = line.substring(index + 1).trimLeft();
      if (field === "data") {
        e[field] += value;
      } else {
        e[field] = value;
      }
    }.bind(this));
    let event = new CustomEvent(e.event);
    event.data = e.data;
    event.id = e.id;
    return event;
  }
  // _checkStreamClosed
  _checkStreamClosed() {
    if (!this.xhr) {
      return;
    }
    if (this.xhr.readyState === XMLHttpRequest.DONE) {
      this._setReadyState(this.CLOSED);
    }
  }
  // stream
  stream() {
    this._setReadyState(this.CONNECTING);
    this.xhr = new XMLHttpRequest();
    this.xhr.addEventListener("progress", this._onStreamProgress.bind(this));
    this.xhr.addEventListener("load", this._onStreamLoaded.bind(this));
    this.xhr.addEventListener("readystatechange", this._checkStreamClosed.bind(this));
    this.xhr.addEventListener("error", this._onStreamFailure.bind(this));
    this.xhr.addEventListener("abort", this._onStreamAbort.bind(this));
    this.xhr.open(this.method, this.url);
    for (let header in this.headers) {
      this.xhr.setRequestHeader(header, this.headers[header]);
    }
    this.xhr.withCredentials = this.withCredentials;
    this.xhr.send(this.payload);
  }
  // close
  close() {
    if (this.readyState === this.CLOSED) {
      return;
    }
    this.xhr.abort();
    this.xhr = null;
    this._setReadyState(this.CLOSED);
  }
};
module.exports = SmartConnectionsPlugin;
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vdmVjX2xpdGUvdmVjX2xpdGUuanMiLCAiLi4vc3JjL2luZGV4LmpzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJjbGFzcyBWZWNMaXRlIHtcbiAgY29uc3RydWN0b3IoY29uZmlnKSB7XG4gICAgLy8gc2V0IGRlZmF1bHQgY29uZmlnXG4gICAgdGhpcy5jb25maWcgPSB7XG4gICAgICBmaWxlX25hbWU6IFwiZW1iZWRkaW5ncy0zLmpzb25cIixcbiAgICAgIGZvbGRlcl9wYXRoOiBcIi52ZWNfbGl0ZVwiLFxuICAgICAgZXhpc3RzX2FkYXB0ZXI6IG51bGwsXG4gICAgICBta2Rpcl9hZGFwdGVyOiBudWxsLFxuICAgICAgcmVhZF9hZGFwdGVyOiBudWxsLFxuICAgICAgcmVuYW1lX2FkYXB0ZXI6IG51bGwsXG4gICAgICBzdGF0X2FkYXB0ZXI6IG51bGwsXG4gICAgICB3cml0ZV9hZGFwdGVyOiBudWxsLFxuICAgICAgLi4uY29uZmlnXG4gICAgfTtcbiAgICB0aGlzLmZpbGVfbmFtZSA9IHRoaXMuY29uZmlnLmZpbGVfbmFtZTtcbiAgICB0aGlzLmZvbGRlcl9wYXRoID0gY29uZmlnLmZvbGRlcl9wYXRoO1xuICAgIHRoaXMuZmlsZV9wYXRoID0gdGhpcy5mb2xkZXJfcGF0aCArIFwiL1wiICsgdGhpcy5maWxlX25hbWU7XG4gICAgLy8gZ2V0IGZvbGRlciBwYXRoXG4gICAgdGhpcy5lbWJlZGRpbmdzID0gZmFsc2U7XG4gIH1cbiAgYXN5bmMgZmlsZV9leGlzdHMocGF0aCkge1xuICAgIGlmICh0aGlzLmNvbmZpZy5leGlzdHNfYWRhcHRlcikge1xuICAgICAgcmV0dXJuIGF3YWl0IHRoaXMuY29uZmlnLmV4aXN0c19hZGFwdGVyKHBhdGgpO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyB0b2RvIGhhbmRsZSB3aXRoIGZzXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJleGlzdHNfYWRhcHRlciBub3Qgc2V0XCIpO1xuICAgIH1cbiAgfVxuICBhc3luYyBta2RpcihwYXRoKSB7XG4gICAgaWYgKHRoaXMuY29uZmlnLm1rZGlyX2FkYXB0ZXIpIHtcbiAgICAgIHJldHVybiBhd2FpdCB0aGlzLmNvbmZpZy5ta2Rpcl9hZGFwdGVyKHBhdGgpO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyB0b2RvIGhhbmRsZSB3aXRoIGZzXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJta2Rpcl9hZGFwdGVyIG5vdCBzZXRcIik7XG4gICAgfVxuICB9XG4gIGFzeW5jIHJlYWRfZmlsZShwYXRoKSB7XG4gICAgaWYgKHRoaXMuY29uZmlnLnJlYWRfYWRhcHRlcikge1xuICAgICAgcmV0dXJuIGF3YWl0IHRoaXMuY29uZmlnLnJlYWRfYWRhcHRlcihwYXRoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gdG9kbyBoYW5kbGUgd2l0aCBmc1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFwicmVhZF9hZGFwdGVyIG5vdCBzZXRcIik7XG4gICAgfVxuICB9XG4gIGFzeW5jIHJlbmFtZShvbGRfcGF0aCwgbmV3X3BhdGgpIHtcbiAgICBpZiAodGhpcy5jb25maWcucmVuYW1lX2FkYXB0ZXIpIHtcbiAgICAgIHJldHVybiBhd2FpdCB0aGlzLmNvbmZpZy5yZW5hbWVfYWRhcHRlcihvbGRfcGF0aCwgbmV3X3BhdGgpO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyB0b2RvIGhhbmRsZSB3aXRoIGZzXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJyZW5hbWVfYWRhcHRlciBub3Qgc2V0XCIpO1xuICAgIH1cbiAgfVxuICBhc3luYyBzdGF0KHBhdGgpIHtcbiAgICBpZiAodGhpcy5jb25maWcuc3RhdF9hZGFwdGVyKSB7XG4gICAgICByZXR1cm4gYXdhaXQgdGhpcy5jb25maWcuc3RhdF9hZGFwdGVyKHBhdGgpO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyB0b2RvIGhhbmRsZSB3aXRoIGZzXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJzdGF0X2FkYXB0ZXIgbm90IHNldFwiKTtcbiAgICB9XG4gIH1cbiAgYXN5bmMgd3JpdGVfZmlsZShwYXRoLCBkYXRhKSB7XG4gICAgaWYgKHRoaXMuY29uZmlnLndyaXRlX2FkYXB0ZXIpIHtcbiAgICAgIHJldHVybiBhd2FpdCB0aGlzLmNvbmZpZy53cml0ZV9hZGFwdGVyKHBhdGgsIGRhdGEpO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyB0b2RvIGhhbmRsZSB3aXRoIGZzXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJ3cml0ZV9hZGFwdGVyIG5vdCBzZXRcIik7XG4gICAgfVxuICB9XG4gIGFzeW5jIGxvYWQocmV0cmllcyA9IDApIHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgZW1iZWRkaW5nc19maWxlID0gYXdhaXQgdGhpcy5yZWFkX2ZpbGUodGhpcy5maWxlX3BhdGgpO1xuICAgICAgLy8gbG9hZGVkIGVtYmVkZGluZ3MgZnJvbSBmaWxlXG4gICAgICB0aGlzLmVtYmVkZGluZ3MgPSBKU09OLnBhcnNlKGVtYmVkZGluZ3NfZmlsZSk7XG4gICAgICBjb25zb2xlLmxvZyhcImxvYWRlZCBlbWJlZGRpbmdzIGZpbGU6IFwiK3RoaXMuZmlsZV9wYXRoKTtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAvLyByZXRyeSBpZiBlcnJvciB1cCB0byAzIHRpbWVzXG4gICAgICBpZiAocmV0cmllcyA8IDMpIHtcbiAgICAgICAgY29uc29sZS5sb2coXCJyZXRyeWluZyBsb2FkKClcIik7XG4gICAgICAgIC8vIGluY3JlYXNlIHdhaXQgdGltZSBiZXR3ZWVuIHJldHJpZXNcbiAgICAgICAgYXdhaXQgbmV3IFByb21pc2UociA9PiBzZXRUaW1lb3V0KHIsIDEwMDAgKyAoMTAwMCAqIHJldHJpZXMpKSk7XG4gICAgICAgIHJldHVybiBhd2FpdCB0aGlzLmxvYWQocmV0cmllcyArIDEpO1xuICAgICAgfSBlbHNlIGlmIChyZXRyaWVzID09PSAzKSB7XG4gICAgICAgIC8vIGNoZWNrIGZvciBlbWJlZGRpbmdzLTIuanNvbiBmaWxlXG4gICAgICAgIGNvbnN0IGVtYmVkZGluZ3NfMl9maWxlX3BhdGggPSB0aGlzLmZvbGRlcl9wYXRoICsgXCIvZW1iZWRkaW5ncy0yLmpzb25cIjtcbiAgICAgICAgY29uc3QgZW1iZWRkaW5nc18yX2ZpbGVfZXhpc3RzID0gYXdhaXQgdGhpcy5maWxlX2V4aXN0cyhlbWJlZGRpbmdzXzJfZmlsZV9wYXRoKTtcbiAgICAgICAgaWYgKGVtYmVkZGluZ3NfMl9maWxlX2V4aXN0cykge1xuICAgICAgICAgIGF3YWl0IHRoaXMubWlncmF0ZV9lbWJlZGRpbmdzX3YyX3RvX3YzKCk7XG4gICAgICAgICAgcmV0dXJuIGF3YWl0IHRoaXMubG9hZChyZXRyaWVzICsgMSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGNvbnNvbGUubG9nKFwiZmFpbGVkIHRvIGxvYWQgZW1iZWRkaW5ncyBmaWxlLCBwcm9tcHQgdXNlciB0byBpbml0aWF0ZSBidWxrIGVtYmVkXCIpO1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxuXG4gIGFzeW5jIGluaXRfZW1iZWRkaW5nc19maWxlKCkge1xuICAgIC8vIGNoZWNrIGlmIGZvbGRlciBleGlzdHNcbiAgICBpZiAoIShhd2FpdCB0aGlzLmZpbGVfZXhpc3RzKHRoaXMuZm9sZGVyX3BhdGgpKSkge1xuICAgICAgLy8gY3JlYXRlIGZvbGRlclxuICAgICAgYXdhaXQgdGhpcy5ta2Rpcih0aGlzLmZvbGRlcl9wYXRoKTtcbiAgICAgIGNvbnNvbGUubG9nKFwiY3JlYXRlZCBmb2xkZXI6IFwiK3RoaXMuZm9sZGVyX3BhdGgpO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zb2xlLmxvZyhcImZvbGRlciBhbHJlYWR5IGV4aXN0czogXCIrdGhpcy5mb2xkZXJfcGF0aCk7XG4gICAgfVxuICAgIC8vIGNoZWNrIGlmIGVtYmVkZGluZ3MgZmlsZSBleGlzdHNcbiAgICBpZiAoIShhd2FpdCB0aGlzLmZpbGVfZXhpc3RzKHRoaXMuZmlsZV9wYXRoKSkpIHtcbiAgICAgIC8vIGNyZWF0ZSBlbWJlZGRpbmdzIGZpbGVcbiAgICAgIGF3YWl0IHRoaXMud3JpdGVfZmlsZSh0aGlzLmZpbGVfcGF0aCwgXCJ7fVwiKTtcbiAgICAgIGNvbnNvbGUubG9nKFwiY3JlYXRlZCBlbWJlZGRpbmdzIGZpbGU6IFwiK3RoaXMuZmlsZV9wYXRoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc29sZS5sb2coXCJlbWJlZGRpbmdzIGZpbGUgYWxyZWFkeSBleGlzdHM6IFwiK3RoaXMuZmlsZV9wYXRoKTtcbiAgICB9XG4gIH1cblxuICBhc3luYyBzYXZlKCkge1xuICAgIGNvbnN0IGVtYmVkZGluZ3MgPSBKU09OLnN0cmluZ2lmeSh0aGlzLmVtYmVkZGluZ3MpO1xuICAgIC8vIGNoZWNrIGlmIGVtYmVkZGluZ3MgZmlsZSBleGlzdHNcbiAgICBjb25zdCBlbWJlZGRpbmdzX2ZpbGVfZXhpc3RzID0gYXdhaXQgdGhpcy5maWxlX2V4aXN0cyh0aGlzLmZpbGVfcGF0aCk7XG4gICAgLy8gaWYgZW1iZWRkaW5ncyBmaWxlIGV4aXN0cyB0aGVuIGNoZWNrIGlmIG5ldyBlbWJlZGRpbmdzIGZpbGUgc2l6ZSBpcyBzaWduaWZpY2FudGx5IHNtYWxsZXIgdGhhbiBleGlzdGluZyBlbWJlZGRpbmdzIGZpbGUgc2l6ZVxuICAgIGlmIChlbWJlZGRpbmdzX2ZpbGVfZXhpc3RzKSB7XG4gICAgICAvLyBlc2l0bWF0ZSBmaWxlIHNpemUgb2YgZW1iZWRkaW5nc1xuICAgICAgY29uc3QgbmV3X2ZpbGVfc2l6ZSA9IGVtYmVkZGluZ3MubGVuZ3RoO1xuICAgICAgLy8gZ2V0IGV4aXN0aW5nIGZpbGUgc2l6ZVxuICAgICAgY29uc3QgZXhpc3RpbmdfZmlsZV9zaXplID0gYXdhaXQgdGhpcy5zdGF0KHRoaXMuZmlsZV9wYXRoKS50aGVuKChzdGF0KSA9PiBzdGF0LnNpemUpO1xuICAgICAgLy8gY29uc29sZS5sb2coXCJuZXcgZmlsZSBzaXplOiBcIituZXdfZmlsZV9zaXplKTtcbiAgICAgIC8vIGNvbnNvbGUubG9nKFwiZXhpc3RpbmcgZmlsZSBzaXplOiBcIitleGlzdGluZ19maWxlX3NpemUpO1xuICAgICAgLy8gaWYgbmV3IGZpbGUgc2l6ZSBpcyBhdCBsZWFzdCA1MCUgb2YgZXhpc3RpbmcgZmlsZSBzaXplIHRoZW4gd3JpdGUgZW1iZWRkaW5ncyB0byBmaWxlXG4gICAgICBpZiAobmV3X2ZpbGVfc2l6ZSA+IChleGlzdGluZ19maWxlX3NpemUgKiAwLjUpKSB7XG4gICAgICAgIC8vIHdyaXRlIGVtYmVkZGluZ3MgdG8gZmlsZVxuICAgICAgICBhd2FpdCB0aGlzLndyaXRlX2ZpbGUodGhpcy5maWxlX3BhdGgsIGVtYmVkZGluZ3MpO1xuICAgICAgICBjb25zb2xlLmxvZyhcImVtYmVkZGluZ3MgZmlsZSBzaXplOiBcIiArIG5ld19maWxlX3NpemUgKyBcIiBieXRlc1wiKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIGlmIG5ldyBmaWxlIHNpemUgaXMgc2lnbmlmaWNhbnRseSBzbWFsbGVyIHRoYW4gZXhpc3RpbmcgZmlsZSBzaXplIHRoZW4gdGhyb3cgZXJyb3JcbiAgICAgICAgLy8gc2hvdyB3YXJuaW5nIG1lc3NhZ2UgaW5jbHVkaW5nIGZpbGUgc2l6ZXNcbiAgICAgICAgY29uc3Qgd2FybmluZ19tZXNzYWdlID0gW1xuICAgICAgICAgIFwiV2FybmluZzogTmV3IGVtYmVkZGluZ3MgZmlsZSBzaXplIGlzIHNpZ25pZmljYW50bHkgc21hbGxlciB0aGFuIGV4aXN0aW5nIGVtYmVkZGluZ3MgZmlsZSBzaXplLlwiLFxuICAgICAgICAgIFwiQWJvcnRpbmcgdG8gcHJldmVudCBwb3NzaWJsZSBsb3NzIG9mIGVtYmVkZGluZ3MgZGF0YS5cIixcbiAgICAgICAgICBcIk5ldyBmaWxlIHNpemU6IFwiICsgbmV3X2ZpbGVfc2l6ZSArIFwiIGJ5dGVzLlwiLFxuICAgICAgICAgIFwiRXhpc3RpbmcgZmlsZSBzaXplOiBcIiArIGV4aXN0aW5nX2ZpbGVfc2l6ZSArIFwiIGJ5dGVzLlwiLFxuICAgICAgICAgIFwiUmVzdGFydGluZyBPYnNpZGlhbiBtYXkgZml4IHRoaXMuXCJcbiAgICAgICAgXTtcbiAgICAgICAgY29uc29sZS5sb2cod2FybmluZ19tZXNzYWdlLmpvaW4oXCIgXCIpKTtcbiAgICAgICAgLy8gc2F2ZSBlbWJlZGRpbmdzIHRvIGZpbGUgbmFtZWQgdW5zYXZlZC1lbWJlZGRpbmdzLmpzb25cbiAgICAgICAgYXdhaXQgdGhpcy53cml0ZV9maWxlKHRoaXMuZm9sZGVyX3BhdGgrXCIvdW5zYXZlZC1lbWJlZGRpbmdzLmpzb25cIiwgZW1iZWRkaW5ncyk7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIkVycm9yOiBOZXcgZW1iZWRkaW5ncyBmaWxlIHNpemUgaXMgc2lnbmlmaWNhbnRseSBzbWFsbGVyIHRoYW4gZXhpc3RpbmcgZW1iZWRkaW5ncyBmaWxlIHNpemUuIEFib3J0aW5nIHRvIHByZXZlbnQgcG9zc2libGUgbG9zcyBvZiBlbWJlZGRpbmdzIGRhdGEuXCIpO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBhd2FpdCB0aGlzLmluaXRfZW1iZWRkaW5nc19maWxlKCk7XG4gICAgICByZXR1cm4gYXdhaXQgdGhpcy5zYXZlKCk7XG4gICAgfVxuICAgIHJldHVybiB0cnVlO1xuICB9XG4gIGNvc19zaW0odmVjdG9yMSwgdmVjdG9yMikge1xuICAgIGxldCBkb3RQcm9kdWN0ID0gMDtcbiAgICBsZXQgbm9ybUEgPSAwO1xuICAgIGxldCBub3JtQiA9IDA7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCB2ZWN0b3IxLmxlbmd0aDsgaSsrKSB7XG4gICAgICBkb3RQcm9kdWN0ICs9IHZlY3RvcjFbaV0gKiB2ZWN0b3IyW2ldO1xuICAgICAgbm9ybUEgKz0gdmVjdG9yMVtpXSAqIHZlY3RvcjFbaV07XG4gICAgICBub3JtQiArPSB2ZWN0b3IyW2ldICogdmVjdG9yMltpXTtcbiAgICB9XG4gICAgaWYgKG5vcm1BID09PSAwIHx8IG5vcm1CID09PSAwKSB7XG4gICAgICByZXR1cm4gMDtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIGRvdFByb2R1Y3QgLyAoTWF0aC5zcXJ0KG5vcm1BKSAqIE1hdGguc3FydChub3JtQikpO1xuICAgIH1cbiAgfVxuICBuZWFyZXN0KHRvX3ZlYywgZmlsdGVyID0ge30pIHtcbiAgICBmaWx0ZXIgPSB7XG4gICAgICByZXN1bHRzX2NvdW50OiAzMCxcbiAgICAgIC4uLmZpbHRlclxuICAgIH07XG4gICAgbGV0IG5lYXJlc3QgPSBbXTtcbiAgICBjb25zdCBmcm9tX2tleXMgPSBPYmplY3Qua2V5cyh0aGlzLmVtYmVkZGluZ3MpO1xuICAgIC8vIHRoaXMucmVuZGVyX2xvZy50b3RhbF9lbWJlZGRpbmdzID0gZnJvbV9rZXlzLmxlbmd0aDtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGZyb21fa2V5cy5sZW5ndGg7IGkrKykge1xuICAgICAgLy8gaWYgdGhpcy5zZXR0aW5ncy5za2lwX3NlY3Rpb25zIGlzIHRydWVcbiAgICAgIGlmIChmaWx0ZXIuc2tpcF9zZWN0aW9ucykge1xuICAgICAgICBjb25zdCBmcm9tX3BhdGggPSB0aGlzLmVtYmVkZGluZ3NbZnJvbV9rZXlzW2ldXS5tZXRhLnBhdGg7XG4gICAgICAgIGlmIChmcm9tX3BhdGguaW5kZXhPZihcIiNcIikgPiAtMSkgY29udGludWU7IC8vIHNraXAgaWYgY29udGFpbnMgIyBpbmRpY2F0aW5nIGJsb2NrIChzZWN0aW9uKVxuXG4gICAgICAgIC8vIFRPRE86IGNvbnNpZGVyIHVzaW5nIHByZXNlbmNlIG9mIG1ldGEucGFyZW50IHRvIHNraXAgZmlsZXMgKGZhc3RlciBjaGVja2luZz8pXG4gICAgICB9XG4gICAgICBpZiAoZmlsdGVyLnNraXBfa2V5KSB7XG4gICAgICAgIGlmIChmaWx0ZXIuc2tpcF9rZXkgPT09IGZyb21fa2V5c1tpXSkgY29udGludWU7IC8vIHNraXAgbWF0Y2hpbmcgdG8gY3VycmVudCBub3RlXG4gICAgICAgIGlmIChmaWx0ZXIuc2tpcF9rZXkgPT09IHRoaXMuZW1iZWRkaW5nc1tmcm9tX2tleXNbaV1dLm1ldGEucGFyZW50KSBjb250aW51ZTsgLy8gc2tpcCBpZiBmaWx0ZXIuc2tpcF9rZXkgbWF0Y2hlcyBtZXRhLnBhcmVudFxuICAgICAgfVxuICAgICAgLy8gaWYgZmlsdGVyLnBhdGhfYmVnaW5zX3dpdGggaXMgc2V0IChmb2xkZXIgZmlsdGVyKVxuICAgICAgaWYgKGZpbHRlci5wYXRoX2JlZ2luc193aXRoKSB7XG4gICAgICAgIC8vIGlmIHR5cGUgaXMgc3RyaW5nICYgbWV0YS5wYXRoIGRvZXMgbm90IGJlZ2luIHdpdGggZmlsdGVyLnBhdGhfYmVnaW5zX3dpdGgsIHNraXBcbiAgICAgICAgaWYgKHR5cGVvZiBmaWx0ZXIucGF0aF9iZWdpbnNfd2l0aCA9PT0gXCJzdHJpbmdcIiAmJiAhdGhpcy5lbWJlZGRpbmdzW2Zyb21fa2V5c1tpXV0ubWV0YS5wYXRoLnN0YXJ0c1dpdGgoZmlsdGVyLnBhdGhfYmVnaW5zX3dpdGgpKSBjb250aW51ZTtcbiAgICAgICAgLy8gaWYgdHlwZSBpcyBhcnJheSAmIG1ldGEucGF0aCBkb2VzIG5vdCBiZWdpbiB3aXRoIGFueSBvZiB0aGUgZmlsdGVyLnBhdGhfYmVnaW5zX3dpdGgsIHNraXBcbiAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkoZmlsdGVyLnBhdGhfYmVnaW5zX3dpdGgpICYmICFmaWx0ZXIucGF0aF9iZWdpbnNfd2l0aC5zb21lKChwYXRoKSA9PiB0aGlzLmVtYmVkZGluZ3NbZnJvbV9rZXlzW2ldXS5tZXRhLnBhdGguc3RhcnRzV2l0aChwYXRoKSkpIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBuZWFyZXN0LnB1c2goe1xuICAgICAgICBsaW5rOiB0aGlzLmVtYmVkZGluZ3NbZnJvbV9rZXlzW2ldXS5tZXRhLnBhdGgsXG4gICAgICAgIHNpbWlsYXJpdHk6IHRoaXMuY29zX3NpbSh0b192ZWMsIHRoaXMuZW1iZWRkaW5nc1tmcm9tX2tleXNbaV1dLnZlYyksXG4gICAgICAgIHNpemU6IHRoaXMuZW1iZWRkaW5nc1tmcm9tX2tleXNbaV1dLm1ldGEuc2l6ZSxcbiAgICAgIH0pO1xuICAgIH1cbiAgICAvLyBzb3J0IGFycmF5IGJ5IGNvc2luZSBzaW1pbGFyaXR5XG4gICAgbmVhcmVzdC5zb3J0KGZ1bmN0aW9uIChhLCBiKSB7XG4gICAgICByZXR1cm4gYi5zaW1pbGFyaXR5IC0gYS5zaW1pbGFyaXR5O1xuICAgIH0pO1xuICAgIC8vIGNvbnNvbGUubG9nKG5lYXJlc3QpO1xuICAgIC8vIGxpbWl0IHRvIE4gbmVhcmVzdCBjb25uZWN0aW9uc1xuICAgIG5lYXJlc3QgPSBuZWFyZXN0LnNsaWNlKDAsIGZpbHRlci5yZXN1bHRzX2NvdW50KTtcbiAgICByZXR1cm4gbmVhcmVzdDtcbiAgfVxuICBmaW5kX25lYXJlc3RfZW1iZWRkaW5ncyh0b192ZWMsIGZpbHRlcj17fSkge1xuICAgIGNvbnN0IGRlZmF1bHRfZmlsdGVyID0ge1xuICAgICAgbWF4OiB0aGlzLm1heF9zb3VyY2VzLFxuICAgIH07XG4gICAgZmlsdGVyID0gey4uLmRlZmF1bHRfZmlsdGVyLCAuLi5maWx0ZXJ9O1xuICAgIC8vIGhhbmRsZSBpZiB0b192ZWMgaXMgYW4gYXJyYXkgb2YgdmVjdG9yc1xuICAgIC8vIGxldCBuZWFyZXN0ID0gW107XG4gICAgaWYoQXJyYXkuaXNBcnJheSh0b192ZWMpICYmIHRvX3ZlYy5sZW5ndGggIT09IHRoaXMudmVjX2xlbil7XG4gICAgICB0aGlzLm5lYXJlc3QgPSB7fTtcbiAgICAgIGZvcihsZXQgaSA9IDA7IGkgPCB0b192ZWMubGVuZ3RoOyBpKyspe1xuICAgICAgICAvLyBuZWFyZXN0ID0gbmVhcmVzdC5jb25jYXQodGhpcy5maW5kX25lYXJlc3RfZW1iZWRkaW5ncyh0b192ZWNbaV0sIHtcbiAgICAgICAgLy8gICBtYXg6IE1hdGguZmxvb3IoZmlsdGVyLm1heCAvIHRvX3ZlYy5sZW5ndGgpXG4gICAgICAgIC8vIH0pKTtcbiAgICAgICAgdGhpcy5maW5kX25lYXJlc3RfZW1iZWRkaW5ncyh0b192ZWNbaV0sIHtcbiAgICAgICAgICBtYXg6IE1hdGguZmxvb3IoZmlsdGVyLm1heCAvIHRvX3ZlYy5sZW5ndGgpXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1lbHNle1xuICAgICAgY29uc3QgZnJvbV9rZXlzID0gT2JqZWN0LmtleXModGhpcy5lbWJlZGRpbmdzKTtcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZnJvbV9rZXlzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGlmKHRoaXMudmFsaWRhdGVfdHlwZSh0aGlzLmVtYmVkZGluZ3NbZnJvbV9rZXlzW2ldXSkpIGNvbnRpbnVlO1xuICAgICAgICBjb25zdCBzaW0gPSB0aGlzLmNvbXB1dGVDb3NpbmVTaW1pbGFyaXR5KHRvX3ZlYywgdGhpcy5lbWJlZGRpbmdzW2Zyb21fa2V5c1tpXV0udmVjKTtcbiAgICAgICAgaWYodGhpcy5uZWFyZXN0W2Zyb21fa2V5c1tpXV0peyAvLyBpZiBhbHJlYWR5IGNvbXB1dGVkLCB1c2UgY2FjaGVkIHZhbHVlXG4gICAgICAgICAgdGhpcy5uZWFyZXN0W2Zyb21fa2V5c1tpXV0gKz0gc2ltO1xuICAgICAgICB9ZWxzZXtcbiAgICAgICAgICB0aGlzLm5lYXJlc3RbZnJvbV9rZXlzW2ldXSA9IHNpbTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICAvLyBpbml0aWF0ZSBuZWFyZXN0IGFycmF5XG4gICAgbGV0IG5lYXJlc3QgPSBPYmplY3Qua2V5cyh0aGlzLm5lYXJlc3QpLm1hcChrZXkgPT4ge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAga2V5OiBrZXksXG4gICAgICAgIHNpbWlsYXJpdHk6IHRoaXMubmVhcmVzdFtrZXldLFxuICAgICAgfVxuICAgIH0pO1xuICAgIC8vIHNvcnQgYXJyYXkgYnkgY29zaW5lIHNpbWlsYXJpdHlcbiAgICBuZWFyZXN0ID0gdGhpcy5zb3J0X2J5X3NpbWlsYXJpdHkobmVhcmVzdCk7XG4gICAgbmVhcmVzdCA9IG5lYXJlc3Quc2xpY2UoMCwgZmlsdGVyLm1heCk7XG4gICAgLy8gYWRkIGxpbmsgYW5kIGxlbmd0aCB0byByZW1haW5pbmcgbmVhcmVzdFxuICAgIG5lYXJlc3QgPSBuZWFyZXN0Lm1hcChpdGVtID0+IHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIGxpbms6IHRoaXMuZW1iZWRkaW5nc1tpdGVtLmtleV0ubWV0YS5wYXRoLFxuICAgICAgICBzaW1pbGFyaXR5OiBpdGVtLnNpbWlsYXJpdHksXG4gICAgICAgIGxlbjogdGhpcy5lbWJlZGRpbmdzW2l0ZW0ua2V5XS5tZXRhLmxlbiB8fCB0aGlzLmVtYmVkZGluZ3NbaXRlbS5rZXldLm1ldGEuc2l6ZSxcbiAgICAgIH1cbiAgICB9KTtcbiAgICByZXR1cm4gbmVhcmVzdDtcbiAgfVxuICBzb3J0X2J5X3NpbWlsYXJpdHkobmVhcmVzdCkge1xuICAgIHJldHVybiBuZWFyZXN0LnNvcnQoZnVuY3Rpb24gKGEsIGIpIHtcbiAgICAgIGNvbnN0IGFfc2NvcmUgPSBhLnNpbWlsYXJpdHk7XG4gICAgICBjb25zdCBiX3Njb3JlID0gYi5zaW1pbGFyaXR5O1xuICAgICAgLy8gaWYgYSBpcyBncmVhdGVyIHRoYW4gYiwgcmV0dXJuIC0xXG4gICAgICBpZiAoYV9zY29yZSA+IGJfc2NvcmUpXG4gICAgICAgIHJldHVybiAtMTtcbiAgICAgIC8vIGlmIGEgaXMgbGVzcyB0aGFuIGIsIHJldHVybiAxXG4gICAgICBpZiAoYV9zY29yZSA8IGJfc2NvcmUpXG4gICAgICAgIHJldHVybiAxO1xuICAgICAgLy8gaWYgYSBpcyBlcXVhbCB0byBiLCByZXR1cm4gMFxuICAgICAgcmV0dXJuIDA7XG4gICAgfSk7XG4gIH1cbiAgLy8gY2hlY2sgaWYga2V5IGZyb20gZW1iZWRkaW5ncyBleGlzdHMgaW4gZmlsZXNcbiAgY2xlYW5fdXBfZW1iZWRkaW5ncyhmaWxlcykge1xuICAgIGNvbnNvbGUubG9nKFwiY2xlYW5pbmcgdXAgZW1iZWRkaW5nc1wiKTtcbiAgICBjb25zdCBrZXlzID0gT2JqZWN0LmtleXModGhpcy5lbWJlZGRpbmdzKTtcbiAgICBsZXQgZGVsZXRlZF9lbWJlZGRpbmdzID0gMDtcbiAgICBmb3IgKGNvbnN0IGtleSBvZiBrZXlzKSB7XG4gICAgICAvLyBjb25zb2xlLmxvZyhcImtleTogXCIra2V5KTtcbiAgICAgIGNvbnN0IHBhdGggPSB0aGlzLmVtYmVkZGluZ3Nba2V5XS5tZXRhLnBhdGg7XG4gICAgICAvLyBpZiBubyBrZXkgc3RhcnRzIHdpdGggZmlsZSBwYXRoXG4gICAgICBpZighZmlsZXMuZmluZChmaWxlID0+IHBhdGguc3RhcnRzV2l0aChmaWxlLnBhdGgpKSkge1xuICAgICAgICAvLyBkZWxldGUga2V5IGlmIGl0IGRvZXNuJ3QgZXhpc3RcbiAgICAgICAgZGVsZXRlIHRoaXMuZW1iZWRkaW5nc1trZXldO1xuICAgICAgICBkZWxldGVkX2VtYmVkZGluZ3MrKztcbiAgICAgICAgLy8gY29uc29sZS5sb2coXCJkZWxldGluZyAoZGVsZXRlZCBmaWxlKTogXCIgKyBrZXkpO1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIC8vIGlmIGtleSBjb250YWlucyAnIydcbiAgICAgIGlmKHBhdGguaW5kZXhPZihcIiNcIikgPiAtMSkge1xuICAgICAgICBjb25zdCBwYXJlbnRfa2V5ID0gdGhpcy5lbWJlZGRpbmdzW2tleV0ubWV0YS5wYXJlbnQ7XG4gICAgICAgIC8vIGlmIHBhcmVudF9rZXkgbWlzc2luZyBmcm9tIGVtYmVkZGluZ3MgdGhlbiBkZWxldGUga2V5XG4gICAgICAgIGlmKCF0aGlzLmVtYmVkZGluZ3NbcGFyZW50X2tleV0pe1xuICAgICAgICAgIC8vIGRlbGV0ZSBrZXlcbiAgICAgICAgICBkZWxldGUgdGhpcy5lbWJlZGRpbmdzW2tleV07XG4gICAgICAgICAgZGVsZXRlZF9lbWJlZGRpbmdzKys7XG4gICAgICAgICAgLy8gY29uc29sZS5sb2coXCJkZWxldGluZyAobWlzc2luZyBwYXJlbnQpXCIpO1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICAgIC8vIGlmIHBhcmVudF9rZXkgbWlzc2luZyBtZXRhIHRoZW4gZGVsZXRlIGtleVxuICAgICAgICBpZighdGhpcy5lbWJlZGRpbmdzW3BhcmVudF9rZXldLm1ldGEpe1xuICAgICAgICAgIC8vIGRlbGV0ZSBrZXlcbiAgICAgICAgICBkZWxldGUgdGhpcy5lbWJlZGRpbmdzW2tleV07XG4gICAgICAgICAgZGVsZXRlZF9lbWJlZGRpbmdzKys7XG4gICAgICAgICAgLy8gY29uc29sZS5sb2coXCJkZWxldGluZyAocGFyZW50IG1pc3NpbmcgbWV0YSlcIik7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgICAgLy8gaWYgcGFyZW50X2tleSBtaXNzaW5nIGNoaWxkcmVuIHRoZW4gZGVsZXRlIGtleVxuICAgICAgICAvLyBpZiBwYXJlbnRfa2V5IGNoaWxkcmVuIGRvZXNuJ3QgaW5jbHVkZSBrZXkgdGhlbiBkZWxldGUga2V5XG4gICAgICAgIGlmKHRoaXMuZW1iZWRkaW5nc1twYXJlbnRfa2V5XS5tZXRhLmNoaWxkcmVuICYmICh0aGlzLmVtYmVkZGluZ3NbcGFyZW50X2tleV0ubWV0YS5jaGlsZHJlbi5pbmRleE9mKGtleSkgPCAwKSkge1xuICAgICAgICAgIC8vIGRlbGV0ZSBrZXlcbiAgICAgICAgICBkZWxldGUgdGhpcy5lbWJlZGRpbmdzW2tleV07XG4gICAgICAgICAgZGVsZXRlZF9lbWJlZGRpbmdzKys7XG4gICAgICAgICAgLy8gY29uc29sZS5sb2coXCJkZWxldGluZyAobm90IHByZXNlbnQgaW4gcGFyZW50J3MgY2hpbGRyZW4pXCIpO1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB7ZGVsZXRlZF9lbWJlZGRpbmdzOiBkZWxldGVkX2VtYmVkZGluZ3MsIHRvdGFsX2VtYmVkZGluZ3M6IGtleXMubGVuZ3RofTtcbiAgfVxuXG4gIGdldChrZXkpIHtcbiAgICByZXR1cm4gdGhpcy5lbWJlZGRpbmdzW2tleV0gfHwgbnVsbDtcbiAgfVxuICBnZXRfbWV0YShrZXkpIHtcbiAgICBjb25zdCBlbWJlZGRpbmcgPSB0aGlzLmdldChrZXkpO1xuICAgIGlmKGVtYmVkZGluZyAmJiBlbWJlZGRpbmcubWV0YSkge1xuICAgICAgcmV0dXJuIGVtYmVkZGluZy5tZXRhO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICBnZXRfbXRpbWUoa2V5KSB7XG4gICAgY29uc3QgbWV0YSA9IHRoaXMuZ2V0X21ldGEoa2V5KTtcbiAgICBpZihtZXRhICYmIG1ldGEubXRpbWUpIHtcbiAgICAgIHJldHVybiBtZXRhLm10aW1lO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICBnZXRfaGFzaChrZXkpIHtcbiAgICBjb25zdCBtZXRhID0gdGhpcy5nZXRfbWV0YShrZXkpO1xuICAgIGlmKG1ldGEgJiYgbWV0YS5oYXNoKSB7XG4gICAgICByZXR1cm4gbWV0YS5oYXNoO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICBnZXRfc2l6ZShrZXkpIHtcbiAgICBjb25zdCBtZXRhID0gdGhpcy5nZXRfbWV0YShrZXkpO1xuICAgIGlmKG1ldGEgJiYgbWV0YS5zaXplKSB7XG4gICAgICByZXR1cm4gbWV0YS5zaXplO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICBnZXRfY2hpbGRyZW4oa2V5KSB7XG4gICAgY29uc3QgbWV0YSA9IHRoaXMuZ2V0X21ldGEoa2V5KTtcbiAgICBpZihtZXRhICYmIG1ldGEuY2hpbGRyZW4pIHtcbiAgICAgIHJldHVybiBtZXRhLmNoaWxkcmVuO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICBnZXRfdmVjKGtleSkge1xuICAgIGNvbnN0IGVtYmVkZGluZyA9IHRoaXMuZ2V0KGtleSk7XG4gICAgaWYoZW1iZWRkaW5nICYmIGVtYmVkZGluZy52ZWMpIHtcbiAgICAgIHJldHVybiBlbWJlZGRpbmcudmVjO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICBzYXZlX2VtYmVkZGluZyhrZXksIHZlYywgbWV0YSkge1xuICAgIHRoaXMuZW1iZWRkaW5nc1trZXldID0ge1xuICAgICAgdmVjOiB2ZWMsXG4gICAgICBtZXRhOiBtZXRhLFxuICAgIH07XG4gIH1cbiAgbXRpbWVfaXNfY3VycmVudChrZXksIHNvdXJjZV9tdGltZSkge1xuICAgIGNvbnN0IG10aW1lID0gdGhpcy5nZXRfbXRpbWUoa2V5KTtcbiAgICBpZihtdGltZSAmJiBtdGltZSA+PSBzb3VyY2VfbXRpbWUpIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBhc3luYyBmb3JjZV9yZWZyZXNoKCkge1xuICAgIHRoaXMuZW1iZWRkaW5ncyA9IG51bGw7XG4gICAgdGhpcy5lbWJlZGRpbmdzID0ge307XG4gICAgLy8gZ2V0IGN1cnJlbnQgZGF0ZXRpbWUgYXMgdW5peCB0aW1lc3RhbXBcbiAgICBsZXQgY3VycmVudF9kYXRldGltZSA9IE1hdGguZmxvb3IoRGF0ZS5ub3coKSAvIDEwMDApO1xuICAgIC8vIHJlbmFtZSBleGlzdGluZyBlbWJlZGRpbmdzIGZpbGUgdG8gdGhpcy5mb2xkZXJfcGF0aC9lbWJlZGRpbmdzLVlZWVktTU0tREQuanNvblxuICAgIGF3YWl0IHRoaXMucmVuYW1lKHRoaXMuZmlsZV9wYXRoLCB0aGlzLmZvbGRlcl9wYXRoICsgXCIvZW1iZWRkaW5ncy1cIiArIGN1cnJlbnRfZGF0ZXRpbWUgKyBcIi5qc29uXCIpO1xuICAgIC8vIGNyZWF0ZSBuZXcgZW1iZWRkaW5ncyBmaWxlXG4gICAgYXdhaXQgdGhpcy5pbml0X2VtYmVkZGluZ3NfZmlsZSgpO1xuICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gVmVjTGl0ZTsiLCAiY29uc3QgT2JzaWRpYW4gPSByZXF1aXJlKFwib2JzaWRpYW5cIik7XG5jb25zdCBWZWNMaXRlID0gcmVxdWlyZShcInZlYy1saXRlXCIpO1xuXG5jb25zdCBERUZBVUxUX1NFVFRJTkdTID0ge1xuICBhcGlfa2V5OiBcIlwiLFxuICBjaGF0X29wZW46IHRydWUsXG4gIGZpbGVfZXhjbHVzaW9uczogXCJcIixcbiAgZm9sZGVyX2V4Y2x1c2lvbnM6IFwiXCIsXG4gIGhlYWRlcl9leGNsdXNpb25zOiBcIlwiLFxuICBwYXRoX29ubHk6IFwiXCIsXG4gIHNob3dfZnVsbF9wYXRoOiBmYWxzZSxcbiAgZXhwYW5kZWRfdmlldzogdHJ1ZSxcbiAgZ3JvdXBfbmVhcmVzdF9ieV9maWxlOiBmYWxzZSxcbiAgbGFuZ3VhZ2U6IFwiZW5cIixcbiAgbG9nX3JlbmRlcjogZmFsc2UsXG4gIGxvZ19yZW5kZXJfZmlsZXM6IGZhbHNlLFxuICByZWNlbnRseV9zZW50X3JldHJ5X25vdGljZTogZmFsc2UsXG4gIHNraXBfc2VjdGlvbnM6IGZhbHNlLFxuICBzbWFydF9jaGF0X21vZGVsOiBcImdwdC0zLjUtdHVyYm8tMTZrXCIsXG4gIHZpZXdfb3BlbjogdHJ1ZSxcbiAgdmVyc2lvbjogXCJcIixcbn07XG5jb25zdCBNQVhfRU1CRURfU1RSSU5HX0xFTkdUSCA9IDI1MDAwO1xuXG5sZXQgVkVSU0lPTjtcbmNvbnN0IFNVUFBPUlRFRF9GSUxFX1RZUEVTID0gW1wibWRcIiwgXCJjYW52YXNcIl07XG5cbi8vY3JlYXRlIG9uZSBvYmplY3Qgd2l0aCBhbGwgdGhlIHRyYW5zbGF0aW9uc1xuLy8gcmVzZWFyY2ggOiBTTUFSVF9UUkFOU0xBVElPTltsYW5ndWFnZV1ba2V5XVxuY29uc3QgU01BUlRfVFJBTlNMQVRJT04gPSB7XG4gIFwiZW5cIjoge1xuICAgIFwicHJvbm91c1wiOiBbXCJteVwiLCBcIklcIiwgXCJtZVwiLCBcIm1pbmVcIiwgXCJvdXJcIiwgXCJvdXJzXCIsIFwidXNcIiwgXCJ3ZVwiXSxcbiAgICBcInByb21wdFwiOiBcIkJhc2VkIG9uIHlvdXIgbm90ZXNcIixcbiAgICBcImluaXRpYWxfbWVzc2FnZVwiOiBcIkhpLCBJJ20gQ2hhdEdQVCB3aXRoIGFjY2VzcyB0byB5b3VyIG5vdGVzIHZpYSBTbWFydCBDb25uZWN0aW9ucy4gQXNrIG1lIGEgcXVlc3Rpb24gYWJvdXQgeW91ciBub3RlcyBhbmQgSSdsbCB0cnkgdG8gYW5zd2VyIGl0LlwiLFxuICB9LFxuICBcImVzXCI6IHtcbiAgICBcInByb25vdXNcIjogW1wibWlcIiwgXCJ5b1wiLCBcIm1cdTAwRURcIiwgXCJ0XHUwMEZBXCJdLFxuICAgIFwicHJvbXB0XCI6IFwiQmFzXHUwMEUxbmRvc2UgZW4gc3VzIG5vdGFzXCIsXG4gICAgXCJpbml0aWFsX21lc3NhZ2VcIjogXCJIb2xhLCBzb3kgQ2hhdEdQVCBjb24gYWNjZXNvIGEgdHVzIGFwdW50ZXMgYSB0cmF2XHUwMEU5cyBkZSBTbWFydCBDb25uZWN0aW9ucy4gSGF6bWUgdW5hIHByZWd1bnRhIHNvYnJlIHR1cyBhcHVudGVzIGUgaW50ZW50YXJcdTAwRTkgcmVzcG9uZGVydGUuXCIsXG4gIH0sXG4gIFwiZnJcIjoge1xuICAgIFwicHJvbm91c1wiOiBbXCJtZVwiLCBcIm1vblwiLCBcIm1hXCIsIFwibWVzXCIsIFwibW9pXCIsIFwibm91c1wiLCBcIm5vdHJlXCIsIFwibm9zXCIsIFwiamVcIiwgXCJqJ1wiLCBcIm0nXCJdLFxuICAgIFwicHJvbXB0XCI6IFwiRCdhcHJcdTAwRThzIHZvcyBub3Rlc1wiLFxuICAgIFwiaW5pdGlhbF9tZXNzYWdlXCI6IFwiQm9uam91ciwgamUgc3VpcyBDaGF0R1BUIGV0IGonYWkgYWNjXHUwMEU4cyBcdTAwRTAgdm9zIG5vdGVzIHZpYSBTbWFydCBDb25uZWN0aW9ucy4gUG9zZXotbW9pIHVuZSBxdWVzdGlvbiBzdXIgdm9zIG5vdGVzIGV0IGonZXNzYWllcmFpIGQneSByXHUwMEU5cG9uZHJlLlwiLFxuICB9LFxuICBcImRlXCI6IHtcbiAgICBcInByb25vdXNcIjogW1wibWVpblwiLCBcIm1laW5lXCIsIFwibWVpbmVuXCIsIFwibWVpbmVyXCIsIFwibWVpbmVzXCIsIFwibWlyXCIsIFwidW5zXCIsIFwidW5zZXJcIiwgXCJ1bnNlcmVuXCIsIFwidW5zZXJlclwiLCBcInVuc2VyZXNcIl0sXG4gICAgXCJwcm9tcHRcIjogXCJCYXNpZXJlbmQgYXVmIElocmVuIE5vdGl6ZW5cIixcbiAgICBcImluaXRpYWxfbWVzc2FnZVwiOiBcIkhhbGxvLCBpY2ggYmluIENoYXRHUFQgdW5kIGhhYmUgXHUwMEZDYmVyIFNtYXJ0IENvbm5lY3Rpb25zIFp1Z2FuZyB6dSBJaHJlbiBOb3RpemVuLiBTdGVsbGVuIFNpZSBtaXIgZWluZSBGcmFnZSB6dSBJaHJlbiBOb3RpemVuIHVuZCBpY2ggd2VyZGUgdmVyc3VjaGVuLCBzaWUgenUgYmVhbnR3b3J0ZW4uXCIsXG4gIH0sXG4gIFwiaXRcIjoge1xuICAgIFwicHJvbm91c1wiOiBbXCJtaW9cIiwgXCJtaWFcIiwgXCJtaWVpXCIsIFwibWllXCIsIFwibm9pXCIsIFwibm9zdHJvXCIsIFwibm9zdHJpXCIsIFwibm9zdHJhXCIsIFwibm9zdHJlXCJdLFxuICAgIFwicHJvbXB0XCI6IFwiU3VsbGEgYmFzZSBkZWdsaSBhcHB1bnRpXCIsXG4gICAgXCJpbml0aWFsX21lc3NhZ2VcIjogXCJDaWFvLCBzb25vIENoYXRHUFQgZSBobyBhY2Nlc3NvIGFpIHR1b2kgYXBwdW50aSB0cmFtaXRlIFNtYXJ0IENvbm5lY3Rpb25zLiBGYXRlbWkgdW5hIGRvbWFuZGEgc3VpIHZvc3RyaSBhcHB1bnRpIGUgY2VyY2hlclx1MDBGMiBkaSByaXNwb25kZXJ2aS5cIixcbiAgfSxcbn1cblxuLy8gcmVxdWlyZSBidWlsdC1pbiBjcnlwdG8gbW9kdWxlXG5jb25zdCBjcnlwdG8gPSByZXF1aXJlKFwiY3J5cHRvXCIpO1xuLy8gbWQ1IGhhc2ggdXNpbmcgYnVpbHQgaW4gY3J5cHRvIG1vZHVsZVxuZnVuY3Rpb24gbWQ1KHN0cikge1xuICByZXR1cm4gY3J5cHRvLmNyZWF0ZUhhc2goXCJtZDVcIikudXBkYXRlKHN0cikuZGlnZXN0KFwiaGV4XCIpO1xufVxuXG5jbGFzcyBTbWFydENvbm5lY3Rpb25zUGx1Z2luIGV4dGVuZHMgT2JzaWRpYW4uUGx1Z2luIHtcbiAgLy8gY29uc3RydWN0b3JcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoLi4uYXJndW1lbnRzKTtcbiAgICB0aGlzLmFwaSA9IG51bGw7XG4gICAgdGhpcy5lbWJlZGRpbmdzX2xvYWRlZCA9IGZhbHNlO1xuICAgIHRoaXMuZmlsZV9leGNsdXNpb25zID0gW107XG4gICAgdGhpcy5mb2xkZXJzID0gW107XG4gICAgdGhpcy5oYXNfbmV3X2VtYmVkZGluZ3MgPSBmYWxzZTtcbiAgICB0aGlzLmhlYWRlcl9leGNsdXNpb25zID0gW107XG4gICAgdGhpcy5uZWFyZXN0X2NhY2hlID0ge307XG4gICAgdGhpcy5wYXRoX29ubHkgPSBbXTtcbiAgICB0aGlzLnJlbmRlcl9sb2cgPSB7fTtcbiAgICB0aGlzLnJlbmRlcl9sb2cuZGVsZXRlZF9lbWJlZGRpbmdzID0gMDtcbiAgICB0aGlzLnJlbmRlcl9sb2cuZXhjbHVzaW9uc19sb2dzID0ge307XG4gICAgdGhpcy5yZW5kZXJfbG9nLmZhaWxlZF9lbWJlZGRpbmdzID0gW107XG4gICAgdGhpcy5yZW5kZXJfbG9nLmZpbGVzID0gW107XG4gICAgdGhpcy5yZW5kZXJfbG9nLm5ld19lbWJlZGRpbmdzID0gMDtcbiAgICB0aGlzLnJlbmRlcl9sb2cuc2tpcHBlZF9sb3dfZGVsdGEgPSB7fTtcbiAgICB0aGlzLnJlbmRlcl9sb2cudG9rZW5fdXNhZ2UgPSAwO1xuICAgIHRoaXMucmVuZGVyX2xvZy50b2tlbnNfc2F2ZWRfYnlfY2FjaGUgPSAwO1xuICAgIHRoaXMucmV0cnlfbm90aWNlX3RpbWVvdXQgPSBudWxsO1xuICAgIHRoaXMuc2F2ZV90aW1lb3V0ID0gbnVsbDtcbiAgICB0aGlzLnNjX2JyYW5kaW5nID0ge307XG4gICAgdGhpcy5zZWxmX3JlZl9rd19yZWdleCA9IG51bGw7XG4gICAgdGhpcy51cGRhdGVfYXZhaWxhYmxlID0gZmFsc2U7XG4gIH1cblxuICBhc3luYyBvbmxvYWQoKSB7XG4gICAgLy8gaW5pdGlhbGl6ZSB3aGVuIGxheW91dCBpcyByZWFkeVxuICAgIHRoaXMuYXBwLndvcmtzcGFjZS5vbkxheW91dFJlYWR5KHRoaXMuaW5pdGlhbGl6ZS5iaW5kKHRoaXMpKTtcbiAgfVxuICBvbnVubG9hZCgpIHtcbiAgICB0aGlzLm91dHB1dF9yZW5kZXJfbG9nKCk7XG4gICAgY29uc29sZS5sb2coXCJ1bmxvYWRpbmcgcGx1Z2luXCIpO1xuICAgIHRoaXMuYXBwLndvcmtzcGFjZS5kZXRhY2hMZWF2ZXNPZlR5cGUoU01BUlRfQ09OTkVDVElPTlNfVklFV19UWVBFKTtcbiAgICB0aGlzLmFwcC53b3Jrc3BhY2UuZGV0YWNoTGVhdmVzT2ZUeXBlKFNNQVJUX0NPTk5FQ1RJT05TX0NIQVRfVklFV19UWVBFKTtcbiAgfVxuICBhc3luYyBpbml0aWFsaXplKCkge1xuICAgIGNvbnNvbGUubG9nKFwiTG9hZGluZyBTbWFydCBDb25uZWN0aW9ucyBwbHVnaW5cIik7XG4gICAgVkVSU0lPTiA9IHRoaXMubWFuaWZlc3QudmVyc2lvbjtcbiAgICAvLyBWRVJTSU9OID0gJzEuMC4wJztcbiAgICAvLyBjb25zb2xlLmxvZyhWRVJTSU9OKTtcbiAgICBhd2FpdCB0aGlzLmxvYWRTZXR0aW5ncygpO1xuICAgIC8vIHJ1biBhZnRlciAzIHNlY29uZHNcbiAgICBzZXRUaW1lb3V0KHRoaXMuY2hlY2tfZm9yX3VwZGF0ZS5iaW5kKHRoaXMpLCAzMDAwKTtcbiAgICAvLyBydW4gY2hlY2sgZm9yIHVwZGF0ZSBldmVyeSAzIGhvdXJzXG4gICAgc2V0SW50ZXJ2YWwodGhpcy5jaGVja19mb3JfdXBkYXRlLmJpbmQodGhpcyksIDEwODAwMDAwKTtcblxuICAgIHRoaXMuYWRkSWNvbigpO1xuICAgIHRoaXMuYWRkQ29tbWFuZCh7XG4gICAgICBpZDogXCJzYy1maW5kLW5vdGVzXCIsXG4gICAgICBuYW1lOiBcIkZpbmQ6IE1ha2UgU21hcnQgQ29ubmVjdGlvbnNcIixcbiAgICAgIGljb246IFwicGVuY2lsX2ljb25cIixcbiAgICAgIGhvdGtleXM6IFtdLFxuICAgICAgLy8gZWRpdG9yQ2FsbGJhY2s6IGFzeW5jIChlZGl0b3IpID0+IHtcbiAgICAgIGVkaXRvckNhbGxiYWNrOiBhc3luYyAoZWRpdG9yKSA9PiB7XG4gICAgICAgIGlmKGVkaXRvci5zb21ldGhpbmdTZWxlY3RlZCgpKSB7XG4gICAgICAgICAgLy8gZ2V0IHNlbGVjdGVkIHRleHRcbiAgICAgICAgICBsZXQgc2VsZWN0ZWRfdGV4dCA9IGVkaXRvci5nZXRTZWxlY3Rpb24oKTtcbiAgICAgICAgICAvLyByZW5kZXIgY29ubmVjdGlvbnMgZnJvbSBzZWxlY3RlZCB0ZXh0XG4gICAgICAgICAgYXdhaXQgdGhpcy5tYWtlX2Nvbm5lY3Rpb25zKHNlbGVjdGVkX3RleHQpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIGNsZWFyIG5lYXJlc3RfY2FjaGUgb24gbWFudWFsIGNhbGwgdG8gbWFrZSBjb25uZWN0aW9uc1xuICAgICAgICAgIHRoaXMubmVhcmVzdF9jYWNoZSA9IHt9O1xuICAgICAgICAgIC8vIGNvbnNvbGUubG9nKFwiQ2xlYXJlZCBuZWFyZXN0X2NhY2hlXCIpO1xuICAgICAgICAgIGF3YWl0IHRoaXMubWFrZV9jb25uZWN0aW9ucygpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSk7XG4gICAgdGhpcy5hZGRDb21tYW5kKHtcbiAgICAgIGlkOiBcInNtYXJ0LWNvbm5lY3Rpb25zLXZpZXdcIixcbiAgICAgIG5hbWU6IFwiT3BlbjogVmlldyBTbWFydCBDb25uZWN0aW9uc1wiLFxuICAgICAgY2FsbGJhY2s6ICgpID0+IHtcbiAgICAgICAgdGhpcy5vcGVuX3ZpZXcoKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICAvLyBvcGVuIGNoYXQgY29tbWFuZFxuICAgIHRoaXMuYWRkQ29tbWFuZCh7XG4gICAgICBpZDogXCJzbWFydC1jb25uZWN0aW9ucy1jaGF0XCIsXG4gICAgICBuYW1lOiBcIk9wZW46IFNtYXJ0IENoYXQgQ29udmVyc2F0aW9uXCIsXG4gICAgICBjYWxsYmFjazogKCkgPT4ge1xuICAgICAgICB0aGlzLm9wZW5fY2hhdCgpO1xuICAgICAgfVxuICAgIH0pO1xuICAgIC8vIG9wZW4gcmFuZG9tIG5vdGUgZnJvbSBuZWFyZXN0IGNhY2hlXG4gICAgdGhpcy5hZGRDb21tYW5kKHtcbiAgICAgIGlkOiBcInNtYXJ0LWNvbm5lY3Rpb25zLXJhbmRvbVwiLFxuICAgICAgbmFtZTogXCJPcGVuOiBSYW5kb20gTm90ZSBmcm9tIFNtYXJ0IENvbm5lY3Rpb25zXCIsXG4gICAgICBjYWxsYmFjazogKCkgPT4ge1xuICAgICAgICB0aGlzLm9wZW5fcmFuZG9tX25vdGUoKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICAvLyBhZGQgc2V0dGluZ3MgdGFiXG4gICAgdGhpcy5hZGRTZXR0aW5nVGFiKG5ldyBTbWFydENvbm5lY3Rpb25zU2V0dGluZ3NUYWIodGhpcy5hcHAsIHRoaXMpKTtcbiAgICAvLyByZWdpc3RlciBtYWluIHZpZXcgdHlwZVxuICAgIHRoaXMucmVnaXN0ZXJWaWV3KFNNQVJUX0NPTk5FQ1RJT05TX1ZJRVdfVFlQRSwgKGxlYWYpID0+IChuZXcgU21hcnRDb25uZWN0aW9uc1ZpZXcobGVhZiwgdGhpcykpKTtcbiAgICAvLyByZWdpc3RlciBjaGF0IHZpZXcgdHlwZVxuICAgIHRoaXMucmVnaXN0ZXJWaWV3KFNNQVJUX0NPTk5FQ1RJT05TX0NIQVRfVklFV19UWVBFLCAobGVhZikgPT4gKG5ldyBTbWFydENvbm5lY3Rpb25zQ2hhdFZpZXcobGVhZiwgdGhpcykpKTtcbiAgICAvLyBjb2RlLWJsb2NrIHJlbmRlcmVyXG4gICAgdGhpcy5yZWdpc3Rlck1hcmtkb3duQ29kZUJsb2NrUHJvY2Vzc29yKFwic21hcnQtY29ubmVjdGlvbnNcIiwgdGhpcy5yZW5kZXJfY29kZV9ibG9jay5iaW5kKHRoaXMpKTtcblxuICAgIC8vIGlmIHRoaXMgc2V0dGluZ3Mudmlld19vcGVuIGlzIHRydWUsIG9wZW4gdmlldyBvbiBzdGFydHVwXG4gICAgaWYodGhpcy5zZXR0aW5ncy52aWV3X29wZW4pIHtcbiAgICAgIHRoaXMub3Blbl92aWV3KCk7XG4gICAgfVxuICAgIC8vIGlmIHRoaXMgc2V0dGluZ3MuY2hhdF9vcGVuIGlzIHRydWUsIG9wZW4gY2hhdCBvbiBzdGFydHVwXG4gICAgaWYodGhpcy5zZXR0aW5ncy5jaGF0X29wZW4pIHtcbiAgICAgIHRoaXMub3Blbl9jaGF0KCk7XG4gICAgfVxuICAgIC8vIG9uIG5ldyB2ZXJzaW9uXG4gICAgaWYodGhpcy5zZXR0aW5ncy52ZXJzaW9uICE9PSBWRVJTSU9OKSB7XG4gICAgICAvLyB1cGRhdGUgdmVyc2lvblxuICAgICAgdGhpcy5zZXR0aW5ncy52ZXJzaW9uID0gVkVSU0lPTjtcbiAgICAgIC8vIHNhdmUgc2V0dGluZ3NcbiAgICAgIGF3YWl0IHRoaXMuc2F2ZVNldHRpbmdzKCk7XG4gICAgICAvLyBvcGVuIHZpZXdcbiAgICAgIHRoaXMub3Blbl92aWV3KCk7XG4gICAgfVxuICAgIC8vIGNoZWNrIGdpdGh1YiByZWxlYXNlIGVuZHBvaW50IGlmIHVwZGF0ZSBpcyBhdmFpbGFibGVcbiAgICB0aGlzLmFkZF90b19naXRpZ25vcmUoKTtcbiAgICAvKipcbiAgICAgKiBFWFBFUklNRU5UQUxcbiAgICAgKiAtIHdpbmRvdy1iYXNlZCBBUEkgYWNjZXNzXG4gICAgICogLSBjb2RlLWJsb2NrIHJlbmRlcmluZ1xuICAgICAqL1xuICAgIHRoaXMuYXBpID0gbmV3IFNjU2VhcmNoQXBpKHRoaXMuYXBwLCB0aGlzKTtcbiAgICAvLyByZWdpc3RlciBBUEkgdG8gZ2xvYmFsIHdpbmRvdyBvYmplY3RcbiAgICAod2luZG93W1wiU21hcnRTZWFyY2hBcGlcIl0gPSB0aGlzLmFwaSkgJiYgdGhpcy5yZWdpc3RlcigoKSA9PiBkZWxldGUgd2luZG93W1wiU21hcnRTZWFyY2hBcGlcIl0pO1xuXG4gIH1cblxuICBhc3luYyBpbml0X3ZlY3MoKSB7XG4gICAgdGhpcy5zbWFydF92ZWNfbGl0ZSA9IG5ldyBWZWNMaXRlKHtcbiAgICAgIGZvbGRlcl9wYXRoOiBcIi5zbWFydC1jb25uZWN0aW9uc1wiLFxuICAgICAgZXhpc3RzX2FkYXB0ZXI6IHRoaXMuYXBwLnZhdWx0LmFkYXB0ZXIuZXhpc3RzLmJpbmQodGhpcy5hcHAudmF1bHQuYWRhcHRlciksXG4gICAgICBta2Rpcl9hZGFwdGVyOiB0aGlzLmFwcC52YXVsdC5hZGFwdGVyLm1rZGlyLmJpbmQodGhpcy5hcHAudmF1bHQuYWRhcHRlciksXG4gICAgICByZWFkX2FkYXB0ZXI6IHRoaXMuYXBwLnZhdWx0LmFkYXB0ZXIucmVhZC5iaW5kKHRoaXMuYXBwLnZhdWx0LmFkYXB0ZXIpLFxuICAgICAgcmVuYW1lX2FkYXB0ZXI6IHRoaXMuYXBwLnZhdWx0LmFkYXB0ZXIucmVuYW1lLmJpbmQodGhpcy5hcHAudmF1bHQuYWRhcHRlciksXG4gICAgICBzdGF0X2FkYXB0ZXI6IHRoaXMuYXBwLnZhdWx0LmFkYXB0ZXIuc3RhdC5iaW5kKHRoaXMuYXBwLnZhdWx0LmFkYXB0ZXIpLFxuICAgICAgd3JpdGVfYWRhcHRlcjogdGhpcy5hcHAudmF1bHQuYWRhcHRlci53cml0ZS5iaW5kKHRoaXMuYXBwLnZhdWx0LmFkYXB0ZXIpLFxuICAgIH0pO1xuICAgIHRoaXMuZW1iZWRkaW5nc19sb2FkZWQgPSBhd2FpdCB0aGlzLnNtYXJ0X3ZlY19saXRlLmxvYWQoKTtcbiAgICByZXR1cm4gdGhpcy5lbWJlZGRpbmdzX2xvYWRlZDtcbiAgfVxuXG4gIGFzeW5jIGxvYWRTZXR0aW5ncygpIHtcbiAgICB0aGlzLnNldHRpbmdzID0gT2JqZWN0LmFzc2lnbih7fSwgREVGQVVMVF9TRVRUSU5HUywgYXdhaXQgdGhpcy5sb2FkRGF0YSgpKTtcbiAgICAvLyBsb2FkIGZpbGUgZXhjbHVzaW9ucyBpZiBub3QgYmxhbmtcbiAgICBpZih0aGlzLnNldHRpbmdzLmZpbGVfZXhjbHVzaW9ucyAmJiB0aGlzLnNldHRpbmdzLmZpbGVfZXhjbHVzaW9ucy5sZW5ndGggPiAwKSB7XG4gICAgICAvLyBzcGxpdCBmaWxlIGV4Y2x1c2lvbnMgaW50byBhcnJheSBhbmQgdHJpbSB3aGl0ZXNwYWNlXG4gICAgICB0aGlzLmZpbGVfZXhjbHVzaW9ucyA9IHRoaXMuc2V0dGluZ3MuZmlsZV9leGNsdXNpb25zLnNwbGl0KFwiLFwiKS5tYXAoKGZpbGUpID0+IHtcbiAgICAgICAgcmV0dXJuIGZpbGUudHJpbSgpO1xuICAgICAgfSk7XG4gICAgfVxuICAgIC8vIGxvYWQgZm9sZGVyIGV4Y2x1c2lvbnMgaWYgbm90IGJsYW5rXG4gICAgaWYodGhpcy5zZXR0aW5ncy5mb2xkZXJfZXhjbHVzaW9ucyAmJiB0aGlzLnNldHRpbmdzLmZvbGRlcl9leGNsdXNpb25zLmxlbmd0aCA+IDApIHtcbiAgICAgIC8vIGFkZCBzbGFzaCB0byBlbmQgb2YgZm9sZGVyIG5hbWUgaWYgbm90IHByZXNlbnRcbiAgICAgIGNvbnN0IGZvbGRlcl9leGNsdXNpb25zID0gdGhpcy5zZXR0aW5ncy5mb2xkZXJfZXhjbHVzaW9ucy5zcGxpdChcIixcIikubWFwKChmb2xkZXIpID0+IHtcbiAgICAgICAgLy8gdHJpbSB3aGl0ZXNwYWNlXG4gICAgICAgIGZvbGRlciA9IGZvbGRlci50cmltKCk7XG4gICAgICAgIGlmKGZvbGRlci5zbGljZSgtMSkgIT09IFwiL1wiKSB7XG4gICAgICAgICAgcmV0dXJuIGZvbGRlciArIFwiL1wiO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJldHVybiBmb2xkZXI7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgICAgLy8gbWVyZ2UgZm9sZGVyIGV4Y2x1c2lvbnMgd2l0aCBmaWxlIGV4Y2x1c2lvbnNcbiAgICAgIHRoaXMuZmlsZV9leGNsdXNpb25zID0gdGhpcy5maWxlX2V4Y2x1c2lvbnMuY29uY2F0KGZvbGRlcl9leGNsdXNpb25zKTtcbiAgICB9XG4gICAgLy8gbG9hZCBoZWFkZXIgZXhjbHVzaW9ucyBpZiBub3QgYmxhbmtcbiAgICBpZih0aGlzLnNldHRpbmdzLmhlYWRlcl9leGNsdXNpb25zICYmIHRoaXMuc2V0dGluZ3MuaGVhZGVyX2V4Y2x1c2lvbnMubGVuZ3RoID4gMCkge1xuICAgICAgdGhpcy5oZWFkZXJfZXhjbHVzaW9ucyA9IHRoaXMuc2V0dGluZ3MuaGVhZGVyX2V4Y2x1c2lvbnMuc3BsaXQoXCIsXCIpLm1hcCgoaGVhZGVyKSA9PiB7XG4gICAgICAgIHJldHVybiBoZWFkZXIudHJpbSgpO1xuICAgICAgfSk7XG4gICAgfVxuICAgIC8vIGxvYWQgcGF0aF9vbmx5IGlmIG5vdCBibGFua1xuICAgIGlmKHRoaXMuc2V0dGluZ3MucGF0aF9vbmx5ICYmIHRoaXMuc2V0dGluZ3MucGF0aF9vbmx5Lmxlbmd0aCA+IDApIHtcbiAgICAgIHRoaXMucGF0aF9vbmx5ID0gdGhpcy5zZXR0aW5ncy5wYXRoX29ubHkuc3BsaXQoXCIsXCIpLm1hcCgocGF0aCkgPT4ge1xuICAgICAgICByZXR1cm4gcGF0aC50cmltKCk7XG4gICAgICB9KTtcbiAgICB9XG4gICAgLy8gbG9hZCBzZWxmX3JlZl9rd19yZWdleFxuICAgIHRoaXMuc2VsZl9yZWZfa3dfcmVnZXggPSBuZXcgUmVnRXhwKGBcXFxcYigke1NNQVJUX1RSQU5TTEFUSU9OW3RoaXMuc2V0dGluZ3MubGFuZ3VhZ2VdLnByb25vdXMuam9pbihcInxcIil9KVxcXFxiYCwgXCJnaVwiKTtcbiAgICAvLyBsb2FkIGZhaWxlZCBmaWxlc1xuICAgIGF3YWl0IHRoaXMubG9hZF9mYWlsZWRfZmlsZXMoKTtcbiAgfVxuICBhc3luYyBzYXZlU2V0dGluZ3MocmVyZW5kZXI9ZmFsc2UpIHtcbiAgICBhd2FpdCB0aGlzLnNhdmVEYXRhKHRoaXMuc2V0dGluZ3MpO1xuICAgIC8vIHJlLWxvYWQgc2V0dGluZ3MgaW50byBtZW1vcnlcbiAgICBhd2FpdCB0aGlzLmxvYWRTZXR0aW5ncygpO1xuICAgIC8vIHJlLXJlbmRlciB2aWV3IGlmIHNldCB0byB0cnVlIChmb3IgZXhhbXBsZSwgYWZ0ZXIgYWRkaW5nIEFQSSBrZXkpXG4gICAgaWYocmVyZW5kZXIpIHtcbiAgICAgIHRoaXMubmVhcmVzdF9jYWNoZSA9IHt9O1xuICAgICAgYXdhaXQgdGhpcy5tYWtlX2Nvbm5lY3Rpb25zKCk7XG4gICAgfVxuICB9XG5cbiAgLy8gY2hlY2sgZm9yIHVwZGF0ZVxuICBhc3luYyBjaGVja19mb3JfdXBkYXRlKCkge1xuICAgIC8vIGZhaWwgc2lsZW50bHksIGV4LiBpZiBubyBpbnRlcm5ldCBjb25uZWN0aW9uXG4gICAgdHJ5IHtcbiAgICAgIC8vIGdldCBsYXRlc3QgcmVsZWFzZSB2ZXJzaW9uIGZyb20gZ2l0aHViXG4gICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0ICgwLCBPYnNpZGlhbi5yZXF1ZXN0VXJsKSh7XG4gICAgICAgIHVybDogXCJodHRwczovL2FwaS5naXRodWIuY29tL3JlcG9zL2JyaWFucGV0cm8vb2JzaWRpYW4tc21hcnQtY29ubmVjdGlvbnMvcmVsZWFzZXMvbGF0ZXN0XCIsXG4gICAgICAgIG1ldGhvZDogXCJHRVRcIixcbiAgICAgICAgaGVhZGVyczoge1xuICAgICAgICAgIFwiQ29udGVudC1UeXBlXCI6IFwiYXBwbGljYXRpb24vanNvblwiLFxuICAgICAgICB9LFxuICAgICAgICBjb250ZW50VHlwZTogXCJhcHBsaWNhdGlvbi9qc29uXCIsXG4gICAgICB9KTtcbiAgICAgIC8vIGdldCB2ZXJzaW9uIG51bWJlciBmcm9tIHJlc3BvbnNlXG4gICAgICBjb25zdCBsYXRlc3RfcmVsZWFzZSA9IEpTT04ucGFyc2UocmVzcG9uc2UudGV4dCkudGFnX25hbWU7XG4gICAgICAvLyBjb25zb2xlLmxvZyhgTGF0ZXN0IHJlbGVhc2U6ICR7bGF0ZXN0X3JlbGVhc2V9YCk7XG4gICAgICAvLyBpZiBsYXRlc3RfcmVsZWFzZSBpcyBuZXdlciB0aGFuIGN1cnJlbnQgdmVyc2lvbiwgc2hvdyBtZXNzYWdlXG4gICAgICBpZihsYXRlc3RfcmVsZWFzZSAhPT0gVkVSU0lPTikge1xuICAgICAgICBuZXcgT2JzaWRpYW4uTm90aWNlKGBbU21hcnQgQ29ubmVjdGlvbnNdIEEgbmV3IHZlcnNpb24gaXMgYXZhaWxhYmxlISAodiR7bGF0ZXN0X3JlbGVhc2V9KWApO1xuICAgICAgICB0aGlzLnVwZGF0ZV9hdmFpbGFibGUgPSB0cnVlO1xuICAgICAgICB0aGlzLnJlbmRlcl9icmFuZChcImFsbFwiKVxuICAgICAgfVxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmxvZyhlcnJvcik7XG4gICAgfVxuICB9XG5cbiAgYXN5bmMgcmVuZGVyX2NvZGVfYmxvY2soY29udGVudHMsIGNvbnRhaW5lciwgY3R4KSB7XG4gICAgbGV0IG5lYXJlc3Q7XG4gICAgaWYoY29udGVudHMudHJpbSgpLmxlbmd0aCA+IDApIHtcbiAgICAgIG5lYXJlc3QgPSBhd2FpdCB0aGlzLmFwaS5zZWFyY2goY29udGVudHMpO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyB1c2UgY3R4IHRvIGdldCBmaWxlXG4gICAgICBjb25zb2xlLmxvZyhjdHgpO1xuICAgICAgY29uc3QgZmlsZSA9IHRoaXMuYXBwLnZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aChjdHguc291cmNlUGF0aCk7XG4gICAgICBuZWFyZXN0ID0gYXdhaXQgdGhpcy5maW5kX25vdGVfY29ubmVjdGlvbnMoZmlsZSk7XG4gICAgfVxuICAgIGlmIChuZWFyZXN0Lmxlbmd0aCkge1xuICAgICAgdGhpcy51cGRhdGVfcmVzdWx0cyhjb250YWluZXIsIG5lYXJlc3QpO1xuICAgIH1cbiAgfVxuXG4gIGFzeW5jIG1ha2VfY29ubmVjdGlvbnMoc2VsZWN0ZWRfdGV4dD1udWxsKSB7XG4gICAgbGV0IHZpZXcgPSB0aGlzLmdldF92aWV3KCk7XG4gICAgaWYgKCF2aWV3KSB7XG4gICAgICAvLyBvcGVuIHZpZXcgaWYgbm90IG9wZW5cbiAgICAgIGF3YWl0IHRoaXMub3Blbl92aWV3KCk7XG4gICAgICB2aWV3ID0gdGhpcy5nZXRfdmlldygpO1xuICAgIH1cbiAgICBhd2FpdCB2aWV3LnJlbmRlcl9jb25uZWN0aW9ucyhzZWxlY3RlZF90ZXh0KTtcbiAgfVxuXG4gIGFkZEljb24oKXtcbiAgICBPYnNpZGlhbi5hZGRJY29uKFwic21hcnQtY29ubmVjdGlvbnNcIiwgYDxwYXRoIGQ9XCJNNTAsMjAgTDgwLDQwIEw4MCw2MCBMNTAsMTAwXCIgc3Ryb2tlPVwiY3VycmVudENvbG9yXCIgc3Ryb2tlLXdpZHRoPVwiNFwiIGZpbGw9XCJub25lXCIvPlxuICAgIDxwYXRoIGQ9XCJNMzAsNTAgTDU1LDcwXCIgc3Ryb2tlPVwiY3VycmVudENvbG9yXCIgc3Ryb2tlLXdpZHRoPVwiNVwiIGZpbGw9XCJub25lXCIvPlxuICAgIDxjaXJjbGUgY3g9XCI1MFwiIGN5PVwiMjBcIiByPVwiOVwiIGZpbGw9XCJjdXJyZW50Q29sb3JcIi8+XG4gICAgPGNpcmNsZSBjeD1cIjgwXCIgY3k9XCI0MFwiIHI9XCI5XCIgZmlsbD1cImN1cnJlbnRDb2xvclwiLz5cbiAgICA8Y2lyY2xlIGN4PVwiODBcIiBjeT1cIjcwXCIgcj1cIjlcIiBmaWxsPVwiY3VycmVudENvbG9yXCIvPlxuICAgIDxjaXJjbGUgY3g9XCI1MFwiIGN5PVwiMTAwXCIgcj1cIjlcIiBmaWxsPVwiY3VycmVudENvbG9yXCIvPlxuICAgIDxjaXJjbGUgY3g9XCIzMFwiIGN5PVwiNTBcIiByPVwiOVwiIGZpbGw9XCJjdXJyZW50Q29sb3JcIi8+YCk7XG4gIH1cblxuICAvLyBvcGVuIHJhbmRvbSBub3RlXG4gIGFzeW5jIG9wZW5fcmFuZG9tX25vdGUoKSB7XG4gICAgY29uc3QgY3Vycl9maWxlID0gdGhpcy5hcHAud29ya3NwYWNlLmdldEFjdGl2ZUZpbGUoKTtcbiAgICBjb25zdCBjdXJyX2tleSA9IG1kNShjdXJyX2ZpbGUucGF0aCk7XG4gICAgLy8gaWYgbm8gbmVhcmVzdCBjYWNoZSwgY3JlYXRlIE9ic2lkaWFuIG5vdGljZVxuICAgIGlmKHR5cGVvZiB0aGlzLm5lYXJlc3RfY2FjaGVbY3Vycl9rZXldID09PSBcInVuZGVmaW5lZFwiKSB7XG4gICAgICBuZXcgT2JzaWRpYW4uTm90aWNlKFwiW1NtYXJ0IENvbm5lY3Rpb25zXSBObyBTbWFydCBDb25uZWN0aW9ucyBmb3VuZC4gT3BlbiBhIG5vdGUgdG8gZ2V0IFNtYXJ0IENvbm5lY3Rpb25zLlwiKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgLy8gZ2V0IHJhbmRvbSBmcm9tIG5lYXJlc3QgY2FjaGVcbiAgICBjb25zdCByYW5kID0gTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogdGhpcy5uZWFyZXN0X2NhY2hlW2N1cnJfa2V5XS5sZW5ndGgvMik7IC8vIGRpdmlkZSBieSAyIHRvIGxpbWl0IHRvIHRvcCBoYWxmIG9mIHJlc3VsdHNcbiAgICBjb25zdCByYW5kb21fZmlsZSA9IHRoaXMubmVhcmVzdF9jYWNoZVtjdXJyX2tleV1bcmFuZF07XG4gICAgLy8gb3BlbiByYW5kb20gZmlsZVxuICAgIHRoaXMub3Blbl9ub3RlKHJhbmRvbV9maWxlKTtcbiAgfVxuXG4gIGFzeW5jIG9wZW5fdmlldygpIHtcbiAgICBpZih0aGlzLmdldF92aWV3KCkpe1xuICAgICAgY29uc29sZS5sb2coXCJTbWFydCBDb25uZWN0aW9ucyB2aWV3IGFscmVhZHkgb3BlblwiKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgdGhpcy5hcHAud29ya3NwYWNlLmRldGFjaExlYXZlc09mVHlwZShTTUFSVF9DT05ORUNUSU9OU19WSUVXX1RZUEUpO1xuICAgIGF3YWl0IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRSaWdodExlYWYoZmFsc2UpLnNldFZpZXdTdGF0ZSh7XG4gICAgICB0eXBlOiBTTUFSVF9DT05ORUNUSU9OU19WSUVXX1RZUEUsXG4gICAgICBhY3RpdmU6IHRydWUsXG4gICAgfSk7XG4gICAgdGhpcy5hcHAud29ya3NwYWNlLnJldmVhbExlYWYoXG4gICAgICB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0TGVhdmVzT2ZUeXBlKFNNQVJUX0NPTk5FQ1RJT05TX1ZJRVdfVFlQRSlbMF1cbiAgICApO1xuICB9XG4gIC8vIHNvdXJjZTogaHR0cHM6Ly9naXRodWIuY29tL29ic2lkaWFubWQvb2JzaWRpYW4tcmVsZWFzZXMvYmxvYi9tYXN0ZXIvcGx1Z2luLXJldmlldy5tZCNhdm9pZC1tYW5hZ2luZy1yZWZlcmVuY2VzLXRvLWN1c3RvbS12aWV3c1xuICBnZXRfdmlldygpIHtcbiAgICBmb3IgKGxldCBsZWFmIG9mIHRoaXMuYXBwLndvcmtzcGFjZS5nZXRMZWF2ZXNPZlR5cGUoU01BUlRfQ09OTkVDVElPTlNfVklFV19UWVBFKSkge1xuICAgICAgaWYgKGxlYWYudmlldyBpbnN0YW5jZW9mIFNtYXJ0Q29ubmVjdGlvbnNWaWV3KSB7XG4gICAgICAgIHJldHVybiBsZWFmLnZpZXc7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIC8vIG9wZW4gY2hhdCB2aWV3XG4gIGFzeW5jIG9wZW5fY2hhdChyZXRyaWVzPTApIHtcbiAgICBpZighdGhpcy5lbWJlZGRpbmdzX2xvYWRlZCkge1xuICAgICAgY29uc29sZS5sb2coXCJlbWJlZGRpbmdzIG5vdCBsb2FkZWQgeWV0XCIpO1xuICAgICAgaWYocmV0cmllcyA8IDMpIHtcbiAgICAgICAgLy8gd2FpdCBhbmQgdHJ5IGFnYWluXG4gICAgICAgIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICAgIHRoaXMub3Blbl9jaGF0KHJldHJpZXMrMSk7XG4gICAgICAgIH0sIDEwMDAgKiAocmV0cmllcysxKSk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGNvbnNvbGUubG9nKFwiZW1iZWRkaW5ncyBzdGlsbCBub3QgbG9hZGVkLCBvcGVuaW5nIHNtYXJ0IHZpZXdcIik7XG4gICAgICB0aGlzLm9wZW5fdmlldygpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB0aGlzLmFwcC53b3Jrc3BhY2UuZGV0YWNoTGVhdmVzT2ZUeXBlKFNNQVJUX0NPTk5FQ1RJT05TX0NIQVRfVklFV19UWVBFKTtcbiAgICBhd2FpdCB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0UmlnaHRMZWFmKGZhbHNlKS5zZXRWaWV3U3RhdGUoe1xuICAgICAgdHlwZTogU01BUlRfQ09OTkVDVElPTlNfQ0hBVF9WSUVXX1RZUEUsXG4gICAgICBhY3RpdmU6IHRydWUsXG4gICAgfSk7XG4gICAgdGhpcy5hcHAud29ya3NwYWNlLnJldmVhbExlYWYoXG4gICAgICB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0TGVhdmVzT2ZUeXBlKFNNQVJUX0NPTk5FQ1RJT05TX0NIQVRfVklFV19UWVBFKVswXVxuICAgICk7XG4gIH1cbiAgXG4gIC8vIGdldCBlbWJlZGRpbmdzIGZvciBhbGwgZmlsZXNcbiAgYXN5bmMgZ2V0X2FsbF9lbWJlZGRpbmdzKCkge1xuICAgIC8vIGdldCBhbGwgZmlsZXMgaW4gdmF1bHQgYW5kIGZpbHRlciBhbGwgYnV0IG1hcmtkb3duIGFuZCBjYW52YXMgZmlsZXNcbiAgICBjb25zdCBmaWxlcyA9IChhd2FpdCB0aGlzLmFwcC52YXVsdC5nZXRGaWxlcygpKS5maWx0ZXIoKGZpbGUpID0+IGZpbGUgaW5zdGFuY2VvZiBPYnNpZGlhbi5URmlsZSAmJiAoZmlsZS5leHRlbnNpb24gPT09IFwibWRcIiB8fCBmaWxlLmV4dGVuc2lvbiA9PT0gXCJjYW52YXNcIikpO1xuICAgIC8vIGNvbnN0IGZpbGVzID0gYXdhaXQgdGhpcy5hcHAudmF1bHQuZ2V0TWFya2Rvd25GaWxlcygpO1xuICAgIC8vIGdldCBvcGVuIGZpbGVzIHRvIHNraXAgaWYgZmlsZSBpcyBjdXJyZW50bHkgb3BlblxuICAgIGNvbnN0IG9wZW5fZmlsZXMgPSB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0TGVhdmVzT2ZUeXBlKFwibWFya2Rvd25cIikubWFwKChsZWFmKSA9PiBsZWFmLnZpZXcuZmlsZSk7XG4gICAgY29uc3QgY2xlYW5fdXBfbG9nID0gdGhpcy5zbWFydF92ZWNfbGl0ZS5jbGVhbl91cF9lbWJlZGRpbmdzKGZpbGVzKTtcbiAgICBpZih0aGlzLnNldHRpbmdzLmxvZ19yZW5kZXIpe1xuICAgICAgdGhpcy5yZW5kZXJfbG9nLnRvdGFsX2ZpbGVzID0gZmlsZXMubGVuZ3RoO1xuICAgICAgdGhpcy5yZW5kZXJfbG9nLmRlbGV0ZWRfZW1iZWRkaW5ncyA9IGNsZWFuX3VwX2xvZy5kZWxldGVkX2VtYmVkZGluZ3M7XG4gICAgICB0aGlzLnJlbmRlcl9sb2cudG90YWxfZW1iZWRkaW5ncyA9IGNsZWFuX3VwX2xvZy50b3RhbF9lbWJlZGRpbmdzO1xuICAgIH1cbiAgICAvLyBiYXRjaCBlbWJlZGRpbmdzXG4gICAgbGV0IGJhdGNoX3Byb21pc2VzID0gW107XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBmaWxlcy5sZW5ndGg7IGkrKykge1xuICAgICAgLy8gc2tpcCBpZiBwYXRoIGNvbnRhaW5zIGEgI1xuICAgICAgaWYoZmlsZXNbaV0ucGF0aC5pbmRleE9mKFwiI1wiKSA+IC0xKSB7XG4gICAgICAgIC8vIGNvbnNvbGUubG9nKFwic2tpcHBpbmcgZmlsZSAnXCIrZmlsZXNbaV0ucGF0aCtcIicgKHBhdGggY29udGFpbnMgIylcIik7XG4gICAgICAgIHRoaXMubG9nX2V4Y2x1c2lvbihcInBhdGggY29udGFpbnMgI1wiKTtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgICAvLyBza2lwIGlmIGZpbGUgYWxyZWFkeSBoYXMgZW1iZWRkaW5nIGFuZCBlbWJlZGRpbmcubXRpbWUgaXMgZ3JlYXRlciB0aGFuIG9yIGVxdWFsIHRvIGZpbGUubXRpbWVcbiAgICAgIGlmKHRoaXMuc21hcnRfdmVjX2xpdGUubXRpbWVfaXNfY3VycmVudChtZDUoZmlsZXNbaV0ucGF0aCksIGZpbGVzW2ldLnN0YXQubXRpbWUpKSB7XG4gICAgICAgIC8vIGxvZyBza2lwcGluZyBmaWxlXG4gICAgICAgIC8vIGNvbnNvbGUubG9nKFwic2tpcHBpbmcgZmlsZSAobXRpbWUpXCIpO1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIC8vIGNoZWNrIGlmIGZpbGUgaXMgaW4gZmFpbGVkX2ZpbGVzXG4gICAgICBpZih0aGlzLnNldHRpbmdzLmZhaWxlZF9maWxlcy5pbmRleE9mKGZpbGVzW2ldLnBhdGgpID4gLTEpIHtcbiAgICAgICAgLy8gbG9nIHNraXBwaW5nIGZpbGVcbiAgICAgICAgLy8gY29uc29sZS5sb2coXCJza2lwcGluZyBwcmV2aW91c2x5IGZhaWxlZCBmaWxlLCB1c2UgYnV0dG9uIGluIHNldHRpbmdzIHRvIHJldHJ5XCIpO1xuICAgICAgICAvLyB1c2Ugc2V0VGltZW91dCB0byBwcmV2ZW50IG11bHRpcGxlIG5vdGljZXNcbiAgICAgICAgaWYodGhpcy5yZXRyeV9ub3RpY2VfdGltZW91dCkge1xuICAgICAgICAgIGNsZWFyVGltZW91dCh0aGlzLnJldHJ5X25vdGljZV90aW1lb3V0KTtcbiAgICAgICAgICB0aGlzLnJldHJ5X25vdGljZV90aW1lb3V0ID0gbnVsbDtcbiAgICAgICAgfVxuICAgICAgICAvLyBsaW1pdCB0byBvbmUgbm90aWNlIGV2ZXJ5IDEwIG1pbnV0ZXNcbiAgICAgICAgaWYoIXRoaXMucmVjZW50bHlfc2VudF9yZXRyeV9ub3RpY2Upe1xuICAgICAgICAgIG5ldyBPYnNpZGlhbi5Ob3RpY2UoXCJTbWFydCBDb25uZWN0aW9uczogU2tpcHBpbmcgcHJldmlvdXNseSBmYWlsZWQgZmlsZSwgdXNlIGJ1dHRvbiBpbiBzZXR0aW5ncyB0byByZXRyeVwiKTtcbiAgICAgICAgICB0aGlzLnJlY2VudGx5X3NlbnRfcmV0cnlfbm90aWNlID0gdHJ1ZTtcbiAgICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgICAgIHRoaXMucmVjZW50bHlfc2VudF9yZXRyeV9ub3RpY2UgPSBmYWxzZTsgIFxuICAgICAgICAgIH0sIDYwMDAwMCk7XG4gICAgICAgIH1cbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgICAvLyBza2lwIGZpbGVzIHdoZXJlIHBhdGggY29udGFpbnMgYW55IGV4Y2x1c2lvbnNcbiAgICAgIGxldCBza2lwID0gZmFsc2U7XG4gICAgICBmb3IobGV0IGogPSAwOyBqIDwgdGhpcy5maWxlX2V4Y2x1c2lvbnMubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgaWYoZmlsZXNbaV0ucGF0aC5pbmRleE9mKHRoaXMuZmlsZV9leGNsdXNpb25zW2pdKSA+IC0xKSB7XG4gICAgICAgICAgc2tpcCA9IHRydWU7XG4gICAgICAgICAgdGhpcy5sb2dfZXhjbHVzaW9uKHRoaXMuZmlsZV9leGNsdXNpb25zW2pdKTtcbiAgICAgICAgICAvLyBicmVhayBvdXQgb2YgbG9vcFxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZihza2lwKSB7XG4gICAgICAgIGNvbnRpbnVlOyAvLyB0byBuZXh0IGZpbGVcbiAgICAgIH1cbiAgICAgIC8vIGNoZWNrIGlmIGZpbGUgaXMgb3BlblxuICAgICAgaWYob3Blbl9maWxlcy5pbmRleE9mKGZpbGVzW2ldKSA+IC0xKSB7XG4gICAgICAgIC8vIGNvbnNvbGUubG9nKFwic2tpcHBpbmcgZmlsZSAob3BlbilcIik7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgICAgdHJ5IHtcbiAgICAgICAgLy8gcHVzaCBwcm9taXNlIHRvIGJhdGNoX3Byb21pc2VzXG4gICAgICAgIGJhdGNoX3Byb21pc2VzLnB1c2godGhpcy5nZXRfZmlsZV9lbWJlZGRpbmdzKGZpbGVzW2ldLCBmYWxzZSkpO1xuICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgY29uc29sZS5sb2coZXJyb3IpO1xuICAgICAgfVxuICAgICAgLy8gaWYgYmF0Y2hfcHJvbWlzZXMgbGVuZ3RoIGlzIDEwXG4gICAgICBpZihiYXRjaF9wcm9taXNlcy5sZW5ndGggPiAzKSB7XG4gICAgICAgIC8vIHdhaXQgZm9yIGFsbCBwcm9taXNlcyB0byByZXNvbHZlXG4gICAgICAgIGF3YWl0IFByb21pc2UuYWxsKGJhdGNoX3Byb21pc2VzKTtcbiAgICAgICAgLy8gY2xlYXIgYmF0Y2hfcHJvbWlzZXNcbiAgICAgICAgYmF0Y2hfcHJvbWlzZXMgPSBbXTtcbiAgICAgIH1cblxuICAgICAgLy8gc2F2ZSBlbWJlZGRpbmdzIEpTT04gdG8gZmlsZSBldmVyeSAxMDAgZmlsZXMgdG8gc2F2ZSBwcm9ncmVzcyBvbiBidWxrIGVtYmVkZGluZ1xuICAgICAgaWYoaSA+IDAgJiYgaSAlIDEwMCA9PT0gMCkge1xuICAgICAgICBhd2FpdCB0aGlzLnNhdmVfZW1iZWRkaW5nc190b19maWxlKCk7XG4gICAgICB9XG4gICAgfVxuICAgIC8vIHdhaXQgZm9yIGFsbCBwcm9taXNlcyB0byByZXNvbHZlXG4gICAgYXdhaXQgUHJvbWlzZS5hbGwoYmF0Y2hfcHJvbWlzZXMpO1xuICAgIC8vIHdyaXRlIGVtYmVkZGluZ3MgSlNPTiB0byBmaWxlXG4gICAgYXdhaXQgdGhpcy5zYXZlX2VtYmVkZGluZ3NfdG9fZmlsZSgpO1xuICAgIC8vIGlmIHJlbmRlcl9sb2cuZmFpbGVkX2VtYmVkZGluZ3MgdGhlbiB1cGRhdGUgZmFpbGVkX2VtYmVkZGluZ3MudHh0XG4gICAgaWYodGhpcy5yZW5kZXJfbG9nLmZhaWxlZF9lbWJlZGRpbmdzLmxlbmd0aCA+IDApIHtcbiAgICAgIGF3YWl0IHRoaXMuc2F2ZV9mYWlsZWRfZW1iZWRkaW5ncygpO1xuICAgIH1cbiAgfVxuXG4gIGFzeW5jIHNhdmVfZW1iZWRkaW5nc190b19maWxlKGZvcmNlPWZhbHNlKSB7XG4gICAgaWYoIXRoaXMuaGFzX25ld19lbWJlZGRpbmdzKXtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgLy8gY29uc29sZS5sb2coXCJuZXcgZW1iZWRkaW5ncywgc2F2aW5nIHRvIGZpbGVcIik7XG4gICAgaWYoIWZvcmNlKSB7XG4gICAgICAvLyBwcmV2ZW50IGV4Y2Vzc2l2ZSB3cml0ZXMgdG8gZW1iZWRkaW5ncyBmaWxlIGJ5IHdhaXRpbmcgMSBtaW51dGUgYmVmb3JlIHdyaXRpbmdcbiAgICAgIGlmKHRoaXMuc2F2ZV90aW1lb3V0KSB7XG4gICAgICAgIGNsZWFyVGltZW91dCh0aGlzLnNhdmVfdGltZW91dCk7XG4gICAgICAgIHRoaXMuc2F2ZV90aW1lb3V0ID0gbnVsbDsgIFxuICAgICAgfVxuICAgICAgdGhpcy5zYXZlX3RpbWVvdXQgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgLy8gY29uc29sZS5sb2coXCJ3cml0aW5nIGVtYmVkZGluZ3MgdG8gZmlsZVwiKTtcbiAgICAgICAgdGhpcy5zYXZlX2VtYmVkZGluZ3NfdG9fZmlsZSh0cnVlKTtcbiAgICAgICAgLy8gY2xlYXIgdGltZW91dFxuICAgICAgICBpZih0aGlzLnNhdmVfdGltZW91dCkge1xuICAgICAgICAgIGNsZWFyVGltZW91dCh0aGlzLnNhdmVfdGltZW91dCk7XG4gICAgICAgICAgdGhpcy5zYXZlX3RpbWVvdXQgPSBudWxsO1xuICAgICAgICB9XG4gICAgICB9LCAzMDAwMCk7XG4gICAgICBjb25zb2xlLmxvZyhcInNjaGVkdWxlZCBzYXZlXCIpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRyeXtcbiAgICAgIC8vIHVzZSBzbWFydF92ZWNfbGl0ZVxuICAgICAgYXdhaXQgdGhpcy5zbWFydF92ZWNfbGl0ZS5zYXZlKCk7XG4gICAgICB0aGlzLmhhc19uZXdfZW1iZWRkaW5ncyA9IGZhbHNlO1xuICAgIH1jYXRjaChlcnJvcil7XG4gICAgICBjb25zb2xlLmxvZyhlcnJvcik7XG4gICAgICBuZXcgT2JzaWRpYW4uTm90aWNlKFwiU21hcnQgQ29ubmVjdGlvbnM6IFwiK2Vycm9yLm1lc3NhZ2UpO1xuICAgIH1cblxuICB9XG4gIC8vIHNhdmUgZmFpbGVkIGVtYmVkZGluZ3MgdG8gZmlsZSBmcm9tIHJlbmRlcl9sb2cuZmFpbGVkX2VtYmVkZGluZ3NcbiAgYXN5bmMgc2F2ZV9mYWlsZWRfZW1iZWRkaW5ncyAoKSB7XG4gICAgLy8gd3JpdGUgZmFpbGVkX2VtYmVkZGluZ3MgdG8gZmlsZSBvbmUgbGluZSBwZXIgZmFpbGVkIGVtYmVkZGluZ1xuICAgIGxldCBmYWlsZWRfZW1iZWRkaW5ncyA9IFtdO1xuICAgIC8vIGlmIGZpbGUgYWxyZWFkeSBleGlzdHMgdGhlbiByZWFkIGl0XG4gICAgY29uc3QgZmFpbGVkX2VtYmVkZGluZ3NfZmlsZV9leGlzdHMgPSBhd2FpdCB0aGlzLmFwcC52YXVsdC5hZGFwdGVyLmV4aXN0cyhcIi5zbWFydC1jb25uZWN0aW9ucy9mYWlsZWQtZW1iZWRkaW5ncy50eHRcIik7XG4gICAgaWYoZmFpbGVkX2VtYmVkZGluZ3NfZmlsZV9leGlzdHMpIHtcbiAgICAgIGZhaWxlZF9lbWJlZGRpbmdzID0gYXdhaXQgdGhpcy5hcHAudmF1bHQuYWRhcHRlci5yZWFkKFwiLnNtYXJ0LWNvbm5lY3Rpb25zL2ZhaWxlZC1lbWJlZGRpbmdzLnR4dFwiKTtcbiAgICAgIC8vIHNwbGl0IGZhaWxlZF9lbWJlZGRpbmdzIGludG8gYXJyYXlcbiAgICAgIGZhaWxlZF9lbWJlZGRpbmdzID0gZmFpbGVkX2VtYmVkZGluZ3Muc3BsaXQoXCJcXHJcXG5cIik7XG4gICAgfVxuICAgIC8vIG1lcmdlIGZhaWxlZF9lbWJlZGRpbmdzIHdpdGggcmVuZGVyX2xvZy5mYWlsZWRfZW1iZWRkaW5nc1xuICAgIGZhaWxlZF9lbWJlZGRpbmdzID0gZmFpbGVkX2VtYmVkZGluZ3MuY29uY2F0KHRoaXMucmVuZGVyX2xvZy5mYWlsZWRfZW1iZWRkaW5ncyk7XG4gICAgLy8gcmVtb3ZlIGR1cGxpY2F0ZXNcbiAgICBmYWlsZWRfZW1iZWRkaW5ncyA9IFsuLi5uZXcgU2V0KGZhaWxlZF9lbWJlZGRpbmdzKV07XG4gICAgLy8gc29ydCBmYWlsZWRfZW1iZWRkaW5ncyBhcnJheSBhbHBoYWJldGljYWxseVxuICAgIGZhaWxlZF9lbWJlZGRpbmdzLnNvcnQoKTtcbiAgICAvLyBjb252ZXJ0IGZhaWxlZF9lbWJlZGRpbmdzIGFycmF5IHRvIHN0cmluZ1xuICAgIGZhaWxlZF9lbWJlZGRpbmdzID0gZmFpbGVkX2VtYmVkZGluZ3Muam9pbihcIlxcclxcblwiKTtcbiAgICAvLyB3cml0ZSBmYWlsZWRfZW1iZWRkaW5ncyB0byBmaWxlXG4gICAgYXdhaXQgdGhpcy5hcHAudmF1bHQuYWRhcHRlci53cml0ZShcIi5zbWFydC1jb25uZWN0aW9ucy9mYWlsZWQtZW1iZWRkaW5ncy50eHRcIiwgZmFpbGVkX2VtYmVkZGluZ3MpO1xuICAgIC8vIHJlbG9hZCBmYWlsZWRfZW1iZWRkaW5ncyB0byBwcmV2ZW50IHJldHJ5aW5nIGZhaWxlZCBmaWxlcyB1bnRpbCBleHBsaWNpdGx5IHJlcXVlc3RlZFxuICAgIGF3YWl0IHRoaXMubG9hZF9mYWlsZWRfZmlsZXMoKTtcbiAgfVxuICBcbiAgLy8gbG9hZCBmYWlsZWQgZmlsZXMgZnJvbSBmYWlsZWQtZW1iZWRkaW5ncy50eHRcbiAgYXN5bmMgbG9hZF9mYWlsZWRfZmlsZXMgKCkge1xuICAgIC8vIGNoZWNrIGlmIGZhaWxlZC1lbWJlZGRpbmdzLnR4dCBleGlzdHNcbiAgICBjb25zdCBmYWlsZWRfZW1iZWRkaW5nc19maWxlX2V4aXN0cyA9IGF3YWl0IHRoaXMuYXBwLnZhdWx0LmFkYXB0ZXIuZXhpc3RzKFwiLnNtYXJ0LWNvbm5lY3Rpb25zL2ZhaWxlZC1lbWJlZGRpbmdzLnR4dFwiKTtcbiAgICBpZighZmFpbGVkX2VtYmVkZGluZ3NfZmlsZV9leGlzdHMpIHtcbiAgICAgIHRoaXMuc2V0dGluZ3MuZmFpbGVkX2ZpbGVzID0gW107XG4gICAgICBjb25zb2xlLmxvZyhcIk5vIGZhaWxlZCBmaWxlcy5cIik7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIC8vIHJlYWQgZmFpbGVkLWVtYmVkZGluZ3MudHh0XG4gICAgY29uc3QgZmFpbGVkX2VtYmVkZGluZ3MgPSBhd2FpdCB0aGlzLmFwcC52YXVsdC5hZGFwdGVyLnJlYWQoXCIuc21hcnQtY29ubmVjdGlvbnMvZmFpbGVkLWVtYmVkZGluZ3MudHh0XCIpO1xuICAgIC8vIHNwbGl0IGZhaWxlZF9lbWJlZGRpbmdzIGludG8gYXJyYXkgYW5kIHJlbW92ZSBlbXB0eSBsaW5lc1xuICAgIGNvbnN0IGZhaWxlZF9lbWJlZGRpbmdzX2FycmF5ID0gZmFpbGVkX2VtYmVkZGluZ3Muc3BsaXQoXCJcXHJcXG5cIik7XG4gICAgLy8gc3BsaXQgYXQgJyMnIGFuZCByZWR1Y2UgaW50byB1bmlxdWUgZmlsZSBwYXRoc1xuICAgIGNvbnN0IGZhaWxlZF9maWxlcyA9IGZhaWxlZF9lbWJlZGRpbmdzX2FycmF5Lm1hcChlbWJlZGRpbmcgPT4gZW1iZWRkaW5nLnNwbGl0KFwiI1wiKVswXSkucmVkdWNlKCh1bmlxdWUsIGl0ZW0pID0+IHVuaXF1ZS5pbmNsdWRlcyhpdGVtKSA/IHVuaXF1ZSA6IFsuLi51bmlxdWUsIGl0ZW1dLCBbXSk7XG4gICAgLy8gcmV0dXJuIGZhaWxlZF9maWxlc1xuICAgIHRoaXMuc2V0dGluZ3MuZmFpbGVkX2ZpbGVzID0gZmFpbGVkX2ZpbGVzO1xuICAgIC8vIGNvbnNvbGUubG9nKGZhaWxlZF9maWxlcyk7XG4gIH1cbiAgLy8gcmV0cnkgZmFpbGVkIGVtYmVkZGluZ3NcbiAgYXN5bmMgcmV0cnlfZmFpbGVkX2ZpbGVzICgpIHtcbiAgICAvLyByZW1vdmUgZmFpbGVkIGZpbGVzIGZyb20gZmFpbGVkX2ZpbGVzXG4gICAgdGhpcy5zZXR0aW5ncy5mYWlsZWRfZmlsZXMgPSBbXTtcbiAgICAvLyBpZiBmYWlsZWQtZW1iZWRkaW5ncy50eHQgZXhpc3RzIHRoZW4gZGVsZXRlIGl0XG4gICAgY29uc3QgZmFpbGVkX2VtYmVkZGluZ3NfZmlsZV9leGlzdHMgPSBhd2FpdCB0aGlzLmFwcC52YXVsdC5hZGFwdGVyLmV4aXN0cyhcIi5zbWFydC1jb25uZWN0aW9ucy9mYWlsZWQtZW1iZWRkaW5ncy50eHRcIik7XG4gICAgaWYoZmFpbGVkX2VtYmVkZGluZ3NfZmlsZV9leGlzdHMpIHtcbiAgICAgIGF3YWl0IHRoaXMuYXBwLnZhdWx0LmFkYXB0ZXIucmVtb3ZlKFwiLnNtYXJ0LWNvbm5lY3Rpb25zL2ZhaWxlZC1lbWJlZGRpbmdzLnR4dFwiKTtcbiAgICB9XG4gICAgLy8gcnVuIGdldCBhbGwgZW1iZWRkaW5nc1xuICAgIGF3YWl0IHRoaXMuZ2V0X2FsbF9lbWJlZGRpbmdzKCk7XG4gIH1cblxuXG4gIC8vIGFkZCAuc21hcnQtY29ubmVjdGlvbnMgdG8gLmdpdGlnbm9yZSB0byBwcmV2ZW50IGlzc3VlcyB3aXRoIGxhcmdlLCBmcmVxdWVudGx5IHVwZGF0ZWQgZW1iZWRkaW5ncyBmaWxlKHMpXG4gIGFzeW5jIGFkZF90b19naXRpZ25vcmUoKSB7XG4gICAgaWYoIShhd2FpdCB0aGlzLmFwcC52YXVsdC5hZGFwdGVyLmV4aXN0cyhcIi5naXRpZ25vcmVcIikpKSB7XG4gICAgICByZXR1cm47IC8vIGlmIC5naXRpZ25vcmUgZG9lc24ndCBleGlzdCB0aGVuIGRvbid0IGFkZCAuc21hcnQtY29ubmVjdGlvbnMgdG8gLmdpdGlnbm9yZVxuICAgIH1cbiAgICBsZXQgZ2l0aWdub3JlX2ZpbGUgPSBhd2FpdCB0aGlzLmFwcC52YXVsdC5hZGFwdGVyLnJlYWQoXCIuZ2l0aWdub3JlXCIpO1xuICAgIC8vIGlmIC5zbWFydC1jb25uZWN0aW9ucyBub3QgaW4gLmdpdGlnbm9yZVxuICAgIGlmIChnaXRpZ25vcmVfZmlsZS5pbmRleE9mKFwiLnNtYXJ0LWNvbm5lY3Rpb25zXCIpIDwgMCkge1xuICAgICAgLy8gYWRkIC5zbWFydC1jb25uZWN0aW9ucyB0byAuZ2l0aWdub3JlXG4gICAgICBsZXQgYWRkX3RvX2dpdGlnbm9yZSA9IFwiXFxuXFxuIyBJZ25vcmUgU21hcnQgQ29ubmVjdGlvbnMgZm9sZGVyIGJlY2F1c2UgZW1iZWRkaW5ncyBmaWxlIGlzIGxhcmdlIGFuZCB1cGRhdGVkIGZyZXF1ZW50bHlcIjtcbiAgICAgIGFkZF90b19naXRpZ25vcmUgKz0gXCJcXG4uc21hcnQtY29ubmVjdGlvbnNcIjtcbiAgICAgIGF3YWl0IHRoaXMuYXBwLnZhdWx0LmFkYXB0ZXIud3JpdGUoXCIuZ2l0aWdub3JlXCIsIGdpdGlnbm9yZV9maWxlICsgYWRkX3RvX2dpdGlnbm9yZSk7XG4gICAgICBjb25zb2xlLmxvZyhcImFkZGVkIC5zbWFydC1jb25uZWN0aW9ucyB0byAuZ2l0aWdub3JlXCIpO1xuICAgIH1cbiAgfVxuXG4gIC8vIGZvcmNlIHJlZnJlc2ggZW1iZWRkaW5ncyBmaWxlIGJ1dCBmaXJzdCByZW5hbWUgZXhpc3RpbmcgZW1iZWRkaW5ncyBmaWxlIHRvIC5zbWFydC1jb25uZWN0aW9ucy9lbWJlZGRpbmdzLVlZWVktTU0tREQuanNvblxuICBhc3luYyBmb3JjZV9yZWZyZXNoX2VtYmVkZGluZ3NfZmlsZSgpIHtcbiAgICBuZXcgT2JzaWRpYW4uTm90aWNlKFwiU21hcnQgQ29ubmVjdGlvbnM6IGVtYmVkZGluZ3MgZmlsZSBGb3JjZSBSZWZyZXNoZWQsIG1ha2luZyBuZXcgY29ubmVjdGlvbnMuLi5cIik7XG4gICAgLy8gZm9yY2UgcmVmcmVzaFxuICAgIGF3YWl0IHRoaXMuc21hcnRfdmVjX2xpdGUuZm9yY2VfcmVmcmVzaCgpO1xuICAgIC8vIHRyaWdnZXIgbWFraW5nIG5ldyBjb25uZWN0aW9uc1xuICAgIGF3YWl0IHRoaXMuZ2V0X2FsbF9lbWJlZGRpbmdzKCk7XG4gICAgdGhpcy5vdXRwdXRfcmVuZGVyX2xvZygpO1xuICAgIG5ldyBPYnNpZGlhbi5Ob3RpY2UoXCJTbWFydCBDb25uZWN0aW9uczogZW1iZWRkaW5ncyBmaWxlIEZvcmNlIFJlZnJlc2hlZCwgbmV3IGNvbm5lY3Rpb25zIG1hZGUuXCIpO1xuICB9XG5cbiAgLy8gZ2V0IGVtYmVkZGluZ3MgZm9yIGVtYmVkX2lucHV0XG4gIGFzeW5jIGdldF9maWxlX2VtYmVkZGluZ3MoY3Vycl9maWxlLCBzYXZlPXRydWUpIHtcbiAgICAvLyBsZXQgYmF0Y2hfcHJvbWlzZXMgPSBbXTtcbiAgICBsZXQgcmVxX2JhdGNoID0gW107XG4gICAgbGV0IGJsb2NrcyA9IFtdO1xuICAgIC8vIGluaXRpYXRlIGN1cnJfZmlsZV9rZXkgZnJvbSBtZDUoY3Vycl9maWxlLnBhdGgpXG4gICAgY29uc3QgY3Vycl9maWxlX2tleSA9IG1kNShjdXJyX2ZpbGUucGF0aCk7XG4gICAgLy8gaW50aWF0ZSBmaWxlX2ZpbGVfZW1iZWRfaW5wdXQgYnkgcmVtb3ZpbmcgLm1kIGFuZCBjb252ZXJ0aW5nIGZpbGUgcGF0aCB0byBicmVhZGNydW1icyAoXCIgPiBcIilcbiAgICBsZXQgZmlsZV9lbWJlZF9pbnB1dCA9IGN1cnJfZmlsZS5wYXRoLnJlcGxhY2UoXCIubWRcIiwgXCJcIik7XG4gICAgZmlsZV9lbWJlZF9pbnB1dCA9IGZpbGVfZW1iZWRfaW5wdXQucmVwbGFjZSgvXFwvL2csIFwiID4gXCIpO1xuICAgIC8vIGVtYmVkIG9uIGZpbGUubmFtZS90aXRsZSBvbmx5IGlmIHBhdGhfb25seSBwYXRoIG1hdGNoZXIgc3BlY2lmaWVkIGluIHNldHRpbmdzXG4gICAgbGV0IHBhdGhfb25seSA9IGZhbHNlO1xuICAgIGZvcihsZXQgaiA9IDA7IGogPCB0aGlzLnBhdGhfb25seS5sZW5ndGg7IGorKykge1xuICAgICAgaWYoY3Vycl9maWxlLnBhdGguaW5kZXhPZih0aGlzLnBhdGhfb25seVtqXSkgPiAtMSkge1xuICAgICAgICBwYXRoX29ubHkgPSB0cnVlO1xuICAgICAgICBjb25zb2xlLmxvZyhcInRpdGxlIG9ubHkgZmlsZSB3aXRoIG1hdGNoZXI6IFwiICsgdGhpcy5wYXRoX29ubHlbal0pO1xuICAgICAgICAvLyBicmVhayBvdXQgb2YgbG9vcFxuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gICAgLy8gcmV0dXJuIGVhcmx5IGlmIHBhdGhfb25seVxuICAgIGlmKHBhdGhfb25seSkge1xuICAgICAgcmVxX2JhdGNoLnB1c2goW2N1cnJfZmlsZV9rZXksIGZpbGVfZW1iZWRfaW5wdXQsIHtcbiAgICAgICAgbXRpbWU6IGN1cnJfZmlsZS5zdGF0Lm10aW1lLFxuICAgICAgICBwYXRoOiBjdXJyX2ZpbGUucGF0aCxcbiAgICAgIH1dKTtcbiAgICAgIGF3YWl0IHRoaXMuZ2V0X2VtYmVkZGluZ3NfYmF0Y2gocmVxX2JhdGNoKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgLyoqXG4gICAgICogQkVHSU4gQ2FudmFzIGZpbGUgdHlwZSBFbWJlZGRpbmdcbiAgICAgKi9cbiAgICBpZihjdXJyX2ZpbGUuZXh0ZW5zaW9uID09PSBcImNhbnZhc1wiKSB7XG4gICAgICAvLyBnZXQgZmlsZSBjb250ZW50cyBhbmQgcGFyc2UgYXMgSlNPTlxuICAgICAgY29uc3QgY2FudmFzX2NvbnRlbnRzID0gYXdhaXQgdGhpcy5hcHAudmF1bHQuY2FjaGVkUmVhZChjdXJyX2ZpbGUpO1xuICAgICAgaWYoKHR5cGVvZiBjYW52YXNfY29udGVudHMgPT09IFwic3RyaW5nXCIpICYmIChjYW52YXNfY29udGVudHMuaW5kZXhPZihcIm5vZGVzXCIpID4gLTEpKSB7XG4gICAgICAgIGNvbnN0IGNhbnZhc19qc29uID0gSlNPTi5wYXJzZShjYW52YXNfY29udGVudHMpO1xuICAgICAgICAvLyBmb3IgZWFjaCBvYmplY3QgaW4gbm9kZXMgYXJyYXlcbiAgICAgICAgZm9yKGxldCBqID0gMDsgaiA8IGNhbnZhc19qc29uLm5vZGVzLmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgLy8gaWYgb2JqZWN0IGhhcyB0ZXh0IHByb3BlcnR5XG4gICAgICAgICAgaWYoY2FudmFzX2pzb24ubm9kZXNbal0udGV4dCkge1xuICAgICAgICAgICAgLy8gYWRkIHRvIGZpbGVfZW1iZWRfaW5wdXRcbiAgICAgICAgICAgIGZpbGVfZW1iZWRfaW5wdXQgKz0gXCJcXG5cIiArIGNhbnZhc19qc29uLm5vZGVzW2pdLnRleHQ7XG4gICAgICAgICAgfVxuICAgICAgICAgIC8vIGlmIG9iamVjdCBoYXMgZmlsZSBwcm9wZXJ0eVxuICAgICAgICAgIGlmKGNhbnZhc19qc29uLm5vZGVzW2pdLmZpbGUpIHtcbiAgICAgICAgICAgIC8vIGFkZCB0byBmaWxlX2VtYmVkX2lucHV0XG4gICAgICAgICAgICBmaWxlX2VtYmVkX2lucHV0ICs9IFwiXFxuTGluazogXCIgKyBjYW52YXNfanNvbi5ub2Rlc1tqXS5maWxlO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgLy8gY29uc29sZS5sb2coZmlsZV9lbWJlZF9pbnB1dCk7XG4gICAgICByZXFfYmF0Y2gucHVzaChbY3Vycl9maWxlX2tleSwgZmlsZV9lbWJlZF9pbnB1dCwge1xuICAgICAgICBtdGltZTogY3Vycl9maWxlLnN0YXQubXRpbWUsXG4gICAgICAgIHBhdGg6IGN1cnJfZmlsZS5wYXRoLFxuICAgICAgfV0pO1xuICAgICAgYXdhaXQgdGhpcy5nZXRfZW1iZWRkaW5nc19iYXRjaChyZXFfYmF0Y2gpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBcbiAgICAvKipcbiAgICAgKiBCRUdJTiBCbG9jayBcInNlY3Rpb25cIiBlbWJlZGRpbmdcbiAgICAgKi9cbiAgICAvLyBnZXQgZmlsZSBjb250ZW50c1xuICAgIGNvbnN0IG5vdGVfY29udGVudHMgPSBhd2FpdCB0aGlzLmFwcC52YXVsdC5jYWNoZWRSZWFkKGN1cnJfZmlsZSk7XG4gICAgbGV0IHByb2Nlc3NlZF9zaW5jZV9sYXN0X3NhdmUgPSAwO1xuICAgIGNvbnN0IG5vdGVfc2VjdGlvbnMgPSB0aGlzLmJsb2NrX3BhcnNlcihub3RlX2NvbnRlbnRzLCBjdXJyX2ZpbGUucGF0aCk7XG4gICAgLy8gY29uc29sZS5sb2cobm90ZV9zZWN0aW9ucyk7XG4gICAgLy8gaWYgbm90ZSBoYXMgbW9yZSB0aGFuIG9uZSBzZWN0aW9uIChpZiBvbmx5IG9uZSB0aGVuIGl0cyBzYW1lIGFzIGZ1bGwtY29udGVudClcbiAgICBpZihub3RlX3NlY3Rpb25zLmxlbmd0aCA+IDEpIHtcbiAgICAgIC8vIGZvciBlYWNoIHNlY3Rpb24gaW4gZmlsZVxuICAgICAgLy9jb25zb2xlLmxvZyhcIlNlY3Rpb25zOiBcIiArIG5vdGVfc2VjdGlvbnMubGVuZ3RoKTtcbiAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgbm90ZV9zZWN0aW9ucy5sZW5ndGg7IGorKykge1xuICAgICAgICAvLyBnZXQgZW1iZWRfaW5wdXQgZm9yIGJsb2NrXG4gICAgICAgIGNvbnN0IGJsb2NrX2VtYmVkX2lucHV0ID0gbm90ZV9zZWN0aW9uc1tqXS50ZXh0O1xuICAgICAgICAvLyBjb25zb2xlLmxvZyhub3RlX3NlY3Rpb25zW2pdLnBhdGgpO1xuICAgICAgICAvLyBnZXQgYmxvY2sga2V5IGZyb20gYmxvY2sucGF0aCAoY29udGFpbnMgYm90aCBmaWxlLnBhdGggYW5kIGhlYWRlciBwYXRoKVxuICAgICAgICBjb25zdCBibG9ja19rZXkgPSBtZDUobm90ZV9zZWN0aW9uc1tqXS5wYXRoKTtcbiAgICAgICAgYmxvY2tzLnB1c2goYmxvY2tfa2V5KTtcbiAgICAgICAgLy8gc2tpcCBpZiBsZW5ndGggb2YgYmxvY2tfZW1iZWRfaW5wdXQgc2FtZSBhcyBsZW5ndGggb2YgZW1iZWRkaW5nc1tibG9ja19rZXldLm1ldGEuc2l6ZVxuICAgICAgICAvLyBUT0RPIGNvbnNpZGVyIHJvdW5kaW5nIHRvIG5lYXJlc3QgMTAgb3IgMTAwIGZvciBmdXp6eSBtYXRjaGluZ1xuICAgICAgICBpZiAodGhpcy5zbWFydF92ZWNfbGl0ZS5nZXRfc2l6ZShibG9ja19rZXkpID09PSBibG9ja19lbWJlZF9pbnB1dC5sZW5ndGgpIHtcbiAgICAgICAgICAvLyBsb2cgc2tpcHBpbmcgZmlsZVxuICAgICAgICAgIC8vIGNvbnNvbGUubG9nKFwic2tpcHBpbmcgYmxvY2sgKGxlbilcIik7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgICAgLy8gYWRkIGhhc2ggdG8gYmxvY2tzIHRvIHByZXZlbnQgZW1wdHkgYmxvY2tzIHRyaWdnZXJpbmcgZnVsbC1maWxlIGVtYmVkZGluZ1xuICAgICAgICAvLyBza2lwIGlmIGVtYmVkZGluZ3Mga2V5IGFscmVhZHkgZXhpc3RzIGFuZCBibG9jayBtdGltZSBpcyBncmVhdGVyIHRoYW4gb3IgZXF1YWwgdG8gZmlsZSBtdGltZVxuICAgICAgICBpZih0aGlzLnNtYXJ0X3ZlY19saXRlLm10aW1lX2lzX2N1cnJlbnQoYmxvY2tfa2V5LCBjdXJyX2ZpbGUuc3RhdC5tdGltZSkpIHtcbiAgICAgICAgICAvLyBsb2cgc2tpcHBpbmcgZmlsZVxuICAgICAgICAgIC8vIGNvbnNvbGUubG9nKFwic2tpcHBpbmcgYmxvY2sgKG10aW1lKVwiKTtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICAgICAgICAvLyBza2lwIGlmIGhhc2ggaXMgcHJlc2VudCBpbiBlbWJlZGRpbmdzIGFuZCBoYXNoIG9mIGJsb2NrX2VtYmVkX2lucHV0IGlzIGVxdWFsIHRvIGhhc2ggaW4gZW1iZWRkaW5nc1xuICAgICAgICBjb25zdCBibG9ja19oYXNoID0gbWQ1KGJsb2NrX2VtYmVkX2lucHV0LnRyaW0oKSk7XG4gICAgICAgIGlmKHRoaXMuc21hcnRfdmVjX2xpdGUuZ2V0X2hhc2goYmxvY2tfa2V5KSA9PT0gYmxvY2tfaGFzaCkge1xuICAgICAgICAgIC8vIGxvZyBza2lwcGluZyBmaWxlXG4gICAgICAgICAgLy8gY29uc29sZS5sb2coXCJza2lwcGluZyBibG9jayAoaGFzaClcIik7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBjcmVhdGUgcmVxX2JhdGNoIGZvciBiYXRjaGluZyByZXF1ZXN0c1xuICAgICAgICByZXFfYmF0Y2gucHVzaChbYmxvY2tfa2V5LCBibG9ja19lbWJlZF9pbnB1dCwge1xuICAgICAgICAgIC8vIG9sZG10aW1lOiBjdXJyX2ZpbGUuc3RhdC5tdGltZSwgXG4gICAgICAgICAgLy8gZ2V0IGN1cnJlbnQgZGF0ZXRpbWUgYXMgdW5peCB0aW1lc3RhbXBcbiAgICAgICAgICBtdGltZTogRGF0ZS5ub3coKSxcbiAgICAgICAgICBoYXNoOiBibG9ja19oYXNoLCBcbiAgICAgICAgICBwYXJlbnQ6IGN1cnJfZmlsZV9rZXksXG4gICAgICAgICAgcGF0aDogbm90ZV9zZWN0aW9uc1tqXS5wYXRoLFxuICAgICAgICAgIHNpemU6IGJsb2NrX2VtYmVkX2lucHV0Lmxlbmd0aCxcbiAgICAgICAgfV0pO1xuICAgICAgICBpZihyZXFfYmF0Y2gubGVuZ3RoID4gOSkge1xuICAgICAgICAgIC8vIGFkZCBiYXRjaCB0byBiYXRjaF9wcm9taXNlc1xuICAgICAgICAgIGF3YWl0IHRoaXMuZ2V0X2VtYmVkZGluZ3NfYmF0Y2gocmVxX2JhdGNoKTtcbiAgICAgICAgICBwcm9jZXNzZWRfc2luY2VfbGFzdF9zYXZlICs9IHJlcV9iYXRjaC5sZW5ndGg7XG4gICAgICAgICAgLy8gbG9nIGVtYmVkZGluZ1xuICAgICAgICAgIC8vIGNvbnNvbGUubG9nKFwiZW1iZWRkaW5nOiBcIiArIGN1cnJfZmlsZS5wYXRoKTtcbiAgICAgICAgICBpZiAocHJvY2Vzc2VkX3NpbmNlX2xhc3Rfc2F2ZSA+PSAzMCkge1xuICAgICAgICAgICAgLy8gd3JpdGUgZW1iZWRkaW5ncyBKU09OIHRvIGZpbGVcbiAgICAgICAgICAgIGF3YWl0IHRoaXMuc2F2ZV9lbWJlZGRpbmdzX3RvX2ZpbGUoKTtcbiAgICAgICAgICAgIC8vIHJlc2V0IHByb2Nlc3NlZF9zaW5jZV9sYXN0X3NhdmVcbiAgICAgICAgICAgIHByb2Nlc3NlZF9zaW5jZV9sYXN0X3NhdmUgPSAwO1xuICAgICAgICAgIH1cbiAgICAgICAgICAvLyByZXNldCByZXFfYmF0Y2hcbiAgICAgICAgICByZXFfYmF0Y2ggPSBbXTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICAvLyBpZiByZXFfYmF0Y2ggaXMgbm90IGVtcHR5XG4gICAgaWYocmVxX2JhdGNoLmxlbmd0aCA+IDApIHtcbiAgICAgIC8vIHByb2Nlc3MgcmVtYWluaW5nIHJlcV9iYXRjaFxuICAgICAgYXdhaXQgdGhpcy5nZXRfZW1iZWRkaW5nc19iYXRjaChyZXFfYmF0Y2gpO1xuICAgICAgcmVxX2JhdGNoID0gW107XG4gICAgICBwcm9jZXNzZWRfc2luY2VfbGFzdF9zYXZlICs9IHJlcV9iYXRjaC5sZW5ndGg7XG4gICAgfVxuICAgIFxuICAgIC8qKlxuICAgICAqIEJFR0lOIEZpbGUgXCJmdWxsIG5vdGVcIiBlbWJlZGRpbmdcbiAgICAgKi9cblxuICAgIC8vIGlmIGZpbGUgbGVuZ3RoIGlzIGxlc3MgdGhhbiB+ODAwMCB0b2tlbnMgdXNlIGZ1bGwgZmlsZSBjb250ZW50c1xuICAgIC8vIGVsc2UgaWYgZmlsZSBsZW5ndGggaXMgZ3JlYXRlciB0aGFuIDgwMDAgdG9rZW5zIGJ1aWxkIGZpbGVfZW1iZWRfaW5wdXQgZnJvbSBmaWxlIGhlYWRpbmdzXG4gICAgZmlsZV9lbWJlZF9pbnB1dCArPSBgOlxcbmA7XG4gICAgLyoqXG4gICAgICogVE9ETzogaW1wcm92ZS9yZWZhY3RvciB0aGUgZm9sbG93aW5nIFwibGFyZ2UgZmlsZSByZWR1Y2UgdG8gaGVhZGluZ3NcIiBsb2dpY1xuICAgICAqL1xuICAgIGlmKG5vdGVfY29udGVudHMubGVuZ3RoIDwgTUFYX0VNQkVEX1NUUklOR19MRU5HVEgpIHtcbiAgICAgIGZpbGVfZW1iZWRfaW5wdXQgKz0gbm90ZV9jb250ZW50c1xuICAgIH1lbHNleyBcbiAgICAgIGNvbnN0IG5vdGVfbWV0YV9jYWNoZSA9IHRoaXMuYXBwLm1ldGFkYXRhQ2FjaGUuZ2V0RmlsZUNhY2hlKGN1cnJfZmlsZSk7XG4gICAgICAvLyBmb3IgZWFjaCBoZWFkaW5nIGluIGZpbGVcbiAgICAgIGlmKHR5cGVvZiBub3RlX21ldGFfY2FjaGUuaGVhZGluZ3MgPT09IFwidW5kZWZpbmVkXCIpIHtcbiAgICAgICAgLy8gY29uc29sZS5sb2coXCJubyBoZWFkaW5ncyBmb3VuZCwgdXNpbmcgZmlyc3QgY2h1bmsgb2YgZmlsZSBpbnN0ZWFkXCIpO1xuICAgICAgICBmaWxlX2VtYmVkX2lucHV0ICs9IG5vdGVfY29udGVudHMuc3Vic3RyaW5nKDAsIE1BWF9FTUJFRF9TVFJJTkdfTEVOR1RIKTtcbiAgICAgIH1lbHNle1xuICAgICAgICBsZXQgbm90ZV9oZWFkaW5ncyA9IFwiXCI7XG4gICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgbm90ZV9tZXRhX2NhY2hlLmhlYWRpbmdzLmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgLy8gZ2V0IGhlYWRpbmcgbGV2ZWxcbiAgICAgICAgICBjb25zdCBoZWFkaW5nX2xldmVsID0gbm90ZV9tZXRhX2NhY2hlLmhlYWRpbmdzW2pdLmxldmVsO1xuICAgICAgICAgIC8vIGdldCBoZWFkaW5nIHRleHRcbiAgICAgICAgICBjb25zdCBoZWFkaW5nX3RleHQgPSBub3RlX21ldGFfY2FjaGUuaGVhZGluZ3Nbal0uaGVhZGluZztcbiAgICAgICAgICAvLyBidWlsZCBtYXJrZG93biBoZWFkaW5nXG4gICAgICAgICAgbGV0IG1kX2hlYWRpbmcgPSBcIlwiO1xuICAgICAgICAgIGZvciAobGV0IGsgPSAwOyBrIDwgaGVhZGluZ19sZXZlbDsgaysrKSB7XG4gICAgICAgICAgICBtZF9oZWFkaW5nICs9IFwiI1wiO1xuICAgICAgICAgIH1cbiAgICAgICAgICAvLyBhZGQgaGVhZGluZyB0byBub3RlX2hlYWRpbmdzXG4gICAgICAgICAgbm90ZV9oZWFkaW5ncyArPSBgJHttZF9oZWFkaW5nfSAke2hlYWRpbmdfdGV4dH1cXG5gO1xuICAgICAgICB9XG4gICAgICAgIC8vY29uc29sZS5sb2cobm90ZV9oZWFkaW5ncyk7XG4gICAgICAgIGZpbGVfZW1iZWRfaW5wdXQgKz0gbm90ZV9oZWFkaW5nc1xuICAgICAgICBpZihmaWxlX2VtYmVkX2lucHV0Lmxlbmd0aCA+IE1BWF9FTUJFRF9TVFJJTkdfTEVOR1RIKSB7XG4gICAgICAgICAgZmlsZV9lbWJlZF9pbnB1dCA9IGZpbGVfZW1iZWRfaW5wdXQuc3Vic3RyaW5nKDAsIE1BWF9FTUJFRF9TVFJJTkdfTEVOR1RIKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICAvLyBza2lwIGVtYmVkZGluZyBmdWxsIGZpbGUgaWYgYmxvY2tzIGlzIG5vdCBlbXB0eSBhbmQgYWxsIGhhc2hlcyBhcmUgcHJlc2VudCBpbiBlbWJlZGRpbmdzXG4gICAgLy8gYmV0dGVyIHRoYW4gaGFzaGluZyBmaWxlX2VtYmVkX2lucHV0IGJlY2F1c2UgbW9yZSByZXNpbGllbnQgdG8gaW5jb25zZXF1ZW50aWFsIGNoYW5nZXMgKHdoaXRlc3BhY2UgYmV0d2VlbiBoZWFkaW5ncylcbiAgICBjb25zdCBmaWxlX2hhc2ggPSBtZDUoZmlsZV9lbWJlZF9pbnB1dC50cmltKCkpO1xuICAgIGNvbnN0IGV4aXN0aW5nX2hhc2ggPSB0aGlzLnNtYXJ0X3ZlY19saXRlLmdldF9oYXNoKGN1cnJfZmlsZV9rZXkpO1xuICAgIGlmKGV4aXN0aW5nX2hhc2ggJiYgKGZpbGVfaGFzaCA9PT0gZXhpc3RpbmdfaGFzaCkpIHtcbiAgICAgIC8vIGNvbnNvbGUubG9nKFwic2tpcHBpbmcgZmlsZSAoaGFzaCk6IFwiICsgY3Vycl9maWxlLnBhdGgpO1xuICAgICAgdGhpcy51cGRhdGVfcmVuZGVyX2xvZyhibG9ja3MsIGZpbGVfZW1iZWRfaW5wdXQpO1xuICAgICAgcmV0dXJuO1xuICAgIH07XG5cbiAgICAvLyBpZiBub3QgYWxyZWFkeSBza2lwcGluZyBhbmQgYmxvY2tzIGFyZSBwcmVzZW50XG4gICAgY29uc3QgZXhpc3RpbmdfYmxvY2tzID0gdGhpcy5zbWFydF92ZWNfbGl0ZS5nZXRfY2hpbGRyZW4oY3Vycl9maWxlX2tleSk7XG4gICAgbGV0IGV4aXN0aW5nX2hhc19hbGxfYmxvY2tzID0gdHJ1ZTtcbiAgICBpZihleGlzdGluZ19ibG9ja3MgJiYgQXJyYXkuaXNBcnJheShleGlzdGluZ19ibG9ja3MpICYmIChibG9ja3MubGVuZ3RoID4gMCkpIHtcbiAgICAgIC8vIGlmIGFsbCBibG9ja3MgYXJlIGluIGV4aXN0aW5nX2Jsb2NrcyB0aGVuIHNraXAgKGFsbG93cyBkZWxldGlvbiBvZiBzbWFsbCBibG9ja3Mgd2l0aG91dCB0cmlnZ2VyaW5nIGZ1bGwgZmlsZSBlbWJlZGRpbmcpXG4gICAgICBmb3IgKGxldCBqID0gMDsgaiA8IGJsb2Nrcy5sZW5ndGg7IGorKykge1xuICAgICAgICBpZihleGlzdGluZ19ibG9ja3MuaW5kZXhPZihibG9ja3Nbal0pID09PSAtMSkge1xuICAgICAgICAgIGV4aXN0aW5nX2hhc19hbGxfYmxvY2tzID0gZmFsc2U7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgLy8gaWYgZXhpc3RpbmcgaGFzIGFsbCBibG9ja3MgdGhlbiBjaGVjayBmaWxlIHNpemUgZm9yIGRlbHRhXG4gICAgaWYoZXhpc3RpbmdfaGFzX2FsbF9ibG9ja3Mpe1xuICAgICAgLy8gZ2V0IGN1cnJlbnQgbm90ZSBmaWxlIHNpemVcbiAgICAgIGNvbnN0IGN1cnJfZmlsZV9zaXplID0gY3Vycl9maWxlLnN0YXQuc2l6ZTtcbiAgICAgIC8vIGdldCBmaWxlIHNpemUgZnJvbSBlbWJlZGRpbmdzXG4gICAgICBjb25zdCBwcmV2X2ZpbGVfc2l6ZSA9IHRoaXMuc21hcnRfdmVjX2xpdGUuZ2V0X3NpemUoY3Vycl9maWxlX2tleSk7XG4gICAgICBpZiAocHJldl9maWxlX3NpemUpIHtcbiAgICAgICAgLy8gaWYgY3VyciBmaWxlIHNpemUgaXMgbGVzcyB0aGFuIDEwJSBkaWZmZXJlbnQgZnJvbSBwcmV2IGZpbGUgc2l6ZVxuICAgICAgICBjb25zdCBmaWxlX2RlbHRhX3BjdCA9IE1hdGgucm91bmQoKE1hdGguYWJzKGN1cnJfZmlsZV9zaXplIC0gcHJldl9maWxlX3NpemUpIC8gY3Vycl9maWxlX3NpemUpICogMTAwKTtcbiAgICAgICAgaWYoZmlsZV9kZWx0YV9wY3QgPCAxMCkge1xuICAgICAgICAgIC8vIHNraXAgZW1iZWRkaW5nXG4gICAgICAgICAgLy8gY29uc29sZS5sb2coXCJza2lwcGluZyBmaWxlIChzaXplKSBcIiArIGN1cnJfZmlsZS5wYXRoKTtcbiAgICAgICAgICB0aGlzLnJlbmRlcl9sb2cuc2tpcHBlZF9sb3dfZGVsdGFbY3Vycl9maWxlLm5hbWVdID0gZmlsZV9kZWx0YV9wY3QgKyBcIiVcIjtcbiAgICAgICAgICB0aGlzLnVwZGF0ZV9yZW5kZXJfbG9nKGJsb2NrcywgZmlsZV9lbWJlZF9pbnB1dCk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIGxldCBtZXRhID0ge1xuICAgICAgbXRpbWU6IGN1cnJfZmlsZS5zdGF0Lm10aW1lLFxuICAgICAgaGFzaDogZmlsZV9oYXNoLFxuICAgICAgcGF0aDogY3Vycl9maWxlLnBhdGgsXG4gICAgICBzaXplOiBjdXJyX2ZpbGUuc3RhdC5zaXplLFxuICAgICAgY2hpbGRyZW46IGJsb2NrcyxcbiAgICB9O1xuICAgIC8vIGJhdGNoX3Byb21pc2VzLnB1c2godGhpcy5nZXRfZW1iZWRkaW5ncyhjdXJyX2ZpbGVfa2V5LCBmaWxlX2VtYmVkX2lucHV0LCBtZXRhKSk7XG4gICAgcmVxX2JhdGNoLnB1c2goW2N1cnJfZmlsZV9rZXksIGZpbGVfZW1iZWRfaW5wdXQsIG1ldGFdKTtcbiAgICAvLyBzZW5kIGJhdGNoIHJlcXVlc3RcbiAgICBhd2FpdCB0aGlzLmdldF9lbWJlZGRpbmdzX2JhdGNoKHJlcV9iYXRjaCk7XG5cbiAgICAvLyBsb2cgZW1iZWRkaW5nXG4gICAgLy8gY29uc29sZS5sb2coXCJlbWJlZGRpbmc6IFwiICsgY3Vycl9maWxlLnBhdGgpO1xuICAgIGlmIChzYXZlKSB7XG4gICAgICAvLyB3cml0ZSBlbWJlZGRpbmdzIEpTT04gdG8gZmlsZVxuICAgICAgYXdhaXQgdGhpcy5zYXZlX2VtYmVkZGluZ3NfdG9fZmlsZSgpO1xuICAgIH1cblxuICB9XG5cbiAgdXBkYXRlX3JlbmRlcl9sb2coYmxvY2tzLCBmaWxlX2VtYmVkX2lucHV0KSB7XG4gICAgaWYgKGJsb2Nrcy5sZW5ndGggPiAwKSB7XG4gICAgICAvLyBtdWx0aXBseSBieSAyIGJlY2F1c2UgaW1wbGllcyB3ZSBzYXZlZCB0b2tlbiBzcGVuZGluZyBvbiBibG9ja3Moc2VjdGlvbnMpLCB0b29cbiAgICAgIHRoaXMucmVuZGVyX2xvZy50b2tlbnNfc2F2ZWRfYnlfY2FjaGUgKz0gZmlsZV9lbWJlZF9pbnB1dC5sZW5ndGggLyAyO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBjYWxjIHRva2VucyBzYXZlZCBieSBjYWNoZTogZGl2aWRlIGJ5IDQgZm9yIHRva2VuIGVzdGltYXRlXG4gICAgICB0aGlzLnJlbmRlcl9sb2cudG9rZW5zX3NhdmVkX2J5X2NhY2hlICs9IGZpbGVfZW1iZWRfaW5wdXQubGVuZ3RoIC8gNDtcbiAgICB9XG4gIH1cblxuICBhc3luYyBnZXRfZW1iZWRkaW5nc19iYXRjaChyZXFfYmF0Y2gpIHtcbiAgICBjb25zb2xlLmxvZyhcImdldF9lbWJlZGRpbmdzX2JhdGNoXCIpO1xuICAgIC8vIGlmIHJlcV9iYXRjaCBpcyBlbXB0eSB0aGVuIHJldHVyblxuICAgIGlmKHJlcV9iYXRjaC5sZW5ndGggPT09IDApIHJldHVybjtcbiAgICAvLyBjcmVhdGUgYXJyYXJ5IG9mIGVtYmVkX2lucHV0cyBmcm9tIHJlcV9iYXRjaFtpXVsxXVxuICAgIGNvbnN0IGVtYmVkX2lucHV0cyA9IHJlcV9iYXRjaC5tYXAoKHJlcSkgPT4gcmVxWzFdKTtcbiAgICAvLyByZXF1ZXN0IGVtYmVkZGluZ3MgZnJvbSBlbWJlZF9pbnB1dHNcbiAgICBjb25zdCByZXF1ZXN0UmVzdWx0cyA9IGF3YWl0IHRoaXMucmVxdWVzdF9lbWJlZGRpbmdfZnJvbV9pbnB1dChlbWJlZF9pbnB1dHMpO1xuICAgIC8vIGlmIHJlcXVlc3RSZXN1bHRzIGlzIG51bGwgdGhlbiByZXR1cm5cbiAgICBpZighcmVxdWVzdFJlc3VsdHMpIHtcbiAgICAgIGNvbnNvbGUubG9nKFwiZmFpbGVkIGVtYmVkZGluZyBiYXRjaFwiKTtcbiAgICAgIC8vIGxvZyBmYWlsZWQgZmlsZSBuYW1lcyB0byByZW5kZXJfbG9nXG4gICAgICB0aGlzLnJlbmRlcl9sb2cuZmFpbGVkX2VtYmVkZGluZ3MgPSBbLi4udGhpcy5yZW5kZXJfbG9nLmZhaWxlZF9lbWJlZGRpbmdzLCAuLi5yZXFfYmF0Y2gubWFwKChyZXEpID0+IHJlcVsyXS5wYXRoKV07XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIC8vIGlmIHJlcXVlc3RSZXN1bHRzIGlzIG5vdCBudWxsXG4gICAgaWYocmVxdWVzdFJlc3VsdHMpe1xuICAgICAgdGhpcy5oYXNfbmV3X2VtYmVkZGluZ3MgPSB0cnVlO1xuICAgICAgLy8gYWRkIGVtYmVkZGluZyBrZXkgdG8gcmVuZGVyX2xvZ1xuICAgICAgaWYodGhpcy5zZXR0aW5ncy5sb2dfcmVuZGVyKXtcbiAgICAgICAgaWYodGhpcy5zZXR0aW5ncy5sb2dfcmVuZGVyX2ZpbGVzKXtcbiAgICAgICAgICB0aGlzLnJlbmRlcl9sb2cuZmlsZXMgPSBbLi4udGhpcy5yZW5kZXJfbG9nLmZpbGVzLCAuLi5yZXFfYmF0Y2gubWFwKChyZXEpID0+IHJlcVsyXS5wYXRoKV07XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5yZW5kZXJfbG9nLm5ld19lbWJlZGRpbmdzICs9IHJlcV9iYXRjaC5sZW5ndGg7XG4gICAgICAgIC8vIGFkZCB0b2tlbiB1c2FnZSB0byByZW5kZXJfbG9nXG4gICAgICAgIHRoaXMucmVuZGVyX2xvZy50b2tlbl91c2FnZSArPSByZXF1ZXN0UmVzdWx0cy51c2FnZS50b3RhbF90b2tlbnM7XG4gICAgICB9XG4gICAgICAvLyBjb25zb2xlLmxvZyhyZXF1ZXN0UmVzdWx0cy5kYXRhLmxlbmd0aCk7XG4gICAgICAvLyBsb29wIHRocm91Z2ggcmVxdWVzdFJlc3VsdHMuZGF0YVxuICAgICAgZm9yKGxldCBpID0gMDsgaSA8IHJlcXVlc3RSZXN1bHRzLmRhdGEubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgY29uc3QgdmVjID0gcmVxdWVzdFJlc3VsdHMuZGF0YVtpXS5lbWJlZGRpbmc7XG4gICAgICAgIGNvbnN0IGluZGV4ID0gcmVxdWVzdFJlc3VsdHMuZGF0YVtpXS5pbmRleDtcbiAgICAgICAgaWYodmVjKSB7XG4gICAgICAgICAgY29uc3Qga2V5ID0gcmVxX2JhdGNoW2luZGV4XVswXTtcbiAgICAgICAgICBjb25zdCBtZXRhID0gcmVxX2JhdGNoW2luZGV4XVsyXTtcbiAgICAgICAgICB0aGlzLnNtYXJ0X3ZlY19saXRlLnNhdmVfZW1iZWRkaW5nKGtleSwgdmVjLCBtZXRhKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGFzeW5jIHJlcXVlc3RfZW1iZWRkaW5nX2Zyb21faW5wdXQoZW1iZWRfaW5wdXQsIHJldHJpZXMgPSAwKSB7XG4gICAgLy8gKEZPUiBURVNUSU5HKSB0ZXN0IGZhaWwgcHJvY2VzcyBieSBmb3JjaW5nIGZhaWxcbiAgICAvLyByZXR1cm4gbnVsbDtcbiAgICAvLyBjaGVjayBpZiBlbWJlZF9pbnB1dCBpcyBhIHN0cmluZ1xuICAgIC8vIGlmKHR5cGVvZiBlbWJlZF9pbnB1dCAhPT0gXCJzdHJpbmdcIikge1xuICAgIC8vICAgY29uc29sZS5sb2coXCJlbWJlZF9pbnB1dCBpcyBub3QgYSBzdHJpbmdcIik7XG4gICAgLy8gICByZXR1cm4gbnVsbDtcbiAgICAvLyB9XG4gICAgLy8gY2hlY2sgaWYgZW1iZWRfaW5wdXQgaXMgZW1wdHlcbiAgICBpZihlbWJlZF9pbnB1dC5sZW5ndGggPT09IDApIHtcbiAgICAgIGNvbnNvbGUubG9nKFwiZW1iZWRfaW5wdXQgaXMgZW1wdHlcIik7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgY29uc3QgdXNlZFBhcmFtcyA9IHtcbiAgICAgIG1vZGVsOiBcInRleHQtZW1iZWRkaW5nLWFkYS0wMDJcIixcbiAgICAgIGlucHV0OiBlbWJlZF9pbnB1dCxcbiAgICB9O1xuICAgIC8vIGNvbnNvbGUubG9nKHRoaXMuc2V0dGluZ3MuYXBpX2tleSk7XG4gICAgY29uc3QgcmVxUGFyYW1zID0ge1xuICAgICAgdXJsOiBgaHR0cHM6Ly9hcGkub3BlbmFpLmNvbS92MS9lbWJlZGRpbmdzYCxcbiAgICAgIG1ldGhvZDogXCJQT1NUXCIsXG4gICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh1c2VkUGFyYW1zKSxcbiAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgXCJDb250ZW50LVR5cGVcIjogXCJhcHBsaWNhdGlvbi9qc29uXCIsXG4gICAgICAgIFwiQXV0aG9yaXphdGlvblwiOiBgQmVhcmVyICR7dGhpcy5zZXR0aW5ncy5hcGlfa2V5fWBcbiAgICAgIH1cbiAgICB9O1xuICAgIGxldCByZXNwO1xuICAgIHRyeSB7XG4gICAgICByZXNwID0gYXdhaXQgKDAsIE9ic2lkaWFuLnJlcXVlc3QpKHJlcVBhcmFtcylcbiAgICAgIHJldHVybiBKU09OLnBhcnNlKHJlc3ApO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAvLyByZXRyeSByZXF1ZXN0IGlmIGVycm9yIGlzIDQyOVxuICAgICAgaWYoKGVycm9yLnN0YXR1cyA9PT0gNDI5KSAmJiAocmV0cmllcyA8IDMpKSB7XG4gICAgICAgIHJldHJpZXMrKztcbiAgICAgICAgLy8gZXhwb25lbnRpYWwgYmFja29mZlxuICAgICAgICBjb25zdCBiYWNrb2ZmID0gTWF0aC5wb3cocmV0cmllcywgMik7XG4gICAgICAgIGNvbnNvbGUubG9nKGByZXRyeWluZyByZXF1ZXN0ICg0MjkpIGluICR7YmFja29mZn0gc2Vjb25kcy4uLmApO1xuICAgICAgICBhd2FpdCBuZXcgUHJvbWlzZShyID0+IHNldFRpbWVvdXQociwgMTAwMCAqIGJhY2tvZmYpKTtcbiAgICAgICAgcmV0dXJuIGF3YWl0IHRoaXMucmVxdWVzdF9lbWJlZGRpbmdfZnJvbV9pbnB1dChlbWJlZF9pbnB1dCwgcmV0cmllcyk7XG4gICAgICB9XG4gICAgICAvLyBsb2cgZnVsbCBlcnJvciB0byBjb25zb2xlXG4gICAgICBjb25zb2xlLmxvZyhyZXNwKTtcbiAgICAgIC8vIGNvbnNvbGUubG9nKFwiZmlyc3QgbGluZSBvZiBlbWJlZDogXCIgKyBlbWJlZF9pbnB1dC5zdWJzdHJpbmcoMCwgZW1iZWRfaW5wdXQuaW5kZXhPZihcIlxcblwiKSkpO1xuICAgICAgLy8gY29uc29sZS5sb2coXCJlbWJlZCBpbnB1dCBsZW5ndGg6IFwiKyBlbWJlZF9pbnB1dC5sZW5ndGgpO1xuICAgICAgLy8gaWYoQXJyYXkuaXNBcnJheShlbWJlZF9pbnB1dCkpIHtcbiAgICAgIC8vICAgY29uc29sZS5sb2coZW1iZWRfaW5wdXQubWFwKChpbnB1dCkgPT4gaW5wdXQubGVuZ3RoKSk7XG4gICAgICAvLyB9XG4gICAgICAvLyBjb25zb2xlLmxvZyhcImVycm9uZW91cyBlbWJlZCBpbnB1dDogXCIgKyBlbWJlZF9pbnB1dCk7XG4gICAgICBjb25zb2xlLmxvZyhlcnJvcik7XG4gICAgICAvLyBjb25zb2xlLmxvZyh1c2VkUGFyYW1zKTtcbiAgICAgIC8vIGNvbnNvbGUubG9nKHVzZWRQYXJhbXMuaW5wdXQubGVuZ3RoKTtcbiAgICAgIHJldHVybiBudWxsOyBcbiAgICB9XG4gIH1cbiAgYXN5bmMgdGVzdF9hcGlfa2V5KCkge1xuICAgIGNvbnN0IGVtYmVkX2lucHV0ID0gXCJUaGlzIGlzIGEgdGVzdCBvZiB0aGUgT3BlbkFJIEFQSS5cIjtcbiAgICBjb25zdCByZXNwID0gYXdhaXQgdGhpcy5yZXF1ZXN0X2VtYmVkZGluZ19mcm9tX2lucHV0KGVtYmVkX2lucHV0KTtcbiAgICBpZihyZXNwICYmIHJlc3AudXNhZ2UpIHtcbiAgICAgIGNvbnNvbGUubG9nKFwiQVBJIGtleSBpcyB2YWxpZFwiKTtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1lbHNle1xuICAgICAgY29uc29sZS5sb2coXCJBUEkga2V5IGlzIGludmFsaWRcIik7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG5cblxuICBvdXRwdXRfcmVuZGVyX2xvZygpIHtcbiAgICAvLyBpZiBzZXR0aW5ncy5sb2dfcmVuZGVyIGlzIHRydWVcbiAgICBpZih0aGlzLnNldHRpbmdzLmxvZ19yZW5kZXIpIHtcbiAgICAgIGlmICh0aGlzLnJlbmRlcl9sb2cubmV3X2VtYmVkZGluZ3MgPT09IDApIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfWVsc2V7XG4gICAgICAgIC8vIHByZXR0eSBwcmludCB0aGlzLnJlbmRlcl9sb2cgdG8gY29uc29sZVxuICAgICAgICBjb25zb2xlLmxvZyhKU09OLnN0cmluZ2lmeSh0aGlzLnJlbmRlcl9sb2csIG51bGwsIDIpKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBjbGVhciByZW5kZXJfbG9nXG4gICAgdGhpcy5yZW5kZXJfbG9nID0ge307XG4gICAgdGhpcy5yZW5kZXJfbG9nLmRlbGV0ZWRfZW1iZWRkaW5ncyA9IDA7XG4gICAgdGhpcy5yZW5kZXJfbG9nLmV4Y2x1c2lvbnNfbG9ncyA9IHt9O1xuICAgIHRoaXMucmVuZGVyX2xvZy5mYWlsZWRfZW1iZWRkaW5ncyA9IFtdO1xuICAgIHRoaXMucmVuZGVyX2xvZy5maWxlcyA9IFtdO1xuICAgIHRoaXMucmVuZGVyX2xvZy5uZXdfZW1iZWRkaW5ncyA9IDA7XG4gICAgdGhpcy5yZW5kZXJfbG9nLnNraXBwZWRfbG93X2RlbHRhID0ge307XG4gICAgdGhpcy5yZW5kZXJfbG9nLnRva2VuX3VzYWdlID0gMDtcbiAgICB0aGlzLnJlbmRlcl9sb2cudG9rZW5zX3NhdmVkX2J5X2NhY2hlID0gMDtcbiAgfVxuXG4gIC8vIGZpbmQgY29ubmVjdGlvbnMgYnkgbW9zdCBzaW1pbGFyIHRvIGN1cnJlbnQgbm90ZSBieSBjb3NpbmUgc2ltaWxhcml0eVxuICBhc3luYyBmaW5kX25vdGVfY29ubmVjdGlvbnMoY3VycmVudF9ub3RlPW51bGwpIHtcbiAgICAvLyBtZDUgb2YgY3VycmVudCBub3RlIHBhdGhcbiAgICBjb25zdCBjdXJyX2tleSA9IG1kNShjdXJyZW50X25vdGUucGF0aCk7XG4gICAgLy8gaWYgaW4gdGhpcy5uZWFyZXN0X2NhY2hlIHRoZW4gc2V0IHRvIG5lYXJlc3RcbiAgICAvLyBlbHNlIGdldCBuZWFyZXN0XG4gICAgbGV0IG5lYXJlc3QgPSBbXTtcbiAgICBpZih0aGlzLm5lYXJlc3RfY2FjaGVbY3Vycl9rZXldKSB7XG4gICAgICBuZWFyZXN0ID0gdGhpcy5uZWFyZXN0X2NhY2hlW2N1cnJfa2V5XTtcbiAgICAgIC8vIGNvbnNvbGUubG9nKFwibmVhcmVzdCBmcm9tIGNhY2hlXCIpO1xuICAgIH1lbHNle1xuICAgICAgLy8gc2tpcCBmaWxlcyB3aGVyZSBwYXRoIGNvbnRhaW5zIGFueSBleGNsdXNpb25zXG4gICAgICBmb3IobGV0IGogPSAwOyBqIDwgdGhpcy5maWxlX2V4Y2x1c2lvbnMubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgaWYoY3VycmVudF9ub3RlLnBhdGguaW5kZXhPZih0aGlzLmZpbGVfZXhjbHVzaW9uc1tqXSkgPiAtMSkge1xuICAgICAgICAgIHRoaXMubG9nX2V4Y2x1c2lvbih0aGlzLmZpbGVfZXhjbHVzaW9uc1tqXSk7XG4gICAgICAgICAgLy8gYnJlYWsgb3V0IG9mIGxvb3AgYW5kIGZpbmlzaCBoZXJlXG4gICAgICAgICAgcmV0dXJuIFwiZXhjbHVkZWRcIjtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgLy8gZ2V0IGFsbCBlbWJlZGRpbmdzXG4gICAgICAvLyBhd2FpdCB0aGlzLmdldF9hbGxfZW1iZWRkaW5ncygpO1xuICAgICAgLy8gd3JhcCBnZXQgYWxsIGluIHNldFRpbWVvdXQgdG8gYWxsb3cgZm9yIFVJIHRvIHVwZGF0ZVxuICAgICAgc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgIHRoaXMuZ2V0X2FsbF9lbWJlZGRpbmdzKClcbiAgICAgIH0sIDMwMDApO1xuICAgICAgLy8gZ2V0IGZyb20gY2FjaGUgaWYgbXRpbWUgaXMgc2FtZSBhbmQgdmFsdWVzIGFyZSBub3QgZW1wdHlcbiAgICAgIGlmKHRoaXMuc21hcnRfdmVjX2xpdGUubXRpbWVfaXNfY3VycmVudChjdXJyX2tleSwgY3VycmVudF9ub3RlLnN0YXQubXRpbWUpKSB7XG4gICAgICAgIC8vIHNraXBwaW5nIGdldCBmaWxlIGVtYmVkZGluZ3MgYmVjYXVzZSBub3RoaW5nIGhhcyBjaGFuZ2VkXG4gICAgICAgIC8vIGNvbnNvbGUubG9nKFwiZmluZF9ub3RlX2Nvbm5lY3Rpb25zIC0gc2tpcHBpbmcgZmlsZSAobXRpbWUpXCIpO1xuICAgICAgfWVsc2V7XG4gICAgICAgIC8vIGdldCBmaWxlIGVtYmVkZGluZ3NcbiAgICAgICAgYXdhaXQgdGhpcy5nZXRfZmlsZV9lbWJlZGRpbmdzKGN1cnJlbnRfbm90ZSk7XG4gICAgICB9XG4gICAgICAvLyBnZXQgY3VycmVudCBub3RlIGVtYmVkZGluZyB2ZWN0b3JcbiAgICAgIGNvbnN0IHZlYyA9IHRoaXMuc21hcnRfdmVjX2xpdGUuZ2V0X3ZlYyhjdXJyX2tleSk7XG4gICAgICBpZighdmVjKSB7XG4gICAgICAgIHJldHVybiBcIkVycm9yIGdldHRpbmcgZW1iZWRkaW5ncyBmb3I6IFwiK2N1cnJlbnRfbm90ZS5wYXRoO1xuICAgICAgfVxuICAgICAgXG4gICAgICAvLyBjb21wdXRlIGNvc2luZSBzaW1pbGFyaXR5IGJldHdlZW4gY3VycmVudCBub3RlIGFuZCBhbGwgb3RoZXIgbm90ZXMgdmlhIGVtYmVkZGluZ3NcbiAgICAgIG5lYXJlc3QgPSB0aGlzLnNtYXJ0X3ZlY19saXRlLm5lYXJlc3QodmVjLCB7XG4gICAgICAgIHNraXBfa2V5OiBjdXJyX2tleSxcbiAgICAgICAgc2tpcF9zZWN0aW9uczogdGhpcy5zZXR0aW5ncy5za2lwX3NlY3Rpb25zLFxuICAgICAgfSk7XG4gIFxuICAgICAgLy8gc2F2ZSB0byB0aGlzLm5lYXJlc3RfY2FjaGVcbiAgICAgIHRoaXMubmVhcmVzdF9jYWNoZVtjdXJyX2tleV0gPSBuZWFyZXN0O1xuICAgIH1cblxuICAgIC8vIHJldHVybiBhcnJheSBzb3J0ZWQgYnkgY29zaW5lIHNpbWlsYXJpdHlcbiAgICByZXR1cm4gbmVhcmVzdDtcbiAgfVxuICBcbiAgLy8gY3JlYXRlIHJlbmRlcl9sb2cgb2JqZWN0IG9mIGV4bHVzaW9ucyB3aXRoIG51bWJlciBvZiB0aW1lcyBza2lwcGVkIGFzIHZhbHVlXG4gIGxvZ19leGNsdXNpb24oZXhjbHVzaW9uKSB7XG4gICAgLy8gaW5jcmVtZW50IHJlbmRlcl9sb2cgZm9yIHNraXBwZWQgZmlsZVxuICAgIHRoaXMucmVuZGVyX2xvZy5leGNsdXNpb25zX2xvZ3NbZXhjbHVzaW9uXSA9ICh0aGlzLnJlbmRlcl9sb2cuZXhjbHVzaW9uc19sb2dzW2V4Y2x1c2lvbl0gfHwgMCkgKyAxO1xuICB9XG4gIFxuXG4gIGJsb2NrX3BhcnNlcihtYXJrZG93biwgZmlsZV9wYXRoKXtcbiAgICAvLyBpZiB0aGlzLnNldHRpbmdzLnNraXBfc2VjdGlvbnMgaXMgdHJ1ZSB0aGVuIHJldHVybiBlbXB0eSBhcnJheVxuICAgIGlmKHRoaXMuc2V0dGluZ3Muc2tpcF9zZWN0aW9ucykge1xuICAgICAgcmV0dXJuIFtdO1xuICAgIH1cbiAgICAvLyBzcGxpdCB0aGUgbWFya2Rvd24gaW50byBsaW5lc1xuICAgIGNvbnN0IGxpbmVzID0gbWFya2Rvd24uc3BsaXQoJ1xcbicpO1xuICAgIC8vIGluaXRpYWxpemUgdGhlIGJsb2NrcyBhcnJheVxuICAgIGxldCBibG9ja3MgPSBbXTtcbiAgICAvLyBjdXJyZW50IGhlYWRlcnMgYXJyYXlcbiAgICBsZXQgY3VycmVudEhlYWRlcnMgPSBbXTtcbiAgICAvLyByZW1vdmUgLm1kIGZpbGUgZXh0ZW5zaW9uIGFuZCBjb252ZXJ0IGZpbGVfcGF0aCB0byBicmVhZGNydW1iIGZvcm1hdHRpbmdcbiAgICBjb25zdCBmaWxlX2JyZWFkY3J1bWJzID0gZmlsZV9wYXRoLnJlcGxhY2UoJy5tZCcsICcnKS5yZXBsYWNlKC9cXC8vZywgJyA+ICcpO1xuICAgIC8vIGluaXRpYWxpemUgdGhlIGJsb2NrIHN0cmluZ1xuICAgIGxldCBibG9jayA9ICcnO1xuICAgIGxldCBibG9ja19oZWFkaW5ncyA9ICcnO1xuICAgIGxldCBibG9ja19wYXRoID0gZmlsZV9wYXRoO1xuXG4gICAgbGV0IGxhc3RfaGVhZGluZ19saW5lID0gMDtcbiAgICBsZXQgaSA9IDA7XG4gICAgbGV0IGJsb2NrX2hlYWRpbmdzX2xpc3QgPSBbXTtcbiAgICAvLyBsb29wIHRocm91Z2ggdGhlIGxpbmVzXG4gICAgZm9yIChpID0gMDsgaSA8IGxpbmVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAvLyBnZXQgdGhlIGxpbmVcbiAgICAgIGNvbnN0IGxpbmUgPSBsaW5lc1tpXTtcbiAgICAgIC8vIGlmIGxpbmUgZG9lcyBub3Qgc3RhcnQgd2l0aCAjXG4gICAgICAvLyBvciBpZiBsaW5lIHN0YXJ0cyB3aXRoICMgYW5kIHNlY29uZCBjaGFyYWN0ZXIgaXMgYSB3b3JkIG9yIG51bWJlciBpbmRpY2F0aW5nIGEgXCJ0YWdcIlxuICAgICAgLy8gdGhlbiBhZGQgdG8gYmxvY2tcbiAgICAgIGlmICghbGluZS5zdGFydHNXaXRoKCcjJykgfHwgKFsnIycsJyAnXS5pbmRleE9mKGxpbmVbMV0pIDwgMCkpe1xuICAgICAgICAvLyBza2lwIGlmIGxpbmUgaXMgZW1wdHlcbiAgICAgICAgaWYobGluZSA9PT0gJycpIGNvbnRpbnVlO1xuICAgICAgICAvLyBza2lwIGlmIGxpbmUgaXMgZW1wdHkgYnVsbGV0IG9yIGNoZWNrYm94XG4gICAgICAgIGlmKFsnLSAnLCAnLSBbIF0gJ10uaW5kZXhPZihsaW5lKSA+IC0xKSBjb250aW51ZTtcbiAgICAgICAgLy8gaWYgY3VycmVudEhlYWRlcnMgaXMgZW1wdHkgc2tpcCAob25seSBibG9ja3Mgd2l0aCBoZWFkZXJzLCBvdGhlcndpc2UgYmxvY2sucGF0aCBjb25mbGljdHMgd2l0aCBmaWxlLnBhdGgpXG4gICAgICAgIGlmKGN1cnJlbnRIZWFkZXJzLmxlbmd0aCA9PT0gMCkgY29udGludWU7XG4gICAgICAgIC8vIGFkZCBsaW5lIHRvIGJsb2NrXG4gICAgICAgIGJsb2NrICs9IFwiXFxuXCIgKyBsaW5lO1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIC8qKlxuICAgICAgICogQkVHSU4gSGVhZGluZyBwYXJzaW5nXG4gICAgICAgKiAtIGxpa2VseSBhIGhlYWRpbmcgaWYgbWFkZSBpdCB0aGlzIGZhclxuICAgICAgICovXG4gICAgICBsYXN0X2hlYWRpbmdfbGluZSA9IGk7XG4gICAgICAvLyBwdXNoIHRoZSBjdXJyZW50IGJsb2NrIHRvIHRoZSBibG9ja3MgYXJyYXkgdW5sZXNzIGxhc3QgbGluZSB3YXMgYSBhbHNvIGEgaGVhZGVyXG4gICAgICBpZihpID4gMCAmJiAobGFzdF9oZWFkaW5nX2xpbmUgIT09IChpLTEpKSAmJiAoYmxvY2suaW5kZXhPZihcIlxcblwiKSA+IC0xKSAmJiB0aGlzLnZhbGlkYXRlX2hlYWRpbmdzKGJsb2NrX2hlYWRpbmdzKSkge1xuICAgICAgICBvdXRwdXRfYmxvY2soKTtcbiAgICAgIH1cbiAgICAgIC8vIGdldCB0aGUgaGVhZGVyIGxldmVsXG4gICAgICBjb25zdCBsZXZlbCA9IGxpbmUuc3BsaXQoJyMnKS5sZW5ndGggLSAxO1xuICAgICAgLy8gcmVtb3ZlIGFueSBoZWFkZXJzIGZyb20gdGhlIGN1cnJlbnQgaGVhZGVycyBhcnJheSB0aGF0IGFyZSBoaWdoZXIgdGhhbiB0aGUgY3VycmVudCBoZWFkZXIgbGV2ZWxcbiAgICAgIGN1cnJlbnRIZWFkZXJzID0gY3VycmVudEhlYWRlcnMuZmlsdGVyKGhlYWRlciA9PiBoZWFkZXIubGV2ZWwgPCBsZXZlbCk7XG4gICAgICAvLyBhZGQgaGVhZGVyIGFuZCBsZXZlbCB0byBjdXJyZW50IGhlYWRlcnMgYXJyYXlcbiAgICAgIC8vIHRyaW0gdGhlIGhlYWRlciB0byByZW1vdmUgXCIjXCIgYW5kIGFueSB0cmFpbGluZyBzcGFjZXNcbiAgICAgIGN1cnJlbnRIZWFkZXJzLnB1c2goe2hlYWRlcjogbGluZS5yZXBsYWNlKC8jL2csICcnKS50cmltKCksIGxldmVsOiBsZXZlbH0pO1xuICAgICAgLy8gaW5pdGlhbGl6ZSB0aGUgYmxvY2sgYnJlYWRjcnVtYnMgd2l0aCBmaWxlLnBhdGggdGhlIGN1cnJlbnQgaGVhZGVyc1xuICAgICAgYmxvY2sgPSBmaWxlX2JyZWFkY3J1bWJzO1xuICAgICAgYmxvY2sgKz0gXCI6IFwiICsgY3VycmVudEhlYWRlcnMubWFwKGhlYWRlciA9PiBoZWFkZXIuaGVhZGVyKS5qb2luKCcgPiAnKTtcbiAgICAgIGJsb2NrX2hlYWRpbmdzID0gXCIjXCIrY3VycmVudEhlYWRlcnMubWFwKGhlYWRlciA9PiBoZWFkZXIuaGVhZGVyKS5qb2luKCcjJyk7XG4gICAgICAvLyBpZiBibG9ja19oZWFkaW5ncyBpcyBhbHJlYWR5IGluIGJsb2NrX2hlYWRpbmdzX2xpc3QgdGhlbiBhZGQgYSBudW1iZXIgdG8gdGhlIGVuZFxuICAgICAgaWYoYmxvY2tfaGVhZGluZ3NfbGlzdC5pbmRleE9mKGJsb2NrX2hlYWRpbmdzKSA+IC0xKSB7XG4gICAgICAgIGxldCBjb3VudCA9IDE7XG4gICAgICAgIHdoaWxlKGJsb2NrX2hlYWRpbmdzX2xpc3QuaW5kZXhPZihgJHtibG9ja19oZWFkaW5nc317JHtjb3VudH19YCkgPiAtMSkge1xuICAgICAgICAgIGNvdW50Kys7XG4gICAgICAgIH1cbiAgICAgICAgYmxvY2tfaGVhZGluZ3MgPSBgJHtibG9ja19oZWFkaW5nc317JHtjb3VudH19YDtcbiAgICAgIH1cbiAgICAgIGJsb2NrX2hlYWRpbmdzX2xpc3QucHVzaChibG9ja19oZWFkaW5ncyk7XG4gICAgICBibG9ja19wYXRoID0gZmlsZV9wYXRoICsgYmxvY2tfaGVhZGluZ3M7XG4gICAgfVxuICAgIC8vIGhhbmRsZSByZW1haW5pbmcgYWZ0ZXIgbG9vcFxuICAgIGlmKChsYXN0X2hlYWRpbmdfbGluZSAhPT0gKGktMSkpICYmIChibG9jay5pbmRleE9mKFwiXFxuXCIpID4gLTEpICYmIHRoaXMudmFsaWRhdGVfaGVhZGluZ3MoYmxvY2tfaGVhZGluZ3MpKSBvdXRwdXRfYmxvY2soKTtcbiAgICAvLyByZW1vdmUgYW55IGJsb2NrcyB0aGF0IGFyZSB0b28gc2hvcnQgKGxlbmd0aCA8IDUwKVxuICAgIGJsb2NrcyA9IGJsb2Nrcy5maWx0ZXIoYiA9PiBiLmxlbmd0aCA+IDUwKTtcbiAgICAvLyBjb25zb2xlLmxvZyhibG9ja3MpO1xuICAgIC8vIHJldHVybiB0aGUgYmxvY2tzIGFycmF5XG4gICAgcmV0dXJuIGJsb2NrcztcblxuICAgIGZ1bmN0aW9uIG91dHB1dF9ibG9jaygpIHtcbiAgICAgIC8vIGJyZWFkY3J1bWJzIGxlbmd0aCAoZmlyc3QgbGluZSBvZiBibG9jaylcbiAgICAgIGNvbnN0IGJyZWFkY3J1bWJzX2xlbmd0aCA9IGJsb2NrLmluZGV4T2YoXCJcXG5cIikgKyAxO1xuICAgICAgY29uc3QgYmxvY2tfbGVuZ3RoID0gYmxvY2subGVuZ3RoIC0gYnJlYWRjcnVtYnNfbGVuZ3RoO1xuICAgICAgLy8gdHJpbSBibG9jayB0byBtYXggbGVuZ3RoXG4gICAgICBpZiAoYmxvY2subGVuZ3RoID4gTUFYX0VNQkVEX1NUUklOR19MRU5HVEgpIHtcbiAgICAgICAgYmxvY2sgPSBibG9jay5zdWJzdHJpbmcoMCwgTUFYX0VNQkVEX1NUUklOR19MRU5HVEgpO1xuICAgICAgfVxuICAgICAgYmxvY2tzLnB1c2goeyB0ZXh0OiBibG9jay50cmltKCksIHBhdGg6IGJsb2NrX3BhdGgsIGxlbmd0aDogYmxvY2tfbGVuZ3RoIH0pO1xuICAgIH1cbiAgfVxuICAvLyByZXZlcnNlLXJldHJpZXZlIGJsb2NrIGdpdmVuIHBhdGhcbiAgYXN5bmMgYmxvY2tfcmV0cmlldmVyKHBhdGgsIGxpbWl0cz17fSkge1xuICAgIGxpbWl0cyA9IHtcbiAgICAgIGxpbmVzOiBudWxsLFxuICAgICAgY2hhcnNfcGVyX2xpbmU6IG51bGwsXG4gICAgICBtYXhfY2hhcnM6IG51bGwsXG4gICAgICAuLi5saW1pdHNcbiAgICB9XG4gICAgLy8gcmV0dXJuIGlmIG5vICMgaW4gcGF0aFxuICAgIGlmIChwYXRoLmluZGV4T2YoJyMnKSA8IDApIHtcbiAgICAgIGNvbnNvbGUubG9nKFwibm90IGEgYmxvY2sgcGF0aDogXCIrcGF0aCk7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIGxldCBibG9jayA9IFtdO1xuICAgIGxldCBibG9ja19oZWFkaW5ncyA9IHBhdGguc3BsaXQoJyMnKS5zbGljZSgxKTtcbiAgICAvLyBpZiBwYXRoIGVuZHMgd2l0aCBudW1iZXIgaW4gY3VybHkgYnJhY2VzXG4gICAgbGV0IGhlYWRpbmdfb2NjdXJyZW5jZSA9IDA7XG4gICAgaWYoYmxvY2tfaGVhZGluZ3NbYmxvY2tfaGVhZGluZ3MubGVuZ3RoLTFdLmluZGV4T2YoJ3snKSA+IC0xKSB7XG4gICAgICAvLyBnZXQgdGhlIG9jY3VycmVuY2UgbnVtYmVyXG4gICAgICBoZWFkaW5nX29jY3VycmVuY2UgPSBwYXJzZUludChibG9ja19oZWFkaW5nc1tibG9ja19oZWFkaW5ncy5sZW5ndGgtMV0uc3BsaXQoJ3snKVsxXS5yZXBsYWNlKCd9JywgJycpKTtcbiAgICAgIC8vIHJlbW92ZSB0aGUgb2NjdXJyZW5jZSBmcm9tIHRoZSBsYXN0IGhlYWRpbmdcbiAgICAgIGJsb2NrX2hlYWRpbmdzW2Jsb2NrX2hlYWRpbmdzLmxlbmd0aC0xXSA9IGJsb2NrX2hlYWRpbmdzW2Jsb2NrX2hlYWRpbmdzLmxlbmd0aC0xXS5zcGxpdCgneycpWzBdO1xuICAgIH1cbiAgICBsZXQgY3VycmVudEhlYWRlcnMgPSBbXTtcbiAgICBsZXQgb2NjdXJyZW5jZV9jb3VudCA9IDA7XG4gICAgbGV0IGJlZ2luX2xpbmUgPSAwO1xuICAgIGxldCBpID0gMDtcbiAgICAvLyBnZXQgZmlsZSBwYXRoIGZyb20gcGF0aFxuICAgIGNvbnN0IGZpbGVfcGF0aCA9IHBhdGguc3BsaXQoJyMnKVswXTtcbiAgICAvLyBnZXQgZmlsZVxuICAgIGNvbnN0IGZpbGUgPSB0aGlzLmFwcC52YXVsdC5nZXRBYnN0cmFjdEZpbGVCeVBhdGgoZmlsZV9wYXRoKTtcbiAgICBpZighKGZpbGUgaW5zdGFuY2VvZiBPYnNpZGlhbi5URmlsZSkpIHtcbiAgICAgIGNvbnNvbGUubG9nKFwibm90IGEgZmlsZTogXCIrZmlsZV9wYXRoKTtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgLy8gZ2V0IGZpbGUgY29udGVudHNcbiAgICBjb25zdCBmaWxlX2NvbnRlbnRzID0gYXdhaXQgdGhpcy5hcHAudmF1bHQuY2FjaGVkUmVhZChmaWxlKTtcbiAgICAvLyBzcGxpdCB0aGUgZmlsZSBjb250ZW50cyBpbnRvIGxpbmVzXG4gICAgY29uc3QgbGluZXMgPSBmaWxlX2NvbnRlbnRzLnNwbGl0KCdcXG4nKTtcbiAgICAvLyBsb29wIHRocm91Z2ggdGhlIGxpbmVzXG4gICAgbGV0IGlzX2NvZGUgPSBmYWxzZTtcbiAgICBmb3IgKGkgPSAwOyBpIDwgbGluZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgIC8vIGdldCB0aGUgbGluZVxuICAgICAgY29uc3QgbGluZSA9IGxpbmVzW2ldO1xuICAgICAgLy8gaWYgbGluZSBiZWdpbnMgd2l0aCB0aHJlZSBiYWNrdGlja3MgdGhlbiB0b2dnbGUgaXNfY29kZVxuICAgICAgaWYobGluZS5pbmRleE9mKCdgYGAnKSA9PT0gMCkge1xuICAgICAgICBpc19jb2RlID0gIWlzX2NvZGU7XG4gICAgICB9XG4gICAgICAvLyBpZiBpc19jb2RlIGlzIHRydWUgdGhlbiBhZGQgbGluZSB3aXRoIHByZWNlZGluZyB0YWIgYW5kIGNvbnRpbnVlXG4gICAgICBpZihpc19jb2RlKSB7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgICAgLy8gc2tpcCBpZiBsaW5lIGlzIGVtcHR5IGJ1bGxldCBvciBjaGVja2JveFxuICAgICAgaWYoWyctICcsICctIFsgXSAnXS5pbmRleE9mKGxpbmUpID4gLTEpIGNvbnRpbnVlO1xuICAgICAgLy8gaWYgbGluZSBkb2VzIG5vdCBzdGFydCB3aXRoICNcbiAgICAgIC8vIG9yIGlmIGxpbmUgc3RhcnRzIHdpdGggIyBhbmQgc2Vjb25kIGNoYXJhY3RlciBpcyBhIHdvcmQgb3IgbnVtYmVyIGluZGljYXRpbmcgYSBcInRhZ1wiXG4gICAgICAvLyB0aGVuIGNvbnRpbnVlIHRvIG5leHQgbGluZVxuICAgICAgaWYgKCFsaW5lLnN0YXJ0c1dpdGgoJyMnKSB8fCAoWycjJywnICddLmluZGV4T2YobGluZVsxXSkgPCAwKSl7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgICAgLyoqXG4gICAgICAgKiBCRUdJTiBIZWFkaW5nIHBhcnNpbmdcbiAgICAgICAqIC0gbGlrZWx5IGEgaGVhZGluZyBpZiBtYWRlIGl0IHRoaXMgZmFyXG4gICAgICAgKi9cbiAgICAgIC8vIGdldCB0aGUgaGVhZGluZyB0ZXh0XG4gICAgICBjb25zdCBoZWFkaW5nX3RleHQgPSBsaW5lLnJlcGxhY2UoLyMvZywgJycpLnRyaW0oKTtcbiAgICAgIC8vIGNvbnRpbnVlIGlmIGhlYWRpbmcgdGV4dCBpcyBub3QgaW4gYmxvY2tfaGVhZGluZ3NcbiAgICAgIGNvbnN0IGhlYWRpbmdfaW5kZXggPSBibG9ja19oZWFkaW5ncy5pbmRleE9mKGhlYWRpbmdfdGV4dCk7XG4gICAgICBpZiAoaGVhZGluZ19pbmRleCA8IDApIGNvbnRpbnVlO1xuICAgICAgLy8gaWYgY3VycmVudEhlYWRlcnMubGVuZ3RoICE9PSBoZWFkaW5nX2luZGV4IHRoZW4gd2UgaGF2ZSBhIG1pc21hdGNoXG4gICAgICBpZiAoY3VycmVudEhlYWRlcnMubGVuZ3RoICE9PSBoZWFkaW5nX2luZGV4KSBjb250aW51ZTtcbiAgICAgIC8vIHB1c2ggdGhlIGhlYWRpbmcgdGV4dCB0byB0aGUgY3VycmVudEhlYWRlcnMgYXJyYXlcbiAgICAgIGN1cnJlbnRIZWFkZXJzLnB1c2goaGVhZGluZ190ZXh0KTtcbiAgICAgIC8vIGlmIGN1cnJlbnRIZWFkZXJzLmxlbmd0aCA9PT0gYmxvY2tfaGVhZGluZ3MubGVuZ3RoIHRoZW4gd2UgaGF2ZSBhIG1hdGNoXG4gICAgICBpZiAoY3VycmVudEhlYWRlcnMubGVuZ3RoID09PSBibG9ja19oZWFkaW5ncy5sZW5ndGgpIHtcbiAgICAgICAgLy8gaWYgaGVhZGluZ19vY2N1cnJlbmNlIGlzIGRlZmluZWQgdGhlbiBpbmNyZW1lbnQgb2NjdXJyZW5jZV9jb3VudFxuICAgICAgICBpZihoZWFkaW5nX29jY3VycmVuY2UgPT09IDApIHtcbiAgICAgICAgICAvLyBzZXQgYmVnaW5fbGluZSB0byBpICsgMVxuICAgICAgICAgIGJlZ2luX2xpbmUgPSBpICsgMTtcbiAgICAgICAgICBicmVhazsgLy8gYnJlYWsgb3V0IG9mIGxvb3BcbiAgICAgICAgfVxuICAgICAgICAvLyBpZiBvY2N1cnJlbmNlX2NvdW50ICE9PSBoZWFkaW5nX29jY3VycmVuY2UgdGhlbiBjb250aW51ZVxuICAgICAgICBpZihvY2N1cnJlbmNlX2NvdW50ID09PSBoZWFkaW5nX29jY3VycmVuY2Upe1xuICAgICAgICAgIGJlZ2luX2xpbmUgPSBpICsgMTtcbiAgICAgICAgICBicmVhazsgLy8gYnJlYWsgb3V0IG9mIGxvb3BcbiAgICAgICAgfVxuICAgICAgICBvY2N1cnJlbmNlX2NvdW50Kys7XG4gICAgICAgIC8vIHJlc2V0IGN1cnJlbnRIZWFkZXJzXG4gICAgICAgIGN1cnJlbnRIZWFkZXJzLnBvcCgpO1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICB9XG4gICAgLy8gaWYgbm8gYmVnaW5fbGluZSB0aGVuIHJldHVybiBmYWxzZVxuICAgIGlmIChiZWdpbl9saW5lID09PSAwKSByZXR1cm4gZmFsc2U7XG4gICAgLy8gaXRlcmF0ZSB0aHJvdWdoIGxpbmVzIHN0YXJ0aW5nIGF0IGJlZ2luX2xpbmVcbiAgICBpc19jb2RlID0gZmFsc2U7XG4gICAgLy8gY2hhcmFjdGVyIGFjY3VtdWxhdG9yXG4gICAgbGV0IGNoYXJfY291bnQgPSAwO1xuICAgIGZvciAoaSA9IGJlZ2luX2xpbmU7IGkgPCBsaW5lcy5sZW5ndGg7IGkrKykge1xuICAgICAgaWYoKHR5cGVvZiBsaW5lX2xpbWl0ID09PSBcIm51bWJlclwiKSAmJiAoYmxvY2subGVuZ3RoID4gbGluZV9saW1pdCkpe1xuICAgICAgICBibG9jay5wdXNoKFwiLi4uXCIpO1xuICAgICAgICBicmVhazsgLy8gZW5kcyB3aGVuIGxpbmVfbGltaXQgaXMgcmVhY2hlZFxuICAgICAgfVxuICAgICAgbGV0IGxpbmUgPSBsaW5lc1tpXTtcbiAgICAgIGlmICgobGluZS5pbmRleE9mKCcjJykgPT09IDApICYmIChbJyMnLCcgJ10uaW5kZXhPZihsaW5lWzFdKSAhPT0gLTEpKXtcbiAgICAgICAgYnJlYWs7IC8vIGVuZHMgd2hlbiBlbmNvdW50ZXJpbmcgbmV4dCBoZWFkZXJcbiAgICAgIH1cbiAgICAgIC8vIERFUFJFQ0FURUQ6IHNob3VsZCBiZSBoYW5kbGVkIGJ5IG5ld19saW5lK2NoYXJfY291bnQgY2hlY2sgKGhhcHBlbnMgaW4gcHJldmlvdXMgaXRlcmF0aW9uKVxuICAgICAgLy8gaWYgY2hhcl9jb3VudCBpcyBncmVhdGVyIHRoYW4gbGltaXQubWF4X2NoYXJzLCBza2lwXG4gICAgICBpZiAobGltaXRzLm1heF9jaGFycyAmJiBjaGFyX2NvdW50ID4gbGltaXRzLm1heF9jaGFycykge1xuICAgICAgICBibG9jay5wdXNoKFwiLi4uXCIpO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIC8vIGlmIG5ld19saW5lICsgY2hhcl9jb3VudCBpcyBncmVhdGVyIHRoYW4gbGltaXQubWF4X2NoYXJzLCBza2lwXG4gICAgICBpZiAobGltaXRzLm1heF9jaGFycyAmJiAoKGxpbmUubGVuZ3RoICsgY2hhcl9jb3VudCkgPiBsaW1pdHMubWF4X2NoYXJzKSkge1xuICAgICAgICBjb25zdCBtYXhfbmV3X2NoYXJzID0gbGltaXRzLm1heF9jaGFycyAtIGNoYXJfY291bnQ7XG4gICAgICAgIGxpbmUgPSBsaW5lLnNsaWNlKDAsIG1heF9uZXdfY2hhcnMpICsgXCIuLi5cIjtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICAvLyB2YWxpZGF0ZS9mb3JtYXRcbiAgICAgIC8vIGlmIGxpbmUgaXMgZW1wdHksIHNraXBcbiAgICAgIGlmIChsaW5lLmxlbmd0aCA9PT0gMCkgY29udGludWU7XG4gICAgICAvLyBsaW1pdCBsZW5ndGggb2YgbGluZSB0byBOIGNoYXJhY3RlcnNcbiAgICAgIGlmIChsaW1pdHMuY2hhcnNfcGVyX2xpbmUgJiYgbGluZS5sZW5ndGggPiBsaW1pdHMuY2hhcnNfcGVyX2xpbmUpIHtcbiAgICAgICAgbGluZSA9IGxpbmUuc2xpY2UoMCwgbGltaXRzLmNoYXJzX3Blcl9saW5lKSArIFwiLi4uXCI7XG4gICAgICB9XG4gICAgICAvLyBpZiBsaW5lIGlzIGEgY29kZSBibG9jaywgc2tpcFxuICAgICAgaWYgKGxpbmUuc3RhcnRzV2l0aChcImBgYFwiKSkge1xuICAgICAgICBpc19jb2RlID0gIWlzX2NvZGU7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgICAgaWYgKGlzX2NvZGUpe1xuICAgICAgICAvLyBhZGQgdGFiIHRvIGJlZ2lubmluZyBvZiBsaW5lXG4gICAgICAgIGxpbmUgPSBcIlxcdFwiK2xpbmU7XG4gICAgICB9XG4gICAgICAvLyBhZGQgbGluZSB0byBibG9ja1xuICAgICAgYmxvY2sucHVzaChsaW5lKTtcbiAgICAgIC8vIGluY3JlbWVudCBjaGFyX2NvdW50XG4gICAgICBjaGFyX2NvdW50ICs9IGxpbmUubGVuZ3RoO1xuICAgIH1cbiAgICAvLyBjbG9zZSBjb2RlIGJsb2NrIGlmIG9wZW5cbiAgICBpZiAoaXNfY29kZSkge1xuICAgICAgYmxvY2sucHVzaChcImBgYFwiKTtcbiAgICB9XG4gICAgcmV0dXJuIGJsb2NrLmpvaW4oXCJcXG5cIikudHJpbSgpO1xuICB9XG5cbiAgLy8gcmV0cmlldmUgYSBmaWxlIGZyb20gdGhlIHZhdWx0XG4gIGFzeW5jIGZpbGVfcmV0cmlldmVyKGxpbmssIGxpbWl0cz17fSkge1xuICAgIGxpbWl0cyA9IHtcbiAgICAgIGxpbmVzOiBudWxsLFxuICAgICAgbWF4X2NoYXJzOiBudWxsLFxuICAgICAgY2hhcnNfcGVyX2xpbmU6IG51bGwsXG4gICAgICAuLi5saW1pdHNcbiAgICB9O1xuICAgIGNvbnN0IHRoaXNfZmlsZSA9IHRoaXMuYXBwLnZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aChsaW5rKTtcbiAgICAvLyBpZiBmaWxlIGlzIG5vdCBmb3VuZCwgc2tpcFxuICAgIGlmICghKHRoaXNfZmlsZSBpbnN0YW5jZW9mIE9ic2lkaWFuLlRBYnN0cmFjdEZpbGUpKSByZXR1cm4gZmFsc2U7XG4gICAgLy8gdXNlIGNhY2hlZFJlYWQgdG8gZ2V0IHRoZSBmaXJzdCAxMCBsaW5lcyBvZiB0aGUgZmlsZVxuICAgIGNvbnN0IGZpbGVfY29udGVudCA9IGF3YWl0IHRoaXMuYXBwLnZhdWx0LmNhY2hlZFJlYWQodGhpc19maWxlKTtcbiAgICBjb25zdCBmaWxlX2xpbmVzID0gZmlsZV9jb250ZW50LnNwbGl0KFwiXFxuXCIpO1xuICAgIGxldCBmaXJzdF90ZW5fbGluZXMgPSBbXTtcbiAgICBsZXQgaXNfY29kZSA9IGZhbHNlO1xuICAgIGxldCBjaGFyX2FjY3VtID0gMDtcbiAgICBjb25zdCBsaW5lX2xpbWl0ID0gbGltaXRzLmxpbmVzIHx8IGZpbGVfbGluZXMubGVuZ3RoO1xuICAgIGZvciAobGV0IGkgPSAwOyBmaXJzdF90ZW5fbGluZXMubGVuZ3RoIDwgbGluZV9saW1pdDsgaSsrKSB7XG4gICAgICBsZXQgbGluZSA9IGZpbGVfbGluZXNbaV07XG4gICAgICAvLyBpZiBsaW5lIGlzIHVuZGVmaW5lZCwgYnJlYWtcbiAgICAgIGlmICh0eXBlb2YgbGluZSA9PT0gJ3VuZGVmaW5lZCcpXG4gICAgICAgIGJyZWFrO1xuICAgICAgLy8gaWYgbGluZSBpcyBlbXB0eSwgc2tpcFxuICAgICAgaWYgKGxpbmUubGVuZ3RoID09PSAwKVxuICAgICAgICBjb250aW51ZTtcbiAgICAgIC8vIGxpbWl0IGxlbmd0aCBvZiBsaW5lIHRvIE4gY2hhcmFjdGVyc1xuICAgICAgaWYgKGxpbWl0cy5jaGFyc19wZXJfbGluZSAmJiBsaW5lLmxlbmd0aCA+IGxpbWl0cy5jaGFyc19wZXJfbGluZSkge1xuICAgICAgICBsaW5lID0gbGluZS5zbGljZSgwLCBsaW1pdHMuY2hhcnNfcGVyX2xpbmUpICsgXCIuLi5cIjtcbiAgICAgIH1cbiAgICAgIC8vIGlmIGxpbmUgaXMgXCItLS1cIiwgc2tpcFxuICAgICAgaWYgKGxpbmUgPT09IFwiLS0tXCIpXG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgLy8gc2tpcCBpZiBsaW5lIGlzIGVtcHR5IGJ1bGxldCBvciBjaGVja2JveFxuICAgICAgaWYgKFsnLSAnLCAnLSBbIF0gJ10uaW5kZXhPZihsaW5lKSA+IC0xKVxuICAgICAgICBjb250aW51ZTtcbiAgICAgIC8vIGlmIGxpbmUgaXMgYSBjb2RlIGJsb2NrLCBza2lwXG4gICAgICBpZiAobGluZS5pbmRleE9mKFwiYGBgXCIpID09PSAwKSB7XG4gICAgICAgIGlzX2NvZGUgPSAhaXNfY29kZTtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgICAvLyBpZiBjaGFyX2FjY3VtIGlzIGdyZWF0ZXIgdGhhbiBsaW1pdC5tYXhfY2hhcnMsIHNraXBcbiAgICAgIGlmIChsaW1pdHMubWF4X2NoYXJzICYmIGNoYXJfYWNjdW0gPiBsaW1pdHMubWF4X2NoYXJzKSB7XG4gICAgICAgIGZpcnN0X3Rlbl9saW5lcy5wdXNoKFwiLi4uXCIpO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGlmIChpc19jb2RlKSB7XG4gICAgICAgIC8vIGlmIGlzIGNvZGUsIGFkZCB0YWIgdG8gYmVnaW5uaW5nIG9mIGxpbmVcbiAgICAgICAgbGluZSA9IFwiXFx0XCIgKyBsaW5lO1xuICAgICAgfVxuICAgICAgLy8gaWYgbGluZSBpcyBhIGhlYWRpbmdcbiAgICAgIGlmIChsaW5lX2lzX2hlYWRpbmcobGluZSkpIHtcbiAgICAgICAgLy8gbG9vayBhdCBsYXN0IGxpbmUgaW4gZmlyc3RfdGVuX2xpbmVzIHRvIHNlZSBpZiBpdCBpcyBhIGhlYWRpbmdcbiAgICAgICAgLy8gbm90ZTogdXNlcyBsYXN0IGluIGZpcnN0X3Rlbl9saW5lcywgaW5zdGVhZCBvZiBsb29rIGFoZWFkIGluIGZpbGVfbGluZXMsIGJlY2F1c2UuLlxuICAgICAgICAvLyAuLi5uZXh0IGxpbmUgbWF5IGJlIGV4Y2x1ZGVkIGZyb20gZmlyc3RfdGVuX2xpbmVzIGJ5IHByZXZpb3VzIGlmIHN0YXRlbWVudHNcbiAgICAgICAgaWYgKChmaXJzdF90ZW5fbGluZXMubGVuZ3RoID4gMCkgJiYgbGluZV9pc19oZWFkaW5nKGZpcnN0X3Rlbl9saW5lc1tmaXJzdF90ZW5fbGluZXMubGVuZ3RoIC0gMV0pKSB7XG4gICAgICAgICAgLy8gaWYgbGFzdCBsaW5lIGlzIGEgaGVhZGluZywgcmVtb3ZlIGl0XG4gICAgICAgICAgZmlyc3RfdGVuX2xpbmVzLnBvcCgpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICAvLyBhZGQgbGluZSB0byBmaXJzdF90ZW5fbGluZXNcbiAgICAgIGZpcnN0X3Rlbl9saW5lcy5wdXNoKGxpbmUpO1xuICAgICAgLy8gaW5jcmVtZW50IGNoYXJfYWNjdW1cbiAgICAgIGNoYXJfYWNjdW0gKz0gbGluZS5sZW5ndGg7XG4gICAgfVxuICAgIC8vIGZvciBlYWNoIGxpbmUgaW4gZmlyc3RfdGVuX2xpbmVzLCBhcHBseSB2aWV3LXNwZWNpZmljIGZvcm1hdHRpbmdcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGZpcnN0X3Rlbl9saW5lcy5sZW5ndGg7IGkrKykge1xuICAgICAgLy8gaWYgbGluZSBpcyBhIGhlYWRpbmdcbiAgICAgIGlmIChsaW5lX2lzX2hlYWRpbmcoZmlyc3RfdGVuX2xpbmVzW2ldKSkge1xuICAgICAgICAvLyBpZiB0aGlzIGlzIHRoZSBsYXN0IGxpbmUgaW4gZmlyc3RfdGVuX2xpbmVzXG4gICAgICAgIGlmIChpID09PSBmaXJzdF90ZW5fbGluZXMubGVuZ3RoIC0gMSkge1xuICAgICAgICAgIC8vIHJlbW92ZSB0aGUgbGFzdCBsaW5lIGlmIGl0IGlzIGEgaGVhZGluZ1xuICAgICAgICAgIGZpcnN0X3Rlbl9saW5lcy5wb3AoKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgICAvLyByZW1vdmUgaGVhZGluZyBzeW50YXggdG8gaW1wcm92ZSByZWFkYWJpbGl0eSBpbiBzbWFsbCBzcGFjZVxuICAgICAgICBmaXJzdF90ZW5fbGluZXNbaV0gPSBmaXJzdF90ZW5fbGluZXNbaV0ucmVwbGFjZSgvIysvLCBcIlwiKTtcbiAgICAgICAgZmlyc3RfdGVuX2xpbmVzW2ldID0gYFxcbiR7Zmlyc3RfdGVuX2xpbmVzW2ldfTpgO1xuICAgICAgfVxuICAgIH1cbiAgICAvLyBqb2luIGZpcnN0IHRlbiBsaW5lcyBpbnRvIHN0cmluZ1xuICAgIGZpcnN0X3Rlbl9saW5lcyA9IGZpcnN0X3Rlbl9saW5lcy5qb2luKFwiXFxuXCIpO1xuICAgIHJldHVybiBmaXJzdF90ZW5fbGluZXM7XG4gIH1cblxuICAvLyBpdGVyYXRlIHRocm91Z2ggYmxvY2tzIGFuZCBza2lwIGlmIGJsb2NrX2hlYWRpbmdzIGNvbnRhaW5zIHRoaXMuaGVhZGVyX2V4Y2x1c2lvbnNcbiAgdmFsaWRhdGVfaGVhZGluZ3MoYmxvY2tfaGVhZGluZ3MpIHtcbiAgICBsZXQgdmFsaWQgPSB0cnVlO1xuICAgIGlmICh0aGlzLmhlYWRlcl9leGNsdXNpb25zLmxlbmd0aCA+IDApIHtcbiAgICAgIGZvciAobGV0IGsgPSAwOyBrIDwgdGhpcy5oZWFkZXJfZXhjbHVzaW9ucy5sZW5ndGg7IGsrKykge1xuICAgICAgICBpZiAoYmxvY2tfaGVhZGluZ3MuaW5kZXhPZih0aGlzLmhlYWRlcl9leGNsdXNpb25zW2tdKSA+IC0xKSB7XG4gICAgICAgICAgdmFsaWQgPSBmYWxzZTtcbiAgICAgICAgICB0aGlzLmxvZ19leGNsdXNpb24oXCJoZWFkaW5nOiBcIit0aGlzLmhlYWRlcl9leGNsdXNpb25zW2tdKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gdmFsaWQ7XG4gIH1cbiAgLy8gcmVuZGVyIFwiU21hcnQgQ29ubmVjdGlvbnNcIiB0ZXh0IGZpeGVkIGluIHRoZSBib3R0b20gcmlnaHQgY29ybmVyXG4gIHJlbmRlcl9icmFuZChjb250YWluZXIsIGxvY2F0aW9uPVwiZGVmYXVsdFwiKSB7XG4gICAgLy8gaWYgbG9jYXRpb24gaXMgYWxsIHRoZW4gZ2V0IE9iamVjdC5rZXlzKHRoaXMuc2NfYnJhbmRpbmcpIGFuZCBjYWxsIHRoaXMgZnVuY3Rpb24gZm9yIGVhY2hcbiAgICBpZiAoY29udGFpbmVyID09PSBcImFsbFwiKSB7XG4gICAgICBjb25zdCBsb2NhdGlvbnMgPSBPYmplY3Qua2V5cyh0aGlzLnNjX2JyYW5kaW5nKTtcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbG9jYXRpb25zLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHRoaXMucmVuZGVyX2JyYW5kKHRoaXMuc2NfYnJhbmRpbmdbbG9jYXRpb25zW2ldXSwgbG9jYXRpb25zW2ldKTtcbiAgICAgIH1cbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgLy8gYnJhbmQgY29udGFpbmVyXG4gICAgdGhpcy5zY19icmFuZGluZ1tsb2NhdGlvbl0gPSBjb250YWluZXI7XG4gICAgLy8gaWYgdGhpcy5zY19icmFuZGluZ1tsb2NhdGlvbl0gY29udGFpbnMgY2hpbGQgd2l0aCBjbGFzcyBcInNjLWJyYW5kXCIsIHJlbW92ZSBpdFxuICAgIGlmICh0aGlzLnNjX2JyYW5kaW5nW2xvY2F0aW9uXS5xdWVyeVNlbGVjdG9yKFwiLnNjLWJyYW5kXCIpKSB7XG4gICAgICB0aGlzLnNjX2JyYW5kaW5nW2xvY2F0aW9uXS5xdWVyeVNlbGVjdG9yKFwiLnNjLWJyYW5kXCIpLnJlbW92ZSgpO1xuICAgIH1cbiAgICBjb25zdCBicmFuZF9jb250YWluZXIgPSB0aGlzLnNjX2JyYW5kaW5nW2xvY2F0aW9uXS5jcmVhdGVFbChcImRpdlwiLCB7IGNsczogXCJzYy1icmFuZFwiIH0pO1xuICAgIC8vIGFkZCB0ZXh0XG4gICAgLy8gYWRkIFNWRyBzaWduYWwgaWNvbiB1c2luZyBnZXRJY29uXG4gICAgT2JzaWRpYW4uc2V0SWNvbihicmFuZF9jb250YWluZXIsIFwic21hcnQtY29ubmVjdGlvbnNcIik7XG4gICAgY29uc3QgYnJhbmRfcCA9IGJyYW5kX2NvbnRhaW5lci5jcmVhdGVFbChcInBcIik7XG4gICAgbGV0IHRleHQgPSBcIlNtYXJ0IENvbm5lY3Rpb25zXCI7XG4gICAgbGV0IGF0dHIgPSB7fTtcbiAgICAvLyBpZiB1cGRhdGUgYXZhaWxhYmxlLCBjaGFuZ2UgdGV4dCB0byBcIlVwZGF0ZSBBdmFpbGFibGVcIlxuICAgIGlmICh0aGlzLnVwZGF0ZV9hdmFpbGFibGUpIHtcbiAgICAgIHRleHQgPSBcIlVwZGF0ZSBBdmFpbGFibGVcIjtcbiAgICAgIGF0dHIgPSB7XG4gICAgICAgIHN0eWxlOiBcImZvbnQtd2VpZ2h0OiA3MDA7XCJcbiAgICAgIH07XG4gICAgfVxuICAgIGJyYW5kX3AuY3JlYXRlRWwoXCJhXCIsIHtcbiAgICAgIGNsczogXCJcIixcbiAgICAgIHRleHQ6IHRleHQsXG4gICAgICBocmVmOiBcImh0dHBzOi8vZ2l0aHViLmNvbS9icmlhbnBldHJvL29ic2lkaWFuLXNtYXJ0LWNvbm5lY3Rpb25zL2Rpc2N1c3Npb25zXCIsXG4gICAgICB0YXJnZXQ6IFwiX2JsYW5rXCIsXG4gICAgICBhdHRyOiBhdHRyXG4gICAgfSk7XG4gIH1cblxuXG4gIC8vIGNyZWF0ZSBsaXN0IG9mIG5lYXJlc3Qgbm90ZXNcbiAgYXN5bmMgdXBkYXRlX3Jlc3VsdHMoY29udGFpbmVyLCBuZWFyZXN0KSB7XG4gICAgbGV0IGxpc3Q7XG4gICAgLy8gY2hlY2sgaWYgbGlzdCBleGlzdHNcbiAgICBpZigoY29udGFpbmVyLmNoaWxkcmVuLmxlbmd0aCA+IDEpICYmIChjb250YWluZXIuY2hpbGRyZW5bMV0uY2xhc3NMaXN0LmNvbnRhaW5zKFwic2MtbGlzdFwiKSkpe1xuICAgICAgbGlzdCA9IGNvbnRhaW5lci5jaGlsZHJlblsxXTtcbiAgICB9XG4gICAgLy8gaWYgbGlzdCBleGlzdHMsIGVtcHR5IGl0XG4gICAgaWYgKGxpc3QpIHtcbiAgICAgIGxpc3QuZW1wdHkoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gY3JlYXRlIGxpc3QgZWxlbWVudFxuICAgICAgbGlzdCA9IGNvbnRhaW5lci5jcmVhdGVFbChcImRpdlwiLCB7IGNsczogXCJzYy1saXN0XCIgfSk7XG4gICAgfVxuICAgIGxldCBzZWFyY2hfcmVzdWx0X2NsYXNzID0gXCJzZWFyY2gtcmVzdWx0XCI7XG4gICAgLy8gaWYgc2V0dGluZ3MgZXhwYW5kZWRfdmlldyBpcyBmYWxzZSwgYWRkIHNjLWNvbGxhcHNlZCBjbGFzc1xuICAgIGlmKCF0aGlzLnNldHRpbmdzLmV4cGFuZGVkX3ZpZXcpIHNlYXJjaF9yZXN1bHRfY2xhc3MgKz0gXCIgc2MtY29sbGFwc2VkXCI7XG5cbiAgICAvLyBUT0RPOiBhZGQgb3B0aW9uIHRvIGdyb3VwIG5lYXJlc3QgYnkgZmlsZVxuICAgIGlmKCF0aGlzLnNldHRpbmdzLmdyb3VwX25lYXJlc3RfYnlfZmlsZSkge1xuICAgICAgLy8gZm9yIGVhY2ggbmVhcmVzdCBub3RlXG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG5lYXJlc3QubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgLyoqXG4gICAgICAgICAqIEJFR0lOIEVYVEVSTkFMIExJTksgTE9HSUNcbiAgICAgICAgICogaWYgbGluayBpcyBhbiBvYmplY3QsIGl0IGluZGljYXRlcyBleHRlcm5hbCBsaW5rXG4gICAgICAgICAqL1xuICAgICAgICBpZiAodHlwZW9mIG5lYXJlc3RbaV0ubGluayA9PT0gXCJvYmplY3RcIikge1xuICAgICAgICAgIGNvbnN0IGl0ZW0gPSBsaXN0LmNyZWF0ZUVsKFwiZGl2XCIsIHsgY2xzOiBcInNlYXJjaC1yZXN1bHRcIiB9KTtcbiAgICAgICAgICBjb25zdCBsaW5rID0gaXRlbS5jcmVhdGVFbChcImFcIiwge1xuICAgICAgICAgICAgY2xzOiBcInNlYXJjaC1yZXN1bHQtZmlsZS10aXRsZSBpcy1jbGlja2FibGVcIixcbiAgICAgICAgICAgIGhyZWY6IG5lYXJlc3RbaV0ubGluay5wYXRoLFxuICAgICAgICAgICAgdGl0bGU6IG5lYXJlc3RbaV0ubGluay50aXRsZSxcbiAgICAgICAgICB9KTtcbiAgICAgICAgICBsaW5rLmlubmVySFRNTCA9IHRoaXMucmVuZGVyX2V4dGVybmFsX2xpbmtfZWxtKG5lYXJlc3RbaV0ubGluayk7XG4gICAgICAgICAgaXRlbS5zZXRBdHRyKCdkcmFnZ2FibGUnLCAndHJ1ZScpXG4gICAgICAgICAgY29udGludWU7IC8vIGVuZHMgaGVyZSBmb3IgZXh0ZXJuYWwgbGlua3NcbiAgICAgICAgfVxuICAgICAgICAvKipcbiAgICAgICAgICogQkVHSU4gSU5URVJOQUwgTElOSyBMT0dJQ1xuICAgICAgICAgKiBpZiBsaW5rIGlzIGEgc3RyaW5nLCBpdCBpbmRpY2F0ZXMgaW50ZXJuYWwgbGlua1xuICAgICAgICAgKi9cbiAgICAgICAgbGV0IGZpbGVfbGlua190ZXh0O1xuICAgICAgICBjb25zdCBmaWxlX3NpbWlsYXJpdHlfcGN0ID0gTWF0aC5yb3VuZChuZWFyZXN0W2ldLnNpbWlsYXJpdHkgKiAxMDApICsgXCIlXCI7XG4gICAgICAgIGlmKHRoaXMuc2V0dGluZ3Muc2hvd19mdWxsX3BhdGgpIHtcbiAgICAgICAgICBjb25zdCBwY3MgPSBuZWFyZXN0W2ldLmxpbmsuc3BsaXQoXCIvXCIpO1xuICAgICAgICAgIGZpbGVfbGlua190ZXh0ID0gcGNzW3Bjcy5sZW5ndGggLSAxXTtcbiAgICAgICAgICBjb25zdCBwYXRoID0gcGNzLnNsaWNlKDAsIHBjcy5sZW5ndGggLSAxKS5qb2luKFwiL1wiKTtcbiAgICAgICAgICAvLyBmaWxlX2xpbmtfdGV4dCA9IGA8c21hbGw+JHtwYXRofSB8ICR7ZmlsZV9zaW1pbGFyaXR5X3BjdH08L3NtYWxsPjxicj4ke2ZpbGVfbGlua190ZXh0fWA7XG4gICAgICAgICAgZmlsZV9saW5rX3RleHQgPSBgPHNtYWxsPiR7ZmlsZV9zaW1pbGFyaXR5X3BjdH0gfCAke3BhdGh9IHwgJHtmaWxlX2xpbmtfdGV4dH08L3NtYWxsPmA7XG4gICAgICAgIH1lbHNle1xuICAgICAgICAgIGZpbGVfbGlua190ZXh0ID0gJzxzbWFsbD4nICsgZmlsZV9zaW1pbGFyaXR5X3BjdCArIFwiIHwgXCIgKyBuZWFyZXN0W2ldLmxpbmsuc3BsaXQoXCIvXCIpLnBvcCgpICsgJzwvc21hbGw+JztcbiAgICAgICAgfVxuICAgICAgICAvLyBza2lwIGNvbnRlbnRzIHJlbmRlcmluZyBpZiBpbmNvbXBhdGlibGUgZmlsZSB0eXBlXG4gICAgICAgIC8vIGV4LiBub3QgbWFya2Rvd24gZmlsZSBvciBjb250YWlucyBubyAnLmV4Y2FsaWRyYXcnXG4gICAgICAgIGlmKCF0aGlzLnJlbmRlcmFibGVfZmlsZV90eXBlKG5lYXJlc3RbaV0ubGluaykpe1xuICAgICAgICAgIGNvbnN0IGl0ZW0gPSBsaXN0LmNyZWF0ZUVsKFwiZGl2XCIsIHsgY2xzOiBcInNlYXJjaC1yZXN1bHRcIiB9KTtcbiAgICAgICAgICBjb25zdCBsaW5rID0gaXRlbS5jcmVhdGVFbChcImFcIiwge1xuICAgICAgICAgICAgY2xzOiBcInNlYXJjaC1yZXN1bHQtZmlsZS10aXRsZSBpcy1jbGlja2FibGVcIixcbiAgICAgICAgICAgIGhyZWY6IG5lYXJlc3RbaV0ubGluayxcbiAgICAgICAgICB9KTtcbiAgICAgICAgICBsaW5rLmlubmVySFRNTCA9IGZpbGVfbGlua190ZXh0O1xuICAgICAgICAgIC8vIGRyYWcgYW5kIGRyb3BcbiAgICAgICAgICBpdGVtLnNldEF0dHIoJ2RyYWdnYWJsZScsICd0cnVlJylcbiAgICAgICAgICAvLyBhZGQgbGlzdGVuZXJzIHRvIGxpbmtcbiAgICAgICAgICB0aGlzLmFkZF9saW5rX2xpc3RlbmVycyhsaW5rLCBuZWFyZXN0W2ldLCBpdGVtKTtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHJlbW92ZSBmaWxlIGV4dGVuc2lvbiBpZiAubWQgYW5kIG1ha2UgIyBpbnRvID5cbiAgICAgICAgZmlsZV9saW5rX3RleHQgPSBmaWxlX2xpbmtfdGV4dC5yZXBsYWNlKFwiLm1kXCIsIFwiXCIpLnJlcGxhY2UoLyMvZywgXCIgPiBcIik7XG4gICAgICAgIC8vIGNyZWF0ZSBpdGVtXG4gICAgICAgIGNvbnN0IGl0ZW0gPSBsaXN0LmNyZWF0ZUVsKFwiZGl2XCIsIHsgY2xzOiBzZWFyY2hfcmVzdWx0X2NsYXNzIH0pO1xuICAgICAgICAvLyBjcmVhdGUgc3BhbiBmb3IgdG9nZ2xlXG4gICAgICAgIGNvbnN0IHRvZ2dsZSA9IGl0ZW0uY3JlYXRlRWwoXCJzcGFuXCIsIHsgY2xzOiBcImlzLWNsaWNrYWJsZVwiIH0pO1xuICAgICAgICAvLyBpbnNlcnQgcmlnaHQgdHJpYW5nbGUgc3ZnIGFzIHRvZ2dsZVxuICAgICAgICBPYnNpZGlhbi5zZXRJY29uKHRvZ2dsZSwgXCJyaWdodC10cmlhbmdsZVwiKTsgLy8gbXVzdCBjb21lIGJlZm9yZSBhZGRpbmcgb3RoZXIgZWxtcyB0byBwcmV2ZW50IG92ZXJ3cml0ZVxuICAgICAgICBjb25zdCBsaW5rID0gdG9nZ2xlLmNyZWF0ZUVsKFwiYVwiLCB7XG4gICAgICAgICAgY2xzOiBcInNlYXJjaC1yZXN1bHQtZmlsZS10aXRsZVwiLFxuICAgICAgICAgIHRpdGxlOiBuZWFyZXN0W2ldLmxpbmssXG4gICAgICAgIH0pO1xuICAgICAgICBsaW5rLmlubmVySFRNTCA9IGZpbGVfbGlua190ZXh0O1xuICAgICAgICAvLyBhZGQgbGlzdGVuZXJzIHRvIGxpbmtcbiAgICAgICAgdGhpcy5hZGRfbGlua19saXN0ZW5lcnMobGluaywgbmVhcmVzdFtpXSwgaXRlbSk7XG4gICAgICAgIHRvZ2dsZS5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKGV2ZW50KSA9PiB7XG4gICAgICAgICAgLy8gZmluZCBwYXJlbnQgY29udGFpbmluZyBzZWFyY2gtcmVzdWx0IGNsYXNzXG4gICAgICAgICAgbGV0IHBhcmVudCA9IGV2ZW50LnRhcmdldC5wYXJlbnRFbGVtZW50O1xuICAgICAgICAgIHdoaWxlICghcGFyZW50LmNsYXNzTGlzdC5jb250YWlucyhcInNlYXJjaC1yZXN1bHRcIikpIHtcbiAgICAgICAgICAgIHBhcmVudCA9IHBhcmVudC5wYXJlbnRFbGVtZW50O1xuICAgICAgICAgIH1cbiAgICAgICAgICAvLyB0b2dnbGUgc2MtY29sbGFwc2VkIGNsYXNzXG4gICAgICAgICAgcGFyZW50LmNsYXNzTGlzdC50b2dnbGUoXCJzYy1jb2xsYXBzZWRcIik7XG4gICAgICAgIH0pO1xuICAgICAgICBjb25zdCBjb250ZW50cyA9IGl0ZW0uY3JlYXRlRWwoXCJ1bFwiLCB7IGNsczogXCJcIiB9KTtcbiAgICAgICAgY29uc3QgY29udGVudHNfY29udGFpbmVyID0gY29udGVudHMuY3JlYXRlRWwoXCJsaVwiLCB7XG4gICAgICAgICAgY2xzOiBcInNlYXJjaC1yZXN1bHQtZmlsZS10aXRsZSBpcy1jbGlja2FibGVcIixcbiAgICAgICAgICB0aXRsZTogbmVhcmVzdFtpXS5saW5rLFxuICAgICAgICB9KTtcbiAgICAgICAgaWYobmVhcmVzdFtpXS5saW5rLmluZGV4T2YoXCIjXCIpID4gLTEpeyAvLyBpcyBibG9ja1xuICAgICAgICAgIE9ic2lkaWFuLk1hcmtkb3duUmVuZGVyZXIucmVuZGVyTWFya2Rvd24oKGF3YWl0IHRoaXMuYmxvY2tfcmV0cmlldmVyKG5lYXJlc3RbaV0ubGluaywge2xpbmVzOiAxMCwgbWF4X2NoYXJzOiAxMDAwfSkpLCBjb250ZW50c19jb250YWluZXIsIG5lYXJlc3RbaV0ubGluaywgbmV3IE9ic2lkaWFuLkNvbXBvbmVudCgpKTtcbiAgICAgICAgfWVsc2V7IC8vIGlzIGZpbGVcbiAgICAgICAgICBjb25zdCBmaXJzdF90ZW5fbGluZXMgPSBhd2FpdCB0aGlzLmZpbGVfcmV0cmlldmVyKG5lYXJlc3RbaV0ubGluaywge2xpbmVzOiAxMCwgbWF4X2NoYXJzOiAxMDAwfSk7XG4gICAgICAgICAgaWYoIWZpcnN0X3Rlbl9saW5lcykgY29udGludWU7IC8vIHNraXAgaWYgZmlsZSBpcyBlbXB0eVxuICAgICAgICAgIE9ic2lkaWFuLk1hcmtkb3duUmVuZGVyZXIucmVuZGVyTWFya2Rvd24oZmlyc3RfdGVuX2xpbmVzLCBjb250ZW50c19jb250YWluZXIsIG5lYXJlc3RbaV0ubGluaywgbmV3IE9ic2lkaWFuLkNvbXBvbmVudCgpKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmFkZF9saW5rX2xpc3RlbmVycyhjb250ZW50cywgbmVhcmVzdFtpXSwgaXRlbSk7XG4gICAgICB9XG4gICAgICB0aGlzLnJlbmRlcl9icmFuZChjb250YWluZXIsIFwiYmxvY2tcIik7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gZ3JvdXAgbmVhcmVzdCBieSBmaWxlXG4gICAgY29uc3QgbmVhcmVzdF9ieV9maWxlID0ge307XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBuZWFyZXN0Lmxlbmd0aDsgaSsrKSB7XG4gICAgICBjb25zdCBjdXJyID0gbmVhcmVzdFtpXTtcbiAgICAgIGNvbnN0IGxpbmsgPSBjdXJyLmxpbms7XG4gICAgICAvLyBza2lwIGlmIGxpbmsgaXMgYW4gb2JqZWN0IChpbmRpY2F0ZXMgZXh0ZXJuYWwgbG9naWMpXG4gICAgICBpZiAodHlwZW9mIGxpbmsgPT09IFwib2JqZWN0XCIpIHtcbiAgICAgICAgbmVhcmVzdF9ieV9maWxlW2xpbmsucGF0aF0gPSBbY3Vycl07XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgICAgaWYgKGxpbmsuaW5kZXhPZihcIiNcIikgPiAtMSkge1xuICAgICAgICBjb25zdCBmaWxlX3BhdGggPSBsaW5rLnNwbGl0KFwiI1wiKVswXTtcbiAgICAgICAgaWYgKCFuZWFyZXN0X2J5X2ZpbGVbZmlsZV9wYXRoXSkge1xuICAgICAgICAgIG5lYXJlc3RfYnlfZmlsZVtmaWxlX3BhdGhdID0gW107XG4gICAgICAgIH1cbiAgICAgICAgbmVhcmVzdF9ieV9maWxlW2ZpbGVfcGF0aF0ucHVzaChuZWFyZXN0W2ldKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGlmICghbmVhcmVzdF9ieV9maWxlW2xpbmtdKSB7XG4gICAgICAgICAgbmVhcmVzdF9ieV9maWxlW2xpbmtdID0gW107XG4gICAgICAgIH1cbiAgICAgICAgLy8gYWx3YXlzIGFkZCB0byBmcm9udCBvZiBhcnJheVxuICAgICAgICBuZWFyZXN0X2J5X2ZpbGVbbGlua10udW5zaGlmdChuZWFyZXN0W2ldKTtcbiAgICAgIH1cbiAgICB9XG4gICAgLy8gZm9yIGVhY2ggZmlsZVxuICAgIGNvbnN0IGtleXMgPSBPYmplY3Qua2V5cyhuZWFyZXN0X2J5X2ZpbGUpO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwga2V5cy5sZW5ndGg7IGkrKykge1xuICAgICAgY29uc3QgZmlsZSA9IG5lYXJlc3RfYnlfZmlsZVtrZXlzW2ldXTtcbiAgICAgIC8qKlxuICAgICAgICogQmVnaW4gZXh0ZXJuYWwgbGluayBoYW5kbGluZ1xuICAgICAgICovXG4gICAgICAvLyBpZiBsaW5rIGlzIGFuIG9iamVjdCAoaW5kaWNhdGVzIHYyIGxvZ2ljKVxuICAgICAgaWYgKHR5cGVvZiBmaWxlWzBdLmxpbmsgPT09IFwib2JqZWN0XCIpIHtcbiAgICAgICAgY29uc3QgY3VyciA9IGZpbGVbMF07XG4gICAgICAgIGNvbnN0IG1ldGEgPSBjdXJyLmxpbms7XG4gICAgICAgIGlmIChtZXRhLnBhdGguc3RhcnRzV2l0aChcImh0dHBcIikpIHtcbiAgICAgICAgICBjb25zdCBpdGVtID0gbGlzdC5jcmVhdGVFbChcImRpdlwiLCB7IGNsczogXCJzZWFyY2gtcmVzdWx0XCIgfSk7XG4gICAgICAgICAgY29uc3QgbGluayA9IGl0ZW0uY3JlYXRlRWwoXCJhXCIsIHtcbiAgICAgICAgICAgIGNsczogXCJzZWFyY2gtcmVzdWx0LWZpbGUtdGl0bGUgaXMtY2xpY2thYmxlXCIsXG4gICAgICAgICAgICBocmVmOiBtZXRhLnBhdGgsXG4gICAgICAgICAgICB0aXRsZTogbWV0YS50aXRsZSxcbiAgICAgICAgICB9KTtcbiAgICAgICAgICBsaW5rLmlubmVySFRNTCA9IHRoaXMucmVuZGVyX2V4dGVybmFsX2xpbmtfZWxtKG1ldGEpO1xuICAgICAgICAgIGl0ZW0uc2V0QXR0cignZHJhZ2dhYmxlJywgJ3RydWUnKTtcbiAgICAgICAgICBjb250aW51ZTsgLy8gZW5kcyBoZXJlIGZvciBleHRlcm5hbCBsaW5rc1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICAvKipcbiAgICAgICAqIEhhbmRsZXMgSW50ZXJuYWxcbiAgICAgICAqL1xuICAgICAgbGV0IGZpbGVfbGlua190ZXh0O1xuICAgICAgY29uc3QgZmlsZV9zaW1pbGFyaXR5X3BjdCA9IE1hdGgucm91bmQoZmlsZVswXS5zaW1pbGFyaXR5ICogMTAwKSArIFwiJVwiO1xuICAgICAgaWYgKHRoaXMuc2V0dGluZ3Muc2hvd19mdWxsX3BhdGgpIHtcbiAgICAgICAgY29uc3QgcGNzID0gZmlsZVswXS5saW5rLnNwbGl0KFwiL1wiKTtcbiAgICAgICAgZmlsZV9saW5rX3RleHQgPSBwY3NbcGNzLmxlbmd0aCAtIDFdO1xuICAgICAgICBjb25zdCBwYXRoID0gcGNzLnNsaWNlKDAsIHBjcy5sZW5ndGggLSAxKS5qb2luKFwiL1wiKTtcbiAgICAgICAgZmlsZV9saW5rX3RleHQgPSBgPHNtYWxsPiR7cGF0aH0gfCAke2ZpbGVfc2ltaWxhcml0eV9wY3R9PC9zbWFsbD48YnI+JHtmaWxlX2xpbmtfdGV4dH1gO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZmlsZV9saW5rX3RleHQgPSBmaWxlWzBdLmxpbmsuc3BsaXQoXCIvXCIpLnBvcCgpO1xuICAgICAgICAvLyBhZGQgc2ltaWxhcml0eSBwZXJjZW50YWdlXG4gICAgICAgIGZpbGVfbGlua190ZXh0ICs9ICcgfCAnICsgZmlsZV9zaW1pbGFyaXR5X3BjdDtcbiAgICAgIH1cblxuXG4gICAgICAgIFxuICAgICAgLy8gc2tpcCBjb250ZW50cyByZW5kZXJpbmcgaWYgaW5jb21wYXRpYmxlIGZpbGUgdHlwZVxuICAgICAgLy8gZXguIG5vdCBtYXJrZG93biBvciBjb250YWlucyAnLmV4Y2FsaWRyYXcnXG4gICAgICBpZighdGhpcy5yZW5kZXJhYmxlX2ZpbGVfdHlwZShmaWxlWzBdLmxpbmspKSB7XG4gICAgICAgIGNvbnN0IGl0ZW0gPSBsaXN0LmNyZWF0ZUVsKFwiZGl2XCIsIHsgY2xzOiBcInNlYXJjaC1yZXN1bHRcIiB9KTtcbiAgICAgICAgY29uc3QgZmlsZV9saW5rID0gaXRlbS5jcmVhdGVFbChcImFcIiwge1xuICAgICAgICAgIGNsczogXCJzZWFyY2gtcmVzdWx0LWZpbGUtdGl0bGUgaXMtY2xpY2thYmxlXCIsXG4gICAgICAgICAgdGl0bGU6IGZpbGVbMF0ubGluayxcbiAgICAgICAgfSk7XG4gICAgICAgIGZpbGVfbGluay5pbm5lckhUTUwgPSBmaWxlX2xpbmtfdGV4dDtcbiAgICAgICAgLy8gYWRkIGxpbmsgbGlzdGVuZXJzIHRvIGZpbGUgbGlua1xuICAgICAgICB0aGlzLmFkZF9saW5rX2xpc3RlbmVycyhmaWxlX2xpbmssIGZpbGVbMF0sIGl0ZW0pO1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuXG4gICAgICAvLyByZW1vdmUgZmlsZSBleHRlbnNpb24gaWYgLm1kXG4gICAgICBmaWxlX2xpbmtfdGV4dCA9IGZpbGVfbGlua190ZXh0LnJlcGxhY2UoXCIubWRcIiwgXCJcIikucmVwbGFjZSgvIy9nLCBcIiA+IFwiKTtcbiAgICAgIGNvbnN0IGl0ZW0gPSBsaXN0LmNyZWF0ZUVsKFwiZGl2XCIsIHsgY2xzOiBzZWFyY2hfcmVzdWx0X2NsYXNzIH0pO1xuICAgICAgY29uc3QgdG9nZ2xlID0gaXRlbS5jcmVhdGVFbChcInNwYW5cIiwgeyBjbHM6IFwiaXMtY2xpY2thYmxlXCIgfSk7XG4gICAgICAvLyBpbnNlcnQgcmlnaHQgdHJpYW5nbGUgc3ZnIGljb24gYXMgdG9nZ2xlIGJ1dHRvbiBpbiBzcGFuXG4gICAgICBPYnNpZGlhbi5zZXRJY29uKHRvZ2dsZSwgXCJyaWdodC10cmlhbmdsZVwiKTsgLy8gbXVzdCBjb21lIGJlZm9yZSBhZGRpbmcgb3RoZXIgZWxtcyBlbHNlIG92ZXJ3cml0ZXNcbiAgICAgIGNvbnN0IGZpbGVfbGluayA9IHRvZ2dsZS5jcmVhdGVFbChcImFcIiwge1xuICAgICAgICBjbHM6IFwic2VhcmNoLXJlc3VsdC1maWxlLXRpdGxlXCIsXG4gICAgICAgIHRpdGxlOiBmaWxlWzBdLmxpbmssXG4gICAgICB9KTtcbiAgICAgIGZpbGVfbGluay5pbm5lckhUTUwgPSBmaWxlX2xpbmtfdGV4dDtcbiAgICAgIC8vIGFkZCBsaW5rIGxpc3RlbmVycyB0byBmaWxlIGxpbmtcbiAgICAgIHRoaXMuYWRkX2xpbmtfbGlzdGVuZXJzKGZpbGVfbGluaywgZmlsZVswXSwgdG9nZ2xlKTtcbiAgICAgIHRvZ2dsZS5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKGV2ZW50KSA9PiB7XG4gICAgICAgIC8vIGZpbmQgcGFyZW50IGNvbnRhaW5pbmcgY2xhc3Mgc2VhcmNoLXJlc3VsdFxuICAgICAgICBsZXQgcGFyZW50ID0gZXZlbnQudGFyZ2V0O1xuICAgICAgICB3aGlsZSAoIXBhcmVudC5jbGFzc0xpc3QuY29udGFpbnMoXCJzZWFyY2gtcmVzdWx0XCIpKSB7XG4gICAgICAgICAgcGFyZW50ID0gcGFyZW50LnBhcmVudEVsZW1lbnQ7XG4gICAgICAgIH1cbiAgICAgICAgcGFyZW50LmNsYXNzTGlzdC50b2dnbGUoXCJzYy1jb2xsYXBzZWRcIik7XG4gICAgICAgIC8vIFRPRE86IGlmIGJsb2NrIGNvbnRhaW5lciBpcyBlbXB0eSwgcmVuZGVyIG1hcmtkb3duIGZyb20gYmxvY2sgcmV0cmlldmVyXG4gICAgICB9KTtcbiAgICAgIGNvbnN0IGZpbGVfbGlua19saXN0ID0gaXRlbS5jcmVhdGVFbChcInVsXCIpO1xuICAgICAgLy8gZm9yIGVhY2ggbGluayBpbiBmaWxlXG4gICAgICBmb3IgKGxldCBqID0gMDsgaiA8IGZpbGUubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgLy8gaWYgaXMgYSBibG9jayAoaGFzICMgaW4gbGluaylcbiAgICAgICAgaWYoZmlsZVtqXS5saW5rLmluZGV4T2YoXCIjXCIpID4gLTEpIHtcbiAgICAgICAgICBjb25zdCBibG9jayA9IGZpbGVbal07XG4gICAgICAgICAgY29uc3QgYmxvY2tfbGluayA9IGZpbGVfbGlua19saXN0LmNyZWF0ZUVsKFwibGlcIiwge1xuICAgICAgICAgICAgY2xzOiBcInNlYXJjaC1yZXN1bHQtZmlsZS10aXRsZSBpcy1jbGlja2FibGVcIixcbiAgICAgICAgICAgIHRpdGxlOiBibG9jay5saW5rLFxuICAgICAgICAgIH0pO1xuICAgICAgICAgIC8vIHNraXAgYmxvY2sgY29udGV4dCBpZiBmaWxlLmxlbmd0aCA9PT0gMSBiZWNhdXNlIGFscmVhZHkgYWRkZWRcbiAgICAgICAgICBpZihmaWxlLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgICAgIGNvbnN0IGJsb2NrX2NvbnRleHQgPSB0aGlzLnJlbmRlcl9ibG9ja19jb250ZXh0KGJsb2NrKTtcbiAgICAgICAgICAgIGNvbnN0IGJsb2NrX3NpbWlsYXJpdHlfcGN0ID0gTWF0aC5yb3VuZChibG9jay5zaW1pbGFyaXR5ICogMTAwKSArIFwiJVwiO1xuICAgICAgICAgICAgYmxvY2tfbGluay5pbm5lckhUTUwgPSBgPHNtYWxsPiR7YmxvY2tfY29udGV4dH0gfCAke2Jsb2NrX3NpbWlsYXJpdHlfcGN0fTwvc21hbGw+YDtcbiAgICAgICAgICB9XG4gICAgICAgICAgY29uc3QgYmxvY2tfY29udGFpbmVyID0gYmxvY2tfbGluay5jcmVhdGVFbChcImRpdlwiKTtcbiAgICAgICAgICAvLyBUT0RPOiBtb3ZlIHRvIHJlbmRlcmluZyBvbiBleHBhbmRpbmcgc2VjdGlvbiAodG9nZ2xlIGNvbGxhcHNlZClcbiAgICAgICAgICBPYnNpZGlhbi5NYXJrZG93blJlbmRlcmVyLnJlbmRlck1hcmtkb3duKChhd2FpdCB0aGlzLmJsb2NrX3JldHJpZXZlcihibG9jay5saW5rLCB7bGluZXM6IDEwLCBtYXhfY2hhcnM6IDEwMDB9KSksIGJsb2NrX2NvbnRhaW5lciwgYmxvY2subGluaywgbmV3IE9ic2lkaWFuLkNvbXBvbmVudCgpKTtcbiAgICAgICAgICAvLyBhZGQgbGluayBsaXN0ZW5lcnMgdG8gYmxvY2sgbGlua1xuICAgICAgICAgIHRoaXMuYWRkX2xpbmtfbGlzdGVuZXJzKGJsb2NrX2xpbmssIGJsb2NrLCBmaWxlX2xpbmtfbGlzdCk7XG4gICAgICAgIH1lbHNle1xuICAgICAgICAgIC8vIGdldCBmaXJzdCB0ZW4gbGluZXMgb2YgZmlsZVxuICAgICAgICAgIGNvbnN0IGZpbGVfbGlua19saXN0ID0gaXRlbS5jcmVhdGVFbChcInVsXCIpO1xuICAgICAgICAgIGNvbnN0IGJsb2NrX2xpbmsgPSBmaWxlX2xpbmtfbGlzdC5jcmVhdGVFbChcImxpXCIsIHtcbiAgICAgICAgICAgIGNsczogXCJzZWFyY2gtcmVzdWx0LWZpbGUtdGl0bGUgaXMtY2xpY2thYmxlXCIsXG4gICAgICAgICAgICB0aXRsZTogZmlsZVswXS5saW5rLFxuICAgICAgICAgIH0pO1xuICAgICAgICAgIGNvbnN0IGJsb2NrX2NvbnRhaW5lciA9IGJsb2NrX2xpbmsuY3JlYXRlRWwoXCJkaXZcIik7XG4gICAgICAgICAgbGV0IGZpcnN0X3Rlbl9saW5lcyA9IGF3YWl0IHRoaXMuZmlsZV9yZXRyaWV2ZXIoZmlsZVswXS5saW5rLCB7bGluZXM6IDEwLCBtYXhfY2hhcnM6IDEwMDB9KTtcbiAgICAgICAgICBpZighZmlyc3RfdGVuX2xpbmVzKSBjb250aW51ZTsgLy8gaWYgZmlsZSBub3QgZm91bmQsIHNraXBcbiAgICAgICAgICBPYnNpZGlhbi5NYXJrZG93blJlbmRlcmVyLnJlbmRlck1hcmtkb3duKGZpcnN0X3Rlbl9saW5lcywgYmxvY2tfY29udGFpbmVyLCBmaWxlWzBdLmxpbmssIG5ldyBPYnNpZGlhbi5Db21wb25lbnQoKSk7XG4gICAgICAgICAgdGhpcy5hZGRfbGlua19saXN0ZW5lcnMoYmxvY2tfbGluaywgZmlsZVswXSwgZmlsZV9saW5rX2xpc3QpO1xuXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy5yZW5kZXJfYnJhbmQoY29udGFpbmVyLCBcImZpbGVcIik7XG4gIH1cblxuICBhZGRfbGlua19saXN0ZW5lcnMoaXRlbSwgY3VyciwgbGlzdCkge1xuICAgIGl0ZW0uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIGFzeW5jIChldmVudCkgPT4ge1xuICAgICAgYXdhaXQgdGhpcy5vcGVuX25vdGUoY3VyciwgZXZlbnQpO1xuICAgIH0pO1xuICAgIC8vIGRyYWctb25cbiAgICAvLyBjdXJyZW50bHkgb25seSB3b3JrcyB3aXRoIGZ1bGwtZmlsZSBsaW5rc1xuICAgIGl0ZW0uc2V0QXR0cignZHJhZ2dhYmxlJywgJ3RydWUnKTtcbiAgICBpdGVtLmFkZEV2ZW50TGlzdGVuZXIoJ2RyYWdzdGFydCcsIChldmVudCkgPT4ge1xuICAgICAgY29uc3QgZHJhZ01hbmFnZXIgPSB0aGlzLmFwcC5kcmFnTWFuYWdlcjtcbiAgICAgIGNvbnN0IGZpbGVfcGF0aCA9IGN1cnIubGluay5zcGxpdChcIiNcIilbMF07XG4gICAgICBjb25zdCBmaWxlID0gdGhpcy5hcHAubWV0YWRhdGFDYWNoZS5nZXRGaXJzdExpbmtwYXRoRGVzdChmaWxlX3BhdGgsICcnKTtcbiAgICAgIGNvbnN0IGRyYWdEYXRhID0gZHJhZ01hbmFnZXIuZHJhZ0ZpbGUoZXZlbnQsIGZpbGUpO1xuICAgICAgLy8gY29uc29sZS5sb2coZHJhZ0RhdGEpO1xuICAgICAgZHJhZ01hbmFnZXIub25EcmFnU3RhcnQoZXZlbnQsIGRyYWdEYXRhKTtcbiAgICB9KTtcbiAgICAvLyBpZiBjdXJyLmxpbmsgY29udGFpbnMgY3VybHkgYnJhY2VzLCByZXR1cm4gKGluY29tcGF0aWJsZSB3aXRoIGhvdmVyLWxpbmspXG4gICAgaWYgKGN1cnIubGluay5pbmRleE9mKFwie1wiKSA+IC0xKSByZXR1cm47XG4gICAgLy8gdHJpZ2dlciBob3ZlciBldmVudCBvbiBsaW5rXG4gICAgaXRlbS5hZGRFdmVudExpc3RlbmVyKFwibW91c2VvdmVyXCIsIChldmVudCkgPT4ge1xuICAgICAgdGhpcy5hcHAud29ya3NwYWNlLnRyaWdnZXIoXCJob3Zlci1saW5rXCIsIHtcbiAgICAgICAgZXZlbnQsXG4gICAgICAgIHNvdXJjZTogU01BUlRfQ09OTkVDVElPTlNfVklFV19UWVBFLFxuICAgICAgICBob3ZlclBhcmVudDogbGlzdCxcbiAgICAgICAgdGFyZ2V0RWw6IGl0ZW0sXG4gICAgICAgIGxpbmt0ZXh0OiBjdXJyLmxpbmssXG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIC8vIGdldCB0YXJnZXQgZmlsZSBmcm9tIGxpbmsgcGF0aFxuICAvLyBpZiBzdWItc2VjdGlvbiBpcyBsaW5rZWQsIG9wZW4gZmlsZSBhbmQgc2Nyb2xsIHRvIHN1Yi1zZWN0aW9uXG4gIGFzeW5jIG9wZW5fbm90ZShjdXJyLCBldmVudD1udWxsKSB7XG4gICAgbGV0IHRhcmdldEZpbGU7XG4gICAgbGV0IGhlYWRpbmc7XG4gICAgaWYgKGN1cnIubGluay5pbmRleE9mKFwiI1wiKSA+IC0xKSB7XG4gICAgICAvLyByZW1vdmUgYWZ0ZXIgIyBmcm9tIGxpbmtcbiAgICAgIHRhcmdldEZpbGUgPSB0aGlzLmFwcC5tZXRhZGF0YUNhY2hlLmdldEZpcnN0TGlua3BhdGhEZXN0KGN1cnIubGluay5zcGxpdChcIiNcIilbMF0sIFwiXCIpO1xuICAgICAgLy8gY29uc29sZS5sb2codGFyZ2V0RmlsZSk7XG4gICAgICBjb25zdCB0YXJnZXRfZmlsZV9jYWNoZSA9IHRoaXMuYXBwLm1ldGFkYXRhQ2FjaGUuZ2V0RmlsZUNhY2hlKHRhcmdldEZpbGUpO1xuICAgICAgLy8gY29uc29sZS5sb2codGFyZ2V0X2ZpbGVfY2FjaGUpO1xuICAgICAgLy8gZ2V0IGhlYWRpbmdcbiAgICAgIGxldCBoZWFkaW5nX3RleHQgPSBjdXJyLmxpbmsuc3BsaXQoXCIjXCIpLnBvcCgpO1xuICAgICAgLy8gaWYgaGVhZGluZyB0ZXh0IGNvbnRhaW5zIGEgY3VybHkgYnJhY2UsIGdldCB0aGUgbnVtYmVyIGluc2lkZSB0aGUgY3VybHkgYnJhY2VzIGFzIG9jY3VyZW5jZVxuICAgICAgbGV0IG9jY3VyZW5jZSA9IDA7XG4gICAgICBpZiAoaGVhZGluZ190ZXh0LmluZGV4T2YoXCJ7XCIpID4gLTEpIHtcbiAgICAgICAgLy8gZ2V0IG9jY3VyZW5jZVxuICAgICAgICBvY2N1cmVuY2UgPSBwYXJzZUludChoZWFkaW5nX3RleHQuc3BsaXQoXCJ7XCIpWzFdLnNwbGl0KFwifVwiKVswXSk7XG4gICAgICAgIC8vIHJlbW92ZSBvY2N1cmVuY2UgZnJvbSBoZWFkaW5nIHRleHRcbiAgICAgICAgaGVhZGluZ190ZXh0ID0gaGVhZGluZ190ZXh0LnNwbGl0KFwie1wiKVswXTtcbiAgICAgIH1cbiAgICAgIC8vIGdldCBoZWFkaW5ncyBmcm9tIGZpbGUgY2FjaGVcbiAgICAgIGNvbnN0IGhlYWRpbmdzID0gdGFyZ2V0X2ZpbGVfY2FjaGUuaGVhZGluZ3M7XG4gICAgICAvLyBnZXQgaGVhZGluZ3Mgd2l0aCB0aGUgc2FtZSBkZXB0aCBhbmQgdGV4dCBhcyB0aGUgbGlua1xuICAgICAgZm9yKGxldCBpID0gMDsgaSA8IGhlYWRpbmdzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGlmIChoZWFkaW5nc1tpXS5oZWFkaW5nID09PSBoZWFkaW5nX3RleHQpIHtcbiAgICAgICAgICAvLyBpZiBvY2N1cmVuY2UgaXMgMCwgc2V0IGhlYWRpbmcgYW5kIGJyZWFrXG4gICAgICAgICAgaWYob2NjdXJlbmNlID09PSAwKSB7XG4gICAgICAgICAgICBoZWFkaW5nID0gaGVhZGluZ3NbaV07XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG4gICAgICAgICAgb2NjdXJlbmNlLS07IC8vIGRlY3JlbWVudCBvY2N1cmVuY2VcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgLy8gY29uc29sZS5sb2coaGVhZGluZyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRhcmdldEZpbGUgPSB0aGlzLmFwcC5tZXRhZGF0YUNhY2hlLmdldEZpcnN0TGlua3BhdGhEZXN0KGN1cnIubGluaywgXCJcIik7XG4gICAgfVxuICAgIGxldCBsZWFmO1xuICAgIGlmKGV2ZW50KSB7XG4gICAgICAvLyBwcm9wZXJseSBoYW5kbGUgaWYgdGhlIG1ldGEvY3RybCBrZXkgaXMgcHJlc3NlZFxuICAgICAgY29uc3QgbW9kID0gT2JzaWRpYW4uS2V5bWFwLmlzTW9kRXZlbnQoZXZlbnQpO1xuICAgICAgLy8gZ2V0IG1vc3QgcmVjZW50IGxlYWZcbiAgICAgIGxlYWYgPSB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0TGVhZihtb2QpO1xuICAgIH1lbHNle1xuICAgICAgLy8gZ2V0IG1vc3QgcmVjZW50IGxlYWZcbiAgICAgIGxlYWYgPSB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0TW9zdFJlY2VudExlYWYoKTtcbiAgICB9XG4gICAgYXdhaXQgbGVhZi5vcGVuRmlsZSh0YXJnZXRGaWxlKTtcbiAgICBpZiAoaGVhZGluZykge1xuICAgICAgbGV0IHsgZWRpdG9yIH0gPSBsZWFmLnZpZXc7XG4gICAgICBjb25zdCBwb3MgPSB7IGxpbmU6IGhlYWRpbmcucG9zaXRpb24uc3RhcnQubGluZSwgY2g6IDAgfTtcbiAgICAgIGVkaXRvci5zZXRDdXJzb3IocG9zKTtcbiAgICAgIGVkaXRvci5zY3JvbGxJbnRvVmlldyh7IHRvOiBwb3MsIGZyb206IHBvcyB9LCB0cnVlKTtcbiAgICB9XG4gIH1cblxuICByZW5kZXJfYmxvY2tfY29udGV4dChibG9jaykge1xuICAgIGNvbnN0IGJsb2NrX2hlYWRpbmdzID0gYmxvY2subGluay5zcGxpdChcIi5tZFwiKVsxXS5zcGxpdChcIiNcIik7XG4gICAgLy8gc3RhcnRpbmcgd2l0aCB0aGUgbGFzdCBoZWFkaW5nIGZpcnN0LCBpdGVyYXRlIHRocm91Z2ggaGVhZGluZ3NcbiAgICBsZXQgYmxvY2tfY29udGV4dCA9IFwiXCI7XG4gICAgZm9yIChsZXQgaSA9IGJsb2NrX2hlYWRpbmdzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgICBpZihibG9ja19jb250ZXh0Lmxlbmd0aCA+IDApIHtcbiAgICAgICAgYmxvY2tfY29udGV4dCA9IGAgPiAke2Jsb2NrX2NvbnRleHR9YDtcbiAgICAgIH1cbiAgICAgIGJsb2NrX2NvbnRleHQgPSBibG9ja19oZWFkaW5nc1tpXSArIGJsb2NrX2NvbnRleHQ7XG4gICAgICAvLyBpZiBibG9jayBjb250ZXh0IGlzIGxvbmdlciB0aGFuIE4gY2hhcmFjdGVycywgYnJlYWtcbiAgICAgIGlmIChibG9ja19jb250ZXh0Lmxlbmd0aCA+IDEwMCkge1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gICAgLy8gcmVtb3ZlIGxlYWRpbmcgPiBpZiBleGlzdHNcbiAgICBpZiAoYmxvY2tfY29udGV4dC5zdGFydHNXaXRoKFwiID4gXCIpKSB7XG4gICAgICBibG9ja19jb250ZXh0ID0gYmxvY2tfY29udGV4dC5zbGljZSgzKTtcbiAgICB9XG4gICAgcmV0dXJuIGJsb2NrX2NvbnRleHQ7XG5cbiAgfVxuXG4gIHJlbmRlcmFibGVfZmlsZV90eXBlKGxpbmspIHtcbiAgICByZXR1cm4gKGxpbmsuaW5kZXhPZihcIi5tZFwiKSAhPT0gLTEpICYmIChsaW5rLmluZGV4T2YoXCIuZXhjYWxpZHJhd1wiKSA9PT0gLTEpO1xuICB9XG5cbiAgcmVuZGVyX2V4dGVybmFsX2xpbmtfZWxtKG1ldGEpe1xuICAgIGlmKG1ldGEuc291cmNlKSB7XG4gICAgICBpZihtZXRhLnNvdXJjZSA9PT0gXCJHbWFpbFwiKSBtZXRhLnNvdXJjZSA9IFwiXHVEODNEXHVEQ0U3IEdtYWlsXCI7XG4gICAgICByZXR1cm4gYDxzbWFsbD4ke21ldGEuc291cmNlfTwvc21hbGw+PGJyPiR7bWV0YS50aXRsZX1gO1xuICAgIH1cbiAgICAvLyByZW1vdmUgaHR0cChzKTovL1xuICAgIGxldCBkb21haW4gPSBtZXRhLnBhdGgucmVwbGFjZSgvKF5cXHcrOnxeKVxcL1xcLy8sIFwiXCIpO1xuICAgIC8vIHNlcGFyYXRlIGRvbWFpbiBmcm9tIHBhdGhcbiAgICBkb21haW4gPSBkb21haW4uc3BsaXQoXCIvXCIpWzBdO1xuICAgIC8vIHdyYXAgZG9tYWluIGluIDxzbWFsbD4gYW5kIGFkZCBsaW5lIGJyZWFrXG4gICAgcmV0dXJuIGA8c21hbGw+XHVEODNDXHVERjEwICR7ZG9tYWlufTwvc21hbGw+PGJyPiR7bWV0YS50aXRsZX1gO1xuICB9XG4gIC8vIGdldCBhbGwgZm9sZGVyc1xuICBhc3luYyBnZXRfYWxsX2ZvbGRlcnMoKSB7XG4gICAgaWYoIXRoaXMuZm9sZGVycyB8fCB0aGlzLmZvbGRlcnMubGVuZ3RoID09PSAwKXtcbiAgICAgIHRoaXMuZm9sZGVycyA9IGF3YWl0IHRoaXMuZ2V0X2ZvbGRlcnMoKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuZm9sZGVycztcbiAgfVxuICAvLyBnZXQgZm9sZGVycywgdHJhdmVyc2Ugbm9uLWhpZGRlbiBzdWItZm9sZGVyc1xuICBhc3luYyBnZXRfZm9sZGVycyhwYXRoID0gXCIvXCIpIHtcbiAgICBsZXQgZm9sZGVycyA9IChhd2FpdCB0aGlzLmFwcC52YXVsdC5hZGFwdGVyLmxpc3QocGF0aCkpLmZvbGRlcnM7XG4gICAgbGV0IGZvbGRlcl9saXN0ID0gW107XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBmb2xkZXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAoZm9sZGVyc1tpXS5zdGFydHNXaXRoKFwiLlwiKSkgY29udGludWU7XG4gICAgICBmb2xkZXJfbGlzdC5wdXNoKGZvbGRlcnNbaV0pO1xuICAgICAgZm9sZGVyX2xpc3QgPSBmb2xkZXJfbGlzdC5jb25jYXQoYXdhaXQgdGhpcy5nZXRfZm9sZGVycyhmb2xkZXJzW2ldICsgXCIvXCIpKTtcbiAgICB9XG4gICAgcmV0dXJuIGZvbGRlcl9saXN0O1xuICB9XG5cblxuICBhc3luYyBzeW5jX25vdGVzKCkge1xuICAgIC8vIGlmIGxpY2Vuc2Uga2V5IGlzIG5vdCBzZXQsIHJldHVyblxuICAgIGlmKCF0aGlzLnNldHRpbmdzLmxpY2Vuc2Vfa2V5KXtcbiAgICAgIG5ldyBPYnNpZGlhbi5Ob3RpY2UoXCJTbWFydCBDb25uZWN0aW9uczogU3VwcG9ydGVyIGxpY2Vuc2Uga2V5IGlzIHJlcXVpcmVkIHRvIHN5bmMgbm90ZXMgdG8gdGhlIENoYXRHUFQgUGx1Z2luIHNlcnZlci5cIik7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGNvbnNvbGUubG9nKFwic3luY2luZyBub3Rlc1wiKTtcbiAgICAvLyBnZXQgYWxsIGZpbGVzIGluIHZhdWx0XG4gICAgY29uc3QgZmlsZXMgPSB0aGlzLmFwcC52YXVsdC5nZXRNYXJrZG93bkZpbGVzKCkuZmlsdGVyKChmaWxlKSA9PiB7XG4gICAgICAvLyBmaWx0ZXIgb3V0IGZpbGUgcGF0aHMgbWF0Y2hpbmcgYW55IHN0cmluZ3MgaW4gdGhpcy5maWxlX2V4Y2x1c2lvbnNcbiAgICAgIGZvcihsZXQgaSA9IDA7IGkgPCB0aGlzLmZpbGVfZXhjbHVzaW9ucy5sZW5ndGg7IGkrKykge1xuICAgICAgICBpZihmaWxlLnBhdGguaW5kZXhPZih0aGlzLmZpbGVfZXhjbHVzaW9uc1tpXSkgPiAtMSkge1xuICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSk7XG4gICAgY29uc3Qgbm90ZXMgPSBhd2FpdCB0aGlzLmJ1aWxkX25vdGVzX29iamVjdChmaWxlcyk7XG4gICAgY29uc29sZS5sb2coXCJvYmplY3QgYnVpbHRcIik7XG4gICAgLy8gc2F2ZSBub3RlcyBvYmplY3QgdG8gLnNtYXJ0LWNvbm5lY3Rpb25zL25vdGVzLmpzb25cbiAgICBhd2FpdCB0aGlzLmFwcC52YXVsdC5hZGFwdGVyLndyaXRlKFwiLnNtYXJ0LWNvbm5lY3Rpb25zL25vdGVzLmpzb25cIiwgSlNPTi5zdHJpbmdpZnkobm90ZXMsIG51bGwsIDIpKTtcbiAgICBjb25zb2xlLmxvZyhcIm5vdGVzIHNhdmVkXCIpO1xuICAgIGNvbnNvbGUubG9nKHRoaXMuc2V0dGluZ3MubGljZW5zZV9rZXkpO1xuICAgIC8vIFBPU1Qgbm90ZXMgb2JqZWN0IHRvIHNlcnZlclxuICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgKDAsIE9ic2lkaWFuLnJlcXVlc3RVcmwpKHtcbiAgICAgIHVybDogXCJodHRwczovL3N5bmMuc21hcnRjb25uZWN0aW9ucy5hcHAvc3luY1wiLFxuICAgICAgbWV0aG9kOiBcIlBPU1RcIixcbiAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgXCJDb250ZW50LVR5cGVcIjogXCJhcHBsaWNhdGlvbi9qc29uXCIsXG4gICAgICB9LFxuICAgICAgY29udGVudFR5cGU6IFwiYXBwbGljYXRpb24vanNvblwiLFxuICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICBsaWNlbnNlX2tleTogdGhpcy5zZXR0aW5ncy5saWNlbnNlX2tleSxcbiAgICAgICAgbm90ZXM6IG5vdGVzXG4gICAgICB9KVxuICAgIH0pO1xuICAgIGNvbnNvbGUubG9nKHJlc3BvbnNlKTtcblxuICB9XG5cbiAgYXN5bmMgYnVpbGRfbm90ZXNfb2JqZWN0KGZpbGVzKSB7XG4gICAgbGV0IG91dHB1dCA9IHt9O1xuICBcbiAgICBmb3IobGV0IGkgPSAwOyBpIDwgZmlsZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGxldCBmaWxlID0gZmlsZXNbaV07XG4gICAgICBsZXQgcGFydHMgPSBmaWxlLnBhdGguc3BsaXQoXCIvXCIpO1xuICAgICAgbGV0IGN1cnJlbnQgPSBvdXRwdXQ7XG4gIFxuICAgICAgZm9yIChsZXQgaWkgPSAwOyBpaSA8IHBhcnRzLmxlbmd0aDsgaWkrKykge1xuICAgICAgICBsZXQgcGFydCA9IHBhcnRzW2lpXTtcbiAgXG4gICAgICAgIGlmIChpaSA9PT0gcGFydHMubGVuZ3RoIC0gMSkge1xuICAgICAgICAgIC8vIFRoaXMgaXMgYSBmaWxlXG4gICAgICAgICAgY3VycmVudFtwYXJ0XSA9IGF3YWl0IHRoaXMuYXBwLnZhdWx0LmNhY2hlZFJlYWQoZmlsZSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy8gVGhpcyBpcyBhIGRpcmVjdG9yeVxuICAgICAgICAgIGlmICghY3VycmVudFtwYXJ0XSkge1xuICAgICAgICAgICAgY3VycmVudFtwYXJ0XSA9IHt9O1xuICAgICAgICAgIH1cbiAgXG4gICAgICAgICAgY3VycmVudCA9IGN1cnJlbnRbcGFydF07XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIFxuICAgIHJldHVybiBvdXRwdXQ7XG4gIH1cblxufVxuXG5jb25zdCBTTUFSVF9DT05ORUNUSU9OU19WSUVXX1RZUEUgPSBcInNtYXJ0LWNvbm5lY3Rpb25zLXZpZXdcIjtcbmNsYXNzIFNtYXJ0Q29ubmVjdGlvbnNWaWV3IGV4dGVuZHMgT2JzaWRpYW4uSXRlbVZpZXcge1xuICBjb25zdHJ1Y3RvcihsZWFmLCBwbHVnaW4pIHtcbiAgICBzdXBlcihsZWFmKTtcbiAgICB0aGlzLnBsdWdpbiA9IHBsdWdpbjtcbiAgICB0aGlzLm5lYXJlc3QgPSBudWxsO1xuICAgIHRoaXMubG9hZF93YWl0ID0gbnVsbDtcbiAgfVxuICBnZXRWaWV3VHlwZSgpIHtcbiAgICByZXR1cm4gU01BUlRfQ09OTkVDVElPTlNfVklFV19UWVBFO1xuICB9XG5cbiAgZ2V0RGlzcGxheVRleHQoKSB7XG4gICAgcmV0dXJuIFwiU21hcnQgQ29ubmVjdGlvbnMgRmlsZXNcIjtcbiAgfVxuXG4gIGdldEljb24oKSB7XG4gICAgcmV0dXJuIFwic21hcnQtY29ubmVjdGlvbnNcIjtcbiAgfVxuXG5cbiAgc2V0X21lc3NhZ2UobWVzc2FnZSkge1xuICAgIGNvbnN0IGNvbnRhaW5lciA9IHRoaXMuY29udGFpbmVyRWwuY2hpbGRyZW5bMV07XG4gICAgLy8gY2xlYXIgY29udGFpbmVyXG4gICAgY29udGFpbmVyLmVtcHR5KCk7XG4gICAgLy8gaW5pdGlhdGUgdG9wIGJhclxuICAgIHRoaXMuaW5pdGlhdGVfdG9wX2Jhcihjb250YWluZXIpO1xuICAgIC8vIGlmIG1lc2FnZSBpcyBhbiBhcnJheSwgbG9vcCB0aHJvdWdoIGFuZCBjcmVhdGUgYSBuZXcgcCBlbGVtZW50IGZvciBlYWNoIG1lc3NhZ2VcbiAgICBpZiAoQXJyYXkuaXNBcnJheShtZXNzYWdlKSkge1xuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBtZXNzYWdlLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGNvbnRhaW5lci5jcmVhdGVFbChcInBcIiwgeyBjbHM6IFwic2NfbWVzc2FnZVwiLCB0ZXh0OiBtZXNzYWdlW2ldIH0pO1xuICAgICAgfVxuICAgIH1lbHNle1xuICAgICAgLy8gY3JlYXRlIHAgZWxlbWVudCB3aXRoIG1lc3NhZ2VcbiAgICAgIGNvbnRhaW5lci5jcmVhdGVFbChcInBcIiwgeyBjbHM6IFwic2NfbWVzc2FnZVwiLCB0ZXh0OiBtZXNzYWdlIH0pO1xuICAgIH1cbiAgfVxuICByZW5kZXJfbGlua190ZXh0KGxpbmssIHNob3dfZnVsbF9wYXRoPWZhbHNlKSB7XG4gICAgLyoqXG4gICAgICogQmVnaW4gaW50ZXJuYWwgbGlua3NcbiAgICAgKi9cbiAgICAvLyBpZiBzaG93IGZ1bGwgcGF0aCBpcyBmYWxzZSwgcmVtb3ZlIGZpbGUgcGF0aFxuICAgIGlmICghc2hvd19mdWxsX3BhdGgpIHtcbiAgICAgIGxpbmsgPSBsaW5rLnNwbGl0KFwiL1wiKS5wb3AoKTtcbiAgICB9XG4gICAgLy8gaWYgY29udGFpbnMgJyMnXG4gICAgaWYgKGxpbmsuaW5kZXhPZihcIiNcIikgPiAtMSkge1xuICAgICAgLy8gc3BsaXQgYXQgLm1kXG4gICAgICBsaW5rID0gbGluay5zcGxpdChcIi5tZFwiKTtcbiAgICAgIC8vIHdyYXAgZmlyc3QgcGFydCBpbiA8c21hbGw+IGFuZCBhZGQgbGluZSBicmVha1xuICAgICAgbGlua1swXSA9IGA8c21hbGw+JHtsaW5rWzBdfTwvc21hbGw+PGJyPmA7XG4gICAgICAvLyBqb2luIGJhY2sgdG9nZXRoZXJcbiAgICAgIGxpbmsgPSBsaW5rLmpvaW4oXCJcIik7XG4gICAgICAvLyByZXBsYWNlICcjJyB3aXRoICcgXHUwMEJCICdcbiAgICAgIGxpbmsgPSBsaW5rLnJlcGxhY2UoL1xcIy9nLCBcIiBcdTAwQkIgXCIpO1xuICAgIH1lbHNle1xuICAgICAgLy8gcmVtb3ZlICcubWQnXG4gICAgICBsaW5rID0gbGluay5yZXBsYWNlKFwiLm1kXCIsIFwiXCIpO1xuICAgIH1cbiAgICByZXR1cm4gbGluaztcbiAgfVxuXG5cbiAgc2V0X25lYXJlc3QobmVhcmVzdCwgbmVhcmVzdF9jb250ZXh0PW51bGwsIHJlc3VsdHNfb25seT1mYWxzZSkge1xuICAgIC8vIGdldCBjb250YWluZXIgZWxlbWVudFxuICAgIGNvbnN0IGNvbnRhaW5lciA9IHRoaXMuY29udGFpbmVyRWwuY2hpbGRyZW5bMV07XG4gICAgLy8gaWYgcmVzdWx0cyBvbmx5IGlzIGZhbHNlLCBjbGVhciBjb250YWluZXIgYW5kIGluaXRpYXRlIHRvcCBiYXJcbiAgICBpZighcmVzdWx0c19vbmx5KXtcbiAgICAgIC8vIGNsZWFyIGNvbnRhaW5lclxuICAgICAgY29udGFpbmVyLmVtcHR5KCk7XG4gICAgICB0aGlzLmluaXRpYXRlX3RvcF9iYXIoY29udGFpbmVyLCBuZWFyZXN0X2NvbnRleHQpO1xuICAgIH1cbiAgICAvLyB1cGRhdGUgcmVzdWx0c1xuICAgIHRoaXMucGx1Z2luLnVwZGF0ZV9yZXN1bHRzKGNvbnRhaW5lciwgbmVhcmVzdCk7XG4gIH1cblxuICBpbml0aWF0ZV90b3BfYmFyKGNvbnRhaW5lciwgbmVhcmVzdF9jb250ZXh0PW51bGwpIHtcbiAgICBsZXQgdG9wX2JhcjtcbiAgICAvLyBpZiB0b3AgYmFyIGFscmVhZHkgZXhpc3RzLCBlbXB0eSBpdFxuICAgIGlmICgoY29udGFpbmVyLmNoaWxkcmVuLmxlbmd0aCA+IDApICYmIChjb250YWluZXIuY2hpbGRyZW5bMF0uY2xhc3NMaXN0LmNvbnRhaW5zKFwic2MtdG9wLWJhclwiKSkpIHtcbiAgICAgIHRvcF9iYXIgPSBjb250YWluZXIuY2hpbGRyZW5bMF07XG4gICAgICB0b3BfYmFyLmVtcHR5KCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIGluaXQgY29udGFpbmVyIGZvciB0b3AgYmFyXG4gICAgICB0b3BfYmFyID0gY29udGFpbmVyLmNyZWF0ZUVsKFwiZGl2XCIsIHsgY2xzOiBcInNjLXRvcC1iYXJcIiB9KTtcbiAgICB9XG4gICAgLy8gaWYgaGlnaGxpZ2h0ZWQgdGV4dCBpcyBub3QgbnVsbCwgY3JlYXRlIHAgZWxlbWVudCB3aXRoIGhpZ2hsaWdodGVkIHRleHRcbiAgICBpZiAobmVhcmVzdF9jb250ZXh0KSB7XG4gICAgICB0b3BfYmFyLmNyZWF0ZUVsKFwicFwiLCB7IGNsczogXCJzYy1jb250ZXh0XCIsIHRleHQ6IG5lYXJlc3RfY29udGV4dCB9KTtcbiAgICB9XG4gICAgLy8gYWRkIGNoYXQgYnV0dG9uXG4gICAgY29uc3QgY2hhdF9idXR0b24gPSB0b3BfYmFyLmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHsgY2xzOiBcInNjLWNoYXQtYnV0dG9uXCIgfSk7XG4gICAgLy8gYWRkIGljb24gdG8gY2hhdCBidXR0b25cbiAgICBPYnNpZGlhbi5zZXRJY29uKGNoYXRfYnV0dG9uLCBcIm1lc3NhZ2Utc3F1YXJlXCIpO1xuICAgIC8vIGFkZCBjbGljayBsaXN0ZW5lciB0byBjaGF0IGJ1dHRvblxuICAgIGNoYXRfYnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiB7XG4gICAgICAvLyBvcGVuIGNoYXRcbiAgICAgIHRoaXMucGx1Z2luLm9wZW5fY2hhdCgpO1xuICAgIH0pO1xuICAgIC8vIGFkZCBzZWFyY2ggYnV0dG9uXG4gICAgY29uc3Qgc2VhcmNoX2J1dHRvbiA9IHRvcF9iYXIuY3JlYXRlRWwoXCJidXR0b25cIiwgeyBjbHM6IFwic2Mtc2VhcmNoLWJ1dHRvblwiIH0pO1xuICAgIC8vIGFkZCBpY29uIHRvIHNlYXJjaCBidXR0b25cbiAgICBPYnNpZGlhbi5zZXRJY29uKHNlYXJjaF9idXR0b24sIFwic2VhcmNoXCIpO1xuICAgIC8vIGFkZCBjbGljayBsaXN0ZW5lciB0byBzZWFyY2ggYnV0dG9uXG4gICAgc2VhcmNoX2J1dHRvbi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4ge1xuICAgICAgLy8gZW1wdHkgdG9wIGJhclxuICAgICAgdG9wX2Jhci5lbXB0eSgpO1xuICAgICAgLy8gY3JlYXRlIGlucHV0IGVsZW1lbnRcbiAgICAgIGNvbnN0IHNlYXJjaF9jb250YWluZXIgPSB0b3BfYmFyLmNyZWF0ZUVsKFwiZGl2XCIsIHsgY2xzOiBcInNlYXJjaC1pbnB1dC1jb250YWluZXJcIiB9KTtcbiAgICAgIGNvbnN0IGlucHV0ID0gc2VhcmNoX2NvbnRhaW5lci5jcmVhdGVFbChcImlucHV0XCIsIHtcbiAgICAgICAgY2xzOiBcInNjLXNlYXJjaC1pbnB1dFwiLFxuICAgICAgICB0eXBlOiBcInNlYXJjaFwiLFxuICAgICAgICBwbGFjZWhvbGRlcjogXCJUeXBlIHRvIHN0YXJ0IHNlYXJjaC4uLlwiLCBcbiAgICAgIH0pO1xuICAgICAgLy8gZm9jdXMgaW5wdXRcbiAgICAgIGlucHV0LmZvY3VzKCk7XG4gICAgICAvLyBhZGQga2V5ZG93biBsaXN0ZW5lciB0byBpbnB1dFxuICAgICAgaW5wdXQuYWRkRXZlbnRMaXN0ZW5lcihcImtleWRvd25cIiwgKGV2ZW50KSA9PiB7XG4gICAgICAgIC8vIGlmIGVzY2FwZSBrZXkgaXMgcHJlc3NlZFxuICAgICAgICBpZiAoZXZlbnQua2V5ID09PSBcIkVzY2FwZVwiKSB7XG4gICAgICAgICAgdGhpcy5jbGVhcl9hdXRvX3NlYXJjaGVyKCk7XG4gICAgICAgICAgLy8gY2xlYXIgdG9wIGJhclxuICAgICAgICAgIHRoaXMuaW5pdGlhdGVfdG9wX2Jhcihjb250YWluZXIsIG5lYXJlc3RfY29udGV4dCk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuXG4gICAgICAvLyBhZGQga2V5dXAgbGlzdGVuZXIgdG8gaW5wdXRcbiAgICAgIGlucHV0LmFkZEV2ZW50TGlzdGVuZXIoXCJrZXl1cFwiLCAoZXZlbnQpID0+IHtcbiAgICAgICAgLy8gaWYgdGhpcy5zZWFyY2hfdGltZW91dCBpcyBub3QgbnVsbCB0aGVuIGNsZWFyIGl0IGFuZCBzZXQgdG8gbnVsbFxuICAgICAgICB0aGlzLmNsZWFyX2F1dG9fc2VhcmNoZXIoKTtcbiAgICAgICAgLy8gZ2V0IHNlYXJjaCB0ZXJtXG4gICAgICAgIGNvbnN0IHNlYXJjaF90ZXJtID0gaW5wdXQudmFsdWU7XG4gICAgICAgIC8vIGlmIGVudGVyIGtleSBpcyBwcmVzc2VkXG4gICAgICAgIGlmIChldmVudC5rZXkgPT09IFwiRW50ZXJcIiAmJiBzZWFyY2hfdGVybSAhPT0gXCJcIikge1xuICAgICAgICAgIHRoaXMuc2VhcmNoKHNlYXJjaF90ZXJtKTtcbiAgICAgICAgfVxuICAgICAgICAvLyBpZiBhbnkgb3RoZXIga2V5IGlzIHByZXNzZWQgYW5kIGlucHV0IGlzIG5vdCBlbXB0eSB0aGVuIHdhaXQgNTAwbXMgYW5kIG1ha2VfY29ubmVjdGlvbnNcbiAgICAgICAgZWxzZSBpZiAoc2VhcmNoX3Rlcm0gIT09IFwiXCIpIHtcbiAgICAgICAgICAvLyBjbGVhciB0aW1lb3V0XG4gICAgICAgICAgY2xlYXJUaW1lb3V0KHRoaXMuc2VhcmNoX3RpbWVvdXQpO1xuICAgICAgICAgIC8vIHNldCB0aW1lb3V0XG4gICAgICAgICAgdGhpcy5zZWFyY2hfdGltZW91dCA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5zZWFyY2goc2VhcmNoX3Rlcm0sIHRydWUpO1xuICAgICAgICAgIH0sIDcwMCk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG5cbiAgLy8gcmVuZGVyIGJ1dHRvbnM6IFwiY3JlYXRlXCIgYW5kIFwicmV0cnlcIiBmb3IgbG9hZGluZyBlbWJlZGRpbmdzLmpzb24gZmlsZVxuICByZW5kZXJfZW1iZWRkaW5nc19idXR0b25zKCkge1xuICAgIC8vIGdldCBjb250YWluZXIgZWxlbWVudFxuICAgIGNvbnN0IGNvbnRhaW5lciA9IHRoaXMuY29udGFpbmVyRWwuY2hpbGRyZW5bMV07XG4gICAgLy8gY2xlYXIgY29udGFpbmVyXG4gICAgY29udGFpbmVyLmVtcHR5KCk7XG4gICAgLy8gY3JlYXRlIGhlYWRpbmcgdGhhdCBzYXlzIFwiRW1iZWRkaW5ncyBmaWxlIG5vdCBmb3VuZFwiXG4gICAgY29udGFpbmVyLmNyZWF0ZUVsKFwiaDJcIiwgeyBjbHM6IFwic2NIZWFkaW5nXCIsIHRleHQ6IFwiRW1iZWRkaW5ncyBmaWxlIG5vdCBmb3VuZFwiIH0pO1xuICAgIC8vIGNyZWF0ZSBkaXYgZm9yIGJ1dHRvbnNcbiAgICBjb25zdCBidXR0b25fZGl2ID0gY29udGFpbmVyLmNyZWF0ZUVsKFwiZGl2XCIsIHsgY2xzOiBcInNjQnV0dG9uRGl2XCIgfSk7XG4gICAgLy8gY3JlYXRlIFwiY3JlYXRlXCIgYnV0dG9uXG4gICAgY29uc3QgY3JlYXRlX2J1dHRvbiA9IGJ1dHRvbl9kaXYuY3JlYXRlRWwoXCJidXR0b25cIiwgeyBjbHM6IFwic2NCdXR0b25cIiwgdGV4dDogXCJDcmVhdGUgZW1iZWRkaW5ncy5qc29uXCIgfSk7XG4gICAgLy8gbm90ZSB0aGF0IGNyZWF0aW5nIGVtYmVkZGluZ3MuanNvbiBmaWxlIHdpbGwgdHJpZ2dlciBidWxrIGVtYmVkZGluZyBhbmQgbWF5IHRha2UgYSB3aGlsZVxuICAgIGJ1dHRvbl9kaXYuY3JlYXRlRWwoXCJwXCIsIHsgY2xzOiBcInNjQnV0dG9uTm90ZVwiLCB0ZXh0OiBcIldhcm5pbmc6IENyZWF0aW5nIGVtYmVkZGluZ3MuanNvbiBmaWxlIHdpbGwgdHJpZ2dlciBidWxrIGVtYmVkZGluZyBhbmQgbWF5IHRha2UgYSB3aGlsZVwiIH0pO1xuICAgIC8vIGNyZWF0ZSBcInJldHJ5XCIgYnV0dG9uXG4gICAgY29uc3QgcmV0cnlfYnV0dG9uID0gYnV0dG9uX2Rpdi5jcmVhdGVFbChcImJ1dHRvblwiLCB7IGNsczogXCJzY0J1dHRvblwiLCB0ZXh0OiBcIlJldHJ5XCIgfSk7XG4gICAgLy8gdHJ5IHRvIGxvYWQgZW1iZWRkaW5ncy5qc29uIGZpbGUgYWdhaW5cbiAgICBidXR0b25fZGl2LmNyZWF0ZUVsKFwicFwiLCB7IGNsczogXCJzY0J1dHRvbk5vdGVcIiwgdGV4dDogXCJJZiBlbWJlZGRpbmdzLmpzb24gZmlsZSBhbHJlYWR5IGV4aXN0cywgY2xpY2sgJ1JldHJ5JyB0byBsb2FkIGl0XCIgfSk7XG5cbiAgICAvLyBhZGQgY2xpY2sgZXZlbnQgdG8gXCJjcmVhdGVcIiBidXR0b25cbiAgICBjcmVhdGVfYnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCBhc3luYyAoZXZlbnQpID0+IHtcbiAgICAgIC8vIGNyZWF0ZSBlbWJlZGRpbmdzLmpzb24gZmlsZVxuICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc21hcnRfdmVjX2xpdGUuaW5pdF9lbWJlZGRpbmdzX2ZpbGUoKTtcbiAgICAgIC8vIHJlbG9hZCB2aWV3XG4gICAgICBhd2FpdCB0aGlzLnJlbmRlcl9jb25uZWN0aW9ucygpO1xuICAgIH0pO1xuXG4gICAgLy8gYWRkIGNsaWNrIGV2ZW50IHRvIFwicmV0cnlcIiBidXR0b25cbiAgICByZXRyeV9idXR0b24uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIGFzeW5jIChldmVudCkgPT4ge1xuICAgICAgY29uc29sZS5sb2coXCJyZXRyeWluZyB0byBsb2FkIGVtYmVkZGluZ3MuanNvbiBmaWxlXCIpO1xuICAgICAgLy8gcmVsb2FkIGVtYmVkZGluZ3MuanNvbiBmaWxlXG4gICAgICBhd2FpdCB0aGlzLnBsdWdpbi5pbml0X3ZlY3MoKTtcbiAgICAgIC8vIHJlbG9hZCB2aWV3XG4gICAgICBhd2FpdCB0aGlzLnJlbmRlcl9jb25uZWN0aW9ucygpO1xuICAgIH0pO1xuICB9XG5cbiAgYXN5bmMgb25PcGVuKCkge1xuICAgIGNvbnN0IGNvbnRhaW5lciA9IHRoaXMuY29udGFpbmVyRWwuY2hpbGRyZW5bMV07XG4gICAgY29udGFpbmVyLmVtcHR5KCk7XG4gICAgLy8gcGxhY2Vob2xkZXIgdGV4dFxuICAgIGNvbnRhaW5lci5jcmVhdGVFbChcInBcIiwgeyBjbHM6IFwic2NQbGFjZWhvbGRlclwiLCB0ZXh0OiBcIk9wZW4gYSBub3RlIHRvIGZpbmQgY29ubmVjdGlvbnMuXCIgfSk7IFxuXG4gICAgLy8gcnVucyB3aGVuIGZpbGUgaXMgb3BlbmVkXG4gICAgdGhpcy5wbHVnaW4ucmVnaXN0ZXJFdmVudCh0aGlzLmFwcC53b3Jrc3BhY2Uub24oJ2ZpbGUtb3BlbicsIChmaWxlKSA9PiB7XG4gICAgICAvLyBpZiBubyBmaWxlIGlzIG9wZW4sIHJldHVyblxuICAgICAgaWYoIWZpbGUpIHtcbiAgICAgICAgLy8gY29uc29sZS5sb2coXCJubyBmaWxlIG9wZW4sIHJldHVybmluZ1wiKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgLy8gcmV0dXJuIGlmIGZpbGUgdHlwZSBpcyBub3Qgc3VwcG9ydGVkXG4gICAgICBpZihTVVBQT1JURURfRklMRV9UWVBFUy5pbmRleE9mKGZpbGUuZXh0ZW5zaW9uKSA9PT0gLTEpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuc2V0X21lc3NhZ2UoW1xuICAgICAgICAgIFwiRmlsZTogXCIrZmlsZS5uYW1lXG4gICAgICAgICAgLFwiVW5zdXBwb3J0ZWQgZmlsZSB0eXBlIChTdXBwb3J0ZWQ6IFwiK1NVUFBPUlRFRF9GSUxFX1RZUEVTLmpvaW4oXCIsIFwiKStcIilcIlxuICAgICAgICBdKTtcbiAgICAgIH1cbiAgICAgIC8vIHJ1biByZW5kZXJfY29ubmVjdGlvbnMgYWZ0ZXIgMSBzZWNvbmQgdG8gYWxsb3cgZm9yIGZpbGUgdG8gbG9hZFxuICAgICAgaWYodGhpcy5sb2FkX3dhaXQpe1xuICAgICAgICBjbGVhclRpbWVvdXQodGhpcy5sb2FkX3dhaXQpO1xuICAgICAgfVxuICAgICAgdGhpcy5sb2FkX3dhaXQgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgdGhpcy5yZW5kZXJfY29ubmVjdGlvbnMoZmlsZSk7XG4gICAgICAgIHRoaXMubG9hZF93YWl0ID0gbnVsbDtcbiAgICAgIH0sIDEwMDApO1xuICAgICAgICBcbiAgICB9KSk7XG5cbiAgICB0aGlzLmFwcC53b3Jrc3BhY2UucmVnaXN0ZXJIb3ZlckxpbmtTb3VyY2UoU01BUlRfQ09OTkVDVElPTlNfVklFV19UWVBFLCB7XG4gICAgICAgIGRpc3BsYXk6ICdTbWFydCBDb25uZWN0aW9ucyBGaWxlcycsXG4gICAgICAgIGRlZmF1bHRNb2Q6IHRydWUsXG4gICAgfSk7XG4gICAgdGhpcy5hcHAud29ya3NwYWNlLnJlZ2lzdGVySG92ZXJMaW5rU291cmNlKFNNQVJUX0NPTk5FQ1RJT05TX0NIQVRfVklFV19UWVBFLCB7XG4gICAgICAgIGRpc3BsYXk6ICdTbWFydCBDaGF0IExpbmtzJyxcbiAgICAgICAgZGVmYXVsdE1vZDogdHJ1ZSxcbiAgICB9KTtcblxuICAgIHRoaXMuYXBwLndvcmtzcGFjZS5vbkxheW91dFJlYWR5KHRoaXMuaW5pdGlhbGl6ZS5iaW5kKHRoaXMpKTtcbiAgICBcbiAgfVxuICBcbiAgYXN5bmMgaW5pdGlhbGl6ZSgpIHtcbiAgICB0aGlzLnNldF9tZXNzYWdlKFwiTG9hZGluZyBlbWJlZGRpbmdzIGZpbGUuLi5cIik7XG4gICAgY29uc3QgdmVjc19pbnRpYXRlZCA9IGF3YWl0IHRoaXMucGx1Z2luLmluaXRfdmVjcygpO1xuICAgIGlmKHZlY3NfaW50aWF0ZWQpe1xuICAgICAgdGhpcy5zZXRfbWVzc2FnZShcIkVtYmVkZGluZ3MgZmlsZSBsb2FkZWQuXCIpO1xuICAgICAgYXdhaXQgdGhpcy5yZW5kZXJfY29ubmVjdGlvbnMoKTtcbiAgICB9ZWxzZXtcbiAgICAgIHRoaXMucmVuZGVyX2VtYmVkZGluZ3NfYnV0dG9ucygpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEVYUEVSSU1FTlRBTFxuICAgICAqIC0gd2luZG93LWJhc2VkIEFQSSBhY2Nlc3NcbiAgICAgKiAtIGNvZGUtYmxvY2sgcmVuZGVyaW5nXG4gICAgICovXG4gICAgdGhpcy5hcGkgPSBuZXcgU21hcnRDb25uZWN0aW9uc1ZpZXdBcGkodGhpcy5hcHAsIHRoaXMucGx1Z2luLCB0aGlzKTtcbiAgICAvLyByZWdpc3RlciBBUEkgdG8gZ2xvYmFsIHdpbmRvdyBvYmplY3RcbiAgICAod2luZG93W1wiU21hcnRDb25uZWN0aW9uc1ZpZXdBcGlcIl0gPSB0aGlzLmFwaSkgJiYgdGhpcy5yZWdpc3RlcigoKSA9PiBkZWxldGUgd2luZG93W1wiU21hcnRDb25uZWN0aW9uc1ZpZXdBcGlcIl0pO1xuXG4gIH1cblxuICBhc3luYyBvbkNsb3NlKCkge1xuICAgIGNvbnNvbGUubG9nKFwiY2xvc2luZyBzbWFydCBjb25uZWN0aW9ucyB2aWV3XCIpO1xuICAgIHRoaXMuYXBwLndvcmtzcGFjZS51bnJlZ2lzdGVySG92ZXJMaW5rU291cmNlKFNNQVJUX0NPTk5FQ1RJT05TX1ZJRVdfVFlQRSk7XG4gICAgdGhpcy5wbHVnaW4udmlldyA9IG51bGw7XG4gIH1cblxuICBhc3luYyByZW5kZXJfY29ubmVjdGlvbnMoY29udGV4dD1udWxsKSB7XG4gICAgY29uc29sZS5sb2coXCJyZW5kZXJpbmcgY29ubmVjdGlvbnNcIik7XG4gICAgLy8gaWYgQVBJIGtleSBpcyBub3Qgc2V0IHRoZW4gdXBkYXRlIHZpZXcgbWVzc2FnZVxuICAgIGlmKCF0aGlzLnBsdWdpbi5zZXR0aW5ncy5hcGlfa2V5KSB7XG4gICAgICB0aGlzLnNldF9tZXNzYWdlKFwiQW4gT3BlbkFJIEFQSSBrZXkgaXMgcmVxdWlyZWQgdG8gbWFrZSBTbWFydCBDb25uZWN0aW9uc1wiKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgaWYoIXRoaXMucGx1Z2luLmVtYmVkZGluZ3NfbG9hZGVkKXtcbiAgICAgIGF3YWl0IHRoaXMucGx1Z2luLmluaXRfdmVjcygpO1xuICAgIH1cbiAgICAvLyBpZiBlbWJlZGRpbmcgc3RpbGwgbm90IGxvYWRlZCwgcmV0dXJuXG4gICAgaWYoIXRoaXMucGx1Z2luLmVtYmVkZGluZ3NfbG9hZGVkKSB7XG4gICAgICBjb25zb2xlLmxvZyhcImVtYmVkZGluZ3MgZmlsZXMgc3RpbGwgbm90IGxvYWRlZCBvciB5ZXQgdG8gYmUgY3JlYXRlZFwiKTtcbiAgICAgIHRoaXMucmVuZGVyX2VtYmVkZGluZ3NfYnV0dG9ucygpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB0aGlzLnNldF9tZXNzYWdlKFwiTWFraW5nIFNtYXJ0IENvbm5lY3Rpb25zLi4uXCIpO1xuICAgIC8qKlxuICAgICAqIEJlZ2luIGhpZ2hsaWdodGVkLXRleHQtbGV2ZWwgc2VhcmNoXG4gICAgICovXG4gICAgaWYodHlwZW9mIGNvbnRleHQgPT09IFwic3RyaW5nXCIpIHtcbiAgICAgIGNvbnN0IGhpZ2hsaWdodGVkX3RleHQgPSBjb250ZXh0O1xuICAgICAgLy8gZ2V0IGVtYmVkZGluZyBmb3IgaGlnaGxpZ2h0ZWQgdGV4dFxuICAgICAgYXdhaXQgdGhpcy5zZWFyY2goaGlnaGxpZ2h0ZWRfdGV4dCk7XG4gICAgICByZXR1cm47IC8vIGVuZHMgaGVyZSBpZiBjb250ZXh0IGlzIGEgc3RyaW5nXG4gICAgfVxuXG4gICAgLyoqIFxuICAgICAqIEJlZ2luIGZpbGUtbGV2ZWwgc2VhcmNoXG4gICAgICovICAgIFxuICAgIHRoaXMubmVhcmVzdCA9IG51bGw7XG4gICAgdGhpcy5pbnRlcnZhbF9jb3VudCA9IDA7XG4gICAgdGhpcy5yZW5kZXJpbmcgPSBmYWxzZTtcbiAgICB0aGlzLmZpbGUgPSBjb250ZXh0O1xuICAgIC8vIGlmIHRoaXMuaW50ZXJ2YWwgaXMgc2V0IHRoZW4gY2xlYXIgaXRcbiAgICBpZih0aGlzLmludGVydmFsKSB7XG4gICAgICBjbGVhckludGVydmFsKHRoaXMuaW50ZXJ2YWwpO1xuICAgICAgdGhpcy5pbnRlcnZhbCA9IG51bGw7XG4gICAgfVxuICAgIC8vIHNldCBpbnRlcnZhbCB0byBjaGVjayBpZiBuZWFyZXN0IGlzIHNldFxuICAgIHRoaXMuaW50ZXJ2YWwgPSBzZXRJbnRlcnZhbCgoKSA9PiB7XG4gICAgICBpZighdGhpcy5yZW5kZXJpbmcpe1xuICAgICAgICBpZih0aGlzLmZpbGUgaW5zdGFuY2VvZiBPYnNpZGlhbi5URmlsZSkge1xuICAgICAgICAgIHRoaXMucmVuZGVyaW5nID0gdHJ1ZTtcbiAgICAgICAgICB0aGlzLnJlbmRlcl9ub3RlX2Nvbm5lY3Rpb25zKHRoaXMuZmlsZSk7XG4gICAgICAgIH1lbHNle1xuICAgICAgICAgIC8vIGdldCBjdXJyZW50IG5vdGVcbiAgICAgICAgICB0aGlzLmZpbGUgPSB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0QWN0aXZlRmlsZSgpO1xuICAgICAgICAgIC8vIGlmIHN0aWxsIG5vIGN1cnJlbnQgbm90ZSB0aGVuIHJldHVyblxuICAgICAgICAgIGlmKCF0aGlzLmZpbGUgJiYgdGhpcy5jb3VudCA+IDEpIHtcbiAgICAgICAgICAgIGNsZWFySW50ZXJ2YWwodGhpcy5pbnRlcnZhbCk7XG4gICAgICAgICAgICB0aGlzLnNldF9tZXNzYWdlKFwiTm8gYWN0aXZlIGZpbGVcIik7XG4gICAgICAgICAgICByZXR1cm47IFxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfWVsc2V7XG4gICAgICAgIGlmKHRoaXMubmVhcmVzdCkge1xuICAgICAgICAgIGNsZWFySW50ZXJ2YWwodGhpcy5pbnRlcnZhbCk7XG4gICAgICAgICAgLy8gaWYgbmVhcmVzdCBpcyBhIHN0cmluZyB0aGVuIHVwZGF0ZSB2aWV3IG1lc3NhZ2VcbiAgICAgICAgICBpZiAodHlwZW9mIHRoaXMubmVhcmVzdCA9PT0gXCJzdHJpbmdcIikge1xuICAgICAgICAgICAgdGhpcy5zZXRfbWVzc2FnZSh0aGlzLm5lYXJlc3QpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBzZXQgbmVhcmVzdCBjb25uZWN0aW9uc1xuICAgICAgICAgICAgdGhpcy5zZXRfbmVhcmVzdCh0aGlzLm5lYXJlc3QsIFwiRmlsZTogXCIgKyB0aGlzLmZpbGUubmFtZSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIC8vIGlmIHJlbmRlcl9sb2cuZmFpbGVkX2VtYmVkZGluZ3MgdGhlbiB1cGRhdGUgZmFpbGVkX2VtYmVkZGluZ3MudHh0XG4gICAgICAgICAgaWYgKHRoaXMucGx1Z2luLnJlbmRlcl9sb2cuZmFpbGVkX2VtYmVkZGluZ3MubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgdGhpcy5wbHVnaW4uc2F2ZV9mYWlsZWRfZW1iZWRkaW5ncygpO1xuICAgICAgICAgIH1cbiAgICAgICAgICAvLyBnZXQgb2JqZWN0IGtleXMgb2YgcmVuZGVyX2xvZ1xuICAgICAgICAgIHRoaXMucGx1Z2luLm91dHB1dF9yZW5kZXJfbG9nKCk7XG4gICAgICAgICAgcmV0dXJuOyBcbiAgICAgICAgfWVsc2V7XG4gICAgICAgICAgdGhpcy5pbnRlcnZhbF9jb3VudCsrO1xuICAgICAgICAgIHRoaXMuc2V0X21lc3NhZ2UoXCJNYWtpbmcgU21hcnQgQ29ubmVjdGlvbnMuLi5cIit0aGlzLmludGVydmFsX2NvdW50KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0sIDEwKTtcbiAgfVxuXG4gIGFzeW5jIHJlbmRlcl9ub3RlX2Nvbm5lY3Rpb25zKGZpbGUpIHtcbiAgICB0aGlzLm5lYXJlc3QgPSBhd2FpdCB0aGlzLnBsdWdpbi5maW5kX25vdGVfY29ubmVjdGlvbnMoZmlsZSk7XG4gIH1cblxuICBjbGVhcl9hdXRvX3NlYXJjaGVyKCkge1xuICAgIGlmICh0aGlzLnNlYXJjaF90aW1lb3V0KSB7XG4gICAgICBjbGVhclRpbWVvdXQodGhpcy5zZWFyY2hfdGltZW91dCk7XG4gICAgICB0aGlzLnNlYXJjaF90aW1lb3V0ID0gbnVsbDtcbiAgICB9XG4gIH1cblxuICBhc3luYyBzZWFyY2goc2VhcmNoX3RleHQsIHJlc3VsdHNfb25seT1mYWxzZSkge1xuICAgIGNvbnN0IG5lYXJlc3QgPSBhd2FpdCB0aGlzLnBsdWdpbi5hcGkuc2VhcmNoKHNlYXJjaF90ZXh0KTtcbiAgICAvLyByZW5kZXIgcmVzdWx0cyBpbiB2aWV3IHdpdGggZmlyc3QgMTAwIGNoYXJhY3RlcnMgb2Ygc2VhcmNoIHRleHRcbiAgICBjb25zdCBuZWFyZXN0X2NvbnRleHQgPSBgU2VsZWN0aW9uOiBcIiR7c2VhcmNoX3RleHQubGVuZ3RoID4gMTAwID8gc2VhcmNoX3RleHQuc3Vic3RyaW5nKDAsIDEwMCkgKyBcIi4uLlwiIDogc2VhcmNoX3RleHR9XCJgO1xuICAgIHRoaXMuc2V0X25lYXJlc3QobmVhcmVzdCwgbmVhcmVzdF9jb250ZXh0LCByZXN1bHRzX29ubHkpO1xuICB9XG5cbn1cbmNsYXNzIFNtYXJ0Q29ubmVjdGlvbnNWaWV3QXBpIHtcbiAgY29uc3RydWN0b3IoYXBwLCBwbHVnaW4sIHZpZXcpIHtcbiAgICB0aGlzLmFwcCA9IGFwcDtcbiAgICB0aGlzLnBsdWdpbiA9IHBsdWdpbjtcbiAgICB0aGlzLnZpZXcgPSB2aWV3O1xuICB9XG4gIGFzeW5jIHNlYXJjaCAoc2VhcmNoX3RleHQpIHtcbiAgICByZXR1cm4gYXdhaXQgdGhpcy5wbHVnaW4uYXBpLnNlYXJjaChzZWFyY2hfdGV4dCk7XG4gIH1cbiAgLy8gdHJpZ2dlciByZWxvYWQgb2YgZW1iZWRkaW5ncyBmaWxlXG4gIGFzeW5jIHJlbG9hZF9lbWJlZGRpbmdzX2ZpbGUoKSB7XG4gICAgYXdhaXQgdGhpcy5wbHVnaW4uaW5pdF92ZWNzKCk7XG4gICAgYXdhaXQgdGhpcy52aWV3LnJlbmRlcl9jb25uZWN0aW9ucygpO1xuICB9XG59XG5jbGFzcyBTY1NlYXJjaEFwaSB7XG4gIGNvbnN0cnVjdG9yKGFwcCwgcGx1Z2luKSB7XG4gICAgdGhpcy5hcHAgPSBhcHA7XG4gICAgdGhpcy5wbHVnaW4gPSBwbHVnaW47XG4gIH1cbiAgYXN5bmMgc2VhcmNoIChzZWFyY2hfdGV4dCwgZmlsdGVyPXt9KSB7XG4gICAgZmlsdGVyID0ge1xuICAgICAgc2tpcF9zZWN0aW9uczogdGhpcy5wbHVnaW4uc2V0dGluZ3Muc2tpcF9zZWN0aW9ucyxcbiAgICAgIC4uLmZpbHRlclxuICAgIH1cbiAgICBsZXQgbmVhcmVzdCA9IFtdO1xuICAgIGNvbnN0IHJlc3AgPSBhd2FpdCB0aGlzLnBsdWdpbi5yZXF1ZXN0X2VtYmVkZGluZ19mcm9tX2lucHV0KHNlYXJjaF90ZXh0KTtcbiAgICBpZiAocmVzcCAmJiByZXNwLmRhdGEgJiYgcmVzcC5kYXRhWzBdICYmIHJlc3AuZGF0YVswXS5lbWJlZGRpbmcpIHtcbiAgICAgIG5lYXJlc3QgPSB0aGlzLnBsdWdpbi5zbWFydF92ZWNfbGl0ZS5uZWFyZXN0KHJlc3AuZGF0YVswXS5lbWJlZGRpbmcsIGZpbHRlcik7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIHJlc3AgaXMgbnVsbCwgdW5kZWZpbmVkLCBvciBtaXNzaW5nIGRhdGFcbiAgICAgIG5ldyBPYnNpZGlhbi5Ob3RpY2UoXCJTbWFydCBDb25uZWN0aW9uczogRXJyb3IgZ2V0dGluZyBlbWJlZGRpbmdcIik7XG4gICAgfVxuICAgIHJldHVybiBuZWFyZXN0O1xuICB9XG59XG5cbmNsYXNzIFNtYXJ0Q29ubmVjdGlvbnNTZXR0aW5nc1RhYiBleHRlbmRzIE9ic2lkaWFuLlBsdWdpblNldHRpbmdUYWIge1xuICBjb25zdHJ1Y3RvcihhcHAsIHBsdWdpbikge1xuICAgIHN1cGVyKGFwcCwgcGx1Z2luKTtcbiAgICB0aGlzLnBsdWdpbiA9IHBsdWdpbjtcbiAgfVxuICBkaXNwbGF5KCkge1xuICAgIGNvbnN0IHtcbiAgICAgIGNvbnRhaW5lckVsXG4gICAgfSA9IHRoaXM7XG4gICAgY29udGFpbmVyRWwuZW1wdHkoKTtcbiAgICBjb250YWluZXJFbC5jcmVhdGVFbChcImgyXCIsIHtcbiAgICAgIHRleHQ6IFwiU3VwcG9ydGVyIFNldHRpbmdzXCJcbiAgICB9KTtcbiAgICAvLyBsaXN0IHN1cHBvcnRlciBiZW5lZml0c1xuICAgIGNvbnRhaW5lckVsLmNyZWF0ZUVsKFwicFwiLCB7XG4gICAgICB0ZXh0OiBcIkFzIGEgU21hcnQgQ29ubmVjdGlvbnMgXFxcIlN1cHBvcnRlclxcXCIsIGZhc3QtdHJhY2sgeW91ciBQS00gam91cm5leSB3aXRoIHByaW9yaXR5IHBlcmtzIGFuZCBwaW9uZWVyaW5nIGlubm92YXRpb25zLlwiXG4gICAgfSk7XG4gICAgLy8gdGhyZWUgbGlzdCBpdGVtc1xuICAgIGNvbnN0IHN1cHBvcnRlcl9iZW5lZml0c19saXN0ID0gY29udGFpbmVyRWwuY3JlYXRlRWwoXCJ1bFwiKTtcbiAgICBzdXBwb3J0ZXJfYmVuZWZpdHNfbGlzdC5jcmVhdGVFbChcImxpXCIsIHtcbiAgICAgIHRleHQ6IFwiRW5qb3kgc3dpZnQsIHRvcC1wcmlvcml0eSBzdXBwb3J0LlwiXG4gICAgfSk7XG4gICAgc3VwcG9ydGVyX2JlbmVmaXRzX2xpc3QuY3JlYXRlRWwoXCJsaVwiLCB7XG4gICAgICB0ZXh0OiBcIkdhaW4gZWFybHkgYWNjZXNzIHRvIGV4cGVyaW1lbnRhbCBmZWF0dXJlcyBsaWtlIHRoZSBDaGF0R1BUIHBsdWdpbi5cIlxuICAgIH0pO1xuICAgIHN1cHBvcnRlcl9iZW5lZml0c19saXN0LmNyZWF0ZUVsKFwibGlcIiwge1xuICAgICAgdGV4dDogXCJTdGF5IGluZm9ybWVkIGFuZCBlbmdhZ2VkIHdpdGggZXhjbHVzaXZlIHN1cHBvcnRlci1vbmx5IGNvbW11bmljYXRpb25zLlwiXG4gICAgfSk7XG4gICAgLy8gYWRkIGEgdGV4dCBpbnB1dCB0byBlbnRlciBzdXBwb3J0ZXIgbGljZW5zZSBrZXlcbiAgICBuZXcgT2JzaWRpYW4uU2V0dGluZyhjb250YWluZXJFbCkuc2V0TmFtZShcIlN1cHBvcnRlciBMaWNlbnNlIEtleVwiKS5zZXREZXNjKFwiTm90ZTogdGhpcyBpcyBub3QgcmVxdWlyZWQgdG8gdXNlIFNtYXJ0IENvbm5lY3Rpb25zLlwiKS5hZGRUZXh0KCh0ZXh0KSA9PiB0ZXh0LnNldFBsYWNlaG9sZGVyKFwiRW50ZXIgeW91ciBsaWNlbnNlX2tleVwiKS5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5saWNlbnNlX2tleSkub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG4gICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5saWNlbnNlX2tleSA9IHZhbHVlLnRyaW0oKTtcbiAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncyh0cnVlKTtcbiAgICB9KSk7XG4gICAgLy8gYWRkIGJ1dHRvbiB0byB0cmlnZ2VyIHN5bmMgbm90ZXMgdG8gdXNlIHdpdGggQ2hhdEdQVFxuICAgIG5ldyBPYnNpZGlhbi5TZXR0aW5nKGNvbnRhaW5lckVsKS5zZXROYW1lKFwiU3luYyBOb3Rlc1wiKS5zZXREZXNjKFwiTWFrZSBub3RlcyBhdmFpbGFibGUgdmlhIHRoZSBTbWFydCBDb25uZWN0aW9ucyBDaGF0R1BUIFBsdWdpbi4gUmVzcGVjdHMgZXhjbHVzaW9uIHNldHRpbmdzIGNvbmZpZ3VyZWQgYmVsb3cuXCIpLmFkZEJ1dHRvbigoYnV0dG9uKSA9PiBidXR0b24uc2V0QnV0dG9uVGV4dChcIlN5bmMgTm90ZXNcIikub25DbGljayhhc3luYyAoKSA9PiB7XG4gICAgICAvLyBzeW5jIG5vdGVzXG4gICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zeW5jX25vdGVzKCk7XG4gICAgfSkpO1xuICAgIC8vIGFkZCBidXR0b24gdG8gYmVjb21lIGEgc3VwcG9ydGVyXG4gICAgbmV3IE9ic2lkaWFuLlNldHRpbmcoY29udGFpbmVyRWwpLnNldE5hbWUoXCJCZWNvbWUgYSBTdXBwb3J0ZXJcIikuc2V0RGVzYyhcIkJlY29tZSBhIFN1cHBvcnRlclwiKS5hZGRCdXR0b24oKGJ1dHRvbikgPT4gYnV0dG9uLnNldEJ1dHRvblRleHQoXCJCZWNvbWUgYSBTdXBwb3J0ZXJcIikub25DbGljayhhc3luYyAoKSA9PiB7XG4gICAgICBjb25zdCBwYXltZW50X3BhZ2VzID0gW1xuICAgICAgICBcImh0dHBzOi8vYnV5LnN0cmlwZS5jb20vOUFRNWtPNVFuYkFXZ0dBYklZXCIsXG4gICAgICAgIFwiaHR0cHM6Ly9idXkuc3RyaXBlLmNvbS85QVE3c1dlbVQ0OHUxTEdjTjRcIlxuICAgICAgXTtcbiAgICAgIGlmKCF0aGlzLnBsdWdpbi5wYXltZW50X3BhZ2VfaW5kZXgpe1xuICAgICAgICB0aGlzLnBsdWdpbi5wYXltZW50X3BhZ2VfaW5kZXggPSBNYXRoLnJvdW5kKE1hdGgucmFuZG9tKCkpO1xuICAgICAgfVxuICAgICAgLy8gb3BlbiBzdXBwb3J0ZXIgcGFnZSBpbiBicm93c2VyXG4gICAgICB3aW5kb3cub3BlbihwYXltZW50X3BhZ2VzW3RoaXMucGx1Z2luLnBheW1lbnRfcGFnZV9pbmRleF0pO1xuICAgIH0pKTtcblxuICAgIFxuICAgIGNvbnRhaW5lckVsLmNyZWF0ZUVsKFwiaDJcIiwge1xuICAgICAgdGV4dDogXCJPcGVuQUkgU2V0dGluZ3NcIlxuICAgIH0pO1xuICAgIC8vIGFkZCBhIHRleHQgaW5wdXQgdG8gZW50ZXIgdGhlIEFQSSBrZXlcbiAgICBuZXcgT2JzaWRpYW4uU2V0dGluZyhjb250YWluZXJFbCkuc2V0TmFtZShcIk9wZW5BSSBBUEkgS2V5XCIpLnNldERlc2MoXCJSZXF1aXJlZDogYW4gT3BlbkFJIEFQSSBrZXkgaXMgY3VycmVudGx5IHJlcXVpcmVkIHRvIHVzZSBTbWFydCBDb25uZWN0aW9ucy5cIikuYWRkVGV4dCgodGV4dCkgPT4gdGV4dC5zZXRQbGFjZWhvbGRlcihcIkVudGVyIHlvdXIgYXBpX2tleVwiKS5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5hcGlfa2V5KS5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcbiAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLmFwaV9rZXkgPSB2YWx1ZS50cmltKCk7XG4gICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3ModHJ1ZSk7XG4gICAgfSkpO1xuICAgIC8vIGFkZCBhIGJ1dHRvbiB0byB0ZXN0IHRoZSBBUEkga2V5IGlzIHdvcmtpbmdcbiAgICBuZXcgT2JzaWRpYW4uU2V0dGluZyhjb250YWluZXJFbCkuc2V0TmFtZShcIlRlc3QgQVBJIEtleVwiKS5zZXREZXNjKFwiVGVzdCBBUEkgS2V5XCIpLmFkZEJ1dHRvbigoYnV0dG9uKSA9PiBidXR0b24uc2V0QnV0dG9uVGV4dChcIlRlc3QgQVBJIEtleVwiKS5vbkNsaWNrKGFzeW5jICgpID0+IHtcbiAgICAgIC8vIHRlc3QgQVBJIGtleVxuICAgICAgY29uc3QgcmVzcCA9IGF3YWl0IHRoaXMucGx1Z2luLnRlc3RfYXBpX2tleSgpO1xuICAgICAgaWYocmVzcCkge1xuICAgICAgICBuZXcgT2JzaWRpYW4uTm90aWNlKFwiU21hcnQgQ29ubmVjdGlvbnM6IEFQSSBrZXkgaXMgdmFsaWRcIik7XG4gICAgICB9ZWxzZXtcbiAgICAgICAgbmV3IE9ic2lkaWFuLk5vdGljZShcIlNtYXJ0IENvbm5lY3Rpb25zOiBBUEkga2V5IGlzIG5vdCB3b3JraW5nIGFzIGV4cGVjdGVkIVwiKTtcbiAgICAgIH1cbiAgICB9KSk7XG4gICAgLy8gYWRkIGRyb3Bkb3duIHRvIHNlbGVjdCB0aGUgbW9kZWxcbiAgICBuZXcgT2JzaWRpYW4uU2V0dGluZyhjb250YWluZXJFbCkuc2V0TmFtZShcIlNtYXJ0IENoYXQgTW9kZWxcIikuc2V0RGVzYyhcIlNlbGVjdCBhIG1vZGVsIHRvIHVzZSB3aXRoIFNtYXJ0IENoYXQuXCIpLmFkZERyb3Bkb3duKChkcm9wZG93bikgPT4ge1xuICAgICAgZHJvcGRvd24uYWRkT3B0aW9uKFwiZ3B0LTMuNS10dXJiby0xNmtcIiwgXCJncHQtMy41LXR1cmJvLTE2a1wiKTtcbiAgICAgIGRyb3Bkb3duLmFkZE9wdGlvbihcImdwdC00XCIsIFwiZ3B0LTQgKGxpbWl0ZWQgYWNjZXNzLCA4aylcIik7XG4gICAgICBkcm9wZG93bi5hZGRPcHRpb24oXCJncHQtMy41LXR1cmJvXCIsIFwiZ3B0LTMuNS10dXJibyAoNGspXCIpO1xuICAgICAgZHJvcGRvd24uYWRkT3B0aW9uKFwiZ3B0LTQtMTEwNi1wcmV2aWV3XCIsIFwiZ3B0LTQtdHVyYm8gKDEyOGspXCIpO1xuICAgICAgZHJvcGRvd24ub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG4gICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLnNtYXJ0X2NoYXRfbW9kZWwgPSB2YWx1ZTtcbiAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG4gICAgICB9KTtcbiAgICAgIGRyb3Bkb3duLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLnNtYXJ0X2NoYXRfbW9kZWwpO1xuICAgIH0pO1xuICAgIC8vIGxhbmd1YWdlXG4gICAgbmV3IE9ic2lkaWFuLlNldHRpbmcoY29udGFpbmVyRWwpLnNldE5hbWUoXCJEZWZhdWx0IExhbmd1YWdlXCIpLnNldERlc2MoXCJEZWZhdWx0IGxhbmd1YWdlIHRvIHVzZSBmb3IgU21hcnQgQ2hhdC4gQ2hhbmdlcyB3aGljaCBzZWxmLXJlZmVyZW50aWFsIHByb25vdW5zIHdpbGwgdHJpZ2dlciBsb29rdXAgb2YgeW91ciBub3Rlcy5cIikuYWRkRHJvcGRvd24oKGRyb3Bkb3duKSA9PiB7XG4gICAgICAvLyBnZXQgT2JqZWN0IGtleXMgZnJvbSBwcm9ub3VzXG4gICAgICBjb25zdCBsYW5ndWFnZXMgPSBPYmplY3Qua2V5cyhTTUFSVF9UUkFOU0xBVElPTik7XG4gICAgICBmb3IobGV0IGkgPSAwOyBpIDwgbGFuZ3VhZ2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGRyb3Bkb3duLmFkZE9wdGlvbihsYW5ndWFnZXNbaV0sIGxhbmd1YWdlc1tpXSk7XG4gICAgICB9XG4gICAgICBkcm9wZG93bi5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcbiAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MubGFuZ3VhZ2UgPSB2YWx1ZTtcbiAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG4gICAgICAgIHNlbGZfcmVmX3Byb25vdW5zX2xpc3Quc2V0VGV4dCh0aGlzLmdldF9zZWxmX3JlZl9saXN0KCkpO1xuICAgICAgICAvLyBpZiBjaGF0IHZpZXcgaXMgb3BlbiB0aGVuIHJ1biBuZXdfY2hhdCgpXG4gICAgICAgIGNvbnN0IGNoYXRfdmlldyA9IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRMZWF2ZXNPZlR5cGUoU01BUlRfQ09OTkVDVElPTlNfQ0hBVF9WSUVXX1RZUEUpLmxlbmd0aCA+IDAgPyB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0TGVhdmVzT2ZUeXBlKFNNQVJUX0NPTk5FQ1RJT05TX0NIQVRfVklFV19UWVBFKVswXS52aWV3IDogbnVsbDtcbiAgICAgICAgaWYoY2hhdF92aWV3KSB7XG4gICAgICAgICAgY2hhdF92aWV3Lm5ld19jaGF0KCk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgICAgZHJvcGRvd24uc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MubGFuZ3VhZ2UpO1xuICAgIH0pO1xuICAgIC8vIGxpc3QgY3VycmVudCBzZWxmLXJlZmVyZW50aWFsIHByb25vdW5zXG4gICAgY29uc3Qgc2VsZl9yZWZfcHJvbm91bnNfbGlzdCA9IGNvbnRhaW5lckVsLmNyZWF0ZUVsKFwic3BhblwiLCB7XG4gICAgICB0ZXh0OiB0aGlzLmdldF9zZWxmX3JlZl9saXN0KClcbiAgICB9KTtcbiAgICBjb250YWluZXJFbC5jcmVhdGVFbChcImgyXCIsIHtcbiAgICAgIHRleHQ6IFwiRXhjbHVzaW9uc1wiXG4gICAgfSk7XG4gICAgLy8gbGlzdCBmaWxlIGV4Y2x1c2lvbnNcbiAgICBuZXcgT2JzaWRpYW4uU2V0dGluZyhjb250YWluZXJFbCkuc2V0TmFtZShcImZpbGVfZXhjbHVzaW9uc1wiKS5zZXREZXNjKFwiJ0V4Y2x1ZGVkIGZpbGUnIG1hdGNoZXJzIHNlcGFyYXRlZCBieSBhIGNvbW1hLlwiKS5hZGRUZXh0KCh0ZXh0KSA9PiB0ZXh0LnNldFBsYWNlaG9sZGVyKFwiZHJhd2luZ3MscHJvbXB0cy9sb2dzXCIpLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmZpbGVfZXhjbHVzaW9ucykub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG4gICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5maWxlX2V4Y2x1c2lvbnMgPSB2YWx1ZTtcbiAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuICAgIH0pKTtcbiAgICAvLyBsaXN0IGZvbGRlciBleGNsdXNpb25zXG4gICAgbmV3IE9ic2lkaWFuLlNldHRpbmcoY29udGFpbmVyRWwpLnNldE5hbWUoXCJmb2xkZXJfZXhjbHVzaW9uc1wiKS5zZXREZXNjKFwiJ0V4Y2x1ZGVkIGZvbGRlcicgbWF0Y2hlcnMgc2VwYXJhdGVkIGJ5IGEgY29tbWEuXCIpLmFkZFRleHQoKHRleHQpID0+IHRleHQuc2V0UGxhY2Vob2xkZXIoXCJkcmF3aW5ncyxwcm9tcHRzL2xvZ3NcIikuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MuZm9sZGVyX2V4Y2x1c2lvbnMpLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MuZm9sZGVyX2V4Y2x1c2lvbnMgPSB2YWx1ZTtcbiAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuICAgIH0pKTtcbiAgICAvLyBsaXN0IHBhdGggb25seSBtYXRjaGVyc1xuICAgIG5ldyBPYnNpZGlhbi5TZXR0aW5nKGNvbnRhaW5lckVsKS5zZXROYW1lKFwicGF0aF9vbmx5XCIpLnNldERlc2MoXCInUGF0aCBvbmx5JyBtYXRjaGVycyBzZXBhcmF0ZWQgYnkgYSBjb21tYS5cIikuYWRkVGV4dCgodGV4dCkgPT4gdGV4dC5zZXRQbGFjZWhvbGRlcihcImRyYXdpbmdzLHByb21wdHMvbG9nc1wiKS5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5wYXRoX29ubHkpLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MucGF0aF9vbmx5ID0gdmFsdWU7XG4gICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcbiAgICB9KSk7XG4gICAgLy8gbGlzdCBoZWFkZXIgZXhjbHVzaW9uc1xuICAgIG5ldyBPYnNpZGlhbi5TZXR0aW5nKGNvbnRhaW5lckVsKS5zZXROYW1lKFwiaGVhZGVyX2V4Y2x1c2lvbnNcIikuc2V0RGVzYyhcIidFeGNsdWRlZCBoZWFkZXInIG1hdGNoZXJzIHNlcGFyYXRlZCBieSBhIGNvbW1hLiBXb3JrcyBmb3IgJ2Jsb2Nrcycgb25seS5cIikuYWRkVGV4dCgodGV4dCkgPT4gdGV4dC5zZXRQbGFjZWhvbGRlcihcImRyYXdpbmdzLHByb21wdHMvbG9nc1wiKS5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5oZWFkZXJfZXhjbHVzaW9ucykub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG4gICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5oZWFkZXJfZXhjbHVzaW9ucyA9IHZhbHVlO1xuICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG4gICAgfSkpO1xuICAgIGNvbnRhaW5lckVsLmNyZWF0ZUVsKFwiaDJcIiwge1xuICAgICAgdGV4dDogXCJEaXNwbGF5XCJcbiAgICB9KTtcbiAgICAvLyB0b2dnbGUgc2hvd2luZyBmdWxsIHBhdGggaW4gdmlld1xuICAgIG5ldyBPYnNpZGlhbi5TZXR0aW5nKGNvbnRhaW5lckVsKS5zZXROYW1lKFwic2hvd19mdWxsX3BhdGhcIikuc2V0RGVzYyhcIlNob3cgZnVsbCBwYXRoIGluIHZpZXcuXCIpLmFkZFRvZ2dsZSgodG9nZ2xlKSA9PiB0b2dnbGUuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3Muc2hvd19mdWxsX3BhdGgpLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3Muc2hvd19mdWxsX3BhdGggPSB2YWx1ZTtcbiAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncyh0cnVlKTtcbiAgICB9KSk7XG4gICAgLy8gdG9nZ2xlIGV4cGFuZGVkIHZpZXcgYnkgZGVmYXVsdFxuICAgIG5ldyBPYnNpZGlhbi5TZXR0aW5nKGNvbnRhaW5lckVsKS5zZXROYW1lKFwiZXhwYW5kZWRfdmlld1wiKS5zZXREZXNjKFwiRXhwYW5kZWQgdmlldyBieSBkZWZhdWx0LlwiKS5hZGRUb2dnbGUoKHRvZ2dsZSkgPT4gdG9nZ2xlLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmV4cGFuZGVkX3ZpZXcpLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MuZXhwYW5kZWRfdmlldyA9IHZhbHVlO1xuICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKHRydWUpO1xuICAgIH0pKTtcbiAgICAvLyB0b2dnbGUgZ3JvdXAgbmVhcmVzdCBieSBmaWxlXG4gICAgbmV3IE9ic2lkaWFuLlNldHRpbmcoY29udGFpbmVyRWwpLnNldE5hbWUoXCJncm91cF9uZWFyZXN0X2J5X2ZpbGVcIikuc2V0RGVzYyhcIkdyb3VwIG5lYXJlc3QgYnkgZmlsZS5cIikuYWRkVG9nZ2xlKCh0b2dnbGUpID0+IHRvZ2dsZS5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5ncm91cF9uZWFyZXN0X2J5X2ZpbGUpLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MuZ3JvdXBfbmVhcmVzdF9ieV9maWxlID0gdmFsdWU7XG4gICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3ModHJ1ZSk7XG4gICAgfSkpO1xuICAgIC8vIHRvZ2dsZSB2aWV3X29wZW4gb24gT2JzaWRpYW4gc3RhcnR1cFxuICAgIG5ldyBPYnNpZGlhbi5TZXR0aW5nKGNvbnRhaW5lckVsKS5zZXROYW1lKFwidmlld19vcGVuXCIpLnNldERlc2MoXCJPcGVuIHZpZXcgb24gT2JzaWRpYW4gc3RhcnR1cC5cIikuYWRkVG9nZ2xlKCh0b2dnbGUpID0+IHRvZ2dsZS5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy52aWV3X29wZW4pLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3Mudmlld19vcGVuID0gdmFsdWU7XG4gICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3ModHJ1ZSk7XG4gICAgfSkpO1xuICAgIC8vIHRvZ2dsZSBjaGF0X29wZW4gb24gT2JzaWRpYW4gc3RhcnR1cFxuICAgIG5ldyBPYnNpZGlhbi5TZXR0aW5nKGNvbnRhaW5lckVsKS5zZXROYW1lKFwiY2hhdF9vcGVuXCIpLnNldERlc2MoXCJPcGVuIHZpZXcgb24gT2JzaWRpYW4gc3RhcnR1cC5cIikuYWRkVG9nZ2xlKCh0b2dnbGUpID0+IHRvZ2dsZS5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5jaGF0X29wZW4pLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MuY2hhdF9vcGVuID0gdmFsdWU7XG4gICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3ModHJ1ZSk7XG4gICAgfSkpO1xuICAgIGNvbnRhaW5lckVsLmNyZWF0ZUVsKFwiaDJcIiwge1xuICAgICAgdGV4dDogXCJBZHZhbmNlZFwiXG4gICAgfSk7XG4gICAgLy8gdG9nZ2xlIGxvZ19yZW5kZXJcbiAgICBuZXcgT2JzaWRpYW4uU2V0dGluZyhjb250YWluZXJFbCkuc2V0TmFtZShcImxvZ19yZW5kZXJcIikuc2V0RGVzYyhcIkxvZyByZW5kZXIgZGV0YWlscyB0byBjb25zb2xlIChpbmNsdWRlcyB0b2tlbl91c2FnZSkuXCIpLmFkZFRvZ2dsZSgodG9nZ2xlKSA9PiB0b2dnbGUuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MubG9nX3JlbmRlcikub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG4gICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5sb2dfcmVuZGVyID0gdmFsdWU7XG4gICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3ModHJ1ZSk7XG4gICAgfSkpO1xuICAgIC8vIHRvZ2dsZSBmaWxlcyBpbiBsb2dfcmVuZGVyXG4gICAgbmV3IE9ic2lkaWFuLlNldHRpbmcoY29udGFpbmVyRWwpLnNldE5hbWUoXCJsb2dfcmVuZGVyX2ZpbGVzXCIpLnNldERlc2MoXCJMb2cgZW1iZWRkZWQgb2JqZWN0cyBwYXRocyB3aXRoIGxvZyByZW5kZXIgKGZvciBkZWJ1Z2dpbmcpLlwiKS5hZGRUb2dnbGUoKHRvZ2dsZSkgPT4gdG9nZ2xlLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmxvZ19yZW5kZXJfZmlsZXMpLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MubG9nX3JlbmRlcl9maWxlcyA9IHZhbHVlO1xuICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKHRydWUpO1xuICAgIH0pKTtcbiAgICAvLyB0b2dnbGUgc2tpcF9zZWN0aW9uc1xuICAgIG5ldyBPYnNpZGlhbi5TZXR0aW5nKGNvbnRhaW5lckVsKS5zZXROYW1lKFwic2tpcF9zZWN0aW9uc1wiKS5zZXREZXNjKFwiU2tpcHMgbWFraW5nIGNvbm5lY3Rpb25zIHRvIHNwZWNpZmljIHNlY3Rpb25zIHdpdGhpbiBub3Rlcy4gV2FybmluZzogcmVkdWNlcyB1c2VmdWxuZXNzIGZvciBsYXJnZSBmaWxlcyBhbmQgcmVxdWlyZXMgJ0ZvcmNlIFJlZnJlc2gnIGZvciBzZWN0aW9ucyB0byB3b3JrIGluIHRoZSBmdXR1cmUuXCIpLmFkZFRvZ2dsZSgodG9nZ2xlKSA9PiB0b2dnbGUuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3Muc2tpcF9zZWN0aW9ucykub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG4gICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5za2lwX3NlY3Rpb25zID0gdmFsdWU7XG4gICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3ModHJ1ZSk7XG4gICAgfSkpO1xuICAgIC8vIHRlc3QgZmlsZSB3cml0aW5nIGJ5IGNyZWF0aW5nIGEgdGVzdCBmaWxlLCB0aGVuIHdyaXRpbmcgYWRkaXRpb25hbCBkYXRhIHRvIHRoZSBmaWxlLCBhbmQgcmV0dXJuaW5nIGFueSBlcnJvciB0ZXh0IGlmIGl0IGZhaWxzXG4gICAgY29udGFpbmVyRWwuY3JlYXRlRWwoXCJoM1wiLCB7XG4gICAgICB0ZXh0OiBcIlRlc3QgRmlsZSBXcml0aW5nXCJcbiAgICB9KTtcbiAgICAvLyBtYW51YWwgc2F2ZSBidXR0b25cbiAgICBjb250YWluZXJFbC5jcmVhdGVFbChcImgzXCIsIHtcbiAgICAgIHRleHQ6IFwiTWFudWFsIFNhdmVcIlxuICAgIH0pO1xuICAgIGxldCBtYW51YWxfc2F2ZV9yZXN1bHRzID0gY29udGFpbmVyRWwuY3JlYXRlRWwoXCJkaXZcIik7XG4gICAgbmV3IE9ic2lkaWFuLlNldHRpbmcoY29udGFpbmVyRWwpLnNldE5hbWUoXCJtYW51YWxfc2F2ZVwiKS5zZXREZXNjKFwiU2F2ZSBjdXJyZW50IGVtYmVkZGluZ3NcIikuYWRkQnV0dG9uKChidXR0b24pID0+IGJ1dHRvbi5zZXRCdXR0b25UZXh0KFwiTWFudWFsIFNhdmVcIikub25DbGljayhhc3luYyAoKSA9PiB7XG4gICAgICAvLyBjb25maXJtXG4gICAgICBpZiAoY29uZmlybShcIkFyZSB5b3Ugc3VyZSB5b3Ugd2FudCB0byBzYXZlIHlvdXIgY3VycmVudCBlbWJlZGRpbmdzP1wiKSkge1xuICAgICAgICAvLyBzYXZlXG4gICAgICAgIHRyeXtcbiAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlX2VtYmVkZGluZ3NfdG9fZmlsZSh0cnVlKTtcbiAgICAgICAgICBtYW51YWxfc2F2ZV9yZXN1bHRzLmlubmVySFRNTCA9IFwiRW1iZWRkaW5ncyBzYXZlZCBzdWNjZXNzZnVsbHkuXCI7XG4gICAgICAgIH1jYXRjaChlKXtcbiAgICAgICAgICBtYW51YWxfc2F2ZV9yZXN1bHRzLmlubmVySFRNTCA9IFwiRW1iZWRkaW5ncyBmYWlsZWQgdG8gc2F2ZS4gRXJyb3I6IFwiICsgZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pKTtcblxuICAgIC8vIGxpc3QgcHJldmlvdXNseSBmYWlsZWQgZmlsZXNcbiAgICBjb250YWluZXJFbC5jcmVhdGVFbChcImgzXCIsIHtcbiAgICAgIHRleHQ6IFwiUHJldmlvdXNseSBmYWlsZWQgZmlsZXNcIlxuICAgIH0pO1xuICAgIGxldCBmYWlsZWRfbGlzdCA9IGNvbnRhaW5lckVsLmNyZWF0ZUVsKFwiZGl2XCIpO1xuICAgIHRoaXMuZHJhd19mYWlsZWRfZmlsZXNfbGlzdChmYWlsZWRfbGlzdCk7XG5cbiAgICAvLyBmb3JjZSByZWZyZXNoIGJ1dHRvblxuICAgIGNvbnRhaW5lckVsLmNyZWF0ZUVsKFwiaDNcIiwge1xuICAgICAgdGV4dDogXCJGb3JjZSBSZWZyZXNoXCJcbiAgICB9KTtcbiAgICBuZXcgT2JzaWRpYW4uU2V0dGluZyhjb250YWluZXJFbCkuc2V0TmFtZShcImZvcmNlX3JlZnJlc2hcIikuc2V0RGVzYyhcIldBUk5JTkc6IERPIE5PVCB1c2UgdW5sZXNzIHlvdSBrbm93IHdoYXQgeW91IGFyZSBkb2luZyEgVGhpcyB3aWxsIGRlbGV0ZSBhbGwgb2YgeW91ciBjdXJyZW50IGVtYmVkZGluZ3MgZnJvbSBPcGVuQUkgYW5kIHRyaWdnZXIgcmVwcm9jZXNzaW5nIG9mIHlvdXIgZW50aXJlIHZhdWx0IVwiKS5hZGRCdXR0b24oKGJ1dHRvbikgPT4gYnV0dG9uLnNldEJ1dHRvblRleHQoXCJGb3JjZSBSZWZyZXNoXCIpLm9uQ2xpY2soYXN5bmMgKCkgPT4ge1xuICAgICAgLy8gY29uZmlybVxuICAgICAgaWYgKGNvbmZpcm0oXCJBcmUgeW91IHN1cmUgeW91IHdhbnQgdG8gRm9yY2UgUmVmcmVzaD8gQnkgY2xpY2tpbmcgeWVzIHlvdSBjb25maXJtIHRoYXQgeW91IHVuZGVyc3RhbmQgdGhlIGNvbnNlcXVlbmNlcyBvZiB0aGlzIGFjdGlvbi5cIikpIHtcbiAgICAgICAgLy8gZm9yY2UgcmVmcmVzaFxuICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5mb3JjZV9yZWZyZXNoX2VtYmVkZGluZ3NfZmlsZSgpO1xuICAgICAgfVxuICAgIH0pKTtcblxuICB9XG4gIGdldF9zZWxmX3JlZl9saXN0KCkge1xuICAgIHJldHVybiBcIkN1cnJlbnQ6IFwiICsgU01BUlRfVFJBTlNMQVRJT05bdGhpcy5wbHVnaW4uc2V0dGluZ3MubGFuZ3VhZ2VdLnByb25vdXMuam9pbihcIiwgXCIpO1xuICB9XG5cbiAgZHJhd19mYWlsZWRfZmlsZXNfbGlzdChmYWlsZWRfbGlzdCkge1xuICAgIGZhaWxlZF9saXN0LmVtcHR5KCk7XG4gICAgaWYodGhpcy5wbHVnaW4uc2V0dGluZ3MuZmFpbGVkX2ZpbGVzLmxlbmd0aCA+IDApIHtcbiAgICAgIC8vIGFkZCBtZXNzYWdlIHRoYXQgdGhlc2UgZmlsZXMgd2lsbCBiZSBza2lwcGVkIHVudGlsIG1hbnVhbGx5IHJldHJpZWRcbiAgICAgIGZhaWxlZF9saXN0LmNyZWF0ZUVsKFwicFwiLCB7XG4gICAgICAgIHRleHQ6IFwiVGhlIGZvbGxvd2luZyBmaWxlcyBmYWlsZWQgdG8gcHJvY2VzcyBhbmQgd2lsbCBiZSBza2lwcGVkIHVudGlsIG1hbnVhbGx5IHJldHJpZWQuXCJcbiAgICAgIH0pO1xuICAgICAgbGV0IGxpc3QgPSBmYWlsZWRfbGlzdC5jcmVhdGVFbChcInVsXCIpO1xuICAgICAgZm9yIChsZXQgZmFpbGVkX2ZpbGUgb2YgdGhpcy5wbHVnaW4uc2V0dGluZ3MuZmFpbGVkX2ZpbGVzKSB7XG4gICAgICAgIGxpc3QuY3JlYXRlRWwoXCJsaVwiLCB7XG4gICAgICAgICAgdGV4dDogZmFpbGVkX2ZpbGVcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgICAvLyBhZGQgYnV0dG9uIHRvIHJldHJ5IGZhaWxlZCBmaWxlcyBvbmx5XG4gICAgICBuZXcgT2JzaWRpYW4uU2V0dGluZyhmYWlsZWRfbGlzdCkuc2V0TmFtZShcInJldHJ5X2ZhaWxlZF9maWxlc1wiKS5zZXREZXNjKFwiUmV0cnkgZmFpbGVkIGZpbGVzIG9ubHlcIikuYWRkQnV0dG9uKChidXR0b24pID0+IGJ1dHRvbi5zZXRCdXR0b25UZXh0KFwiUmV0cnkgZmFpbGVkIGZpbGVzIG9ubHlcIikub25DbGljayhhc3luYyAoKSA9PiB7XG4gICAgICAgIC8vIGNsZWFyIGZhaWxlZF9saXN0IGVsZW1lbnRcbiAgICAgICAgZmFpbGVkX2xpc3QuZW1wdHkoKTtcbiAgICAgICAgLy8gc2V0IFwicmV0cnlpbmdcIiB0ZXh0XG4gICAgICAgIGZhaWxlZF9saXN0LmNyZWF0ZUVsKFwicFwiLCB7XG4gICAgICAgICAgdGV4dDogXCJSZXRyeWluZyBmYWlsZWQgZmlsZXMuLi5cIlxuICAgICAgICB9KTtcbiAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4ucmV0cnlfZmFpbGVkX2ZpbGVzKCk7XG4gICAgICAgIC8vIHJlZHJhdyBmYWlsZWQgZmlsZXMgbGlzdFxuICAgICAgICB0aGlzLmRyYXdfZmFpbGVkX2ZpbGVzX2xpc3QoZmFpbGVkX2xpc3QpO1xuICAgICAgfSkpO1xuICAgIH1lbHNle1xuICAgICAgZmFpbGVkX2xpc3QuY3JlYXRlRWwoXCJwXCIsIHtcbiAgICAgICAgdGV4dDogXCJObyBmYWlsZWQgZmlsZXNcIlxuICAgICAgfSk7XG4gICAgfVxuICB9XG59XG5cbmZ1bmN0aW9uIGxpbmVfaXNfaGVhZGluZyhsaW5lKSB7XG4gIHJldHVybiAobGluZS5pbmRleE9mKFwiI1wiKSA9PT0gMCkgJiYgKFsnIycsICcgJ10uaW5kZXhPZihsaW5lWzFdKSAhPT0gLTEpO1xufVxuXG5jb25zdCBTTUFSVF9DT05ORUNUSU9OU19DSEFUX1ZJRVdfVFlQRSA9IFwic21hcnQtY29ubmVjdGlvbnMtY2hhdC12aWV3XCI7XG5cbmNsYXNzIFNtYXJ0Q29ubmVjdGlvbnNDaGF0VmlldyBleHRlbmRzIE9ic2lkaWFuLkl0ZW1WaWV3IHtcbiAgY29uc3RydWN0b3IobGVhZiwgcGx1Z2luKSB7XG4gICAgc3VwZXIobGVhZik7XG4gICAgdGhpcy5wbHVnaW4gPSBwbHVnaW47XG4gICAgdGhpcy5hY3RpdmVfZWxtID0gbnVsbDtcbiAgICB0aGlzLmFjdGl2ZV9zdHJlYW0gPSBudWxsO1xuICAgIHRoaXMuYnJhY2tldHNfY3QgPSAwO1xuICAgIHRoaXMuY2hhdCA9IG51bGw7XG4gICAgdGhpcy5jaGF0X2JveCA9IG51bGw7XG4gICAgdGhpcy5jaGF0X2NvbnRhaW5lciA9IG51bGw7XG4gICAgdGhpcy5jdXJyZW50X2NoYXRfbWwgPSBbXTtcbiAgICB0aGlzLmZpbGVzID0gW107XG4gICAgdGhpcy5sYXN0X2Zyb20gPSBudWxsO1xuICAgIHRoaXMubWVzc2FnZV9jb250YWluZXIgPSBudWxsO1xuICAgIHRoaXMucHJldmVudF9pbnB1dCA9IGZhbHNlO1xuICB9XG4gIGdldERpc3BsYXlUZXh0KCkge1xuICAgIHJldHVybiBcIlNtYXJ0IENvbm5lY3Rpb25zIENoYXRcIjtcbiAgfVxuICBnZXRJY29uKCkge1xuICAgIHJldHVybiBcIm1lc3NhZ2Utc3F1YXJlXCI7XG4gIH1cbiAgZ2V0Vmlld1R5cGUoKSB7XG4gICAgcmV0dXJuIFNNQVJUX0NPTk5FQ1RJT05TX0NIQVRfVklFV19UWVBFO1xuICB9XG4gIG9uT3BlbigpIHtcbiAgICB0aGlzLm5ld19jaGF0KCk7XG4gICAgdGhpcy5wbHVnaW4uZ2V0X2FsbF9mb2xkZXJzKCk7IC8vIHNldHMgdGhpcy5wbHVnaW4uZm9sZGVycyBuZWNlc3NhcnkgZm9yIGZvbGRlci1jb250ZXh0XG4gIH1cbiAgb25DbG9zZSgpIHtcbiAgICB0aGlzLmNoYXQuc2F2ZV9jaGF0KCk7XG4gICAgdGhpcy5hcHAud29ya3NwYWNlLnVucmVnaXN0ZXJIb3ZlckxpbmtTb3VyY2UoU01BUlRfQ09OTkVDVElPTlNfQ0hBVF9WSUVXX1RZUEUpO1xuICB9XG4gIHJlbmRlcl9jaGF0KCkge1xuICAgIHRoaXMuY29udGFpbmVyRWwuZW1wdHkoKTtcbiAgICB0aGlzLmNoYXRfY29udGFpbmVyID0gdGhpcy5jb250YWluZXJFbC5jcmVhdGVEaXYoXCJzYy1jaGF0LWNvbnRhaW5lclwiKTtcbiAgICAvLyByZW5kZXIgcGx1cyBzaWduIGZvciBjbGVhciBidXR0b25cbiAgICB0aGlzLnJlbmRlcl90b3BfYmFyKCk7XG4gICAgLy8gcmVuZGVyIGNoYXQgbWVzc2FnZXMgY29udGFpbmVyXG4gICAgdGhpcy5yZW5kZXJfY2hhdF9ib3goKTtcbiAgICAvLyByZW5kZXIgY2hhdCBpbnB1dFxuICAgIHRoaXMucmVuZGVyX2NoYXRfaW5wdXQoKTtcbiAgICB0aGlzLnBsdWdpbi5yZW5kZXJfYnJhbmQodGhpcy5jb250YWluZXJFbCwgXCJjaGF0XCIpO1xuICB9XG4gIC8vIHJlbmRlciBwbHVzIHNpZ24gZm9yIGNsZWFyIGJ1dHRvblxuICByZW5kZXJfdG9wX2JhcigpIHtcbiAgICAvLyBjcmVhdGUgY29udGFpbmVyIGZvciBjbGVhciBidXR0b25cbiAgICBsZXQgdG9wX2Jhcl9jb250YWluZXIgPSB0aGlzLmNoYXRfY29udGFpbmVyLmNyZWF0ZURpdihcInNjLXRvcC1iYXItY29udGFpbmVyXCIpO1xuICAgIC8vIHJlbmRlciB0aGUgbmFtZSBvZiB0aGUgY2hhdCBpbiBhbiBpbnB1dCBib3ggKHBvcCBjb250ZW50IGFmdGVyIGxhc3QgaHlwaGVuIGluIGNoYXRfaWQpXG4gICAgbGV0IGNoYXRfbmFtZSA9dGhpcy5jaGF0Lm5hbWUoKTtcbiAgICBsZXQgY2hhdF9uYW1lX2lucHV0ID0gdG9wX2Jhcl9jb250YWluZXIuY3JlYXRlRWwoXCJpbnB1dFwiLCB7XG4gICAgICBhdHRyOiB7XG4gICAgICAgIHR5cGU6IFwidGV4dFwiLFxuICAgICAgICB2YWx1ZTogY2hhdF9uYW1lXG4gICAgICB9LFxuICAgICAgY2xzOiBcInNjLWNoYXQtbmFtZS1pbnB1dFwiXG4gICAgfSk7XG4gICAgY2hhdF9uYW1lX2lucHV0LmFkZEV2ZW50TGlzdGVuZXIoXCJjaGFuZ2VcIiwgdGhpcy5yZW5hbWVfY2hhdC5iaW5kKHRoaXMpKTtcbiAgICBcbiAgICAvLyBjcmVhdGUgYnV0dG9uIHRvIFNtYXJ0IFZpZXdcbiAgICBsZXQgc21hcnRfdmlld19idG4gPSB0aGlzLmNyZWF0ZV90b3BfYmFyX2J1dHRvbih0b3BfYmFyX2NvbnRhaW5lciwgXCJTbWFydCBWaWV3XCIsIFwic21hcnQtY29ubmVjdGlvbnNcIik7XG4gICAgc21hcnRfdmlld19idG4uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIHRoaXMub3Blbl9zbWFydF92aWV3LmJpbmQodGhpcykpO1xuICAgIC8vIGNyZWF0ZSBidXR0b24gdG8gc2F2ZSBjaGF0XG4gICAgbGV0IHNhdmVfYnRuID0gdGhpcy5jcmVhdGVfdG9wX2Jhcl9idXR0b24odG9wX2Jhcl9jb250YWluZXIsIFwiU2F2ZSBDaGF0XCIsIFwic2F2ZVwiKTtcbiAgICBzYXZlX2J0bi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgdGhpcy5zYXZlX2NoYXQuYmluZCh0aGlzKSk7XG4gICAgLy8gY3JlYXRlIGJ1dHRvbiB0byBvcGVuIGNoYXQgaGlzdG9yeSBtb2RhbFxuICAgIGxldCBoaXN0b3J5X2J0biA9IHRoaXMuY3JlYXRlX3RvcF9iYXJfYnV0dG9uKHRvcF9iYXJfY29udGFpbmVyLCBcIkNoYXQgSGlzdG9yeVwiLCBcImhpc3RvcnlcIik7XG4gICAgaGlzdG9yeV9idG4uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIHRoaXMub3Blbl9jaGF0X2hpc3RvcnkuYmluZCh0aGlzKSk7XG4gICAgLy8gY3JlYXRlIGJ1dHRvbiB0byBzdGFydCBuZXcgY2hhdFxuICAgIGNvbnN0IG5ld19jaGF0X2J0biA9IHRoaXMuY3JlYXRlX3RvcF9iYXJfYnV0dG9uKHRvcF9iYXJfY29udGFpbmVyLCBcIk5ldyBDaGF0XCIsIFwicGx1c1wiKTtcbiAgICBuZXdfY2hhdF9idG4uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIHRoaXMubmV3X2NoYXQuYmluZCh0aGlzKSk7XG4gIH1cbiAgYXN5bmMgb3Blbl9jaGF0X2hpc3RvcnkoKSB7XG4gICAgY29uc3QgZm9sZGVyID0gYXdhaXQgdGhpcy5hcHAudmF1bHQuYWRhcHRlci5saXN0KFwiLnNtYXJ0LWNvbm5lY3Rpb25zL2NoYXRzXCIpO1xuICAgIHRoaXMuZmlsZXMgPSBmb2xkZXIuZmlsZXMubWFwKChmaWxlKSA9PiB7XG4gICAgICByZXR1cm4gZmlsZS5yZXBsYWNlKFwiLnNtYXJ0LWNvbm5lY3Rpb25zL2NoYXRzL1wiLCBcIlwiKS5yZXBsYWNlKFwiLmpzb25cIiwgXCJcIik7XG4gICAgfSk7XG4gICAgLy8gb3BlbiBjaGF0IGhpc3RvcnkgbW9kYWxcbiAgICBpZiAoIXRoaXMubW9kYWwpXG4gICAgICB0aGlzLm1vZGFsID0gbmV3IFNtYXJ0Q29ubmVjdGlvbnNDaGF0SGlzdG9yeU1vZGFsKHRoaXMuYXBwLCB0aGlzKTtcbiAgICB0aGlzLm1vZGFsLm9wZW4oKTtcbiAgfVxuXG4gIGNyZWF0ZV90b3BfYmFyX2J1dHRvbih0b3BfYmFyX2NvbnRhaW5lciwgdGl0bGUsIGljb249bnVsbCkge1xuICAgIGxldCBidG4gPSB0b3BfYmFyX2NvbnRhaW5lci5jcmVhdGVFbChcImJ1dHRvblwiLCB7XG4gICAgICBhdHRyOiB7XG4gICAgICAgIHRpdGxlOiB0aXRsZVxuICAgICAgfVxuICAgIH0pO1xuICAgIGlmKGljb24pe1xuICAgICAgT2JzaWRpYW4uc2V0SWNvbihidG4sIGljb24pO1xuICAgIH1lbHNle1xuICAgICAgYnRuLmlubmVySFRNTCA9IHRpdGxlO1xuICAgIH1cbiAgICByZXR1cm4gYnRuO1xuICB9XG4gIC8vIHJlbmRlciBuZXcgY2hhdFxuICBuZXdfY2hhdCgpIHtcbiAgICB0aGlzLmNsZWFyX2NoYXQoKTtcbiAgICB0aGlzLnJlbmRlcl9jaGF0KCk7XG4gICAgLy8gcmVuZGVyIGluaXRpYWwgbWVzc2FnZSBmcm9tIGFzc2lzdGFudCAoZG9uJ3QgdXNlIHJlbmRlcl9tZXNzYWdlIHRvIHNraXAgYWRkaW5nIHRvIGNoYXQgaGlzdG9yeSlcbiAgICB0aGlzLm5ld19tZXNzc2FnZV9idWJibGUoXCJhc3Npc3RhbnRcIik7XG4gICAgdGhpcy5hY3RpdmVfZWxtLmlubmVySFRNTCA9ICc8cD4nICsgU01BUlRfVFJBTlNMQVRJT05bdGhpcy5wbHVnaW4uc2V0dGluZ3MubGFuZ3VhZ2VdLmluaXRpYWxfbWVzc2FnZSsnPC9wPic7XG4gIH1cbiAgLy8gb3BlbiBhIGNoYXQgZnJvbSB0aGUgY2hhdCBoaXN0b3J5IG1vZGFsXG4gIGFzeW5jIG9wZW5fY2hhdChjaGF0X2lkKSB7XG4gICAgdGhpcy5jbGVhcl9jaGF0KCk7XG4gICAgYXdhaXQgdGhpcy5jaGF0LmxvYWRfY2hhdChjaGF0X2lkKTtcbiAgICB0aGlzLnJlbmRlcl9jaGF0KCk7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLmNoYXQuY2hhdF9tbC5sZW5ndGg7IGkrKykge1xuICAgICAgYXdhaXQgdGhpcy5yZW5kZXJfbWVzc2FnZSh0aGlzLmNoYXQuY2hhdF9tbFtpXS5jb250ZW50LCB0aGlzLmNoYXQuY2hhdF9tbFtpXS5yb2xlKTtcbiAgICB9XG4gIH1cbiAgLy8gY2xlYXIgY3VycmVudCBjaGF0IHN0YXRlXG4gIGNsZWFyX2NoYXQoKSB7XG4gICAgaWYgKHRoaXMuY2hhdCkge1xuICAgICAgdGhpcy5jaGF0LnNhdmVfY2hhdCgpO1xuICAgIH1cbiAgICB0aGlzLmNoYXQgPSBuZXcgU21hcnRDb25uZWN0aW9uc0NoYXRNb2RlbCh0aGlzLnBsdWdpbik7XG4gICAgLy8gaWYgdGhpcy5kb3Rkb3Rkb3RfaW50ZXJ2YWwgaXMgbm90IG51bGwsIGNsZWFyIGludGVydmFsXG4gICAgaWYgKHRoaXMuZG90ZG90ZG90X2ludGVydmFsKSB7XG4gICAgICBjbGVhckludGVydmFsKHRoaXMuZG90ZG90ZG90X2ludGVydmFsKTtcbiAgICB9XG4gICAgLy8gY2xlYXIgY3VycmVudCBjaGF0IG1sXG4gICAgdGhpcy5jdXJyZW50X2NoYXRfbWwgPSBbXTtcbiAgICAvLyB1cGRhdGUgcHJldmVudCBpbnB1dFxuICAgIHRoaXMuZW5kX3N0cmVhbSgpO1xuICB9XG5cbiAgcmVuYW1lX2NoYXQoZXZlbnQpIHtcbiAgICBsZXQgbmV3X2NoYXRfbmFtZSA9IGV2ZW50LnRhcmdldC52YWx1ZTtcbiAgICB0aGlzLmNoYXQucmVuYW1lX2NoYXQobmV3X2NoYXRfbmFtZSk7XG4gIH1cbiAgXG4gIC8vIHNhdmUgY3VycmVudCBjaGF0XG4gIHNhdmVfY2hhdCgpIHtcbiAgICB0aGlzLmNoYXQuc2F2ZV9jaGF0KCk7XG4gICAgbmV3IE9ic2lkaWFuLk5vdGljZShcIltTbWFydCBDb25uZWN0aW9uc10gQ2hhdCBzYXZlZFwiKTtcbiAgfVxuICBcbiAgb3Blbl9zbWFydF92aWV3KCkge1xuICAgIHRoaXMucGx1Z2luLm9wZW5fdmlldygpO1xuICB9XG4gIC8vIHJlbmRlciBjaGF0IG1lc3NhZ2VzIGNvbnRhaW5lclxuICByZW5kZXJfY2hhdF9ib3goKSB7XG4gICAgLy8gY3JlYXRlIGNvbnRhaW5lciBmb3IgY2hhdCBtZXNzYWdlc1xuICAgIHRoaXMuY2hhdF9ib3ggPSB0aGlzLmNoYXRfY29udGFpbmVyLmNyZWF0ZURpdihcInNjLWNoYXQtYm94XCIpO1xuICAgIC8vIGNyZWF0ZSBjb250YWluZXIgZm9yIG1lc3NhZ2VcbiAgICB0aGlzLm1lc3NhZ2VfY29udGFpbmVyID0gdGhpcy5jaGF0X2JveC5jcmVhdGVEaXYoXCJzYy1tZXNzYWdlLWNvbnRhaW5lclwiKTtcbiAgfVxuICAvLyBvcGVuIGZpbGUgc3VnZ2VzdGlvbiBtb2RhbFxuICBvcGVuX2ZpbGVfc3VnZ2VzdGlvbl9tb2RhbCgpIHtcbiAgICAvLyBvcGVuIGZpbGUgc3VnZ2VzdGlvbiBtb2RhbFxuICAgIGlmKCF0aGlzLmZpbGVfc2VsZWN0b3IpIHRoaXMuZmlsZV9zZWxlY3RvciA9IG5ldyBTbWFydENvbm5lY3Rpb25zRmlsZVNlbGVjdE1vZGFsKHRoaXMuYXBwLCB0aGlzKTtcbiAgICB0aGlzLmZpbGVfc2VsZWN0b3Iub3BlbigpO1xuICB9XG4gIC8vIG9wZW4gZm9sZGVyIHN1Z2dlc3Rpb24gbW9kYWxcbiAgYXN5bmMgb3Blbl9mb2xkZXJfc3VnZ2VzdGlvbl9tb2RhbCgpIHtcbiAgICAvLyBvcGVuIGZvbGRlciBzdWdnZXN0aW9uIG1vZGFsXG4gICAgaWYoIXRoaXMuZm9sZGVyX3NlbGVjdG9yKXtcbiAgICAgIHRoaXMuZm9sZGVyX3NlbGVjdG9yID0gbmV3IFNtYXJ0Q29ubmVjdGlvbnNGb2xkZXJTZWxlY3RNb2RhbCh0aGlzLmFwcCwgdGhpcyk7XG4gICAgfVxuICAgIHRoaXMuZm9sZGVyX3NlbGVjdG9yLm9wZW4oKTtcbiAgfVxuICAvLyBpbnNlcnRfc2VsZWN0aW9uIGZyb20gZmlsZSBzdWdnZXN0aW9uIG1vZGFsXG4gIGluc2VydF9zZWxlY3Rpb24oaW5zZXJ0X3RleHQpIHtcbiAgICAvLyBnZXQgY2FyZXQgcG9zaXRpb25cbiAgICBsZXQgY2FyZXRfcG9zID0gdGhpcy50ZXh0YXJlYS5zZWxlY3Rpb25TdGFydDtcbiAgICAvLyBnZXQgdGV4dCBiZWZvcmUgY2FyZXRcbiAgICBsZXQgdGV4dF9iZWZvcmUgPSB0aGlzLnRleHRhcmVhLnZhbHVlLnN1YnN0cmluZygwLCBjYXJldF9wb3MpO1xuICAgIC8vIGdldCB0ZXh0IGFmdGVyIGNhcmV0XG4gICAgbGV0IHRleHRfYWZ0ZXIgPSB0aGlzLnRleHRhcmVhLnZhbHVlLnN1YnN0cmluZyhjYXJldF9wb3MsIHRoaXMudGV4dGFyZWEudmFsdWUubGVuZ3RoKTtcbiAgICAvLyBpbnNlcnQgdGV4dFxuICAgIHRoaXMudGV4dGFyZWEudmFsdWUgPSB0ZXh0X2JlZm9yZSArIGluc2VydF90ZXh0ICsgdGV4dF9hZnRlcjtcbiAgICAvLyBzZXQgY2FyZXQgcG9zaXRpb25cbiAgICB0aGlzLnRleHRhcmVhLnNlbGVjdGlvblN0YXJ0ID0gY2FyZXRfcG9zICsgaW5zZXJ0X3RleHQubGVuZ3RoO1xuICAgIHRoaXMudGV4dGFyZWEuc2VsZWN0aW9uRW5kID0gY2FyZXRfcG9zICsgaW5zZXJ0X3RleHQubGVuZ3RoO1xuICAgIC8vIGZvY3VzIG9uIHRleHRhcmVhXG4gICAgdGhpcy50ZXh0YXJlYS5mb2N1cygpO1xuICB9XG5cbiAgLy8gcmVuZGVyIGNoYXQgdGV4dGFyZWEgYW5kIGJ1dHRvblxuICByZW5kZXJfY2hhdF9pbnB1dCgpIHtcbiAgICAvLyBjcmVhdGUgY29udGFpbmVyIGZvciBjaGF0IGlucHV0XG4gICAgbGV0IGNoYXRfaW5wdXQgPSB0aGlzLmNoYXRfY29udGFpbmVyLmNyZWF0ZURpdihcInNjLWNoYXQtZm9ybVwiKTtcbiAgICAvLyBjcmVhdGUgdGV4dGFyZWFcbiAgICB0aGlzLnRleHRhcmVhID0gY2hhdF9pbnB1dC5jcmVhdGVFbChcInRleHRhcmVhXCIsIHtcbiAgICAgIGNsczogXCJzYy1jaGF0LWlucHV0XCIsXG4gICAgICBhdHRyOiB7XG4gICAgICAgIHBsYWNlaG9sZGVyOiBgVHJ5IFwiQmFzZWQgb24gbXkgbm90ZXNcIiBvciBcIlN1bW1hcml6ZSBbW3RoaXMgbm90ZV1dXCIgb3IgXCJJbXBvcnRhbnQgdGFza3MgaW4gL2ZvbGRlci9cImBcbiAgICAgIH1cbiAgICB9KTtcbiAgICAvLyB1c2UgY29udGVudGVkaXRhYmxlIGluc3RlYWQgb2YgdGV4dGFyZWFcbiAgICAvLyB0aGlzLnRleHRhcmVhID0gY2hhdF9pbnB1dC5jcmVhdGVFbChcImRpdlwiLCB7Y2xzOiBcInNjLWNoYXQtaW5wdXRcIiwgYXR0cjoge2NvbnRlbnRlZGl0YWJsZTogdHJ1ZX19KTtcbiAgICAvLyBhZGQgZXZlbnQgbGlzdGVuZXIgdG8gbGlzdGVuIGZvciBzaGlmdCtlbnRlclxuICAgIGNoYXRfaW5wdXQuYWRkRXZlbnRMaXN0ZW5lcihcImtleXVwXCIsIChlKSA9PiB7XG4gICAgICBpZihbXCJbXCIsIFwiL1wiXS5pbmRleE9mKGUua2V5KSA9PT0gLTEpIHJldHVybjsgLy8gc2tpcCBpZiBrZXkgaXMgbm90IFsgb3IgL1xuICAgICAgY29uc3QgY2FyZXRfcG9zID0gdGhpcy50ZXh0YXJlYS5zZWxlY3Rpb25TdGFydDtcbiAgICAgIC8vIGlmIGtleSBpcyBvcGVuIHNxdWFyZSBicmFja2V0XG4gICAgICBpZiAoZS5rZXkgPT09IFwiW1wiKSB7XG4gICAgICAgIC8vIGlmIHByZXZpb3VzIGNoYXIgaXMgW1xuICAgICAgICBpZih0aGlzLnRleHRhcmVhLnZhbHVlW2NhcmV0X3BvcyAtIDJdID09PSBcIltcIil7XG4gICAgICAgICAgLy8gb3BlbiBmaWxlIHN1Z2dlc3Rpb24gbW9kYWxcbiAgICAgICAgICB0aGlzLm9wZW5fZmlsZV9zdWdnZXN0aW9uX21vZGFsKCk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICB9ZWxzZXtcbiAgICAgICAgdGhpcy5icmFja2V0c19jdCA9IDA7XG4gICAgICB9XG4gICAgICAvLyBpZiAvIGlzIHByZXNzZWRcbiAgICAgIGlmIChlLmtleSA9PT0gXCIvXCIpIHtcbiAgICAgICAgLy8gZ2V0IGNhcmV0IHBvc2l0aW9uXG4gICAgICAgIC8vIGlmIHRoaXMgaXMgZmlyc3QgY2hhciBvciBwcmV2aW91cyBjaGFyIGlzIHNwYWNlXG4gICAgICAgIGlmICh0aGlzLnRleHRhcmVhLnZhbHVlLmxlbmd0aCA9PT0gMSB8fCB0aGlzLnRleHRhcmVhLnZhbHVlW2NhcmV0X3BvcyAtIDJdID09PSBcIiBcIikge1xuICAgICAgICAgIC8vIG9wZW4gZm9sZGVyIHN1Z2dlc3Rpb24gbW9kYWxcbiAgICAgICAgICB0aGlzLm9wZW5fZm9sZGVyX3N1Z2dlc3Rpb25fbW9kYWwoKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgIH0pO1xuXG4gICAgY2hhdF9pbnB1dC5hZGRFdmVudExpc3RlbmVyKFwia2V5ZG93blwiLCAoZSkgPT4ge1xuICAgICAgaWYgKGUua2V5ID09PSBcIkVudGVyXCIgJiYgZS5zaGlmdEtleSkge1xuICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgIGlmKHRoaXMucHJldmVudF9pbnB1dCl7XG4gICAgICAgICAgY29uc29sZS5sb2coXCJ3YWl0IHVudGlsIGN1cnJlbnQgcmVzcG9uc2UgaXMgZmluaXNoZWRcIik7XG4gICAgICAgICAgbmV3IE9ic2lkaWFuLk5vdGljZShcIltTbWFydCBDb25uZWN0aW9uc10gV2FpdCB1bnRpbCBjdXJyZW50IHJlc3BvbnNlIGlzIGZpbmlzaGVkXCIpO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICAvLyBnZXQgdGV4dCBmcm9tIHRleHRhcmVhXG4gICAgICAgIGxldCB1c2VyX2lucHV0ID0gdGhpcy50ZXh0YXJlYS52YWx1ZTtcbiAgICAgICAgLy8gY2xlYXIgdGV4dGFyZWFcbiAgICAgICAgdGhpcy50ZXh0YXJlYS52YWx1ZSA9IFwiXCI7XG4gICAgICAgIC8vIGluaXRpYXRlIHJlc3BvbnNlIGZyb20gYXNzaXN0YW50XG4gICAgICAgIHRoaXMuaW5pdGlhbGl6ZV9yZXNwb25zZSh1c2VyX2lucHV0KTtcbiAgICAgIH1cbiAgICAgIHRoaXMudGV4dGFyZWEuc3R5bGUuaGVpZ2h0ID0gJ2F1dG8nO1xuICAgICAgdGhpcy50ZXh0YXJlYS5zdHlsZS5oZWlnaHQgPSAodGhpcy50ZXh0YXJlYS5zY3JvbGxIZWlnaHQpICsgJ3B4JztcbiAgICB9KTtcbiAgICAvLyBidXR0b24gY29udGFpbmVyXG4gICAgbGV0IGJ1dHRvbl9jb250YWluZXIgPSBjaGF0X2lucHV0LmNyZWF0ZURpdihcInNjLWJ1dHRvbi1jb250YWluZXJcIik7XG4gICAgLy8gY3JlYXRlIGhpZGRlbiBhYm9ydCBidXR0b25cbiAgICBsZXQgYWJvcnRfYnV0dG9uID0gYnV0dG9uX2NvbnRhaW5lci5jcmVhdGVFbChcInNwYW5cIiwgeyBhdHRyOiB7aWQ6IFwic2MtYWJvcnQtYnV0dG9uXCIsIHN0eWxlOiBcImRpc3BsYXk6IG5vbmU7XCJ9IH0pO1xuICAgIE9ic2lkaWFuLnNldEljb24oYWJvcnRfYnV0dG9uLCBcInNxdWFyZVwiKTtcbiAgICAvLyBhZGQgZXZlbnQgbGlzdGVuZXIgdG8gYnV0dG9uXG4gICAgYWJvcnRfYnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiB7XG4gICAgICAvLyBhYm9ydCBjdXJyZW50IHJlc3BvbnNlXG4gICAgICB0aGlzLmVuZF9zdHJlYW0oKTtcbiAgICB9KTtcbiAgICAvLyBjcmVhdGUgYnV0dG9uXG4gICAgbGV0IGJ1dHRvbiA9IGJ1dHRvbl9jb250YWluZXIuY3JlYXRlRWwoXCJidXR0b25cIiwgeyBhdHRyOiB7aWQ6IFwic2Mtc2VuZC1idXR0b25cIn0sIGNsczogXCJzZW5kLWJ1dHRvblwiIH0pO1xuICAgIGJ1dHRvbi5pbm5lckhUTUwgPSBcIlNlbmRcIjtcbiAgICAvLyBhZGQgZXZlbnQgbGlzdGVuZXIgdG8gYnV0dG9uXG4gICAgYnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiB7XG4gICAgICBpZih0aGlzLnByZXZlbnRfaW5wdXQpe1xuICAgICAgICBjb25zb2xlLmxvZyhcIndhaXQgdW50aWwgY3VycmVudCByZXNwb25zZSBpcyBmaW5pc2hlZFwiKTtcbiAgICAgICAgbmV3IE9ic2lkaWFuLk5vdGljZShcIldhaXQgdW50aWwgY3VycmVudCByZXNwb25zZSBpcyBmaW5pc2hlZFwiKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgLy8gZ2V0IHRleHQgZnJvbSB0ZXh0YXJlYVxuICAgICAgbGV0IHVzZXJfaW5wdXQgPSB0aGlzLnRleHRhcmVhLnZhbHVlO1xuICAgICAgLy8gY2xlYXIgdGV4dGFyZWFcbiAgICAgIHRoaXMudGV4dGFyZWEudmFsdWUgPSBcIlwiO1xuICAgICAgLy8gaW5pdGlhdGUgcmVzcG9uc2UgZnJvbSBhc3Npc3RhbnRcbiAgICAgIHRoaXMuaW5pdGlhbGl6ZV9yZXNwb25zZSh1c2VyX2lucHV0KTtcbiAgICB9KTtcbiAgfVxuICBhc3luYyBpbml0aWFsaXplX3Jlc3BvbnNlKHVzZXJfaW5wdXQpIHtcbiAgICB0aGlzLnNldF9zdHJlYW1pbmdfdXgoKTtcbiAgICAvLyByZW5kZXIgbWVzc2FnZVxuICAgIGF3YWl0IHRoaXMucmVuZGVyX21lc3NhZ2UodXNlcl9pbnB1dCwgXCJ1c2VyXCIpO1xuICAgIHRoaXMuY2hhdC5uZXdfbWVzc2FnZV9pbl90aHJlYWQoe1xuICAgICAgcm9sZTogXCJ1c2VyXCIsXG4gICAgICBjb250ZW50OiB1c2VyX2lucHV0XG4gICAgfSk7XG4gICAgYXdhaXQgdGhpcy5yZW5kZXJfZG90ZG90ZG90KCk7XG5cbiAgICAvLyBpZiBjb250YWlucyBpbnRlcm5hbCBsaW5rIHJlcHJlc2VudGVkIGJ5IFtbbGlua11dXG4gICAgaWYodGhpcy5jaGF0LmNvbnRhaW5zX2ludGVybmFsX2xpbmsodXNlcl9pbnB1dCkpIHtcbiAgICAgIHRoaXMuY2hhdC5nZXRfcmVzcG9uc2Vfd2l0aF9ub3RlX2NvbnRleHQodXNlcl9pbnB1dCwgdGhpcyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIC8vIC8vIGZvciB0ZXN0aW5nIHB1cnBvc2VzXG4gICAgLy8gaWYodGhpcy5jaGF0LmNvbnRhaW5zX2ZvbGRlcl9yZWZlcmVuY2UodXNlcl9pbnB1dCkpIHtcbiAgICAvLyAgIGNvbnN0IGZvbGRlcnMgPSB0aGlzLmNoYXQuZ2V0X2ZvbGRlcl9yZWZlcmVuY2VzKHVzZXJfaW5wdXQpO1xuICAgIC8vICAgY29uc29sZS5sb2coZm9sZGVycyk7XG4gICAgLy8gICByZXR1cm47XG4gICAgLy8gfVxuICAgIC8vIGlmIGNvbnRhaW5zIHNlbGYgcmVmZXJlbnRpYWwga2V5d29yZHMgb3IgZm9sZGVyIHJlZmVyZW5jZVxuICAgIGlmKHRoaXMuY29udGFpbnNfc2VsZl9yZWZlcmVudGlhbF9rZXl3b3Jkcyh1c2VyX2lucHV0KSB8fCB0aGlzLmNoYXQuY29udGFpbnNfZm9sZGVyX3JlZmVyZW5jZSh1c2VyX2lucHV0KSkge1xuICAgICAgLy8gZ2V0IGh5ZGVcbiAgICAgIGNvbnN0IGNvbnRleHQgPSBhd2FpdCB0aGlzLmdldF9jb250ZXh0X2h5ZGUodXNlcl9pbnB1dCk7XG4gICAgICAvLyBnZXQgdXNlciBpbnB1dCB3aXRoIGFkZGVkIGNvbnRleHRcbiAgICAgIC8vIGNvbnN0IGNvbnRleHRfaW5wdXQgPSB0aGlzLmJ1aWxkX2NvbnRleHRfaW5wdXQoY29udGV4dCk7XG4gICAgICAvLyBjb25zb2xlLmxvZyhjb250ZXh0X2lucHV0KTtcbiAgICAgIGNvbnN0IGNoYXRtbCA9IFtcbiAgICAgICAge1xuICAgICAgICAgIHJvbGU6IFwic3lzdGVtXCIsXG4gICAgICAgICAgLy8gY29udGVudDogY29udGV4dF9pbnB1dFxuICAgICAgICAgIGNvbnRlbnQ6IGNvbnRleHRcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIHJvbGU6IFwidXNlclwiLFxuICAgICAgICAgIGNvbnRlbnQ6IHVzZXJfaW5wdXRcbiAgICAgICAgfVxuICAgICAgXTtcbiAgICAgIHRoaXMucmVxdWVzdF9jaGF0Z3B0X2NvbXBsZXRpb24oe21lc3NhZ2VzOiBjaGF0bWwsIHRlbXBlcmF0dXJlOiAwfSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIC8vIGNvbXBsZXRpb24gd2l0aG91dCBhbnkgc3BlY2lmaWMgY29udGV4dFxuICAgIHRoaXMucmVxdWVzdF9jaGF0Z3B0X2NvbXBsZXRpb24oKTtcbiAgfVxuICBcbiAgYXN5bmMgcmVuZGVyX2RvdGRvdGRvdCgpIHtcbiAgICBpZiAodGhpcy5kb3Rkb3Rkb3RfaW50ZXJ2YWwpXG4gICAgICBjbGVhckludGVydmFsKHRoaXMuZG90ZG90ZG90X2ludGVydmFsKTtcbiAgICBhd2FpdCB0aGlzLnJlbmRlcl9tZXNzYWdlKFwiLi4uXCIsIFwiYXNzaXN0YW50XCIpO1xuICAgIC8vIGlmIGlzICcuLi4nLCB0aGVuIGluaXRpYXRlIGludGVydmFsIHRvIGNoYW5nZSB0byAnLicgYW5kIHRoZW4gdG8gJy4uJyBhbmQgdGhlbiB0byAnLi4uJ1xuICAgIGxldCBkb3RzID0gMDtcbiAgICB0aGlzLmFjdGl2ZV9lbG0uaW5uZXJIVE1MID0gJy4uLic7XG4gICAgdGhpcy5kb3Rkb3Rkb3RfaW50ZXJ2YWwgPSBzZXRJbnRlcnZhbCgoKSA9PiB7XG4gICAgICBkb3RzKys7XG4gICAgICBpZiAoZG90cyA+IDMpXG4gICAgICAgIGRvdHMgPSAxO1xuICAgICAgdGhpcy5hY3RpdmVfZWxtLmlubmVySFRNTCA9ICcuJy5yZXBlYXQoZG90cyk7XG4gICAgfSwgNTAwKTtcbiAgICAvLyB3YWl0IDIgc2Vjb25kcyBmb3IgdGVzdGluZ1xuICAgIC8vIGF3YWl0IG5ldyBQcm9taXNlKHIgPT4gc2V0VGltZW91dChyLCAyMDAwKSk7XG4gIH1cblxuICBzZXRfc3RyZWFtaW5nX3V4KCkge1xuICAgIHRoaXMucHJldmVudF9pbnB1dCA9IHRydWU7XG4gICAgLy8gaGlkZSBzZW5kIGJ1dHRvblxuICAgIGlmKGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwic2Mtc2VuZC1idXR0b25cIikpXG4gICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcInNjLXNlbmQtYnV0dG9uXCIpLnN0eWxlLmRpc3BsYXkgPSBcIm5vbmVcIjtcbiAgICAvLyBzaG93IGFib3J0IGJ1dHRvblxuICAgIGlmKGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwic2MtYWJvcnQtYnV0dG9uXCIpKVxuICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJzYy1hYm9ydC1idXR0b25cIikuc3R5bGUuZGlzcGxheSA9IFwiYmxvY2tcIjtcbiAgfVxuICB1bnNldF9zdHJlYW1pbmdfdXgoKSB7XG4gICAgdGhpcy5wcmV2ZW50X2lucHV0ID0gZmFsc2U7XG4gICAgLy8gc2hvdyBzZW5kIGJ1dHRvbiwgcmVtb3ZlIGRpc3BsYXkgbm9uZVxuICAgIGlmKGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwic2Mtc2VuZC1idXR0b25cIikpXG4gICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcInNjLXNlbmQtYnV0dG9uXCIpLnN0eWxlLmRpc3BsYXkgPSBcIlwiO1xuICAgIC8vIGhpZGUgYWJvcnQgYnV0dG9uXG4gICAgaWYoZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJzYy1hYm9ydC1idXR0b25cIikpXG4gICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcInNjLWFib3J0LWJ1dHRvblwiKS5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCI7XG4gIH1cblxuXG4gIC8vIGNoZWNrIGlmIGluY2x1ZGVzIGtleXdvcmRzIHJlZmVycmluZyB0byBvbmUncyBvd24gbm90ZXNcbiAgY29udGFpbnNfc2VsZl9yZWZlcmVudGlhbF9rZXl3b3Jkcyh1c2VyX2lucHV0KSB7XG4gICAgY29uc3QgbWF0Y2hlcyA9IHVzZXJfaW5wdXQubWF0Y2godGhpcy5wbHVnaW4uc2VsZl9yZWZfa3dfcmVnZXgpO1xuICAgIGlmKG1hdGNoZXMpIHJldHVybiB0cnVlO1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIC8vIHJlbmRlciBtZXNzYWdlXG4gIGFzeW5jIHJlbmRlcl9tZXNzYWdlKG1lc3NhZ2UsIGZyb209XCJhc3Npc3RhbnRcIiwgYXBwZW5kX2xhc3Q9ZmFsc2UpIHtcbiAgICAvLyBpZiBkb3Rkb3Rkb3QgaW50ZXJ2YWwgaXMgc2V0LCB0aGVuIGNsZWFyIGl0XG4gICAgaWYodGhpcy5kb3Rkb3Rkb3RfaW50ZXJ2YWwpIHtcbiAgICAgIGNsZWFySW50ZXJ2YWwodGhpcy5kb3Rkb3Rkb3RfaW50ZXJ2YWwpO1xuICAgICAgdGhpcy5kb3Rkb3Rkb3RfaW50ZXJ2YWwgPSBudWxsO1xuICAgICAgLy8gY2xlYXIgbGFzdCBtZXNzYWdlXG4gICAgICB0aGlzLmFjdGl2ZV9lbG0uaW5uZXJIVE1MID0gJyc7XG4gICAgfVxuICAgIGlmKGFwcGVuZF9sYXN0KSB7XG4gICAgICB0aGlzLmN1cnJlbnRfbWVzc2FnZV9yYXcgKz0gbWVzc2FnZTtcbiAgICAgIGlmKG1lc3NhZ2UuaW5kZXhPZignXFxuJykgPT09IC0xKSB7XG4gICAgICAgIHRoaXMuYWN0aXZlX2VsbS5pbm5lckhUTUwgKz0gbWVzc2FnZTtcbiAgICAgIH1lbHNle1xuICAgICAgICB0aGlzLmFjdGl2ZV9lbG0uaW5uZXJIVE1MID0gJyc7XG4gICAgICAgIC8vIGFwcGVuZCB0byBsYXN0IG1lc3NhZ2VcbiAgICAgICAgYXdhaXQgT2JzaWRpYW4uTWFya2Rvd25SZW5kZXJlci5yZW5kZXJNYXJrZG93bih0aGlzLmN1cnJlbnRfbWVzc2FnZV9yYXcsIHRoaXMuYWN0aXZlX2VsbSwgJz9uby1kYXRhdmlldycsIG5ldyBPYnNpZGlhbi5Db21wb25lbnQoKSk7XG4gICAgICB9XG4gICAgfWVsc2V7XG4gICAgICB0aGlzLmN1cnJlbnRfbWVzc2FnZV9yYXcgPSAnJztcbiAgICAgIGlmKCh0aGlzLmNoYXQudGhyZWFkLmxlbmd0aCA9PT0gMCkgfHwgKHRoaXMubGFzdF9mcm9tICE9PSBmcm9tKSkge1xuICAgICAgICAvLyBjcmVhdGUgbWVzc2FnZVxuICAgICAgICB0aGlzLm5ld19tZXNzc2FnZV9idWJibGUoZnJvbSk7XG4gICAgICB9XG4gICAgICAvLyBzZXQgbWVzc2FnZSB0ZXh0XG4gICAgICB0aGlzLmFjdGl2ZV9lbG0uaW5uZXJIVE1MID0gJyc7XG4gICAgICBhd2FpdCBPYnNpZGlhbi5NYXJrZG93blJlbmRlcmVyLnJlbmRlck1hcmtkb3duKG1lc3NhZ2UsIHRoaXMuYWN0aXZlX2VsbSwgJz9uby1kYXRhdmlldycsIG5ldyBPYnNpZGlhbi5Db21wb25lbnQoKSk7XG4gICAgICAvLyBnZXQgbGlua3NcbiAgICAgIHRoaXMuaGFuZGxlX2xpbmtzX2luX21lc3NhZ2UoKTtcbiAgICAgIC8vIHJlbmRlciBidXR0b24ocylcbiAgICAgIHRoaXMucmVuZGVyX21lc3NhZ2VfYWN0aW9uX2J1dHRvbnMobWVzc2FnZSk7XG4gICAgfVxuICAgIC8vIHNjcm9sbCB0byBib3R0b21cbiAgICB0aGlzLm1lc3NhZ2VfY29udGFpbmVyLnNjcm9sbFRvcCA9IHRoaXMubWVzc2FnZV9jb250YWluZXIuc2Nyb2xsSGVpZ2h0O1xuICB9XG4gIHJlbmRlcl9tZXNzYWdlX2FjdGlvbl9idXR0b25zKG1lc3NhZ2UpIHtcbiAgICBpZiAodGhpcy5jaGF0LmNvbnRleHQgJiYgdGhpcy5jaGF0Lmh5ZCkge1xuICAgICAgLy8gcmVuZGVyIGJ1dHRvbiB0byBjb3B5IGh5ZCBpbiBzbWFydC1jb25uZWN0aW9ucyBjb2RlIGJsb2NrXG4gICAgICBjb25zdCBjb250ZXh0X3ZpZXcgPSB0aGlzLmFjdGl2ZV9lbG0uY3JlYXRlRWwoXCJzcGFuXCIsIHtcbiAgICAgICAgY2xzOiBcInNjLW1zZy1idXR0b25cIixcbiAgICAgICAgYXR0cjoge1xuICAgICAgICAgIHRpdGxlOiBcIkNvcHkgY29udGV4dCB0byBjbGlwYm9hcmRcIiAvKiB0b29sdGlwICovXG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgICAgY29uc3QgdGhpc19oeWQgPSB0aGlzLmNoYXQuaHlkO1xuICAgICAgT2JzaWRpYW4uc2V0SWNvbihjb250ZXh0X3ZpZXcsIFwiZXllXCIpO1xuICAgICAgY29udGV4dF92aWV3LmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiB7XG4gICAgICAgIC8vIGNvcHkgdG8gY2xpcGJvYXJkXG4gICAgICAgIG5hdmlnYXRvci5jbGlwYm9hcmQud3JpdGVUZXh0KFwiYGBgc21hcnQtY29ubmVjdGlvbnNcXG5cIiArIHRoaXNfaHlkICsgXCJcXG5gYGBcXG5cIik7XG4gICAgICAgIG5ldyBPYnNpZGlhbi5Ob3RpY2UoXCJbU21hcnQgQ29ubmVjdGlvbnNdIENvbnRleHQgY29kZSBibG9jayBjb3BpZWQgdG8gY2xpcGJvYXJkXCIpO1xuICAgICAgfSk7XG4gICAgfVxuICAgIGlmKHRoaXMuY2hhdC5jb250ZXh0KSB7XG4gICAgICAvLyByZW5kZXIgY29weSBjb250ZXh0IGJ1dHRvblxuICAgICAgY29uc3QgY29weV9wcm9tcHRfYnV0dG9uID0gdGhpcy5hY3RpdmVfZWxtLmNyZWF0ZUVsKFwic3BhblwiLCB7XG4gICAgICAgIGNsczogXCJzYy1tc2ctYnV0dG9uXCIsXG4gICAgICAgIGF0dHI6IHtcbiAgICAgICAgICB0aXRsZTogXCJDb3B5IHByb21wdCB0byBjbGlwYm9hcmRcIiAvKiB0b29sdGlwICovXG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgICAgY29uc3QgdGhpc19jb250ZXh0ID0gdGhpcy5jaGF0LmNvbnRleHQucmVwbGFjZSgvXFxgXFxgXFxgL2csIFwiXFx0YGBgXCIpLnRyaW1MZWZ0KCk7XG4gICAgICBPYnNpZGlhbi5zZXRJY29uKGNvcHlfcHJvbXB0X2J1dHRvbiwgXCJmaWxlc1wiKTtcbiAgICAgIGNvcHlfcHJvbXB0X2J1dHRvbi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4ge1xuICAgICAgICAvLyBjb3B5IHRvIGNsaXBib2FyZFxuICAgICAgICBuYXZpZ2F0b3IuY2xpcGJvYXJkLndyaXRlVGV4dChcImBgYHByb21wdC1jb250ZXh0XFxuXCIgKyB0aGlzX2NvbnRleHQgKyBcIlxcbmBgYFxcblwiKTtcbiAgICAgICAgbmV3IE9ic2lkaWFuLk5vdGljZShcIltTbWFydCBDb25uZWN0aW9uc10gQ29udGV4dCBjb3BpZWQgdG8gY2xpcGJvYXJkXCIpO1xuICAgICAgfSk7XG4gICAgfVxuICAgIC8vIHJlbmRlciBjb3B5IGJ1dHRvblxuICAgIGNvbnN0IGNvcHlfYnV0dG9uID0gdGhpcy5hY3RpdmVfZWxtLmNyZWF0ZUVsKFwic3BhblwiLCB7XG4gICAgICBjbHM6IFwic2MtbXNnLWJ1dHRvblwiLFxuICAgICAgYXR0cjoge1xuICAgICAgICB0aXRsZTogXCJDb3B5IG1lc3NhZ2UgdG8gY2xpcGJvYXJkXCIgLyogdG9vbHRpcCAqL1xuICAgICAgfVxuICAgIH0pO1xuICAgIE9ic2lkaWFuLnNldEljb24oY29weV9idXR0b24sIFwiY29weVwiKTtcbiAgICBjb3B5X2J1dHRvbi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4ge1xuICAgICAgLy8gY29weSBtZXNzYWdlIHRvIGNsaXBib2FyZFxuICAgICAgbmF2aWdhdG9yLmNsaXBib2FyZC53cml0ZVRleHQobWVzc2FnZS50cmltTGVmdCgpKTtcbiAgICAgIG5ldyBPYnNpZGlhbi5Ob3RpY2UoXCJbU21hcnQgQ29ubmVjdGlvbnNdIE1lc3NhZ2UgY29waWVkIHRvIGNsaXBib2FyZFwiKTtcbiAgICB9KTtcbiAgfVxuXG4gIGhhbmRsZV9saW5rc19pbl9tZXNzYWdlKCkge1xuICAgIGNvbnN0IGxpbmtzID0gdGhpcy5hY3RpdmVfZWxtLnF1ZXJ5U2VsZWN0b3JBbGwoXCJhXCIpO1xuICAgIC8vIGlmIHRoaXMgYWN0aXZlIGVsZW1lbnQgY29udGFpbnMgYSBsaW5rXG4gICAgaWYgKGxpbmtzLmxlbmd0aCA+IDApIHtcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGlua3MubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgY29uc3QgbGluayA9IGxpbmtzW2ldO1xuICAgICAgICBjb25zdCBsaW5rX3RleHQgPSBsaW5rLmdldEF0dHJpYnV0ZShcImRhdGEtaHJlZlwiKTtcbiAgICAgICAgLy8gdHJpZ2dlciBob3ZlciBldmVudCBvbiBsaW5rXG4gICAgICAgIGxpbmsuYWRkRXZlbnRMaXN0ZW5lcihcIm1vdXNlb3ZlclwiLCAoZXZlbnQpID0+IHtcbiAgICAgICAgICB0aGlzLmFwcC53b3Jrc3BhY2UudHJpZ2dlcihcImhvdmVyLWxpbmtcIiwge1xuICAgICAgICAgICAgZXZlbnQsXG4gICAgICAgICAgICBzb3VyY2U6IFNNQVJUX0NPTk5FQ1RJT05TX0NIQVRfVklFV19UWVBFLFxuICAgICAgICAgICAgaG92ZXJQYXJlbnQ6IGxpbmsucGFyZW50RWxlbWVudCxcbiAgICAgICAgICAgIHRhcmdldEVsOiBsaW5rLFxuICAgICAgICAgICAgLy8gZXh0cmFjdCBsaW5rIHRleHQgZnJvbSBhLmRhdGEtaHJlZlxuICAgICAgICAgICAgbGlua3RleHQ6IGxpbmtfdGV4dFxuICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICAgICAgLy8gdHJpZ2dlciBvcGVuIGxpbmsgZXZlbnQgb24gbGlua1xuICAgICAgICBsaW5rLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoZXZlbnQpID0+IHtcbiAgICAgICAgICBjb25zdCBsaW5rX3RmaWxlID0gdGhpcy5hcHAubWV0YWRhdGFDYWNoZS5nZXRGaXJzdExpbmtwYXRoRGVzdChsaW5rX3RleHQsIFwiL1wiKTtcbiAgICAgICAgICAvLyBwcm9wZXJseSBoYW5kbGUgaWYgdGhlIG1ldGEvY3RybCBrZXkgaXMgcHJlc3NlZFxuICAgICAgICAgIGNvbnN0IG1vZCA9IE9ic2lkaWFuLktleW1hcC5pc01vZEV2ZW50KGV2ZW50KTtcbiAgICAgICAgICAvLyBnZXQgbW9zdCByZWNlbnQgbGVhZlxuICAgICAgICAgIGxldCBsZWFmID0gdGhpcy5hcHAud29ya3NwYWNlLmdldExlYWYobW9kKTtcbiAgICAgICAgICBsZWFmLm9wZW5GaWxlKGxpbmtfdGZpbGUpO1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBuZXdfbWVzc3NhZ2VfYnViYmxlKGZyb20pIHtcbiAgICBsZXQgbWVzc2FnZV9lbCA9IHRoaXMubWVzc2FnZV9jb250YWluZXIuY3JlYXRlRGl2KGBzYy1tZXNzYWdlICR7ZnJvbX1gKTtcbiAgICAvLyBjcmVhdGUgbWVzc2FnZSBjb250ZW50XG4gICAgdGhpcy5hY3RpdmVfZWxtID0gbWVzc2FnZV9lbC5jcmVhdGVEaXYoXCJzYy1tZXNzYWdlLWNvbnRlbnRcIik7XG4gICAgLy8gc2V0IGxhc3QgZnJvbVxuICAgIHRoaXMubGFzdF9mcm9tID0gZnJvbTtcbiAgfVxuXG4gIGFzeW5jIHJlcXVlc3RfY2hhdGdwdF9jb21wbGV0aW9uKG9wdHM9e30pIHtcbiAgICBjb25zdCBjaGF0X21sID0gb3B0cy5tZXNzYWdlcyB8fCBvcHRzLmNoYXRfbWwgfHwgdGhpcy5jaGF0LnByZXBhcmVfY2hhdF9tbCgpO1xuICAgIGNvbnNvbGUubG9nKFwiY2hhdF9tbFwiLCBjaGF0X21sKTtcbiAgICBjb25zdCBtYXhfdG90YWxfdG9rZW5zID0gTWF0aC5yb3VuZChnZXRfbWF4X2NoYXJzKHRoaXMucGx1Z2luLnNldHRpbmdzLnNtYXJ0X2NoYXRfbW9kZWwpIC8gNCk7XG4gICAgY29uc29sZS5sb2coXCJtYXhfdG90YWxfdG9rZW5zXCIsIG1heF90b3RhbF90b2tlbnMpO1xuICAgIGNvbnN0IGN1cnJfdG9rZW5fZXN0ID0gTWF0aC5yb3VuZChKU09OLnN0cmluZ2lmeShjaGF0X21sKS5sZW5ndGggLyAzKTtcbiAgICBjb25zb2xlLmxvZyhcImN1cnJfdG9rZW5fZXN0XCIsIGN1cnJfdG9rZW5fZXN0KTtcbiAgICBsZXQgbWF4X2F2YWlsYWJsZV90b2tlbnMgPSBtYXhfdG90YWxfdG9rZW5zIC0gY3Vycl90b2tlbl9lc3Q7XG4gICAgLy8gaWYgbWF4X2F2YWlsYWJsZV90b2tlbnMgaXMgbGVzcyB0aGFuIDAsIHNldCB0byAyMDBcbiAgICBpZihtYXhfYXZhaWxhYmxlX3Rva2VucyA8IDApIG1heF9hdmFpbGFibGVfdG9rZW5zID0gMjAwO1xuICAgIGVsc2UgaWYobWF4X2F2YWlsYWJsZV90b2tlbnMgPiA0MDk2KSBtYXhfYXZhaWxhYmxlX3Rva2VucyA9IDQwOTY7XG4gICAgY29uc29sZS5sb2coXCJtYXhfYXZhaWxhYmxlX3Rva2Vuc1wiLCBtYXhfYXZhaWxhYmxlX3Rva2Vucyk7XG4gICAgb3B0cyA9IHtcbiAgICAgIG1vZGVsOiB0aGlzLnBsdWdpbi5zZXR0aW5ncy5zbWFydF9jaGF0X21vZGVsLFxuICAgICAgbWVzc2FnZXM6IGNoYXRfbWwsXG4gICAgICAvLyBtYXhfdG9rZW5zOiAyNTAsXG4gICAgICBtYXhfdG9rZW5zOiBtYXhfYXZhaWxhYmxlX3Rva2VucyxcbiAgICAgIHRlbXBlcmF0dXJlOiAwLjMsXG4gICAgICB0b3BfcDogMSxcbiAgICAgIHByZXNlbmNlX3BlbmFsdHk6IDAsXG4gICAgICBmcmVxdWVuY3lfcGVuYWx0eTogMCxcbiAgICAgIHN0cmVhbTogdHJ1ZSxcbiAgICAgIHN0b3A6IG51bGwsXG4gICAgICBuOiAxLFxuICAgICAgLy8gbG9naXRfYmlhczogbG9naXRfYmlhcyxcbiAgICAgIC4uLm9wdHNcbiAgICB9XG4gICAgLy8gY29uc29sZS5sb2cob3B0cy5tZXNzYWdlcyk7XG4gICAgaWYob3B0cy5zdHJlYW0pIHtcbiAgICAgIGNvbnN0IGZ1bGxfc3RyID0gYXdhaXQgbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgIC8vIGNvbnNvbGUubG9nKFwic3RyZWFtXCIsIG9wdHMpO1xuICAgICAgICAgIGNvbnN0IHVybCA9IFwiaHR0cHM6Ly9hcGkub3BlbmFpLmNvbS92MS9jaGF0L2NvbXBsZXRpb25zXCI7XG4gICAgICAgICAgdGhpcy5hY3RpdmVfc3RyZWFtID0gbmV3IFNjU3RyZWFtZXIodXJsLCB7XG4gICAgICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgICAgIFwiQ29udGVudC1UeXBlXCI6IFwiYXBwbGljYXRpb24vanNvblwiLFxuICAgICAgICAgICAgICBBdXRob3JpemF0aW9uOiBgQmVhcmVyICR7dGhpcy5wbHVnaW4uc2V0dGluZ3MuYXBpX2tleX1gXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgbWV0aG9kOiBcIlBPU1RcIixcbiAgICAgICAgICAgIHBheWxvYWQ6IEpTT04uc3RyaW5naWZ5KG9wdHMpXG4gICAgICAgICAgfSk7XG4gICAgICAgICAgbGV0IHR4dCA9IFwiXCI7XG4gICAgICAgICAgdGhpcy5hY3RpdmVfc3RyZWFtLmFkZEV2ZW50TGlzdGVuZXIoXCJtZXNzYWdlXCIsIChlKSA9PiB7XG4gICAgICAgICAgICBpZiAoZS5kYXRhICE9IFwiW0RPTkVdXCIpIHtcbiAgICAgICAgICAgICAgY29uc3QgcGF5bG9hZCA9IEpTT04ucGFyc2UoZS5kYXRhKTtcbiAgICAgICAgICAgICAgY29uc3QgdGV4dCA9IHBheWxvYWQuY2hvaWNlc1swXS5kZWx0YS5jb250ZW50O1xuICAgICAgICAgICAgICBpZiAoIXRleHQpIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgdHh0ICs9IHRleHQ7XG4gICAgICAgICAgICAgIHRoaXMucmVuZGVyX21lc3NhZ2UodGV4dCwgXCJhc3Npc3RhbnRcIiwgdHJ1ZSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICB0aGlzLmVuZF9zdHJlYW0oKTtcbiAgICAgICAgICAgICAgcmVzb2x2ZSh0eHQpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pO1xuICAgICAgICAgIHRoaXMuYWN0aXZlX3N0cmVhbS5hZGRFdmVudExpc3RlbmVyKFwicmVhZHlzdGF0ZWNoYW5nZVwiLCAoZSkgPT4ge1xuICAgICAgICAgICAgaWYgKGUucmVhZHlTdGF0ZSA+PSAyKSB7XG4gICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiUmVhZHlTdGF0ZTogXCIgKyBlLnJlYWR5U3RhdGUpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pO1xuICAgICAgICAgIHRoaXMuYWN0aXZlX3N0cmVhbS5hZGRFdmVudExpc3RlbmVyKFwiZXJyb3JcIiwgKGUpID0+IHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoZSk7XG4gICAgICAgICAgICBuZXcgT2JzaWRpYW4uTm90aWNlKFwiU21hcnQgQ29ubmVjdGlvbnMgRXJyb3IgU3RyZWFtaW5nIFJlc3BvbnNlLiBTZWUgY29uc29sZSBmb3IgZGV0YWlscy5cIik7XG4gICAgICAgICAgICB0aGlzLnJlbmRlcl9tZXNzYWdlKFwiKkFQSSBFcnJvci4gU2VlIGNvbnNvbGUgbG9ncyBmb3IgZGV0YWlscy4qXCIsIFwiYXNzaXN0YW50XCIpO1xuICAgICAgICAgICAgdGhpcy5lbmRfc3RyZWFtKCk7XG4gICAgICAgICAgICByZWplY3QoZSk7XG4gICAgICAgICAgfSk7XG4gICAgICAgICAgdGhpcy5hY3RpdmVfc3RyZWFtLnN0cmVhbSgpO1xuICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICBjb25zb2xlLmVycm9yKGVycik7XG4gICAgICAgICAgbmV3IE9ic2lkaWFuLk5vdGljZShcIlNtYXJ0IENvbm5lY3Rpb25zIEVycm9yIFN0cmVhbWluZyBSZXNwb25zZS4gU2VlIGNvbnNvbGUgZm9yIGRldGFpbHMuXCIpO1xuICAgICAgICAgIHRoaXMuZW5kX3N0cmVhbSgpO1xuICAgICAgICAgIHJlamVjdChlcnIpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICAgIC8vIGNvbnNvbGUubG9nKGZ1bGxfc3RyKTtcbiAgICAgIGF3YWl0IHRoaXMucmVuZGVyX21lc3NhZ2UoZnVsbF9zdHIsIFwiYXNzaXN0YW50XCIpO1xuICAgICAgdGhpcy5jaGF0Lm5ld19tZXNzYWdlX2luX3RocmVhZCh7XG4gICAgICAgIHJvbGU6IFwiYXNzaXN0YW50XCIsXG4gICAgICAgIGNvbnRlbnQ6IGZ1bGxfc3RyXG4gICAgICB9KTtcbiAgICAgIHJldHVybjtcbiAgICB9ZWxzZXtcbiAgICAgIHRyeXtcbiAgICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCAoMCwgT2JzaWRpYW4ucmVxdWVzdFVybCkoe1xuICAgICAgICAgIHVybDogYGh0dHBzOi8vYXBpLm9wZW5haS5jb20vdjEvY2hhdC9jb21wbGV0aW9uc2AsXG4gICAgICAgICAgbWV0aG9kOiBcIlBPU1RcIixcbiAgICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgICBBdXRob3JpemF0aW9uOiBgQmVhcmVyICR7dGhpcy5wbHVnaW4uc2V0dGluZ3MuYXBpX2tleX1gLFxuICAgICAgICAgICAgXCJDb250ZW50LVR5cGVcIjogXCJhcHBsaWNhdGlvbi9qc29uXCJcbiAgICAgICAgICB9LFxuICAgICAgICAgIGNvbnRlbnRUeXBlOiBcImFwcGxpY2F0aW9uL2pzb25cIixcbiAgICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeShvcHRzKSxcbiAgICAgICAgICB0aHJvdzogZmFsc2VcbiAgICAgICAgfSk7XG4gICAgICAgIC8vIGNvbnNvbGUubG9nKHJlc3BvbnNlKTtcbiAgICAgICAgcmV0dXJuIEpTT04ucGFyc2UocmVzcG9uc2UudGV4dCkuY2hvaWNlc1swXS5tZXNzYWdlLmNvbnRlbnQ7XG4gICAgICB9Y2F0Y2goZXJyKXtcbiAgICAgICAgbmV3IE9ic2lkaWFuLk5vdGljZShgU21hcnQgQ29ubmVjdGlvbnMgQVBJIEVycm9yIDo6ICR7ZXJyfWApO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGVuZF9zdHJlYW0oKSB7XG4gICAgaWYodGhpcy5hY3RpdmVfc3RyZWFtKXtcbiAgICAgIHRoaXMuYWN0aXZlX3N0cmVhbS5jbG9zZSgpO1xuICAgICAgdGhpcy5hY3RpdmVfc3RyZWFtID0gbnVsbDtcbiAgICB9XG4gICAgdGhpcy51bnNldF9zdHJlYW1pbmdfdXgoKTtcbiAgICBpZih0aGlzLmRvdGRvdGRvdF9pbnRlcnZhbCl7XG4gICAgICBjbGVhckludGVydmFsKHRoaXMuZG90ZG90ZG90X2ludGVydmFsKTtcbiAgICAgIHRoaXMuZG90ZG90ZG90X2ludGVydmFsID0gbnVsbDtcbiAgICAgIC8vIHJlbW92ZSBwYXJlbnQgb2YgYWN0aXZlX2VsbVxuICAgICAgdGhpcy5hY3RpdmVfZWxtLnBhcmVudEVsZW1lbnQucmVtb3ZlKCk7XG4gICAgICB0aGlzLmFjdGl2ZV9lbG0gPSBudWxsO1xuICAgIH1cbiAgfVxuXG4gIGFzeW5jIGdldF9jb250ZXh0X2h5ZGUodXNlcl9pbnB1dCkge1xuICAgIHRoaXMuY2hhdC5yZXNldF9jb250ZXh0KCk7XG4gICAgLy8gY291bnQgY3VycmVudCBjaGF0IG1sIG1lc3NhZ2VzIHRvIGRldGVybWluZSAncXVlc3Rpb24nIG9yICdjaGF0IGxvZycgd29yZGluZ1xuICAgIGNvbnN0IGh5ZF9pbnB1dCA9IGBBbnRpY2lwYXRlIHdoYXQgdGhlIHVzZXIgaXMgc2Vla2luZy4gUmVzcG9uZCBpbiB0aGUgZm9ybSBvZiBhIGh5cG90aGV0aWNhbCBub3RlIHdyaXR0ZW4gYnkgdGhlIHVzZXIuIFRoZSBub3RlIG1heSBjb250YWluIHN0YXRlbWVudHMgYXMgcGFyYWdyYXBocywgbGlzdHMsIG9yIGNoZWNrbGlzdHMgaW4gbWFya2Rvd24gZm9ybWF0IHdpdGggbm8gaGVhZGluZ3MuIFBsZWFzZSByZXNwb25kIHdpdGggb25lIGh5cG90aGV0aWNhbCBub3RlIGFuZCBhYnN0YWluIGZyb20gYW55IG90aGVyIGNvbW1lbnRhcnkuIFVzZSB0aGUgZm9ybWF0OiBQQVJFTlQgRk9MREVSIE5BTUUgPiBDSElMRCBGT0xERVIgTkFNRSA+IEZJTEUgTkFNRSA+IEhFQURJTkcgMSA+IEhFQURJTkcgMiA+IEhFQURJTkcgMzogSFlQT1RIRVRJQ0FMIE5PVEUgQ09OVEVOVFMuYDtcbiAgICAvLyBjb21wbGV0ZVxuICAgIGNvbnN0IGNoYXRtbCA9IFtcbiAgICAgIHtcbiAgICAgICAgcm9sZTogXCJzeXN0ZW1cIixcbiAgICAgICAgY29udGVudDogaHlkX2lucHV0IFxuICAgICAgfSxcbiAgICAgIHtcbiAgICAgICAgcm9sZTogXCJ1c2VyXCIsXG4gICAgICAgIGNvbnRlbnQ6IHVzZXJfaW5wdXRcbiAgICAgIH1cbiAgICBdO1xuICAgIGNvbnN0IGh5ZCA9IGF3YWl0IHRoaXMucmVxdWVzdF9jaGF0Z3B0X2NvbXBsZXRpb24oe1xuICAgICAgbWVzc2FnZXM6IGNoYXRtbCxcbiAgICAgIHN0cmVhbTogZmFsc2UsXG4gICAgICB0ZW1wZXJhdHVyZTogMCxcbiAgICAgIG1heF90b2tlbnM6IDEzNyxcbiAgICB9KTtcbiAgICB0aGlzLmNoYXQuaHlkID0gaHlkO1xuICAgIC8vIGNvbnNvbGUubG9nKGh5ZCk7XG4gICAgbGV0IGZpbHRlciA9IHt9O1xuICAgIC8vIGlmIGNvbnRhaW5zIGZvbGRlciByZWZlcmVuY2UgcmVwcmVzZW50ZWQgYnkgL2ZvbGRlci9cbiAgICBpZih0aGlzLmNoYXQuY29udGFpbnNfZm9sZGVyX3JlZmVyZW5jZSh1c2VyX2lucHV0KSkge1xuICAgICAgLy8gZ2V0IGZvbGRlciByZWZlcmVuY2VzXG4gICAgICBjb25zdCBmb2xkZXJfcmVmcyA9IHRoaXMuY2hhdC5nZXRfZm9sZGVyX3JlZmVyZW5jZXModXNlcl9pbnB1dCk7XG4gICAgICAvLyBjb25zb2xlLmxvZyhmb2xkZXJfcmVmcyk7XG4gICAgICAvLyBpZiBmb2xkZXIgcmVmZXJlbmNlcyBhcmUgdmFsaWQgKHN0cmluZyBvciBhcnJheSBvZiBzdHJpbmdzKVxuICAgICAgaWYoZm9sZGVyX3JlZnMpe1xuICAgICAgICBmaWx0ZXIgPSB7XG4gICAgICAgICAgcGF0aF9iZWdpbnNfd2l0aDogZm9sZGVyX3JlZnNcbiAgICAgICAgfTtcbiAgICAgIH1cbiAgICB9XG4gICAgLy8gc2VhcmNoIGZvciBuZWFyZXN0IGJhc2VkIG9uIGh5ZFxuICAgIGxldCBuZWFyZXN0ID0gYXdhaXQgdGhpcy5wbHVnaW4uYXBpLnNlYXJjaChoeWQsIGZpbHRlcik7XG4gICAgY29uc29sZS5sb2coXCJuZWFyZXN0XCIsIG5lYXJlc3QubGVuZ3RoKTtcbiAgICBuZWFyZXN0ID0gdGhpcy5nZXRfbmVhcmVzdF91bnRpbF9uZXh0X2Rldl9leGNlZWRzX3N0ZF9kZXYobmVhcmVzdCk7XG4gICAgY29uc29sZS5sb2coXCJuZWFyZXN0IGFmdGVyIHN0ZCBkZXYgc2xpY2VcIiwgbmVhcmVzdC5sZW5ndGgpO1xuICAgIG5lYXJlc3QgPSB0aGlzLnNvcnRfYnlfbGVuX2FkanVzdGVkX3NpbWlsYXJpdHkobmVhcmVzdCk7XG4gICAgXG4gICAgcmV0dXJuIGF3YWl0IHRoaXMuZ2V0X2NvbnRleHRfZm9yX3Byb21wdChuZWFyZXN0KTtcbiAgfVxuICBcbiAgXG4gIHNvcnRfYnlfbGVuX2FkanVzdGVkX3NpbWlsYXJpdHkobmVhcmVzdCkge1xuICAgIC8vIHJlLXNvcnQgYnkgcXVvdGllbnQgb2Ygc2ltaWxhcml0eSBkaXZpZGVkIGJ5IGxlbiBERVNDXG4gICAgbmVhcmVzdCA9IG5lYXJlc3Quc29ydCgoYSwgYikgPT4ge1xuICAgICAgY29uc3QgYV9zY29yZSA9IGEuc2ltaWxhcml0eSAvIGEubGVuO1xuICAgICAgY29uc3QgYl9zY29yZSA9IGIuc2ltaWxhcml0eSAvIGIubGVuO1xuICAgICAgLy8gaWYgYSBpcyBncmVhdGVyIHRoYW4gYiwgcmV0dXJuIC0xXG4gICAgICBpZiAoYV9zY29yZSA+IGJfc2NvcmUpXG4gICAgICAgIHJldHVybiAtMTtcbiAgICAgIC8vIGlmIGEgaXMgbGVzcyB0aGFuIGIsIHJldHVybiAxXG4gICAgICBpZiAoYV9zY29yZSA8IGJfc2NvcmUpXG4gICAgICAgIHJldHVybiAxO1xuICAgICAgLy8gaWYgYSBpcyBlcXVhbCB0byBiLCByZXR1cm4gMFxuICAgICAgcmV0dXJuIDA7XG4gICAgfSk7XG4gICAgcmV0dXJuIG5lYXJlc3Q7XG4gIH1cblxuICBnZXRfbmVhcmVzdF91bnRpbF9uZXh0X2Rldl9leGNlZWRzX3N0ZF9kZXYobmVhcmVzdCkge1xuICAgIC8vIGdldCBzdGQgZGV2IG9mIHNpbWlsYXJpdHlcbiAgICBjb25zdCBzaW0gPSBuZWFyZXN0Lm1hcCgobikgPT4gbi5zaW1pbGFyaXR5KTtcbiAgICBjb25zdCBtZWFuID0gc2ltLnJlZHVjZSgoYSwgYikgPT4gYSArIGIpIC8gc2ltLmxlbmd0aDtcbiAgICBsZXQgc3RkX2RldiA9IE1hdGguc3FydChzaW0ubWFwKCh4KSA9PiBNYXRoLnBvdyh4IC0gbWVhbiwgMikpLnJlZHVjZSgoYSwgYikgPT4gYSArIGIpIC8gc2ltLmxlbmd0aCk7XG4gICAgLy8gc2xpY2Ugd2hlcmUgbmV4dCBpdGVtIGRldmlhdGlvbiBpcyBncmVhdGVyIHRoYW4gc3RkX2RldlxuICAgIGxldCBzbGljZV9pID0gMDtcbiAgICB3aGlsZSAoc2xpY2VfaSA8IG5lYXJlc3QubGVuZ3RoKSB7XG4gICAgICBjb25zdCBuZXh0ID0gbmVhcmVzdFtzbGljZV9pICsgMV07XG4gICAgICBpZiAobmV4dCkge1xuICAgICAgICBjb25zdCBuZXh0X2RldiA9IE1hdGguYWJzKG5leHQuc2ltaWxhcml0eSAtIG5lYXJlc3Rbc2xpY2VfaV0uc2ltaWxhcml0eSk7XG4gICAgICAgIGlmIChuZXh0X2RldiA+IHN0ZF9kZXYpIHtcbiAgICAgICAgICBpZihzbGljZV9pIDwgMykgc3RkX2RldiA9IHN0ZF9kZXYgKiAxLjU7XG4gICAgICAgICAgZWxzZSBicmVhaztcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgc2xpY2VfaSsrO1xuICAgIH1cbiAgICAvLyBzZWxlY3QgdG9wIHJlc3VsdHNcbiAgICBuZWFyZXN0ID0gbmVhcmVzdC5zbGljZSgwLCBzbGljZV9pKzEpO1xuICAgIHJldHVybiBuZWFyZXN0O1xuICB9XG4gIC8vIHRoaXMudGVzdF9nZXRfbmVhcmVzdF91bnRpbF9uZXh0X2Rldl9leGNlZWRzX3N0ZF9kZXYoKTtcbiAgLy8gLy8gdGVzdCBnZXRfbmVhcmVzdF91bnRpbF9uZXh0X2Rldl9leGNlZWRzX3N0ZF9kZXZcbiAgLy8gdGVzdF9nZXRfbmVhcmVzdF91bnRpbF9uZXh0X2Rldl9leGNlZWRzX3N0ZF9kZXYoKSB7XG4gIC8vICAgY29uc3QgbmVhcmVzdCA9IFt7c2ltaWxhcml0eTogMC45OX0sIHtzaW1pbGFyaXR5OiAwLjk4fSwge3NpbWlsYXJpdHk6IDAuOTd9LCB7c2ltaWxhcml0eTogMC45Nn0sIHtzaW1pbGFyaXR5OiAwLjk1fSwge3NpbWlsYXJpdHk6IDAuOTR9LCB7c2ltaWxhcml0eTogMC45M30sIHtzaW1pbGFyaXR5OiAwLjkyfSwge3NpbWlsYXJpdHk6IDAuOTF9LCB7c2ltaWxhcml0eTogMC45fSwge3NpbWlsYXJpdHk6IDAuNzl9LCB7c2ltaWxhcml0eTogMC43OH0sIHtzaW1pbGFyaXR5OiAwLjc3fSwge3NpbWlsYXJpdHk6IDAuNzZ9LCB7c2ltaWxhcml0eTogMC43NX0sIHtzaW1pbGFyaXR5OiAwLjc0fSwge3NpbWlsYXJpdHk6IDAuNzN9LCB7c2ltaWxhcml0eTogMC43Mn1dO1xuICAvLyAgIGNvbnN0IHJlc3VsdCA9IHRoaXMuZ2V0X25lYXJlc3RfdW50aWxfbmV4dF9kZXZfZXhjZWVkc19zdGRfZGV2KG5lYXJlc3QpO1xuICAvLyAgIGlmKHJlc3VsdC5sZW5ndGggIT09IDEwKXtcbiAgLy8gICAgIGNvbnNvbGUuZXJyb3IoXCJnZXRfbmVhcmVzdF91bnRpbF9uZXh0X2Rldl9leGNlZWRzX3N0ZF9kZXYgZmFpbGVkXCIsIHJlc3VsdCk7XG4gIC8vICAgfVxuICAvLyB9XG5cbiAgYXN5bmMgZ2V0X2NvbnRleHRfZm9yX3Byb21wdChuZWFyZXN0KSB7XG4gICAgbGV0IGNvbnRleHQgPSBbXTtcbiAgICBjb25zdCBNQVhfU09VUkNFUyA9ICh0aGlzLnBsdWdpbi5zZXR0aW5ncy5zbWFydF9jaGF0X21vZGVsID09PSAnZ3B0LTQtMTEwNi1wcmV2aWV3JykgPyA0MiA6IDIwO1xuICAgIGNvbnN0IE1BWF9DSEFSUyA9IGdldF9tYXhfY2hhcnModGhpcy5wbHVnaW4uc2V0dGluZ3Muc21hcnRfY2hhdF9tb2RlbCkgLyAyO1xuICAgIGxldCBjaGFyX2FjY3VtID0gMDtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IG5lYXJlc3QubGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmIChjb250ZXh0Lmxlbmd0aCA+PSBNQVhfU09VUkNFUylcbiAgICAgICAgYnJlYWs7XG4gICAgICBpZiAoY2hhcl9hY2N1bSA+PSBNQVhfQ0hBUlMpXG4gICAgICAgIGJyZWFrO1xuICAgICAgaWYgKHR5cGVvZiBuZWFyZXN0W2ldLmxpbmsgIT09ICdzdHJpbmcnKVxuICAgICAgICBjb250aW51ZTtcbiAgICAgIC8vIGdlbmVyYXRlIGJyZWFkY3J1bWJzXG4gICAgICBjb25zdCBicmVhZGNydW1icyA9IG5lYXJlc3RbaV0ubGluay5yZXBsYWNlKC8jL2csIFwiID4gXCIpLnJlcGxhY2UoXCIubWRcIiwgXCJcIikucmVwbGFjZSgvXFwvL2csIFwiID4gXCIpO1xuICAgICAgbGV0IG5ld19jb250ZXh0ID0gYCR7YnJlYWRjcnVtYnN9OlxcbmA7XG4gICAgICAvLyBnZXQgbWF4IGF2YWlsYWJsZSBjaGFycyB0byBhZGQgdG8gY29udGV4dFxuICAgICAgY29uc3QgbWF4X2F2YWlsYWJsZV9jaGFycyA9IE1BWF9DSEFSUyAtIGNoYXJfYWNjdW0gLSBuZXdfY29udGV4dC5sZW5ndGg7XG4gICAgICBpZiAobmVhcmVzdFtpXS5saW5rLmluZGV4T2YoXCIjXCIpICE9PSAtMSkgeyAvLyBpcyBibG9ja1xuICAgICAgICBuZXdfY29udGV4dCArPSBhd2FpdCB0aGlzLnBsdWdpbi5ibG9ja19yZXRyaWV2ZXIobmVhcmVzdFtpXS5saW5rLCB7IG1heF9jaGFyczogbWF4X2F2YWlsYWJsZV9jaGFycyB9KTtcbiAgICAgIH0gZWxzZSB7IC8vIGlzIGZpbGVcbiAgICAgICAgbmV3X2NvbnRleHQgKz0gYXdhaXQgdGhpcy5wbHVnaW4uZmlsZV9yZXRyaWV2ZXIobmVhcmVzdFtpXS5saW5rLCB7IG1heF9jaGFyczogbWF4X2F2YWlsYWJsZV9jaGFycyB9KTtcbiAgICAgIH1cbiAgICAgIC8vIGFkZCB0byBjaGFyX2FjY3VtXG4gICAgICBjaGFyX2FjY3VtICs9IG5ld19jb250ZXh0Lmxlbmd0aDtcbiAgICAgIC8vIGFkZCB0byBjb250ZXh0XG4gICAgICBjb250ZXh0LnB1c2goe1xuICAgICAgICBsaW5rOiBuZWFyZXN0W2ldLmxpbmssXG4gICAgICAgIHRleHQ6IG5ld19jb250ZXh0XG4gICAgICB9KTtcbiAgICB9XG4gICAgLy8gY29udGV4dCBzb3VyY2VzXG4gICAgY29uc29sZS5sb2coXCJjb250ZXh0IHNvdXJjZXM6IFwiICsgY29udGV4dC5sZW5ndGgpO1xuICAgIC8vIGNoYXJfYWNjdW0gZGl2aWRlZCBieSA0IGFuZCByb3VuZGVkIHRvIG5lYXJlc3QgaW50ZWdlciBmb3IgZXN0aW1hdGVkIHRva2Vuc1xuICAgIGNvbnNvbGUubG9nKFwidG90YWwgY29udGV4dCB0b2tlbnM6IH5cIiArIE1hdGgucm91bmQoY2hhcl9hY2N1bSAvIDMuNSkpO1xuICAgIC8vIGJ1aWxkIGNvbnRleHQgaW5wdXRcbiAgICB0aGlzLmNoYXQuY29udGV4dCA9IGBBbnRpY2lwYXRlIHRoZSB0eXBlIG9mIGFuc3dlciBkZXNpcmVkIGJ5IHRoZSB1c2VyLiBJbWFnaW5lIHRoZSBmb2xsb3dpbmcgJHtjb250ZXh0Lmxlbmd0aH0gbm90ZXMgd2VyZSB3cml0dGVuIGJ5IHRoZSB1c2VyIGFuZCBjb250YWluIGFsbCB0aGUgbmVjZXNzYXJ5IGluZm9ybWF0aW9uIHRvIGFuc3dlciB0aGUgdXNlcidzIHF1ZXN0aW9uLiBCZWdpbiByZXNwb25zZXMgd2l0aCBcIiR7U01BUlRfVFJBTlNMQVRJT05bdGhpcy5wbHVnaW4uc2V0dGluZ3MubGFuZ3VhZ2VdLnByb21wdH0uLi5cImA7XG4gICAgZm9yKGxldCBpID0gMDsgaSA8IGNvbnRleHQubGVuZ3RoOyBpKyspIHtcbiAgICAgIHRoaXMuY2hhdC5jb250ZXh0ICs9IGBcXG4tLS1CRUdJTiAjJHtpKzF9LS0tXFxuJHtjb250ZXh0W2ldLnRleHR9XFxuLS0tRU5EICMke2krMX0tLS1gO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5jaGF0LmNvbnRleHQ7XG4gIH1cblxuXG59XG5cbmZ1bmN0aW9uIGdldF9tYXhfY2hhcnMobW9kZWw9XCJncHQtMy41LXR1cmJvXCIpIHtcbiAgY29uc3QgTUFYX0NIQVJfTUFQID0ge1xuICAgIFwiZ3B0LTMuNS10dXJiby0xNmtcIjogNDgwMDAsXG4gICAgXCJncHQtNFwiOiAyNDAwMCxcbiAgICBcImdwdC0zLjUtdHVyYm9cIjogMTIwMDAsXG4gICAgXCJncHQtNC0xMTA2LXByZXZpZXdcIjogMjAwMDAwLFxuICB9O1xuICByZXR1cm4gTUFYX0NIQVJfTUFQW21vZGVsXTtcbn1cbi8qKlxuICogU21hcnRDb25uZWN0aW9uc0NoYXRNb2RlbFxuICogLS0tXG4gKiAtICd0aHJlYWQnIGZvcm1hdDogQXJyYXlbQXJyYXlbT2JqZWN0e3JvbGUsIGNvbnRlbnQsIGh5ZGV9XV1cbiAqICAtIFtUdXJuW3ZhcmlhdGlvbnt9XSwgVHVyblt2YXJpYXRpb257fSwgdmFyaWF0aW9ue31dLCAuLi5dXG4gKiAtIFNhdmVzIGluICd0aHJlYWQnIGZvcm1hdCB0byBKU09OIGZpbGUgaW4gLnNtYXJ0LWNvbm5lY3Rpb25zIGZvbGRlciB1c2luZyBjaGF0X2lkIGFzIGZpbGVuYW1lXG4gKiAtIExvYWRzIGNoYXQgaW4gJ3RocmVhZCcgZm9ybWF0IEFycmF5W0FycmF5W09iamVjdHtyb2xlLCBjb250ZW50LCBoeWRlfV1dIGZyb20gSlNPTiBmaWxlIGluIC5zbWFydC1jb25uZWN0aW9ucyBmb2xkZXJcbiAqIC0gcHJlcGFyZXMgY2hhdF9tbCByZXR1cm5zIGluICdDaGF0TUwnIGZvcm1hdCBcbiAqICAtIHN0cmlwcyBhbGwgYnV0IHJvbGUgYW5kIGNvbnRlbnQgcHJvcGVydGllcyBmcm9tIE9iamVjdCBpbiBDaGF0TUwgZm9ybWF0XG4gKiAtIENoYXRNTCBBcnJheVtPYmplY3R7cm9sZSwgY29udGVudH1dXG4gKiAgLSBbQ3VycmVudF9WYXJpYXRpb25fRm9yX1R1cm5fMXt9LCBDdXJyZW50X1ZhcmlhdGlvbl9Gb3JfVHVybl8ye30sIC4uLl1cbiAqL1xuY2xhc3MgU21hcnRDb25uZWN0aW9uc0NoYXRNb2RlbCB7XG4gIGNvbnN0cnVjdG9yKHBsdWdpbikge1xuICAgIHRoaXMuYXBwID0gcGx1Z2luLmFwcDtcbiAgICB0aGlzLnBsdWdpbiA9IHBsdWdpbjtcbiAgICB0aGlzLmNoYXRfaWQgPSBudWxsO1xuICAgIHRoaXMuY2hhdF9tbCA9IFtdO1xuICAgIHRoaXMuY29udGV4dCA9IG51bGw7XG4gICAgdGhpcy5oeWQgPSBudWxsO1xuICAgIHRoaXMudGhyZWFkID0gW107XG4gIH1cbiAgYXN5bmMgc2F2ZV9jaGF0KCkge1xuICAgIC8vIHJldHVybiBpZiB0aHJlYWQgaXMgZW1wdHlcbiAgICBpZiAodGhpcy50aHJlYWQubGVuZ3RoID09PSAwKSByZXR1cm47XG4gICAgLy8gc2F2ZSBjaGF0IHRvIGZpbGUgaW4gLnNtYXJ0LWNvbm5lY3Rpb25zIGZvbGRlclxuICAgIC8vIGNyZWF0ZSAuc21hcnQtY29ubmVjdGlvbnMvY2hhdHMvIGZvbGRlciBpZiBpdCBkb2Vzbid0IGV4aXN0XG4gICAgaWYgKCEoYXdhaXQgdGhpcy5hcHAudmF1bHQuYWRhcHRlci5leGlzdHMoXCIuc21hcnQtY29ubmVjdGlvbnMvY2hhdHNcIikpKSB7XG4gICAgICBhd2FpdCB0aGlzLmFwcC52YXVsdC5hZGFwdGVyLm1rZGlyKFwiLnNtYXJ0LWNvbm5lY3Rpb25zL2NoYXRzXCIpO1xuICAgIH1cbiAgICAvLyBpZiBjaGF0X2lkIGlzIG5vdCBzZXQsIHNldCBpdCB0byBVTlRJVExFRC0ke3VuaXggdGltZXN0YW1wfVxuICAgIGlmICghdGhpcy5jaGF0X2lkKSB7XG4gICAgICB0aGlzLmNoYXRfaWQgPSB0aGlzLm5hbWUoKSArIFwiXHUyMDE0XCIgKyB0aGlzLmdldF9maWxlX2RhdGVfc3RyaW5nKCk7XG4gICAgfVxuICAgIC8vIHZhbGlkYXRlIGNoYXRfaWQgaXMgc2V0IHRvIHZhbGlkIGZpbGVuYW1lIGNoYXJhY3RlcnMgKGxldHRlcnMsIG51bWJlcnMsIHVuZGVyc2NvcmVzLCBkYXNoZXMsIGVtIGRhc2gsIGFuZCBzcGFjZXMpXG4gICAgaWYgKCF0aGlzLmNoYXRfaWQubWF0Y2goL15bYS16QS1aMC05X1x1MjAxNFxcLSBdKyQvKSkge1xuICAgICAgY29uc29sZS5sb2coXCJJbnZhbGlkIGNoYXRfaWQ6IFwiICsgdGhpcy5jaGF0X2lkKTtcbiAgICAgIG5ldyBPYnNpZGlhbi5Ob3RpY2UoXCJbU21hcnQgQ29ubmVjdGlvbnNdIEZhaWxlZCB0byBzYXZlIGNoYXQuIEludmFsaWQgY2hhdF9pZDogJ1wiICsgdGhpcy5jaGF0X2lkICsgXCInXCIpO1xuICAgIH1cbiAgICAvLyBmaWxlbmFtZSBpcyBjaGF0X2lkXG4gICAgY29uc3QgY2hhdF9maWxlID0gdGhpcy5jaGF0X2lkICsgXCIuanNvblwiO1xuICAgIHRoaXMuYXBwLnZhdWx0LmFkYXB0ZXIud3JpdGUoXG4gICAgICBcIi5zbWFydC1jb25uZWN0aW9ucy9jaGF0cy9cIiArIGNoYXRfZmlsZSxcbiAgICAgIEpTT04uc3RyaW5naWZ5KHRoaXMudGhyZWFkLCBudWxsLCAyKVxuICAgICk7XG4gIH1cbiAgYXN5bmMgbG9hZF9jaGF0KGNoYXRfaWQpIHtcbiAgICB0aGlzLmNoYXRfaWQgPSBjaGF0X2lkO1xuICAgIC8vIGxvYWQgY2hhdCBmcm9tIGZpbGUgaW4gLnNtYXJ0LWNvbm5lY3Rpb25zIGZvbGRlclxuICAgIC8vIGZpbGVuYW1lIGlzIGNoYXRfaWRcbiAgICBjb25zdCBjaGF0X2ZpbGUgPSB0aGlzLmNoYXRfaWQgKyBcIi5qc29uXCI7XG4gICAgLy8gcmVhZCBmaWxlXG4gICAgbGV0IGNoYXRfanNvbiA9IGF3YWl0IHRoaXMuYXBwLnZhdWx0LmFkYXB0ZXIucmVhZChcbiAgICAgIFwiLnNtYXJ0LWNvbm5lY3Rpb25zL2NoYXRzL1wiICsgY2hhdF9maWxlXG4gICAgKTtcbiAgICAvLyBwYXJzZSBqc29uXG4gICAgdGhpcy50aHJlYWQgPSBKU09OLnBhcnNlKGNoYXRfanNvbik7XG4gICAgLy8gbG9hZCBjaGF0X21sXG4gICAgdGhpcy5jaGF0X21sID0gdGhpcy5wcmVwYXJlX2NoYXRfbWwoKTtcbiAgICAvLyByZW5kZXIgbWVzc2FnZXMgaW4gY2hhdCB2aWV3XG4gICAgLy8gZm9yIGVhY2ggdHVybiBpbiBjaGF0X21sXG4gICAgLy8gY29uc29sZS5sb2codGhpcy50aHJlYWQpO1xuICAgIC8vIGNvbnNvbGUubG9nKHRoaXMuY2hhdF9tbCk7XG4gIH1cbiAgLy8gcHJlcGFyZSBjaGF0X21sIGZyb20gY2hhdFxuICAvLyBnZXRzIHRoZSBsYXN0IG1lc3NhZ2Ugb2YgZWFjaCB0dXJuIHVubGVzcyB0dXJuX3ZhcmlhdGlvbl9vZmZzZXRzPVtbdHVybl9pbmRleCx2YXJpYXRpb25faW5kZXhdXSBpcyBzcGVjaWZpZWQgaW4gb2Zmc2V0XG4gIHByZXBhcmVfY2hhdF9tbCh0dXJuX3ZhcmlhdGlvbl9vZmZzZXRzPVtdKSB7XG4gICAgLy8gaWYgbm8gdHVybl92YXJpYXRpb25fb2Zmc2V0cywgZ2V0IHRoZSBsYXN0IG1lc3NhZ2Ugb2YgZWFjaCB0dXJuXG4gICAgaWYodHVybl92YXJpYXRpb25fb2Zmc2V0cy5sZW5ndGggPT09IDApe1xuICAgICAgdGhpcy5jaGF0X21sID0gdGhpcy50aHJlYWQubWFwKHR1cm4gPT4ge1xuICAgICAgICByZXR1cm4gdHVyblt0dXJuLmxlbmd0aCAtIDFdO1xuICAgICAgfSk7XG4gICAgfWVsc2V7XG4gICAgICAvLyBjcmVhdGUgYW4gYXJyYXkgZnJvbSB0dXJuX3ZhcmlhdGlvbl9vZmZzZXRzIHRoYXQgaW5kZXhlcyB2YXJpYXRpb25faW5kZXggYXQgdHVybl9pbmRleFxuICAgICAgLy8gZXguIFtbMyw1XV0gPT4gW3VuZGVmaW5lZCwgdW5kZWZpbmVkLCB1bmRlZmluZWQsIDVdXG4gICAgICBsZXQgdHVybl92YXJpYXRpb25faW5kZXggPSBbXTtcbiAgICAgIGZvcihsZXQgaSA9IDA7IGkgPCB0dXJuX3ZhcmlhdGlvbl9vZmZzZXRzLmxlbmd0aDsgaSsrKXtcbiAgICAgICAgdHVybl92YXJpYXRpb25faW5kZXhbdHVybl92YXJpYXRpb25fb2Zmc2V0c1tpXVswXV0gPSB0dXJuX3ZhcmlhdGlvbl9vZmZzZXRzW2ldWzFdO1xuICAgICAgfVxuICAgICAgLy8gbG9vcCB0aHJvdWdoIGNoYXRcbiAgICAgIHRoaXMuY2hhdF9tbCA9IHRoaXMudGhyZWFkLm1hcCgodHVybiwgdHVybl9pbmRleCkgPT4ge1xuICAgICAgICAvLyBpZiB0aGVyZSBpcyBhbiBpbmRleCBmb3IgdGhpcyB0dXJuLCByZXR1cm4gdGhlIHZhcmlhdGlvbiBhdCB0aGF0IGluZGV4XG4gICAgICAgIGlmKHR1cm5fdmFyaWF0aW9uX2luZGV4W3R1cm5faW5kZXhdICE9PSB1bmRlZmluZWQpe1xuICAgICAgICAgIHJldHVybiB0dXJuW3R1cm5fdmFyaWF0aW9uX2luZGV4W3R1cm5faW5kZXhdXTtcbiAgICAgICAgfVxuICAgICAgICAvLyBvdGhlcndpc2UgcmV0dXJuIHRoZSBsYXN0IG1lc3NhZ2Ugb2YgdGhlIHR1cm5cbiAgICAgICAgcmV0dXJuIHR1cm5bdHVybi5sZW5ndGggLSAxXTtcbiAgICAgIH0pO1xuICAgIH1cbiAgICAvLyBzdHJpcCBhbGwgYnV0IHJvbGUgYW5kIGNvbnRlbnQgcHJvcGVydGllcyBmcm9tIGVhY2ggbWVzc2FnZVxuICAgIHRoaXMuY2hhdF9tbCA9IHRoaXMuY2hhdF9tbC5tYXAobWVzc2FnZSA9PiB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICByb2xlOiBtZXNzYWdlLnJvbGUsXG4gICAgICAgIGNvbnRlbnQ6IG1lc3NhZ2UuY29udGVudFxuICAgICAgfTtcbiAgICB9KTtcbiAgICByZXR1cm4gdGhpcy5jaGF0X21sO1xuICB9XG4gIGxhc3QoKSB7XG4gICAgLy8gZ2V0IGxhc3QgbWVzc2FnZSBmcm9tIGNoYXRcbiAgICByZXR1cm4gdGhpcy50aHJlYWRbdGhpcy50aHJlYWQubGVuZ3RoIC0gMV1bdGhpcy50aHJlYWRbdGhpcy50aHJlYWQubGVuZ3RoIC0gMV0ubGVuZ3RoIC0gMV07XG4gIH1cbiAgbGFzdF9mcm9tKCkge1xuICAgIHJldHVybiB0aGlzLmxhc3QoKS5yb2xlO1xuICB9XG4gIC8vIHJldHVybnMgdXNlcl9pbnB1dCBvciBjb21wbGV0aW9uXG4gIGxhc3RfbWVzc2FnZSgpIHtcbiAgICByZXR1cm4gdGhpcy5sYXN0KCkuY29udGVudDtcbiAgfVxuICAvLyBtZXNzYWdlPXt9XG4gIC8vIGFkZCBuZXcgbWVzc2FnZSB0byB0aHJlYWRcbiAgbmV3X21lc3NhZ2VfaW5fdGhyZWFkKG1lc3NhZ2UsIHR1cm49LTEpIHtcbiAgICAvLyBpZiB0dXJuIGlzIC0xLCBhZGQgdG8gbmV3IHR1cm5cbiAgICBpZih0aGlzLmNvbnRleHQpe1xuICAgICAgbWVzc2FnZS5jb250ZXh0ID0gdGhpcy5jb250ZXh0O1xuICAgICAgdGhpcy5jb250ZXh0ID0gbnVsbDtcbiAgICB9XG4gICAgaWYodGhpcy5oeWQpe1xuICAgICAgbWVzc2FnZS5oeWQgPSB0aGlzLmh5ZDtcbiAgICAgIHRoaXMuaHlkID0gbnVsbDtcbiAgICB9XG4gICAgaWYgKHR1cm4gPT09IC0xKSB7XG4gICAgICB0aGlzLnRocmVhZC5wdXNoKFttZXNzYWdlXSk7XG4gICAgfWVsc2V7XG4gICAgICAvLyBvdGhlcndpc2UgYWRkIHRvIHNwZWNpZmllZCB0dXJuXG4gICAgICB0aGlzLnRocmVhZFt0dXJuXS5wdXNoKG1lc3NhZ2UpO1xuICAgIH1cbiAgfVxuICByZXNldF9jb250ZXh0KCl7XG4gICAgdGhpcy5jb250ZXh0ID0gbnVsbDtcbiAgICB0aGlzLmh5ZCA9IG51bGw7XG4gIH1cbiAgYXN5bmMgcmVuYW1lX2NoYXQobmV3X25hbWUpe1xuICAgIC8vIGNoZWNrIGlmIGN1cnJlbnQgY2hhdF9pZCBmaWxlIGV4aXN0c1xuICAgIGlmICh0aGlzLmNoYXRfaWQgJiYgYXdhaXQgdGhpcy5hcHAudmF1bHQuYWRhcHRlci5leGlzdHMoXCIuc21hcnQtY29ubmVjdGlvbnMvY2hhdHMvXCIgKyB0aGlzLmNoYXRfaWQgKyBcIi5qc29uXCIpKSB7XG4gICAgICBuZXdfbmFtZSA9IHRoaXMuY2hhdF9pZC5yZXBsYWNlKHRoaXMubmFtZSgpLCBuZXdfbmFtZSk7XG4gICAgICAvLyByZW5hbWUgZmlsZSBpZiBpdCBleGlzdHNcbiAgICAgIGF3YWl0IHRoaXMuYXBwLnZhdWx0LmFkYXB0ZXIucmVuYW1lKFxuICAgICAgICBcIi5zbWFydC1jb25uZWN0aW9ucy9jaGF0cy9cIiArIHRoaXMuY2hhdF9pZCArIFwiLmpzb25cIixcbiAgICAgICAgXCIuc21hcnQtY29ubmVjdGlvbnMvY2hhdHMvXCIgKyBuZXdfbmFtZSArIFwiLmpzb25cIlxuICAgICAgKTtcbiAgICAgIC8vIHNldCBjaGF0X2lkIHRvIG5ld19uYW1lXG4gICAgICB0aGlzLmNoYXRfaWQgPSBuZXdfbmFtZTtcbiAgICB9ZWxzZXtcbiAgICAgIHRoaXMuY2hhdF9pZCA9IG5ld19uYW1lICsgXCJcdTIwMTRcIiArIHRoaXMuZ2V0X2ZpbGVfZGF0ZV9zdHJpbmcoKTtcbiAgICAgIC8vIHNhdmUgY2hhdFxuICAgICAgYXdhaXQgdGhpcy5zYXZlX2NoYXQoKTtcbiAgICB9XG5cbiAgfVxuXG4gIG5hbWUoKSB7XG4gICAgaWYodGhpcy5jaGF0X2lkKXtcbiAgICAgIC8vIHJlbW92ZSBkYXRlIGFmdGVyIGxhc3QgZW0gZGFzaFxuICAgICAgcmV0dXJuIHRoaXMuY2hhdF9pZC5yZXBsYWNlKC9cdTIwMTRbXlx1MjAxNF0qJC8sXCJcIik7XG4gICAgfVxuICAgIHJldHVybiBcIlVOVElUTEVEXCI7XG4gIH1cblxuICBnZXRfZmlsZV9kYXRlX3N0cmluZygpIHtcbiAgICByZXR1cm4gbmV3IERhdGUoKS50b0lTT1N0cmluZygpLnJlcGxhY2UoLyhUfDp8XFwuLiopL2csIFwiIFwiKS50cmltKCk7XG4gIH1cbiAgLy8gZ2V0IHJlc3BvbnNlIGZyb20gd2l0aCBub3RlIGNvbnRleHRcbiAgYXN5bmMgZ2V0X3Jlc3BvbnNlX3dpdGhfbm90ZV9jb250ZXh0KHVzZXJfaW5wdXQsIGNoYXRfdmlldykge1xuICAgIGxldCBzeXN0ZW1faW5wdXQgPSBcIkltYWdpbmUgdGhlIGZvbGxvd2luZyBub3RlcyB3ZXJlIHdyaXR0ZW4gYnkgdGhlIHVzZXIgYW5kIGNvbnRhaW4gdGhlIG5lY2Vzc2FyeSBpbmZvcm1hdGlvbiB0byBzeW50aGVzaXplIGEgdXNlZnVsIGFuc3dlciB0aGUgdXNlcidzIHF1ZXJ5OlxcblwiO1xuICAgIC8vIGV4dHJhY3QgaW50ZXJuYWwgbGlua3NcbiAgICBjb25zdCBub3RlcyA9IHRoaXMuZXh0cmFjdF9pbnRlcm5hbF9saW5rcyh1c2VyX2lucHV0KTtcbiAgICAvLyBnZXQgY29udGVudCBvZiBpbnRlcm5hbCBsaW5rcyBhcyBjb250ZXh0XG4gICAgbGV0IG1heF9jaGFycyA9IGdldF9tYXhfY2hhcnModGhpcy5wbHVnaW4uc2V0dGluZ3Muc21hcnRfY2hhdF9tb2RlbCk7XG4gICAgZm9yKGxldCBpID0gMDsgaSA8IG5vdGVzLmxlbmd0aDsgaSsrKXtcbiAgICAgIC8vIG1heCBjaGFycyBmb3IgdGhpcyBub3RlIGlzIG1heF9jaGFycyBkaXZpZGVkIGJ5IG51bWJlciBvZiBub3RlcyBsZWZ0XG4gICAgICBjb25zdCB0aGlzX21heF9jaGFycyA9IChub3Rlcy5sZW5ndGggLSBpID4gMSkgPyBNYXRoLmZsb29yKG1heF9jaGFycyAvIChub3Rlcy5sZW5ndGggLSBpKSkgOiBtYXhfY2hhcnM7XG4gICAgICAvLyBjb25zb2xlLmxvZyhcImZpbGUgY29udGV4dCBtYXggY2hhcnM6IFwiICsgdGhpc19tYXhfY2hhcnMpO1xuICAgICAgY29uc3Qgbm90ZV9jb250ZW50ID0gYXdhaXQgdGhpcy5nZXRfbm90ZV9jb250ZW50cyhub3Rlc1tpXSwge2NoYXJfbGltaXQ6IHRoaXNfbWF4X2NoYXJzfSk7XG4gICAgICBzeXN0ZW1faW5wdXQgKz0gYC0tLUJFR0lOIE5PVEU6IFtbJHtub3Rlc1tpXS5iYXNlbmFtZX1dXS0tLVxcbmBcbiAgICAgIHN5c3RlbV9pbnB1dCArPSBub3RlX2NvbnRlbnQ7XG4gICAgICBzeXN0ZW1faW5wdXQgKz0gYC0tLUVORCBOT1RFLS0tXFxuYFxuICAgICAgbWF4X2NoYXJzIC09IG5vdGVfY29udGVudC5sZW5ndGg7XG4gICAgICBpZihtYXhfY2hhcnMgPD0gMCkgYnJlYWs7XG4gICAgfVxuICAgIHRoaXMuY29udGV4dCA9IHN5c3RlbV9pbnB1dDtcbiAgICBjb25zdCBjaGF0bWwgPSBbXG4gICAgICB7XG4gICAgICAgIHJvbGU6IFwic3lzdGVtXCIsXG4gICAgICAgIGNvbnRlbnQ6IHN5c3RlbV9pbnB1dFxuICAgICAgfSxcbiAgICAgIHtcbiAgICAgICAgcm9sZTogXCJ1c2VyXCIsXG4gICAgICAgIGNvbnRlbnQ6IHVzZXJfaW5wdXRcbiAgICAgIH1cbiAgICBdO1xuICAgIGNoYXRfdmlldy5yZXF1ZXN0X2NoYXRncHRfY29tcGxldGlvbih7bWVzc2FnZXM6IGNoYXRtbCwgdGVtcGVyYXR1cmU6IDB9KTtcbiAgfVxuICAvLyBjaGVjayBpZiBjb250YWlucyBpbnRlcm5hbCBsaW5rXG4gIGNvbnRhaW5zX2ludGVybmFsX2xpbmsodXNlcl9pbnB1dCkge1xuICAgIGlmKHVzZXJfaW5wdXQuaW5kZXhPZihcIltbXCIpID09PSAtMSkgcmV0dXJuIGZhbHNlO1xuICAgIGlmKHVzZXJfaW5wdXQuaW5kZXhPZihcIl1dXCIpID09PSAtMSkgcmV0dXJuIGZhbHNlO1xuICAgIHJldHVybiB0cnVlO1xuICB9XG4gIC8vIGNoZWNrIGlmIGNvbnRhaW5zIGZvbGRlciByZWZlcmVuY2UgKGV4LiAvZm9sZGVyLywgb3IgL2ZvbGRlci9zdWJmb2xkZXIvKVxuICBjb250YWluc19mb2xkZXJfcmVmZXJlbmNlKHVzZXJfaW5wdXQpIHtcbiAgICBpZih1c2VyX2lucHV0LmluZGV4T2YoXCIvXCIpID09PSAtMSkgcmV0dXJuIGZhbHNlO1xuICAgIGlmKHVzZXJfaW5wdXQuaW5kZXhPZihcIi9cIikgPT09IHVzZXJfaW5wdXQubGFzdEluZGV4T2YoXCIvXCIpKSByZXR1cm4gZmFsc2U7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cbiAgLy8gZ2V0IGZvbGRlciByZWZlcmVuY2VzIGZyb20gdXNlciBpbnB1dFxuICBnZXRfZm9sZGVyX3JlZmVyZW5jZXModXNlcl9pbnB1dCkge1xuICAgIC8vIHVzZSB0aGlzLmZvbGRlcnMgdG8gZXh0cmFjdCBmb2xkZXIgcmVmZXJlbmNlcyBieSBsb25nZXN0IGZpcnN0IChleC4gL2ZvbGRlci9zdWJmb2xkZXIvIGJlZm9yZSAvZm9sZGVyLykgdG8gYXZvaWQgbWF0Y2hpbmcgL2ZvbGRlci9zdWJmb2xkZXIvIGFzIC9mb2xkZXIvXG4gICAgY29uc3QgZm9sZGVycyA9IHRoaXMucGx1Z2luLmZvbGRlcnMuc2xpY2UoKTsgLy8gY29weSBmb2xkZXJzIGFycmF5XG4gICAgY29uc3QgbWF0Y2hlcyA9IGZvbGRlcnMuc29ydCgoYSwgYikgPT4gYi5sZW5ndGggLSBhLmxlbmd0aCkubWFwKGZvbGRlciA9PiB7XG4gICAgICAvLyBjaGVjayBpZiBmb2xkZXIgaXMgaW4gdXNlcl9pbnB1dFxuICAgICAgaWYodXNlcl9pbnB1dC5pbmRleE9mKGZvbGRlcikgIT09IC0xKXtcbiAgICAgICAgLy8gcmVtb3ZlIGZvbGRlciBmcm9tIHVzZXJfaW5wdXQgdG8gcHJldmVudCBtYXRjaGluZyAvZm9sZGVyL3N1YmZvbGRlci8gYXMgL2ZvbGRlci9cbiAgICAgICAgdXNlcl9pbnB1dCA9IHVzZXJfaW5wdXQucmVwbGFjZShmb2xkZXIsIFwiXCIpO1xuICAgICAgICByZXR1cm4gZm9sZGVyO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH0pLmZpbHRlcihmb2xkZXIgPT4gZm9sZGVyKTtcbiAgICBjb25zb2xlLmxvZyhtYXRjaGVzKTtcbiAgICAvLyByZXR1cm4gYXJyYXkgb2YgbWF0Y2hlc1xuICAgIGlmKG1hdGNoZXMpIHJldHVybiBtYXRjaGVzO1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG5cbiAgLy8gZXh0cmFjdCBpbnRlcm5hbCBsaW5rc1xuICBleHRyYWN0X2ludGVybmFsX2xpbmtzKHVzZXJfaW5wdXQpIHtcbiAgICBjb25zdCBtYXRjaGVzID0gdXNlcl9pbnB1dC5tYXRjaCgvXFxbXFxbKC4qPylcXF1cXF0vZyk7XG4gICAgY29uc29sZS5sb2cobWF0Y2hlcyk7XG4gICAgLy8gcmV0dXJuIGFycmF5IG9mIFRGaWxlIG9iamVjdHNcbiAgICBpZihtYXRjaGVzKSByZXR1cm4gbWF0Y2hlcy5tYXAobWF0Y2ggPT4ge1xuICAgICAgcmV0dXJuIHRoaXMuYXBwLm1ldGFkYXRhQ2FjaGUuZ2V0Rmlyc3RMaW5rcGF0aERlc3QobWF0Y2gucmVwbGFjZShcIltbXCIsIFwiXCIpLnJlcGxhY2UoXCJdXVwiLCBcIlwiKSwgXCIvXCIpO1xuICAgIH0pO1xuICAgIHJldHVybiBbXTtcbiAgfVxuICAvLyBnZXQgY29udGV4dCBmcm9tIGludGVybmFsIGxpbmtzXG4gIGFzeW5jIGdldF9ub3RlX2NvbnRlbnRzKG5vdGUsIG9wdHM9e30pIHtcbiAgICBvcHRzID0ge1xuICAgICAgY2hhcl9saW1pdDogMTAwMDAsXG4gICAgICAuLi5vcHRzXG4gICAgfVxuICAgIC8vIHJldHVybiBpZiBub3RlIGlzIG5vdCBhIGZpbGVcbiAgICBpZighKG5vdGUgaW5zdGFuY2VvZiBPYnNpZGlhbi5URmlsZSkpIHJldHVybiBcIlwiO1xuICAgIC8vIGdldCBmaWxlIGNvbnRlbnRcbiAgICBsZXQgZmlsZV9jb250ZW50ID0gYXdhaXQgdGhpcy5hcHAudmF1bHQuY2FjaGVkUmVhZChub3RlKTtcbiAgICAvLyBjaGVjayBpZiBjb250YWlucyBkYXRhdmlldyBjb2RlIGJsb2NrXG4gICAgaWYoZmlsZV9jb250ZW50LmluZGV4T2YoXCJgYGBkYXRhdmlld1wiKSA+IC0xKXtcbiAgICAgIC8vIGlmIGNvbnRhaW5zIGRhdGF2aWV3IGNvZGUgYmxvY2sgZ2V0IGFsbCBkYXRhdmlldyBjb2RlIGJsb2Nrc1xuICAgICAgZmlsZV9jb250ZW50ID0gYXdhaXQgdGhpcy5yZW5kZXJfZGF0YXZpZXdfcXVlcmllcyhmaWxlX2NvbnRlbnQsIG5vdGUucGF0aCwgb3B0cyk7XG4gICAgfVxuICAgIGZpbGVfY29udGVudCA9IGZpbGVfY29udGVudC5zdWJzdHJpbmcoMCwgb3B0cy5jaGFyX2xpbWl0KTtcbiAgICAvLyBjb25zb2xlLmxvZyhmaWxlX2NvbnRlbnQubGVuZ3RoKTtcbiAgICByZXR1cm4gZmlsZV9jb250ZW50O1xuICB9XG5cblxuICBhc3luYyByZW5kZXJfZGF0YXZpZXdfcXVlcmllcyhmaWxlX2NvbnRlbnQsIG5vdGVfcGF0aCwgb3B0cz17fSkge1xuICAgIG9wdHMgPSB7XG4gICAgICBjaGFyX2xpbWl0OiBudWxsLFxuICAgICAgLi4ub3B0c1xuICAgIH07XG4gICAgLy8gdXNlIHdpbmRvdyB0byBnZXQgZGF0YXZpZXcgYXBpXG4gICAgY29uc3QgZGF0YXZpZXdfYXBpID0gd2luZG93W1wiRGF0YXZpZXdBUElcIl07XG4gICAgLy8gc2tpcCBpZiBkYXRhdmlldyBhcGkgbm90IGZvdW5kXG4gICAgaWYoIWRhdGF2aWV3X2FwaSkgcmV0dXJuIGZpbGVfY29udGVudDtcbiAgICBjb25zdCBkYXRhdmlld19jb2RlX2Jsb2NrcyA9IGZpbGVfY29udGVudC5tYXRjaCgvYGBgZGF0YXZpZXcoLio/KWBgYC9ncyk7XG4gICAgLy8gZm9yIGVhY2ggZGF0YXZpZXcgY29kZSBibG9ja1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZGF0YXZpZXdfY29kZV9ibG9ja3MubGVuZ3RoOyBpKyspIHtcbiAgICAgIC8vIGlmIG9wdHMgY2hhcl9saW1pdCBpcyBsZXNzIHRoYW4gaW5kZXhPZiBkYXRhdmlldyBjb2RlIGJsb2NrLCBicmVha1xuICAgICAgaWYob3B0cy5jaGFyX2xpbWl0ICYmIG9wdHMuY2hhcl9saW1pdCA8IGZpbGVfY29udGVudC5pbmRleE9mKGRhdGF2aWV3X2NvZGVfYmxvY2tzW2ldKSkgYnJlYWs7XG4gICAgICAvLyBnZXQgZGF0YXZpZXcgY29kZSBibG9ja1xuICAgICAgY29uc3QgZGF0YXZpZXdfY29kZV9ibG9jayA9IGRhdGF2aWV3X2NvZGVfYmxvY2tzW2ldO1xuICAgICAgLy8gZ2V0IGNvbnRlbnQgb2YgZGF0YXZpZXcgY29kZSBibG9ja1xuICAgICAgY29uc3QgZGF0YXZpZXdfY29kZV9ibG9ja19jb250ZW50ID0gZGF0YXZpZXdfY29kZV9ibG9jay5yZXBsYWNlKFwiYGBgZGF0YXZpZXdcIiwgXCJcIikucmVwbGFjZShcImBgYFwiLCBcIlwiKTtcbiAgICAgIC8vIGdldCBkYXRhdmlldyBxdWVyeSByZXN1bHRcbiAgICAgIGNvbnN0IGRhdGF2aWV3X3F1ZXJ5X3Jlc3VsdCA9IGF3YWl0IGRhdGF2aWV3X2FwaS5xdWVyeU1hcmtkb3duKGRhdGF2aWV3X2NvZGVfYmxvY2tfY29udGVudCwgbm90ZV9wYXRoLCBudWxsKTtcbiAgICAgIC8vIGlmIHF1ZXJ5IHJlc3VsdCBpcyBzdWNjZXNzZnVsLCByZXBsYWNlIGRhdGF2aWV3IGNvZGUgYmxvY2sgd2l0aCBxdWVyeSByZXN1bHRcbiAgICAgIGlmIChkYXRhdmlld19xdWVyeV9yZXN1bHQuc3VjY2Vzc2Z1bCkge1xuICAgICAgICBmaWxlX2NvbnRlbnQgPSBmaWxlX2NvbnRlbnQucmVwbGFjZShkYXRhdmlld19jb2RlX2Jsb2NrLCBkYXRhdmlld19xdWVyeV9yZXN1bHQudmFsdWUpO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gZmlsZV9jb250ZW50O1xuICB9XG59XG5cbmNsYXNzIFNtYXJ0Q29ubmVjdGlvbnNDaGF0SGlzdG9yeU1vZGFsIGV4dGVuZHMgT2JzaWRpYW4uRnV6enlTdWdnZXN0TW9kYWwge1xuICBjb25zdHJ1Y3RvcihhcHAsIHZpZXcsIGZpbGVzKSB7XG4gICAgc3VwZXIoYXBwKTtcbiAgICB0aGlzLmFwcCA9IGFwcDtcbiAgICB0aGlzLnZpZXcgPSB2aWV3O1xuICAgIHRoaXMuc2V0UGxhY2Vob2xkZXIoXCJUeXBlIHRoZSBuYW1lIG9mIGEgY2hhdCBzZXNzaW9uLi4uXCIpO1xuICB9XG4gIGdldEl0ZW1zKCkge1xuICAgIGlmICghdGhpcy52aWV3LmZpbGVzKSB7XG4gICAgICByZXR1cm4gW107XG4gICAgfVxuICAgIHJldHVybiB0aGlzLnZpZXcuZmlsZXM7XG4gIH1cbiAgZ2V0SXRlbVRleHQoaXRlbSkge1xuICAgIC8vIGlmIG5vdCBVTlRJVExFRCwgcmVtb3ZlIGRhdGUgYWZ0ZXIgbGFzdCBlbSBkYXNoXG4gICAgaWYoaXRlbS5pbmRleE9mKFwiVU5USVRMRURcIikgPT09IC0xKXtcbiAgICAgIGl0ZW0ucmVwbGFjZSgvXHUyMDE0W15cdTIwMTRdKiQvLFwiXCIpO1xuICAgIH1cbiAgICByZXR1cm4gaXRlbTtcbiAgfVxuICBvbkNob29zZUl0ZW0oc2Vzc2lvbikge1xuICAgIHRoaXMudmlldy5vcGVuX2NoYXQoc2Vzc2lvbik7XG4gIH1cbn1cblxuLy8gRmlsZSBTZWxlY3QgRnV6enkgU3VnZ2VzdCBNb2RhbFxuY2xhc3MgU21hcnRDb25uZWN0aW9uc0ZpbGVTZWxlY3RNb2RhbCBleHRlbmRzIE9ic2lkaWFuLkZ1enp5U3VnZ2VzdE1vZGFsIHtcbiAgY29uc3RydWN0b3IoYXBwLCB2aWV3KSB7XG4gICAgc3VwZXIoYXBwKTtcbiAgICB0aGlzLmFwcCA9IGFwcDtcbiAgICB0aGlzLnZpZXcgPSB2aWV3O1xuICAgIHRoaXMuc2V0UGxhY2Vob2xkZXIoXCJUeXBlIHRoZSBuYW1lIG9mIGEgZmlsZS4uLlwiKTtcbiAgfVxuICBnZXRJdGVtcygpIHtcbiAgICAvLyBnZXQgYWxsIG1hcmtkb3duIGZpbGVzXG4gICAgcmV0dXJuIHRoaXMuYXBwLnZhdWx0LmdldE1hcmtkb3duRmlsZXMoKS5zb3J0KChhLCBiKSA9PiBhLmJhc2VuYW1lLmxvY2FsZUNvbXBhcmUoYi5iYXNlbmFtZSkpO1xuICB9XG4gIGdldEl0ZW1UZXh0KGl0ZW0pIHtcbiAgICByZXR1cm4gaXRlbS5iYXNlbmFtZTtcbiAgfVxuICBvbkNob29zZUl0ZW0oZmlsZSkge1xuICAgIHRoaXMudmlldy5pbnNlcnRfc2VsZWN0aW9uKGZpbGUuYmFzZW5hbWUgKyBcIl1dIFwiKTtcbiAgfVxufVxuLy8gRm9sZGVyIFNlbGVjdCBGdXp6eSBTdWdnZXN0IE1vZGFsXG5jbGFzcyBTbWFydENvbm5lY3Rpb25zRm9sZGVyU2VsZWN0TW9kYWwgZXh0ZW5kcyBPYnNpZGlhbi5GdXp6eVN1Z2dlc3RNb2RhbCB7XG4gIGNvbnN0cnVjdG9yKGFwcCwgdmlldykge1xuICAgIHN1cGVyKGFwcCk7XG4gICAgdGhpcy5hcHAgPSBhcHA7XG4gICAgdGhpcy52aWV3ID0gdmlldztcbiAgICB0aGlzLnNldFBsYWNlaG9sZGVyKFwiVHlwZSB0aGUgbmFtZSBvZiBhIGZvbGRlci4uLlwiKTtcbiAgfVxuICBnZXRJdGVtcygpIHtcbiAgICByZXR1cm4gdGhpcy52aWV3LnBsdWdpbi5mb2xkZXJzO1xuICB9XG4gIGdldEl0ZW1UZXh0KGl0ZW0pIHtcbiAgICByZXR1cm4gaXRlbTtcbiAgfVxuICBvbkNob29zZUl0ZW0oZm9sZGVyKSB7XG4gICAgdGhpcy52aWV3Lmluc2VydF9zZWxlY3Rpb24oZm9sZGVyICsgXCIvIFwiKTtcbiAgfVxufVxuXG5cbi8vIEhhbmRsZSBBUEkgcmVzcG9uc2Ugc3RyZWFtaW5nXG5jbGFzcyBTY1N0cmVhbWVyIHtcbiAgLy8gY29uc3RydWN0b3JcbiAgY29uc3RydWN0b3IodXJsLCBvcHRpb25zKSB7XG4gICAgLy8gc2V0IGRlZmF1bHQgb3B0aW9uc1xuICAgIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuICAgIHRoaXMudXJsID0gdXJsO1xuICAgIHRoaXMubWV0aG9kID0gb3B0aW9ucy5tZXRob2QgfHwgJ0dFVCc7XG4gICAgdGhpcy5oZWFkZXJzID0gb3B0aW9ucy5oZWFkZXJzIHx8IHt9O1xuICAgIHRoaXMucGF5bG9hZCA9IG9wdGlvbnMucGF5bG9hZCB8fCBudWxsO1xuICAgIHRoaXMud2l0aENyZWRlbnRpYWxzID0gb3B0aW9ucy53aXRoQ3JlZGVudGlhbHMgfHwgZmFsc2U7XG4gICAgdGhpcy5saXN0ZW5lcnMgPSB7fTtcbiAgICB0aGlzLnJlYWR5U3RhdGUgPSB0aGlzLkNPTk5FQ1RJTkc7XG4gICAgdGhpcy5wcm9ncmVzcyA9IDA7XG4gICAgdGhpcy5jaHVuayA9ICcnO1xuICAgIHRoaXMueGhyID0gbnVsbDtcbiAgICB0aGlzLkZJRUxEX1NFUEFSQVRPUiA9ICc6JztcbiAgICB0aGlzLklOSVRJQUxJWklORyA9IC0xO1xuICAgIHRoaXMuQ09OTkVDVElORyA9IDA7XG4gICAgdGhpcy5PUEVOID0gMTtcbiAgICB0aGlzLkNMT1NFRCA9IDI7XG4gIH1cbiAgLy8gYWRkRXZlbnRMaXN0ZW5lclxuICBhZGRFdmVudExpc3RlbmVyKHR5cGUsIGxpc3RlbmVyKSB7XG4gICAgLy8gY2hlY2sgaWYgdGhlIHR5cGUgaXMgaW4gdGhlIGxpc3RlbmVyc1xuICAgIGlmICghdGhpcy5saXN0ZW5lcnNbdHlwZV0pIHtcbiAgICAgIHRoaXMubGlzdGVuZXJzW3R5cGVdID0gW107XG4gICAgfVxuICAgIC8vIGNoZWNrIGlmIHRoZSBsaXN0ZW5lciBpcyBhbHJlYWR5IGluIHRoZSBsaXN0ZW5lcnNcbiAgICBpZih0aGlzLmxpc3RlbmVyc1t0eXBlXS5pbmRleE9mKGxpc3RlbmVyKSA9PT0gLTEpIHtcbiAgICAgIHRoaXMubGlzdGVuZXJzW3R5cGVdLnB1c2gobGlzdGVuZXIpO1xuICAgIH1cbiAgfVxuICAvLyByZW1vdmVFdmVudExpc3RlbmVyXG4gIHJlbW92ZUV2ZW50TGlzdGVuZXIodHlwZSwgbGlzdGVuZXIpIHtcbiAgICAvLyBjaGVjayBpZiBsaXN0ZW5lciB0eXBlIGlzIHVuZGVmaW5lZFxuICAgIGlmICghdGhpcy5saXN0ZW5lcnNbdHlwZV0pIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgbGV0IGZpbHRlcmVkID0gW107XG4gICAgLy8gbG9vcCB0aHJvdWdoIHRoZSBsaXN0ZW5lcnNcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMubGlzdGVuZXJzW3R5cGVdLmxlbmd0aDsgaSsrKSB7XG4gICAgICAvLyBjaGVjayBpZiB0aGUgbGlzdGVuZXIgaXMgdGhlIHNhbWVcbiAgICAgIGlmICh0aGlzLmxpc3RlbmVyc1t0eXBlXVtpXSAhPT0gbGlzdGVuZXIpIHtcbiAgICAgICAgZmlsdGVyZWQucHVzaCh0aGlzLmxpc3RlbmVyc1t0eXBlXVtpXSk7XG4gICAgICB9XG4gICAgfVxuICAgIC8vIGNoZWNrIGlmIHRoZSBsaXN0ZW5lcnMgYXJlIGVtcHR5XG4gICAgaWYgKHRoaXMubGlzdGVuZXJzW3R5cGVdLmxlbmd0aCA9PT0gMCkge1xuICAgICAgZGVsZXRlIHRoaXMubGlzdGVuZXJzW3R5cGVdO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmxpc3RlbmVyc1t0eXBlXSA9IGZpbHRlcmVkO1xuICAgIH1cbiAgfVxuICAvLyBkaXNwYXRjaEV2ZW50XG4gIGRpc3BhdGNoRXZlbnQoZXZlbnQpIHtcbiAgICAvLyBpZiBubyBldmVudCByZXR1cm4gdHJ1ZVxuICAgIGlmICghZXZlbnQpIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgICAvLyBzZXQgZXZlbnQgc291cmNlIHRvIHRoaXNcbiAgICBldmVudC5zb3VyY2UgPSB0aGlzO1xuICAgIC8vIHNldCBvbkhhbmRsZXIgdG8gb24gKyBldmVudCB0eXBlXG4gICAgbGV0IG9uSGFuZGxlciA9ICdvbicgKyBldmVudC50eXBlO1xuICAgIC8vIGNoZWNrIGlmIHRoZSBvbkhhbmRsZXIgaGFzIG93biBwcm9wZXJ0eSBuYW1lZCBzYW1lIGFzIG9uSGFuZGxlclxuICAgIGlmICh0aGlzLmhhc093blByb3BlcnR5KG9uSGFuZGxlcikpIHtcbiAgICAgIC8vIGNhbGwgdGhlIG9uSGFuZGxlclxuICAgICAgdGhpc1tvbkhhbmRsZXJdLmNhbGwodGhpcywgZXZlbnQpO1xuICAgICAgLy8gY2hlY2sgaWYgdGhlIGV2ZW50IGlzIGRlZmF1bHQgcHJldmVudGVkXG4gICAgICBpZiAoZXZlbnQuZGVmYXVsdFByZXZlbnRlZCkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgfVxuICAgIC8vIGNoZWNrIGlmIHRoZSBldmVudCB0eXBlIGlzIGluIHRoZSBsaXN0ZW5lcnNcbiAgICBpZiAodGhpcy5saXN0ZW5lcnNbZXZlbnQudHlwZV0pIHtcbiAgICAgIHJldHVybiB0aGlzLmxpc3RlbmVyc1tldmVudC50eXBlXS5ldmVyeShmdW5jdGlvbihjYWxsYmFjaykge1xuICAgICAgICBjYWxsYmFjayhldmVudCk7XG4gICAgICAgIHJldHVybiAhZXZlbnQuZGVmYXVsdFByZXZlbnRlZDtcbiAgICAgIH0pO1xuICAgIH1cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuICAvLyBfc2V0UmVhZHlTdGF0ZVxuICBfc2V0UmVhZHlTdGF0ZShzdGF0ZSkge1xuICAgIC8vIHNldCBldmVudCB0eXBlIHRvIHJlYWR5U3RhdGVDaGFuZ2VcbiAgICBsZXQgZXZlbnQgPSBuZXcgQ3VzdG9tRXZlbnQoJ3JlYWR5U3RhdGVDaGFuZ2UnKTtcbiAgICAvLyBzZXQgZXZlbnQgcmVhZHlTdGF0ZSB0byBzdGF0ZVxuICAgIGV2ZW50LnJlYWR5U3RhdGUgPSBzdGF0ZTtcbiAgICAvLyBzZXQgcmVhZHlTdGF0ZSB0byBzdGF0ZVxuICAgIHRoaXMucmVhZHlTdGF0ZSA9IHN0YXRlO1xuICAgIC8vIGRpc3BhdGNoIGV2ZW50XG4gICAgdGhpcy5kaXNwYXRjaEV2ZW50KGV2ZW50KTtcbiAgfVxuICAvLyBfb25TdHJlYW1GYWlsdXJlXG4gIF9vblN0cmVhbUZhaWx1cmUoZSkge1xuICAgIC8vIHNldCBldmVudCB0eXBlIHRvIGVycm9yXG4gICAgbGV0IGV2ZW50ID0gbmV3IEN1c3RvbUV2ZW50KCdlcnJvcicpO1xuICAgIC8vIHNldCBldmVudCBkYXRhIHRvIGVcbiAgICBldmVudC5kYXRhID0gZS5jdXJyZW50VGFyZ2V0LnJlc3BvbnNlO1xuICAgIC8vIGRpc3BhdGNoIGV2ZW50XG4gICAgdGhpcy5kaXNwYXRjaEV2ZW50KGV2ZW50KTtcbiAgICB0aGlzLmNsb3NlKCk7XG4gIH1cbiAgLy8gX29uU3RyZWFtQWJvcnRcbiAgX29uU3RyZWFtQWJvcnQoZSkge1xuICAgIC8vIHNldCB0byBhYm9ydFxuICAgIGxldCBldmVudCA9IG5ldyBDdXN0b21FdmVudCgnYWJvcnQnKTtcbiAgICAvLyBjbG9zZVxuICAgIHRoaXMuY2xvc2UoKTtcbiAgfVxuICAvLyBfb25TdHJlYW1Qcm9ncmVzc1xuICBfb25TdHJlYW1Qcm9ncmVzcyhlKSB7XG4gICAgLy8gaWYgbm90IHhociByZXR1cm5cbiAgICBpZiAoIXRoaXMueGhyKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIC8vIGlmIHhociBzdGF0dXMgaXMgbm90IDIwMCByZXR1cm5cbiAgICBpZiAodGhpcy54aHIuc3RhdHVzICE9PSAyMDApIHtcbiAgICAgIC8vIG9uU3RyZWFtRmFpbHVyZVxuICAgICAgdGhpcy5fb25TdHJlYW1GYWlsdXJlKGUpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICAvLyBpZiByZWFkeSBzdGF0ZSBpcyBDT05ORUNUSU5HXG4gICAgaWYgKHRoaXMucmVhZHlTdGF0ZSA9PT0gdGhpcy5DT05ORUNUSU5HKSB7XG4gICAgICAvLyBkaXNwYXRjaCBldmVudFxuICAgICAgdGhpcy5kaXNwYXRjaEV2ZW50KG5ldyBDdXN0b21FdmVudCgnb3BlbicpKTtcbiAgICAgIC8vIHNldCByZWFkeSBzdGF0ZSB0byBPUEVOXG4gICAgICB0aGlzLl9zZXRSZWFkeVN0YXRlKHRoaXMuT1BFTik7XG4gICAgfVxuICAgIC8vIHBhcnNlIHRoZSByZWNlaXZlZCBkYXRhLlxuICAgIGxldCBkYXRhID0gdGhpcy54aHIucmVzcG9uc2VUZXh0LnN1YnN0cmluZyh0aGlzLnByb2dyZXNzKTtcbiAgICAvLyB1cGRhdGUgcHJvZ3Jlc3NcbiAgICB0aGlzLnByb2dyZXNzICs9IGRhdGEubGVuZ3RoO1xuICAgIC8vIHNwbGl0IHRoZSBkYXRhIGJ5IG5ldyBsaW5lIGFuZCBwYXJzZSBlYWNoIGxpbmVcbiAgICBkYXRhLnNwbGl0KC8oXFxyXFxufFxccnxcXG4pezJ9L2cpLmZvckVhY2goZnVuY3Rpb24ocGFydCl7XG4gICAgICBpZihwYXJ0LnRyaW0oKS5sZW5ndGggPT09IDApIHtcbiAgICAgICAgdGhpcy5kaXNwYXRjaEV2ZW50KHRoaXMuX3BhcnNlRXZlbnRDaHVuayh0aGlzLmNodW5rLnRyaW0oKSkpO1xuICAgICAgICB0aGlzLmNodW5rID0gJyc7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLmNodW5rICs9IHBhcnQ7XG4gICAgICB9XG4gICAgfS5iaW5kKHRoaXMpKTtcbiAgfVxuICAvLyBfb25TdHJlYW1Mb2FkZWRcbiAgX29uU3RyZWFtTG9hZGVkKGUpIHtcbiAgICB0aGlzLl9vblN0cmVhbVByb2dyZXNzKGUpO1xuICAgIC8vIHBhcnNlIHRoZSBsYXN0IGNodW5rXG4gICAgdGhpcy5kaXNwYXRjaEV2ZW50KHRoaXMuX3BhcnNlRXZlbnRDaHVuayh0aGlzLmNodW5rKSk7XG4gICAgdGhpcy5jaHVuayA9ICcnO1xuICB9XG4gIC8vIF9wYXJzZUV2ZW50Q2h1bmtcbiAgX3BhcnNlRXZlbnRDaHVuayhjaHVuaykge1xuICAgIC8vIGlmIG5vIGNodW5rIG9yIGNodW5rIGlzIGVtcHR5IHJldHVyblxuICAgIGlmICghY2h1bmsgfHwgY2h1bmsubGVuZ3RoID09PSAwKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgLy8gaW5pdCBlXG4gICAgbGV0IGUgPSB7aWQ6IG51bGwsIHJldHJ5OiBudWxsLCBkYXRhOiAnJywgZXZlbnQ6ICdtZXNzYWdlJ307XG4gICAgLy8gc3BsaXQgdGhlIGNodW5rIGJ5IG5ldyBsaW5lXG4gICAgY2h1bmsuc3BsaXQoLyhcXHJcXG58XFxyfFxcbikvKS5mb3JFYWNoKGZ1bmN0aW9uKGxpbmUpIHtcbiAgICAgIGxpbmUgPSBsaW5lLnRyaW1SaWdodCgpO1xuICAgICAgbGV0IGluZGV4ID0gbGluZS5pbmRleE9mKHRoaXMuRklFTERfU0VQQVJBVE9SKTtcbiAgICAgIGlmKGluZGV4IDw9IDApIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgLy8gZmllbGRcbiAgICAgIGxldCBmaWVsZCA9IGxpbmUuc3Vic3RyaW5nKDAsIGluZGV4KTtcbiAgICAgIGlmKCEoZmllbGQgaW4gZSkpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgLy8gdmFsdWVcbiAgICAgIGxldCB2YWx1ZSA9IGxpbmUuc3Vic3RyaW5nKGluZGV4ICsgMSkudHJpbUxlZnQoKTtcbiAgICAgIGlmKGZpZWxkID09PSAnZGF0YScpIHtcbiAgICAgICAgZVtmaWVsZF0gKz0gdmFsdWU7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBlW2ZpZWxkXSA9IHZhbHVlO1xuICAgICAgfVxuICAgIH0uYmluZCh0aGlzKSk7XG4gICAgLy8gcmV0dXJuIGV2ZW50XG4gICAgbGV0IGV2ZW50ID0gbmV3IEN1c3RvbUV2ZW50KGUuZXZlbnQpO1xuICAgIGV2ZW50LmRhdGEgPSBlLmRhdGE7XG4gICAgZXZlbnQuaWQgPSBlLmlkO1xuICAgIHJldHVybiBldmVudDtcbiAgfVxuICAvLyBfY2hlY2tTdHJlYW1DbG9zZWRcbiAgX2NoZWNrU3RyZWFtQ2xvc2VkKCkge1xuICAgIGlmKCF0aGlzLnhocikge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBpZih0aGlzLnhoci5yZWFkeVN0YXRlID09PSBYTUxIdHRwUmVxdWVzdC5ET05FKSB7XG4gICAgICB0aGlzLl9zZXRSZWFkeVN0YXRlKHRoaXMuQ0xPU0VEKTtcbiAgICB9XG4gIH1cbiAgLy8gc3RyZWFtXG4gIHN0cmVhbSgpIHtcbiAgICAvLyBzZXQgcmVhZHkgc3RhdGUgdG8gY29ubmVjdGluZ1xuICAgIHRoaXMuX3NldFJlYWR5U3RhdGUodGhpcy5DT05ORUNUSU5HKTtcbiAgICAvLyBzZXQgeGhyIHRvIG5ldyBYTUxIdHRwUmVxdWVzdFxuICAgIHRoaXMueGhyID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG4gICAgLy8gc2V0IHhociBwcm9ncmVzcyB0byBfb25TdHJlYW1Qcm9ncmVzc1xuICAgIHRoaXMueGhyLmFkZEV2ZW50TGlzdGVuZXIoJ3Byb2dyZXNzJywgdGhpcy5fb25TdHJlYW1Qcm9ncmVzcy5iaW5kKHRoaXMpKTtcbiAgICAvLyBzZXQgeGhyIGxvYWQgdG8gX29uU3RyZWFtTG9hZGVkXG4gICAgdGhpcy54aHIuYWRkRXZlbnRMaXN0ZW5lcignbG9hZCcsIHRoaXMuX29uU3RyZWFtTG9hZGVkLmJpbmQodGhpcykpO1xuICAgIC8vIHNldCB4aHIgcmVhZHkgc3RhdGUgY2hhbmdlIHRvIF9jaGVja1N0cmVhbUNsb3NlZFxuICAgIHRoaXMueGhyLmFkZEV2ZW50TGlzdGVuZXIoJ3JlYWR5c3RhdGVjaGFuZ2UnLCB0aGlzLl9jaGVja1N0cmVhbUNsb3NlZC5iaW5kKHRoaXMpKTtcbiAgICAvLyBzZXQgeGhyIGVycm9yIHRvIF9vblN0cmVhbUZhaWx1cmVcbiAgICB0aGlzLnhoci5hZGRFdmVudExpc3RlbmVyKCdlcnJvcicsIHRoaXMuX29uU3RyZWFtRmFpbHVyZS5iaW5kKHRoaXMpKTtcbiAgICAvLyBzZXQgeGhyIGFib3J0IHRvIF9vblN0cmVhbUFib3J0XG4gICAgdGhpcy54aHIuYWRkRXZlbnRMaXN0ZW5lcignYWJvcnQnLCB0aGlzLl9vblN0cmVhbUFib3J0LmJpbmQodGhpcykpO1xuICAgIC8vIG9wZW4geGhyXG4gICAgdGhpcy54aHIub3Blbih0aGlzLm1ldGhvZCwgdGhpcy51cmwpO1xuICAgIC8vIGhlYWRlcnMgdG8geGhyXG4gICAgZm9yIChsZXQgaGVhZGVyIGluIHRoaXMuaGVhZGVycykge1xuICAgICAgdGhpcy54aHIuc2V0UmVxdWVzdEhlYWRlcihoZWFkZXIsIHRoaXMuaGVhZGVyc1toZWFkZXJdKTtcbiAgICB9XG4gICAgLy8gY3JlZGVudGlhbHMgdG8geGhyXG4gICAgdGhpcy54aHIud2l0aENyZWRlbnRpYWxzID0gdGhpcy53aXRoQ3JlZGVudGlhbHM7XG4gICAgLy8gc2VuZCB4aHJcbiAgICB0aGlzLnhoci5zZW5kKHRoaXMucGF5bG9hZCk7XG4gIH1cbiAgLy8gY2xvc2VcbiAgY2xvc2UoKSB7XG4gICAgaWYodGhpcy5yZWFkeVN0YXRlID09PSB0aGlzLkNMT1NFRCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB0aGlzLnhoci5hYm9ydCgpO1xuICAgIHRoaXMueGhyID0gbnVsbDtcbiAgICB0aGlzLl9zZXRSZWFkeVN0YXRlKHRoaXMuQ0xPU0VEKTtcbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IFNtYXJ0Q29ubmVjdGlvbnNQbHVnaW47Il0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7O0FBQUE7QUFBQSw0QkFBQUEsVUFBQUMsU0FBQTtBQUFBLFFBQU1DLFdBQU4sTUFBYztBQUFBLE1BQ1osWUFBWSxRQUFRO0FBRWxCLGFBQUssU0FBUztBQUFBLFVBQ1osV0FBVztBQUFBLFVBQ1gsYUFBYTtBQUFBLFVBQ2IsZ0JBQWdCO0FBQUEsVUFDaEIsZUFBZTtBQUFBLFVBQ2YsY0FBYztBQUFBLFVBQ2QsZ0JBQWdCO0FBQUEsVUFDaEIsY0FBYztBQUFBLFVBQ2QsZUFBZTtBQUFBLFVBQ2YsR0FBRztBQUFBLFFBQ0w7QUFDQSxhQUFLLFlBQVksS0FBSyxPQUFPO0FBQzdCLGFBQUssY0FBYyxPQUFPO0FBQzFCLGFBQUssWUFBWSxLQUFLLGNBQWMsTUFBTSxLQUFLO0FBRS9DLGFBQUssYUFBYTtBQUFBLE1BQ3BCO0FBQUEsTUFDQSxNQUFNLFlBQVksTUFBTTtBQUN0QixZQUFJLEtBQUssT0FBTyxnQkFBZ0I7QUFDOUIsaUJBQU8sTUFBTSxLQUFLLE9BQU8sZUFBZSxJQUFJO0FBQUEsUUFDOUMsT0FBTztBQUVMLGdCQUFNLElBQUksTUFBTSx3QkFBd0I7QUFBQSxRQUMxQztBQUFBLE1BQ0Y7QUFBQSxNQUNBLE1BQU0sTUFBTSxNQUFNO0FBQ2hCLFlBQUksS0FBSyxP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SyxRQUFRLEtBQUssZUFBZTtBQUM3QyxVQUFHLFNBQVMsR0FBRztBQUNiO0FBQUEsTUFDRjtBQUVBLFVBQUksUUFBUSxLQUFLLFVBQVUsR0FBRyxLQUFLO0FBQ25DLFVBQUcsRUFBRSxTQUFTLElBQUk7QUFDaEI7QUFBQSxNQUNGO0FBRUEsVUFBSSxRQUFRLEtBQUssVUFBVSxRQUFRLENBQUMsRUFBRSxTQUFTO0FBQy9DLFVBQUcsVUFBVSxRQUFRO0FBQ25CLFVBQUUsS0FBSyxLQUFLO0FBQUEsTUFDZCxPQUFPO0FBQ0wsVUFBRSxLQUFLLElBQUk7QUFBQSxNQUNiO0FBQUEsSUFDRixFQUFFLEtBQUssSUFBSSxDQUFDO0FBRVosUUFBSSxRQUFRLElBQUksWUFBWSxFQUFFLEtBQUs7QUFDbkMsVUFBTSxPQUFPLEVBQUU7QUFDZixVQUFNLEtBQUssRUFBRTtBQUNiLFdBQU87QUFBQSxFQUNUO0FBQUE7QUFBQSxFQUVBLHFCQUFxQjtBQUNuQixRQUFHLENBQUMsS0FBSyxLQUFLO0FBQ1o7QUFBQSxJQUNGO0FBQ0EsUUFBRyxLQUFLLElBQUksZUFBZSxlQUFlLE1BQU07QUFDOUMsV0FBSyxlQUFlLEtBQUssTUFBTTtBQUFBLElBQ2pDO0FBQUEsRUFDRjtBQUFBO0FBQUEsRUFFQSxTQUFTO0FBRVAsU0FBSyxlQUFlLEtBQUssVUFBVTtBQUVuQyxTQUFLLE1BQU0sSUFBSSxlQUFlO0FBRTlCLFNBQUssSUFBSSxpQkFBaUIsWUFBWSxLQUFLLGtCQUFrQixLQUFLLElBQUksQ0FBQztBQUV2RSxTQUFLLElBQUksaUJBQWlCLFFBQVEsS0FBSyxnQkFBZ0IsS0FBSyxJQUFJLENBQUM7QUFFakUsU0FBSyxJQUFJLGlCQUFpQixvQkFBb0IsS0FBSyxtQkFBbUIsS0FBSyxJQUFJLENBQUM7QUFFaEYsU0FBSyxJQUFJLGlCQUFpQixTQUFTLEtBQUssaUJBQWlCLEtBQUssSUFBSSxDQUFDO0FBRW5FLFNBQUssSUFBSSxpQkFBaUIsU0FBUyxLQUFLLGVBQWUsS0FBSyxJQUFJLENBQUM7QUFFakUsU0FBSyxJQUFJLEtBQUssS0FBSyxRQUFRLEtBQUssR0FBRztBQUVuQyxhQUFTLFVBQVUsS0FBSyxTQUFTO0FBQy9CLFdBQUssSUFBSSxpQkFBaUIsUUFBUSxLQUFLLFFBQVEsTUFBTSxDQUFDO0FBQUEsSUFDeEQ7QUFFQSxTQUFLLElBQUksa0JBQWtCLEtBQUs7QUFFaEMsU0FBSyxJQUFJLEtBQUssS0FBSyxPQUFPO0FBQUEsRUFDNUI7QUFBQTtBQUFBLEVBRUEsUUFBUTtBQUNOLFFBQUcsS0FBSyxlQUFlLEtBQUssUUFBUTtBQUNsQztBQUFBLElBQ0Y7QUFDQSxTQUFLLElBQUksTUFBTTtBQUNmLFNBQUssTUFBTTtBQUNYLFNBQUssZUFBZSxLQUFLLE1BQU07QUFBQSxFQUNqQztBQUNGO0FBRUEsT0FBTyxVQUFVOyIsCiAgIm5hbWVzIjogWyJleHBvcnRzIiwgIm1vZHVsZSIsICJWZWNMaXRlIiwgImxpbmVfbGltaXQiLCAiaXRlbSIsICJsaW5rIiwgImZpbGVfbGluayIsICJmaWxlX2xpbmtfbGlzdCJdCn0K
