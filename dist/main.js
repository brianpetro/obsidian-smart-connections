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
      this.settings.best_new_plugin = false;
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
  async update_to_v2() {
    if (!this.settings.license_key)
      return new Obsidian.Notice("[Smart Connections] Supporter license key required for early access to V2");
    const v2 = await (0, Obsidian.requestUrl)({
      url: "https://sync.smartconnections.app/download_v2",
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        license_key: this.settings.license_key
      })
    });
    if (v2.status !== 200)
      return console.error("Error downloading version 2", v2);
    console.log(v2);
    await this.app.vault.adapter.write(".obsidian/plugins/smart-connections/main.js", v2.json.main);
    await this.app.vault.adapter.write(".obsidian/plugins/smart-connections/manifest.json", v2.json.manifest);
    await this.app.vault.adapter.write(".obsidian/plugins/smart-connections/styles.css", v2.json.styles);
    window.restart_plugin = async (id) => {
      console.log("restarting plugin", id);
      await window.app.plugins.disablePlugin(id);
      await window.app.plugins.enablePlugin(id);
      console.log("plugin restarted", id);
    };
    window.restart_plugin(this.manifest.id);
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
    containerEl.createEl("h2", { text: "Supporter Features" });
    containerEl.createEl("p", {
      text: 'As a Smart Connections "Supporter", fast-track your PKM journey with priority perks and pioneering innovations.'
    });
    const supporter_benefits_list = containerEl.createEl("ul");
    supporter_benefits_list.createEl("li", { text: "Enjoy swift, top-priority support by replying to your supporter license key email." });
    supporter_benefits_list.createEl("li", { text: "Gain early access new versions (v2.0 available now)." });
    const gpt_li = supporter_benefits_list.createEl("li");
    gpt_li.innerHTML = 'Access experimental features like the <a href="https://chat.openai.com/g/g-SlDDp07bm-smart-connections-for-obsidian" target="_blank">Smart Connections GPT</a> ChatGPT integration.';
    supporter_benefits_list.createEl("li", { text: "Stay informed and engaged with exclusive supporter-only communications." });
    new Obsidian.Setting(containerEl).setName("Upgrade to Version 2.0.").setDesc("No more sending all of your notes to OpenAI for embedding! Includes a local embedding model for increased privacy.").addButton((button) => button.setButtonText("Upgrade to v2.0").onClick(async () => {
      await this.plugin.update_to_v2();
    }));
    new Obsidian.Setting(containerEl).setName("Sync for ChatGPT").setDesc("Make notes available via the Smart Connections GPT and ChatGPT Plugin. Respects exclusion settings configured below.").addButton((button) => button.setButtonText("Sync for ChatGPT").onClick(async () => {
      await this.plugin.sync_notes();
    }));
    new Obsidian.Setting(containerEl).setName("Supporter License Key").setDesc("Note: this is not required to use Smart Connections.").addText((text) => text.setPlaceholder("Enter your license_key").setValue(this.plugin.settings.license_key).onChange(async (value) => {
      this.plugin.settings.license_key = value.trim();
      await this.plugin.saveSettings(true);
    }));
    new Obsidian.Setting(containerEl).setName("Support Smart Connections").setDesc("Become a supporter to support the development of Smart Connections.").addButton((button) => button.setButtonText("Become a Supporter").onClick(async () => {
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vdmVjX2xpdGUvdmVjX2xpdGUuanMiLCAiLi4vc3JjL2luZGV4LmpzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJjbGFzcyBWZWNMaXRlIHtcbiAgY29uc3RydWN0b3IoY29uZmlnKSB7XG4gICAgLy8gc2V0IGRlZmF1bHQgY29uZmlnXG4gICAgdGhpcy5jb25maWcgPSB7XG4gICAgICBmaWxlX25hbWU6IFwiZW1iZWRkaW5ncy0zLmpzb25cIixcbiAgICAgIGZvbGRlcl9wYXRoOiBcIi52ZWNfbGl0ZVwiLFxuICAgICAgZXhpc3RzX2FkYXB0ZXI6IG51bGwsXG4gICAgICBta2Rpcl9hZGFwdGVyOiBudWxsLFxuICAgICAgcmVhZF9hZGFwdGVyOiBudWxsLFxuICAgICAgcmVuYW1lX2FkYXB0ZXI6IG51bGwsXG4gICAgICBzdGF0X2FkYXB0ZXI6IG51bGwsXG4gICAgICB3cml0ZV9hZGFwdGVyOiBudWxsLFxuICAgICAgLi4uY29uZmlnXG4gICAgfTtcbiAgICB0aGlzLmZpbGVfbmFtZSA9IHRoaXMuY29uZmlnLmZpbGVfbmFtZTtcbiAgICB0aGlzLmZvbGRlcl9wYXRoID0gY29uZmlnLmZvbGRlcl9wYXRoO1xuICAgIHRoaXMuZmlsZV9wYXRoID0gdGhpcy5mb2xkZXJfcGF0aCArIFwiL1wiICsgdGhpcy5maWxlX25hbWU7XG4gICAgLy8gZ2V0IGZvbGRlciBwYXRoXG4gICAgdGhpcy5lbWJlZGRpbmdzID0gZmFsc2U7XG4gIH1cbiAgYXN5bmMgZmlsZV9leGlzdHMocGF0aCkge1xuICAgIGlmICh0aGlzLmNvbmZpZy5leGlzdHNfYWRhcHRlcikge1xuICAgICAgcmV0dXJuIGF3YWl0IHRoaXMuY29uZmlnLmV4aXN0c19hZGFwdGVyKHBhdGgpO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyB0b2RvIGhhbmRsZSB3aXRoIGZzXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJleGlzdHNfYWRhcHRlciBub3Qgc2V0XCIpO1xuICAgIH1cbiAgfVxuICBhc3luYyBta2RpcihwYXRoKSB7XG4gICAgaWYgKHRoaXMuY29uZmlnLm1rZGlyX2FkYXB0ZXIpIHtcbiAgICAgIHJldHVybiBhd2FpdCB0aGlzLmNvbmZpZy5ta2Rpcl9hZGFwdGVyKHBhdGgpO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyB0b2RvIGhhbmRsZSB3aXRoIGZzXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJta2Rpcl9hZGFwdGVyIG5vdCBzZXRcIik7XG4gICAgfVxuICB9XG4gIGFzeW5jIHJlYWRfZmlsZShwYXRoKSB7XG4gICAgaWYgKHRoaXMuY29uZmlnLnJlYWRfYWRhcHRlcikge1xuICAgICAgcmV0dXJuIGF3YWl0IHRoaXMuY29uZmlnLnJlYWRfYWRhcHRlcihwYXRoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gdG9kbyBoYW5kbGUgd2l0aCBmc1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFwicmVhZF9hZGFwdGVyIG5vdCBzZXRcIik7XG4gICAgfVxuICB9XG4gIGFzeW5jIHJlbmFtZShvbGRfcGF0aCwgbmV3X3BhdGgpIHtcbiAgICBpZiAodGhpcy5jb25maWcucmVuYW1lX2FkYXB0ZXIpIHtcbiAgICAgIHJldHVybiBhd2FpdCB0aGlzLmNvbmZpZy5yZW5hbWVfYWRhcHRlcihvbGRfcGF0aCwgbmV3X3BhdGgpO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyB0b2RvIGhhbmRsZSB3aXRoIGZzXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJyZW5hbWVfYWRhcHRlciBub3Qgc2V0XCIpO1xuICAgIH1cbiAgfVxuICBhc3luYyBzdGF0KHBhdGgpIHtcbiAgICBpZiAodGhpcy5jb25maWcuc3RhdF9hZGFwdGVyKSB7XG4gICAgICByZXR1cm4gYXdhaXQgdGhpcy5jb25maWcuc3RhdF9hZGFwdGVyKHBhdGgpO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyB0b2RvIGhhbmRsZSB3aXRoIGZzXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJzdGF0X2FkYXB0ZXIgbm90IHNldFwiKTtcbiAgICB9XG4gIH1cbiAgYXN5bmMgd3JpdGVfZmlsZShwYXRoLCBkYXRhKSB7XG4gICAgaWYgKHRoaXMuY29uZmlnLndyaXRlX2FkYXB0ZXIpIHtcbiAgICAgIHJldHVybiBhd2FpdCB0aGlzLmNvbmZpZy53cml0ZV9hZGFwdGVyKHBhdGgsIGRhdGEpO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyB0b2RvIGhhbmRsZSB3aXRoIGZzXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJ3cml0ZV9hZGFwdGVyIG5vdCBzZXRcIik7XG4gICAgfVxuICB9XG4gIGFzeW5jIGxvYWQocmV0cmllcyA9IDApIHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgZW1iZWRkaW5nc19maWxlID0gYXdhaXQgdGhpcy5yZWFkX2ZpbGUodGhpcy5maWxlX3BhdGgpO1xuICAgICAgLy8gbG9hZGVkIGVtYmVkZGluZ3MgZnJvbSBmaWxlXG4gICAgICB0aGlzLmVtYmVkZGluZ3MgPSBKU09OLnBhcnNlKGVtYmVkZGluZ3NfZmlsZSk7XG4gICAgICBjb25zb2xlLmxvZyhcImxvYWRlZCBlbWJlZGRpbmdzIGZpbGU6IFwiK3RoaXMuZmlsZV9wYXRoKTtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAvLyByZXRyeSBpZiBlcnJvciB1cCB0byAzIHRpbWVzXG4gICAgICBpZiAocmV0cmllcyA8IDMpIHtcbiAgICAgICAgY29uc29sZS5sb2coXCJyZXRyeWluZyBsb2FkKClcIik7XG4gICAgICAgIC8vIGluY3JlYXNlIHdhaXQgdGltZSBiZXR3ZWVuIHJldHJpZXNcbiAgICAgICAgYXdhaXQgbmV3IFByb21pc2UociA9PiBzZXRUaW1lb3V0KHIsIDEwMDAgKyAoMTAwMCAqIHJldHJpZXMpKSk7XG4gICAgICAgIHJldHVybiBhd2FpdCB0aGlzLmxvYWQocmV0cmllcyArIDEpO1xuICAgICAgLy8gfSBlbHNlIGlmIChyZXRyaWVzID09PSAzKSB7XG4gICAgICAvLyAgIC8vIGNoZWNrIGZvciBlbWJlZGRpbmdzLTIuanNvbiBmaWxlXG4gICAgICAvLyAgIGNvbnN0IGVtYmVkZGluZ3NfMl9maWxlX3BhdGggPSB0aGlzLmZvbGRlcl9wYXRoICsgXCIvZW1iZWRkaW5ncy0yLmpzb25cIjtcbiAgICAgIC8vICAgY29uc3QgZW1iZWRkaW5nc18yX2ZpbGVfZXhpc3RzID0gYXdhaXQgdGhpcy5maWxlX2V4aXN0cyhlbWJlZGRpbmdzXzJfZmlsZV9wYXRoKTtcbiAgICAgIC8vICAgaWYgKGVtYmVkZGluZ3NfMl9maWxlX2V4aXN0cykge1xuICAgICAgLy8gICAgIGF3YWl0IHRoaXMubWlncmF0ZV9lbWJlZGRpbmdzX3YyX3RvX3YzKCk7XG4gICAgICAvLyAgICAgcmV0dXJuIGF3YWl0IHRoaXMubG9hZChyZXRyaWVzICsgMSk7XG4gICAgICAvLyAgIH1cbiAgICAgIH1cbiAgICAgIGNvbnNvbGUubG9nKFwiZmFpbGVkIHRvIGxvYWQgZW1iZWRkaW5ncyBmaWxlLCBwcm9tcHQgdXNlciB0byBpbml0aWF0ZSBidWxrIGVtYmVkXCIpO1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxuXG4gIGFzeW5jIGluaXRfZW1iZWRkaW5nc19maWxlKCkge1xuICAgIC8vIGNoZWNrIGlmIGZvbGRlciBleGlzdHNcbiAgICBpZiAoIShhd2FpdCB0aGlzLmZpbGVfZXhpc3RzKHRoaXMuZm9sZGVyX3BhdGgpKSkge1xuICAgICAgLy8gY3JlYXRlIGZvbGRlclxuICAgICAgYXdhaXQgdGhpcy5ta2Rpcih0aGlzLmZvbGRlcl9wYXRoKTtcbiAgICAgIGNvbnNvbGUubG9nKFwiY3JlYXRlZCBmb2xkZXI6IFwiK3RoaXMuZm9sZGVyX3BhdGgpO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zb2xlLmxvZyhcImZvbGRlciBhbHJlYWR5IGV4aXN0czogXCIrdGhpcy5mb2xkZXJfcGF0aCk7XG4gICAgfVxuICAgIC8vIGNoZWNrIGlmIGVtYmVkZGluZ3MgZmlsZSBleGlzdHNcbiAgICBpZiAoIShhd2FpdCB0aGlzLmZpbGVfZXhpc3RzKHRoaXMuZmlsZV9wYXRoKSkpIHtcbiAgICAgIC8vIGNyZWF0ZSBlbWJlZGRpbmdzIGZpbGVcbiAgICAgIGF3YWl0IHRoaXMud3JpdGVfZmlsZSh0aGlzLmZpbGVfcGF0aCwgXCJ7fVwiKTtcbiAgICAgIGNvbnNvbGUubG9nKFwiY3JlYXRlZCBlbWJlZGRpbmdzIGZpbGU6IFwiK3RoaXMuZmlsZV9wYXRoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc29sZS5sb2coXCJlbWJlZGRpbmdzIGZpbGUgYWxyZWFkeSBleGlzdHM6IFwiK3RoaXMuZmlsZV9wYXRoKTtcbiAgICB9XG4gIH1cblxuICBhc3luYyBzYXZlKCkge1xuICAgIGNvbnN0IGVtYmVkZGluZ3MgPSBKU09OLnN0cmluZ2lmeSh0aGlzLmVtYmVkZGluZ3MpO1xuICAgIC8vIGNoZWNrIGlmIGVtYmVkZGluZ3MgZmlsZSBleGlzdHNcbiAgICBjb25zdCBlbWJlZGRpbmdzX2ZpbGVfZXhpc3RzID0gYXdhaXQgdGhpcy5maWxlX2V4aXN0cyh0aGlzLmZpbGVfcGF0aCk7XG4gICAgLy8gaWYgZW1iZWRkaW5ncyBmaWxlIGV4aXN0cyB0aGVuIGNoZWNrIGlmIG5ldyBlbWJlZGRpbmdzIGZpbGUgc2l6ZSBpcyBzaWduaWZpY2FudGx5IHNtYWxsZXIgdGhhbiBleGlzdGluZyBlbWJlZGRpbmdzIGZpbGUgc2l6ZVxuICAgIGlmIChlbWJlZGRpbmdzX2ZpbGVfZXhpc3RzKSB7XG4gICAgICAvLyBlc2l0bWF0ZSBmaWxlIHNpemUgb2YgZW1iZWRkaW5nc1xuICAgICAgY29uc3QgbmV3X2ZpbGVfc2l6ZSA9IGVtYmVkZGluZ3MubGVuZ3RoO1xuICAgICAgLy8gZ2V0IGV4aXN0aW5nIGZpbGUgc2l6ZVxuICAgICAgY29uc3QgZXhpc3RpbmdfZmlsZV9zaXplID0gYXdhaXQgdGhpcy5zdGF0KHRoaXMuZmlsZV9wYXRoKS50aGVuKChzdGF0KSA9PiBzdGF0LnNpemUpO1xuICAgICAgLy8gY29uc29sZS5sb2coXCJuZXcgZmlsZSBzaXplOiBcIituZXdfZmlsZV9zaXplKTtcbiAgICAgIC8vIGNvbnNvbGUubG9nKFwiZXhpc3RpbmcgZmlsZSBzaXplOiBcIitleGlzdGluZ19maWxlX3NpemUpO1xuICAgICAgLy8gaWYgbmV3IGZpbGUgc2l6ZSBpcyBhdCBsZWFzdCA1MCUgb2YgZXhpc3RpbmcgZmlsZSBzaXplIHRoZW4gd3JpdGUgZW1iZWRkaW5ncyB0byBmaWxlXG4gICAgICBpZiAobmV3X2ZpbGVfc2l6ZSA+IChleGlzdGluZ19maWxlX3NpemUgKiAwLjUpKSB7XG4gICAgICAgIC8vIHdyaXRlIGVtYmVkZGluZ3MgdG8gZmlsZVxuICAgICAgICBhd2FpdCB0aGlzLndyaXRlX2ZpbGUodGhpcy5maWxlX3BhdGgsIGVtYmVkZGluZ3MpO1xuICAgICAgICBjb25zb2xlLmxvZyhcImVtYmVkZGluZ3MgZmlsZSBzaXplOiBcIiArIG5ld19maWxlX3NpemUgKyBcIiBieXRlc1wiKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIGlmIG5ldyBmaWxlIHNpemUgaXMgc2lnbmlmaWNhbnRseSBzbWFsbGVyIHRoYW4gZXhpc3RpbmcgZmlsZSBzaXplIHRoZW4gdGhyb3cgZXJyb3JcbiAgICAgICAgLy8gc2hvdyB3YXJuaW5nIG1lc3NhZ2UgaW5jbHVkaW5nIGZpbGUgc2l6ZXNcbiAgICAgICAgY29uc3Qgd2FybmluZ19tZXNzYWdlID0gW1xuICAgICAgICAgIFwiV2FybmluZzogTmV3IGVtYmVkZGluZ3MgZmlsZSBzaXplIGlzIHNpZ25pZmljYW50bHkgc21hbGxlciB0aGFuIGV4aXN0aW5nIGVtYmVkZGluZ3MgZmlsZSBzaXplLlwiLFxuICAgICAgICAgIFwiQWJvcnRpbmcgdG8gcHJldmVudCBwb3NzaWJsZSBsb3NzIG9mIGVtYmVkZGluZ3MgZGF0YS5cIixcbiAgICAgICAgICBcIk5ldyBmaWxlIHNpemU6IFwiICsgbmV3X2ZpbGVfc2l6ZSArIFwiIGJ5dGVzLlwiLFxuICAgICAgICAgIFwiRXhpc3RpbmcgZmlsZSBzaXplOiBcIiArIGV4aXN0aW5nX2ZpbGVfc2l6ZSArIFwiIGJ5dGVzLlwiLFxuICAgICAgICAgIFwiUmVzdGFydGluZyBPYnNpZGlhbiBtYXkgZml4IHRoaXMuXCJcbiAgICAgICAgXTtcbiAgICAgICAgY29uc29sZS5sb2cod2FybmluZ19tZXNzYWdlLmpvaW4oXCIgXCIpKTtcbiAgICAgICAgLy8gc2F2ZSBlbWJlZGRpbmdzIHRvIGZpbGUgbmFtZWQgdW5zYXZlZC1lbWJlZGRpbmdzLmpzb25cbiAgICAgICAgYXdhaXQgdGhpcy53cml0ZV9maWxlKHRoaXMuZm9sZGVyX3BhdGgrXCIvdW5zYXZlZC1lbWJlZGRpbmdzLmpzb25cIiwgZW1iZWRkaW5ncyk7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIkVycm9yOiBOZXcgZW1iZWRkaW5ncyBmaWxlIHNpemUgaXMgc2lnbmlmaWNhbnRseSBzbWFsbGVyIHRoYW4gZXhpc3RpbmcgZW1iZWRkaW5ncyBmaWxlIHNpemUuIEFib3J0aW5nIHRvIHByZXZlbnQgcG9zc2libGUgbG9zcyBvZiBlbWJlZGRpbmdzIGRhdGEuXCIpO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBhd2FpdCB0aGlzLmluaXRfZW1iZWRkaW5nc19maWxlKCk7XG4gICAgICByZXR1cm4gYXdhaXQgdGhpcy5zYXZlKCk7XG4gICAgfVxuICAgIHJldHVybiB0cnVlO1xuICB9XG4gIGNvc19zaW0odmVjdG9yMSwgdmVjdG9yMikge1xuICAgIGxldCBkb3RQcm9kdWN0ID0gMDtcbiAgICBsZXQgbm9ybUEgPSAwO1xuICAgIGxldCBub3JtQiA9IDA7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCB2ZWN0b3IxLmxlbmd0aDsgaSsrKSB7XG4gICAgICBkb3RQcm9kdWN0ICs9IHZlY3RvcjFbaV0gKiB2ZWN0b3IyW2ldO1xuICAgICAgbm9ybUEgKz0gdmVjdG9yMVtpXSAqIHZlY3RvcjFbaV07XG4gICAgICBub3JtQiArPSB2ZWN0b3IyW2ldICogdmVjdG9yMltpXTtcbiAgICB9XG4gICAgaWYgKG5vcm1BID09PSAwIHx8IG5vcm1CID09PSAwKSB7XG4gICAgICByZXR1cm4gMDtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIGRvdFByb2R1Y3QgLyAoTWF0aC5zcXJ0KG5vcm1BKSAqIE1hdGguc3FydChub3JtQikpO1xuICAgIH1cbiAgfVxuICBuZWFyZXN0KHRvX3ZlYywgZmlsdGVyID0ge30pIHtcbiAgICBmaWx0ZXIgPSB7XG4gICAgICByZXN1bHRzX2NvdW50OiAzMCxcbiAgICAgIC4uLmZpbHRlclxuICAgIH07XG4gICAgbGV0IG5lYXJlc3QgPSBbXTtcbiAgICBjb25zdCBmcm9tX2tleXMgPSBPYmplY3Qua2V5cyh0aGlzLmVtYmVkZGluZ3MpO1xuICAgIC8vIHRoaXMucmVuZGVyX2xvZy50b3RhbF9lbWJlZGRpbmdzID0gZnJvbV9rZXlzLmxlbmd0aDtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGZyb21fa2V5cy5sZW5ndGg7IGkrKykge1xuICAgICAgLy8gaWYgdGhpcy5zZXR0aW5ncy5za2lwX3NlY3Rpb25zIGlzIHRydWVcbiAgICAgIGlmIChmaWx0ZXIuc2tpcF9zZWN0aW9ucykge1xuICAgICAgICBjb25zdCBmcm9tX3BhdGggPSB0aGlzLmVtYmVkZGluZ3NbZnJvbV9rZXlzW2ldXS5tZXRhLnBhdGg7XG4gICAgICAgIGlmIChmcm9tX3BhdGguaW5kZXhPZihcIiNcIikgPiAtMSkgY29udGludWU7IC8vIHNraXAgaWYgY29udGFpbnMgIyBpbmRpY2F0aW5nIGJsb2NrIChzZWN0aW9uKVxuXG4gICAgICAgIC8vIFRPRE86IGNvbnNpZGVyIHVzaW5nIHByZXNlbmNlIG9mIG1ldGEucGFyZW50IHRvIHNraXAgZmlsZXMgKGZhc3RlciBjaGVja2luZz8pXG4gICAgICB9XG4gICAgICBpZiAoZmlsdGVyLnNraXBfa2V5KSB7XG4gICAgICAgIGlmIChmaWx0ZXIuc2tpcF9rZXkgPT09IGZyb21fa2V5c1tpXSkgY29udGludWU7IC8vIHNraXAgbWF0Y2hpbmcgdG8gY3VycmVudCBub3RlXG4gICAgICAgIGlmIChmaWx0ZXIuc2tpcF9rZXkgPT09IHRoaXMuZW1iZWRkaW5nc1tmcm9tX2tleXNbaV1dLm1ldGEucGFyZW50KSBjb250aW51ZTsgLy8gc2tpcCBpZiBmaWx0ZXIuc2tpcF9rZXkgbWF0Y2hlcyBtZXRhLnBhcmVudFxuICAgICAgfVxuICAgICAgLy8gaWYgZmlsdGVyLnBhdGhfYmVnaW5zX3dpdGggaXMgc2V0IChmb2xkZXIgZmlsdGVyKVxuICAgICAgaWYgKGZpbHRlci5wYXRoX2JlZ2luc193aXRoKSB7XG4gICAgICAgIC8vIGlmIHR5cGUgaXMgc3RyaW5nICYgbWV0YS5wYXRoIGRvZXMgbm90IGJlZ2luIHdpdGggZmlsdGVyLnBhdGhfYmVnaW5zX3dpdGgsIHNraXBcbiAgICAgICAgaWYgKHR5cGVvZiBmaWx0ZXIucGF0aF9iZWdpbnNfd2l0aCA9PT0gXCJzdHJpbmdcIiAmJiAhdGhpcy5lbWJlZGRpbmdzW2Zyb21fa2V5c1tpXV0ubWV0YS5wYXRoLnN0YXJ0c1dpdGgoZmlsdGVyLnBhdGhfYmVnaW5zX3dpdGgpKSBjb250aW51ZTtcbiAgICAgICAgLy8gaWYgdHlwZSBpcyBhcnJheSAmIG1ldGEucGF0aCBkb2VzIG5vdCBiZWdpbiB3aXRoIGFueSBvZiB0aGUgZmlsdGVyLnBhdGhfYmVnaW5zX3dpdGgsIHNraXBcbiAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkoZmlsdGVyLnBhdGhfYmVnaW5zX3dpdGgpICYmICFmaWx0ZXIucGF0aF9iZWdpbnNfd2l0aC5zb21lKChwYXRoKSA9PiB0aGlzLmVtYmVkZGluZ3NbZnJvbV9rZXlzW2ldXS5tZXRhLnBhdGguc3RhcnRzV2l0aChwYXRoKSkpIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBuZWFyZXN0LnB1c2goe1xuICAgICAgICBsaW5rOiB0aGlzLmVtYmVkZGluZ3NbZnJvbV9rZXlzW2ldXS5tZXRhLnBhdGgsXG4gICAgICAgIHNpbWlsYXJpdHk6IHRoaXMuY29zX3NpbSh0b192ZWMsIHRoaXMuZW1iZWRkaW5nc1tmcm9tX2tleXNbaV1dLnZlYyksXG4gICAgICAgIHNpemU6IHRoaXMuZW1iZWRkaW5nc1tmcm9tX2tleXNbaV1dLm1ldGEuc2l6ZSxcbiAgICAgIH0pO1xuICAgIH1cbiAgICAvLyBzb3J0IGFycmF5IGJ5IGNvc2luZSBzaW1pbGFyaXR5XG4gICAgbmVhcmVzdC5zb3J0KGZ1bmN0aW9uIChhLCBiKSB7XG4gICAgICByZXR1cm4gYi5zaW1pbGFyaXR5IC0gYS5zaW1pbGFyaXR5O1xuICAgIH0pO1xuICAgIC8vIGNvbnNvbGUubG9nKG5lYXJlc3QpO1xuICAgIC8vIGxpbWl0IHRvIE4gbmVhcmVzdCBjb25uZWN0aW9uc1xuICAgIG5lYXJlc3QgPSBuZWFyZXN0LnNsaWNlKDAsIGZpbHRlci5yZXN1bHRzX2NvdW50KTtcbiAgICByZXR1cm4gbmVhcmVzdDtcbiAgfVxuICBmaW5kX25lYXJlc3RfZW1iZWRkaW5ncyh0b192ZWMsIGZpbHRlcj17fSkge1xuICAgIGNvbnN0IGRlZmF1bHRfZmlsdGVyID0ge1xuICAgICAgbWF4OiB0aGlzLm1heF9zb3VyY2VzLFxuICAgIH07XG4gICAgZmlsdGVyID0gey4uLmRlZmF1bHRfZmlsdGVyLCAuLi5maWx0ZXJ9O1xuICAgIC8vIGhhbmRsZSBpZiB0b192ZWMgaXMgYW4gYXJyYXkgb2YgdmVjdG9yc1xuICAgIC8vIGxldCBuZWFyZXN0ID0gW107XG4gICAgaWYoQXJyYXkuaXNBcnJheSh0b192ZWMpICYmIHRvX3ZlYy5sZW5ndGggIT09IHRoaXMudmVjX2xlbil7XG4gICAgICB0aGlzLm5lYXJlc3QgPSB7fTtcbiAgICAgIGZvcihsZXQgaSA9IDA7IGkgPCB0b192ZWMubGVuZ3RoOyBpKyspe1xuICAgICAgICAvLyBuZWFyZXN0ID0gbmVhcmVzdC5jb25jYXQodGhpcy5maW5kX25lYXJlc3RfZW1iZWRkaW5ncyh0b192ZWNbaV0sIHtcbiAgICAgICAgLy8gICBtYXg6IE1hdGguZmxvb3IoZmlsdGVyLm1heCAvIHRvX3ZlYy5sZW5ndGgpXG4gICAgICAgIC8vIH0pKTtcbiAgICAgICAgdGhpcy5maW5kX25lYXJlc3RfZW1iZWRkaW5ncyh0b192ZWNbaV0sIHtcbiAgICAgICAgICBtYXg6IE1hdGguZmxvb3IoZmlsdGVyLm1heCAvIHRvX3ZlYy5sZW5ndGgpXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1lbHNle1xuICAgICAgY29uc3QgZnJvbV9rZXlzID0gT2JqZWN0LmtleXModGhpcy5lbWJlZGRpbmdzKTtcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZnJvbV9rZXlzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGlmKHRoaXMudmFsaWRhdGVfdHlwZSh0aGlzLmVtYmVkZGluZ3NbZnJvbV9rZXlzW2ldXSkpIGNvbnRpbnVlO1xuICAgICAgICBjb25zdCBzaW0gPSB0aGlzLmNvbXB1dGVDb3NpbmVTaW1pbGFyaXR5KHRvX3ZlYywgdGhpcy5lbWJlZGRpbmdzW2Zyb21fa2V5c1tpXV0udmVjKTtcbiAgICAgICAgaWYodGhpcy5uZWFyZXN0W2Zyb21fa2V5c1tpXV0peyAvLyBpZiBhbHJlYWR5IGNvbXB1dGVkLCB1c2UgY2FjaGVkIHZhbHVlXG4gICAgICAgICAgdGhpcy5uZWFyZXN0W2Zyb21fa2V5c1tpXV0gKz0gc2ltO1xuICAgICAgICB9ZWxzZXtcbiAgICAgICAgICB0aGlzLm5lYXJlc3RbZnJvbV9rZXlzW2ldXSA9IHNpbTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICAvLyBpbml0aWF0ZSBuZWFyZXN0IGFycmF5XG4gICAgbGV0IG5lYXJlc3QgPSBPYmplY3Qua2V5cyh0aGlzLm5lYXJlc3QpLm1hcChrZXkgPT4ge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAga2V5OiBrZXksXG4gICAgICAgIHNpbWlsYXJpdHk6IHRoaXMubmVhcmVzdFtrZXldLFxuICAgICAgfVxuICAgIH0pO1xuICAgIC8vIHNvcnQgYXJyYXkgYnkgY29zaW5lIHNpbWlsYXJpdHlcbiAgICBuZWFyZXN0ID0gdGhpcy5zb3J0X2J5X3NpbWlsYXJpdHkobmVhcmVzdCk7XG4gICAgbmVhcmVzdCA9IG5lYXJlc3Quc2xpY2UoMCwgZmlsdGVyLm1heCk7XG4gICAgLy8gYWRkIGxpbmsgYW5kIGxlbmd0aCB0byByZW1haW5pbmcgbmVhcmVzdFxuICAgIG5lYXJlc3QgPSBuZWFyZXN0Lm1hcChpdGVtID0+IHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIGxpbms6IHRoaXMuZW1iZWRkaW5nc1tpdGVtLmtleV0ubWV0YS5wYXRoLFxuICAgICAgICBzaW1pbGFyaXR5OiBpdGVtLnNpbWlsYXJpdHksXG4gICAgICAgIGxlbjogdGhpcy5lbWJlZGRpbmdzW2l0ZW0ua2V5XS5tZXRhLmxlbiB8fCB0aGlzLmVtYmVkZGluZ3NbaXRlbS5rZXldLm1ldGEuc2l6ZSxcbiAgICAgIH1cbiAgICB9KTtcbiAgICByZXR1cm4gbmVhcmVzdDtcbiAgfVxuICBzb3J0X2J5X3NpbWlsYXJpdHkobmVhcmVzdCkge1xuICAgIHJldHVybiBuZWFyZXN0LnNvcnQoZnVuY3Rpb24gKGEsIGIpIHtcbiAgICAgIGNvbnN0IGFfc2NvcmUgPSBhLnNpbWlsYXJpdHk7XG4gICAgICBjb25zdCBiX3Njb3JlID0gYi5zaW1pbGFyaXR5O1xuICAgICAgLy8gaWYgYSBpcyBncmVhdGVyIHRoYW4gYiwgcmV0dXJuIC0xXG4gICAgICBpZiAoYV9zY29yZSA+IGJfc2NvcmUpXG4gICAgICAgIHJldHVybiAtMTtcbiAgICAgIC8vIGlmIGEgaXMgbGVzcyB0aGFuIGIsIHJldHVybiAxXG4gICAgICBpZiAoYV9zY29yZSA8IGJfc2NvcmUpXG4gICAgICAgIHJldHVybiAxO1xuICAgICAgLy8gaWYgYSBpcyBlcXVhbCB0byBiLCByZXR1cm4gMFxuICAgICAgcmV0dXJuIDA7XG4gICAgfSk7XG4gIH1cbiAgLy8gY2hlY2sgaWYga2V5IGZyb20gZW1iZWRkaW5ncyBleGlzdHMgaW4gZmlsZXNcbiAgY2xlYW5fdXBfZW1iZWRkaW5ncyhmaWxlcykge1xuICAgIGNvbnNvbGUubG9nKFwiY2xlYW5pbmcgdXAgZW1iZWRkaW5nc1wiKTtcbiAgICBjb25zdCBrZXlzID0gT2JqZWN0LmtleXModGhpcy5lbWJlZGRpbmdzKTtcbiAgICBsZXQgZGVsZXRlZF9lbWJlZGRpbmdzID0gMDtcbiAgICBmb3IgKGNvbnN0IGtleSBvZiBrZXlzKSB7XG4gICAgICAvLyBjb25zb2xlLmxvZyhcImtleTogXCIra2V5KTtcbiAgICAgIGNvbnN0IHBhdGggPSB0aGlzLmVtYmVkZGluZ3Nba2V5XS5tZXRhLnBhdGg7XG4gICAgICAvLyBpZiBubyBrZXkgc3RhcnRzIHdpdGggZmlsZSBwYXRoXG4gICAgICBpZighZmlsZXMuZmluZChmaWxlID0+IHBhdGguc3RhcnRzV2l0aChmaWxlLnBhdGgpKSkge1xuICAgICAgICAvLyBkZWxldGUga2V5IGlmIGl0IGRvZXNuJ3QgZXhpc3RcbiAgICAgICAgZGVsZXRlIHRoaXMuZW1iZWRkaW5nc1trZXldO1xuICAgICAgICBkZWxldGVkX2VtYmVkZGluZ3MrKztcbiAgICAgICAgLy8gY29uc29sZS5sb2coXCJkZWxldGluZyAoZGVsZXRlZCBmaWxlKTogXCIgKyBrZXkpO1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIC8vIGlmIGtleSBjb250YWlucyAnIydcbiAgICAgIGlmKHBhdGguaW5kZXhPZihcIiNcIikgPiAtMSkge1xuICAgICAgICBjb25zdCBwYXJlbnRfa2V5ID0gdGhpcy5lbWJlZGRpbmdzW2tleV0ubWV0YS5wYXJlbnQ7XG4gICAgICAgIC8vIGlmIHBhcmVudF9rZXkgbWlzc2luZyBmcm9tIGVtYmVkZGluZ3MgdGhlbiBkZWxldGUga2V5XG4gICAgICAgIGlmKCF0aGlzLmVtYmVkZGluZ3NbcGFyZW50X2tleV0pe1xuICAgICAgICAgIC8vIGRlbGV0ZSBrZXlcbiAgICAgICAgICBkZWxldGUgdGhpcy5lbWJlZGRpbmdzW2tleV07XG4gICAgICAgICAgZGVsZXRlZF9lbWJlZGRpbmdzKys7XG4gICAgICAgICAgLy8gY29uc29sZS5sb2coXCJkZWxldGluZyAobWlzc2luZyBwYXJlbnQpXCIpO1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICAgIC8vIGlmIHBhcmVudF9rZXkgbWlzc2luZyBtZXRhIHRoZW4gZGVsZXRlIGtleVxuICAgICAgICBpZighdGhpcy5lbWJlZGRpbmdzW3BhcmVudF9rZXldLm1ldGEpe1xuICAgICAgICAgIC8vIGRlbGV0ZSBrZXlcbiAgICAgICAgICBkZWxldGUgdGhpcy5lbWJlZGRpbmdzW2tleV07XG4gICAgICAgICAgZGVsZXRlZF9lbWJlZGRpbmdzKys7XG4gICAgICAgICAgLy8gY29uc29sZS5sb2coXCJkZWxldGluZyAocGFyZW50IG1pc3NpbmcgbWV0YSlcIik7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgICAgLy8gaWYgcGFyZW50X2tleSBtaXNzaW5nIGNoaWxkcmVuIHRoZW4gZGVsZXRlIGtleVxuICAgICAgICAvLyBpZiBwYXJlbnRfa2V5IGNoaWxkcmVuIGRvZXNuJ3QgaW5jbHVkZSBrZXkgdGhlbiBkZWxldGUga2V5XG4gICAgICAgIGlmKHRoaXMuZW1iZWRkaW5nc1twYXJlbnRfa2V5XS5tZXRhLmNoaWxkcmVuICYmICh0aGlzLmVtYmVkZGluZ3NbcGFyZW50X2tleV0ubWV0YS5jaGlsZHJlbi5pbmRleE9mKGtleSkgPCAwKSkge1xuICAgICAgICAgIC8vIGRlbGV0ZSBrZXlcbiAgICAgICAgICBkZWxldGUgdGhpcy5lbWJlZGRpbmdzW2tleV07XG4gICAgICAgICAgZGVsZXRlZF9lbWJlZGRpbmdzKys7XG4gICAgICAgICAgLy8gY29uc29sZS5sb2coXCJkZWxldGluZyAobm90IHByZXNlbnQgaW4gcGFyZW50J3MgY2hpbGRyZW4pXCIpO1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB7ZGVsZXRlZF9lbWJlZGRpbmdzOiBkZWxldGVkX2VtYmVkZGluZ3MsIHRvdGFsX2VtYmVkZGluZ3M6IGtleXMubGVuZ3RofTtcbiAgfVxuXG4gIGdldChrZXkpIHtcbiAgICByZXR1cm4gdGhpcy5lbWJlZGRpbmdzW2tleV0gfHwgbnVsbDtcbiAgfVxuICBnZXRfbWV0YShrZXkpIHtcbiAgICBjb25zdCBlbWJlZGRpbmcgPSB0aGlzLmdldChrZXkpO1xuICAgIGlmKGVtYmVkZGluZyAmJiBlbWJlZGRpbmcubWV0YSkge1xuICAgICAgcmV0dXJuIGVtYmVkZGluZy5tZXRhO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICBnZXRfbXRpbWUoa2V5KSB7XG4gICAgY29uc3QgbWV0YSA9IHRoaXMuZ2V0X21ldGEoa2V5KTtcbiAgICBpZihtZXRhICYmIG1ldGEubXRpbWUpIHtcbiAgICAgIHJldHVybiBtZXRhLm10aW1lO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICBnZXRfaGFzaChrZXkpIHtcbiAgICBjb25zdCBtZXRhID0gdGhpcy5nZXRfbWV0YShrZXkpO1xuICAgIGlmKG1ldGEgJiYgbWV0YS5oYXNoKSB7XG4gICAgICByZXR1cm4gbWV0YS5oYXNoO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICBnZXRfc2l6ZShrZXkpIHtcbiAgICBjb25zdCBtZXRhID0gdGhpcy5nZXRfbWV0YShrZXkpO1xuICAgIGlmKG1ldGEgJiYgbWV0YS5zaXplKSB7XG4gICAgICByZXR1cm4gbWV0YS5zaXplO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICBnZXRfY2hpbGRyZW4oa2V5KSB7XG4gICAgY29uc3QgbWV0YSA9IHRoaXMuZ2V0X21ldGEoa2V5KTtcbiAgICBpZihtZXRhICYmIG1ldGEuY2hpbGRyZW4pIHtcbiAgICAgIHJldHVybiBtZXRhLmNoaWxkcmVuO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICBnZXRfdmVjKGtleSkge1xuICAgIGNvbnN0IGVtYmVkZGluZyA9IHRoaXMuZ2V0KGtleSk7XG4gICAgaWYoZW1iZWRkaW5nICYmIGVtYmVkZGluZy52ZWMpIHtcbiAgICAgIHJldHVybiBlbWJlZGRpbmcudmVjO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICBzYXZlX2VtYmVkZGluZyhrZXksIHZlYywgbWV0YSkge1xuICAgIHRoaXMuZW1iZWRkaW5nc1trZXldID0ge1xuICAgICAgdmVjOiB2ZWMsXG4gICAgICBtZXRhOiBtZXRhLFxuICAgIH07XG4gIH1cbiAgbXRpbWVfaXNfY3VycmVudChrZXksIHNvdXJjZV9tdGltZSkge1xuICAgIGNvbnN0IG10aW1lID0gdGhpcy5nZXRfbXRpbWUoa2V5KTtcbiAgICBpZihtdGltZSAmJiBtdGltZSA+PSBzb3VyY2VfbXRpbWUpIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBhc3luYyBmb3JjZV9yZWZyZXNoKCkge1xuICAgIHRoaXMuZW1iZWRkaW5ncyA9IG51bGw7XG4gICAgdGhpcy5lbWJlZGRpbmdzID0ge307XG4gICAgLy8gZ2V0IGN1cnJlbnQgZGF0ZXRpbWUgYXMgdW5peCB0aW1lc3RhbXBcbiAgICBsZXQgY3VycmVudF9kYXRldGltZSA9IE1hdGguZmxvb3IoRGF0ZS5ub3coKSAvIDEwMDApO1xuICAgIC8vIHJlbmFtZSBleGlzdGluZyBlbWJlZGRpbmdzIGZpbGUgdG8gdGhpcy5mb2xkZXJfcGF0aC9lbWJlZGRpbmdzLVlZWVktTU0tREQuanNvblxuICAgIGF3YWl0IHRoaXMucmVuYW1lKHRoaXMuZmlsZV9wYXRoLCB0aGlzLmZvbGRlcl9wYXRoICsgXCIvZW1iZWRkaW5ncy1cIiArIGN1cnJlbnRfZGF0ZXRpbWUgKyBcIi5qc29uXCIpO1xuICAgIC8vIGNyZWF0ZSBuZXcgZW1iZWRkaW5ncyBmaWxlXG4gICAgYXdhaXQgdGhpcy5pbml0X2VtYmVkZGluZ3NfZmlsZSgpO1xuICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gVmVjTGl0ZTsiLCAiY29uc3QgT2JzaWRpYW4gPSByZXF1aXJlKFwib2JzaWRpYW5cIik7XG5jb25zdCBWZWNMaXRlID0gcmVxdWlyZShcInZlYy1saXRlXCIpO1xuXG5jb25zdCBERUZBVUxUX1NFVFRJTkdTID0ge1xuICBhcGlfa2V5OiBcIlwiLFxuICBjaGF0X29wZW46IHRydWUsXG4gIGZpbGVfZXhjbHVzaW9uczogXCJcIixcbiAgZm9sZGVyX2V4Y2x1c2lvbnM6IFwiXCIsXG4gIGhlYWRlcl9leGNsdXNpb25zOiBcIlwiLFxuICBwYXRoX29ubHk6IFwiXCIsXG4gIHNob3dfZnVsbF9wYXRoOiBmYWxzZSxcbiAgZXhwYW5kZWRfdmlldzogdHJ1ZSxcbiAgZ3JvdXBfbmVhcmVzdF9ieV9maWxlOiBmYWxzZSxcbiAgbGFuZ3VhZ2U6IFwiZW5cIixcbiAgbG9nX3JlbmRlcjogZmFsc2UsXG4gIGxvZ19yZW5kZXJfZmlsZXM6IGZhbHNlLFxuICByZWNlbnRseV9zZW50X3JldHJ5X25vdGljZTogZmFsc2UsXG4gIHNraXBfc2VjdGlvbnM6IGZhbHNlLFxuICBzbWFydF9jaGF0X21vZGVsOiBcImdwdC0zLjUtdHVyYm8tMTZrXCIsXG4gIHZpZXdfb3BlbjogdHJ1ZSxcbiAgdmVyc2lvbjogXCJcIixcbn07XG5jb25zdCBNQVhfRU1CRURfU1RSSU5HX0xFTkdUSCA9IDI1MDAwO1xuXG5sZXQgVkVSU0lPTjtcbmNvbnN0IFNVUFBPUlRFRF9GSUxFX1RZUEVTID0gW1wibWRcIiwgXCJjYW52YXNcIl07XG5cbi8vY3JlYXRlIG9uZSBvYmplY3Qgd2l0aCBhbGwgdGhlIHRyYW5zbGF0aW9uc1xuLy8gcmVzZWFyY2ggOiBTTUFSVF9UUkFOU0xBVElPTltsYW5ndWFnZV1ba2V5XVxuY29uc3QgU01BUlRfVFJBTlNMQVRJT04gPSB7XG4gIFwiZW5cIjoge1xuICAgIFwicHJvbm91c1wiOiBbXCJteVwiLCBcIklcIiwgXCJtZVwiLCBcIm1pbmVcIiwgXCJvdXJcIiwgXCJvdXJzXCIsIFwidXNcIiwgXCJ3ZVwiXSxcbiAgICBcInByb21wdFwiOiBcIkJhc2VkIG9uIHlvdXIgbm90ZXNcIixcbiAgICBcImluaXRpYWxfbWVzc2FnZVwiOiBcIkhpLCBJJ20gQ2hhdEdQVCB3aXRoIGFjY2VzcyB0byB5b3VyIG5vdGVzIHZpYSBTbWFydCBDb25uZWN0aW9ucy4gQXNrIG1lIGEgcXVlc3Rpb24gYWJvdXQgeW91ciBub3RlcyBhbmQgSSdsbCB0cnkgdG8gYW5zd2VyIGl0LlwiLFxuICB9LFxuICBcImVzXCI6IHtcbiAgICBcInByb25vdXNcIjogW1wibWlcIiwgXCJ5b1wiLCBcIm1cdTAwRURcIiwgXCJ0XHUwMEZBXCJdLFxuICAgIFwicHJvbXB0XCI6IFwiQmFzXHUwMEUxbmRvc2UgZW4gc3VzIG5vdGFzXCIsXG4gICAgXCJpbml0aWFsX21lc3NhZ2VcIjogXCJIb2xhLCBzb3kgQ2hhdEdQVCBjb24gYWNjZXNvIGEgdHVzIGFwdW50ZXMgYSB0cmF2XHUwMEU5cyBkZSBTbWFydCBDb25uZWN0aW9ucy4gSGF6bWUgdW5hIHByZWd1bnRhIHNvYnJlIHR1cyBhcHVudGVzIGUgaW50ZW50YXJcdTAwRTkgcmVzcG9uZGVydGUuXCIsXG4gIH0sXG4gIFwiZnJcIjoge1xuICAgIFwicHJvbm91c1wiOiBbXCJtZVwiLCBcIm1vblwiLCBcIm1hXCIsIFwibWVzXCIsIFwibW9pXCIsIFwibm91c1wiLCBcIm5vdHJlXCIsIFwibm9zXCIsIFwiamVcIiwgXCJqJ1wiLCBcIm0nXCJdLFxuICAgIFwicHJvbXB0XCI6IFwiRCdhcHJcdTAwRThzIHZvcyBub3Rlc1wiLFxuICAgIFwiaW5pdGlhbF9tZXNzYWdlXCI6IFwiQm9uam91ciwgamUgc3VpcyBDaGF0R1BUIGV0IGonYWkgYWNjXHUwMEU4cyBcdTAwRTAgdm9zIG5vdGVzIHZpYSBTbWFydCBDb25uZWN0aW9ucy4gUG9zZXotbW9pIHVuZSBxdWVzdGlvbiBzdXIgdm9zIG5vdGVzIGV0IGonZXNzYWllcmFpIGQneSByXHUwMEU5cG9uZHJlLlwiLFxuICB9LFxuICBcImRlXCI6IHtcbiAgICBcInByb25vdXNcIjogW1wibWVpblwiLCBcIm1laW5lXCIsIFwibWVpbmVuXCIsIFwibWVpbmVyXCIsIFwibWVpbmVzXCIsIFwibWlyXCIsIFwidW5zXCIsIFwidW5zZXJcIiwgXCJ1bnNlcmVuXCIsIFwidW5zZXJlclwiLCBcInVuc2VyZXNcIl0sXG4gICAgXCJwcm9tcHRcIjogXCJCYXNpZXJlbmQgYXVmIElocmVuIE5vdGl6ZW5cIixcbiAgICBcImluaXRpYWxfbWVzc2FnZVwiOiBcIkhhbGxvLCBpY2ggYmluIENoYXRHUFQgdW5kIGhhYmUgXHUwMEZDYmVyIFNtYXJ0IENvbm5lY3Rpb25zIFp1Z2FuZyB6dSBJaHJlbiBOb3RpemVuLiBTdGVsbGVuIFNpZSBtaXIgZWluZSBGcmFnZSB6dSBJaHJlbiBOb3RpemVuIHVuZCBpY2ggd2VyZGUgdmVyc3VjaGVuLCBzaWUgenUgYmVhbnR3b3J0ZW4uXCIsXG4gIH0sXG4gIFwiaXRcIjoge1xuICAgIFwicHJvbm91c1wiOiBbXCJtaW9cIiwgXCJtaWFcIiwgXCJtaWVpXCIsIFwibWllXCIsIFwibm9pXCIsIFwibm9zdHJvXCIsIFwibm9zdHJpXCIsIFwibm9zdHJhXCIsIFwibm9zdHJlXCJdLFxuICAgIFwicHJvbXB0XCI6IFwiU3VsbGEgYmFzZSBkZWdsaSBhcHB1bnRpXCIsXG4gICAgXCJpbml0aWFsX21lc3NhZ2VcIjogXCJDaWFvLCBzb25vIENoYXRHUFQgZSBobyBhY2Nlc3NvIGFpIHR1b2kgYXBwdW50aSB0cmFtaXRlIFNtYXJ0IENvbm5lY3Rpb25zLiBGYXRlbWkgdW5hIGRvbWFuZGEgc3VpIHZvc3RyaSBhcHB1bnRpIGUgY2VyY2hlclx1MDBGMiBkaSByaXNwb25kZXJ2aS5cIixcbiAgfSxcbn1cblxuLy8gcmVxdWlyZSBidWlsdC1pbiBjcnlwdG8gbW9kdWxlXG5jb25zdCBjcnlwdG8gPSByZXF1aXJlKFwiY3J5cHRvXCIpO1xuLy8gbWQ1IGhhc2ggdXNpbmcgYnVpbHQgaW4gY3J5cHRvIG1vZHVsZVxuZnVuY3Rpb24gbWQ1KHN0cikge1xuICByZXR1cm4gY3J5cHRvLmNyZWF0ZUhhc2goXCJtZDVcIikudXBkYXRlKHN0cikuZGlnZXN0KFwiaGV4XCIpO1xufVxuXG5jbGFzcyBTbWFydENvbm5lY3Rpb25zUGx1Z2luIGV4dGVuZHMgT2JzaWRpYW4uUGx1Z2luIHtcbiAgLy8gY29uc3RydWN0b3JcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoLi4uYXJndW1lbnRzKTtcbiAgICB0aGlzLmFwaSA9IG51bGw7XG4gICAgdGhpcy5lbWJlZGRpbmdzX2xvYWRlZCA9IGZhbHNlO1xuICAgIHRoaXMuZmlsZV9leGNsdXNpb25zID0gW107XG4gICAgdGhpcy5mb2xkZXJzID0gW107XG4gICAgdGhpcy5oYXNfbmV3X2VtYmVkZGluZ3MgPSBmYWxzZTtcbiAgICB0aGlzLmhlYWRlcl9leGNsdXNpb25zID0gW107XG4gICAgdGhpcy5uZWFyZXN0X2NhY2hlID0ge307XG4gICAgdGhpcy5wYXRoX29ubHkgPSBbXTtcbiAgICB0aGlzLnJlbmRlcl9sb2cgPSB7fTtcbiAgICB0aGlzLnJlbmRlcl9sb2cuZGVsZXRlZF9lbWJlZGRpbmdzID0gMDtcbiAgICB0aGlzLnJlbmRlcl9sb2cuZXhjbHVzaW9uc19sb2dzID0ge307XG4gICAgdGhpcy5yZW5kZXJfbG9nLmZhaWxlZF9lbWJlZGRpbmdzID0gW107XG4gICAgdGhpcy5yZW5kZXJfbG9nLmZpbGVzID0gW107XG4gICAgdGhpcy5yZW5kZXJfbG9nLm5ld19lbWJlZGRpbmdzID0gMDtcbiAgICB0aGlzLnJlbmRlcl9sb2cuc2tpcHBlZF9sb3dfZGVsdGEgPSB7fTtcbiAgICB0aGlzLnJlbmRlcl9sb2cudG9rZW5fdXNhZ2UgPSAwO1xuICAgIHRoaXMucmVuZGVyX2xvZy50b2tlbnNfc2F2ZWRfYnlfY2FjaGUgPSAwO1xuICAgIHRoaXMucmV0cnlfbm90aWNlX3RpbWVvdXQgPSBudWxsO1xuICAgIHRoaXMuc2F2ZV90aW1lb3V0ID0gbnVsbDtcbiAgICB0aGlzLnNjX2JyYW5kaW5nID0ge307XG4gICAgdGhpcy5zZWxmX3JlZl9rd19yZWdleCA9IG51bGw7XG4gICAgdGhpcy51cGRhdGVfYXZhaWxhYmxlID0gZmFsc2U7XG4gIH1cblxuICBhc3luYyBvbmxvYWQoKSB7XG4gICAgLy8gaW5pdGlhbGl6ZSB3aGVuIGxheW91dCBpcyByZWFkeVxuICAgIHRoaXMuYXBwLndvcmtzcGFjZS5vbkxheW91dFJlYWR5KHRoaXMuaW5pdGlhbGl6ZS5iaW5kKHRoaXMpKTtcbiAgfVxuICBvbnVubG9hZCgpIHtcbiAgICB0aGlzLm91dHB1dF9yZW5kZXJfbG9nKCk7XG4gICAgY29uc29sZS5sb2coXCJ1bmxvYWRpbmcgcGx1Z2luXCIpO1xuICB9XG4gIGFzeW5jIGluaXRpYWxpemUoKSB7XG4gICAgY29uc29sZS5sb2coXCJMb2FkaW5nIFNtYXJ0IENvbm5lY3Rpb25zIHBsdWdpblwiKTtcbiAgICBWRVJTSU9OID0gdGhpcy5tYW5pZmVzdC52ZXJzaW9uO1xuICAgIC8vIFZFUlNJT04gPSAnMS4wLjAnO1xuICAgIC8vIGNvbnNvbGUubG9nKFZFUlNJT04pO1xuICAgIGF3YWl0IHRoaXMubG9hZFNldHRpbmdzKCk7XG4gICAgLy8gcnVuIGFmdGVyIDMgc2Vjb25kc1xuICAgIHNldFRpbWVvdXQodGhpcy5jaGVja19mb3JfdXBkYXRlLmJpbmQodGhpcyksIDMwMDApO1xuICAgIC8vIHJ1biBjaGVjayBmb3IgdXBkYXRlIGV2ZXJ5IDMgaG91cnNcbiAgICBzZXRJbnRlcnZhbCh0aGlzLmNoZWNrX2Zvcl91cGRhdGUuYmluZCh0aGlzKSwgMTA4MDAwMDApO1xuXG4gICAgdGhpcy5hZGRJY29uKCk7XG4gICAgdGhpcy5hZGRDb21tYW5kKHtcbiAgICAgIGlkOiBcInNjLWZpbmQtbm90ZXNcIixcbiAgICAgIG5hbWU6IFwiRmluZDogTWFrZSBTbWFydCBDb25uZWN0aW9uc1wiLFxuICAgICAgaWNvbjogXCJwZW5jaWxfaWNvblwiLFxuICAgICAgaG90a2V5czogW10sXG4gICAgICAvLyBlZGl0b3JDYWxsYmFjazogYXN5bmMgKGVkaXRvcikgPT4ge1xuICAgICAgZWRpdG9yQ2FsbGJhY2s6IGFzeW5jIChlZGl0b3IpID0+IHtcbiAgICAgICAgaWYoZWRpdG9yLnNvbWV0aGluZ1NlbGVjdGVkKCkpIHtcbiAgICAgICAgICAvLyBnZXQgc2VsZWN0ZWQgdGV4dFxuICAgICAgICAgIGxldCBzZWxlY3RlZF90ZXh0ID0gZWRpdG9yLmdldFNlbGVjdGlvbigpO1xuICAgICAgICAgIC8vIHJlbmRlciBjb25uZWN0aW9ucyBmcm9tIHNlbGVjdGVkIHRleHRcbiAgICAgICAgICBhd2FpdCB0aGlzLm1ha2VfY29ubmVjdGlvbnMoc2VsZWN0ZWRfdGV4dCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy8gY2xlYXIgbmVhcmVzdF9jYWNoZSBvbiBtYW51YWwgY2FsbCB0byBtYWtlIGNvbm5lY3Rpb25zXG4gICAgICAgICAgdGhpcy5uZWFyZXN0X2NhY2hlID0ge307XG4gICAgICAgICAgLy8gY29uc29sZS5sb2coXCJDbGVhcmVkIG5lYXJlc3RfY2FjaGVcIik7XG4gICAgICAgICAgYXdhaXQgdGhpcy5tYWtlX2Nvbm5lY3Rpb25zKCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KTtcbiAgICB0aGlzLmFkZENvbW1hbmQoe1xuICAgICAgaWQ6IFwic21hcnQtY29ubmVjdGlvbnMtdmlld1wiLFxuICAgICAgbmFtZTogXCJPcGVuOiBWaWV3IFNtYXJ0IENvbm5lY3Rpb25zXCIsXG4gICAgICBjYWxsYmFjazogKCkgPT4ge1xuICAgICAgICB0aGlzLm9wZW5fdmlldygpO1xuICAgICAgfVxuICAgIH0pO1xuICAgIC8vIG9wZW4gY2hhdCBjb21tYW5kXG4gICAgdGhpcy5hZGRDb21tYW5kKHtcbiAgICAgIGlkOiBcInNtYXJ0LWNvbm5lY3Rpb25zLWNoYXRcIixcbiAgICAgIG5hbWU6IFwiT3BlbjogU21hcnQgQ2hhdCBDb252ZXJzYXRpb25cIixcbiAgICAgIGNhbGxiYWNrOiAoKSA9PiB7XG4gICAgICAgIHRoaXMub3Blbl9jaGF0KCk7XG4gICAgICB9XG4gICAgfSk7XG4gICAgLy8gb3BlbiByYW5kb20gbm90ZSBmcm9tIG5lYXJlc3QgY2FjaGVcbiAgICB0aGlzLmFkZENvbW1hbmQoe1xuICAgICAgaWQ6IFwic21hcnQtY29ubmVjdGlvbnMtcmFuZG9tXCIsXG4gICAgICBuYW1lOiBcIk9wZW46IFJhbmRvbSBOb3RlIGZyb20gU21hcnQgQ29ubmVjdGlvbnNcIixcbiAgICAgIGNhbGxiYWNrOiAoKSA9PiB7XG4gICAgICAgIHRoaXMub3Blbl9yYW5kb21fbm90ZSgpO1xuICAgICAgfVxuICAgIH0pO1xuICAgIC8vIGFkZCBzZXR0aW5ncyB0YWJcbiAgICB0aGlzLmFkZFNldHRpbmdUYWIobmV3IFNtYXJ0Q29ubmVjdGlvbnNTZXR0aW5nc1RhYih0aGlzLmFwcCwgdGhpcykpO1xuICAgIC8vIHJlZ2lzdGVyIG1haW4gdmlldyB0eXBlXG4gICAgdGhpcy5yZWdpc3RlclZpZXcoU01BUlRfQ09OTkVDVElPTlNfVklFV19UWVBFLCAobGVhZikgPT4gKG5ldyBTbWFydENvbm5lY3Rpb25zVmlldyhsZWFmLCB0aGlzKSkpO1xuICAgIC8vIHJlZ2lzdGVyIGNoYXQgdmlldyB0eXBlXG4gICAgdGhpcy5yZWdpc3RlclZpZXcoU01BUlRfQ09OTkVDVElPTlNfQ0hBVF9WSUVXX1RZUEUsIChsZWFmKSA9PiAobmV3IFNtYXJ0Q29ubmVjdGlvbnNDaGF0VmlldyhsZWFmLCB0aGlzKSkpO1xuICAgIC8vIGNvZGUtYmxvY2sgcmVuZGVyZXJcbiAgICB0aGlzLnJlZ2lzdGVyTWFya2Rvd25Db2RlQmxvY2tQcm9jZXNzb3IoXCJzbWFydC1jb25uZWN0aW9uc1wiLCB0aGlzLnJlbmRlcl9jb2RlX2Jsb2NrLmJpbmQodGhpcykpO1xuXG4gICAgLy8gaWYgdGhpcyBzZXR0aW5ncy52aWV3X29wZW4gaXMgdHJ1ZSwgb3BlbiB2aWV3IG9uIHN0YXJ0dXBcbiAgICBpZih0aGlzLnNldHRpbmdzLnZpZXdfb3Blbikge1xuICAgICAgdGhpcy5vcGVuX3ZpZXcoKTtcbiAgICB9XG4gICAgLy8gaWYgdGhpcyBzZXR0aW5ncy5jaGF0X29wZW4gaXMgdHJ1ZSwgb3BlbiBjaGF0IG9uIHN0YXJ0dXBcbiAgICBpZih0aGlzLnNldHRpbmdzLmNoYXRfb3Blbikge1xuICAgICAgdGhpcy5vcGVuX2NoYXQoKTtcbiAgICB9XG4gICAgLy8gb24gbmV3IHZlcnNpb25cbiAgICBpZih0aGlzLnNldHRpbmdzLnZlcnNpb24gIT09IFZFUlNJT04pIHtcbiAgICAgIHRoaXMuc2V0dGluZ3MuYmVzdF9uZXdfcGx1Z2luID0gZmFsc2U7XG4gICAgICAvLyB1cGRhdGUgdmVyc2lvblxuICAgICAgdGhpcy5zZXR0aW5ncy52ZXJzaW9uID0gVkVSU0lPTjtcbiAgICAgIC8vIHNhdmUgc2V0dGluZ3NcbiAgICAgIGF3YWl0IHRoaXMuc2F2ZVNldHRpbmdzKCk7XG4gICAgICAvLyBvcGVuIHZpZXdcbiAgICAgIHRoaXMub3Blbl92aWV3KCk7XG4gICAgfVxuICAgIC8vIGNoZWNrIGdpdGh1YiByZWxlYXNlIGVuZHBvaW50IGlmIHVwZGF0ZSBpcyBhdmFpbGFibGVcbiAgICB0aGlzLmFkZF90b19naXRpZ25vcmUoKTtcbiAgICAvKipcbiAgICAgKiBFWFBFUklNRU5UQUxcbiAgICAgKiAtIHdpbmRvdy1iYXNlZCBBUEkgYWNjZXNzXG4gICAgICogLSBjb2RlLWJsb2NrIHJlbmRlcmluZ1xuICAgICAqL1xuICAgIHRoaXMuYXBpID0gbmV3IFNjU2VhcmNoQXBpKHRoaXMuYXBwLCB0aGlzKTtcbiAgICAvLyByZWdpc3RlciBBUEkgdG8gZ2xvYmFsIHdpbmRvdyBvYmplY3RcbiAgICAod2luZG93W1wiU21hcnRTZWFyY2hBcGlcIl0gPSB0aGlzLmFwaSkgJiYgdGhpcy5yZWdpc3RlcigoKSA9PiBkZWxldGUgd2luZG93W1wiU21hcnRTZWFyY2hBcGlcIl0pO1xuICAgIFxuICB9XG5cbiAgYXN5bmMgaW5pdF92ZWNzKCkge1xuICAgIHRoaXMuc21hcnRfdmVjX2xpdGUgPSBuZXcgVmVjTGl0ZSh7XG4gICAgICBmb2xkZXJfcGF0aDogXCIuc21hcnQtY29ubmVjdGlvbnNcIixcbiAgICAgIGV4aXN0c19hZGFwdGVyOiB0aGlzLmFwcC52YXVsdC5hZGFwdGVyLmV4aXN0cy5iaW5kKHRoaXMuYXBwLnZhdWx0LmFkYXB0ZXIpLFxuICAgICAgbWtkaXJfYWRhcHRlcjogdGhpcy5hcHAudmF1bHQuYWRhcHRlci5ta2Rpci5iaW5kKHRoaXMuYXBwLnZhdWx0LmFkYXB0ZXIpLFxuICAgICAgcmVhZF9hZGFwdGVyOiB0aGlzLmFwcC52YXVsdC5hZGFwdGVyLnJlYWQuYmluZCh0aGlzLmFwcC52YXVsdC5hZGFwdGVyKSxcbiAgICAgIHJlbmFtZV9hZGFwdGVyOiB0aGlzLmFwcC52YXVsdC5hZGFwdGVyLnJlbmFtZS5iaW5kKHRoaXMuYXBwLnZhdWx0LmFkYXB0ZXIpLFxuICAgICAgc3RhdF9hZGFwdGVyOiB0aGlzLmFwcC52YXVsdC5hZGFwdGVyLnN0YXQuYmluZCh0aGlzLmFwcC52YXVsdC5hZGFwdGVyKSxcbiAgICAgIHdyaXRlX2FkYXB0ZXI6IHRoaXMuYXBwLnZhdWx0LmFkYXB0ZXIud3JpdGUuYmluZCh0aGlzLmFwcC52YXVsdC5hZGFwdGVyKSxcbiAgICB9KTtcbiAgICB0aGlzLmVtYmVkZGluZ3NfbG9hZGVkID0gYXdhaXQgdGhpcy5zbWFydF92ZWNfbGl0ZS5sb2FkKCk7XG4gICAgcmV0dXJuIHRoaXMuZW1iZWRkaW5nc19sb2FkZWQ7XG4gIH1cbiAgYXN5bmMgdXBkYXRlX3RvX3YyKCkge1xuICAgIC8vIGlmIGxpY2Vuc2Uga2V5IGlzIG5vdCBzZXQsIHJldHVyblxuICAgIGlmKCF0aGlzLnNldHRpbmdzLmxpY2Vuc2Vfa2V5KSByZXR1cm4gbmV3IE9ic2lkaWFuLk5vdGljZShcIltTbWFydCBDb25uZWN0aW9uc10gU3VwcG9ydGVyIGxpY2Vuc2Uga2V5IHJlcXVpcmVkIGZvciBlYXJseSBhY2Nlc3MgdG8gVjJcIik7XG4gICAgLy8gZG93bmxvYWQgaHR0cHM6Ly9naXRodWIuY29tL2JyaWFucGV0cm8vb2JzaWRpYW4tc21hcnQtY29ubmVjdGlvbnMvcmVsZWFzZXMvZG93bmxvYWQvMS42LjM3L21haW4uanNcbiAgICBjb25zdCB2MiA9IGF3YWl0ICgwLCBPYnNpZGlhbi5yZXF1ZXN0VXJsKSh7XG4gICAgICB1cmw6IFwiaHR0cHM6Ly9zeW5jLnNtYXJ0Y29ubmVjdGlvbnMuYXBwL2Rvd25sb2FkX3YyXCIsXG4gICAgICBtZXRob2Q6IFwiUE9TVFwiLFxuICAgICAgaGVhZGVyczoge1xuICAgICAgICBcIkNvbnRlbnQtVHlwZVwiOiBcImFwcGxpY2F0aW9uL2pzb25cIixcbiAgICAgIH0sXG4gICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgIGxpY2Vuc2Vfa2V5OiB0aGlzLnNldHRpbmdzLmxpY2Vuc2Vfa2V5LFxuICAgICAgfSlcbiAgICB9KTtcbiAgICBpZih2Mi5zdGF0dXMgIT09IDIwMCkgcmV0dXJuIGNvbnNvbGUuZXJyb3IoXCJFcnJvciBkb3dubG9hZGluZyB2ZXJzaW9uIDJcIiwgdjIpO1xuICAgIGNvbnNvbGUubG9nKHYyKTtcbiAgICBhd2FpdCB0aGlzLmFwcC52YXVsdC5hZGFwdGVyLndyaXRlKFwiLm9ic2lkaWFuL3BsdWdpbnMvc21hcnQtY29ubmVjdGlvbnMvbWFpbi5qc1wiLCB2Mi5qc29uLm1haW4pOyAvLyBhZGQgbmV3XG4gICAgYXdhaXQgdGhpcy5hcHAudmF1bHQuYWRhcHRlci53cml0ZShcIi5vYnNpZGlhbi9wbHVnaW5zL3NtYXJ0LWNvbm5lY3Rpb25zL21hbmlmZXN0Lmpzb25cIiwgdjIuanNvbi5tYW5pZmVzdCk7IC8vIGFkZCBuZXdcbiAgICBhd2FpdCB0aGlzLmFwcC52YXVsdC5hZGFwdGVyLndyaXRlKFwiLm9ic2lkaWFuL3BsdWdpbnMvc21hcnQtY29ubmVjdGlvbnMvc3R5bGVzLmNzc1wiLCB2Mi5qc29uLnN0eWxlcyk7IC8vIGFkZCBuZXdcbiAgICB3aW5kb3cucmVzdGFydF9wbHVnaW4gPSBhc3luYyAoaWQpID0+IHtcbiAgICAgIGNvbnNvbGUubG9nKFwicmVzdGFydGluZyBwbHVnaW5cIiwgaWQpO1xuICAgICAgYXdhaXQgd2luZG93LmFwcC5wbHVnaW5zLmRpc2FibGVQbHVnaW4oaWQpO1xuICAgICAgYXdhaXQgd2luZG93LmFwcC5wbHVnaW5zLmVuYWJsZVBsdWdpbihpZCk7XG4gICAgICBjb25zb2xlLmxvZyhcInBsdWdpbiByZXN0YXJ0ZWRcIiwgaWQpO1xuICAgIH1cbiAgICB3aW5kb3cucmVzdGFydF9wbHVnaW4odGhpcy5tYW5pZmVzdC5pZCk7XG4gIH1cblxuICBhc3luYyBsb2FkU2V0dGluZ3MoKSB7XG4gICAgdGhpcy5zZXR0aW5ncyA9IE9iamVjdC5hc3NpZ24oe30sIERFRkFVTFRfU0VUVElOR1MsIGF3YWl0IHRoaXMubG9hZERhdGEoKSk7XG4gICAgLy8gbG9hZCBmaWxlIGV4Y2x1c2lvbnMgaWYgbm90IGJsYW5rXG4gICAgaWYodGhpcy5zZXR0aW5ncy5maWxlX2V4Y2x1c2lvbnMgJiYgdGhpcy5zZXR0aW5ncy5maWxlX2V4Y2x1c2lvbnMubGVuZ3RoID4gMCkge1xuICAgICAgLy8gc3BsaXQgZmlsZSBleGNsdXNpb25zIGludG8gYXJyYXkgYW5kIHRyaW0gd2hpdGVzcGFjZVxuICAgICAgdGhpcy5maWxlX2V4Y2x1c2lvbnMgPSB0aGlzLnNldHRpbmdzLmZpbGVfZXhjbHVzaW9ucy5zcGxpdChcIixcIikubWFwKChmaWxlKSA9PiB7XG4gICAgICAgIHJldHVybiBmaWxlLnRyaW0oKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgICAvLyBsb2FkIGZvbGRlciBleGNsdXNpb25zIGlmIG5vdCBibGFua1xuICAgIGlmKHRoaXMuc2V0dGluZ3MuZm9sZGVyX2V4Y2x1c2lvbnMgJiYgdGhpcy5zZXR0aW5ncy5mb2xkZXJfZXhjbHVzaW9ucy5sZW5ndGggPiAwKSB7XG4gICAgICAvLyBhZGQgc2xhc2ggdG8gZW5kIG9mIGZvbGRlciBuYW1lIGlmIG5vdCBwcmVzZW50XG4gICAgICBjb25zdCBmb2xkZXJfZXhjbHVzaW9ucyA9IHRoaXMuc2V0dGluZ3MuZm9sZGVyX2V4Y2x1c2lvbnMuc3BsaXQoXCIsXCIpLm1hcCgoZm9sZGVyKSA9PiB7XG4gICAgICAgIC8vIHRyaW0gd2hpdGVzcGFjZVxuICAgICAgICBmb2xkZXIgPSBmb2xkZXIudHJpbSgpO1xuICAgICAgICBpZihmb2xkZXIuc2xpY2UoLTEpICE9PSBcIi9cIikge1xuICAgICAgICAgIHJldHVybiBmb2xkZXIgKyBcIi9cIjtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXR1cm4gZm9sZGVyO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICAgIC8vIG1lcmdlIGZvbGRlciBleGNsdXNpb25zIHdpdGggZmlsZSBleGNsdXNpb25zXG4gICAgICB0aGlzLmZpbGVfZXhjbHVzaW9ucyA9IHRoaXMuZmlsZV9leGNsdXNpb25zLmNvbmNhdChmb2xkZXJfZXhjbHVzaW9ucyk7XG4gICAgfVxuICAgIC8vIGxvYWQgaGVhZGVyIGV4Y2x1c2lvbnMgaWYgbm90IGJsYW5rXG4gICAgaWYodGhpcy5zZXR0aW5ncy5oZWFkZXJfZXhjbHVzaW9ucyAmJiB0aGlzLnNldHRpbmdzLmhlYWRlcl9leGNsdXNpb25zLmxlbmd0aCA+IDApIHtcbiAgICAgIHRoaXMuaGVhZGVyX2V4Y2x1c2lvbnMgPSB0aGlzLnNldHRpbmdzLmhlYWRlcl9leGNsdXNpb25zLnNwbGl0KFwiLFwiKS5tYXAoKGhlYWRlcikgPT4ge1xuICAgICAgICByZXR1cm4gaGVhZGVyLnRyaW0oKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgICAvLyBsb2FkIHBhdGhfb25seSBpZiBub3QgYmxhbmtcbiAgICBpZih0aGlzLnNldHRpbmdzLnBhdGhfb25seSAmJiB0aGlzLnNldHRpbmdzLnBhdGhfb25seS5sZW5ndGggPiAwKSB7XG4gICAgICB0aGlzLnBhdGhfb25seSA9IHRoaXMuc2V0dGluZ3MucGF0aF9vbmx5LnNwbGl0KFwiLFwiKS5tYXAoKHBhdGgpID0+IHtcbiAgICAgICAgcmV0dXJuIHBhdGgudHJpbSgpO1xuICAgICAgfSk7XG4gICAgfVxuICAgIC8vIGxvYWQgc2VsZl9yZWZfa3dfcmVnZXhcbiAgICB0aGlzLnNlbGZfcmVmX2t3X3JlZ2V4ID0gbmV3IFJlZ0V4cChgXFxcXGIoJHtTTUFSVF9UUkFOU0xBVElPTlt0aGlzLnNldHRpbmdzLmxhbmd1YWdlXS5wcm9ub3VzLmpvaW4oXCJ8XCIpfSlcXFxcYmAsIFwiZ2lcIik7XG4gICAgLy8gbG9hZCBmYWlsZWQgZmlsZXNcbiAgICBhd2FpdCB0aGlzLmxvYWRfZmFpbGVkX2ZpbGVzKCk7XG4gIH1cbiAgYXN5bmMgc2F2ZVNldHRpbmdzKHJlcmVuZGVyPWZhbHNlKSB7XG4gICAgYXdhaXQgdGhpcy5zYXZlRGF0YSh0aGlzLnNldHRpbmdzKTtcbiAgICAvLyByZS1sb2FkIHNldHRpbmdzIGludG8gbWVtb3J5XG4gICAgYXdhaXQgdGhpcy5sb2FkU2V0dGluZ3MoKTtcbiAgICAvLyByZS1yZW5kZXIgdmlldyBpZiBzZXQgdG8gdHJ1ZSAoZm9yIGV4YW1wbGUsIGFmdGVyIGFkZGluZyBBUEkga2V5KVxuICAgIGlmKHJlcmVuZGVyKSB7XG4gICAgICB0aGlzLm5lYXJlc3RfY2FjaGUgPSB7fTtcbiAgICAgIGF3YWl0IHRoaXMubWFrZV9jb25uZWN0aW9ucygpO1xuICAgIH1cbiAgfVxuXG4gIC8vIGNoZWNrIGZvciB1cGRhdGVcbiAgYXN5bmMgY2hlY2tfZm9yX3VwZGF0ZSgpIHtcbiAgICAvLyBmYWlsIHNpbGVudGx5LCBleC4gaWYgbm8gaW50ZXJuZXQgY29ubmVjdGlvblxuICAgIHRyeSB7XG4gICAgICAvLyBnZXQgbGF0ZXN0IHJlbGVhc2UgdmVyc2lvbiBmcm9tIGdpdGh1YlxuICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCAoMCwgT2JzaWRpYW4ucmVxdWVzdFVybCkoe1xuICAgICAgICB1cmw6IFwiaHR0cHM6Ly9hcGkuZ2l0aHViLmNvbS9yZXBvcy9icmlhbnBldHJvL29ic2lkaWFuLXNtYXJ0LWNvbm5lY3Rpb25zL3JlbGVhc2VzL2xhdGVzdFwiLFxuICAgICAgICBtZXRob2Q6IFwiR0VUXCIsXG4gICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICBcIkNvbnRlbnQtVHlwZVwiOiBcImFwcGxpY2F0aW9uL2pzb25cIixcbiAgICAgICAgfSxcbiAgICAgICAgY29udGVudFR5cGU6IFwiYXBwbGljYXRpb24vanNvblwiLFxuICAgICAgfSk7XG4gICAgICAvLyBnZXQgdmVyc2lvbiBudW1iZXIgZnJvbSByZXNwb25zZVxuICAgICAgY29uc3QgbGF0ZXN0X3JlbGVhc2UgPSBKU09OLnBhcnNlKHJlc3BvbnNlLnRleHQpLnRhZ19uYW1lO1xuICAgICAgLy8gY29uc29sZS5sb2coYExhdGVzdCByZWxlYXNlOiAke2xhdGVzdF9yZWxlYXNlfWApO1xuICAgICAgLy8gaWYgbGF0ZXN0X3JlbGVhc2UgaXMgbmV3ZXIgdGhhbiBjdXJyZW50IHZlcnNpb24sIHNob3cgbWVzc2FnZVxuICAgICAgaWYobGF0ZXN0X3JlbGVhc2UgIT09IFZFUlNJT04pIHtcbiAgICAgICAgbmV3IE9ic2lkaWFuLk5vdGljZShgW1NtYXJ0IENvbm5lY3Rpb25zXSBBIG5ldyB2ZXJzaW9uIGlzIGF2YWlsYWJsZSEgKHYke2xhdGVzdF9yZWxlYXNlfSlgKTtcbiAgICAgICAgdGhpcy51cGRhdGVfYXZhaWxhYmxlID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5yZW5kZXJfYnJhbmQoXCJhbGxcIilcbiAgICAgIH1cbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5sb2coZXJyb3IpO1xuICAgIH1cbiAgfVxuXG4gIGFzeW5jIHJlbmRlcl9jb2RlX2Jsb2NrKGNvbnRlbnRzLCBjb250YWluZXIsIGN0eCkge1xuICAgIGxldCBuZWFyZXN0O1xuICAgIGlmKGNvbnRlbnRzLnRyaW0oKS5sZW5ndGggPiAwKSB7XG4gICAgICBuZWFyZXN0ID0gYXdhaXQgdGhpcy5hcGkuc2VhcmNoKGNvbnRlbnRzKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gdXNlIGN0eCB0byBnZXQgZmlsZVxuICAgICAgY29uc29sZS5sb2coY3R4KTtcbiAgICAgIGNvbnN0IGZpbGUgPSB0aGlzLmFwcC52YXVsdC5nZXRBYnN0cmFjdEZpbGVCeVBhdGgoY3R4LnNvdXJjZVBhdGgpO1xuICAgICAgbmVhcmVzdCA9IGF3YWl0IHRoaXMuZmluZF9ub3RlX2Nvbm5lY3Rpb25zKGZpbGUpO1xuICAgIH1cbiAgICBpZiAobmVhcmVzdC5sZW5ndGgpIHtcbiAgICAgIHRoaXMudXBkYXRlX3Jlc3VsdHMoY29udGFpbmVyLCBuZWFyZXN0KTtcbiAgICB9XG4gIH1cblxuICBhc3luYyBtYWtlX2Nvbm5lY3Rpb25zKHNlbGVjdGVkX3RleHQ9bnVsbCkge1xuICAgIGxldCB2aWV3ID0gdGhpcy5nZXRfdmlldygpO1xuICAgIGlmICghdmlldykge1xuICAgICAgLy8gb3BlbiB2aWV3IGlmIG5vdCBvcGVuXG4gICAgICBhd2FpdCB0aGlzLm9wZW5fdmlldygpO1xuICAgICAgdmlldyA9IHRoaXMuZ2V0X3ZpZXcoKTtcbiAgICB9XG4gICAgYXdhaXQgdmlldy5yZW5kZXJfY29ubmVjdGlvbnMoc2VsZWN0ZWRfdGV4dCk7XG4gIH1cblxuICBhZGRJY29uKCl7XG4gICAgT2JzaWRpYW4uYWRkSWNvbihcInNtYXJ0LWNvbm5lY3Rpb25zXCIsIGA8cGF0aCBkPVwiTTUwLDIwIEw4MCw0MCBMODAsNjAgTDUwLDEwMFwiIHN0cm9rZT1cImN1cnJlbnRDb2xvclwiIHN0cm9rZS13aWR0aD1cIjRcIiBmaWxsPVwibm9uZVwiLz5cbiAgICA8cGF0aCBkPVwiTTMwLDUwIEw1NSw3MFwiIHN0cm9rZT1cImN1cnJlbnRDb2xvclwiIHN0cm9rZS13aWR0aD1cIjVcIiBmaWxsPVwibm9uZVwiLz5cbiAgICA8Y2lyY2xlIGN4PVwiNTBcIiBjeT1cIjIwXCIgcj1cIjlcIiBmaWxsPVwiY3VycmVudENvbG9yXCIvPlxuICAgIDxjaXJjbGUgY3g9XCI4MFwiIGN5PVwiNDBcIiByPVwiOVwiIGZpbGw9XCJjdXJyZW50Q29sb3JcIi8+XG4gICAgPGNpcmNsZSBjeD1cIjgwXCIgY3k9XCI3MFwiIHI9XCI5XCIgZmlsbD1cImN1cnJlbnRDb2xvclwiLz5cbiAgICA8Y2lyY2xlIGN4PVwiNTBcIiBjeT1cIjEwMFwiIHI9XCI5XCIgZmlsbD1cImN1cnJlbnRDb2xvclwiLz5cbiAgICA8Y2lyY2xlIGN4PVwiMzBcIiBjeT1cIjUwXCIgcj1cIjlcIiBmaWxsPVwiY3VycmVudENvbG9yXCIvPmApO1xuICB9XG5cbiAgLy8gb3BlbiByYW5kb20gbm90ZVxuICBhc3luYyBvcGVuX3JhbmRvbV9ub3RlKCkge1xuICAgIGNvbnN0IGN1cnJfZmlsZSA9IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRBY3RpdmVGaWxlKCk7XG4gICAgY29uc3QgY3Vycl9rZXkgPSBtZDUoY3Vycl9maWxlLnBhdGgpO1xuICAgIC8vIGlmIG5vIG5lYXJlc3QgY2FjaGUsIGNyZWF0ZSBPYnNpZGlhbiBub3RpY2VcbiAgICBpZih0eXBlb2YgdGhpcy5uZWFyZXN0X2NhY2hlW2N1cnJfa2V5XSA9PT0gXCJ1bmRlZmluZWRcIikge1xuICAgICAgbmV3IE9ic2lkaWFuLk5vdGljZShcIltTbWFydCBDb25uZWN0aW9uc10gTm8gU21hcnQgQ29ubmVjdGlvbnMgZm91bmQuIE9wZW4gYSBub3RlIHRvIGdldCBTbWFydCBDb25uZWN0aW9ucy5cIik7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIC8vIGdldCByYW5kb20gZnJvbSBuZWFyZXN0IGNhY2hlXG4gICAgY29uc3QgcmFuZCA9IE1hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIHRoaXMubmVhcmVzdF9jYWNoZVtjdXJyX2tleV0ubGVuZ3RoLzIpOyAvLyBkaXZpZGUgYnkgMiB0byBsaW1pdCB0byB0b3AgaGFsZiBvZiByZXN1bHRzXG4gICAgY29uc3QgcmFuZG9tX2ZpbGUgPSB0aGlzLm5lYXJlc3RfY2FjaGVbY3Vycl9rZXldW3JhbmRdO1xuICAgIC8vIG9wZW4gcmFuZG9tIGZpbGVcbiAgICB0aGlzLm9wZW5fbm90ZShyYW5kb21fZmlsZSk7XG4gIH1cblxuICBhc3luYyBvcGVuX3ZpZXcoKSB7XG4gICAgaWYodGhpcy5nZXRfdmlldygpKXtcbiAgICAgIGNvbnNvbGUubG9nKFwiU21hcnQgQ29ubmVjdGlvbnMgdmlldyBhbHJlYWR5IG9wZW5cIik7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIHRoaXMuYXBwLndvcmtzcGFjZS5kZXRhY2hMZWF2ZXNPZlR5cGUoU01BUlRfQ09OTkVDVElPTlNfVklFV19UWVBFKTtcbiAgICBhd2FpdCB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0UmlnaHRMZWFmKGZhbHNlKS5zZXRWaWV3U3RhdGUoe1xuICAgICAgdHlwZTogU01BUlRfQ09OTkVDVElPTlNfVklFV19UWVBFLFxuICAgICAgYWN0aXZlOiB0cnVlLFxuICAgIH0pO1xuICAgIHRoaXMuYXBwLndvcmtzcGFjZS5yZXZlYWxMZWFmKFxuICAgICAgdGhpcy5hcHAud29ya3NwYWNlLmdldExlYXZlc09mVHlwZShTTUFSVF9DT05ORUNUSU9OU19WSUVXX1RZUEUpWzBdXG4gICAgKTtcbiAgfVxuICAvLyBzb3VyY2U6IGh0dHBzOi8vZ2l0aHViLmNvbS9vYnNpZGlhbm1kL29ic2lkaWFuLXJlbGVhc2VzL2Jsb2IvbWFzdGVyL3BsdWdpbi1yZXZpZXcubWQjYXZvaWQtbWFuYWdpbmctcmVmZXJlbmNlcy10by1jdXN0b20tdmlld3NcbiAgZ2V0X3ZpZXcoKSB7XG4gICAgZm9yIChsZXQgbGVhZiBvZiB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0TGVhdmVzT2ZUeXBlKFNNQVJUX0NPTk5FQ1RJT05TX1ZJRVdfVFlQRSkpIHtcbiAgICAgIGlmIChsZWFmLnZpZXcgaW5zdGFuY2VvZiBTbWFydENvbm5lY3Rpb25zVmlldykge1xuICAgICAgICByZXR1cm4gbGVhZi52aWV3O1xuICAgICAgfVxuICAgIH1cbiAgfVxuICAvLyBvcGVuIGNoYXQgdmlld1xuICBhc3luYyBvcGVuX2NoYXQocmV0cmllcz0wKSB7XG4gICAgaWYoIXRoaXMuZW1iZWRkaW5nc19sb2FkZWQpIHtcbiAgICAgIGNvbnNvbGUubG9nKFwiZW1iZWRkaW5ncyBub3QgbG9hZGVkIHlldFwiKTtcbiAgICAgIGlmKHJldHJpZXMgPCAzKSB7XG4gICAgICAgIC8vIHdhaXQgYW5kIHRyeSBhZ2FpblxuICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgICB0aGlzLm9wZW5fY2hhdChyZXRyaWVzKzEpO1xuICAgICAgICB9LCAxMDAwICogKHJldHJpZXMrMSkpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBjb25zb2xlLmxvZyhcImVtYmVkZGluZ3Mgc3RpbGwgbm90IGxvYWRlZCwgb3BlbmluZyBzbWFydCB2aWV3XCIpO1xuICAgICAgdGhpcy5vcGVuX3ZpZXcoKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgdGhpcy5hcHAud29ya3NwYWNlLmRldGFjaExlYXZlc09mVHlwZShTTUFSVF9DT05ORUNUSU9OU19DSEFUX1ZJRVdfVFlQRSk7XG4gICAgYXdhaXQgdGhpcy5hcHAud29ya3NwYWNlLmdldFJpZ2h0TGVhZihmYWxzZSkuc2V0Vmlld1N0YXRlKHtcbiAgICAgIHR5cGU6IFNNQVJUX0NPTk5FQ1RJT05TX0NIQVRfVklFV19UWVBFLFxuICAgICAgYWN0aXZlOiB0cnVlLFxuICAgIH0pO1xuICAgIHRoaXMuYXBwLndvcmtzcGFjZS5yZXZlYWxMZWFmKFxuICAgICAgdGhpcy5hcHAud29ya3NwYWNlLmdldExlYXZlc09mVHlwZShTTUFSVF9DT05ORUNUSU9OU19DSEFUX1ZJRVdfVFlQRSlbMF1cbiAgICApO1xuICB9XG4gIFxuICAvLyBnZXQgZW1iZWRkaW5ncyBmb3IgYWxsIGZpbGVzXG4gIGFzeW5jIGdldF9hbGxfZW1iZWRkaW5ncygpIHtcbiAgICAvLyBnZXQgYWxsIGZpbGVzIGluIHZhdWx0IGFuZCBmaWx0ZXIgYWxsIGJ1dCBtYXJrZG93biBhbmQgY2FudmFzIGZpbGVzXG4gICAgY29uc3QgZmlsZXMgPSAoYXdhaXQgdGhpcy5hcHAudmF1bHQuZ2V0RmlsZXMoKSkuZmlsdGVyKChmaWxlKSA9PiBmaWxlIGluc3RhbmNlb2YgT2JzaWRpYW4uVEZpbGUgJiYgKGZpbGUuZXh0ZW5zaW9uID09PSBcIm1kXCIgfHwgZmlsZS5leHRlbnNpb24gPT09IFwiY2FudmFzXCIpKTtcbiAgICAvLyBjb25zdCBmaWxlcyA9IGF3YWl0IHRoaXMuYXBwLnZhdWx0LmdldE1hcmtkb3duRmlsZXMoKTtcbiAgICAvLyBnZXQgb3BlbiBmaWxlcyB0byBza2lwIGlmIGZpbGUgaXMgY3VycmVudGx5IG9wZW5cbiAgICBjb25zdCBvcGVuX2ZpbGVzID0gdGhpcy5hcHAud29ya3NwYWNlLmdldExlYXZlc09mVHlwZShcIm1hcmtkb3duXCIpLm1hcCgobGVhZikgPT4gbGVhZi52aWV3LmZpbGUpO1xuICAgIGNvbnN0IGNsZWFuX3VwX2xvZyA9IHRoaXMuc21hcnRfdmVjX2xpdGUuY2xlYW5fdXBfZW1iZWRkaW5ncyhmaWxlcyk7XG4gICAgaWYodGhpcy5zZXR0aW5ncy5sb2dfcmVuZGVyKXtcbiAgICAgIHRoaXMucmVuZGVyX2xvZy50b3RhbF9maWxlcyA9IGZpbGVzLmxlbmd0aDtcbiAgICAgIHRoaXMucmVuZGVyX2xvZy5kZWxldGVkX2VtYmVkZGluZ3MgPSBjbGVhbl91cF9sb2cuZGVsZXRlZF9lbWJlZGRpbmdzO1xuICAgICAgdGhpcy5yZW5kZXJfbG9nLnRvdGFsX2VtYmVkZGluZ3MgPSBjbGVhbl91cF9sb2cudG90YWxfZW1iZWRkaW5ncztcbiAgICB9XG4gICAgLy8gYmF0Y2ggZW1iZWRkaW5nc1xuICAgIGxldCBiYXRjaF9wcm9taXNlcyA9IFtdO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZmlsZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgIC8vIHNraXAgaWYgcGF0aCBjb250YWlucyBhICNcbiAgICAgIGlmKGZpbGVzW2ldLnBhdGguaW5kZXhPZihcIiNcIikgPiAtMSkge1xuICAgICAgICAvLyBjb25zb2xlLmxvZyhcInNraXBwaW5nIGZpbGUgJ1wiK2ZpbGVzW2ldLnBhdGgrXCInIChwYXRoIGNvbnRhaW5zICMpXCIpO1xuICAgICAgICB0aGlzLmxvZ19leGNsdXNpb24oXCJwYXRoIGNvbnRhaW5zICNcIik7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgICAgLy8gc2tpcCBpZiBmaWxlIGFscmVhZHkgaGFzIGVtYmVkZGluZyBhbmQgZW1iZWRkaW5nLm10aW1lIGlzIGdyZWF0ZXIgdGhhbiBvciBlcXVhbCB0byBmaWxlLm10aW1lXG4gICAgICBpZih0aGlzLnNtYXJ0X3ZlY19saXRlLm10aW1lX2lzX2N1cnJlbnQobWQ1KGZpbGVzW2ldLnBhdGgpLCBmaWxlc1tpXS5zdGF0Lm10aW1lKSkge1xuICAgICAgICAvLyBsb2cgc2tpcHBpbmcgZmlsZVxuICAgICAgICAvLyBjb25zb2xlLmxvZyhcInNraXBwaW5nIGZpbGUgKG10aW1lKVwiKTtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgICAvLyBjaGVjayBpZiBmaWxlIGlzIGluIGZhaWxlZF9maWxlc1xuICAgICAgaWYodGhpcy5zZXR0aW5ncy5mYWlsZWRfZmlsZXMuaW5kZXhPZihmaWxlc1tpXS5wYXRoKSA+IC0xKSB7XG4gICAgICAgIC8vIGxvZyBza2lwcGluZyBmaWxlXG4gICAgICAgIC8vIGNvbnNvbGUubG9nKFwic2tpcHBpbmcgcHJldmlvdXNseSBmYWlsZWQgZmlsZSwgdXNlIGJ1dHRvbiBpbiBzZXR0aW5ncyB0byByZXRyeVwiKTtcbiAgICAgICAgLy8gdXNlIHNldFRpbWVvdXQgdG8gcHJldmVudCBtdWx0aXBsZSBub3RpY2VzXG4gICAgICAgIGlmKHRoaXMucmV0cnlfbm90aWNlX3RpbWVvdXQpIHtcbiAgICAgICAgICBjbGVhclRpbWVvdXQodGhpcy5yZXRyeV9ub3RpY2VfdGltZW91dCk7XG4gICAgICAgICAgdGhpcy5yZXRyeV9ub3RpY2VfdGltZW91dCA9IG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgLy8gbGltaXQgdG8gb25lIG5vdGljZSBldmVyeSAxMCBtaW51dGVzXG4gICAgICAgIGlmKCF0aGlzLnJlY2VudGx5X3NlbnRfcmV0cnlfbm90aWNlKXtcbiAgICAgICAgICBuZXcgT2JzaWRpYW4uTm90aWNlKFwiU21hcnQgQ29ubmVjdGlvbnM6IFNraXBwaW5nIHByZXZpb3VzbHkgZmFpbGVkIGZpbGUsIHVzZSBidXR0b24gaW4gc2V0dGluZ3MgdG8gcmV0cnlcIik7XG4gICAgICAgICAgdGhpcy5yZWNlbnRseV9zZW50X3JldHJ5X25vdGljZSA9IHRydWU7XG4gICAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgICAgICB0aGlzLnJlY2VudGx5X3NlbnRfcmV0cnlfbm90aWNlID0gZmFsc2U7ICBcbiAgICAgICAgICB9LCA2MDAwMDApO1xuICAgICAgICB9XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgICAgLy8gc2tpcCBmaWxlcyB3aGVyZSBwYXRoIGNvbnRhaW5zIGFueSBleGNsdXNpb25zXG4gICAgICBsZXQgc2tpcCA9IGZhbHNlO1xuICAgICAgZm9yKGxldCBqID0gMDsgaiA8IHRoaXMuZmlsZV9leGNsdXNpb25zLmxlbmd0aDsgaisrKSB7XG4gICAgICAgIGlmKGZpbGVzW2ldLnBhdGguaW5kZXhPZih0aGlzLmZpbGVfZXhjbHVzaW9uc1tqXSkgPiAtMSkge1xuICAgICAgICAgIHNraXAgPSB0cnVlO1xuICAgICAgICAgIHRoaXMubG9nX2V4Y2x1c2lvbih0aGlzLmZpbGVfZXhjbHVzaW9uc1tqXSk7XG4gICAgICAgICAgLy8gYnJlYWsgb3V0IG9mIGxvb3BcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYoc2tpcCkge1xuICAgICAgICBjb250aW51ZTsgLy8gdG8gbmV4dCBmaWxlXG4gICAgICB9XG4gICAgICAvLyBjaGVjayBpZiBmaWxlIGlzIG9wZW5cbiAgICAgIGlmKG9wZW5fZmlsZXMuaW5kZXhPZihmaWxlc1tpXSkgPiAtMSkge1xuICAgICAgICAvLyBjb25zb2xlLmxvZyhcInNraXBwaW5nIGZpbGUgKG9wZW4pXCIpO1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIHRyeSB7XG4gICAgICAgIC8vIHB1c2ggcHJvbWlzZSB0byBiYXRjaF9wcm9taXNlc1xuICAgICAgICBiYXRjaF9wcm9taXNlcy5wdXNoKHRoaXMuZ2V0X2ZpbGVfZW1iZWRkaW5ncyhmaWxlc1tpXSwgZmFsc2UpKTtcbiAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGVycm9yKTtcbiAgICAgIH1cbiAgICAgIC8vIGlmIGJhdGNoX3Byb21pc2VzIGxlbmd0aCBpcyAxMFxuICAgICAgaWYoYmF0Y2hfcHJvbWlzZXMubGVuZ3RoID4gMykge1xuICAgICAgICAvLyB3YWl0IGZvciBhbGwgcHJvbWlzZXMgdG8gcmVzb2x2ZVxuICAgICAgICBhd2FpdCBQcm9taXNlLmFsbChiYXRjaF9wcm9taXNlcyk7XG4gICAgICAgIC8vIGNsZWFyIGJhdGNoX3Byb21pc2VzXG4gICAgICAgIGJhdGNoX3Byb21pc2VzID0gW107XG4gICAgICB9XG5cbiAgICAgIC8vIHNhdmUgZW1iZWRkaW5ncyBKU09OIHRvIGZpbGUgZXZlcnkgMTAwIGZpbGVzIHRvIHNhdmUgcHJvZ3Jlc3Mgb24gYnVsayBlbWJlZGRpbmdcbiAgICAgIGlmKGkgPiAwICYmIGkgJSAxMDAgPT09IDApIHtcbiAgICAgICAgYXdhaXQgdGhpcy5zYXZlX2VtYmVkZGluZ3NfdG9fZmlsZSgpO1xuICAgICAgfVxuICAgIH1cbiAgICAvLyB3YWl0IGZvciBhbGwgcHJvbWlzZXMgdG8gcmVzb2x2ZVxuICAgIGF3YWl0IFByb21pc2UuYWxsKGJhdGNoX3Byb21pc2VzKTtcbiAgICAvLyB3cml0ZSBlbWJlZGRpbmdzIEpTT04gdG8gZmlsZVxuICAgIGF3YWl0IHRoaXMuc2F2ZV9lbWJlZGRpbmdzX3RvX2ZpbGUoKTtcbiAgICAvLyBpZiByZW5kZXJfbG9nLmZhaWxlZF9lbWJlZGRpbmdzIHRoZW4gdXBkYXRlIGZhaWxlZF9lbWJlZGRpbmdzLnR4dFxuICAgIGlmKHRoaXMucmVuZGVyX2xvZy5mYWlsZWRfZW1iZWRkaW5ncy5sZW5ndGggPiAwKSB7XG4gICAgICBhd2FpdCB0aGlzLnNhdmVfZmFpbGVkX2VtYmVkZGluZ3MoKTtcbiAgICB9XG4gIH1cblxuICBhc3luYyBzYXZlX2VtYmVkZGluZ3NfdG9fZmlsZShmb3JjZT1mYWxzZSkge1xuICAgIGlmKCF0aGlzLmhhc19uZXdfZW1iZWRkaW5ncyl7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIC8vIGNvbnNvbGUubG9nKFwibmV3IGVtYmVkZGluZ3MsIHNhdmluZyB0byBmaWxlXCIpO1xuICAgIGlmKCFmb3JjZSkge1xuICAgICAgLy8gcHJldmVudCBleGNlc3NpdmUgd3JpdGVzIHRvIGVtYmVkZGluZ3MgZmlsZSBieSB3YWl0aW5nIDEgbWludXRlIGJlZm9yZSB3cml0aW5nXG4gICAgICBpZih0aGlzLnNhdmVfdGltZW91dCkge1xuICAgICAgICBjbGVhclRpbWVvdXQodGhpcy5zYXZlX3RpbWVvdXQpO1xuICAgICAgICB0aGlzLnNhdmVfdGltZW91dCA9IG51bGw7ICBcbiAgICAgIH1cbiAgICAgIHRoaXMuc2F2ZV90aW1lb3V0ID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgIC8vIGNvbnNvbGUubG9nKFwid3JpdGluZyBlbWJlZGRpbmdzIHRvIGZpbGVcIik7XG4gICAgICAgIHRoaXMuc2F2ZV9lbWJlZGRpbmdzX3RvX2ZpbGUodHJ1ZSk7XG4gICAgICAgIC8vIGNsZWFyIHRpbWVvdXRcbiAgICAgICAgaWYodGhpcy5zYXZlX3RpbWVvdXQpIHtcbiAgICAgICAgICBjbGVhclRpbWVvdXQodGhpcy5zYXZlX3RpbWVvdXQpO1xuICAgICAgICAgIHRoaXMuc2F2ZV90aW1lb3V0ID0gbnVsbDtcbiAgICAgICAgfVxuICAgICAgfSwgMzAwMDApO1xuICAgICAgY29uc29sZS5sb2coXCJzY2hlZHVsZWQgc2F2ZVwiKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0cnl7XG4gICAgICAvLyB1c2Ugc21hcnRfdmVjX2xpdGVcbiAgICAgIGF3YWl0IHRoaXMuc21hcnRfdmVjX2xpdGUuc2F2ZSgpO1xuICAgICAgdGhpcy5oYXNfbmV3X2VtYmVkZGluZ3MgPSBmYWxzZTtcbiAgICB9Y2F0Y2goZXJyb3Ipe1xuICAgICAgY29uc29sZS5sb2coZXJyb3IpO1xuICAgICAgbmV3IE9ic2lkaWFuLk5vdGljZShcIlNtYXJ0IENvbm5lY3Rpb25zOiBcIitlcnJvci5tZXNzYWdlKTtcbiAgICB9XG5cbiAgfVxuICAvLyBzYXZlIGZhaWxlZCBlbWJlZGRpbmdzIHRvIGZpbGUgZnJvbSByZW5kZXJfbG9nLmZhaWxlZF9lbWJlZGRpbmdzXG4gIGFzeW5jIHNhdmVfZmFpbGVkX2VtYmVkZGluZ3MgKCkge1xuICAgIC8vIHdyaXRlIGZhaWxlZF9lbWJlZGRpbmdzIHRvIGZpbGUgb25lIGxpbmUgcGVyIGZhaWxlZCBlbWJlZGRpbmdcbiAgICBsZXQgZmFpbGVkX2VtYmVkZGluZ3MgPSBbXTtcbiAgICAvLyBpZiBmaWxlIGFscmVhZHkgZXhpc3RzIHRoZW4gcmVhZCBpdFxuICAgIGNvbnN0IGZhaWxlZF9lbWJlZGRpbmdzX2ZpbGVfZXhpc3RzID0gYXdhaXQgdGhpcy5hcHAudmF1bHQuYWRhcHRlci5leGlzdHMoXCIuc21hcnQtY29ubmVjdGlvbnMvZmFpbGVkLWVtYmVkZGluZ3MudHh0XCIpO1xuICAgIGlmKGZhaWxlZF9lbWJlZGRpbmdzX2ZpbGVfZXhpc3RzKSB7XG4gICAgICBmYWlsZWRfZW1iZWRkaW5ncyA9IGF3YWl0IHRoaXMuYXBwLnZhdWx0LmFkYXB0ZXIucmVhZChcIi5zbWFydC1jb25uZWN0aW9ucy9mYWlsZWQtZW1iZWRkaW5ncy50eHRcIik7XG4gICAgICAvLyBzcGxpdCBmYWlsZWRfZW1iZWRkaW5ncyBpbnRvIGFycmF5XG4gICAgICBmYWlsZWRfZW1iZWRkaW5ncyA9IGZhaWxlZF9lbWJlZGRpbmdzLnNwbGl0KFwiXFxyXFxuXCIpO1xuICAgIH1cbiAgICAvLyBtZXJnZSBmYWlsZWRfZW1iZWRkaW5ncyB3aXRoIHJlbmRlcl9sb2cuZmFpbGVkX2VtYmVkZGluZ3NcbiAgICBmYWlsZWRfZW1iZWRkaW5ncyA9IGZhaWxlZF9lbWJlZGRpbmdzLmNvbmNhdCh0aGlzLnJlbmRlcl9sb2cuZmFpbGVkX2VtYmVkZGluZ3MpO1xuICAgIC8vIHJlbW92ZSBkdXBsaWNhdGVzXG4gICAgZmFpbGVkX2VtYmVkZGluZ3MgPSBbLi4ubmV3IFNldChmYWlsZWRfZW1iZWRkaW5ncyldO1xuICAgIC8vIHNvcnQgZmFpbGVkX2VtYmVkZGluZ3MgYXJyYXkgYWxwaGFiZXRpY2FsbHlcbiAgICBmYWlsZWRfZW1iZWRkaW5ncy5zb3J0KCk7XG4gICAgLy8gY29udmVydCBmYWlsZWRfZW1iZWRkaW5ncyBhcnJheSB0byBzdHJpbmdcbiAgICBmYWlsZWRfZW1iZWRkaW5ncyA9IGZhaWxlZF9lbWJlZGRpbmdzLmpvaW4oXCJcXHJcXG5cIik7XG4gICAgLy8gd3JpdGUgZmFpbGVkX2VtYmVkZGluZ3MgdG8gZmlsZVxuICAgIGF3YWl0IHRoaXMuYXBwLnZhdWx0LmFkYXB0ZXIud3JpdGUoXCIuc21hcnQtY29ubmVjdGlvbnMvZmFpbGVkLWVtYmVkZGluZ3MudHh0XCIsIGZhaWxlZF9lbWJlZGRpbmdzKTtcbiAgICAvLyByZWxvYWQgZmFpbGVkX2VtYmVkZGluZ3MgdG8gcHJldmVudCByZXRyeWluZyBmYWlsZWQgZmlsZXMgdW50aWwgZXhwbGljaXRseSByZXF1ZXN0ZWRcbiAgICBhd2FpdCB0aGlzLmxvYWRfZmFpbGVkX2ZpbGVzKCk7XG4gIH1cbiAgXG4gIC8vIGxvYWQgZmFpbGVkIGZpbGVzIGZyb20gZmFpbGVkLWVtYmVkZGluZ3MudHh0XG4gIGFzeW5jIGxvYWRfZmFpbGVkX2ZpbGVzICgpIHtcbiAgICAvLyBjaGVjayBpZiBmYWlsZWQtZW1iZWRkaW5ncy50eHQgZXhpc3RzXG4gICAgY29uc3QgZmFpbGVkX2VtYmVkZGluZ3NfZmlsZV9leGlzdHMgPSBhd2FpdCB0aGlzLmFwcC52YXVsdC5hZGFwdGVyLmV4aXN0cyhcIi5zbWFydC1jb25uZWN0aW9ucy9mYWlsZWQtZW1iZWRkaW5ncy50eHRcIik7XG4gICAgaWYoIWZhaWxlZF9lbWJlZGRpbmdzX2ZpbGVfZXhpc3RzKSB7XG4gICAgICB0aGlzLnNldHRpbmdzLmZhaWxlZF9maWxlcyA9IFtdO1xuICAgICAgY29uc29sZS5sb2coXCJObyBmYWlsZWQgZmlsZXMuXCIpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICAvLyByZWFkIGZhaWxlZC1lbWJlZGRpbmdzLnR4dFxuICAgIGNvbnN0IGZhaWxlZF9lbWJlZGRpbmdzID0gYXdhaXQgdGhpcy5hcHAudmF1bHQuYWRhcHRlci5yZWFkKFwiLnNtYXJ0LWNvbm5lY3Rpb25zL2ZhaWxlZC1lbWJlZGRpbmdzLnR4dFwiKTtcbiAgICAvLyBzcGxpdCBmYWlsZWRfZW1iZWRkaW5ncyBpbnRvIGFycmF5IGFuZCByZW1vdmUgZW1wdHkgbGluZXNcbiAgICBjb25zdCBmYWlsZWRfZW1iZWRkaW5nc19hcnJheSA9IGZhaWxlZF9lbWJlZGRpbmdzLnNwbGl0KFwiXFxyXFxuXCIpO1xuICAgIC8vIHNwbGl0IGF0ICcjJyBhbmQgcmVkdWNlIGludG8gdW5pcXVlIGZpbGUgcGF0aHNcbiAgICBjb25zdCBmYWlsZWRfZmlsZXMgPSBmYWlsZWRfZW1iZWRkaW5nc19hcnJheS5tYXAoZW1iZWRkaW5nID0+IGVtYmVkZGluZy5zcGxpdChcIiNcIilbMF0pLnJlZHVjZSgodW5pcXVlLCBpdGVtKSA9PiB1bmlxdWUuaW5jbHVkZXMoaXRlbSkgPyB1bmlxdWUgOiBbLi4udW5pcXVlLCBpdGVtXSwgW10pO1xuICAgIC8vIHJldHVybiBmYWlsZWRfZmlsZXNcbiAgICB0aGlzLnNldHRpbmdzLmZhaWxlZF9maWxlcyA9IGZhaWxlZF9maWxlcztcbiAgICAvLyBjb25zb2xlLmxvZyhmYWlsZWRfZmlsZXMpO1xuICB9XG4gIC8vIHJldHJ5IGZhaWxlZCBlbWJlZGRpbmdzXG4gIGFzeW5jIHJldHJ5X2ZhaWxlZF9maWxlcyAoKSB7XG4gICAgLy8gcmVtb3ZlIGZhaWxlZCBmaWxlcyBmcm9tIGZhaWxlZF9maWxlc1xuICAgIHRoaXMuc2V0dGluZ3MuZmFpbGVkX2ZpbGVzID0gW107XG4gICAgLy8gaWYgZmFpbGVkLWVtYmVkZGluZ3MudHh0IGV4aXN0cyB0aGVuIGRlbGV0ZSBpdFxuICAgIGNvbnN0IGZhaWxlZF9lbWJlZGRpbmdzX2ZpbGVfZXhpc3RzID0gYXdhaXQgdGhpcy5hcHAudmF1bHQuYWRhcHRlci5leGlzdHMoXCIuc21hcnQtY29ubmVjdGlvbnMvZmFpbGVkLWVtYmVkZGluZ3MudHh0XCIpO1xuICAgIGlmKGZhaWxlZF9lbWJlZGRpbmdzX2ZpbGVfZXhpc3RzKSB7XG4gICAgICBhd2FpdCB0aGlzLmFwcC52YXVsdC5hZGFwdGVyLnJlbW92ZShcIi5zbWFydC1jb25uZWN0aW9ucy9mYWlsZWQtZW1iZWRkaW5ncy50eHRcIik7XG4gICAgfVxuICAgIC8vIHJ1biBnZXQgYWxsIGVtYmVkZGluZ3NcbiAgICBhd2FpdCB0aGlzLmdldF9hbGxfZW1iZWRkaW5ncygpO1xuICB9XG5cblxuICAvLyBhZGQgLnNtYXJ0LWNvbm5lY3Rpb25zIHRvIC5naXRpZ25vcmUgdG8gcHJldmVudCBpc3N1ZXMgd2l0aCBsYXJnZSwgZnJlcXVlbnRseSB1cGRhdGVkIGVtYmVkZGluZ3MgZmlsZShzKVxuICBhc3luYyBhZGRfdG9fZ2l0aWdub3JlKCkge1xuICAgIGlmKCEoYXdhaXQgdGhpcy5hcHAudmF1bHQuYWRhcHRlci5leGlzdHMoXCIuZ2l0aWdub3JlXCIpKSkge1xuICAgICAgcmV0dXJuOyAvLyBpZiAuZ2l0aWdub3JlIGRvZXNuJ3QgZXhpc3QgdGhlbiBkb24ndCBhZGQgLnNtYXJ0LWNvbm5lY3Rpb25zIHRvIC5naXRpZ25vcmVcbiAgICB9XG4gICAgbGV0IGdpdGlnbm9yZV9maWxlID0gYXdhaXQgdGhpcy5hcHAudmF1bHQuYWRhcHRlci5yZWFkKFwiLmdpdGlnbm9yZVwiKTtcbiAgICAvLyBpZiAuc21hcnQtY29ubmVjdGlvbnMgbm90IGluIC5naXRpZ25vcmVcbiAgICBpZiAoZ2l0aWdub3JlX2ZpbGUuaW5kZXhPZihcIi5zbWFydC1jb25uZWN0aW9uc1wiKSA8IDApIHtcbiAgICAgIC8vIGFkZCAuc21hcnQtY29ubmVjdGlvbnMgdG8gLmdpdGlnbm9yZVxuICAgICAgbGV0IGFkZF90b19naXRpZ25vcmUgPSBcIlxcblxcbiMgSWdub3JlIFNtYXJ0IENvbm5lY3Rpb25zIGZvbGRlciBiZWNhdXNlIGVtYmVkZGluZ3MgZmlsZSBpcyBsYXJnZSBhbmQgdXBkYXRlZCBmcmVxdWVudGx5XCI7XG4gICAgICBhZGRfdG9fZ2l0aWdub3JlICs9IFwiXFxuLnNtYXJ0LWNvbm5lY3Rpb25zXCI7XG4gICAgICBhd2FpdCB0aGlzLmFwcC52YXVsdC5hZGFwdGVyLndyaXRlKFwiLmdpdGlnbm9yZVwiLCBnaXRpZ25vcmVfZmlsZSArIGFkZF90b19naXRpZ25vcmUpO1xuICAgICAgY29uc29sZS5sb2coXCJhZGRlZCAuc21hcnQtY29ubmVjdGlvbnMgdG8gLmdpdGlnbm9yZVwiKTtcbiAgICB9XG4gIH1cblxuICAvLyBmb3JjZSByZWZyZXNoIGVtYmVkZGluZ3MgZmlsZSBidXQgZmlyc3QgcmVuYW1lIGV4aXN0aW5nIGVtYmVkZGluZ3MgZmlsZSB0byAuc21hcnQtY29ubmVjdGlvbnMvZW1iZWRkaW5ncy1ZWVlZLU1NLURELmpzb25cbiAgYXN5bmMgZm9yY2VfcmVmcmVzaF9lbWJlZGRpbmdzX2ZpbGUoKSB7XG4gICAgbmV3IE9ic2lkaWFuLk5vdGljZShcIlNtYXJ0IENvbm5lY3Rpb25zOiBlbWJlZGRpbmdzIGZpbGUgRm9yY2UgUmVmcmVzaGVkLCBtYWtpbmcgbmV3IGNvbm5lY3Rpb25zLi4uXCIpO1xuICAgIC8vIGZvcmNlIHJlZnJlc2hcbiAgICBhd2FpdCB0aGlzLnNtYXJ0X3ZlY19saXRlLmZvcmNlX3JlZnJlc2goKTtcbiAgICAvLyB0cmlnZ2VyIG1ha2luZyBuZXcgY29ubmVjdGlvbnNcbiAgICBhd2FpdCB0aGlzLmdldF9hbGxfZW1iZWRkaW5ncygpO1xuICAgIHRoaXMub3V0cHV0X3JlbmRlcl9sb2coKTtcbiAgICBuZXcgT2JzaWRpYW4uTm90aWNlKFwiU21hcnQgQ29ubmVjdGlvbnM6IGVtYmVkZGluZ3MgZmlsZSBGb3JjZSBSZWZyZXNoZWQsIG5ldyBjb25uZWN0aW9ucyBtYWRlLlwiKTtcbiAgfVxuXG4gIC8vIGdldCBlbWJlZGRpbmdzIGZvciBlbWJlZF9pbnB1dFxuICBhc3luYyBnZXRfZmlsZV9lbWJlZGRpbmdzKGN1cnJfZmlsZSwgc2F2ZT10cnVlKSB7XG4gICAgLy8gbGV0IGJhdGNoX3Byb21pc2VzID0gW107XG4gICAgbGV0IHJlcV9iYXRjaCA9IFtdO1xuICAgIGxldCBibG9ja3MgPSBbXTtcbiAgICAvLyBpbml0aWF0ZSBjdXJyX2ZpbGVfa2V5IGZyb20gbWQ1KGN1cnJfZmlsZS5wYXRoKVxuICAgIGNvbnN0IGN1cnJfZmlsZV9rZXkgPSBtZDUoY3Vycl9maWxlLnBhdGgpO1xuICAgIC8vIGludGlhdGUgZmlsZV9maWxlX2VtYmVkX2lucHV0IGJ5IHJlbW92aW5nIC5tZCBhbmQgY29udmVydGluZyBmaWxlIHBhdGggdG8gYnJlYWRjcnVtYnMgKFwiID4gXCIpXG4gICAgbGV0IGZpbGVfZW1iZWRfaW5wdXQgPSBjdXJyX2ZpbGUucGF0aC5yZXBsYWNlKFwiLm1kXCIsIFwiXCIpO1xuICAgIGZpbGVfZW1iZWRfaW5wdXQgPSBmaWxlX2VtYmVkX2lucHV0LnJlcGxhY2UoL1xcLy9nLCBcIiA+IFwiKTtcbiAgICAvLyBlbWJlZCBvbiBmaWxlLm5hbWUvdGl0bGUgb25seSBpZiBwYXRoX29ubHkgcGF0aCBtYXRjaGVyIHNwZWNpZmllZCBpbiBzZXR0aW5nc1xuICAgIGxldCBwYXRoX29ubHkgPSBmYWxzZTtcbiAgICBmb3IobGV0IGogPSAwOyBqIDwgdGhpcy5wYXRoX29ubHkubGVuZ3RoOyBqKyspIHtcbiAgICAgIGlmKGN1cnJfZmlsZS5wYXRoLmluZGV4T2YodGhpcy5wYXRoX29ubHlbal0pID4gLTEpIHtcbiAgICAgICAgcGF0aF9vbmx5ID0gdHJ1ZTtcbiAgICAgICAgY29uc29sZS5sb2coXCJ0aXRsZSBvbmx5IGZpbGUgd2l0aCBtYXRjaGVyOiBcIiArIHRoaXMucGF0aF9vbmx5W2pdKTtcbiAgICAgICAgLy8gYnJlYWsgb3V0IG9mIGxvb3BcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICAgIC8vIHJldHVybiBlYXJseSBpZiBwYXRoX29ubHlcbiAgICBpZihwYXRoX29ubHkpIHtcbiAgICAgIHJlcV9iYXRjaC5wdXNoKFtjdXJyX2ZpbGVfa2V5LCBmaWxlX2VtYmVkX2lucHV0LCB7XG4gICAgICAgIG10aW1lOiBjdXJyX2ZpbGUuc3RhdC5tdGltZSxcbiAgICAgICAgcGF0aDogY3Vycl9maWxlLnBhdGgsXG4gICAgICB9XSk7XG4gICAgICBhd2FpdCB0aGlzLmdldF9lbWJlZGRpbmdzX2JhdGNoKHJlcV9iYXRjaCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIC8qKlxuICAgICAqIEJFR0lOIENhbnZhcyBmaWxlIHR5cGUgRW1iZWRkaW5nXG4gICAgICovXG4gICAgaWYoY3Vycl9maWxlLmV4dGVuc2lvbiA9PT0gXCJjYW52YXNcIikge1xuICAgICAgLy8gZ2V0IGZpbGUgY29udGVudHMgYW5kIHBhcnNlIGFzIEpTT05cbiAgICAgIGNvbnN0IGNhbnZhc19jb250ZW50cyA9IGF3YWl0IHRoaXMuYXBwLnZhdWx0LmNhY2hlZFJlYWQoY3Vycl9maWxlKTtcbiAgICAgIGlmKCh0eXBlb2YgY2FudmFzX2NvbnRlbnRzID09PSBcInN0cmluZ1wiKSAmJiAoY2FudmFzX2NvbnRlbnRzLmluZGV4T2YoXCJub2Rlc1wiKSA+IC0xKSkge1xuICAgICAgICBjb25zdCBjYW52YXNfanNvbiA9IEpTT04ucGFyc2UoY2FudmFzX2NvbnRlbnRzKTtcbiAgICAgICAgLy8gZm9yIGVhY2ggb2JqZWN0IGluIG5vZGVzIGFycmF5XG4gICAgICAgIGZvcihsZXQgaiA9IDA7IGogPCBjYW52YXNfanNvbi5ub2Rlcy5sZW5ndGg7IGorKykge1xuICAgICAgICAgIC8vIGlmIG9iamVjdCBoYXMgdGV4dCBwcm9wZXJ0eVxuICAgICAgICAgIGlmKGNhbnZhc19qc29uLm5vZGVzW2pdLnRleHQpIHtcbiAgICAgICAgICAgIC8vIGFkZCB0byBmaWxlX2VtYmVkX2lucHV0XG4gICAgICAgICAgICBmaWxlX2VtYmVkX2lucHV0ICs9IFwiXFxuXCIgKyBjYW52YXNfanNvbi5ub2Rlc1tqXS50ZXh0O1xuICAgICAgICAgIH1cbiAgICAgICAgICAvLyBpZiBvYmplY3QgaGFzIGZpbGUgcHJvcGVydHlcbiAgICAgICAgICBpZihjYW52YXNfanNvbi5ub2Rlc1tqXS5maWxlKSB7XG4gICAgICAgICAgICAvLyBhZGQgdG8gZmlsZV9lbWJlZF9pbnB1dFxuICAgICAgICAgICAgZmlsZV9lbWJlZF9pbnB1dCArPSBcIlxcbkxpbms6IFwiICsgY2FudmFzX2pzb24ubm9kZXNbal0uZmlsZTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIC8vIGNvbnNvbGUubG9nKGZpbGVfZW1iZWRfaW5wdXQpO1xuICAgICAgcmVxX2JhdGNoLnB1c2goW2N1cnJfZmlsZV9rZXksIGZpbGVfZW1iZWRfaW5wdXQsIHtcbiAgICAgICAgbXRpbWU6IGN1cnJfZmlsZS5zdGF0Lm10aW1lLFxuICAgICAgICBwYXRoOiBjdXJyX2ZpbGUucGF0aCxcbiAgICAgIH1dKTtcbiAgICAgIGF3YWl0IHRoaXMuZ2V0X2VtYmVkZGluZ3NfYmF0Y2gocmVxX2JhdGNoKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgXG4gICAgLyoqXG4gICAgICogQkVHSU4gQmxvY2sgXCJzZWN0aW9uXCIgZW1iZWRkaW5nXG4gICAgICovXG4gICAgLy8gZ2V0IGZpbGUgY29udGVudHNcbiAgICBjb25zdCBub3RlX2NvbnRlbnRzID0gYXdhaXQgdGhpcy5hcHAudmF1bHQuY2FjaGVkUmVhZChjdXJyX2ZpbGUpO1xuICAgIGxldCBwcm9jZXNzZWRfc2luY2VfbGFzdF9zYXZlID0gMDtcbiAgICBjb25zdCBub3RlX3NlY3Rpb25zID0gdGhpcy5ibG9ja19wYXJzZXIobm90ZV9jb250ZW50cywgY3Vycl9maWxlLnBhdGgpO1xuICAgIC8vIGNvbnNvbGUubG9nKG5vdGVfc2VjdGlvbnMpO1xuICAgIC8vIGlmIG5vdGUgaGFzIG1vcmUgdGhhbiBvbmUgc2VjdGlvbiAoaWYgb25seSBvbmUgdGhlbiBpdHMgc2FtZSBhcyBmdWxsLWNvbnRlbnQpXG4gICAgaWYobm90ZV9zZWN0aW9ucy5sZW5ndGggPiAxKSB7XG4gICAgICAvLyBmb3IgZWFjaCBzZWN0aW9uIGluIGZpbGVcbiAgICAgIC8vY29uc29sZS5sb2coXCJTZWN0aW9uczogXCIgKyBub3RlX3NlY3Rpb25zLmxlbmd0aCk7XG4gICAgICBmb3IgKGxldCBqID0gMDsgaiA8IG5vdGVfc2VjdGlvbnMubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgLy8gZ2V0IGVtYmVkX2lucHV0IGZvciBibG9ja1xuICAgICAgICBjb25zdCBibG9ja19lbWJlZF9pbnB1dCA9IG5vdGVfc2VjdGlvbnNbal0udGV4dDtcbiAgICAgICAgLy8gY29uc29sZS5sb2cobm90ZV9zZWN0aW9uc1tqXS5wYXRoKTtcbiAgICAgICAgLy8gZ2V0IGJsb2NrIGtleSBmcm9tIGJsb2NrLnBhdGggKGNvbnRhaW5zIGJvdGggZmlsZS5wYXRoIGFuZCBoZWFkZXIgcGF0aClcbiAgICAgICAgY29uc3QgYmxvY2tfa2V5ID0gbWQ1KG5vdGVfc2VjdGlvbnNbal0ucGF0aCk7XG4gICAgICAgIGJsb2Nrcy5wdXNoKGJsb2NrX2tleSk7XG4gICAgICAgIC8vIHNraXAgaWYgbGVuZ3RoIG9mIGJsb2NrX2VtYmVkX2lucHV0IHNhbWUgYXMgbGVuZ3RoIG9mIGVtYmVkZGluZ3NbYmxvY2tfa2V5XS5tZXRhLnNpemVcbiAgICAgICAgLy8gVE9ETyBjb25zaWRlciByb3VuZGluZyB0byBuZWFyZXN0IDEwIG9yIDEwMCBmb3IgZnV6enkgbWF0Y2hpbmdcbiAgICAgICAgaWYgKHRoaXMuc21hcnRfdmVjX2xpdGUuZ2V0X3NpemUoYmxvY2tfa2V5KSA9PT0gYmxvY2tfZW1iZWRfaW5wdXQubGVuZ3RoKSB7XG4gICAgICAgICAgLy8gbG9nIHNraXBwaW5nIGZpbGVcbiAgICAgICAgICAvLyBjb25zb2xlLmxvZyhcInNraXBwaW5nIGJsb2NrIChsZW4pXCIpO1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICAgIC8vIGFkZCBoYXNoIHRvIGJsb2NrcyB0byBwcmV2ZW50IGVtcHR5IGJsb2NrcyB0cmlnZ2VyaW5nIGZ1bGwtZmlsZSBlbWJlZGRpbmdcbiAgICAgICAgLy8gc2tpcCBpZiBlbWJlZGRpbmdzIGtleSBhbHJlYWR5IGV4aXN0cyBhbmQgYmxvY2sgbXRpbWUgaXMgZ3JlYXRlciB0aGFuIG9yIGVxdWFsIHRvIGZpbGUgbXRpbWVcbiAgICAgICAgaWYodGhpcy5zbWFydF92ZWNfbGl0ZS5tdGltZV9pc19jdXJyZW50KGJsb2NrX2tleSwgY3Vycl9maWxlLnN0YXQubXRpbWUpKSB7XG4gICAgICAgICAgLy8gbG9nIHNraXBwaW5nIGZpbGVcbiAgICAgICAgICAvLyBjb25zb2xlLmxvZyhcInNraXBwaW5nIGJsb2NrIChtdGltZSlcIik7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgICAgLy8gc2tpcCBpZiBoYXNoIGlzIHByZXNlbnQgaW4gZW1iZWRkaW5ncyBhbmQgaGFzaCBvZiBibG9ja19lbWJlZF9pbnB1dCBpcyBlcXVhbCB0byBoYXNoIGluIGVtYmVkZGluZ3NcbiAgICAgICAgY29uc3QgYmxvY2tfaGFzaCA9IG1kNShibG9ja19lbWJlZF9pbnB1dC50cmltKCkpO1xuICAgICAgICBpZih0aGlzLnNtYXJ0X3ZlY19saXRlLmdldF9oYXNoKGJsb2NrX2tleSkgPT09IGJsb2NrX2hhc2gpIHtcbiAgICAgICAgICAvLyBsb2cgc2tpcHBpbmcgZmlsZVxuICAgICAgICAgIC8vIGNvbnNvbGUubG9nKFwic2tpcHBpbmcgYmxvY2sgKGhhc2gpXCIpO1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gY3JlYXRlIHJlcV9iYXRjaCBmb3IgYmF0Y2hpbmcgcmVxdWVzdHNcbiAgICAgICAgcmVxX2JhdGNoLnB1c2goW2Jsb2NrX2tleSwgYmxvY2tfZW1iZWRfaW5wdXQsIHtcbiAgICAgICAgICAvLyBvbGRtdGltZTogY3Vycl9maWxlLnN0YXQubXRpbWUsIFxuICAgICAgICAgIC8vIGdldCBjdXJyZW50IGRhdGV0aW1lIGFzIHVuaXggdGltZXN0YW1wXG4gICAgICAgICAgbXRpbWU6IERhdGUubm93KCksXG4gICAgICAgICAgaGFzaDogYmxvY2tfaGFzaCwgXG4gICAgICAgICAgcGFyZW50OiBjdXJyX2ZpbGVfa2V5LFxuICAgICAgICAgIHBhdGg6IG5vdGVfc2VjdGlvbnNbal0ucGF0aCxcbiAgICAgICAgICBzaXplOiBibG9ja19lbWJlZF9pbnB1dC5sZW5ndGgsXG4gICAgICAgIH1dKTtcbiAgICAgICAgaWYocmVxX2JhdGNoLmxlbmd0aCA+IDkpIHtcbiAgICAgICAgICAvLyBhZGQgYmF0Y2ggdG8gYmF0Y2hfcHJvbWlzZXNcbiAgICAgICAgICBhd2FpdCB0aGlzLmdldF9lbWJlZGRpbmdzX2JhdGNoKHJlcV9iYXRjaCk7XG4gICAgICAgICAgcHJvY2Vzc2VkX3NpbmNlX2xhc3Rfc2F2ZSArPSByZXFfYmF0Y2gubGVuZ3RoO1xuICAgICAgICAgIC8vIGxvZyBlbWJlZGRpbmdcbiAgICAgICAgICAvLyBjb25zb2xlLmxvZyhcImVtYmVkZGluZzogXCIgKyBjdXJyX2ZpbGUucGF0aCk7XG4gICAgICAgICAgaWYgKHByb2Nlc3NlZF9zaW5jZV9sYXN0X3NhdmUgPj0gMzApIHtcbiAgICAgICAgICAgIC8vIHdyaXRlIGVtYmVkZGluZ3MgSlNPTiB0byBmaWxlXG4gICAgICAgICAgICBhd2FpdCB0aGlzLnNhdmVfZW1iZWRkaW5nc190b19maWxlKCk7XG4gICAgICAgICAgICAvLyByZXNldCBwcm9jZXNzZWRfc2luY2VfbGFzdF9zYXZlXG4gICAgICAgICAgICBwcm9jZXNzZWRfc2luY2VfbGFzdF9zYXZlID0gMDtcbiAgICAgICAgICB9XG4gICAgICAgICAgLy8gcmVzZXQgcmVxX2JhdGNoXG4gICAgICAgICAgcmVxX2JhdGNoID0gW107XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgLy8gaWYgcmVxX2JhdGNoIGlzIG5vdCBlbXB0eVxuICAgIGlmKHJlcV9iYXRjaC5sZW5ndGggPiAwKSB7XG4gICAgICAvLyBwcm9jZXNzIHJlbWFpbmluZyByZXFfYmF0Y2hcbiAgICAgIGF3YWl0IHRoaXMuZ2V0X2VtYmVkZGluZ3NfYmF0Y2gocmVxX2JhdGNoKTtcbiAgICAgIHJlcV9iYXRjaCA9IFtdO1xuICAgICAgcHJvY2Vzc2VkX3NpbmNlX2xhc3Rfc2F2ZSArPSByZXFfYmF0Y2gubGVuZ3RoO1xuICAgIH1cbiAgICBcbiAgICAvKipcbiAgICAgKiBCRUdJTiBGaWxlIFwiZnVsbCBub3RlXCIgZW1iZWRkaW5nXG4gICAgICovXG5cbiAgICAvLyBpZiBmaWxlIGxlbmd0aCBpcyBsZXNzIHRoYW4gfjgwMDAgdG9rZW5zIHVzZSBmdWxsIGZpbGUgY29udGVudHNcbiAgICAvLyBlbHNlIGlmIGZpbGUgbGVuZ3RoIGlzIGdyZWF0ZXIgdGhhbiA4MDAwIHRva2VucyBidWlsZCBmaWxlX2VtYmVkX2lucHV0IGZyb20gZmlsZSBoZWFkaW5nc1xuICAgIGZpbGVfZW1iZWRfaW5wdXQgKz0gYDpcXG5gO1xuICAgIC8qKlxuICAgICAqIFRPRE86IGltcHJvdmUvcmVmYWN0b3IgdGhlIGZvbGxvd2luZyBcImxhcmdlIGZpbGUgcmVkdWNlIHRvIGhlYWRpbmdzXCIgbG9naWNcbiAgICAgKi9cbiAgICBpZihub3RlX2NvbnRlbnRzLmxlbmd0aCA8IE1BWF9FTUJFRF9TVFJJTkdfTEVOR1RIKSB7XG4gICAgICBmaWxlX2VtYmVkX2lucHV0ICs9IG5vdGVfY29udGVudHNcbiAgICB9ZWxzZXsgXG4gICAgICBjb25zdCBub3RlX21ldGFfY2FjaGUgPSB0aGlzLmFwcC5tZXRhZGF0YUNhY2hlLmdldEZpbGVDYWNoZShjdXJyX2ZpbGUpO1xuICAgICAgLy8gZm9yIGVhY2ggaGVhZGluZyBpbiBmaWxlXG4gICAgICBpZih0eXBlb2Ygbm90ZV9tZXRhX2NhY2hlLmhlYWRpbmdzID09PSBcInVuZGVmaW5lZFwiKSB7XG4gICAgICAgIC8vIGNvbnNvbGUubG9nKFwibm8gaGVhZGluZ3MgZm91bmQsIHVzaW5nIGZpcnN0IGNodW5rIG9mIGZpbGUgaW5zdGVhZFwiKTtcbiAgICAgICAgZmlsZV9lbWJlZF9pbnB1dCArPSBub3RlX2NvbnRlbnRzLnN1YnN0cmluZygwLCBNQVhfRU1CRURfU1RSSU5HX0xFTkdUSCk7XG4gICAgICB9ZWxzZXtcbiAgICAgICAgbGV0IG5vdGVfaGVhZGluZ3MgPSBcIlwiO1xuICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IG5vdGVfbWV0YV9jYWNoZS5oZWFkaW5ncy5sZW5ndGg7IGorKykge1xuICAgICAgICAgIC8vIGdldCBoZWFkaW5nIGxldmVsXG4gICAgICAgICAgY29uc3QgaGVhZGluZ19sZXZlbCA9IG5vdGVfbWV0YV9jYWNoZS5oZWFkaW5nc1tqXS5sZXZlbDtcbiAgICAgICAgICAvLyBnZXQgaGVhZGluZyB0ZXh0XG4gICAgICAgICAgY29uc3QgaGVhZGluZ190ZXh0ID0gbm90ZV9tZXRhX2NhY2hlLmhlYWRpbmdzW2pdLmhlYWRpbmc7XG4gICAgICAgICAgLy8gYnVpbGQgbWFya2Rvd24gaGVhZGluZ1xuICAgICAgICAgIGxldCBtZF9oZWFkaW5nID0gXCJcIjtcbiAgICAgICAgICBmb3IgKGxldCBrID0gMDsgayA8IGhlYWRpbmdfbGV2ZWw7IGsrKykge1xuICAgICAgICAgICAgbWRfaGVhZGluZyArPSBcIiNcIjtcbiAgICAgICAgICB9XG4gICAgICAgICAgLy8gYWRkIGhlYWRpbmcgdG8gbm90ZV9oZWFkaW5nc1xuICAgICAgICAgIG5vdGVfaGVhZGluZ3MgKz0gYCR7bWRfaGVhZGluZ30gJHtoZWFkaW5nX3RleHR9XFxuYDtcbiAgICAgICAgfVxuICAgICAgICAvL2NvbnNvbGUubG9nKG5vdGVfaGVhZGluZ3MpO1xuICAgICAgICBmaWxlX2VtYmVkX2lucHV0ICs9IG5vdGVfaGVhZGluZ3NcbiAgICAgICAgaWYoZmlsZV9lbWJlZF9pbnB1dC5sZW5ndGggPiBNQVhfRU1CRURfU1RSSU5HX0xFTkdUSCkge1xuICAgICAgICAgIGZpbGVfZW1iZWRfaW5wdXQgPSBmaWxlX2VtYmVkX2lucHV0LnN1YnN0cmluZygwLCBNQVhfRU1CRURfU1RSSU5HX0xFTkdUSCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgLy8gc2tpcCBlbWJlZGRpbmcgZnVsbCBmaWxlIGlmIGJsb2NrcyBpcyBub3QgZW1wdHkgYW5kIGFsbCBoYXNoZXMgYXJlIHByZXNlbnQgaW4gZW1iZWRkaW5nc1xuICAgIC8vIGJldHRlciB0aGFuIGhhc2hpbmcgZmlsZV9lbWJlZF9pbnB1dCBiZWNhdXNlIG1vcmUgcmVzaWxpZW50IHRvIGluY29uc2VxdWVudGlhbCBjaGFuZ2VzICh3aGl0ZXNwYWNlIGJldHdlZW4gaGVhZGluZ3MpXG4gICAgY29uc3QgZmlsZV9oYXNoID0gbWQ1KGZpbGVfZW1iZWRfaW5wdXQudHJpbSgpKTtcbiAgICBjb25zdCBleGlzdGluZ19oYXNoID0gdGhpcy5zbWFydF92ZWNfbGl0ZS5nZXRfaGFzaChjdXJyX2ZpbGVfa2V5KTtcbiAgICBpZihleGlzdGluZ19oYXNoICYmIChmaWxlX2hhc2ggPT09IGV4aXN0aW5nX2hhc2gpKSB7XG4gICAgICAvLyBjb25zb2xlLmxvZyhcInNraXBwaW5nIGZpbGUgKGhhc2gpOiBcIiArIGN1cnJfZmlsZS5wYXRoKTtcbiAgICAgIHRoaXMudXBkYXRlX3JlbmRlcl9sb2coYmxvY2tzLCBmaWxlX2VtYmVkX2lucHV0KTtcbiAgICAgIHJldHVybjtcbiAgICB9O1xuXG4gICAgLy8gaWYgbm90IGFscmVhZHkgc2tpcHBpbmcgYW5kIGJsb2NrcyBhcmUgcHJlc2VudFxuICAgIGNvbnN0IGV4aXN0aW5nX2Jsb2NrcyA9IHRoaXMuc21hcnRfdmVjX2xpdGUuZ2V0X2NoaWxkcmVuKGN1cnJfZmlsZV9rZXkpO1xuICAgIGxldCBleGlzdGluZ19oYXNfYWxsX2Jsb2NrcyA9IHRydWU7XG4gICAgaWYoZXhpc3RpbmdfYmxvY2tzICYmIEFycmF5LmlzQXJyYXkoZXhpc3RpbmdfYmxvY2tzKSAmJiAoYmxvY2tzLmxlbmd0aCA+IDApKSB7XG4gICAgICAvLyBpZiBhbGwgYmxvY2tzIGFyZSBpbiBleGlzdGluZ19ibG9ja3MgdGhlbiBza2lwIChhbGxvd3MgZGVsZXRpb24gb2Ygc21hbGwgYmxvY2tzIHdpdGhvdXQgdHJpZ2dlcmluZyBmdWxsIGZpbGUgZW1iZWRkaW5nKVxuICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCBibG9ja3MubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgaWYoZXhpc3RpbmdfYmxvY2tzLmluZGV4T2YoYmxvY2tzW2pdKSA9PT0gLTEpIHtcbiAgICAgICAgICBleGlzdGluZ19oYXNfYWxsX2Jsb2NrcyA9IGZhbHNlO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIC8vIGlmIGV4aXN0aW5nIGhhcyBhbGwgYmxvY2tzIHRoZW4gY2hlY2sgZmlsZSBzaXplIGZvciBkZWx0YVxuICAgIGlmKGV4aXN0aW5nX2hhc19hbGxfYmxvY2tzKXtcbiAgICAgIC8vIGdldCBjdXJyZW50IG5vdGUgZmlsZSBzaXplXG4gICAgICBjb25zdCBjdXJyX2ZpbGVfc2l6ZSA9IGN1cnJfZmlsZS5zdGF0LnNpemU7XG4gICAgICAvLyBnZXQgZmlsZSBzaXplIGZyb20gZW1iZWRkaW5nc1xuICAgICAgY29uc3QgcHJldl9maWxlX3NpemUgPSB0aGlzLnNtYXJ0X3ZlY19saXRlLmdldF9zaXplKGN1cnJfZmlsZV9rZXkpO1xuICAgICAgaWYgKHByZXZfZmlsZV9zaXplKSB7XG4gICAgICAgIC8vIGlmIGN1cnIgZmlsZSBzaXplIGlzIGxlc3MgdGhhbiAxMCUgZGlmZmVyZW50IGZyb20gcHJldiBmaWxlIHNpemVcbiAgICAgICAgY29uc3QgZmlsZV9kZWx0YV9wY3QgPSBNYXRoLnJvdW5kKChNYXRoLmFicyhjdXJyX2ZpbGVfc2l6ZSAtIHByZXZfZmlsZV9zaXplKSAvIGN1cnJfZmlsZV9zaXplKSAqIDEwMCk7XG4gICAgICAgIGlmKGZpbGVfZGVsdGFfcGN0IDwgMTApIHtcbiAgICAgICAgICAvLyBza2lwIGVtYmVkZGluZ1xuICAgICAgICAgIC8vIGNvbnNvbGUubG9nKFwic2tpcHBpbmcgZmlsZSAoc2l6ZSkgXCIgKyBjdXJyX2ZpbGUucGF0aCk7XG4gICAgICAgICAgdGhpcy5yZW5kZXJfbG9nLnNraXBwZWRfbG93X2RlbHRhW2N1cnJfZmlsZS5uYW1lXSA9IGZpbGVfZGVsdGFfcGN0ICsgXCIlXCI7XG4gICAgICAgICAgdGhpcy51cGRhdGVfcmVuZGVyX2xvZyhibG9ja3MsIGZpbGVfZW1iZWRfaW5wdXQpO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBsZXQgbWV0YSA9IHtcbiAgICAgIG10aW1lOiBjdXJyX2ZpbGUuc3RhdC5tdGltZSxcbiAgICAgIGhhc2g6IGZpbGVfaGFzaCxcbiAgICAgIHBhdGg6IGN1cnJfZmlsZS5wYXRoLFxuICAgICAgc2l6ZTogY3Vycl9maWxlLnN0YXQuc2l6ZSxcbiAgICAgIGNoaWxkcmVuOiBibG9ja3MsXG4gICAgfTtcbiAgICAvLyBiYXRjaF9wcm9taXNlcy5wdXNoKHRoaXMuZ2V0X2VtYmVkZGluZ3MoY3Vycl9maWxlX2tleSwgZmlsZV9lbWJlZF9pbnB1dCwgbWV0YSkpO1xuICAgIHJlcV9iYXRjaC5wdXNoKFtjdXJyX2ZpbGVfa2V5LCBmaWxlX2VtYmVkX2lucHV0LCBtZXRhXSk7XG4gICAgLy8gc2VuZCBiYXRjaCByZXF1ZXN0XG4gICAgYXdhaXQgdGhpcy5nZXRfZW1iZWRkaW5nc19iYXRjaChyZXFfYmF0Y2gpO1xuXG4gICAgLy8gbG9nIGVtYmVkZGluZ1xuICAgIC8vIGNvbnNvbGUubG9nKFwiZW1iZWRkaW5nOiBcIiArIGN1cnJfZmlsZS5wYXRoKTtcbiAgICBpZiAoc2F2ZSkge1xuICAgICAgLy8gd3JpdGUgZW1iZWRkaW5ncyBKU09OIHRvIGZpbGVcbiAgICAgIGF3YWl0IHRoaXMuc2F2ZV9lbWJlZGRpbmdzX3RvX2ZpbGUoKTtcbiAgICB9XG5cbiAgfVxuXG4gIHVwZGF0ZV9yZW5kZXJfbG9nKGJsb2NrcywgZmlsZV9lbWJlZF9pbnB1dCkge1xuICAgIGlmIChibG9ja3MubGVuZ3RoID4gMCkge1xuICAgICAgLy8gbXVsdGlwbHkgYnkgMiBiZWNhdXNlIGltcGxpZXMgd2Ugc2F2ZWQgdG9rZW4gc3BlbmRpbmcgb24gYmxvY2tzKHNlY3Rpb25zKSwgdG9vXG4gICAgICB0aGlzLnJlbmRlcl9sb2cudG9rZW5zX3NhdmVkX2J5X2NhY2hlICs9IGZpbGVfZW1iZWRfaW5wdXQubGVuZ3RoIC8gMjtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gY2FsYyB0b2tlbnMgc2F2ZWQgYnkgY2FjaGU6IGRpdmlkZSBieSA0IGZvciB0b2tlbiBlc3RpbWF0ZVxuICAgICAgdGhpcy5yZW5kZXJfbG9nLnRva2Vuc19zYXZlZF9ieV9jYWNoZSArPSBmaWxlX2VtYmVkX2lucHV0Lmxlbmd0aCAvIDQ7XG4gICAgfVxuICB9XG5cbiAgYXN5bmMgZ2V0X2VtYmVkZGluZ3NfYmF0Y2gocmVxX2JhdGNoKSB7XG4gICAgY29uc29sZS5sb2coXCJnZXRfZW1iZWRkaW5nc19iYXRjaFwiKTtcbiAgICAvLyBpZiByZXFfYmF0Y2ggaXMgZW1wdHkgdGhlbiByZXR1cm5cbiAgICBpZihyZXFfYmF0Y2gubGVuZ3RoID09PSAwKSByZXR1cm47XG4gICAgLy8gY3JlYXRlIGFycmFyeSBvZiBlbWJlZF9pbnB1dHMgZnJvbSByZXFfYmF0Y2hbaV1bMV1cbiAgICBjb25zdCBlbWJlZF9pbnB1dHMgPSByZXFfYmF0Y2gubWFwKChyZXEpID0+IHJlcVsxXSk7XG4gICAgLy8gcmVxdWVzdCBlbWJlZGRpbmdzIGZyb20gZW1iZWRfaW5wdXRzXG4gICAgY29uc3QgcmVxdWVzdFJlc3VsdHMgPSBhd2FpdCB0aGlzLnJlcXVlc3RfZW1iZWRkaW5nX2Zyb21faW5wdXQoZW1iZWRfaW5wdXRzKTtcbiAgICAvLyBpZiByZXF1ZXN0UmVzdWx0cyBpcyBudWxsIHRoZW4gcmV0dXJuXG4gICAgaWYoIXJlcXVlc3RSZXN1bHRzKSB7XG4gICAgICBjb25zb2xlLmxvZyhcImZhaWxlZCBlbWJlZGRpbmcgYmF0Y2hcIik7XG4gICAgICAvLyBsb2cgZmFpbGVkIGZpbGUgbmFtZXMgdG8gcmVuZGVyX2xvZ1xuICAgICAgdGhpcy5yZW5kZXJfbG9nLmZhaWxlZF9lbWJlZGRpbmdzID0gWy4uLnRoaXMucmVuZGVyX2xvZy5mYWlsZWRfZW1iZWRkaW5ncywgLi4ucmVxX2JhdGNoLm1hcCgocmVxKSA9PiByZXFbMl0ucGF0aCldO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICAvLyBpZiByZXF1ZXN0UmVzdWx0cyBpcyBub3QgbnVsbFxuICAgIGlmKHJlcXVlc3RSZXN1bHRzKXtcbiAgICAgIHRoaXMuaGFzX25ld19lbWJlZGRpbmdzID0gdHJ1ZTtcbiAgICAgIC8vIGFkZCBlbWJlZGRpbmcga2V5IHRvIHJlbmRlcl9sb2dcbiAgICAgIGlmKHRoaXMuc2V0dGluZ3MubG9nX3JlbmRlcil7XG4gICAgICAgIGlmKHRoaXMuc2V0dGluZ3MubG9nX3JlbmRlcl9maWxlcyl7XG4gICAgICAgICAgdGhpcy5yZW5kZXJfbG9nLmZpbGVzID0gWy4uLnRoaXMucmVuZGVyX2xvZy5maWxlcywgLi4ucmVxX2JhdGNoLm1hcCgocmVxKSA9PiByZXFbMl0ucGF0aCldO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMucmVuZGVyX2xvZy5uZXdfZW1iZWRkaW5ncyArPSByZXFfYmF0Y2gubGVuZ3RoO1xuICAgICAgICAvLyBhZGQgdG9rZW4gdXNhZ2UgdG8gcmVuZGVyX2xvZ1xuICAgICAgICB0aGlzLnJlbmRlcl9sb2cudG9rZW5fdXNhZ2UgKz0gcmVxdWVzdFJlc3VsdHMudXNhZ2UudG90YWxfdG9rZW5zO1xuICAgICAgfVxuICAgICAgLy8gY29uc29sZS5sb2cocmVxdWVzdFJlc3VsdHMuZGF0YS5sZW5ndGgpO1xuICAgICAgLy8gbG9vcCB0aHJvdWdoIHJlcXVlc3RSZXN1bHRzLmRhdGFcbiAgICAgIGZvcihsZXQgaSA9IDA7IGkgPCByZXF1ZXN0UmVzdWx0cy5kYXRhLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGNvbnN0IHZlYyA9IHJlcXVlc3RSZXN1bHRzLmRhdGFbaV0uZW1iZWRkaW5nO1xuICAgICAgICBjb25zdCBpbmRleCA9IHJlcXVlc3RSZXN1bHRzLmRhdGFbaV0uaW5kZXg7XG4gICAgICAgIGlmKHZlYykge1xuICAgICAgICAgIGNvbnN0IGtleSA9IHJlcV9iYXRjaFtpbmRleF1bMF07XG4gICAgICAgICAgY29uc3QgbWV0YSA9IHJlcV9iYXRjaFtpbmRleF1bMl07XG4gICAgICAgICAgdGhpcy5zbWFydF92ZWNfbGl0ZS5zYXZlX2VtYmVkZGluZyhrZXksIHZlYywgbWV0YSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBhc3luYyByZXF1ZXN0X2VtYmVkZGluZ19mcm9tX2lucHV0KGVtYmVkX2lucHV0LCByZXRyaWVzID0gMCkge1xuICAgIC8vIChGT1IgVEVTVElORykgdGVzdCBmYWlsIHByb2Nlc3MgYnkgZm9yY2luZyBmYWlsXG4gICAgLy8gcmV0dXJuIG51bGw7XG4gICAgLy8gY2hlY2sgaWYgZW1iZWRfaW5wdXQgaXMgYSBzdHJpbmdcbiAgICAvLyBpZih0eXBlb2YgZW1iZWRfaW5wdXQgIT09IFwic3RyaW5nXCIpIHtcbiAgICAvLyAgIGNvbnNvbGUubG9nKFwiZW1iZWRfaW5wdXQgaXMgbm90IGEgc3RyaW5nXCIpO1xuICAgIC8vICAgcmV0dXJuIG51bGw7XG4gICAgLy8gfVxuICAgIC8vIGNoZWNrIGlmIGVtYmVkX2lucHV0IGlzIGVtcHR5XG4gICAgaWYoZW1iZWRfaW5wdXQubGVuZ3RoID09PSAwKSB7XG4gICAgICBjb25zb2xlLmxvZyhcImVtYmVkX2lucHV0IGlzIGVtcHR5XCIpO1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIGNvbnN0IHVzZWRQYXJhbXMgPSB7XG4gICAgICBtb2RlbDogXCJ0ZXh0LWVtYmVkZGluZy1hZGEtMDAyXCIsXG4gICAgICBpbnB1dDogZW1iZWRfaW5wdXQsXG4gICAgfTtcbiAgICAvLyBjb25zb2xlLmxvZyh0aGlzLnNldHRpbmdzLmFwaV9rZXkpO1xuICAgIGNvbnN0IHJlcVBhcmFtcyA9IHtcbiAgICAgIHVybDogYGh0dHBzOi8vYXBpLm9wZW5haS5jb20vdjEvZW1iZWRkaW5nc2AsXG4gICAgICBtZXRob2Q6IFwiUE9TVFwiLFxuICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkodXNlZFBhcmFtcyksXG4gICAgICBoZWFkZXJzOiB7XG4gICAgICAgIFwiQ29udGVudC1UeXBlXCI6IFwiYXBwbGljYXRpb24vanNvblwiLFxuICAgICAgICBcIkF1dGhvcml6YXRpb25cIjogYEJlYXJlciAke3RoaXMuc2V0dGluZ3MuYXBpX2tleX1gXG4gICAgICB9XG4gICAgfTtcbiAgICBsZXQgcmVzcDtcbiAgICB0cnkge1xuICAgICAgcmVzcCA9IGF3YWl0ICgwLCBPYnNpZGlhbi5yZXF1ZXN0KShyZXFQYXJhbXMpXG4gICAgICByZXR1cm4gSlNPTi5wYXJzZShyZXNwKTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgLy8gcmV0cnkgcmVxdWVzdCBpZiBlcnJvciBpcyA0MjlcbiAgICAgIGlmKChlcnJvci5zdGF0dXMgPT09IDQyOSkgJiYgKHJldHJpZXMgPCAzKSkge1xuICAgICAgICByZXRyaWVzKys7XG4gICAgICAgIC8vIGV4cG9uZW50aWFsIGJhY2tvZmZcbiAgICAgICAgY29uc3QgYmFja29mZiA9IE1hdGgucG93KHJldHJpZXMsIDIpO1xuICAgICAgICBjb25zb2xlLmxvZyhgcmV0cnlpbmcgcmVxdWVzdCAoNDI5KSBpbiAke2JhY2tvZmZ9IHNlY29uZHMuLi5gKTtcbiAgICAgICAgYXdhaXQgbmV3IFByb21pc2UociA9PiBzZXRUaW1lb3V0KHIsIDEwMDAgKiBiYWNrb2ZmKSk7XG4gICAgICAgIHJldHVybiBhd2FpdCB0aGlzLnJlcXVlc3RfZW1iZWRkaW5nX2Zyb21faW5wdXQoZW1iZWRfaW5wdXQsIHJldHJpZXMpO1xuICAgICAgfVxuICAgICAgLy8gbG9nIGZ1bGwgZXJyb3IgdG8gY29uc29sZVxuICAgICAgY29uc29sZS5sb2cocmVzcCk7XG4gICAgICAvLyBjb25zb2xlLmxvZyhcImZpcnN0IGxpbmUgb2YgZW1iZWQ6IFwiICsgZW1iZWRfaW5wdXQuc3Vic3RyaW5nKDAsIGVtYmVkX2lucHV0LmluZGV4T2YoXCJcXG5cIikpKTtcbiAgICAgIC8vIGNvbnNvbGUubG9nKFwiZW1iZWQgaW5wdXQgbGVuZ3RoOiBcIisgZW1iZWRfaW5wdXQubGVuZ3RoKTtcbiAgICAgIC8vIGlmKEFycmF5LmlzQXJyYXkoZW1iZWRfaW5wdXQpKSB7XG4gICAgICAvLyAgIGNvbnNvbGUubG9nKGVtYmVkX2lucHV0Lm1hcCgoaW5wdXQpID0+IGlucHV0Lmxlbmd0aCkpO1xuICAgICAgLy8gfVxuICAgICAgLy8gY29uc29sZS5sb2coXCJlcnJvbmVvdXMgZW1iZWQgaW5wdXQ6IFwiICsgZW1iZWRfaW5wdXQpO1xuICAgICAgY29uc29sZS5sb2coZXJyb3IpO1xuICAgICAgLy8gY29uc29sZS5sb2codXNlZFBhcmFtcyk7XG4gICAgICAvLyBjb25zb2xlLmxvZyh1c2VkUGFyYW1zLmlucHV0Lmxlbmd0aCk7XG4gICAgICByZXR1cm4gbnVsbDsgXG4gICAgfVxuICB9XG4gIGFzeW5jIHRlc3RfYXBpX2tleSgpIHtcbiAgICBjb25zdCBlbWJlZF9pbnB1dCA9IFwiVGhpcyBpcyBhIHRlc3Qgb2YgdGhlIE9wZW5BSSBBUEkuXCI7XG4gICAgY29uc3QgcmVzcCA9IGF3YWl0IHRoaXMucmVxdWVzdF9lbWJlZGRpbmdfZnJvbV9pbnB1dChlbWJlZF9pbnB1dCk7XG4gICAgaWYocmVzcCAmJiByZXNwLnVzYWdlKSB7XG4gICAgICBjb25zb2xlLmxvZyhcIkFQSSBrZXkgaXMgdmFsaWRcIik7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9ZWxzZXtcbiAgICAgIGNvbnNvbGUubG9nKFwiQVBJIGtleSBpcyBpbnZhbGlkXCIpO1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxuXG5cbiAgb3V0cHV0X3JlbmRlcl9sb2coKSB7XG4gICAgLy8gaWYgc2V0dGluZ3MubG9nX3JlbmRlciBpcyB0cnVlXG4gICAgaWYodGhpcy5zZXR0aW5ncy5sb2dfcmVuZGVyKSB7XG4gICAgICBpZiAodGhpcy5yZW5kZXJfbG9nLm5ld19lbWJlZGRpbmdzID09PSAwKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1lbHNle1xuICAgICAgICAvLyBwcmV0dHkgcHJpbnQgdGhpcy5yZW5kZXJfbG9nIHRvIGNvbnNvbGVcbiAgICAgICAgY29uc29sZS5sb2coSlNPTi5zdHJpbmdpZnkodGhpcy5yZW5kZXJfbG9nLCBudWxsLCAyKSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gY2xlYXIgcmVuZGVyX2xvZ1xuICAgIHRoaXMucmVuZGVyX2xvZyA9IHt9O1xuICAgIHRoaXMucmVuZGVyX2xvZy5kZWxldGVkX2VtYmVkZGluZ3MgPSAwO1xuICAgIHRoaXMucmVuZGVyX2xvZy5leGNsdXNpb25zX2xvZ3MgPSB7fTtcbiAgICB0aGlzLnJlbmRlcl9sb2cuZmFpbGVkX2VtYmVkZGluZ3MgPSBbXTtcbiAgICB0aGlzLnJlbmRlcl9sb2cuZmlsZXMgPSBbXTtcbiAgICB0aGlzLnJlbmRlcl9sb2cubmV3X2VtYmVkZGluZ3MgPSAwO1xuICAgIHRoaXMucmVuZGVyX2xvZy5za2lwcGVkX2xvd19kZWx0YSA9IHt9O1xuICAgIHRoaXMucmVuZGVyX2xvZy50b2tlbl91c2FnZSA9IDA7XG4gICAgdGhpcy5yZW5kZXJfbG9nLnRva2Vuc19zYXZlZF9ieV9jYWNoZSA9IDA7XG4gIH1cblxuICAvLyBmaW5kIGNvbm5lY3Rpb25zIGJ5IG1vc3Qgc2ltaWxhciB0byBjdXJyZW50IG5vdGUgYnkgY29zaW5lIHNpbWlsYXJpdHlcbiAgYXN5bmMgZmluZF9ub3RlX2Nvbm5lY3Rpb25zKGN1cnJlbnRfbm90ZT1udWxsKSB7XG4gICAgLy8gbWQ1IG9mIGN1cnJlbnQgbm90ZSBwYXRoXG4gICAgY29uc3QgY3Vycl9rZXkgPSBtZDUoY3VycmVudF9ub3RlLnBhdGgpO1xuICAgIC8vIGlmIGluIHRoaXMubmVhcmVzdF9jYWNoZSB0aGVuIHNldCB0byBuZWFyZXN0XG4gICAgLy8gZWxzZSBnZXQgbmVhcmVzdFxuICAgIGxldCBuZWFyZXN0ID0gW107XG4gICAgaWYodGhpcy5uZWFyZXN0X2NhY2hlW2N1cnJfa2V5XSkge1xuICAgICAgbmVhcmVzdCA9IHRoaXMubmVhcmVzdF9jYWNoZVtjdXJyX2tleV07XG4gICAgICAvLyBjb25zb2xlLmxvZyhcIm5lYXJlc3QgZnJvbSBjYWNoZVwiKTtcbiAgICB9ZWxzZXtcbiAgICAgIC8vIHNraXAgZmlsZXMgd2hlcmUgcGF0aCBjb250YWlucyBhbnkgZXhjbHVzaW9uc1xuICAgICAgZm9yKGxldCBqID0gMDsgaiA8IHRoaXMuZmlsZV9leGNsdXNpb25zLmxlbmd0aDsgaisrKSB7XG4gICAgICAgIGlmKGN1cnJlbnRfbm90ZS5wYXRoLmluZGV4T2YodGhpcy5maWxlX2V4Y2x1c2lvbnNbal0pID4gLTEpIHtcbiAgICAgICAgICB0aGlzLmxvZ19leGNsdXNpb24odGhpcy5maWxlX2V4Y2x1c2lvbnNbal0pO1xuICAgICAgICAgIC8vIGJyZWFrIG91dCBvZiBsb29wIGFuZCBmaW5pc2ggaGVyZVxuICAgICAgICAgIHJldHVybiBcImV4Y2x1ZGVkXCI7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIC8vIGdldCBhbGwgZW1iZWRkaW5nc1xuICAgICAgLy8gYXdhaXQgdGhpcy5nZXRfYWxsX2VtYmVkZGluZ3MoKTtcbiAgICAgIC8vIHdyYXAgZ2V0IGFsbCBpbiBzZXRUaW1lb3V0IHRvIGFsbG93IGZvciBVSSB0byB1cGRhdGVcbiAgICAgIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICB0aGlzLmdldF9hbGxfZW1iZWRkaW5ncygpXG4gICAgICB9LCAzMDAwKTtcbiAgICAgIC8vIGdldCBmcm9tIGNhY2hlIGlmIG10aW1lIGlzIHNhbWUgYW5kIHZhbHVlcyBhcmUgbm90IGVtcHR5XG4gICAgICBpZih0aGlzLnNtYXJ0X3ZlY19saXRlLm10aW1lX2lzX2N1cnJlbnQoY3Vycl9rZXksIGN1cnJlbnRfbm90ZS5zdGF0Lm10aW1lKSkge1xuICAgICAgICAvLyBza2lwcGluZyBnZXQgZmlsZSBlbWJlZGRpbmdzIGJlY2F1c2Ugbm90aGluZyBoYXMgY2hhbmdlZFxuICAgICAgICAvLyBjb25zb2xlLmxvZyhcImZpbmRfbm90ZV9jb25uZWN0aW9ucyAtIHNraXBwaW5nIGZpbGUgKG10aW1lKVwiKTtcbiAgICAgIH1lbHNle1xuICAgICAgICAvLyBnZXQgZmlsZSBlbWJlZGRpbmdzXG4gICAgICAgIGF3YWl0IHRoaXMuZ2V0X2ZpbGVfZW1iZWRkaW5ncyhjdXJyZW50X25vdGUpO1xuICAgICAgfVxuICAgICAgLy8gZ2V0IGN1cnJlbnQgbm90ZSBlbWJlZGRpbmcgdmVjdG9yXG4gICAgICBjb25zdCB2ZWMgPSB0aGlzLnNtYXJ0X3ZlY19saXRlLmdldF92ZWMoY3Vycl9rZXkpO1xuICAgICAgaWYoIXZlYykge1xuICAgICAgICByZXR1cm4gXCJFcnJvciBnZXR0aW5nIGVtYmVkZGluZ3MgZm9yOiBcIitjdXJyZW50X25vdGUucGF0aDtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgLy8gY29tcHV0ZSBjb3NpbmUgc2ltaWxhcml0eSBiZXR3ZWVuIGN1cnJlbnQgbm90ZSBhbmQgYWxsIG90aGVyIG5vdGVzIHZpYSBlbWJlZGRpbmdzXG4gICAgICBuZWFyZXN0ID0gdGhpcy5zbWFydF92ZWNfbGl0ZS5uZWFyZXN0KHZlYywge1xuICAgICAgICBza2lwX2tleTogY3Vycl9rZXksXG4gICAgICAgIHNraXBfc2VjdGlvbnM6IHRoaXMuc2V0dGluZ3Muc2tpcF9zZWN0aW9ucyxcbiAgICAgIH0pO1xuICBcbiAgICAgIC8vIHNhdmUgdG8gdGhpcy5uZWFyZXN0X2NhY2hlXG4gICAgICB0aGlzLm5lYXJlc3RfY2FjaGVbY3Vycl9rZXldID0gbmVhcmVzdDtcbiAgICB9XG5cbiAgICAvLyByZXR1cm4gYXJyYXkgc29ydGVkIGJ5IGNvc2luZSBzaW1pbGFyaXR5XG4gICAgcmV0dXJuIG5lYXJlc3Q7XG4gIH1cbiAgXG4gIC8vIGNyZWF0ZSByZW5kZXJfbG9nIG9iamVjdCBvZiBleGx1c2lvbnMgd2l0aCBudW1iZXIgb2YgdGltZXMgc2tpcHBlZCBhcyB2YWx1ZVxuICBsb2dfZXhjbHVzaW9uKGV4Y2x1c2lvbikge1xuICAgIC8vIGluY3JlbWVudCByZW5kZXJfbG9nIGZvciBza2lwcGVkIGZpbGVcbiAgICB0aGlzLnJlbmRlcl9sb2cuZXhjbHVzaW9uc19sb2dzW2V4Y2x1c2lvbl0gPSAodGhpcy5yZW5kZXJfbG9nLmV4Y2x1c2lvbnNfbG9nc1tleGNsdXNpb25dIHx8IDApICsgMTtcbiAgfVxuICBcblxuICBibG9ja19wYXJzZXIobWFya2Rvd24sIGZpbGVfcGF0aCl7XG4gICAgLy8gaWYgdGhpcy5zZXR0aW5ncy5za2lwX3NlY3Rpb25zIGlzIHRydWUgdGhlbiByZXR1cm4gZW1wdHkgYXJyYXlcbiAgICBpZih0aGlzLnNldHRpbmdzLnNraXBfc2VjdGlvbnMpIHtcbiAgICAgIHJldHVybiBbXTtcbiAgICB9XG4gICAgLy8gc3BsaXQgdGhlIG1hcmtkb3duIGludG8gbGluZXNcbiAgICBjb25zdCBsaW5lcyA9IG1hcmtkb3duLnNwbGl0KCdcXG4nKTtcbiAgICAvLyBpbml0aWFsaXplIHRoZSBibG9ja3MgYXJyYXlcbiAgICBsZXQgYmxvY2tzID0gW107XG4gICAgLy8gY3VycmVudCBoZWFkZXJzIGFycmF5XG4gICAgbGV0IGN1cnJlbnRIZWFkZXJzID0gW107XG4gICAgLy8gcmVtb3ZlIC5tZCBmaWxlIGV4dGVuc2lvbiBhbmQgY29udmVydCBmaWxlX3BhdGggdG8gYnJlYWRjcnVtYiBmb3JtYXR0aW5nXG4gICAgY29uc3QgZmlsZV9icmVhZGNydW1icyA9IGZpbGVfcGF0aC5yZXBsYWNlKCcubWQnLCAnJykucmVwbGFjZSgvXFwvL2csICcgPiAnKTtcbiAgICAvLyBpbml0aWFsaXplIHRoZSBibG9jayBzdHJpbmdcbiAgICBsZXQgYmxvY2sgPSAnJztcbiAgICBsZXQgYmxvY2tfaGVhZGluZ3MgPSAnJztcbiAgICBsZXQgYmxvY2tfcGF0aCA9IGZpbGVfcGF0aDtcblxuICAgIGxldCBsYXN0X2hlYWRpbmdfbGluZSA9IDA7XG4gICAgbGV0IGkgPSAwO1xuICAgIGxldCBibG9ja19oZWFkaW5nc19saXN0ID0gW107XG4gICAgLy8gbG9vcCB0aHJvdWdoIHRoZSBsaW5lc1xuICAgIGZvciAoaSA9IDA7IGkgPCBsaW5lcy5sZW5ndGg7IGkrKykge1xuICAgICAgLy8gZ2V0IHRoZSBsaW5lXG4gICAgICBjb25zdCBsaW5lID0gbGluZXNbaV07XG4gICAgICAvLyBpZiBsaW5lIGRvZXMgbm90IHN0YXJ0IHdpdGggI1xuICAgICAgLy8gb3IgaWYgbGluZSBzdGFydHMgd2l0aCAjIGFuZCBzZWNvbmQgY2hhcmFjdGVyIGlzIGEgd29yZCBvciBudW1iZXIgaW5kaWNhdGluZyBhIFwidGFnXCJcbiAgICAgIC8vIHRoZW4gYWRkIHRvIGJsb2NrXG4gICAgICBpZiAoIWxpbmUuc3RhcnRzV2l0aCgnIycpIHx8IChbJyMnLCcgJ10uaW5kZXhPZihsaW5lWzFdKSA8IDApKXtcbiAgICAgICAgLy8gc2tpcCBpZiBsaW5lIGlzIGVtcHR5XG4gICAgICAgIGlmKGxpbmUgPT09ICcnKSBjb250aW51ZTtcbiAgICAgICAgLy8gc2tpcCBpZiBsaW5lIGlzIGVtcHR5IGJ1bGxldCBvciBjaGVja2JveFxuICAgICAgICBpZihbJy0gJywgJy0gWyBdICddLmluZGV4T2YobGluZSkgPiAtMSkgY29udGludWU7XG4gICAgICAgIC8vIGlmIGN1cnJlbnRIZWFkZXJzIGlzIGVtcHR5IHNraXAgKG9ubHkgYmxvY2tzIHdpdGggaGVhZGVycywgb3RoZXJ3aXNlIGJsb2NrLnBhdGggY29uZmxpY3RzIHdpdGggZmlsZS5wYXRoKVxuICAgICAgICBpZihjdXJyZW50SGVhZGVycy5sZW5ndGggPT09IDApIGNvbnRpbnVlO1xuICAgICAgICAvLyBhZGQgbGluZSB0byBibG9ja1xuICAgICAgICBibG9jayArPSBcIlxcblwiICsgbGluZTtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgICAvKipcbiAgICAgICAqIEJFR0lOIEhlYWRpbmcgcGFyc2luZ1xuICAgICAgICogLSBsaWtlbHkgYSBoZWFkaW5nIGlmIG1hZGUgaXQgdGhpcyBmYXJcbiAgICAgICAqL1xuICAgICAgbGFzdF9oZWFkaW5nX2xpbmUgPSBpO1xuICAgICAgLy8gcHVzaCB0aGUgY3VycmVudCBibG9jayB0byB0aGUgYmxvY2tzIGFycmF5IHVubGVzcyBsYXN0IGxpbmUgd2FzIGEgYWxzbyBhIGhlYWRlclxuICAgICAgaWYoaSA+IDAgJiYgKGxhc3RfaGVhZGluZ19saW5lICE9PSAoaS0xKSkgJiYgKGJsb2NrLmluZGV4T2YoXCJcXG5cIikgPiAtMSkgJiYgdGhpcy52YWxpZGF0ZV9oZWFkaW5ncyhibG9ja19oZWFkaW5ncykpIHtcbiAgICAgICAgb3V0cHV0X2Jsb2NrKCk7XG4gICAgICB9XG4gICAgICAvLyBnZXQgdGhlIGhlYWRlciBsZXZlbFxuICAgICAgY29uc3QgbGV2ZWwgPSBsaW5lLnNwbGl0KCcjJykubGVuZ3RoIC0gMTtcbiAgICAgIC8vIHJlbW92ZSBhbnkgaGVhZGVycyBmcm9tIHRoZSBjdXJyZW50IGhlYWRlcnMgYXJyYXkgdGhhdCBhcmUgaGlnaGVyIHRoYW4gdGhlIGN1cnJlbnQgaGVhZGVyIGxldmVsXG4gICAgICBjdXJyZW50SGVhZGVycyA9IGN1cnJlbnRIZWFkZXJzLmZpbHRlcihoZWFkZXIgPT4gaGVhZGVyLmxldmVsIDwgbGV2ZWwpO1xuICAgICAgLy8gYWRkIGhlYWRlciBhbmQgbGV2ZWwgdG8gY3VycmVudCBoZWFkZXJzIGFycmF5XG4gICAgICAvLyB0cmltIHRoZSBoZWFkZXIgdG8gcmVtb3ZlIFwiI1wiIGFuZCBhbnkgdHJhaWxpbmcgc3BhY2VzXG4gICAgICBjdXJyZW50SGVhZGVycy5wdXNoKHtoZWFkZXI6IGxpbmUucmVwbGFjZSgvIy9nLCAnJykudHJpbSgpLCBsZXZlbDogbGV2ZWx9KTtcbiAgICAgIC8vIGluaXRpYWxpemUgdGhlIGJsb2NrIGJyZWFkY3J1bWJzIHdpdGggZmlsZS5wYXRoIHRoZSBjdXJyZW50IGhlYWRlcnNcbiAgICAgIGJsb2NrID0gZmlsZV9icmVhZGNydW1icztcbiAgICAgIGJsb2NrICs9IFwiOiBcIiArIGN1cnJlbnRIZWFkZXJzLm1hcChoZWFkZXIgPT4gaGVhZGVyLmhlYWRlcikuam9pbignID4gJyk7XG4gICAgICBibG9ja19oZWFkaW5ncyA9IFwiI1wiK2N1cnJlbnRIZWFkZXJzLm1hcChoZWFkZXIgPT4gaGVhZGVyLmhlYWRlcikuam9pbignIycpO1xuICAgICAgLy8gaWYgYmxvY2tfaGVhZGluZ3MgaXMgYWxyZWFkeSBpbiBibG9ja19oZWFkaW5nc19saXN0IHRoZW4gYWRkIGEgbnVtYmVyIHRvIHRoZSBlbmRcbiAgICAgIGlmKGJsb2NrX2hlYWRpbmdzX2xpc3QuaW5kZXhPZihibG9ja19oZWFkaW5ncykgPiAtMSkge1xuICAgICAgICBsZXQgY291bnQgPSAxO1xuICAgICAgICB3aGlsZShibG9ja19oZWFkaW5nc19saXN0LmluZGV4T2YoYCR7YmxvY2tfaGVhZGluZ3N9eyR7Y291bnR9fWApID4gLTEpIHtcbiAgICAgICAgICBjb3VudCsrO1xuICAgICAgICB9XG4gICAgICAgIGJsb2NrX2hlYWRpbmdzID0gYCR7YmxvY2tfaGVhZGluZ3N9eyR7Y291bnR9fWA7XG4gICAgICB9XG4gICAgICBibG9ja19oZWFkaW5nc19saXN0LnB1c2goYmxvY2tfaGVhZGluZ3MpO1xuICAgICAgYmxvY2tfcGF0aCA9IGZpbGVfcGF0aCArIGJsb2NrX2hlYWRpbmdzO1xuICAgIH1cbiAgICAvLyBoYW5kbGUgcmVtYWluaW5nIGFmdGVyIGxvb3BcbiAgICBpZigobGFzdF9oZWFkaW5nX2xpbmUgIT09IChpLTEpKSAmJiAoYmxvY2suaW5kZXhPZihcIlxcblwiKSA+IC0xKSAmJiB0aGlzLnZhbGlkYXRlX2hlYWRpbmdzKGJsb2NrX2hlYWRpbmdzKSkgb3V0cHV0X2Jsb2NrKCk7XG4gICAgLy8gcmVtb3ZlIGFueSBibG9ja3MgdGhhdCBhcmUgdG9vIHNob3J0IChsZW5ndGggPCA1MClcbiAgICBibG9ja3MgPSBibG9ja3MuZmlsdGVyKGIgPT4gYi5sZW5ndGggPiA1MCk7XG4gICAgLy8gY29uc29sZS5sb2coYmxvY2tzKTtcbiAgICAvLyByZXR1cm4gdGhlIGJsb2NrcyBhcnJheVxuICAgIHJldHVybiBibG9ja3M7XG5cbiAgICBmdW5jdGlvbiBvdXRwdXRfYmxvY2soKSB7XG4gICAgICAvLyBicmVhZGNydW1icyBsZW5ndGggKGZpcnN0IGxpbmUgb2YgYmxvY2spXG4gICAgICBjb25zdCBicmVhZGNydW1ic19sZW5ndGggPSBibG9jay5pbmRleE9mKFwiXFxuXCIpICsgMTtcbiAgICAgIGNvbnN0IGJsb2NrX2xlbmd0aCA9IGJsb2NrLmxlbmd0aCAtIGJyZWFkY3J1bWJzX2xlbmd0aDtcbiAgICAgIC8vIHRyaW0gYmxvY2sgdG8gbWF4IGxlbmd0aFxuICAgICAgaWYgKGJsb2NrLmxlbmd0aCA+IE1BWF9FTUJFRF9TVFJJTkdfTEVOR1RIKSB7XG4gICAgICAgIGJsb2NrID0gYmxvY2suc3Vic3RyaW5nKDAsIE1BWF9FTUJFRF9TVFJJTkdfTEVOR1RIKTtcbiAgICAgIH1cbiAgICAgIGJsb2Nrcy5wdXNoKHsgdGV4dDogYmxvY2sudHJpbSgpLCBwYXRoOiBibG9ja19wYXRoLCBsZW5ndGg6IGJsb2NrX2xlbmd0aCB9KTtcbiAgICB9XG4gIH1cbiAgLy8gcmV2ZXJzZS1yZXRyaWV2ZSBibG9jayBnaXZlbiBwYXRoXG4gIGFzeW5jIGJsb2NrX3JldHJpZXZlcihwYXRoLCBsaW1pdHM9e30pIHtcbiAgICBsaW1pdHMgPSB7XG4gICAgICBsaW5lczogbnVsbCxcbiAgICAgIGNoYXJzX3Blcl9saW5lOiBudWxsLFxuICAgICAgbWF4X2NoYXJzOiBudWxsLFxuICAgICAgLi4ubGltaXRzXG4gICAgfVxuICAgIC8vIHJldHVybiBpZiBubyAjIGluIHBhdGhcbiAgICBpZiAocGF0aC5pbmRleE9mKCcjJykgPCAwKSB7XG4gICAgICBjb25zb2xlLmxvZyhcIm5vdCBhIGJsb2NrIHBhdGg6IFwiK3BhdGgpO1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICBsZXQgYmxvY2sgPSBbXTtcbiAgICBsZXQgYmxvY2tfaGVhZGluZ3MgPSBwYXRoLnNwbGl0KCcjJykuc2xpY2UoMSk7XG4gICAgLy8gaWYgcGF0aCBlbmRzIHdpdGggbnVtYmVyIGluIGN1cmx5IGJyYWNlc1xuICAgIGxldCBoZWFkaW5nX29jY3VycmVuY2UgPSAwO1xuICAgIGlmKGJsb2NrX2hlYWRpbmdzW2Jsb2NrX2hlYWRpbmdzLmxlbmd0aC0xXS5pbmRleE9mKCd7JykgPiAtMSkge1xuICAgICAgLy8gZ2V0IHRoZSBvY2N1cnJlbmNlIG51bWJlclxuICAgICAgaGVhZGluZ19vY2N1cnJlbmNlID0gcGFyc2VJbnQoYmxvY2tfaGVhZGluZ3NbYmxvY2tfaGVhZGluZ3MubGVuZ3RoLTFdLnNwbGl0KCd7JylbMV0ucmVwbGFjZSgnfScsICcnKSk7XG4gICAgICAvLyByZW1vdmUgdGhlIG9jY3VycmVuY2UgZnJvbSB0aGUgbGFzdCBoZWFkaW5nXG4gICAgICBibG9ja19oZWFkaW5nc1tibG9ja19oZWFkaW5ncy5sZW5ndGgtMV0gPSBibG9ja19oZWFkaW5nc1tibG9ja19oZWFkaW5ncy5sZW5ndGgtMV0uc3BsaXQoJ3snKVswXTtcbiAgICB9XG4gICAgbGV0IGN1cnJlbnRIZWFkZXJzID0gW107XG4gICAgbGV0IG9jY3VycmVuY2VfY291bnQgPSAwO1xuICAgIGxldCBiZWdpbl9saW5lID0gMDtcbiAgICBsZXQgaSA9IDA7XG4gICAgLy8gZ2V0IGZpbGUgcGF0aCBmcm9tIHBhdGhcbiAgICBjb25zdCBmaWxlX3BhdGggPSBwYXRoLnNwbGl0KCcjJylbMF07XG4gICAgLy8gZ2V0IGZpbGVcbiAgICBjb25zdCBmaWxlID0gdGhpcy5hcHAudmF1bHQuZ2V0QWJzdHJhY3RGaWxlQnlQYXRoKGZpbGVfcGF0aCk7XG4gICAgaWYoIShmaWxlIGluc3RhbmNlb2YgT2JzaWRpYW4uVEZpbGUpKSB7XG4gICAgICBjb25zb2xlLmxvZyhcIm5vdCBhIGZpbGU6IFwiK2ZpbGVfcGF0aCk7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIC8vIGdldCBmaWxlIGNvbnRlbnRzXG4gICAgY29uc3QgZmlsZV9jb250ZW50cyA9IGF3YWl0IHRoaXMuYXBwLnZhdWx0LmNhY2hlZFJlYWQoZmlsZSk7XG4gICAgLy8gc3BsaXQgdGhlIGZpbGUgY29udGVudHMgaW50byBsaW5lc1xuICAgIGNvbnN0IGxpbmVzID0gZmlsZV9jb250ZW50cy5zcGxpdCgnXFxuJyk7XG4gICAgLy8gbG9vcCB0aHJvdWdoIHRoZSBsaW5lc1xuICAgIGxldCBpc19jb2RlID0gZmFsc2U7XG4gICAgZm9yIChpID0gMDsgaSA8IGxpbmVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAvLyBnZXQgdGhlIGxpbmVcbiAgICAgIGNvbnN0IGxpbmUgPSBsaW5lc1tpXTtcbiAgICAgIC8vIGlmIGxpbmUgYmVnaW5zIHdpdGggdGhyZWUgYmFja3RpY2tzIHRoZW4gdG9nZ2xlIGlzX2NvZGVcbiAgICAgIGlmKGxpbmUuaW5kZXhPZignYGBgJykgPT09IDApIHtcbiAgICAgICAgaXNfY29kZSA9ICFpc19jb2RlO1xuICAgICAgfVxuICAgICAgLy8gaWYgaXNfY29kZSBpcyB0cnVlIHRoZW4gYWRkIGxpbmUgd2l0aCBwcmVjZWRpbmcgdGFiIGFuZCBjb250aW51ZVxuICAgICAgaWYoaXNfY29kZSkge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIC8vIHNraXAgaWYgbGluZSBpcyBlbXB0eSBidWxsZXQgb3IgY2hlY2tib3hcbiAgICAgIGlmKFsnLSAnLCAnLSBbIF0gJ10uaW5kZXhPZihsaW5lKSA+IC0xKSBjb250aW51ZTtcbiAgICAgIC8vIGlmIGxpbmUgZG9lcyBub3Qgc3RhcnQgd2l0aCAjXG4gICAgICAvLyBvciBpZiBsaW5lIHN0YXJ0cyB3aXRoICMgYW5kIHNlY29uZCBjaGFyYWN0ZXIgaXMgYSB3b3JkIG9yIG51bWJlciBpbmRpY2F0aW5nIGEgXCJ0YWdcIlxuICAgICAgLy8gdGhlbiBjb250aW51ZSB0byBuZXh0IGxpbmVcbiAgICAgIGlmICghbGluZS5zdGFydHNXaXRoKCcjJykgfHwgKFsnIycsJyAnXS5pbmRleE9mKGxpbmVbMV0pIDwgMCkpe1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIC8qKlxuICAgICAgICogQkVHSU4gSGVhZGluZyBwYXJzaW5nXG4gICAgICAgKiAtIGxpa2VseSBhIGhlYWRpbmcgaWYgbWFkZSBpdCB0aGlzIGZhclxuICAgICAgICovXG4gICAgICAvLyBnZXQgdGhlIGhlYWRpbmcgdGV4dFxuICAgICAgY29uc3QgaGVhZGluZ190ZXh0ID0gbGluZS5yZXBsYWNlKC8jL2csICcnKS50cmltKCk7XG4gICAgICAvLyBjb250aW51ZSBpZiBoZWFkaW5nIHRleHQgaXMgbm90IGluIGJsb2NrX2hlYWRpbmdzXG4gICAgICBjb25zdCBoZWFkaW5nX2luZGV4ID0gYmxvY2tfaGVhZGluZ3MuaW5kZXhPZihoZWFkaW5nX3RleHQpO1xuICAgICAgaWYgKGhlYWRpbmdfaW5kZXggPCAwKSBjb250aW51ZTtcbiAgICAgIC8vIGlmIGN1cnJlbnRIZWFkZXJzLmxlbmd0aCAhPT0gaGVhZGluZ19pbmRleCB0aGVuIHdlIGhhdmUgYSBtaXNtYXRjaFxuICAgICAgaWYgKGN1cnJlbnRIZWFkZXJzLmxlbmd0aCAhPT0gaGVhZGluZ19pbmRleCkgY29udGludWU7XG4gICAgICAvLyBwdXNoIHRoZSBoZWFkaW5nIHRleHQgdG8gdGhlIGN1cnJlbnRIZWFkZXJzIGFycmF5XG4gICAgICBjdXJyZW50SGVhZGVycy5wdXNoKGhlYWRpbmdfdGV4dCk7XG4gICAgICAvLyBpZiBjdXJyZW50SGVhZGVycy5sZW5ndGggPT09IGJsb2NrX2hlYWRpbmdzLmxlbmd0aCB0aGVuIHdlIGhhdmUgYSBtYXRjaFxuICAgICAgaWYgKGN1cnJlbnRIZWFkZXJzLmxlbmd0aCA9PT0gYmxvY2tfaGVhZGluZ3MubGVuZ3RoKSB7XG4gICAgICAgIC8vIGlmIGhlYWRpbmdfb2NjdXJyZW5jZSBpcyBkZWZpbmVkIHRoZW4gaW5jcmVtZW50IG9jY3VycmVuY2VfY291bnRcbiAgICAgICAgaWYoaGVhZGluZ19vY2N1cnJlbmNlID09PSAwKSB7XG4gICAgICAgICAgLy8gc2V0IGJlZ2luX2xpbmUgdG8gaSArIDFcbiAgICAgICAgICBiZWdpbl9saW5lID0gaSArIDE7XG4gICAgICAgICAgYnJlYWs7IC8vIGJyZWFrIG91dCBvZiBsb29wXG4gICAgICAgIH1cbiAgICAgICAgLy8gaWYgb2NjdXJyZW5jZV9jb3VudCAhPT0gaGVhZGluZ19vY2N1cnJlbmNlIHRoZW4gY29udGludWVcbiAgICAgICAgaWYob2NjdXJyZW5jZV9jb3VudCA9PT0gaGVhZGluZ19vY2N1cnJlbmNlKXtcbiAgICAgICAgICBiZWdpbl9saW5lID0gaSArIDE7XG4gICAgICAgICAgYnJlYWs7IC8vIGJyZWFrIG91dCBvZiBsb29wXG4gICAgICAgIH1cbiAgICAgICAgb2NjdXJyZW5jZV9jb3VudCsrO1xuICAgICAgICAvLyByZXNldCBjdXJyZW50SGVhZGVyc1xuICAgICAgICBjdXJyZW50SGVhZGVycy5wb3AoKTtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgfVxuICAgIC8vIGlmIG5vIGJlZ2luX2xpbmUgdGhlbiByZXR1cm4gZmFsc2VcbiAgICBpZiAoYmVnaW5fbGluZSA9PT0gMCkgcmV0dXJuIGZhbHNlO1xuICAgIC8vIGl0ZXJhdGUgdGhyb3VnaCBsaW5lcyBzdGFydGluZyBhdCBiZWdpbl9saW5lXG4gICAgaXNfY29kZSA9IGZhbHNlO1xuICAgIC8vIGNoYXJhY3RlciBhY2N1bXVsYXRvclxuICAgIGxldCBjaGFyX2NvdW50ID0gMDtcbiAgICBmb3IgKGkgPSBiZWdpbl9saW5lOyBpIDwgbGluZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmKCh0eXBlb2YgbGluZV9saW1pdCA9PT0gXCJudW1iZXJcIikgJiYgKGJsb2NrLmxlbmd0aCA+IGxpbmVfbGltaXQpKXtcbiAgICAgICAgYmxvY2sucHVzaChcIi4uLlwiKTtcbiAgICAgICAgYnJlYWs7IC8vIGVuZHMgd2hlbiBsaW5lX2xpbWl0IGlzIHJlYWNoZWRcbiAgICAgIH1cbiAgICAgIGxldCBsaW5lID0gbGluZXNbaV07XG4gICAgICBpZiAoKGxpbmUuaW5kZXhPZignIycpID09PSAwKSAmJiAoWycjJywnICddLmluZGV4T2YobGluZVsxXSkgIT09IC0xKSl7XG4gICAgICAgIGJyZWFrOyAvLyBlbmRzIHdoZW4gZW5jb3VudGVyaW5nIG5leHQgaGVhZGVyXG4gICAgICB9XG4gICAgICAvLyBERVBSRUNBVEVEOiBzaG91bGQgYmUgaGFuZGxlZCBieSBuZXdfbGluZStjaGFyX2NvdW50IGNoZWNrIChoYXBwZW5zIGluIHByZXZpb3VzIGl0ZXJhdGlvbilcbiAgICAgIC8vIGlmIGNoYXJfY291bnQgaXMgZ3JlYXRlciB0aGFuIGxpbWl0Lm1heF9jaGFycywgc2tpcFxuICAgICAgaWYgKGxpbWl0cy5tYXhfY2hhcnMgJiYgY2hhcl9jb3VudCA+IGxpbWl0cy5tYXhfY2hhcnMpIHtcbiAgICAgICAgYmxvY2sucHVzaChcIi4uLlwiKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICAvLyBpZiBuZXdfbGluZSArIGNoYXJfY291bnQgaXMgZ3JlYXRlciB0aGFuIGxpbWl0Lm1heF9jaGFycywgc2tpcFxuICAgICAgaWYgKGxpbWl0cy5tYXhfY2hhcnMgJiYgKChsaW5lLmxlbmd0aCArIGNoYXJfY291bnQpID4gbGltaXRzLm1heF9jaGFycykpIHtcbiAgICAgICAgY29uc3QgbWF4X25ld19jaGFycyA9IGxpbWl0cy5tYXhfY2hhcnMgLSBjaGFyX2NvdW50O1xuICAgICAgICBsaW5lID0gbGluZS5zbGljZSgwLCBtYXhfbmV3X2NoYXJzKSArIFwiLi4uXCI7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgLy8gdmFsaWRhdGUvZm9ybWF0XG4gICAgICAvLyBpZiBsaW5lIGlzIGVtcHR5LCBza2lwXG4gICAgICBpZiAobGluZS5sZW5ndGggPT09IDApIGNvbnRpbnVlO1xuICAgICAgLy8gbGltaXQgbGVuZ3RoIG9mIGxpbmUgdG8gTiBjaGFyYWN0ZXJzXG4gICAgICBpZiAobGltaXRzLmNoYXJzX3Blcl9saW5lICYmIGxpbmUubGVuZ3RoID4gbGltaXRzLmNoYXJzX3Blcl9saW5lKSB7XG4gICAgICAgIGxpbmUgPSBsaW5lLnNsaWNlKDAsIGxpbWl0cy5jaGFyc19wZXJfbGluZSkgKyBcIi4uLlwiO1xuICAgICAgfVxuICAgICAgLy8gaWYgbGluZSBpcyBhIGNvZGUgYmxvY2ssIHNraXBcbiAgICAgIGlmIChsaW5lLnN0YXJ0c1dpdGgoXCJgYGBcIikpIHtcbiAgICAgICAgaXNfY29kZSA9ICFpc19jb2RlO1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIGlmIChpc19jb2RlKXtcbiAgICAgICAgLy8gYWRkIHRhYiB0byBiZWdpbm5pbmcgb2YgbGluZVxuICAgICAgICBsaW5lID0gXCJcXHRcIitsaW5lO1xuICAgICAgfVxuICAgICAgLy8gYWRkIGxpbmUgdG8gYmxvY2tcbiAgICAgIGJsb2NrLnB1c2gobGluZSk7XG4gICAgICAvLyBpbmNyZW1lbnQgY2hhcl9jb3VudFxuICAgICAgY2hhcl9jb3VudCArPSBsaW5lLmxlbmd0aDtcbiAgICB9XG4gICAgLy8gY2xvc2UgY29kZSBibG9jayBpZiBvcGVuXG4gICAgaWYgKGlzX2NvZGUpIHtcbiAgICAgIGJsb2NrLnB1c2goXCJgYGBcIik7XG4gICAgfVxuICAgIHJldHVybiBibG9jay5qb2luKFwiXFxuXCIpLnRyaW0oKTtcbiAgfVxuXG4gIC8vIHJldHJpZXZlIGEgZmlsZSBmcm9tIHRoZSB2YXVsdFxuICBhc3luYyBmaWxlX3JldHJpZXZlcihsaW5rLCBsaW1pdHM9e30pIHtcbiAgICBsaW1pdHMgPSB7XG4gICAgICBsaW5lczogbnVsbCxcbiAgICAgIG1heF9jaGFyczogbnVsbCxcbiAgICAgIGNoYXJzX3Blcl9saW5lOiBudWxsLFxuICAgICAgLi4ubGltaXRzXG4gICAgfTtcbiAgICBjb25zdCB0aGlzX2ZpbGUgPSB0aGlzLmFwcC52YXVsdC5nZXRBYnN0cmFjdEZpbGVCeVBhdGgobGluayk7XG4gICAgLy8gaWYgZmlsZSBpcyBub3QgZm91bmQsIHNraXBcbiAgICBpZiAoISh0aGlzX2ZpbGUgaW5zdGFuY2VvZiBPYnNpZGlhbi5UQWJzdHJhY3RGaWxlKSkgcmV0dXJuIGZhbHNlO1xuICAgIC8vIHVzZSBjYWNoZWRSZWFkIHRvIGdldCB0aGUgZmlyc3QgMTAgbGluZXMgb2YgdGhlIGZpbGVcbiAgICBjb25zdCBmaWxlX2NvbnRlbnQgPSBhd2FpdCB0aGlzLmFwcC52YXVsdC5jYWNoZWRSZWFkKHRoaXNfZmlsZSk7XG4gICAgY29uc3QgZmlsZV9saW5lcyA9IGZpbGVfY29udGVudC5zcGxpdChcIlxcblwiKTtcbiAgICBsZXQgZmlyc3RfdGVuX2xpbmVzID0gW107XG4gICAgbGV0IGlzX2NvZGUgPSBmYWxzZTtcbiAgICBsZXQgY2hhcl9hY2N1bSA9IDA7XG4gICAgY29uc3QgbGluZV9saW1pdCA9IGxpbWl0cy5saW5lcyB8fCBmaWxlX2xpbmVzLmxlbmd0aDtcbiAgICBmb3IgKGxldCBpID0gMDsgZmlyc3RfdGVuX2xpbmVzLmxlbmd0aCA8IGxpbmVfbGltaXQ7IGkrKykge1xuICAgICAgbGV0IGxpbmUgPSBmaWxlX2xpbmVzW2ldO1xuICAgICAgLy8gaWYgbGluZSBpcyB1bmRlZmluZWQsIGJyZWFrXG4gICAgICBpZiAodHlwZW9mIGxpbmUgPT09ICd1bmRlZmluZWQnKVxuICAgICAgICBicmVhaztcbiAgICAgIC8vIGlmIGxpbmUgaXMgZW1wdHksIHNraXBcbiAgICAgIGlmIChsaW5lLmxlbmd0aCA9PT0gMClcbiAgICAgICAgY29udGludWU7XG4gICAgICAvLyBsaW1pdCBsZW5ndGggb2YgbGluZSB0byBOIGNoYXJhY3RlcnNcbiAgICAgIGlmIChsaW1pdHMuY2hhcnNfcGVyX2xpbmUgJiYgbGluZS5sZW5ndGggPiBsaW1pdHMuY2hhcnNfcGVyX2xpbmUpIHtcbiAgICAgICAgbGluZSA9IGxpbmUuc2xpY2UoMCwgbGltaXRzLmNoYXJzX3Blcl9saW5lKSArIFwiLi4uXCI7XG4gICAgICB9XG4gICAgICAvLyBpZiBsaW5lIGlzIFwiLS0tXCIsIHNraXBcbiAgICAgIGlmIChsaW5lID09PSBcIi0tLVwiKVxuICAgICAgICBjb250aW51ZTtcbiAgICAgIC8vIHNraXAgaWYgbGluZSBpcyBlbXB0eSBidWxsZXQgb3IgY2hlY2tib3hcbiAgICAgIGlmIChbJy0gJywgJy0gWyBdICddLmluZGV4T2YobGluZSkgPiAtMSlcbiAgICAgICAgY29udGludWU7XG4gICAgICAvLyBpZiBsaW5lIGlzIGEgY29kZSBibG9jaywgc2tpcFxuICAgICAgaWYgKGxpbmUuaW5kZXhPZihcImBgYFwiKSA9PT0gMCkge1xuICAgICAgICBpc19jb2RlID0gIWlzX2NvZGU7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgICAgLy8gaWYgY2hhcl9hY2N1bSBpcyBncmVhdGVyIHRoYW4gbGltaXQubWF4X2NoYXJzLCBza2lwXG4gICAgICBpZiAobGltaXRzLm1heF9jaGFycyAmJiBjaGFyX2FjY3VtID4gbGltaXRzLm1heF9jaGFycykge1xuICAgICAgICBmaXJzdF90ZW5fbGluZXMucHVzaChcIi4uLlwiKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBpZiAoaXNfY29kZSkge1xuICAgICAgICAvLyBpZiBpcyBjb2RlLCBhZGQgdGFiIHRvIGJlZ2lubmluZyBvZiBsaW5lXG4gICAgICAgIGxpbmUgPSBcIlxcdFwiICsgbGluZTtcbiAgICAgIH1cbiAgICAgIC8vIGlmIGxpbmUgaXMgYSBoZWFkaW5nXG4gICAgICBpZiAobGluZV9pc19oZWFkaW5nKGxpbmUpKSB7XG4gICAgICAgIC8vIGxvb2sgYXQgbGFzdCBsaW5lIGluIGZpcnN0X3Rlbl9saW5lcyB0byBzZWUgaWYgaXQgaXMgYSBoZWFkaW5nXG4gICAgICAgIC8vIG5vdGU6IHVzZXMgbGFzdCBpbiBmaXJzdF90ZW5fbGluZXMsIGluc3RlYWQgb2YgbG9vayBhaGVhZCBpbiBmaWxlX2xpbmVzLCBiZWNhdXNlLi5cbiAgICAgICAgLy8gLi4ubmV4dCBsaW5lIG1heSBiZSBleGNsdWRlZCBmcm9tIGZpcnN0X3Rlbl9saW5lcyBieSBwcmV2aW91cyBpZiBzdGF0ZW1lbnRzXG4gICAgICAgIGlmICgoZmlyc3RfdGVuX2xpbmVzLmxlbmd0aCA+IDApICYmIGxpbmVfaXNfaGVhZGluZyhmaXJzdF90ZW5fbGluZXNbZmlyc3RfdGVuX2xpbmVzLmxlbmd0aCAtIDFdKSkge1xuICAgICAgICAgIC8vIGlmIGxhc3QgbGluZSBpcyBhIGhlYWRpbmcsIHJlbW92ZSBpdFxuICAgICAgICAgIGZpcnN0X3Rlbl9saW5lcy5wb3AoKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgLy8gYWRkIGxpbmUgdG8gZmlyc3RfdGVuX2xpbmVzXG4gICAgICBmaXJzdF90ZW5fbGluZXMucHVzaChsaW5lKTtcbiAgICAgIC8vIGluY3JlbWVudCBjaGFyX2FjY3VtXG4gICAgICBjaGFyX2FjY3VtICs9IGxpbmUubGVuZ3RoO1xuICAgIH1cbiAgICAvLyBmb3IgZWFjaCBsaW5lIGluIGZpcnN0X3Rlbl9saW5lcywgYXBwbHkgdmlldy1zcGVjaWZpYyBmb3JtYXR0aW5nXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBmaXJzdF90ZW5fbGluZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgIC8vIGlmIGxpbmUgaXMgYSBoZWFkaW5nXG4gICAgICBpZiAobGluZV9pc19oZWFkaW5nKGZpcnN0X3Rlbl9saW5lc1tpXSkpIHtcbiAgICAgICAgLy8gaWYgdGhpcyBpcyB0aGUgbGFzdCBsaW5lIGluIGZpcnN0X3Rlbl9saW5lc1xuICAgICAgICBpZiAoaSA9PT0gZmlyc3RfdGVuX2xpbmVzLmxlbmd0aCAtIDEpIHtcbiAgICAgICAgICAvLyByZW1vdmUgdGhlIGxhc3QgbGluZSBpZiBpdCBpcyBhIGhlYWRpbmdcbiAgICAgICAgICBmaXJzdF90ZW5fbGluZXMucG9wKCk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgICAgLy8gcmVtb3ZlIGhlYWRpbmcgc3ludGF4IHRvIGltcHJvdmUgcmVhZGFiaWxpdHkgaW4gc21hbGwgc3BhY2VcbiAgICAgICAgZmlyc3RfdGVuX2xpbmVzW2ldID0gZmlyc3RfdGVuX2xpbmVzW2ldLnJlcGxhY2UoLyMrLywgXCJcIik7XG4gICAgICAgIGZpcnN0X3Rlbl9saW5lc1tpXSA9IGBcXG4ke2ZpcnN0X3Rlbl9saW5lc1tpXX06YDtcbiAgICAgIH1cbiAgICB9XG4gICAgLy8gam9pbiBmaXJzdCB0ZW4gbGluZXMgaW50byBzdHJpbmdcbiAgICBmaXJzdF90ZW5fbGluZXMgPSBmaXJzdF90ZW5fbGluZXMuam9pbihcIlxcblwiKTtcbiAgICByZXR1cm4gZmlyc3RfdGVuX2xpbmVzO1xuICB9XG5cbiAgLy8gaXRlcmF0ZSB0aHJvdWdoIGJsb2NrcyBhbmQgc2tpcCBpZiBibG9ja19oZWFkaW5ncyBjb250YWlucyB0aGlzLmhlYWRlcl9leGNsdXNpb25zXG4gIHZhbGlkYXRlX2hlYWRpbmdzKGJsb2NrX2hlYWRpbmdzKSB7XG4gICAgbGV0IHZhbGlkID0gdHJ1ZTtcbiAgICBpZiAodGhpcy5oZWFkZXJfZXhjbHVzaW9ucy5sZW5ndGggPiAwKSB7XG4gICAgICBmb3IgKGxldCBrID0gMDsgayA8IHRoaXMuaGVhZGVyX2V4Y2x1c2lvbnMubGVuZ3RoOyBrKyspIHtcbiAgICAgICAgaWYgKGJsb2NrX2hlYWRpbmdzLmluZGV4T2YodGhpcy5oZWFkZXJfZXhjbHVzaW9uc1trXSkgPiAtMSkge1xuICAgICAgICAgIHZhbGlkID0gZmFsc2U7XG4gICAgICAgICAgdGhpcy5sb2dfZXhjbHVzaW9uKFwiaGVhZGluZzogXCIrdGhpcy5oZWFkZXJfZXhjbHVzaW9uc1trXSk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHZhbGlkO1xuICB9XG4gIC8vIHJlbmRlciBcIlNtYXJ0IENvbm5lY3Rpb25zXCIgdGV4dCBmaXhlZCBpbiB0aGUgYm90dG9tIHJpZ2h0IGNvcm5lclxuICByZW5kZXJfYnJhbmQoY29udGFpbmVyLCBsb2NhdGlvbj1cImRlZmF1bHRcIikge1xuICAgIC8vIGlmIGxvY2F0aW9uIGlzIGFsbCB0aGVuIGdldCBPYmplY3Qua2V5cyh0aGlzLnNjX2JyYW5kaW5nKSBhbmQgY2FsbCB0aGlzIGZ1bmN0aW9uIGZvciBlYWNoXG4gICAgaWYgKGNvbnRhaW5lciA9PT0gXCJhbGxcIikge1xuICAgICAgY29uc3QgbG9jYXRpb25zID0gT2JqZWN0LmtleXModGhpcy5zY19icmFuZGluZyk7XG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxvY2F0aW9ucy5sZW5ndGg7IGkrKykge1xuICAgICAgICB0aGlzLnJlbmRlcl9icmFuZCh0aGlzLnNjX2JyYW5kaW5nW2xvY2F0aW9uc1tpXV0sIGxvY2F0aW9uc1tpXSk7XG4gICAgICB9XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIC8vIGJyYW5kIGNvbnRhaW5lclxuICAgIHRoaXMuc2NfYnJhbmRpbmdbbG9jYXRpb25dID0gY29udGFpbmVyO1xuICAgIC8vIGlmIHRoaXMuc2NfYnJhbmRpbmdbbG9jYXRpb25dIGNvbnRhaW5zIGNoaWxkIHdpdGggY2xhc3MgXCJzYy1icmFuZFwiLCByZW1vdmUgaXRcbiAgICBpZiAodGhpcy5zY19icmFuZGluZ1tsb2NhdGlvbl0ucXVlcnlTZWxlY3RvcihcIi5zYy1icmFuZFwiKSkge1xuICAgICAgdGhpcy5zY19icmFuZGluZ1tsb2NhdGlvbl0ucXVlcnlTZWxlY3RvcihcIi5zYy1icmFuZFwiKS5yZW1vdmUoKTtcbiAgICB9XG4gICAgY29uc3QgYnJhbmRfY29udGFpbmVyID0gdGhpcy5zY19icmFuZGluZ1tsb2NhdGlvbl0uY3JlYXRlRWwoXCJkaXZcIiwgeyBjbHM6IFwic2MtYnJhbmRcIiB9KTtcbiAgICAvLyBhZGQgdGV4dFxuICAgIC8vIGFkZCBTVkcgc2lnbmFsIGljb24gdXNpbmcgZ2V0SWNvblxuICAgIE9ic2lkaWFuLnNldEljb24oYnJhbmRfY29udGFpbmVyLCBcInNtYXJ0LWNvbm5lY3Rpb25zXCIpO1xuICAgIGNvbnN0IGJyYW5kX3AgPSBicmFuZF9jb250YWluZXIuY3JlYXRlRWwoXCJwXCIpO1xuICAgIGxldCB0ZXh0ID0gXCJTbWFydCBDb25uZWN0aW9uc1wiO1xuICAgIGxldCBhdHRyID0ge307XG4gICAgLy8gaWYgdXBkYXRlIGF2YWlsYWJsZSwgY2hhbmdlIHRleHQgdG8gXCJVcGRhdGUgQXZhaWxhYmxlXCJcbiAgICBpZiAodGhpcy51cGRhdGVfYXZhaWxhYmxlKSB7XG4gICAgICB0ZXh0ID0gXCJVcGRhdGUgQXZhaWxhYmxlXCI7XG4gICAgICBhdHRyID0ge1xuICAgICAgICBzdHlsZTogXCJmb250LXdlaWdodDogNzAwO1wiXG4gICAgICB9O1xuICAgIH1cbiAgICBicmFuZF9wLmNyZWF0ZUVsKFwiYVwiLCB7XG4gICAgICBjbHM6IFwiXCIsXG4gICAgICB0ZXh0OiB0ZXh0LFxuICAgICAgaHJlZjogXCJodHRwczovL2dpdGh1Yi5jb20vYnJpYW5wZXRyby9vYnNpZGlhbi1zbWFydC1jb25uZWN0aW9ucy9kaXNjdXNzaW9uc1wiLFxuICAgICAgdGFyZ2V0OiBcIl9ibGFua1wiLFxuICAgICAgYXR0cjogYXR0clxuICAgIH0pO1xuICB9XG5cblxuICAvLyBjcmVhdGUgbGlzdCBvZiBuZWFyZXN0IG5vdGVzXG4gIGFzeW5jIHVwZGF0ZV9yZXN1bHRzKGNvbnRhaW5lciwgbmVhcmVzdCkge1xuICAgIGxldCBsaXN0O1xuICAgIC8vIGNoZWNrIGlmIGxpc3QgZXhpc3RzXG4gICAgaWYoKGNvbnRhaW5lci5jaGlsZHJlbi5sZW5ndGggPiAxKSAmJiAoY29udGFpbmVyLmNoaWxkcmVuWzFdLmNsYXNzTGlzdC5jb250YWlucyhcInNjLWxpc3RcIikpKXtcbiAgICAgIGxpc3QgPSBjb250YWluZXIuY2hpbGRyZW5bMV07XG4gICAgfVxuICAgIC8vIGlmIGxpc3QgZXhpc3RzLCBlbXB0eSBpdFxuICAgIGlmIChsaXN0KSB7XG4gICAgICBsaXN0LmVtcHR5KCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIGNyZWF0ZSBsaXN0IGVsZW1lbnRcbiAgICAgIGxpc3QgPSBjb250YWluZXIuY3JlYXRlRWwoXCJkaXZcIiwgeyBjbHM6IFwic2MtbGlzdFwiIH0pO1xuICAgIH1cbiAgICBsZXQgc2VhcmNoX3Jlc3VsdF9jbGFzcyA9IFwic2VhcmNoLXJlc3VsdFwiO1xuICAgIC8vIGlmIHNldHRpbmdzIGV4cGFuZGVkX3ZpZXcgaXMgZmFsc2UsIGFkZCBzYy1jb2xsYXBzZWQgY2xhc3NcbiAgICBpZighdGhpcy5zZXR0aW5ncy5leHBhbmRlZF92aWV3KSBzZWFyY2hfcmVzdWx0X2NsYXNzICs9IFwiIHNjLWNvbGxhcHNlZFwiO1xuXG4gICAgLy8gVE9ETzogYWRkIG9wdGlvbiB0byBncm91cCBuZWFyZXN0IGJ5IGZpbGVcbiAgICBpZighdGhpcy5zZXR0aW5ncy5ncm91cF9uZWFyZXN0X2J5X2ZpbGUpIHtcbiAgICAgIC8vIGZvciBlYWNoIG5lYXJlc3Qgbm90ZVxuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBuZWFyZXN0Lmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBCRUdJTiBFWFRFUk5BTCBMSU5LIExPR0lDXG4gICAgICAgICAqIGlmIGxpbmsgaXMgYW4gb2JqZWN0LCBpdCBpbmRpY2F0ZXMgZXh0ZXJuYWwgbGlua1xuICAgICAgICAgKi9cbiAgICAgICAgaWYgKHR5cGVvZiBuZWFyZXN0W2ldLmxpbmsgPT09IFwib2JqZWN0XCIpIHtcbiAgICAgICAgICBjb25zdCBpdGVtID0gbGlzdC5jcmVhdGVFbChcImRpdlwiLCB7IGNsczogXCJzZWFyY2gtcmVzdWx0XCIgfSk7XG4gICAgICAgICAgY29uc3QgbGluayA9IGl0ZW0uY3JlYXRlRWwoXCJhXCIsIHtcbiAgICAgICAgICAgIGNsczogXCJzZWFyY2gtcmVzdWx0LWZpbGUtdGl0bGUgaXMtY2xpY2thYmxlXCIsXG4gICAgICAgICAgICBocmVmOiBuZWFyZXN0W2ldLmxpbmsucGF0aCxcbiAgICAgICAgICAgIHRpdGxlOiBuZWFyZXN0W2ldLmxpbmsudGl0bGUsXG4gICAgICAgICAgfSk7XG4gICAgICAgICAgbGluay5pbm5lckhUTUwgPSB0aGlzLnJlbmRlcl9leHRlcm5hbF9saW5rX2VsbShuZWFyZXN0W2ldLmxpbmspO1xuICAgICAgICAgIGl0ZW0uc2V0QXR0cignZHJhZ2dhYmxlJywgJ3RydWUnKVxuICAgICAgICAgIGNvbnRpbnVlOyAvLyBlbmRzIGhlcmUgZm9yIGV4dGVybmFsIGxpbmtzXG4gICAgICAgIH1cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEJFR0lOIElOVEVSTkFMIExJTksgTE9HSUNcbiAgICAgICAgICogaWYgbGluayBpcyBhIHN0cmluZywgaXQgaW5kaWNhdGVzIGludGVybmFsIGxpbmtcbiAgICAgICAgICovXG4gICAgICAgIGxldCBmaWxlX2xpbmtfdGV4dDtcbiAgICAgICAgY29uc3QgZmlsZV9zaW1pbGFyaXR5X3BjdCA9IE1hdGgucm91bmQobmVhcmVzdFtpXS5zaW1pbGFyaXR5ICogMTAwKSArIFwiJVwiO1xuICAgICAgICBpZih0aGlzLnNldHRpbmdzLnNob3dfZnVsbF9wYXRoKSB7XG4gICAgICAgICAgY29uc3QgcGNzID0gbmVhcmVzdFtpXS5saW5rLnNwbGl0KFwiL1wiKTtcbiAgICAgICAgICBmaWxlX2xpbmtfdGV4dCA9IHBjc1twY3MubGVuZ3RoIC0gMV07XG4gICAgICAgICAgY29uc3QgcGF0aCA9IHBjcy5zbGljZSgwLCBwY3MubGVuZ3RoIC0gMSkuam9pbihcIi9cIik7XG4gICAgICAgICAgLy8gZmlsZV9saW5rX3RleHQgPSBgPHNtYWxsPiR7cGF0aH0gfCAke2ZpbGVfc2ltaWxhcml0eV9wY3R9PC9zbWFsbD48YnI+JHtmaWxlX2xpbmtfdGV4dH1gO1xuICAgICAgICAgIGZpbGVfbGlua190ZXh0ID0gYDxzbWFsbD4ke2ZpbGVfc2ltaWxhcml0eV9wY3R9IHwgJHtwYXRofSB8ICR7ZmlsZV9saW5rX3RleHR9PC9zbWFsbD5gO1xuICAgICAgICB9ZWxzZXtcbiAgICAgICAgICBmaWxlX2xpbmtfdGV4dCA9ICc8c21hbGw+JyArIGZpbGVfc2ltaWxhcml0eV9wY3QgKyBcIiB8IFwiICsgbmVhcmVzdFtpXS5saW5rLnNwbGl0KFwiL1wiKS5wb3AoKSArICc8L3NtYWxsPic7XG4gICAgICAgIH1cbiAgICAgICAgLy8gc2tpcCBjb250ZW50cyByZW5kZXJpbmcgaWYgaW5jb21wYXRpYmxlIGZpbGUgdHlwZVxuICAgICAgICAvLyBleC4gbm90IG1hcmtkb3duIGZpbGUgb3IgY29udGFpbnMgbm8gJy5leGNhbGlkcmF3J1xuICAgICAgICBpZighdGhpcy5yZW5kZXJhYmxlX2ZpbGVfdHlwZShuZWFyZXN0W2ldLmxpbmspKXtcbiAgICAgICAgICBjb25zdCBpdGVtID0gbGlzdC5jcmVhdGVFbChcImRpdlwiLCB7IGNsczogXCJzZWFyY2gtcmVzdWx0XCIgfSk7XG4gICAgICAgICAgY29uc3QgbGluayA9IGl0ZW0uY3JlYXRlRWwoXCJhXCIsIHtcbiAgICAgICAgICAgIGNsczogXCJzZWFyY2gtcmVzdWx0LWZpbGUtdGl0bGUgaXMtY2xpY2thYmxlXCIsXG4gICAgICAgICAgICBocmVmOiBuZWFyZXN0W2ldLmxpbmssXG4gICAgICAgICAgfSk7XG4gICAgICAgICAgbGluay5pbm5lckhUTUwgPSBmaWxlX2xpbmtfdGV4dDtcbiAgICAgICAgICAvLyBkcmFnIGFuZCBkcm9wXG4gICAgICAgICAgaXRlbS5zZXRBdHRyKCdkcmFnZ2FibGUnLCAndHJ1ZScpXG4gICAgICAgICAgLy8gYWRkIGxpc3RlbmVycyB0byBsaW5rXG4gICAgICAgICAgdGhpcy5hZGRfbGlua19saXN0ZW5lcnMobGluaywgbmVhcmVzdFtpXSwgaXRlbSk7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cblxuICAgICAgICAvLyByZW1vdmUgZmlsZSBleHRlbnNpb24gaWYgLm1kIGFuZCBtYWtlICMgaW50byA+XG4gICAgICAgIGZpbGVfbGlua190ZXh0ID0gZmlsZV9saW5rX3RleHQucmVwbGFjZShcIi5tZFwiLCBcIlwiKS5yZXBsYWNlKC8jL2csIFwiID4gXCIpO1xuICAgICAgICAvLyBjcmVhdGUgaXRlbVxuICAgICAgICBjb25zdCBpdGVtID0gbGlzdC5jcmVhdGVFbChcImRpdlwiLCB7IGNsczogc2VhcmNoX3Jlc3VsdF9jbGFzcyB9KTtcbiAgICAgICAgLy8gY3JlYXRlIHNwYW4gZm9yIHRvZ2dsZVxuICAgICAgICBjb25zdCB0b2dnbGUgPSBpdGVtLmNyZWF0ZUVsKFwic3BhblwiLCB7IGNsczogXCJpcy1jbGlja2FibGVcIiB9KTtcbiAgICAgICAgLy8gaW5zZXJ0IHJpZ2h0IHRyaWFuZ2xlIHN2ZyBhcyB0b2dnbGVcbiAgICAgICAgT2JzaWRpYW4uc2V0SWNvbih0b2dnbGUsIFwicmlnaHQtdHJpYW5nbGVcIik7IC8vIG11c3QgY29tZSBiZWZvcmUgYWRkaW5nIG90aGVyIGVsbXMgdG8gcHJldmVudCBvdmVyd3JpdGVcbiAgICAgICAgY29uc3QgbGluayA9IHRvZ2dsZS5jcmVhdGVFbChcImFcIiwge1xuICAgICAgICAgIGNsczogXCJzZWFyY2gtcmVzdWx0LWZpbGUtdGl0bGVcIixcbiAgICAgICAgICB0aXRsZTogbmVhcmVzdFtpXS5saW5rLFxuICAgICAgICB9KTtcbiAgICAgICAgbGluay5pbm5lckhUTUwgPSBmaWxlX2xpbmtfdGV4dDtcbiAgICAgICAgLy8gYWRkIGxpc3RlbmVycyB0byBsaW5rXG4gICAgICAgIHRoaXMuYWRkX2xpbmtfbGlzdGVuZXJzKGxpbmssIG5lYXJlc3RbaV0sIGl0ZW0pO1xuICAgICAgICB0b2dnbGUuYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIChldmVudCkgPT4ge1xuICAgICAgICAgIC8vIGZpbmQgcGFyZW50IGNvbnRhaW5pbmcgc2VhcmNoLXJlc3VsdCBjbGFzc1xuICAgICAgICAgIGxldCBwYXJlbnQgPSBldmVudC50YXJnZXQucGFyZW50RWxlbWVudDtcbiAgICAgICAgICB3aGlsZSAoIXBhcmVudC5jbGFzc0xpc3QuY29udGFpbnMoXCJzZWFyY2gtcmVzdWx0XCIpKSB7XG4gICAgICAgICAgICBwYXJlbnQgPSBwYXJlbnQucGFyZW50RWxlbWVudDtcbiAgICAgICAgICB9XG4gICAgICAgICAgLy8gdG9nZ2xlIHNjLWNvbGxhcHNlZCBjbGFzc1xuICAgICAgICAgIHBhcmVudC5jbGFzc0xpc3QudG9nZ2xlKFwic2MtY29sbGFwc2VkXCIpO1xuICAgICAgICB9KTtcbiAgICAgICAgY29uc3QgY29udGVudHMgPSBpdGVtLmNyZWF0ZUVsKFwidWxcIiwgeyBjbHM6IFwiXCIgfSk7XG4gICAgICAgIGNvbnN0IGNvbnRlbnRzX2NvbnRhaW5lciA9IGNvbnRlbnRzLmNyZWF0ZUVsKFwibGlcIiwge1xuICAgICAgICAgIGNsczogXCJzZWFyY2gtcmVzdWx0LWZpbGUtdGl0bGUgaXMtY2xpY2thYmxlXCIsXG4gICAgICAgICAgdGl0bGU6IG5lYXJlc3RbaV0ubGluayxcbiAgICAgICAgfSk7XG4gICAgICAgIGlmKG5lYXJlc3RbaV0ubGluay5pbmRleE9mKFwiI1wiKSA+IC0xKXsgLy8gaXMgYmxvY2tcbiAgICAgICAgICBPYnNpZGlhbi5NYXJrZG93blJlbmRlcmVyLnJlbmRlck1hcmtkb3duKChhd2FpdCB0aGlzLmJsb2NrX3JldHJpZXZlcihuZWFyZXN0W2ldLmxpbmssIHtsaW5lczogMTAsIG1heF9jaGFyczogMTAwMH0pKSwgY29udGVudHNfY29udGFpbmVyLCBuZWFyZXN0W2ldLmxpbmssIG5ldyBPYnNpZGlhbi5Db21wb25lbnQoKSk7XG4gICAgICAgIH1lbHNleyAvLyBpcyBmaWxlXG4gICAgICAgICAgY29uc3QgZmlyc3RfdGVuX2xpbmVzID0gYXdhaXQgdGhpcy5maWxlX3JldHJpZXZlcihuZWFyZXN0W2ldLmxpbmssIHtsaW5lczogMTAsIG1heF9jaGFyczogMTAwMH0pO1xuICAgICAgICAgIGlmKCFmaXJzdF90ZW5fbGluZXMpIGNvbnRpbnVlOyAvLyBza2lwIGlmIGZpbGUgaXMgZW1wdHlcbiAgICAgICAgICBPYnNpZGlhbi5NYXJrZG93blJlbmRlcmVyLnJlbmRlck1hcmtkb3duKGZpcnN0X3Rlbl9saW5lcywgY29udGVudHNfY29udGFpbmVyLCBuZWFyZXN0W2ldLmxpbmssIG5ldyBPYnNpZGlhbi5Db21wb25lbnQoKSk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5hZGRfbGlua19saXN0ZW5lcnMoY29udGVudHMsIG5lYXJlc3RbaV0sIGl0ZW0pO1xuICAgICAgfVxuICAgICAgdGhpcy5yZW5kZXJfYnJhbmQoY29udGFpbmVyLCBcImJsb2NrXCIpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIGdyb3VwIG5lYXJlc3QgYnkgZmlsZVxuICAgIGNvbnN0IG5lYXJlc3RfYnlfZmlsZSA9IHt9O1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbmVhcmVzdC5sZW5ndGg7IGkrKykge1xuICAgICAgY29uc3QgY3VyciA9IG5lYXJlc3RbaV07XG4gICAgICBjb25zdCBsaW5rID0gY3Vyci5saW5rO1xuICAgICAgLy8gc2tpcCBpZiBsaW5rIGlzIGFuIG9iamVjdCAoaW5kaWNhdGVzIGV4dGVybmFsIGxvZ2ljKVxuICAgICAgaWYgKHR5cGVvZiBsaW5rID09PSBcIm9iamVjdFwiKSB7XG4gICAgICAgIG5lYXJlc3RfYnlfZmlsZVtsaW5rLnBhdGhdID0gW2N1cnJdO1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIGlmIChsaW5rLmluZGV4T2YoXCIjXCIpID4gLTEpIHtcbiAgICAgICAgY29uc3QgZmlsZV9wYXRoID0gbGluay5zcGxpdChcIiNcIilbMF07XG4gICAgICAgIGlmICghbmVhcmVzdF9ieV9maWxlW2ZpbGVfcGF0aF0pIHtcbiAgICAgICAgICBuZWFyZXN0X2J5X2ZpbGVbZmlsZV9wYXRoXSA9IFtdO1xuICAgICAgICB9XG4gICAgICAgIG5lYXJlc3RfYnlfZmlsZVtmaWxlX3BhdGhdLnB1c2gobmVhcmVzdFtpXSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpZiAoIW5lYXJlc3RfYnlfZmlsZVtsaW5rXSkge1xuICAgICAgICAgIG5lYXJlc3RfYnlfZmlsZVtsaW5rXSA9IFtdO1xuICAgICAgICB9XG4gICAgICAgIC8vIGFsd2F5cyBhZGQgdG8gZnJvbnQgb2YgYXJyYXlcbiAgICAgICAgbmVhcmVzdF9ieV9maWxlW2xpbmtdLnVuc2hpZnQobmVhcmVzdFtpXSk7XG4gICAgICB9XG4gICAgfVxuICAgIC8vIGZvciBlYWNoIGZpbGVcbiAgICBjb25zdCBrZXlzID0gT2JqZWN0LmtleXMobmVhcmVzdF9ieV9maWxlKTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGtleXMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGNvbnN0IGZpbGUgPSBuZWFyZXN0X2J5X2ZpbGVba2V5c1tpXV07XG4gICAgICAvKipcbiAgICAgICAqIEJlZ2luIGV4dGVybmFsIGxpbmsgaGFuZGxpbmdcbiAgICAgICAqL1xuICAgICAgLy8gaWYgbGluayBpcyBhbiBvYmplY3QgKGluZGljYXRlcyB2MiBsb2dpYylcbiAgICAgIGlmICh0eXBlb2YgZmlsZVswXS5saW5rID09PSBcIm9iamVjdFwiKSB7XG4gICAgICAgIGNvbnN0IGN1cnIgPSBmaWxlWzBdO1xuICAgICAgICBjb25zdCBtZXRhID0gY3Vyci5saW5rO1xuICAgICAgICBpZiAobWV0YS5wYXRoLnN0YXJ0c1dpdGgoXCJodHRwXCIpKSB7XG4gICAgICAgICAgY29uc3QgaXRlbSA9IGxpc3QuY3JlYXRlRWwoXCJkaXZcIiwgeyBjbHM6IFwic2VhcmNoLXJlc3VsdFwiIH0pO1xuICAgICAgICAgIGNvbnN0IGxpbmsgPSBpdGVtLmNyZWF0ZUVsKFwiYVwiLCB7XG4gICAgICAgICAgICBjbHM6IFwic2VhcmNoLXJlc3VsdC1maWxlLXRpdGxlIGlzLWNsaWNrYWJsZVwiLFxuICAgICAgICAgICAgaHJlZjogbWV0YS5wYXRoLFxuICAgICAgICAgICAgdGl0bGU6IG1ldGEudGl0bGUsXG4gICAgICAgICAgfSk7XG4gICAgICAgICAgbGluay5pbm5lckhUTUwgPSB0aGlzLnJlbmRlcl9leHRlcm5hbF9saW5rX2VsbShtZXRhKTtcbiAgICAgICAgICBpdGVtLnNldEF0dHIoJ2RyYWdnYWJsZScsICd0cnVlJyk7XG4gICAgICAgICAgY29udGludWU7IC8vIGVuZHMgaGVyZSBmb3IgZXh0ZXJuYWwgbGlua3NcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgLyoqXG4gICAgICAgKiBIYW5kbGVzIEludGVybmFsXG4gICAgICAgKi9cbiAgICAgIGxldCBmaWxlX2xpbmtfdGV4dDtcbiAgICAgIGNvbnN0IGZpbGVfc2ltaWxhcml0eV9wY3QgPSBNYXRoLnJvdW5kKGZpbGVbMF0uc2ltaWxhcml0eSAqIDEwMCkgKyBcIiVcIjtcbiAgICAgIGlmICh0aGlzLnNldHRpbmdzLnNob3dfZnVsbF9wYXRoKSB7XG4gICAgICAgIGNvbnN0IHBjcyA9IGZpbGVbMF0ubGluay5zcGxpdChcIi9cIik7XG4gICAgICAgIGZpbGVfbGlua190ZXh0ID0gcGNzW3Bjcy5sZW5ndGggLSAxXTtcbiAgICAgICAgY29uc3QgcGF0aCA9IHBjcy5zbGljZSgwLCBwY3MubGVuZ3RoIC0gMSkuam9pbihcIi9cIik7XG4gICAgICAgIGZpbGVfbGlua190ZXh0ID0gYDxzbWFsbD4ke3BhdGh9IHwgJHtmaWxlX3NpbWlsYXJpdHlfcGN0fTwvc21hbGw+PGJyPiR7ZmlsZV9saW5rX3RleHR9YDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGZpbGVfbGlua190ZXh0ID0gZmlsZVswXS5saW5rLnNwbGl0KFwiL1wiKS5wb3AoKTtcbiAgICAgICAgLy8gYWRkIHNpbWlsYXJpdHkgcGVyY2VudGFnZVxuICAgICAgICBmaWxlX2xpbmtfdGV4dCArPSAnIHwgJyArIGZpbGVfc2ltaWxhcml0eV9wY3Q7XG4gICAgICB9XG5cblxuICAgICAgICBcbiAgICAgIC8vIHNraXAgY29udGVudHMgcmVuZGVyaW5nIGlmIGluY29tcGF0aWJsZSBmaWxlIHR5cGVcbiAgICAgIC8vIGV4LiBub3QgbWFya2Rvd24gb3IgY29udGFpbnMgJy5leGNhbGlkcmF3J1xuICAgICAgaWYoIXRoaXMucmVuZGVyYWJsZV9maWxlX3R5cGUoZmlsZVswXS5saW5rKSkge1xuICAgICAgICBjb25zdCBpdGVtID0gbGlzdC5jcmVhdGVFbChcImRpdlwiLCB7IGNsczogXCJzZWFyY2gtcmVzdWx0XCIgfSk7XG4gICAgICAgIGNvbnN0IGZpbGVfbGluayA9IGl0ZW0uY3JlYXRlRWwoXCJhXCIsIHtcbiAgICAgICAgICBjbHM6IFwic2VhcmNoLXJlc3VsdC1maWxlLXRpdGxlIGlzLWNsaWNrYWJsZVwiLFxuICAgICAgICAgIHRpdGxlOiBmaWxlWzBdLmxpbmssXG4gICAgICAgIH0pO1xuICAgICAgICBmaWxlX2xpbmsuaW5uZXJIVE1MID0gZmlsZV9saW5rX3RleHQ7XG4gICAgICAgIC8vIGFkZCBsaW5rIGxpc3RlbmVycyB0byBmaWxlIGxpbmtcbiAgICAgICAgdGhpcy5hZGRfbGlua19saXN0ZW5lcnMoZmlsZV9saW5rLCBmaWxlWzBdLCBpdGVtKTtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cblxuICAgICAgLy8gcmVtb3ZlIGZpbGUgZXh0ZW5zaW9uIGlmIC5tZFxuICAgICAgZmlsZV9saW5rX3RleHQgPSBmaWxlX2xpbmtfdGV4dC5yZXBsYWNlKFwiLm1kXCIsIFwiXCIpLnJlcGxhY2UoLyMvZywgXCIgPiBcIik7XG4gICAgICBjb25zdCBpdGVtID0gbGlzdC5jcmVhdGVFbChcImRpdlwiLCB7IGNsczogc2VhcmNoX3Jlc3VsdF9jbGFzcyB9KTtcbiAgICAgIGNvbnN0IHRvZ2dsZSA9IGl0ZW0uY3JlYXRlRWwoXCJzcGFuXCIsIHsgY2xzOiBcImlzLWNsaWNrYWJsZVwiIH0pO1xuICAgICAgLy8gaW5zZXJ0IHJpZ2h0IHRyaWFuZ2xlIHN2ZyBpY29uIGFzIHRvZ2dsZSBidXR0b24gaW4gc3BhblxuICAgICAgT2JzaWRpYW4uc2V0SWNvbih0b2dnbGUsIFwicmlnaHQtdHJpYW5nbGVcIik7IC8vIG11c3QgY29tZSBiZWZvcmUgYWRkaW5nIG90aGVyIGVsbXMgZWxzZSBvdmVyd3JpdGVzXG4gICAgICBjb25zdCBmaWxlX2xpbmsgPSB0b2dnbGUuY3JlYXRlRWwoXCJhXCIsIHtcbiAgICAgICAgY2xzOiBcInNlYXJjaC1yZXN1bHQtZmlsZS10aXRsZVwiLFxuICAgICAgICB0aXRsZTogZmlsZVswXS5saW5rLFxuICAgICAgfSk7XG4gICAgICBmaWxlX2xpbmsuaW5uZXJIVE1MID0gZmlsZV9saW5rX3RleHQ7XG4gICAgICAvLyBhZGQgbGluayBsaXN0ZW5lcnMgdG8gZmlsZSBsaW5rXG4gICAgICB0aGlzLmFkZF9saW5rX2xpc3RlbmVycyhmaWxlX2xpbmssIGZpbGVbMF0sIHRvZ2dsZSk7XG4gICAgICB0b2dnbGUuYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIChldmVudCkgPT4ge1xuICAgICAgICAvLyBmaW5kIHBhcmVudCBjb250YWluaW5nIGNsYXNzIHNlYXJjaC1yZXN1bHRcbiAgICAgICAgbGV0IHBhcmVudCA9IGV2ZW50LnRhcmdldDtcbiAgICAgICAgd2hpbGUgKCFwYXJlbnQuY2xhc3NMaXN0LmNvbnRhaW5zKFwic2VhcmNoLXJlc3VsdFwiKSkge1xuICAgICAgICAgIHBhcmVudCA9IHBhcmVudC5wYXJlbnRFbGVtZW50O1xuICAgICAgICB9XG4gICAgICAgIHBhcmVudC5jbGFzc0xpc3QudG9nZ2xlKFwic2MtY29sbGFwc2VkXCIpO1xuICAgICAgICAvLyBUT0RPOiBpZiBibG9jayBjb250YWluZXIgaXMgZW1wdHksIHJlbmRlciBtYXJrZG93biBmcm9tIGJsb2NrIHJldHJpZXZlclxuICAgICAgfSk7XG4gICAgICBjb25zdCBmaWxlX2xpbmtfbGlzdCA9IGl0ZW0uY3JlYXRlRWwoXCJ1bFwiKTtcbiAgICAgIC8vIGZvciBlYWNoIGxpbmsgaW4gZmlsZVxuICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCBmaWxlLmxlbmd0aDsgaisrKSB7XG4gICAgICAgIC8vIGlmIGlzIGEgYmxvY2sgKGhhcyAjIGluIGxpbmspXG4gICAgICAgIGlmKGZpbGVbal0ubGluay5pbmRleE9mKFwiI1wiKSA+IC0xKSB7XG4gICAgICAgICAgY29uc3QgYmxvY2sgPSBmaWxlW2pdO1xuICAgICAgICAgIGNvbnN0IGJsb2NrX2xpbmsgPSBmaWxlX2xpbmtfbGlzdC5jcmVhdGVFbChcImxpXCIsIHtcbiAgICAgICAgICAgIGNsczogXCJzZWFyY2gtcmVzdWx0LWZpbGUtdGl0bGUgaXMtY2xpY2thYmxlXCIsXG4gICAgICAgICAgICB0aXRsZTogYmxvY2subGluayxcbiAgICAgICAgICB9KTtcbiAgICAgICAgICAvLyBza2lwIGJsb2NrIGNvbnRleHQgaWYgZmlsZS5sZW5ndGggPT09IDEgYmVjYXVzZSBhbHJlYWR5IGFkZGVkXG4gICAgICAgICAgaWYoZmlsZS5sZW5ndGggPiAxKSB7XG4gICAgICAgICAgICBjb25zdCBibG9ja19jb250ZXh0ID0gdGhpcy5yZW5kZXJfYmxvY2tfY29udGV4dChibG9jayk7XG4gICAgICAgICAgICBjb25zdCBibG9ja19zaW1pbGFyaXR5X3BjdCA9IE1hdGgucm91bmQoYmxvY2suc2ltaWxhcml0eSAqIDEwMCkgKyBcIiVcIjtcbiAgICAgICAgICAgIGJsb2NrX2xpbmsuaW5uZXJIVE1MID0gYDxzbWFsbD4ke2Jsb2NrX2NvbnRleHR9IHwgJHtibG9ja19zaW1pbGFyaXR5X3BjdH08L3NtYWxsPmA7XG4gICAgICAgICAgfVxuICAgICAgICAgIGNvbnN0IGJsb2NrX2NvbnRhaW5lciA9IGJsb2NrX2xpbmsuY3JlYXRlRWwoXCJkaXZcIik7XG4gICAgICAgICAgLy8gVE9ETzogbW92ZSB0byByZW5kZXJpbmcgb24gZXhwYW5kaW5nIHNlY3Rpb24gKHRvZ2dsZSBjb2xsYXBzZWQpXG4gICAgICAgICAgT2JzaWRpYW4uTWFya2Rvd25SZW5kZXJlci5yZW5kZXJNYXJrZG93bigoYXdhaXQgdGhpcy5ibG9ja19yZXRyaWV2ZXIoYmxvY2subGluaywge2xpbmVzOiAxMCwgbWF4X2NoYXJzOiAxMDAwfSkpLCBibG9ja19jb250YWluZXIsIGJsb2NrLmxpbmssIG5ldyBPYnNpZGlhbi5Db21wb25lbnQoKSk7XG4gICAgICAgICAgLy8gYWRkIGxpbmsgbGlzdGVuZXJzIHRvIGJsb2NrIGxpbmtcbiAgICAgICAgICB0aGlzLmFkZF9saW5rX2xpc3RlbmVycyhibG9ja19saW5rLCBibG9jaywgZmlsZV9saW5rX2xpc3QpO1xuICAgICAgICB9ZWxzZXtcbiAgICAgICAgICAvLyBnZXQgZmlyc3QgdGVuIGxpbmVzIG9mIGZpbGVcbiAgICAgICAgICBjb25zdCBmaWxlX2xpbmtfbGlzdCA9IGl0ZW0uY3JlYXRlRWwoXCJ1bFwiKTtcbiAgICAgICAgICBjb25zdCBibG9ja19saW5rID0gZmlsZV9saW5rX2xpc3QuY3JlYXRlRWwoXCJsaVwiLCB7XG4gICAgICAgICAgICBjbHM6IFwic2VhcmNoLXJlc3VsdC1maWxlLXRpdGxlIGlzLWNsaWNrYWJsZVwiLFxuICAgICAgICAgICAgdGl0bGU6IGZpbGVbMF0ubGluayxcbiAgICAgICAgICB9KTtcbiAgICAgICAgICBjb25zdCBibG9ja19jb250YWluZXIgPSBibG9ja19saW5rLmNyZWF0ZUVsKFwiZGl2XCIpO1xuICAgICAgICAgIGxldCBmaXJzdF90ZW5fbGluZXMgPSBhd2FpdCB0aGlzLmZpbGVfcmV0cmlldmVyKGZpbGVbMF0ubGluaywge2xpbmVzOiAxMCwgbWF4X2NoYXJzOiAxMDAwfSk7XG4gICAgICAgICAgaWYoIWZpcnN0X3Rlbl9saW5lcykgY29udGludWU7IC8vIGlmIGZpbGUgbm90IGZvdW5kLCBza2lwXG4gICAgICAgICAgT2JzaWRpYW4uTWFya2Rvd25SZW5kZXJlci5yZW5kZXJNYXJrZG93bihmaXJzdF90ZW5fbGluZXMsIGJsb2NrX2NvbnRhaW5lciwgZmlsZVswXS5saW5rLCBuZXcgT2JzaWRpYW4uQ29tcG9uZW50KCkpO1xuICAgICAgICAgIHRoaXMuYWRkX2xpbmtfbGlzdGVuZXJzKGJsb2NrX2xpbmssIGZpbGVbMF0sIGZpbGVfbGlua19saXN0KTtcblxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHRoaXMucmVuZGVyX2JyYW5kKGNvbnRhaW5lciwgXCJmaWxlXCIpO1xuICB9XG5cbiAgYWRkX2xpbmtfbGlzdGVuZXJzKGl0ZW0sIGN1cnIsIGxpc3QpIHtcbiAgICBpdGVtLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCBhc3luYyAoZXZlbnQpID0+IHtcbiAgICAgIGF3YWl0IHRoaXMub3Blbl9ub3RlKGN1cnIsIGV2ZW50KTtcbiAgICB9KTtcbiAgICAvLyBkcmFnLW9uXG4gICAgLy8gY3VycmVudGx5IG9ubHkgd29ya3Mgd2l0aCBmdWxsLWZpbGUgbGlua3NcbiAgICBpdGVtLnNldEF0dHIoJ2RyYWdnYWJsZScsICd0cnVlJyk7XG4gICAgaXRlbS5hZGRFdmVudExpc3RlbmVyKCdkcmFnc3RhcnQnLCAoZXZlbnQpID0+IHtcbiAgICAgIGNvbnN0IGRyYWdNYW5hZ2VyID0gdGhpcy5hcHAuZHJhZ01hbmFnZXI7XG4gICAgICBjb25zdCBmaWxlX3BhdGggPSBjdXJyLmxpbmsuc3BsaXQoXCIjXCIpWzBdO1xuICAgICAgY29uc3QgZmlsZSA9IHRoaXMuYXBwLm1ldGFkYXRhQ2FjaGUuZ2V0Rmlyc3RMaW5rcGF0aERlc3QoZmlsZV9wYXRoLCAnJyk7XG4gICAgICBjb25zdCBkcmFnRGF0YSA9IGRyYWdNYW5hZ2VyLmRyYWdGaWxlKGV2ZW50LCBmaWxlKTtcbiAgICAgIC8vIGNvbnNvbGUubG9nKGRyYWdEYXRhKTtcbiAgICAgIGRyYWdNYW5hZ2VyLm9uRHJhZ1N0YXJ0KGV2ZW50LCBkcmFnRGF0YSk7XG4gICAgfSk7XG4gICAgLy8gaWYgY3Vyci5saW5rIGNvbnRhaW5zIGN1cmx5IGJyYWNlcywgcmV0dXJuIChpbmNvbXBhdGlibGUgd2l0aCBob3Zlci1saW5rKVxuICAgIGlmIChjdXJyLmxpbmsuaW5kZXhPZihcIntcIikgPiAtMSkgcmV0dXJuO1xuICAgIC8vIHRyaWdnZXIgaG92ZXIgZXZlbnQgb24gbGlua1xuICAgIGl0ZW0uYWRkRXZlbnRMaXN0ZW5lcihcIm1vdXNlb3ZlclwiLCAoZXZlbnQpID0+IHtcbiAgICAgIHRoaXMuYXBwLndvcmtzcGFjZS50cmlnZ2VyKFwiaG92ZXItbGlua1wiLCB7XG4gICAgICAgIGV2ZW50LFxuICAgICAgICBzb3VyY2U6IFNNQVJUX0NPTk5FQ1RJT05TX1ZJRVdfVFlQRSxcbiAgICAgICAgaG92ZXJQYXJlbnQ6IGxpc3QsXG4gICAgICAgIHRhcmdldEVsOiBpdGVtLFxuICAgICAgICBsaW5rdGV4dDogY3Vyci5saW5rLFxuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cblxuICAvLyBnZXQgdGFyZ2V0IGZpbGUgZnJvbSBsaW5rIHBhdGhcbiAgLy8gaWYgc3ViLXNlY3Rpb24gaXMgbGlua2VkLCBvcGVuIGZpbGUgYW5kIHNjcm9sbCB0byBzdWItc2VjdGlvblxuICBhc3luYyBvcGVuX25vdGUoY3VyciwgZXZlbnQ9bnVsbCkge1xuICAgIGxldCB0YXJnZXRGaWxlO1xuICAgIGxldCBoZWFkaW5nO1xuICAgIGlmIChjdXJyLmxpbmsuaW5kZXhPZihcIiNcIikgPiAtMSkge1xuICAgICAgLy8gcmVtb3ZlIGFmdGVyICMgZnJvbSBsaW5rXG4gICAgICB0YXJnZXRGaWxlID0gdGhpcy5hcHAubWV0YWRhdGFDYWNoZS5nZXRGaXJzdExpbmtwYXRoRGVzdChjdXJyLmxpbmsuc3BsaXQoXCIjXCIpWzBdLCBcIlwiKTtcbiAgICAgIC8vIGNvbnNvbGUubG9nKHRhcmdldEZpbGUpO1xuICAgICAgY29uc3QgdGFyZ2V0X2ZpbGVfY2FjaGUgPSB0aGlzLmFwcC5tZXRhZGF0YUNhY2hlLmdldEZpbGVDYWNoZSh0YXJnZXRGaWxlKTtcbiAgICAgIC8vIGNvbnNvbGUubG9nKHRhcmdldF9maWxlX2NhY2hlKTtcbiAgICAgIC8vIGdldCBoZWFkaW5nXG4gICAgICBsZXQgaGVhZGluZ190ZXh0ID0gY3Vyci5saW5rLnNwbGl0KFwiI1wiKS5wb3AoKTtcbiAgICAgIC8vIGlmIGhlYWRpbmcgdGV4dCBjb250YWlucyBhIGN1cmx5IGJyYWNlLCBnZXQgdGhlIG51bWJlciBpbnNpZGUgdGhlIGN1cmx5IGJyYWNlcyBhcyBvY2N1cmVuY2VcbiAgICAgIGxldCBvY2N1cmVuY2UgPSAwO1xuICAgICAgaWYgKGhlYWRpbmdfdGV4dC5pbmRleE9mKFwie1wiKSA+IC0xKSB7XG4gICAgICAgIC8vIGdldCBvY2N1cmVuY2VcbiAgICAgICAgb2NjdXJlbmNlID0gcGFyc2VJbnQoaGVhZGluZ190ZXh0LnNwbGl0KFwie1wiKVsxXS5zcGxpdChcIn1cIilbMF0pO1xuICAgICAgICAvLyByZW1vdmUgb2NjdXJlbmNlIGZyb20gaGVhZGluZyB0ZXh0XG4gICAgICAgIGhlYWRpbmdfdGV4dCA9IGhlYWRpbmdfdGV4dC5zcGxpdChcIntcIilbMF07XG4gICAgICB9XG4gICAgICAvLyBnZXQgaGVhZGluZ3MgZnJvbSBmaWxlIGNhY2hlXG4gICAgICBjb25zdCBoZWFkaW5ncyA9IHRhcmdldF9maWxlX2NhY2hlLmhlYWRpbmdzO1xuICAgICAgLy8gZ2V0IGhlYWRpbmdzIHdpdGggdGhlIHNhbWUgZGVwdGggYW5kIHRleHQgYXMgdGhlIGxpbmtcbiAgICAgIGZvcihsZXQgaSA9IDA7IGkgPCBoZWFkaW5ncy5sZW5ndGg7IGkrKykge1xuICAgICAgICBpZiAoaGVhZGluZ3NbaV0uaGVhZGluZyA9PT0gaGVhZGluZ190ZXh0KSB7XG4gICAgICAgICAgLy8gaWYgb2NjdXJlbmNlIGlzIDAsIHNldCBoZWFkaW5nIGFuZCBicmVha1xuICAgICAgICAgIGlmKG9jY3VyZW5jZSA9PT0gMCkge1xuICAgICAgICAgICAgaGVhZGluZyA9IGhlYWRpbmdzW2ldO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfVxuICAgICAgICAgIG9jY3VyZW5jZS0tOyAvLyBkZWNyZW1lbnQgb2NjdXJlbmNlXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIC8vIGNvbnNvbGUubG9nKGhlYWRpbmcpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0YXJnZXRGaWxlID0gdGhpcy5hcHAubWV0YWRhdGFDYWNoZS5nZXRGaXJzdExpbmtwYXRoRGVzdChjdXJyLmxpbmssIFwiXCIpO1xuICAgIH1cbiAgICBsZXQgbGVhZjtcbiAgICBpZihldmVudCkge1xuICAgICAgLy8gcHJvcGVybHkgaGFuZGxlIGlmIHRoZSBtZXRhL2N0cmwga2V5IGlzIHByZXNzZWRcbiAgICAgIGNvbnN0IG1vZCA9IE9ic2lkaWFuLktleW1hcC5pc01vZEV2ZW50KGV2ZW50KTtcbiAgICAgIC8vIGdldCBtb3N0IHJlY2VudCBsZWFmXG4gICAgICBsZWFmID0gdGhpcy5hcHAud29ya3NwYWNlLmdldExlYWYobW9kKTtcbiAgICB9ZWxzZXtcbiAgICAgIC8vIGdldCBtb3N0IHJlY2VudCBsZWFmXG4gICAgICBsZWFmID0gdGhpcy5hcHAud29ya3NwYWNlLmdldE1vc3RSZWNlbnRMZWFmKCk7XG4gICAgfVxuICAgIGF3YWl0IGxlYWYub3BlbkZpbGUodGFyZ2V0RmlsZSk7XG4gICAgaWYgKGhlYWRpbmcpIHtcbiAgICAgIGxldCB7IGVkaXRvciB9ID0gbGVhZi52aWV3O1xuICAgICAgY29uc3QgcG9zID0geyBsaW5lOiBoZWFkaW5nLnBvc2l0aW9uLnN0YXJ0LmxpbmUsIGNoOiAwIH07XG4gICAgICBlZGl0b3Iuc2V0Q3Vyc29yKHBvcyk7XG4gICAgICBlZGl0b3Iuc2Nyb2xsSW50b1ZpZXcoeyB0bzogcG9zLCBmcm9tOiBwb3MgfSwgdHJ1ZSk7XG4gICAgfVxuICB9XG5cbiAgcmVuZGVyX2Jsb2NrX2NvbnRleHQoYmxvY2spIHtcbiAgICBjb25zdCBibG9ja19oZWFkaW5ncyA9IGJsb2NrLmxpbmsuc3BsaXQoXCIubWRcIilbMV0uc3BsaXQoXCIjXCIpO1xuICAgIC8vIHN0YXJ0aW5nIHdpdGggdGhlIGxhc3QgaGVhZGluZyBmaXJzdCwgaXRlcmF0ZSB0aHJvdWdoIGhlYWRpbmdzXG4gICAgbGV0IGJsb2NrX2NvbnRleHQgPSBcIlwiO1xuICAgIGZvciAobGV0IGkgPSBibG9ja19oZWFkaW5ncy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgICAgaWYoYmxvY2tfY29udGV4dC5sZW5ndGggPiAwKSB7XG4gICAgICAgIGJsb2NrX2NvbnRleHQgPSBgID4gJHtibG9ja19jb250ZXh0fWA7XG4gICAgICB9XG4gICAgICBibG9ja19jb250ZXh0ID0gYmxvY2tfaGVhZGluZ3NbaV0gKyBibG9ja19jb250ZXh0O1xuICAgICAgLy8gaWYgYmxvY2sgY29udGV4dCBpcyBsb25nZXIgdGhhbiBOIGNoYXJhY3RlcnMsIGJyZWFrXG4gICAgICBpZiAoYmxvY2tfY29udGV4dC5sZW5ndGggPiAxMDApIHtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICAgIC8vIHJlbW92ZSBsZWFkaW5nID4gaWYgZXhpc3RzXG4gICAgaWYgKGJsb2NrX2NvbnRleHQuc3RhcnRzV2l0aChcIiA+IFwiKSkge1xuICAgICAgYmxvY2tfY29udGV4dCA9IGJsb2NrX2NvbnRleHQuc2xpY2UoMyk7XG4gICAgfVxuICAgIHJldHVybiBibG9ja19jb250ZXh0O1xuXG4gIH1cblxuICByZW5kZXJhYmxlX2ZpbGVfdHlwZShsaW5rKSB7XG4gICAgcmV0dXJuIChsaW5rLmluZGV4T2YoXCIubWRcIikgIT09IC0xKSAmJiAobGluay5pbmRleE9mKFwiLmV4Y2FsaWRyYXdcIikgPT09IC0xKTtcbiAgfVxuXG4gIHJlbmRlcl9leHRlcm5hbF9saW5rX2VsbShtZXRhKXtcbiAgICBpZihtZXRhLnNvdXJjZSkge1xuICAgICAgaWYobWV0YS5zb3VyY2UgPT09IFwiR21haWxcIikgbWV0YS5zb3VyY2UgPSBcIlx1RDgzRFx1RENFNyBHbWFpbFwiO1xuICAgICAgcmV0dXJuIGA8c21hbGw+JHttZXRhLnNvdXJjZX08L3NtYWxsPjxicj4ke21ldGEudGl0bGV9YDtcbiAgICB9XG4gICAgLy8gcmVtb3ZlIGh0dHAocyk6Ly9cbiAgICBsZXQgZG9tYWluID0gbWV0YS5wYXRoLnJlcGxhY2UoLyheXFx3Kzp8XilcXC9cXC8vLCBcIlwiKTtcbiAgICAvLyBzZXBhcmF0ZSBkb21haW4gZnJvbSBwYXRoXG4gICAgZG9tYWluID0gZG9tYWluLnNwbGl0KFwiL1wiKVswXTtcbiAgICAvLyB3cmFwIGRvbWFpbiBpbiA8c21hbGw+IGFuZCBhZGQgbGluZSBicmVha1xuICAgIHJldHVybiBgPHNtYWxsPlx1RDgzQ1x1REYxMCAke2RvbWFpbn08L3NtYWxsPjxicj4ke21ldGEudGl0bGV9YDtcbiAgfVxuICAvLyBnZXQgYWxsIGZvbGRlcnNcbiAgYXN5bmMgZ2V0X2FsbF9mb2xkZXJzKCkge1xuICAgIGlmKCF0aGlzLmZvbGRlcnMgfHwgdGhpcy5mb2xkZXJzLmxlbmd0aCA9PT0gMCl7XG4gICAgICB0aGlzLmZvbGRlcnMgPSBhd2FpdCB0aGlzLmdldF9mb2xkZXJzKCk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLmZvbGRlcnM7XG4gIH1cbiAgLy8gZ2V0IGZvbGRlcnMsIHRyYXZlcnNlIG5vbi1oaWRkZW4gc3ViLWZvbGRlcnNcbiAgYXN5bmMgZ2V0X2ZvbGRlcnMocGF0aCA9IFwiL1wiKSB7XG4gICAgbGV0IGZvbGRlcnMgPSAoYXdhaXQgdGhpcy5hcHAudmF1bHQuYWRhcHRlci5saXN0KHBhdGgpKS5mb2xkZXJzO1xuICAgIGxldCBmb2xkZXJfbGlzdCA9IFtdO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZm9sZGVycy5sZW5ndGg7IGkrKykge1xuICAgICAgaWYgKGZvbGRlcnNbaV0uc3RhcnRzV2l0aChcIi5cIikpIGNvbnRpbnVlO1xuICAgICAgZm9sZGVyX2xpc3QucHVzaChmb2xkZXJzW2ldKTtcbiAgICAgIGZvbGRlcl9saXN0ID0gZm9sZGVyX2xpc3QuY29uY2F0KGF3YWl0IHRoaXMuZ2V0X2ZvbGRlcnMoZm9sZGVyc1tpXSArIFwiL1wiKSk7XG4gICAgfVxuICAgIHJldHVybiBmb2xkZXJfbGlzdDtcbiAgfVxuXG5cbiAgYXN5bmMgc3luY19ub3RlcygpIHtcbiAgICAvLyBpZiBsaWNlbnNlIGtleSBpcyBub3Qgc2V0LCByZXR1cm5cbiAgICBpZighdGhpcy5zZXR0aW5ncy5saWNlbnNlX2tleSl7XG4gICAgICBuZXcgT2JzaWRpYW4uTm90aWNlKFwiU21hcnQgQ29ubmVjdGlvbnM6IFN1cHBvcnRlciBsaWNlbnNlIGtleSBpcyByZXF1aXJlZCB0byBzeW5jIG5vdGVzIHRvIHRoZSBDaGF0R1BUIFBsdWdpbiBzZXJ2ZXIuXCIpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBjb25zb2xlLmxvZyhcInN5bmNpbmcgbm90ZXNcIik7XG4gICAgLy8gZ2V0IGFsbCBmaWxlcyBpbiB2YXVsdFxuICAgIGNvbnN0IGZpbGVzID0gdGhpcy5hcHAudmF1bHQuZ2V0TWFya2Rvd25GaWxlcygpLmZpbHRlcigoZmlsZSkgPT4ge1xuICAgICAgLy8gZmlsdGVyIG91dCBmaWxlIHBhdGhzIG1hdGNoaW5nIGFueSBzdHJpbmdzIGluIHRoaXMuZmlsZV9leGNsdXNpb25zXG4gICAgICBmb3IobGV0IGkgPSAwOyBpIDwgdGhpcy5maWxlX2V4Y2x1c2lvbnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgaWYoZmlsZS5wYXRoLmluZGV4T2YodGhpcy5maWxlX2V4Y2x1c2lvbnNbaV0pID4gLTEpIHtcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH0pO1xuICAgIGNvbnN0IG5vdGVzID0gYXdhaXQgdGhpcy5idWlsZF9ub3Rlc19vYmplY3QoZmlsZXMpO1xuICAgIGNvbnNvbGUubG9nKFwib2JqZWN0IGJ1aWx0XCIpO1xuICAgIC8vIHNhdmUgbm90ZXMgb2JqZWN0IHRvIC5zbWFydC1jb25uZWN0aW9ucy9ub3Rlcy5qc29uXG4gICAgYXdhaXQgdGhpcy5hcHAudmF1bHQuYWRhcHRlci53cml0ZShcIi5zbWFydC1jb25uZWN0aW9ucy9ub3Rlcy5qc29uXCIsIEpTT04uc3RyaW5naWZ5KG5vdGVzLCBudWxsLCAyKSk7XG4gICAgY29uc29sZS5sb2coXCJub3RlcyBzYXZlZFwiKTtcbiAgICBjb25zb2xlLmxvZyh0aGlzLnNldHRpbmdzLmxpY2Vuc2Vfa2V5KTtcbiAgICAvLyBQT1NUIG5vdGVzIG9iamVjdCB0byBzZXJ2ZXJcbiAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0ICgwLCBPYnNpZGlhbi5yZXF1ZXN0VXJsKSh7XG4gICAgICB1cmw6IFwiaHR0cHM6Ly9zeW5jLnNtYXJ0Y29ubmVjdGlvbnMuYXBwL3N5bmNcIixcbiAgICAgIG1ldGhvZDogXCJQT1NUXCIsXG4gICAgICBoZWFkZXJzOiB7XG4gICAgICAgIFwiQ29udGVudC1UeXBlXCI6IFwiYXBwbGljYXRpb24vanNvblwiLFxuICAgICAgfSxcbiAgICAgIGNvbnRlbnRUeXBlOiBcImFwcGxpY2F0aW9uL2pzb25cIixcbiAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgbGljZW5zZV9rZXk6IHRoaXMuc2V0dGluZ3MubGljZW5zZV9rZXksXG4gICAgICAgIG5vdGVzOiBub3Rlc1xuICAgICAgfSlcbiAgICB9KTtcbiAgICBjb25zb2xlLmxvZyhyZXNwb25zZSk7XG5cbiAgfVxuXG4gIGFzeW5jIGJ1aWxkX25vdGVzX29iamVjdChmaWxlcykge1xuICAgIGxldCBvdXRwdXQgPSB7fTtcbiAgXG4gICAgZm9yKGxldCBpID0gMDsgaSA8IGZpbGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBsZXQgZmlsZSA9IGZpbGVzW2ldO1xuICAgICAgbGV0IHBhcnRzID0gZmlsZS5wYXRoLnNwbGl0KFwiL1wiKTtcbiAgICAgIGxldCBjdXJyZW50ID0gb3V0cHV0O1xuICBcbiAgICAgIGZvciAobGV0IGlpID0gMDsgaWkgPCBwYXJ0cy5sZW5ndGg7IGlpKyspIHtcbiAgICAgICAgbGV0IHBhcnQgPSBwYXJ0c1tpaV07XG4gIFxuICAgICAgICBpZiAoaWkgPT09IHBhcnRzLmxlbmd0aCAtIDEpIHtcbiAgICAgICAgICAvLyBUaGlzIGlzIGEgZmlsZVxuICAgICAgICAgIGN1cnJlbnRbcGFydF0gPSBhd2FpdCB0aGlzLmFwcC52YXVsdC5jYWNoZWRSZWFkKGZpbGUpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIFRoaXMgaXMgYSBkaXJlY3RvcnlcbiAgICAgICAgICBpZiAoIWN1cnJlbnRbcGFydF0pIHtcbiAgICAgICAgICAgIGN1cnJlbnRbcGFydF0gPSB7fTtcbiAgICAgICAgICB9XG4gIFxuICAgICAgICAgIGN1cnJlbnQgPSBjdXJyZW50W3BhcnRdO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICBcbiAgICByZXR1cm4gb3V0cHV0O1xuICB9XG5cbn1cblxuY29uc3QgU01BUlRfQ09OTkVDVElPTlNfVklFV19UWVBFID0gXCJzbWFydC1jb25uZWN0aW9ucy12aWV3XCI7XG5jbGFzcyBTbWFydENvbm5lY3Rpb25zVmlldyBleHRlbmRzIE9ic2lkaWFuLkl0ZW1WaWV3IHtcbiAgY29uc3RydWN0b3IobGVhZiwgcGx1Z2luKSB7XG4gICAgc3VwZXIobGVhZik7XG4gICAgdGhpcy5wbHVnaW4gPSBwbHVnaW47XG4gICAgdGhpcy5uZWFyZXN0ID0gbnVsbDtcbiAgICB0aGlzLmxvYWRfd2FpdCA9IG51bGw7XG4gIH1cbiAgZ2V0Vmlld1R5cGUoKSB7XG4gICAgcmV0dXJuIFNNQVJUX0NPTk5FQ1RJT05TX1ZJRVdfVFlQRTtcbiAgfVxuXG4gIGdldERpc3BsYXlUZXh0KCkge1xuICAgIHJldHVybiBcIlNtYXJ0IENvbm5lY3Rpb25zIEZpbGVzXCI7XG4gIH1cblxuICBnZXRJY29uKCkge1xuICAgIHJldHVybiBcInNtYXJ0LWNvbm5lY3Rpb25zXCI7XG4gIH1cblxuXG4gIHNldF9tZXNzYWdlKG1lc3NhZ2UpIHtcbiAgICBjb25zdCBjb250YWluZXIgPSB0aGlzLmNvbnRhaW5lckVsLmNoaWxkcmVuWzFdO1xuICAgIC8vIGNsZWFyIGNvbnRhaW5lclxuICAgIGNvbnRhaW5lci5lbXB0eSgpO1xuICAgIC8vIGluaXRpYXRlIHRvcCBiYXJcbiAgICB0aGlzLmluaXRpYXRlX3RvcF9iYXIoY29udGFpbmVyKTtcbiAgICAvLyBpZiBtZXNhZ2UgaXMgYW4gYXJyYXksIGxvb3AgdGhyb3VnaCBhbmQgY3JlYXRlIGEgbmV3IHAgZWxlbWVudCBmb3IgZWFjaCBtZXNzYWdlXG4gICAgaWYgKEFycmF5LmlzQXJyYXkobWVzc2FnZSkpIHtcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbWVzc2FnZS5sZW5ndGg7IGkrKykge1xuICAgICAgICBjb250YWluZXIuY3JlYXRlRWwoXCJwXCIsIHsgY2xzOiBcInNjX21lc3NhZ2VcIiwgdGV4dDogbWVzc2FnZVtpXSB9KTtcbiAgICAgIH1cbiAgICB9ZWxzZXtcbiAgICAgIC8vIGNyZWF0ZSBwIGVsZW1lbnQgd2l0aCBtZXNzYWdlXG4gICAgICBjb250YWluZXIuY3JlYXRlRWwoXCJwXCIsIHsgY2xzOiBcInNjX21lc3NhZ2VcIiwgdGV4dDogbWVzc2FnZSB9KTtcbiAgICB9XG4gIH1cbiAgcmVuZGVyX2xpbmtfdGV4dChsaW5rLCBzaG93X2Z1bGxfcGF0aD1mYWxzZSkge1xuICAgIC8qKlxuICAgICAqIEJlZ2luIGludGVybmFsIGxpbmtzXG4gICAgICovXG4gICAgLy8gaWYgc2hvdyBmdWxsIHBhdGggaXMgZmFsc2UsIHJlbW92ZSBmaWxlIHBhdGhcbiAgICBpZiAoIXNob3dfZnVsbF9wYXRoKSB7XG4gICAgICBsaW5rID0gbGluay5zcGxpdChcIi9cIikucG9wKCk7XG4gICAgfVxuICAgIC8vIGlmIGNvbnRhaW5zICcjJ1xuICAgIGlmIChsaW5rLmluZGV4T2YoXCIjXCIpID4gLTEpIHtcbiAgICAgIC8vIHNwbGl0IGF0IC5tZFxuICAgICAgbGluayA9IGxpbmsuc3BsaXQoXCIubWRcIik7XG4gICAgICAvLyB3cmFwIGZpcnN0IHBhcnQgaW4gPHNtYWxsPiBhbmQgYWRkIGxpbmUgYnJlYWtcbiAgICAgIGxpbmtbMF0gPSBgPHNtYWxsPiR7bGlua1swXX08L3NtYWxsPjxicj5gO1xuICAgICAgLy8gam9pbiBiYWNrIHRvZ2V0aGVyXG4gICAgICBsaW5rID0gbGluay5qb2luKFwiXCIpO1xuICAgICAgLy8gcmVwbGFjZSAnIycgd2l0aCAnIFx1MDBCQiAnXG4gICAgICBsaW5rID0gbGluay5yZXBsYWNlKC9cXCMvZywgXCIgXHUwMEJCIFwiKTtcbiAgICB9ZWxzZXtcbiAgICAgIC8vIHJlbW92ZSAnLm1kJ1xuICAgICAgbGluayA9IGxpbmsucmVwbGFjZShcIi5tZFwiLCBcIlwiKTtcbiAgICB9XG4gICAgcmV0dXJuIGxpbms7XG4gIH1cblxuXG4gIHNldF9uZWFyZXN0KG5lYXJlc3QsIG5lYXJlc3RfY29udGV4dD1udWxsLCByZXN1bHRzX29ubHk9ZmFsc2UpIHtcbiAgICAvLyBnZXQgY29udGFpbmVyIGVsZW1lbnRcbiAgICBjb25zdCBjb250YWluZXIgPSB0aGlzLmNvbnRhaW5lckVsLmNoaWxkcmVuWzFdO1xuICAgIC8vIGlmIHJlc3VsdHMgb25seSBpcyBmYWxzZSwgY2xlYXIgY29udGFpbmVyIGFuZCBpbml0aWF0ZSB0b3AgYmFyXG4gICAgaWYoIXJlc3VsdHNfb25seSl7XG4gICAgICAvLyBjbGVhciBjb250YWluZXJcbiAgICAgIGNvbnRhaW5lci5lbXB0eSgpO1xuICAgICAgdGhpcy5pbml0aWF0ZV90b3BfYmFyKGNvbnRhaW5lciwgbmVhcmVzdF9jb250ZXh0KTtcbiAgICB9XG4gICAgLy8gdXBkYXRlIHJlc3VsdHNcbiAgICB0aGlzLnBsdWdpbi51cGRhdGVfcmVzdWx0cyhjb250YWluZXIsIG5lYXJlc3QpO1xuICB9XG5cbiAgaW5pdGlhdGVfdG9wX2Jhcihjb250YWluZXIsIG5lYXJlc3RfY29udGV4dD1udWxsKSB7XG4gICAgbGV0IHRvcF9iYXI7XG4gICAgLy8gaWYgdG9wIGJhciBhbHJlYWR5IGV4aXN0cywgZW1wdHkgaXRcbiAgICBpZiAoKGNvbnRhaW5lci5jaGlsZHJlbi5sZW5ndGggPiAwKSAmJiAoY29udGFpbmVyLmNoaWxkcmVuWzBdLmNsYXNzTGlzdC5jb250YWlucyhcInNjLXRvcC1iYXJcIikpKSB7XG4gICAgICB0b3BfYmFyID0gY29udGFpbmVyLmNoaWxkcmVuWzBdO1xuICAgICAgdG9wX2Jhci5lbXB0eSgpO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBpbml0IGNvbnRhaW5lciBmb3IgdG9wIGJhclxuICAgICAgdG9wX2JhciA9IGNvbnRhaW5lci5jcmVhdGVFbChcImRpdlwiLCB7IGNsczogXCJzYy10b3AtYmFyXCIgfSk7XG4gICAgfVxuICAgIC8vIGlmIGhpZ2hsaWdodGVkIHRleHQgaXMgbm90IG51bGwsIGNyZWF0ZSBwIGVsZW1lbnQgd2l0aCBoaWdobGlnaHRlZCB0ZXh0XG4gICAgaWYgKG5lYXJlc3RfY29udGV4dCkge1xuICAgICAgdG9wX2Jhci5jcmVhdGVFbChcInBcIiwgeyBjbHM6IFwic2MtY29udGV4dFwiLCB0ZXh0OiBuZWFyZXN0X2NvbnRleHQgfSk7XG4gICAgfVxuICAgIC8vIGFkZCBjaGF0IGJ1dHRvblxuICAgIGNvbnN0IGNoYXRfYnV0dG9uID0gdG9wX2Jhci5jcmVhdGVFbChcImJ1dHRvblwiLCB7IGNsczogXCJzYy1jaGF0LWJ1dHRvblwiIH0pO1xuICAgIC8vIGFkZCBpY29uIHRvIGNoYXQgYnV0dG9uXG4gICAgT2JzaWRpYW4uc2V0SWNvbihjaGF0X2J1dHRvbiwgXCJtZXNzYWdlLXNxdWFyZVwiKTtcbiAgICAvLyBhZGQgY2xpY2sgbGlzdGVuZXIgdG8gY2hhdCBidXR0b25cbiAgICBjaGF0X2J1dHRvbi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4ge1xuICAgICAgLy8gb3BlbiBjaGF0XG4gICAgICB0aGlzLnBsdWdpbi5vcGVuX2NoYXQoKTtcbiAgICB9KTtcbiAgICAvLyBhZGQgc2VhcmNoIGJ1dHRvblxuICAgIGNvbnN0IHNlYXJjaF9idXR0b24gPSB0b3BfYmFyLmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHsgY2xzOiBcInNjLXNlYXJjaC1idXR0b25cIiB9KTtcbiAgICAvLyBhZGQgaWNvbiB0byBzZWFyY2ggYnV0dG9uXG4gICAgT2JzaWRpYW4uc2V0SWNvbihzZWFyY2hfYnV0dG9uLCBcInNlYXJjaFwiKTtcbiAgICAvLyBhZGQgY2xpY2sgbGlzdGVuZXIgdG8gc2VhcmNoIGJ1dHRvblxuICAgIHNlYXJjaF9idXR0b24uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHtcbiAgICAgIC8vIGVtcHR5IHRvcCBiYXJcbiAgICAgIHRvcF9iYXIuZW1wdHkoKTtcbiAgICAgIC8vIGNyZWF0ZSBpbnB1dCBlbGVtZW50XG4gICAgICBjb25zdCBzZWFyY2hfY29udGFpbmVyID0gdG9wX2Jhci5jcmVhdGVFbChcImRpdlwiLCB7IGNsczogXCJzZWFyY2gtaW5wdXQtY29udGFpbmVyXCIgfSk7XG4gICAgICBjb25zdCBpbnB1dCA9IHNlYXJjaF9jb250YWluZXIuY3JlYXRlRWwoXCJpbnB1dFwiLCB7XG4gICAgICAgIGNsczogXCJzYy1zZWFyY2gtaW5wdXRcIixcbiAgICAgICAgdHlwZTogXCJzZWFyY2hcIixcbiAgICAgICAgcGxhY2Vob2xkZXI6IFwiVHlwZSB0byBzdGFydCBzZWFyY2guLi5cIiwgXG4gICAgICB9KTtcbiAgICAgIC8vIGZvY3VzIGlucHV0XG4gICAgICBpbnB1dC5mb2N1cygpO1xuICAgICAgLy8gYWRkIGtleWRvd24gbGlzdGVuZXIgdG8gaW5wdXRcbiAgICAgIGlucHV0LmFkZEV2ZW50TGlzdGVuZXIoXCJrZXlkb3duXCIsIChldmVudCkgPT4ge1xuICAgICAgICAvLyBpZiBlc2NhcGUga2V5IGlzIHByZXNzZWRcbiAgICAgICAgaWYgKGV2ZW50LmtleSA9PT0gXCJFc2NhcGVcIikge1xuICAgICAgICAgIHRoaXMuY2xlYXJfYXV0b19zZWFyY2hlcigpO1xuICAgICAgICAgIC8vIGNsZWFyIHRvcCBiYXJcbiAgICAgICAgICB0aGlzLmluaXRpYXRlX3RvcF9iYXIoY29udGFpbmVyLCBuZWFyZXN0X2NvbnRleHQpO1xuICAgICAgICB9XG4gICAgICB9KTtcblxuICAgICAgLy8gYWRkIGtleXVwIGxpc3RlbmVyIHRvIGlucHV0XG4gICAgICBpbnB1dC5hZGRFdmVudExpc3RlbmVyKFwia2V5dXBcIiwgKGV2ZW50KSA9PiB7XG4gICAgICAgIC8vIGlmIHRoaXMuc2VhcmNoX3RpbWVvdXQgaXMgbm90IG51bGwgdGhlbiBjbGVhciBpdCBhbmQgc2V0IHRvIG51bGxcbiAgICAgICAgdGhpcy5jbGVhcl9hdXRvX3NlYXJjaGVyKCk7XG4gICAgICAgIC8vIGdldCBzZWFyY2ggdGVybVxuICAgICAgICBjb25zdCBzZWFyY2hfdGVybSA9IGlucHV0LnZhbHVlO1xuICAgICAgICAvLyBpZiBlbnRlciBrZXkgaXMgcHJlc3NlZFxuICAgICAgICBpZiAoZXZlbnQua2V5ID09PSBcIkVudGVyXCIgJiYgc2VhcmNoX3Rlcm0gIT09IFwiXCIpIHtcbiAgICAgICAgICB0aGlzLnNlYXJjaChzZWFyY2hfdGVybSk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gaWYgYW55IG90aGVyIGtleSBpcyBwcmVzc2VkIGFuZCBpbnB1dCBpcyBub3QgZW1wdHkgdGhlbiB3YWl0IDUwMG1zIGFuZCBtYWtlX2Nvbm5lY3Rpb25zXG4gICAgICAgIGVsc2UgaWYgKHNlYXJjaF90ZXJtICE9PSBcIlwiKSB7XG4gICAgICAgICAgLy8gY2xlYXIgdGltZW91dFxuICAgICAgICAgIGNsZWFyVGltZW91dCh0aGlzLnNlYXJjaF90aW1lb3V0KTtcbiAgICAgICAgICAvLyBzZXQgdGltZW91dFxuICAgICAgICAgIHRoaXMuc2VhcmNoX3RpbWVvdXQgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgICAgIHRoaXMuc2VhcmNoKHNlYXJjaF90ZXJtLCB0cnVlKTtcbiAgICAgICAgICB9LCA3MDApO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIC8vIHJlbmRlciBidXR0b25zOiBcImNyZWF0ZVwiIGFuZCBcInJldHJ5XCIgZm9yIGxvYWRpbmcgZW1iZWRkaW5ncy5qc29uIGZpbGVcbiAgcmVuZGVyX2VtYmVkZGluZ3NfYnV0dG9ucygpIHtcbiAgICAvLyBnZXQgY29udGFpbmVyIGVsZW1lbnRcbiAgICBjb25zdCBjb250YWluZXIgPSB0aGlzLmNvbnRhaW5lckVsLmNoaWxkcmVuWzFdO1xuICAgIC8vIGNsZWFyIGNvbnRhaW5lclxuICAgIGNvbnRhaW5lci5lbXB0eSgpO1xuICAgIC8vIGNyZWF0ZSBoZWFkaW5nIHRoYXQgc2F5cyBcIkVtYmVkZGluZ3MgZmlsZSBub3QgZm91bmRcIlxuICAgIGNvbnRhaW5lci5jcmVhdGVFbChcImgyXCIsIHsgY2xzOiBcInNjSGVhZGluZ1wiLCB0ZXh0OiBcIkVtYmVkZGluZ3MgZmlsZSBub3QgZm91bmRcIiB9KTtcbiAgICAvLyBjcmVhdGUgZGl2IGZvciBidXR0b25zXG4gICAgY29uc3QgYnV0dG9uX2RpdiA9IGNvbnRhaW5lci5jcmVhdGVFbChcImRpdlwiLCB7IGNsczogXCJzY0J1dHRvbkRpdlwiIH0pO1xuICAgIC8vIGNyZWF0ZSBcImNyZWF0ZVwiIGJ1dHRvblxuICAgIGNvbnN0IGNyZWF0ZV9idXR0b24gPSBidXR0b25fZGl2LmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHsgY2xzOiBcInNjQnV0dG9uXCIsIHRleHQ6IFwiQ3JlYXRlIGVtYmVkZGluZ3MuanNvblwiIH0pO1xuICAgIC8vIG5vdGUgdGhhdCBjcmVhdGluZyBlbWJlZGRpbmdzLmpzb24gZmlsZSB3aWxsIHRyaWdnZXIgYnVsayBlbWJlZGRpbmcgYW5kIG1heSB0YWtlIGEgd2hpbGVcbiAgICBidXR0b25fZGl2LmNyZWF0ZUVsKFwicFwiLCB7IGNsczogXCJzY0J1dHRvbk5vdGVcIiwgdGV4dDogXCJXYXJuaW5nOiBDcmVhdGluZyBlbWJlZGRpbmdzLmpzb24gZmlsZSB3aWxsIHRyaWdnZXIgYnVsayBlbWJlZGRpbmcgYW5kIG1heSB0YWtlIGEgd2hpbGVcIiB9KTtcbiAgICAvLyBjcmVhdGUgXCJyZXRyeVwiIGJ1dHRvblxuICAgIGNvbnN0IHJldHJ5X2J1dHRvbiA9IGJ1dHRvbl9kaXYuY3JlYXRlRWwoXCJidXR0b25cIiwgeyBjbHM6IFwic2NCdXR0b25cIiwgdGV4dDogXCJSZXRyeVwiIH0pO1xuICAgIC8vIHRyeSB0byBsb2FkIGVtYmVkZGluZ3MuanNvbiBmaWxlIGFnYWluXG4gICAgYnV0dG9uX2Rpdi5jcmVhdGVFbChcInBcIiwgeyBjbHM6IFwic2NCdXR0b25Ob3RlXCIsIHRleHQ6IFwiSWYgZW1iZWRkaW5ncy5qc29uIGZpbGUgYWxyZWFkeSBleGlzdHMsIGNsaWNrICdSZXRyeScgdG8gbG9hZCBpdFwiIH0pO1xuXG4gICAgLy8gYWRkIGNsaWNrIGV2ZW50IHRvIFwiY3JlYXRlXCIgYnV0dG9uXG4gICAgY3JlYXRlX2J1dHRvbi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgYXN5bmMgKGV2ZW50KSA9PiB7XG4gICAgICAvLyBjcmVhdGUgZW1iZWRkaW5ncy5qc29uIGZpbGVcbiAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNtYXJ0X3ZlY19saXRlLmluaXRfZW1iZWRkaW5nc19maWxlKCk7XG4gICAgICAvLyByZWxvYWQgdmlld1xuICAgICAgYXdhaXQgdGhpcy5yZW5kZXJfY29ubmVjdGlvbnMoKTtcbiAgICB9KTtcblxuICAgIC8vIGFkZCBjbGljayBldmVudCB0byBcInJldHJ5XCIgYnV0dG9uXG4gICAgcmV0cnlfYnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCBhc3luYyAoZXZlbnQpID0+IHtcbiAgICAgIGNvbnNvbGUubG9nKFwicmV0cnlpbmcgdG8gbG9hZCBlbWJlZGRpbmdzLmpzb24gZmlsZVwiKTtcbiAgICAgIC8vIHJlbG9hZCBlbWJlZGRpbmdzLmpzb24gZmlsZVxuICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uaW5pdF92ZWNzKCk7XG4gICAgICAvLyByZWxvYWQgdmlld1xuICAgICAgYXdhaXQgdGhpcy5yZW5kZXJfY29ubmVjdGlvbnMoKTtcbiAgICB9KTtcbiAgfVxuXG4gIGFzeW5jIG9uT3BlbigpIHtcbiAgICBjb25zdCBjb250YWluZXIgPSB0aGlzLmNvbnRhaW5lckVsLmNoaWxkcmVuWzFdO1xuICAgIGNvbnRhaW5lci5lbXB0eSgpO1xuICAgIC8vIHBsYWNlaG9sZGVyIHRleHRcbiAgICBjb250YWluZXIuY3JlYXRlRWwoXCJwXCIsIHsgY2xzOiBcInNjUGxhY2Vob2xkZXJcIiwgdGV4dDogXCJPcGVuIGEgbm90ZSB0byBmaW5kIGNvbm5lY3Rpb25zLlwiIH0pOyBcblxuICAgIC8vIHJ1bnMgd2hlbiBmaWxlIGlzIG9wZW5lZFxuICAgIHRoaXMucGx1Z2luLnJlZ2lzdGVyRXZlbnQodGhpcy5hcHAud29ya3NwYWNlLm9uKCdmaWxlLW9wZW4nLCAoZmlsZSkgPT4ge1xuICAgICAgLy8gaWYgbm8gZmlsZSBpcyBvcGVuLCByZXR1cm5cbiAgICAgIGlmKCFmaWxlKSB7XG4gICAgICAgIC8vIGNvbnNvbGUubG9nKFwibm8gZmlsZSBvcGVuLCByZXR1cm5pbmdcIik7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIC8vIHJldHVybiBpZiBmaWxlIHR5cGUgaXMgbm90IHN1cHBvcnRlZFxuICAgICAgaWYoU1VQUE9SVEVEX0ZJTEVfVFlQRVMuaW5kZXhPZihmaWxlLmV4dGVuc2lvbikgPT09IC0xKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnNldF9tZXNzYWdlKFtcbiAgICAgICAgICBcIkZpbGU6IFwiK2ZpbGUubmFtZVxuICAgICAgICAgICxcIlVuc3VwcG9ydGVkIGZpbGUgdHlwZSAoU3VwcG9ydGVkOiBcIitTVVBQT1JURURfRklMRV9UWVBFUy5qb2luKFwiLCBcIikrXCIpXCJcbiAgICAgICAgXSk7XG4gICAgICB9XG4gICAgICAvLyBydW4gcmVuZGVyX2Nvbm5lY3Rpb25zIGFmdGVyIDEgc2Vjb25kIHRvIGFsbG93IGZvciBmaWxlIHRvIGxvYWRcbiAgICAgIGlmKHRoaXMubG9hZF93YWl0KXtcbiAgICAgICAgY2xlYXJUaW1lb3V0KHRoaXMubG9hZF93YWl0KTtcbiAgICAgIH1cbiAgICAgIHRoaXMubG9hZF93YWl0ID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgIHRoaXMucmVuZGVyX2Nvbm5lY3Rpb25zKGZpbGUpO1xuICAgICAgICB0aGlzLmxvYWRfd2FpdCA9IG51bGw7XG4gICAgICB9LCAxMDAwKTtcbiAgICAgICAgXG4gICAgfSkpO1xuXG4gICAgdGhpcy5hcHAud29ya3NwYWNlLnJlZ2lzdGVySG92ZXJMaW5rU291cmNlKFNNQVJUX0NPTk5FQ1RJT05TX1ZJRVdfVFlQRSwge1xuICAgICAgICBkaXNwbGF5OiAnU21hcnQgQ29ubmVjdGlvbnMgRmlsZXMnLFxuICAgICAgICBkZWZhdWx0TW9kOiB0cnVlLFxuICAgIH0pO1xuICAgIHRoaXMuYXBwLndvcmtzcGFjZS5yZWdpc3RlckhvdmVyTGlua1NvdXJjZShTTUFSVF9DT05ORUNUSU9OU19DSEFUX1ZJRVdfVFlQRSwge1xuICAgICAgICBkaXNwbGF5OiAnU21hcnQgQ2hhdCBMaW5rcycsXG4gICAgICAgIGRlZmF1bHRNb2Q6IHRydWUsXG4gICAgfSk7XG5cbiAgICB0aGlzLmFwcC53b3Jrc3BhY2Uub25MYXlvdXRSZWFkeSh0aGlzLmluaXRpYWxpemUuYmluZCh0aGlzKSk7XG4gICAgXG4gIH1cbiAgXG4gIGFzeW5jIGluaXRpYWxpemUoKSB7XG4gICAgdGhpcy5zZXRfbWVzc2FnZShcIkxvYWRpbmcgZW1iZWRkaW5ncyBmaWxlLi4uXCIpO1xuICAgIGNvbnN0IHZlY3NfaW50aWF0ZWQgPSBhd2FpdCB0aGlzLnBsdWdpbi5pbml0X3ZlY3MoKTtcbiAgICBpZih2ZWNzX2ludGlhdGVkKXtcbiAgICAgIHRoaXMuc2V0X21lc3NhZ2UoXCJFbWJlZGRpbmdzIGZpbGUgbG9hZGVkLlwiKTtcbiAgICAgIGF3YWl0IHRoaXMucmVuZGVyX2Nvbm5lY3Rpb25zKCk7XG4gICAgfWVsc2V7XG4gICAgICB0aGlzLnJlbmRlcl9lbWJlZGRpbmdzX2J1dHRvbnMoKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBFWFBFUklNRU5UQUxcbiAgICAgKiAtIHdpbmRvdy1iYXNlZCBBUEkgYWNjZXNzXG4gICAgICogLSBjb2RlLWJsb2NrIHJlbmRlcmluZ1xuICAgICAqL1xuICAgIHRoaXMuYXBpID0gbmV3IFNtYXJ0Q29ubmVjdGlvbnNWaWV3QXBpKHRoaXMuYXBwLCB0aGlzLnBsdWdpbiwgdGhpcyk7XG4gICAgLy8gcmVnaXN0ZXIgQVBJIHRvIGdsb2JhbCB3aW5kb3cgb2JqZWN0XG4gICAgKHdpbmRvd1tcIlNtYXJ0Q29ubmVjdGlvbnNWaWV3QXBpXCJdID0gdGhpcy5hcGkpICYmIHRoaXMucmVnaXN0ZXIoKCkgPT4gZGVsZXRlIHdpbmRvd1tcIlNtYXJ0Q29ubmVjdGlvbnNWaWV3QXBpXCJdKTtcblxuICB9XG5cbiAgYXN5bmMgb25DbG9zZSgpIHtcbiAgICBjb25zb2xlLmxvZyhcImNsb3Npbmcgc21hcnQgY29ubmVjdGlvbnMgdmlld1wiKTtcbiAgICB0aGlzLmFwcC53b3Jrc3BhY2UudW5yZWdpc3RlckhvdmVyTGlua1NvdXJjZShTTUFSVF9DT05ORUNUSU9OU19WSUVXX1RZUEUpO1xuICAgIHRoaXMucGx1Z2luLnZpZXcgPSBudWxsO1xuICB9XG5cbiAgYXN5bmMgcmVuZGVyX2Nvbm5lY3Rpb25zKGNvbnRleHQ9bnVsbCkge1xuICAgIGNvbnNvbGUubG9nKFwicmVuZGVyaW5nIGNvbm5lY3Rpb25zXCIpO1xuICAgIC8vIGlmIEFQSSBrZXkgaXMgbm90IHNldCB0aGVuIHVwZGF0ZSB2aWV3IG1lc3NhZ2VcbiAgICBpZighdGhpcy5wbHVnaW4uc2V0dGluZ3MuYXBpX2tleSkge1xuICAgICAgdGhpcy5zZXRfbWVzc2FnZShcIkFuIE9wZW5BSSBBUEkga2V5IGlzIHJlcXVpcmVkIHRvIG1ha2UgU21hcnQgQ29ubmVjdGlvbnNcIik7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGlmKCF0aGlzLnBsdWdpbi5lbWJlZGRpbmdzX2xvYWRlZCl7XG4gICAgICBhd2FpdCB0aGlzLnBsdWdpbi5pbml0X3ZlY3MoKTtcbiAgICB9XG4gICAgLy8gaWYgZW1iZWRkaW5nIHN0aWxsIG5vdCBsb2FkZWQsIHJldHVyblxuICAgIGlmKCF0aGlzLnBsdWdpbi5lbWJlZGRpbmdzX2xvYWRlZCkge1xuICAgICAgY29uc29sZS5sb2coXCJlbWJlZGRpbmdzIGZpbGVzIHN0aWxsIG5vdCBsb2FkZWQgb3IgeWV0IHRvIGJlIGNyZWF0ZWRcIik7XG4gICAgICB0aGlzLnJlbmRlcl9lbWJlZGRpbmdzX2J1dHRvbnMoKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgdGhpcy5zZXRfbWVzc2FnZShcIk1ha2luZyBTbWFydCBDb25uZWN0aW9ucy4uLlwiKTtcbiAgICAvKipcbiAgICAgKiBCZWdpbiBoaWdobGlnaHRlZC10ZXh0LWxldmVsIHNlYXJjaFxuICAgICAqL1xuICAgIGlmKHR5cGVvZiBjb250ZXh0ID09PSBcInN0cmluZ1wiKSB7XG4gICAgICBjb25zdCBoaWdobGlnaHRlZF90ZXh0ID0gY29udGV4dDtcbiAgICAgIC8vIGdldCBlbWJlZGRpbmcgZm9yIGhpZ2hsaWdodGVkIHRleHRcbiAgICAgIGF3YWl0IHRoaXMuc2VhcmNoKGhpZ2hsaWdodGVkX3RleHQpO1xuICAgICAgcmV0dXJuOyAvLyBlbmRzIGhlcmUgaWYgY29udGV4dCBpcyBhIHN0cmluZ1xuICAgIH1cblxuICAgIC8qKiBcbiAgICAgKiBCZWdpbiBmaWxlLWxldmVsIHNlYXJjaFxuICAgICAqLyAgICBcbiAgICB0aGlzLm5lYXJlc3QgPSBudWxsO1xuICAgIHRoaXMuaW50ZXJ2YWxfY291bnQgPSAwO1xuICAgIHRoaXMucmVuZGVyaW5nID0gZmFsc2U7XG4gICAgdGhpcy5maWxlID0gY29udGV4dDtcbiAgICAvLyBpZiB0aGlzLmludGVydmFsIGlzIHNldCB0aGVuIGNsZWFyIGl0XG4gICAgaWYodGhpcy5pbnRlcnZhbCkge1xuICAgICAgY2xlYXJJbnRlcnZhbCh0aGlzLmludGVydmFsKTtcbiAgICAgIHRoaXMuaW50ZXJ2YWwgPSBudWxsO1xuICAgIH1cbiAgICAvLyBzZXQgaW50ZXJ2YWwgdG8gY2hlY2sgaWYgbmVhcmVzdCBpcyBzZXRcbiAgICB0aGlzLmludGVydmFsID0gc2V0SW50ZXJ2YWwoKCkgPT4ge1xuICAgICAgaWYoIXRoaXMucmVuZGVyaW5nKXtcbiAgICAgICAgaWYodGhpcy5maWxlIGluc3RhbmNlb2YgT2JzaWRpYW4uVEZpbGUpIHtcbiAgICAgICAgICB0aGlzLnJlbmRlcmluZyA9IHRydWU7XG4gICAgICAgICAgdGhpcy5yZW5kZXJfbm90ZV9jb25uZWN0aW9ucyh0aGlzLmZpbGUpO1xuICAgICAgICB9ZWxzZXtcbiAgICAgICAgICAvLyBnZXQgY3VycmVudCBub3RlXG4gICAgICAgICAgdGhpcy5maWxlID0gdGhpcy5hcHAud29ya3NwYWNlLmdldEFjdGl2ZUZpbGUoKTtcbiAgICAgICAgICAvLyBpZiBzdGlsbCBubyBjdXJyZW50IG5vdGUgdGhlbiByZXR1cm5cbiAgICAgICAgICBpZighdGhpcy5maWxlICYmIHRoaXMuY291bnQgPiAxKSB7XG4gICAgICAgICAgICBjbGVhckludGVydmFsKHRoaXMuaW50ZXJ2YWwpO1xuICAgICAgICAgICAgdGhpcy5zZXRfbWVzc2FnZShcIk5vIGFjdGl2ZSBmaWxlXCIpO1xuICAgICAgICAgICAgcmV0dXJuOyBcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1lbHNle1xuICAgICAgICBpZih0aGlzLm5lYXJlc3QpIHtcbiAgICAgICAgICBjbGVhckludGVydmFsKHRoaXMuaW50ZXJ2YWwpO1xuICAgICAgICAgIC8vIGlmIG5lYXJlc3QgaXMgYSBzdHJpbmcgdGhlbiB1cGRhdGUgdmlldyBtZXNzYWdlXG4gICAgICAgICAgaWYgKHR5cGVvZiB0aGlzLm5lYXJlc3QgPT09IFwic3RyaW5nXCIpIHtcbiAgICAgICAgICAgIHRoaXMuc2V0X21lc3NhZ2UodGhpcy5uZWFyZXN0KTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gc2V0IG5lYXJlc3QgY29ubmVjdGlvbnNcbiAgICAgICAgICAgIHRoaXMuc2V0X25lYXJlc3QodGhpcy5uZWFyZXN0LCBcIkZpbGU6IFwiICsgdGhpcy5maWxlLm5hbWUpO1xuICAgICAgICAgIH1cbiAgICAgICAgICAvLyBpZiByZW5kZXJfbG9nLmZhaWxlZF9lbWJlZGRpbmdzIHRoZW4gdXBkYXRlIGZhaWxlZF9lbWJlZGRpbmdzLnR4dFxuICAgICAgICAgIGlmICh0aGlzLnBsdWdpbi5yZW5kZXJfbG9nLmZhaWxlZF9lbWJlZGRpbmdzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIHRoaXMucGx1Z2luLnNhdmVfZmFpbGVkX2VtYmVkZGluZ3MoKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgLy8gZ2V0IG9iamVjdCBrZXlzIG9mIHJlbmRlcl9sb2dcbiAgICAgICAgICB0aGlzLnBsdWdpbi5vdXRwdXRfcmVuZGVyX2xvZygpO1xuICAgICAgICAgIHJldHVybjsgXG4gICAgICAgIH1lbHNle1xuICAgICAgICAgIHRoaXMuaW50ZXJ2YWxfY291bnQrKztcbiAgICAgICAgICB0aGlzLnNldF9tZXNzYWdlKFwiTWFraW5nIFNtYXJ0IENvbm5lY3Rpb25zLi4uXCIrdGhpcy5pbnRlcnZhbF9jb3VudCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9LCAxMCk7XG4gIH1cblxuICBhc3luYyByZW5kZXJfbm90ZV9jb25uZWN0aW9ucyhmaWxlKSB7XG4gICAgdGhpcy5uZWFyZXN0ID0gYXdhaXQgdGhpcy5wbHVnaW4uZmluZF9ub3RlX2Nvbm5lY3Rpb25zKGZpbGUpO1xuICB9XG5cbiAgY2xlYXJfYXV0b19zZWFyY2hlcigpIHtcbiAgICBpZiAodGhpcy5zZWFyY2hfdGltZW91dCkge1xuICAgICAgY2xlYXJUaW1lb3V0KHRoaXMuc2VhcmNoX3RpbWVvdXQpO1xuICAgICAgdGhpcy5zZWFyY2hfdGltZW91dCA9IG51bGw7XG4gICAgfVxuICB9XG5cbiAgYXN5bmMgc2VhcmNoKHNlYXJjaF90ZXh0LCByZXN1bHRzX29ubHk9ZmFsc2UpIHtcbiAgICBjb25zdCBuZWFyZXN0ID0gYXdhaXQgdGhpcy5wbHVnaW4uYXBpLnNlYXJjaChzZWFyY2hfdGV4dCk7XG4gICAgLy8gcmVuZGVyIHJlc3VsdHMgaW4gdmlldyB3aXRoIGZpcnN0IDEwMCBjaGFyYWN0ZXJzIG9mIHNlYXJjaCB0ZXh0XG4gICAgY29uc3QgbmVhcmVzdF9jb250ZXh0ID0gYFNlbGVjdGlvbjogXCIke3NlYXJjaF90ZXh0Lmxlbmd0aCA+IDEwMCA/IHNlYXJjaF90ZXh0LnN1YnN0cmluZygwLCAxMDApICsgXCIuLi5cIiA6IHNlYXJjaF90ZXh0fVwiYDtcbiAgICB0aGlzLnNldF9uZWFyZXN0KG5lYXJlc3QsIG5lYXJlc3RfY29udGV4dCwgcmVzdWx0c19vbmx5KTtcbiAgfVxuXG59XG5jbGFzcyBTbWFydENvbm5lY3Rpb25zVmlld0FwaSB7XG4gIGNvbnN0cnVjdG9yKGFwcCwgcGx1Z2luLCB2aWV3KSB7XG4gICAgdGhpcy5hcHAgPSBhcHA7XG4gICAgdGhpcy5wbHVnaW4gPSBwbHVnaW47XG4gICAgdGhpcy52aWV3ID0gdmlldztcbiAgfVxuICBhc3luYyBzZWFyY2ggKHNlYXJjaF90ZXh0KSB7XG4gICAgcmV0dXJuIGF3YWl0IHRoaXMucGx1Z2luLmFwaS5zZWFyY2goc2VhcmNoX3RleHQpO1xuICB9XG4gIC8vIHRyaWdnZXIgcmVsb2FkIG9mIGVtYmVkZGluZ3MgZmlsZVxuICBhc3luYyByZWxvYWRfZW1iZWRkaW5nc19maWxlKCkge1xuICAgIGF3YWl0IHRoaXMucGx1Z2luLmluaXRfdmVjcygpO1xuICAgIGF3YWl0IHRoaXMudmlldy5yZW5kZXJfY29ubmVjdGlvbnMoKTtcbiAgfVxufVxuY2xhc3MgU2NTZWFyY2hBcGkge1xuICBjb25zdHJ1Y3RvcihhcHAsIHBsdWdpbikge1xuICAgIHRoaXMuYXBwID0gYXBwO1xuICAgIHRoaXMucGx1Z2luID0gcGx1Z2luO1xuICB9XG4gIGFzeW5jIHNlYXJjaCAoc2VhcmNoX3RleHQsIGZpbHRlcj17fSkge1xuICAgIGZpbHRlciA9IHtcbiAgICAgIHNraXBfc2VjdGlvbnM6IHRoaXMucGx1Z2luLnNldHRpbmdzLnNraXBfc2VjdGlvbnMsXG4gICAgICAuLi5maWx0ZXJcbiAgICB9XG4gICAgbGV0IG5lYXJlc3QgPSBbXTtcbiAgICBjb25zdCByZXNwID0gYXdhaXQgdGhpcy5wbHVnaW4ucmVxdWVzdF9lbWJlZGRpbmdfZnJvbV9pbnB1dChzZWFyY2hfdGV4dCk7XG4gICAgaWYgKHJlc3AgJiYgcmVzcC5kYXRhICYmIHJlc3AuZGF0YVswXSAmJiByZXNwLmRhdGFbMF0uZW1iZWRkaW5nKSB7XG4gICAgICBuZWFyZXN0ID0gdGhpcy5wbHVnaW4uc21hcnRfdmVjX2xpdGUubmVhcmVzdChyZXNwLmRhdGFbMF0uZW1iZWRkaW5nLCBmaWx0ZXIpO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyByZXNwIGlzIG51bGwsIHVuZGVmaW5lZCwgb3IgbWlzc2luZyBkYXRhXG4gICAgICBuZXcgT2JzaWRpYW4uTm90aWNlKFwiU21hcnQgQ29ubmVjdGlvbnM6IEVycm9yIGdldHRpbmcgZW1iZWRkaW5nXCIpO1xuICAgIH1cbiAgICByZXR1cm4gbmVhcmVzdDtcbiAgfVxufVxuXG5jbGFzcyBTbWFydENvbm5lY3Rpb25zU2V0dGluZ3NUYWIgZXh0ZW5kcyBPYnNpZGlhbi5QbHVnaW5TZXR0aW5nVGFiIHtcbiAgY29uc3RydWN0b3IoYXBwLCBwbHVnaW4pIHtcbiAgICBzdXBlcihhcHAsIHBsdWdpbik7XG4gICAgdGhpcy5wbHVnaW4gPSBwbHVnaW47XG4gIH1cbiAgZGlzcGxheSgpIHtcbiAgICBjb25zdCB7XG4gICAgICBjb250YWluZXJFbFxuICAgIH0gPSB0aGlzO1xuICAgIGNvbnRhaW5lckVsLmVtcHR5KCk7XG4gICAgY29udGFpbmVyRWwuY3JlYXRlRWwoXCJoMlwiLCB7IHRleHQ6IFwiU3VwcG9ydGVyIEZlYXR1cmVzXCIgfSk7XG4gICAgLy8gbGlzdCBzdXBwb3J0ZXIgYmVuZWZpdHNcbiAgICBjb250YWluZXJFbC5jcmVhdGVFbChcInBcIiwge1xuICAgICAgdGV4dDogXCJBcyBhIFNtYXJ0IENvbm5lY3Rpb25zIFxcXCJTdXBwb3J0ZXJcXFwiLCBmYXN0LXRyYWNrIHlvdXIgUEtNIGpvdXJuZXkgd2l0aCBwcmlvcml0eSBwZXJrcyBhbmQgcGlvbmVlcmluZyBpbm5vdmF0aW9ucy5cIlxuICAgIH0pO1xuICAgIC8vIHRocmVlIGxpc3QgaXRlbXNcbiAgICBjb25zdCBzdXBwb3J0ZXJfYmVuZWZpdHNfbGlzdCA9IGNvbnRhaW5lckVsLmNyZWF0ZUVsKFwidWxcIik7XG4gICAgc3VwcG9ydGVyX2JlbmVmaXRzX2xpc3QuY3JlYXRlRWwoXCJsaVwiLCB7IHRleHQ6IFwiRW5qb3kgc3dpZnQsIHRvcC1wcmlvcml0eSBzdXBwb3J0IGJ5IHJlcGx5aW5nIHRvIHlvdXIgc3VwcG9ydGVyIGxpY2Vuc2Uga2V5IGVtYWlsLlwiIH0pO1xuICAgIHN1cHBvcnRlcl9iZW5lZml0c19saXN0LmNyZWF0ZUVsKFwibGlcIiwgeyB0ZXh0OiBcIkdhaW4gZWFybHkgYWNjZXNzIG5ldyB2ZXJzaW9ucyAodjIuMCBhdmFpbGFibGUgbm93KS5cIiB9KTtcbiAgICBjb25zdCBncHRfbGkgPSBzdXBwb3J0ZXJfYmVuZWZpdHNfbGlzdC5jcmVhdGVFbChcImxpXCIpO1xuICAgIGdwdF9saS5pbm5lckhUTUwgPSAnQWNjZXNzIGV4cGVyaW1lbnRhbCBmZWF0dXJlcyBsaWtlIHRoZSA8YSBocmVmPVwiaHR0cHM6Ly9jaGF0Lm9wZW5haS5jb20vZy9nLVNsRERwMDdibS1zbWFydC1jb25uZWN0aW9ucy1mb3Itb2JzaWRpYW5cIiB0YXJnZXQ9XCJfYmxhbmtcIj5TbWFydCBDb25uZWN0aW9ucyBHUFQ8L2E+IENoYXRHUFQgaW50ZWdyYXRpb24uJztcbiAgICBzdXBwb3J0ZXJfYmVuZWZpdHNfbGlzdC5jcmVhdGVFbChcImxpXCIsIHsgdGV4dDogXCJTdGF5IGluZm9ybWVkIGFuZCBlbmdhZ2VkIHdpdGggZXhjbHVzaXZlIHN1cHBvcnRlci1vbmx5IGNvbW11bmljYXRpb25zLlwiIH0pO1xuICAgIC8vIGJ1dHRvbiBcImdldCB2MlwiXG4gICAgbmV3IE9ic2lkaWFuLlNldHRpbmcoY29udGFpbmVyRWwpLnNldE5hbWUoXCJVcGdyYWRlIHRvIFZlcnNpb24gMi4wLlwiKS5zZXREZXNjKFwiTm8gbW9yZSBzZW5kaW5nIGFsbCBvZiB5b3VyIG5vdGVzIHRvIE9wZW5BSSBmb3IgZW1iZWRkaW5nISBJbmNsdWRlcyBhIGxvY2FsIGVtYmVkZGluZyBtb2RlbCBmb3IgaW5jcmVhc2VkIHByaXZhY3kuXCIpLmFkZEJ1dHRvbigoYnV0dG9uKSA9PiBidXR0b24uc2V0QnV0dG9uVGV4dChcIlVwZ3JhZGUgdG8gdjIuMFwiKS5vbkNsaWNrKGFzeW5jICgpID0+IHtcbiAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnVwZGF0ZV90b192MigpO1xuICAgIH0pKTtcbiAgICAvLyBhZGQgYnV0dG9uIHRvIHRyaWdnZXIgc3luYyBub3RlcyB0byB1c2Ugd2l0aCBDaGF0R1BUXG4gICAgbmV3IE9ic2lkaWFuLlNldHRpbmcoY29udGFpbmVyRWwpLnNldE5hbWUoXCJTeW5jIGZvciBDaGF0R1BUXCIpLnNldERlc2MoXCJNYWtlIG5vdGVzIGF2YWlsYWJsZSB2aWEgdGhlIFNtYXJ0IENvbm5lY3Rpb25zIEdQVCBhbmQgQ2hhdEdQVCBQbHVnaW4uIFJlc3BlY3RzIGV4Y2x1c2lvbiBzZXR0aW5ncyBjb25maWd1cmVkIGJlbG93LlwiKS5hZGRCdXR0b24oKGJ1dHRvbikgPT4gYnV0dG9uLnNldEJ1dHRvblRleHQoXCJTeW5jIGZvciBDaGF0R1BUXCIpLm9uQ2xpY2soYXN5bmMgKCkgPT4ge1xuICAgICAgLy8gc3luYyBub3Rlc1xuICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc3luY19ub3RlcygpO1xuICAgIH0pKTtcbiAgICAvLyBhZGQgYSB0ZXh0IGlucHV0IHRvIGVudGVyIHN1cHBvcnRlciBsaWNlbnNlIGtleVxuICAgIG5ldyBPYnNpZGlhbi5TZXR0aW5nKGNvbnRhaW5lckVsKS5zZXROYW1lKFwiU3VwcG9ydGVyIExpY2Vuc2UgS2V5XCIpLnNldERlc2MoXCJOb3RlOiB0aGlzIGlzIG5vdCByZXF1aXJlZCB0byB1c2UgU21hcnQgQ29ubmVjdGlvbnMuXCIpLmFkZFRleHQoKHRleHQpID0+IHRleHQuc2V0UGxhY2Vob2xkZXIoXCJFbnRlciB5b3VyIGxpY2Vuc2Vfa2V5XCIpLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmxpY2Vuc2Vfa2V5KS5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcbiAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLmxpY2Vuc2Vfa2V5ID0gdmFsdWUudHJpbSgpO1xuICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKHRydWUpO1xuICAgIH0pKTtcbiAgICAvLyBhZGQgYnV0dG9uIHRvIGJlY29tZSBhIHN1cHBvcnRlclxuICAgIG5ldyBPYnNpZGlhbi5TZXR0aW5nKGNvbnRhaW5lckVsKS5zZXROYW1lKFwiU3VwcG9ydCBTbWFydCBDb25uZWN0aW9uc1wiKS5zZXREZXNjKFwiQmVjb21lIGEgc3VwcG9ydGVyIHRvIHN1cHBvcnQgdGhlIGRldmVsb3BtZW50IG9mIFNtYXJ0IENvbm5lY3Rpb25zLlwiKS5hZGRCdXR0b24oKGJ1dHRvbikgPT4gYnV0dG9uLnNldEJ1dHRvblRleHQoXCJCZWNvbWUgYSBTdXBwb3J0ZXJcIikub25DbGljayhhc3luYyAoKSA9PiB7XG4gICAgICBjb25zdCBwYXltZW50X3BhZ2VzID0gW1xuICAgICAgICBcImh0dHBzOi8vYnV5LnN0cmlwZS5jb20vOUFRNWtPNVFuYkFXZ0dBYklZXCIsXG4gICAgICAgIFwiaHR0cHM6Ly9idXkuc3RyaXBlLmNvbS85QVE3c1dlbVQ0OHUxTEdjTjRcIlxuICAgICAgXTtcbiAgICAgIGlmKCF0aGlzLnBsdWdpbi5wYXltZW50X3BhZ2VfaW5kZXgpe1xuICAgICAgICB0aGlzLnBsdWdpbi5wYXltZW50X3BhZ2VfaW5kZXggPSBNYXRoLnJvdW5kKE1hdGgucmFuZG9tKCkpO1xuICAgICAgfVxuICAgICAgLy8gb3BlbiBzdXBwb3J0ZXIgcGFnZSBpbiBicm93c2VyXG4gICAgICB3aW5kb3cub3BlbihwYXltZW50X3BhZ2VzW3RoaXMucGx1Z2luLnBheW1lbnRfcGFnZV9pbmRleF0pO1xuICAgIH0pKTtcblxuICAgIFxuICAgIGNvbnRhaW5lckVsLmNyZWF0ZUVsKFwiaDJcIiwge1xuICAgICAgdGV4dDogXCJPcGVuQUkgU2V0dGluZ3NcIlxuICAgIH0pO1xuICAgIC8vIGFkZCBhIHRleHQgaW5wdXQgdG8gZW50ZXIgdGhlIEFQSSBrZXlcbiAgICBuZXcgT2JzaWRpYW4uU2V0dGluZyhjb250YWluZXJFbCkuc2V0TmFtZShcIk9wZW5BSSBBUEkgS2V5XCIpLnNldERlc2MoXCJSZXF1aXJlZDogYW4gT3BlbkFJIEFQSSBrZXkgaXMgY3VycmVudGx5IHJlcXVpcmVkIHRvIHVzZSBTbWFydCBDb25uZWN0aW9ucy5cIikuYWRkVGV4dCgodGV4dCkgPT4gdGV4dC5zZXRQbGFjZWhvbGRlcihcIkVudGVyIHlvdXIgYXBpX2tleVwiKS5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5hcGlfa2V5KS5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcbiAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLmFwaV9rZXkgPSB2YWx1ZS50cmltKCk7XG4gICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3ModHJ1ZSk7XG4gICAgfSkpO1xuICAgIC8vIGFkZCBhIGJ1dHRvbiB0byB0ZXN0IHRoZSBBUEkga2V5IGlzIHdvcmtpbmdcbiAgICBuZXcgT2JzaWRpYW4uU2V0dGluZyhjb250YWluZXJFbCkuc2V0TmFtZShcIlRlc3QgQVBJIEtleVwiKS5zZXREZXNjKFwiVGVzdCBBUEkgS2V5XCIpLmFkZEJ1dHRvbigoYnV0dG9uKSA9PiBidXR0b24uc2V0QnV0dG9uVGV4dChcIlRlc3QgQVBJIEtleVwiKS5vbkNsaWNrKGFzeW5jICgpID0+IHtcbiAgICAgIC8vIHRlc3QgQVBJIGtleVxuICAgICAgY29uc3QgcmVzcCA9IGF3YWl0IHRoaXMucGx1Z2luLnRlc3RfYXBpX2tleSgpO1xuICAgICAgaWYocmVzcCkge1xuICAgICAgICBuZXcgT2JzaWRpYW4uTm90aWNlKFwiU21hcnQgQ29ubmVjdGlvbnM6IEFQSSBrZXkgaXMgdmFsaWRcIik7XG4gICAgICB9ZWxzZXtcbiAgICAgICAgbmV3IE9ic2lkaWFuLk5vdGljZShcIlNtYXJ0IENvbm5lY3Rpb25zOiBBUEkga2V5IGlzIG5vdCB3b3JraW5nIGFzIGV4cGVjdGVkIVwiKTtcbiAgICAgIH1cbiAgICB9KSk7XG4gICAgLy8gYWRkIGRyb3Bkb3duIHRvIHNlbGVjdCB0aGUgbW9kZWxcbiAgICBuZXcgT2JzaWRpYW4uU2V0dGluZyhjb250YWluZXJFbCkuc2V0TmFtZShcIlNtYXJ0IENoYXQgTW9kZWxcIikuc2V0RGVzYyhcIlNlbGVjdCBhIG1vZGVsIHRvIHVzZSB3aXRoIFNtYXJ0IENoYXQuXCIpLmFkZERyb3Bkb3duKChkcm9wZG93bikgPT4ge1xuICAgICAgZHJvcGRvd24uYWRkT3B0aW9uKFwiZ3B0LTMuNS10dXJiby0xNmtcIiwgXCJncHQtMy41LXR1cmJvLTE2a1wiKTtcbiAgICAgIGRyb3Bkb3duLmFkZE9wdGlvbihcImdwdC00XCIsIFwiZ3B0LTQgKGxpbWl0ZWQgYWNjZXNzLCA4aylcIik7XG4gICAgICBkcm9wZG93bi5hZGRPcHRpb24oXCJncHQtMy41LXR1cmJvXCIsIFwiZ3B0LTMuNS10dXJibyAoNGspXCIpO1xuICAgICAgZHJvcGRvd24uYWRkT3B0aW9uKFwiZ3B0LTQtMTEwNi1wcmV2aWV3XCIsIFwiZ3B0LTQtdHVyYm8gKDEyOGspXCIpO1xuICAgICAgZHJvcGRvd24ub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG4gICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLnNtYXJ0X2NoYXRfbW9kZWwgPSB2YWx1ZTtcbiAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG4gICAgICB9KTtcbiAgICAgIGRyb3Bkb3duLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLnNtYXJ0X2NoYXRfbW9kZWwpO1xuICAgIH0pO1xuICAgIC8vIGxhbmd1YWdlXG4gICAgbmV3IE9ic2lkaWFuLlNldHRpbmcoY29udGFpbmVyRWwpLnNldE5hbWUoXCJEZWZhdWx0IExhbmd1YWdlXCIpLnNldERlc2MoXCJEZWZhdWx0IGxhbmd1YWdlIHRvIHVzZSBmb3IgU21hcnQgQ2hhdC4gQ2hhbmdlcyB3aGljaCBzZWxmLXJlZmVyZW50aWFsIHByb25vdW5zIHdpbGwgdHJpZ2dlciBsb29rdXAgb2YgeW91ciBub3Rlcy5cIikuYWRkRHJvcGRvd24oKGRyb3Bkb3duKSA9PiB7XG4gICAgICAvLyBnZXQgT2JqZWN0IGtleXMgZnJvbSBwcm9ub3VzXG4gICAgICBjb25zdCBsYW5ndWFnZXMgPSBPYmplY3Qua2V5cyhTTUFSVF9UUkFOU0xBVElPTik7XG4gICAgICBmb3IobGV0IGkgPSAwOyBpIDwgbGFuZ3VhZ2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGRyb3Bkb3duLmFkZE9wdGlvbihsYW5ndWFnZXNbaV0sIGxhbmd1YWdlc1tpXSk7XG4gICAgICB9XG4gICAgICBkcm9wZG93bi5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcbiAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MubGFuZ3VhZ2UgPSB2YWx1ZTtcbiAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG4gICAgICAgIHNlbGZfcmVmX3Byb25vdW5zX2xpc3Quc2V0VGV4dCh0aGlzLmdldF9zZWxmX3JlZl9saXN0KCkpO1xuICAgICAgICAvLyBpZiBjaGF0IHZpZXcgaXMgb3BlbiB0aGVuIHJ1biBuZXdfY2hhdCgpXG4gICAgICAgIGNvbnN0IGNoYXRfdmlldyA9IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRMZWF2ZXNPZlR5cGUoU01BUlRfQ09OTkVDVElPTlNfQ0hBVF9WSUVXX1RZUEUpLmxlbmd0aCA+IDAgPyB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0TGVhdmVzT2ZUeXBlKFNNQVJUX0NPTk5FQ1RJT05TX0NIQVRfVklFV19UWVBFKVswXS52aWV3IDogbnVsbDtcbiAgICAgICAgaWYoY2hhdF92aWV3KSB7XG4gICAgICAgICAgY2hhdF92aWV3Lm5ld19jaGF0KCk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgICAgZHJvcGRvd24uc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MubGFuZ3VhZ2UpO1xuICAgIH0pO1xuICAgIC8vIGxpc3QgY3VycmVudCBzZWxmLXJlZmVyZW50aWFsIHByb25vdW5zXG4gICAgY29uc3Qgc2VsZl9yZWZfcHJvbm91bnNfbGlzdCA9IGNvbnRhaW5lckVsLmNyZWF0ZUVsKFwic3BhblwiLCB7XG4gICAgICB0ZXh0OiB0aGlzLmdldF9zZWxmX3JlZl9saXN0KClcbiAgICB9KTtcbiAgICBjb250YWluZXJFbC5jcmVhdGVFbChcImgyXCIsIHtcbiAgICAgIHRleHQ6IFwiRXhjbHVzaW9uc1wiXG4gICAgfSk7XG4gICAgLy8gbGlzdCBmaWxlIGV4Y2x1c2lvbnNcbiAgICBuZXcgT2JzaWRpYW4uU2V0dGluZyhjb250YWluZXJFbCkuc2V0TmFtZShcImZpbGVfZXhjbHVzaW9uc1wiKS5zZXREZXNjKFwiJ0V4Y2x1ZGVkIGZpbGUnIG1hdGNoZXJzIHNlcGFyYXRlZCBieSBhIGNvbW1hLlwiKS5hZGRUZXh0KCh0ZXh0KSA9PiB0ZXh0LnNldFBsYWNlaG9sZGVyKFwiZHJhd2luZ3MscHJvbXB0cy9sb2dzXCIpLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmZpbGVfZXhjbHVzaW9ucykub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG4gICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5maWxlX2V4Y2x1c2lvbnMgPSB2YWx1ZTtcbiAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuICAgIH0pKTtcbiAgICAvLyBsaXN0IGZvbGRlciBleGNsdXNpb25zXG4gICAgbmV3IE9ic2lkaWFuLlNldHRpbmcoY29udGFpbmVyRWwpLnNldE5hbWUoXCJmb2xkZXJfZXhjbHVzaW9uc1wiKS5zZXREZXNjKFwiJ0V4Y2x1ZGVkIGZvbGRlcicgbWF0Y2hlcnMgc2VwYXJhdGVkIGJ5IGEgY29tbWEuXCIpLmFkZFRleHQoKHRleHQpID0+IHRleHQuc2V0UGxhY2Vob2xkZXIoXCJkcmF3aW5ncyxwcm9tcHRzL2xvZ3NcIikuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MuZm9sZGVyX2V4Y2x1c2lvbnMpLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MuZm9sZGVyX2V4Y2x1c2lvbnMgPSB2YWx1ZTtcbiAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuICAgIH0pKTtcbiAgICAvLyBsaXN0IHBhdGggb25seSBtYXRjaGVyc1xuICAgIG5ldyBPYnNpZGlhbi5TZXR0aW5nKGNvbnRhaW5lckVsKS5zZXROYW1lKFwicGF0aF9vbmx5XCIpLnNldERlc2MoXCInUGF0aCBvbmx5JyBtYXRjaGVycyBzZXBhcmF0ZWQgYnkgYSBjb21tYS5cIikuYWRkVGV4dCgodGV4dCkgPT4gdGV4dC5zZXRQbGFjZWhvbGRlcihcImRyYXdpbmdzLHByb21wdHMvbG9nc1wiKS5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5wYXRoX29ubHkpLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MucGF0aF9vbmx5ID0gdmFsdWU7XG4gICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcbiAgICB9KSk7XG4gICAgLy8gbGlzdCBoZWFkZXIgZXhjbHVzaW9uc1xuICAgIG5ldyBPYnNpZGlhbi5TZXR0aW5nKGNvbnRhaW5lckVsKS5zZXROYW1lKFwiaGVhZGVyX2V4Y2x1c2lvbnNcIikuc2V0RGVzYyhcIidFeGNsdWRlZCBoZWFkZXInIG1hdGNoZXJzIHNlcGFyYXRlZCBieSBhIGNvbW1hLiBXb3JrcyBmb3IgJ2Jsb2Nrcycgb25seS5cIikuYWRkVGV4dCgodGV4dCkgPT4gdGV4dC5zZXRQbGFjZWhvbGRlcihcImRyYXdpbmdzLHByb21wdHMvbG9nc1wiKS5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5oZWFkZXJfZXhjbHVzaW9ucykub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG4gICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5oZWFkZXJfZXhjbHVzaW9ucyA9IHZhbHVlO1xuICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG4gICAgfSkpO1xuICAgIGNvbnRhaW5lckVsLmNyZWF0ZUVsKFwiaDJcIiwge1xuICAgICAgdGV4dDogXCJEaXNwbGF5XCJcbiAgICB9KTtcbiAgICAvLyB0b2dnbGUgc2hvd2luZyBmdWxsIHBhdGggaW4gdmlld1xuICAgIG5ldyBPYnNpZGlhbi5TZXR0aW5nKGNvbnRhaW5lckVsKS5zZXROYW1lKFwic2hvd19mdWxsX3BhdGhcIikuc2V0RGVzYyhcIlNob3cgZnVsbCBwYXRoIGluIHZpZXcuXCIpLmFkZFRvZ2dsZSgodG9nZ2xlKSA9PiB0b2dnbGUuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3Muc2hvd19mdWxsX3BhdGgpLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3Muc2hvd19mdWxsX3BhdGggPSB2YWx1ZTtcbiAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncyh0cnVlKTtcbiAgICB9KSk7XG4gICAgLy8gdG9nZ2xlIGV4cGFuZGVkIHZpZXcgYnkgZGVmYXVsdFxuICAgIG5ldyBPYnNpZGlhbi5TZXR0aW5nKGNvbnRhaW5lckVsKS5zZXROYW1lKFwiZXhwYW5kZWRfdmlld1wiKS5zZXREZXNjKFwiRXhwYW5kZWQgdmlldyBieSBkZWZhdWx0LlwiKS5hZGRUb2dnbGUoKHRvZ2dsZSkgPT4gdG9nZ2xlLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmV4cGFuZGVkX3ZpZXcpLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MuZXhwYW5kZWRfdmlldyA9IHZhbHVlO1xuICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKHRydWUpO1xuICAgIH0pKTtcbiAgICAvLyB0b2dnbGUgZ3JvdXAgbmVhcmVzdCBieSBmaWxlXG4gICAgbmV3IE9ic2lkaWFuLlNldHRpbmcoY29udGFpbmVyRWwpLnNldE5hbWUoXCJncm91cF9uZWFyZXN0X2J5X2ZpbGVcIikuc2V0RGVzYyhcIkdyb3VwIG5lYXJlc3QgYnkgZmlsZS5cIikuYWRkVG9nZ2xlKCh0b2dnbGUpID0+IHRvZ2dsZS5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5ncm91cF9uZWFyZXN0X2J5X2ZpbGUpLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MuZ3JvdXBfbmVhcmVzdF9ieV9maWxlID0gdmFsdWU7XG4gICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3ModHJ1ZSk7XG4gICAgfSkpO1xuICAgIC8vIHRvZ2dsZSB2aWV3X29wZW4gb24gT2JzaWRpYW4gc3RhcnR1cFxuICAgIG5ldyBPYnNpZGlhbi5TZXR0aW5nKGNvbnRhaW5lckVsKS5zZXROYW1lKFwidmlld19vcGVuXCIpLnNldERlc2MoXCJPcGVuIHZpZXcgb24gT2JzaWRpYW4gc3RhcnR1cC5cIikuYWRkVG9nZ2xlKCh0b2dnbGUpID0+IHRvZ2dsZS5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy52aWV3X29wZW4pLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3Mudmlld19vcGVuID0gdmFsdWU7XG4gICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3ModHJ1ZSk7XG4gICAgfSkpO1xuICAgIC8vIHRvZ2dsZSBjaGF0X29wZW4gb24gT2JzaWRpYW4gc3RhcnR1cFxuICAgIG5ldyBPYnNpZGlhbi5TZXR0aW5nKGNvbnRhaW5lckVsKS5zZXROYW1lKFwiY2hhdF9vcGVuXCIpLnNldERlc2MoXCJPcGVuIHZpZXcgb24gT2JzaWRpYW4gc3RhcnR1cC5cIikuYWRkVG9nZ2xlKCh0b2dnbGUpID0+IHRvZ2dsZS5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5jaGF0X29wZW4pLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MuY2hhdF9vcGVuID0gdmFsdWU7XG4gICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3ModHJ1ZSk7XG4gICAgfSkpO1xuICAgIGNvbnRhaW5lckVsLmNyZWF0ZUVsKFwiaDJcIiwge1xuICAgICAgdGV4dDogXCJBZHZhbmNlZFwiXG4gICAgfSk7XG4gICAgLy8gdG9nZ2xlIGxvZ19yZW5kZXJcbiAgICBuZXcgT2JzaWRpYW4uU2V0dGluZyhjb250YWluZXJFbCkuc2V0TmFtZShcImxvZ19yZW5kZXJcIikuc2V0RGVzYyhcIkxvZyByZW5kZXIgZGV0YWlscyB0byBjb25zb2xlIChpbmNsdWRlcyB0b2tlbl91c2FnZSkuXCIpLmFkZFRvZ2dsZSgodG9nZ2xlKSA9PiB0b2dnbGUuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MubG9nX3JlbmRlcikub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG4gICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5sb2dfcmVuZGVyID0gdmFsdWU7XG4gICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3ModHJ1ZSk7XG4gICAgfSkpO1xuICAgIC8vIHRvZ2dsZSBmaWxlcyBpbiBsb2dfcmVuZGVyXG4gICAgbmV3IE9ic2lkaWFuLlNldHRpbmcoY29udGFpbmVyRWwpLnNldE5hbWUoXCJsb2dfcmVuZGVyX2ZpbGVzXCIpLnNldERlc2MoXCJMb2cgZW1iZWRkZWQgb2JqZWN0cyBwYXRocyB3aXRoIGxvZyByZW5kZXIgKGZvciBkZWJ1Z2dpbmcpLlwiKS5hZGRUb2dnbGUoKHRvZ2dsZSkgPT4gdG9nZ2xlLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmxvZ19yZW5kZXJfZmlsZXMpLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MubG9nX3JlbmRlcl9maWxlcyA9IHZhbHVlO1xuICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKHRydWUpO1xuICAgIH0pKTtcbiAgICAvLyB0b2dnbGUgc2tpcF9zZWN0aW9uc1xuICAgIG5ldyBPYnNpZGlhbi5TZXR0aW5nKGNvbnRhaW5lckVsKS5zZXROYW1lKFwic2tpcF9zZWN0aW9uc1wiKS5zZXREZXNjKFwiU2tpcHMgbWFraW5nIGNvbm5lY3Rpb25zIHRvIHNwZWNpZmljIHNlY3Rpb25zIHdpdGhpbiBub3Rlcy4gV2FybmluZzogcmVkdWNlcyB1c2VmdWxuZXNzIGZvciBsYXJnZSBmaWxlcyBhbmQgcmVxdWlyZXMgJ0ZvcmNlIFJlZnJlc2gnIGZvciBzZWN0aW9ucyB0byB3b3JrIGluIHRoZSBmdXR1cmUuXCIpLmFkZFRvZ2dsZSgodG9nZ2xlKSA9PiB0b2dnbGUuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3Muc2tpcF9zZWN0aW9ucykub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG4gICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5za2lwX3NlY3Rpb25zID0gdmFsdWU7XG4gICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3ModHJ1ZSk7XG4gICAgfSkpO1xuICAgIC8vIHRlc3QgZmlsZSB3cml0aW5nIGJ5IGNyZWF0aW5nIGEgdGVzdCBmaWxlLCB0aGVuIHdyaXRpbmcgYWRkaXRpb25hbCBkYXRhIHRvIHRoZSBmaWxlLCBhbmQgcmV0dXJuaW5nIGFueSBlcnJvciB0ZXh0IGlmIGl0IGZhaWxzXG4gICAgY29udGFpbmVyRWwuY3JlYXRlRWwoXCJoM1wiLCB7XG4gICAgICB0ZXh0OiBcIlRlc3QgRmlsZSBXcml0aW5nXCJcbiAgICB9KTtcbiAgICAvLyBtYW51YWwgc2F2ZSBidXR0b25cbiAgICBjb250YWluZXJFbC5jcmVhdGVFbChcImgzXCIsIHtcbiAgICAgIHRleHQ6IFwiTWFudWFsIFNhdmVcIlxuICAgIH0pO1xuICAgIGxldCBtYW51YWxfc2F2ZV9yZXN1bHRzID0gY29udGFpbmVyRWwuY3JlYXRlRWwoXCJkaXZcIik7XG4gICAgbmV3IE9ic2lkaWFuLlNldHRpbmcoY29udGFpbmVyRWwpLnNldE5hbWUoXCJtYW51YWxfc2F2ZVwiKS5zZXREZXNjKFwiU2F2ZSBjdXJyZW50IGVtYmVkZGluZ3NcIikuYWRkQnV0dG9uKChidXR0b24pID0+IGJ1dHRvbi5zZXRCdXR0b25UZXh0KFwiTWFudWFsIFNhdmVcIikub25DbGljayhhc3luYyAoKSA9PiB7XG4gICAgICAvLyBjb25maXJtXG4gICAgICBpZiAoY29uZmlybShcIkFyZSB5b3Ugc3VyZSB5b3Ugd2FudCB0byBzYXZlIHlvdXIgY3VycmVudCBlbWJlZGRpbmdzP1wiKSkge1xuICAgICAgICAvLyBzYXZlXG4gICAgICAgIHRyeXtcbiAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlX2VtYmVkZGluZ3NfdG9fZmlsZSh0cnVlKTtcbiAgICAgICAgICBtYW51YWxfc2F2ZV9yZXN1bHRzLmlubmVySFRNTCA9IFwiRW1iZWRkaW5ncyBzYXZlZCBzdWNjZXNzZnVsbHkuXCI7XG4gICAgICAgIH1jYXRjaChlKXtcbiAgICAgICAgICBtYW51YWxfc2F2ZV9yZXN1bHRzLmlubmVySFRNTCA9IFwiRW1iZWRkaW5ncyBmYWlsZWQgdG8gc2F2ZS4gRXJyb3I6IFwiICsgZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pKTtcblxuICAgIC8vIGxpc3QgcHJldmlvdXNseSBmYWlsZWQgZmlsZXNcbiAgICBjb250YWluZXJFbC5jcmVhdGVFbChcImgzXCIsIHtcbiAgICAgIHRleHQ6IFwiUHJldmlvdXNseSBmYWlsZWQgZmlsZXNcIlxuICAgIH0pO1xuICAgIGxldCBmYWlsZWRfbGlzdCA9IGNvbnRhaW5lckVsLmNyZWF0ZUVsKFwiZGl2XCIpO1xuICAgIHRoaXMuZHJhd19mYWlsZWRfZmlsZXNfbGlzdChmYWlsZWRfbGlzdCk7XG5cbiAgICAvLyBmb3JjZSByZWZyZXNoIGJ1dHRvblxuICAgIGNvbnRhaW5lckVsLmNyZWF0ZUVsKFwiaDNcIiwge1xuICAgICAgdGV4dDogXCJGb3JjZSBSZWZyZXNoXCJcbiAgICB9KTtcbiAgICBuZXcgT2JzaWRpYW4uU2V0dGluZyhjb250YWluZXJFbCkuc2V0TmFtZShcImZvcmNlX3JlZnJlc2hcIikuc2V0RGVzYyhcIldBUk5JTkc6IERPIE5PVCB1c2UgdW5sZXNzIHlvdSBrbm93IHdoYXQgeW91IGFyZSBkb2luZyEgVGhpcyB3aWxsIGRlbGV0ZSBhbGwgb2YgeW91ciBjdXJyZW50IGVtYmVkZGluZ3MgZnJvbSBPcGVuQUkgYW5kIHRyaWdnZXIgcmVwcm9jZXNzaW5nIG9mIHlvdXIgZW50aXJlIHZhdWx0IVwiKS5hZGRCdXR0b24oKGJ1dHRvbikgPT4gYnV0dG9uLnNldEJ1dHRvblRleHQoXCJGb3JjZSBSZWZyZXNoXCIpLm9uQ2xpY2soYXN5bmMgKCkgPT4ge1xuICAgICAgLy8gY29uZmlybVxuICAgICAgaWYgKGNvbmZpcm0oXCJBcmUgeW91IHN1cmUgeW91IHdhbnQgdG8gRm9yY2UgUmVmcmVzaD8gQnkgY2xpY2tpbmcgeWVzIHlvdSBjb25maXJtIHRoYXQgeW91IHVuZGVyc3RhbmQgdGhlIGNvbnNlcXVlbmNlcyBvZiB0aGlzIGFjdGlvbi5cIikpIHtcbiAgICAgICAgLy8gZm9yY2UgcmVmcmVzaFxuICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5mb3JjZV9yZWZyZXNoX2VtYmVkZGluZ3NfZmlsZSgpO1xuICAgICAgfVxuICAgIH0pKTtcblxuICB9XG4gIGdldF9zZWxmX3JlZl9saXN0KCkge1xuICAgIHJldHVybiBcIkN1cnJlbnQ6IFwiICsgU01BUlRfVFJBTlNMQVRJT05bdGhpcy5wbHVnaW4uc2V0dGluZ3MubGFuZ3VhZ2VdLnByb25vdXMuam9pbihcIiwgXCIpO1xuICB9XG5cbiAgZHJhd19mYWlsZWRfZmlsZXNfbGlzdChmYWlsZWRfbGlzdCkge1xuICAgIGZhaWxlZF9saXN0LmVtcHR5KCk7XG4gICAgaWYodGhpcy5wbHVnaW4uc2V0dGluZ3MuZmFpbGVkX2ZpbGVzLmxlbmd0aCA+IDApIHtcbiAgICAgIC8vIGFkZCBtZXNzYWdlIHRoYXQgdGhlc2UgZmlsZXMgd2lsbCBiZSBza2lwcGVkIHVudGlsIG1hbnVhbGx5IHJldHJpZWRcbiAgICAgIGZhaWxlZF9saXN0LmNyZWF0ZUVsKFwicFwiLCB7XG4gICAgICAgIHRleHQ6IFwiVGhlIGZvbGxvd2luZyBmaWxlcyBmYWlsZWQgdG8gcHJvY2VzcyBhbmQgd2lsbCBiZSBza2lwcGVkIHVudGlsIG1hbnVhbGx5IHJldHJpZWQuXCJcbiAgICAgIH0pO1xuICAgICAgbGV0IGxpc3QgPSBmYWlsZWRfbGlzdC5jcmVhdGVFbChcInVsXCIpO1xuICAgICAgZm9yIChsZXQgZmFpbGVkX2ZpbGUgb2YgdGhpcy5wbHVnaW4uc2V0dGluZ3MuZmFpbGVkX2ZpbGVzKSB7XG4gICAgICAgIGxpc3QuY3JlYXRlRWwoXCJsaVwiLCB7XG4gICAgICAgICAgdGV4dDogZmFpbGVkX2ZpbGVcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgICAvLyBhZGQgYnV0dG9uIHRvIHJldHJ5IGZhaWxlZCBmaWxlcyBvbmx5XG4gICAgICBuZXcgT2JzaWRpYW4uU2V0dGluZyhmYWlsZWRfbGlzdCkuc2V0TmFtZShcInJldHJ5X2ZhaWxlZF9maWxlc1wiKS5zZXREZXNjKFwiUmV0cnkgZmFpbGVkIGZpbGVzIG9ubHlcIikuYWRkQnV0dG9uKChidXR0b24pID0+IGJ1dHRvbi5zZXRCdXR0b25UZXh0KFwiUmV0cnkgZmFpbGVkIGZpbGVzIG9ubHlcIikub25DbGljayhhc3luYyAoKSA9PiB7XG4gICAgICAgIC8vIGNsZWFyIGZhaWxlZF9saXN0IGVsZW1lbnRcbiAgICAgICAgZmFpbGVkX2xpc3QuZW1wdHkoKTtcbiAgICAgICAgLy8gc2V0IFwicmV0cnlpbmdcIiB0ZXh0XG4gICAgICAgIGZhaWxlZF9saXN0LmNyZWF0ZUVsKFwicFwiLCB7XG4gICAgICAgICAgdGV4dDogXCJSZXRyeWluZyBmYWlsZWQgZmlsZXMuLi5cIlxuICAgICAgICB9KTtcbiAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4ucmV0cnlfZmFpbGVkX2ZpbGVzKCk7XG4gICAgICAgIC8vIHJlZHJhdyBmYWlsZWQgZmlsZXMgbGlzdFxuICAgICAgICB0aGlzLmRyYXdfZmFpbGVkX2ZpbGVzX2xpc3QoZmFpbGVkX2xpc3QpO1xuICAgICAgfSkpO1xuICAgIH1lbHNle1xuICAgICAgZmFpbGVkX2xpc3QuY3JlYXRlRWwoXCJwXCIsIHtcbiAgICAgICAgdGV4dDogXCJObyBmYWlsZWQgZmlsZXNcIlxuICAgICAgfSk7XG4gICAgfVxuICB9XG59XG5cbmZ1bmN0aW9uIGxpbmVfaXNfaGVhZGluZyhsaW5lKSB7XG4gIHJldHVybiAobGluZS5pbmRleE9mKFwiI1wiKSA9PT0gMCkgJiYgKFsnIycsICcgJ10uaW5kZXhPZihsaW5lWzFdKSAhPT0gLTEpO1xufVxuXG5jb25zdCBTTUFSVF9DT05ORUNUSU9OU19DSEFUX1ZJRVdfVFlQRSA9IFwic21hcnQtY29ubmVjdGlvbnMtY2hhdC12aWV3XCI7XG5cbmNsYXNzIFNtYXJ0Q29ubmVjdGlvbnNDaGF0VmlldyBleHRlbmRzIE9ic2lkaWFuLkl0ZW1WaWV3IHtcbiAgY29uc3RydWN0b3IobGVhZiwgcGx1Z2luKSB7XG4gICAgc3VwZXIobGVhZik7XG4gICAgdGhpcy5wbHVnaW4gPSBwbHVnaW47XG4gICAgdGhpcy5hY3RpdmVfZWxtID0gbnVsbDtcbiAgICB0aGlzLmFjdGl2ZV9zdHJlYW0gPSBudWxsO1xuICAgIHRoaXMuYnJhY2tldHNfY3QgPSAwO1xuICAgIHRoaXMuY2hhdCA9IG51bGw7XG4gICAgdGhpcy5jaGF0X2JveCA9IG51bGw7XG4gICAgdGhpcy5jaGF0X2NvbnRhaW5lciA9IG51bGw7XG4gICAgdGhpcy5jdXJyZW50X2NoYXRfbWwgPSBbXTtcbiAgICB0aGlzLmZpbGVzID0gW107XG4gICAgdGhpcy5sYXN0X2Zyb20gPSBudWxsO1xuICAgIHRoaXMubWVzc2FnZV9jb250YWluZXIgPSBudWxsO1xuICAgIHRoaXMucHJldmVudF9pbnB1dCA9IGZhbHNlO1xuICB9XG4gIGdldERpc3BsYXlUZXh0KCkge1xuICAgIHJldHVybiBcIlNtYXJ0IENvbm5lY3Rpb25zIENoYXRcIjtcbiAgfVxuICBnZXRJY29uKCkge1xuICAgIHJldHVybiBcIm1lc3NhZ2Utc3F1YXJlXCI7XG4gIH1cbiAgZ2V0Vmlld1R5cGUoKSB7XG4gICAgcmV0dXJuIFNNQVJUX0NPTk5FQ1RJT05TX0NIQVRfVklFV19UWVBFO1xuICB9XG4gIG9uT3BlbigpIHtcbiAgICB0aGlzLm5ld19jaGF0KCk7XG4gICAgdGhpcy5wbHVnaW4uZ2V0X2FsbF9mb2xkZXJzKCk7IC8vIHNldHMgdGhpcy5wbHVnaW4uZm9sZGVycyBuZWNlc3NhcnkgZm9yIGZvbGRlci1jb250ZXh0XG4gIH1cbiAgb25DbG9zZSgpIHtcbiAgICB0aGlzLmNoYXQuc2F2ZV9jaGF0KCk7XG4gICAgdGhpcy5hcHAud29ya3NwYWNlLnVucmVnaXN0ZXJIb3ZlckxpbmtTb3VyY2UoU01BUlRfQ09OTkVDVElPTlNfQ0hBVF9WSUVXX1RZUEUpO1xuICB9XG4gIHJlbmRlcl9jaGF0KCkge1xuICAgIHRoaXMuY29udGFpbmVyRWwuZW1wdHkoKTtcbiAgICB0aGlzLmNoYXRfY29udGFpbmVyID0gdGhpcy5jb250YWluZXJFbC5jcmVhdGVEaXYoXCJzYy1jaGF0LWNvbnRhaW5lclwiKTtcbiAgICAvLyByZW5kZXIgcGx1cyBzaWduIGZvciBjbGVhciBidXR0b25cbiAgICB0aGlzLnJlbmRlcl90b3BfYmFyKCk7XG4gICAgLy8gcmVuZGVyIGNoYXQgbWVzc2FnZXMgY29udGFpbmVyXG4gICAgdGhpcy5yZW5kZXJfY2hhdF9ib3goKTtcbiAgICAvLyByZW5kZXIgY2hhdCBpbnB1dFxuICAgIHRoaXMucmVuZGVyX2NoYXRfaW5wdXQoKTtcbiAgICB0aGlzLnBsdWdpbi5yZW5kZXJfYnJhbmQodGhpcy5jb250YWluZXJFbCwgXCJjaGF0XCIpO1xuICB9XG4gIC8vIHJlbmRlciBwbHVzIHNpZ24gZm9yIGNsZWFyIGJ1dHRvblxuICByZW5kZXJfdG9wX2JhcigpIHtcbiAgICAvLyBjcmVhdGUgY29udGFpbmVyIGZvciBjbGVhciBidXR0b25cbiAgICBsZXQgdG9wX2Jhcl9jb250YWluZXIgPSB0aGlzLmNoYXRfY29udGFpbmVyLmNyZWF0ZURpdihcInNjLXRvcC1iYXItY29udGFpbmVyXCIpO1xuICAgIC8vIHJlbmRlciB0aGUgbmFtZSBvZiB0aGUgY2hhdCBpbiBhbiBpbnB1dCBib3ggKHBvcCBjb250ZW50IGFmdGVyIGxhc3QgaHlwaGVuIGluIGNoYXRfaWQpXG4gICAgbGV0IGNoYXRfbmFtZSA9dGhpcy5jaGF0Lm5hbWUoKTtcbiAgICBsZXQgY2hhdF9uYW1lX2lucHV0ID0gdG9wX2Jhcl9jb250YWluZXIuY3JlYXRlRWwoXCJpbnB1dFwiLCB7XG4gICAgICBhdHRyOiB7XG4gICAgICAgIHR5cGU6IFwidGV4dFwiLFxuICAgICAgICB2YWx1ZTogY2hhdF9uYW1lXG4gICAgICB9LFxuICAgICAgY2xzOiBcInNjLWNoYXQtbmFtZS1pbnB1dFwiXG4gICAgfSk7XG4gICAgY2hhdF9uYW1lX2lucHV0LmFkZEV2ZW50TGlzdGVuZXIoXCJjaGFuZ2VcIiwgdGhpcy5yZW5hbWVfY2hhdC5iaW5kKHRoaXMpKTtcbiAgICBcbiAgICAvLyBjcmVhdGUgYnV0dG9uIHRvIFNtYXJ0IFZpZXdcbiAgICBsZXQgc21hcnRfdmlld19idG4gPSB0aGlzLmNyZWF0ZV90b3BfYmFyX2J1dHRvbih0b3BfYmFyX2NvbnRhaW5lciwgXCJTbWFydCBWaWV3XCIsIFwic21hcnQtY29ubmVjdGlvbnNcIik7XG4gICAgc21hcnRfdmlld19idG4uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIHRoaXMub3Blbl9zbWFydF92aWV3LmJpbmQodGhpcykpO1xuICAgIC8vIGNyZWF0ZSBidXR0b24gdG8gc2F2ZSBjaGF0XG4gICAgbGV0IHNhdmVfYnRuID0gdGhpcy5jcmVhdGVfdG9wX2Jhcl9idXR0b24odG9wX2Jhcl9jb250YWluZXIsIFwiU2F2ZSBDaGF0XCIsIFwic2F2ZVwiKTtcbiAgICBzYXZlX2J0bi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgdGhpcy5zYXZlX2NoYXQuYmluZCh0aGlzKSk7XG4gICAgLy8gY3JlYXRlIGJ1dHRvbiB0byBvcGVuIGNoYXQgaGlzdG9yeSBtb2RhbFxuICAgIGxldCBoaXN0b3J5X2J0biA9IHRoaXMuY3JlYXRlX3RvcF9iYXJfYnV0dG9uKHRvcF9iYXJfY29udGFpbmVyLCBcIkNoYXQgSGlzdG9yeVwiLCBcImhpc3RvcnlcIik7XG4gICAgaGlzdG9yeV9idG4uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIHRoaXMub3Blbl9jaGF0X2hpc3RvcnkuYmluZCh0aGlzKSk7XG4gICAgLy8gY3JlYXRlIGJ1dHRvbiB0byBzdGFydCBuZXcgY2hhdFxuICAgIGNvbnN0IG5ld19jaGF0X2J0biA9IHRoaXMuY3JlYXRlX3RvcF9iYXJfYnV0dG9uKHRvcF9iYXJfY29udGFpbmVyLCBcIk5ldyBDaGF0XCIsIFwicGx1c1wiKTtcbiAgICBuZXdfY2hhdF9idG4uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIHRoaXMubmV3X2NoYXQuYmluZCh0aGlzKSk7XG4gIH1cbiAgYXN5bmMgb3Blbl9jaGF0X2hpc3RvcnkoKSB7XG4gICAgY29uc3QgZm9sZGVyID0gYXdhaXQgdGhpcy5hcHAudmF1bHQuYWRhcHRlci5saXN0KFwiLnNtYXJ0LWNvbm5lY3Rpb25zL2NoYXRzXCIpO1xuICAgIHRoaXMuZmlsZXMgPSBmb2xkZXIuZmlsZXMubWFwKChmaWxlKSA9PiB7XG4gICAgICByZXR1cm4gZmlsZS5yZXBsYWNlKFwiLnNtYXJ0LWNvbm5lY3Rpb25zL2NoYXRzL1wiLCBcIlwiKS5yZXBsYWNlKFwiLmpzb25cIiwgXCJcIik7XG4gICAgfSk7XG4gICAgLy8gb3BlbiBjaGF0IGhpc3RvcnkgbW9kYWxcbiAgICBpZiAoIXRoaXMubW9kYWwpXG4gICAgICB0aGlzLm1vZGFsID0gbmV3IFNtYXJ0Q29ubmVjdGlvbnNDaGF0SGlzdG9yeU1vZGFsKHRoaXMuYXBwLCB0aGlzKTtcbiAgICB0aGlzLm1vZGFsLm9wZW4oKTtcbiAgfVxuXG4gIGNyZWF0ZV90b3BfYmFyX2J1dHRvbih0b3BfYmFyX2NvbnRhaW5lciwgdGl0bGUsIGljb249bnVsbCkge1xuICAgIGxldCBidG4gPSB0b3BfYmFyX2NvbnRhaW5lci5jcmVhdGVFbChcImJ1dHRvblwiLCB7XG4gICAgICBhdHRyOiB7XG4gICAgICAgIHRpdGxlOiB0aXRsZVxuICAgICAgfVxuICAgIH0pO1xuICAgIGlmKGljb24pe1xuICAgICAgT2JzaWRpYW4uc2V0SWNvbihidG4sIGljb24pO1xuICAgIH1lbHNle1xuICAgICAgYnRuLmlubmVySFRNTCA9IHRpdGxlO1xuICAgIH1cbiAgICByZXR1cm4gYnRuO1xuICB9XG4gIC8vIHJlbmRlciBuZXcgY2hhdFxuICBuZXdfY2hhdCgpIHtcbiAgICB0aGlzLmNsZWFyX2NoYXQoKTtcbiAgICB0aGlzLnJlbmRlcl9jaGF0KCk7XG4gICAgLy8gcmVuZGVyIGluaXRpYWwgbWVzc2FnZSBmcm9tIGFzc2lzdGFudCAoZG9uJ3QgdXNlIHJlbmRlcl9tZXNzYWdlIHRvIHNraXAgYWRkaW5nIHRvIGNoYXQgaGlzdG9yeSlcbiAgICB0aGlzLm5ld19tZXNzc2FnZV9idWJibGUoXCJhc3Npc3RhbnRcIik7XG4gICAgdGhpcy5hY3RpdmVfZWxtLmlubmVySFRNTCA9ICc8cD4nICsgU01BUlRfVFJBTlNMQVRJT05bdGhpcy5wbHVnaW4uc2V0dGluZ3MubGFuZ3VhZ2VdLmluaXRpYWxfbWVzc2FnZSsnPC9wPic7XG4gIH1cbiAgLy8gb3BlbiBhIGNoYXQgZnJvbSB0aGUgY2hhdCBoaXN0b3J5IG1vZGFsXG4gIGFzeW5jIG9wZW5fY2hhdChjaGF0X2lkKSB7XG4gICAgdGhpcy5jbGVhcl9jaGF0KCk7XG4gICAgYXdhaXQgdGhpcy5jaGF0LmxvYWRfY2hhdChjaGF0X2lkKTtcbiAgICB0aGlzLnJlbmRlcl9jaGF0KCk7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLmNoYXQuY2hhdF9tbC5sZW5ndGg7IGkrKykge1xuICAgICAgYXdhaXQgdGhpcy5yZW5kZXJfbWVzc2FnZSh0aGlzLmNoYXQuY2hhdF9tbFtpXS5jb250ZW50LCB0aGlzLmNoYXQuY2hhdF9tbFtpXS5yb2xlKTtcbiAgICB9XG4gIH1cbiAgLy8gY2xlYXIgY3VycmVudCBjaGF0IHN0YXRlXG4gIGNsZWFyX2NoYXQoKSB7XG4gICAgaWYgKHRoaXMuY2hhdCkge1xuICAgICAgdGhpcy5jaGF0LnNhdmVfY2hhdCgpO1xuICAgIH1cbiAgICB0aGlzLmNoYXQgPSBuZXcgU21hcnRDb25uZWN0aW9uc0NoYXRNb2RlbCh0aGlzLnBsdWdpbik7XG4gICAgLy8gaWYgdGhpcy5kb3Rkb3Rkb3RfaW50ZXJ2YWwgaXMgbm90IG51bGwsIGNsZWFyIGludGVydmFsXG4gICAgaWYgKHRoaXMuZG90ZG90ZG90X2ludGVydmFsKSB7XG4gICAgICBjbGVhckludGVydmFsKHRoaXMuZG90ZG90ZG90X2ludGVydmFsKTtcbiAgICB9XG4gICAgLy8gY2xlYXIgY3VycmVudCBjaGF0IG1sXG4gICAgdGhpcy5jdXJyZW50X2NoYXRfbWwgPSBbXTtcbiAgICAvLyB1cGRhdGUgcHJldmVudCBpbnB1dFxuICAgIHRoaXMuZW5kX3N0cmVhbSgpO1xuICB9XG5cbiAgcmVuYW1lX2NoYXQoZXZlbnQpIHtcbiAgICBsZXQgbmV3X2NoYXRfbmFtZSA9IGV2ZW50LnRhcmdldC52YWx1ZTtcbiAgICB0aGlzLmNoYXQucmVuYW1lX2NoYXQobmV3X2NoYXRfbmFtZSk7XG4gIH1cbiAgXG4gIC8vIHNhdmUgY3VycmVudCBjaGF0XG4gIHNhdmVfY2hhdCgpIHtcbiAgICB0aGlzLmNoYXQuc2F2ZV9jaGF0KCk7XG4gICAgbmV3IE9ic2lkaWFuLk5vdGljZShcIltTbWFydCBDb25uZWN0aW9uc10gQ2hhdCBzYXZlZFwiKTtcbiAgfVxuICBcbiAgb3Blbl9zbWFydF92aWV3KCkge1xuICAgIHRoaXMucGx1Z2luLm9wZW5fdmlldygpO1xuICB9XG4gIC8vIHJlbmRlciBjaGF0IG1lc3NhZ2VzIGNvbnRhaW5lclxuICByZW5kZXJfY2hhdF9ib3goKSB7XG4gICAgLy8gY3JlYXRlIGNvbnRhaW5lciBmb3IgY2hhdCBtZXNzYWdlc1xuICAgIHRoaXMuY2hhdF9ib3ggPSB0aGlzLmNoYXRfY29udGFpbmVyLmNyZWF0ZURpdihcInNjLWNoYXQtYm94XCIpO1xuICAgIC8vIGNyZWF0ZSBjb250YWluZXIgZm9yIG1lc3NhZ2VcbiAgICB0aGlzLm1lc3NhZ2VfY29udGFpbmVyID0gdGhpcy5jaGF0X2JveC5jcmVhdGVEaXYoXCJzYy1tZXNzYWdlLWNvbnRhaW5lclwiKTtcbiAgfVxuICAvLyBvcGVuIGZpbGUgc3VnZ2VzdGlvbiBtb2RhbFxuICBvcGVuX2ZpbGVfc3VnZ2VzdGlvbl9tb2RhbCgpIHtcbiAgICAvLyBvcGVuIGZpbGUgc3VnZ2VzdGlvbiBtb2RhbFxuICAgIGlmKCF0aGlzLmZpbGVfc2VsZWN0b3IpIHRoaXMuZmlsZV9zZWxlY3RvciA9IG5ldyBTbWFydENvbm5lY3Rpb25zRmlsZVNlbGVjdE1vZGFsKHRoaXMuYXBwLCB0aGlzKTtcbiAgICB0aGlzLmZpbGVfc2VsZWN0b3Iub3BlbigpO1xuICB9XG4gIC8vIG9wZW4gZm9sZGVyIHN1Z2dlc3Rpb24gbW9kYWxcbiAgYXN5bmMgb3Blbl9mb2xkZXJfc3VnZ2VzdGlvbl9tb2RhbCgpIHtcbiAgICAvLyBvcGVuIGZvbGRlciBzdWdnZXN0aW9uIG1vZGFsXG4gICAgaWYoIXRoaXMuZm9sZGVyX3NlbGVjdG9yKXtcbiAgICAgIHRoaXMuZm9sZGVyX3NlbGVjdG9yID0gbmV3IFNtYXJ0Q29ubmVjdGlvbnNGb2xkZXJTZWxlY3RNb2RhbCh0aGlzLmFwcCwgdGhpcyk7XG4gICAgfVxuICAgIHRoaXMuZm9sZGVyX3NlbGVjdG9yLm9wZW4oKTtcbiAgfVxuICAvLyBpbnNlcnRfc2VsZWN0aW9uIGZyb20gZmlsZSBzdWdnZXN0aW9uIG1vZGFsXG4gIGluc2VydF9zZWxlY3Rpb24oaW5zZXJ0X3RleHQpIHtcbiAgICAvLyBnZXQgY2FyZXQgcG9zaXRpb25cbiAgICBsZXQgY2FyZXRfcG9zID0gdGhpcy50ZXh0YXJlYS5zZWxlY3Rpb25TdGFydDtcbiAgICAvLyBnZXQgdGV4dCBiZWZvcmUgY2FyZXRcbiAgICBsZXQgdGV4dF9iZWZvcmUgPSB0aGlzLnRleHRhcmVhLnZhbHVlLnN1YnN0cmluZygwLCBjYXJldF9wb3MpO1xuICAgIC8vIGdldCB0ZXh0IGFmdGVyIGNhcmV0XG4gICAgbGV0IHRleHRfYWZ0ZXIgPSB0aGlzLnRleHRhcmVhLnZhbHVlLnN1YnN0cmluZyhjYXJldF9wb3MsIHRoaXMudGV4dGFyZWEudmFsdWUubGVuZ3RoKTtcbiAgICAvLyBpbnNlcnQgdGV4dFxuICAgIHRoaXMudGV4dGFyZWEudmFsdWUgPSB0ZXh0X2JlZm9yZSArIGluc2VydF90ZXh0ICsgdGV4dF9hZnRlcjtcbiAgICAvLyBzZXQgY2FyZXQgcG9zaXRpb25cbiAgICB0aGlzLnRleHRhcmVhLnNlbGVjdGlvblN0YXJ0ID0gY2FyZXRfcG9zICsgaW5zZXJ0X3RleHQubGVuZ3RoO1xuICAgIHRoaXMudGV4dGFyZWEuc2VsZWN0aW9uRW5kID0gY2FyZXRfcG9zICsgaW5zZXJ0X3RleHQubGVuZ3RoO1xuICAgIC8vIGZvY3VzIG9uIHRleHRhcmVhXG4gICAgdGhpcy50ZXh0YXJlYS5mb2N1cygpO1xuICB9XG5cbiAgLy8gcmVuZGVyIGNoYXQgdGV4dGFyZWEgYW5kIGJ1dHRvblxuICByZW5kZXJfY2hhdF9pbnB1dCgpIHtcbiAgICAvLyBjcmVhdGUgY29udGFpbmVyIGZvciBjaGF0IGlucHV0XG4gICAgbGV0IGNoYXRfaW5wdXQgPSB0aGlzLmNoYXRfY29udGFpbmVyLmNyZWF0ZURpdihcInNjLWNoYXQtZm9ybVwiKTtcbiAgICAvLyBjcmVhdGUgdGV4dGFyZWFcbiAgICB0aGlzLnRleHRhcmVhID0gY2hhdF9pbnB1dC5jcmVhdGVFbChcInRleHRhcmVhXCIsIHtcbiAgICAgIGNsczogXCJzYy1jaGF0LWlucHV0XCIsXG4gICAgICBhdHRyOiB7XG4gICAgICAgIHBsYWNlaG9sZGVyOiBgVHJ5IFwiQmFzZWQgb24gbXkgbm90ZXNcIiBvciBcIlN1bW1hcml6ZSBbW3RoaXMgbm90ZV1dXCIgb3IgXCJJbXBvcnRhbnQgdGFza3MgaW4gL2ZvbGRlci9cImBcbiAgICAgIH1cbiAgICB9KTtcbiAgICAvLyB1c2UgY29udGVudGVkaXRhYmxlIGluc3RlYWQgb2YgdGV4dGFyZWFcbiAgICAvLyB0aGlzLnRleHRhcmVhID0gY2hhdF9pbnB1dC5jcmVhdGVFbChcImRpdlwiLCB7Y2xzOiBcInNjLWNoYXQtaW5wdXRcIiwgYXR0cjoge2NvbnRlbnRlZGl0YWJsZTogdHJ1ZX19KTtcbiAgICAvLyBhZGQgZXZlbnQgbGlzdGVuZXIgdG8gbGlzdGVuIGZvciBzaGlmdCtlbnRlclxuICAgIGNoYXRfaW5wdXQuYWRkRXZlbnRMaXN0ZW5lcihcImtleXVwXCIsIChlKSA9PiB7XG4gICAgICBpZihbXCJbXCIsIFwiL1wiXS5pbmRleE9mKGUua2V5KSA9PT0gLTEpIHJldHVybjsgLy8gc2tpcCBpZiBrZXkgaXMgbm90IFsgb3IgL1xuICAgICAgY29uc3QgY2FyZXRfcG9zID0gdGhpcy50ZXh0YXJlYS5zZWxlY3Rpb25TdGFydDtcbiAgICAgIC8vIGlmIGtleSBpcyBvcGVuIHNxdWFyZSBicmFja2V0XG4gICAgICBpZiAoZS5rZXkgPT09IFwiW1wiKSB7XG4gICAgICAgIC8vIGlmIHByZXZpb3VzIGNoYXIgaXMgW1xuICAgICAgICBpZih0aGlzLnRleHRhcmVhLnZhbHVlW2NhcmV0X3BvcyAtIDJdID09PSBcIltcIil7XG4gICAgICAgICAgLy8gb3BlbiBmaWxlIHN1Z2dlc3Rpb24gbW9kYWxcbiAgICAgICAgICB0aGlzLm9wZW5fZmlsZV9zdWdnZXN0aW9uX21vZGFsKCk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICB9ZWxzZXtcbiAgICAgICAgdGhpcy5icmFja2V0c19jdCA9IDA7XG4gICAgICB9XG4gICAgICAvLyBpZiAvIGlzIHByZXNzZWRcbiAgICAgIGlmIChlLmtleSA9PT0gXCIvXCIpIHtcbiAgICAgICAgLy8gZ2V0IGNhcmV0IHBvc2l0aW9uXG4gICAgICAgIC8vIGlmIHRoaXMgaXMgZmlyc3QgY2hhciBvciBwcmV2aW91cyBjaGFyIGlzIHNwYWNlXG4gICAgICAgIGlmICh0aGlzLnRleHRhcmVhLnZhbHVlLmxlbmd0aCA9PT0gMSB8fCB0aGlzLnRleHRhcmVhLnZhbHVlW2NhcmV0X3BvcyAtIDJdID09PSBcIiBcIikge1xuICAgICAgICAgIC8vIG9wZW4gZm9sZGVyIHN1Z2dlc3Rpb24gbW9kYWxcbiAgICAgICAgICB0aGlzLm9wZW5fZm9sZGVyX3N1Z2dlc3Rpb25fbW9kYWwoKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgIH0pO1xuXG4gICAgY2hhdF9pbnB1dC5hZGRFdmVudExpc3RlbmVyKFwia2V5ZG93blwiLCAoZSkgPT4ge1xuICAgICAgaWYgKGUua2V5ID09PSBcIkVudGVyXCIgJiYgZS5zaGlmdEtleSkge1xuICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgIGlmKHRoaXMucHJldmVudF9pbnB1dCl7XG4gICAgICAgICAgY29uc29sZS5sb2coXCJ3YWl0IHVudGlsIGN1cnJlbnQgcmVzcG9uc2UgaXMgZmluaXNoZWRcIik7XG4gICAgICAgICAgbmV3IE9ic2lkaWFuLk5vdGljZShcIltTbWFydCBDb25uZWN0aW9uc10gV2FpdCB1bnRpbCBjdXJyZW50IHJlc3BvbnNlIGlzIGZpbmlzaGVkXCIpO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICAvLyBnZXQgdGV4dCBmcm9tIHRleHRhcmVhXG4gICAgICAgIGxldCB1c2VyX2lucHV0ID0gdGhpcy50ZXh0YXJlYS52YWx1ZTtcbiAgICAgICAgLy8gY2xlYXIgdGV4dGFyZWFcbiAgICAgICAgdGhpcy50ZXh0YXJlYS52YWx1ZSA9IFwiXCI7XG4gICAgICAgIC8vIGluaXRpYXRlIHJlc3BvbnNlIGZyb20gYXNzaXN0YW50XG4gICAgICAgIHRoaXMuaW5pdGlhbGl6ZV9yZXNwb25zZSh1c2VyX2lucHV0KTtcbiAgICAgIH1cbiAgICAgIHRoaXMudGV4dGFyZWEuc3R5bGUuaGVpZ2h0ID0gJ2F1dG8nO1xuICAgICAgdGhpcy50ZXh0YXJlYS5zdHlsZS5oZWlnaHQgPSAodGhpcy50ZXh0YXJlYS5zY3JvbGxIZWlnaHQpICsgJ3B4JztcbiAgICB9KTtcbiAgICAvLyBidXR0b24gY29udGFpbmVyXG4gICAgbGV0IGJ1dHRvbl9jb250YWluZXIgPSBjaGF0X2lucHV0LmNyZWF0ZURpdihcInNjLWJ1dHRvbi1jb250YWluZXJcIik7XG4gICAgLy8gY3JlYXRlIGhpZGRlbiBhYm9ydCBidXR0b25cbiAgICBsZXQgYWJvcnRfYnV0dG9uID0gYnV0dG9uX2NvbnRhaW5lci5jcmVhdGVFbChcInNwYW5cIiwgeyBhdHRyOiB7aWQ6IFwic2MtYWJvcnQtYnV0dG9uXCIsIHN0eWxlOiBcImRpc3BsYXk6IG5vbmU7XCJ9IH0pO1xuICAgIE9ic2lkaWFuLnNldEljb24oYWJvcnRfYnV0dG9uLCBcInNxdWFyZVwiKTtcbiAgICAvLyBhZGQgZXZlbnQgbGlzdGVuZXIgdG8gYnV0dG9uXG4gICAgYWJvcnRfYnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiB7XG4gICAgICAvLyBhYm9ydCBjdXJyZW50IHJlc3BvbnNlXG4gICAgICB0aGlzLmVuZF9zdHJlYW0oKTtcbiAgICB9KTtcbiAgICAvLyBjcmVhdGUgYnV0dG9uXG4gICAgbGV0IGJ1dHRvbiA9IGJ1dHRvbl9jb250YWluZXIuY3JlYXRlRWwoXCJidXR0b25cIiwgeyBhdHRyOiB7aWQ6IFwic2Mtc2VuZC1idXR0b25cIn0sIGNsczogXCJzZW5kLWJ1dHRvblwiIH0pO1xuICAgIGJ1dHRvbi5pbm5lckhUTUwgPSBcIlNlbmRcIjtcbiAgICAvLyBhZGQgZXZlbnQgbGlzdGVuZXIgdG8gYnV0dG9uXG4gICAgYnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiB7XG4gICAgICBpZih0aGlzLnByZXZlbnRfaW5wdXQpe1xuICAgICAgICBjb25zb2xlLmxvZyhcIndhaXQgdW50aWwgY3VycmVudCByZXNwb25zZSBpcyBmaW5pc2hlZFwiKTtcbiAgICAgICAgbmV3IE9ic2lkaWFuLk5vdGljZShcIldhaXQgdW50aWwgY3VycmVudCByZXNwb25zZSBpcyBmaW5pc2hlZFwiKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgLy8gZ2V0IHRleHQgZnJvbSB0ZXh0YXJlYVxuICAgICAgbGV0IHVzZXJfaW5wdXQgPSB0aGlzLnRleHRhcmVhLnZhbHVlO1xuICAgICAgLy8gY2xlYXIgdGV4dGFyZWFcbiAgICAgIHRoaXMudGV4dGFyZWEudmFsdWUgPSBcIlwiO1xuICAgICAgLy8gaW5pdGlhdGUgcmVzcG9uc2UgZnJvbSBhc3Npc3RhbnRcbiAgICAgIHRoaXMuaW5pdGlhbGl6ZV9yZXNwb25zZSh1c2VyX2lucHV0KTtcbiAgICB9KTtcbiAgfVxuICBhc3luYyBpbml0aWFsaXplX3Jlc3BvbnNlKHVzZXJfaW5wdXQpIHtcbiAgICB0aGlzLnNldF9zdHJlYW1pbmdfdXgoKTtcbiAgICAvLyByZW5kZXIgbWVzc2FnZVxuICAgIGF3YWl0IHRoaXMucmVuZGVyX21lc3NhZ2UodXNlcl9pbnB1dCwgXCJ1c2VyXCIpO1xuICAgIHRoaXMuY2hhdC5uZXdfbWVzc2FnZV9pbl90aHJlYWQoe1xuICAgICAgcm9sZTogXCJ1c2VyXCIsXG4gICAgICBjb250ZW50OiB1c2VyX2lucHV0XG4gICAgfSk7XG4gICAgYXdhaXQgdGhpcy5yZW5kZXJfZG90ZG90ZG90KCk7XG5cbiAgICAvLyBpZiBjb250YWlucyBpbnRlcm5hbCBsaW5rIHJlcHJlc2VudGVkIGJ5IFtbbGlua11dXG4gICAgaWYodGhpcy5jaGF0LmNvbnRhaW5zX2ludGVybmFsX2xpbmsodXNlcl9pbnB1dCkpIHtcbiAgICAgIHRoaXMuY2hhdC5nZXRfcmVzcG9uc2Vfd2l0aF9ub3RlX2NvbnRleHQodXNlcl9pbnB1dCwgdGhpcyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIC8vIC8vIGZvciB0ZXN0aW5nIHB1cnBvc2VzXG4gICAgLy8gaWYodGhpcy5jaGF0LmNvbnRhaW5zX2ZvbGRlcl9yZWZlcmVuY2UodXNlcl9pbnB1dCkpIHtcbiAgICAvLyAgIGNvbnN0IGZvbGRlcnMgPSB0aGlzLmNoYXQuZ2V0X2ZvbGRlcl9yZWZlcmVuY2VzKHVzZXJfaW5wdXQpO1xuICAgIC8vICAgY29uc29sZS5sb2coZm9sZGVycyk7XG4gICAgLy8gICByZXR1cm47XG4gICAgLy8gfVxuICAgIC8vIGlmIGNvbnRhaW5zIHNlbGYgcmVmZXJlbnRpYWwga2V5d29yZHMgb3IgZm9sZGVyIHJlZmVyZW5jZVxuICAgIGlmKHRoaXMuY29udGFpbnNfc2VsZl9yZWZlcmVudGlhbF9rZXl3b3Jkcyh1c2VyX2lucHV0KSB8fCB0aGlzLmNoYXQuY29udGFpbnNfZm9sZGVyX3JlZmVyZW5jZSh1c2VyX2lucHV0KSkge1xuICAgICAgLy8gZ2V0IGh5ZGVcbiAgICAgIGNvbnN0IGNvbnRleHQgPSBhd2FpdCB0aGlzLmdldF9jb250ZXh0X2h5ZGUodXNlcl9pbnB1dCk7XG4gICAgICAvLyBnZXQgdXNlciBpbnB1dCB3aXRoIGFkZGVkIGNvbnRleHRcbiAgICAgIC8vIGNvbnN0IGNvbnRleHRfaW5wdXQgPSB0aGlzLmJ1aWxkX2NvbnRleHRfaW5wdXQoY29udGV4dCk7XG4gICAgICAvLyBjb25zb2xlLmxvZyhjb250ZXh0X2lucHV0KTtcbiAgICAgIGNvbnN0IGNoYXRtbCA9IFtcbiAgICAgICAge1xuICAgICAgICAgIHJvbGU6IFwic3lzdGVtXCIsXG4gICAgICAgICAgLy8gY29udGVudDogY29udGV4dF9pbnB1dFxuICAgICAgICAgIGNvbnRlbnQ6IGNvbnRleHRcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIHJvbGU6IFwidXNlclwiLFxuICAgICAgICAgIGNvbnRlbnQ6IHVzZXJfaW5wdXRcbiAgICAgICAgfVxuICAgICAgXTtcbiAgICAgIHRoaXMucmVxdWVzdF9jaGF0Z3B0X2NvbXBsZXRpb24oe21lc3NhZ2VzOiBjaGF0bWwsIHRlbXBlcmF0dXJlOiAwfSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIC8vIGNvbXBsZXRpb24gd2l0aG91dCBhbnkgc3BlY2lmaWMgY29udGV4dFxuICAgIHRoaXMucmVxdWVzdF9jaGF0Z3B0X2NvbXBsZXRpb24oKTtcbiAgfVxuICBcbiAgYXN5bmMgcmVuZGVyX2RvdGRvdGRvdCgpIHtcbiAgICBpZiAodGhpcy5kb3Rkb3Rkb3RfaW50ZXJ2YWwpXG4gICAgICBjbGVhckludGVydmFsKHRoaXMuZG90ZG90ZG90X2ludGVydmFsKTtcbiAgICBhd2FpdCB0aGlzLnJlbmRlcl9tZXNzYWdlKFwiLi4uXCIsIFwiYXNzaXN0YW50XCIpO1xuICAgIC8vIGlmIGlzICcuLi4nLCB0aGVuIGluaXRpYXRlIGludGVydmFsIHRvIGNoYW5nZSB0byAnLicgYW5kIHRoZW4gdG8gJy4uJyBhbmQgdGhlbiB0byAnLi4uJ1xuICAgIGxldCBkb3RzID0gMDtcbiAgICB0aGlzLmFjdGl2ZV9lbG0uaW5uZXJIVE1MID0gJy4uLic7XG4gICAgdGhpcy5kb3Rkb3Rkb3RfaW50ZXJ2YWwgPSBzZXRJbnRlcnZhbCgoKSA9PiB7XG4gICAgICBkb3RzKys7XG4gICAgICBpZiAoZG90cyA+IDMpXG4gICAgICAgIGRvdHMgPSAxO1xuICAgICAgdGhpcy5hY3RpdmVfZWxtLmlubmVySFRNTCA9ICcuJy5yZXBlYXQoZG90cyk7XG4gICAgfSwgNTAwKTtcbiAgICAvLyB3YWl0IDIgc2Vjb25kcyBmb3IgdGVzdGluZ1xuICAgIC8vIGF3YWl0IG5ldyBQcm9taXNlKHIgPT4gc2V0VGltZW91dChyLCAyMDAwKSk7XG4gIH1cblxuICBzZXRfc3RyZWFtaW5nX3V4KCkge1xuICAgIHRoaXMucHJldmVudF9pbnB1dCA9IHRydWU7XG4gICAgLy8gaGlkZSBzZW5kIGJ1dHRvblxuICAgIGlmKGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwic2Mtc2VuZC1idXR0b25cIikpXG4gICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcInNjLXNlbmQtYnV0dG9uXCIpLnN0eWxlLmRpc3BsYXkgPSBcIm5vbmVcIjtcbiAgICAvLyBzaG93IGFib3J0IGJ1dHRvblxuICAgIGlmKGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwic2MtYWJvcnQtYnV0dG9uXCIpKVxuICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJzYy1hYm9ydC1idXR0b25cIikuc3R5bGUuZGlzcGxheSA9IFwiYmxvY2tcIjtcbiAgfVxuICB1bnNldF9zdHJlYW1pbmdfdXgoKSB7XG4gICAgdGhpcy5wcmV2ZW50X2lucHV0ID0gZmFsc2U7XG4gICAgLy8gc2hvdyBzZW5kIGJ1dHRvbiwgcmVtb3ZlIGRpc3BsYXkgbm9uZVxuICAgIGlmKGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwic2Mtc2VuZC1idXR0b25cIikpXG4gICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcInNjLXNlbmQtYnV0dG9uXCIpLnN0eWxlLmRpc3BsYXkgPSBcIlwiO1xuICAgIC8vIGhpZGUgYWJvcnQgYnV0dG9uXG4gICAgaWYoZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJzYy1hYm9ydC1idXR0b25cIikpXG4gICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcInNjLWFib3J0LWJ1dHRvblwiKS5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCI7XG4gIH1cblxuXG4gIC8vIGNoZWNrIGlmIGluY2x1ZGVzIGtleXdvcmRzIHJlZmVycmluZyB0byBvbmUncyBvd24gbm90ZXNcbiAgY29udGFpbnNfc2VsZl9yZWZlcmVudGlhbF9rZXl3b3Jkcyh1c2VyX2lucHV0KSB7XG4gICAgY29uc3QgbWF0Y2hlcyA9IHVzZXJfaW5wdXQubWF0Y2godGhpcy5wbHVnaW4uc2VsZl9yZWZfa3dfcmVnZXgpO1xuICAgIGlmKG1hdGNoZXMpIHJldHVybiB0cnVlO1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIC8vIHJlbmRlciBtZXNzYWdlXG4gIGFzeW5jIHJlbmRlcl9tZXNzYWdlKG1lc3NhZ2UsIGZyb209XCJhc3Npc3RhbnRcIiwgYXBwZW5kX2xhc3Q9ZmFsc2UpIHtcbiAgICAvLyBpZiBkb3Rkb3Rkb3QgaW50ZXJ2YWwgaXMgc2V0LCB0aGVuIGNsZWFyIGl0XG4gICAgaWYodGhpcy5kb3Rkb3Rkb3RfaW50ZXJ2YWwpIHtcbiAgICAgIGNsZWFySW50ZXJ2YWwodGhpcy5kb3Rkb3Rkb3RfaW50ZXJ2YWwpO1xuICAgICAgdGhpcy5kb3Rkb3Rkb3RfaW50ZXJ2YWwgPSBudWxsO1xuICAgICAgLy8gY2xlYXIgbGFzdCBtZXNzYWdlXG4gICAgICB0aGlzLmFjdGl2ZV9lbG0uaW5uZXJIVE1MID0gJyc7XG4gICAgfVxuICAgIGlmKGFwcGVuZF9sYXN0KSB7XG4gICAgICB0aGlzLmN1cnJlbnRfbWVzc2FnZV9yYXcgKz0gbWVzc2FnZTtcbiAgICAgIGlmKG1lc3NhZ2UuaW5kZXhPZignXFxuJykgPT09IC0xKSB7XG4gICAgICAgIHRoaXMuYWN0aXZlX2VsbS5pbm5lckhUTUwgKz0gbWVzc2FnZTtcbiAgICAgIH1lbHNle1xuICAgICAgICB0aGlzLmFjdGl2ZV9lbG0uaW5uZXJIVE1MID0gJyc7XG4gICAgICAgIC8vIGFwcGVuZCB0byBsYXN0IG1lc3NhZ2VcbiAgICAgICAgYXdhaXQgT2JzaWRpYW4uTWFya2Rvd25SZW5kZXJlci5yZW5kZXJNYXJrZG93bih0aGlzLmN1cnJlbnRfbWVzc2FnZV9yYXcsIHRoaXMuYWN0aXZlX2VsbSwgJz9uby1kYXRhdmlldycsIG5ldyBPYnNpZGlhbi5Db21wb25lbnQoKSk7XG4gICAgICB9XG4gICAgfWVsc2V7XG4gICAgICB0aGlzLmN1cnJlbnRfbWVzc2FnZV9yYXcgPSAnJztcbiAgICAgIGlmKCh0aGlzLmNoYXQudGhyZWFkLmxlbmd0aCA9PT0gMCkgfHwgKHRoaXMubGFzdF9mcm9tICE9PSBmcm9tKSkge1xuICAgICAgICAvLyBjcmVhdGUgbWVzc2FnZVxuICAgICAgICB0aGlzLm5ld19tZXNzc2FnZV9idWJibGUoZnJvbSk7XG4gICAgICB9XG4gICAgICAvLyBzZXQgbWVzc2FnZSB0ZXh0XG4gICAgICB0aGlzLmFjdGl2ZV9lbG0uaW5uZXJIVE1MID0gJyc7XG4gICAgICBhd2FpdCBPYnNpZGlhbi5NYXJrZG93blJlbmRlcmVyLnJlbmRlck1hcmtkb3duKG1lc3NhZ2UsIHRoaXMuYWN0aXZlX2VsbSwgJz9uby1kYXRhdmlldycsIG5ldyBPYnNpZGlhbi5Db21wb25lbnQoKSk7XG4gICAgICAvLyBnZXQgbGlua3NcbiAgICAgIHRoaXMuaGFuZGxlX2xpbmtzX2luX21lc3NhZ2UoKTtcbiAgICAgIC8vIHJlbmRlciBidXR0b24ocylcbiAgICAgIHRoaXMucmVuZGVyX21lc3NhZ2VfYWN0aW9uX2J1dHRvbnMobWVzc2FnZSk7XG4gICAgfVxuICAgIC8vIHNjcm9sbCB0byBib3R0b21cbiAgICB0aGlzLm1lc3NhZ2VfY29udGFpbmVyLnNjcm9sbFRvcCA9IHRoaXMubWVzc2FnZV9jb250YWluZXIuc2Nyb2xsSGVpZ2h0O1xuICB9XG4gIHJlbmRlcl9tZXNzYWdlX2FjdGlvbl9idXR0b25zKG1lc3NhZ2UpIHtcbiAgICBpZiAodGhpcy5jaGF0LmNvbnRleHQgJiYgdGhpcy5jaGF0Lmh5ZCkge1xuICAgICAgLy8gcmVuZGVyIGJ1dHRvbiB0byBjb3B5IGh5ZCBpbiBzbWFydC1jb25uZWN0aW9ucyBjb2RlIGJsb2NrXG4gICAgICBjb25zdCBjb250ZXh0X3ZpZXcgPSB0aGlzLmFjdGl2ZV9lbG0uY3JlYXRlRWwoXCJzcGFuXCIsIHtcbiAgICAgICAgY2xzOiBcInNjLW1zZy1idXR0b25cIixcbiAgICAgICAgYXR0cjoge1xuICAgICAgICAgIHRpdGxlOiBcIkNvcHkgY29udGV4dCB0byBjbGlwYm9hcmRcIiAvKiB0b29sdGlwICovXG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgICAgY29uc3QgdGhpc19oeWQgPSB0aGlzLmNoYXQuaHlkO1xuICAgICAgT2JzaWRpYW4uc2V0SWNvbihjb250ZXh0X3ZpZXcsIFwiZXllXCIpO1xuICAgICAgY29udGV4dF92aWV3LmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiB7XG4gICAgICAgIC8vIGNvcHkgdG8gY2xpcGJvYXJkXG4gICAgICAgIG5hdmlnYXRvci5jbGlwYm9hcmQud3JpdGVUZXh0KFwiYGBgc21hcnQtY29ubmVjdGlvbnNcXG5cIiArIHRoaXNfaHlkICsgXCJcXG5gYGBcXG5cIik7XG4gICAgICAgIG5ldyBPYnNpZGlhbi5Ob3RpY2UoXCJbU21hcnQgQ29ubmVjdGlvbnNdIENvbnRleHQgY29kZSBibG9jayBjb3BpZWQgdG8gY2xpcGJvYXJkXCIpO1xuICAgICAgfSk7XG4gICAgfVxuICAgIGlmKHRoaXMuY2hhdC5jb250ZXh0KSB7XG4gICAgICAvLyByZW5kZXIgY29weSBjb250ZXh0IGJ1dHRvblxuICAgICAgY29uc3QgY29weV9wcm9tcHRfYnV0dG9uID0gdGhpcy5hY3RpdmVfZWxtLmNyZWF0ZUVsKFwic3BhblwiLCB7XG4gICAgICAgIGNsczogXCJzYy1tc2ctYnV0dG9uXCIsXG4gICAgICAgIGF0dHI6IHtcbiAgICAgICAgICB0aXRsZTogXCJDb3B5IHByb21wdCB0byBjbGlwYm9hcmRcIiAvKiB0b29sdGlwICovXG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgICAgY29uc3QgdGhpc19jb250ZXh0ID0gdGhpcy5jaGF0LmNvbnRleHQucmVwbGFjZSgvXFxgXFxgXFxgL2csIFwiXFx0YGBgXCIpLnRyaW1MZWZ0KCk7XG4gICAgICBPYnNpZGlhbi5zZXRJY29uKGNvcHlfcHJvbXB0X2J1dHRvbiwgXCJmaWxlc1wiKTtcbiAgICAgIGNvcHlfcHJvbXB0X2J1dHRvbi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4ge1xuICAgICAgICAvLyBjb3B5IHRvIGNsaXBib2FyZFxuICAgICAgICBuYXZpZ2F0b3IuY2xpcGJvYXJkLndyaXRlVGV4dChcImBgYHByb21wdC1jb250ZXh0XFxuXCIgKyB0aGlzX2NvbnRleHQgKyBcIlxcbmBgYFxcblwiKTtcbiAgICAgICAgbmV3IE9ic2lkaWFuLk5vdGljZShcIltTbWFydCBDb25uZWN0aW9uc10gQ29udGV4dCBjb3BpZWQgdG8gY2xpcGJvYXJkXCIpO1xuICAgICAgfSk7XG4gICAgfVxuICAgIC8vIHJlbmRlciBjb3B5IGJ1dHRvblxuICAgIGNvbnN0IGNvcHlfYnV0dG9uID0gdGhpcy5hY3RpdmVfZWxtLmNyZWF0ZUVsKFwic3BhblwiLCB7XG4gICAgICBjbHM6IFwic2MtbXNnLWJ1dHRvblwiLFxuICAgICAgYXR0cjoge1xuICAgICAgICB0aXRsZTogXCJDb3B5IG1lc3NhZ2UgdG8gY2xpcGJvYXJkXCIgLyogdG9vbHRpcCAqL1xuICAgICAgfVxuICAgIH0pO1xuICAgIE9ic2lkaWFuLnNldEljb24oY29weV9idXR0b24sIFwiY29weVwiKTtcbiAgICBjb3B5X2J1dHRvbi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4ge1xuICAgICAgLy8gY29weSBtZXNzYWdlIHRvIGNsaXBib2FyZFxuICAgICAgbmF2aWdhdG9yLmNsaXBib2FyZC53cml0ZVRleHQobWVzc2FnZS50cmltTGVmdCgpKTtcbiAgICAgIG5ldyBPYnNpZGlhbi5Ob3RpY2UoXCJbU21hcnQgQ29ubmVjdGlvbnNdIE1lc3NhZ2UgY29waWVkIHRvIGNsaXBib2FyZFwiKTtcbiAgICB9KTtcbiAgfVxuXG4gIGhhbmRsZV9saW5rc19pbl9tZXNzYWdlKCkge1xuICAgIGNvbnN0IGxpbmtzID0gdGhpcy5hY3RpdmVfZWxtLnF1ZXJ5U2VsZWN0b3JBbGwoXCJhXCIpO1xuICAgIC8vIGlmIHRoaXMgYWN0aXZlIGVsZW1lbnQgY29udGFpbnMgYSBsaW5rXG4gICAgaWYgKGxpbmtzLmxlbmd0aCA+IDApIHtcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGlua3MubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgY29uc3QgbGluayA9IGxpbmtzW2ldO1xuICAgICAgICBjb25zdCBsaW5rX3RleHQgPSBsaW5rLmdldEF0dHJpYnV0ZShcImRhdGEtaHJlZlwiKTtcbiAgICAgICAgLy8gdHJpZ2dlciBob3ZlciBldmVudCBvbiBsaW5rXG4gICAgICAgIGxpbmsuYWRkRXZlbnRMaXN0ZW5lcihcIm1vdXNlb3ZlclwiLCAoZXZlbnQpID0+IHtcbiAgICAgICAgICB0aGlzLmFwcC53b3Jrc3BhY2UudHJpZ2dlcihcImhvdmVyLWxpbmtcIiwge1xuICAgICAgICAgICAgZXZlbnQsXG4gICAgICAgICAgICBzb3VyY2U6IFNNQVJUX0NPTk5FQ1RJT05TX0NIQVRfVklFV19UWVBFLFxuICAgICAgICAgICAgaG92ZXJQYXJlbnQ6IGxpbmsucGFyZW50RWxlbWVudCxcbiAgICAgICAgICAgIHRhcmdldEVsOiBsaW5rLFxuICAgICAgICAgICAgLy8gZXh0cmFjdCBsaW5rIHRleHQgZnJvbSBhLmRhdGEtaHJlZlxuICAgICAgICAgICAgbGlua3RleHQ6IGxpbmtfdGV4dFxuICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICAgICAgLy8gdHJpZ2dlciBvcGVuIGxpbmsgZXZlbnQgb24gbGlua1xuICAgICAgICBsaW5rLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoZXZlbnQpID0+IHtcbiAgICAgICAgICBjb25zdCBsaW5rX3RmaWxlID0gdGhpcy5hcHAubWV0YWRhdGFDYWNoZS5nZXRGaXJzdExpbmtwYXRoRGVzdChsaW5rX3RleHQsIFwiL1wiKTtcbiAgICAgICAgICAvLyBwcm9wZXJseSBoYW5kbGUgaWYgdGhlIG1ldGEvY3RybCBrZXkgaXMgcHJlc3NlZFxuICAgICAgICAgIGNvbnN0IG1vZCA9IE9ic2lkaWFuLktleW1hcC5pc01vZEV2ZW50KGV2ZW50KTtcbiAgICAgICAgICAvLyBnZXQgbW9zdCByZWNlbnQgbGVhZlxuICAgICAgICAgIGxldCBsZWFmID0gdGhpcy5hcHAud29ya3NwYWNlLmdldExlYWYobW9kKTtcbiAgICAgICAgICBsZWFmLm9wZW5GaWxlKGxpbmtfdGZpbGUpO1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBuZXdfbWVzc3NhZ2VfYnViYmxlKGZyb20pIHtcbiAgICBsZXQgbWVzc2FnZV9lbCA9IHRoaXMubWVzc2FnZV9jb250YWluZXIuY3JlYXRlRGl2KGBzYy1tZXNzYWdlICR7ZnJvbX1gKTtcbiAgICAvLyBjcmVhdGUgbWVzc2FnZSBjb250ZW50XG4gICAgdGhpcy5hY3RpdmVfZWxtID0gbWVzc2FnZV9lbC5jcmVhdGVEaXYoXCJzYy1tZXNzYWdlLWNvbnRlbnRcIik7XG4gICAgLy8gc2V0IGxhc3QgZnJvbVxuICAgIHRoaXMubGFzdF9mcm9tID0gZnJvbTtcbiAgfVxuXG4gIGFzeW5jIHJlcXVlc3RfY2hhdGdwdF9jb21wbGV0aW9uKG9wdHM9e30pIHtcbiAgICBjb25zdCBjaGF0X21sID0gb3B0cy5tZXNzYWdlcyB8fCBvcHRzLmNoYXRfbWwgfHwgdGhpcy5jaGF0LnByZXBhcmVfY2hhdF9tbCgpO1xuICAgIGNvbnNvbGUubG9nKFwiY2hhdF9tbFwiLCBjaGF0X21sKTtcbiAgICBjb25zdCBtYXhfdG90YWxfdG9rZW5zID0gTWF0aC5yb3VuZChnZXRfbWF4X2NoYXJzKHRoaXMucGx1Z2luLnNldHRpbmdzLnNtYXJ0X2NoYXRfbW9kZWwpIC8gNCk7XG4gICAgY29uc29sZS5sb2coXCJtYXhfdG90YWxfdG9rZW5zXCIsIG1heF90b3RhbF90b2tlbnMpO1xuICAgIGNvbnN0IGN1cnJfdG9rZW5fZXN0ID0gTWF0aC5yb3VuZChKU09OLnN0cmluZ2lmeShjaGF0X21sKS5sZW5ndGggLyAzKTtcbiAgICBjb25zb2xlLmxvZyhcImN1cnJfdG9rZW5fZXN0XCIsIGN1cnJfdG9rZW5fZXN0KTtcbiAgICBsZXQgbWF4X2F2YWlsYWJsZV90b2tlbnMgPSBtYXhfdG90YWxfdG9rZW5zIC0gY3Vycl90b2tlbl9lc3Q7XG4gICAgLy8gaWYgbWF4X2F2YWlsYWJsZV90b2tlbnMgaXMgbGVzcyB0aGFuIDAsIHNldCB0byAyMDBcbiAgICBpZihtYXhfYXZhaWxhYmxlX3Rva2VucyA8IDApIG1heF9hdmFpbGFibGVfdG9rZW5zID0gMjAwO1xuICAgIGVsc2UgaWYobWF4X2F2YWlsYWJsZV90b2tlbnMgPiA0MDk2KSBtYXhfYXZhaWxhYmxlX3Rva2VucyA9IDQwOTY7XG4gICAgY29uc29sZS5sb2coXCJtYXhfYXZhaWxhYmxlX3Rva2Vuc1wiLCBtYXhfYXZhaWxhYmxlX3Rva2Vucyk7XG4gICAgb3B0cyA9IHtcbiAgICAgIG1vZGVsOiB0aGlzLnBsdWdpbi5zZXR0aW5ncy5zbWFydF9jaGF0X21vZGVsLFxuICAgICAgbWVzc2FnZXM6IGNoYXRfbWwsXG4gICAgICAvLyBtYXhfdG9rZW5zOiAyNTAsXG4gICAgICBtYXhfdG9rZW5zOiBtYXhfYXZhaWxhYmxlX3Rva2VucyxcbiAgICAgIHRlbXBlcmF0dXJlOiAwLjMsXG4gICAgICB0b3BfcDogMSxcbiAgICAgIHByZXNlbmNlX3BlbmFsdHk6IDAsXG4gICAgICBmcmVxdWVuY3lfcGVuYWx0eTogMCxcbiAgICAgIHN0cmVhbTogdHJ1ZSxcbiAgICAgIHN0b3A6IG51bGwsXG4gICAgICBuOiAxLFxuICAgICAgLy8gbG9naXRfYmlhczogbG9naXRfYmlhcyxcbiAgICAgIC4uLm9wdHNcbiAgICB9XG4gICAgLy8gY29uc29sZS5sb2cob3B0cy5tZXNzYWdlcyk7XG4gICAgaWYob3B0cy5zdHJlYW0pIHtcbiAgICAgIGNvbnN0IGZ1bGxfc3RyID0gYXdhaXQgbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgIC8vIGNvbnNvbGUubG9nKFwic3RyZWFtXCIsIG9wdHMpO1xuICAgICAgICAgIGNvbnN0IHVybCA9IFwiaHR0cHM6Ly9hcGkub3BlbmFpLmNvbS92MS9jaGF0L2NvbXBsZXRpb25zXCI7XG4gICAgICAgICAgdGhpcy5hY3RpdmVfc3RyZWFtID0gbmV3IFNjU3RyZWFtZXIodXJsLCB7XG4gICAgICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgICAgIFwiQ29udGVudC1UeXBlXCI6IFwiYXBwbGljYXRpb24vanNvblwiLFxuICAgICAgICAgICAgICBBdXRob3JpemF0aW9uOiBgQmVhcmVyICR7dGhpcy5wbHVnaW4uc2V0dGluZ3MuYXBpX2tleX1gXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgbWV0aG9kOiBcIlBPU1RcIixcbiAgICAgICAgICAgIHBheWxvYWQ6IEpTT04uc3RyaW5naWZ5KG9wdHMpXG4gICAgICAgICAgfSk7XG4gICAgICAgICAgbGV0IHR4dCA9IFwiXCI7XG4gICAgICAgICAgdGhpcy5hY3RpdmVfc3RyZWFtLmFkZEV2ZW50TGlzdGVuZXIoXCJtZXNzYWdlXCIsIChlKSA9PiB7XG4gICAgICAgICAgICBpZiAoZS5kYXRhICE9IFwiW0RPTkVdXCIpIHtcbiAgICAgICAgICAgICAgY29uc3QgcGF5bG9hZCA9IEpTT04ucGFyc2UoZS5kYXRhKTtcbiAgICAgICAgICAgICAgY29uc3QgdGV4dCA9IHBheWxvYWQuY2hvaWNlc1swXS5kZWx0YS5jb250ZW50O1xuICAgICAgICAgICAgICBpZiAoIXRleHQpIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgdHh0ICs9IHRleHQ7XG4gICAgICAgICAgICAgIHRoaXMucmVuZGVyX21lc3NhZ2UodGV4dCwgXCJhc3Npc3RhbnRcIiwgdHJ1ZSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICB0aGlzLmVuZF9zdHJlYW0oKTtcbiAgICAgICAgICAgICAgcmVzb2x2ZSh0eHQpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pO1xuICAgICAgICAgIHRoaXMuYWN0aXZlX3N0cmVhbS5hZGRFdmVudExpc3RlbmVyKFwicmVhZHlzdGF0ZWNoYW5nZVwiLCAoZSkgPT4ge1xuICAgICAgICAgICAgaWYgKGUucmVhZHlTdGF0ZSA+PSAyKSB7XG4gICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiUmVhZHlTdGF0ZTogXCIgKyBlLnJlYWR5U3RhdGUpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pO1xuICAgICAgICAgIHRoaXMuYWN0aXZlX3N0cmVhbS5hZGRFdmVudExpc3RlbmVyKFwiZXJyb3JcIiwgKGUpID0+IHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoZSk7XG4gICAgICAgICAgICBuZXcgT2JzaWRpYW4uTm90aWNlKFwiU21hcnQgQ29ubmVjdGlvbnMgRXJyb3IgU3RyZWFtaW5nIFJlc3BvbnNlLiBTZWUgY29uc29sZSBmb3IgZGV0YWlscy5cIik7XG4gICAgICAgICAgICB0aGlzLnJlbmRlcl9tZXNzYWdlKFwiKkFQSSBFcnJvci4gU2VlIGNvbnNvbGUgbG9ncyBmb3IgZGV0YWlscy4qXCIsIFwiYXNzaXN0YW50XCIpO1xuICAgICAgICAgICAgdGhpcy5lbmRfc3RyZWFtKCk7XG4gICAgICAgICAgICByZWplY3QoZSk7XG4gICAgICAgICAgfSk7XG4gICAgICAgICAgdGhpcy5hY3RpdmVfc3RyZWFtLnN0cmVhbSgpO1xuICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICBjb25zb2xlLmVycm9yKGVycik7XG4gICAgICAgICAgbmV3IE9ic2lkaWFuLk5vdGljZShcIlNtYXJ0IENvbm5lY3Rpb25zIEVycm9yIFN0cmVhbWluZyBSZXNwb25zZS4gU2VlIGNvbnNvbGUgZm9yIGRldGFpbHMuXCIpO1xuICAgICAgICAgIHRoaXMuZW5kX3N0cmVhbSgpO1xuICAgICAgICAgIHJlamVjdChlcnIpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICAgIC8vIGNvbnNvbGUubG9nKGZ1bGxfc3RyKTtcbiAgICAgIGF3YWl0IHRoaXMucmVuZGVyX21lc3NhZ2UoZnVsbF9zdHIsIFwiYXNzaXN0YW50XCIpO1xuICAgICAgdGhpcy5jaGF0Lm5ld19tZXNzYWdlX2luX3RocmVhZCh7XG4gICAgICAgIHJvbGU6IFwiYXNzaXN0YW50XCIsXG4gICAgICAgIGNvbnRlbnQ6IGZ1bGxfc3RyXG4gICAgICB9KTtcbiAgICAgIHJldHVybjtcbiAgICB9ZWxzZXtcbiAgICAgIHRyeXtcbiAgICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCAoMCwgT2JzaWRpYW4ucmVxdWVzdFVybCkoe1xuICAgICAgICAgIHVybDogYGh0dHBzOi8vYXBpLm9wZW5haS5jb20vdjEvY2hhdC9jb21wbGV0aW9uc2AsXG4gICAgICAgICAgbWV0aG9kOiBcIlBPU1RcIixcbiAgICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgICBBdXRob3JpemF0aW9uOiBgQmVhcmVyICR7dGhpcy5wbHVnaW4uc2V0dGluZ3MuYXBpX2tleX1gLFxuICAgICAgICAgICAgXCJDb250ZW50LVR5cGVcIjogXCJhcHBsaWNhdGlvbi9qc29uXCJcbiAgICAgICAgICB9LFxuICAgICAgICAgIGNvbnRlbnRUeXBlOiBcImFwcGxpY2F0aW9uL2pzb25cIixcbiAgICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeShvcHRzKSxcbiAgICAgICAgICB0aHJvdzogZmFsc2VcbiAgICAgICAgfSk7XG4gICAgICAgIC8vIGNvbnNvbGUubG9nKHJlc3BvbnNlKTtcbiAgICAgICAgcmV0dXJuIEpTT04ucGFyc2UocmVzcG9uc2UudGV4dCkuY2hvaWNlc1swXS5tZXNzYWdlLmNvbnRlbnQ7XG4gICAgICB9Y2F0Y2goZXJyKXtcbiAgICAgICAgbmV3IE9ic2lkaWFuLk5vdGljZShgU21hcnQgQ29ubmVjdGlvbnMgQVBJIEVycm9yIDo6ICR7ZXJyfWApO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGVuZF9zdHJlYW0oKSB7XG4gICAgaWYodGhpcy5hY3RpdmVfc3RyZWFtKXtcbiAgICAgIHRoaXMuYWN0aXZlX3N0cmVhbS5jbG9zZSgpO1xuICAgICAgdGhpcy5hY3RpdmVfc3RyZWFtID0gbnVsbDtcbiAgICB9XG4gICAgdGhpcy51bnNldF9zdHJlYW1pbmdfdXgoKTtcbiAgICBpZih0aGlzLmRvdGRvdGRvdF9pbnRlcnZhbCl7XG4gICAgICBjbGVhckludGVydmFsKHRoaXMuZG90ZG90ZG90X2ludGVydmFsKTtcbiAgICAgIHRoaXMuZG90ZG90ZG90X2ludGVydmFsID0gbnVsbDtcbiAgICAgIC8vIHJlbW92ZSBwYXJlbnQgb2YgYWN0aXZlX2VsbVxuICAgICAgdGhpcy5hY3RpdmVfZWxtLnBhcmVudEVsZW1lbnQucmVtb3ZlKCk7XG4gICAgICB0aGlzLmFjdGl2ZV9lbG0gPSBudWxsO1xuICAgIH1cbiAgfVxuXG4gIGFzeW5jIGdldF9jb250ZXh0X2h5ZGUodXNlcl9pbnB1dCkge1xuICAgIHRoaXMuY2hhdC5yZXNldF9jb250ZXh0KCk7XG4gICAgLy8gY291bnQgY3VycmVudCBjaGF0IG1sIG1lc3NhZ2VzIHRvIGRldGVybWluZSAncXVlc3Rpb24nIG9yICdjaGF0IGxvZycgd29yZGluZ1xuICAgIGNvbnN0IGh5ZF9pbnB1dCA9IGBBbnRpY2lwYXRlIHdoYXQgdGhlIHVzZXIgaXMgc2Vla2luZy4gUmVzcG9uZCBpbiB0aGUgZm9ybSBvZiBhIGh5cG90aGV0aWNhbCBub3RlIHdyaXR0ZW4gYnkgdGhlIHVzZXIuIFRoZSBub3RlIG1heSBjb250YWluIHN0YXRlbWVudHMgYXMgcGFyYWdyYXBocywgbGlzdHMsIG9yIGNoZWNrbGlzdHMgaW4gbWFya2Rvd24gZm9ybWF0IHdpdGggbm8gaGVhZGluZ3MuIFBsZWFzZSByZXNwb25kIHdpdGggb25lIGh5cG90aGV0aWNhbCBub3RlIGFuZCBhYnN0YWluIGZyb20gYW55IG90aGVyIGNvbW1lbnRhcnkuIFVzZSB0aGUgZm9ybWF0OiBQQVJFTlQgRk9MREVSIE5BTUUgPiBDSElMRCBGT0xERVIgTkFNRSA+IEZJTEUgTkFNRSA+IEhFQURJTkcgMSA+IEhFQURJTkcgMiA+IEhFQURJTkcgMzogSFlQT1RIRVRJQ0FMIE5PVEUgQ09OVEVOVFMuYDtcbiAgICAvLyBjb21wbGV0ZVxuICAgIGNvbnN0IGNoYXRtbCA9IFtcbiAgICAgIHtcbiAgICAgICAgcm9sZTogXCJzeXN0ZW1cIixcbiAgICAgICAgY29udGVudDogaHlkX2lucHV0IFxuICAgICAgfSxcbiAgICAgIHtcbiAgICAgICAgcm9sZTogXCJ1c2VyXCIsXG4gICAgICAgIGNvbnRlbnQ6IHVzZXJfaW5wdXRcbiAgICAgIH1cbiAgICBdO1xuICAgIGNvbnN0IGh5ZCA9IGF3YWl0IHRoaXMucmVxdWVzdF9jaGF0Z3B0X2NvbXBsZXRpb24oe1xuICAgICAgbWVzc2FnZXM6IGNoYXRtbCxcbiAgICAgIHN0cmVhbTogZmFsc2UsXG4gICAgICB0ZW1wZXJhdHVyZTogMCxcbiAgICAgIG1heF90b2tlbnM6IDEzNyxcbiAgICB9KTtcbiAgICB0aGlzLmNoYXQuaHlkID0gaHlkO1xuICAgIC8vIGNvbnNvbGUubG9nKGh5ZCk7XG4gICAgbGV0IGZpbHRlciA9IHt9O1xuICAgIC8vIGlmIGNvbnRhaW5zIGZvbGRlciByZWZlcmVuY2UgcmVwcmVzZW50ZWQgYnkgL2ZvbGRlci9cbiAgICBpZih0aGlzLmNoYXQuY29udGFpbnNfZm9sZGVyX3JlZmVyZW5jZSh1c2VyX2lucHV0KSkge1xuICAgICAgLy8gZ2V0IGZvbGRlciByZWZlcmVuY2VzXG4gICAgICBjb25zdCBmb2xkZXJfcmVmcyA9IHRoaXMuY2hhdC5nZXRfZm9sZGVyX3JlZmVyZW5jZXModXNlcl9pbnB1dCk7XG4gICAgICAvLyBjb25zb2xlLmxvZyhmb2xkZXJfcmVmcyk7XG4gICAgICAvLyBpZiBmb2xkZXIgcmVmZXJlbmNlcyBhcmUgdmFsaWQgKHN0cmluZyBvciBhcnJheSBvZiBzdHJpbmdzKVxuICAgICAgaWYoZm9sZGVyX3JlZnMpe1xuICAgICAgICBmaWx0ZXIgPSB7XG4gICAgICAgICAgcGF0aF9iZWdpbnNfd2l0aDogZm9sZGVyX3JlZnNcbiAgICAgICAgfTtcbiAgICAgIH1cbiAgICB9XG4gICAgLy8gc2VhcmNoIGZvciBuZWFyZXN0IGJhc2VkIG9uIGh5ZFxuICAgIGxldCBuZWFyZXN0ID0gYXdhaXQgdGhpcy5wbHVnaW4uYXBpLnNlYXJjaChoeWQsIGZpbHRlcik7XG4gICAgY29uc29sZS5sb2coXCJuZWFyZXN0XCIsIG5lYXJlc3QubGVuZ3RoKTtcbiAgICBuZWFyZXN0ID0gdGhpcy5nZXRfbmVhcmVzdF91bnRpbF9uZXh0X2Rldl9leGNlZWRzX3N0ZF9kZXYobmVhcmVzdCk7XG4gICAgY29uc29sZS5sb2coXCJuZWFyZXN0IGFmdGVyIHN0ZCBkZXYgc2xpY2VcIiwgbmVhcmVzdC5sZW5ndGgpO1xuICAgIG5lYXJlc3QgPSB0aGlzLnNvcnRfYnlfbGVuX2FkanVzdGVkX3NpbWlsYXJpdHkobmVhcmVzdCk7XG4gICAgXG4gICAgcmV0dXJuIGF3YWl0IHRoaXMuZ2V0X2NvbnRleHRfZm9yX3Byb21wdChuZWFyZXN0KTtcbiAgfVxuICBcbiAgXG4gIHNvcnRfYnlfbGVuX2FkanVzdGVkX3NpbWlsYXJpdHkobmVhcmVzdCkge1xuICAgIC8vIHJlLXNvcnQgYnkgcXVvdGllbnQgb2Ygc2ltaWxhcml0eSBkaXZpZGVkIGJ5IGxlbiBERVNDXG4gICAgbmVhcmVzdCA9IG5lYXJlc3Quc29ydCgoYSwgYikgPT4ge1xuICAgICAgY29uc3QgYV9zY29yZSA9IGEuc2ltaWxhcml0eSAvIGEubGVuO1xuICAgICAgY29uc3QgYl9zY29yZSA9IGIuc2ltaWxhcml0eSAvIGIubGVuO1xuICAgICAgLy8gaWYgYSBpcyBncmVhdGVyIHRoYW4gYiwgcmV0dXJuIC0xXG4gICAgICBpZiAoYV9zY29yZSA+IGJfc2NvcmUpXG4gICAgICAgIHJldHVybiAtMTtcbiAgICAgIC8vIGlmIGEgaXMgbGVzcyB0aGFuIGIsIHJldHVybiAxXG4gICAgICBpZiAoYV9zY29yZSA8IGJfc2NvcmUpXG4gICAgICAgIHJldHVybiAxO1xuICAgICAgLy8gaWYgYSBpcyBlcXVhbCB0byBiLCByZXR1cm4gMFxuICAgICAgcmV0dXJuIDA7XG4gICAgfSk7XG4gICAgcmV0dXJuIG5lYXJlc3Q7XG4gIH1cblxuICBnZXRfbmVhcmVzdF91bnRpbF9uZXh0X2Rldl9leGNlZWRzX3N0ZF9kZXYobmVhcmVzdCkge1xuICAgIC8vIGdldCBzdGQgZGV2IG9mIHNpbWlsYXJpdHlcbiAgICBjb25zdCBzaW0gPSBuZWFyZXN0Lm1hcCgobikgPT4gbi5zaW1pbGFyaXR5KTtcbiAgICBjb25zdCBtZWFuID0gc2ltLnJlZHVjZSgoYSwgYikgPT4gYSArIGIpIC8gc2ltLmxlbmd0aDtcbiAgICBsZXQgc3RkX2RldiA9IE1hdGguc3FydChzaW0ubWFwKCh4KSA9PiBNYXRoLnBvdyh4IC0gbWVhbiwgMikpLnJlZHVjZSgoYSwgYikgPT4gYSArIGIpIC8gc2ltLmxlbmd0aCk7XG4gICAgLy8gc2xpY2Ugd2hlcmUgbmV4dCBpdGVtIGRldmlhdGlvbiBpcyBncmVhdGVyIHRoYW4gc3RkX2RldlxuICAgIGxldCBzbGljZV9pID0gMDtcbiAgICB3aGlsZSAoc2xpY2VfaSA8IG5lYXJlc3QubGVuZ3RoKSB7XG4gICAgICBjb25zdCBuZXh0ID0gbmVhcmVzdFtzbGljZV9pICsgMV07XG4gICAgICBpZiAobmV4dCkge1xuICAgICAgICBjb25zdCBuZXh0X2RldiA9IE1hdGguYWJzKG5leHQuc2ltaWxhcml0eSAtIG5lYXJlc3Rbc2xpY2VfaV0uc2ltaWxhcml0eSk7XG4gICAgICAgIGlmIChuZXh0X2RldiA+IHN0ZF9kZXYpIHtcbiAgICAgICAgICBpZihzbGljZV9pIDwgMykgc3RkX2RldiA9IHN0ZF9kZXYgKiAxLjU7XG4gICAgICAgICAgZWxzZSBicmVhaztcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgc2xpY2VfaSsrO1xuICAgIH1cbiAgICAvLyBzZWxlY3QgdG9wIHJlc3VsdHNcbiAgICBuZWFyZXN0ID0gbmVhcmVzdC5zbGljZSgwLCBzbGljZV9pKzEpO1xuICAgIHJldHVybiBuZWFyZXN0O1xuICB9XG4gIC8vIHRoaXMudGVzdF9nZXRfbmVhcmVzdF91bnRpbF9uZXh0X2Rldl9leGNlZWRzX3N0ZF9kZXYoKTtcbiAgLy8gLy8gdGVzdCBnZXRfbmVhcmVzdF91bnRpbF9uZXh0X2Rldl9leGNlZWRzX3N0ZF9kZXZcbiAgLy8gdGVzdF9nZXRfbmVhcmVzdF91bnRpbF9uZXh0X2Rldl9leGNlZWRzX3N0ZF9kZXYoKSB7XG4gIC8vICAgY29uc3QgbmVhcmVzdCA9IFt7c2ltaWxhcml0eTogMC45OX0sIHtzaW1pbGFyaXR5OiAwLjk4fSwge3NpbWlsYXJpdHk6IDAuOTd9LCB7c2ltaWxhcml0eTogMC45Nn0sIHtzaW1pbGFyaXR5OiAwLjk1fSwge3NpbWlsYXJpdHk6IDAuOTR9LCB7c2ltaWxhcml0eTogMC45M30sIHtzaW1pbGFyaXR5OiAwLjkyfSwge3NpbWlsYXJpdHk6IDAuOTF9LCB7c2ltaWxhcml0eTogMC45fSwge3NpbWlsYXJpdHk6IDAuNzl9LCB7c2ltaWxhcml0eTogMC43OH0sIHtzaW1pbGFyaXR5OiAwLjc3fSwge3NpbWlsYXJpdHk6IDAuNzZ9LCB7c2ltaWxhcml0eTogMC43NX0sIHtzaW1pbGFyaXR5OiAwLjc0fSwge3NpbWlsYXJpdHk6IDAuNzN9LCB7c2ltaWxhcml0eTogMC43Mn1dO1xuICAvLyAgIGNvbnN0IHJlc3VsdCA9IHRoaXMuZ2V0X25lYXJlc3RfdW50aWxfbmV4dF9kZXZfZXhjZWVkc19zdGRfZGV2KG5lYXJlc3QpO1xuICAvLyAgIGlmKHJlc3VsdC5sZW5ndGggIT09IDEwKXtcbiAgLy8gICAgIGNvbnNvbGUuZXJyb3IoXCJnZXRfbmVhcmVzdF91bnRpbF9uZXh0X2Rldl9leGNlZWRzX3N0ZF9kZXYgZmFpbGVkXCIsIHJlc3VsdCk7XG4gIC8vICAgfVxuICAvLyB9XG5cbiAgYXN5bmMgZ2V0X2NvbnRleHRfZm9yX3Byb21wdChuZWFyZXN0KSB7XG4gICAgbGV0IGNvbnRleHQgPSBbXTtcbiAgICBjb25zdCBNQVhfU09VUkNFUyA9ICh0aGlzLnBsdWdpbi5zZXR0aW5ncy5zbWFydF9jaGF0X21vZGVsID09PSAnZ3B0LTQtMTEwNi1wcmV2aWV3JykgPyA0MiA6IDIwO1xuICAgIGNvbnN0IE1BWF9DSEFSUyA9IGdldF9tYXhfY2hhcnModGhpcy5wbHVnaW4uc2V0dGluZ3Muc21hcnRfY2hhdF9tb2RlbCkgLyAyO1xuICAgIGxldCBjaGFyX2FjY3VtID0gMDtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IG5lYXJlc3QubGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmIChjb250ZXh0Lmxlbmd0aCA+PSBNQVhfU09VUkNFUylcbiAgICAgICAgYnJlYWs7XG4gICAgICBpZiAoY2hhcl9hY2N1bSA+PSBNQVhfQ0hBUlMpXG4gICAgICAgIGJyZWFrO1xuICAgICAgaWYgKHR5cGVvZiBuZWFyZXN0W2ldLmxpbmsgIT09ICdzdHJpbmcnKVxuICAgICAgICBjb250aW51ZTtcbiAgICAgIC8vIGdlbmVyYXRlIGJyZWFkY3J1bWJzXG4gICAgICBjb25zdCBicmVhZGNydW1icyA9IG5lYXJlc3RbaV0ubGluay5yZXBsYWNlKC8jL2csIFwiID4gXCIpLnJlcGxhY2UoXCIubWRcIiwgXCJcIikucmVwbGFjZSgvXFwvL2csIFwiID4gXCIpO1xuICAgICAgbGV0IG5ld19jb250ZXh0ID0gYCR7YnJlYWRjcnVtYnN9OlxcbmA7XG4gICAgICAvLyBnZXQgbWF4IGF2YWlsYWJsZSBjaGFycyB0byBhZGQgdG8gY29udGV4dFxuICAgICAgY29uc3QgbWF4X2F2YWlsYWJsZV9jaGFycyA9IE1BWF9DSEFSUyAtIGNoYXJfYWNjdW0gLSBuZXdfY29udGV4dC5sZW5ndGg7XG4gICAgICBpZiAobmVhcmVzdFtpXS5saW5rLmluZGV4T2YoXCIjXCIpICE9PSAtMSkgeyAvLyBpcyBibG9ja1xuICAgICAgICBuZXdfY29udGV4dCArPSBhd2FpdCB0aGlzLnBsdWdpbi5ibG9ja19yZXRyaWV2ZXIobmVhcmVzdFtpXS5saW5rLCB7IG1heF9jaGFyczogbWF4X2F2YWlsYWJsZV9jaGFycyB9KTtcbiAgICAgIH0gZWxzZSB7IC8vIGlzIGZpbGVcbiAgICAgICAgbmV3X2NvbnRleHQgKz0gYXdhaXQgdGhpcy5wbHVnaW4uZmlsZV9yZXRyaWV2ZXIobmVhcmVzdFtpXS5saW5rLCB7IG1heF9jaGFyczogbWF4X2F2YWlsYWJsZV9jaGFycyB9KTtcbiAgICAgIH1cbiAgICAgIC8vIGFkZCB0byBjaGFyX2FjY3VtXG4gICAgICBjaGFyX2FjY3VtICs9IG5ld19jb250ZXh0Lmxlbmd0aDtcbiAgICAgIC8vIGFkZCB0byBjb250ZXh0XG4gICAgICBjb250ZXh0LnB1c2goe1xuICAgICAgICBsaW5rOiBuZWFyZXN0W2ldLmxpbmssXG4gICAgICAgIHRleHQ6IG5ld19jb250ZXh0XG4gICAgICB9KTtcbiAgICB9XG4gICAgLy8gY29udGV4dCBzb3VyY2VzXG4gICAgY29uc29sZS5sb2coXCJjb250ZXh0IHNvdXJjZXM6IFwiICsgY29udGV4dC5sZW5ndGgpO1xuICAgIC8vIGNoYXJfYWNjdW0gZGl2aWRlZCBieSA0IGFuZCByb3VuZGVkIHRvIG5lYXJlc3QgaW50ZWdlciBmb3IgZXN0aW1hdGVkIHRva2Vuc1xuICAgIGNvbnNvbGUubG9nKFwidG90YWwgY29udGV4dCB0b2tlbnM6IH5cIiArIE1hdGgucm91bmQoY2hhcl9hY2N1bSAvIDMuNSkpO1xuICAgIC8vIGJ1aWxkIGNvbnRleHQgaW5wdXRcbiAgICB0aGlzLmNoYXQuY29udGV4dCA9IGBBbnRpY2lwYXRlIHRoZSB0eXBlIG9mIGFuc3dlciBkZXNpcmVkIGJ5IHRoZSB1c2VyLiBJbWFnaW5lIHRoZSBmb2xsb3dpbmcgJHtjb250ZXh0Lmxlbmd0aH0gbm90ZXMgd2VyZSB3cml0dGVuIGJ5IHRoZSB1c2VyIGFuZCBjb250YWluIGFsbCB0aGUgbmVjZXNzYXJ5IGluZm9ybWF0aW9uIHRvIGFuc3dlciB0aGUgdXNlcidzIHF1ZXN0aW9uLiBCZWdpbiByZXNwb25zZXMgd2l0aCBcIiR7U01BUlRfVFJBTlNMQVRJT05bdGhpcy5wbHVnaW4uc2V0dGluZ3MubGFuZ3VhZ2VdLnByb21wdH0uLi5cImA7XG4gICAgZm9yKGxldCBpID0gMDsgaSA8IGNvbnRleHQubGVuZ3RoOyBpKyspIHtcbiAgICAgIHRoaXMuY2hhdC5jb250ZXh0ICs9IGBcXG4tLS1CRUdJTiAjJHtpKzF9LS0tXFxuJHtjb250ZXh0W2ldLnRleHR9XFxuLS0tRU5EICMke2krMX0tLS1gO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5jaGF0LmNvbnRleHQ7XG4gIH1cblxuXG59XG5cbmZ1bmN0aW9uIGdldF9tYXhfY2hhcnMobW9kZWw9XCJncHQtMy41LXR1cmJvXCIpIHtcbiAgY29uc3QgTUFYX0NIQVJfTUFQID0ge1xuICAgIFwiZ3B0LTMuNS10dXJiby0xNmtcIjogNDgwMDAsXG4gICAgXCJncHQtNFwiOiAyNDAwMCxcbiAgICBcImdwdC0zLjUtdHVyYm9cIjogMTIwMDAsXG4gICAgXCJncHQtNC0xMTA2LXByZXZpZXdcIjogMjAwMDAwLFxuICB9O1xuICByZXR1cm4gTUFYX0NIQVJfTUFQW21vZGVsXTtcbn1cbi8qKlxuICogU21hcnRDb25uZWN0aW9uc0NoYXRNb2RlbFxuICogLS0tXG4gKiAtICd0aHJlYWQnIGZvcm1hdDogQXJyYXlbQXJyYXlbT2JqZWN0e3JvbGUsIGNvbnRlbnQsIGh5ZGV9XV1cbiAqICAtIFtUdXJuW3ZhcmlhdGlvbnt9XSwgVHVyblt2YXJpYXRpb257fSwgdmFyaWF0aW9ue31dLCAuLi5dXG4gKiAtIFNhdmVzIGluICd0aHJlYWQnIGZvcm1hdCB0byBKU09OIGZpbGUgaW4gLnNtYXJ0LWNvbm5lY3Rpb25zIGZvbGRlciB1c2luZyBjaGF0X2lkIGFzIGZpbGVuYW1lXG4gKiAtIExvYWRzIGNoYXQgaW4gJ3RocmVhZCcgZm9ybWF0IEFycmF5W0FycmF5W09iamVjdHtyb2xlLCBjb250ZW50LCBoeWRlfV1dIGZyb20gSlNPTiBmaWxlIGluIC5zbWFydC1jb25uZWN0aW9ucyBmb2xkZXJcbiAqIC0gcHJlcGFyZXMgY2hhdF9tbCByZXR1cm5zIGluICdDaGF0TUwnIGZvcm1hdCBcbiAqICAtIHN0cmlwcyBhbGwgYnV0IHJvbGUgYW5kIGNvbnRlbnQgcHJvcGVydGllcyBmcm9tIE9iamVjdCBpbiBDaGF0TUwgZm9ybWF0XG4gKiAtIENoYXRNTCBBcnJheVtPYmplY3R7cm9sZSwgY29udGVudH1dXG4gKiAgLSBbQ3VycmVudF9WYXJpYXRpb25fRm9yX1R1cm5fMXt9LCBDdXJyZW50X1ZhcmlhdGlvbl9Gb3JfVHVybl8ye30sIC4uLl1cbiAqL1xuY2xhc3MgU21hcnRDb25uZWN0aW9uc0NoYXRNb2RlbCB7XG4gIGNvbnN0cnVjdG9yKHBsdWdpbikge1xuICAgIHRoaXMuYXBwID0gcGx1Z2luLmFwcDtcbiAgICB0aGlzLnBsdWdpbiA9IHBsdWdpbjtcbiAgICB0aGlzLmNoYXRfaWQgPSBudWxsO1xuICAgIHRoaXMuY2hhdF9tbCA9IFtdO1xuICAgIHRoaXMuY29udGV4dCA9IG51bGw7XG4gICAgdGhpcy5oeWQgPSBudWxsO1xuICAgIHRoaXMudGhyZWFkID0gW107XG4gIH1cbiAgYXN5bmMgc2F2ZV9jaGF0KCkge1xuICAgIC8vIHJldHVybiBpZiB0aHJlYWQgaXMgZW1wdHlcbiAgICBpZiAodGhpcy50aHJlYWQubGVuZ3RoID09PSAwKSByZXR1cm47XG4gICAgLy8gc2F2ZSBjaGF0IHRvIGZpbGUgaW4gLnNtYXJ0LWNvbm5lY3Rpb25zIGZvbGRlclxuICAgIC8vIGNyZWF0ZSAuc21hcnQtY29ubmVjdGlvbnMvY2hhdHMvIGZvbGRlciBpZiBpdCBkb2Vzbid0IGV4aXN0XG4gICAgaWYgKCEoYXdhaXQgdGhpcy5hcHAudmF1bHQuYWRhcHRlci5leGlzdHMoXCIuc21hcnQtY29ubmVjdGlvbnMvY2hhdHNcIikpKSB7XG4gICAgICBhd2FpdCB0aGlzLmFwcC52YXVsdC5hZGFwdGVyLm1rZGlyKFwiLnNtYXJ0LWNvbm5lY3Rpb25zL2NoYXRzXCIpO1xuICAgIH1cbiAgICAvLyBpZiBjaGF0X2lkIGlzIG5vdCBzZXQsIHNldCBpdCB0byBVTlRJVExFRC0ke3VuaXggdGltZXN0YW1wfVxuICAgIGlmICghdGhpcy5jaGF0X2lkKSB7XG4gICAgICB0aGlzLmNoYXRfaWQgPSB0aGlzLm5hbWUoKSArIFwiXHUyMDE0XCIgKyB0aGlzLmdldF9maWxlX2RhdGVfc3RyaW5nKCk7XG4gICAgfVxuICAgIC8vIHZhbGlkYXRlIGNoYXRfaWQgaXMgc2V0IHRvIHZhbGlkIGZpbGVuYW1lIGNoYXJhY3RlcnMgKGxldHRlcnMsIG51bWJlcnMsIHVuZGVyc2NvcmVzLCBkYXNoZXMsIGVtIGRhc2gsIGFuZCBzcGFjZXMpXG4gICAgaWYgKCF0aGlzLmNoYXRfaWQubWF0Y2goL15bYS16QS1aMC05X1x1MjAxNFxcLSBdKyQvKSkge1xuICAgICAgY29uc29sZS5sb2coXCJJbnZhbGlkIGNoYXRfaWQ6IFwiICsgdGhpcy5jaGF0X2lkKTtcbiAgICAgIG5ldyBPYnNpZGlhbi5Ob3RpY2UoXCJbU21hcnQgQ29ubmVjdGlvbnNdIEZhaWxlZCB0byBzYXZlIGNoYXQuIEludmFsaWQgY2hhdF9pZDogJ1wiICsgdGhpcy5jaGF0X2lkICsgXCInXCIpO1xuICAgIH1cbiAgICAvLyBmaWxlbmFtZSBpcyBjaGF0X2lkXG4gICAgY29uc3QgY2hhdF9maWxlID0gdGhpcy5jaGF0X2lkICsgXCIuanNvblwiO1xuICAgIHRoaXMuYXBwLnZhdWx0LmFkYXB0ZXIud3JpdGUoXG4gICAgICBcIi5zbWFydC1jb25uZWN0aW9ucy9jaGF0cy9cIiArIGNoYXRfZmlsZSxcbiAgICAgIEpTT04uc3RyaW5naWZ5KHRoaXMudGhyZWFkLCBudWxsLCAyKVxuICAgICk7XG4gIH1cbiAgYXN5bmMgbG9hZF9jaGF0KGNoYXRfaWQpIHtcbiAgICB0aGlzLmNoYXRfaWQgPSBjaGF0X2lkO1xuICAgIC8vIGxvYWQgY2hhdCBmcm9tIGZpbGUgaW4gLnNtYXJ0LWNvbm5lY3Rpb25zIGZvbGRlclxuICAgIC8vIGZpbGVuYW1lIGlzIGNoYXRfaWRcbiAgICBjb25zdCBjaGF0X2ZpbGUgPSB0aGlzLmNoYXRfaWQgKyBcIi5qc29uXCI7XG4gICAgLy8gcmVhZCBmaWxlXG4gICAgbGV0IGNoYXRfanNvbiA9IGF3YWl0IHRoaXMuYXBwLnZhdWx0LmFkYXB0ZXIucmVhZChcbiAgICAgIFwiLnNtYXJ0LWNvbm5lY3Rpb25zL2NoYXRzL1wiICsgY2hhdF9maWxlXG4gICAgKTtcbiAgICAvLyBwYXJzZSBqc29uXG4gICAgdGhpcy50aHJlYWQgPSBKU09OLnBhcnNlKGNoYXRfanNvbik7XG4gICAgLy8gbG9hZCBjaGF0X21sXG4gICAgdGhpcy5jaGF0X21sID0gdGhpcy5wcmVwYXJlX2NoYXRfbWwoKTtcbiAgICAvLyByZW5kZXIgbWVzc2FnZXMgaW4gY2hhdCB2aWV3XG4gICAgLy8gZm9yIGVhY2ggdHVybiBpbiBjaGF0X21sXG4gICAgLy8gY29uc29sZS5sb2codGhpcy50aHJlYWQpO1xuICAgIC8vIGNvbnNvbGUubG9nKHRoaXMuY2hhdF9tbCk7XG4gIH1cbiAgLy8gcHJlcGFyZSBjaGF0X21sIGZyb20gY2hhdFxuICAvLyBnZXRzIHRoZSBsYXN0IG1lc3NhZ2Ugb2YgZWFjaCB0dXJuIHVubGVzcyB0dXJuX3ZhcmlhdGlvbl9vZmZzZXRzPVtbdHVybl9pbmRleCx2YXJpYXRpb25faW5kZXhdXSBpcyBzcGVjaWZpZWQgaW4gb2Zmc2V0XG4gIHByZXBhcmVfY2hhdF9tbCh0dXJuX3ZhcmlhdGlvbl9vZmZzZXRzPVtdKSB7XG4gICAgLy8gaWYgbm8gdHVybl92YXJpYXRpb25fb2Zmc2V0cywgZ2V0IHRoZSBsYXN0IG1lc3NhZ2Ugb2YgZWFjaCB0dXJuXG4gICAgaWYodHVybl92YXJpYXRpb25fb2Zmc2V0cy5sZW5ndGggPT09IDApe1xuICAgICAgdGhpcy5jaGF0X21sID0gdGhpcy50aHJlYWQubWFwKHR1cm4gPT4ge1xuICAgICAgICByZXR1cm4gdHVyblt0dXJuLmxlbmd0aCAtIDFdO1xuICAgICAgfSk7XG4gICAgfWVsc2V7XG4gICAgICAvLyBjcmVhdGUgYW4gYXJyYXkgZnJvbSB0dXJuX3ZhcmlhdGlvbl9vZmZzZXRzIHRoYXQgaW5kZXhlcyB2YXJpYXRpb25faW5kZXggYXQgdHVybl9pbmRleFxuICAgICAgLy8gZXguIFtbMyw1XV0gPT4gW3VuZGVmaW5lZCwgdW5kZWZpbmVkLCB1bmRlZmluZWQsIDVdXG4gICAgICBsZXQgdHVybl92YXJpYXRpb25faW5kZXggPSBbXTtcbiAgICAgIGZvcihsZXQgaSA9IDA7IGkgPCB0dXJuX3ZhcmlhdGlvbl9vZmZzZXRzLmxlbmd0aDsgaSsrKXtcbiAgICAgICAgdHVybl92YXJpYXRpb25faW5kZXhbdHVybl92YXJpYXRpb25fb2Zmc2V0c1tpXVswXV0gPSB0dXJuX3ZhcmlhdGlvbl9vZmZzZXRzW2ldWzFdO1xuICAgICAgfVxuICAgICAgLy8gbG9vcCB0aHJvdWdoIGNoYXRcbiAgICAgIHRoaXMuY2hhdF9tbCA9IHRoaXMudGhyZWFkLm1hcCgodHVybiwgdHVybl9pbmRleCkgPT4ge1xuICAgICAgICAvLyBpZiB0aGVyZSBpcyBhbiBpbmRleCBmb3IgdGhpcyB0dXJuLCByZXR1cm4gdGhlIHZhcmlhdGlvbiBhdCB0aGF0IGluZGV4XG4gICAgICAgIGlmKHR1cm5fdmFyaWF0aW9uX2luZGV4W3R1cm5faW5kZXhdICE9PSB1bmRlZmluZWQpe1xuICAgICAgICAgIHJldHVybiB0dXJuW3R1cm5fdmFyaWF0aW9uX2luZGV4W3R1cm5faW5kZXhdXTtcbiAgICAgICAgfVxuICAgICAgICAvLyBvdGhlcndpc2UgcmV0dXJuIHRoZSBsYXN0IG1lc3NhZ2Ugb2YgdGhlIHR1cm5cbiAgICAgICAgcmV0dXJuIHR1cm5bdHVybi5sZW5ndGggLSAxXTtcbiAgICAgIH0pO1xuICAgIH1cbiAgICAvLyBzdHJpcCBhbGwgYnV0IHJvbGUgYW5kIGNvbnRlbnQgcHJvcGVydGllcyBmcm9tIGVhY2ggbWVzc2FnZVxuICAgIHRoaXMuY2hhdF9tbCA9IHRoaXMuY2hhdF9tbC5tYXAobWVzc2FnZSA9PiB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICByb2xlOiBtZXNzYWdlLnJvbGUsXG4gICAgICAgIGNvbnRlbnQ6IG1lc3NhZ2UuY29udGVudFxuICAgICAgfTtcbiAgICB9KTtcbiAgICByZXR1cm4gdGhpcy5jaGF0X21sO1xuICB9XG4gIGxhc3QoKSB7XG4gICAgLy8gZ2V0IGxhc3QgbWVzc2FnZSBmcm9tIGNoYXRcbiAgICByZXR1cm4gdGhpcy50aHJlYWRbdGhpcy50aHJlYWQubGVuZ3RoIC0gMV1bdGhpcy50aHJlYWRbdGhpcy50aHJlYWQubGVuZ3RoIC0gMV0ubGVuZ3RoIC0gMV07XG4gIH1cbiAgbGFzdF9mcm9tKCkge1xuICAgIHJldHVybiB0aGlzLmxhc3QoKS5yb2xlO1xuICB9XG4gIC8vIHJldHVybnMgdXNlcl9pbnB1dCBvciBjb21wbGV0aW9uXG4gIGxhc3RfbWVzc2FnZSgpIHtcbiAgICByZXR1cm4gdGhpcy5sYXN0KCkuY29udGVudDtcbiAgfVxuICAvLyBtZXNzYWdlPXt9XG4gIC8vIGFkZCBuZXcgbWVzc2FnZSB0byB0aHJlYWRcbiAgbmV3X21lc3NhZ2VfaW5fdGhyZWFkKG1lc3NhZ2UsIHR1cm49LTEpIHtcbiAgICAvLyBpZiB0dXJuIGlzIC0xLCBhZGQgdG8gbmV3IHR1cm5cbiAgICBpZih0aGlzLmNvbnRleHQpe1xuICAgICAgbWVzc2FnZS5jb250ZXh0ID0gdGhpcy5jb250ZXh0O1xuICAgICAgdGhpcy5jb250ZXh0ID0gbnVsbDtcbiAgICB9XG4gICAgaWYodGhpcy5oeWQpe1xuICAgICAgbWVzc2FnZS5oeWQgPSB0aGlzLmh5ZDtcbiAgICAgIHRoaXMuaHlkID0gbnVsbDtcbiAgICB9XG4gICAgaWYgKHR1cm4gPT09IC0xKSB7XG4gICAgICB0aGlzLnRocmVhZC5wdXNoKFttZXNzYWdlXSk7XG4gICAgfWVsc2V7XG4gICAgICAvLyBvdGhlcndpc2UgYWRkIHRvIHNwZWNpZmllZCB0dXJuXG4gICAgICB0aGlzLnRocmVhZFt0dXJuXS5wdXNoKG1lc3NhZ2UpO1xuICAgIH1cbiAgfVxuICByZXNldF9jb250ZXh0KCl7XG4gICAgdGhpcy5jb250ZXh0ID0gbnVsbDtcbiAgICB0aGlzLmh5ZCA9IG51bGw7XG4gIH1cbiAgYXN5bmMgcmVuYW1lX2NoYXQobmV3X25hbWUpe1xuICAgIC8vIGNoZWNrIGlmIGN1cnJlbnQgY2hhdF9pZCBmaWxlIGV4aXN0c1xuICAgIGlmICh0aGlzLmNoYXRfaWQgJiYgYXdhaXQgdGhpcy5hcHAudmF1bHQuYWRhcHRlci5leGlzdHMoXCIuc21hcnQtY29ubmVjdGlvbnMvY2hhdHMvXCIgKyB0aGlzLmNoYXRfaWQgKyBcIi5qc29uXCIpKSB7XG4gICAgICBuZXdfbmFtZSA9IHRoaXMuY2hhdF9pZC5yZXBsYWNlKHRoaXMubmFtZSgpLCBuZXdfbmFtZSk7XG4gICAgICAvLyByZW5hbWUgZmlsZSBpZiBpdCBleGlzdHNcbiAgICAgIGF3YWl0IHRoaXMuYXBwLnZhdWx0LmFkYXB0ZXIucmVuYW1lKFxuICAgICAgICBcIi5zbWFydC1jb25uZWN0aW9ucy9jaGF0cy9cIiArIHRoaXMuY2hhdF9pZCArIFwiLmpzb25cIixcbiAgICAgICAgXCIuc21hcnQtY29ubmVjdGlvbnMvY2hhdHMvXCIgKyBuZXdfbmFtZSArIFwiLmpzb25cIlxuICAgICAgKTtcbiAgICAgIC8vIHNldCBjaGF0X2lkIHRvIG5ld19uYW1lXG4gICAgICB0aGlzLmNoYXRfaWQgPSBuZXdfbmFtZTtcbiAgICB9ZWxzZXtcbiAgICAgIHRoaXMuY2hhdF9pZCA9IG5ld19uYW1lICsgXCJcdTIwMTRcIiArIHRoaXMuZ2V0X2ZpbGVfZGF0ZV9zdHJpbmcoKTtcbiAgICAgIC8vIHNhdmUgY2hhdFxuICAgICAgYXdhaXQgdGhpcy5zYXZlX2NoYXQoKTtcbiAgICB9XG5cbiAgfVxuXG4gIG5hbWUoKSB7XG4gICAgaWYodGhpcy5jaGF0X2lkKXtcbiAgICAgIC8vIHJlbW92ZSBkYXRlIGFmdGVyIGxhc3QgZW0gZGFzaFxuICAgICAgcmV0dXJuIHRoaXMuY2hhdF9pZC5yZXBsYWNlKC9cdTIwMTRbXlx1MjAxNF0qJC8sXCJcIik7XG4gICAgfVxuICAgIHJldHVybiBcIlVOVElUTEVEXCI7XG4gIH1cblxuICBnZXRfZmlsZV9kYXRlX3N0cmluZygpIHtcbiAgICByZXR1cm4gbmV3IERhdGUoKS50b0lTT1N0cmluZygpLnJlcGxhY2UoLyhUfDp8XFwuLiopL2csIFwiIFwiKS50cmltKCk7XG4gIH1cbiAgLy8gZ2V0IHJlc3BvbnNlIGZyb20gd2l0aCBub3RlIGNvbnRleHRcbiAgYXN5bmMgZ2V0X3Jlc3BvbnNlX3dpdGhfbm90ZV9jb250ZXh0KHVzZXJfaW5wdXQsIGNoYXRfdmlldykge1xuICAgIGxldCBzeXN0ZW1faW5wdXQgPSBcIkltYWdpbmUgdGhlIGZvbGxvd2luZyBub3RlcyB3ZXJlIHdyaXR0ZW4gYnkgdGhlIHVzZXIgYW5kIGNvbnRhaW4gdGhlIG5lY2Vzc2FyeSBpbmZvcm1hdGlvbiB0byBzeW50aGVzaXplIGEgdXNlZnVsIGFuc3dlciB0aGUgdXNlcidzIHF1ZXJ5OlxcblwiO1xuICAgIC8vIGV4dHJhY3QgaW50ZXJuYWwgbGlua3NcbiAgICBjb25zdCBub3RlcyA9IHRoaXMuZXh0cmFjdF9pbnRlcm5hbF9saW5rcyh1c2VyX2lucHV0KTtcbiAgICAvLyBnZXQgY29udGVudCBvZiBpbnRlcm5hbCBsaW5rcyBhcyBjb250ZXh0XG4gICAgbGV0IG1heF9jaGFycyA9IGdldF9tYXhfY2hhcnModGhpcy5wbHVnaW4uc2V0dGluZ3Muc21hcnRfY2hhdF9tb2RlbCk7XG4gICAgZm9yKGxldCBpID0gMDsgaSA8IG5vdGVzLmxlbmd0aDsgaSsrKXtcbiAgICAgIC8vIG1heCBjaGFycyBmb3IgdGhpcyBub3RlIGlzIG1heF9jaGFycyBkaXZpZGVkIGJ5IG51bWJlciBvZiBub3RlcyBsZWZ0XG4gICAgICBjb25zdCB0aGlzX21heF9jaGFycyA9IChub3Rlcy5sZW5ndGggLSBpID4gMSkgPyBNYXRoLmZsb29yKG1heF9jaGFycyAvIChub3Rlcy5sZW5ndGggLSBpKSkgOiBtYXhfY2hhcnM7XG4gICAgICAvLyBjb25zb2xlLmxvZyhcImZpbGUgY29udGV4dCBtYXggY2hhcnM6IFwiICsgdGhpc19tYXhfY2hhcnMpO1xuICAgICAgY29uc3Qgbm90ZV9jb250ZW50ID0gYXdhaXQgdGhpcy5nZXRfbm90ZV9jb250ZW50cyhub3Rlc1tpXSwge2NoYXJfbGltaXQ6IHRoaXNfbWF4X2NoYXJzfSk7XG4gICAgICBzeXN0ZW1faW5wdXQgKz0gYC0tLUJFR0lOIE5PVEU6IFtbJHtub3Rlc1tpXS5iYXNlbmFtZX1dXS0tLVxcbmBcbiAgICAgIHN5c3RlbV9pbnB1dCArPSBub3RlX2NvbnRlbnQ7XG4gICAgICBzeXN0ZW1faW5wdXQgKz0gYC0tLUVORCBOT1RFLS0tXFxuYFxuICAgICAgbWF4X2NoYXJzIC09IG5vdGVfY29udGVudC5sZW5ndGg7XG4gICAgICBpZihtYXhfY2hhcnMgPD0gMCkgYnJlYWs7XG4gICAgfVxuICAgIHRoaXMuY29udGV4dCA9IHN5c3RlbV9pbnB1dDtcbiAgICBjb25zdCBjaGF0bWwgPSBbXG4gICAgICB7XG4gICAgICAgIHJvbGU6IFwic3lzdGVtXCIsXG4gICAgICAgIGNvbnRlbnQ6IHN5c3RlbV9pbnB1dFxuICAgICAgfSxcbiAgICAgIHtcbiAgICAgICAgcm9sZTogXCJ1c2VyXCIsXG4gICAgICAgIGNvbnRlbnQ6IHVzZXJfaW5wdXRcbiAgICAgIH1cbiAgICBdO1xuICAgIGNoYXRfdmlldy5yZXF1ZXN0X2NoYXRncHRfY29tcGxldGlvbih7bWVzc2FnZXM6IGNoYXRtbCwgdGVtcGVyYXR1cmU6IDB9KTtcbiAgfVxuICAvLyBjaGVjayBpZiBjb250YWlucyBpbnRlcm5hbCBsaW5rXG4gIGNvbnRhaW5zX2ludGVybmFsX2xpbmsodXNlcl9pbnB1dCkge1xuICAgIGlmKHVzZXJfaW5wdXQuaW5kZXhPZihcIltbXCIpID09PSAtMSkgcmV0dXJuIGZhbHNlO1xuICAgIGlmKHVzZXJfaW5wdXQuaW5kZXhPZihcIl1dXCIpID09PSAtMSkgcmV0dXJuIGZhbHNlO1xuICAgIHJldHVybiB0cnVlO1xuICB9XG4gIC8vIGNoZWNrIGlmIGNvbnRhaW5zIGZvbGRlciByZWZlcmVuY2UgKGV4LiAvZm9sZGVyLywgb3IgL2ZvbGRlci9zdWJmb2xkZXIvKVxuICBjb250YWluc19mb2xkZXJfcmVmZXJlbmNlKHVzZXJfaW5wdXQpIHtcbiAgICBpZih1c2VyX2lucHV0LmluZGV4T2YoXCIvXCIpID09PSAtMSkgcmV0dXJuIGZhbHNlO1xuICAgIGlmKHVzZXJfaW5wdXQuaW5kZXhPZihcIi9cIikgPT09IHVzZXJfaW5wdXQubGFzdEluZGV4T2YoXCIvXCIpKSByZXR1cm4gZmFsc2U7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cbiAgLy8gZ2V0IGZvbGRlciByZWZlcmVuY2VzIGZyb20gdXNlciBpbnB1dFxuICBnZXRfZm9sZGVyX3JlZmVyZW5jZXModXNlcl9pbnB1dCkge1xuICAgIC8vIHVzZSB0aGlzLmZvbGRlcnMgdG8gZXh0cmFjdCBmb2xkZXIgcmVmZXJlbmNlcyBieSBsb25nZXN0IGZpcnN0IChleC4gL2ZvbGRlci9zdWJmb2xkZXIvIGJlZm9yZSAvZm9sZGVyLykgdG8gYXZvaWQgbWF0Y2hpbmcgL2ZvbGRlci9zdWJmb2xkZXIvIGFzIC9mb2xkZXIvXG4gICAgY29uc3QgZm9sZGVycyA9IHRoaXMucGx1Z2luLmZvbGRlcnMuc2xpY2UoKTsgLy8gY29weSBmb2xkZXJzIGFycmF5XG4gICAgY29uc3QgbWF0Y2hlcyA9IGZvbGRlcnMuc29ydCgoYSwgYikgPT4gYi5sZW5ndGggLSBhLmxlbmd0aCkubWFwKGZvbGRlciA9PiB7XG4gICAgICAvLyBjaGVjayBpZiBmb2xkZXIgaXMgaW4gdXNlcl9pbnB1dFxuICAgICAgaWYodXNlcl9pbnB1dC5pbmRleE9mKGZvbGRlcikgIT09IC0xKXtcbiAgICAgICAgLy8gcmVtb3ZlIGZvbGRlciBmcm9tIHVzZXJfaW5wdXQgdG8gcHJldmVudCBtYXRjaGluZyAvZm9sZGVyL3N1YmZvbGRlci8gYXMgL2ZvbGRlci9cbiAgICAgICAgdXNlcl9pbnB1dCA9IHVzZXJfaW5wdXQucmVwbGFjZShmb2xkZXIsIFwiXCIpO1xuICAgICAgICByZXR1cm4gZm9sZGVyO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH0pLmZpbHRlcihmb2xkZXIgPT4gZm9sZGVyKTtcbiAgICBjb25zb2xlLmxvZyhtYXRjaGVzKTtcbiAgICAvLyByZXR1cm4gYXJyYXkgb2YgbWF0Y2hlc1xuICAgIGlmKG1hdGNoZXMpIHJldHVybiBtYXRjaGVzO1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG5cbiAgLy8gZXh0cmFjdCBpbnRlcm5hbCBsaW5rc1xuICBleHRyYWN0X2ludGVybmFsX2xpbmtzKHVzZXJfaW5wdXQpIHtcbiAgICBjb25zdCBtYXRjaGVzID0gdXNlcl9pbnB1dC5tYXRjaCgvXFxbXFxbKC4qPylcXF1cXF0vZyk7XG4gICAgY29uc29sZS5sb2cobWF0Y2hlcyk7XG4gICAgLy8gcmV0dXJuIGFycmF5IG9mIFRGaWxlIG9iamVjdHNcbiAgICBpZihtYXRjaGVzKSByZXR1cm4gbWF0Y2hlcy5tYXAobWF0Y2ggPT4ge1xuICAgICAgcmV0dXJuIHRoaXMuYXBwLm1ldGFkYXRhQ2FjaGUuZ2V0Rmlyc3RMaW5rcGF0aERlc3QobWF0Y2gucmVwbGFjZShcIltbXCIsIFwiXCIpLnJlcGxhY2UoXCJdXVwiLCBcIlwiKSwgXCIvXCIpO1xuICAgIH0pO1xuICAgIHJldHVybiBbXTtcbiAgfVxuICAvLyBnZXQgY29udGV4dCBmcm9tIGludGVybmFsIGxpbmtzXG4gIGFzeW5jIGdldF9ub3RlX2NvbnRlbnRzKG5vdGUsIG9wdHM9e30pIHtcbiAgICBvcHRzID0ge1xuICAgICAgY2hhcl9saW1pdDogMTAwMDAsXG4gICAgICAuLi5vcHRzXG4gICAgfVxuICAgIC8vIHJldHVybiBpZiBub3RlIGlzIG5vdCBhIGZpbGVcbiAgICBpZighKG5vdGUgaW5zdGFuY2VvZiBPYnNpZGlhbi5URmlsZSkpIHJldHVybiBcIlwiO1xuICAgIC8vIGdldCBmaWxlIGNvbnRlbnRcbiAgICBsZXQgZmlsZV9jb250ZW50ID0gYXdhaXQgdGhpcy5hcHAudmF1bHQuY2FjaGVkUmVhZChub3RlKTtcbiAgICAvLyBjaGVjayBpZiBjb250YWlucyBkYXRhdmlldyBjb2RlIGJsb2NrXG4gICAgaWYoZmlsZV9jb250ZW50LmluZGV4T2YoXCJgYGBkYXRhdmlld1wiKSA+IC0xKXtcbiAgICAgIC8vIGlmIGNvbnRhaW5zIGRhdGF2aWV3IGNvZGUgYmxvY2sgZ2V0IGFsbCBkYXRhdmlldyBjb2RlIGJsb2Nrc1xuICAgICAgZmlsZV9jb250ZW50ID0gYXdhaXQgdGhpcy5yZW5kZXJfZGF0YXZpZXdfcXVlcmllcyhmaWxlX2NvbnRlbnQsIG5vdGUucGF0aCwgb3B0cyk7XG4gICAgfVxuICAgIGZpbGVfY29udGVudCA9IGZpbGVfY29udGVudC5zdWJzdHJpbmcoMCwgb3B0cy5jaGFyX2xpbWl0KTtcbiAgICAvLyBjb25zb2xlLmxvZyhmaWxlX2NvbnRlbnQubGVuZ3RoKTtcbiAgICByZXR1cm4gZmlsZV9jb250ZW50O1xuICB9XG5cblxuICBhc3luYyByZW5kZXJfZGF0YXZpZXdfcXVlcmllcyhmaWxlX2NvbnRlbnQsIG5vdGVfcGF0aCwgb3B0cz17fSkge1xuICAgIG9wdHMgPSB7XG4gICAgICBjaGFyX2xpbWl0OiBudWxsLFxuICAgICAgLi4ub3B0c1xuICAgIH07XG4gICAgLy8gdXNlIHdpbmRvdyB0byBnZXQgZGF0YXZpZXcgYXBpXG4gICAgY29uc3QgZGF0YXZpZXdfYXBpID0gd2luZG93W1wiRGF0YXZpZXdBUElcIl07XG4gICAgLy8gc2tpcCBpZiBkYXRhdmlldyBhcGkgbm90IGZvdW5kXG4gICAgaWYoIWRhdGF2aWV3X2FwaSkgcmV0dXJuIGZpbGVfY29udGVudDtcbiAgICBjb25zdCBkYXRhdmlld19jb2RlX2Jsb2NrcyA9IGZpbGVfY29udGVudC5tYXRjaCgvYGBgZGF0YXZpZXcoLio/KWBgYC9ncyk7XG4gICAgLy8gZm9yIGVhY2ggZGF0YXZpZXcgY29kZSBibG9ja1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZGF0YXZpZXdfY29kZV9ibG9ja3MubGVuZ3RoOyBpKyspIHtcbiAgICAgIC8vIGlmIG9wdHMgY2hhcl9saW1pdCBpcyBsZXNzIHRoYW4gaW5kZXhPZiBkYXRhdmlldyBjb2RlIGJsb2NrLCBicmVha1xuICAgICAgaWYob3B0cy5jaGFyX2xpbWl0ICYmIG9wdHMuY2hhcl9saW1pdCA8IGZpbGVfY29udGVudC5pbmRleE9mKGRhdGF2aWV3X2NvZGVfYmxvY2tzW2ldKSkgYnJlYWs7XG4gICAgICAvLyBnZXQgZGF0YXZpZXcgY29kZSBibG9ja1xuICAgICAgY29uc3QgZGF0YXZpZXdfY29kZV9ibG9jayA9IGRhdGF2aWV3X2NvZGVfYmxvY2tzW2ldO1xuICAgICAgLy8gZ2V0IGNvbnRlbnQgb2YgZGF0YXZpZXcgY29kZSBibG9ja1xuICAgICAgY29uc3QgZGF0YXZpZXdfY29kZV9ibG9ja19jb250ZW50ID0gZGF0YXZpZXdfY29kZV9ibG9jay5yZXBsYWNlKFwiYGBgZGF0YXZpZXdcIiwgXCJcIikucmVwbGFjZShcImBgYFwiLCBcIlwiKTtcbiAgICAgIC8vIGdldCBkYXRhdmlldyBxdWVyeSByZXN1bHRcbiAgICAgIGNvbnN0IGRhdGF2aWV3X3F1ZXJ5X3Jlc3VsdCA9IGF3YWl0IGRhdGF2aWV3X2FwaS5xdWVyeU1hcmtkb3duKGRhdGF2aWV3X2NvZGVfYmxvY2tfY29udGVudCwgbm90ZV9wYXRoLCBudWxsKTtcbiAgICAgIC8vIGlmIHF1ZXJ5IHJlc3VsdCBpcyBzdWNjZXNzZnVsLCByZXBsYWNlIGRhdGF2aWV3IGNvZGUgYmxvY2sgd2l0aCBxdWVyeSByZXN1bHRcbiAgICAgIGlmIChkYXRhdmlld19xdWVyeV9yZXN1bHQuc3VjY2Vzc2Z1bCkge1xuICAgICAgICBmaWxlX2NvbnRlbnQgPSBmaWxlX2NvbnRlbnQucmVwbGFjZShkYXRhdmlld19jb2RlX2Jsb2NrLCBkYXRhdmlld19xdWVyeV9yZXN1bHQudmFsdWUpO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gZmlsZV9jb250ZW50O1xuICB9XG59XG5cbmNsYXNzIFNtYXJ0Q29ubmVjdGlvbnNDaGF0SGlzdG9yeU1vZGFsIGV4dGVuZHMgT2JzaWRpYW4uRnV6enlTdWdnZXN0TW9kYWwge1xuICBjb25zdHJ1Y3RvcihhcHAsIHZpZXcsIGZpbGVzKSB7XG4gICAgc3VwZXIoYXBwKTtcbiAgICB0aGlzLmFwcCA9IGFwcDtcbiAgICB0aGlzLnZpZXcgPSB2aWV3O1xuICAgIHRoaXMuc2V0UGxhY2Vob2xkZXIoXCJUeXBlIHRoZSBuYW1lIG9mIGEgY2hhdCBzZXNzaW9uLi4uXCIpO1xuICB9XG4gIGdldEl0ZW1zKCkge1xuICAgIGlmICghdGhpcy52aWV3LmZpbGVzKSB7XG4gICAgICByZXR1cm4gW107XG4gICAgfVxuICAgIHJldHVybiB0aGlzLnZpZXcuZmlsZXM7XG4gIH1cbiAgZ2V0SXRlbVRleHQoaXRlbSkge1xuICAgIC8vIGlmIG5vdCBVTlRJVExFRCwgcmVtb3ZlIGRhdGUgYWZ0ZXIgbGFzdCBlbSBkYXNoXG4gICAgaWYoaXRlbS5pbmRleE9mKFwiVU5USVRMRURcIikgPT09IC0xKXtcbiAgICAgIGl0ZW0ucmVwbGFjZSgvXHUyMDE0W15cdTIwMTRdKiQvLFwiXCIpO1xuICAgIH1cbiAgICByZXR1cm4gaXRlbTtcbiAgfVxuICBvbkNob29zZUl0ZW0oc2Vzc2lvbikge1xuICAgIHRoaXMudmlldy5vcGVuX2NoYXQoc2Vzc2lvbik7XG4gIH1cbn1cblxuLy8gRmlsZSBTZWxlY3QgRnV6enkgU3VnZ2VzdCBNb2RhbFxuY2xhc3MgU21hcnRDb25uZWN0aW9uc0ZpbGVTZWxlY3RNb2RhbCBleHRlbmRzIE9ic2lkaWFuLkZ1enp5U3VnZ2VzdE1vZGFsIHtcbiAgY29uc3RydWN0b3IoYXBwLCB2aWV3KSB7XG4gICAgc3VwZXIoYXBwKTtcbiAgICB0aGlzLmFwcCA9IGFwcDtcbiAgICB0aGlzLnZpZXcgPSB2aWV3O1xuICAgIHRoaXMuc2V0UGxhY2Vob2xkZXIoXCJUeXBlIHRoZSBuYW1lIG9mIGEgZmlsZS4uLlwiKTtcbiAgfVxuICBnZXRJdGVtcygpIHtcbiAgICAvLyBnZXQgYWxsIG1hcmtkb3duIGZpbGVzXG4gICAgcmV0dXJuIHRoaXMuYXBwLnZhdWx0LmdldE1hcmtkb3duRmlsZXMoKS5zb3J0KChhLCBiKSA9PiBhLmJhc2VuYW1lLmxvY2FsZUNvbXBhcmUoYi5iYXNlbmFtZSkpO1xuICB9XG4gIGdldEl0ZW1UZXh0KGl0ZW0pIHtcbiAgICByZXR1cm4gaXRlbS5iYXNlbmFtZTtcbiAgfVxuICBvbkNob29zZUl0ZW0oZmlsZSkge1xuICAgIHRoaXMudmlldy5pbnNlcnRfc2VsZWN0aW9uKGZpbGUuYmFzZW5hbWUgKyBcIl1dIFwiKTtcbiAgfVxufVxuLy8gRm9sZGVyIFNlbGVjdCBGdXp6eSBTdWdnZXN0IE1vZGFsXG5jbGFzcyBTbWFydENvbm5lY3Rpb25zRm9sZGVyU2VsZWN0TW9kYWwgZXh0ZW5kcyBPYnNpZGlhbi5GdXp6eVN1Z2dlc3RNb2RhbCB7XG4gIGNvbnN0cnVjdG9yKGFwcCwgdmlldykge1xuICAgIHN1cGVyKGFwcCk7XG4gICAgdGhpcy5hcHAgPSBhcHA7XG4gICAgdGhpcy52aWV3ID0gdmlldztcbiAgICB0aGlzLnNldFBsYWNlaG9sZGVyKFwiVHlwZSB0aGUgbmFtZSBvZiBhIGZvbGRlci4uLlwiKTtcbiAgfVxuICBnZXRJdGVtcygpIHtcbiAgICByZXR1cm4gdGhpcy52aWV3LnBsdWdpbi5mb2xkZXJzO1xuICB9XG4gIGdldEl0ZW1UZXh0KGl0ZW0pIHtcbiAgICByZXR1cm4gaXRlbTtcbiAgfVxuICBvbkNob29zZUl0ZW0oZm9sZGVyKSB7XG4gICAgdGhpcy52aWV3Lmluc2VydF9zZWxlY3Rpb24oZm9sZGVyICsgXCIvIFwiKTtcbiAgfVxufVxuXG5cbi8vIEhhbmRsZSBBUEkgcmVzcG9uc2Ugc3RyZWFtaW5nXG5jbGFzcyBTY1N0cmVhbWVyIHtcbiAgLy8gY29uc3RydWN0b3JcbiAgY29uc3RydWN0b3IodXJsLCBvcHRpb25zKSB7XG4gICAgLy8gc2V0IGRlZmF1bHQgb3B0aW9uc1xuICAgIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuICAgIHRoaXMudXJsID0gdXJsO1xuICAgIHRoaXMubWV0aG9kID0gb3B0aW9ucy5tZXRob2QgfHwgJ0dFVCc7XG4gICAgdGhpcy5oZWFkZXJzID0gb3B0aW9ucy5oZWFkZXJzIHx8IHt9O1xuICAgIHRoaXMucGF5bG9hZCA9IG9wdGlvbnMucGF5bG9hZCB8fCBudWxsO1xuICAgIHRoaXMud2l0aENyZWRlbnRpYWxzID0gb3B0aW9ucy53aXRoQ3JlZGVudGlhbHMgfHwgZmFsc2U7XG4gICAgdGhpcy5saXN0ZW5lcnMgPSB7fTtcbiAgICB0aGlzLnJlYWR5U3RhdGUgPSB0aGlzLkNPTk5FQ1RJTkc7XG4gICAgdGhpcy5wcm9ncmVzcyA9IDA7XG4gICAgdGhpcy5jaHVuayA9ICcnO1xuICAgIHRoaXMueGhyID0gbnVsbDtcbiAgICB0aGlzLkZJRUxEX1NFUEFSQVRPUiA9ICc6JztcbiAgICB0aGlzLklOSVRJQUxJWklORyA9IC0xO1xuICAgIHRoaXMuQ09OTkVDVElORyA9IDA7XG4gICAgdGhpcy5PUEVOID0gMTtcbiAgICB0aGlzLkNMT1NFRCA9IDI7XG4gIH1cbiAgLy8gYWRkRXZlbnRMaXN0ZW5lclxuICBhZGRFdmVudExpc3RlbmVyKHR5cGUsIGxpc3RlbmVyKSB7XG4gICAgLy8gY2hlY2sgaWYgdGhlIHR5cGUgaXMgaW4gdGhlIGxpc3RlbmVyc1xuICAgIGlmICghdGhpcy5saXN0ZW5lcnNbdHlwZV0pIHtcbiAgICAgIHRoaXMubGlzdGVuZXJzW3R5cGVdID0gW107XG4gICAgfVxuICAgIC8vIGNoZWNrIGlmIHRoZSBsaXN0ZW5lciBpcyBhbHJlYWR5IGluIHRoZSBsaXN0ZW5lcnNcbiAgICBpZih0aGlzLmxpc3RlbmVyc1t0eXBlXS5pbmRleE9mKGxpc3RlbmVyKSA9PT0gLTEpIHtcbiAgICAgIHRoaXMubGlzdGVuZXJzW3R5cGVdLnB1c2gobGlzdGVuZXIpO1xuICAgIH1cbiAgfVxuICAvLyByZW1vdmVFdmVudExpc3RlbmVyXG4gIHJlbW92ZUV2ZW50TGlzdGVuZXIodHlwZSwgbGlzdGVuZXIpIHtcbiAgICAvLyBjaGVjayBpZiBsaXN0ZW5lciB0eXBlIGlzIHVuZGVmaW5lZFxuICAgIGlmICghdGhpcy5saXN0ZW5lcnNbdHlwZV0pIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgbGV0IGZpbHRlcmVkID0gW107XG4gICAgLy8gbG9vcCB0aHJvdWdoIHRoZSBsaXN0ZW5lcnNcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMubGlzdGVuZXJzW3R5cGVdLmxlbmd0aDsgaSsrKSB7XG4gICAgICAvLyBjaGVjayBpZiB0aGUgbGlzdGVuZXIgaXMgdGhlIHNhbWVcbiAgICAgIGlmICh0aGlzLmxpc3RlbmVyc1t0eXBlXVtpXSAhPT0gbGlzdGVuZXIpIHtcbiAgICAgICAgZmlsdGVyZWQucHVzaCh0aGlzLmxpc3RlbmVyc1t0eXBlXVtpXSk7XG4gICAgICB9XG4gICAgfVxuICAgIC8vIGNoZWNrIGlmIHRoZSBsaXN0ZW5lcnMgYXJlIGVtcHR5XG4gICAgaWYgKHRoaXMubGlzdGVuZXJzW3R5cGVdLmxlbmd0aCA9PT0gMCkge1xuICAgICAgZGVsZXRlIHRoaXMubGlzdGVuZXJzW3R5cGVdO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmxpc3RlbmVyc1t0eXBlXSA9IGZpbHRlcmVkO1xuICAgIH1cbiAgfVxuICAvLyBkaXNwYXRjaEV2ZW50XG4gIGRpc3BhdGNoRXZlbnQoZXZlbnQpIHtcbiAgICAvLyBpZiBubyBldmVudCByZXR1cm4gdHJ1ZVxuICAgIGlmICghZXZlbnQpIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgICAvLyBzZXQgZXZlbnQgc291cmNlIHRvIHRoaXNcbiAgICBldmVudC5zb3VyY2UgPSB0aGlzO1xuICAgIC8vIHNldCBvbkhhbmRsZXIgdG8gb24gKyBldmVudCB0eXBlXG4gICAgbGV0IG9uSGFuZGxlciA9ICdvbicgKyBldmVudC50eXBlO1xuICAgIC8vIGNoZWNrIGlmIHRoZSBvbkhhbmRsZXIgaGFzIG93biBwcm9wZXJ0eSBuYW1lZCBzYW1lIGFzIG9uSGFuZGxlclxuICAgIGlmICh0aGlzLmhhc093blByb3BlcnR5KG9uSGFuZGxlcikpIHtcbiAgICAgIC8vIGNhbGwgdGhlIG9uSGFuZGxlclxuICAgICAgdGhpc1tvbkhhbmRsZXJdLmNhbGwodGhpcywgZXZlbnQpO1xuICAgICAgLy8gY2hlY2sgaWYgdGhlIGV2ZW50IGlzIGRlZmF1bHQgcHJldmVudGVkXG4gICAgICBpZiAoZXZlbnQuZGVmYXVsdFByZXZlbnRlZCkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgfVxuICAgIC8vIGNoZWNrIGlmIHRoZSBldmVudCB0eXBlIGlzIGluIHRoZSBsaXN0ZW5lcnNcbiAgICBpZiAodGhpcy5saXN0ZW5lcnNbZXZlbnQudHlwZV0pIHtcbiAgICAgIHJldHVybiB0aGlzLmxpc3RlbmVyc1tldmVudC50eXBlXS5ldmVyeShmdW5jdGlvbihjYWxsYmFjaykge1xuICAgICAgICBjYWxsYmFjayhldmVudCk7XG4gICAgICAgIHJldHVybiAhZXZlbnQuZGVmYXVsdFByZXZlbnRlZDtcbiAgICAgIH0pO1xuICAgIH1cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuICAvLyBfc2V0UmVhZHlTdGF0ZVxuICBfc2V0UmVhZHlTdGF0ZShzdGF0ZSkge1xuICAgIC8vIHNldCBldmVudCB0eXBlIHRvIHJlYWR5U3RhdGVDaGFuZ2VcbiAgICBsZXQgZXZlbnQgPSBuZXcgQ3VzdG9tRXZlbnQoJ3JlYWR5U3RhdGVDaGFuZ2UnKTtcbiAgICAvLyBzZXQgZXZlbnQgcmVhZHlTdGF0ZSB0byBzdGF0ZVxuICAgIGV2ZW50LnJlYWR5U3RhdGUgPSBzdGF0ZTtcbiAgICAvLyBzZXQgcmVhZHlTdGF0ZSB0byBzdGF0ZVxuICAgIHRoaXMucmVhZHlTdGF0ZSA9IHN0YXRlO1xuICAgIC8vIGRpc3BhdGNoIGV2ZW50XG4gICAgdGhpcy5kaXNwYXRjaEV2ZW50KGV2ZW50KTtcbiAgfVxuICAvLyBfb25TdHJlYW1GYWlsdXJlXG4gIF9vblN0cmVhbUZhaWx1cmUoZSkge1xuICAgIC8vIHNldCBldmVudCB0eXBlIHRvIGVycm9yXG4gICAgbGV0IGV2ZW50ID0gbmV3IEN1c3RvbUV2ZW50KCdlcnJvcicpO1xuICAgIC8vIHNldCBldmVudCBkYXRhIHRvIGVcbiAgICBldmVudC5kYXRhID0gZS5jdXJyZW50VGFyZ2V0LnJlc3BvbnNlO1xuICAgIC8vIGRpc3BhdGNoIGV2ZW50XG4gICAgdGhpcy5kaXNwYXRjaEV2ZW50KGV2ZW50KTtcbiAgICB0aGlzLmNsb3NlKCk7XG4gIH1cbiAgLy8gX29uU3RyZWFtQWJvcnRcbiAgX29uU3RyZWFtQWJvcnQoZSkge1xuICAgIC8vIHNldCB0byBhYm9ydFxuICAgIGxldCBldmVudCA9IG5ldyBDdXN0b21FdmVudCgnYWJvcnQnKTtcbiAgICAvLyBjbG9zZVxuICAgIHRoaXMuY2xvc2UoKTtcbiAgfVxuICAvLyBfb25TdHJlYW1Qcm9ncmVzc1xuICBfb25TdHJlYW1Qcm9ncmVzcyhlKSB7XG4gICAgLy8gaWYgbm90IHhociByZXR1cm5cbiAgICBpZiAoIXRoaXMueGhyKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIC8vIGlmIHhociBzdGF0dXMgaXMgbm90IDIwMCByZXR1cm5cbiAgICBpZiAodGhpcy54aHIuc3RhdHVzICE9PSAyMDApIHtcbiAgICAgIC8vIG9uU3RyZWFtRmFpbHVyZVxuICAgICAgdGhpcy5fb25TdHJlYW1GYWlsdXJlKGUpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICAvLyBpZiByZWFkeSBzdGF0ZSBpcyBDT05ORUNUSU5HXG4gICAgaWYgKHRoaXMucmVhZHlTdGF0ZSA9PT0gdGhpcy5DT05ORUNUSU5HKSB7XG4gICAgICAvLyBkaXNwYXRjaCBldmVudFxuICAgICAgdGhpcy5kaXNwYXRjaEV2ZW50KG5ldyBDdXN0b21FdmVudCgnb3BlbicpKTtcbiAgICAgIC8vIHNldCByZWFkeSBzdGF0ZSB0byBPUEVOXG4gICAgICB0aGlzLl9zZXRSZWFkeVN0YXRlKHRoaXMuT1BFTik7XG4gICAgfVxuICAgIC8vIHBhcnNlIHRoZSByZWNlaXZlZCBkYXRhLlxuICAgIGxldCBkYXRhID0gdGhpcy54aHIucmVzcG9uc2VUZXh0LnN1YnN0cmluZyh0aGlzLnByb2dyZXNzKTtcbiAgICAvLyB1cGRhdGUgcHJvZ3Jlc3NcbiAgICB0aGlzLnByb2dyZXNzICs9IGRhdGEubGVuZ3RoO1xuICAgIC8vIHNwbGl0IHRoZSBkYXRhIGJ5IG5ldyBsaW5lIGFuZCBwYXJzZSBlYWNoIGxpbmVcbiAgICBkYXRhLnNwbGl0KC8oXFxyXFxufFxccnxcXG4pezJ9L2cpLmZvckVhY2goZnVuY3Rpb24ocGFydCl7XG4gICAgICBpZihwYXJ0LnRyaW0oKS5sZW5ndGggPT09IDApIHtcbiAgICAgICAgdGhpcy5kaXNwYXRjaEV2ZW50KHRoaXMuX3BhcnNlRXZlbnRDaHVuayh0aGlzLmNodW5rLnRyaW0oKSkpO1xuICAgICAgICB0aGlzLmNodW5rID0gJyc7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLmNodW5rICs9IHBhcnQ7XG4gICAgICB9XG4gICAgfS5iaW5kKHRoaXMpKTtcbiAgfVxuICAvLyBfb25TdHJlYW1Mb2FkZWRcbiAgX29uU3RyZWFtTG9hZGVkKGUpIHtcbiAgICB0aGlzLl9vblN0cmVhbVByb2dyZXNzKGUpO1xuICAgIC8vIHBhcnNlIHRoZSBsYXN0IGNodW5rXG4gICAgdGhpcy5kaXNwYXRjaEV2ZW50KHRoaXMuX3BhcnNlRXZlbnRDaHVuayh0aGlzLmNodW5rKSk7XG4gICAgdGhpcy5jaHVuayA9ICcnO1xuICB9XG4gIC8vIF9wYXJzZUV2ZW50Q2h1bmtcbiAgX3BhcnNlRXZlbnRDaHVuayhjaHVuaykge1xuICAgIC8vIGlmIG5vIGNodW5rIG9yIGNodW5rIGlzIGVtcHR5IHJldHVyblxuICAgIGlmICghY2h1bmsgfHwgY2h1bmsubGVuZ3RoID09PSAwKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgLy8gaW5pdCBlXG4gICAgbGV0IGUgPSB7aWQ6IG51bGwsIHJldHJ5OiBudWxsLCBkYXRhOiAnJywgZXZlbnQ6ICdtZXNzYWdlJ307XG4gICAgLy8gc3BsaXQgdGhlIGNodW5rIGJ5IG5ldyBsaW5lXG4gICAgY2h1bmsuc3BsaXQoLyhcXHJcXG58XFxyfFxcbikvKS5mb3JFYWNoKGZ1bmN0aW9uKGxpbmUpIHtcbiAgICAgIGxpbmUgPSBsaW5lLnRyaW1SaWdodCgpO1xuICAgICAgbGV0IGluZGV4ID0gbGluZS5pbmRleE9mKHRoaXMuRklFTERfU0VQQVJBVE9SKTtcbiAgICAgIGlmKGluZGV4IDw9IDApIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgLy8gZmllbGRcbiAgICAgIGxldCBmaWVsZCA9IGxpbmUuc3Vic3RyaW5nKDAsIGluZGV4KTtcbiAgICAgIGlmKCEoZmllbGQgaW4gZSkpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgLy8gdmFsdWVcbiAgICAgIGxldCB2YWx1ZSA9IGxpbmUuc3Vic3RyaW5nKGluZGV4ICsgMSkudHJpbUxlZnQoKTtcbiAgICAgIGlmKGZpZWxkID09PSAnZGF0YScpIHtcbiAgICAgICAgZVtmaWVsZF0gKz0gdmFsdWU7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBlW2ZpZWxkXSA9IHZhbHVlO1xuICAgICAgfVxuICAgIH0uYmluZCh0aGlzKSk7XG4gICAgLy8gcmV0dXJuIGV2ZW50XG4gICAgbGV0IGV2ZW50ID0gbmV3IEN1c3RvbUV2ZW50KGUuZXZlbnQpO1xuICAgIGV2ZW50LmRhdGEgPSBlLmRhdGE7XG4gICAgZXZlbnQuaWQgPSBlLmlkO1xuICAgIHJldHVybiBldmVudDtcbiAgfVxuICAvLyBfY2hlY2tTdHJlYW1DbG9zZWRcbiAgX2NoZWNrU3RyZWFtQ2xvc2VkKCkge1xuICAgIGlmKCF0aGlzLnhocikge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBpZih0aGlzLnhoci5yZWFkeVN0YXRlID09PSBYTUxIdHRwUmVxdWVzdC5ET05FKSB7XG4gICAgICB0aGlzLl9zZXRSZWFkeVN0YXRlKHRoaXMuQ0xPU0VEKTtcbiAgICB9XG4gIH1cbiAgLy8gc3RyZWFtXG4gIHN0cmVhbSgpIHtcbiAgICAvLyBzZXQgcmVhZHkgc3RhdGUgdG8gY29ubmVjdGluZ1xuICAgIHRoaXMuX3NldFJlYWR5U3RhdGUodGhpcy5DT05ORUNUSU5HKTtcbiAgICAvLyBzZXQgeGhyIHRvIG5ldyBYTUxIdHRwUmVxdWVzdFxuICAgIHRoaXMueGhyID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG4gICAgLy8gc2V0IHhociBwcm9ncmVzcyB0byBfb25TdHJlYW1Qcm9ncmVzc1xuICAgIHRoaXMueGhyLmFkZEV2ZW50TGlzdGVuZXIoJ3Byb2dyZXNzJywgdGhpcy5fb25TdHJlYW1Qcm9ncmVzcy5iaW5kKHRoaXMpKTtcbiAgICAvLyBzZXQgeGhyIGxvYWQgdG8gX29uU3RyZWFtTG9hZGVkXG4gICAgdGhpcy54aHIuYWRkRXZlbnRMaXN0ZW5lcignbG9hZCcsIHRoaXMuX29uU3RyZWFtTG9hZGVkLmJpbmQodGhpcykpO1xuICAgIC8vIHNldCB4aHIgcmVhZHkgc3RhdGUgY2hhbmdlIHRvIF9jaGVja1N0cmVhbUNsb3NlZFxuICAgIHRoaXMueGhyLmFkZEV2ZW50TGlzdGVuZXIoJ3JlYWR5c3RhdGVjaGFuZ2UnLCB0aGlzLl9jaGVja1N0cmVhbUNsb3NlZC5iaW5kKHRoaXMpKTtcbiAgICAvLyBzZXQgeGhyIGVycm9yIHRvIF9vblN0cmVhbUZhaWx1cmVcbiAgICB0aGlzLnhoci5hZGRFdmVudExpc3RlbmVyKCdlcnJvcicsIHRoaXMuX29uU3RyZWFtRmFpbHVyZS5iaW5kKHRoaXMpKTtcbiAgICAvLyBzZXQgeGhyIGFib3J0IHRvIF9vblN0cmVhbUFib3J0XG4gICAgdGhpcy54aHIuYWRkRXZlbnRMaXN0ZW5lcignYWJvcnQnLCB0aGlzLl9vblN0cmVhbUFib3J0LmJpbmQodGhpcykpO1xuICAgIC8vIG9wZW4geGhyXG4gICAgdGhpcy54aHIub3Blbih0aGlzLm1ldGhvZCwgdGhpcy51cmwpO1xuICAgIC8vIGhlYWRlcnMgdG8geGhyXG4gICAgZm9yIChsZXQgaGVhZGVyIGluIHRoaXMuaGVhZGVycykge1xuICAgICAgdGhpcy54aHIuc2V0UmVxdWVzdEhlYWRlcihoZWFkZXIsIHRoaXMuaGVhZGVyc1toZWFkZXJdKTtcbiAgICB9XG4gICAgLy8gY3JlZGVudGlhbHMgdG8geGhyXG4gICAgdGhpcy54aHIud2l0aENyZWRlbnRpYWxzID0gdGhpcy53aXRoQ3JlZGVudGlhbHM7XG4gICAgLy8gc2VuZCB4aHJcbiAgICB0aGlzLnhoci5zZW5kKHRoaXMucGF5bG9hZCk7XG4gIH1cbiAgLy8gY2xvc2VcbiAgY2xvc2UoKSB7XG4gICAgaWYodGhpcy5yZWFkeVN0YXRlID09PSB0aGlzLkNMT1NFRCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB0aGlzLnhoci5hYm9ydCgpO1xuICAgIHRoaXMueGhyID0gbnVsbDtcbiAgICB0aGlzLl9zZXRSZWFkeVN0YXRlKHRoaXMuQ0xPU0VEKTtcbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IFNtYXJ0Q29ubmVjdGlvbnNQbHVnaW47Il0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7O0FBQUE7QUFBQSw0QkFBQUEsVUFBQUMsU0FBQTtBQUFBLFFBQU1DLFdBQU4sTUFBYztBQUFBLE1BQ1osWUFBWSxRQUFRO0FBRWxCLGFBQUssU0FBUztBQUFBLFVBQ1osV0FBVztBQUFBLFVBQ1gsYUFBYTtBQUFBLFVBQ2IsZ0JBQWdCO0FBQUEsVUFDaEIsZUFBZTtBQUFBLFVBQ2YsY0FBYztBQUFBLFVBQ2QsZ0JBQWdCO0FBQUEsVUFDaEIsY0FBYztBQUFBLFVBQ2QsZUFBZTtBQUFBLFVBQ2YsR0FBRztBQUFBLFFBQ0w7QUFDQSxhQUFLLFlBQVksS0FBSyxPQUFPO0FBQzdCLGFBQUssY0FBYyxPQUFPO0FBQzFCLGFBQUssWUFBWSxLQUFLLGNBQWMsTUFBTSxLQUFLO0FBRS9DLGFBQUssYUFBYTtBQUFBLE1BQ3BCO0FBQUEsTUFDQSxNQUFNLFlBQVksTUFBTTtBQUN0QixZQUFJLEtBQUssT0FBTyxnQkFBZ0I7QUFDOUIsaUJBQU8sTUFBTSxLQUFLLE9BQU8sZUFBZSxJQUFJO0FBQUEsUUFDOUMsT0FBTztBQUVMLGdCQUFNLElBQUksTUFBTSx3QkFBd0I7QUFBQSxRQUMxQztBQUFBLE1BQ0Y7QUFBQSxNQUNBLE1BQU0sTUFBTSxNQUFNO0FBQ2hCLFlBQUksS0FBSyxPQUFPLGVBQWU7QUFDN0IsaUJBQU8sTUFBTSxLQUFLLE9BQU8sY0FBYyxJQUFJO0FBQUEsUUFDN0MsT0FBTztBQUVMLGdCQUFNLElBQUksTUFBTSx1QkFBdUI7QUFBQSxRQUN6QztBQUFBLE1BQ0Y7QUFBQSxNQUNBLE1BQU0sVUFBVSxNQUFNO0FBQ3BCLFlBQUksS0FBSyxPQUFPLGNBQWM7QUFDNUIsaUJBQU8sTUFBTSxLQUFLLE9BQU8sYUFBYSxJQUFJO0FBQUEsUUFDNUMsT0FBTztBQUVMLGdCQUFNLElBQUksTUFBTSxzQkFBc0I7QUFBQSxRQUN4QztBQUFBLE1BQ0Y7QUFBQSxNQUNBLE1BQU0sT0FBTyxVQUFVLFVBQVU7QUFDL0IsWUFBSSxLQUFLLE9BQU8sZ0JBQWdCO0FBQzlCLGlCQUFPLE1BQU0sS0FBSyxPQUFPLGVBQWUsVUFBVSxRQUFRO0FBQUEsUUFDNUQsT0FBTztBQUVMLGdCQUFNLElBQUksTUFBTSx3QkFBd0I7QUFBQSxRQUMxQztBQUFBLE1BQ0Y7QUFBQSxNQUNBLE1BQU0sS0FBSyxNQUFNO0FBQ2YsWUFBSSxLQUFLLE9BQU8sY0FBYztBQUM1QixpQkFBTyxNQUFNLEtBQUssT0FBTyxhQUFhLElBQUk7QUFBQSxRQUM1QyxPQUFPO0FBRUwsZ0JBQU0sSUFBSSxNQUFNLHNCQUFzQjtBQUFBLFFBQ3hDO0FBQUEsTUFDRjtBQUFBLE1BQ0EsTUFBTSxXQUFXLE1BQU0sTUFBTTtBQUMzQixZQUFJLEtBQUssT0FBTyxlQUFlO0FBQzdCLGlCQUFPLE1BQU0sS0FBSyxPQUFPLGNBQWMsTUFBTSxJQUFJO0FBQUEsUUFDbkQsT0FBTztBQUVMLGdCQUFNLElBQUksTUFBTSx1QkFBdUI7QUFBQSxRQUN6QztBQUFBLE1BQ0Y7QUFBQSxNQUNBLE1BQU0sS0FBSyxVQUFVLEdBQUc7QUFDdEIsWUFBSTtBQUNGLGdCQUFNLGtCQUFrQixNQUFNLEtBQUssVUFBVSxLQUFLLFNBQVM7QUFFM0QsZUFBSyxhQUFhLEtBQUssTUFBTSxlQUFlO0FBQzVDLGtCQUFRLElBQUksNkJBQTJCLEtBQUssU0FBUztBQUNyRCxpQkFBTztBQUFBLFFBQ1QsU0FBUyxPQUFQO0FBRUEsY0FBSSxVQUFVLEdBQUc7QUFDZixvQkFBUSxJQUFJLGlCQUFpQjtBQUU3QixrQkFBTSxJQUFJLFFBQVEsT0FBSyxXQUFXLEdBQUcsTUFBUSxNQUFPLE9BQVEsQ0FBQztBQUM3RCxtQkFBTyxNQUFNLEtBQUssS0FBSyxVQUFVLENBQUM7QUFBQSxVQVNwQztBQUNBLGtCQUFRLElBQUksb0VBQW9FO0FBQ2hGLGlCQUFPO0FBQUEsUUFDVDtBQUFBLE1BQ0Y7QUFBQSxNQUVBLE1BQU0sdUJBQXVCO0FBRTNCLFlBQUksQ0FBRSxNQUFNLEtBQUssWUFBWSxLQUFLLFdBQVcsR0FBSTtBQUUvQyxnQkFBTSxLQUFLLE1BQU0sS0FBSyxXQUFXO0FBQ2pDLGtCQUFRLElBQUkscUJBQW1CLEtBQUssV0FBVztBQUFBLFFBQ2pELE9BQU87QUFDTCxrQkFBUSxJQUFJLDRCQUEwQixLQUFLLFdBQVc7QUFBQSxRQUN4RDtBQUVBLFlBQUksQ0FBRSxNQUFNLEtBQUssWUFBWSxLQUFLLFNBQVMsR0FBSTtBQUU3QyxnQkFBTSxLQUFLLFdBQVcsS0FBSyxXQUFXLElBQUk7QUFDMUMsa0JBQVEsSUFBSSw4QkFBNEIsS0FBSyxTQUFTO0FBQUEsUUFDeEQsT0FBTztBQUNMLGtCQUFRLElBQUkscUNBQW1DLEtBQUssU0FBUztBQUFBLFFBQy9EO0FBQUEsTUFDRjtBQUFBLE1BRUEsTUFBTSxPQUFPO0FBQ1gsY0FBTSxhQUFhLEtBQUssVUFBVSxLQUFLLFVBQVU7QUFFakQsY0FBTSx5QkFBeUIsTUFBTSxLQUFLLFlBQVksS0FBSyxTQUFTO0FBRXBFLFlBQUksd0JBQXdCO0FBRTFCLGdCQUFNLGdCQUFnQixXQUFXO0FBRWpDLGdCQUFNLHFCQUFxQixNQUFNLEtBQUssS0FBSyxLQUFLLFNBQVMsRUFBRSxLQUFLLENBQUMsU0FBUyxLQUFLLElBQUk7QUFJbkYsY0FBSSxnQkFBaUIscUJBQXFCLEtBQU07QUFFOUMsa0JBQU0sS0FBSyxXQUFXLEtBQUssV0FBVyxVQUFVO0FBQ2hELG9CQUFRLElBQUksMkJBQTJCLGdCQUFnQixRQUFRO0FBQUEsVUFDakUsT0FBTztBQUdMLGtCQUFNLGtCQUFrQjtBQUFBLGNBQ3RCO0FBQUEsY0FDQTtBQUFBLGNBQ0Esb0JBQW9CLGdCQUFnQjtBQUFBLGNBQ3BDLHlCQUF5QixxQkFBcUI7QUFBQSxjQUM5QztBQUFBLFlBQ0Y7QUFDQSxvQkFBUSxJQUFJLGdCQUFnQixLQUFLLEdBQUcsQ0FBQztBQUVyQyxrQkFBTSxLQUFLLFdBQVcsS0FBSyxjQUFZLDRCQUE0QixVQUFVO0FBQzdFLGtCQUFNLElBQUksTUFBTSxvSkFBb0o7QUFBQSxVQUN0SztBQUFBLFFBQ0YsT0FBTztBQUNMLGdCQUFNLEtBQUsscUJBQXFCO0FBQ2hDLGlCQUFPLE1BQU0sS0FBSyxLQUFLO0FBQUEsUUFDekI7QUFDQSxlQUFPO0FBQUEsTUFDVDtBQUFBLE1BQ0EsUUFBUSxTQUFTLFNBQVM7QUFDeEIsWUFBSSxhQUFhO0FBQ2pCLFlBQUksUUFBUTtBQUNaLFlBQUksUUFBUTtBQUNaLGlCQUFTLElBQUksR0FBRyxJQUFJLFFBQVEsUUFBUSxLQUFLO0FBQ3ZDLHdCQUFjLFFBQVEsQ0FBQyxJQUFJLFFBQVEsQ0FBQztBQUNwQyxtQkFBUyxRQUFRLENBQUMsSUFBSSxRQUFRLENBQUM7QUFDL0IsbUJBQVMsUUFBUSxDQUFDLElBQUksUUFBUSxDQUFDO0FBQUEsUUFDakM7QUFDQSxZQUFJLFVBQVUsS0FBSyxVQUFVLEdBQUc7QUFDOUIsaUJBQU87QUFBQSxRQUNULE9BQU87QUFDTCxpQkFBTyxjQUFjLEtBQUssS0FBSyxLQUFLLElBQUksS0FBSyxLQUFLLEtBQUs7QUFBQSxRQUN6RDtBQUFBLE1BQ0Y7QUFBQSxNQUNBLFFBQVEsUUFBUSxTQUFTLENBQUMsR0FBRztBQUMzQixpQkFBUztBQUFBLFVBQ1AsZUFBZTtBQUFBLFVBQ2YsR0FBRztBQUFBLFFBQ0w7QUFDQSxZQUFJLFVBQVUsQ0FBQztBQUNmLGNBQU0sWUFBWSxPQUFPLEtBQUssS0FBSyxVQUFVO0FBRTdDLGlCQUFTLElBQUksR0FBRyxJQUFJLFVBQVUsUUFBUSxLQUFLO0FBRXpDLGNBQUksT0FBTyxlQUFlO0FBQ3hCLGtCQUFNLFlBQVksS0FBSyxXQUFXLFVBQVUsQ0FBQyxDQUFDLEVBQUUsS0FBSztBQUNyRCxnQkFBSSxVQUFVLFFBQVEsR0FBRyxJQUFJO0FBQUk7QUFBQSxVQUduQztBQUNBLGNBQUksT0FBTyxVQUFVO0FBQ25CLGdCQUFJLE9BQU8sYUFBYSxVQUFVLENBQUM7QUFBRztBQUN0QyxnQkFBSSxPQUFPLGFBQWEsS0FBSyxXQUFXLFVBQVUsQ0FBQyxDQUFDLEVBQUUsS0FBSztBQUFRO0FBQUEsVUFDckU7QUFFQSxjQUFJLE9BQU8sa0JBQWtCO0FBRTNCLGdCQUFJLE9BQU8sT0FBTyxxQkFBcUIsWUFBWSxDQUFDLEtBQUssV0FBVyxVQUFVLENBQUMsQ0FBQyxFQUFFLEtBQUssS0FBSyxXQUFXLE9BQU8sZ0JBQWdCO0FBQUc7QUFFakksZ0JBQUksTUFBTSxRQUFRLE9BQU8sZ0JBQWdCLEtBQUssQ0FBQyxPQUFPLGlCQUFpQixLQUFLLENBQUMsU0FBUyxLQUFLLFdBQVcsVUFBVSxDQUFDLENBQUMsRUFBRSxLQUFLLEtBQUssV0FBVyxJQUFJLENBQUM7QUFBRztBQUFBLFVBQ25KO0FBRUEsa0JBQVEsS0FBSztBQUFBLFlBQ1gsTUFBTSxLQUFLLFdBQVcsVUFBVSxDQUFDLENBQUMsRUFBRSxLQUFLO0FBQUEsWUFDekMsWUFBWSxLQUFLLFFBQVEsUUFBUSxLQUFLLFdBQVcsVUFBVSxDQUFDLENBQUMsRUFBRSxHQUFHO0FBQUEsWUFDbEUsTUFBTSxLQUFLLFdBQVcsVUFBVSxDQUFDLENBQUMsRUFBRSxLQUFLO0FBQUEsVUFDM0MsQ0FBQztBQUFBLFFBQ0g7QUFFQSxnQkFBUSxLQUFLLFNBQVUsR0FBRyxHQUFHO0FBQzNCLGlCQUFPLEVBQUUsYUFBYSxFQUFFO0FBQUEsUUFDMUIsQ0FBQztBQUdELGtCQUFVLFFBQVEsTUFBTSxHQUFHLE9BQU8sYUFBYTtBQUMvQyxlQUFPO0FBQUEsTUFDVDtBQUFBLE1BQ0Esd0JBQXdCLFFBQVEsU0FBTyxDQUFDLEdBQUc7QUFDekMsY0FBTSxpQkFBaUI7QUFBQSxVQUNyQixLQUFLLEtBQUs7QUFBQSxRQUNaO0FBQ0EsaUJBQVMsRUFBQyxHQUFHLGdCQUFnQixHQUFHLE9BQU07QUFHdEMsWUFBRyxNQUFNLFFBQVEsTUFBTSxLQUFLLE9BQU8sV0FBVyxLQUFLLFNBQVE7QUFDekQsZUFBSyxVQUFVLENBQUM7QUFDaEIsbUJBQVEsSUFBSSxHQUFHLElBQUksT0FBTyxRQUFRLEtBQUk7QUFJcEMsaUJBQUssd0JBQXdCLE9BQU8sQ0FBQyxHQUFHO0FBQUEsY0FDdEMsS0FBSyxLQUFLLE1BQU0sT0FBTyxNQUFNLE9BQU8sTUFBTTtBQUFBLFlBQzVDLENBQUM7QUFBQSxVQUNIO0FBQUEsUUFDRixPQUFLO0FBQ0gsZ0JBQU0sWUFBWSxPQUFPLEtBQUssS0FBSyxVQUFVO0FBQzdDLG1CQUFTLElBQUksR0FBRyxJQUFJLFVBQVUsUUFBUSxLQUFLO0FBQ3pDLGdCQUFHLEtBQUssY0FBYyxLQUFLLFdBQVcsVUFBVSxDQUFDLENBQUMsQ0FBQztBQUFHO0FBQ3RELGtCQUFNLE1BQU0sS0FBSyx3QkFBd0IsUUFBUSxLQUFLLFdBQVcsVUFBVSxDQUFDLENBQUMsRUFBRSxHQUFHO0FBQ2xGLGdCQUFHLEtBQUssUUFBUSxVQUFVLENBQUMsQ0FBQyxHQUFFO0FBQzVCLG1CQUFLLFFBQVEsVUFBVSxDQUFDLENBQUMsS0FBSztBQUFBLFlBQ2hDLE9BQUs7QUFDSCxtQkFBSyxRQUFRLFVBQVUsQ0FBQyxDQUFDLElBQUk7QUFBQSxZQUMvQjtBQUFBLFVBQ0Y7QUFBQSxRQUNGO0FBRUEsWUFBSSxVQUFVLE9BQU8sS0FBSyxLQUFLLE9BQU8sRUFBRSxJQUFJLFNBQU87QUFDakQsaUJBQU87QUFBQSxZQUNMO0FBQUEsWUFDQSxZQUFZLEtBQUssUUFBUSxHQUFHO0FBQUEsVUFDOUI7QUFBQSxRQUNGLENBQUM7QUFFRCxrQkFBVSxLQUFLLG1CQUFtQixPQUFPO0FBQ3pDLGtCQUFVLFFBQVEsTUFBTSxHQUFHLE9BQU8sR0FBRztBQUVyQyxrQkFBVSxRQUFRLElBQUksVUFBUTtBQUM1QixpQkFBTztBQUFBLFlBQ0wsTUFBTSxLQUFLLFdBQVcsS0FBSyxHQUFHLEVBQUUsS0FBSztBQUFBLFlBQ3JDLFlBQVksS0FBSztBQUFBLFlBQ2pCLEtBQUssS0FBSyxXQUFXLEtBQUssR0FBRyxFQUFFLEtBQUssT0FBTyxLQUFLLFdBQVcsS0FBSyxHQUFHLEVBQUUsS0FBSztBQUFBLFVBQzVFO0FBQUEsUUFDRixDQUFDO0FBQ0QsZUFBTztBQUFBLE1BQ1Q7QUFBQSxNQUNBLG1CQUFtQixTQUFTO0FBQzFCLGVBQU8sUUFBUSxLQUFLLFNBQVUsR0FBRyxHQUFHO0FBQ2xDLGdCQUFNLFVBQVUsRUFBRTtBQUNsQixnQkFBTSxVQUFVLEVBQUU7QUFFbEIsY0FBSSxVQUFVO0FBQ1osbUJBQU87QUFFVCxjQUFJLFVBQVU7QUFDWixtQkFBTztBQUVULGlCQUFPO0FBQUEsUUFDVCxDQUFDO0FBQUEsTUFDSDtBQUFBO0FBQUEsTUFFQSxvQkFBb0IsT0FBTztBQUN6QixnQkFBUSxJQUFJLHdCQUF3QjtBQUNwQyxjQUFNLE9BQU8sT0FBTyxLQUFLLEtBQUssVUFBVTtBQUN4QyxZQUFJLHFCQUFxQjtBQUN6QixtQkFBVyxPQUFPLE1BQU07QUFFdEIsZ0JBQU0sT0FBTyxLQUFLLFdBQVcsR0FBRyxFQUFFLEtBQUs7QUFFdkMsY0FBRyxDQUFDLE1BQU0sS0FBSyxVQUFRLEtBQUssV0FBVyxLQUFLLElBQUksQ0FBQyxHQUFHO0FBRWxELG1CQUFPLEtBQUssV0FBVyxHQUFHO0FBQzFCO0FBRUE7QUFBQSxVQUNGO0FBRUEsY0FBRyxLQUFLLFFBQVEsR0FBRyxJQUFJLElBQUk7QUFDekIsa0JBQU0sYUFBYSxLQUFLLFdBQVcsR0FBRyxFQUFFLEtBQUs7QUFFN0MsZ0JBQUcsQ0FBQyxLQUFLLFdBQVcsVUFBVSxHQUFFO0FBRTlCLHFCQUFPLEtBQUssV0FBVyxHQUFHO0FBQzFCO0FBRUE7QUFBQSxZQUNGO0FBRUEsZ0JBQUcsQ0FBQyxLQUFLLFdBQVcsVUFBVSxFQUFFLE1BQUs7QUFFbkMscUJBQU8sS0FBSyxXQUFXLEdBQUc7QUFDMUI7QUFFQTtBQUFBLFlBQ0Y7QUFHQSxnQkFBRyxLQUFLLFdBQVcsVUFBVSxFQUFFLEtBQUssWUFBYSxLQUFLLFdBQVcsVUFBVSxFQUFFLEtBQUssU0FBUyxRQUFRLEdBQUcsSUFBSSxHQUFJO0FBRTVHLHFCQUFPLEtBQUssV0FBVyxHQUFHO0FBQzFCO0FBRUE7QUFBQSxZQUNGO0FBQUEsVUFDRjtBQUFBLFFBQ0Y7QUFDQSxlQUFPLEVBQUMsb0JBQXdDLGtCQUFrQixLQUFLLE9BQU07QUFBQSxNQUMvRTtBQUFBLE1BRUEsSUFBSSxLQUFLO0FBQ1AsZUFBTyxLQUFLLFdBQVcsR0FBRyxLQUFLO0FBQUEsTUFDakM7QUFBQSxNQUNBLFNBQVMsS0FBSztBQUNaLGNBQU0sWUFBWSxLQUFLLElBQUksR0FBRztBQUM5QixZQUFHLGFBQWEsVUFBVSxNQUFNO0FBQzlCLGlCQUFPLFVBQVU7QUFBQSxRQUNuQjtBQUNBLGVBQU87QUFBQSxNQUNUO0FBQUEsTUFDQSxVQUFVLEtBQUs7QUFDYixjQUFNLE9BQU8sS0FBSyxTQUFTLEdBQUc7QUFDOUIsWUFBRyxRQUFRLEtBQUssT0FBTztBQUNyQixpQkFBTyxLQUFLO0FBQUEsUUFDZDtBQUNBLGVBQU87QUFBQSxNQUNUO0FBQUEsTUFDQSxTQUFTLEtBQUs7QUFDWixjQUFNLE9BQU8sS0FBSyxTQUFTLEdBQUc7QUFDOUIsWUFBRyxRQUFRLEtBQUssTUFBTTtBQUNwQixpQkFBTyxLQUFLO0FBQUEsUUFDZDtBQUNBLGVBQU87QUFBQSxNQUNUO0FBQUEsTUFDQSxTQUFTLEtBQUs7QUFDWixjQUFNLE9BQU8sS0FBSyxTQUFTLEdBQUc7QUFDOUIsWUFBRyxRQUFRLEtBQUssTUFBTTtBQUNwQixpQkFBTyxLQUFLO0FBQUEsUUFDZDtBQUNBLGVBQU87QUFBQSxNQUNUO0FBQUEsTUFDQSxhQUFhLEtBQUs7QUFDaEIsY0FBTSxPQUFPLEtBQUssU0FBUyxHQUFHO0FBQzlCLFlBQUcsUUFBUSxLQUFLLFVBQVU7QUFDeEIsaUJBQU8sS0FBSztBQUFBLFFBQ2Q7QUFDQSxlQUFPO0FBQUEsTUFDVDtBQUFBLE1BQ0EsUUFBUSxLQUFLO0FBQ1gsY0FBTSxZQUFZLEtBQUssSUFBSSxHQUFHO0FBQzlCLFlBQUcsYUFBYSxVQUFVLEtBQUs7QUFDN0IsaUJBQU8sVUFBVTtBQUFBLFFBQ25CO0FBQ0EsZUFBTztBQUFBLE1BQ1Q7QUFBQSxNQUNBLGVBQWUsS0FBSyxLQUFLLE1BQU07QUFDN0IsYUFBSyxXQUFXLEdBQUcsSUFBSTtBQUFBLFVBQ3JCO0FBQUEsVUFDQTtBQUFBLFFBQ0Y7QUFBQSxNQUNGO0FBQUEsTUFDQSxpQkFBaUIsS0FBSyxjQUFjO0FBQ2xDLGNBQU0sUUFBUSxLQUFLLFVBQVUsR0FBRztBQUNoQyxZQUFHLFNBQVMsU0FBUyxjQUFjO0FBQ2pDLGlCQUFPO0FBQUEsUUFDVDtBQUNBLGVBQU87QUFBQSxNQUNUO0FBQUEsTUFFQSxNQUFNLGdCQUFnQjtBQUNwQixhQUFLLGFBQWE7QUFDbEIsYUFBSyxhQUFhLENBQUM7QUFFbkIsWUFBSSxtQkFBbUIsS0FBSyxNQUFNLEtBQUssSUFBSSxJQUFJLEdBQUk7QUFFbkQsY0FBTSxLQUFLLE9BQU8sS0FBSyxXQUFXLEtBQUssY0FBYyxpQkFBaUIsbUJBQW1CLE9BQU87QUFFaEcsY0FBTSxLQUFLLHFCQUFxQjtBQUFBLE1BQ2xDO0FBQUEsSUFDRjtBQUVBLElBQUFELFFBQU8sVUFBVUM7QUFBQTtBQUFBOzs7QUMxWWpCLElBQU0sV0FBVyxRQUFRLFVBQVU7QUFDbkMsSUFBTSxVQUFVO0FBRWhCLElBQU0sbUJBQW1CO0FBQUEsRUFDdkIsU0FBUztBQUFBLEVBQ1QsV0FBVztBQUFBLEVBQ1gsaUJBQWlCO0FBQUEsRUFDakIsbUJBQW1CO0FBQUEsRUFDbkIsbUJBQW1CO0FBQUEsRUFDbkIsV0FBVztBQUFBLEVBQ1gsZ0JBQWdCO0FBQUEsRUFDaEIsZUFBZTtBQUFBLEVBQ2YsdUJBQXVCO0FBQUEsRUFDdkIsVUFBVTtBQUFBLEVBQ1YsWUFBWTtBQUFBLEVBQ1osa0JBQWtCO0FBQUEsRUFDbEIsNEJBQTRCO0FBQUEsRUFDNUIsZUFBZTtBQUFBLEVBQ2Ysa0JBQWtCO0FBQUEsRUFDbEIsV0FBVztBQUFBLEVBQ1gsU0FBUztBQUNYO0FBQ0EsSUFBTSwwQkFBMEI7QUFFaEMsSUFBSTtBQUNKLElBQU0sdUJBQXVCLENBQUMsTUFBTSxRQUFRO0FBSTVDLElBQU0sb0JBQW9CO0FBQUEsRUFDeEIsTUFBTTtBQUFBLElBQ0osV0FBVyxDQUFDLE1BQU0sS0FBSyxNQUFNLFFBQVEsT0FBTyxRQUFRLE1BQU0sSUFBSTtBQUFBLElBQzlELFVBQVU7QUFBQSxJQUNWLG1CQUFtQjtBQUFBLEVBQ3JCO0FBQUEsRUFDQSxNQUFNO0FBQUEsSUFDSixXQUFXLENBQUMsTUFBTSxNQUFNLFNBQU0sT0FBSTtBQUFBLElBQ2xDLFVBQVU7QUFBQSxJQUNWLG1CQUFtQjtBQUFBLEVBQ3JCO0FBQUEsRUFDQSxNQUFNO0FBQUEsSUFDSixXQUFXLENBQUMsTUFBTSxPQUFPLE1BQU0sT0FBTyxPQUFPLFFBQVEsU0FBUyxPQUFPLE1BQU0sTUFBTSxJQUFJO0FBQUEsSUFDckYsVUFBVTtBQUFBLElBQ1YsbUJBQW1CO0FBQUEsRUFDckI7QUFBQSxFQUNBLE1BQU07QUFBQSxJQUNKLFdBQVcsQ0FBQyxRQUFRLFNBQVMsVUFBVSxVQUFVLFVBQVUsT0FBTyxPQUFPLFNBQVMsV0FBVyxXQUFXLFNBQVM7QUFBQSxJQUNqSCxVQUFVO0FBQUEsSUFDVixtQkFBbUI7QUFBQSxFQUNyQjtBQUFBLEVBQ0EsTUFBTTtBQUFBLElBQ0osV0FBVyxDQUFDLE9BQU8sT0FBTyxRQUFRLE9BQU8sT0FBTyxVQUFVLFVBQVUsVUFBVSxRQUFRO0FBQUEsSUFDdEYsVUFBVTtBQUFBLElBQ1YsbUJBQW1CO0FBQUEsRUFDckI7QUFDRjtBQUdBLElBQU0sU0FBUyxRQUFRLFFBQVE7QUFFL0IsU0FBUyxJQUFJLEtBQUs7QUFDaEIsU0FBTyxPQUFPLFdBQVcsS0FBSyxFQUFFLE9BQU8sR0FBRyxFQUFFLE9BQU8sS0FBSztBQUMxRDtBQUVBLElBQU0seUJBQU4sY0FBcUMsU0FBUyxPQUFPO0FBQUE7QUFBQSxFQUVuRCxjQUFjO0FBQ1osVUFBTSxHQUFHLFNBQVM7QUFDbEIsU0FBSyxNQUFNO0FBQ1gsU0FBSyxvQkFBb0I7QUFDekIsU0FBSyxrQkFBa0IsQ0FBQztBQUN4QixTQUFLLFVBQVUsQ0FBQztBQUNoQixTQUFLLHFCQUFxQjtBQUMxQixTQUFLLG9CQUFvQixDQUFDO0FBQzFCLFNBQUssZ0JBQWdCLENBQUM7QUFDdEIsU0FBSyxZQUFZLENBQUM7QUFDbEIsU0FBSyxhQUFhLENBQUM7QUFDbkIsU0FBSyxXQUFXLHFCQUFxQjtBQUNyQyxTQUFLLFdBQVcsa0JBQWtCLENBQUM7QUFDbkMsU0FBSyxXQUFXLG9CQUFvQixDQUFDO0FBQ3JDLFNBQUssV0FBVyxRQUFRLENBQUM7QUFDekIsU0FBSyxXQUFXLGlCQUFpQjtBQUNqQyxTQUFLLFdBQVcsb0JBQW9CLENBQUM7QUFDckMsU0FBSyxXQUFXLGNBQWM7QUFDOUIsU0FBSyxXQUFXLHdCQUF3QjtBQUN4QyxTQUFLLHVCQUF1QjtBQUM1QixTQUFLLGVBQWU7QUFDcEIsU0FBSyxjQUFjLENBQUM7QUFDcEIsU0FBSyxvQkFBb0I7QUFDekIsU0FBSyxtQkFBbUI7QUFBQSxFQUMxQjtBQUFBLEVBRUEsTUFBTSxTQUFTO0FBRWIsU0FBSyxJQUFJLFVBQVUsY0FBYyxLQUFLLFdBQVcsS0FBSyxJQUFJLENBQUM7QUFBQSxFQUM3RDtBQUFBLEVBQ0EsV0FBVztBQUNULFNBQUssa0JBQWtCO0FBQ3ZCLFlBQVEsSUFBSSxrQkFBa0I7QUFBQSxFQUNoQztBQUFBLEVBQ0EsTUFBTSxhQUFhO0FBQ2pCLFlBQVEsSUFBSSxrQ0FBa0M7QUFDOUMsY0FBVSxLQUFLLFNBQVM7QUFHeEIsVUFBTSxLQUFLLGFBQWE7QUFFeEIsZUFBVyxLQUFLLGlCQUFpQixLQUFLLElBQUksR0FBRyxHQUFJO0FBRWpELGdCQUFZLEtBQUssaUJBQWlCLEtBQUssSUFBSSxHQUFHLEtBQVE7QUFFdEQsU0FBSyxRQUFRO0FBQ2IsU0FBSyxXQUFXO0FBQUEsTUFDZCxJQUFJO0FBQUEsTUFDSixNQUFNO0FBQUEsTUFDTixNQUFNO0FBQUEsTUFDTixTQUFTLENBQUM7QUFBQTtBQUFBLE1BRVYsZ0JBQWdCLE9BQU8sV0FBVztBQUNoQyxZQUFHLE9BQU8sa0JBQWtCLEdBQUc7QUFFN0IsY0FBSSxnQkFBZ0IsT0FBTyxhQUFhO0FBRXhDLGdCQUFNLEtBQUssaUJBQWlCLGFBQWE7QUFBQSxRQUMzQyxPQUFPO0FBRUwsZUFBSyxnQkFBZ0IsQ0FBQztBQUV0QixnQkFBTSxLQUFLLGlCQUFpQjtBQUFBLFFBQzlCO0FBQUEsTUFDRjtBQUFBLElBQ0YsQ0FBQztBQUNELFNBQUssV0FBVztBQUFBLE1BQ2QsSUFBSTtBQUFBLE1BQ0osTUFBTTtBQUFBLE1BQ04sVUFBVSxNQUFNO0FBQ2QsYUFBSyxVQUFVO0FBQUEsTUFDakI7QUFBQSxJQUNGLENBQUM7QUFFRCxTQUFLLFdBQVc7QUFBQSxNQUNkLElBQUk7QUFBQSxNQUNKLE1BQU07QUFBQSxNQUNOLFVBQVUsTUFBTTtBQUNkLGFBQUssVUFBVTtBQUFBLE1BQ2pCO0FBQUEsSUFDRixDQUFDO0FBRUQsU0FBSyxXQUFXO0FBQUEsTUFDZCxJQUFJO0FBQUEsTUFDSixNQUFNO0FBQUEsTUFDTixVQUFVLE1BQU07QUFDZCxhQUFLLGlCQUFpQjtBQUFBLE1BQ3hCO0FBQUEsSUFDRixDQUFDO0FBRUQsU0FBSyxjQUFjLElBQUksNEJBQTRCLEtBQUssS0FBSyxJQUFJLENBQUM7QUFFbEUsU0FBSyxhQUFhLDZCQUE2QixDQUFDLFNBQVUsSUFBSSxxQkFBcUIsTUFBTSxJQUFJLENBQUU7QUFFL0YsU0FBSyxhQUFhLGtDQUFrQyxDQUFDLFNBQVUsSUFBSSx5QkFBeUIsTUFBTSxJQUFJLENBQUU7QUFFeEcsU0FBSyxtQ0FBbUMscUJBQXFCLEtBQUssa0JBQWtCLEtBQUssSUFBSSxDQUFDO0FBRzlGLFFBQUcsS0FBSyxTQUFTLFdBQVc7QUFDMUIsV0FBSyxVQUFVO0FBQUEsSUFDakI7QUFFQSxRQUFHLEtBQUssU0FBUyxXQUFXO0FBQzFCLFdBQUssVUFBVTtBQUFBLElBQ2pCO0FBRUEsUUFBRyxLQUFLLFNBQVMsWUFBWSxTQUFTO0FBQ3BDLFdBQUssU0FBUyxrQkFBa0I7QUFFaEMsV0FBSyxTQUFTLFVBQVU7QUFFeEIsWUFBTSxLQUFLLGFBQWE7QUFFeEIsV0FBSyxVQUFVO0FBQUEsSUFDakI7QUFFQSxTQUFLLGlCQUFpQjtBQU10QixTQUFLLE1BQU0sSUFBSSxZQUFZLEtBQUssS0FBSyxJQUFJO0FBRXpDLEtBQUMsT0FBTyxnQkFBZ0IsSUFBSSxLQUFLLFFBQVEsS0FBSyxTQUFTLE1BQU0sT0FBTyxPQUFPLGdCQUFnQixDQUFDO0FBQUEsRUFFOUY7QUFBQSxFQUVBLE1BQU0sWUFBWTtBQUNoQixTQUFLLGlCQUFpQixJQUFJLFFBQVE7QUFBQSxNQUNoQyxhQUFhO0FBQUEsTUFDYixnQkFBZ0IsS0FBSyxJQUFJLE1BQU0sUUFBUSxPQUFPLEtBQUssS0FBSyxJQUFJLE1BQU0sT0FBTztBQUFBLE1BQ3pFLGVBQWUsS0FBSyxJQUFJLE1BQU0sUUFBUSxNQUFNLEtBQUssS0FBSyxJQUFJLE1BQU0sT0FBTztBQUFBLE1BQ3ZFLGNBQWMsS0FBSyxJQUFJLE1BQU0sUUFBUSxLQUFLLEtBQUssS0FBSyxJQUFJLE1BQU0sT0FBTztBQUFBLE1BQ3JFLGdCQUFnQixLQUFLLElBQUksTUFBTSxRQUFRLE9BQU8sS0FBSyxLQUFLLElBQUksTUFBTSxPQUFPO0FBQUEsTUFDekUsY0FBYyxLQUFLLElBQUksTUFBTSxRQUFRLEtBQUssS0FBSyxLQUFLLElBQUksTUFBTSxPQUFPO0FBQUEsTUFDckUsZUFBZSxLQUFLLElBQUksTUFBTSxRQUFRLE1BQU0sS0FBSyxLQUFLLElBQUksTUFBTSxPQUFPO0FBQUEsSUFDekUsQ0FBQztBQUNELFNBQUssb0JBQW9CLE1BQU0sS0FBSyxlQUFlLEtBQUs7QUFDeEQsV0FBTyxLQUFLO0FBQUEsRUFDZDtBQUFBLEVBQ0EsTUFBTSxlQUFlO0FBRW5CLFFBQUcsQ0FBQyxLQUFLLFNBQVM7QUFBYSxhQUFPLElBQUksU0FBUyxPQUFPLDJFQUEyRTtBQUVySSxVQUFNLEtBQUssT0FBTyxHQUFHLFNBQVMsWUFBWTtBQUFBLE1BQ3hDLEtBQUs7QUFBQSxNQUNMLFFBQVE7QUFBQSxNQUNSLFNBQVM7QUFBQSxRQUNQLGdCQUFnQjtBQUFBLE1BQ2xCO0FBQUEsTUFDQSxNQUFNLEtBQUssVUFBVTtBQUFBLFFBQ25CLGFBQWEsS0FBSyxTQUFTO0FBQUEsTUFDN0IsQ0FBQztBQUFBLElBQ0gsQ0FBQztBQUNELFFBQUcsR0FBRyxXQUFXO0FBQUssYUFBTyxRQUFRLE1BQU0sK0JBQStCLEVBQUU7QUFDNUUsWUFBUSxJQUFJLEVBQUU7QUFDZCxVQUFNLEtBQUssSUFBSSxNQUFNLFFBQVEsTUFBTSwrQ0FBK0MsR0FBRyxLQUFLLElBQUk7QUFDOUYsVUFBTSxLQUFLLElBQUksTUFBTSxRQUFRLE1BQU0scURBQXFELEdBQUcsS0FBSyxRQUFRO0FBQ3hHLFVBQU0sS0FBSyxJQUFJLE1BQU0sUUFBUSxNQUFNLGtEQUFrRCxHQUFHLEtBQUssTUFBTTtBQUNuRyxXQUFPLGlCQUFpQixPQUFPLE9BQU87QUFDcEMsY0FBUSxJQUFJLHFCQUFxQixFQUFFO0FBQ25DLFlBQU0sT0FBTyxJQUFJLFFBQVEsY0FBYyxFQUFFO0FBQ3pDLFlBQU0sT0FBTyxJQUFJLFFBQVEsYUFBYSxFQUFFO0FBQ3hDLGNBQVEsSUFBSSxvQkFBb0IsRUFBRTtBQUFBLElBQ3BDO0FBQ0EsV0FBTyxlQUFlLEtBQUssU0FBUyxFQUFFO0FBQUEsRUFDeEM7QUFBQSxFQUVBLE1BQU0sZUFBZTtBQUNuQixTQUFLLFdBQVcsT0FBTyxPQUFPLENBQUMsR0FBRyxrQkFBa0IsTUFBTSxLQUFLLFNBQVMsQ0FBQztBQUV6RSxRQUFHLEtBQUssU0FBUyxtQkFBbUIsS0FBSyxTQUFTLGdCQUFnQixTQUFTLEdBQUc7QUFFNUUsV0FBSyxrQkFBa0IsS0FBSyxTQUFTLGdCQUFnQixNQUFNLEdBQUcsRUFBRSxJQUFJLENBQUMsU0FBUztBQUM1RSxlQUFPLEtBQUssS0FBSztBQUFBLE1BQ25CLENBQUM7QUFBQSxJQUNIO0FBRUEsUUFBRyxLQUFLLFNBQVMscUJBQXFCLEtBQUssU0FBUyxrQkFBa0IsU0FBUyxHQUFHO0FBRWhGLFlBQU0sb0JBQW9CLEtBQUssU0FBUyxrQkFBa0IsTUFBTSxHQUFHLEVBQUUsSUFBSSxDQUFDLFdBQVc7QUFFbkYsaUJBQVMsT0FBTyxLQUFLO0FBQ3JCLFlBQUcsT0FBTyxNQUFNLEVBQUUsTUFBTSxLQUFLO0FBQzNCLGlCQUFPLFNBQVM7QUFBQSxRQUNsQixPQUFPO0FBQ0wsaUJBQU87QUFBQSxRQUNUO0FBQUEsTUFDRixDQUFDO0FBRUQsV0FBSyxrQkFBa0IsS0FBSyxnQkFBZ0IsT0FBTyxpQkFBaUI7QUFBQSxJQUN0RTtBQUVBLFFBQUcsS0FBSyxTQUFTLHFCQUFxQixLQUFLLFNBQVMsa0JBQWtCLFNBQVMsR0FBRztBQUNoRixXQUFLLG9CQUFvQixLQUFLLFNBQVMsa0JBQWtCLE1BQU0sR0FBRyxFQUFFLElBQUksQ0FBQyxXQUFXO0FBQ2xGLGVBQU8sT0FBTyxLQUFLO0FBQUEsTUFDckIsQ0FBQztBQUFBLElBQ0g7QUFFQSxRQUFHLEtBQUssU0FBUyxhQUFhLEtBQUssU0FBUyxVQUFVLFNBQVMsR0FBRztBQUNoRSxXQUFLLFlBQVksS0FBSyxTQUFTLFVBQVUsTUFBTSxHQUFHLEVBQUUsSUFBSSxDQUFDLFNBQVM7QUFDaEUsZUFBTyxLQUFLLEtBQUs7QUFBQSxNQUNuQixDQUFDO0FBQUEsSUFDSDtBQUVBLFNBQUssb0JBQW9CLElBQUksT0FBTyxPQUFPLGtCQUFrQixLQUFLLFNBQVMsUUFBUSxFQUFFLFFBQVEsS0FBSyxHQUFHLFNBQVMsSUFBSTtBQUVsSCxVQUFNLEtBQUssa0JBQWtCO0FBQUEsRUFDL0I7QUFBQSxFQUNBLE1BQU0sYUFBYSxXQUFTLE9BQU87QUFDakMsVUFBTSxLQUFLLFNBQVMsS0FBSyxRQUFRO0FBRWpDLFVBQU0sS0FBSyxhQUFhO0FBRXhCLFFBQUcsVUFBVTtBQUNYLFdBQUssZ0JBQWdCLENBQUM7QUFDdEIsWUFBTSxLQUFLLGlCQUFpQjtBQUFBLElBQzlCO0FBQUEsRUFDRjtBQUFBO0FBQUEsRUFHQSxNQUFNLG1CQUFtQjtBQUV2QixRQUFJO0FBRUYsWUFBTSxXQUFXLE9BQU8sR0FBRyxTQUFTLFlBQVk7QUFBQSxRQUM5QyxLQUFLO0FBQUEsUUFDTCxRQUFRO0FBQUEsUUFDUixTQUFTO0FBQUEsVUFDUCxnQkFBZ0I7QUFBQSxRQUNsQjtBQUFBLFFBQ0EsYUFBYTtBQUFBLE1BQ2YsQ0FBQztBQUVELFlBQU0saUJBQWlCLEtBQUssTUFBTSxTQUFTLElBQUksRUFBRTtBQUdqRCxVQUFHLG1CQUFtQixTQUFTO0FBQzdCLFlBQUksU0FBUyxPQUFPLHFEQUFxRCxpQkFBaUI7QUFDMUYsYUFBSyxtQkFBbUI7QUFDeEIsYUFBSyxhQUFhLEtBQUs7QUFBQSxNQUN6QjtBQUFBLElBQ0YsU0FBUyxPQUFQO0FBQ0EsY0FBUSxJQUFJLEtBQUs7QUFBQSxJQUNuQjtBQUFBLEVBQ0Y7QUFBQSxFQUVBLE1BQU0sa0JBQWtCLFVBQVUsV0FBVyxLQUFLO0FBQ2hELFFBQUk7QUFDSixRQUFHLFNBQVMsS0FBSyxFQUFFLFNBQVMsR0FBRztBQUM3QixnQkFBVSxNQUFNLEtBQUssSUFBSSxPQUFPLFFBQVE7QUFBQSxJQUMxQyxPQUFPO0FBRUwsY0FBUSxJQUFJLEdBQUc7QUFDZixZQUFNLE9BQU8sS0FBSyxJQUFJLE1BQU0sc0JBQXNCLElBQUksVUFBVTtBQUNoRSxnQkFBVSxNQUFNLEtBQUssc0JBQXNCLElBQUk7QUFBQSxJQUNqRDtBQUNBLFFBQUksUUFBUSxRQUFRO0FBQ2xCLFdBQUssZUFBZSxXQUFXLE9BQU87QUFBQSxJQUN4QztBQUFBLEVBQ0Y7QUFBQSxFQUVBLE1BQU0saUJBQWlCLGdCQUFjLE1BQU07QUFDekMsUUFBSSxPQUFPLEtBQUssU0FBUztBQUN6QixRQUFJLENBQUMsTUFBTTtBQUVULFlBQU0sS0FBSyxVQUFVO0FBQ3JCLGFBQU8sS0FBSyxTQUFTO0FBQUEsSUFDdkI7QUFDQSxVQUFNLEtBQUssbUJBQW1CLGFBQWE7QUFBQSxFQUM3QztBQUFBLEVBRUEsVUFBUztBQUNQLGFBQVMsUUFBUSxxQkFBcUI7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsd0RBTWM7QUFBQSxFQUN0RDtBQUFBO0FBQUEsRUFHQSxNQUFNLG1CQUFtQjtBQUN2QixVQUFNLFlBQVksS0FBSyxJQUFJLFVBQVUsY0FBYztBQUNuRCxVQUFNLFdBQVcsSUFBSSxVQUFVLElBQUk7QUFFbkMsUUFBRyxPQUFPLEtBQUssY0FBYyxRQUFRLE1BQU0sYUFBYTtBQUN0RCxVQUFJLFNBQVMsT0FBTyx1RkFBdUY7QUFDM0c7QUFBQSxJQUNGO0FBRUEsVUFBTSxPQUFPLEtBQUssTUFBTSxLQUFLLE9BQU8sSUFBSSxLQUFLLGNBQWMsUUFBUSxFQUFFLFNBQU8sQ0FBQztBQUM3RSxVQUFNLGNBQWMsS0FBSyxjQUFjLFFBQVEsRUFBRSxJQUFJO0FBRXJELFNBQUssVUFBVSxXQUFXO0FBQUEsRUFDNUI7QUFBQSxFQUVBLE1BQU0sWUFBWTtBQUNoQixRQUFHLEtBQUssU0FBUyxHQUFFO0FBQ2pCLGNBQVEsSUFBSSxxQ0FBcUM7QUFDakQ7QUFBQSxJQUNGO0FBQ0EsU0FBSyxJQUFJLFVBQVUsbUJBQW1CLDJCQUEyQjtBQUNqRSxVQUFNLEtBQUssSUFBSSxVQUFVLGFBQWEsS0FBSyxFQUFFLGFBQWE7QUFBQSxNQUN4RCxNQUFNO0FBQUEsTUFDTixRQUFRO0FBQUEsSUFDVixDQUFDO0FBQ0QsU0FBSyxJQUFJLFVBQVU7QUFBQSxNQUNqQixLQUFLLElBQUksVUFBVSxnQkFBZ0IsMkJBQTJCLEVBQUUsQ0FBQztBQUFBLElBQ25FO0FBQUEsRUFDRjtBQUFBO0FBQUEsRUFFQSxXQUFXO0FBQ1QsYUFBUyxRQUFRLEtBQUssSUFBSSxVQUFVLGdCQUFnQiwyQkFBMkIsR0FBRztBQUNoRixVQUFJLEtBQUssZ0JBQWdCLHNCQUFzQjtBQUM3QyxlQUFPLEtBQUs7QUFBQSxNQUNkO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFBQTtBQUFBLEVBRUEsTUFBTSxVQUFVLFVBQVEsR0FBRztBQUN6QixRQUFHLENBQUMsS0FBSyxtQkFBbUI7QUFDMUIsY0FBUSxJQUFJLDJCQUEyQjtBQUN2QyxVQUFHLFVBQVUsR0FBRztBQUVkLG1CQUFXLE1BQU07QUFDZixlQUFLLFVBQVUsVUFBUSxDQUFDO0FBQUEsUUFDMUIsR0FBRyxPQUFRLFVBQVEsRUFBRTtBQUNyQjtBQUFBLE1BQ0Y7QUFDQSxjQUFRLElBQUksaURBQWlEO0FBQzdELFdBQUssVUFBVTtBQUNmO0FBQUEsSUFDRjtBQUNBLFNBQUssSUFBSSxVQUFVLG1CQUFtQixnQ0FBZ0M7QUFDdEUsVUFBTSxLQUFLLElBQUksVUFBVSxhQUFhLEtBQUssRUFBRSxhQUFhO0FBQUEsTUFDeEQsTUFBTTtBQUFBLE1BQ04sUUFBUTtBQUFBLElBQ1YsQ0FBQztBQUNELFNBQUssSUFBSSxVQUFVO0FBQUEsTUFDakIsS0FBSyxJQUFJLFVBQVUsZ0JBQWdCLGdDQUFnQyxFQUFFLENBQUM7QUFBQSxJQUN4RTtBQUFBLEVBQ0Y7QUFBQTtBQUFBLEVBR0EsTUFBTSxxQkFBcUI7QUFFekIsVUFBTSxTQUFTLE1BQU0sS0FBSyxJQUFJLE1BQU0sU0FBUyxHQUFHLE9BQU8sQ0FBQyxTQUFTLGdCQUFnQixTQUFTLFVBQVUsS0FBSyxjQUFjLFFBQVEsS0FBSyxjQUFjLFNBQVM7QUFHM0osVUFBTSxhQUFhLEtBQUssSUFBSSxVQUFVLGdCQUFnQixVQUFVLEVBQUUsSUFBSSxDQUFDLFNBQVMsS0FBSyxLQUFLLElBQUk7QUFDOUYsVUFBTSxlQUFlLEtBQUssZUFBZSxvQkFBb0IsS0FBSztBQUNsRSxRQUFHLEtBQUssU0FBUyxZQUFXO0FBQzFCLFdBQUssV0FBVyxjQUFjLE1BQU07QUFDcEMsV0FBSyxXQUFXLHFCQUFxQixhQUFhO0FBQ2xELFdBQUssV0FBVyxtQkFBbUIsYUFBYTtBQUFBLElBQ2xEO0FBRUEsUUFBSSxpQkFBaUIsQ0FBQztBQUN0QixhQUFTLElBQUksR0FBRyxJQUFJLE1BQU0sUUFBUSxLQUFLO0FBRXJDLFVBQUcsTUFBTSxDQUFDLEVBQUUsS0FBSyxRQUFRLEdBQUcsSUFBSSxJQUFJO0FBRWxDLGFBQUssY0FBYyxpQkFBaUI7QUFDcEM7QUFBQSxNQUNGO0FBRUEsVUFBRyxLQUFLLGVBQWUsaUJBQWlCLElBQUksTUFBTSxDQUFDLEVBQUUsSUFBSSxHQUFHLE1BQU0sQ0FBQyxFQUFFLEtBQUssS0FBSyxHQUFHO0FBR2hGO0FBQUEsTUFDRjtBQUVBLFVBQUcsS0FBSyxTQUFTLGFBQWEsUUFBUSxNQUFNLENBQUMsRUFBRSxJQUFJLElBQUksSUFBSTtBQUl6RCxZQUFHLEtBQUssc0JBQXNCO0FBQzVCLHVCQUFhLEtBQUssb0JBQW9CO0FBQ3RDLGVBQUssdUJBQXVCO0FBQUEsUUFDOUI7QUFFQSxZQUFHLENBQUMsS0FBSyw0QkFBMkI7QUFDbEMsY0FBSSxTQUFTLE9BQU8scUZBQXFGO0FBQ3pHLGVBQUssNkJBQTZCO0FBQ2xDLHFCQUFXLE1BQU07QUFDZixpQkFBSyw2QkFBNkI7QUFBQSxVQUNwQyxHQUFHLEdBQU07QUFBQSxRQUNYO0FBQ0E7QUFBQSxNQUNGO0FBRUEsVUFBSSxPQUFPO0FBQ1gsZUFBUSxJQUFJLEdBQUcsSUFBSSxLQUFLLGdCQUFnQixRQUFRLEtBQUs7QUFDbkQsWUFBRyxNQUFNLENBQUMsRUFBRSxLQUFLLFFBQVEsS0FBSyxnQkFBZ0IsQ0FBQyxDQUFDLElBQUksSUFBSTtBQUN0RCxpQkFBTztBQUNQLGVBQUssY0FBYyxLQUFLLGdCQUFnQixDQUFDLENBQUM7QUFFMUM7QUFBQSxRQUNGO0FBQUEsTUFDRjtBQUNBLFVBQUcsTUFBTTtBQUNQO0FBQUEsTUFDRjtBQUVBLFVBQUcsV0FBVyxRQUFRLE1BQU0sQ0FBQyxDQUFDLElBQUksSUFBSTtBQUVwQztBQUFBLE1BQ0Y7QUFDQSxVQUFJO0FBRUYsdUJBQWUsS0FBSyxLQUFLLG9CQUFvQixNQUFNLENBQUMsR0FBRyxLQUFLLENBQUM7QUFBQSxNQUMvRCxTQUFTLE9BQVA7QUFDQSxnQkFBUSxJQUFJLEtBQUs7QUFBQSxNQUNuQjtBQUVBLFVBQUcsZUFBZSxTQUFTLEdBQUc7QUFFNUIsY0FBTSxRQUFRLElBQUksY0FBYztBQUVoQyx5QkFBaUIsQ0FBQztBQUFBLE1BQ3BCO0FBR0EsVUFBRyxJQUFJLEtBQUssSUFBSSxRQUFRLEdBQUc7QUFDekIsY0FBTSxLQUFLLHdCQUF3QjtBQUFBLE1BQ3JDO0FBQUEsSUFDRjtBQUVBLFVBQU0sUUFBUSxJQUFJLGNBQWM7QUFFaEMsVUFBTSxLQUFLLHdCQUF3QjtBQUVuQyxRQUFHLEtBQUssV0FBVyxrQkFBa0IsU0FBUyxHQUFHO0FBQy9DLFlBQU0sS0FBSyx1QkFBdUI7QUFBQSxJQUNwQztBQUFBLEVBQ0Y7QUFBQSxFQUVBLE1BQU0sd0JBQXdCLFFBQU0sT0FBTztBQUN6QyxRQUFHLENBQUMsS0FBSyxvQkFBbUI7QUFDMUI7QUFBQSxJQUNGO0FBRUEsUUFBRyxDQUFDLE9BQU87QUFFVCxVQUFHLEtBQUssY0FBYztBQUNwQixxQkFBYSxLQUFLLFlBQVk7QUFDOUIsYUFBSyxlQUFlO0FBQUEsTUFDdEI7QUFDQSxXQUFLLGVBQWUsV0FBVyxNQUFNO0FBRW5DLGFBQUssd0JBQXdCLElBQUk7QUFFakMsWUFBRyxLQUFLLGNBQWM7QUFDcEIsdUJBQWEsS0FBSyxZQUFZO0FBQzlCLGVBQUssZUFBZTtBQUFBLFFBQ3RCO0FBQUEsTUFDRixHQUFHLEdBQUs7QUFDUixjQUFRLElBQUksZ0JBQWdCO0FBQzVCO0FBQUEsSUFDRjtBQUVBLFFBQUc7QUFFRCxZQUFNLEtBQUssZUFBZSxLQUFLO0FBQy9CLFdBQUsscUJBQXFCO0FBQUEsSUFDNUIsU0FBTyxPQUFOO0FBQ0MsY0FBUSxJQUFJLEtBQUs7QUFDakIsVUFBSSxTQUFTLE9BQU8sd0JBQXNCLE1BQU0sT0FBTztBQUFBLElBQ3pEO0FBQUEsRUFFRjtBQUFBO0FBQUEsRUFFQSxNQUFNLHlCQUEwQjtBQUU5QixRQUFJLG9CQUFvQixDQUFDO0FBRXpCLFVBQU0sZ0NBQWdDLE1BQU0sS0FBSyxJQUFJLE1BQU0sUUFBUSxPQUFPLDBDQUEwQztBQUNwSCxRQUFHLCtCQUErQjtBQUNoQywwQkFBb0IsTUFBTSxLQUFLLElBQUksTUFBTSxRQUFRLEtBQUssMENBQTBDO0FBRWhHLDBCQUFvQixrQkFBa0IsTUFBTSxNQUFNO0FBQUEsSUFDcEQ7QUFFQSx3QkFBb0Isa0JBQWtCLE9BQU8sS0FBSyxXQUFXLGlCQUFpQjtBQUU5RSx3QkFBb0IsQ0FBQyxHQUFHLElBQUksSUFBSSxpQkFBaUIsQ0FBQztBQUVsRCxzQkFBa0IsS0FBSztBQUV2Qix3QkFBb0Isa0JBQWtCLEtBQUssTUFBTTtBQUVqRCxVQUFNLEtBQUssSUFBSSxNQUFNLFFBQVEsTUFBTSw0Q0FBNEMsaUJBQWlCO0FBRWhHLFVBQU0sS0FBSyxrQkFBa0I7QUFBQSxFQUMvQjtBQUFBO0FBQUEsRUFHQSxNQUFNLG9CQUFxQjtBQUV6QixVQUFNLGdDQUFnQyxNQUFNLEtBQUssSUFBSSxNQUFNLFFBQVEsT0FBTywwQ0FBMEM7QUFDcEgsUUFBRyxDQUFDLCtCQUErQjtBQUNqQyxXQUFLLFNBQVMsZUFBZSxDQUFDO0FBQzlCLGNBQVEsSUFBSSxrQkFBa0I7QUFDOUI7QUFBQSxJQUNGO0FBRUEsVUFBTSxvQkFBb0IsTUFBTSxLQUFLLElBQUksTUFBTSxRQUFRLEtBQUssMENBQTBDO0FBRXRHLFVBQU0sMEJBQTBCLGtCQUFrQixNQUFNLE1BQU07QUFFOUQsVUFBTSxlQUFlLHdCQUF3QixJQUFJLGVBQWEsVUFBVSxNQUFNLEdBQUcsRUFBRSxDQUFDLENBQUMsRUFBRSxPQUFPLENBQUMsUUFBUSxTQUFTLE9BQU8sU0FBUyxJQUFJLElBQUksU0FBUyxDQUFDLEdBQUcsUUFBUSxJQUFJLEdBQUcsQ0FBQyxDQUFDO0FBRXRLLFNBQUssU0FBUyxlQUFlO0FBQUEsRUFFL0I7QUFBQTtBQUFBLEVBRUEsTUFBTSxxQkFBc0I7QUFFMUIsU0FBSyxTQUFTLGVBQWUsQ0FBQztBQUU5QixVQUFNLGdDQUFnQyxNQUFNLEtBQUssSUFBSSxNQUFNLFFBQVEsT0FBTywwQ0FBMEM7QUFDcEgsUUFBRywrQkFBK0I7QUFDaEMsWUFBTSxLQUFLLElBQUksTUFBTSxRQUFRLE9BQU8sMENBQTBDO0FBQUEsSUFDaEY7QUFFQSxVQUFNLEtBQUssbUJBQW1CO0FBQUEsRUFDaEM7QUFBQTtBQUFBLEVBSUEsTUFBTSxtQkFBbUI7QUFDdkIsUUFBRyxDQUFFLE1BQU0sS0FBSyxJQUFJLE1BQU0sUUFBUSxPQUFPLFlBQVksR0FBSTtBQUN2RDtBQUFBLElBQ0Y7QUFDQSxRQUFJLGlCQUFpQixNQUFNLEtBQUssSUFBSSxNQUFNLFFBQVEsS0FBSyxZQUFZO0FBRW5FLFFBQUksZUFBZSxRQUFRLG9CQUFvQixJQUFJLEdBQUc7QUFFcEQsVUFBSSxtQkFBbUI7QUFDdkIsMEJBQW9CO0FBQ3BCLFlBQU0sS0FBSyxJQUFJLE1BQU0sUUFBUSxNQUFNLGNBQWMsaUJBQWlCLGdCQUFnQjtBQUNsRixjQUFRLElBQUksd0NBQXdDO0FBQUEsSUFDdEQ7QUFBQSxFQUNGO0FBQUE7QUFBQSxFQUdBLE1BQU0sZ0NBQWdDO0FBQ3BDLFFBQUksU0FBUyxPQUFPLCtFQUErRTtBQUVuRyxVQUFNLEtBQUssZUFBZSxjQUFjO0FBRXhDLFVBQU0sS0FBSyxtQkFBbUI7QUFDOUIsU0FBSyxrQkFBa0I7QUFDdkIsUUFBSSxTQUFTLE9BQU8sMkVBQTJFO0FBQUEsRUFDakc7QUFBQTtBQUFBLEVBR0EsTUFBTSxvQkFBb0IsV0FBVyxPQUFLLE1BQU07QUFFOUMsUUFBSSxZQUFZLENBQUM7QUFDakIsUUFBSSxTQUFTLENBQUM7QUFFZCxVQUFNLGdCQUFnQixJQUFJLFVBQVUsSUFBSTtBQUV4QyxRQUFJLG1CQUFtQixVQUFVLEtBQUssUUFBUSxPQUFPLEVBQUU7QUFDdkQsdUJBQW1CLGlCQUFpQixRQUFRLE9BQU8sS0FBSztBQUV4RCxRQUFJLFlBQVk7QUFDaEIsYUFBUSxJQUFJLEdBQUcsSUFBSSxLQUFLLFVBQVUsUUFBUSxLQUFLO0FBQzdDLFVBQUcsVUFBVSxLQUFLLFFBQVEsS0FBSyxVQUFVLENBQUMsQ0FBQyxJQUFJLElBQUk7QUFDakQsb0JBQVk7QUFDWixnQkFBUSxJQUFJLG1DQUFtQyxLQUFLLFVBQVUsQ0FBQyxDQUFDO0FBRWhFO0FBQUEsTUFDRjtBQUFBLElBQ0Y7QUFFQSxRQUFHLFdBQVc7QUFDWixnQkFBVSxLQUFLLENBQUMsZUFBZSxrQkFBa0I7QUFBQSxRQUMvQyxPQUFPLFVBQVUsS0FBSztBQUFBLFFBQ3RCLE1BQU0sVUFBVTtBQUFBLE1BQ2xCLENBQUMsQ0FBQztBQUNGLFlBQU0sS0FBSyxxQkFBcUIsU0FBUztBQUN6QztBQUFBLElBQ0Y7QUFJQSxRQUFHLFVBQVUsY0FBYyxVQUFVO0FBRW5DLFlBQU0sa0JBQWtCLE1BQU0sS0FBSyxJQUFJLE1BQU0sV0FBVyxTQUFTO0FBQ2pFLFVBQUksT0FBTyxvQkFBb0IsWUFBYyxnQkFBZ0IsUUFBUSxPQUFPLElBQUksSUFBSztBQUNuRixjQUFNLGNBQWMsS0FBSyxNQUFNLGVBQWU7QUFFOUMsaUJBQVEsSUFBSSxHQUFHLElBQUksWUFBWSxNQUFNLFFBQVEsS0FBSztBQUVoRCxjQUFHLFlBQVksTUFBTSxDQUFDLEVBQUUsTUFBTTtBQUU1QixnQ0FBb0IsT0FBTyxZQUFZLE1BQU0sQ0FBQyxFQUFFO0FBQUEsVUFDbEQ7QUFFQSxjQUFHLFlBQVksTUFBTSxDQUFDLEVBQUUsTUFBTTtBQUU1QixnQ0FBb0IsYUFBYSxZQUFZLE1BQU0sQ0FBQyxFQUFFO0FBQUEsVUFDeEQ7QUFBQSxRQUNGO0FBQUEsTUFDRjtBQUVBLGdCQUFVLEtBQUssQ0FBQyxlQUFlLGtCQUFrQjtBQUFBLFFBQy9DLE9BQU8sVUFBVSxLQUFLO0FBQUEsUUFDdEIsTUFBTSxVQUFVO0FBQUEsTUFDbEIsQ0FBQyxDQUFDO0FBQ0YsWUFBTSxLQUFLLHFCQUFxQixTQUFTO0FBQ3pDO0FBQUEsSUFDRjtBQU1BLFVBQU0sZ0JBQWdCLE1BQU0sS0FBSyxJQUFJLE1BQU0sV0FBVyxTQUFTO0FBQy9ELFFBQUksNEJBQTRCO0FBQ2hDLFVBQU0sZ0JBQWdCLEtBQUssYUFBYSxlQUFlLFVBQVUsSUFBSTtBQUdyRSxRQUFHLGNBQWMsU0FBUyxHQUFHO0FBRzNCLGVBQVMsSUFBSSxHQUFHLElBQUksY0FBYyxRQUFRLEtBQUs7QUFFN0MsY0FBTSxvQkFBb0IsY0FBYyxDQUFDLEVBQUU7QUFHM0MsY0FBTSxZQUFZLElBQUksY0FBYyxDQUFDLEVBQUUsSUFBSTtBQUMzQyxlQUFPLEtBQUssU0FBUztBQUdyQixZQUFJLEtBQUssZUFBZSxTQUFTLFNBQVMsTUFBTSxrQkFBa0IsUUFBUTtBQUd4RTtBQUFBLFFBQ0Y7QUFHQSxZQUFHLEtBQUssZUFBZSxpQkFBaUIsV0FBVyxVQUFVLEtBQUssS0FBSyxHQUFHO0FBR3hFO0FBQUEsUUFDRjtBQUVBLGNBQU0sYUFBYSxJQUFJLGtCQUFrQixLQUFLLENBQUM7QUFDL0MsWUFBRyxLQUFLLGVBQWUsU0FBUyxTQUFTLE1BQU0sWUFBWTtBQUd6RDtBQUFBLFFBQ0Y7QUFHQSxrQkFBVSxLQUFLLENBQUMsV0FBVyxtQkFBbUI7QUFBQTtBQUFBO0FBQUEsVUFHNUMsT0FBTyxLQUFLLElBQUk7QUFBQSxVQUNoQixNQUFNO0FBQUEsVUFDTixRQUFRO0FBQUEsVUFDUixNQUFNLGNBQWMsQ0FBQyxFQUFFO0FBQUEsVUFDdkIsTUFBTSxrQkFBa0I7QUFBQSxRQUMxQixDQUFDLENBQUM7QUFDRixZQUFHLFVBQVUsU0FBUyxHQUFHO0FBRXZCLGdCQUFNLEtBQUsscUJBQXFCLFNBQVM7QUFDekMsdUNBQTZCLFVBQVU7QUFHdkMsY0FBSSw2QkFBNkIsSUFBSTtBQUVuQyxrQkFBTSxLQUFLLHdCQUF3QjtBQUVuQyx3Q0FBNEI7QUFBQSxVQUM5QjtBQUVBLHNCQUFZLENBQUM7QUFBQSxRQUNmO0FBQUEsTUFDRjtBQUFBLElBQ0Y7QUFFQSxRQUFHLFVBQVUsU0FBUyxHQUFHO0FBRXZCLFlBQU0sS0FBSyxxQkFBcUIsU0FBUztBQUN6QyxrQkFBWSxDQUFDO0FBQ2IsbUNBQTZCLFVBQVU7QUFBQSxJQUN6QztBQVFBLHdCQUFvQjtBQUFBO0FBSXBCLFFBQUcsY0FBYyxTQUFTLHlCQUF5QjtBQUNqRCwwQkFBb0I7QUFBQSxJQUN0QixPQUFLO0FBQ0gsWUFBTSxrQkFBa0IsS0FBSyxJQUFJLGNBQWMsYUFBYSxTQUFTO0FBRXJFLFVBQUcsT0FBTyxnQkFBZ0IsYUFBYSxhQUFhO0FBRWxELDRCQUFvQixjQUFjLFVBQVUsR0FBRyx1QkFBdUI7QUFBQSxNQUN4RSxPQUFLO0FBQ0gsWUFBSSxnQkFBZ0I7QUFDcEIsaUJBQVMsSUFBSSxHQUFHLElBQUksZ0JBQWdCLFNBQVMsUUFBUSxLQUFLO0FBRXhELGdCQUFNLGdCQUFnQixnQkFBZ0IsU0FBUyxDQUFDLEVBQUU7QUFFbEQsZ0JBQU0sZUFBZSxnQkFBZ0IsU0FBUyxDQUFDLEVBQUU7QUFFakQsY0FBSSxhQUFhO0FBQ2pCLG1CQUFTLElBQUksR0FBRyxJQUFJLGVBQWUsS0FBSztBQUN0QywwQkFBYztBQUFBLFVBQ2hCO0FBRUEsMkJBQWlCLEdBQUcsY0FBYztBQUFBO0FBQUEsUUFDcEM7QUFFQSw0QkFBb0I7QUFDcEIsWUFBRyxpQkFBaUIsU0FBUyx5QkFBeUI7QUFDcEQsNkJBQW1CLGlCQUFpQixVQUFVLEdBQUcsdUJBQXVCO0FBQUEsUUFDMUU7QUFBQSxNQUNGO0FBQUEsSUFDRjtBQUdBLFVBQU0sWUFBWSxJQUFJLGlCQUFpQixLQUFLLENBQUM7QUFDN0MsVUFBTSxnQkFBZ0IsS0FBSyxlQUFlLFNBQVMsYUFBYTtBQUNoRSxRQUFHLGlCQUFrQixjQUFjLGVBQWdCO0FBRWpELFdBQUssa0JBQWtCLFFBQVEsZ0JBQWdCO0FBQy9DO0FBQUEsSUFDRjtBQUFDO0FBR0QsVUFBTSxrQkFBa0IsS0FBSyxlQUFlLGFBQWEsYUFBYTtBQUN0RSxRQUFJLDBCQUEwQjtBQUM5QixRQUFHLG1CQUFtQixNQUFNLFFBQVEsZUFBZSxLQUFNLE9BQU8sU0FBUyxHQUFJO0FBRTNFLGVBQVMsSUFBSSxHQUFHLElBQUksT0FBTyxRQUFRLEtBQUs7QUFDdEMsWUFBRyxnQkFBZ0IsUUFBUSxPQUFPLENBQUMsQ0FBQyxNQUFNLElBQUk7QUFDNUMsb0NBQTBCO0FBQzFCO0FBQUEsUUFDRjtBQUFBLE1BQ0Y7QUFBQSxJQUNGO0FBRUEsUUFBRyx5QkFBd0I7QUFFekIsWUFBTSxpQkFBaUIsVUFBVSxLQUFLO0FBRXRDLFlBQU0saUJBQWlCLEtBQUssZUFBZSxTQUFTLGFBQWE7QUFDakUsVUFBSSxnQkFBZ0I7QUFFbEIsY0FBTSxpQkFBaUIsS0FBSyxNQUFPLEtBQUssSUFBSSxpQkFBaUIsY0FBYyxJQUFJLGlCQUFrQixHQUFHO0FBQ3BHLFlBQUcsaUJBQWlCLElBQUk7QUFHdEIsZUFBSyxXQUFXLGtCQUFrQixVQUFVLElBQUksSUFBSSxpQkFBaUI7QUFDckUsZUFBSyxrQkFBa0IsUUFBUSxnQkFBZ0I7QUFDL0M7QUFBQSxRQUNGO0FBQUEsTUFDRjtBQUFBLElBQ0Y7QUFDQSxRQUFJLE9BQU87QUFBQSxNQUNULE9BQU8sVUFBVSxLQUFLO0FBQUEsTUFDdEIsTUFBTTtBQUFBLE1BQ04sTUFBTSxVQUFVO0FBQUEsTUFDaEIsTUFBTSxVQUFVLEtBQUs7QUFBQSxNQUNyQixVQUFVO0FBQUEsSUFDWjtBQUVBLGNBQVUsS0FBSyxDQUFDLGVBQWUsa0JBQWtCLElBQUksQ0FBQztBQUV0RCxVQUFNLEtBQUsscUJBQXFCLFNBQVM7QUFJekMsUUFBSSxNQUFNO0FBRVIsWUFBTSxLQUFLLHdCQUF3QjtBQUFBLElBQ3JDO0FBQUEsRUFFRjtBQUFBLEVBRUEsa0JBQWtCLFFBQVEsa0JBQWtCO0FBQzFDLFFBQUksT0FBTyxTQUFTLEdBQUc7QUFFckIsV0FBSyxXQUFXLHlCQUF5QixpQkFBaUIsU0FBUztBQUFBLElBQ3JFLE9BQU87QUFFTCxXQUFLLFdBQVcseUJBQXlCLGlCQUFpQixTQUFTO0FBQUEsSUFDckU7QUFBQSxFQUNGO0FBQUEsRUFFQSxNQUFNLHFCQUFxQixXQUFXO0FBQ3BDLFlBQVEsSUFBSSxzQkFBc0I7QUFFbEMsUUFBRyxVQUFVLFdBQVc7QUFBRztBQUUzQixVQUFNLGVBQWUsVUFBVSxJQUFJLENBQUMsUUFBUSxJQUFJLENBQUMsQ0FBQztBQUVsRCxVQUFNLGlCQUFpQixNQUFNLEtBQUssNkJBQTZCLFlBQVk7QUFFM0UsUUFBRyxDQUFDLGdCQUFnQjtBQUNsQixjQUFRLElBQUksd0JBQXdCO0FBRXBDLFdBQUssV0FBVyxvQkFBb0IsQ0FBQyxHQUFHLEtBQUssV0FBVyxtQkFBbUIsR0FBRyxVQUFVLElBQUksQ0FBQyxRQUFRLElBQUksQ0FBQyxFQUFFLElBQUksQ0FBQztBQUNqSDtBQUFBLElBQ0Y7QUFFQSxRQUFHLGdCQUFlO0FBQ2hCLFdBQUsscUJBQXFCO0FBRTFCLFVBQUcsS0FBSyxTQUFTLFlBQVc7QUFDMUIsWUFBRyxLQUFLLFNBQVMsa0JBQWlCO0FBQ2hDLGVBQUssV0FBVyxRQUFRLENBQUMsR0FBRyxLQUFLLFdBQVcsT0FBTyxHQUFHLFVBQVUsSUFBSSxDQUFDLFFBQVEsSUFBSSxDQUFDLEVBQUUsSUFBSSxDQUFDO0FBQUEsUUFDM0Y7QUFDQSxhQUFLLFdBQVcsa0JBQWtCLFVBQVU7QUFFNUMsYUFBSyxXQUFXLGVBQWUsZUFBZSxNQUFNO0FBQUEsTUFDdEQ7QUFHQSxlQUFRLElBQUksR0FBRyxJQUFJLGVBQWUsS0FBSyxRQUFRLEtBQUs7QUFDbEQsY0FBTSxNQUFNLGVBQWUsS0FBSyxDQUFDLEVBQUU7QUFDbkMsY0FBTSxRQUFRLGVBQWUsS0FBSyxDQUFDLEVBQUU7QUFDckMsWUFBRyxLQUFLO0FBQ04sZ0JBQU0sTUFBTSxVQUFVLEtBQUssRUFBRSxDQUFDO0FBQzlCLGdCQUFNLE9BQU8sVUFBVSxLQUFLLEVBQUUsQ0FBQztBQUMvQixlQUFLLGVBQWUsZUFBZSxLQUFLLEtBQUssSUFBSTtBQUFBLFFBQ25EO0FBQUEsTUFDRjtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQUEsRUFFQSxNQUFNLDZCQUE2QixhQUFhLFVBQVUsR0FBRztBQVMzRCxRQUFHLFlBQVksV0FBVyxHQUFHO0FBQzNCLGNBQVEsSUFBSSxzQkFBc0I7QUFDbEMsYUFBTztBQUFBLElBQ1Q7QUFDQSxVQUFNLGFBQWE7QUFBQSxNQUNqQixPQUFPO0FBQUEsTUFDUCxPQUFPO0FBQUEsSUFDVDtBQUVBLFVBQU0sWUFBWTtBQUFBLE1BQ2hCLEtBQUs7QUFBQSxNQUNMLFFBQVE7QUFBQSxNQUNSLE1BQU0sS0FBSyxVQUFVLFVBQVU7QUFBQSxNQUMvQixTQUFTO0FBQUEsUUFDUCxnQkFBZ0I7QUFBQSxRQUNoQixpQkFBaUIsVUFBVSxLQUFLLFNBQVM7QUFBQSxNQUMzQztBQUFBLElBQ0Y7QUFDQSxRQUFJO0FBQ0osUUFBSTtBQUNGLGFBQU8sT0FBTyxHQUFHLFNBQVMsU0FBUyxTQUFTO0FBQzVDLGFBQU8sS0FBSyxNQUFNLElBQUk7QUFBQSxJQUN4QixTQUFTLE9BQVA7QUFFQSxVQUFJLE1BQU0sV0FBVyxPQUFTLFVBQVUsR0FBSTtBQUMxQztBQUVBLGNBQU0sVUFBVSxLQUFLLElBQUksU0FBUyxDQUFDO0FBQ25DLGdCQUFRLElBQUksNkJBQTZCLG9CQUFvQjtBQUM3RCxjQUFNLElBQUksUUFBUSxPQUFLLFdBQVcsR0FBRyxNQUFPLE9BQU8sQ0FBQztBQUNwRCxlQUFPLE1BQU0sS0FBSyw2QkFBNkIsYUFBYSxPQUFPO0FBQUEsTUFDckU7QUFFQSxjQUFRLElBQUksSUFBSTtBQU9oQixjQUFRLElBQUksS0FBSztBQUdqQixhQUFPO0FBQUEsSUFDVDtBQUFBLEVBQ0Y7QUFBQSxFQUNBLE1BQU0sZUFBZTtBQUNuQixVQUFNLGNBQWM7QUFDcEIsVUFBTSxPQUFPLE1BQU0sS0FBSyw2QkFBNkIsV0FBVztBQUNoRSxRQUFHLFFBQVEsS0FBSyxPQUFPO0FBQ3JCLGNBQVEsSUFBSSxrQkFBa0I7QUFDOUIsYUFBTztBQUFBLElBQ1QsT0FBSztBQUNILGNBQVEsSUFBSSxvQkFBb0I7QUFDaEMsYUFBTztBQUFBLElBQ1Q7QUFBQSxFQUNGO0FBQUEsRUFHQSxvQkFBb0I7QUFFbEIsUUFBRyxLQUFLLFNBQVMsWUFBWTtBQUMzQixVQUFJLEtBQUssV0FBVyxtQkFBbUIsR0FBRztBQUN4QztBQUFBLE1BQ0YsT0FBSztBQUVILGdCQUFRLElBQUksS0FBSyxVQUFVLEtBQUssWUFBWSxNQUFNLENBQUMsQ0FBQztBQUFBLE1BQ3REO0FBQUEsSUFDRjtBQUdBLFNBQUssYUFBYSxDQUFDO0FBQ25CLFNBQUssV0FBVyxxQkFBcUI7QUFDckMsU0FBSyxXQUFXLGtCQUFrQixDQUFDO0FBQ25DLFNBQUssV0FBVyxvQkFBb0IsQ0FBQztBQUNyQyxTQUFLLFdBQVcsUUFBUSxDQUFDO0FBQ3pCLFNBQUssV0FBVyxpQkFBaUI7QUFDakMsU0FBSyxXQUFXLG9CQUFvQixDQUFDO0FBQ3JDLFNBQUssV0FBVyxjQUFjO0FBQzlCLFNBQUssV0FBVyx3QkFBd0I7QUFBQSxFQUMxQztBQUFBO0FBQUEsRUFHQSxNQUFNLHNCQUFzQixlQUFhLE1BQU07QUFFN0MsVUFBTSxXQUFXLElBQUksYUFBYSxJQUFJO0FBR3RDLFFBQUksVUFBVSxDQUFDO0FBQ2YsUUFBRyxLQUFLLGNBQWMsUUFBUSxHQUFHO0FBQy9CLGdCQUFVLEtBQUssY0FBYyxRQUFRO0FBQUEsSUFFdkMsT0FBSztBQUVILGVBQVEsSUFBSSxHQUFHLElBQUksS0FBSyxnQkFBZ0IsUUFBUSxLQUFLO0FBQ25ELFlBQUcsYUFBYSxLQUFLLFFBQVEsS0FBSyxnQkFBZ0IsQ0FBQyxDQUFDLElBQUksSUFBSTtBQUMxRCxlQUFLLGNBQWMsS0FBSyxnQkFBZ0IsQ0FBQyxDQUFDO0FBRTFDLGlCQUFPO0FBQUEsUUFDVDtBQUFBLE1BQ0Y7QUFJQSxpQkFBVyxNQUFNO0FBQ2YsYUFBSyxtQkFBbUI7QUFBQSxNQUMxQixHQUFHLEdBQUk7QUFFUCxVQUFHLEtBQUssZUFBZSxpQkFBaUIsVUFBVSxhQUFhLEtBQUssS0FBSyxHQUFHO0FBQUEsTUFHNUUsT0FBSztBQUVILGNBQU0sS0FBSyxvQkFBb0IsWUFBWTtBQUFBLE1BQzdDO0FBRUEsWUFBTSxNQUFNLEtBQUssZUFBZSxRQUFRLFFBQVE7QUFDaEQsVUFBRyxDQUFDLEtBQUs7QUFDUCxlQUFPLG1DQUFpQyxhQUFhO0FBQUEsTUFDdkQ7QUFHQSxnQkFBVSxLQUFLLGVBQWUsUUFBUSxLQUFLO0FBQUEsUUFDekMsVUFBVTtBQUFBLFFBQ1YsZUFBZSxLQUFLLFNBQVM7QUFBQSxNQUMvQixDQUFDO0FBR0QsV0FBSyxjQUFjLFFBQVEsSUFBSTtBQUFBLElBQ2pDO0FBR0EsV0FBTztBQUFBLEVBQ1Q7QUFBQTtBQUFBLEVBR0EsY0FBYyxXQUFXO0FBRXZCLFNBQUssV0FBVyxnQkFBZ0IsU0FBUyxLQUFLLEtBQUssV0FBVyxnQkFBZ0IsU0FBUyxLQUFLLEtBQUs7QUFBQSxFQUNuRztBQUFBLEVBR0EsYUFBYSxVQUFVLFdBQVU7QUFFL0IsUUFBRyxLQUFLLFNBQVMsZUFBZTtBQUM5QixhQUFPLENBQUM7QUFBQSxJQUNWO0FBRUEsVUFBTSxRQUFRLFNBQVMsTUFBTSxJQUFJO0FBRWpDLFFBQUksU0FBUyxDQUFDO0FBRWQsUUFBSSxpQkFBaUIsQ0FBQztBQUV0QixVQUFNLG1CQUFtQixVQUFVLFFBQVEsT0FBTyxFQUFFLEVBQUUsUUFBUSxPQUFPLEtBQUs7QUFFMUUsUUFBSSxRQUFRO0FBQ1osUUFBSSxpQkFBaUI7QUFDckIsUUFBSSxhQUFhO0FBRWpCLFFBQUksb0JBQW9CO0FBQ3hCLFFBQUksSUFBSTtBQUNSLFFBQUksc0JBQXNCLENBQUM7QUFFM0IsU0FBSyxJQUFJLEdBQUcsSUFBSSxNQUFNLFFBQVEsS0FBSztBQUVqQyxZQUFNLE9BQU8sTUFBTSxDQUFDO0FBSXBCLFVBQUksQ0FBQyxLQUFLLFdBQVcsR0FBRyxLQUFNLENBQUMsS0FBSSxHQUFHLEVBQUUsUUFBUSxLQUFLLENBQUMsQ0FBQyxJQUFJLEdBQUc7QUFFNUQsWUFBRyxTQUFTO0FBQUk7QUFFaEIsWUFBRyxDQUFDLE1BQU0sUUFBUSxFQUFFLFFBQVEsSUFBSSxJQUFJO0FBQUk7QUFFeEMsWUFBRyxlQUFlLFdBQVc7QUFBRztBQUVoQyxpQkFBUyxPQUFPO0FBQ2hCO0FBQUEsTUFDRjtBQUtBLDBCQUFvQjtBQUVwQixVQUFHLElBQUksS0FBTSxzQkFBdUIsSUFBRSxLQUFRLE1BQU0sUUFBUSxJQUFJLElBQUksTUFBTyxLQUFLLGtCQUFrQixjQUFjLEdBQUc7QUFDakgscUJBQWE7QUFBQSxNQUNmO0FBRUEsWUFBTSxRQUFRLEtBQUssTUFBTSxHQUFHLEVBQUUsU0FBUztBQUV2Qyx1QkFBaUIsZUFBZSxPQUFPLFlBQVUsT0FBTyxRQUFRLEtBQUs7QUFHckUscUJBQWUsS0FBSyxFQUFDLFFBQVEsS0FBSyxRQUFRLE1BQU0sRUFBRSxFQUFFLEtBQUssR0FBRyxNQUFZLENBQUM7QUFFekUsY0FBUTtBQUNSLGVBQVMsT0FBTyxlQUFlLElBQUksWUFBVSxPQUFPLE1BQU0sRUFBRSxLQUFLLEtBQUs7QUFDdEUsdUJBQWlCLE1BQUksZUFBZSxJQUFJLFlBQVUsT0FBTyxNQUFNLEVBQUUsS0FBSyxHQUFHO0FBRXpFLFVBQUcsb0JBQW9CLFFBQVEsY0FBYyxJQUFJLElBQUk7QUFDbkQsWUFBSSxRQUFRO0FBQ1osZUFBTSxvQkFBb0IsUUFBUSxHQUFHLGtCQUFrQixRQUFRLElBQUksSUFBSTtBQUNyRTtBQUFBLFFBQ0Y7QUFDQSx5QkFBaUIsR0FBRyxrQkFBa0I7QUFBQSxNQUN4QztBQUNBLDBCQUFvQixLQUFLLGNBQWM7QUFDdkMsbUJBQWEsWUFBWTtBQUFBLElBQzNCO0FBRUEsUUFBSSxzQkFBdUIsSUFBRSxLQUFRLE1BQU0sUUFBUSxJQUFJLElBQUksTUFBTyxLQUFLLGtCQUFrQixjQUFjO0FBQUcsbUJBQWE7QUFFdkgsYUFBUyxPQUFPLE9BQU8sT0FBSyxFQUFFLFNBQVMsRUFBRTtBQUd6QyxXQUFPO0FBRVAsYUFBUyxlQUFlO0FBRXRCLFlBQU0scUJBQXFCLE1BQU0sUUFBUSxJQUFJLElBQUk7QUFDakQsWUFBTSxlQUFlLE1BQU0sU0FBUztBQUVwQyxVQUFJLE1BQU0sU0FBUyx5QkFBeUI7QUFDMUMsZ0JBQVEsTUFBTSxVQUFVLEdBQUcsdUJBQXVCO0FBQUEsTUFDcEQ7QUFDQSxhQUFPLEtBQUssRUFBRSxNQUFNLE1BQU0sS0FBSyxHQUFHLE1BQU0sWUFBWSxRQUFRLGFBQWEsQ0FBQztBQUFBLElBQzVFO0FBQUEsRUFDRjtBQUFBO0FBQUEsRUFFQSxNQUFNLGdCQUFnQixNQUFNLFNBQU8sQ0FBQyxHQUFHO0FBQ3JDLGFBQVM7QUFBQSxNQUNQLE9BQU87QUFBQSxNQUNQLGdCQUFnQjtBQUFBLE1BQ2hCLFdBQVc7QUFBQSxNQUNYLEdBQUc7QUFBQSxJQUNMO0FBRUEsUUFBSSxLQUFLLFFBQVEsR0FBRyxJQUFJLEdBQUc7QUFDekIsY0FBUSxJQUFJLHVCQUFxQixJQUFJO0FBQ3JDLGFBQU87QUFBQSxJQUNUO0FBQ0EsUUFBSSxRQUFRLENBQUM7QUFDYixRQUFJLGlCQUFpQixLQUFLLE1BQU0sR0FBRyxFQUFFLE1BQU0sQ0FBQztBQUU1QyxRQUFJLHFCQUFxQjtBQUN6QixRQUFHLGVBQWUsZUFBZSxTQUFPLENBQUMsRUFBRSxRQUFRLEdBQUcsSUFBSSxJQUFJO0FBRTVELDJCQUFxQixTQUFTLGVBQWUsZUFBZSxTQUFPLENBQUMsRUFBRSxNQUFNLEdBQUcsRUFBRSxDQUFDLEVBQUUsUUFBUSxLQUFLLEVBQUUsQ0FBQztBQUVwRyxxQkFBZSxlQUFlLFNBQU8sQ0FBQyxJQUFJLGVBQWUsZUFBZSxTQUFPLENBQUMsRUFBRSxNQUFNLEdBQUcsRUFBRSxDQUFDO0FBQUEsSUFDaEc7QUFDQSxRQUFJLGlCQUFpQixDQUFDO0FBQ3RCLFFBQUksbUJBQW1CO0FBQ3ZCLFFBQUksYUFBYTtBQUNqQixRQUFJLElBQUk7QUFFUixVQUFNLFlBQVksS0FBSyxNQUFNLEdBQUcsRUFBRSxDQUFDO0FBRW5DLFVBQU0sT0FBTyxLQUFLLElBQUksTUFBTSxzQkFBc0IsU0FBUztBQUMzRCxRQUFHLEVBQUUsZ0JBQWdCLFNBQVMsUUFBUTtBQUNwQyxjQUFRLElBQUksaUJBQWUsU0FBUztBQUNwQyxhQUFPO0FBQUEsSUFDVDtBQUVBLFVBQU0sZ0JBQWdCLE1BQU0sS0FBSyxJQUFJLE1BQU0sV0FBVyxJQUFJO0FBRTFELFVBQU0sUUFBUSxjQUFjLE1BQU0sSUFBSTtBQUV0QyxRQUFJLFVBQVU7QUFDZCxTQUFLLElBQUksR0FBRyxJQUFJLE1BQU0sUUFBUSxLQUFLO0FBRWpDLFlBQU0sT0FBTyxNQUFNLENBQUM7QUFFcEIsVUFBRyxLQUFLLFFBQVEsS0FBSyxNQUFNLEdBQUc7QUFDNUIsa0JBQVUsQ0FBQztBQUFBLE1BQ2I7QUFFQSxVQUFHLFNBQVM7QUFDVjtBQUFBLE1BQ0Y7QUFFQSxVQUFHLENBQUMsTUFBTSxRQUFRLEVBQUUsUUFBUSxJQUFJLElBQUk7QUFBSTtBQUl4QyxVQUFJLENBQUMsS0FBSyxXQUFXLEdBQUcsS0FBTSxDQUFDLEtBQUksR0FBRyxFQUFFLFFBQVEsS0FBSyxDQUFDLENBQUMsSUFBSSxHQUFHO0FBQzVEO0FBQUEsTUFDRjtBQU1BLFlBQU0sZUFBZSxLQUFLLFFBQVEsTUFBTSxFQUFFLEVBQUUsS0FBSztBQUVqRCxZQUFNLGdCQUFnQixlQUFlLFFBQVEsWUFBWTtBQUN6RCxVQUFJLGdCQUFnQjtBQUFHO0FBRXZCLFVBQUksZUFBZSxXQUFXO0FBQWU7QUFFN0MscUJBQWUsS0FBSyxZQUFZO0FBRWhDLFVBQUksZUFBZSxXQUFXLGVBQWUsUUFBUTtBQUVuRCxZQUFHLHVCQUF1QixHQUFHO0FBRTNCLHVCQUFhLElBQUk7QUFDakI7QUFBQSxRQUNGO0FBRUEsWUFBRyxxQkFBcUIsb0JBQW1CO0FBQ3pDLHVCQUFhLElBQUk7QUFDakI7QUFBQSxRQUNGO0FBQ0E7QUFFQSx1QkFBZSxJQUFJO0FBQ25CO0FBQUEsTUFDRjtBQUFBLElBQ0Y7QUFFQSxRQUFJLGVBQWU7QUFBRyxhQUFPO0FBRTdCLGNBQVU7QUFFVixRQUFJLGFBQWE7QUFDakIsU0FBSyxJQUFJLFlBQVksSUFBSSxNQUFNLFFBQVEsS0FBSztBQUMxQyxVQUFJLE9BQU8sZUFBZSxZQUFjLE1BQU0sU0FBUyxZQUFZO0FBQ2pFLGNBQU0sS0FBSyxLQUFLO0FBQ2hCO0FBQUEsTUFDRjtBQUNBLFVBQUksT0FBTyxNQUFNLENBQUM7QUFDbEIsVUFBSyxLQUFLLFFBQVEsR0FBRyxNQUFNLEtBQU8sQ0FBQyxLQUFJLEdBQUcsRUFBRSxRQUFRLEtBQUssQ0FBQyxDQUFDLE1BQU0sSUFBSTtBQUNuRTtBQUFBLE1BQ0Y7QUFHQSxVQUFJLE9BQU8sYUFBYSxhQUFhLE9BQU8sV0FBVztBQUNyRCxjQUFNLEtBQUssS0FBSztBQUNoQjtBQUFBLE1BQ0Y7QUFFQSxVQUFJLE9BQU8sYUFBZSxLQUFLLFNBQVMsYUFBYyxPQUFPLFdBQVk7QUFDdkUsY0FBTSxnQkFBZ0IsT0FBTyxZQUFZO0FBQ3pDLGVBQU8sS0FBSyxNQUFNLEdBQUcsYUFBYSxJQUFJO0FBQ3RDO0FBQUEsTUFDRjtBQUdBLFVBQUksS0FBSyxXQUFXO0FBQUc7QUFFdkIsVUFBSSxPQUFPLGtCQUFrQixLQUFLLFNBQVMsT0FBTyxnQkFBZ0I7QUFDaEUsZUFBTyxLQUFLLE1BQU0sR0FBRyxPQUFPLGNBQWMsSUFBSTtBQUFBLE1BQ2hEO0FBRUEsVUFBSSxLQUFLLFdBQVcsS0FBSyxHQUFHO0FBQzFCLGtCQUFVLENBQUM7QUFDWDtBQUFBLE1BQ0Y7QUFDQSxVQUFJLFNBQVE7QUFFVixlQUFPLE1BQUs7QUFBQSxNQUNkO0FBRUEsWUFBTSxLQUFLLElBQUk7QUFFZixvQkFBYyxLQUFLO0FBQUEsSUFDckI7QUFFQSxRQUFJLFNBQVM7QUFDWCxZQUFNLEtBQUssS0FBSztBQUFBLElBQ2xCO0FBQ0EsV0FBTyxNQUFNLEtBQUssSUFBSSxFQUFFLEtBQUs7QUFBQSxFQUMvQjtBQUFBO0FBQUEsRUFHQSxNQUFNLGVBQWUsTUFBTSxTQUFPLENBQUMsR0FBRztBQUNwQyxhQUFTO0FBQUEsTUFDUCxPQUFPO0FBQUEsTUFDUCxXQUFXO0FBQUEsTUFDWCxnQkFBZ0I7QUFBQSxNQUNoQixHQUFHO0FBQUEsSUFDTDtBQUNBLFVBQU0sWUFBWSxLQUFLLElBQUksTUFBTSxzQkFBc0IsSUFBSTtBQUUzRCxRQUFJLEVBQUUscUJBQXFCLFNBQVM7QUFBZ0IsYUFBTztBQUUzRCxVQUFNLGVBQWUsTUFBTSxLQUFLLElBQUksTUFBTSxXQUFXLFNBQVM7QUFDOUQsVUFBTSxhQUFhLGFBQWEsTUFBTSxJQUFJO0FBQzFDLFFBQUksa0JBQWtCLENBQUM7QUFDdkIsUUFBSSxVQUFVO0FBQ2QsUUFBSSxhQUFhO0FBQ2pCLFVBQU1DLGNBQWEsT0FBTyxTQUFTLFdBQVc7QUFDOUMsYUFBUyxJQUFJLEdBQUcsZ0JBQWdCLFNBQVNBLGFBQVksS0FBSztBQUN4RCxVQUFJLE9BQU8sV0FBVyxDQUFDO0FBRXZCLFVBQUksT0FBTyxTQUFTO0FBQ2xCO0FBRUYsVUFBSSxLQUFLLFdBQVc7QUFDbEI7QUFFRixVQUFJLE9BQU8sa0JBQWtCLEtBQUssU0FBUyxPQUFPLGdCQUFnQjtBQUNoRSxlQUFPLEtBQUssTUFBTSxHQUFHLE9BQU8sY0FBYyxJQUFJO0FBQUEsTUFDaEQ7QUFFQSxVQUFJLFNBQVM7QUFDWDtBQUVGLFVBQUksQ0FBQyxNQUFNLFFBQVEsRUFBRSxRQUFRLElBQUksSUFBSTtBQUNuQztBQUVGLFVBQUksS0FBSyxRQUFRLEtBQUssTUFBTSxHQUFHO0FBQzdCLGtCQUFVLENBQUM7QUFDWDtBQUFBLE1BQ0Y7QUFFQSxVQUFJLE9BQU8sYUFBYSxhQUFhLE9BQU8sV0FBVztBQUNyRCx3QkFBZ0IsS0FBSyxLQUFLO0FBQzFCO0FBQUEsTUFDRjtBQUNBLFVBQUksU0FBUztBQUVYLGVBQU8sTUFBTztBQUFBLE1BQ2hCO0FBRUEsVUFBSSxnQkFBZ0IsSUFBSSxHQUFHO0FBSXpCLFlBQUssZ0JBQWdCLFNBQVMsS0FBTSxnQkFBZ0IsZ0JBQWdCLGdCQUFnQixTQUFTLENBQUMsQ0FBQyxHQUFHO0FBRWhHLDBCQUFnQixJQUFJO0FBQUEsUUFDdEI7QUFBQSxNQUNGO0FBRUEsc0JBQWdCLEtBQUssSUFBSTtBQUV6QixvQkFBYyxLQUFLO0FBQUEsSUFDckI7QUFFQSxhQUFTLElBQUksR0FBRyxJQUFJLGdCQUFnQixRQUFRLEtBQUs7QUFFL0MsVUFBSSxnQkFBZ0IsZ0JBQWdCLENBQUMsQ0FBQyxHQUFHO0FBRXZDLFlBQUksTUFBTSxnQkFBZ0IsU0FBUyxHQUFHO0FBRXBDLDBCQUFnQixJQUFJO0FBQ3BCO0FBQUEsUUFDRjtBQUVBLHdCQUFnQixDQUFDLElBQUksZ0JBQWdCLENBQUMsRUFBRSxRQUFRLE1BQU0sRUFBRTtBQUN4RCx3QkFBZ0IsQ0FBQyxJQUFJO0FBQUEsRUFBSyxnQkFBZ0IsQ0FBQztBQUFBLE1BQzdDO0FBQUEsSUFDRjtBQUVBLHNCQUFrQixnQkFBZ0IsS0FBSyxJQUFJO0FBQzNDLFdBQU87QUFBQSxFQUNUO0FBQUE7QUFBQSxFQUdBLGtCQUFrQixnQkFBZ0I7QUFDaEMsUUFBSSxRQUFRO0FBQ1osUUFBSSxLQUFLLGtCQUFrQixTQUFTLEdBQUc7QUFDckMsZUFBUyxJQUFJLEdBQUcsSUFBSSxLQUFLLGtCQUFrQixRQUFRLEtBQUs7QUFDdEQsWUFBSSxlQUFlLFFBQVEsS0FBSyxrQkFBa0IsQ0FBQyxDQUFDLElBQUksSUFBSTtBQUMxRCxrQkFBUTtBQUNSLGVBQUssY0FBYyxjQUFZLEtBQUssa0JBQWtCLENBQUMsQ0FBQztBQUN4RDtBQUFBLFFBQ0Y7QUFBQSxNQUNGO0FBQUEsSUFDRjtBQUNBLFdBQU87QUFBQSxFQUNUO0FBQUE7QUFBQSxFQUVBLGFBQWEsV0FBVyxXQUFTLFdBQVc7QUFFMUMsUUFBSSxjQUFjLE9BQU87QUFDdkIsWUFBTSxZQUFZLE9BQU8sS0FBSyxLQUFLLFdBQVc7QUFDOUMsZUFBUyxJQUFJLEdBQUcsSUFBSSxVQUFVLFFBQVEsS0FBSztBQUN6QyxhQUFLLGFBQWEsS0FBSyxZQUFZLFVBQVUsQ0FBQyxDQUFDLEdBQUcsVUFBVSxDQUFDLENBQUM7QUFBQSxNQUNoRTtBQUNBO0FBQUEsSUFDRjtBQUVBLFNBQUssWUFBWSxRQUFRLElBQUk7QUFFN0IsUUFBSSxLQUFLLFlBQVksUUFBUSxFQUFFLGNBQWMsV0FBVyxHQUFHO0FBQ3pELFdBQUssWUFBWSxRQUFRLEVBQUUsY0FBYyxXQUFXLEVBQUUsT0FBTztBQUFBLElBQy9EO0FBQ0EsVUFBTSxrQkFBa0IsS0FBSyxZQUFZLFFBQVEsRUFBRSxTQUFTLE9BQU8sRUFBRSxLQUFLLFdBQVcsQ0FBQztBQUd0RixhQUFTLFFBQVEsaUJBQWlCLG1CQUFtQjtBQUNyRCxVQUFNLFVBQVUsZ0JBQWdCLFNBQVMsR0FBRztBQUM1QyxRQUFJLE9BQU87QUFDWCxRQUFJLE9BQU8sQ0FBQztBQUVaLFFBQUksS0FBSyxrQkFBa0I7QUFDekIsYUFBTztBQUNQLGFBQU87QUFBQSxRQUNMLE9BQU87QUFBQSxNQUNUO0FBQUEsSUFDRjtBQUNBLFlBQVEsU0FBUyxLQUFLO0FBQUEsTUFDcEIsS0FBSztBQUFBLE1BQ0w7QUFBQSxNQUNBLE1BQU07QUFBQSxNQUNOLFFBQVE7QUFBQSxNQUNSO0FBQUEsSUFDRixDQUFDO0FBQUEsRUFDSDtBQUFBO0FBQUEsRUFJQSxNQUFNLGVBQWUsV0FBVyxTQUFTO0FBQ3ZDLFFBQUk7QUFFSixRQUFJLFVBQVUsU0FBUyxTQUFTLEtBQU8sVUFBVSxTQUFTLENBQUMsRUFBRSxVQUFVLFNBQVMsU0FBUyxHQUFHO0FBQzFGLGFBQU8sVUFBVSxTQUFTLENBQUM7QUFBQSxJQUM3QjtBQUVBLFFBQUksTUFBTTtBQUNSLFdBQUssTUFBTTtBQUFBLElBQ2IsT0FBTztBQUVMLGFBQU8sVUFBVSxTQUFTLE9BQU8sRUFBRSxLQUFLLFVBQVUsQ0FBQztBQUFBLElBQ3JEO0FBQ0EsUUFBSSxzQkFBc0I7QUFFMUIsUUFBRyxDQUFDLEtBQUssU0FBUztBQUFlLDZCQUF1QjtBQUd4RCxRQUFHLENBQUMsS0FBSyxTQUFTLHVCQUF1QjtBQUV2QyxlQUFTLElBQUksR0FBRyxJQUFJLFFBQVEsUUFBUSxLQUFLO0FBS3ZDLFlBQUksT0FBTyxRQUFRLENBQUMsRUFBRSxTQUFTLFVBQVU7QUFDdkMsZ0JBQU1DLFFBQU8sS0FBSyxTQUFTLE9BQU8sRUFBRSxLQUFLLGdCQUFnQixDQUFDO0FBQzFELGdCQUFNQyxRQUFPRCxNQUFLLFNBQVMsS0FBSztBQUFBLFlBQzlCLEtBQUs7QUFBQSxZQUNMLE1BQU0sUUFBUSxDQUFDLEVBQUUsS0FBSztBQUFBLFlBQ3RCLE9BQU8sUUFBUSxDQUFDLEVBQUUsS0FBSztBQUFBLFVBQ3pCLENBQUM7QUFDRCxVQUFBQyxNQUFLLFlBQVksS0FBSyx5QkFBeUIsUUFBUSxDQUFDLEVBQUUsSUFBSTtBQUM5RCxVQUFBRCxNQUFLLFFBQVEsYUFBYSxNQUFNO0FBQ2hDO0FBQUEsUUFDRjtBQUtBLFlBQUk7QUFDSixjQUFNLHNCQUFzQixLQUFLLE1BQU0sUUFBUSxDQUFDLEVBQUUsYUFBYSxHQUFHLElBQUk7QUFDdEUsWUFBRyxLQUFLLFNBQVMsZ0JBQWdCO0FBQy9CLGdCQUFNLE1BQU0sUUFBUSxDQUFDLEVBQUUsS0FBSyxNQUFNLEdBQUc7QUFDckMsMkJBQWlCLElBQUksSUFBSSxTQUFTLENBQUM7QUFDbkMsZ0JBQU0sT0FBTyxJQUFJLE1BQU0sR0FBRyxJQUFJLFNBQVMsQ0FBQyxFQUFFLEtBQUssR0FBRztBQUVsRCwyQkFBaUIsVUFBVSx5QkFBeUIsVUFBVTtBQUFBLFFBQ2hFLE9BQUs7QUFDSCwyQkFBaUIsWUFBWSxzQkFBc0IsUUFBUSxRQUFRLENBQUMsRUFBRSxLQUFLLE1BQU0sR0FBRyxFQUFFLElBQUksSUFBSTtBQUFBLFFBQ2hHO0FBR0EsWUFBRyxDQUFDLEtBQUsscUJBQXFCLFFBQVEsQ0FBQyxFQUFFLElBQUksR0FBRTtBQUM3QyxnQkFBTUEsUUFBTyxLQUFLLFNBQVMsT0FBTyxFQUFFLEtBQUssZ0JBQWdCLENBQUM7QUFDMUQsZ0JBQU1DLFFBQU9ELE1BQUssU0FBUyxLQUFLO0FBQUEsWUFDOUIsS0FBSztBQUFBLFlBQ0wsTUFBTSxRQUFRLENBQUMsRUFBRTtBQUFBLFVBQ25CLENBQUM7QUFDRCxVQUFBQyxNQUFLLFlBQVk7QUFFakIsVUFBQUQsTUFBSyxRQUFRLGFBQWEsTUFBTTtBQUVoQyxlQUFLLG1CQUFtQkMsT0FBTSxRQUFRLENBQUMsR0FBR0QsS0FBSTtBQUM5QztBQUFBLFFBQ0Y7QUFHQSx5QkFBaUIsZUFBZSxRQUFRLE9BQU8sRUFBRSxFQUFFLFFBQVEsTUFBTSxLQUFLO0FBRXRFLGNBQU0sT0FBTyxLQUFLLFNBQVMsT0FBTyxFQUFFLEtBQUssb0JBQW9CLENBQUM7QUFFOUQsY0FBTSxTQUFTLEtBQUssU0FBUyxRQUFRLEVBQUUsS0FBSyxlQUFlLENBQUM7QUFFNUQsaUJBQVMsUUFBUSxRQUFRLGdCQUFnQjtBQUN6QyxjQUFNLE9BQU8sT0FBTyxTQUFTLEtBQUs7QUFBQSxVQUNoQyxLQUFLO0FBQUEsVUFDTCxPQUFPLFFBQVEsQ0FBQyxFQUFFO0FBQUEsUUFDcEIsQ0FBQztBQUNELGFBQUssWUFBWTtBQUVqQixhQUFLLG1CQUFtQixNQUFNLFFBQVEsQ0FBQyxHQUFHLElBQUk7QUFDOUMsZUFBTyxpQkFBaUIsU0FBUyxDQUFDLFVBQVU7QUFFMUMsY0FBSSxTQUFTLE1BQU0sT0FBTztBQUMxQixpQkFBTyxDQUFDLE9BQU8sVUFBVSxTQUFTLGVBQWUsR0FBRztBQUNsRCxxQkFBUyxPQUFPO0FBQUEsVUFDbEI7QUFFQSxpQkFBTyxVQUFVLE9BQU8sY0FBYztBQUFBLFFBQ3hDLENBQUM7QUFDRCxjQUFNLFdBQVcsS0FBSyxTQUFTLE1BQU0sRUFBRSxLQUFLLEdBQUcsQ0FBQztBQUNoRCxjQUFNLHFCQUFxQixTQUFTLFNBQVMsTUFBTTtBQUFBLFVBQ2pELEtBQUs7QUFBQSxVQUNMLE9BQU8sUUFBUSxDQUFDLEVBQUU7QUFBQSxRQUNwQixDQUFDO0FBQ0QsWUFBRyxRQUFRLENBQUMsRUFBRSxLQUFLLFFBQVEsR0FBRyxJQUFJLElBQUc7QUFDbkMsbUJBQVMsaUJBQWlCLGVBQWdCLE1BQU0sS0FBSyxnQkFBZ0IsUUFBUSxDQUFDLEVBQUUsTUFBTSxFQUFDLE9BQU8sSUFBSSxXQUFXLElBQUksQ0FBQyxHQUFJLG9CQUFvQixRQUFRLENBQUMsRUFBRSxNQUFNLElBQUksU0FBUyxVQUFVLENBQUM7QUFBQSxRQUNyTCxPQUFLO0FBQ0gsZ0JBQU0sa0JBQWtCLE1BQU0sS0FBSyxlQUFlLFFBQVEsQ0FBQyxFQUFFLE1BQU0sRUFBQyxPQUFPLElBQUksV0FBVyxJQUFJLENBQUM7QUFDL0YsY0FBRyxDQUFDO0FBQWlCO0FBQ3JCLG1CQUFTLGlCQUFpQixlQUFlLGlCQUFpQixvQkFBb0IsUUFBUSxDQUFDLEVBQUUsTUFBTSxJQUFJLFNBQVMsVUFBVSxDQUFDO0FBQUEsUUFDekg7QUFDQSxhQUFLLG1CQUFtQixVQUFVLFFBQVEsQ0FBQyxHQUFHLElBQUk7QUFBQSxNQUNwRDtBQUNBLFdBQUssYUFBYSxXQUFXLE9BQU87QUFDcEM7QUFBQSxJQUNGO0FBR0EsVUFBTSxrQkFBa0IsQ0FBQztBQUN6QixhQUFTLElBQUksR0FBRyxJQUFJLFFBQVEsUUFBUSxLQUFLO0FBQ3ZDLFlBQU0sT0FBTyxRQUFRLENBQUM7QUFDdEIsWUFBTSxPQUFPLEtBQUs7QUFFbEIsVUFBSSxPQUFPLFNBQVMsVUFBVTtBQUM1Qix3QkFBZ0IsS0FBSyxJQUFJLElBQUksQ0FBQyxJQUFJO0FBQ2xDO0FBQUEsTUFDRjtBQUNBLFVBQUksS0FBSyxRQUFRLEdBQUcsSUFBSSxJQUFJO0FBQzFCLGNBQU0sWUFBWSxLQUFLLE1BQU0sR0FBRyxFQUFFLENBQUM7QUFDbkMsWUFBSSxDQUFDLGdCQUFnQixTQUFTLEdBQUc7QUFDL0IsMEJBQWdCLFNBQVMsSUFBSSxDQUFDO0FBQUEsUUFDaEM7QUFDQSx3QkFBZ0IsU0FBUyxFQUFFLEtBQUssUUFBUSxDQUFDLENBQUM7QUFBQSxNQUM1QyxPQUFPO0FBQ0wsWUFBSSxDQUFDLGdCQUFnQixJQUFJLEdBQUc7QUFDMUIsMEJBQWdCLElBQUksSUFBSSxDQUFDO0FBQUEsUUFDM0I7QUFFQSx3QkFBZ0IsSUFBSSxFQUFFLFFBQVEsUUFBUSxDQUFDLENBQUM7QUFBQSxNQUMxQztBQUFBLElBQ0Y7QUFFQSxVQUFNLE9BQU8sT0FBTyxLQUFLLGVBQWU7QUFDeEMsYUFBUyxJQUFJLEdBQUcsSUFBSSxLQUFLLFFBQVEsS0FBSztBQUNwQyxZQUFNLE9BQU8sZ0JBQWdCLEtBQUssQ0FBQyxDQUFDO0FBS3BDLFVBQUksT0FBTyxLQUFLLENBQUMsRUFBRSxTQUFTLFVBQVU7QUFDcEMsY0FBTSxPQUFPLEtBQUssQ0FBQztBQUNuQixjQUFNLE9BQU8sS0FBSztBQUNsQixZQUFJLEtBQUssS0FBSyxXQUFXLE1BQU0sR0FBRztBQUNoQyxnQkFBTUEsUUFBTyxLQUFLLFNBQVMsT0FBTyxFQUFFLEtBQUssZ0JBQWdCLENBQUM7QUFDMUQsZ0JBQU0sT0FBT0EsTUFBSyxTQUFTLEtBQUs7QUFBQSxZQUM5QixLQUFLO0FBQUEsWUFDTCxNQUFNLEtBQUs7QUFBQSxZQUNYLE9BQU8sS0FBSztBQUFBLFVBQ2QsQ0FBQztBQUNELGVBQUssWUFBWSxLQUFLLHlCQUF5QixJQUFJO0FBQ25ELFVBQUFBLE1BQUssUUFBUSxhQUFhLE1BQU07QUFDaEM7QUFBQSxRQUNGO0FBQUEsTUFDRjtBQUlBLFVBQUk7QUFDSixZQUFNLHNCQUFzQixLQUFLLE1BQU0sS0FBSyxDQUFDLEVBQUUsYUFBYSxHQUFHLElBQUk7QUFDbkUsVUFBSSxLQUFLLFNBQVMsZ0JBQWdCO0FBQ2hDLGNBQU0sTUFBTSxLQUFLLENBQUMsRUFBRSxLQUFLLE1BQU0sR0FBRztBQUNsQyx5QkFBaUIsSUFBSSxJQUFJLFNBQVMsQ0FBQztBQUNuQyxjQUFNLE9BQU8sSUFBSSxNQUFNLEdBQUcsSUFBSSxTQUFTLENBQUMsRUFBRSxLQUFLLEdBQUc7QUFDbEQseUJBQWlCLFVBQVUsVUFBVSxrQ0FBa0M7QUFBQSxNQUN6RSxPQUFPO0FBQ0wseUJBQWlCLEtBQUssQ0FBQyxFQUFFLEtBQUssTUFBTSxHQUFHLEVBQUUsSUFBSTtBQUU3QywwQkFBa0IsUUFBUTtBQUFBLE1BQzVCO0FBTUEsVUFBRyxDQUFDLEtBQUsscUJBQXFCLEtBQUssQ0FBQyxFQUFFLElBQUksR0FBRztBQUMzQyxjQUFNQSxRQUFPLEtBQUssU0FBUyxPQUFPLEVBQUUsS0FBSyxnQkFBZ0IsQ0FBQztBQUMxRCxjQUFNRSxhQUFZRixNQUFLLFNBQVMsS0FBSztBQUFBLFVBQ25DLEtBQUs7QUFBQSxVQUNMLE9BQU8sS0FBSyxDQUFDLEVBQUU7QUFBQSxRQUNqQixDQUFDO0FBQ0QsUUFBQUUsV0FBVSxZQUFZO0FBRXRCLGFBQUssbUJBQW1CQSxZQUFXLEtBQUssQ0FBQyxHQUFHRixLQUFJO0FBQ2hEO0FBQUEsTUFDRjtBQUlBLHVCQUFpQixlQUFlLFFBQVEsT0FBTyxFQUFFLEVBQUUsUUFBUSxNQUFNLEtBQUs7QUFDdEUsWUFBTSxPQUFPLEtBQUssU0FBUyxPQUFPLEVBQUUsS0FBSyxvQkFBb0IsQ0FBQztBQUM5RCxZQUFNLFNBQVMsS0FBSyxTQUFTLFFBQVEsRUFBRSxLQUFLLGVBQWUsQ0FBQztBQUU1RCxlQUFTLFFBQVEsUUFBUSxnQkFBZ0I7QUFDekMsWUFBTSxZQUFZLE9BQU8sU0FBUyxLQUFLO0FBQUEsUUFDckMsS0FBSztBQUFBLFFBQ0wsT0FBTyxLQUFLLENBQUMsRUFBRTtBQUFBLE1BQ2pCLENBQUM7QUFDRCxnQkFBVSxZQUFZO0FBRXRCLFdBQUssbUJBQW1CLFdBQVcsS0FBSyxDQUFDLEdBQUcsTUFBTTtBQUNsRCxhQUFPLGlCQUFpQixTQUFTLENBQUMsVUFBVTtBQUUxQyxZQUFJLFNBQVMsTUFBTTtBQUNuQixlQUFPLENBQUMsT0FBTyxVQUFVLFNBQVMsZUFBZSxHQUFHO0FBQ2xELG1CQUFTLE9BQU87QUFBQSxRQUNsQjtBQUNBLGVBQU8sVUFBVSxPQUFPLGNBQWM7QUFBQSxNQUV4QyxDQUFDO0FBQ0QsWUFBTSxpQkFBaUIsS0FBSyxTQUFTLElBQUk7QUFFekMsZUFBUyxJQUFJLEdBQUcsSUFBSSxLQUFLLFFBQVEsS0FBSztBQUVwQyxZQUFHLEtBQUssQ0FBQyxFQUFFLEtBQUssUUFBUSxHQUFHLElBQUksSUFBSTtBQUNqQyxnQkFBTSxRQUFRLEtBQUssQ0FBQztBQUNwQixnQkFBTSxhQUFhLGVBQWUsU0FBUyxNQUFNO0FBQUEsWUFDL0MsS0FBSztBQUFBLFlBQ0wsT0FBTyxNQUFNO0FBQUEsVUFDZixDQUFDO0FBRUQsY0FBRyxLQUFLLFNBQVMsR0FBRztBQUNsQixrQkFBTSxnQkFBZ0IsS0FBSyxxQkFBcUIsS0FBSztBQUNyRCxrQkFBTSx1QkFBdUIsS0FBSyxNQUFNLE1BQU0sYUFBYSxHQUFHLElBQUk7QUFDbEUsdUJBQVcsWUFBWSxVQUFVLG1CQUFtQjtBQUFBLFVBQ3REO0FBQ0EsZ0JBQU0sa0JBQWtCLFdBQVcsU0FBUyxLQUFLO0FBRWpELG1CQUFTLGlCQUFpQixlQUFnQixNQUFNLEtBQUssZ0JBQWdCLE1BQU0sTUFBTSxFQUFDLE9BQU8sSUFBSSxXQUFXLElBQUksQ0FBQyxHQUFJLGlCQUFpQixNQUFNLE1BQU0sSUFBSSxTQUFTLFVBQVUsQ0FBQztBQUV0SyxlQUFLLG1CQUFtQixZQUFZLE9BQU8sY0FBYztBQUFBLFFBQzNELE9BQUs7QUFFSCxnQkFBTUcsa0JBQWlCLEtBQUssU0FBUyxJQUFJO0FBQ3pDLGdCQUFNLGFBQWFBLGdCQUFlLFNBQVMsTUFBTTtBQUFBLFlBQy9DLEtBQUs7QUFBQSxZQUNMLE9BQU8sS0FBSyxDQUFDLEVBQUU7QUFBQSxVQUNqQixDQUFDO0FBQ0QsZ0JBQU0sa0JBQWtCLFdBQVcsU0FBUyxLQUFLO0FBQ2pELGNBQUksa0JBQWtCLE1BQU0sS0FBSyxlQUFlLEtBQUssQ0FBQyxFQUFFLE1BQU0sRUFBQyxPQUFPLElBQUksV0FBVyxJQUFJLENBQUM7QUFDMUYsY0FBRyxDQUFDO0FBQWlCO0FBQ3JCLG1CQUFTLGlCQUFpQixlQUFlLGlCQUFpQixpQkFBaUIsS0FBSyxDQUFDLEVBQUUsTUFBTSxJQUFJLFNBQVMsVUFBVSxDQUFDO0FBQ2pILGVBQUssbUJBQW1CLFlBQVksS0FBSyxDQUFDLEdBQUdBLGVBQWM7QUFBQSxRQUU3RDtBQUFBLE1BQ0Y7QUFBQSxJQUNGO0FBQ0EsU0FBSyxhQUFhLFdBQVcsTUFBTTtBQUFBLEVBQ3JDO0FBQUEsRUFFQSxtQkFBbUIsTUFBTSxNQUFNLE1BQU07QUFDbkMsU0FBSyxpQkFBaUIsU0FBUyxPQUFPLFVBQVU7QUFDOUMsWUFBTSxLQUFLLFVBQVUsTUFBTSxLQUFLO0FBQUEsSUFDbEMsQ0FBQztBQUdELFNBQUssUUFBUSxhQUFhLE1BQU07QUFDaEMsU0FBSyxpQkFBaUIsYUFBYSxDQUFDLFVBQVU7QUFDNUMsWUFBTSxjQUFjLEtBQUssSUFBSTtBQUM3QixZQUFNLFlBQVksS0FBSyxLQUFLLE1BQU0sR0FBRyxFQUFFLENBQUM7QUFDeEMsWUFBTSxPQUFPLEtBQUssSUFBSSxjQUFjLHFCQUFxQixXQUFXLEVBQUU7QUFDdEUsWUFBTSxXQUFXLFlBQVksU0FBUyxPQUFPLElBQUk7QUFFakQsa0JBQVksWUFBWSxPQUFPLFFBQVE7QUFBQSxJQUN6QyxDQUFDO0FBRUQsUUFBSSxLQUFLLEtBQUssUUFBUSxHQUFHLElBQUk7QUFBSTtBQUVqQyxTQUFLLGlCQUFpQixhQUFhLENBQUMsVUFBVTtBQUM1QyxXQUFLLElBQUksVUFBVSxRQUFRLGNBQWM7QUFBQSxRQUN2QztBQUFBLFFBQ0EsUUFBUTtBQUFBLFFBQ1IsYUFBYTtBQUFBLFFBQ2IsVUFBVTtBQUFBLFFBQ1YsVUFBVSxLQUFLO0FBQUEsTUFDakIsQ0FBQztBQUFBLElBQ0gsQ0FBQztBQUFBLEVBQ0g7QUFBQTtBQUFBO0FBQUEsRUFJQSxNQUFNLFVBQVUsTUFBTSxRQUFNLE1BQU07QUFDaEMsUUFBSTtBQUNKLFFBQUk7QUFDSixRQUFJLEtBQUssS0FBSyxRQUFRLEdBQUcsSUFBSSxJQUFJO0FBRS9CLG1CQUFhLEtBQUssSUFBSSxjQUFjLHFCQUFxQixLQUFLLEtBQUssTUFBTSxHQUFHLEVBQUUsQ0FBQyxHQUFHLEVBQUU7QUFFcEYsWUFBTSxvQkFBb0IsS0FBSyxJQUFJLGNBQWMsYUFBYSxVQUFVO0FBR3hFLFVBQUksZUFBZSxLQUFLLEtBQUssTUFBTSxHQUFHLEVBQUUsSUFBSTtBQUU1QyxVQUFJLFlBQVk7QUFDaEIsVUFBSSxhQUFhLFFBQVEsR0FBRyxJQUFJLElBQUk7QUFFbEMsb0JBQVksU0FBUyxhQUFhLE1BQU0sR0FBRyxFQUFFLENBQUMsRUFBRSxNQUFNLEdBQUcsRUFBRSxDQUFDLENBQUM7QUFFN0QsdUJBQWUsYUFBYSxNQUFNLEdBQUcsRUFBRSxDQUFDO0FBQUEsTUFDMUM7QUFFQSxZQUFNLFdBQVcsa0JBQWtCO0FBRW5DLGVBQVEsSUFBSSxHQUFHLElBQUksU0FBUyxRQUFRLEtBQUs7QUFDdkMsWUFBSSxTQUFTLENBQUMsRUFBRSxZQUFZLGNBQWM7QUFFeEMsY0FBRyxjQUFjLEdBQUc7QUFDbEIsc0JBQVUsU0FBUyxDQUFDO0FBQ3BCO0FBQUEsVUFDRjtBQUNBO0FBQUEsUUFDRjtBQUFBLE1BQ0Y7QUFBQSxJQUVGLE9BQU87QUFDTCxtQkFBYSxLQUFLLElBQUksY0FBYyxxQkFBcUIsS0FBSyxNQUFNLEVBQUU7QUFBQSxJQUN4RTtBQUNBLFFBQUk7QUFDSixRQUFHLE9BQU87QUFFUixZQUFNLE1BQU0sU0FBUyxPQUFPLFdBQVcsS0FBSztBQUU1QyxhQUFPLEtBQUssSUFBSSxVQUFVLFFBQVEsR0FBRztBQUFBLElBQ3ZDLE9BQUs7QUFFSCxhQUFPLEtBQUssSUFBSSxVQUFVLGtCQUFrQjtBQUFBLElBQzlDO0FBQ0EsVUFBTSxLQUFLLFNBQVMsVUFBVTtBQUM5QixRQUFJLFNBQVM7QUFDWCxVQUFJLEVBQUUsT0FBTyxJQUFJLEtBQUs7QUFDdEIsWUFBTSxNQUFNLEVBQUUsTUFBTSxRQUFRLFNBQVMsTUFBTSxNQUFNLElBQUksRUFBRTtBQUN2RCxhQUFPLFVBQVUsR0FBRztBQUNwQixhQUFPLGVBQWUsRUFBRSxJQUFJLEtBQUssTUFBTSxJQUFJLEdBQUcsSUFBSTtBQUFBLElBQ3BEO0FBQUEsRUFDRjtBQUFBLEVBRUEscUJBQXFCLE9BQU87QUFDMUIsVUFBTSxpQkFBaUIsTUFBTSxLQUFLLE1BQU0sS0FBSyxFQUFFLENBQUMsRUFBRSxNQUFNLEdBQUc7QUFFM0QsUUFBSSxnQkFBZ0I7QUFDcEIsYUFBUyxJQUFJLGVBQWUsU0FBUyxHQUFHLEtBQUssR0FBRyxLQUFLO0FBQ25ELFVBQUcsY0FBYyxTQUFTLEdBQUc7QUFDM0Isd0JBQWdCLE1BQU07QUFBQSxNQUN4QjtBQUNBLHNCQUFnQixlQUFlLENBQUMsSUFBSTtBQUVwQyxVQUFJLGNBQWMsU0FBUyxLQUFLO0FBQzlCO0FBQUEsTUFDRjtBQUFBLElBQ0Y7QUFFQSxRQUFJLGNBQWMsV0FBVyxLQUFLLEdBQUc7QUFDbkMsc0JBQWdCLGNBQWMsTUFBTSxDQUFDO0FBQUEsSUFDdkM7QUFDQSxXQUFPO0FBQUEsRUFFVDtBQUFBLEVBRUEscUJBQXFCLE1BQU07QUFDekIsV0FBUSxLQUFLLFFBQVEsS0FBSyxNQUFNLE1BQVEsS0FBSyxRQUFRLGFBQWEsTUFBTTtBQUFBLEVBQzFFO0FBQUEsRUFFQSx5QkFBeUIsTUFBSztBQUM1QixRQUFHLEtBQUssUUFBUTtBQUNkLFVBQUcsS0FBSyxXQUFXO0FBQVMsYUFBSyxTQUFTO0FBQzFDLGFBQU8sVUFBVSxLQUFLLHFCQUFxQixLQUFLO0FBQUEsSUFDbEQ7QUFFQSxRQUFJLFNBQVMsS0FBSyxLQUFLLFFBQVEsaUJBQWlCLEVBQUU7QUFFbEQsYUFBUyxPQUFPLE1BQU0sR0FBRyxFQUFFLENBQUM7QUFFNUIsV0FBTyxvQkFBYSxxQkFBcUIsS0FBSztBQUFBLEVBQ2hEO0FBQUE7QUFBQSxFQUVBLE1BQU0sa0JBQWtCO0FBQ3RCLFFBQUcsQ0FBQyxLQUFLLFdBQVcsS0FBSyxRQUFRLFdBQVcsR0FBRTtBQUM1QyxXQUFLLFVBQVUsTUFBTSxLQUFLLFlBQVk7QUFBQSxJQUN4QztBQUNBLFdBQU8sS0FBSztBQUFBLEVBQ2Q7QUFBQTtBQUFBLEVBRUEsTUFBTSxZQUFZLE9BQU8sS0FBSztBQUM1QixRQUFJLFdBQVcsTUFBTSxLQUFLLElBQUksTUFBTSxRQUFRLEtBQUssSUFBSSxHQUFHO0FBQ3hELFFBQUksY0FBYyxDQUFDO0FBQ25CLGFBQVMsSUFBSSxHQUFHLElBQUksUUFBUSxRQUFRLEtBQUs7QUFDdkMsVUFBSSxRQUFRLENBQUMsRUFBRSxXQUFXLEdBQUc7QUFBRztBQUNoQyxrQkFBWSxLQUFLLFFBQVEsQ0FBQyxDQUFDO0FBQzNCLG9CQUFjLFlBQVksT0FBTyxNQUFNLEtBQUssWUFBWSxRQUFRLENBQUMsSUFBSSxHQUFHLENBQUM7QUFBQSxJQUMzRTtBQUNBLFdBQU87QUFBQSxFQUNUO0FBQUEsRUFHQSxNQUFNLGFBQWE7QUFFakIsUUFBRyxDQUFDLEtBQUssU0FBUyxhQUFZO0FBQzVCLFVBQUksU0FBUyxPQUFPLGtHQUFrRztBQUN0SDtBQUFBLElBQ0Y7QUFDQSxZQUFRLElBQUksZUFBZTtBQUUzQixVQUFNLFFBQVEsS0FBSyxJQUFJLE1BQU0saUJBQWlCLEVBQUUsT0FBTyxDQUFDLFNBQVM7QUFFL0QsZUFBUSxJQUFJLEdBQUcsSUFBSSxLQUFLLGdCQUFnQixRQUFRLEtBQUs7QUFDbkQsWUFBRyxLQUFLLEtBQUssUUFBUSxLQUFLLGdCQUFnQixDQUFDLENBQUMsSUFBSSxJQUFJO0FBQ2xELGlCQUFPO0FBQUEsUUFDVDtBQUFBLE1BQ0Y7QUFDQSxhQUFPO0FBQUEsSUFDVCxDQUFDO0FBQ0QsVUFBTSxRQUFRLE1BQU0sS0FBSyxtQkFBbUIsS0FBSztBQUNqRCxZQUFRLElBQUksY0FBYztBQUUxQixVQUFNLEtBQUssSUFBSSxNQUFNLFFBQVEsTUFBTSxpQ0FBaUMsS0FBSyxVQUFVLE9BQU8sTUFBTSxDQUFDLENBQUM7QUFDbEcsWUFBUSxJQUFJLGFBQWE7QUFDekIsWUFBUSxJQUFJLEtBQUssU0FBUyxXQUFXO0FBRXJDLFVBQU0sV0FBVyxPQUFPLEdBQUcsU0FBUyxZQUFZO0FBQUEsTUFDOUMsS0FBSztBQUFBLE1BQ0wsUUFBUTtBQUFBLE1BQ1IsU0FBUztBQUFBLFFBQ1AsZ0JBQWdCO0FBQUEsTUFDbEI7QUFBQSxNQUNBLGFBQWE7QUFBQSxNQUNiLE1BQU0sS0FBSyxVQUFVO0FBQUEsUUFDbkIsYUFBYSxLQUFLLFNBQVM7QUFBQSxRQUMzQjtBQUFBLE1BQ0YsQ0FBQztBQUFBLElBQ0gsQ0FBQztBQUNELFlBQVEsSUFBSSxRQUFRO0FBQUEsRUFFdEI7QUFBQSxFQUVBLE1BQU0sbUJBQW1CLE9BQU87QUFDOUIsUUFBSSxTQUFTLENBQUM7QUFFZCxhQUFRLElBQUksR0FBRyxJQUFJLE1BQU0sUUFBUSxLQUFLO0FBQ3BDLFVBQUksT0FBTyxNQUFNLENBQUM7QUFDbEIsVUFBSSxRQUFRLEtBQUssS0FBSyxNQUFNLEdBQUc7QUFDL0IsVUFBSSxVQUFVO0FBRWQsZUFBUyxLQUFLLEdBQUcsS0FBSyxNQUFNLFFBQVEsTUFBTTtBQUN4QyxZQUFJLE9BQU8sTUFBTSxFQUFFO0FBRW5CLFlBQUksT0FBTyxNQUFNLFNBQVMsR0FBRztBQUUzQixrQkFBUSxJQUFJLElBQUksTUFBTSxLQUFLLElBQUksTUFBTSxXQUFXLElBQUk7QUFBQSxRQUN0RCxPQUFPO0FBRUwsY0FBSSxDQUFDLFFBQVEsSUFBSSxHQUFHO0FBQ2xCLG9CQUFRLElBQUksSUFBSSxDQUFDO0FBQUEsVUFDbkI7QUFFQSxvQkFBVSxRQUFRLElBQUk7QUFBQSxRQUN4QjtBQUFBLE1BQ0Y7QUFBQSxJQUNGO0FBRUEsV0FBTztBQUFBLEVBQ1Q7QUFFRjtBQUVBLElBQU0sOEJBQThCO0FBQ3BDLElBQU0sdUJBQU4sY0FBbUMsU0FBUyxTQUFTO0FBQUEsRUFDbkQsWUFBWSxNQUFNLFFBQVE7QUFDeEIsVUFBTSxJQUFJO0FBQ1YsU0FBSyxTQUFTO0FBQ2QsU0FBSyxVQUFVO0FBQ2YsU0FBSyxZQUFZO0FBQUEsRUFDbkI7QUFBQSxFQUNBLGNBQWM7QUFDWixXQUFPO0FBQUEsRUFDVDtBQUFBLEVBRUEsaUJBQWlCO0FBQ2YsV0FBTztBQUFBLEVBQ1Q7QUFBQSxFQUVBLFVBQVU7QUFDUixXQUFPO0FBQUEsRUFDVDtBQUFBLEVBR0EsWUFBWSxTQUFTO0FBQ25CLFVBQU0sWUFBWSxLQUFLLFlBQVksU0FBUyxDQUFDO0FBRTdDLGNBQVUsTUFBTTtBQUVoQixTQUFLLGlCQUFpQixTQUFTO0FBRS9CLFFBQUksTUFBTSxRQUFRLE9BQU8sR0FBRztBQUMxQixlQUFTLElBQUksR0FBRyxJQUFJLFFBQVEsUUFBUSxLQUFLO0FBQ3ZDLGtCQUFVLFNBQVMsS0FBSyxFQUFFLEtBQUssY0FBYyxNQUFNLFFBQVEsQ0FBQyxFQUFFLENBQUM7QUFBQSxNQUNqRTtBQUFBLElBQ0YsT0FBSztBQUVILGdCQUFVLFNBQVMsS0FBSyxFQUFFLEtBQUssY0FBYyxNQUFNLFFBQVEsQ0FBQztBQUFBLElBQzlEO0FBQUEsRUFDRjtBQUFBLEVBQ0EsaUJBQWlCLE1BQU0saUJBQWUsT0FBTztBQUszQyxRQUFJLENBQUMsZ0JBQWdCO0FBQ25CLGFBQU8sS0FBSyxNQUFNLEdBQUcsRUFBRSxJQUFJO0FBQUEsSUFDN0I7QUFFQSxRQUFJLEtBQUssUUFBUSxHQUFHLElBQUksSUFBSTtBQUUxQixhQUFPLEtBQUssTUFBTSxLQUFLO0FBRXZCLFdBQUssQ0FBQyxJQUFJLFVBQVUsS0FBSyxDQUFDO0FBRTFCLGFBQU8sS0FBSyxLQUFLLEVBQUU7QUFFbkIsYUFBTyxLQUFLLFFBQVEsT0FBTyxRQUFLO0FBQUEsSUFDbEMsT0FBSztBQUVILGFBQU8sS0FBSyxRQUFRLE9BQU8sRUFBRTtBQUFBLElBQy9CO0FBQ0EsV0FBTztBQUFBLEVBQ1Q7QUFBQSxFQUdBLFlBQVksU0FBUyxrQkFBZ0IsTUFBTSxlQUFhLE9BQU87QUFFN0QsVUFBTSxZQUFZLEtBQUssWUFBWSxTQUFTLENBQUM7QUFFN0MsUUFBRyxDQUFDLGNBQWE7QUFFZixnQkFBVSxNQUFNO0FBQ2hCLFdBQUssaUJBQWlCLFdBQVcsZUFBZTtBQUFBLElBQ2xEO0FBRUEsU0FBSyxPQUFPLGVBQWUsV0FBVyxPQUFPO0FBQUEsRUFDL0M7QUFBQSxFQUVBLGlCQUFpQixXQUFXLGtCQUFnQixNQUFNO0FBQ2hELFFBQUk7QUFFSixRQUFLLFVBQVUsU0FBUyxTQUFTLEtBQU8sVUFBVSxTQUFTLENBQUMsRUFBRSxVQUFVLFNBQVMsWUFBWSxHQUFJO0FBQy9GLGdCQUFVLFVBQVUsU0FBUyxDQUFDO0FBQzlCLGNBQVEsTUFBTTtBQUFBLElBQ2hCLE9BQU87QUFFTCxnQkFBVSxVQUFVLFNBQVMsT0FBTyxFQUFFLEtBQUssYUFBYSxDQUFDO0FBQUEsSUFDM0Q7QUFFQSxRQUFJLGlCQUFpQjtBQUNuQixjQUFRLFNBQVMsS0FBSyxFQUFFLEtBQUssY0FBYyxNQUFNLGdCQUFnQixDQUFDO0FBQUEsSUFDcEU7QUFFQSxVQUFNLGNBQWMsUUFBUSxTQUFTLFVBQVUsRUFBRSxLQUFLLGlCQUFpQixDQUFDO0FBRXhFLGFBQVMsUUFBUSxhQUFhLGdCQUFnQjtBQUU5QyxnQkFBWSxpQkFBaUIsU0FBUyxNQUFNO0FBRTFDLFdBQUssT0FBTyxVQUFVO0FBQUEsSUFDeEIsQ0FBQztBQUVELFVBQU0sZ0JBQWdCLFFBQVEsU0FBUyxVQUFVLEVBQUUsS0FBSyxtQkFBbUIsQ0FBQztBQUU1RSxhQUFTLFFBQVEsZUFBZSxRQUFRO0FBRXhDLGtCQUFjLGlCQUFpQixTQUFTLE1BQU07QUFFNUMsY0FBUSxNQUFNO0FBRWQsWUFBTSxtQkFBbUIsUUFBUSxTQUFTLE9BQU8sRUFBRSxLQUFLLHlCQUF5QixDQUFDO0FBQ2xGLFlBQU0sUUFBUSxpQkFBaUIsU0FBUyxTQUFTO0FBQUEsUUFDL0MsS0FBSztBQUFBLFFBQ0wsTUFBTTtBQUFBLFFBQ04sYUFBYTtBQUFBLE1BQ2YsQ0FBQztBQUVELFlBQU0sTUFBTTtBQUVaLFlBQU0saUJBQWlCLFdBQVcsQ0FBQyxVQUFVO0FBRTNDLFlBQUksTUFBTSxRQUFRLFVBQVU7QUFDMUIsZUFBSyxvQkFBb0I7QUFFekIsZUFBSyxpQkFBaUIsV0FBVyxlQUFlO0FBQUEsUUFDbEQ7QUFBQSxNQUNGLENBQUM7QUFHRCxZQUFNLGlCQUFpQixTQUFTLENBQUMsVUFBVTtBQUV6QyxhQUFLLG9CQUFvQjtBQUV6QixjQUFNLGNBQWMsTUFBTTtBQUUxQixZQUFJLE1BQU0sUUFBUSxXQUFXLGdCQUFnQixJQUFJO0FBQy9DLGVBQUssT0FBTyxXQUFXO0FBQUEsUUFDekIsV0FFUyxnQkFBZ0IsSUFBSTtBQUUzQix1QkFBYSxLQUFLLGNBQWM7QUFFaEMsZUFBSyxpQkFBaUIsV0FBVyxNQUFNO0FBQ3JDLGlCQUFLLE9BQU8sYUFBYSxJQUFJO0FBQUEsVUFDL0IsR0FBRyxHQUFHO0FBQUEsUUFDUjtBQUFBLE1BQ0YsQ0FBQztBQUFBLElBQ0gsQ0FBQztBQUFBLEVBQ0g7QUFBQTtBQUFBLEVBR0EsNEJBQTRCO0FBRTFCLFVBQU0sWUFBWSxLQUFLLFlBQVksU0FBUyxDQUFDO0FBRTdDLGNBQVUsTUFBTTtBQUVoQixjQUFVLFNBQVMsTUFBTSxFQUFFLEtBQUssYUFBYSxNQUFNLDRCQUE0QixDQUFDO0FBRWhGLFVBQU0sYUFBYSxVQUFVLFNBQVMsT0FBTyxFQUFFLEtBQUssY0FBYyxDQUFDO0FBRW5FLFVBQU0sZ0JBQWdCLFdBQVcsU0FBUyxVQUFVLEVBQUUsS0FBSyxZQUFZLE1BQU0seUJBQXlCLENBQUM7QUFFdkcsZUFBVyxTQUFTLEtBQUssRUFBRSxLQUFLLGdCQUFnQixNQUFNLDBGQUEwRixDQUFDO0FBRWpKLFVBQU0sZUFBZSxXQUFXLFNBQVMsVUFBVSxFQUFFLEtBQUssWUFBWSxNQUFNLFFBQVEsQ0FBQztBQUVyRixlQUFXLFNBQVMsS0FBSyxFQUFFLEtBQUssZ0JBQWdCLE1BQU0sbUVBQW1FLENBQUM7QUFHMUgsa0JBQWMsaUJBQWlCLFNBQVMsT0FBTyxVQUFVO0FBRXZELFlBQU0sS0FBSyxPQUFPLGVBQWUscUJBQXFCO0FBRXRELFlBQU0sS0FBSyxtQkFBbUI7QUFBQSxJQUNoQyxDQUFDO0FBR0QsaUJBQWEsaUJBQWlCLFNBQVMsT0FBTyxVQUFVO0FBQ3RELGNBQVEsSUFBSSx1Q0FBdUM7QUFFbkQsWUFBTSxLQUFLLE9BQU8sVUFBVTtBQUU1QixZQUFNLEtBQUssbUJBQW1CO0FBQUEsSUFDaEMsQ0FBQztBQUFBLEVBQ0g7QUFBQSxFQUVBLE1BQU0sU0FBUztBQUNiLFVBQU0sWUFBWSxLQUFLLFlBQVksU0FBUyxDQUFDO0FBQzdDLGNBQVUsTUFBTTtBQUVoQixjQUFVLFNBQVMsS0FBSyxFQUFFLEtBQUssaUJBQWlCLE1BQU0sbUNBQW1DLENBQUM7QUFHMUYsU0FBSyxPQUFPLGNBQWMsS0FBSyxJQUFJLFVBQVUsR0FBRyxhQUFhLENBQUMsU0FBUztBQUVyRSxVQUFHLENBQUMsTUFBTTtBQUVSO0FBQUEsTUFDRjtBQUVBLFVBQUcscUJBQXFCLFFBQVEsS0FBSyxTQUFTLE1BQU0sSUFBSTtBQUN0RCxlQUFPLEtBQUssWUFBWTtBQUFBLFVBQ3RCLFdBQVMsS0FBSztBQUFBLFVBQ2IsdUNBQXFDLHFCQUFxQixLQUFLLElBQUksSUFBRTtBQUFBLFFBQ3hFLENBQUM7QUFBQSxNQUNIO0FBRUEsVUFBRyxLQUFLLFdBQVU7QUFDaEIscUJBQWEsS0FBSyxTQUFTO0FBQUEsTUFDN0I7QUFDQSxXQUFLLFlBQVksV0FBVyxNQUFNO0FBQ2hDLGFBQUssbUJBQW1CLElBQUk7QUFDNUIsYUFBSyxZQUFZO0FBQUEsTUFDbkIsR0FBRyxHQUFJO0FBQUEsSUFFVCxDQUFDLENBQUM7QUFFRixTQUFLLElBQUksVUFBVSx3QkFBd0IsNkJBQTZCO0FBQUEsTUFDcEUsU0FBUztBQUFBLE1BQ1QsWUFBWTtBQUFBLElBQ2hCLENBQUM7QUFDRCxTQUFLLElBQUksVUFBVSx3QkFBd0Isa0NBQWtDO0FBQUEsTUFDekUsU0FBUztBQUFBLE1BQ1QsWUFBWTtBQUFBLElBQ2hCLENBQUM7QUFFRCxTQUFLLElBQUksVUFBVSxjQUFjLEtBQUssV0FBVyxLQUFLLElBQUksQ0FBQztBQUFBLEVBRTdEO0FBQUEsRUFFQSxNQUFNLGFBQWE7QUFDakIsU0FBSyxZQUFZLDRCQUE0QjtBQUM3QyxVQUFNLGdCQUFnQixNQUFNLEtBQUssT0FBTyxVQUFVO0FBQ2xELFFBQUcsZUFBYztBQUNmLFdBQUssWUFBWSx5QkFBeUI7QUFDMUMsWUFBTSxLQUFLLG1CQUFtQjtBQUFBLElBQ2hDLE9BQUs7QUFDSCxXQUFLLDBCQUEwQjtBQUFBLElBQ2pDO0FBT0EsU0FBSyxNQUFNLElBQUksd0JBQXdCLEtBQUssS0FBSyxLQUFLLFFBQVEsSUFBSTtBQUVsRSxLQUFDLE9BQU8seUJBQXlCLElBQUksS0FBSyxRQUFRLEtBQUssU0FBUyxNQUFNLE9BQU8sT0FBTyx5QkFBeUIsQ0FBQztBQUFBLEVBRWhIO0FBQUEsRUFFQSxNQUFNLFVBQVU7QUFDZCxZQUFRLElBQUksZ0NBQWdDO0FBQzVDLFNBQUssSUFBSSxVQUFVLDBCQUEwQiwyQkFBMkI7QUFDeEUsU0FBSyxPQUFPLE9BQU87QUFBQSxFQUNyQjtBQUFBLEVBRUEsTUFBTSxtQkFBbUIsVUFBUSxNQUFNO0FBQ3JDLFlBQVEsSUFBSSx1QkFBdUI7QUFFbkMsUUFBRyxDQUFDLEtBQUssT0FBTyxTQUFTLFNBQVM7QUFDaEMsV0FBSyxZQUFZLHlEQUF5RDtBQUMxRTtBQUFBLElBQ0Y7QUFDQSxRQUFHLENBQUMsS0FBSyxPQUFPLG1CQUFrQjtBQUNoQyxZQUFNLEtBQUssT0FBTyxVQUFVO0FBQUEsSUFDOUI7QUFFQSxRQUFHLENBQUMsS0FBSyxPQUFPLG1CQUFtQjtBQUNqQyxjQUFRLElBQUksd0RBQXdEO0FBQ3BFLFdBQUssMEJBQTBCO0FBQy9CO0FBQUEsSUFDRjtBQUNBLFNBQUssWUFBWSw2QkFBNkI7QUFJOUMsUUFBRyxPQUFPLFlBQVksVUFBVTtBQUM5QixZQUFNLG1CQUFtQjtBQUV6QixZQUFNLEtBQUssT0FBTyxnQkFBZ0I7QUFDbEM7QUFBQSxJQUNGO0FBS0EsU0FBSyxVQUFVO0FBQ2YsU0FBSyxpQkFBaUI7QUFDdEIsU0FBSyxZQUFZO0FBQ2pCLFNBQUssT0FBTztBQUVaLFFBQUcsS0FBSyxVQUFVO0FBQ2hCLG9CQUFjLEtBQUssUUFBUTtBQUMzQixXQUFLLFdBQVc7QUFBQSxJQUNsQjtBQUVBLFNBQUssV0FBVyxZQUFZLE1BQU07QUFDaEMsVUFBRyxDQUFDLEtBQUssV0FBVTtBQUNqQixZQUFHLEtBQUssZ0JBQWdCLFNBQVMsT0FBTztBQUN0QyxlQUFLLFlBQVk7QUFDakIsZUFBSyx3QkFBd0IsS0FBSyxJQUFJO0FBQUEsUUFDeEMsT0FBSztBQUVILGVBQUssT0FBTyxLQUFLLElBQUksVUFBVSxjQUFjO0FBRTdDLGNBQUcsQ0FBQyxLQUFLLFFBQVEsS0FBSyxRQUFRLEdBQUc7QUFDL0IsMEJBQWMsS0FBSyxRQUFRO0FBQzNCLGlCQUFLLFlBQVksZ0JBQWdCO0FBQ2pDO0FBQUEsVUFDRjtBQUFBLFFBQ0Y7QUFBQSxNQUNGLE9BQUs7QUFDSCxZQUFHLEtBQUssU0FBUztBQUNmLHdCQUFjLEtBQUssUUFBUTtBQUUzQixjQUFJLE9BQU8sS0FBSyxZQUFZLFVBQVU7QUFDcEMsaUJBQUssWUFBWSxLQUFLLE9BQU87QUFBQSxVQUMvQixPQUFPO0FBRUwsaUJBQUssWUFBWSxLQUFLLFNBQVMsV0FBVyxLQUFLLEtBQUssSUFBSTtBQUFBLFVBQzFEO0FBRUEsY0FBSSxLQUFLLE9BQU8sV0FBVyxrQkFBa0IsU0FBUyxHQUFHO0FBQ3ZELGlCQUFLLE9BQU8sdUJBQXVCO0FBQUEsVUFDckM7QUFFQSxlQUFLLE9BQU8sa0JBQWtCO0FBQzlCO0FBQUEsUUFDRixPQUFLO0FBQ0gsZUFBSztBQUNMLGVBQUssWUFBWSxnQ0FBOEIsS0FBSyxjQUFjO0FBQUEsUUFDcEU7QUFBQSxNQUNGO0FBQUEsSUFDRixHQUFHLEVBQUU7QUFBQSxFQUNQO0FBQUEsRUFFQSxNQUFNLHdCQUF3QixNQUFNO0FBQ2xDLFNBQUssVUFBVSxNQUFNLEtBQUssT0FBTyxzQkFBc0IsSUFBSTtBQUFBLEVBQzdEO0FBQUEsRUFFQSxzQkFBc0I7QUFDcEIsUUFBSSxLQUFLLGdCQUFnQjtBQUN2QixtQkFBYSxLQUFLLGNBQWM7QUFDaEMsV0FBSyxpQkFBaUI7QUFBQSxJQUN4QjtBQUFBLEVBQ0Y7QUFBQSxFQUVBLE1BQU0sT0FBTyxhQUFhLGVBQWEsT0FBTztBQUM1QyxVQUFNLFVBQVUsTUFBTSxLQUFLLE9BQU8sSUFBSSxPQUFPLFdBQVc7QUFFeEQsVUFBTSxrQkFBa0IsZUFBZSxZQUFZLFNBQVMsTUFBTSxZQUFZLFVBQVUsR0FBRyxHQUFHLElBQUksUUFBUTtBQUMxRyxTQUFLLFlBQVksU0FBUyxpQkFBaUIsWUFBWTtBQUFBLEVBQ3pEO0FBRUY7QUFDQSxJQUFNLDBCQUFOLE1BQThCO0FBQUEsRUFDNUIsWUFBWSxLQUFLLFFBQVEsTUFBTTtBQUM3QixTQUFLLE1BQU07QUFDWCxTQUFLLFNBQVM7QUFDZCxTQUFLLE9BQU87QUFBQSxFQUNkO0FBQUEsRUFDQSxNQUFNLE9BQVEsYUFBYTtBQUN6QixXQUFPLE1BQU0sS0FBSyxPQUFPLElBQUksT0FBTyxXQUFXO0FBQUEsRUFDakQ7QUFBQTtBQUFBLEVBRUEsTUFBTSx5QkFBeUI7QUFDN0IsVUFBTSxLQUFLLE9BQU8sVUFBVTtBQUM1QixVQUFNLEtBQUssS0FBSyxtQkFBbUI7QUFBQSxFQUNyQztBQUNGO0FBQ0EsSUFBTSxjQUFOLE1BQWtCO0FBQUEsRUFDaEIsWUFBWSxLQUFLLFFBQVE7QUFDdkIsU0FBSyxNQUFNO0FBQ1gsU0FBSyxTQUFTO0FBQUEsRUFDaEI7QUFBQSxFQUNBLE1BQU0sT0FBUSxhQUFhLFNBQU8sQ0FBQyxHQUFHO0FBQ3BDLGFBQVM7QUFBQSxNQUNQLGVBQWUsS0FBSyxPQUFPLFNBQVM7QUFBQSxNQUNwQyxHQUFHO0FBQUEsSUFDTDtBQUNBLFFBQUksVUFBVSxDQUFDO0FBQ2YsVUFBTSxPQUFPLE1BQU0sS0FBSyxPQUFPLDZCQUE2QixXQUFXO0FBQ3ZFLFFBQUksUUFBUSxLQUFLLFFBQVEsS0FBSyxLQUFLLENBQUMsS0FBSyxLQUFLLEtBQUssQ0FBQyxFQUFFLFdBQVc7QUFDL0QsZ0JBQVUsS0FBSyxPQUFPLGVBQWUsUUFBUSxLQUFLLEtBQUssQ0FBQyxFQUFFLFdBQVcsTUFBTTtBQUFBLElBQzdFLE9BQU87QUFFTCxVQUFJLFNBQVMsT0FBTyw0Q0FBNEM7QUFBQSxJQUNsRTtBQUNBLFdBQU87QUFBQSxFQUNUO0FBQ0Y7QUFFQSxJQUFNLDhCQUFOLGNBQTBDLFNBQVMsaUJBQWlCO0FBQUEsRUFDbEUsWUFBWSxLQUFLLFFBQVE7QUFDdkIsVUFBTSxLQUFLLE1BQU07QUFDakIsU0FBSyxTQUFTO0FBQUEsRUFDaEI7QUFBQSxFQUNBLFVBQVU7QUFDUixVQUFNO0FBQUEsTUFDSjtBQUFBLElBQ0YsSUFBSTtBQUNKLGdCQUFZLE1BQU07QUFDbEIsZ0JBQVksU0FBUyxNQUFNLEVBQUUsTUFBTSxxQkFBcUIsQ0FBQztBQUV6RCxnQkFBWSxTQUFTLEtBQUs7QUFBQSxNQUN4QixNQUFNO0FBQUEsSUFDUixDQUFDO0FBRUQsVUFBTSwwQkFBMEIsWUFBWSxTQUFTLElBQUk7QUFDekQsNEJBQXdCLFNBQVMsTUFBTSxFQUFFLE1BQU0scUZBQXFGLENBQUM7QUFDckksNEJBQXdCLFNBQVMsTUFBTSxFQUFFLE1BQU0sdURBQXVELENBQUM7QUFDdkcsVUFBTSxTQUFTLHdCQUF3QixTQUFTLElBQUk7QUFDcEQsV0FBTyxZQUFZO0FBQ25CLDRCQUF3QixTQUFTLE1BQU0sRUFBRSxNQUFNLDBFQUEwRSxDQUFDO0FBRTFILFFBQUksU0FBUyxRQUFRLFdBQVcsRUFBRSxRQUFRLHlCQUF5QixFQUFFLFFBQVEsb0hBQW9ILEVBQUUsVUFBVSxDQUFDLFdBQVcsT0FBTyxjQUFjLGlCQUFpQixFQUFFLFFBQVEsWUFBWTtBQUNuUixZQUFNLEtBQUssT0FBTyxhQUFhO0FBQUEsSUFDakMsQ0FBQyxDQUFDO0FBRUYsUUFBSSxTQUFTLFFBQVEsV0FBVyxFQUFFLFFBQVEsa0JBQWtCLEVBQUUsUUFBUSxzSEFBc0gsRUFBRSxVQUFVLENBQUMsV0FBVyxPQUFPLGNBQWMsa0JBQWtCLEVBQUUsUUFBUSxZQUFZO0FBRS9RLFlBQU0sS0FBSyxPQUFPLFdBQVc7QUFBQSxJQUMvQixDQUFDLENBQUM7QUFFRixRQUFJLFNBQVMsUUFBUSxXQUFXLEVBQUUsUUFBUSx1QkFBdUIsRUFBRSxRQUFRLHNEQUFzRCxFQUFFLFFBQVEsQ0FBQyxTQUFTLEtBQUssZUFBZSx3QkFBd0IsRUFBRSxTQUFTLEtBQUssT0FBTyxTQUFTLFdBQVcsRUFBRSxTQUFTLE9BQU8sVUFBVTtBQUN0USxXQUFLLE9BQU8sU0FBUyxjQUFjLE1BQU0sS0FBSztBQUM5QyxZQUFNLEtBQUssT0FBTyxhQUFhLElBQUk7QUFBQSxJQUNyQyxDQUFDLENBQUM7QUFFRixRQUFJLFNBQVMsUUFBUSxXQUFXLEVBQUUsUUFBUSwyQkFBMkIsRUFBRSxRQUFRLHFFQUFxRSxFQUFFLFVBQVUsQ0FBQyxXQUFXLE9BQU8sY0FBYyxvQkFBb0IsRUFBRSxRQUFRLFlBQVk7QUFDek8sWUFBTSxnQkFBZ0I7QUFBQSxRQUNwQjtBQUFBLFFBQ0E7QUFBQSxNQUNGO0FBQ0EsVUFBRyxDQUFDLEtBQUssT0FBTyxvQkFBbUI7QUFDakMsYUFBSyxPQUFPLHFCQUFxQixLQUFLLE1BQU0sS0FBSyxPQUFPLENBQUM7QUFBQSxNQUMzRDtBQUVBLGFBQU8sS0FBSyxjQUFjLEtBQUssT0FBTyxrQkFBa0IsQ0FBQztBQUFBLElBQzNELENBQUMsQ0FBQztBQUdGLGdCQUFZLFNBQVMsTUFBTTtBQUFBLE1BQ3pCLE1BQU07QUFBQSxJQUNSLENBQUM7QUFFRCxRQUFJLFNBQVMsUUFBUSxXQUFXLEVBQUUsUUFBUSxnQkFBZ0IsRUFBRSxRQUFRLDZFQUE2RSxFQUFFLFFBQVEsQ0FBQyxTQUFTLEtBQUssZUFBZSxvQkFBb0IsRUFBRSxTQUFTLEtBQUssT0FBTyxTQUFTLE9BQU8sRUFBRSxTQUFTLE9BQU8sVUFBVTtBQUM5USxXQUFLLE9BQU8sU0FBUyxVQUFVLE1BQU0sS0FBSztBQUMxQyxZQUFNLEtBQUssT0FBTyxhQUFhLElBQUk7QUFBQSxJQUNyQyxDQUFDLENBQUM7QUFFRixRQUFJLFNBQVMsUUFBUSxXQUFXLEVBQUUsUUFBUSxjQUFjLEVBQUUsUUFBUSxjQUFjLEVBQUUsVUFBVSxDQUFDLFdBQVcsT0FBTyxjQUFjLGNBQWMsRUFBRSxRQUFRLFlBQVk7QUFFL0osWUFBTSxPQUFPLE1BQU0sS0FBSyxPQUFPLGFBQWE7QUFDNUMsVUFBRyxNQUFNO0FBQ1AsWUFBSSxTQUFTLE9BQU8scUNBQXFDO0FBQUEsTUFDM0QsT0FBSztBQUNILFlBQUksU0FBUyxPQUFPLHdEQUF3RDtBQUFBLE1BQzlFO0FBQUEsSUFDRixDQUFDLENBQUM7QUFFRixRQUFJLFNBQVMsUUFBUSxXQUFXLEVBQUUsUUFBUSxrQkFBa0IsRUFBRSxRQUFRLHdDQUF3QyxFQUFFLFlBQVksQ0FBQyxhQUFhO0FBQ3hJLGVBQVMsVUFBVSxxQkFBcUIsbUJBQW1CO0FBQzNELGVBQVMsVUFBVSxTQUFTLDRCQUE0QjtBQUN4RCxlQUFTLFVBQVUsaUJBQWlCLG9CQUFvQjtBQUN4RCxlQUFTLFVBQVUsc0JBQXNCLG9CQUFvQjtBQUM3RCxlQUFTLFNBQVMsT0FBTyxVQUFVO0FBQ2pDLGFBQUssT0FBTyxTQUFTLG1CQUFtQjtBQUN4QyxjQUFNLEtBQUssT0FBTyxhQUFhO0FBQUEsTUFDakMsQ0FBQztBQUNELGVBQVMsU0FBUyxLQUFLLE9BQU8sU0FBUyxnQkFBZ0I7QUFBQSxJQUN6RCxDQUFDO0FBRUQsUUFBSSxTQUFTLFFBQVEsV0FBVyxFQUFFLFFBQVEsa0JBQWtCLEVBQUUsUUFBUSxvSEFBb0gsRUFBRSxZQUFZLENBQUMsYUFBYTtBQUVwTixZQUFNLFlBQVksT0FBTyxLQUFLLGlCQUFpQjtBQUMvQyxlQUFRLElBQUksR0FBRyxJQUFJLFVBQVUsUUFBUSxLQUFLO0FBQ3hDLGlCQUFTLFVBQVUsVUFBVSxDQUFDLEdBQUcsVUFBVSxDQUFDLENBQUM7QUFBQSxNQUMvQztBQUNBLGVBQVMsU0FBUyxPQUFPLFVBQVU7QUFDakMsYUFBSyxPQUFPLFNBQVMsV0FBVztBQUNoQyxjQUFNLEtBQUssT0FBTyxhQUFhO0FBQy9CLCtCQUF1QixRQUFRLEtBQUssa0JBQWtCLENBQUM7QUFFdkQsY0FBTSxZQUFZLEtBQUssSUFBSSxVQUFVLGdCQUFnQixnQ0FBZ0MsRUFBRSxTQUFTLElBQUksS0FBSyxJQUFJLFVBQVUsZ0JBQWdCLGdDQUFnQyxFQUFFLENBQUMsRUFBRSxPQUFPO0FBQ25MLFlBQUcsV0FBVztBQUNaLG9CQUFVLFNBQVM7QUFBQSxRQUNyQjtBQUFBLE1BQ0YsQ0FBQztBQUNELGVBQVMsU0FBUyxLQUFLLE9BQU8sU0FBUyxRQUFRO0FBQUEsSUFDakQsQ0FBQztBQUVELFVBQU0seUJBQXlCLFlBQVksU0FBUyxRQUFRO0FBQUEsTUFDMUQsTUFBTSxLQUFLLGtCQUFrQjtBQUFBLElBQy9CLENBQUM7QUFDRCxnQkFBWSxTQUFTLE1BQU07QUFBQSxNQUN6QixNQUFNO0FBQUEsSUFDUixDQUFDO0FBRUQsUUFBSSxTQUFTLFFBQVEsV0FBVyxFQUFFLFFBQVEsaUJBQWlCLEVBQUUsUUFBUSxnREFBZ0QsRUFBRSxRQUFRLENBQUMsU0FBUyxLQUFLLGVBQWUsdUJBQXVCLEVBQUUsU0FBUyxLQUFLLE9BQU8sU0FBUyxlQUFlLEVBQUUsU0FBUyxPQUFPLFVBQVU7QUFDN1AsV0FBSyxPQUFPLFNBQVMsa0JBQWtCO0FBQ3ZDLFlBQU0sS0FBSyxPQUFPLGFBQWE7QUFBQSxJQUNqQyxDQUFDLENBQUM7QUFFRixRQUFJLFNBQVMsUUFBUSxXQUFXLEVBQUUsUUFBUSxtQkFBbUIsRUFBRSxRQUFRLGtEQUFrRCxFQUFFLFFBQVEsQ0FBQyxTQUFTLEtBQUssZUFBZSx1QkFBdUIsRUFBRSxTQUFTLEtBQUssT0FBTyxTQUFTLGlCQUFpQixFQUFFLFNBQVMsT0FBTyxVQUFVO0FBQ25RLFdBQUssT0FBTyxTQUFTLG9CQUFvQjtBQUN6QyxZQUFNLEtBQUssT0FBTyxhQUFhO0FBQUEsSUFDakMsQ0FBQyxDQUFDO0FBRUYsUUFBSSxTQUFTLFFBQVEsV0FBVyxFQUFFLFFBQVEsV0FBVyxFQUFFLFFBQVEsNENBQTRDLEVBQUUsUUFBUSxDQUFDLFNBQVMsS0FBSyxlQUFlLHVCQUF1QixFQUFFLFNBQVMsS0FBSyxPQUFPLFNBQVMsU0FBUyxFQUFFLFNBQVMsT0FBTyxVQUFVO0FBQzdPLFdBQUssT0FBTyxTQUFTLFlBQVk7QUFDakMsWUFBTSxLQUFLLE9BQU8sYUFBYTtBQUFBLElBQ2pDLENBQUMsQ0FBQztBQUVGLFFBQUksU0FBUyxRQUFRLFdBQVcsRUFBRSxRQUFRLG1CQUFtQixFQUFFLFFBQVEsMkVBQTJFLEVBQUUsUUFBUSxDQUFDLFNBQVMsS0FBSyxlQUFlLHVCQUF1QixFQUFFLFNBQVMsS0FBSyxPQUFPLFNBQVMsaUJBQWlCLEVBQUUsU0FBUyxPQUFPLFVBQVU7QUFDNVIsV0FBSyxPQUFPLFNBQVMsb0JBQW9CO0FBQ3pDLFlBQU0sS0FBSyxPQUFPLGFBQWE7QUFBQSxJQUNqQyxDQUFDLENBQUM7QUFDRixnQkFBWSxTQUFTLE1BQU07QUFBQSxNQUN6QixNQUFNO0FBQUEsSUFDUixDQUFDO0FBRUQsUUFBSSxTQUFTLFFBQVEsV0FBVyxFQUFFLFFBQVEsZ0JBQWdCLEVBQUUsUUFBUSx5QkFBeUIsRUFBRSxVQUFVLENBQUMsV0FBVyxPQUFPLFNBQVMsS0FBSyxPQUFPLFNBQVMsY0FBYyxFQUFFLFNBQVMsT0FBTyxVQUFVO0FBQ2xNLFdBQUssT0FBTyxTQUFTLGlCQUFpQjtBQUN0QyxZQUFNLEtBQUssT0FBTyxhQUFhLElBQUk7QUFBQSxJQUNyQyxDQUFDLENBQUM7QUFFRixRQUFJLFNBQVMsUUFBUSxXQUFXLEVBQUUsUUFBUSxlQUFlLEVBQUUsUUFBUSwyQkFBMkIsRUFBRSxVQUFVLENBQUMsV0FBVyxPQUFPLFNBQVMsS0FBSyxPQUFPLFNBQVMsYUFBYSxFQUFFLFNBQVMsT0FBTyxVQUFVO0FBQ2xNLFdBQUssT0FBTyxTQUFTLGdCQUFnQjtBQUNyQyxZQUFNLEtBQUssT0FBTyxhQUFhLElBQUk7QUFBQSxJQUNyQyxDQUFDLENBQUM7QUFFRixRQUFJLFNBQVMsUUFBUSxXQUFXLEVBQUUsUUFBUSx1QkFBdUIsRUFBRSxRQUFRLHdCQUF3QixFQUFFLFVBQVUsQ0FBQyxXQUFXLE9BQU8sU0FBUyxLQUFLLE9BQU8sU0FBUyxxQkFBcUIsRUFBRSxTQUFTLE9BQU8sVUFBVTtBQUMvTSxXQUFLLE9BQU8sU0FBUyx3QkFBd0I7QUFDN0MsWUFBTSxLQUFLLE9BQU8sYUFBYSxJQUFJO0FBQUEsSUFDckMsQ0FBQyxDQUFDO0FBRUYsUUFBSSxTQUFTLFFBQVEsV0FBVyxFQUFFLFFBQVEsV0FBVyxFQUFFLFFBQVEsZ0NBQWdDLEVBQUUsVUFBVSxDQUFDLFdBQVcsT0FBTyxTQUFTLEtBQUssT0FBTyxTQUFTLFNBQVMsRUFBRSxTQUFTLE9BQU8sVUFBVTtBQUMvTCxXQUFLLE9BQU8sU0FBUyxZQUFZO0FBQ2pDLFlBQU0sS0FBSyxPQUFPLGFBQWEsSUFBSTtBQUFBLElBQ3JDLENBQUMsQ0FBQztBQUVGLFFBQUksU0FBUyxRQUFRLFdBQVcsRUFBRSxRQUFRLFdBQVcsRUFBRSxRQUFRLGdDQUFnQyxFQUFFLFVBQVUsQ0FBQyxXQUFXLE9BQU8sU0FBUyxLQUFLLE9BQU8sU0FBUyxTQUFTLEVBQUUsU0FBUyxPQUFPLFVBQVU7QUFDL0wsV0FBSyxPQUFPLFNBQVMsWUFBWTtBQUNqQyxZQUFNLEtBQUssT0FBTyxhQUFhLElBQUk7QUFBQSxJQUNyQyxDQUFDLENBQUM7QUFDRixnQkFBWSxTQUFTLE1BQU07QUFBQSxNQUN6QixNQUFNO0FBQUEsSUFDUixDQUFDO0FBRUQsUUFBSSxTQUFTLFFBQVEsV0FBVyxFQUFFLFFBQVEsWUFBWSxFQUFFLFFBQVEsdURBQXVELEVBQUUsVUFBVSxDQUFDLFdBQVcsT0FBTyxTQUFTLEtBQUssT0FBTyxTQUFTLFVBQVUsRUFBRSxTQUFTLE9BQU8sVUFBVTtBQUN4TixXQUFLLE9BQU8sU0FBUyxhQUFhO0FBQ2xDLFlBQU0sS0FBSyxPQUFPLGFBQWEsSUFBSTtBQUFBLElBQ3JDLENBQUMsQ0FBQztBQUVGLFFBQUksU0FBUyxRQUFRLFdBQVcsRUFBRSxRQUFRLGtCQUFrQixFQUFFLFFBQVEsNkRBQTZELEVBQUUsVUFBVSxDQUFDLFdBQVcsT0FBTyxTQUFTLEtBQUssT0FBTyxTQUFTLGdCQUFnQixFQUFFLFNBQVMsT0FBTyxVQUFVO0FBQzFPLFdBQUssT0FBTyxTQUFTLG1CQUFtQjtBQUN4QyxZQUFNLEtBQUssT0FBTyxhQUFhLElBQUk7QUFBQSxJQUNyQyxDQUFDLENBQUM7QUFFRixRQUFJLFNBQVMsUUFBUSxXQUFXLEVBQUUsUUFBUSxlQUFlLEVBQUUsUUFBUSwwS0FBMEssRUFBRSxVQUFVLENBQUMsV0FBVyxPQUFPLFNBQVMsS0FBSyxPQUFPLFNBQVMsYUFBYSxFQUFFLFNBQVMsT0FBTyxVQUFVO0FBQ2pWLFdBQUssT0FBTyxTQUFTLGdCQUFnQjtBQUNyQyxZQUFNLEtBQUssT0FBTyxhQUFhLElBQUk7QUFBQSxJQUNyQyxDQUFDLENBQUM7QUFFRixnQkFBWSxTQUFTLE1BQU07QUFBQSxNQUN6QixNQUFNO0FBQUEsSUFDUixDQUFDO0FBRUQsZ0JBQVksU0FBUyxNQUFNO0FBQUEsTUFDekIsTUFBTTtBQUFBLElBQ1IsQ0FBQztBQUNELFFBQUksc0JBQXNCLFlBQVksU0FBUyxLQUFLO0FBQ3BELFFBQUksU0FBUyxRQUFRLFdBQVcsRUFBRSxRQUFRLGFBQWEsRUFBRSxRQUFRLHlCQUF5QixFQUFFLFVBQVUsQ0FBQyxXQUFXLE9BQU8sY0FBYyxhQUFhLEVBQUUsUUFBUSxZQUFZO0FBRXhLLFVBQUksUUFBUSx3REFBd0QsR0FBRztBQUVyRSxZQUFHO0FBQ0QsZ0JBQU0sS0FBSyxPQUFPLHdCQUF3QixJQUFJO0FBQzlDLDhCQUFvQixZQUFZO0FBQUEsUUFDbEMsU0FBTyxHQUFOO0FBQ0MsOEJBQW9CLFlBQVksdUNBQXVDO0FBQUEsUUFDekU7QUFBQSxNQUNGO0FBQUEsSUFDRixDQUFDLENBQUM7QUFHRixnQkFBWSxTQUFTLE1BQU07QUFBQSxNQUN6QixNQUFNO0FBQUEsSUFDUixDQUFDO0FBQ0QsUUFBSSxjQUFjLFlBQVksU0FBUyxLQUFLO0FBQzVDLFNBQUssdUJBQXVCLFdBQVc7QUFHdkMsZ0JBQVksU0FBUyxNQUFNO0FBQUEsTUFDekIsTUFBTTtBQUFBLElBQ1IsQ0FBQztBQUNELFFBQUksU0FBUyxRQUFRLFdBQVcsRUFBRSxRQUFRLGVBQWUsRUFBRSxRQUFRLG9LQUFvSyxFQUFFLFVBQVUsQ0FBQyxXQUFXLE9BQU8sY0FBYyxlQUFlLEVBQUUsUUFBUSxZQUFZO0FBRXZULFVBQUksUUFBUSwwSEFBMEgsR0FBRztBQUV2SSxjQUFNLEtBQUssT0FBTyw4QkFBOEI7QUFBQSxNQUNsRDtBQUFBLElBQ0YsQ0FBQyxDQUFDO0FBQUEsRUFFSjtBQUFBLEVBQ0Esb0JBQW9CO0FBQ2xCLFdBQU8sY0FBYyxrQkFBa0IsS0FBSyxPQUFPLFNBQVMsUUFBUSxFQUFFLFFBQVEsS0FBSyxJQUFJO0FBQUEsRUFDekY7QUFBQSxFQUVBLHVCQUF1QixhQUFhO0FBQ2xDLGdCQUFZLE1BQU07QUFDbEIsUUFBRyxLQUFLLE9BQU8sU0FBUyxhQUFhLFNBQVMsR0FBRztBQUUvQyxrQkFBWSxTQUFTLEtBQUs7QUFBQSxRQUN4QixNQUFNO0FBQUEsTUFDUixDQUFDO0FBQ0QsVUFBSSxPQUFPLFlBQVksU0FBUyxJQUFJO0FBQ3BDLGVBQVMsZUFBZSxLQUFLLE9BQU8sU0FBUyxjQUFjO0FBQ3pELGFBQUssU0FBUyxNQUFNO0FBQUEsVUFDbEIsTUFBTTtBQUFBLFFBQ1IsQ0FBQztBQUFBLE1BQ0g7QUFFQSxVQUFJLFNBQVMsUUFBUSxXQUFXLEVBQUUsUUFBUSxvQkFBb0IsRUFBRSxRQUFRLHlCQUF5QixFQUFFLFVBQVUsQ0FBQyxXQUFXLE9BQU8sY0FBYyx5QkFBeUIsRUFBRSxRQUFRLFlBQVk7QUFFM0wsb0JBQVksTUFBTTtBQUVsQixvQkFBWSxTQUFTLEtBQUs7QUFBQSxVQUN4QixNQUFNO0FBQUEsUUFDUixDQUFDO0FBQ0QsY0FBTSxLQUFLLE9BQU8sbUJBQW1CO0FBRXJDLGFBQUssdUJBQXVCLFdBQVc7QUFBQSxNQUN6QyxDQUFDLENBQUM7QUFBQSxJQUNKLE9BQUs7QUFDSCxrQkFBWSxTQUFTLEtBQUs7QUFBQSxRQUN4QixNQUFNO0FBQUEsTUFDUixDQUFDO0FBQUEsSUFDSDtBQUFBLEVBQ0Y7QUFDRjtBQUVBLFNBQVMsZ0JBQWdCLE1BQU07QUFDN0IsU0FBUSxLQUFLLFFBQVEsR0FBRyxNQUFNLEtBQU8sQ0FBQyxLQUFLLEdBQUcsRUFBRSxRQUFRLEtBQUssQ0FBQyxDQUFDLE1BQU07QUFDdkU7QUFFQSxJQUFNLG1DQUFtQztBQUV6QyxJQUFNLDJCQUFOLGNBQXVDLFNBQVMsU0FBUztBQUFBLEVBQ3ZELFlBQVksTUFBTSxRQUFRO0FBQ3hCLFVBQU0sSUFBSTtBQUNWLFNBQUssU0FBUztBQUNkLFNBQUssYUFBYTtBQUNsQixTQUFLLGdCQUFnQjtBQUNyQixTQUFLLGNBQWM7QUFDbkIsU0FBSyxPQUFPO0FBQ1osU0FBSyxXQUFXO0FBQ2hCLFNBQUssaUJBQWlCO0FBQ3RCLFNBQUssa0JBQWtCLENBQUM7QUFDeEIsU0FBSyxRQUFRLENBQUM7QUFDZCxTQUFLLFlBQVk7QUFDakIsU0FBSyxvQkFBb0I7QUFDekIsU0FBSyxnQkFBZ0I7QUFBQSxFQUN2QjtBQUFBLEVBQ0EsaUJBQWlCO0FBQ2YsV0FBTztBQUFBLEVBQ1Q7QUFBQSxFQUNBLFVBQVU7QUFDUixXQUFPO0FBQUEsRUFDVDtBQUFBLEVBQ0EsY0FBYztBQUNaLFdBQU87QUFBQSxFQUNUO0FBQUEsRUFDQSxTQUFTO0FBQ1AsU0FBSyxTQUFTO0FBQ2QsU0FBSyxPQUFPLGdCQUFnQjtBQUFBLEVBQzlCO0FBQUEsRUFDQSxVQUFVO0FBQ1IsU0FBSyxLQUFLLFVBQVU7QUFDcEIsU0FBSyxJQUFJLFVBQVUsMEJBQTBCLGdDQUFnQztBQUFBLEVBQy9FO0FBQUEsRUFDQSxjQUFjO0FBQ1osU0FBSyxZQUFZLE1BQU07QUFDdkIsU0FBSyxpQkFBaUIsS0FBSyxZQUFZLFVBQVUsbUJBQW1CO0FBRXBFLFNBQUssZUFBZTtBQUVwQixTQUFLLGdCQUFnQjtBQUVyQixTQUFLLGtCQUFrQjtBQUN2QixTQUFLLE9BQU8sYUFBYSxLQUFLLGFBQWEsTUFBTTtBQUFBLEVBQ25EO0FBQUE7QUFBQSxFQUVBLGlCQUFpQjtBQUVmLFFBQUksb0JBQW9CLEtBQUssZUFBZSxVQUFVLHNCQUFzQjtBQUU1RSxRQUFJLFlBQVcsS0FBSyxLQUFLLEtBQUs7QUFDOUIsUUFBSSxrQkFBa0Isa0JBQWtCLFNBQVMsU0FBUztBQUFBLE1BQ3hELE1BQU07QUFBQSxRQUNKLE1BQU07QUFBQSxRQUNOLE9BQU87QUFBQSxNQUNUO0FBQUEsTUFDQSxLQUFLO0FBQUEsSUFDUCxDQUFDO0FBQ0Qsb0JBQWdCLGlCQUFpQixVQUFVLEtBQUssWUFBWSxLQUFLLElBQUksQ0FBQztBQUd0RSxRQUFJLGlCQUFpQixLQUFLLHNCQUFzQixtQkFBbUIsY0FBYyxtQkFBbUI7QUFDcEcsbUJBQWUsaUJBQWlCLFNBQVMsS0FBSyxnQkFBZ0IsS0FBSyxJQUFJLENBQUM7QUFFeEUsUUFBSSxXQUFXLEtBQUssc0JBQXNCLG1CQUFtQixhQUFhLE1BQU07QUFDaEYsYUFBUyxpQkFBaUIsU0FBUyxLQUFLLFVBQVUsS0FBSyxJQUFJLENBQUM7QUFFNUQsUUFBSSxjQUFjLEtBQUssc0JBQXNCLG1CQUFtQixnQkFBZ0IsU0FBUztBQUN6RixnQkFBWSxpQkFBaUIsU0FBUyxLQUFLLGtCQUFrQixLQUFLLElBQUksQ0FBQztBQUV2RSxVQUFNLGVBQWUsS0FBSyxzQkFBc0IsbUJBQW1CLFlBQVksTUFBTTtBQUNyRixpQkFBYSxpQkFBaUIsU0FBUyxLQUFLLFNBQVMsS0FBSyxJQUFJLENBQUM7QUFBQSxFQUNqRTtBQUFBLEVBQ0EsTUFBTSxvQkFBb0I7QUFDeEIsVUFBTSxTQUFTLE1BQU0sS0FBSyxJQUFJLE1BQU0sUUFBUSxLQUFLLDBCQUEwQjtBQUMzRSxTQUFLLFFBQVEsT0FBTyxNQUFNLElBQUksQ0FBQyxTQUFTO0FBQ3RDLGFBQU8sS0FBSyxRQUFRLDZCQUE2QixFQUFFLEVBQUUsUUFBUSxTQUFTLEVBQUU7QUFBQSxJQUMxRSxDQUFDO0FBRUQsUUFBSSxDQUFDLEtBQUs7QUFDUixXQUFLLFFBQVEsSUFBSSxpQ0FBaUMsS0FBSyxLQUFLLElBQUk7QUFDbEUsU0FBSyxNQUFNLEtBQUs7QUFBQSxFQUNsQjtBQUFBLEVBRUEsc0JBQXNCLG1CQUFtQixPQUFPLE9BQUssTUFBTTtBQUN6RCxRQUFJLE1BQU0sa0JBQWtCLFNBQVMsVUFBVTtBQUFBLE1BQzdDLE1BQU07QUFBQSxRQUNKO0FBQUEsTUFDRjtBQUFBLElBQ0YsQ0FBQztBQUNELFFBQUcsTUFBSztBQUNOLGVBQVMsUUFBUSxLQUFLLElBQUk7QUFBQSxJQUM1QixPQUFLO0FBQ0gsVUFBSSxZQUFZO0FBQUEsSUFDbEI7QUFDQSxXQUFPO0FBQUEsRUFDVDtBQUFBO0FBQUEsRUFFQSxXQUFXO0FBQ1QsU0FBSyxXQUFXO0FBQ2hCLFNBQUssWUFBWTtBQUVqQixTQUFLLG9CQUFvQixXQUFXO0FBQ3BDLFNBQUssV0FBVyxZQUFZLFFBQVEsa0JBQWtCLEtBQUssT0FBTyxTQUFTLFFBQVEsRUFBRSxrQkFBZ0I7QUFBQSxFQUN2RztBQUFBO0FBQUEsRUFFQSxNQUFNLFVBQVUsU0FBUztBQUN2QixTQUFLLFdBQVc7QUFDaEIsVUFBTSxLQUFLLEtBQUssVUFBVSxPQUFPO0FBQ2pDLFNBQUssWUFBWTtBQUNqQixhQUFTLElBQUksR0FBRyxJQUFJLEtBQUssS0FBSyxRQUFRLFFBQVEsS0FBSztBQUNqRCxZQUFNLEtBQUssZUFBZSxLQUFLLEtBQUssUUFBUSxDQUFDLEVBQUUsU0FBUyxLQUFLLEtBQUssUUFBUSxDQUFDLEVBQUUsSUFBSTtBQUFBLElBQ25GO0FBQUEsRUFDRjtBQUFBO0FBQUEsRUFFQSxhQUFhO0FBQ1gsUUFBSSxLQUFLLE1BQU07QUFDYixXQUFLLEtBQUssVUFBVTtBQUFBLElBQ3RCO0FBQ0EsU0FBSyxPQUFPLElBQUksMEJBQTBCLEtBQUssTUFBTTtBQUVyRCxRQUFJLEtBQUssb0JBQW9CO0FBQzNCLG9CQUFjLEtBQUssa0JBQWtCO0FBQUEsSUFDdkM7QUFFQSxTQUFLLGtCQUFrQixDQUFDO0FBRXhCLFNBQUssV0FBVztBQUFBLEVBQ2xCO0FBQUEsRUFFQSxZQUFZLE9BQU87QUFDakIsUUFBSSxnQkFBZ0IsTUFBTSxPQUFPO0FBQ2pDLFNBQUssS0FBSyxZQUFZLGFBQWE7QUFBQSxFQUNyQztBQUFBO0FBQUEsRUFHQSxZQUFZO0FBQ1YsU0FBSyxLQUFLLFVBQVU7QUFDcEIsUUFBSSxTQUFTLE9BQU8sZ0NBQWdDO0FBQUEsRUFDdEQ7QUFBQSxFQUVBLGtCQUFrQjtBQUNoQixTQUFLLE9BQU8sVUFBVTtBQUFBLEVBQ3hCO0FBQUE7QUFBQSxFQUVBLGtCQUFrQjtBQUVoQixTQUFLLFdBQVcsS0FBSyxlQUFlLFVBQVUsYUFBYTtBQUUzRCxTQUFLLG9CQUFvQixLQUFLLFNBQVMsVUFBVSxzQkFBc0I7QUFBQSxFQUN6RTtBQUFBO0FBQUEsRUFFQSw2QkFBNkI7QUFFM0IsUUFBRyxDQUFDLEtBQUs7QUFBZSxXQUFLLGdCQUFnQixJQUFJLGdDQUFnQyxLQUFLLEtBQUssSUFBSTtBQUMvRixTQUFLLGNBQWMsS0FBSztBQUFBLEVBQzFCO0FBQUE7QUFBQSxFQUVBLE1BQU0sK0JBQStCO0FBRW5DLFFBQUcsQ0FBQyxLQUFLLGlCQUFnQjtBQUN2QixXQUFLLGtCQUFrQixJQUFJLGtDQUFrQyxLQUFLLEtBQUssSUFBSTtBQUFBLElBQzdFO0FBQ0EsU0FBSyxnQkFBZ0IsS0FBSztBQUFBLEVBQzVCO0FBQUE7QUFBQSxFQUVBLGlCQUFpQixhQUFhO0FBRTVCLFFBQUksWUFBWSxLQUFLLFNBQVM7QUFFOUIsUUFBSSxjQUFjLEtBQUssU0FBUyxNQUFNLFVBQVUsR0FBRyxTQUFTO0FBRTVELFFBQUksYUFBYSxLQUFLLFNBQVMsTUFBTSxVQUFVLFdBQVcsS0FBSyxTQUFTLE1BQU0sTUFBTTtBQUVwRixTQUFLLFNBQVMsUUFBUSxjQUFjLGNBQWM7QUFFbEQsU0FBSyxTQUFTLGlCQUFpQixZQUFZLFlBQVk7QUFDdkQsU0FBSyxTQUFTLGVBQWUsWUFBWSxZQUFZO0FBRXJELFNBQUssU0FBUyxNQUFNO0FBQUEsRUFDdEI7QUFBQTtBQUFBLEVBR0Esb0JBQW9CO0FBRWxCLFFBQUksYUFBYSxLQUFLLGVBQWUsVUFBVSxjQUFjO0FBRTdELFNBQUssV0FBVyxXQUFXLFNBQVMsWUFBWTtBQUFBLE1BQzlDLEtBQUs7QUFBQSxNQUNMLE1BQU07QUFBQSxRQUNKLGFBQWE7QUFBQSxNQUNmO0FBQUEsSUFDRixDQUFDO0FBSUQsZUFBVyxpQkFBaUIsU0FBUyxDQUFDLE1BQU07QUFDMUMsVUFBRyxDQUFDLEtBQUssR0FBRyxFQUFFLFFBQVEsRUFBRSxHQUFHLE1BQU07QUFBSTtBQUNyQyxZQUFNLFlBQVksS0FBSyxTQUFTO0FBRWhDLFVBQUksRUFBRSxRQUFRLEtBQUs7QUFFakIsWUFBRyxLQUFLLFNBQVMsTUFBTSxZQUFZLENBQUMsTUFBTSxLQUFJO0FBRTVDLGVBQUssMkJBQTJCO0FBQ2hDO0FBQUEsUUFDRjtBQUFBLE1BQ0YsT0FBSztBQUNILGFBQUssY0FBYztBQUFBLE1BQ3JCO0FBRUEsVUFBSSxFQUFFLFFBQVEsS0FBSztBQUdqQixZQUFJLEtBQUssU0FBUyxNQUFNLFdBQVcsS0FBSyxLQUFLLFNBQVMsTUFBTSxZQUFZLENBQUMsTUFBTSxLQUFLO0FBRWxGLGVBQUssNkJBQTZCO0FBQ2xDO0FBQUEsUUFDRjtBQUFBLE1BQ0Y7QUFBQSxJQUVGLENBQUM7QUFFRCxlQUFXLGlCQUFpQixXQUFXLENBQUMsTUFBTTtBQUM1QyxVQUFJLEVBQUUsUUFBUSxXQUFXLEVBQUUsVUFBVTtBQUNuQyxVQUFFLGVBQWU7QUFDakIsWUFBRyxLQUFLLGVBQWM7QUFDcEIsa0JBQVEsSUFBSSx5Q0FBeUM7QUFDckQsY0FBSSxTQUFTLE9BQU8sNkRBQTZEO0FBQ2pGO0FBQUEsUUFDRjtBQUVBLFlBQUksYUFBYSxLQUFLLFNBQVM7QUFFL0IsYUFBSyxTQUFTLFFBQVE7QUFFdEIsYUFBSyxvQkFBb0IsVUFBVTtBQUFBLE1BQ3JDO0FBQ0EsV0FBSyxTQUFTLE1BQU0sU0FBUztBQUM3QixXQUFLLFNBQVMsTUFBTSxTQUFVLEtBQUssU0FBUyxlQUFnQjtBQUFBLElBQzlELENBQUM7QUFFRCxRQUFJLG1CQUFtQixXQUFXLFVBQVUscUJBQXFCO0FBRWpFLFFBQUksZUFBZSxpQkFBaUIsU0FBUyxRQUFRLEVBQUUsTUFBTSxFQUFDLElBQUksbUJBQW1CLE9BQU8saUJBQWdCLEVBQUUsQ0FBQztBQUMvRyxhQUFTLFFBQVEsY0FBYyxRQUFRO0FBRXZDLGlCQUFhLGlCQUFpQixTQUFTLE1BQU07QUFFM0MsV0FBSyxXQUFXO0FBQUEsSUFDbEIsQ0FBQztBQUVELFFBQUksU0FBUyxpQkFBaUIsU0FBUyxVQUFVLEVBQUUsTUFBTSxFQUFDLElBQUksaUJBQWdCLEdBQUcsS0FBSyxjQUFjLENBQUM7QUFDckcsV0FBTyxZQUFZO0FBRW5CLFdBQU8saUJBQWlCLFNBQVMsTUFBTTtBQUNyQyxVQUFHLEtBQUssZUFBYztBQUNwQixnQkFBUSxJQUFJLHlDQUF5QztBQUNyRCxZQUFJLFNBQVMsT0FBTyx5Q0FBeUM7QUFDN0Q7QUFBQSxNQUNGO0FBRUEsVUFBSSxhQUFhLEtBQUssU0FBUztBQUUvQixXQUFLLFNBQVMsUUFBUTtBQUV0QixXQUFLLG9CQUFvQixVQUFVO0FBQUEsSUFDckMsQ0FBQztBQUFBLEVBQ0g7QUFBQSxFQUNBLE1BQU0sb0JBQW9CLFlBQVk7QUFDcEMsU0FBSyxpQkFBaUI7QUFFdEIsVUFBTSxLQUFLLGVBQWUsWUFBWSxNQUFNO0FBQzVDLFNBQUssS0FBSyxzQkFBc0I7QUFBQSxNQUM5QixNQUFNO0FBQUEsTUFDTixTQUFTO0FBQUEsSUFDWCxDQUFDO0FBQ0QsVUFBTSxLQUFLLGlCQUFpQjtBQUc1QixRQUFHLEtBQUssS0FBSyx1QkFBdUIsVUFBVSxHQUFHO0FBQy9DLFdBQUssS0FBSywrQkFBK0IsWUFBWSxJQUFJO0FBQ3pEO0FBQUEsSUFDRjtBQVFBLFFBQUcsS0FBSyxtQ0FBbUMsVUFBVSxLQUFLLEtBQUssS0FBSywwQkFBMEIsVUFBVSxHQUFHO0FBRXpHLFlBQU0sVUFBVSxNQUFNLEtBQUssaUJBQWlCLFVBQVU7QUFJdEQsWUFBTSxTQUFTO0FBQUEsUUFDYjtBQUFBLFVBQ0UsTUFBTTtBQUFBO0FBQUEsVUFFTixTQUFTO0FBQUEsUUFDWDtBQUFBLFFBQ0E7QUFBQSxVQUNFLE1BQU07QUFBQSxVQUNOLFNBQVM7QUFBQSxRQUNYO0FBQUEsTUFDRjtBQUNBLFdBQUssMkJBQTJCLEVBQUMsVUFBVSxRQUFRLGFBQWEsRUFBQyxDQUFDO0FBQ2xFO0FBQUEsSUFDRjtBQUVBLFNBQUssMkJBQTJCO0FBQUEsRUFDbEM7QUFBQSxFQUVBLE1BQU0sbUJBQW1CO0FBQ3ZCLFFBQUksS0FBSztBQUNQLG9CQUFjLEtBQUssa0JBQWtCO0FBQ3ZDLFVBQU0sS0FBSyxlQUFlLE9BQU8sV0FBVztBQUU1QyxRQUFJLE9BQU87QUFDWCxTQUFLLFdBQVcsWUFBWTtBQUM1QixTQUFLLHFCQUFxQixZQUFZLE1BQU07QUFDMUM7QUFDQSxVQUFJLE9BQU87QUFDVCxlQUFPO0FBQ1QsV0FBSyxXQUFXLFlBQVksSUFBSSxPQUFPLElBQUk7QUFBQSxJQUM3QyxHQUFHLEdBQUc7QUFBQSxFQUdSO0FBQUEsRUFFQSxtQkFBbUI7QUFDakIsU0FBSyxnQkFBZ0I7QUFFckIsUUFBRyxTQUFTLGVBQWUsZ0JBQWdCO0FBQ3pDLGVBQVMsZUFBZSxnQkFBZ0IsRUFBRSxNQUFNLFVBQVU7QUFFNUQsUUFBRyxTQUFTLGVBQWUsaUJBQWlCO0FBQzFDLGVBQVMsZUFBZSxpQkFBaUIsRUFBRSxNQUFNLFVBQVU7QUFBQSxFQUMvRDtBQUFBLEVBQ0EscUJBQXFCO0FBQ25CLFNBQUssZ0JBQWdCO0FBRXJCLFFBQUcsU0FBUyxlQUFlLGdCQUFnQjtBQUN6QyxlQUFTLGVBQWUsZ0JBQWdCLEVBQUUsTUFBTSxVQUFVO0FBRTVELFFBQUcsU0FBUyxlQUFlLGlCQUFpQjtBQUMxQyxlQUFTLGVBQWUsaUJBQWlCLEVBQUUsTUFBTSxVQUFVO0FBQUEsRUFDL0Q7QUFBQTtBQUFBLEVBSUEsbUNBQW1DLFlBQVk7QUFDN0MsVUFBTSxVQUFVLFdBQVcsTUFBTSxLQUFLLE9BQU8saUJBQWlCO0FBQzlELFFBQUc7QUFBUyxhQUFPO0FBQ25CLFdBQU87QUFBQSxFQUNUO0FBQUE7QUFBQSxFQUdBLE1BQU0sZUFBZSxTQUFTLE9BQUssYUFBYSxjQUFZLE9BQU87QUFFakUsUUFBRyxLQUFLLG9CQUFvQjtBQUMxQixvQkFBYyxLQUFLLGtCQUFrQjtBQUNyQyxXQUFLLHFCQUFxQjtBQUUxQixXQUFLLFdBQVcsWUFBWTtBQUFBLElBQzlCO0FBQ0EsUUFBRyxhQUFhO0FBQ2QsV0FBSyx1QkFBdUI7QUFDNUIsVUFBRyxRQUFRLFFBQVEsSUFBSSxNQUFNLElBQUk7QUFDL0IsYUFBSyxXQUFXLGFBQWE7QUFBQSxNQUMvQixPQUFLO0FBQ0gsYUFBSyxXQUFXLFlBQVk7QUFFNUIsY0FBTSxTQUFTLGlCQUFpQixlQUFlLEtBQUsscUJBQXFCLEtBQUssWUFBWSxnQkFBZ0IsSUFBSSxTQUFTLFVBQVUsQ0FBQztBQUFBLE1BQ3BJO0FBQUEsSUFDRixPQUFLO0FBQ0gsV0FBSyxzQkFBc0I7QUFDM0IsVUFBSSxLQUFLLEtBQUssT0FBTyxXQUFXLEtBQU8sS0FBSyxjQUFjLE1BQU87QUFFL0QsYUFBSyxvQkFBb0IsSUFBSTtBQUFBLE1BQy9CO0FBRUEsV0FBSyxXQUFXLFlBQVk7QUFDNUIsWUFBTSxTQUFTLGlCQUFpQixlQUFlLFNBQVMsS0FBSyxZQUFZLGdCQUFnQixJQUFJLFNBQVMsVUFBVSxDQUFDO0FBRWpILFdBQUssd0JBQXdCO0FBRTdCLFdBQUssOEJBQThCLE9BQU87QUFBQSxJQUM1QztBQUVBLFNBQUssa0JBQWtCLFlBQVksS0FBSyxrQkFBa0I7QUFBQSxFQUM1RDtBQUFBLEVBQ0EsOEJBQThCLFNBQVM7QUFDckMsUUFBSSxLQUFLLEtBQUssV0FBVyxLQUFLLEtBQUssS0FBSztBQUV0QyxZQUFNLGVBQWUsS0FBSyxXQUFXLFNBQVMsUUFBUTtBQUFBLFFBQ3BELEtBQUs7QUFBQSxRQUNMLE1BQU07QUFBQSxVQUNKLE9BQU87QUFBQTtBQUFBLFFBQ1Q7QUFBQSxNQUNGLENBQUM7QUFDRCxZQUFNLFdBQVcsS0FBSyxLQUFLO0FBQzNCLGVBQVMsUUFBUSxjQUFjLEtBQUs7QUFDcEMsbUJBQWEsaUJBQWlCLFNBQVMsTUFBTTtBQUUzQyxrQkFBVSxVQUFVLFVBQVUsMkJBQTJCLFdBQVcsU0FBUztBQUM3RSxZQUFJLFNBQVMsT0FBTyw0REFBNEQ7QUFBQSxNQUNsRixDQUFDO0FBQUEsSUFDSDtBQUNBLFFBQUcsS0FBSyxLQUFLLFNBQVM7QUFFcEIsWUFBTSxxQkFBcUIsS0FBSyxXQUFXLFNBQVMsUUFBUTtBQUFBLFFBQzFELEtBQUs7QUFBQSxRQUNMLE1BQU07QUFBQSxVQUNKLE9BQU87QUFBQTtBQUFBLFFBQ1Q7QUFBQSxNQUNGLENBQUM7QUFDRCxZQUFNLGVBQWUsS0FBSyxLQUFLLFFBQVEsUUFBUSxXQUFXLE1BQU8sRUFBRSxTQUFTO0FBQzVFLGVBQVMsUUFBUSxvQkFBb0IsT0FBTztBQUM1Qyx5QkFBbUIsaUJBQWlCLFNBQVMsTUFBTTtBQUVqRCxrQkFBVSxVQUFVLFVBQVUsd0JBQXdCLGVBQWUsU0FBUztBQUM5RSxZQUFJLFNBQVMsT0FBTyxpREFBaUQ7QUFBQSxNQUN2RSxDQUFDO0FBQUEsSUFDSDtBQUVBLFVBQU0sY0FBYyxLQUFLLFdBQVcsU0FBUyxRQUFRO0FBQUEsTUFDbkQsS0FBSztBQUFBLE1BQ0wsTUFBTTtBQUFBLFFBQ0osT0FBTztBQUFBO0FBQUEsTUFDVDtBQUFBLElBQ0YsQ0FBQztBQUNELGFBQVMsUUFBUSxhQUFhLE1BQU07QUFDcEMsZ0JBQVksaUJBQWlCLFNBQVMsTUFBTTtBQUUxQyxnQkFBVSxVQUFVLFVBQVUsUUFBUSxTQUFTLENBQUM7QUFDaEQsVUFBSSxTQUFTLE9BQU8saURBQWlEO0FBQUEsSUFDdkUsQ0FBQztBQUFBLEVBQ0g7QUFBQSxFQUVBLDBCQUEwQjtBQUN4QixVQUFNLFFBQVEsS0FBSyxXQUFXLGlCQUFpQixHQUFHO0FBRWxELFFBQUksTUFBTSxTQUFTLEdBQUc7QUFDcEIsZUFBUyxJQUFJLEdBQUcsSUFBSSxNQUFNLFFBQVEsS0FBSztBQUNyQyxjQUFNLE9BQU8sTUFBTSxDQUFDO0FBQ3BCLGNBQU0sWUFBWSxLQUFLLGFBQWEsV0FBVztBQUUvQyxhQUFLLGlCQUFpQixhQUFhLENBQUMsVUFBVTtBQUM1QyxlQUFLLElBQUksVUFBVSxRQUFRLGNBQWM7QUFBQSxZQUN2QztBQUFBLFlBQ0EsUUFBUTtBQUFBLFlBQ1IsYUFBYSxLQUFLO0FBQUEsWUFDbEIsVUFBVTtBQUFBO0FBQUEsWUFFVixVQUFVO0FBQUEsVUFDWixDQUFDO0FBQUEsUUFDSCxDQUFDO0FBRUQsYUFBSyxpQkFBaUIsU0FBUyxDQUFDLFVBQVU7QUFDeEMsZ0JBQU0sYUFBYSxLQUFLLElBQUksY0FBYyxxQkFBcUIsV0FBVyxHQUFHO0FBRTdFLGdCQUFNLE1BQU0sU0FBUyxPQUFPLFdBQVcsS0FBSztBQUU1QyxjQUFJLE9BQU8sS0FBSyxJQUFJLFVBQVUsUUFBUSxHQUFHO0FBQ3pDLGVBQUssU0FBUyxVQUFVO0FBQUEsUUFDMUIsQ0FBQztBQUFBLE1BQ0g7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUFBLEVBRUEsb0JBQW9CLE1BQU07QUFDeEIsUUFBSSxhQUFhLEtBQUssa0JBQWtCLFVBQVUsY0FBYyxNQUFNO0FBRXRFLFNBQUssYUFBYSxXQUFXLFVBQVUsb0JBQW9CO0FBRTNELFNBQUssWUFBWTtBQUFBLEVBQ25CO0FBQUEsRUFFQSxNQUFNLDJCQUEyQixPQUFLLENBQUMsR0FBRztBQUN4QyxVQUFNLFVBQVUsS0FBSyxZQUFZLEtBQUssV0FBVyxLQUFLLEtBQUssZ0JBQWdCO0FBQzNFLFlBQVEsSUFBSSxXQUFXLE9BQU87QUFDOUIsVUFBTSxtQkFBbUIsS0FBSyxNQUFNLGNBQWMsS0FBSyxPQUFPLFNBQVMsZ0JBQWdCLElBQUksQ0FBQztBQUM1RixZQUFRLElBQUksb0JBQW9CLGdCQUFnQjtBQUNoRCxVQUFNLGlCQUFpQixLQUFLLE1BQU0sS0FBSyxVQUFVLE9BQU8sRUFBRSxTQUFTLENBQUM7QUFDcEUsWUFBUSxJQUFJLGtCQUFrQixjQUFjO0FBQzVDLFFBQUksdUJBQXVCLG1CQUFtQjtBQUU5QyxRQUFHLHVCQUF1QjtBQUFHLDZCQUF1QjtBQUFBLGFBQzVDLHVCQUF1QjtBQUFNLDZCQUF1QjtBQUM1RCxZQUFRLElBQUksd0JBQXdCLG9CQUFvQjtBQUN4RCxXQUFPO0FBQUEsTUFDTCxPQUFPLEtBQUssT0FBTyxTQUFTO0FBQUEsTUFDNUIsVUFBVTtBQUFBO0FBQUEsTUFFVixZQUFZO0FBQUEsTUFDWixhQUFhO0FBQUEsTUFDYixPQUFPO0FBQUEsTUFDUCxrQkFBa0I7QUFBQSxNQUNsQixtQkFBbUI7QUFBQSxNQUNuQixRQUFRO0FBQUEsTUFDUixNQUFNO0FBQUEsTUFDTixHQUFHO0FBQUE7QUFBQSxNQUVILEdBQUc7QUFBQSxJQUNMO0FBRUEsUUFBRyxLQUFLLFFBQVE7QUFDZCxZQUFNLFdBQVcsTUFBTSxJQUFJLFFBQVEsQ0FBQyxTQUFTLFdBQVc7QUFDdEQsWUFBSTtBQUVGLGdCQUFNLE1BQU07QUFDWixlQUFLLGdCQUFnQixJQUFJLFdBQVcsS0FBSztBQUFBLFlBQ3ZDLFNBQVM7QUFBQSxjQUNQLGdCQUFnQjtBQUFBLGNBQ2hCLGVBQWUsVUFBVSxLQUFLLE9BQU8sU0FBUztBQUFBLFlBQ2hEO0FBQUEsWUFDQSxRQUFRO0FBQUEsWUFDUixTQUFTLEtBQUssVUFBVSxJQUFJO0FBQUEsVUFDOUIsQ0FBQztBQUNELGNBQUksTUFBTTtBQUNWLGVBQUssY0FBYyxpQkFBaUIsV0FBVyxDQUFDLE1BQU07QUFDcEQsZ0JBQUksRUFBRSxRQUFRLFVBQVU7QUFDdEIsb0JBQU0sVUFBVSxLQUFLLE1BQU0sRUFBRSxJQUFJO0FBQ2pDLG9CQUFNLE9BQU8sUUFBUSxRQUFRLENBQUMsRUFBRSxNQUFNO0FBQ3RDLGtCQUFJLENBQUMsTUFBTTtBQUNUO0FBQUEsY0FDRjtBQUNBLHFCQUFPO0FBQ1AsbUJBQUssZUFBZSxNQUFNLGFBQWEsSUFBSTtBQUFBLFlBQzdDLE9BQU87QUFDTCxtQkFBSyxXQUFXO0FBQ2hCLHNCQUFRLEdBQUc7QUFBQSxZQUNiO0FBQUEsVUFDRixDQUFDO0FBQ0QsZUFBSyxjQUFjLGlCQUFpQixvQkFBb0IsQ0FBQyxNQUFNO0FBQzdELGdCQUFJLEVBQUUsY0FBYyxHQUFHO0FBQ3JCLHNCQUFRLElBQUksaUJBQWlCLEVBQUUsVUFBVTtBQUFBLFlBQzNDO0FBQUEsVUFDRixDQUFDO0FBQ0QsZUFBSyxjQUFjLGlCQUFpQixTQUFTLENBQUMsTUFBTTtBQUNsRCxvQkFBUSxNQUFNLENBQUM7QUFDZixnQkFBSSxTQUFTLE9BQU8sc0VBQXNFO0FBQzFGLGlCQUFLLGVBQWUsOENBQThDLFdBQVc7QUFDN0UsaUJBQUssV0FBVztBQUNoQixtQkFBTyxDQUFDO0FBQUEsVUFDVixDQUFDO0FBQ0QsZUFBSyxjQUFjLE9BQU87QUFBQSxRQUM1QixTQUFTLEtBQVA7QUFDQSxrQkFBUSxNQUFNLEdBQUc7QUFDakIsY0FBSSxTQUFTLE9BQU8sc0VBQXNFO0FBQzFGLGVBQUssV0FBVztBQUNoQixpQkFBTyxHQUFHO0FBQUEsUUFDWjtBQUFBLE1BQ0YsQ0FBQztBQUVELFlBQU0sS0FBSyxlQUFlLFVBQVUsV0FBVztBQUMvQyxXQUFLLEtBQUssc0JBQXNCO0FBQUEsUUFDOUIsTUFBTTtBQUFBLFFBQ04sU0FBUztBQUFBLE1BQ1gsQ0FBQztBQUNEO0FBQUEsSUFDRixPQUFLO0FBQ0gsVUFBRztBQUNELGNBQU0sV0FBVyxPQUFPLEdBQUcsU0FBUyxZQUFZO0FBQUEsVUFDOUMsS0FBSztBQUFBLFVBQ0wsUUFBUTtBQUFBLFVBQ1IsU0FBUztBQUFBLFlBQ1AsZUFBZSxVQUFVLEtBQUssT0FBTyxTQUFTO0FBQUEsWUFDOUMsZ0JBQWdCO0FBQUEsVUFDbEI7QUFBQSxVQUNBLGFBQWE7QUFBQSxVQUNiLE1BQU0sS0FBSyxVQUFVLElBQUk7QUFBQSxVQUN6QixPQUFPO0FBQUEsUUFDVCxDQUFDO0FBRUQsZUFBTyxLQUFLLE1BQU0sU0FBUyxJQUFJLEVBQUUsUUFBUSxDQUFDLEVBQUUsUUFBUTtBQUFBLE1BQ3RELFNBQU8sS0FBTjtBQUNDLFlBQUksU0FBUyxPQUFPLGtDQUFrQyxLQUFLO0FBQUEsTUFDN0Q7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUFBLEVBRUEsYUFBYTtBQUNYLFFBQUcsS0FBSyxlQUFjO0FBQ3BCLFdBQUssY0FBYyxNQUFNO0FBQ3pCLFdBQUssZ0JBQWdCO0FBQUEsSUFDdkI7QUFDQSxTQUFLLG1CQUFtQjtBQUN4QixRQUFHLEtBQUssb0JBQW1CO0FBQ3pCLG9CQUFjLEtBQUssa0JBQWtCO0FBQ3JDLFdBQUsscUJBQXFCO0FBRTFCLFdBQUssV0FBVyxjQUFjLE9BQU87QUFDckMsV0FBSyxhQUFhO0FBQUEsSUFDcEI7QUFBQSxFQUNGO0FBQUEsRUFFQSxNQUFNLGlCQUFpQixZQUFZO0FBQ2pDLFNBQUssS0FBSyxjQUFjO0FBRXhCLFVBQU0sWUFBWTtBQUVsQixVQUFNLFNBQVM7QUFBQSxNQUNiO0FBQUEsUUFDRSxNQUFNO0FBQUEsUUFDTixTQUFTO0FBQUEsTUFDWDtBQUFBLE1BQ0E7QUFBQSxRQUNFLE1BQU07QUFBQSxRQUNOLFNBQVM7QUFBQSxNQUNYO0FBQUEsSUFDRjtBQUNBLFVBQU0sTUFBTSxNQUFNLEtBQUssMkJBQTJCO0FBQUEsTUFDaEQsVUFBVTtBQUFBLE1BQ1YsUUFBUTtBQUFBLE1BQ1IsYUFBYTtBQUFBLE1BQ2IsWUFBWTtBQUFBLElBQ2QsQ0FBQztBQUNELFNBQUssS0FBSyxNQUFNO0FBRWhCLFFBQUksU0FBUyxDQUFDO0FBRWQsUUFBRyxLQUFLLEtBQUssMEJBQTBCLFVBQVUsR0FBRztBQUVsRCxZQUFNLGNBQWMsS0FBSyxLQUFLLHNCQUFzQixVQUFVO0FBRzlELFVBQUcsYUFBWTtBQUNiLGlCQUFTO0FBQUEsVUFDUCxrQkFBa0I7QUFBQSxRQUNwQjtBQUFBLE1BQ0Y7QUFBQSxJQUNGO0FBRUEsUUFBSSxVQUFVLE1BQU0sS0FBSyxPQUFPLElBQUksT0FBTyxLQUFLLE1BQU07QUFDdEQsWUFBUSxJQUFJLFdBQVcsUUFBUSxNQUFNO0FBQ3JDLGNBQVUsS0FBSywyQ0FBMkMsT0FBTztBQUNqRSxZQUFRLElBQUksK0JBQStCLFFBQVEsTUFBTTtBQUN6RCxjQUFVLEtBQUssZ0NBQWdDLE9BQU87QUFFdEQsV0FBTyxNQUFNLEtBQUssdUJBQXVCLE9BQU87QUFBQSxFQUNsRDtBQUFBLEVBR0EsZ0NBQWdDLFNBQVM7QUFFdkMsY0FBVSxRQUFRLEtBQUssQ0FBQyxHQUFHLE1BQU07QUFDL0IsWUFBTSxVQUFVLEVBQUUsYUFBYSxFQUFFO0FBQ2pDLFlBQU0sVUFBVSxFQUFFLGFBQWEsRUFBRTtBQUVqQyxVQUFJLFVBQVU7QUFDWixlQUFPO0FBRVQsVUFBSSxVQUFVO0FBQ1osZUFBTztBQUVULGFBQU87QUFBQSxJQUNULENBQUM7QUFDRCxXQUFPO0FBQUEsRUFDVDtBQUFBLEVBRUEsMkNBQTJDLFNBQVM7QUFFbEQsVUFBTSxNQUFNLFFBQVEsSUFBSSxDQUFDLE1BQU0sRUFBRSxVQUFVO0FBQzNDLFVBQU0sT0FBTyxJQUFJLE9BQU8sQ0FBQyxHQUFHLE1BQU0sSUFBSSxDQUFDLElBQUksSUFBSTtBQUMvQyxRQUFJLFVBQVUsS0FBSyxLQUFLLElBQUksSUFBSSxDQUFDLE1BQU0sS0FBSyxJQUFJLElBQUksTUFBTSxDQUFDLENBQUMsRUFBRSxPQUFPLENBQUMsR0FBRyxNQUFNLElBQUksQ0FBQyxJQUFJLElBQUksTUFBTTtBQUVsRyxRQUFJLFVBQVU7QUFDZCxXQUFPLFVBQVUsUUFBUSxRQUFRO0FBQy9CLFlBQU0sT0FBTyxRQUFRLFVBQVUsQ0FBQztBQUNoQyxVQUFJLE1BQU07QUFDUixjQUFNLFdBQVcsS0FBSyxJQUFJLEtBQUssYUFBYSxRQUFRLE9BQU8sRUFBRSxVQUFVO0FBQ3ZFLFlBQUksV0FBVyxTQUFTO0FBQ3RCLGNBQUcsVUFBVTtBQUFHLHNCQUFVLFVBQVU7QUFBQTtBQUMvQjtBQUFBLFFBQ1A7QUFBQSxNQUNGO0FBQ0E7QUFBQSxJQUNGO0FBRUEsY0FBVSxRQUFRLE1BQU0sR0FBRyxVQUFRLENBQUM7QUFDcEMsV0FBTztBQUFBLEVBQ1Q7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQVdBLE1BQU0sdUJBQXVCLFNBQVM7QUFDcEMsUUFBSSxVQUFVLENBQUM7QUFDZixVQUFNLGNBQWUsS0FBSyxPQUFPLFNBQVMscUJBQXFCLHVCQUF3QixLQUFLO0FBQzVGLFVBQU0sWUFBWSxjQUFjLEtBQUssT0FBTyxTQUFTLGdCQUFnQixJQUFJO0FBQ3pFLFFBQUksYUFBYTtBQUNqQixhQUFTLElBQUksR0FBRyxJQUFJLFFBQVEsUUFBUSxLQUFLO0FBQ3ZDLFVBQUksUUFBUSxVQUFVO0FBQ3BCO0FBQ0YsVUFBSSxjQUFjO0FBQ2hCO0FBQ0YsVUFBSSxPQUFPLFFBQVEsQ0FBQyxFQUFFLFNBQVM7QUFDN0I7QUFFRixZQUFNLGNBQWMsUUFBUSxDQUFDLEVBQUUsS0FBSyxRQUFRLE1BQU0sS0FBSyxFQUFFLFFBQVEsT0FBTyxFQUFFLEVBQUUsUUFBUSxPQUFPLEtBQUs7QUFDaEcsVUFBSSxjQUFjLEdBQUc7QUFBQTtBQUVyQixZQUFNLHNCQUFzQixZQUFZLGFBQWEsWUFBWTtBQUNqRSxVQUFJLFFBQVEsQ0FBQyxFQUFFLEtBQUssUUFBUSxHQUFHLE1BQU0sSUFBSTtBQUN2Qyx1QkFBZSxNQUFNLEtBQUssT0FBTyxnQkFBZ0IsUUFBUSxDQUFDLEVBQUUsTUFBTSxFQUFFLFdBQVcsb0JBQW9CLENBQUM7QUFBQSxNQUN0RyxPQUFPO0FBQ0wsdUJBQWUsTUFBTSxLQUFLLE9BQU8sZUFBZSxRQUFRLENBQUMsRUFBRSxNQUFNLEVBQUUsV0FBVyxvQkFBb0IsQ0FBQztBQUFBLE1BQ3JHO0FBRUEsb0JBQWMsWUFBWTtBQUUxQixjQUFRLEtBQUs7QUFBQSxRQUNYLE1BQU0sUUFBUSxDQUFDLEVBQUU7QUFBQSxRQUNqQixNQUFNO0FBQUEsTUFDUixDQUFDO0FBQUEsSUFDSDtBQUVBLFlBQVEsSUFBSSxzQkFBc0IsUUFBUSxNQUFNO0FBRWhELFlBQVEsSUFBSSw0QkFBNEIsS0FBSyxNQUFNLGFBQWEsR0FBRyxDQUFDO0FBRXBFLFNBQUssS0FBSyxVQUFVLDRFQUE0RSxRQUFRLHdJQUF3SSxrQkFBa0IsS0FBSyxPQUFPLFNBQVMsUUFBUSxFQUFFO0FBQ2pTLGFBQVEsSUFBSSxHQUFHLElBQUksUUFBUSxRQUFRLEtBQUs7QUFDdEMsV0FBSyxLQUFLLFdBQVc7QUFBQSxZQUFlLElBQUU7QUFBQSxFQUFTLFFBQVEsQ0FBQyxFQUFFO0FBQUEsVUFBaUIsSUFBRTtBQUFBLElBQy9FO0FBQ0EsV0FBTyxLQUFLLEtBQUs7QUFBQSxFQUNuQjtBQUdGO0FBRUEsU0FBUyxjQUFjLFFBQU0saUJBQWlCO0FBQzVDLFFBQU0sZUFBZTtBQUFBLElBQ25CLHFCQUFxQjtBQUFBLElBQ3JCLFNBQVM7QUFBQSxJQUNULGlCQUFpQjtBQUFBLElBQ2pCLHNCQUFzQjtBQUFBLEVBQ3hCO0FBQ0EsU0FBTyxhQUFhLEtBQUs7QUFDM0I7QUFhQSxJQUFNLDRCQUFOLE1BQWdDO0FBQUEsRUFDOUIsWUFBWSxRQUFRO0FBQ2xCLFNBQUssTUFBTSxPQUFPO0FBQ2xCLFNBQUssU0FBUztBQUNkLFNBQUssVUFBVTtBQUNmLFNBQUssVUFBVSxDQUFDO0FBQ2hCLFNBQUssVUFBVTtBQUNmLFNBQUssTUFBTTtBQUNYLFNBQUssU0FBUyxDQUFDO0FBQUEsRUFDakI7QUFBQSxFQUNBLE1BQU0sWUFBWTtBQUVoQixRQUFJLEtBQUssT0FBTyxXQUFXO0FBQUc7QUFHOUIsUUFBSSxDQUFFLE1BQU0sS0FBSyxJQUFJLE1BQU0sUUFBUSxPQUFPLDBCQUEwQixHQUFJO0FBQ3RFLFlBQU0sS0FBSyxJQUFJLE1BQU0sUUFBUSxNQUFNLDBCQUEwQjtBQUFBLElBQy9EO0FBRUEsUUFBSSxDQUFDLEtBQUssU0FBUztBQUNqQixXQUFLLFVBQVUsS0FBSyxLQUFLLElBQUksV0FBTSxLQUFLLHFCQUFxQjtBQUFBLElBQy9EO0FBRUEsUUFBSSxDQUFDLEtBQUssUUFBUSxNQUFNLHFCQUFxQixHQUFHO0FBQzlDLGNBQVEsSUFBSSxzQkFBc0IsS0FBSyxPQUFPO0FBQzlDLFVBQUksU0FBUyxPQUFPLGdFQUFnRSxLQUFLLFVBQVUsR0FBRztBQUFBLElBQ3hHO0FBRUEsVUFBTSxZQUFZLEtBQUssVUFBVTtBQUNqQyxTQUFLLElBQUksTUFBTSxRQUFRO0FBQUEsTUFDckIsOEJBQThCO0FBQUEsTUFDOUIsS0FBSyxVQUFVLEtBQUssUUFBUSxNQUFNLENBQUM7QUFBQSxJQUNyQztBQUFBLEVBQ0Y7QUFBQSxFQUNBLE1BQU0sVUFBVSxTQUFTO0FBQ3ZCLFNBQUssVUFBVTtBQUdmLFVBQU0sWUFBWSxLQUFLLFVBQVU7QUFFakMsUUFBSSxZQUFZLE1BQU0sS0FBSyxJQUFJLE1BQU0sUUFBUTtBQUFBLE1BQzNDLDhCQUE4QjtBQUFBLElBQ2hDO0FBRUEsU0FBSyxTQUFTLEtBQUssTUFBTSxTQUFTO0FBRWxDLFNBQUssVUFBVSxLQUFLLGdCQUFnQjtBQUFBLEVBS3RDO0FBQUE7QUFBQTtBQUFBLEVBR0EsZ0JBQWdCLHlCQUF1QixDQUFDLEdBQUc7QUFFekMsUUFBRyx1QkFBdUIsV0FBVyxHQUFFO0FBQ3JDLFdBQUssVUFBVSxLQUFLLE9BQU8sSUFBSSxVQUFRO0FBQ3JDLGVBQU8sS0FBSyxLQUFLLFNBQVMsQ0FBQztBQUFBLE1BQzdCLENBQUM7QUFBQSxJQUNILE9BQUs7QUFHSCxVQUFJLHVCQUF1QixDQUFDO0FBQzVCLGVBQVEsSUFBSSxHQUFHLElBQUksdUJBQXVCLFFBQVEsS0FBSTtBQUNwRCw2QkFBcUIsdUJBQXVCLENBQUMsRUFBRSxDQUFDLENBQUMsSUFBSSx1QkFBdUIsQ0FBQyxFQUFFLENBQUM7QUFBQSxNQUNsRjtBQUVBLFdBQUssVUFBVSxLQUFLLE9BQU8sSUFBSSxDQUFDLE1BQU0sZUFBZTtBQUVuRCxZQUFHLHFCQUFxQixVQUFVLE1BQU0sUUFBVTtBQUNoRCxpQkFBTyxLQUFLLHFCQUFxQixVQUFVLENBQUM7QUFBQSxRQUM5QztBQUVBLGVBQU8sS0FBSyxLQUFLLFNBQVMsQ0FBQztBQUFBLE1BQzdCLENBQUM7QUFBQSxJQUNIO0FBRUEsU0FBSyxVQUFVLEtBQUssUUFBUSxJQUFJLGFBQVc7QUFDekMsYUFBTztBQUFBLFFBQ0wsTUFBTSxRQUFRO0FBQUEsUUFDZCxTQUFTLFFBQVE7QUFBQSxNQUNuQjtBQUFBLElBQ0YsQ0FBQztBQUNELFdBQU8sS0FBSztBQUFBLEVBQ2Q7QUFBQSxFQUNBLE9BQU87QUFFTCxXQUFPLEtBQUssT0FBTyxLQUFLLE9BQU8sU0FBUyxDQUFDLEVBQUUsS0FBSyxPQUFPLEtBQUssT0FBTyxTQUFTLENBQUMsRUFBRSxTQUFTLENBQUM7QUFBQSxFQUMzRjtBQUFBLEVBQ0EsWUFBWTtBQUNWLFdBQU8sS0FBSyxLQUFLLEVBQUU7QUFBQSxFQUNyQjtBQUFBO0FBQUEsRUFFQSxlQUFlO0FBQ2IsV0FBTyxLQUFLLEtBQUssRUFBRTtBQUFBLEVBQ3JCO0FBQUE7QUFBQTtBQUFBLEVBR0Esc0JBQXNCLFNBQVMsT0FBSyxJQUFJO0FBRXRDLFFBQUcsS0FBSyxTQUFRO0FBQ2QsY0FBUSxVQUFVLEtBQUs7QUFDdkIsV0FBSyxVQUFVO0FBQUEsSUFDakI7QUFDQSxRQUFHLEtBQUssS0FBSTtBQUNWLGNBQVEsTUFBTSxLQUFLO0FBQ25CLFdBQUssTUFBTTtBQUFBLElBQ2I7QUFDQSxRQUFJLFNBQVMsSUFBSTtBQUNmLFdBQUssT0FBTyxLQUFLLENBQUMsT0FBTyxDQUFDO0FBQUEsSUFDNUIsT0FBSztBQUVILFdBQUssT0FBTyxJQUFJLEVBQUUsS0FBSyxPQUFPO0FBQUEsSUFDaEM7QUFBQSxFQUNGO0FBQUEsRUFDQSxnQkFBZTtBQUNiLFNBQUssVUFBVTtBQUNmLFNBQUssTUFBTTtBQUFBLEVBQ2I7QUFBQSxFQUNBLE1BQU0sWUFBWSxVQUFTO0FBRXpCLFFBQUksS0FBSyxXQUFXLE1BQU0sS0FBSyxJQUFJLE1BQU0sUUFBUSxPQUFPLDhCQUE4QixLQUFLLFVBQVUsT0FBTyxHQUFHO0FBQzdHLGlCQUFXLEtBQUssUUFBUSxRQUFRLEtBQUssS0FBSyxHQUFHLFFBQVE7QUFFckQsWUFBTSxLQUFLLElBQUksTUFBTSxRQUFRO0FBQUEsUUFDM0IsOEJBQThCLEtBQUssVUFBVTtBQUFBLFFBQzdDLDhCQUE4QixXQUFXO0FBQUEsTUFDM0M7QUFFQSxXQUFLLFVBQVU7QUFBQSxJQUNqQixPQUFLO0FBQ0gsV0FBSyxVQUFVLFdBQVcsV0FBTSxLQUFLLHFCQUFxQjtBQUUxRCxZQUFNLEtBQUssVUFBVTtBQUFBLElBQ3ZCO0FBQUEsRUFFRjtBQUFBLEVBRUEsT0FBTztBQUNMLFFBQUcsS0FBSyxTQUFRO0FBRWQsYUFBTyxLQUFLLFFBQVEsUUFBUSxXQUFVLEVBQUU7QUFBQSxJQUMxQztBQUNBLFdBQU87QUFBQSxFQUNUO0FBQUEsRUFFQSx1QkFBdUI7QUFDckIsWUFBTyxvQkFBSSxLQUFLLEdBQUUsWUFBWSxFQUFFLFFBQVEsZUFBZSxHQUFHLEVBQUUsS0FBSztBQUFBLEVBQ25FO0FBQUE7QUFBQSxFQUVBLE1BQU0sK0JBQStCLFlBQVksV0FBVztBQUMxRCxRQUFJLGVBQWU7QUFFbkIsVUFBTSxRQUFRLEtBQUssdUJBQXVCLFVBQVU7QUFFcEQsUUFBSSxZQUFZLGNBQWMsS0FBSyxPQUFPLFNBQVMsZ0JBQWdCO0FBQ25FLGFBQVEsSUFBSSxHQUFHLElBQUksTUFBTSxRQUFRLEtBQUk7QUFFbkMsWUFBTSxpQkFBa0IsTUFBTSxTQUFTLElBQUksSUFBSyxLQUFLLE1BQU0sYUFBYSxNQUFNLFNBQVMsRUFBRSxJQUFJO0FBRTdGLFlBQU0sZUFBZSxNQUFNLEtBQUssa0JBQWtCLE1BQU0sQ0FBQyxHQUFHLEVBQUMsWUFBWSxlQUFjLENBQUM7QUFDeEYsc0JBQWdCLG9CQUFvQixNQUFNLENBQUMsRUFBRTtBQUFBO0FBQzdDLHNCQUFnQjtBQUNoQixzQkFBZ0I7QUFBQTtBQUNoQixtQkFBYSxhQUFhO0FBQzFCLFVBQUcsYUFBYTtBQUFHO0FBQUEsSUFDckI7QUFDQSxTQUFLLFVBQVU7QUFDZixVQUFNLFNBQVM7QUFBQSxNQUNiO0FBQUEsUUFDRSxNQUFNO0FBQUEsUUFDTixTQUFTO0FBQUEsTUFDWDtBQUFBLE1BQ0E7QUFBQSxRQUNFLE1BQU07QUFBQSxRQUNOLFNBQVM7QUFBQSxNQUNYO0FBQUEsSUFDRjtBQUNBLGNBQVUsMkJBQTJCLEVBQUMsVUFBVSxRQUFRLGFBQWEsRUFBQyxDQUFDO0FBQUEsRUFDekU7QUFBQTtBQUFBLEVBRUEsdUJBQXVCLFlBQVk7QUFDakMsUUFBRyxXQUFXLFFBQVEsSUFBSSxNQUFNO0FBQUksYUFBTztBQUMzQyxRQUFHLFdBQVcsUUFBUSxJQUFJLE1BQU07QUFBSSxhQUFPO0FBQzNDLFdBQU87QUFBQSxFQUNUO0FBQUE7QUFBQSxFQUVBLDBCQUEwQixZQUFZO0FBQ3BDLFFBQUcsV0FBVyxRQUFRLEdBQUcsTUFBTTtBQUFJLGFBQU87QUFDMUMsUUFBRyxXQUFXLFFBQVEsR0FBRyxNQUFNLFdBQVcsWUFBWSxHQUFHO0FBQUcsYUFBTztBQUNuRSxXQUFPO0FBQUEsRUFDVDtBQUFBO0FBQUEsRUFFQSxzQkFBc0IsWUFBWTtBQUVoQyxVQUFNLFVBQVUsS0FBSyxPQUFPLFFBQVEsTUFBTTtBQUMxQyxVQUFNLFVBQVUsUUFBUSxLQUFLLENBQUMsR0FBRyxNQUFNLEVBQUUsU0FBUyxFQUFFLE1BQU0sRUFBRSxJQUFJLFlBQVU7QUFFeEUsVUFBRyxXQUFXLFFBQVEsTUFBTSxNQUFNLElBQUc7QUFFbkMscUJBQWEsV0FBVyxRQUFRLFFBQVEsRUFBRTtBQUMxQyxlQUFPO0FBQUEsTUFDVDtBQUNBLGFBQU87QUFBQSxJQUNULENBQUMsRUFBRSxPQUFPLFlBQVUsTUFBTTtBQUMxQixZQUFRLElBQUksT0FBTztBQUVuQixRQUFHO0FBQVMsYUFBTztBQUNuQixXQUFPO0FBQUEsRUFDVDtBQUFBO0FBQUEsRUFJQSx1QkFBdUIsWUFBWTtBQUNqQyxVQUFNLFVBQVUsV0FBVyxNQUFNLGdCQUFnQjtBQUNqRCxZQUFRLElBQUksT0FBTztBQUVuQixRQUFHO0FBQVMsYUFBTyxRQUFRLElBQUksV0FBUztBQUN0QyxlQUFPLEtBQUssSUFBSSxjQUFjLHFCQUFxQixNQUFNLFFBQVEsTUFBTSxFQUFFLEVBQUUsUUFBUSxNQUFNLEVBQUUsR0FBRyxHQUFHO0FBQUEsTUFDbkcsQ0FBQztBQUNELFdBQU8sQ0FBQztBQUFBLEVBQ1Y7QUFBQTtBQUFBLEVBRUEsTUFBTSxrQkFBa0IsTUFBTSxPQUFLLENBQUMsR0FBRztBQUNyQyxXQUFPO0FBQUEsTUFDTCxZQUFZO0FBQUEsTUFDWixHQUFHO0FBQUEsSUFDTDtBQUVBLFFBQUcsRUFBRSxnQkFBZ0IsU0FBUztBQUFRLGFBQU87QUFFN0MsUUFBSSxlQUFlLE1BQU0sS0FBSyxJQUFJLE1BQU0sV0FBVyxJQUFJO0FBRXZELFFBQUcsYUFBYSxRQUFRLGFBQWEsSUFBSSxJQUFHO0FBRTFDLHFCQUFlLE1BQU0sS0FBSyx3QkFBd0IsY0FBYyxLQUFLLE1BQU0sSUFBSTtBQUFBLElBQ2pGO0FBQ0EsbUJBQWUsYUFBYSxVQUFVLEdBQUcsS0FBSyxVQUFVO0FBRXhELFdBQU87QUFBQSxFQUNUO0FBQUEsRUFHQSxNQUFNLHdCQUF3QixjQUFjLFdBQVcsT0FBSyxDQUFDLEdBQUc7QUFDOUQsV0FBTztBQUFBLE1BQ0wsWUFBWTtBQUFBLE1BQ1osR0FBRztBQUFBLElBQ0w7QUFFQSxVQUFNLGVBQWUsT0FBTyxhQUFhO0FBRXpDLFFBQUcsQ0FBQztBQUFjLGFBQU87QUFDekIsVUFBTSx1QkFBdUIsYUFBYSxNQUFNLHVCQUF1QjtBQUV2RSxhQUFTLElBQUksR0FBRyxJQUFJLHFCQUFxQixRQUFRLEtBQUs7QUFFcEQsVUFBRyxLQUFLLGNBQWMsS0FBSyxhQUFhLGFBQWEsUUFBUSxxQkFBcUIsQ0FBQyxDQUFDO0FBQUc7QUFFdkYsWUFBTSxzQkFBc0IscUJBQXFCLENBQUM7QUFFbEQsWUFBTSw4QkFBOEIsb0JBQW9CLFFBQVEsZUFBZSxFQUFFLEVBQUUsUUFBUSxPQUFPLEVBQUU7QUFFcEcsWUFBTSx3QkFBd0IsTUFBTSxhQUFhLGNBQWMsNkJBQTZCLFdBQVcsSUFBSTtBQUUzRyxVQUFJLHNCQUFzQixZQUFZO0FBQ3BDLHVCQUFlLGFBQWEsUUFBUSxxQkFBcUIsc0JBQXNCLEtBQUs7QUFBQSxNQUN0RjtBQUFBLElBQ0Y7QUFDQSxXQUFPO0FBQUEsRUFDVDtBQUNGO0FBRUEsSUFBTSxtQ0FBTixjQUErQyxTQUFTLGtCQUFrQjtBQUFBLEVBQ3hFLFlBQVksS0FBSyxNQUFNLE9BQU87QUFDNUIsVUFBTSxHQUFHO0FBQ1QsU0FBSyxNQUFNO0FBQ1gsU0FBSyxPQUFPO0FBQ1osU0FBSyxlQUFlLG9DQUFvQztBQUFBLEVBQzFEO0FBQUEsRUFDQSxXQUFXO0FBQ1QsUUFBSSxDQUFDLEtBQUssS0FBSyxPQUFPO0FBQ3BCLGFBQU8sQ0FBQztBQUFBLElBQ1Y7QUFDQSxXQUFPLEtBQUssS0FBSztBQUFBLEVBQ25CO0FBQUEsRUFDQSxZQUFZLE1BQU07QUFFaEIsUUFBRyxLQUFLLFFBQVEsVUFBVSxNQUFNLElBQUc7QUFDakMsV0FBSyxRQUFRLFdBQVUsRUFBRTtBQUFBLElBQzNCO0FBQ0EsV0FBTztBQUFBLEVBQ1Q7QUFBQSxFQUNBLGFBQWEsU0FBUztBQUNwQixTQUFLLEtBQUssVUFBVSxPQUFPO0FBQUEsRUFDN0I7QUFDRjtBQUdBLElBQU0sa0NBQU4sY0FBOEMsU0FBUyxrQkFBa0I7QUFBQSxFQUN2RSxZQUFZLEtBQUssTUFBTTtBQUNyQixVQUFNLEdBQUc7QUFDVCxTQUFLLE1BQU07QUFDWCxTQUFLLE9BQU87QUFDWixTQUFLLGVBQWUsNEJBQTRCO0FBQUEsRUFDbEQ7QUFBQSxFQUNBLFdBQVc7QUFFVCxXQUFPLEtBQUssSUFBSSxNQUFNLGlCQUFpQixFQUFFLEtBQUssQ0FBQyxHQUFHLE1BQU0sRUFBRSxTQUFTLGNBQWMsRUFBRSxRQUFRLENBQUM7QUFBQSxFQUM5RjtBQUFBLEVBQ0EsWUFBWSxNQUFNO0FBQ2hCLFdBQU8sS0FBSztBQUFBLEVBQ2Q7QUFBQSxFQUNBLGFBQWEsTUFBTTtBQUNqQixTQUFLLEtBQUssaUJBQWlCLEtBQUssV0FBVyxLQUFLO0FBQUEsRUFDbEQ7QUFDRjtBQUVBLElBQU0sb0NBQU4sY0FBZ0QsU0FBUyxrQkFBa0I7QUFBQSxFQUN6RSxZQUFZLEtBQUssTUFBTTtBQUNyQixVQUFNLEdBQUc7QUFDVCxTQUFLLE1BQU07QUFDWCxTQUFLLE9BQU87QUFDWixTQUFLLGVBQWUsOEJBQThCO0FBQUEsRUFDcEQ7QUFBQSxFQUNBLFdBQVc7QUFDVCxXQUFPLEtBQUssS0FBSyxPQUFPO0FBQUEsRUFDMUI7QUFBQSxFQUNBLFlBQVksTUFBTTtBQUNoQixXQUFPO0FBQUEsRUFDVDtBQUFBLEVBQ0EsYUFBYSxRQUFRO0FBQ25CLFNBQUssS0FBSyxpQkFBaUIsU0FBUyxJQUFJO0FBQUEsRUFDMUM7QUFDRjtBQUlBLElBQU0sYUFBTixNQUFpQjtBQUFBO0FBQUEsRUFFZixZQUFZLEtBQUssU0FBUztBQUV4QixjQUFVLFdBQVcsQ0FBQztBQUN0QixTQUFLLE1BQU07QUFDWCxTQUFLLFNBQVMsUUFBUSxVQUFVO0FBQ2hDLFNBQUssVUFBVSxRQUFRLFdBQVcsQ0FBQztBQUNuQyxTQUFLLFVBQVUsUUFBUSxXQUFXO0FBQ2xDLFNBQUssa0JBQWtCLFFBQVEsbUJBQW1CO0FBQ2xELFNBQUssWUFBWSxDQUFDO0FBQ2xCLFNBQUssYUFBYSxLQUFLO0FBQ3ZCLFNBQUssV0FBVztBQUNoQixTQUFLLFFBQVE7QUFDYixTQUFLLE1BQU07QUFDWCxTQUFLLGtCQUFrQjtBQUN2QixTQUFLLGVBQWU7QUFDcEIsU0FBSyxhQUFhO0FBQ2xCLFNBQUssT0FBTztBQUNaLFNBQUssU0FBUztBQUFBLEVBQ2hCO0FBQUE7QUFBQSxFQUVBLGlCQUFpQixNQUFNLFVBQVU7QUFFL0IsUUFBSSxDQUFDLEtBQUssVUFBVSxJQUFJLEdBQUc7QUFDekIsV0FBSyxVQUFVLElBQUksSUFBSSxDQUFDO0FBQUEsSUFDMUI7QUFFQSxRQUFHLEtBQUssVUFBVSxJQUFJLEVBQUUsUUFBUSxRQUFRLE1BQU0sSUFBSTtBQUNoRCxXQUFLLFVBQVUsSUFBSSxFQUFFLEtBQUssUUFBUTtBQUFBLElBQ3BDO0FBQUEsRUFDRjtBQUFBO0FBQUEsRUFFQSxvQkFBb0IsTUFBTSxVQUFVO0FBRWxDLFFBQUksQ0FBQyxLQUFLLFVBQVUsSUFBSSxHQUFHO0FBQ3pCO0FBQUEsSUFDRjtBQUNBLFFBQUksV0FBVyxDQUFDO0FBRWhCLGFBQVMsSUFBSSxHQUFHLElBQUksS0FBSyxVQUFVLElBQUksRUFBRSxRQUFRLEtBQUs7QUFFcEQsVUFBSSxLQUFLLFVBQVUsSUFBSSxFQUFFLENBQUMsTUFBTSxVQUFVO0FBQ3hDLGlCQUFTLEtBQUssS0FBSyxVQUFVLElBQUksRUFBRSxDQUFDLENBQUM7QUFBQSxNQUN2QztBQUFBLElBQ0Y7QUFFQSxRQUFJLEtBQUssVUFBVSxJQUFJLEVBQUUsV0FBVyxHQUFHO0FBQ3JDLGFBQU8sS0FBSyxVQUFVLElBQUk7QUFBQSxJQUM1QixPQUFPO0FBQ0wsV0FBSyxVQUFVLElBQUksSUFBSTtBQUFBLElBQ3pCO0FBQUEsRUFDRjtBQUFBO0FBQUEsRUFFQSxjQUFjLE9BQU87QUFFbkIsUUFBSSxDQUFDLE9BQU87QUFDVixhQUFPO0FBQUEsSUFDVDtBQUVBLFVBQU0sU0FBUztBQUVmLFFBQUksWUFBWSxPQUFPLE1BQU07QUFFN0IsUUFBSSxLQUFLLGVBQWUsU0FBUyxHQUFHO0FBRWxDLFdBQUssU0FBUyxFQUFFLEtBQUssTUFBTSxLQUFLO0FBRWhDLFVBQUksTUFBTSxrQkFBa0I7QUFDMUIsZUFBTztBQUFBLE1BQ1Q7QUFBQSxJQUNGO0FBRUEsUUFBSSxLQUFLLFVBQVUsTUFBTSxJQUFJLEdBQUc7QUFDOUIsYUFBTyxLQUFLLFVBQVUsTUFBTSxJQUFJLEVBQUUsTUFBTSxTQUFTLFVBQVU7QUFDekQsaUJBQVMsS0FBSztBQUNkLGVBQU8sQ0FBQyxNQUFNO0FBQUEsTUFDaEIsQ0FBQztBQUFBLElBQ0g7QUFDQSxXQUFPO0FBQUEsRUFDVDtBQUFBO0FBQUEsRUFFQSxlQUFlLE9BQU87QUFFcEIsUUFBSSxRQUFRLElBQUksWUFBWSxrQkFBa0I7QUFFOUMsVUFBTSxhQUFhO0FBRW5CLFNBQUssYUFBYTtBQUVsQixTQUFLLGNBQWMsS0FBSztBQUFBLEVBQzFCO0FBQUE7QUFBQSxFQUVBLGlCQUFpQixHQUFHO0FBRWxCLFFBQUksUUFBUSxJQUFJLFlBQVksT0FBTztBQUVuQyxVQUFNLE9BQU8sRUFBRSxjQUFjO0FBRTdCLFNBQUssY0FBYyxLQUFLO0FBQ3hCLFNBQUssTUFBTTtBQUFBLEVBQ2I7QUFBQTtBQUFBLEVBRUEsZUFBZSxHQUFHO0FBRWhCLFFBQUksUUFBUSxJQUFJLFlBQVksT0FBTztBQUVuQyxTQUFLLE1BQU07QUFBQSxFQUNiO0FBQUE7QUFBQSxFQUVBLGtCQUFrQixHQUFHO0FBRW5CLFFBQUksQ0FBQyxLQUFLLEtBQUs7QUFDYjtBQUFBLElBQ0Y7QUFFQSxRQUFJLEtBQUssSUFBSSxXQUFXLEtBQUs7QUFFM0IsV0FBSyxpQkFBaUIsQ0FBQztBQUN2QjtBQUFBLElBQ0Y7QUFFQSxRQUFJLEtBQUssZUFBZSxLQUFLLFlBQVk7QUFFdkMsV0FBSyxjQUFjLElBQUksWUFBWSxNQUFNLENBQUM7QUFFMUMsV0FBSyxlQUFlLEtBQUssSUFBSTtBQUFBLElBQy9CO0FBRUEsUUFBSSxPQUFPLEtBQUssSUFBSSxhQUFhLFVBQVUsS0FBSyxRQUFRO0FBRXhELFNBQUssWUFBWSxLQUFLO0FBRXRCLFNBQUssTUFBTSxrQkFBa0IsRUFBRSxRQUFRLFNBQVMsTUFBSztBQUNuRCxVQUFHLEtBQUssS0FBSyxFQUFFLFdBQVcsR0FBRztBQUMzQixhQUFLLGNBQWMsS0FBSyxpQkFBaUIsS0FBSyxNQUFNLEtBQUssQ0FBQyxDQUFDO0FBQzNELGFBQUssUUFBUTtBQUFBLE1BQ2YsT0FBTztBQUNMLGFBQUssU0FBUztBQUFBLE1BQ2hCO0FBQUEsSUFDRixFQUFFLEtBQUssSUFBSSxDQUFDO0FBQUEsRUFDZDtBQUFBO0FBQUEsRUFFQSxnQkFBZ0IsR0FBRztBQUNqQixTQUFLLGtCQUFrQixDQUFDO0FBRXhCLFNBQUssY0FBYyxLQUFLLGlCQUFpQixLQUFLLEtBQUssQ0FBQztBQUNwRCxTQUFLLFFBQVE7QUFBQSxFQUNmO0FBQUE7QUFBQSxFQUVBLGlCQUFpQixPQUFPO0FBRXRCLFFBQUksQ0FBQyxTQUFTLE1BQU0sV0FBVyxHQUFHO0FBQ2hDLGFBQU87QUFBQSxJQUNUO0FBRUEsUUFBSSxJQUFJLEVBQUMsSUFBSSxNQUFNLE9BQU8sTUFBTSxNQUFNLElBQUksT0FBTyxVQUFTO0FBRTFELFVBQU0sTUFBTSxjQUFjLEVBQUUsUUFBUSxTQUFTLE1BQU07QUFDakQsYUFBTyxLQUFLLFVBQVU7QUFDdEIsVUFBSSxRQUFRLEtBQUssUUFBUSxLQUFLLGVBQWU7QUFDN0MsVUFBRyxTQUFTLEdBQUc7QUFDYjtBQUFBLE1BQ0Y7QUFFQSxVQUFJLFFBQVEsS0FBSyxVQUFVLEdBQUcsS0FBSztBQUNuQyxVQUFHLEVBQUUsU0FBUyxJQUFJO0FBQ2hCO0FBQUEsTUFDRjtBQUVBLFVBQUksUUFBUSxLQUFLLFVBQVUsUUFBUSxDQUFDLEVBQUUsU0FBUztBQUMvQyxVQUFHLFVBQVUsUUFBUTtBQUNuQixVQUFFLEtBQUssS0FBSztBQUFBLE1BQ2QsT0FBTztBQUNMLFVBQUUsS0FBSyxJQUFJO0FBQUEsTUFDYjtBQUFBLElBQ0YsRUFBRSxLQUFLLElBQUksQ0FBQztBQUVaLFFBQUksUUFBUSxJQUFJLFlBQVksRUFBRSxLQUFLO0FBQ25DLFVBQU0sT0FBTyxFQUFFO0FBQ2YsVUFBTSxLQUFLLEVBQUU7QUFDYixXQUFPO0FBQUEsRUFDVDtBQUFBO0FBQUEsRUFFQSxxQkFBcUI7QUFDbkIsUUFBRyxDQUFDLEtBQUssS0FBSztBQUNaO0FBQUEsSUFDRjtBQUNBLFFBQUcsS0FBSyxJQUFJLGVBQWUsZUFBZSxNQUFNO0FBQzlDLFdBQUssZUFBZSxLQUFLLE1BQU07QUFBQSxJQUNqQztBQUFBLEVBQ0Y7QUFBQTtBQUFBLEVBRUEsU0FBUztBQUVQLFNBQUssZUFBZSxLQUFLLFVBQVU7QUFFbkMsU0FBSyxNQUFNLElBQUksZUFBZTtBQUU5QixTQUFLLElBQUksaUJBQWlCLFlBQVksS0FBSyxrQkFBa0IsS0FBSyxJQUFJLENBQUM7QUFFdkUsU0FBSyxJQUFJLGlCQUFpQixRQUFRLEtBQUssZ0JBQWdCLEtBQUssSUFBSSxDQUFDO0FBRWpFLFNBQUssSUFBSSxpQkFBaUIsb0JBQW9CLEtBQUssbUJBQW1CLEtBQUssSUFBSSxDQUFDO0FBRWhGLFNBQUssSUFBSSxpQkFBaUIsU0FBUyxLQUFLLGlCQUFpQixLQUFLLElBQUksQ0FBQztBQUVuRSxTQUFLLElBQUksaUJBQWlCLFNBQVMsS0FBSyxlQUFlLEtBQUssSUFBSSxDQUFDO0FBRWpFLFNBQUssSUFBSSxLQUFLLEtBQUssUUFBUSxLQUFLLEdBQUc7QUFFbkMsYUFBUyxVQUFVLEtBQUssU0FBUztBQUMvQixXQUFLLElBQUksaUJBQWlCLFFBQVEsS0FBSyxRQUFRLE1BQU0sQ0FBQztBQUFBLElBQ3hEO0FBRUEsU0FBSyxJQUFJLGtCQUFrQixLQUFLO0FBRWhDLFNBQUssSUFBSSxLQUFLLEtBQUssT0FBTztBQUFBLEVBQzVCO0FBQUE7QUFBQSxFQUVBLFFBQVE7QUFDTixRQUFHLEtBQUssZUFBZSxLQUFLLFFBQVE7QUFDbEM7QUFBQSxJQUNGO0FBQ0EsU0FBSyxJQUFJLE1BQU07QUFDZixTQUFLLE1BQU07QUFDWCxTQUFLLGVBQWUsS0FBSyxNQUFNO0FBQUEsRUFDakM7QUFDRjtBQUVBLE9BQU8sVUFBVTsiLAogICJuYW1lcyI6IFsiZXhwb3J0cyIsICJtb2R1bGUiLCAiVmVjTGl0ZSIsICJsaW5lX2xpbWl0IiwgIml0ZW0iLCAibGluayIsICJmaWxlX2xpbmsiLCAiZmlsZV9saW5rX2xpc3QiXQp9Cg==
