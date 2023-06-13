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
          folder_path: ".vec_lite",
          exists_adapter: null,
          mkdir_adapter: null,
          read_adapter: null,
          rename_adapter: null,
          stat_adapter: null,
          write_adapter: null,
          ...config
        };
        this.file_name = "embeddings-3.json";
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
      async migrate_embeddings_v2_to_v3() {
        console.log("migrating embeddings-2.json to embeddings-3.json");
        const embeddings_2_file_path = this.folder_path + "/embeddings-2.json";
        const embeddings_2_file = await this.read_file(embeddings_2_file_path);
        const embeddings_2 = JSON.parse(embeddings_2_file);
        const embeddings_3 = {};
        for (const [key, value] of Object.entries(embeddings_2)) {
          const new_obj = {
            vec: value.vec,
            meta: {}
          };
          const meta = value.meta;
          const new_meta = {};
          if (meta.hash)
            new_meta.hash = meta.hash;
          if (meta.file)
            new_meta.parent = meta.file;
          if (meta.blocks)
            new_meta.children = meta.blocks;
          if (meta.mtime)
            new_meta.mtime = meta.mtime;
          if (meta.size)
            new_meta.size = meta.size;
          if (meta.len)
            new_meta.size = meta.len;
          if (meta.path)
            new_meta.path = meta.path;
          new_meta.src = "file";
          new_obj.meta = new_meta;
          embeddings_3[key] = new_obj;
        }
        const embeddings_3_file = JSON.stringify(embeddings_3);
        await this.write_file(this.file_path, embeddings_3_file);
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
      text: "OpenAI Settings"
    });
    new Obsidian.Setting(containerEl).setName("api_key").setDesc("api_key").addText((text) => text.setPlaceholder("Enter your api_key").setValue(this.plugin.settings.api_key).onChange(async (value) => {
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
    const chat_ml = this.chat.prepare_chat_ml();
    const max_total_tokens = Math.round(get_max_chars(this.plugin.settings.smart_chat_model) / 4);
    console.log("max_total_tokens", max_total_tokens);
    const max_available_tokens = max_total_tokens - this.chat.estimate_current_tokens_in_chat_ml();
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
    const std_dev = Math.sqrt(sim.map((x) => Math.pow(x - mean, 2)).reduce((a, b) => a + b) / sim.length);
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
    const MAX_SOURCES = 20;
    const MAX_CHARS = get_max_chars(this.plugin.settings.smart_chat_model);
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
    "gpt-3.5-turbo-16k": 4e4,
    "gpt-4": 2e4,
    "gpt-3.5-turbo": 1e4
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
  // estimate tokens in chat_ml by summing the length of each message
  // and then divide by 3 to estimate number of tokens in chat_ml (tends to overestimate)
  estimate_current_tokens_in_chat_ml() {
    return Math.round(this.chat_ml.reduce((a, b) => a + b.content.length, 0) / 3);
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
    return file_content.substring(0, opts.char_limit);
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vdmVjX2xpdGUvdmVjX2xpdGUuanMiLCAiLi4vc3JjL2luZGV4LmpzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJjbGFzcyBWZWNMaXRlIHtcbiAgY29uc3RydWN0b3IoY29uZmlnKSB7XG4gICAgLy8gc2V0IGRlZmF1bHQgY29uZmlnXG4gICAgdGhpcy5jb25maWcgPSB7XG4gICAgICBmb2xkZXJfcGF0aDogXCIudmVjX2xpdGVcIixcbiAgICAgIGV4aXN0c19hZGFwdGVyOiBudWxsLFxuICAgICAgbWtkaXJfYWRhcHRlcjogbnVsbCxcbiAgICAgIHJlYWRfYWRhcHRlcjogbnVsbCxcbiAgICAgIHJlbmFtZV9hZGFwdGVyOiBudWxsLFxuICAgICAgc3RhdF9hZGFwdGVyOiBudWxsLFxuICAgICAgd3JpdGVfYWRhcHRlcjogbnVsbCxcbiAgICAgIC4uLmNvbmZpZ1xuICAgIH07XG4gICAgdGhpcy5maWxlX25hbWUgPSBcImVtYmVkZGluZ3MtMy5qc29uXCI7XG4gICAgdGhpcy5mb2xkZXJfcGF0aCA9IGNvbmZpZy5mb2xkZXJfcGF0aDtcbiAgICB0aGlzLmZpbGVfcGF0aCA9IHRoaXMuZm9sZGVyX3BhdGggKyBcIi9cIiArIHRoaXMuZmlsZV9uYW1lO1xuICAgIC8vIGdldCBmb2xkZXIgcGF0aFxuICAgIHRoaXMuZW1iZWRkaW5ncyA9IGZhbHNlO1xuICB9XG4gIGFzeW5jIGZpbGVfZXhpc3RzKHBhdGgpIHtcbiAgICBpZiAodGhpcy5jb25maWcuZXhpc3RzX2FkYXB0ZXIpIHtcbiAgICAgIHJldHVybiBhd2FpdCB0aGlzLmNvbmZpZy5leGlzdHNfYWRhcHRlcihwYXRoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gdG9kbyBoYW5kbGUgd2l0aCBmc1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiZXhpc3RzX2FkYXB0ZXIgbm90IHNldFwiKTtcbiAgICB9XG4gIH1cbiAgYXN5bmMgbWtkaXIocGF0aCkge1xuICAgIGlmICh0aGlzLmNvbmZpZy5ta2Rpcl9hZGFwdGVyKSB7XG4gICAgICByZXR1cm4gYXdhaXQgdGhpcy5jb25maWcubWtkaXJfYWRhcHRlcihwYXRoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gdG9kbyBoYW5kbGUgd2l0aCBmc1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFwibWtkaXJfYWRhcHRlciBub3Qgc2V0XCIpO1xuICAgIH1cbiAgfVxuICBhc3luYyByZWFkX2ZpbGUocGF0aCkge1xuICAgIGlmICh0aGlzLmNvbmZpZy5yZWFkX2FkYXB0ZXIpIHtcbiAgICAgIHJldHVybiBhd2FpdCB0aGlzLmNvbmZpZy5yZWFkX2FkYXB0ZXIocGF0aCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIHRvZG8gaGFuZGxlIHdpdGggZnNcbiAgICAgIHRocm93IG5ldyBFcnJvcihcInJlYWRfYWRhcHRlciBub3Qgc2V0XCIpO1xuICAgIH1cbiAgfVxuICBhc3luYyByZW5hbWUob2xkX3BhdGgsIG5ld19wYXRoKSB7XG4gICAgaWYgKHRoaXMuY29uZmlnLnJlbmFtZV9hZGFwdGVyKSB7XG4gICAgICByZXR1cm4gYXdhaXQgdGhpcy5jb25maWcucmVuYW1lX2FkYXB0ZXIob2xkX3BhdGgsIG5ld19wYXRoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gdG9kbyBoYW5kbGUgd2l0aCBmc1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFwicmVuYW1lX2FkYXB0ZXIgbm90IHNldFwiKTtcbiAgICB9XG4gIH1cbiAgYXN5bmMgc3RhdChwYXRoKSB7XG4gICAgaWYgKHRoaXMuY29uZmlnLnN0YXRfYWRhcHRlcikge1xuICAgICAgcmV0dXJuIGF3YWl0IHRoaXMuY29uZmlnLnN0YXRfYWRhcHRlcihwYXRoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gdG9kbyBoYW5kbGUgd2l0aCBmc1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFwic3RhdF9hZGFwdGVyIG5vdCBzZXRcIik7XG4gICAgfVxuICB9XG4gIGFzeW5jIHdyaXRlX2ZpbGUocGF0aCwgZGF0YSkge1xuICAgIGlmICh0aGlzLmNvbmZpZy53cml0ZV9hZGFwdGVyKSB7XG4gICAgICByZXR1cm4gYXdhaXQgdGhpcy5jb25maWcud3JpdGVfYWRhcHRlcihwYXRoLCBkYXRhKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gdG9kbyBoYW5kbGUgd2l0aCBmc1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFwid3JpdGVfYWRhcHRlciBub3Qgc2V0XCIpO1xuICAgIH1cbiAgfVxuICBhc3luYyBsb2FkKHJldHJpZXMgPSAwKSB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IGVtYmVkZGluZ3NfZmlsZSA9IGF3YWl0IHRoaXMucmVhZF9maWxlKHRoaXMuZmlsZV9wYXRoKTtcbiAgICAgIC8vIGxvYWRlZCBlbWJlZGRpbmdzIGZyb20gZmlsZVxuICAgICAgdGhpcy5lbWJlZGRpbmdzID0gSlNPTi5wYXJzZShlbWJlZGRpbmdzX2ZpbGUpO1xuICAgICAgY29uc29sZS5sb2coXCJsb2FkZWQgZW1iZWRkaW5ncyBmaWxlOiBcIit0aGlzLmZpbGVfcGF0aCk7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgLy8gcmV0cnkgaWYgZXJyb3IgdXAgdG8gMyB0aW1lc1xuICAgICAgaWYgKHJldHJpZXMgPCAzKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKFwicmV0cnlpbmcgbG9hZCgpXCIpO1xuICAgICAgICAvLyBpbmNyZWFzZSB3YWl0IHRpbWUgYmV0d2VlbiByZXRyaWVzXG4gICAgICAgIGF3YWl0IG5ldyBQcm9taXNlKHIgPT4gc2V0VGltZW91dChyLCAxMDAwICsgKDEwMDAgKiByZXRyaWVzKSkpO1xuICAgICAgICByZXR1cm4gYXdhaXQgdGhpcy5sb2FkKHJldHJpZXMgKyAxKTtcbiAgICAgIH0gZWxzZSBpZiAocmV0cmllcyA9PT0gMykge1xuICAgICAgICAvLyBjaGVjayBmb3IgZW1iZWRkaW5ncy0yLmpzb24gZmlsZVxuICAgICAgICBjb25zdCBlbWJlZGRpbmdzXzJfZmlsZV9wYXRoID0gdGhpcy5mb2xkZXJfcGF0aCArIFwiL2VtYmVkZGluZ3MtMi5qc29uXCI7XG4gICAgICAgIGNvbnN0IGVtYmVkZGluZ3NfMl9maWxlX2V4aXN0cyA9IGF3YWl0IHRoaXMuZmlsZV9leGlzdHMoZW1iZWRkaW5nc18yX2ZpbGVfcGF0aCk7XG4gICAgICAgIGlmIChlbWJlZGRpbmdzXzJfZmlsZV9leGlzdHMpIHtcbiAgICAgICAgICBhd2FpdCB0aGlzLm1pZ3JhdGVfZW1iZWRkaW5nc192Ml90b192MygpO1xuICAgICAgICAgIHJldHVybiBhd2FpdCB0aGlzLmxvYWQocmV0cmllcyArIDEpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBjb25zb2xlLmxvZyhcImZhaWxlZCB0byBsb2FkIGVtYmVkZGluZ3MgZmlsZSwgcHJvbXB0IHVzZXIgdG8gaW5pdGlhdGUgYnVsayBlbWJlZFwiKTtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH1cbiAgYXN5bmMgbWlncmF0ZV9lbWJlZGRpbmdzX3YyX3RvX3YzKCkge1xuICAgIGNvbnNvbGUubG9nKFwibWlncmF0aW5nIGVtYmVkZGluZ3MtMi5qc29uIHRvIGVtYmVkZGluZ3MtMy5qc29uXCIpO1xuICAgIC8vIGxvYWQgZW1iZWRkaW5ncy0yLmpzb25cbiAgICBjb25zdCBlbWJlZGRpbmdzXzJfZmlsZV9wYXRoID0gdGhpcy5mb2xkZXJfcGF0aCArIFwiL2VtYmVkZGluZ3MtMi5qc29uXCI7XG4gICAgY29uc3QgZW1iZWRkaW5nc18yX2ZpbGUgPSBhd2FpdCB0aGlzLnJlYWRfZmlsZShlbWJlZGRpbmdzXzJfZmlsZV9wYXRoKTtcbiAgICBjb25zdCBlbWJlZGRpbmdzXzIgPSBKU09OLnBhcnNlKGVtYmVkZGluZ3NfMl9maWxlKTtcbiAgICAvLyBjb252ZXJ0IGVtYmVkZGluZ3MtMi5qc29uIHRvIGVtYmVkZGluZ3MtMy5qc29uXG4gICAgY29uc3QgZW1iZWRkaW5nc18zID0ge307XG4gICAgZm9yIChjb25zdCBba2V5LCB2YWx1ZV0gb2YgT2JqZWN0LmVudHJpZXMoZW1iZWRkaW5nc18yKSkge1xuICAgICAgY29uc3QgbmV3X29iaiA9IHtcbiAgICAgICAgdmVjOiB2YWx1ZS52ZWMsXG4gICAgICAgIG1ldGE6IHt9XG4gICAgICB9O1xuICAgICAgY29uc3QgbWV0YSA9IHZhbHVlLm1ldGE7XG4gICAgICBjb25zdCBuZXdfbWV0YSA9IHt9O1xuICAgICAgaWYobWV0YS5oYXNoKSBuZXdfbWV0YS5oYXNoID0gbWV0YS5oYXNoO1xuICAgICAgaWYobWV0YS5maWxlKSBuZXdfbWV0YS5wYXJlbnQgPSBtZXRhLmZpbGU7XG4gICAgICBpZihtZXRhLmJsb2NrcykgbmV3X21ldGEuY2hpbGRyZW4gPSBtZXRhLmJsb2NrcztcbiAgICAgIGlmKG1ldGEubXRpbWUpIG5ld19tZXRhLm10aW1lID0gbWV0YS5tdGltZTtcbiAgICAgIGlmKG1ldGEuc2l6ZSkgbmV3X21ldGEuc2l6ZSA9IG1ldGEuc2l6ZTtcbiAgICAgIGlmKG1ldGEubGVuKSBuZXdfbWV0YS5zaXplID0gbWV0YS5sZW47XG4gICAgICBpZihtZXRhLnBhdGgpIG5ld19tZXRhLnBhdGggPSBtZXRhLnBhdGg7XG4gICAgICBuZXdfbWV0YS5zcmMgPSBcImZpbGVcIjtcbiAgICAgIG5ld19vYmoubWV0YSA9IG5ld19tZXRhO1xuICAgICAgZW1iZWRkaW5nc18zW2tleV0gPSBuZXdfb2JqO1xuICAgIH1cbiAgICAvLyB3cml0ZSBlbWJlZGRpbmdzLTMuanNvblxuICAgIGNvbnN0IGVtYmVkZGluZ3NfM19maWxlID0gSlNPTi5zdHJpbmdpZnkoZW1iZWRkaW5nc18zKTtcbiAgICBhd2FpdCB0aGlzLndyaXRlX2ZpbGUodGhpcy5maWxlX3BhdGgsIGVtYmVkZGluZ3NfM19maWxlKTtcbiAgfVxuXG4gIGFzeW5jIGluaXRfZW1iZWRkaW5nc19maWxlKCkge1xuICAgIC8vIGNoZWNrIGlmIGZvbGRlciBleGlzdHNcbiAgICBpZiAoIShhd2FpdCB0aGlzLmZpbGVfZXhpc3RzKHRoaXMuZm9sZGVyX3BhdGgpKSkge1xuICAgICAgLy8gY3JlYXRlIGZvbGRlclxuICAgICAgYXdhaXQgdGhpcy5ta2Rpcih0aGlzLmZvbGRlcl9wYXRoKTtcbiAgICAgIGNvbnNvbGUubG9nKFwiY3JlYXRlZCBmb2xkZXI6IFwiK3RoaXMuZm9sZGVyX3BhdGgpO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zb2xlLmxvZyhcImZvbGRlciBhbHJlYWR5IGV4aXN0czogXCIrdGhpcy5mb2xkZXJfcGF0aCk7XG4gICAgfVxuICAgIC8vIGNoZWNrIGlmIGVtYmVkZGluZ3MgZmlsZSBleGlzdHNcbiAgICBpZiAoIShhd2FpdCB0aGlzLmZpbGVfZXhpc3RzKHRoaXMuZmlsZV9wYXRoKSkpIHtcbiAgICAgIC8vIGNyZWF0ZSBlbWJlZGRpbmdzIGZpbGVcbiAgICAgIGF3YWl0IHRoaXMud3JpdGVfZmlsZSh0aGlzLmZpbGVfcGF0aCwgXCJ7fVwiKTtcbiAgICAgIGNvbnNvbGUubG9nKFwiY3JlYXRlZCBlbWJlZGRpbmdzIGZpbGU6IFwiK3RoaXMuZmlsZV9wYXRoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc29sZS5sb2coXCJlbWJlZGRpbmdzIGZpbGUgYWxyZWFkeSBleGlzdHM6IFwiK3RoaXMuZmlsZV9wYXRoKTtcbiAgICB9XG4gIH1cblxuICBhc3luYyBzYXZlKCkge1xuICAgIGNvbnN0IGVtYmVkZGluZ3MgPSBKU09OLnN0cmluZ2lmeSh0aGlzLmVtYmVkZGluZ3MpO1xuICAgIC8vIGNoZWNrIGlmIGVtYmVkZGluZ3MgZmlsZSBleGlzdHNcbiAgICBjb25zdCBlbWJlZGRpbmdzX2ZpbGVfZXhpc3RzID0gYXdhaXQgdGhpcy5maWxlX2V4aXN0cyh0aGlzLmZpbGVfcGF0aCk7XG4gICAgLy8gaWYgZW1iZWRkaW5ncyBmaWxlIGV4aXN0cyB0aGVuIGNoZWNrIGlmIG5ldyBlbWJlZGRpbmdzIGZpbGUgc2l6ZSBpcyBzaWduaWZpY2FudGx5IHNtYWxsZXIgdGhhbiBleGlzdGluZyBlbWJlZGRpbmdzIGZpbGUgc2l6ZVxuICAgIGlmIChlbWJlZGRpbmdzX2ZpbGVfZXhpc3RzKSB7XG4gICAgICAvLyBlc2l0bWF0ZSBmaWxlIHNpemUgb2YgZW1iZWRkaW5nc1xuICAgICAgY29uc3QgbmV3X2ZpbGVfc2l6ZSA9IGVtYmVkZGluZ3MubGVuZ3RoO1xuICAgICAgLy8gZ2V0IGV4aXN0aW5nIGZpbGUgc2l6ZVxuICAgICAgY29uc3QgZXhpc3RpbmdfZmlsZV9zaXplID0gYXdhaXQgdGhpcy5zdGF0KHRoaXMuZmlsZV9wYXRoKS50aGVuKChzdGF0KSA9PiBzdGF0LnNpemUpO1xuICAgICAgLy8gY29uc29sZS5sb2coXCJuZXcgZmlsZSBzaXplOiBcIituZXdfZmlsZV9zaXplKTtcbiAgICAgIC8vIGNvbnNvbGUubG9nKFwiZXhpc3RpbmcgZmlsZSBzaXplOiBcIitleGlzdGluZ19maWxlX3NpemUpO1xuICAgICAgLy8gaWYgbmV3IGZpbGUgc2l6ZSBpcyBhdCBsZWFzdCA1MCUgb2YgZXhpc3RpbmcgZmlsZSBzaXplIHRoZW4gd3JpdGUgZW1iZWRkaW5ncyB0byBmaWxlXG4gICAgICBpZiAobmV3X2ZpbGVfc2l6ZSA+IChleGlzdGluZ19maWxlX3NpemUgKiAwLjUpKSB7XG4gICAgICAgIC8vIHdyaXRlIGVtYmVkZGluZ3MgdG8gZmlsZVxuICAgICAgICBhd2FpdCB0aGlzLndyaXRlX2ZpbGUodGhpcy5maWxlX3BhdGgsIGVtYmVkZGluZ3MpO1xuICAgICAgICBjb25zb2xlLmxvZyhcImVtYmVkZGluZ3MgZmlsZSBzaXplOiBcIiArIG5ld19maWxlX3NpemUgKyBcIiBieXRlc1wiKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIGlmIG5ldyBmaWxlIHNpemUgaXMgc2lnbmlmaWNhbnRseSBzbWFsbGVyIHRoYW4gZXhpc3RpbmcgZmlsZSBzaXplIHRoZW4gdGhyb3cgZXJyb3JcbiAgICAgICAgLy8gc2hvdyB3YXJuaW5nIG1lc3NhZ2UgaW5jbHVkaW5nIGZpbGUgc2l6ZXNcbiAgICAgICAgY29uc3Qgd2FybmluZ19tZXNzYWdlID0gW1xuICAgICAgICAgIFwiV2FybmluZzogTmV3IGVtYmVkZGluZ3MgZmlsZSBzaXplIGlzIHNpZ25pZmljYW50bHkgc21hbGxlciB0aGFuIGV4aXN0aW5nIGVtYmVkZGluZ3MgZmlsZSBzaXplLlwiLFxuICAgICAgICAgIFwiQWJvcnRpbmcgdG8gcHJldmVudCBwb3NzaWJsZSBsb3NzIG9mIGVtYmVkZGluZ3MgZGF0YS5cIixcbiAgICAgICAgICBcIk5ldyBmaWxlIHNpemU6IFwiICsgbmV3X2ZpbGVfc2l6ZSArIFwiIGJ5dGVzLlwiLFxuICAgICAgICAgIFwiRXhpc3RpbmcgZmlsZSBzaXplOiBcIiArIGV4aXN0aW5nX2ZpbGVfc2l6ZSArIFwiIGJ5dGVzLlwiLFxuICAgICAgICAgIFwiUmVzdGFydGluZyBPYnNpZGlhbiBtYXkgZml4IHRoaXMuXCJcbiAgICAgICAgXTtcbiAgICAgICAgY29uc29sZS5sb2cod2FybmluZ19tZXNzYWdlLmpvaW4oXCIgXCIpKTtcbiAgICAgICAgLy8gc2F2ZSBlbWJlZGRpbmdzIHRvIGZpbGUgbmFtZWQgdW5zYXZlZC1lbWJlZGRpbmdzLmpzb25cbiAgICAgICAgYXdhaXQgdGhpcy53cml0ZV9maWxlKHRoaXMuZm9sZGVyX3BhdGgrXCIvdW5zYXZlZC1lbWJlZGRpbmdzLmpzb25cIiwgZW1iZWRkaW5ncyk7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIkVycm9yOiBOZXcgZW1iZWRkaW5ncyBmaWxlIHNpemUgaXMgc2lnbmlmaWNhbnRseSBzbWFsbGVyIHRoYW4gZXhpc3RpbmcgZW1iZWRkaW5ncyBmaWxlIHNpemUuIEFib3J0aW5nIHRvIHByZXZlbnQgcG9zc2libGUgbG9zcyBvZiBlbWJlZGRpbmdzIGRhdGEuXCIpO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBhd2FpdCB0aGlzLmluaXRfZW1iZWRkaW5nc19maWxlKCk7XG4gICAgICByZXR1cm4gYXdhaXQgdGhpcy5zYXZlKCk7XG4gICAgfVxuICAgIHJldHVybiB0cnVlO1xuICB9XG4gIGNvc19zaW0odmVjdG9yMSwgdmVjdG9yMikge1xuICAgIGxldCBkb3RQcm9kdWN0ID0gMDtcbiAgICBsZXQgbm9ybUEgPSAwO1xuICAgIGxldCBub3JtQiA9IDA7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCB2ZWN0b3IxLmxlbmd0aDsgaSsrKSB7XG4gICAgICBkb3RQcm9kdWN0ICs9IHZlY3RvcjFbaV0gKiB2ZWN0b3IyW2ldO1xuICAgICAgbm9ybUEgKz0gdmVjdG9yMVtpXSAqIHZlY3RvcjFbaV07XG4gICAgICBub3JtQiArPSB2ZWN0b3IyW2ldICogdmVjdG9yMltpXTtcbiAgICB9XG4gICAgaWYgKG5vcm1BID09PSAwIHx8IG5vcm1CID09PSAwKSB7XG4gICAgICByZXR1cm4gMDtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIGRvdFByb2R1Y3QgLyAoTWF0aC5zcXJ0KG5vcm1BKSAqIE1hdGguc3FydChub3JtQikpO1xuICAgIH1cbiAgfVxuICBuZWFyZXN0KHRvX3ZlYywgZmlsdGVyID0ge30pIHtcbiAgICBmaWx0ZXIgPSB7XG4gICAgICByZXN1bHRzX2NvdW50OiAzMCxcbiAgICAgIC4uLmZpbHRlclxuICAgIH07XG4gICAgbGV0IG5lYXJlc3QgPSBbXTtcbiAgICBjb25zdCBmcm9tX2tleXMgPSBPYmplY3Qua2V5cyh0aGlzLmVtYmVkZGluZ3MpO1xuICAgIC8vIHRoaXMucmVuZGVyX2xvZy50b3RhbF9lbWJlZGRpbmdzID0gZnJvbV9rZXlzLmxlbmd0aDtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGZyb21fa2V5cy5sZW5ndGg7IGkrKykge1xuICAgICAgLy8gaWYgdGhpcy5zZXR0aW5ncy5za2lwX3NlY3Rpb25zIGlzIHRydWVcbiAgICAgIGlmIChmaWx0ZXIuc2tpcF9zZWN0aW9ucykge1xuICAgICAgICBjb25zdCBmcm9tX3BhdGggPSB0aGlzLmVtYmVkZGluZ3NbZnJvbV9rZXlzW2ldXS5tZXRhLnBhdGg7XG4gICAgICAgIGlmIChmcm9tX3BhdGguaW5kZXhPZihcIiNcIikgPiAtMSkgY29udGludWU7IC8vIHNraXAgaWYgY29udGFpbnMgIyBpbmRpY2F0aW5nIGJsb2NrIChzZWN0aW9uKVxuXG4gICAgICAgIC8vIFRPRE86IGNvbnNpZGVyIHVzaW5nIHByZXNlbmNlIG9mIG1ldGEucGFyZW50IHRvIHNraXAgZmlsZXMgKGZhc3RlciBjaGVja2luZz8pXG4gICAgICB9XG4gICAgICBpZiAoZmlsdGVyLnNraXBfa2V5KSB7XG4gICAgICAgIGlmIChmaWx0ZXIuc2tpcF9rZXkgPT09IGZyb21fa2V5c1tpXSkgY29udGludWU7IC8vIHNraXAgbWF0Y2hpbmcgdG8gY3VycmVudCBub3RlXG4gICAgICAgIGlmIChmaWx0ZXIuc2tpcF9rZXkgPT09IHRoaXMuZW1iZWRkaW5nc1tmcm9tX2tleXNbaV1dLm1ldGEucGFyZW50KSBjb250aW51ZTsgLy8gc2tpcCBpZiBmaWx0ZXIuc2tpcF9rZXkgbWF0Y2hlcyBtZXRhLnBhcmVudFxuICAgICAgfVxuICAgICAgLy8gaWYgZmlsdGVyLnBhdGhfYmVnaW5zX3dpdGggaXMgc2V0IChmb2xkZXIgZmlsdGVyKVxuICAgICAgaWYgKGZpbHRlci5wYXRoX2JlZ2luc193aXRoKSB7XG4gICAgICAgIC8vIGlmIHR5cGUgaXMgc3RyaW5nICYgbWV0YS5wYXRoIGRvZXMgbm90IGJlZ2luIHdpdGggZmlsdGVyLnBhdGhfYmVnaW5zX3dpdGgsIHNraXBcbiAgICAgICAgaWYgKHR5cGVvZiBmaWx0ZXIucGF0aF9iZWdpbnNfd2l0aCA9PT0gXCJzdHJpbmdcIiAmJiAhdGhpcy5lbWJlZGRpbmdzW2Zyb21fa2V5c1tpXV0ubWV0YS5wYXRoLnN0YXJ0c1dpdGgoZmlsdGVyLnBhdGhfYmVnaW5zX3dpdGgpKSBjb250aW51ZTtcbiAgICAgICAgLy8gaWYgdHlwZSBpcyBhcnJheSAmIG1ldGEucGF0aCBkb2VzIG5vdCBiZWdpbiB3aXRoIGFueSBvZiB0aGUgZmlsdGVyLnBhdGhfYmVnaW5zX3dpdGgsIHNraXBcbiAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkoZmlsdGVyLnBhdGhfYmVnaW5zX3dpdGgpICYmICFmaWx0ZXIucGF0aF9iZWdpbnNfd2l0aC5zb21lKChwYXRoKSA9PiB0aGlzLmVtYmVkZGluZ3NbZnJvbV9rZXlzW2ldXS5tZXRhLnBhdGguc3RhcnRzV2l0aChwYXRoKSkpIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBuZWFyZXN0LnB1c2goe1xuICAgICAgICBsaW5rOiB0aGlzLmVtYmVkZGluZ3NbZnJvbV9rZXlzW2ldXS5tZXRhLnBhdGgsXG4gICAgICAgIHNpbWlsYXJpdHk6IHRoaXMuY29zX3NpbSh0b192ZWMsIHRoaXMuZW1iZWRkaW5nc1tmcm9tX2tleXNbaV1dLnZlYyksXG4gICAgICAgIHNpemU6IHRoaXMuZW1iZWRkaW5nc1tmcm9tX2tleXNbaV1dLm1ldGEuc2l6ZSxcbiAgICAgIH0pO1xuICAgIH1cbiAgICAvLyBzb3J0IGFycmF5IGJ5IGNvc2luZSBzaW1pbGFyaXR5XG4gICAgbmVhcmVzdC5zb3J0KGZ1bmN0aW9uIChhLCBiKSB7XG4gICAgICByZXR1cm4gYi5zaW1pbGFyaXR5IC0gYS5zaW1pbGFyaXR5O1xuICAgIH0pO1xuICAgIC8vIGNvbnNvbGUubG9nKG5lYXJlc3QpO1xuICAgIC8vIGxpbWl0IHRvIE4gbmVhcmVzdCBjb25uZWN0aW9uc1xuICAgIG5lYXJlc3QgPSBuZWFyZXN0LnNsaWNlKDAsIGZpbHRlci5yZXN1bHRzX2NvdW50KTtcbiAgICByZXR1cm4gbmVhcmVzdDtcbiAgfVxuICBmaW5kX25lYXJlc3RfZW1iZWRkaW5ncyh0b192ZWMsIGZpbHRlcj17fSkge1xuICAgIGNvbnN0IGRlZmF1bHRfZmlsdGVyID0ge1xuICAgICAgbWF4OiB0aGlzLm1heF9zb3VyY2VzLFxuICAgIH07XG4gICAgZmlsdGVyID0gey4uLmRlZmF1bHRfZmlsdGVyLCAuLi5maWx0ZXJ9O1xuICAgIC8vIGhhbmRsZSBpZiB0b192ZWMgaXMgYW4gYXJyYXkgb2YgdmVjdG9yc1xuICAgIC8vIGxldCBuZWFyZXN0ID0gW107XG4gICAgaWYoQXJyYXkuaXNBcnJheSh0b192ZWMpICYmIHRvX3ZlYy5sZW5ndGggIT09IHRoaXMudmVjX2xlbil7XG4gICAgICB0aGlzLm5lYXJlc3QgPSB7fTtcbiAgICAgIGZvcihsZXQgaSA9IDA7IGkgPCB0b192ZWMubGVuZ3RoOyBpKyspe1xuICAgICAgICAvLyBuZWFyZXN0ID0gbmVhcmVzdC5jb25jYXQodGhpcy5maW5kX25lYXJlc3RfZW1iZWRkaW5ncyh0b192ZWNbaV0sIHtcbiAgICAgICAgLy8gICBtYXg6IE1hdGguZmxvb3IoZmlsdGVyLm1heCAvIHRvX3ZlYy5sZW5ndGgpXG4gICAgICAgIC8vIH0pKTtcbiAgICAgICAgdGhpcy5maW5kX25lYXJlc3RfZW1iZWRkaW5ncyh0b192ZWNbaV0sIHtcbiAgICAgICAgICBtYXg6IE1hdGguZmxvb3IoZmlsdGVyLm1heCAvIHRvX3ZlYy5sZW5ndGgpXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1lbHNle1xuICAgICAgY29uc3QgZnJvbV9rZXlzID0gT2JqZWN0LmtleXModGhpcy5lbWJlZGRpbmdzKTtcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZnJvbV9rZXlzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGlmKHRoaXMudmFsaWRhdGVfdHlwZSh0aGlzLmVtYmVkZGluZ3NbZnJvbV9rZXlzW2ldXSkpIGNvbnRpbnVlO1xuICAgICAgICBjb25zdCBzaW0gPSB0aGlzLmNvbXB1dGVDb3NpbmVTaW1pbGFyaXR5KHRvX3ZlYywgdGhpcy5lbWJlZGRpbmdzW2Zyb21fa2V5c1tpXV0udmVjKTtcbiAgICAgICAgaWYodGhpcy5uZWFyZXN0W2Zyb21fa2V5c1tpXV0peyAvLyBpZiBhbHJlYWR5IGNvbXB1dGVkLCB1c2UgY2FjaGVkIHZhbHVlXG4gICAgICAgICAgdGhpcy5uZWFyZXN0W2Zyb21fa2V5c1tpXV0gKz0gc2ltO1xuICAgICAgICB9ZWxzZXtcbiAgICAgICAgICB0aGlzLm5lYXJlc3RbZnJvbV9rZXlzW2ldXSA9IHNpbTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICAvLyBpbml0aWF0ZSBuZWFyZXN0IGFycmF5XG4gICAgbGV0IG5lYXJlc3QgPSBPYmplY3Qua2V5cyh0aGlzLm5lYXJlc3QpLm1hcChrZXkgPT4ge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAga2V5OiBrZXksXG4gICAgICAgIHNpbWlsYXJpdHk6IHRoaXMubmVhcmVzdFtrZXldLFxuICAgICAgfVxuICAgIH0pO1xuICAgIC8vIHNvcnQgYXJyYXkgYnkgY29zaW5lIHNpbWlsYXJpdHlcbiAgICBuZWFyZXN0ID0gdGhpcy5zb3J0X2J5X3NpbWlsYXJpdHkobmVhcmVzdCk7XG4gICAgbmVhcmVzdCA9IG5lYXJlc3Quc2xpY2UoMCwgZmlsdGVyLm1heCk7XG4gICAgLy8gYWRkIGxpbmsgYW5kIGxlbmd0aCB0byByZW1haW5pbmcgbmVhcmVzdFxuICAgIG5lYXJlc3QgPSBuZWFyZXN0Lm1hcChpdGVtID0+IHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIGxpbms6IHRoaXMuZW1iZWRkaW5nc1tpdGVtLmtleV0ubWV0YS5wYXRoLFxuICAgICAgICBzaW1pbGFyaXR5OiBpdGVtLnNpbWlsYXJpdHksXG4gICAgICAgIGxlbjogdGhpcy5lbWJlZGRpbmdzW2l0ZW0ua2V5XS5tZXRhLmxlbiB8fCB0aGlzLmVtYmVkZGluZ3NbaXRlbS5rZXldLm1ldGEuc2l6ZSxcbiAgICAgIH1cbiAgICB9KTtcbiAgICByZXR1cm4gbmVhcmVzdDtcbiAgfVxuICBzb3J0X2J5X3NpbWlsYXJpdHkobmVhcmVzdCkge1xuICAgIHJldHVybiBuZWFyZXN0LnNvcnQoZnVuY3Rpb24gKGEsIGIpIHtcbiAgICAgIGNvbnN0IGFfc2NvcmUgPSBhLnNpbWlsYXJpdHk7XG4gICAgICBjb25zdCBiX3Njb3JlID0gYi5zaW1pbGFyaXR5O1xuICAgICAgLy8gaWYgYSBpcyBncmVhdGVyIHRoYW4gYiwgcmV0dXJuIC0xXG4gICAgICBpZiAoYV9zY29yZSA+IGJfc2NvcmUpXG4gICAgICAgIHJldHVybiAtMTtcbiAgICAgIC8vIGlmIGEgaXMgbGVzcyB0aGFuIGIsIHJldHVybiAxXG4gICAgICBpZiAoYV9zY29yZSA8IGJfc2NvcmUpXG4gICAgICAgIHJldHVybiAxO1xuICAgICAgLy8gaWYgYSBpcyBlcXVhbCB0byBiLCByZXR1cm4gMFxuICAgICAgcmV0dXJuIDA7XG4gICAgfSk7XG4gIH1cbiAgLy8gY2hlY2sgaWYga2V5IGZyb20gZW1iZWRkaW5ncyBleGlzdHMgaW4gZmlsZXNcbiAgY2xlYW5fdXBfZW1iZWRkaW5ncyhmaWxlcykge1xuICAgIGNvbnNvbGUubG9nKFwiY2xlYW5pbmcgdXAgZW1iZWRkaW5nc1wiKTtcbiAgICBjb25zdCBrZXlzID0gT2JqZWN0LmtleXModGhpcy5lbWJlZGRpbmdzKTtcbiAgICBsZXQgZGVsZXRlZF9lbWJlZGRpbmdzID0gMDtcbiAgICBmb3IgKGNvbnN0IGtleSBvZiBrZXlzKSB7XG4gICAgICAvLyBjb25zb2xlLmxvZyhcImtleTogXCIra2V5KTtcbiAgICAgIGNvbnN0IHBhdGggPSB0aGlzLmVtYmVkZGluZ3Nba2V5XS5tZXRhLnBhdGg7XG4gICAgICAvLyBpZiBubyBrZXkgc3RhcnRzIHdpdGggZmlsZSBwYXRoXG4gICAgICBpZighZmlsZXMuZmluZChmaWxlID0+IHBhdGguc3RhcnRzV2l0aChmaWxlLnBhdGgpKSkge1xuICAgICAgICAvLyBkZWxldGUga2V5IGlmIGl0IGRvZXNuJ3QgZXhpc3RcbiAgICAgICAgZGVsZXRlIHRoaXMuZW1iZWRkaW5nc1trZXldO1xuICAgICAgICBkZWxldGVkX2VtYmVkZGluZ3MrKztcbiAgICAgICAgLy8gY29uc29sZS5sb2coXCJkZWxldGluZyAoZGVsZXRlZCBmaWxlKTogXCIgKyBrZXkpO1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIC8vIGlmIGtleSBjb250YWlucyAnIydcbiAgICAgIGlmKHBhdGguaW5kZXhPZihcIiNcIikgPiAtMSkge1xuICAgICAgICBjb25zdCBwYXJlbnRfa2V5ID0gdGhpcy5lbWJlZGRpbmdzW2tleV0ubWV0YS5wYXJlbnQ7XG4gICAgICAgIC8vIGlmIHBhcmVudF9rZXkgbWlzc2luZyBmcm9tIGVtYmVkZGluZ3MgdGhlbiBkZWxldGUga2V5XG4gICAgICAgIGlmKCF0aGlzLmVtYmVkZGluZ3NbcGFyZW50X2tleV0pe1xuICAgICAgICAgIC8vIGRlbGV0ZSBrZXlcbiAgICAgICAgICBkZWxldGUgdGhpcy5lbWJlZGRpbmdzW2tleV07XG4gICAgICAgICAgZGVsZXRlZF9lbWJlZGRpbmdzKys7XG4gICAgICAgICAgLy8gY29uc29sZS5sb2coXCJkZWxldGluZyAobWlzc2luZyBwYXJlbnQpXCIpO1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICAgIC8vIGlmIHBhcmVudF9rZXkgbWlzc2luZyBtZXRhIHRoZW4gZGVsZXRlIGtleVxuICAgICAgICBpZighdGhpcy5lbWJlZGRpbmdzW3BhcmVudF9rZXldLm1ldGEpe1xuICAgICAgICAgIC8vIGRlbGV0ZSBrZXlcbiAgICAgICAgICBkZWxldGUgdGhpcy5lbWJlZGRpbmdzW2tleV07XG4gICAgICAgICAgZGVsZXRlZF9lbWJlZGRpbmdzKys7XG4gICAgICAgICAgLy8gY29uc29sZS5sb2coXCJkZWxldGluZyAocGFyZW50IG1pc3NpbmcgbWV0YSlcIik7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgICAgLy8gaWYgcGFyZW50X2tleSBtaXNzaW5nIGNoaWxkcmVuIHRoZW4gZGVsZXRlIGtleVxuICAgICAgICAvLyBpZiBwYXJlbnRfa2V5IGNoaWxkcmVuIGRvZXNuJ3QgaW5jbHVkZSBrZXkgdGhlbiBkZWxldGUga2V5XG4gICAgICAgIGlmKHRoaXMuZW1iZWRkaW5nc1twYXJlbnRfa2V5XS5tZXRhLmNoaWxkcmVuICYmICh0aGlzLmVtYmVkZGluZ3NbcGFyZW50X2tleV0ubWV0YS5jaGlsZHJlbi5pbmRleE9mKGtleSkgPCAwKSkge1xuICAgICAgICAgIC8vIGRlbGV0ZSBrZXlcbiAgICAgICAgICBkZWxldGUgdGhpcy5lbWJlZGRpbmdzW2tleV07XG4gICAgICAgICAgZGVsZXRlZF9lbWJlZGRpbmdzKys7XG4gICAgICAgICAgLy8gY29uc29sZS5sb2coXCJkZWxldGluZyAobm90IHByZXNlbnQgaW4gcGFyZW50J3MgY2hpbGRyZW4pXCIpO1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB7ZGVsZXRlZF9lbWJlZGRpbmdzOiBkZWxldGVkX2VtYmVkZGluZ3MsIHRvdGFsX2VtYmVkZGluZ3M6IGtleXMubGVuZ3RofTtcbiAgfVxuXG4gIGdldChrZXkpIHtcbiAgICByZXR1cm4gdGhpcy5lbWJlZGRpbmdzW2tleV0gfHwgbnVsbDtcbiAgfVxuICBnZXRfbWV0YShrZXkpIHtcbiAgICBjb25zdCBlbWJlZGRpbmcgPSB0aGlzLmdldChrZXkpO1xuICAgIGlmKGVtYmVkZGluZyAmJiBlbWJlZGRpbmcubWV0YSkge1xuICAgICAgcmV0dXJuIGVtYmVkZGluZy5tZXRhO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICBnZXRfbXRpbWUoa2V5KSB7XG4gICAgY29uc3QgbWV0YSA9IHRoaXMuZ2V0X21ldGEoa2V5KTtcbiAgICBpZihtZXRhICYmIG1ldGEubXRpbWUpIHtcbiAgICAgIHJldHVybiBtZXRhLm10aW1lO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICBnZXRfaGFzaChrZXkpIHtcbiAgICBjb25zdCBtZXRhID0gdGhpcy5nZXRfbWV0YShrZXkpO1xuICAgIGlmKG1ldGEgJiYgbWV0YS5oYXNoKSB7XG4gICAgICByZXR1cm4gbWV0YS5oYXNoO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICBnZXRfc2l6ZShrZXkpIHtcbiAgICBjb25zdCBtZXRhID0gdGhpcy5nZXRfbWV0YShrZXkpO1xuICAgIGlmKG1ldGEgJiYgbWV0YS5zaXplKSB7XG4gICAgICByZXR1cm4gbWV0YS5zaXplO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICBnZXRfY2hpbGRyZW4oa2V5KSB7XG4gICAgY29uc3QgbWV0YSA9IHRoaXMuZ2V0X21ldGEoa2V5KTtcbiAgICBpZihtZXRhICYmIG1ldGEuY2hpbGRyZW4pIHtcbiAgICAgIHJldHVybiBtZXRhLmNoaWxkcmVuO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICBnZXRfdmVjKGtleSkge1xuICAgIGNvbnN0IGVtYmVkZGluZyA9IHRoaXMuZ2V0KGtleSk7XG4gICAgaWYoZW1iZWRkaW5nICYmIGVtYmVkZGluZy52ZWMpIHtcbiAgICAgIHJldHVybiBlbWJlZGRpbmcudmVjO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICBzYXZlX2VtYmVkZGluZyhrZXksIHZlYywgbWV0YSkge1xuICAgIHRoaXMuZW1iZWRkaW5nc1trZXldID0ge1xuICAgICAgdmVjOiB2ZWMsXG4gICAgICBtZXRhOiBtZXRhLFxuICAgIH07XG4gIH1cbiAgbXRpbWVfaXNfY3VycmVudChrZXksIHNvdXJjZV9tdGltZSkge1xuICAgIGNvbnN0IG10aW1lID0gdGhpcy5nZXRfbXRpbWUoa2V5KTtcbiAgICBpZihtdGltZSAmJiBtdGltZSA+PSBzb3VyY2VfbXRpbWUpIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBhc3luYyBmb3JjZV9yZWZyZXNoKCkge1xuICAgIHRoaXMuZW1iZWRkaW5ncyA9IG51bGw7XG4gICAgdGhpcy5lbWJlZGRpbmdzID0ge307XG4gICAgLy8gZ2V0IGN1cnJlbnQgZGF0ZXRpbWUgYXMgdW5peCB0aW1lc3RhbXBcbiAgICBsZXQgY3VycmVudF9kYXRldGltZSA9IE1hdGguZmxvb3IoRGF0ZS5ub3coKSAvIDEwMDApO1xuICAgIC8vIHJlbmFtZSBleGlzdGluZyBlbWJlZGRpbmdzIGZpbGUgdG8gdGhpcy5mb2xkZXJfcGF0aC9lbWJlZGRpbmdzLVlZWVktTU0tREQuanNvblxuICAgIGF3YWl0IHRoaXMucmVuYW1lKHRoaXMuZmlsZV9wYXRoLCB0aGlzLmZvbGRlcl9wYXRoICsgXCIvZW1iZWRkaW5ncy1cIiArIGN1cnJlbnRfZGF0ZXRpbWUgKyBcIi5qc29uXCIpO1xuICAgIC8vIGNyZWF0ZSBuZXcgZW1iZWRkaW5ncyBmaWxlXG4gICAgYXdhaXQgdGhpcy5pbml0X2VtYmVkZGluZ3NfZmlsZSgpO1xuICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gVmVjTGl0ZTsiLCAiY29uc3QgT2JzaWRpYW4gPSByZXF1aXJlKFwib2JzaWRpYW5cIik7XG5jb25zdCBWZWNMaXRlID0gcmVxdWlyZShcInZlYy1saXRlXCIpO1xuXG5jb25zdCBERUZBVUxUX1NFVFRJTkdTID0ge1xuICBhcGlfa2V5OiBcIlwiLFxuICBjaGF0X29wZW46IHRydWUsXG4gIGZpbGVfZXhjbHVzaW9uczogXCJcIixcbiAgZm9sZGVyX2V4Y2x1c2lvbnM6IFwiXCIsXG4gIGhlYWRlcl9leGNsdXNpb25zOiBcIlwiLFxuICBwYXRoX29ubHk6IFwiXCIsXG4gIHNob3dfZnVsbF9wYXRoOiBmYWxzZSxcbiAgZXhwYW5kZWRfdmlldzogdHJ1ZSxcbiAgZ3JvdXBfbmVhcmVzdF9ieV9maWxlOiBmYWxzZSxcbiAgbGFuZ3VhZ2U6IFwiZW5cIixcbiAgbG9nX3JlbmRlcjogZmFsc2UsXG4gIGxvZ19yZW5kZXJfZmlsZXM6IGZhbHNlLFxuICByZWNlbnRseV9zZW50X3JldHJ5X25vdGljZTogZmFsc2UsXG4gIHNraXBfc2VjdGlvbnM6IGZhbHNlLFxuICBzbWFydF9jaGF0X21vZGVsOiBcImdwdC0zLjUtdHVyYm8tMTZrXCIsXG4gIHZpZXdfb3BlbjogdHJ1ZSxcbiAgdmVyc2lvbjogXCJcIixcbn07XG5jb25zdCBNQVhfRU1CRURfU1RSSU5HX0xFTkdUSCA9IDI1MDAwO1xuXG5sZXQgVkVSU0lPTjtcbmNvbnN0IFNVUFBPUlRFRF9GSUxFX1RZUEVTID0gW1wibWRcIiwgXCJjYW52YXNcIl07XG5cbi8vY3JlYXRlIG9uZSBvYmplY3Qgd2l0aCBhbGwgdGhlIHRyYW5zbGF0aW9uc1xuLy8gcmVzZWFyY2ggOiBTTUFSVF9UUkFOU0xBVElPTltsYW5ndWFnZV1ba2V5XVxuY29uc3QgU01BUlRfVFJBTlNMQVRJT04gPSB7XG4gIFwiZW5cIjoge1xuICAgIFwicHJvbm91c1wiOiBbXCJteVwiLCBcIklcIiwgXCJtZVwiLCBcIm1pbmVcIiwgXCJvdXJcIiwgXCJvdXJzXCIsIFwidXNcIiwgXCJ3ZVwiXSxcbiAgICBcInByb21wdFwiOiBcIkJhc2VkIG9uIHlvdXIgbm90ZXNcIixcbiAgICBcImluaXRpYWxfbWVzc2FnZVwiOiBcIkhpLCBJJ20gQ2hhdEdQVCB3aXRoIGFjY2VzcyB0byB5b3VyIG5vdGVzIHZpYSBTbWFydCBDb25uZWN0aW9ucy4gQXNrIG1lIGEgcXVlc3Rpb24gYWJvdXQgeW91ciBub3RlcyBhbmQgSSdsbCB0cnkgdG8gYW5zd2VyIGl0LlwiLFxuICB9LFxuICBcImVzXCI6IHtcbiAgICBcInByb25vdXNcIjogW1wibWlcIiwgXCJ5b1wiLCBcIm1cdTAwRURcIiwgXCJ0XHUwMEZBXCJdLFxuICAgIFwicHJvbXB0XCI6IFwiQmFzXHUwMEUxbmRvc2UgZW4gc3VzIG5vdGFzXCIsXG4gICAgXCJpbml0aWFsX21lc3NhZ2VcIjogXCJIb2xhLCBzb3kgQ2hhdEdQVCBjb24gYWNjZXNvIGEgdHVzIGFwdW50ZXMgYSB0cmF2XHUwMEU5cyBkZSBTbWFydCBDb25uZWN0aW9ucy4gSGF6bWUgdW5hIHByZWd1bnRhIHNvYnJlIHR1cyBhcHVudGVzIGUgaW50ZW50YXJcdTAwRTkgcmVzcG9uZGVydGUuXCIsXG4gIH0sXG4gIFwiZnJcIjoge1xuICAgIFwicHJvbm91c1wiOiBbXCJtZVwiLCBcIm1vblwiLCBcIm1hXCIsIFwibWVzXCIsIFwibW9pXCIsIFwibm91c1wiLCBcIm5vdHJlXCIsIFwibm9zXCIsIFwiamVcIiwgXCJqJ1wiLCBcIm0nXCJdLFxuICAgIFwicHJvbXB0XCI6IFwiRCdhcHJcdTAwRThzIHZvcyBub3Rlc1wiLFxuICAgIFwiaW5pdGlhbF9tZXNzYWdlXCI6IFwiQm9uam91ciwgamUgc3VpcyBDaGF0R1BUIGV0IGonYWkgYWNjXHUwMEU4cyBcdTAwRTAgdm9zIG5vdGVzIHZpYSBTbWFydCBDb25uZWN0aW9ucy4gUG9zZXotbW9pIHVuZSBxdWVzdGlvbiBzdXIgdm9zIG5vdGVzIGV0IGonZXNzYWllcmFpIGQneSByXHUwMEU5cG9uZHJlLlwiLFxuICB9LFxuICBcImRlXCI6IHtcbiAgICBcInByb25vdXNcIjogW1wibWVpblwiLCBcIm1laW5lXCIsIFwibWVpbmVuXCIsIFwibWVpbmVyXCIsIFwibWVpbmVzXCIsIFwibWlyXCIsIFwidW5zXCIsIFwidW5zZXJcIiwgXCJ1bnNlcmVuXCIsIFwidW5zZXJlclwiLCBcInVuc2VyZXNcIl0sXG4gICAgXCJwcm9tcHRcIjogXCJCYXNpZXJlbmQgYXVmIElocmVuIE5vdGl6ZW5cIixcbiAgICBcImluaXRpYWxfbWVzc2FnZVwiOiBcIkhhbGxvLCBpY2ggYmluIENoYXRHUFQgdW5kIGhhYmUgXHUwMEZDYmVyIFNtYXJ0IENvbm5lY3Rpb25zIFp1Z2FuZyB6dSBJaHJlbiBOb3RpemVuLiBTdGVsbGVuIFNpZSBtaXIgZWluZSBGcmFnZSB6dSBJaHJlbiBOb3RpemVuIHVuZCBpY2ggd2VyZGUgdmVyc3VjaGVuLCBzaWUgenUgYmVhbnR3b3J0ZW4uXCIsXG4gIH0sXG4gIFwiaXRcIjoge1xuICAgIFwicHJvbm91c1wiOiBbXCJtaW9cIiwgXCJtaWFcIiwgXCJtaWVpXCIsIFwibWllXCIsIFwibm9pXCIsIFwibm9zdHJvXCIsIFwibm9zdHJpXCIsIFwibm9zdHJhXCIsIFwibm9zdHJlXCJdLFxuICAgIFwicHJvbXB0XCI6IFwiU3VsbGEgYmFzZSBkZWdsaSBhcHB1bnRpXCIsXG4gICAgXCJpbml0aWFsX21lc3NhZ2VcIjogXCJDaWFvLCBzb25vIENoYXRHUFQgZSBobyBhY2Nlc3NvIGFpIHR1b2kgYXBwdW50aSB0cmFtaXRlIFNtYXJ0IENvbm5lY3Rpb25zLiBGYXRlbWkgdW5hIGRvbWFuZGEgc3VpIHZvc3RyaSBhcHB1bnRpIGUgY2VyY2hlclx1MDBGMiBkaSByaXNwb25kZXJ2aS5cIixcbiAgfSxcbn1cblxuLy8gcmVxdWlyZSBidWlsdC1pbiBjcnlwdG8gbW9kdWxlXG5jb25zdCBjcnlwdG8gPSByZXF1aXJlKFwiY3J5cHRvXCIpO1xuLy8gbWQ1IGhhc2ggdXNpbmcgYnVpbHQgaW4gY3J5cHRvIG1vZHVsZVxuZnVuY3Rpb24gbWQ1KHN0cikge1xuICByZXR1cm4gY3J5cHRvLmNyZWF0ZUhhc2goXCJtZDVcIikudXBkYXRlKHN0cikuZGlnZXN0KFwiaGV4XCIpO1xufVxuXG5jbGFzcyBTbWFydENvbm5lY3Rpb25zUGx1Z2luIGV4dGVuZHMgT2JzaWRpYW4uUGx1Z2luIHtcbiAgLy8gY29uc3RydWN0b3JcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoLi4uYXJndW1lbnRzKTtcbiAgICB0aGlzLmFwaSA9IG51bGw7XG4gICAgdGhpcy5lbWJlZGRpbmdzX2xvYWRlZCA9IGZhbHNlO1xuICAgIHRoaXMuZmlsZV9leGNsdXNpb25zID0gW107XG4gICAgdGhpcy5mb2xkZXJzID0gW107XG4gICAgdGhpcy5oYXNfbmV3X2VtYmVkZGluZ3MgPSBmYWxzZTtcbiAgICB0aGlzLmhlYWRlcl9leGNsdXNpb25zID0gW107XG4gICAgdGhpcy5uZWFyZXN0X2NhY2hlID0ge307XG4gICAgdGhpcy5wYXRoX29ubHkgPSBbXTtcbiAgICB0aGlzLnJlbmRlcl9sb2cgPSB7fTtcbiAgICB0aGlzLnJlbmRlcl9sb2cuZGVsZXRlZF9lbWJlZGRpbmdzID0gMDtcbiAgICB0aGlzLnJlbmRlcl9sb2cuZXhjbHVzaW9uc19sb2dzID0ge307XG4gICAgdGhpcy5yZW5kZXJfbG9nLmZhaWxlZF9lbWJlZGRpbmdzID0gW107XG4gICAgdGhpcy5yZW5kZXJfbG9nLmZpbGVzID0gW107XG4gICAgdGhpcy5yZW5kZXJfbG9nLm5ld19lbWJlZGRpbmdzID0gMDtcbiAgICB0aGlzLnJlbmRlcl9sb2cuc2tpcHBlZF9sb3dfZGVsdGEgPSB7fTtcbiAgICB0aGlzLnJlbmRlcl9sb2cudG9rZW5fdXNhZ2UgPSAwO1xuICAgIHRoaXMucmVuZGVyX2xvZy50b2tlbnNfc2F2ZWRfYnlfY2FjaGUgPSAwO1xuICAgIHRoaXMucmV0cnlfbm90aWNlX3RpbWVvdXQgPSBudWxsO1xuICAgIHRoaXMuc2F2ZV90aW1lb3V0ID0gbnVsbDtcbiAgICB0aGlzLnNjX2JyYW5kaW5nID0ge307XG4gICAgdGhpcy5zZWxmX3JlZl9rd19yZWdleCA9IG51bGw7XG4gICAgdGhpcy51cGRhdGVfYXZhaWxhYmxlID0gZmFsc2U7XG4gIH1cblxuICBhc3luYyBvbmxvYWQoKSB7XG4gICAgLy8gaW5pdGlhbGl6ZSB3aGVuIGxheW91dCBpcyByZWFkeVxuICAgIHRoaXMuYXBwLndvcmtzcGFjZS5vbkxheW91dFJlYWR5KHRoaXMuaW5pdGlhbGl6ZS5iaW5kKHRoaXMpKTtcbiAgfVxuICBvbnVubG9hZCgpIHtcbiAgICB0aGlzLm91dHB1dF9yZW5kZXJfbG9nKCk7XG4gICAgY29uc29sZS5sb2coXCJ1bmxvYWRpbmcgcGx1Z2luXCIpO1xuICAgIHRoaXMuYXBwLndvcmtzcGFjZS5kZXRhY2hMZWF2ZXNPZlR5cGUoU01BUlRfQ09OTkVDVElPTlNfVklFV19UWVBFKTtcbiAgICB0aGlzLmFwcC53b3Jrc3BhY2UuZGV0YWNoTGVhdmVzT2ZUeXBlKFNNQVJUX0NPTk5FQ1RJT05TX0NIQVRfVklFV19UWVBFKTtcbiAgfVxuICBhc3luYyBpbml0aWFsaXplKCkge1xuICAgIGNvbnNvbGUubG9nKFwiTG9hZGluZyBTbWFydCBDb25uZWN0aW9ucyBwbHVnaW5cIik7XG4gICAgVkVSU0lPTiA9IHRoaXMubWFuaWZlc3QudmVyc2lvbjtcbiAgICAvLyBWRVJTSU9OID0gJzEuMC4wJztcbiAgICAvLyBjb25zb2xlLmxvZyhWRVJTSU9OKTtcbiAgICBhd2FpdCB0aGlzLmxvYWRTZXR0aW5ncygpO1xuICAgIC8vIHJ1biBhZnRlciAzIHNlY29uZHNcbiAgICBzZXRUaW1lb3V0KHRoaXMuY2hlY2tfZm9yX3VwZGF0ZS5iaW5kKHRoaXMpLCAzMDAwKTtcbiAgICAvLyBydW4gY2hlY2sgZm9yIHVwZGF0ZSBldmVyeSAzIGhvdXJzXG4gICAgc2V0SW50ZXJ2YWwodGhpcy5jaGVja19mb3JfdXBkYXRlLmJpbmQodGhpcyksIDEwODAwMDAwKTtcblxuICAgIHRoaXMuYWRkSWNvbigpO1xuICAgIHRoaXMuYWRkQ29tbWFuZCh7XG4gICAgICBpZDogXCJzYy1maW5kLW5vdGVzXCIsXG4gICAgICBuYW1lOiBcIkZpbmQ6IE1ha2UgU21hcnQgQ29ubmVjdGlvbnNcIixcbiAgICAgIGljb246IFwicGVuY2lsX2ljb25cIixcbiAgICAgIGhvdGtleXM6IFtdLFxuICAgICAgLy8gZWRpdG9yQ2FsbGJhY2s6IGFzeW5jIChlZGl0b3IpID0+IHtcbiAgICAgIGVkaXRvckNhbGxiYWNrOiBhc3luYyAoZWRpdG9yKSA9PiB7XG4gICAgICAgIGlmKGVkaXRvci5zb21ldGhpbmdTZWxlY3RlZCgpKSB7XG4gICAgICAgICAgLy8gZ2V0IHNlbGVjdGVkIHRleHRcbiAgICAgICAgICBsZXQgc2VsZWN0ZWRfdGV4dCA9IGVkaXRvci5nZXRTZWxlY3Rpb24oKTtcbiAgICAgICAgICAvLyByZW5kZXIgY29ubmVjdGlvbnMgZnJvbSBzZWxlY3RlZCB0ZXh0XG4gICAgICAgICAgYXdhaXQgdGhpcy5tYWtlX2Nvbm5lY3Rpb25zKHNlbGVjdGVkX3RleHQpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIGNsZWFyIG5lYXJlc3RfY2FjaGUgb24gbWFudWFsIGNhbGwgdG8gbWFrZSBjb25uZWN0aW9uc1xuICAgICAgICAgIHRoaXMubmVhcmVzdF9jYWNoZSA9IHt9O1xuICAgICAgICAgIC8vIGNvbnNvbGUubG9nKFwiQ2xlYXJlZCBuZWFyZXN0X2NhY2hlXCIpO1xuICAgICAgICAgIGF3YWl0IHRoaXMubWFrZV9jb25uZWN0aW9ucygpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSk7XG4gICAgdGhpcy5hZGRDb21tYW5kKHtcbiAgICAgIGlkOiBcInNtYXJ0LWNvbm5lY3Rpb25zLXZpZXdcIixcbiAgICAgIG5hbWU6IFwiT3BlbjogVmlldyBTbWFydCBDb25uZWN0aW9uc1wiLFxuICAgICAgY2FsbGJhY2s6ICgpID0+IHtcbiAgICAgICAgdGhpcy5vcGVuX3ZpZXcoKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICAvLyBvcGVuIGNoYXQgY29tbWFuZFxuICAgIHRoaXMuYWRkQ29tbWFuZCh7XG4gICAgICBpZDogXCJzbWFydC1jb25uZWN0aW9ucy1jaGF0XCIsXG4gICAgICBuYW1lOiBcIk9wZW46IFNtYXJ0IENoYXQgQ29udmVyc2F0aW9uXCIsXG4gICAgICBjYWxsYmFjazogKCkgPT4ge1xuICAgICAgICB0aGlzLm9wZW5fY2hhdCgpO1xuICAgICAgfVxuICAgIH0pO1xuICAgIC8vIG9wZW4gcmFuZG9tIG5vdGUgZnJvbSBuZWFyZXN0IGNhY2hlXG4gICAgdGhpcy5hZGRDb21tYW5kKHtcbiAgICAgIGlkOiBcInNtYXJ0LWNvbm5lY3Rpb25zLXJhbmRvbVwiLFxuICAgICAgbmFtZTogXCJPcGVuOiBSYW5kb20gTm90ZSBmcm9tIFNtYXJ0IENvbm5lY3Rpb25zXCIsXG4gICAgICBjYWxsYmFjazogKCkgPT4ge1xuICAgICAgICB0aGlzLm9wZW5fcmFuZG9tX25vdGUoKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICAvLyBhZGQgc2V0dGluZ3MgdGFiXG4gICAgdGhpcy5hZGRTZXR0aW5nVGFiKG5ldyBTbWFydENvbm5lY3Rpb25zU2V0dGluZ3NUYWIodGhpcy5hcHAsIHRoaXMpKTtcbiAgICAvLyByZWdpc3RlciBtYWluIHZpZXcgdHlwZVxuICAgIHRoaXMucmVnaXN0ZXJWaWV3KFNNQVJUX0NPTk5FQ1RJT05TX1ZJRVdfVFlQRSwgKGxlYWYpID0+IChuZXcgU21hcnRDb25uZWN0aW9uc1ZpZXcobGVhZiwgdGhpcykpKTtcbiAgICAvLyByZWdpc3RlciBjaGF0IHZpZXcgdHlwZVxuICAgIHRoaXMucmVnaXN0ZXJWaWV3KFNNQVJUX0NPTk5FQ1RJT05TX0NIQVRfVklFV19UWVBFLCAobGVhZikgPT4gKG5ldyBTbWFydENvbm5lY3Rpb25zQ2hhdFZpZXcobGVhZiwgdGhpcykpKTtcbiAgICAvLyBjb2RlLWJsb2NrIHJlbmRlcmVyXG4gICAgdGhpcy5yZWdpc3Rlck1hcmtkb3duQ29kZUJsb2NrUHJvY2Vzc29yKFwic21hcnQtY29ubmVjdGlvbnNcIiwgdGhpcy5yZW5kZXJfY29kZV9ibG9jay5iaW5kKHRoaXMpKTtcblxuICAgIC8vIGlmIHRoaXMgc2V0dGluZ3Mudmlld19vcGVuIGlzIHRydWUsIG9wZW4gdmlldyBvbiBzdGFydHVwXG4gICAgaWYodGhpcy5zZXR0aW5ncy52aWV3X29wZW4pIHtcbiAgICAgIHRoaXMub3Blbl92aWV3KCk7XG4gICAgfVxuICAgIC8vIGlmIHRoaXMgc2V0dGluZ3MuY2hhdF9vcGVuIGlzIHRydWUsIG9wZW4gY2hhdCBvbiBzdGFydHVwXG4gICAgaWYodGhpcy5zZXR0aW5ncy5jaGF0X29wZW4pIHtcbiAgICAgIHRoaXMub3Blbl9jaGF0KCk7XG4gICAgfVxuICAgIC8vIG9uIG5ldyB2ZXJzaW9uXG4gICAgaWYodGhpcy5zZXR0aW5ncy52ZXJzaW9uICE9PSBWRVJTSU9OKSB7XG4gICAgICAvLyB1cGRhdGUgdmVyc2lvblxuICAgICAgdGhpcy5zZXR0aW5ncy52ZXJzaW9uID0gVkVSU0lPTjtcbiAgICAgIC8vIHNhdmUgc2V0dGluZ3NcbiAgICAgIGF3YWl0IHRoaXMuc2F2ZVNldHRpbmdzKCk7XG4gICAgICAvLyBvcGVuIHZpZXdcbiAgICAgIHRoaXMub3Blbl92aWV3KCk7XG4gICAgfVxuICAgIC8vIGNoZWNrIGdpdGh1YiByZWxlYXNlIGVuZHBvaW50IGlmIHVwZGF0ZSBpcyBhdmFpbGFibGVcbiAgICB0aGlzLmFkZF90b19naXRpZ25vcmUoKTtcbiAgICAvKipcbiAgICAgKiBFWFBFUklNRU5UQUxcbiAgICAgKiAtIHdpbmRvdy1iYXNlZCBBUEkgYWNjZXNzXG4gICAgICogLSBjb2RlLWJsb2NrIHJlbmRlcmluZ1xuICAgICAqL1xuICAgIHRoaXMuYXBpID0gbmV3IFNjU2VhcmNoQXBpKHRoaXMuYXBwLCB0aGlzKTtcbiAgICAvLyByZWdpc3RlciBBUEkgdG8gZ2xvYmFsIHdpbmRvdyBvYmplY3RcbiAgICAod2luZG93W1wiU21hcnRTZWFyY2hBcGlcIl0gPSB0aGlzLmFwaSkgJiYgdGhpcy5yZWdpc3RlcigoKSA9PiBkZWxldGUgd2luZG93W1wiU21hcnRTZWFyY2hBcGlcIl0pO1xuXG4gIH1cblxuICBhc3luYyBpbml0X3ZlY3MoKSB7XG4gICAgdGhpcy5zbWFydF92ZWNfbGl0ZSA9IG5ldyBWZWNMaXRlKHtcbiAgICAgIGZvbGRlcl9wYXRoOiBcIi5zbWFydC1jb25uZWN0aW9uc1wiLFxuICAgICAgZXhpc3RzX2FkYXB0ZXI6IHRoaXMuYXBwLnZhdWx0LmFkYXB0ZXIuZXhpc3RzLmJpbmQodGhpcy5hcHAudmF1bHQuYWRhcHRlciksXG4gICAgICBta2Rpcl9hZGFwdGVyOiB0aGlzLmFwcC52YXVsdC5hZGFwdGVyLm1rZGlyLmJpbmQodGhpcy5hcHAudmF1bHQuYWRhcHRlciksXG4gICAgICByZWFkX2FkYXB0ZXI6IHRoaXMuYXBwLnZhdWx0LmFkYXB0ZXIucmVhZC5iaW5kKHRoaXMuYXBwLnZhdWx0LmFkYXB0ZXIpLFxuICAgICAgcmVuYW1lX2FkYXB0ZXI6IHRoaXMuYXBwLnZhdWx0LmFkYXB0ZXIucmVuYW1lLmJpbmQodGhpcy5hcHAudmF1bHQuYWRhcHRlciksXG4gICAgICBzdGF0X2FkYXB0ZXI6IHRoaXMuYXBwLnZhdWx0LmFkYXB0ZXIuc3RhdC5iaW5kKHRoaXMuYXBwLnZhdWx0LmFkYXB0ZXIpLFxuICAgICAgd3JpdGVfYWRhcHRlcjogdGhpcy5hcHAudmF1bHQuYWRhcHRlci53cml0ZS5iaW5kKHRoaXMuYXBwLnZhdWx0LmFkYXB0ZXIpLFxuICAgIH0pO1xuICAgIHRoaXMuZW1iZWRkaW5nc19sb2FkZWQgPSBhd2FpdCB0aGlzLnNtYXJ0X3ZlY19saXRlLmxvYWQoKTtcbiAgICByZXR1cm4gdGhpcy5lbWJlZGRpbmdzX2xvYWRlZDtcbiAgfVxuXG4gIGFzeW5jIGxvYWRTZXR0aW5ncygpIHtcbiAgICB0aGlzLnNldHRpbmdzID0gT2JqZWN0LmFzc2lnbih7fSwgREVGQVVMVF9TRVRUSU5HUywgYXdhaXQgdGhpcy5sb2FkRGF0YSgpKTtcbiAgICAvLyBsb2FkIGZpbGUgZXhjbHVzaW9ucyBpZiBub3QgYmxhbmtcbiAgICBpZih0aGlzLnNldHRpbmdzLmZpbGVfZXhjbHVzaW9ucyAmJiB0aGlzLnNldHRpbmdzLmZpbGVfZXhjbHVzaW9ucy5sZW5ndGggPiAwKSB7XG4gICAgICAvLyBzcGxpdCBmaWxlIGV4Y2x1c2lvbnMgaW50byBhcnJheSBhbmQgdHJpbSB3aGl0ZXNwYWNlXG4gICAgICB0aGlzLmZpbGVfZXhjbHVzaW9ucyA9IHRoaXMuc2V0dGluZ3MuZmlsZV9leGNsdXNpb25zLnNwbGl0KFwiLFwiKS5tYXAoKGZpbGUpID0+IHtcbiAgICAgICAgcmV0dXJuIGZpbGUudHJpbSgpO1xuICAgICAgfSk7XG4gICAgfVxuICAgIC8vIGxvYWQgZm9sZGVyIGV4Y2x1c2lvbnMgaWYgbm90IGJsYW5rXG4gICAgaWYodGhpcy5zZXR0aW5ncy5mb2xkZXJfZXhjbHVzaW9ucyAmJiB0aGlzLnNldHRpbmdzLmZvbGRlcl9leGNsdXNpb25zLmxlbmd0aCA+IDApIHtcbiAgICAgIC8vIGFkZCBzbGFzaCB0byBlbmQgb2YgZm9sZGVyIG5hbWUgaWYgbm90IHByZXNlbnRcbiAgICAgIGNvbnN0IGZvbGRlcl9leGNsdXNpb25zID0gdGhpcy5zZXR0aW5ncy5mb2xkZXJfZXhjbHVzaW9ucy5zcGxpdChcIixcIikubWFwKChmb2xkZXIpID0+IHtcbiAgICAgICAgLy8gdHJpbSB3aGl0ZXNwYWNlXG4gICAgICAgIGZvbGRlciA9IGZvbGRlci50cmltKCk7XG4gICAgICAgIGlmKGZvbGRlci5zbGljZSgtMSkgIT09IFwiL1wiKSB7XG4gICAgICAgICAgcmV0dXJuIGZvbGRlciArIFwiL1wiO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJldHVybiBmb2xkZXI7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgICAgLy8gbWVyZ2UgZm9sZGVyIGV4Y2x1c2lvbnMgd2l0aCBmaWxlIGV4Y2x1c2lvbnNcbiAgICAgIHRoaXMuZmlsZV9leGNsdXNpb25zID0gdGhpcy5maWxlX2V4Y2x1c2lvbnMuY29uY2F0KGZvbGRlcl9leGNsdXNpb25zKTtcbiAgICB9XG4gICAgLy8gbG9hZCBoZWFkZXIgZXhjbHVzaW9ucyBpZiBub3QgYmxhbmtcbiAgICBpZih0aGlzLnNldHRpbmdzLmhlYWRlcl9leGNsdXNpb25zICYmIHRoaXMuc2V0dGluZ3MuaGVhZGVyX2V4Y2x1c2lvbnMubGVuZ3RoID4gMCkge1xuICAgICAgdGhpcy5oZWFkZXJfZXhjbHVzaW9ucyA9IHRoaXMuc2V0dGluZ3MuaGVhZGVyX2V4Y2x1c2lvbnMuc3BsaXQoXCIsXCIpLm1hcCgoaGVhZGVyKSA9PiB7XG4gICAgICAgIHJldHVybiBoZWFkZXIudHJpbSgpO1xuICAgICAgfSk7XG4gICAgfVxuICAgIC8vIGxvYWQgcGF0aF9vbmx5IGlmIG5vdCBibGFua1xuICAgIGlmKHRoaXMuc2V0dGluZ3MucGF0aF9vbmx5ICYmIHRoaXMuc2V0dGluZ3MucGF0aF9vbmx5Lmxlbmd0aCA+IDApIHtcbiAgICAgIHRoaXMucGF0aF9vbmx5ID0gdGhpcy5zZXR0aW5ncy5wYXRoX29ubHkuc3BsaXQoXCIsXCIpLm1hcCgocGF0aCkgPT4ge1xuICAgICAgICByZXR1cm4gcGF0aC50cmltKCk7XG4gICAgICB9KTtcbiAgICB9XG4gICAgLy8gbG9hZCBzZWxmX3JlZl9rd19yZWdleFxuICAgIHRoaXMuc2VsZl9yZWZfa3dfcmVnZXggPSBuZXcgUmVnRXhwKGBcXFxcYigke1NNQVJUX1RSQU5TTEFUSU9OW3RoaXMuc2V0dGluZ3MubGFuZ3VhZ2VdLnByb25vdXMuam9pbihcInxcIil9KVxcXFxiYCwgXCJnaVwiKTtcbiAgICAvLyBsb2FkIGZhaWxlZCBmaWxlc1xuICAgIGF3YWl0IHRoaXMubG9hZF9mYWlsZWRfZmlsZXMoKTtcbiAgfVxuICBhc3luYyBzYXZlU2V0dGluZ3MocmVyZW5kZXI9ZmFsc2UpIHtcbiAgICBhd2FpdCB0aGlzLnNhdmVEYXRhKHRoaXMuc2V0dGluZ3MpO1xuICAgIC8vIHJlLWxvYWQgc2V0dGluZ3MgaW50byBtZW1vcnlcbiAgICBhd2FpdCB0aGlzLmxvYWRTZXR0aW5ncygpO1xuICAgIC8vIHJlLXJlbmRlciB2aWV3IGlmIHNldCB0byB0cnVlIChmb3IgZXhhbXBsZSwgYWZ0ZXIgYWRkaW5nIEFQSSBrZXkpXG4gICAgaWYocmVyZW5kZXIpIHtcbiAgICAgIHRoaXMubmVhcmVzdF9jYWNoZSA9IHt9O1xuICAgICAgYXdhaXQgdGhpcy5tYWtlX2Nvbm5lY3Rpb25zKCk7XG4gICAgfVxuICB9XG5cbiAgLy8gY2hlY2sgZm9yIHVwZGF0ZVxuICBhc3luYyBjaGVja19mb3JfdXBkYXRlKCkge1xuICAgIC8vIGZhaWwgc2lsZW50bHksIGV4LiBpZiBubyBpbnRlcm5ldCBjb25uZWN0aW9uXG4gICAgdHJ5IHtcbiAgICAgIC8vIGdldCBsYXRlc3QgcmVsZWFzZSB2ZXJzaW9uIGZyb20gZ2l0aHViXG4gICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0ICgwLCBPYnNpZGlhbi5yZXF1ZXN0VXJsKSh7XG4gICAgICAgIHVybDogXCJodHRwczovL2FwaS5naXRodWIuY29tL3JlcG9zL2JyaWFucGV0cm8vb2JzaWRpYW4tc21hcnQtY29ubmVjdGlvbnMvcmVsZWFzZXMvbGF0ZXN0XCIsXG4gICAgICAgIG1ldGhvZDogXCJHRVRcIixcbiAgICAgICAgaGVhZGVyczoge1xuICAgICAgICAgIFwiQ29udGVudC1UeXBlXCI6IFwiYXBwbGljYXRpb24vanNvblwiLFxuICAgICAgICB9LFxuICAgICAgICBjb250ZW50VHlwZTogXCJhcHBsaWNhdGlvbi9qc29uXCIsXG4gICAgICB9KTtcbiAgICAgIC8vIGdldCB2ZXJzaW9uIG51bWJlciBmcm9tIHJlc3BvbnNlXG4gICAgICBjb25zdCBsYXRlc3RfcmVsZWFzZSA9IEpTT04ucGFyc2UocmVzcG9uc2UudGV4dCkudGFnX25hbWU7XG4gICAgICAvLyBjb25zb2xlLmxvZyhgTGF0ZXN0IHJlbGVhc2U6ICR7bGF0ZXN0X3JlbGVhc2V9YCk7XG4gICAgICAvLyBpZiBsYXRlc3RfcmVsZWFzZSBpcyBuZXdlciB0aGFuIGN1cnJlbnQgdmVyc2lvbiwgc2hvdyBtZXNzYWdlXG4gICAgICBpZihsYXRlc3RfcmVsZWFzZSAhPT0gVkVSU0lPTikge1xuICAgICAgICBuZXcgT2JzaWRpYW4uTm90aWNlKGBbU21hcnQgQ29ubmVjdGlvbnNdIEEgbmV3IHZlcnNpb24gaXMgYXZhaWxhYmxlISAodiR7bGF0ZXN0X3JlbGVhc2V9KWApO1xuICAgICAgICB0aGlzLnVwZGF0ZV9hdmFpbGFibGUgPSB0cnVlO1xuICAgICAgICB0aGlzLnJlbmRlcl9icmFuZChcImFsbFwiKVxuICAgICAgfVxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmxvZyhlcnJvcik7XG4gICAgfVxuICB9XG5cbiAgYXN5bmMgcmVuZGVyX2NvZGVfYmxvY2soY29udGVudHMsIGNvbnRhaW5lciwgY3R4KSB7XG4gICAgbGV0IG5lYXJlc3Q7XG4gICAgaWYoY29udGVudHMudHJpbSgpLmxlbmd0aCA+IDApIHtcbiAgICAgIG5lYXJlc3QgPSBhd2FpdCB0aGlzLmFwaS5zZWFyY2goY29udGVudHMpO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyB1c2UgY3R4IHRvIGdldCBmaWxlXG4gICAgICBjb25zb2xlLmxvZyhjdHgpO1xuICAgICAgY29uc3QgZmlsZSA9IHRoaXMuYXBwLnZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aChjdHguc291cmNlUGF0aCk7XG4gICAgICBuZWFyZXN0ID0gYXdhaXQgdGhpcy5maW5kX25vdGVfY29ubmVjdGlvbnMoZmlsZSk7XG4gICAgfVxuICAgIGlmIChuZWFyZXN0Lmxlbmd0aCkge1xuICAgICAgdGhpcy51cGRhdGVfcmVzdWx0cyhjb250YWluZXIsIG5lYXJlc3QpO1xuICAgIH1cbiAgfVxuXG4gIGFzeW5jIG1ha2VfY29ubmVjdGlvbnMoc2VsZWN0ZWRfdGV4dD1udWxsKSB7XG4gICAgbGV0IHZpZXcgPSB0aGlzLmdldF92aWV3KCk7XG4gICAgaWYgKCF2aWV3KSB7XG4gICAgICAvLyBvcGVuIHZpZXcgaWYgbm90IG9wZW5cbiAgICAgIGF3YWl0IHRoaXMub3Blbl92aWV3KCk7XG4gICAgICB2aWV3ID0gdGhpcy5nZXRfdmlldygpO1xuICAgIH1cbiAgICBhd2FpdCB2aWV3LnJlbmRlcl9jb25uZWN0aW9ucyhzZWxlY3RlZF90ZXh0KTtcbiAgfVxuXG4gIGFkZEljb24oKXtcbiAgICBPYnNpZGlhbi5hZGRJY29uKFwic21hcnQtY29ubmVjdGlvbnNcIiwgYDxwYXRoIGQ9XCJNNTAsMjAgTDgwLDQwIEw4MCw2MCBMNTAsMTAwXCIgc3Ryb2tlPVwiY3VycmVudENvbG9yXCIgc3Ryb2tlLXdpZHRoPVwiNFwiIGZpbGw9XCJub25lXCIvPlxuICAgIDxwYXRoIGQ9XCJNMzAsNTAgTDU1LDcwXCIgc3Ryb2tlPVwiY3VycmVudENvbG9yXCIgc3Ryb2tlLXdpZHRoPVwiNVwiIGZpbGw9XCJub25lXCIvPlxuICAgIDxjaXJjbGUgY3g9XCI1MFwiIGN5PVwiMjBcIiByPVwiOVwiIGZpbGw9XCJjdXJyZW50Q29sb3JcIi8+XG4gICAgPGNpcmNsZSBjeD1cIjgwXCIgY3k9XCI0MFwiIHI9XCI5XCIgZmlsbD1cImN1cnJlbnRDb2xvclwiLz5cbiAgICA8Y2lyY2xlIGN4PVwiODBcIiBjeT1cIjcwXCIgcj1cIjlcIiBmaWxsPVwiY3VycmVudENvbG9yXCIvPlxuICAgIDxjaXJjbGUgY3g9XCI1MFwiIGN5PVwiMTAwXCIgcj1cIjlcIiBmaWxsPVwiY3VycmVudENvbG9yXCIvPlxuICAgIDxjaXJjbGUgY3g9XCIzMFwiIGN5PVwiNTBcIiByPVwiOVwiIGZpbGw9XCJjdXJyZW50Q29sb3JcIi8+YCk7XG4gIH1cblxuICAvLyBvcGVuIHJhbmRvbSBub3RlXG4gIGFzeW5jIG9wZW5fcmFuZG9tX25vdGUoKSB7XG4gICAgY29uc3QgY3Vycl9maWxlID0gdGhpcy5hcHAud29ya3NwYWNlLmdldEFjdGl2ZUZpbGUoKTtcbiAgICBjb25zdCBjdXJyX2tleSA9IG1kNShjdXJyX2ZpbGUucGF0aCk7XG4gICAgLy8gaWYgbm8gbmVhcmVzdCBjYWNoZSwgY3JlYXRlIE9ic2lkaWFuIG5vdGljZVxuICAgIGlmKHR5cGVvZiB0aGlzLm5lYXJlc3RfY2FjaGVbY3Vycl9rZXldID09PSBcInVuZGVmaW5lZFwiKSB7XG4gICAgICBuZXcgT2JzaWRpYW4uTm90aWNlKFwiW1NtYXJ0IENvbm5lY3Rpb25zXSBObyBTbWFydCBDb25uZWN0aW9ucyBmb3VuZC4gT3BlbiBhIG5vdGUgdG8gZ2V0IFNtYXJ0IENvbm5lY3Rpb25zLlwiKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgLy8gZ2V0IHJhbmRvbSBmcm9tIG5lYXJlc3QgY2FjaGVcbiAgICBjb25zdCByYW5kID0gTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogdGhpcy5uZWFyZXN0X2NhY2hlW2N1cnJfa2V5XS5sZW5ndGgvMik7IC8vIGRpdmlkZSBieSAyIHRvIGxpbWl0IHRvIHRvcCBoYWxmIG9mIHJlc3VsdHNcbiAgICBjb25zdCByYW5kb21fZmlsZSA9IHRoaXMubmVhcmVzdF9jYWNoZVtjdXJyX2tleV1bcmFuZF07XG4gICAgLy8gb3BlbiByYW5kb20gZmlsZVxuICAgIHRoaXMub3Blbl9ub3RlKHJhbmRvbV9maWxlKTtcbiAgfVxuXG4gIGFzeW5jIG9wZW5fdmlldygpIHtcbiAgICBpZih0aGlzLmdldF92aWV3KCkpe1xuICAgICAgY29uc29sZS5sb2coXCJTbWFydCBDb25uZWN0aW9ucyB2aWV3IGFscmVhZHkgb3BlblwiKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgdGhpcy5hcHAud29ya3NwYWNlLmRldGFjaExlYXZlc09mVHlwZShTTUFSVF9DT05ORUNUSU9OU19WSUVXX1RZUEUpO1xuICAgIGF3YWl0IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRSaWdodExlYWYoZmFsc2UpLnNldFZpZXdTdGF0ZSh7XG4gICAgICB0eXBlOiBTTUFSVF9DT05ORUNUSU9OU19WSUVXX1RZUEUsXG4gICAgICBhY3RpdmU6IHRydWUsXG4gICAgfSk7XG4gICAgdGhpcy5hcHAud29ya3NwYWNlLnJldmVhbExlYWYoXG4gICAgICB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0TGVhdmVzT2ZUeXBlKFNNQVJUX0NPTk5FQ1RJT05TX1ZJRVdfVFlQRSlbMF1cbiAgICApO1xuICB9XG4gIC8vIHNvdXJjZTogaHR0cHM6Ly9naXRodWIuY29tL29ic2lkaWFubWQvb2JzaWRpYW4tcmVsZWFzZXMvYmxvYi9tYXN0ZXIvcGx1Z2luLXJldmlldy5tZCNhdm9pZC1tYW5hZ2luZy1yZWZlcmVuY2VzLXRvLWN1c3RvbS12aWV3c1xuICBnZXRfdmlldygpIHtcbiAgICBmb3IgKGxldCBsZWFmIG9mIHRoaXMuYXBwLndvcmtzcGFjZS5nZXRMZWF2ZXNPZlR5cGUoU01BUlRfQ09OTkVDVElPTlNfVklFV19UWVBFKSkge1xuICAgICAgaWYgKGxlYWYudmlldyBpbnN0YW5jZW9mIFNtYXJ0Q29ubmVjdGlvbnNWaWV3KSB7XG4gICAgICAgIHJldHVybiBsZWFmLnZpZXc7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIC8vIG9wZW4gY2hhdCB2aWV3XG4gIGFzeW5jIG9wZW5fY2hhdChyZXRyaWVzPTApIHtcbiAgICBpZighdGhpcy5lbWJlZGRpbmdzX2xvYWRlZCkge1xuICAgICAgY29uc29sZS5sb2coXCJlbWJlZGRpbmdzIG5vdCBsb2FkZWQgeWV0XCIpO1xuICAgICAgaWYocmV0cmllcyA8IDMpIHtcbiAgICAgICAgLy8gd2FpdCBhbmQgdHJ5IGFnYWluXG4gICAgICAgIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICAgIHRoaXMub3Blbl9jaGF0KHJldHJpZXMrMSk7XG4gICAgICAgIH0sIDEwMDAgKiAocmV0cmllcysxKSk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGNvbnNvbGUubG9nKFwiZW1iZWRkaW5ncyBzdGlsbCBub3QgbG9hZGVkLCBvcGVuaW5nIHNtYXJ0IHZpZXdcIik7XG4gICAgICB0aGlzLm9wZW5fdmlldygpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB0aGlzLmFwcC53b3Jrc3BhY2UuZGV0YWNoTGVhdmVzT2ZUeXBlKFNNQVJUX0NPTk5FQ1RJT05TX0NIQVRfVklFV19UWVBFKTtcbiAgICBhd2FpdCB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0UmlnaHRMZWFmKGZhbHNlKS5zZXRWaWV3U3RhdGUoe1xuICAgICAgdHlwZTogU01BUlRfQ09OTkVDVElPTlNfQ0hBVF9WSUVXX1RZUEUsXG4gICAgICBhY3RpdmU6IHRydWUsXG4gICAgfSk7XG4gICAgdGhpcy5hcHAud29ya3NwYWNlLnJldmVhbExlYWYoXG4gICAgICB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0TGVhdmVzT2ZUeXBlKFNNQVJUX0NPTk5FQ1RJT05TX0NIQVRfVklFV19UWVBFKVswXVxuICAgICk7XG4gIH1cbiAgXG4gIC8vIGdldCBlbWJlZGRpbmdzIGZvciBhbGwgZmlsZXNcbiAgYXN5bmMgZ2V0X2FsbF9lbWJlZGRpbmdzKCkge1xuICAgIC8vIGdldCBhbGwgZmlsZXMgaW4gdmF1bHQgYW5kIGZpbHRlciBhbGwgYnV0IG1hcmtkb3duIGFuZCBjYW52YXMgZmlsZXNcbiAgICBjb25zdCBmaWxlcyA9IChhd2FpdCB0aGlzLmFwcC52YXVsdC5nZXRGaWxlcygpKS5maWx0ZXIoKGZpbGUpID0+IGZpbGUgaW5zdGFuY2VvZiBPYnNpZGlhbi5URmlsZSAmJiAoZmlsZS5leHRlbnNpb24gPT09IFwibWRcIiB8fCBmaWxlLmV4dGVuc2lvbiA9PT0gXCJjYW52YXNcIikpO1xuICAgIC8vIGNvbnN0IGZpbGVzID0gYXdhaXQgdGhpcy5hcHAudmF1bHQuZ2V0TWFya2Rvd25GaWxlcygpO1xuICAgIC8vIGdldCBvcGVuIGZpbGVzIHRvIHNraXAgaWYgZmlsZSBpcyBjdXJyZW50bHkgb3BlblxuICAgIGNvbnN0IG9wZW5fZmlsZXMgPSB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0TGVhdmVzT2ZUeXBlKFwibWFya2Rvd25cIikubWFwKChsZWFmKSA9PiBsZWFmLnZpZXcuZmlsZSk7XG4gICAgY29uc3QgY2xlYW5fdXBfbG9nID0gdGhpcy5zbWFydF92ZWNfbGl0ZS5jbGVhbl91cF9lbWJlZGRpbmdzKGZpbGVzKTtcbiAgICBpZih0aGlzLnNldHRpbmdzLmxvZ19yZW5kZXIpe1xuICAgICAgdGhpcy5yZW5kZXJfbG9nLnRvdGFsX2ZpbGVzID0gZmlsZXMubGVuZ3RoO1xuICAgICAgdGhpcy5yZW5kZXJfbG9nLmRlbGV0ZWRfZW1iZWRkaW5ncyA9IGNsZWFuX3VwX2xvZy5kZWxldGVkX2VtYmVkZGluZ3M7XG4gICAgICB0aGlzLnJlbmRlcl9sb2cudG90YWxfZW1iZWRkaW5ncyA9IGNsZWFuX3VwX2xvZy50b3RhbF9lbWJlZGRpbmdzO1xuICAgIH1cbiAgICAvLyBiYXRjaCBlbWJlZGRpbmdzXG4gICAgbGV0IGJhdGNoX3Byb21pc2VzID0gW107XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBmaWxlcy5sZW5ndGg7IGkrKykge1xuICAgICAgLy8gc2tpcCBpZiBwYXRoIGNvbnRhaW5zIGEgI1xuICAgICAgaWYoZmlsZXNbaV0ucGF0aC5pbmRleE9mKFwiI1wiKSA+IC0xKSB7XG4gICAgICAgIC8vIGNvbnNvbGUubG9nKFwic2tpcHBpbmcgZmlsZSAnXCIrZmlsZXNbaV0ucGF0aCtcIicgKHBhdGggY29udGFpbnMgIylcIik7XG4gICAgICAgIHRoaXMubG9nX2V4Y2x1c2lvbihcInBhdGggY29udGFpbnMgI1wiKTtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgICAvLyBza2lwIGlmIGZpbGUgYWxyZWFkeSBoYXMgZW1iZWRkaW5nIGFuZCBlbWJlZGRpbmcubXRpbWUgaXMgZ3JlYXRlciB0aGFuIG9yIGVxdWFsIHRvIGZpbGUubXRpbWVcbiAgICAgIGlmKHRoaXMuc21hcnRfdmVjX2xpdGUubXRpbWVfaXNfY3VycmVudChtZDUoZmlsZXNbaV0ucGF0aCksIGZpbGVzW2ldLnN0YXQubXRpbWUpKSB7XG4gICAgICAgIC8vIGxvZyBza2lwcGluZyBmaWxlXG4gICAgICAgIC8vIGNvbnNvbGUubG9nKFwic2tpcHBpbmcgZmlsZSAobXRpbWUpXCIpO1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIC8vIGNoZWNrIGlmIGZpbGUgaXMgaW4gZmFpbGVkX2ZpbGVzXG4gICAgICBpZih0aGlzLnNldHRpbmdzLmZhaWxlZF9maWxlcy5pbmRleE9mKGZpbGVzW2ldLnBhdGgpID4gLTEpIHtcbiAgICAgICAgLy8gbG9nIHNraXBwaW5nIGZpbGVcbiAgICAgICAgLy8gY29uc29sZS5sb2coXCJza2lwcGluZyBwcmV2aW91c2x5IGZhaWxlZCBmaWxlLCB1c2UgYnV0dG9uIGluIHNldHRpbmdzIHRvIHJldHJ5XCIpO1xuICAgICAgICAvLyB1c2Ugc2V0VGltZW91dCB0byBwcmV2ZW50IG11bHRpcGxlIG5vdGljZXNcbiAgICAgICAgaWYodGhpcy5yZXRyeV9ub3RpY2VfdGltZW91dCkge1xuICAgICAgICAgIGNsZWFyVGltZW91dCh0aGlzLnJldHJ5X25vdGljZV90aW1lb3V0KTtcbiAgICAgICAgICB0aGlzLnJldHJ5X25vdGljZV90aW1lb3V0ID0gbnVsbDtcbiAgICAgICAgfVxuICAgICAgICAvLyBsaW1pdCB0byBvbmUgbm90aWNlIGV2ZXJ5IDEwIG1pbnV0ZXNcbiAgICAgICAgaWYoIXRoaXMucmVjZW50bHlfc2VudF9yZXRyeV9ub3RpY2Upe1xuICAgICAgICAgIG5ldyBPYnNpZGlhbi5Ob3RpY2UoXCJTbWFydCBDb25uZWN0aW9uczogU2tpcHBpbmcgcHJldmlvdXNseSBmYWlsZWQgZmlsZSwgdXNlIGJ1dHRvbiBpbiBzZXR0aW5ncyB0byByZXRyeVwiKTtcbiAgICAgICAgICB0aGlzLnJlY2VudGx5X3NlbnRfcmV0cnlfbm90aWNlID0gdHJ1ZTtcbiAgICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgICAgIHRoaXMucmVjZW50bHlfc2VudF9yZXRyeV9ub3RpY2UgPSBmYWxzZTsgIFxuICAgICAgICAgIH0sIDYwMDAwMCk7XG4gICAgICAgIH1cbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgICAvLyBza2lwIGZpbGVzIHdoZXJlIHBhdGggY29udGFpbnMgYW55IGV4Y2x1c2lvbnNcbiAgICAgIGxldCBza2lwID0gZmFsc2U7XG4gICAgICBmb3IobGV0IGogPSAwOyBqIDwgdGhpcy5maWxlX2V4Y2x1c2lvbnMubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgaWYoZmlsZXNbaV0ucGF0aC5pbmRleE9mKHRoaXMuZmlsZV9leGNsdXNpb25zW2pdKSA+IC0xKSB7XG4gICAgICAgICAgc2tpcCA9IHRydWU7XG4gICAgICAgICAgdGhpcy5sb2dfZXhjbHVzaW9uKHRoaXMuZmlsZV9leGNsdXNpb25zW2pdKTtcbiAgICAgICAgICAvLyBicmVhayBvdXQgb2YgbG9vcFxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZihza2lwKSB7XG4gICAgICAgIGNvbnRpbnVlOyAvLyB0byBuZXh0IGZpbGVcbiAgICAgIH1cbiAgICAgIC8vIGNoZWNrIGlmIGZpbGUgaXMgb3BlblxuICAgICAgaWYob3Blbl9maWxlcy5pbmRleE9mKGZpbGVzW2ldKSA+IC0xKSB7XG4gICAgICAgIC8vIGNvbnNvbGUubG9nKFwic2tpcHBpbmcgZmlsZSAob3BlbilcIik7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgICAgdHJ5IHtcbiAgICAgICAgLy8gcHVzaCBwcm9taXNlIHRvIGJhdGNoX3Byb21pc2VzXG4gICAgICAgIGJhdGNoX3Byb21pc2VzLnB1c2godGhpcy5nZXRfZmlsZV9lbWJlZGRpbmdzKGZpbGVzW2ldLCBmYWxzZSkpO1xuICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgY29uc29sZS5sb2coZXJyb3IpO1xuICAgICAgfVxuICAgICAgLy8gaWYgYmF0Y2hfcHJvbWlzZXMgbGVuZ3RoIGlzIDEwXG4gICAgICBpZihiYXRjaF9wcm9taXNlcy5sZW5ndGggPiAzKSB7XG4gICAgICAgIC8vIHdhaXQgZm9yIGFsbCBwcm9taXNlcyB0byByZXNvbHZlXG4gICAgICAgIGF3YWl0IFByb21pc2UuYWxsKGJhdGNoX3Byb21pc2VzKTtcbiAgICAgICAgLy8gY2xlYXIgYmF0Y2hfcHJvbWlzZXNcbiAgICAgICAgYmF0Y2hfcHJvbWlzZXMgPSBbXTtcbiAgICAgIH1cblxuICAgICAgLy8gc2F2ZSBlbWJlZGRpbmdzIEpTT04gdG8gZmlsZSBldmVyeSAxMDAgZmlsZXMgdG8gc2F2ZSBwcm9ncmVzcyBvbiBidWxrIGVtYmVkZGluZ1xuICAgICAgaWYoaSA+IDAgJiYgaSAlIDEwMCA9PT0gMCkge1xuICAgICAgICBhd2FpdCB0aGlzLnNhdmVfZW1iZWRkaW5nc190b19maWxlKCk7XG4gICAgICB9XG4gICAgfVxuICAgIC8vIHdhaXQgZm9yIGFsbCBwcm9taXNlcyB0byByZXNvbHZlXG4gICAgYXdhaXQgUHJvbWlzZS5hbGwoYmF0Y2hfcHJvbWlzZXMpO1xuICAgIC8vIHdyaXRlIGVtYmVkZGluZ3MgSlNPTiB0byBmaWxlXG4gICAgYXdhaXQgdGhpcy5zYXZlX2VtYmVkZGluZ3NfdG9fZmlsZSgpO1xuICAgIC8vIGlmIHJlbmRlcl9sb2cuZmFpbGVkX2VtYmVkZGluZ3MgdGhlbiB1cGRhdGUgZmFpbGVkX2VtYmVkZGluZ3MudHh0XG4gICAgaWYodGhpcy5yZW5kZXJfbG9nLmZhaWxlZF9lbWJlZGRpbmdzLmxlbmd0aCA+IDApIHtcbiAgICAgIGF3YWl0IHRoaXMuc2F2ZV9mYWlsZWRfZW1iZWRkaW5ncygpO1xuICAgIH1cbiAgfVxuXG4gIGFzeW5jIHNhdmVfZW1iZWRkaW5nc190b19maWxlKGZvcmNlPWZhbHNlKSB7XG4gICAgaWYoIXRoaXMuaGFzX25ld19lbWJlZGRpbmdzKXtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgLy8gY29uc29sZS5sb2coXCJuZXcgZW1iZWRkaW5ncywgc2F2aW5nIHRvIGZpbGVcIik7XG4gICAgaWYoIWZvcmNlKSB7XG4gICAgICAvLyBwcmV2ZW50IGV4Y2Vzc2l2ZSB3cml0ZXMgdG8gZW1iZWRkaW5ncyBmaWxlIGJ5IHdhaXRpbmcgMSBtaW51dGUgYmVmb3JlIHdyaXRpbmdcbiAgICAgIGlmKHRoaXMuc2F2ZV90aW1lb3V0KSB7XG4gICAgICAgIGNsZWFyVGltZW91dCh0aGlzLnNhdmVfdGltZW91dCk7XG4gICAgICAgIHRoaXMuc2F2ZV90aW1lb3V0ID0gbnVsbDsgIFxuICAgICAgfVxuICAgICAgdGhpcy5zYXZlX3RpbWVvdXQgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgLy8gY29uc29sZS5sb2coXCJ3cml0aW5nIGVtYmVkZGluZ3MgdG8gZmlsZVwiKTtcbiAgICAgICAgdGhpcy5zYXZlX2VtYmVkZGluZ3NfdG9fZmlsZSh0cnVlKTtcbiAgICAgICAgLy8gY2xlYXIgdGltZW91dFxuICAgICAgICBpZih0aGlzLnNhdmVfdGltZW91dCkge1xuICAgICAgICAgIGNsZWFyVGltZW91dCh0aGlzLnNhdmVfdGltZW91dCk7XG4gICAgICAgICAgdGhpcy5zYXZlX3RpbWVvdXQgPSBudWxsO1xuICAgICAgICB9XG4gICAgICB9LCAzMDAwMCk7XG4gICAgICBjb25zb2xlLmxvZyhcInNjaGVkdWxlZCBzYXZlXCIpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRyeXtcbiAgICAgIC8vIHVzZSBzbWFydF92ZWNfbGl0ZVxuICAgICAgYXdhaXQgdGhpcy5zbWFydF92ZWNfbGl0ZS5zYXZlKCk7XG4gICAgICB0aGlzLmhhc19uZXdfZW1iZWRkaW5ncyA9IGZhbHNlO1xuICAgIH1jYXRjaChlcnJvcil7XG4gICAgICBjb25zb2xlLmxvZyhlcnJvcik7XG4gICAgICBuZXcgT2JzaWRpYW4uTm90aWNlKFwiU21hcnQgQ29ubmVjdGlvbnM6IFwiK2Vycm9yLm1lc3NhZ2UpO1xuICAgIH1cblxuICB9XG4gIC8vIHNhdmUgZmFpbGVkIGVtYmVkZGluZ3MgdG8gZmlsZSBmcm9tIHJlbmRlcl9sb2cuZmFpbGVkX2VtYmVkZGluZ3NcbiAgYXN5bmMgc2F2ZV9mYWlsZWRfZW1iZWRkaW5ncyAoKSB7XG4gICAgLy8gd3JpdGUgZmFpbGVkX2VtYmVkZGluZ3MgdG8gZmlsZSBvbmUgbGluZSBwZXIgZmFpbGVkIGVtYmVkZGluZ1xuICAgIGxldCBmYWlsZWRfZW1iZWRkaW5ncyA9IFtdO1xuICAgIC8vIGlmIGZpbGUgYWxyZWFkeSBleGlzdHMgdGhlbiByZWFkIGl0XG4gICAgY29uc3QgZmFpbGVkX2VtYmVkZGluZ3NfZmlsZV9leGlzdHMgPSBhd2FpdCB0aGlzLmFwcC52YXVsdC5hZGFwdGVyLmV4aXN0cyhcIi5zbWFydC1jb25uZWN0aW9ucy9mYWlsZWQtZW1iZWRkaW5ncy50eHRcIik7XG4gICAgaWYoZmFpbGVkX2VtYmVkZGluZ3NfZmlsZV9leGlzdHMpIHtcbiAgICAgIGZhaWxlZF9lbWJlZGRpbmdzID0gYXdhaXQgdGhpcy5hcHAudmF1bHQuYWRhcHRlci5yZWFkKFwiLnNtYXJ0LWNvbm5lY3Rpb25zL2ZhaWxlZC1lbWJlZGRpbmdzLnR4dFwiKTtcbiAgICAgIC8vIHNwbGl0IGZhaWxlZF9lbWJlZGRpbmdzIGludG8gYXJyYXlcbiAgICAgIGZhaWxlZF9lbWJlZGRpbmdzID0gZmFpbGVkX2VtYmVkZGluZ3Muc3BsaXQoXCJcXHJcXG5cIik7XG4gICAgfVxuICAgIC8vIG1lcmdlIGZhaWxlZF9lbWJlZGRpbmdzIHdpdGggcmVuZGVyX2xvZy5mYWlsZWRfZW1iZWRkaW5nc1xuICAgIGZhaWxlZF9lbWJlZGRpbmdzID0gZmFpbGVkX2VtYmVkZGluZ3MuY29uY2F0KHRoaXMucmVuZGVyX2xvZy5mYWlsZWRfZW1iZWRkaW5ncyk7XG4gICAgLy8gcmVtb3ZlIGR1cGxpY2F0ZXNcbiAgICBmYWlsZWRfZW1iZWRkaW5ncyA9IFsuLi5uZXcgU2V0KGZhaWxlZF9lbWJlZGRpbmdzKV07XG4gICAgLy8gc29ydCBmYWlsZWRfZW1iZWRkaW5ncyBhcnJheSBhbHBoYWJldGljYWxseVxuICAgIGZhaWxlZF9lbWJlZGRpbmdzLnNvcnQoKTtcbiAgICAvLyBjb252ZXJ0IGZhaWxlZF9lbWJlZGRpbmdzIGFycmF5IHRvIHN0cmluZ1xuICAgIGZhaWxlZF9lbWJlZGRpbmdzID0gZmFpbGVkX2VtYmVkZGluZ3Muam9pbihcIlxcclxcblwiKTtcbiAgICAvLyB3cml0ZSBmYWlsZWRfZW1iZWRkaW5ncyB0byBmaWxlXG4gICAgYXdhaXQgdGhpcy5hcHAudmF1bHQuYWRhcHRlci53cml0ZShcIi5zbWFydC1jb25uZWN0aW9ucy9mYWlsZWQtZW1iZWRkaW5ncy50eHRcIiwgZmFpbGVkX2VtYmVkZGluZ3MpO1xuICAgIC8vIHJlbG9hZCBmYWlsZWRfZW1iZWRkaW5ncyB0byBwcmV2ZW50IHJldHJ5aW5nIGZhaWxlZCBmaWxlcyB1bnRpbCBleHBsaWNpdGx5IHJlcXVlc3RlZFxuICAgIGF3YWl0IHRoaXMubG9hZF9mYWlsZWRfZmlsZXMoKTtcbiAgfVxuICBcbiAgLy8gbG9hZCBmYWlsZWQgZmlsZXMgZnJvbSBmYWlsZWQtZW1iZWRkaW5ncy50eHRcbiAgYXN5bmMgbG9hZF9mYWlsZWRfZmlsZXMgKCkge1xuICAgIC8vIGNoZWNrIGlmIGZhaWxlZC1lbWJlZGRpbmdzLnR4dCBleGlzdHNcbiAgICBjb25zdCBmYWlsZWRfZW1iZWRkaW5nc19maWxlX2V4aXN0cyA9IGF3YWl0IHRoaXMuYXBwLnZhdWx0LmFkYXB0ZXIuZXhpc3RzKFwiLnNtYXJ0LWNvbm5lY3Rpb25zL2ZhaWxlZC1lbWJlZGRpbmdzLnR4dFwiKTtcbiAgICBpZighZmFpbGVkX2VtYmVkZGluZ3NfZmlsZV9leGlzdHMpIHtcbiAgICAgIHRoaXMuc2V0dGluZ3MuZmFpbGVkX2ZpbGVzID0gW107XG4gICAgICBjb25zb2xlLmxvZyhcIk5vIGZhaWxlZCBmaWxlcy5cIik7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIC8vIHJlYWQgZmFpbGVkLWVtYmVkZGluZ3MudHh0XG4gICAgY29uc3QgZmFpbGVkX2VtYmVkZGluZ3MgPSBhd2FpdCB0aGlzLmFwcC52YXVsdC5hZGFwdGVyLnJlYWQoXCIuc21hcnQtY29ubmVjdGlvbnMvZmFpbGVkLWVtYmVkZGluZ3MudHh0XCIpO1xuICAgIC8vIHNwbGl0IGZhaWxlZF9lbWJlZGRpbmdzIGludG8gYXJyYXkgYW5kIHJlbW92ZSBlbXB0eSBsaW5lc1xuICAgIGNvbnN0IGZhaWxlZF9lbWJlZGRpbmdzX2FycmF5ID0gZmFpbGVkX2VtYmVkZGluZ3Muc3BsaXQoXCJcXHJcXG5cIik7XG4gICAgLy8gc3BsaXQgYXQgJyMnIGFuZCByZWR1Y2UgaW50byB1bmlxdWUgZmlsZSBwYXRoc1xuICAgIGNvbnN0IGZhaWxlZF9maWxlcyA9IGZhaWxlZF9lbWJlZGRpbmdzX2FycmF5Lm1hcChlbWJlZGRpbmcgPT4gZW1iZWRkaW5nLnNwbGl0KFwiI1wiKVswXSkucmVkdWNlKCh1bmlxdWUsIGl0ZW0pID0+IHVuaXF1ZS5pbmNsdWRlcyhpdGVtKSA/IHVuaXF1ZSA6IFsuLi51bmlxdWUsIGl0ZW1dLCBbXSk7XG4gICAgLy8gcmV0dXJuIGZhaWxlZF9maWxlc1xuICAgIHRoaXMuc2V0dGluZ3MuZmFpbGVkX2ZpbGVzID0gZmFpbGVkX2ZpbGVzO1xuICAgIC8vIGNvbnNvbGUubG9nKGZhaWxlZF9maWxlcyk7XG4gIH1cbiAgLy8gcmV0cnkgZmFpbGVkIGVtYmVkZGluZ3NcbiAgYXN5bmMgcmV0cnlfZmFpbGVkX2ZpbGVzICgpIHtcbiAgICAvLyByZW1vdmUgZmFpbGVkIGZpbGVzIGZyb20gZmFpbGVkX2ZpbGVzXG4gICAgdGhpcy5zZXR0aW5ncy5mYWlsZWRfZmlsZXMgPSBbXTtcbiAgICAvLyBpZiBmYWlsZWQtZW1iZWRkaW5ncy50eHQgZXhpc3RzIHRoZW4gZGVsZXRlIGl0XG4gICAgY29uc3QgZmFpbGVkX2VtYmVkZGluZ3NfZmlsZV9leGlzdHMgPSBhd2FpdCB0aGlzLmFwcC52YXVsdC5hZGFwdGVyLmV4aXN0cyhcIi5zbWFydC1jb25uZWN0aW9ucy9mYWlsZWQtZW1iZWRkaW5ncy50eHRcIik7XG4gICAgaWYoZmFpbGVkX2VtYmVkZGluZ3NfZmlsZV9leGlzdHMpIHtcbiAgICAgIGF3YWl0IHRoaXMuYXBwLnZhdWx0LmFkYXB0ZXIucmVtb3ZlKFwiLnNtYXJ0LWNvbm5lY3Rpb25zL2ZhaWxlZC1lbWJlZGRpbmdzLnR4dFwiKTtcbiAgICB9XG4gICAgLy8gcnVuIGdldCBhbGwgZW1iZWRkaW5nc1xuICAgIGF3YWl0IHRoaXMuZ2V0X2FsbF9lbWJlZGRpbmdzKCk7XG4gIH1cblxuXG4gIC8vIGFkZCAuc21hcnQtY29ubmVjdGlvbnMgdG8gLmdpdGlnbm9yZSB0byBwcmV2ZW50IGlzc3VlcyB3aXRoIGxhcmdlLCBmcmVxdWVudGx5IHVwZGF0ZWQgZW1iZWRkaW5ncyBmaWxlKHMpXG4gIGFzeW5jIGFkZF90b19naXRpZ25vcmUoKSB7XG4gICAgaWYoIShhd2FpdCB0aGlzLmFwcC52YXVsdC5hZGFwdGVyLmV4aXN0cyhcIi5naXRpZ25vcmVcIikpKSB7XG4gICAgICByZXR1cm47IC8vIGlmIC5naXRpZ25vcmUgZG9lc24ndCBleGlzdCB0aGVuIGRvbid0IGFkZCAuc21hcnQtY29ubmVjdGlvbnMgdG8gLmdpdGlnbm9yZVxuICAgIH1cbiAgICBsZXQgZ2l0aWdub3JlX2ZpbGUgPSBhd2FpdCB0aGlzLmFwcC52YXVsdC5hZGFwdGVyLnJlYWQoXCIuZ2l0aWdub3JlXCIpO1xuICAgIC8vIGlmIC5zbWFydC1jb25uZWN0aW9ucyBub3QgaW4gLmdpdGlnbm9yZVxuICAgIGlmIChnaXRpZ25vcmVfZmlsZS5pbmRleE9mKFwiLnNtYXJ0LWNvbm5lY3Rpb25zXCIpIDwgMCkge1xuICAgICAgLy8gYWRkIC5zbWFydC1jb25uZWN0aW9ucyB0byAuZ2l0aWdub3JlXG4gICAgICBsZXQgYWRkX3RvX2dpdGlnbm9yZSA9IFwiXFxuXFxuIyBJZ25vcmUgU21hcnQgQ29ubmVjdGlvbnMgZm9sZGVyIGJlY2F1c2UgZW1iZWRkaW5ncyBmaWxlIGlzIGxhcmdlIGFuZCB1cGRhdGVkIGZyZXF1ZW50bHlcIjtcbiAgICAgIGFkZF90b19naXRpZ25vcmUgKz0gXCJcXG4uc21hcnQtY29ubmVjdGlvbnNcIjtcbiAgICAgIGF3YWl0IHRoaXMuYXBwLnZhdWx0LmFkYXB0ZXIud3JpdGUoXCIuZ2l0aWdub3JlXCIsIGdpdGlnbm9yZV9maWxlICsgYWRkX3RvX2dpdGlnbm9yZSk7XG4gICAgICBjb25zb2xlLmxvZyhcImFkZGVkIC5zbWFydC1jb25uZWN0aW9ucyB0byAuZ2l0aWdub3JlXCIpO1xuICAgIH1cbiAgfVxuXG4gIC8vIGZvcmNlIHJlZnJlc2ggZW1iZWRkaW5ncyBmaWxlIGJ1dCBmaXJzdCByZW5hbWUgZXhpc3RpbmcgZW1iZWRkaW5ncyBmaWxlIHRvIC5zbWFydC1jb25uZWN0aW9ucy9lbWJlZGRpbmdzLVlZWVktTU0tREQuanNvblxuICBhc3luYyBmb3JjZV9yZWZyZXNoX2VtYmVkZGluZ3NfZmlsZSgpIHtcbiAgICBuZXcgT2JzaWRpYW4uTm90aWNlKFwiU21hcnQgQ29ubmVjdGlvbnM6IGVtYmVkZGluZ3MgZmlsZSBGb3JjZSBSZWZyZXNoZWQsIG1ha2luZyBuZXcgY29ubmVjdGlvbnMuLi5cIik7XG4gICAgLy8gZm9yY2UgcmVmcmVzaFxuICAgIGF3YWl0IHRoaXMuc21hcnRfdmVjX2xpdGUuZm9yY2VfcmVmcmVzaCgpO1xuICAgIC8vIHRyaWdnZXIgbWFraW5nIG5ldyBjb25uZWN0aW9uc1xuICAgIGF3YWl0IHRoaXMuZ2V0X2FsbF9lbWJlZGRpbmdzKCk7XG4gICAgdGhpcy5vdXRwdXRfcmVuZGVyX2xvZygpO1xuICAgIG5ldyBPYnNpZGlhbi5Ob3RpY2UoXCJTbWFydCBDb25uZWN0aW9uczogZW1iZWRkaW5ncyBmaWxlIEZvcmNlIFJlZnJlc2hlZCwgbmV3IGNvbm5lY3Rpb25zIG1hZGUuXCIpO1xuICB9XG5cbiAgLy8gZ2V0IGVtYmVkZGluZ3MgZm9yIGVtYmVkX2lucHV0XG4gIGFzeW5jIGdldF9maWxlX2VtYmVkZGluZ3MoY3Vycl9maWxlLCBzYXZlPXRydWUpIHtcbiAgICAvLyBsZXQgYmF0Y2hfcHJvbWlzZXMgPSBbXTtcbiAgICBsZXQgcmVxX2JhdGNoID0gW107XG4gICAgbGV0IGJsb2NrcyA9IFtdO1xuICAgIC8vIGluaXRpYXRlIGN1cnJfZmlsZV9rZXkgZnJvbSBtZDUoY3Vycl9maWxlLnBhdGgpXG4gICAgY29uc3QgY3Vycl9maWxlX2tleSA9IG1kNShjdXJyX2ZpbGUucGF0aCk7XG4gICAgLy8gaW50aWF0ZSBmaWxlX2ZpbGVfZW1iZWRfaW5wdXQgYnkgcmVtb3ZpbmcgLm1kIGFuZCBjb252ZXJ0aW5nIGZpbGUgcGF0aCB0byBicmVhZGNydW1icyAoXCIgPiBcIilcbiAgICBsZXQgZmlsZV9lbWJlZF9pbnB1dCA9IGN1cnJfZmlsZS5wYXRoLnJlcGxhY2UoXCIubWRcIiwgXCJcIik7XG4gICAgZmlsZV9lbWJlZF9pbnB1dCA9IGZpbGVfZW1iZWRfaW5wdXQucmVwbGFjZSgvXFwvL2csIFwiID4gXCIpO1xuICAgIC8vIGVtYmVkIG9uIGZpbGUubmFtZS90aXRsZSBvbmx5IGlmIHBhdGhfb25seSBwYXRoIG1hdGNoZXIgc3BlY2lmaWVkIGluIHNldHRpbmdzXG4gICAgbGV0IHBhdGhfb25seSA9IGZhbHNlO1xuICAgIGZvcihsZXQgaiA9IDA7IGogPCB0aGlzLnBhdGhfb25seS5sZW5ndGg7IGorKykge1xuICAgICAgaWYoY3Vycl9maWxlLnBhdGguaW5kZXhPZih0aGlzLnBhdGhfb25seVtqXSkgPiAtMSkge1xuICAgICAgICBwYXRoX29ubHkgPSB0cnVlO1xuICAgICAgICBjb25zb2xlLmxvZyhcInRpdGxlIG9ubHkgZmlsZSB3aXRoIG1hdGNoZXI6IFwiICsgdGhpcy5wYXRoX29ubHlbal0pO1xuICAgICAgICAvLyBicmVhayBvdXQgb2YgbG9vcFxuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gICAgLy8gcmV0dXJuIGVhcmx5IGlmIHBhdGhfb25seVxuICAgIGlmKHBhdGhfb25seSkge1xuICAgICAgcmVxX2JhdGNoLnB1c2goW2N1cnJfZmlsZV9rZXksIGZpbGVfZW1iZWRfaW5wdXQsIHtcbiAgICAgICAgbXRpbWU6IGN1cnJfZmlsZS5zdGF0Lm10aW1lLFxuICAgICAgICBwYXRoOiBjdXJyX2ZpbGUucGF0aCxcbiAgICAgIH1dKTtcbiAgICAgIGF3YWl0IHRoaXMuZ2V0X2VtYmVkZGluZ3NfYmF0Y2gocmVxX2JhdGNoKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgLyoqXG4gICAgICogQkVHSU4gQ2FudmFzIGZpbGUgdHlwZSBFbWJlZGRpbmdcbiAgICAgKi9cbiAgICBpZihjdXJyX2ZpbGUuZXh0ZW5zaW9uID09PSBcImNhbnZhc1wiKSB7XG4gICAgICAvLyBnZXQgZmlsZSBjb250ZW50cyBhbmQgcGFyc2UgYXMgSlNPTlxuICAgICAgY29uc3QgY2FudmFzX2NvbnRlbnRzID0gYXdhaXQgdGhpcy5hcHAudmF1bHQuY2FjaGVkUmVhZChjdXJyX2ZpbGUpO1xuICAgICAgaWYoKHR5cGVvZiBjYW52YXNfY29udGVudHMgPT09IFwic3RyaW5nXCIpICYmIChjYW52YXNfY29udGVudHMuaW5kZXhPZihcIm5vZGVzXCIpID4gLTEpKSB7XG4gICAgICAgIGNvbnN0IGNhbnZhc19qc29uID0gSlNPTi5wYXJzZShjYW52YXNfY29udGVudHMpO1xuICAgICAgICAvLyBmb3IgZWFjaCBvYmplY3QgaW4gbm9kZXMgYXJyYXlcbiAgICAgICAgZm9yKGxldCBqID0gMDsgaiA8IGNhbnZhc19qc29uLm5vZGVzLmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgLy8gaWYgb2JqZWN0IGhhcyB0ZXh0IHByb3BlcnR5XG4gICAgICAgICAgaWYoY2FudmFzX2pzb24ubm9kZXNbal0udGV4dCkge1xuICAgICAgICAgICAgLy8gYWRkIHRvIGZpbGVfZW1iZWRfaW5wdXRcbiAgICAgICAgICAgIGZpbGVfZW1iZWRfaW5wdXQgKz0gXCJcXG5cIiArIGNhbnZhc19qc29uLm5vZGVzW2pdLnRleHQ7XG4gICAgICAgICAgfVxuICAgICAgICAgIC8vIGlmIG9iamVjdCBoYXMgZmlsZSBwcm9wZXJ0eVxuICAgICAgICAgIGlmKGNhbnZhc19qc29uLm5vZGVzW2pdLmZpbGUpIHtcbiAgICAgICAgICAgIC8vIGFkZCB0byBmaWxlX2VtYmVkX2lucHV0XG4gICAgICAgICAgICBmaWxlX2VtYmVkX2lucHV0ICs9IFwiXFxuTGluazogXCIgKyBjYW52YXNfanNvbi5ub2Rlc1tqXS5maWxlO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgLy8gY29uc29sZS5sb2coZmlsZV9lbWJlZF9pbnB1dCk7XG4gICAgICByZXFfYmF0Y2gucHVzaChbY3Vycl9maWxlX2tleSwgZmlsZV9lbWJlZF9pbnB1dCwge1xuICAgICAgICBtdGltZTogY3Vycl9maWxlLnN0YXQubXRpbWUsXG4gICAgICAgIHBhdGg6IGN1cnJfZmlsZS5wYXRoLFxuICAgICAgfV0pO1xuICAgICAgYXdhaXQgdGhpcy5nZXRfZW1iZWRkaW5nc19iYXRjaChyZXFfYmF0Y2gpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBcbiAgICAvKipcbiAgICAgKiBCRUdJTiBCbG9jayBcInNlY3Rpb25cIiBlbWJlZGRpbmdcbiAgICAgKi9cbiAgICAvLyBnZXQgZmlsZSBjb250ZW50c1xuICAgIGNvbnN0IG5vdGVfY29udGVudHMgPSBhd2FpdCB0aGlzLmFwcC52YXVsdC5jYWNoZWRSZWFkKGN1cnJfZmlsZSk7XG4gICAgbGV0IHByb2Nlc3NlZF9zaW5jZV9sYXN0X3NhdmUgPSAwO1xuICAgIGNvbnN0IG5vdGVfc2VjdGlvbnMgPSB0aGlzLmJsb2NrX3BhcnNlcihub3RlX2NvbnRlbnRzLCBjdXJyX2ZpbGUucGF0aCk7XG4gICAgLy8gY29uc29sZS5sb2cobm90ZV9zZWN0aW9ucyk7XG4gICAgLy8gaWYgbm90ZSBoYXMgbW9yZSB0aGFuIG9uZSBzZWN0aW9uIChpZiBvbmx5IG9uZSB0aGVuIGl0cyBzYW1lIGFzIGZ1bGwtY29udGVudClcbiAgICBpZihub3RlX3NlY3Rpb25zLmxlbmd0aCA+IDEpIHtcbiAgICAgIC8vIGZvciBlYWNoIHNlY3Rpb24gaW4gZmlsZVxuICAgICAgLy9jb25zb2xlLmxvZyhcIlNlY3Rpb25zOiBcIiArIG5vdGVfc2VjdGlvbnMubGVuZ3RoKTtcbiAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgbm90ZV9zZWN0aW9ucy5sZW5ndGg7IGorKykge1xuICAgICAgICAvLyBnZXQgZW1iZWRfaW5wdXQgZm9yIGJsb2NrXG4gICAgICAgIGNvbnN0IGJsb2NrX2VtYmVkX2lucHV0ID0gbm90ZV9zZWN0aW9uc1tqXS50ZXh0O1xuICAgICAgICAvLyBjb25zb2xlLmxvZyhub3RlX3NlY3Rpb25zW2pdLnBhdGgpO1xuICAgICAgICAvLyBnZXQgYmxvY2sga2V5IGZyb20gYmxvY2sucGF0aCAoY29udGFpbnMgYm90aCBmaWxlLnBhdGggYW5kIGhlYWRlciBwYXRoKVxuICAgICAgICBjb25zdCBibG9ja19rZXkgPSBtZDUobm90ZV9zZWN0aW9uc1tqXS5wYXRoKTtcbiAgICAgICAgYmxvY2tzLnB1c2goYmxvY2tfa2V5KTtcbiAgICAgICAgLy8gc2tpcCBpZiBsZW5ndGggb2YgYmxvY2tfZW1iZWRfaW5wdXQgc2FtZSBhcyBsZW5ndGggb2YgZW1iZWRkaW5nc1tibG9ja19rZXldLm1ldGEuc2l6ZVxuICAgICAgICAvLyBUT0RPIGNvbnNpZGVyIHJvdW5kaW5nIHRvIG5lYXJlc3QgMTAgb3IgMTAwIGZvciBmdXp6eSBtYXRjaGluZ1xuICAgICAgICBpZiAodGhpcy5zbWFydF92ZWNfbGl0ZS5nZXRfc2l6ZShibG9ja19rZXkpID09PSBibG9ja19lbWJlZF9pbnB1dC5sZW5ndGgpIHtcbiAgICAgICAgICAvLyBsb2cgc2tpcHBpbmcgZmlsZVxuICAgICAgICAgIC8vIGNvbnNvbGUubG9nKFwic2tpcHBpbmcgYmxvY2sgKGxlbilcIik7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgICAgLy8gYWRkIGhhc2ggdG8gYmxvY2tzIHRvIHByZXZlbnQgZW1wdHkgYmxvY2tzIHRyaWdnZXJpbmcgZnVsbC1maWxlIGVtYmVkZGluZ1xuICAgICAgICAvLyBza2lwIGlmIGVtYmVkZGluZ3Mga2V5IGFscmVhZHkgZXhpc3RzIGFuZCBibG9jayBtdGltZSBpcyBncmVhdGVyIHRoYW4gb3IgZXF1YWwgdG8gZmlsZSBtdGltZVxuICAgICAgICBpZih0aGlzLnNtYXJ0X3ZlY19saXRlLm10aW1lX2lzX2N1cnJlbnQoYmxvY2tfa2V5LCBjdXJyX2ZpbGUuc3RhdC5tdGltZSkpIHtcbiAgICAgICAgICAvLyBsb2cgc2tpcHBpbmcgZmlsZVxuICAgICAgICAgIC8vIGNvbnNvbGUubG9nKFwic2tpcHBpbmcgYmxvY2sgKG10aW1lKVwiKTtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICAgICAgICAvLyBza2lwIGlmIGhhc2ggaXMgcHJlc2VudCBpbiBlbWJlZGRpbmdzIGFuZCBoYXNoIG9mIGJsb2NrX2VtYmVkX2lucHV0IGlzIGVxdWFsIHRvIGhhc2ggaW4gZW1iZWRkaW5nc1xuICAgICAgICBjb25zdCBibG9ja19oYXNoID0gbWQ1KGJsb2NrX2VtYmVkX2lucHV0LnRyaW0oKSk7XG4gICAgICAgIGlmKHRoaXMuc21hcnRfdmVjX2xpdGUuZ2V0X2hhc2goYmxvY2tfa2V5KSA9PT0gYmxvY2tfaGFzaCkge1xuICAgICAgICAgIC8vIGxvZyBza2lwcGluZyBmaWxlXG4gICAgICAgICAgLy8gY29uc29sZS5sb2coXCJza2lwcGluZyBibG9jayAoaGFzaClcIik7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBjcmVhdGUgcmVxX2JhdGNoIGZvciBiYXRjaGluZyByZXF1ZXN0c1xuICAgICAgICByZXFfYmF0Y2gucHVzaChbYmxvY2tfa2V5LCBibG9ja19lbWJlZF9pbnB1dCwge1xuICAgICAgICAgIC8vIG9sZG10aW1lOiBjdXJyX2ZpbGUuc3RhdC5tdGltZSwgXG4gICAgICAgICAgLy8gZ2V0IGN1cnJlbnQgZGF0ZXRpbWUgYXMgdW5peCB0aW1lc3RhbXBcbiAgICAgICAgICBtdGltZTogRGF0ZS5ub3coKSxcbiAgICAgICAgICBoYXNoOiBibG9ja19oYXNoLCBcbiAgICAgICAgICBwYXJlbnQ6IGN1cnJfZmlsZV9rZXksXG4gICAgICAgICAgcGF0aDogbm90ZV9zZWN0aW9uc1tqXS5wYXRoLFxuICAgICAgICAgIHNpemU6IGJsb2NrX2VtYmVkX2lucHV0Lmxlbmd0aCxcbiAgICAgICAgfV0pO1xuICAgICAgICBpZihyZXFfYmF0Y2gubGVuZ3RoID4gOSkge1xuICAgICAgICAgIC8vIGFkZCBiYXRjaCB0byBiYXRjaF9wcm9taXNlc1xuICAgICAgICAgIGF3YWl0IHRoaXMuZ2V0X2VtYmVkZGluZ3NfYmF0Y2gocmVxX2JhdGNoKTtcbiAgICAgICAgICBwcm9jZXNzZWRfc2luY2VfbGFzdF9zYXZlICs9IHJlcV9iYXRjaC5sZW5ndGg7XG4gICAgICAgICAgLy8gbG9nIGVtYmVkZGluZ1xuICAgICAgICAgIC8vIGNvbnNvbGUubG9nKFwiZW1iZWRkaW5nOiBcIiArIGN1cnJfZmlsZS5wYXRoKTtcbiAgICAgICAgICBpZiAocHJvY2Vzc2VkX3NpbmNlX2xhc3Rfc2F2ZSA+PSAzMCkge1xuICAgICAgICAgICAgLy8gd3JpdGUgZW1iZWRkaW5ncyBKU09OIHRvIGZpbGVcbiAgICAgICAgICAgIGF3YWl0IHRoaXMuc2F2ZV9lbWJlZGRpbmdzX3RvX2ZpbGUoKTtcbiAgICAgICAgICAgIC8vIHJlc2V0IHByb2Nlc3NlZF9zaW5jZV9sYXN0X3NhdmVcbiAgICAgICAgICAgIHByb2Nlc3NlZF9zaW5jZV9sYXN0X3NhdmUgPSAwO1xuICAgICAgICAgIH1cbiAgICAgICAgICAvLyByZXNldCByZXFfYmF0Y2hcbiAgICAgICAgICByZXFfYmF0Y2ggPSBbXTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICAvLyBpZiByZXFfYmF0Y2ggaXMgbm90IGVtcHR5XG4gICAgaWYocmVxX2JhdGNoLmxlbmd0aCA+IDApIHtcbiAgICAgIC8vIHByb2Nlc3MgcmVtYWluaW5nIHJlcV9iYXRjaFxuICAgICAgYXdhaXQgdGhpcy5nZXRfZW1iZWRkaW5nc19iYXRjaChyZXFfYmF0Y2gpO1xuICAgICAgcmVxX2JhdGNoID0gW107XG4gICAgICBwcm9jZXNzZWRfc2luY2VfbGFzdF9zYXZlICs9IHJlcV9iYXRjaC5sZW5ndGg7XG4gICAgfVxuICAgIFxuICAgIC8qKlxuICAgICAqIEJFR0lOIEZpbGUgXCJmdWxsIG5vdGVcIiBlbWJlZGRpbmdcbiAgICAgKi9cblxuICAgIC8vIGlmIGZpbGUgbGVuZ3RoIGlzIGxlc3MgdGhhbiB+ODAwMCB0b2tlbnMgdXNlIGZ1bGwgZmlsZSBjb250ZW50c1xuICAgIC8vIGVsc2UgaWYgZmlsZSBsZW5ndGggaXMgZ3JlYXRlciB0aGFuIDgwMDAgdG9rZW5zIGJ1aWxkIGZpbGVfZW1iZWRfaW5wdXQgZnJvbSBmaWxlIGhlYWRpbmdzXG4gICAgZmlsZV9lbWJlZF9pbnB1dCArPSBgOlxcbmA7XG4gICAgLyoqXG4gICAgICogVE9ETzogaW1wcm92ZS9yZWZhY3RvciB0aGUgZm9sbG93aW5nIFwibGFyZ2UgZmlsZSByZWR1Y2UgdG8gaGVhZGluZ3NcIiBsb2dpY1xuICAgICAqL1xuICAgIGlmKG5vdGVfY29udGVudHMubGVuZ3RoIDwgTUFYX0VNQkVEX1NUUklOR19MRU5HVEgpIHtcbiAgICAgIGZpbGVfZW1iZWRfaW5wdXQgKz0gbm90ZV9jb250ZW50c1xuICAgIH1lbHNleyBcbiAgICAgIGNvbnN0IG5vdGVfbWV0YV9jYWNoZSA9IHRoaXMuYXBwLm1ldGFkYXRhQ2FjaGUuZ2V0RmlsZUNhY2hlKGN1cnJfZmlsZSk7XG4gICAgICAvLyBmb3IgZWFjaCBoZWFkaW5nIGluIGZpbGVcbiAgICAgIGlmKHR5cGVvZiBub3RlX21ldGFfY2FjaGUuaGVhZGluZ3MgPT09IFwidW5kZWZpbmVkXCIpIHtcbiAgICAgICAgLy8gY29uc29sZS5sb2coXCJubyBoZWFkaW5ncyBmb3VuZCwgdXNpbmcgZmlyc3QgY2h1bmsgb2YgZmlsZSBpbnN0ZWFkXCIpO1xuICAgICAgICBmaWxlX2VtYmVkX2lucHV0ICs9IG5vdGVfY29udGVudHMuc3Vic3RyaW5nKDAsIE1BWF9FTUJFRF9TVFJJTkdfTEVOR1RIKTtcbiAgICAgIH1lbHNle1xuICAgICAgICBsZXQgbm90ZV9oZWFkaW5ncyA9IFwiXCI7XG4gICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgbm90ZV9tZXRhX2NhY2hlLmhlYWRpbmdzLmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgLy8gZ2V0IGhlYWRpbmcgbGV2ZWxcbiAgICAgICAgICBjb25zdCBoZWFkaW5nX2xldmVsID0gbm90ZV9tZXRhX2NhY2hlLmhlYWRpbmdzW2pdLmxldmVsO1xuICAgICAgICAgIC8vIGdldCBoZWFkaW5nIHRleHRcbiAgICAgICAgICBjb25zdCBoZWFkaW5nX3RleHQgPSBub3RlX21ldGFfY2FjaGUuaGVhZGluZ3Nbal0uaGVhZGluZztcbiAgICAgICAgICAvLyBidWlsZCBtYXJrZG93biBoZWFkaW5nXG4gICAgICAgICAgbGV0IG1kX2hlYWRpbmcgPSBcIlwiO1xuICAgICAgICAgIGZvciAobGV0IGsgPSAwOyBrIDwgaGVhZGluZ19sZXZlbDsgaysrKSB7XG4gICAgICAgICAgICBtZF9oZWFkaW5nICs9IFwiI1wiO1xuICAgICAgICAgIH1cbiAgICAgICAgICAvLyBhZGQgaGVhZGluZyB0byBub3RlX2hlYWRpbmdzXG4gICAgICAgICAgbm90ZV9oZWFkaW5ncyArPSBgJHttZF9oZWFkaW5nfSAke2hlYWRpbmdfdGV4dH1cXG5gO1xuICAgICAgICB9XG4gICAgICAgIC8vY29uc29sZS5sb2cobm90ZV9oZWFkaW5ncyk7XG4gICAgICAgIGZpbGVfZW1iZWRfaW5wdXQgKz0gbm90ZV9oZWFkaW5nc1xuICAgICAgICBpZihmaWxlX2VtYmVkX2lucHV0Lmxlbmd0aCA+IE1BWF9FTUJFRF9TVFJJTkdfTEVOR1RIKSB7XG4gICAgICAgICAgZmlsZV9lbWJlZF9pbnB1dCA9IGZpbGVfZW1iZWRfaW5wdXQuc3Vic3RyaW5nKDAsIE1BWF9FTUJFRF9TVFJJTkdfTEVOR1RIKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICAvLyBza2lwIGVtYmVkZGluZyBmdWxsIGZpbGUgaWYgYmxvY2tzIGlzIG5vdCBlbXB0eSBhbmQgYWxsIGhhc2hlcyBhcmUgcHJlc2VudCBpbiBlbWJlZGRpbmdzXG4gICAgLy8gYmV0dGVyIHRoYW4gaGFzaGluZyBmaWxlX2VtYmVkX2lucHV0IGJlY2F1c2UgbW9yZSByZXNpbGllbnQgdG8gaW5jb25zZXF1ZW50aWFsIGNoYW5nZXMgKHdoaXRlc3BhY2UgYmV0d2VlbiBoZWFkaW5ncylcbiAgICBjb25zdCBmaWxlX2hhc2ggPSBtZDUoZmlsZV9lbWJlZF9pbnB1dC50cmltKCkpO1xuICAgIGNvbnN0IGV4aXN0aW5nX2hhc2ggPSB0aGlzLnNtYXJ0X3ZlY19saXRlLmdldF9oYXNoKGN1cnJfZmlsZV9rZXkpO1xuICAgIGlmKGV4aXN0aW5nX2hhc2ggJiYgKGZpbGVfaGFzaCA9PT0gZXhpc3RpbmdfaGFzaCkpIHtcbiAgICAgIC8vIGNvbnNvbGUubG9nKFwic2tpcHBpbmcgZmlsZSAoaGFzaCk6IFwiICsgY3Vycl9maWxlLnBhdGgpO1xuICAgICAgdGhpcy51cGRhdGVfcmVuZGVyX2xvZyhibG9ja3MsIGZpbGVfZW1iZWRfaW5wdXQpO1xuICAgICAgcmV0dXJuO1xuICAgIH07XG5cbiAgICAvLyBpZiBub3QgYWxyZWFkeSBza2lwcGluZyBhbmQgYmxvY2tzIGFyZSBwcmVzZW50XG4gICAgY29uc3QgZXhpc3RpbmdfYmxvY2tzID0gdGhpcy5zbWFydF92ZWNfbGl0ZS5nZXRfY2hpbGRyZW4oY3Vycl9maWxlX2tleSk7XG4gICAgbGV0IGV4aXN0aW5nX2hhc19hbGxfYmxvY2tzID0gdHJ1ZTtcbiAgICBpZihleGlzdGluZ19ibG9ja3MgJiYgQXJyYXkuaXNBcnJheShleGlzdGluZ19ibG9ja3MpICYmIChibG9ja3MubGVuZ3RoID4gMCkpIHtcbiAgICAgIC8vIGlmIGFsbCBibG9ja3MgYXJlIGluIGV4aXN0aW5nX2Jsb2NrcyB0aGVuIHNraXAgKGFsbG93cyBkZWxldGlvbiBvZiBzbWFsbCBibG9ja3Mgd2l0aG91dCB0cmlnZ2VyaW5nIGZ1bGwgZmlsZSBlbWJlZGRpbmcpXG4gICAgICBmb3IgKGxldCBqID0gMDsgaiA8IGJsb2Nrcy5sZW5ndGg7IGorKykge1xuICAgICAgICBpZihleGlzdGluZ19ibG9ja3MuaW5kZXhPZihibG9ja3Nbal0pID09PSAtMSkge1xuICAgICAgICAgIGV4aXN0aW5nX2hhc19hbGxfYmxvY2tzID0gZmFsc2U7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgLy8gaWYgZXhpc3RpbmcgaGFzIGFsbCBibG9ja3MgdGhlbiBjaGVjayBmaWxlIHNpemUgZm9yIGRlbHRhXG4gICAgaWYoZXhpc3RpbmdfaGFzX2FsbF9ibG9ja3Mpe1xuICAgICAgLy8gZ2V0IGN1cnJlbnQgbm90ZSBmaWxlIHNpemVcbiAgICAgIGNvbnN0IGN1cnJfZmlsZV9zaXplID0gY3Vycl9maWxlLnN0YXQuc2l6ZTtcbiAgICAgIC8vIGdldCBmaWxlIHNpemUgZnJvbSBlbWJlZGRpbmdzXG4gICAgICBjb25zdCBwcmV2X2ZpbGVfc2l6ZSA9IHRoaXMuc21hcnRfdmVjX2xpdGUuZ2V0X3NpemUoY3Vycl9maWxlX2tleSk7XG4gICAgICBpZiAocHJldl9maWxlX3NpemUpIHtcbiAgICAgICAgLy8gaWYgY3VyciBmaWxlIHNpemUgaXMgbGVzcyB0aGFuIDEwJSBkaWZmZXJlbnQgZnJvbSBwcmV2IGZpbGUgc2l6ZVxuICAgICAgICBjb25zdCBmaWxlX2RlbHRhX3BjdCA9IE1hdGgucm91bmQoKE1hdGguYWJzKGN1cnJfZmlsZV9zaXplIC0gcHJldl9maWxlX3NpemUpIC8gY3Vycl9maWxlX3NpemUpICogMTAwKTtcbiAgICAgICAgaWYoZmlsZV9kZWx0YV9wY3QgPCAxMCkge1xuICAgICAgICAgIC8vIHNraXAgZW1iZWRkaW5nXG4gICAgICAgICAgLy8gY29uc29sZS5sb2coXCJza2lwcGluZyBmaWxlIChzaXplKSBcIiArIGN1cnJfZmlsZS5wYXRoKTtcbiAgICAgICAgICB0aGlzLnJlbmRlcl9sb2cuc2tpcHBlZF9sb3dfZGVsdGFbY3Vycl9maWxlLm5hbWVdID0gZmlsZV9kZWx0YV9wY3QgKyBcIiVcIjtcbiAgICAgICAgICB0aGlzLnVwZGF0ZV9yZW5kZXJfbG9nKGJsb2NrcywgZmlsZV9lbWJlZF9pbnB1dCk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIGxldCBtZXRhID0ge1xuICAgICAgbXRpbWU6IGN1cnJfZmlsZS5zdGF0Lm10aW1lLFxuICAgICAgaGFzaDogZmlsZV9oYXNoLFxuICAgICAgcGF0aDogY3Vycl9maWxlLnBhdGgsXG4gICAgICBzaXplOiBjdXJyX2ZpbGUuc3RhdC5zaXplLFxuICAgICAgY2hpbGRyZW46IGJsb2NrcyxcbiAgICB9O1xuICAgIC8vIGJhdGNoX3Byb21pc2VzLnB1c2godGhpcy5nZXRfZW1iZWRkaW5ncyhjdXJyX2ZpbGVfa2V5LCBmaWxlX2VtYmVkX2lucHV0LCBtZXRhKSk7XG4gICAgcmVxX2JhdGNoLnB1c2goW2N1cnJfZmlsZV9rZXksIGZpbGVfZW1iZWRfaW5wdXQsIG1ldGFdKTtcbiAgICAvLyBzZW5kIGJhdGNoIHJlcXVlc3RcbiAgICBhd2FpdCB0aGlzLmdldF9lbWJlZGRpbmdzX2JhdGNoKHJlcV9iYXRjaCk7XG5cbiAgICAvLyBsb2cgZW1iZWRkaW5nXG4gICAgLy8gY29uc29sZS5sb2coXCJlbWJlZGRpbmc6IFwiICsgY3Vycl9maWxlLnBhdGgpO1xuICAgIGlmIChzYXZlKSB7XG4gICAgICAvLyB3cml0ZSBlbWJlZGRpbmdzIEpTT04gdG8gZmlsZVxuICAgICAgYXdhaXQgdGhpcy5zYXZlX2VtYmVkZGluZ3NfdG9fZmlsZSgpO1xuICAgIH1cblxuICB9XG5cbiAgdXBkYXRlX3JlbmRlcl9sb2coYmxvY2tzLCBmaWxlX2VtYmVkX2lucHV0KSB7XG4gICAgaWYgKGJsb2Nrcy5sZW5ndGggPiAwKSB7XG4gICAgICAvLyBtdWx0aXBseSBieSAyIGJlY2F1c2UgaW1wbGllcyB3ZSBzYXZlZCB0b2tlbiBzcGVuZGluZyBvbiBibG9ja3Moc2VjdGlvbnMpLCB0b29cbiAgICAgIHRoaXMucmVuZGVyX2xvZy50b2tlbnNfc2F2ZWRfYnlfY2FjaGUgKz0gZmlsZV9lbWJlZF9pbnB1dC5sZW5ndGggLyAyO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBjYWxjIHRva2VucyBzYXZlZCBieSBjYWNoZTogZGl2aWRlIGJ5IDQgZm9yIHRva2VuIGVzdGltYXRlXG4gICAgICB0aGlzLnJlbmRlcl9sb2cudG9rZW5zX3NhdmVkX2J5X2NhY2hlICs9IGZpbGVfZW1iZWRfaW5wdXQubGVuZ3RoIC8gNDtcbiAgICB9XG4gIH1cblxuICBhc3luYyBnZXRfZW1iZWRkaW5nc19iYXRjaChyZXFfYmF0Y2gpIHtcbiAgICBjb25zb2xlLmxvZyhcImdldF9lbWJlZGRpbmdzX2JhdGNoXCIpO1xuICAgIC8vIGlmIHJlcV9iYXRjaCBpcyBlbXB0eSB0aGVuIHJldHVyblxuICAgIGlmKHJlcV9iYXRjaC5sZW5ndGggPT09IDApIHJldHVybjtcbiAgICAvLyBjcmVhdGUgYXJyYXJ5IG9mIGVtYmVkX2lucHV0cyBmcm9tIHJlcV9iYXRjaFtpXVsxXVxuICAgIGNvbnN0IGVtYmVkX2lucHV0cyA9IHJlcV9iYXRjaC5tYXAoKHJlcSkgPT4gcmVxWzFdKTtcbiAgICAvLyByZXF1ZXN0IGVtYmVkZGluZ3MgZnJvbSBlbWJlZF9pbnB1dHNcbiAgICBjb25zdCByZXF1ZXN0UmVzdWx0cyA9IGF3YWl0IHRoaXMucmVxdWVzdF9lbWJlZGRpbmdfZnJvbV9pbnB1dChlbWJlZF9pbnB1dHMpO1xuICAgIC8vIGlmIHJlcXVlc3RSZXN1bHRzIGlzIG51bGwgdGhlbiByZXR1cm5cbiAgICBpZighcmVxdWVzdFJlc3VsdHMpIHtcbiAgICAgIGNvbnNvbGUubG9nKFwiZmFpbGVkIGVtYmVkZGluZyBiYXRjaFwiKTtcbiAgICAgIC8vIGxvZyBmYWlsZWQgZmlsZSBuYW1lcyB0byByZW5kZXJfbG9nXG4gICAgICB0aGlzLnJlbmRlcl9sb2cuZmFpbGVkX2VtYmVkZGluZ3MgPSBbLi4udGhpcy5yZW5kZXJfbG9nLmZhaWxlZF9lbWJlZGRpbmdzLCAuLi5yZXFfYmF0Y2gubWFwKChyZXEpID0+IHJlcVsyXS5wYXRoKV07XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIC8vIGlmIHJlcXVlc3RSZXN1bHRzIGlzIG5vdCBudWxsXG4gICAgaWYocmVxdWVzdFJlc3VsdHMpe1xuICAgICAgdGhpcy5oYXNfbmV3X2VtYmVkZGluZ3MgPSB0cnVlO1xuICAgICAgLy8gYWRkIGVtYmVkZGluZyBrZXkgdG8gcmVuZGVyX2xvZ1xuICAgICAgaWYodGhpcy5zZXR0aW5ncy5sb2dfcmVuZGVyKXtcbiAgICAgICAgaWYodGhpcy5zZXR0aW5ncy5sb2dfcmVuZGVyX2ZpbGVzKXtcbiAgICAgICAgICB0aGlzLnJlbmRlcl9sb2cuZmlsZXMgPSBbLi4udGhpcy5yZW5kZXJfbG9nLmZpbGVzLCAuLi5yZXFfYmF0Y2gubWFwKChyZXEpID0+IHJlcVsyXS5wYXRoKV07XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5yZW5kZXJfbG9nLm5ld19lbWJlZGRpbmdzICs9IHJlcV9iYXRjaC5sZW5ndGg7XG4gICAgICAgIC8vIGFkZCB0b2tlbiB1c2FnZSB0byByZW5kZXJfbG9nXG4gICAgICAgIHRoaXMucmVuZGVyX2xvZy50b2tlbl91c2FnZSArPSByZXF1ZXN0UmVzdWx0cy51c2FnZS50b3RhbF90b2tlbnM7XG4gICAgICB9XG4gICAgICAvLyBjb25zb2xlLmxvZyhyZXF1ZXN0UmVzdWx0cy5kYXRhLmxlbmd0aCk7XG4gICAgICAvLyBsb29wIHRocm91Z2ggcmVxdWVzdFJlc3VsdHMuZGF0YVxuICAgICAgZm9yKGxldCBpID0gMDsgaSA8IHJlcXVlc3RSZXN1bHRzLmRhdGEubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgY29uc3QgdmVjID0gcmVxdWVzdFJlc3VsdHMuZGF0YVtpXS5lbWJlZGRpbmc7XG4gICAgICAgIGNvbnN0IGluZGV4ID0gcmVxdWVzdFJlc3VsdHMuZGF0YVtpXS5pbmRleDtcbiAgICAgICAgaWYodmVjKSB7XG4gICAgICAgICAgY29uc3Qga2V5ID0gcmVxX2JhdGNoW2luZGV4XVswXTtcbiAgICAgICAgICBjb25zdCBtZXRhID0gcmVxX2JhdGNoW2luZGV4XVsyXTtcbiAgICAgICAgICB0aGlzLnNtYXJ0X3ZlY19saXRlLnNhdmVfZW1iZWRkaW5nKGtleSwgdmVjLCBtZXRhKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGFzeW5jIHJlcXVlc3RfZW1iZWRkaW5nX2Zyb21faW5wdXQoZW1iZWRfaW5wdXQsIHJldHJpZXMgPSAwKSB7XG4gICAgLy8gKEZPUiBURVNUSU5HKSB0ZXN0IGZhaWwgcHJvY2VzcyBieSBmb3JjaW5nIGZhaWxcbiAgICAvLyByZXR1cm4gbnVsbDtcbiAgICAvLyBjaGVjayBpZiBlbWJlZF9pbnB1dCBpcyBhIHN0cmluZ1xuICAgIC8vIGlmKHR5cGVvZiBlbWJlZF9pbnB1dCAhPT0gXCJzdHJpbmdcIikge1xuICAgIC8vICAgY29uc29sZS5sb2coXCJlbWJlZF9pbnB1dCBpcyBub3QgYSBzdHJpbmdcIik7XG4gICAgLy8gICByZXR1cm4gbnVsbDtcbiAgICAvLyB9XG4gICAgLy8gY2hlY2sgaWYgZW1iZWRfaW5wdXQgaXMgZW1wdHlcbiAgICBpZihlbWJlZF9pbnB1dC5sZW5ndGggPT09IDApIHtcbiAgICAgIGNvbnNvbGUubG9nKFwiZW1iZWRfaW5wdXQgaXMgZW1wdHlcIik7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgY29uc3QgdXNlZFBhcmFtcyA9IHtcbiAgICAgIG1vZGVsOiBcInRleHQtZW1iZWRkaW5nLWFkYS0wMDJcIixcbiAgICAgIGlucHV0OiBlbWJlZF9pbnB1dCxcbiAgICB9O1xuICAgIC8vIGNvbnNvbGUubG9nKHRoaXMuc2V0dGluZ3MuYXBpX2tleSk7XG4gICAgY29uc3QgcmVxUGFyYW1zID0ge1xuICAgICAgdXJsOiBgaHR0cHM6Ly9hcGkub3BlbmFpLmNvbS92MS9lbWJlZGRpbmdzYCxcbiAgICAgIG1ldGhvZDogXCJQT1NUXCIsXG4gICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh1c2VkUGFyYW1zKSxcbiAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgXCJDb250ZW50LVR5cGVcIjogXCJhcHBsaWNhdGlvbi9qc29uXCIsXG4gICAgICAgIFwiQXV0aG9yaXphdGlvblwiOiBgQmVhcmVyICR7dGhpcy5zZXR0aW5ncy5hcGlfa2V5fWBcbiAgICAgIH1cbiAgICB9O1xuICAgIGxldCByZXNwO1xuICAgIHRyeSB7XG4gICAgICByZXNwID0gYXdhaXQgKDAsIE9ic2lkaWFuLnJlcXVlc3QpKHJlcVBhcmFtcylcbiAgICAgIHJldHVybiBKU09OLnBhcnNlKHJlc3ApO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAvLyByZXRyeSByZXF1ZXN0IGlmIGVycm9yIGlzIDQyOVxuICAgICAgaWYoKGVycm9yLnN0YXR1cyA9PT0gNDI5KSAmJiAocmV0cmllcyA8IDMpKSB7XG4gICAgICAgIHJldHJpZXMrKztcbiAgICAgICAgLy8gZXhwb25lbnRpYWwgYmFja29mZlxuICAgICAgICBjb25zdCBiYWNrb2ZmID0gTWF0aC5wb3cocmV0cmllcywgMik7XG4gICAgICAgIGNvbnNvbGUubG9nKGByZXRyeWluZyByZXF1ZXN0ICg0MjkpIGluICR7YmFja29mZn0gc2Vjb25kcy4uLmApO1xuICAgICAgICBhd2FpdCBuZXcgUHJvbWlzZShyID0+IHNldFRpbWVvdXQociwgMTAwMCAqIGJhY2tvZmYpKTtcbiAgICAgICAgcmV0dXJuIGF3YWl0IHRoaXMucmVxdWVzdF9lbWJlZGRpbmdfZnJvbV9pbnB1dChlbWJlZF9pbnB1dCwgcmV0cmllcyk7XG4gICAgICB9XG4gICAgICAvLyBsb2cgZnVsbCBlcnJvciB0byBjb25zb2xlXG4gICAgICBjb25zb2xlLmxvZyhyZXNwKTtcbiAgICAgIC8vIGNvbnNvbGUubG9nKFwiZmlyc3QgbGluZSBvZiBlbWJlZDogXCIgKyBlbWJlZF9pbnB1dC5zdWJzdHJpbmcoMCwgZW1iZWRfaW5wdXQuaW5kZXhPZihcIlxcblwiKSkpO1xuICAgICAgLy8gY29uc29sZS5sb2coXCJlbWJlZCBpbnB1dCBsZW5ndGg6IFwiKyBlbWJlZF9pbnB1dC5sZW5ndGgpO1xuICAgICAgLy8gaWYoQXJyYXkuaXNBcnJheShlbWJlZF9pbnB1dCkpIHtcbiAgICAgIC8vICAgY29uc29sZS5sb2coZW1iZWRfaW5wdXQubWFwKChpbnB1dCkgPT4gaW5wdXQubGVuZ3RoKSk7XG4gICAgICAvLyB9XG4gICAgICAvLyBjb25zb2xlLmxvZyhcImVycm9uZW91cyBlbWJlZCBpbnB1dDogXCIgKyBlbWJlZF9pbnB1dCk7XG4gICAgICBjb25zb2xlLmxvZyhlcnJvcik7XG4gICAgICAvLyBjb25zb2xlLmxvZyh1c2VkUGFyYW1zKTtcbiAgICAgIC8vIGNvbnNvbGUubG9nKHVzZWRQYXJhbXMuaW5wdXQubGVuZ3RoKTtcbiAgICAgIHJldHVybiBudWxsOyBcbiAgICB9XG4gIH1cbiAgYXN5bmMgdGVzdF9hcGlfa2V5KCkge1xuICAgIGNvbnN0IGVtYmVkX2lucHV0ID0gXCJUaGlzIGlzIGEgdGVzdCBvZiB0aGUgT3BlbkFJIEFQSS5cIjtcbiAgICBjb25zdCByZXNwID0gYXdhaXQgdGhpcy5yZXF1ZXN0X2VtYmVkZGluZ19mcm9tX2lucHV0KGVtYmVkX2lucHV0KTtcbiAgICBpZihyZXNwICYmIHJlc3AudXNhZ2UpIHtcbiAgICAgIGNvbnNvbGUubG9nKFwiQVBJIGtleSBpcyB2YWxpZFwiKTtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1lbHNle1xuICAgICAgY29uc29sZS5sb2coXCJBUEkga2V5IGlzIGludmFsaWRcIik7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG5cblxuICBvdXRwdXRfcmVuZGVyX2xvZygpIHtcbiAgICAvLyBpZiBzZXR0aW5ncy5sb2dfcmVuZGVyIGlzIHRydWVcbiAgICBpZih0aGlzLnNldHRpbmdzLmxvZ19yZW5kZXIpIHtcbiAgICAgIGlmICh0aGlzLnJlbmRlcl9sb2cubmV3X2VtYmVkZGluZ3MgPT09IDApIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfWVsc2V7XG4gICAgICAgIC8vIHByZXR0eSBwcmludCB0aGlzLnJlbmRlcl9sb2cgdG8gY29uc29sZVxuICAgICAgICBjb25zb2xlLmxvZyhKU09OLnN0cmluZ2lmeSh0aGlzLnJlbmRlcl9sb2csIG51bGwsIDIpKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBjbGVhciByZW5kZXJfbG9nXG4gICAgdGhpcy5yZW5kZXJfbG9nID0ge307XG4gICAgdGhpcy5yZW5kZXJfbG9nLmRlbGV0ZWRfZW1iZWRkaW5ncyA9IDA7XG4gICAgdGhpcy5yZW5kZXJfbG9nLmV4Y2x1c2lvbnNfbG9ncyA9IHt9O1xuICAgIHRoaXMucmVuZGVyX2xvZy5mYWlsZWRfZW1iZWRkaW5ncyA9IFtdO1xuICAgIHRoaXMucmVuZGVyX2xvZy5maWxlcyA9IFtdO1xuICAgIHRoaXMucmVuZGVyX2xvZy5uZXdfZW1iZWRkaW5ncyA9IDA7XG4gICAgdGhpcy5yZW5kZXJfbG9nLnNraXBwZWRfbG93X2RlbHRhID0ge307XG4gICAgdGhpcy5yZW5kZXJfbG9nLnRva2VuX3VzYWdlID0gMDtcbiAgICB0aGlzLnJlbmRlcl9sb2cudG9rZW5zX3NhdmVkX2J5X2NhY2hlID0gMDtcbiAgfVxuXG4gIC8vIGZpbmQgY29ubmVjdGlvbnMgYnkgbW9zdCBzaW1pbGFyIHRvIGN1cnJlbnQgbm90ZSBieSBjb3NpbmUgc2ltaWxhcml0eVxuICBhc3luYyBmaW5kX25vdGVfY29ubmVjdGlvbnMoY3VycmVudF9ub3RlPW51bGwpIHtcbiAgICAvLyBtZDUgb2YgY3VycmVudCBub3RlIHBhdGhcbiAgICBjb25zdCBjdXJyX2tleSA9IG1kNShjdXJyZW50X25vdGUucGF0aCk7XG4gICAgLy8gaWYgaW4gdGhpcy5uZWFyZXN0X2NhY2hlIHRoZW4gc2V0IHRvIG5lYXJlc3RcbiAgICAvLyBlbHNlIGdldCBuZWFyZXN0XG4gICAgbGV0IG5lYXJlc3QgPSBbXTtcbiAgICBpZih0aGlzLm5lYXJlc3RfY2FjaGVbY3Vycl9rZXldKSB7XG4gICAgICBuZWFyZXN0ID0gdGhpcy5uZWFyZXN0X2NhY2hlW2N1cnJfa2V5XTtcbiAgICAgIC8vIGNvbnNvbGUubG9nKFwibmVhcmVzdCBmcm9tIGNhY2hlXCIpO1xuICAgIH1lbHNle1xuICAgICAgLy8gc2tpcCBmaWxlcyB3aGVyZSBwYXRoIGNvbnRhaW5zIGFueSBleGNsdXNpb25zXG4gICAgICBmb3IobGV0IGogPSAwOyBqIDwgdGhpcy5maWxlX2V4Y2x1c2lvbnMubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgaWYoY3VycmVudF9ub3RlLnBhdGguaW5kZXhPZih0aGlzLmZpbGVfZXhjbHVzaW9uc1tqXSkgPiAtMSkge1xuICAgICAgICAgIHRoaXMubG9nX2V4Y2x1c2lvbih0aGlzLmZpbGVfZXhjbHVzaW9uc1tqXSk7XG4gICAgICAgICAgLy8gYnJlYWsgb3V0IG9mIGxvb3AgYW5kIGZpbmlzaCBoZXJlXG4gICAgICAgICAgcmV0dXJuIFwiZXhjbHVkZWRcIjtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgLy8gZ2V0IGFsbCBlbWJlZGRpbmdzXG4gICAgICAvLyBhd2FpdCB0aGlzLmdldF9hbGxfZW1iZWRkaW5ncygpO1xuICAgICAgLy8gd3JhcCBnZXQgYWxsIGluIHNldFRpbWVvdXQgdG8gYWxsb3cgZm9yIFVJIHRvIHVwZGF0ZVxuICAgICAgc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgIHRoaXMuZ2V0X2FsbF9lbWJlZGRpbmdzKClcbiAgICAgIH0sIDMwMDApO1xuICAgICAgLy8gZ2V0IGZyb20gY2FjaGUgaWYgbXRpbWUgaXMgc2FtZSBhbmQgdmFsdWVzIGFyZSBub3QgZW1wdHlcbiAgICAgIGlmKHRoaXMuc21hcnRfdmVjX2xpdGUubXRpbWVfaXNfY3VycmVudChjdXJyX2tleSwgY3VycmVudF9ub3RlLnN0YXQubXRpbWUpKSB7XG4gICAgICAgIC8vIHNraXBwaW5nIGdldCBmaWxlIGVtYmVkZGluZ3MgYmVjYXVzZSBub3RoaW5nIGhhcyBjaGFuZ2VkXG4gICAgICAgIC8vIGNvbnNvbGUubG9nKFwiZmluZF9ub3RlX2Nvbm5lY3Rpb25zIC0gc2tpcHBpbmcgZmlsZSAobXRpbWUpXCIpO1xuICAgICAgfWVsc2V7XG4gICAgICAgIC8vIGdldCBmaWxlIGVtYmVkZGluZ3NcbiAgICAgICAgYXdhaXQgdGhpcy5nZXRfZmlsZV9lbWJlZGRpbmdzKGN1cnJlbnRfbm90ZSk7XG4gICAgICB9XG4gICAgICAvLyBnZXQgY3VycmVudCBub3RlIGVtYmVkZGluZyB2ZWN0b3JcbiAgICAgIGNvbnN0IHZlYyA9IHRoaXMuc21hcnRfdmVjX2xpdGUuZ2V0X3ZlYyhjdXJyX2tleSk7XG4gICAgICBpZighdmVjKSB7XG4gICAgICAgIHJldHVybiBcIkVycm9yIGdldHRpbmcgZW1iZWRkaW5ncyBmb3I6IFwiK2N1cnJlbnRfbm90ZS5wYXRoO1xuICAgICAgfVxuICAgICAgXG4gICAgICAvLyBjb21wdXRlIGNvc2luZSBzaW1pbGFyaXR5IGJldHdlZW4gY3VycmVudCBub3RlIGFuZCBhbGwgb3RoZXIgbm90ZXMgdmlhIGVtYmVkZGluZ3NcbiAgICAgIG5lYXJlc3QgPSB0aGlzLnNtYXJ0X3ZlY19saXRlLm5lYXJlc3QodmVjLCB7XG4gICAgICAgIHNraXBfa2V5OiBjdXJyX2tleSxcbiAgICAgICAgc2tpcF9zZWN0aW9uczogdGhpcy5zZXR0aW5ncy5za2lwX3NlY3Rpb25zLFxuICAgICAgfSk7XG4gIFxuICAgICAgLy8gc2F2ZSB0byB0aGlzLm5lYXJlc3RfY2FjaGVcbiAgICAgIHRoaXMubmVhcmVzdF9jYWNoZVtjdXJyX2tleV0gPSBuZWFyZXN0O1xuICAgIH1cblxuICAgIC8vIHJldHVybiBhcnJheSBzb3J0ZWQgYnkgY29zaW5lIHNpbWlsYXJpdHlcbiAgICByZXR1cm4gbmVhcmVzdDtcbiAgfVxuICBcbiAgLy8gY3JlYXRlIHJlbmRlcl9sb2cgb2JqZWN0IG9mIGV4bHVzaW9ucyB3aXRoIG51bWJlciBvZiB0aW1lcyBza2lwcGVkIGFzIHZhbHVlXG4gIGxvZ19leGNsdXNpb24oZXhjbHVzaW9uKSB7XG4gICAgLy8gaW5jcmVtZW50IHJlbmRlcl9sb2cgZm9yIHNraXBwZWQgZmlsZVxuICAgIHRoaXMucmVuZGVyX2xvZy5leGNsdXNpb25zX2xvZ3NbZXhjbHVzaW9uXSA9ICh0aGlzLnJlbmRlcl9sb2cuZXhjbHVzaW9uc19sb2dzW2V4Y2x1c2lvbl0gfHwgMCkgKyAxO1xuICB9XG4gIFxuXG4gIGJsb2NrX3BhcnNlcihtYXJrZG93biwgZmlsZV9wYXRoKXtcbiAgICAvLyBpZiB0aGlzLnNldHRpbmdzLnNraXBfc2VjdGlvbnMgaXMgdHJ1ZSB0aGVuIHJldHVybiBlbXB0eSBhcnJheVxuICAgIGlmKHRoaXMuc2V0dGluZ3Muc2tpcF9zZWN0aW9ucykge1xuICAgICAgcmV0dXJuIFtdO1xuICAgIH1cbiAgICAvLyBzcGxpdCB0aGUgbWFya2Rvd24gaW50byBsaW5lc1xuICAgIGNvbnN0IGxpbmVzID0gbWFya2Rvd24uc3BsaXQoJ1xcbicpO1xuICAgIC8vIGluaXRpYWxpemUgdGhlIGJsb2NrcyBhcnJheVxuICAgIGxldCBibG9ja3MgPSBbXTtcbiAgICAvLyBjdXJyZW50IGhlYWRlcnMgYXJyYXlcbiAgICBsZXQgY3VycmVudEhlYWRlcnMgPSBbXTtcbiAgICAvLyByZW1vdmUgLm1kIGZpbGUgZXh0ZW5zaW9uIGFuZCBjb252ZXJ0IGZpbGVfcGF0aCB0byBicmVhZGNydW1iIGZvcm1hdHRpbmdcbiAgICBjb25zdCBmaWxlX2JyZWFkY3J1bWJzID0gZmlsZV9wYXRoLnJlcGxhY2UoJy5tZCcsICcnKS5yZXBsYWNlKC9cXC8vZywgJyA+ICcpO1xuICAgIC8vIGluaXRpYWxpemUgdGhlIGJsb2NrIHN0cmluZ1xuICAgIGxldCBibG9jayA9ICcnO1xuICAgIGxldCBibG9ja19oZWFkaW5ncyA9ICcnO1xuICAgIGxldCBibG9ja19wYXRoID0gZmlsZV9wYXRoO1xuXG4gICAgbGV0IGxhc3RfaGVhZGluZ19saW5lID0gMDtcbiAgICBsZXQgaSA9IDA7XG4gICAgbGV0IGJsb2NrX2hlYWRpbmdzX2xpc3QgPSBbXTtcbiAgICAvLyBsb29wIHRocm91Z2ggdGhlIGxpbmVzXG4gICAgZm9yIChpID0gMDsgaSA8IGxpbmVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAvLyBnZXQgdGhlIGxpbmVcbiAgICAgIGNvbnN0IGxpbmUgPSBsaW5lc1tpXTtcbiAgICAgIC8vIGlmIGxpbmUgZG9lcyBub3Qgc3RhcnQgd2l0aCAjXG4gICAgICAvLyBvciBpZiBsaW5lIHN0YXJ0cyB3aXRoICMgYW5kIHNlY29uZCBjaGFyYWN0ZXIgaXMgYSB3b3JkIG9yIG51bWJlciBpbmRpY2F0aW5nIGEgXCJ0YWdcIlxuICAgICAgLy8gdGhlbiBhZGQgdG8gYmxvY2tcbiAgICAgIGlmICghbGluZS5zdGFydHNXaXRoKCcjJykgfHwgKFsnIycsJyAnXS5pbmRleE9mKGxpbmVbMV0pIDwgMCkpe1xuICAgICAgICAvLyBza2lwIGlmIGxpbmUgaXMgZW1wdHlcbiAgICAgICAgaWYobGluZSA9PT0gJycpIGNvbnRpbnVlO1xuICAgICAgICAvLyBza2lwIGlmIGxpbmUgaXMgZW1wdHkgYnVsbGV0IG9yIGNoZWNrYm94XG4gICAgICAgIGlmKFsnLSAnLCAnLSBbIF0gJ10uaW5kZXhPZihsaW5lKSA+IC0xKSBjb250aW51ZTtcbiAgICAgICAgLy8gaWYgY3VycmVudEhlYWRlcnMgaXMgZW1wdHkgc2tpcCAob25seSBibG9ja3Mgd2l0aCBoZWFkZXJzLCBvdGhlcndpc2UgYmxvY2sucGF0aCBjb25mbGljdHMgd2l0aCBmaWxlLnBhdGgpXG4gICAgICAgIGlmKGN1cnJlbnRIZWFkZXJzLmxlbmd0aCA9PT0gMCkgY29udGludWU7XG4gICAgICAgIC8vIGFkZCBsaW5lIHRvIGJsb2NrXG4gICAgICAgIGJsb2NrICs9IFwiXFxuXCIgKyBsaW5lO1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIC8qKlxuICAgICAgICogQkVHSU4gSGVhZGluZyBwYXJzaW5nXG4gICAgICAgKiAtIGxpa2VseSBhIGhlYWRpbmcgaWYgbWFkZSBpdCB0aGlzIGZhclxuICAgICAgICovXG4gICAgICBsYXN0X2hlYWRpbmdfbGluZSA9IGk7XG4gICAgICAvLyBwdXNoIHRoZSBjdXJyZW50IGJsb2NrIHRvIHRoZSBibG9ja3MgYXJyYXkgdW5sZXNzIGxhc3QgbGluZSB3YXMgYSBhbHNvIGEgaGVhZGVyXG4gICAgICBpZihpID4gMCAmJiAobGFzdF9oZWFkaW5nX2xpbmUgIT09IChpLTEpKSAmJiAoYmxvY2suaW5kZXhPZihcIlxcblwiKSA+IC0xKSAmJiB0aGlzLnZhbGlkYXRlX2hlYWRpbmdzKGJsb2NrX2hlYWRpbmdzKSkge1xuICAgICAgICBvdXRwdXRfYmxvY2soKTtcbiAgICAgIH1cbiAgICAgIC8vIGdldCB0aGUgaGVhZGVyIGxldmVsXG4gICAgICBjb25zdCBsZXZlbCA9IGxpbmUuc3BsaXQoJyMnKS5sZW5ndGggLSAxO1xuICAgICAgLy8gcmVtb3ZlIGFueSBoZWFkZXJzIGZyb20gdGhlIGN1cnJlbnQgaGVhZGVycyBhcnJheSB0aGF0IGFyZSBoaWdoZXIgdGhhbiB0aGUgY3VycmVudCBoZWFkZXIgbGV2ZWxcbiAgICAgIGN1cnJlbnRIZWFkZXJzID0gY3VycmVudEhlYWRlcnMuZmlsdGVyKGhlYWRlciA9PiBoZWFkZXIubGV2ZWwgPCBsZXZlbCk7XG4gICAgICAvLyBhZGQgaGVhZGVyIGFuZCBsZXZlbCB0byBjdXJyZW50IGhlYWRlcnMgYXJyYXlcbiAgICAgIC8vIHRyaW0gdGhlIGhlYWRlciB0byByZW1vdmUgXCIjXCIgYW5kIGFueSB0cmFpbGluZyBzcGFjZXNcbiAgICAgIGN1cnJlbnRIZWFkZXJzLnB1c2goe2hlYWRlcjogbGluZS5yZXBsYWNlKC8jL2csICcnKS50cmltKCksIGxldmVsOiBsZXZlbH0pO1xuICAgICAgLy8gaW5pdGlhbGl6ZSB0aGUgYmxvY2sgYnJlYWRjcnVtYnMgd2l0aCBmaWxlLnBhdGggdGhlIGN1cnJlbnQgaGVhZGVyc1xuICAgICAgYmxvY2sgPSBmaWxlX2JyZWFkY3J1bWJzO1xuICAgICAgYmxvY2sgKz0gXCI6IFwiICsgY3VycmVudEhlYWRlcnMubWFwKGhlYWRlciA9PiBoZWFkZXIuaGVhZGVyKS5qb2luKCcgPiAnKTtcbiAgICAgIGJsb2NrX2hlYWRpbmdzID0gXCIjXCIrY3VycmVudEhlYWRlcnMubWFwKGhlYWRlciA9PiBoZWFkZXIuaGVhZGVyKS5qb2luKCcjJyk7XG4gICAgICAvLyBpZiBibG9ja19oZWFkaW5ncyBpcyBhbHJlYWR5IGluIGJsb2NrX2hlYWRpbmdzX2xpc3QgdGhlbiBhZGQgYSBudW1iZXIgdG8gdGhlIGVuZFxuICAgICAgaWYoYmxvY2tfaGVhZGluZ3NfbGlzdC5pbmRleE9mKGJsb2NrX2hlYWRpbmdzKSA+IC0xKSB7XG4gICAgICAgIGxldCBjb3VudCA9IDE7XG4gICAgICAgIHdoaWxlKGJsb2NrX2hlYWRpbmdzX2xpc3QuaW5kZXhPZihgJHtibG9ja19oZWFkaW5nc317JHtjb3VudH19YCkgPiAtMSkge1xuICAgICAgICAgIGNvdW50Kys7XG4gICAgICAgIH1cbiAgICAgICAgYmxvY2tfaGVhZGluZ3MgPSBgJHtibG9ja19oZWFkaW5nc317JHtjb3VudH19YDtcbiAgICAgIH1cbiAgICAgIGJsb2NrX2hlYWRpbmdzX2xpc3QucHVzaChibG9ja19oZWFkaW5ncyk7XG4gICAgICBibG9ja19wYXRoID0gZmlsZV9wYXRoICsgYmxvY2tfaGVhZGluZ3M7XG4gICAgfVxuICAgIC8vIGhhbmRsZSByZW1haW5pbmcgYWZ0ZXIgbG9vcFxuICAgIGlmKChsYXN0X2hlYWRpbmdfbGluZSAhPT0gKGktMSkpICYmIChibG9jay5pbmRleE9mKFwiXFxuXCIpID4gLTEpICYmIHRoaXMudmFsaWRhdGVfaGVhZGluZ3MoYmxvY2tfaGVhZGluZ3MpKSBvdXRwdXRfYmxvY2soKTtcbiAgICAvLyByZW1vdmUgYW55IGJsb2NrcyB0aGF0IGFyZSB0b28gc2hvcnQgKGxlbmd0aCA8IDUwKVxuICAgIGJsb2NrcyA9IGJsb2Nrcy5maWx0ZXIoYiA9PiBiLmxlbmd0aCA+IDUwKTtcbiAgICAvLyBjb25zb2xlLmxvZyhibG9ja3MpO1xuICAgIC8vIHJldHVybiB0aGUgYmxvY2tzIGFycmF5XG4gICAgcmV0dXJuIGJsb2NrcztcblxuICAgIGZ1bmN0aW9uIG91dHB1dF9ibG9jaygpIHtcbiAgICAgIC8vIGJyZWFkY3J1bWJzIGxlbmd0aCAoZmlyc3QgbGluZSBvZiBibG9jaylcbiAgICAgIGNvbnN0IGJyZWFkY3J1bWJzX2xlbmd0aCA9IGJsb2NrLmluZGV4T2YoXCJcXG5cIikgKyAxO1xuICAgICAgY29uc3QgYmxvY2tfbGVuZ3RoID0gYmxvY2subGVuZ3RoIC0gYnJlYWRjcnVtYnNfbGVuZ3RoO1xuICAgICAgLy8gdHJpbSBibG9jayB0byBtYXggbGVuZ3RoXG4gICAgICBpZiAoYmxvY2subGVuZ3RoID4gTUFYX0VNQkVEX1NUUklOR19MRU5HVEgpIHtcbiAgICAgICAgYmxvY2sgPSBibG9jay5zdWJzdHJpbmcoMCwgTUFYX0VNQkVEX1NUUklOR19MRU5HVEgpO1xuICAgICAgfVxuICAgICAgYmxvY2tzLnB1c2goeyB0ZXh0OiBibG9jay50cmltKCksIHBhdGg6IGJsb2NrX3BhdGgsIGxlbmd0aDogYmxvY2tfbGVuZ3RoIH0pO1xuICAgIH1cbiAgfVxuICAvLyByZXZlcnNlLXJldHJpZXZlIGJsb2NrIGdpdmVuIHBhdGhcbiAgYXN5bmMgYmxvY2tfcmV0cmlldmVyKHBhdGgsIGxpbWl0cz17fSkge1xuICAgIGxpbWl0cyA9IHtcbiAgICAgIGxpbmVzOiBudWxsLFxuICAgICAgY2hhcnNfcGVyX2xpbmU6IG51bGwsXG4gICAgICBtYXhfY2hhcnM6IG51bGwsXG4gICAgICAuLi5saW1pdHNcbiAgICB9XG4gICAgLy8gcmV0dXJuIGlmIG5vICMgaW4gcGF0aFxuICAgIGlmIChwYXRoLmluZGV4T2YoJyMnKSA8IDApIHtcbiAgICAgIGNvbnNvbGUubG9nKFwibm90IGEgYmxvY2sgcGF0aDogXCIrcGF0aCk7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIGxldCBibG9jayA9IFtdO1xuICAgIGxldCBibG9ja19oZWFkaW5ncyA9IHBhdGguc3BsaXQoJyMnKS5zbGljZSgxKTtcbiAgICAvLyBpZiBwYXRoIGVuZHMgd2l0aCBudW1iZXIgaW4gY3VybHkgYnJhY2VzXG4gICAgbGV0IGhlYWRpbmdfb2NjdXJyZW5jZSA9IDA7XG4gICAgaWYoYmxvY2tfaGVhZGluZ3NbYmxvY2tfaGVhZGluZ3MubGVuZ3RoLTFdLmluZGV4T2YoJ3snKSA+IC0xKSB7XG4gICAgICAvLyBnZXQgdGhlIG9jY3VycmVuY2UgbnVtYmVyXG4gICAgICBoZWFkaW5nX29jY3VycmVuY2UgPSBwYXJzZUludChibG9ja19oZWFkaW5nc1tibG9ja19oZWFkaW5ncy5sZW5ndGgtMV0uc3BsaXQoJ3snKVsxXS5yZXBsYWNlKCd9JywgJycpKTtcbiAgICAgIC8vIHJlbW92ZSB0aGUgb2NjdXJyZW5jZSBmcm9tIHRoZSBsYXN0IGhlYWRpbmdcbiAgICAgIGJsb2NrX2hlYWRpbmdzW2Jsb2NrX2hlYWRpbmdzLmxlbmd0aC0xXSA9IGJsb2NrX2hlYWRpbmdzW2Jsb2NrX2hlYWRpbmdzLmxlbmd0aC0xXS5zcGxpdCgneycpWzBdO1xuICAgIH1cbiAgICBsZXQgY3VycmVudEhlYWRlcnMgPSBbXTtcbiAgICBsZXQgb2NjdXJyZW5jZV9jb3VudCA9IDA7XG4gICAgbGV0IGJlZ2luX2xpbmUgPSAwO1xuICAgIGxldCBpID0gMDtcbiAgICAvLyBnZXQgZmlsZSBwYXRoIGZyb20gcGF0aFxuICAgIGNvbnN0IGZpbGVfcGF0aCA9IHBhdGguc3BsaXQoJyMnKVswXTtcbiAgICAvLyBnZXQgZmlsZVxuICAgIGNvbnN0IGZpbGUgPSB0aGlzLmFwcC52YXVsdC5nZXRBYnN0cmFjdEZpbGVCeVBhdGgoZmlsZV9wYXRoKTtcbiAgICBpZighKGZpbGUgaW5zdGFuY2VvZiBPYnNpZGlhbi5URmlsZSkpIHtcbiAgICAgIGNvbnNvbGUubG9nKFwibm90IGEgZmlsZTogXCIrZmlsZV9wYXRoKTtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgLy8gZ2V0IGZpbGUgY29udGVudHNcbiAgICBjb25zdCBmaWxlX2NvbnRlbnRzID0gYXdhaXQgdGhpcy5hcHAudmF1bHQuY2FjaGVkUmVhZChmaWxlKTtcbiAgICAvLyBzcGxpdCB0aGUgZmlsZSBjb250ZW50cyBpbnRvIGxpbmVzXG4gICAgY29uc3QgbGluZXMgPSBmaWxlX2NvbnRlbnRzLnNwbGl0KCdcXG4nKTtcbiAgICAvLyBsb29wIHRocm91Z2ggdGhlIGxpbmVzXG4gICAgbGV0IGlzX2NvZGUgPSBmYWxzZTtcbiAgICBmb3IgKGkgPSAwOyBpIDwgbGluZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgIC8vIGdldCB0aGUgbGluZVxuICAgICAgY29uc3QgbGluZSA9IGxpbmVzW2ldO1xuICAgICAgLy8gaWYgbGluZSBiZWdpbnMgd2l0aCB0aHJlZSBiYWNrdGlja3MgdGhlbiB0b2dnbGUgaXNfY29kZVxuICAgICAgaWYobGluZS5pbmRleE9mKCdgYGAnKSA9PT0gMCkge1xuICAgICAgICBpc19jb2RlID0gIWlzX2NvZGU7XG4gICAgICB9XG4gICAgICAvLyBpZiBpc19jb2RlIGlzIHRydWUgdGhlbiBhZGQgbGluZSB3aXRoIHByZWNlZGluZyB0YWIgYW5kIGNvbnRpbnVlXG4gICAgICBpZihpc19jb2RlKSB7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgICAgLy8gc2tpcCBpZiBsaW5lIGlzIGVtcHR5IGJ1bGxldCBvciBjaGVja2JveFxuICAgICAgaWYoWyctICcsICctIFsgXSAnXS5pbmRleE9mKGxpbmUpID4gLTEpIGNvbnRpbnVlO1xuICAgICAgLy8gaWYgbGluZSBkb2VzIG5vdCBzdGFydCB3aXRoICNcbiAgICAgIC8vIG9yIGlmIGxpbmUgc3RhcnRzIHdpdGggIyBhbmQgc2Vjb25kIGNoYXJhY3RlciBpcyBhIHdvcmQgb3IgbnVtYmVyIGluZGljYXRpbmcgYSBcInRhZ1wiXG4gICAgICAvLyB0aGVuIGNvbnRpbnVlIHRvIG5leHQgbGluZVxuICAgICAgaWYgKCFsaW5lLnN0YXJ0c1dpdGgoJyMnKSB8fCAoWycjJywnICddLmluZGV4T2YobGluZVsxXSkgPCAwKSl7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgICAgLyoqXG4gICAgICAgKiBCRUdJTiBIZWFkaW5nIHBhcnNpbmdcbiAgICAgICAqIC0gbGlrZWx5IGEgaGVhZGluZyBpZiBtYWRlIGl0IHRoaXMgZmFyXG4gICAgICAgKi9cbiAgICAgIC8vIGdldCB0aGUgaGVhZGluZyB0ZXh0XG4gICAgICBjb25zdCBoZWFkaW5nX3RleHQgPSBsaW5lLnJlcGxhY2UoLyMvZywgJycpLnRyaW0oKTtcbiAgICAgIC8vIGNvbnRpbnVlIGlmIGhlYWRpbmcgdGV4dCBpcyBub3QgaW4gYmxvY2tfaGVhZGluZ3NcbiAgICAgIGNvbnN0IGhlYWRpbmdfaW5kZXggPSBibG9ja19oZWFkaW5ncy5pbmRleE9mKGhlYWRpbmdfdGV4dCk7XG4gICAgICBpZiAoaGVhZGluZ19pbmRleCA8IDApIGNvbnRpbnVlO1xuICAgICAgLy8gaWYgY3VycmVudEhlYWRlcnMubGVuZ3RoICE9PSBoZWFkaW5nX2luZGV4IHRoZW4gd2UgaGF2ZSBhIG1pc21hdGNoXG4gICAgICBpZiAoY3VycmVudEhlYWRlcnMubGVuZ3RoICE9PSBoZWFkaW5nX2luZGV4KSBjb250aW51ZTtcbiAgICAgIC8vIHB1c2ggdGhlIGhlYWRpbmcgdGV4dCB0byB0aGUgY3VycmVudEhlYWRlcnMgYXJyYXlcbiAgICAgIGN1cnJlbnRIZWFkZXJzLnB1c2goaGVhZGluZ190ZXh0KTtcbiAgICAgIC8vIGlmIGN1cnJlbnRIZWFkZXJzLmxlbmd0aCA9PT0gYmxvY2tfaGVhZGluZ3MubGVuZ3RoIHRoZW4gd2UgaGF2ZSBhIG1hdGNoXG4gICAgICBpZiAoY3VycmVudEhlYWRlcnMubGVuZ3RoID09PSBibG9ja19oZWFkaW5ncy5sZW5ndGgpIHtcbiAgICAgICAgLy8gaWYgaGVhZGluZ19vY2N1cnJlbmNlIGlzIGRlZmluZWQgdGhlbiBpbmNyZW1lbnQgb2NjdXJyZW5jZV9jb3VudFxuICAgICAgICBpZihoZWFkaW5nX29jY3VycmVuY2UgPT09IDApIHtcbiAgICAgICAgICAvLyBzZXQgYmVnaW5fbGluZSB0byBpICsgMVxuICAgICAgICAgIGJlZ2luX2xpbmUgPSBpICsgMTtcbiAgICAgICAgICBicmVhazsgLy8gYnJlYWsgb3V0IG9mIGxvb3BcbiAgICAgICAgfVxuICAgICAgICAvLyBpZiBvY2N1cnJlbmNlX2NvdW50ICE9PSBoZWFkaW5nX29jY3VycmVuY2UgdGhlbiBjb250aW51ZVxuICAgICAgICBpZihvY2N1cnJlbmNlX2NvdW50ID09PSBoZWFkaW5nX29jY3VycmVuY2Upe1xuICAgICAgICAgIGJlZ2luX2xpbmUgPSBpICsgMTtcbiAgICAgICAgICBicmVhazsgLy8gYnJlYWsgb3V0IG9mIGxvb3BcbiAgICAgICAgfVxuICAgICAgICBvY2N1cnJlbmNlX2NvdW50Kys7XG4gICAgICAgIC8vIHJlc2V0IGN1cnJlbnRIZWFkZXJzXG4gICAgICAgIGN1cnJlbnRIZWFkZXJzLnBvcCgpO1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICB9XG4gICAgLy8gaWYgbm8gYmVnaW5fbGluZSB0aGVuIHJldHVybiBmYWxzZVxuICAgIGlmIChiZWdpbl9saW5lID09PSAwKSByZXR1cm4gZmFsc2U7XG4gICAgLy8gaXRlcmF0ZSB0aHJvdWdoIGxpbmVzIHN0YXJ0aW5nIGF0IGJlZ2luX2xpbmVcbiAgICBpc19jb2RlID0gZmFsc2U7XG4gICAgLy8gY2hhcmFjdGVyIGFjY3VtdWxhdG9yXG4gICAgbGV0IGNoYXJfY291bnQgPSAwO1xuICAgIGZvciAoaSA9IGJlZ2luX2xpbmU7IGkgPCBsaW5lcy5sZW5ndGg7IGkrKykge1xuICAgICAgaWYoKHR5cGVvZiBsaW5lX2xpbWl0ID09PSBcIm51bWJlclwiKSAmJiAoYmxvY2subGVuZ3RoID4gbGluZV9saW1pdCkpe1xuICAgICAgICBibG9jay5wdXNoKFwiLi4uXCIpO1xuICAgICAgICBicmVhazsgLy8gZW5kcyB3aGVuIGxpbmVfbGltaXQgaXMgcmVhY2hlZFxuICAgICAgfVxuICAgICAgbGV0IGxpbmUgPSBsaW5lc1tpXTtcbiAgICAgIGlmICgobGluZS5pbmRleE9mKCcjJykgPT09IDApICYmIChbJyMnLCcgJ10uaW5kZXhPZihsaW5lWzFdKSAhPT0gLTEpKXtcbiAgICAgICAgYnJlYWs7IC8vIGVuZHMgd2hlbiBlbmNvdW50ZXJpbmcgbmV4dCBoZWFkZXJcbiAgICAgIH1cbiAgICAgIC8vIERFUFJFQ0FURUQ6IHNob3VsZCBiZSBoYW5kbGVkIGJ5IG5ld19saW5lK2NoYXJfY291bnQgY2hlY2sgKGhhcHBlbnMgaW4gcHJldmlvdXMgaXRlcmF0aW9uKVxuICAgICAgLy8gaWYgY2hhcl9jb3VudCBpcyBncmVhdGVyIHRoYW4gbGltaXQubWF4X2NoYXJzLCBza2lwXG4gICAgICBpZiAobGltaXRzLm1heF9jaGFycyAmJiBjaGFyX2NvdW50ID4gbGltaXRzLm1heF9jaGFycykge1xuICAgICAgICBibG9jay5wdXNoKFwiLi4uXCIpO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIC8vIGlmIG5ld19saW5lICsgY2hhcl9jb3VudCBpcyBncmVhdGVyIHRoYW4gbGltaXQubWF4X2NoYXJzLCBza2lwXG4gICAgICBpZiAobGltaXRzLm1heF9jaGFycyAmJiAoKGxpbmUubGVuZ3RoICsgY2hhcl9jb3VudCkgPiBsaW1pdHMubWF4X2NoYXJzKSkge1xuICAgICAgICBjb25zdCBtYXhfbmV3X2NoYXJzID0gbGltaXRzLm1heF9jaGFycyAtIGNoYXJfY291bnQ7XG4gICAgICAgIGxpbmUgPSBsaW5lLnNsaWNlKDAsIG1heF9uZXdfY2hhcnMpICsgXCIuLi5cIjtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICAvLyB2YWxpZGF0ZS9mb3JtYXRcbiAgICAgIC8vIGlmIGxpbmUgaXMgZW1wdHksIHNraXBcbiAgICAgIGlmIChsaW5lLmxlbmd0aCA9PT0gMCkgY29udGludWU7XG4gICAgICAvLyBsaW1pdCBsZW5ndGggb2YgbGluZSB0byBOIGNoYXJhY3RlcnNcbiAgICAgIGlmIChsaW1pdHMuY2hhcnNfcGVyX2xpbmUgJiYgbGluZS5sZW5ndGggPiBsaW1pdHMuY2hhcnNfcGVyX2xpbmUpIHtcbiAgICAgICAgbGluZSA9IGxpbmUuc2xpY2UoMCwgbGltaXRzLmNoYXJzX3Blcl9saW5lKSArIFwiLi4uXCI7XG4gICAgICB9XG4gICAgICAvLyBpZiBsaW5lIGlzIGEgY29kZSBibG9jaywgc2tpcFxuICAgICAgaWYgKGxpbmUuc3RhcnRzV2l0aChcImBgYFwiKSkge1xuICAgICAgICBpc19jb2RlID0gIWlzX2NvZGU7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgICAgaWYgKGlzX2NvZGUpe1xuICAgICAgICAvLyBhZGQgdGFiIHRvIGJlZ2lubmluZyBvZiBsaW5lXG4gICAgICAgIGxpbmUgPSBcIlxcdFwiK2xpbmU7XG4gICAgICB9XG4gICAgICAvLyBhZGQgbGluZSB0byBibG9ja1xuICAgICAgYmxvY2sucHVzaChsaW5lKTtcbiAgICAgIC8vIGluY3JlbWVudCBjaGFyX2NvdW50XG4gICAgICBjaGFyX2NvdW50ICs9IGxpbmUubGVuZ3RoO1xuICAgIH1cbiAgICAvLyBjbG9zZSBjb2RlIGJsb2NrIGlmIG9wZW5cbiAgICBpZiAoaXNfY29kZSkge1xuICAgICAgYmxvY2sucHVzaChcImBgYFwiKTtcbiAgICB9XG4gICAgcmV0dXJuIGJsb2NrLmpvaW4oXCJcXG5cIikudHJpbSgpO1xuICB9XG5cbiAgLy8gcmV0cmlldmUgYSBmaWxlIGZyb20gdGhlIHZhdWx0XG4gIGFzeW5jIGZpbGVfcmV0cmlldmVyKGxpbmssIGxpbWl0cz17fSkge1xuICAgIGxpbWl0cyA9IHtcbiAgICAgIGxpbmVzOiBudWxsLFxuICAgICAgbWF4X2NoYXJzOiBudWxsLFxuICAgICAgY2hhcnNfcGVyX2xpbmU6IG51bGwsXG4gICAgICAuLi5saW1pdHNcbiAgICB9O1xuICAgIGNvbnN0IHRoaXNfZmlsZSA9IHRoaXMuYXBwLnZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aChsaW5rKTtcbiAgICAvLyBpZiBmaWxlIGlzIG5vdCBmb3VuZCwgc2tpcFxuICAgIGlmICghKHRoaXNfZmlsZSBpbnN0YW5jZW9mIE9ic2lkaWFuLlRBYnN0cmFjdEZpbGUpKSByZXR1cm4gZmFsc2U7XG4gICAgLy8gdXNlIGNhY2hlZFJlYWQgdG8gZ2V0IHRoZSBmaXJzdCAxMCBsaW5lcyBvZiB0aGUgZmlsZVxuICAgIGNvbnN0IGZpbGVfY29udGVudCA9IGF3YWl0IHRoaXMuYXBwLnZhdWx0LmNhY2hlZFJlYWQodGhpc19maWxlKTtcbiAgICBjb25zdCBmaWxlX2xpbmVzID0gZmlsZV9jb250ZW50LnNwbGl0KFwiXFxuXCIpO1xuICAgIGxldCBmaXJzdF90ZW5fbGluZXMgPSBbXTtcbiAgICBsZXQgaXNfY29kZSA9IGZhbHNlO1xuICAgIGxldCBjaGFyX2FjY3VtID0gMDtcbiAgICBjb25zdCBsaW5lX2xpbWl0ID0gbGltaXRzLmxpbmVzIHx8IGZpbGVfbGluZXMubGVuZ3RoO1xuICAgIGZvciAobGV0IGkgPSAwOyBmaXJzdF90ZW5fbGluZXMubGVuZ3RoIDwgbGluZV9saW1pdDsgaSsrKSB7XG4gICAgICBsZXQgbGluZSA9IGZpbGVfbGluZXNbaV07XG4gICAgICAvLyBpZiBsaW5lIGlzIHVuZGVmaW5lZCwgYnJlYWtcbiAgICAgIGlmICh0eXBlb2YgbGluZSA9PT0gJ3VuZGVmaW5lZCcpXG4gICAgICAgIGJyZWFrO1xuICAgICAgLy8gaWYgbGluZSBpcyBlbXB0eSwgc2tpcFxuICAgICAgaWYgKGxpbmUubGVuZ3RoID09PSAwKVxuICAgICAgICBjb250aW51ZTtcbiAgICAgIC8vIGxpbWl0IGxlbmd0aCBvZiBsaW5lIHRvIE4gY2hhcmFjdGVyc1xuICAgICAgaWYgKGxpbWl0cy5jaGFyc19wZXJfbGluZSAmJiBsaW5lLmxlbmd0aCA+IGxpbWl0cy5jaGFyc19wZXJfbGluZSkge1xuICAgICAgICBsaW5lID0gbGluZS5zbGljZSgwLCBsaW1pdHMuY2hhcnNfcGVyX2xpbmUpICsgXCIuLi5cIjtcbiAgICAgIH1cbiAgICAgIC8vIGlmIGxpbmUgaXMgXCItLS1cIiwgc2tpcFxuICAgICAgaWYgKGxpbmUgPT09IFwiLS0tXCIpXG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgLy8gc2tpcCBpZiBsaW5lIGlzIGVtcHR5IGJ1bGxldCBvciBjaGVja2JveFxuICAgICAgaWYgKFsnLSAnLCAnLSBbIF0gJ10uaW5kZXhPZihsaW5lKSA+IC0xKVxuICAgICAgICBjb250aW51ZTtcbiAgICAgIC8vIGlmIGxpbmUgaXMgYSBjb2RlIGJsb2NrLCBza2lwXG4gICAgICBpZiAobGluZS5pbmRleE9mKFwiYGBgXCIpID09PSAwKSB7XG4gICAgICAgIGlzX2NvZGUgPSAhaXNfY29kZTtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgICAvLyBpZiBjaGFyX2FjY3VtIGlzIGdyZWF0ZXIgdGhhbiBsaW1pdC5tYXhfY2hhcnMsIHNraXBcbiAgICAgIGlmIChsaW1pdHMubWF4X2NoYXJzICYmIGNoYXJfYWNjdW0gPiBsaW1pdHMubWF4X2NoYXJzKSB7XG4gICAgICAgIGZpcnN0X3Rlbl9saW5lcy5wdXNoKFwiLi4uXCIpO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGlmIChpc19jb2RlKSB7XG4gICAgICAgIC8vIGlmIGlzIGNvZGUsIGFkZCB0YWIgdG8gYmVnaW5uaW5nIG9mIGxpbmVcbiAgICAgICAgbGluZSA9IFwiXFx0XCIgKyBsaW5lO1xuICAgICAgfVxuICAgICAgLy8gaWYgbGluZSBpcyBhIGhlYWRpbmdcbiAgICAgIGlmIChsaW5lX2lzX2hlYWRpbmcobGluZSkpIHtcbiAgICAgICAgLy8gbG9vayBhdCBsYXN0IGxpbmUgaW4gZmlyc3RfdGVuX2xpbmVzIHRvIHNlZSBpZiBpdCBpcyBhIGhlYWRpbmdcbiAgICAgICAgLy8gbm90ZTogdXNlcyBsYXN0IGluIGZpcnN0X3Rlbl9saW5lcywgaW5zdGVhZCBvZiBsb29rIGFoZWFkIGluIGZpbGVfbGluZXMsIGJlY2F1c2UuLlxuICAgICAgICAvLyAuLi5uZXh0IGxpbmUgbWF5IGJlIGV4Y2x1ZGVkIGZyb20gZmlyc3RfdGVuX2xpbmVzIGJ5IHByZXZpb3VzIGlmIHN0YXRlbWVudHNcbiAgICAgICAgaWYgKChmaXJzdF90ZW5fbGluZXMubGVuZ3RoID4gMCkgJiYgbGluZV9pc19oZWFkaW5nKGZpcnN0X3Rlbl9saW5lc1tmaXJzdF90ZW5fbGluZXMubGVuZ3RoIC0gMV0pKSB7XG4gICAgICAgICAgLy8gaWYgbGFzdCBsaW5lIGlzIGEgaGVhZGluZywgcmVtb3ZlIGl0XG4gICAgICAgICAgZmlyc3RfdGVuX2xpbmVzLnBvcCgpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICAvLyBhZGQgbGluZSB0byBmaXJzdF90ZW5fbGluZXNcbiAgICAgIGZpcnN0X3Rlbl9saW5lcy5wdXNoKGxpbmUpO1xuICAgICAgLy8gaW5jcmVtZW50IGNoYXJfYWNjdW1cbiAgICAgIGNoYXJfYWNjdW0gKz0gbGluZS5sZW5ndGg7XG4gICAgfVxuICAgIC8vIGZvciBlYWNoIGxpbmUgaW4gZmlyc3RfdGVuX2xpbmVzLCBhcHBseSB2aWV3LXNwZWNpZmljIGZvcm1hdHRpbmdcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGZpcnN0X3Rlbl9saW5lcy5sZW5ndGg7IGkrKykge1xuICAgICAgLy8gaWYgbGluZSBpcyBhIGhlYWRpbmdcbiAgICAgIGlmIChsaW5lX2lzX2hlYWRpbmcoZmlyc3RfdGVuX2xpbmVzW2ldKSkge1xuICAgICAgICAvLyBpZiB0aGlzIGlzIHRoZSBsYXN0IGxpbmUgaW4gZmlyc3RfdGVuX2xpbmVzXG4gICAgICAgIGlmIChpID09PSBmaXJzdF90ZW5fbGluZXMubGVuZ3RoIC0gMSkge1xuICAgICAgICAgIC8vIHJlbW92ZSB0aGUgbGFzdCBsaW5lIGlmIGl0IGlzIGEgaGVhZGluZ1xuICAgICAgICAgIGZpcnN0X3Rlbl9saW5lcy5wb3AoKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgICAvLyByZW1vdmUgaGVhZGluZyBzeW50YXggdG8gaW1wcm92ZSByZWFkYWJpbGl0eSBpbiBzbWFsbCBzcGFjZVxuICAgICAgICBmaXJzdF90ZW5fbGluZXNbaV0gPSBmaXJzdF90ZW5fbGluZXNbaV0ucmVwbGFjZSgvIysvLCBcIlwiKTtcbiAgICAgICAgZmlyc3RfdGVuX2xpbmVzW2ldID0gYFxcbiR7Zmlyc3RfdGVuX2xpbmVzW2ldfTpgO1xuICAgICAgfVxuICAgIH1cbiAgICAvLyBqb2luIGZpcnN0IHRlbiBsaW5lcyBpbnRvIHN0cmluZ1xuICAgIGZpcnN0X3Rlbl9saW5lcyA9IGZpcnN0X3Rlbl9saW5lcy5qb2luKFwiXFxuXCIpO1xuICAgIHJldHVybiBmaXJzdF90ZW5fbGluZXM7XG4gIH1cblxuICAvLyBpdGVyYXRlIHRocm91Z2ggYmxvY2tzIGFuZCBza2lwIGlmIGJsb2NrX2hlYWRpbmdzIGNvbnRhaW5zIHRoaXMuaGVhZGVyX2V4Y2x1c2lvbnNcbiAgdmFsaWRhdGVfaGVhZGluZ3MoYmxvY2tfaGVhZGluZ3MpIHtcbiAgICBsZXQgdmFsaWQgPSB0cnVlO1xuICAgIGlmICh0aGlzLmhlYWRlcl9leGNsdXNpb25zLmxlbmd0aCA+IDApIHtcbiAgICAgIGZvciAobGV0IGsgPSAwOyBrIDwgdGhpcy5oZWFkZXJfZXhjbHVzaW9ucy5sZW5ndGg7IGsrKykge1xuICAgICAgICBpZiAoYmxvY2tfaGVhZGluZ3MuaW5kZXhPZih0aGlzLmhlYWRlcl9leGNsdXNpb25zW2tdKSA+IC0xKSB7XG4gICAgICAgICAgdmFsaWQgPSBmYWxzZTtcbiAgICAgICAgICB0aGlzLmxvZ19leGNsdXNpb24oXCJoZWFkaW5nOiBcIit0aGlzLmhlYWRlcl9leGNsdXNpb25zW2tdKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gdmFsaWQ7XG4gIH1cbiAgLy8gcmVuZGVyIFwiU21hcnQgQ29ubmVjdGlvbnNcIiB0ZXh0IGZpeGVkIGluIHRoZSBib3R0b20gcmlnaHQgY29ybmVyXG4gIHJlbmRlcl9icmFuZChjb250YWluZXIsIGxvY2F0aW9uPVwiZGVmYXVsdFwiKSB7XG4gICAgLy8gaWYgbG9jYXRpb24gaXMgYWxsIHRoZW4gZ2V0IE9iamVjdC5rZXlzKHRoaXMuc2NfYnJhbmRpbmcpIGFuZCBjYWxsIHRoaXMgZnVuY3Rpb24gZm9yIGVhY2hcbiAgICBpZiAoY29udGFpbmVyID09PSBcImFsbFwiKSB7XG4gICAgICBjb25zdCBsb2NhdGlvbnMgPSBPYmplY3Qua2V5cyh0aGlzLnNjX2JyYW5kaW5nKTtcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbG9jYXRpb25zLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHRoaXMucmVuZGVyX2JyYW5kKHRoaXMuc2NfYnJhbmRpbmdbbG9jYXRpb25zW2ldXSwgbG9jYXRpb25zW2ldKTtcbiAgICAgIH1cbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgLy8gYnJhbmQgY29udGFpbmVyXG4gICAgdGhpcy5zY19icmFuZGluZ1tsb2NhdGlvbl0gPSBjb250YWluZXI7XG4gICAgLy8gaWYgdGhpcy5zY19icmFuZGluZ1tsb2NhdGlvbl0gY29udGFpbnMgY2hpbGQgd2l0aCBjbGFzcyBcInNjLWJyYW5kXCIsIHJlbW92ZSBpdFxuICAgIGlmICh0aGlzLnNjX2JyYW5kaW5nW2xvY2F0aW9uXS5xdWVyeVNlbGVjdG9yKFwiLnNjLWJyYW5kXCIpKSB7XG4gICAgICB0aGlzLnNjX2JyYW5kaW5nW2xvY2F0aW9uXS5xdWVyeVNlbGVjdG9yKFwiLnNjLWJyYW5kXCIpLnJlbW92ZSgpO1xuICAgIH1cbiAgICBjb25zdCBicmFuZF9jb250YWluZXIgPSB0aGlzLnNjX2JyYW5kaW5nW2xvY2F0aW9uXS5jcmVhdGVFbChcImRpdlwiLCB7IGNsczogXCJzYy1icmFuZFwiIH0pO1xuICAgIC8vIGFkZCB0ZXh0XG4gICAgLy8gYWRkIFNWRyBzaWduYWwgaWNvbiB1c2luZyBnZXRJY29uXG4gICAgT2JzaWRpYW4uc2V0SWNvbihicmFuZF9jb250YWluZXIsIFwic21hcnQtY29ubmVjdGlvbnNcIik7XG4gICAgY29uc3QgYnJhbmRfcCA9IGJyYW5kX2NvbnRhaW5lci5jcmVhdGVFbChcInBcIik7XG4gICAgbGV0IHRleHQgPSBcIlNtYXJ0IENvbm5lY3Rpb25zXCI7XG4gICAgbGV0IGF0dHIgPSB7fTtcbiAgICAvLyBpZiB1cGRhdGUgYXZhaWxhYmxlLCBjaGFuZ2UgdGV4dCB0byBcIlVwZGF0ZSBBdmFpbGFibGVcIlxuICAgIGlmICh0aGlzLnVwZGF0ZV9hdmFpbGFibGUpIHtcbiAgICAgIHRleHQgPSBcIlVwZGF0ZSBBdmFpbGFibGVcIjtcbiAgICAgIGF0dHIgPSB7XG4gICAgICAgIHN0eWxlOiBcImZvbnQtd2VpZ2h0OiA3MDA7XCJcbiAgICAgIH07XG4gICAgfVxuICAgIGJyYW5kX3AuY3JlYXRlRWwoXCJhXCIsIHtcbiAgICAgIGNsczogXCJcIixcbiAgICAgIHRleHQ6IHRleHQsXG4gICAgICBocmVmOiBcImh0dHBzOi8vZ2l0aHViLmNvbS9icmlhbnBldHJvL29ic2lkaWFuLXNtYXJ0LWNvbm5lY3Rpb25zL2Rpc2N1c3Npb25zXCIsXG4gICAgICB0YXJnZXQ6IFwiX2JsYW5rXCIsXG4gICAgICBhdHRyOiBhdHRyXG4gICAgfSk7XG4gIH1cblxuXG4gIC8vIGNyZWF0ZSBsaXN0IG9mIG5lYXJlc3Qgbm90ZXNcbiAgYXN5bmMgdXBkYXRlX3Jlc3VsdHMoY29udGFpbmVyLCBuZWFyZXN0KSB7XG4gICAgbGV0IGxpc3Q7XG4gICAgLy8gY2hlY2sgaWYgbGlzdCBleGlzdHNcbiAgICBpZigoY29udGFpbmVyLmNoaWxkcmVuLmxlbmd0aCA+IDEpICYmIChjb250YWluZXIuY2hpbGRyZW5bMV0uY2xhc3NMaXN0LmNvbnRhaW5zKFwic2MtbGlzdFwiKSkpe1xuICAgICAgbGlzdCA9IGNvbnRhaW5lci5jaGlsZHJlblsxXTtcbiAgICB9XG4gICAgLy8gaWYgbGlzdCBleGlzdHMsIGVtcHR5IGl0XG4gICAgaWYgKGxpc3QpIHtcbiAgICAgIGxpc3QuZW1wdHkoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gY3JlYXRlIGxpc3QgZWxlbWVudFxuICAgICAgbGlzdCA9IGNvbnRhaW5lci5jcmVhdGVFbChcImRpdlwiLCB7IGNsczogXCJzYy1saXN0XCIgfSk7XG4gICAgfVxuICAgIGxldCBzZWFyY2hfcmVzdWx0X2NsYXNzID0gXCJzZWFyY2gtcmVzdWx0XCI7XG4gICAgLy8gaWYgc2V0dGluZ3MgZXhwYW5kZWRfdmlldyBpcyBmYWxzZSwgYWRkIHNjLWNvbGxhcHNlZCBjbGFzc1xuICAgIGlmKCF0aGlzLnNldHRpbmdzLmV4cGFuZGVkX3ZpZXcpIHNlYXJjaF9yZXN1bHRfY2xhc3MgKz0gXCIgc2MtY29sbGFwc2VkXCI7XG5cbiAgICAvLyBUT0RPOiBhZGQgb3B0aW9uIHRvIGdyb3VwIG5lYXJlc3QgYnkgZmlsZVxuICAgIGlmKCF0aGlzLnNldHRpbmdzLmdyb3VwX25lYXJlc3RfYnlfZmlsZSkge1xuICAgICAgLy8gZm9yIGVhY2ggbmVhcmVzdCBub3RlXG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG5lYXJlc3QubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgLyoqXG4gICAgICAgICAqIEJFR0lOIEVYVEVSTkFMIExJTksgTE9HSUNcbiAgICAgICAgICogaWYgbGluayBpcyBhbiBvYmplY3QsIGl0IGluZGljYXRlcyBleHRlcm5hbCBsaW5rXG4gICAgICAgICAqL1xuICAgICAgICBpZiAodHlwZW9mIG5lYXJlc3RbaV0ubGluayA9PT0gXCJvYmplY3RcIikge1xuICAgICAgICAgIGNvbnN0IGl0ZW0gPSBsaXN0LmNyZWF0ZUVsKFwiZGl2XCIsIHsgY2xzOiBcInNlYXJjaC1yZXN1bHRcIiB9KTtcbiAgICAgICAgICBjb25zdCBsaW5rID0gaXRlbS5jcmVhdGVFbChcImFcIiwge1xuICAgICAgICAgICAgY2xzOiBcInNlYXJjaC1yZXN1bHQtZmlsZS10aXRsZSBpcy1jbGlja2FibGVcIixcbiAgICAgICAgICAgIGhyZWY6IG5lYXJlc3RbaV0ubGluay5wYXRoLFxuICAgICAgICAgICAgdGl0bGU6IG5lYXJlc3RbaV0ubGluay50aXRsZSxcbiAgICAgICAgICB9KTtcbiAgICAgICAgICBsaW5rLmlubmVySFRNTCA9IHRoaXMucmVuZGVyX2V4dGVybmFsX2xpbmtfZWxtKG5lYXJlc3RbaV0ubGluayk7XG4gICAgICAgICAgaXRlbS5zZXRBdHRyKCdkcmFnZ2FibGUnLCAndHJ1ZScpXG4gICAgICAgICAgY29udGludWU7IC8vIGVuZHMgaGVyZSBmb3IgZXh0ZXJuYWwgbGlua3NcbiAgICAgICAgfVxuICAgICAgICAvKipcbiAgICAgICAgICogQkVHSU4gSU5URVJOQUwgTElOSyBMT0dJQ1xuICAgICAgICAgKiBpZiBsaW5rIGlzIGEgc3RyaW5nLCBpdCBpbmRpY2F0ZXMgaW50ZXJuYWwgbGlua1xuICAgICAgICAgKi9cbiAgICAgICAgbGV0IGZpbGVfbGlua190ZXh0O1xuICAgICAgICBjb25zdCBmaWxlX3NpbWlsYXJpdHlfcGN0ID0gTWF0aC5yb3VuZChuZWFyZXN0W2ldLnNpbWlsYXJpdHkgKiAxMDApICsgXCIlXCI7XG4gICAgICAgIGlmKHRoaXMuc2V0dGluZ3Muc2hvd19mdWxsX3BhdGgpIHtcbiAgICAgICAgICBjb25zdCBwY3MgPSBuZWFyZXN0W2ldLmxpbmsuc3BsaXQoXCIvXCIpO1xuICAgICAgICAgIGZpbGVfbGlua190ZXh0ID0gcGNzW3Bjcy5sZW5ndGggLSAxXTtcbiAgICAgICAgICBjb25zdCBwYXRoID0gcGNzLnNsaWNlKDAsIHBjcy5sZW5ndGggLSAxKS5qb2luKFwiL1wiKTtcbiAgICAgICAgICAvLyBmaWxlX2xpbmtfdGV4dCA9IGA8c21hbGw+JHtwYXRofSB8ICR7ZmlsZV9zaW1pbGFyaXR5X3BjdH08L3NtYWxsPjxicj4ke2ZpbGVfbGlua190ZXh0fWA7XG4gICAgICAgICAgZmlsZV9saW5rX3RleHQgPSBgPHNtYWxsPiR7ZmlsZV9zaW1pbGFyaXR5X3BjdH0gfCAke3BhdGh9IHwgJHtmaWxlX2xpbmtfdGV4dH08L3NtYWxsPmA7XG4gICAgICAgIH1lbHNle1xuICAgICAgICAgIGZpbGVfbGlua190ZXh0ID0gJzxzbWFsbD4nICsgZmlsZV9zaW1pbGFyaXR5X3BjdCArIFwiIHwgXCIgKyBuZWFyZXN0W2ldLmxpbmsuc3BsaXQoXCIvXCIpLnBvcCgpICsgJzwvc21hbGw+JztcbiAgICAgICAgfVxuICAgICAgICAvLyBza2lwIGNvbnRlbnRzIHJlbmRlcmluZyBpZiBpbmNvbXBhdGlibGUgZmlsZSB0eXBlXG4gICAgICAgIC8vIGV4LiBub3QgbWFya2Rvd24gZmlsZSBvciBjb250YWlucyBubyAnLmV4Y2FsaWRyYXcnXG4gICAgICAgIGlmKCF0aGlzLnJlbmRlcmFibGVfZmlsZV90eXBlKG5lYXJlc3RbaV0ubGluaykpe1xuICAgICAgICAgIGNvbnN0IGl0ZW0gPSBsaXN0LmNyZWF0ZUVsKFwiZGl2XCIsIHsgY2xzOiBcInNlYXJjaC1yZXN1bHRcIiB9KTtcbiAgICAgICAgICBjb25zdCBsaW5rID0gaXRlbS5jcmVhdGVFbChcImFcIiwge1xuICAgICAgICAgICAgY2xzOiBcInNlYXJjaC1yZXN1bHQtZmlsZS10aXRsZSBpcy1jbGlja2FibGVcIixcbiAgICAgICAgICAgIGhyZWY6IG5lYXJlc3RbaV0ubGluayxcbiAgICAgICAgICB9KTtcbiAgICAgICAgICBsaW5rLmlubmVySFRNTCA9IGZpbGVfbGlua190ZXh0O1xuICAgICAgICAgIC8vIGRyYWcgYW5kIGRyb3BcbiAgICAgICAgICBpdGVtLnNldEF0dHIoJ2RyYWdnYWJsZScsICd0cnVlJylcbiAgICAgICAgICAvLyBhZGQgbGlzdGVuZXJzIHRvIGxpbmtcbiAgICAgICAgICB0aGlzLmFkZF9saW5rX2xpc3RlbmVycyhsaW5rLCBuZWFyZXN0W2ldLCBpdGVtKTtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHJlbW92ZSBmaWxlIGV4dGVuc2lvbiBpZiAubWQgYW5kIG1ha2UgIyBpbnRvID5cbiAgICAgICAgZmlsZV9saW5rX3RleHQgPSBmaWxlX2xpbmtfdGV4dC5yZXBsYWNlKFwiLm1kXCIsIFwiXCIpLnJlcGxhY2UoLyMvZywgXCIgPiBcIik7XG4gICAgICAgIC8vIGNyZWF0ZSBpdGVtXG4gICAgICAgIGNvbnN0IGl0ZW0gPSBsaXN0LmNyZWF0ZUVsKFwiZGl2XCIsIHsgY2xzOiBzZWFyY2hfcmVzdWx0X2NsYXNzIH0pO1xuICAgICAgICAvLyBjcmVhdGUgc3BhbiBmb3IgdG9nZ2xlXG4gICAgICAgIGNvbnN0IHRvZ2dsZSA9IGl0ZW0uY3JlYXRlRWwoXCJzcGFuXCIsIHsgY2xzOiBcImlzLWNsaWNrYWJsZVwiIH0pO1xuICAgICAgICAvLyBpbnNlcnQgcmlnaHQgdHJpYW5nbGUgc3ZnIGFzIHRvZ2dsZVxuICAgICAgICBPYnNpZGlhbi5zZXRJY29uKHRvZ2dsZSwgXCJyaWdodC10cmlhbmdsZVwiKTsgLy8gbXVzdCBjb21lIGJlZm9yZSBhZGRpbmcgb3RoZXIgZWxtcyB0byBwcmV2ZW50IG92ZXJ3cml0ZVxuICAgICAgICBjb25zdCBsaW5rID0gdG9nZ2xlLmNyZWF0ZUVsKFwiYVwiLCB7XG4gICAgICAgICAgY2xzOiBcInNlYXJjaC1yZXN1bHQtZmlsZS10aXRsZVwiLFxuICAgICAgICAgIHRpdGxlOiBuZWFyZXN0W2ldLmxpbmssXG4gICAgICAgIH0pO1xuICAgICAgICBsaW5rLmlubmVySFRNTCA9IGZpbGVfbGlua190ZXh0O1xuICAgICAgICAvLyBhZGQgbGlzdGVuZXJzIHRvIGxpbmtcbiAgICAgICAgdGhpcy5hZGRfbGlua19saXN0ZW5lcnMobGluaywgbmVhcmVzdFtpXSwgaXRlbSk7XG4gICAgICAgIHRvZ2dsZS5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKGV2ZW50KSA9PiB7XG4gICAgICAgICAgLy8gZmluZCBwYXJlbnQgY29udGFpbmluZyBzZWFyY2gtcmVzdWx0IGNsYXNzXG4gICAgICAgICAgbGV0IHBhcmVudCA9IGV2ZW50LnRhcmdldC5wYXJlbnRFbGVtZW50O1xuICAgICAgICAgIHdoaWxlICghcGFyZW50LmNsYXNzTGlzdC5jb250YWlucyhcInNlYXJjaC1yZXN1bHRcIikpIHtcbiAgICAgICAgICAgIHBhcmVudCA9IHBhcmVudC5wYXJlbnRFbGVtZW50O1xuICAgICAgICAgIH1cbiAgICAgICAgICAvLyB0b2dnbGUgc2MtY29sbGFwc2VkIGNsYXNzXG4gICAgICAgICAgcGFyZW50LmNsYXNzTGlzdC50b2dnbGUoXCJzYy1jb2xsYXBzZWRcIik7XG4gICAgICAgIH0pO1xuICAgICAgICBjb25zdCBjb250ZW50cyA9IGl0ZW0uY3JlYXRlRWwoXCJ1bFwiLCB7IGNsczogXCJcIiB9KTtcbiAgICAgICAgY29uc3QgY29udGVudHNfY29udGFpbmVyID0gY29udGVudHMuY3JlYXRlRWwoXCJsaVwiLCB7XG4gICAgICAgICAgY2xzOiBcInNlYXJjaC1yZXN1bHQtZmlsZS10aXRsZSBpcy1jbGlja2FibGVcIixcbiAgICAgICAgICB0aXRsZTogbmVhcmVzdFtpXS5saW5rLFxuICAgICAgICB9KTtcbiAgICAgICAgaWYobmVhcmVzdFtpXS5saW5rLmluZGV4T2YoXCIjXCIpID4gLTEpeyAvLyBpcyBibG9ja1xuICAgICAgICAgIE9ic2lkaWFuLk1hcmtkb3duUmVuZGVyZXIucmVuZGVyTWFya2Rvd24oKGF3YWl0IHRoaXMuYmxvY2tfcmV0cmlldmVyKG5lYXJlc3RbaV0ubGluaywge2xpbmVzOiAxMCwgbWF4X2NoYXJzOiAxMDAwfSkpLCBjb250ZW50c19jb250YWluZXIsIG5lYXJlc3RbaV0ubGluaywgbmV3IE9ic2lkaWFuLkNvbXBvbmVudCgpKTtcbiAgICAgICAgfWVsc2V7IC8vIGlzIGZpbGVcbiAgICAgICAgICBjb25zdCBmaXJzdF90ZW5fbGluZXMgPSBhd2FpdCB0aGlzLmZpbGVfcmV0cmlldmVyKG5lYXJlc3RbaV0ubGluaywge2xpbmVzOiAxMCwgbWF4X2NoYXJzOiAxMDAwfSk7XG4gICAgICAgICAgaWYoIWZpcnN0X3Rlbl9saW5lcykgY29udGludWU7IC8vIHNraXAgaWYgZmlsZSBpcyBlbXB0eVxuICAgICAgICAgIE9ic2lkaWFuLk1hcmtkb3duUmVuZGVyZXIucmVuZGVyTWFya2Rvd24oZmlyc3RfdGVuX2xpbmVzLCBjb250ZW50c19jb250YWluZXIsIG5lYXJlc3RbaV0ubGluaywgbmV3IE9ic2lkaWFuLkNvbXBvbmVudCgpKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmFkZF9saW5rX2xpc3RlbmVycyhjb250ZW50cywgbmVhcmVzdFtpXSwgaXRlbSk7XG4gICAgICB9XG4gICAgICB0aGlzLnJlbmRlcl9icmFuZChjb250YWluZXIsIFwiYmxvY2tcIik7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gZ3JvdXAgbmVhcmVzdCBieSBmaWxlXG4gICAgY29uc3QgbmVhcmVzdF9ieV9maWxlID0ge307XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBuZWFyZXN0Lmxlbmd0aDsgaSsrKSB7XG4gICAgICBjb25zdCBjdXJyID0gbmVhcmVzdFtpXTtcbiAgICAgIGNvbnN0IGxpbmsgPSBjdXJyLmxpbms7XG4gICAgICAvLyBza2lwIGlmIGxpbmsgaXMgYW4gb2JqZWN0IChpbmRpY2F0ZXMgZXh0ZXJuYWwgbG9naWMpXG4gICAgICBpZiAodHlwZW9mIGxpbmsgPT09IFwib2JqZWN0XCIpIHtcbiAgICAgICAgbmVhcmVzdF9ieV9maWxlW2xpbmsucGF0aF0gPSBbY3Vycl07XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgICAgaWYgKGxpbmsuaW5kZXhPZihcIiNcIikgPiAtMSkge1xuICAgICAgICBjb25zdCBmaWxlX3BhdGggPSBsaW5rLnNwbGl0KFwiI1wiKVswXTtcbiAgICAgICAgaWYgKCFuZWFyZXN0X2J5X2ZpbGVbZmlsZV9wYXRoXSkge1xuICAgICAgICAgIG5lYXJlc3RfYnlfZmlsZVtmaWxlX3BhdGhdID0gW107XG4gICAgICAgIH1cbiAgICAgICAgbmVhcmVzdF9ieV9maWxlW2ZpbGVfcGF0aF0ucHVzaChuZWFyZXN0W2ldKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGlmICghbmVhcmVzdF9ieV9maWxlW2xpbmtdKSB7XG4gICAgICAgICAgbmVhcmVzdF9ieV9maWxlW2xpbmtdID0gW107XG4gICAgICAgIH1cbiAgICAgICAgLy8gYWx3YXlzIGFkZCB0byBmcm9udCBvZiBhcnJheVxuICAgICAgICBuZWFyZXN0X2J5X2ZpbGVbbGlua10udW5zaGlmdChuZWFyZXN0W2ldKTtcbiAgICAgIH1cbiAgICB9XG4gICAgLy8gZm9yIGVhY2ggZmlsZVxuICAgIGNvbnN0IGtleXMgPSBPYmplY3Qua2V5cyhuZWFyZXN0X2J5X2ZpbGUpO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwga2V5cy5sZW5ndGg7IGkrKykge1xuICAgICAgY29uc3QgZmlsZSA9IG5lYXJlc3RfYnlfZmlsZVtrZXlzW2ldXTtcbiAgICAgIC8qKlxuICAgICAgICogQmVnaW4gZXh0ZXJuYWwgbGluayBoYW5kbGluZ1xuICAgICAgICovXG4gICAgICAvLyBpZiBsaW5rIGlzIGFuIG9iamVjdCAoaW5kaWNhdGVzIHYyIGxvZ2ljKVxuICAgICAgaWYgKHR5cGVvZiBmaWxlWzBdLmxpbmsgPT09IFwib2JqZWN0XCIpIHtcbiAgICAgICAgY29uc3QgY3VyciA9IGZpbGVbMF07XG4gICAgICAgIGNvbnN0IG1ldGEgPSBjdXJyLmxpbms7XG4gICAgICAgIGlmIChtZXRhLnBhdGguc3RhcnRzV2l0aChcImh0dHBcIikpIHtcbiAgICAgICAgICBjb25zdCBpdGVtID0gbGlzdC5jcmVhdGVFbChcImRpdlwiLCB7IGNsczogXCJzZWFyY2gtcmVzdWx0XCIgfSk7XG4gICAgICAgICAgY29uc3QgbGluayA9IGl0ZW0uY3JlYXRlRWwoXCJhXCIsIHtcbiAgICAgICAgICAgIGNsczogXCJzZWFyY2gtcmVzdWx0LWZpbGUtdGl0bGUgaXMtY2xpY2thYmxlXCIsXG4gICAgICAgICAgICBocmVmOiBtZXRhLnBhdGgsXG4gICAgICAgICAgICB0aXRsZTogbWV0YS50aXRsZSxcbiAgICAgICAgICB9KTtcbiAgICAgICAgICBsaW5rLmlubmVySFRNTCA9IHRoaXMucmVuZGVyX2V4dGVybmFsX2xpbmtfZWxtKG1ldGEpO1xuICAgICAgICAgIGl0ZW0uc2V0QXR0cignZHJhZ2dhYmxlJywgJ3RydWUnKTtcbiAgICAgICAgICBjb250aW51ZTsgLy8gZW5kcyBoZXJlIGZvciBleHRlcm5hbCBsaW5rc1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICAvKipcbiAgICAgICAqIEhhbmRsZXMgSW50ZXJuYWxcbiAgICAgICAqL1xuICAgICAgbGV0IGZpbGVfbGlua190ZXh0O1xuICAgICAgY29uc3QgZmlsZV9zaW1pbGFyaXR5X3BjdCA9IE1hdGgucm91bmQoZmlsZVswXS5zaW1pbGFyaXR5ICogMTAwKSArIFwiJVwiO1xuICAgICAgaWYgKHRoaXMuc2V0dGluZ3Muc2hvd19mdWxsX3BhdGgpIHtcbiAgICAgICAgY29uc3QgcGNzID0gZmlsZVswXS5saW5rLnNwbGl0KFwiL1wiKTtcbiAgICAgICAgZmlsZV9saW5rX3RleHQgPSBwY3NbcGNzLmxlbmd0aCAtIDFdO1xuICAgICAgICBjb25zdCBwYXRoID0gcGNzLnNsaWNlKDAsIHBjcy5sZW5ndGggLSAxKS5qb2luKFwiL1wiKTtcbiAgICAgICAgZmlsZV9saW5rX3RleHQgPSBgPHNtYWxsPiR7cGF0aH0gfCAke2ZpbGVfc2ltaWxhcml0eV9wY3R9PC9zbWFsbD48YnI+JHtmaWxlX2xpbmtfdGV4dH1gO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZmlsZV9saW5rX3RleHQgPSBmaWxlWzBdLmxpbmsuc3BsaXQoXCIvXCIpLnBvcCgpO1xuICAgICAgICAvLyBhZGQgc2ltaWxhcml0eSBwZXJjZW50YWdlXG4gICAgICAgIGZpbGVfbGlua190ZXh0ICs9ICcgfCAnICsgZmlsZV9zaW1pbGFyaXR5X3BjdDtcbiAgICAgIH1cblxuXG4gICAgICAgIFxuICAgICAgLy8gc2tpcCBjb250ZW50cyByZW5kZXJpbmcgaWYgaW5jb21wYXRpYmxlIGZpbGUgdHlwZVxuICAgICAgLy8gZXguIG5vdCBtYXJrZG93biBvciBjb250YWlucyAnLmV4Y2FsaWRyYXcnXG4gICAgICBpZighdGhpcy5yZW5kZXJhYmxlX2ZpbGVfdHlwZShmaWxlWzBdLmxpbmspKSB7XG4gICAgICAgIGNvbnN0IGl0ZW0gPSBsaXN0LmNyZWF0ZUVsKFwiZGl2XCIsIHsgY2xzOiBcInNlYXJjaC1yZXN1bHRcIiB9KTtcbiAgICAgICAgY29uc3QgZmlsZV9saW5rID0gaXRlbS5jcmVhdGVFbChcImFcIiwge1xuICAgICAgICAgIGNsczogXCJzZWFyY2gtcmVzdWx0LWZpbGUtdGl0bGUgaXMtY2xpY2thYmxlXCIsXG4gICAgICAgICAgdGl0bGU6IGZpbGVbMF0ubGluayxcbiAgICAgICAgfSk7XG4gICAgICAgIGZpbGVfbGluay5pbm5lckhUTUwgPSBmaWxlX2xpbmtfdGV4dDtcbiAgICAgICAgLy8gYWRkIGxpbmsgbGlzdGVuZXJzIHRvIGZpbGUgbGlua1xuICAgICAgICB0aGlzLmFkZF9saW5rX2xpc3RlbmVycyhmaWxlX2xpbmssIGZpbGVbMF0sIGl0ZW0pO1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuXG4gICAgICAvLyByZW1vdmUgZmlsZSBleHRlbnNpb24gaWYgLm1kXG4gICAgICBmaWxlX2xpbmtfdGV4dCA9IGZpbGVfbGlua190ZXh0LnJlcGxhY2UoXCIubWRcIiwgXCJcIikucmVwbGFjZSgvIy9nLCBcIiA+IFwiKTtcbiAgICAgIGNvbnN0IGl0ZW0gPSBsaXN0LmNyZWF0ZUVsKFwiZGl2XCIsIHsgY2xzOiBzZWFyY2hfcmVzdWx0X2NsYXNzIH0pO1xuICAgICAgY29uc3QgdG9nZ2xlID0gaXRlbS5jcmVhdGVFbChcInNwYW5cIiwgeyBjbHM6IFwiaXMtY2xpY2thYmxlXCIgfSk7XG4gICAgICAvLyBpbnNlcnQgcmlnaHQgdHJpYW5nbGUgc3ZnIGljb24gYXMgdG9nZ2xlIGJ1dHRvbiBpbiBzcGFuXG4gICAgICBPYnNpZGlhbi5zZXRJY29uKHRvZ2dsZSwgXCJyaWdodC10cmlhbmdsZVwiKTsgLy8gbXVzdCBjb21lIGJlZm9yZSBhZGRpbmcgb3RoZXIgZWxtcyBlbHNlIG92ZXJ3cml0ZXNcbiAgICAgIGNvbnN0IGZpbGVfbGluayA9IHRvZ2dsZS5jcmVhdGVFbChcImFcIiwge1xuICAgICAgICBjbHM6IFwic2VhcmNoLXJlc3VsdC1maWxlLXRpdGxlXCIsXG4gICAgICAgIHRpdGxlOiBmaWxlWzBdLmxpbmssXG4gICAgICB9KTtcbiAgICAgIGZpbGVfbGluay5pbm5lckhUTUwgPSBmaWxlX2xpbmtfdGV4dDtcbiAgICAgIC8vIGFkZCBsaW5rIGxpc3RlbmVycyB0byBmaWxlIGxpbmtcbiAgICAgIHRoaXMuYWRkX2xpbmtfbGlzdGVuZXJzKGZpbGVfbGluaywgZmlsZVswXSwgdG9nZ2xlKTtcbiAgICAgIHRvZ2dsZS5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKGV2ZW50KSA9PiB7XG4gICAgICAgIC8vIGZpbmQgcGFyZW50IGNvbnRhaW5pbmcgY2xhc3Mgc2VhcmNoLXJlc3VsdFxuICAgICAgICBsZXQgcGFyZW50ID0gZXZlbnQudGFyZ2V0O1xuICAgICAgICB3aGlsZSAoIXBhcmVudC5jbGFzc0xpc3QuY29udGFpbnMoXCJzZWFyY2gtcmVzdWx0XCIpKSB7XG4gICAgICAgICAgcGFyZW50ID0gcGFyZW50LnBhcmVudEVsZW1lbnQ7XG4gICAgICAgIH1cbiAgICAgICAgcGFyZW50LmNsYXNzTGlzdC50b2dnbGUoXCJzYy1jb2xsYXBzZWRcIik7XG4gICAgICAgIC8vIFRPRE86IGlmIGJsb2NrIGNvbnRhaW5lciBpcyBlbXB0eSwgcmVuZGVyIG1hcmtkb3duIGZyb20gYmxvY2sgcmV0cmlldmVyXG4gICAgICB9KTtcbiAgICAgIGNvbnN0IGZpbGVfbGlua19saXN0ID0gaXRlbS5jcmVhdGVFbChcInVsXCIpO1xuICAgICAgLy8gZm9yIGVhY2ggbGluayBpbiBmaWxlXG4gICAgICBmb3IgKGxldCBqID0gMDsgaiA8IGZpbGUubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgLy8gaWYgaXMgYSBibG9jayAoaGFzICMgaW4gbGluaylcbiAgICAgICAgaWYoZmlsZVtqXS5saW5rLmluZGV4T2YoXCIjXCIpID4gLTEpIHtcbiAgICAgICAgICBjb25zdCBibG9jayA9IGZpbGVbal07XG4gICAgICAgICAgY29uc3QgYmxvY2tfbGluayA9IGZpbGVfbGlua19saXN0LmNyZWF0ZUVsKFwibGlcIiwge1xuICAgICAgICAgICAgY2xzOiBcInNlYXJjaC1yZXN1bHQtZmlsZS10aXRsZSBpcy1jbGlja2FibGVcIixcbiAgICAgICAgICAgIHRpdGxlOiBibG9jay5saW5rLFxuICAgICAgICAgIH0pO1xuICAgICAgICAgIC8vIHNraXAgYmxvY2sgY29udGV4dCBpZiBmaWxlLmxlbmd0aCA9PT0gMSBiZWNhdXNlIGFscmVhZHkgYWRkZWRcbiAgICAgICAgICBpZihmaWxlLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgICAgIGNvbnN0IGJsb2NrX2NvbnRleHQgPSB0aGlzLnJlbmRlcl9ibG9ja19jb250ZXh0KGJsb2NrKTtcbiAgICAgICAgICAgIGNvbnN0IGJsb2NrX3NpbWlsYXJpdHlfcGN0ID0gTWF0aC5yb3VuZChibG9jay5zaW1pbGFyaXR5ICogMTAwKSArIFwiJVwiO1xuICAgICAgICAgICAgYmxvY2tfbGluay5pbm5lckhUTUwgPSBgPHNtYWxsPiR7YmxvY2tfY29udGV4dH0gfCAke2Jsb2NrX3NpbWlsYXJpdHlfcGN0fTwvc21hbGw+YDtcbiAgICAgICAgICB9XG4gICAgICAgICAgY29uc3QgYmxvY2tfY29udGFpbmVyID0gYmxvY2tfbGluay5jcmVhdGVFbChcImRpdlwiKTtcbiAgICAgICAgICAvLyBUT0RPOiBtb3ZlIHRvIHJlbmRlcmluZyBvbiBleHBhbmRpbmcgc2VjdGlvbiAodG9nZ2xlIGNvbGxhcHNlZClcbiAgICAgICAgICBPYnNpZGlhbi5NYXJrZG93blJlbmRlcmVyLnJlbmRlck1hcmtkb3duKChhd2FpdCB0aGlzLmJsb2NrX3JldHJpZXZlcihibG9jay5saW5rLCB7bGluZXM6IDEwLCBtYXhfY2hhcnM6IDEwMDB9KSksIGJsb2NrX2NvbnRhaW5lciwgYmxvY2subGluaywgbmV3IE9ic2lkaWFuLkNvbXBvbmVudCgpKTtcbiAgICAgICAgICAvLyBhZGQgbGluayBsaXN0ZW5lcnMgdG8gYmxvY2sgbGlua1xuICAgICAgICAgIHRoaXMuYWRkX2xpbmtfbGlzdGVuZXJzKGJsb2NrX2xpbmssIGJsb2NrLCBmaWxlX2xpbmtfbGlzdCk7XG4gICAgICAgIH1lbHNle1xuICAgICAgICAgIC8vIGdldCBmaXJzdCB0ZW4gbGluZXMgb2YgZmlsZVxuICAgICAgICAgIGNvbnN0IGZpbGVfbGlua19saXN0ID0gaXRlbS5jcmVhdGVFbChcInVsXCIpO1xuICAgICAgICAgIGNvbnN0IGJsb2NrX2xpbmsgPSBmaWxlX2xpbmtfbGlzdC5jcmVhdGVFbChcImxpXCIsIHtcbiAgICAgICAgICAgIGNsczogXCJzZWFyY2gtcmVzdWx0LWZpbGUtdGl0bGUgaXMtY2xpY2thYmxlXCIsXG4gICAgICAgICAgICB0aXRsZTogZmlsZVswXS5saW5rLFxuICAgICAgICAgIH0pO1xuICAgICAgICAgIGNvbnN0IGJsb2NrX2NvbnRhaW5lciA9IGJsb2NrX2xpbmsuY3JlYXRlRWwoXCJkaXZcIik7XG4gICAgICAgICAgbGV0IGZpcnN0X3Rlbl9saW5lcyA9IGF3YWl0IHRoaXMuZmlsZV9yZXRyaWV2ZXIoZmlsZVswXS5saW5rLCB7bGluZXM6IDEwLCBtYXhfY2hhcnM6IDEwMDB9KTtcbiAgICAgICAgICBpZighZmlyc3RfdGVuX2xpbmVzKSBjb250aW51ZTsgLy8gaWYgZmlsZSBub3QgZm91bmQsIHNraXBcbiAgICAgICAgICBPYnNpZGlhbi5NYXJrZG93blJlbmRlcmVyLnJlbmRlck1hcmtkb3duKGZpcnN0X3Rlbl9saW5lcywgYmxvY2tfY29udGFpbmVyLCBmaWxlWzBdLmxpbmssIG5ldyBPYnNpZGlhbi5Db21wb25lbnQoKSk7XG4gICAgICAgICAgdGhpcy5hZGRfbGlua19saXN0ZW5lcnMoYmxvY2tfbGluaywgZmlsZVswXSwgZmlsZV9saW5rX2xpc3QpO1xuXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy5yZW5kZXJfYnJhbmQoY29udGFpbmVyLCBcImZpbGVcIik7XG4gIH1cblxuICBhZGRfbGlua19saXN0ZW5lcnMoaXRlbSwgY3VyciwgbGlzdCkge1xuICAgIGl0ZW0uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIGFzeW5jIChldmVudCkgPT4ge1xuICAgICAgYXdhaXQgdGhpcy5vcGVuX25vdGUoY3VyciwgZXZlbnQpO1xuICAgIH0pO1xuICAgIC8vIGRyYWctb25cbiAgICAvLyBjdXJyZW50bHkgb25seSB3b3JrcyB3aXRoIGZ1bGwtZmlsZSBsaW5rc1xuICAgIGl0ZW0uc2V0QXR0cignZHJhZ2dhYmxlJywgJ3RydWUnKTtcbiAgICBpdGVtLmFkZEV2ZW50TGlzdGVuZXIoJ2RyYWdzdGFydCcsIChldmVudCkgPT4ge1xuICAgICAgY29uc3QgZHJhZ01hbmFnZXIgPSB0aGlzLmFwcC5kcmFnTWFuYWdlcjtcbiAgICAgIGNvbnN0IGZpbGVfcGF0aCA9IGN1cnIubGluay5zcGxpdChcIiNcIilbMF07XG4gICAgICBjb25zdCBmaWxlID0gdGhpcy5hcHAubWV0YWRhdGFDYWNoZS5nZXRGaXJzdExpbmtwYXRoRGVzdChmaWxlX3BhdGgsICcnKTtcbiAgICAgIGNvbnN0IGRyYWdEYXRhID0gZHJhZ01hbmFnZXIuZHJhZ0ZpbGUoZXZlbnQsIGZpbGUpO1xuICAgICAgLy8gY29uc29sZS5sb2coZHJhZ0RhdGEpO1xuICAgICAgZHJhZ01hbmFnZXIub25EcmFnU3RhcnQoZXZlbnQsIGRyYWdEYXRhKTtcbiAgICB9KTtcbiAgICAvLyBpZiBjdXJyLmxpbmsgY29udGFpbnMgY3VybHkgYnJhY2VzLCByZXR1cm4gKGluY29tcGF0aWJsZSB3aXRoIGhvdmVyLWxpbmspXG4gICAgaWYgKGN1cnIubGluay5pbmRleE9mKFwie1wiKSA+IC0xKSByZXR1cm47XG4gICAgLy8gdHJpZ2dlciBob3ZlciBldmVudCBvbiBsaW5rXG4gICAgaXRlbS5hZGRFdmVudExpc3RlbmVyKFwibW91c2VvdmVyXCIsIChldmVudCkgPT4ge1xuICAgICAgdGhpcy5hcHAud29ya3NwYWNlLnRyaWdnZXIoXCJob3Zlci1saW5rXCIsIHtcbiAgICAgICAgZXZlbnQsXG4gICAgICAgIHNvdXJjZTogU01BUlRfQ09OTkVDVElPTlNfVklFV19UWVBFLFxuICAgICAgICBob3ZlclBhcmVudDogbGlzdCxcbiAgICAgICAgdGFyZ2V0RWw6IGl0ZW0sXG4gICAgICAgIGxpbmt0ZXh0OiBjdXJyLmxpbmssXG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIC8vIGdldCB0YXJnZXQgZmlsZSBmcm9tIGxpbmsgcGF0aFxuICAvLyBpZiBzdWItc2VjdGlvbiBpcyBsaW5rZWQsIG9wZW4gZmlsZSBhbmQgc2Nyb2xsIHRvIHN1Yi1zZWN0aW9uXG4gIGFzeW5jIG9wZW5fbm90ZShjdXJyLCBldmVudD1udWxsKSB7XG4gICAgbGV0IHRhcmdldEZpbGU7XG4gICAgbGV0IGhlYWRpbmc7XG4gICAgaWYgKGN1cnIubGluay5pbmRleE9mKFwiI1wiKSA+IC0xKSB7XG4gICAgICAvLyByZW1vdmUgYWZ0ZXIgIyBmcm9tIGxpbmtcbiAgICAgIHRhcmdldEZpbGUgPSB0aGlzLmFwcC5tZXRhZGF0YUNhY2hlLmdldEZpcnN0TGlua3BhdGhEZXN0KGN1cnIubGluay5zcGxpdChcIiNcIilbMF0sIFwiXCIpO1xuICAgICAgLy8gY29uc29sZS5sb2codGFyZ2V0RmlsZSk7XG4gICAgICBjb25zdCB0YXJnZXRfZmlsZV9jYWNoZSA9IHRoaXMuYXBwLm1ldGFkYXRhQ2FjaGUuZ2V0RmlsZUNhY2hlKHRhcmdldEZpbGUpO1xuICAgICAgLy8gY29uc29sZS5sb2codGFyZ2V0X2ZpbGVfY2FjaGUpO1xuICAgICAgLy8gZ2V0IGhlYWRpbmdcbiAgICAgIGxldCBoZWFkaW5nX3RleHQgPSBjdXJyLmxpbmsuc3BsaXQoXCIjXCIpLnBvcCgpO1xuICAgICAgLy8gaWYgaGVhZGluZyB0ZXh0IGNvbnRhaW5zIGEgY3VybHkgYnJhY2UsIGdldCB0aGUgbnVtYmVyIGluc2lkZSB0aGUgY3VybHkgYnJhY2VzIGFzIG9jY3VyZW5jZVxuICAgICAgbGV0IG9jY3VyZW5jZSA9IDA7XG4gICAgICBpZiAoaGVhZGluZ190ZXh0LmluZGV4T2YoXCJ7XCIpID4gLTEpIHtcbiAgICAgICAgLy8gZ2V0IG9jY3VyZW5jZVxuICAgICAgICBvY2N1cmVuY2UgPSBwYXJzZUludChoZWFkaW5nX3RleHQuc3BsaXQoXCJ7XCIpWzFdLnNwbGl0KFwifVwiKVswXSk7XG4gICAgICAgIC8vIHJlbW92ZSBvY2N1cmVuY2UgZnJvbSBoZWFkaW5nIHRleHRcbiAgICAgICAgaGVhZGluZ190ZXh0ID0gaGVhZGluZ190ZXh0LnNwbGl0KFwie1wiKVswXTtcbiAgICAgIH1cbiAgICAgIC8vIGdldCBoZWFkaW5ncyBmcm9tIGZpbGUgY2FjaGVcbiAgICAgIGNvbnN0IGhlYWRpbmdzID0gdGFyZ2V0X2ZpbGVfY2FjaGUuaGVhZGluZ3M7XG4gICAgICAvLyBnZXQgaGVhZGluZ3Mgd2l0aCB0aGUgc2FtZSBkZXB0aCBhbmQgdGV4dCBhcyB0aGUgbGlua1xuICAgICAgZm9yKGxldCBpID0gMDsgaSA8IGhlYWRpbmdzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGlmIChoZWFkaW5nc1tpXS5oZWFkaW5nID09PSBoZWFkaW5nX3RleHQpIHtcbiAgICAgICAgICAvLyBpZiBvY2N1cmVuY2UgaXMgMCwgc2V0IGhlYWRpbmcgYW5kIGJyZWFrXG4gICAgICAgICAgaWYob2NjdXJlbmNlID09PSAwKSB7XG4gICAgICAgICAgICBoZWFkaW5nID0gaGVhZGluZ3NbaV07XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG4gICAgICAgICAgb2NjdXJlbmNlLS07IC8vIGRlY3JlbWVudCBvY2N1cmVuY2VcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgLy8gY29uc29sZS5sb2coaGVhZGluZyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRhcmdldEZpbGUgPSB0aGlzLmFwcC5tZXRhZGF0YUNhY2hlLmdldEZpcnN0TGlua3BhdGhEZXN0KGN1cnIubGluaywgXCJcIik7XG4gICAgfVxuICAgIGxldCBsZWFmO1xuICAgIGlmKGV2ZW50KSB7XG4gICAgICAvLyBwcm9wZXJseSBoYW5kbGUgaWYgdGhlIG1ldGEvY3RybCBrZXkgaXMgcHJlc3NlZFxuICAgICAgY29uc3QgbW9kID0gT2JzaWRpYW4uS2V5bWFwLmlzTW9kRXZlbnQoZXZlbnQpO1xuICAgICAgLy8gZ2V0IG1vc3QgcmVjZW50IGxlYWZcbiAgICAgIGxlYWYgPSB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0TGVhZihtb2QpO1xuICAgIH1lbHNle1xuICAgICAgLy8gZ2V0IG1vc3QgcmVjZW50IGxlYWZcbiAgICAgIGxlYWYgPSB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0TW9zdFJlY2VudExlYWYoKTtcbiAgICB9XG4gICAgYXdhaXQgbGVhZi5vcGVuRmlsZSh0YXJnZXRGaWxlKTtcbiAgICBpZiAoaGVhZGluZykge1xuICAgICAgbGV0IHsgZWRpdG9yIH0gPSBsZWFmLnZpZXc7XG4gICAgICBjb25zdCBwb3MgPSB7IGxpbmU6IGhlYWRpbmcucG9zaXRpb24uc3RhcnQubGluZSwgY2g6IDAgfTtcbiAgICAgIGVkaXRvci5zZXRDdXJzb3IocG9zKTtcbiAgICAgIGVkaXRvci5zY3JvbGxJbnRvVmlldyh7IHRvOiBwb3MsIGZyb206IHBvcyB9LCB0cnVlKTtcbiAgICB9XG4gIH1cblxuICByZW5kZXJfYmxvY2tfY29udGV4dChibG9jaykge1xuICAgIGNvbnN0IGJsb2NrX2hlYWRpbmdzID0gYmxvY2subGluay5zcGxpdChcIi5tZFwiKVsxXS5zcGxpdChcIiNcIik7XG4gICAgLy8gc3RhcnRpbmcgd2l0aCB0aGUgbGFzdCBoZWFkaW5nIGZpcnN0LCBpdGVyYXRlIHRocm91Z2ggaGVhZGluZ3NcbiAgICBsZXQgYmxvY2tfY29udGV4dCA9IFwiXCI7XG4gICAgZm9yIChsZXQgaSA9IGJsb2NrX2hlYWRpbmdzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgICBpZihibG9ja19jb250ZXh0Lmxlbmd0aCA+IDApIHtcbiAgICAgICAgYmxvY2tfY29udGV4dCA9IGAgPiAke2Jsb2NrX2NvbnRleHR9YDtcbiAgICAgIH1cbiAgICAgIGJsb2NrX2NvbnRleHQgPSBibG9ja19oZWFkaW5nc1tpXSArIGJsb2NrX2NvbnRleHQ7XG4gICAgICAvLyBpZiBibG9jayBjb250ZXh0IGlzIGxvbmdlciB0aGFuIE4gY2hhcmFjdGVycywgYnJlYWtcbiAgICAgIGlmIChibG9ja19jb250ZXh0Lmxlbmd0aCA+IDEwMCkge1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gICAgLy8gcmVtb3ZlIGxlYWRpbmcgPiBpZiBleGlzdHNcbiAgICBpZiAoYmxvY2tfY29udGV4dC5zdGFydHNXaXRoKFwiID4gXCIpKSB7XG4gICAgICBibG9ja19jb250ZXh0ID0gYmxvY2tfY29udGV4dC5zbGljZSgzKTtcbiAgICB9XG4gICAgcmV0dXJuIGJsb2NrX2NvbnRleHQ7XG5cbiAgfVxuXG4gIHJlbmRlcmFibGVfZmlsZV90eXBlKGxpbmspIHtcbiAgICByZXR1cm4gKGxpbmsuaW5kZXhPZihcIi5tZFwiKSAhPT0gLTEpICYmIChsaW5rLmluZGV4T2YoXCIuZXhjYWxpZHJhd1wiKSA9PT0gLTEpO1xuICB9XG5cbiAgcmVuZGVyX2V4dGVybmFsX2xpbmtfZWxtKG1ldGEpe1xuICAgIGlmKG1ldGEuc291cmNlKSB7XG4gICAgICBpZihtZXRhLnNvdXJjZSA9PT0gXCJHbWFpbFwiKSBtZXRhLnNvdXJjZSA9IFwiXHVEODNEXHVEQ0U3IEdtYWlsXCI7XG4gICAgICByZXR1cm4gYDxzbWFsbD4ke21ldGEuc291cmNlfTwvc21hbGw+PGJyPiR7bWV0YS50aXRsZX1gO1xuICAgIH1cbiAgICAvLyByZW1vdmUgaHR0cChzKTovL1xuICAgIGxldCBkb21haW4gPSBtZXRhLnBhdGgucmVwbGFjZSgvKF5cXHcrOnxeKVxcL1xcLy8sIFwiXCIpO1xuICAgIC8vIHNlcGFyYXRlIGRvbWFpbiBmcm9tIHBhdGhcbiAgICBkb21haW4gPSBkb21haW4uc3BsaXQoXCIvXCIpWzBdO1xuICAgIC8vIHdyYXAgZG9tYWluIGluIDxzbWFsbD4gYW5kIGFkZCBsaW5lIGJyZWFrXG4gICAgcmV0dXJuIGA8c21hbGw+XHVEODNDXHVERjEwICR7ZG9tYWlufTwvc21hbGw+PGJyPiR7bWV0YS50aXRsZX1gO1xuICB9XG4gIC8vIGdldCBhbGwgZm9sZGVyc1xuICBhc3luYyBnZXRfYWxsX2ZvbGRlcnMoKSB7XG4gICAgaWYoIXRoaXMuZm9sZGVycyB8fCB0aGlzLmZvbGRlcnMubGVuZ3RoID09PSAwKXtcbiAgICAgIHRoaXMuZm9sZGVycyA9IGF3YWl0IHRoaXMuZ2V0X2ZvbGRlcnMoKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuZm9sZGVycztcbiAgfVxuICAvLyBnZXQgZm9sZGVycywgdHJhdmVyc2Ugbm9uLWhpZGRlbiBzdWItZm9sZGVyc1xuICBhc3luYyBnZXRfZm9sZGVycyhwYXRoID0gXCIvXCIpIHtcbiAgICBsZXQgZm9sZGVycyA9IChhd2FpdCB0aGlzLmFwcC52YXVsdC5hZGFwdGVyLmxpc3QocGF0aCkpLmZvbGRlcnM7XG4gICAgbGV0IGZvbGRlcl9saXN0ID0gW107XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBmb2xkZXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAoZm9sZGVyc1tpXS5zdGFydHNXaXRoKFwiLlwiKSkgY29udGludWU7XG4gICAgICBmb2xkZXJfbGlzdC5wdXNoKGZvbGRlcnNbaV0pO1xuICAgICAgZm9sZGVyX2xpc3QgPSBmb2xkZXJfbGlzdC5jb25jYXQoYXdhaXQgdGhpcy5nZXRfZm9sZGVycyhmb2xkZXJzW2ldICsgXCIvXCIpKTtcbiAgICB9XG4gICAgcmV0dXJuIGZvbGRlcl9saXN0O1xuICB9XG59XG5cbmNvbnN0IFNNQVJUX0NPTk5FQ1RJT05TX1ZJRVdfVFlQRSA9IFwic21hcnQtY29ubmVjdGlvbnMtdmlld1wiO1xuY2xhc3MgU21hcnRDb25uZWN0aW9uc1ZpZXcgZXh0ZW5kcyBPYnNpZGlhbi5JdGVtVmlldyB7XG4gIGNvbnN0cnVjdG9yKGxlYWYsIHBsdWdpbikge1xuICAgIHN1cGVyKGxlYWYpO1xuICAgIHRoaXMucGx1Z2luID0gcGx1Z2luO1xuICAgIHRoaXMubmVhcmVzdCA9IG51bGw7XG4gICAgdGhpcy5sb2FkX3dhaXQgPSBudWxsO1xuICB9XG4gIGdldFZpZXdUeXBlKCkge1xuICAgIHJldHVybiBTTUFSVF9DT05ORUNUSU9OU19WSUVXX1RZUEU7XG4gIH1cblxuICBnZXREaXNwbGF5VGV4dCgpIHtcbiAgICByZXR1cm4gXCJTbWFydCBDb25uZWN0aW9ucyBGaWxlc1wiO1xuICB9XG5cbiAgZ2V0SWNvbigpIHtcbiAgICByZXR1cm4gXCJzbWFydC1jb25uZWN0aW9uc1wiO1xuICB9XG5cblxuICBzZXRfbWVzc2FnZShtZXNzYWdlKSB7XG4gICAgY29uc3QgY29udGFpbmVyID0gdGhpcy5jb250YWluZXJFbC5jaGlsZHJlblsxXTtcbiAgICAvLyBjbGVhciBjb250YWluZXJcbiAgICBjb250YWluZXIuZW1wdHkoKTtcbiAgICAvLyBpbml0aWF0ZSB0b3AgYmFyXG4gICAgdGhpcy5pbml0aWF0ZV90b3BfYmFyKGNvbnRhaW5lcik7XG4gICAgLy8gaWYgbWVzYWdlIGlzIGFuIGFycmF5LCBsb29wIHRocm91Z2ggYW5kIGNyZWF0ZSBhIG5ldyBwIGVsZW1lbnQgZm9yIGVhY2ggbWVzc2FnZVxuICAgIGlmIChBcnJheS5pc0FycmF5KG1lc3NhZ2UpKSB7XG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG1lc3NhZ2UubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgY29udGFpbmVyLmNyZWF0ZUVsKFwicFwiLCB7IGNsczogXCJzY19tZXNzYWdlXCIsIHRleHQ6IG1lc3NhZ2VbaV0gfSk7XG4gICAgICB9XG4gICAgfWVsc2V7XG4gICAgICAvLyBjcmVhdGUgcCBlbGVtZW50IHdpdGggbWVzc2FnZVxuICAgICAgY29udGFpbmVyLmNyZWF0ZUVsKFwicFwiLCB7IGNsczogXCJzY19tZXNzYWdlXCIsIHRleHQ6IG1lc3NhZ2UgfSk7XG4gICAgfVxuICB9XG4gIHJlbmRlcl9saW5rX3RleHQobGluaywgc2hvd19mdWxsX3BhdGg9ZmFsc2UpIHtcbiAgICAvKipcbiAgICAgKiBCZWdpbiBpbnRlcm5hbCBsaW5rc1xuICAgICAqL1xuICAgIC8vIGlmIHNob3cgZnVsbCBwYXRoIGlzIGZhbHNlLCByZW1vdmUgZmlsZSBwYXRoXG4gICAgaWYgKCFzaG93X2Z1bGxfcGF0aCkge1xuICAgICAgbGluayA9IGxpbmsuc3BsaXQoXCIvXCIpLnBvcCgpO1xuICAgIH1cbiAgICAvLyBpZiBjb250YWlucyAnIydcbiAgICBpZiAobGluay5pbmRleE9mKFwiI1wiKSA+IC0xKSB7XG4gICAgICAvLyBzcGxpdCBhdCAubWRcbiAgICAgIGxpbmsgPSBsaW5rLnNwbGl0KFwiLm1kXCIpO1xuICAgICAgLy8gd3JhcCBmaXJzdCBwYXJ0IGluIDxzbWFsbD4gYW5kIGFkZCBsaW5lIGJyZWFrXG4gICAgICBsaW5rWzBdID0gYDxzbWFsbD4ke2xpbmtbMF19PC9zbWFsbD48YnI+YDtcbiAgICAgIC8vIGpvaW4gYmFjayB0b2dldGhlclxuICAgICAgbGluayA9IGxpbmsuam9pbihcIlwiKTtcbiAgICAgIC8vIHJlcGxhY2UgJyMnIHdpdGggJyBcdTAwQkIgJ1xuICAgICAgbGluayA9IGxpbmsucmVwbGFjZSgvXFwjL2csIFwiIFx1MDBCQiBcIik7XG4gICAgfWVsc2V7XG4gICAgICAvLyByZW1vdmUgJy5tZCdcbiAgICAgIGxpbmsgPSBsaW5rLnJlcGxhY2UoXCIubWRcIiwgXCJcIik7XG4gICAgfVxuICAgIHJldHVybiBsaW5rO1xuICB9XG5cblxuICBzZXRfbmVhcmVzdChuZWFyZXN0LCBuZWFyZXN0X2NvbnRleHQ9bnVsbCwgcmVzdWx0c19vbmx5PWZhbHNlKSB7XG4gICAgLy8gZ2V0IGNvbnRhaW5lciBlbGVtZW50XG4gICAgY29uc3QgY29udGFpbmVyID0gdGhpcy5jb250YWluZXJFbC5jaGlsZHJlblsxXTtcbiAgICAvLyBpZiByZXN1bHRzIG9ubHkgaXMgZmFsc2UsIGNsZWFyIGNvbnRhaW5lciBhbmQgaW5pdGlhdGUgdG9wIGJhclxuICAgIGlmKCFyZXN1bHRzX29ubHkpe1xuICAgICAgLy8gY2xlYXIgY29udGFpbmVyXG4gICAgICBjb250YWluZXIuZW1wdHkoKTtcbiAgICAgIHRoaXMuaW5pdGlhdGVfdG9wX2Jhcihjb250YWluZXIsIG5lYXJlc3RfY29udGV4dCk7XG4gICAgfVxuICAgIC8vIHVwZGF0ZSByZXN1bHRzXG4gICAgdGhpcy5wbHVnaW4udXBkYXRlX3Jlc3VsdHMoY29udGFpbmVyLCBuZWFyZXN0KTtcbiAgfVxuXG4gIGluaXRpYXRlX3RvcF9iYXIoY29udGFpbmVyLCBuZWFyZXN0X2NvbnRleHQ9bnVsbCkge1xuICAgIGxldCB0b3BfYmFyO1xuICAgIC8vIGlmIHRvcCBiYXIgYWxyZWFkeSBleGlzdHMsIGVtcHR5IGl0XG4gICAgaWYgKChjb250YWluZXIuY2hpbGRyZW4ubGVuZ3RoID4gMCkgJiYgKGNvbnRhaW5lci5jaGlsZHJlblswXS5jbGFzc0xpc3QuY29udGFpbnMoXCJzYy10b3AtYmFyXCIpKSkge1xuICAgICAgdG9wX2JhciA9IGNvbnRhaW5lci5jaGlsZHJlblswXTtcbiAgICAgIHRvcF9iYXIuZW1wdHkoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gaW5pdCBjb250YWluZXIgZm9yIHRvcCBiYXJcbiAgICAgIHRvcF9iYXIgPSBjb250YWluZXIuY3JlYXRlRWwoXCJkaXZcIiwgeyBjbHM6IFwic2MtdG9wLWJhclwiIH0pO1xuICAgIH1cbiAgICAvLyBpZiBoaWdobGlnaHRlZCB0ZXh0IGlzIG5vdCBudWxsLCBjcmVhdGUgcCBlbGVtZW50IHdpdGggaGlnaGxpZ2h0ZWQgdGV4dFxuICAgIGlmIChuZWFyZXN0X2NvbnRleHQpIHtcbiAgICAgIHRvcF9iYXIuY3JlYXRlRWwoXCJwXCIsIHsgY2xzOiBcInNjLWNvbnRleHRcIiwgdGV4dDogbmVhcmVzdF9jb250ZXh0IH0pO1xuICAgIH1cbiAgICAvLyBhZGQgY2hhdCBidXR0b25cbiAgICBjb25zdCBjaGF0X2J1dHRvbiA9IHRvcF9iYXIuY3JlYXRlRWwoXCJidXR0b25cIiwgeyBjbHM6IFwic2MtY2hhdC1idXR0b25cIiB9KTtcbiAgICAvLyBhZGQgaWNvbiB0byBjaGF0IGJ1dHRvblxuICAgIE9ic2lkaWFuLnNldEljb24oY2hhdF9idXR0b24sIFwibWVzc2FnZS1zcXVhcmVcIik7XG4gICAgLy8gYWRkIGNsaWNrIGxpc3RlbmVyIHRvIGNoYXQgYnV0dG9uXG4gICAgY2hhdF9idXR0b24uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHtcbiAgICAgIC8vIG9wZW4gY2hhdFxuICAgICAgdGhpcy5wbHVnaW4ub3Blbl9jaGF0KCk7XG4gICAgfSk7XG4gICAgLy8gYWRkIHNlYXJjaCBidXR0b25cbiAgICBjb25zdCBzZWFyY2hfYnV0dG9uID0gdG9wX2Jhci5jcmVhdGVFbChcImJ1dHRvblwiLCB7IGNsczogXCJzYy1zZWFyY2gtYnV0dG9uXCIgfSk7XG4gICAgLy8gYWRkIGljb24gdG8gc2VhcmNoIGJ1dHRvblxuICAgIE9ic2lkaWFuLnNldEljb24oc2VhcmNoX2J1dHRvbiwgXCJzZWFyY2hcIik7XG4gICAgLy8gYWRkIGNsaWNrIGxpc3RlbmVyIHRvIHNlYXJjaCBidXR0b25cbiAgICBzZWFyY2hfYnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiB7XG4gICAgICAvLyBlbXB0eSB0b3AgYmFyXG4gICAgICB0b3BfYmFyLmVtcHR5KCk7XG4gICAgICAvLyBjcmVhdGUgaW5wdXQgZWxlbWVudFxuICAgICAgY29uc3Qgc2VhcmNoX2NvbnRhaW5lciA9IHRvcF9iYXIuY3JlYXRlRWwoXCJkaXZcIiwgeyBjbHM6IFwic2VhcmNoLWlucHV0LWNvbnRhaW5lclwiIH0pO1xuICAgICAgY29uc3QgaW5wdXQgPSBzZWFyY2hfY29udGFpbmVyLmNyZWF0ZUVsKFwiaW5wdXRcIiwge1xuICAgICAgICBjbHM6IFwic2Mtc2VhcmNoLWlucHV0XCIsXG4gICAgICAgIHR5cGU6IFwic2VhcmNoXCIsXG4gICAgICAgIHBsYWNlaG9sZGVyOiBcIlR5cGUgdG8gc3RhcnQgc2VhcmNoLi4uXCIsIFxuICAgICAgfSk7XG4gICAgICAvLyBmb2N1cyBpbnB1dFxuICAgICAgaW5wdXQuZm9jdXMoKTtcbiAgICAgIC8vIGFkZCBrZXlkb3duIGxpc3RlbmVyIHRvIGlucHV0XG4gICAgICBpbnB1dC5hZGRFdmVudExpc3RlbmVyKFwia2V5ZG93blwiLCAoZXZlbnQpID0+IHtcbiAgICAgICAgLy8gaWYgZXNjYXBlIGtleSBpcyBwcmVzc2VkXG4gICAgICAgIGlmIChldmVudC5rZXkgPT09IFwiRXNjYXBlXCIpIHtcbiAgICAgICAgICB0aGlzLmNsZWFyX2F1dG9fc2VhcmNoZXIoKTtcbiAgICAgICAgICAvLyBjbGVhciB0b3AgYmFyXG4gICAgICAgICAgdGhpcy5pbml0aWF0ZV90b3BfYmFyKGNvbnRhaW5lciwgbmVhcmVzdF9jb250ZXh0KTtcbiAgICAgICAgfVxuICAgICAgfSk7XG5cbiAgICAgIC8vIGFkZCBrZXl1cCBsaXN0ZW5lciB0byBpbnB1dFxuICAgICAgaW5wdXQuYWRkRXZlbnRMaXN0ZW5lcihcImtleXVwXCIsIChldmVudCkgPT4ge1xuICAgICAgICAvLyBpZiB0aGlzLnNlYXJjaF90aW1lb3V0IGlzIG5vdCBudWxsIHRoZW4gY2xlYXIgaXQgYW5kIHNldCB0byBudWxsXG4gICAgICAgIHRoaXMuY2xlYXJfYXV0b19zZWFyY2hlcigpO1xuICAgICAgICAvLyBnZXQgc2VhcmNoIHRlcm1cbiAgICAgICAgY29uc3Qgc2VhcmNoX3Rlcm0gPSBpbnB1dC52YWx1ZTtcbiAgICAgICAgLy8gaWYgZW50ZXIga2V5IGlzIHByZXNzZWRcbiAgICAgICAgaWYgKGV2ZW50LmtleSA9PT0gXCJFbnRlclwiICYmIHNlYXJjaF90ZXJtICE9PSBcIlwiKSB7XG4gICAgICAgICAgdGhpcy5zZWFyY2goc2VhcmNoX3Rlcm0pO1xuICAgICAgICB9XG4gICAgICAgIC8vIGlmIGFueSBvdGhlciBrZXkgaXMgcHJlc3NlZCBhbmQgaW5wdXQgaXMgbm90IGVtcHR5IHRoZW4gd2FpdCA1MDBtcyBhbmQgbWFrZV9jb25uZWN0aW9uc1xuICAgICAgICBlbHNlIGlmIChzZWFyY2hfdGVybSAhPT0gXCJcIikge1xuICAgICAgICAgIC8vIGNsZWFyIHRpbWVvdXRcbiAgICAgICAgICBjbGVhclRpbWVvdXQodGhpcy5zZWFyY2hfdGltZW91dCk7XG4gICAgICAgICAgLy8gc2V0IHRpbWVvdXRcbiAgICAgICAgICB0aGlzLnNlYXJjaF90aW1lb3V0ID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgICAgICB0aGlzLnNlYXJjaChzZWFyY2hfdGVybSwgdHJ1ZSk7XG4gICAgICAgICAgfSwgNzAwKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cblxuICAvLyByZW5kZXIgYnV0dG9uczogXCJjcmVhdGVcIiBhbmQgXCJyZXRyeVwiIGZvciBsb2FkaW5nIGVtYmVkZGluZ3MuanNvbiBmaWxlXG4gIHJlbmRlcl9lbWJlZGRpbmdzX2J1dHRvbnMoKSB7XG4gICAgLy8gZ2V0IGNvbnRhaW5lciBlbGVtZW50XG4gICAgY29uc3QgY29udGFpbmVyID0gdGhpcy5jb250YWluZXJFbC5jaGlsZHJlblsxXTtcbiAgICAvLyBjbGVhciBjb250YWluZXJcbiAgICBjb250YWluZXIuZW1wdHkoKTtcbiAgICAvLyBjcmVhdGUgaGVhZGluZyB0aGF0IHNheXMgXCJFbWJlZGRpbmdzIGZpbGUgbm90IGZvdW5kXCJcbiAgICBjb250YWluZXIuY3JlYXRlRWwoXCJoMlwiLCB7IGNsczogXCJzY0hlYWRpbmdcIiwgdGV4dDogXCJFbWJlZGRpbmdzIGZpbGUgbm90IGZvdW5kXCIgfSk7XG4gICAgLy8gY3JlYXRlIGRpdiBmb3IgYnV0dG9uc1xuICAgIGNvbnN0IGJ1dHRvbl9kaXYgPSBjb250YWluZXIuY3JlYXRlRWwoXCJkaXZcIiwgeyBjbHM6IFwic2NCdXR0b25EaXZcIiB9KTtcbiAgICAvLyBjcmVhdGUgXCJjcmVhdGVcIiBidXR0b25cbiAgICBjb25zdCBjcmVhdGVfYnV0dG9uID0gYnV0dG9uX2Rpdi5jcmVhdGVFbChcImJ1dHRvblwiLCB7IGNsczogXCJzY0J1dHRvblwiLCB0ZXh0OiBcIkNyZWF0ZSBlbWJlZGRpbmdzLmpzb25cIiB9KTtcbiAgICAvLyBub3RlIHRoYXQgY3JlYXRpbmcgZW1iZWRkaW5ncy5qc29uIGZpbGUgd2lsbCB0cmlnZ2VyIGJ1bGsgZW1iZWRkaW5nIGFuZCBtYXkgdGFrZSBhIHdoaWxlXG4gICAgYnV0dG9uX2Rpdi5jcmVhdGVFbChcInBcIiwgeyBjbHM6IFwic2NCdXR0b25Ob3RlXCIsIHRleHQ6IFwiV2FybmluZzogQ3JlYXRpbmcgZW1iZWRkaW5ncy5qc29uIGZpbGUgd2lsbCB0cmlnZ2VyIGJ1bGsgZW1iZWRkaW5nIGFuZCBtYXkgdGFrZSBhIHdoaWxlXCIgfSk7XG4gICAgLy8gY3JlYXRlIFwicmV0cnlcIiBidXR0b25cbiAgICBjb25zdCByZXRyeV9idXR0b24gPSBidXR0b25fZGl2LmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHsgY2xzOiBcInNjQnV0dG9uXCIsIHRleHQ6IFwiUmV0cnlcIiB9KTtcbiAgICAvLyB0cnkgdG8gbG9hZCBlbWJlZGRpbmdzLmpzb24gZmlsZSBhZ2FpblxuICAgIGJ1dHRvbl9kaXYuY3JlYXRlRWwoXCJwXCIsIHsgY2xzOiBcInNjQnV0dG9uTm90ZVwiLCB0ZXh0OiBcIklmIGVtYmVkZGluZ3MuanNvbiBmaWxlIGFscmVhZHkgZXhpc3RzLCBjbGljayAnUmV0cnknIHRvIGxvYWQgaXRcIiB9KTtcblxuICAgIC8vIGFkZCBjbGljayBldmVudCB0byBcImNyZWF0ZVwiIGJ1dHRvblxuICAgIGNyZWF0ZV9idXR0b24uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIGFzeW5jIChldmVudCkgPT4ge1xuICAgICAgLy8gY3JlYXRlIGVtYmVkZGluZ3MuanNvbiBmaWxlXG4gICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zbWFydF92ZWNfbGl0ZS5pbml0X2VtYmVkZGluZ3NfZmlsZSgpO1xuICAgICAgLy8gcmVsb2FkIHZpZXdcbiAgICAgIGF3YWl0IHRoaXMucmVuZGVyX2Nvbm5lY3Rpb25zKCk7XG4gICAgfSk7XG5cbiAgICAvLyBhZGQgY2xpY2sgZXZlbnQgdG8gXCJyZXRyeVwiIGJ1dHRvblxuICAgIHJldHJ5X2J1dHRvbi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgYXN5bmMgKGV2ZW50KSA9PiB7XG4gICAgICBjb25zb2xlLmxvZyhcInJldHJ5aW5nIHRvIGxvYWQgZW1iZWRkaW5ncy5qc29uIGZpbGVcIik7XG4gICAgICAvLyByZWxvYWQgZW1iZWRkaW5ncy5qc29uIGZpbGVcbiAgICAgIGF3YWl0IHRoaXMucGx1Z2luLmluaXRfdmVjcygpO1xuICAgICAgLy8gcmVsb2FkIHZpZXdcbiAgICAgIGF3YWl0IHRoaXMucmVuZGVyX2Nvbm5lY3Rpb25zKCk7XG4gICAgfSk7XG4gIH1cblxuICBhc3luYyBvbk9wZW4oKSB7XG4gICAgY29uc3QgY29udGFpbmVyID0gdGhpcy5jb250YWluZXJFbC5jaGlsZHJlblsxXTtcbiAgICBjb250YWluZXIuZW1wdHkoKTtcbiAgICAvLyBwbGFjZWhvbGRlciB0ZXh0XG4gICAgY29udGFpbmVyLmNyZWF0ZUVsKFwicFwiLCB7IGNsczogXCJzY1BsYWNlaG9sZGVyXCIsIHRleHQ6IFwiT3BlbiBhIG5vdGUgdG8gZmluZCBjb25uZWN0aW9ucy5cIiB9KTsgXG5cbiAgICAvLyBydW5zIHdoZW4gZmlsZSBpcyBvcGVuZWRcbiAgICB0aGlzLnBsdWdpbi5yZWdpc3RlckV2ZW50KHRoaXMuYXBwLndvcmtzcGFjZS5vbignZmlsZS1vcGVuJywgKGZpbGUpID0+IHtcbiAgICAgIC8vIGlmIG5vIGZpbGUgaXMgb3BlbiwgcmV0dXJuXG4gICAgICBpZighZmlsZSkge1xuICAgICAgICAvLyBjb25zb2xlLmxvZyhcIm5vIGZpbGUgb3BlbiwgcmV0dXJuaW5nXCIpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICAvLyByZXR1cm4gaWYgZmlsZSB0eXBlIGlzIG5vdCBzdXBwb3J0ZWRcbiAgICAgIGlmKFNVUFBPUlRFRF9GSUxFX1RZUEVTLmluZGV4T2YoZmlsZS5leHRlbnNpb24pID09PSAtMSkge1xuICAgICAgICByZXR1cm4gdGhpcy5zZXRfbWVzc2FnZShbXG4gICAgICAgICAgXCJGaWxlOiBcIitmaWxlLm5hbWVcbiAgICAgICAgICAsXCJVbnN1cHBvcnRlZCBmaWxlIHR5cGUgKFN1cHBvcnRlZDogXCIrU1VQUE9SVEVEX0ZJTEVfVFlQRVMuam9pbihcIiwgXCIpK1wiKVwiXG4gICAgICAgIF0pO1xuICAgICAgfVxuICAgICAgLy8gcnVuIHJlbmRlcl9jb25uZWN0aW9ucyBhZnRlciAxIHNlY29uZCB0byBhbGxvdyBmb3IgZmlsZSB0byBsb2FkXG4gICAgICBpZih0aGlzLmxvYWRfd2FpdCl7XG4gICAgICAgIGNsZWFyVGltZW91dCh0aGlzLmxvYWRfd2FpdCk7XG4gICAgICB9XG4gICAgICB0aGlzLmxvYWRfd2FpdCA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICB0aGlzLnJlbmRlcl9jb25uZWN0aW9ucyhmaWxlKTtcbiAgICAgICAgdGhpcy5sb2FkX3dhaXQgPSBudWxsO1xuICAgICAgfSwgMTAwMCk7XG4gICAgICAgIFxuICAgIH0pKTtcblxuICAgIHRoaXMuYXBwLndvcmtzcGFjZS5yZWdpc3RlckhvdmVyTGlua1NvdXJjZShTTUFSVF9DT05ORUNUSU9OU19WSUVXX1RZUEUsIHtcbiAgICAgICAgZGlzcGxheTogJ1NtYXJ0IENvbm5lY3Rpb25zIEZpbGVzJyxcbiAgICAgICAgZGVmYXVsdE1vZDogdHJ1ZSxcbiAgICB9KTtcbiAgICB0aGlzLmFwcC53b3Jrc3BhY2UucmVnaXN0ZXJIb3ZlckxpbmtTb3VyY2UoU01BUlRfQ09OTkVDVElPTlNfQ0hBVF9WSUVXX1RZUEUsIHtcbiAgICAgICAgZGlzcGxheTogJ1NtYXJ0IENoYXQgTGlua3MnLFxuICAgICAgICBkZWZhdWx0TW9kOiB0cnVlLFxuICAgIH0pO1xuXG4gICAgdGhpcy5hcHAud29ya3NwYWNlLm9uTGF5b3V0UmVhZHkodGhpcy5pbml0aWFsaXplLmJpbmQodGhpcykpO1xuICAgIFxuICB9XG4gIFxuICBhc3luYyBpbml0aWFsaXplKCkge1xuICAgIHRoaXMuc2V0X21lc3NhZ2UoXCJMb2FkaW5nIGVtYmVkZGluZ3MgZmlsZS4uLlwiKTtcbiAgICBjb25zdCB2ZWNzX2ludGlhdGVkID0gYXdhaXQgdGhpcy5wbHVnaW4uaW5pdF92ZWNzKCk7XG4gICAgaWYodmVjc19pbnRpYXRlZCl7XG4gICAgICB0aGlzLnNldF9tZXNzYWdlKFwiRW1iZWRkaW5ncyBmaWxlIGxvYWRlZC5cIik7XG4gICAgICBhd2FpdCB0aGlzLnJlbmRlcl9jb25uZWN0aW9ucygpO1xuICAgIH1lbHNle1xuICAgICAgdGhpcy5yZW5kZXJfZW1iZWRkaW5nc19idXR0b25zKCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRVhQRVJJTUVOVEFMXG4gICAgICogLSB3aW5kb3ctYmFzZWQgQVBJIGFjY2Vzc1xuICAgICAqIC0gY29kZS1ibG9jayByZW5kZXJpbmdcbiAgICAgKi9cbiAgICB0aGlzLmFwaSA9IG5ldyBTbWFydENvbm5lY3Rpb25zVmlld0FwaSh0aGlzLmFwcCwgdGhpcy5wbHVnaW4sIHRoaXMpO1xuICAgIC8vIHJlZ2lzdGVyIEFQSSB0byBnbG9iYWwgd2luZG93IG9iamVjdFxuICAgICh3aW5kb3dbXCJTbWFydENvbm5lY3Rpb25zVmlld0FwaVwiXSA9IHRoaXMuYXBpKSAmJiB0aGlzLnJlZ2lzdGVyKCgpID0+IGRlbGV0ZSB3aW5kb3dbXCJTbWFydENvbm5lY3Rpb25zVmlld0FwaVwiXSk7XG5cbiAgfVxuXG4gIGFzeW5jIG9uQ2xvc2UoKSB7XG4gICAgY29uc29sZS5sb2coXCJjbG9zaW5nIHNtYXJ0IGNvbm5lY3Rpb25zIHZpZXdcIik7XG4gICAgdGhpcy5hcHAud29ya3NwYWNlLnVucmVnaXN0ZXJIb3ZlckxpbmtTb3VyY2UoU01BUlRfQ09OTkVDVElPTlNfVklFV19UWVBFKTtcbiAgICB0aGlzLnBsdWdpbi52aWV3ID0gbnVsbDtcbiAgfVxuXG4gIGFzeW5jIHJlbmRlcl9jb25uZWN0aW9ucyhjb250ZXh0PW51bGwpIHtcbiAgICBjb25zb2xlLmxvZyhcInJlbmRlcmluZyBjb25uZWN0aW9uc1wiKTtcbiAgICAvLyBpZiBBUEkga2V5IGlzIG5vdCBzZXQgdGhlbiB1cGRhdGUgdmlldyBtZXNzYWdlXG4gICAgaWYoIXRoaXMucGx1Z2luLnNldHRpbmdzLmFwaV9rZXkpIHtcbiAgICAgIHRoaXMuc2V0X21lc3NhZ2UoXCJBbiBPcGVuQUkgQVBJIGtleSBpcyByZXF1aXJlZCB0byBtYWtlIFNtYXJ0IENvbm5lY3Rpb25zXCIpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBpZighdGhpcy5wbHVnaW4uZW1iZWRkaW5nc19sb2FkZWQpe1xuICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uaW5pdF92ZWNzKCk7XG4gICAgfVxuICAgIHRoaXMuc2V0X21lc3NhZ2UoXCJNYWtpbmcgU21hcnQgQ29ubmVjdGlvbnMuLi5cIik7XG4gICAgLyoqXG4gICAgICogQmVnaW4gaGlnaGxpZ2h0ZWQtdGV4dC1sZXZlbCBzZWFyY2hcbiAgICAgKi9cbiAgICBpZih0eXBlb2YgY29udGV4dCA9PT0gXCJzdHJpbmdcIikge1xuICAgICAgY29uc3QgaGlnaGxpZ2h0ZWRfdGV4dCA9IGNvbnRleHQ7XG4gICAgICAvLyBnZXQgZW1iZWRkaW5nIGZvciBoaWdobGlnaHRlZCB0ZXh0XG4gICAgICBhd2FpdCB0aGlzLnNlYXJjaChoaWdobGlnaHRlZF90ZXh0KTtcbiAgICAgIHJldHVybjsgLy8gZW5kcyBoZXJlIGlmIGNvbnRleHQgaXMgYSBzdHJpbmdcbiAgICB9XG5cbiAgICAvKiogXG4gICAgICogQmVnaW4gZmlsZS1sZXZlbCBzZWFyY2hcbiAgICAgKi8gICAgXG4gICAgdGhpcy5uZWFyZXN0ID0gbnVsbDtcbiAgICB0aGlzLmludGVydmFsX2NvdW50ID0gMDtcbiAgICB0aGlzLnJlbmRlcmluZyA9IGZhbHNlO1xuICAgIHRoaXMuZmlsZSA9IGNvbnRleHQ7XG4gICAgLy8gaWYgdGhpcy5pbnRlcnZhbCBpcyBzZXQgdGhlbiBjbGVhciBpdFxuICAgIGlmKHRoaXMuaW50ZXJ2YWwpIHtcbiAgICAgIGNsZWFySW50ZXJ2YWwodGhpcy5pbnRlcnZhbCk7XG4gICAgICB0aGlzLmludGVydmFsID0gbnVsbDtcbiAgICB9XG4gICAgLy8gc2V0IGludGVydmFsIHRvIGNoZWNrIGlmIG5lYXJlc3QgaXMgc2V0XG4gICAgdGhpcy5pbnRlcnZhbCA9IHNldEludGVydmFsKCgpID0+IHtcbiAgICAgIGlmKCF0aGlzLnJlbmRlcmluZyl7XG4gICAgICAgIGlmKHRoaXMuZmlsZSBpbnN0YW5jZW9mIE9ic2lkaWFuLlRGaWxlKSB7XG4gICAgICAgICAgdGhpcy5yZW5kZXJpbmcgPSB0cnVlO1xuICAgICAgICAgIHRoaXMucmVuZGVyX25vdGVfY29ubmVjdGlvbnModGhpcy5maWxlKTtcbiAgICAgICAgfWVsc2V7XG4gICAgICAgICAgLy8gZ2V0IGN1cnJlbnQgbm90ZVxuICAgICAgICAgIHRoaXMuZmlsZSA9IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRBY3RpdmVGaWxlKCk7XG4gICAgICAgICAgLy8gaWYgc3RpbGwgbm8gY3VycmVudCBub3RlIHRoZW4gcmV0dXJuXG4gICAgICAgICAgaWYoIXRoaXMuZmlsZSAmJiB0aGlzLmNvdW50ID4gMSkge1xuICAgICAgICAgICAgY2xlYXJJbnRlcnZhbCh0aGlzLmludGVydmFsKTtcbiAgICAgICAgICAgIHRoaXMuc2V0X21lc3NhZ2UoXCJObyBhY3RpdmUgZmlsZVwiKTtcbiAgICAgICAgICAgIHJldHVybjsgXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9ZWxzZXtcbiAgICAgICAgaWYodGhpcy5uZWFyZXN0KSB7XG4gICAgICAgICAgY2xlYXJJbnRlcnZhbCh0aGlzLmludGVydmFsKTtcbiAgICAgICAgICAvLyBpZiBuZWFyZXN0IGlzIGEgc3RyaW5nIHRoZW4gdXBkYXRlIHZpZXcgbWVzc2FnZVxuICAgICAgICAgIGlmICh0eXBlb2YgdGhpcy5uZWFyZXN0ID09PSBcInN0cmluZ1wiKSB7XG4gICAgICAgICAgICB0aGlzLnNldF9tZXNzYWdlKHRoaXMubmVhcmVzdCk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIHNldCBuZWFyZXN0IGNvbm5lY3Rpb25zXG4gICAgICAgICAgICB0aGlzLnNldF9uZWFyZXN0KHRoaXMubmVhcmVzdCwgXCJGaWxlOiBcIiArIHRoaXMuZmlsZS5uYW1lKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgLy8gaWYgcmVuZGVyX2xvZy5mYWlsZWRfZW1iZWRkaW5ncyB0aGVuIHVwZGF0ZSBmYWlsZWRfZW1iZWRkaW5ncy50eHRcbiAgICAgICAgICBpZiAodGhpcy5wbHVnaW4ucmVuZGVyX2xvZy5mYWlsZWRfZW1iZWRkaW5ncy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICB0aGlzLnBsdWdpbi5zYXZlX2ZhaWxlZF9lbWJlZGRpbmdzKCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIC8vIGdldCBvYmplY3Qga2V5cyBvZiByZW5kZXJfbG9nXG4gICAgICAgICAgdGhpcy5wbHVnaW4ub3V0cHV0X3JlbmRlcl9sb2coKTtcbiAgICAgICAgICByZXR1cm47IFxuICAgICAgICB9ZWxzZXtcbiAgICAgICAgICB0aGlzLmludGVydmFsX2NvdW50Kys7XG4gICAgICAgICAgdGhpcy5zZXRfbWVzc2FnZShcIk1ha2luZyBTbWFydCBDb25uZWN0aW9ucy4uLlwiK3RoaXMuaW50ZXJ2YWxfY291bnQpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSwgMTApO1xuICB9XG5cbiAgYXN5bmMgcmVuZGVyX25vdGVfY29ubmVjdGlvbnMoZmlsZSkge1xuICAgIHRoaXMubmVhcmVzdCA9IGF3YWl0IHRoaXMucGx1Z2luLmZpbmRfbm90ZV9jb25uZWN0aW9ucyhmaWxlKTtcbiAgfVxuXG4gIGNsZWFyX2F1dG9fc2VhcmNoZXIoKSB7XG4gICAgaWYgKHRoaXMuc2VhcmNoX3RpbWVvdXQpIHtcbiAgICAgIGNsZWFyVGltZW91dCh0aGlzLnNlYXJjaF90aW1lb3V0KTtcbiAgICAgIHRoaXMuc2VhcmNoX3RpbWVvdXQgPSBudWxsO1xuICAgIH1cbiAgfVxuXG4gIGFzeW5jIHNlYXJjaChzZWFyY2hfdGV4dCwgcmVzdWx0c19vbmx5PWZhbHNlKSB7XG4gICAgY29uc3QgbmVhcmVzdCA9IGF3YWl0IHRoaXMucGx1Z2luLmFwaS5zZWFyY2goc2VhcmNoX3RleHQpO1xuICAgIC8vIHJlbmRlciByZXN1bHRzIGluIHZpZXcgd2l0aCBmaXJzdCAxMDAgY2hhcmFjdGVycyBvZiBzZWFyY2ggdGV4dFxuICAgIGNvbnN0IG5lYXJlc3RfY29udGV4dCA9IGBTZWxlY3Rpb246IFwiJHtzZWFyY2hfdGV4dC5sZW5ndGggPiAxMDAgPyBzZWFyY2hfdGV4dC5zdWJzdHJpbmcoMCwgMTAwKSArIFwiLi4uXCIgOiBzZWFyY2hfdGV4dH1cImA7XG4gICAgdGhpcy5zZXRfbmVhcmVzdChuZWFyZXN0LCBuZWFyZXN0X2NvbnRleHQsIHJlc3VsdHNfb25seSk7XG4gIH1cblxufVxuY2xhc3MgU21hcnRDb25uZWN0aW9uc1ZpZXdBcGkge1xuICBjb25zdHJ1Y3RvcihhcHAsIHBsdWdpbiwgdmlldykge1xuICAgIHRoaXMuYXBwID0gYXBwO1xuICAgIHRoaXMucGx1Z2luID0gcGx1Z2luO1xuICAgIHRoaXMudmlldyA9IHZpZXc7XG4gIH1cbiAgYXN5bmMgc2VhcmNoIChzZWFyY2hfdGV4dCkge1xuICAgIHJldHVybiBhd2FpdCB0aGlzLnBsdWdpbi5hcGkuc2VhcmNoKHNlYXJjaF90ZXh0KTtcbiAgfVxuICAvLyB0cmlnZ2VyIHJlbG9hZCBvZiBlbWJlZGRpbmdzIGZpbGVcbiAgYXN5bmMgcmVsb2FkX2VtYmVkZGluZ3NfZmlsZSgpIHtcbiAgICBhd2FpdCB0aGlzLnBsdWdpbi5pbml0X3ZlY3MoKTtcbiAgICBhd2FpdCB0aGlzLnZpZXcucmVuZGVyX2Nvbm5lY3Rpb25zKCk7XG4gIH1cbn1cbmNsYXNzIFNjU2VhcmNoQXBpIHtcbiAgY29uc3RydWN0b3IoYXBwLCBwbHVnaW4pIHtcbiAgICB0aGlzLmFwcCA9IGFwcDtcbiAgICB0aGlzLnBsdWdpbiA9IHBsdWdpbjtcbiAgfVxuICBhc3luYyBzZWFyY2ggKHNlYXJjaF90ZXh0LCBmaWx0ZXI9e30pIHtcbiAgICBmaWx0ZXIgPSB7XG4gICAgICBza2lwX3NlY3Rpb25zOiB0aGlzLnBsdWdpbi5zZXR0aW5ncy5za2lwX3NlY3Rpb25zLFxuICAgICAgLi4uZmlsdGVyXG4gICAgfVxuICAgIGxldCBuZWFyZXN0ID0gW107XG4gICAgY29uc3QgcmVzcCA9IGF3YWl0IHRoaXMucGx1Z2luLnJlcXVlc3RfZW1iZWRkaW5nX2Zyb21faW5wdXQoc2VhcmNoX3RleHQpO1xuICAgIGlmIChyZXNwICYmIHJlc3AuZGF0YSAmJiByZXNwLmRhdGFbMF0gJiYgcmVzcC5kYXRhWzBdLmVtYmVkZGluZykge1xuICAgICAgbmVhcmVzdCA9IHRoaXMucGx1Z2luLnNtYXJ0X3ZlY19saXRlLm5lYXJlc3QocmVzcC5kYXRhWzBdLmVtYmVkZGluZywgZmlsdGVyKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gcmVzcCBpcyBudWxsLCB1bmRlZmluZWQsIG9yIG1pc3NpbmcgZGF0YVxuICAgICAgbmV3IE9ic2lkaWFuLk5vdGljZShcIlNtYXJ0IENvbm5lY3Rpb25zOiBFcnJvciBnZXR0aW5nIGVtYmVkZGluZ1wiKTtcbiAgICB9XG4gICAgcmV0dXJuIG5lYXJlc3Q7XG4gIH1cbn1cblxuY2xhc3MgU21hcnRDb25uZWN0aW9uc1NldHRpbmdzVGFiIGV4dGVuZHMgT2JzaWRpYW4uUGx1Z2luU2V0dGluZ1RhYiB7XG4gIGNvbnN0cnVjdG9yKGFwcCwgcGx1Z2luKSB7XG4gICAgc3VwZXIoYXBwLCBwbHVnaW4pO1xuICAgIHRoaXMucGx1Z2luID0gcGx1Z2luO1xuICB9XG4gIGRpc3BsYXkoKSB7XG4gICAgY29uc3Qge1xuICAgICAgY29udGFpbmVyRWxcbiAgICB9ID0gdGhpcztcbiAgICBjb250YWluZXJFbC5lbXB0eSgpO1xuICAgIGNvbnRhaW5lckVsLmNyZWF0ZUVsKFwiaDJcIiwge1xuICAgICAgdGV4dDogXCJPcGVuQUkgU2V0dGluZ3NcIlxuICAgIH0pO1xuICAgIG5ldyBPYnNpZGlhbi5TZXR0aW5nKGNvbnRhaW5lckVsKS5zZXROYW1lKFwiYXBpX2tleVwiKS5zZXREZXNjKFwiYXBpX2tleVwiKS5hZGRUZXh0KCh0ZXh0KSA9PiB0ZXh0LnNldFBsYWNlaG9sZGVyKFwiRW50ZXIgeW91ciBhcGlfa2V5XCIpLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmFwaV9rZXkpLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MuYXBpX2tleSA9IHZhbHVlLnRyaW0oKTtcbiAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncyh0cnVlKTtcbiAgICB9KSk7XG4gICAgLy8gYWRkIGEgYnV0dG9uIHRvIHRlc3QgdGhlIEFQSSBrZXkgaXMgd29ya2luZ1xuICAgIG5ldyBPYnNpZGlhbi5TZXR0aW5nKGNvbnRhaW5lckVsKS5zZXROYW1lKFwiVGVzdCBBUEkgS2V5XCIpLnNldERlc2MoXCJUZXN0IEFQSSBLZXlcIikuYWRkQnV0dG9uKChidXR0b24pID0+IGJ1dHRvbi5zZXRCdXR0b25UZXh0KFwiVGVzdCBBUEkgS2V5XCIpLm9uQ2xpY2soYXN5bmMgKCkgPT4ge1xuICAgICAgLy8gdGVzdCBBUEkga2V5XG4gICAgICBjb25zdCByZXNwID0gYXdhaXQgdGhpcy5wbHVnaW4udGVzdF9hcGlfa2V5KCk7XG4gICAgICBpZihyZXNwKSB7XG4gICAgICAgIG5ldyBPYnNpZGlhbi5Ob3RpY2UoXCJTbWFydCBDb25uZWN0aW9uczogQVBJIGtleSBpcyB2YWxpZFwiKTtcbiAgICAgIH1lbHNle1xuICAgICAgICBuZXcgT2JzaWRpYW4uTm90aWNlKFwiU21hcnQgQ29ubmVjdGlvbnM6IEFQSSBrZXkgaXMgbm90IHdvcmtpbmcgYXMgZXhwZWN0ZWQhXCIpO1xuICAgICAgfVxuICAgIH0pKTtcbiAgICAvLyBhZGQgZHJvcGRvd24gdG8gc2VsZWN0IHRoZSBtb2RlbFxuICAgIG5ldyBPYnNpZGlhbi5TZXR0aW5nKGNvbnRhaW5lckVsKS5zZXROYW1lKFwiU21hcnQgQ2hhdCBNb2RlbFwiKS5zZXREZXNjKFwiU2VsZWN0IGEgbW9kZWwgdG8gdXNlIHdpdGggU21hcnQgQ2hhdC5cIikuYWRkRHJvcGRvd24oKGRyb3Bkb3duKSA9PiB7XG4gICAgICBkcm9wZG93bi5hZGRPcHRpb24oXCJncHQtMy41LXR1cmJvLTE2a1wiLCBcImdwdC0zLjUtdHVyYm8tMTZrXCIpO1xuICAgICAgZHJvcGRvd24uYWRkT3B0aW9uKFwiZ3B0LTRcIiwgXCJncHQtNCAobGltaXRlZCBhY2Nlc3MsIDhrKVwiKTtcbiAgICAgIGRyb3Bkb3duLmFkZE9wdGlvbihcImdwdC0zLjUtdHVyYm9cIiwgXCJncHQtMy41LXR1cmJvICg0aylcIik7XG4gICAgICBkcm9wZG93bi5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcbiAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3Muc21hcnRfY2hhdF9tb2RlbCA9IHZhbHVlO1xuICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcbiAgICAgIH0pO1xuICAgICAgZHJvcGRvd24uc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3Muc21hcnRfY2hhdF9tb2RlbCk7XG4gICAgfSk7XG4gICAgLy8gbGFuZ3VhZ2VcbiAgICBuZXcgT2JzaWRpYW4uU2V0dGluZyhjb250YWluZXJFbCkuc2V0TmFtZShcIkRlZmF1bHQgTGFuZ3VhZ2VcIikuc2V0RGVzYyhcIkRlZmF1bHQgbGFuZ3VhZ2UgdG8gdXNlIGZvciBTbWFydCBDaGF0LiBDaGFuZ2VzIHdoaWNoIHNlbGYtcmVmZXJlbnRpYWwgcHJvbm91bnMgd2lsbCB0cmlnZ2VyIGxvb2t1cCBvZiB5b3VyIG5vdGVzLlwiKS5hZGREcm9wZG93bigoZHJvcGRvd24pID0+IHtcbiAgICAgIC8vIGdldCBPYmplY3Qga2V5cyBmcm9tIHByb25vdXNcbiAgICAgIGNvbnN0IGxhbmd1YWdlcyA9IE9iamVjdC5rZXlzKFNNQVJUX1RSQU5TTEFUSU9OKTtcbiAgICAgIGZvcihsZXQgaSA9IDA7IGkgPCBsYW5ndWFnZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgZHJvcGRvd24uYWRkT3B0aW9uKGxhbmd1YWdlc1tpXSwgbGFuZ3VhZ2VzW2ldKTtcbiAgICAgIH1cbiAgICAgIGRyb3Bkb3duLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5sYW5ndWFnZSA9IHZhbHVlO1xuICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcbiAgICAgICAgc2VsZl9yZWZfcHJvbm91bnNfbGlzdC5zZXRUZXh0KHRoaXMuZ2V0X3NlbGZfcmVmX2xpc3QoKSk7XG4gICAgICAgIC8vIGlmIGNoYXQgdmlldyBpcyBvcGVuIHRoZW4gcnVuIG5ld19jaGF0KClcbiAgICAgICAgY29uc3QgY2hhdF92aWV3ID0gdGhpcy5hcHAud29ya3NwYWNlLmdldExlYXZlc09mVHlwZShTTUFSVF9DT05ORUNUSU9OU19DSEFUX1ZJRVdfVFlQRSkubGVuZ3RoID4gMCA/IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRMZWF2ZXNPZlR5cGUoU01BUlRfQ09OTkVDVElPTlNfQ0hBVF9WSUVXX1RZUEUpWzBdLnZpZXcgOiBudWxsO1xuICAgICAgICBpZihjaGF0X3ZpZXcpIHtcbiAgICAgICAgICBjaGF0X3ZpZXcubmV3X2NoYXQoKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgICBkcm9wZG93bi5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5sYW5ndWFnZSk7XG4gICAgfSk7XG4gICAgLy8gbGlzdCBjdXJyZW50IHNlbGYtcmVmZXJlbnRpYWwgcHJvbm91bnNcbiAgICBjb25zdCBzZWxmX3JlZl9wcm9ub3Vuc19saXN0ID0gY29udGFpbmVyRWwuY3JlYXRlRWwoXCJzcGFuXCIsIHtcbiAgICAgIHRleHQ6IHRoaXMuZ2V0X3NlbGZfcmVmX2xpc3QoKVxuICAgIH0pO1xuICAgIGNvbnRhaW5lckVsLmNyZWF0ZUVsKFwiaDJcIiwge1xuICAgICAgdGV4dDogXCJFeGNsdXNpb25zXCJcbiAgICB9KTtcbiAgICAvLyBsaXN0IGZpbGUgZXhjbHVzaW9uc1xuICAgIG5ldyBPYnNpZGlhbi5TZXR0aW5nKGNvbnRhaW5lckVsKS5zZXROYW1lKFwiZmlsZV9leGNsdXNpb25zXCIpLnNldERlc2MoXCInRXhjbHVkZWQgZmlsZScgbWF0Y2hlcnMgc2VwYXJhdGVkIGJ5IGEgY29tbWEuXCIpLmFkZFRleHQoKHRleHQpID0+IHRleHQuc2V0UGxhY2Vob2xkZXIoXCJkcmF3aW5ncyxwcm9tcHRzL2xvZ3NcIikuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MuZmlsZV9leGNsdXNpb25zKS5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcbiAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLmZpbGVfZXhjbHVzaW9ucyA9IHZhbHVlO1xuICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG4gICAgfSkpO1xuICAgIC8vIGxpc3QgZm9sZGVyIGV4Y2x1c2lvbnNcbiAgICBuZXcgT2JzaWRpYW4uU2V0dGluZyhjb250YWluZXJFbCkuc2V0TmFtZShcImZvbGRlcl9leGNsdXNpb25zXCIpLnNldERlc2MoXCInRXhjbHVkZWQgZm9sZGVyJyBtYXRjaGVycyBzZXBhcmF0ZWQgYnkgYSBjb21tYS5cIikuYWRkVGV4dCgodGV4dCkgPT4gdGV4dC5zZXRQbGFjZWhvbGRlcihcImRyYXdpbmdzLHByb21wdHMvbG9nc1wiKS5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5mb2xkZXJfZXhjbHVzaW9ucykub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG4gICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5mb2xkZXJfZXhjbHVzaW9ucyA9IHZhbHVlO1xuICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG4gICAgfSkpO1xuICAgIC8vIGxpc3QgcGF0aCBvbmx5IG1hdGNoZXJzXG4gICAgbmV3IE9ic2lkaWFuLlNldHRpbmcoY29udGFpbmVyRWwpLnNldE5hbWUoXCJwYXRoX29ubHlcIikuc2V0RGVzYyhcIidQYXRoIG9ubHknIG1hdGNoZXJzIHNlcGFyYXRlZCBieSBhIGNvbW1hLlwiKS5hZGRUZXh0KCh0ZXh0KSA9PiB0ZXh0LnNldFBsYWNlaG9sZGVyKFwiZHJhd2luZ3MscHJvbXB0cy9sb2dzXCIpLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLnBhdGhfb25seSkub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG4gICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5wYXRoX29ubHkgPSB2YWx1ZTtcbiAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuICAgIH0pKTtcbiAgICAvLyBsaXN0IGhlYWRlciBleGNsdXNpb25zXG4gICAgbmV3IE9ic2lkaWFuLlNldHRpbmcoY29udGFpbmVyRWwpLnNldE5hbWUoXCJoZWFkZXJfZXhjbHVzaW9uc1wiKS5zZXREZXNjKFwiJ0V4Y2x1ZGVkIGhlYWRlcicgbWF0Y2hlcnMgc2VwYXJhdGVkIGJ5IGEgY29tbWEuIFdvcmtzIGZvciAnYmxvY2tzJyBvbmx5LlwiKS5hZGRUZXh0KCh0ZXh0KSA9PiB0ZXh0LnNldFBsYWNlaG9sZGVyKFwiZHJhd2luZ3MscHJvbXB0cy9sb2dzXCIpLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmhlYWRlcl9leGNsdXNpb25zKS5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcbiAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLmhlYWRlcl9leGNsdXNpb25zID0gdmFsdWU7XG4gICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcbiAgICB9KSk7XG4gICAgY29udGFpbmVyRWwuY3JlYXRlRWwoXCJoMlwiLCB7XG4gICAgICB0ZXh0OiBcIkRpc3BsYXlcIlxuICAgIH0pO1xuICAgIC8vIHRvZ2dsZSBzaG93aW5nIGZ1bGwgcGF0aCBpbiB2aWV3XG4gICAgbmV3IE9ic2lkaWFuLlNldHRpbmcoY29udGFpbmVyRWwpLnNldE5hbWUoXCJzaG93X2Z1bGxfcGF0aFwiKS5zZXREZXNjKFwiU2hvdyBmdWxsIHBhdGggaW4gdmlldy5cIikuYWRkVG9nZ2xlKCh0b2dnbGUpID0+IHRvZ2dsZS5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5zaG93X2Z1bGxfcGF0aCkub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG4gICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5zaG93X2Z1bGxfcGF0aCA9IHZhbHVlO1xuICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKHRydWUpO1xuICAgIH0pKTtcbiAgICAvLyB0b2dnbGUgZXhwYW5kZWQgdmlldyBieSBkZWZhdWx0XG4gICAgbmV3IE9ic2lkaWFuLlNldHRpbmcoY29udGFpbmVyRWwpLnNldE5hbWUoXCJleHBhbmRlZF92aWV3XCIpLnNldERlc2MoXCJFeHBhbmRlZCB2aWV3IGJ5IGRlZmF1bHQuXCIpLmFkZFRvZ2dsZSgodG9nZ2xlKSA9PiB0b2dnbGUuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MuZXhwYW5kZWRfdmlldykub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG4gICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5leHBhbmRlZF92aWV3ID0gdmFsdWU7XG4gICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3ModHJ1ZSk7XG4gICAgfSkpO1xuICAgIC8vIHRvZ2dsZSBncm91cCBuZWFyZXN0IGJ5IGZpbGVcbiAgICBuZXcgT2JzaWRpYW4uU2V0dGluZyhjb250YWluZXJFbCkuc2V0TmFtZShcImdyb3VwX25lYXJlc3RfYnlfZmlsZVwiKS5zZXREZXNjKFwiR3JvdXAgbmVhcmVzdCBieSBmaWxlLlwiKS5hZGRUb2dnbGUoKHRvZ2dsZSkgPT4gdG9nZ2xlLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmdyb3VwX25lYXJlc3RfYnlfZmlsZSkub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG4gICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5ncm91cF9uZWFyZXN0X2J5X2ZpbGUgPSB2YWx1ZTtcbiAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncyh0cnVlKTtcbiAgICB9KSk7XG4gICAgLy8gdG9nZ2xlIHZpZXdfb3BlbiBvbiBPYnNpZGlhbiBzdGFydHVwXG4gICAgbmV3IE9ic2lkaWFuLlNldHRpbmcoY29udGFpbmVyRWwpLnNldE5hbWUoXCJ2aWV3X29wZW5cIikuc2V0RGVzYyhcIk9wZW4gdmlldyBvbiBPYnNpZGlhbiBzdGFydHVwLlwiKS5hZGRUb2dnbGUoKHRvZ2dsZSkgPT4gdG9nZ2xlLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLnZpZXdfb3Blbikub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG4gICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy52aWV3X29wZW4gPSB2YWx1ZTtcbiAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncyh0cnVlKTtcbiAgICB9KSk7XG4gICAgLy8gdG9nZ2xlIGNoYXRfb3BlbiBvbiBPYnNpZGlhbiBzdGFydHVwXG4gICAgbmV3IE9ic2lkaWFuLlNldHRpbmcoY29udGFpbmVyRWwpLnNldE5hbWUoXCJjaGF0X29wZW5cIikuc2V0RGVzYyhcIk9wZW4gdmlldyBvbiBPYnNpZGlhbiBzdGFydHVwLlwiKS5hZGRUb2dnbGUoKHRvZ2dsZSkgPT4gdG9nZ2xlLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmNoYXRfb3Blbikub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG4gICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5jaGF0X29wZW4gPSB2YWx1ZTtcbiAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncyh0cnVlKTtcbiAgICB9KSk7XG4gICAgY29udGFpbmVyRWwuY3JlYXRlRWwoXCJoMlwiLCB7XG4gICAgICB0ZXh0OiBcIkFkdmFuY2VkXCJcbiAgICB9KTtcbiAgICAvLyB0b2dnbGUgbG9nX3JlbmRlclxuICAgIG5ldyBPYnNpZGlhbi5TZXR0aW5nKGNvbnRhaW5lckVsKS5zZXROYW1lKFwibG9nX3JlbmRlclwiKS5zZXREZXNjKFwiTG9nIHJlbmRlciBkZXRhaWxzIHRvIGNvbnNvbGUgKGluY2x1ZGVzIHRva2VuX3VzYWdlKS5cIikuYWRkVG9nZ2xlKCh0b2dnbGUpID0+IHRvZ2dsZS5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5sb2dfcmVuZGVyKS5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcbiAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLmxvZ19yZW5kZXIgPSB2YWx1ZTtcbiAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncyh0cnVlKTtcbiAgICB9KSk7XG4gICAgLy8gdG9nZ2xlIGZpbGVzIGluIGxvZ19yZW5kZXJcbiAgICBuZXcgT2JzaWRpYW4uU2V0dGluZyhjb250YWluZXJFbCkuc2V0TmFtZShcImxvZ19yZW5kZXJfZmlsZXNcIikuc2V0RGVzYyhcIkxvZyBlbWJlZGRlZCBvYmplY3RzIHBhdGhzIHdpdGggbG9nIHJlbmRlciAoZm9yIGRlYnVnZ2luZykuXCIpLmFkZFRvZ2dsZSgodG9nZ2xlKSA9PiB0b2dnbGUuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MubG9nX3JlbmRlcl9maWxlcykub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG4gICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5sb2dfcmVuZGVyX2ZpbGVzID0gdmFsdWU7XG4gICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3ModHJ1ZSk7XG4gICAgfSkpO1xuICAgIC8vIHRvZ2dsZSBza2lwX3NlY3Rpb25zXG4gICAgbmV3IE9ic2lkaWFuLlNldHRpbmcoY29udGFpbmVyRWwpLnNldE5hbWUoXCJza2lwX3NlY3Rpb25zXCIpLnNldERlc2MoXCJTa2lwcyBtYWtpbmcgY29ubmVjdGlvbnMgdG8gc3BlY2lmaWMgc2VjdGlvbnMgd2l0aGluIG5vdGVzLiBXYXJuaW5nOiByZWR1Y2VzIHVzZWZ1bG5lc3MgZm9yIGxhcmdlIGZpbGVzIGFuZCByZXF1aXJlcyAnRm9yY2UgUmVmcmVzaCcgZm9yIHNlY3Rpb25zIHRvIHdvcmsgaW4gdGhlIGZ1dHVyZS5cIikuYWRkVG9nZ2xlKCh0b2dnbGUpID0+IHRvZ2dsZS5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5za2lwX3NlY3Rpb25zKS5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcbiAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLnNraXBfc2VjdGlvbnMgPSB2YWx1ZTtcbiAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncyh0cnVlKTtcbiAgICB9KSk7XG4gICAgLy8gdGVzdCBmaWxlIHdyaXRpbmcgYnkgY3JlYXRpbmcgYSB0ZXN0IGZpbGUsIHRoZW4gd3JpdGluZyBhZGRpdGlvbmFsIGRhdGEgdG8gdGhlIGZpbGUsIGFuZCByZXR1cm5pbmcgYW55IGVycm9yIHRleHQgaWYgaXQgZmFpbHNcbiAgICBjb250YWluZXJFbC5jcmVhdGVFbChcImgzXCIsIHtcbiAgICAgIHRleHQ6IFwiVGVzdCBGaWxlIFdyaXRpbmdcIlxuICAgIH0pO1xuICAgIC8vIG1hbnVhbCBzYXZlIGJ1dHRvblxuICAgIGNvbnRhaW5lckVsLmNyZWF0ZUVsKFwiaDNcIiwge1xuICAgICAgdGV4dDogXCJNYW51YWwgU2F2ZVwiXG4gICAgfSk7XG4gICAgbGV0IG1hbnVhbF9zYXZlX3Jlc3VsdHMgPSBjb250YWluZXJFbC5jcmVhdGVFbChcImRpdlwiKTtcbiAgICBuZXcgT2JzaWRpYW4uU2V0dGluZyhjb250YWluZXJFbCkuc2V0TmFtZShcIm1hbnVhbF9zYXZlXCIpLnNldERlc2MoXCJTYXZlIGN1cnJlbnQgZW1iZWRkaW5nc1wiKS5hZGRCdXR0b24oKGJ1dHRvbikgPT4gYnV0dG9uLnNldEJ1dHRvblRleHQoXCJNYW51YWwgU2F2ZVwiKS5vbkNsaWNrKGFzeW5jICgpID0+IHtcbiAgICAgIC8vIGNvbmZpcm1cbiAgICAgIGlmIChjb25maXJtKFwiQXJlIHlvdSBzdXJlIHlvdSB3YW50IHRvIHNhdmUgeW91ciBjdXJyZW50IGVtYmVkZGluZ3M/XCIpKSB7XG4gICAgICAgIC8vIHNhdmVcbiAgICAgICAgdHJ5e1xuICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVfZW1iZWRkaW5nc190b19maWxlKHRydWUpO1xuICAgICAgICAgIG1hbnVhbF9zYXZlX3Jlc3VsdHMuaW5uZXJIVE1MID0gXCJFbWJlZGRpbmdzIHNhdmVkIHN1Y2Nlc3NmdWxseS5cIjtcbiAgICAgICAgfWNhdGNoKGUpe1xuICAgICAgICAgIG1hbnVhbF9zYXZlX3Jlc3VsdHMuaW5uZXJIVE1MID0gXCJFbWJlZGRpbmdzIGZhaWxlZCB0byBzYXZlLiBFcnJvcjogXCIgKyBlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSkpO1xuXG4gICAgLy8gbGlzdCBwcmV2aW91c2x5IGZhaWxlZCBmaWxlc1xuICAgIGNvbnRhaW5lckVsLmNyZWF0ZUVsKFwiaDNcIiwge1xuICAgICAgdGV4dDogXCJQcmV2aW91c2x5IGZhaWxlZCBmaWxlc1wiXG4gICAgfSk7XG4gICAgbGV0IGZhaWxlZF9saXN0ID0gY29udGFpbmVyRWwuY3JlYXRlRWwoXCJkaXZcIik7XG4gICAgdGhpcy5kcmF3X2ZhaWxlZF9maWxlc19saXN0KGZhaWxlZF9saXN0KTtcblxuICAgIC8vIGZvcmNlIHJlZnJlc2ggYnV0dG9uXG4gICAgY29udGFpbmVyRWwuY3JlYXRlRWwoXCJoM1wiLCB7XG4gICAgICB0ZXh0OiBcIkZvcmNlIFJlZnJlc2hcIlxuICAgIH0pO1xuICAgIG5ldyBPYnNpZGlhbi5TZXR0aW5nKGNvbnRhaW5lckVsKS5zZXROYW1lKFwiZm9yY2VfcmVmcmVzaFwiKS5zZXREZXNjKFwiV0FSTklORzogRE8gTk9UIHVzZSB1bmxlc3MgeW91IGtub3cgd2hhdCB5b3UgYXJlIGRvaW5nISBUaGlzIHdpbGwgZGVsZXRlIGFsbCBvZiB5b3VyIGN1cnJlbnQgZW1iZWRkaW5ncyBmcm9tIE9wZW5BSSBhbmQgdHJpZ2dlciByZXByb2Nlc3Npbmcgb2YgeW91ciBlbnRpcmUgdmF1bHQhXCIpLmFkZEJ1dHRvbigoYnV0dG9uKSA9PiBidXR0b24uc2V0QnV0dG9uVGV4dChcIkZvcmNlIFJlZnJlc2hcIikub25DbGljayhhc3luYyAoKSA9PiB7XG4gICAgICAvLyBjb25maXJtXG4gICAgICBpZiAoY29uZmlybShcIkFyZSB5b3Ugc3VyZSB5b3Ugd2FudCB0byBGb3JjZSBSZWZyZXNoPyBCeSBjbGlja2luZyB5ZXMgeW91IGNvbmZpcm0gdGhhdCB5b3UgdW5kZXJzdGFuZCB0aGUgY29uc2VxdWVuY2VzIG9mIHRoaXMgYWN0aW9uLlwiKSkge1xuICAgICAgICAvLyBmb3JjZSByZWZyZXNoXG4gICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLmZvcmNlX3JlZnJlc2hfZW1iZWRkaW5nc19maWxlKCk7XG4gICAgICB9XG4gICAgfSkpO1xuXG4gIH1cbiAgZ2V0X3NlbGZfcmVmX2xpc3QoKSB7XG4gICAgcmV0dXJuIFwiQ3VycmVudDogXCIgKyBTTUFSVF9UUkFOU0xBVElPTlt0aGlzLnBsdWdpbi5zZXR0aW5ncy5sYW5ndWFnZV0ucHJvbm91cy5qb2luKFwiLCBcIik7XG4gIH1cblxuICBkcmF3X2ZhaWxlZF9maWxlc19saXN0KGZhaWxlZF9saXN0KSB7XG4gICAgZmFpbGVkX2xpc3QuZW1wdHkoKTtcbiAgICBpZih0aGlzLnBsdWdpbi5zZXR0aW5ncy5mYWlsZWRfZmlsZXMubGVuZ3RoID4gMCkge1xuICAgICAgLy8gYWRkIG1lc3NhZ2UgdGhhdCB0aGVzZSBmaWxlcyB3aWxsIGJlIHNraXBwZWQgdW50aWwgbWFudWFsbHkgcmV0cmllZFxuICAgICAgZmFpbGVkX2xpc3QuY3JlYXRlRWwoXCJwXCIsIHtcbiAgICAgICAgdGV4dDogXCJUaGUgZm9sbG93aW5nIGZpbGVzIGZhaWxlZCB0byBwcm9jZXNzIGFuZCB3aWxsIGJlIHNraXBwZWQgdW50aWwgbWFudWFsbHkgcmV0cmllZC5cIlxuICAgICAgfSk7XG4gICAgICBsZXQgbGlzdCA9IGZhaWxlZF9saXN0LmNyZWF0ZUVsKFwidWxcIik7XG4gICAgICBmb3IgKGxldCBmYWlsZWRfZmlsZSBvZiB0aGlzLnBsdWdpbi5zZXR0aW5ncy5mYWlsZWRfZmlsZXMpIHtcbiAgICAgICAgbGlzdC5jcmVhdGVFbChcImxpXCIsIHtcbiAgICAgICAgICB0ZXh0OiBmYWlsZWRfZmlsZVxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICAgIC8vIGFkZCBidXR0b24gdG8gcmV0cnkgZmFpbGVkIGZpbGVzIG9ubHlcbiAgICAgIG5ldyBPYnNpZGlhbi5TZXR0aW5nKGZhaWxlZF9saXN0KS5zZXROYW1lKFwicmV0cnlfZmFpbGVkX2ZpbGVzXCIpLnNldERlc2MoXCJSZXRyeSBmYWlsZWQgZmlsZXMgb25seVwiKS5hZGRCdXR0b24oKGJ1dHRvbikgPT4gYnV0dG9uLnNldEJ1dHRvblRleHQoXCJSZXRyeSBmYWlsZWQgZmlsZXMgb25seVwiKS5vbkNsaWNrKGFzeW5jICgpID0+IHtcbiAgICAgICAgLy8gY2xlYXIgZmFpbGVkX2xpc3QgZWxlbWVudFxuICAgICAgICBmYWlsZWRfbGlzdC5lbXB0eSgpO1xuICAgICAgICAvLyBzZXQgXCJyZXRyeWluZ1wiIHRleHRcbiAgICAgICAgZmFpbGVkX2xpc3QuY3JlYXRlRWwoXCJwXCIsIHtcbiAgICAgICAgICB0ZXh0OiBcIlJldHJ5aW5nIGZhaWxlZCBmaWxlcy4uLlwiXG4gICAgICAgIH0pO1xuICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5yZXRyeV9mYWlsZWRfZmlsZXMoKTtcbiAgICAgICAgLy8gcmVkcmF3IGZhaWxlZCBmaWxlcyBsaXN0XG4gICAgICAgIHRoaXMuZHJhd19mYWlsZWRfZmlsZXNfbGlzdChmYWlsZWRfbGlzdCk7XG4gICAgICB9KSk7XG4gICAgfWVsc2V7XG4gICAgICBmYWlsZWRfbGlzdC5jcmVhdGVFbChcInBcIiwge1xuICAgICAgICB0ZXh0OiBcIk5vIGZhaWxlZCBmaWxlc1wiXG4gICAgICB9KTtcbiAgICB9XG4gIH1cbn1cblxuZnVuY3Rpb24gbGluZV9pc19oZWFkaW5nKGxpbmUpIHtcbiAgcmV0dXJuIChsaW5lLmluZGV4T2YoXCIjXCIpID09PSAwKSAmJiAoWycjJywgJyAnXS5pbmRleE9mKGxpbmVbMV0pICE9PSAtMSk7XG59XG5cbmNvbnN0IFNNQVJUX0NPTk5FQ1RJT05TX0NIQVRfVklFV19UWVBFID0gXCJzbWFydC1jb25uZWN0aW9ucy1jaGF0LXZpZXdcIjtcblxuY2xhc3MgU21hcnRDb25uZWN0aW9uc0NoYXRWaWV3IGV4dGVuZHMgT2JzaWRpYW4uSXRlbVZpZXcge1xuICBjb25zdHJ1Y3RvcihsZWFmLCBwbHVnaW4pIHtcbiAgICBzdXBlcihsZWFmKTtcbiAgICB0aGlzLnBsdWdpbiA9IHBsdWdpbjtcbiAgICB0aGlzLmFjdGl2ZV9lbG0gPSBudWxsO1xuICAgIHRoaXMuYWN0aXZlX3N0cmVhbSA9IG51bGw7XG4gICAgdGhpcy5icmFja2V0c19jdCA9IDA7XG4gICAgdGhpcy5jaGF0ID0gbnVsbDtcbiAgICB0aGlzLmNoYXRfYm94ID0gbnVsbDtcbiAgICB0aGlzLmNoYXRfY29udGFpbmVyID0gbnVsbDtcbiAgICB0aGlzLmN1cnJlbnRfY2hhdF9tbCA9IFtdO1xuICAgIHRoaXMuZmlsZXMgPSBbXTtcbiAgICB0aGlzLmxhc3RfZnJvbSA9IG51bGw7XG4gICAgdGhpcy5tZXNzYWdlX2NvbnRhaW5lciA9IG51bGw7XG4gICAgdGhpcy5wcmV2ZW50X2lucHV0ID0gZmFsc2U7XG4gIH1cbiAgZ2V0RGlzcGxheVRleHQoKSB7XG4gICAgcmV0dXJuIFwiU21hcnQgQ29ubmVjdGlvbnMgQ2hhdFwiO1xuICB9XG4gIGdldEljb24oKSB7XG4gICAgcmV0dXJuIFwibWVzc2FnZS1zcXVhcmVcIjtcbiAgfVxuICBnZXRWaWV3VHlwZSgpIHtcbiAgICByZXR1cm4gU01BUlRfQ09OTkVDVElPTlNfQ0hBVF9WSUVXX1RZUEU7XG4gIH1cbiAgb25PcGVuKCkge1xuICAgIHRoaXMubmV3X2NoYXQoKTtcbiAgICB0aGlzLnBsdWdpbi5nZXRfYWxsX2ZvbGRlcnMoKTsgLy8gc2V0cyB0aGlzLnBsdWdpbi5mb2xkZXJzIG5lY2Vzc2FyeSBmb3IgZm9sZGVyLWNvbnRleHRcbiAgfVxuICBvbkNsb3NlKCkge1xuICAgIHRoaXMuY2hhdC5zYXZlX2NoYXQoKTtcbiAgICB0aGlzLmFwcC53b3Jrc3BhY2UudW5yZWdpc3RlckhvdmVyTGlua1NvdXJjZShTTUFSVF9DT05ORUNUSU9OU19DSEFUX1ZJRVdfVFlQRSk7XG4gIH1cbiAgcmVuZGVyX2NoYXQoKSB7XG4gICAgdGhpcy5jb250YWluZXJFbC5lbXB0eSgpO1xuICAgIHRoaXMuY2hhdF9jb250YWluZXIgPSB0aGlzLmNvbnRhaW5lckVsLmNyZWF0ZURpdihcInNjLWNoYXQtY29udGFpbmVyXCIpO1xuICAgIC8vIHJlbmRlciBwbHVzIHNpZ24gZm9yIGNsZWFyIGJ1dHRvblxuICAgIHRoaXMucmVuZGVyX3RvcF9iYXIoKTtcbiAgICAvLyByZW5kZXIgY2hhdCBtZXNzYWdlcyBjb250YWluZXJcbiAgICB0aGlzLnJlbmRlcl9jaGF0X2JveCgpO1xuICAgIC8vIHJlbmRlciBjaGF0IGlucHV0XG4gICAgdGhpcy5yZW5kZXJfY2hhdF9pbnB1dCgpO1xuICAgIHRoaXMucGx1Z2luLnJlbmRlcl9icmFuZCh0aGlzLmNvbnRhaW5lckVsLCBcImNoYXRcIik7XG4gIH1cbiAgLy8gcmVuZGVyIHBsdXMgc2lnbiBmb3IgY2xlYXIgYnV0dG9uXG4gIHJlbmRlcl90b3BfYmFyKCkge1xuICAgIC8vIGNyZWF0ZSBjb250YWluZXIgZm9yIGNsZWFyIGJ1dHRvblxuICAgIGxldCB0b3BfYmFyX2NvbnRhaW5lciA9IHRoaXMuY2hhdF9jb250YWluZXIuY3JlYXRlRGl2KFwic2MtdG9wLWJhci1jb250YWluZXJcIik7XG4gICAgLy8gcmVuZGVyIHRoZSBuYW1lIG9mIHRoZSBjaGF0IGluIGFuIGlucHV0IGJveCAocG9wIGNvbnRlbnQgYWZ0ZXIgbGFzdCBoeXBoZW4gaW4gY2hhdF9pZClcbiAgICBsZXQgY2hhdF9uYW1lID10aGlzLmNoYXQubmFtZSgpO1xuICAgIGxldCBjaGF0X25hbWVfaW5wdXQgPSB0b3BfYmFyX2NvbnRhaW5lci5jcmVhdGVFbChcImlucHV0XCIsIHtcbiAgICAgIGF0dHI6IHtcbiAgICAgICAgdHlwZTogXCJ0ZXh0XCIsXG4gICAgICAgIHZhbHVlOiBjaGF0X25hbWVcbiAgICAgIH0sXG4gICAgICBjbHM6IFwic2MtY2hhdC1uYW1lLWlucHV0XCJcbiAgICB9KTtcbiAgICBjaGF0X25hbWVfaW5wdXQuYWRkRXZlbnRMaXN0ZW5lcihcImNoYW5nZVwiLCB0aGlzLnJlbmFtZV9jaGF0LmJpbmQodGhpcykpO1xuICAgIFxuICAgIC8vIGNyZWF0ZSBidXR0b24gdG8gU21hcnQgVmlld1xuICAgIGxldCBzbWFydF92aWV3X2J0biA9IHRoaXMuY3JlYXRlX3RvcF9iYXJfYnV0dG9uKHRvcF9iYXJfY29udGFpbmVyLCBcIlNtYXJ0IFZpZXdcIiwgXCJzbWFydC1jb25uZWN0aW9uc1wiKTtcbiAgICBzbWFydF92aWV3X2J0bi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgdGhpcy5vcGVuX3NtYXJ0X3ZpZXcuYmluZCh0aGlzKSk7XG4gICAgLy8gY3JlYXRlIGJ1dHRvbiB0byBzYXZlIGNoYXRcbiAgICBsZXQgc2F2ZV9idG4gPSB0aGlzLmNyZWF0ZV90b3BfYmFyX2J1dHRvbih0b3BfYmFyX2NvbnRhaW5lciwgXCJTYXZlIENoYXRcIiwgXCJzYXZlXCIpO1xuICAgIHNhdmVfYnRuLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCB0aGlzLnNhdmVfY2hhdC5iaW5kKHRoaXMpKTtcbiAgICAvLyBjcmVhdGUgYnV0dG9uIHRvIG9wZW4gY2hhdCBoaXN0b3J5IG1vZGFsXG4gICAgbGV0IGhpc3RvcnlfYnRuID0gdGhpcy5jcmVhdGVfdG9wX2Jhcl9idXR0b24odG9wX2Jhcl9jb250YWluZXIsIFwiQ2hhdCBIaXN0b3J5XCIsIFwiaGlzdG9yeVwiKTtcbiAgICBoaXN0b3J5X2J0bi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgdGhpcy5vcGVuX2NoYXRfaGlzdG9yeS5iaW5kKHRoaXMpKTtcbiAgICAvLyBjcmVhdGUgYnV0dG9uIHRvIHN0YXJ0IG5ldyBjaGF0XG4gICAgY29uc3QgbmV3X2NoYXRfYnRuID0gdGhpcy5jcmVhdGVfdG9wX2Jhcl9idXR0b24odG9wX2Jhcl9jb250YWluZXIsIFwiTmV3IENoYXRcIiwgXCJwbHVzXCIpO1xuICAgIG5ld19jaGF0X2J0bi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgdGhpcy5uZXdfY2hhdC5iaW5kKHRoaXMpKTtcbiAgfVxuICBhc3luYyBvcGVuX2NoYXRfaGlzdG9yeSgpIHtcbiAgICBjb25zdCBmb2xkZXIgPSBhd2FpdCB0aGlzLmFwcC52YXVsdC5hZGFwdGVyLmxpc3QoXCIuc21hcnQtY29ubmVjdGlvbnMvY2hhdHNcIik7XG4gICAgdGhpcy5maWxlcyA9IGZvbGRlci5maWxlcy5tYXAoKGZpbGUpID0+IHtcbiAgICAgIHJldHVybiBmaWxlLnJlcGxhY2UoXCIuc21hcnQtY29ubmVjdGlvbnMvY2hhdHMvXCIsIFwiXCIpLnJlcGxhY2UoXCIuanNvblwiLCBcIlwiKTtcbiAgICB9KTtcbiAgICAvLyBvcGVuIGNoYXQgaGlzdG9yeSBtb2RhbFxuICAgIGlmICghdGhpcy5tb2RhbClcbiAgICAgIHRoaXMubW9kYWwgPSBuZXcgU21hcnRDb25uZWN0aW9uc0NoYXRIaXN0b3J5TW9kYWwodGhpcy5hcHAsIHRoaXMpO1xuICAgIHRoaXMubW9kYWwub3BlbigpO1xuICB9XG5cbiAgY3JlYXRlX3RvcF9iYXJfYnV0dG9uKHRvcF9iYXJfY29udGFpbmVyLCB0aXRsZSwgaWNvbj1udWxsKSB7XG4gICAgbGV0IGJ0biA9IHRvcF9iYXJfY29udGFpbmVyLmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHtcbiAgICAgIGF0dHI6IHtcbiAgICAgICAgdGl0bGU6IHRpdGxlXG4gICAgICB9XG4gICAgfSk7XG4gICAgaWYoaWNvbil7XG4gICAgICBPYnNpZGlhbi5zZXRJY29uKGJ0biwgaWNvbik7XG4gICAgfWVsc2V7XG4gICAgICBidG4uaW5uZXJIVE1MID0gdGl0bGU7XG4gICAgfVxuICAgIHJldHVybiBidG47XG4gIH1cbiAgLy8gcmVuZGVyIG5ldyBjaGF0XG4gIG5ld19jaGF0KCkge1xuICAgIHRoaXMuY2xlYXJfY2hhdCgpO1xuICAgIHRoaXMucmVuZGVyX2NoYXQoKTtcbiAgICAvLyByZW5kZXIgaW5pdGlhbCBtZXNzYWdlIGZyb20gYXNzaXN0YW50IChkb24ndCB1c2UgcmVuZGVyX21lc3NhZ2UgdG8gc2tpcCBhZGRpbmcgdG8gY2hhdCBoaXN0b3J5KVxuICAgIHRoaXMubmV3X21lc3NzYWdlX2J1YmJsZShcImFzc2lzdGFudFwiKTtcbiAgICB0aGlzLmFjdGl2ZV9lbG0uaW5uZXJIVE1MID0gJzxwPicgKyBTTUFSVF9UUkFOU0xBVElPTlt0aGlzLnBsdWdpbi5zZXR0aW5ncy5sYW5ndWFnZV0uaW5pdGlhbF9tZXNzYWdlKyc8L3A+JztcbiAgfVxuICAvLyBvcGVuIGEgY2hhdCBmcm9tIHRoZSBjaGF0IGhpc3RvcnkgbW9kYWxcbiAgYXN5bmMgb3Blbl9jaGF0KGNoYXRfaWQpIHtcbiAgICB0aGlzLmNsZWFyX2NoYXQoKTtcbiAgICBhd2FpdCB0aGlzLmNoYXQubG9hZF9jaGF0KGNoYXRfaWQpO1xuICAgIHRoaXMucmVuZGVyX2NoYXQoKTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuY2hhdC5jaGF0X21sLmxlbmd0aDsgaSsrKSB7XG4gICAgICBhd2FpdCB0aGlzLnJlbmRlcl9tZXNzYWdlKHRoaXMuY2hhdC5jaGF0X21sW2ldLmNvbnRlbnQsIHRoaXMuY2hhdC5jaGF0X21sW2ldLnJvbGUpO1xuICAgIH1cbiAgfVxuICAvLyBjbGVhciBjdXJyZW50IGNoYXQgc3RhdGVcbiAgY2xlYXJfY2hhdCgpIHtcbiAgICBpZiAodGhpcy5jaGF0KSB7XG4gICAgICB0aGlzLmNoYXQuc2F2ZV9jaGF0KCk7XG4gICAgfVxuICAgIHRoaXMuY2hhdCA9IG5ldyBTbWFydENvbm5lY3Rpb25zQ2hhdE1vZGVsKHRoaXMucGx1Z2luKTtcbiAgICAvLyBpZiB0aGlzLmRvdGRvdGRvdF9pbnRlcnZhbCBpcyBub3QgbnVsbCwgY2xlYXIgaW50ZXJ2YWxcbiAgICBpZiAodGhpcy5kb3Rkb3Rkb3RfaW50ZXJ2YWwpIHtcbiAgICAgIGNsZWFySW50ZXJ2YWwodGhpcy5kb3Rkb3Rkb3RfaW50ZXJ2YWwpO1xuICAgIH1cbiAgICAvLyBjbGVhciBjdXJyZW50IGNoYXQgbWxcbiAgICB0aGlzLmN1cnJlbnRfY2hhdF9tbCA9IFtdO1xuICAgIC8vIHVwZGF0ZSBwcmV2ZW50IGlucHV0XG4gICAgdGhpcy5lbmRfc3RyZWFtKCk7XG4gIH1cblxuICByZW5hbWVfY2hhdChldmVudCkge1xuICAgIGxldCBuZXdfY2hhdF9uYW1lID0gZXZlbnQudGFyZ2V0LnZhbHVlO1xuICAgIHRoaXMuY2hhdC5yZW5hbWVfY2hhdChuZXdfY2hhdF9uYW1lKTtcbiAgfVxuICBcbiAgLy8gc2F2ZSBjdXJyZW50IGNoYXRcbiAgc2F2ZV9jaGF0KCkge1xuICAgIHRoaXMuY2hhdC5zYXZlX2NoYXQoKTtcbiAgICBuZXcgT2JzaWRpYW4uTm90aWNlKFwiW1NtYXJ0IENvbm5lY3Rpb25zXSBDaGF0IHNhdmVkXCIpO1xuICB9XG4gIFxuICBvcGVuX3NtYXJ0X3ZpZXcoKSB7XG4gICAgdGhpcy5wbHVnaW4ub3Blbl92aWV3KCk7XG4gIH1cbiAgLy8gcmVuZGVyIGNoYXQgbWVzc2FnZXMgY29udGFpbmVyXG4gIHJlbmRlcl9jaGF0X2JveCgpIHtcbiAgICAvLyBjcmVhdGUgY29udGFpbmVyIGZvciBjaGF0IG1lc3NhZ2VzXG4gICAgdGhpcy5jaGF0X2JveCA9IHRoaXMuY2hhdF9jb250YWluZXIuY3JlYXRlRGl2KFwic2MtY2hhdC1ib3hcIik7XG4gICAgLy8gY3JlYXRlIGNvbnRhaW5lciBmb3IgbWVzc2FnZVxuICAgIHRoaXMubWVzc2FnZV9jb250YWluZXIgPSB0aGlzLmNoYXRfYm94LmNyZWF0ZURpdihcInNjLW1lc3NhZ2UtY29udGFpbmVyXCIpO1xuICB9XG4gIC8vIG9wZW4gZmlsZSBzdWdnZXN0aW9uIG1vZGFsXG4gIG9wZW5fZmlsZV9zdWdnZXN0aW9uX21vZGFsKCkge1xuICAgIC8vIG9wZW4gZmlsZSBzdWdnZXN0aW9uIG1vZGFsXG4gICAgaWYoIXRoaXMuZmlsZV9zZWxlY3RvcikgdGhpcy5maWxlX3NlbGVjdG9yID0gbmV3IFNtYXJ0Q29ubmVjdGlvbnNGaWxlU2VsZWN0TW9kYWwodGhpcy5hcHAsIHRoaXMpO1xuICAgIHRoaXMuZmlsZV9zZWxlY3Rvci5vcGVuKCk7XG4gIH1cbiAgLy8gb3BlbiBmb2xkZXIgc3VnZ2VzdGlvbiBtb2RhbFxuICBhc3luYyBvcGVuX2ZvbGRlcl9zdWdnZXN0aW9uX21vZGFsKCkge1xuICAgIC8vIG9wZW4gZm9sZGVyIHN1Z2dlc3Rpb24gbW9kYWxcbiAgICBpZighdGhpcy5mb2xkZXJfc2VsZWN0b3Ipe1xuICAgICAgdGhpcy5mb2xkZXJfc2VsZWN0b3IgPSBuZXcgU21hcnRDb25uZWN0aW9uc0ZvbGRlclNlbGVjdE1vZGFsKHRoaXMuYXBwLCB0aGlzKTtcbiAgICB9XG4gICAgdGhpcy5mb2xkZXJfc2VsZWN0b3Iub3BlbigpO1xuICB9XG4gIC8vIGluc2VydF9zZWxlY3Rpb24gZnJvbSBmaWxlIHN1Z2dlc3Rpb24gbW9kYWxcbiAgaW5zZXJ0X3NlbGVjdGlvbihpbnNlcnRfdGV4dCkge1xuICAgIC8vIGdldCBjYXJldCBwb3NpdGlvblxuICAgIGxldCBjYXJldF9wb3MgPSB0aGlzLnRleHRhcmVhLnNlbGVjdGlvblN0YXJ0O1xuICAgIC8vIGdldCB0ZXh0IGJlZm9yZSBjYXJldFxuICAgIGxldCB0ZXh0X2JlZm9yZSA9IHRoaXMudGV4dGFyZWEudmFsdWUuc3Vic3RyaW5nKDAsIGNhcmV0X3Bvcyk7XG4gICAgLy8gZ2V0IHRleHQgYWZ0ZXIgY2FyZXRcbiAgICBsZXQgdGV4dF9hZnRlciA9IHRoaXMudGV4dGFyZWEudmFsdWUuc3Vic3RyaW5nKGNhcmV0X3BvcywgdGhpcy50ZXh0YXJlYS52YWx1ZS5sZW5ndGgpO1xuICAgIC8vIGluc2VydCB0ZXh0XG4gICAgdGhpcy50ZXh0YXJlYS52YWx1ZSA9IHRleHRfYmVmb3JlICsgaW5zZXJ0X3RleHQgKyB0ZXh0X2FmdGVyO1xuICAgIC8vIHNldCBjYXJldCBwb3NpdGlvblxuICAgIHRoaXMudGV4dGFyZWEuc2VsZWN0aW9uU3RhcnQgPSBjYXJldF9wb3MgKyBpbnNlcnRfdGV4dC5sZW5ndGg7XG4gICAgdGhpcy50ZXh0YXJlYS5zZWxlY3Rpb25FbmQgPSBjYXJldF9wb3MgKyBpbnNlcnRfdGV4dC5sZW5ndGg7XG4gICAgLy8gZm9jdXMgb24gdGV4dGFyZWFcbiAgICB0aGlzLnRleHRhcmVhLmZvY3VzKCk7XG4gIH1cblxuICAvLyByZW5kZXIgY2hhdCB0ZXh0YXJlYSBhbmQgYnV0dG9uXG4gIHJlbmRlcl9jaGF0X2lucHV0KCkge1xuICAgIC8vIGNyZWF0ZSBjb250YWluZXIgZm9yIGNoYXQgaW5wdXRcbiAgICBsZXQgY2hhdF9pbnB1dCA9IHRoaXMuY2hhdF9jb250YWluZXIuY3JlYXRlRGl2KFwic2MtY2hhdC1mb3JtXCIpO1xuICAgIC8vIGNyZWF0ZSB0ZXh0YXJlYVxuICAgIHRoaXMudGV4dGFyZWEgPSBjaGF0X2lucHV0LmNyZWF0ZUVsKFwidGV4dGFyZWFcIiwge1xuICAgICAgY2xzOiBcInNjLWNoYXQtaW5wdXRcIixcbiAgICAgIGF0dHI6IHtcbiAgICAgICAgcGxhY2Vob2xkZXI6IGBUcnkgXCJCYXNlZCBvbiBteSBub3Rlc1wiIG9yIFwiU3VtbWFyaXplIFtbdGhpcyBub3RlXV1cIiBvciBcIkltcG9ydGFudCB0YXNrcyBpbiAvZm9sZGVyL1wiYFxuICAgICAgfVxuICAgIH0pO1xuICAgIC8vIHVzZSBjb250ZW50ZWRpdGFibGUgaW5zdGVhZCBvZiB0ZXh0YXJlYVxuICAgIC8vIHRoaXMudGV4dGFyZWEgPSBjaGF0X2lucHV0LmNyZWF0ZUVsKFwiZGl2XCIsIHtjbHM6IFwic2MtY2hhdC1pbnB1dFwiLCBhdHRyOiB7Y29udGVudGVkaXRhYmxlOiB0cnVlfX0pO1xuICAgIC8vIGFkZCBldmVudCBsaXN0ZW5lciB0byBsaXN0ZW4gZm9yIHNoaWZ0K2VudGVyXG4gICAgY2hhdF9pbnB1dC5hZGRFdmVudExpc3RlbmVyKFwia2V5dXBcIiwgKGUpID0+IHtcbiAgICAgIGlmKFtcIltcIiwgXCIvXCJdLmluZGV4T2YoZS5rZXkpID09PSAtMSkgcmV0dXJuOyAvLyBza2lwIGlmIGtleSBpcyBub3QgWyBvciAvXG4gICAgICBjb25zdCBjYXJldF9wb3MgPSB0aGlzLnRleHRhcmVhLnNlbGVjdGlvblN0YXJ0O1xuICAgICAgLy8gaWYga2V5IGlzIG9wZW4gc3F1YXJlIGJyYWNrZXRcbiAgICAgIGlmIChlLmtleSA9PT0gXCJbXCIpIHtcbiAgICAgICAgLy8gaWYgcHJldmlvdXMgY2hhciBpcyBbXG4gICAgICAgIGlmKHRoaXMudGV4dGFyZWEudmFsdWVbY2FyZXRfcG9zIC0gMl0gPT09IFwiW1wiKXtcbiAgICAgICAgICAvLyBvcGVuIGZpbGUgc3VnZ2VzdGlvbiBtb2RhbFxuICAgICAgICAgIHRoaXMub3Blbl9maWxlX3N1Z2dlc3Rpb25fbW9kYWwoKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgIH1lbHNle1xuICAgICAgICB0aGlzLmJyYWNrZXRzX2N0ID0gMDtcbiAgICAgIH1cbiAgICAgIC8vIGlmIC8gaXMgcHJlc3NlZFxuICAgICAgaWYgKGUua2V5ID09PSBcIi9cIikge1xuICAgICAgICAvLyBnZXQgY2FyZXQgcG9zaXRpb25cbiAgICAgICAgLy8gaWYgdGhpcyBpcyBmaXJzdCBjaGFyIG9yIHByZXZpb3VzIGNoYXIgaXMgc3BhY2VcbiAgICAgICAgaWYgKHRoaXMudGV4dGFyZWEudmFsdWUubGVuZ3RoID09PSAxIHx8IHRoaXMudGV4dGFyZWEudmFsdWVbY2FyZXRfcG9zIC0gMl0gPT09IFwiIFwiKSB7XG4gICAgICAgICAgLy8gb3BlbiBmb2xkZXIgc3VnZ2VzdGlvbiBtb2RhbFxuICAgICAgICAgIHRoaXMub3Blbl9mb2xkZXJfc3VnZ2VzdGlvbl9tb2RhbCgpO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgfSk7XG5cbiAgICBjaGF0X2lucHV0LmFkZEV2ZW50TGlzdGVuZXIoXCJrZXlkb3duXCIsIChlKSA9PiB7XG4gICAgICBpZiAoZS5rZXkgPT09IFwiRW50ZXJcIiAmJiBlLnNoaWZ0S2V5KSB7XG4gICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgaWYodGhpcy5wcmV2ZW50X2lucHV0KXtcbiAgICAgICAgICBjb25zb2xlLmxvZyhcIndhaXQgdW50aWwgY3VycmVudCByZXNwb25zZSBpcyBmaW5pc2hlZFwiKTtcbiAgICAgICAgICBuZXcgT2JzaWRpYW4uTm90aWNlKFwiW1NtYXJ0IENvbm5lY3Rpb25zXSBXYWl0IHVudGlsIGN1cnJlbnQgcmVzcG9uc2UgaXMgZmluaXNoZWRcIik7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIC8vIGdldCB0ZXh0IGZyb20gdGV4dGFyZWFcbiAgICAgICAgbGV0IHVzZXJfaW5wdXQgPSB0aGlzLnRleHRhcmVhLnZhbHVlO1xuICAgICAgICAvLyBjbGVhciB0ZXh0YXJlYVxuICAgICAgICB0aGlzLnRleHRhcmVhLnZhbHVlID0gXCJcIjtcbiAgICAgICAgLy8gaW5pdGlhdGUgcmVzcG9uc2UgZnJvbSBhc3Npc3RhbnRcbiAgICAgICAgdGhpcy5pbml0aWFsaXplX3Jlc3BvbnNlKHVzZXJfaW5wdXQpO1xuICAgICAgfVxuICAgICAgdGhpcy50ZXh0YXJlYS5zdHlsZS5oZWlnaHQgPSAnYXV0byc7XG4gICAgICB0aGlzLnRleHRhcmVhLnN0eWxlLmhlaWdodCA9ICh0aGlzLnRleHRhcmVhLnNjcm9sbEhlaWdodCkgKyAncHgnO1xuICAgIH0pO1xuICAgIC8vIGJ1dHRvbiBjb250YWluZXJcbiAgICBsZXQgYnV0dG9uX2NvbnRhaW5lciA9IGNoYXRfaW5wdXQuY3JlYXRlRGl2KFwic2MtYnV0dG9uLWNvbnRhaW5lclwiKTtcbiAgICAvLyBjcmVhdGUgaGlkZGVuIGFib3J0IGJ1dHRvblxuICAgIGxldCBhYm9ydF9idXR0b24gPSBidXR0b25fY29udGFpbmVyLmNyZWF0ZUVsKFwic3BhblwiLCB7IGF0dHI6IHtpZDogXCJzYy1hYm9ydC1idXR0b25cIiwgc3R5bGU6IFwiZGlzcGxheTogbm9uZTtcIn0gfSk7XG4gICAgT2JzaWRpYW4uc2V0SWNvbihhYm9ydF9idXR0b24sIFwic3F1YXJlXCIpO1xuICAgIC8vIGFkZCBldmVudCBsaXN0ZW5lciB0byBidXR0b25cbiAgICBhYm9ydF9idXR0b24uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHtcbiAgICAgIC8vIGFib3J0IGN1cnJlbnQgcmVzcG9uc2VcbiAgICAgIHRoaXMuZW5kX3N0cmVhbSgpO1xuICAgIH0pO1xuICAgIC8vIGNyZWF0ZSBidXR0b25cbiAgICBsZXQgYnV0dG9uID0gYnV0dG9uX2NvbnRhaW5lci5jcmVhdGVFbChcImJ1dHRvblwiLCB7IGF0dHI6IHtpZDogXCJzYy1zZW5kLWJ1dHRvblwifSwgY2xzOiBcInNlbmQtYnV0dG9uXCIgfSk7XG4gICAgYnV0dG9uLmlubmVySFRNTCA9IFwiU2VuZFwiO1xuICAgIC8vIGFkZCBldmVudCBsaXN0ZW5lciB0byBidXR0b25cbiAgICBidXR0b24uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHtcbiAgICAgIGlmKHRoaXMucHJldmVudF9pbnB1dCl7XG4gICAgICAgIGNvbnNvbGUubG9nKFwid2FpdCB1bnRpbCBjdXJyZW50IHJlc3BvbnNlIGlzIGZpbmlzaGVkXCIpO1xuICAgICAgICBuZXcgT2JzaWRpYW4uTm90aWNlKFwiV2FpdCB1bnRpbCBjdXJyZW50IHJlc3BvbnNlIGlzIGZpbmlzaGVkXCIpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICAvLyBnZXQgdGV4dCBmcm9tIHRleHRhcmVhXG4gICAgICBsZXQgdXNlcl9pbnB1dCA9IHRoaXMudGV4dGFyZWEudmFsdWU7XG4gICAgICAvLyBjbGVhciB0ZXh0YXJlYVxuICAgICAgdGhpcy50ZXh0YXJlYS52YWx1ZSA9IFwiXCI7XG4gICAgICAvLyBpbml0aWF0ZSByZXNwb25zZSBmcm9tIGFzc2lzdGFudFxuICAgICAgdGhpcy5pbml0aWFsaXplX3Jlc3BvbnNlKHVzZXJfaW5wdXQpO1xuICAgIH0pO1xuICB9XG4gIGFzeW5jIGluaXRpYWxpemVfcmVzcG9uc2UodXNlcl9pbnB1dCkge1xuICAgIHRoaXMuc2V0X3N0cmVhbWluZ191eCgpO1xuICAgIC8vIHJlbmRlciBtZXNzYWdlXG4gICAgYXdhaXQgdGhpcy5yZW5kZXJfbWVzc2FnZSh1c2VyX2lucHV0LCBcInVzZXJcIik7XG4gICAgdGhpcy5jaGF0Lm5ld19tZXNzYWdlX2luX3RocmVhZCh7XG4gICAgICByb2xlOiBcInVzZXJcIixcbiAgICAgIGNvbnRlbnQ6IHVzZXJfaW5wdXRcbiAgICB9KTtcbiAgICBhd2FpdCB0aGlzLnJlbmRlcl9kb3Rkb3Rkb3QoKTtcblxuICAgIC8vIGlmIGNvbnRhaW5zIGludGVybmFsIGxpbmsgcmVwcmVzZW50ZWQgYnkgW1tsaW5rXV1cbiAgICBpZih0aGlzLmNoYXQuY29udGFpbnNfaW50ZXJuYWxfbGluayh1c2VyX2lucHV0KSkge1xuICAgICAgdGhpcy5jaGF0LmdldF9yZXNwb25zZV93aXRoX25vdGVfY29udGV4dCh1c2VyX2lucHV0LCB0aGlzKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgLy8gLy8gZm9yIHRlc3RpbmcgcHVycG9zZXNcbiAgICAvLyBpZih0aGlzLmNoYXQuY29udGFpbnNfZm9sZGVyX3JlZmVyZW5jZSh1c2VyX2lucHV0KSkge1xuICAgIC8vICAgY29uc3QgZm9sZGVycyA9IHRoaXMuY2hhdC5nZXRfZm9sZGVyX3JlZmVyZW5jZXModXNlcl9pbnB1dCk7XG4gICAgLy8gICBjb25zb2xlLmxvZyhmb2xkZXJzKTtcbiAgICAvLyAgIHJldHVybjtcbiAgICAvLyB9XG4gICAgLy8gaWYgY29udGFpbnMgc2VsZiByZWZlcmVudGlhbCBrZXl3b3JkcyBvciBmb2xkZXIgcmVmZXJlbmNlXG4gICAgaWYodGhpcy5jb250YWluc19zZWxmX3JlZmVyZW50aWFsX2tleXdvcmRzKHVzZXJfaW5wdXQpIHx8IHRoaXMuY2hhdC5jb250YWluc19mb2xkZXJfcmVmZXJlbmNlKHVzZXJfaW5wdXQpKSB7XG4gICAgICAvLyBnZXQgaHlkZVxuICAgICAgY29uc3QgY29udGV4dCA9IGF3YWl0IHRoaXMuZ2V0X2NvbnRleHRfaHlkZSh1c2VyX2lucHV0KTtcbiAgICAgIC8vIGdldCB1c2VyIGlucHV0IHdpdGggYWRkZWQgY29udGV4dFxuICAgICAgLy8gY29uc3QgY29udGV4dF9pbnB1dCA9IHRoaXMuYnVpbGRfY29udGV4dF9pbnB1dChjb250ZXh0KTtcbiAgICAgIC8vIGNvbnNvbGUubG9nKGNvbnRleHRfaW5wdXQpO1xuICAgICAgY29uc3QgY2hhdG1sID0gW1xuICAgICAgICB7XG4gICAgICAgICAgcm9sZTogXCJzeXN0ZW1cIixcbiAgICAgICAgICAvLyBjb250ZW50OiBjb250ZXh0X2lucHV0XG4gICAgICAgICAgY29udGVudDogY29udGV4dFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgcm9sZTogXCJ1c2VyXCIsXG4gICAgICAgICAgY29udGVudDogdXNlcl9pbnB1dFxuICAgICAgICB9XG4gICAgICBdO1xuICAgICAgdGhpcy5yZXF1ZXN0X2NoYXRncHRfY29tcGxldGlvbih7bWVzc2FnZXM6IGNoYXRtbCwgdGVtcGVyYXR1cmU6IDB9KTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgLy8gY29tcGxldGlvbiB3aXRob3V0IGFueSBzcGVjaWZpYyBjb250ZXh0XG4gICAgdGhpcy5yZXF1ZXN0X2NoYXRncHRfY29tcGxldGlvbigpO1xuICB9XG4gIFxuICBhc3luYyByZW5kZXJfZG90ZG90ZG90KCkge1xuICAgIGlmICh0aGlzLmRvdGRvdGRvdF9pbnRlcnZhbClcbiAgICAgIGNsZWFySW50ZXJ2YWwodGhpcy5kb3Rkb3Rkb3RfaW50ZXJ2YWwpO1xuICAgIGF3YWl0IHRoaXMucmVuZGVyX21lc3NhZ2UoXCIuLi5cIiwgXCJhc3Npc3RhbnRcIik7XG4gICAgLy8gaWYgaXMgJy4uLicsIHRoZW4gaW5pdGlhdGUgaW50ZXJ2YWwgdG8gY2hhbmdlIHRvICcuJyBhbmQgdGhlbiB0byAnLi4nIGFuZCB0aGVuIHRvICcuLi4nXG4gICAgbGV0IGRvdHMgPSAwO1xuICAgIHRoaXMuYWN0aXZlX2VsbS5pbm5lckhUTUwgPSAnLi4uJztcbiAgICB0aGlzLmRvdGRvdGRvdF9pbnRlcnZhbCA9IHNldEludGVydmFsKCgpID0+IHtcbiAgICAgIGRvdHMrKztcbiAgICAgIGlmIChkb3RzID4gMylcbiAgICAgICAgZG90cyA9IDE7XG4gICAgICB0aGlzLmFjdGl2ZV9lbG0uaW5uZXJIVE1MID0gJy4nLnJlcGVhdChkb3RzKTtcbiAgICB9LCA1MDApO1xuICAgIC8vIHdhaXQgMiBzZWNvbmRzIGZvciB0ZXN0aW5nXG4gICAgLy8gYXdhaXQgbmV3IFByb21pc2UociA9PiBzZXRUaW1lb3V0KHIsIDIwMDApKTtcbiAgfVxuXG4gIHNldF9zdHJlYW1pbmdfdXgoKSB7XG4gICAgdGhpcy5wcmV2ZW50X2lucHV0ID0gdHJ1ZTtcbiAgICAvLyBoaWRlIHNlbmQgYnV0dG9uXG4gICAgaWYoZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJzYy1zZW5kLWJ1dHRvblwiKSlcbiAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwic2Mtc2VuZC1idXR0b25cIikuc3R5bGUuZGlzcGxheSA9IFwibm9uZVwiO1xuICAgIC8vIHNob3cgYWJvcnQgYnV0dG9uXG4gICAgaWYoZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJzYy1hYm9ydC1idXR0b25cIikpXG4gICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcInNjLWFib3J0LWJ1dHRvblwiKS5zdHlsZS5kaXNwbGF5ID0gXCJibG9ja1wiO1xuICB9XG4gIHVuc2V0X3N0cmVhbWluZ191eCgpIHtcbiAgICB0aGlzLnByZXZlbnRfaW5wdXQgPSBmYWxzZTtcbiAgICAvLyBzaG93IHNlbmQgYnV0dG9uLCByZW1vdmUgZGlzcGxheSBub25lXG4gICAgaWYoZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJzYy1zZW5kLWJ1dHRvblwiKSlcbiAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwic2Mtc2VuZC1idXR0b25cIikuc3R5bGUuZGlzcGxheSA9IFwiXCI7XG4gICAgLy8gaGlkZSBhYm9ydCBidXR0b25cbiAgICBpZihkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcInNjLWFib3J0LWJ1dHRvblwiKSlcbiAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwic2MtYWJvcnQtYnV0dG9uXCIpLnN0eWxlLmRpc3BsYXkgPSBcIm5vbmVcIjtcbiAgfVxuXG5cbiAgLy8gY2hlY2sgaWYgaW5jbHVkZXMga2V5d29yZHMgcmVmZXJyaW5nIHRvIG9uZSdzIG93biBub3Rlc1xuICBjb250YWluc19zZWxmX3JlZmVyZW50aWFsX2tleXdvcmRzKHVzZXJfaW5wdXQpIHtcbiAgICBjb25zdCBtYXRjaGVzID0gdXNlcl9pbnB1dC5tYXRjaCh0aGlzLnBsdWdpbi5zZWxmX3JlZl9rd19yZWdleCk7XG4gICAgaWYobWF0Y2hlcykgcmV0dXJuIHRydWU7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgLy8gcmVuZGVyIG1lc3NhZ2VcbiAgYXN5bmMgcmVuZGVyX21lc3NhZ2UobWVzc2FnZSwgZnJvbT1cImFzc2lzdGFudFwiLCBhcHBlbmRfbGFzdD1mYWxzZSkge1xuICAgIC8vIGlmIGRvdGRvdGRvdCBpbnRlcnZhbCBpcyBzZXQsIHRoZW4gY2xlYXIgaXRcbiAgICBpZih0aGlzLmRvdGRvdGRvdF9pbnRlcnZhbCkge1xuICAgICAgY2xlYXJJbnRlcnZhbCh0aGlzLmRvdGRvdGRvdF9pbnRlcnZhbCk7XG4gICAgICB0aGlzLmRvdGRvdGRvdF9pbnRlcnZhbCA9IG51bGw7XG4gICAgICAvLyBjbGVhciBsYXN0IG1lc3NhZ2VcbiAgICAgIHRoaXMuYWN0aXZlX2VsbS5pbm5lckhUTUwgPSAnJztcbiAgICB9XG4gICAgaWYoYXBwZW5kX2xhc3QpIHtcbiAgICAgIHRoaXMuY3VycmVudF9tZXNzYWdlX3JhdyArPSBtZXNzYWdlO1xuICAgICAgaWYobWVzc2FnZS5pbmRleE9mKCdcXG4nKSA9PT0gLTEpIHtcbiAgICAgICAgdGhpcy5hY3RpdmVfZWxtLmlubmVySFRNTCArPSBtZXNzYWdlO1xuICAgICAgfWVsc2V7XG4gICAgICAgIHRoaXMuYWN0aXZlX2VsbS5pbm5lckhUTUwgPSAnJztcbiAgICAgICAgLy8gYXBwZW5kIHRvIGxhc3QgbWVzc2FnZVxuICAgICAgICBhd2FpdCBPYnNpZGlhbi5NYXJrZG93blJlbmRlcmVyLnJlbmRlck1hcmtkb3duKHRoaXMuY3VycmVudF9tZXNzYWdlX3JhdywgdGhpcy5hY3RpdmVfZWxtLCAnP25vLWRhdGF2aWV3JywgbmV3IE9ic2lkaWFuLkNvbXBvbmVudCgpKTtcbiAgICAgIH1cbiAgICB9ZWxzZXtcbiAgICAgIHRoaXMuY3VycmVudF9tZXNzYWdlX3JhdyA9ICcnO1xuICAgICAgaWYoKHRoaXMuY2hhdC50aHJlYWQubGVuZ3RoID09PSAwKSB8fCAodGhpcy5sYXN0X2Zyb20gIT09IGZyb20pKSB7XG4gICAgICAgIC8vIGNyZWF0ZSBtZXNzYWdlXG4gICAgICAgIHRoaXMubmV3X21lc3NzYWdlX2J1YmJsZShmcm9tKTtcbiAgICAgIH1cbiAgICAgIC8vIHNldCBtZXNzYWdlIHRleHRcbiAgICAgIHRoaXMuYWN0aXZlX2VsbS5pbm5lckhUTUwgPSAnJztcbiAgICAgIGF3YWl0IE9ic2lkaWFuLk1hcmtkb3duUmVuZGVyZXIucmVuZGVyTWFya2Rvd24obWVzc2FnZSwgdGhpcy5hY3RpdmVfZWxtLCAnP25vLWRhdGF2aWV3JywgbmV3IE9ic2lkaWFuLkNvbXBvbmVudCgpKTtcbiAgICAgIC8vIGdldCBsaW5rc1xuICAgICAgdGhpcy5oYW5kbGVfbGlua3NfaW5fbWVzc2FnZSgpO1xuICAgICAgLy8gcmVuZGVyIGJ1dHRvbihzKVxuICAgICAgdGhpcy5yZW5kZXJfbWVzc2FnZV9hY3Rpb25fYnV0dG9ucyhtZXNzYWdlKTtcbiAgICB9XG4gICAgLy8gc2Nyb2xsIHRvIGJvdHRvbVxuICAgIHRoaXMubWVzc2FnZV9jb250YWluZXIuc2Nyb2xsVG9wID0gdGhpcy5tZXNzYWdlX2NvbnRhaW5lci5zY3JvbGxIZWlnaHQ7XG4gIH1cbiAgcmVuZGVyX21lc3NhZ2VfYWN0aW9uX2J1dHRvbnMobWVzc2FnZSkge1xuICAgIGlmICh0aGlzLmNoYXQuY29udGV4dCAmJiB0aGlzLmNoYXQuaHlkKSB7XG4gICAgICAvLyByZW5kZXIgYnV0dG9uIHRvIGNvcHkgaHlkIGluIHNtYXJ0LWNvbm5lY3Rpb25zIGNvZGUgYmxvY2tcbiAgICAgIGNvbnN0IGNvbnRleHRfdmlldyA9IHRoaXMuYWN0aXZlX2VsbS5jcmVhdGVFbChcInNwYW5cIiwge1xuICAgICAgICBjbHM6IFwic2MtbXNnLWJ1dHRvblwiLFxuICAgICAgICBhdHRyOiB7XG4gICAgICAgICAgdGl0bGU6IFwiQ29weSBjb250ZXh0IHRvIGNsaXBib2FyZFwiIC8qIHRvb2x0aXAgKi9cbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgICBjb25zdCB0aGlzX2h5ZCA9IHRoaXMuY2hhdC5oeWQ7XG4gICAgICBPYnNpZGlhbi5zZXRJY29uKGNvbnRleHRfdmlldywgXCJleWVcIik7XG4gICAgICBjb250ZXh0X3ZpZXcuYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHtcbiAgICAgICAgLy8gY29weSB0byBjbGlwYm9hcmRcbiAgICAgICAgbmF2aWdhdG9yLmNsaXBib2FyZC53cml0ZVRleHQoXCJgYGBzbWFydC1jb25uZWN0aW9uc1xcblwiICsgdGhpc19oeWQgKyBcIlxcbmBgYFxcblwiKTtcbiAgICAgICAgbmV3IE9ic2lkaWFuLk5vdGljZShcIltTbWFydCBDb25uZWN0aW9uc10gQ29udGV4dCBjb2RlIGJsb2NrIGNvcGllZCB0byBjbGlwYm9hcmRcIik7XG4gICAgICB9KTtcbiAgICB9XG4gICAgaWYodGhpcy5jaGF0LmNvbnRleHQpIHtcbiAgICAgIC8vIHJlbmRlciBjb3B5IGNvbnRleHQgYnV0dG9uXG4gICAgICBjb25zdCBjb3B5X3Byb21wdF9idXR0b24gPSB0aGlzLmFjdGl2ZV9lbG0uY3JlYXRlRWwoXCJzcGFuXCIsIHtcbiAgICAgICAgY2xzOiBcInNjLW1zZy1idXR0b25cIixcbiAgICAgICAgYXR0cjoge1xuICAgICAgICAgIHRpdGxlOiBcIkNvcHkgcHJvbXB0IHRvIGNsaXBib2FyZFwiIC8qIHRvb2x0aXAgKi9cbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgICBjb25zdCB0aGlzX2NvbnRleHQgPSB0aGlzLmNoYXQuY29udGV4dC5yZXBsYWNlKC9cXGBcXGBcXGAvZywgXCJcXHRgYGBcIikudHJpbUxlZnQoKTtcbiAgICAgIE9ic2lkaWFuLnNldEljb24oY29weV9wcm9tcHRfYnV0dG9uLCBcImZpbGVzXCIpO1xuICAgICAgY29weV9wcm9tcHRfYnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiB7XG4gICAgICAgIC8vIGNvcHkgdG8gY2xpcGJvYXJkXG4gICAgICAgIG5hdmlnYXRvci5jbGlwYm9hcmQud3JpdGVUZXh0KFwiYGBgcHJvbXB0LWNvbnRleHRcXG5cIiArIHRoaXNfY29udGV4dCArIFwiXFxuYGBgXFxuXCIpO1xuICAgICAgICBuZXcgT2JzaWRpYW4uTm90aWNlKFwiW1NtYXJ0IENvbm5lY3Rpb25zXSBDb250ZXh0IGNvcGllZCB0byBjbGlwYm9hcmRcIik7XG4gICAgICB9KTtcbiAgICB9XG4gICAgLy8gcmVuZGVyIGNvcHkgYnV0dG9uXG4gICAgY29uc3QgY29weV9idXR0b24gPSB0aGlzLmFjdGl2ZV9lbG0uY3JlYXRlRWwoXCJzcGFuXCIsIHtcbiAgICAgIGNsczogXCJzYy1tc2ctYnV0dG9uXCIsXG4gICAgICBhdHRyOiB7XG4gICAgICAgIHRpdGxlOiBcIkNvcHkgbWVzc2FnZSB0byBjbGlwYm9hcmRcIiAvKiB0b29sdGlwICovXG4gICAgICB9XG4gICAgfSk7XG4gICAgT2JzaWRpYW4uc2V0SWNvbihjb3B5X2J1dHRvbiwgXCJjb3B5XCIpO1xuICAgIGNvcHlfYnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiB7XG4gICAgICAvLyBjb3B5IG1lc3NhZ2UgdG8gY2xpcGJvYXJkXG4gICAgICBuYXZpZ2F0b3IuY2xpcGJvYXJkLndyaXRlVGV4dChtZXNzYWdlLnRyaW1MZWZ0KCkpO1xuICAgICAgbmV3IE9ic2lkaWFuLk5vdGljZShcIltTbWFydCBDb25uZWN0aW9uc10gTWVzc2FnZSBjb3BpZWQgdG8gY2xpcGJvYXJkXCIpO1xuICAgIH0pO1xuICB9XG5cbiAgaGFuZGxlX2xpbmtzX2luX21lc3NhZ2UoKSB7XG4gICAgY29uc3QgbGlua3MgPSB0aGlzLmFjdGl2ZV9lbG0ucXVlcnlTZWxlY3RvckFsbChcImFcIik7XG4gICAgLy8gaWYgdGhpcyBhY3RpdmUgZWxlbWVudCBjb250YWlucyBhIGxpbmtcbiAgICBpZiAobGlua3MubGVuZ3RoID4gMCkge1xuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsaW5rcy5sZW5ndGg7IGkrKykge1xuICAgICAgICBjb25zdCBsaW5rID0gbGlua3NbaV07XG4gICAgICAgIGNvbnN0IGxpbmtfdGV4dCA9IGxpbmsuZ2V0QXR0cmlidXRlKFwiZGF0YS1ocmVmXCIpO1xuICAgICAgICAvLyB0cmlnZ2VyIGhvdmVyIGV2ZW50IG9uIGxpbmtcbiAgICAgICAgbGluay5hZGRFdmVudExpc3RlbmVyKFwibW91c2VvdmVyXCIsIChldmVudCkgPT4ge1xuICAgICAgICAgIHRoaXMuYXBwLndvcmtzcGFjZS50cmlnZ2VyKFwiaG92ZXItbGlua1wiLCB7XG4gICAgICAgICAgICBldmVudCxcbiAgICAgICAgICAgIHNvdXJjZTogU01BUlRfQ09OTkVDVElPTlNfQ0hBVF9WSUVXX1RZUEUsXG4gICAgICAgICAgICBob3ZlclBhcmVudDogbGluay5wYXJlbnRFbGVtZW50LFxuICAgICAgICAgICAgdGFyZ2V0RWw6IGxpbmssXG4gICAgICAgICAgICAvLyBleHRyYWN0IGxpbmsgdGV4dCBmcm9tIGEuZGF0YS1ocmVmXG4gICAgICAgICAgICBsaW5rdGV4dDogbGlua190ZXh0XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgICAgICAvLyB0cmlnZ2VyIG9wZW4gbGluayBldmVudCBvbiBsaW5rXG4gICAgICAgIGxpbmsuYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIChldmVudCkgPT4ge1xuICAgICAgICAgIGNvbnN0IGxpbmtfdGZpbGUgPSB0aGlzLmFwcC5tZXRhZGF0YUNhY2hlLmdldEZpcnN0TGlua3BhdGhEZXN0KGxpbmtfdGV4dCwgXCIvXCIpO1xuICAgICAgICAgIC8vIHByb3Blcmx5IGhhbmRsZSBpZiB0aGUgbWV0YS9jdHJsIGtleSBpcyBwcmVzc2VkXG4gICAgICAgICAgY29uc3QgbW9kID0gT2JzaWRpYW4uS2V5bWFwLmlzTW9kRXZlbnQoZXZlbnQpO1xuICAgICAgICAgIC8vIGdldCBtb3N0IHJlY2VudCBsZWFmXG4gICAgICAgICAgbGV0IGxlYWYgPSB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0TGVhZihtb2QpO1xuICAgICAgICAgIGxlYWYub3BlbkZpbGUobGlua190ZmlsZSk7XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIG5ld19tZXNzc2FnZV9idWJibGUoZnJvbSkge1xuICAgIGxldCBtZXNzYWdlX2VsID0gdGhpcy5tZXNzYWdlX2NvbnRhaW5lci5jcmVhdGVEaXYoYHNjLW1lc3NhZ2UgJHtmcm9tfWApO1xuICAgIC8vIGNyZWF0ZSBtZXNzYWdlIGNvbnRlbnRcbiAgICB0aGlzLmFjdGl2ZV9lbG0gPSBtZXNzYWdlX2VsLmNyZWF0ZURpdihcInNjLW1lc3NhZ2UtY29udGVudFwiKTtcbiAgICAvLyBzZXQgbGFzdCBmcm9tXG4gICAgdGhpcy5sYXN0X2Zyb20gPSBmcm9tO1xuICB9XG5cbiAgYXN5bmMgcmVxdWVzdF9jaGF0Z3B0X2NvbXBsZXRpb24ob3B0cz17fSkge1xuICAgIGNvbnN0IGNoYXRfbWwgPSB0aGlzLmNoYXQucHJlcGFyZV9jaGF0X21sKCk7XG4gICAgY29uc3QgbWF4X3RvdGFsX3Rva2VucyA9IE1hdGgucm91bmQoZ2V0X21heF9jaGFycyh0aGlzLnBsdWdpbi5zZXR0aW5ncy5zbWFydF9jaGF0X21vZGVsKSAvIDQpO1xuICAgIGNvbnNvbGUubG9nKFwibWF4X3RvdGFsX3Rva2Vuc1wiLCBtYXhfdG90YWxfdG9rZW5zKTtcbiAgICBjb25zdCBtYXhfYXZhaWxhYmxlX3Rva2VucyA9IG1heF90b3RhbF90b2tlbnMgLSB0aGlzLmNoYXQuZXN0aW1hdGVfY3VycmVudF90b2tlbnNfaW5fY2hhdF9tbCgpO1xuICAgIGNvbnNvbGUubG9nKFwibWF4X2F2YWlsYWJsZV90b2tlbnNcIiwgbWF4X2F2YWlsYWJsZV90b2tlbnMpO1xuICAgIG9wdHMgPSB7XG4gICAgICBtb2RlbDogdGhpcy5wbHVnaW4uc2V0dGluZ3Muc21hcnRfY2hhdF9tb2RlbCxcbiAgICAgIG1lc3NhZ2VzOiBjaGF0X21sLFxuICAgICAgLy8gbWF4X3Rva2VuczogMjUwLFxuICAgICAgbWF4X3Rva2VuczogbWF4X2F2YWlsYWJsZV90b2tlbnMsXG4gICAgICB0ZW1wZXJhdHVyZTogMC4zLFxuICAgICAgdG9wX3A6IDEsXG4gICAgICBwcmVzZW5jZV9wZW5hbHR5OiAwLFxuICAgICAgZnJlcXVlbmN5X3BlbmFsdHk6IDAsXG4gICAgICBzdHJlYW06IHRydWUsXG4gICAgICBzdG9wOiBudWxsLFxuICAgICAgbjogMSxcbiAgICAgIC8vIGxvZ2l0X2JpYXM6IGxvZ2l0X2JpYXMsXG4gICAgICAuLi5vcHRzXG4gICAgfVxuICAgIC8vIGNvbnNvbGUubG9nKG9wdHMubWVzc2FnZXMpO1xuICAgIGlmKG9wdHMuc3RyZWFtKSB7XG4gICAgICBjb25zdCBmdWxsX3N0ciA9IGF3YWl0IG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAvLyBjb25zb2xlLmxvZyhcInN0cmVhbVwiLCBvcHRzKTtcbiAgICAgICAgICBjb25zdCB1cmwgPSBcImh0dHBzOi8vYXBpLm9wZW5haS5jb20vdjEvY2hhdC9jb21wbGV0aW9uc1wiO1xuICAgICAgICAgIHRoaXMuYWN0aXZlX3N0cmVhbSA9IG5ldyBTY1N0cmVhbWVyKHVybCwge1xuICAgICAgICAgICAgaGVhZGVyczoge1xuICAgICAgICAgICAgICBcIkNvbnRlbnQtVHlwZVwiOiBcImFwcGxpY2F0aW9uL2pzb25cIixcbiAgICAgICAgICAgICAgQXV0aG9yaXphdGlvbjogYEJlYXJlciAke3RoaXMucGx1Z2luLnNldHRpbmdzLmFwaV9rZXl9YFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIG1ldGhvZDogXCJQT1NUXCIsXG4gICAgICAgICAgICBwYXlsb2FkOiBKU09OLnN0cmluZ2lmeShvcHRzKVxuICAgICAgICAgIH0pO1xuICAgICAgICAgIGxldCB0eHQgPSBcIlwiO1xuICAgICAgICAgIHRoaXMuYWN0aXZlX3N0cmVhbS5hZGRFdmVudExpc3RlbmVyKFwibWVzc2FnZVwiLCAoZSkgPT4ge1xuICAgICAgICAgICAgaWYgKGUuZGF0YSAhPSBcIltET05FXVwiKSB7XG4gICAgICAgICAgICAgIGNvbnN0IHBheWxvYWQgPSBKU09OLnBhcnNlKGUuZGF0YSk7XG4gICAgICAgICAgICAgIGNvbnN0IHRleHQgPSBwYXlsb2FkLmNob2ljZXNbMF0uZGVsdGEuY29udGVudDtcbiAgICAgICAgICAgICAgaWYgKCF0ZXh0KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIHR4dCArPSB0ZXh0O1xuICAgICAgICAgICAgICB0aGlzLnJlbmRlcl9tZXNzYWdlKHRleHQsIFwiYXNzaXN0YW50XCIsIHRydWUpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgdGhpcy5lbmRfc3RyZWFtKCk7XG4gICAgICAgICAgICAgIHJlc29sdmUodHh0KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KTtcbiAgICAgICAgICB0aGlzLmFjdGl2ZV9zdHJlYW0uYWRkRXZlbnRMaXN0ZW5lcihcInJlYWR5c3RhdGVjaGFuZ2VcIiwgKGUpID0+IHtcbiAgICAgICAgICAgIGlmIChlLnJlYWR5U3RhdGUgPj0gMikge1xuICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcIlJlYWR5U3RhdGU6IFwiICsgZS5yZWFkeVN0YXRlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KTtcbiAgICAgICAgICB0aGlzLmFjdGl2ZV9zdHJlYW0uYWRkRXZlbnRMaXN0ZW5lcihcImVycm9yXCIsIChlKSA9PiB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKGUpO1xuICAgICAgICAgICAgbmV3IE9ic2lkaWFuLk5vdGljZShcIlNtYXJ0IENvbm5lY3Rpb25zIEVycm9yIFN0cmVhbWluZyBSZXNwb25zZS4gU2VlIGNvbnNvbGUgZm9yIGRldGFpbHMuXCIpO1xuICAgICAgICAgICAgdGhpcy5yZW5kZXJfbWVzc2FnZShcIipBUEkgRXJyb3IuIFNlZSBjb25zb2xlIGxvZ3MgZm9yIGRldGFpbHMuKlwiLCBcImFzc2lzdGFudFwiKTtcbiAgICAgICAgICAgIHRoaXMuZW5kX3N0cmVhbSgpO1xuICAgICAgICAgICAgcmVqZWN0KGUpO1xuICAgICAgICAgIH0pO1xuICAgICAgICAgIHRoaXMuYWN0aXZlX3N0cmVhbS5zdHJlYW0oKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgY29uc29sZS5lcnJvcihlcnIpO1xuICAgICAgICAgIG5ldyBPYnNpZGlhbi5Ob3RpY2UoXCJTbWFydCBDb25uZWN0aW9ucyBFcnJvciBTdHJlYW1pbmcgUmVzcG9uc2UuIFNlZSBjb25zb2xlIGZvciBkZXRhaWxzLlwiKTtcbiAgICAgICAgICB0aGlzLmVuZF9zdHJlYW0oKTtcbiAgICAgICAgICByZWplY3QoZXJyKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgICAvLyBjb25zb2xlLmxvZyhmdWxsX3N0cik7XG4gICAgICBhd2FpdCB0aGlzLnJlbmRlcl9tZXNzYWdlKGZ1bGxfc3RyLCBcImFzc2lzdGFudFwiKTtcbiAgICAgIHRoaXMuY2hhdC5uZXdfbWVzc2FnZV9pbl90aHJlYWQoe1xuICAgICAgICByb2xlOiBcImFzc2lzdGFudFwiLFxuICAgICAgICBjb250ZW50OiBmdWxsX3N0clxuICAgICAgfSk7XG4gICAgICByZXR1cm47XG4gICAgfWVsc2V7XG4gICAgICB0cnl7XG4gICAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgKDAsIE9ic2lkaWFuLnJlcXVlc3RVcmwpKHtcbiAgICAgICAgICB1cmw6IGBodHRwczovL2FwaS5vcGVuYWkuY29tL3YxL2NoYXQvY29tcGxldGlvbnNgLFxuICAgICAgICAgIG1ldGhvZDogXCJQT1NUXCIsXG4gICAgICAgICAgaGVhZGVyczoge1xuICAgICAgICAgICAgQXV0aG9yaXphdGlvbjogYEJlYXJlciAke3RoaXMucGx1Z2luLnNldHRpbmdzLmFwaV9rZXl9YCxcbiAgICAgICAgICAgIFwiQ29udGVudC1UeXBlXCI6IFwiYXBwbGljYXRpb24vanNvblwiXG4gICAgICAgICAgfSxcbiAgICAgICAgICBjb250ZW50VHlwZTogXCJhcHBsaWNhdGlvbi9qc29uXCIsXG4gICAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkob3B0cyksXG4gICAgICAgICAgdGhyb3c6IGZhbHNlXG4gICAgICAgIH0pO1xuICAgICAgICAvLyBjb25zb2xlLmxvZyhyZXNwb25zZSk7XG4gICAgICAgIHJldHVybiBKU09OLnBhcnNlKHJlc3BvbnNlLnRleHQpLmNob2ljZXNbMF0ubWVzc2FnZS5jb250ZW50O1xuICAgICAgfWNhdGNoKGVycil7XG4gICAgICAgIG5ldyBPYnNpZGlhbi5Ob3RpY2UoYFNtYXJ0IENvbm5lY3Rpb25zIEFQSSBFcnJvciA6OiAke2Vycn1gKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBlbmRfc3RyZWFtKCkge1xuICAgIGlmKHRoaXMuYWN0aXZlX3N0cmVhbSl7XG4gICAgICB0aGlzLmFjdGl2ZV9zdHJlYW0uY2xvc2UoKTtcbiAgICAgIHRoaXMuYWN0aXZlX3N0cmVhbSA9IG51bGw7XG4gICAgfVxuICAgIHRoaXMudW5zZXRfc3RyZWFtaW5nX3V4KCk7XG4gICAgaWYodGhpcy5kb3Rkb3Rkb3RfaW50ZXJ2YWwpe1xuICAgICAgY2xlYXJJbnRlcnZhbCh0aGlzLmRvdGRvdGRvdF9pbnRlcnZhbCk7XG4gICAgICB0aGlzLmRvdGRvdGRvdF9pbnRlcnZhbCA9IG51bGw7XG4gICAgICAvLyByZW1vdmUgcGFyZW50IG9mIGFjdGl2ZV9lbG1cbiAgICAgIHRoaXMuYWN0aXZlX2VsbS5wYXJlbnRFbGVtZW50LnJlbW92ZSgpO1xuICAgICAgdGhpcy5hY3RpdmVfZWxtID0gbnVsbDtcbiAgICB9XG4gIH1cblxuICBhc3luYyBnZXRfY29udGV4dF9oeWRlKHVzZXJfaW5wdXQpIHtcbiAgICB0aGlzLmNoYXQucmVzZXRfY29udGV4dCgpO1xuICAgIC8vIGNvdW50IGN1cnJlbnQgY2hhdCBtbCBtZXNzYWdlcyB0byBkZXRlcm1pbmUgJ3F1ZXN0aW9uJyBvciAnY2hhdCBsb2cnIHdvcmRpbmdcbiAgICBjb25zdCBoeWRfaW5wdXQgPSBgQW50aWNpcGF0ZSB3aGF0IHRoZSB1c2VyIGlzIHNlZWtpbmcuIFJlc3BvbmQgaW4gdGhlIGZvcm0gb2YgYSBoeXBvdGhldGljYWwgbm90ZSB3cml0dGVuIGJ5IHRoZSB1c2VyLiBUaGUgbm90ZSBtYXkgY29udGFpbiBzdGF0ZW1lbnRzIGFzIHBhcmFncmFwaHMsIGxpc3RzLCBvciBjaGVja2xpc3RzIGluIG1hcmtkb3duIGZvcm1hdCB3aXRoIG5vIGhlYWRpbmdzLiBQbGVhc2UgcmVzcG9uZCB3aXRoIG9uZSBoeXBvdGhldGljYWwgbm90ZSBhbmQgYWJzdGFpbiBmcm9tIGFueSBvdGhlciBjb21tZW50YXJ5LiBVc2UgdGhlIGZvcm1hdDogUEFSRU5UIEZPTERFUiBOQU1FID4gQ0hJTEQgRk9MREVSIE5BTUUgPiBGSUxFIE5BTUUgPiBIRUFESU5HIDEgPiBIRUFESU5HIDIgPiBIRUFESU5HIDM6IEhZUE9USEVUSUNBTCBOT1RFIENPTlRFTlRTLmA7XG4gICAgLy8gY29tcGxldGVcbiAgICBjb25zdCBjaGF0bWwgPSBbXG4gICAgICB7XG4gICAgICAgIHJvbGU6IFwic3lzdGVtXCIsXG4gICAgICAgIGNvbnRlbnQ6IGh5ZF9pbnB1dCBcbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIHJvbGU6IFwidXNlclwiLFxuICAgICAgICBjb250ZW50OiB1c2VyX2lucHV0XG4gICAgICB9XG4gICAgXTtcbiAgICBjb25zdCBoeWQgPSBhd2FpdCB0aGlzLnJlcXVlc3RfY2hhdGdwdF9jb21wbGV0aW9uKHtcbiAgICAgIG1lc3NhZ2VzOiBjaGF0bWwsXG4gICAgICBzdHJlYW06IGZhbHNlLFxuICAgICAgdGVtcGVyYXR1cmU6IDAsXG4gICAgICBtYXhfdG9rZW5zOiAxMzcsXG4gICAgfSk7XG4gICAgdGhpcy5jaGF0Lmh5ZCA9IGh5ZDtcbiAgICAvLyBjb25zb2xlLmxvZyhoeWQpO1xuICAgIGxldCBmaWx0ZXIgPSB7fTtcbiAgICAvLyBpZiBjb250YWlucyBmb2xkZXIgcmVmZXJlbmNlIHJlcHJlc2VudGVkIGJ5IC9mb2xkZXIvXG4gICAgaWYodGhpcy5jaGF0LmNvbnRhaW5zX2ZvbGRlcl9yZWZlcmVuY2UodXNlcl9pbnB1dCkpIHtcbiAgICAgIC8vIGdldCBmb2xkZXIgcmVmZXJlbmNlc1xuICAgICAgY29uc3QgZm9sZGVyX3JlZnMgPSB0aGlzLmNoYXQuZ2V0X2ZvbGRlcl9yZWZlcmVuY2VzKHVzZXJfaW5wdXQpO1xuICAgICAgLy8gY29uc29sZS5sb2coZm9sZGVyX3JlZnMpO1xuICAgICAgLy8gaWYgZm9sZGVyIHJlZmVyZW5jZXMgYXJlIHZhbGlkIChzdHJpbmcgb3IgYXJyYXkgb2Ygc3RyaW5ncylcbiAgICAgIGlmKGZvbGRlcl9yZWZzKXtcbiAgICAgICAgZmlsdGVyID0ge1xuICAgICAgICAgIHBhdGhfYmVnaW5zX3dpdGg6IGZvbGRlcl9yZWZzXG4gICAgICAgIH07XG4gICAgICB9XG4gICAgfVxuICAgIC8vIHNlYXJjaCBmb3IgbmVhcmVzdCBiYXNlZCBvbiBoeWRcbiAgICBsZXQgbmVhcmVzdCA9IGF3YWl0IHRoaXMucGx1Z2luLmFwaS5zZWFyY2goaHlkLCBmaWx0ZXIpO1xuICAgIGNvbnNvbGUubG9nKFwibmVhcmVzdFwiLCBuZWFyZXN0Lmxlbmd0aCk7XG4gICAgbmVhcmVzdCA9IHRoaXMuZ2V0X25lYXJlc3RfdW50aWxfbmV4dF9kZXZfZXhjZWVkc19zdGRfZGV2KG5lYXJlc3QpO1xuICAgIGNvbnNvbGUubG9nKFwibmVhcmVzdCBhZnRlciBzdGQgZGV2IHNsaWNlXCIsIG5lYXJlc3QubGVuZ3RoKTtcbiAgICBuZWFyZXN0ID0gdGhpcy5zb3J0X2J5X2xlbl9hZGp1c3RlZF9zaW1pbGFyaXR5KG5lYXJlc3QpO1xuICAgIFxuICAgIHJldHVybiBhd2FpdCB0aGlzLmdldF9jb250ZXh0X2Zvcl9wcm9tcHQobmVhcmVzdCk7XG4gIH1cbiAgXG4gIFxuICBzb3J0X2J5X2xlbl9hZGp1c3RlZF9zaW1pbGFyaXR5KG5lYXJlc3QpIHtcbiAgICAvLyByZS1zb3J0IGJ5IHF1b3RpZW50IG9mIHNpbWlsYXJpdHkgZGl2aWRlZCBieSBsZW4gREVTQ1xuICAgIG5lYXJlc3QgPSBuZWFyZXN0LnNvcnQoKGEsIGIpID0+IHtcbiAgICAgIGNvbnN0IGFfc2NvcmUgPSBhLnNpbWlsYXJpdHkgLyBhLmxlbjtcbiAgICAgIGNvbnN0IGJfc2NvcmUgPSBiLnNpbWlsYXJpdHkgLyBiLmxlbjtcbiAgICAgIC8vIGlmIGEgaXMgZ3JlYXRlciB0aGFuIGIsIHJldHVybiAtMVxuICAgICAgaWYgKGFfc2NvcmUgPiBiX3Njb3JlKVxuICAgICAgICByZXR1cm4gLTE7XG4gICAgICAvLyBpZiBhIGlzIGxlc3MgdGhhbiBiLCByZXR1cm4gMVxuICAgICAgaWYgKGFfc2NvcmUgPCBiX3Njb3JlKVxuICAgICAgICByZXR1cm4gMTtcbiAgICAgIC8vIGlmIGEgaXMgZXF1YWwgdG8gYiwgcmV0dXJuIDBcbiAgICAgIHJldHVybiAwO1xuICAgIH0pO1xuICAgIHJldHVybiBuZWFyZXN0O1xuICB9XG5cbiAgZ2V0X25lYXJlc3RfdW50aWxfbmV4dF9kZXZfZXhjZWVkc19zdGRfZGV2KG5lYXJlc3QpIHtcbiAgICAvLyBnZXQgc3RkIGRldiBvZiBzaW1pbGFyaXR5XG4gICAgY29uc3Qgc2ltID0gbmVhcmVzdC5tYXAoKG4pID0+IG4uc2ltaWxhcml0eSk7XG4gICAgY29uc3QgbWVhbiA9IHNpbS5yZWR1Y2UoKGEsIGIpID0+IGEgKyBiKSAvIHNpbS5sZW5ndGg7XG4gICAgY29uc3Qgc3RkX2RldiA9IE1hdGguc3FydChzaW0ubWFwKCh4KSA9PiBNYXRoLnBvdyh4IC0gbWVhbiwgMikpLnJlZHVjZSgoYSwgYikgPT4gYSArIGIpIC8gc2ltLmxlbmd0aCk7XG4gICAgLy8gc2xpY2Ugd2hlcmUgbmV4dCBpdGVtIGRldmlhdGlvbiBpcyBncmVhdGVyIHRoYW4gc3RkX2RldlxuICAgIGxldCBzbGljZV9pID0gMDtcbiAgICB3aGlsZSAoc2xpY2VfaSA8IG5lYXJlc3QubGVuZ3RoKSB7XG4gICAgICBjb25zdCBuZXh0ID0gbmVhcmVzdFtzbGljZV9pICsgMV07XG4gICAgICBpZiAobmV4dCkge1xuICAgICAgICBjb25zdCBuZXh0X2RldiA9IE1hdGguYWJzKG5leHQuc2ltaWxhcml0eSAtIG5lYXJlc3Rbc2xpY2VfaV0uc2ltaWxhcml0eSk7XG4gICAgICAgIGlmIChuZXh0X2RldiA+IHN0ZF9kZXYpIHtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgc2xpY2VfaSsrO1xuICAgIH1cbiAgICAvLyBzZWxlY3QgdG9wIHJlc3VsdHNcbiAgICBuZWFyZXN0ID0gbmVhcmVzdC5zbGljZSgwLCBzbGljZV9pKzEpO1xuICAgIHJldHVybiBuZWFyZXN0O1xuICB9XG4gIC8vIHRoaXMudGVzdF9nZXRfbmVhcmVzdF91bnRpbF9uZXh0X2Rldl9leGNlZWRzX3N0ZF9kZXYoKTtcbiAgLy8gLy8gdGVzdCBnZXRfbmVhcmVzdF91bnRpbF9uZXh0X2Rldl9leGNlZWRzX3N0ZF9kZXZcbiAgLy8gdGVzdF9nZXRfbmVhcmVzdF91bnRpbF9uZXh0X2Rldl9leGNlZWRzX3N0ZF9kZXYoKSB7XG4gIC8vICAgY29uc3QgbmVhcmVzdCA9IFt7c2ltaWxhcml0eTogMC45OX0sIHtzaW1pbGFyaXR5OiAwLjk4fSwge3NpbWlsYXJpdHk6IDAuOTd9LCB7c2ltaWxhcml0eTogMC45Nn0sIHtzaW1pbGFyaXR5OiAwLjk1fSwge3NpbWlsYXJpdHk6IDAuOTR9LCB7c2ltaWxhcml0eTogMC45M30sIHtzaW1pbGFyaXR5OiAwLjkyfSwge3NpbWlsYXJpdHk6IDAuOTF9LCB7c2ltaWxhcml0eTogMC45fSwge3NpbWlsYXJpdHk6IDAuNzl9LCB7c2ltaWxhcml0eTogMC43OH0sIHtzaW1pbGFyaXR5OiAwLjc3fSwge3NpbWlsYXJpdHk6IDAuNzZ9LCB7c2ltaWxhcml0eTogMC43NX0sIHtzaW1pbGFyaXR5OiAwLjc0fSwge3NpbWlsYXJpdHk6IDAuNzN9LCB7c2ltaWxhcml0eTogMC43Mn1dO1xuICAvLyAgIGNvbnN0IHJlc3VsdCA9IHRoaXMuZ2V0X25lYXJlc3RfdW50aWxfbmV4dF9kZXZfZXhjZWVkc19zdGRfZGV2KG5lYXJlc3QpO1xuICAvLyAgIGlmKHJlc3VsdC5sZW5ndGggIT09IDEwKXtcbiAgLy8gICAgIGNvbnNvbGUuZXJyb3IoXCJnZXRfbmVhcmVzdF91bnRpbF9uZXh0X2Rldl9leGNlZWRzX3N0ZF9kZXYgZmFpbGVkXCIsIHJlc3VsdCk7XG4gIC8vICAgfVxuICAvLyB9XG5cbiAgYXN5bmMgZ2V0X2NvbnRleHRfZm9yX3Byb21wdChuZWFyZXN0KSB7XG4gICAgbGV0IGNvbnRleHQgPSBbXTtcbiAgICBjb25zdCBNQVhfU09VUkNFUyA9IDIwOyAvLyAxMCAqIDEwMDAgKG1heCBjaGFycykgPSAxMCwwMDAgY2hhcnMgKG11c3QgYmUgdW5kZXIgfjE2LDAwMCBjaGFycyBvciA0SyB0b2tlbnMpIFxuICAgIGNvbnN0IE1BWF9DSEFSUyA9IGdldF9tYXhfY2hhcnModGhpcy5wbHVnaW4uc2V0dGluZ3Muc21hcnRfY2hhdF9tb2RlbCk7XG4gICAgbGV0IGNoYXJfYWNjdW0gPSAwO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbmVhcmVzdC5sZW5ndGg7IGkrKykge1xuICAgICAgaWYgKGNvbnRleHQubGVuZ3RoID49IE1BWF9TT1VSQ0VTKVxuICAgICAgICBicmVhaztcbiAgICAgIGlmIChjaGFyX2FjY3VtID49IE1BWF9DSEFSUylcbiAgICAgICAgYnJlYWs7XG4gICAgICBpZiAodHlwZW9mIG5lYXJlc3RbaV0ubGluayAhPT0gJ3N0cmluZycpXG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgLy8gZ2VuZXJhdGUgYnJlYWRjcnVtYnNcbiAgICAgIGNvbnN0IGJyZWFkY3J1bWJzID0gbmVhcmVzdFtpXS5saW5rLnJlcGxhY2UoLyMvZywgXCIgPiBcIikucmVwbGFjZShcIi5tZFwiLCBcIlwiKS5yZXBsYWNlKC9cXC8vZywgXCIgPiBcIik7XG4gICAgICBsZXQgbmV3X2NvbnRleHQgPSBgJHticmVhZGNydW1ic306XFxuYDtcbiAgICAgIC8vIGdldCBtYXggYXZhaWxhYmxlIGNoYXJzIHRvIGFkZCB0byBjb250ZXh0XG4gICAgICBjb25zdCBtYXhfYXZhaWxhYmxlX2NoYXJzID0gTUFYX0NIQVJTIC0gY2hhcl9hY2N1bSAtIG5ld19jb250ZXh0Lmxlbmd0aDtcbiAgICAgIGlmIChuZWFyZXN0W2ldLmxpbmsuaW5kZXhPZihcIiNcIikgIT09IC0xKSB7IC8vIGlzIGJsb2NrXG4gICAgICAgIG5ld19jb250ZXh0ICs9IGF3YWl0IHRoaXMucGx1Z2luLmJsb2NrX3JldHJpZXZlcihuZWFyZXN0W2ldLmxpbmssIHsgbWF4X2NoYXJzOiBtYXhfYXZhaWxhYmxlX2NoYXJzIH0pO1xuICAgICAgfSBlbHNlIHsgLy8gaXMgZmlsZVxuICAgICAgICBuZXdfY29udGV4dCArPSBhd2FpdCB0aGlzLnBsdWdpbi5maWxlX3JldHJpZXZlcihuZWFyZXN0W2ldLmxpbmssIHsgbWF4X2NoYXJzOiBtYXhfYXZhaWxhYmxlX2NoYXJzIH0pO1xuICAgICAgfVxuICAgICAgLy8gYWRkIHRvIGNoYXJfYWNjdW1cbiAgICAgIGNoYXJfYWNjdW0gKz0gbmV3X2NvbnRleHQubGVuZ3RoO1xuICAgICAgLy8gYWRkIHRvIGNvbnRleHRcbiAgICAgIGNvbnRleHQucHVzaCh7XG4gICAgICAgIGxpbms6IG5lYXJlc3RbaV0ubGluayxcbiAgICAgICAgdGV4dDogbmV3X2NvbnRleHRcbiAgICAgIH0pO1xuICAgIH1cbiAgICAvLyBjb250ZXh0IHNvdXJjZXNcbiAgICBjb25zb2xlLmxvZyhcImNvbnRleHQgc291cmNlczogXCIgKyBjb250ZXh0Lmxlbmd0aCk7XG4gICAgLy8gY2hhcl9hY2N1bSBkaXZpZGVkIGJ5IDQgYW5kIHJvdW5kZWQgdG8gbmVhcmVzdCBpbnRlZ2VyIGZvciBlc3RpbWF0ZWQgdG9rZW5zXG4gICAgY29uc29sZS5sb2coXCJ0b3RhbCBjb250ZXh0IHRva2VuczogflwiICsgTWF0aC5yb3VuZChjaGFyX2FjY3VtIC8gMy41KSk7XG4gICAgLy8gYnVpbGQgY29udGV4dCBpbnB1dFxuICAgIHRoaXMuY2hhdC5jb250ZXh0ID0gYEFudGljaXBhdGUgdGhlIHR5cGUgb2YgYW5zd2VyIGRlc2lyZWQgYnkgdGhlIHVzZXIuIEltYWdpbmUgdGhlIGZvbGxvd2luZyAke2NvbnRleHQubGVuZ3RofSBub3RlcyB3ZXJlIHdyaXR0ZW4gYnkgdGhlIHVzZXIgYW5kIGNvbnRhaW4gYWxsIHRoZSBuZWNlc3NhcnkgaW5mb3JtYXRpb24gdG8gYW5zd2VyIHRoZSB1c2VyJ3MgcXVlc3Rpb24uIEJlZ2luIHJlc3BvbnNlcyB3aXRoIFwiJHtTTUFSVF9UUkFOU0xBVElPTlt0aGlzLnBsdWdpbi5zZXR0aW5ncy5sYW5ndWFnZV0ucHJvbXB0fS4uLlwiYDtcbiAgICBmb3IobGV0IGkgPSAwOyBpIDwgY29udGV4dC5sZW5ndGg7IGkrKykge1xuICAgICAgdGhpcy5jaGF0LmNvbnRleHQgKz0gYFxcbi0tLUJFR0lOICMke2krMX0tLS1cXG4ke2NvbnRleHRbaV0udGV4dH1cXG4tLS1FTkQgIyR7aSsxfS0tLWA7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLmNoYXQuY29udGV4dDtcbiAgfVxuXG5cbn1cblxuZnVuY3Rpb24gZ2V0X21heF9jaGFycyhtb2RlbD1cImdwdC0zLjUtdHVyYm9cIikge1xuICBjb25zdCBNQVhfQ0hBUl9NQVAgPSB7XG4gICAgXCJncHQtMy41LXR1cmJvLTE2a1wiOiA0MDAwMCxcbiAgICBcImdwdC00XCI6IDIwMDAwLFxuICAgIFwiZ3B0LTMuNS10dXJib1wiOiAxMDAwMCxcbiAgfTtcbiAgcmV0dXJuIE1BWF9DSEFSX01BUFttb2RlbF07XG59XG4vKipcbiAqIFNtYXJ0Q29ubmVjdGlvbnNDaGF0TW9kZWxcbiAqIC0tLVxuICogLSAndGhyZWFkJyBmb3JtYXQ6IEFycmF5W0FycmF5W09iamVjdHtyb2xlLCBjb250ZW50LCBoeWRlfV1dXG4gKiAgLSBbVHVyblt2YXJpYXRpb257fV0sIFR1cm5bdmFyaWF0aW9ue30sIHZhcmlhdGlvbnt9XSwgLi4uXVxuICogLSBTYXZlcyBpbiAndGhyZWFkJyBmb3JtYXQgdG8gSlNPTiBmaWxlIGluIC5zbWFydC1jb25uZWN0aW9ucyBmb2xkZXIgdXNpbmcgY2hhdF9pZCBhcyBmaWxlbmFtZVxuICogLSBMb2FkcyBjaGF0IGluICd0aHJlYWQnIGZvcm1hdCBBcnJheVtBcnJheVtPYmplY3R7cm9sZSwgY29udGVudCwgaHlkZX1dXSBmcm9tIEpTT04gZmlsZSBpbiAuc21hcnQtY29ubmVjdGlvbnMgZm9sZGVyXG4gKiAtIHByZXBhcmVzIGNoYXRfbWwgcmV0dXJucyBpbiAnQ2hhdE1MJyBmb3JtYXQgXG4gKiAgLSBzdHJpcHMgYWxsIGJ1dCByb2xlIGFuZCBjb250ZW50IHByb3BlcnRpZXMgZnJvbSBPYmplY3QgaW4gQ2hhdE1MIGZvcm1hdFxuICogLSBDaGF0TUwgQXJyYXlbT2JqZWN0e3JvbGUsIGNvbnRlbnR9XVxuICogIC0gW0N1cnJlbnRfVmFyaWF0aW9uX0Zvcl9UdXJuXzF7fSwgQ3VycmVudF9WYXJpYXRpb25fRm9yX1R1cm5fMnt9LCAuLi5dXG4gKi9cbmNsYXNzIFNtYXJ0Q29ubmVjdGlvbnNDaGF0TW9kZWwge1xuICBjb25zdHJ1Y3RvcihwbHVnaW4pIHtcbiAgICB0aGlzLmFwcCA9IHBsdWdpbi5hcHA7XG4gICAgdGhpcy5wbHVnaW4gPSBwbHVnaW47XG4gICAgdGhpcy5jaGF0X2lkID0gbnVsbDtcbiAgICB0aGlzLmNoYXRfbWwgPSBbXTtcbiAgICB0aGlzLmNvbnRleHQgPSBudWxsO1xuICAgIHRoaXMuaHlkID0gbnVsbDtcbiAgICB0aGlzLnRocmVhZCA9IFtdO1xuICB9XG4gIGFzeW5jIHNhdmVfY2hhdCgpIHtcbiAgICAvLyByZXR1cm4gaWYgdGhyZWFkIGlzIGVtcHR5XG4gICAgaWYgKHRoaXMudGhyZWFkLmxlbmd0aCA9PT0gMCkgcmV0dXJuO1xuICAgIC8vIHNhdmUgY2hhdCB0byBmaWxlIGluIC5zbWFydC1jb25uZWN0aW9ucyBmb2xkZXJcbiAgICAvLyBjcmVhdGUgLnNtYXJ0LWNvbm5lY3Rpb25zL2NoYXRzLyBmb2xkZXIgaWYgaXQgZG9lc24ndCBleGlzdFxuICAgIGlmICghKGF3YWl0IHRoaXMuYXBwLnZhdWx0LmFkYXB0ZXIuZXhpc3RzKFwiLnNtYXJ0LWNvbm5lY3Rpb25zL2NoYXRzXCIpKSkge1xuICAgICAgYXdhaXQgdGhpcy5hcHAudmF1bHQuYWRhcHRlci5ta2RpcihcIi5zbWFydC1jb25uZWN0aW9ucy9jaGF0c1wiKTtcbiAgICB9XG4gICAgLy8gaWYgY2hhdF9pZCBpcyBub3Qgc2V0LCBzZXQgaXQgdG8gVU5USVRMRUQtJHt1bml4IHRpbWVzdGFtcH1cbiAgICBpZiAoIXRoaXMuY2hhdF9pZCkge1xuICAgICAgdGhpcy5jaGF0X2lkID0gdGhpcy5uYW1lKCkgKyBcIlx1MjAxNFwiICsgdGhpcy5nZXRfZmlsZV9kYXRlX3N0cmluZygpO1xuICAgIH1cbiAgICAvLyB2YWxpZGF0ZSBjaGF0X2lkIGlzIHNldCB0byB2YWxpZCBmaWxlbmFtZSBjaGFyYWN0ZXJzIChsZXR0ZXJzLCBudW1iZXJzLCB1bmRlcnNjb3JlcywgZGFzaGVzLCBlbSBkYXNoLCBhbmQgc3BhY2VzKVxuICAgIGlmICghdGhpcy5jaGF0X2lkLm1hdGNoKC9eW2EtekEtWjAtOV9cdTIwMTRcXC0gXSskLykpIHtcbiAgICAgIGNvbnNvbGUubG9nKFwiSW52YWxpZCBjaGF0X2lkOiBcIiArIHRoaXMuY2hhdF9pZCk7XG4gICAgICBuZXcgT2JzaWRpYW4uTm90aWNlKFwiW1NtYXJ0IENvbm5lY3Rpb25zXSBGYWlsZWQgdG8gc2F2ZSBjaGF0LiBJbnZhbGlkIGNoYXRfaWQ6ICdcIiArIHRoaXMuY2hhdF9pZCArIFwiJ1wiKTtcbiAgICB9XG4gICAgLy8gZmlsZW5hbWUgaXMgY2hhdF9pZFxuICAgIGNvbnN0IGNoYXRfZmlsZSA9IHRoaXMuY2hhdF9pZCArIFwiLmpzb25cIjtcbiAgICB0aGlzLmFwcC52YXVsdC5hZGFwdGVyLndyaXRlKFxuICAgICAgXCIuc21hcnQtY29ubmVjdGlvbnMvY2hhdHMvXCIgKyBjaGF0X2ZpbGUsXG4gICAgICBKU09OLnN0cmluZ2lmeSh0aGlzLnRocmVhZCwgbnVsbCwgMilcbiAgICApO1xuICB9XG4gIGFzeW5jIGxvYWRfY2hhdChjaGF0X2lkKSB7XG4gICAgdGhpcy5jaGF0X2lkID0gY2hhdF9pZDtcbiAgICAvLyBsb2FkIGNoYXQgZnJvbSBmaWxlIGluIC5zbWFydC1jb25uZWN0aW9ucyBmb2xkZXJcbiAgICAvLyBmaWxlbmFtZSBpcyBjaGF0X2lkXG4gICAgY29uc3QgY2hhdF9maWxlID0gdGhpcy5jaGF0X2lkICsgXCIuanNvblwiO1xuICAgIC8vIHJlYWQgZmlsZVxuICAgIGxldCBjaGF0X2pzb24gPSBhd2FpdCB0aGlzLmFwcC52YXVsdC5hZGFwdGVyLnJlYWQoXG4gICAgICBcIi5zbWFydC1jb25uZWN0aW9ucy9jaGF0cy9cIiArIGNoYXRfZmlsZVxuICAgICk7XG4gICAgLy8gcGFyc2UganNvblxuICAgIHRoaXMudGhyZWFkID0gSlNPTi5wYXJzZShjaGF0X2pzb24pO1xuICAgIC8vIGxvYWQgY2hhdF9tbFxuICAgIHRoaXMuY2hhdF9tbCA9IHRoaXMucHJlcGFyZV9jaGF0X21sKCk7XG4gICAgLy8gcmVuZGVyIG1lc3NhZ2VzIGluIGNoYXQgdmlld1xuICAgIC8vIGZvciBlYWNoIHR1cm4gaW4gY2hhdF9tbFxuICAgIC8vIGNvbnNvbGUubG9nKHRoaXMudGhyZWFkKTtcbiAgICAvLyBjb25zb2xlLmxvZyh0aGlzLmNoYXRfbWwpO1xuICB9XG4gIC8vIHByZXBhcmUgY2hhdF9tbCBmcm9tIGNoYXRcbiAgLy8gZ2V0cyB0aGUgbGFzdCBtZXNzYWdlIG9mIGVhY2ggdHVybiB1bmxlc3MgdHVybl92YXJpYXRpb25fb2Zmc2V0cz1bW3R1cm5faW5kZXgsdmFyaWF0aW9uX2luZGV4XV0gaXMgc3BlY2lmaWVkIGluIG9mZnNldFxuICBwcmVwYXJlX2NoYXRfbWwodHVybl92YXJpYXRpb25fb2Zmc2V0cz1bXSkge1xuICAgIC8vIGlmIG5vIHR1cm5fdmFyaWF0aW9uX29mZnNldHMsIGdldCB0aGUgbGFzdCBtZXNzYWdlIG9mIGVhY2ggdHVyblxuICAgIGlmKHR1cm5fdmFyaWF0aW9uX29mZnNldHMubGVuZ3RoID09PSAwKXtcbiAgICAgIHRoaXMuY2hhdF9tbCA9IHRoaXMudGhyZWFkLm1hcCh0dXJuID0+IHtcbiAgICAgICAgcmV0dXJuIHR1cm5bdHVybi5sZW5ndGggLSAxXTtcbiAgICAgIH0pO1xuICAgIH1lbHNle1xuICAgICAgLy8gY3JlYXRlIGFuIGFycmF5IGZyb20gdHVybl92YXJpYXRpb25fb2Zmc2V0cyB0aGF0IGluZGV4ZXMgdmFyaWF0aW9uX2luZGV4IGF0IHR1cm5faW5kZXhcbiAgICAgIC8vIGV4LiBbWzMsNV1dID0+IFt1bmRlZmluZWQsIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCA1XVxuICAgICAgbGV0IHR1cm5fdmFyaWF0aW9uX2luZGV4ID0gW107XG4gICAgICBmb3IobGV0IGkgPSAwOyBpIDwgdHVybl92YXJpYXRpb25fb2Zmc2V0cy5sZW5ndGg7IGkrKyl7XG4gICAgICAgIHR1cm5fdmFyaWF0aW9uX2luZGV4W3R1cm5fdmFyaWF0aW9uX29mZnNldHNbaV1bMF1dID0gdHVybl92YXJpYXRpb25fb2Zmc2V0c1tpXVsxXTtcbiAgICAgIH1cbiAgICAgIC8vIGxvb3AgdGhyb3VnaCBjaGF0XG4gICAgICB0aGlzLmNoYXRfbWwgPSB0aGlzLnRocmVhZC5tYXAoKHR1cm4sIHR1cm5faW5kZXgpID0+IHtcbiAgICAgICAgLy8gaWYgdGhlcmUgaXMgYW4gaW5kZXggZm9yIHRoaXMgdHVybiwgcmV0dXJuIHRoZSB2YXJpYXRpb24gYXQgdGhhdCBpbmRleFxuICAgICAgICBpZih0dXJuX3ZhcmlhdGlvbl9pbmRleFt0dXJuX2luZGV4XSAhPT0gdW5kZWZpbmVkKXtcbiAgICAgICAgICByZXR1cm4gdHVyblt0dXJuX3ZhcmlhdGlvbl9pbmRleFt0dXJuX2luZGV4XV07XG4gICAgICAgIH1cbiAgICAgICAgLy8gb3RoZXJ3aXNlIHJldHVybiB0aGUgbGFzdCBtZXNzYWdlIG9mIHRoZSB0dXJuXG4gICAgICAgIHJldHVybiB0dXJuW3R1cm4ubGVuZ3RoIC0gMV07XG4gICAgICB9KTtcbiAgICB9XG4gICAgLy8gc3RyaXAgYWxsIGJ1dCByb2xlIGFuZCBjb250ZW50IHByb3BlcnRpZXMgZnJvbSBlYWNoIG1lc3NhZ2VcbiAgICB0aGlzLmNoYXRfbWwgPSB0aGlzLmNoYXRfbWwubWFwKG1lc3NhZ2UgPT4ge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgcm9sZTogbWVzc2FnZS5yb2xlLFxuICAgICAgICBjb250ZW50OiBtZXNzYWdlLmNvbnRlbnRcbiAgICAgIH07XG4gICAgfSk7XG4gICAgcmV0dXJuIHRoaXMuY2hhdF9tbDtcbiAgfVxuICAvLyBlc3RpbWF0ZSB0b2tlbnMgaW4gY2hhdF9tbCBieSBzdW1taW5nIHRoZSBsZW5ndGggb2YgZWFjaCBtZXNzYWdlXG4gIC8vIGFuZCB0aGVuIGRpdmlkZSBieSAzIHRvIGVzdGltYXRlIG51bWJlciBvZiB0b2tlbnMgaW4gY2hhdF9tbCAodGVuZHMgdG8gb3ZlcmVzdGltYXRlKVxuICBlc3RpbWF0ZV9jdXJyZW50X3Rva2Vuc19pbl9jaGF0X21sKCkge1xuICAgIHJldHVybiBNYXRoLnJvdW5kKHRoaXMuY2hhdF9tbC5yZWR1Y2UoKGEsIGIpID0+IGEgKyBiLmNvbnRlbnQubGVuZ3RoLCAwKS8zKTtcbiAgfVxuICBsYXN0KCkge1xuICAgIC8vIGdldCBsYXN0IG1lc3NhZ2UgZnJvbSBjaGF0XG4gICAgcmV0dXJuIHRoaXMudGhyZWFkW3RoaXMudGhyZWFkLmxlbmd0aCAtIDFdW3RoaXMudGhyZWFkW3RoaXMudGhyZWFkLmxlbmd0aCAtIDFdLmxlbmd0aCAtIDFdO1xuICB9XG4gIGxhc3RfZnJvbSgpIHtcbiAgICByZXR1cm4gdGhpcy5sYXN0KCkucm9sZTtcbiAgfVxuICAvLyByZXR1cm5zIHVzZXJfaW5wdXQgb3IgY29tcGxldGlvblxuICBsYXN0X21lc3NhZ2UoKSB7XG4gICAgcmV0dXJuIHRoaXMubGFzdCgpLmNvbnRlbnQ7XG4gIH1cbiAgLy8gbWVzc2FnZT17fVxuICAvLyBhZGQgbmV3IG1lc3NhZ2UgdG8gdGhyZWFkXG4gIG5ld19tZXNzYWdlX2luX3RocmVhZChtZXNzYWdlLCB0dXJuPS0xKSB7XG4gICAgLy8gaWYgdHVybiBpcyAtMSwgYWRkIHRvIG5ldyB0dXJuXG4gICAgaWYodGhpcy5jb250ZXh0KXtcbiAgICAgIG1lc3NhZ2UuY29udGV4dCA9IHRoaXMuY29udGV4dDtcbiAgICAgIHRoaXMuY29udGV4dCA9IG51bGw7XG4gICAgfVxuICAgIGlmKHRoaXMuaHlkKXtcbiAgICAgIG1lc3NhZ2UuaHlkID0gdGhpcy5oeWQ7XG4gICAgICB0aGlzLmh5ZCA9IG51bGw7XG4gICAgfVxuICAgIGlmICh0dXJuID09PSAtMSkge1xuICAgICAgdGhpcy50aHJlYWQucHVzaChbbWVzc2FnZV0pO1xuICAgIH1lbHNle1xuICAgICAgLy8gb3RoZXJ3aXNlIGFkZCB0byBzcGVjaWZpZWQgdHVyblxuICAgICAgdGhpcy50aHJlYWRbdHVybl0ucHVzaChtZXNzYWdlKTtcbiAgICB9XG4gIH1cbiAgcmVzZXRfY29udGV4dCgpe1xuICAgIHRoaXMuY29udGV4dCA9IG51bGw7XG4gICAgdGhpcy5oeWQgPSBudWxsO1xuICB9XG4gIGFzeW5jIHJlbmFtZV9jaGF0KG5ld19uYW1lKXtcbiAgICAvLyBjaGVjayBpZiBjdXJyZW50IGNoYXRfaWQgZmlsZSBleGlzdHNcbiAgICBpZiAodGhpcy5jaGF0X2lkICYmIGF3YWl0IHRoaXMuYXBwLnZhdWx0LmFkYXB0ZXIuZXhpc3RzKFwiLnNtYXJ0LWNvbm5lY3Rpb25zL2NoYXRzL1wiICsgdGhpcy5jaGF0X2lkICsgXCIuanNvblwiKSkge1xuICAgICAgbmV3X25hbWUgPSB0aGlzLmNoYXRfaWQucmVwbGFjZSh0aGlzLm5hbWUoKSwgbmV3X25hbWUpO1xuICAgICAgLy8gcmVuYW1lIGZpbGUgaWYgaXQgZXhpc3RzXG4gICAgICBhd2FpdCB0aGlzLmFwcC52YXVsdC5hZGFwdGVyLnJlbmFtZShcbiAgICAgICAgXCIuc21hcnQtY29ubmVjdGlvbnMvY2hhdHMvXCIgKyB0aGlzLmNoYXRfaWQgKyBcIi5qc29uXCIsXG4gICAgICAgIFwiLnNtYXJ0LWNvbm5lY3Rpb25zL2NoYXRzL1wiICsgbmV3X25hbWUgKyBcIi5qc29uXCJcbiAgICAgICk7XG4gICAgICAvLyBzZXQgY2hhdF9pZCB0byBuZXdfbmFtZVxuICAgICAgdGhpcy5jaGF0X2lkID0gbmV3X25hbWU7XG4gICAgfWVsc2V7XG4gICAgICB0aGlzLmNoYXRfaWQgPSBuZXdfbmFtZSArIFwiXHUyMDE0XCIgKyB0aGlzLmdldF9maWxlX2RhdGVfc3RyaW5nKCk7XG4gICAgICAvLyBzYXZlIGNoYXRcbiAgICAgIGF3YWl0IHRoaXMuc2F2ZV9jaGF0KCk7XG4gICAgfVxuXG4gIH1cblxuICBuYW1lKCkge1xuICAgIGlmKHRoaXMuY2hhdF9pZCl7XG4gICAgICAvLyByZW1vdmUgZGF0ZSBhZnRlciBsYXN0IGVtIGRhc2hcbiAgICAgIHJldHVybiB0aGlzLmNoYXRfaWQucmVwbGFjZSgvXHUyMDE0W15cdTIwMTRdKiQvLFwiXCIpO1xuICAgIH1cbiAgICByZXR1cm4gXCJVTlRJVExFRFwiO1xuICB9XG5cbiAgZ2V0X2ZpbGVfZGF0ZV9zdHJpbmcoKSB7XG4gICAgcmV0dXJuIG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKS5yZXBsYWNlKC8oVHw6fFxcLi4qKS9nLCBcIiBcIikudHJpbSgpO1xuICB9XG4gIC8vIGdldCByZXNwb25zZSBmcm9tIHdpdGggbm90ZSBjb250ZXh0XG4gIGFzeW5jIGdldF9yZXNwb25zZV93aXRoX25vdGVfY29udGV4dCh1c2VyX2lucHV0LCBjaGF0X3ZpZXcpIHtcbiAgICBsZXQgc3lzdGVtX2lucHV0ID0gXCJJbWFnaW5lIHRoZSBmb2xsb3dpbmcgbm90ZXMgd2VyZSB3cml0dGVuIGJ5IHRoZSB1c2VyIGFuZCBjb250YWluIHRoZSBuZWNlc3NhcnkgaW5mb3JtYXRpb24gdG8gc3ludGhlc2l6ZSBhIHVzZWZ1bCBhbnN3ZXIgdGhlIHVzZXIncyBxdWVyeTpcXG5cIjtcbiAgICAvLyBleHRyYWN0IGludGVybmFsIGxpbmtzXG4gICAgY29uc3Qgbm90ZXMgPSB0aGlzLmV4dHJhY3RfaW50ZXJuYWxfbGlua3ModXNlcl9pbnB1dCk7XG4gICAgLy8gZ2V0IGNvbnRlbnQgb2YgaW50ZXJuYWwgbGlua3MgYXMgY29udGV4dFxuICAgIGxldCBtYXhfY2hhcnMgPSBnZXRfbWF4X2NoYXJzKHRoaXMucGx1Z2luLnNldHRpbmdzLnNtYXJ0X2NoYXRfbW9kZWwpO1xuICAgIGZvcihsZXQgaSA9IDA7IGkgPCBub3Rlcy5sZW5ndGg7IGkrKyl7XG4gICAgICAvLyBtYXggY2hhcnMgZm9yIHRoaXMgbm90ZSBpcyBtYXhfY2hhcnMgZGl2aWRlZCBieSBudW1iZXIgb2Ygbm90ZXMgbGVmdFxuICAgICAgY29uc3QgdGhpc19tYXhfY2hhcnMgPSAobm90ZXMubGVuZ3RoIC0gaSA+IDEpID8gTWF0aC5mbG9vcihtYXhfY2hhcnMgLyAobm90ZXMubGVuZ3RoIC0gaSkpIDogbWF4X2NoYXJzO1xuICAgICAgY29uc3Qgbm90ZV9jb250ZW50ID0gYXdhaXQgdGhpcy5nZXRfbm90ZV9jb250ZW50cyhub3Rlc1tpXSwge2NoYXJfbGltaXQ6IHRoaXNfbWF4X2NoYXJzfSk7XG4gICAgICBzeXN0ZW1faW5wdXQgKz0gYC0tLUJFR0lOIE5PVEU6IFtbJHtub3Rlc1tpXS5iYXNlbmFtZX1dXS0tLVxcbmBcbiAgICAgIHN5c3RlbV9pbnB1dCArPSBub3RlX2NvbnRlbnQ7XG4gICAgICBzeXN0ZW1faW5wdXQgKz0gYC0tLUVORCBOT1RFLS0tXFxuYFxuICAgICAgbWF4X2NoYXJzIC09IG5vdGVfY29udGVudC5sZW5ndGg7XG4gICAgICBpZihtYXhfY2hhcnMgPD0gMCkgYnJlYWs7XG4gICAgfVxuICAgIHRoaXMuY29udGV4dCA9IHN5c3RlbV9pbnB1dDtcbiAgICBjb25zdCBjaGF0bWwgPSBbXG4gICAgICB7XG4gICAgICAgIHJvbGU6IFwic3lzdGVtXCIsXG4gICAgICAgIGNvbnRlbnQ6IHN5c3RlbV9pbnB1dFxuICAgICAgfSxcbiAgICAgIHtcbiAgICAgICAgcm9sZTogXCJ1c2VyXCIsXG4gICAgICAgIGNvbnRlbnQ6IHVzZXJfaW5wdXRcbiAgICAgIH1cbiAgICBdO1xuICAgIGNoYXRfdmlldy5yZXF1ZXN0X2NoYXRncHRfY29tcGxldGlvbih7bWVzc2FnZXM6IGNoYXRtbCwgdGVtcGVyYXR1cmU6IDB9KTtcbiAgfVxuICAvLyBjaGVjayBpZiBjb250YWlucyBpbnRlcm5hbCBsaW5rXG4gIGNvbnRhaW5zX2ludGVybmFsX2xpbmsodXNlcl9pbnB1dCkge1xuICAgIGlmKHVzZXJfaW5wdXQuaW5kZXhPZihcIltbXCIpID09PSAtMSkgcmV0dXJuIGZhbHNlO1xuICAgIGlmKHVzZXJfaW5wdXQuaW5kZXhPZihcIl1dXCIpID09PSAtMSkgcmV0dXJuIGZhbHNlO1xuICAgIHJldHVybiB0cnVlO1xuICB9XG4gIC8vIGNoZWNrIGlmIGNvbnRhaW5zIGZvbGRlciByZWZlcmVuY2UgKGV4LiAvZm9sZGVyLywgb3IgL2ZvbGRlci9zdWJmb2xkZXIvKVxuICBjb250YWluc19mb2xkZXJfcmVmZXJlbmNlKHVzZXJfaW5wdXQpIHtcbiAgICBpZih1c2VyX2lucHV0LmluZGV4T2YoXCIvXCIpID09PSAtMSkgcmV0dXJuIGZhbHNlO1xuICAgIGlmKHVzZXJfaW5wdXQuaW5kZXhPZihcIi9cIikgPT09IHVzZXJfaW5wdXQubGFzdEluZGV4T2YoXCIvXCIpKSByZXR1cm4gZmFsc2U7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cbiAgLy8gZ2V0IGZvbGRlciByZWZlcmVuY2VzIGZyb20gdXNlciBpbnB1dFxuICBnZXRfZm9sZGVyX3JlZmVyZW5jZXModXNlcl9pbnB1dCkge1xuICAgIC8vIHVzZSB0aGlzLmZvbGRlcnMgdG8gZXh0cmFjdCBmb2xkZXIgcmVmZXJlbmNlcyBieSBsb25nZXN0IGZpcnN0IChleC4gL2ZvbGRlci9zdWJmb2xkZXIvIGJlZm9yZSAvZm9sZGVyLykgdG8gYXZvaWQgbWF0Y2hpbmcgL2ZvbGRlci9zdWJmb2xkZXIvIGFzIC9mb2xkZXIvXG4gICAgY29uc3QgZm9sZGVycyA9IHRoaXMucGx1Z2luLmZvbGRlcnMuc2xpY2UoKTsgLy8gY29weSBmb2xkZXJzIGFycmF5XG4gICAgY29uc3QgbWF0Y2hlcyA9IGZvbGRlcnMuc29ydCgoYSwgYikgPT4gYi5sZW5ndGggLSBhLmxlbmd0aCkubWFwKGZvbGRlciA9PiB7XG4gICAgICAvLyBjaGVjayBpZiBmb2xkZXIgaXMgaW4gdXNlcl9pbnB1dFxuICAgICAgaWYodXNlcl9pbnB1dC5pbmRleE9mKGZvbGRlcikgIT09IC0xKXtcbiAgICAgICAgLy8gcmVtb3ZlIGZvbGRlciBmcm9tIHVzZXJfaW5wdXQgdG8gcHJldmVudCBtYXRjaGluZyAvZm9sZGVyL3N1YmZvbGRlci8gYXMgL2ZvbGRlci9cbiAgICAgICAgdXNlcl9pbnB1dCA9IHVzZXJfaW5wdXQucmVwbGFjZShmb2xkZXIsIFwiXCIpO1xuICAgICAgICByZXR1cm4gZm9sZGVyO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH0pLmZpbHRlcihmb2xkZXIgPT4gZm9sZGVyKTtcbiAgICBjb25zb2xlLmxvZyhtYXRjaGVzKTtcbiAgICAvLyByZXR1cm4gYXJyYXkgb2YgbWF0Y2hlc1xuICAgIGlmKG1hdGNoZXMpIHJldHVybiBtYXRjaGVzO1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG5cbiAgLy8gZXh0cmFjdCBpbnRlcm5hbCBsaW5rc1xuICBleHRyYWN0X2ludGVybmFsX2xpbmtzKHVzZXJfaW5wdXQpIHtcbiAgICBjb25zdCBtYXRjaGVzID0gdXNlcl9pbnB1dC5tYXRjaCgvXFxbXFxbKC4qPylcXF1cXF0vZyk7XG4gICAgY29uc29sZS5sb2cobWF0Y2hlcyk7XG4gICAgLy8gcmV0dXJuIGFycmF5IG9mIFRGaWxlIG9iamVjdHNcbiAgICBpZihtYXRjaGVzKSByZXR1cm4gbWF0Y2hlcy5tYXAobWF0Y2ggPT4ge1xuICAgICAgcmV0dXJuIHRoaXMuYXBwLm1ldGFkYXRhQ2FjaGUuZ2V0Rmlyc3RMaW5rcGF0aERlc3QobWF0Y2gucmVwbGFjZShcIltbXCIsIFwiXCIpLnJlcGxhY2UoXCJdXVwiLCBcIlwiKSwgXCIvXCIpO1xuICAgIH0pO1xuICAgIHJldHVybiBbXTtcbiAgfVxuICAvLyBnZXQgY29udGV4dCBmcm9tIGludGVybmFsIGxpbmtzXG4gIGFzeW5jIGdldF9ub3RlX2NvbnRlbnRzKG5vdGUsIG9wdHM9e30pIHtcbiAgICBvcHRzID0ge1xuICAgICAgY2hhcl9saW1pdDogMTAwMDAsXG4gICAgICAuLi5vcHRzXG4gICAgfVxuICAgIC8vIHJldHVybiBpZiBub3RlIGlzIG5vdCBhIGZpbGVcbiAgICBpZighKG5vdGUgaW5zdGFuY2VvZiBPYnNpZGlhbi5URmlsZSkpIHJldHVybiBcIlwiO1xuICAgIC8vIGdldCBmaWxlIGNvbnRlbnRcbiAgICBsZXQgZmlsZV9jb250ZW50ID0gYXdhaXQgdGhpcy5hcHAudmF1bHQuY2FjaGVkUmVhZChub3RlKTtcbiAgICAvLyBjaGVjayBpZiBjb250YWlucyBkYXRhdmlldyBjb2RlIGJsb2NrXG4gICAgaWYoZmlsZV9jb250ZW50LmluZGV4T2YoXCJgYGBkYXRhdmlld1wiKSA+IC0xKXtcbiAgICAgIC8vIGlmIGNvbnRhaW5zIGRhdGF2aWV3IGNvZGUgYmxvY2sgZ2V0IGFsbCBkYXRhdmlldyBjb2RlIGJsb2Nrc1xuICAgICAgZmlsZV9jb250ZW50ID0gYXdhaXQgdGhpcy5yZW5kZXJfZGF0YXZpZXdfcXVlcmllcyhmaWxlX2NvbnRlbnQsIG5vdGUucGF0aCwgb3B0cyk7XG4gICAgfVxuICAgIHJldHVybiBmaWxlX2NvbnRlbnQuc3Vic3RyaW5nKDAsIG9wdHMuY2hhcl9saW1pdCk7XG4gIH1cblxuXG4gIGFzeW5jIHJlbmRlcl9kYXRhdmlld19xdWVyaWVzKGZpbGVfY29udGVudCwgbm90ZV9wYXRoLCBvcHRzPXt9KSB7XG4gICAgb3B0cyA9IHtcbiAgICAgIGNoYXJfbGltaXQ6IG51bGwsXG4gICAgICAuLi5vcHRzXG4gICAgfTtcbiAgICAvLyB1c2Ugd2luZG93IHRvIGdldCBkYXRhdmlldyBhcGlcbiAgICBjb25zdCBkYXRhdmlld19hcGkgPSB3aW5kb3dbXCJEYXRhdmlld0FQSVwiXTtcbiAgICAvLyBza2lwIGlmIGRhdGF2aWV3IGFwaSBub3QgZm91bmRcbiAgICBpZighZGF0YXZpZXdfYXBpKSByZXR1cm4gZmlsZV9jb250ZW50O1xuICAgIGNvbnN0IGRhdGF2aWV3X2NvZGVfYmxvY2tzID0gZmlsZV9jb250ZW50Lm1hdGNoKC9gYGBkYXRhdmlldyguKj8pYGBgL2dzKTtcbiAgICAvLyBmb3IgZWFjaCBkYXRhdmlldyBjb2RlIGJsb2NrXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBkYXRhdmlld19jb2RlX2Jsb2Nrcy5sZW5ndGg7IGkrKykge1xuICAgICAgLy8gaWYgb3B0cyBjaGFyX2xpbWl0IGlzIGxlc3MgdGhhbiBpbmRleE9mIGRhdGF2aWV3IGNvZGUgYmxvY2ssIGJyZWFrXG4gICAgICBpZihvcHRzLmNoYXJfbGltaXQgJiYgb3B0cy5jaGFyX2xpbWl0IDwgZmlsZV9jb250ZW50LmluZGV4T2YoZGF0YXZpZXdfY29kZV9ibG9ja3NbaV0pKSBicmVhaztcbiAgICAgIC8vIGdldCBkYXRhdmlldyBjb2RlIGJsb2NrXG4gICAgICBjb25zdCBkYXRhdmlld19jb2RlX2Jsb2NrID0gZGF0YXZpZXdfY29kZV9ibG9ja3NbaV07XG4gICAgICAvLyBnZXQgY29udGVudCBvZiBkYXRhdmlldyBjb2RlIGJsb2NrXG4gICAgICBjb25zdCBkYXRhdmlld19jb2RlX2Jsb2NrX2NvbnRlbnQgPSBkYXRhdmlld19jb2RlX2Jsb2NrLnJlcGxhY2UoXCJgYGBkYXRhdmlld1wiLCBcIlwiKS5yZXBsYWNlKFwiYGBgXCIsIFwiXCIpO1xuICAgICAgLy8gZ2V0IGRhdGF2aWV3IHF1ZXJ5IHJlc3VsdFxuICAgICAgY29uc3QgZGF0YXZpZXdfcXVlcnlfcmVzdWx0ID0gYXdhaXQgZGF0YXZpZXdfYXBpLnF1ZXJ5TWFya2Rvd24oZGF0YXZpZXdfY29kZV9ibG9ja19jb250ZW50LCBub3RlX3BhdGgsIG51bGwpO1xuICAgICAgLy8gaWYgcXVlcnkgcmVzdWx0IGlzIHN1Y2Nlc3NmdWwsIHJlcGxhY2UgZGF0YXZpZXcgY29kZSBibG9jayB3aXRoIHF1ZXJ5IHJlc3VsdFxuICAgICAgaWYgKGRhdGF2aWV3X3F1ZXJ5X3Jlc3VsdC5zdWNjZXNzZnVsKSB7XG4gICAgICAgIGZpbGVfY29udGVudCA9IGZpbGVfY29udGVudC5yZXBsYWNlKGRhdGF2aWV3X2NvZGVfYmxvY2ssIGRhdGF2aWV3X3F1ZXJ5X3Jlc3VsdC52YWx1ZSk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBmaWxlX2NvbnRlbnQ7XG4gIH1cbn1cblxuY2xhc3MgU21hcnRDb25uZWN0aW9uc0NoYXRIaXN0b3J5TW9kYWwgZXh0ZW5kcyBPYnNpZGlhbi5GdXp6eVN1Z2dlc3RNb2RhbCB7XG4gIGNvbnN0cnVjdG9yKGFwcCwgdmlldywgZmlsZXMpIHtcbiAgICBzdXBlcihhcHApO1xuICAgIHRoaXMuYXBwID0gYXBwO1xuICAgIHRoaXMudmlldyA9IHZpZXc7XG4gICAgdGhpcy5zZXRQbGFjZWhvbGRlcihcIlR5cGUgdGhlIG5hbWUgb2YgYSBjaGF0IHNlc3Npb24uLi5cIik7XG4gIH1cbiAgZ2V0SXRlbXMoKSB7XG4gICAgaWYgKCF0aGlzLnZpZXcuZmlsZXMpIHtcbiAgICAgIHJldHVybiBbXTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMudmlldy5maWxlcztcbiAgfVxuICBnZXRJdGVtVGV4dChpdGVtKSB7XG4gICAgLy8gaWYgbm90IFVOVElUTEVELCByZW1vdmUgZGF0ZSBhZnRlciBsYXN0IGVtIGRhc2hcbiAgICBpZihpdGVtLmluZGV4T2YoXCJVTlRJVExFRFwiKSA9PT0gLTEpe1xuICAgICAgaXRlbS5yZXBsYWNlKC9cdTIwMTRbXlx1MjAxNF0qJC8sXCJcIik7XG4gICAgfVxuICAgIHJldHVybiBpdGVtO1xuICB9XG4gIG9uQ2hvb3NlSXRlbShzZXNzaW9uKSB7XG4gICAgdGhpcy52aWV3Lm9wZW5fY2hhdChzZXNzaW9uKTtcbiAgfVxufVxuXG4vLyBGaWxlIFNlbGVjdCBGdXp6eSBTdWdnZXN0IE1vZGFsXG5jbGFzcyBTbWFydENvbm5lY3Rpb25zRmlsZVNlbGVjdE1vZGFsIGV4dGVuZHMgT2JzaWRpYW4uRnV6enlTdWdnZXN0TW9kYWwge1xuICBjb25zdHJ1Y3RvcihhcHAsIHZpZXcpIHtcbiAgICBzdXBlcihhcHApO1xuICAgIHRoaXMuYXBwID0gYXBwO1xuICAgIHRoaXMudmlldyA9IHZpZXc7XG4gICAgdGhpcy5zZXRQbGFjZWhvbGRlcihcIlR5cGUgdGhlIG5hbWUgb2YgYSBmaWxlLi4uXCIpO1xuICB9XG4gIGdldEl0ZW1zKCkge1xuICAgIC8vIGdldCBhbGwgbWFya2Rvd24gZmlsZXNcbiAgICByZXR1cm4gdGhpcy5hcHAudmF1bHQuZ2V0TWFya2Rvd25GaWxlcygpLnNvcnQoKGEsIGIpID0+IGEuYmFzZW5hbWUubG9jYWxlQ29tcGFyZShiLmJhc2VuYW1lKSk7XG4gIH1cbiAgZ2V0SXRlbVRleHQoaXRlbSkge1xuICAgIHJldHVybiBpdGVtLmJhc2VuYW1lO1xuICB9XG4gIG9uQ2hvb3NlSXRlbShmaWxlKSB7XG4gICAgdGhpcy52aWV3Lmluc2VydF9zZWxlY3Rpb24oZmlsZS5iYXNlbmFtZSArIFwiXV0gXCIpO1xuICB9XG59XG4vLyBGb2xkZXIgU2VsZWN0IEZ1enp5IFN1Z2dlc3QgTW9kYWxcbmNsYXNzIFNtYXJ0Q29ubmVjdGlvbnNGb2xkZXJTZWxlY3RNb2RhbCBleHRlbmRzIE9ic2lkaWFuLkZ1enp5U3VnZ2VzdE1vZGFsIHtcbiAgY29uc3RydWN0b3IoYXBwLCB2aWV3KSB7XG4gICAgc3VwZXIoYXBwKTtcbiAgICB0aGlzLmFwcCA9IGFwcDtcbiAgICB0aGlzLnZpZXcgPSB2aWV3O1xuICAgIHRoaXMuc2V0UGxhY2Vob2xkZXIoXCJUeXBlIHRoZSBuYW1lIG9mIGEgZm9sZGVyLi4uXCIpO1xuICB9XG4gIGdldEl0ZW1zKCkge1xuICAgIHJldHVybiB0aGlzLnZpZXcucGx1Z2luLmZvbGRlcnM7XG4gIH1cbiAgZ2V0SXRlbVRleHQoaXRlbSkge1xuICAgIHJldHVybiBpdGVtO1xuICB9XG4gIG9uQ2hvb3NlSXRlbShmb2xkZXIpIHtcbiAgICB0aGlzLnZpZXcuaW5zZXJ0X3NlbGVjdGlvbihmb2xkZXIgKyBcIi8gXCIpO1xuICB9XG59XG5cblxuLy8gSGFuZGxlIEFQSSByZXNwb25zZSBzdHJlYW1pbmdcbmNsYXNzIFNjU3RyZWFtZXIge1xuICAvLyBjb25zdHJ1Y3RvclxuICBjb25zdHJ1Y3Rvcih1cmwsIG9wdGlvbnMpIHtcbiAgICAvLyBzZXQgZGVmYXVsdCBvcHRpb25zXG4gICAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG4gICAgdGhpcy51cmwgPSB1cmw7XG4gICAgdGhpcy5tZXRob2QgPSBvcHRpb25zLm1ldGhvZCB8fCAnR0VUJztcbiAgICB0aGlzLmhlYWRlcnMgPSBvcHRpb25zLmhlYWRlcnMgfHwge307XG4gICAgdGhpcy5wYXlsb2FkID0gb3B0aW9ucy5wYXlsb2FkIHx8IG51bGw7XG4gICAgdGhpcy53aXRoQ3JlZGVudGlhbHMgPSBvcHRpb25zLndpdGhDcmVkZW50aWFscyB8fCBmYWxzZTtcbiAgICB0aGlzLmxpc3RlbmVycyA9IHt9O1xuICAgIHRoaXMucmVhZHlTdGF0ZSA9IHRoaXMuQ09OTkVDVElORztcbiAgICB0aGlzLnByb2dyZXNzID0gMDtcbiAgICB0aGlzLmNodW5rID0gJyc7XG4gICAgdGhpcy54aHIgPSBudWxsO1xuICAgIHRoaXMuRklFTERfU0VQQVJBVE9SID0gJzonO1xuICAgIHRoaXMuSU5JVElBTElaSU5HID0gLTE7XG4gICAgdGhpcy5DT05ORUNUSU5HID0gMDtcbiAgICB0aGlzLk9QRU4gPSAxO1xuICAgIHRoaXMuQ0xPU0VEID0gMjtcbiAgfVxuICAvLyBhZGRFdmVudExpc3RlbmVyXG4gIGFkZEV2ZW50TGlzdGVuZXIodHlwZSwgbGlzdGVuZXIpIHtcbiAgICAvLyBjaGVjayBpZiB0aGUgdHlwZSBpcyBpbiB0aGUgbGlzdGVuZXJzXG4gICAgaWYgKCF0aGlzLmxpc3RlbmVyc1t0eXBlXSkge1xuICAgICAgdGhpcy5saXN0ZW5lcnNbdHlwZV0gPSBbXTtcbiAgICB9XG4gICAgLy8gY2hlY2sgaWYgdGhlIGxpc3RlbmVyIGlzIGFscmVhZHkgaW4gdGhlIGxpc3RlbmVyc1xuICAgIGlmKHRoaXMubGlzdGVuZXJzW3R5cGVdLmluZGV4T2YobGlzdGVuZXIpID09PSAtMSkge1xuICAgICAgdGhpcy5saXN0ZW5lcnNbdHlwZV0ucHVzaChsaXN0ZW5lcik7XG4gICAgfVxuICB9XG4gIC8vIHJlbW92ZUV2ZW50TGlzdGVuZXJcbiAgcmVtb3ZlRXZlbnRMaXN0ZW5lcih0eXBlLCBsaXN0ZW5lcikge1xuICAgIC8vIGNoZWNrIGlmIGxpc3RlbmVyIHR5cGUgaXMgdW5kZWZpbmVkXG4gICAgaWYgKCF0aGlzLmxpc3RlbmVyc1t0eXBlXSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBsZXQgZmlsdGVyZWQgPSBbXTtcbiAgICAvLyBsb29wIHRocm91Z2ggdGhlIGxpc3RlbmVyc1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5saXN0ZW5lcnNbdHlwZV0ubGVuZ3RoOyBpKyspIHtcbiAgICAgIC8vIGNoZWNrIGlmIHRoZSBsaXN0ZW5lciBpcyB0aGUgc2FtZVxuICAgICAgaWYgKHRoaXMubGlzdGVuZXJzW3R5cGVdW2ldICE9PSBsaXN0ZW5lcikge1xuICAgICAgICBmaWx0ZXJlZC5wdXNoKHRoaXMubGlzdGVuZXJzW3R5cGVdW2ldKTtcbiAgICAgIH1cbiAgICB9XG4gICAgLy8gY2hlY2sgaWYgdGhlIGxpc3RlbmVycyBhcmUgZW1wdHlcbiAgICBpZiAodGhpcy5saXN0ZW5lcnNbdHlwZV0ubGVuZ3RoID09PSAwKSB7XG4gICAgICBkZWxldGUgdGhpcy5saXN0ZW5lcnNbdHlwZV07XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMubGlzdGVuZXJzW3R5cGVdID0gZmlsdGVyZWQ7XG4gICAgfVxuICB9XG4gIC8vIGRpc3BhdGNoRXZlbnRcbiAgZGlzcGF0Y2hFdmVudChldmVudCkge1xuICAgIC8vIGlmIG5vIGV2ZW50IHJldHVybiB0cnVlXG4gICAgaWYgKCFldmVudCkge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIC8vIHNldCBldmVudCBzb3VyY2UgdG8gdGhpc1xuICAgIGV2ZW50LnNvdXJjZSA9IHRoaXM7XG4gICAgLy8gc2V0IG9uSGFuZGxlciB0byBvbiArIGV2ZW50IHR5cGVcbiAgICBsZXQgb25IYW5kbGVyID0gJ29uJyArIGV2ZW50LnR5cGU7XG4gICAgLy8gY2hlY2sgaWYgdGhlIG9uSGFuZGxlciBoYXMgb3duIHByb3BlcnR5IG5hbWVkIHNhbWUgYXMgb25IYW5kbGVyXG4gICAgaWYgKHRoaXMuaGFzT3duUHJvcGVydHkob25IYW5kbGVyKSkge1xuICAgICAgLy8gY2FsbCB0aGUgb25IYW5kbGVyXG4gICAgICB0aGlzW29uSGFuZGxlcl0uY2FsbCh0aGlzLCBldmVudCk7XG4gICAgICAvLyBjaGVjayBpZiB0aGUgZXZlbnQgaXMgZGVmYXVsdCBwcmV2ZW50ZWRcbiAgICAgIGlmIChldmVudC5kZWZhdWx0UHJldmVudGVkKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICB9XG4gICAgLy8gY2hlY2sgaWYgdGhlIGV2ZW50IHR5cGUgaXMgaW4gdGhlIGxpc3RlbmVyc1xuICAgIGlmICh0aGlzLmxpc3RlbmVyc1tldmVudC50eXBlXSkge1xuICAgICAgcmV0dXJuIHRoaXMubGlzdGVuZXJzW2V2ZW50LnR5cGVdLmV2ZXJ5KGZ1bmN0aW9uKGNhbGxiYWNrKSB7XG4gICAgICAgIGNhbGxiYWNrKGV2ZW50KTtcbiAgICAgICAgcmV0dXJuICFldmVudC5kZWZhdWx0UHJldmVudGVkO1xuICAgICAgfSk7XG4gICAgfVxuICAgIHJldHVybiB0cnVlO1xuICB9XG4gIC8vIF9zZXRSZWFkeVN0YXRlXG4gIF9zZXRSZWFkeVN0YXRlKHN0YXRlKSB7XG4gICAgLy8gc2V0IGV2ZW50IHR5cGUgdG8gcmVhZHlTdGF0ZUNoYW5nZVxuICAgIGxldCBldmVudCA9IG5ldyBDdXN0b21FdmVudCgncmVhZHlTdGF0ZUNoYW5nZScpO1xuICAgIC8vIHNldCBldmVudCByZWFkeVN0YXRlIHRvIHN0YXRlXG4gICAgZXZlbnQucmVhZHlTdGF0ZSA9IHN0YXRlO1xuICAgIC8vIHNldCByZWFkeVN0YXRlIHRvIHN0YXRlXG4gICAgdGhpcy5yZWFkeVN0YXRlID0gc3RhdGU7XG4gICAgLy8gZGlzcGF0Y2ggZXZlbnRcbiAgICB0aGlzLmRpc3BhdGNoRXZlbnQoZXZlbnQpO1xuICB9XG4gIC8vIF9vblN0cmVhbUZhaWx1cmVcbiAgX29uU3RyZWFtRmFpbHVyZShlKSB7XG4gICAgLy8gc2V0IGV2ZW50IHR5cGUgdG8gZXJyb3JcbiAgICBsZXQgZXZlbnQgPSBuZXcgQ3VzdG9tRXZlbnQoJ2Vycm9yJyk7XG4gICAgLy8gc2V0IGV2ZW50IGRhdGEgdG8gZVxuICAgIGV2ZW50LmRhdGEgPSBlLmN1cnJlbnRUYXJnZXQucmVzcG9uc2U7XG4gICAgLy8gZGlzcGF0Y2ggZXZlbnRcbiAgICB0aGlzLmRpc3BhdGNoRXZlbnQoZXZlbnQpO1xuICAgIHRoaXMuY2xvc2UoKTtcbiAgfVxuICAvLyBfb25TdHJlYW1BYm9ydFxuICBfb25TdHJlYW1BYm9ydChlKSB7XG4gICAgLy8gc2V0IHRvIGFib3J0XG4gICAgbGV0IGV2ZW50ID0gbmV3IEN1c3RvbUV2ZW50KCdhYm9ydCcpO1xuICAgIC8vIGNsb3NlXG4gICAgdGhpcy5jbG9zZSgpO1xuICB9XG4gIC8vIF9vblN0cmVhbVByb2dyZXNzXG4gIF9vblN0cmVhbVByb2dyZXNzKGUpIHtcbiAgICAvLyBpZiBub3QgeGhyIHJldHVyblxuICAgIGlmICghdGhpcy54aHIpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgLy8gaWYgeGhyIHN0YXR1cyBpcyBub3QgMjAwIHJldHVyblxuICAgIGlmICh0aGlzLnhoci5zdGF0dXMgIT09IDIwMCkge1xuICAgICAgLy8gb25TdHJlYW1GYWlsdXJlXG4gICAgICB0aGlzLl9vblN0cmVhbUZhaWx1cmUoZSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIC8vIGlmIHJlYWR5IHN0YXRlIGlzIENPTk5FQ1RJTkdcbiAgICBpZiAodGhpcy5yZWFkeVN0YXRlID09PSB0aGlzLkNPTk5FQ1RJTkcpIHtcbiAgICAgIC8vIGRpc3BhdGNoIGV2ZW50XG4gICAgICB0aGlzLmRpc3BhdGNoRXZlbnQobmV3IEN1c3RvbUV2ZW50KCdvcGVuJykpO1xuICAgICAgLy8gc2V0IHJlYWR5IHN0YXRlIHRvIE9QRU5cbiAgICAgIHRoaXMuX3NldFJlYWR5U3RhdGUodGhpcy5PUEVOKTtcbiAgICB9XG4gICAgLy8gcGFyc2UgdGhlIHJlY2VpdmVkIGRhdGEuXG4gICAgbGV0IGRhdGEgPSB0aGlzLnhoci5yZXNwb25zZVRleHQuc3Vic3RyaW5nKHRoaXMucHJvZ3Jlc3MpO1xuICAgIC8vIHVwZGF0ZSBwcm9ncmVzc1xuICAgIHRoaXMucHJvZ3Jlc3MgKz0gZGF0YS5sZW5ndGg7XG4gICAgLy8gc3BsaXQgdGhlIGRhdGEgYnkgbmV3IGxpbmUgYW5kIHBhcnNlIGVhY2ggbGluZVxuICAgIGRhdGEuc3BsaXQoLyhcXHJcXG58XFxyfFxcbil7Mn0vZykuZm9yRWFjaChmdW5jdGlvbihwYXJ0KXtcbiAgICAgIGlmKHBhcnQudHJpbSgpLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICB0aGlzLmRpc3BhdGNoRXZlbnQodGhpcy5fcGFyc2VFdmVudENodW5rKHRoaXMuY2h1bmsudHJpbSgpKSk7XG4gICAgICAgIHRoaXMuY2h1bmsgPSAnJztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuY2h1bmsgKz0gcGFydDtcbiAgICAgIH1cbiAgICB9LmJpbmQodGhpcykpO1xuICB9XG4gIC8vIF9vblN0cmVhbUxvYWRlZFxuICBfb25TdHJlYW1Mb2FkZWQoZSkge1xuICAgIHRoaXMuX29uU3RyZWFtUHJvZ3Jlc3MoZSk7XG4gICAgLy8gcGFyc2UgdGhlIGxhc3QgY2h1bmtcbiAgICB0aGlzLmRpc3BhdGNoRXZlbnQodGhpcy5fcGFyc2VFdmVudENodW5rKHRoaXMuY2h1bmspKTtcbiAgICB0aGlzLmNodW5rID0gJyc7XG4gIH1cbiAgLy8gX3BhcnNlRXZlbnRDaHVua1xuICBfcGFyc2VFdmVudENodW5rKGNodW5rKSB7XG4gICAgLy8gaWYgbm8gY2h1bmsgb3IgY2h1bmsgaXMgZW1wdHkgcmV0dXJuXG4gICAgaWYgKCFjaHVuayB8fCBjaHVuay5sZW5ndGggPT09IDApIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICAvLyBpbml0IGVcbiAgICBsZXQgZSA9IHtpZDogbnVsbCwgcmV0cnk6IG51bGwsIGRhdGE6ICcnLCBldmVudDogJ21lc3NhZ2UnfTtcbiAgICAvLyBzcGxpdCB0aGUgY2h1bmsgYnkgbmV3IGxpbmVcbiAgICBjaHVuay5zcGxpdCgvKFxcclxcbnxcXHJ8XFxuKS8pLmZvckVhY2goZnVuY3Rpb24obGluZSkge1xuICAgICAgbGluZSA9IGxpbmUudHJpbVJpZ2h0KCk7XG4gICAgICBsZXQgaW5kZXggPSBsaW5lLmluZGV4T2YodGhpcy5GSUVMRF9TRVBBUkFUT1IpO1xuICAgICAgaWYoaW5kZXggPD0gMCkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICAvLyBmaWVsZFxuICAgICAgbGV0IGZpZWxkID0gbGluZS5zdWJzdHJpbmcoMCwgaW5kZXgpO1xuICAgICAgaWYoIShmaWVsZCBpbiBlKSkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICAvLyB2YWx1ZVxuICAgICAgbGV0IHZhbHVlID0gbGluZS5zdWJzdHJpbmcoaW5kZXggKyAxKS50cmltTGVmdCgpO1xuICAgICAgaWYoZmllbGQgPT09ICdkYXRhJykge1xuICAgICAgICBlW2ZpZWxkXSArPSB2YWx1ZTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGVbZmllbGRdID0gdmFsdWU7XG4gICAgICB9XG4gICAgfS5iaW5kKHRoaXMpKTtcbiAgICAvLyByZXR1cm4gZXZlbnRcbiAgICBsZXQgZXZlbnQgPSBuZXcgQ3VzdG9tRXZlbnQoZS5ldmVudCk7XG4gICAgZXZlbnQuZGF0YSA9IGUuZGF0YTtcbiAgICBldmVudC5pZCA9IGUuaWQ7XG4gICAgcmV0dXJuIGV2ZW50O1xuICB9XG4gIC8vIF9jaGVja1N0cmVhbUNsb3NlZFxuICBfY2hlY2tTdHJlYW1DbG9zZWQoKSB7XG4gICAgaWYoIXRoaXMueGhyKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGlmKHRoaXMueGhyLnJlYWR5U3RhdGUgPT09IFhNTEh0dHBSZXF1ZXN0LkRPTkUpIHtcbiAgICAgIHRoaXMuX3NldFJlYWR5U3RhdGUodGhpcy5DTE9TRUQpO1xuICAgIH1cbiAgfVxuICAvLyBzdHJlYW1cbiAgc3RyZWFtKCkge1xuICAgIC8vIHNldCByZWFkeSBzdGF0ZSB0byBjb25uZWN0aW5nXG4gICAgdGhpcy5fc2V0UmVhZHlTdGF0ZSh0aGlzLkNPTk5FQ1RJTkcpO1xuICAgIC8vIHNldCB4aHIgdG8gbmV3IFhNTEh0dHBSZXF1ZXN0XG4gICAgdGhpcy54aHIgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcbiAgICAvLyBzZXQgeGhyIHByb2dyZXNzIHRvIF9vblN0cmVhbVByb2dyZXNzXG4gICAgdGhpcy54aHIuYWRkRXZlbnRMaXN0ZW5lcigncHJvZ3Jlc3MnLCB0aGlzLl9vblN0cmVhbVByb2dyZXNzLmJpbmQodGhpcykpO1xuICAgIC8vIHNldCB4aHIgbG9hZCB0byBfb25TdHJlYW1Mb2FkZWRcbiAgICB0aGlzLnhoci5hZGRFdmVudExpc3RlbmVyKCdsb2FkJywgdGhpcy5fb25TdHJlYW1Mb2FkZWQuYmluZCh0aGlzKSk7XG4gICAgLy8gc2V0IHhociByZWFkeSBzdGF0ZSBjaGFuZ2UgdG8gX2NoZWNrU3RyZWFtQ2xvc2VkXG4gICAgdGhpcy54aHIuYWRkRXZlbnRMaXN0ZW5lcigncmVhZHlzdGF0ZWNoYW5nZScsIHRoaXMuX2NoZWNrU3RyZWFtQ2xvc2VkLmJpbmQodGhpcykpO1xuICAgIC8vIHNldCB4aHIgZXJyb3IgdG8gX29uU3RyZWFtRmFpbHVyZVxuICAgIHRoaXMueGhyLmFkZEV2ZW50TGlzdGVuZXIoJ2Vycm9yJywgdGhpcy5fb25TdHJlYW1GYWlsdXJlLmJpbmQodGhpcykpO1xuICAgIC8vIHNldCB4aHIgYWJvcnQgdG8gX29uU3RyZWFtQWJvcnRcbiAgICB0aGlzLnhoci5hZGRFdmVudExpc3RlbmVyKCdhYm9ydCcsIHRoaXMuX29uU3RyZWFtQWJvcnQuYmluZCh0aGlzKSk7XG4gICAgLy8gb3BlbiB4aHJcbiAgICB0aGlzLnhoci5vcGVuKHRoaXMubWV0aG9kLCB0aGlzLnVybCk7XG4gICAgLy8gaGVhZGVycyB0byB4aHJcbiAgICBmb3IgKGxldCBoZWFkZXIgaW4gdGhpcy5oZWFkZXJzKSB7XG4gICAgICB0aGlzLnhoci5zZXRSZXF1ZXN0SGVhZGVyKGhlYWRlciwgdGhpcy5oZWFkZXJzW2hlYWRlcl0pO1xuICAgIH1cbiAgICAvLyBjcmVkZW50aWFscyB0byB4aHJcbiAgICB0aGlzLnhoci53aXRoQ3JlZGVudGlhbHMgPSB0aGlzLndpdGhDcmVkZW50aWFscztcbiAgICAvLyBzZW5kIHhoclxuICAgIHRoaXMueGhyLnNlbmQodGhpcy5wYXlsb2FkKTtcbiAgfVxuICAvLyBjbG9zZVxuICBjbG9zZSgpIHtcbiAgICBpZih0aGlzLnJlYWR5U3RhdGUgPT09IHRoaXMuQ0xPU0VEKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIHRoaXMueGhyLmFib3J0KCk7XG4gICAgdGhpcy54aHIgPSBudWxsO1xuICAgIHRoaXMuX3NldFJlYWR5U3RhdGUodGhpcy5DTE9TRUQpO1xuICB9XG59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
