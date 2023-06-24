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
    "gpt-3.5-turbo": 12e3
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vdmVjX2xpdGUvdmVjX2xpdGUuanMiLCAiLi4vc3JjL2luZGV4LmpzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJjbGFzcyBWZWNMaXRlIHtcbiAgY29uc3RydWN0b3IoY29uZmlnKSB7XG4gICAgLy8gc2V0IGRlZmF1bHQgY29uZmlnXG4gICAgdGhpcy5jb25maWcgPSB7XG4gICAgICBmaWxlX25hbWU6IFwiZW1iZWRkaW5ncy0zLmpzb25cIixcbiAgICAgIGZvbGRlcl9wYXRoOiBcIi52ZWNfbGl0ZVwiLFxuICAgICAgZXhpc3RzX2FkYXB0ZXI6IG51bGwsXG4gICAgICBta2Rpcl9hZGFwdGVyOiBudWxsLFxuICAgICAgcmVhZF9hZGFwdGVyOiBudWxsLFxuICAgICAgcmVuYW1lX2FkYXB0ZXI6IG51bGwsXG4gICAgICBzdGF0X2FkYXB0ZXI6IG51bGwsXG4gICAgICB3cml0ZV9hZGFwdGVyOiBudWxsLFxuICAgICAgLi4uY29uZmlnXG4gICAgfTtcbiAgICB0aGlzLmZpbGVfbmFtZSA9IHRoaXMuY29uZmlnLmZpbGVfbmFtZTtcbiAgICB0aGlzLmZvbGRlcl9wYXRoID0gY29uZmlnLmZvbGRlcl9wYXRoO1xuICAgIHRoaXMuZmlsZV9wYXRoID0gdGhpcy5mb2xkZXJfcGF0aCArIFwiL1wiICsgdGhpcy5maWxlX25hbWU7XG4gICAgLy8gZ2V0IGZvbGRlciBwYXRoXG4gICAgdGhpcy5lbWJlZGRpbmdzID0gZmFsc2U7XG4gIH1cbiAgYXN5bmMgZmlsZV9leGlzdHMocGF0aCkge1xuICAgIGlmICh0aGlzLmNvbmZpZy5leGlzdHNfYWRhcHRlcikge1xuICAgICAgcmV0dXJuIGF3YWl0IHRoaXMuY29uZmlnLmV4aXN0c19hZGFwdGVyKHBhdGgpO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyB0b2RvIGhhbmRsZSB3aXRoIGZzXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJleGlzdHNfYWRhcHRlciBub3Qgc2V0XCIpO1xuICAgIH1cbiAgfVxuICBhc3luYyBta2RpcihwYXRoKSB7XG4gICAgaWYgKHRoaXMuY29uZmlnLm1rZGlyX2FkYXB0ZXIpIHtcbiAgICAgIHJldHVybiBhd2FpdCB0aGlzLmNvbmZpZy5ta2Rpcl9hZGFwdGVyKHBhdGgpO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyB0b2RvIGhhbmRsZSB3aXRoIGZzXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJta2Rpcl9hZGFwdGVyIG5vdCBzZXRcIik7XG4gICAgfVxuICB9XG4gIGFzeW5jIHJlYWRfZmlsZShwYXRoKSB7XG4gICAgaWYgKHRoaXMuY29uZmlnLnJlYWRfYWRhcHRlcikge1xuICAgICAgcmV0dXJuIGF3YWl0IHRoaXMuY29uZmlnLnJlYWRfYWRhcHRlcihwYXRoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gdG9kbyBoYW5kbGUgd2l0aCBmc1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFwicmVhZF9hZGFwdGVyIG5vdCBzZXRcIik7XG4gICAgfVxuICB9XG4gIGFzeW5jIHJlbmFtZShvbGRfcGF0aCwgbmV3X3BhdGgpIHtcbiAgICBpZiAodGhpcy5jb25maWcucmVuYW1lX2FkYXB0ZXIpIHtcbiAgICAgIHJldHVybiBhd2FpdCB0aGlzLmNvbmZpZy5yZW5hbWVfYWRhcHRlcihvbGRfcGF0aCwgbmV3X3BhdGgpO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyB0b2RvIGhhbmRsZSB3aXRoIGZzXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJyZW5hbWVfYWRhcHRlciBub3Qgc2V0XCIpO1xuICAgIH1cbiAgfVxuICBhc3luYyBzdGF0KHBhdGgpIHtcbiAgICBpZiAodGhpcy5jb25maWcuc3RhdF9hZGFwdGVyKSB7XG4gICAgICByZXR1cm4gYXdhaXQgdGhpcy5jb25maWcuc3RhdF9hZGFwdGVyKHBhdGgpO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyB0b2RvIGhhbmRsZSB3aXRoIGZzXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJzdGF0X2FkYXB0ZXIgbm90IHNldFwiKTtcbiAgICB9XG4gIH1cbiAgYXN5bmMgd3JpdGVfZmlsZShwYXRoLCBkYXRhKSB7XG4gICAgaWYgKHRoaXMuY29uZmlnLndyaXRlX2FkYXB0ZXIpIHtcbiAgICAgIHJldHVybiBhd2FpdCB0aGlzLmNvbmZpZy53cml0ZV9hZGFwdGVyKHBhdGgsIGRhdGEpO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyB0b2RvIGhhbmRsZSB3aXRoIGZzXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJ3cml0ZV9hZGFwdGVyIG5vdCBzZXRcIik7XG4gICAgfVxuICB9XG4gIGFzeW5jIGxvYWQocmV0cmllcyA9IDApIHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgZW1iZWRkaW5nc19maWxlID0gYXdhaXQgdGhpcy5yZWFkX2ZpbGUodGhpcy5maWxlX3BhdGgpO1xuICAgICAgLy8gbG9hZGVkIGVtYmVkZGluZ3MgZnJvbSBmaWxlXG4gICAgICB0aGlzLmVtYmVkZGluZ3MgPSBKU09OLnBhcnNlKGVtYmVkZGluZ3NfZmlsZSk7XG4gICAgICBjb25zb2xlLmxvZyhcImxvYWRlZCBlbWJlZGRpbmdzIGZpbGU6IFwiK3RoaXMuZmlsZV9wYXRoKTtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAvLyByZXRyeSBpZiBlcnJvciB1cCB0byAzIHRpbWVzXG4gICAgICBpZiAocmV0cmllcyA8IDMpIHtcbiAgICAgICAgY29uc29sZS5sb2coXCJyZXRyeWluZyBsb2FkKClcIik7XG4gICAgICAgIC8vIGluY3JlYXNlIHdhaXQgdGltZSBiZXR3ZWVuIHJldHJpZXNcbiAgICAgICAgYXdhaXQgbmV3IFByb21pc2UociA9PiBzZXRUaW1lb3V0KHIsIDEwMDAgKyAoMTAwMCAqIHJldHJpZXMpKSk7XG4gICAgICAgIHJldHVybiBhd2FpdCB0aGlzLmxvYWQocmV0cmllcyArIDEpO1xuICAgICAgfSBlbHNlIGlmIChyZXRyaWVzID09PSAzKSB7XG4gICAgICAgIC8vIGNoZWNrIGZvciBlbWJlZGRpbmdzLTIuanNvbiBmaWxlXG4gICAgICAgIGNvbnN0IGVtYmVkZGluZ3NfMl9maWxlX3BhdGggPSB0aGlzLmZvbGRlcl9wYXRoICsgXCIvZW1iZWRkaW5ncy0yLmpzb25cIjtcbiAgICAgICAgY29uc3QgZW1iZWRkaW5nc18yX2ZpbGVfZXhpc3RzID0gYXdhaXQgdGhpcy5maWxlX2V4aXN0cyhlbWJlZGRpbmdzXzJfZmlsZV9wYXRoKTtcbiAgICAgICAgaWYgKGVtYmVkZGluZ3NfMl9maWxlX2V4aXN0cykge1xuICAgICAgICAgIGF3YWl0IHRoaXMubWlncmF0ZV9lbWJlZGRpbmdzX3YyX3RvX3YzKCk7XG4gICAgICAgICAgcmV0dXJuIGF3YWl0IHRoaXMubG9hZChyZXRyaWVzICsgMSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGNvbnNvbGUubG9nKFwiZmFpbGVkIHRvIGxvYWQgZW1iZWRkaW5ncyBmaWxlLCBwcm9tcHQgdXNlciB0byBpbml0aWF0ZSBidWxrIGVtYmVkXCIpO1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxuICBhc3luYyBtaWdyYXRlX2VtYmVkZGluZ3NfdjJfdG9fdjMoKSB7XG4gICAgY29uc29sZS5sb2coXCJtaWdyYXRpbmcgZW1iZWRkaW5ncy0yLmpzb24gdG8gZW1iZWRkaW5ncy0zLmpzb25cIik7XG4gICAgLy8gbG9hZCBlbWJlZGRpbmdzLTIuanNvblxuICAgIGNvbnN0IGVtYmVkZGluZ3NfMl9maWxlX3BhdGggPSB0aGlzLmZvbGRlcl9wYXRoICsgXCIvZW1iZWRkaW5ncy0yLmpzb25cIjtcbiAgICBjb25zdCBlbWJlZGRpbmdzXzJfZmlsZSA9IGF3YWl0IHRoaXMucmVhZF9maWxlKGVtYmVkZGluZ3NfMl9maWxlX3BhdGgpO1xuICAgIGNvbnN0IGVtYmVkZGluZ3NfMiA9IEpTT04ucGFyc2UoZW1iZWRkaW5nc18yX2ZpbGUpO1xuICAgIC8vIGNvbnZlcnQgZW1iZWRkaW5ncy0yLmpzb24gdG8gZW1iZWRkaW5ncy0zLmpzb25cbiAgICBjb25zdCBlbWJlZGRpbmdzXzMgPSB7fTtcbiAgICBmb3IgKGNvbnN0IFtrZXksIHZhbHVlXSBvZiBPYmplY3QuZW50cmllcyhlbWJlZGRpbmdzXzIpKSB7XG4gICAgICBjb25zdCBuZXdfb2JqID0ge1xuICAgICAgICB2ZWM6IHZhbHVlLnZlYyxcbiAgICAgICAgbWV0YToge31cbiAgICAgIH07XG4gICAgICBjb25zdCBtZXRhID0gdmFsdWUubWV0YTtcbiAgICAgIGNvbnN0IG5ld19tZXRhID0ge307XG4gICAgICBpZihtZXRhLmhhc2gpIG5ld19tZXRhLmhhc2ggPSBtZXRhLmhhc2g7XG4gICAgICBpZihtZXRhLmZpbGUpIG5ld19tZXRhLnBhcmVudCA9IG1ldGEuZmlsZTtcbiAgICAgIGlmKG1ldGEuYmxvY2tzKSBuZXdfbWV0YS5jaGlsZHJlbiA9IG1ldGEuYmxvY2tzO1xuICAgICAgaWYobWV0YS5tdGltZSkgbmV3X21ldGEubXRpbWUgPSBtZXRhLm10aW1lO1xuICAgICAgaWYobWV0YS5zaXplKSBuZXdfbWV0YS5zaXplID0gbWV0YS5zaXplO1xuICAgICAgaWYobWV0YS5sZW4pIG5ld19tZXRhLnNpemUgPSBtZXRhLmxlbjtcbiAgICAgIGlmKG1ldGEucGF0aCkgbmV3X21ldGEucGF0aCA9IG1ldGEucGF0aDtcbiAgICAgIG5ld19tZXRhLnNyYyA9IFwiZmlsZVwiO1xuICAgICAgbmV3X29iai5tZXRhID0gbmV3X21ldGE7XG4gICAgICBlbWJlZGRpbmdzXzNba2V5XSA9IG5ld19vYmo7XG4gICAgfVxuICAgIC8vIHdyaXRlIGVtYmVkZGluZ3MtMy5qc29uXG4gICAgY29uc3QgZW1iZWRkaW5nc18zX2ZpbGUgPSBKU09OLnN0cmluZ2lmeShlbWJlZGRpbmdzXzMpO1xuICAgIGF3YWl0IHRoaXMud3JpdGVfZmlsZSh0aGlzLmZpbGVfcGF0aCwgZW1iZWRkaW5nc18zX2ZpbGUpO1xuICB9XG5cbiAgYXN5bmMgaW5pdF9lbWJlZGRpbmdzX2ZpbGUoKSB7XG4gICAgLy8gY2hlY2sgaWYgZm9sZGVyIGV4aXN0c1xuICAgIGlmICghKGF3YWl0IHRoaXMuZmlsZV9leGlzdHModGhpcy5mb2xkZXJfcGF0aCkpKSB7XG4gICAgICAvLyBjcmVhdGUgZm9sZGVyXG4gICAgICBhd2FpdCB0aGlzLm1rZGlyKHRoaXMuZm9sZGVyX3BhdGgpO1xuICAgICAgY29uc29sZS5sb2coXCJjcmVhdGVkIGZvbGRlcjogXCIrdGhpcy5mb2xkZXJfcGF0aCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnNvbGUubG9nKFwiZm9sZGVyIGFscmVhZHkgZXhpc3RzOiBcIit0aGlzLmZvbGRlcl9wYXRoKTtcbiAgICB9XG4gICAgLy8gY2hlY2sgaWYgZW1iZWRkaW5ncyBmaWxlIGV4aXN0c1xuICAgIGlmICghKGF3YWl0IHRoaXMuZmlsZV9leGlzdHModGhpcy5maWxlX3BhdGgpKSkge1xuICAgICAgLy8gY3JlYXRlIGVtYmVkZGluZ3MgZmlsZVxuICAgICAgYXdhaXQgdGhpcy53cml0ZV9maWxlKHRoaXMuZmlsZV9wYXRoLCBcInt9XCIpO1xuICAgICAgY29uc29sZS5sb2coXCJjcmVhdGVkIGVtYmVkZGluZ3MgZmlsZTogXCIrdGhpcy5maWxlX3BhdGgpO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zb2xlLmxvZyhcImVtYmVkZGluZ3MgZmlsZSBhbHJlYWR5IGV4aXN0czogXCIrdGhpcy5maWxlX3BhdGgpO1xuICAgIH1cbiAgfVxuXG4gIGFzeW5jIHNhdmUoKSB7XG4gICAgY29uc3QgZW1iZWRkaW5ncyA9IEpTT04uc3RyaW5naWZ5KHRoaXMuZW1iZWRkaW5ncyk7XG4gICAgLy8gY2hlY2sgaWYgZW1iZWRkaW5ncyBmaWxlIGV4aXN0c1xuICAgIGNvbnN0IGVtYmVkZGluZ3NfZmlsZV9leGlzdHMgPSBhd2FpdCB0aGlzLmZpbGVfZXhpc3RzKHRoaXMuZmlsZV9wYXRoKTtcbiAgICAvLyBpZiBlbWJlZGRpbmdzIGZpbGUgZXhpc3RzIHRoZW4gY2hlY2sgaWYgbmV3IGVtYmVkZGluZ3MgZmlsZSBzaXplIGlzIHNpZ25pZmljYW50bHkgc21hbGxlciB0aGFuIGV4aXN0aW5nIGVtYmVkZGluZ3MgZmlsZSBzaXplXG4gICAgaWYgKGVtYmVkZGluZ3NfZmlsZV9leGlzdHMpIHtcbiAgICAgIC8vIGVzaXRtYXRlIGZpbGUgc2l6ZSBvZiBlbWJlZGRpbmdzXG4gICAgICBjb25zdCBuZXdfZmlsZV9zaXplID0gZW1iZWRkaW5ncy5sZW5ndGg7XG4gICAgICAvLyBnZXQgZXhpc3RpbmcgZmlsZSBzaXplXG4gICAgICBjb25zdCBleGlzdGluZ19maWxlX3NpemUgPSBhd2FpdCB0aGlzLnN0YXQodGhpcy5maWxlX3BhdGgpLnRoZW4oKHN0YXQpID0+IHN0YXQuc2l6ZSk7XG4gICAgICAvLyBjb25zb2xlLmxvZyhcIm5ldyBmaWxlIHNpemU6IFwiK25ld19maWxlX3NpemUpO1xuICAgICAgLy8gY29uc29sZS5sb2coXCJleGlzdGluZyBmaWxlIHNpemU6IFwiK2V4aXN0aW5nX2ZpbGVfc2l6ZSk7XG4gICAgICAvLyBpZiBuZXcgZmlsZSBzaXplIGlzIGF0IGxlYXN0IDUwJSBvZiBleGlzdGluZyBmaWxlIHNpemUgdGhlbiB3cml0ZSBlbWJlZGRpbmdzIHRvIGZpbGVcbiAgICAgIGlmIChuZXdfZmlsZV9zaXplID4gKGV4aXN0aW5nX2ZpbGVfc2l6ZSAqIDAuNSkpIHtcbiAgICAgICAgLy8gd3JpdGUgZW1iZWRkaW5ncyB0byBmaWxlXG4gICAgICAgIGF3YWl0IHRoaXMud3JpdGVfZmlsZSh0aGlzLmZpbGVfcGF0aCwgZW1iZWRkaW5ncyk7XG4gICAgICAgIGNvbnNvbGUubG9nKFwiZW1iZWRkaW5ncyBmaWxlIHNpemU6IFwiICsgbmV3X2ZpbGVfc2l6ZSArIFwiIGJ5dGVzXCIpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gaWYgbmV3IGZpbGUgc2l6ZSBpcyBzaWduaWZpY2FudGx5IHNtYWxsZXIgdGhhbiBleGlzdGluZyBmaWxlIHNpemUgdGhlbiB0aHJvdyBlcnJvclxuICAgICAgICAvLyBzaG93IHdhcm5pbmcgbWVzc2FnZSBpbmNsdWRpbmcgZmlsZSBzaXplc1xuICAgICAgICBjb25zdCB3YXJuaW5nX21lc3NhZ2UgPSBbXG4gICAgICAgICAgXCJXYXJuaW5nOiBOZXcgZW1iZWRkaW5ncyBmaWxlIHNpemUgaXMgc2lnbmlmaWNhbnRseSBzbWFsbGVyIHRoYW4gZXhpc3RpbmcgZW1iZWRkaW5ncyBmaWxlIHNpemUuXCIsXG4gICAgICAgICAgXCJBYm9ydGluZyB0byBwcmV2ZW50IHBvc3NpYmxlIGxvc3Mgb2YgZW1iZWRkaW5ncyBkYXRhLlwiLFxuICAgICAgICAgIFwiTmV3IGZpbGUgc2l6ZTogXCIgKyBuZXdfZmlsZV9zaXplICsgXCIgYnl0ZXMuXCIsXG4gICAgICAgICAgXCJFeGlzdGluZyBmaWxlIHNpemU6IFwiICsgZXhpc3RpbmdfZmlsZV9zaXplICsgXCIgYnl0ZXMuXCIsXG4gICAgICAgICAgXCJSZXN0YXJ0aW5nIE9ic2lkaWFuIG1heSBmaXggdGhpcy5cIlxuICAgICAgICBdO1xuICAgICAgICBjb25zb2xlLmxvZyh3YXJuaW5nX21lc3NhZ2Uuam9pbihcIiBcIikpO1xuICAgICAgICAvLyBzYXZlIGVtYmVkZGluZ3MgdG8gZmlsZSBuYW1lZCB1bnNhdmVkLWVtYmVkZGluZ3MuanNvblxuICAgICAgICBhd2FpdCB0aGlzLndyaXRlX2ZpbGUodGhpcy5mb2xkZXJfcGF0aCtcIi91bnNhdmVkLWVtYmVkZGluZ3MuanNvblwiLCBlbWJlZGRpbmdzKTtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiRXJyb3I6IE5ldyBlbWJlZGRpbmdzIGZpbGUgc2l6ZSBpcyBzaWduaWZpY2FudGx5IHNtYWxsZXIgdGhhbiBleGlzdGluZyBlbWJlZGRpbmdzIGZpbGUgc2l6ZS4gQWJvcnRpbmcgdG8gcHJldmVudCBwb3NzaWJsZSBsb3NzIG9mIGVtYmVkZGluZ3MgZGF0YS5cIik7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGF3YWl0IHRoaXMuaW5pdF9lbWJlZGRpbmdzX2ZpbGUoKTtcbiAgICAgIHJldHVybiBhd2FpdCB0aGlzLnNhdmUoKTtcbiAgICB9XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cbiAgY29zX3NpbSh2ZWN0b3IxLCB2ZWN0b3IyKSB7XG4gICAgbGV0IGRvdFByb2R1Y3QgPSAwO1xuICAgIGxldCBub3JtQSA9IDA7XG4gICAgbGV0IG5vcm1CID0gMDtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHZlY3RvcjEubGVuZ3RoOyBpKyspIHtcbiAgICAgIGRvdFByb2R1Y3QgKz0gdmVjdG9yMVtpXSAqIHZlY3RvcjJbaV07XG4gICAgICBub3JtQSArPSB2ZWN0b3IxW2ldICogdmVjdG9yMVtpXTtcbiAgICAgIG5vcm1CICs9IHZlY3RvcjJbaV0gKiB2ZWN0b3IyW2ldO1xuICAgIH1cbiAgICBpZiAobm9ybUEgPT09IDAgfHwgbm9ybUIgPT09IDApIHtcbiAgICAgIHJldHVybiAwO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gZG90UHJvZHVjdCAvIChNYXRoLnNxcnQobm9ybUEpICogTWF0aC5zcXJ0KG5vcm1CKSk7XG4gICAgfVxuICB9XG4gIG5lYXJlc3QodG9fdmVjLCBmaWx0ZXIgPSB7fSkge1xuICAgIGZpbHRlciA9IHtcbiAgICAgIHJlc3VsdHNfY291bnQ6IDMwLFxuICAgICAgLi4uZmlsdGVyXG4gICAgfTtcbiAgICBsZXQgbmVhcmVzdCA9IFtdO1xuICAgIGNvbnN0IGZyb21fa2V5cyA9IE9iamVjdC5rZXlzKHRoaXMuZW1iZWRkaW5ncyk7XG4gICAgLy8gdGhpcy5yZW5kZXJfbG9nLnRvdGFsX2VtYmVkZGluZ3MgPSBmcm9tX2tleXMubGVuZ3RoO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZnJvbV9rZXlzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAvLyBpZiB0aGlzLnNldHRpbmdzLnNraXBfc2VjdGlvbnMgaXMgdHJ1ZVxuICAgICAgaWYgKGZpbHRlci5za2lwX3NlY3Rpb25zKSB7XG4gICAgICAgIGNvbnN0IGZyb21fcGF0aCA9IHRoaXMuZW1iZWRkaW5nc1tmcm9tX2tleXNbaV1dLm1ldGEucGF0aDtcbiAgICAgICAgaWYgKGZyb21fcGF0aC5pbmRleE9mKFwiI1wiKSA+IC0xKSBjb250aW51ZTsgLy8gc2tpcCBpZiBjb250YWlucyAjIGluZGljYXRpbmcgYmxvY2sgKHNlY3Rpb24pXG5cbiAgICAgICAgLy8gVE9ETzogY29uc2lkZXIgdXNpbmcgcHJlc2VuY2Ugb2YgbWV0YS5wYXJlbnQgdG8gc2tpcCBmaWxlcyAoZmFzdGVyIGNoZWNraW5nPylcbiAgICAgIH1cbiAgICAgIGlmIChmaWx0ZXIuc2tpcF9rZXkpIHtcbiAgICAgICAgaWYgKGZpbHRlci5za2lwX2tleSA9PT0gZnJvbV9rZXlzW2ldKSBjb250aW51ZTsgLy8gc2tpcCBtYXRjaGluZyB0byBjdXJyZW50IG5vdGVcbiAgICAgICAgaWYgKGZpbHRlci5za2lwX2tleSA9PT0gdGhpcy5lbWJlZGRpbmdzW2Zyb21fa2V5c1tpXV0ubWV0YS5wYXJlbnQpIGNvbnRpbnVlOyAvLyBza2lwIGlmIGZpbHRlci5za2lwX2tleSBtYXRjaGVzIG1ldGEucGFyZW50XG4gICAgICB9XG4gICAgICAvLyBpZiBmaWx0ZXIucGF0aF9iZWdpbnNfd2l0aCBpcyBzZXQgKGZvbGRlciBmaWx0ZXIpXG4gICAgICBpZiAoZmlsdGVyLnBhdGhfYmVnaW5zX3dpdGgpIHtcbiAgICAgICAgLy8gaWYgdHlwZSBpcyBzdHJpbmcgJiBtZXRhLnBhdGggZG9lcyBub3QgYmVnaW4gd2l0aCBmaWx0ZXIucGF0aF9iZWdpbnNfd2l0aCwgc2tpcFxuICAgICAgICBpZiAodHlwZW9mIGZpbHRlci5wYXRoX2JlZ2luc193aXRoID09PSBcInN0cmluZ1wiICYmICF0aGlzLmVtYmVkZGluZ3NbZnJvbV9rZXlzW2ldXS5tZXRhLnBhdGguc3RhcnRzV2l0aChmaWx0ZXIucGF0aF9iZWdpbnNfd2l0aCkpIGNvbnRpbnVlO1xuICAgICAgICAvLyBpZiB0eXBlIGlzIGFycmF5ICYgbWV0YS5wYXRoIGRvZXMgbm90IGJlZ2luIHdpdGggYW55IG9mIHRoZSBmaWx0ZXIucGF0aF9iZWdpbnNfd2l0aCwgc2tpcFxuICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShmaWx0ZXIucGF0aF9iZWdpbnNfd2l0aCkgJiYgIWZpbHRlci5wYXRoX2JlZ2luc193aXRoLnNvbWUoKHBhdGgpID0+IHRoaXMuZW1iZWRkaW5nc1tmcm9tX2tleXNbaV1dLm1ldGEucGF0aC5zdGFydHNXaXRoKHBhdGgpKSkgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIG5lYXJlc3QucHVzaCh7XG4gICAgICAgIGxpbms6IHRoaXMuZW1iZWRkaW5nc1tmcm9tX2tleXNbaV1dLm1ldGEucGF0aCxcbiAgICAgICAgc2ltaWxhcml0eTogdGhpcy5jb3Nfc2ltKHRvX3ZlYywgdGhpcy5lbWJlZGRpbmdzW2Zyb21fa2V5c1tpXV0udmVjKSxcbiAgICAgICAgc2l6ZTogdGhpcy5lbWJlZGRpbmdzW2Zyb21fa2V5c1tpXV0ubWV0YS5zaXplLFxuICAgICAgfSk7XG4gICAgfVxuICAgIC8vIHNvcnQgYXJyYXkgYnkgY29zaW5lIHNpbWlsYXJpdHlcbiAgICBuZWFyZXN0LnNvcnQoZnVuY3Rpb24gKGEsIGIpIHtcbiAgICAgIHJldHVybiBiLnNpbWlsYXJpdHkgLSBhLnNpbWlsYXJpdHk7XG4gICAgfSk7XG4gICAgLy8gY29uc29sZS5sb2cobmVhcmVzdCk7XG4gICAgLy8gbGltaXQgdG8gTiBuZWFyZXN0IGNvbm5lY3Rpb25zXG4gICAgbmVhcmVzdCA9IG5lYXJlc3Quc2xpY2UoMCwgZmlsdGVyLnJlc3VsdHNfY291bnQpO1xuICAgIHJldHVybiBuZWFyZXN0O1xuICB9XG4gIGZpbmRfbmVhcmVzdF9lbWJlZGRpbmdzKHRvX3ZlYywgZmlsdGVyPXt9KSB7XG4gICAgY29uc3QgZGVmYXVsdF9maWx0ZXIgPSB7XG4gICAgICBtYXg6IHRoaXMubWF4X3NvdXJjZXMsXG4gICAgfTtcbiAgICBmaWx0ZXIgPSB7Li4uZGVmYXVsdF9maWx0ZXIsIC4uLmZpbHRlcn07XG4gICAgLy8gaGFuZGxlIGlmIHRvX3ZlYyBpcyBhbiBhcnJheSBvZiB2ZWN0b3JzXG4gICAgLy8gbGV0IG5lYXJlc3QgPSBbXTtcbiAgICBpZihBcnJheS5pc0FycmF5KHRvX3ZlYykgJiYgdG9fdmVjLmxlbmd0aCAhPT0gdGhpcy52ZWNfbGVuKXtcbiAgICAgIHRoaXMubmVhcmVzdCA9IHt9O1xuICAgICAgZm9yKGxldCBpID0gMDsgaSA8IHRvX3ZlYy5sZW5ndGg7IGkrKyl7XG4gICAgICAgIC8vIG5lYXJlc3QgPSBuZWFyZXN0LmNvbmNhdCh0aGlzLmZpbmRfbmVhcmVzdF9lbWJlZGRpbmdzKHRvX3ZlY1tpXSwge1xuICAgICAgICAvLyAgIG1heDogTWF0aC5mbG9vcihmaWx0ZXIubWF4IC8gdG9fdmVjLmxlbmd0aClcbiAgICAgICAgLy8gfSkpO1xuICAgICAgICB0aGlzLmZpbmRfbmVhcmVzdF9lbWJlZGRpbmdzKHRvX3ZlY1tpXSwge1xuICAgICAgICAgIG1heDogTWF0aC5mbG9vcihmaWx0ZXIubWF4IC8gdG9fdmVjLmxlbmd0aClcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfWVsc2V7XG4gICAgICBjb25zdCBmcm9tX2tleXMgPSBPYmplY3Qua2V5cyh0aGlzLmVtYmVkZGluZ3MpO1xuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBmcm9tX2tleXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgaWYodGhpcy52YWxpZGF0ZV90eXBlKHRoaXMuZW1iZWRkaW5nc1tmcm9tX2tleXNbaV1dKSkgY29udGludWU7XG4gICAgICAgIGNvbnN0IHNpbSA9IHRoaXMuY29tcHV0ZUNvc2luZVNpbWlsYXJpdHkodG9fdmVjLCB0aGlzLmVtYmVkZGluZ3NbZnJvbV9rZXlzW2ldXS52ZWMpO1xuICAgICAgICBpZih0aGlzLm5lYXJlc3RbZnJvbV9rZXlzW2ldXSl7IC8vIGlmIGFscmVhZHkgY29tcHV0ZWQsIHVzZSBjYWNoZWQgdmFsdWVcbiAgICAgICAgICB0aGlzLm5lYXJlc3RbZnJvbV9rZXlzW2ldXSArPSBzaW07XG4gICAgICAgIH1lbHNle1xuICAgICAgICAgIHRoaXMubmVhcmVzdFtmcm9tX2tleXNbaV1dID0gc2ltO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIC8vIGluaXRpYXRlIG5lYXJlc3QgYXJyYXlcbiAgICBsZXQgbmVhcmVzdCA9IE9iamVjdC5rZXlzKHRoaXMubmVhcmVzdCkubWFwKGtleSA9PiB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBrZXk6IGtleSxcbiAgICAgICAgc2ltaWxhcml0eTogdGhpcy5uZWFyZXN0W2tleV0sXG4gICAgICB9XG4gICAgfSk7XG4gICAgLy8gc29ydCBhcnJheSBieSBjb3NpbmUgc2ltaWxhcml0eVxuICAgIG5lYXJlc3QgPSB0aGlzLnNvcnRfYnlfc2ltaWxhcml0eShuZWFyZXN0KTtcbiAgICBuZWFyZXN0ID0gbmVhcmVzdC5zbGljZSgwLCBmaWx0ZXIubWF4KTtcbiAgICAvLyBhZGQgbGluayBhbmQgbGVuZ3RoIHRvIHJlbWFpbmluZyBuZWFyZXN0XG4gICAgbmVhcmVzdCA9IG5lYXJlc3QubWFwKGl0ZW0gPT4ge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgbGluazogdGhpcy5lbWJlZGRpbmdzW2l0ZW0ua2V5XS5tZXRhLnBhdGgsXG4gICAgICAgIHNpbWlsYXJpdHk6IGl0ZW0uc2ltaWxhcml0eSxcbiAgICAgICAgbGVuOiB0aGlzLmVtYmVkZGluZ3NbaXRlbS5rZXldLm1ldGEubGVuIHx8IHRoaXMuZW1iZWRkaW5nc1tpdGVtLmtleV0ubWV0YS5zaXplLFxuICAgICAgfVxuICAgIH0pO1xuICAgIHJldHVybiBuZWFyZXN0O1xuICB9XG4gIHNvcnRfYnlfc2ltaWxhcml0eShuZWFyZXN0KSB7XG4gICAgcmV0dXJuIG5lYXJlc3Quc29ydChmdW5jdGlvbiAoYSwgYikge1xuICAgICAgY29uc3QgYV9zY29yZSA9IGEuc2ltaWxhcml0eTtcbiAgICAgIGNvbnN0IGJfc2NvcmUgPSBiLnNpbWlsYXJpdHk7XG4gICAgICAvLyBpZiBhIGlzIGdyZWF0ZXIgdGhhbiBiLCByZXR1cm4gLTFcbiAgICAgIGlmIChhX3Njb3JlID4gYl9zY29yZSlcbiAgICAgICAgcmV0dXJuIC0xO1xuICAgICAgLy8gaWYgYSBpcyBsZXNzIHRoYW4gYiwgcmV0dXJuIDFcbiAgICAgIGlmIChhX3Njb3JlIDwgYl9zY29yZSlcbiAgICAgICAgcmV0dXJuIDE7XG4gICAgICAvLyBpZiBhIGlzIGVxdWFsIHRvIGIsIHJldHVybiAwXG4gICAgICByZXR1cm4gMDtcbiAgICB9KTtcbiAgfVxuICAvLyBjaGVjayBpZiBrZXkgZnJvbSBlbWJlZGRpbmdzIGV4aXN0cyBpbiBmaWxlc1xuICBjbGVhbl91cF9lbWJlZGRpbmdzKGZpbGVzKSB7XG4gICAgY29uc29sZS5sb2coXCJjbGVhbmluZyB1cCBlbWJlZGRpbmdzXCIpO1xuICAgIGNvbnN0IGtleXMgPSBPYmplY3Qua2V5cyh0aGlzLmVtYmVkZGluZ3MpO1xuICAgIGxldCBkZWxldGVkX2VtYmVkZGluZ3MgPSAwO1xuICAgIGZvciAoY29uc3Qga2V5IG9mIGtleXMpIHtcbiAgICAgIC8vIGNvbnNvbGUubG9nKFwia2V5OiBcIitrZXkpO1xuICAgICAgY29uc3QgcGF0aCA9IHRoaXMuZW1iZWRkaW5nc1trZXldLm1ldGEucGF0aDtcbiAgICAgIC8vIGlmIG5vIGtleSBzdGFydHMgd2l0aCBmaWxlIHBhdGhcbiAgICAgIGlmKCFmaWxlcy5maW5kKGZpbGUgPT4gcGF0aC5zdGFydHNXaXRoKGZpbGUucGF0aCkpKSB7XG4gICAgICAgIC8vIGRlbGV0ZSBrZXkgaWYgaXQgZG9lc24ndCBleGlzdFxuICAgICAgICBkZWxldGUgdGhpcy5lbWJlZGRpbmdzW2tleV07XG4gICAgICAgIGRlbGV0ZWRfZW1iZWRkaW5ncysrO1xuICAgICAgICAvLyBjb25zb2xlLmxvZyhcImRlbGV0aW5nIChkZWxldGVkIGZpbGUpOiBcIiArIGtleSk7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgICAgLy8gaWYga2V5IGNvbnRhaW5zICcjJ1xuICAgICAgaWYocGF0aC5pbmRleE9mKFwiI1wiKSA+IC0xKSB7XG4gICAgICAgIGNvbnN0IHBhcmVudF9rZXkgPSB0aGlzLmVtYmVkZGluZ3Nba2V5XS5tZXRhLnBhcmVudDtcbiAgICAgICAgLy8gaWYgcGFyZW50X2tleSBtaXNzaW5nIGZyb20gZW1iZWRkaW5ncyB0aGVuIGRlbGV0ZSBrZXlcbiAgICAgICAgaWYoIXRoaXMuZW1iZWRkaW5nc1twYXJlbnRfa2V5XSl7XG4gICAgICAgICAgLy8gZGVsZXRlIGtleVxuICAgICAgICAgIGRlbGV0ZSB0aGlzLmVtYmVkZGluZ3Nba2V5XTtcbiAgICAgICAgICBkZWxldGVkX2VtYmVkZGluZ3MrKztcbiAgICAgICAgICAvLyBjb25zb2xlLmxvZyhcImRlbGV0aW5nIChtaXNzaW5nIHBhcmVudClcIik7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgICAgLy8gaWYgcGFyZW50X2tleSBtaXNzaW5nIG1ldGEgdGhlbiBkZWxldGUga2V5XG4gICAgICAgIGlmKCF0aGlzLmVtYmVkZGluZ3NbcGFyZW50X2tleV0ubWV0YSl7XG4gICAgICAgICAgLy8gZGVsZXRlIGtleVxuICAgICAgICAgIGRlbGV0ZSB0aGlzLmVtYmVkZGluZ3Nba2V5XTtcbiAgICAgICAgICBkZWxldGVkX2VtYmVkZGluZ3MrKztcbiAgICAgICAgICAvLyBjb25zb2xlLmxvZyhcImRlbGV0aW5nIChwYXJlbnQgbWlzc2luZyBtZXRhKVwiKTtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICAgICAgICAvLyBpZiBwYXJlbnRfa2V5IG1pc3NpbmcgY2hpbGRyZW4gdGhlbiBkZWxldGUga2V5XG4gICAgICAgIC8vIGlmIHBhcmVudF9rZXkgY2hpbGRyZW4gZG9lc24ndCBpbmNsdWRlIGtleSB0aGVuIGRlbGV0ZSBrZXlcbiAgICAgICAgaWYodGhpcy5lbWJlZGRpbmdzW3BhcmVudF9rZXldLm1ldGEuY2hpbGRyZW4gJiYgKHRoaXMuZW1iZWRkaW5nc1twYXJlbnRfa2V5XS5tZXRhLmNoaWxkcmVuLmluZGV4T2Yoa2V5KSA8IDApKSB7XG4gICAgICAgICAgLy8gZGVsZXRlIGtleVxuICAgICAgICAgIGRlbGV0ZSB0aGlzLmVtYmVkZGluZ3Nba2V5XTtcbiAgICAgICAgICBkZWxldGVkX2VtYmVkZGluZ3MrKztcbiAgICAgICAgICAvLyBjb25zb2xlLmxvZyhcImRlbGV0aW5nIChub3QgcHJlc2VudCBpbiBwYXJlbnQncyBjaGlsZHJlbilcIik7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHtkZWxldGVkX2VtYmVkZGluZ3M6IGRlbGV0ZWRfZW1iZWRkaW5ncywgdG90YWxfZW1iZWRkaW5nczoga2V5cy5sZW5ndGh9O1xuICB9XG5cbiAgZ2V0KGtleSkge1xuICAgIHJldHVybiB0aGlzLmVtYmVkZGluZ3Nba2V5XSB8fCBudWxsO1xuICB9XG4gIGdldF9tZXRhKGtleSkge1xuICAgIGNvbnN0IGVtYmVkZGluZyA9IHRoaXMuZ2V0KGtleSk7XG4gICAgaWYoZW1iZWRkaW5nICYmIGVtYmVkZGluZy5tZXRhKSB7XG4gICAgICByZXR1cm4gZW1iZWRkaW5nLm1ldGE7XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9XG4gIGdldF9tdGltZShrZXkpIHtcbiAgICBjb25zdCBtZXRhID0gdGhpcy5nZXRfbWV0YShrZXkpO1xuICAgIGlmKG1ldGEgJiYgbWV0YS5tdGltZSkge1xuICAgICAgcmV0dXJuIG1ldGEubXRpbWU7XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9XG4gIGdldF9oYXNoKGtleSkge1xuICAgIGNvbnN0IG1ldGEgPSB0aGlzLmdldF9tZXRhKGtleSk7XG4gICAgaWYobWV0YSAmJiBtZXRhLmhhc2gpIHtcbiAgICAgIHJldHVybiBtZXRhLmhhc2g7XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9XG4gIGdldF9zaXplKGtleSkge1xuICAgIGNvbnN0IG1ldGEgPSB0aGlzLmdldF9tZXRhKGtleSk7XG4gICAgaWYobWV0YSAmJiBtZXRhLnNpemUpIHtcbiAgICAgIHJldHVybiBtZXRhLnNpemU7XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9XG4gIGdldF9jaGlsZHJlbihrZXkpIHtcbiAgICBjb25zdCBtZXRhID0gdGhpcy5nZXRfbWV0YShrZXkpO1xuICAgIGlmKG1ldGEgJiYgbWV0YS5jaGlsZHJlbikge1xuICAgICAgcmV0dXJuIG1ldGEuY2hpbGRyZW47XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9XG4gIGdldF92ZWMoa2V5KSB7XG4gICAgY29uc3QgZW1iZWRkaW5nID0gdGhpcy5nZXQoa2V5KTtcbiAgICBpZihlbWJlZGRpbmcgJiYgZW1iZWRkaW5nLnZlYykge1xuICAgICAgcmV0dXJuIGVtYmVkZGluZy52ZWM7XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9XG4gIHNhdmVfZW1iZWRkaW5nKGtleSwgdmVjLCBtZXRhKSB7XG4gICAgdGhpcy5lbWJlZGRpbmdzW2tleV0gPSB7XG4gICAgICB2ZWM6IHZlYyxcbiAgICAgIG1ldGE6IG1ldGEsXG4gICAgfTtcbiAgfVxuICBtdGltZV9pc19jdXJyZW50KGtleSwgc291cmNlX210aW1lKSB7XG4gICAgY29uc3QgbXRpbWUgPSB0aGlzLmdldF9tdGltZShrZXkpO1xuICAgIGlmKG10aW1lICYmIG10aW1lID49IHNvdXJjZV9tdGltZSkge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIGFzeW5jIGZvcmNlX3JlZnJlc2goKSB7XG4gICAgdGhpcy5lbWJlZGRpbmdzID0gbnVsbDtcbiAgICB0aGlzLmVtYmVkZGluZ3MgPSB7fTtcbiAgICAvLyBnZXQgY3VycmVudCBkYXRldGltZSBhcyB1bml4IHRpbWVzdGFtcFxuICAgIGxldCBjdXJyZW50X2RhdGV0aW1lID0gTWF0aC5mbG9vcihEYXRlLm5vdygpIC8gMTAwMCk7XG4gICAgLy8gcmVuYW1lIGV4aXN0aW5nIGVtYmVkZGluZ3MgZmlsZSB0byB0aGlzLmZvbGRlcl9wYXRoL2VtYmVkZGluZ3MtWVlZWS1NTS1ERC5qc29uXG4gICAgYXdhaXQgdGhpcy5yZW5hbWUodGhpcy5maWxlX3BhdGgsIHRoaXMuZm9sZGVyX3BhdGggKyBcIi9lbWJlZGRpbmdzLVwiICsgY3VycmVudF9kYXRldGltZSArIFwiLmpzb25cIik7XG4gICAgLy8gY3JlYXRlIG5ldyBlbWJlZGRpbmdzIGZpbGVcbiAgICBhd2FpdCB0aGlzLmluaXRfZW1iZWRkaW5nc19maWxlKCk7XG4gIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBWZWNMaXRlOyIsICJjb25zdCBPYnNpZGlhbiA9IHJlcXVpcmUoXCJvYnNpZGlhblwiKTtcbmNvbnN0IFZlY0xpdGUgPSByZXF1aXJlKFwidmVjLWxpdGVcIik7XG5cbmNvbnN0IERFRkFVTFRfU0VUVElOR1MgPSB7XG4gIGFwaV9rZXk6IFwiXCIsXG4gIGNoYXRfb3BlbjogdHJ1ZSxcbiAgZmlsZV9leGNsdXNpb25zOiBcIlwiLFxuICBmb2xkZXJfZXhjbHVzaW9uczogXCJcIixcbiAgaGVhZGVyX2V4Y2x1c2lvbnM6IFwiXCIsXG4gIHBhdGhfb25seTogXCJcIixcbiAgc2hvd19mdWxsX3BhdGg6IGZhbHNlLFxuICBleHBhbmRlZF92aWV3OiB0cnVlLFxuICBncm91cF9uZWFyZXN0X2J5X2ZpbGU6IGZhbHNlLFxuICBsYW5ndWFnZTogXCJlblwiLFxuICBsb2dfcmVuZGVyOiBmYWxzZSxcbiAgbG9nX3JlbmRlcl9maWxlczogZmFsc2UsXG4gIHJlY2VudGx5X3NlbnRfcmV0cnlfbm90aWNlOiBmYWxzZSxcbiAgc2tpcF9zZWN0aW9uczogZmFsc2UsXG4gIHNtYXJ0X2NoYXRfbW9kZWw6IFwiZ3B0LTMuNS10dXJiby0xNmtcIixcbiAgdmlld19vcGVuOiB0cnVlLFxuICB2ZXJzaW9uOiBcIlwiLFxufTtcbmNvbnN0IE1BWF9FTUJFRF9TVFJJTkdfTEVOR1RIID0gMjUwMDA7XG5cbmxldCBWRVJTSU9OO1xuY29uc3QgU1VQUE9SVEVEX0ZJTEVfVFlQRVMgPSBbXCJtZFwiLCBcImNhbnZhc1wiXTtcblxuLy9jcmVhdGUgb25lIG9iamVjdCB3aXRoIGFsbCB0aGUgdHJhbnNsYXRpb25zXG4vLyByZXNlYXJjaCA6IFNNQVJUX1RSQU5TTEFUSU9OW2xhbmd1YWdlXVtrZXldXG5jb25zdCBTTUFSVF9UUkFOU0xBVElPTiA9IHtcbiAgXCJlblwiOiB7XG4gICAgXCJwcm9ub3VzXCI6IFtcIm15XCIsIFwiSVwiLCBcIm1lXCIsIFwibWluZVwiLCBcIm91clwiLCBcIm91cnNcIiwgXCJ1c1wiLCBcIndlXCJdLFxuICAgIFwicHJvbXB0XCI6IFwiQmFzZWQgb24geW91ciBub3Rlc1wiLFxuICAgIFwiaW5pdGlhbF9tZXNzYWdlXCI6IFwiSGksIEknbSBDaGF0R1BUIHdpdGggYWNjZXNzIHRvIHlvdXIgbm90ZXMgdmlhIFNtYXJ0IENvbm5lY3Rpb25zLiBBc2sgbWUgYSBxdWVzdGlvbiBhYm91dCB5b3VyIG5vdGVzIGFuZCBJJ2xsIHRyeSB0byBhbnN3ZXIgaXQuXCIsXG4gIH0sXG4gIFwiZXNcIjoge1xuICAgIFwicHJvbm91c1wiOiBbXCJtaVwiLCBcInlvXCIsIFwibVx1MDBFRFwiLCBcInRcdTAwRkFcIl0sXG4gICAgXCJwcm9tcHRcIjogXCJCYXNcdTAwRTFuZG9zZSBlbiBzdXMgbm90YXNcIixcbiAgICBcImluaXRpYWxfbWVzc2FnZVwiOiBcIkhvbGEsIHNveSBDaGF0R1BUIGNvbiBhY2Nlc28gYSB0dXMgYXB1bnRlcyBhIHRyYXZcdTAwRTlzIGRlIFNtYXJ0IENvbm5lY3Rpb25zLiBIYXptZSB1bmEgcHJlZ3VudGEgc29icmUgdHVzIGFwdW50ZXMgZSBpbnRlbnRhclx1MDBFOSByZXNwb25kZXJ0ZS5cIixcbiAgfSxcbiAgXCJmclwiOiB7XG4gICAgXCJwcm9ub3VzXCI6IFtcIm1lXCIsIFwibW9uXCIsIFwibWFcIiwgXCJtZXNcIiwgXCJtb2lcIiwgXCJub3VzXCIsIFwibm90cmVcIiwgXCJub3NcIiwgXCJqZVwiLCBcImonXCIsIFwibSdcIl0sXG4gICAgXCJwcm9tcHRcIjogXCJEJ2Fwclx1MDBFOHMgdm9zIG5vdGVzXCIsXG4gICAgXCJpbml0aWFsX21lc3NhZ2VcIjogXCJCb25qb3VyLCBqZSBzdWlzIENoYXRHUFQgZXQgaidhaSBhY2NcdTAwRThzIFx1MDBFMCB2b3Mgbm90ZXMgdmlhIFNtYXJ0IENvbm5lY3Rpb25zLiBQb3Nlei1tb2kgdW5lIHF1ZXN0aW9uIHN1ciB2b3Mgbm90ZXMgZXQgaidlc3NhaWVyYWkgZCd5IHJcdTAwRTlwb25kcmUuXCIsXG4gIH0sXG4gIFwiZGVcIjoge1xuICAgIFwicHJvbm91c1wiOiBbXCJtZWluXCIsIFwibWVpbmVcIiwgXCJtZWluZW5cIiwgXCJtZWluZXJcIiwgXCJtZWluZXNcIiwgXCJtaXJcIiwgXCJ1bnNcIiwgXCJ1bnNlclwiLCBcInVuc2VyZW5cIiwgXCJ1bnNlcmVyXCIsIFwidW5zZXJlc1wiXSxcbiAgICBcInByb21wdFwiOiBcIkJhc2llcmVuZCBhdWYgSWhyZW4gTm90aXplblwiLFxuICAgIFwiaW5pdGlhbF9tZXNzYWdlXCI6IFwiSGFsbG8sIGljaCBiaW4gQ2hhdEdQVCB1bmQgaGFiZSBcdTAwRkNiZXIgU21hcnQgQ29ubmVjdGlvbnMgWnVnYW5nIHp1IElocmVuIE5vdGl6ZW4uIFN0ZWxsZW4gU2llIG1pciBlaW5lIEZyYWdlIHp1IElocmVuIE5vdGl6ZW4gdW5kIGljaCB3ZXJkZSB2ZXJzdWNoZW4sIHNpZSB6dSBiZWFudHdvcnRlbi5cIixcbiAgfSxcbiAgXCJpdFwiOiB7XG4gICAgXCJwcm9ub3VzXCI6IFtcIm1pb1wiLCBcIm1pYVwiLCBcIm1pZWlcIiwgXCJtaWVcIiwgXCJub2lcIiwgXCJub3N0cm9cIiwgXCJub3N0cmlcIiwgXCJub3N0cmFcIiwgXCJub3N0cmVcIl0sXG4gICAgXCJwcm9tcHRcIjogXCJTdWxsYSBiYXNlIGRlZ2xpIGFwcHVudGlcIixcbiAgICBcImluaXRpYWxfbWVzc2FnZVwiOiBcIkNpYW8sIHNvbm8gQ2hhdEdQVCBlIGhvIGFjY2Vzc28gYWkgdHVvaSBhcHB1bnRpIHRyYW1pdGUgU21hcnQgQ29ubmVjdGlvbnMuIEZhdGVtaSB1bmEgZG9tYW5kYSBzdWkgdm9zdHJpIGFwcHVudGkgZSBjZXJjaGVyXHUwMEYyIGRpIHJpc3BvbmRlcnZpLlwiLFxuICB9LFxufVxuXG4vLyByZXF1aXJlIGJ1aWx0LWluIGNyeXB0byBtb2R1bGVcbmNvbnN0IGNyeXB0byA9IHJlcXVpcmUoXCJjcnlwdG9cIik7XG4vLyBtZDUgaGFzaCB1c2luZyBidWlsdCBpbiBjcnlwdG8gbW9kdWxlXG5mdW5jdGlvbiBtZDUoc3RyKSB7XG4gIHJldHVybiBjcnlwdG8uY3JlYXRlSGFzaChcIm1kNVwiKS51cGRhdGUoc3RyKS5kaWdlc3QoXCJoZXhcIik7XG59XG5cbmNsYXNzIFNtYXJ0Q29ubmVjdGlvbnNQbHVnaW4gZXh0ZW5kcyBPYnNpZGlhbi5QbHVnaW4ge1xuICAvLyBjb25zdHJ1Y3RvclxuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlciguLi5hcmd1bWVudHMpO1xuICAgIHRoaXMuYXBpID0gbnVsbDtcbiAgICB0aGlzLmVtYmVkZGluZ3NfbG9hZGVkID0gZmFsc2U7XG4gICAgdGhpcy5maWxlX2V4Y2x1c2lvbnMgPSBbXTtcbiAgICB0aGlzLmZvbGRlcnMgPSBbXTtcbiAgICB0aGlzLmhhc19uZXdfZW1iZWRkaW5ncyA9IGZhbHNlO1xuICAgIHRoaXMuaGVhZGVyX2V4Y2x1c2lvbnMgPSBbXTtcbiAgICB0aGlzLm5lYXJlc3RfY2FjaGUgPSB7fTtcbiAgICB0aGlzLnBhdGhfb25seSA9IFtdO1xuICAgIHRoaXMucmVuZGVyX2xvZyA9IHt9O1xuICAgIHRoaXMucmVuZGVyX2xvZy5kZWxldGVkX2VtYmVkZGluZ3MgPSAwO1xuICAgIHRoaXMucmVuZGVyX2xvZy5leGNsdXNpb25zX2xvZ3MgPSB7fTtcbiAgICB0aGlzLnJlbmRlcl9sb2cuZmFpbGVkX2VtYmVkZGluZ3MgPSBbXTtcbiAgICB0aGlzLnJlbmRlcl9sb2cuZmlsZXMgPSBbXTtcbiAgICB0aGlzLnJlbmRlcl9sb2cubmV3X2VtYmVkZGluZ3MgPSAwO1xuICAgIHRoaXMucmVuZGVyX2xvZy5za2lwcGVkX2xvd19kZWx0YSA9IHt9O1xuICAgIHRoaXMucmVuZGVyX2xvZy50b2tlbl91c2FnZSA9IDA7XG4gICAgdGhpcy5yZW5kZXJfbG9nLnRva2Vuc19zYXZlZF9ieV9jYWNoZSA9IDA7XG4gICAgdGhpcy5yZXRyeV9ub3RpY2VfdGltZW91dCA9IG51bGw7XG4gICAgdGhpcy5zYXZlX3RpbWVvdXQgPSBudWxsO1xuICAgIHRoaXMuc2NfYnJhbmRpbmcgPSB7fTtcbiAgICB0aGlzLnNlbGZfcmVmX2t3X3JlZ2V4ID0gbnVsbDtcbiAgICB0aGlzLnVwZGF0ZV9hdmFpbGFibGUgPSBmYWxzZTtcbiAgfVxuXG4gIGFzeW5jIG9ubG9hZCgpIHtcbiAgICAvLyBpbml0aWFsaXplIHdoZW4gbGF5b3V0IGlzIHJlYWR5XG4gICAgdGhpcy5hcHAud29ya3NwYWNlLm9uTGF5b3V0UmVhZHkodGhpcy5pbml0aWFsaXplLmJpbmQodGhpcykpO1xuICB9XG4gIG9udW5sb2FkKCkge1xuICAgIHRoaXMub3V0cHV0X3JlbmRlcl9sb2coKTtcbiAgICBjb25zb2xlLmxvZyhcInVubG9hZGluZyBwbHVnaW5cIik7XG4gICAgdGhpcy5hcHAud29ya3NwYWNlLmRldGFjaExlYXZlc09mVHlwZShTTUFSVF9DT05ORUNUSU9OU19WSUVXX1RZUEUpO1xuICAgIHRoaXMuYXBwLndvcmtzcGFjZS5kZXRhY2hMZWF2ZXNPZlR5cGUoU01BUlRfQ09OTkVDVElPTlNfQ0hBVF9WSUVXX1RZUEUpO1xuICB9XG4gIGFzeW5jIGluaXRpYWxpemUoKSB7XG4gICAgY29uc29sZS5sb2coXCJMb2FkaW5nIFNtYXJ0IENvbm5lY3Rpb25zIHBsdWdpblwiKTtcbiAgICBWRVJTSU9OID0gdGhpcy5tYW5pZmVzdC52ZXJzaW9uO1xuICAgIC8vIFZFUlNJT04gPSAnMS4wLjAnO1xuICAgIC8vIGNvbnNvbGUubG9nKFZFUlNJT04pO1xuICAgIGF3YWl0IHRoaXMubG9hZFNldHRpbmdzKCk7XG4gICAgLy8gcnVuIGFmdGVyIDMgc2Vjb25kc1xuICAgIHNldFRpbWVvdXQodGhpcy5jaGVja19mb3JfdXBkYXRlLmJpbmQodGhpcyksIDMwMDApO1xuICAgIC8vIHJ1biBjaGVjayBmb3IgdXBkYXRlIGV2ZXJ5IDMgaG91cnNcbiAgICBzZXRJbnRlcnZhbCh0aGlzLmNoZWNrX2Zvcl91cGRhdGUuYmluZCh0aGlzKSwgMTA4MDAwMDApO1xuXG4gICAgdGhpcy5hZGRJY29uKCk7XG4gICAgdGhpcy5hZGRDb21tYW5kKHtcbiAgICAgIGlkOiBcInNjLWZpbmQtbm90ZXNcIixcbiAgICAgIG5hbWU6IFwiRmluZDogTWFrZSBTbWFydCBDb25uZWN0aW9uc1wiLFxuICAgICAgaWNvbjogXCJwZW5jaWxfaWNvblwiLFxuICAgICAgaG90a2V5czogW10sXG4gICAgICAvLyBlZGl0b3JDYWxsYmFjazogYXN5bmMgKGVkaXRvcikgPT4ge1xuICAgICAgZWRpdG9yQ2FsbGJhY2s6IGFzeW5jIChlZGl0b3IpID0+IHtcbiAgICAgICAgaWYoZWRpdG9yLnNvbWV0aGluZ1NlbGVjdGVkKCkpIHtcbiAgICAgICAgICAvLyBnZXQgc2VsZWN0ZWQgdGV4dFxuICAgICAgICAgIGxldCBzZWxlY3RlZF90ZXh0ID0gZWRpdG9yLmdldFNlbGVjdGlvbigpO1xuICAgICAgICAgIC8vIHJlbmRlciBjb25uZWN0aW9ucyBmcm9tIHNlbGVjdGVkIHRleHRcbiAgICAgICAgICBhd2FpdCB0aGlzLm1ha2VfY29ubmVjdGlvbnMoc2VsZWN0ZWRfdGV4dCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy8gY2xlYXIgbmVhcmVzdF9jYWNoZSBvbiBtYW51YWwgY2FsbCB0byBtYWtlIGNvbm5lY3Rpb25zXG4gICAgICAgICAgdGhpcy5uZWFyZXN0X2NhY2hlID0ge307XG4gICAgICAgICAgLy8gY29uc29sZS5sb2coXCJDbGVhcmVkIG5lYXJlc3RfY2FjaGVcIik7XG4gICAgICAgICAgYXdhaXQgdGhpcy5tYWtlX2Nvbm5lY3Rpb25zKCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KTtcbiAgICB0aGlzLmFkZENvbW1hbmQoe1xuICAgICAgaWQ6IFwic21hcnQtY29ubmVjdGlvbnMtdmlld1wiLFxuICAgICAgbmFtZTogXCJPcGVuOiBWaWV3IFNtYXJ0IENvbm5lY3Rpb25zXCIsXG4gICAgICBjYWxsYmFjazogKCkgPT4ge1xuICAgICAgICB0aGlzLm9wZW5fdmlldygpO1xuICAgICAgfVxuICAgIH0pO1xuICAgIC8vIG9wZW4gY2hhdCBjb21tYW5kXG4gICAgdGhpcy5hZGRDb21tYW5kKHtcbiAgICAgIGlkOiBcInNtYXJ0LWNvbm5lY3Rpb25zLWNoYXRcIixcbiAgICAgIG5hbWU6IFwiT3BlbjogU21hcnQgQ2hhdCBDb252ZXJzYXRpb25cIixcbiAgICAgIGNhbGxiYWNrOiAoKSA9PiB7XG4gICAgICAgIHRoaXMub3Blbl9jaGF0KCk7XG4gICAgICB9XG4gICAgfSk7XG4gICAgLy8gb3BlbiByYW5kb20gbm90ZSBmcm9tIG5lYXJlc3QgY2FjaGVcbiAgICB0aGlzLmFkZENvbW1hbmQoe1xuICAgICAgaWQ6IFwic21hcnQtY29ubmVjdGlvbnMtcmFuZG9tXCIsXG4gICAgICBuYW1lOiBcIk9wZW46IFJhbmRvbSBOb3RlIGZyb20gU21hcnQgQ29ubmVjdGlvbnNcIixcbiAgICAgIGNhbGxiYWNrOiAoKSA9PiB7XG4gICAgICAgIHRoaXMub3Blbl9yYW5kb21fbm90ZSgpO1xuICAgICAgfVxuICAgIH0pO1xuICAgIC8vIGFkZCBzZXR0aW5ncyB0YWJcbiAgICB0aGlzLmFkZFNldHRpbmdUYWIobmV3IFNtYXJ0Q29ubmVjdGlvbnNTZXR0aW5nc1RhYih0aGlzLmFwcCwgdGhpcykpO1xuICAgIC8vIHJlZ2lzdGVyIG1haW4gdmlldyB0eXBlXG4gICAgdGhpcy5yZWdpc3RlclZpZXcoU01BUlRfQ09OTkVDVElPTlNfVklFV19UWVBFLCAobGVhZikgPT4gKG5ldyBTbWFydENvbm5lY3Rpb25zVmlldyhsZWFmLCB0aGlzKSkpO1xuICAgIC8vIHJlZ2lzdGVyIGNoYXQgdmlldyB0eXBlXG4gICAgdGhpcy5yZWdpc3RlclZpZXcoU01BUlRfQ09OTkVDVElPTlNfQ0hBVF9WSUVXX1RZUEUsIChsZWFmKSA9PiAobmV3IFNtYXJ0Q29ubmVjdGlvbnNDaGF0VmlldyhsZWFmLCB0aGlzKSkpO1xuICAgIC8vIGNvZGUtYmxvY2sgcmVuZGVyZXJcbiAgICB0aGlzLnJlZ2lzdGVyTWFya2Rvd25Db2RlQmxvY2tQcm9jZXNzb3IoXCJzbWFydC1jb25uZWN0aW9uc1wiLCB0aGlzLnJlbmRlcl9jb2RlX2Jsb2NrLmJpbmQodGhpcykpO1xuXG4gICAgLy8gaWYgdGhpcyBzZXR0aW5ncy52aWV3X29wZW4gaXMgdHJ1ZSwgb3BlbiB2aWV3IG9uIHN0YXJ0dXBcbiAgICBpZih0aGlzLnNldHRpbmdzLnZpZXdfb3Blbikge1xuICAgICAgdGhpcy5vcGVuX3ZpZXcoKTtcbiAgICB9XG4gICAgLy8gaWYgdGhpcyBzZXR0aW5ncy5jaGF0X29wZW4gaXMgdHJ1ZSwgb3BlbiBjaGF0IG9uIHN0YXJ0dXBcbiAgICBpZih0aGlzLnNldHRpbmdzLmNoYXRfb3Blbikge1xuICAgICAgdGhpcy5vcGVuX2NoYXQoKTtcbiAgICB9XG4gICAgLy8gb24gbmV3IHZlcnNpb25cbiAgICBpZih0aGlzLnNldHRpbmdzLnZlcnNpb24gIT09IFZFUlNJT04pIHtcbiAgICAgIC8vIHVwZGF0ZSB2ZXJzaW9uXG4gICAgICB0aGlzLnNldHRpbmdzLnZlcnNpb24gPSBWRVJTSU9OO1xuICAgICAgLy8gc2F2ZSBzZXR0aW5nc1xuICAgICAgYXdhaXQgdGhpcy5zYXZlU2V0dGluZ3MoKTtcbiAgICAgIC8vIG9wZW4gdmlld1xuICAgICAgdGhpcy5vcGVuX3ZpZXcoKTtcbiAgICB9XG4gICAgLy8gY2hlY2sgZ2l0aHViIHJlbGVhc2UgZW5kcG9pbnQgaWYgdXBkYXRlIGlzIGF2YWlsYWJsZVxuICAgIHRoaXMuYWRkX3RvX2dpdGlnbm9yZSgpO1xuICAgIC8qKlxuICAgICAqIEVYUEVSSU1FTlRBTFxuICAgICAqIC0gd2luZG93LWJhc2VkIEFQSSBhY2Nlc3NcbiAgICAgKiAtIGNvZGUtYmxvY2sgcmVuZGVyaW5nXG4gICAgICovXG4gICAgdGhpcy5hcGkgPSBuZXcgU2NTZWFyY2hBcGkodGhpcy5hcHAsIHRoaXMpO1xuICAgIC8vIHJlZ2lzdGVyIEFQSSB0byBnbG9iYWwgd2luZG93IG9iamVjdFxuICAgICh3aW5kb3dbXCJTbWFydFNlYXJjaEFwaVwiXSA9IHRoaXMuYXBpKSAmJiB0aGlzLnJlZ2lzdGVyKCgpID0+IGRlbGV0ZSB3aW5kb3dbXCJTbWFydFNlYXJjaEFwaVwiXSk7XG5cbiAgfVxuXG4gIGFzeW5jIGluaXRfdmVjcygpIHtcbiAgICB0aGlzLnNtYXJ0X3ZlY19saXRlID0gbmV3IFZlY0xpdGUoe1xuICAgICAgZm9sZGVyX3BhdGg6IFwiLnNtYXJ0LWNvbm5lY3Rpb25zXCIsXG4gICAgICBleGlzdHNfYWRhcHRlcjogdGhpcy5hcHAudmF1bHQuYWRhcHRlci5leGlzdHMuYmluZCh0aGlzLmFwcC52YXVsdC5hZGFwdGVyKSxcbiAgICAgIG1rZGlyX2FkYXB0ZXI6IHRoaXMuYXBwLnZhdWx0LmFkYXB0ZXIubWtkaXIuYmluZCh0aGlzLmFwcC52YXVsdC5hZGFwdGVyKSxcbiAgICAgIHJlYWRfYWRhcHRlcjogdGhpcy5hcHAudmF1bHQuYWRhcHRlci5yZWFkLmJpbmQodGhpcy5hcHAudmF1bHQuYWRhcHRlciksXG4gICAgICByZW5hbWVfYWRhcHRlcjogdGhpcy5hcHAudmF1bHQuYWRhcHRlci5yZW5hbWUuYmluZCh0aGlzLmFwcC52YXVsdC5hZGFwdGVyKSxcbiAgICAgIHN0YXRfYWRhcHRlcjogdGhpcy5hcHAudmF1bHQuYWRhcHRlci5zdGF0LmJpbmQodGhpcy5hcHAudmF1bHQuYWRhcHRlciksXG4gICAgICB3cml0ZV9hZGFwdGVyOiB0aGlzLmFwcC52YXVsdC5hZGFwdGVyLndyaXRlLmJpbmQodGhpcy5hcHAudmF1bHQuYWRhcHRlciksXG4gICAgfSk7XG4gICAgdGhpcy5lbWJlZGRpbmdzX2xvYWRlZCA9IGF3YWl0IHRoaXMuc21hcnRfdmVjX2xpdGUubG9hZCgpO1xuICAgIHJldHVybiB0aGlzLmVtYmVkZGluZ3NfbG9hZGVkO1xuICB9XG5cbiAgYXN5bmMgbG9hZFNldHRpbmdzKCkge1xuICAgIHRoaXMuc2V0dGluZ3MgPSBPYmplY3QuYXNzaWduKHt9LCBERUZBVUxUX1NFVFRJTkdTLCBhd2FpdCB0aGlzLmxvYWREYXRhKCkpO1xuICAgIC8vIGxvYWQgZmlsZSBleGNsdXNpb25zIGlmIG5vdCBibGFua1xuICAgIGlmKHRoaXMuc2V0dGluZ3MuZmlsZV9leGNsdXNpb25zICYmIHRoaXMuc2V0dGluZ3MuZmlsZV9leGNsdXNpb25zLmxlbmd0aCA+IDApIHtcbiAgICAgIC8vIHNwbGl0IGZpbGUgZXhjbHVzaW9ucyBpbnRvIGFycmF5IGFuZCB0cmltIHdoaXRlc3BhY2VcbiAgICAgIHRoaXMuZmlsZV9leGNsdXNpb25zID0gdGhpcy5zZXR0aW5ncy5maWxlX2V4Y2x1c2lvbnMuc3BsaXQoXCIsXCIpLm1hcCgoZmlsZSkgPT4ge1xuICAgICAgICByZXR1cm4gZmlsZS50cmltKCk7XG4gICAgICB9KTtcbiAgICB9XG4gICAgLy8gbG9hZCBmb2xkZXIgZXhjbHVzaW9ucyBpZiBub3QgYmxhbmtcbiAgICBpZih0aGlzLnNldHRpbmdzLmZvbGRlcl9leGNsdXNpb25zICYmIHRoaXMuc2V0dGluZ3MuZm9sZGVyX2V4Y2x1c2lvbnMubGVuZ3RoID4gMCkge1xuICAgICAgLy8gYWRkIHNsYXNoIHRvIGVuZCBvZiBmb2xkZXIgbmFtZSBpZiBub3QgcHJlc2VudFxuICAgICAgY29uc3QgZm9sZGVyX2V4Y2x1c2lvbnMgPSB0aGlzLnNldHRpbmdzLmZvbGRlcl9leGNsdXNpb25zLnNwbGl0KFwiLFwiKS5tYXAoKGZvbGRlcikgPT4ge1xuICAgICAgICAvLyB0cmltIHdoaXRlc3BhY2VcbiAgICAgICAgZm9sZGVyID0gZm9sZGVyLnRyaW0oKTtcbiAgICAgICAgaWYoZm9sZGVyLnNsaWNlKC0xKSAhPT0gXCIvXCIpIHtcbiAgICAgICAgICByZXR1cm4gZm9sZGVyICsgXCIvXCI7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmV0dXJuIGZvbGRlcjtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgICAvLyBtZXJnZSBmb2xkZXIgZXhjbHVzaW9ucyB3aXRoIGZpbGUgZXhjbHVzaW9uc1xuICAgICAgdGhpcy5maWxlX2V4Y2x1c2lvbnMgPSB0aGlzLmZpbGVfZXhjbHVzaW9ucy5jb25jYXQoZm9sZGVyX2V4Y2x1c2lvbnMpO1xuICAgIH1cbiAgICAvLyBsb2FkIGhlYWRlciBleGNsdXNpb25zIGlmIG5vdCBibGFua1xuICAgIGlmKHRoaXMuc2V0dGluZ3MuaGVhZGVyX2V4Y2x1c2lvbnMgJiYgdGhpcy5zZXR0aW5ncy5oZWFkZXJfZXhjbHVzaW9ucy5sZW5ndGggPiAwKSB7XG4gICAgICB0aGlzLmhlYWRlcl9leGNsdXNpb25zID0gdGhpcy5zZXR0aW5ncy5oZWFkZXJfZXhjbHVzaW9ucy5zcGxpdChcIixcIikubWFwKChoZWFkZXIpID0+IHtcbiAgICAgICAgcmV0dXJuIGhlYWRlci50cmltKCk7XG4gICAgICB9KTtcbiAgICB9XG4gICAgLy8gbG9hZCBwYXRoX29ubHkgaWYgbm90IGJsYW5rXG4gICAgaWYodGhpcy5zZXR0aW5ncy5wYXRoX29ubHkgJiYgdGhpcy5zZXR0aW5ncy5wYXRoX29ubHkubGVuZ3RoID4gMCkge1xuICAgICAgdGhpcy5wYXRoX29ubHkgPSB0aGlzLnNldHRpbmdzLnBhdGhfb25seS5zcGxpdChcIixcIikubWFwKChwYXRoKSA9PiB7XG4gICAgICAgIHJldHVybiBwYXRoLnRyaW0oKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgICAvLyBsb2FkIHNlbGZfcmVmX2t3X3JlZ2V4XG4gICAgdGhpcy5zZWxmX3JlZl9rd19yZWdleCA9IG5ldyBSZWdFeHAoYFxcXFxiKCR7U01BUlRfVFJBTlNMQVRJT05bdGhpcy5zZXR0aW5ncy5sYW5ndWFnZV0ucHJvbm91cy5qb2luKFwifFwiKX0pXFxcXGJgLCBcImdpXCIpO1xuICAgIC8vIGxvYWQgZmFpbGVkIGZpbGVzXG4gICAgYXdhaXQgdGhpcy5sb2FkX2ZhaWxlZF9maWxlcygpO1xuICB9XG4gIGFzeW5jIHNhdmVTZXR0aW5ncyhyZXJlbmRlcj1mYWxzZSkge1xuICAgIGF3YWl0IHRoaXMuc2F2ZURhdGEodGhpcy5zZXR0aW5ncyk7XG4gICAgLy8gcmUtbG9hZCBzZXR0aW5ncyBpbnRvIG1lbW9yeVxuICAgIGF3YWl0IHRoaXMubG9hZFNldHRpbmdzKCk7XG4gICAgLy8gcmUtcmVuZGVyIHZpZXcgaWYgc2V0IHRvIHRydWUgKGZvciBleGFtcGxlLCBhZnRlciBhZGRpbmcgQVBJIGtleSlcbiAgICBpZihyZXJlbmRlcikge1xuICAgICAgdGhpcy5uZWFyZXN0X2NhY2hlID0ge307XG4gICAgICBhd2FpdCB0aGlzLm1ha2VfY29ubmVjdGlvbnMoKTtcbiAgICB9XG4gIH1cblxuICAvLyBjaGVjayBmb3IgdXBkYXRlXG4gIGFzeW5jIGNoZWNrX2Zvcl91cGRhdGUoKSB7XG4gICAgLy8gZmFpbCBzaWxlbnRseSwgZXguIGlmIG5vIGludGVybmV0IGNvbm5lY3Rpb25cbiAgICB0cnkge1xuICAgICAgLy8gZ2V0IGxhdGVzdCByZWxlYXNlIHZlcnNpb24gZnJvbSBnaXRodWJcbiAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgKDAsIE9ic2lkaWFuLnJlcXVlc3RVcmwpKHtcbiAgICAgICAgdXJsOiBcImh0dHBzOi8vYXBpLmdpdGh1Yi5jb20vcmVwb3MvYnJpYW5wZXRyby9vYnNpZGlhbi1zbWFydC1jb25uZWN0aW9ucy9yZWxlYXNlcy9sYXRlc3RcIixcbiAgICAgICAgbWV0aG9kOiBcIkdFVFwiLFxuICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgXCJDb250ZW50LVR5cGVcIjogXCJhcHBsaWNhdGlvbi9qc29uXCIsXG4gICAgICAgIH0sXG4gICAgICAgIGNvbnRlbnRUeXBlOiBcImFwcGxpY2F0aW9uL2pzb25cIixcbiAgICAgIH0pO1xuICAgICAgLy8gZ2V0IHZlcnNpb24gbnVtYmVyIGZyb20gcmVzcG9uc2VcbiAgICAgIGNvbnN0IGxhdGVzdF9yZWxlYXNlID0gSlNPTi5wYXJzZShyZXNwb25zZS50ZXh0KS50YWdfbmFtZTtcbiAgICAgIC8vIGNvbnNvbGUubG9nKGBMYXRlc3QgcmVsZWFzZTogJHtsYXRlc3RfcmVsZWFzZX1gKTtcbiAgICAgIC8vIGlmIGxhdGVzdF9yZWxlYXNlIGlzIG5ld2VyIHRoYW4gY3VycmVudCB2ZXJzaW9uLCBzaG93IG1lc3NhZ2VcbiAgICAgIGlmKGxhdGVzdF9yZWxlYXNlICE9PSBWRVJTSU9OKSB7XG4gICAgICAgIG5ldyBPYnNpZGlhbi5Ob3RpY2UoYFtTbWFydCBDb25uZWN0aW9uc10gQSBuZXcgdmVyc2lvbiBpcyBhdmFpbGFibGUhICh2JHtsYXRlc3RfcmVsZWFzZX0pYCk7XG4gICAgICAgIHRoaXMudXBkYXRlX2F2YWlsYWJsZSA9IHRydWU7XG4gICAgICAgIHRoaXMucmVuZGVyX2JyYW5kKFwiYWxsXCIpXG4gICAgICB9XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUubG9nKGVycm9yKTtcbiAgICB9XG4gIH1cblxuICBhc3luYyByZW5kZXJfY29kZV9ibG9jayhjb250ZW50cywgY29udGFpbmVyLCBjdHgpIHtcbiAgICBsZXQgbmVhcmVzdDtcbiAgICBpZihjb250ZW50cy50cmltKCkubGVuZ3RoID4gMCkge1xuICAgICAgbmVhcmVzdCA9IGF3YWl0IHRoaXMuYXBpLnNlYXJjaChjb250ZW50cyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIHVzZSBjdHggdG8gZ2V0IGZpbGVcbiAgICAgIGNvbnNvbGUubG9nKGN0eCk7XG4gICAgICBjb25zdCBmaWxlID0gdGhpcy5hcHAudmF1bHQuZ2V0QWJzdHJhY3RGaWxlQnlQYXRoKGN0eC5zb3VyY2VQYXRoKTtcbiAgICAgIG5lYXJlc3QgPSBhd2FpdCB0aGlzLmZpbmRfbm90ZV9jb25uZWN0aW9ucyhmaWxlKTtcbiAgICB9XG4gICAgaWYgKG5lYXJlc3QubGVuZ3RoKSB7XG4gICAgICB0aGlzLnVwZGF0ZV9yZXN1bHRzKGNvbnRhaW5lciwgbmVhcmVzdCk7XG4gICAgfVxuICB9XG5cbiAgYXN5bmMgbWFrZV9jb25uZWN0aW9ucyhzZWxlY3RlZF90ZXh0PW51bGwpIHtcbiAgICBsZXQgdmlldyA9IHRoaXMuZ2V0X3ZpZXcoKTtcbiAgICBpZiAoIXZpZXcpIHtcbiAgICAgIC8vIG9wZW4gdmlldyBpZiBub3Qgb3BlblxuICAgICAgYXdhaXQgdGhpcy5vcGVuX3ZpZXcoKTtcbiAgICAgIHZpZXcgPSB0aGlzLmdldF92aWV3KCk7XG4gICAgfVxuICAgIGF3YWl0IHZpZXcucmVuZGVyX2Nvbm5lY3Rpb25zKHNlbGVjdGVkX3RleHQpO1xuICB9XG5cbiAgYWRkSWNvbigpe1xuICAgIE9ic2lkaWFuLmFkZEljb24oXCJzbWFydC1jb25uZWN0aW9uc1wiLCBgPHBhdGggZD1cIk01MCwyMCBMODAsNDAgTDgwLDYwIEw1MCwxMDBcIiBzdHJva2U9XCJjdXJyZW50Q29sb3JcIiBzdHJva2Utd2lkdGg9XCI0XCIgZmlsbD1cIm5vbmVcIi8+XG4gICAgPHBhdGggZD1cIk0zMCw1MCBMNTUsNzBcIiBzdHJva2U9XCJjdXJyZW50Q29sb3JcIiBzdHJva2Utd2lkdGg9XCI1XCIgZmlsbD1cIm5vbmVcIi8+XG4gICAgPGNpcmNsZSBjeD1cIjUwXCIgY3k9XCIyMFwiIHI9XCI5XCIgZmlsbD1cImN1cnJlbnRDb2xvclwiLz5cbiAgICA8Y2lyY2xlIGN4PVwiODBcIiBjeT1cIjQwXCIgcj1cIjlcIiBmaWxsPVwiY3VycmVudENvbG9yXCIvPlxuICAgIDxjaXJjbGUgY3g9XCI4MFwiIGN5PVwiNzBcIiByPVwiOVwiIGZpbGw9XCJjdXJyZW50Q29sb3JcIi8+XG4gICAgPGNpcmNsZSBjeD1cIjUwXCIgY3k9XCIxMDBcIiByPVwiOVwiIGZpbGw9XCJjdXJyZW50Q29sb3JcIi8+XG4gICAgPGNpcmNsZSBjeD1cIjMwXCIgY3k9XCI1MFwiIHI9XCI5XCIgZmlsbD1cImN1cnJlbnRDb2xvclwiLz5gKTtcbiAgfVxuXG4gIC8vIG9wZW4gcmFuZG9tIG5vdGVcbiAgYXN5bmMgb3Blbl9yYW5kb21fbm90ZSgpIHtcbiAgICBjb25zdCBjdXJyX2ZpbGUgPSB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0QWN0aXZlRmlsZSgpO1xuICAgIGNvbnN0IGN1cnJfa2V5ID0gbWQ1KGN1cnJfZmlsZS5wYXRoKTtcbiAgICAvLyBpZiBubyBuZWFyZXN0IGNhY2hlLCBjcmVhdGUgT2JzaWRpYW4gbm90aWNlXG4gICAgaWYodHlwZW9mIHRoaXMubmVhcmVzdF9jYWNoZVtjdXJyX2tleV0gPT09IFwidW5kZWZpbmVkXCIpIHtcbiAgICAgIG5ldyBPYnNpZGlhbi5Ob3RpY2UoXCJbU21hcnQgQ29ubmVjdGlvbnNdIE5vIFNtYXJ0IENvbm5lY3Rpb25zIGZvdW5kLiBPcGVuIGEgbm90ZSB0byBnZXQgU21hcnQgQ29ubmVjdGlvbnMuXCIpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICAvLyBnZXQgcmFuZG9tIGZyb20gbmVhcmVzdCBjYWNoZVxuICAgIGNvbnN0IHJhbmQgPSBNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiB0aGlzLm5lYXJlc3RfY2FjaGVbY3Vycl9rZXldLmxlbmd0aC8yKTsgLy8gZGl2aWRlIGJ5IDIgdG8gbGltaXQgdG8gdG9wIGhhbGYgb2YgcmVzdWx0c1xuICAgIGNvbnN0IHJhbmRvbV9maWxlID0gdGhpcy5uZWFyZXN0X2NhY2hlW2N1cnJfa2V5XVtyYW5kXTtcbiAgICAvLyBvcGVuIHJhbmRvbSBmaWxlXG4gICAgdGhpcy5vcGVuX25vdGUocmFuZG9tX2ZpbGUpO1xuICB9XG5cbiAgYXN5bmMgb3Blbl92aWV3KCkge1xuICAgIGlmKHRoaXMuZ2V0X3ZpZXcoKSl7XG4gICAgICBjb25zb2xlLmxvZyhcIlNtYXJ0IENvbm5lY3Rpb25zIHZpZXcgYWxyZWFkeSBvcGVuXCIpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB0aGlzLmFwcC53b3Jrc3BhY2UuZGV0YWNoTGVhdmVzT2ZUeXBlKFNNQVJUX0NPTk5FQ1RJT05TX1ZJRVdfVFlQRSk7XG4gICAgYXdhaXQgdGhpcy5hcHAud29ya3NwYWNlLmdldFJpZ2h0TGVhZihmYWxzZSkuc2V0Vmlld1N0YXRlKHtcbiAgICAgIHR5cGU6IFNNQVJUX0NPTk5FQ1RJT05TX1ZJRVdfVFlQRSxcbiAgICAgIGFjdGl2ZTogdHJ1ZSxcbiAgICB9KTtcbiAgICB0aGlzLmFwcC53b3Jrc3BhY2UucmV2ZWFsTGVhZihcbiAgICAgIHRoaXMuYXBwLndvcmtzcGFjZS5nZXRMZWF2ZXNPZlR5cGUoU01BUlRfQ09OTkVDVElPTlNfVklFV19UWVBFKVswXVxuICAgICk7XG4gIH1cbiAgLy8gc291cmNlOiBodHRwczovL2dpdGh1Yi5jb20vb2JzaWRpYW5tZC9vYnNpZGlhbi1yZWxlYXNlcy9ibG9iL21hc3Rlci9wbHVnaW4tcmV2aWV3Lm1kI2F2b2lkLW1hbmFnaW5nLXJlZmVyZW5jZXMtdG8tY3VzdG9tLXZpZXdzXG4gIGdldF92aWV3KCkge1xuICAgIGZvciAobGV0IGxlYWYgb2YgdGhpcy5hcHAud29ya3NwYWNlLmdldExlYXZlc09mVHlwZShTTUFSVF9DT05ORUNUSU9OU19WSUVXX1RZUEUpKSB7XG4gICAgICBpZiAobGVhZi52aWV3IGluc3RhbmNlb2YgU21hcnRDb25uZWN0aW9uc1ZpZXcpIHtcbiAgICAgICAgcmV0dXJuIGxlYWYudmlldztcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgLy8gb3BlbiBjaGF0IHZpZXdcbiAgYXN5bmMgb3Blbl9jaGF0KHJldHJpZXM9MCkge1xuICAgIGlmKCF0aGlzLmVtYmVkZGluZ3NfbG9hZGVkKSB7XG4gICAgICBjb25zb2xlLmxvZyhcImVtYmVkZGluZ3Mgbm90IGxvYWRlZCB5ZXRcIik7XG4gICAgICBpZihyZXRyaWVzIDwgMykge1xuICAgICAgICAvLyB3YWl0IGFuZCB0cnkgYWdhaW5cbiAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgICAgdGhpcy5vcGVuX2NoYXQocmV0cmllcysxKTtcbiAgICAgICAgfSwgMTAwMCAqIChyZXRyaWVzKzEpKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgY29uc29sZS5sb2coXCJlbWJlZGRpbmdzIHN0aWxsIG5vdCBsb2FkZWQsIG9wZW5pbmcgc21hcnQgdmlld1wiKTtcbiAgICAgIHRoaXMub3Blbl92aWV3KCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIHRoaXMuYXBwLndvcmtzcGFjZS5kZXRhY2hMZWF2ZXNPZlR5cGUoU01BUlRfQ09OTkVDVElPTlNfQ0hBVF9WSUVXX1RZUEUpO1xuICAgIGF3YWl0IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRSaWdodExlYWYoZmFsc2UpLnNldFZpZXdTdGF0ZSh7XG4gICAgICB0eXBlOiBTTUFSVF9DT05ORUNUSU9OU19DSEFUX1ZJRVdfVFlQRSxcbiAgICAgIGFjdGl2ZTogdHJ1ZSxcbiAgICB9KTtcbiAgICB0aGlzLmFwcC53b3Jrc3BhY2UucmV2ZWFsTGVhZihcbiAgICAgIHRoaXMuYXBwLndvcmtzcGFjZS5nZXRMZWF2ZXNPZlR5cGUoU01BUlRfQ09OTkVDVElPTlNfQ0hBVF9WSUVXX1RZUEUpWzBdXG4gICAgKTtcbiAgfVxuICBcbiAgLy8gZ2V0IGVtYmVkZGluZ3MgZm9yIGFsbCBmaWxlc1xuICBhc3luYyBnZXRfYWxsX2VtYmVkZGluZ3MoKSB7XG4gICAgLy8gZ2V0IGFsbCBmaWxlcyBpbiB2YXVsdCBhbmQgZmlsdGVyIGFsbCBidXQgbWFya2Rvd24gYW5kIGNhbnZhcyBmaWxlc1xuICAgIGNvbnN0IGZpbGVzID0gKGF3YWl0IHRoaXMuYXBwLnZhdWx0LmdldEZpbGVzKCkpLmZpbHRlcigoZmlsZSkgPT4gZmlsZSBpbnN0YW5jZW9mIE9ic2lkaWFuLlRGaWxlICYmIChmaWxlLmV4dGVuc2lvbiA9PT0gXCJtZFwiIHx8IGZpbGUuZXh0ZW5zaW9uID09PSBcImNhbnZhc1wiKSk7XG4gICAgLy8gY29uc3QgZmlsZXMgPSBhd2FpdCB0aGlzLmFwcC52YXVsdC5nZXRNYXJrZG93bkZpbGVzKCk7XG4gICAgLy8gZ2V0IG9wZW4gZmlsZXMgdG8gc2tpcCBpZiBmaWxlIGlzIGN1cnJlbnRseSBvcGVuXG4gICAgY29uc3Qgb3Blbl9maWxlcyA9IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRMZWF2ZXNPZlR5cGUoXCJtYXJrZG93blwiKS5tYXAoKGxlYWYpID0+IGxlYWYudmlldy5maWxlKTtcbiAgICBjb25zdCBjbGVhbl91cF9sb2cgPSB0aGlzLnNtYXJ0X3ZlY19saXRlLmNsZWFuX3VwX2VtYmVkZGluZ3MoZmlsZXMpO1xuICAgIGlmKHRoaXMuc2V0dGluZ3MubG9nX3JlbmRlcil7XG4gICAgICB0aGlzLnJlbmRlcl9sb2cudG90YWxfZmlsZXMgPSBmaWxlcy5sZW5ndGg7XG4gICAgICB0aGlzLnJlbmRlcl9sb2cuZGVsZXRlZF9lbWJlZGRpbmdzID0gY2xlYW5fdXBfbG9nLmRlbGV0ZWRfZW1iZWRkaW5ncztcbiAgICAgIHRoaXMucmVuZGVyX2xvZy50b3RhbF9lbWJlZGRpbmdzID0gY2xlYW5fdXBfbG9nLnRvdGFsX2VtYmVkZGluZ3M7XG4gICAgfVxuICAgIC8vIGJhdGNoIGVtYmVkZGluZ3NcbiAgICBsZXQgYmF0Y2hfcHJvbWlzZXMgPSBbXTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGZpbGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAvLyBza2lwIGlmIHBhdGggY29udGFpbnMgYSAjXG4gICAgICBpZihmaWxlc1tpXS5wYXRoLmluZGV4T2YoXCIjXCIpID4gLTEpIHtcbiAgICAgICAgLy8gY29uc29sZS5sb2coXCJza2lwcGluZyBmaWxlICdcIitmaWxlc1tpXS5wYXRoK1wiJyAocGF0aCBjb250YWlucyAjKVwiKTtcbiAgICAgICAgdGhpcy5sb2dfZXhjbHVzaW9uKFwicGF0aCBjb250YWlucyAjXCIpO1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIC8vIHNraXAgaWYgZmlsZSBhbHJlYWR5IGhhcyBlbWJlZGRpbmcgYW5kIGVtYmVkZGluZy5tdGltZSBpcyBncmVhdGVyIHRoYW4gb3IgZXF1YWwgdG8gZmlsZS5tdGltZVxuICAgICAgaWYodGhpcy5zbWFydF92ZWNfbGl0ZS5tdGltZV9pc19jdXJyZW50KG1kNShmaWxlc1tpXS5wYXRoKSwgZmlsZXNbaV0uc3RhdC5tdGltZSkpIHtcbiAgICAgICAgLy8gbG9nIHNraXBwaW5nIGZpbGVcbiAgICAgICAgLy8gY29uc29sZS5sb2coXCJza2lwcGluZyBmaWxlIChtdGltZSlcIik7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgICAgLy8gY2hlY2sgaWYgZmlsZSBpcyBpbiBmYWlsZWRfZmlsZXNcbiAgICAgIGlmKHRoaXMuc2V0dGluZ3MuZmFpbGVkX2ZpbGVzLmluZGV4T2YoZmlsZXNbaV0ucGF0aCkgPiAtMSkge1xuICAgICAgICAvLyBsb2cgc2tpcHBpbmcgZmlsZVxuICAgICAgICAvLyBjb25zb2xlLmxvZyhcInNraXBwaW5nIHByZXZpb3VzbHkgZmFpbGVkIGZpbGUsIHVzZSBidXR0b24gaW4gc2V0dGluZ3MgdG8gcmV0cnlcIik7XG4gICAgICAgIC8vIHVzZSBzZXRUaW1lb3V0IHRvIHByZXZlbnQgbXVsdGlwbGUgbm90aWNlc1xuICAgICAgICBpZih0aGlzLnJldHJ5X25vdGljZV90aW1lb3V0KSB7XG4gICAgICAgICAgY2xlYXJUaW1lb3V0KHRoaXMucmV0cnlfbm90aWNlX3RpbWVvdXQpO1xuICAgICAgICAgIHRoaXMucmV0cnlfbm90aWNlX3RpbWVvdXQgPSBudWxsO1xuICAgICAgICB9XG4gICAgICAgIC8vIGxpbWl0IHRvIG9uZSBub3RpY2UgZXZlcnkgMTAgbWludXRlc1xuICAgICAgICBpZighdGhpcy5yZWNlbnRseV9zZW50X3JldHJ5X25vdGljZSl7XG4gICAgICAgICAgbmV3IE9ic2lkaWFuLk5vdGljZShcIlNtYXJ0IENvbm5lY3Rpb25zOiBTa2lwcGluZyBwcmV2aW91c2x5IGZhaWxlZCBmaWxlLCB1c2UgYnV0dG9uIGluIHNldHRpbmdzIHRvIHJldHJ5XCIpO1xuICAgICAgICAgIHRoaXMucmVjZW50bHlfc2VudF9yZXRyeV9ub3RpY2UgPSB0cnVlO1xuICAgICAgICAgIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5yZWNlbnRseV9zZW50X3JldHJ5X25vdGljZSA9IGZhbHNlOyAgXG4gICAgICAgICAgfSwgNjAwMDAwKTtcbiAgICAgICAgfVxuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIC8vIHNraXAgZmlsZXMgd2hlcmUgcGF0aCBjb250YWlucyBhbnkgZXhjbHVzaW9uc1xuICAgICAgbGV0IHNraXAgPSBmYWxzZTtcbiAgICAgIGZvcihsZXQgaiA9IDA7IGogPCB0aGlzLmZpbGVfZXhjbHVzaW9ucy5sZW5ndGg7IGorKykge1xuICAgICAgICBpZihmaWxlc1tpXS5wYXRoLmluZGV4T2YodGhpcy5maWxlX2V4Y2x1c2lvbnNbal0pID4gLTEpIHtcbiAgICAgICAgICBza2lwID0gdHJ1ZTtcbiAgICAgICAgICB0aGlzLmxvZ19leGNsdXNpb24odGhpcy5maWxlX2V4Y2x1c2lvbnNbal0pO1xuICAgICAgICAgIC8vIGJyZWFrIG91dCBvZiBsb29wXG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmKHNraXApIHtcbiAgICAgICAgY29udGludWU7IC8vIHRvIG5leHQgZmlsZVxuICAgICAgfVxuICAgICAgLy8gY2hlY2sgaWYgZmlsZSBpcyBvcGVuXG4gICAgICBpZihvcGVuX2ZpbGVzLmluZGV4T2YoZmlsZXNbaV0pID4gLTEpIHtcbiAgICAgICAgLy8gY29uc29sZS5sb2coXCJza2lwcGluZyBmaWxlIChvcGVuKVwiKTtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgICB0cnkge1xuICAgICAgICAvLyBwdXNoIHByb21pc2UgdG8gYmF0Y2hfcHJvbWlzZXNcbiAgICAgICAgYmF0Y2hfcHJvbWlzZXMucHVzaCh0aGlzLmdldF9maWxlX2VtYmVkZGluZ3MoZmlsZXNbaV0sIGZhbHNlKSk7XG4gICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBjb25zb2xlLmxvZyhlcnJvcik7XG4gICAgICB9XG4gICAgICAvLyBpZiBiYXRjaF9wcm9taXNlcyBsZW5ndGggaXMgMTBcbiAgICAgIGlmKGJhdGNoX3Byb21pc2VzLmxlbmd0aCA+IDMpIHtcbiAgICAgICAgLy8gd2FpdCBmb3IgYWxsIHByb21pc2VzIHRvIHJlc29sdmVcbiAgICAgICAgYXdhaXQgUHJvbWlzZS5hbGwoYmF0Y2hfcHJvbWlzZXMpO1xuICAgICAgICAvLyBjbGVhciBiYXRjaF9wcm9taXNlc1xuICAgICAgICBiYXRjaF9wcm9taXNlcyA9IFtdO1xuICAgICAgfVxuXG4gICAgICAvLyBzYXZlIGVtYmVkZGluZ3MgSlNPTiB0byBmaWxlIGV2ZXJ5IDEwMCBmaWxlcyB0byBzYXZlIHByb2dyZXNzIG9uIGJ1bGsgZW1iZWRkaW5nXG4gICAgICBpZihpID4gMCAmJiBpICUgMTAwID09PSAwKSB7XG4gICAgICAgIGF3YWl0IHRoaXMuc2F2ZV9lbWJlZGRpbmdzX3RvX2ZpbGUoKTtcbiAgICAgIH1cbiAgICB9XG4gICAgLy8gd2FpdCBmb3IgYWxsIHByb21pc2VzIHRvIHJlc29sdmVcbiAgICBhd2FpdCBQcm9taXNlLmFsbChiYXRjaF9wcm9taXNlcyk7XG4gICAgLy8gd3JpdGUgZW1iZWRkaW5ncyBKU09OIHRvIGZpbGVcbiAgICBhd2FpdCB0aGlzLnNhdmVfZW1iZWRkaW5nc190b19maWxlKCk7XG4gICAgLy8gaWYgcmVuZGVyX2xvZy5mYWlsZWRfZW1iZWRkaW5ncyB0aGVuIHVwZGF0ZSBmYWlsZWRfZW1iZWRkaW5ncy50eHRcbiAgICBpZih0aGlzLnJlbmRlcl9sb2cuZmFpbGVkX2VtYmVkZGluZ3MubGVuZ3RoID4gMCkge1xuICAgICAgYXdhaXQgdGhpcy5zYXZlX2ZhaWxlZF9lbWJlZGRpbmdzKCk7XG4gICAgfVxuICB9XG5cbiAgYXN5bmMgc2F2ZV9lbWJlZGRpbmdzX3RvX2ZpbGUoZm9yY2U9ZmFsc2UpIHtcbiAgICBpZighdGhpcy5oYXNfbmV3X2VtYmVkZGluZ3Mpe1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICAvLyBjb25zb2xlLmxvZyhcIm5ldyBlbWJlZGRpbmdzLCBzYXZpbmcgdG8gZmlsZVwiKTtcbiAgICBpZighZm9yY2UpIHtcbiAgICAgIC8vIHByZXZlbnQgZXhjZXNzaXZlIHdyaXRlcyB0byBlbWJlZGRpbmdzIGZpbGUgYnkgd2FpdGluZyAxIG1pbnV0ZSBiZWZvcmUgd3JpdGluZ1xuICAgICAgaWYodGhpcy5zYXZlX3RpbWVvdXQpIHtcbiAgICAgICAgY2xlYXJUaW1lb3V0KHRoaXMuc2F2ZV90aW1lb3V0KTtcbiAgICAgICAgdGhpcy5zYXZlX3RpbWVvdXQgPSBudWxsOyAgXG4gICAgICB9XG4gICAgICB0aGlzLnNhdmVfdGltZW91dCA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICAvLyBjb25zb2xlLmxvZyhcIndyaXRpbmcgZW1iZWRkaW5ncyB0byBmaWxlXCIpO1xuICAgICAgICB0aGlzLnNhdmVfZW1iZWRkaW5nc190b19maWxlKHRydWUpO1xuICAgICAgICAvLyBjbGVhciB0aW1lb3V0XG4gICAgICAgIGlmKHRoaXMuc2F2ZV90aW1lb3V0KSB7XG4gICAgICAgICAgY2xlYXJUaW1lb3V0KHRoaXMuc2F2ZV90aW1lb3V0KTtcbiAgICAgICAgICB0aGlzLnNhdmVfdGltZW91dCA9IG51bGw7XG4gICAgICAgIH1cbiAgICAgIH0sIDMwMDAwKTtcbiAgICAgIGNvbnNvbGUubG9nKFwic2NoZWR1bGVkIHNhdmVcIik7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdHJ5e1xuICAgICAgLy8gdXNlIHNtYXJ0X3ZlY19saXRlXG4gICAgICBhd2FpdCB0aGlzLnNtYXJ0X3ZlY19saXRlLnNhdmUoKTtcbiAgICAgIHRoaXMuaGFzX25ld19lbWJlZGRpbmdzID0gZmFsc2U7XG4gICAgfWNhdGNoKGVycm9yKXtcbiAgICAgIGNvbnNvbGUubG9nKGVycm9yKTtcbiAgICAgIG5ldyBPYnNpZGlhbi5Ob3RpY2UoXCJTbWFydCBDb25uZWN0aW9uczogXCIrZXJyb3IubWVzc2FnZSk7XG4gICAgfVxuXG4gIH1cbiAgLy8gc2F2ZSBmYWlsZWQgZW1iZWRkaW5ncyB0byBmaWxlIGZyb20gcmVuZGVyX2xvZy5mYWlsZWRfZW1iZWRkaW5nc1xuICBhc3luYyBzYXZlX2ZhaWxlZF9lbWJlZGRpbmdzICgpIHtcbiAgICAvLyB3cml0ZSBmYWlsZWRfZW1iZWRkaW5ncyB0byBmaWxlIG9uZSBsaW5lIHBlciBmYWlsZWQgZW1iZWRkaW5nXG4gICAgbGV0IGZhaWxlZF9lbWJlZGRpbmdzID0gW107XG4gICAgLy8gaWYgZmlsZSBhbHJlYWR5IGV4aXN0cyB0aGVuIHJlYWQgaXRcbiAgICBjb25zdCBmYWlsZWRfZW1iZWRkaW5nc19maWxlX2V4aXN0cyA9IGF3YWl0IHRoaXMuYXBwLnZhdWx0LmFkYXB0ZXIuZXhpc3RzKFwiLnNtYXJ0LWNvbm5lY3Rpb25zL2ZhaWxlZC1lbWJlZGRpbmdzLnR4dFwiKTtcbiAgICBpZihmYWlsZWRfZW1iZWRkaW5nc19maWxlX2V4aXN0cykge1xuICAgICAgZmFpbGVkX2VtYmVkZGluZ3MgPSBhd2FpdCB0aGlzLmFwcC52YXVsdC5hZGFwdGVyLnJlYWQoXCIuc21hcnQtY29ubmVjdGlvbnMvZmFpbGVkLWVtYmVkZGluZ3MudHh0XCIpO1xuICAgICAgLy8gc3BsaXQgZmFpbGVkX2VtYmVkZGluZ3MgaW50byBhcnJheVxuICAgICAgZmFpbGVkX2VtYmVkZGluZ3MgPSBmYWlsZWRfZW1iZWRkaW5ncy5zcGxpdChcIlxcclxcblwiKTtcbiAgICB9XG4gICAgLy8gbWVyZ2UgZmFpbGVkX2VtYmVkZGluZ3Mgd2l0aCByZW5kZXJfbG9nLmZhaWxlZF9lbWJlZGRpbmdzXG4gICAgZmFpbGVkX2VtYmVkZGluZ3MgPSBmYWlsZWRfZW1iZWRkaW5ncy5jb25jYXQodGhpcy5yZW5kZXJfbG9nLmZhaWxlZF9lbWJlZGRpbmdzKTtcbiAgICAvLyByZW1vdmUgZHVwbGljYXRlc1xuICAgIGZhaWxlZF9lbWJlZGRpbmdzID0gWy4uLm5ldyBTZXQoZmFpbGVkX2VtYmVkZGluZ3MpXTtcbiAgICAvLyBzb3J0IGZhaWxlZF9lbWJlZGRpbmdzIGFycmF5IGFscGhhYmV0aWNhbGx5XG4gICAgZmFpbGVkX2VtYmVkZGluZ3Muc29ydCgpO1xuICAgIC8vIGNvbnZlcnQgZmFpbGVkX2VtYmVkZGluZ3MgYXJyYXkgdG8gc3RyaW5nXG4gICAgZmFpbGVkX2VtYmVkZGluZ3MgPSBmYWlsZWRfZW1iZWRkaW5ncy5qb2luKFwiXFxyXFxuXCIpO1xuICAgIC8vIHdyaXRlIGZhaWxlZF9lbWJlZGRpbmdzIHRvIGZpbGVcbiAgICBhd2FpdCB0aGlzLmFwcC52YXVsdC5hZGFwdGVyLndyaXRlKFwiLnNtYXJ0LWNvbm5lY3Rpb25zL2ZhaWxlZC1lbWJlZGRpbmdzLnR4dFwiLCBmYWlsZWRfZW1iZWRkaW5ncyk7XG4gICAgLy8gcmVsb2FkIGZhaWxlZF9lbWJlZGRpbmdzIHRvIHByZXZlbnQgcmV0cnlpbmcgZmFpbGVkIGZpbGVzIHVudGlsIGV4cGxpY2l0bHkgcmVxdWVzdGVkXG4gICAgYXdhaXQgdGhpcy5sb2FkX2ZhaWxlZF9maWxlcygpO1xuICB9XG4gIFxuICAvLyBsb2FkIGZhaWxlZCBmaWxlcyBmcm9tIGZhaWxlZC1lbWJlZGRpbmdzLnR4dFxuICBhc3luYyBsb2FkX2ZhaWxlZF9maWxlcyAoKSB7XG4gICAgLy8gY2hlY2sgaWYgZmFpbGVkLWVtYmVkZGluZ3MudHh0IGV4aXN0c1xuICAgIGNvbnN0IGZhaWxlZF9lbWJlZGRpbmdzX2ZpbGVfZXhpc3RzID0gYXdhaXQgdGhpcy5hcHAudmF1bHQuYWRhcHRlci5leGlzdHMoXCIuc21hcnQtY29ubmVjdGlvbnMvZmFpbGVkLWVtYmVkZGluZ3MudHh0XCIpO1xuICAgIGlmKCFmYWlsZWRfZW1iZWRkaW5nc19maWxlX2V4aXN0cykge1xuICAgICAgdGhpcy5zZXR0aW5ncy5mYWlsZWRfZmlsZXMgPSBbXTtcbiAgICAgIGNvbnNvbGUubG9nKFwiTm8gZmFpbGVkIGZpbGVzLlwiKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgLy8gcmVhZCBmYWlsZWQtZW1iZWRkaW5ncy50eHRcbiAgICBjb25zdCBmYWlsZWRfZW1iZWRkaW5ncyA9IGF3YWl0IHRoaXMuYXBwLnZhdWx0LmFkYXB0ZXIucmVhZChcIi5zbWFydC1jb25uZWN0aW9ucy9mYWlsZWQtZW1iZWRkaW5ncy50eHRcIik7XG4gICAgLy8gc3BsaXQgZmFpbGVkX2VtYmVkZGluZ3MgaW50byBhcnJheSBhbmQgcmVtb3ZlIGVtcHR5IGxpbmVzXG4gICAgY29uc3QgZmFpbGVkX2VtYmVkZGluZ3NfYXJyYXkgPSBmYWlsZWRfZW1iZWRkaW5ncy5zcGxpdChcIlxcclxcblwiKTtcbiAgICAvLyBzcGxpdCBhdCAnIycgYW5kIHJlZHVjZSBpbnRvIHVuaXF1ZSBmaWxlIHBhdGhzXG4gICAgY29uc3QgZmFpbGVkX2ZpbGVzID0gZmFpbGVkX2VtYmVkZGluZ3NfYXJyYXkubWFwKGVtYmVkZGluZyA9PiBlbWJlZGRpbmcuc3BsaXQoXCIjXCIpWzBdKS5yZWR1Y2UoKHVuaXF1ZSwgaXRlbSkgPT4gdW5pcXVlLmluY2x1ZGVzKGl0ZW0pID8gdW5pcXVlIDogWy4uLnVuaXF1ZSwgaXRlbV0sIFtdKTtcbiAgICAvLyByZXR1cm4gZmFpbGVkX2ZpbGVzXG4gICAgdGhpcy5zZXR0aW5ncy5mYWlsZWRfZmlsZXMgPSBmYWlsZWRfZmlsZXM7XG4gICAgLy8gY29uc29sZS5sb2coZmFpbGVkX2ZpbGVzKTtcbiAgfVxuICAvLyByZXRyeSBmYWlsZWQgZW1iZWRkaW5nc1xuICBhc3luYyByZXRyeV9mYWlsZWRfZmlsZXMgKCkge1xuICAgIC8vIHJlbW92ZSBmYWlsZWQgZmlsZXMgZnJvbSBmYWlsZWRfZmlsZXNcbiAgICB0aGlzLnNldHRpbmdzLmZhaWxlZF9maWxlcyA9IFtdO1xuICAgIC8vIGlmIGZhaWxlZC1lbWJlZGRpbmdzLnR4dCBleGlzdHMgdGhlbiBkZWxldGUgaXRcbiAgICBjb25zdCBmYWlsZWRfZW1iZWRkaW5nc19maWxlX2V4aXN0cyA9IGF3YWl0IHRoaXMuYXBwLnZhdWx0LmFkYXB0ZXIuZXhpc3RzKFwiLnNtYXJ0LWNvbm5lY3Rpb25zL2ZhaWxlZC1lbWJlZGRpbmdzLnR4dFwiKTtcbiAgICBpZihmYWlsZWRfZW1iZWRkaW5nc19maWxlX2V4aXN0cykge1xuICAgICAgYXdhaXQgdGhpcy5hcHAudmF1bHQuYWRhcHRlci5yZW1vdmUoXCIuc21hcnQtY29ubmVjdGlvbnMvZmFpbGVkLWVtYmVkZGluZ3MudHh0XCIpO1xuICAgIH1cbiAgICAvLyBydW4gZ2V0IGFsbCBlbWJlZGRpbmdzXG4gICAgYXdhaXQgdGhpcy5nZXRfYWxsX2VtYmVkZGluZ3MoKTtcbiAgfVxuXG5cbiAgLy8gYWRkIC5zbWFydC1jb25uZWN0aW9ucyB0byAuZ2l0aWdub3JlIHRvIHByZXZlbnQgaXNzdWVzIHdpdGggbGFyZ2UsIGZyZXF1ZW50bHkgdXBkYXRlZCBlbWJlZGRpbmdzIGZpbGUocylcbiAgYXN5bmMgYWRkX3RvX2dpdGlnbm9yZSgpIHtcbiAgICBpZighKGF3YWl0IHRoaXMuYXBwLnZhdWx0LmFkYXB0ZXIuZXhpc3RzKFwiLmdpdGlnbm9yZVwiKSkpIHtcbiAgICAgIHJldHVybjsgLy8gaWYgLmdpdGlnbm9yZSBkb2Vzbid0IGV4aXN0IHRoZW4gZG9uJ3QgYWRkIC5zbWFydC1jb25uZWN0aW9ucyB0byAuZ2l0aWdub3JlXG4gICAgfVxuICAgIGxldCBnaXRpZ25vcmVfZmlsZSA9IGF3YWl0IHRoaXMuYXBwLnZhdWx0LmFkYXB0ZXIucmVhZChcIi5naXRpZ25vcmVcIik7XG4gICAgLy8gaWYgLnNtYXJ0LWNvbm5lY3Rpb25zIG5vdCBpbiAuZ2l0aWdub3JlXG4gICAgaWYgKGdpdGlnbm9yZV9maWxlLmluZGV4T2YoXCIuc21hcnQtY29ubmVjdGlvbnNcIikgPCAwKSB7XG4gICAgICAvLyBhZGQgLnNtYXJ0LWNvbm5lY3Rpb25zIHRvIC5naXRpZ25vcmVcbiAgICAgIGxldCBhZGRfdG9fZ2l0aWdub3JlID0gXCJcXG5cXG4jIElnbm9yZSBTbWFydCBDb25uZWN0aW9ucyBmb2xkZXIgYmVjYXVzZSBlbWJlZGRpbmdzIGZpbGUgaXMgbGFyZ2UgYW5kIHVwZGF0ZWQgZnJlcXVlbnRseVwiO1xuICAgICAgYWRkX3RvX2dpdGlnbm9yZSArPSBcIlxcbi5zbWFydC1jb25uZWN0aW9uc1wiO1xuICAgICAgYXdhaXQgdGhpcy5hcHAudmF1bHQuYWRhcHRlci53cml0ZShcIi5naXRpZ25vcmVcIiwgZ2l0aWdub3JlX2ZpbGUgKyBhZGRfdG9fZ2l0aWdub3JlKTtcbiAgICAgIGNvbnNvbGUubG9nKFwiYWRkZWQgLnNtYXJ0LWNvbm5lY3Rpb25zIHRvIC5naXRpZ25vcmVcIik7XG4gICAgfVxuICB9XG5cbiAgLy8gZm9yY2UgcmVmcmVzaCBlbWJlZGRpbmdzIGZpbGUgYnV0IGZpcnN0IHJlbmFtZSBleGlzdGluZyBlbWJlZGRpbmdzIGZpbGUgdG8gLnNtYXJ0LWNvbm5lY3Rpb25zL2VtYmVkZGluZ3MtWVlZWS1NTS1ERC5qc29uXG4gIGFzeW5jIGZvcmNlX3JlZnJlc2hfZW1iZWRkaW5nc19maWxlKCkge1xuICAgIG5ldyBPYnNpZGlhbi5Ob3RpY2UoXCJTbWFydCBDb25uZWN0aW9uczogZW1iZWRkaW5ncyBmaWxlIEZvcmNlIFJlZnJlc2hlZCwgbWFraW5nIG5ldyBjb25uZWN0aW9ucy4uLlwiKTtcbiAgICAvLyBmb3JjZSByZWZyZXNoXG4gICAgYXdhaXQgdGhpcy5zbWFydF92ZWNfbGl0ZS5mb3JjZV9yZWZyZXNoKCk7XG4gICAgLy8gdHJpZ2dlciBtYWtpbmcgbmV3IGNvbm5lY3Rpb25zXG4gICAgYXdhaXQgdGhpcy5nZXRfYWxsX2VtYmVkZGluZ3MoKTtcbiAgICB0aGlzLm91dHB1dF9yZW5kZXJfbG9nKCk7XG4gICAgbmV3IE9ic2lkaWFuLk5vdGljZShcIlNtYXJ0IENvbm5lY3Rpb25zOiBlbWJlZGRpbmdzIGZpbGUgRm9yY2UgUmVmcmVzaGVkLCBuZXcgY29ubmVjdGlvbnMgbWFkZS5cIik7XG4gIH1cblxuICAvLyBnZXQgZW1iZWRkaW5ncyBmb3IgZW1iZWRfaW5wdXRcbiAgYXN5bmMgZ2V0X2ZpbGVfZW1iZWRkaW5ncyhjdXJyX2ZpbGUsIHNhdmU9dHJ1ZSkge1xuICAgIC8vIGxldCBiYXRjaF9wcm9taXNlcyA9IFtdO1xuICAgIGxldCByZXFfYmF0Y2ggPSBbXTtcbiAgICBsZXQgYmxvY2tzID0gW107XG4gICAgLy8gaW5pdGlhdGUgY3Vycl9maWxlX2tleSBmcm9tIG1kNShjdXJyX2ZpbGUucGF0aClcbiAgICBjb25zdCBjdXJyX2ZpbGVfa2V5ID0gbWQ1KGN1cnJfZmlsZS5wYXRoKTtcbiAgICAvLyBpbnRpYXRlIGZpbGVfZmlsZV9lbWJlZF9pbnB1dCBieSByZW1vdmluZyAubWQgYW5kIGNvbnZlcnRpbmcgZmlsZSBwYXRoIHRvIGJyZWFkY3J1bWJzIChcIiA+IFwiKVxuICAgIGxldCBmaWxlX2VtYmVkX2lucHV0ID0gY3Vycl9maWxlLnBhdGgucmVwbGFjZShcIi5tZFwiLCBcIlwiKTtcbiAgICBmaWxlX2VtYmVkX2lucHV0ID0gZmlsZV9lbWJlZF9pbnB1dC5yZXBsYWNlKC9cXC8vZywgXCIgPiBcIik7XG4gICAgLy8gZW1iZWQgb24gZmlsZS5uYW1lL3RpdGxlIG9ubHkgaWYgcGF0aF9vbmx5IHBhdGggbWF0Y2hlciBzcGVjaWZpZWQgaW4gc2V0dGluZ3NcbiAgICBsZXQgcGF0aF9vbmx5ID0gZmFsc2U7XG4gICAgZm9yKGxldCBqID0gMDsgaiA8IHRoaXMucGF0aF9vbmx5Lmxlbmd0aDsgaisrKSB7XG4gICAgICBpZihjdXJyX2ZpbGUucGF0aC5pbmRleE9mKHRoaXMucGF0aF9vbmx5W2pdKSA+IC0xKSB7XG4gICAgICAgIHBhdGhfb25seSA9IHRydWU7XG4gICAgICAgIGNvbnNvbGUubG9nKFwidGl0bGUgb25seSBmaWxlIHdpdGggbWF0Y2hlcjogXCIgKyB0aGlzLnBhdGhfb25seVtqXSk7XG4gICAgICAgIC8vIGJyZWFrIG91dCBvZiBsb29wXG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgICAvLyByZXR1cm4gZWFybHkgaWYgcGF0aF9vbmx5XG4gICAgaWYocGF0aF9vbmx5KSB7XG4gICAgICByZXFfYmF0Y2gucHVzaChbY3Vycl9maWxlX2tleSwgZmlsZV9lbWJlZF9pbnB1dCwge1xuICAgICAgICBtdGltZTogY3Vycl9maWxlLnN0YXQubXRpbWUsXG4gICAgICAgIHBhdGg6IGN1cnJfZmlsZS5wYXRoLFxuICAgICAgfV0pO1xuICAgICAgYXdhaXQgdGhpcy5nZXRfZW1iZWRkaW5nc19iYXRjaChyZXFfYmF0Y2gpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBCRUdJTiBDYW52YXMgZmlsZSB0eXBlIEVtYmVkZGluZ1xuICAgICAqL1xuICAgIGlmKGN1cnJfZmlsZS5leHRlbnNpb24gPT09IFwiY2FudmFzXCIpIHtcbiAgICAgIC8vIGdldCBmaWxlIGNvbnRlbnRzIGFuZCBwYXJzZSBhcyBKU09OXG4gICAgICBjb25zdCBjYW52YXNfY29udGVudHMgPSBhd2FpdCB0aGlzLmFwcC52YXVsdC5jYWNoZWRSZWFkKGN1cnJfZmlsZSk7XG4gICAgICBpZigodHlwZW9mIGNhbnZhc19jb250ZW50cyA9PT0gXCJzdHJpbmdcIikgJiYgKGNhbnZhc19jb250ZW50cy5pbmRleE9mKFwibm9kZXNcIikgPiAtMSkpIHtcbiAgICAgICAgY29uc3QgY2FudmFzX2pzb24gPSBKU09OLnBhcnNlKGNhbnZhc19jb250ZW50cyk7XG4gICAgICAgIC8vIGZvciBlYWNoIG9iamVjdCBpbiBub2RlcyBhcnJheVxuICAgICAgICBmb3IobGV0IGogPSAwOyBqIDwgY2FudmFzX2pzb24ubm9kZXMubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAvLyBpZiBvYmplY3QgaGFzIHRleHQgcHJvcGVydHlcbiAgICAgICAgICBpZihjYW52YXNfanNvbi5ub2Rlc1tqXS50ZXh0KSB7XG4gICAgICAgICAgICAvLyBhZGQgdG8gZmlsZV9lbWJlZF9pbnB1dFxuICAgICAgICAgICAgZmlsZV9lbWJlZF9pbnB1dCArPSBcIlxcblwiICsgY2FudmFzX2pzb24ubm9kZXNbal0udGV4dDtcbiAgICAgICAgICB9XG4gICAgICAgICAgLy8gaWYgb2JqZWN0IGhhcyBmaWxlIHByb3BlcnR5XG4gICAgICAgICAgaWYoY2FudmFzX2pzb24ubm9kZXNbal0uZmlsZSkge1xuICAgICAgICAgICAgLy8gYWRkIHRvIGZpbGVfZW1iZWRfaW5wdXRcbiAgICAgICAgICAgIGZpbGVfZW1iZWRfaW5wdXQgKz0gXCJcXG5MaW5rOiBcIiArIGNhbnZhc19qc29uLm5vZGVzW2pdLmZpbGU7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICAvLyBjb25zb2xlLmxvZyhmaWxlX2VtYmVkX2lucHV0KTtcbiAgICAgIHJlcV9iYXRjaC5wdXNoKFtjdXJyX2ZpbGVfa2V5LCBmaWxlX2VtYmVkX2lucHV0LCB7XG4gICAgICAgIG10aW1lOiBjdXJyX2ZpbGUuc3RhdC5tdGltZSxcbiAgICAgICAgcGF0aDogY3Vycl9maWxlLnBhdGgsXG4gICAgICB9XSk7XG4gICAgICBhd2FpdCB0aGlzLmdldF9lbWJlZGRpbmdzX2JhdGNoKHJlcV9iYXRjaCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIFxuICAgIC8qKlxuICAgICAqIEJFR0lOIEJsb2NrIFwic2VjdGlvblwiIGVtYmVkZGluZ1xuICAgICAqL1xuICAgIC8vIGdldCBmaWxlIGNvbnRlbnRzXG4gICAgY29uc3Qgbm90ZV9jb250ZW50cyA9IGF3YWl0IHRoaXMuYXBwLnZhdWx0LmNhY2hlZFJlYWQoY3Vycl9maWxlKTtcbiAgICBsZXQgcHJvY2Vzc2VkX3NpbmNlX2xhc3Rfc2F2ZSA9IDA7XG4gICAgY29uc3Qgbm90ZV9zZWN0aW9ucyA9IHRoaXMuYmxvY2tfcGFyc2VyKG5vdGVfY29udGVudHMsIGN1cnJfZmlsZS5wYXRoKTtcbiAgICAvLyBjb25zb2xlLmxvZyhub3RlX3NlY3Rpb25zKTtcbiAgICAvLyBpZiBub3RlIGhhcyBtb3JlIHRoYW4gb25lIHNlY3Rpb24gKGlmIG9ubHkgb25lIHRoZW4gaXRzIHNhbWUgYXMgZnVsbC1jb250ZW50KVxuICAgIGlmKG5vdGVfc2VjdGlvbnMubGVuZ3RoID4gMSkge1xuICAgICAgLy8gZm9yIGVhY2ggc2VjdGlvbiBpbiBmaWxlXG4gICAgICAvL2NvbnNvbGUubG9nKFwiU2VjdGlvbnM6IFwiICsgbm90ZV9zZWN0aW9ucy5sZW5ndGgpO1xuICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCBub3RlX3NlY3Rpb25zLmxlbmd0aDsgaisrKSB7XG4gICAgICAgIC8vIGdldCBlbWJlZF9pbnB1dCBmb3IgYmxvY2tcbiAgICAgICAgY29uc3QgYmxvY2tfZW1iZWRfaW5wdXQgPSBub3RlX3NlY3Rpb25zW2pdLnRleHQ7XG4gICAgICAgIC8vIGNvbnNvbGUubG9nKG5vdGVfc2VjdGlvbnNbal0ucGF0aCk7XG4gICAgICAgIC8vIGdldCBibG9jayBrZXkgZnJvbSBibG9jay5wYXRoIChjb250YWlucyBib3RoIGZpbGUucGF0aCBhbmQgaGVhZGVyIHBhdGgpXG4gICAgICAgIGNvbnN0IGJsb2NrX2tleSA9IG1kNShub3RlX3NlY3Rpb25zW2pdLnBhdGgpO1xuICAgICAgICBibG9ja3MucHVzaChibG9ja19rZXkpO1xuICAgICAgICAvLyBza2lwIGlmIGxlbmd0aCBvZiBibG9ja19lbWJlZF9pbnB1dCBzYW1lIGFzIGxlbmd0aCBvZiBlbWJlZGRpbmdzW2Jsb2NrX2tleV0ubWV0YS5zaXplXG4gICAgICAgIC8vIFRPRE8gY29uc2lkZXIgcm91bmRpbmcgdG8gbmVhcmVzdCAxMCBvciAxMDAgZm9yIGZ1enp5IG1hdGNoaW5nXG4gICAgICAgIGlmICh0aGlzLnNtYXJ0X3ZlY19saXRlLmdldF9zaXplKGJsb2NrX2tleSkgPT09IGJsb2NrX2VtYmVkX2lucHV0Lmxlbmd0aCkge1xuICAgICAgICAgIC8vIGxvZyBza2lwcGluZyBmaWxlXG4gICAgICAgICAgLy8gY29uc29sZS5sb2coXCJza2lwcGluZyBibG9jayAobGVuKVwiKTtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICAgICAgICAvLyBhZGQgaGFzaCB0byBibG9ja3MgdG8gcHJldmVudCBlbXB0eSBibG9ja3MgdHJpZ2dlcmluZyBmdWxsLWZpbGUgZW1iZWRkaW5nXG4gICAgICAgIC8vIHNraXAgaWYgZW1iZWRkaW5ncyBrZXkgYWxyZWFkeSBleGlzdHMgYW5kIGJsb2NrIG10aW1lIGlzIGdyZWF0ZXIgdGhhbiBvciBlcXVhbCB0byBmaWxlIG10aW1lXG4gICAgICAgIGlmKHRoaXMuc21hcnRfdmVjX2xpdGUubXRpbWVfaXNfY3VycmVudChibG9ja19rZXksIGN1cnJfZmlsZS5zdGF0Lm10aW1lKSkge1xuICAgICAgICAgIC8vIGxvZyBza2lwcGluZyBmaWxlXG4gICAgICAgICAgLy8gY29uc29sZS5sb2coXCJza2lwcGluZyBibG9jayAobXRpbWUpXCIpO1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICAgIC8vIHNraXAgaWYgaGFzaCBpcyBwcmVzZW50IGluIGVtYmVkZGluZ3MgYW5kIGhhc2ggb2YgYmxvY2tfZW1iZWRfaW5wdXQgaXMgZXF1YWwgdG8gaGFzaCBpbiBlbWJlZGRpbmdzXG4gICAgICAgIGNvbnN0IGJsb2NrX2hhc2ggPSBtZDUoYmxvY2tfZW1iZWRfaW5wdXQudHJpbSgpKTtcbiAgICAgICAgaWYodGhpcy5zbWFydF92ZWNfbGl0ZS5nZXRfaGFzaChibG9ja19rZXkpID09PSBibG9ja19oYXNoKSB7XG4gICAgICAgICAgLy8gbG9nIHNraXBwaW5nIGZpbGVcbiAgICAgICAgICAvLyBjb25zb2xlLmxvZyhcInNraXBwaW5nIGJsb2NrIChoYXNoKVwiKTtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGNyZWF0ZSByZXFfYmF0Y2ggZm9yIGJhdGNoaW5nIHJlcXVlc3RzXG4gICAgICAgIHJlcV9iYXRjaC5wdXNoKFtibG9ja19rZXksIGJsb2NrX2VtYmVkX2lucHV0LCB7XG4gICAgICAgICAgLy8gb2xkbXRpbWU6IGN1cnJfZmlsZS5zdGF0Lm10aW1lLCBcbiAgICAgICAgICAvLyBnZXQgY3VycmVudCBkYXRldGltZSBhcyB1bml4IHRpbWVzdGFtcFxuICAgICAgICAgIG10aW1lOiBEYXRlLm5vdygpLFxuICAgICAgICAgIGhhc2g6IGJsb2NrX2hhc2gsIFxuICAgICAgICAgIHBhcmVudDogY3Vycl9maWxlX2tleSxcbiAgICAgICAgICBwYXRoOiBub3RlX3NlY3Rpb25zW2pdLnBhdGgsXG4gICAgICAgICAgc2l6ZTogYmxvY2tfZW1iZWRfaW5wdXQubGVuZ3RoLFxuICAgICAgICB9XSk7XG4gICAgICAgIGlmKHJlcV9iYXRjaC5sZW5ndGggPiA5KSB7XG4gICAgICAgICAgLy8gYWRkIGJhdGNoIHRvIGJhdGNoX3Byb21pc2VzXG4gICAgICAgICAgYXdhaXQgdGhpcy5nZXRfZW1iZWRkaW5nc19iYXRjaChyZXFfYmF0Y2gpO1xuICAgICAgICAgIHByb2Nlc3NlZF9zaW5jZV9sYXN0X3NhdmUgKz0gcmVxX2JhdGNoLmxlbmd0aDtcbiAgICAgICAgICAvLyBsb2cgZW1iZWRkaW5nXG4gICAgICAgICAgLy8gY29uc29sZS5sb2coXCJlbWJlZGRpbmc6IFwiICsgY3Vycl9maWxlLnBhdGgpO1xuICAgICAgICAgIGlmIChwcm9jZXNzZWRfc2luY2VfbGFzdF9zYXZlID49IDMwKSB7XG4gICAgICAgICAgICAvLyB3cml0ZSBlbWJlZGRpbmdzIEpTT04gdG8gZmlsZVxuICAgICAgICAgICAgYXdhaXQgdGhpcy5zYXZlX2VtYmVkZGluZ3NfdG9fZmlsZSgpO1xuICAgICAgICAgICAgLy8gcmVzZXQgcHJvY2Vzc2VkX3NpbmNlX2xhc3Rfc2F2ZVxuICAgICAgICAgICAgcHJvY2Vzc2VkX3NpbmNlX2xhc3Rfc2F2ZSA9IDA7XG4gICAgICAgICAgfVxuICAgICAgICAgIC8vIHJlc2V0IHJlcV9iYXRjaFxuICAgICAgICAgIHJlcV9iYXRjaCA9IFtdO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIC8vIGlmIHJlcV9iYXRjaCBpcyBub3QgZW1wdHlcbiAgICBpZihyZXFfYmF0Y2gubGVuZ3RoID4gMCkge1xuICAgICAgLy8gcHJvY2VzcyByZW1haW5pbmcgcmVxX2JhdGNoXG4gICAgICBhd2FpdCB0aGlzLmdldF9lbWJlZGRpbmdzX2JhdGNoKHJlcV9iYXRjaCk7XG4gICAgICByZXFfYmF0Y2ggPSBbXTtcbiAgICAgIHByb2Nlc3NlZF9zaW5jZV9sYXN0X3NhdmUgKz0gcmVxX2JhdGNoLmxlbmd0aDtcbiAgICB9XG4gICAgXG4gICAgLyoqXG4gICAgICogQkVHSU4gRmlsZSBcImZ1bGwgbm90ZVwiIGVtYmVkZGluZ1xuICAgICAqL1xuXG4gICAgLy8gaWYgZmlsZSBsZW5ndGggaXMgbGVzcyB0aGFuIH44MDAwIHRva2VucyB1c2UgZnVsbCBmaWxlIGNvbnRlbnRzXG4gICAgLy8gZWxzZSBpZiBmaWxlIGxlbmd0aCBpcyBncmVhdGVyIHRoYW4gODAwMCB0b2tlbnMgYnVpbGQgZmlsZV9lbWJlZF9pbnB1dCBmcm9tIGZpbGUgaGVhZGluZ3NcbiAgICBmaWxlX2VtYmVkX2lucHV0ICs9IGA6XFxuYDtcbiAgICAvKipcbiAgICAgKiBUT0RPOiBpbXByb3ZlL3JlZmFjdG9yIHRoZSBmb2xsb3dpbmcgXCJsYXJnZSBmaWxlIHJlZHVjZSB0byBoZWFkaW5nc1wiIGxvZ2ljXG4gICAgICovXG4gICAgaWYobm90ZV9jb250ZW50cy5sZW5ndGggPCBNQVhfRU1CRURfU1RSSU5HX0xFTkdUSCkge1xuICAgICAgZmlsZV9lbWJlZF9pbnB1dCArPSBub3RlX2NvbnRlbnRzXG4gICAgfWVsc2V7IFxuICAgICAgY29uc3Qgbm90ZV9tZXRhX2NhY2hlID0gdGhpcy5hcHAubWV0YWRhdGFDYWNoZS5nZXRGaWxlQ2FjaGUoY3Vycl9maWxlKTtcbiAgICAgIC8vIGZvciBlYWNoIGhlYWRpbmcgaW4gZmlsZVxuICAgICAgaWYodHlwZW9mIG5vdGVfbWV0YV9jYWNoZS5oZWFkaW5ncyA9PT0gXCJ1bmRlZmluZWRcIikge1xuICAgICAgICAvLyBjb25zb2xlLmxvZyhcIm5vIGhlYWRpbmdzIGZvdW5kLCB1c2luZyBmaXJzdCBjaHVuayBvZiBmaWxlIGluc3RlYWRcIik7XG4gICAgICAgIGZpbGVfZW1iZWRfaW5wdXQgKz0gbm90ZV9jb250ZW50cy5zdWJzdHJpbmcoMCwgTUFYX0VNQkVEX1NUUklOR19MRU5HVEgpO1xuICAgICAgfWVsc2V7XG4gICAgICAgIGxldCBub3RlX2hlYWRpbmdzID0gXCJcIjtcbiAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCBub3RlX21ldGFfY2FjaGUuaGVhZGluZ3MubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAvLyBnZXQgaGVhZGluZyBsZXZlbFxuICAgICAgICAgIGNvbnN0IGhlYWRpbmdfbGV2ZWwgPSBub3RlX21ldGFfY2FjaGUuaGVhZGluZ3Nbal0ubGV2ZWw7XG4gICAgICAgICAgLy8gZ2V0IGhlYWRpbmcgdGV4dFxuICAgICAgICAgIGNvbnN0IGhlYWRpbmdfdGV4dCA9IG5vdGVfbWV0YV9jYWNoZS5oZWFkaW5nc1tqXS5oZWFkaW5nO1xuICAgICAgICAgIC8vIGJ1aWxkIG1hcmtkb3duIGhlYWRpbmdcbiAgICAgICAgICBsZXQgbWRfaGVhZGluZyA9IFwiXCI7XG4gICAgICAgICAgZm9yIChsZXQgayA9IDA7IGsgPCBoZWFkaW5nX2xldmVsOyBrKyspIHtcbiAgICAgICAgICAgIG1kX2hlYWRpbmcgKz0gXCIjXCI7XG4gICAgICAgICAgfVxuICAgICAgICAgIC8vIGFkZCBoZWFkaW5nIHRvIG5vdGVfaGVhZGluZ3NcbiAgICAgICAgICBub3RlX2hlYWRpbmdzICs9IGAke21kX2hlYWRpbmd9ICR7aGVhZGluZ190ZXh0fVxcbmA7XG4gICAgICAgIH1cbiAgICAgICAgLy9jb25zb2xlLmxvZyhub3RlX2hlYWRpbmdzKTtcbiAgICAgICAgZmlsZV9lbWJlZF9pbnB1dCArPSBub3RlX2hlYWRpbmdzXG4gICAgICAgIGlmKGZpbGVfZW1iZWRfaW5wdXQubGVuZ3RoID4gTUFYX0VNQkVEX1NUUklOR19MRU5HVEgpIHtcbiAgICAgICAgICBmaWxlX2VtYmVkX2lucHV0ID0gZmlsZV9lbWJlZF9pbnB1dC5zdWJzdHJpbmcoMCwgTUFYX0VNQkVEX1NUUklOR19MRU5HVEgpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIC8vIHNraXAgZW1iZWRkaW5nIGZ1bGwgZmlsZSBpZiBibG9ja3MgaXMgbm90IGVtcHR5IGFuZCBhbGwgaGFzaGVzIGFyZSBwcmVzZW50IGluIGVtYmVkZGluZ3NcbiAgICAvLyBiZXR0ZXIgdGhhbiBoYXNoaW5nIGZpbGVfZW1iZWRfaW5wdXQgYmVjYXVzZSBtb3JlIHJlc2lsaWVudCB0byBpbmNvbnNlcXVlbnRpYWwgY2hhbmdlcyAod2hpdGVzcGFjZSBiZXR3ZWVuIGhlYWRpbmdzKVxuICAgIGNvbnN0IGZpbGVfaGFzaCA9IG1kNShmaWxlX2VtYmVkX2lucHV0LnRyaW0oKSk7XG4gICAgY29uc3QgZXhpc3RpbmdfaGFzaCA9IHRoaXMuc21hcnRfdmVjX2xpdGUuZ2V0X2hhc2goY3Vycl9maWxlX2tleSk7XG4gICAgaWYoZXhpc3RpbmdfaGFzaCAmJiAoZmlsZV9oYXNoID09PSBleGlzdGluZ19oYXNoKSkge1xuICAgICAgLy8gY29uc29sZS5sb2coXCJza2lwcGluZyBmaWxlIChoYXNoKTogXCIgKyBjdXJyX2ZpbGUucGF0aCk7XG4gICAgICB0aGlzLnVwZGF0ZV9yZW5kZXJfbG9nKGJsb2NrcywgZmlsZV9lbWJlZF9pbnB1dCk7XG4gICAgICByZXR1cm47XG4gICAgfTtcblxuICAgIC8vIGlmIG5vdCBhbHJlYWR5IHNraXBwaW5nIGFuZCBibG9ja3MgYXJlIHByZXNlbnRcbiAgICBjb25zdCBleGlzdGluZ19ibG9ja3MgPSB0aGlzLnNtYXJ0X3ZlY19saXRlLmdldF9jaGlsZHJlbihjdXJyX2ZpbGVfa2V5KTtcbiAgICBsZXQgZXhpc3RpbmdfaGFzX2FsbF9ibG9ja3MgPSB0cnVlO1xuICAgIGlmKGV4aXN0aW5nX2Jsb2NrcyAmJiBBcnJheS5pc0FycmF5KGV4aXN0aW5nX2Jsb2NrcykgJiYgKGJsb2Nrcy5sZW5ndGggPiAwKSkge1xuICAgICAgLy8gaWYgYWxsIGJsb2NrcyBhcmUgaW4gZXhpc3RpbmdfYmxvY2tzIHRoZW4gc2tpcCAoYWxsb3dzIGRlbGV0aW9uIG9mIHNtYWxsIGJsb2NrcyB3aXRob3V0IHRyaWdnZXJpbmcgZnVsbCBmaWxlIGVtYmVkZGluZylcbiAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgYmxvY2tzLmxlbmd0aDsgaisrKSB7XG4gICAgICAgIGlmKGV4aXN0aW5nX2Jsb2Nrcy5pbmRleE9mKGJsb2Nrc1tqXSkgPT09IC0xKSB7XG4gICAgICAgICAgZXhpc3RpbmdfaGFzX2FsbF9ibG9ja3MgPSBmYWxzZTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICAvLyBpZiBleGlzdGluZyBoYXMgYWxsIGJsb2NrcyB0aGVuIGNoZWNrIGZpbGUgc2l6ZSBmb3IgZGVsdGFcbiAgICBpZihleGlzdGluZ19oYXNfYWxsX2Jsb2Nrcyl7XG4gICAgICAvLyBnZXQgY3VycmVudCBub3RlIGZpbGUgc2l6ZVxuICAgICAgY29uc3QgY3Vycl9maWxlX3NpemUgPSBjdXJyX2ZpbGUuc3RhdC5zaXplO1xuICAgICAgLy8gZ2V0IGZpbGUgc2l6ZSBmcm9tIGVtYmVkZGluZ3NcbiAgICAgIGNvbnN0IHByZXZfZmlsZV9zaXplID0gdGhpcy5zbWFydF92ZWNfbGl0ZS5nZXRfc2l6ZShjdXJyX2ZpbGVfa2V5KTtcbiAgICAgIGlmIChwcmV2X2ZpbGVfc2l6ZSkge1xuICAgICAgICAvLyBpZiBjdXJyIGZpbGUgc2l6ZSBpcyBsZXNzIHRoYW4gMTAlIGRpZmZlcmVudCBmcm9tIHByZXYgZmlsZSBzaXplXG4gICAgICAgIGNvbnN0IGZpbGVfZGVsdGFfcGN0ID0gTWF0aC5yb3VuZCgoTWF0aC5hYnMoY3Vycl9maWxlX3NpemUgLSBwcmV2X2ZpbGVfc2l6ZSkgLyBjdXJyX2ZpbGVfc2l6ZSkgKiAxMDApO1xuICAgICAgICBpZihmaWxlX2RlbHRhX3BjdCA8IDEwKSB7XG4gICAgICAgICAgLy8gc2tpcCBlbWJlZGRpbmdcbiAgICAgICAgICAvLyBjb25zb2xlLmxvZyhcInNraXBwaW5nIGZpbGUgKHNpemUpIFwiICsgY3Vycl9maWxlLnBhdGgpO1xuICAgICAgICAgIHRoaXMucmVuZGVyX2xvZy5za2lwcGVkX2xvd19kZWx0YVtjdXJyX2ZpbGUubmFtZV0gPSBmaWxlX2RlbHRhX3BjdCArIFwiJVwiO1xuICAgICAgICAgIHRoaXMudXBkYXRlX3JlbmRlcl9sb2coYmxvY2tzLCBmaWxlX2VtYmVkX2lucHV0KTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgbGV0IG1ldGEgPSB7XG4gICAgICBtdGltZTogY3Vycl9maWxlLnN0YXQubXRpbWUsXG4gICAgICBoYXNoOiBmaWxlX2hhc2gsXG4gICAgICBwYXRoOiBjdXJyX2ZpbGUucGF0aCxcbiAgICAgIHNpemU6IGN1cnJfZmlsZS5zdGF0LnNpemUsXG4gICAgICBjaGlsZHJlbjogYmxvY2tzLFxuICAgIH07XG4gICAgLy8gYmF0Y2hfcHJvbWlzZXMucHVzaCh0aGlzLmdldF9lbWJlZGRpbmdzKGN1cnJfZmlsZV9rZXksIGZpbGVfZW1iZWRfaW5wdXQsIG1ldGEpKTtcbiAgICByZXFfYmF0Y2gucHVzaChbY3Vycl9maWxlX2tleSwgZmlsZV9lbWJlZF9pbnB1dCwgbWV0YV0pO1xuICAgIC8vIHNlbmQgYmF0Y2ggcmVxdWVzdFxuICAgIGF3YWl0IHRoaXMuZ2V0X2VtYmVkZGluZ3NfYmF0Y2gocmVxX2JhdGNoKTtcblxuICAgIC8vIGxvZyBlbWJlZGRpbmdcbiAgICAvLyBjb25zb2xlLmxvZyhcImVtYmVkZGluZzogXCIgKyBjdXJyX2ZpbGUucGF0aCk7XG4gICAgaWYgKHNhdmUpIHtcbiAgICAgIC8vIHdyaXRlIGVtYmVkZGluZ3MgSlNPTiB0byBmaWxlXG4gICAgICBhd2FpdCB0aGlzLnNhdmVfZW1iZWRkaW5nc190b19maWxlKCk7XG4gICAgfVxuXG4gIH1cblxuICB1cGRhdGVfcmVuZGVyX2xvZyhibG9ja3MsIGZpbGVfZW1iZWRfaW5wdXQpIHtcbiAgICBpZiAoYmxvY2tzLmxlbmd0aCA+IDApIHtcbiAgICAgIC8vIG11bHRpcGx5IGJ5IDIgYmVjYXVzZSBpbXBsaWVzIHdlIHNhdmVkIHRva2VuIHNwZW5kaW5nIG9uIGJsb2NrcyhzZWN0aW9ucyksIHRvb1xuICAgICAgdGhpcy5yZW5kZXJfbG9nLnRva2Vuc19zYXZlZF9ieV9jYWNoZSArPSBmaWxlX2VtYmVkX2lucHV0Lmxlbmd0aCAvIDI7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIGNhbGMgdG9rZW5zIHNhdmVkIGJ5IGNhY2hlOiBkaXZpZGUgYnkgNCBmb3IgdG9rZW4gZXN0aW1hdGVcbiAgICAgIHRoaXMucmVuZGVyX2xvZy50b2tlbnNfc2F2ZWRfYnlfY2FjaGUgKz0gZmlsZV9lbWJlZF9pbnB1dC5sZW5ndGggLyA0O1xuICAgIH1cbiAgfVxuXG4gIGFzeW5jIGdldF9lbWJlZGRpbmdzX2JhdGNoKHJlcV9iYXRjaCkge1xuICAgIGNvbnNvbGUubG9nKFwiZ2V0X2VtYmVkZGluZ3NfYmF0Y2hcIik7XG4gICAgLy8gaWYgcmVxX2JhdGNoIGlzIGVtcHR5IHRoZW4gcmV0dXJuXG4gICAgaWYocmVxX2JhdGNoLmxlbmd0aCA9PT0gMCkgcmV0dXJuO1xuICAgIC8vIGNyZWF0ZSBhcnJhcnkgb2YgZW1iZWRfaW5wdXRzIGZyb20gcmVxX2JhdGNoW2ldWzFdXG4gICAgY29uc3QgZW1iZWRfaW5wdXRzID0gcmVxX2JhdGNoLm1hcCgocmVxKSA9PiByZXFbMV0pO1xuICAgIC8vIHJlcXVlc3QgZW1iZWRkaW5ncyBmcm9tIGVtYmVkX2lucHV0c1xuICAgIGNvbnN0IHJlcXVlc3RSZXN1bHRzID0gYXdhaXQgdGhpcy5yZXF1ZXN0X2VtYmVkZGluZ19mcm9tX2lucHV0KGVtYmVkX2lucHV0cyk7XG4gICAgLy8gaWYgcmVxdWVzdFJlc3VsdHMgaXMgbnVsbCB0aGVuIHJldHVyblxuICAgIGlmKCFyZXF1ZXN0UmVzdWx0cykge1xuICAgICAgY29uc29sZS5sb2coXCJmYWlsZWQgZW1iZWRkaW5nIGJhdGNoXCIpO1xuICAgICAgLy8gbG9nIGZhaWxlZCBmaWxlIG5hbWVzIHRvIHJlbmRlcl9sb2dcbiAgICAgIHRoaXMucmVuZGVyX2xvZy5mYWlsZWRfZW1iZWRkaW5ncyA9IFsuLi50aGlzLnJlbmRlcl9sb2cuZmFpbGVkX2VtYmVkZGluZ3MsIC4uLnJlcV9iYXRjaC5tYXAoKHJlcSkgPT4gcmVxWzJdLnBhdGgpXTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgLy8gaWYgcmVxdWVzdFJlc3VsdHMgaXMgbm90IG51bGxcbiAgICBpZihyZXF1ZXN0UmVzdWx0cyl7XG4gICAgICB0aGlzLmhhc19uZXdfZW1iZWRkaW5ncyA9IHRydWU7XG4gICAgICAvLyBhZGQgZW1iZWRkaW5nIGtleSB0byByZW5kZXJfbG9nXG4gICAgICBpZih0aGlzLnNldHRpbmdzLmxvZ19yZW5kZXIpe1xuICAgICAgICBpZih0aGlzLnNldHRpbmdzLmxvZ19yZW5kZXJfZmlsZXMpe1xuICAgICAgICAgIHRoaXMucmVuZGVyX2xvZy5maWxlcyA9IFsuLi50aGlzLnJlbmRlcl9sb2cuZmlsZXMsIC4uLnJlcV9iYXRjaC5tYXAoKHJlcSkgPT4gcmVxWzJdLnBhdGgpXTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLnJlbmRlcl9sb2cubmV3X2VtYmVkZGluZ3MgKz0gcmVxX2JhdGNoLmxlbmd0aDtcbiAgICAgICAgLy8gYWRkIHRva2VuIHVzYWdlIHRvIHJlbmRlcl9sb2dcbiAgICAgICAgdGhpcy5yZW5kZXJfbG9nLnRva2VuX3VzYWdlICs9IHJlcXVlc3RSZXN1bHRzLnVzYWdlLnRvdGFsX3Rva2VucztcbiAgICAgIH1cbiAgICAgIC8vIGNvbnNvbGUubG9nKHJlcXVlc3RSZXN1bHRzLmRhdGEubGVuZ3RoKTtcbiAgICAgIC8vIGxvb3AgdGhyb3VnaCByZXF1ZXN0UmVzdWx0cy5kYXRhXG4gICAgICBmb3IobGV0IGkgPSAwOyBpIDwgcmVxdWVzdFJlc3VsdHMuZGF0YS5sZW5ndGg7IGkrKykge1xuICAgICAgICBjb25zdCB2ZWMgPSByZXF1ZXN0UmVzdWx0cy5kYXRhW2ldLmVtYmVkZGluZztcbiAgICAgICAgY29uc3QgaW5kZXggPSByZXF1ZXN0UmVzdWx0cy5kYXRhW2ldLmluZGV4O1xuICAgICAgICBpZih2ZWMpIHtcbiAgICAgICAgICBjb25zdCBrZXkgPSByZXFfYmF0Y2hbaW5kZXhdWzBdO1xuICAgICAgICAgIGNvbnN0IG1ldGEgPSByZXFfYmF0Y2hbaW5kZXhdWzJdO1xuICAgICAgICAgIHRoaXMuc21hcnRfdmVjX2xpdGUuc2F2ZV9lbWJlZGRpbmcoa2V5LCB2ZWMsIG1ldGEpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgYXN5bmMgcmVxdWVzdF9lbWJlZGRpbmdfZnJvbV9pbnB1dChlbWJlZF9pbnB1dCwgcmV0cmllcyA9IDApIHtcbiAgICAvLyAoRk9SIFRFU1RJTkcpIHRlc3QgZmFpbCBwcm9jZXNzIGJ5IGZvcmNpbmcgZmFpbFxuICAgIC8vIHJldHVybiBudWxsO1xuICAgIC8vIGNoZWNrIGlmIGVtYmVkX2lucHV0IGlzIGEgc3RyaW5nXG4gICAgLy8gaWYodHlwZW9mIGVtYmVkX2lucHV0ICE9PSBcInN0cmluZ1wiKSB7XG4gICAgLy8gICBjb25zb2xlLmxvZyhcImVtYmVkX2lucHV0IGlzIG5vdCBhIHN0cmluZ1wiKTtcbiAgICAvLyAgIHJldHVybiBudWxsO1xuICAgIC8vIH1cbiAgICAvLyBjaGVjayBpZiBlbWJlZF9pbnB1dCBpcyBlbXB0eVxuICAgIGlmKGVtYmVkX2lucHV0Lmxlbmd0aCA9PT0gMCkge1xuICAgICAgY29uc29sZS5sb2coXCJlbWJlZF9pbnB1dCBpcyBlbXB0eVwiKTtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICBjb25zdCB1c2VkUGFyYW1zID0ge1xuICAgICAgbW9kZWw6IFwidGV4dC1lbWJlZGRpbmctYWRhLTAwMlwiLFxuICAgICAgaW5wdXQ6IGVtYmVkX2lucHV0LFxuICAgIH07XG4gICAgLy8gY29uc29sZS5sb2codGhpcy5zZXR0aW5ncy5hcGlfa2V5KTtcbiAgICBjb25zdCByZXFQYXJhbXMgPSB7XG4gICAgICB1cmw6IGBodHRwczovL2FwaS5vcGVuYWkuY29tL3YxL2VtYmVkZGluZ3NgLFxuICAgICAgbWV0aG9kOiBcIlBPU1RcIixcbiAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHVzZWRQYXJhbXMpLFxuICAgICAgaGVhZGVyczoge1xuICAgICAgICBcIkNvbnRlbnQtVHlwZVwiOiBcImFwcGxpY2F0aW9uL2pzb25cIixcbiAgICAgICAgXCJBdXRob3JpemF0aW9uXCI6IGBCZWFyZXIgJHt0aGlzLnNldHRpbmdzLmFwaV9rZXl9YFxuICAgICAgfVxuICAgIH07XG4gICAgbGV0IHJlc3A7XG4gICAgdHJ5IHtcbiAgICAgIHJlc3AgPSBhd2FpdCAoMCwgT2JzaWRpYW4ucmVxdWVzdCkocmVxUGFyYW1zKVxuICAgICAgcmV0dXJuIEpTT04ucGFyc2UocmVzcCk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIC8vIHJldHJ5IHJlcXVlc3QgaWYgZXJyb3IgaXMgNDI5XG4gICAgICBpZigoZXJyb3Iuc3RhdHVzID09PSA0MjkpICYmIChyZXRyaWVzIDwgMykpIHtcbiAgICAgICAgcmV0cmllcysrO1xuICAgICAgICAvLyBleHBvbmVudGlhbCBiYWNrb2ZmXG4gICAgICAgIGNvbnN0IGJhY2tvZmYgPSBNYXRoLnBvdyhyZXRyaWVzLCAyKTtcbiAgICAgICAgY29uc29sZS5sb2coYHJldHJ5aW5nIHJlcXVlc3QgKDQyOSkgaW4gJHtiYWNrb2ZmfSBzZWNvbmRzLi4uYCk7XG4gICAgICAgIGF3YWl0IG5ldyBQcm9taXNlKHIgPT4gc2V0VGltZW91dChyLCAxMDAwICogYmFja29mZikpO1xuICAgICAgICByZXR1cm4gYXdhaXQgdGhpcy5yZXF1ZXN0X2VtYmVkZGluZ19mcm9tX2lucHV0KGVtYmVkX2lucHV0LCByZXRyaWVzKTtcbiAgICAgIH1cbiAgICAgIC8vIGxvZyBmdWxsIGVycm9yIHRvIGNvbnNvbGVcbiAgICAgIGNvbnNvbGUubG9nKHJlc3ApO1xuICAgICAgLy8gY29uc29sZS5sb2coXCJmaXJzdCBsaW5lIG9mIGVtYmVkOiBcIiArIGVtYmVkX2lucHV0LnN1YnN0cmluZygwLCBlbWJlZF9pbnB1dC5pbmRleE9mKFwiXFxuXCIpKSk7XG4gICAgICAvLyBjb25zb2xlLmxvZyhcImVtYmVkIGlucHV0IGxlbmd0aDogXCIrIGVtYmVkX2lucHV0Lmxlbmd0aCk7XG4gICAgICAvLyBpZihBcnJheS5pc0FycmF5KGVtYmVkX2lucHV0KSkge1xuICAgICAgLy8gICBjb25zb2xlLmxvZyhlbWJlZF9pbnB1dC5tYXAoKGlucHV0KSA9PiBpbnB1dC5sZW5ndGgpKTtcbiAgICAgIC8vIH1cbiAgICAgIC8vIGNvbnNvbGUubG9nKFwiZXJyb25lb3VzIGVtYmVkIGlucHV0OiBcIiArIGVtYmVkX2lucHV0KTtcbiAgICAgIGNvbnNvbGUubG9nKGVycm9yKTtcbiAgICAgIC8vIGNvbnNvbGUubG9nKHVzZWRQYXJhbXMpO1xuICAgICAgLy8gY29uc29sZS5sb2codXNlZFBhcmFtcy5pbnB1dC5sZW5ndGgpO1xuICAgICAgcmV0dXJuIG51bGw7IFxuICAgIH1cbiAgfVxuICBhc3luYyB0ZXN0X2FwaV9rZXkoKSB7XG4gICAgY29uc3QgZW1iZWRfaW5wdXQgPSBcIlRoaXMgaXMgYSB0ZXN0IG9mIHRoZSBPcGVuQUkgQVBJLlwiO1xuICAgIGNvbnN0IHJlc3AgPSBhd2FpdCB0aGlzLnJlcXVlc3RfZW1iZWRkaW5nX2Zyb21faW5wdXQoZW1iZWRfaW5wdXQpO1xuICAgIGlmKHJlc3AgJiYgcmVzcC51c2FnZSkge1xuICAgICAgY29uc29sZS5sb2coXCJBUEkga2V5IGlzIHZhbGlkXCIpO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfWVsc2V7XG4gICAgICBjb25zb2xlLmxvZyhcIkFQSSBrZXkgaXMgaW52YWxpZFwiKTtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH1cblxuXG4gIG91dHB1dF9yZW5kZXJfbG9nKCkge1xuICAgIC8vIGlmIHNldHRpbmdzLmxvZ19yZW5kZXIgaXMgdHJ1ZVxuICAgIGlmKHRoaXMuc2V0dGluZ3MubG9nX3JlbmRlcikge1xuICAgICAgaWYgKHRoaXMucmVuZGVyX2xvZy5uZXdfZW1iZWRkaW5ncyA9PT0gMCkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9ZWxzZXtcbiAgICAgICAgLy8gcHJldHR5IHByaW50IHRoaXMucmVuZGVyX2xvZyB0byBjb25zb2xlXG4gICAgICAgIGNvbnNvbGUubG9nKEpTT04uc3RyaW5naWZ5KHRoaXMucmVuZGVyX2xvZywgbnVsbCwgMikpO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIGNsZWFyIHJlbmRlcl9sb2dcbiAgICB0aGlzLnJlbmRlcl9sb2cgPSB7fTtcbiAgICB0aGlzLnJlbmRlcl9sb2cuZGVsZXRlZF9lbWJlZGRpbmdzID0gMDtcbiAgICB0aGlzLnJlbmRlcl9sb2cuZXhjbHVzaW9uc19sb2dzID0ge307XG4gICAgdGhpcy5yZW5kZXJfbG9nLmZhaWxlZF9lbWJlZGRpbmdzID0gW107XG4gICAgdGhpcy5yZW5kZXJfbG9nLmZpbGVzID0gW107XG4gICAgdGhpcy5yZW5kZXJfbG9nLm5ld19lbWJlZGRpbmdzID0gMDtcbiAgICB0aGlzLnJlbmRlcl9sb2cuc2tpcHBlZF9sb3dfZGVsdGEgPSB7fTtcbiAgICB0aGlzLnJlbmRlcl9sb2cudG9rZW5fdXNhZ2UgPSAwO1xuICAgIHRoaXMucmVuZGVyX2xvZy50b2tlbnNfc2F2ZWRfYnlfY2FjaGUgPSAwO1xuICB9XG5cbiAgLy8gZmluZCBjb25uZWN0aW9ucyBieSBtb3N0IHNpbWlsYXIgdG8gY3VycmVudCBub3RlIGJ5IGNvc2luZSBzaW1pbGFyaXR5XG4gIGFzeW5jIGZpbmRfbm90ZV9jb25uZWN0aW9ucyhjdXJyZW50X25vdGU9bnVsbCkge1xuICAgIC8vIG1kNSBvZiBjdXJyZW50IG5vdGUgcGF0aFxuICAgIGNvbnN0IGN1cnJfa2V5ID0gbWQ1KGN1cnJlbnRfbm90ZS5wYXRoKTtcbiAgICAvLyBpZiBpbiB0aGlzLm5lYXJlc3RfY2FjaGUgdGhlbiBzZXQgdG8gbmVhcmVzdFxuICAgIC8vIGVsc2UgZ2V0IG5lYXJlc3RcbiAgICBsZXQgbmVhcmVzdCA9IFtdO1xuICAgIGlmKHRoaXMubmVhcmVzdF9jYWNoZVtjdXJyX2tleV0pIHtcbiAgICAgIG5lYXJlc3QgPSB0aGlzLm5lYXJlc3RfY2FjaGVbY3Vycl9rZXldO1xuICAgICAgLy8gY29uc29sZS5sb2coXCJuZWFyZXN0IGZyb20gY2FjaGVcIik7XG4gICAgfWVsc2V7XG4gICAgICAvLyBza2lwIGZpbGVzIHdoZXJlIHBhdGggY29udGFpbnMgYW55IGV4Y2x1c2lvbnNcbiAgICAgIGZvcihsZXQgaiA9IDA7IGogPCB0aGlzLmZpbGVfZXhjbHVzaW9ucy5sZW5ndGg7IGorKykge1xuICAgICAgICBpZihjdXJyZW50X25vdGUucGF0aC5pbmRleE9mKHRoaXMuZmlsZV9leGNsdXNpb25zW2pdKSA+IC0xKSB7XG4gICAgICAgICAgdGhpcy5sb2dfZXhjbHVzaW9uKHRoaXMuZmlsZV9leGNsdXNpb25zW2pdKTtcbiAgICAgICAgICAvLyBicmVhayBvdXQgb2YgbG9vcCBhbmQgZmluaXNoIGhlcmVcbiAgICAgICAgICByZXR1cm4gXCJleGNsdWRlZFwiO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICAvLyBnZXQgYWxsIGVtYmVkZGluZ3NcbiAgICAgIC8vIGF3YWl0IHRoaXMuZ2V0X2FsbF9lbWJlZGRpbmdzKCk7XG4gICAgICAvLyB3cmFwIGdldCBhbGwgaW4gc2V0VGltZW91dCB0byBhbGxvdyBmb3IgVUkgdG8gdXBkYXRlXG4gICAgICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgdGhpcy5nZXRfYWxsX2VtYmVkZGluZ3MoKVxuICAgICAgfSwgMzAwMCk7XG4gICAgICAvLyBnZXQgZnJvbSBjYWNoZSBpZiBtdGltZSBpcyBzYW1lIGFuZCB2YWx1ZXMgYXJlIG5vdCBlbXB0eVxuICAgICAgaWYodGhpcy5zbWFydF92ZWNfbGl0ZS5tdGltZV9pc19jdXJyZW50KGN1cnJfa2V5LCBjdXJyZW50X25vdGUuc3RhdC5tdGltZSkpIHtcbiAgICAgICAgLy8gc2tpcHBpbmcgZ2V0IGZpbGUgZW1iZWRkaW5ncyBiZWNhdXNlIG5vdGhpbmcgaGFzIGNoYW5nZWRcbiAgICAgICAgLy8gY29uc29sZS5sb2coXCJmaW5kX25vdGVfY29ubmVjdGlvbnMgLSBza2lwcGluZyBmaWxlIChtdGltZSlcIik7XG4gICAgICB9ZWxzZXtcbiAgICAgICAgLy8gZ2V0IGZpbGUgZW1iZWRkaW5nc1xuICAgICAgICBhd2FpdCB0aGlzLmdldF9maWxlX2VtYmVkZGluZ3MoY3VycmVudF9ub3RlKTtcbiAgICAgIH1cbiAgICAgIC8vIGdldCBjdXJyZW50IG5vdGUgZW1iZWRkaW5nIHZlY3RvclxuICAgICAgY29uc3QgdmVjID0gdGhpcy5zbWFydF92ZWNfbGl0ZS5nZXRfdmVjKGN1cnJfa2V5KTtcbiAgICAgIGlmKCF2ZWMpIHtcbiAgICAgICAgcmV0dXJuIFwiRXJyb3IgZ2V0dGluZyBlbWJlZGRpbmdzIGZvcjogXCIrY3VycmVudF9ub3RlLnBhdGg7XG4gICAgICB9XG4gICAgICBcbiAgICAgIC8vIGNvbXB1dGUgY29zaW5lIHNpbWlsYXJpdHkgYmV0d2VlbiBjdXJyZW50IG5vdGUgYW5kIGFsbCBvdGhlciBub3RlcyB2aWEgZW1iZWRkaW5nc1xuICAgICAgbmVhcmVzdCA9IHRoaXMuc21hcnRfdmVjX2xpdGUubmVhcmVzdCh2ZWMsIHtcbiAgICAgICAgc2tpcF9rZXk6IGN1cnJfa2V5LFxuICAgICAgICBza2lwX3NlY3Rpb25zOiB0aGlzLnNldHRpbmdzLnNraXBfc2VjdGlvbnMsXG4gICAgICB9KTtcbiAgXG4gICAgICAvLyBzYXZlIHRvIHRoaXMubmVhcmVzdF9jYWNoZVxuICAgICAgdGhpcy5uZWFyZXN0X2NhY2hlW2N1cnJfa2V5XSA9IG5lYXJlc3Q7XG4gICAgfVxuXG4gICAgLy8gcmV0dXJuIGFycmF5IHNvcnRlZCBieSBjb3NpbmUgc2ltaWxhcml0eVxuICAgIHJldHVybiBuZWFyZXN0O1xuICB9XG4gIFxuICAvLyBjcmVhdGUgcmVuZGVyX2xvZyBvYmplY3Qgb2YgZXhsdXNpb25zIHdpdGggbnVtYmVyIG9mIHRpbWVzIHNraXBwZWQgYXMgdmFsdWVcbiAgbG9nX2V4Y2x1c2lvbihleGNsdXNpb24pIHtcbiAgICAvLyBpbmNyZW1lbnQgcmVuZGVyX2xvZyBmb3Igc2tpcHBlZCBmaWxlXG4gICAgdGhpcy5yZW5kZXJfbG9nLmV4Y2x1c2lvbnNfbG9nc1tleGNsdXNpb25dID0gKHRoaXMucmVuZGVyX2xvZy5leGNsdXNpb25zX2xvZ3NbZXhjbHVzaW9uXSB8fCAwKSArIDE7XG4gIH1cbiAgXG5cbiAgYmxvY2tfcGFyc2VyKG1hcmtkb3duLCBmaWxlX3BhdGgpe1xuICAgIC8vIGlmIHRoaXMuc2V0dGluZ3Muc2tpcF9zZWN0aW9ucyBpcyB0cnVlIHRoZW4gcmV0dXJuIGVtcHR5IGFycmF5XG4gICAgaWYodGhpcy5zZXR0aW5ncy5za2lwX3NlY3Rpb25zKSB7XG4gICAgICByZXR1cm4gW107XG4gICAgfVxuICAgIC8vIHNwbGl0IHRoZSBtYXJrZG93biBpbnRvIGxpbmVzXG4gICAgY29uc3QgbGluZXMgPSBtYXJrZG93bi5zcGxpdCgnXFxuJyk7XG4gICAgLy8gaW5pdGlhbGl6ZSB0aGUgYmxvY2tzIGFycmF5XG4gICAgbGV0IGJsb2NrcyA9IFtdO1xuICAgIC8vIGN1cnJlbnQgaGVhZGVycyBhcnJheVxuICAgIGxldCBjdXJyZW50SGVhZGVycyA9IFtdO1xuICAgIC8vIHJlbW92ZSAubWQgZmlsZSBleHRlbnNpb24gYW5kIGNvbnZlcnQgZmlsZV9wYXRoIHRvIGJyZWFkY3J1bWIgZm9ybWF0dGluZ1xuICAgIGNvbnN0IGZpbGVfYnJlYWRjcnVtYnMgPSBmaWxlX3BhdGgucmVwbGFjZSgnLm1kJywgJycpLnJlcGxhY2UoL1xcLy9nLCAnID4gJyk7XG4gICAgLy8gaW5pdGlhbGl6ZSB0aGUgYmxvY2sgc3RyaW5nXG4gICAgbGV0IGJsb2NrID0gJyc7XG4gICAgbGV0IGJsb2NrX2hlYWRpbmdzID0gJyc7XG4gICAgbGV0IGJsb2NrX3BhdGggPSBmaWxlX3BhdGg7XG5cbiAgICBsZXQgbGFzdF9oZWFkaW5nX2xpbmUgPSAwO1xuICAgIGxldCBpID0gMDtcbiAgICBsZXQgYmxvY2tfaGVhZGluZ3NfbGlzdCA9IFtdO1xuICAgIC8vIGxvb3AgdGhyb3VnaCB0aGUgbGluZXNcbiAgICBmb3IgKGkgPSAwOyBpIDwgbGluZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgIC8vIGdldCB0aGUgbGluZVxuICAgICAgY29uc3QgbGluZSA9IGxpbmVzW2ldO1xuICAgICAgLy8gaWYgbGluZSBkb2VzIG5vdCBzdGFydCB3aXRoICNcbiAgICAgIC8vIG9yIGlmIGxpbmUgc3RhcnRzIHdpdGggIyBhbmQgc2Vjb25kIGNoYXJhY3RlciBpcyBhIHdvcmQgb3IgbnVtYmVyIGluZGljYXRpbmcgYSBcInRhZ1wiXG4gICAgICAvLyB0aGVuIGFkZCB0byBibG9ja1xuICAgICAgaWYgKCFsaW5lLnN0YXJ0c1dpdGgoJyMnKSB8fCAoWycjJywnICddLmluZGV4T2YobGluZVsxXSkgPCAwKSl7XG4gICAgICAgIC8vIHNraXAgaWYgbGluZSBpcyBlbXB0eVxuICAgICAgICBpZihsaW5lID09PSAnJykgY29udGludWU7XG4gICAgICAgIC8vIHNraXAgaWYgbGluZSBpcyBlbXB0eSBidWxsZXQgb3IgY2hlY2tib3hcbiAgICAgICAgaWYoWyctICcsICctIFsgXSAnXS5pbmRleE9mKGxpbmUpID4gLTEpIGNvbnRpbnVlO1xuICAgICAgICAvLyBpZiBjdXJyZW50SGVhZGVycyBpcyBlbXB0eSBza2lwIChvbmx5IGJsb2NrcyB3aXRoIGhlYWRlcnMsIG90aGVyd2lzZSBibG9jay5wYXRoIGNvbmZsaWN0cyB3aXRoIGZpbGUucGF0aClcbiAgICAgICAgaWYoY3VycmVudEhlYWRlcnMubGVuZ3RoID09PSAwKSBjb250aW51ZTtcbiAgICAgICAgLy8gYWRkIGxpbmUgdG8gYmxvY2tcbiAgICAgICAgYmxvY2sgKz0gXCJcXG5cIiArIGxpbmU7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgICAgLyoqXG4gICAgICAgKiBCRUdJTiBIZWFkaW5nIHBhcnNpbmdcbiAgICAgICAqIC0gbGlrZWx5IGEgaGVhZGluZyBpZiBtYWRlIGl0IHRoaXMgZmFyXG4gICAgICAgKi9cbiAgICAgIGxhc3RfaGVhZGluZ19saW5lID0gaTtcbiAgICAgIC8vIHB1c2ggdGhlIGN1cnJlbnQgYmxvY2sgdG8gdGhlIGJsb2NrcyBhcnJheSB1bmxlc3MgbGFzdCBsaW5lIHdhcyBhIGFsc28gYSBoZWFkZXJcbiAgICAgIGlmKGkgPiAwICYmIChsYXN0X2hlYWRpbmdfbGluZSAhPT0gKGktMSkpICYmIChibG9jay5pbmRleE9mKFwiXFxuXCIpID4gLTEpICYmIHRoaXMudmFsaWRhdGVfaGVhZGluZ3MoYmxvY2tfaGVhZGluZ3MpKSB7XG4gICAgICAgIG91dHB1dF9ibG9jaygpO1xuICAgICAgfVxuICAgICAgLy8gZ2V0IHRoZSBoZWFkZXIgbGV2ZWxcbiAgICAgIGNvbnN0IGxldmVsID0gbGluZS5zcGxpdCgnIycpLmxlbmd0aCAtIDE7XG4gICAgICAvLyByZW1vdmUgYW55IGhlYWRlcnMgZnJvbSB0aGUgY3VycmVudCBoZWFkZXJzIGFycmF5IHRoYXQgYXJlIGhpZ2hlciB0aGFuIHRoZSBjdXJyZW50IGhlYWRlciBsZXZlbFxuICAgICAgY3VycmVudEhlYWRlcnMgPSBjdXJyZW50SGVhZGVycy5maWx0ZXIoaGVhZGVyID0+IGhlYWRlci5sZXZlbCA8IGxldmVsKTtcbiAgICAgIC8vIGFkZCBoZWFkZXIgYW5kIGxldmVsIHRvIGN1cnJlbnQgaGVhZGVycyBhcnJheVxuICAgICAgLy8gdHJpbSB0aGUgaGVhZGVyIHRvIHJlbW92ZSBcIiNcIiBhbmQgYW55IHRyYWlsaW5nIHNwYWNlc1xuICAgICAgY3VycmVudEhlYWRlcnMucHVzaCh7aGVhZGVyOiBsaW5lLnJlcGxhY2UoLyMvZywgJycpLnRyaW0oKSwgbGV2ZWw6IGxldmVsfSk7XG4gICAgICAvLyBpbml0aWFsaXplIHRoZSBibG9jayBicmVhZGNydW1icyB3aXRoIGZpbGUucGF0aCB0aGUgY3VycmVudCBoZWFkZXJzXG4gICAgICBibG9jayA9IGZpbGVfYnJlYWRjcnVtYnM7XG4gICAgICBibG9jayArPSBcIjogXCIgKyBjdXJyZW50SGVhZGVycy5tYXAoaGVhZGVyID0+IGhlYWRlci5oZWFkZXIpLmpvaW4oJyA+ICcpO1xuICAgICAgYmxvY2tfaGVhZGluZ3MgPSBcIiNcIitjdXJyZW50SGVhZGVycy5tYXAoaGVhZGVyID0+IGhlYWRlci5oZWFkZXIpLmpvaW4oJyMnKTtcbiAgICAgIC8vIGlmIGJsb2NrX2hlYWRpbmdzIGlzIGFscmVhZHkgaW4gYmxvY2tfaGVhZGluZ3NfbGlzdCB0aGVuIGFkZCBhIG51bWJlciB0byB0aGUgZW5kXG4gICAgICBpZihibG9ja19oZWFkaW5nc19saXN0LmluZGV4T2YoYmxvY2tfaGVhZGluZ3MpID4gLTEpIHtcbiAgICAgICAgbGV0IGNvdW50ID0gMTtcbiAgICAgICAgd2hpbGUoYmxvY2tfaGVhZGluZ3NfbGlzdC5pbmRleE9mKGAke2Jsb2NrX2hlYWRpbmdzfXske2NvdW50fX1gKSA+IC0xKSB7XG4gICAgICAgICAgY291bnQrKztcbiAgICAgICAgfVxuICAgICAgICBibG9ja19oZWFkaW5ncyA9IGAke2Jsb2NrX2hlYWRpbmdzfXske2NvdW50fX1gO1xuICAgICAgfVxuICAgICAgYmxvY2tfaGVhZGluZ3NfbGlzdC5wdXNoKGJsb2NrX2hlYWRpbmdzKTtcbiAgICAgIGJsb2NrX3BhdGggPSBmaWxlX3BhdGggKyBibG9ja19oZWFkaW5ncztcbiAgICB9XG4gICAgLy8gaGFuZGxlIHJlbWFpbmluZyBhZnRlciBsb29wXG4gICAgaWYoKGxhc3RfaGVhZGluZ19saW5lICE9PSAoaS0xKSkgJiYgKGJsb2NrLmluZGV4T2YoXCJcXG5cIikgPiAtMSkgJiYgdGhpcy52YWxpZGF0ZV9oZWFkaW5ncyhibG9ja19oZWFkaW5ncykpIG91dHB1dF9ibG9jaygpO1xuICAgIC8vIHJlbW92ZSBhbnkgYmxvY2tzIHRoYXQgYXJlIHRvbyBzaG9ydCAobGVuZ3RoIDwgNTApXG4gICAgYmxvY2tzID0gYmxvY2tzLmZpbHRlcihiID0+IGIubGVuZ3RoID4gNTApO1xuICAgIC8vIGNvbnNvbGUubG9nKGJsb2Nrcyk7XG4gICAgLy8gcmV0dXJuIHRoZSBibG9ja3MgYXJyYXlcbiAgICByZXR1cm4gYmxvY2tzO1xuXG4gICAgZnVuY3Rpb24gb3V0cHV0X2Jsb2NrKCkge1xuICAgICAgLy8gYnJlYWRjcnVtYnMgbGVuZ3RoIChmaXJzdCBsaW5lIG9mIGJsb2NrKVxuICAgICAgY29uc3QgYnJlYWRjcnVtYnNfbGVuZ3RoID0gYmxvY2suaW5kZXhPZihcIlxcblwiKSArIDE7XG4gICAgICBjb25zdCBibG9ja19sZW5ndGggPSBibG9jay5sZW5ndGggLSBicmVhZGNydW1ic19sZW5ndGg7XG4gICAgICAvLyB0cmltIGJsb2NrIHRvIG1heCBsZW5ndGhcbiAgICAgIGlmIChibG9jay5sZW5ndGggPiBNQVhfRU1CRURfU1RSSU5HX0xFTkdUSCkge1xuICAgICAgICBibG9jayA9IGJsb2NrLnN1YnN0cmluZygwLCBNQVhfRU1CRURfU1RSSU5HX0xFTkdUSCk7XG4gICAgICB9XG4gICAgICBibG9ja3MucHVzaCh7IHRleHQ6IGJsb2NrLnRyaW0oKSwgcGF0aDogYmxvY2tfcGF0aCwgbGVuZ3RoOiBibG9ja19sZW5ndGggfSk7XG4gICAgfVxuICB9XG4gIC8vIHJldmVyc2UtcmV0cmlldmUgYmxvY2sgZ2l2ZW4gcGF0aFxuICBhc3luYyBibG9ja19yZXRyaWV2ZXIocGF0aCwgbGltaXRzPXt9KSB7XG4gICAgbGltaXRzID0ge1xuICAgICAgbGluZXM6IG51bGwsXG4gICAgICBjaGFyc19wZXJfbGluZTogbnVsbCxcbiAgICAgIG1heF9jaGFyczogbnVsbCxcbiAgICAgIC4uLmxpbWl0c1xuICAgIH1cbiAgICAvLyByZXR1cm4gaWYgbm8gIyBpbiBwYXRoXG4gICAgaWYgKHBhdGguaW5kZXhPZignIycpIDwgMCkge1xuICAgICAgY29uc29sZS5sb2coXCJub3QgYSBibG9jayBwYXRoOiBcIitwYXRoKTtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgbGV0IGJsb2NrID0gW107XG4gICAgbGV0IGJsb2NrX2hlYWRpbmdzID0gcGF0aC5zcGxpdCgnIycpLnNsaWNlKDEpO1xuICAgIC8vIGlmIHBhdGggZW5kcyB3aXRoIG51bWJlciBpbiBjdXJseSBicmFjZXNcbiAgICBsZXQgaGVhZGluZ19vY2N1cnJlbmNlID0gMDtcbiAgICBpZihibG9ja19oZWFkaW5nc1tibG9ja19oZWFkaW5ncy5sZW5ndGgtMV0uaW5kZXhPZigneycpID4gLTEpIHtcbiAgICAgIC8vIGdldCB0aGUgb2NjdXJyZW5jZSBudW1iZXJcbiAgICAgIGhlYWRpbmdfb2NjdXJyZW5jZSA9IHBhcnNlSW50KGJsb2NrX2hlYWRpbmdzW2Jsb2NrX2hlYWRpbmdzLmxlbmd0aC0xXS5zcGxpdCgneycpWzFdLnJlcGxhY2UoJ30nLCAnJykpO1xuICAgICAgLy8gcmVtb3ZlIHRoZSBvY2N1cnJlbmNlIGZyb20gdGhlIGxhc3QgaGVhZGluZ1xuICAgICAgYmxvY2tfaGVhZGluZ3NbYmxvY2tfaGVhZGluZ3MubGVuZ3RoLTFdID0gYmxvY2tfaGVhZGluZ3NbYmxvY2tfaGVhZGluZ3MubGVuZ3RoLTFdLnNwbGl0KCd7JylbMF07XG4gICAgfVxuICAgIGxldCBjdXJyZW50SGVhZGVycyA9IFtdO1xuICAgIGxldCBvY2N1cnJlbmNlX2NvdW50ID0gMDtcbiAgICBsZXQgYmVnaW5fbGluZSA9IDA7XG4gICAgbGV0IGkgPSAwO1xuICAgIC8vIGdldCBmaWxlIHBhdGggZnJvbSBwYXRoXG4gICAgY29uc3QgZmlsZV9wYXRoID0gcGF0aC5zcGxpdCgnIycpWzBdO1xuICAgIC8vIGdldCBmaWxlXG4gICAgY29uc3QgZmlsZSA9IHRoaXMuYXBwLnZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aChmaWxlX3BhdGgpO1xuICAgIGlmKCEoZmlsZSBpbnN0YW5jZW9mIE9ic2lkaWFuLlRGaWxlKSkge1xuICAgICAgY29uc29sZS5sb2coXCJub3QgYSBmaWxlOiBcIitmaWxlX3BhdGgpO1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICAvLyBnZXQgZmlsZSBjb250ZW50c1xuICAgIGNvbnN0IGZpbGVfY29udGVudHMgPSBhd2FpdCB0aGlzLmFwcC52YXVsdC5jYWNoZWRSZWFkKGZpbGUpO1xuICAgIC8vIHNwbGl0IHRoZSBmaWxlIGNvbnRlbnRzIGludG8gbGluZXNcbiAgICBjb25zdCBsaW5lcyA9IGZpbGVfY29udGVudHMuc3BsaXQoJ1xcbicpO1xuICAgIC8vIGxvb3AgdGhyb3VnaCB0aGUgbGluZXNcbiAgICBsZXQgaXNfY29kZSA9IGZhbHNlO1xuICAgIGZvciAoaSA9IDA7IGkgPCBsaW5lcy5sZW5ndGg7IGkrKykge1xuICAgICAgLy8gZ2V0IHRoZSBsaW5lXG4gICAgICBjb25zdCBsaW5lID0gbGluZXNbaV07XG4gICAgICAvLyBpZiBsaW5lIGJlZ2lucyB3aXRoIHRocmVlIGJhY2t0aWNrcyB0aGVuIHRvZ2dsZSBpc19jb2RlXG4gICAgICBpZihsaW5lLmluZGV4T2YoJ2BgYCcpID09PSAwKSB7XG4gICAgICAgIGlzX2NvZGUgPSAhaXNfY29kZTtcbiAgICAgIH1cbiAgICAgIC8vIGlmIGlzX2NvZGUgaXMgdHJ1ZSB0aGVuIGFkZCBsaW5lIHdpdGggcHJlY2VkaW5nIHRhYiBhbmQgY29udGludWVcbiAgICAgIGlmKGlzX2NvZGUpIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgICAvLyBza2lwIGlmIGxpbmUgaXMgZW1wdHkgYnVsbGV0IG9yIGNoZWNrYm94XG4gICAgICBpZihbJy0gJywgJy0gWyBdICddLmluZGV4T2YobGluZSkgPiAtMSkgY29udGludWU7XG4gICAgICAvLyBpZiBsaW5lIGRvZXMgbm90IHN0YXJ0IHdpdGggI1xuICAgICAgLy8gb3IgaWYgbGluZSBzdGFydHMgd2l0aCAjIGFuZCBzZWNvbmQgY2hhcmFjdGVyIGlzIGEgd29yZCBvciBudW1iZXIgaW5kaWNhdGluZyBhIFwidGFnXCJcbiAgICAgIC8vIHRoZW4gY29udGludWUgdG8gbmV4dCBsaW5lXG4gICAgICBpZiAoIWxpbmUuc3RhcnRzV2l0aCgnIycpIHx8IChbJyMnLCcgJ10uaW5kZXhPZihsaW5lWzFdKSA8IDApKXtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgICAvKipcbiAgICAgICAqIEJFR0lOIEhlYWRpbmcgcGFyc2luZ1xuICAgICAgICogLSBsaWtlbHkgYSBoZWFkaW5nIGlmIG1hZGUgaXQgdGhpcyBmYXJcbiAgICAgICAqL1xuICAgICAgLy8gZ2V0IHRoZSBoZWFkaW5nIHRleHRcbiAgICAgIGNvbnN0IGhlYWRpbmdfdGV4dCA9IGxpbmUucmVwbGFjZSgvIy9nLCAnJykudHJpbSgpO1xuICAgICAgLy8gY29udGludWUgaWYgaGVhZGluZyB0ZXh0IGlzIG5vdCBpbiBibG9ja19oZWFkaW5nc1xuICAgICAgY29uc3QgaGVhZGluZ19pbmRleCA9IGJsb2NrX2hlYWRpbmdzLmluZGV4T2YoaGVhZGluZ190ZXh0KTtcbiAgICAgIGlmIChoZWFkaW5nX2luZGV4IDwgMCkgY29udGludWU7XG4gICAgICAvLyBpZiBjdXJyZW50SGVhZGVycy5sZW5ndGggIT09IGhlYWRpbmdfaW5kZXggdGhlbiB3ZSBoYXZlIGEgbWlzbWF0Y2hcbiAgICAgIGlmIChjdXJyZW50SGVhZGVycy5sZW5ndGggIT09IGhlYWRpbmdfaW5kZXgpIGNvbnRpbnVlO1xuICAgICAgLy8gcHVzaCB0aGUgaGVhZGluZyB0ZXh0IHRvIHRoZSBjdXJyZW50SGVhZGVycyBhcnJheVxuICAgICAgY3VycmVudEhlYWRlcnMucHVzaChoZWFkaW5nX3RleHQpO1xuICAgICAgLy8gaWYgY3VycmVudEhlYWRlcnMubGVuZ3RoID09PSBibG9ja19oZWFkaW5ncy5sZW5ndGggdGhlbiB3ZSBoYXZlIGEgbWF0Y2hcbiAgICAgIGlmIChjdXJyZW50SGVhZGVycy5sZW5ndGggPT09IGJsb2NrX2hlYWRpbmdzLmxlbmd0aCkge1xuICAgICAgICAvLyBpZiBoZWFkaW5nX29jY3VycmVuY2UgaXMgZGVmaW5lZCB0aGVuIGluY3JlbWVudCBvY2N1cnJlbmNlX2NvdW50XG4gICAgICAgIGlmKGhlYWRpbmdfb2NjdXJyZW5jZSA9PT0gMCkge1xuICAgICAgICAgIC8vIHNldCBiZWdpbl9saW5lIHRvIGkgKyAxXG4gICAgICAgICAgYmVnaW5fbGluZSA9IGkgKyAxO1xuICAgICAgICAgIGJyZWFrOyAvLyBicmVhayBvdXQgb2YgbG9vcFxuICAgICAgICB9XG4gICAgICAgIC8vIGlmIG9jY3VycmVuY2VfY291bnQgIT09IGhlYWRpbmdfb2NjdXJyZW5jZSB0aGVuIGNvbnRpbnVlXG4gICAgICAgIGlmKG9jY3VycmVuY2VfY291bnQgPT09IGhlYWRpbmdfb2NjdXJyZW5jZSl7XG4gICAgICAgICAgYmVnaW5fbGluZSA9IGkgKyAxO1xuICAgICAgICAgIGJyZWFrOyAvLyBicmVhayBvdXQgb2YgbG9vcFxuICAgICAgICB9XG4gICAgICAgIG9jY3VycmVuY2VfY291bnQrKztcbiAgICAgICAgLy8gcmVzZXQgY3VycmVudEhlYWRlcnNcbiAgICAgICAgY3VycmVudEhlYWRlcnMucG9wKCk7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgIH1cbiAgICAvLyBpZiBubyBiZWdpbl9saW5lIHRoZW4gcmV0dXJuIGZhbHNlXG4gICAgaWYgKGJlZ2luX2xpbmUgPT09IDApIHJldHVybiBmYWxzZTtcbiAgICAvLyBpdGVyYXRlIHRocm91Z2ggbGluZXMgc3RhcnRpbmcgYXQgYmVnaW5fbGluZVxuICAgIGlzX2NvZGUgPSBmYWxzZTtcbiAgICAvLyBjaGFyYWN0ZXIgYWNjdW11bGF0b3JcbiAgICBsZXQgY2hhcl9jb3VudCA9IDA7XG4gICAgZm9yIChpID0gYmVnaW5fbGluZTsgaSA8IGxpbmVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBpZigodHlwZW9mIGxpbmVfbGltaXQgPT09IFwibnVtYmVyXCIpICYmIChibG9jay5sZW5ndGggPiBsaW5lX2xpbWl0KSl7XG4gICAgICAgIGJsb2NrLnB1c2goXCIuLi5cIik7XG4gICAgICAgIGJyZWFrOyAvLyBlbmRzIHdoZW4gbGluZV9saW1pdCBpcyByZWFjaGVkXG4gICAgICB9XG4gICAgICBsZXQgbGluZSA9IGxpbmVzW2ldO1xuICAgICAgaWYgKChsaW5lLmluZGV4T2YoJyMnKSA9PT0gMCkgJiYgKFsnIycsJyAnXS5pbmRleE9mKGxpbmVbMV0pICE9PSAtMSkpe1xuICAgICAgICBicmVhazsgLy8gZW5kcyB3aGVuIGVuY291bnRlcmluZyBuZXh0IGhlYWRlclxuICAgICAgfVxuICAgICAgLy8gREVQUkVDQVRFRDogc2hvdWxkIGJlIGhhbmRsZWQgYnkgbmV3X2xpbmUrY2hhcl9jb3VudCBjaGVjayAoaGFwcGVucyBpbiBwcmV2aW91cyBpdGVyYXRpb24pXG4gICAgICAvLyBpZiBjaGFyX2NvdW50IGlzIGdyZWF0ZXIgdGhhbiBsaW1pdC5tYXhfY2hhcnMsIHNraXBcbiAgICAgIGlmIChsaW1pdHMubWF4X2NoYXJzICYmIGNoYXJfY291bnQgPiBsaW1pdHMubWF4X2NoYXJzKSB7XG4gICAgICAgIGJsb2NrLnB1c2goXCIuLi5cIik7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgLy8gaWYgbmV3X2xpbmUgKyBjaGFyX2NvdW50IGlzIGdyZWF0ZXIgdGhhbiBsaW1pdC5tYXhfY2hhcnMsIHNraXBcbiAgICAgIGlmIChsaW1pdHMubWF4X2NoYXJzICYmICgobGluZS5sZW5ndGggKyBjaGFyX2NvdW50KSA+IGxpbWl0cy5tYXhfY2hhcnMpKSB7XG4gICAgICAgIGNvbnN0IG1heF9uZXdfY2hhcnMgPSBsaW1pdHMubWF4X2NoYXJzIC0gY2hhcl9jb3VudDtcbiAgICAgICAgbGluZSA9IGxpbmUuc2xpY2UoMCwgbWF4X25ld19jaGFycykgKyBcIi4uLlwiO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIC8vIHZhbGlkYXRlL2Zvcm1hdFxuICAgICAgLy8gaWYgbGluZSBpcyBlbXB0eSwgc2tpcFxuICAgICAgaWYgKGxpbmUubGVuZ3RoID09PSAwKSBjb250aW51ZTtcbiAgICAgIC8vIGxpbWl0IGxlbmd0aCBvZiBsaW5lIHRvIE4gY2hhcmFjdGVyc1xuICAgICAgaWYgKGxpbWl0cy5jaGFyc19wZXJfbGluZSAmJiBsaW5lLmxlbmd0aCA+IGxpbWl0cy5jaGFyc19wZXJfbGluZSkge1xuICAgICAgICBsaW5lID0gbGluZS5zbGljZSgwLCBsaW1pdHMuY2hhcnNfcGVyX2xpbmUpICsgXCIuLi5cIjtcbiAgICAgIH1cbiAgICAgIC8vIGlmIGxpbmUgaXMgYSBjb2RlIGJsb2NrLCBza2lwXG4gICAgICBpZiAobGluZS5zdGFydHNXaXRoKFwiYGBgXCIpKSB7XG4gICAgICAgIGlzX2NvZGUgPSAhaXNfY29kZTtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgICBpZiAoaXNfY29kZSl7XG4gICAgICAgIC8vIGFkZCB0YWIgdG8gYmVnaW5uaW5nIG9mIGxpbmVcbiAgICAgICAgbGluZSA9IFwiXFx0XCIrbGluZTtcbiAgICAgIH1cbiAgICAgIC8vIGFkZCBsaW5lIHRvIGJsb2NrXG4gICAgICBibG9jay5wdXNoKGxpbmUpO1xuICAgICAgLy8gaW5jcmVtZW50IGNoYXJfY291bnRcbiAgICAgIGNoYXJfY291bnQgKz0gbGluZS5sZW5ndGg7XG4gICAgfVxuICAgIC8vIGNsb3NlIGNvZGUgYmxvY2sgaWYgb3BlblxuICAgIGlmIChpc19jb2RlKSB7XG4gICAgICBibG9jay5wdXNoKFwiYGBgXCIpO1xuICAgIH1cbiAgICByZXR1cm4gYmxvY2suam9pbihcIlxcblwiKS50cmltKCk7XG4gIH1cblxuICAvLyByZXRyaWV2ZSBhIGZpbGUgZnJvbSB0aGUgdmF1bHRcbiAgYXN5bmMgZmlsZV9yZXRyaWV2ZXIobGluaywgbGltaXRzPXt9KSB7XG4gICAgbGltaXRzID0ge1xuICAgICAgbGluZXM6IG51bGwsXG4gICAgICBtYXhfY2hhcnM6IG51bGwsXG4gICAgICBjaGFyc19wZXJfbGluZTogbnVsbCxcbiAgICAgIC4uLmxpbWl0c1xuICAgIH07XG4gICAgY29uc3QgdGhpc19maWxlID0gdGhpcy5hcHAudmF1bHQuZ2V0QWJzdHJhY3RGaWxlQnlQYXRoKGxpbmspO1xuICAgIC8vIGlmIGZpbGUgaXMgbm90IGZvdW5kLCBza2lwXG4gICAgaWYgKCEodGhpc19maWxlIGluc3RhbmNlb2YgT2JzaWRpYW4uVEFic3RyYWN0RmlsZSkpIHJldHVybiBmYWxzZTtcbiAgICAvLyB1c2UgY2FjaGVkUmVhZCB0byBnZXQgdGhlIGZpcnN0IDEwIGxpbmVzIG9mIHRoZSBmaWxlXG4gICAgY29uc3QgZmlsZV9jb250ZW50ID0gYXdhaXQgdGhpcy5hcHAudmF1bHQuY2FjaGVkUmVhZCh0aGlzX2ZpbGUpO1xuICAgIGNvbnN0IGZpbGVfbGluZXMgPSBmaWxlX2NvbnRlbnQuc3BsaXQoXCJcXG5cIik7XG4gICAgbGV0IGZpcnN0X3Rlbl9saW5lcyA9IFtdO1xuICAgIGxldCBpc19jb2RlID0gZmFsc2U7XG4gICAgbGV0IGNoYXJfYWNjdW0gPSAwO1xuICAgIGNvbnN0IGxpbmVfbGltaXQgPSBsaW1pdHMubGluZXMgfHwgZmlsZV9saW5lcy5sZW5ndGg7XG4gICAgZm9yIChsZXQgaSA9IDA7IGZpcnN0X3Rlbl9saW5lcy5sZW5ndGggPCBsaW5lX2xpbWl0OyBpKyspIHtcbiAgICAgIGxldCBsaW5lID0gZmlsZV9saW5lc1tpXTtcbiAgICAgIC8vIGlmIGxpbmUgaXMgdW5kZWZpbmVkLCBicmVha1xuICAgICAgaWYgKHR5cGVvZiBsaW5lID09PSAndW5kZWZpbmVkJylcbiAgICAgICAgYnJlYWs7XG4gICAgICAvLyBpZiBsaW5lIGlzIGVtcHR5LCBza2lwXG4gICAgICBpZiAobGluZS5sZW5ndGggPT09IDApXG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgLy8gbGltaXQgbGVuZ3RoIG9mIGxpbmUgdG8gTiBjaGFyYWN0ZXJzXG4gICAgICBpZiAobGltaXRzLmNoYXJzX3Blcl9saW5lICYmIGxpbmUubGVuZ3RoID4gbGltaXRzLmNoYXJzX3Blcl9saW5lKSB7XG4gICAgICAgIGxpbmUgPSBsaW5lLnNsaWNlKDAsIGxpbWl0cy5jaGFyc19wZXJfbGluZSkgKyBcIi4uLlwiO1xuICAgICAgfVxuICAgICAgLy8gaWYgbGluZSBpcyBcIi0tLVwiLCBza2lwXG4gICAgICBpZiAobGluZSA9PT0gXCItLS1cIilcbiAgICAgICAgY29udGludWU7XG4gICAgICAvLyBza2lwIGlmIGxpbmUgaXMgZW1wdHkgYnVsbGV0IG9yIGNoZWNrYm94XG4gICAgICBpZiAoWyctICcsICctIFsgXSAnXS5pbmRleE9mKGxpbmUpID4gLTEpXG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgLy8gaWYgbGluZSBpcyBhIGNvZGUgYmxvY2ssIHNraXBcbiAgICAgIGlmIChsaW5lLmluZGV4T2YoXCJgYGBcIikgPT09IDApIHtcbiAgICAgICAgaXNfY29kZSA9ICFpc19jb2RlO1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIC8vIGlmIGNoYXJfYWNjdW0gaXMgZ3JlYXRlciB0aGFuIGxpbWl0Lm1heF9jaGFycywgc2tpcFxuICAgICAgaWYgKGxpbWl0cy5tYXhfY2hhcnMgJiYgY2hhcl9hY2N1bSA+IGxpbWl0cy5tYXhfY2hhcnMpIHtcbiAgICAgICAgZmlyc3RfdGVuX2xpbmVzLnB1c2goXCIuLi5cIik7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgaWYgKGlzX2NvZGUpIHtcbiAgICAgICAgLy8gaWYgaXMgY29kZSwgYWRkIHRhYiB0byBiZWdpbm5pbmcgb2YgbGluZVxuICAgICAgICBsaW5lID0gXCJcXHRcIiArIGxpbmU7XG4gICAgICB9XG4gICAgICAvLyBpZiBsaW5lIGlzIGEgaGVhZGluZ1xuICAgICAgaWYgKGxpbmVfaXNfaGVhZGluZyhsaW5lKSkge1xuICAgICAgICAvLyBsb29rIGF0IGxhc3QgbGluZSBpbiBmaXJzdF90ZW5fbGluZXMgdG8gc2VlIGlmIGl0IGlzIGEgaGVhZGluZ1xuICAgICAgICAvLyBub3RlOiB1c2VzIGxhc3QgaW4gZmlyc3RfdGVuX2xpbmVzLCBpbnN0ZWFkIG9mIGxvb2sgYWhlYWQgaW4gZmlsZV9saW5lcywgYmVjYXVzZS4uXG4gICAgICAgIC8vIC4uLm5leHQgbGluZSBtYXkgYmUgZXhjbHVkZWQgZnJvbSBmaXJzdF90ZW5fbGluZXMgYnkgcHJldmlvdXMgaWYgc3RhdGVtZW50c1xuICAgICAgICBpZiAoKGZpcnN0X3Rlbl9saW5lcy5sZW5ndGggPiAwKSAmJiBsaW5lX2lzX2hlYWRpbmcoZmlyc3RfdGVuX2xpbmVzW2ZpcnN0X3Rlbl9saW5lcy5sZW5ndGggLSAxXSkpIHtcbiAgICAgICAgICAvLyBpZiBsYXN0IGxpbmUgaXMgYSBoZWFkaW5nLCByZW1vdmUgaXRcbiAgICAgICAgICBmaXJzdF90ZW5fbGluZXMucG9wKCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIC8vIGFkZCBsaW5lIHRvIGZpcnN0X3Rlbl9saW5lc1xuICAgICAgZmlyc3RfdGVuX2xpbmVzLnB1c2gobGluZSk7XG4gICAgICAvLyBpbmNyZW1lbnQgY2hhcl9hY2N1bVxuICAgICAgY2hhcl9hY2N1bSArPSBsaW5lLmxlbmd0aDtcbiAgICB9XG4gICAgLy8gZm9yIGVhY2ggbGluZSBpbiBmaXJzdF90ZW5fbGluZXMsIGFwcGx5IHZpZXctc3BlY2lmaWMgZm9ybWF0dGluZ1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZmlyc3RfdGVuX2xpbmVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAvLyBpZiBsaW5lIGlzIGEgaGVhZGluZ1xuICAgICAgaWYgKGxpbmVfaXNfaGVhZGluZyhmaXJzdF90ZW5fbGluZXNbaV0pKSB7XG4gICAgICAgIC8vIGlmIHRoaXMgaXMgdGhlIGxhc3QgbGluZSBpbiBmaXJzdF90ZW5fbGluZXNcbiAgICAgICAgaWYgKGkgPT09IGZpcnN0X3Rlbl9saW5lcy5sZW5ndGggLSAxKSB7XG4gICAgICAgICAgLy8gcmVtb3ZlIHRoZSBsYXN0IGxpbmUgaWYgaXQgaXMgYSBoZWFkaW5nXG4gICAgICAgICAgZmlyc3RfdGVuX2xpbmVzLnBvcCgpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICAgIC8vIHJlbW92ZSBoZWFkaW5nIHN5bnRheCB0byBpbXByb3ZlIHJlYWRhYmlsaXR5IGluIHNtYWxsIHNwYWNlXG4gICAgICAgIGZpcnN0X3Rlbl9saW5lc1tpXSA9IGZpcnN0X3Rlbl9saW5lc1tpXS5yZXBsYWNlKC8jKy8sIFwiXCIpO1xuICAgICAgICBmaXJzdF90ZW5fbGluZXNbaV0gPSBgXFxuJHtmaXJzdF90ZW5fbGluZXNbaV19OmA7XG4gICAgICB9XG4gICAgfVxuICAgIC8vIGpvaW4gZmlyc3QgdGVuIGxpbmVzIGludG8gc3RyaW5nXG4gICAgZmlyc3RfdGVuX2xpbmVzID0gZmlyc3RfdGVuX2xpbmVzLmpvaW4oXCJcXG5cIik7XG4gICAgcmV0dXJuIGZpcnN0X3Rlbl9saW5lcztcbiAgfVxuXG4gIC8vIGl0ZXJhdGUgdGhyb3VnaCBibG9ja3MgYW5kIHNraXAgaWYgYmxvY2tfaGVhZGluZ3MgY29udGFpbnMgdGhpcy5oZWFkZXJfZXhjbHVzaW9uc1xuICB2YWxpZGF0ZV9oZWFkaW5ncyhibG9ja19oZWFkaW5ncykge1xuICAgIGxldCB2YWxpZCA9IHRydWU7XG4gICAgaWYgKHRoaXMuaGVhZGVyX2V4Y2x1c2lvbnMubGVuZ3RoID4gMCkge1xuICAgICAgZm9yIChsZXQgayA9IDA7IGsgPCB0aGlzLmhlYWRlcl9leGNsdXNpb25zLmxlbmd0aDsgaysrKSB7XG4gICAgICAgIGlmIChibG9ja19oZWFkaW5ncy5pbmRleE9mKHRoaXMuaGVhZGVyX2V4Y2x1c2lvbnNba10pID4gLTEpIHtcbiAgICAgICAgICB2YWxpZCA9IGZhbHNlO1xuICAgICAgICAgIHRoaXMubG9nX2V4Y2x1c2lvbihcImhlYWRpbmc6IFwiK3RoaXMuaGVhZGVyX2V4Y2x1c2lvbnNba10pO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB2YWxpZDtcbiAgfVxuICAvLyByZW5kZXIgXCJTbWFydCBDb25uZWN0aW9uc1wiIHRleHQgZml4ZWQgaW4gdGhlIGJvdHRvbSByaWdodCBjb3JuZXJcbiAgcmVuZGVyX2JyYW5kKGNvbnRhaW5lciwgbG9jYXRpb249XCJkZWZhdWx0XCIpIHtcbiAgICAvLyBpZiBsb2NhdGlvbiBpcyBhbGwgdGhlbiBnZXQgT2JqZWN0LmtleXModGhpcy5zY19icmFuZGluZykgYW5kIGNhbGwgdGhpcyBmdW5jdGlvbiBmb3IgZWFjaFxuICAgIGlmIChjb250YWluZXIgPT09IFwiYWxsXCIpIHtcbiAgICAgIGNvbnN0IGxvY2F0aW9ucyA9IE9iamVjdC5rZXlzKHRoaXMuc2NfYnJhbmRpbmcpO1xuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsb2NhdGlvbnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdGhpcy5yZW5kZXJfYnJhbmQodGhpcy5zY19icmFuZGluZ1tsb2NhdGlvbnNbaV1dLCBsb2NhdGlvbnNbaV0pO1xuICAgICAgfVxuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICAvLyBicmFuZCBjb250YWluZXJcbiAgICB0aGlzLnNjX2JyYW5kaW5nW2xvY2F0aW9uXSA9IGNvbnRhaW5lcjtcbiAgICAvLyBpZiB0aGlzLnNjX2JyYW5kaW5nW2xvY2F0aW9uXSBjb250YWlucyBjaGlsZCB3aXRoIGNsYXNzIFwic2MtYnJhbmRcIiwgcmVtb3ZlIGl0XG4gICAgaWYgKHRoaXMuc2NfYnJhbmRpbmdbbG9jYXRpb25dLnF1ZXJ5U2VsZWN0b3IoXCIuc2MtYnJhbmRcIikpIHtcbiAgICAgIHRoaXMuc2NfYnJhbmRpbmdbbG9jYXRpb25dLnF1ZXJ5U2VsZWN0b3IoXCIuc2MtYnJhbmRcIikucmVtb3ZlKCk7XG4gICAgfVxuICAgIGNvbnN0IGJyYW5kX2NvbnRhaW5lciA9IHRoaXMuc2NfYnJhbmRpbmdbbG9jYXRpb25dLmNyZWF0ZUVsKFwiZGl2XCIsIHsgY2xzOiBcInNjLWJyYW5kXCIgfSk7XG4gICAgLy8gYWRkIHRleHRcbiAgICAvLyBhZGQgU1ZHIHNpZ25hbCBpY29uIHVzaW5nIGdldEljb25cbiAgICBPYnNpZGlhbi5zZXRJY29uKGJyYW5kX2NvbnRhaW5lciwgXCJzbWFydC1jb25uZWN0aW9uc1wiKTtcbiAgICBjb25zdCBicmFuZF9wID0gYnJhbmRfY29udGFpbmVyLmNyZWF0ZUVsKFwicFwiKTtcbiAgICBsZXQgdGV4dCA9IFwiU21hcnQgQ29ubmVjdGlvbnNcIjtcbiAgICBsZXQgYXR0ciA9IHt9O1xuICAgIC8vIGlmIHVwZGF0ZSBhdmFpbGFibGUsIGNoYW5nZSB0ZXh0IHRvIFwiVXBkYXRlIEF2YWlsYWJsZVwiXG4gICAgaWYgKHRoaXMudXBkYXRlX2F2YWlsYWJsZSkge1xuICAgICAgdGV4dCA9IFwiVXBkYXRlIEF2YWlsYWJsZVwiO1xuICAgICAgYXR0ciA9IHtcbiAgICAgICAgc3R5bGU6IFwiZm9udC13ZWlnaHQ6IDcwMDtcIlxuICAgICAgfTtcbiAgICB9XG4gICAgYnJhbmRfcC5jcmVhdGVFbChcImFcIiwge1xuICAgICAgY2xzOiBcIlwiLFxuICAgICAgdGV4dDogdGV4dCxcbiAgICAgIGhyZWY6IFwiaHR0cHM6Ly9naXRodWIuY29tL2JyaWFucGV0cm8vb2JzaWRpYW4tc21hcnQtY29ubmVjdGlvbnMvZGlzY3Vzc2lvbnNcIixcbiAgICAgIHRhcmdldDogXCJfYmxhbmtcIixcbiAgICAgIGF0dHI6IGF0dHJcbiAgICB9KTtcbiAgfVxuXG5cbiAgLy8gY3JlYXRlIGxpc3Qgb2YgbmVhcmVzdCBub3Rlc1xuICBhc3luYyB1cGRhdGVfcmVzdWx0cyhjb250YWluZXIsIG5lYXJlc3QpIHtcbiAgICBsZXQgbGlzdDtcbiAgICAvLyBjaGVjayBpZiBsaXN0IGV4aXN0c1xuICAgIGlmKChjb250YWluZXIuY2hpbGRyZW4ubGVuZ3RoID4gMSkgJiYgKGNvbnRhaW5lci5jaGlsZHJlblsxXS5jbGFzc0xpc3QuY29udGFpbnMoXCJzYy1saXN0XCIpKSl7XG4gICAgICBsaXN0ID0gY29udGFpbmVyLmNoaWxkcmVuWzFdO1xuICAgIH1cbiAgICAvLyBpZiBsaXN0IGV4aXN0cywgZW1wdHkgaXRcbiAgICBpZiAobGlzdCkge1xuICAgICAgbGlzdC5lbXB0eSgpO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBjcmVhdGUgbGlzdCBlbGVtZW50XG4gICAgICBsaXN0ID0gY29udGFpbmVyLmNyZWF0ZUVsKFwiZGl2XCIsIHsgY2xzOiBcInNjLWxpc3RcIiB9KTtcbiAgICB9XG4gICAgbGV0IHNlYXJjaF9yZXN1bHRfY2xhc3MgPSBcInNlYXJjaC1yZXN1bHRcIjtcbiAgICAvLyBpZiBzZXR0aW5ncyBleHBhbmRlZF92aWV3IGlzIGZhbHNlLCBhZGQgc2MtY29sbGFwc2VkIGNsYXNzXG4gICAgaWYoIXRoaXMuc2V0dGluZ3MuZXhwYW5kZWRfdmlldykgc2VhcmNoX3Jlc3VsdF9jbGFzcyArPSBcIiBzYy1jb2xsYXBzZWRcIjtcblxuICAgIC8vIFRPRE86IGFkZCBvcHRpb24gdG8gZ3JvdXAgbmVhcmVzdCBieSBmaWxlXG4gICAgaWYoIXRoaXMuc2V0dGluZ3MuZ3JvdXBfbmVhcmVzdF9ieV9maWxlKSB7XG4gICAgICAvLyBmb3IgZWFjaCBuZWFyZXN0IG5vdGVcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbmVhcmVzdC5sZW5ndGg7IGkrKykge1xuICAgICAgICAvKipcbiAgICAgICAgICogQkVHSU4gRVhURVJOQUwgTElOSyBMT0dJQ1xuICAgICAgICAgKiBpZiBsaW5rIGlzIGFuIG9iamVjdCwgaXQgaW5kaWNhdGVzIGV4dGVybmFsIGxpbmtcbiAgICAgICAgICovXG4gICAgICAgIGlmICh0eXBlb2YgbmVhcmVzdFtpXS5saW5rID09PSBcIm9iamVjdFwiKSB7XG4gICAgICAgICAgY29uc3QgaXRlbSA9IGxpc3QuY3JlYXRlRWwoXCJkaXZcIiwgeyBjbHM6IFwic2VhcmNoLXJlc3VsdFwiIH0pO1xuICAgICAgICAgIGNvbnN0IGxpbmsgPSBpdGVtLmNyZWF0ZUVsKFwiYVwiLCB7XG4gICAgICAgICAgICBjbHM6IFwic2VhcmNoLXJlc3VsdC1maWxlLXRpdGxlIGlzLWNsaWNrYWJsZVwiLFxuICAgICAgICAgICAgaHJlZjogbmVhcmVzdFtpXS5saW5rLnBhdGgsXG4gICAgICAgICAgICB0aXRsZTogbmVhcmVzdFtpXS5saW5rLnRpdGxlLFxuICAgICAgICAgIH0pO1xuICAgICAgICAgIGxpbmsuaW5uZXJIVE1MID0gdGhpcy5yZW5kZXJfZXh0ZXJuYWxfbGlua19lbG0obmVhcmVzdFtpXS5saW5rKTtcbiAgICAgICAgICBpdGVtLnNldEF0dHIoJ2RyYWdnYWJsZScsICd0cnVlJylcbiAgICAgICAgICBjb250aW51ZTsgLy8gZW5kcyBoZXJlIGZvciBleHRlcm5hbCBsaW5rc1xuICAgICAgICB9XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBCRUdJTiBJTlRFUk5BTCBMSU5LIExPR0lDXG4gICAgICAgICAqIGlmIGxpbmsgaXMgYSBzdHJpbmcsIGl0IGluZGljYXRlcyBpbnRlcm5hbCBsaW5rXG4gICAgICAgICAqL1xuICAgICAgICBsZXQgZmlsZV9saW5rX3RleHQ7XG4gICAgICAgIGNvbnN0IGZpbGVfc2ltaWxhcml0eV9wY3QgPSBNYXRoLnJvdW5kKG5lYXJlc3RbaV0uc2ltaWxhcml0eSAqIDEwMCkgKyBcIiVcIjtcbiAgICAgICAgaWYodGhpcy5zZXR0aW5ncy5zaG93X2Z1bGxfcGF0aCkge1xuICAgICAgICAgIGNvbnN0IHBjcyA9IG5lYXJlc3RbaV0ubGluay5zcGxpdChcIi9cIik7XG4gICAgICAgICAgZmlsZV9saW5rX3RleHQgPSBwY3NbcGNzLmxlbmd0aCAtIDFdO1xuICAgICAgICAgIGNvbnN0IHBhdGggPSBwY3Muc2xpY2UoMCwgcGNzLmxlbmd0aCAtIDEpLmpvaW4oXCIvXCIpO1xuICAgICAgICAgIC8vIGZpbGVfbGlua190ZXh0ID0gYDxzbWFsbD4ke3BhdGh9IHwgJHtmaWxlX3NpbWlsYXJpdHlfcGN0fTwvc21hbGw+PGJyPiR7ZmlsZV9saW5rX3RleHR9YDtcbiAgICAgICAgICBmaWxlX2xpbmtfdGV4dCA9IGA8c21hbGw+JHtmaWxlX3NpbWlsYXJpdHlfcGN0fSB8ICR7cGF0aH0gfCAke2ZpbGVfbGlua190ZXh0fTwvc21hbGw+YDtcbiAgICAgICAgfWVsc2V7XG4gICAgICAgICAgZmlsZV9saW5rX3RleHQgPSAnPHNtYWxsPicgKyBmaWxlX3NpbWlsYXJpdHlfcGN0ICsgXCIgfCBcIiArIG5lYXJlc3RbaV0ubGluay5zcGxpdChcIi9cIikucG9wKCkgKyAnPC9zbWFsbD4nO1xuICAgICAgICB9XG4gICAgICAgIC8vIHNraXAgY29udGVudHMgcmVuZGVyaW5nIGlmIGluY29tcGF0aWJsZSBmaWxlIHR5cGVcbiAgICAgICAgLy8gZXguIG5vdCBtYXJrZG93biBmaWxlIG9yIGNvbnRhaW5zIG5vICcuZXhjYWxpZHJhdydcbiAgICAgICAgaWYoIXRoaXMucmVuZGVyYWJsZV9maWxlX3R5cGUobmVhcmVzdFtpXS5saW5rKSl7XG4gICAgICAgICAgY29uc3QgaXRlbSA9IGxpc3QuY3JlYXRlRWwoXCJkaXZcIiwgeyBjbHM6IFwic2VhcmNoLXJlc3VsdFwiIH0pO1xuICAgICAgICAgIGNvbnN0IGxpbmsgPSBpdGVtLmNyZWF0ZUVsKFwiYVwiLCB7XG4gICAgICAgICAgICBjbHM6IFwic2VhcmNoLXJlc3VsdC1maWxlLXRpdGxlIGlzLWNsaWNrYWJsZVwiLFxuICAgICAgICAgICAgaHJlZjogbmVhcmVzdFtpXS5saW5rLFxuICAgICAgICAgIH0pO1xuICAgICAgICAgIGxpbmsuaW5uZXJIVE1MID0gZmlsZV9saW5rX3RleHQ7XG4gICAgICAgICAgLy8gZHJhZyBhbmQgZHJvcFxuICAgICAgICAgIGl0ZW0uc2V0QXR0cignZHJhZ2dhYmxlJywgJ3RydWUnKVxuICAgICAgICAgIC8vIGFkZCBsaXN0ZW5lcnMgdG8gbGlua1xuICAgICAgICAgIHRoaXMuYWRkX2xpbmtfbGlzdGVuZXJzKGxpbmssIG5lYXJlc3RbaV0sIGl0ZW0pO1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gcmVtb3ZlIGZpbGUgZXh0ZW5zaW9uIGlmIC5tZCBhbmQgbWFrZSAjIGludG8gPlxuICAgICAgICBmaWxlX2xpbmtfdGV4dCA9IGZpbGVfbGlua190ZXh0LnJlcGxhY2UoXCIubWRcIiwgXCJcIikucmVwbGFjZSgvIy9nLCBcIiA+IFwiKTtcbiAgICAgICAgLy8gY3JlYXRlIGl0ZW1cbiAgICAgICAgY29uc3QgaXRlbSA9IGxpc3QuY3JlYXRlRWwoXCJkaXZcIiwgeyBjbHM6IHNlYXJjaF9yZXN1bHRfY2xhc3MgfSk7XG4gICAgICAgIC8vIGNyZWF0ZSBzcGFuIGZvciB0b2dnbGVcbiAgICAgICAgY29uc3QgdG9nZ2xlID0gaXRlbS5jcmVhdGVFbChcInNwYW5cIiwgeyBjbHM6IFwiaXMtY2xpY2thYmxlXCIgfSk7XG4gICAgICAgIC8vIGluc2VydCByaWdodCB0cmlhbmdsZSBzdmcgYXMgdG9nZ2xlXG4gICAgICAgIE9ic2lkaWFuLnNldEljb24odG9nZ2xlLCBcInJpZ2h0LXRyaWFuZ2xlXCIpOyAvLyBtdXN0IGNvbWUgYmVmb3JlIGFkZGluZyBvdGhlciBlbG1zIHRvIHByZXZlbnQgb3ZlcndyaXRlXG4gICAgICAgIGNvbnN0IGxpbmsgPSB0b2dnbGUuY3JlYXRlRWwoXCJhXCIsIHtcbiAgICAgICAgICBjbHM6IFwic2VhcmNoLXJlc3VsdC1maWxlLXRpdGxlXCIsXG4gICAgICAgICAgdGl0bGU6IG5lYXJlc3RbaV0ubGluayxcbiAgICAgICAgfSk7XG4gICAgICAgIGxpbmsuaW5uZXJIVE1MID0gZmlsZV9saW5rX3RleHQ7XG4gICAgICAgIC8vIGFkZCBsaXN0ZW5lcnMgdG8gbGlua1xuICAgICAgICB0aGlzLmFkZF9saW5rX2xpc3RlbmVycyhsaW5rLCBuZWFyZXN0W2ldLCBpdGVtKTtcbiAgICAgICAgdG9nZ2xlLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoZXZlbnQpID0+IHtcbiAgICAgICAgICAvLyBmaW5kIHBhcmVudCBjb250YWluaW5nIHNlYXJjaC1yZXN1bHQgY2xhc3NcbiAgICAgICAgICBsZXQgcGFyZW50ID0gZXZlbnQudGFyZ2V0LnBhcmVudEVsZW1lbnQ7XG4gICAgICAgICAgd2hpbGUgKCFwYXJlbnQuY2xhc3NMaXN0LmNvbnRhaW5zKFwic2VhcmNoLXJlc3VsdFwiKSkge1xuICAgICAgICAgICAgcGFyZW50ID0gcGFyZW50LnBhcmVudEVsZW1lbnQ7XG4gICAgICAgICAgfVxuICAgICAgICAgIC8vIHRvZ2dsZSBzYy1jb2xsYXBzZWQgY2xhc3NcbiAgICAgICAgICBwYXJlbnQuY2xhc3NMaXN0LnRvZ2dsZShcInNjLWNvbGxhcHNlZFwiKTtcbiAgICAgICAgfSk7XG4gICAgICAgIGNvbnN0IGNvbnRlbnRzID0gaXRlbS5jcmVhdGVFbChcInVsXCIsIHsgY2xzOiBcIlwiIH0pO1xuICAgICAgICBjb25zdCBjb250ZW50c19jb250YWluZXIgPSBjb250ZW50cy5jcmVhdGVFbChcImxpXCIsIHtcbiAgICAgICAgICBjbHM6IFwic2VhcmNoLXJlc3VsdC1maWxlLXRpdGxlIGlzLWNsaWNrYWJsZVwiLFxuICAgICAgICAgIHRpdGxlOiBuZWFyZXN0W2ldLmxpbmssXG4gICAgICAgIH0pO1xuICAgICAgICBpZihuZWFyZXN0W2ldLmxpbmsuaW5kZXhPZihcIiNcIikgPiAtMSl7IC8vIGlzIGJsb2NrXG4gICAgICAgICAgT2JzaWRpYW4uTWFya2Rvd25SZW5kZXJlci5yZW5kZXJNYXJrZG93bigoYXdhaXQgdGhpcy5ibG9ja19yZXRyaWV2ZXIobmVhcmVzdFtpXS5saW5rLCB7bGluZXM6IDEwLCBtYXhfY2hhcnM6IDEwMDB9KSksIGNvbnRlbnRzX2NvbnRhaW5lciwgbmVhcmVzdFtpXS5saW5rLCBuZXcgT2JzaWRpYW4uQ29tcG9uZW50KCkpO1xuICAgICAgICB9ZWxzZXsgLy8gaXMgZmlsZVxuICAgICAgICAgIGNvbnN0IGZpcnN0X3Rlbl9saW5lcyA9IGF3YWl0IHRoaXMuZmlsZV9yZXRyaWV2ZXIobmVhcmVzdFtpXS5saW5rLCB7bGluZXM6IDEwLCBtYXhfY2hhcnM6IDEwMDB9KTtcbiAgICAgICAgICBpZighZmlyc3RfdGVuX2xpbmVzKSBjb250aW51ZTsgLy8gc2tpcCBpZiBmaWxlIGlzIGVtcHR5XG4gICAgICAgICAgT2JzaWRpYW4uTWFya2Rvd25SZW5kZXJlci5yZW5kZXJNYXJrZG93bihmaXJzdF90ZW5fbGluZXMsIGNvbnRlbnRzX2NvbnRhaW5lciwgbmVhcmVzdFtpXS5saW5rLCBuZXcgT2JzaWRpYW4uQ29tcG9uZW50KCkpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuYWRkX2xpbmtfbGlzdGVuZXJzKGNvbnRlbnRzLCBuZWFyZXN0W2ldLCBpdGVtKTtcbiAgICAgIH1cbiAgICAgIHRoaXMucmVuZGVyX2JyYW5kKGNvbnRhaW5lciwgXCJibG9ja1wiKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBncm91cCBuZWFyZXN0IGJ5IGZpbGVcbiAgICBjb25zdCBuZWFyZXN0X2J5X2ZpbGUgPSB7fTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IG5lYXJlc3QubGVuZ3RoOyBpKyspIHtcbiAgICAgIGNvbnN0IGN1cnIgPSBuZWFyZXN0W2ldO1xuICAgICAgY29uc3QgbGluayA9IGN1cnIubGluaztcbiAgICAgIC8vIHNraXAgaWYgbGluayBpcyBhbiBvYmplY3QgKGluZGljYXRlcyBleHRlcm5hbCBsb2dpYylcbiAgICAgIGlmICh0eXBlb2YgbGluayA9PT0gXCJvYmplY3RcIikge1xuICAgICAgICBuZWFyZXN0X2J5X2ZpbGVbbGluay5wYXRoXSA9IFtjdXJyXTtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgICBpZiAobGluay5pbmRleE9mKFwiI1wiKSA+IC0xKSB7XG4gICAgICAgIGNvbnN0IGZpbGVfcGF0aCA9IGxpbmsuc3BsaXQoXCIjXCIpWzBdO1xuICAgICAgICBpZiAoIW5lYXJlc3RfYnlfZmlsZVtmaWxlX3BhdGhdKSB7XG4gICAgICAgICAgbmVhcmVzdF9ieV9maWxlW2ZpbGVfcGF0aF0gPSBbXTtcbiAgICAgICAgfVxuICAgICAgICBuZWFyZXN0X2J5X2ZpbGVbZmlsZV9wYXRoXS5wdXNoKG5lYXJlc3RbaV0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaWYgKCFuZWFyZXN0X2J5X2ZpbGVbbGlua10pIHtcbiAgICAgICAgICBuZWFyZXN0X2J5X2ZpbGVbbGlua10gPSBbXTtcbiAgICAgICAgfVxuICAgICAgICAvLyBhbHdheXMgYWRkIHRvIGZyb250IG9mIGFycmF5XG4gICAgICAgIG5lYXJlc3RfYnlfZmlsZVtsaW5rXS51bnNoaWZ0KG5lYXJlc3RbaV0pO1xuICAgICAgfVxuICAgIH1cbiAgICAvLyBmb3IgZWFjaCBmaWxlXG4gICAgY29uc3Qga2V5cyA9IE9iamVjdC5rZXlzKG5lYXJlc3RfYnlfZmlsZSk7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBrZXlzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBjb25zdCBmaWxlID0gbmVhcmVzdF9ieV9maWxlW2tleXNbaV1dO1xuICAgICAgLyoqXG4gICAgICAgKiBCZWdpbiBleHRlcm5hbCBsaW5rIGhhbmRsaW5nXG4gICAgICAgKi9cbiAgICAgIC8vIGlmIGxpbmsgaXMgYW4gb2JqZWN0IChpbmRpY2F0ZXMgdjIgbG9naWMpXG4gICAgICBpZiAodHlwZW9mIGZpbGVbMF0ubGluayA9PT0gXCJvYmplY3RcIikge1xuICAgICAgICBjb25zdCBjdXJyID0gZmlsZVswXTtcbiAgICAgICAgY29uc3QgbWV0YSA9IGN1cnIubGluaztcbiAgICAgICAgaWYgKG1ldGEucGF0aC5zdGFydHNXaXRoKFwiaHR0cFwiKSkge1xuICAgICAgICAgIGNvbnN0IGl0ZW0gPSBsaXN0LmNyZWF0ZUVsKFwiZGl2XCIsIHsgY2xzOiBcInNlYXJjaC1yZXN1bHRcIiB9KTtcbiAgICAgICAgICBjb25zdCBsaW5rID0gaXRlbS5jcmVhdGVFbChcImFcIiwge1xuICAgICAgICAgICAgY2xzOiBcInNlYXJjaC1yZXN1bHQtZmlsZS10aXRsZSBpcy1jbGlja2FibGVcIixcbiAgICAgICAgICAgIGhyZWY6IG1ldGEucGF0aCxcbiAgICAgICAgICAgIHRpdGxlOiBtZXRhLnRpdGxlLFxuICAgICAgICAgIH0pO1xuICAgICAgICAgIGxpbmsuaW5uZXJIVE1MID0gdGhpcy5yZW5kZXJfZXh0ZXJuYWxfbGlua19lbG0obWV0YSk7XG4gICAgICAgICAgaXRlbS5zZXRBdHRyKCdkcmFnZ2FibGUnLCAndHJ1ZScpO1xuICAgICAgICAgIGNvbnRpbnVlOyAvLyBlbmRzIGhlcmUgZm9yIGV4dGVybmFsIGxpbmtzXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIC8qKlxuICAgICAgICogSGFuZGxlcyBJbnRlcm5hbFxuICAgICAgICovXG4gICAgICBsZXQgZmlsZV9saW5rX3RleHQ7XG4gICAgICBjb25zdCBmaWxlX3NpbWlsYXJpdHlfcGN0ID0gTWF0aC5yb3VuZChmaWxlWzBdLnNpbWlsYXJpdHkgKiAxMDApICsgXCIlXCI7XG4gICAgICBpZiAodGhpcy5zZXR0aW5ncy5zaG93X2Z1bGxfcGF0aCkge1xuICAgICAgICBjb25zdCBwY3MgPSBmaWxlWzBdLmxpbmsuc3BsaXQoXCIvXCIpO1xuICAgICAgICBmaWxlX2xpbmtfdGV4dCA9IHBjc1twY3MubGVuZ3RoIC0gMV07XG4gICAgICAgIGNvbnN0IHBhdGggPSBwY3Muc2xpY2UoMCwgcGNzLmxlbmd0aCAtIDEpLmpvaW4oXCIvXCIpO1xuICAgICAgICBmaWxlX2xpbmtfdGV4dCA9IGA8c21hbGw+JHtwYXRofSB8ICR7ZmlsZV9zaW1pbGFyaXR5X3BjdH08L3NtYWxsPjxicj4ke2ZpbGVfbGlua190ZXh0fWA7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBmaWxlX2xpbmtfdGV4dCA9IGZpbGVbMF0ubGluay5zcGxpdChcIi9cIikucG9wKCk7XG4gICAgICAgIC8vIGFkZCBzaW1pbGFyaXR5IHBlcmNlbnRhZ2VcbiAgICAgICAgZmlsZV9saW5rX3RleHQgKz0gJyB8ICcgKyBmaWxlX3NpbWlsYXJpdHlfcGN0O1xuICAgICAgfVxuXG5cbiAgICAgICAgXG4gICAgICAvLyBza2lwIGNvbnRlbnRzIHJlbmRlcmluZyBpZiBpbmNvbXBhdGlibGUgZmlsZSB0eXBlXG4gICAgICAvLyBleC4gbm90IG1hcmtkb3duIG9yIGNvbnRhaW5zICcuZXhjYWxpZHJhdydcbiAgICAgIGlmKCF0aGlzLnJlbmRlcmFibGVfZmlsZV90eXBlKGZpbGVbMF0ubGluaykpIHtcbiAgICAgICAgY29uc3QgaXRlbSA9IGxpc3QuY3JlYXRlRWwoXCJkaXZcIiwgeyBjbHM6IFwic2VhcmNoLXJlc3VsdFwiIH0pO1xuICAgICAgICBjb25zdCBmaWxlX2xpbmsgPSBpdGVtLmNyZWF0ZUVsKFwiYVwiLCB7XG4gICAgICAgICAgY2xzOiBcInNlYXJjaC1yZXN1bHQtZmlsZS10aXRsZSBpcy1jbGlja2FibGVcIixcbiAgICAgICAgICB0aXRsZTogZmlsZVswXS5saW5rLFxuICAgICAgICB9KTtcbiAgICAgICAgZmlsZV9saW5rLmlubmVySFRNTCA9IGZpbGVfbGlua190ZXh0O1xuICAgICAgICAvLyBhZGQgbGluayBsaXN0ZW5lcnMgdG8gZmlsZSBsaW5rXG4gICAgICAgIHRoaXMuYWRkX2xpbmtfbGlzdGVuZXJzKGZpbGVfbGluaywgZmlsZVswXSwgaXRlbSk7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG5cbiAgICAgIC8vIHJlbW92ZSBmaWxlIGV4dGVuc2lvbiBpZiAubWRcbiAgICAgIGZpbGVfbGlua190ZXh0ID0gZmlsZV9saW5rX3RleHQucmVwbGFjZShcIi5tZFwiLCBcIlwiKS5yZXBsYWNlKC8jL2csIFwiID4gXCIpO1xuICAgICAgY29uc3QgaXRlbSA9IGxpc3QuY3JlYXRlRWwoXCJkaXZcIiwgeyBjbHM6IHNlYXJjaF9yZXN1bHRfY2xhc3MgfSk7XG4gICAgICBjb25zdCB0b2dnbGUgPSBpdGVtLmNyZWF0ZUVsKFwic3BhblwiLCB7IGNsczogXCJpcy1jbGlja2FibGVcIiB9KTtcbiAgICAgIC8vIGluc2VydCByaWdodCB0cmlhbmdsZSBzdmcgaWNvbiBhcyB0b2dnbGUgYnV0dG9uIGluIHNwYW5cbiAgICAgIE9ic2lkaWFuLnNldEljb24odG9nZ2xlLCBcInJpZ2h0LXRyaWFuZ2xlXCIpOyAvLyBtdXN0IGNvbWUgYmVmb3JlIGFkZGluZyBvdGhlciBlbG1zIGVsc2Ugb3ZlcndyaXRlc1xuICAgICAgY29uc3QgZmlsZV9saW5rID0gdG9nZ2xlLmNyZWF0ZUVsKFwiYVwiLCB7XG4gICAgICAgIGNsczogXCJzZWFyY2gtcmVzdWx0LWZpbGUtdGl0bGVcIixcbiAgICAgICAgdGl0bGU6IGZpbGVbMF0ubGluayxcbiAgICAgIH0pO1xuICAgICAgZmlsZV9saW5rLmlubmVySFRNTCA9IGZpbGVfbGlua190ZXh0O1xuICAgICAgLy8gYWRkIGxpbmsgbGlzdGVuZXJzIHRvIGZpbGUgbGlua1xuICAgICAgdGhpcy5hZGRfbGlua19saXN0ZW5lcnMoZmlsZV9saW5rLCBmaWxlWzBdLCB0b2dnbGUpO1xuICAgICAgdG9nZ2xlLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoZXZlbnQpID0+IHtcbiAgICAgICAgLy8gZmluZCBwYXJlbnQgY29udGFpbmluZyBjbGFzcyBzZWFyY2gtcmVzdWx0XG4gICAgICAgIGxldCBwYXJlbnQgPSBldmVudC50YXJnZXQ7XG4gICAgICAgIHdoaWxlICghcGFyZW50LmNsYXNzTGlzdC5jb250YWlucyhcInNlYXJjaC1yZXN1bHRcIikpIHtcbiAgICAgICAgICBwYXJlbnQgPSBwYXJlbnQucGFyZW50RWxlbWVudDtcbiAgICAgICAgfVxuICAgICAgICBwYXJlbnQuY2xhc3NMaXN0LnRvZ2dsZShcInNjLWNvbGxhcHNlZFwiKTtcbiAgICAgICAgLy8gVE9ETzogaWYgYmxvY2sgY29udGFpbmVyIGlzIGVtcHR5LCByZW5kZXIgbWFya2Rvd24gZnJvbSBibG9jayByZXRyaWV2ZXJcbiAgICAgIH0pO1xuICAgICAgY29uc3QgZmlsZV9saW5rX2xpc3QgPSBpdGVtLmNyZWF0ZUVsKFwidWxcIik7XG4gICAgICAvLyBmb3IgZWFjaCBsaW5rIGluIGZpbGVcbiAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgZmlsZS5sZW5ndGg7IGorKykge1xuICAgICAgICAvLyBpZiBpcyBhIGJsb2NrIChoYXMgIyBpbiBsaW5rKVxuICAgICAgICBpZihmaWxlW2pdLmxpbmsuaW5kZXhPZihcIiNcIikgPiAtMSkge1xuICAgICAgICAgIGNvbnN0IGJsb2NrID0gZmlsZVtqXTtcbiAgICAgICAgICBjb25zdCBibG9ja19saW5rID0gZmlsZV9saW5rX2xpc3QuY3JlYXRlRWwoXCJsaVwiLCB7XG4gICAgICAgICAgICBjbHM6IFwic2VhcmNoLXJlc3VsdC1maWxlLXRpdGxlIGlzLWNsaWNrYWJsZVwiLFxuICAgICAgICAgICAgdGl0bGU6IGJsb2NrLmxpbmssXG4gICAgICAgICAgfSk7XG4gICAgICAgICAgLy8gc2tpcCBibG9jayBjb250ZXh0IGlmIGZpbGUubGVuZ3RoID09PSAxIGJlY2F1c2UgYWxyZWFkeSBhZGRlZFxuICAgICAgICAgIGlmKGZpbGUubGVuZ3RoID4gMSkge1xuICAgICAgICAgICAgY29uc3QgYmxvY2tfY29udGV4dCA9IHRoaXMucmVuZGVyX2Jsb2NrX2NvbnRleHQoYmxvY2spO1xuICAgICAgICAgICAgY29uc3QgYmxvY2tfc2ltaWxhcml0eV9wY3QgPSBNYXRoLnJvdW5kKGJsb2NrLnNpbWlsYXJpdHkgKiAxMDApICsgXCIlXCI7XG4gICAgICAgICAgICBibG9ja19saW5rLmlubmVySFRNTCA9IGA8c21hbGw+JHtibG9ja19jb250ZXh0fSB8ICR7YmxvY2tfc2ltaWxhcml0eV9wY3R9PC9zbWFsbD5gO1xuICAgICAgICAgIH1cbiAgICAgICAgICBjb25zdCBibG9ja19jb250YWluZXIgPSBibG9ja19saW5rLmNyZWF0ZUVsKFwiZGl2XCIpO1xuICAgICAgICAgIC8vIFRPRE86IG1vdmUgdG8gcmVuZGVyaW5nIG9uIGV4cGFuZGluZyBzZWN0aW9uICh0b2dnbGUgY29sbGFwc2VkKVxuICAgICAgICAgIE9ic2lkaWFuLk1hcmtkb3duUmVuZGVyZXIucmVuZGVyTWFya2Rvd24oKGF3YWl0IHRoaXMuYmxvY2tfcmV0cmlldmVyKGJsb2NrLmxpbmssIHtsaW5lczogMTAsIG1heF9jaGFyczogMTAwMH0pKSwgYmxvY2tfY29udGFpbmVyLCBibG9jay5saW5rLCBuZXcgT2JzaWRpYW4uQ29tcG9uZW50KCkpO1xuICAgICAgICAgIC8vIGFkZCBsaW5rIGxpc3RlbmVycyB0byBibG9jayBsaW5rXG4gICAgICAgICAgdGhpcy5hZGRfbGlua19saXN0ZW5lcnMoYmxvY2tfbGluaywgYmxvY2ssIGZpbGVfbGlua19saXN0KTtcbiAgICAgICAgfWVsc2V7XG4gICAgICAgICAgLy8gZ2V0IGZpcnN0IHRlbiBsaW5lcyBvZiBmaWxlXG4gICAgICAgICAgY29uc3QgZmlsZV9saW5rX2xpc3QgPSBpdGVtLmNyZWF0ZUVsKFwidWxcIik7XG4gICAgICAgICAgY29uc3QgYmxvY2tfbGluayA9IGZpbGVfbGlua19saXN0LmNyZWF0ZUVsKFwibGlcIiwge1xuICAgICAgICAgICAgY2xzOiBcInNlYXJjaC1yZXN1bHQtZmlsZS10aXRsZSBpcy1jbGlja2FibGVcIixcbiAgICAgICAgICAgIHRpdGxlOiBmaWxlWzBdLmxpbmssXG4gICAgICAgICAgfSk7XG4gICAgICAgICAgY29uc3QgYmxvY2tfY29udGFpbmVyID0gYmxvY2tfbGluay5jcmVhdGVFbChcImRpdlwiKTtcbiAgICAgICAgICBsZXQgZmlyc3RfdGVuX2xpbmVzID0gYXdhaXQgdGhpcy5maWxlX3JldHJpZXZlcihmaWxlWzBdLmxpbmssIHtsaW5lczogMTAsIG1heF9jaGFyczogMTAwMH0pO1xuICAgICAgICAgIGlmKCFmaXJzdF90ZW5fbGluZXMpIGNvbnRpbnVlOyAvLyBpZiBmaWxlIG5vdCBmb3VuZCwgc2tpcFxuICAgICAgICAgIE9ic2lkaWFuLk1hcmtkb3duUmVuZGVyZXIucmVuZGVyTWFya2Rvd24oZmlyc3RfdGVuX2xpbmVzLCBibG9ja19jb250YWluZXIsIGZpbGVbMF0ubGluaywgbmV3IE9ic2lkaWFuLkNvbXBvbmVudCgpKTtcbiAgICAgICAgICB0aGlzLmFkZF9saW5rX2xpc3RlbmVycyhibG9ja19saW5rLCBmaWxlWzBdLCBmaWxlX2xpbmtfbGlzdCk7XG5cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICB0aGlzLnJlbmRlcl9icmFuZChjb250YWluZXIsIFwiZmlsZVwiKTtcbiAgfVxuXG4gIGFkZF9saW5rX2xpc3RlbmVycyhpdGVtLCBjdXJyLCBsaXN0KSB7XG4gICAgaXRlbS5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgYXN5bmMgKGV2ZW50KSA9PiB7XG4gICAgICBhd2FpdCB0aGlzLm9wZW5fbm90ZShjdXJyLCBldmVudCk7XG4gICAgfSk7XG4gICAgLy8gZHJhZy1vblxuICAgIC8vIGN1cnJlbnRseSBvbmx5IHdvcmtzIHdpdGggZnVsbC1maWxlIGxpbmtzXG4gICAgaXRlbS5zZXRBdHRyKCdkcmFnZ2FibGUnLCAndHJ1ZScpO1xuICAgIGl0ZW0uYWRkRXZlbnRMaXN0ZW5lcignZHJhZ3N0YXJ0JywgKGV2ZW50KSA9PiB7XG4gICAgICBjb25zdCBkcmFnTWFuYWdlciA9IHRoaXMuYXBwLmRyYWdNYW5hZ2VyO1xuICAgICAgY29uc3QgZmlsZV9wYXRoID0gY3Vyci5saW5rLnNwbGl0KFwiI1wiKVswXTtcbiAgICAgIGNvbnN0IGZpbGUgPSB0aGlzLmFwcC5tZXRhZGF0YUNhY2hlLmdldEZpcnN0TGlua3BhdGhEZXN0KGZpbGVfcGF0aCwgJycpO1xuICAgICAgY29uc3QgZHJhZ0RhdGEgPSBkcmFnTWFuYWdlci5kcmFnRmlsZShldmVudCwgZmlsZSk7XG4gICAgICAvLyBjb25zb2xlLmxvZyhkcmFnRGF0YSk7XG4gICAgICBkcmFnTWFuYWdlci5vbkRyYWdTdGFydChldmVudCwgZHJhZ0RhdGEpO1xuICAgIH0pO1xuICAgIC8vIGlmIGN1cnIubGluayBjb250YWlucyBjdXJseSBicmFjZXMsIHJldHVybiAoaW5jb21wYXRpYmxlIHdpdGggaG92ZXItbGluaylcbiAgICBpZiAoY3Vyci5saW5rLmluZGV4T2YoXCJ7XCIpID4gLTEpIHJldHVybjtcbiAgICAvLyB0cmlnZ2VyIGhvdmVyIGV2ZW50IG9uIGxpbmtcbiAgICBpdGVtLmFkZEV2ZW50TGlzdGVuZXIoXCJtb3VzZW92ZXJcIiwgKGV2ZW50KSA9PiB7XG4gICAgICB0aGlzLmFwcC53b3Jrc3BhY2UudHJpZ2dlcihcImhvdmVyLWxpbmtcIiwge1xuICAgICAgICBldmVudCxcbiAgICAgICAgc291cmNlOiBTTUFSVF9DT05ORUNUSU9OU19WSUVXX1RZUEUsXG4gICAgICAgIGhvdmVyUGFyZW50OiBsaXN0LFxuICAgICAgICB0YXJnZXRFbDogaXRlbSxcbiAgICAgICAgbGlua3RleHQ6IGN1cnIubGluayxcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG5cbiAgLy8gZ2V0IHRhcmdldCBmaWxlIGZyb20gbGluayBwYXRoXG4gIC8vIGlmIHN1Yi1zZWN0aW9uIGlzIGxpbmtlZCwgb3BlbiBmaWxlIGFuZCBzY3JvbGwgdG8gc3ViLXNlY3Rpb25cbiAgYXN5bmMgb3Blbl9ub3RlKGN1cnIsIGV2ZW50PW51bGwpIHtcbiAgICBsZXQgdGFyZ2V0RmlsZTtcbiAgICBsZXQgaGVhZGluZztcbiAgICBpZiAoY3Vyci5saW5rLmluZGV4T2YoXCIjXCIpID4gLTEpIHtcbiAgICAgIC8vIHJlbW92ZSBhZnRlciAjIGZyb20gbGlua1xuICAgICAgdGFyZ2V0RmlsZSA9IHRoaXMuYXBwLm1ldGFkYXRhQ2FjaGUuZ2V0Rmlyc3RMaW5rcGF0aERlc3QoY3Vyci5saW5rLnNwbGl0KFwiI1wiKVswXSwgXCJcIik7XG4gICAgICAvLyBjb25zb2xlLmxvZyh0YXJnZXRGaWxlKTtcbiAgICAgIGNvbnN0IHRhcmdldF9maWxlX2NhY2hlID0gdGhpcy5hcHAubWV0YWRhdGFDYWNoZS5nZXRGaWxlQ2FjaGUodGFyZ2V0RmlsZSk7XG4gICAgICAvLyBjb25zb2xlLmxvZyh0YXJnZXRfZmlsZV9jYWNoZSk7XG4gICAgICAvLyBnZXQgaGVhZGluZ1xuICAgICAgbGV0IGhlYWRpbmdfdGV4dCA9IGN1cnIubGluay5zcGxpdChcIiNcIikucG9wKCk7XG4gICAgICAvLyBpZiBoZWFkaW5nIHRleHQgY29udGFpbnMgYSBjdXJseSBicmFjZSwgZ2V0IHRoZSBudW1iZXIgaW5zaWRlIHRoZSBjdXJseSBicmFjZXMgYXMgb2NjdXJlbmNlXG4gICAgICBsZXQgb2NjdXJlbmNlID0gMDtcbiAgICAgIGlmIChoZWFkaW5nX3RleHQuaW5kZXhPZihcIntcIikgPiAtMSkge1xuICAgICAgICAvLyBnZXQgb2NjdXJlbmNlXG4gICAgICAgIG9jY3VyZW5jZSA9IHBhcnNlSW50KGhlYWRpbmdfdGV4dC5zcGxpdChcIntcIilbMV0uc3BsaXQoXCJ9XCIpWzBdKTtcbiAgICAgICAgLy8gcmVtb3ZlIG9jY3VyZW5jZSBmcm9tIGhlYWRpbmcgdGV4dFxuICAgICAgICBoZWFkaW5nX3RleHQgPSBoZWFkaW5nX3RleHQuc3BsaXQoXCJ7XCIpWzBdO1xuICAgICAgfVxuICAgICAgLy8gZ2V0IGhlYWRpbmdzIGZyb20gZmlsZSBjYWNoZVxuICAgICAgY29uc3QgaGVhZGluZ3MgPSB0YXJnZXRfZmlsZV9jYWNoZS5oZWFkaW5ncztcbiAgICAgIC8vIGdldCBoZWFkaW5ncyB3aXRoIHRoZSBzYW1lIGRlcHRoIGFuZCB0ZXh0IGFzIHRoZSBsaW5rXG4gICAgICBmb3IobGV0IGkgPSAwOyBpIDwgaGVhZGluZ3MubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgaWYgKGhlYWRpbmdzW2ldLmhlYWRpbmcgPT09IGhlYWRpbmdfdGV4dCkge1xuICAgICAgICAgIC8vIGlmIG9jY3VyZW5jZSBpcyAwLCBzZXQgaGVhZGluZyBhbmQgYnJlYWtcbiAgICAgICAgICBpZihvY2N1cmVuY2UgPT09IDApIHtcbiAgICAgICAgICAgIGhlYWRpbmcgPSBoZWFkaW5nc1tpXTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH1cbiAgICAgICAgICBvY2N1cmVuY2UtLTsgLy8gZGVjcmVtZW50IG9jY3VyZW5jZVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICAvLyBjb25zb2xlLmxvZyhoZWFkaW5nKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGFyZ2V0RmlsZSA9IHRoaXMuYXBwLm1ldGFkYXRhQ2FjaGUuZ2V0Rmlyc3RMaW5rcGF0aERlc3QoY3Vyci5saW5rLCBcIlwiKTtcbiAgICB9XG4gICAgbGV0IGxlYWY7XG4gICAgaWYoZXZlbnQpIHtcbiAgICAgIC8vIHByb3Blcmx5IGhhbmRsZSBpZiB0aGUgbWV0YS9jdHJsIGtleSBpcyBwcmVzc2VkXG4gICAgICBjb25zdCBtb2QgPSBPYnNpZGlhbi5LZXltYXAuaXNNb2RFdmVudChldmVudCk7XG4gICAgICAvLyBnZXQgbW9zdCByZWNlbnQgbGVhZlxuICAgICAgbGVhZiA9IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRMZWFmKG1vZCk7XG4gICAgfWVsc2V7XG4gICAgICAvLyBnZXQgbW9zdCByZWNlbnQgbGVhZlxuICAgICAgbGVhZiA9IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRNb3N0UmVjZW50TGVhZigpO1xuICAgIH1cbiAgICBhd2FpdCBsZWFmLm9wZW5GaWxlKHRhcmdldEZpbGUpO1xuICAgIGlmIChoZWFkaW5nKSB7XG4gICAgICBsZXQgeyBlZGl0b3IgfSA9IGxlYWYudmlldztcbiAgICAgIGNvbnN0IHBvcyA9IHsgbGluZTogaGVhZGluZy5wb3NpdGlvbi5zdGFydC5saW5lLCBjaDogMCB9O1xuICAgICAgZWRpdG9yLnNldEN1cnNvcihwb3MpO1xuICAgICAgZWRpdG9yLnNjcm9sbEludG9WaWV3KHsgdG86IHBvcywgZnJvbTogcG9zIH0sIHRydWUpO1xuICAgIH1cbiAgfVxuXG4gIHJlbmRlcl9ibG9ja19jb250ZXh0KGJsb2NrKSB7XG4gICAgY29uc3QgYmxvY2tfaGVhZGluZ3MgPSBibG9jay5saW5rLnNwbGl0KFwiLm1kXCIpWzFdLnNwbGl0KFwiI1wiKTtcbiAgICAvLyBzdGFydGluZyB3aXRoIHRoZSBsYXN0IGhlYWRpbmcgZmlyc3QsIGl0ZXJhdGUgdGhyb3VnaCBoZWFkaW5nc1xuICAgIGxldCBibG9ja19jb250ZXh0ID0gXCJcIjtcbiAgICBmb3IgKGxldCBpID0gYmxvY2tfaGVhZGluZ3MubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICAgIGlmKGJsb2NrX2NvbnRleHQubGVuZ3RoID4gMCkge1xuICAgICAgICBibG9ja19jb250ZXh0ID0gYCA+ICR7YmxvY2tfY29udGV4dH1gO1xuICAgICAgfVxuICAgICAgYmxvY2tfY29udGV4dCA9IGJsb2NrX2hlYWRpbmdzW2ldICsgYmxvY2tfY29udGV4dDtcbiAgICAgIC8vIGlmIGJsb2NrIGNvbnRleHQgaXMgbG9uZ2VyIHRoYW4gTiBjaGFyYWN0ZXJzLCBicmVha1xuICAgICAgaWYgKGJsb2NrX2NvbnRleHQubGVuZ3RoID4gMTAwKSB7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgICAvLyByZW1vdmUgbGVhZGluZyA+IGlmIGV4aXN0c1xuICAgIGlmIChibG9ja19jb250ZXh0LnN0YXJ0c1dpdGgoXCIgPiBcIikpIHtcbiAgICAgIGJsb2NrX2NvbnRleHQgPSBibG9ja19jb250ZXh0LnNsaWNlKDMpO1xuICAgIH1cbiAgICByZXR1cm4gYmxvY2tfY29udGV4dDtcblxuICB9XG5cbiAgcmVuZGVyYWJsZV9maWxlX3R5cGUobGluaykge1xuICAgIHJldHVybiAobGluay5pbmRleE9mKFwiLm1kXCIpICE9PSAtMSkgJiYgKGxpbmsuaW5kZXhPZihcIi5leGNhbGlkcmF3XCIpID09PSAtMSk7XG4gIH1cblxuICByZW5kZXJfZXh0ZXJuYWxfbGlua19lbG0obWV0YSl7XG4gICAgaWYobWV0YS5zb3VyY2UpIHtcbiAgICAgIGlmKG1ldGEuc291cmNlID09PSBcIkdtYWlsXCIpIG1ldGEuc291cmNlID0gXCJcdUQ4M0RcdURDRTcgR21haWxcIjtcbiAgICAgIHJldHVybiBgPHNtYWxsPiR7bWV0YS5zb3VyY2V9PC9zbWFsbD48YnI+JHttZXRhLnRpdGxlfWA7XG4gICAgfVxuICAgIC8vIHJlbW92ZSBodHRwKHMpOi8vXG4gICAgbGV0IGRvbWFpbiA9IG1ldGEucGF0aC5yZXBsYWNlKC8oXlxcdys6fF4pXFwvXFwvLywgXCJcIik7XG4gICAgLy8gc2VwYXJhdGUgZG9tYWluIGZyb20gcGF0aFxuICAgIGRvbWFpbiA9IGRvbWFpbi5zcGxpdChcIi9cIilbMF07XG4gICAgLy8gd3JhcCBkb21haW4gaW4gPHNtYWxsPiBhbmQgYWRkIGxpbmUgYnJlYWtcbiAgICByZXR1cm4gYDxzbWFsbD5cdUQ4M0NcdURGMTAgJHtkb21haW59PC9zbWFsbD48YnI+JHttZXRhLnRpdGxlfWA7XG4gIH1cbiAgLy8gZ2V0IGFsbCBmb2xkZXJzXG4gIGFzeW5jIGdldF9hbGxfZm9sZGVycygpIHtcbiAgICBpZighdGhpcy5mb2xkZXJzIHx8IHRoaXMuZm9sZGVycy5sZW5ndGggPT09IDApe1xuICAgICAgdGhpcy5mb2xkZXJzID0gYXdhaXQgdGhpcy5nZXRfZm9sZGVycygpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5mb2xkZXJzO1xuICB9XG4gIC8vIGdldCBmb2xkZXJzLCB0cmF2ZXJzZSBub24taGlkZGVuIHN1Yi1mb2xkZXJzXG4gIGFzeW5jIGdldF9mb2xkZXJzKHBhdGggPSBcIi9cIikge1xuICAgIGxldCBmb2xkZXJzID0gKGF3YWl0IHRoaXMuYXBwLnZhdWx0LmFkYXB0ZXIubGlzdChwYXRoKSkuZm9sZGVycztcbiAgICBsZXQgZm9sZGVyX2xpc3QgPSBbXTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGZvbGRlcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmIChmb2xkZXJzW2ldLnN0YXJ0c1dpdGgoXCIuXCIpKSBjb250aW51ZTtcbiAgICAgIGZvbGRlcl9saXN0LnB1c2goZm9sZGVyc1tpXSk7XG4gICAgICBmb2xkZXJfbGlzdCA9IGZvbGRlcl9saXN0LmNvbmNhdChhd2FpdCB0aGlzLmdldF9mb2xkZXJzKGZvbGRlcnNbaV0gKyBcIi9cIikpO1xuICAgIH1cbiAgICByZXR1cm4gZm9sZGVyX2xpc3Q7XG4gIH1cblxuXG4gIGFzeW5jIHN5bmNfbm90ZXMoKSB7XG4gICAgLy8gaWYgbGljZW5zZSBrZXkgaXMgbm90IHNldCwgcmV0dXJuXG4gICAgaWYoIXRoaXMuc2V0dGluZ3MubGljZW5zZV9rZXkpe1xuICAgICAgbmV3IE9ic2lkaWFuLk5vdGljZShcIlNtYXJ0IENvbm5lY3Rpb25zOiBTdXBwb3J0ZXIgbGljZW5zZSBrZXkgaXMgcmVxdWlyZWQgdG8gc3luYyBub3RlcyB0byB0aGUgQ2hhdEdQVCBQbHVnaW4gc2VydmVyLlwiKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgY29uc29sZS5sb2coXCJzeW5jaW5nIG5vdGVzXCIpO1xuICAgIC8vIGdldCBhbGwgZmlsZXMgaW4gdmF1bHRcbiAgICBjb25zdCBmaWxlcyA9IHRoaXMuYXBwLnZhdWx0LmdldE1hcmtkb3duRmlsZXMoKS5maWx0ZXIoKGZpbGUpID0+IHtcbiAgICAgIC8vIGZpbHRlciBvdXQgZmlsZSBwYXRocyBtYXRjaGluZyBhbnkgc3RyaW5ncyBpbiB0aGlzLmZpbGVfZXhjbHVzaW9uc1xuICAgICAgZm9yKGxldCBpID0gMDsgaSA8IHRoaXMuZmlsZV9leGNsdXNpb25zLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGlmKGZpbGUucGF0aC5pbmRleE9mKHRoaXMuZmlsZV9leGNsdXNpb25zW2ldKSA+IC0xKSB7XG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9KTtcbiAgICBjb25zdCBub3RlcyA9IGF3YWl0IHRoaXMuYnVpbGRfbm90ZXNfb2JqZWN0KGZpbGVzKTtcbiAgICBjb25zb2xlLmxvZyhcIm9iamVjdCBidWlsdFwiKTtcbiAgICAvLyBzYXZlIG5vdGVzIG9iamVjdCB0byAuc21hcnQtY29ubmVjdGlvbnMvbm90ZXMuanNvblxuICAgIGF3YWl0IHRoaXMuYXBwLnZhdWx0LmFkYXB0ZXIud3JpdGUoXCIuc21hcnQtY29ubmVjdGlvbnMvbm90ZXMuanNvblwiLCBKU09OLnN0cmluZ2lmeShub3RlcywgbnVsbCwgMikpO1xuICAgIGNvbnNvbGUubG9nKFwibm90ZXMgc2F2ZWRcIik7XG4gICAgY29uc29sZS5sb2codGhpcy5zZXR0aW5ncy5saWNlbnNlX2tleSk7XG4gICAgLy8gUE9TVCBub3RlcyBvYmplY3QgdG8gc2VydmVyXG4gICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCAoMCwgT2JzaWRpYW4ucmVxdWVzdFVybCkoe1xuICAgICAgdXJsOiBcImh0dHBzOi8vc3luYy5zbWFydGNvbm5lY3Rpb25zLmFwcC9zeW5jXCIsXG4gICAgICBtZXRob2Q6IFwiUE9TVFwiLFxuICAgICAgaGVhZGVyczoge1xuICAgICAgICBcIkNvbnRlbnQtVHlwZVwiOiBcImFwcGxpY2F0aW9uL2pzb25cIixcbiAgICAgIH0sXG4gICAgICBjb250ZW50VHlwZTogXCJhcHBsaWNhdGlvbi9qc29uXCIsXG4gICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgIGxpY2Vuc2Vfa2V5OiB0aGlzLnNldHRpbmdzLmxpY2Vuc2Vfa2V5LFxuICAgICAgICBub3Rlczogbm90ZXNcbiAgICAgIH0pXG4gICAgfSk7XG4gICAgY29uc29sZS5sb2cocmVzcG9uc2UpO1xuXG4gIH1cblxuICBhc3luYyBidWlsZF9ub3Rlc19vYmplY3QoZmlsZXMpIHtcbiAgICBsZXQgb3V0cHV0ID0ge307XG4gIFxuICAgIGZvcihsZXQgaSA9IDA7IGkgPCBmaWxlcy5sZW5ndGg7IGkrKykge1xuICAgICAgbGV0IGZpbGUgPSBmaWxlc1tpXTtcbiAgICAgIGxldCBwYXJ0cyA9IGZpbGUucGF0aC5zcGxpdChcIi9cIik7XG4gICAgICBsZXQgY3VycmVudCA9IG91dHB1dDtcbiAgXG4gICAgICBmb3IgKGxldCBpaSA9IDA7IGlpIDwgcGFydHMubGVuZ3RoOyBpaSsrKSB7XG4gICAgICAgIGxldCBwYXJ0ID0gcGFydHNbaWldO1xuICBcbiAgICAgICAgaWYgKGlpID09PSBwYXJ0cy5sZW5ndGggLSAxKSB7XG4gICAgICAgICAgLy8gVGhpcyBpcyBhIGZpbGVcbiAgICAgICAgICBjdXJyZW50W3BhcnRdID0gYXdhaXQgdGhpcy5hcHAudmF1bHQuY2FjaGVkUmVhZChmaWxlKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBUaGlzIGlzIGEgZGlyZWN0b3J5XG4gICAgICAgICAgaWYgKCFjdXJyZW50W3BhcnRdKSB7XG4gICAgICAgICAgICBjdXJyZW50W3BhcnRdID0ge307XG4gICAgICAgICAgfVxuICBcbiAgICAgICAgICBjdXJyZW50ID0gY3VycmVudFtwYXJ0XTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgXG4gICAgcmV0dXJuIG91dHB1dDtcbiAgfVxuXG59XG5cbmNvbnN0IFNNQVJUX0NPTk5FQ1RJT05TX1ZJRVdfVFlQRSA9IFwic21hcnQtY29ubmVjdGlvbnMtdmlld1wiO1xuY2xhc3MgU21hcnRDb25uZWN0aW9uc1ZpZXcgZXh0ZW5kcyBPYnNpZGlhbi5JdGVtVmlldyB7XG4gIGNvbnN0cnVjdG9yKGxlYWYsIHBsdWdpbikge1xuICAgIHN1cGVyKGxlYWYpO1xuICAgIHRoaXMucGx1Z2luID0gcGx1Z2luO1xuICAgIHRoaXMubmVhcmVzdCA9IG51bGw7XG4gICAgdGhpcy5sb2FkX3dhaXQgPSBudWxsO1xuICB9XG4gIGdldFZpZXdUeXBlKCkge1xuICAgIHJldHVybiBTTUFSVF9DT05ORUNUSU9OU19WSUVXX1RZUEU7XG4gIH1cblxuICBnZXREaXNwbGF5VGV4dCgpIHtcbiAgICByZXR1cm4gXCJTbWFydCBDb25uZWN0aW9ucyBGaWxlc1wiO1xuICB9XG5cbiAgZ2V0SWNvbigpIHtcbiAgICByZXR1cm4gXCJzbWFydC1jb25uZWN0aW9uc1wiO1xuICB9XG5cblxuICBzZXRfbWVzc2FnZShtZXNzYWdlKSB7XG4gICAgY29uc3QgY29udGFpbmVyID0gdGhpcy5jb250YWluZXJFbC5jaGlsZHJlblsxXTtcbiAgICAvLyBjbGVhciBjb250YWluZXJcbiAgICBjb250YWluZXIuZW1wdHkoKTtcbiAgICAvLyBpbml0aWF0ZSB0b3AgYmFyXG4gICAgdGhpcy5pbml0aWF0ZV90b3BfYmFyKGNvbnRhaW5lcik7XG4gICAgLy8gaWYgbWVzYWdlIGlzIGFuIGFycmF5LCBsb29wIHRocm91Z2ggYW5kIGNyZWF0ZSBhIG5ldyBwIGVsZW1lbnQgZm9yIGVhY2ggbWVzc2FnZVxuICAgIGlmIChBcnJheS5pc0FycmF5KG1lc3NhZ2UpKSB7XG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG1lc3NhZ2UubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgY29udGFpbmVyLmNyZWF0ZUVsKFwicFwiLCB7IGNsczogXCJzY19tZXNzYWdlXCIsIHRleHQ6IG1lc3NhZ2VbaV0gfSk7XG4gICAgICB9XG4gICAgfWVsc2V7XG4gICAgICAvLyBjcmVhdGUgcCBlbGVtZW50IHdpdGggbWVzc2FnZVxuICAgICAgY29udGFpbmVyLmNyZWF0ZUVsKFwicFwiLCB7IGNsczogXCJzY19tZXNzYWdlXCIsIHRleHQ6IG1lc3NhZ2UgfSk7XG4gICAgfVxuICB9XG4gIHJlbmRlcl9saW5rX3RleHQobGluaywgc2hvd19mdWxsX3BhdGg9ZmFsc2UpIHtcbiAgICAvKipcbiAgICAgKiBCZWdpbiBpbnRlcm5hbCBsaW5rc1xuICAgICAqL1xuICAgIC8vIGlmIHNob3cgZnVsbCBwYXRoIGlzIGZhbHNlLCByZW1vdmUgZmlsZSBwYXRoXG4gICAgaWYgKCFzaG93X2Z1bGxfcGF0aCkge1xuICAgICAgbGluayA9IGxpbmsuc3BsaXQoXCIvXCIpLnBvcCgpO1xuICAgIH1cbiAgICAvLyBpZiBjb250YWlucyAnIydcbiAgICBpZiAobGluay5pbmRleE9mKFwiI1wiKSA+IC0xKSB7XG4gICAgICAvLyBzcGxpdCBhdCAubWRcbiAgICAgIGxpbmsgPSBsaW5rLnNwbGl0KFwiLm1kXCIpO1xuICAgICAgLy8gd3JhcCBmaXJzdCBwYXJ0IGluIDxzbWFsbD4gYW5kIGFkZCBsaW5lIGJyZWFrXG4gICAgICBsaW5rWzBdID0gYDxzbWFsbD4ke2xpbmtbMF19PC9zbWFsbD48YnI+YDtcbiAgICAgIC8vIGpvaW4gYmFjayB0b2dldGhlclxuICAgICAgbGluayA9IGxpbmsuam9pbihcIlwiKTtcbiAgICAgIC8vIHJlcGxhY2UgJyMnIHdpdGggJyBcdTAwQkIgJ1xuICAgICAgbGluayA9IGxpbmsucmVwbGFjZSgvXFwjL2csIFwiIFx1MDBCQiBcIik7XG4gICAgfWVsc2V7XG4gICAgICAvLyByZW1vdmUgJy5tZCdcbiAgICAgIGxpbmsgPSBsaW5rLnJlcGxhY2UoXCIubWRcIiwgXCJcIik7XG4gICAgfVxuICAgIHJldHVybiBsaW5rO1xuICB9XG5cblxuICBzZXRfbmVhcmVzdChuZWFyZXN0LCBuZWFyZXN0X2NvbnRleHQ9bnVsbCwgcmVzdWx0c19vbmx5PWZhbHNlKSB7XG4gICAgLy8gZ2V0IGNvbnRhaW5lciBlbGVtZW50XG4gICAgY29uc3QgY29udGFpbmVyID0gdGhpcy5jb250YWluZXJFbC5jaGlsZHJlblsxXTtcbiAgICAvLyBpZiByZXN1bHRzIG9ubHkgaXMgZmFsc2UsIGNsZWFyIGNvbnRhaW5lciBhbmQgaW5pdGlhdGUgdG9wIGJhclxuICAgIGlmKCFyZXN1bHRzX29ubHkpe1xuICAgICAgLy8gY2xlYXIgY29udGFpbmVyXG4gICAgICBjb250YWluZXIuZW1wdHkoKTtcbiAgICAgIHRoaXMuaW5pdGlhdGVfdG9wX2Jhcihjb250YWluZXIsIG5lYXJlc3RfY29udGV4dCk7XG4gICAgfVxuICAgIC8vIHVwZGF0ZSByZXN1bHRzXG4gICAgdGhpcy5wbHVnaW4udXBkYXRlX3Jlc3VsdHMoY29udGFpbmVyLCBuZWFyZXN0KTtcbiAgfVxuXG4gIGluaXRpYXRlX3RvcF9iYXIoY29udGFpbmVyLCBuZWFyZXN0X2NvbnRleHQ9bnVsbCkge1xuICAgIGxldCB0b3BfYmFyO1xuICAgIC8vIGlmIHRvcCBiYXIgYWxyZWFkeSBleGlzdHMsIGVtcHR5IGl0XG4gICAgaWYgKChjb250YWluZXIuY2hpbGRyZW4ubGVuZ3RoID4gMCkgJiYgKGNvbnRhaW5lci5jaGlsZHJlblswXS5jbGFzc0xpc3QuY29udGFpbnMoXCJzYy10b3AtYmFyXCIpKSkge1xuICAgICAgdG9wX2JhciA9IGNvbnRhaW5lci5jaGlsZHJlblswXTtcbiAgICAgIHRvcF9iYXIuZW1wdHkoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gaW5pdCBjb250YWluZXIgZm9yIHRvcCBiYXJcbiAgICAgIHRvcF9iYXIgPSBjb250YWluZXIuY3JlYXRlRWwoXCJkaXZcIiwgeyBjbHM6IFwic2MtdG9wLWJhclwiIH0pO1xuICAgIH1cbiAgICAvLyBpZiBoaWdobGlnaHRlZCB0ZXh0IGlzIG5vdCBudWxsLCBjcmVhdGUgcCBlbGVtZW50IHdpdGggaGlnaGxpZ2h0ZWQgdGV4dFxuICAgIGlmIChuZWFyZXN0X2NvbnRleHQpIHtcbiAgICAgIHRvcF9iYXIuY3JlYXRlRWwoXCJwXCIsIHsgY2xzOiBcInNjLWNvbnRleHRcIiwgdGV4dDogbmVhcmVzdF9jb250ZXh0IH0pO1xuICAgIH1cbiAgICAvLyBhZGQgY2hhdCBidXR0b25cbiAgICBjb25zdCBjaGF0X2J1dHRvbiA9IHRvcF9iYXIuY3JlYXRlRWwoXCJidXR0b25cIiwgeyBjbHM6IFwic2MtY2hhdC1idXR0b25cIiB9KTtcbiAgICAvLyBhZGQgaWNvbiB0byBjaGF0IGJ1dHRvblxuICAgIE9ic2lkaWFuLnNldEljb24oY2hhdF9idXR0b24sIFwibWVzc2FnZS1zcXVhcmVcIik7XG4gICAgLy8gYWRkIGNsaWNrIGxpc3RlbmVyIHRvIGNoYXQgYnV0dG9uXG4gICAgY2hhdF9idXR0b24uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHtcbiAgICAgIC8vIG9wZW4gY2hhdFxuICAgICAgdGhpcy5wbHVnaW4ub3Blbl9jaGF0KCk7XG4gICAgfSk7XG4gICAgLy8gYWRkIHNlYXJjaCBidXR0b25cbiAgICBjb25zdCBzZWFyY2hfYnV0dG9uID0gdG9wX2Jhci5jcmVhdGVFbChcImJ1dHRvblwiLCB7IGNsczogXCJzYy1zZWFyY2gtYnV0dG9uXCIgfSk7XG4gICAgLy8gYWRkIGljb24gdG8gc2VhcmNoIGJ1dHRvblxuICAgIE9ic2lkaWFuLnNldEljb24oc2VhcmNoX2J1dHRvbiwgXCJzZWFyY2hcIik7XG4gICAgLy8gYWRkIGNsaWNrIGxpc3RlbmVyIHRvIHNlYXJjaCBidXR0b25cbiAgICBzZWFyY2hfYnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiB7XG4gICAgICAvLyBlbXB0eSB0b3AgYmFyXG4gICAgICB0b3BfYmFyLmVtcHR5KCk7XG4gICAgICAvLyBjcmVhdGUgaW5wdXQgZWxlbWVudFxuICAgICAgY29uc3Qgc2VhcmNoX2NvbnRhaW5lciA9IHRvcF9iYXIuY3JlYXRlRWwoXCJkaXZcIiwgeyBjbHM6IFwic2VhcmNoLWlucHV0LWNvbnRhaW5lclwiIH0pO1xuICAgICAgY29uc3QgaW5wdXQgPSBzZWFyY2hfY29udGFpbmVyLmNyZWF0ZUVsKFwiaW5wdXRcIiwge1xuICAgICAgICBjbHM6IFwic2Mtc2VhcmNoLWlucHV0XCIsXG4gICAgICAgIHR5cGU6IFwic2VhcmNoXCIsXG4gICAgICAgIHBsYWNlaG9sZGVyOiBcIlR5cGUgdG8gc3RhcnQgc2VhcmNoLi4uXCIsIFxuICAgICAgfSk7XG4gICAgICAvLyBmb2N1cyBpbnB1dFxuICAgICAgaW5wdXQuZm9jdXMoKTtcbiAgICAgIC8vIGFkZCBrZXlkb3duIGxpc3RlbmVyIHRvIGlucHV0XG4gICAgICBpbnB1dC5hZGRFdmVudExpc3RlbmVyKFwia2V5ZG93blwiLCAoZXZlbnQpID0+IHtcbiAgICAgICAgLy8gaWYgZXNjYXBlIGtleSBpcyBwcmVzc2VkXG4gICAgICAgIGlmIChldmVudC5rZXkgPT09IFwiRXNjYXBlXCIpIHtcbiAgICAgICAgICB0aGlzLmNsZWFyX2F1dG9fc2VhcmNoZXIoKTtcbiAgICAgICAgICAvLyBjbGVhciB0b3AgYmFyXG4gICAgICAgICAgdGhpcy5pbml0aWF0ZV90b3BfYmFyKGNvbnRhaW5lciwgbmVhcmVzdF9jb250ZXh0KTtcbiAgICAgICAgfVxuICAgICAgfSk7XG5cbiAgICAgIC8vIGFkZCBrZXl1cCBsaXN0ZW5lciB0byBpbnB1dFxuICAgICAgaW5wdXQuYWRkRXZlbnRMaXN0ZW5lcihcImtleXVwXCIsIChldmVudCkgPT4ge1xuICAgICAgICAvLyBpZiB0aGlzLnNlYXJjaF90aW1lb3V0IGlzIG5vdCBudWxsIHRoZW4gY2xlYXIgaXQgYW5kIHNldCB0byBudWxsXG4gICAgICAgIHRoaXMuY2xlYXJfYXV0b19zZWFyY2hlcigpO1xuICAgICAgICAvLyBnZXQgc2VhcmNoIHRlcm1cbiAgICAgICAgY29uc3Qgc2VhcmNoX3Rlcm0gPSBpbnB1dC52YWx1ZTtcbiAgICAgICAgLy8gaWYgZW50ZXIga2V5IGlzIHByZXNzZWRcbiAgICAgICAgaWYgKGV2ZW50LmtleSA9PT0gXCJFbnRlclwiICYmIHNlYXJjaF90ZXJtICE9PSBcIlwiKSB7XG4gICAgICAgICAgdGhpcy5zZWFyY2goc2VhcmNoX3Rlcm0pO1xuICAgICAgICB9XG4gICAgICAgIC8vIGlmIGFueSBvdGhlciBrZXkgaXMgcHJlc3NlZCBhbmQgaW5wdXQgaXMgbm90IGVtcHR5IHRoZW4gd2FpdCA1MDBtcyBhbmQgbWFrZV9jb25uZWN0aW9uc1xuICAgICAgICBlbHNlIGlmIChzZWFyY2hfdGVybSAhPT0gXCJcIikge1xuICAgICAgICAgIC8vIGNsZWFyIHRpbWVvdXRcbiAgICAgICAgICBjbGVhclRpbWVvdXQodGhpcy5zZWFyY2hfdGltZW91dCk7XG4gICAgICAgICAgLy8gc2V0IHRpbWVvdXRcbiAgICAgICAgICB0aGlzLnNlYXJjaF90aW1lb3V0ID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgICAgICB0aGlzLnNlYXJjaChzZWFyY2hfdGVybSwgdHJ1ZSk7XG4gICAgICAgICAgfSwgNzAwKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cblxuICAvLyByZW5kZXIgYnV0dG9uczogXCJjcmVhdGVcIiBhbmQgXCJyZXRyeVwiIGZvciBsb2FkaW5nIGVtYmVkZGluZ3MuanNvbiBmaWxlXG4gIHJlbmRlcl9lbWJlZGRpbmdzX2J1dHRvbnMoKSB7XG4gICAgLy8gZ2V0IGNvbnRhaW5lciBlbGVtZW50XG4gICAgY29uc3QgY29udGFpbmVyID0gdGhpcy5jb250YWluZXJFbC5jaGlsZHJlblsxXTtcbiAgICAvLyBjbGVhciBjb250YWluZXJcbiAgICBjb250YWluZXIuZW1wdHkoKTtcbiAgICAvLyBjcmVhdGUgaGVhZGluZyB0aGF0IHNheXMgXCJFbWJlZGRpbmdzIGZpbGUgbm90IGZvdW5kXCJcbiAgICBjb250YWluZXIuY3JlYXRlRWwoXCJoMlwiLCB7IGNsczogXCJzY0hlYWRpbmdcIiwgdGV4dDogXCJFbWJlZGRpbmdzIGZpbGUgbm90IGZvdW5kXCIgfSk7XG4gICAgLy8gY3JlYXRlIGRpdiBmb3IgYnV0dG9uc1xuICAgIGNvbnN0IGJ1dHRvbl9kaXYgPSBjb250YWluZXIuY3JlYXRlRWwoXCJkaXZcIiwgeyBjbHM6IFwic2NCdXR0b25EaXZcIiB9KTtcbiAgICAvLyBjcmVhdGUgXCJjcmVhdGVcIiBidXR0b25cbiAgICBjb25zdCBjcmVhdGVfYnV0dG9uID0gYnV0dG9uX2Rpdi5jcmVhdGVFbChcImJ1dHRvblwiLCB7IGNsczogXCJzY0J1dHRvblwiLCB0ZXh0OiBcIkNyZWF0ZSBlbWJlZGRpbmdzLmpzb25cIiB9KTtcbiAgICAvLyBub3RlIHRoYXQgY3JlYXRpbmcgZW1iZWRkaW5ncy5qc29uIGZpbGUgd2lsbCB0cmlnZ2VyIGJ1bGsgZW1iZWRkaW5nIGFuZCBtYXkgdGFrZSBhIHdoaWxlXG4gICAgYnV0dG9uX2Rpdi5jcmVhdGVFbChcInBcIiwgeyBjbHM6IFwic2NCdXR0b25Ob3RlXCIsIHRleHQ6IFwiV2FybmluZzogQ3JlYXRpbmcgZW1iZWRkaW5ncy5qc29uIGZpbGUgd2lsbCB0cmlnZ2VyIGJ1bGsgZW1iZWRkaW5nIGFuZCBtYXkgdGFrZSBhIHdoaWxlXCIgfSk7XG4gICAgLy8gY3JlYXRlIFwicmV0cnlcIiBidXR0b25cbiAgICBjb25zdCByZXRyeV9idXR0b24gPSBidXR0b25fZGl2LmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHsgY2xzOiBcInNjQnV0dG9uXCIsIHRleHQ6IFwiUmV0cnlcIiB9KTtcbiAgICAvLyB0cnkgdG8gbG9hZCBlbWJlZGRpbmdzLmpzb24gZmlsZSBhZ2FpblxuICAgIGJ1dHRvbl9kaXYuY3JlYXRlRWwoXCJwXCIsIHsgY2xzOiBcInNjQnV0dG9uTm90ZVwiLCB0ZXh0OiBcIklmIGVtYmVkZGluZ3MuanNvbiBmaWxlIGFscmVhZHkgZXhpc3RzLCBjbGljayAnUmV0cnknIHRvIGxvYWQgaXRcIiB9KTtcblxuICAgIC8vIGFkZCBjbGljayBldmVudCB0byBcImNyZWF0ZVwiIGJ1dHRvblxuICAgIGNyZWF0ZV9idXR0b24uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIGFzeW5jIChldmVudCkgPT4ge1xuICAgICAgLy8gY3JlYXRlIGVtYmVkZGluZ3MuanNvbiBmaWxlXG4gICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zbWFydF92ZWNfbGl0ZS5pbml0X2VtYmVkZGluZ3NfZmlsZSgpO1xuICAgICAgLy8gcmVsb2FkIHZpZXdcbiAgICAgIGF3YWl0IHRoaXMucmVuZGVyX2Nvbm5lY3Rpb25zKCk7XG4gICAgfSk7XG5cbiAgICAvLyBhZGQgY2xpY2sgZXZlbnQgdG8gXCJyZXRyeVwiIGJ1dHRvblxuICAgIHJldHJ5X2J1dHRvbi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgYXN5bmMgKGV2ZW50KSA9PiB7XG4gICAgICBjb25zb2xlLmxvZyhcInJldHJ5aW5nIHRvIGxvYWQgZW1iZWRkaW5ncy5qc29uIGZpbGVcIik7XG4gICAgICAvLyByZWxvYWQgZW1iZWRkaW5ncy5qc29uIGZpbGVcbiAgICAgIGF3YWl0IHRoaXMucGx1Z2luLmluaXRfdmVjcygpO1xuICAgICAgLy8gcmVsb2FkIHZpZXdcbiAgICAgIGF3YWl0IHRoaXMucmVuZGVyX2Nvbm5lY3Rpb25zKCk7XG4gICAgfSk7XG4gIH1cblxuICBhc3luYyBvbk9wZW4oKSB7XG4gICAgY29uc3QgY29udGFpbmVyID0gdGhpcy5jb250YWluZXJFbC5jaGlsZHJlblsxXTtcbiAgICBjb250YWluZXIuZW1wdHkoKTtcbiAgICAvLyBwbGFjZWhvbGRlciB0ZXh0XG4gICAgY29udGFpbmVyLmNyZWF0ZUVsKFwicFwiLCB7IGNsczogXCJzY1BsYWNlaG9sZGVyXCIsIHRleHQ6IFwiT3BlbiBhIG5vdGUgdG8gZmluZCBjb25uZWN0aW9ucy5cIiB9KTsgXG5cbiAgICAvLyBydW5zIHdoZW4gZmlsZSBpcyBvcGVuZWRcbiAgICB0aGlzLnBsdWdpbi5yZWdpc3RlckV2ZW50KHRoaXMuYXBwLndvcmtzcGFjZS5vbignZmlsZS1vcGVuJywgKGZpbGUpID0+IHtcbiAgICAgIC8vIGlmIG5vIGZpbGUgaXMgb3BlbiwgcmV0dXJuXG4gICAgICBpZighZmlsZSkge1xuICAgICAgICAvLyBjb25zb2xlLmxvZyhcIm5vIGZpbGUgb3BlbiwgcmV0dXJuaW5nXCIpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICAvLyByZXR1cm4gaWYgZmlsZSB0eXBlIGlzIG5vdCBzdXBwb3J0ZWRcbiAgICAgIGlmKFNVUFBPUlRFRF9GSUxFX1RZUEVTLmluZGV4T2YoZmlsZS5leHRlbnNpb24pID09PSAtMSkge1xuICAgICAgICByZXR1cm4gdGhpcy5zZXRfbWVzc2FnZShbXG4gICAgICAgICAgXCJGaWxlOiBcIitmaWxlLm5hbWVcbiAgICAgICAgICAsXCJVbnN1cHBvcnRlZCBmaWxlIHR5cGUgKFN1cHBvcnRlZDogXCIrU1VQUE9SVEVEX0ZJTEVfVFlQRVMuam9pbihcIiwgXCIpK1wiKVwiXG4gICAgICAgIF0pO1xuICAgICAgfVxuICAgICAgLy8gcnVuIHJlbmRlcl9jb25uZWN0aW9ucyBhZnRlciAxIHNlY29uZCB0byBhbGxvdyBmb3IgZmlsZSB0byBsb2FkXG4gICAgICBpZih0aGlzLmxvYWRfd2FpdCl7XG4gICAgICAgIGNsZWFyVGltZW91dCh0aGlzLmxvYWRfd2FpdCk7XG4gICAgICB9XG4gICAgICB0aGlzLmxvYWRfd2FpdCA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICB0aGlzLnJlbmRlcl9jb25uZWN0aW9ucyhmaWxlKTtcbiAgICAgICAgdGhpcy5sb2FkX3dhaXQgPSBudWxsO1xuICAgICAgfSwgMTAwMCk7XG4gICAgICAgIFxuICAgIH0pKTtcblxuICAgIHRoaXMuYXBwLndvcmtzcGFjZS5yZWdpc3RlckhvdmVyTGlua1NvdXJjZShTTUFSVF9DT05ORUNUSU9OU19WSUVXX1RZUEUsIHtcbiAgICAgICAgZGlzcGxheTogJ1NtYXJ0IENvbm5lY3Rpb25zIEZpbGVzJyxcbiAgICAgICAgZGVmYXVsdE1vZDogdHJ1ZSxcbiAgICB9KTtcbiAgICB0aGlzLmFwcC53b3Jrc3BhY2UucmVnaXN0ZXJIb3ZlckxpbmtTb3VyY2UoU01BUlRfQ09OTkVDVElPTlNfQ0hBVF9WSUVXX1RZUEUsIHtcbiAgICAgICAgZGlzcGxheTogJ1NtYXJ0IENoYXQgTGlua3MnLFxuICAgICAgICBkZWZhdWx0TW9kOiB0cnVlLFxuICAgIH0pO1xuXG4gICAgdGhpcy5hcHAud29ya3NwYWNlLm9uTGF5b3V0UmVhZHkodGhpcy5pbml0aWFsaXplLmJpbmQodGhpcykpO1xuICAgIFxuICB9XG4gIFxuICBhc3luYyBpbml0aWFsaXplKCkge1xuICAgIHRoaXMuc2V0X21lc3NhZ2UoXCJMb2FkaW5nIGVtYmVkZGluZ3MgZmlsZS4uLlwiKTtcbiAgICBjb25zdCB2ZWNzX2ludGlhdGVkID0gYXdhaXQgdGhpcy5wbHVnaW4uaW5pdF92ZWNzKCk7XG4gICAgaWYodmVjc19pbnRpYXRlZCl7XG4gICAgICB0aGlzLnNldF9tZXNzYWdlKFwiRW1iZWRkaW5ncyBmaWxlIGxvYWRlZC5cIik7XG4gICAgICBhd2FpdCB0aGlzLnJlbmRlcl9jb25uZWN0aW9ucygpO1xuICAgIH1lbHNle1xuICAgICAgdGhpcy5yZW5kZXJfZW1iZWRkaW5nc19idXR0b25zKCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRVhQRVJJTUVOVEFMXG4gICAgICogLSB3aW5kb3ctYmFzZWQgQVBJIGFjY2Vzc1xuICAgICAqIC0gY29kZS1ibG9jayByZW5kZXJpbmdcbiAgICAgKi9cbiAgICB0aGlzLmFwaSA9IG5ldyBTbWFydENvbm5lY3Rpb25zVmlld0FwaSh0aGlzLmFwcCwgdGhpcy5wbHVnaW4sIHRoaXMpO1xuICAgIC8vIHJlZ2lzdGVyIEFQSSB0byBnbG9iYWwgd2luZG93IG9iamVjdFxuICAgICh3aW5kb3dbXCJTbWFydENvbm5lY3Rpb25zVmlld0FwaVwiXSA9IHRoaXMuYXBpKSAmJiB0aGlzLnJlZ2lzdGVyKCgpID0+IGRlbGV0ZSB3aW5kb3dbXCJTbWFydENvbm5lY3Rpb25zVmlld0FwaVwiXSk7XG5cbiAgfVxuXG4gIGFzeW5jIG9uQ2xvc2UoKSB7XG4gICAgY29uc29sZS5sb2coXCJjbG9zaW5nIHNtYXJ0IGNvbm5lY3Rpb25zIHZpZXdcIik7XG4gICAgdGhpcy5hcHAud29ya3NwYWNlLnVucmVnaXN0ZXJIb3ZlckxpbmtTb3VyY2UoU01BUlRfQ09OTkVDVElPTlNfVklFV19UWVBFKTtcbiAgICB0aGlzLnBsdWdpbi52aWV3ID0gbnVsbDtcbiAgfVxuXG4gIGFzeW5jIHJlbmRlcl9jb25uZWN0aW9ucyhjb250ZXh0PW51bGwpIHtcbiAgICBjb25zb2xlLmxvZyhcInJlbmRlcmluZyBjb25uZWN0aW9uc1wiKTtcbiAgICAvLyBpZiBBUEkga2V5IGlzIG5vdCBzZXQgdGhlbiB1cGRhdGUgdmlldyBtZXNzYWdlXG4gICAgaWYoIXRoaXMucGx1Z2luLnNldHRpbmdzLmFwaV9rZXkpIHtcbiAgICAgIHRoaXMuc2V0X21lc3NhZ2UoXCJBbiBPcGVuQUkgQVBJIGtleSBpcyByZXF1aXJlZCB0byBtYWtlIFNtYXJ0IENvbm5lY3Rpb25zXCIpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBpZighdGhpcy5wbHVnaW4uZW1iZWRkaW5nc19sb2FkZWQpe1xuICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uaW5pdF92ZWNzKCk7XG4gICAgfVxuICAgIC8vIGlmIGVtYmVkZGluZyBzdGlsbCBub3QgbG9hZGVkLCByZXR1cm5cbiAgICBpZighdGhpcy5wbHVnaW4uZW1iZWRkaW5nc19sb2FkZWQpIHtcbiAgICAgIGNvbnNvbGUubG9nKFwiZW1iZWRkaW5ncyBmaWxlcyBzdGlsbCBub3QgbG9hZGVkIG9yIHlldCB0byBiZSBjcmVhdGVkXCIpO1xuICAgICAgdGhpcy5yZW5kZXJfZW1iZWRkaW5nc19idXR0b25zKCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIHRoaXMuc2V0X21lc3NhZ2UoXCJNYWtpbmcgU21hcnQgQ29ubmVjdGlvbnMuLi5cIik7XG4gICAgLyoqXG4gICAgICogQmVnaW4gaGlnaGxpZ2h0ZWQtdGV4dC1sZXZlbCBzZWFyY2hcbiAgICAgKi9cbiAgICBpZih0eXBlb2YgY29udGV4dCA9PT0gXCJzdHJpbmdcIikge1xuICAgICAgY29uc3QgaGlnaGxpZ2h0ZWRfdGV4dCA9IGNvbnRleHQ7XG4gICAgICAvLyBnZXQgZW1iZWRkaW5nIGZvciBoaWdobGlnaHRlZCB0ZXh0XG4gICAgICBhd2FpdCB0aGlzLnNlYXJjaChoaWdobGlnaHRlZF90ZXh0KTtcbiAgICAgIHJldHVybjsgLy8gZW5kcyBoZXJlIGlmIGNvbnRleHQgaXMgYSBzdHJpbmdcbiAgICB9XG5cbiAgICAvKiogXG4gICAgICogQmVnaW4gZmlsZS1sZXZlbCBzZWFyY2hcbiAgICAgKi8gICAgXG4gICAgdGhpcy5uZWFyZXN0ID0gbnVsbDtcbiAgICB0aGlzLmludGVydmFsX2NvdW50ID0gMDtcbiAgICB0aGlzLnJlbmRlcmluZyA9IGZhbHNlO1xuICAgIHRoaXMuZmlsZSA9IGNvbnRleHQ7XG4gICAgLy8gaWYgdGhpcy5pbnRlcnZhbCBpcyBzZXQgdGhlbiBjbGVhciBpdFxuICAgIGlmKHRoaXMuaW50ZXJ2YWwpIHtcbiAgICAgIGNsZWFySW50ZXJ2YWwodGhpcy5pbnRlcnZhbCk7XG4gICAgICB0aGlzLmludGVydmFsID0gbnVsbDtcbiAgICB9XG4gICAgLy8gc2V0IGludGVydmFsIHRvIGNoZWNrIGlmIG5lYXJlc3QgaXMgc2V0XG4gICAgdGhpcy5pbnRlcnZhbCA9IHNldEludGVydmFsKCgpID0+IHtcbiAgICAgIGlmKCF0aGlzLnJlbmRlcmluZyl7XG4gICAgICAgIGlmKHRoaXMuZmlsZSBpbnN0YW5jZW9mIE9ic2lkaWFuLlRGaWxlKSB7XG4gICAgICAgICAgdGhpcy5yZW5kZXJpbmcgPSB0cnVlO1xuICAgICAgICAgIHRoaXMucmVuZGVyX25vdGVfY29ubmVjdGlvbnModGhpcy5maWxlKTtcbiAgICAgICAgfWVsc2V7XG4gICAgICAgICAgLy8gZ2V0IGN1cnJlbnQgbm90ZVxuICAgICAgICAgIHRoaXMuZmlsZSA9IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRBY3RpdmVGaWxlKCk7XG4gICAgICAgICAgLy8gaWYgc3RpbGwgbm8gY3VycmVudCBub3RlIHRoZW4gcmV0dXJuXG4gICAgICAgICAgaWYoIXRoaXMuZmlsZSAmJiB0aGlzLmNvdW50ID4gMSkge1xuICAgICAgICAgICAgY2xlYXJJbnRlcnZhbCh0aGlzLmludGVydmFsKTtcbiAgICAgICAgICAgIHRoaXMuc2V0X21lc3NhZ2UoXCJObyBhY3RpdmUgZmlsZVwiKTtcbiAgICAgICAgICAgIHJldHVybjsgXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9ZWxzZXtcbiAgICAgICAgaWYodGhpcy5uZWFyZXN0KSB7XG4gICAgICAgICAgY2xlYXJJbnRlcnZhbCh0aGlzLmludGVydmFsKTtcbiAgICAgICAgICAvLyBpZiBuZWFyZXN0IGlzIGEgc3RyaW5nIHRoZW4gdXBkYXRlIHZpZXcgbWVzc2FnZVxuICAgICAgICAgIGlmICh0eXBlb2YgdGhpcy5uZWFyZXN0ID09PSBcInN0cmluZ1wiKSB7XG4gICAgICAgICAgICB0aGlzLnNldF9tZXNzYWdlKHRoaXMubmVhcmVzdCk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIHNldCBuZWFyZXN0IGNvbm5lY3Rpb25zXG4gICAgICAgICAgICB0aGlzLnNldF9uZWFyZXN0KHRoaXMubmVhcmVzdCwgXCJGaWxlOiBcIiArIHRoaXMuZmlsZS5uYW1lKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgLy8gaWYgcmVuZGVyX2xvZy5mYWlsZWRfZW1iZWRkaW5ncyB0aGVuIHVwZGF0ZSBmYWlsZWRfZW1iZWRkaW5ncy50eHRcbiAgICAgICAgICBpZiAodGhpcy5wbHVnaW4ucmVuZGVyX2xvZy5mYWlsZWRfZW1iZWRkaW5ncy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICB0aGlzLnBsdWdpbi5zYXZlX2ZhaWxlZF9lbWJlZGRpbmdzKCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIC8vIGdldCBvYmplY3Qga2V5cyBvZiByZW5kZXJfbG9nXG4gICAgICAgICAgdGhpcy5wbHVnaW4ub3V0cHV0X3JlbmRlcl9sb2coKTtcbiAgICAgICAgICByZXR1cm47IFxuICAgICAgICB9ZWxzZXtcbiAgICAgICAgICB0aGlzLmludGVydmFsX2NvdW50Kys7XG4gICAgICAgICAgdGhpcy5zZXRfbWVzc2FnZShcIk1ha2luZyBTbWFydCBDb25uZWN0aW9ucy4uLlwiK3RoaXMuaW50ZXJ2YWxfY291bnQpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSwgMTApO1xuICB9XG5cbiAgYXN5bmMgcmVuZGVyX25vdGVfY29ubmVjdGlvbnMoZmlsZSkge1xuICAgIHRoaXMubmVhcmVzdCA9IGF3YWl0IHRoaXMucGx1Z2luLmZpbmRfbm90ZV9jb25uZWN0aW9ucyhmaWxlKTtcbiAgfVxuXG4gIGNsZWFyX2F1dG9fc2VhcmNoZXIoKSB7XG4gICAgaWYgKHRoaXMuc2VhcmNoX3RpbWVvdXQpIHtcbiAgICAgIGNsZWFyVGltZW91dCh0aGlzLnNlYXJjaF90aW1lb3V0KTtcbiAgICAgIHRoaXMuc2VhcmNoX3RpbWVvdXQgPSBudWxsO1xuICAgIH1cbiAgfVxuXG4gIGFzeW5jIHNlYXJjaChzZWFyY2hfdGV4dCwgcmVzdWx0c19vbmx5PWZhbHNlKSB7XG4gICAgY29uc3QgbmVhcmVzdCA9IGF3YWl0IHRoaXMucGx1Z2luLmFwaS5zZWFyY2goc2VhcmNoX3RleHQpO1xuICAgIC8vIHJlbmRlciByZXN1bHRzIGluIHZpZXcgd2l0aCBmaXJzdCAxMDAgY2hhcmFjdGVycyBvZiBzZWFyY2ggdGV4dFxuICAgIGNvbnN0IG5lYXJlc3RfY29udGV4dCA9IGBTZWxlY3Rpb246IFwiJHtzZWFyY2hfdGV4dC5sZW5ndGggPiAxMDAgPyBzZWFyY2hfdGV4dC5zdWJzdHJpbmcoMCwgMTAwKSArIFwiLi4uXCIgOiBzZWFyY2hfdGV4dH1cImA7XG4gICAgdGhpcy5zZXRfbmVhcmVzdChuZWFyZXN0LCBuZWFyZXN0X2NvbnRleHQsIHJlc3VsdHNfb25seSk7XG4gIH1cblxufVxuY2xhc3MgU21hcnRDb25uZWN0aW9uc1ZpZXdBcGkge1xuICBjb25zdHJ1Y3RvcihhcHAsIHBsdWdpbiwgdmlldykge1xuICAgIHRoaXMuYXBwID0gYXBwO1xuICAgIHRoaXMucGx1Z2luID0gcGx1Z2luO1xuICAgIHRoaXMudmlldyA9IHZpZXc7XG4gIH1cbiAgYXN5bmMgc2VhcmNoIChzZWFyY2hfdGV4dCkge1xuICAgIHJldHVybiBhd2FpdCB0aGlzLnBsdWdpbi5hcGkuc2VhcmNoKHNlYXJjaF90ZXh0KTtcbiAgfVxuICAvLyB0cmlnZ2VyIHJlbG9hZCBvZiBlbWJlZGRpbmdzIGZpbGVcbiAgYXN5bmMgcmVsb2FkX2VtYmVkZGluZ3NfZmlsZSgpIHtcbiAgICBhd2FpdCB0aGlzLnBsdWdpbi5pbml0X3ZlY3MoKTtcbiAgICBhd2FpdCB0aGlzLnZpZXcucmVuZGVyX2Nvbm5lY3Rpb25zKCk7XG4gIH1cbn1cbmNsYXNzIFNjU2VhcmNoQXBpIHtcbiAgY29uc3RydWN0b3IoYXBwLCBwbHVnaW4pIHtcbiAgICB0aGlzLmFwcCA9IGFwcDtcbiAgICB0aGlzLnBsdWdpbiA9IHBsdWdpbjtcbiAgfVxuICBhc3luYyBzZWFyY2ggKHNlYXJjaF90ZXh0LCBmaWx0ZXI9e30pIHtcbiAgICBmaWx0ZXIgPSB7XG4gICAgICBza2lwX3NlY3Rpb25zOiB0aGlzLnBsdWdpbi5zZXR0aW5ncy5za2lwX3NlY3Rpb25zLFxuICAgICAgLi4uZmlsdGVyXG4gICAgfVxuICAgIGxldCBuZWFyZXN0ID0gW107XG4gICAgY29uc3QgcmVzcCA9IGF3YWl0IHRoaXMucGx1Z2luLnJlcXVlc3RfZW1iZWRkaW5nX2Zyb21faW5wdXQoc2VhcmNoX3RleHQpO1xuICAgIGlmIChyZXNwICYmIHJlc3AuZGF0YSAmJiByZXNwLmRhdGFbMF0gJiYgcmVzcC5kYXRhWzBdLmVtYmVkZGluZykge1xuICAgICAgbmVhcmVzdCA9IHRoaXMucGx1Z2luLnNtYXJ0X3ZlY19saXRlLm5lYXJlc3QocmVzcC5kYXRhWzBdLmVtYmVkZGluZywgZmlsdGVyKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gcmVzcCBpcyBudWxsLCB1bmRlZmluZWQsIG9yIG1pc3NpbmcgZGF0YVxuICAgICAgbmV3IE9ic2lkaWFuLk5vdGljZShcIlNtYXJ0IENvbm5lY3Rpb25zOiBFcnJvciBnZXR0aW5nIGVtYmVkZGluZ1wiKTtcbiAgICB9XG4gICAgcmV0dXJuIG5lYXJlc3Q7XG4gIH1cbn1cblxuY2xhc3MgU21hcnRDb25uZWN0aW9uc1NldHRpbmdzVGFiIGV4dGVuZHMgT2JzaWRpYW4uUGx1Z2luU2V0dGluZ1RhYiB7XG4gIGNvbnN0cnVjdG9yKGFwcCwgcGx1Z2luKSB7XG4gICAgc3VwZXIoYXBwLCBwbHVnaW4pO1xuICAgIHRoaXMucGx1Z2luID0gcGx1Z2luO1xuICB9XG4gIGRpc3BsYXkoKSB7XG4gICAgY29uc3Qge1xuICAgICAgY29udGFpbmVyRWxcbiAgICB9ID0gdGhpcztcbiAgICBjb250YWluZXJFbC5lbXB0eSgpO1xuICAgIGNvbnRhaW5lckVsLmNyZWF0ZUVsKFwiaDJcIiwge1xuICAgICAgdGV4dDogXCJTdXBwb3J0ZXIgU2V0dGluZ3NcIlxuICAgIH0pO1xuICAgIC8vIGxpc3Qgc3VwcG9ydGVyIGJlbmVmaXRzXG4gICAgY29udGFpbmVyRWwuY3JlYXRlRWwoXCJwXCIsIHtcbiAgICAgIHRleHQ6IFwiQXMgYSBTbWFydCBDb25uZWN0aW9ucyBcXFwiU3VwcG9ydGVyXFxcIiwgZmFzdC10cmFjayB5b3VyIFBLTSBqb3VybmV5IHdpdGggcHJpb3JpdHkgcGVya3MgYW5kIHBpb25lZXJpbmcgaW5ub3ZhdGlvbnMuXCJcbiAgICB9KTtcbiAgICAvLyB0aHJlZSBsaXN0IGl0ZW1zXG4gICAgY29uc3Qgc3VwcG9ydGVyX2JlbmVmaXRzX2xpc3QgPSBjb250YWluZXJFbC5jcmVhdGVFbChcInVsXCIpO1xuICAgIHN1cHBvcnRlcl9iZW5lZml0c19saXN0LmNyZWF0ZUVsKFwibGlcIiwge1xuICAgICAgdGV4dDogXCJFbmpveSBzd2lmdCwgdG9wLXByaW9yaXR5IHN1cHBvcnQuXCJcbiAgICB9KTtcbiAgICBzdXBwb3J0ZXJfYmVuZWZpdHNfbGlzdC5jcmVhdGVFbChcImxpXCIsIHtcbiAgICAgIHRleHQ6IFwiR2FpbiBlYXJseSBhY2Nlc3MgdG8gZXhwZXJpbWVudGFsIGZlYXR1cmVzIGxpa2UgdGhlIENoYXRHUFQgcGx1Z2luLlwiXG4gICAgfSk7XG4gICAgc3VwcG9ydGVyX2JlbmVmaXRzX2xpc3QuY3JlYXRlRWwoXCJsaVwiLCB7XG4gICAgICB0ZXh0OiBcIlN0YXkgaW5mb3JtZWQgYW5kIGVuZ2FnZWQgd2l0aCBleGNsdXNpdmUgc3VwcG9ydGVyLW9ubHkgY29tbXVuaWNhdGlvbnMuXCJcbiAgICB9KTtcbiAgICAvLyBhZGQgYSB0ZXh0IGlucHV0IHRvIGVudGVyIHN1cHBvcnRlciBsaWNlbnNlIGtleVxuICAgIG5ldyBPYnNpZGlhbi5TZXR0aW5nKGNvbnRhaW5lckVsKS5zZXROYW1lKFwiU3VwcG9ydGVyIExpY2Vuc2UgS2V5XCIpLnNldERlc2MoXCJOb3RlOiB0aGlzIGlzIG5vdCByZXF1aXJlZCB0byB1c2UgU21hcnQgQ29ubmVjdGlvbnMuXCIpLmFkZFRleHQoKHRleHQpID0+IHRleHQuc2V0UGxhY2Vob2xkZXIoXCJFbnRlciB5b3VyIGxpY2Vuc2Vfa2V5XCIpLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmxpY2Vuc2Vfa2V5KS5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcbiAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLmxpY2Vuc2Vfa2V5ID0gdmFsdWUudHJpbSgpO1xuICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKHRydWUpO1xuICAgIH0pKTtcbiAgICAvLyBhZGQgYnV0dG9uIHRvIHRyaWdnZXIgc3luYyBub3RlcyB0byB1c2Ugd2l0aCBDaGF0R1BUXG4gICAgbmV3IE9ic2lkaWFuLlNldHRpbmcoY29udGFpbmVyRWwpLnNldE5hbWUoXCJTeW5jIE5vdGVzXCIpLnNldERlc2MoXCJNYWtlIG5vdGVzIGF2YWlsYWJsZSB2aWEgdGhlIFNtYXJ0IENvbm5lY3Rpb25zIENoYXRHUFQgUGx1Z2luLiBSZXNwZWN0cyBleGNsdXNpb24gc2V0dGluZ3MgY29uZmlndXJlZCBiZWxvdy5cIikuYWRkQnV0dG9uKChidXR0b24pID0+IGJ1dHRvbi5zZXRCdXR0b25UZXh0KFwiU3luYyBOb3Rlc1wiKS5vbkNsaWNrKGFzeW5jICgpID0+IHtcbiAgICAgIC8vIHN5bmMgbm90ZXNcbiAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnN5bmNfbm90ZXMoKTtcbiAgICB9KSk7XG4gICAgLy8gYWRkIGJ1dHRvbiB0byBiZWNvbWUgYSBzdXBwb3J0ZXJcbiAgICBuZXcgT2JzaWRpYW4uU2V0dGluZyhjb250YWluZXJFbCkuc2V0TmFtZShcIkJlY29tZSBhIFN1cHBvcnRlclwiKS5zZXREZXNjKFwiQmVjb21lIGEgU3VwcG9ydGVyXCIpLmFkZEJ1dHRvbigoYnV0dG9uKSA9PiBidXR0b24uc2V0QnV0dG9uVGV4dChcIkJlY29tZSBhIFN1cHBvcnRlclwiKS5vbkNsaWNrKGFzeW5jICgpID0+IHtcbiAgICAgIGNvbnN0IHBheW1lbnRfcGFnZXMgPSBbXG4gICAgICAgIFwiaHR0cHM6Ly9idXkuc3RyaXBlLmNvbS85QVE1a081UW5iQVdnR0FiSVlcIixcbiAgICAgICAgXCJodHRwczovL2J1eS5zdHJpcGUuY29tLzlBUTdzV2VtVDQ4dTFMR2NONFwiXG4gICAgICBdO1xuICAgICAgaWYoIXRoaXMucGx1Z2luLnBheW1lbnRfcGFnZV9pbmRleCl7XG4gICAgICAgIHRoaXMucGx1Z2luLnBheW1lbnRfcGFnZV9pbmRleCA9IE1hdGgucm91bmQoTWF0aC5yYW5kb20oKSk7XG4gICAgICB9XG4gICAgICAvLyBvcGVuIHN1cHBvcnRlciBwYWdlIGluIGJyb3dzZXJcbiAgICAgIHdpbmRvdy5vcGVuKHBheW1lbnRfcGFnZXNbdGhpcy5wbHVnaW4ucGF5bWVudF9wYWdlX2luZGV4XSk7XG4gICAgfSkpO1xuXG4gICAgXG4gICAgY29udGFpbmVyRWwuY3JlYXRlRWwoXCJoMlwiLCB7XG4gICAgICB0ZXh0OiBcIk9wZW5BSSBTZXR0aW5nc1wiXG4gICAgfSk7XG4gICAgLy8gYWRkIGEgdGV4dCBpbnB1dCB0byBlbnRlciB0aGUgQVBJIGtleVxuICAgIG5ldyBPYnNpZGlhbi5TZXR0aW5nKGNvbnRhaW5lckVsKS5zZXROYW1lKFwiT3BlbkFJIEFQSSBLZXlcIikuc2V0RGVzYyhcIlJlcXVpcmVkOiBhbiBPcGVuQUkgQVBJIGtleSBpcyBjdXJyZW50bHkgcmVxdWlyZWQgdG8gdXNlIFNtYXJ0IENvbm5lY3Rpb25zLlwiKS5hZGRUZXh0KCh0ZXh0KSA9PiB0ZXh0LnNldFBsYWNlaG9sZGVyKFwiRW50ZXIgeW91ciBhcGlfa2V5XCIpLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmFwaV9rZXkpLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MuYXBpX2tleSA9IHZhbHVlLnRyaW0oKTtcbiAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncyh0cnVlKTtcbiAgICB9KSk7XG4gICAgLy8gYWRkIGEgYnV0dG9uIHRvIHRlc3QgdGhlIEFQSSBrZXkgaXMgd29ya2luZ1xuICAgIG5ldyBPYnNpZGlhbi5TZXR0aW5nKGNvbnRhaW5lckVsKS5zZXROYW1lKFwiVGVzdCBBUEkgS2V5XCIpLnNldERlc2MoXCJUZXN0IEFQSSBLZXlcIikuYWRkQnV0dG9uKChidXR0b24pID0+IGJ1dHRvbi5zZXRCdXR0b25UZXh0KFwiVGVzdCBBUEkgS2V5XCIpLm9uQ2xpY2soYXN5bmMgKCkgPT4ge1xuICAgICAgLy8gdGVzdCBBUEkga2V5XG4gICAgICBjb25zdCByZXNwID0gYXdhaXQgdGhpcy5wbHVnaW4udGVzdF9hcGlfa2V5KCk7XG4gICAgICBpZihyZXNwKSB7XG4gICAgICAgIG5ldyBPYnNpZGlhbi5Ob3RpY2UoXCJTbWFydCBDb25uZWN0aW9uczogQVBJIGtleSBpcyB2YWxpZFwiKTtcbiAgICAgIH1lbHNle1xuICAgICAgICBuZXcgT2JzaWRpYW4uTm90aWNlKFwiU21hcnQgQ29ubmVjdGlvbnM6IEFQSSBrZXkgaXMgbm90IHdvcmtpbmcgYXMgZXhwZWN0ZWQhXCIpO1xuICAgICAgfVxuICAgIH0pKTtcbiAgICAvLyBhZGQgZHJvcGRvd24gdG8gc2VsZWN0IHRoZSBtb2RlbFxuICAgIG5ldyBPYnNpZGlhbi5TZXR0aW5nKGNvbnRhaW5lckVsKS5zZXROYW1lKFwiU21hcnQgQ2hhdCBNb2RlbFwiKS5zZXREZXNjKFwiU2VsZWN0IGEgbW9kZWwgdG8gdXNlIHdpdGggU21hcnQgQ2hhdC5cIikuYWRkRHJvcGRvd24oKGRyb3Bkb3duKSA9PiB7XG4gICAgICBkcm9wZG93bi5hZGRPcHRpb24oXCJncHQtMy41LXR1cmJvLTE2a1wiLCBcImdwdC0zLjUtdHVyYm8tMTZrXCIpO1xuICAgICAgZHJvcGRvd24uYWRkT3B0aW9uKFwiZ3B0LTRcIiwgXCJncHQtNCAobGltaXRlZCBhY2Nlc3MsIDhrKVwiKTtcbiAgICAgIGRyb3Bkb3duLmFkZE9wdGlvbihcImdwdC0zLjUtdHVyYm9cIiwgXCJncHQtMy41LXR1cmJvICg0aylcIik7XG4gICAgICBkcm9wZG93bi5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcbiAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3Muc21hcnRfY2hhdF9tb2RlbCA9IHZhbHVlO1xuICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcbiAgICAgIH0pO1xuICAgICAgZHJvcGRvd24uc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3Muc21hcnRfY2hhdF9tb2RlbCk7XG4gICAgfSk7XG4gICAgLy8gbGFuZ3VhZ2VcbiAgICBuZXcgT2JzaWRpYW4uU2V0dGluZyhjb250YWluZXJFbCkuc2V0TmFtZShcIkRlZmF1bHQgTGFuZ3VhZ2VcIikuc2V0RGVzYyhcIkRlZmF1bHQgbGFuZ3VhZ2UgdG8gdXNlIGZvciBTbWFydCBDaGF0LiBDaGFuZ2VzIHdoaWNoIHNlbGYtcmVmZXJlbnRpYWwgcHJvbm91bnMgd2lsbCB0cmlnZ2VyIGxvb2t1cCBvZiB5b3VyIG5vdGVzLlwiKS5hZGREcm9wZG93bigoZHJvcGRvd24pID0+IHtcbiAgICAgIC8vIGdldCBPYmplY3Qga2V5cyBmcm9tIHByb25vdXNcbiAgICAgIGNvbnN0IGxhbmd1YWdlcyA9IE9iamVjdC5rZXlzKFNNQVJUX1RSQU5TTEFUSU9OKTtcbiAgICAgIGZvcihsZXQgaSA9IDA7IGkgPCBsYW5ndWFnZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgZHJvcGRvd24uYWRkT3B0aW9uKGxhbmd1YWdlc1tpXSwgbGFuZ3VhZ2VzW2ldKTtcbiAgICAgIH1cbiAgICAgIGRyb3Bkb3duLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5sYW5ndWFnZSA9IHZhbHVlO1xuICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcbiAgICAgICAgc2VsZl9yZWZfcHJvbm91bnNfbGlzdC5zZXRUZXh0KHRoaXMuZ2V0X3NlbGZfcmVmX2xpc3QoKSk7XG4gICAgICAgIC8vIGlmIGNoYXQgdmlldyBpcyBvcGVuIHRoZW4gcnVuIG5ld19jaGF0KClcbiAgICAgICAgY29uc3QgY2hhdF92aWV3ID0gdGhpcy5hcHAud29ya3NwYWNlLmdldExlYXZlc09mVHlwZShTTUFSVF9DT05ORUNUSU9OU19DSEFUX1ZJRVdfVFlQRSkubGVuZ3RoID4gMCA/IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRMZWF2ZXNPZlR5cGUoU01BUlRfQ09OTkVDVElPTlNfQ0hBVF9WSUVXX1RZUEUpWzBdLnZpZXcgOiBudWxsO1xuICAgICAgICBpZihjaGF0X3ZpZXcpIHtcbiAgICAgICAgICBjaGF0X3ZpZXcubmV3X2NoYXQoKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgICBkcm9wZG93bi5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5sYW5ndWFnZSk7XG4gICAgfSk7XG4gICAgLy8gbGlzdCBjdXJyZW50IHNlbGYtcmVmZXJlbnRpYWwgcHJvbm91bnNcbiAgICBjb25zdCBzZWxmX3JlZl9wcm9ub3Vuc19saXN0ID0gY29udGFpbmVyRWwuY3JlYXRlRWwoXCJzcGFuXCIsIHtcbiAgICAgIHRleHQ6IHRoaXMuZ2V0X3NlbGZfcmVmX2xpc3QoKVxuICAgIH0pO1xuICAgIGNvbnRhaW5lckVsLmNyZWF0ZUVsKFwiaDJcIiwge1xuICAgICAgdGV4dDogXCJFeGNsdXNpb25zXCJcbiAgICB9KTtcbiAgICAvLyBsaXN0IGZpbGUgZXhjbHVzaW9uc1xuICAgIG5ldyBPYnNpZGlhbi5TZXR0aW5nKGNvbnRhaW5lckVsKS5zZXROYW1lKFwiZmlsZV9leGNsdXNpb25zXCIpLnNldERlc2MoXCInRXhjbHVkZWQgZmlsZScgbWF0Y2hlcnMgc2VwYXJhdGVkIGJ5IGEgY29tbWEuXCIpLmFkZFRleHQoKHRleHQpID0+IHRleHQuc2V0UGxhY2Vob2xkZXIoXCJkcmF3aW5ncyxwcm9tcHRzL2xvZ3NcIikuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MuZmlsZV9leGNsdXNpb25zKS5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcbiAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLmZpbGVfZXhjbHVzaW9ucyA9IHZhbHVlO1xuICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG4gICAgfSkpO1xuICAgIC8vIGxpc3QgZm9sZGVyIGV4Y2x1c2lvbnNcbiAgICBuZXcgT2JzaWRpYW4uU2V0dGluZyhjb250YWluZXJFbCkuc2V0TmFtZShcImZvbGRlcl9leGNsdXNpb25zXCIpLnNldERlc2MoXCInRXhjbHVkZWQgZm9sZGVyJyBtYXRjaGVycyBzZXBhcmF0ZWQgYnkgYSBjb21tYS5cIikuYWRkVGV4dCgodGV4dCkgPT4gdGV4dC5zZXRQbGFjZWhvbGRlcihcImRyYXdpbmdzLHByb21wdHMvbG9nc1wiKS5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5mb2xkZXJfZXhjbHVzaW9ucykub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG4gICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5mb2xkZXJfZXhjbHVzaW9ucyA9IHZhbHVlO1xuICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG4gICAgfSkpO1xuICAgIC8vIGxpc3QgcGF0aCBvbmx5IG1hdGNoZXJzXG4gICAgbmV3IE9ic2lkaWFuLlNldHRpbmcoY29udGFpbmVyRWwpLnNldE5hbWUoXCJwYXRoX29ubHlcIikuc2V0RGVzYyhcIidQYXRoIG9ubHknIG1hdGNoZXJzIHNlcGFyYXRlZCBieSBhIGNvbW1hLlwiKS5hZGRUZXh0KCh0ZXh0KSA9PiB0ZXh0LnNldFBsYWNlaG9sZGVyKFwiZHJhd2luZ3MscHJvbXB0cy9sb2dzXCIpLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLnBhdGhfb25seSkub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG4gICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5wYXRoX29ubHkgPSB2YWx1ZTtcbiAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuICAgIH0pKTtcbiAgICAvLyBsaXN0IGhlYWRlciBleGNsdXNpb25zXG4gICAgbmV3IE9ic2lkaWFuLlNldHRpbmcoY29udGFpbmVyRWwpLnNldE5hbWUoXCJoZWFkZXJfZXhjbHVzaW9uc1wiKS5zZXREZXNjKFwiJ0V4Y2x1ZGVkIGhlYWRlcicgbWF0Y2hlcnMgc2VwYXJhdGVkIGJ5IGEgY29tbWEuIFdvcmtzIGZvciAnYmxvY2tzJyBvbmx5LlwiKS5hZGRUZXh0KCh0ZXh0KSA9PiB0ZXh0LnNldFBsYWNlaG9sZGVyKFwiZHJhd2luZ3MscHJvbXB0cy9sb2dzXCIpLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmhlYWRlcl9leGNsdXNpb25zKS5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcbiAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLmhlYWRlcl9leGNsdXNpb25zID0gdmFsdWU7XG4gICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcbiAgICB9KSk7XG4gICAgY29udGFpbmVyRWwuY3JlYXRlRWwoXCJoMlwiLCB7XG4gICAgICB0ZXh0OiBcIkRpc3BsYXlcIlxuICAgIH0pO1xuICAgIC8vIHRvZ2dsZSBzaG93aW5nIGZ1bGwgcGF0aCBpbiB2aWV3XG4gICAgbmV3IE9ic2lkaWFuLlNldHRpbmcoY29udGFpbmVyRWwpLnNldE5hbWUoXCJzaG93X2Z1bGxfcGF0aFwiKS5zZXREZXNjKFwiU2hvdyBmdWxsIHBhdGggaW4gdmlldy5cIikuYWRkVG9nZ2xlKCh0b2dnbGUpID0+IHRvZ2dsZS5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5zaG93X2Z1bGxfcGF0aCkub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG4gICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5zaG93X2Z1bGxfcGF0aCA9IHZhbHVlO1xuICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKHRydWUpO1xuICAgIH0pKTtcbiAgICAvLyB0b2dnbGUgZXhwYW5kZWQgdmlldyBieSBkZWZhdWx0XG4gICAgbmV3IE9ic2lkaWFuLlNldHRpbmcoY29udGFpbmVyRWwpLnNldE5hbWUoXCJleHBhbmRlZF92aWV3XCIpLnNldERlc2MoXCJFeHBhbmRlZCB2aWV3IGJ5IGRlZmF1bHQuXCIpLmFkZFRvZ2dsZSgodG9nZ2xlKSA9PiB0b2dnbGUuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MuZXhwYW5kZWRfdmlldykub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG4gICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5leHBhbmRlZF92aWV3ID0gdmFsdWU7XG4gICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3ModHJ1ZSk7XG4gICAgfSkpO1xuICAgIC8vIHRvZ2dsZSBncm91cCBuZWFyZXN0IGJ5IGZpbGVcbiAgICBuZXcgT2JzaWRpYW4uU2V0dGluZyhjb250YWluZXJFbCkuc2V0TmFtZShcImdyb3VwX25lYXJlc3RfYnlfZmlsZVwiKS5zZXREZXNjKFwiR3JvdXAgbmVhcmVzdCBieSBmaWxlLlwiKS5hZGRUb2dnbGUoKHRvZ2dsZSkgPT4gdG9nZ2xlLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmdyb3VwX25lYXJlc3RfYnlfZmlsZSkub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG4gICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5ncm91cF9uZWFyZXN0X2J5X2ZpbGUgPSB2YWx1ZTtcbiAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncyh0cnVlKTtcbiAgICB9KSk7XG4gICAgLy8gdG9nZ2xlIHZpZXdfb3BlbiBvbiBPYnNpZGlhbiBzdGFydHVwXG4gICAgbmV3IE9ic2lkaWFuLlNldHRpbmcoY29udGFpbmVyRWwpLnNldE5hbWUoXCJ2aWV3X29wZW5cIikuc2V0RGVzYyhcIk9wZW4gdmlldyBvbiBPYnNpZGlhbiBzdGFydHVwLlwiKS5hZGRUb2dnbGUoKHRvZ2dsZSkgPT4gdG9nZ2xlLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLnZpZXdfb3Blbikub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG4gICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy52aWV3X29wZW4gPSB2YWx1ZTtcbiAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncyh0cnVlKTtcbiAgICB9KSk7XG4gICAgLy8gdG9nZ2xlIGNoYXRfb3BlbiBvbiBPYnNpZGlhbiBzdGFydHVwXG4gICAgbmV3IE9ic2lkaWFuLlNldHRpbmcoY29udGFpbmVyRWwpLnNldE5hbWUoXCJjaGF0X29wZW5cIikuc2V0RGVzYyhcIk9wZW4gdmlldyBvbiBPYnNpZGlhbiBzdGFydHVwLlwiKS5hZGRUb2dnbGUoKHRvZ2dsZSkgPT4gdG9nZ2xlLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmNoYXRfb3Blbikub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG4gICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5jaGF0X29wZW4gPSB2YWx1ZTtcbiAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncyh0cnVlKTtcbiAgICB9KSk7XG4gICAgY29udGFpbmVyRWwuY3JlYXRlRWwoXCJoMlwiLCB7XG4gICAgICB0ZXh0OiBcIkFkdmFuY2VkXCJcbiAgICB9KTtcbiAgICAvLyB0b2dnbGUgbG9nX3JlbmRlclxuICAgIG5ldyBPYnNpZGlhbi5TZXR0aW5nKGNvbnRhaW5lckVsKS5zZXROYW1lKFwibG9nX3JlbmRlclwiKS5zZXREZXNjKFwiTG9nIHJlbmRlciBkZXRhaWxzIHRvIGNvbnNvbGUgKGluY2x1ZGVzIHRva2VuX3VzYWdlKS5cIikuYWRkVG9nZ2xlKCh0b2dnbGUpID0+IHRvZ2dsZS5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5sb2dfcmVuZGVyKS5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcbiAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLmxvZ19yZW5kZXIgPSB2YWx1ZTtcbiAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncyh0cnVlKTtcbiAgICB9KSk7XG4gICAgLy8gdG9nZ2xlIGZpbGVzIGluIGxvZ19yZW5kZXJcbiAgICBuZXcgT2JzaWRpYW4uU2V0dGluZyhjb250YWluZXJFbCkuc2V0TmFtZShcImxvZ19yZW5kZXJfZmlsZXNcIikuc2V0RGVzYyhcIkxvZyBlbWJlZGRlZCBvYmplY3RzIHBhdGhzIHdpdGggbG9nIHJlbmRlciAoZm9yIGRlYnVnZ2luZykuXCIpLmFkZFRvZ2dsZSgodG9nZ2xlKSA9PiB0b2dnbGUuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MubG9nX3JlbmRlcl9maWxlcykub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG4gICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5sb2dfcmVuZGVyX2ZpbGVzID0gdmFsdWU7XG4gICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3ModHJ1ZSk7XG4gICAgfSkpO1xuICAgIC8vIHRvZ2dsZSBza2lwX3NlY3Rpb25zXG4gICAgbmV3IE9ic2lkaWFuLlNldHRpbmcoY29udGFpbmVyRWwpLnNldE5hbWUoXCJza2lwX3NlY3Rpb25zXCIpLnNldERlc2MoXCJTa2lwcyBtYWtpbmcgY29ubmVjdGlvbnMgdG8gc3BlY2lmaWMgc2VjdGlvbnMgd2l0aGluIG5vdGVzLiBXYXJuaW5nOiByZWR1Y2VzIHVzZWZ1bG5lc3MgZm9yIGxhcmdlIGZpbGVzIGFuZCByZXF1aXJlcyAnRm9yY2UgUmVmcmVzaCcgZm9yIHNlY3Rpb25zIHRvIHdvcmsgaW4gdGhlIGZ1dHVyZS5cIikuYWRkVG9nZ2xlKCh0b2dnbGUpID0+IHRvZ2dsZS5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5za2lwX3NlY3Rpb25zKS5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcbiAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLnNraXBfc2VjdGlvbnMgPSB2YWx1ZTtcbiAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncyh0cnVlKTtcbiAgICB9KSk7XG4gICAgLy8gdGVzdCBmaWxlIHdyaXRpbmcgYnkgY3JlYXRpbmcgYSB0ZXN0IGZpbGUsIHRoZW4gd3JpdGluZyBhZGRpdGlvbmFsIGRhdGEgdG8gdGhlIGZpbGUsIGFuZCByZXR1cm5pbmcgYW55IGVycm9yIHRleHQgaWYgaXQgZmFpbHNcbiAgICBjb250YWluZXJFbC5jcmVhdGVFbChcImgzXCIsIHtcbiAgICAgIHRleHQ6IFwiVGVzdCBGaWxlIFdyaXRpbmdcIlxuICAgIH0pO1xuICAgIC8vIG1hbnVhbCBzYXZlIGJ1dHRvblxuICAgIGNvbnRhaW5lckVsLmNyZWF0ZUVsKFwiaDNcIiwge1xuICAgICAgdGV4dDogXCJNYW51YWwgU2F2ZVwiXG4gICAgfSk7XG4gICAgbGV0IG1hbnVhbF9zYXZlX3Jlc3VsdHMgPSBjb250YWluZXJFbC5jcmVhdGVFbChcImRpdlwiKTtcbiAgICBuZXcgT2JzaWRpYW4uU2V0dGluZyhjb250YWluZXJFbCkuc2V0TmFtZShcIm1hbnVhbF9zYXZlXCIpLnNldERlc2MoXCJTYXZlIGN1cnJlbnQgZW1iZWRkaW5nc1wiKS5hZGRCdXR0b24oKGJ1dHRvbikgPT4gYnV0dG9uLnNldEJ1dHRvblRleHQoXCJNYW51YWwgU2F2ZVwiKS5vbkNsaWNrKGFzeW5jICgpID0+IHtcbiAgICAgIC8vIGNvbmZpcm1cbiAgICAgIGlmIChjb25maXJtKFwiQXJlIHlvdSBzdXJlIHlvdSB3YW50IHRvIHNhdmUgeW91ciBjdXJyZW50IGVtYmVkZGluZ3M/XCIpKSB7XG4gICAgICAgIC8vIHNhdmVcbiAgICAgICAgdHJ5e1xuICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVfZW1iZWRkaW5nc190b19maWxlKHRydWUpO1xuICAgICAgICAgIG1hbnVhbF9zYXZlX3Jlc3VsdHMuaW5uZXJIVE1MID0gXCJFbWJlZGRpbmdzIHNhdmVkIHN1Y2Nlc3NmdWxseS5cIjtcbiAgICAgICAgfWNhdGNoKGUpe1xuICAgICAgICAgIG1hbnVhbF9zYXZlX3Jlc3VsdHMuaW5uZXJIVE1MID0gXCJFbWJlZGRpbmdzIGZhaWxlZCB0byBzYXZlLiBFcnJvcjogXCIgKyBlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSkpO1xuXG4gICAgLy8gbGlzdCBwcmV2aW91c2x5IGZhaWxlZCBmaWxlc1xuICAgIGNvbnRhaW5lckVsLmNyZWF0ZUVsKFwiaDNcIiwge1xuICAgICAgdGV4dDogXCJQcmV2aW91c2x5IGZhaWxlZCBmaWxlc1wiXG4gICAgfSk7XG4gICAgbGV0IGZhaWxlZF9saXN0ID0gY29udGFpbmVyRWwuY3JlYXRlRWwoXCJkaXZcIik7XG4gICAgdGhpcy5kcmF3X2ZhaWxlZF9maWxlc19saXN0KGZhaWxlZF9saXN0KTtcblxuICAgIC8vIGZvcmNlIHJlZnJlc2ggYnV0dG9uXG4gICAgY29udGFpbmVyRWwuY3JlYXRlRWwoXCJoM1wiLCB7XG4gICAgICB0ZXh0OiBcIkZvcmNlIFJlZnJlc2hcIlxuICAgIH0pO1xuICAgIG5ldyBPYnNpZGlhbi5TZXR0aW5nKGNvbnRhaW5lckVsKS5zZXROYW1lKFwiZm9yY2VfcmVmcmVzaFwiKS5zZXREZXNjKFwiV0FSTklORzogRE8gTk9UIHVzZSB1bmxlc3MgeW91IGtub3cgd2hhdCB5b3UgYXJlIGRvaW5nISBUaGlzIHdpbGwgZGVsZXRlIGFsbCBvZiB5b3VyIGN1cnJlbnQgZW1iZWRkaW5ncyBmcm9tIE9wZW5BSSBhbmQgdHJpZ2dlciByZXByb2Nlc3Npbmcgb2YgeW91ciBlbnRpcmUgdmF1bHQhXCIpLmFkZEJ1dHRvbigoYnV0dG9uKSA9PiBidXR0b24uc2V0QnV0dG9uVGV4dChcIkZvcmNlIFJlZnJlc2hcIikub25DbGljayhhc3luYyAoKSA9PiB7XG4gICAgICAvLyBjb25maXJtXG4gICAgICBpZiAoY29uZmlybShcIkFyZSB5b3Ugc3VyZSB5b3Ugd2FudCB0byBGb3JjZSBSZWZyZXNoPyBCeSBjbGlja2luZyB5ZXMgeW91IGNvbmZpcm0gdGhhdCB5b3UgdW5kZXJzdGFuZCB0aGUgY29uc2VxdWVuY2VzIG9mIHRoaXMgYWN0aW9uLlwiKSkge1xuICAgICAgICAvLyBmb3JjZSByZWZyZXNoXG4gICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLmZvcmNlX3JlZnJlc2hfZW1iZWRkaW5nc19maWxlKCk7XG4gICAgICB9XG4gICAgfSkpO1xuXG4gIH1cbiAgZ2V0X3NlbGZfcmVmX2xpc3QoKSB7XG4gICAgcmV0dXJuIFwiQ3VycmVudDogXCIgKyBTTUFSVF9UUkFOU0xBVElPTlt0aGlzLnBsdWdpbi5zZXR0aW5ncy5sYW5ndWFnZV0ucHJvbm91cy5qb2luKFwiLCBcIik7XG4gIH1cblxuICBkcmF3X2ZhaWxlZF9maWxlc19saXN0KGZhaWxlZF9saXN0KSB7XG4gICAgZmFpbGVkX2xpc3QuZW1wdHkoKTtcbiAgICBpZih0aGlzLnBsdWdpbi5zZXR0aW5ncy5mYWlsZWRfZmlsZXMubGVuZ3RoID4gMCkge1xuICAgICAgLy8gYWRkIG1lc3NhZ2UgdGhhdCB0aGVzZSBmaWxlcyB3aWxsIGJlIHNraXBwZWQgdW50aWwgbWFudWFsbHkgcmV0cmllZFxuICAgICAgZmFpbGVkX2xpc3QuY3JlYXRlRWwoXCJwXCIsIHtcbiAgICAgICAgdGV4dDogXCJUaGUgZm9sbG93aW5nIGZpbGVzIGZhaWxlZCB0byBwcm9jZXNzIGFuZCB3aWxsIGJlIHNraXBwZWQgdW50aWwgbWFudWFsbHkgcmV0cmllZC5cIlxuICAgICAgfSk7XG4gICAgICBsZXQgbGlzdCA9IGZhaWxlZF9saXN0LmNyZWF0ZUVsKFwidWxcIik7XG4gICAgICBmb3IgKGxldCBmYWlsZWRfZmlsZSBvZiB0aGlzLnBsdWdpbi5zZXR0aW5ncy5mYWlsZWRfZmlsZXMpIHtcbiAgICAgICAgbGlzdC5jcmVhdGVFbChcImxpXCIsIHtcbiAgICAgICAgICB0ZXh0OiBmYWlsZWRfZmlsZVxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICAgIC8vIGFkZCBidXR0b24gdG8gcmV0cnkgZmFpbGVkIGZpbGVzIG9ubHlcbiAgICAgIG5ldyBPYnNpZGlhbi5TZXR0aW5nKGZhaWxlZF9saXN0KS5zZXROYW1lKFwicmV0cnlfZmFpbGVkX2ZpbGVzXCIpLnNldERlc2MoXCJSZXRyeSBmYWlsZWQgZmlsZXMgb25seVwiKS5hZGRCdXR0b24oKGJ1dHRvbikgPT4gYnV0dG9uLnNldEJ1dHRvblRleHQoXCJSZXRyeSBmYWlsZWQgZmlsZXMgb25seVwiKS5vbkNsaWNrKGFzeW5jICgpID0+IHtcbiAgICAgICAgLy8gY2xlYXIgZmFpbGVkX2xpc3QgZWxlbWVudFxuICAgICAgICBmYWlsZWRfbGlzdC5lbXB0eSgpO1xuICAgICAgICAvLyBzZXQgXCJyZXRyeWluZ1wiIHRleHRcbiAgICAgICAgZmFpbGVkX2xpc3QuY3JlYXRlRWwoXCJwXCIsIHtcbiAgICAgICAgICB0ZXh0OiBcIlJldHJ5aW5nIGZhaWxlZCBmaWxlcy4uLlwiXG4gICAgICAgIH0pO1xuICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5yZXRyeV9mYWlsZWRfZmlsZXMoKTtcbiAgICAgICAgLy8gcmVkcmF3IGZhaWxlZCBmaWxlcyBsaXN0XG4gICAgICAgIHRoaXMuZHJhd19mYWlsZWRfZmlsZXNfbGlzdChmYWlsZWRfbGlzdCk7XG4gICAgICB9KSk7XG4gICAgfWVsc2V7XG4gICAgICBmYWlsZWRfbGlzdC5jcmVhdGVFbChcInBcIiwge1xuICAgICAgICB0ZXh0OiBcIk5vIGZhaWxlZCBmaWxlc1wiXG4gICAgICB9KTtcbiAgICB9XG4gIH1cbn1cblxuZnVuY3Rpb24gbGluZV9pc19oZWFkaW5nKGxpbmUpIHtcbiAgcmV0dXJuIChsaW5lLmluZGV4T2YoXCIjXCIpID09PSAwKSAmJiAoWycjJywgJyAnXS5pbmRleE9mKGxpbmVbMV0pICE9PSAtMSk7XG59XG5cbmNvbnN0IFNNQVJUX0NPTk5FQ1RJT05TX0NIQVRfVklFV19UWVBFID0gXCJzbWFydC1jb25uZWN0aW9ucy1jaGF0LXZpZXdcIjtcblxuY2xhc3MgU21hcnRDb25uZWN0aW9uc0NoYXRWaWV3IGV4dGVuZHMgT2JzaWRpYW4uSXRlbVZpZXcge1xuICBjb25zdHJ1Y3RvcihsZWFmLCBwbHVnaW4pIHtcbiAgICBzdXBlcihsZWFmKTtcbiAgICB0aGlzLnBsdWdpbiA9IHBsdWdpbjtcbiAgICB0aGlzLmFjdGl2ZV9lbG0gPSBudWxsO1xuICAgIHRoaXMuYWN0aXZlX3N0cmVhbSA9IG51bGw7XG4gICAgdGhpcy5icmFja2V0c19jdCA9IDA7XG4gICAgdGhpcy5jaGF0ID0gbnVsbDtcbiAgICB0aGlzLmNoYXRfYm94ID0gbnVsbDtcbiAgICB0aGlzLmNoYXRfY29udGFpbmVyID0gbnVsbDtcbiAgICB0aGlzLmN1cnJlbnRfY2hhdF9tbCA9IFtdO1xuICAgIHRoaXMuZmlsZXMgPSBbXTtcbiAgICB0aGlzLmxhc3RfZnJvbSA9IG51bGw7XG4gICAgdGhpcy5tZXNzYWdlX2NvbnRhaW5lciA9IG51bGw7XG4gICAgdGhpcy5wcmV2ZW50X2lucHV0ID0gZmFsc2U7XG4gIH1cbiAgZ2V0RGlzcGxheVRleHQoKSB7XG4gICAgcmV0dXJuIFwiU21hcnQgQ29ubmVjdGlvbnMgQ2hhdFwiO1xuICB9XG4gIGdldEljb24oKSB7XG4gICAgcmV0dXJuIFwibWVzc2FnZS1zcXVhcmVcIjtcbiAgfVxuICBnZXRWaWV3VHlwZSgpIHtcbiAgICByZXR1cm4gU01BUlRfQ09OTkVDVElPTlNfQ0hBVF9WSUVXX1RZUEU7XG4gIH1cbiAgb25PcGVuKCkge1xuICAgIHRoaXMubmV3X2NoYXQoKTtcbiAgICB0aGlzLnBsdWdpbi5nZXRfYWxsX2ZvbGRlcnMoKTsgLy8gc2V0cyB0aGlzLnBsdWdpbi5mb2xkZXJzIG5lY2Vzc2FyeSBmb3IgZm9sZGVyLWNvbnRleHRcbiAgfVxuICBvbkNsb3NlKCkge1xuICAgIHRoaXMuY2hhdC5zYXZlX2NoYXQoKTtcbiAgICB0aGlzLmFwcC53b3Jrc3BhY2UudW5yZWdpc3RlckhvdmVyTGlua1NvdXJjZShTTUFSVF9DT05ORUNUSU9OU19DSEFUX1ZJRVdfVFlQRSk7XG4gIH1cbiAgcmVuZGVyX2NoYXQoKSB7XG4gICAgdGhpcy5jb250YWluZXJFbC5lbXB0eSgpO1xuICAgIHRoaXMuY2hhdF9jb250YWluZXIgPSB0aGlzLmNvbnRhaW5lckVsLmNyZWF0ZURpdihcInNjLWNoYXQtY29udGFpbmVyXCIpO1xuICAgIC8vIHJlbmRlciBwbHVzIHNpZ24gZm9yIGNsZWFyIGJ1dHRvblxuICAgIHRoaXMucmVuZGVyX3RvcF9iYXIoKTtcbiAgICAvLyByZW5kZXIgY2hhdCBtZXNzYWdlcyBjb250YWluZXJcbiAgICB0aGlzLnJlbmRlcl9jaGF0X2JveCgpO1xuICAgIC8vIHJlbmRlciBjaGF0IGlucHV0XG4gICAgdGhpcy5yZW5kZXJfY2hhdF9pbnB1dCgpO1xuICAgIHRoaXMucGx1Z2luLnJlbmRlcl9icmFuZCh0aGlzLmNvbnRhaW5lckVsLCBcImNoYXRcIik7XG4gIH1cbiAgLy8gcmVuZGVyIHBsdXMgc2lnbiBmb3IgY2xlYXIgYnV0dG9uXG4gIHJlbmRlcl90b3BfYmFyKCkge1xuICAgIC8vIGNyZWF0ZSBjb250YWluZXIgZm9yIGNsZWFyIGJ1dHRvblxuICAgIGxldCB0b3BfYmFyX2NvbnRhaW5lciA9IHRoaXMuY2hhdF9jb250YWluZXIuY3JlYXRlRGl2KFwic2MtdG9wLWJhci1jb250YWluZXJcIik7XG4gICAgLy8gcmVuZGVyIHRoZSBuYW1lIG9mIHRoZSBjaGF0IGluIGFuIGlucHV0IGJveCAocG9wIGNvbnRlbnQgYWZ0ZXIgbGFzdCBoeXBoZW4gaW4gY2hhdF9pZClcbiAgICBsZXQgY2hhdF9uYW1lID10aGlzLmNoYXQubmFtZSgpO1xuICAgIGxldCBjaGF0X25hbWVfaW5wdXQgPSB0b3BfYmFyX2NvbnRhaW5lci5jcmVhdGVFbChcImlucHV0XCIsIHtcbiAgICAgIGF0dHI6IHtcbiAgICAgICAgdHlwZTogXCJ0ZXh0XCIsXG4gICAgICAgIHZhbHVlOiBjaGF0X25hbWVcbiAgICAgIH0sXG4gICAgICBjbHM6IFwic2MtY2hhdC1uYW1lLWlucHV0XCJcbiAgICB9KTtcbiAgICBjaGF0X25hbWVfaW5wdXQuYWRkRXZlbnRMaXN0ZW5lcihcImNoYW5nZVwiLCB0aGlzLnJlbmFtZV9jaGF0LmJpbmQodGhpcykpO1xuICAgIFxuICAgIC8vIGNyZWF0ZSBidXR0b24gdG8gU21hcnQgVmlld1xuICAgIGxldCBzbWFydF92aWV3X2J0biA9IHRoaXMuY3JlYXRlX3RvcF9iYXJfYnV0dG9uKHRvcF9iYXJfY29udGFpbmVyLCBcIlNtYXJ0IFZpZXdcIiwgXCJzbWFydC1jb25uZWN0aW9uc1wiKTtcbiAgICBzbWFydF92aWV3X2J0bi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgdGhpcy5vcGVuX3NtYXJ0X3ZpZXcuYmluZCh0aGlzKSk7XG4gICAgLy8gY3JlYXRlIGJ1dHRvbiB0byBzYXZlIGNoYXRcbiAgICBsZXQgc2F2ZV9idG4gPSB0aGlzLmNyZWF0ZV90b3BfYmFyX2J1dHRvbih0b3BfYmFyX2NvbnRhaW5lciwgXCJTYXZlIENoYXRcIiwgXCJzYXZlXCIpO1xuICAgIHNhdmVfYnRuLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCB0aGlzLnNhdmVfY2hhdC5iaW5kKHRoaXMpKTtcbiAgICAvLyBjcmVhdGUgYnV0dG9uIHRvIG9wZW4gY2hhdCBoaXN0b3J5IG1vZGFsXG4gICAgbGV0IGhpc3RvcnlfYnRuID0gdGhpcy5jcmVhdGVfdG9wX2Jhcl9idXR0b24odG9wX2Jhcl9jb250YWluZXIsIFwiQ2hhdCBIaXN0b3J5XCIsIFwiaGlzdG9yeVwiKTtcbiAgICBoaXN0b3J5X2J0bi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgdGhpcy5vcGVuX2NoYXRfaGlzdG9yeS5iaW5kKHRoaXMpKTtcbiAgICAvLyBjcmVhdGUgYnV0dG9uIHRvIHN0YXJ0IG5ldyBjaGF0XG4gICAgY29uc3QgbmV3X2NoYXRfYnRuID0gdGhpcy5jcmVhdGVfdG9wX2Jhcl9idXR0b24odG9wX2Jhcl9jb250YWluZXIsIFwiTmV3IENoYXRcIiwgXCJwbHVzXCIpO1xuICAgIG5ld19jaGF0X2J0bi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgdGhpcy5uZXdfY2hhdC5iaW5kKHRoaXMpKTtcbiAgfVxuICBhc3luYyBvcGVuX2NoYXRfaGlzdG9yeSgpIHtcbiAgICBjb25zdCBmb2xkZXIgPSBhd2FpdCB0aGlzLmFwcC52YXVsdC5hZGFwdGVyLmxpc3QoXCIuc21hcnQtY29ubmVjdGlvbnMvY2hhdHNcIik7XG4gICAgdGhpcy5maWxlcyA9IGZvbGRlci5maWxlcy5tYXAoKGZpbGUpID0+IHtcbiAgICAgIHJldHVybiBmaWxlLnJlcGxhY2UoXCIuc21hcnQtY29ubmVjdGlvbnMvY2hhdHMvXCIsIFwiXCIpLnJlcGxhY2UoXCIuanNvblwiLCBcIlwiKTtcbiAgICB9KTtcbiAgICAvLyBvcGVuIGNoYXQgaGlzdG9yeSBtb2RhbFxuICAgIGlmICghdGhpcy5tb2RhbClcbiAgICAgIHRoaXMubW9kYWwgPSBuZXcgU21hcnRDb25uZWN0aW9uc0NoYXRIaXN0b3J5TW9kYWwodGhpcy5hcHAsIHRoaXMpO1xuICAgIHRoaXMubW9kYWwub3BlbigpO1xuICB9XG5cbiAgY3JlYXRlX3RvcF9iYXJfYnV0dG9uKHRvcF9iYXJfY29udGFpbmVyLCB0aXRsZSwgaWNvbj1udWxsKSB7XG4gICAgbGV0IGJ0biA9IHRvcF9iYXJfY29udGFpbmVyLmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHtcbiAgICAgIGF0dHI6IHtcbiAgICAgICAgdGl0bGU6IHRpdGxlXG4gICAgICB9XG4gICAgfSk7XG4gICAgaWYoaWNvbil7XG4gICAgICBPYnNpZGlhbi5zZXRJY29uKGJ0biwgaWNvbik7XG4gICAgfWVsc2V7XG4gICAgICBidG4uaW5uZXJIVE1MID0gdGl0bGU7XG4gICAgfVxuICAgIHJldHVybiBidG47XG4gIH1cbiAgLy8gcmVuZGVyIG5ldyBjaGF0XG4gIG5ld19jaGF0KCkge1xuICAgIHRoaXMuY2xlYXJfY2hhdCgpO1xuICAgIHRoaXMucmVuZGVyX2NoYXQoKTtcbiAgICAvLyByZW5kZXIgaW5pdGlhbCBtZXNzYWdlIGZyb20gYXNzaXN0YW50IChkb24ndCB1c2UgcmVuZGVyX21lc3NhZ2UgdG8gc2tpcCBhZGRpbmcgdG8gY2hhdCBoaXN0b3J5KVxuICAgIHRoaXMubmV3X21lc3NzYWdlX2J1YmJsZShcImFzc2lzdGFudFwiKTtcbiAgICB0aGlzLmFjdGl2ZV9lbG0uaW5uZXJIVE1MID0gJzxwPicgKyBTTUFSVF9UUkFOU0xBVElPTlt0aGlzLnBsdWdpbi5zZXR0aW5ncy5sYW5ndWFnZV0uaW5pdGlhbF9tZXNzYWdlKyc8L3A+JztcbiAgfVxuICAvLyBvcGVuIGEgY2hhdCBmcm9tIHRoZSBjaGF0IGhpc3RvcnkgbW9kYWxcbiAgYXN5bmMgb3Blbl9jaGF0KGNoYXRfaWQpIHtcbiAgICB0aGlzLmNsZWFyX2NoYXQoKTtcbiAgICBhd2FpdCB0aGlzLmNoYXQubG9hZF9jaGF0KGNoYXRfaWQpO1xuICAgIHRoaXMucmVuZGVyX2NoYXQoKTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuY2hhdC5jaGF0X21sLmxlbmd0aDsgaSsrKSB7XG4gICAgICBhd2FpdCB0aGlzLnJlbmRlcl9tZXNzYWdlKHRoaXMuY2hhdC5jaGF0X21sW2ldLmNvbnRlbnQsIHRoaXMuY2hhdC5jaGF0X21sW2ldLnJvbGUpO1xuICAgIH1cbiAgfVxuICAvLyBjbGVhciBjdXJyZW50IGNoYXQgc3RhdGVcbiAgY2xlYXJfY2hhdCgpIHtcbiAgICBpZiAodGhpcy5jaGF0KSB7XG4gICAgICB0aGlzLmNoYXQuc2F2ZV9jaGF0KCk7XG4gICAgfVxuICAgIHRoaXMuY2hhdCA9IG5ldyBTbWFydENvbm5lY3Rpb25zQ2hhdE1vZGVsKHRoaXMucGx1Z2luKTtcbiAgICAvLyBpZiB0aGlzLmRvdGRvdGRvdF9pbnRlcnZhbCBpcyBub3QgbnVsbCwgY2xlYXIgaW50ZXJ2YWxcbiAgICBpZiAodGhpcy5kb3Rkb3Rkb3RfaW50ZXJ2YWwpIHtcbiAgICAgIGNsZWFySW50ZXJ2YWwodGhpcy5kb3Rkb3Rkb3RfaW50ZXJ2YWwpO1xuICAgIH1cbiAgICAvLyBjbGVhciBjdXJyZW50IGNoYXQgbWxcbiAgICB0aGlzLmN1cnJlbnRfY2hhdF9tbCA9IFtdO1xuICAgIC8vIHVwZGF0ZSBwcmV2ZW50IGlucHV0XG4gICAgdGhpcy5lbmRfc3RyZWFtKCk7XG4gIH1cblxuICByZW5hbWVfY2hhdChldmVudCkge1xuICAgIGxldCBuZXdfY2hhdF9uYW1lID0gZXZlbnQudGFyZ2V0LnZhbHVlO1xuICAgIHRoaXMuY2hhdC5yZW5hbWVfY2hhdChuZXdfY2hhdF9uYW1lKTtcbiAgfVxuICBcbiAgLy8gc2F2ZSBjdXJyZW50IGNoYXRcbiAgc2F2ZV9jaGF0KCkge1xuICAgIHRoaXMuY2hhdC5zYXZlX2NoYXQoKTtcbiAgICBuZXcgT2JzaWRpYW4uTm90aWNlKFwiW1NtYXJ0IENvbm5lY3Rpb25zXSBDaGF0IHNhdmVkXCIpO1xuICB9XG4gIFxuICBvcGVuX3NtYXJ0X3ZpZXcoKSB7XG4gICAgdGhpcy5wbHVnaW4ub3Blbl92aWV3KCk7XG4gIH1cbiAgLy8gcmVuZGVyIGNoYXQgbWVzc2FnZXMgY29udGFpbmVyXG4gIHJlbmRlcl9jaGF0X2JveCgpIHtcbiAgICAvLyBjcmVhdGUgY29udGFpbmVyIGZvciBjaGF0IG1lc3NhZ2VzXG4gICAgdGhpcy5jaGF0X2JveCA9IHRoaXMuY2hhdF9jb250YWluZXIuY3JlYXRlRGl2KFwic2MtY2hhdC1ib3hcIik7XG4gICAgLy8gY3JlYXRlIGNvbnRhaW5lciBmb3IgbWVzc2FnZVxuICAgIHRoaXMubWVzc2FnZV9jb250YWluZXIgPSB0aGlzLmNoYXRfYm94LmNyZWF0ZURpdihcInNjLW1lc3NhZ2UtY29udGFpbmVyXCIpO1xuICB9XG4gIC8vIG9wZW4gZmlsZSBzdWdnZXN0aW9uIG1vZGFsXG4gIG9wZW5fZmlsZV9zdWdnZXN0aW9uX21vZGFsKCkge1xuICAgIC8vIG9wZW4gZmlsZSBzdWdnZXN0aW9uIG1vZGFsXG4gICAgaWYoIXRoaXMuZmlsZV9zZWxlY3RvcikgdGhpcy5maWxlX3NlbGVjdG9yID0gbmV3IFNtYXJ0Q29ubmVjdGlvbnNGaWxlU2VsZWN0TW9kYWwodGhpcy5hcHAsIHRoaXMpO1xuICAgIHRoaXMuZmlsZV9zZWxlY3Rvci5vcGVuKCk7XG4gIH1cbiAgLy8gb3BlbiBmb2xkZXIgc3VnZ2VzdGlvbiBtb2RhbFxuICBhc3luYyBvcGVuX2ZvbGRlcl9zdWdnZXN0aW9uX21vZGFsKCkge1xuICAgIC8vIG9wZW4gZm9sZGVyIHN1Z2dlc3Rpb24gbW9kYWxcbiAgICBpZighdGhpcy5mb2xkZXJfc2VsZWN0b3Ipe1xuICAgICAgdGhpcy5mb2xkZXJfc2VsZWN0b3IgPSBuZXcgU21hcnRDb25uZWN0aW9uc0ZvbGRlclNlbGVjdE1vZGFsKHRoaXMuYXBwLCB0aGlzKTtcbiAgICB9XG4gICAgdGhpcy5mb2xkZXJfc2VsZWN0b3Iub3BlbigpO1xuICB9XG4gIC8vIGluc2VydF9zZWxlY3Rpb24gZnJvbSBmaWxlIHN1Z2dlc3Rpb24gbW9kYWxcbiAgaW5zZXJ0X3NlbGVjdGlvbihpbnNlcnRfdGV4dCkge1xuICAgIC8vIGdldCBjYXJldCBwb3NpdGlvblxuICAgIGxldCBjYXJldF9wb3MgPSB0aGlzLnRleHRhcmVhLnNlbGVjdGlvblN0YXJ0O1xuICAgIC8vIGdldCB0ZXh0IGJlZm9yZSBjYXJldFxuICAgIGxldCB0ZXh0X2JlZm9yZSA9IHRoaXMudGV4dGFyZWEudmFsdWUuc3Vic3RyaW5nKDAsIGNhcmV0X3Bvcyk7XG4gICAgLy8gZ2V0IHRleHQgYWZ0ZXIgY2FyZXRcbiAgICBsZXQgdGV4dF9hZnRlciA9IHRoaXMudGV4dGFyZWEudmFsdWUuc3Vic3RyaW5nKGNhcmV0X3BvcywgdGhpcy50ZXh0YXJlYS52YWx1ZS5sZW5ndGgpO1xuICAgIC8vIGluc2VydCB0ZXh0XG4gICAgdGhpcy50ZXh0YXJlYS52YWx1ZSA9IHRleHRfYmVmb3JlICsgaW5zZXJ0X3RleHQgKyB0ZXh0X2FmdGVyO1xuICAgIC8vIHNldCBjYXJldCBwb3NpdGlvblxuICAgIHRoaXMudGV4dGFyZWEuc2VsZWN0aW9uU3RhcnQgPSBjYXJldF9wb3MgKyBpbnNlcnRfdGV4dC5sZW5ndGg7XG4gICAgdGhpcy50ZXh0YXJlYS5zZWxlY3Rpb25FbmQgPSBjYXJldF9wb3MgKyBpbnNlcnRfdGV4dC5sZW5ndGg7XG4gICAgLy8gZm9jdXMgb24gdGV4dGFyZWFcbiAgICB0aGlzLnRleHRhcmVhLmZvY3VzKCk7XG4gIH1cblxuICAvLyByZW5kZXIgY2hhdCB0ZXh0YXJlYSBhbmQgYnV0dG9uXG4gIHJlbmRlcl9jaGF0X2lucHV0KCkge1xuICAgIC8vIGNyZWF0ZSBjb250YWluZXIgZm9yIGNoYXQgaW5wdXRcbiAgICBsZXQgY2hhdF9pbnB1dCA9IHRoaXMuY2hhdF9jb250YWluZXIuY3JlYXRlRGl2KFwic2MtY2hhdC1mb3JtXCIpO1xuICAgIC8vIGNyZWF0ZSB0ZXh0YXJlYVxuICAgIHRoaXMudGV4dGFyZWEgPSBjaGF0X2lucHV0LmNyZWF0ZUVsKFwidGV4dGFyZWFcIiwge1xuICAgICAgY2xzOiBcInNjLWNoYXQtaW5wdXRcIixcbiAgICAgIGF0dHI6IHtcbiAgICAgICAgcGxhY2Vob2xkZXI6IGBUcnkgXCJCYXNlZCBvbiBteSBub3Rlc1wiIG9yIFwiU3VtbWFyaXplIFtbdGhpcyBub3RlXV1cIiBvciBcIkltcG9ydGFudCB0YXNrcyBpbiAvZm9sZGVyL1wiYFxuICAgICAgfVxuICAgIH0pO1xuICAgIC8vIHVzZSBjb250ZW50ZWRpdGFibGUgaW5zdGVhZCBvZiB0ZXh0YXJlYVxuICAgIC8vIHRoaXMudGV4dGFyZWEgPSBjaGF0X2lucHV0LmNyZWF0ZUVsKFwiZGl2XCIsIHtjbHM6IFwic2MtY2hhdC1pbnB1dFwiLCBhdHRyOiB7Y29udGVudGVkaXRhYmxlOiB0cnVlfX0pO1xuICAgIC8vIGFkZCBldmVudCBsaXN0ZW5lciB0byBsaXN0ZW4gZm9yIHNoaWZ0K2VudGVyXG4gICAgY2hhdF9pbnB1dC5hZGRFdmVudExpc3RlbmVyKFwia2V5dXBcIiwgKGUpID0+IHtcbiAgICAgIGlmKFtcIltcIiwgXCIvXCJdLmluZGV4T2YoZS5rZXkpID09PSAtMSkgcmV0dXJuOyAvLyBza2lwIGlmIGtleSBpcyBub3QgWyBvciAvXG4gICAgICBjb25zdCBjYXJldF9wb3MgPSB0aGlzLnRleHRhcmVhLnNlbGVjdGlvblN0YXJ0O1xuICAgICAgLy8gaWYga2V5IGlzIG9wZW4gc3F1YXJlIGJyYWNrZXRcbiAgICAgIGlmIChlLmtleSA9PT0gXCJbXCIpIHtcbiAgICAgICAgLy8gaWYgcHJldmlvdXMgY2hhciBpcyBbXG4gICAgICAgIGlmKHRoaXMudGV4dGFyZWEudmFsdWVbY2FyZXRfcG9zIC0gMl0gPT09IFwiW1wiKXtcbiAgICAgICAgICAvLyBvcGVuIGZpbGUgc3VnZ2VzdGlvbiBtb2RhbFxuICAgICAgICAgIHRoaXMub3Blbl9maWxlX3N1Z2dlc3Rpb25fbW9kYWwoKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgIH1lbHNle1xuICAgICAgICB0aGlzLmJyYWNrZXRzX2N0ID0gMDtcbiAgICAgIH1cbiAgICAgIC8vIGlmIC8gaXMgcHJlc3NlZFxuICAgICAgaWYgKGUua2V5ID09PSBcIi9cIikge1xuICAgICAgICAvLyBnZXQgY2FyZXQgcG9zaXRpb25cbiAgICAgICAgLy8gaWYgdGhpcyBpcyBmaXJzdCBjaGFyIG9yIHByZXZpb3VzIGNoYXIgaXMgc3BhY2VcbiAgICAgICAgaWYgKHRoaXMudGV4dGFyZWEudmFsdWUubGVuZ3RoID09PSAxIHx8IHRoaXMudGV4dGFyZWEudmFsdWVbY2FyZXRfcG9zIC0gMl0gPT09IFwiIFwiKSB7XG4gICAgICAgICAgLy8gb3BlbiBmb2xkZXIgc3VnZ2VzdGlvbiBtb2RhbFxuICAgICAgICAgIHRoaXMub3Blbl9mb2xkZXJfc3VnZ2VzdGlvbl9tb2RhbCgpO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgfSk7XG5cbiAgICBjaGF0X2lucHV0LmFkZEV2ZW50TGlzdGVuZXIoXCJrZXlkb3duXCIsIChlKSA9PiB7XG4gICAgICBpZiAoZS5rZXkgPT09IFwiRW50ZXJcIiAmJiBlLnNoaWZ0S2V5KSB7XG4gICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgaWYodGhpcy5wcmV2ZW50X2lucHV0KXtcbiAgICAgICAgICBjb25zb2xlLmxvZyhcIndhaXQgdW50aWwgY3VycmVudCByZXNwb25zZSBpcyBmaW5pc2hlZFwiKTtcbiAgICAgICAgICBuZXcgT2JzaWRpYW4uTm90aWNlKFwiW1NtYXJ0IENvbm5lY3Rpb25zXSBXYWl0IHVudGlsIGN1cnJlbnQgcmVzcG9uc2UgaXMgZmluaXNoZWRcIik7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIC8vIGdldCB0ZXh0IGZyb20gdGV4dGFyZWFcbiAgICAgICAgbGV0IHVzZXJfaW5wdXQgPSB0aGlzLnRleHRhcmVhLnZhbHVlO1xuICAgICAgICAvLyBjbGVhciB0ZXh0YXJlYVxuICAgICAgICB0aGlzLnRleHRhcmVhLnZhbHVlID0gXCJcIjtcbiAgICAgICAgLy8gaW5pdGlhdGUgcmVzcG9uc2UgZnJvbSBhc3Npc3RhbnRcbiAgICAgICAgdGhpcy5pbml0aWFsaXplX3Jlc3BvbnNlKHVzZXJfaW5wdXQpO1xuICAgICAgfVxuICAgICAgdGhpcy50ZXh0YXJlYS5zdHlsZS5oZWlnaHQgPSAnYXV0byc7XG4gICAgICB0aGlzLnRleHRhcmVhLnN0eWxlLmhlaWdodCA9ICh0aGlzLnRleHRhcmVhLnNjcm9sbEhlaWdodCkgKyAncHgnO1xuICAgIH0pO1xuICAgIC8vIGJ1dHRvbiBjb250YWluZXJcbiAgICBsZXQgYnV0dG9uX2NvbnRhaW5lciA9IGNoYXRfaW5wdXQuY3JlYXRlRGl2KFwic2MtYnV0dG9uLWNvbnRhaW5lclwiKTtcbiAgICAvLyBjcmVhdGUgaGlkZGVuIGFib3J0IGJ1dHRvblxuICAgIGxldCBhYm9ydF9idXR0b24gPSBidXR0b25fY29udGFpbmVyLmNyZWF0ZUVsKFwic3BhblwiLCB7IGF0dHI6IHtpZDogXCJzYy1hYm9ydC1idXR0b25cIiwgc3R5bGU6IFwiZGlzcGxheTogbm9uZTtcIn0gfSk7XG4gICAgT2JzaWRpYW4uc2V0SWNvbihhYm9ydF9idXR0b24sIFwic3F1YXJlXCIpO1xuICAgIC8vIGFkZCBldmVudCBsaXN0ZW5lciB0byBidXR0b25cbiAgICBhYm9ydF9idXR0b24uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHtcbiAgICAgIC8vIGFib3J0IGN1cnJlbnQgcmVzcG9uc2VcbiAgICAgIHRoaXMuZW5kX3N0cmVhbSgpO1xuICAgIH0pO1xuICAgIC8vIGNyZWF0ZSBidXR0b25cbiAgICBsZXQgYnV0dG9uID0gYnV0dG9uX2NvbnRhaW5lci5jcmVhdGVFbChcImJ1dHRvblwiLCB7IGF0dHI6IHtpZDogXCJzYy1zZW5kLWJ1dHRvblwifSwgY2xzOiBcInNlbmQtYnV0dG9uXCIgfSk7XG4gICAgYnV0dG9uLmlubmVySFRNTCA9IFwiU2VuZFwiO1xuICAgIC8vIGFkZCBldmVudCBsaXN0ZW5lciB0byBidXR0b25cbiAgICBidXR0b24uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHtcbiAgICAgIGlmKHRoaXMucHJldmVudF9pbnB1dCl7XG4gICAgICAgIGNvbnNvbGUubG9nKFwid2FpdCB1bnRpbCBjdXJyZW50IHJlc3BvbnNlIGlzIGZpbmlzaGVkXCIpO1xuICAgICAgICBuZXcgT2JzaWRpYW4uTm90aWNlKFwiV2FpdCB1bnRpbCBjdXJyZW50IHJlc3BvbnNlIGlzIGZpbmlzaGVkXCIpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICAvLyBnZXQgdGV4dCBmcm9tIHRleHRhcmVhXG4gICAgICBsZXQgdXNlcl9pbnB1dCA9IHRoaXMudGV4dGFyZWEudmFsdWU7XG4gICAgICAvLyBjbGVhciB0ZXh0YXJlYVxuICAgICAgdGhpcy50ZXh0YXJlYS52YWx1ZSA9IFwiXCI7XG4gICAgICAvLyBpbml0aWF0ZSByZXNwb25zZSBmcm9tIGFzc2lzdGFudFxuICAgICAgdGhpcy5pbml0aWFsaXplX3Jlc3BvbnNlKHVzZXJfaW5wdXQpO1xuICAgIH0pO1xuICB9XG4gIGFzeW5jIGluaXRpYWxpemVfcmVzcG9uc2UodXNlcl9pbnB1dCkge1xuICAgIHRoaXMuc2V0X3N0cmVhbWluZ191eCgpO1xuICAgIC8vIHJlbmRlciBtZXNzYWdlXG4gICAgYXdhaXQgdGhpcy5yZW5kZXJfbWVzc2FnZSh1c2VyX2lucHV0LCBcInVzZXJcIik7XG4gICAgdGhpcy5jaGF0Lm5ld19tZXNzYWdlX2luX3RocmVhZCh7XG4gICAgICByb2xlOiBcInVzZXJcIixcbiAgICAgIGNvbnRlbnQ6IHVzZXJfaW5wdXRcbiAgICB9KTtcbiAgICBhd2FpdCB0aGlzLnJlbmRlcl9kb3Rkb3Rkb3QoKTtcblxuICAgIC8vIGlmIGNvbnRhaW5zIGludGVybmFsIGxpbmsgcmVwcmVzZW50ZWQgYnkgW1tsaW5rXV1cbiAgICBpZih0aGlzLmNoYXQuY29udGFpbnNfaW50ZXJuYWxfbGluayh1c2VyX2lucHV0KSkge1xuICAgICAgdGhpcy5jaGF0LmdldF9yZXNwb25zZV93aXRoX25vdGVfY29udGV4dCh1c2VyX2lucHV0LCB0aGlzKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgLy8gLy8gZm9yIHRlc3RpbmcgcHVycG9zZXNcbiAgICAvLyBpZih0aGlzLmNoYXQuY29udGFpbnNfZm9sZGVyX3JlZmVyZW5jZSh1c2VyX2lucHV0KSkge1xuICAgIC8vICAgY29uc3QgZm9sZGVycyA9IHRoaXMuY2hhdC5nZXRfZm9sZGVyX3JlZmVyZW5jZXModXNlcl9pbnB1dCk7XG4gICAgLy8gICBjb25zb2xlLmxvZyhmb2xkZXJzKTtcbiAgICAvLyAgIHJldHVybjtcbiAgICAvLyB9XG4gICAgLy8gaWYgY29udGFpbnMgc2VsZiByZWZlcmVudGlhbCBrZXl3b3JkcyBvciBmb2xkZXIgcmVmZXJlbmNlXG4gICAgaWYodGhpcy5jb250YWluc19zZWxmX3JlZmVyZW50aWFsX2tleXdvcmRzKHVzZXJfaW5wdXQpIHx8IHRoaXMuY2hhdC5jb250YWluc19mb2xkZXJfcmVmZXJlbmNlKHVzZXJfaW5wdXQpKSB7XG4gICAgICAvLyBnZXQgaHlkZVxuICAgICAgY29uc3QgY29udGV4dCA9IGF3YWl0IHRoaXMuZ2V0X2NvbnRleHRfaHlkZSh1c2VyX2lucHV0KTtcbiAgICAgIC8vIGdldCB1c2VyIGlucHV0IHdpdGggYWRkZWQgY29udGV4dFxuICAgICAgLy8gY29uc3QgY29udGV4dF9pbnB1dCA9IHRoaXMuYnVpbGRfY29udGV4dF9pbnB1dChjb250ZXh0KTtcbiAgICAgIC8vIGNvbnNvbGUubG9nKGNvbnRleHRfaW5wdXQpO1xuICAgICAgY29uc3QgY2hhdG1sID0gW1xuICAgICAgICB7XG4gICAgICAgICAgcm9sZTogXCJzeXN0ZW1cIixcbiAgICAgICAgICAvLyBjb250ZW50OiBjb250ZXh0X2lucHV0XG4gICAgICAgICAgY29udGVudDogY29udGV4dFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgcm9sZTogXCJ1c2VyXCIsXG4gICAgICAgICAgY29udGVudDogdXNlcl9pbnB1dFxuICAgICAgICB9XG4gICAgICBdO1xuICAgICAgdGhpcy5yZXF1ZXN0X2NoYXRncHRfY29tcGxldGlvbih7bWVzc2FnZXM6IGNoYXRtbCwgdGVtcGVyYXR1cmU6IDB9KTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgLy8gY29tcGxldGlvbiB3aXRob3V0IGFueSBzcGVjaWZpYyBjb250ZXh0XG4gICAgdGhpcy5yZXF1ZXN0X2NoYXRncHRfY29tcGxldGlvbigpO1xuICB9XG4gIFxuICBhc3luYyByZW5kZXJfZG90ZG90ZG90KCkge1xuICAgIGlmICh0aGlzLmRvdGRvdGRvdF9pbnRlcnZhbClcbiAgICAgIGNsZWFySW50ZXJ2YWwodGhpcy5kb3Rkb3Rkb3RfaW50ZXJ2YWwpO1xuICAgIGF3YWl0IHRoaXMucmVuZGVyX21lc3NhZ2UoXCIuLi5cIiwgXCJhc3Npc3RhbnRcIik7XG4gICAgLy8gaWYgaXMgJy4uLicsIHRoZW4gaW5pdGlhdGUgaW50ZXJ2YWwgdG8gY2hhbmdlIHRvICcuJyBhbmQgdGhlbiB0byAnLi4nIGFuZCB0aGVuIHRvICcuLi4nXG4gICAgbGV0IGRvdHMgPSAwO1xuICAgIHRoaXMuYWN0aXZlX2VsbS5pbm5lckhUTUwgPSAnLi4uJztcbiAgICB0aGlzLmRvdGRvdGRvdF9pbnRlcnZhbCA9IHNldEludGVydmFsKCgpID0+IHtcbiAgICAgIGRvdHMrKztcbiAgICAgIGlmIChkb3RzID4gMylcbiAgICAgICAgZG90cyA9IDE7XG4gICAgICB0aGlzLmFjdGl2ZV9lbG0uaW5uZXJIVE1MID0gJy4nLnJlcGVhdChkb3RzKTtcbiAgICB9LCA1MDApO1xuICAgIC8vIHdhaXQgMiBzZWNvbmRzIGZvciB0ZXN0aW5nXG4gICAgLy8gYXdhaXQgbmV3IFByb21pc2UociA9PiBzZXRUaW1lb3V0KHIsIDIwMDApKTtcbiAgfVxuXG4gIHNldF9zdHJlYW1pbmdfdXgoKSB7XG4gICAgdGhpcy5wcmV2ZW50X2lucHV0ID0gdHJ1ZTtcbiAgICAvLyBoaWRlIHNlbmQgYnV0dG9uXG4gICAgaWYoZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJzYy1zZW5kLWJ1dHRvblwiKSlcbiAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwic2Mtc2VuZC1idXR0b25cIikuc3R5bGUuZGlzcGxheSA9IFwibm9uZVwiO1xuICAgIC8vIHNob3cgYWJvcnQgYnV0dG9uXG4gICAgaWYoZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJzYy1hYm9ydC1idXR0b25cIikpXG4gICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcInNjLWFib3J0LWJ1dHRvblwiKS5zdHlsZS5kaXNwbGF5ID0gXCJibG9ja1wiO1xuICB9XG4gIHVuc2V0X3N0cmVhbWluZ191eCgpIHtcbiAgICB0aGlzLnByZXZlbnRfaW5wdXQgPSBmYWxzZTtcbiAgICAvLyBzaG93IHNlbmQgYnV0dG9uLCByZW1vdmUgZGlzcGxheSBub25lXG4gICAgaWYoZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJzYy1zZW5kLWJ1dHRvblwiKSlcbiAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwic2Mtc2VuZC1idXR0b25cIikuc3R5bGUuZGlzcGxheSA9IFwiXCI7XG4gICAgLy8gaGlkZSBhYm9ydCBidXR0b25cbiAgICBpZihkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcInNjLWFib3J0LWJ1dHRvblwiKSlcbiAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwic2MtYWJvcnQtYnV0dG9uXCIpLnN0eWxlLmRpc3BsYXkgPSBcIm5vbmVcIjtcbiAgfVxuXG5cbiAgLy8gY2hlY2sgaWYgaW5jbHVkZXMga2V5d29yZHMgcmVmZXJyaW5nIHRvIG9uZSdzIG93biBub3Rlc1xuICBjb250YWluc19zZWxmX3JlZmVyZW50aWFsX2tleXdvcmRzKHVzZXJfaW5wdXQpIHtcbiAgICBjb25zdCBtYXRjaGVzID0gdXNlcl9pbnB1dC5tYXRjaCh0aGlzLnBsdWdpbi5zZWxmX3JlZl9rd19yZWdleCk7XG4gICAgaWYobWF0Y2hlcykgcmV0dXJuIHRydWU7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgLy8gcmVuZGVyIG1lc3NhZ2VcbiAgYXN5bmMgcmVuZGVyX21lc3NhZ2UobWVzc2FnZSwgZnJvbT1cImFzc2lzdGFudFwiLCBhcHBlbmRfbGFzdD1mYWxzZSkge1xuICAgIC8vIGlmIGRvdGRvdGRvdCBpbnRlcnZhbCBpcyBzZXQsIHRoZW4gY2xlYXIgaXRcbiAgICBpZih0aGlzLmRvdGRvdGRvdF9pbnRlcnZhbCkge1xuICAgICAgY2xlYXJJbnRlcnZhbCh0aGlzLmRvdGRvdGRvdF9pbnRlcnZhbCk7XG4gICAgICB0aGlzLmRvdGRvdGRvdF9pbnRlcnZhbCA9IG51bGw7XG4gICAgICAvLyBjbGVhciBsYXN0IG1lc3NhZ2VcbiAgICAgIHRoaXMuYWN0aXZlX2VsbS5pbm5lckhUTUwgPSAnJztcbiAgICB9XG4gICAgaWYoYXBwZW5kX2xhc3QpIHtcbiAgICAgIHRoaXMuY3VycmVudF9tZXNzYWdlX3JhdyArPSBtZXNzYWdlO1xuICAgICAgaWYobWVzc2FnZS5pbmRleE9mKCdcXG4nKSA9PT0gLTEpIHtcbiAgICAgICAgdGhpcy5hY3RpdmVfZWxtLmlubmVySFRNTCArPSBtZXNzYWdlO1xuICAgICAgfWVsc2V7XG4gICAgICAgIHRoaXMuYWN0aXZlX2VsbS5pbm5lckhUTUwgPSAnJztcbiAgICAgICAgLy8gYXBwZW5kIHRvIGxhc3QgbWVzc2FnZVxuICAgICAgICBhd2FpdCBPYnNpZGlhbi5NYXJrZG93blJlbmRlcmVyLnJlbmRlck1hcmtkb3duKHRoaXMuY3VycmVudF9tZXNzYWdlX3JhdywgdGhpcy5hY3RpdmVfZWxtLCAnP25vLWRhdGF2aWV3JywgbmV3IE9ic2lkaWFuLkNvbXBvbmVudCgpKTtcbiAgICAgIH1cbiAgICB9ZWxzZXtcbiAgICAgIHRoaXMuY3VycmVudF9tZXNzYWdlX3JhdyA9ICcnO1xuICAgICAgaWYoKHRoaXMuY2hhdC50aHJlYWQubGVuZ3RoID09PSAwKSB8fCAodGhpcy5sYXN0X2Zyb20gIT09IGZyb20pKSB7XG4gICAgICAgIC8vIGNyZWF0ZSBtZXNzYWdlXG4gICAgICAgIHRoaXMubmV3X21lc3NzYWdlX2J1YmJsZShmcm9tKTtcbiAgICAgIH1cbiAgICAgIC8vIHNldCBtZXNzYWdlIHRleHRcbiAgICAgIHRoaXMuYWN0aXZlX2VsbS5pbm5lckhUTUwgPSAnJztcbiAgICAgIGF3YWl0IE9ic2lkaWFuLk1hcmtkb3duUmVuZGVyZXIucmVuZGVyTWFya2Rvd24obWVzc2FnZSwgdGhpcy5hY3RpdmVfZWxtLCAnP25vLWRhdGF2aWV3JywgbmV3IE9ic2lkaWFuLkNvbXBvbmVudCgpKTtcbiAgICAgIC8vIGdldCBsaW5rc1xuICAgICAgdGhpcy5oYW5kbGVfbGlua3NfaW5fbWVzc2FnZSgpO1xuICAgICAgLy8gcmVuZGVyIGJ1dHRvbihzKVxuICAgICAgdGhpcy5yZW5kZXJfbWVzc2FnZV9hY3Rpb25fYnV0dG9ucyhtZXNzYWdlKTtcbiAgICB9XG4gICAgLy8gc2Nyb2xsIHRvIGJvdHRvbVxuICAgIHRoaXMubWVzc2FnZV9jb250YWluZXIuc2Nyb2xsVG9wID0gdGhpcy5tZXNzYWdlX2NvbnRhaW5lci5zY3JvbGxIZWlnaHQ7XG4gIH1cbiAgcmVuZGVyX21lc3NhZ2VfYWN0aW9uX2J1dHRvbnMobWVzc2FnZSkge1xuICAgIGlmICh0aGlzLmNoYXQuY29udGV4dCAmJiB0aGlzLmNoYXQuaHlkKSB7XG4gICAgICAvLyByZW5kZXIgYnV0dG9uIHRvIGNvcHkgaHlkIGluIHNtYXJ0LWNvbm5lY3Rpb25zIGNvZGUgYmxvY2tcbiAgICAgIGNvbnN0IGNvbnRleHRfdmlldyA9IHRoaXMuYWN0aXZlX2VsbS5jcmVhdGVFbChcInNwYW5cIiwge1xuICAgICAgICBjbHM6IFwic2MtbXNnLWJ1dHRvblwiLFxuICAgICAgICBhdHRyOiB7XG4gICAgICAgICAgdGl0bGU6IFwiQ29weSBjb250ZXh0IHRvIGNsaXBib2FyZFwiIC8qIHRvb2x0aXAgKi9cbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgICBjb25zdCB0aGlzX2h5ZCA9IHRoaXMuY2hhdC5oeWQ7XG4gICAgICBPYnNpZGlhbi5zZXRJY29uKGNvbnRleHRfdmlldywgXCJleWVcIik7XG4gICAgICBjb250ZXh0X3ZpZXcuYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHtcbiAgICAgICAgLy8gY29weSB0byBjbGlwYm9hcmRcbiAgICAgICAgbmF2aWdhdG9yLmNsaXBib2FyZC53cml0ZVRleHQoXCJgYGBzbWFydC1jb25uZWN0aW9uc1xcblwiICsgdGhpc19oeWQgKyBcIlxcbmBgYFxcblwiKTtcbiAgICAgICAgbmV3IE9ic2lkaWFuLk5vdGljZShcIltTbWFydCBDb25uZWN0aW9uc10gQ29udGV4dCBjb2RlIGJsb2NrIGNvcGllZCB0byBjbGlwYm9hcmRcIik7XG4gICAgICB9KTtcbiAgICB9XG4gICAgaWYodGhpcy5jaGF0LmNvbnRleHQpIHtcbiAgICAgIC8vIHJlbmRlciBjb3B5IGNvbnRleHQgYnV0dG9uXG4gICAgICBjb25zdCBjb3B5X3Byb21wdF9idXR0b24gPSB0aGlzLmFjdGl2ZV9lbG0uY3JlYXRlRWwoXCJzcGFuXCIsIHtcbiAgICAgICAgY2xzOiBcInNjLW1zZy1idXR0b25cIixcbiAgICAgICAgYXR0cjoge1xuICAgICAgICAgIHRpdGxlOiBcIkNvcHkgcHJvbXB0IHRvIGNsaXBib2FyZFwiIC8qIHRvb2x0aXAgKi9cbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgICBjb25zdCB0aGlzX2NvbnRleHQgPSB0aGlzLmNoYXQuY29udGV4dC5yZXBsYWNlKC9cXGBcXGBcXGAvZywgXCJcXHRgYGBcIikudHJpbUxlZnQoKTtcbiAgICAgIE9ic2lkaWFuLnNldEljb24oY29weV9wcm9tcHRfYnV0dG9uLCBcImZpbGVzXCIpO1xuICAgICAgY29weV9wcm9tcHRfYnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiB7XG4gICAgICAgIC8vIGNvcHkgdG8gY2xpcGJvYXJkXG4gICAgICAgIG5hdmlnYXRvci5jbGlwYm9hcmQud3JpdGVUZXh0KFwiYGBgcHJvbXB0LWNvbnRleHRcXG5cIiArIHRoaXNfY29udGV4dCArIFwiXFxuYGBgXFxuXCIpO1xuICAgICAgICBuZXcgT2JzaWRpYW4uTm90aWNlKFwiW1NtYXJ0IENvbm5lY3Rpb25zXSBDb250ZXh0IGNvcGllZCB0byBjbGlwYm9hcmRcIik7XG4gICAgICB9KTtcbiAgICB9XG4gICAgLy8gcmVuZGVyIGNvcHkgYnV0dG9uXG4gICAgY29uc3QgY29weV9idXR0b24gPSB0aGlzLmFjdGl2ZV9lbG0uY3JlYXRlRWwoXCJzcGFuXCIsIHtcbiAgICAgIGNsczogXCJzYy1tc2ctYnV0dG9uXCIsXG4gICAgICBhdHRyOiB7XG4gICAgICAgIHRpdGxlOiBcIkNvcHkgbWVzc2FnZSB0byBjbGlwYm9hcmRcIiAvKiB0b29sdGlwICovXG4gICAgICB9XG4gICAgfSk7XG4gICAgT2JzaWRpYW4uc2V0SWNvbihjb3B5X2J1dHRvbiwgXCJjb3B5XCIpO1xuICAgIGNvcHlfYnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiB7XG4gICAgICAvLyBjb3B5IG1lc3NhZ2UgdG8gY2xpcGJvYXJkXG4gICAgICBuYXZpZ2F0b3IuY2xpcGJvYXJkLndyaXRlVGV4dChtZXNzYWdlLnRyaW1MZWZ0KCkpO1xuICAgICAgbmV3IE9ic2lkaWFuLk5vdGljZShcIltTbWFydCBDb25uZWN0aW9uc10gTWVzc2FnZSBjb3BpZWQgdG8gY2xpcGJvYXJkXCIpO1xuICAgIH0pO1xuICB9XG5cbiAgaGFuZGxlX2xpbmtzX2luX21lc3NhZ2UoKSB7XG4gICAgY29uc3QgbGlua3MgPSB0aGlzLmFjdGl2ZV9lbG0ucXVlcnlTZWxlY3RvckFsbChcImFcIik7XG4gICAgLy8gaWYgdGhpcyBhY3RpdmUgZWxlbWVudCBjb250YWlucyBhIGxpbmtcbiAgICBpZiAobGlua3MubGVuZ3RoID4gMCkge1xuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsaW5rcy5sZW5ndGg7IGkrKykge1xuICAgICAgICBjb25zdCBsaW5rID0gbGlua3NbaV07XG4gICAgICAgIGNvbnN0IGxpbmtfdGV4dCA9IGxpbmsuZ2V0QXR0cmlidXRlKFwiZGF0YS1ocmVmXCIpO1xuICAgICAgICAvLyB0cmlnZ2VyIGhvdmVyIGV2ZW50IG9uIGxpbmtcbiAgICAgICAgbGluay5hZGRFdmVudExpc3RlbmVyKFwibW91c2VvdmVyXCIsIChldmVudCkgPT4ge1xuICAgICAgICAgIHRoaXMuYXBwLndvcmtzcGFjZS50cmlnZ2VyKFwiaG92ZXItbGlua1wiLCB7XG4gICAgICAgICAgICBldmVudCxcbiAgICAgICAgICAgIHNvdXJjZTogU01BUlRfQ09OTkVDVElPTlNfQ0hBVF9WSUVXX1RZUEUsXG4gICAgICAgICAgICBob3ZlclBhcmVudDogbGluay5wYXJlbnRFbGVtZW50LFxuICAgICAgICAgICAgdGFyZ2V0RWw6IGxpbmssXG4gICAgICAgICAgICAvLyBleHRyYWN0IGxpbmsgdGV4dCBmcm9tIGEuZGF0YS1ocmVmXG4gICAgICAgICAgICBsaW5rdGV4dDogbGlua190ZXh0XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgICAgICAvLyB0cmlnZ2VyIG9wZW4gbGluayBldmVudCBvbiBsaW5rXG4gICAgICAgIGxpbmsuYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIChldmVudCkgPT4ge1xuICAgICAgICAgIGNvbnN0IGxpbmtfdGZpbGUgPSB0aGlzLmFwcC5tZXRhZGF0YUNhY2hlLmdldEZpcnN0TGlua3BhdGhEZXN0KGxpbmtfdGV4dCwgXCIvXCIpO1xuICAgICAgICAgIC8vIHByb3Blcmx5IGhhbmRsZSBpZiB0aGUgbWV0YS9jdHJsIGtleSBpcyBwcmVzc2VkXG4gICAgICAgICAgY29uc3QgbW9kID0gT2JzaWRpYW4uS2V5bWFwLmlzTW9kRXZlbnQoZXZlbnQpO1xuICAgICAgICAgIC8vIGdldCBtb3N0IHJlY2VudCBsZWFmXG4gICAgICAgICAgbGV0IGxlYWYgPSB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0TGVhZihtb2QpO1xuICAgICAgICAgIGxlYWYub3BlbkZpbGUobGlua190ZmlsZSk7XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIG5ld19tZXNzc2FnZV9idWJibGUoZnJvbSkge1xuICAgIGxldCBtZXNzYWdlX2VsID0gdGhpcy5tZXNzYWdlX2NvbnRhaW5lci5jcmVhdGVEaXYoYHNjLW1lc3NhZ2UgJHtmcm9tfWApO1xuICAgIC8vIGNyZWF0ZSBtZXNzYWdlIGNvbnRlbnRcbiAgICB0aGlzLmFjdGl2ZV9lbG0gPSBtZXNzYWdlX2VsLmNyZWF0ZURpdihcInNjLW1lc3NhZ2UtY29udGVudFwiKTtcbiAgICAvLyBzZXQgbGFzdCBmcm9tXG4gICAgdGhpcy5sYXN0X2Zyb20gPSBmcm9tO1xuICB9XG5cbiAgYXN5bmMgcmVxdWVzdF9jaGF0Z3B0X2NvbXBsZXRpb24ob3B0cz17fSkge1xuICAgIGNvbnN0IGNoYXRfbWwgPSBvcHRzLm1lc3NhZ2VzIHx8IG9wdHMuY2hhdF9tbCB8fCB0aGlzLmNoYXQucHJlcGFyZV9jaGF0X21sKCk7XG4gICAgY29uc29sZS5sb2coXCJjaGF0X21sXCIsIGNoYXRfbWwpO1xuICAgIGNvbnN0IG1heF90b3RhbF90b2tlbnMgPSBNYXRoLnJvdW5kKGdldF9tYXhfY2hhcnModGhpcy5wbHVnaW4uc2V0dGluZ3Muc21hcnRfY2hhdF9tb2RlbCkgLyA0KTtcbiAgICBjb25zb2xlLmxvZyhcIm1heF90b3RhbF90b2tlbnNcIiwgbWF4X3RvdGFsX3Rva2Vucyk7XG4gICAgY29uc3QgY3Vycl90b2tlbl9lc3QgPSBNYXRoLnJvdW5kKEpTT04uc3RyaW5naWZ5KGNoYXRfbWwpLmxlbmd0aCAvIDMpO1xuICAgIGNvbnNvbGUubG9nKFwiY3Vycl90b2tlbl9lc3RcIiwgY3Vycl90b2tlbl9lc3QpO1xuICAgIGxldCBtYXhfYXZhaWxhYmxlX3Rva2VucyA9IG1heF90b3RhbF90b2tlbnMgLSBjdXJyX3Rva2VuX2VzdDtcbiAgICAvLyBpZiBtYXhfYXZhaWxhYmxlX3Rva2VucyBpcyBsZXNzIHRoYW4gMCwgc2V0IHRvIDIwMFxuICAgIGlmKG1heF9hdmFpbGFibGVfdG9rZW5zIDwgMCkgbWF4X2F2YWlsYWJsZV90b2tlbnMgPSAyMDA7XG4gICAgY29uc29sZS5sb2coXCJtYXhfYXZhaWxhYmxlX3Rva2Vuc1wiLCBtYXhfYXZhaWxhYmxlX3Rva2Vucyk7XG4gICAgb3B0cyA9IHtcbiAgICAgIG1vZGVsOiB0aGlzLnBsdWdpbi5zZXR0aW5ncy5zbWFydF9jaGF0X21vZGVsLFxuICAgICAgbWVzc2FnZXM6IGNoYXRfbWwsXG4gICAgICAvLyBtYXhfdG9rZW5zOiAyNTAsXG4gICAgICBtYXhfdG9rZW5zOiBtYXhfYXZhaWxhYmxlX3Rva2VucyxcbiAgICAgIHRlbXBlcmF0dXJlOiAwLjMsXG4gICAgICB0b3BfcDogMSxcbiAgICAgIHByZXNlbmNlX3BlbmFsdHk6IDAsXG4gICAgICBmcmVxdWVuY3lfcGVuYWx0eTogMCxcbiAgICAgIHN0cmVhbTogdHJ1ZSxcbiAgICAgIHN0b3A6IG51bGwsXG4gICAgICBuOiAxLFxuICAgICAgLy8gbG9naXRfYmlhczogbG9naXRfYmlhcyxcbiAgICAgIC4uLm9wdHNcbiAgICB9XG4gICAgLy8gY29uc29sZS5sb2cob3B0cy5tZXNzYWdlcyk7XG4gICAgaWYob3B0cy5zdHJlYW0pIHtcbiAgICAgIGNvbnN0IGZ1bGxfc3RyID0gYXdhaXQgbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgIC8vIGNvbnNvbGUubG9nKFwic3RyZWFtXCIsIG9wdHMpO1xuICAgICAgICAgIGNvbnN0IHVybCA9IFwiaHR0cHM6Ly9hcGkub3BlbmFpLmNvbS92MS9jaGF0L2NvbXBsZXRpb25zXCI7XG4gICAgICAgICAgdGhpcy5hY3RpdmVfc3RyZWFtID0gbmV3IFNjU3RyZWFtZXIodXJsLCB7XG4gICAgICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgICAgIFwiQ29udGVudC1UeXBlXCI6IFwiYXBwbGljYXRpb24vanNvblwiLFxuICAgICAgICAgICAgICBBdXRob3JpemF0aW9uOiBgQmVhcmVyICR7dGhpcy5wbHVnaW4uc2V0dGluZ3MuYXBpX2tleX1gXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgbWV0aG9kOiBcIlBPU1RcIixcbiAgICAgICAgICAgIHBheWxvYWQ6IEpTT04uc3RyaW5naWZ5KG9wdHMpXG4gICAgICAgICAgfSk7XG4gICAgICAgICAgbGV0IHR4dCA9IFwiXCI7XG4gICAgICAgICAgdGhpcy5hY3RpdmVfc3RyZWFtLmFkZEV2ZW50TGlzdGVuZXIoXCJtZXNzYWdlXCIsIChlKSA9PiB7XG4gICAgICAgICAgICBpZiAoZS5kYXRhICE9IFwiW0RPTkVdXCIpIHtcbiAgICAgICAgICAgICAgY29uc3QgcGF5bG9hZCA9IEpTT04ucGFyc2UoZS5kYXRhKTtcbiAgICAgICAgICAgICAgY29uc3QgdGV4dCA9IHBheWxvYWQuY2hvaWNlc1swXS5kZWx0YS5jb250ZW50O1xuICAgICAgICAgICAgICBpZiAoIXRleHQpIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgdHh0ICs9IHRleHQ7XG4gICAgICAgICAgICAgIHRoaXMucmVuZGVyX21lc3NhZ2UodGV4dCwgXCJhc3Npc3RhbnRcIiwgdHJ1ZSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICB0aGlzLmVuZF9zdHJlYW0oKTtcbiAgICAgICAgICAgICAgcmVzb2x2ZSh0eHQpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pO1xuICAgICAgICAgIHRoaXMuYWN0aXZlX3N0cmVhbS5hZGRFdmVudExpc3RlbmVyKFwicmVhZHlzdGF0ZWNoYW5nZVwiLCAoZSkgPT4ge1xuICAgICAgICAgICAgaWYgKGUucmVhZHlTdGF0ZSA+PSAyKSB7XG4gICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiUmVhZHlTdGF0ZTogXCIgKyBlLnJlYWR5U3RhdGUpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pO1xuICAgICAgICAgIHRoaXMuYWN0aXZlX3N0cmVhbS5hZGRFdmVudExpc3RlbmVyKFwiZXJyb3JcIiwgKGUpID0+IHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoZSk7XG4gICAgICAgICAgICBuZXcgT2JzaWRpYW4uTm90aWNlKFwiU21hcnQgQ29ubmVjdGlvbnMgRXJyb3IgU3RyZWFtaW5nIFJlc3BvbnNlLiBTZWUgY29uc29sZSBmb3IgZGV0YWlscy5cIik7XG4gICAgICAgICAgICB0aGlzLnJlbmRlcl9tZXNzYWdlKFwiKkFQSSBFcnJvci4gU2VlIGNvbnNvbGUgbG9ncyBmb3IgZGV0YWlscy4qXCIsIFwiYXNzaXN0YW50XCIpO1xuICAgICAgICAgICAgdGhpcy5lbmRfc3RyZWFtKCk7XG4gICAgICAgICAgICByZWplY3QoZSk7XG4gICAgICAgICAgfSk7XG4gICAgICAgICAgdGhpcy5hY3RpdmVfc3RyZWFtLnN0cmVhbSgpO1xuICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICBjb25zb2xlLmVycm9yKGVycik7XG4gICAgICAgICAgbmV3IE9ic2lkaWFuLk5vdGljZShcIlNtYXJ0IENvbm5lY3Rpb25zIEVycm9yIFN0cmVhbWluZyBSZXNwb25zZS4gU2VlIGNvbnNvbGUgZm9yIGRldGFpbHMuXCIpO1xuICAgICAgICAgIHRoaXMuZW5kX3N0cmVhbSgpO1xuICAgICAgICAgIHJlamVjdChlcnIpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICAgIC8vIGNvbnNvbGUubG9nKGZ1bGxfc3RyKTtcbiAgICAgIGF3YWl0IHRoaXMucmVuZGVyX21lc3NhZ2UoZnVsbF9zdHIsIFwiYXNzaXN0YW50XCIpO1xuICAgICAgdGhpcy5jaGF0Lm5ld19tZXNzYWdlX2luX3RocmVhZCh7XG4gICAgICAgIHJvbGU6IFwiYXNzaXN0YW50XCIsXG4gICAgICAgIGNvbnRlbnQ6IGZ1bGxfc3RyXG4gICAgICB9KTtcbiAgICAgIHJldHVybjtcbiAgICB9ZWxzZXtcbiAgICAgIHRyeXtcbiAgICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCAoMCwgT2JzaWRpYW4ucmVxdWVzdFVybCkoe1xuICAgICAgICAgIHVybDogYGh0dHBzOi8vYXBpLm9wZW5haS5jb20vdjEvY2hhdC9jb21wbGV0aW9uc2AsXG4gICAgICAgICAgbWV0aG9kOiBcIlBPU1RcIixcbiAgICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgICBBdXRob3JpemF0aW9uOiBgQmVhcmVyICR7dGhpcy5wbHVnaW4uc2V0dGluZ3MuYXBpX2tleX1gLFxuICAgICAgICAgICAgXCJDb250ZW50LVR5cGVcIjogXCJhcHBsaWNhdGlvbi9qc29uXCJcbiAgICAgICAgICB9LFxuICAgICAgICAgIGNvbnRlbnRUeXBlOiBcImFwcGxpY2F0aW9uL2pzb25cIixcbiAgICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeShvcHRzKSxcbiAgICAgICAgICB0aHJvdzogZmFsc2VcbiAgICAgICAgfSk7XG4gICAgICAgIC8vIGNvbnNvbGUubG9nKHJlc3BvbnNlKTtcbiAgICAgICAgcmV0dXJuIEpTT04ucGFyc2UocmVzcG9uc2UudGV4dCkuY2hvaWNlc1swXS5tZXNzYWdlLmNvbnRlbnQ7XG4gICAgICB9Y2F0Y2goZXJyKXtcbiAgICAgICAgbmV3IE9ic2lkaWFuLk5vdGljZShgU21hcnQgQ29ubmVjdGlvbnMgQVBJIEVycm9yIDo6ICR7ZXJyfWApO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGVuZF9zdHJlYW0oKSB7XG4gICAgaWYodGhpcy5hY3RpdmVfc3RyZWFtKXtcbiAgICAgIHRoaXMuYWN0aXZlX3N0cmVhbS5jbG9zZSgpO1xuICAgICAgdGhpcy5hY3RpdmVfc3RyZWFtID0gbnVsbDtcbiAgICB9XG4gICAgdGhpcy51bnNldF9zdHJlYW1pbmdfdXgoKTtcbiAgICBpZih0aGlzLmRvdGRvdGRvdF9pbnRlcnZhbCl7XG4gICAgICBjbGVhckludGVydmFsKHRoaXMuZG90ZG90ZG90X2ludGVydmFsKTtcbiAgICAgIHRoaXMuZG90ZG90ZG90X2ludGVydmFsID0gbnVsbDtcbiAgICAgIC8vIHJlbW92ZSBwYXJlbnQgb2YgYWN0aXZlX2VsbVxuICAgICAgdGhpcy5hY3RpdmVfZWxtLnBhcmVudEVsZW1lbnQucmVtb3ZlKCk7XG4gICAgICB0aGlzLmFjdGl2ZV9lbG0gPSBudWxsO1xuICAgIH1cbiAgfVxuXG4gIGFzeW5jIGdldF9jb250ZXh0X2h5ZGUodXNlcl9pbnB1dCkge1xuICAgIHRoaXMuY2hhdC5yZXNldF9jb250ZXh0KCk7XG4gICAgLy8gY291bnQgY3VycmVudCBjaGF0IG1sIG1lc3NhZ2VzIHRvIGRldGVybWluZSAncXVlc3Rpb24nIG9yICdjaGF0IGxvZycgd29yZGluZ1xuICAgIGNvbnN0IGh5ZF9pbnB1dCA9IGBBbnRpY2lwYXRlIHdoYXQgdGhlIHVzZXIgaXMgc2Vla2luZy4gUmVzcG9uZCBpbiB0aGUgZm9ybSBvZiBhIGh5cG90aGV0aWNhbCBub3RlIHdyaXR0ZW4gYnkgdGhlIHVzZXIuIFRoZSBub3RlIG1heSBjb250YWluIHN0YXRlbWVudHMgYXMgcGFyYWdyYXBocywgbGlzdHMsIG9yIGNoZWNrbGlzdHMgaW4gbWFya2Rvd24gZm9ybWF0IHdpdGggbm8gaGVhZGluZ3MuIFBsZWFzZSByZXNwb25kIHdpdGggb25lIGh5cG90aGV0aWNhbCBub3RlIGFuZCBhYnN0YWluIGZyb20gYW55IG90aGVyIGNvbW1lbnRhcnkuIFVzZSB0aGUgZm9ybWF0OiBQQVJFTlQgRk9MREVSIE5BTUUgPiBDSElMRCBGT0xERVIgTkFNRSA+IEZJTEUgTkFNRSA+IEhFQURJTkcgMSA+IEhFQURJTkcgMiA+IEhFQURJTkcgMzogSFlQT1RIRVRJQ0FMIE5PVEUgQ09OVEVOVFMuYDtcbiAgICAvLyBjb21wbGV0ZVxuICAgIGNvbnN0IGNoYXRtbCA9IFtcbiAgICAgIHtcbiAgICAgICAgcm9sZTogXCJzeXN0ZW1cIixcbiAgICAgICAgY29udGVudDogaHlkX2lucHV0IFxuICAgICAgfSxcbiAgICAgIHtcbiAgICAgICAgcm9sZTogXCJ1c2VyXCIsXG4gICAgICAgIGNvbnRlbnQ6IHVzZXJfaW5wdXRcbiAgICAgIH1cbiAgICBdO1xuICAgIGNvbnN0IGh5ZCA9IGF3YWl0IHRoaXMucmVxdWVzdF9jaGF0Z3B0X2NvbXBsZXRpb24oe1xuICAgICAgbWVzc2FnZXM6IGNoYXRtbCxcbiAgICAgIHN0cmVhbTogZmFsc2UsXG4gICAgICB0ZW1wZXJhdHVyZTogMCxcbiAgICAgIG1heF90b2tlbnM6IDEzNyxcbiAgICB9KTtcbiAgICB0aGlzLmNoYXQuaHlkID0gaHlkO1xuICAgIC8vIGNvbnNvbGUubG9nKGh5ZCk7XG4gICAgbGV0IGZpbHRlciA9IHt9O1xuICAgIC8vIGlmIGNvbnRhaW5zIGZvbGRlciByZWZlcmVuY2UgcmVwcmVzZW50ZWQgYnkgL2ZvbGRlci9cbiAgICBpZih0aGlzLmNoYXQuY29udGFpbnNfZm9sZGVyX3JlZmVyZW5jZSh1c2VyX2lucHV0KSkge1xuICAgICAgLy8gZ2V0IGZvbGRlciByZWZlcmVuY2VzXG4gICAgICBjb25zdCBmb2xkZXJfcmVmcyA9IHRoaXMuY2hhdC5nZXRfZm9sZGVyX3JlZmVyZW5jZXModXNlcl9pbnB1dCk7XG4gICAgICAvLyBjb25zb2xlLmxvZyhmb2xkZXJfcmVmcyk7XG4gICAgICAvLyBpZiBmb2xkZXIgcmVmZXJlbmNlcyBhcmUgdmFsaWQgKHN0cmluZyBvciBhcnJheSBvZiBzdHJpbmdzKVxuICAgICAgaWYoZm9sZGVyX3JlZnMpe1xuICAgICAgICBmaWx0ZXIgPSB7XG4gICAgICAgICAgcGF0aF9iZWdpbnNfd2l0aDogZm9sZGVyX3JlZnNcbiAgICAgICAgfTtcbiAgICAgIH1cbiAgICB9XG4gICAgLy8gc2VhcmNoIGZvciBuZWFyZXN0IGJhc2VkIG9uIGh5ZFxuICAgIGxldCBuZWFyZXN0ID0gYXdhaXQgdGhpcy5wbHVnaW4uYXBpLnNlYXJjaChoeWQsIGZpbHRlcik7XG4gICAgY29uc29sZS5sb2coXCJuZWFyZXN0XCIsIG5lYXJlc3QubGVuZ3RoKTtcbiAgICBuZWFyZXN0ID0gdGhpcy5nZXRfbmVhcmVzdF91bnRpbF9uZXh0X2Rldl9leGNlZWRzX3N0ZF9kZXYobmVhcmVzdCk7XG4gICAgY29uc29sZS5sb2coXCJuZWFyZXN0IGFmdGVyIHN0ZCBkZXYgc2xpY2VcIiwgbmVhcmVzdC5sZW5ndGgpO1xuICAgIG5lYXJlc3QgPSB0aGlzLnNvcnRfYnlfbGVuX2FkanVzdGVkX3NpbWlsYXJpdHkobmVhcmVzdCk7XG4gICAgXG4gICAgcmV0dXJuIGF3YWl0IHRoaXMuZ2V0X2NvbnRleHRfZm9yX3Byb21wdChuZWFyZXN0KTtcbiAgfVxuICBcbiAgXG4gIHNvcnRfYnlfbGVuX2FkanVzdGVkX3NpbWlsYXJpdHkobmVhcmVzdCkge1xuICAgIC8vIHJlLXNvcnQgYnkgcXVvdGllbnQgb2Ygc2ltaWxhcml0eSBkaXZpZGVkIGJ5IGxlbiBERVNDXG4gICAgbmVhcmVzdCA9IG5lYXJlc3Quc29ydCgoYSwgYikgPT4ge1xuICAgICAgY29uc3QgYV9zY29yZSA9IGEuc2ltaWxhcml0eSAvIGEubGVuO1xuICAgICAgY29uc3QgYl9zY29yZSA9IGIuc2ltaWxhcml0eSAvIGIubGVuO1xuICAgICAgLy8gaWYgYSBpcyBncmVhdGVyIHRoYW4gYiwgcmV0dXJuIC0xXG4gICAgICBpZiAoYV9zY29yZSA+IGJfc2NvcmUpXG4gICAgICAgIHJldHVybiAtMTtcbiAgICAgIC8vIGlmIGEgaXMgbGVzcyB0aGFuIGIsIHJldHVybiAxXG4gICAgICBpZiAoYV9zY29yZSA8IGJfc2NvcmUpXG4gICAgICAgIHJldHVybiAxO1xuICAgICAgLy8gaWYgYSBpcyBlcXVhbCB0byBiLCByZXR1cm4gMFxuICAgICAgcmV0dXJuIDA7XG4gICAgfSk7XG4gICAgcmV0dXJuIG5lYXJlc3Q7XG4gIH1cblxuICBnZXRfbmVhcmVzdF91bnRpbF9uZXh0X2Rldl9leGNlZWRzX3N0ZF9kZXYobmVhcmVzdCkge1xuICAgIC8vIGdldCBzdGQgZGV2IG9mIHNpbWlsYXJpdHlcbiAgICBjb25zdCBzaW0gPSBuZWFyZXN0Lm1hcCgobikgPT4gbi5zaW1pbGFyaXR5KTtcbiAgICBjb25zdCBtZWFuID0gc2ltLnJlZHVjZSgoYSwgYikgPT4gYSArIGIpIC8gc2ltLmxlbmd0aDtcbiAgICBjb25zdCBzdGRfZGV2ID0gTWF0aC5zcXJ0KHNpbS5tYXAoKHgpID0+IE1hdGgucG93KHggLSBtZWFuLCAyKSkucmVkdWNlKChhLCBiKSA9PiBhICsgYikgLyBzaW0ubGVuZ3RoKTtcbiAgICAvLyBzbGljZSB3aGVyZSBuZXh0IGl0ZW0gZGV2aWF0aW9uIGlzIGdyZWF0ZXIgdGhhbiBzdGRfZGV2XG4gICAgbGV0IHNsaWNlX2kgPSAwO1xuICAgIHdoaWxlIChzbGljZV9pIDwgbmVhcmVzdC5sZW5ndGgpIHtcbiAgICAgIGNvbnN0IG5leHQgPSBuZWFyZXN0W3NsaWNlX2kgKyAxXTtcbiAgICAgIGlmIChuZXh0KSB7XG4gICAgICAgIGNvbnN0IG5leHRfZGV2ID0gTWF0aC5hYnMobmV4dC5zaW1pbGFyaXR5IC0gbmVhcmVzdFtzbGljZV9pXS5zaW1pbGFyaXR5KTtcbiAgICAgICAgaWYgKG5leHRfZGV2ID4gc3RkX2Rldikge1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBzbGljZV9pKys7XG4gICAgfVxuICAgIC8vIHNlbGVjdCB0b3AgcmVzdWx0c1xuICAgIG5lYXJlc3QgPSBuZWFyZXN0LnNsaWNlKDAsIHNsaWNlX2krMSk7XG4gICAgcmV0dXJuIG5lYXJlc3Q7XG4gIH1cbiAgLy8gdGhpcy50ZXN0X2dldF9uZWFyZXN0X3VudGlsX25leHRfZGV2X2V4Y2VlZHNfc3RkX2RldigpO1xuICAvLyAvLyB0ZXN0IGdldF9uZWFyZXN0X3VudGlsX25leHRfZGV2X2V4Y2VlZHNfc3RkX2RldlxuICAvLyB0ZXN0X2dldF9uZWFyZXN0X3VudGlsX25leHRfZGV2X2V4Y2VlZHNfc3RkX2RldigpIHtcbiAgLy8gICBjb25zdCBuZWFyZXN0ID0gW3tzaW1pbGFyaXR5OiAwLjk5fSwge3NpbWlsYXJpdHk6IDAuOTh9LCB7c2ltaWxhcml0eTogMC45N30sIHtzaW1pbGFyaXR5OiAwLjk2fSwge3NpbWlsYXJpdHk6IDAuOTV9LCB7c2ltaWxhcml0eTogMC45NH0sIHtzaW1pbGFyaXR5OiAwLjkzfSwge3NpbWlsYXJpdHk6IDAuOTJ9LCB7c2ltaWxhcml0eTogMC45MX0sIHtzaW1pbGFyaXR5OiAwLjl9LCB7c2ltaWxhcml0eTogMC43OX0sIHtzaW1pbGFyaXR5OiAwLjc4fSwge3NpbWlsYXJpdHk6IDAuNzd9LCB7c2ltaWxhcml0eTogMC43Nn0sIHtzaW1pbGFyaXR5OiAwLjc1fSwge3NpbWlsYXJpdHk6IDAuNzR9LCB7c2ltaWxhcml0eTogMC43M30sIHtzaW1pbGFyaXR5OiAwLjcyfV07XG4gIC8vICAgY29uc3QgcmVzdWx0ID0gdGhpcy5nZXRfbmVhcmVzdF91bnRpbF9uZXh0X2Rldl9leGNlZWRzX3N0ZF9kZXYobmVhcmVzdCk7XG4gIC8vICAgaWYocmVzdWx0Lmxlbmd0aCAhPT0gMTApe1xuICAvLyAgICAgY29uc29sZS5lcnJvcihcImdldF9uZWFyZXN0X3VudGlsX25leHRfZGV2X2V4Y2VlZHNfc3RkX2RldiBmYWlsZWRcIiwgcmVzdWx0KTtcbiAgLy8gICB9XG4gIC8vIH1cblxuICBhc3luYyBnZXRfY29udGV4dF9mb3JfcHJvbXB0KG5lYXJlc3QpIHtcbiAgICBsZXQgY29udGV4dCA9IFtdO1xuICAgIGNvbnN0IE1BWF9TT1VSQ0VTID0gMjA7IC8vIDEwICogMTAwMCAobWF4IGNoYXJzKSA9IDEwLDAwMCBjaGFycyAobXVzdCBiZSB1bmRlciB+MTYsMDAwIGNoYXJzIG9yIDRLIHRva2VucykgXG4gICAgY29uc3QgTUFYX0NIQVJTID0gZ2V0X21heF9jaGFycyh0aGlzLnBsdWdpbi5zZXR0aW5ncy5zbWFydF9jaGF0X21vZGVsKSAvIDI7XG4gICAgbGV0IGNoYXJfYWNjdW0gPSAwO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbmVhcmVzdC5sZW5ndGg7IGkrKykge1xuICAgICAgaWYgKGNvbnRleHQubGVuZ3RoID49IE1BWF9TT1VSQ0VTKVxuICAgICAgICBicmVhaztcbiAgICAgIGlmIChjaGFyX2FjY3VtID49IE1BWF9DSEFSUylcbiAgICAgICAgYnJlYWs7XG4gICAgICBpZiAodHlwZW9mIG5lYXJlc3RbaV0ubGluayAhPT0gJ3N0cmluZycpXG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgLy8gZ2VuZXJhdGUgYnJlYWRjcnVtYnNcbiAgICAgIGNvbnN0IGJyZWFkY3J1bWJzID0gbmVhcmVzdFtpXS5saW5rLnJlcGxhY2UoLyMvZywgXCIgPiBcIikucmVwbGFjZShcIi5tZFwiLCBcIlwiKS5yZXBsYWNlKC9cXC8vZywgXCIgPiBcIik7XG4gICAgICBsZXQgbmV3X2NvbnRleHQgPSBgJHticmVhZGNydW1ic306XFxuYDtcbiAgICAgIC8vIGdldCBtYXggYXZhaWxhYmxlIGNoYXJzIHRvIGFkZCB0byBjb250ZXh0XG4gICAgICBjb25zdCBtYXhfYXZhaWxhYmxlX2NoYXJzID0gTUFYX0NIQVJTIC0gY2hhcl9hY2N1bSAtIG5ld19jb250ZXh0Lmxlbmd0aDtcbiAgICAgIGlmIChuZWFyZXN0W2ldLmxpbmsuaW5kZXhPZihcIiNcIikgIT09IC0xKSB7IC8vIGlzIGJsb2NrXG4gICAgICAgIG5ld19jb250ZXh0ICs9IGF3YWl0IHRoaXMucGx1Z2luLmJsb2NrX3JldHJpZXZlcihuZWFyZXN0W2ldLmxpbmssIHsgbWF4X2NoYXJzOiBtYXhfYXZhaWxhYmxlX2NoYXJzIH0pO1xuICAgICAgfSBlbHNlIHsgLy8gaXMgZmlsZVxuICAgICAgICBuZXdfY29udGV4dCArPSBhd2FpdCB0aGlzLnBsdWdpbi5maWxlX3JldHJpZXZlcihuZWFyZXN0W2ldLmxpbmssIHsgbWF4X2NoYXJzOiBtYXhfYXZhaWxhYmxlX2NoYXJzIH0pO1xuICAgICAgfVxuICAgICAgLy8gYWRkIHRvIGNoYXJfYWNjdW1cbiAgICAgIGNoYXJfYWNjdW0gKz0gbmV3X2NvbnRleHQubGVuZ3RoO1xuICAgICAgLy8gYWRkIHRvIGNvbnRleHRcbiAgICAgIGNvbnRleHQucHVzaCh7XG4gICAgICAgIGxpbms6IG5lYXJlc3RbaV0ubGluayxcbiAgICAgICAgdGV4dDogbmV3X2NvbnRleHRcbiAgICAgIH0pO1xuICAgIH1cbiAgICAvLyBjb250ZXh0IHNvdXJjZXNcbiAgICBjb25zb2xlLmxvZyhcImNvbnRleHQgc291cmNlczogXCIgKyBjb250ZXh0Lmxlbmd0aCk7XG4gICAgLy8gY2hhcl9hY2N1bSBkaXZpZGVkIGJ5IDQgYW5kIHJvdW5kZWQgdG8gbmVhcmVzdCBpbnRlZ2VyIGZvciBlc3RpbWF0ZWQgdG9rZW5zXG4gICAgY29uc29sZS5sb2coXCJ0b3RhbCBjb250ZXh0IHRva2VuczogflwiICsgTWF0aC5yb3VuZChjaGFyX2FjY3VtIC8gMy41KSk7XG4gICAgLy8gYnVpbGQgY29udGV4dCBpbnB1dFxuICAgIHRoaXMuY2hhdC5jb250ZXh0ID0gYEFudGljaXBhdGUgdGhlIHR5cGUgb2YgYW5zd2VyIGRlc2lyZWQgYnkgdGhlIHVzZXIuIEltYWdpbmUgdGhlIGZvbGxvd2luZyAke2NvbnRleHQubGVuZ3RofSBub3RlcyB3ZXJlIHdyaXR0ZW4gYnkgdGhlIHVzZXIgYW5kIGNvbnRhaW4gYWxsIHRoZSBuZWNlc3NhcnkgaW5mb3JtYXRpb24gdG8gYW5zd2VyIHRoZSB1c2VyJ3MgcXVlc3Rpb24uIEJlZ2luIHJlc3BvbnNlcyB3aXRoIFwiJHtTTUFSVF9UUkFOU0xBVElPTlt0aGlzLnBsdWdpbi5zZXR0aW5ncy5sYW5ndWFnZV0ucHJvbXB0fS4uLlwiYDtcbiAgICBmb3IobGV0IGkgPSAwOyBpIDwgY29udGV4dC5sZW5ndGg7IGkrKykge1xuICAgICAgdGhpcy5jaGF0LmNvbnRleHQgKz0gYFxcbi0tLUJFR0lOICMke2krMX0tLS1cXG4ke2NvbnRleHRbaV0udGV4dH1cXG4tLS1FTkQgIyR7aSsxfS0tLWA7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLmNoYXQuY29udGV4dDtcbiAgfVxuXG5cbn1cblxuZnVuY3Rpb24gZ2V0X21heF9jaGFycyhtb2RlbD1cImdwdC0zLjUtdHVyYm9cIikge1xuICBjb25zdCBNQVhfQ0hBUl9NQVAgPSB7XG4gICAgXCJncHQtMy41LXR1cmJvLTE2a1wiOiA0ODAwMCxcbiAgICBcImdwdC00XCI6IDI0MDAwLFxuICAgIFwiZ3B0LTMuNS10dXJib1wiOiAxMjAwMCxcbiAgfTtcbiAgcmV0dXJuIE1BWF9DSEFSX01BUFttb2RlbF07XG59XG4vKipcbiAqIFNtYXJ0Q29ubmVjdGlvbnNDaGF0TW9kZWxcbiAqIC0tLVxuICogLSAndGhyZWFkJyBmb3JtYXQ6IEFycmF5W0FycmF5W09iamVjdHtyb2xlLCBjb250ZW50LCBoeWRlfV1dXG4gKiAgLSBbVHVyblt2YXJpYXRpb257fV0sIFR1cm5bdmFyaWF0aW9ue30sIHZhcmlhdGlvbnt9XSwgLi4uXVxuICogLSBTYXZlcyBpbiAndGhyZWFkJyBmb3JtYXQgdG8gSlNPTiBmaWxlIGluIC5zbWFydC1jb25uZWN0aW9ucyBmb2xkZXIgdXNpbmcgY2hhdF9pZCBhcyBmaWxlbmFtZVxuICogLSBMb2FkcyBjaGF0IGluICd0aHJlYWQnIGZvcm1hdCBBcnJheVtBcnJheVtPYmplY3R7cm9sZSwgY29udGVudCwgaHlkZX1dXSBmcm9tIEpTT04gZmlsZSBpbiAuc21hcnQtY29ubmVjdGlvbnMgZm9sZGVyXG4gKiAtIHByZXBhcmVzIGNoYXRfbWwgcmV0dXJucyBpbiAnQ2hhdE1MJyBmb3JtYXQgXG4gKiAgLSBzdHJpcHMgYWxsIGJ1dCByb2xlIGFuZCBjb250ZW50IHByb3BlcnRpZXMgZnJvbSBPYmplY3QgaW4gQ2hhdE1MIGZvcm1hdFxuICogLSBDaGF0TUwgQXJyYXlbT2JqZWN0e3JvbGUsIGNvbnRlbnR9XVxuICogIC0gW0N1cnJlbnRfVmFyaWF0aW9uX0Zvcl9UdXJuXzF7fSwgQ3VycmVudF9WYXJpYXRpb25fRm9yX1R1cm5fMnt9LCAuLi5dXG4gKi9cbmNsYXNzIFNtYXJ0Q29ubmVjdGlvbnNDaGF0TW9kZWwge1xuICBjb25zdHJ1Y3RvcihwbHVnaW4pIHtcbiAgICB0aGlzLmFwcCA9IHBsdWdpbi5hcHA7XG4gICAgdGhpcy5wbHVnaW4gPSBwbHVnaW47XG4gICAgdGhpcy5jaGF0X2lkID0gbnVsbDtcbiAgICB0aGlzLmNoYXRfbWwgPSBbXTtcbiAgICB0aGlzLmNvbnRleHQgPSBudWxsO1xuICAgIHRoaXMuaHlkID0gbnVsbDtcbiAgICB0aGlzLnRocmVhZCA9IFtdO1xuICB9XG4gIGFzeW5jIHNhdmVfY2hhdCgpIHtcbiAgICAvLyByZXR1cm4gaWYgdGhyZWFkIGlzIGVtcHR5XG4gICAgaWYgKHRoaXMudGhyZWFkLmxlbmd0aCA9PT0gMCkgcmV0dXJuO1xuICAgIC8vIHNhdmUgY2hhdCB0byBmaWxlIGluIC5zbWFydC1jb25uZWN0aW9ucyBmb2xkZXJcbiAgICAvLyBjcmVhdGUgLnNtYXJ0LWNvbm5lY3Rpb25zL2NoYXRzLyBmb2xkZXIgaWYgaXQgZG9lc24ndCBleGlzdFxuICAgIGlmICghKGF3YWl0IHRoaXMuYXBwLnZhdWx0LmFkYXB0ZXIuZXhpc3RzKFwiLnNtYXJ0LWNvbm5lY3Rpb25zL2NoYXRzXCIpKSkge1xuICAgICAgYXdhaXQgdGhpcy5hcHAudmF1bHQuYWRhcHRlci5ta2RpcihcIi5zbWFydC1jb25uZWN0aW9ucy9jaGF0c1wiKTtcbiAgICB9XG4gICAgLy8gaWYgY2hhdF9pZCBpcyBub3Qgc2V0LCBzZXQgaXQgdG8gVU5USVRMRUQtJHt1bml4IHRpbWVzdGFtcH1cbiAgICBpZiAoIXRoaXMuY2hhdF9pZCkge1xuICAgICAgdGhpcy5jaGF0X2lkID0gdGhpcy5uYW1lKCkgKyBcIlx1MjAxNFwiICsgdGhpcy5nZXRfZmlsZV9kYXRlX3N0cmluZygpO1xuICAgIH1cbiAgICAvLyB2YWxpZGF0ZSBjaGF0X2lkIGlzIHNldCB0byB2YWxpZCBmaWxlbmFtZSBjaGFyYWN0ZXJzIChsZXR0ZXJzLCBudW1iZXJzLCB1bmRlcnNjb3JlcywgZGFzaGVzLCBlbSBkYXNoLCBhbmQgc3BhY2VzKVxuICAgIGlmICghdGhpcy5jaGF0X2lkLm1hdGNoKC9eW2EtekEtWjAtOV9cdTIwMTRcXC0gXSskLykpIHtcbiAgICAgIGNvbnNvbGUubG9nKFwiSW52YWxpZCBjaGF0X2lkOiBcIiArIHRoaXMuY2hhdF9pZCk7XG4gICAgICBuZXcgT2JzaWRpYW4uTm90aWNlKFwiW1NtYXJ0IENvbm5lY3Rpb25zXSBGYWlsZWQgdG8gc2F2ZSBjaGF0LiBJbnZhbGlkIGNoYXRfaWQ6ICdcIiArIHRoaXMuY2hhdF9pZCArIFwiJ1wiKTtcbiAgICB9XG4gICAgLy8gZmlsZW5hbWUgaXMgY2hhdF9pZFxuICAgIGNvbnN0IGNoYXRfZmlsZSA9IHRoaXMuY2hhdF9pZCArIFwiLmpzb25cIjtcbiAgICB0aGlzLmFwcC52YXVsdC5hZGFwdGVyLndyaXRlKFxuICAgICAgXCIuc21hcnQtY29ubmVjdGlvbnMvY2hhdHMvXCIgKyBjaGF0X2ZpbGUsXG4gICAgICBKU09OLnN0cmluZ2lmeSh0aGlzLnRocmVhZCwgbnVsbCwgMilcbiAgICApO1xuICB9XG4gIGFzeW5jIGxvYWRfY2hhdChjaGF0X2lkKSB7XG4gICAgdGhpcy5jaGF0X2lkID0gY2hhdF9pZDtcbiAgICAvLyBsb2FkIGNoYXQgZnJvbSBmaWxlIGluIC5zbWFydC1jb25uZWN0aW9ucyBmb2xkZXJcbiAgICAvLyBmaWxlbmFtZSBpcyBjaGF0X2lkXG4gICAgY29uc3QgY2hhdF9maWxlID0gdGhpcy5jaGF0X2lkICsgXCIuanNvblwiO1xuICAgIC8vIHJlYWQgZmlsZVxuICAgIGxldCBjaGF0X2pzb24gPSBhd2FpdCB0aGlzLmFwcC52YXVsdC5hZGFwdGVyLnJlYWQoXG4gICAgICBcIi5zbWFydC1jb25uZWN0aW9ucy9jaGF0cy9cIiArIGNoYXRfZmlsZVxuICAgICk7XG4gICAgLy8gcGFyc2UganNvblxuICAgIHRoaXMudGhyZWFkID0gSlNPTi5wYXJzZShjaGF0X2pzb24pO1xuICAgIC8vIGxvYWQgY2hhdF9tbFxuICAgIHRoaXMuY2hhdF9tbCA9IHRoaXMucHJlcGFyZV9jaGF0X21sKCk7XG4gICAgLy8gcmVuZGVyIG1lc3NhZ2VzIGluIGNoYXQgdmlld1xuICAgIC8vIGZvciBlYWNoIHR1cm4gaW4gY2hhdF9tbFxuICAgIC8vIGNvbnNvbGUubG9nKHRoaXMudGhyZWFkKTtcbiAgICAvLyBjb25zb2xlLmxvZyh0aGlzLmNoYXRfbWwpO1xuICB9XG4gIC8vIHByZXBhcmUgY2hhdF9tbCBmcm9tIGNoYXRcbiAgLy8gZ2V0cyB0aGUgbGFzdCBtZXNzYWdlIG9mIGVhY2ggdHVybiB1bmxlc3MgdHVybl92YXJpYXRpb25fb2Zmc2V0cz1bW3R1cm5faW5kZXgsdmFyaWF0aW9uX2luZGV4XV0gaXMgc3BlY2lmaWVkIGluIG9mZnNldFxuICBwcmVwYXJlX2NoYXRfbWwodHVybl92YXJpYXRpb25fb2Zmc2V0cz1bXSkge1xuICAgIC8vIGlmIG5vIHR1cm5fdmFyaWF0aW9uX29mZnNldHMsIGdldCB0aGUgbGFzdCBtZXNzYWdlIG9mIGVhY2ggdHVyblxuICAgIGlmKHR1cm5fdmFyaWF0aW9uX29mZnNldHMubGVuZ3RoID09PSAwKXtcbiAgICAgIHRoaXMuY2hhdF9tbCA9IHRoaXMudGhyZWFkLm1hcCh0dXJuID0+IHtcbiAgICAgICAgcmV0dXJuIHR1cm5bdHVybi5sZW5ndGggLSAxXTtcbiAgICAgIH0pO1xuICAgIH1lbHNle1xuICAgICAgLy8gY3JlYXRlIGFuIGFycmF5IGZyb20gdHVybl92YXJpYXRpb25fb2Zmc2V0cyB0aGF0IGluZGV4ZXMgdmFyaWF0aW9uX2luZGV4IGF0IHR1cm5faW5kZXhcbiAgICAgIC8vIGV4LiBbWzMsNV1dID0+IFt1bmRlZmluZWQsIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCA1XVxuICAgICAgbGV0IHR1cm5fdmFyaWF0aW9uX2luZGV4ID0gW107XG4gICAgICBmb3IobGV0IGkgPSAwOyBpIDwgdHVybl92YXJpYXRpb25fb2Zmc2V0cy5sZW5ndGg7IGkrKyl7XG4gICAgICAgIHR1cm5fdmFyaWF0aW9uX2luZGV4W3R1cm5fdmFyaWF0aW9uX29mZnNldHNbaV1bMF1dID0gdHVybl92YXJpYXRpb25fb2Zmc2V0c1tpXVsxXTtcbiAgICAgIH1cbiAgICAgIC8vIGxvb3AgdGhyb3VnaCBjaGF0XG4gICAgICB0aGlzLmNoYXRfbWwgPSB0aGlzLnRocmVhZC5tYXAoKHR1cm4sIHR1cm5faW5kZXgpID0+IHtcbiAgICAgICAgLy8gaWYgdGhlcmUgaXMgYW4gaW5kZXggZm9yIHRoaXMgdHVybiwgcmV0dXJuIHRoZSB2YXJpYXRpb24gYXQgdGhhdCBpbmRleFxuICAgICAgICBpZih0dXJuX3ZhcmlhdGlvbl9pbmRleFt0dXJuX2luZGV4XSAhPT0gdW5kZWZpbmVkKXtcbiAgICAgICAgICByZXR1cm4gdHVyblt0dXJuX3ZhcmlhdGlvbl9pbmRleFt0dXJuX2luZGV4XV07XG4gICAgICAgIH1cbiAgICAgICAgLy8gb3RoZXJ3aXNlIHJldHVybiB0aGUgbGFzdCBtZXNzYWdlIG9mIHRoZSB0dXJuXG4gICAgICAgIHJldHVybiB0dXJuW3R1cm4ubGVuZ3RoIC0gMV07XG4gICAgICB9KTtcbiAgICB9XG4gICAgLy8gc3RyaXAgYWxsIGJ1dCByb2xlIGFuZCBjb250ZW50IHByb3BlcnRpZXMgZnJvbSBlYWNoIG1lc3NhZ2VcbiAgICB0aGlzLmNoYXRfbWwgPSB0aGlzLmNoYXRfbWwubWFwKG1lc3NhZ2UgPT4ge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgcm9sZTogbWVzc2FnZS5yb2xlLFxuICAgICAgICBjb250ZW50OiBtZXNzYWdlLmNvbnRlbnRcbiAgICAgIH07XG4gICAgfSk7XG4gICAgcmV0dXJuIHRoaXMuY2hhdF9tbDtcbiAgfVxuICBsYXN0KCkge1xuICAgIC8vIGdldCBsYXN0IG1lc3NhZ2UgZnJvbSBjaGF0XG4gICAgcmV0dXJuIHRoaXMudGhyZWFkW3RoaXMudGhyZWFkLmxlbmd0aCAtIDFdW3RoaXMudGhyZWFkW3RoaXMudGhyZWFkLmxlbmd0aCAtIDFdLmxlbmd0aCAtIDFdO1xuICB9XG4gIGxhc3RfZnJvbSgpIHtcbiAgICByZXR1cm4gdGhpcy5sYXN0KCkucm9sZTtcbiAgfVxuICAvLyByZXR1cm5zIHVzZXJfaW5wdXQgb3IgY29tcGxldGlvblxuICBsYXN0X21lc3NhZ2UoKSB7XG4gICAgcmV0dXJuIHRoaXMubGFzdCgpLmNvbnRlbnQ7XG4gIH1cbiAgLy8gbWVzc2FnZT17fVxuICAvLyBhZGQgbmV3IG1lc3NhZ2UgdG8gdGhyZWFkXG4gIG5ld19tZXNzYWdlX2luX3RocmVhZChtZXNzYWdlLCB0dXJuPS0xKSB7XG4gICAgLy8gaWYgdHVybiBpcyAtMSwgYWRkIHRvIG5ldyB0dXJuXG4gICAgaWYodGhpcy5jb250ZXh0KXtcbiAgICAgIG1lc3NhZ2UuY29udGV4dCA9IHRoaXMuY29udGV4dDtcbiAgICAgIHRoaXMuY29udGV4dCA9IG51bGw7XG4gICAgfVxuICAgIGlmKHRoaXMuaHlkKXtcbiAgICAgIG1lc3NhZ2UuaHlkID0gdGhpcy5oeWQ7XG4gICAgICB0aGlzLmh5ZCA9IG51bGw7XG4gICAgfVxuICAgIGlmICh0dXJuID09PSAtMSkge1xuICAgICAgdGhpcy50aHJlYWQucHVzaChbbWVzc2FnZV0pO1xuICAgIH1lbHNle1xuICAgICAgLy8gb3RoZXJ3aXNlIGFkZCB0byBzcGVjaWZpZWQgdHVyblxuICAgICAgdGhpcy50aHJlYWRbdHVybl0ucHVzaChtZXNzYWdlKTtcbiAgICB9XG4gIH1cbiAgcmVzZXRfY29udGV4dCgpe1xuICAgIHRoaXMuY29udGV4dCA9IG51bGw7XG4gICAgdGhpcy5oeWQgPSBudWxsO1xuICB9XG4gIGFzeW5jIHJlbmFtZV9jaGF0KG5ld19uYW1lKXtcbiAgICAvLyBjaGVjayBpZiBjdXJyZW50IGNoYXRfaWQgZmlsZSBleGlzdHNcbiAgICBpZiAodGhpcy5jaGF0X2lkICYmIGF3YWl0IHRoaXMuYXBwLnZhdWx0LmFkYXB0ZXIuZXhpc3RzKFwiLnNtYXJ0LWNvbm5lY3Rpb25zL2NoYXRzL1wiICsgdGhpcy5jaGF0X2lkICsgXCIuanNvblwiKSkge1xuICAgICAgbmV3X25hbWUgPSB0aGlzLmNoYXRfaWQucmVwbGFjZSh0aGlzLm5hbWUoKSwgbmV3X25hbWUpO1xuICAgICAgLy8gcmVuYW1lIGZpbGUgaWYgaXQgZXhpc3RzXG4gICAgICBhd2FpdCB0aGlzLmFwcC52YXVsdC5hZGFwdGVyLnJlbmFtZShcbiAgICAgICAgXCIuc21hcnQtY29ubmVjdGlvbnMvY2hhdHMvXCIgKyB0aGlzLmNoYXRfaWQgKyBcIi5qc29uXCIsXG4gICAgICAgIFwiLnNtYXJ0LWNvbm5lY3Rpb25zL2NoYXRzL1wiICsgbmV3X25hbWUgKyBcIi5qc29uXCJcbiAgICAgICk7XG4gICAgICAvLyBzZXQgY2hhdF9pZCB0byBuZXdfbmFtZVxuICAgICAgdGhpcy5jaGF0X2lkID0gbmV3X25hbWU7XG4gICAgfWVsc2V7XG4gICAgICB0aGlzLmNoYXRfaWQgPSBuZXdfbmFtZSArIFwiXHUyMDE0XCIgKyB0aGlzLmdldF9maWxlX2RhdGVfc3RyaW5nKCk7XG4gICAgICAvLyBzYXZlIGNoYXRcbiAgICAgIGF3YWl0IHRoaXMuc2F2ZV9jaGF0KCk7XG4gICAgfVxuXG4gIH1cblxuICBuYW1lKCkge1xuICAgIGlmKHRoaXMuY2hhdF9pZCl7XG4gICAgICAvLyByZW1vdmUgZGF0ZSBhZnRlciBsYXN0IGVtIGRhc2hcbiAgICAgIHJldHVybiB0aGlzLmNoYXRfaWQucmVwbGFjZSgvXHUyMDE0W15cdTIwMTRdKiQvLFwiXCIpO1xuICAgIH1cbiAgICByZXR1cm4gXCJVTlRJVExFRFwiO1xuICB9XG5cbiAgZ2V0X2ZpbGVfZGF0ZV9zdHJpbmcoKSB7XG4gICAgcmV0dXJuIG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKS5yZXBsYWNlKC8oVHw6fFxcLi4qKS9nLCBcIiBcIikudHJpbSgpO1xuICB9XG4gIC8vIGdldCByZXNwb25zZSBmcm9tIHdpdGggbm90ZSBjb250ZXh0XG4gIGFzeW5jIGdldF9yZXNwb25zZV93aXRoX25vdGVfY29udGV4dCh1c2VyX2lucHV0LCBjaGF0X3ZpZXcpIHtcbiAgICBsZXQgc3lzdGVtX2lucHV0ID0gXCJJbWFnaW5lIHRoZSBmb2xsb3dpbmcgbm90ZXMgd2VyZSB3cml0dGVuIGJ5IHRoZSB1c2VyIGFuZCBjb250YWluIHRoZSBuZWNlc3NhcnkgaW5mb3JtYXRpb24gdG8gc3ludGhlc2l6ZSBhIHVzZWZ1bCBhbnN3ZXIgdGhlIHVzZXIncyBxdWVyeTpcXG5cIjtcbiAgICAvLyBleHRyYWN0IGludGVybmFsIGxpbmtzXG4gICAgY29uc3Qgbm90ZXMgPSB0aGlzLmV4dHJhY3RfaW50ZXJuYWxfbGlua3ModXNlcl9pbnB1dCk7XG4gICAgLy8gZ2V0IGNvbnRlbnQgb2YgaW50ZXJuYWwgbGlua3MgYXMgY29udGV4dFxuICAgIGxldCBtYXhfY2hhcnMgPSBnZXRfbWF4X2NoYXJzKHRoaXMucGx1Z2luLnNldHRpbmdzLnNtYXJ0X2NoYXRfbW9kZWwpO1xuICAgIGZvcihsZXQgaSA9IDA7IGkgPCBub3Rlcy5sZW5ndGg7IGkrKyl7XG4gICAgICAvLyBtYXggY2hhcnMgZm9yIHRoaXMgbm90ZSBpcyBtYXhfY2hhcnMgZGl2aWRlZCBieSBudW1iZXIgb2Ygbm90ZXMgbGVmdFxuICAgICAgY29uc3QgdGhpc19tYXhfY2hhcnMgPSAobm90ZXMubGVuZ3RoIC0gaSA+IDEpID8gTWF0aC5mbG9vcihtYXhfY2hhcnMgLyAobm90ZXMubGVuZ3RoIC0gaSkpIDogbWF4X2NoYXJzO1xuICAgICAgLy8gY29uc29sZS5sb2coXCJmaWxlIGNvbnRleHQgbWF4IGNoYXJzOiBcIiArIHRoaXNfbWF4X2NoYXJzKTtcbiAgICAgIGNvbnN0IG5vdGVfY29udGVudCA9IGF3YWl0IHRoaXMuZ2V0X25vdGVfY29udGVudHMobm90ZXNbaV0sIHtjaGFyX2xpbWl0OiB0aGlzX21heF9jaGFyc30pO1xuICAgICAgc3lzdGVtX2lucHV0ICs9IGAtLS1CRUdJTiBOT1RFOiBbWyR7bm90ZXNbaV0uYmFzZW5hbWV9XV0tLS1cXG5gXG4gICAgICBzeXN0ZW1faW5wdXQgKz0gbm90ZV9jb250ZW50O1xuICAgICAgc3lzdGVtX2lucHV0ICs9IGAtLS1FTkQgTk9URS0tLVxcbmBcbiAgICAgIG1heF9jaGFycyAtPSBub3RlX2NvbnRlbnQubGVuZ3RoO1xuICAgICAgaWYobWF4X2NoYXJzIDw9IDApIGJyZWFrO1xuICAgIH1cbiAgICB0aGlzLmNvbnRleHQgPSBzeXN0ZW1faW5wdXQ7XG4gICAgY29uc3QgY2hhdG1sID0gW1xuICAgICAge1xuICAgICAgICByb2xlOiBcInN5c3RlbVwiLFxuICAgICAgICBjb250ZW50OiBzeXN0ZW1faW5wdXRcbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIHJvbGU6IFwidXNlclwiLFxuICAgICAgICBjb250ZW50OiB1c2VyX2lucHV0XG4gICAgICB9XG4gICAgXTtcbiAgICBjaGF0X3ZpZXcucmVxdWVzdF9jaGF0Z3B0X2NvbXBsZXRpb24oe21lc3NhZ2VzOiBjaGF0bWwsIHRlbXBlcmF0dXJlOiAwfSk7XG4gIH1cbiAgLy8gY2hlY2sgaWYgY29udGFpbnMgaW50ZXJuYWwgbGlua1xuICBjb250YWluc19pbnRlcm5hbF9saW5rKHVzZXJfaW5wdXQpIHtcbiAgICBpZih1c2VyX2lucHV0LmluZGV4T2YoXCJbW1wiKSA9PT0gLTEpIHJldHVybiBmYWxzZTtcbiAgICBpZih1c2VyX2lucHV0LmluZGV4T2YoXCJdXVwiKSA9PT0gLTEpIHJldHVybiBmYWxzZTtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuICAvLyBjaGVjayBpZiBjb250YWlucyBmb2xkZXIgcmVmZXJlbmNlIChleC4gL2ZvbGRlci8sIG9yIC9mb2xkZXIvc3ViZm9sZGVyLylcbiAgY29udGFpbnNfZm9sZGVyX3JlZmVyZW5jZSh1c2VyX2lucHV0KSB7XG4gICAgaWYodXNlcl9pbnB1dC5pbmRleE9mKFwiL1wiKSA9PT0gLTEpIHJldHVybiBmYWxzZTtcbiAgICBpZih1c2VyX2lucHV0LmluZGV4T2YoXCIvXCIpID09PSB1c2VyX2lucHV0Lmxhc3RJbmRleE9mKFwiL1wiKSkgcmV0dXJuIGZhbHNlO1xuICAgIHJldHVybiB0cnVlO1xuICB9XG4gIC8vIGdldCBmb2xkZXIgcmVmZXJlbmNlcyBmcm9tIHVzZXIgaW5wdXRcbiAgZ2V0X2ZvbGRlcl9yZWZlcmVuY2VzKHVzZXJfaW5wdXQpIHtcbiAgICAvLyB1c2UgdGhpcy5mb2xkZXJzIHRvIGV4dHJhY3QgZm9sZGVyIHJlZmVyZW5jZXMgYnkgbG9uZ2VzdCBmaXJzdCAoZXguIC9mb2xkZXIvc3ViZm9sZGVyLyBiZWZvcmUgL2ZvbGRlci8pIHRvIGF2b2lkIG1hdGNoaW5nIC9mb2xkZXIvc3ViZm9sZGVyLyBhcyAvZm9sZGVyL1xuICAgIGNvbnN0IGZvbGRlcnMgPSB0aGlzLnBsdWdpbi5mb2xkZXJzLnNsaWNlKCk7IC8vIGNvcHkgZm9sZGVycyBhcnJheVxuICAgIGNvbnN0IG1hdGNoZXMgPSBmb2xkZXJzLnNvcnQoKGEsIGIpID0+IGIubGVuZ3RoIC0gYS5sZW5ndGgpLm1hcChmb2xkZXIgPT4ge1xuICAgICAgLy8gY2hlY2sgaWYgZm9sZGVyIGlzIGluIHVzZXJfaW5wdXRcbiAgICAgIGlmKHVzZXJfaW5wdXQuaW5kZXhPZihmb2xkZXIpICE9PSAtMSl7XG4gICAgICAgIC8vIHJlbW92ZSBmb2xkZXIgZnJvbSB1c2VyX2lucHV0IHRvIHByZXZlbnQgbWF0Y2hpbmcgL2ZvbGRlci9zdWJmb2xkZXIvIGFzIC9mb2xkZXIvXG4gICAgICAgIHVzZXJfaW5wdXQgPSB1c2VyX2lucHV0LnJlcGxhY2UoZm9sZGVyLCBcIlwiKTtcbiAgICAgICAgcmV0dXJuIGZvbGRlcjtcbiAgICAgIH1cbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9KS5maWx0ZXIoZm9sZGVyID0+IGZvbGRlcik7XG4gICAgY29uc29sZS5sb2cobWF0Y2hlcyk7XG4gICAgLy8gcmV0dXJuIGFycmF5IG9mIG1hdGNoZXNcbiAgICBpZihtYXRjaGVzKSByZXR1cm4gbWF0Y2hlcztcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuXG4gIC8vIGV4dHJhY3QgaW50ZXJuYWwgbGlua3NcbiAgZXh0cmFjdF9pbnRlcm5hbF9saW5rcyh1c2VyX2lucHV0KSB7XG4gICAgY29uc3QgbWF0Y2hlcyA9IHVzZXJfaW5wdXQubWF0Y2goL1xcW1xcWyguKj8pXFxdXFxdL2cpO1xuICAgIGNvbnNvbGUubG9nKG1hdGNoZXMpO1xuICAgIC8vIHJldHVybiBhcnJheSBvZiBURmlsZSBvYmplY3RzXG4gICAgaWYobWF0Y2hlcykgcmV0dXJuIG1hdGNoZXMubWFwKG1hdGNoID0+IHtcbiAgICAgIHJldHVybiB0aGlzLmFwcC5tZXRhZGF0YUNhY2hlLmdldEZpcnN0TGlua3BhdGhEZXN0KG1hdGNoLnJlcGxhY2UoXCJbW1wiLCBcIlwiKS5yZXBsYWNlKFwiXV1cIiwgXCJcIiksIFwiL1wiKTtcbiAgICB9KTtcbiAgICByZXR1cm4gW107XG4gIH1cbiAgLy8gZ2V0IGNvbnRleHQgZnJvbSBpbnRlcm5hbCBsaW5rc1xuICBhc3luYyBnZXRfbm90ZV9jb250ZW50cyhub3RlLCBvcHRzPXt9KSB7XG4gICAgb3B0cyA9IHtcbiAgICAgIGNoYXJfbGltaXQ6IDEwMDAwLFxuICAgICAgLi4ub3B0c1xuICAgIH1cbiAgICAvLyByZXR1cm4gaWYgbm90ZSBpcyBub3QgYSBmaWxlXG4gICAgaWYoIShub3RlIGluc3RhbmNlb2YgT2JzaWRpYW4uVEZpbGUpKSByZXR1cm4gXCJcIjtcbiAgICAvLyBnZXQgZmlsZSBjb250ZW50XG4gICAgbGV0IGZpbGVfY29udGVudCA9IGF3YWl0IHRoaXMuYXBwLnZhdWx0LmNhY2hlZFJlYWQobm90ZSk7XG4gICAgLy8gY2hlY2sgaWYgY29udGFpbnMgZGF0YXZpZXcgY29kZSBibG9ja1xuICAgIGlmKGZpbGVfY29udGVudC5pbmRleE9mKFwiYGBgZGF0YXZpZXdcIikgPiAtMSl7XG4gICAgICAvLyBpZiBjb250YWlucyBkYXRhdmlldyBjb2RlIGJsb2NrIGdldCBhbGwgZGF0YXZpZXcgY29kZSBibG9ja3NcbiAgICAgIGZpbGVfY29udGVudCA9IGF3YWl0IHRoaXMucmVuZGVyX2RhdGF2aWV3X3F1ZXJpZXMoZmlsZV9jb250ZW50LCBub3RlLnBhdGgsIG9wdHMpO1xuICAgIH1cbiAgICBmaWxlX2NvbnRlbnQgPSBmaWxlX2NvbnRlbnQuc3Vic3RyaW5nKDAsIG9wdHMuY2hhcl9saW1pdCk7XG4gICAgLy8gY29uc29sZS5sb2coZmlsZV9jb250ZW50Lmxlbmd0aCk7XG4gICAgcmV0dXJuIGZpbGVfY29udGVudDtcbiAgfVxuXG5cbiAgYXN5bmMgcmVuZGVyX2RhdGF2aWV3X3F1ZXJpZXMoZmlsZV9jb250ZW50LCBub3RlX3BhdGgsIG9wdHM9e30pIHtcbiAgICBvcHRzID0ge1xuICAgICAgY2hhcl9saW1pdDogbnVsbCxcbiAgICAgIC4uLm9wdHNcbiAgICB9O1xuICAgIC8vIHVzZSB3aW5kb3cgdG8gZ2V0IGRhdGF2aWV3IGFwaVxuICAgIGNvbnN0IGRhdGF2aWV3X2FwaSA9IHdpbmRvd1tcIkRhdGF2aWV3QVBJXCJdO1xuICAgIC8vIHNraXAgaWYgZGF0YXZpZXcgYXBpIG5vdCBmb3VuZFxuICAgIGlmKCFkYXRhdmlld19hcGkpIHJldHVybiBmaWxlX2NvbnRlbnQ7XG4gICAgY29uc3QgZGF0YXZpZXdfY29kZV9ibG9ja3MgPSBmaWxlX2NvbnRlbnQubWF0Y2goL2BgYGRhdGF2aWV3KC4qPylgYGAvZ3MpO1xuICAgIC8vIGZvciBlYWNoIGRhdGF2aWV3IGNvZGUgYmxvY2tcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGRhdGF2aWV3X2NvZGVfYmxvY2tzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAvLyBpZiBvcHRzIGNoYXJfbGltaXQgaXMgbGVzcyB0aGFuIGluZGV4T2YgZGF0YXZpZXcgY29kZSBibG9jaywgYnJlYWtcbiAgICAgIGlmKG9wdHMuY2hhcl9saW1pdCAmJiBvcHRzLmNoYXJfbGltaXQgPCBmaWxlX2NvbnRlbnQuaW5kZXhPZihkYXRhdmlld19jb2RlX2Jsb2Nrc1tpXSkpIGJyZWFrO1xuICAgICAgLy8gZ2V0IGRhdGF2aWV3IGNvZGUgYmxvY2tcbiAgICAgIGNvbnN0IGRhdGF2aWV3X2NvZGVfYmxvY2sgPSBkYXRhdmlld19jb2RlX2Jsb2Nrc1tpXTtcbiAgICAgIC8vIGdldCBjb250ZW50IG9mIGRhdGF2aWV3IGNvZGUgYmxvY2tcbiAgICAgIGNvbnN0IGRhdGF2aWV3X2NvZGVfYmxvY2tfY29udGVudCA9IGRhdGF2aWV3X2NvZGVfYmxvY2sucmVwbGFjZShcImBgYGRhdGF2aWV3XCIsIFwiXCIpLnJlcGxhY2UoXCJgYGBcIiwgXCJcIik7XG4gICAgICAvLyBnZXQgZGF0YXZpZXcgcXVlcnkgcmVzdWx0XG4gICAgICBjb25zdCBkYXRhdmlld19xdWVyeV9yZXN1bHQgPSBhd2FpdCBkYXRhdmlld19hcGkucXVlcnlNYXJrZG93bihkYXRhdmlld19jb2RlX2Jsb2NrX2NvbnRlbnQsIG5vdGVfcGF0aCwgbnVsbCk7XG4gICAgICAvLyBpZiBxdWVyeSByZXN1bHQgaXMgc3VjY2Vzc2Z1bCwgcmVwbGFjZSBkYXRhdmlldyBjb2RlIGJsb2NrIHdpdGggcXVlcnkgcmVzdWx0XG4gICAgICBpZiAoZGF0YXZpZXdfcXVlcnlfcmVzdWx0LnN1Y2Nlc3NmdWwpIHtcbiAgICAgICAgZmlsZV9jb250ZW50ID0gZmlsZV9jb250ZW50LnJlcGxhY2UoZGF0YXZpZXdfY29kZV9ibG9jaywgZGF0YXZpZXdfcXVlcnlfcmVzdWx0LnZhbHVlKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGZpbGVfY29udGVudDtcbiAgfVxufVxuXG5jbGFzcyBTbWFydENvbm5lY3Rpb25zQ2hhdEhpc3RvcnlNb2RhbCBleHRlbmRzIE9ic2lkaWFuLkZ1enp5U3VnZ2VzdE1vZGFsIHtcbiAgY29uc3RydWN0b3IoYXBwLCB2aWV3LCBmaWxlcykge1xuICAgIHN1cGVyKGFwcCk7XG4gICAgdGhpcy5hcHAgPSBhcHA7XG4gICAgdGhpcy52aWV3ID0gdmlldztcbiAgICB0aGlzLnNldFBsYWNlaG9sZGVyKFwiVHlwZSB0aGUgbmFtZSBvZiBhIGNoYXQgc2Vzc2lvbi4uLlwiKTtcbiAgfVxuICBnZXRJdGVtcygpIHtcbiAgICBpZiAoIXRoaXMudmlldy5maWxlcykge1xuICAgICAgcmV0dXJuIFtdO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy52aWV3LmZpbGVzO1xuICB9XG4gIGdldEl0ZW1UZXh0KGl0ZW0pIHtcbiAgICAvLyBpZiBub3QgVU5USVRMRUQsIHJlbW92ZSBkYXRlIGFmdGVyIGxhc3QgZW0gZGFzaFxuICAgIGlmKGl0ZW0uaW5kZXhPZihcIlVOVElUTEVEXCIpID09PSAtMSl7XG4gICAgICBpdGVtLnJlcGxhY2UoL1x1MjAxNFteXHUyMDE0XSokLyxcIlwiKTtcbiAgICB9XG4gICAgcmV0dXJuIGl0ZW07XG4gIH1cbiAgb25DaG9vc2VJdGVtKHNlc3Npb24pIHtcbiAgICB0aGlzLnZpZXcub3Blbl9jaGF0KHNlc3Npb24pO1xuICB9XG59XG5cbi8vIEZpbGUgU2VsZWN0IEZ1enp5IFN1Z2dlc3QgTW9kYWxcbmNsYXNzIFNtYXJ0Q29ubmVjdGlvbnNGaWxlU2VsZWN0TW9kYWwgZXh0ZW5kcyBPYnNpZGlhbi5GdXp6eVN1Z2dlc3RNb2RhbCB7XG4gIGNvbnN0cnVjdG9yKGFwcCwgdmlldykge1xuICAgIHN1cGVyKGFwcCk7XG4gICAgdGhpcy5hcHAgPSBhcHA7XG4gICAgdGhpcy52aWV3ID0gdmlldztcbiAgICB0aGlzLnNldFBsYWNlaG9sZGVyKFwiVHlwZSB0aGUgbmFtZSBvZiBhIGZpbGUuLi5cIik7XG4gIH1cbiAgZ2V0SXRlbXMoKSB7XG4gICAgLy8gZ2V0IGFsbCBtYXJrZG93biBmaWxlc1xuICAgIHJldHVybiB0aGlzLmFwcC52YXVsdC5nZXRNYXJrZG93bkZpbGVzKCkuc29ydCgoYSwgYikgPT4gYS5iYXNlbmFtZS5sb2NhbGVDb21wYXJlKGIuYmFzZW5hbWUpKTtcbiAgfVxuICBnZXRJdGVtVGV4dChpdGVtKSB7XG4gICAgcmV0dXJuIGl0ZW0uYmFzZW5hbWU7XG4gIH1cbiAgb25DaG9vc2VJdGVtKGZpbGUpIHtcbiAgICB0aGlzLnZpZXcuaW5zZXJ0X3NlbGVjdGlvbihmaWxlLmJhc2VuYW1lICsgXCJdXSBcIik7XG4gIH1cbn1cbi8vIEZvbGRlciBTZWxlY3QgRnV6enkgU3VnZ2VzdCBNb2RhbFxuY2xhc3MgU21hcnRDb25uZWN0aW9uc0ZvbGRlclNlbGVjdE1vZGFsIGV4dGVuZHMgT2JzaWRpYW4uRnV6enlTdWdnZXN0TW9kYWwge1xuICBjb25zdHJ1Y3RvcihhcHAsIHZpZXcpIHtcbiAgICBzdXBlcihhcHApO1xuICAgIHRoaXMuYXBwID0gYXBwO1xuICAgIHRoaXMudmlldyA9IHZpZXc7XG4gICAgdGhpcy5zZXRQbGFjZWhvbGRlcihcIlR5cGUgdGhlIG5hbWUgb2YgYSBmb2xkZXIuLi5cIik7XG4gIH1cbiAgZ2V0SXRlbXMoKSB7XG4gICAgcmV0dXJuIHRoaXMudmlldy5wbHVnaW4uZm9sZGVycztcbiAgfVxuICBnZXRJdGVtVGV4dChpdGVtKSB7XG4gICAgcmV0dXJuIGl0ZW07XG4gIH1cbiAgb25DaG9vc2VJdGVtKGZvbGRlcikge1xuICAgIHRoaXMudmlldy5pbnNlcnRfc2VsZWN0aW9uKGZvbGRlciArIFwiLyBcIik7XG4gIH1cbn1cblxuXG4vLyBIYW5kbGUgQVBJIHJlc3BvbnNlIHN0cmVhbWluZ1xuY2xhc3MgU2NTdHJlYW1lciB7XG4gIC8vIGNvbnN0cnVjdG9yXG4gIGNvbnN0cnVjdG9yKHVybCwgb3B0aW9ucykge1xuICAgIC8vIHNldCBkZWZhdWx0IG9wdGlvbnNcbiAgICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcbiAgICB0aGlzLnVybCA9IHVybDtcbiAgICB0aGlzLm1ldGhvZCA9IG9wdGlvbnMubWV0aG9kIHx8ICdHRVQnO1xuICAgIHRoaXMuaGVhZGVycyA9IG9wdGlvbnMuaGVhZGVycyB8fCB7fTtcbiAgICB0aGlzLnBheWxvYWQgPSBvcHRpb25zLnBheWxvYWQgfHwgbnVsbDtcbiAgICB0aGlzLndpdGhDcmVkZW50aWFscyA9IG9wdGlvbnMud2l0aENyZWRlbnRpYWxzIHx8IGZhbHNlO1xuICAgIHRoaXMubGlzdGVuZXJzID0ge307XG4gICAgdGhpcy5yZWFkeVN0YXRlID0gdGhpcy5DT05ORUNUSU5HO1xuICAgIHRoaXMucHJvZ3Jlc3MgPSAwO1xuICAgIHRoaXMuY2h1bmsgPSAnJztcbiAgICB0aGlzLnhociA9IG51bGw7XG4gICAgdGhpcy5GSUVMRF9TRVBBUkFUT1IgPSAnOic7XG4gICAgdGhpcy5JTklUSUFMSVpJTkcgPSAtMTtcbiAgICB0aGlzLkNPTk5FQ1RJTkcgPSAwO1xuICAgIHRoaXMuT1BFTiA9IDE7XG4gICAgdGhpcy5DTE9TRUQgPSAyO1xuICB9XG4gIC8vIGFkZEV2ZW50TGlzdGVuZXJcbiAgYWRkRXZlbnRMaXN0ZW5lcih0eXBlLCBsaXN0ZW5lcikge1xuICAgIC8vIGNoZWNrIGlmIHRoZSB0eXBlIGlzIGluIHRoZSBsaXN0ZW5lcnNcbiAgICBpZiAoIXRoaXMubGlzdGVuZXJzW3R5cGVdKSB7XG4gICAgICB0aGlzLmxpc3RlbmVyc1t0eXBlXSA9IFtdO1xuICAgIH1cbiAgICAvLyBjaGVjayBpZiB0aGUgbGlzdGVuZXIgaXMgYWxyZWFkeSBpbiB0aGUgbGlzdGVuZXJzXG4gICAgaWYodGhpcy5saXN0ZW5lcnNbdHlwZV0uaW5kZXhPZihsaXN0ZW5lcikgPT09IC0xKSB7XG4gICAgICB0aGlzLmxpc3RlbmVyc1t0eXBlXS5wdXNoKGxpc3RlbmVyKTtcbiAgICB9XG4gIH1cbiAgLy8gcmVtb3ZlRXZlbnRMaXN0ZW5lclxuICByZW1vdmVFdmVudExpc3RlbmVyKHR5cGUsIGxpc3RlbmVyKSB7XG4gICAgLy8gY2hlY2sgaWYgbGlzdGVuZXIgdHlwZSBpcyB1bmRlZmluZWRcbiAgICBpZiAoIXRoaXMubGlzdGVuZXJzW3R5cGVdKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGxldCBmaWx0ZXJlZCA9IFtdO1xuICAgIC8vIGxvb3AgdGhyb3VnaCB0aGUgbGlzdGVuZXJzXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLmxpc3RlbmVyc1t0eXBlXS5sZW5ndGg7IGkrKykge1xuICAgICAgLy8gY2hlY2sgaWYgdGhlIGxpc3RlbmVyIGlzIHRoZSBzYW1lXG4gICAgICBpZiAodGhpcy5saXN0ZW5lcnNbdHlwZV1baV0gIT09IGxpc3RlbmVyKSB7XG4gICAgICAgIGZpbHRlcmVkLnB1c2godGhpcy5saXN0ZW5lcnNbdHlwZV1baV0pO1xuICAgICAgfVxuICAgIH1cbiAgICAvLyBjaGVjayBpZiB0aGUgbGlzdGVuZXJzIGFyZSBlbXB0eVxuICAgIGlmICh0aGlzLmxpc3RlbmVyc1t0eXBlXS5sZW5ndGggPT09IDApIHtcbiAgICAgIGRlbGV0ZSB0aGlzLmxpc3RlbmVyc1t0eXBlXTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5saXN0ZW5lcnNbdHlwZV0gPSBmaWx0ZXJlZDtcbiAgICB9XG4gIH1cbiAgLy8gZGlzcGF0Y2hFdmVudFxuICBkaXNwYXRjaEV2ZW50KGV2ZW50KSB7XG4gICAgLy8gaWYgbm8gZXZlbnQgcmV0dXJuIHRydWVcbiAgICBpZiAoIWV2ZW50KSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgLy8gc2V0IGV2ZW50IHNvdXJjZSB0byB0aGlzXG4gICAgZXZlbnQuc291cmNlID0gdGhpcztcbiAgICAvLyBzZXQgb25IYW5kbGVyIHRvIG9uICsgZXZlbnQgdHlwZVxuICAgIGxldCBvbkhhbmRsZXIgPSAnb24nICsgZXZlbnQudHlwZTtcbiAgICAvLyBjaGVjayBpZiB0aGUgb25IYW5kbGVyIGhhcyBvd24gcHJvcGVydHkgbmFtZWQgc2FtZSBhcyBvbkhhbmRsZXJcbiAgICBpZiAodGhpcy5oYXNPd25Qcm9wZXJ0eShvbkhhbmRsZXIpKSB7XG4gICAgICAvLyBjYWxsIHRoZSBvbkhhbmRsZXJcbiAgICAgIHRoaXNbb25IYW5kbGVyXS5jYWxsKHRoaXMsIGV2ZW50KTtcbiAgICAgIC8vIGNoZWNrIGlmIHRoZSBldmVudCBpcyBkZWZhdWx0IHByZXZlbnRlZFxuICAgICAgaWYgKGV2ZW50LmRlZmF1bHRQcmV2ZW50ZWQpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgIH1cbiAgICAvLyBjaGVjayBpZiB0aGUgZXZlbnQgdHlwZSBpcyBpbiB0aGUgbGlzdGVuZXJzXG4gICAgaWYgKHRoaXMubGlzdGVuZXJzW2V2ZW50LnR5cGVdKSB7XG4gICAgICByZXR1cm4gdGhpcy5saXN0ZW5lcnNbZXZlbnQudHlwZV0uZXZlcnkoZnVuY3Rpb24oY2FsbGJhY2spIHtcbiAgICAgICAgY2FsbGJhY2soZXZlbnQpO1xuICAgICAgICByZXR1cm4gIWV2ZW50LmRlZmF1bHRQcmV2ZW50ZWQ7XG4gICAgICB9KTtcbiAgICB9XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cbiAgLy8gX3NldFJlYWR5U3RhdGVcbiAgX3NldFJlYWR5U3RhdGUoc3RhdGUpIHtcbiAgICAvLyBzZXQgZXZlbnQgdHlwZSB0byByZWFkeVN0YXRlQ2hhbmdlXG4gICAgbGV0IGV2ZW50ID0gbmV3IEN1c3RvbUV2ZW50KCdyZWFkeVN0YXRlQ2hhbmdlJyk7XG4gICAgLy8gc2V0IGV2ZW50IHJlYWR5U3RhdGUgdG8gc3RhdGVcbiAgICBldmVudC5yZWFkeVN0YXRlID0gc3RhdGU7XG4gICAgLy8gc2V0IHJlYWR5U3RhdGUgdG8gc3RhdGVcbiAgICB0aGlzLnJlYWR5U3RhdGUgPSBzdGF0ZTtcbiAgICAvLyBkaXNwYXRjaCBldmVudFxuICAgIHRoaXMuZGlzcGF0Y2hFdmVudChldmVudCk7XG4gIH1cbiAgLy8gX29uU3RyZWFtRmFpbHVyZVxuICBfb25TdHJlYW1GYWlsdXJlKGUpIHtcbiAgICAvLyBzZXQgZXZlbnQgdHlwZSB0byBlcnJvclxuICAgIGxldCBldmVudCA9IG5ldyBDdXN0b21FdmVudCgnZXJyb3InKTtcbiAgICAvLyBzZXQgZXZlbnQgZGF0YSB0byBlXG4gICAgZXZlbnQuZGF0YSA9IGUuY3VycmVudFRhcmdldC5yZXNwb25zZTtcbiAgICAvLyBkaXNwYXRjaCBldmVudFxuICAgIHRoaXMuZGlzcGF0Y2hFdmVudChldmVudCk7XG4gICAgdGhpcy5jbG9zZSgpO1xuICB9XG4gIC8vIF9vblN0cmVhbUFib3J0XG4gIF9vblN0cmVhbUFib3J0KGUpIHtcbiAgICAvLyBzZXQgdG8gYWJvcnRcbiAgICBsZXQgZXZlbnQgPSBuZXcgQ3VzdG9tRXZlbnQoJ2Fib3J0Jyk7XG4gICAgLy8gY2xvc2VcbiAgICB0aGlzLmNsb3NlKCk7XG4gIH1cbiAgLy8gX29uU3RyZWFtUHJvZ3Jlc3NcbiAgX29uU3RyZWFtUHJvZ3Jlc3MoZSkge1xuICAgIC8vIGlmIG5vdCB4aHIgcmV0dXJuXG4gICAgaWYgKCF0aGlzLnhocikge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICAvLyBpZiB4aHIgc3RhdHVzIGlzIG5vdCAyMDAgcmV0dXJuXG4gICAgaWYgKHRoaXMueGhyLnN0YXR1cyAhPT0gMjAwKSB7XG4gICAgICAvLyBvblN0cmVhbUZhaWx1cmVcbiAgICAgIHRoaXMuX29uU3RyZWFtRmFpbHVyZShlKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgLy8gaWYgcmVhZHkgc3RhdGUgaXMgQ09OTkVDVElOR1xuICAgIGlmICh0aGlzLnJlYWR5U3RhdGUgPT09IHRoaXMuQ09OTkVDVElORykge1xuICAgICAgLy8gZGlzcGF0Y2ggZXZlbnRcbiAgICAgIHRoaXMuZGlzcGF0Y2hFdmVudChuZXcgQ3VzdG9tRXZlbnQoJ29wZW4nKSk7XG4gICAgICAvLyBzZXQgcmVhZHkgc3RhdGUgdG8gT1BFTlxuICAgICAgdGhpcy5fc2V0UmVhZHlTdGF0ZSh0aGlzLk9QRU4pO1xuICAgIH1cbiAgICAvLyBwYXJzZSB0aGUgcmVjZWl2ZWQgZGF0YS5cbiAgICBsZXQgZGF0YSA9IHRoaXMueGhyLnJlc3BvbnNlVGV4dC5zdWJzdHJpbmcodGhpcy5wcm9ncmVzcyk7XG4gICAgLy8gdXBkYXRlIHByb2dyZXNzXG4gICAgdGhpcy5wcm9ncmVzcyArPSBkYXRhLmxlbmd0aDtcbiAgICAvLyBzcGxpdCB0aGUgZGF0YSBieSBuZXcgbGluZSBhbmQgcGFyc2UgZWFjaCBsaW5lXG4gICAgZGF0YS5zcGxpdCgvKFxcclxcbnxcXHJ8XFxuKXsyfS9nKS5mb3JFYWNoKGZ1bmN0aW9uKHBhcnQpe1xuICAgICAgaWYocGFydC50cmltKCkubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIHRoaXMuZGlzcGF0Y2hFdmVudCh0aGlzLl9wYXJzZUV2ZW50Q2h1bmsodGhpcy5jaHVuay50cmltKCkpKTtcbiAgICAgICAgdGhpcy5jaHVuayA9ICcnO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5jaHVuayArPSBwYXJ0O1xuICAgICAgfVxuICAgIH0uYmluZCh0aGlzKSk7XG4gIH1cbiAgLy8gX29uU3RyZWFtTG9hZGVkXG4gIF9vblN0cmVhbUxvYWRlZChlKSB7XG4gICAgdGhpcy5fb25TdHJlYW1Qcm9ncmVzcyhlKTtcbiAgICAvLyBwYXJzZSB0aGUgbGFzdCBjaHVua1xuICAgIHRoaXMuZGlzcGF0Y2hFdmVudCh0aGlzLl9wYXJzZUV2ZW50Q2h1bmsodGhpcy5jaHVuaykpO1xuICAgIHRoaXMuY2h1bmsgPSAnJztcbiAgfVxuICAvLyBfcGFyc2VFdmVudENodW5rXG4gIF9wYXJzZUV2ZW50Q2h1bmsoY2h1bmspIHtcbiAgICAvLyBpZiBubyBjaHVuayBvciBjaHVuayBpcyBlbXB0eSByZXR1cm5cbiAgICBpZiAoIWNodW5rIHx8IGNodW5rLmxlbmd0aCA9PT0gMCkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIC8vIGluaXQgZVxuICAgIGxldCBlID0ge2lkOiBudWxsLCByZXRyeTogbnVsbCwgZGF0YTogJycsIGV2ZW50OiAnbWVzc2FnZSd9O1xuICAgIC8vIHNwbGl0IHRoZSBjaHVuayBieSBuZXcgbGluZVxuICAgIGNodW5rLnNwbGl0KC8oXFxyXFxufFxccnxcXG4pLykuZm9yRWFjaChmdW5jdGlvbihsaW5lKSB7XG4gICAgICBsaW5lID0gbGluZS50cmltUmlnaHQoKTtcbiAgICAgIGxldCBpbmRleCA9IGxpbmUuaW5kZXhPZih0aGlzLkZJRUxEX1NFUEFSQVRPUik7XG4gICAgICBpZihpbmRleCA8PSAwKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIC8vIGZpZWxkXG4gICAgICBsZXQgZmllbGQgPSBsaW5lLnN1YnN0cmluZygwLCBpbmRleCk7XG4gICAgICBpZighKGZpZWxkIGluIGUpKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIC8vIHZhbHVlXG4gICAgICBsZXQgdmFsdWUgPSBsaW5lLnN1YnN0cmluZyhpbmRleCArIDEpLnRyaW1MZWZ0KCk7XG4gICAgICBpZihmaWVsZCA9PT0gJ2RhdGEnKSB7XG4gICAgICAgIGVbZmllbGRdICs9IHZhbHVlO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZVtmaWVsZF0gPSB2YWx1ZTtcbiAgICAgIH1cbiAgICB9LmJpbmQodGhpcykpO1xuICAgIC8vIHJldHVybiBldmVudFxuICAgIGxldCBldmVudCA9IG5ldyBDdXN0b21FdmVudChlLmV2ZW50KTtcbiAgICBldmVudC5kYXRhID0gZS5kYXRhO1xuICAgIGV2ZW50LmlkID0gZS5pZDtcbiAgICByZXR1cm4gZXZlbnQ7XG4gIH1cbiAgLy8gX2NoZWNrU3RyZWFtQ2xvc2VkXG4gIF9jaGVja1N0cmVhbUNsb3NlZCgpIHtcbiAgICBpZighdGhpcy54aHIpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgaWYodGhpcy54aHIucmVhZHlTdGF0ZSA9PT0gWE1MSHR0cFJlcXVlc3QuRE9ORSkge1xuICAgICAgdGhpcy5fc2V0UmVhZHlTdGF0ZSh0aGlzLkNMT1NFRCk7XG4gICAgfVxuICB9XG4gIC8vIHN0cmVhbVxuICBzdHJlYW0oKSB7XG4gICAgLy8gc2V0IHJlYWR5IHN0YXRlIHRvIGNvbm5lY3RpbmdcbiAgICB0aGlzLl9zZXRSZWFkeVN0YXRlKHRoaXMuQ09OTkVDVElORyk7XG4gICAgLy8gc2V0IHhociB0byBuZXcgWE1MSHR0cFJlcXVlc3RcbiAgICB0aGlzLnhociA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuICAgIC8vIHNldCB4aHIgcHJvZ3Jlc3MgdG8gX29uU3RyZWFtUHJvZ3Jlc3NcbiAgICB0aGlzLnhoci5hZGRFdmVudExpc3RlbmVyKCdwcm9ncmVzcycsIHRoaXMuX29uU3RyZWFtUHJvZ3Jlc3MuYmluZCh0aGlzKSk7XG4gICAgLy8gc2V0IHhociBsb2FkIHRvIF9vblN0cmVhbUxvYWRlZFxuICAgIHRoaXMueGhyLmFkZEV2ZW50TGlzdGVuZXIoJ2xvYWQnLCB0aGlzLl9vblN0cmVhbUxvYWRlZC5iaW5kKHRoaXMpKTtcbiAgICAvLyBzZXQgeGhyIHJlYWR5IHN0YXRlIGNoYW5nZSB0byBfY2hlY2tTdHJlYW1DbG9zZWRcbiAgICB0aGlzLnhoci5hZGRFdmVudExpc3RlbmVyKCdyZWFkeXN0YXRlY2hhbmdlJywgdGhpcy5fY2hlY2tTdHJlYW1DbG9zZWQuYmluZCh0aGlzKSk7XG4gICAgLy8gc2V0IHhociBlcnJvciB0byBfb25TdHJlYW1GYWlsdXJlXG4gICAgdGhpcy54aHIuYWRkRXZlbnRMaXN0ZW5lcignZXJyb3InLCB0aGlzLl9vblN0cmVhbUZhaWx1cmUuYmluZCh0aGlzKSk7XG4gICAgLy8gc2V0IHhociBhYm9ydCB0byBfb25TdHJlYW1BYm9ydFxuICAgIHRoaXMueGhyLmFkZEV2ZW50TGlzdGVuZXIoJ2Fib3J0JywgdGhpcy5fb25TdHJlYW1BYm9ydC5iaW5kKHRoaXMpKTtcbiAgICAvLyBvcGVuIHhoclxuICAgIHRoaXMueGhyLm9wZW4odGhpcy5tZXRob2QsIHRoaXMudXJsKTtcbiAgICAvLyBoZWFkZXJzIHRvIHhoclxuICAgIGZvciAobGV0IGhlYWRlciBpbiB0aGlzLmhlYWRlcnMpIHtcbiAgICAgIHRoaXMueGhyLnNldFJlcXVlc3RIZWFkZXIoaGVhZGVyLCB0aGlzLmhlYWRlcnNbaGVhZGVyXSk7XG4gICAgfVxuICAgIC8vIGNyZWRlbnRpYWxzIHRvIHhoclxuICAgIHRoaXMueGhyLndpdGhDcmVkZW50aWFscyA9IHRoaXMud2l0aENyZWRlbnRpYWxzO1xuICAgIC8vIHNlbmQgeGhyXG4gICAgdGhpcy54aHIuc2VuZCh0aGlzLnBheWxvYWQpO1xuICB9XG4gIC8vIGNsb3NlXG4gIGNsb3NlKCkge1xuICAgIGlmKHRoaXMucmVhZHlTdGF0ZSA9PT0gdGhpcy5DTE9TRUQpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgdGhpcy54aHIuYWJvcnQoKTtcbiAgICB0aGlzLnhociA9IG51bGw7XG4gICAgdGhpcy5fc2V0UmVhZHlTdGF0ZSh0aGlzLkNMT1NFRCk7XG4gIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBTbWFydENvbm5lY3Rpb25zUGx1Z2luOyJdLAogICJtYXBwaW5ncyI6ICI7Ozs7OztBQUFBO0FBQUEsNEJBQUFBLFVBQUFDLFNBQUE7QUFBQSxRQUFNQyxXQUFOLE1BQWM7QUFBQSxNQUNaLFlBQVksUUFBUTtBQUVsQixhQUFLLFNBQVM7QUFBQSxVQUNaLFdBQVc7QUFBQSxVQUNYLGFBQWE7QUFBQSxVQUNiLGdCQUFnQjtBQUFBLFVBQ2hCLGVBQWU7QUFBQSxVQUNmLGNBQWM7QUFBQSxVQUNkLGdCQUFnQjtBQUFBLFVBQ2hCLGNBQWM7QUFBQSxVQUNkLGVBQWU7QUFBQSxVQUNmLEdBQUc7QUFBQSxRQUNMO0FBQ0EsYUFBSyxZQUFZLEtBQUssT0FBTztBQUM3QixhQUFLLGNBQWMsT0FBTztBQUMxQixhQUFLLFlBQVksS0FBSyxjQUFjLE1BQU0sS0FBSztBQUUvQyxhQUFLLGFBQWE7QUFBQSxNQUNwQjtBQUFBLE1BQ0EsTUFBTSxZQUFZLE1BQU07QUFDdEIsWUFBSSxLQUFLLE9BQU8sZ0JBQWdCO0FBQzlCLGlCQUFP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VUFBRyxVQUFVLFFBQVE7QUFDbkIsVUFBRSxLQUFLLEtBQUs7QUFBQSxNQUNkLE9BQU87QUFDTCxVQUFFLEtBQUssSUFBSTtBQUFBLE1BQ2I7QUFBQSxJQUNGLEVBQUUsS0FBSyxJQUFJLENBQUM7QUFFWixRQUFJLFFBQVEsSUFBSSxZQUFZLEVBQUUsS0FBSztBQUNuQyxVQUFNLE9BQU8sRUFBRTtBQUNmLFVBQU0sS0FBSyxFQUFFO0FBQ2IsV0FBTztBQUFBLEVBQ1Q7QUFBQTtBQUFBLEVBRUEscUJBQXFCO0FBQ25CLFFBQUcsQ0FBQyxLQUFLLEtBQUs7QUFDWjtBQUFBLElBQ0Y7QUFDQSxRQUFHLEtBQUssSUFBSSxlQUFlLGVBQWUsTUFBTTtBQUM5QyxXQUFLLGVBQWUsS0FBSyxNQUFNO0FBQUEsSUFDakM7QUFBQSxFQUNGO0FBQUE7QUFBQSxFQUVBLFNBQVM7QUFFUCxTQUFLLGVBQWUsS0FBSyxVQUFVO0FBRW5DLFNBQUssTUFBTSxJQUFJLGVBQWU7QUFFOUIsU0FBSyxJQUFJLGlCQUFpQixZQUFZLEtBQUssa0JBQWtCLEtBQUssSUFBSSxDQUFDO0FBRXZFLFNBQUssSUFBSSxpQkFBaUIsUUFBUSxLQUFLLGdCQUFnQixLQUFLLElBQUksQ0FBQztBQUVqRSxTQUFLLElBQUksaUJBQWlCLG9CQUFvQixLQUFLLG1CQUFtQixLQUFLLElBQUksQ0FBQztBQUVoRixTQUFLLElBQUksaUJBQWlCLFNBQVMsS0FBSyxpQkFBaUIsS0FBSyxJQUFJLENBQUM7QUFFbkUsU0FBSyxJQUFJLGlCQUFpQixTQUFTLEtBQUssZUFBZSxLQUFLLElBQUksQ0FBQztBQUVqRSxTQUFLLElBQUksS0FBSyxLQUFLLFFBQVEsS0FBSyxHQUFHO0FBRW5DLGFBQVMsVUFBVSxLQUFLLFNBQVM7QUFDL0IsV0FBSyxJQUFJLGlCQUFpQixRQUFRLEtBQUssUUFBUSxNQUFNLENBQUM7QUFBQSxJQUN4RDtBQUVBLFNBQUssSUFBSSxrQkFBa0IsS0FBSztBQUVoQyxTQUFLLElBQUksS0FBSyxLQUFLLE9BQU87QUFBQSxFQUM1QjtBQUFBO0FBQUEsRUFFQSxRQUFRO0FBQ04sUUFBRyxLQUFLLGVBQWUsS0FBSyxRQUFRO0FBQ2xDO0FBQUEsSUFDRjtBQUNBLFNBQUssSUFBSSxNQUFNO0FBQ2YsU0FBSyxNQUFNO0FBQ1gsU0FBSyxlQUFlLEtBQUssTUFBTTtBQUFBLEVBQ2pDO0FBQ0Y7QUFFQSxPQUFPLFVBQVU7IiwKICAibmFtZXMiOiBbImV4cG9ydHMiLCAibW9kdWxlIiwgIlZlY0xpdGUiLCAibGluZV9saW1pdCIsICJpdGVtIiwgImxpbmsiLCAiZmlsZV9saW5rIiwgImZpbGVfbGlua19saXN0Il0KfQo=
