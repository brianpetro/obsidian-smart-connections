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
      window.open("https://buy.stripe.com/9AQ5kO5QnbAWgGAbIY");
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
    const max_available_tokens = max_total_tokens - curr_token_est;
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vdmVjX2xpdGUvdmVjX2xpdGUuanMiLCAiLi4vc3JjL2luZGV4LmpzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJjbGFzcyBWZWNMaXRlIHtcbiAgY29uc3RydWN0b3IoY29uZmlnKSB7XG4gICAgLy8gc2V0IGRlZmF1bHQgY29uZmlnXG4gICAgdGhpcy5jb25maWcgPSB7XG4gICAgICBmaWxlX25hbWU6IFwiZW1iZWRkaW5ncy0zLmpzb25cIixcbiAgICAgIGZvbGRlcl9wYXRoOiBcIi52ZWNfbGl0ZVwiLFxuICAgICAgZXhpc3RzX2FkYXB0ZXI6IG51bGwsXG4gICAgICBta2Rpcl9hZGFwdGVyOiBudWxsLFxuICAgICAgcmVhZF9hZGFwdGVyOiBudWxsLFxuICAgICAgcmVuYW1lX2FkYXB0ZXI6IG51bGwsXG4gICAgICBzdGF0X2FkYXB0ZXI6IG51bGwsXG4gICAgICB3cml0ZV9hZGFwdGVyOiBudWxsLFxuICAgICAgLi4uY29uZmlnXG4gICAgfTtcbiAgICB0aGlzLmZpbGVfbmFtZSA9IHRoaXMuY29uZmlnLmZpbGVfbmFtZTtcbiAgICB0aGlzLmZvbGRlcl9wYXRoID0gY29uZmlnLmZvbGRlcl9wYXRoO1xuICAgIHRoaXMuZmlsZV9wYXRoID0gdGhpcy5mb2xkZXJfcGF0aCArIFwiL1wiICsgdGhpcy5maWxlX25hbWU7XG4gICAgLy8gZ2V0IGZvbGRlciBwYXRoXG4gICAgdGhpcy5lbWJlZGRpbmdzID0gZmFsc2U7XG4gIH1cbiAgYXN5bmMgZmlsZV9leGlzdHMocGF0aCkge1xuICAgIGlmICh0aGlzLmNvbmZpZy5leGlzdHNfYWRhcHRlcikge1xuICAgICAgcmV0dXJuIGF3YWl0IHRoaXMuY29uZmlnLmV4aXN0c19hZGFwdGVyKHBhdGgpO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyB0b2RvIGhhbmRsZSB3aXRoIGZzXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJleGlzdHNfYWRhcHRlciBub3Qgc2V0XCIpO1xuICAgIH1cbiAgfVxuICBhc3luYyBta2RpcihwYXRoKSB7XG4gICAgaWYgKHRoaXMuY29uZmlnLm1rZGlyX2FkYXB0ZXIpIHtcbiAgICAgIHJldHVybiBhd2FpdCB0aGlzLmNvbmZpZy5ta2Rpcl9hZGFwdGVyKHBhdGgpO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyB0b2RvIGhhbmRsZSB3aXRoIGZzXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJta2Rpcl9hZGFwdGVyIG5vdCBzZXRcIik7XG4gICAgfVxuICB9XG4gIGFzeW5jIHJlYWRfZmlsZShwYXRoKSB7XG4gICAgaWYgKHRoaXMuY29uZmlnLnJlYWRfYWRhcHRlcikge1xuICAgICAgcmV0dXJuIGF3YWl0IHRoaXMuY29uZmlnLnJlYWRfYWRhcHRlcihwYXRoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gdG9kbyBoYW5kbGUgd2l0aCBmc1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFwicmVhZF9hZGFwdGVyIG5vdCBzZXRcIik7XG4gICAgfVxuICB9XG4gIGFzeW5jIHJlbmFtZShvbGRfcGF0aCwgbmV3X3BhdGgpIHtcbiAgICBpZiAodGhpcy5jb25maWcucmVuYW1lX2FkYXB0ZXIpIHtcbiAgICAgIHJldHVybiBhd2FpdCB0aGlzLmNvbmZpZy5yZW5hbWVfYWRhcHRlcihvbGRfcGF0aCwgbmV3X3BhdGgpO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyB0b2RvIGhhbmRsZSB3aXRoIGZzXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJyZW5hbWVfYWRhcHRlciBub3Qgc2V0XCIpO1xuICAgIH1cbiAgfVxuICBhc3luYyBzdGF0KHBhdGgpIHtcbiAgICBpZiAodGhpcy5jb25maWcuc3RhdF9hZGFwdGVyKSB7XG4gICAgICByZXR1cm4gYXdhaXQgdGhpcy5jb25maWcuc3RhdF9hZGFwdGVyKHBhdGgpO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyB0b2RvIGhhbmRsZSB3aXRoIGZzXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJzdGF0X2FkYXB0ZXIgbm90IHNldFwiKTtcbiAgICB9XG4gIH1cbiAgYXN5bmMgd3JpdGVfZmlsZShwYXRoLCBkYXRhKSB7XG4gICAgaWYgKHRoaXMuY29uZmlnLndyaXRlX2FkYXB0ZXIpIHtcbiAgICAgIHJldHVybiBhd2FpdCB0aGlzLmNvbmZpZy53cml0ZV9hZGFwdGVyKHBhdGgsIGRhdGEpO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyB0b2RvIGhhbmRsZSB3aXRoIGZzXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJ3cml0ZV9hZGFwdGVyIG5vdCBzZXRcIik7XG4gICAgfVxuICB9XG4gIGFzeW5jIGxvYWQocmV0cmllcyA9IDApIHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgZW1iZWRkaW5nc19maWxlID0gYXdhaXQgdGhpcy5yZWFkX2ZpbGUodGhpcy5maWxlX3BhdGgpO1xuICAgICAgLy8gbG9hZGVkIGVtYmVkZGluZ3MgZnJvbSBmaWxlXG4gICAgICB0aGlzLmVtYmVkZGluZ3MgPSBKU09OLnBhcnNlKGVtYmVkZGluZ3NfZmlsZSk7XG4gICAgICBjb25zb2xlLmxvZyhcImxvYWRlZCBlbWJlZGRpbmdzIGZpbGU6IFwiK3RoaXMuZmlsZV9wYXRoKTtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAvLyByZXRyeSBpZiBlcnJvciB1cCB0byAzIHRpbWVzXG4gICAgICBpZiAocmV0cmllcyA8IDMpIHtcbiAgICAgICAgY29uc29sZS5sb2coXCJyZXRyeWluZyBsb2FkKClcIik7XG4gICAgICAgIC8vIGluY3JlYXNlIHdhaXQgdGltZSBiZXR3ZWVuIHJldHJpZXNcbiAgICAgICAgYXdhaXQgbmV3IFByb21pc2UociA9PiBzZXRUaW1lb3V0KHIsIDEwMDAgKyAoMTAwMCAqIHJldHJpZXMpKSk7XG4gICAgICAgIHJldHVybiBhd2FpdCB0aGlzLmxvYWQocmV0cmllcyArIDEpO1xuICAgICAgfSBlbHNlIGlmIChyZXRyaWVzID09PSAzKSB7XG4gICAgICAgIC8vIGNoZWNrIGZvciBlbWJlZGRpbmdzLTIuanNvbiBmaWxlXG4gICAgICAgIGNvbnN0IGVtYmVkZGluZ3NfMl9maWxlX3BhdGggPSB0aGlzLmZvbGRlcl9wYXRoICsgXCIvZW1iZWRkaW5ncy0yLmpzb25cIjtcbiAgICAgICAgY29uc3QgZW1iZWRkaW5nc18yX2ZpbGVfZXhpc3RzID0gYXdhaXQgdGhpcy5maWxlX2V4aXN0cyhlbWJlZGRpbmdzXzJfZmlsZV9wYXRoKTtcbiAgICAgICAgaWYgKGVtYmVkZGluZ3NfMl9maWxlX2V4aXN0cykge1xuICAgICAgICAgIGF3YWl0IHRoaXMubWlncmF0ZV9lbWJlZGRpbmdzX3YyX3RvX3YzKCk7XG4gICAgICAgICAgcmV0dXJuIGF3YWl0IHRoaXMubG9hZChyZXRyaWVzICsgMSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGNvbnNvbGUubG9nKFwiZmFpbGVkIHRvIGxvYWQgZW1iZWRkaW5ncyBmaWxlLCBwcm9tcHQgdXNlciB0byBpbml0aWF0ZSBidWxrIGVtYmVkXCIpO1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxuICBhc3luYyBtaWdyYXRlX2VtYmVkZGluZ3NfdjJfdG9fdjMoKSB7XG4gICAgY29uc29sZS5sb2coXCJtaWdyYXRpbmcgZW1iZWRkaW5ncy0yLmpzb24gdG8gZW1iZWRkaW5ncy0zLmpzb25cIik7XG4gICAgLy8gbG9hZCBlbWJlZGRpbmdzLTIuanNvblxuICAgIGNvbnN0IGVtYmVkZGluZ3NfMl9maWxlX3BhdGggPSB0aGlzLmZvbGRlcl9wYXRoICsgXCIvZW1iZWRkaW5ncy0yLmpzb25cIjtcbiAgICBjb25zdCBlbWJlZGRpbmdzXzJfZmlsZSA9IGF3YWl0IHRoaXMucmVhZF9maWxlKGVtYmVkZGluZ3NfMl9maWxlX3BhdGgpO1xuICAgIGNvbnN0IGVtYmVkZGluZ3NfMiA9IEpTT04ucGFyc2UoZW1iZWRkaW5nc18yX2ZpbGUpO1xuICAgIC8vIGNvbnZlcnQgZW1iZWRkaW5ncy0yLmpzb24gdG8gZW1iZWRkaW5ncy0zLmpzb25cbiAgICBjb25zdCBlbWJlZGRpbmdzXzMgPSB7fTtcbiAgICBmb3IgKGNvbnN0IFtrZXksIHZhbHVlXSBvZiBPYmplY3QuZW50cmllcyhlbWJlZGRpbmdzXzIpKSB7XG4gICAgICBjb25zdCBuZXdfb2JqID0ge1xuICAgICAgICB2ZWM6IHZhbHVlLnZlYyxcbiAgICAgICAgbWV0YToge31cbiAgICAgIH07XG4gICAgICBjb25zdCBtZXRhID0gdmFsdWUubWV0YTtcbiAgICAgIGNvbnN0IG5ld19tZXRhID0ge307XG4gICAgICBpZihtZXRhLmhhc2gpIG5ld19tZXRhLmhhc2ggPSBtZXRhLmhhc2g7XG4gICAgICBpZihtZXRhLmZpbGUpIG5ld19tZXRhLnBhcmVudCA9IG1ldGEuZmlsZTtcbiAgICAgIGlmKG1ldGEuYmxvY2tzKSBuZXdfbWV0YS5jaGlsZHJlbiA9IG1ldGEuYmxvY2tzO1xuICAgICAgaWYobWV0YS5tdGltZSkgbmV3X21ldGEubXRpbWUgPSBtZXRhLm10aW1lO1xuICAgICAgaWYobWV0YS5zaXplKSBuZXdfbWV0YS5zaXplID0gbWV0YS5zaXplO1xuICAgICAgaWYobWV0YS5sZW4pIG5ld19tZXRhLnNpemUgPSBtZXRhLmxlbjtcbiAgICAgIGlmKG1ldGEucGF0aCkgbmV3X21ldGEucGF0aCA9IG1ldGEucGF0aDtcbiAgICAgIG5ld19tZXRhLnNyYyA9IFwiZmlsZVwiO1xuICAgICAgbmV3X29iai5tZXRhID0gbmV3X21ldGE7XG4gICAgICBlbWJlZGRpbmdzXzNba2V5XSA9IG5ld19vYmo7XG4gICAgfVxuICAgIC8vIHdyaXRlIGVtYmVkZGluZ3MtMy5qc29uXG4gICAgY29uc3QgZW1iZWRkaW5nc18zX2ZpbGUgPSBKU09OLnN0cmluZ2lmeShlbWJlZGRpbmdzXzMpO1xuICAgIGF3YWl0IHRoaXMud3JpdGVfZmlsZSh0aGlzLmZpbGVfcGF0aCwgZW1iZWRkaW5nc18zX2ZpbGUpO1xuICB9XG5cbiAgYXN5bmMgaW5pdF9lbWJlZGRpbmdzX2ZpbGUoKSB7XG4gICAgLy8gY2hlY2sgaWYgZm9sZGVyIGV4aXN0c1xuICAgIGlmICghKGF3YWl0IHRoaXMuZmlsZV9leGlzdHModGhpcy5mb2xkZXJfcGF0aCkpKSB7XG4gICAgICAvLyBjcmVhdGUgZm9sZGVyXG4gICAgICBhd2FpdCB0aGlzLm1rZGlyKHRoaXMuZm9sZGVyX3BhdGgpO1xuICAgICAgY29uc29sZS5sb2coXCJjcmVhdGVkIGZvbGRlcjogXCIrdGhpcy5mb2xkZXJfcGF0aCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnNvbGUubG9nKFwiZm9sZGVyIGFscmVhZHkgZXhpc3RzOiBcIit0aGlzLmZvbGRlcl9wYXRoKTtcbiAgICB9XG4gICAgLy8gY2hlY2sgaWYgZW1iZWRkaW5ncyBmaWxlIGV4aXN0c1xuICAgIGlmICghKGF3YWl0IHRoaXMuZmlsZV9leGlzdHModGhpcy5maWxlX3BhdGgpKSkge1xuICAgICAgLy8gY3JlYXRlIGVtYmVkZGluZ3MgZmlsZVxuICAgICAgYXdhaXQgdGhpcy53cml0ZV9maWxlKHRoaXMuZmlsZV9wYXRoLCBcInt9XCIpO1xuICAgICAgY29uc29sZS5sb2coXCJjcmVhdGVkIGVtYmVkZGluZ3MgZmlsZTogXCIrdGhpcy5maWxlX3BhdGgpO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zb2xlLmxvZyhcImVtYmVkZGluZ3MgZmlsZSBhbHJlYWR5IGV4aXN0czogXCIrdGhpcy5maWxlX3BhdGgpO1xuICAgIH1cbiAgfVxuXG4gIGFzeW5jIHNhdmUoKSB7XG4gICAgY29uc3QgZW1iZWRkaW5ncyA9IEpTT04uc3RyaW5naWZ5KHRoaXMuZW1iZWRkaW5ncyk7XG4gICAgLy8gY2hlY2sgaWYgZW1iZWRkaW5ncyBmaWxlIGV4aXN0c1xuICAgIGNvbnN0IGVtYmVkZGluZ3NfZmlsZV9leGlzdHMgPSBhd2FpdCB0aGlzLmZpbGVfZXhpc3RzKHRoaXMuZmlsZV9wYXRoKTtcbiAgICAvLyBpZiBlbWJlZGRpbmdzIGZpbGUgZXhpc3RzIHRoZW4gY2hlY2sgaWYgbmV3IGVtYmVkZGluZ3MgZmlsZSBzaXplIGlzIHNpZ25pZmljYW50bHkgc21hbGxlciB0aGFuIGV4aXN0aW5nIGVtYmVkZGluZ3MgZmlsZSBzaXplXG4gICAgaWYgKGVtYmVkZGluZ3NfZmlsZV9leGlzdHMpIHtcbiAgICAgIC8vIGVzaXRtYXRlIGZpbGUgc2l6ZSBvZiBlbWJlZGRpbmdzXG4gICAgICBjb25zdCBuZXdfZmlsZV9zaXplID0gZW1iZWRkaW5ncy5sZW5ndGg7XG4gICAgICAvLyBnZXQgZXhpc3RpbmcgZmlsZSBzaXplXG4gICAgICBjb25zdCBleGlzdGluZ19maWxlX3NpemUgPSBhd2FpdCB0aGlzLnN0YXQodGhpcy5maWxlX3BhdGgpLnRoZW4oKHN0YXQpID0+IHN0YXQuc2l6ZSk7XG4gICAgICAvLyBjb25zb2xlLmxvZyhcIm5ldyBmaWxlIHNpemU6IFwiK25ld19maWxlX3NpemUpO1xuICAgICAgLy8gY29uc29sZS5sb2coXCJleGlzdGluZyBmaWxlIHNpemU6IFwiK2V4aXN0aW5nX2ZpbGVfc2l6ZSk7XG4gICAgICAvLyBpZiBuZXcgZmlsZSBzaXplIGlzIGF0IGxlYXN0IDUwJSBvZiBleGlzdGluZyBmaWxlIHNpemUgdGhlbiB3cml0ZSBlbWJlZGRpbmdzIHRvIGZpbGVcbiAgICAgIGlmIChuZXdfZmlsZV9zaXplID4gKGV4aXN0aW5nX2ZpbGVfc2l6ZSAqIDAuNSkpIHtcbiAgICAgICAgLy8gd3JpdGUgZW1iZWRkaW5ncyB0byBmaWxlXG4gICAgICAgIGF3YWl0IHRoaXMud3JpdGVfZmlsZSh0aGlzLmZpbGVfcGF0aCwgZW1iZWRkaW5ncyk7XG4gICAgICAgIGNvbnNvbGUubG9nKFwiZW1iZWRkaW5ncyBmaWxlIHNpemU6IFwiICsgbmV3X2ZpbGVfc2l6ZSArIFwiIGJ5dGVzXCIpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gaWYgbmV3IGZpbGUgc2l6ZSBpcyBzaWduaWZpY2FudGx5IHNtYWxsZXIgdGhhbiBleGlzdGluZyBmaWxlIHNpemUgdGhlbiB0aHJvdyBlcnJvclxuICAgICAgICAvLyBzaG93IHdhcm5pbmcgbWVzc2FnZSBpbmNsdWRpbmcgZmlsZSBzaXplc1xuICAgICAgICBjb25zdCB3YXJuaW5nX21lc3NhZ2UgPSBbXG4gICAgICAgICAgXCJXYXJuaW5nOiBOZXcgZW1iZWRkaW5ncyBmaWxlIHNpemUgaXMgc2lnbmlmaWNhbnRseSBzbWFsbGVyIHRoYW4gZXhpc3RpbmcgZW1iZWRkaW5ncyBmaWxlIHNpemUuXCIsXG4gICAgICAgICAgXCJBYm9ydGluZyB0byBwcmV2ZW50IHBvc3NpYmxlIGxvc3Mgb2YgZW1iZWRkaW5ncyBkYXRhLlwiLFxuICAgICAgICAgIFwiTmV3IGZpbGUgc2l6ZTogXCIgKyBuZXdfZmlsZV9zaXplICsgXCIgYnl0ZXMuXCIsXG4gICAgICAgICAgXCJFeGlzdGluZyBmaWxlIHNpemU6IFwiICsgZXhpc3RpbmdfZmlsZV9zaXplICsgXCIgYnl0ZXMuXCIsXG4gICAgICAgICAgXCJSZXN0YXJ0aW5nIE9ic2lkaWFuIG1heSBmaXggdGhpcy5cIlxuICAgICAgICBdO1xuICAgICAgICBjb25zb2xlLmxvZyh3YXJuaW5nX21lc3NhZ2Uuam9pbihcIiBcIikpO1xuICAgICAgICAvLyBzYXZlIGVtYmVkZGluZ3MgdG8gZmlsZSBuYW1lZCB1bnNhdmVkLWVtYmVkZGluZ3MuanNvblxuICAgICAgICBhd2FpdCB0aGlzLndyaXRlX2ZpbGUodGhpcy5mb2xkZXJfcGF0aCtcIi91bnNhdmVkLWVtYmVkZGluZ3MuanNvblwiLCBlbWJlZGRpbmdzKTtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiRXJyb3I6IE5ldyBlbWJlZGRpbmdzIGZpbGUgc2l6ZSBpcyBzaWduaWZpY2FudGx5IHNtYWxsZXIgdGhhbiBleGlzdGluZyBlbWJlZGRpbmdzIGZpbGUgc2l6ZS4gQWJvcnRpbmcgdG8gcHJldmVudCBwb3NzaWJsZSBsb3NzIG9mIGVtYmVkZGluZ3MgZGF0YS5cIik7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGF3YWl0IHRoaXMuaW5pdF9lbWJlZGRpbmdzX2ZpbGUoKTtcbiAgICAgIHJldHVybiBhd2FpdCB0aGlzLnNhdmUoKTtcbiAgICB9XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cbiAgY29zX3NpbSh2ZWN0b3IxLCB2ZWN0b3IyKSB7XG4gICAgbGV0IGRvdFByb2R1Y3QgPSAwO1xuICAgIGxldCBub3JtQSA9IDA7XG4gICAgbGV0IG5vcm1CID0gMDtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHZlY3RvcjEubGVuZ3RoOyBpKyspIHtcbiAgICAgIGRvdFByb2R1Y3QgKz0gdmVjdG9yMVtpXSAqIHZlY3RvcjJbaV07XG4gICAgICBub3JtQSArPSB2ZWN0b3IxW2ldICogdmVjdG9yMVtpXTtcbiAgICAgIG5vcm1CICs9IHZlY3RvcjJbaV0gKiB2ZWN0b3IyW2ldO1xuICAgIH1cbiAgICBpZiAobm9ybUEgPT09IDAgfHwgbm9ybUIgPT09IDApIHtcbiAgICAgIHJldHVybiAwO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gZG90UHJvZHVjdCAvIChNYXRoLnNxcnQobm9ybUEpICogTWF0aC5zcXJ0KG5vcm1CKSk7XG4gICAgfVxuICB9XG4gIG5lYXJlc3QodG9fdmVjLCBmaWx0ZXIgPSB7fSkge1xuICAgIGZpbHRlciA9IHtcbiAgICAgIHJlc3VsdHNfY291bnQ6IDMwLFxuICAgICAgLi4uZmlsdGVyXG4gICAgfTtcbiAgICBsZXQgbmVhcmVzdCA9IFtdO1xuICAgIGNvbnN0IGZyb21fa2V5cyA9IE9iamVjdC5rZXlzKHRoaXMuZW1iZWRkaW5ncyk7XG4gICAgLy8gdGhpcy5yZW5kZXJfbG9nLnRvdGFsX2VtYmVkZGluZ3MgPSBmcm9tX2tleXMubGVuZ3RoO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZnJvbV9rZXlzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAvLyBpZiB0aGlzLnNldHRpbmdzLnNraXBfc2VjdGlvbnMgaXMgdHJ1ZVxuICAgICAgaWYgKGZpbHRlci5za2lwX3NlY3Rpb25zKSB7XG4gICAgICAgIGNvbnN0IGZyb21fcGF0aCA9IHRoaXMuZW1iZWRkaW5nc1tmcm9tX2tleXNbaV1dLm1ldGEucGF0aDtcbiAgICAgICAgaWYgKGZyb21fcGF0aC5pbmRleE9mKFwiI1wiKSA+IC0xKSBjb250aW51ZTsgLy8gc2tpcCBpZiBjb250YWlucyAjIGluZGljYXRpbmcgYmxvY2sgKHNlY3Rpb24pXG5cbiAgICAgICAgLy8gVE9ETzogY29uc2lkZXIgdXNpbmcgcHJlc2VuY2Ugb2YgbWV0YS5wYXJlbnQgdG8gc2tpcCBmaWxlcyAoZmFzdGVyIGNoZWNraW5nPylcbiAgICAgIH1cbiAgICAgIGlmIChmaWx0ZXIuc2tpcF9rZXkpIHtcbiAgICAgICAgaWYgKGZpbHRlci5za2lwX2tleSA9PT0gZnJvbV9rZXlzW2ldKSBjb250aW51ZTsgLy8gc2tpcCBtYXRjaGluZyB0byBjdXJyZW50IG5vdGVcbiAgICAgICAgaWYgKGZpbHRlci5za2lwX2tleSA9PT0gdGhpcy5lbWJlZGRpbmdzW2Zyb21fa2V5c1tpXV0ubWV0YS5wYXJlbnQpIGNvbnRpbnVlOyAvLyBza2lwIGlmIGZpbHRlci5za2lwX2tleSBtYXRjaGVzIG1ldGEucGFyZW50XG4gICAgICB9XG4gICAgICAvLyBpZiBmaWx0ZXIucGF0aF9iZWdpbnNfd2l0aCBpcyBzZXQgKGZvbGRlciBmaWx0ZXIpXG4gICAgICBpZiAoZmlsdGVyLnBhdGhfYmVnaW5zX3dpdGgpIHtcbiAgICAgICAgLy8gaWYgdHlwZSBpcyBzdHJpbmcgJiBtZXRhLnBhdGggZG9lcyBub3QgYmVnaW4gd2l0aCBmaWx0ZXIucGF0aF9iZWdpbnNfd2l0aCwgc2tpcFxuICAgICAgICBpZiAodHlwZW9mIGZpbHRlci5wYXRoX2JlZ2luc193aXRoID09PSBcInN0cmluZ1wiICYmICF0aGlzLmVtYmVkZGluZ3NbZnJvbV9rZXlzW2ldXS5tZXRhLnBhdGguc3RhcnRzV2l0aChmaWx0ZXIucGF0aF9iZWdpbnNfd2l0aCkpIGNvbnRpbnVlO1xuICAgICAgICAvLyBpZiB0eXBlIGlzIGFycmF5ICYgbWV0YS5wYXRoIGRvZXMgbm90IGJlZ2luIHdpdGggYW55IG9mIHRoZSBmaWx0ZXIucGF0aF9iZWdpbnNfd2l0aCwgc2tpcFxuICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShmaWx0ZXIucGF0aF9iZWdpbnNfd2l0aCkgJiYgIWZpbHRlci5wYXRoX2JlZ2luc193aXRoLnNvbWUoKHBhdGgpID0+IHRoaXMuZW1iZWRkaW5nc1tmcm9tX2tleXNbaV1dLm1ldGEucGF0aC5zdGFydHNXaXRoKHBhdGgpKSkgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIG5lYXJlc3QucHVzaCh7XG4gICAgICAgIGxpbms6IHRoaXMuZW1iZWRkaW5nc1tmcm9tX2tleXNbaV1dLm1ldGEucGF0aCxcbiAgICAgICAgc2ltaWxhcml0eTogdGhpcy5jb3Nfc2ltKHRvX3ZlYywgdGhpcy5lbWJlZGRpbmdzW2Zyb21fa2V5c1tpXV0udmVjKSxcbiAgICAgICAgc2l6ZTogdGhpcy5lbWJlZGRpbmdzW2Zyb21fa2V5c1tpXV0ubWV0YS5zaXplLFxuICAgICAgfSk7XG4gICAgfVxuICAgIC8vIHNvcnQgYXJyYXkgYnkgY29zaW5lIHNpbWlsYXJpdHlcbiAgICBuZWFyZXN0LnNvcnQoZnVuY3Rpb24gKGEsIGIpIHtcbiAgICAgIHJldHVybiBiLnNpbWlsYXJpdHkgLSBhLnNpbWlsYXJpdHk7XG4gICAgfSk7XG4gICAgLy8gY29uc29sZS5sb2cobmVhcmVzdCk7XG4gICAgLy8gbGltaXQgdG8gTiBuZWFyZXN0IGNvbm5lY3Rpb25zXG4gICAgbmVhcmVzdCA9IG5lYXJlc3Quc2xpY2UoMCwgZmlsdGVyLnJlc3VsdHNfY291bnQpO1xuICAgIHJldHVybiBuZWFyZXN0O1xuICB9XG4gIGZpbmRfbmVhcmVzdF9lbWJlZGRpbmdzKHRvX3ZlYywgZmlsdGVyPXt9KSB7XG4gICAgY29uc3QgZGVmYXVsdF9maWx0ZXIgPSB7XG4gICAgICBtYXg6IHRoaXMubWF4X3NvdXJjZXMsXG4gICAgfTtcbiAgICBmaWx0ZXIgPSB7Li4uZGVmYXVsdF9maWx0ZXIsIC4uLmZpbHRlcn07XG4gICAgLy8gaGFuZGxlIGlmIHRvX3ZlYyBpcyBhbiBhcnJheSBvZiB2ZWN0b3JzXG4gICAgLy8gbGV0IG5lYXJlc3QgPSBbXTtcbiAgICBpZihBcnJheS5pc0FycmF5KHRvX3ZlYykgJiYgdG9fdmVjLmxlbmd0aCAhPT0gdGhpcy52ZWNfbGVuKXtcbiAgICAgIHRoaXMubmVhcmVzdCA9IHt9O1xuICAgICAgZm9yKGxldCBpID0gMDsgaSA8IHRvX3ZlYy5sZW5ndGg7IGkrKyl7XG4gICAgICAgIC8vIG5lYXJlc3QgPSBuZWFyZXN0LmNvbmNhdCh0aGlzLmZpbmRfbmVhcmVzdF9lbWJlZGRpbmdzKHRvX3ZlY1tpXSwge1xuICAgICAgICAvLyAgIG1heDogTWF0aC5mbG9vcihmaWx0ZXIubWF4IC8gdG9fdmVjLmxlbmd0aClcbiAgICAgICAgLy8gfSkpO1xuICAgICAgICB0aGlzLmZpbmRfbmVhcmVzdF9lbWJlZGRpbmdzKHRvX3ZlY1tpXSwge1xuICAgICAgICAgIG1heDogTWF0aC5mbG9vcihmaWx0ZXIubWF4IC8gdG9fdmVjLmxlbmd0aClcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfWVsc2V7XG4gICAgICBjb25zdCBmcm9tX2tleXMgPSBPYmplY3Qua2V5cyh0aGlzLmVtYmVkZGluZ3MpO1xuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBmcm9tX2tleXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgaWYodGhpcy52YWxpZGF0ZV90eXBlKHRoaXMuZW1iZWRkaW5nc1tmcm9tX2tleXNbaV1dKSkgY29udGludWU7XG4gICAgICAgIGNvbnN0IHNpbSA9IHRoaXMuY29tcHV0ZUNvc2luZVNpbWlsYXJpdHkodG9fdmVjLCB0aGlzLmVtYmVkZGluZ3NbZnJvbV9rZXlzW2ldXS52ZWMpO1xuICAgICAgICBpZih0aGlzLm5lYXJlc3RbZnJvbV9rZXlzW2ldXSl7IC8vIGlmIGFscmVhZHkgY29tcHV0ZWQsIHVzZSBjYWNoZWQgdmFsdWVcbiAgICAgICAgICB0aGlzLm5lYXJlc3RbZnJvbV9rZXlzW2ldXSArPSBzaW07XG4gICAgICAgIH1lbHNle1xuICAgICAgICAgIHRoaXMubmVhcmVzdFtmcm9tX2tleXNbaV1dID0gc2ltO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIC8vIGluaXRpYXRlIG5lYXJlc3QgYXJyYXlcbiAgICBsZXQgbmVhcmVzdCA9IE9iamVjdC5rZXlzKHRoaXMubmVhcmVzdCkubWFwKGtleSA9PiB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBrZXk6IGtleSxcbiAgICAgICAgc2ltaWxhcml0eTogdGhpcy5uZWFyZXN0W2tleV0sXG4gICAgICB9XG4gICAgfSk7XG4gICAgLy8gc29ydCBhcnJheSBieSBjb3NpbmUgc2ltaWxhcml0eVxuICAgIG5lYXJlc3QgPSB0aGlzLnNvcnRfYnlfc2ltaWxhcml0eShuZWFyZXN0KTtcbiAgICBuZWFyZXN0ID0gbmVhcmVzdC5zbGljZSgwLCBmaWx0ZXIubWF4KTtcbiAgICAvLyBhZGQgbGluayBhbmQgbGVuZ3RoIHRvIHJlbWFpbmluZyBuZWFyZXN0XG4gICAgbmVhcmVzdCA9IG5lYXJlc3QubWFwKGl0ZW0gPT4ge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgbGluazogdGhpcy5lbWJlZGRpbmdzW2l0ZW0ua2V5XS5tZXRhLnBhdGgsXG4gICAgICAgIHNpbWlsYXJpdHk6IGl0ZW0uc2ltaWxhcml0eSxcbiAgICAgICAgbGVuOiB0aGlzLmVtYmVkZGluZ3NbaXRlbS5rZXldLm1ldGEubGVuIHx8IHRoaXMuZW1iZWRkaW5nc1tpdGVtLmtleV0ubWV0YS5zaXplLFxuICAgICAgfVxuICAgIH0pO1xuICAgIHJldHVybiBuZWFyZXN0O1xuICB9XG4gIHNvcnRfYnlfc2ltaWxhcml0eShuZWFyZXN0KSB7XG4gICAgcmV0dXJuIG5lYXJlc3Quc29ydChmdW5jdGlvbiAoYSwgYikge1xuICAgICAgY29uc3QgYV9zY29yZSA9IGEuc2ltaWxhcml0eTtcbiAgICAgIGNvbnN0IGJfc2NvcmUgPSBiLnNpbWlsYXJpdHk7XG4gICAgICAvLyBpZiBhIGlzIGdyZWF0ZXIgdGhhbiBiLCByZXR1cm4gLTFcbiAgICAgIGlmIChhX3Njb3JlID4gYl9zY29yZSlcbiAgICAgICAgcmV0dXJuIC0xO1xuICAgICAgLy8gaWYgYSBpcyBsZXNzIHRoYW4gYiwgcmV0dXJuIDFcbiAgICAgIGlmIChhX3Njb3JlIDwgYl9zY29yZSlcbiAgICAgICAgcmV0dXJuIDE7XG4gICAgICAvLyBpZiBhIGlzIGVxdWFsIHRvIGIsIHJldHVybiAwXG4gICAgICByZXR1cm4gMDtcbiAgICB9KTtcbiAgfVxuICAvLyBjaGVjayBpZiBrZXkgZnJvbSBlbWJlZGRpbmdzIGV4aXN0cyBpbiBmaWxlc1xuICBjbGVhbl91cF9lbWJlZGRpbmdzKGZpbGVzKSB7XG4gICAgY29uc29sZS5sb2coXCJjbGVhbmluZyB1cCBlbWJlZGRpbmdzXCIpO1xuICAgIGNvbnN0IGtleXMgPSBPYmplY3Qua2V5cyh0aGlzLmVtYmVkZGluZ3MpO1xuICAgIGxldCBkZWxldGVkX2VtYmVkZGluZ3MgPSAwO1xuICAgIGZvciAoY29uc3Qga2V5IG9mIGtleXMpIHtcbiAgICAgIC8vIGNvbnNvbGUubG9nKFwia2V5OiBcIitrZXkpO1xuICAgICAgY29uc3QgcGF0aCA9IHRoaXMuZW1iZWRkaW5nc1trZXldLm1ldGEucGF0aDtcbiAgICAgIC8vIGlmIG5vIGtleSBzdGFydHMgd2l0aCBmaWxlIHBhdGhcbiAgICAgIGlmKCFmaWxlcy5maW5kKGZpbGUgPT4gcGF0aC5zdGFydHNXaXRoKGZpbGUucGF0aCkpKSB7XG4gICAgICAgIC8vIGRlbGV0ZSBrZXkgaWYgaXQgZG9lc24ndCBleGlzdFxuICAgICAgICBkZWxldGUgdGhpcy5lbWJlZGRpbmdzW2tleV07XG4gICAgICAgIGRlbGV0ZWRfZW1iZWRkaW5ncysrO1xuICAgICAgICAvLyBjb25zb2xlLmxvZyhcImRlbGV0aW5nIChkZWxldGVkIGZpbGUpOiBcIiArIGtleSk7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgICAgLy8gaWYga2V5IGNvbnRhaW5zICcjJ1xuICAgICAgaWYocGF0aC5pbmRleE9mKFwiI1wiKSA+IC0xKSB7XG4gICAgICAgIGNvbnN0IHBhcmVudF9rZXkgPSB0aGlzLmVtYmVkZGluZ3Nba2V5XS5tZXRhLnBhcmVudDtcbiAgICAgICAgLy8gaWYgcGFyZW50X2tleSBtaXNzaW5nIGZyb20gZW1iZWRkaW5ncyB0aGVuIGRlbGV0ZSBrZXlcbiAgICAgICAgaWYoIXRoaXMuZW1iZWRkaW5nc1twYXJlbnRfa2V5XSl7XG4gICAgICAgICAgLy8gZGVsZXRlIGtleVxuICAgICAgICAgIGRlbGV0ZSB0aGlzLmVtYmVkZGluZ3Nba2V5XTtcbiAgICAgICAgICBkZWxldGVkX2VtYmVkZGluZ3MrKztcbiAgICAgICAgICAvLyBjb25zb2xlLmxvZyhcImRlbGV0aW5nIChtaXNzaW5nIHBhcmVudClcIik7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgICAgLy8gaWYgcGFyZW50X2tleSBtaXNzaW5nIG1ldGEgdGhlbiBkZWxldGUga2V5XG4gICAgICAgIGlmKCF0aGlzLmVtYmVkZGluZ3NbcGFyZW50X2tleV0ubWV0YSl7XG4gICAgICAgICAgLy8gZGVsZXRlIGtleVxuICAgICAgICAgIGRlbGV0ZSB0aGlzLmVtYmVkZGluZ3Nba2V5XTtcbiAgICAgICAgICBkZWxldGVkX2VtYmVkZGluZ3MrKztcbiAgICAgICAgICAvLyBjb25zb2xlLmxvZyhcImRlbGV0aW5nIChwYXJlbnQgbWlzc2luZyBtZXRhKVwiKTtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICAgICAgICAvLyBpZiBwYXJlbnRfa2V5IG1pc3NpbmcgY2hpbGRyZW4gdGhlbiBkZWxldGUga2V5XG4gICAgICAgIC8vIGlmIHBhcmVudF9rZXkgY2hpbGRyZW4gZG9lc24ndCBpbmNsdWRlIGtleSB0aGVuIGRlbGV0ZSBrZXlcbiAgICAgICAgaWYodGhpcy5lbWJlZGRpbmdzW3BhcmVudF9rZXldLm1ldGEuY2hpbGRyZW4gJiYgKHRoaXMuZW1iZWRkaW5nc1twYXJlbnRfa2V5XS5tZXRhLmNoaWxkcmVuLmluZGV4T2Yoa2V5KSA8IDApKSB7XG4gICAgICAgICAgLy8gZGVsZXRlIGtleVxuICAgICAgICAgIGRlbGV0ZSB0aGlzLmVtYmVkZGluZ3Nba2V5XTtcbiAgICAgICAgICBkZWxldGVkX2VtYmVkZGluZ3MrKztcbiAgICAgICAgICAvLyBjb25zb2xlLmxvZyhcImRlbGV0aW5nIChub3QgcHJlc2VudCBpbiBwYXJlbnQncyBjaGlsZHJlbilcIik7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHtkZWxldGVkX2VtYmVkZGluZ3M6IGRlbGV0ZWRfZW1iZWRkaW5ncywgdG90YWxfZW1iZWRkaW5nczoga2V5cy5sZW5ndGh9O1xuICB9XG5cbiAgZ2V0KGtleSkge1xuICAgIHJldHVybiB0aGlzLmVtYmVkZGluZ3Nba2V5XSB8fCBudWxsO1xuICB9XG4gIGdldF9tZXRhKGtleSkge1xuICAgIGNvbnN0IGVtYmVkZGluZyA9IHRoaXMuZ2V0KGtleSk7XG4gICAgaWYoZW1iZWRkaW5nICYmIGVtYmVkZGluZy5tZXRhKSB7XG4gICAgICByZXR1cm4gZW1iZWRkaW5nLm1ldGE7XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9XG4gIGdldF9tdGltZShrZXkpIHtcbiAgICBjb25zdCBtZXRhID0gdGhpcy5nZXRfbWV0YShrZXkpO1xuICAgIGlmKG1ldGEgJiYgbWV0YS5tdGltZSkge1xuICAgICAgcmV0dXJuIG1ldGEubXRpbWU7XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9XG4gIGdldF9oYXNoKGtleSkge1xuICAgIGNvbnN0IG1ldGEgPSB0aGlzLmdldF9tZXRhKGtleSk7XG4gICAgaWYobWV0YSAmJiBtZXRhLmhhc2gpIHtcbiAgICAgIHJldHVybiBtZXRhLmhhc2g7XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9XG4gIGdldF9zaXplKGtleSkge1xuICAgIGNvbnN0IG1ldGEgPSB0aGlzLmdldF9tZXRhKGtleSk7XG4gICAgaWYobWV0YSAmJiBtZXRhLnNpemUpIHtcbiAgICAgIHJldHVybiBtZXRhLnNpemU7XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9XG4gIGdldF9jaGlsZHJlbihrZXkpIHtcbiAgICBjb25zdCBtZXRhID0gdGhpcy5nZXRfbWV0YShrZXkpO1xuICAgIGlmKG1ldGEgJiYgbWV0YS5jaGlsZHJlbikge1xuICAgICAgcmV0dXJuIG1ldGEuY2hpbGRyZW47XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9XG4gIGdldF92ZWMoa2V5KSB7XG4gICAgY29uc3QgZW1iZWRkaW5nID0gdGhpcy5nZXQoa2V5KTtcbiAgICBpZihlbWJlZGRpbmcgJiYgZW1iZWRkaW5nLnZlYykge1xuICAgICAgcmV0dXJuIGVtYmVkZGluZy52ZWM7XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9XG4gIHNhdmVfZW1iZWRkaW5nKGtleSwgdmVjLCBtZXRhKSB7XG4gICAgdGhpcy5lbWJlZGRpbmdzW2tleV0gPSB7XG4gICAgICB2ZWM6IHZlYyxcbiAgICAgIG1ldGE6IG1ldGEsXG4gICAgfTtcbiAgfVxuICBtdGltZV9pc19jdXJyZW50KGtleSwgc291cmNlX210aW1lKSB7XG4gICAgY29uc3QgbXRpbWUgPSB0aGlzLmdldF9tdGltZShrZXkpO1xuICAgIGlmKG10aW1lICYmIG10aW1lID49IHNvdXJjZV9tdGltZSkge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIGFzeW5jIGZvcmNlX3JlZnJlc2goKSB7XG4gICAgdGhpcy5lbWJlZGRpbmdzID0gbnVsbDtcbiAgICB0aGlzLmVtYmVkZGluZ3MgPSB7fTtcbiAgICAvLyBnZXQgY3VycmVudCBkYXRldGltZSBhcyB1bml4IHRpbWVzdGFtcFxuICAgIGxldCBjdXJyZW50X2RhdGV0aW1lID0gTWF0aC5mbG9vcihEYXRlLm5vdygpIC8gMTAwMCk7XG4gICAgLy8gcmVuYW1lIGV4aXN0aW5nIGVtYmVkZGluZ3MgZmlsZSB0byB0aGlzLmZvbGRlcl9wYXRoL2VtYmVkZGluZ3MtWVlZWS1NTS1ERC5qc29uXG4gICAgYXdhaXQgdGhpcy5yZW5hbWUodGhpcy5maWxlX3BhdGgsIHRoaXMuZm9sZGVyX3BhdGggKyBcIi9lbWJlZGRpbmdzLVwiICsgY3VycmVudF9kYXRldGltZSArIFwiLmpzb25cIik7XG4gICAgLy8gY3JlYXRlIG5ldyBlbWJlZGRpbmdzIGZpbGVcbiAgICBhd2FpdCB0aGlzLmluaXRfZW1iZWRkaW5nc19maWxlKCk7XG4gIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBWZWNMaXRlOyIsICJjb25zdCBPYnNpZGlhbiA9IHJlcXVpcmUoXCJvYnNpZGlhblwiKTtcbmNvbnN0IFZlY0xpdGUgPSByZXF1aXJlKFwidmVjLWxpdGVcIik7XG5cbmNvbnN0IERFRkFVTFRfU0VUVElOR1MgPSB7XG4gIGFwaV9rZXk6IFwiXCIsXG4gIGNoYXRfb3BlbjogdHJ1ZSxcbiAgZmlsZV9leGNsdXNpb25zOiBcIlwiLFxuICBmb2xkZXJfZXhjbHVzaW9uczogXCJcIixcbiAgaGVhZGVyX2V4Y2x1c2lvbnM6IFwiXCIsXG4gIHBhdGhfb25seTogXCJcIixcbiAgc2hvd19mdWxsX3BhdGg6IGZhbHNlLFxuICBleHBhbmRlZF92aWV3OiB0cnVlLFxuICBncm91cF9uZWFyZXN0X2J5X2ZpbGU6IGZhbHNlLFxuICBsYW5ndWFnZTogXCJlblwiLFxuICBsb2dfcmVuZGVyOiBmYWxzZSxcbiAgbG9nX3JlbmRlcl9maWxlczogZmFsc2UsXG4gIHJlY2VudGx5X3NlbnRfcmV0cnlfbm90aWNlOiBmYWxzZSxcbiAgc2tpcF9zZWN0aW9uczogZmFsc2UsXG4gIHNtYXJ0X2NoYXRfbW9kZWw6IFwiZ3B0LTMuNS10dXJiby0xNmtcIixcbiAgdmlld19vcGVuOiB0cnVlLFxuICB2ZXJzaW9uOiBcIlwiLFxufTtcbmNvbnN0IE1BWF9FTUJFRF9TVFJJTkdfTEVOR1RIID0gMjUwMDA7XG5cbmxldCBWRVJTSU9OO1xuY29uc3QgU1VQUE9SVEVEX0ZJTEVfVFlQRVMgPSBbXCJtZFwiLCBcImNhbnZhc1wiXTtcblxuLy9jcmVhdGUgb25lIG9iamVjdCB3aXRoIGFsbCB0aGUgdHJhbnNsYXRpb25zXG4vLyByZXNlYXJjaCA6IFNNQVJUX1RSQU5TTEFUSU9OW2xhbmd1YWdlXVtrZXldXG5jb25zdCBTTUFSVF9UUkFOU0xBVElPTiA9IHtcbiAgXCJlblwiOiB7XG4gICAgXCJwcm9ub3VzXCI6IFtcIm15XCIsIFwiSVwiLCBcIm1lXCIsIFwibWluZVwiLCBcIm91clwiLCBcIm91cnNcIiwgXCJ1c1wiLCBcIndlXCJdLFxuICAgIFwicHJvbXB0XCI6IFwiQmFzZWQgb24geW91ciBub3Rlc1wiLFxuICAgIFwiaW5pdGlhbF9tZXNzYWdlXCI6IFwiSGksIEknbSBDaGF0R1BUIHdpdGggYWNjZXNzIHRvIHlvdXIgbm90ZXMgdmlhIFNtYXJ0IENvbm5lY3Rpb25zLiBBc2sgbWUgYSBxdWVzdGlvbiBhYm91dCB5b3VyIG5vdGVzIGFuZCBJJ2xsIHRyeSB0byBhbnN3ZXIgaXQuXCIsXG4gIH0sXG4gIFwiZXNcIjoge1xuICAgIFwicHJvbm91c1wiOiBbXCJtaVwiLCBcInlvXCIsIFwibVx1MDBFRFwiLCBcInRcdTAwRkFcIl0sXG4gICAgXCJwcm9tcHRcIjogXCJCYXNcdTAwRTFuZG9zZSBlbiBzdXMgbm90YXNcIixcbiAgICBcImluaXRpYWxfbWVzc2FnZVwiOiBcIkhvbGEsIHNveSBDaGF0R1BUIGNvbiBhY2Nlc28gYSB0dXMgYXB1bnRlcyBhIHRyYXZcdTAwRTlzIGRlIFNtYXJ0IENvbm5lY3Rpb25zLiBIYXptZSB1bmEgcHJlZ3VudGEgc29icmUgdHVzIGFwdW50ZXMgZSBpbnRlbnRhclx1MDBFOSByZXNwb25kZXJ0ZS5cIixcbiAgfSxcbiAgXCJmclwiOiB7XG4gICAgXCJwcm9ub3VzXCI6IFtcIm1lXCIsIFwibW9uXCIsIFwibWFcIiwgXCJtZXNcIiwgXCJtb2lcIiwgXCJub3VzXCIsIFwibm90cmVcIiwgXCJub3NcIiwgXCJqZVwiLCBcImonXCIsIFwibSdcIl0sXG4gICAgXCJwcm9tcHRcIjogXCJEJ2Fwclx1MDBFOHMgdm9zIG5vdGVzXCIsXG4gICAgXCJpbml0aWFsX21lc3NhZ2VcIjogXCJCb25qb3VyLCBqZSBzdWlzIENoYXRHUFQgZXQgaidhaSBhY2NcdTAwRThzIFx1MDBFMCB2b3Mgbm90ZXMgdmlhIFNtYXJ0IENvbm5lY3Rpb25zLiBQb3Nlei1tb2kgdW5lIHF1ZXN0aW9uIHN1ciB2b3Mgbm90ZXMgZXQgaidlc3NhaWVyYWkgZCd5IHJcdTAwRTlwb25kcmUuXCIsXG4gIH0sXG4gIFwiZGVcIjoge1xuICAgIFwicHJvbm91c1wiOiBbXCJtZWluXCIsIFwibWVpbmVcIiwgXCJtZWluZW5cIiwgXCJtZWluZXJcIiwgXCJtZWluZXNcIiwgXCJtaXJcIiwgXCJ1bnNcIiwgXCJ1bnNlclwiLCBcInVuc2VyZW5cIiwgXCJ1bnNlcmVyXCIsIFwidW5zZXJlc1wiXSxcbiAgICBcInByb21wdFwiOiBcIkJhc2llcmVuZCBhdWYgSWhyZW4gTm90aXplblwiLFxuICAgIFwiaW5pdGlhbF9tZXNzYWdlXCI6IFwiSGFsbG8sIGljaCBiaW4gQ2hhdEdQVCB1bmQgaGFiZSBcdTAwRkNiZXIgU21hcnQgQ29ubmVjdGlvbnMgWnVnYW5nIHp1IElocmVuIE5vdGl6ZW4uIFN0ZWxsZW4gU2llIG1pciBlaW5lIEZyYWdlIHp1IElocmVuIE5vdGl6ZW4gdW5kIGljaCB3ZXJkZSB2ZXJzdWNoZW4sIHNpZSB6dSBiZWFudHdvcnRlbi5cIixcbiAgfSxcbiAgXCJpdFwiOiB7XG4gICAgXCJwcm9ub3VzXCI6IFtcIm1pb1wiLCBcIm1pYVwiLCBcIm1pZWlcIiwgXCJtaWVcIiwgXCJub2lcIiwgXCJub3N0cm9cIiwgXCJub3N0cmlcIiwgXCJub3N0cmFcIiwgXCJub3N0cmVcIl0sXG4gICAgXCJwcm9tcHRcIjogXCJTdWxsYSBiYXNlIGRlZ2xpIGFwcHVudGlcIixcbiAgICBcImluaXRpYWxfbWVzc2FnZVwiOiBcIkNpYW8sIHNvbm8gQ2hhdEdQVCBlIGhvIGFjY2Vzc28gYWkgdHVvaSBhcHB1bnRpIHRyYW1pdGUgU21hcnQgQ29ubmVjdGlvbnMuIEZhdGVtaSB1bmEgZG9tYW5kYSBzdWkgdm9zdHJpIGFwcHVudGkgZSBjZXJjaGVyXHUwMEYyIGRpIHJpc3BvbmRlcnZpLlwiLFxuICB9LFxufVxuXG4vLyByZXF1aXJlIGJ1aWx0LWluIGNyeXB0byBtb2R1bGVcbmNvbnN0IGNyeXB0byA9IHJlcXVpcmUoXCJjcnlwdG9cIik7XG4vLyBtZDUgaGFzaCB1c2luZyBidWlsdCBpbiBjcnlwdG8gbW9kdWxlXG5mdW5jdGlvbiBtZDUoc3RyKSB7XG4gIHJldHVybiBjcnlwdG8uY3JlYXRlSGFzaChcIm1kNVwiKS51cGRhdGUoc3RyKS5kaWdlc3QoXCJoZXhcIik7XG59XG5cbmNsYXNzIFNtYXJ0Q29ubmVjdGlvbnNQbHVnaW4gZXh0ZW5kcyBPYnNpZGlhbi5QbHVnaW4ge1xuICAvLyBjb25zdHJ1Y3RvclxuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlciguLi5hcmd1bWVudHMpO1xuICAgIHRoaXMuYXBpID0gbnVsbDtcbiAgICB0aGlzLmVtYmVkZGluZ3NfbG9hZGVkID0gZmFsc2U7XG4gICAgdGhpcy5maWxlX2V4Y2x1c2lvbnMgPSBbXTtcbiAgICB0aGlzLmZvbGRlcnMgPSBbXTtcbiAgICB0aGlzLmhhc19uZXdfZW1iZWRkaW5ncyA9IGZhbHNlO1xuICAgIHRoaXMuaGVhZGVyX2V4Y2x1c2lvbnMgPSBbXTtcbiAgICB0aGlzLm5lYXJlc3RfY2FjaGUgPSB7fTtcbiAgICB0aGlzLnBhdGhfb25seSA9IFtdO1xuICAgIHRoaXMucmVuZGVyX2xvZyA9IHt9O1xuICAgIHRoaXMucmVuZGVyX2xvZy5kZWxldGVkX2VtYmVkZGluZ3MgPSAwO1xuICAgIHRoaXMucmVuZGVyX2xvZy5leGNsdXNpb25zX2xvZ3MgPSB7fTtcbiAgICB0aGlzLnJlbmRlcl9sb2cuZmFpbGVkX2VtYmVkZGluZ3MgPSBbXTtcbiAgICB0aGlzLnJlbmRlcl9sb2cuZmlsZXMgPSBbXTtcbiAgICB0aGlzLnJlbmRlcl9sb2cubmV3X2VtYmVkZGluZ3MgPSAwO1xuICAgIHRoaXMucmVuZGVyX2xvZy5za2lwcGVkX2xvd19kZWx0YSA9IHt9O1xuICAgIHRoaXMucmVuZGVyX2xvZy50b2tlbl91c2FnZSA9IDA7XG4gICAgdGhpcy5yZW5kZXJfbG9nLnRva2Vuc19zYXZlZF9ieV9jYWNoZSA9IDA7XG4gICAgdGhpcy5yZXRyeV9ub3RpY2VfdGltZW91dCA9IG51bGw7XG4gICAgdGhpcy5zYXZlX3RpbWVvdXQgPSBudWxsO1xuICAgIHRoaXMuc2NfYnJhbmRpbmcgPSB7fTtcbiAgICB0aGlzLnNlbGZfcmVmX2t3X3JlZ2V4ID0gbnVsbDtcbiAgICB0aGlzLnVwZGF0ZV9hdmFpbGFibGUgPSBmYWxzZTtcbiAgfVxuXG4gIGFzeW5jIG9ubG9hZCgpIHtcbiAgICAvLyBpbml0aWFsaXplIHdoZW4gbGF5b3V0IGlzIHJlYWR5XG4gICAgdGhpcy5hcHAud29ya3NwYWNlLm9uTGF5b3V0UmVhZHkodGhpcy5pbml0aWFsaXplLmJpbmQodGhpcykpO1xuICB9XG4gIG9udW5sb2FkKCkge1xuICAgIHRoaXMub3V0cHV0X3JlbmRlcl9sb2coKTtcbiAgICBjb25zb2xlLmxvZyhcInVubG9hZGluZyBwbHVnaW5cIik7XG4gICAgdGhpcy5hcHAud29ya3NwYWNlLmRldGFjaExlYXZlc09mVHlwZShTTUFSVF9DT05ORUNUSU9OU19WSUVXX1RZUEUpO1xuICAgIHRoaXMuYXBwLndvcmtzcGFjZS5kZXRhY2hMZWF2ZXNPZlR5cGUoU01BUlRfQ09OTkVDVElPTlNfQ0hBVF9WSUVXX1RZUEUpO1xuICB9XG4gIGFzeW5jIGluaXRpYWxpemUoKSB7XG4gICAgY29uc29sZS5sb2coXCJMb2FkaW5nIFNtYXJ0IENvbm5lY3Rpb25zIHBsdWdpblwiKTtcbiAgICBWRVJTSU9OID0gdGhpcy5tYW5pZmVzdC52ZXJzaW9uO1xuICAgIC8vIFZFUlNJT04gPSAnMS4wLjAnO1xuICAgIC8vIGNvbnNvbGUubG9nKFZFUlNJT04pO1xuICAgIGF3YWl0IHRoaXMubG9hZFNldHRpbmdzKCk7XG4gICAgLy8gcnVuIGFmdGVyIDMgc2Vjb25kc1xuICAgIHNldFRpbWVvdXQodGhpcy5jaGVja19mb3JfdXBkYXRlLmJpbmQodGhpcyksIDMwMDApO1xuICAgIC8vIHJ1biBjaGVjayBmb3IgdXBkYXRlIGV2ZXJ5IDMgaG91cnNcbiAgICBzZXRJbnRlcnZhbCh0aGlzLmNoZWNrX2Zvcl91cGRhdGUuYmluZCh0aGlzKSwgMTA4MDAwMDApO1xuXG4gICAgdGhpcy5hZGRJY29uKCk7XG4gICAgdGhpcy5hZGRDb21tYW5kKHtcbiAgICAgIGlkOiBcInNjLWZpbmQtbm90ZXNcIixcbiAgICAgIG5hbWU6IFwiRmluZDogTWFrZSBTbWFydCBDb25uZWN0aW9uc1wiLFxuICAgICAgaWNvbjogXCJwZW5jaWxfaWNvblwiLFxuICAgICAgaG90a2V5czogW10sXG4gICAgICAvLyBlZGl0b3JDYWxsYmFjazogYXN5bmMgKGVkaXRvcikgPT4ge1xuICAgICAgZWRpdG9yQ2FsbGJhY2s6IGFzeW5jIChlZGl0b3IpID0+IHtcbiAgICAgICAgaWYoZWRpdG9yLnNvbWV0aGluZ1NlbGVjdGVkKCkpIHtcbiAgICAgICAgICAvLyBnZXQgc2VsZWN0ZWQgdGV4dFxuICAgICAgICAgIGxldCBzZWxlY3RlZF90ZXh0ID0gZWRpdG9yLmdldFNlbGVjdGlvbigpO1xuICAgICAgICAgIC8vIHJlbmRlciBjb25uZWN0aW9ucyBmcm9tIHNlbGVjdGVkIHRleHRcbiAgICAgICAgICBhd2FpdCB0aGlzLm1ha2VfY29ubmVjdGlvbnMoc2VsZWN0ZWRfdGV4dCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy8gY2xlYXIgbmVhcmVzdF9jYWNoZSBvbiBtYW51YWwgY2FsbCB0byBtYWtlIGNvbm5lY3Rpb25zXG4gICAgICAgICAgdGhpcy5uZWFyZXN0X2NhY2hlID0ge307XG4gICAgICAgICAgLy8gY29uc29sZS5sb2coXCJDbGVhcmVkIG5lYXJlc3RfY2FjaGVcIik7XG4gICAgICAgICAgYXdhaXQgdGhpcy5tYWtlX2Nvbm5lY3Rpb25zKCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KTtcbiAgICB0aGlzLmFkZENvbW1hbmQoe1xuICAgICAgaWQ6IFwic21hcnQtY29ubmVjdGlvbnMtdmlld1wiLFxuICAgICAgbmFtZTogXCJPcGVuOiBWaWV3IFNtYXJ0IENvbm5lY3Rpb25zXCIsXG4gICAgICBjYWxsYmFjazogKCkgPT4ge1xuICAgICAgICB0aGlzLm9wZW5fdmlldygpO1xuICAgICAgfVxuICAgIH0pO1xuICAgIC8vIG9wZW4gY2hhdCBjb21tYW5kXG4gICAgdGhpcy5hZGRDb21tYW5kKHtcbiAgICAgIGlkOiBcInNtYXJ0LWNvbm5lY3Rpb25zLWNoYXRcIixcbiAgICAgIG5hbWU6IFwiT3BlbjogU21hcnQgQ2hhdCBDb252ZXJzYXRpb25cIixcbiAgICAgIGNhbGxiYWNrOiAoKSA9PiB7XG4gICAgICAgIHRoaXMub3Blbl9jaGF0KCk7XG4gICAgICB9XG4gICAgfSk7XG4gICAgLy8gb3BlbiByYW5kb20gbm90ZSBmcm9tIG5lYXJlc3QgY2FjaGVcbiAgICB0aGlzLmFkZENvbW1hbmQoe1xuICAgICAgaWQ6IFwic21hcnQtY29ubmVjdGlvbnMtcmFuZG9tXCIsXG4gICAgICBuYW1lOiBcIk9wZW46IFJhbmRvbSBOb3RlIGZyb20gU21hcnQgQ29ubmVjdGlvbnNcIixcbiAgICAgIGNhbGxiYWNrOiAoKSA9PiB7XG4gICAgICAgIHRoaXMub3Blbl9yYW5kb21fbm90ZSgpO1xuICAgICAgfVxuICAgIH0pO1xuICAgIC8vIGFkZCBzZXR0aW5ncyB0YWJcbiAgICB0aGlzLmFkZFNldHRpbmdUYWIobmV3IFNtYXJ0Q29ubmVjdGlvbnNTZXR0aW5nc1RhYih0aGlzLmFwcCwgdGhpcykpO1xuICAgIC8vIHJlZ2lzdGVyIG1haW4gdmlldyB0eXBlXG4gICAgdGhpcy5yZWdpc3RlclZpZXcoU01BUlRfQ09OTkVDVElPTlNfVklFV19UWVBFLCAobGVhZikgPT4gKG5ldyBTbWFydENvbm5lY3Rpb25zVmlldyhsZWFmLCB0aGlzKSkpO1xuICAgIC8vIHJlZ2lzdGVyIGNoYXQgdmlldyB0eXBlXG4gICAgdGhpcy5yZWdpc3RlclZpZXcoU01BUlRfQ09OTkVDVElPTlNfQ0hBVF9WSUVXX1RZUEUsIChsZWFmKSA9PiAobmV3IFNtYXJ0Q29ubmVjdGlvbnNDaGF0VmlldyhsZWFmLCB0aGlzKSkpO1xuICAgIC8vIGNvZGUtYmxvY2sgcmVuZGVyZXJcbiAgICB0aGlzLnJlZ2lzdGVyTWFya2Rvd25Db2RlQmxvY2tQcm9jZXNzb3IoXCJzbWFydC1jb25uZWN0aW9uc1wiLCB0aGlzLnJlbmRlcl9jb2RlX2Jsb2NrLmJpbmQodGhpcykpO1xuXG4gICAgLy8gaWYgdGhpcyBzZXR0aW5ncy52aWV3X29wZW4gaXMgdHJ1ZSwgb3BlbiB2aWV3IG9uIHN0YXJ0dXBcbiAgICBpZih0aGlzLnNldHRpbmdzLnZpZXdfb3Blbikge1xuICAgICAgdGhpcy5vcGVuX3ZpZXcoKTtcbiAgICB9XG4gICAgLy8gaWYgdGhpcyBzZXR0aW5ncy5jaGF0X29wZW4gaXMgdHJ1ZSwgb3BlbiBjaGF0IG9uIHN0YXJ0dXBcbiAgICBpZih0aGlzLnNldHRpbmdzLmNoYXRfb3Blbikge1xuICAgICAgdGhpcy5vcGVuX2NoYXQoKTtcbiAgICB9XG4gICAgLy8gb24gbmV3IHZlcnNpb25cbiAgICBpZih0aGlzLnNldHRpbmdzLnZlcnNpb24gIT09IFZFUlNJT04pIHtcbiAgICAgIC8vIHVwZGF0ZSB2ZXJzaW9uXG4gICAgICB0aGlzLnNldHRpbmdzLnZlcnNpb24gPSBWRVJTSU9OO1xuICAgICAgLy8gc2F2ZSBzZXR0aW5nc1xuICAgICAgYXdhaXQgdGhpcy5zYXZlU2V0dGluZ3MoKTtcbiAgICAgIC8vIG9wZW4gdmlld1xuICAgICAgdGhpcy5vcGVuX3ZpZXcoKTtcbiAgICB9XG4gICAgLy8gY2hlY2sgZ2l0aHViIHJlbGVhc2UgZW5kcG9pbnQgaWYgdXBkYXRlIGlzIGF2YWlsYWJsZVxuICAgIHRoaXMuYWRkX3RvX2dpdGlnbm9yZSgpO1xuICAgIC8qKlxuICAgICAqIEVYUEVSSU1FTlRBTFxuICAgICAqIC0gd2luZG93LWJhc2VkIEFQSSBhY2Nlc3NcbiAgICAgKiAtIGNvZGUtYmxvY2sgcmVuZGVyaW5nXG4gICAgICovXG4gICAgdGhpcy5hcGkgPSBuZXcgU2NTZWFyY2hBcGkodGhpcy5hcHAsIHRoaXMpO1xuICAgIC8vIHJlZ2lzdGVyIEFQSSB0byBnbG9iYWwgd2luZG93IG9iamVjdFxuICAgICh3aW5kb3dbXCJTbWFydFNlYXJjaEFwaVwiXSA9IHRoaXMuYXBpKSAmJiB0aGlzLnJlZ2lzdGVyKCgpID0+IGRlbGV0ZSB3aW5kb3dbXCJTbWFydFNlYXJjaEFwaVwiXSk7XG5cbiAgfVxuXG4gIGFzeW5jIGluaXRfdmVjcygpIHtcbiAgICB0aGlzLnNtYXJ0X3ZlY19saXRlID0gbmV3IFZlY0xpdGUoe1xuICAgICAgZm9sZGVyX3BhdGg6IFwiLnNtYXJ0LWNvbm5lY3Rpb25zXCIsXG4gICAgICBleGlzdHNfYWRhcHRlcjogdGhpcy5hcHAudmF1bHQuYWRhcHRlci5leGlzdHMuYmluZCh0aGlzLmFwcC52YXVsdC5hZGFwdGVyKSxcbiAgICAgIG1rZGlyX2FkYXB0ZXI6IHRoaXMuYXBwLnZhdWx0LmFkYXB0ZXIubWtkaXIuYmluZCh0aGlzLmFwcC52YXVsdC5hZGFwdGVyKSxcbiAgICAgIHJlYWRfYWRhcHRlcjogdGhpcy5hcHAudmF1bHQuYWRhcHRlci5yZWFkLmJpbmQodGhpcy5hcHAudmF1bHQuYWRhcHRlciksXG4gICAgICByZW5hbWVfYWRhcHRlcjogdGhpcy5hcHAudmF1bHQuYWRhcHRlci5yZW5hbWUuYmluZCh0aGlzLmFwcC52YXVsdC5hZGFwdGVyKSxcbiAgICAgIHN0YXRfYWRhcHRlcjogdGhpcy5hcHAudmF1bHQuYWRhcHRlci5zdGF0LmJpbmQodGhpcy5hcHAudmF1bHQuYWRhcHRlciksXG4gICAgICB3cml0ZV9hZGFwdGVyOiB0aGlzLmFwcC52YXVsdC5hZGFwdGVyLndyaXRlLmJpbmQodGhpcy5hcHAudmF1bHQuYWRhcHRlciksXG4gICAgfSk7XG4gICAgdGhpcy5lbWJlZGRpbmdzX2xvYWRlZCA9IGF3YWl0IHRoaXMuc21hcnRfdmVjX2xpdGUubG9hZCgpO1xuICAgIHJldHVybiB0aGlzLmVtYmVkZGluZ3NfbG9hZGVkO1xuICB9XG5cbiAgYXN5bmMgbG9hZFNldHRpbmdzKCkge1xuICAgIHRoaXMuc2V0dGluZ3MgPSBPYmplY3QuYXNzaWduKHt9LCBERUZBVUxUX1NFVFRJTkdTLCBhd2FpdCB0aGlzLmxvYWREYXRhKCkpO1xuICAgIC8vIGxvYWQgZmlsZSBleGNsdXNpb25zIGlmIG5vdCBibGFua1xuICAgIGlmKHRoaXMuc2V0dGluZ3MuZmlsZV9leGNsdXNpb25zICYmIHRoaXMuc2V0dGluZ3MuZmlsZV9leGNsdXNpb25zLmxlbmd0aCA+IDApIHtcbiAgICAgIC8vIHNwbGl0IGZpbGUgZXhjbHVzaW9ucyBpbnRvIGFycmF5IGFuZCB0cmltIHdoaXRlc3BhY2VcbiAgICAgIHRoaXMuZmlsZV9leGNsdXNpb25zID0gdGhpcy5zZXR0aW5ncy5maWxlX2V4Y2x1c2lvbnMuc3BsaXQoXCIsXCIpLm1hcCgoZmlsZSkgPT4ge1xuICAgICAgICByZXR1cm4gZmlsZS50cmltKCk7XG4gICAgICB9KTtcbiAgICB9XG4gICAgLy8gbG9hZCBmb2xkZXIgZXhjbHVzaW9ucyBpZiBub3QgYmxhbmtcbiAgICBpZih0aGlzLnNldHRpbmdzLmZvbGRlcl9leGNsdXNpb25zICYmIHRoaXMuc2V0dGluZ3MuZm9sZGVyX2V4Y2x1c2lvbnMubGVuZ3RoID4gMCkge1xuICAgICAgLy8gYWRkIHNsYXNoIHRvIGVuZCBvZiBmb2xkZXIgbmFtZSBpZiBub3QgcHJlc2VudFxuICAgICAgY29uc3QgZm9sZGVyX2V4Y2x1c2lvbnMgPSB0aGlzLnNldHRpbmdzLmZvbGRlcl9leGNsdXNpb25zLnNwbGl0KFwiLFwiKS5tYXAoKGZvbGRlcikgPT4ge1xuICAgICAgICAvLyB0cmltIHdoaXRlc3BhY2VcbiAgICAgICAgZm9sZGVyID0gZm9sZGVyLnRyaW0oKTtcbiAgICAgICAgaWYoZm9sZGVyLnNsaWNlKC0xKSAhPT0gXCIvXCIpIHtcbiAgICAgICAgICByZXR1cm4gZm9sZGVyICsgXCIvXCI7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmV0dXJuIGZvbGRlcjtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgICAvLyBtZXJnZSBmb2xkZXIgZXhjbHVzaW9ucyB3aXRoIGZpbGUgZXhjbHVzaW9uc1xuICAgICAgdGhpcy5maWxlX2V4Y2x1c2lvbnMgPSB0aGlzLmZpbGVfZXhjbHVzaW9ucy5jb25jYXQoZm9sZGVyX2V4Y2x1c2lvbnMpO1xuICAgIH1cbiAgICAvLyBsb2FkIGhlYWRlciBleGNsdXNpb25zIGlmIG5vdCBibGFua1xuICAgIGlmKHRoaXMuc2V0dGluZ3MuaGVhZGVyX2V4Y2x1c2lvbnMgJiYgdGhpcy5zZXR0aW5ncy5oZWFkZXJfZXhjbHVzaW9ucy5sZW5ndGggPiAwKSB7XG4gICAgICB0aGlzLmhlYWRlcl9leGNsdXNpb25zID0gdGhpcy5zZXR0aW5ncy5oZWFkZXJfZXhjbHVzaW9ucy5zcGxpdChcIixcIikubWFwKChoZWFkZXIpID0+IHtcbiAgICAgICAgcmV0dXJuIGhlYWRlci50cmltKCk7XG4gICAgICB9KTtcbiAgICB9XG4gICAgLy8gbG9hZCBwYXRoX29ubHkgaWYgbm90IGJsYW5rXG4gICAgaWYodGhpcy5zZXR0aW5ncy5wYXRoX29ubHkgJiYgdGhpcy5zZXR0aW5ncy5wYXRoX29ubHkubGVuZ3RoID4gMCkge1xuICAgICAgdGhpcy5wYXRoX29ubHkgPSB0aGlzLnNldHRpbmdzLnBhdGhfb25seS5zcGxpdChcIixcIikubWFwKChwYXRoKSA9PiB7XG4gICAgICAgIHJldHVybiBwYXRoLnRyaW0oKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgICAvLyBsb2FkIHNlbGZfcmVmX2t3X3JlZ2V4XG4gICAgdGhpcy5zZWxmX3JlZl9rd19yZWdleCA9IG5ldyBSZWdFeHAoYFxcXFxiKCR7U01BUlRfVFJBTlNMQVRJT05bdGhpcy5zZXR0aW5ncy5sYW5ndWFnZV0ucHJvbm91cy5qb2luKFwifFwiKX0pXFxcXGJgLCBcImdpXCIpO1xuICAgIC8vIGxvYWQgZmFpbGVkIGZpbGVzXG4gICAgYXdhaXQgdGhpcy5sb2FkX2ZhaWxlZF9maWxlcygpO1xuICB9XG4gIGFzeW5jIHNhdmVTZXR0aW5ncyhyZXJlbmRlcj1mYWxzZSkge1xuICAgIGF3YWl0IHRoaXMuc2F2ZURhdGEodGhpcy5zZXR0aW5ncyk7XG4gICAgLy8gcmUtbG9hZCBzZXR0aW5ncyBpbnRvIG1lbW9yeVxuICAgIGF3YWl0IHRoaXMubG9hZFNldHRpbmdzKCk7XG4gICAgLy8gcmUtcmVuZGVyIHZpZXcgaWYgc2V0IHRvIHRydWUgKGZvciBleGFtcGxlLCBhZnRlciBhZGRpbmcgQVBJIGtleSlcbiAgICBpZihyZXJlbmRlcikge1xuICAgICAgdGhpcy5uZWFyZXN0X2NhY2hlID0ge307XG4gICAgICBhd2FpdCB0aGlzLm1ha2VfY29ubmVjdGlvbnMoKTtcbiAgICB9XG4gIH1cblxuICAvLyBjaGVjayBmb3IgdXBkYXRlXG4gIGFzeW5jIGNoZWNrX2Zvcl91cGRhdGUoKSB7XG4gICAgLy8gZmFpbCBzaWxlbnRseSwgZXguIGlmIG5vIGludGVybmV0IGNvbm5lY3Rpb25cbiAgICB0cnkge1xuICAgICAgLy8gZ2V0IGxhdGVzdCByZWxlYXNlIHZlcnNpb24gZnJvbSBnaXRodWJcbiAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgKDAsIE9ic2lkaWFuLnJlcXVlc3RVcmwpKHtcbiAgICAgICAgdXJsOiBcImh0dHBzOi8vYXBpLmdpdGh1Yi5jb20vcmVwb3MvYnJpYW5wZXRyby9vYnNpZGlhbi1zbWFydC1jb25uZWN0aW9ucy9yZWxlYXNlcy9sYXRlc3RcIixcbiAgICAgICAgbWV0aG9kOiBcIkdFVFwiLFxuICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgXCJDb250ZW50LVR5cGVcIjogXCJhcHBsaWNhdGlvbi9qc29uXCIsXG4gICAgICAgIH0sXG4gICAgICAgIGNvbnRlbnRUeXBlOiBcImFwcGxpY2F0aW9uL2pzb25cIixcbiAgICAgIH0pO1xuICAgICAgLy8gZ2V0IHZlcnNpb24gbnVtYmVyIGZyb20gcmVzcG9uc2VcbiAgICAgIGNvbnN0IGxhdGVzdF9yZWxlYXNlID0gSlNPTi5wYXJzZShyZXNwb25zZS50ZXh0KS50YWdfbmFtZTtcbiAgICAgIC8vIGNvbnNvbGUubG9nKGBMYXRlc3QgcmVsZWFzZTogJHtsYXRlc3RfcmVsZWFzZX1gKTtcbiAgICAgIC8vIGlmIGxhdGVzdF9yZWxlYXNlIGlzIG5ld2VyIHRoYW4gY3VycmVudCB2ZXJzaW9uLCBzaG93IG1lc3NhZ2VcbiAgICAgIGlmKGxhdGVzdF9yZWxlYXNlICE9PSBWRVJTSU9OKSB7XG4gICAgICAgIG5ldyBPYnNpZGlhbi5Ob3RpY2UoYFtTbWFydCBDb25uZWN0aW9uc10gQSBuZXcgdmVyc2lvbiBpcyBhdmFpbGFibGUhICh2JHtsYXRlc3RfcmVsZWFzZX0pYCk7XG4gICAgICAgIHRoaXMudXBkYXRlX2F2YWlsYWJsZSA9IHRydWU7XG4gICAgICAgIHRoaXMucmVuZGVyX2JyYW5kKFwiYWxsXCIpXG4gICAgICB9XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUubG9nKGVycm9yKTtcbiAgICB9XG4gIH1cblxuICBhc3luYyByZW5kZXJfY29kZV9ibG9jayhjb250ZW50cywgY29udGFpbmVyLCBjdHgpIHtcbiAgICBsZXQgbmVhcmVzdDtcbiAgICBpZihjb250ZW50cy50cmltKCkubGVuZ3RoID4gMCkge1xuICAgICAgbmVhcmVzdCA9IGF3YWl0IHRoaXMuYXBpLnNlYXJjaChjb250ZW50cyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIHVzZSBjdHggdG8gZ2V0IGZpbGVcbiAgICAgIGNvbnNvbGUubG9nKGN0eCk7XG4gICAgICBjb25zdCBmaWxlID0gdGhpcy5hcHAudmF1bHQuZ2V0QWJzdHJhY3RGaWxlQnlQYXRoKGN0eC5zb3VyY2VQYXRoKTtcbiAgICAgIG5lYXJlc3QgPSBhd2FpdCB0aGlzLmZpbmRfbm90ZV9jb25uZWN0aW9ucyhmaWxlKTtcbiAgICB9XG4gICAgaWYgKG5lYXJlc3QubGVuZ3RoKSB7XG4gICAgICB0aGlzLnVwZGF0ZV9yZXN1bHRzKGNvbnRhaW5lciwgbmVhcmVzdCk7XG4gICAgfVxuICB9XG5cbiAgYXN5bmMgbWFrZV9jb25uZWN0aW9ucyhzZWxlY3RlZF90ZXh0PW51bGwpIHtcbiAgICBsZXQgdmlldyA9IHRoaXMuZ2V0X3ZpZXcoKTtcbiAgICBpZiAoIXZpZXcpIHtcbiAgICAgIC8vIG9wZW4gdmlldyBpZiBub3Qgb3BlblxuICAgICAgYXdhaXQgdGhpcy5vcGVuX3ZpZXcoKTtcbiAgICAgIHZpZXcgPSB0aGlzLmdldF92aWV3KCk7XG4gICAgfVxuICAgIGF3YWl0IHZpZXcucmVuZGVyX2Nvbm5lY3Rpb25zKHNlbGVjdGVkX3RleHQpO1xuICB9XG5cbiAgYWRkSWNvbigpe1xuICAgIE9ic2lkaWFuLmFkZEljb24oXCJzbWFydC1jb25uZWN0aW9uc1wiLCBgPHBhdGggZD1cIk01MCwyMCBMODAsNDAgTDgwLDYwIEw1MCwxMDBcIiBzdHJva2U9XCJjdXJyZW50Q29sb3JcIiBzdHJva2Utd2lkdGg9XCI0XCIgZmlsbD1cIm5vbmVcIi8+XG4gICAgPHBhdGggZD1cIk0zMCw1MCBMNTUsNzBcIiBzdHJva2U9XCJjdXJyZW50Q29sb3JcIiBzdHJva2Utd2lkdGg9XCI1XCIgZmlsbD1cIm5vbmVcIi8+XG4gICAgPGNpcmNsZSBjeD1cIjUwXCIgY3k9XCIyMFwiIHI9XCI5XCIgZmlsbD1cImN1cnJlbnRDb2xvclwiLz5cbiAgICA8Y2lyY2xlIGN4PVwiODBcIiBjeT1cIjQwXCIgcj1cIjlcIiBmaWxsPVwiY3VycmVudENvbG9yXCIvPlxuICAgIDxjaXJjbGUgY3g9XCI4MFwiIGN5PVwiNzBcIiByPVwiOVwiIGZpbGw9XCJjdXJyZW50Q29sb3JcIi8+XG4gICAgPGNpcmNsZSBjeD1cIjUwXCIgY3k9XCIxMDBcIiByPVwiOVwiIGZpbGw9XCJjdXJyZW50Q29sb3JcIi8+XG4gICAgPGNpcmNsZSBjeD1cIjMwXCIgY3k9XCI1MFwiIHI9XCI5XCIgZmlsbD1cImN1cnJlbnRDb2xvclwiLz5gKTtcbiAgfVxuXG4gIC8vIG9wZW4gcmFuZG9tIG5vdGVcbiAgYXN5bmMgb3Blbl9yYW5kb21fbm90ZSgpIHtcbiAgICBjb25zdCBjdXJyX2ZpbGUgPSB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0QWN0aXZlRmlsZSgpO1xuICAgIGNvbnN0IGN1cnJfa2V5ID0gbWQ1KGN1cnJfZmlsZS5wYXRoKTtcbiAgICAvLyBpZiBubyBuZWFyZXN0IGNhY2hlLCBjcmVhdGUgT2JzaWRpYW4gbm90aWNlXG4gICAgaWYodHlwZW9mIHRoaXMubmVhcmVzdF9jYWNoZVtjdXJyX2tleV0gPT09IFwidW5kZWZpbmVkXCIpIHtcbiAgICAgIG5ldyBPYnNpZGlhbi5Ob3RpY2UoXCJbU21hcnQgQ29ubmVjdGlvbnNdIE5vIFNtYXJ0IENvbm5lY3Rpb25zIGZvdW5kLiBPcGVuIGEgbm90ZSB0byBnZXQgU21hcnQgQ29ubmVjdGlvbnMuXCIpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICAvLyBnZXQgcmFuZG9tIGZyb20gbmVhcmVzdCBjYWNoZVxuICAgIGNvbnN0IHJhbmQgPSBNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiB0aGlzLm5lYXJlc3RfY2FjaGVbY3Vycl9rZXldLmxlbmd0aC8yKTsgLy8gZGl2aWRlIGJ5IDIgdG8gbGltaXQgdG8gdG9wIGhhbGYgb2YgcmVzdWx0c1xuICAgIGNvbnN0IHJhbmRvbV9maWxlID0gdGhpcy5uZWFyZXN0X2NhY2hlW2N1cnJfa2V5XVtyYW5kXTtcbiAgICAvLyBvcGVuIHJhbmRvbSBmaWxlXG4gICAgdGhpcy5vcGVuX25vdGUocmFuZG9tX2ZpbGUpO1xuICB9XG5cbiAgYXN5bmMgb3Blbl92aWV3KCkge1xuICAgIGlmKHRoaXMuZ2V0X3ZpZXcoKSl7XG4gICAgICBjb25zb2xlLmxvZyhcIlNtYXJ0IENvbm5lY3Rpb25zIHZpZXcgYWxyZWFkeSBvcGVuXCIpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB0aGlzLmFwcC53b3Jrc3BhY2UuZGV0YWNoTGVhdmVzT2ZUeXBlKFNNQVJUX0NPTk5FQ1RJT05TX1ZJRVdfVFlQRSk7XG4gICAgYXdhaXQgdGhpcy5hcHAud29ya3NwYWNlLmdldFJpZ2h0TGVhZihmYWxzZSkuc2V0Vmlld1N0YXRlKHtcbiAgICAgIHR5cGU6IFNNQVJUX0NPTk5FQ1RJT05TX1ZJRVdfVFlQRSxcbiAgICAgIGFjdGl2ZTogdHJ1ZSxcbiAgICB9KTtcbiAgICB0aGlzLmFwcC53b3Jrc3BhY2UucmV2ZWFsTGVhZihcbiAgICAgIHRoaXMuYXBwLndvcmtzcGFjZS5nZXRMZWF2ZXNPZlR5cGUoU01BUlRfQ09OTkVDVElPTlNfVklFV19UWVBFKVswXVxuICAgICk7XG4gIH1cbiAgLy8gc291cmNlOiBodHRwczovL2dpdGh1Yi5jb20vb2JzaWRpYW5tZC9vYnNpZGlhbi1yZWxlYXNlcy9ibG9iL21hc3Rlci9wbHVnaW4tcmV2aWV3Lm1kI2F2b2lkLW1hbmFnaW5nLXJlZmVyZW5jZXMtdG8tY3VzdG9tLXZpZXdzXG4gIGdldF92aWV3KCkge1xuICAgIGZvciAobGV0IGxlYWYgb2YgdGhpcy5hcHAud29ya3NwYWNlLmdldExlYXZlc09mVHlwZShTTUFSVF9DT05ORUNUSU9OU19WSUVXX1RZUEUpKSB7XG4gICAgICBpZiAobGVhZi52aWV3IGluc3RhbmNlb2YgU21hcnRDb25uZWN0aW9uc1ZpZXcpIHtcbiAgICAgICAgcmV0dXJuIGxlYWYudmlldztcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgLy8gb3BlbiBjaGF0IHZpZXdcbiAgYXN5bmMgb3Blbl9jaGF0KHJldHJpZXM9MCkge1xuICAgIGlmKCF0aGlzLmVtYmVkZGluZ3NfbG9hZGVkKSB7XG4gICAgICBjb25zb2xlLmxvZyhcImVtYmVkZGluZ3Mgbm90IGxvYWRlZCB5ZXRcIik7XG4gICAgICBpZihyZXRyaWVzIDwgMykge1xuICAgICAgICAvLyB3YWl0IGFuZCB0cnkgYWdhaW5cbiAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgICAgdGhpcy5vcGVuX2NoYXQocmV0cmllcysxKTtcbiAgICAgICAgfSwgMTAwMCAqIChyZXRyaWVzKzEpKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgY29uc29sZS5sb2coXCJlbWJlZGRpbmdzIHN0aWxsIG5vdCBsb2FkZWQsIG9wZW5pbmcgc21hcnQgdmlld1wiKTtcbiAgICAgIHRoaXMub3Blbl92aWV3KCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIHRoaXMuYXBwLndvcmtzcGFjZS5kZXRhY2hMZWF2ZXNPZlR5cGUoU01BUlRfQ09OTkVDVElPTlNfQ0hBVF9WSUVXX1RZUEUpO1xuICAgIGF3YWl0IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRSaWdodExlYWYoZmFsc2UpLnNldFZpZXdTdGF0ZSh7XG4gICAgICB0eXBlOiBTTUFSVF9DT05ORUNUSU9OU19DSEFUX1ZJRVdfVFlQRSxcbiAgICAgIGFjdGl2ZTogdHJ1ZSxcbiAgICB9KTtcbiAgICB0aGlzLmFwcC53b3Jrc3BhY2UucmV2ZWFsTGVhZihcbiAgICAgIHRoaXMuYXBwLndvcmtzcGFjZS5nZXRMZWF2ZXNPZlR5cGUoU01BUlRfQ09OTkVDVElPTlNfQ0hBVF9WSUVXX1RZUEUpWzBdXG4gICAgKTtcbiAgfVxuICBcbiAgLy8gZ2V0IGVtYmVkZGluZ3MgZm9yIGFsbCBmaWxlc1xuICBhc3luYyBnZXRfYWxsX2VtYmVkZGluZ3MoKSB7XG4gICAgLy8gZ2V0IGFsbCBmaWxlcyBpbiB2YXVsdCBhbmQgZmlsdGVyIGFsbCBidXQgbWFya2Rvd24gYW5kIGNhbnZhcyBmaWxlc1xuICAgIGNvbnN0IGZpbGVzID0gKGF3YWl0IHRoaXMuYXBwLnZhdWx0LmdldEZpbGVzKCkpLmZpbHRlcigoZmlsZSkgPT4gZmlsZSBpbnN0YW5jZW9mIE9ic2lkaWFuLlRGaWxlICYmIChmaWxlLmV4dGVuc2lvbiA9PT0gXCJtZFwiIHx8IGZpbGUuZXh0ZW5zaW9uID09PSBcImNhbnZhc1wiKSk7XG4gICAgLy8gY29uc3QgZmlsZXMgPSBhd2FpdCB0aGlzLmFwcC52YXVsdC5nZXRNYXJrZG93bkZpbGVzKCk7XG4gICAgLy8gZ2V0IG9wZW4gZmlsZXMgdG8gc2tpcCBpZiBmaWxlIGlzIGN1cnJlbnRseSBvcGVuXG4gICAgY29uc3Qgb3Blbl9maWxlcyA9IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRMZWF2ZXNPZlR5cGUoXCJtYXJrZG93blwiKS5tYXAoKGxlYWYpID0+IGxlYWYudmlldy5maWxlKTtcbiAgICBjb25zdCBjbGVhbl91cF9sb2cgPSB0aGlzLnNtYXJ0X3ZlY19saXRlLmNsZWFuX3VwX2VtYmVkZGluZ3MoZmlsZXMpO1xuICAgIGlmKHRoaXMuc2V0dGluZ3MubG9nX3JlbmRlcil7XG4gICAgICB0aGlzLnJlbmRlcl9sb2cudG90YWxfZmlsZXMgPSBmaWxlcy5sZW5ndGg7XG4gICAgICB0aGlzLnJlbmRlcl9sb2cuZGVsZXRlZF9lbWJlZGRpbmdzID0gY2xlYW5fdXBfbG9nLmRlbGV0ZWRfZW1iZWRkaW5ncztcbiAgICAgIHRoaXMucmVuZGVyX2xvZy50b3RhbF9lbWJlZGRpbmdzID0gY2xlYW5fdXBfbG9nLnRvdGFsX2VtYmVkZGluZ3M7XG4gICAgfVxuICAgIC8vIGJhdGNoIGVtYmVkZGluZ3NcbiAgICBsZXQgYmF0Y2hfcHJvbWlzZXMgPSBbXTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGZpbGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAvLyBza2lwIGlmIHBhdGggY29udGFpbnMgYSAjXG4gICAgICBpZihmaWxlc1tpXS5wYXRoLmluZGV4T2YoXCIjXCIpID4gLTEpIHtcbiAgICAgICAgLy8gY29uc29sZS5sb2coXCJza2lwcGluZyBmaWxlICdcIitmaWxlc1tpXS5wYXRoK1wiJyAocGF0aCBjb250YWlucyAjKVwiKTtcbiAgICAgICAgdGhpcy5sb2dfZXhjbHVzaW9uKFwicGF0aCBjb250YWlucyAjXCIpO1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIC8vIHNraXAgaWYgZmlsZSBhbHJlYWR5IGhhcyBlbWJlZGRpbmcgYW5kIGVtYmVkZGluZy5tdGltZSBpcyBncmVhdGVyIHRoYW4gb3IgZXF1YWwgdG8gZmlsZS5tdGltZVxuICAgICAgaWYodGhpcy5zbWFydF92ZWNfbGl0ZS5tdGltZV9pc19jdXJyZW50KG1kNShmaWxlc1tpXS5wYXRoKSwgZmlsZXNbaV0uc3RhdC5tdGltZSkpIHtcbiAgICAgICAgLy8gbG9nIHNraXBwaW5nIGZpbGVcbiAgICAgICAgLy8gY29uc29sZS5sb2coXCJza2lwcGluZyBmaWxlIChtdGltZSlcIik7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgICAgLy8gY2hlY2sgaWYgZmlsZSBpcyBpbiBmYWlsZWRfZmlsZXNcbiAgICAgIGlmKHRoaXMuc2V0dGluZ3MuZmFpbGVkX2ZpbGVzLmluZGV4T2YoZmlsZXNbaV0ucGF0aCkgPiAtMSkge1xuICAgICAgICAvLyBsb2cgc2tpcHBpbmcgZmlsZVxuICAgICAgICAvLyBjb25zb2xlLmxvZyhcInNraXBwaW5nIHByZXZpb3VzbHkgZmFpbGVkIGZpbGUsIHVzZSBidXR0b24gaW4gc2V0dGluZ3MgdG8gcmV0cnlcIik7XG4gICAgICAgIC8vIHVzZSBzZXRUaW1lb3V0IHRvIHByZXZlbnQgbXVsdGlwbGUgbm90aWNlc1xuICAgICAgICBpZih0aGlzLnJldHJ5X25vdGljZV90aW1lb3V0KSB7XG4gICAgICAgICAgY2xlYXJUaW1lb3V0KHRoaXMucmV0cnlfbm90aWNlX3RpbWVvdXQpO1xuICAgICAgICAgIHRoaXMucmV0cnlfbm90aWNlX3RpbWVvdXQgPSBudWxsO1xuICAgICAgICB9XG4gICAgICAgIC8vIGxpbWl0IHRvIG9uZSBub3RpY2UgZXZlcnkgMTAgbWludXRlc1xuICAgICAgICBpZighdGhpcy5yZWNlbnRseV9zZW50X3JldHJ5X25vdGljZSl7XG4gICAgICAgICAgbmV3IE9ic2lkaWFuLk5vdGljZShcIlNtYXJ0IENvbm5lY3Rpb25zOiBTa2lwcGluZyBwcmV2aW91c2x5IGZhaWxlZCBmaWxlLCB1c2UgYnV0dG9uIGluIHNldHRpbmdzIHRvIHJldHJ5XCIpO1xuICAgICAgICAgIHRoaXMucmVjZW50bHlfc2VudF9yZXRyeV9ub3RpY2UgPSB0cnVlO1xuICAgICAgICAgIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5yZWNlbnRseV9zZW50X3JldHJ5X25vdGljZSA9IGZhbHNlOyAgXG4gICAgICAgICAgfSwgNjAwMDAwKTtcbiAgICAgICAgfVxuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIC8vIHNraXAgZmlsZXMgd2hlcmUgcGF0aCBjb250YWlucyBhbnkgZXhjbHVzaW9uc1xuICAgICAgbGV0IHNraXAgPSBmYWxzZTtcbiAgICAgIGZvcihsZXQgaiA9IDA7IGogPCB0aGlzLmZpbGVfZXhjbHVzaW9ucy5sZW5ndGg7IGorKykge1xuICAgICAgICBpZihmaWxlc1tpXS5wYXRoLmluZGV4T2YodGhpcy5maWxlX2V4Y2x1c2lvbnNbal0pID4gLTEpIHtcbiAgICAgICAgICBza2lwID0gdHJ1ZTtcbiAgICAgICAgICB0aGlzLmxvZ19leGNsdXNpb24odGhpcy5maWxlX2V4Y2x1c2lvbnNbal0pO1xuICAgICAgICAgIC8vIGJyZWFrIG91dCBvZiBsb29wXG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmKHNraXApIHtcbiAgICAgICAgY29udGludWU7IC8vIHRvIG5leHQgZmlsZVxuICAgICAgfVxuICAgICAgLy8gY2hlY2sgaWYgZmlsZSBpcyBvcGVuXG4gICAgICBpZihvcGVuX2ZpbGVzLmluZGV4T2YoZmlsZXNbaV0pID4gLTEpIHtcbiAgICAgICAgLy8gY29uc29sZS5sb2coXCJza2lwcGluZyBmaWxlIChvcGVuKVwiKTtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgICB0cnkge1xuICAgICAgICAvLyBwdXNoIHByb21pc2UgdG8gYmF0Y2hfcHJvbWlzZXNcbiAgICAgICAgYmF0Y2hfcHJvbWlzZXMucHVzaCh0aGlzLmdldF9maWxlX2VtYmVkZGluZ3MoZmlsZXNbaV0sIGZhbHNlKSk7XG4gICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBjb25zb2xlLmxvZyhlcnJvcik7XG4gICAgICB9XG4gICAgICAvLyBpZiBiYXRjaF9wcm9taXNlcyBsZW5ndGggaXMgMTBcbiAgICAgIGlmKGJhdGNoX3Byb21pc2VzLmxlbmd0aCA+IDMpIHtcbiAgICAgICAgLy8gd2FpdCBmb3IgYWxsIHByb21pc2VzIHRvIHJlc29sdmVcbiAgICAgICAgYXdhaXQgUHJvbWlzZS5hbGwoYmF0Y2hfcHJvbWlzZXMpO1xuICAgICAgICAvLyBjbGVhciBiYXRjaF9wcm9taXNlc1xuICAgICAgICBiYXRjaF9wcm9taXNlcyA9IFtdO1xuICAgICAgfVxuXG4gICAgICAvLyBzYXZlIGVtYmVkZGluZ3MgSlNPTiB0byBmaWxlIGV2ZXJ5IDEwMCBmaWxlcyB0byBzYXZlIHByb2dyZXNzIG9uIGJ1bGsgZW1iZWRkaW5nXG4gICAgICBpZihpID4gMCAmJiBpICUgMTAwID09PSAwKSB7XG4gICAgICAgIGF3YWl0IHRoaXMuc2F2ZV9lbWJlZGRpbmdzX3RvX2ZpbGUoKTtcbiAgICAgIH1cbiAgICB9XG4gICAgLy8gd2FpdCBmb3IgYWxsIHByb21pc2VzIHRvIHJlc29sdmVcbiAgICBhd2FpdCBQcm9taXNlLmFsbChiYXRjaF9wcm9taXNlcyk7XG4gICAgLy8gd3JpdGUgZW1iZWRkaW5ncyBKU09OIHRvIGZpbGVcbiAgICBhd2FpdCB0aGlzLnNhdmVfZW1iZWRkaW5nc190b19maWxlKCk7XG4gICAgLy8gaWYgcmVuZGVyX2xvZy5mYWlsZWRfZW1iZWRkaW5ncyB0aGVuIHVwZGF0ZSBmYWlsZWRfZW1iZWRkaW5ncy50eHRcbiAgICBpZih0aGlzLnJlbmRlcl9sb2cuZmFpbGVkX2VtYmVkZGluZ3MubGVuZ3RoID4gMCkge1xuICAgICAgYXdhaXQgdGhpcy5zYXZlX2ZhaWxlZF9lbWJlZGRpbmdzKCk7XG4gICAgfVxuICB9XG5cbiAgYXN5bmMgc2F2ZV9lbWJlZGRpbmdzX3RvX2ZpbGUoZm9yY2U9ZmFsc2UpIHtcbiAgICBpZighdGhpcy5oYXNfbmV3X2VtYmVkZGluZ3Mpe1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICAvLyBjb25zb2xlLmxvZyhcIm5ldyBlbWJlZGRpbmdzLCBzYXZpbmcgdG8gZmlsZVwiKTtcbiAgICBpZighZm9yY2UpIHtcbiAgICAgIC8vIHByZXZlbnQgZXhjZXNzaXZlIHdyaXRlcyB0byBlbWJlZGRpbmdzIGZpbGUgYnkgd2FpdGluZyAxIG1pbnV0ZSBiZWZvcmUgd3JpdGluZ1xuICAgICAgaWYodGhpcy5zYXZlX3RpbWVvdXQpIHtcbiAgICAgICAgY2xlYXJUaW1lb3V0KHRoaXMuc2F2ZV90aW1lb3V0KTtcbiAgICAgICAgdGhpcy5zYXZlX3RpbWVvdXQgPSBudWxsOyAgXG4gICAgICB9XG4gICAgICB0aGlzLnNhdmVfdGltZW91dCA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICAvLyBjb25zb2xlLmxvZyhcIndyaXRpbmcgZW1iZWRkaW5ncyB0byBmaWxlXCIpO1xuICAgICAgICB0aGlzLnNhdmVfZW1iZWRkaW5nc190b19maWxlKHRydWUpO1xuICAgICAgICAvLyBjbGVhciB0aW1lb3V0XG4gICAgICAgIGlmKHRoaXMuc2F2ZV90aW1lb3V0KSB7XG4gICAgICAgICAgY2xlYXJUaW1lb3V0KHRoaXMuc2F2ZV90aW1lb3V0KTtcbiAgICAgICAgICB0aGlzLnNhdmVfdGltZW91dCA9IG51bGw7XG4gICAgICAgIH1cbiAgICAgIH0sIDMwMDAwKTtcbiAgICAgIGNvbnNvbGUubG9nKFwic2NoZWR1bGVkIHNhdmVcIik7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdHJ5e1xuICAgICAgLy8gdXNlIHNtYXJ0X3ZlY19saXRlXG4gICAgICBhd2FpdCB0aGlzLnNtYXJ0X3ZlY19saXRlLnNhdmUoKTtcbiAgICAgIHRoaXMuaGFzX25ld19lbWJlZGRpbmdzID0gZmFsc2U7XG4gICAgfWNhdGNoKGVycm9yKXtcbiAgICAgIGNvbnNvbGUubG9nKGVycm9yKTtcbiAgICAgIG5ldyBPYnNpZGlhbi5Ob3RpY2UoXCJTbWFydCBDb25uZWN0aW9uczogXCIrZXJyb3IubWVzc2FnZSk7XG4gICAgfVxuXG4gIH1cbiAgLy8gc2F2ZSBmYWlsZWQgZW1iZWRkaW5ncyB0byBmaWxlIGZyb20gcmVuZGVyX2xvZy5mYWlsZWRfZW1iZWRkaW5nc1xuICBhc3luYyBzYXZlX2ZhaWxlZF9lbWJlZGRpbmdzICgpIHtcbiAgICAvLyB3cml0ZSBmYWlsZWRfZW1iZWRkaW5ncyB0byBmaWxlIG9uZSBsaW5lIHBlciBmYWlsZWQgZW1iZWRkaW5nXG4gICAgbGV0IGZhaWxlZF9lbWJlZGRpbmdzID0gW107XG4gICAgLy8gaWYgZmlsZSBhbHJlYWR5IGV4aXN0cyB0aGVuIHJlYWQgaXRcbiAgICBjb25zdCBmYWlsZWRfZW1iZWRkaW5nc19maWxlX2V4aXN0cyA9IGF3YWl0IHRoaXMuYXBwLnZhdWx0LmFkYXB0ZXIuZXhpc3RzKFwiLnNtYXJ0LWNvbm5lY3Rpb25zL2ZhaWxlZC1lbWJlZGRpbmdzLnR4dFwiKTtcbiAgICBpZihmYWlsZWRfZW1iZWRkaW5nc19maWxlX2V4aXN0cykge1xuICAgICAgZmFpbGVkX2VtYmVkZGluZ3MgPSBhd2FpdCB0aGlzLmFwcC52YXVsdC5hZGFwdGVyLnJlYWQoXCIuc21hcnQtY29ubmVjdGlvbnMvZmFpbGVkLWVtYmVkZGluZ3MudHh0XCIpO1xuICAgICAgLy8gc3BsaXQgZmFpbGVkX2VtYmVkZGluZ3MgaW50byBhcnJheVxuICAgICAgZmFpbGVkX2VtYmVkZGluZ3MgPSBmYWlsZWRfZW1iZWRkaW5ncy5zcGxpdChcIlxcclxcblwiKTtcbiAgICB9XG4gICAgLy8gbWVyZ2UgZmFpbGVkX2VtYmVkZGluZ3Mgd2l0aCByZW5kZXJfbG9nLmZhaWxlZF9lbWJlZGRpbmdzXG4gICAgZmFpbGVkX2VtYmVkZGluZ3MgPSBmYWlsZWRfZW1iZWRkaW5ncy5jb25jYXQodGhpcy5yZW5kZXJfbG9nLmZhaWxlZF9lbWJlZGRpbmdzKTtcbiAgICAvLyByZW1vdmUgZHVwbGljYXRlc1xuICAgIGZhaWxlZF9lbWJlZGRpbmdzID0gWy4uLm5ldyBTZXQoZmFpbGVkX2VtYmVkZGluZ3MpXTtcbiAgICAvLyBzb3J0IGZhaWxlZF9lbWJlZGRpbmdzIGFycmF5IGFscGhhYmV0aWNhbGx5XG4gICAgZmFpbGVkX2VtYmVkZGluZ3Muc29ydCgpO1xuICAgIC8vIGNvbnZlcnQgZmFpbGVkX2VtYmVkZGluZ3MgYXJyYXkgdG8gc3RyaW5nXG4gICAgZmFpbGVkX2VtYmVkZGluZ3MgPSBmYWlsZWRfZW1iZWRkaW5ncy5qb2luKFwiXFxyXFxuXCIpO1xuICAgIC8vIHdyaXRlIGZhaWxlZF9lbWJlZGRpbmdzIHRvIGZpbGVcbiAgICBhd2FpdCB0aGlzLmFwcC52YXVsdC5hZGFwdGVyLndyaXRlKFwiLnNtYXJ0LWNvbm5lY3Rpb25zL2ZhaWxlZC1lbWJlZGRpbmdzLnR4dFwiLCBmYWlsZWRfZW1iZWRkaW5ncyk7XG4gICAgLy8gcmVsb2FkIGZhaWxlZF9lbWJlZGRpbmdzIHRvIHByZXZlbnQgcmV0cnlpbmcgZmFpbGVkIGZpbGVzIHVudGlsIGV4cGxpY2l0bHkgcmVxdWVzdGVkXG4gICAgYXdhaXQgdGhpcy5sb2FkX2ZhaWxlZF9maWxlcygpO1xuICB9XG4gIFxuICAvLyBsb2FkIGZhaWxlZCBmaWxlcyBmcm9tIGZhaWxlZC1lbWJlZGRpbmdzLnR4dFxuICBhc3luYyBsb2FkX2ZhaWxlZF9maWxlcyAoKSB7XG4gICAgLy8gY2hlY2sgaWYgZmFpbGVkLWVtYmVkZGluZ3MudHh0IGV4aXN0c1xuICAgIGNvbnN0IGZhaWxlZF9lbWJlZGRpbmdzX2ZpbGVfZXhpc3RzID0gYXdhaXQgdGhpcy5hcHAudmF1bHQuYWRhcHRlci5leGlzdHMoXCIuc21hcnQtY29ubmVjdGlvbnMvZmFpbGVkLWVtYmVkZGluZ3MudHh0XCIpO1xuICAgIGlmKCFmYWlsZWRfZW1iZWRkaW5nc19maWxlX2V4aXN0cykge1xuICAgICAgdGhpcy5zZXR0aW5ncy5mYWlsZWRfZmlsZXMgPSBbXTtcbiAgICAgIGNvbnNvbGUubG9nKFwiTm8gZmFpbGVkIGZpbGVzLlwiKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgLy8gcmVhZCBmYWlsZWQtZW1iZWRkaW5ncy50eHRcbiAgICBjb25zdCBmYWlsZWRfZW1iZWRkaW5ncyA9IGF3YWl0IHRoaXMuYXBwLnZhdWx0LmFkYXB0ZXIucmVhZChcIi5zbWFydC1jb25uZWN0aW9ucy9mYWlsZWQtZW1iZWRkaW5ncy50eHRcIik7XG4gICAgLy8gc3BsaXQgZmFpbGVkX2VtYmVkZGluZ3MgaW50byBhcnJheSBhbmQgcmVtb3ZlIGVtcHR5IGxpbmVzXG4gICAgY29uc3QgZmFpbGVkX2VtYmVkZGluZ3NfYXJyYXkgPSBmYWlsZWRfZW1iZWRkaW5ncy5zcGxpdChcIlxcclxcblwiKTtcbiAgICAvLyBzcGxpdCBhdCAnIycgYW5kIHJlZHVjZSBpbnRvIHVuaXF1ZSBmaWxlIHBhdGhzXG4gICAgY29uc3QgZmFpbGVkX2ZpbGVzID0gZmFpbGVkX2VtYmVkZGluZ3NfYXJyYXkubWFwKGVtYmVkZGluZyA9PiBlbWJlZGRpbmcuc3BsaXQoXCIjXCIpWzBdKS5yZWR1Y2UoKHVuaXF1ZSwgaXRlbSkgPT4gdW5pcXVlLmluY2x1ZGVzKGl0ZW0pID8gdW5pcXVlIDogWy4uLnVuaXF1ZSwgaXRlbV0sIFtdKTtcbiAgICAvLyByZXR1cm4gZmFpbGVkX2ZpbGVzXG4gICAgdGhpcy5zZXR0aW5ncy5mYWlsZWRfZmlsZXMgPSBmYWlsZWRfZmlsZXM7XG4gICAgLy8gY29uc29sZS5sb2coZmFpbGVkX2ZpbGVzKTtcbiAgfVxuICAvLyByZXRyeSBmYWlsZWQgZW1iZWRkaW5nc1xuICBhc3luYyByZXRyeV9mYWlsZWRfZmlsZXMgKCkge1xuICAgIC8vIHJlbW92ZSBmYWlsZWQgZmlsZXMgZnJvbSBmYWlsZWRfZmlsZXNcbiAgICB0aGlzLnNldHRpbmdzLmZhaWxlZF9maWxlcyA9IFtdO1xuICAgIC8vIGlmIGZhaWxlZC1lbWJlZGRpbmdzLnR4dCBleGlzdHMgdGhlbiBkZWxldGUgaXRcbiAgICBjb25zdCBmYWlsZWRfZW1iZWRkaW5nc19maWxlX2V4aXN0cyA9IGF3YWl0IHRoaXMuYXBwLnZhdWx0LmFkYXB0ZXIuZXhpc3RzKFwiLnNtYXJ0LWNvbm5lY3Rpb25zL2ZhaWxlZC1lbWJlZGRpbmdzLnR4dFwiKTtcbiAgICBpZihmYWlsZWRfZW1iZWRkaW5nc19maWxlX2V4aXN0cykge1xuICAgICAgYXdhaXQgdGhpcy5hcHAudmF1bHQuYWRhcHRlci5yZW1vdmUoXCIuc21hcnQtY29ubmVjdGlvbnMvZmFpbGVkLWVtYmVkZGluZ3MudHh0XCIpO1xuICAgIH1cbiAgICAvLyBydW4gZ2V0IGFsbCBlbWJlZGRpbmdzXG4gICAgYXdhaXQgdGhpcy5nZXRfYWxsX2VtYmVkZGluZ3MoKTtcbiAgfVxuXG5cbiAgLy8gYWRkIC5zbWFydC1jb25uZWN0aW9ucyB0byAuZ2l0aWdub3JlIHRvIHByZXZlbnQgaXNzdWVzIHdpdGggbGFyZ2UsIGZyZXF1ZW50bHkgdXBkYXRlZCBlbWJlZGRpbmdzIGZpbGUocylcbiAgYXN5bmMgYWRkX3RvX2dpdGlnbm9yZSgpIHtcbiAgICBpZighKGF3YWl0IHRoaXMuYXBwLnZhdWx0LmFkYXB0ZXIuZXhpc3RzKFwiLmdpdGlnbm9yZVwiKSkpIHtcbiAgICAgIHJldHVybjsgLy8gaWYgLmdpdGlnbm9yZSBkb2Vzbid0IGV4aXN0IHRoZW4gZG9uJ3QgYWRkIC5zbWFydC1jb25uZWN0aW9ucyB0byAuZ2l0aWdub3JlXG4gICAgfVxuICAgIGxldCBnaXRpZ25vcmVfZmlsZSA9IGF3YWl0IHRoaXMuYXBwLnZhdWx0LmFkYXB0ZXIucmVhZChcIi5naXRpZ25vcmVcIik7XG4gICAgLy8gaWYgLnNtYXJ0LWNvbm5lY3Rpb25zIG5vdCBpbiAuZ2l0aWdub3JlXG4gICAgaWYgKGdpdGlnbm9yZV9maWxlLmluZGV4T2YoXCIuc21hcnQtY29ubmVjdGlvbnNcIikgPCAwKSB7XG4gICAgICAvLyBhZGQgLnNtYXJ0LWNvbm5lY3Rpb25zIHRvIC5naXRpZ25vcmVcbiAgICAgIGxldCBhZGRfdG9fZ2l0aWdub3JlID0gXCJcXG5cXG4jIElnbm9yZSBTbWFydCBDb25uZWN0aW9ucyBmb2xkZXIgYmVjYXVzZSBlbWJlZGRpbmdzIGZpbGUgaXMgbGFyZ2UgYW5kIHVwZGF0ZWQgZnJlcXVlbnRseVwiO1xuICAgICAgYWRkX3RvX2dpdGlnbm9yZSArPSBcIlxcbi5zbWFydC1jb25uZWN0aW9uc1wiO1xuICAgICAgYXdhaXQgdGhpcy5hcHAudmF1bHQuYWRhcHRlci53cml0ZShcIi5naXRpZ25vcmVcIiwgZ2l0aWdub3JlX2ZpbGUgKyBhZGRfdG9fZ2l0aWdub3JlKTtcbiAgICAgIGNvbnNvbGUubG9nKFwiYWRkZWQgLnNtYXJ0LWNvbm5lY3Rpb25zIHRvIC5naXRpZ25vcmVcIik7XG4gICAgfVxuICB9XG5cbiAgLy8gZm9yY2UgcmVmcmVzaCBlbWJlZGRpbmdzIGZpbGUgYnV0IGZpcnN0IHJlbmFtZSBleGlzdGluZyBlbWJlZGRpbmdzIGZpbGUgdG8gLnNtYXJ0LWNvbm5lY3Rpb25zL2VtYmVkZGluZ3MtWVlZWS1NTS1ERC5qc29uXG4gIGFzeW5jIGZvcmNlX3JlZnJlc2hfZW1iZWRkaW5nc19maWxlKCkge1xuICAgIG5ldyBPYnNpZGlhbi5Ob3RpY2UoXCJTbWFydCBDb25uZWN0aW9uczogZW1iZWRkaW5ncyBmaWxlIEZvcmNlIFJlZnJlc2hlZCwgbWFraW5nIG5ldyBjb25uZWN0aW9ucy4uLlwiKTtcbiAgICAvLyBmb3JjZSByZWZyZXNoXG4gICAgYXdhaXQgdGhpcy5zbWFydF92ZWNfbGl0ZS5mb3JjZV9yZWZyZXNoKCk7XG4gICAgLy8gdHJpZ2dlciBtYWtpbmcgbmV3IGNvbm5lY3Rpb25zXG4gICAgYXdhaXQgdGhpcy5nZXRfYWxsX2VtYmVkZGluZ3MoKTtcbiAgICB0aGlzLm91dHB1dF9yZW5kZXJfbG9nKCk7XG4gICAgbmV3IE9ic2lkaWFuLk5vdGljZShcIlNtYXJ0IENvbm5lY3Rpb25zOiBlbWJlZGRpbmdzIGZpbGUgRm9yY2UgUmVmcmVzaGVkLCBuZXcgY29ubmVjdGlvbnMgbWFkZS5cIik7XG4gIH1cblxuICAvLyBnZXQgZW1iZWRkaW5ncyBmb3IgZW1iZWRfaW5wdXRcbiAgYXN5bmMgZ2V0X2ZpbGVfZW1iZWRkaW5ncyhjdXJyX2ZpbGUsIHNhdmU9dHJ1ZSkge1xuICAgIC8vIGxldCBiYXRjaF9wcm9taXNlcyA9IFtdO1xuICAgIGxldCByZXFfYmF0Y2ggPSBbXTtcbiAgICBsZXQgYmxvY2tzID0gW107XG4gICAgLy8gaW5pdGlhdGUgY3Vycl9maWxlX2tleSBmcm9tIG1kNShjdXJyX2ZpbGUucGF0aClcbiAgICBjb25zdCBjdXJyX2ZpbGVfa2V5ID0gbWQ1KGN1cnJfZmlsZS5wYXRoKTtcbiAgICAvLyBpbnRpYXRlIGZpbGVfZmlsZV9lbWJlZF9pbnB1dCBieSByZW1vdmluZyAubWQgYW5kIGNvbnZlcnRpbmcgZmlsZSBwYXRoIHRvIGJyZWFkY3J1bWJzIChcIiA+IFwiKVxuICAgIGxldCBmaWxlX2VtYmVkX2lucHV0ID0gY3Vycl9maWxlLnBhdGgucmVwbGFjZShcIi5tZFwiLCBcIlwiKTtcbiAgICBmaWxlX2VtYmVkX2lucHV0ID0gZmlsZV9lbWJlZF9pbnB1dC5yZXBsYWNlKC9cXC8vZywgXCIgPiBcIik7XG4gICAgLy8gZW1iZWQgb24gZmlsZS5uYW1lL3RpdGxlIG9ubHkgaWYgcGF0aF9vbmx5IHBhdGggbWF0Y2hlciBzcGVjaWZpZWQgaW4gc2V0dGluZ3NcbiAgICBsZXQgcGF0aF9vbmx5ID0gZmFsc2U7XG4gICAgZm9yKGxldCBqID0gMDsgaiA8IHRoaXMucGF0aF9vbmx5Lmxlbmd0aDsgaisrKSB7XG4gICAgICBpZihjdXJyX2ZpbGUucGF0aC5pbmRleE9mKHRoaXMucGF0aF9vbmx5W2pdKSA+IC0xKSB7XG4gICAgICAgIHBhdGhfb25seSA9IHRydWU7XG4gICAgICAgIGNvbnNvbGUubG9nKFwidGl0bGUgb25seSBmaWxlIHdpdGggbWF0Y2hlcjogXCIgKyB0aGlzLnBhdGhfb25seVtqXSk7XG4gICAgICAgIC8vIGJyZWFrIG91dCBvZiBsb29wXG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgICAvLyByZXR1cm4gZWFybHkgaWYgcGF0aF9vbmx5XG4gICAgaWYocGF0aF9vbmx5KSB7XG4gICAgICByZXFfYmF0Y2gucHVzaChbY3Vycl9maWxlX2tleSwgZmlsZV9lbWJlZF9pbnB1dCwge1xuICAgICAgICBtdGltZTogY3Vycl9maWxlLnN0YXQubXRpbWUsXG4gICAgICAgIHBhdGg6IGN1cnJfZmlsZS5wYXRoLFxuICAgICAgfV0pO1xuICAgICAgYXdhaXQgdGhpcy5nZXRfZW1iZWRkaW5nc19iYXRjaChyZXFfYmF0Y2gpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBCRUdJTiBDYW52YXMgZmlsZSB0eXBlIEVtYmVkZGluZ1xuICAgICAqL1xuICAgIGlmKGN1cnJfZmlsZS5leHRlbnNpb24gPT09IFwiY2FudmFzXCIpIHtcbiAgICAgIC8vIGdldCBmaWxlIGNvbnRlbnRzIGFuZCBwYXJzZSBhcyBKU09OXG4gICAgICBjb25zdCBjYW52YXNfY29udGVudHMgPSBhd2FpdCB0aGlzLmFwcC52YXVsdC5jYWNoZWRSZWFkKGN1cnJfZmlsZSk7XG4gICAgICBpZigodHlwZW9mIGNhbnZhc19jb250ZW50cyA9PT0gXCJzdHJpbmdcIikgJiYgKGNhbnZhc19jb250ZW50cy5pbmRleE9mKFwibm9kZXNcIikgPiAtMSkpIHtcbiAgICAgICAgY29uc3QgY2FudmFzX2pzb24gPSBKU09OLnBhcnNlKGNhbnZhc19jb250ZW50cyk7XG4gICAgICAgIC8vIGZvciBlYWNoIG9iamVjdCBpbiBub2RlcyBhcnJheVxuICAgICAgICBmb3IobGV0IGogPSAwOyBqIDwgY2FudmFzX2pzb24ubm9kZXMubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAvLyBpZiBvYmplY3QgaGFzIHRleHQgcHJvcGVydHlcbiAgICAgICAgICBpZihjYW52YXNfanNvbi5ub2Rlc1tqXS50ZXh0KSB7XG4gICAgICAgICAgICAvLyBhZGQgdG8gZmlsZV9lbWJlZF9pbnB1dFxuICAgICAgICAgICAgZmlsZV9lbWJlZF9pbnB1dCArPSBcIlxcblwiICsgY2FudmFzX2pzb24ubm9kZXNbal0udGV4dDtcbiAgICAgICAgICB9XG4gICAgICAgICAgLy8gaWYgb2JqZWN0IGhhcyBmaWxlIHByb3BlcnR5XG4gICAgICAgICAgaWYoY2FudmFzX2pzb24ubm9kZXNbal0uZmlsZSkge1xuICAgICAgICAgICAgLy8gYWRkIHRvIGZpbGVfZW1iZWRfaW5wdXRcbiAgICAgICAgICAgIGZpbGVfZW1iZWRfaW5wdXQgKz0gXCJcXG5MaW5rOiBcIiArIGNhbnZhc19qc29uLm5vZGVzW2pdLmZpbGU7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICAvLyBjb25zb2xlLmxvZyhmaWxlX2VtYmVkX2lucHV0KTtcbiAgICAgIHJlcV9iYXRjaC5wdXNoKFtjdXJyX2ZpbGVfa2V5LCBmaWxlX2VtYmVkX2lucHV0LCB7XG4gICAgICAgIG10aW1lOiBjdXJyX2ZpbGUuc3RhdC5tdGltZSxcbiAgICAgICAgcGF0aDogY3Vycl9maWxlLnBhdGgsXG4gICAgICB9XSk7XG4gICAgICBhd2FpdCB0aGlzLmdldF9lbWJlZGRpbmdzX2JhdGNoKHJlcV9iYXRjaCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIFxuICAgIC8qKlxuICAgICAqIEJFR0lOIEJsb2NrIFwic2VjdGlvblwiIGVtYmVkZGluZ1xuICAgICAqL1xuICAgIC8vIGdldCBmaWxlIGNvbnRlbnRzXG4gICAgY29uc3Qgbm90ZV9jb250ZW50cyA9IGF3YWl0IHRoaXMuYXBwLnZhdWx0LmNhY2hlZFJlYWQoY3Vycl9maWxlKTtcbiAgICBsZXQgcHJvY2Vzc2VkX3NpbmNlX2xhc3Rfc2F2ZSA9IDA7XG4gICAgY29uc3Qgbm90ZV9zZWN0aW9ucyA9IHRoaXMuYmxvY2tfcGFyc2VyKG5vdGVfY29udGVudHMsIGN1cnJfZmlsZS5wYXRoKTtcbiAgICAvLyBjb25zb2xlLmxvZyhub3RlX3NlY3Rpb25zKTtcbiAgICAvLyBpZiBub3RlIGhhcyBtb3JlIHRoYW4gb25lIHNlY3Rpb24gKGlmIG9ubHkgb25lIHRoZW4gaXRzIHNhbWUgYXMgZnVsbC1jb250ZW50KVxuICAgIGlmKG5vdGVfc2VjdGlvbnMubGVuZ3RoID4gMSkge1xuICAgICAgLy8gZm9yIGVhY2ggc2VjdGlvbiBpbiBmaWxlXG4gICAgICAvL2NvbnNvbGUubG9nKFwiU2VjdGlvbnM6IFwiICsgbm90ZV9zZWN0aW9ucy5sZW5ndGgpO1xuICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCBub3RlX3NlY3Rpb25zLmxlbmd0aDsgaisrKSB7XG4gICAgICAgIC8vIGdldCBlbWJlZF9pbnB1dCBmb3IgYmxvY2tcbiAgICAgICAgY29uc3QgYmxvY2tfZW1iZWRfaW5wdXQgPSBub3RlX3NlY3Rpb25zW2pdLnRleHQ7XG4gICAgICAgIC8vIGNvbnNvbGUubG9nKG5vdGVfc2VjdGlvbnNbal0ucGF0aCk7XG4gICAgICAgIC8vIGdldCBibG9jayBrZXkgZnJvbSBibG9jay5wYXRoIChjb250YWlucyBib3RoIGZpbGUucGF0aCBhbmQgaGVhZGVyIHBhdGgpXG4gICAgICAgIGNvbnN0IGJsb2NrX2tleSA9IG1kNShub3RlX3NlY3Rpb25zW2pdLnBhdGgpO1xuICAgICAgICBibG9ja3MucHVzaChibG9ja19rZXkpO1xuICAgICAgICAvLyBza2lwIGlmIGxlbmd0aCBvZiBibG9ja19lbWJlZF9pbnB1dCBzYW1lIGFzIGxlbmd0aCBvZiBlbWJlZGRpbmdzW2Jsb2NrX2tleV0ubWV0YS5zaXplXG4gICAgICAgIC8vIFRPRE8gY29uc2lkZXIgcm91bmRpbmcgdG8gbmVhcmVzdCAxMCBvciAxMDAgZm9yIGZ1enp5IG1hdGNoaW5nXG4gICAgICAgIGlmICh0aGlzLnNtYXJ0X3ZlY19saXRlLmdldF9zaXplKGJsb2NrX2tleSkgPT09IGJsb2NrX2VtYmVkX2lucHV0Lmxlbmd0aCkge1xuICAgICAgICAgIC8vIGxvZyBza2lwcGluZyBmaWxlXG4gICAgICAgICAgLy8gY29uc29sZS5sb2coXCJza2lwcGluZyBibG9jayAobGVuKVwiKTtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICAgICAgICAvLyBhZGQgaGFzaCB0byBibG9ja3MgdG8gcHJldmVudCBlbXB0eSBibG9ja3MgdHJpZ2dlcmluZyBmdWxsLWZpbGUgZW1iZWRkaW5nXG4gICAgICAgIC8vIHNraXAgaWYgZW1iZWRkaW5ncyBrZXkgYWxyZWFkeSBleGlzdHMgYW5kIGJsb2NrIG10aW1lIGlzIGdyZWF0ZXIgdGhhbiBvciBlcXVhbCB0byBmaWxlIG10aW1lXG4gICAgICAgIGlmKHRoaXMuc21hcnRfdmVjX2xpdGUubXRpbWVfaXNfY3VycmVudChibG9ja19rZXksIGN1cnJfZmlsZS5zdGF0Lm10aW1lKSkge1xuICAgICAgICAgIC8vIGxvZyBza2lwcGluZyBmaWxlXG4gICAgICAgICAgLy8gY29uc29sZS5sb2coXCJza2lwcGluZyBibG9jayAobXRpbWUpXCIpO1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICAgIC8vIHNraXAgaWYgaGFzaCBpcyBwcmVzZW50IGluIGVtYmVkZGluZ3MgYW5kIGhhc2ggb2YgYmxvY2tfZW1iZWRfaW5wdXQgaXMgZXF1YWwgdG8gaGFzaCBpbiBlbWJlZGRpbmdzXG4gICAgICAgIGNvbnN0IGJsb2NrX2hhc2ggPSBtZDUoYmxvY2tfZW1iZWRfaW5wdXQudHJpbSgpKTtcbiAgICAgICAgaWYodGhpcy5zbWFydF92ZWNfbGl0ZS5nZXRfaGFzaChibG9ja19rZXkpID09PSBibG9ja19oYXNoKSB7XG4gICAgICAgICAgLy8gbG9nIHNraXBwaW5nIGZpbGVcbiAgICAgICAgICAvLyBjb25zb2xlLmxvZyhcInNraXBwaW5nIGJsb2NrIChoYXNoKVwiKTtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGNyZWF0ZSByZXFfYmF0Y2ggZm9yIGJhdGNoaW5nIHJlcXVlc3RzXG4gICAgICAgIHJlcV9iYXRjaC5wdXNoKFtibG9ja19rZXksIGJsb2NrX2VtYmVkX2lucHV0LCB7XG4gICAgICAgICAgLy8gb2xkbXRpbWU6IGN1cnJfZmlsZS5zdGF0Lm10aW1lLCBcbiAgICAgICAgICAvLyBnZXQgY3VycmVudCBkYXRldGltZSBhcyB1bml4IHRpbWVzdGFtcFxuICAgICAgICAgIG10aW1lOiBEYXRlLm5vdygpLFxuICAgICAgICAgIGhhc2g6IGJsb2NrX2hhc2gsIFxuICAgICAgICAgIHBhcmVudDogY3Vycl9maWxlX2tleSxcbiAgICAgICAgICBwYXRoOiBub3RlX3NlY3Rpb25zW2pdLnBhdGgsXG4gICAgICAgICAgc2l6ZTogYmxvY2tfZW1iZWRfaW5wdXQubGVuZ3RoLFxuICAgICAgICB9XSk7XG4gICAgICAgIGlmKHJlcV9iYXRjaC5sZW5ndGggPiA5KSB7XG4gICAgICAgICAgLy8gYWRkIGJhdGNoIHRvIGJhdGNoX3Byb21pc2VzXG4gICAgICAgICAgYXdhaXQgdGhpcy5nZXRfZW1iZWRkaW5nc19iYXRjaChyZXFfYmF0Y2gpO1xuICAgICAgICAgIHByb2Nlc3NlZF9zaW5jZV9sYXN0X3NhdmUgKz0gcmVxX2JhdGNoLmxlbmd0aDtcbiAgICAgICAgICAvLyBsb2cgZW1iZWRkaW5nXG4gICAgICAgICAgLy8gY29uc29sZS5sb2coXCJlbWJlZGRpbmc6IFwiICsgY3Vycl9maWxlLnBhdGgpO1xuICAgICAgICAgIGlmIChwcm9jZXNzZWRfc2luY2VfbGFzdF9zYXZlID49IDMwKSB7XG4gICAgICAgICAgICAvLyB3cml0ZSBlbWJlZGRpbmdzIEpTT04gdG8gZmlsZVxuICAgICAgICAgICAgYXdhaXQgdGhpcy5zYXZlX2VtYmVkZGluZ3NfdG9fZmlsZSgpO1xuICAgICAgICAgICAgLy8gcmVzZXQgcHJvY2Vzc2VkX3NpbmNlX2xhc3Rfc2F2ZVxuICAgICAgICAgICAgcHJvY2Vzc2VkX3NpbmNlX2xhc3Rfc2F2ZSA9IDA7XG4gICAgICAgICAgfVxuICAgICAgICAgIC8vIHJlc2V0IHJlcV9iYXRjaFxuICAgICAgICAgIHJlcV9iYXRjaCA9IFtdO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIC8vIGlmIHJlcV9iYXRjaCBpcyBub3QgZW1wdHlcbiAgICBpZihyZXFfYmF0Y2gubGVuZ3RoID4gMCkge1xuICAgICAgLy8gcHJvY2VzcyByZW1haW5pbmcgcmVxX2JhdGNoXG4gICAgICBhd2FpdCB0aGlzLmdldF9lbWJlZGRpbmdzX2JhdGNoKHJlcV9iYXRjaCk7XG4gICAgICByZXFfYmF0Y2ggPSBbXTtcbiAgICAgIHByb2Nlc3NlZF9zaW5jZV9sYXN0X3NhdmUgKz0gcmVxX2JhdGNoLmxlbmd0aDtcbiAgICB9XG4gICAgXG4gICAgLyoqXG4gICAgICogQkVHSU4gRmlsZSBcImZ1bGwgbm90ZVwiIGVtYmVkZGluZ1xuICAgICAqL1xuXG4gICAgLy8gaWYgZmlsZSBsZW5ndGggaXMgbGVzcyB0aGFuIH44MDAwIHRva2VucyB1c2UgZnVsbCBmaWxlIGNvbnRlbnRzXG4gICAgLy8gZWxzZSBpZiBmaWxlIGxlbmd0aCBpcyBncmVhdGVyIHRoYW4gODAwMCB0b2tlbnMgYnVpbGQgZmlsZV9lbWJlZF9pbnB1dCBmcm9tIGZpbGUgaGVhZGluZ3NcbiAgICBmaWxlX2VtYmVkX2lucHV0ICs9IGA6XFxuYDtcbiAgICAvKipcbiAgICAgKiBUT0RPOiBpbXByb3ZlL3JlZmFjdG9yIHRoZSBmb2xsb3dpbmcgXCJsYXJnZSBmaWxlIHJlZHVjZSB0byBoZWFkaW5nc1wiIGxvZ2ljXG4gICAgICovXG4gICAgaWYobm90ZV9jb250ZW50cy5sZW5ndGggPCBNQVhfRU1CRURfU1RSSU5HX0xFTkdUSCkge1xuICAgICAgZmlsZV9lbWJlZF9pbnB1dCArPSBub3RlX2NvbnRlbnRzXG4gICAgfWVsc2V7IFxuICAgICAgY29uc3Qgbm90ZV9tZXRhX2NhY2hlID0gdGhpcy5hcHAubWV0YWRhdGFDYWNoZS5nZXRGaWxlQ2FjaGUoY3Vycl9maWxlKTtcbiAgICAgIC8vIGZvciBlYWNoIGhlYWRpbmcgaW4gZmlsZVxuICAgICAgaWYodHlwZW9mIG5vdGVfbWV0YV9jYWNoZS5oZWFkaW5ncyA9PT0gXCJ1bmRlZmluZWRcIikge1xuICAgICAgICAvLyBjb25zb2xlLmxvZyhcIm5vIGhlYWRpbmdzIGZvdW5kLCB1c2luZyBmaXJzdCBjaHVuayBvZiBmaWxlIGluc3RlYWRcIik7XG4gICAgICAgIGZpbGVfZW1iZWRfaW5wdXQgKz0gbm90ZV9jb250ZW50cy5zdWJzdHJpbmcoMCwgTUFYX0VNQkVEX1NUUklOR19MRU5HVEgpO1xuICAgICAgfWVsc2V7XG4gICAgICAgIGxldCBub3RlX2hlYWRpbmdzID0gXCJcIjtcbiAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCBub3RlX21ldGFfY2FjaGUuaGVhZGluZ3MubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAvLyBnZXQgaGVhZGluZyBsZXZlbFxuICAgICAgICAgIGNvbnN0IGhlYWRpbmdfbGV2ZWwgPSBub3RlX21ldGFfY2FjaGUuaGVhZGluZ3Nbal0ubGV2ZWw7XG4gICAgICAgICAgLy8gZ2V0IGhlYWRpbmcgdGV4dFxuICAgICAgICAgIGNvbnN0IGhlYWRpbmdfdGV4dCA9IG5vdGVfbWV0YV9jYWNoZS5oZWFkaW5nc1tqXS5oZWFkaW5nO1xuICAgICAgICAgIC8vIGJ1aWxkIG1hcmtkb3duIGhlYWRpbmdcbiAgICAgICAgICBsZXQgbWRfaGVhZGluZyA9IFwiXCI7XG4gICAgICAgICAgZm9yIChsZXQgayA9IDA7IGsgPCBoZWFkaW5nX2xldmVsOyBrKyspIHtcbiAgICAgICAgICAgIG1kX2hlYWRpbmcgKz0gXCIjXCI7XG4gICAgICAgICAgfVxuICAgICAgICAgIC8vIGFkZCBoZWFkaW5nIHRvIG5vdGVfaGVhZGluZ3NcbiAgICAgICAgICBub3RlX2hlYWRpbmdzICs9IGAke21kX2hlYWRpbmd9ICR7aGVhZGluZ190ZXh0fVxcbmA7XG4gICAgICAgIH1cbiAgICAgICAgLy9jb25zb2xlLmxvZyhub3RlX2hlYWRpbmdzKTtcbiAgICAgICAgZmlsZV9lbWJlZF9pbnB1dCArPSBub3RlX2hlYWRpbmdzXG4gICAgICAgIGlmKGZpbGVfZW1iZWRfaW5wdXQubGVuZ3RoID4gTUFYX0VNQkVEX1NUUklOR19MRU5HVEgpIHtcbiAgICAgICAgICBmaWxlX2VtYmVkX2lucHV0ID0gZmlsZV9lbWJlZF9pbnB1dC5zdWJzdHJpbmcoMCwgTUFYX0VNQkVEX1NUUklOR19MRU5HVEgpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIC8vIHNraXAgZW1iZWRkaW5nIGZ1bGwgZmlsZSBpZiBibG9ja3MgaXMgbm90IGVtcHR5IGFuZCBhbGwgaGFzaGVzIGFyZSBwcmVzZW50IGluIGVtYmVkZGluZ3NcbiAgICAvLyBiZXR0ZXIgdGhhbiBoYXNoaW5nIGZpbGVfZW1iZWRfaW5wdXQgYmVjYXVzZSBtb3JlIHJlc2lsaWVudCB0byBpbmNvbnNlcXVlbnRpYWwgY2hhbmdlcyAod2hpdGVzcGFjZSBiZXR3ZWVuIGhlYWRpbmdzKVxuICAgIGNvbnN0IGZpbGVfaGFzaCA9IG1kNShmaWxlX2VtYmVkX2lucHV0LnRyaW0oKSk7XG4gICAgY29uc3QgZXhpc3RpbmdfaGFzaCA9IHRoaXMuc21hcnRfdmVjX2xpdGUuZ2V0X2hhc2goY3Vycl9maWxlX2tleSk7XG4gICAgaWYoZXhpc3RpbmdfaGFzaCAmJiAoZmlsZV9oYXNoID09PSBleGlzdGluZ19oYXNoKSkge1xuICAgICAgLy8gY29uc29sZS5sb2coXCJza2lwcGluZyBmaWxlIChoYXNoKTogXCIgKyBjdXJyX2ZpbGUucGF0aCk7XG4gICAgICB0aGlzLnVwZGF0ZV9yZW5kZXJfbG9nKGJsb2NrcywgZmlsZV9lbWJlZF9pbnB1dCk7XG4gICAgICByZXR1cm47XG4gICAgfTtcblxuICAgIC8vIGlmIG5vdCBhbHJlYWR5IHNraXBwaW5nIGFuZCBibG9ja3MgYXJlIHByZXNlbnRcbiAgICBjb25zdCBleGlzdGluZ19ibG9ja3MgPSB0aGlzLnNtYXJ0X3ZlY19saXRlLmdldF9jaGlsZHJlbihjdXJyX2ZpbGVfa2V5KTtcbiAgICBsZXQgZXhpc3RpbmdfaGFzX2FsbF9ibG9ja3MgPSB0cnVlO1xuICAgIGlmKGV4aXN0aW5nX2Jsb2NrcyAmJiBBcnJheS5pc0FycmF5KGV4aXN0aW5nX2Jsb2NrcykgJiYgKGJsb2Nrcy5sZW5ndGggPiAwKSkge1xuICAgICAgLy8gaWYgYWxsIGJsb2NrcyBhcmUgaW4gZXhpc3RpbmdfYmxvY2tzIHRoZW4gc2tpcCAoYWxsb3dzIGRlbGV0aW9uIG9mIHNtYWxsIGJsb2NrcyB3aXRob3V0IHRyaWdnZXJpbmcgZnVsbCBmaWxlIGVtYmVkZGluZylcbiAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgYmxvY2tzLmxlbmd0aDsgaisrKSB7XG4gICAgICAgIGlmKGV4aXN0aW5nX2Jsb2Nrcy5pbmRleE9mKGJsb2Nrc1tqXSkgPT09IC0xKSB7XG4gICAgICAgICAgZXhpc3RpbmdfaGFzX2FsbF9ibG9ja3MgPSBmYWxzZTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICAvLyBpZiBleGlzdGluZyBoYXMgYWxsIGJsb2NrcyB0aGVuIGNoZWNrIGZpbGUgc2l6ZSBmb3IgZGVsdGFcbiAgICBpZihleGlzdGluZ19oYXNfYWxsX2Jsb2Nrcyl7XG4gICAgICAvLyBnZXQgY3VycmVudCBub3RlIGZpbGUgc2l6ZVxuICAgICAgY29uc3QgY3Vycl9maWxlX3NpemUgPSBjdXJyX2ZpbGUuc3RhdC5zaXplO1xuICAgICAgLy8gZ2V0IGZpbGUgc2l6ZSBmcm9tIGVtYmVkZGluZ3NcbiAgICAgIGNvbnN0IHByZXZfZmlsZV9zaXplID0gdGhpcy5zbWFydF92ZWNfbGl0ZS5nZXRfc2l6ZShjdXJyX2ZpbGVfa2V5KTtcbiAgICAgIGlmIChwcmV2X2ZpbGVfc2l6ZSkge1xuICAgICAgICAvLyBpZiBjdXJyIGZpbGUgc2l6ZSBpcyBsZXNzIHRoYW4gMTAlIGRpZmZlcmVudCBmcm9tIHByZXYgZmlsZSBzaXplXG4gICAgICAgIGNvbnN0IGZpbGVfZGVsdGFfcGN0ID0gTWF0aC5yb3VuZCgoTWF0aC5hYnMoY3Vycl9maWxlX3NpemUgLSBwcmV2X2ZpbGVfc2l6ZSkgLyBjdXJyX2ZpbGVfc2l6ZSkgKiAxMDApO1xuICAgICAgICBpZihmaWxlX2RlbHRhX3BjdCA8IDEwKSB7XG4gICAgICAgICAgLy8gc2tpcCBlbWJlZGRpbmdcbiAgICAgICAgICAvLyBjb25zb2xlLmxvZyhcInNraXBwaW5nIGZpbGUgKHNpemUpIFwiICsgY3Vycl9maWxlLnBhdGgpO1xuICAgICAgICAgIHRoaXMucmVuZGVyX2xvZy5za2lwcGVkX2xvd19kZWx0YVtjdXJyX2ZpbGUubmFtZV0gPSBmaWxlX2RlbHRhX3BjdCArIFwiJVwiO1xuICAgICAgICAgIHRoaXMudXBkYXRlX3JlbmRlcl9sb2coYmxvY2tzLCBmaWxlX2VtYmVkX2lucHV0KTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgbGV0IG1ldGEgPSB7XG4gICAgICBtdGltZTogY3Vycl9maWxlLnN0YXQubXRpbWUsXG4gICAgICBoYXNoOiBmaWxlX2hhc2gsXG4gICAgICBwYXRoOiBjdXJyX2ZpbGUucGF0aCxcbiAgICAgIHNpemU6IGN1cnJfZmlsZS5zdGF0LnNpemUsXG4gICAgICBjaGlsZHJlbjogYmxvY2tzLFxuICAgIH07XG4gICAgLy8gYmF0Y2hfcHJvbWlzZXMucHVzaCh0aGlzLmdldF9lbWJlZGRpbmdzKGN1cnJfZmlsZV9rZXksIGZpbGVfZW1iZWRfaW5wdXQsIG1ldGEpKTtcbiAgICByZXFfYmF0Y2gucHVzaChbY3Vycl9maWxlX2tleSwgZmlsZV9lbWJlZF9pbnB1dCwgbWV0YV0pO1xuICAgIC8vIHNlbmQgYmF0Y2ggcmVxdWVzdFxuICAgIGF3YWl0IHRoaXMuZ2V0X2VtYmVkZGluZ3NfYmF0Y2gocmVxX2JhdGNoKTtcblxuICAgIC8vIGxvZyBlbWJlZGRpbmdcbiAgICAvLyBjb25zb2xlLmxvZyhcImVtYmVkZGluZzogXCIgKyBjdXJyX2ZpbGUucGF0aCk7XG4gICAgaWYgKHNhdmUpIHtcbiAgICAgIC8vIHdyaXRlIGVtYmVkZGluZ3MgSlNPTiB0byBmaWxlXG4gICAgICBhd2FpdCB0aGlzLnNhdmVfZW1iZWRkaW5nc190b19maWxlKCk7XG4gICAgfVxuXG4gIH1cblxuICB1cGRhdGVfcmVuZGVyX2xvZyhibG9ja3MsIGZpbGVfZW1iZWRfaW5wdXQpIHtcbiAgICBpZiAoYmxvY2tzLmxlbmd0aCA+IDApIHtcbiAgICAgIC8vIG11bHRpcGx5IGJ5IDIgYmVjYXVzZSBpbXBsaWVzIHdlIHNhdmVkIHRva2VuIHNwZW5kaW5nIG9uIGJsb2NrcyhzZWN0aW9ucyksIHRvb1xuICAgICAgdGhpcy5yZW5kZXJfbG9nLnRva2Vuc19zYXZlZF9ieV9jYWNoZSArPSBmaWxlX2VtYmVkX2lucHV0Lmxlbmd0aCAvIDI7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIGNhbGMgdG9rZW5zIHNhdmVkIGJ5IGNhY2hlOiBkaXZpZGUgYnkgNCBmb3IgdG9rZW4gZXN0aW1hdGVcbiAgICAgIHRoaXMucmVuZGVyX2xvZy50b2tlbnNfc2F2ZWRfYnlfY2FjaGUgKz0gZmlsZV9lbWJlZF9pbnB1dC5sZW5ndGggLyA0O1xuICAgIH1cbiAgfVxuXG4gIGFzeW5jIGdldF9lbWJlZGRpbmdzX2JhdGNoKHJlcV9iYXRjaCkge1xuICAgIGNvbnNvbGUubG9nKFwiZ2V0X2VtYmVkZGluZ3NfYmF0Y2hcIik7XG4gICAgLy8gaWYgcmVxX2JhdGNoIGlzIGVtcHR5IHRoZW4gcmV0dXJuXG4gICAgaWYocmVxX2JhdGNoLmxlbmd0aCA9PT0gMCkgcmV0dXJuO1xuICAgIC8vIGNyZWF0ZSBhcnJhcnkgb2YgZW1iZWRfaW5wdXRzIGZyb20gcmVxX2JhdGNoW2ldWzFdXG4gICAgY29uc3QgZW1iZWRfaW5wdXRzID0gcmVxX2JhdGNoLm1hcCgocmVxKSA9PiByZXFbMV0pO1xuICAgIC8vIHJlcXVlc3QgZW1iZWRkaW5ncyBmcm9tIGVtYmVkX2lucHV0c1xuICAgIGNvbnN0IHJlcXVlc3RSZXN1bHRzID0gYXdhaXQgdGhpcy5yZXF1ZXN0X2VtYmVkZGluZ19mcm9tX2lucHV0KGVtYmVkX2lucHV0cyk7XG4gICAgLy8gaWYgcmVxdWVzdFJlc3VsdHMgaXMgbnVsbCB0aGVuIHJldHVyblxuICAgIGlmKCFyZXF1ZXN0UmVzdWx0cykge1xuICAgICAgY29uc29sZS5sb2coXCJmYWlsZWQgZW1iZWRkaW5nIGJhdGNoXCIpO1xuICAgICAgLy8gbG9nIGZhaWxlZCBmaWxlIG5hbWVzIHRvIHJlbmRlcl9sb2dcbiAgICAgIHRoaXMucmVuZGVyX2xvZy5mYWlsZWRfZW1iZWRkaW5ncyA9IFsuLi50aGlzLnJlbmRlcl9sb2cuZmFpbGVkX2VtYmVkZGluZ3MsIC4uLnJlcV9iYXRjaC5tYXAoKHJlcSkgPT4gcmVxWzJdLnBhdGgpXTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgLy8gaWYgcmVxdWVzdFJlc3VsdHMgaXMgbm90IG51bGxcbiAgICBpZihyZXF1ZXN0UmVzdWx0cyl7XG4gICAgICB0aGlzLmhhc19uZXdfZW1iZWRkaW5ncyA9IHRydWU7XG4gICAgICAvLyBhZGQgZW1iZWRkaW5nIGtleSB0byByZW5kZXJfbG9nXG4gICAgICBpZih0aGlzLnNldHRpbmdzLmxvZ19yZW5kZXIpe1xuICAgICAgICBpZih0aGlzLnNldHRpbmdzLmxvZ19yZW5kZXJfZmlsZXMpe1xuICAgICAgICAgIHRoaXMucmVuZGVyX2xvZy5maWxlcyA9IFsuLi50aGlzLnJlbmRlcl9sb2cuZmlsZXMsIC4uLnJlcV9iYXRjaC5tYXAoKHJlcSkgPT4gcmVxWzJdLnBhdGgpXTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLnJlbmRlcl9sb2cubmV3X2VtYmVkZGluZ3MgKz0gcmVxX2JhdGNoLmxlbmd0aDtcbiAgICAgICAgLy8gYWRkIHRva2VuIHVzYWdlIHRvIHJlbmRlcl9sb2dcbiAgICAgICAgdGhpcy5yZW5kZXJfbG9nLnRva2VuX3VzYWdlICs9IHJlcXVlc3RSZXN1bHRzLnVzYWdlLnRvdGFsX3Rva2VucztcbiAgICAgIH1cbiAgICAgIC8vIGNvbnNvbGUubG9nKHJlcXVlc3RSZXN1bHRzLmRhdGEubGVuZ3RoKTtcbiAgICAgIC8vIGxvb3AgdGhyb3VnaCByZXF1ZXN0UmVzdWx0cy5kYXRhXG4gICAgICBmb3IobGV0IGkgPSAwOyBpIDwgcmVxdWVzdFJlc3VsdHMuZGF0YS5sZW5ndGg7IGkrKykge1xuICAgICAgICBjb25zdCB2ZWMgPSByZXF1ZXN0UmVzdWx0cy5kYXRhW2ldLmVtYmVkZGluZztcbiAgICAgICAgY29uc3QgaW5kZXggPSByZXF1ZXN0UmVzdWx0cy5kYXRhW2ldLmluZGV4O1xuICAgICAgICBpZih2ZWMpIHtcbiAgICAgICAgICBjb25zdCBrZXkgPSByZXFfYmF0Y2hbaW5kZXhdWzBdO1xuICAgICAgICAgIGNvbnN0IG1ldGEgPSByZXFfYmF0Y2hbaW5kZXhdWzJdO1xuICAgICAgICAgIHRoaXMuc21hcnRfdmVjX2xpdGUuc2F2ZV9lbWJlZGRpbmcoa2V5LCB2ZWMsIG1ldGEpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgYXN5bmMgcmVxdWVzdF9lbWJlZGRpbmdfZnJvbV9pbnB1dChlbWJlZF9pbnB1dCwgcmV0cmllcyA9IDApIHtcbiAgICAvLyAoRk9SIFRFU1RJTkcpIHRlc3QgZmFpbCBwcm9jZXNzIGJ5IGZvcmNpbmcgZmFpbFxuICAgIC8vIHJldHVybiBudWxsO1xuICAgIC8vIGNoZWNrIGlmIGVtYmVkX2lucHV0IGlzIGEgc3RyaW5nXG4gICAgLy8gaWYodHlwZW9mIGVtYmVkX2lucHV0ICE9PSBcInN0cmluZ1wiKSB7XG4gICAgLy8gICBjb25zb2xlLmxvZyhcImVtYmVkX2lucHV0IGlzIG5vdCBhIHN0cmluZ1wiKTtcbiAgICAvLyAgIHJldHVybiBudWxsO1xuICAgIC8vIH1cbiAgICAvLyBjaGVjayBpZiBlbWJlZF9pbnB1dCBpcyBlbXB0eVxuICAgIGlmKGVtYmVkX2lucHV0Lmxlbmd0aCA9PT0gMCkge1xuICAgICAgY29uc29sZS5sb2coXCJlbWJlZF9pbnB1dCBpcyBlbXB0eVwiKTtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICBjb25zdCB1c2VkUGFyYW1zID0ge1xuICAgICAgbW9kZWw6IFwidGV4dC1lbWJlZGRpbmctYWRhLTAwMlwiLFxuICAgICAgaW5wdXQ6IGVtYmVkX2lucHV0LFxuICAgIH07XG4gICAgLy8gY29uc29sZS5sb2codGhpcy5zZXR0aW5ncy5hcGlfa2V5KTtcbiAgICBjb25zdCByZXFQYXJhbXMgPSB7XG4gICAgICB1cmw6IGBodHRwczovL2FwaS5vcGVuYWkuY29tL3YxL2VtYmVkZGluZ3NgLFxuICAgICAgbWV0aG9kOiBcIlBPU1RcIixcbiAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHVzZWRQYXJhbXMpLFxuICAgICAgaGVhZGVyczoge1xuICAgICAgICBcIkNvbnRlbnQtVHlwZVwiOiBcImFwcGxpY2F0aW9uL2pzb25cIixcbiAgICAgICAgXCJBdXRob3JpemF0aW9uXCI6IGBCZWFyZXIgJHt0aGlzLnNldHRpbmdzLmFwaV9rZXl9YFxuICAgICAgfVxuICAgIH07XG4gICAgbGV0IHJlc3A7XG4gICAgdHJ5IHtcbiAgICAgIHJlc3AgPSBhd2FpdCAoMCwgT2JzaWRpYW4ucmVxdWVzdCkocmVxUGFyYW1zKVxuICAgICAgcmV0dXJuIEpTT04ucGFyc2UocmVzcCk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIC8vIHJldHJ5IHJlcXVlc3QgaWYgZXJyb3IgaXMgNDI5XG4gICAgICBpZigoZXJyb3Iuc3RhdHVzID09PSA0MjkpICYmIChyZXRyaWVzIDwgMykpIHtcbiAgICAgICAgcmV0cmllcysrO1xuICAgICAgICAvLyBleHBvbmVudGlhbCBiYWNrb2ZmXG4gICAgICAgIGNvbnN0IGJhY2tvZmYgPSBNYXRoLnBvdyhyZXRyaWVzLCAyKTtcbiAgICAgICAgY29uc29sZS5sb2coYHJldHJ5aW5nIHJlcXVlc3QgKDQyOSkgaW4gJHtiYWNrb2ZmfSBzZWNvbmRzLi4uYCk7XG4gICAgICAgIGF3YWl0IG5ldyBQcm9taXNlKHIgPT4gc2V0VGltZW91dChyLCAxMDAwICogYmFja29mZikpO1xuICAgICAgICByZXR1cm4gYXdhaXQgdGhpcy5yZXF1ZXN0X2VtYmVkZGluZ19mcm9tX2lucHV0KGVtYmVkX2lucHV0LCByZXRyaWVzKTtcbiAgICAgIH1cbiAgICAgIC8vIGxvZyBmdWxsIGVycm9yIHRvIGNvbnNvbGVcbiAgICAgIGNvbnNvbGUubG9nKHJlc3ApO1xuICAgICAgLy8gY29uc29sZS5sb2coXCJmaXJzdCBsaW5lIG9mIGVtYmVkOiBcIiArIGVtYmVkX2lucHV0LnN1YnN0cmluZygwLCBlbWJlZF9pbnB1dC5pbmRleE9mKFwiXFxuXCIpKSk7XG4gICAgICAvLyBjb25zb2xlLmxvZyhcImVtYmVkIGlucHV0IGxlbmd0aDogXCIrIGVtYmVkX2lucHV0Lmxlbmd0aCk7XG4gICAgICAvLyBpZihBcnJheS5pc0FycmF5KGVtYmVkX2lucHV0KSkge1xuICAgICAgLy8gICBjb25zb2xlLmxvZyhlbWJlZF9pbnB1dC5tYXAoKGlucHV0KSA9PiBpbnB1dC5sZW5ndGgpKTtcbiAgICAgIC8vIH1cbiAgICAgIC8vIGNvbnNvbGUubG9nKFwiZXJyb25lb3VzIGVtYmVkIGlucHV0OiBcIiArIGVtYmVkX2lucHV0KTtcbiAgICAgIGNvbnNvbGUubG9nKGVycm9yKTtcbiAgICAgIC8vIGNvbnNvbGUubG9nKHVzZWRQYXJhbXMpO1xuICAgICAgLy8gY29uc29sZS5sb2codXNlZFBhcmFtcy5pbnB1dC5sZW5ndGgpO1xuICAgICAgcmV0dXJuIG51bGw7IFxuICAgIH1cbiAgfVxuICBhc3luYyB0ZXN0X2FwaV9rZXkoKSB7XG4gICAgY29uc3QgZW1iZWRfaW5wdXQgPSBcIlRoaXMgaXMgYSB0ZXN0IG9mIHRoZSBPcGVuQUkgQVBJLlwiO1xuICAgIGNvbnN0IHJlc3AgPSBhd2FpdCB0aGlzLnJlcXVlc3RfZW1iZWRkaW5nX2Zyb21faW5wdXQoZW1iZWRfaW5wdXQpO1xuICAgIGlmKHJlc3AgJiYgcmVzcC51c2FnZSkge1xuICAgICAgY29uc29sZS5sb2coXCJBUEkga2V5IGlzIHZhbGlkXCIpO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfWVsc2V7XG4gICAgICBjb25zb2xlLmxvZyhcIkFQSSBrZXkgaXMgaW52YWxpZFwiKTtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH1cblxuXG4gIG91dHB1dF9yZW5kZXJfbG9nKCkge1xuICAgIC8vIGlmIHNldHRpbmdzLmxvZ19yZW5kZXIgaXMgdHJ1ZVxuICAgIGlmKHRoaXMuc2V0dGluZ3MubG9nX3JlbmRlcikge1xuICAgICAgaWYgKHRoaXMucmVuZGVyX2xvZy5uZXdfZW1iZWRkaW5ncyA9PT0gMCkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9ZWxzZXtcbiAgICAgICAgLy8gcHJldHR5IHByaW50IHRoaXMucmVuZGVyX2xvZyB0byBjb25zb2xlXG4gICAgICAgIGNvbnNvbGUubG9nKEpTT04uc3RyaW5naWZ5KHRoaXMucmVuZGVyX2xvZywgbnVsbCwgMikpO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIGNsZWFyIHJlbmRlcl9sb2dcbiAgICB0aGlzLnJlbmRlcl9sb2cgPSB7fTtcbiAgICB0aGlzLnJlbmRlcl9sb2cuZGVsZXRlZF9lbWJlZGRpbmdzID0gMDtcbiAgICB0aGlzLnJlbmRlcl9sb2cuZXhjbHVzaW9uc19sb2dzID0ge307XG4gICAgdGhpcy5yZW5kZXJfbG9nLmZhaWxlZF9lbWJlZGRpbmdzID0gW107XG4gICAgdGhpcy5yZW5kZXJfbG9nLmZpbGVzID0gW107XG4gICAgdGhpcy5yZW5kZXJfbG9nLm5ld19lbWJlZGRpbmdzID0gMDtcbiAgICB0aGlzLnJlbmRlcl9sb2cuc2tpcHBlZF9sb3dfZGVsdGEgPSB7fTtcbiAgICB0aGlzLnJlbmRlcl9sb2cudG9rZW5fdXNhZ2UgPSAwO1xuICAgIHRoaXMucmVuZGVyX2xvZy50b2tlbnNfc2F2ZWRfYnlfY2FjaGUgPSAwO1xuICB9XG5cbiAgLy8gZmluZCBjb25uZWN0aW9ucyBieSBtb3N0IHNpbWlsYXIgdG8gY3VycmVudCBub3RlIGJ5IGNvc2luZSBzaW1pbGFyaXR5XG4gIGFzeW5jIGZpbmRfbm90ZV9jb25uZWN0aW9ucyhjdXJyZW50X25vdGU9bnVsbCkge1xuICAgIC8vIG1kNSBvZiBjdXJyZW50IG5vdGUgcGF0aFxuICAgIGNvbnN0IGN1cnJfa2V5ID0gbWQ1KGN1cnJlbnRfbm90ZS5wYXRoKTtcbiAgICAvLyBpZiBpbiB0aGlzLm5lYXJlc3RfY2FjaGUgdGhlbiBzZXQgdG8gbmVhcmVzdFxuICAgIC8vIGVsc2UgZ2V0IG5lYXJlc3RcbiAgICBsZXQgbmVhcmVzdCA9IFtdO1xuICAgIGlmKHRoaXMubmVhcmVzdF9jYWNoZVtjdXJyX2tleV0pIHtcbiAgICAgIG5lYXJlc3QgPSB0aGlzLm5lYXJlc3RfY2FjaGVbY3Vycl9rZXldO1xuICAgICAgLy8gY29uc29sZS5sb2coXCJuZWFyZXN0IGZyb20gY2FjaGVcIik7XG4gICAgfWVsc2V7XG4gICAgICAvLyBza2lwIGZpbGVzIHdoZXJlIHBhdGggY29udGFpbnMgYW55IGV4Y2x1c2lvbnNcbiAgICAgIGZvcihsZXQgaiA9IDA7IGogPCB0aGlzLmZpbGVfZXhjbHVzaW9ucy5sZW5ndGg7IGorKykge1xuICAgICAgICBpZihjdXJyZW50X25vdGUucGF0aC5pbmRleE9mKHRoaXMuZmlsZV9leGNsdXNpb25zW2pdKSA+IC0xKSB7XG4gICAgICAgICAgdGhpcy5sb2dfZXhjbHVzaW9uKHRoaXMuZmlsZV9leGNsdXNpb25zW2pdKTtcbiAgICAgICAgICAvLyBicmVhayBvdXQgb2YgbG9vcCBhbmQgZmluaXNoIGhlcmVcbiAgICAgICAgICByZXR1cm4gXCJleGNsdWRlZFwiO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICAvLyBnZXQgYWxsIGVtYmVkZGluZ3NcbiAgICAgIC8vIGF3YWl0IHRoaXMuZ2V0X2FsbF9lbWJlZGRpbmdzKCk7XG4gICAgICAvLyB3cmFwIGdldCBhbGwgaW4gc2V0VGltZW91dCB0byBhbGxvdyBmb3IgVUkgdG8gdXBkYXRlXG4gICAgICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgdGhpcy5nZXRfYWxsX2VtYmVkZGluZ3MoKVxuICAgICAgfSwgMzAwMCk7XG4gICAgICAvLyBnZXQgZnJvbSBjYWNoZSBpZiBtdGltZSBpcyBzYW1lIGFuZCB2YWx1ZXMgYXJlIG5vdCBlbXB0eVxuICAgICAgaWYodGhpcy5zbWFydF92ZWNfbGl0ZS5tdGltZV9pc19jdXJyZW50KGN1cnJfa2V5LCBjdXJyZW50X25vdGUuc3RhdC5tdGltZSkpIHtcbiAgICAgICAgLy8gc2tpcHBpbmcgZ2V0IGZpbGUgZW1iZWRkaW5ncyBiZWNhdXNlIG5vdGhpbmcgaGFzIGNoYW5nZWRcbiAgICAgICAgLy8gY29uc29sZS5sb2coXCJmaW5kX25vdGVfY29ubmVjdGlvbnMgLSBza2lwcGluZyBmaWxlIChtdGltZSlcIik7XG4gICAgICB9ZWxzZXtcbiAgICAgICAgLy8gZ2V0IGZpbGUgZW1iZWRkaW5nc1xuICAgICAgICBhd2FpdCB0aGlzLmdldF9maWxlX2VtYmVkZGluZ3MoY3VycmVudF9ub3RlKTtcbiAgICAgIH1cbiAgICAgIC8vIGdldCBjdXJyZW50IG5vdGUgZW1iZWRkaW5nIHZlY3RvclxuICAgICAgY29uc3QgdmVjID0gdGhpcy5zbWFydF92ZWNfbGl0ZS5nZXRfdmVjKGN1cnJfa2V5KTtcbiAgICAgIGlmKCF2ZWMpIHtcbiAgICAgICAgcmV0dXJuIFwiRXJyb3IgZ2V0dGluZyBlbWJlZGRpbmdzIGZvcjogXCIrY3VycmVudF9ub3RlLnBhdGg7XG4gICAgICB9XG4gICAgICBcbiAgICAgIC8vIGNvbXB1dGUgY29zaW5lIHNpbWlsYXJpdHkgYmV0d2VlbiBjdXJyZW50IG5vdGUgYW5kIGFsbCBvdGhlciBub3RlcyB2aWEgZW1iZWRkaW5nc1xuICAgICAgbmVhcmVzdCA9IHRoaXMuc21hcnRfdmVjX2xpdGUubmVhcmVzdCh2ZWMsIHtcbiAgICAgICAgc2tpcF9rZXk6IGN1cnJfa2V5LFxuICAgICAgICBza2lwX3NlY3Rpb25zOiB0aGlzLnNldHRpbmdzLnNraXBfc2VjdGlvbnMsXG4gICAgICB9KTtcbiAgXG4gICAgICAvLyBzYXZlIHRvIHRoaXMubmVhcmVzdF9jYWNoZVxuICAgICAgdGhpcy5uZWFyZXN0X2NhY2hlW2N1cnJfa2V5XSA9IG5lYXJlc3Q7XG4gICAgfVxuXG4gICAgLy8gcmV0dXJuIGFycmF5IHNvcnRlZCBieSBjb3NpbmUgc2ltaWxhcml0eVxuICAgIHJldHVybiBuZWFyZXN0O1xuICB9XG4gIFxuICAvLyBjcmVhdGUgcmVuZGVyX2xvZyBvYmplY3Qgb2YgZXhsdXNpb25zIHdpdGggbnVtYmVyIG9mIHRpbWVzIHNraXBwZWQgYXMgdmFsdWVcbiAgbG9nX2V4Y2x1c2lvbihleGNsdXNpb24pIHtcbiAgICAvLyBpbmNyZW1lbnQgcmVuZGVyX2xvZyBmb3Igc2tpcHBlZCBmaWxlXG4gICAgdGhpcy5yZW5kZXJfbG9nLmV4Y2x1c2lvbnNfbG9nc1tleGNsdXNpb25dID0gKHRoaXMucmVuZGVyX2xvZy5leGNsdXNpb25zX2xvZ3NbZXhjbHVzaW9uXSB8fCAwKSArIDE7XG4gIH1cbiAgXG5cbiAgYmxvY2tfcGFyc2VyKG1hcmtkb3duLCBmaWxlX3BhdGgpe1xuICAgIC8vIGlmIHRoaXMuc2V0dGluZ3Muc2tpcF9zZWN0aW9ucyBpcyB0cnVlIHRoZW4gcmV0dXJuIGVtcHR5IGFycmF5XG4gICAgaWYodGhpcy5zZXR0aW5ncy5za2lwX3NlY3Rpb25zKSB7XG4gICAgICByZXR1cm4gW107XG4gICAgfVxuICAgIC8vIHNwbGl0IHRoZSBtYXJrZG93biBpbnRvIGxpbmVzXG4gICAgY29uc3QgbGluZXMgPSBtYXJrZG93bi5zcGxpdCgnXFxuJyk7XG4gICAgLy8gaW5pdGlhbGl6ZSB0aGUgYmxvY2tzIGFycmF5XG4gICAgbGV0IGJsb2NrcyA9IFtdO1xuICAgIC8vIGN1cnJlbnQgaGVhZGVycyBhcnJheVxuICAgIGxldCBjdXJyZW50SGVhZGVycyA9IFtdO1xuICAgIC8vIHJlbW92ZSAubWQgZmlsZSBleHRlbnNpb24gYW5kIGNvbnZlcnQgZmlsZV9wYXRoIHRvIGJyZWFkY3J1bWIgZm9ybWF0dGluZ1xuICAgIGNvbnN0IGZpbGVfYnJlYWRjcnVtYnMgPSBmaWxlX3BhdGgucmVwbGFjZSgnLm1kJywgJycpLnJlcGxhY2UoL1xcLy9nLCAnID4gJyk7XG4gICAgLy8gaW5pdGlhbGl6ZSB0aGUgYmxvY2sgc3RyaW5nXG4gICAgbGV0IGJsb2NrID0gJyc7XG4gICAgbGV0IGJsb2NrX2hlYWRpbmdzID0gJyc7XG4gICAgbGV0IGJsb2NrX3BhdGggPSBmaWxlX3BhdGg7XG5cbiAgICBsZXQgbGFzdF9oZWFkaW5nX2xpbmUgPSAwO1xuICAgIGxldCBpID0gMDtcbiAgICBsZXQgYmxvY2tfaGVhZGluZ3NfbGlzdCA9IFtdO1xuICAgIC8vIGxvb3AgdGhyb3VnaCB0aGUgbGluZXNcbiAgICBmb3IgKGkgPSAwOyBpIDwgbGluZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgIC8vIGdldCB0aGUgbGluZVxuICAgICAgY29uc3QgbGluZSA9IGxpbmVzW2ldO1xuICAgICAgLy8gaWYgbGluZSBkb2VzIG5vdCBzdGFydCB3aXRoICNcbiAgICAgIC8vIG9yIGlmIGxpbmUgc3RhcnRzIHdpdGggIyBhbmQgc2Vjb25kIGNoYXJhY3RlciBpcyBhIHdvcmQgb3IgbnVtYmVyIGluZGljYXRpbmcgYSBcInRhZ1wiXG4gICAgICAvLyB0aGVuIGFkZCB0byBibG9ja1xuICAgICAgaWYgKCFsaW5lLnN0YXJ0c1dpdGgoJyMnKSB8fCAoWycjJywnICddLmluZGV4T2YobGluZVsxXSkgPCAwKSl7XG4gICAgICAgIC8vIHNraXAgaWYgbGluZSBpcyBlbXB0eVxuICAgICAgICBpZihsaW5lID09PSAnJykgY29udGludWU7XG4gICAgICAgIC8vIHNraXAgaWYgbGluZSBpcyBlbXB0eSBidWxsZXQgb3IgY2hlY2tib3hcbiAgICAgICAgaWYoWyctICcsICctIFsgXSAnXS5pbmRleE9mKGxpbmUpID4gLTEpIGNvbnRpbnVlO1xuICAgICAgICAvLyBpZiBjdXJyZW50SGVhZGVycyBpcyBlbXB0eSBza2lwIChvbmx5IGJsb2NrcyB3aXRoIGhlYWRlcnMsIG90aGVyd2lzZSBibG9jay5wYXRoIGNvbmZsaWN0cyB3aXRoIGZpbGUucGF0aClcbiAgICAgICAgaWYoY3VycmVudEhlYWRlcnMubGVuZ3RoID09PSAwKSBjb250aW51ZTtcbiAgICAgICAgLy8gYWRkIGxpbmUgdG8gYmxvY2tcbiAgICAgICAgYmxvY2sgKz0gXCJcXG5cIiArIGxpbmU7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgICAgLyoqXG4gICAgICAgKiBCRUdJTiBIZWFkaW5nIHBhcnNpbmdcbiAgICAgICAqIC0gbGlrZWx5IGEgaGVhZGluZyBpZiBtYWRlIGl0IHRoaXMgZmFyXG4gICAgICAgKi9cbiAgICAgIGxhc3RfaGVhZGluZ19saW5lID0gaTtcbiAgICAgIC8vIHB1c2ggdGhlIGN1cnJlbnQgYmxvY2sgdG8gdGhlIGJsb2NrcyBhcnJheSB1bmxlc3MgbGFzdCBsaW5lIHdhcyBhIGFsc28gYSBoZWFkZXJcbiAgICAgIGlmKGkgPiAwICYmIChsYXN0X2hlYWRpbmdfbGluZSAhPT0gKGktMSkpICYmIChibG9jay5pbmRleE9mKFwiXFxuXCIpID4gLTEpICYmIHRoaXMudmFsaWRhdGVfaGVhZGluZ3MoYmxvY2tfaGVhZGluZ3MpKSB7XG4gICAgICAgIG91dHB1dF9ibG9jaygpO1xuICAgICAgfVxuICAgICAgLy8gZ2V0IHRoZSBoZWFkZXIgbGV2ZWxcbiAgICAgIGNvbnN0IGxldmVsID0gbGluZS5zcGxpdCgnIycpLmxlbmd0aCAtIDE7XG4gICAgICAvLyByZW1vdmUgYW55IGhlYWRlcnMgZnJvbSB0aGUgY3VycmVudCBoZWFkZXJzIGFycmF5IHRoYXQgYXJlIGhpZ2hlciB0aGFuIHRoZSBjdXJyZW50IGhlYWRlciBsZXZlbFxuICAgICAgY3VycmVudEhlYWRlcnMgPSBjdXJyZW50SGVhZGVycy5maWx0ZXIoaGVhZGVyID0+IGhlYWRlci5sZXZlbCA8IGxldmVsKTtcbiAgICAgIC8vIGFkZCBoZWFkZXIgYW5kIGxldmVsIHRvIGN1cnJlbnQgaGVhZGVycyBhcnJheVxuICAgICAgLy8gdHJpbSB0aGUgaGVhZGVyIHRvIHJlbW92ZSBcIiNcIiBhbmQgYW55IHRyYWlsaW5nIHNwYWNlc1xuICAgICAgY3VycmVudEhlYWRlcnMucHVzaCh7aGVhZGVyOiBsaW5lLnJlcGxhY2UoLyMvZywgJycpLnRyaW0oKSwgbGV2ZWw6IGxldmVsfSk7XG4gICAgICAvLyBpbml0aWFsaXplIHRoZSBibG9jayBicmVhZGNydW1icyB3aXRoIGZpbGUucGF0aCB0aGUgY3VycmVudCBoZWFkZXJzXG4gICAgICBibG9jayA9IGZpbGVfYnJlYWRjcnVtYnM7XG4gICAgICBibG9jayArPSBcIjogXCIgKyBjdXJyZW50SGVhZGVycy5tYXAoaGVhZGVyID0+IGhlYWRlci5oZWFkZXIpLmpvaW4oJyA+ICcpO1xuICAgICAgYmxvY2tfaGVhZGluZ3MgPSBcIiNcIitjdXJyZW50SGVhZGVycy5tYXAoaGVhZGVyID0+IGhlYWRlci5oZWFkZXIpLmpvaW4oJyMnKTtcbiAgICAgIC8vIGlmIGJsb2NrX2hlYWRpbmdzIGlzIGFscmVhZHkgaW4gYmxvY2tfaGVhZGluZ3NfbGlzdCB0aGVuIGFkZCBhIG51bWJlciB0byB0aGUgZW5kXG4gICAgICBpZihibG9ja19oZWFkaW5nc19saXN0LmluZGV4T2YoYmxvY2tfaGVhZGluZ3MpID4gLTEpIHtcbiAgICAgICAgbGV0IGNvdW50ID0gMTtcbiAgICAgICAgd2hpbGUoYmxvY2tfaGVhZGluZ3NfbGlzdC5pbmRleE9mKGAke2Jsb2NrX2hlYWRpbmdzfXske2NvdW50fX1gKSA+IC0xKSB7XG4gICAgICAgICAgY291bnQrKztcbiAgICAgICAgfVxuICAgICAgICBibG9ja19oZWFkaW5ncyA9IGAke2Jsb2NrX2hlYWRpbmdzfXske2NvdW50fX1gO1xuICAgICAgfVxuICAgICAgYmxvY2tfaGVhZGluZ3NfbGlzdC5wdXNoKGJsb2NrX2hlYWRpbmdzKTtcbiAgICAgIGJsb2NrX3BhdGggPSBmaWxlX3BhdGggKyBibG9ja19oZWFkaW5ncztcbiAgICB9XG4gICAgLy8gaGFuZGxlIHJlbWFpbmluZyBhZnRlciBsb29wXG4gICAgaWYoKGxhc3RfaGVhZGluZ19saW5lICE9PSAoaS0xKSkgJiYgKGJsb2NrLmluZGV4T2YoXCJcXG5cIikgPiAtMSkgJiYgdGhpcy52YWxpZGF0ZV9oZWFkaW5ncyhibG9ja19oZWFkaW5ncykpIG91dHB1dF9ibG9jaygpO1xuICAgIC8vIHJlbW92ZSBhbnkgYmxvY2tzIHRoYXQgYXJlIHRvbyBzaG9ydCAobGVuZ3RoIDwgNTApXG4gICAgYmxvY2tzID0gYmxvY2tzLmZpbHRlcihiID0+IGIubGVuZ3RoID4gNTApO1xuICAgIC8vIGNvbnNvbGUubG9nKGJsb2Nrcyk7XG4gICAgLy8gcmV0dXJuIHRoZSBibG9ja3MgYXJyYXlcbiAgICByZXR1cm4gYmxvY2tzO1xuXG4gICAgZnVuY3Rpb24gb3V0cHV0X2Jsb2NrKCkge1xuICAgICAgLy8gYnJlYWRjcnVtYnMgbGVuZ3RoIChmaXJzdCBsaW5lIG9mIGJsb2NrKVxuICAgICAgY29uc3QgYnJlYWRjcnVtYnNfbGVuZ3RoID0gYmxvY2suaW5kZXhPZihcIlxcblwiKSArIDE7XG4gICAgICBjb25zdCBibG9ja19sZW5ndGggPSBibG9jay5sZW5ndGggLSBicmVhZGNydW1ic19sZW5ndGg7XG4gICAgICAvLyB0cmltIGJsb2NrIHRvIG1heCBsZW5ndGhcbiAgICAgIGlmIChibG9jay5sZW5ndGggPiBNQVhfRU1CRURfU1RSSU5HX0xFTkdUSCkge1xuICAgICAgICBibG9jayA9IGJsb2NrLnN1YnN0cmluZygwLCBNQVhfRU1CRURfU1RSSU5HX0xFTkdUSCk7XG4gICAgICB9XG4gICAgICBibG9ja3MucHVzaCh7IHRleHQ6IGJsb2NrLnRyaW0oKSwgcGF0aDogYmxvY2tfcGF0aCwgbGVuZ3RoOiBibG9ja19sZW5ndGggfSk7XG4gICAgfVxuICB9XG4gIC8vIHJldmVyc2UtcmV0cmlldmUgYmxvY2sgZ2l2ZW4gcGF0aFxuICBhc3luYyBibG9ja19yZXRyaWV2ZXIocGF0aCwgbGltaXRzPXt9KSB7XG4gICAgbGltaXRzID0ge1xuICAgICAgbGluZXM6IG51bGwsXG4gICAgICBjaGFyc19wZXJfbGluZTogbnVsbCxcbiAgICAgIG1heF9jaGFyczogbnVsbCxcbiAgICAgIC4uLmxpbWl0c1xuICAgIH1cbiAgICAvLyByZXR1cm4gaWYgbm8gIyBpbiBwYXRoXG4gICAgaWYgKHBhdGguaW5kZXhPZignIycpIDwgMCkge1xuICAgICAgY29uc29sZS5sb2coXCJub3QgYSBibG9jayBwYXRoOiBcIitwYXRoKTtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgbGV0IGJsb2NrID0gW107XG4gICAgbGV0IGJsb2NrX2hlYWRpbmdzID0gcGF0aC5zcGxpdCgnIycpLnNsaWNlKDEpO1xuICAgIC8vIGlmIHBhdGggZW5kcyB3aXRoIG51bWJlciBpbiBjdXJseSBicmFjZXNcbiAgICBsZXQgaGVhZGluZ19vY2N1cnJlbmNlID0gMDtcbiAgICBpZihibG9ja19oZWFkaW5nc1tibG9ja19oZWFkaW5ncy5sZW5ndGgtMV0uaW5kZXhPZigneycpID4gLTEpIHtcbiAgICAgIC8vIGdldCB0aGUgb2NjdXJyZW5jZSBudW1iZXJcbiAgICAgIGhlYWRpbmdfb2NjdXJyZW5jZSA9IHBhcnNlSW50KGJsb2NrX2hlYWRpbmdzW2Jsb2NrX2hlYWRpbmdzLmxlbmd0aC0xXS5zcGxpdCgneycpWzFdLnJlcGxhY2UoJ30nLCAnJykpO1xuICAgICAgLy8gcmVtb3ZlIHRoZSBvY2N1cnJlbmNlIGZyb20gdGhlIGxhc3QgaGVhZGluZ1xuICAgICAgYmxvY2tfaGVhZGluZ3NbYmxvY2tfaGVhZGluZ3MubGVuZ3RoLTFdID0gYmxvY2tfaGVhZGluZ3NbYmxvY2tfaGVhZGluZ3MubGVuZ3RoLTFdLnNwbGl0KCd7JylbMF07XG4gICAgfVxuICAgIGxldCBjdXJyZW50SGVhZGVycyA9IFtdO1xuICAgIGxldCBvY2N1cnJlbmNlX2NvdW50ID0gMDtcbiAgICBsZXQgYmVnaW5fbGluZSA9IDA7XG4gICAgbGV0IGkgPSAwO1xuICAgIC8vIGdldCBmaWxlIHBhdGggZnJvbSBwYXRoXG4gICAgY29uc3QgZmlsZV9wYXRoID0gcGF0aC5zcGxpdCgnIycpWzBdO1xuICAgIC8vIGdldCBmaWxlXG4gICAgY29uc3QgZmlsZSA9IHRoaXMuYXBwLnZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aChmaWxlX3BhdGgpO1xuICAgIGlmKCEoZmlsZSBpbnN0YW5jZW9mIE9ic2lkaWFuLlRGaWxlKSkge1xuICAgICAgY29uc29sZS5sb2coXCJub3QgYSBmaWxlOiBcIitmaWxlX3BhdGgpO1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICAvLyBnZXQgZmlsZSBjb250ZW50c1xuICAgIGNvbnN0IGZpbGVfY29udGVudHMgPSBhd2FpdCB0aGlzLmFwcC52YXVsdC5jYWNoZWRSZWFkKGZpbGUpO1xuICAgIC8vIHNwbGl0IHRoZSBmaWxlIGNvbnRlbnRzIGludG8gbGluZXNcbiAgICBjb25zdCBsaW5lcyA9IGZpbGVfY29udGVudHMuc3BsaXQoJ1xcbicpO1xuICAgIC8vIGxvb3AgdGhyb3VnaCB0aGUgbGluZXNcbiAgICBsZXQgaXNfY29kZSA9IGZhbHNlO1xuICAgIGZvciAoaSA9IDA7IGkgPCBsaW5lcy5sZW5ndGg7IGkrKykge1xuICAgICAgLy8gZ2V0IHRoZSBsaW5lXG4gICAgICBjb25zdCBsaW5lID0gbGluZXNbaV07XG4gICAgICAvLyBpZiBsaW5lIGJlZ2lucyB3aXRoIHRocmVlIGJhY2t0aWNrcyB0aGVuIHRvZ2dsZSBpc19jb2RlXG4gICAgICBpZihsaW5lLmluZGV4T2YoJ2BgYCcpID09PSAwKSB7XG4gICAgICAgIGlzX2NvZGUgPSAhaXNfY29kZTtcbiAgICAgIH1cbiAgICAgIC8vIGlmIGlzX2NvZGUgaXMgdHJ1ZSB0aGVuIGFkZCBsaW5lIHdpdGggcHJlY2VkaW5nIHRhYiBhbmQgY29udGludWVcbiAgICAgIGlmKGlzX2NvZGUpIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgICAvLyBza2lwIGlmIGxpbmUgaXMgZW1wdHkgYnVsbGV0IG9yIGNoZWNrYm94XG4gICAgICBpZihbJy0gJywgJy0gWyBdICddLmluZGV4T2YobGluZSkgPiAtMSkgY29udGludWU7XG4gICAgICAvLyBpZiBsaW5lIGRvZXMgbm90IHN0YXJ0IHdpdGggI1xuICAgICAgLy8gb3IgaWYgbGluZSBzdGFydHMgd2l0aCAjIGFuZCBzZWNvbmQgY2hhcmFjdGVyIGlzIGEgd29yZCBvciBudW1iZXIgaW5kaWNhdGluZyBhIFwidGFnXCJcbiAgICAgIC8vIHRoZW4gY29udGludWUgdG8gbmV4dCBsaW5lXG4gICAgICBpZiAoIWxpbmUuc3RhcnRzV2l0aCgnIycpIHx8IChbJyMnLCcgJ10uaW5kZXhPZihsaW5lWzFdKSA8IDApKXtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgICAvKipcbiAgICAgICAqIEJFR0lOIEhlYWRpbmcgcGFyc2luZ1xuICAgICAgICogLSBsaWtlbHkgYSBoZWFkaW5nIGlmIG1hZGUgaXQgdGhpcyBmYXJcbiAgICAgICAqL1xuICAgICAgLy8gZ2V0IHRoZSBoZWFkaW5nIHRleHRcbiAgICAgIGNvbnN0IGhlYWRpbmdfdGV4dCA9IGxpbmUucmVwbGFjZSgvIy9nLCAnJykudHJpbSgpO1xuICAgICAgLy8gY29udGludWUgaWYgaGVhZGluZyB0ZXh0IGlzIG5vdCBpbiBibG9ja19oZWFkaW5nc1xuICAgICAgY29uc3QgaGVhZGluZ19pbmRleCA9IGJsb2NrX2hlYWRpbmdzLmluZGV4T2YoaGVhZGluZ190ZXh0KTtcbiAgICAgIGlmIChoZWFkaW5nX2luZGV4IDwgMCkgY29udGludWU7XG4gICAgICAvLyBpZiBjdXJyZW50SGVhZGVycy5sZW5ndGggIT09IGhlYWRpbmdfaW5kZXggdGhlbiB3ZSBoYXZlIGEgbWlzbWF0Y2hcbiAgICAgIGlmIChjdXJyZW50SGVhZGVycy5sZW5ndGggIT09IGhlYWRpbmdfaW5kZXgpIGNvbnRpbnVlO1xuICAgICAgLy8gcHVzaCB0aGUgaGVhZGluZyB0ZXh0IHRvIHRoZSBjdXJyZW50SGVhZGVycyBhcnJheVxuICAgICAgY3VycmVudEhlYWRlcnMucHVzaChoZWFkaW5nX3RleHQpO1xuICAgICAgLy8gaWYgY3VycmVudEhlYWRlcnMubGVuZ3RoID09PSBibG9ja19oZWFkaW5ncy5sZW5ndGggdGhlbiB3ZSBoYXZlIGEgbWF0Y2hcbiAgICAgIGlmIChjdXJyZW50SGVhZGVycy5sZW5ndGggPT09IGJsb2NrX2hlYWRpbmdzLmxlbmd0aCkge1xuICAgICAgICAvLyBpZiBoZWFkaW5nX29jY3VycmVuY2UgaXMgZGVmaW5lZCB0aGVuIGluY3JlbWVudCBvY2N1cnJlbmNlX2NvdW50XG4gICAgICAgIGlmKGhlYWRpbmdfb2NjdXJyZW5jZSA9PT0gMCkge1xuICAgICAgICAgIC8vIHNldCBiZWdpbl9saW5lIHRvIGkgKyAxXG4gICAgICAgICAgYmVnaW5fbGluZSA9IGkgKyAxO1xuICAgICAgICAgIGJyZWFrOyAvLyBicmVhayBvdXQgb2YgbG9vcFxuICAgICAgICB9XG4gICAgICAgIC8vIGlmIG9jY3VycmVuY2VfY291bnQgIT09IGhlYWRpbmdfb2NjdXJyZW5jZSB0aGVuIGNvbnRpbnVlXG4gICAgICAgIGlmKG9jY3VycmVuY2VfY291bnQgPT09IGhlYWRpbmdfb2NjdXJyZW5jZSl7XG4gICAgICAgICAgYmVnaW5fbGluZSA9IGkgKyAxO1xuICAgICAgICAgIGJyZWFrOyAvLyBicmVhayBvdXQgb2YgbG9vcFxuICAgICAgICB9XG4gICAgICAgIG9jY3VycmVuY2VfY291bnQrKztcbiAgICAgICAgLy8gcmVzZXQgY3VycmVudEhlYWRlcnNcbiAgICAgICAgY3VycmVudEhlYWRlcnMucG9wKCk7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgIH1cbiAgICAvLyBpZiBubyBiZWdpbl9saW5lIHRoZW4gcmV0dXJuIGZhbHNlXG4gICAgaWYgKGJlZ2luX2xpbmUgPT09IDApIHJldHVybiBmYWxzZTtcbiAgICAvLyBpdGVyYXRlIHRocm91Z2ggbGluZXMgc3RhcnRpbmcgYXQgYmVnaW5fbGluZVxuICAgIGlzX2NvZGUgPSBmYWxzZTtcbiAgICAvLyBjaGFyYWN0ZXIgYWNjdW11bGF0b3JcbiAgICBsZXQgY2hhcl9jb3VudCA9IDA7XG4gICAgZm9yIChpID0gYmVnaW5fbGluZTsgaSA8IGxpbmVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBpZigodHlwZW9mIGxpbmVfbGltaXQgPT09IFwibnVtYmVyXCIpICYmIChibG9jay5sZW5ndGggPiBsaW5lX2xpbWl0KSl7XG4gICAgICAgIGJsb2NrLnB1c2goXCIuLi5cIik7XG4gICAgICAgIGJyZWFrOyAvLyBlbmRzIHdoZW4gbGluZV9saW1pdCBpcyByZWFjaGVkXG4gICAgICB9XG4gICAgICBsZXQgbGluZSA9IGxpbmVzW2ldO1xuICAgICAgaWYgKChsaW5lLmluZGV4T2YoJyMnKSA9PT0gMCkgJiYgKFsnIycsJyAnXS5pbmRleE9mKGxpbmVbMV0pICE9PSAtMSkpe1xuICAgICAgICBicmVhazsgLy8gZW5kcyB3aGVuIGVuY291bnRlcmluZyBuZXh0IGhlYWRlclxuICAgICAgfVxuICAgICAgLy8gREVQUkVDQVRFRDogc2hvdWxkIGJlIGhhbmRsZWQgYnkgbmV3X2xpbmUrY2hhcl9jb3VudCBjaGVjayAoaGFwcGVucyBpbiBwcmV2aW91cyBpdGVyYXRpb24pXG4gICAgICAvLyBpZiBjaGFyX2NvdW50IGlzIGdyZWF0ZXIgdGhhbiBsaW1pdC5tYXhfY2hhcnMsIHNraXBcbiAgICAgIGlmIChsaW1pdHMubWF4X2NoYXJzICYmIGNoYXJfY291bnQgPiBsaW1pdHMubWF4X2NoYXJzKSB7XG4gICAgICAgIGJsb2NrLnB1c2goXCIuLi5cIik7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgLy8gaWYgbmV3X2xpbmUgKyBjaGFyX2NvdW50IGlzIGdyZWF0ZXIgdGhhbiBsaW1pdC5tYXhfY2hhcnMsIHNraXBcbiAgICAgIGlmIChsaW1pdHMubWF4X2NoYXJzICYmICgobGluZS5sZW5ndGggKyBjaGFyX2NvdW50KSA+IGxpbWl0cy5tYXhfY2hhcnMpKSB7XG4gICAgICAgIGNvbnN0IG1heF9uZXdfY2hhcnMgPSBsaW1pdHMubWF4X2NoYXJzIC0gY2hhcl9jb3VudDtcbiAgICAgICAgbGluZSA9IGxpbmUuc2xpY2UoMCwgbWF4X25ld19jaGFycykgKyBcIi4uLlwiO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIC8vIHZhbGlkYXRlL2Zvcm1hdFxuICAgICAgLy8gaWYgbGluZSBpcyBlbXB0eSwgc2tpcFxuICAgICAgaWYgKGxpbmUubGVuZ3RoID09PSAwKSBjb250aW51ZTtcbiAgICAgIC8vIGxpbWl0IGxlbmd0aCBvZiBsaW5lIHRvIE4gY2hhcmFjdGVyc1xuICAgICAgaWYgKGxpbWl0cy5jaGFyc19wZXJfbGluZSAmJiBsaW5lLmxlbmd0aCA+IGxpbWl0cy5jaGFyc19wZXJfbGluZSkge1xuICAgICAgICBsaW5lID0gbGluZS5zbGljZSgwLCBsaW1pdHMuY2hhcnNfcGVyX2xpbmUpICsgXCIuLi5cIjtcbiAgICAgIH1cbiAgICAgIC8vIGlmIGxpbmUgaXMgYSBjb2RlIGJsb2NrLCBza2lwXG4gICAgICBpZiAobGluZS5zdGFydHNXaXRoKFwiYGBgXCIpKSB7XG4gICAgICAgIGlzX2NvZGUgPSAhaXNfY29kZTtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgICBpZiAoaXNfY29kZSl7XG4gICAgICAgIC8vIGFkZCB0YWIgdG8gYmVnaW5uaW5nIG9mIGxpbmVcbiAgICAgICAgbGluZSA9IFwiXFx0XCIrbGluZTtcbiAgICAgIH1cbiAgICAgIC8vIGFkZCBsaW5lIHRvIGJsb2NrXG4gICAgICBibG9jay5wdXNoKGxpbmUpO1xuICAgICAgLy8gaW5jcmVtZW50IGNoYXJfY291bnRcbiAgICAgIGNoYXJfY291bnQgKz0gbGluZS5sZW5ndGg7XG4gICAgfVxuICAgIC8vIGNsb3NlIGNvZGUgYmxvY2sgaWYgb3BlblxuICAgIGlmIChpc19jb2RlKSB7XG4gICAgICBibG9jay5wdXNoKFwiYGBgXCIpO1xuICAgIH1cbiAgICByZXR1cm4gYmxvY2suam9pbihcIlxcblwiKS50cmltKCk7XG4gIH1cblxuICAvLyByZXRyaWV2ZSBhIGZpbGUgZnJvbSB0aGUgdmF1bHRcbiAgYXN5bmMgZmlsZV9yZXRyaWV2ZXIobGluaywgbGltaXRzPXt9KSB7XG4gICAgbGltaXRzID0ge1xuICAgICAgbGluZXM6IG51bGwsXG4gICAgICBtYXhfY2hhcnM6IG51bGwsXG4gICAgICBjaGFyc19wZXJfbGluZTogbnVsbCxcbiAgICAgIC4uLmxpbWl0c1xuICAgIH07XG4gICAgY29uc3QgdGhpc19maWxlID0gdGhpcy5hcHAudmF1bHQuZ2V0QWJzdHJhY3RGaWxlQnlQYXRoKGxpbmspO1xuICAgIC8vIGlmIGZpbGUgaXMgbm90IGZvdW5kLCBza2lwXG4gICAgaWYgKCEodGhpc19maWxlIGluc3RhbmNlb2YgT2JzaWRpYW4uVEFic3RyYWN0RmlsZSkpIHJldHVybiBmYWxzZTtcbiAgICAvLyB1c2UgY2FjaGVkUmVhZCB0byBnZXQgdGhlIGZpcnN0IDEwIGxpbmVzIG9mIHRoZSBmaWxlXG4gICAgY29uc3QgZmlsZV9jb250ZW50ID0gYXdhaXQgdGhpcy5hcHAudmF1bHQuY2FjaGVkUmVhZCh0aGlzX2ZpbGUpO1xuICAgIGNvbnN0IGZpbGVfbGluZXMgPSBmaWxlX2NvbnRlbnQuc3BsaXQoXCJcXG5cIik7XG4gICAgbGV0IGZpcnN0X3Rlbl9saW5lcyA9IFtdO1xuICAgIGxldCBpc19jb2RlID0gZmFsc2U7XG4gICAgbGV0IGNoYXJfYWNjdW0gPSAwO1xuICAgIGNvbnN0IGxpbmVfbGltaXQgPSBsaW1pdHMubGluZXMgfHwgZmlsZV9saW5lcy5sZW5ndGg7XG4gICAgZm9yIChsZXQgaSA9IDA7IGZpcnN0X3Rlbl9saW5lcy5sZW5ndGggPCBsaW5lX2xpbWl0OyBpKyspIHtcbiAgICAgIGxldCBsaW5lID0gZmlsZV9saW5lc1tpXTtcbiAgICAgIC8vIGlmIGxpbmUgaXMgdW5kZWZpbmVkLCBicmVha1xuICAgICAgaWYgKHR5cGVvZiBsaW5lID09PSAndW5kZWZpbmVkJylcbiAgICAgICAgYnJlYWs7XG4gICAgICAvLyBpZiBsaW5lIGlzIGVtcHR5LCBza2lwXG4gICAgICBpZiAobGluZS5sZW5ndGggPT09IDApXG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgLy8gbGltaXQgbGVuZ3RoIG9mIGxpbmUgdG8gTiBjaGFyYWN0ZXJzXG4gICAgICBpZiAobGltaXRzLmNoYXJzX3Blcl9saW5lICYmIGxpbmUubGVuZ3RoID4gbGltaXRzLmNoYXJzX3Blcl9saW5lKSB7XG4gICAgICAgIGxpbmUgPSBsaW5lLnNsaWNlKDAsIGxpbWl0cy5jaGFyc19wZXJfbGluZSkgKyBcIi4uLlwiO1xuICAgICAgfVxuICAgICAgLy8gaWYgbGluZSBpcyBcIi0tLVwiLCBza2lwXG4gICAgICBpZiAobGluZSA9PT0gXCItLS1cIilcbiAgICAgICAgY29udGludWU7XG4gICAgICAvLyBza2lwIGlmIGxpbmUgaXMgZW1wdHkgYnVsbGV0IG9yIGNoZWNrYm94XG4gICAgICBpZiAoWyctICcsICctIFsgXSAnXS5pbmRleE9mKGxpbmUpID4gLTEpXG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgLy8gaWYgbGluZSBpcyBhIGNvZGUgYmxvY2ssIHNraXBcbiAgICAgIGlmIChsaW5lLmluZGV4T2YoXCJgYGBcIikgPT09IDApIHtcbiAgICAgICAgaXNfY29kZSA9ICFpc19jb2RlO1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIC8vIGlmIGNoYXJfYWNjdW0gaXMgZ3JlYXRlciB0aGFuIGxpbWl0Lm1heF9jaGFycywgc2tpcFxuICAgICAgaWYgKGxpbWl0cy5tYXhfY2hhcnMgJiYgY2hhcl9hY2N1bSA+IGxpbWl0cy5tYXhfY2hhcnMpIHtcbiAgICAgICAgZmlyc3RfdGVuX2xpbmVzLnB1c2goXCIuLi5cIik7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgaWYgKGlzX2NvZGUpIHtcbiAgICAgICAgLy8gaWYgaXMgY29kZSwgYWRkIHRhYiB0byBiZWdpbm5pbmcgb2YgbGluZVxuICAgICAgICBsaW5lID0gXCJcXHRcIiArIGxpbmU7XG4gICAgICB9XG4gICAgICAvLyBpZiBsaW5lIGlzIGEgaGVhZGluZ1xuICAgICAgaWYgKGxpbmVfaXNfaGVhZGluZyhsaW5lKSkge1xuICAgICAgICAvLyBsb29rIGF0IGxhc3QgbGluZSBpbiBmaXJzdF90ZW5fbGluZXMgdG8gc2VlIGlmIGl0IGlzIGEgaGVhZGluZ1xuICAgICAgICAvLyBub3RlOiB1c2VzIGxhc3QgaW4gZmlyc3RfdGVuX2xpbmVzLCBpbnN0ZWFkIG9mIGxvb2sgYWhlYWQgaW4gZmlsZV9saW5lcywgYmVjYXVzZS4uXG4gICAgICAgIC8vIC4uLm5leHQgbGluZSBtYXkgYmUgZXhjbHVkZWQgZnJvbSBmaXJzdF90ZW5fbGluZXMgYnkgcHJldmlvdXMgaWYgc3RhdGVtZW50c1xuICAgICAgICBpZiAoKGZpcnN0X3Rlbl9saW5lcy5sZW5ndGggPiAwKSAmJiBsaW5lX2lzX2hlYWRpbmcoZmlyc3RfdGVuX2xpbmVzW2ZpcnN0X3Rlbl9saW5lcy5sZW5ndGggLSAxXSkpIHtcbiAgICAgICAgICAvLyBpZiBsYXN0IGxpbmUgaXMgYSBoZWFkaW5nLCByZW1vdmUgaXRcbiAgICAgICAgICBmaXJzdF90ZW5fbGluZXMucG9wKCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIC8vIGFkZCBsaW5lIHRvIGZpcnN0X3Rlbl9saW5lc1xuICAgICAgZmlyc3RfdGVuX2xpbmVzLnB1c2gobGluZSk7XG4gICAgICAvLyBpbmNyZW1lbnQgY2hhcl9hY2N1bVxuICAgICAgY2hhcl9hY2N1bSArPSBsaW5lLmxlbmd0aDtcbiAgICB9XG4gICAgLy8gZm9yIGVhY2ggbGluZSBpbiBmaXJzdF90ZW5fbGluZXMsIGFwcGx5IHZpZXctc3BlY2lmaWMgZm9ybWF0dGluZ1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZmlyc3RfdGVuX2xpbmVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAvLyBpZiBsaW5lIGlzIGEgaGVhZGluZ1xuICAgICAgaWYgKGxpbmVfaXNfaGVhZGluZyhmaXJzdF90ZW5fbGluZXNbaV0pKSB7XG4gICAgICAgIC8vIGlmIHRoaXMgaXMgdGhlIGxhc3QgbGluZSBpbiBmaXJzdF90ZW5fbGluZXNcbiAgICAgICAgaWYgKGkgPT09IGZpcnN0X3Rlbl9saW5lcy5sZW5ndGggLSAxKSB7XG4gICAgICAgICAgLy8gcmVtb3ZlIHRoZSBsYXN0IGxpbmUgaWYgaXQgaXMgYSBoZWFkaW5nXG4gICAgICAgICAgZmlyc3RfdGVuX2xpbmVzLnBvcCgpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICAgIC8vIHJlbW92ZSBoZWFkaW5nIHN5bnRheCB0byBpbXByb3ZlIHJlYWRhYmlsaXR5IGluIHNtYWxsIHNwYWNlXG4gICAgICAgIGZpcnN0X3Rlbl9saW5lc1tpXSA9IGZpcnN0X3Rlbl9saW5lc1tpXS5yZXBsYWNlKC8jKy8sIFwiXCIpO1xuICAgICAgICBmaXJzdF90ZW5fbGluZXNbaV0gPSBgXFxuJHtmaXJzdF90ZW5fbGluZXNbaV19OmA7XG4gICAgICB9XG4gICAgfVxuICAgIC8vIGpvaW4gZmlyc3QgdGVuIGxpbmVzIGludG8gc3RyaW5nXG4gICAgZmlyc3RfdGVuX2xpbmVzID0gZmlyc3RfdGVuX2xpbmVzLmpvaW4oXCJcXG5cIik7XG4gICAgcmV0dXJuIGZpcnN0X3Rlbl9saW5lcztcbiAgfVxuXG4gIC8vIGl0ZXJhdGUgdGhyb3VnaCBibG9ja3MgYW5kIHNraXAgaWYgYmxvY2tfaGVhZGluZ3MgY29udGFpbnMgdGhpcy5oZWFkZXJfZXhjbHVzaW9uc1xuICB2YWxpZGF0ZV9oZWFkaW5ncyhibG9ja19oZWFkaW5ncykge1xuICAgIGxldCB2YWxpZCA9IHRydWU7XG4gICAgaWYgKHRoaXMuaGVhZGVyX2V4Y2x1c2lvbnMubGVuZ3RoID4gMCkge1xuICAgICAgZm9yIChsZXQgayA9IDA7IGsgPCB0aGlzLmhlYWRlcl9leGNsdXNpb25zLmxlbmd0aDsgaysrKSB7XG4gICAgICAgIGlmIChibG9ja19oZWFkaW5ncy5pbmRleE9mKHRoaXMuaGVhZGVyX2V4Y2x1c2lvbnNba10pID4gLTEpIHtcbiAgICAgICAgICB2YWxpZCA9IGZhbHNlO1xuICAgICAgICAgIHRoaXMubG9nX2V4Y2x1c2lvbihcImhlYWRpbmc6IFwiK3RoaXMuaGVhZGVyX2V4Y2x1c2lvbnNba10pO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB2YWxpZDtcbiAgfVxuICAvLyByZW5kZXIgXCJTbWFydCBDb25uZWN0aW9uc1wiIHRleHQgZml4ZWQgaW4gdGhlIGJvdHRvbSByaWdodCBjb3JuZXJcbiAgcmVuZGVyX2JyYW5kKGNvbnRhaW5lciwgbG9jYXRpb249XCJkZWZhdWx0XCIpIHtcbiAgICAvLyBpZiBsb2NhdGlvbiBpcyBhbGwgdGhlbiBnZXQgT2JqZWN0LmtleXModGhpcy5zY19icmFuZGluZykgYW5kIGNhbGwgdGhpcyBmdW5jdGlvbiBmb3IgZWFjaFxuICAgIGlmIChjb250YWluZXIgPT09IFwiYWxsXCIpIHtcbiAgICAgIGNvbnN0IGxvY2F0aW9ucyA9IE9iamVjdC5rZXlzKHRoaXMuc2NfYnJhbmRpbmcpO1xuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsb2NhdGlvbnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdGhpcy5yZW5kZXJfYnJhbmQodGhpcy5zY19icmFuZGluZ1tsb2NhdGlvbnNbaV1dLCBsb2NhdGlvbnNbaV0pO1xuICAgICAgfVxuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICAvLyBicmFuZCBjb250YWluZXJcbiAgICB0aGlzLnNjX2JyYW5kaW5nW2xvY2F0aW9uXSA9IGNvbnRhaW5lcjtcbiAgICAvLyBpZiB0aGlzLnNjX2JyYW5kaW5nW2xvY2F0aW9uXSBjb250YWlucyBjaGlsZCB3aXRoIGNsYXNzIFwic2MtYnJhbmRcIiwgcmVtb3ZlIGl0XG4gICAgaWYgKHRoaXMuc2NfYnJhbmRpbmdbbG9jYXRpb25dLnF1ZXJ5U2VsZWN0b3IoXCIuc2MtYnJhbmRcIikpIHtcbiAgICAgIHRoaXMuc2NfYnJhbmRpbmdbbG9jYXRpb25dLnF1ZXJ5U2VsZWN0b3IoXCIuc2MtYnJhbmRcIikucmVtb3ZlKCk7XG4gICAgfVxuICAgIGNvbnN0IGJyYW5kX2NvbnRhaW5lciA9IHRoaXMuc2NfYnJhbmRpbmdbbG9jYXRpb25dLmNyZWF0ZUVsKFwiZGl2XCIsIHsgY2xzOiBcInNjLWJyYW5kXCIgfSk7XG4gICAgLy8gYWRkIHRleHRcbiAgICAvLyBhZGQgU1ZHIHNpZ25hbCBpY29uIHVzaW5nIGdldEljb25cbiAgICBPYnNpZGlhbi5zZXRJY29uKGJyYW5kX2NvbnRhaW5lciwgXCJzbWFydC1jb25uZWN0aW9uc1wiKTtcbiAgICBjb25zdCBicmFuZF9wID0gYnJhbmRfY29udGFpbmVyLmNyZWF0ZUVsKFwicFwiKTtcbiAgICBsZXQgdGV4dCA9IFwiU21hcnQgQ29ubmVjdGlvbnNcIjtcbiAgICBsZXQgYXR0ciA9IHt9O1xuICAgIC8vIGlmIHVwZGF0ZSBhdmFpbGFibGUsIGNoYW5nZSB0ZXh0IHRvIFwiVXBkYXRlIEF2YWlsYWJsZVwiXG4gICAgaWYgKHRoaXMudXBkYXRlX2F2YWlsYWJsZSkge1xuICAgICAgdGV4dCA9IFwiVXBkYXRlIEF2YWlsYWJsZVwiO1xuICAgICAgYXR0ciA9IHtcbiAgICAgICAgc3R5bGU6IFwiZm9udC13ZWlnaHQ6IDcwMDtcIlxuICAgICAgfTtcbiAgICB9XG4gICAgYnJhbmRfcC5jcmVhdGVFbChcImFcIiwge1xuICAgICAgY2xzOiBcIlwiLFxuICAgICAgdGV4dDogdGV4dCxcbiAgICAgIGhyZWY6IFwiaHR0cHM6Ly9naXRodWIuY29tL2JyaWFucGV0cm8vb2JzaWRpYW4tc21hcnQtY29ubmVjdGlvbnMvZGlzY3Vzc2lvbnNcIixcbiAgICAgIHRhcmdldDogXCJfYmxhbmtcIixcbiAgICAgIGF0dHI6IGF0dHJcbiAgICB9KTtcbiAgfVxuXG5cbiAgLy8gY3JlYXRlIGxpc3Qgb2YgbmVhcmVzdCBub3Rlc1xuICBhc3luYyB1cGRhdGVfcmVzdWx0cyhjb250YWluZXIsIG5lYXJlc3QpIHtcbiAgICBsZXQgbGlzdDtcbiAgICAvLyBjaGVjayBpZiBsaXN0IGV4aXN0c1xuICAgIGlmKChjb250YWluZXIuY2hpbGRyZW4ubGVuZ3RoID4gMSkgJiYgKGNvbnRhaW5lci5jaGlsZHJlblsxXS5jbGFzc0xpc3QuY29udGFpbnMoXCJzYy1saXN0XCIpKSl7XG4gICAgICBsaXN0ID0gY29udGFpbmVyLmNoaWxkcmVuWzFdO1xuICAgIH1cbiAgICAvLyBpZiBsaXN0IGV4aXN0cywgZW1wdHkgaXRcbiAgICBpZiAobGlzdCkge1xuICAgICAgbGlzdC5lbXB0eSgpO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBjcmVhdGUgbGlzdCBlbGVtZW50XG4gICAgICBsaXN0ID0gY29udGFpbmVyLmNyZWF0ZUVsKFwiZGl2XCIsIHsgY2xzOiBcInNjLWxpc3RcIiB9KTtcbiAgICB9XG4gICAgbGV0IHNlYXJjaF9yZXN1bHRfY2xhc3MgPSBcInNlYXJjaC1yZXN1bHRcIjtcbiAgICAvLyBpZiBzZXR0aW5ncyBleHBhbmRlZF92aWV3IGlzIGZhbHNlLCBhZGQgc2MtY29sbGFwc2VkIGNsYXNzXG4gICAgaWYoIXRoaXMuc2V0dGluZ3MuZXhwYW5kZWRfdmlldykgc2VhcmNoX3Jlc3VsdF9jbGFzcyArPSBcIiBzYy1jb2xsYXBzZWRcIjtcblxuICAgIC8vIFRPRE86IGFkZCBvcHRpb24gdG8gZ3JvdXAgbmVhcmVzdCBieSBmaWxlXG4gICAgaWYoIXRoaXMuc2V0dGluZ3MuZ3JvdXBfbmVhcmVzdF9ieV9maWxlKSB7XG4gICAgICAvLyBmb3IgZWFjaCBuZWFyZXN0IG5vdGVcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbmVhcmVzdC5sZW5ndGg7IGkrKykge1xuICAgICAgICAvKipcbiAgICAgICAgICogQkVHSU4gRVhURVJOQUwgTElOSyBMT0dJQ1xuICAgICAgICAgKiBpZiBsaW5rIGlzIGFuIG9iamVjdCwgaXQgaW5kaWNhdGVzIGV4dGVybmFsIGxpbmtcbiAgICAgICAgICovXG4gICAgICAgIGlmICh0eXBlb2YgbmVhcmVzdFtpXS5saW5rID09PSBcIm9iamVjdFwiKSB7XG4gICAgICAgICAgY29uc3QgaXRlbSA9IGxpc3QuY3JlYXRlRWwoXCJkaXZcIiwgeyBjbHM6IFwic2VhcmNoLXJlc3VsdFwiIH0pO1xuICAgICAgICAgIGNvbnN0IGxpbmsgPSBpdGVtLmNyZWF0ZUVsKFwiYVwiLCB7XG4gICAgICAgICAgICBjbHM6IFwic2VhcmNoLXJlc3VsdC1maWxlLXRpdGxlIGlzLWNsaWNrYWJsZVwiLFxuICAgICAgICAgICAgaHJlZjogbmVhcmVzdFtpXS5saW5rLnBhdGgsXG4gICAgICAgICAgICB0aXRsZTogbmVhcmVzdFtpXS5saW5rLnRpdGxlLFxuICAgICAgICAgIH0pO1xuICAgICAgICAgIGxpbmsuaW5uZXJIVE1MID0gdGhpcy5yZW5kZXJfZXh0ZXJuYWxfbGlua19lbG0obmVhcmVzdFtpXS5saW5rKTtcbiAgICAgICAgICBpdGVtLnNldEF0dHIoJ2RyYWdnYWJsZScsICd0cnVlJylcbiAgICAgICAgICBjb250aW51ZTsgLy8gZW5kcyBoZXJlIGZvciBleHRlcm5hbCBsaW5rc1xuICAgICAgICB9XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBCRUdJTiBJTlRFUk5BTCBMSU5LIExPR0lDXG4gICAgICAgICAqIGlmIGxpbmsgaXMgYSBzdHJpbmcsIGl0IGluZGljYXRlcyBpbnRlcm5hbCBsaW5rXG4gICAgICAgICAqL1xuICAgICAgICBsZXQgZmlsZV9saW5rX3RleHQ7XG4gICAgICAgIGNvbnN0IGZpbGVfc2ltaWxhcml0eV9wY3QgPSBNYXRoLnJvdW5kKG5lYXJlc3RbaV0uc2ltaWxhcml0eSAqIDEwMCkgKyBcIiVcIjtcbiAgICAgICAgaWYodGhpcy5zZXR0aW5ncy5zaG93X2Z1bGxfcGF0aCkge1xuICAgICAgICAgIGNvbnN0IHBjcyA9IG5lYXJlc3RbaV0ubGluay5zcGxpdChcIi9cIik7XG4gICAgICAgICAgZmlsZV9saW5rX3RleHQgPSBwY3NbcGNzLmxlbmd0aCAtIDFdO1xuICAgICAgICAgIGNvbnN0IHBhdGggPSBwY3Muc2xpY2UoMCwgcGNzLmxlbmd0aCAtIDEpLmpvaW4oXCIvXCIpO1xuICAgICAgICAgIC8vIGZpbGVfbGlua190ZXh0ID0gYDxzbWFsbD4ke3BhdGh9IHwgJHtmaWxlX3NpbWlsYXJpdHlfcGN0fTwvc21hbGw+PGJyPiR7ZmlsZV9saW5rX3RleHR9YDtcbiAgICAgICAgICBmaWxlX2xpbmtfdGV4dCA9IGA8c21hbGw+JHtmaWxlX3NpbWlsYXJpdHlfcGN0fSB8ICR7cGF0aH0gfCAke2ZpbGVfbGlua190ZXh0fTwvc21hbGw+YDtcbiAgICAgICAgfWVsc2V7XG4gICAgICAgICAgZmlsZV9saW5rX3RleHQgPSAnPHNtYWxsPicgKyBmaWxlX3NpbWlsYXJpdHlfcGN0ICsgXCIgfCBcIiArIG5lYXJlc3RbaV0ubGluay5zcGxpdChcIi9cIikucG9wKCkgKyAnPC9zbWFsbD4nO1xuICAgICAgICB9XG4gICAgICAgIC8vIHNraXAgY29udGVudHMgcmVuZGVyaW5nIGlmIGluY29tcGF0aWJsZSBmaWxlIHR5cGVcbiAgICAgICAgLy8gZXguIG5vdCBtYXJrZG93biBmaWxlIG9yIGNvbnRhaW5zIG5vICcuZXhjYWxpZHJhdydcbiAgICAgICAgaWYoIXRoaXMucmVuZGVyYWJsZV9maWxlX3R5cGUobmVhcmVzdFtpXS5saW5rKSl7XG4gICAgICAgICAgY29uc3QgaXRlbSA9IGxpc3QuY3JlYXRlRWwoXCJkaXZcIiwgeyBjbHM6IFwic2VhcmNoLXJlc3VsdFwiIH0pO1xuICAgICAgICAgIGNvbnN0IGxpbmsgPSBpdGVtLmNyZWF0ZUVsKFwiYVwiLCB7XG4gICAgICAgICAgICBjbHM6IFwic2VhcmNoLXJlc3VsdC1maWxlLXRpdGxlIGlzLWNsaWNrYWJsZVwiLFxuICAgICAgICAgICAgaHJlZjogbmVhcmVzdFtpXS5saW5rLFxuICAgICAgICAgIH0pO1xuICAgICAgICAgIGxpbmsuaW5uZXJIVE1MID0gZmlsZV9saW5rX3RleHQ7XG4gICAgICAgICAgLy8gZHJhZyBhbmQgZHJvcFxuICAgICAgICAgIGl0ZW0uc2V0QXR0cignZHJhZ2dhYmxlJywgJ3RydWUnKVxuICAgICAgICAgIC8vIGFkZCBsaXN0ZW5lcnMgdG8gbGlua1xuICAgICAgICAgIHRoaXMuYWRkX2xpbmtfbGlzdGVuZXJzKGxpbmssIG5lYXJlc3RbaV0sIGl0ZW0pO1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gcmVtb3ZlIGZpbGUgZXh0ZW5zaW9uIGlmIC5tZCBhbmQgbWFrZSAjIGludG8gPlxuICAgICAgICBmaWxlX2xpbmtfdGV4dCA9IGZpbGVfbGlua190ZXh0LnJlcGxhY2UoXCIubWRcIiwgXCJcIikucmVwbGFjZSgvIy9nLCBcIiA+IFwiKTtcbiAgICAgICAgLy8gY3JlYXRlIGl0ZW1cbiAgICAgICAgY29uc3QgaXRlbSA9IGxpc3QuY3JlYXRlRWwoXCJkaXZcIiwgeyBjbHM6IHNlYXJjaF9yZXN1bHRfY2xhc3MgfSk7XG4gICAgICAgIC8vIGNyZWF0ZSBzcGFuIGZvciB0b2dnbGVcbiAgICAgICAgY29uc3QgdG9nZ2xlID0gaXRlbS5jcmVhdGVFbChcInNwYW5cIiwgeyBjbHM6IFwiaXMtY2xpY2thYmxlXCIgfSk7XG4gICAgICAgIC8vIGluc2VydCByaWdodCB0cmlhbmdsZSBzdmcgYXMgdG9nZ2xlXG4gICAgICAgIE9ic2lkaWFuLnNldEljb24odG9nZ2xlLCBcInJpZ2h0LXRyaWFuZ2xlXCIpOyAvLyBtdXN0IGNvbWUgYmVmb3JlIGFkZGluZyBvdGhlciBlbG1zIHRvIHByZXZlbnQgb3ZlcndyaXRlXG4gICAgICAgIGNvbnN0IGxpbmsgPSB0b2dnbGUuY3JlYXRlRWwoXCJhXCIsIHtcbiAgICAgICAgICBjbHM6IFwic2VhcmNoLXJlc3VsdC1maWxlLXRpdGxlXCIsXG4gICAgICAgICAgdGl0bGU6IG5lYXJlc3RbaV0ubGluayxcbiAgICAgICAgfSk7XG4gICAgICAgIGxpbmsuaW5uZXJIVE1MID0gZmlsZV9saW5rX3RleHQ7XG4gICAgICAgIC8vIGFkZCBsaXN0ZW5lcnMgdG8gbGlua1xuICAgICAgICB0aGlzLmFkZF9saW5rX2xpc3RlbmVycyhsaW5rLCBuZWFyZXN0W2ldLCBpdGVtKTtcbiAgICAgICAgdG9nZ2xlLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoZXZlbnQpID0+IHtcbiAgICAgICAgICAvLyBmaW5kIHBhcmVudCBjb250YWluaW5nIHNlYXJjaC1yZXN1bHQgY2xhc3NcbiAgICAgICAgICBsZXQgcGFyZW50ID0gZXZlbnQudGFyZ2V0LnBhcmVudEVsZW1lbnQ7XG4gICAgICAgICAgd2hpbGUgKCFwYXJlbnQuY2xhc3NMaXN0LmNvbnRhaW5zKFwic2VhcmNoLXJlc3VsdFwiKSkge1xuICAgICAgICAgICAgcGFyZW50ID0gcGFyZW50LnBhcmVudEVsZW1lbnQ7XG4gICAgICAgICAgfVxuICAgICAgICAgIC8vIHRvZ2dsZSBzYy1jb2xsYXBzZWQgY2xhc3NcbiAgICAgICAgICBwYXJlbnQuY2xhc3NMaXN0LnRvZ2dsZShcInNjLWNvbGxhcHNlZFwiKTtcbiAgICAgICAgfSk7XG4gICAgICAgIGNvbnN0IGNvbnRlbnRzID0gaXRlbS5jcmVhdGVFbChcInVsXCIsIHsgY2xzOiBcIlwiIH0pO1xuICAgICAgICBjb25zdCBjb250ZW50c19jb250YWluZXIgPSBjb250ZW50cy5jcmVhdGVFbChcImxpXCIsIHtcbiAgICAgICAgICBjbHM6IFwic2VhcmNoLXJlc3VsdC1maWxlLXRpdGxlIGlzLWNsaWNrYWJsZVwiLFxuICAgICAgICAgIHRpdGxlOiBuZWFyZXN0W2ldLmxpbmssXG4gICAgICAgIH0pO1xuICAgICAgICBpZihuZWFyZXN0W2ldLmxpbmsuaW5kZXhPZihcIiNcIikgPiAtMSl7IC8vIGlzIGJsb2NrXG4gICAgICAgICAgT2JzaWRpYW4uTWFya2Rvd25SZW5kZXJlci5yZW5kZXJNYXJrZG93bigoYXdhaXQgdGhpcy5ibG9ja19yZXRyaWV2ZXIobmVhcmVzdFtpXS5saW5rLCB7bGluZXM6IDEwLCBtYXhfY2hhcnM6IDEwMDB9KSksIGNvbnRlbnRzX2NvbnRhaW5lciwgbmVhcmVzdFtpXS5saW5rLCBuZXcgT2JzaWRpYW4uQ29tcG9uZW50KCkpO1xuICAgICAgICB9ZWxzZXsgLy8gaXMgZmlsZVxuICAgICAgICAgIGNvbnN0IGZpcnN0X3Rlbl9saW5lcyA9IGF3YWl0IHRoaXMuZmlsZV9yZXRyaWV2ZXIobmVhcmVzdFtpXS5saW5rLCB7bGluZXM6IDEwLCBtYXhfY2hhcnM6IDEwMDB9KTtcbiAgICAgICAgICBpZighZmlyc3RfdGVuX2xpbmVzKSBjb250aW51ZTsgLy8gc2tpcCBpZiBmaWxlIGlzIGVtcHR5XG4gICAgICAgICAgT2JzaWRpYW4uTWFya2Rvd25SZW5kZXJlci5yZW5kZXJNYXJrZG93bihmaXJzdF90ZW5fbGluZXMsIGNvbnRlbnRzX2NvbnRhaW5lciwgbmVhcmVzdFtpXS5saW5rLCBuZXcgT2JzaWRpYW4uQ29tcG9uZW50KCkpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuYWRkX2xpbmtfbGlzdGVuZXJzKGNvbnRlbnRzLCBuZWFyZXN0W2ldLCBpdGVtKTtcbiAgICAgIH1cbiAgICAgIHRoaXMucmVuZGVyX2JyYW5kKGNvbnRhaW5lciwgXCJibG9ja1wiKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBncm91cCBuZWFyZXN0IGJ5IGZpbGVcbiAgICBjb25zdCBuZWFyZXN0X2J5X2ZpbGUgPSB7fTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IG5lYXJlc3QubGVuZ3RoOyBpKyspIHtcbiAgICAgIGNvbnN0IGN1cnIgPSBuZWFyZXN0W2ldO1xuICAgICAgY29uc3QgbGluayA9IGN1cnIubGluaztcbiAgICAgIC8vIHNraXAgaWYgbGluayBpcyBhbiBvYmplY3QgKGluZGljYXRlcyBleHRlcm5hbCBsb2dpYylcbiAgICAgIGlmICh0eXBlb2YgbGluayA9PT0gXCJvYmplY3RcIikge1xuICAgICAgICBuZWFyZXN0X2J5X2ZpbGVbbGluay5wYXRoXSA9IFtjdXJyXTtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgICBpZiAobGluay5pbmRleE9mKFwiI1wiKSA+IC0xKSB7XG4gICAgICAgIGNvbnN0IGZpbGVfcGF0aCA9IGxpbmsuc3BsaXQoXCIjXCIpWzBdO1xuICAgICAgICBpZiAoIW5lYXJlc3RfYnlfZmlsZVtmaWxlX3BhdGhdKSB7XG4gICAgICAgICAgbmVhcmVzdF9ieV9maWxlW2ZpbGVfcGF0aF0gPSBbXTtcbiAgICAgICAgfVxuICAgICAgICBuZWFyZXN0X2J5X2ZpbGVbZmlsZV9wYXRoXS5wdXNoKG5lYXJlc3RbaV0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaWYgKCFuZWFyZXN0X2J5X2ZpbGVbbGlua10pIHtcbiAgICAgICAgICBuZWFyZXN0X2J5X2ZpbGVbbGlua10gPSBbXTtcbiAgICAgICAgfVxuICAgICAgICAvLyBhbHdheXMgYWRkIHRvIGZyb250IG9mIGFycmF5XG4gICAgICAgIG5lYXJlc3RfYnlfZmlsZVtsaW5rXS51bnNoaWZ0KG5lYXJlc3RbaV0pO1xuICAgICAgfVxuICAgIH1cbiAgICAvLyBmb3IgZWFjaCBmaWxlXG4gICAgY29uc3Qga2V5cyA9IE9iamVjdC5rZXlzKG5lYXJlc3RfYnlfZmlsZSk7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBrZXlzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBjb25zdCBmaWxlID0gbmVhcmVzdF9ieV9maWxlW2tleXNbaV1dO1xuICAgICAgLyoqXG4gICAgICAgKiBCZWdpbiBleHRlcm5hbCBsaW5rIGhhbmRsaW5nXG4gICAgICAgKi9cbiAgICAgIC8vIGlmIGxpbmsgaXMgYW4gb2JqZWN0IChpbmRpY2F0ZXMgdjIgbG9naWMpXG4gICAgICBpZiAodHlwZW9mIGZpbGVbMF0ubGluayA9PT0gXCJvYmplY3RcIikge1xuICAgICAgICBjb25zdCBjdXJyID0gZmlsZVswXTtcbiAgICAgICAgY29uc3QgbWV0YSA9IGN1cnIubGluaztcbiAgICAgICAgaWYgKG1ldGEucGF0aC5zdGFydHNXaXRoKFwiaHR0cFwiKSkge1xuICAgICAgICAgIGNvbnN0IGl0ZW0gPSBsaXN0LmNyZWF0ZUVsKFwiZGl2XCIsIHsgY2xzOiBcInNlYXJjaC1yZXN1bHRcIiB9KTtcbiAgICAgICAgICBjb25zdCBsaW5rID0gaXRlbS5jcmVhdGVFbChcImFcIiwge1xuICAgICAgICAgICAgY2xzOiBcInNlYXJjaC1yZXN1bHQtZmlsZS10aXRsZSBpcy1jbGlja2FibGVcIixcbiAgICAgICAgICAgIGhyZWY6IG1ldGEucGF0aCxcbiAgICAgICAgICAgIHRpdGxlOiBtZXRhLnRpdGxlLFxuICAgICAgICAgIH0pO1xuICAgICAgICAgIGxpbmsuaW5uZXJIVE1MID0gdGhpcy5yZW5kZXJfZXh0ZXJuYWxfbGlua19lbG0obWV0YSk7XG4gICAgICAgICAgaXRlbS5zZXRBdHRyKCdkcmFnZ2FibGUnLCAndHJ1ZScpO1xuICAgICAgICAgIGNvbnRpbnVlOyAvLyBlbmRzIGhlcmUgZm9yIGV4dGVybmFsIGxpbmtzXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIC8qKlxuICAgICAgICogSGFuZGxlcyBJbnRlcm5hbFxuICAgICAgICovXG4gICAgICBsZXQgZmlsZV9saW5rX3RleHQ7XG4gICAgICBjb25zdCBmaWxlX3NpbWlsYXJpdHlfcGN0ID0gTWF0aC5yb3VuZChmaWxlWzBdLnNpbWlsYXJpdHkgKiAxMDApICsgXCIlXCI7XG4gICAgICBpZiAodGhpcy5zZXR0aW5ncy5zaG93X2Z1bGxfcGF0aCkge1xuICAgICAgICBjb25zdCBwY3MgPSBmaWxlWzBdLmxpbmsuc3BsaXQoXCIvXCIpO1xuICAgICAgICBmaWxlX2xpbmtfdGV4dCA9IHBjc1twY3MubGVuZ3RoIC0gMV07XG4gICAgICAgIGNvbnN0IHBhdGggPSBwY3Muc2xpY2UoMCwgcGNzLmxlbmd0aCAtIDEpLmpvaW4oXCIvXCIpO1xuICAgICAgICBmaWxlX2xpbmtfdGV4dCA9IGA8c21hbGw+JHtwYXRofSB8ICR7ZmlsZV9zaW1pbGFyaXR5X3BjdH08L3NtYWxsPjxicj4ke2ZpbGVfbGlua190ZXh0fWA7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBmaWxlX2xpbmtfdGV4dCA9IGZpbGVbMF0ubGluay5zcGxpdChcIi9cIikucG9wKCk7XG4gICAgICAgIC8vIGFkZCBzaW1pbGFyaXR5IHBlcmNlbnRhZ2VcbiAgICAgICAgZmlsZV9saW5rX3RleHQgKz0gJyB8ICcgKyBmaWxlX3NpbWlsYXJpdHlfcGN0O1xuICAgICAgfVxuXG5cbiAgICAgICAgXG4gICAgICAvLyBza2lwIGNvbnRlbnRzIHJlbmRlcmluZyBpZiBpbmNvbXBhdGlibGUgZmlsZSB0eXBlXG4gICAgICAvLyBleC4gbm90IG1hcmtkb3duIG9yIGNvbnRhaW5zICcuZXhjYWxpZHJhdydcbiAgICAgIGlmKCF0aGlzLnJlbmRlcmFibGVfZmlsZV90eXBlKGZpbGVbMF0ubGluaykpIHtcbiAgICAgICAgY29uc3QgaXRlbSA9IGxpc3QuY3JlYXRlRWwoXCJkaXZcIiwgeyBjbHM6IFwic2VhcmNoLXJlc3VsdFwiIH0pO1xuICAgICAgICBjb25zdCBmaWxlX2xpbmsgPSBpdGVtLmNyZWF0ZUVsKFwiYVwiLCB7XG4gICAgICAgICAgY2xzOiBcInNlYXJjaC1yZXN1bHQtZmlsZS10aXRsZSBpcy1jbGlja2FibGVcIixcbiAgICAgICAgICB0aXRsZTogZmlsZVswXS5saW5rLFxuICAgICAgICB9KTtcbiAgICAgICAgZmlsZV9saW5rLmlubmVySFRNTCA9IGZpbGVfbGlua190ZXh0O1xuICAgICAgICAvLyBhZGQgbGluayBsaXN0ZW5lcnMgdG8gZmlsZSBsaW5rXG4gICAgICAgIHRoaXMuYWRkX2xpbmtfbGlzdGVuZXJzKGZpbGVfbGluaywgZmlsZVswXSwgaXRlbSk7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG5cbiAgICAgIC8vIHJlbW92ZSBmaWxlIGV4dGVuc2lvbiBpZiAubWRcbiAgICAgIGZpbGVfbGlua190ZXh0ID0gZmlsZV9saW5rX3RleHQucmVwbGFjZShcIi5tZFwiLCBcIlwiKS5yZXBsYWNlKC8jL2csIFwiID4gXCIpO1xuICAgICAgY29uc3QgaXRlbSA9IGxpc3QuY3JlYXRlRWwoXCJkaXZcIiwgeyBjbHM6IHNlYXJjaF9yZXN1bHRfY2xhc3MgfSk7XG4gICAgICBjb25zdCB0b2dnbGUgPSBpdGVtLmNyZWF0ZUVsKFwic3BhblwiLCB7IGNsczogXCJpcy1jbGlja2FibGVcIiB9KTtcbiAgICAgIC8vIGluc2VydCByaWdodCB0cmlhbmdsZSBzdmcgaWNvbiBhcyB0b2dnbGUgYnV0dG9uIGluIHNwYW5cbiAgICAgIE9ic2lkaWFuLnNldEljb24odG9nZ2xlLCBcInJpZ2h0LXRyaWFuZ2xlXCIpOyAvLyBtdXN0IGNvbWUgYmVmb3JlIGFkZGluZyBvdGhlciBlbG1zIGVsc2Ugb3ZlcndyaXRlc1xuICAgICAgY29uc3QgZmlsZV9saW5rID0gdG9nZ2xlLmNyZWF0ZUVsKFwiYVwiLCB7XG4gICAgICAgIGNsczogXCJzZWFyY2gtcmVzdWx0LWZpbGUtdGl0bGVcIixcbiAgICAgICAgdGl0bGU6IGZpbGVbMF0ubGluayxcbiAgICAgIH0pO1xuICAgICAgZmlsZV9saW5rLmlubmVySFRNTCA9IGZpbGVfbGlua190ZXh0O1xuICAgICAgLy8gYWRkIGxpbmsgbGlzdGVuZXJzIHRvIGZpbGUgbGlua1xuICAgICAgdGhpcy5hZGRfbGlua19saXN0ZW5lcnMoZmlsZV9saW5rLCBmaWxlWzBdLCB0b2dnbGUpO1xuICAgICAgdG9nZ2xlLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoZXZlbnQpID0+IHtcbiAgICAgICAgLy8gZmluZCBwYXJlbnQgY29udGFpbmluZyBjbGFzcyBzZWFyY2gtcmVzdWx0XG4gICAgICAgIGxldCBwYXJlbnQgPSBldmVudC50YXJnZXQ7XG4gICAgICAgIHdoaWxlICghcGFyZW50LmNsYXNzTGlzdC5jb250YWlucyhcInNlYXJjaC1yZXN1bHRcIikpIHtcbiAgICAgICAgICBwYXJlbnQgPSBwYXJlbnQucGFyZW50RWxlbWVudDtcbiAgICAgICAgfVxuICAgICAgICBwYXJlbnQuY2xhc3NMaXN0LnRvZ2dsZShcInNjLWNvbGxhcHNlZFwiKTtcbiAgICAgICAgLy8gVE9ETzogaWYgYmxvY2sgY29udGFpbmVyIGlzIGVtcHR5LCByZW5kZXIgbWFya2Rvd24gZnJvbSBibG9jayByZXRyaWV2ZXJcbiAgICAgIH0pO1xuICAgICAgY29uc3QgZmlsZV9saW5rX2xpc3QgPSBpdGVtLmNyZWF0ZUVsKFwidWxcIik7XG4gICAgICAvLyBmb3IgZWFjaCBsaW5rIGluIGZpbGVcbiAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgZmlsZS5sZW5ndGg7IGorKykge1xuICAgICAgICAvLyBpZiBpcyBhIGJsb2NrIChoYXMgIyBpbiBsaW5rKVxuICAgICAgICBpZihmaWxlW2pdLmxpbmsuaW5kZXhPZihcIiNcIikgPiAtMSkge1xuICAgICAgICAgIGNvbnN0IGJsb2NrID0gZmlsZVtqXTtcbiAgICAgICAgICBjb25zdCBibG9ja19saW5rID0gZmlsZV9saW5rX2xpc3QuY3JlYXRlRWwoXCJsaVwiLCB7XG4gICAgICAgICAgICBjbHM6IFwic2VhcmNoLXJlc3VsdC1maWxlLXRpdGxlIGlzLWNsaWNrYWJsZVwiLFxuICAgICAgICAgICAgdGl0bGU6IGJsb2NrLmxpbmssXG4gICAgICAgICAgfSk7XG4gICAgICAgICAgLy8gc2tpcCBibG9jayBjb250ZXh0IGlmIGZpbGUubGVuZ3RoID09PSAxIGJlY2F1c2UgYWxyZWFkeSBhZGRlZFxuICAgICAgICAgIGlmKGZpbGUubGVuZ3RoID4gMSkge1xuICAgICAgICAgICAgY29uc3QgYmxvY2tfY29udGV4dCA9IHRoaXMucmVuZGVyX2Jsb2NrX2NvbnRleHQoYmxvY2spO1xuICAgICAgICAgICAgY29uc3QgYmxvY2tfc2ltaWxhcml0eV9wY3QgPSBNYXRoLnJvdW5kKGJsb2NrLnNpbWlsYXJpdHkgKiAxMDApICsgXCIlXCI7XG4gICAgICAgICAgICBibG9ja19saW5rLmlubmVySFRNTCA9IGA8c21hbGw+JHtibG9ja19jb250ZXh0fSB8ICR7YmxvY2tfc2ltaWxhcml0eV9wY3R9PC9zbWFsbD5gO1xuICAgICAgICAgIH1cbiAgICAgICAgICBjb25zdCBibG9ja19jb250YWluZXIgPSBibG9ja19saW5rLmNyZWF0ZUVsKFwiZGl2XCIpO1xuICAgICAgICAgIC8vIFRPRE86IG1vdmUgdG8gcmVuZGVyaW5nIG9uIGV4cGFuZGluZyBzZWN0aW9uICh0b2dnbGUgY29sbGFwc2VkKVxuICAgICAgICAgIE9ic2lkaWFuLk1hcmtkb3duUmVuZGVyZXIucmVuZGVyTWFya2Rvd24oKGF3YWl0IHRoaXMuYmxvY2tfcmV0cmlldmVyKGJsb2NrLmxpbmssIHtsaW5lczogMTAsIG1heF9jaGFyczogMTAwMH0pKSwgYmxvY2tfY29udGFpbmVyLCBibG9jay5saW5rLCBuZXcgT2JzaWRpYW4uQ29tcG9uZW50KCkpO1xuICAgICAgICAgIC8vIGFkZCBsaW5rIGxpc3RlbmVycyB0byBibG9jayBsaW5rXG4gICAgICAgICAgdGhpcy5hZGRfbGlua19saXN0ZW5lcnMoYmxvY2tfbGluaywgYmxvY2ssIGZpbGVfbGlua19saXN0KTtcbiAgICAgICAgfWVsc2V7XG4gICAgICAgICAgLy8gZ2V0IGZpcnN0IHRlbiBsaW5lcyBvZiBmaWxlXG4gICAgICAgICAgY29uc3QgZmlsZV9saW5rX2xpc3QgPSBpdGVtLmNyZWF0ZUVsKFwidWxcIik7XG4gICAgICAgICAgY29uc3QgYmxvY2tfbGluayA9IGZpbGVfbGlua19saXN0LmNyZWF0ZUVsKFwibGlcIiwge1xuICAgICAgICAgICAgY2xzOiBcInNlYXJjaC1yZXN1bHQtZmlsZS10aXRsZSBpcy1jbGlja2FibGVcIixcbiAgICAgICAgICAgIHRpdGxlOiBmaWxlWzBdLmxpbmssXG4gICAgICAgICAgfSk7XG4gICAgICAgICAgY29uc3QgYmxvY2tfY29udGFpbmVyID0gYmxvY2tfbGluay5jcmVhdGVFbChcImRpdlwiKTtcbiAgICAgICAgICBsZXQgZmlyc3RfdGVuX2xpbmVzID0gYXdhaXQgdGhpcy5maWxlX3JldHJpZXZlcihmaWxlWzBdLmxpbmssIHtsaW5lczogMTAsIG1heF9jaGFyczogMTAwMH0pO1xuICAgICAgICAgIGlmKCFmaXJzdF90ZW5fbGluZXMpIGNvbnRpbnVlOyAvLyBpZiBmaWxlIG5vdCBmb3VuZCwgc2tpcFxuICAgICAgICAgIE9ic2lkaWFuLk1hcmtkb3duUmVuZGVyZXIucmVuZGVyTWFya2Rvd24oZmlyc3RfdGVuX2xpbmVzLCBibG9ja19jb250YWluZXIsIGZpbGVbMF0ubGluaywgbmV3IE9ic2lkaWFuLkNvbXBvbmVudCgpKTtcbiAgICAgICAgICB0aGlzLmFkZF9saW5rX2xpc3RlbmVycyhibG9ja19saW5rLCBmaWxlWzBdLCBmaWxlX2xpbmtfbGlzdCk7XG5cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICB0aGlzLnJlbmRlcl9icmFuZChjb250YWluZXIsIFwiZmlsZVwiKTtcbiAgfVxuXG4gIGFkZF9saW5rX2xpc3RlbmVycyhpdGVtLCBjdXJyLCBsaXN0KSB7XG4gICAgaXRlbS5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgYXN5bmMgKGV2ZW50KSA9PiB7XG4gICAgICBhd2FpdCB0aGlzLm9wZW5fbm90ZShjdXJyLCBldmVudCk7XG4gICAgfSk7XG4gICAgLy8gZHJhZy1vblxuICAgIC8vIGN1cnJlbnRseSBvbmx5IHdvcmtzIHdpdGggZnVsbC1maWxlIGxpbmtzXG4gICAgaXRlbS5zZXRBdHRyKCdkcmFnZ2FibGUnLCAndHJ1ZScpO1xuICAgIGl0ZW0uYWRkRXZlbnRMaXN0ZW5lcignZHJhZ3N0YXJ0JywgKGV2ZW50KSA9PiB7XG4gICAgICBjb25zdCBkcmFnTWFuYWdlciA9IHRoaXMuYXBwLmRyYWdNYW5hZ2VyO1xuICAgICAgY29uc3QgZmlsZV9wYXRoID0gY3Vyci5saW5rLnNwbGl0KFwiI1wiKVswXTtcbiAgICAgIGNvbnN0IGZpbGUgPSB0aGlzLmFwcC5tZXRhZGF0YUNhY2hlLmdldEZpcnN0TGlua3BhdGhEZXN0KGZpbGVfcGF0aCwgJycpO1xuICAgICAgY29uc3QgZHJhZ0RhdGEgPSBkcmFnTWFuYWdlci5kcmFnRmlsZShldmVudCwgZmlsZSk7XG4gICAgICAvLyBjb25zb2xlLmxvZyhkcmFnRGF0YSk7XG4gICAgICBkcmFnTWFuYWdlci5vbkRyYWdTdGFydChldmVudCwgZHJhZ0RhdGEpO1xuICAgIH0pO1xuICAgIC8vIGlmIGN1cnIubGluayBjb250YWlucyBjdXJseSBicmFjZXMsIHJldHVybiAoaW5jb21wYXRpYmxlIHdpdGggaG92ZXItbGluaylcbiAgICBpZiAoY3Vyci5saW5rLmluZGV4T2YoXCJ7XCIpID4gLTEpIHJldHVybjtcbiAgICAvLyB0cmlnZ2VyIGhvdmVyIGV2ZW50IG9uIGxpbmtcbiAgICBpdGVtLmFkZEV2ZW50TGlzdGVuZXIoXCJtb3VzZW92ZXJcIiwgKGV2ZW50KSA9PiB7XG4gICAgICB0aGlzLmFwcC53b3Jrc3BhY2UudHJpZ2dlcihcImhvdmVyLWxpbmtcIiwge1xuICAgICAgICBldmVudCxcbiAgICAgICAgc291cmNlOiBTTUFSVF9DT05ORUNUSU9OU19WSUVXX1RZUEUsXG4gICAgICAgIGhvdmVyUGFyZW50OiBsaXN0LFxuICAgICAgICB0YXJnZXRFbDogaXRlbSxcbiAgICAgICAgbGlua3RleHQ6IGN1cnIubGluayxcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG5cbiAgLy8gZ2V0IHRhcmdldCBmaWxlIGZyb20gbGluayBwYXRoXG4gIC8vIGlmIHN1Yi1zZWN0aW9uIGlzIGxpbmtlZCwgb3BlbiBmaWxlIGFuZCBzY3JvbGwgdG8gc3ViLXNlY3Rpb25cbiAgYXN5bmMgb3Blbl9ub3RlKGN1cnIsIGV2ZW50PW51bGwpIHtcbiAgICBsZXQgdGFyZ2V0RmlsZTtcbiAgICBsZXQgaGVhZGluZztcbiAgICBpZiAoY3Vyci5saW5rLmluZGV4T2YoXCIjXCIpID4gLTEpIHtcbiAgICAgIC8vIHJlbW92ZSBhZnRlciAjIGZyb20gbGlua1xuICAgICAgdGFyZ2V0RmlsZSA9IHRoaXMuYXBwLm1ldGFkYXRhQ2FjaGUuZ2V0Rmlyc3RMaW5rcGF0aERlc3QoY3Vyci5saW5rLnNwbGl0KFwiI1wiKVswXSwgXCJcIik7XG4gICAgICAvLyBjb25zb2xlLmxvZyh0YXJnZXRGaWxlKTtcbiAgICAgIGNvbnN0IHRhcmdldF9maWxlX2NhY2hlID0gdGhpcy5hcHAubWV0YWRhdGFDYWNoZS5nZXRGaWxlQ2FjaGUodGFyZ2V0RmlsZSk7XG4gICAgICAvLyBjb25zb2xlLmxvZyh0YXJnZXRfZmlsZV9jYWNoZSk7XG4gICAgICAvLyBnZXQgaGVhZGluZ1xuICAgICAgbGV0IGhlYWRpbmdfdGV4dCA9IGN1cnIubGluay5zcGxpdChcIiNcIikucG9wKCk7XG4gICAgICAvLyBpZiBoZWFkaW5nIHRleHQgY29udGFpbnMgYSBjdXJseSBicmFjZSwgZ2V0IHRoZSBudW1iZXIgaW5zaWRlIHRoZSBjdXJseSBicmFjZXMgYXMgb2NjdXJlbmNlXG4gICAgICBsZXQgb2NjdXJlbmNlID0gMDtcbiAgICAgIGlmIChoZWFkaW5nX3RleHQuaW5kZXhPZihcIntcIikgPiAtMSkge1xuICAgICAgICAvLyBnZXQgb2NjdXJlbmNlXG4gICAgICAgIG9jY3VyZW5jZSA9IHBhcnNlSW50KGhlYWRpbmdfdGV4dC5zcGxpdChcIntcIilbMV0uc3BsaXQoXCJ9XCIpWzBdKTtcbiAgICAgICAgLy8gcmVtb3ZlIG9jY3VyZW5jZSBmcm9tIGhlYWRpbmcgdGV4dFxuICAgICAgICBoZWFkaW5nX3RleHQgPSBoZWFkaW5nX3RleHQuc3BsaXQoXCJ7XCIpWzBdO1xuICAgICAgfVxuICAgICAgLy8gZ2V0IGhlYWRpbmdzIGZyb20gZmlsZSBjYWNoZVxuICAgICAgY29uc3QgaGVhZGluZ3MgPSB0YXJnZXRfZmlsZV9jYWNoZS5oZWFkaW5ncztcbiAgICAgIC8vIGdldCBoZWFkaW5ncyB3aXRoIHRoZSBzYW1lIGRlcHRoIGFuZCB0ZXh0IGFzIHRoZSBsaW5rXG4gICAgICBmb3IobGV0IGkgPSAwOyBpIDwgaGVhZGluZ3MubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgaWYgKGhlYWRpbmdzW2ldLmhlYWRpbmcgPT09IGhlYWRpbmdfdGV4dCkge1xuICAgICAgICAgIC8vIGlmIG9jY3VyZW5jZSBpcyAwLCBzZXQgaGVhZGluZyBhbmQgYnJlYWtcbiAgICAgICAgICBpZihvY2N1cmVuY2UgPT09IDApIHtcbiAgICAgICAgICAgIGhlYWRpbmcgPSBoZWFkaW5nc1tpXTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH1cbiAgICAgICAgICBvY2N1cmVuY2UtLTsgLy8gZGVjcmVtZW50IG9jY3VyZW5jZVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICAvLyBjb25zb2xlLmxvZyhoZWFkaW5nKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGFyZ2V0RmlsZSA9IHRoaXMuYXBwLm1ldGFkYXRhQ2FjaGUuZ2V0Rmlyc3RMaW5rcGF0aERlc3QoY3Vyci5saW5rLCBcIlwiKTtcbiAgICB9XG4gICAgbGV0IGxlYWY7XG4gICAgaWYoZXZlbnQpIHtcbiAgICAgIC8vIHByb3Blcmx5IGhhbmRsZSBpZiB0aGUgbWV0YS9jdHJsIGtleSBpcyBwcmVzc2VkXG4gICAgICBjb25zdCBtb2QgPSBPYnNpZGlhbi5LZXltYXAuaXNNb2RFdmVudChldmVudCk7XG4gICAgICAvLyBnZXQgbW9zdCByZWNlbnQgbGVhZlxuICAgICAgbGVhZiA9IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRMZWFmKG1vZCk7XG4gICAgfWVsc2V7XG4gICAgICAvLyBnZXQgbW9zdCByZWNlbnQgbGVhZlxuICAgICAgbGVhZiA9IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRNb3N0UmVjZW50TGVhZigpO1xuICAgIH1cbiAgICBhd2FpdCBsZWFmLm9wZW5GaWxlKHRhcmdldEZpbGUpO1xuICAgIGlmIChoZWFkaW5nKSB7XG4gICAgICBsZXQgeyBlZGl0b3IgfSA9IGxlYWYudmlldztcbiAgICAgIGNvbnN0IHBvcyA9IHsgbGluZTogaGVhZGluZy5wb3NpdGlvbi5zdGFydC5saW5lLCBjaDogMCB9O1xuICAgICAgZWRpdG9yLnNldEN1cnNvcihwb3MpO1xuICAgICAgZWRpdG9yLnNjcm9sbEludG9WaWV3KHsgdG86IHBvcywgZnJvbTogcG9zIH0sIHRydWUpO1xuICAgIH1cbiAgfVxuXG4gIHJlbmRlcl9ibG9ja19jb250ZXh0KGJsb2NrKSB7XG4gICAgY29uc3QgYmxvY2tfaGVhZGluZ3MgPSBibG9jay5saW5rLnNwbGl0KFwiLm1kXCIpWzFdLnNwbGl0KFwiI1wiKTtcbiAgICAvLyBzdGFydGluZyB3aXRoIHRoZSBsYXN0IGhlYWRpbmcgZmlyc3QsIGl0ZXJhdGUgdGhyb3VnaCBoZWFkaW5nc1xuICAgIGxldCBibG9ja19jb250ZXh0ID0gXCJcIjtcbiAgICBmb3IgKGxldCBpID0gYmxvY2tfaGVhZGluZ3MubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICAgIGlmKGJsb2NrX2NvbnRleHQubGVuZ3RoID4gMCkge1xuICAgICAgICBibG9ja19jb250ZXh0ID0gYCA+ICR7YmxvY2tfY29udGV4dH1gO1xuICAgICAgfVxuICAgICAgYmxvY2tfY29udGV4dCA9IGJsb2NrX2hlYWRpbmdzW2ldICsgYmxvY2tfY29udGV4dDtcbiAgICAgIC8vIGlmIGJsb2NrIGNvbnRleHQgaXMgbG9uZ2VyIHRoYW4gTiBjaGFyYWN0ZXJzLCBicmVha1xuICAgICAgaWYgKGJsb2NrX2NvbnRleHQubGVuZ3RoID4gMTAwKSB7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgICAvLyByZW1vdmUgbGVhZGluZyA+IGlmIGV4aXN0c1xuICAgIGlmIChibG9ja19jb250ZXh0LnN0YXJ0c1dpdGgoXCIgPiBcIikpIHtcbiAgICAgIGJsb2NrX2NvbnRleHQgPSBibG9ja19jb250ZXh0LnNsaWNlKDMpO1xuICAgIH1cbiAgICByZXR1cm4gYmxvY2tfY29udGV4dDtcblxuICB9XG5cbiAgcmVuZGVyYWJsZV9maWxlX3R5cGUobGluaykge1xuICAgIHJldHVybiAobGluay5pbmRleE9mKFwiLm1kXCIpICE9PSAtMSkgJiYgKGxpbmsuaW5kZXhPZihcIi5leGNhbGlkcmF3XCIpID09PSAtMSk7XG4gIH1cblxuICByZW5kZXJfZXh0ZXJuYWxfbGlua19lbG0obWV0YSl7XG4gICAgaWYobWV0YS5zb3VyY2UpIHtcbiAgICAgIGlmKG1ldGEuc291cmNlID09PSBcIkdtYWlsXCIpIG1ldGEuc291cmNlID0gXCJcdUQ4M0RcdURDRTcgR21haWxcIjtcbiAgICAgIHJldHVybiBgPHNtYWxsPiR7bWV0YS5zb3VyY2V9PC9zbWFsbD48YnI+JHttZXRhLnRpdGxlfWA7XG4gICAgfVxuICAgIC8vIHJlbW92ZSBodHRwKHMpOi8vXG4gICAgbGV0IGRvbWFpbiA9IG1ldGEucGF0aC5yZXBsYWNlKC8oXlxcdys6fF4pXFwvXFwvLywgXCJcIik7XG4gICAgLy8gc2VwYXJhdGUgZG9tYWluIGZyb20gcGF0aFxuICAgIGRvbWFpbiA9IGRvbWFpbi5zcGxpdChcIi9cIilbMF07XG4gICAgLy8gd3JhcCBkb21haW4gaW4gPHNtYWxsPiBhbmQgYWRkIGxpbmUgYnJlYWtcbiAgICByZXR1cm4gYDxzbWFsbD5cdUQ4M0NcdURGMTAgJHtkb21haW59PC9zbWFsbD48YnI+JHttZXRhLnRpdGxlfWA7XG4gIH1cbiAgLy8gZ2V0IGFsbCBmb2xkZXJzXG4gIGFzeW5jIGdldF9hbGxfZm9sZGVycygpIHtcbiAgICBpZighdGhpcy5mb2xkZXJzIHx8IHRoaXMuZm9sZGVycy5sZW5ndGggPT09IDApe1xuICAgICAgdGhpcy5mb2xkZXJzID0gYXdhaXQgdGhpcy5nZXRfZm9sZGVycygpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5mb2xkZXJzO1xuICB9XG4gIC8vIGdldCBmb2xkZXJzLCB0cmF2ZXJzZSBub24taGlkZGVuIHN1Yi1mb2xkZXJzXG4gIGFzeW5jIGdldF9mb2xkZXJzKHBhdGggPSBcIi9cIikge1xuICAgIGxldCBmb2xkZXJzID0gKGF3YWl0IHRoaXMuYXBwLnZhdWx0LmFkYXB0ZXIubGlzdChwYXRoKSkuZm9sZGVycztcbiAgICBsZXQgZm9sZGVyX2xpc3QgPSBbXTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGZvbGRlcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmIChmb2xkZXJzW2ldLnN0YXJ0c1dpdGgoXCIuXCIpKSBjb250aW51ZTtcbiAgICAgIGZvbGRlcl9saXN0LnB1c2goZm9sZGVyc1tpXSk7XG4gICAgICBmb2xkZXJfbGlzdCA9IGZvbGRlcl9saXN0LmNvbmNhdChhd2FpdCB0aGlzLmdldF9mb2xkZXJzKGZvbGRlcnNbaV0gKyBcIi9cIikpO1xuICAgIH1cbiAgICByZXR1cm4gZm9sZGVyX2xpc3Q7XG4gIH1cblxuXG4gIGFzeW5jIHN5bmNfbm90ZXMoKSB7XG4gICAgY29uc29sZS5sb2coXCJzeW5jaW5nIG5vdGVzXCIpO1xuICAgIC8vIGdldCBhbGwgZmlsZXMgaW4gdmF1bHRcbiAgICBjb25zdCBmaWxlcyA9IHRoaXMuYXBwLnZhdWx0LmdldE1hcmtkb3duRmlsZXMoKS5maWx0ZXIoKGZpbGUpID0+IHtcbiAgICAgIC8vIGZpbHRlciBvdXQgZmlsZSBwYXRocyBtYXRjaGluZyBhbnkgc3RyaW5ncyBpbiB0aGlzLmZpbGVfZXhjbHVzaW9uc1xuICAgICAgZm9yKGxldCBpID0gMDsgaSA8IHRoaXMuZmlsZV9leGNsdXNpb25zLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGlmKGZpbGUucGF0aC5pbmRleE9mKHRoaXMuZmlsZV9leGNsdXNpb25zW2ldKSA+IC0xKSB7XG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9KTtcbiAgICBjb25zdCBub3RlcyA9IGF3YWl0IHRoaXMuYnVpbGRfbm90ZXNfb2JqZWN0KGZpbGVzKTtcbiAgICBjb25zb2xlLmxvZyhcIm9iamVjdCBidWlsdFwiKTtcbiAgICAvLyBzYXZlIG5vdGVzIG9iamVjdCB0byAuc21hcnQtY29ubmVjdGlvbnMvbm90ZXMuanNvblxuICAgIGF3YWl0IHRoaXMuYXBwLnZhdWx0LmFkYXB0ZXIud3JpdGUoXCIuc21hcnQtY29ubmVjdGlvbnMvbm90ZXMuanNvblwiLCBKU09OLnN0cmluZ2lmeShub3RlcywgbnVsbCwgMikpO1xuICAgIGNvbnNvbGUubG9nKFwibm90ZXMgc2F2ZWRcIik7XG4gICAgY29uc29sZS5sb2codGhpcy5zZXR0aW5ncy5saWNlbnNlX2tleSk7XG4gICAgLy8gUE9TVCBub3RlcyBvYmplY3QgdG8gc2VydmVyXG4gICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCAoMCwgT2JzaWRpYW4ucmVxdWVzdFVybCkoe1xuICAgICAgdXJsOiBcImh0dHBzOi8vc3luYy5zbWFydGNvbm5lY3Rpb25zLmFwcC9zeW5jXCIsXG4gICAgICBtZXRob2Q6IFwiUE9TVFwiLFxuICAgICAgaGVhZGVyczoge1xuICAgICAgICBcIkNvbnRlbnQtVHlwZVwiOiBcImFwcGxpY2F0aW9uL2pzb25cIixcbiAgICAgIH0sXG4gICAgICBjb250ZW50VHlwZTogXCJhcHBsaWNhdGlvbi9qc29uXCIsXG4gICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgIGxpY2Vuc2Vfa2V5OiB0aGlzLnNldHRpbmdzLmxpY2Vuc2Vfa2V5LFxuICAgICAgICBub3Rlczogbm90ZXNcbiAgICAgIH0pXG4gICAgfSk7XG4gICAgY29uc29sZS5sb2cocmVzcG9uc2UpO1xuXG4gIH1cblxuICBhc3luYyBidWlsZF9ub3Rlc19vYmplY3QoZmlsZXMpIHtcbiAgICBsZXQgb3V0cHV0ID0ge307XG4gIFxuICAgIGZvcihsZXQgaSA9IDA7IGkgPCBmaWxlcy5sZW5ndGg7IGkrKykge1xuICAgICAgbGV0IGZpbGUgPSBmaWxlc1tpXTtcbiAgICAgIGxldCBwYXJ0cyA9IGZpbGUucGF0aC5zcGxpdChcIi9cIik7XG4gICAgICBsZXQgY3VycmVudCA9IG91dHB1dDtcbiAgXG4gICAgICBmb3IgKGxldCBpaSA9IDA7IGlpIDwgcGFydHMubGVuZ3RoOyBpaSsrKSB7XG4gICAgICAgIGxldCBwYXJ0ID0gcGFydHNbaWldO1xuICBcbiAgICAgICAgaWYgKGlpID09PSBwYXJ0cy5sZW5ndGggLSAxKSB7XG4gICAgICAgICAgLy8gVGhpcyBpcyBhIGZpbGVcbiAgICAgICAgICBjdXJyZW50W3BhcnRdID0gYXdhaXQgdGhpcy5hcHAudmF1bHQuY2FjaGVkUmVhZChmaWxlKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBUaGlzIGlzIGEgZGlyZWN0b3J5XG4gICAgICAgICAgaWYgKCFjdXJyZW50W3BhcnRdKSB7XG4gICAgICAgICAgICBjdXJyZW50W3BhcnRdID0ge307XG4gICAgICAgICAgfVxuICBcbiAgICAgICAgICBjdXJyZW50ID0gY3VycmVudFtwYXJ0XTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgXG4gICAgcmV0dXJuIG91dHB1dDtcbiAgfVxuXG59XG5cbmNvbnN0IFNNQVJUX0NPTk5FQ1RJT05TX1ZJRVdfVFlQRSA9IFwic21hcnQtY29ubmVjdGlvbnMtdmlld1wiO1xuY2xhc3MgU21hcnRDb25uZWN0aW9uc1ZpZXcgZXh0ZW5kcyBPYnNpZGlhbi5JdGVtVmlldyB7XG4gIGNvbnN0cnVjdG9yKGxlYWYsIHBsdWdpbikge1xuICAgIHN1cGVyKGxlYWYpO1xuICAgIHRoaXMucGx1Z2luID0gcGx1Z2luO1xuICAgIHRoaXMubmVhcmVzdCA9IG51bGw7XG4gICAgdGhpcy5sb2FkX3dhaXQgPSBudWxsO1xuICB9XG4gIGdldFZpZXdUeXBlKCkge1xuICAgIHJldHVybiBTTUFSVF9DT05ORUNUSU9OU19WSUVXX1RZUEU7XG4gIH1cblxuICBnZXREaXNwbGF5VGV4dCgpIHtcbiAgICByZXR1cm4gXCJTbWFydCBDb25uZWN0aW9ucyBGaWxlc1wiO1xuICB9XG5cbiAgZ2V0SWNvbigpIHtcbiAgICByZXR1cm4gXCJzbWFydC1jb25uZWN0aW9uc1wiO1xuICB9XG5cblxuICBzZXRfbWVzc2FnZShtZXNzYWdlKSB7XG4gICAgY29uc3QgY29udGFpbmVyID0gdGhpcy5jb250YWluZXJFbC5jaGlsZHJlblsxXTtcbiAgICAvLyBjbGVhciBjb250YWluZXJcbiAgICBjb250YWluZXIuZW1wdHkoKTtcbiAgICAvLyBpbml0aWF0ZSB0b3AgYmFyXG4gICAgdGhpcy5pbml0aWF0ZV90b3BfYmFyKGNvbnRhaW5lcik7XG4gICAgLy8gaWYgbWVzYWdlIGlzIGFuIGFycmF5LCBsb29wIHRocm91Z2ggYW5kIGNyZWF0ZSBhIG5ldyBwIGVsZW1lbnQgZm9yIGVhY2ggbWVzc2FnZVxuICAgIGlmIChBcnJheS5pc0FycmF5KG1lc3NhZ2UpKSB7XG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG1lc3NhZ2UubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgY29udGFpbmVyLmNyZWF0ZUVsKFwicFwiLCB7IGNsczogXCJzY19tZXNzYWdlXCIsIHRleHQ6IG1lc3NhZ2VbaV0gfSk7XG4gICAgICB9XG4gICAgfWVsc2V7XG4gICAgICAvLyBjcmVhdGUgcCBlbGVtZW50IHdpdGggbWVzc2FnZVxuICAgICAgY29udGFpbmVyLmNyZWF0ZUVsKFwicFwiLCB7IGNsczogXCJzY19tZXNzYWdlXCIsIHRleHQ6IG1lc3NhZ2UgfSk7XG4gICAgfVxuICB9XG4gIHJlbmRlcl9saW5rX3RleHQobGluaywgc2hvd19mdWxsX3BhdGg9ZmFsc2UpIHtcbiAgICAvKipcbiAgICAgKiBCZWdpbiBpbnRlcm5hbCBsaW5rc1xuICAgICAqL1xuICAgIC8vIGlmIHNob3cgZnVsbCBwYXRoIGlzIGZhbHNlLCByZW1vdmUgZmlsZSBwYXRoXG4gICAgaWYgKCFzaG93X2Z1bGxfcGF0aCkge1xuICAgICAgbGluayA9IGxpbmsuc3BsaXQoXCIvXCIpLnBvcCgpO1xuICAgIH1cbiAgICAvLyBpZiBjb250YWlucyAnIydcbiAgICBpZiAobGluay5pbmRleE9mKFwiI1wiKSA+IC0xKSB7XG4gICAgICAvLyBzcGxpdCBhdCAubWRcbiAgICAgIGxpbmsgPSBsaW5rLnNwbGl0KFwiLm1kXCIpO1xuICAgICAgLy8gd3JhcCBmaXJzdCBwYXJ0IGluIDxzbWFsbD4gYW5kIGFkZCBsaW5lIGJyZWFrXG4gICAgICBsaW5rWzBdID0gYDxzbWFsbD4ke2xpbmtbMF19PC9zbWFsbD48YnI+YDtcbiAgICAgIC8vIGpvaW4gYmFjayB0b2dldGhlclxuICAgICAgbGluayA9IGxpbmsuam9pbihcIlwiKTtcbiAgICAgIC8vIHJlcGxhY2UgJyMnIHdpdGggJyBcdTAwQkIgJ1xuICAgICAgbGluayA9IGxpbmsucmVwbGFjZSgvXFwjL2csIFwiIFx1MDBCQiBcIik7XG4gICAgfWVsc2V7XG4gICAgICAvLyByZW1vdmUgJy5tZCdcbiAgICAgIGxpbmsgPSBsaW5rLnJlcGxhY2UoXCIubWRcIiwgXCJcIik7XG4gICAgfVxuICAgIHJldHVybiBsaW5rO1xuICB9XG5cblxuICBzZXRfbmVhcmVzdChuZWFyZXN0LCBuZWFyZXN0X2NvbnRleHQ9bnVsbCwgcmVzdWx0c19vbmx5PWZhbHNlKSB7XG4gICAgLy8gZ2V0IGNvbnRhaW5lciBlbGVtZW50XG4gICAgY29uc3QgY29udGFpbmVyID0gdGhpcy5jb250YWluZXJFbC5jaGlsZHJlblsxXTtcbiAgICAvLyBpZiByZXN1bHRzIG9ubHkgaXMgZmFsc2UsIGNsZWFyIGNvbnRhaW5lciBhbmQgaW5pdGlhdGUgdG9wIGJhclxuICAgIGlmKCFyZXN1bHRzX29ubHkpe1xuICAgICAgLy8gY2xlYXIgY29udGFpbmVyXG4gICAgICBjb250YWluZXIuZW1wdHkoKTtcbiAgICAgIHRoaXMuaW5pdGlhdGVfdG9wX2Jhcihjb250YWluZXIsIG5lYXJlc3RfY29udGV4dCk7XG4gICAgfVxuICAgIC8vIHVwZGF0ZSByZXN1bHRzXG4gICAgdGhpcy5wbHVnaW4udXBkYXRlX3Jlc3VsdHMoY29udGFpbmVyLCBuZWFyZXN0KTtcbiAgfVxuXG4gIGluaXRpYXRlX3RvcF9iYXIoY29udGFpbmVyLCBuZWFyZXN0X2NvbnRleHQ9bnVsbCkge1xuICAgIGxldCB0b3BfYmFyO1xuICAgIC8vIGlmIHRvcCBiYXIgYWxyZWFkeSBleGlzdHMsIGVtcHR5IGl0XG4gICAgaWYgKChjb250YWluZXIuY2hpbGRyZW4ubGVuZ3RoID4gMCkgJiYgKGNvbnRhaW5lci5jaGlsZHJlblswXS5jbGFzc0xpc3QuY29udGFpbnMoXCJzYy10b3AtYmFyXCIpKSkge1xuICAgICAgdG9wX2JhciA9IGNvbnRhaW5lci5jaGlsZHJlblswXTtcbiAgICAgIHRvcF9iYXIuZW1wdHkoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gaW5pdCBjb250YWluZXIgZm9yIHRvcCBiYXJcbiAgICAgIHRvcF9iYXIgPSBjb250YWluZXIuY3JlYXRlRWwoXCJkaXZcIiwgeyBjbHM6IFwic2MtdG9wLWJhclwiIH0pO1xuICAgIH1cbiAgICAvLyBpZiBoaWdobGlnaHRlZCB0ZXh0IGlzIG5vdCBudWxsLCBjcmVhdGUgcCBlbGVtZW50IHdpdGggaGlnaGxpZ2h0ZWQgdGV4dFxuICAgIGlmIChuZWFyZXN0X2NvbnRleHQpIHtcbiAgICAgIHRvcF9iYXIuY3JlYXRlRWwoXCJwXCIsIHsgY2xzOiBcInNjLWNvbnRleHRcIiwgdGV4dDogbmVhcmVzdF9jb250ZXh0IH0pO1xuICAgIH1cbiAgICAvLyBhZGQgY2hhdCBidXR0b25cbiAgICBjb25zdCBjaGF0X2J1dHRvbiA9IHRvcF9iYXIuY3JlYXRlRWwoXCJidXR0b25cIiwgeyBjbHM6IFwic2MtY2hhdC1idXR0b25cIiB9KTtcbiAgICAvLyBhZGQgaWNvbiB0byBjaGF0IGJ1dHRvblxuICAgIE9ic2lkaWFuLnNldEljb24oY2hhdF9idXR0b24sIFwibWVzc2FnZS1zcXVhcmVcIik7XG4gICAgLy8gYWRkIGNsaWNrIGxpc3RlbmVyIHRvIGNoYXQgYnV0dG9uXG4gICAgY2hhdF9idXR0b24uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHtcbiAgICAgIC8vIG9wZW4gY2hhdFxuICAgICAgdGhpcy5wbHVnaW4ub3Blbl9jaGF0KCk7XG4gICAgfSk7XG4gICAgLy8gYWRkIHNlYXJjaCBidXR0b25cbiAgICBjb25zdCBzZWFyY2hfYnV0dG9uID0gdG9wX2Jhci5jcmVhdGVFbChcImJ1dHRvblwiLCB7IGNsczogXCJzYy1zZWFyY2gtYnV0dG9uXCIgfSk7XG4gICAgLy8gYWRkIGljb24gdG8gc2VhcmNoIGJ1dHRvblxuICAgIE9ic2lkaWFuLnNldEljb24oc2VhcmNoX2J1dHRvbiwgXCJzZWFyY2hcIik7XG4gICAgLy8gYWRkIGNsaWNrIGxpc3RlbmVyIHRvIHNlYXJjaCBidXR0b25cbiAgICBzZWFyY2hfYnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiB7XG4gICAgICAvLyBlbXB0eSB0b3AgYmFyXG4gICAgICB0b3BfYmFyLmVtcHR5KCk7XG4gICAgICAvLyBjcmVhdGUgaW5wdXQgZWxlbWVudFxuICAgICAgY29uc3Qgc2VhcmNoX2NvbnRhaW5lciA9IHRvcF9iYXIuY3JlYXRlRWwoXCJkaXZcIiwgeyBjbHM6IFwic2VhcmNoLWlucHV0LWNvbnRhaW5lclwiIH0pO1xuICAgICAgY29uc3QgaW5wdXQgPSBzZWFyY2hfY29udGFpbmVyLmNyZWF0ZUVsKFwiaW5wdXRcIiwge1xuICAgICAgICBjbHM6IFwic2Mtc2VhcmNoLWlucHV0XCIsXG4gICAgICAgIHR5cGU6IFwic2VhcmNoXCIsXG4gICAgICAgIHBsYWNlaG9sZGVyOiBcIlR5cGUgdG8gc3RhcnQgc2VhcmNoLi4uXCIsIFxuICAgICAgfSk7XG4gICAgICAvLyBmb2N1cyBpbnB1dFxuICAgICAgaW5wdXQuZm9jdXMoKTtcbiAgICAgIC8vIGFkZCBrZXlkb3duIGxpc3RlbmVyIHRvIGlucHV0XG4gICAgICBpbnB1dC5hZGRFdmVudExpc3RlbmVyKFwia2V5ZG93blwiLCAoZXZlbnQpID0+IHtcbiAgICAgICAgLy8gaWYgZXNjYXBlIGtleSBpcyBwcmVzc2VkXG4gICAgICAgIGlmIChldmVudC5rZXkgPT09IFwiRXNjYXBlXCIpIHtcbiAgICAgICAgICB0aGlzLmNsZWFyX2F1dG9fc2VhcmNoZXIoKTtcbiAgICAgICAgICAvLyBjbGVhciB0b3AgYmFyXG4gICAgICAgICAgdGhpcy5pbml0aWF0ZV90b3BfYmFyKGNvbnRhaW5lciwgbmVhcmVzdF9jb250ZXh0KTtcbiAgICAgICAgfVxuICAgICAgfSk7XG5cbiAgICAgIC8vIGFkZCBrZXl1cCBsaXN0ZW5lciB0byBpbnB1dFxuICAgICAgaW5wdXQuYWRkRXZlbnRMaXN0ZW5lcihcImtleXVwXCIsIChldmVudCkgPT4ge1xuICAgICAgICAvLyBpZiB0aGlzLnNlYXJjaF90aW1lb3V0IGlzIG5vdCBudWxsIHRoZW4gY2xlYXIgaXQgYW5kIHNldCB0byBudWxsXG4gICAgICAgIHRoaXMuY2xlYXJfYXV0b19zZWFyY2hlcigpO1xuICAgICAgICAvLyBnZXQgc2VhcmNoIHRlcm1cbiAgICAgICAgY29uc3Qgc2VhcmNoX3Rlcm0gPSBpbnB1dC52YWx1ZTtcbiAgICAgICAgLy8gaWYgZW50ZXIga2V5IGlzIHByZXNzZWRcbiAgICAgICAgaWYgKGV2ZW50LmtleSA9PT0gXCJFbnRlclwiICYmIHNlYXJjaF90ZXJtICE9PSBcIlwiKSB7XG4gICAgICAgICAgdGhpcy5zZWFyY2goc2VhcmNoX3Rlcm0pO1xuICAgICAgICB9XG4gICAgICAgIC8vIGlmIGFueSBvdGhlciBrZXkgaXMgcHJlc3NlZCBhbmQgaW5wdXQgaXMgbm90IGVtcHR5IHRoZW4gd2FpdCA1MDBtcyBhbmQgbWFrZV9jb25uZWN0aW9uc1xuICAgICAgICBlbHNlIGlmIChzZWFyY2hfdGVybSAhPT0gXCJcIikge1xuICAgICAgICAgIC8vIGNsZWFyIHRpbWVvdXRcbiAgICAgICAgICBjbGVhclRpbWVvdXQodGhpcy5zZWFyY2hfdGltZW91dCk7XG4gICAgICAgICAgLy8gc2V0IHRpbWVvdXRcbiAgICAgICAgICB0aGlzLnNlYXJjaF90aW1lb3V0ID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgICAgICB0aGlzLnNlYXJjaChzZWFyY2hfdGVybSwgdHJ1ZSk7XG4gICAgICAgICAgfSwgNzAwKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cblxuICAvLyByZW5kZXIgYnV0dG9uczogXCJjcmVhdGVcIiBhbmQgXCJyZXRyeVwiIGZvciBsb2FkaW5nIGVtYmVkZGluZ3MuanNvbiBmaWxlXG4gIHJlbmRlcl9lbWJlZGRpbmdzX2J1dHRvbnMoKSB7XG4gICAgLy8gZ2V0IGNvbnRhaW5lciBlbGVtZW50XG4gICAgY29uc3QgY29udGFpbmVyID0gdGhpcy5jb250YWluZXJFbC5jaGlsZHJlblsxXTtcbiAgICAvLyBjbGVhciBjb250YWluZXJcbiAgICBjb250YWluZXIuZW1wdHkoKTtcbiAgICAvLyBjcmVhdGUgaGVhZGluZyB0aGF0IHNheXMgXCJFbWJlZGRpbmdzIGZpbGUgbm90IGZvdW5kXCJcbiAgICBjb250YWluZXIuY3JlYXRlRWwoXCJoMlwiLCB7IGNsczogXCJzY0hlYWRpbmdcIiwgdGV4dDogXCJFbWJlZGRpbmdzIGZpbGUgbm90IGZvdW5kXCIgfSk7XG4gICAgLy8gY3JlYXRlIGRpdiBmb3IgYnV0dG9uc1xuICAgIGNvbnN0IGJ1dHRvbl9kaXYgPSBjb250YWluZXIuY3JlYXRlRWwoXCJkaXZcIiwgeyBjbHM6IFwic2NCdXR0b25EaXZcIiB9KTtcbiAgICAvLyBjcmVhdGUgXCJjcmVhdGVcIiBidXR0b25cbiAgICBjb25zdCBjcmVhdGVfYnV0dG9uID0gYnV0dG9uX2Rpdi5jcmVhdGVFbChcImJ1dHRvblwiLCB7IGNsczogXCJzY0J1dHRvblwiLCB0ZXh0OiBcIkNyZWF0ZSBlbWJlZGRpbmdzLmpzb25cIiB9KTtcbiAgICAvLyBub3RlIHRoYXQgY3JlYXRpbmcgZW1iZWRkaW5ncy5qc29uIGZpbGUgd2lsbCB0cmlnZ2VyIGJ1bGsgZW1iZWRkaW5nIGFuZCBtYXkgdGFrZSBhIHdoaWxlXG4gICAgYnV0dG9uX2Rpdi5jcmVhdGVFbChcInBcIiwgeyBjbHM6IFwic2NCdXR0b25Ob3RlXCIsIHRleHQ6IFwiV2FybmluZzogQ3JlYXRpbmcgZW1iZWRkaW5ncy5qc29uIGZpbGUgd2lsbCB0cmlnZ2VyIGJ1bGsgZW1iZWRkaW5nIGFuZCBtYXkgdGFrZSBhIHdoaWxlXCIgfSk7XG4gICAgLy8gY3JlYXRlIFwicmV0cnlcIiBidXR0b25cbiAgICBjb25zdCByZXRyeV9idXR0b24gPSBidXR0b25fZGl2LmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHsgY2xzOiBcInNjQnV0dG9uXCIsIHRleHQ6IFwiUmV0cnlcIiB9KTtcbiAgICAvLyB0cnkgdG8gbG9hZCBlbWJlZGRpbmdzLmpzb24gZmlsZSBhZ2FpblxuICAgIGJ1dHRvbl9kaXYuY3JlYXRlRWwoXCJwXCIsIHsgY2xzOiBcInNjQnV0dG9uTm90ZVwiLCB0ZXh0OiBcIklmIGVtYmVkZGluZ3MuanNvbiBmaWxlIGFscmVhZHkgZXhpc3RzLCBjbGljayAnUmV0cnknIHRvIGxvYWQgaXRcIiB9KTtcblxuICAgIC8vIGFkZCBjbGljayBldmVudCB0byBcImNyZWF0ZVwiIGJ1dHRvblxuICAgIGNyZWF0ZV9idXR0b24uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIGFzeW5jIChldmVudCkgPT4ge1xuICAgICAgLy8gY3JlYXRlIGVtYmVkZGluZ3MuanNvbiBmaWxlXG4gICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zbWFydF92ZWNfbGl0ZS5pbml0X2VtYmVkZGluZ3NfZmlsZSgpO1xuICAgICAgLy8gcmVsb2FkIHZpZXdcbiAgICAgIGF3YWl0IHRoaXMucmVuZGVyX2Nvbm5lY3Rpb25zKCk7XG4gICAgfSk7XG5cbiAgICAvLyBhZGQgY2xpY2sgZXZlbnQgdG8gXCJyZXRyeVwiIGJ1dHRvblxuICAgIHJldHJ5X2J1dHRvbi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgYXN5bmMgKGV2ZW50KSA9PiB7XG4gICAgICBjb25zb2xlLmxvZyhcInJldHJ5aW5nIHRvIGxvYWQgZW1iZWRkaW5ncy5qc29uIGZpbGVcIik7XG4gICAgICAvLyByZWxvYWQgZW1iZWRkaW5ncy5qc29uIGZpbGVcbiAgICAgIGF3YWl0IHRoaXMucGx1Z2luLmluaXRfdmVjcygpO1xuICAgICAgLy8gcmVsb2FkIHZpZXdcbiAgICAgIGF3YWl0IHRoaXMucmVuZGVyX2Nvbm5lY3Rpb25zKCk7XG4gICAgfSk7XG4gIH1cblxuICBhc3luYyBvbk9wZW4oKSB7XG4gICAgY29uc3QgY29udGFpbmVyID0gdGhpcy5jb250YWluZXJFbC5jaGlsZHJlblsxXTtcbiAgICBjb250YWluZXIuZW1wdHkoKTtcbiAgICAvLyBwbGFjZWhvbGRlciB0ZXh0XG4gICAgY29udGFpbmVyLmNyZWF0ZUVsKFwicFwiLCB7IGNsczogXCJzY1BsYWNlaG9sZGVyXCIsIHRleHQ6IFwiT3BlbiBhIG5vdGUgdG8gZmluZCBjb25uZWN0aW9ucy5cIiB9KTsgXG5cbiAgICAvLyBydW5zIHdoZW4gZmlsZSBpcyBvcGVuZWRcbiAgICB0aGlzLnBsdWdpbi5yZWdpc3RlckV2ZW50KHRoaXMuYXBwLndvcmtzcGFjZS5vbignZmlsZS1vcGVuJywgKGZpbGUpID0+IHtcbiAgICAgIC8vIGlmIG5vIGZpbGUgaXMgb3BlbiwgcmV0dXJuXG4gICAgICBpZighZmlsZSkge1xuICAgICAgICAvLyBjb25zb2xlLmxvZyhcIm5vIGZpbGUgb3BlbiwgcmV0dXJuaW5nXCIpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICAvLyByZXR1cm4gaWYgZmlsZSB0eXBlIGlzIG5vdCBzdXBwb3J0ZWRcbiAgICAgIGlmKFNVUFBPUlRFRF9GSUxFX1RZUEVTLmluZGV4T2YoZmlsZS5leHRlbnNpb24pID09PSAtMSkge1xuICAgICAgICByZXR1cm4gdGhpcy5zZXRfbWVzc2FnZShbXG4gICAgICAgICAgXCJGaWxlOiBcIitmaWxlLm5hbWVcbiAgICAgICAgICAsXCJVbnN1cHBvcnRlZCBmaWxlIHR5cGUgKFN1cHBvcnRlZDogXCIrU1VQUE9SVEVEX0ZJTEVfVFlQRVMuam9pbihcIiwgXCIpK1wiKVwiXG4gICAgICAgIF0pO1xuICAgICAgfVxuICAgICAgLy8gcnVuIHJlbmRlcl9jb25uZWN0aW9ucyBhZnRlciAxIHNlY29uZCB0byBhbGxvdyBmb3IgZmlsZSB0byBsb2FkXG4gICAgICBpZih0aGlzLmxvYWRfd2FpdCl7XG4gICAgICAgIGNsZWFyVGltZW91dCh0aGlzLmxvYWRfd2FpdCk7XG4gICAgICB9XG4gICAgICB0aGlzLmxvYWRfd2FpdCA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICB0aGlzLnJlbmRlcl9jb25uZWN0aW9ucyhmaWxlKTtcbiAgICAgICAgdGhpcy5sb2FkX3dhaXQgPSBudWxsO1xuICAgICAgfSwgMTAwMCk7XG4gICAgICAgIFxuICAgIH0pKTtcblxuICAgIHRoaXMuYXBwLndvcmtzcGFjZS5yZWdpc3RlckhvdmVyTGlua1NvdXJjZShTTUFSVF9DT05ORUNUSU9OU19WSUVXX1RZUEUsIHtcbiAgICAgICAgZGlzcGxheTogJ1NtYXJ0IENvbm5lY3Rpb25zIEZpbGVzJyxcbiAgICAgICAgZGVmYXVsdE1vZDogdHJ1ZSxcbiAgICB9KTtcbiAgICB0aGlzLmFwcC53b3Jrc3BhY2UucmVnaXN0ZXJIb3ZlckxpbmtTb3VyY2UoU01BUlRfQ09OTkVDVElPTlNfQ0hBVF9WSUVXX1RZUEUsIHtcbiAgICAgICAgZGlzcGxheTogJ1NtYXJ0IENoYXQgTGlua3MnLFxuICAgICAgICBkZWZhdWx0TW9kOiB0cnVlLFxuICAgIH0pO1xuXG4gICAgdGhpcy5hcHAud29ya3NwYWNlLm9uTGF5b3V0UmVhZHkodGhpcy5pbml0aWFsaXplLmJpbmQodGhpcykpO1xuICAgIFxuICB9XG4gIFxuICBhc3luYyBpbml0aWFsaXplKCkge1xuICAgIHRoaXMuc2V0X21lc3NhZ2UoXCJMb2FkaW5nIGVtYmVkZGluZ3MgZmlsZS4uLlwiKTtcbiAgICBjb25zdCB2ZWNzX2ludGlhdGVkID0gYXdhaXQgdGhpcy5wbHVnaW4uaW5pdF92ZWNzKCk7XG4gICAgaWYodmVjc19pbnRpYXRlZCl7XG4gICAgICB0aGlzLnNldF9tZXNzYWdlKFwiRW1iZWRkaW5ncyBmaWxlIGxvYWRlZC5cIik7XG4gICAgICBhd2FpdCB0aGlzLnJlbmRlcl9jb25uZWN0aW9ucygpO1xuICAgIH1lbHNle1xuICAgICAgdGhpcy5yZW5kZXJfZW1iZWRkaW5nc19idXR0b25zKCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRVhQRVJJTUVOVEFMXG4gICAgICogLSB3aW5kb3ctYmFzZWQgQVBJIGFjY2Vzc1xuICAgICAqIC0gY29kZS1ibG9jayByZW5kZXJpbmdcbiAgICAgKi9cbiAgICB0aGlzLmFwaSA9IG5ldyBTbWFydENvbm5lY3Rpb25zVmlld0FwaSh0aGlzLmFwcCwgdGhpcy5wbHVnaW4sIHRoaXMpO1xuICAgIC8vIHJlZ2lzdGVyIEFQSSB0byBnbG9iYWwgd2luZG93IG9iamVjdFxuICAgICh3aW5kb3dbXCJTbWFydENvbm5lY3Rpb25zVmlld0FwaVwiXSA9IHRoaXMuYXBpKSAmJiB0aGlzLnJlZ2lzdGVyKCgpID0+IGRlbGV0ZSB3aW5kb3dbXCJTbWFydENvbm5lY3Rpb25zVmlld0FwaVwiXSk7XG5cbiAgfVxuXG4gIGFzeW5jIG9uQ2xvc2UoKSB7XG4gICAgY29uc29sZS5sb2coXCJjbG9zaW5nIHNtYXJ0IGNvbm5lY3Rpb25zIHZpZXdcIik7XG4gICAgdGhpcy5hcHAud29ya3NwYWNlLnVucmVnaXN0ZXJIb3ZlckxpbmtTb3VyY2UoU01BUlRfQ09OTkVDVElPTlNfVklFV19UWVBFKTtcbiAgICB0aGlzLnBsdWdpbi52aWV3ID0gbnVsbDtcbiAgfVxuXG4gIGFzeW5jIHJlbmRlcl9jb25uZWN0aW9ucyhjb250ZXh0PW51bGwpIHtcbiAgICBjb25zb2xlLmxvZyhcInJlbmRlcmluZyBjb25uZWN0aW9uc1wiKTtcbiAgICAvLyBpZiBBUEkga2V5IGlzIG5vdCBzZXQgdGhlbiB1cGRhdGUgdmlldyBtZXNzYWdlXG4gICAgaWYoIXRoaXMucGx1Z2luLnNldHRpbmdzLmFwaV9rZXkpIHtcbiAgICAgIHRoaXMuc2V0X21lc3NhZ2UoXCJBbiBPcGVuQUkgQVBJIGtleSBpcyByZXF1aXJlZCB0byBtYWtlIFNtYXJ0IENvbm5lY3Rpb25zXCIpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBpZighdGhpcy5wbHVnaW4uZW1iZWRkaW5nc19sb2FkZWQpe1xuICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uaW5pdF92ZWNzKCk7XG4gICAgfVxuICAgIC8vIGlmIGVtYmVkZGluZyBzdGlsbCBub3QgbG9hZGVkLCByZXR1cm5cbiAgICBpZighdGhpcy5wbHVnaW4uZW1iZWRkaW5nc19sb2FkZWQpIHtcbiAgICAgIGNvbnNvbGUubG9nKFwiZW1iZWRkaW5ncyBmaWxlcyBzdGlsbCBub3QgbG9hZGVkIG9yIHlldCB0byBiZSBjcmVhdGVkXCIpO1xuICAgICAgdGhpcy5yZW5kZXJfZW1iZWRkaW5nc19idXR0b25zKCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIHRoaXMuc2V0X21lc3NhZ2UoXCJNYWtpbmcgU21hcnQgQ29ubmVjdGlvbnMuLi5cIik7XG4gICAgLyoqXG4gICAgICogQmVnaW4gaGlnaGxpZ2h0ZWQtdGV4dC1sZXZlbCBzZWFyY2hcbiAgICAgKi9cbiAgICBpZih0eXBlb2YgY29udGV4dCA9PT0gXCJzdHJpbmdcIikge1xuICAgICAgY29uc3QgaGlnaGxpZ2h0ZWRfdGV4dCA9IGNvbnRleHQ7XG4gICAgICAvLyBnZXQgZW1iZWRkaW5nIGZvciBoaWdobGlnaHRlZCB0ZXh0XG4gICAgICBhd2FpdCB0aGlzLnNlYXJjaChoaWdobGlnaHRlZF90ZXh0KTtcbiAgICAgIHJldHVybjsgLy8gZW5kcyBoZXJlIGlmIGNvbnRleHQgaXMgYSBzdHJpbmdcbiAgICB9XG5cbiAgICAvKiogXG4gICAgICogQmVnaW4gZmlsZS1sZXZlbCBzZWFyY2hcbiAgICAgKi8gICAgXG4gICAgdGhpcy5uZWFyZXN0ID0gbnVsbDtcbiAgICB0aGlzLmludGVydmFsX2NvdW50ID0gMDtcbiAgICB0aGlzLnJlbmRlcmluZyA9IGZhbHNlO1xuICAgIHRoaXMuZmlsZSA9IGNvbnRleHQ7XG4gICAgLy8gaWYgdGhpcy5pbnRlcnZhbCBpcyBzZXQgdGhlbiBjbGVhciBpdFxuICAgIGlmKHRoaXMuaW50ZXJ2YWwpIHtcbiAgICAgIGNsZWFySW50ZXJ2YWwodGhpcy5pbnRlcnZhbCk7XG4gICAgICB0aGlzLmludGVydmFsID0gbnVsbDtcbiAgICB9XG4gICAgLy8gc2V0IGludGVydmFsIHRvIGNoZWNrIGlmIG5lYXJlc3QgaXMgc2V0XG4gICAgdGhpcy5pbnRlcnZhbCA9IHNldEludGVydmFsKCgpID0+IHtcbiAgICAgIGlmKCF0aGlzLnJlbmRlcmluZyl7XG4gICAgICAgIGlmKHRoaXMuZmlsZSBpbnN0YW5jZW9mIE9ic2lkaWFuLlRGaWxlKSB7XG4gICAgICAgICAgdGhpcy5yZW5kZXJpbmcgPSB0cnVlO1xuICAgICAgICAgIHRoaXMucmVuZGVyX25vdGVfY29ubmVjdGlvbnModGhpcy5maWxlKTtcbiAgICAgICAgfWVsc2V7XG4gICAgICAgICAgLy8gZ2V0IGN1cnJlbnQgbm90ZVxuICAgICAgICAgIHRoaXMuZmlsZSA9IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRBY3RpdmVGaWxlKCk7XG4gICAgICAgICAgLy8gaWYgc3RpbGwgbm8gY3VycmVudCBub3RlIHRoZW4gcmV0dXJuXG4gICAgICAgICAgaWYoIXRoaXMuZmlsZSAmJiB0aGlzLmNvdW50ID4gMSkge1xuICAgICAgICAgICAgY2xlYXJJbnRlcnZhbCh0aGlzLmludGVydmFsKTtcbiAgICAgICAgICAgIHRoaXMuc2V0X21lc3NhZ2UoXCJObyBhY3RpdmUgZmlsZVwiKTtcbiAgICAgICAgICAgIHJldHVybjsgXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9ZWxzZXtcbiAgICAgICAgaWYodGhpcy5uZWFyZXN0KSB7XG4gICAgICAgICAgY2xlYXJJbnRlcnZhbCh0aGlzLmludGVydmFsKTtcbiAgICAgICAgICAvLyBpZiBuZWFyZXN0IGlzIGEgc3RyaW5nIHRoZW4gdXBkYXRlIHZpZXcgbWVzc2FnZVxuICAgICAgICAgIGlmICh0eXBlb2YgdGhpcy5uZWFyZXN0ID09PSBcInN0cmluZ1wiKSB7XG4gICAgICAgICAgICB0aGlzLnNldF9tZXNzYWdlKHRoaXMubmVhcmVzdCk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIHNldCBuZWFyZXN0IGNvbm5lY3Rpb25zXG4gICAgICAgICAgICB0aGlzLnNldF9uZWFyZXN0KHRoaXMubmVhcmVzdCwgXCJGaWxlOiBcIiArIHRoaXMuZmlsZS5uYW1lKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgLy8gaWYgcmVuZGVyX2xvZy5mYWlsZWRfZW1iZWRkaW5ncyB0aGVuIHVwZGF0ZSBmYWlsZWRfZW1iZWRkaW5ncy50eHRcbiAgICAgICAgICBpZiAodGhpcy5wbHVnaW4ucmVuZGVyX2xvZy5mYWlsZWRfZW1iZWRkaW5ncy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICB0aGlzLnBsdWdpbi5zYXZlX2ZhaWxlZF9lbWJlZGRpbmdzKCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIC8vIGdldCBvYmplY3Qga2V5cyBvZiByZW5kZXJfbG9nXG4gICAgICAgICAgdGhpcy5wbHVnaW4ub3V0cHV0X3JlbmRlcl9sb2coKTtcbiAgICAgICAgICByZXR1cm47IFxuICAgICAgICB9ZWxzZXtcbiAgICAgICAgICB0aGlzLmludGVydmFsX2NvdW50Kys7XG4gICAgICAgICAgdGhpcy5zZXRfbWVzc2FnZShcIk1ha2luZyBTbWFydCBDb25uZWN0aW9ucy4uLlwiK3RoaXMuaW50ZXJ2YWxfY291bnQpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSwgMTApO1xuICB9XG5cbiAgYXN5bmMgcmVuZGVyX25vdGVfY29ubmVjdGlvbnMoZmlsZSkge1xuICAgIHRoaXMubmVhcmVzdCA9IGF3YWl0IHRoaXMucGx1Z2luLmZpbmRfbm90ZV9jb25uZWN0aW9ucyhmaWxlKTtcbiAgfVxuXG4gIGNsZWFyX2F1dG9fc2VhcmNoZXIoKSB7XG4gICAgaWYgKHRoaXMuc2VhcmNoX3RpbWVvdXQpIHtcbiAgICAgIGNsZWFyVGltZW91dCh0aGlzLnNlYXJjaF90aW1lb3V0KTtcbiAgICAgIHRoaXMuc2VhcmNoX3RpbWVvdXQgPSBudWxsO1xuICAgIH1cbiAgfVxuXG4gIGFzeW5jIHNlYXJjaChzZWFyY2hfdGV4dCwgcmVzdWx0c19vbmx5PWZhbHNlKSB7XG4gICAgY29uc3QgbmVhcmVzdCA9IGF3YWl0IHRoaXMucGx1Z2luLmFwaS5zZWFyY2goc2VhcmNoX3RleHQpO1xuICAgIC8vIHJlbmRlciByZXN1bHRzIGluIHZpZXcgd2l0aCBmaXJzdCAxMDAgY2hhcmFjdGVycyBvZiBzZWFyY2ggdGV4dFxuICAgIGNvbnN0IG5lYXJlc3RfY29udGV4dCA9IGBTZWxlY3Rpb246IFwiJHtzZWFyY2hfdGV4dC5sZW5ndGggPiAxMDAgPyBzZWFyY2hfdGV4dC5zdWJzdHJpbmcoMCwgMTAwKSArIFwiLi4uXCIgOiBzZWFyY2hfdGV4dH1cImA7XG4gICAgdGhpcy5zZXRfbmVhcmVzdChuZWFyZXN0LCBuZWFyZXN0X2NvbnRleHQsIHJlc3VsdHNfb25seSk7XG4gIH1cblxufVxuY2xhc3MgU21hcnRDb25uZWN0aW9uc1ZpZXdBcGkge1xuICBjb25zdHJ1Y3RvcihhcHAsIHBsdWdpbiwgdmlldykge1xuICAgIHRoaXMuYXBwID0gYXBwO1xuICAgIHRoaXMucGx1Z2luID0gcGx1Z2luO1xuICAgIHRoaXMudmlldyA9IHZpZXc7XG4gIH1cbiAgYXN5bmMgc2VhcmNoIChzZWFyY2hfdGV4dCkge1xuICAgIHJldHVybiBhd2FpdCB0aGlzLnBsdWdpbi5hcGkuc2VhcmNoKHNlYXJjaF90ZXh0KTtcbiAgfVxuICAvLyB0cmlnZ2VyIHJlbG9hZCBvZiBlbWJlZGRpbmdzIGZpbGVcbiAgYXN5bmMgcmVsb2FkX2VtYmVkZGluZ3NfZmlsZSgpIHtcbiAgICBhd2FpdCB0aGlzLnBsdWdpbi5pbml0X3ZlY3MoKTtcbiAgICBhd2FpdCB0aGlzLnZpZXcucmVuZGVyX2Nvbm5lY3Rpb25zKCk7XG4gIH1cbn1cbmNsYXNzIFNjU2VhcmNoQXBpIHtcbiAgY29uc3RydWN0b3IoYXBwLCBwbHVnaW4pIHtcbiAgICB0aGlzLmFwcCA9IGFwcDtcbiAgICB0aGlzLnBsdWdpbiA9IHBsdWdpbjtcbiAgfVxuICBhc3luYyBzZWFyY2ggKHNlYXJjaF90ZXh0LCBmaWx0ZXI9e30pIHtcbiAgICBmaWx0ZXIgPSB7XG4gICAgICBza2lwX3NlY3Rpb25zOiB0aGlzLnBsdWdpbi5zZXR0aW5ncy5za2lwX3NlY3Rpb25zLFxuICAgICAgLi4uZmlsdGVyXG4gICAgfVxuICAgIGxldCBuZWFyZXN0ID0gW107XG4gICAgY29uc3QgcmVzcCA9IGF3YWl0IHRoaXMucGx1Z2luLnJlcXVlc3RfZW1iZWRkaW5nX2Zyb21faW5wdXQoc2VhcmNoX3RleHQpO1xuICAgIGlmIChyZXNwICYmIHJlc3AuZGF0YSAmJiByZXNwLmRhdGFbMF0gJiYgcmVzcC5kYXRhWzBdLmVtYmVkZGluZykge1xuICAgICAgbmVhcmVzdCA9IHRoaXMucGx1Z2luLnNtYXJ0X3ZlY19saXRlLm5lYXJlc3QocmVzcC5kYXRhWzBdLmVtYmVkZGluZywgZmlsdGVyKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gcmVzcCBpcyBudWxsLCB1bmRlZmluZWQsIG9yIG1pc3NpbmcgZGF0YVxuICAgICAgbmV3IE9ic2lkaWFuLk5vdGljZShcIlNtYXJ0IENvbm5lY3Rpb25zOiBFcnJvciBnZXR0aW5nIGVtYmVkZGluZ1wiKTtcbiAgICB9XG4gICAgcmV0dXJuIG5lYXJlc3Q7XG4gIH1cbn1cblxuY2xhc3MgU21hcnRDb25uZWN0aW9uc1NldHRpbmdzVGFiIGV4dGVuZHMgT2JzaWRpYW4uUGx1Z2luU2V0dGluZ1RhYiB7XG4gIGNvbnN0cnVjdG9yKGFwcCwgcGx1Z2luKSB7XG4gICAgc3VwZXIoYXBwLCBwbHVnaW4pO1xuICAgIHRoaXMucGx1Z2luID0gcGx1Z2luO1xuICB9XG4gIGRpc3BsYXkoKSB7XG4gICAgY29uc3Qge1xuICAgICAgY29udGFpbmVyRWxcbiAgICB9ID0gdGhpcztcbiAgICBjb250YWluZXJFbC5lbXB0eSgpO1xuICAgIGNvbnRhaW5lckVsLmNyZWF0ZUVsKFwiaDJcIiwge1xuICAgICAgdGV4dDogXCJTdXBwb3J0ZXIgU2V0dGluZ3NcIlxuICAgIH0pO1xuICAgIC8vIGxpc3Qgc3VwcG9ydGVyIGJlbmVmaXRzXG4gICAgY29udGFpbmVyRWwuY3JlYXRlRWwoXCJwXCIsIHtcbiAgICAgIHRleHQ6IFwiQXMgYSBTbWFydCBDb25uZWN0aW9ucyBcXFwiU3VwcG9ydGVyXFxcIiwgZmFzdC10cmFjayB5b3VyIFBLTSBqb3VybmV5IHdpdGggcHJpb3JpdHkgcGVya3MgYW5kIHBpb25lZXJpbmcgaW5ub3ZhdGlvbnMuXCJcbiAgICB9KTtcbiAgICAvLyB0aHJlZSBsaXN0IGl0ZW1zXG4gICAgY29uc3Qgc3VwcG9ydGVyX2JlbmVmaXRzX2xpc3QgPSBjb250YWluZXJFbC5jcmVhdGVFbChcInVsXCIpO1xuICAgIHN1cHBvcnRlcl9iZW5lZml0c19saXN0LmNyZWF0ZUVsKFwibGlcIiwge1xuICAgICAgdGV4dDogXCJFbmpveSBzd2lmdCwgdG9wLXByaW9yaXR5IHN1cHBvcnQuXCJcbiAgICB9KTtcbiAgICBzdXBwb3J0ZXJfYmVuZWZpdHNfbGlzdC5jcmVhdGVFbChcImxpXCIsIHtcbiAgICAgIHRleHQ6IFwiR2FpbiBlYXJseSBhY2Nlc3MgdG8gZXhwZXJpbWVudGFsIGZlYXR1cmVzIGxpa2UgdGhlIENoYXRHUFQgcGx1Z2luLlwiXG4gICAgfSk7XG4gICAgc3VwcG9ydGVyX2JlbmVmaXRzX2xpc3QuY3JlYXRlRWwoXCJsaVwiLCB7XG4gICAgICB0ZXh0OiBcIlN0YXkgaW5mb3JtZWQgYW5kIGVuZ2FnZWQgd2l0aCBleGNsdXNpdmUgc3VwcG9ydGVyLW9ubHkgY29tbXVuaWNhdGlvbnMuXCJcbiAgICB9KTtcbiAgICAvLyBhZGQgYSB0ZXh0IGlucHV0IHRvIGVudGVyIHN1cHBvcnRlciBsaWNlbnNlIGtleVxuICAgIG5ldyBPYnNpZGlhbi5TZXR0aW5nKGNvbnRhaW5lckVsKS5zZXROYW1lKFwiU3VwcG9ydGVyIExpY2Vuc2UgS2V5XCIpLnNldERlc2MoXCJOb3RlOiB0aGlzIGlzIG5vdCByZXF1aXJlZCB0byB1c2UgU21hcnQgQ29ubmVjdGlvbnMuXCIpLmFkZFRleHQoKHRleHQpID0+IHRleHQuc2V0UGxhY2Vob2xkZXIoXCJFbnRlciB5b3VyIGxpY2Vuc2Vfa2V5XCIpLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmxpY2Vuc2Vfa2V5KS5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcbiAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLmxpY2Vuc2Vfa2V5ID0gdmFsdWUudHJpbSgpO1xuICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKHRydWUpO1xuICAgIH0pKTtcbiAgICAvLyBhZGQgYnV0dG9uIHRvIHRyaWdnZXIgc3luYyBub3RlcyB0byB1c2Ugd2l0aCBDaGF0R1BUXG4gICAgbmV3IE9ic2lkaWFuLlNldHRpbmcoY29udGFpbmVyRWwpLnNldE5hbWUoXCJTeW5jIE5vdGVzXCIpLnNldERlc2MoXCJNYWtlIG5vdGVzIGF2YWlsYWJsZSB2aWEgdGhlIFNtYXJ0IENvbm5lY3Rpb25zIENoYXRHUFQgUGx1Z2luLiBSZXNwZWN0cyBleGNsdXNpb24gc2V0dGluZ3MgY29uZmlndXJlZCBiZWxvdy5cIikuYWRkQnV0dG9uKChidXR0b24pID0+IGJ1dHRvbi5zZXRCdXR0b25UZXh0KFwiU3luYyBOb3Rlc1wiKS5vbkNsaWNrKGFzeW5jICgpID0+IHtcbiAgICAgIC8vIHN5bmMgbm90ZXNcbiAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnN5bmNfbm90ZXMoKTtcbiAgICB9KSk7XG4gICAgLy8gYWRkIGJ1dHRvbiB0byBiZWNvbWUgYSBzdXBwb3J0ZXJcbiAgICBuZXcgT2JzaWRpYW4uU2V0dGluZyhjb250YWluZXJFbCkuc2V0TmFtZShcIkJlY29tZSBhIFN1cHBvcnRlclwiKS5zZXREZXNjKFwiQmVjb21lIGEgU3VwcG9ydGVyXCIpLmFkZEJ1dHRvbigoYnV0dG9uKSA9PiBidXR0b24uc2V0QnV0dG9uVGV4dChcIkJlY29tZSBhIFN1cHBvcnRlclwiKS5vbkNsaWNrKGFzeW5jICgpID0+IHtcbiAgICAgIC8vIG9wZW4gc3VwcG9ydGVyIHBhZ2UgaW4gYnJvd3NlclxuICAgICAgd2luZG93Lm9wZW4oXCJodHRwczovL2J1eS5zdHJpcGUuY29tLzlBUTVrTzVRbmJBV2dHQWJJWVwiKTtcbiAgICB9KSk7XG5cbiAgICBcbiAgICBjb250YWluZXJFbC5jcmVhdGVFbChcImgyXCIsIHtcbiAgICAgIHRleHQ6IFwiT3BlbkFJIFNldHRpbmdzXCJcbiAgICB9KTtcbiAgICAvLyBhZGQgYSB0ZXh0IGlucHV0IHRvIGVudGVyIHRoZSBBUEkga2V5XG4gICAgbmV3IE9ic2lkaWFuLlNldHRpbmcoY29udGFpbmVyRWwpLnNldE5hbWUoXCJPcGVuQUkgQVBJIEtleVwiKS5zZXREZXNjKFwiUmVxdWlyZWQ6IGFuIE9wZW5BSSBBUEkga2V5IGlzIGN1cnJlbnRseSByZXF1aXJlZCB0byB1c2UgU21hcnQgQ29ubmVjdGlvbnMuXCIpLmFkZFRleHQoKHRleHQpID0+IHRleHQuc2V0UGxhY2Vob2xkZXIoXCJFbnRlciB5b3VyIGFwaV9rZXlcIikuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MuYXBpX2tleSkub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG4gICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5hcGlfa2V5ID0gdmFsdWUudHJpbSgpO1xuICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKHRydWUpO1xuICAgIH0pKTtcbiAgICAvLyBhZGQgYSBidXR0b24gdG8gdGVzdCB0aGUgQVBJIGtleSBpcyB3b3JraW5nXG4gICAgbmV3IE9ic2lkaWFuLlNldHRpbmcoY29udGFpbmVyRWwpLnNldE5hbWUoXCJUZXN0IEFQSSBLZXlcIikuc2V0RGVzYyhcIlRlc3QgQVBJIEtleVwiKS5hZGRCdXR0b24oKGJ1dHRvbikgPT4gYnV0dG9uLnNldEJ1dHRvblRleHQoXCJUZXN0IEFQSSBLZXlcIikub25DbGljayhhc3luYyAoKSA9PiB7XG4gICAgICAvLyB0ZXN0IEFQSSBrZXlcbiAgICAgIGNvbnN0IHJlc3AgPSBhd2FpdCB0aGlzLnBsdWdpbi50ZXN0X2FwaV9rZXkoKTtcbiAgICAgIGlmKHJlc3ApIHtcbiAgICAgICAgbmV3IE9ic2lkaWFuLk5vdGljZShcIlNtYXJ0IENvbm5lY3Rpb25zOiBBUEkga2V5IGlzIHZhbGlkXCIpO1xuICAgICAgfWVsc2V7XG4gICAgICAgIG5ldyBPYnNpZGlhbi5Ob3RpY2UoXCJTbWFydCBDb25uZWN0aW9uczogQVBJIGtleSBpcyBub3Qgd29ya2luZyBhcyBleHBlY3RlZCFcIik7XG4gICAgICB9XG4gICAgfSkpO1xuICAgIC8vIGFkZCBkcm9wZG93biB0byBzZWxlY3QgdGhlIG1vZGVsXG4gICAgbmV3IE9ic2lkaWFuLlNldHRpbmcoY29udGFpbmVyRWwpLnNldE5hbWUoXCJTbWFydCBDaGF0IE1vZGVsXCIpLnNldERlc2MoXCJTZWxlY3QgYSBtb2RlbCB0byB1c2Ugd2l0aCBTbWFydCBDaGF0LlwiKS5hZGREcm9wZG93bigoZHJvcGRvd24pID0+IHtcbiAgICAgIGRyb3Bkb3duLmFkZE9wdGlvbihcImdwdC0zLjUtdHVyYm8tMTZrXCIsIFwiZ3B0LTMuNS10dXJiby0xNmtcIik7XG4gICAgICBkcm9wZG93bi5hZGRPcHRpb24oXCJncHQtNFwiLCBcImdwdC00IChsaW1pdGVkIGFjY2VzcywgOGspXCIpO1xuICAgICAgZHJvcGRvd24uYWRkT3B0aW9uKFwiZ3B0LTMuNS10dXJib1wiLCBcImdwdC0zLjUtdHVyYm8gKDRrKVwiKTtcbiAgICAgIGRyb3Bkb3duLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5zbWFydF9jaGF0X21vZGVsID0gdmFsdWU7XG4gICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuICAgICAgfSk7XG4gICAgICBkcm9wZG93bi5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5zbWFydF9jaGF0X21vZGVsKTtcbiAgICB9KTtcbiAgICAvLyBsYW5ndWFnZVxuICAgIG5ldyBPYnNpZGlhbi5TZXR0aW5nKGNvbnRhaW5lckVsKS5zZXROYW1lKFwiRGVmYXVsdCBMYW5ndWFnZVwiKS5zZXREZXNjKFwiRGVmYXVsdCBsYW5ndWFnZSB0byB1c2UgZm9yIFNtYXJ0IENoYXQuIENoYW5nZXMgd2hpY2ggc2VsZi1yZWZlcmVudGlhbCBwcm9ub3VucyB3aWxsIHRyaWdnZXIgbG9va3VwIG9mIHlvdXIgbm90ZXMuXCIpLmFkZERyb3Bkb3duKChkcm9wZG93bikgPT4ge1xuICAgICAgLy8gZ2V0IE9iamVjdCBrZXlzIGZyb20gcHJvbm91c1xuICAgICAgY29uc3QgbGFuZ3VhZ2VzID0gT2JqZWN0LmtleXMoU01BUlRfVFJBTlNMQVRJT04pO1xuICAgICAgZm9yKGxldCBpID0gMDsgaSA8IGxhbmd1YWdlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICBkcm9wZG93bi5hZGRPcHRpb24obGFuZ3VhZ2VzW2ldLCBsYW5ndWFnZXNbaV0pO1xuICAgICAgfVxuICAgICAgZHJvcGRvd24ub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG4gICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLmxhbmd1YWdlID0gdmFsdWU7XG4gICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuICAgICAgICBzZWxmX3JlZl9wcm9ub3Vuc19saXN0LnNldFRleHQodGhpcy5nZXRfc2VsZl9yZWZfbGlzdCgpKTtcbiAgICAgICAgLy8gaWYgY2hhdCB2aWV3IGlzIG9wZW4gdGhlbiBydW4gbmV3X2NoYXQoKVxuICAgICAgICBjb25zdCBjaGF0X3ZpZXcgPSB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0TGVhdmVzT2ZUeXBlKFNNQVJUX0NPTk5FQ1RJT05TX0NIQVRfVklFV19UWVBFKS5sZW5ndGggPiAwID8gdGhpcy5hcHAud29ya3NwYWNlLmdldExlYXZlc09mVHlwZShTTUFSVF9DT05ORUNUSU9OU19DSEFUX1ZJRVdfVFlQRSlbMF0udmlldyA6IG51bGw7XG4gICAgICAgIGlmKGNoYXRfdmlldykge1xuICAgICAgICAgIGNoYXRfdmlldy5uZXdfY2hhdCgpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICAgIGRyb3Bkb3duLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmxhbmd1YWdlKTtcbiAgICB9KTtcbiAgICAvLyBsaXN0IGN1cnJlbnQgc2VsZi1yZWZlcmVudGlhbCBwcm9ub3Vuc1xuICAgIGNvbnN0IHNlbGZfcmVmX3Byb25vdW5zX2xpc3QgPSBjb250YWluZXJFbC5jcmVhdGVFbChcInNwYW5cIiwge1xuICAgICAgdGV4dDogdGhpcy5nZXRfc2VsZl9yZWZfbGlzdCgpXG4gICAgfSk7XG4gICAgY29udGFpbmVyRWwuY3JlYXRlRWwoXCJoMlwiLCB7XG4gICAgICB0ZXh0OiBcIkV4Y2x1c2lvbnNcIlxuICAgIH0pO1xuICAgIC8vIGxpc3QgZmlsZSBleGNsdXNpb25zXG4gICAgbmV3IE9ic2lkaWFuLlNldHRpbmcoY29udGFpbmVyRWwpLnNldE5hbWUoXCJmaWxlX2V4Y2x1c2lvbnNcIikuc2V0RGVzYyhcIidFeGNsdWRlZCBmaWxlJyBtYXRjaGVycyBzZXBhcmF0ZWQgYnkgYSBjb21tYS5cIikuYWRkVGV4dCgodGV4dCkgPT4gdGV4dC5zZXRQbGFjZWhvbGRlcihcImRyYXdpbmdzLHByb21wdHMvbG9nc1wiKS5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5maWxlX2V4Y2x1c2lvbnMpLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MuZmlsZV9leGNsdXNpb25zID0gdmFsdWU7XG4gICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcbiAgICB9KSk7XG4gICAgLy8gbGlzdCBmb2xkZXIgZXhjbHVzaW9uc1xuICAgIG5ldyBPYnNpZGlhbi5TZXR0aW5nKGNvbnRhaW5lckVsKS5zZXROYW1lKFwiZm9sZGVyX2V4Y2x1c2lvbnNcIikuc2V0RGVzYyhcIidFeGNsdWRlZCBmb2xkZXInIG1hdGNoZXJzIHNlcGFyYXRlZCBieSBhIGNvbW1hLlwiKS5hZGRUZXh0KCh0ZXh0KSA9PiB0ZXh0LnNldFBsYWNlaG9sZGVyKFwiZHJhd2luZ3MscHJvbXB0cy9sb2dzXCIpLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmZvbGRlcl9leGNsdXNpb25zKS5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcbiAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLmZvbGRlcl9leGNsdXNpb25zID0gdmFsdWU7XG4gICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcbiAgICB9KSk7XG4gICAgLy8gbGlzdCBwYXRoIG9ubHkgbWF0Y2hlcnNcbiAgICBuZXcgT2JzaWRpYW4uU2V0dGluZyhjb250YWluZXJFbCkuc2V0TmFtZShcInBhdGhfb25seVwiKS5zZXREZXNjKFwiJ1BhdGggb25seScgbWF0Y2hlcnMgc2VwYXJhdGVkIGJ5IGEgY29tbWEuXCIpLmFkZFRleHQoKHRleHQpID0+IHRleHQuc2V0UGxhY2Vob2xkZXIoXCJkcmF3aW5ncyxwcm9tcHRzL2xvZ3NcIikuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MucGF0aF9vbmx5KS5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcbiAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLnBhdGhfb25seSA9IHZhbHVlO1xuICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG4gICAgfSkpO1xuICAgIC8vIGxpc3QgaGVhZGVyIGV4Y2x1c2lvbnNcbiAgICBuZXcgT2JzaWRpYW4uU2V0dGluZyhjb250YWluZXJFbCkuc2V0TmFtZShcImhlYWRlcl9leGNsdXNpb25zXCIpLnNldERlc2MoXCInRXhjbHVkZWQgaGVhZGVyJyBtYXRjaGVycyBzZXBhcmF0ZWQgYnkgYSBjb21tYS4gV29ya3MgZm9yICdibG9ja3MnIG9ubHkuXCIpLmFkZFRleHQoKHRleHQpID0+IHRleHQuc2V0UGxhY2Vob2xkZXIoXCJkcmF3aW5ncyxwcm9tcHRzL2xvZ3NcIikuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MuaGVhZGVyX2V4Y2x1c2lvbnMpLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MuaGVhZGVyX2V4Y2x1c2lvbnMgPSB2YWx1ZTtcbiAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuICAgIH0pKTtcbiAgICBjb250YWluZXJFbC5jcmVhdGVFbChcImgyXCIsIHtcbiAgICAgIHRleHQ6IFwiRGlzcGxheVwiXG4gICAgfSk7XG4gICAgLy8gdG9nZ2xlIHNob3dpbmcgZnVsbCBwYXRoIGluIHZpZXdcbiAgICBuZXcgT2JzaWRpYW4uU2V0dGluZyhjb250YWluZXJFbCkuc2V0TmFtZShcInNob3dfZnVsbF9wYXRoXCIpLnNldERlc2MoXCJTaG93IGZ1bGwgcGF0aCBpbiB2aWV3LlwiKS5hZGRUb2dnbGUoKHRvZ2dsZSkgPT4gdG9nZ2xlLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLnNob3dfZnVsbF9wYXRoKS5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcbiAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLnNob3dfZnVsbF9wYXRoID0gdmFsdWU7XG4gICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3ModHJ1ZSk7XG4gICAgfSkpO1xuICAgIC8vIHRvZ2dsZSBleHBhbmRlZCB2aWV3IGJ5IGRlZmF1bHRcbiAgICBuZXcgT2JzaWRpYW4uU2V0dGluZyhjb250YWluZXJFbCkuc2V0TmFtZShcImV4cGFuZGVkX3ZpZXdcIikuc2V0RGVzYyhcIkV4cGFuZGVkIHZpZXcgYnkgZGVmYXVsdC5cIikuYWRkVG9nZ2xlKCh0b2dnbGUpID0+IHRvZ2dsZS5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5leHBhbmRlZF92aWV3KS5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcbiAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLmV4cGFuZGVkX3ZpZXcgPSB2YWx1ZTtcbiAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncyh0cnVlKTtcbiAgICB9KSk7XG4gICAgLy8gdG9nZ2xlIGdyb3VwIG5lYXJlc3QgYnkgZmlsZVxuICAgIG5ldyBPYnNpZGlhbi5TZXR0aW5nKGNvbnRhaW5lckVsKS5zZXROYW1lKFwiZ3JvdXBfbmVhcmVzdF9ieV9maWxlXCIpLnNldERlc2MoXCJHcm91cCBuZWFyZXN0IGJ5IGZpbGUuXCIpLmFkZFRvZ2dsZSgodG9nZ2xlKSA9PiB0b2dnbGUuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MuZ3JvdXBfbmVhcmVzdF9ieV9maWxlKS5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcbiAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLmdyb3VwX25lYXJlc3RfYnlfZmlsZSA9IHZhbHVlO1xuICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKHRydWUpO1xuICAgIH0pKTtcbiAgICAvLyB0b2dnbGUgdmlld19vcGVuIG9uIE9ic2lkaWFuIHN0YXJ0dXBcbiAgICBuZXcgT2JzaWRpYW4uU2V0dGluZyhjb250YWluZXJFbCkuc2V0TmFtZShcInZpZXdfb3BlblwiKS5zZXREZXNjKFwiT3BlbiB2aWV3IG9uIE9ic2lkaWFuIHN0YXJ0dXAuXCIpLmFkZFRvZ2dsZSgodG9nZ2xlKSA9PiB0b2dnbGUuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3Mudmlld19vcGVuKS5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcbiAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLnZpZXdfb3BlbiA9IHZhbHVlO1xuICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKHRydWUpO1xuICAgIH0pKTtcbiAgICAvLyB0b2dnbGUgY2hhdF9vcGVuIG9uIE9ic2lkaWFuIHN0YXJ0dXBcbiAgICBuZXcgT2JzaWRpYW4uU2V0dGluZyhjb250YWluZXJFbCkuc2V0TmFtZShcImNoYXRfb3BlblwiKS5zZXREZXNjKFwiT3BlbiB2aWV3IG9uIE9ic2lkaWFuIHN0YXJ0dXAuXCIpLmFkZFRvZ2dsZSgodG9nZ2xlKSA9PiB0b2dnbGUuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MuY2hhdF9vcGVuKS5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcbiAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLmNoYXRfb3BlbiA9IHZhbHVlO1xuICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKHRydWUpO1xuICAgIH0pKTtcbiAgICBjb250YWluZXJFbC5jcmVhdGVFbChcImgyXCIsIHtcbiAgICAgIHRleHQ6IFwiQWR2YW5jZWRcIlxuICAgIH0pO1xuICAgIC8vIHRvZ2dsZSBsb2dfcmVuZGVyXG4gICAgbmV3IE9ic2lkaWFuLlNldHRpbmcoY29udGFpbmVyRWwpLnNldE5hbWUoXCJsb2dfcmVuZGVyXCIpLnNldERlc2MoXCJMb2cgcmVuZGVyIGRldGFpbHMgdG8gY29uc29sZSAoaW5jbHVkZXMgdG9rZW5fdXNhZ2UpLlwiKS5hZGRUb2dnbGUoKHRvZ2dsZSkgPT4gdG9nZ2xlLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmxvZ19yZW5kZXIpLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MubG9nX3JlbmRlciA9IHZhbHVlO1xuICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKHRydWUpO1xuICAgIH0pKTtcbiAgICAvLyB0b2dnbGUgZmlsZXMgaW4gbG9nX3JlbmRlclxuICAgIG5ldyBPYnNpZGlhbi5TZXR0aW5nKGNvbnRhaW5lckVsKS5zZXROYW1lKFwibG9nX3JlbmRlcl9maWxlc1wiKS5zZXREZXNjKFwiTG9nIGVtYmVkZGVkIG9iamVjdHMgcGF0aHMgd2l0aCBsb2cgcmVuZGVyIChmb3IgZGVidWdnaW5nKS5cIikuYWRkVG9nZ2xlKCh0b2dnbGUpID0+IHRvZ2dsZS5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5sb2dfcmVuZGVyX2ZpbGVzKS5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcbiAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLmxvZ19yZW5kZXJfZmlsZXMgPSB2YWx1ZTtcbiAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncyh0cnVlKTtcbiAgICB9KSk7XG4gICAgLy8gdG9nZ2xlIHNraXBfc2VjdGlvbnNcbiAgICBuZXcgT2JzaWRpYW4uU2V0dGluZyhjb250YWluZXJFbCkuc2V0TmFtZShcInNraXBfc2VjdGlvbnNcIikuc2V0RGVzYyhcIlNraXBzIG1ha2luZyBjb25uZWN0aW9ucyB0byBzcGVjaWZpYyBzZWN0aW9ucyB3aXRoaW4gbm90ZXMuIFdhcm5pbmc6IHJlZHVjZXMgdXNlZnVsbmVzcyBmb3IgbGFyZ2UgZmlsZXMgYW5kIHJlcXVpcmVzICdGb3JjZSBSZWZyZXNoJyBmb3Igc2VjdGlvbnMgdG8gd29yayBpbiB0aGUgZnV0dXJlLlwiKS5hZGRUb2dnbGUoKHRvZ2dsZSkgPT4gdG9nZ2xlLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLnNraXBfc2VjdGlvbnMpLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3Muc2tpcF9zZWN0aW9ucyA9IHZhbHVlO1xuICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKHRydWUpO1xuICAgIH0pKTtcbiAgICAvLyB0ZXN0IGZpbGUgd3JpdGluZyBieSBjcmVhdGluZyBhIHRlc3QgZmlsZSwgdGhlbiB3cml0aW5nIGFkZGl0aW9uYWwgZGF0YSB0byB0aGUgZmlsZSwgYW5kIHJldHVybmluZyBhbnkgZXJyb3IgdGV4dCBpZiBpdCBmYWlsc1xuICAgIGNvbnRhaW5lckVsLmNyZWF0ZUVsKFwiaDNcIiwge1xuICAgICAgdGV4dDogXCJUZXN0IEZpbGUgV3JpdGluZ1wiXG4gICAgfSk7XG4gICAgLy8gbWFudWFsIHNhdmUgYnV0dG9uXG4gICAgY29udGFpbmVyRWwuY3JlYXRlRWwoXCJoM1wiLCB7XG4gICAgICB0ZXh0OiBcIk1hbnVhbCBTYXZlXCJcbiAgICB9KTtcbiAgICBsZXQgbWFudWFsX3NhdmVfcmVzdWx0cyA9IGNvbnRhaW5lckVsLmNyZWF0ZUVsKFwiZGl2XCIpO1xuICAgIG5ldyBPYnNpZGlhbi5TZXR0aW5nKGNvbnRhaW5lckVsKS5zZXROYW1lKFwibWFudWFsX3NhdmVcIikuc2V0RGVzYyhcIlNhdmUgY3VycmVudCBlbWJlZGRpbmdzXCIpLmFkZEJ1dHRvbigoYnV0dG9uKSA9PiBidXR0b24uc2V0QnV0dG9uVGV4dChcIk1hbnVhbCBTYXZlXCIpLm9uQ2xpY2soYXN5bmMgKCkgPT4ge1xuICAgICAgLy8gY29uZmlybVxuICAgICAgaWYgKGNvbmZpcm0oXCJBcmUgeW91IHN1cmUgeW91IHdhbnQgdG8gc2F2ZSB5b3VyIGN1cnJlbnQgZW1iZWRkaW5ncz9cIikpIHtcbiAgICAgICAgLy8gc2F2ZVxuICAgICAgICB0cnl7XG4gICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZV9lbWJlZGRpbmdzX3RvX2ZpbGUodHJ1ZSk7XG4gICAgICAgICAgbWFudWFsX3NhdmVfcmVzdWx0cy5pbm5lckhUTUwgPSBcIkVtYmVkZGluZ3Mgc2F2ZWQgc3VjY2Vzc2Z1bGx5LlwiO1xuICAgICAgICB9Y2F0Y2goZSl7XG4gICAgICAgICAgbWFudWFsX3NhdmVfcmVzdWx0cy5pbm5lckhUTUwgPSBcIkVtYmVkZGluZ3MgZmFpbGVkIHRvIHNhdmUuIEVycm9yOiBcIiArIGU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KSk7XG5cbiAgICAvLyBsaXN0IHByZXZpb3VzbHkgZmFpbGVkIGZpbGVzXG4gICAgY29udGFpbmVyRWwuY3JlYXRlRWwoXCJoM1wiLCB7XG4gICAgICB0ZXh0OiBcIlByZXZpb3VzbHkgZmFpbGVkIGZpbGVzXCJcbiAgICB9KTtcbiAgICBsZXQgZmFpbGVkX2xpc3QgPSBjb250YWluZXJFbC5jcmVhdGVFbChcImRpdlwiKTtcbiAgICB0aGlzLmRyYXdfZmFpbGVkX2ZpbGVzX2xpc3QoZmFpbGVkX2xpc3QpO1xuXG4gICAgLy8gZm9yY2UgcmVmcmVzaCBidXR0b25cbiAgICBjb250YWluZXJFbC5jcmVhdGVFbChcImgzXCIsIHtcbiAgICAgIHRleHQ6IFwiRm9yY2UgUmVmcmVzaFwiXG4gICAgfSk7XG4gICAgbmV3IE9ic2lkaWFuLlNldHRpbmcoY29udGFpbmVyRWwpLnNldE5hbWUoXCJmb3JjZV9yZWZyZXNoXCIpLnNldERlc2MoXCJXQVJOSU5HOiBETyBOT1QgdXNlIHVubGVzcyB5b3Uga25vdyB3aGF0IHlvdSBhcmUgZG9pbmchIFRoaXMgd2lsbCBkZWxldGUgYWxsIG9mIHlvdXIgY3VycmVudCBlbWJlZGRpbmdzIGZyb20gT3BlbkFJIGFuZCB0cmlnZ2VyIHJlcHJvY2Vzc2luZyBvZiB5b3VyIGVudGlyZSB2YXVsdCFcIikuYWRkQnV0dG9uKChidXR0b24pID0+IGJ1dHRvbi5zZXRCdXR0b25UZXh0KFwiRm9yY2UgUmVmcmVzaFwiKS5vbkNsaWNrKGFzeW5jICgpID0+IHtcbiAgICAgIC8vIGNvbmZpcm1cbiAgICAgIGlmIChjb25maXJtKFwiQXJlIHlvdSBzdXJlIHlvdSB3YW50IHRvIEZvcmNlIFJlZnJlc2g/IEJ5IGNsaWNraW5nIHllcyB5b3UgY29uZmlybSB0aGF0IHlvdSB1bmRlcnN0YW5kIHRoZSBjb25zZXF1ZW5jZXMgb2YgdGhpcyBhY3Rpb24uXCIpKSB7XG4gICAgICAgIC8vIGZvcmNlIHJlZnJlc2hcbiAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uZm9yY2VfcmVmcmVzaF9lbWJlZGRpbmdzX2ZpbGUoKTtcbiAgICAgIH1cbiAgICB9KSk7XG5cbiAgfVxuICBnZXRfc2VsZl9yZWZfbGlzdCgpIHtcbiAgICByZXR1cm4gXCJDdXJyZW50OiBcIiArIFNNQVJUX1RSQU5TTEFUSU9OW3RoaXMucGx1Z2luLnNldHRpbmdzLmxhbmd1YWdlXS5wcm9ub3VzLmpvaW4oXCIsIFwiKTtcbiAgfVxuXG4gIGRyYXdfZmFpbGVkX2ZpbGVzX2xpc3QoZmFpbGVkX2xpc3QpIHtcbiAgICBmYWlsZWRfbGlzdC5lbXB0eSgpO1xuICAgIGlmKHRoaXMucGx1Z2luLnNldHRpbmdzLmZhaWxlZF9maWxlcy5sZW5ndGggPiAwKSB7XG4gICAgICAvLyBhZGQgbWVzc2FnZSB0aGF0IHRoZXNlIGZpbGVzIHdpbGwgYmUgc2tpcHBlZCB1bnRpbCBtYW51YWxseSByZXRyaWVkXG4gICAgICBmYWlsZWRfbGlzdC5jcmVhdGVFbChcInBcIiwge1xuICAgICAgICB0ZXh0OiBcIlRoZSBmb2xsb3dpbmcgZmlsZXMgZmFpbGVkIHRvIHByb2Nlc3MgYW5kIHdpbGwgYmUgc2tpcHBlZCB1bnRpbCBtYW51YWxseSByZXRyaWVkLlwiXG4gICAgICB9KTtcbiAgICAgIGxldCBsaXN0ID0gZmFpbGVkX2xpc3QuY3JlYXRlRWwoXCJ1bFwiKTtcbiAgICAgIGZvciAobGV0IGZhaWxlZF9maWxlIG9mIHRoaXMucGx1Z2luLnNldHRpbmdzLmZhaWxlZF9maWxlcykge1xuICAgICAgICBsaXN0LmNyZWF0ZUVsKFwibGlcIiwge1xuICAgICAgICAgIHRleHQ6IGZhaWxlZF9maWxlXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICAgLy8gYWRkIGJ1dHRvbiB0byByZXRyeSBmYWlsZWQgZmlsZXMgb25seVxuICAgICAgbmV3IE9ic2lkaWFuLlNldHRpbmcoZmFpbGVkX2xpc3QpLnNldE5hbWUoXCJyZXRyeV9mYWlsZWRfZmlsZXNcIikuc2V0RGVzYyhcIlJldHJ5IGZhaWxlZCBmaWxlcyBvbmx5XCIpLmFkZEJ1dHRvbigoYnV0dG9uKSA9PiBidXR0b24uc2V0QnV0dG9uVGV4dChcIlJldHJ5IGZhaWxlZCBmaWxlcyBvbmx5XCIpLm9uQ2xpY2soYXN5bmMgKCkgPT4ge1xuICAgICAgICAvLyBjbGVhciBmYWlsZWRfbGlzdCBlbGVtZW50XG4gICAgICAgIGZhaWxlZF9saXN0LmVtcHR5KCk7XG4gICAgICAgIC8vIHNldCBcInJldHJ5aW5nXCIgdGV4dFxuICAgICAgICBmYWlsZWRfbGlzdC5jcmVhdGVFbChcInBcIiwge1xuICAgICAgICAgIHRleHQ6IFwiUmV0cnlpbmcgZmFpbGVkIGZpbGVzLi4uXCJcbiAgICAgICAgfSk7XG4gICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnJldHJ5X2ZhaWxlZF9maWxlcygpO1xuICAgICAgICAvLyByZWRyYXcgZmFpbGVkIGZpbGVzIGxpc3RcbiAgICAgICAgdGhpcy5kcmF3X2ZhaWxlZF9maWxlc19saXN0KGZhaWxlZF9saXN0KTtcbiAgICAgIH0pKTtcbiAgICB9ZWxzZXtcbiAgICAgIGZhaWxlZF9saXN0LmNyZWF0ZUVsKFwicFwiLCB7XG4gICAgICAgIHRleHQ6IFwiTm8gZmFpbGVkIGZpbGVzXCJcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxufVxuXG5mdW5jdGlvbiBsaW5lX2lzX2hlYWRpbmcobGluZSkge1xuICByZXR1cm4gKGxpbmUuaW5kZXhPZihcIiNcIikgPT09IDApICYmIChbJyMnLCAnICddLmluZGV4T2YobGluZVsxXSkgIT09IC0xKTtcbn1cblxuY29uc3QgU01BUlRfQ09OTkVDVElPTlNfQ0hBVF9WSUVXX1RZUEUgPSBcInNtYXJ0LWNvbm5lY3Rpb25zLWNoYXQtdmlld1wiO1xuXG5jbGFzcyBTbWFydENvbm5lY3Rpb25zQ2hhdFZpZXcgZXh0ZW5kcyBPYnNpZGlhbi5JdGVtVmlldyB7XG4gIGNvbnN0cnVjdG9yKGxlYWYsIHBsdWdpbikge1xuICAgIHN1cGVyKGxlYWYpO1xuICAgIHRoaXMucGx1Z2luID0gcGx1Z2luO1xuICAgIHRoaXMuYWN0aXZlX2VsbSA9IG51bGw7XG4gICAgdGhpcy5hY3RpdmVfc3RyZWFtID0gbnVsbDtcbiAgICB0aGlzLmJyYWNrZXRzX2N0ID0gMDtcbiAgICB0aGlzLmNoYXQgPSBudWxsO1xuICAgIHRoaXMuY2hhdF9ib3ggPSBudWxsO1xuICAgIHRoaXMuY2hhdF9jb250YWluZXIgPSBudWxsO1xuICAgIHRoaXMuY3VycmVudF9jaGF0X21sID0gW107XG4gICAgdGhpcy5maWxlcyA9IFtdO1xuICAgIHRoaXMubGFzdF9mcm9tID0gbnVsbDtcbiAgICB0aGlzLm1lc3NhZ2VfY29udGFpbmVyID0gbnVsbDtcbiAgICB0aGlzLnByZXZlbnRfaW5wdXQgPSBmYWxzZTtcbiAgfVxuICBnZXREaXNwbGF5VGV4dCgpIHtcbiAgICByZXR1cm4gXCJTbWFydCBDb25uZWN0aW9ucyBDaGF0XCI7XG4gIH1cbiAgZ2V0SWNvbigpIHtcbiAgICByZXR1cm4gXCJtZXNzYWdlLXNxdWFyZVwiO1xuICB9XG4gIGdldFZpZXdUeXBlKCkge1xuICAgIHJldHVybiBTTUFSVF9DT05ORUNUSU9OU19DSEFUX1ZJRVdfVFlQRTtcbiAgfVxuICBvbk9wZW4oKSB7XG4gICAgdGhpcy5uZXdfY2hhdCgpO1xuICAgIHRoaXMucGx1Z2luLmdldF9hbGxfZm9sZGVycygpOyAvLyBzZXRzIHRoaXMucGx1Z2luLmZvbGRlcnMgbmVjZXNzYXJ5IGZvciBmb2xkZXItY29udGV4dFxuICB9XG4gIG9uQ2xvc2UoKSB7XG4gICAgdGhpcy5jaGF0LnNhdmVfY2hhdCgpO1xuICAgIHRoaXMuYXBwLndvcmtzcGFjZS51bnJlZ2lzdGVySG92ZXJMaW5rU291cmNlKFNNQVJUX0NPTk5FQ1RJT05TX0NIQVRfVklFV19UWVBFKTtcbiAgfVxuICByZW5kZXJfY2hhdCgpIHtcbiAgICB0aGlzLmNvbnRhaW5lckVsLmVtcHR5KCk7XG4gICAgdGhpcy5jaGF0X2NvbnRhaW5lciA9IHRoaXMuY29udGFpbmVyRWwuY3JlYXRlRGl2KFwic2MtY2hhdC1jb250YWluZXJcIik7XG4gICAgLy8gcmVuZGVyIHBsdXMgc2lnbiBmb3IgY2xlYXIgYnV0dG9uXG4gICAgdGhpcy5yZW5kZXJfdG9wX2JhcigpO1xuICAgIC8vIHJlbmRlciBjaGF0IG1lc3NhZ2VzIGNvbnRhaW5lclxuICAgIHRoaXMucmVuZGVyX2NoYXRfYm94KCk7XG4gICAgLy8gcmVuZGVyIGNoYXQgaW5wdXRcbiAgICB0aGlzLnJlbmRlcl9jaGF0X2lucHV0KCk7XG4gICAgdGhpcy5wbHVnaW4ucmVuZGVyX2JyYW5kKHRoaXMuY29udGFpbmVyRWwsIFwiY2hhdFwiKTtcbiAgfVxuICAvLyByZW5kZXIgcGx1cyBzaWduIGZvciBjbGVhciBidXR0b25cbiAgcmVuZGVyX3RvcF9iYXIoKSB7XG4gICAgLy8gY3JlYXRlIGNvbnRhaW5lciBmb3IgY2xlYXIgYnV0dG9uXG4gICAgbGV0IHRvcF9iYXJfY29udGFpbmVyID0gdGhpcy5jaGF0X2NvbnRhaW5lci5jcmVhdGVEaXYoXCJzYy10b3AtYmFyLWNvbnRhaW5lclwiKTtcbiAgICAvLyByZW5kZXIgdGhlIG5hbWUgb2YgdGhlIGNoYXQgaW4gYW4gaW5wdXQgYm94IChwb3AgY29udGVudCBhZnRlciBsYXN0IGh5cGhlbiBpbiBjaGF0X2lkKVxuICAgIGxldCBjaGF0X25hbWUgPXRoaXMuY2hhdC5uYW1lKCk7XG4gICAgbGV0IGNoYXRfbmFtZV9pbnB1dCA9IHRvcF9iYXJfY29udGFpbmVyLmNyZWF0ZUVsKFwiaW5wdXRcIiwge1xuICAgICAgYXR0cjoge1xuICAgICAgICB0eXBlOiBcInRleHRcIixcbiAgICAgICAgdmFsdWU6IGNoYXRfbmFtZVxuICAgICAgfSxcbiAgICAgIGNsczogXCJzYy1jaGF0LW5hbWUtaW5wdXRcIlxuICAgIH0pO1xuICAgIGNoYXRfbmFtZV9pbnB1dC5hZGRFdmVudExpc3RlbmVyKFwiY2hhbmdlXCIsIHRoaXMucmVuYW1lX2NoYXQuYmluZCh0aGlzKSk7XG4gICAgXG4gICAgLy8gY3JlYXRlIGJ1dHRvbiB0byBTbWFydCBWaWV3XG4gICAgbGV0IHNtYXJ0X3ZpZXdfYnRuID0gdGhpcy5jcmVhdGVfdG9wX2Jhcl9idXR0b24odG9wX2Jhcl9jb250YWluZXIsIFwiU21hcnQgVmlld1wiLCBcInNtYXJ0LWNvbm5lY3Rpb25zXCIpO1xuICAgIHNtYXJ0X3ZpZXdfYnRuLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCB0aGlzLm9wZW5fc21hcnRfdmlldy5iaW5kKHRoaXMpKTtcbiAgICAvLyBjcmVhdGUgYnV0dG9uIHRvIHNhdmUgY2hhdFxuICAgIGxldCBzYXZlX2J0biA9IHRoaXMuY3JlYXRlX3RvcF9iYXJfYnV0dG9uKHRvcF9iYXJfY29udGFpbmVyLCBcIlNhdmUgQ2hhdFwiLCBcInNhdmVcIik7XG4gICAgc2F2ZV9idG4uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIHRoaXMuc2F2ZV9jaGF0LmJpbmQodGhpcykpO1xuICAgIC8vIGNyZWF0ZSBidXR0b24gdG8gb3BlbiBjaGF0IGhpc3RvcnkgbW9kYWxcbiAgICBsZXQgaGlzdG9yeV9idG4gPSB0aGlzLmNyZWF0ZV90b3BfYmFyX2J1dHRvbih0b3BfYmFyX2NvbnRhaW5lciwgXCJDaGF0IEhpc3RvcnlcIiwgXCJoaXN0b3J5XCIpO1xuICAgIGhpc3RvcnlfYnRuLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCB0aGlzLm9wZW5fY2hhdF9oaXN0b3J5LmJpbmQodGhpcykpO1xuICAgIC8vIGNyZWF0ZSBidXR0b24gdG8gc3RhcnQgbmV3IGNoYXRcbiAgICBjb25zdCBuZXdfY2hhdF9idG4gPSB0aGlzLmNyZWF0ZV90b3BfYmFyX2J1dHRvbih0b3BfYmFyX2NvbnRhaW5lciwgXCJOZXcgQ2hhdFwiLCBcInBsdXNcIik7XG4gICAgbmV3X2NoYXRfYnRuLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCB0aGlzLm5ld19jaGF0LmJpbmQodGhpcykpO1xuICB9XG4gIGFzeW5jIG9wZW5fY2hhdF9oaXN0b3J5KCkge1xuICAgIGNvbnN0IGZvbGRlciA9IGF3YWl0IHRoaXMuYXBwLnZhdWx0LmFkYXB0ZXIubGlzdChcIi5zbWFydC1jb25uZWN0aW9ucy9jaGF0c1wiKTtcbiAgICB0aGlzLmZpbGVzID0gZm9sZGVyLmZpbGVzLm1hcCgoZmlsZSkgPT4ge1xuICAgICAgcmV0dXJuIGZpbGUucmVwbGFjZShcIi5zbWFydC1jb25uZWN0aW9ucy9jaGF0cy9cIiwgXCJcIikucmVwbGFjZShcIi5qc29uXCIsIFwiXCIpO1xuICAgIH0pO1xuICAgIC8vIG9wZW4gY2hhdCBoaXN0b3J5IG1vZGFsXG4gICAgaWYgKCF0aGlzLm1vZGFsKVxuICAgICAgdGhpcy5tb2RhbCA9IG5ldyBTbWFydENvbm5lY3Rpb25zQ2hhdEhpc3RvcnlNb2RhbCh0aGlzLmFwcCwgdGhpcyk7XG4gICAgdGhpcy5tb2RhbC5vcGVuKCk7XG4gIH1cblxuICBjcmVhdGVfdG9wX2Jhcl9idXR0b24odG9wX2Jhcl9jb250YWluZXIsIHRpdGxlLCBpY29uPW51bGwpIHtcbiAgICBsZXQgYnRuID0gdG9wX2Jhcl9jb250YWluZXIuY3JlYXRlRWwoXCJidXR0b25cIiwge1xuICAgICAgYXR0cjoge1xuICAgICAgICB0aXRsZTogdGl0bGVcbiAgICAgIH1cbiAgICB9KTtcbiAgICBpZihpY29uKXtcbiAgICAgIE9ic2lkaWFuLnNldEljb24oYnRuLCBpY29uKTtcbiAgICB9ZWxzZXtcbiAgICAgIGJ0bi5pbm5lckhUTUwgPSB0aXRsZTtcbiAgICB9XG4gICAgcmV0dXJuIGJ0bjtcbiAgfVxuICAvLyByZW5kZXIgbmV3IGNoYXRcbiAgbmV3X2NoYXQoKSB7XG4gICAgdGhpcy5jbGVhcl9jaGF0KCk7XG4gICAgdGhpcy5yZW5kZXJfY2hhdCgpO1xuICAgIC8vIHJlbmRlciBpbml0aWFsIG1lc3NhZ2UgZnJvbSBhc3Npc3RhbnQgKGRvbid0IHVzZSByZW5kZXJfbWVzc2FnZSB0byBza2lwIGFkZGluZyB0byBjaGF0IGhpc3RvcnkpXG4gICAgdGhpcy5uZXdfbWVzc3NhZ2VfYnViYmxlKFwiYXNzaXN0YW50XCIpO1xuICAgIHRoaXMuYWN0aXZlX2VsbS5pbm5lckhUTUwgPSAnPHA+JyArIFNNQVJUX1RSQU5TTEFUSU9OW3RoaXMucGx1Z2luLnNldHRpbmdzLmxhbmd1YWdlXS5pbml0aWFsX21lc3NhZ2UrJzwvcD4nO1xuICB9XG4gIC8vIG9wZW4gYSBjaGF0IGZyb20gdGhlIGNoYXQgaGlzdG9yeSBtb2RhbFxuICBhc3luYyBvcGVuX2NoYXQoY2hhdF9pZCkge1xuICAgIHRoaXMuY2xlYXJfY2hhdCgpO1xuICAgIGF3YWl0IHRoaXMuY2hhdC5sb2FkX2NoYXQoY2hhdF9pZCk7XG4gICAgdGhpcy5yZW5kZXJfY2hhdCgpO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5jaGF0LmNoYXRfbWwubGVuZ3RoOyBpKyspIHtcbiAgICAgIGF3YWl0IHRoaXMucmVuZGVyX21lc3NhZ2UodGhpcy5jaGF0LmNoYXRfbWxbaV0uY29udGVudCwgdGhpcy5jaGF0LmNoYXRfbWxbaV0ucm9sZSk7XG4gICAgfVxuICB9XG4gIC8vIGNsZWFyIGN1cnJlbnQgY2hhdCBzdGF0ZVxuICBjbGVhcl9jaGF0KCkge1xuICAgIGlmICh0aGlzLmNoYXQpIHtcbiAgICAgIHRoaXMuY2hhdC5zYXZlX2NoYXQoKTtcbiAgICB9XG4gICAgdGhpcy5jaGF0ID0gbmV3IFNtYXJ0Q29ubmVjdGlvbnNDaGF0TW9kZWwodGhpcy5wbHVnaW4pO1xuICAgIC8vIGlmIHRoaXMuZG90ZG90ZG90X2ludGVydmFsIGlzIG5vdCBudWxsLCBjbGVhciBpbnRlcnZhbFxuICAgIGlmICh0aGlzLmRvdGRvdGRvdF9pbnRlcnZhbCkge1xuICAgICAgY2xlYXJJbnRlcnZhbCh0aGlzLmRvdGRvdGRvdF9pbnRlcnZhbCk7XG4gICAgfVxuICAgIC8vIGNsZWFyIGN1cnJlbnQgY2hhdCBtbFxuICAgIHRoaXMuY3VycmVudF9jaGF0X21sID0gW107XG4gICAgLy8gdXBkYXRlIHByZXZlbnQgaW5wdXRcbiAgICB0aGlzLmVuZF9zdHJlYW0oKTtcbiAgfVxuXG4gIHJlbmFtZV9jaGF0KGV2ZW50KSB7XG4gICAgbGV0IG5ld19jaGF0X25hbWUgPSBldmVudC50YXJnZXQudmFsdWU7XG4gICAgdGhpcy5jaGF0LnJlbmFtZV9jaGF0KG5ld19jaGF0X25hbWUpO1xuICB9XG4gIFxuICAvLyBzYXZlIGN1cnJlbnQgY2hhdFxuICBzYXZlX2NoYXQoKSB7XG4gICAgdGhpcy5jaGF0LnNhdmVfY2hhdCgpO1xuICAgIG5ldyBPYnNpZGlhbi5Ob3RpY2UoXCJbU21hcnQgQ29ubmVjdGlvbnNdIENoYXQgc2F2ZWRcIik7XG4gIH1cbiAgXG4gIG9wZW5fc21hcnRfdmlldygpIHtcbiAgICB0aGlzLnBsdWdpbi5vcGVuX3ZpZXcoKTtcbiAgfVxuICAvLyByZW5kZXIgY2hhdCBtZXNzYWdlcyBjb250YWluZXJcbiAgcmVuZGVyX2NoYXRfYm94KCkge1xuICAgIC8vIGNyZWF0ZSBjb250YWluZXIgZm9yIGNoYXQgbWVzc2FnZXNcbiAgICB0aGlzLmNoYXRfYm94ID0gdGhpcy5jaGF0X2NvbnRhaW5lci5jcmVhdGVEaXYoXCJzYy1jaGF0LWJveFwiKTtcbiAgICAvLyBjcmVhdGUgY29udGFpbmVyIGZvciBtZXNzYWdlXG4gICAgdGhpcy5tZXNzYWdlX2NvbnRhaW5lciA9IHRoaXMuY2hhdF9ib3guY3JlYXRlRGl2KFwic2MtbWVzc2FnZS1jb250YWluZXJcIik7XG4gIH1cbiAgLy8gb3BlbiBmaWxlIHN1Z2dlc3Rpb24gbW9kYWxcbiAgb3Blbl9maWxlX3N1Z2dlc3Rpb25fbW9kYWwoKSB7XG4gICAgLy8gb3BlbiBmaWxlIHN1Z2dlc3Rpb24gbW9kYWxcbiAgICBpZighdGhpcy5maWxlX3NlbGVjdG9yKSB0aGlzLmZpbGVfc2VsZWN0b3IgPSBuZXcgU21hcnRDb25uZWN0aW9uc0ZpbGVTZWxlY3RNb2RhbCh0aGlzLmFwcCwgdGhpcyk7XG4gICAgdGhpcy5maWxlX3NlbGVjdG9yLm9wZW4oKTtcbiAgfVxuICAvLyBvcGVuIGZvbGRlciBzdWdnZXN0aW9uIG1vZGFsXG4gIGFzeW5jIG9wZW5fZm9sZGVyX3N1Z2dlc3Rpb25fbW9kYWwoKSB7XG4gICAgLy8gb3BlbiBmb2xkZXIgc3VnZ2VzdGlvbiBtb2RhbFxuICAgIGlmKCF0aGlzLmZvbGRlcl9zZWxlY3Rvcil7XG4gICAgICB0aGlzLmZvbGRlcl9zZWxlY3RvciA9IG5ldyBTbWFydENvbm5lY3Rpb25zRm9sZGVyU2VsZWN0TW9kYWwodGhpcy5hcHAsIHRoaXMpO1xuICAgIH1cbiAgICB0aGlzLmZvbGRlcl9zZWxlY3Rvci5vcGVuKCk7XG4gIH1cbiAgLy8gaW5zZXJ0X3NlbGVjdGlvbiBmcm9tIGZpbGUgc3VnZ2VzdGlvbiBtb2RhbFxuICBpbnNlcnRfc2VsZWN0aW9uKGluc2VydF90ZXh0KSB7XG4gICAgLy8gZ2V0IGNhcmV0IHBvc2l0aW9uXG4gICAgbGV0IGNhcmV0X3BvcyA9IHRoaXMudGV4dGFyZWEuc2VsZWN0aW9uU3RhcnQ7XG4gICAgLy8gZ2V0IHRleHQgYmVmb3JlIGNhcmV0XG4gICAgbGV0IHRleHRfYmVmb3JlID0gdGhpcy50ZXh0YXJlYS52YWx1ZS5zdWJzdHJpbmcoMCwgY2FyZXRfcG9zKTtcbiAgICAvLyBnZXQgdGV4dCBhZnRlciBjYXJldFxuICAgIGxldCB0ZXh0X2FmdGVyID0gdGhpcy50ZXh0YXJlYS52YWx1ZS5zdWJzdHJpbmcoY2FyZXRfcG9zLCB0aGlzLnRleHRhcmVhLnZhbHVlLmxlbmd0aCk7XG4gICAgLy8gaW5zZXJ0IHRleHRcbiAgICB0aGlzLnRleHRhcmVhLnZhbHVlID0gdGV4dF9iZWZvcmUgKyBpbnNlcnRfdGV4dCArIHRleHRfYWZ0ZXI7XG4gICAgLy8gc2V0IGNhcmV0IHBvc2l0aW9uXG4gICAgdGhpcy50ZXh0YXJlYS5zZWxlY3Rpb25TdGFydCA9IGNhcmV0X3BvcyArIGluc2VydF90ZXh0Lmxlbmd0aDtcbiAgICB0aGlzLnRleHRhcmVhLnNlbGVjdGlvbkVuZCA9IGNhcmV0X3BvcyArIGluc2VydF90ZXh0Lmxlbmd0aDtcbiAgICAvLyBmb2N1cyBvbiB0ZXh0YXJlYVxuICAgIHRoaXMudGV4dGFyZWEuZm9jdXMoKTtcbiAgfVxuXG4gIC8vIHJlbmRlciBjaGF0IHRleHRhcmVhIGFuZCBidXR0b25cbiAgcmVuZGVyX2NoYXRfaW5wdXQoKSB7XG4gICAgLy8gY3JlYXRlIGNvbnRhaW5lciBmb3IgY2hhdCBpbnB1dFxuICAgIGxldCBjaGF0X2lucHV0ID0gdGhpcy5jaGF0X2NvbnRhaW5lci5jcmVhdGVEaXYoXCJzYy1jaGF0LWZvcm1cIik7XG4gICAgLy8gY3JlYXRlIHRleHRhcmVhXG4gICAgdGhpcy50ZXh0YXJlYSA9IGNoYXRfaW5wdXQuY3JlYXRlRWwoXCJ0ZXh0YXJlYVwiLCB7XG4gICAgICBjbHM6IFwic2MtY2hhdC1pbnB1dFwiLFxuICAgICAgYXR0cjoge1xuICAgICAgICBwbGFjZWhvbGRlcjogYFRyeSBcIkJhc2VkIG9uIG15IG5vdGVzXCIgb3IgXCJTdW1tYXJpemUgW1t0aGlzIG5vdGVdXVwiIG9yIFwiSW1wb3J0YW50IHRhc2tzIGluIC9mb2xkZXIvXCJgXG4gICAgICB9XG4gICAgfSk7XG4gICAgLy8gdXNlIGNvbnRlbnRlZGl0YWJsZSBpbnN0ZWFkIG9mIHRleHRhcmVhXG4gICAgLy8gdGhpcy50ZXh0YXJlYSA9IGNoYXRfaW5wdXQuY3JlYXRlRWwoXCJkaXZcIiwge2NsczogXCJzYy1jaGF0LWlucHV0XCIsIGF0dHI6IHtjb250ZW50ZWRpdGFibGU6IHRydWV9fSk7XG4gICAgLy8gYWRkIGV2ZW50IGxpc3RlbmVyIHRvIGxpc3RlbiBmb3Igc2hpZnQrZW50ZXJcbiAgICBjaGF0X2lucHV0LmFkZEV2ZW50TGlzdGVuZXIoXCJrZXl1cFwiLCAoZSkgPT4ge1xuICAgICAgaWYoW1wiW1wiLCBcIi9cIl0uaW5kZXhPZihlLmtleSkgPT09IC0xKSByZXR1cm47IC8vIHNraXAgaWYga2V5IGlzIG5vdCBbIG9yIC9cbiAgICAgIGNvbnN0IGNhcmV0X3BvcyA9IHRoaXMudGV4dGFyZWEuc2VsZWN0aW9uU3RhcnQ7XG4gICAgICAvLyBpZiBrZXkgaXMgb3BlbiBzcXVhcmUgYnJhY2tldFxuICAgICAgaWYgKGUua2V5ID09PSBcIltcIikge1xuICAgICAgICAvLyBpZiBwcmV2aW91cyBjaGFyIGlzIFtcbiAgICAgICAgaWYodGhpcy50ZXh0YXJlYS52YWx1ZVtjYXJldF9wb3MgLSAyXSA9PT0gXCJbXCIpe1xuICAgICAgICAgIC8vIG9wZW4gZmlsZSBzdWdnZXN0aW9uIG1vZGFsXG4gICAgICAgICAgdGhpcy5vcGVuX2ZpbGVfc3VnZ2VzdGlvbl9tb2RhbCgpO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgfWVsc2V7XG4gICAgICAgIHRoaXMuYnJhY2tldHNfY3QgPSAwO1xuICAgICAgfVxuICAgICAgLy8gaWYgLyBpcyBwcmVzc2VkXG4gICAgICBpZiAoZS5rZXkgPT09IFwiL1wiKSB7XG4gICAgICAgIC8vIGdldCBjYXJldCBwb3NpdGlvblxuICAgICAgICAvLyBpZiB0aGlzIGlzIGZpcnN0IGNoYXIgb3IgcHJldmlvdXMgY2hhciBpcyBzcGFjZVxuICAgICAgICBpZiAodGhpcy50ZXh0YXJlYS52YWx1ZS5sZW5ndGggPT09IDEgfHwgdGhpcy50ZXh0YXJlYS52YWx1ZVtjYXJldF9wb3MgLSAyXSA9PT0gXCIgXCIpIHtcbiAgICAgICAgICAvLyBvcGVuIGZvbGRlciBzdWdnZXN0aW9uIG1vZGFsXG4gICAgICAgICAgdGhpcy5vcGVuX2ZvbGRlcl9zdWdnZXN0aW9uX21vZGFsKCk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICB9KTtcblxuICAgIGNoYXRfaW5wdXQuYWRkRXZlbnRMaXN0ZW5lcihcImtleWRvd25cIiwgKGUpID0+IHtcbiAgICAgIGlmIChlLmtleSA9PT0gXCJFbnRlclwiICYmIGUuc2hpZnRLZXkpIHtcbiAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICBpZih0aGlzLnByZXZlbnRfaW5wdXQpe1xuICAgICAgICAgIGNvbnNvbGUubG9nKFwid2FpdCB1bnRpbCBjdXJyZW50IHJlc3BvbnNlIGlzIGZpbmlzaGVkXCIpO1xuICAgICAgICAgIG5ldyBPYnNpZGlhbi5Ob3RpY2UoXCJbU21hcnQgQ29ubmVjdGlvbnNdIFdhaXQgdW50aWwgY3VycmVudCByZXNwb25zZSBpcyBmaW5pc2hlZFwiKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgLy8gZ2V0IHRleHQgZnJvbSB0ZXh0YXJlYVxuICAgICAgICBsZXQgdXNlcl9pbnB1dCA9IHRoaXMudGV4dGFyZWEudmFsdWU7XG4gICAgICAgIC8vIGNsZWFyIHRleHRhcmVhXG4gICAgICAgIHRoaXMudGV4dGFyZWEudmFsdWUgPSBcIlwiO1xuICAgICAgICAvLyBpbml0aWF0ZSByZXNwb25zZSBmcm9tIGFzc2lzdGFudFxuICAgICAgICB0aGlzLmluaXRpYWxpemVfcmVzcG9uc2UodXNlcl9pbnB1dCk7XG4gICAgICB9XG4gICAgICB0aGlzLnRleHRhcmVhLnN0eWxlLmhlaWdodCA9ICdhdXRvJztcbiAgICAgIHRoaXMudGV4dGFyZWEuc3R5bGUuaGVpZ2h0ID0gKHRoaXMudGV4dGFyZWEuc2Nyb2xsSGVpZ2h0KSArICdweCc7XG4gICAgfSk7XG4gICAgLy8gYnV0dG9uIGNvbnRhaW5lclxuICAgIGxldCBidXR0b25fY29udGFpbmVyID0gY2hhdF9pbnB1dC5jcmVhdGVEaXYoXCJzYy1idXR0b24tY29udGFpbmVyXCIpO1xuICAgIC8vIGNyZWF0ZSBoaWRkZW4gYWJvcnQgYnV0dG9uXG4gICAgbGV0IGFib3J0X2J1dHRvbiA9IGJ1dHRvbl9jb250YWluZXIuY3JlYXRlRWwoXCJzcGFuXCIsIHsgYXR0cjoge2lkOiBcInNjLWFib3J0LWJ1dHRvblwiLCBzdHlsZTogXCJkaXNwbGF5OiBub25lO1wifSB9KTtcbiAgICBPYnNpZGlhbi5zZXRJY29uKGFib3J0X2J1dHRvbiwgXCJzcXVhcmVcIik7XG4gICAgLy8gYWRkIGV2ZW50IGxpc3RlbmVyIHRvIGJ1dHRvblxuICAgIGFib3J0X2J1dHRvbi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4ge1xuICAgICAgLy8gYWJvcnQgY3VycmVudCByZXNwb25zZVxuICAgICAgdGhpcy5lbmRfc3RyZWFtKCk7XG4gICAgfSk7XG4gICAgLy8gY3JlYXRlIGJ1dHRvblxuICAgIGxldCBidXR0b24gPSBidXR0b25fY29udGFpbmVyLmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHsgYXR0cjoge2lkOiBcInNjLXNlbmQtYnV0dG9uXCJ9LCBjbHM6IFwic2VuZC1idXR0b25cIiB9KTtcbiAgICBidXR0b24uaW5uZXJIVE1MID0gXCJTZW5kXCI7XG4gICAgLy8gYWRkIGV2ZW50IGxpc3RlbmVyIHRvIGJ1dHRvblxuICAgIGJ1dHRvbi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4ge1xuICAgICAgaWYodGhpcy5wcmV2ZW50X2lucHV0KXtcbiAgICAgICAgY29uc29sZS5sb2coXCJ3YWl0IHVudGlsIGN1cnJlbnQgcmVzcG9uc2UgaXMgZmluaXNoZWRcIik7XG4gICAgICAgIG5ldyBPYnNpZGlhbi5Ob3RpY2UoXCJXYWl0IHVudGlsIGN1cnJlbnQgcmVzcG9uc2UgaXMgZmluaXNoZWRcIik7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIC8vIGdldCB0ZXh0IGZyb20gdGV4dGFyZWFcbiAgICAgIGxldCB1c2VyX2lucHV0ID0gdGhpcy50ZXh0YXJlYS52YWx1ZTtcbiAgICAgIC8vIGNsZWFyIHRleHRhcmVhXG4gICAgICB0aGlzLnRleHRhcmVhLnZhbHVlID0gXCJcIjtcbiAgICAgIC8vIGluaXRpYXRlIHJlc3BvbnNlIGZyb20gYXNzaXN0YW50XG4gICAgICB0aGlzLmluaXRpYWxpemVfcmVzcG9uc2UodXNlcl9pbnB1dCk7XG4gICAgfSk7XG4gIH1cbiAgYXN5bmMgaW5pdGlhbGl6ZV9yZXNwb25zZSh1c2VyX2lucHV0KSB7XG4gICAgdGhpcy5zZXRfc3RyZWFtaW5nX3V4KCk7XG4gICAgLy8gcmVuZGVyIG1lc3NhZ2VcbiAgICBhd2FpdCB0aGlzLnJlbmRlcl9tZXNzYWdlKHVzZXJfaW5wdXQsIFwidXNlclwiKTtcbiAgICB0aGlzLmNoYXQubmV3X21lc3NhZ2VfaW5fdGhyZWFkKHtcbiAgICAgIHJvbGU6IFwidXNlclwiLFxuICAgICAgY29udGVudDogdXNlcl9pbnB1dFxuICAgIH0pO1xuICAgIGF3YWl0IHRoaXMucmVuZGVyX2RvdGRvdGRvdCgpO1xuXG4gICAgLy8gaWYgY29udGFpbnMgaW50ZXJuYWwgbGluayByZXByZXNlbnRlZCBieSBbW2xpbmtdXVxuICAgIGlmKHRoaXMuY2hhdC5jb250YWluc19pbnRlcm5hbF9saW5rKHVzZXJfaW5wdXQpKSB7XG4gICAgICB0aGlzLmNoYXQuZ2V0X3Jlc3BvbnNlX3dpdGhfbm90ZV9jb250ZXh0KHVzZXJfaW5wdXQsIHRoaXMpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICAvLyAvLyBmb3IgdGVzdGluZyBwdXJwb3Nlc1xuICAgIC8vIGlmKHRoaXMuY2hhdC5jb250YWluc19mb2xkZXJfcmVmZXJlbmNlKHVzZXJfaW5wdXQpKSB7XG4gICAgLy8gICBjb25zdCBmb2xkZXJzID0gdGhpcy5jaGF0LmdldF9mb2xkZXJfcmVmZXJlbmNlcyh1c2VyX2lucHV0KTtcbiAgICAvLyAgIGNvbnNvbGUubG9nKGZvbGRlcnMpO1xuICAgIC8vICAgcmV0dXJuO1xuICAgIC8vIH1cbiAgICAvLyBpZiBjb250YWlucyBzZWxmIHJlZmVyZW50aWFsIGtleXdvcmRzIG9yIGZvbGRlciByZWZlcmVuY2VcbiAgICBpZih0aGlzLmNvbnRhaW5zX3NlbGZfcmVmZXJlbnRpYWxfa2V5d29yZHModXNlcl9pbnB1dCkgfHwgdGhpcy5jaGF0LmNvbnRhaW5zX2ZvbGRlcl9yZWZlcmVuY2UodXNlcl9pbnB1dCkpIHtcbiAgICAgIC8vIGdldCBoeWRlXG4gICAgICBjb25zdCBjb250ZXh0ID0gYXdhaXQgdGhpcy5nZXRfY29udGV4dF9oeWRlKHVzZXJfaW5wdXQpO1xuICAgICAgLy8gZ2V0IHVzZXIgaW5wdXQgd2l0aCBhZGRlZCBjb250ZXh0XG4gICAgICAvLyBjb25zdCBjb250ZXh0X2lucHV0ID0gdGhpcy5idWlsZF9jb250ZXh0X2lucHV0KGNvbnRleHQpO1xuICAgICAgLy8gY29uc29sZS5sb2coY29udGV4dF9pbnB1dCk7XG4gICAgICBjb25zdCBjaGF0bWwgPSBbXG4gICAgICAgIHtcbiAgICAgICAgICByb2xlOiBcInN5c3RlbVwiLFxuICAgICAgICAgIC8vIGNvbnRlbnQ6IGNvbnRleHRfaW5wdXRcbiAgICAgICAgICBjb250ZW50OiBjb250ZXh0XG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICByb2xlOiBcInVzZXJcIixcbiAgICAgICAgICBjb250ZW50OiB1c2VyX2lucHV0XG4gICAgICAgIH1cbiAgICAgIF07XG4gICAgICB0aGlzLnJlcXVlc3RfY2hhdGdwdF9jb21wbGV0aW9uKHttZXNzYWdlczogY2hhdG1sLCB0ZW1wZXJhdHVyZTogMH0pO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICAvLyBjb21wbGV0aW9uIHdpdGhvdXQgYW55IHNwZWNpZmljIGNvbnRleHRcbiAgICB0aGlzLnJlcXVlc3RfY2hhdGdwdF9jb21wbGV0aW9uKCk7XG4gIH1cbiAgXG4gIGFzeW5jIHJlbmRlcl9kb3Rkb3Rkb3QoKSB7XG4gICAgaWYgKHRoaXMuZG90ZG90ZG90X2ludGVydmFsKVxuICAgICAgY2xlYXJJbnRlcnZhbCh0aGlzLmRvdGRvdGRvdF9pbnRlcnZhbCk7XG4gICAgYXdhaXQgdGhpcy5yZW5kZXJfbWVzc2FnZShcIi4uLlwiLCBcImFzc2lzdGFudFwiKTtcbiAgICAvLyBpZiBpcyAnLi4uJywgdGhlbiBpbml0aWF0ZSBpbnRlcnZhbCB0byBjaGFuZ2UgdG8gJy4nIGFuZCB0aGVuIHRvICcuLicgYW5kIHRoZW4gdG8gJy4uLidcbiAgICBsZXQgZG90cyA9IDA7XG4gICAgdGhpcy5hY3RpdmVfZWxtLmlubmVySFRNTCA9ICcuLi4nO1xuICAgIHRoaXMuZG90ZG90ZG90X2ludGVydmFsID0gc2V0SW50ZXJ2YWwoKCkgPT4ge1xuICAgICAgZG90cysrO1xuICAgICAgaWYgKGRvdHMgPiAzKVxuICAgICAgICBkb3RzID0gMTtcbiAgICAgIHRoaXMuYWN0aXZlX2VsbS5pbm5lckhUTUwgPSAnLicucmVwZWF0KGRvdHMpO1xuICAgIH0sIDUwMCk7XG4gICAgLy8gd2FpdCAyIHNlY29uZHMgZm9yIHRlc3RpbmdcbiAgICAvLyBhd2FpdCBuZXcgUHJvbWlzZShyID0+IHNldFRpbWVvdXQociwgMjAwMCkpO1xuICB9XG5cbiAgc2V0X3N0cmVhbWluZ191eCgpIHtcbiAgICB0aGlzLnByZXZlbnRfaW5wdXQgPSB0cnVlO1xuICAgIC8vIGhpZGUgc2VuZCBidXR0b25cbiAgICBpZihkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcInNjLXNlbmQtYnV0dG9uXCIpKVxuICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJzYy1zZW5kLWJ1dHRvblwiKS5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCI7XG4gICAgLy8gc2hvdyBhYm9ydCBidXR0b25cbiAgICBpZihkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcInNjLWFib3J0LWJ1dHRvblwiKSlcbiAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwic2MtYWJvcnQtYnV0dG9uXCIpLnN0eWxlLmRpc3BsYXkgPSBcImJsb2NrXCI7XG4gIH1cbiAgdW5zZXRfc3RyZWFtaW5nX3V4KCkge1xuICAgIHRoaXMucHJldmVudF9pbnB1dCA9IGZhbHNlO1xuICAgIC8vIHNob3cgc2VuZCBidXR0b24sIHJlbW92ZSBkaXNwbGF5IG5vbmVcbiAgICBpZihkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcInNjLXNlbmQtYnV0dG9uXCIpKVxuICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJzYy1zZW5kLWJ1dHRvblwiKS5zdHlsZS5kaXNwbGF5ID0gXCJcIjtcbiAgICAvLyBoaWRlIGFib3J0IGJ1dHRvblxuICAgIGlmKGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwic2MtYWJvcnQtYnV0dG9uXCIpKVxuICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJzYy1hYm9ydC1idXR0b25cIikuc3R5bGUuZGlzcGxheSA9IFwibm9uZVwiO1xuICB9XG5cblxuICAvLyBjaGVjayBpZiBpbmNsdWRlcyBrZXl3b3JkcyByZWZlcnJpbmcgdG8gb25lJ3Mgb3duIG5vdGVzXG4gIGNvbnRhaW5zX3NlbGZfcmVmZXJlbnRpYWxfa2V5d29yZHModXNlcl9pbnB1dCkge1xuICAgIGNvbnN0IG1hdGNoZXMgPSB1c2VyX2lucHV0Lm1hdGNoKHRoaXMucGx1Z2luLnNlbGZfcmVmX2t3X3JlZ2V4KTtcbiAgICBpZihtYXRjaGVzKSByZXR1cm4gdHJ1ZTtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICAvLyByZW5kZXIgbWVzc2FnZVxuICBhc3luYyByZW5kZXJfbWVzc2FnZShtZXNzYWdlLCBmcm9tPVwiYXNzaXN0YW50XCIsIGFwcGVuZF9sYXN0PWZhbHNlKSB7XG4gICAgLy8gaWYgZG90ZG90ZG90IGludGVydmFsIGlzIHNldCwgdGhlbiBjbGVhciBpdFxuICAgIGlmKHRoaXMuZG90ZG90ZG90X2ludGVydmFsKSB7XG4gICAgICBjbGVhckludGVydmFsKHRoaXMuZG90ZG90ZG90X2ludGVydmFsKTtcbiAgICAgIHRoaXMuZG90ZG90ZG90X2ludGVydmFsID0gbnVsbDtcbiAgICAgIC8vIGNsZWFyIGxhc3QgbWVzc2FnZVxuICAgICAgdGhpcy5hY3RpdmVfZWxtLmlubmVySFRNTCA9ICcnO1xuICAgIH1cbiAgICBpZihhcHBlbmRfbGFzdCkge1xuICAgICAgdGhpcy5jdXJyZW50X21lc3NhZ2VfcmF3ICs9IG1lc3NhZ2U7XG4gICAgICBpZihtZXNzYWdlLmluZGV4T2YoJ1xcbicpID09PSAtMSkge1xuICAgICAgICB0aGlzLmFjdGl2ZV9lbG0uaW5uZXJIVE1MICs9IG1lc3NhZ2U7XG4gICAgICB9ZWxzZXtcbiAgICAgICAgdGhpcy5hY3RpdmVfZWxtLmlubmVySFRNTCA9ICcnO1xuICAgICAgICAvLyBhcHBlbmQgdG8gbGFzdCBtZXNzYWdlXG4gICAgICAgIGF3YWl0IE9ic2lkaWFuLk1hcmtkb3duUmVuZGVyZXIucmVuZGVyTWFya2Rvd24odGhpcy5jdXJyZW50X21lc3NhZ2VfcmF3LCB0aGlzLmFjdGl2ZV9lbG0sICc/bm8tZGF0YXZpZXcnLCBuZXcgT2JzaWRpYW4uQ29tcG9uZW50KCkpO1xuICAgICAgfVxuICAgIH1lbHNle1xuICAgICAgdGhpcy5jdXJyZW50X21lc3NhZ2VfcmF3ID0gJyc7XG4gICAgICBpZigodGhpcy5jaGF0LnRocmVhZC5sZW5ndGggPT09IDApIHx8ICh0aGlzLmxhc3RfZnJvbSAhPT0gZnJvbSkpIHtcbiAgICAgICAgLy8gY3JlYXRlIG1lc3NhZ2VcbiAgICAgICAgdGhpcy5uZXdfbWVzc3NhZ2VfYnViYmxlKGZyb20pO1xuICAgICAgfVxuICAgICAgLy8gc2V0IG1lc3NhZ2UgdGV4dFxuICAgICAgdGhpcy5hY3RpdmVfZWxtLmlubmVySFRNTCA9ICcnO1xuICAgICAgYXdhaXQgT2JzaWRpYW4uTWFya2Rvd25SZW5kZXJlci5yZW5kZXJNYXJrZG93bihtZXNzYWdlLCB0aGlzLmFjdGl2ZV9lbG0sICc/bm8tZGF0YXZpZXcnLCBuZXcgT2JzaWRpYW4uQ29tcG9uZW50KCkpO1xuICAgICAgLy8gZ2V0IGxpbmtzXG4gICAgICB0aGlzLmhhbmRsZV9saW5rc19pbl9tZXNzYWdlKCk7XG4gICAgICAvLyByZW5kZXIgYnV0dG9uKHMpXG4gICAgICB0aGlzLnJlbmRlcl9tZXNzYWdlX2FjdGlvbl9idXR0b25zKG1lc3NhZ2UpO1xuICAgIH1cbiAgICAvLyBzY3JvbGwgdG8gYm90dG9tXG4gICAgdGhpcy5tZXNzYWdlX2NvbnRhaW5lci5zY3JvbGxUb3AgPSB0aGlzLm1lc3NhZ2VfY29udGFpbmVyLnNjcm9sbEhlaWdodDtcbiAgfVxuICByZW5kZXJfbWVzc2FnZV9hY3Rpb25fYnV0dG9ucyhtZXNzYWdlKSB7XG4gICAgaWYgKHRoaXMuY2hhdC5jb250ZXh0ICYmIHRoaXMuY2hhdC5oeWQpIHtcbiAgICAgIC8vIHJlbmRlciBidXR0b24gdG8gY29weSBoeWQgaW4gc21hcnQtY29ubmVjdGlvbnMgY29kZSBibG9ja1xuICAgICAgY29uc3QgY29udGV4dF92aWV3ID0gdGhpcy5hY3RpdmVfZWxtLmNyZWF0ZUVsKFwic3BhblwiLCB7XG4gICAgICAgIGNsczogXCJzYy1tc2ctYnV0dG9uXCIsXG4gICAgICAgIGF0dHI6IHtcbiAgICAgICAgICB0aXRsZTogXCJDb3B5IGNvbnRleHQgdG8gY2xpcGJvYXJkXCIgLyogdG9vbHRpcCAqL1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICAgIGNvbnN0IHRoaXNfaHlkID0gdGhpcy5jaGF0Lmh5ZDtcbiAgICAgIE9ic2lkaWFuLnNldEljb24oY29udGV4dF92aWV3LCBcImV5ZVwiKTtcbiAgICAgIGNvbnRleHRfdmlldy5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4ge1xuICAgICAgICAvLyBjb3B5IHRvIGNsaXBib2FyZFxuICAgICAgICBuYXZpZ2F0b3IuY2xpcGJvYXJkLndyaXRlVGV4dChcImBgYHNtYXJ0LWNvbm5lY3Rpb25zXFxuXCIgKyB0aGlzX2h5ZCArIFwiXFxuYGBgXFxuXCIpO1xuICAgICAgICBuZXcgT2JzaWRpYW4uTm90aWNlKFwiW1NtYXJ0IENvbm5lY3Rpb25zXSBDb250ZXh0IGNvZGUgYmxvY2sgY29waWVkIHRvIGNsaXBib2FyZFwiKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgICBpZih0aGlzLmNoYXQuY29udGV4dCkge1xuICAgICAgLy8gcmVuZGVyIGNvcHkgY29udGV4dCBidXR0b25cbiAgICAgIGNvbnN0IGNvcHlfcHJvbXB0X2J1dHRvbiA9IHRoaXMuYWN0aXZlX2VsbS5jcmVhdGVFbChcInNwYW5cIiwge1xuICAgICAgICBjbHM6IFwic2MtbXNnLWJ1dHRvblwiLFxuICAgICAgICBhdHRyOiB7XG4gICAgICAgICAgdGl0bGU6IFwiQ29weSBwcm9tcHQgdG8gY2xpcGJvYXJkXCIgLyogdG9vbHRpcCAqL1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICAgIGNvbnN0IHRoaXNfY29udGV4dCA9IHRoaXMuY2hhdC5jb250ZXh0LnJlcGxhY2UoL1xcYFxcYFxcYC9nLCBcIlxcdGBgYFwiKS50cmltTGVmdCgpO1xuICAgICAgT2JzaWRpYW4uc2V0SWNvbihjb3B5X3Byb21wdF9idXR0b24sIFwiZmlsZXNcIik7XG4gICAgICBjb3B5X3Byb21wdF9idXR0b24uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHtcbiAgICAgICAgLy8gY29weSB0byBjbGlwYm9hcmRcbiAgICAgICAgbmF2aWdhdG9yLmNsaXBib2FyZC53cml0ZVRleHQoXCJgYGBwcm9tcHQtY29udGV4dFxcblwiICsgdGhpc19jb250ZXh0ICsgXCJcXG5gYGBcXG5cIik7XG4gICAgICAgIG5ldyBPYnNpZGlhbi5Ob3RpY2UoXCJbU21hcnQgQ29ubmVjdGlvbnNdIENvbnRleHQgY29waWVkIHRvIGNsaXBib2FyZFwiKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgICAvLyByZW5kZXIgY29weSBidXR0b25cbiAgICBjb25zdCBjb3B5X2J1dHRvbiA9IHRoaXMuYWN0aXZlX2VsbS5jcmVhdGVFbChcInNwYW5cIiwge1xuICAgICAgY2xzOiBcInNjLW1zZy1idXR0b25cIixcbiAgICAgIGF0dHI6IHtcbiAgICAgICAgdGl0bGU6IFwiQ29weSBtZXNzYWdlIHRvIGNsaXBib2FyZFwiIC8qIHRvb2x0aXAgKi9cbiAgICAgIH1cbiAgICB9KTtcbiAgICBPYnNpZGlhbi5zZXRJY29uKGNvcHlfYnV0dG9uLCBcImNvcHlcIik7XG4gICAgY29weV9idXR0b24uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHtcbiAgICAgIC8vIGNvcHkgbWVzc2FnZSB0byBjbGlwYm9hcmRcbiAgICAgIG5hdmlnYXRvci5jbGlwYm9hcmQud3JpdGVUZXh0KG1lc3NhZ2UudHJpbUxlZnQoKSk7XG4gICAgICBuZXcgT2JzaWRpYW4uTm90aWNlKFwiW1NtYXJ0IENvbm5lY3Rpb25zXSBNZXNzYWdlIGNvcGllZCB0byBjbGlwYm9hcmRcIik7XG4gICAgfSk7XG4gIH1cblxuICBoYW5kbGVfbGlua3NfaW5fbWVzc2FnZSgpIHtcbiAgICBjb25zdCBsaW5rcyA9IHRoaXMuYWN0aXZlX2VsbS5xdWVyeVNlbGVjdG9yQWxsKFwiYVwiKTtcbiAgICAvLyBpZiB0aGlzIGFjdGl2ZSBlbGVtZW50IGNvbnRhaW5zIGEgbGlua1xuICAgIGlmIChsaW5rcy5sZW5ndGggPiAwKSB7XG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxpbmtzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGNvbnN0IGxpbmsgPSBsaW5rc1tpXTtcbiAgICAgICAgY29uc3QgbGlua190ZXh0ID0gbGluay5nZXRBdHRyaWJ1dGUoXCJkYXRhLWhyZWZcIik7XG4gICAgICAgIC8vIHRyaWdnZXIgaG92ZXIgZXZlbnQgb24gbGlua1xuICAgICAgICBsaW5rLmFkZEV2ZW50TGlzdGVuZXIoXCJtb3VzZW92ZXJcIiwgKGV2ZW50KSA9PiB7XG4gICAgICAgICAgdGhpcy5hcHAud29ya3NwYWNlLnRyaWdnZXIoXCJob3Zlci1saW5rXCIsIHtcbiAgICAgICAgICAgIGV2ZW50LFxuICAgICAgICAgICAgc291cmNlOiBTTUFSVF9DT05ORUNUSU9OU19DSEFUX1ZJRVdfVFlQRSxcbiAgICAgICAgICAgIGhvdmVyUGFyZW50OiBsaW5rLnBhcmVudEVsZW1lbnQsXG4gICAgICAgICAgICB0YXJnZXRFbDogbGluayxcbiAgICAgICAgICAgIC8vIGV4dHJhY3QgbGluayB0ZXh0IGZyb20gYS5kYXRhLWhyZWZcbiAgICAgICAgICAgIGxpbmt0ZXh0OiBsaW5rX3RleHRcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgICAgIC8vIHRyaWdnZXIgb3BlbiBsaW5rIGV2ZW50IG9uIGxpbmtcbiAgICAgICAgbGluay5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKGV2ZW50KSA9PiB7XG4gICAgICAgICAgY29uc3QgbGlua190ZmlsZSA9IHRoaXMuYXBwLm1ldGFkYXRhQ2FjaGUuZ2V0Rmlyc3RMaW5rcGF0aERlc3QobGlua190ZXh0LCBcIi9cIik7XG4gICAgICAgICAgLy8gcHJvcGVybHkgaGFuZGxlIGlmIHRoZSBtZXRhL2N0cmwga2V5IGlzIHByZXNzZWRcbiAgICAgICAgICBjb25zdCBtb2QgPSBPYnNpZGlhbi5LZXltYXAuaXNNb2RFdmVudChldmVudCk7XG4gICAgICAgICAgLy8gZ2V0IG1vc3QgcmVjZW50IGxlYWZcbiAgICAgICAgICBsZXQgbGVhZiA9IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRMZWFmKG1vZCk7XG4gICAgICAgICAgbGVhZi5vcGVuRmlsZShsaW5rX3RmaWxlKTtcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgbmV3X21lc3NzYWdlX2J1YmJsZShmcm9tKSB7XG4gICAgbGV0IG1lc3NhZ2VfZWwgPSB0aGlzLm1lc3NhZ2VfY29udGFpbmVyLmNyZWF0ZURpdihgc2MtbWVzc2FnZSAke2Zyb219YCk7XG4gICAgLy8gY3JlYXRlIG1lc3NhZ2UgY29udGVudFxuICAgIHRoaXMuYWN0aXZlX2VsbSA9IG1lc3NhZ2VfZWwuY3JlYXRlRGl2KFwic2MtbWVzc2FnZS1jb250ZW50XCIpO1xuICAgIC8vIHNldCBsYXN0IGZyb21cbiAgICB0aGlzLmxhc3RfZnJvbSA9IGZyb207XG4gIH1cblxuICBhc3luYyByZXF1ZXN0X2NoYXRncHRfY29tcGxldGlvbihvcHRzPXt9KSB7XG4gICAgY29uc3QgY2hhdF9tbCA9IG9wdHMubWVzc2FnZXMgfHwgb3B0cy5jaGF0X21sIHx8IHRoaXMuY2hhdC5wcmVwYXJlX2NoYXRfbWwoKTtcbiAgICBjb25zb2xlLmxvZyhcImNoYXRfbWxcIiwgY2hhdF9tbCk7XG4gICAgY29uc3QgbWF4X3RvdGFsX3Rva2VucyA9IE1hdGgucm91bmQoZ2V0X21heF9jaGFycyh0aGlzLnBsdWdpbi5zZXR0aW5ncy5zbWFydF9jaGF0X21vZGVsKSAvIDQpO1xuICAgIGNvbnNvbGUubG9nKFwibWF4X3RvdGFsX3Rva2Vuc1wiLCBtYXhfdG90YWxfdG9rZW5zKTtcbiAgICBjb25zdCBjdXJyX3Rva2VuX2VzdCA9IE1hdGgucm91bmQoSlNPTi5zdHJpbmdpZnkoY2hhdF9tbCkubGVuZ3RoIC8gMyk7XG4gICAgY29uc29sZS5sb2coXCJjdXJyX3Rva2VuX2VzdFwiLCBjdXJyX3Rva2VuX2VzdCk7XG4gICAgY29uc3QgbWF4X2F2YWlsYWJsZV90b2tlbnMgPSBtYXhfdG90YWxfdG9rZW5zIC0gY3Vycl90b2tlbl9lc3Q7XG4gICAgY29uc29sZS5sb2coXCJtYXhfYXZhaWxhYmxlX3Rva2Vuc1wiLCBtYXhfYXZhaWxhYmxlX3Rva2Vucyk7XG4gICAgb3B0cyA9IHtcbiAgICAgIG1vZGVsOiB0aGlzLnBsdWdpbi5zZXR0aW5ncy5zbWFydF9jaGF0X21vZGVsLFxuICAgICAgbWVzc2FnZXM6IGNoYXRfbWwsXG4gICAgICAvLyBtYXhfdG9rZW5zOiAyNTAsXG4gICAgICBtYXhfdG9rZW5zOiBtYXhfYXZhaWxhYmxlX3Rva2VucyxcbiAgICAgIHRlbXBlcmF0dXJlOiAwLjMsXG4gICAgICB0b3BfcDogMSxcbiAgICAgIHByZXNlbmNlX3BlbmFsdHk6IDAsXG4gICAgICBmcmVxdWVuY3lfcGVuYWx0eTogMCxcbiAgICAgIHN0cmVhbTogdHJ1ZSxcbiAgICAgIHN0b3A6IG51bGwsXG4gICAgICBuOiAxLFxuICAgICAgLy8gbG9naXRfYmlhczogbG9naXRfYmlhcyxcbiAgICAgIC4uLm9wdHNcbiAgICB9XG4gICAgLy8gY29uc29sZS5sb2cob3B0cy5tZXNzYWdlcyk7XG4gICAgaWYob3B0cy5zdHJlYW0pIHtcbiAgICAgIGNvbnN0IGZ1bGxfc3RyID0gYXdhaXQgbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgIC8vIGNvbnNvbGUubG9nKFwic3RyZWFtXCIsIG9wdHMpO1xuICAgICAgICAgIGNvbnN0IHVybCA9IFwiaHR0cHM6Ly9hcGkub3BlbmFpLmNvbS92MS9jaGF0L2NvbXBsZXRpb25zXCI7XG4gICAgICAgICAgdGhpcy5hY3RpdmVfc3RyZWFtID0gbmV3IFNjU3RyZWFtZXIodXJsLCB7XG4gICAgICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgICAgIFwiQ29udGVudC1UeXBlXCI6IFwiYXBwbGljYXRpb24vanNvblwiLFxuICAgICAgICAgICAgICBBdXRob3JpemF0aW9uOiBgQmVhcmVyICR7dGhpcy5wbHVnaW4uc2V0dGluZ3MuYXBpX2tleX1gXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgbWV0aG9kOiBcIlBPU1RcIixcbiAgICAgICAgICAgIHBheWxvYWQ6IEpTT04uc3RyaW5naWZ5KG9wdHMpXG4gICAgICAgICAgfSk7XG4gICAgICAgICAgbGV0IHR4dCA9IFwiXCI7XG4gICAgICAgICAgdGhpcy5hY3RpdmVfc3RyZWFtLmFkZEV2ZW50TGlzdGVuZXIoXCJtZXNzYWdlXCIsIChlKSA9PiB7XG4gICAgICAgICAgICBpZiAoZS5kYXRhICE9IFwiW0RPTkVdXCIpIHtcbiAgICAgICAgICAgICAgY29uc3QgcGF5bG9hZCA9IEpTT04ucGFyc2UoZS5kYXRhKTtcbiAgICAgICAgICAgICAgY29uc3QgdGV4dCA9IHBheWxvYWQuY2hvaWNlc1swXS5kZWx0YS5jb250ZW50O1xuICAgICAgICAgICAgICBpZiAoIXRleHQpIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgdHh0ICs9IHRleHQ7XG4gICAgICAgICAgICAgIHRoaXMucmVuZGVyX21lc3NhZ2UodGV4dCwgXCJhc3Npc3RhbnRcIiwgdHJ1ZSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICB0aGlzLmVuZF9zdHJlYW0oKTtcbiAgICAgICAgICAgICAgcmVzb2x2ZSh0eHQpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pO1xuICAgICAgICAgIHRoaXMuYWN0aXZlX3N0cmVhbS5hZGRFdmVudExpc3RlbmVyKFwicmVhZHlzdGF0ZWNoYW5nZVwiLCAoZSkgPT4ge1xuICAgICAgICAgICAgaWYgKGUucmVhZHlTdGF0ZSA+PSAyKSB7XG4gICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiUmVhZHlTdGF0ZTogXCIgKyBlLnJlYWR5U3RhdGUpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pO1xuICAgICAgICAgIHRoaXMuYWN0aXZlX3N0cmVhbS5hZGRFdmVudExpc3RlbmVyKFwiZXJyb3JcIiwgKGUpID0+IHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoZSk7XG4gICAgICAgICAgICBuZXcgT2JzaWRpYW4uTm90aWNlKFwiU21hcnQgQ29ubmVjdGlvbnMgRXJyb3IgU3RyZWFtaW5nIFJlc3BvbnNlLiBTZWUgY29uc29sZSBmb3IgZGV0YWlscy5cIik7XG4gICAgICAgICAgICB0aGlzLnJlbmRlcl9tZXNzYWdlKFwiKkFQSSBFcnJvci4gU2VlIGNvbnNvbGUgbG9ncyBmb3IgZGV0YWlscy4qXCIsIFwiYXNzaXN0YW50XCIpO1xuICAgICAgICAgICAgdGhpcy5lbmRfc3RyZWFtKCk7XG4gICAgICAgICAgICByZWplY3QoZSk7XG4gICAgICAgICAgfSk7XG4gICAgICAgICAgdGhpcy5hY3RpdmVfc3RyZWFtLnN0cmVhbSgpO1xuICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICBjb25zb2xlLmVycm9yKGVycik7XG4gICAgICAgICAgbmV3IE9ic2lkaWFuLk5vdGljZShcIlNtYXJ0IENvbm5lY3Rpb25zIEVycm9yIFN0cmVhbWluZyBSZXNwb25zZS4gU2VlIGNvbnNvbGUgZm9yIGRldGFpbHMuXCIpO1xuICAgICAgICAgIHRoaXMuZW5kX3N0cmVhbSgpO1xuICAgICAgICAgIHJlamVjdChlcnIpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICAgIC8vIGNvbnNvbGUubG9nKGZ1bGxfc3RyKTtcbiAgICAgIGF3YWl0IHRoaXMucmVuZGVyX21lc3NhZ2UoZnVsbF9zdHIsIFwiYXNzaXN0YW50XCIpO1xuICAgICAgdGhpcy5jaGF0Lm5ld19tZXNzYWdlX2luX3RocmVhZCh7XG4gICAgICAgIHJvbGU6IFwiYXNzaXN0YW50XCIsXG4gICAgICAgIGNvbnRlbnQ6IGZ1bGxfc3RyXG4gICAgICB9KTtcbiAgICAgIHJldHVybjtcbiAgICB9ZWxzZXtcbiAgICAgIHRyeXtcbiAgICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCAoMCwgT2JzaWRpYW4ucmVxdWVzdFVybCkoe1xuICAgICAgICAgIHVybDogYGh0dHBzOi8vYXBpLm9wZW5haS5jb20vdjEvY2hhdC9jb21wbGV0aW9uc2AsXG4gICAgICAgICAgbWV0aG9kOiBcIlBPU1RcIixcbiAgICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgICBBdXRob3JpemF0aW9uOiBgQmVhcmVyICR7dGhpcy5wbHVnaW4uc2V0dGluZ3MuYXBpX2tleX1gLFxuICAgICAgICAgICAgXCJDb250ZW50LVR5cGVcIjogXCJhcHBsaWNhdGlvbi9qc29uXCJcbiAgICAgICAgICB9LFxuICAgICAgICAgIGNvbnRlbnRUeXBlOiBcImFwcGxpY2F0aW9uL2pzb25cIixcbiAgICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeShvcHRzKSxcbiAgICAgICAgICB0aHJvdzogZmFsc2VcbiAgICAgICAgfSk7XG4gICAgICAgIC8vIGNvbnNvbGUubG9nKHJlc3BvbnNlKTtcbiAgICAgICAgcmV0dXJuIEpTT04ucGFyc2UocmVzcG9uc2UudGV4dCkuY2hvaWNlc1swXS5tZXNzYWdlLmNvbnRlbnQ7XG4gICAgICB9Y2F0Y2goZXJyKXtcbiAgICAgICAgbmV3IE9ic2lkaWFuLk5vdGljZShgU21hcnQgQ29ubmVjdGlvbnMgQVBJIEVycm9yIDo6ICR7ZXJyfWApO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGVuZF9zdHJlYW0oKSB7XG4gICAgaWYodGhpcy5hY3RpdmVfc3RyZWFtKXtcbiAgICAgIHRoaXMuYWN0aXZlX3N0cmVhbS5jbG9zZSgpO1xuICAgICAgdGhpcy5hY3RpdmVfc3RyZWFtID0gbnVsbDtcbiAgICB9XG4gICAgdGhpcy51bnNldF9zdHJlYW1pbmdfdXgoKTtcbiAgICBpZih0aGlzLmRvdGRvdGRvdF9pbnRlcnZhbCl7XG4gICAgICBjbGVhckludGVydmFsKHRoaXMuZG90ZG90ZG90X2ludGVydmFsKTtcbiAgICAgIHRoaXMuZG90ZG90ZG90X2ludGVydmFsID0gbnVsbDtcbiAgICAgIC8vIHJlbW92ZSBwYXJlbnQgb2YgYWN0aXZlX2VsbVxuICAgICAgdGhpcy5hY3RpdmVfZWxtLnBhcmVudEVsZW1lbnQucmVtb3ZlKCk7XG4gICAgICB0aGlzLmFjdGl2ZV9lbG0gPSBudWxsO1xuICAgIH1cbiAgfVxuXG4gIGFzeW5jIGdldF9jb250ZXh0X2h5ZGUodXNlcl9pbnB1dCkge1xuICAgIHRoaXMuY2hhdC5yZXNldF9jb250ZXh0KCk7XG4gICAgLy8gY291bnQgY3VycmVudCBjaGF0IG1sIG1lc3NhZ2VzIHRvIGRldGVybWluZSAncXVlc3Rpb24nIG9yICdjaGF0IGxvZycgd29yZGluZ1xuICAgIGNvbnN0IGh5ZF9pbnB1dCA9IGBBbnRpY2lwYXRlIHdoYXQgdGhlIHVzZXIgaXMgc2Vla2luZy4gUmVzcG9uZCBpbiB0aGUgZm9ybSBvZiBhIGh5cG90aGV0aWNhbCBub3RlIHdyaXR0ZW4gYnkgdGhlIHVzZXIuIFRoZSBub3RlIG1heSBjb250YWluIHN0YXRlbWVudHMgYXMgcGFyYWdyYXBocywgbGlzdHMsIG9yIGNoZWNrbGlzdHMgaW4gbWFya2Rvd24gZm9ybWF0IHdpdGggbm8gaGVhZGluZ3MuIFBsZWFzZSByZXNwb25kIHdpdGggb25lIGh5cG90aGV0aWNhbCBub3RlIGFuZCBhYnN0YWluIGZyb20gYW55IG90aGVyIGNvbW1lbnRhcnkuIFVzZSB0aGUgZm9ybWF0OiBQQVJFTlQgRk9MREVSIE5BTUUgPiBDSElMRCBGT0xERVIgTkFNRSA+IEZJTEUgTkFNRSA+IEhFQURJTkcgMSA+IEhFQURJTkcgMiA+IEhFQURJTkcgMzogSFlQT1RIRVRJQ0FMIE5PVEUgQ09OVEVOVFMuYDtcbiAgICAvLyBjb21wbGV0ZVxuICAgIGNvbnN0IGNoYXRtbCA9IFtcbiAgICAgIHtcbiAgICAgICAgcm9sZTogXCJzeXN0ZW1cIixcbiAgICAgICAgY29udGVudDogaHlkX2lucHV0IFxuICAgICAgfSxcbiAgICAgIHtcbiAgICAgICAgcm9sZTogXCJ1c2VyXCIsXG4gICAgICAgIGNvbnRlbnQ6IHVzZXJfaW5wdXRcbiAgICAgIH1cbiAgICBdO1xuICAgIGNvbnN0IGh5ZCA9IGF3YWl0IHRoaXMucmVxdWVzdF9jaGF0Z3B0X2NvbXBsZXRpb24oe1xuICAgICAgbWVzc2FnZXM6IGNoYXRtbCxcbiAgICAgIHN0cmVhbTogZmFsc2UsXG4gICAgICB0ZW1wZXJhdHVyZTogMCxcbiAgICAgIG1heF90b2tlbnM6IDEzNyxcbiAgICB9KTtcbiAgICB0aGlzLmNoYXQuaHlkID0gaHlkO1xuICAgIC8vIGNvbnNvbGUubG9nKGh5ZCk7XG4gICAgbGV0IGZpbHRlciA9IHt9O1xuICAgIC8vIGlmIGNvbnRhaW5zIGZvbGRlciByZWZlcmVuY2UgcmVwcmVzZW50ZWQgYnkgL2ZvbGRlci9cbiAgICBpZih0aGlzLmNoYXQuY29udGFpbnNfZm9sZGVyX3JlZmVyZW5jZSh1c2VyX2lucHV0KSkge1xuICAgICAgLy8gZ2V0IGZvbGRlciByZWZlcmVuY2VzXG4gICAgICBjb25zdCBmb2xkZXJfcmVmcyA9IHRoaXMuY2hhdC5nZXRfZm9sZGVyX3JlZmVyZW5jZXModXNlcl9pbnB1dCk7XG4gICAgICAvLyBjb25zb2xlLmxvZyhmb2xkZXJfcmVmcyk7XG4gICAgICAvLyBpZiBmb2xkZXIgcmVmZXJlbmNlcyBhcmUgdmFsaWQgKHN0cmluZyBvciBhcnJheSBvZiBzdHJpbmdzKVxuICAgICAgaWYoZm9sZGVyX3JlZnMpe1xuICAgICAgICBmaWx0ZXIgPSB7XG4gICAgICAgICAgcGF0aF9iZWdpbnNfd2l0aDogZm9sZGVyX3JlZnNcbiAgICAgICAgfTtcbiAgICAgIH1cbiAgICB9XG4gICAgLy8gc2VhcmNoIGZvciBuZWFyZXN0IGJhc2VkIG9uIGh5ZFxuICAgIGxldCBuZWFyZXN0ID0gYXdhaXQgdGhpcy5wbHVnaW4uYXBpLnNlYXJjaChoeWQsIGZpbHRlcik7XG4gICAgY29uc29sZS5sb2coXCJuZWFyZXN0XCIsIG5lYXJlc3QubGVuZ3RoKTtcbiAgICBuZWFyZXN0ID0gdGhpcy5nZXRfbmVhcmVzdF91bnRpbF9uZXh0X2Rldl9leGNlZWRzX3N0ZF9kZXYobmVhcmVzdCk7XG4gICAgY29uc29sZS5sb2coXCJuZWFyZXN0IGFmdGVyIHN0ZCBkZXYgc2xpY2VcIiwgbmVhcmVzdC5sZW5ndGgpO1xuICAgIG5lYXJlc3QgPSB0aGlzLnNvcnRfYnlfbGVuX2FkanVzdGVkX3NpbWlsYXJpdHkobmVhcmVzdCk7XG4gICAgXG4gICAgcmV0dXJuIGF3YWl0IHRoaXMuZ2V0X2NvbnRleHRfZm9yX3Byb21wdChuZWFyZXN0KTtcbiAgfVxuICBcbiAgXG4gIHNvcnRfYnlfbGVuX2FkanVzdGVkX3NpbWlsYXJpdHkobmVhcmVzdCkge1xuICAgIC8vIHJlLXNvcnQgYnkgcXVvdGllbnQgb2Ygc2ltaWxhcml0eSBkaXZpZGVkIGJ5IGxlbiBERVNDXG4gICAgbmVhcmVzdCA9IG5lYXJlc3Quc29ydCgoYSwgYikgPT4ge1xuICAgICAgY29uc3QgYV9zY29yZSA9IGEuc2ltaWxhcml0eSAvIGEubGVuO1xuICAgICAgY29uc3QgYl9zY29yZSA9IGIuc2ltaWxhcml0eSAvIGIubGVuO1xuICAgICAgLy8gaWYgYSBpcyBncmVhdGVyIHRoYW4gYiwgcmV0dXJuIC0xXG4gICAgICBpZiAoYV9zY29yZSA+IGJfc2NvcmUpXG4gICAgICAgIHJldHVybiAtMTtcbiAgICAgIC8vIGlmIGEgaXMgbGVzcyB0aGFuIGIsIHJldHVybiAxXG4gICAgICBpZiAoYV9zY29yZSA8IGJfc2NvcmUpXG4gICAgICAgIHJldHVybiAxO1xuICAgICAgLy8gaWYgYSBpcyBlcXVhbCB0byBiLCByZXR1cm4gMFxuICAgICAgcmV0dXJuIDA7XG4gICAgfSk7XG4gICAgcmV0dXJuIG5lYXJlc3Q7XG4gIH1cblxuICBnZXRfbmVhcmVzdF91bnRpbF9uZXh0X2Rldl9leGNlZWRzX3N0ZF9kZXYobmVhcmVzdCkge1xuICAgIC8vIGdldCBzdGQgZGV2IG9mIHNpbWlsYXJpdHlcbiAgICBjb25zdCBzaW0gPSBuZWFyZXN0Lm1hcCgobikgPT4gbi5zaW1pbGFyaXR5KTtcbiAgICBjb25zdCBtZWFuID0gc2ltLnJlZHVjZSgoYSwgYikgPT4gYSArIGIpIC8gc2ltLmxlbmd0aDtcbiAgICBjb25zdCBzdGRfZGV2ID0gTWF0aC5zcXJ0KHNpbS5tYXAoKHgpID0+IE1hdGgucG93KHggLSBtZWFuLCAyKSkucmVkdWNlKChhLCBiKSA9PiBhICsgYikgLyBzaW0ubGVuZ3RoKTtcbiAgICAvLyBzbGljZSB3aGVyZSBuZXh0IGl0ZW0gZGV2aWF0aW9uIGlzIGdyZWF0ZXIgdGhhbiBzdGRfZGV2XG4gICAgbGV0IHNsaWNlX2kgPSAwO1xuICAgIHdoaWxlIChzbGljZV9pIDwgbmVhcmVzdC5sZW5ndGgpIHtcbiAgICAgIGNvbnN0IG5leHQgPSBuZWFyZXN0W3NsaWNlX2kgKyAxXTtcbiAgICAgIGlmIChuZXh0KSB7XG4gICAgICAgIGNvbnN0IG5leHRfZGV2ID0gTWF0aC5hYnMobmV4dC5zaW1pbGFyaXR5IC0gbmVhcmVzdFtzbGljZV9pXS5zaW1pbGFyaXR5KTtcbiAgICAgICAgaWYgKG5leHRfZGV2ID4gc3RkX2Rldikge1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBzbGljZV9pKys7XG4gICAgfVxuICAgIC8vIHNlbGVjdCB0b3AgcmVzdWx0c1xuICAgIG5lYXJlc3QgPSBuZWFyZXN0LnNsaWNlKDAsIHNsaWNlX2krMSk7XG4gICAgcmV0dXJuIG5lYXJlc3Q7XG4gIH1cbiAgLy8gdGhpcy50ZXN0X2dldF9uZWFyZXN0X3VudGlsX25leHRfZGV2X2V4Y2VlZHNfc3RkX2RldigpO1xuICAvLyAvLyB0ZXN0IGdldF9uZWFyZXN0X3VudGlsX25leHRfZGV2X2V4Y2VlZHNfc3RkX2RldlxuICAvLyB0ZXN0X2dldF9uZWFyZXN0X3VudGlsX25leHRfZGV2X2V4Y2VlZHNfc3RkX2RldigpIHtcbiAgLy8gICBjb25zdCBuZWFyZXN0ID0gW3tzaW1pbGFyaXR5OiAwLjk5fSwge3NpbWlsYXJpdHk6IDAuOTh9LCB7c2ltaWxhcml0eTogMC45N30sIHtzaW1pbGFyaXR5OiAwLjk2fSwge3NpbWlsYXJpdHk6IDAuOTV9LCB7c2ltaWxhcml0eTogMC45NH0sIHtzaW1pbGFyaXR5OiAwLjkzfSwge3NpbWlsYXJpdHk6IDAuOTJ9LCB7c2ltaWxhcml0eTogMC45MX0sIHtzaW1pbGFyaXR5OiAwLjl9LCB7c2ltaWxhcml0eTogMC43OX0sIHtzaW1pbGFyaXR5OiAwLjc4fSwge3NpbWlsYXJpdHk6IDAuNzd9LCB7c2ltaWxhcml0eTogMC43Nn0sIHtzaW1pbGFyaXR5OiAwLjc1fSwge3NpbWlsYXJpdHk6IDAuNzR9LCB7c2ltaWxhcml0eTogMC43M30sIHtzaW1pbGFyaXR5OiAwLjcyfV07XG4gIC8vICAgY29uc3QgcmVzdWx0ID0gdGhpcy5nZXRfbmVhcmVzdF91bnRpbF9uZXh0X2Rldl9leGNlZWRzX3N0ZF9kZXYobmVhcmVzdCk7XG4gIC8vICAgaWYocmVzdWx0Lmxlbmd0aCAhPT0gMTApe1xuICAvLyAgICAgY29uc29sZS5lcnJvcihcImdldF9uZWFyZXN0X3VudGlsX25leHRfZGV2X2V4Y2VlZHNfc3RkX2RldiBmYWlsZWRcIiwgcmVzdWx0KTtcbiAgLy8gICB9XG4gIC8vIH1cblxuICBhc3luYyBnZXRfY29udGV4dF9mb3JfcHJvbXB0KG5lYXJlc3QpIHtcbiAgICBsZXQgY29udGV4dCA9IFtdO1xuICAgIGNvbnN0IE1BWF9TT1VSQ0VTID0gMjA7IC8vIDEwICogMTAwMCAobWF4IGNoYXJzKSA9IDEwLDAwMCBjaGFycyAobXVzdCBiZSB1bmRlciB+MTYsMDAwIGNoYXJzIG9yIDRLIHRva2VucykgXG4gICAgY29uc3QgTUFYX0NIQVJTID0gZ2V0X21heF9jaGFycyh0aGlzLnBsdWdpbi5zZXR0aW5ncy5zbWFydF9jaGF0X21vZGVsKSAvIDI7XG4gICAgbGV0IGNoYXJfYWNjdW0gPSAwO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbmVhcmVzdC5sZW5ndGg7IGkrKykge1xuICAgICAgaWYgKGNvbnRleHQubGVuZ3RoID49IE1BWF9TT1VSQ0VTKVxuICAgICAgICBicmVhaztcbiAgICAgIGlmIChjaGFyX2FjY3VtID49IE1BWF9DSEFSUylcbiAgICAgICAgYnJlYWs7XG4gICAgICBpZiAodHlwZW9mIG5lYXJlc3RbaV0ubGluayAhPT0gJ3N0cmluZycpXG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgLy8gZ2VuZXJhdGUgYnJlYWRjcnVtYnNcbiAgICAgIGNvbnN0IGJyZWFkY3J1bWJzID0gbmVhcmVzdFtpXS5saW5rLnJlcGxhY2UoLyMvZywgXCIgPiBcIikucmVwbGFjZShcIi5tZFwiLCBcIlwiKS5yZXBsYWNlKC9cXC8vZywgXCIgPiBcIik7XG4gICAgICBsZXQgbmV3X2NvbnRleHQgPSBgJHticmVhZGNydW1ic306XFxuYDtcbiAgICAgIC8vIGdldCBtYXggYXZhaWxhYmxlIGNoYXJzIHRvIGFkZCB0byBjb250ZXh0XG4gICAgICBjb25zdCBtYXhfYXZhaWxhYmxlX2NoYXJzID0gTUFYX0NIQVJTIC0gY2hhcl9hY2N1bSAtIG5ld19jb250ZXh0Lmxlbmd0aDtcbiAgICAgIGlmIChuZWFyZXN0W2ldLmxpbmsuaW5kZXhPZihcIiNcIikgIT09IC0xKSB7IC8vIGlzIGJsb2NrXG4gICAgICAgIG5ld19jb250ZXh0ICs9IGF3YWl0IHRoaXMucGx1Z2luLmJsb2NrX3JldHJpZXZlcihuZWFyZXN0W2ldLmxpbmssIHsgbWF4X2NoYXJzOiBtYXhfYXZhaWxhYmxlX2NoYXJzIH0pO1xuICAgICAgfSBlbHNlIHsgLy8gaXMgZmlsZVxuICAgICAgICBuZXdfY29udGV4dCArPSBhd2FpdCB0aGlzLnBsdWdpbi5maWxlX3JldHJpZXZlcihuZWFyZXN0W2ldLmxpbmssIHsgbWF4X2NoYXJzOiBtYXhfYXZhaWxhYmxlX2NoYXJzIH0pO1xuICAgICAgfVxuICAgICAgLy8gYWRkIHRvIGNoYXJfYWNjdW1cbiAgICAgIGNoYXJfYWNjdW0gKz0gbmV3X2NvbnRleHQubGVuZ3RoO1xuICAgICAgLy8gYWRkIHRvIGNvbnRleHRcbiAgICAgIGNvbnRleHQucHVzaCh7XG4gICAgICAgIGxpbms6IG5lYXJlc3RbaV0ubGluayxcbiAgICAgICAgdGV4dDogbmV3X2NvbnRleHRcbiAgICAgIH0pO1xuICAgIH1cbiAgICAvLyBjb250ZXh0IHNvdXJjZXNcbiAgICBjb25zb2xlLmxvZyhcImNvbnRleHQgc291cmNlczogXCIgKyBjb250ZXh0Lmxlbmd0aCk7XG4gICAgLy8gY2hhcl9hY2N1bSBkaXZpZGVkIGJ5IDQgYW5kIHJvdW5kZWQgdG8gbmVhcmVzdCBpbnRlZ2VyIGZvciBlc3RpbWF0ZWQgdG9rZW5zXG4gICAgY29uc29sZS5sb2coXCJ0b3RhbCBjb250ZXh0IHRva2VuczogflwiICsgTWF0aC5yb3VuZChjaGFyX2FjY3VtIC8gMy41KSk7XG4gICAgLy8gYnVpbGQgY29udGV4dCBpbnB1dFxuICAgIHRoaXMuY2hhdC5jb250ZXh0ID0gYEFudGljaXBhdGUgdGhlIHR5cGUgb2YgYW5zd2VyIGRlc2lyZWQgYnkgdGhlIHVzZXIuIEltYWdpbmUgdGhlIGZvbGxvd2luZyAke2NvbnRleHQubGVuZ3RofSBub3RlcyB3ZXJlIHdyaXR0ZW4gYnkgdGhlIHVzZXIgYW5kIGNvbnRhaW4gYWxsIHRoZSBuZWNlc3NhcnkgaW5mb3JtYXRpb24gdG8gYW5zd2VyIHRoZSB1c2VyJ3MgcXVlc3Rpb24uIEJlZ2luIHJlc3BvbnNlcyB3aXRoIFwiJHtTTUFSVF9UUkFOU0xBVElPTlt0aGlzLnBsdWdpbi5zZXR0aW5ncy5sYW5ndWFnZV0ucHJvbXB0fS4uLlwiYDtcbiAgICBmb3IobGV0IGkgPSAwOyBpIDwgY29udGV4dC5sZW5ndGg7IGkrKykge1xuICAgICAgdGhpcy5jaGF0LmNvbnRleHQgKz0gYFxcbi0tLUJFR0lOICMke2krMX0tLS1cXG4ke2NvbnRleHRbaV0udGV4dH1cXG4tLS1FTkQgIyR7aSsxfS0tLWA7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLmNoYXQuY29udGV4dDtcbiAgfVxuXG5cbn1cblxuZnVuY3Rpb24gZ2V0X21heF9jaGFycyhtb2RlbD1cImdwdC0zLjUtdHVyYm9cIikge1xuICBjb25zdCBNQVhfQ0hBUl9NQVAgPSB7XG4gICAgXCJncHQtMy41LXR1cmJvLTE2a1wiOiA0ODAwMCxcbiAgICBcImdwdC00XCI6IDI0MDAwLFxuICAgIFwiZ3B0LTMuNS10dXJib1wiOiAxMjAwMCxcbiAgfTtcbiAgcmV0dXJuIE1BWF9DSEFSX01BUFttb2RlbF07XG59XG4vKipcbiAqIFNtYXJ0Q29ubmVjdGlvbnNDaGF0TW9kZWxcbiAqIC0tLVxuICogLSAndGhyZWFkJyBmb3JtYXQ6IEFycmF5W0FycmF5W09iamVjdHtyb2xlLCBjb250ZW50LCBoeWRlfV1dXG4gKiAgLSBbVHVyblt2YXJpYXRpb257fV0sIFR1cm5bdmFyaWF0aW9ue30sIHZhcmlhdGlvbnt9XSwgLi4uXVxuICogLSBTYXZlcyBpbiAndGhyZWFkJyBmb3JtYXQgdG8gSlNPTiBmaWxlIGluIC5zbWFydC1jb25uZWN0aW9ucyBmb2xkZXIgdXNpbmcgY2hhdF9pZCBhcyBmaWxlbmFtZVxuICogLSBMb2FkcyBjaGF0IGluICd0aHJlYWQnIGZvcm1hdCBBcnJheVtBcnJheVtPYmplY3R7cm9sZSwgY29udGVudCwgaHlkZX1dXSBmcm9tIEpTT04gZmlsZSBpbiAuc21hcnQtY29ubmVjdGlvbnMgZm9sZGVyXG4gKiAtIHByZXBhcmVzIGNoYXRfbWwgcmV0dXJucyBpbiAnQ2hhdE1MJyBmb3JtYXQgXG4gKiAgLSBzdHJpcHMgYWxsIGJ1dCByb2xlIGFuZCBjb250ZW50IHByb3BlcnRpZXMgZnJvbSBPYmplY3QgaW4gQ2hhdE1MIGZvcm1hdFxuICogLSBDaGF0TUwgQXJyYXlbT2JqZWN0e3JvbGUsIGNvbnRlbnR9XVxuICogIC0gW0N1cnJlbnRfVmFyaWF0aW9uX0Zvcl9UdXJuXzF7fSwgQ3VycmVudF9WYXJpYXRpb25fRm9yX1R1cm5fMnt9LCAuLi5dXG4gKi9cbmNsYXNzIFNtYXJ0Q29ubmVjdGlvbnNDaGF0TW9kZWwge1xuICBjb25zdHJ1Y3RvcihwbHVnaW4pIHtcbiAgICB0aGlzLmFwcCA9IHBsdWdpbi5hcHA7XG4gICAgdGhpcy5wbHVnaW4gPSBwbHVnaW47XG4gICAgdGhpcy5jaGF0X2lkID0gbnVsbDtcbiAgICB0aGlzLmNoYXRfbWwgPSBbXTtcbiAgICB0aGlzLmNvbnRleHQgPSBudWxsO1xuICAgIHRoaXMuaHlkID0gbnVsbDtcbiAgICB0aGlzLnRocmVhZCA9IFtdO1xuICB9XG4gIGFzeW5jIHNhdmVfY2hhdCgpIHtcbiAgICAvLyByZXR1cm4gaWYgdGhyZWFkIGlzIGVtcHR5XG4gICAgaWYgKHRoaXMudGhyZWFkLmxlbmd0aCA9PT0gMCkgcmV0dXJuO1xuICAgIC8vIHNhdmUgY2hhdCB0byBmaWxlIGluIC5zbWFydC1jb25uZWN0aW9ucyBmb2xkZXJcbiAgICAvLyBjcmVhdGUgLnNtYXJ0LWNvbm5lY3Rpb25zL2NoYXRzLyBmb2xkZXIgaWYgaXQgZG9lc24ndCBleGlzdFxuICAgIGlmICghKGF3YWl0IHRoaXMuYXBwLnZhdWx0LmFkYXB0ZXIuZXhpc3RzKFwiLnNtYXJ0LWNvbm5lY3Rpb25zL2NoYXRzXCIpKSkge1xuICAgICAgYXdhaXQgdGhpcy5hcHAudmF1bHQuYWRhcHRlci5ta2RpcihcIi5zbWFydC1jb25uZWN0aW9ucy9jaGF0c1wiKTtcbiAgICB9XG4gICAgLy8gaWYgY2hhdF9pZCBpcyBub3Qgc2V0LCBzZXQgaXQgdG8gVU5USVRMRUQtJHt1bml4IHRpbWVzdGFtcH1cbiAgICBpZiAoIXRoaXMuY2hhdF9pZCkge1xuICAgICAgdGhpcy5jaGF0X2lkID0gdGhpcy5uYW1lKCkgKyBcIlx1MjAxNFwiICsgdGhpcy5nZXRfZmlsZV9kYXRlX3N0cmluZygpO1xuICAgIH1cbiAgICAvLyB2YWxpZGF0ZSBjaGF0X2lkIGlzIHNldCB0byB2YWxpZCBmaWxlbmFtZSBjaGFyYWN0ZXJzIChsZXR0ZXJzLCBudW1iZXJzLCB1bmRlcnNjb3JlcywgZGFzaGVzLCBlbSBkYXNoLCBhbmQgc3BhY2VzKVxuICAgIGlmICghdGhpcy5jaGF0X2lkLm1hdGNoKC9eW2EtekEtWjAtOV9cdTIwMTRcXC0gXSskLykpIHtcbiAgICAgIGNvbnNvbGUubG9nKFwiSW52YWxpZCBjaGF0X2lkOiBcIiArIHRoaXMuY2hhdF9pZCk7XG4gICAgICBuZXcgT2JzaWRpYW4uTm90aWNlKFwiW1NtYXJ0IENvbm5lY3Rpb25zXSBGYWlsZWQgdG8gc2F2ZSBjaGF0LiBJbnZhbGlkIGNoYXRfaWQ6ICdcIiArIHRoaXMuY2hhdF9pZCArIFwiJ1wiKTtcbiAgICB9XG4gICAgLy8gZmlsZW5hbWUgaXMgY2hhdF9pZFxuICAgIGNvbnN0IGNoYXRfZmlsZSA9IHRoaXMuY2hhdF9pZCArIFwiLmpzb25cIjtcbiAgICB0aGlzLmFwcC52YXVsdC5hZGFwdGVyLndyaXRlKFxuICAgICAgXCIuc21hcnQtY29ubmVjdGlvbnMvY2hhdHMvXCIgKyBjaGF0X2ZpbGUsXG4gICAgICBKU09OLnN0cmluZ2lmeSh0aGlzLnRocmVhZCwgbnVsbCwgMilcbiAgICApO1xuICB9XG4gIGFzeW5jIGxvYWRfY2hhdChjaGF0X2lkKSB7XG4gICAgdGhpcy5jaGF0X2lkID0gY2hhdF9pZDtcbiAgICAvLyBsb2FkIGNoYXQgZnJvbSBmaWxlIGluIC5zbWFydC1jb25uZWN0aW9ucyBmb2xkZXJcbiAgICAvLyBmaWxlbmFtZSBpcyBjaGF0X2lkXG4gICAgY29uc3QgY2hhdF9maWxlID0gdGhpcy5jaGF0X2lkICsgXCIuanNvblwiO1xuICAgIC8vIHJlYWQgZmlsZVxuICAgIGxldCBjaGF0X2pzb24gPSBhd2FpdCB0aGlzLmFwcC52YXVsdC5hZGFwdGVyLnJlYWQoXG4gICAgICBcIi5zbWFydC1jb25uZWN0aW9ucy9jaGF0cy9cIiArIGNoYXRfZmlsZVxuICAgICk7XG4gICAgLy8gcGFyc2UganNvblxuICAgIHRoaXMudGhyZWFkID0gSlNPTi5wYXJzZShjaGF0X2pzb24pO1xuICAgIC8vIGxvYWQgY2hhdF9tbFxuICAgIHRoaXMuY2hhdF9tbCA9IHRoaXMucHJlcGFyZV9jaGF0X21sKCk7XG4gICAgLy8gcmVuZGVyIG1lc3NhZ2VzIGluIGNoYXQgdmlld1xuICAgIC8vIGZvciBlYWNoIHR1cm4gaW4gY2hhdF9tbFxuICAgIC8vIGNvbnNvbGUubG9nKHRoaXMudGhyZWFkKTtcbiAgICAvLyBjb25zb2xlLmxvZyh0aGlzLmNoYXRfbWwpO1xuICB9XG4gIC8vIHByZXBhcmUgY2hhdF9tbCBmcm9tIGNoYXRcbiAgLy8gZ2V0cyB0aGUgbGFzdCBtZXNzYWdlIG9mIGVhY2ggdHVybiB1bmxlc3MgdHVybl92YXJpYXRpb25fb2Zmc2V0cz1bW3R1cm5faW5kZXgsdmFyaWF0aW9uX2luZGV4XV0gaXMgc3BlY2lmaWVkIGluIG9mZnNldFxuICBwcmVwYXJlX2NoYXRfbWwodHVybl92YXJpYXRpb25fb2Zmc2V0cz1bXSkge1xuICAgIC8vIGlmIG5vIHR1cm5fdmFyaWF0aW9uX29mZnNldHMsIGdldCB0aGUgbGFzdCBtZXNzYWdlIG9mIGVhY2ggdHVyblxuICAgIGlmKHR1cm5fdmFyaWF0aW9uX29mZnNldHMubGVuZ3RoID09PSAwKXtcbiAgICAgIHRoaXMuY2hhdF9tbCA9IHRoaXMudGhyZWFkLm1hcCh0dXJuID0+IHtcbiAgICAgICAgcmV0dXJuIHR1cm5bdHVybi5sZW5ndGggLSAxXTtcbiAgICAgIH0pO1xuICAgIH1lbHNle1xuICAgICAgLy8gY3JlYXRlIGFuIGFycmF5IGZyb20gdHVybl92YXJpYXRpb25fb2Zmc2V0cyB0aGF0IGluZGV4ZXMgdmFyaWF0aW9uX2luZGV4IGF0IHR1cm5faW5kZXhcbiAgICAgIC8vIGV4LiBbWzMsNV1dID0+IFt1bmRlZmluZWQsIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCA1XVxuICAgICAgbGV0IHR1cm5fdmFyaWF0aW9uX2luZGV4ID0gW107XG4gICAgICBmb3IobGV0IGkgPSAwOyBpIDwgdHVybl92YXJpYXRpb25fb2Zmc2V0cy5sZW5ndGg7IGkrKyl7XG4gICAgICAgIHR1cm5fdmFyaWF0aW9uX2luZGV4W3R1cm5fdmFyaWF0aW9uX29mZnNldHNbaV1bMF1dID0gdHVybl92YXJpYXRpb25fb2Zmc2V0c1tpXVsxXTtcbiAgICAgIH1cbiAgICAgIC8vIGxvb3AgdGhyb3VnaCBjaGF0XG4gICAgICB0aGlzLmNoYXRfbWwgPSB0aGlzLnRocmVhZC5tYXAoKHR1cm4sIHR1cm5faW5kZXgpID0+IHtcbiAgICAgICAgLy8gaWYgdGhlcmUgaXMgYW4gaW5kZXggZm9yIHRoaXMgdHVybiwgcmV0dXJuIHRoZSB2YXJpYXRpb24gYXQgdGhhdCBpbmRleFxuICAgICAgICBpZih0dXJuX3ZhcmlhdGlvbl9pbmRleFt0dXJuX2luZGV4XSAhPT0gdW5kZWZpbmVkKXtcbiAgICAgICAgICByZXR1cm4gdHVyblt0dXJuX3ZhcmlhdGlvbl9pbmRleFt0dXJuX2luZGV4XV07XG4gICAgICAgIH1cbiAgICAgICAgLy8gb3RoZXJ3aXNlIHJldHVybiB0aGUgbGFzdCBtZXNzYWdlIG9mIHRoZSB0dXJuXG4gICAgICAgIHJldHVybiB0dXJuW3R1cm4ubGVuZ3RoIC0gMV07XG4gICAgICB9KTtcbiAgICB9XG4gICAgLy8gc3RyaXAgYWxsIGJ1dCByb2xlIGFuZCBjb250ZW50IHByb3BlcnRpZXMgZnJvbSBlYWNoIG1lc3NhZ2VcbiAgICB0aGlzLmNoYXRfbWwgPSB0aGlzLmNoYXRfbWwubWFwKG1lc3NhZ2UgPT4ge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgcm9sZTogbWVzc2FnZS5yb2xlLFxuICAgICAgICBjb250ZW50OiBtZXNzYWdlLmNvbnRlbnRcbiAgICAgIH07XG4gICAgfSk7XG4gICAgcmV0dXJuIHRoaXMuY2hhdF9tbDtcbiAgfVxuICBsYXN0KCkge1xuICAgIC8vIGdldCBsYXN0IG1lc3NhZ2UgZnJvbSBjaGF0XG4gICAgcmV0dXJuIHRoaXMudGhyZWFkW3RoaXMudGhyZWFkLmxlbmd0aCAtIDFdW3RoaXMudGhyZWFkW3RoaXMudGhyZWFkLmxlbmd0aCAtIDFdLmxlbmd0aCAtIDFdO1xuICB9XG4gIGxhc3RfZnJvbSgpIHtcbiAgICByZXR1cm4gdGhpcy5sYXN0KCkucm9sZTtcbiAgfVxuICAvLyByZXR1cm5zIHVzZXJfaW5wdXQgb3IgY29tcGxldGlvblxuICBsYXN0X21lc3NhZ2UoKSB7XG4gICAgcmV0dXJuIHRoaXMubGFzdCgpLmNvbnRlbnQ7XG4gIH1cbiAgLy8gbWVzc2FnZT17fVxuICAvLyBhZGQgbmV3IG1lc3NhZ2UgdG8gdGhyZWFkXG4gIG5ld19tZXNzYWdlX2luX3RocmVhZChtZXNzYWdlLCB0dXJuPS0xKSB7XG4gICAgLy8gaWYgdHVybiBpcyAtMSwgYWRkIHRvIG5ldyB0dXJuXG4gICAgaWYodGhpcy5jb250ZXh0KXtcbiAgICAgIG1lc3NhZ2UuY29udGV4dCA9IHRoaXMuY29udGV4dDtcbiAgICAgIHRoaXMuY29udGV4dCA9IG51bGw7XG4gICAgfVxuICAgIGlmKHRoaXMuaHlkKXtcbiAgICAgIG1lc3NhZ2UuaHlkID0gdGhpcy5oeWQ7XG4gICAgICB0aGlzLmh5ZCA9IG51bGw7XG4gICAgfVxuICAgIGlmICh0dXJuID09PSAtMSkge1xuICAgICAgdGhpcy50aHJlYWQucHVzaChbbWVzc2FnZV0pO1xuICAgIH1lbHNle1xuICAgICAgLy8gb3RoZXJ3aXNlIGFkZCB0byBzcGVjaWZpZWQgdHVyblxuICAgICAgdGhpcy50aHJlYWRbdHVybl0ucHVzaChtZXNzYWdlKTtcbiAgICB9XG4gIH1cbiAgcmVzZXRfY29udGV4dCgpe1xuICAgIHRoaXMuY29udGV4dCA9IG51bGw7XG4gICAgdGhpcy5oeWQgPSBudWxsO1xuICB9XG4gIGFzeW5jIHJlbmFtZV9jaGF0KG5ld19uYW1lKXtcbiAgICAvLyBjaGVjayBpZiBjdXJyZW50IGNoYXRfaWQgZmlsZSBleGlzdHNcbiAgICBpZiAodGhpcy5jaGF0X2lkICYmIGF3YWl0IHRoaXMuYXBwLnZhdWx0LmFkYXB0ZXIuZXhpc3RzKFwiLnNtYXJ0LWNvbm5lY3Rpb25zL2NoYXRzL1wiICsgdGhpcy5jaGF0X2lkICsgXCIuanNvblwiKSkge1xuICAgICAgbmV3X25hbWUgPSB0aGlzLmNoYXRfaWQucmVwbGFjZSh0aGlzLm5hbWUoKSwgbmV3X25hbWUpO1xuICAgICAgLy8gcmVuYW1lIGZpbGUgaWYgaXQgZXhpc3RzXG4gICAgICBhd2FpdCB0aGlzLmFwcC52YXVsdC5hZGFwdGVyLnJlbmFtZShcbiAgICAgICAgXCIuc21hcnQtY29ubmVjdGlvbnMvY2hhdHMvXCIgKyB0aGlzLmNoYXRfaWQgKyBcIi5qc29uXCIsXG4gICAgICAgIFwiLnNtYXJ0LWNvbm5lY3Rpb25zL2NoYXRzL1wiICsgbmV3X25hbWUgKyBcIi5qc29uXCJcbiAgICAgICk7XG4gICAgICAvLyBzZXQgY2hhdF9pZCB0byBuZXdfbmFtZVxuICAgICAgdGhpcy5jaGF0X2lkID0gbmV3X25hbWU7XG4gICAgfWVsc2V7XG4gICAgICB0aGlzLmNoYXRfaWQgPSBuZXdfbmFtZSArIFwiXHUyMDE0XCIgKyB0aGlzLmdldF9maWxlX2RhdGVfc3RyaW5nKCk7XG4gICAgICAvLyBzYXZlIGNoYXRcbiAgICAgIGF3YWl0IHRoaXMuc2F2ZV9jaGF0KCk7XG4gICAgfVxuXG4gIH1cblxuICBuYW1lKCkge1xuICAgIGlmKHRoaXMuY2hhdF9pZCl7XG4gICAgICAvLyByZW1vdmUgZGF0ZSBhZnRlciBsYXN0IGVtIGRhc2hcbiAgICAgIHJldHVybiB0aGlzLmNoYXRfaWQucmVwbGFjZSgvXHUyMDE0W15cdTIwMTRdKiQvLFwiXCIpO1xuICAgIH1cbiAgICByZXR1cm4gXCJVTlRJVExFRFwiO1xuICB9XG5cbiAgZ2V0X2ZpbGVfZGF0ZV9zdHJpbmcoKSB7XG4gICAgcmV0dXJuIG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKS5yZXBsYWNlKC8oVHw6fFxcLi4qKS9nLCBcIiBcIikudHJpbSgpO1xuICB9XG4gIC8vIGdldCByZXNwb25zZSBmcm9tIHdpdGggbm90ZSBjb250ZXh0XG4gIGFzeW5jIGdldF9yZXNwb25zZV93aXRoX25vdGVfY29udGV4dCh1c2VyX2lucHV0LCBjaGF0X3ZpZXcpIHtcbiAgICBsZXQgc3lzdGVtX2lucHV0ID0gXCJJbWFnaW5lIHRoZSBmb2xsb3dpbmcgbm90ZXMgd2VyZSB3cml0dGVuIGJ5IHRoZSB1c2VyIGFuZCBjb250YWluIHRoZSBuZWNlc3NhcnkgaW5mb3JtYXRpb24gdG8gc3ludGhlc2l6ZSBhIHVzZWZ1bCBhbnN3ZXIgdGhlIHVzZXIncyBxdWVyeTpcXG5cIjtcbiAgICAvLyBleHRyYWN0IGludGVybmFsIGxpbmtzXG4gICAgY29uc3Qgbm90ZXMgPSB0aGlzLmV4dHJhY3RfaW50ZXJuYWxfbGlua3ModXNlcl9pbnB1dCk7XG4gICAgLy8gZ2V0IGNvbnRlbnQgb2YgaW50ZXJuYWwgbGlua3MgYXMgY29udGV4dFxuICAgIGxldCBtYXhfY2hhcnMgPSBnZXRfbWF4X2NoYXJzKHRoaXMucGx1Z2luLnNldHRpbmdzLnNtYXJ0X2NoYXRfbW9kZWwpO1xuICAgIGZvcihsZXQgaSA9IDA7IGkgPCBub3Rlcy5sZW5ndGg7IGkrKyl7XG4gICAgICAvLyBtYXggY2hhcnMgZm9yIHRoaXMgbm90ZSBpcyBtYXhfY2hhcnMgZGl2aWRlZCBieSBudW1iZXIgb2Ygbm90ZXMgbGVmdFxuICAgICAgY29uc3QgdGhpc19tYXhfY2hhcnMgPSAobm90ZXMubGVuZ3RoIC0gaSA+IDEpID8gTWF0aC5mbG9vcihtYXhfY2hhcnMgLyAobm90ZXMubGVuZ3RoIC0gaSkpIDogbWF4X2NoYXJzO1xuICAgICAgY29uc3Qgbm90ZV9jb250ZW50ID0gYXdhaXQgdGhpcy5nZXRfbm90ZV9jb250ZW50cyhub3Rlc1tpXSwge2NoYXJfbGltaXQ6IHRoaXNfbWF4X2NoYXJzfSk7XG4gICAgICBzeXN0ZW1faW5wdXQgKz0gYC0tLUJFR0lOIE5PVEU6IFtbJHtub3Rlc1tpXS5iYXNlbmFtZX1dXS0tLVxcbmBcbiAgICAgIHN5c3RlbV9pbnB1dCArPSBub3RlX2NvbnRlbnQ7XG4gICAgICBzeXN0ZW1faW5wdXQgKz0gYC0tLUVORCBOT1RFLS0tXFxuYFxuICAgICAgbWF4X2NoYXJzIC09IG5vdGVfY29udGVudC5sZW5ndGg7XG4gICAgICBpZihtYXhfY2hhcnMgPD0gMCkgYnJlYWs7XG4gICAgfVxuICAgIHRoaXMuY29udGV4dCA9IHN5c3RlbV9pbnB1dDtcbiAgICBjb25zdCBjaGF0bWwgPSBbXG4gICAgICB7XG4gICAgICAgIHJvbGU6IFwic3lzdGVtXCIsXG4gICAgICAgIGNvbnRlbnQ6IHN5c3RlbV9pbnB1dFxuICAgICAgfSxcbiAgICAgIHtcbiAgICAgICAgcm9sZTogXCJ1c2VyXCIsXG4gICAgICAgIGNvbnRlbnQ6IHVzZXJfaW5wdXRcbiAgICAgIH1cbiAgICBdO1xuICAgIGNoYXRfdmlldy5yZXF1ZXN0X2NoYXRncHRfY29tcGxldGlvbih7bWVzc2FnZXM6IGNoYXRtbCwgdGVtcGVyYXR1cmU6IDB9KTtcbiAgfVxuICAvLyBjaGVjayBpZiBjb250YWlucyBpbnRlcm5hbCBsaW5rXG4gIGNvbnRhaW5zX2ludGVybmFsX2xpbmsodXNlcl9pbnB1dCkge1xuICAgIGlmKHVzZXJfaW5wdXQuaW5kZXhPZihcIltbXCIpID09PSAtMSkgcmV0dXJuIGZhbHNlO1xuICAgIGlmKHVzZXJfaW5wdXQuaW5kZXhPZihcIl1dXCIpID09PSAtMSkgcmV0dXJuIGZhbHNlO1xuICAgIHJldHVybiB0cnVlO1xuICB9XG4gIC8vIGNoZWNrIGlmIGNvbnRhaW5zIGZvbGRlciByZWZlcmVuY2UgKGV4LiAvZm9sZGVyLywgb3IgL2ZvbGRlci9zdWJmb2xkZXIvKVxuICBjb250YWluc19mb2xkZXJfcmVmZXJlbmNlKHVzZXJfaW5wdXQpIHtcbiAgICBpZih1c2VyX2lucHV0LmluZGV4T2YoXCIvXCIpID09PSAtMSkgcmV0dXJuIGZhbHNlO1xuICAgIGlmKHVzZXJfaW5wdXQuaW5kZXhPZihcIi9cIikgPT09IHVzZXJfaW5wdXQubGFzdEluZGV4T2YoXCIvXCIpKSByZXR1cm4gZmFsc2U7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cbiAgLy8gZ2V0IGZvbGRlciByZWZlcmVuY2VzIGZyb20gdXNlciBpbnB1dFxuICBnZXRfZm9sZGVyX3JlZmVyZW5jZXModXNlcl9pbnB1dCkge1xuICAgIC8vIHVzZSB0aGlzLmZvbGRlcnMgdG8gZXh0cmFjdCBmb2xkZXIgcmVmZXJlbmNlcyBieSBsb25nZXN0IGZpcnN0IChleC4gL2ZvbGRlci9zdWJmb2xkZXIvIGJlZm9yZSAvZm9sZGVyLykgdG8gYXZvaWQgbWF0Y2hpbmcgL2ZvbGRlci9zdWJmb2xkZXIvIGFzIC9mb2xkZXIvXG4gICAgY29uc3QgZm9sZGVycyA9IHRoaXMucGx1Z2luLmZvbGRlcnMuc2xpY2UoKTsgLy8gY29weSBmb2xkZXJzIGFycmF5XG4gICAgY29uc3QgbWF0Y2hlcyA9IGZvbGRlcnMuc29ydCgoYSwgYikgPT4gYi5sZW5ndGggLSBhLmxlbmd0aCkubWFwKGZvbGRlciA9PiB7XG4gICAgICAvLyBjaGVjayBpZiBmb2xkZXIgaXMgaW4gdXNlcl9pbnB1dFxuICAgICAgaWYodXNlcl9pbnB1dC5pbmRleE9mKGZvbGRlcikgIT09IC0xKXtcbiAgICAgICAgLy8gcmVtb3ZlIGZvbGRlciBmcm9tIHVzZXJfaW5wdXQgdG8gcHJldmVudCBtYXRjaGluZyAvZm9sZGVyL3N1YmZvbGRlci8gYXMgL2ZvbGRlci9cbiAgICAgICAgdXNlcl9pbnB1dCA9IHVzZXJfaW5wdXQucmVwbGFjZShmb2xkZXIsIFwiXCIpO1xuICAgICAgICByZXR1cm4gZm9sZGVyO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH0pLmZpbHRlcihmb2xkZXIgPT4gZm9sZGVyKTtcbiAgICBjb25zb2xlLmxvZyhtYXRjaGVzKTtcbiAgICAvLyByZXR1cm4gYXJyYXkgb2YgbWF0Y2hlc1xuICAgIGlmKG1hdGNoZXMpIHJldHVybiBtYXRjaGVzO1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG5cbiAgLy8gZXh0cmFjdCBpbnRlcm5hbCBsaW5rc1xuICBleHRyYWN0X2ludGVybmFsX2xpbmtzKHVzZXJfaW5wdXQpIHtcbiAgICBjb25zdCBtYXRjaGVzID0gdXNlcl9pbnB1dC5tYXRjaCgvXFxbXFxbKC4qPylcXF1cXF0vZyk7XG4gICAgY29uc29sZS5sb2cobWF0Y2hlcyk7XG4gICAgLy8gcmV0dXJuIGFycmF5IG9mIFRGaWxlIG9iamVjdHNcbiAgICBpZihtYXRjaGVzKSByZXR1cm4gbWF0Y2hlcy5tYXAobWF0Y2ggPT4ge1xuICAgICAgcmV0dXJuIHRoaXMuYXBwLm1ldGFkYXRhQ2FjaGUuZ2V0Rmlyc3RMaW5rcGF0aERlc3QobWF0Y2gucmVwbGFjZShcIltbXCIsIFwiXCIpLnJlcGxhY2UoXCJdXVwiLCBcIlwiKSwgXCIvXCIpO1xuICAgIH0pO1xuICAgIHJldHVybiBbXTtcbiAgfVxuICAvLyBnZXQgY29udGV4dCBmcm9tIGludGVybmFsIGxpbmtzXG4gIGFzeW5jIGdldF9ub3RlX2NvbnRlbnRzKG5vdGUsIG9wdHM9e30pIHtcbiAgICBvcHRzID0ge1xuICAgICAgY2hhcl9saW1pdDogMTAwMDAsXG4gICAgICAuLi5vcHRzXG4gICAgfVxuICAgIC8vIHJldHVybiBpZiBub3RlIGlzIG5vdCBhIGZpbGVcbiAgICBpZighKG5vdGUgaW5zdGFuY2VvZiBPYnNpZGlhbi5URmlsZSkpIHJldHVybiBcIlwiO1xuICAgIC8vIGdldCBmaWxlIGNvbnRlbnRcbiAgICBsZXQgZmlsZV9jb250ZW50ID0gYXdhaXQgdGhpcy5hcHAudmF1bHQuY2FjaGVkUmVhZChub3RlKTtcbiAgICAvLyBjaGVjayBpZiBjb250YWlucyBkYXRhdmlldyBjb2RlIGJsb2NrXG4gICAgaWYoZmlsZV9jb250ZW50LmluZGV4T2YoXCJgYGBkYXRhdmlld1wiKSA+IC0xKXtcbiAgICAgIC8vIGlmIGNvbnRhaW5zIGRhdGF2aWV3IGNvZGUgYmxvY2sgZ2V0IGFsbCBkYXRhdmlldyBjb2RlIGJsb2Nrc1xuICAgICAgZmlsZV9jb250ZW50ID0gYXdhaXQgdGhpcy5yZW5kZXJfZGF0YXZpZXdfcXVlcmllcyhmaWxlX2NvbnRlbnQsIG5vdGUucGF0aCwgb3B0cyk7XG4gICAgfVxuICAgIHJldHVybiBmaWxlX2NvbnRlbnQuc3Vic3RyaW5nKDAsIG9wdHMuY2hhcl9saW1pdCk7XG4gIH1cblxuXG4gIGFzeW5jIHJlbmRlcl9kYXRhdmlld19xdWVyaWVzKGZpbGVfY29udGVudCwgbm90ZV9wYXRoLCBvcHRzPXt9KSB7XG4gICAgb3B0cyA9IHtcbiAgICAgIGNoYXJfbGltaXQ6IG51bGwsXG4gICAgICAuLi5vcHRzXG4gICAgfTtcbiAgICAvLyB1c2Ugd2luZG93IHRvIGdldCBkYXRhdmlldyBhcGlcbiAgICBjb25zdCBkYXRhdmlld19hcGkgPSB3aW5kb3dbXCJEYXRhdmlld0FQSVwiXTtcbiAgICAvLyBza2lwIGlmIGRhdGF2aWV3IGFwaSBub3QgZm91bmRcbiAgICBpZighZGF0YXZpZXdfYXBpKSByZXR1cm4gZmlsZV9jb250ZW50O1xuICAgIGNvbnN0IGRhdGF2aWV3X2NvZGVfYmxvY2tzID0gZmlsZV9jb250ZW50Lm1hdGNoKC9gYGBkYXRhdmlldyguKj8pYGBgL2dzKTtcbiAgICAvLyBmb3IgZWFjaCBkYXRhdmlldyBjb2RlIGJsb2NrXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBkYXRhdmlld19jb2RlX2Jsb2Nrcy5sZW5ndGg7IGkrKykge1xuICAgICAgLy8gaWYgb3B0cyBjaGFyX2xpbWl0IGlzIGxlc3MgdGhhbiBpbmRleE9mIGRhdGF2aWV3IGNvZGUgYmxvY2ssIGJyZWFrXG4gICAgICBpZihvcHRzLmNoYXJfbGltaXQgJiYgb3B0cy5jaGFyX2xpbWl0IDwgZmlsZV9jb250ZW50LmluZGV4T2YoZGF0YXZpZXdfY29kZV9ibG9ja3NbaV0pKSBicmVhaztcbiAgICAgIC8vIGdldCBkYXRhdmlldyBjb2RlIGJsb2NrXG4gICAgICBjb25zdCBkYXRhdmlld19jb2RlX2Jsb2NrID0gZGF0YXZpZXdfY29kZV9ibG9ja3NbaV07XG4gICAgICAvLyBnZXQgY29udGVudCBvZiBkYXRhdmlldyBjb2RlIGJsb2NrXG4gICAgICBjb25zdCBkYXRhdmlld19jb2RlX2Jsb2NrX2NvbnRlbnQgPSBkYXRhdmlld19jb2RlX2Jsb2NrLnJlcGxhY2UoXCJgYGBkYXRhdmlld1wiLCBcIlwiKS5yZXBsYWNlKFwiYGBgXCIsIFwiXCIpO1xuICAgICAgLy8gZ2V0IGRhdGF2aWV3IHF1ZXJ5IHJlc3VsdFxuICAgICAgY29uc3QgZGF0YXZpZXdfcXVlcnlfcmVzdWx0ID0gYXdhaXQgZGF0YXZpZXdfYXBpLnF1ZXJ5TWFya2Rvd24oZGF0YXZpZXdfY29kZV9ibG9ja19jb250ZW50LCBub3RlX3BhdGgsIG51bGwpO1xuICAgICAgLy8gaWYgcXVlcnkgcmVzdWx0IGlzIHN1Y2Nlc3NmdWwsIHJlcGxhY2UgZGF0YXZpZXcgY29kZSBibG9jayB3aXRoIHF1ZXJ5IHJlc3VsdFxuICAgICAgaWYgKGRhdGF2aWV3X3F1ZXJ5X3Jlc3VsdC5zdWNjZXNzZnVsKSB7XG4gICAgICAgIGZpbGVfY29udGVudCA9IGZpbGVfY29udGVudC5yZXBsYWNlKGRhdGF2aWV3X2NvZGVfYmxvY2ssIGRhdGF2aWV3X3F1ZXJ5X3Jlc3VsdC52YWx1ZSk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBmaWxlX2NvbnRlbnQ7XG4gIH1cbn1cblxuY2xhc3MgU21hcnRDb25uZWN0aW9uc0NoYXRIaXN0b3J5TW9kYWwgZXh0ZW5kcyBPYnNpZGlhbi5GdXp6eVN1Z2dlc3RNb2RhbCB7XG4gIGNvbnN0cnVjdG9yKGFwcCwgdmlldywgZmlsZXMpIHtcbiAgICBzdXBlcihhcHApO1xuICAgIHRoaXMuYXBwID0gYXBwO1xuICAgIHRoaXMudmlldyA9IHZpZXc7XG4gICAgdGhpcy5zZXRQbGFjZWhvbGRlcihcIlR5cGUgdGhlIG5hbWUgb2YgYSBjaGF0IHNlc3Npb24uLi5cIik7XG4gIH1cbiAgZ2V0SXRlbXMoKSB7XG4gICAgaWYgKCF0aGlzLnZpZXcuZmlsZXMpIHtcbiAgICAgIHJldHVybiBbXTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMudmlldy5maWxlcztcbiAgfVxuICBnZXRJdGVtVGV4dChpdGVtKSB7XG4gICAgLy8gaWYgbm90IFVOVElUTEVELCByZW1vdmUgZGF0ZSBhZnRlciBsYXN0IGVtIGRhc2hcbiAgICBpZihpdGVtLmluZGV4T2YoXCJVTlRJVExFRFwiKSA9PT0gLTEpe1xuICAgICAgaXRlbS5yZXBsYWNlKC9cdTIwMTRbXlx1MjAxNF0qJC8sXCJcIik7XG4gICAgfVxuICAgIHJldHVybiBpdGVtO1xuICB9XG4gIG9uQ2hvb3NlSXRlbShzZXNzaW9uKSB7XG4gICAgdGhpcy52aWV3Lm9wZW5fY2hhdChzZXNzaW9uKTtcbiAgfVxufVxuXG4vLyBGaWxlIFNlbGVjdCBGdXp6eSBTdWdnZXN0IE1vZGFsXG5jbGFzcyBTbWFydENvbm5lY3Rpb25zRmlsZVNlbGVjdE1vZGFsIGV4dGVuZHMgT2JzaWRpYW4uRnV6enlTdWdnZXN0TW9kYWwge1xuICBjb25zdHJ1Y3RvcihhcHAsIHZpZXcpIHtcbiAgICBzdXBlcihhcHApO1xuICAgIHRoaXMuYXBwID0gYXBwO1xuICAgIHRoaXMudmlldyA9IHZpZXc7XG4gICAgdGhpcy5zZXRQbGFjZWhvbGRlcihcIlR5cGUgdGhlIG5hbWUgb2YgYSBmaWxlLi4uXCIpO1xuICB9XG4gIGdldEl0ZW1zKCkge1xuICAgIC8vIGdldCBhbGwgbWFya2Rvd24gZmlsZXNcbiAgICByZXR1cm4gdGhpcy5hcHAudmF1bHQuZ2V0TWFya2Rvd25GaWxlcygpLnNvcnQoKGEsIGIpID0+IGEuYmFzZW5hbWUubG9jYWxlQ29tcGFyZShiLmJhc2VuYW1lKSk7XG4gIH1cbiAgZ2V0SXRlbVRleHQoaXRlbSkge1xuICAgIHJldHVybiBpdGVtLmJhc2VuYW1lO1xuICB9XG4gIG9uQ2hvb3NlSXRlbShmaWxlKSB7XG4gICAgdGhpcy52aWV3Lmluc2VydF9zZWxlY3Rpb24oZmlsZS5iYXNlbmFtZSArIFwiXV0gXCIpO1xuICB9XG59XG4vLyBGb2xkZXIgU2VsZWN0IEZ1enp5IFN1Z2dlc3QgTW9kYWxcbmNsYXNzIFNtYXJ0Q29ubmVjdGlvbnNGb2xkZXJTZWxlY3RNb2RhbCBleHRlbmRzIE9ic2lkaWFuLkZ1enp5U3VnZ2VzdE1vZGFsIHtcbiAgY29uc3RydWN0b3IoYXBwLCB2aWV3KSB7XG4gICAgc3VwZXIoYXBwKTtcbiAgICB0aGlzLmFwcCA9IGFwcDtcbiAgICB0aGlzLnZpZXcgPSB2aWV3O1xuICAgIHRoaXMuc2V0UGxhY2Vob2xkZXIoXCJUeXBlIHRoZSBuYW1lIG9mIGEgZm9sZGVyLi4uXCIpO1xuICB9XG4gIGdldEl0ZW1zKCkge1xuICAgIHJldHVybiB0aGlzLnZpZXcucGx1Z2luLmZvbGRlcnM7XG4gIH1cbiAgZ2V0SXRlbVRleHQoaXRlbSkge1xuICAgIHJldHVybiBpdGVtO1xuICB9XG4gIG9uQ2hvb3NlSXRlbShmb2xkZXIpIHtcbiAgICB0aGlzLnZpZXcuaW5zZXJ0X3NlbGVjdGlvbihmb2xkZXIgKyBcIi8gXCIpO1xuICB9XG59XG5cblxuLy8gSGFuZGxlIEFQSSByZXNwb25zZSBzdHJlYW1pbmdcbmNsYXNzIFNjU3RyZWFtZXIge1xuICAvLyBjb25zdHJ1Y3RvclxuICBjb25zdHJ1Y3Rvcih1cmwsIG9wdGlvbnMpIHtcbiAgICAvLyBzZXQgZGVmYXVsdCBvcHRpb25zXG4gICAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG4gICAgdGhpcy51cmwgPSB1cmw7XG4gICAgdGhpcy5tZXRob2QgPSBvcHRpb25zLm1ldGhvZCB8fCAnR0VUJztcbiAgICB0aGlzLmhlYWRlcnMgPSBvcHRpb25zLmhlYWRlcnMgfHwge307XG4gICAgdGhpcy5wYXlsb2FkID0gb3B0aW9ucy5wYXlsb2FkIHx8IG51bGw7XG4gICAgdGhpcy53aXRoQ3JlZGVudGlhbHMgPSBvcHRpb25zLndpdGhDcmVkZW50aWFscyB8fCBmYWxzZTtcbiAgICB0aGlzLmxpc3RlbmVycyA9IHt9O1xuICAgIHRoaXMucmVhZHlTdGF0ZSA9IHRoaXMuQ09OTkVDVElORztcbiAgICB0aGlzLnByb2dyZXNzID0gMDtcbiAgICB0aGlzLmNodW5rID0gJyc7XG4gICAgdGhpcy54aHIgPSBudWxsO1xuICAgIHRoaXMuRklFTERfU0VQQVJBVE9SID0gJzonO1xuICAgIHRoaXMuSU5JVElBTElaSU5HID0gLTE7XG4gICAgdGhpcy5DT05ORUNUSU5HID0gMDtcbiAgICB0aGlzLk9QRU4gPSAxO1xuICAgIHRoaXMuQ0xPU0VEID0gMjtcbiAgfVxuICAvLyBhZGRFdmVudExpc3RlbmVyXG4gIGFkZEV2ZW50TGlzdGVuZXIodHlwZSwgbGlzdGVuZXIpIHtcbiAgICAvLyBjaGVjayBpZiB0aGUgdHlwZSBpcyBpbiB0aGUgbGlzdGVuZXJzXG4gICAgaWYgKCF0aGlzLmxpc3RlbmVyc1t0eXBlXSkge1xuICAgICAgdGhpcy5saXN0ZW5lcnNbdHlwZV0gPSBbXTtcbiAgICB9XG4gICAgLy8gY2hlY2sgaWYgdGhlIGxpc3RlbmVyIGlzIGFscmVhZHkgaW4gdGhlIGxpc3RlbmVyc1xuICAgIGlmKHRoaXMubGlzdGVuZXJzW3R5cGVdLmluZGV4T2YobGlzdGVuZXIpID09PSAtMSkge1xuICAgICAgdGhpcy5saXN0ZW5lcnNbdHlwZV0ucHVzaChsaXN0ZW5lcik7XG4gICAgfVxuICB9XG4gIC8vIHJlbW92ZUV2ZW50TGlzdGVuZXJcbiAgcmVtb3ZlRXZlbnRMaXN0ZW5lcih0eXBlLCBsaXN0ZW5lcikge1xuICAgIC8vIGNoZWNrIGlmIGxpc3RlbmVyIHR5cGUgaXMgdW5kZWZpbmVkXG4gICAgaWYgKCF0aGlzLmxpc3RlbmVyc1t0eXBlXSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBsZXQgZmlsdGVyZWQgPSBbXTtcbiAgICAvLyBsb29wIHRocm91Z2ggdGhlIGxpc3RlbmVyc1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5saXN0ZW5lcnNbdHlwZV0ubGVuZ3RoOyBpKyspIHtcbiAgICAgIC8vIGNoZWNrIGlmIHRoZSBsaXN0ZW5lciBpcyB0aGUgc2FtZVxuICAgICAgaWYgKHRoaXMubGlzdGVuZXJzW3R5cGVdW2ldICE9PSBsaXN0ZW5lcikge1xuICAgICAgICBmaWx0ZXJlZC5wdXNoKHRoaXMubGlzdGVuZXJzW3R5cGVdW2ldKTtcbiAgICAgIH1cbiAgICB9XG4gICAgLy8gY2hlY2sgaWYgdGhlIGxpc3RlbmVycyBhcmUgZW1wdHlcbiAgICBpZiAodGhpcy5saXN0ZW5lcnNbdHlwZV0ubGVuZ3RoID09PSAwKSB7XG4gICAgICBkZWxldGUgdGhpcy5saXN0ZW5lcnNbdHlwZV07XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMubGlzdGVuZXJzW3R5cGVdID0gZmlsdGVyZWQ7XG4gICAgfVxuICB9XG4gIC8vIGRpc3BhdGNoRXZlbnRcbiAgZGlzcGF0Y2hFdmVudChldmVudCkge1xuICAgIC8vIGlmIG5vIGV2ZW50IHJldHVybiB0cnVlXG4gICAgaWYgKCFldmVudCkge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIC8vIHNldCBldmVudCBzb3VyY2UgdG8gdGhpc1xuICAgIGV2ZW50LnNvdXJjZSA9IHRoaXM7XG4gICAgLy8gc2V0IG9uSGFuZGxlciB0byBvbiArIGV2ZW50IHR5cGVcbiAgICBsZXQgb25IYW5kbGVyID0gJ29uJyArIGV2ZW50LnR5cGU7XG4gICAgLy8gY2hlY2sgaWYgdGhlIG9uSGFuZGxlciBoYXMgb3duIHByb3BlcnR5IG5hbWVkIHNhbWUgYXMgb25IYW5kbGVyXG4gICAgaWYgKHRoaXMuaGFzT3duUHJvcGVydHkob25IYW5kbGVyKSkge1xuICAgICAgLy8gY2FsbCB0aGUgb25IYW5kbGVyXG4gICAgICB0aGlzW29uSGFuZGxlcl0uY2FsbCh0aGlzLCBldmVudCk7XG4gICAgICAvLyBjaGVjayBpZiB0aGUgZXZlbnQgaXMgZGVmYXVsdCBwcmV2ZW50ZWRcbiAgICAgIGlmIChldmVudC5kZWZhdWx0UHJldmVudGVkKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICB9XG4gICAgLy8gY2hlY2sgaWYgdGhlIGV2ZW50IHR5cGUgaXMgaW4gdGhlIGxpc3RlbmVyc1xuICAgIGlmICh0aGlzLmxpc3RlbmVyc1tldmVudC50eXBlXSkge1xuICAgICAgcmV0dXJuIHRoaXMubGlzdGVuZXJzW2V2ZW50LnR5cGVdLmV2ZXJ5KGZ1bmN0aW9uKGNhbGxiYWNrKSB7XG4gICAgICAgIGNhbGxiYWNrKGV2ZW50KTtcbiAgICAgICAgcmV0dXJuICFldmVudC5kZWZhdWx0UHJldmVudGVkO1xuICAgICAgfSk7XG4gICAgfVxuICAgIHJldHVybiB0cnVlO1xuICB9XG4gIC8vIF9zZXRSZWFkeVN0YXRlXG4gIF9zZXRSZWFkeVN0YXRlKHN0YXRlKSB7XG4gICAgLy8gc2V0IGV2ZW50IHR5cGUgdG8gcmVhZHlTdGF0ZUNoYW5nZVxuICAgIGxldCBldmVudCA9IG5ldyBDdXN0b21FdmVudCgncmVhZHlTdGF0ZUNoYW5nZScpO1xuICAgIC8vIHNldCBldmVudCByZWFkeVN0YXRlIHRvIHN0YXRlXG4gICAgZXZlbnQucmVhZHlTdGF0ZSA9IHN0YXRlO1xuICAgIC8vIHNldCByZWFkeVN0YXRlIHRvIHN0YXRlXG4gICAgdGhpcy5yZWFkeVN0YXRlID0gc3RhdGU7XG4gICAgLy8gZGlzcGF0Y2ggZXZlbnRcbiAgICB0aGlzLmRpc3BhdGNoRXZlbnQoZXZlbnQpO1xuICB9XG4gIC8vIF9vblN0cmVhbUZhaWx1cmVcbiAgX29uU3RyZWFtRmFpbHVyZShlKSB7XG4gICAgLy8gc2V0IGV2ZW50IHR5cGUgdG8gZXJyb3JcbiAgICBsZXQgZXZlbnQgPSBuZXcgQ3VzdG9tRXZlbnQoJ2Vycm9yJyk7XG4gICAgLy8gc2V0IGV2ZW50IGRhdGEgdG8gZVxuICAgIGV2ZW50LmRhdGEgPSBlLmN1cnJlbnRUYXJnZXQucmVzcG9uc2U7XG4gICAgLy8gZGlzcGF0Y2ggZXZlbnRcbiAgICB0aGlzLmRpc3BhdGNoRXZlbnQoZXZlbnQpO1xuICAgIHRoaXMuY2xvc2UoKTtcbiAgfVxuICAvLyBfb25TdHJlYW1BYm9ydFxuICBfb25TdHJlYW1BYm9ydChlKSB7XG4gICAgLy8gc2V0IHRvIGFib3J0XG4gICAgbGV0IGV2ZW50ID0gbmV3IEN1c3RvbUV2ZW50KCdhYm9ydCcpO1xuICAgIC8vIGNsb3NlXG4gICAgdGhpcy5jbG9zZSgpO1xuICB9XG4gIC8vIF9vblN0cmVhbVByb2dyZXNzXG4gIF9vblN0cmVhbVByb2dyZXNzKGUpIHtcbiAgICAvLyBpZiBub3QgeGhyIHJldHVyblxuICAgIGlmICghdGhpcy54aHIpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgLy8gaWYgeGhyIHN0YXR1cyBpcyBub3QgMjAwIHJldHVyblxuICAgIGlmICh0aGlzLnhoci5zdGF0dXMgIT09IDIwMCkge1xuICAgICAgLy8gb25TdHJlYW1GYWlsdXJlXG4gICAgICB0aGlzLl9vblN0cmVhbUZhaWx1cmUoZSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIC8vIGlmIHJlYWR5IHN0YXRlIGlzIENPTk5FQ1RJTkdcbiAgICBpZiAodGhpcy5yZWFkeVN0YXRlID09PSB0aGlzLkNPTk5FQ1RJTkcpIHtcbiAgICAgIC8vIGRpc3BhdGNoIGV2ZW50XG4gICAgICB0aGlzLmRpc3BhdGNoRXZlbnQobmV3IEN1c3RvbUV2ZW50KCdvcGVuJykpO1xuICAgICAgLy8gc2V0IHJlYWR5IHN0YXRlIHRvIE9QRU5cbiAgICAgIHRoaXMuX3NldFJlYWR5U3RhdGUodGhpcy5PUEVOKTtcbiAgICB9XG4gICAgLy8gcGFyc2UgdGhlIHJlY2VpdmVkIGRhdGEuXG4gICAgbGV0IGRhdGEgPSB0aGlzLnhoci5yZXNwb25zZVRleHQuc3Vic3RyaW5nKHRoaXMucHJvZ3Jlc3MpO1xuICAgIC8vIHVwZGF0ZSBwcm9ncmVzc1xuICAgIHRoaXMucHJvZ3Jlc3MgKz0gZGF0YS5sZW5ndGg7XG4gICAgLy8gc3BsaXQgdGhlIGRhdGEgYnkgbmV3IGxpbmUgYW5kIHBhcnNlIGVhY2ggbGluZVxuICAgIGRhdGEuc3BsaXQoLyhcXHJcXG58XFxyfFxcbil7Mn0vZykuZm9yRWFjaChmdW5jdGlvbihwYXJ0KXtcbiAgICAgIGlmKHBhcnQudHJpbSgpLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICB0aGlzLmRpc3BhdGNoRXZlbnQodGhpcy5fcGFyc2VFdmVudENodW5rKHRoaXMuY2h1bmsudHJpbSgpKSk7XG4gICAgICAgIHRoaXMuY2h1bmsgPSAnJztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuY2h1bmsgKz0gcGFydDtcbiAgICAgIH1cbiAgICB9LmJpbmQodGhpcykpO1xuICB9XG4gIC8vIF9vblN0cmVhbUxvYWRlZFxuICBfb25TdHJlYW1Mb2FkZWQoZSkge1xuICAgIHRoaXMuX29uU3RyZWFtUHJvZ3Jlc3MoZSk7XG4gICAgLy8gcGFyc2UgdGhlIGxhc3QgY2h1bmtcbiAgICB0aGlzLmRpc3BhdGNoRXZlbnQodGhpcy5fcGFyc2VFdmVudENodW5rKHRoaXMuY2h1bmspKTtcbiAgICB0aGlzLmNodW5rID0gJyc7XG4gIH1cbiAgLy8gX3BhcnNlRXZlbnRDaHVua1xuICBfcGFyc2VFdmVudENodW5rKGNodW5rKSB7XG4gICAgLy8gaWYgbm8gY2h1bmsgb3IgY2h1bmsgaXMgZW1wdHkgcmV0dXJuXG4gICAgaWYgKCFjaHVuayB8fCBjaHVuay5sZW5ndGggPT09IDApIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICAvLyBpbml0IGVcbiAgICBsZXQgZSA9IHtpZDogbnVsbCwgcmV0cnk6IG51bGwsIGRhdGE6ICcnLCBldmVudDogJ21lc3NhZ2UnfTtcbiAgICAvLyBzcGxpdCB0aGUgY2h1bmsgYnkgbmV3IGxpbmVcbiAgICBjaHVuay5zcGxpdCgvKFxcclxcbnxcXHJ8XFxuKS8pLmZvckVhY2goZnVuY3Rpb24obGluZSkge1xuICAgICAgbGluZSA9IGxpbmUudHJpbVJpZ2h0KCk7XG4gICAgICBsZXQgaW5kZXggPSBsaW5lLmluZGV4T2YodGhpcy5GSUVMRF9TRVBBUkFUT1IpO1xuICAgICAgaWYoaW5kZXggPD0gMCkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICAvLyBmaWVsZFxuICAgICAgbGV0IGZpZWxkID0gbGluZS5zdWJzdHJpbmcoMCwgaW5kZXgpO1xuICAgICAgaWYoIShmaWVsZCBpbiBlKSkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICAvLyB2YWx1ZVxuICAgICAgbGV0IHZhbHVlID0gbGluZS5zdWJzdHJpbmcoaW5kZXggKyAxKS50cmltTGVmdCgpO1xuICAgICAgaWYoZmllbGQgPT09ICdkYXRhJykge1xuICAgICAgICBlW2ZpZWxkXSArPSB2YWx1ZTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGVbZmllbGRdID0gdmFsdWU7XG4gICAgICB9XG4gICAgfS5iaW5kKHRoaXMpKTtcbiAgICAvLyByZXR1cm4gZXZlbnRcbiAgICBsZXQgZXZlbnQgPSBuZXcgQ3VzdG9tRXZlbnQoZS5ldmVudCk7XG4gICAgZXZlbnQuZGF0YSA9IGUuZGF0YTtcbiAgICBldmVudC5pZCA9IGUuaWQ7XG4gICAgcmV0dXJuIGV2ZW50O1xuICB9XG4gIC8vIF9jaGVja1N0cmVhbUNsb3NlZFxuICBfY2hlY2tTdHJlYW1DbG9zZWQoKSB7XG4gICAgaWYoIXRoaXMueGhyKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGlmKHRoaXMueGhyLnJlYWR5U3RhdGUgPT09IFhNTEh0dHBSZXF1ZXN0LkRPTkUpIHtcbiAgICAgIHRoaXMuX3NldFJlYWR5U3RhdGUodGhpcy5DTE9TRUQpO1xuICAgIH1cbiAgfVxuICAvLyBzdHJlYW1cbiAgc3RyZWFtKCkge1xuICAgIC8vIHNldCByZWFkeSBzdGF0ZSB0byBjb25uZWN0aW5nXG4gICAgdGhpcy5fc2V0UmVhZHlTdGF0ZSh0aGlzLkNPTk5FQ1RJTkcpO1xuICAgIC8vIHNldCB4aHIgdG8gbmV3IFhNTEh0dHBSZXF1ZXN0XG4gICAgdGhpcy54aHIgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcbiAgICAvLyBzZXQgeGhyIHByb2dyZXNzIHRvIF9vblN0cmVhbVByb2dyZXNzXG4gICAgdGhpcy54aHIuYWRkRXZlbnRMaXN0ZW5lcigncHJvZ3Jlc3MnLCB0aGlzLl9vblN0cmVhbVByb2dyZXNzLmJpbmQodGhpcykpO1xuICAgIC8vIHNldCB4aHIgbG9hZCB0byBfb25TdHJlYW1Mb2FkZWRcbiAgICB0aGlzLnhoci5hZGRFdmVudExpc3RlbmVyKCdsb2FkJywgdGhpcy5fb25TdHJlYW1Mb2FkZWQuYmluZCh0aGlzKSk7XG4gICAgLy8gc2V0IHhociByZWFkeSBzdGF0ZSBjaGFuZ2UgdG8gX2NoZWNrU3RyZWFtQ2xvc2VkXG4gICAgdGhpcy54aHIuYWRkRXZlbnRMaXN0ZW5lcigncmVhZHlzdGF0ZWNoYW5nZScsIHRoaXMuX2NoZWNrU3RyZWFtQ2xvc2VkLmJpbmQodGhpcykpO1xuICAgIC8vIHNldCB4aHIgZXJyb3IgdG8gX29uU3RyZWFtRmFpbHVyZVxuICAgIHRoaXMueGhyLmFkZEV2ZW50TGlzdGVuZXIoJ2Vycm9yJywgdGhpcy5fb25TdHJlYW1GYWlsdXJlLmJpbmQodGhpcykpO1xuICAgIC8vIHNldCB4aHIgYWJvcnQgdG8gX29uU3RyZWFtQWJvcnRcbiAgICB0aGlzLnhoci5hZGRFdmVudExpc3RlbmVyKCdhYm9ydCcsIHRoaXMuX29uU3RyZWFtQWJvcnQuYmluZCh0aGlzKSk7XG4gICAgLy8gb3BlbiB4aHJcbiAgICB0aGlzLnhoci5vcGVuKHRoaXMubWV0aG9kLCB0aGlzLnVybCk7XG4gICAgLy8gaGVhZGVycyB0byB4aHJcbiAgICBmb3IgKGxldCBoZWFkZXIgaW4gdGhpcy5oZWFkZXJzKSB7XG4gICAgICB0aGlzLnhoci5zZXRSZXF1ZXN0SGVhZGVyKGhlYWRlciwgdGhpcy5oZWFkZXJzW2hlYWRlcl0pO1xuICAgIH1cbiAgICAvLyBjcmVkZW50aWFscyB0byB4aHJcbiAgICB0aGlzLnhoci53aXRoQ3JlZGVudGlhbHMgPSB0aGlzLndpdGhDcmVkZW50aWFscztcbiAgICAvLyBzZW5kIHhoclxuICAgIHRoaXMueGhyLnNlbmQodGhpcy5wYXlsb2FkKTtcbiAgfVxuICAvLyBjbG9zZVxuICBjbG9zZSgpIHtcbiAgICBpZih0aGlzLnJlYWR5U3RhdGUgPT09IHRoaXMuQ0xPU0VEKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIHRoaXMueGhyLmFib3J0KCk7XG4gICAgdGhpcy54aHIgPSBudWxsO1xuICAgIHRoaXMuX3NldFJlYWR5U3RhdGUodGhpcy5DTE9TRUQpO1xuICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gU21hcnRDb25uZWN0aW9uc1BsdWdpbjsiXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7QUFBQTtBQUFBLDRCQUFBQSxVQUFBQyxTQUFBO0FBQUEsUUFBTUMsV0FBTixNQUFjO0FBQUEsTUFDWixZQUFZLFFBQVE7QUFFbEIsYUFBSyxTQUFTO0FBQUEsVUFDWixXQUFXO0FBQUEsVUFDWCxhQUFhO0FBQUEsVUFDYixnQkFBZ0I7QUFBQSxVQUNoQixlQUFlO0FBQUEsVUFDZixjQUFjO0FBQUEsVUFDZCxnQkFBZ0I7QUFBQSxVQUNoQixjQUFjO0FBQUEsVUFDZCxlQUFlO0FBQUEsVUFDZixHQUFHO0FBQUEsUUFDTDtBQUNBLGFBQUssWUFBWSxLQUFLLE9BQU87QUFDN0IsYUFBSyxjQUFjLE9B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
