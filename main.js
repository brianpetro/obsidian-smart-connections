// src/index.js
var Obsidian = require("obsidian");
var VecLite = class {
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
      console.log(
        "failed to load embeddings file, prompt user to initiate bulk embed"
      );
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
      const existing_file_size = await this.stat(this.file_path).then(
        (stat) => stat.size
      );
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
        await this.write_file(
          this.folder_path + "/unsaved-embeddings.json",
          embeddings
        );
        throw new Error(
          "Error: New embeddings file size is significantly smaller than existing embeddings file size. Aborting to prevent possible loss of embeddings data."
        );
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
        if (typeof filter.path_begins_with === "string" && !this.embeddings[from_keys[i]].meta.path.startsWith(
          filter.path_begins_with
        ))
          continue;
        if (Array.isArray(filter.path_begins_with) && !filter.path_begins_with.some(
          (path) => this.embeddings[from_keys[i]].meta.path.startsWith(path)
        ))
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
        const sim = this.computeCosineSimilarity(
          to_vec,
          this.embeddings[from_keys[i]].vec
        );
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
    await this.rename(
      this.file_path,
      this.folder_path + "/embeddings-" + current_datetime + ".json"
    );
    await this.init_embeddings_file();
  }
};
var DEFAULT_SETTINGS = {
  api_key: "",
  chat_open: true,
  file_exclusions: "",
  folder_exclusions: "",
  header_exclusions: "",
  path_only: "",
  show_full_path: false,
  cut_off_frontmatter: false,
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
  open_in_big_view: false
};
var MAX_EMBED_STRING_LENGTH = 25e3;
var VERSION;
var SUPPORTED_FILE_TYPES = ["md", "canvas"];
var SMART_TRANSLATION = {
  "en": {
    "pronous": ["my", "I", "me", "mine", "our", "ours", "us", "we"],
    "prompt": "Based on your notes",
    "initial_message": "Hi, I'm ChatGPT with access to your notes via Smart Connections. Ask me a question about your notes and I'll try to answer it.",
    "try_placeholder": `Try "Based on my notes" or "Summarize [[this note]]" or "Important tasks in /folder/"`
  },
  "es": {
    "pronous": ["mi", "yo", "m\xED", "t\xFA"],
    "prompt": "Bas\xE1ndose en sus notas",
    "initial_message": "Hola, soy ChatGPT con acceso a tus apuntes a trav\xE9s de Smart Connections. Hazme una pregunta sobre tus apuntes e intentar\xE9 responderte.",
    "try_placeholder": `Prueba "Basado en mis notas" o "Resumen [[esta nota]]" o "Tareas importantes en /carpeta/"`
  },
  "fr": {
    "pronous": ["me", "mon", "ma", "mes", "moi", "nous", "notre", "nos", "je", "j'", "m'"],
    "prompt": "D'apr\xE8s vos notes",
    "initial_message": "Bonjour, je suis ChatGPT et j'ai acc\xE8s \xE0 vos notes via Smart Connections. Posez-moi une question sur vos notes et j'essaierai d'y r\xE9pondre.",
    "try_placeholder": `Essayez "D'apr\xE8s mes notes" ou "R\xE9sume [[cette note]]" ou "T\xE2ches importantes dans /dossier/"`
  },
  "de": {
    "pronous": ["mein", "meine", "meinen", "meiner", "meines", "mir", "uns", "unser", "unseren", "unserer", "unseres"],
    "prompt": "Basierend auf Ihren Notizen",
    "initial_message": "Hallo, ich bin ChatGPT und habe \xFCber Smart Connections Zugang zu Ihren Notizen. Stellen Sie mir eine Frage zu Ihren Notizen und ich werde versuchen, sie zu beantworten.",
    "try_placeholder": `Versuchen Sie "Basierend auf meinen Notizen" oder "Zusammenfassen [[dieser Notiz]]" oder "Wichtige Aufgaben im /Ordner/"`
  },
  "it": {
    "pronous": ["mio", "mia", "miei", "mie", "noi", "nostro", "nostri", "nostra", "nostre"],
    "prompt": "Sulla base degli appunti",
    "initial_message": "Ciao, sono ChatGPT e ho accesso ai tuoi appunti tramite Smart Connections. Fatemi una domanda sui vostri appunti e cercher\xF2 di rispondervi.",
    "try_placeholder": `Prova "Sulla base dei miei appunti" o "Riassumi [[questo appunto]]" o "Compiti importanti in /cartella/"`
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
      this.file_exclusions = this.settings.file_exclusions.split(/[,\n\s]/).filter((file) => file.length > 0).map((file) => {
        return file.trim();
      });
    }
    if (this.settings.folder_exclusions && this.settings.folder_exclusions.length > 0) {
      const folder_exclusions = this.settings.folder_exclusions.split(/[,\n\s]/).filter((file) => file.length > 0).map((folder) => {
        folder = folder.trim();
        return folder.slice(-1) === "/" ? folder : `${folder}/`;
      });
      this.file_exclusions = this.file_exclusions.concat(folder_exclusions);
    }
    if (this.settings.header_exclusions && this.settings.header_exclusions.length > 0) {
      this.header_exclusions = this.settings.header_exclusions.split(/[\s\n,]/).filter((file) => file.length > 0).map((header) => {
        return header.trim();
      });
    }
    if (this.settings.path_only && this.settings.path_only.length > 0) {
      this.path_only = this.settings.path_only.split(/[\s\n,]/).filter((file) => file.length > 0).map((path) => {
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
    if (!this.settings.open_in_big_view) {
      await this.app.workspace.getRightLeaf(false).setViewState({
        type: SMART_CONNECTIONS_CHAT_VIEW_TYPE,
        active: true
      });
    } else {
      await this.app.workspace.getLeaf(true).setViewState({
        type: SMART_CONNECTIONS_CHAT_VIEW_TYPE,
        active: true
      });
    }
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
      for (const fileExclusion of this.file_exclusions) {
        if (files[i].path.includes(fileExclusion)) {
          skip = true;
          this.log_exclusion(fileExclusion);
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
        console.log(this);
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
  async init_vecs() {
    this.smart_vec_lite = new VecLite({
      folder_path: ".smart-connections",
      exists_adapter: this.app.vault.adapter.exists.bind(
        this.app.vault.adapter
      ),
      mkdir_adapter: this.app.vault.adapter.mkdir.bind(this.app.vault.adapter),
      read_adapter: this.app.vault.adapter.read.bind(this.app.vault.adapter),
      rename_adapter: this.app.vault.adapter.rename.bind(
        this.app.vault.adapter
      ),
      stat_adapter: this.app.vault.adapter.stat.bind(this.app.vault.adapter),
      write_adapter: this.app.vault.adapter.write.bind(this.app.vault.adapter)
    });
    this.embeddings_loaded = await this.smart_vec_lite.load();
    return this.embeddings_loaded;
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
      text: "Gain early access to version 2 (includes local embedding model)."
    });
    supporter_benefits_list.createEl("li", {
      text: "Stay informed and engaged with exclusive supporter-only communications."
    });
    new Obsidian.Setting(containerEl).setName("Supporter License Key").setDesc("Note: this is not required to use Smart Connections.").addText((text) => text.setPlaceholder("Enter your license_key").setValue(this.plugin.settings.license_key).onChange(async (value) => {
      this.plugin.settings.license_key = value.trim();
      await this.plugin.saveSettings(true);
    }));
    new Obsidian.Setting(containerEl).setName("Get v2").setDesc("Get v2 (warning: very early beta release, likely to crash, please send issues directly to the supporter email for quick response)").addButton((button) => button.setButtonText("Get v2 (unstable)").onClick(async () => {
      await this.plugin.update_to_v2();
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
    new Obsidian.Setting(containerEl).setName("Cut off frontmatter").setDesc("Cut off frontmatter in the prompt to gain characters in reply generation").addToggle((toggle) => {
      toggle.setValue(this.plugin.settings.cut_off_frontmatter).onChange(async (value) => {
        this.plugin.settings.cut_off_frontmatter = value;
        await this.plugin.saveSettings();
      });
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
    new Obsidian.Setting(containerEl).setName("open_in_big_view").setDesc("Open in big view or small view.").addDropdown((dropdown) => {
      dropdown.addOption(false, "Right pane (small)");
      dropdown.addOption(true, "Main pane (big)");
      dropdown.setValue(this.plugin.settings.open_in_big_view);
      dropdown.onChange(async (value) => {
        this.plugin.settings.open_in_big_view = JSON.parse(value);
        await this.plugin.saveSettings(true);
        this.plugin.open_chat();
      });
    });
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
        placeholder: SMART_TRANSLATION[this.plugin.settings.language].try_placeholder
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
      console.log(note_content);
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
    if (this.plugin.settings.cut_off_frontmatter) {
      file_content = file_content.replace(/\s*---[\s\S]*?---/, "");
    }
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vc3JjL2luZGV4LmpzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJjb25zdCBPYnNpZGlhbiA9IHJlcXVpcmUoXCJvYnNpZGlhblwiKTtcclxuY29uc3QgVmVjTGl0ZSA9IGNsYXNzIHtcclxuICBjb25zdHJ1Y3Rvcihjb25maWcpIHtcclxuICAgIHRoaXMuY29uZmlnID0ge1xyXG4gICAgICBmaWxlX25hbWU6IFwiZW1iZWRkaW5ncy0zLmpzb25cIixcclxuICAgICAgZm9sZGVyX3BhdGg6IFwiLnZlY19saXRlXCIsXHJcbiAgICAgIGV4aXN0c19hZGFwdGVyOiBudWxsLFxyXG4gICAgICBta2Rpcl9hZGFwdGVyOiBudWxsLFxyXG4gICAgICByZWFkX2FkYXB0ZXI6IG51bGwsXHJcbiAgICAgIHJlbmFtZV9hZGFwdGVyOiBudWxsLFxyXG4gICAgICBzdGF0X2FkYXB0ZXI6IG51bGwsXHJcbiAgICAgIHdyaXRlX2FkYXB0ZXI6IG51bGwsXHJcbiAgICAgIC4uLmNvbmZpZyxcclxuICAgIH07XHJcbiAgICB0aGlzLmZpbGVfbmFtZSA9IHRoaXMuY29uZmlnLmZpbGVfbmFtZTtcclxuICAgIHRoaXMuZm9sZGVyX3BhdGggPSBjb25maWcuZm9sZGVyX3BhdGg7XHJcbiAgICB0aGlzLmZpbGVfcGF0aCA9IHRoaXMuZm9sZGVyX3BhdGggKyBcIi9cIiArIHRoaXMuZmlsZV9uYW1lO1xyXG4gICAgdGhpcy5lbWJlZGRpbmdzID0gZmFsc2U7XHJcbiAgfVxyXG4gIGFzeW5jIGZpbGVfZXhpc3RzKHBhdGgpIHtcclxuICAgIGlmICh0aGlzLmNvbmZpZy5leGlzdHNfYWRhcHRlcikge1xyXG4gICAgICByZXR1cm4gYXdhaXQgdGhpcy5jb25maWcuZXhpc3RzX2FkYXB0ZXIocGF0aCk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJleGlzdHNfYWRhcHRlciBub3Qgc2V0XCIpO1xyXG4gICAgfVxyXG4gIH1cclxuICBhc3luYyBta2RpcihwYXRoKSB7XHJcbiAgICBpZiAodGhpcy5jb25maWcubWtkaXJfYWRhcHRlcikge1xyXG4gICAgICByZXR1cm4gYXdhaXQgdGhpcy5jb25maWcubWtkaXJfYWRhcHRlcihwYXRoKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIHRocm93IG5ldyBFcnJvcihcIm1rZGlyX2FkYXB0ZXIgbm90IHNldFwiKTtcclxuICAgIH1cclxuICB9XHJcbiAgYXN5bmMgcmVhZF9maWxlKHBhdGgpIHtcclxuICAgIGlmICh0aGlzLmNvbmZpZy5yZWFkX2FkYXB0ZXIpIHtcclxuICAgICAgcmV0dXJuIGF3YWl0IHRoaXMuY29uZmlnLnJlYWRfYWRhcHRlcihwYXRoKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIHRocm93IG5ldyBFcnJvcihcInJlYWRfYWRhcHRlciBub3Qgc2V0XCIpO1xyXG4gICAgfVxyXG4gIH1cclxuICBhc3luYyByZW5hbWUob2xkX3BhdGgsIG5ld19wYXRoKSB7XHJcbiAgICBpZiAodGhpcy5jb25maWcucmVuYW1lX2FkYXB0ZXIpIHtcclxuICAgICAgcmV0dXJuIGF3YWl0IHRoaXMuY29uZmlnLnJlbmFtZV9hZGFwdGVyKG9sZF9wYXRoLCBuZXdfcGF0aCk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJyZW5hbWVfYWRhcHRlciBub3Qgc2V0XCIpO1xyXG4gICAgfVxyXG4gIH1cclxuICBhc3luYyBzdGF0KHBhdGgpIHtcclxuICAgIGlmICh0aGlzLmNvbmZpZy5zdGF0X2FkYXB0ZXIpIHtcclxuICAgICAgcmV0dXJuIGF3YWl0IHRoaXMuY29uZmlnLnN0YXRfYWRhcHRlcihwYXRoKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIHRocm93IG5ldyBFcnJvcihcInN0YXRfYWRhcHRlciBub3Qgc2V0XCIpO1xyXG4gICAgfVxyXG4gIH1cclxuICBhc3luYyB3cml0ZV9maWxlKHBhdGgsIGRhdGEpIHtcclxuICAgIGlmICh0aGlzLmNvbmZpZy53cml0ZV9hZGFwdGVyKSB7XHJcbiAgICAgIHJldHVybiBhd2FpdCB0aGlzLmNvbmZpZy53cml0ZV9hZGFwdGVyKHBhdGgsIGRhdGEpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgdGhyb3cgbmV3IEVycm9yKFwid3JpdGVfYWRhcHRlciBub3Qgc2V0XCIpO1xyXG4gICAgfVxyXG4gIH1cclxuICBhc3luYyBsb2FkKHJldHJpZXMgPSAwKSB7XHJcbiAgICB0cnkge1xyXG4gICAgICBjb25zdCBlbWJlZGRpbmdzX2ZpbGUgPSBhd2FpdCB0aGlzLnJlYWRfZmlsZSh0aGlzLmZpbGVfcGF0aCk7XHJcbiAgICAgIHRoaXMuZW1iZWRkaW5ncyA9IEpTT04ucGFyc2UoZW1iZWRkaW5nc19maWxlKTtcclxuICAgICAgY29uc29sZS5sb2coXCJsb2FkZWQgZW1iZWRkaW5ncyBmaWxlOiBcIiArIHRoaXMuZmlsZV9wYXRoKTtcclxuICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgICBpZiAocmV0cmllcyA8IDMpIHtcclxuICAgICAgICBjb25zb2xlLmxvZyhcInJldHJ5aW5nIGxvYWQoKVwiKTtcclxuICAgICAgICBhd2FpdCBuZXcgUHJvbWlzZSgocikgPT4gc2V0VGltZW91dChyLCAxZTMgKyAxZTMgKiByZXRyaWVzKSk7XHJcbiAgICAgICAgcmV0dXJuIGF3YWl0IHRoaXMubG9hZChyZXRyaWVzICsgMSk7XHJcbiAgICAgIH1cclxuICAgICAgY29uc29sZS5sb2coXHJcbiAgICAgICAgXCJmYWlsZWQgdG8gbG9hZCBlbWJlZGRpbmdzIGZpbGUsIHByb21wdCB1c2VyIHRvIGluaXRpYXRlIGJ1bGsgZW1iZWRcIlxyXG4gICAgICApO1xyXG4gICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICB9XHJcbiAgfVxyXG4gIGFzeW5jIGluaXRfZW1iZWRkaW5nc19maWxlKCkge1xyXG4gICAgaWYgKCEoYXdhaXQgdGhpcy5maWxlX2V4aXN0cyh0aGlzLmZvbGRlcl9wYXRoKSkpIHtcclxuICAgICAgYXdhaXQgdGhpcy5ta2Rpcih0aGlzLmZvbGRlcl9wYXRoKTtcclxuICAgICAgY29uc29sZS5sb2coXCJjcmVhdGVkIGZvbGRlcjogXCIgKyB0aGlzLmZvbGRlcl9wYXRoKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIGNvbnNvbGUubG9nKFwiZm9sZGVyIGFscmVhZHkgZXhpc3RzOiBcIiArIHRoaXMuZm9sZGVyX3BhdGgpO1xyXG4gICAgfVxyXG4gICAgaWYgKCEoYXdhaXQgdGhpcy5maWxlX2V4aXN0cyh0aGlzLmZpbGVfcGF0aCkpKSB7XHJcbiAgICAgIGF3YWl0IHRoaXMud3JpdGVfZmlsZSh0aGlzLmZpbGVfcGF0aCwgXCJ7fVwiKTtcclxuICAgICAgY29uc29sZS5sb2coXCJjcmVhdGVkIGVtYmVkZGluZ3MgZmlsZTogXCIgKyB0aGlzLmZpbGVfcGF0aCk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICBjb25zb2xlLmxvZyhcImVtYmVkZGluZ3MgZmlsZSBhbHJlYWR5IGV4aXN0czogXCIgKyB0aGlzLmZpbGVfcGF0aCk7XHJcbiAgICB9XHJcbiAgfVxyXG4gIGFzeW5jIHNhdmUoKSB7XHJcbiAgICBjb25zdCBlbWJlZGRpbmdzID0gSlNPTi5zdHJpbmdpZnkodGhpcy5lbWJlZGRpbmdzKTtcclxuICAgIGNvbnN0IGVtYmVkZGluZ3NfZmlsZV9leGlzdHMgPSBhd2FpdCB0aGlzLmZpbGVfZXhpc3RzKHRoaXMuZmlsZV9wYXRoKTtcclxuICAgIGlmIChlbWJlZGRpbmdzX2ZpbGVfZXhpc3RzKSB7XHJcbiAgICAgIGNvbnN0IG5ld19maWxlX3NpemUgPSBlbWJlZGRpbmdzLmxlbmd0aDtcclxuICAgICAgY29uc3QgZXhpc3RpbmdfZmlsZV9zaXplID0gYXdhaXQgdGhpcy5zdGF0KHRoaXMuZmlsZV9wYXRoKS50aGVuKFxyXG4gICAgICAgIChzdGF0KSA9PiBzdGF0LnNpemVcclxuICAgICAgKTtcclxuICAgICAgaWYgKG5ld19maWxlX3NpemUgPiBleGlzdGluZ19maWxlX3NpemUgKiAwLjUpIHtcclxuICAgICAgICBhd2FpdCB0aGlzLndyaXRlX2ZpbGUodGhpcy5maWxlX3BhdGgsIGVtYmVkZGluZ3MpO1xyXG4gICAgICAgIGNvbnNvbGUubG9nKFwiZW1iZWRkaW5ncyBmaWxlIHNpemU6IFwiICsgbmV3X2ZpbGVfc2l6ZSArIFwiIGJ5dGVzXCIpO1xyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIGNvbnN0IHdhcm5pbmdfbWVzc2FnZSA9IFtcclxuICAgICAgICAgIFwiV2FybmluZzogTmV3IGVtYmVkZGluZ3MgZmlsZSBzaXplIGlzIHNpZ25pZmljYW50bHkgc21hbGxlciB0aGFuIGV4aXN0aW5nIGVtYmVkZGluZ3MgZmlsZSBzaXplLlwiLFxyXG4gICAgICAgICAgXCJBYm9ydGluZyB0byBwcmV2ZW50IHBvc3NpYmxlIGxvc3Mgb2YgZW1iZWRkaW5ncyBkYXRhLlwiLFxyXG4gICAgICAgICAgXCJOZXcgZmlsZSBzaXplOiBcIiArIG5ld19maWxlX3NpemUgKyBcIiBieXRlcy5cIixcclxuICAgICAgICAgIFwiRXhpc3RpbmcgZmlsZSBzaXplOiBcIiArIGV4aXN0aW5nX2ZpbGVfc2l6ZSArIFwiIGJ5dGVzLlwiLFxyXG4gICAgICAgICAgXCJSZXN0YXJ0aW5nIE9ic2lkaWFuIG1heSBmaXggdGhpcy5cIixcclxuICAgICAgICBdO1xyXG4gICAgICAgIGNvbnNvbGUubG9nKHdhcm5pbmdfbWVzc2FnZS5qb2luKFwiIFwiKSk7XHJcbiAgICAgICAgYXdhaXQgdGhpcy53cml0ZV9maWxlKFxyXG4gICAgICAgICAgdGhpcy5mb2xkZXJfcGF0aCArIFwiL3Vuc2F2ZWQtZW1iZWRkaW5ncy5qc29uXCIsXHJcbiAgICAgICAgICBlbWJlZGRpbmdzXHJcbiAgICAgICAgKTtcclxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXHJcbiAgICAgICAgICBcIkVycm9yOiBOZXcgZW1iZWRkaW5ncyBmaWxlIHNpemUgaXMgc2lnbmlmaWNhbnRseSBzbWFsbGVyIHRoYW4gZXhpc3RpbmcgZW1iZWRkaW5ncyBmaWxlIHNpemUuIEFib3J0aW5nIHRvIHByZXZlbnQgcG9zc2libGUgbG9zcyBvZiBlbWJlZGRpbmdzIGRhdGEuXCJcclxuICAgICAgICApO1xyXG4gICAgICB9XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICBhd2FpdCB0aGlzLmluaXRfZW1iZWRkaW5nc19maWxlKCk7XHJcbiAgICAgIHJldHVybiBhd2FpdCB0aGlzLnNhdmUoKTtcclxuICAgIH1cclxuICAgIHJldHVybiB0cnVlO1xyXG4gIH1cclxuICBjb3Nfc2ltKHZlY3RvcjEsIHZlY3RvcjIpIHtcclxuICAgIGxldCBkb3RQcm9kdWN0ID0gMDtcclxuICAgIGxldCBub3JtQSA9IDA7XHJcbiAgICBsZXQgbm9ybUIgPSAwO1xyXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCB2ZWN0b3IxLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgIGRvdFByb2R1Y3QgKz0gdmVjdG9yMVtpXSAqIHZlY3RvcjJbaV07XHJcbiAgICAgIG5vcm1BICs9IHZlY3RvcjFbaV0gKiB2ZWN0b3IxW2ldO1xyXG4gICAgICBub3JtQiArPSB2ZWN0b3IyW2ldICogdmVjdG9yMltpXTtcclxuICAgIH1cclxuICAgIGlmIChub3JtQSA9PT0gMCB8fCBub3JtQiA9PT0gMCkge1xyXG4gICAgICByZXR1cm4gMDtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIHJldHVybiBkb3RQcm9kdWN0IC8gKE1hdGguc3FydChub3JtQSkgKiBNYXRoLnNxcnQobm9ybUIpKTtcclxuICAgIH1cclxuICB9XHJcbiAgbmVhcmVzdCh0b192ZWMsIGZpbHRlciA9IHt9KSB7XHJcbiAgICBmaWx0ZXIgPSB7XHJcbiAgICAgIHJlc3VsdHNfY291bnQ6IDMwLFxyXG4gICAgICAuLi5maWx0ZXIsXHJcbiAgICB9O1xyXG4gICAgbGV0IG5lYXJlc3QgPSBbXTtcclxuICAgIGNvbnN0IGZyb21fa2V5cyA9IE9iamVjdC5rZXlzKHRoaXMuZW1iZWRkaW5ncyk7XHJcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGZyb21fa2V5cy5sZW5ndGg7IGkrKykge1xyXG4gICAgICBpZiAoZmlsdGVyLnNraXBfc2VjdGlvbnMpIHtcclxuICAgICAgICBjb25zdCBmcm9tX3BhdGggPSB0aGlzLmVtYmVkZGluZ3NbZnJvbV9rZXlzW2ldXS5tZXRhLnBhdGg7XHJcbiAgICAgICAgaWYgKGZyb21fcGF0aC5pbmRleE9mKFwiI1wiKSA+IC0xKSBjb250aW51ZTtcclxuICAgICAgfVxyXG4gICAgICBpZiAoZmlsdGVyLnNraXBfa2V5KSB7XHJcbiAgICAgICAgaWYgKGZpbHRlci5za2lwX2tleSA9PT0gZnJvbV9rZXlzW2ldKSBjb250aW51ZTtcclxuICAgICAgICBpZiAoZmlsdGVyLnNraXBfa2V5ID09PSB0aGlzLmVtYmVkZGluZ3NbZnJvbV9rZXlzW2ldXS5tZXRhLnBhcmVudClcclxuICAgICAgICAgIGNvbnRpbnVlO1xyXG4gICAgICB9XHJcbiAgICAgIGlmIChmaWx0ZXIucGF0aF9iZWdpbnNfd2l0aCkge1xyXG4gICAgICAgIGlmIChcclxuICAgICAgICAgIHR5cGVvZiBmaWx0ZXIucGF0aF9iZWdpbnNfd2l0aCA9PT0gXCJzdHJpbmdcIiAmJlxyXG4gICAgICAgICAgIXRoaXMuZW1iZWRkaW5nc1tmcm9tX2tleXNbaV1dLm1ldGEucGF0aC5zdGFydHNXaXRoKFxyXG4gICAgICAgICAgICBmaWx0ZXIucGF0aF9iZWdpbnNfd2l0aFxyXG4gICAgICAgICAgKVxyXG4gICAgICAgIClcclxuICAgICAgICAgIGNvbnRpbnVlO1xyXG4gICAgICAgIGlmIChcclxuICAgICAgICAgIEFycmF5LmlzQXJyYXkoZmlsdGVyLnBhdGhfYmVnaW5zX3dpdGgpICYmXHJcbiAgICAgICAgICAhZmlsdGVyLnBhdGhfYmVnaW5zX3dpdGguc29tZSgocGF0aCkgPT5cclxuICAgICAgICAgICAgdGhpcy5lbWJlZGRpbmdzW2Zyb21fa2V5c1tpXV0ubWV0YS5wYXRoLnN0YXJ0c1dpdGgocGF0aClcclxuICAgICAgICAgIClcclxuICAgICAgICApXHJcbiAgICAgICAgICBjb250aW51ZTtcclxuICAgICAgfVxyXG4gICAgICBuZWFyZXN0LnB1c2goe1xyXG4gICAgICAgIGxpbms6IHRoaXMuZW1iZWRkaW5nc1tmcm9tX2tleXNbaV1dLm1ldGEucGF0aCxcclxuICAgICAgICBzaW1pbGFyaXR5OiB0aGlzLmNvc19zaW0odG9fdmVjLCB0aGlzLmVtYmVkZGluZ3NbZnJvbV9rZXlzW2ldXS52ZWMpLFxyXG4gICAgICAgIHNpemU6IHRoaXMuZW1iZWRkaW5nc1tmcm9tX2tleXNbaV1dLm1ldGEuc2l6ZSxcclxuICAgICAgfSk7XHJcbiAgICB9XHJcbiAgICBuZWFyZXN0LnNvcnQoZnVuY3Rpb24gKGEsIGIpIHtcclxuICAgICAgcmV0dXJuIGIuc2ltaWxhcml0eSAtIGEuc2ltaWxhcml0eTtcclxuICAgIH0pO1xyXG4gICAgbmVhcmVzdCA9IG5lYXJlc3Quc2xpY2UoMCwgZmlsdGVyLnJlc3VsdHNfY291bnQpO1xyXG4gICAgcmV0dXJuIG5lYXJlc3Q7XHJcbiAgfVxyXG4gIGZpbmRfbmVhcmVzdF9lbWJlZGRpbmdzKHRvX3ZlYywgZmlsdGVyID0ge30pIHtcclxuICAgIGNvbnN0IGRlZmF1bHRfZmlsdGVyID0ge1xyXG4gICAgICBtYXg6IHRoaXMubWF4X3NvdXJjZXMsXHJcbiAgICB9O1xyXG4gICAgZmlsdGVyID0geyAuLi5kZWZhdWx0X2ZpbHRlciwgLi4uZmlsdGVyIH07XHJcbiAgICBpZiAoQXJyYXkuaXNBcnJheSh0b192ZWMpICYmIHRvX3ZlYy5sZW5ndGggIT09IHRoaXMudmVjX2xlbikge1xyXG4gICAgICB0aGlzLm5lYXJlc3QgPSB7fTtcclxuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0b192ZWMubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICB0aGlzLmZpbmRfbmVhcmVzdF9lbWJlZGRpbmdzKHRvX3ZlY1tpXSwge1xyXG4gICAgICAgICAgbWF4OiBNYXRoLmZsb29yKGZpbHRlci5tYXggLyB0b192ZWMubGVuZ3RoKSxcclxuICAgICAgICB9KTtcclxuICAgICAgfVxyXG4gICAgfSBlbHNlIHtcclxuICAgICAgY29uc3QgZnJvbV9rZXlzID0gT2JqZWN0LmtleXModGhpcy5lbWJlZGRpbmdzKTtcclxuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBmcm9tX2tleXMubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICBpZiAodGhpcy52YWxpZGF0ZV90eXBlKHRoaXMuZW1iZWRkaW5nc1tmcm9tX2tleXNbaV1dKSkgY29udGludWU7XHJcbiAgICAgICAgY29uc3Qgc2ltID0gdGhpcy5jb21wdXRlQ29zaW5lU2ltaWxhcml0eShcclxuICAgICAgICAgIHRvX3ZlYyxcclxuICAgICAgICAgIHRoaXMuZW1iZWRkaW5nc1tmcm9tX2tleXNbaV1dLnZlY1xyXG4gICAgICAgICk7XHJcbiAgICAgICAgaWYgKHRoaXMubmVhcmVzdFtmcm9tX2tleXNbaV1dKSB7XHJcbiAgICAgICAgICB0aGlzLm5lYXJlc3RbZnJvbV9rZXlzW2ldXSArPSBzaW07XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgIHRoaXMubmVhcmVzdFtmcm9tX2tleXNbaV1dID0gc2ltO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgfVxyXG4gICAgbGV0IG5lYXJlc3QgPSBPYmplY3Qua2V5cyh0aGlzLm5lYXJlc3QpLm1hcCgoa2V5KSA9PiB7XHJcbiAgICAgIHJldHVybiB7XHJcbiAgICAgICAga2V5LFxyXG4gICAgICAgIHNpbWlsYXJpdHk6IHRoaXMubmVhcmVzdFtrZXldLFxyXG4gICAgICB9O1xyXG4gICAgfSk7XHJcbiAgICBuZWFyZXN0ID0gdGhpcy5zb3J0X2J5X3NpbWlsYXJpdHkobmVhcmVzdCk7XHJcbiAgICBuZWFyZXN0ID0gbmVhcmVzdC5zbGljZSgwLCBmaWx0ZXIubWF4KTtcclxuICAgIG5lYXJlc3QgPSBuZWFyZXN0Lm1hcCgoaXRlbSkgPT4ge1xyXG4gICAgICByZXR1cm4ge1xyXG4gICAgICAgIGxpbms6IHRoaXMuZW1iZWRkaW5nc1tpdGVtLmtleV0ubWV0YS5wYXRoLFxyXG4gICAgICAgIHNpbWlsYXJpdHk6IGl0ZW0uc2ltaWxhcml0eSxcclxuICAgICAgICBsZW46XHJcbiAgICAgICAgICB0aGlzLmVtYmVkZGluZ3NbaXRlbS5rZXldLm1ldGEubGVuIHx8XHJcbiAgICAgICAgICB0aGlzLmVtYmVkZGluZ3NbaXRlbS5rZXldLm1ldGEuc2l6ZSxcclxuICAgICAgfTtcclxuICAgIH0pO1xyXG4gICAgcmV0dXJuIG5lYXJlc3Q7XHJcbiAgfVxyXG4gIHNvcnRfYnlfc2ltaWxhcml0eShuZWFyZXN0KSB7XHJcbiAgICByZXR1cm4gbmVhcmVzdC5zb3J0KGZ1bmN0aW9uIChhLCBiKSB7XHJcbiAgICAgIGNvbnN0IGFfc2NvcmUgPSBhLnNpbWlsYXJpdHk7XHJcbiAgICAgIGNvbnN0IGJfc2NvcmUgPSBiLnNpbWlsYXJpdHk7XHJcbiAgICAgIGlmIChhX3Njb3JlID4gYl9zY29yZSkgcmV0dXJuIC0xO1xyXG4gICAgICBpZiAoYV9zY29yZSA8IGJfc2NvcmUpIHJldHVybiAxO1xyXG4gICAgICByZXR1cm4gMDtcclxuICAgIH0pO1xyXG4gIH1cclxuICAvLyBjaGVjayBpZiBrZXkgZnJvbSBlbWJlZGRpbmdzIGV4aXN0cyBpbiBmaWxlc1xyXG4gIGNsZWFuX3VwX2VtYmVkZGluZ3MoZmlsZXMpIHtcclxuICAgIGNvbnNvbGUubG9nKFwiY2xlYW5pbmcgdXAgZW1iZWRkaW5nc1wiKTtcclxuICAgIGNvbnN0IGtleXMgPSBPYmplY3Qua2V5cyh0aGlzLmVtYmVkZGluZ3MpO1xyXG4gICAgbGV0IGRlbGV0ZWRfZW1iZWRkaW5ncyA9IDA7XHJcbiAgICBmb3IgKGNvbnN0IGtleSBvZiBrZXlzKSB7XHJcbiAgICAgIGNvbnN0IHBhdGggPSB0aGlzLmVtYmVkZGluZ3Nba2V5XS5tZXRhLnBhdGg7XHJcbiAgICAgIGlmICghZmlsZXMuZmluZCgoZmlsZSkgPT4gcGF0aC5zdGFydHNXaXRoKGZpbGUucGF0aCkpKSB7XHJcbiAgICAgICAgZGVsZXRlIHRoaXMuZW1iZWRkaW5nc1trZXldO1xyXG4gICAgICAgIGRlbGV0ZWRfZW1iZWRkaW5ncysrO1xyXG4gICAgICAgIGNvbnRpbnVlO1xyXG4gICAgICB9XHJcbiAgICAgIGlmIChwYXRoLmluZGV4T2YoXCIjXCIpID4gLTEpIHtcclxuICAgICAgICBjb25zdCBwYXJlbnRfa2V5ID0gdGhpcy5lbWJlZGRpbmdzW2tleV0ubWV0YS5wYXJlbnQ7XHJcbiAgICAgICAgaWYgKCF0aGlzLmVtYmVkZGluZ3NbcGFyZW50X2tleV0pIHtcclxuICAgICAgICAgIGRlbGV0ZSB0aGlzLmVtYmVkZGluZ3Nba2V5XTtcclxuICAgICAgICAgIGRlbGV0ZWRfZW1iZWRkaW5ncysrO1xyXG4gICAgICAgICAgY29udGludWU7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmICghdGhpcy5lbWJlZGRpbmdzW3BhcmVudF9rZXldLm1ldGEpIHtcclxuICAgICAgICAgIGRlbGV0ZSB0aGlzLmVtYmVkZGluZ3Nba2V5XTtcclxuICAgICAgICAgIGRlbGV0ZWRfZW1iZWRkaW5ncysrO1xyXG4gICAgICAgICAgY29udGludWU7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmIChcclxuICAgICAgICAgIHRoaXMuZW1iZWRkaW5nc1twYXJlbnRfa2V5XS5tZXRhLmNoaWxkcmVuICYmXHJcbiAgICAgICAgICB0aGlzLmVtYmVkZGluZ3NbcGFyZW50X2tleV0ubWV0YS5jaGlsZHJlbi5pbmRleE9mKGtleSkgPCAwXHJcbiAgICAgICAgKSB7XHJcbiAgICAgICAgICBkZWxldGUgdGhpcy5lbWJlZGRpbmdzW2tleV07XHJcbiAgICAgICAgICBkZWxldGVkX2VtYmVkZGluZ3MrKztcclxuICAgICAgICAgIGNvbnRpbnVlO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgfVxyXG4gICAgcmV0dXJuIHsgZGVsZXRlZF9lbWJlZGRpbmdzLCB0b3RhbF9lbWJlZGRpbmdzOiBrZXlzLmxlbmd0aCB9O1xyXG4gIH1cclxuICBnZXQoa2V5KSB7XHJcbiAgICByZXR1cm4gdGhpcy5lbWJlZGRpbmdzW2tleV0gfHwgbnVsbDtcclxuICB9XHJcbiAgZ2V0X21ldGEoa2V5KSB7XHJcbiAgICBjb25zdCBlbWJlZGRpbmcgPSB0aGlzLmdldChrZXkpO1xyXG4gICAgaWYgKGVtYmVkZGluZyAmJiBlbWJlZGRpbmcubWV0YSkge1xyXG4gICAgICByZXR1cm4gZW1iZWRkaW5nLm1ldGE7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gbnVsbDtcclxuICB9XHJcbiAgZ2V0X210aW1lKGtleSkge1xyXG4gICAgY29uc3QgbWV0YSA9IHRoaXMuZ2V0X21ldGEoa2V5KTtcclxuICAgIGlmIChtZXRhICYmIG1ldGEubXRpbWUpIHtcclxuICAgICAgcmV0dXJuIG1ldGEubXRpbWU7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gbnVsbDtcclxuICB9XHJcbiAgZ2V0X2hhc2goa2V5KSB7XHJcbiAgICBjb25zdCBtZXRhID0gdGhpcy5nZXRfbWV0YShrZXkpO1xyXG4gICAgaWYgKG1ldGEgJiYgbWV0YS5oYXNoKSB7XHJcbiAgICAgIHJldHVybiBtZXRhLmhhc2g7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gbnVsbDtcclxuICB9XHJcbiAgZ2V0X3NpemUoa2V5KSB7XHJcbiAgICBjb25zdCBtZXRhID0gdGhpcy5nZXRfbWV0YShrZXkpO1xyXG4gICAgaWYgKG1ldGEgJiYgbWV0YS5zaXplKSB7XHJcbiAgICAgIHJldHVybiBtZXRhLnNpemU7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gbnVsbDtcclxuICB9XHJcbiAgZ2V0X2NoaWxkcmVuKGtleSkge1xyXG4gICAgY29uc3QgbWV0YSA9IHRoaXMuZ2V0X21ldGEoa2V5KTtcclxuICAgIGlmIChtZXRhICYmIG1ldGEuY2hpbGRyZW4pIHtcclxuICAgICAgcmV0dXJuIG1ldGEuY2hpbGRyZW47XHJcbiAgICB9XHJcbiAgICByZXR1cm4gbnVsbDtcclxuICB9XHJcbiAgZ2V0X3ZlYyhrZXkpIHtcclxuICAgIGNvbnN0IGVtYmVkZGluZyA9IHRoaXMuZ2V0KGtleSk7XHJcbiAgICBpZiAoZW1iZWRkaW5nICYmIGVtYmVkZGluZy52ZWMpIHtcclxuICAgICAgcmV0dXJuIGVtYmVkZGluZy52ZWM7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gbnVsbDtcclxuICB9XHJcbiAgc2F2ZV9lbWJlZGRpbmcoa2V5LCB2ZWMsIG1ldGEpIHtcclxuICAgIHRoaXMuZW1iZWRkaW5nc1trZXldID0ge1xyXG4gICAgICB2ZWMsXHJcbiAgICAgIG1ldGEsXHJcbiAgICB9O1xyXG4gIH1cclxuICBtdGltZV9pc19jdXJyZW50KGtleSwgc291cmNlX210aW1lKSB7XHJcbiAgICBjb25zdCBtdGltZSA9IHRoaXMuZ2V0X210aW1lKGtleSk7XHJcbiAgICBpZiAobXRpbWUgJiYgbXRpbWUgPj0gc291cmNlX210aW1lKSB7XHJcbiAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIGZhbHNlO1xyXG4gIH1cclxuICBhc3luYyBmb3JjZV9yZWZyZXNoKCkge1xyXG4gICAgdGhpcy5lbWJlZGRpbmdzID0gbnVsbDtcclxuICAgIHRoaXMuZW1iZWRkaW5ncyA9IHt9O1xyXG4gICAgbGV0IGN1cnJlbnRfZGF0ZXRpbWUgPSBNYXRoLmZsb29yKERhdGUubm93KCkgLyAxZTMpO1xyXG4gICAgYXdhaXQgdGhpcy5yZW5hbWUoXHJcbiAgICAgIHRoaXMuZmlsZV9wYXRoLFxyXG4gICAgICB0aGlzLmZvbGRlcl9wYXRoICsgXCIvZW1iZWRkaW5ncy1cIiArIGN1cnJlbnRfZGF0ZXRpbWUgKyBcIi5qc29uXCJcclxuICAgICk7XHJcbiAgICBhd2FpdCB0aGlzLmluaXRfZW1iZWRkaW5nc19maWxlKCk7XHJcbiAgfVxyXG59O1xyXG5cclxuXHJcblxyXG5jb25zdCBERUZBVUxUX1NFVFRJTkdTID0ge1xyXG4gIGFwaV9rZXk6IFwiXCIsXHJcbiAgY2hhdF9vcGVuOiB0cnVlLFxyXG4gIGZpbGVfZXhjbHVzaW9uczogXCJcIixcclxuICBmb2xkZXJfZXhjbHVzaW9uczogXCJcIixcclxuICBoZWFkZXJfZXhjbHVzaW9uczogXCJcIixcclxuICBwYXRoX29ubHk6IFwiXCIsXHJcbiAgc2hvd19mdWxsX3BhdGg6IGZhbHNlLFxyXG4gIGN1dF9vZmZfZnJvbnRtYXR0ZXI6IGZhbHNlLFxyXG4gIGV4cGFuZGVkX3ZpZXc6IHRydWUsXHJcbiAgZ3JvdXBfbmVhcmVzdF9ieV9maWxlOiBmYWxzZSxcclxuICBsYW5ndWFnZTogXCJlblwiLFxyXG4gIGxvZ19yZW5kZXI6IGZhbHNlLFxyXG4gIGxvZ19yZW5kZXJfZmlsZXM6IGZhbHNlLFxyXG4gIHJlY2VudGx5X3NlbnRfcmV0cnlfbm90aWNlOiBmYWxzZSxcclxuICBza2lwX3NlY3Rpb25zOiBmYWxzZSxcclxuICBzbWFydF9jaGF0X21vZGVsOiBcImdwdC0zLjUtdHVyYm8tMTZrXCIsXHJcbiAgdmlld19vcGVuOiB0cnVlLFxyXG4gIHZlcnNpb246IFwiXCIsXHJcbiAgb3Blbl9pbl9iaWdfdmlldzogZmFsc2UsXHJcbn07XHJcbmNvbnN0IE1BWF9FTUJFRF9TVFJJTkdfTEVOR1RIID0gMjUwMDA7XHJcblxyXG5sZXQgVkVSU0lPTjtcclxuY29uc3QgU1VQUE9SVEVEX0ZJTEVfVFlQRVMgPSBbXCJtZFwiLCBcImNhbnZhc1wiXTtcclxuXHJcbi8vY3JlYXRlIG9uZSBvYmplY3Qgd2l0aCBhbGwgdGhlIHRyYW5zbGF0aW9uc1xyXG4vLyByZXNlYXJjaCA6IFNNQVJUX1RSQU5TTEFUSU9OW2xhbmd1YWdlXVtrZXldXHJcbmNvbnN0IFNNQVJUX1RSQU5TTEFUSU9OID0ge1xyXG4gIFwiZW5cIjoge1xyXG4gICAgXCJwcm9ub3VzXCI6IFtcIm15XCIsIFwiSVwiLCBcIm1lXCIsIFwibWluZVwiLCBcIm91clwiLCBcIm91cnNcIiwgXCJ1c1wiLCBcIndlXCJdLFxyXG4gICAgXCJwcm9tcHRcIjogXCJCYXNlZCBvbiB5b3VyIG5vdGVzXCIsXHJcbiAgICBcImluaXRpYWxfbWVzc2FnZVwiOiBcIkhpLCBJJ20gQ2hhdEdQVCB3aXRoIGFjY2VzcyB0byB5b3VyIG5vdGVzIHZpYSBTbWFydCBDb25uZWN0aW9ucy4gQXNrIG1lIGEgcXVlc3Rpb24gYWJvdXQgeW91ciBub3RlcyBhbmQgSSdsbCB0cnkgdG8gYW5zd2VyIGl0LlwiLFxyXG4gICAgXCJ0cnlfcGxhY2Vob2xkZXJcIjogYFRyeSBcIkJhc2VkIG9uIG15IG5vdGVzXCIgb3IgXCJTdW1tYXJpemUgW1t0aGlzIG5vdGVdXVwiIG9yIFwiSW1wb3J0YW50IHRhc2tzIGluIC9mb2xkZXIvXCJgXHJcbiAgfSxcclxuICBcImVzXCI6IHtcclxuICAgIFwicHJvbm91c1wiOiBbXCJtaVwiLCBcInlvXCIsIFwibVx1MDBFRFwiLCBcInRcdTAwRkFcIl0sXHJcbiAgICBcInByb21wdFwiOiBcIkJhc1x1MDBFMW5kb3NlIGVuIHN1cyBub3Rhc1wiLFxyXG4gICAgXCJpbml0aWFsX21lc3NhZ2VcIjogXCJIb2xhLCBzb3kgQ2hhdEdQVCBjb24gYWNjZXNvIGEgdHVzIGFwdW50ZXMgYSB0cmF2XHUwMEU5cyBkZSBTbWFydCBDb25uZWN0aW9ucy4gSGF6bWUgdW5hIHByZWd1bnRhIHNvYnJlIHR1cyBhcHVudGVzIGUgaW50ZW50YXJcdTAwRTkgcmVzcG9uZGVydGUuXCIsXHJcbiAgICBcInRyeV9wbGFjZWhvbGRlclwiOiBgUHJ1ZWJhIFwiQmFzYWRvIGVuIG1pcyBub3Rhc1wiIG8gXCJSZXN1bWVuIFtbZXN0YSBub3RhXV1cIiBvIFwiVGFyZWFzIGltcG9ydGFudGVzIGVuIC9jYXJwZXRhL1wiYFxyXG4gIH0sXHJcbiAgXCJmclwiOiB7XHJcbiAgICBcInByb25vdXNcIjogW1wibWVcIiwgXCJtb25cIiwgXCJtYVwiLCBcIm1lc1wiLCBcIm1vaVwiLCBcIm5vdXNcIiwgXCJub3RyZVwiLCBcIm5vc1wiLCBcImplXCIsIFwiaidcIiwgXCJtJ1wiXSxcclxuICAgIFwicHJvbXB0XCI6IFwiRCdhcHJcdTAwRThzIHZvcyBub3Rlc1wiLFxyXG4gICAgXCJpbml0aWFsX21lc3NhZ2VcIjogXCJCb25qb3VyLCBqZSBzdWlzIENoYXRHUFQgZXQgaidhaSBhY2NcdTAwRThzIFx1MDBFMCB2b3Mgbm90ZXMgdmlhIFNtYXJ0IENvbm5lY3Rpb25zLiBQb3Nlei1tb2kgdW5lIHF1ZXN0aW9uIHN1ciB2b3Mgbm90ZXMgZXQgaidlc3NhaWVyYWkgZCd5IHJcdTAwRTlwb25kcmUuXCIsXHJcbiAgICBcInRyeV9wbGFjZWhvbGRlclwiOiBgRXNzYXlleiBcIkQnYXByXHUwMEU4cyBtZXMgbm90ZXNcIiBvdSBcIlJcdTAwRTlzdW1lIFtbY2V0dGUgbm90ZV1dXCIgb3UgXCJUXHUwMEUyY2hlcyBpbXBvcnRhbnRlcyBkYW5zIC9kb3NzaWVyL1wiYFxyXG4gIH0sXHJcbiAgXCJkZVwiOiB7XHJcbiAgICBcInByb25vdXNcIjogW1wibWVpblwiLCBcIm1laW5lXCIsIFwibWVpbmVuXCIsIFwibWVpbmVyXCIsIFwibWVpbmVzXCIsIFwibWlyXCIsIFwidW5zXCIsIFwidW5zZXJcIiwgXCJ1bnNlcmVuXCIsIFwidW5zZXJlclwiLCBcInVuc2VyZXNcIl0sXHJcbiAgICBcInByb21wdFwiOiBcIkJhc2llcmVuZCBhdWYgSWhyZW4gTm90aXplblwiLFxyXG4gICAgXCJpbml0aWFsX21lc3NhZ2VcIjogXCJIYWxsbywgaWNoIGJpbiBDaGF0R1BUIHVuZCBoYWJlIFx1MDBGQ2JlciBTbWFydCBDb25uZWN0aW9ucyBadWdhbmcgenUgSWhyZW4gTm90aXplbi4gU3RlbGxlbiBTaWUgbWlyIGVpbmUgRnJhZ2UgenUgSWhyZW4gTm90aXplbiB1bmQgaWNoIHdlcmRlIHZlcnN1Y2hlbiwgc2llIHp1IGJlYW50d29ydGVuLlwiLFxyXG4gICAgXCJ0cnlfcGxhY2Vob2xkZXJcIjogYFZlcnN1Y2hlbiBTaWUgXCJCYXNpZXJlbmQgYXVmIG1laW5lbiBOb3RpemVuXCIgb2RlciBcIlp1c2FtbWVuZmFzc2VuIFtbZGllc2VyIE5vdGl6XV1cIiBvZGVyIFwiV2ljaHRpZ2UgQXVmZ2FiZW4gaW0gL09yZG5lci9cImBcclxuICB9LFxyXG4gIFwiaXRcIjoge1xyXG4gICAgXCJwcm9ub3VzXCI6IFtcIm1pb1wiLCBcIm1pYVwiLCBcIm1pZWlcIiwgXCJtaWVcIiwgXCJub2lcIiwgXCJub3N0cm9cIiwgXCJub3N0cmlcIiwgXCJub3N0cmFcIiwgXCJub3N0cmVcIl0sXHJcbiAgICBcInByb21wdFwiOiBcIlN1bGxhIGJhc2UgZGVnbGkgYXBwdW50aVwiLFxyXG4gICAgXCJpbml0aWFsX21lc3NhZ2VcIjogXCJDaWFvLCBzb25vIENoYXRHUFQgZSBobyBhY2Nlc3NvIGFpIHR1b2kgYXBwdW50aSB0cmFtaXRlIFNtYXJ0IENvbm5lY3Rpb25zLiBGYXRlbWkgdW5hIGRvbWFuZGEgc3VpIHZvc3RyaSBhcHB1bnRpIGUgY2VyY2hlclx1MDBGMiBkaSByaXNwb25kZXJ2aS5cIixcclxuICAgIFwidHJ5X3BsYWNlaG9sZGVyXCI6IGBQcm92YSBcIlN1bGxhIGJhc2UgZGVpIG1pZWkgYXBwdW50aVwiIG8gXCJSaWFzc3VtaSBbW3F1ZXN0byBhcHB1bnRvXV1cIiBvIFwiQ29tcGl0aSBpbXBvcnRhbnRpIGluIC9jYXJ0ZWxsYS9cImBcclxuICB9LFxyXG59XHJcblxyXG4vLyByZXF1aXJlIGJ1aWx0LWluIGNyeXB0byBtb2R1bGVcclxuY29uc3QgY3J5cHRvID0gcmVxdWlyZShcImNyeXB0b1wiKTtcclxuLy8gbWQ1IGhhc2ggdXNpbmcgYnVpbHQgaW4gY3J5cHRvIG1vZHVsZVxyXG5mdW5jdGlvbiBtZDUoc3RyKSB7XHJcbiAgcmV0dXJuIGNyeXB0by5jcmVhdGVIYXNoKFwibWQ1XCIpLnVwZGF0ZShzdHIpLmRpZ2VzdChcImhleFwiKTtcclxufVxyXG5cclxuY2xhc3MgU21hcnRDb25uZWN0aW9uc1BsdWdpbiBleHRlbmRzIE9ic2lkaWFuLlBsdWdpbiB7XHJcbiAgLy8gY29uc3RydWN0b3JcclxuICBjb25zdHJ1Y3RvcigpIHtcclxuICAgIHN1cGVyKC4uLmFyZ3VtZW50cyk7XHJcbiAgICB0aGlzLmFwaSA9IG51bGw7XHJcbiAgICB0aGlzLmVtYmVkZGluZ3NfbG9hZGVkID0gZmFsc2U7XHJcbiAgICB0aGlzLmZpbGVfZXhjbHVzaW9ucyA9IFtdO1xyXG4gICAgdGhpcy5mb2xkZXJzID0gW107XHJcbiAgICB0aGlzLmhhc19uZXdfZW1iZWRkaW5ncyA9IGZhbHNlO1xyXG4gICAgdGhpcy5oZWFkZXJfZXhjbHVzaW9ucyA9IFtdO1xyXG4gICAgdGhpcy5uZWFyZXN0X2NhY2hlID0ge307XHJcbiAgICB0aGlzLnBhdGhfb25seSA9IFtdO1xyXG4gICAgdGhpcy5yZW5kZXJfbG9nID0ge307XHJcbiAgICB0aGlzLnJlbmRlcl9sb2cuZGVsZXRlZF9lbWJlZGRpbmdzID0gMDtcclxuICAgIHRoaXMucmVuZGVyX2xvZy5leGNsdXNpb25zX2xvZ3MgPSB7fTtcclxuICAgIHRoaXMucmVuZGVyX2xvZy5mYWlsZWRfZW1iZWRkaW5ncyA9IFtdO1xyXG4gICAgdGhpcy5yZW5kZXJfbG9nLmZpbGVzID0gW107XHJcbiAgICB0aGlzLnJlbmRlcl9sb2cubmV3X2VtYmVkZGluZ3MgPSAwO1xyXG4gICAgdGhpcy5yZW5kZXJfbG9nLnNraXBwZWRfbG93X2RlbHRhID0ge307XHJcbiAgICB0aGlzLnJlbmRlcl9sb2cudG9rZW5fdXNhZ2UgPSAwO1xyXG4gICAgdGhpcy5yZW5kZXJfbG9nLnRva2Vuc19zYXZlZF9ieV9jYWNoZSA9IDA7XHJcbiAgICB0aGlzLnJldHJ5X25vdGljZV90aW1lb3V0ID0gbnVsbDtcclxuICAgIHRoaXMuc2F2ZV90aW1lb3V0ID0gbnVsbDtcclxuICAgIHRoaXMuc2NfYnJhbmRpbmcgPSB7fTtcclxuICAgIHRoaXMuc2VsZl9yZWZfa3dfcmVnZXggPSBudWxsO1xyXG4gICAgdGhpcy51cGRhdGVfYXZhaWxhYmxlID0gZmFsc2U7XHJcbiAgfVxyXG5cclxuICBhc3luYyBvbmxvYWQoKSB7XHJcbiAgICAvLyBpbml0aWFsaXplIHdoZW4gbGF5b3V0IGlzIHJlYWR5XHJcbiAgICB0aGlzLmFwcC53b3Jrc3BhY2Uub25MYXlvdXRSZWFkeSh0aGlzLmluaXRpYWxpemUuYmluZCh0aGlzKSk7XHJcbiAgfVxyXG4gIG9udW5sb2FkKCkge1xyXG4gICAgdGhpcy5vdXRwdXRfcmVuZGVyX2xvZygpO1xyXG4gICAgY29uc29sZS5sb2coXCJ1bmxvYWRpbmcgcGx1Z2luXCIpO1xyXG4gICAgdGhpcy5hcHAud29ya3NwYWNlLmRldGFjaExlYXZlc09mVHlwZShTTUFSVF9DT05ORUNUSU9OU19WSUVXX1RZUEUpO1xyXG4gICAgdGhpcy5hcHAud29ya3NwYWNlLmRldGFjaExlYXZlc09mVHlwZShTTUFSVF9DT05ORUNUSU9OU19DSEFUX1ZJRVdfVFlQRSk7XHJcbiAgfVxyXG4gIGFzeW5jIGluaXRpYWxpemUoKSB7XHJcbiAgICBjb25zb2xlLmxvZyhcIkxvYWRpbmcgU21hcnQgQ29ubmVjdGlvbnMgcGx1Z2luXCIpO1xyXG4gICAgVkVSU0lPTiA9IHRoaXMubWFuaWZlc3QudmVyc2lvbjtcclxuICAgIC8vIFZFUlNJT04gPSAnMS4wLjAnO1xyXG4gICAgLy8gY29uc29sZS5sb2coVkVSU0lPTik7XHJcbiAgICBhd2FpdCB0aGlzLmxvYWRTZXR0aW5ncygpO1xyXG4gICAgLy8gcnVuIGFmdGVyIDMgc2Vjb25kc1xyXG4gICAgc2V0VGltZW91dCh0aGlzLmNoZWNrX2Zvcl91cGRhdGUuYmluZCh0aGlzKSwgMzAwMCk7XHJcbiAgICAvLyBydW4gY2hlY2sgZm9yIHVwZGF0ZSBldmVyeSAzIGhvdXJzXHJcbiAgICBzZXRJbnRlcnZhbCh0aGlzLmNoZWNrX2Zvcl91cGRhdGUuYmluZCh0aGlzKSwgMTA4MDAwMDApO1xyXG5cclxuICAgIHRoaXMuYWRkSWNvbigpO1xyXG4gICAgdGhpcy5hZGRDb21tYW5kKHtcclxuICAgICAgaWQ6IFwic2MtZmluZC1ub3Rlc1wiLFxyXG4gICAgICBuYW1lOiBcIkZpbmQ6IE1ha2UgU21hcnQgQ29ubmVjdGlvbnNcIixcclxuICAgICAgaWNvbjogXCJwZW5jaWxfaWNvblwiLFxyXG4gICAgICBob3RrZXlzOiBbXSxcclxuICAgICAgLy8gZWRpdG9yQ2FsbGJhY2s6IGFzeW5jIChlZGl0b3IpID0+IHtcclxuICAgICAgZWRpdG9yQ2FsbGJhY2s6IGFzeW5jIChlZGl0b3IpID0+IHtcclxuICAgICAgICBpZihlZGl0b3Iuc29tZXRoaW5nU2VsZWN0ZWQoKSkge1xyXG4gICAgICAgICAgLy8gZ2V0IHNlbGVjdGVkIHRleHRcclxuICAgICAgICAgIGxldCBzZWxlY3RlZF90ZXh0ID0gZWRpdG9yLmdldFNlbGVjdGlvbigpO1xyXG4gICAgICAgICAgLy8gcmVuZGVyIGNvbm5lY3Rpb25zIGZyb20gc2VsZWN0ZWQgdGV4dFxyXG4gICAgICAgICAgYXdhaXQgdGhpcy5tYWtlX2Nvbm5lY3Rpb25zKHNlbGVjdGVkX3RleHQpO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAvLyBjbGVhciBuZWFyZXN0X2NhY2hlIG9uIG1hbnVhbCBjYWxsIHRvIG1ha2UgY29ubmVjdGlvbnNcclxuICAgICAgICAgIHRoaXMubmVhcmVzdF9jYWNoZSA9IHt9O1xyXG4gICAgICAgICAgLy8gY29uc29sZS5sb2coXCJDbGVhcmVkIG5lYXJlc3RfY2FjaGVcIik7XHJcbiAgICAgICAgICBhd2FpdCB0aGlzLm1ha2VfY29ubmVjdGlvbnMoKTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG4gICAgdGhpcy5hZGRDb21tYW5kKHtcclxuICAgICAgaWQ6IFwic21hcnQtY29ubmVjdGlvbnMtdmlld1wiLFxyXG4gICAgICBuYW1lOiBcIk9wZW46IFZpZXcgU21hcnQgQ29ubmVjdGlvbnNcIixcclxuICAgICAgY2FsbGJhY2s6ICgpID0+IHtcclxuICAgICAgICB0aGlzLm9wZW5fdmlldygpO1xyXG4gICAgICB9XHJcbiAgICB9KTtcclxuICAgIC8vIG9wZW4gY2hhdCBjb21tYW5kXHJcbiAgICB0aGlzLmFkZENvbW1hbmQoe1xyXG4gICAgICBpZDogXCJzbWFydC1jb25uZWN0aW9ucy1jaGF0XCIsXHJcbiAgICAgIG5hbWU6IFwiT3BlbjogU21hcnQgQ2hhdCBDb252ZXJzYXRpb25cIixcclxuICAgICAgY2FsbGJhY2s6ICgpID0+IHtcclxuICAgICAgICB0aGlzLm9wZW5fY2hhdCgpO1xyXG4gICAgICB9XHJcbiAgICB9KTtcclxuICAgIC8vIG9wZW4gcmFuZG9tIG5vdGUgZnJvbSBuZWFyZXN0IGNhY2hlXHJcbiAgICB0aGlzLmFkZENvbW1hbmQoe1xyXG4gICAgICBpZDogXCJzbWFydC1jb25uZWN0aW9ucy1yYW5kb21cIixcclxuICAgICAgbmFtZTogXCJPcGVuOiBSYW5kb20gTm90ZSBmcm9tIFNtYXJ0IENvbm5lY3Rpb25zXCIsXHJcbiAgICAgIGNhbGxiYWNrOiAoKSA9PiB7XHJcbiAgICAgICAgdGhpcy5vcGVuX3JhbmRvbV9ub3RlKCk7XHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG4gICAgLy8gYWRkIHNldHRpbmdzIHRhYlxyXG4gICAgdGhpcy5hZGRTZXR0aW5nVGFiKG5ldyBTbWFydENvbm5lY3Rpb25zU2V0dGluZ3NUYWIodGhpcy5hcHAsIHRoaXMpKTtcclxuICAgIC8vIHJlZ2lzdGVyIG1haW4gdmlldyB0eXBlXHJcbiAgICB0aGlzLnJlZ2lzdGVyVmlldyhTTUFSVF9DT05ORUNUSU9OU19WSUVXX1RZUEUsIChsZWFmKSA9PiAobmV3IFNtYXJ0Q29ubmVjdGlvbnNWaWV3KGxlYWYsIHRoaXMpKSk7XHJcbiAgICAvLyByZWdpc3RlciBjaGF0IHZpZXcgdHlwZVxyXG4gICAgdGhpcy5yZWdpc3RlclZpZXcoU01BUlRfQ09OTkVDVElPTlNfQ0hBVF9WSUVXX1RZUEUsIChsZWFmKSA9PiAobmV3IFNtYXJ0Q29ubmVjdGlvbnNDaGF0VmlldyhsZWFmLCB0aGlzKSkpO1xyXG4gICAgLy8gY29kZS1ibG9jayByZW5kZXJlclxyXG4gICAgdGhpcy5yZWdpc3Rlck1hcmtkb3duQ29kZUJsb2NrUHJvY2Vzc29yKFwic21hcnQtY29ubmVjdGlvbnNcIiwgdGhpcy5yZW5kZXJfY29kZV9ibG9jay5iaW5kKHRoaXMpKTtcclxuXHJcbiAgICAvLyBpZiB0aGlzIHNldHRpbmdzLnZpZXdfb3BlbiBpcyB0cnVlLCBvcGVuIHZpZXcgb24gc3RhcnR1cFxyXG4gICAgaWYodGhpcy5zZXR0aW5ncy52aWV3X29wZW4pIHtcclxuICAgICAgdGhpcy5vcGVuX3ZpZXcoKTtcclxuICAgIH1cclxuICAgIC8vIGlmIHRoaXMgc2V0dGluZ3MuY2hhdF9vcGVuIGlzIHRydWUsIG9wZW4gY2hhdCBvbiBzdGFydHVwXHJcbiAgICBpZih0aGlzLnNldHRpbmdzLmNoYXRfb3Blbikge1xyXG4gICAgICB0aGlzLm9wZW5fY2hhdCgpO1xyXG4gICAgfVxyXG4gICAgLy8gb24gbmV3IHZlcnNpb25cclxuICAgIGlmKHRoaXMuc2V0dGluZ3MudmVyc2lvbiAhPT0gVkVSU0lPTikge1xyXG4gICAgICAvLyB1cGRhdGUgdmVyc2lvblxyXG4gICAgICB0aGlzLnNldHRpbmdzLnZlcnNpb24gPSBWRVJTSU9OO1xyXG4gICAgICAvLyBzYXZlIHNldHRpbmdzXHJcbiAgICAgIGF3YWl0IHRoaXMuc2F2ZVNldHRpbmdzKCk7XHJcbiAgICAgIC8vIG9wZW4gdmlld1xyXG4gICAgICB0aGlzLm9wZW5fdmlldygpO1xyXG4gICAgfVxyXG4gICAgLy8gY2hlY2sgZ2l0aHViIHJlbGVhc2UgZW5kcG9pbnQgaWYgdXBkYXRlIGlzIGF2YWlsYWJsZVxyXG4gICAgdGhpcy5hZGRfdG9fZ2l0aWdub3JlKCk7XHJcbiAgICAvKipcclxuICAgICAqIEVYUEVSSU1FTlRBTFxyXG4gICAgICogLSB3aW5kb3ctYmFzZWQgQVBJIGFjY2Vzc1xyXG4gICAgICogLSBjb2RlLWJsb2NrIHJlbmRlcmluZ1xyXG4gICAgICovXHJcbiAgICB0aGlzLmFwaSA9IG5ldyBTY1NlYXJjaEFwaSh0aGlzLmFwcCwgdGhpcyk7XHJcbiAgICAvLyByZWdpc3RlciBBUEkgdG8gZ2xvYmFsIHdpbmRvdyBvYmplY3RcclxuICAgICh3aW5kb3dbXCJTbWFydFNlYXJjaEFwaVwiXSA9IHRoaXMuYXBpKSAmJiB0aGlzLnJlZ2lzdGVyKCgpID0+IGRlbGV0ZSB3aW5kb3dbXCJTbWFydFNlYXJjaEFwaVwiXSk7XHJcblxyXG4gIH1cclxuXHJcbiAgYXN5bmMgaW5pdF92ZWNzKCkge1xyXG4gICAgdGhpcy5zbWFydF92ZWNfbGl0ZSA9IG5ldyBWZWNMaXRlKHtcclxuICAgICAgZm9sZGVyX3BhdGg6IFwiLnNtYXJ0LWNvbm5lY3Rpb25zXCIsXHJcbiAgICAgIGV4aXN0c19hZGFwdGVyOiB0aGlzLmFwcC52YXVsdC5hZGFwdGVyLmV4aXN0cy5iaW5kKHRoaXMuYXBwLnZhdWx0LmFkYXB0ZXIpLFxyXG4gICAgICBta2Rpcl9hZGFwdGVyOiB0aGlzLmFwcC52YXVsdC5hZGFwdGVyLm1rZGlyLmJpbmQodGhpcy5hcHAudmF1bHQuYWRhcHRlciksXHJcbiAgICAgIHJlYWRfYWRhcHRlcjogdGhpcy5hcHAudmF1bHQuYWRhcHRlci5yZWFkLmJpbmQodGhpcy5hcHAudmF1bHQuYWRhcHRlciksXHJcbiAgICAgIHJlbmFtZV9hZGFwdGVyOiB0aGlzLmFwcC52YXVsdC5hZGFwdGVyLnJlbmFtZS5iaW5kKHRoaXMuYXBwLnZhdWx0LmFkYXB0ZXIpLFxyXG4gICAgICBzdGF0X2FkYXB0ZXI6IHRoaXMuYXBwLnZhdWx0LmFkYXB0ZXIuc3RhdC5iaW5kKHRoaXMuYXBwLnZhdWx0LmFkYXB0ZXIpLFxyXG4gICAgICB3cml0ZV9hZGFwdGVyOiB0aGlzLmFwcC52YXVsdC5hZGFwdGVyLndyaXRlLmJpbmQodGhpcy5hcHAudmF1bHQuYWRhcHRlciksXHJcbiAgICB9KTtcclxuICAgIHRoaXMuZW1iZWRkaW5nc19sb2FkZWQgPSBhd2FpdCB0aGlzLnNtYXJ0X3ZlY19saXRlLmxvYWQoKTtcclxuICAgIHJldHVybiB0aGlzLmVtYmVkZGluZ3NfbG9hZGVkO1xyXG4gIH1cclxuICBhc3luYyB1cGRhdGVfdG9fdjIoKSB7XHJcbiAgICAvLyBpZiBsaWNlbnNlIGtleSBpcyBub3Qgc2V0LCByZXR1cm5cclxuICAgIGlmKCF0aGlzLnNldHRpbmdzLmxpY2Vuc2Vfa2V5KSByZXR1cm4gbmV3IE9ic2lkaWFuLk5vdGljZShcIltTbWFydCBDb25uZWN0aW9uc10gU3VwcG9ydGVyIGxpY2Vuc2Uga2V5IHJlcXVpcmVkIGZvciBlYXJseSBhY2Nlc3MgdG8gVjJcIik7XHJcbiAgICAvLyBkb3dubG9hZCBodHRwczovL2dpdGh1Yi5jb20vYnJpYW5wZXRyby9vYnNpZGlhbi1zbWFydC1jb25uZWN0aW9ucy9yZWxlYXNlcy9kb3dubG9hZC8xLjYuMzcvbWFpbi5qc1xyXG4gICAgY29uc3QgdjIgPSBhd2FpdCAoMCwgT2JzaWRpYW4ucmVxdWVzdFVybCkoe1xyXG4gICAgICB1cmw6IFwiaHR0cHM6Ly9zeW5jLnNtYXJ0Y29ubmVjdGlvbnMuYXBwL2Rvd25sb2FkX3YyXCIsXHJcbiAgICAgIG1ldGhvZDogXCJQT1NUXCIsXHJcbiAgICAgIGhlYWRlcnM6IHtcclxuICAgICAgICBcIkNvbnRlbnQtVHlwZVwiOiBcImFwcGxpY2F0aW9uL2pzb25cIixcclxuICAgICAgfSxcclxuICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoe1xyXG4gICAgICAgIGxpY2Vuc2Vfa2V5OiB0aGlzLnNldHRpbmdzLmxpY2Vuc2Vfa2V5LFxyXG4gICAgICB9KVxyXG4gICAgfSk7XHJcbiAgICBpZih2Mi5zdGF0dXMgIT09IDIwMCkgcmV0dXJuIGNvbnNvbGUuZXJyb3IoXCJFcnJvciBkb3dubG9hZGluZyB2ZXJzaW9uIDJcIiwgdjIpO1xyXG4gICAgY29uc29sZS5sb2codjIpO1xyXG4gICAgYXdhaXQgdGhpcy5hcHAudmF1bHQuYWRhcHRlci53cml0ZShcIi5vYnNpZGlhbi9wbHVnaW5zL3NtYXJ0LWNvbm5lY3Rpb25zL21haW4uanNcIiwgdjIuanNvbi5tYWluKTsgLy8gYWRkIG5ld1xyXG4gICAgYXdhaXQgdGhpcy5hcHAudmF1bHQuYWRhcHRlci53cml0ZShcIi5vYnNpZGlhbi9wbHVnaW5zL3NtYXJ0LWNvbm5lY3Rpb25zL21hbmlmZXN0Lmpzb25cIiwgdjIuanNvbi5tYW5pZmVzdCk7IC8vIGFkZCBuZXdcclxuICAgIGF3YWl0IHRoaXMuYXBwLnZhdWx0LmFkYXB0ZXIud3JpdGUoXCIub2JzaWRpYW4vcGx1Z2lucy9zbWFydC1jb25uZWN0aW9ucy9zdHlsZXMuY3NzXCIsIHYyLmpzb24uc3R5bGVzKTsgLy8gYWRkIG5ld1xyXG4gICAgd2luZG93LnJlc3RhcnRfcGx1Z2luID0gYXN5bmMgKGlkKSA9PiB7XHJcbiAgICAgIGNvbnNvbGUubG9nKFwicmVzdGFydGluZyBwbHVnaW5cIiwgaWQpO1xyXG4gICAgICBhd2FpdCB3aW5kb3cuYXBwLnBsdWdpbnMuZGlzYWJsZVBsdWdpbihpZCk7XHJcbiAgICAgIGF3YWl0IHdpbmRvdy5hcHAucGx1Z2lucy5lbmFibGVQbHVnaW4oaWQpO1xyXG4gICAgICBjb25zb2xlLmxvZyhcInBsdWdpbiByZXN0YXJ0ZWRcIiwgaWQpO1xyXG4gICAgfVxyXG4gICAgd2luZG93LnJlc3RhcnRfcGx1Z2luKHRoaXMubWFuaWZlc3QuaWQpO1xyXG4gIH1cclxuXHJcbiAgYXN5bmMgbG9hZFNldHRpbmdzKCkge1xyXG4gICAgdGhpcy5zZXR0aW5ncyA9IE9iamVjdC5hc3NpZ24oe30sIERFRkFVTFRfU0VUVElOR1MsIGF3YWl0IHRoaXMubG9hZERhdGEoKSk7XHJcbiAgICAvLyBsb2FkIGZpbGUgZXhjbHVzaW9ucyBpZiBub3QgYmxhbmtcclxuICAgIGlmKHRoaXMuc2V0dGluZ3MuZmlsZV9leGNsdXNpb25zICYmIHRoaXMuc2V0dGluZ3MuZmlsZV9leGNsdXNpb25zLmxlbmd0aCA+IDApIHtcclxuICAgICAgLy8gc3BsaXQgZmlsZSBleGNsdXNpb25zIGludG8gYXJyYXkgYW5kIHRyaW0gd2hpdGVzcGFjZVxyXG4gICAgICB0aGlzLmZpbGVfZXhjbHVzaW9ucyA9IHRoaXMuc2V0dGluZ3MuZmlsZV9leGNsdXNpb25zLnNwbGl0KC9bLFxcblxcc10vKVxyXG4gICAgICAgIC5maWx0ZXIoKGZpbGUpID0+IGZpbGUubGVuZ3RoID4gMClcclxuICAgICAgICAubWFwKChmaWxlKSA9PiB7XHJcbiAgICAgICAgcmV0dXJuIGZpbGUudHJpbSgpO1xyXG4gICAgICB9KTtcclxuICAgIH1cclxuICAgIC8vIGxvYWQgZm9sZGVyIGV4Y2x1c2lvbnMgaWYgbm90IGJsYW5rXHJcbiAgICBpZih0aGlzLnNldHRpbmdzLmZvbGRlcl9leGNsdXNpb25zICYmIHRoaXMuc2V0dGluZ3MuZm9sZGVyX2V4Y2x1c2lvbnMubGVuZ3RoID4gMCkge1xyXG4gICAgICAvLyBhZGQgc2xhc2ggdG8gZW5kIG9mIGZvbGRlciBuYW1lIGlmIG5vdCBwcmVzZW50XHJcbiAgICAgIGNvbnN0IGZvbGRlcl9leGNsdXNpb25zID0gdGhpcy5zZXR0aW5ncy5mb2xkZXJfZXhjbHVzaW9uc1xyXG4gICAgICAgIC5zcGxpdCgvWyxcXG5cXHNdLylcclxuICAgICAgICAuZmlsdGVyKChmaWxlKSA9PiBmaWxlLmxlbmd0aCA+IDApXHJcbiAgICAgICAgLm1hcCgoZm9sZGVyKSA9PiB7XHJcbiAgICAgICAgICBmb2xkZXIgPSBmb2xkZXIudHJpbSgpO1xyXG4gICAgICAgICAgcmV0dXJuIGZvbGRlci5zbGljZSgtMSkgPT09IFwiL1wiID8gZm9sZGVyIDogYCR7Zm9sZGVyfS9gO1xyXG4gICAgICAgIH0pO1xyXG4gICAgICAvLyBtZXJnZSBmb2xkZXIgZXhjbHVzaW9ucyB3aXRoIGZpbGUgZXhjbHVzaW9uc1xyXG4gICAgICB0aGlzLmZpbGVfZXhjbHVzaW9ucyA9IHRoaXMuZmlsZV9leGNsdXNpb25zLmNvbmNhdChmb2xkZXJfZXhjbHVzaW9ucyk7XHJcbiAgICB9XHJcbiAgICAvLyBsb2FkIGhlYWRlciBleGNsdXNpb25zIGlmIG5vdCBibGFua1xyXG4gICAgaWYodGhpcy5zZXR0aW5ncy5oZWFkZXJfZXhjbHVzaW9ucyAmJiB0aGlzLnNldHRpbmdzLmhlYWRlcl9leGNsdXNpb25zLmxlbmd0aCA+IDApIHtcclxuICAgICAgdGhpcy5oZWFkZXJfZXhjbHVzaW9ucyA9IHRoaXMuc2V0dGluZ3MuaGVhZGVyX2V4Y2x1c2lvbnNcclxuICAgICAgICAuc3BsaXQoL1tcXHNcXG4sXS8pXHJcbiAgICAgICAgLmZpbHRlcigoZmlsZSkgPT4gZmlsZS5sZW5ndGggPiAwKVxyXG4gICAgICAgIC5tYXAoKGhlYWRlcikgPT4ge1xyXG4gICAgICAgICAgcmV0dXJuIGhlYWRlci50cmltKCk7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcbiAgICAvLyBsb2FkIHBhdGhfb25seSBpZiBub3QgYmxhbmtcclxuICAgIGlmKHRoaXMuc2V0dGluZ3MucGF0aF9vbmx5ICYmIHRoaXMuc2V0dGluZ3MucGF0aF9vbmx5Lmxlbmd0aCA+IDApIHtcclxuICAgICAgdGhpcy5wYXRoX29ubHkgPSB0aGlzLnNldHRpbmdzLnBhdGhfb25seVxyXG4gICAgICAgIC5zcGxpdCgvW1xcc1xcbixdLylcclxuICAgICAgICAuZmlsdGVyKChmaWxlKSA9PiBmaWxlLmxlbmd0aCA+IDApXHJcbiAgICAgICAgLm1hcCgocGF0aCkgPT4ge1xyXG4gICAgICAgICAgcmV0dXJuIHBhdGgudHJpbSgpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG4gICAgLy8gbG9hZCBzZWxmX3JlZl9rd19yZWdleFxyXG4gICAgdGhpcy5zZWxmX3JlZl9rd19yZWdleCA9IG5ldyBSZWdFeHAoYFxcXFxiKCR7U01BUlRfVFJBTlNMQVRJT05bdGhpcy5zZXR0aW5ncy5sYW5ndWFnZV0ucHJvbm91cy5qb2luKFwifFwiKX0pXFxcXGJgLCBcImdpXCIpO1xyXG4gICAgLy8gbG9hZCBmYWlsZWQgZmlsZXNcclxuICAgIGF3YWl0IHRoaXMubG9hZF9mYWlsZWRfZmlsZXMoKTtcclxuICB9XHJcbiAgYXN5bmMgc2F2ZVNldHRpbmdzKHJlcmVuZGVyPWZhbHNlKSB7XHJcbiAgICBhd2FpdCB0aGlzLnNhdmVEYXRhKHRoaXMuc2V0dGluZ3MpO1xyXG4gICAgLy8gcmUtbG9hZCBzZXR0aW5ncyBpbnRvIG1lbW9yeVxyXG4gICAgYXdhaXQgdGhpcy5sb2FkU2V0dGluZ3MoKTtcclxuICAgIC8vIHJlLXJlbmRlciB2aWV3IGlmIHNldCB0byB0cnVlIChmb3IgZXhhbXBsZSwgYWZ0ZXIgYWRkaW5nIEFQSSBrZXkpXHJcbiAgICBpZihyZXJlbmRlcikge1xyXG4gICAgICB0aGlzLm5lYXJlc3RfY2FjaGUgPSB7fTtcclxuICAgICAgYXdhaXQgdGhpcy5tYWtlX2Nvbm5lY3Rpb25zKCk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvLyBjaGVjayBmb3IgdXBkYXRlXHJcbiAgYXN5bmMgY2hlY2tfZm9yX3VwZGF0ZSgpIHtcclxuICAgIC8vIGZhaWwgc2lsZW50bHksIGV4LiBpZiBubyBpbnRlcm5ldCBjb25uZWN0aW9uXHJcbiAgICB0cnkge1xyXG4gICAgICAvLyBnZXQgbGF0ZXN0IHJlbGVhc2UgdmVyc2lvbiBmcm9tIGdpdGh1YlxyXG4gICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0ICgwLCBPYnNpZGlhbi5yZXF1ZXN0VXJsKSh7XHJcbiAgICAgICAgdXJsOiBcImh0dHBzOi8vYXBpLmdpdGh1Yi5jb20vcmVwb3MvYnJpYW5wZXRyby9vYnNpZGlhbi1zbWFydC1jb25uZWN0aW9ucy9yZWxlYXNlcy9sYXRlc3RcIixcclxuICAgICAgICBtZXRob2Q6IFwiR0VUXCIsXHJcbiAgICAgICAgaGVhZGVyczoge1xyXG4gICAgICAgICAgXCJDb250ZW50LVR5cGVcIjogXCJhcHBsaWNhdGlvbi9qc29uXCIsXHJcbiAgICAgICAgfSxcclxuICAgICAgICBjb250ZW50VHlwZTogXCJhcHBsaWNhdGlvbi9qc29uXCIsXHJcbiAgICAgIH0pO1xyXG4gICAgICAvLyBnZXQgdmVyc2lvbiBudW1iZXIgZnJvbSByZXNwb25zZVxyXG4gICAgICBjb25zdCBsYXRlc3RfcmVsZWFzZSA9IEpTT04ucGFyc2UocmVzcG9uc2UudGV4dCkudGFnX25hbWU7XHJcbiAgICAgIC8vIGNvbnNvbGUubG9nKGBMYXRlc3QgcmVsZWFzZTogJHtsYXRlc3RfcmVsZWFzZX1gKTtcclxuICAgICAgLy8gaWYgbGF0ZXN0X3JlbGVhc2UgaXMgbmV3ZXIgdGhhbiBjdXJyZW50IHZlcnNpb24sIHNob3cgbWVzc2FnZVxyXG4gICAgICBpZihsYXRlc3RfcmVsZWFzZSAhPT0gVkVSU0lPTikge1xyXG4gICAgICAgIG5ldyBPYnNpZGlhbi5Ob3RpY2UoYFtTbWFydCBDb25uZWN0aW9uc10gQSBuZXcgdmVyc2lvbiBpcyBhdmFpbGFibGUhICh2JHtsYXRlc3RfcmVsZWFzZX0pYCk7XHJcbiAgICAgICAgdGhpcy51cGRhdGVfYXZhaWxhYmxlID0gdHJ1ZTtcclxuICAgICAgICB0aGlzLnJlbmRlcl9icmFuZChcImFsbFwiKVxyXG4gICAgICB9XHJcbiAgICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgICBjb25zb2xlLmxvZyhlcnJvcik7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBhc3luYyByZW5kZXJfY29kZV9ibG9jayhjb250ZW50cywgY29udGFpbmVyLCBjdHgpIHtcclxuICAgIGxldCBuZWFyZXN0O1xyXG4gICAgaWYoY29udGVudHMudHJpbSgpLmxlbmd0aCA+IDApIHtcclxuICAgICAgbmVhcmVzdCA9IGF3YWl0IHRoaXMuYXBpLnNlYXJjaChjb250ZW50cyk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAvLyB1c2UgY3R4IHRvIGdldCBmaWxlXHJcbiAgICAgIGNvbnNvbGUubG9nKGN0eCk7XHJcbiAgICAgIGNvbnN0IGZpbGUgPSB0aGlzLmFwcC52YXVsdC5nZXRBYnN0cmFjdEZpbGVCeVBhdGgoY3R4LnNvdXJjZVBhdGgpO1xyXG4gICAgICBuZWFyZXN0ID0gYXdhaXQgdGhpcy5maW5kX25vdGVfY29ubmVjdGlvbnMoZmlsZSk7XHJcbiAgICB9XHJcbiAgICBpZiAobmVhcmVzdC5sZW5ndGgpIHtcclxuICAgICAgdGhpcy51cGRhdGVfcmVzdWx0cyhjb250YWluZXIsIG5lYXJlc3QpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgYXN5bmMgbWFrZV9jb25uZWN0aW9ucyhzZWxlY3RlZF90ZXh0PW51bGwpIHtcclxuICAgIGxldCB2aWV3ID0gdGhpcy5nZXRfdmlldygpO1xyXG4gICAgaWYgKCF2aWV3KSB7XHJcbiAgICAgIC8vIG9wZW4gdmlldyBpZiBub3Qgb3BlblxyXG4gICAgICBhd2FpdCB0aGlzLm9wZW5fdmlldygpO1xyXG4gICAgICB2aWV3ID0gdGhpcy5nZXRfdmlldygpO1xyXG4gICAgfVxyXG4gICAgYXdhaXQgdmlldy5yZW5kZXJfY29ubmVjdGlvbnMoc2VsZWN0ZWRfdGV4dCk7XHJcbiAgfVxyXG5cclxuICBhZGRJY29uKCl7XHJcbiAgICBPYnNpZGlhbi5hZGRJY29uKFwic21hcnQtY29ubmVjdGlvbnNcIiwgYDxwYXRoIGQ9XCJNNTAsMjAgTDgwLDQwIEw4MCw2MCBMNTAsMTAwXCIgc3Ryb2tlPVwiY3VycmVudENvbG9yXCIgc3Ryb2tlLXdpZHRoPVwiNFwiIGZpbGw9XCJub25lXCIvPlxyXG4gICAgPHBhdGggZD1cIk0zMCw1MCBMNTUsNzBcIiBzdHJva2U9XCJjdXJyZW50Q29sb3JcIiBzdHJva2Utd2lkdGg9XCI1XCIgZmlsbD1cIm5vbmVcIi8+XHJcbiAgICA8Y2lyY2xlIGN4PVwiNTBcIiBjeT1cIjIwXCIgcj1cIjlcIiBmaWxsPVwiY3VycmVudENvbG9yXCIvPlxyXG4gICAgPGNpcmNsZSBjeD1cIjgwXCIgY3k9XCI0MFwiIHI9XCI5XCIgZmlsbD1cImN1cnJlbnRDb2xvclwiLz5cclxuICAgIDxjaXJjbGUgY3g9XCI4MFwiIGN5PVwiNzBcIiByPVwiOVwiIGZpbGw9XCJjdXJyZW50Q29sb3JcIi8+XHJcbiAgICA8Y2lyY2xlIGN4PVwiNTBcIiBjeT1cIjEwMFwiIHI9XCI5XCIgZmlsbD1cImN1cnJlbnRDb2xvclwiLz5cclxuICAgIDxjaXJjbGUgY3g9XCIzMFwiIGN5PVwiNTBcIiByPVwiOVwiIGZpbGw9XCJjdXJyZW50Q29sb3JcIi8+YCk7XHJcbiAgfVxyXG5cclxuICAvLyBvcGVuIHJhbmRvbSBub3RlXHJcbiAgYXN5bmMgb3Blbl9yYW5kb21fbm90ZSgpIHtcclxuICAgIGNvbnN0IGN1cnJfZmlsZSA9IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRBY3RpdmVGaWxlKCk7XHJcbiAgICBjb25zdCBjdXJyX2tleSA9IG1kNShjdXJyX2ZpbGUucGF0aCk7XHJcbiAgICAvLyBpZiBubyBuZWFyZXN0IGNhY2hlLCBjcmVhdGUgT2JzaWRpYW4gbm90aWNlXHJcbiAgICBpZih0eXBlb2YgdGhpcy5uZWFyZXN0X2NhY2hlW2N1cnJfa2V5XSA9PT0gXCJ1bmRlZmluZWRcIikge1xyXG4gICAgICBuZXcgT2JzaWRpYW4uTm90aWNlKFwiW1NtYXJ0IENvbm5lY3Rpb25zXSBObyBTbWFydCBDb25uZWN0aW9ucyBmb3VuZC4gT3BlbiBhIG5vdGUgdG8gZ2V0IFNtYXJ0IENvbm5lY3Rpb25zLlwiKTtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG4gICAgLy8gZ2V0IHJhbmRvbSBmcm9tIG5lYXJlc3QgY2FjaGVcclxuICAgIGNvbnN0IHJhbmQgPSBNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiB0aGlzLm5lYXJlc3RfY2FjaGVbY3Vycl9rZXldLmxlbmd0aC8yKTsgLy8gZGl2aWRlIGJ5IDIgdG8gbGltaXQgdG8gdG9wIGhhbGYgb2YgcmVzdWx0c1xyXG4gICAgY29uc3QgcmFuZG9tX2ZpbGUgPSB0aGlzLm5lYXJlc3RfY2FjaGVbY3Vycl9rZXldW3JhbmRdO1xyXG4gICAgLy8gb3BlbiByYW5kb20gZmlsZVxyXG4gICAgdGhpcy5vcGVuX25vdGUocmFuZG9tX2ZpbGUpO1xyXG4gIH1cclxuXHJcbiAgYXN5bmMgb3Blbl92aWV3KCkge1xyXG4gICAgaWYodGhpcy5nZXRfdmlldygpKXtcclxuICAgICAgY29uc29sZS5sb2coXCJTbWFydCBDb25uZWN0aW9ucyB2aWV3IGFscmVhZHkgb3BlblwiKTtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG4gICAgdGhpcy5hcHAud29ya3NwYWNlLmRldGFjaExlYXZlc09mVHlwZShTTUFSVF9DT05ORUNUSU9OU19WSUVXX1RZUEUpO1xyXG4gICAgYXdhaXQgdGhpcy5hcHAud29ya3NwYWNlLmdldFJpZ2h0TGVhZihmYWxzZSkuc2V0Vmlld1N0YXRlKHtcclxuICAgICAgdHlwZTogU01BUlRfQ09OTkVDVElPTlNfVklFV19UWVBFLFxyXG4gICAgICBhY3RpdmU6IHRydWUsXHJcbiAgICB9KTtcclxuICAgIHRoaXMuYXBwLndvcmtzcGFjZS5yZXZlYWxMZWFmKFxyXG4gICAgICB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0TGVhdmVzT2ZUeXBlKFNNQVJUX0NPTk5FQ1RJT05TX1ZJRVdfVFlQRSlbMF1cclxuICAgICk7XHJcbiAgfVxyXG4gIC8vIHNvdXJjZTogaHR0cHM6Ly9naXRodWIuY29tL29ic2lkaWFubWQvb2JzaWRpYW4tcmVsZWFzZXMvYmxvYi9tYXN0ZXIvcGx1Z2luLXJldmlldy5tZCNhdm9pZC1tYW5hZ2luZy1yZWZlcmVuY2VzLXRvLWN1c3RvbS12aWV3c1xyXG4gIGdldF92aWV3KCkge1xyXG4gICAgZm9yIChsZXQgbGVhZiBvZiB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0TGVhdmVzT2ZUeXBlKFNNQVJUX0NPTk5FQ1RJT05TX1ZJRVdfVFlQRSkpIHtcclxuICAgICAgaWYgKGxlYWYudmlldyBpbnN0YW5jZW9mIFNtYXJ0Q29ubmVjdGlvbnNWaWV3KSB7XHJcbiAgICAgICAgcmV0dXJuIGxlYWYudmlldztcclxuICAgICAgfVxyXG4gICAgfVxyXG4gIH1cclxuICAvLyBvcGVuIGNoYXQgdmlld1xyXG4gIGFzeW5jIG9wZW5fY2hhdChyZXRyaWVzPTApIHtcclxuICAgIGlmKCF0aGlzLmVtYmVkZGluZ3NfbG9hZGVkKSB7XHJcbiAgICAgIGNvbnNvbGUubG9nKFwiZW1iZWRkaW5ncyBub3QgbG9hZGVkIHlldFwiKTtcclxuICAgICAgaWYocmV0cmllcyA8IDMpIHtcclxuICAgICAgICAvLyB3YWl0IGFuZCB0cnkgYWdhaW5cclxuICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHtcclxuICAgICAgICAgIHRoaXMub3Blbl9jaGF0KHJldHJpZXMrMSk7XHJcbiAgICAgICAgfSwgMTAwMCAqIChyZXRyaWVzKzEpKTtcclxuICAgICAgICByZXR1cm47XHJcbiAgICAgIH1cclxuICAgICAgY29uc29sZS5sb2coXCJlbWJlZGRpbmdzIHN0aWxsIG5vdCBsb2FkZWQsIG9wZW5pbmcgc21hcnQgdmlld1wiKTtcclxuICAgICAgdGhpcy5vcGVuX3ZpZXcoKTtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG4gICAgdGhpcy5hcHAud29ya3NwYWNlLmRldGFjaExlYXZlc09mVHlwZShTTUFSVF9DT05ORUNUSU9OU19DSEFUX1ZJRVdfVFlQRSk7XHJcbiAgICBpZiAoIXRoaXMuc2V0dGluZ3Mub3Blbl9pbl9iaWdfdmlldykge1xyXG4gICAgICBhd2FpdCB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0UmlnaHRMZWFmKGZhbHNlKS5zZXRWaWV3U3RhdGUoe1xyXG4gICAgICAgIHR5cGU6IFNNQVJUX0NPTk5FQ1RJT05TX0NIQVRfVklFV19UWVBFLFxyXG4gICAgICAgIGFjdGl2ZTogdHJ1ZSxcclxuICAgICAgfSk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICBhd2FpdCB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0TGVhZih0cnVlKS5zZXRWaWV3U3RhdGUoe1xyXG4gICAgICAgIHR5cGU6IFNNQVJUX0NPTk5FQ1RJT05TX0NIQVRfVklFV19UWVBFLFxyXG4gICAgICAgIGFjdGl2ZTogdHJ1ZSxcclxuICAgICAgfSlcclxuICAgIH1cclxuICAgIHRoaXMuYXBwLndvcmtzcGFjZS5yZXZlYWxMZWFmKFxyXG4gICAgICB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0TGVhdmVzT2ZUeXBlKFNNQVJUX0NPTk5FQ1RJT05TX0NIQVRfVklFV19UWVBFKVswXVxyXG4gICAgKTtcclxuICB9XHJcblxyXG4gIC8vIGdldCBlbWJlZGRpbmdzIGZvciBhbGwgZmlsZXNcclxuICBhc3luYyBnZXRfYWxsX2VtYmVkZGluZ3MoKSB7XHJcbiAgICAvLyBnZXQgYWxsIGZpbGVzIGluIHZhdWx0IGFuZCBmaWx0ZXIgYWxsIGJ1dCBtYXJrZG93biBhbmQgY2FudmFzIGZpbGVzXHJcbiAgICBjb25zdCBmaWxlcyA9IChhd2FpdCB0aGlzLmFwcC52YXVsdC5nZXRGaWxlcygpKS5maWx0ZXIoKGZpbGUpID0+IGZpbGUgaW5zdGFuY2VvZiBPYnNpZGlhbi5URmlsZSAmJiAoZmlsZS5leHRlbnNpb24gPT09IFwibWRcIiB8fCBmaWxlLmV4dGVuc2lvbiA9PT0gXCJjYW52YXNcIikpO1xyXG4gICAgLy8gY29uc3QgZmlsZXMgPSBhd2FpdCB0aGlzLmFwcC52YXVsdC5nZXRNYXJrZG93bkZpbGVzKCk7XHJcbiAgICAvLyBnZXQgb3BlbiBmaWxlcyB0byBza2lwIGlmIGZpbGUgaXMgY3VycmVudGx5IG9wZW5cclxuICAgIGNvbnN0IG9wZW5fZmlsZXMgPSB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0TGVhdmVzT2ZUeXBlKFwibWFya2Rvd25cIikubWFwKChsZWFmKSA9PiBsZWFmLnZpZXcuZmlsZSk7XHJcbiAgICBjb25zdCBjbGVhbl91cF9sb2cgPSB0aGlzLnNtYXJ0X3ZlY19saXRlLmNsZWFuX3VwX2VtYmVkZGluZ3MoZmlsZXMpO1xyXG4gICAgaWYodGhpcy5zZXR0aW5ncy5sb2dfcmVuZGVyKXtcclxuICAgICAgdGhpcy5yZW5kZXJfbG9nLnRvdGFsX2ZpbGVzID0gZmlsZXMubGVuZ3RoO1xyXG4gICAgICB0aGlzLnJlbmRlcl9sb2cuZGVsZXRlZF9lbWJlZGRpbmdzID0gY2xlYW5fdXBfbG9nLmRlbGV0ZWRfZW1iZWRkaW5ncztcclxuICAgICAgdGhpcy5yZW5kZXJfbG9nLnRvdGFsX2VtYmVkZGluZ3MgPSBjbGVhbl91cF9sb2cudG90YWxfZW1iZWRkaW5ncztcclxuICAgIH1cclxuICAgIC8vIGJhdGNoIGVtYmVkZGluZ3NcclxuICAgIGxldCBiYXRjaF9wcm9taXNlcyA9IFtdO1xyXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBmaWxlcy5sZW5ndGg7IGkrKykge1xyXG4gICAgICAvLyBza2lwIGlmIHBhdGggY29udGFpbnMgYSAjXHJcbiAgICAgIGlmKGZpbGVzW2ldLnBhdGguaW5kZXhPZihcIiNcIikgPiAtMSkge1xyXG4gICAgICAgIC8vIGNvbnNvbGUubG9nKFwic2tpcHBpbmcgZmlsZSAnXCIrZmlsZXNbaV0ucGF0aCtcIicgKHBhdGggY29udGFpbnMgIylcIik7XHJcbiAgICAgICAgdGhpcy5sb2dfZXhjbHVzaW9uKFwicGF0aCBjb250YWlucyAjXCIpO1xyXG4gICAgICAgIGNvbnRpbnVlO1xyXG4gICAgICB9XHJcbiAgICAgIC8vIHNraXAgaWYgZmlsZSBhbHJlYWR5IGhhcyBlbWJlZGRpbmcgYW5kIGVtYmVkZGluZy5tdGltZSBpcyBncmVhdGVyIHRoYW4gb3IgZXF1YWwgdG8gZmlsZS5tdGltZVxyXG4gICAgICBpZih0aGlzLnNtYXJ0X3ZlY19saXRlLm10aW1lX2lzX2N1cnJlbnQobWQ1KGZpbGVzW2ldLnBhdGgpLCBmaWxlc1tpXS5zdGF0Lm10aW1lKSkge1xyXG4gICAgICAgIC8vIGxvZyBza2lwcGluZyBmaWxlXHJcbiAgICAgICAgLy8gY29uc29sZS5sb2coXCJza2lwcGluZyBmaWxlIChtdGltZSlcIik7XHJcbiAgICAgICAgY29udGludWU7XHJcbiAgICAgIH1cclxuICAgICAgLy8gY2hlY2sgaWYgZmlsZSBpcyBpbiBmYWlsZWRfZmlsZXNcclxuICAgICAgaWYodGhpcy5zZXR0aW5ncy5mYWlsZWRfZmlsZXMuaW5kZXhPZihmaWxlc1tpXS5wYXRoKSA+IC0xKSB7XHJcbiAgICAgICAgLy8gbG9nIHNraXBwaW5nIGZpbGVcclxuICAgICAgICAvLyBjb25zb2xlLmxvZyhcInNraXBwaW5nIHByZXZpb3VzbHkgZmFpbGVkIGZpbGUsIHVzZSBidXR0b24gaW4gc2V0dGluZ3MgdG8gcmV0cnlcIik7XHJcbiAgICAgICAgLy8gdXNlIHNldFRpbWVvdXQgdG8gcHJldmVudCBtdWx0aXBsZSBub3RpY2VzXHJcbiAgICAgICAgaWYodGhpcy5yZXRyeV9ub3RpY2VfdGltZW91dCkge1xyXG4gICAgICAgICAgY2xlYXJUaW1lb3V0KHRoaXMucmV0cnlfbm90aWNlX3RpbWVvdXQpO1xyXG4gICAgICAgICAgdGhpcy5yZXRyeV9ub3RpY2VfdGltZW91dCA9IG51bGw7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIC8vIGxpbWl0IHRvIG9uZSBub3RpY2UgZXZlcnkgMTAgbWludXRlc1xyXG4gICAgICAgIGlmKCF0aGlzLnJlY2VudGx5X3NlbnRfcmV0cnlfbm90aWNlKXtcclxuICAgICAgICAgIG5ldyBPYnNpZGlhbi5Ob3RpY2UoXCJTbWFydCBDb25uZWN0aW9uczogU2tpcHBpbmcgcHJldmlvdXNseSBmYWlsZWQgZmlsZSwgdXNlIGJ1dHRvbiBpbiBzZXR0aW5ncyB0byByZXRyeVwiKTtcclxuICAgICAgICAgIHRoaXMucmVjZW50bHlfc2VudF9yZXRyeV9ub3RpY2UgPSB0cnVlO1xyXG4gICAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7XHJcbiAgICAgICAgICAgIHRoaXMucmVjZW50bHlfc2VudF9yZXRyeV9ub3RpY2UgPSBmYWxzZTtcclxuICAgICAgICAgIH0sIDYwMDAwMCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGNvbnRpbnVlO1xyXG4gICAgICB9XHJcbiAgICAgIC8vIHNraXAgZmlsZXMgd2hlcmUgcGF0aCBjb250YWlucyBhbnkgZXhjbHVzaW9uc1xyXG4gICAgICBsZXQgc2tpcCA9IGZhbHNlO1xyXG4gICAgICBmb3IgKGNvbnN0IGZpbGVFeGNsdXNpb24gb2YgdGhpcy5maWxlX2V4Y2x1c2lvbnMpIHtcclxuICAgICAgICBpZihmaWxlc1tpXS5wYXRoLmluY2x1ZGVzKGZpbGVFeGNsdXNpb24pKSB7XHJcbiAgICAgICAgICBza2lwID0gdHJ1ZTtcclxuICAgICAgICAgIHRoaXMubG9nX2V4Y2x1c2lvbihmaWxlRXhjbHVzaW9uKTtcclxuICAgICAgICAgIC8vIGJyZWFrIG91dCBvZiBsb29wXHJcbiAgICAgICAgICBicmVhaztcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgICAgaWYoc2tpcCkge1xyXG4gICAgICAgIGNvbnRpbnVlOyAvLyB0byBuZXh0IGZpbGVcclxuICAgICAgfVxyXG4gICAgICAvLyBjaGVjayBpZiBmaWxlIGlzIG9wZW5cclxuICAgICAgaWYob3Blbl9maWxlcy5pbmRleE9mKGZpbGVzW2ldKSA+IC0xKSB7XHJcbiAgICAgICAgLy8gY29uc29sZS5sb2coXCJza2lwcGluZyBmaWxlIChvcGVuKVwiKTtcclxuICAgICAgICBjb250aW51ZTtcclxuICAgICAgfVxyXG4gICAgICB0cnkge1xyXG4gICAgICAgIC8vIHB1c2ggcHJvbWlzZSB0byBiYXRjaF9wcm9taXNlc1xyXG4gICAgICAgIGJhdGNoX3Byb21pc2VzLnB1c2godGhpcy5nZXRfZmlsZV9lbWJlZGRpbmdzKGZpbGVzW2ldLCBmYWxzZSkpO1xyXG4gICAgICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgICAgIGNvbnNvbGUubG9nKGVycm9yKTtcclxuICAgICAgfVxyXG4gICAgICAvLyBpZiBiYXRjaF9wcm9taXNlcyBsZW5ndGggaXMgMTBcclxuICAgICAgaWYoYmF0Y2hfcHJvbWlzZXMubGVuZ3RoID4gMykge1xyXG4gICAgICAgIC8vIHdhaXQgZm9yIGFsbCBwcm9taXNlcyB0byByZXNvbHZlXHJcbiAgICAgICAgYXdhaXQgUHJvbWlzZS5hbGwoYmF0Y2hfcHJvbWlzZXMpO1xyXG4gICAgICAgIC8vIGNsZWFyIGJhdGNoX3Byb21pc2VzXHJcbiAgICAgICAgYmF0Y2hfcHJvbWlzZXMgPSBbXTtcclxuICAgICAgfVxyXG5cclxuICAgICAgLy8gc2F2ZSBlbWJlZGRpbmdzIEpTT04gdG8gZmlsZSBldmVyeSAxMDAgZmlsZXMgdG8gc2F2ZSBwcm9ncmVzcyBvbiBidWxrIGVtYmVkZGluZ1xyXG4gICAgICBpZihpID4gMCAmJiBpICUgMTAwID09PSAwKSB7XHJcbiAgICAgICAgYXdhaXQgdGhpcy5zYXZlX2VtYmVkZGluZ3NfdG9fZmlsZSgpO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgICAvLyB3YWl0IGZvciBhbGwgcHJvbWlzZXMgdG8gcmVzb2x2ZVxyXG4gICAgYXdhaXQgUHJvbWlzZS5hbGwoYmF0Y2hfcHJvbWlzZXMpO1xyXG4gICAgLy8gd3JpdGUgZW1iZWRkaW5ncyBKU09OIHRvIGZpbGVcclxuICAgIGF3YWl0IHRoaXMuc2F2ZV9lbWJlZGRpbmdzX3RvX2ZpbGUoKTtcclxuICAgIC8vIGlmIHJlbmRlcl9sb2cuZmFpbGVkX2VtYmVkZGluZ3MgdGhlbiB1cGRhdGUgZmFpbGVkX2VtYmVkZGluZ3MudHh0XHJcbiAgICBpZih0aGlzLnJlbmRlcl9sb2cuZmFpbGVkX2VtYmVkZGluZ3MubGVuZ3RoID4gMCkge1xyXG4gICAgICBhd2FpdCB0aGlzLnNhdmVfZmFpbGVkX2VtYmVkZGluZ3MoKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIGFzeW5jIHNhdmVfZW1iZWRkaW5nc190b19maWxlKGZvcmNlPWZhbHNlKSB7XHJcbiAgICBpZighdGhpcy5oYXNfbmV3X2VtYmVkZGluZ3Mpe1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcbiAgICAvLyBjb25zb2xlLmxvZyhcIm5ldyBlbWJlZGRpbmdzLCBzYXZpbmcgdG8gZmlsZVwiKTtcclxuICAgIGlmKCFmb3JjZSkge1xyXG4gICAgICAvLyBwcmV2ZW50IGV4Y2Vzc2l2ZSB3cml0ZXMgdG8gZW1iZWRkaW5ncyBmaWxlIGJ5IHdhaXRpbmcgMSBtaW51dGUgYmVmb3JlIHdyaXRpbmdcclxuICAgICAgaWYodGhpcy5zYXZlX3RpbWVvdXQpIHtcclxuICAgICAgICBjbGVhclRpbWVvdXQodGhpcy5zYXZlX3RpbWVvdXQpO1xyXG4gICAgICAgIHRoaXMuc2F2ZV90aW1lb3V0ID0gbnVsbDtcclxuICAgICAgfVxyXG4gICAgICB0aGlzLnNhdmVfdGltZW91dCA9IHNldFRpbWVvdXQoKCkgPT4ge1xyXG4gICAgICAgIC8vIGNvbnNvbGUubG9nKFwid3JpdGluZyBlbWJlZGRpbmdzIHRvIGZpbGVcIik7XHJcbiAgICAgICAgdGhpcy5zYXZlX2VtYmVkZGluZ3NfdG9fZmlsZSh0cnVlKTtcclxuICAgICAgICAvLyBjbGVhciB0aW1lb3V0XHJcbiAgICAgICAgaWYodGhpcy5zYXZlX3RpbWVvdXQpIHtcclxuICAgICAgICAgIGNsZWFyVGltZW91dCh0aGlzLnNhdmVfdGltZW91dCk7XHJcbiAgICAgICAgICB0aGlzLnNhdmVfdGltZW91dCA9IG51bGw7XHJcbiAgICAgICAgfVxyXG4gICAgICB9LCAzMDAwMCk7XHJcbiAgICAgIGNvbnNvbGUubG9nKFwic2NoZWR1bGVkIHNhdmVcIik7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuXHJcbiAgICB0cnl7XHJcbiAgICAgIC8vIHVzZSBzbWFydF92ZWNfbGl0ZVxyXG4gICAgICBhd2FpdCB0aGlzLnNtYXJ0X3ZlY19saXRlLnNhdmUoKTtcclxuICAgICAgdGhpcy5oYXNfbmV3X2VtYmVkZGluZ3MgPSBmYWxzZTtcclxuICAgIH1jYXRjaChlcnJvcil7XHJcbiAgICAgIGNvbnNvbGUubG9nKGVycm9yKTtcclxuICAgICAgbmV3IE9ic2lkaWFuLk5vdGljZShcIlNtYXJ0IENvbm5lY3Rpb25zOiBcIitlcnJvci5tZXNzYWdlKTtcclxuICAgIH1cclxuXHJcbiAgfVxyXG4gIC8vIHNhdmUgZmFpbGVkIGVtYmVkZGluZ3MgdG8gZmlsZSBmcm9tIHJlbmRlcl9sb2cuZmFpbGVkX2VtYmVkZGluZ3NcclxuICBhc3luYyBzYXZlX2ZhaWxlZF9lbWJlZGRpbmdzICgpIHtcclxuICAgIC8vIHdyaXRlIGZhaWxlZF9lbWJlZGRpbmdzIHRvIGZpbGUgb25lIGxpbmUgcGVyIGZhaWxlZCBlbWJlZGRpbmdcclxuICAgIGxldCBmYWlsZWRfZW1iZWRkaW5ncyA9IFtdO1xyXG4gICAgLy8gaWYgZmlsZSBhbHJlYWR5IGV4aXN0cyB0aGVuIHJlYWQgaXRcclxuICAgIGNvbnN0IGZhaWxlZF9lbWJlZGRpbmdzX2ZpbGVfZXhpc3RzID0gYXdhaXQgdGhpcy5hcHAudmF1bHQuYWRhcHRlci5leGlzdHMoXCIuc21hcnQtY29ubmVjdGlvbnMvZmFpbGVkLWVtYmVkZGluZ3MudHh0XCIpO1xyXG4gICAgaWYoZmFpbGVkX2VtYmVkZGluZ3NfZmlsZV9leGlzdHMpIHtcclxuICAgICAgZmFpbGVkX2VtYmVkZGluZ3MgPSBhd2FpdCB0aGlzLmFwcC52YXVsdC5hZGFwdGVyLnJlYWQoXCIuc21hcnQtY29ubmVjdGlvbnMvZmFpbGVkLWVtYmVkZGluZ3MudHh0XCIpO1xyXG4gICAgICAvLyBzcGxpdCBmYWlsZWRfZW1iZWRkaW5ncyBpbnRvIGFycmF5XHJcbiAgICAgIGZhaWxlZF9lbWJlZGRpbmdzID0gZmFpbGVkX2VtYmVkZGluZ3Muc3BsaXQoXCJcXHJcXG5cIik7XHJcbiAgICB9XHJcbiAgICAvLyBtZXJnZSBmYWlsZWRfZW1iZWRkaW5ncyB3aXRoIHJlbmRlcl9sb2cuZmFpbGVkX2VtYmVkZGluZ3NcclxuICAgIGZhaWxlZF9lbWJlZGRpbmdzID0gZmFpbGVkX2VtYmVkZGluZ3MuY29uY2F0KHRoaXMucmVuZGVyX2xvZy5mYWlsZWRfZW1iZWRkaW5ncyk7XHJcbiAgICAvLyByZW1vdmUgZHVwbGljYXRlc1xyXG4gICAgZmFpbGVkX2VtYmVkZGluZ3MgPSBbLi4ubmV3IFNldChmYWlsZWRfZW1iZWRkaW5ncyldO1xyXG4gICAgLy8gc29ydCBmYWlsZWRfZW1iZWRkaW5ncyBhcnJheSBhbHBoYWJldGljYWxseVxyXG4gICAgZmFpbGVkX2VtYmVkZGluZ3Muc29ydCgpO1xyXG4gICAgLy8gY29udmVydCBmYWlsZWRfZW1iZWRkaW5ncyBhcnJheSB0byBzdHJpbmdcclxuICAgIGZhaWxlZF9lbWJlZGRpbmdzID0gZmFpbGVkX2VtYmVkZGluZ3Muam9pbihcIlxcclxcblwiKTtcclxuICAgIC8vIHdyaXRlIGZhaWxlZF9lbWJlZGRpbmdzIHRvIGZpbGVcclxuICAgIGF3YWl0IHRoaXMuYXBwLnZhdWx0LmFkYXB0ZXIud3JpdGUoXCIuc21hcnQtY29ubmVjdGlvbnMvZmFpbGVkLWVtYmVkZGluZ3MudHh0XCIsIGZhaWxlZF9lbWJlZGRpbmdzKTtcclxuICAgIC8vIHJlbG9hZCBmYWlsZWRfZW1iZWRkaW5ncyB0byBwcmV2ZW50IHJldHJ5aW5nIGZhaWxlZCBmaWxlcyB1bnRpbCBleHBsaWNpdGx5IHJlcXVlc3RlZFxyXG4gICAgYXdhaXQgdGhpcy5sb2FkX2ZhaWxlZF9maWxlcygpO1xyXG4gIH1cclxuXHJcbiAgLy8gbG9hZCBmYWlsZWQgZmlsZXMgZnJvbSBmYWlsZWQtZW1iZWRkaW5ncy50eHRcclxuICBhc3luYyBsb2FkX2ZhaWxlZF9maWxlcyAoKSB7XHJcbiAgICAvLyBjaGVjayBpZiBmYWlsZWQtZW1iZWRkaW5ncy50eHQgZXhpc3RzXHJcbiAgICBjb25zdCBmYWlsZWRfZW1iZWRkaW5nc19maWxlX2V4aXN0cyA9IGF3YWl0IHRoaXMuYXBwLnZhdWx0LmFkYXB0ZXIuZXhpc3RzKFwiLnNtYXJ0LWNvbm5lY3Rpb25zL2ZhaWxlZC1lbWJlZGRpbmdzLnR4dFwiKTtcclxuICAgIGlmKCFmYWlsZWRfZW1iZWRkaW5nc19maWxlX2V4aXN0cykge1xyXG4gICAgICB0aGlzLnNldHRpbmdzLmZhaWxlZF9maWxlcyA9IFtdO1xyXG4gICAgICBjb25zb2xlLmxvZyhcIk5vIGZhaWxlZCBmaWxlcy5cIik7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuICAgIC8vIHJlYWQgZmFpbGVkLWVtYmVkZGluZ3MudHh0XHJcbiAgICBjb25zdCBmYWlsZWRfZW1iZWRkaW5ncyA9IGF3YWl0IHRoaXMuYXBwLnZhdWx0LmFkYXB0ZXIucmVhZChcIi5zbWFydC1jb25uZWN0aW9ucy9mYWlsZWQtZW1iZWRkaW5ncy50eHRcIik7XHJcbiAgICAvLyBzcGxpdCBmYWlsZWRfZW1iZWRkaW5ncyBpbnRvIGFycmF5IGFuZCByZW1vdmUgZW1wdHkgbGluZXNcclxuICAgIGNvbnN0IGZhaWxlZF9lbWJlZGRpbmdzX2FycmF5ID0gZmFpbGVkX2VtYmVkZGluZ3Muc3BsaXQoXCJcXHJcXG5cIik7XHJcbiAgICAvLyBzcGxpdCBhdCAnIycgYW5kIHJlZHVjZSBpbnRvIHVuaXF1ZSBmaWxlIHBhdGhzXHJcbiAgICBjb25zdCBmYWlsZWRfZmlsZXMgPSBmYWlsZWRfZW1iZWRkaW5nc19hcnJheS5tYXAoZW1iZWRkaW5nID0+IGVtYmVkZGluZy5zcGxpdChcIiNcIilbMF0pLnJlZHVjZSgodW5pcXVlLCBpdGVtKSA9PiB1bmlxdWUuaW5jbHVkZXMoaXRlbSkgPyB1bmlxdWUgOiBbLi4udW5pcXVlLCBpdGVtXSwgW10pO1xyXG4gICAgLy8gcmV0dXJuIGZhaWxlZF9maWxlc1xyXG4gICAgdGhpcy5zZXR0aW5ncy5mYWlsZWRfZmlsZXMgPSBmYWlsZWRfZmlsZXM7XHJcbiAgICAvLyBjb25zb2xlLmxvZyhmYWlsZWRfZmlsZXMpO1xyXG4gIH1cclxuICAvLyByZXRyeSBmYWlsZWQgZW1iZWRkaW5nc1xyXG4gIGFzeW5jIHJldHJ5X2ZhaWxlZF9maWxlcyAoKSB7XHJcbiAgICAvLyByZW1vdmUgZmFpbGVkIGZpbGVzIGZyb20gZmFpbGVkX2ZpbGVzXHJcbiAgICB0aGlzLnNldHRpbmdzLmZhaWxlZF9maWxlcyA9IFtdO1xyXG4gICAgLy8gaWYgZmFpbGVkLWVtYmVkZGluZ3MudHh0IGV4aXN0cyB0aGVuIGRlbGV0ZSBpdFxyXG4gICAgY29uc3QgZmFpbGVkX2VtYmVkZGluZ3NfZmlsZV9leGlzdHMgPSBhd2FpdCB0aGlzLmFwcC52YXVsdC5hZGFwdGVyLmV4aXN0cyhcIi5zbWFydC1jb25uZWN0aW9ucy9mYWlsZWQtZW1iZWRkaW5ncy50eHRcIik7XHJcbiAgICBpZihmYWlsZWRfZW1iZWRkaW5nc19maWxlX2V4aXN0cykge1xyXG4gICAgICBhd2FpdCB0aGlzLmFwcC52YXVsdC5hZGFwdGVyLnJlbW92ZShcIi5zbWFydC1jb25uZWN0aW9ucy9mYWlsZWQtZW1iZWRkaW5ncy50eHRcIik7XHJcbiAgICB9XHJcbiAgICAvLyBydW4gZ2V0IGFsbCBlbWJlZGRpbmdzXHJcbiAgICBhd2FpdCB0aGlzLmdldF9hbGxfZW1iZWRkaW5ncygpO1xyXG4gIH1cclxuXHJcblxyXG4gIC8vIGFkZCAuc21hcnQtY29ubmVjdGlvbnMgdG8gLmdpdGlnbm9yZSB0byBwcmV2ZW50IGlzc3VlcyB3aXRoIGxhcmdlLCBmcmVxdWVudGx5IHVwZGF0ZWQgZW1iZWRkaW5ncyBmaWxlKHMpXHJcbiAgYXN5bmMgYWRkX3RvX2dpdGlnbm9yZSgpIHtcclxuICAgIGlmKCEoYXdhaXQgdGhpcy5hcHAudmF1bHQuYWRhcHRlci5leGlzdHMoXCIuZ2l0aWdub3JlXCIpKSkge1xyXG4gICAgICByZXR1cm47IC8vIGlmIC5naXRpZ25vcmUgZG9lc24ndCBleGlzdCB0aGVuIGRvbid0IGFkZCAuc21hcnQtY29ubmVjdGlvbnMgdG8gLmdpdGlnbm9yZVxyXG4gICAgfVxyXG4gICAgbGV0IGdpdGlnbm9yZV9maWxlID0gYXdhaXQgdGhpcy5hcHAudmF1bHQuYWRhcHRlci5yZWFkKFwiLmdpdGlnbm9yZVwiKTtcclxuICAgIC8vIGlmIC5zbWFydC1jb25uZWN0aW9ucyBub3QgaW4gLmdpdGlnbm9yZVxyXG4gICAgaWYgKGdpdGlnbm9yZV9maWxlLmluZGV4T2YoXCIuc21hcnQtY29ubmVjdGlvbnNcIikgPCAwKSB7XHJcbiAgICAgIC8vIGFkZCAuc21hcnQtY29ubmVjdGlvbnMgdG8gLmdpdGlnbm9yZVxyXG4gICAgICBsZXQgYWRkX3RvX2dpdGlnbm9yZSA9IFwiXFxuXFxuIyBJZ25vcmUgU21hcnQgQ29ubmVjdGlvbnMgZm9sZGVyIGJlY2F1c2UgZW1iZWRkaW5ncyBmaWxlIGlzIGxhcmdlIGFuZCB1cGRhdGVkIGZyZXF1ZW50bHlcIjtcclxuICAgICAgYWRkX3RvX2dpdGlnbm9yZSArPSBcIlxcbi5zbWFydC1jb25uZWN0aW9uc1wiO1xyXG4gICAgICBhd2FpdCB0aGlzLmFwcC52YXVsdC5hZGFwdGVyLndyaXRlKFwiLmdpdGlnbm9yZVwiLCBnaXRpZ25vcmVfZmlsZSArIGFkZF90b19naXRpZ25vcmUpO1xyXG4gICAgICBjb25zb2xlLmxvZyhcImFkZGVkIC5zbWFydC1jb25uZWN0aW9ucyB0byAuZ2l0aWdub3JlXCIpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLy8gZm9yY2UgcmVmcmVzaCBlbWJlZGRpbmdzIGZpbGUgYnV0IGZpcnN0IHJlbmFtZSBleGlzdGluZyBlbWJlZGRpbmdzIGZpbGUgdG8gLnNtYXJ0LWNvbm5lY3Rpb25zL2VtYmVkZGluZ3MtWVlZWS1NTS1ERC5qc29uXHJcbiAgYXN5bmMgZm9yY2VfcmVmcmVzaF9lbWJlZGRpbmdzX2ZpbGUoKSB7XHJcbiAgICBuZXcgT2JzaWRpYW4uTm90aWNlKFwiU21hcnQgQ29ubmVjdGlvbnM6IGVtYmVkZGluZ3MgZmlsZSBGb3JjZSBSZWZyZXNoZWQsIG1ha2luZyBuZXcgY29ubmVjdGlvbnMuLi5cIik7XHJcbiAgICAvLyBmb3JjZSByZWZyZXNoXHJcbiAgICBhd2FpdCB0aGlzLnNtYXJ0X3ZlY19saXRlLmZvcmNlX3JlZnJlc2goKTtcclxuICAgIC8vIHRyaWdnZXIgbWFraW5nIG5ldyBjb25uZWN0aW9uc1xyXG4gICAgYXdhaXQgdGhpcy5nZXRfYWxsX2VtYmVkZGluZ3MoKTtcclxuICAgIHRoaXMub3V0cHV0X3JlbmRlcl9sb2coKTtcclxuICAgIG5ldyBPYnNpZGlhbi5Ob3RpY2UoXCJTbWFydCBDb25uZWN0aW9uczogZW1iZWRkaW5ncyBmaWxlIEZvcmNlIFJlZnJlc2hlZCwgbmV3IGNvbm5lY3Rpb25zIG1hZGUuXCIpO1xyXG4gIH1cclxuXHJcbiAgLy8gZ2V0IGVtYmVkZGluZ3MgZm9yIGVtYmVkX2lucHV0XHJcbiAgYXN5bmMgZ2V0X2ZpbGVfZW1iZWRkaW5ncyhjdXJyX2ZpbGUsIHNhdmU9dHJ1ZSkge1xyXG4gICAgLy8gbGV0IGJhdGNoX3Byb21pc2VzID0gW107XHJcbiAgICBsZXQgcmVxX2JhdGNoID0gW107XHJcbiAgICBsZXQgYmxvY2tzID0gW107XHJcbiAgICAvLyBpbml0aWF0ZSBjdXJyX2ZpbGVfa2V5IGZyb20gbWQ1KGN1cnJfZmlsZS5wYXRoKVxyXG4gICAgY29uc3QgY3Vycl9maWxlX2tleSA9IG1kNShjdXJyX2ZpbGUucGF0aCk7XHJcbiAgICAvLyBpbnRpYXRlIGZpbGVfZmlsZV9lbWJlZF9pbnB1dCBieSByZW1vdmluZyAubWQgYW5kIGNvbnZlcnRpbmcgZmlsZSBwYXRoIHRvIGJyZWFkY3J1bWJzIChcIiA+IFwiKVxyXG4gICAgbGV0IGZpbGVfZW1iZWRfaW5wdXQgPSBjdXJyX2ZpbGUucGF0aC5yZXBsYWNlKFwiLm1kXCIsIFwiXCIpO1xyXG4gICAgZmlsZV9lbWJlZF9pbnB1dCA9IGZpbGVfZW1iZWRfaW5wdXQucmVwbGFjZSgvXFwvL2csIFwiID4gXCIpO1xyXG4gICAgLy8gZW1iZWQgb24gZmlsZS5uYW1lL3RpdGxlIG9ubHkgaWYgcGF0aF9vbmx5IHBhdGggbWF0Y2hlciBzcGVjaWZpZWQgaW4gc2V0dGluZ3NcclxuICAgIGxldCBwYXRoX29ubHkgPSBmYWxzZTtcclxuICAgIGZvcihsZXQgaiA9IDA7IGogPCB0aGlzLnBhdGhfb25seS5sZW5ndGg7IGorKykge1xyXG4gICAgICBpZihjdXJyX2ZpbGUucGF0aC5pbmRleE9mKHRoaXMucGF0aF9vbmx5W2pdKSA+IC0xKSB7XHJcbiAgICAgICAgcGF0aF9vbmx5ID0gdHJ1ZTtcclxuICAgICAgICBjb25zb2xlLmxvZyhcInRpdGxlIG9ubHkgZmlsZSB3aXRoIG1hdGNoZXI6IFwiICsgdGhpcy5wYXRoX29ubHlbal0pO1xyXG4gICAgICAgIC8vIGJyZWFrIG91dCBvZiBsb29wXHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICAgIC8vIHJldHVybiBlYXJseSBpZiBwYXRoX29ubHlcclxuICAgIGlmKHBhdGhfb25seSkge1xyXG4gICAgICByZXFfYmF0Y2gucHVzaChbY3Vycl9maWxlX2tleSwgZmlsZV9lbWJlZF9pbnB1dCwge1xyXG4gICAgICAgIG10aW1lOiBjdXJyX2ZpbGUuc3RhdC5tdGltZSxcclxuICAgICAgICBwYXRoOiBjdXJyX2ZpbGUucGF0aCxcclxuICAgICAgfV0pO1xyXG4gICAgICBhd2FpdCB0aGlzLmdldF9lbWJlZGRpbmdzX2JhdGNoKHJlcV9iYXRjaCk7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuICAgIC8qKlxyXG4gICAgICogQkVHSU4gQ2FudmFzIGZpbGUgdHlwZSBFbWJlZGRpbmdcclxuICAgICAqL1xyXG4gICAgaWYoY3Vycl9maWxlLmV4dGVuc2lvbiA9PT0gXCJjYW52YXNcIikge1xyXG4gICAgICAvLyBnZXQgZmlsZSBjb250ZW50cyBhbmQgcGFyc2UgYXMgSlNPTlxyXG4gICAgICBjb25zdCBjYW52YXNfY29udGVudHMgPSBhd2FpdCB0aGlzLmFwcC52YXVsdC5jYWNoZWRSZWFkKGN1cnJfZmlsZSk7XHJcbiAgICAgIGlmKCh0eXBlb2YgY2FudmFzX2NvbnRlbnRzID09PSBcInN0cmluZ1wiKSAmJiAoY2FudmFzX2NvbnRlbnRzLmluZGV4T2YoXCJub2Rlc1wiKSA+IC0xKSkge1xyXG4gICAgICAgIGNvbnN0IGNhbnZhc19qc29uID0gSlNPTi5wYXJzZShjYW52YXNfY29udGVudHMpO1xyXG4gICAgICAgIC8vIGZvciBlYWNoIG9iamVjdCBpbiBub2RlcyBhcnJheVxyXG4gICAgICAgIGZvcihsZXQgaiA9IDA7IGogPCBjYW52YXNfanNvbi5ub2Rlcy5sZW5ndGg7IGorKykge1xyXG4gICAgICAgICAgLy8gaWYgb2JqZWN0IGhhcyB0ZXh0IHByb3BlcnR5XHJcbiAgICAgICAgICBpZihjYW52YXNfanNvbi5ub2Rlc1tqXS50ZXh0KSB7XHJcbiAgICAgICAgICAgIC8vIGFkZCB0byBmaWxlX2VtYmVkX2lucHV0XHJcbiAgICAgICAgICAgIGZpbGVfZW1iZWRfaW5wdXQgKz0gXCJcXG5cIiArIGNhbnZhc19qc29uLm5vZGVzW2pdLnRleHQ7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgICAvLyBpZiBvYmplY3QgaGFzIGZpbGUgcHJvcGVydHlcclxuICAgICAgICAgIGlmKGNhbnZhc19qc29uLm5vZGVzW2pdLmZpbGUpIHtcclxuICAgICAgICAgICAgLy8gYWRkIHRvIGZpbGVfZW1iZWRfaW5wdXRcclxuICAgICAgICAgICAgZmlsZV9lbWJlZF9pbnB1dCArPSBcIlxcbkxpbms6IFwiICsgY2FudmFzX2pzb24ubm9kZXNbal0uZmlsZTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgICAgLy8gY29uc29sZS5sb2coZmlsZV9lbWJlZF9pbnB1dCk7XHJcbiAgICAgIHJlcV9iYXRjaC5wdXNoKFtjdXJyX2ZpbGVfa2V5LCBmaWxlX2VtYmVkX2lucHV0LCB7XHJcbiAgICAgICAgbXRpbWU6IGN1cnJfZmlsZS5zdGF0Lm10aW1lLFxyXG4gICAgICAgIHBhdGg6IGN1cnJfZmlsZS5wYXRoLFxyXG4gICAgICB9XSk7XHJcbiAgICAgIGF3YWl0IHRoaXMuZ2V0X2VtYmVkZGluZ3NfYmF0Y2gocmVxX2JhdGNoKTtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQkVHSU4gQmxvY2sgXCJzZWN0aW9uXCIgZW1iZWRkaW5nXHJcbiAgICAgKi9cclxuICAgIC8vIGdldCBmaWxlIGNvbnRlbnRzXHJcbiAgICBjb25zdCBub3RlX2NvbnRlbnRzID0gYXdhaXQgdGhpcy5hcHAudmF1bHQuY2FjaGVkUmVhZChjdXJyX2ZpbGUpO1xyXG4gICAgbGV0IHByb2Nlc3NlZF9zaW5jZV9sYXN0X3NhdmUgPSAwO1xyXG4gICAgY29uc3Qgbm90ZV9zZWN0aW9ucyA9IHRoaXMuYmxvY2tfcGFyc2VyKG5vdGVfY29udGVudHMsIGN1cnJfZmlsZS5wYXRoKTtcclxuICAgIC8vIGNvbnNvbGUubG9nKG5vdGVfc2VjdGlvbnMpO1xyXG4gICAgLy8gaWYgbm90ZSBoYXMgbW9yZSB0aGFuIG9uZSBzZWN0aW9uIChpZiBvbmx5IG9uZSB0aGVuIGl0cyBzYW1lIGFzIGZ1bGwtY29udGVudClcclxuICAgIGlmKG5vdGVfc2VjdGlvbnMubGVuZ3RoID4gMSkge1xyXG4gICAgICAvLyBmb3IgZWFjaCBzZWN0aW9uIGluIGZpbGVcclxuICAgICAgLy9jb25zb2xlLmxvZyhcIlNlY3Rpb25zOiBcIiArIG5vdGVfc2VjdGlvbnMubGVuZ3RoKTtcclxuICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCBub3RlX3NlY3Rpb25zLmxlbmd0aDsgaisrKSB7XHJcbiAgICAgICAgLy8gZ2V0IGVtYmVkX2lucHV0IGZvciBibG9ja1xyXG4gICAgICAgIGNvbnN0IGJsb2NrX2VtYmVkX2lucHV0ID0gbm90ZV9zZWN0aW9uc1tqXS50ZXh0O1xyXG4gICAgICAgIC8vIGNvbnNvbGUubG9nKG5vdGVfc2VjdGlvbnNbal0ucGF0aCk7XHJcbiAgICAgICAgLy8gZ2V0IGJsb2NrIGtleSBmcm9tIGJsb2NrLnBhdGggKGNvbnRhaW5zIGJvdGggZmlsZS5wYXRoIGFuZCBoZWFkZXIgcGF0aClcclxuICAgICAgICBjb25zdCBibG9ja19rZXkgPSBtZDUobm90ZV9zZWN0aW9uc1tqXS5wYXRoKTtcclxuICAgICAgICBibG9ja3MucHVzaChibG9ja19rZXkpO1xyXG4gICAgICAgIC8vIHNraXAgaWYgbGVuZ3RoIG9mIGJsb2NrX2VtYmVkX2lucHV0IHNhbWUgYXMgbGVuZ3RoIG9mIGVtYmVkZGluZ3NbYmxvY2tfa2V5XS5tZXRhLnNpemVcclxuICAgICAgICAvLyBUT0RPIGNvbnNpZGVyIHJvdW5kaW5nIHRvIG5lYXJlc3QgMTAgb3IgMTAwIGZvciBmdXp6eSBtYXRjaGluZ1xyXG4gICAgICAgIGlmICh0aGlzLnNtYXJ0X3ZlY19saXRlLmdldF9zaXplKGJsb2NrX2tleSkgPT09IGJsb2NrX2VtYmVkX2lucHV0Lmxlbmd0aCkge1xyXG4gICAgICAgICAgLy8gbG9nIHNraXBwaW5nIGZpbGVcclxuICAgICAgICAgIC8vIGNvbnNvbGUubG9nKFwic2tpcHBpbmcgYmxvY2sgKGxlbilcIik7XHJcbiAgICAgICAgICBjb250aW51ZTtcclxuICAgICAgICB9XHJcbiAgICAgICAgLy8gYWRkIGhhc2ggdG8gYmxvY2tzIHRvIHByZXZlbnQgZW1wdHkgYmxvY2tzIHRyaWdnZXJpbmcgZnVsbC1maWxlIGVtYmVkZGluZ1xyXG4gICAgICAgIC8vIHNraXAgaWYgZW1iZWRkaW5ncyBrZXkgYWxyZWFkeSBleGlzdHMgYW5kIGJsb2NrIG10aW1lIGlzIGdyZWF0ZXIgdGhhbiBvciBlcXVhbCB0byBmaWxlIG10aW1lXHJcbiAgICAgICAgaWYodGhpcy5zbWFydF92ZWNfbGl0ZS5tdGltZV9pc19jdXJyZW50KGJsb2NrX2tleSwgY3Vycl9maWxlLnN0YXQubXRpbWUpKSB7XHJcbiAgICAgICAgICAvLyBsb2cgc2tpcHBpbmcgZmlsZVxyXG4gICAgICAgICAgLy8gY29uc29sZS5sb2coXCJza2lwcGluZyBibG9jayAobXRpbWUpXCIpO1xyXG4gICAgICAgICAgY29udGludWU7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIC8vIHNraXAgaWYgaGFzaCBpcyBwcmVzZW50IGluIGVtYmVkZGluZ3MgYW5kIGhhc2ggb2YgYmxvY2tfZW1iZWRfaW5wdXQgaXMgZXF1YWwgdG8gaGFzaCBpbiBlbWJlZGRpbmdzXHJcbiAgICAgICAgY29uc3QgYmxvY2tfaGFzaCA9IG1kNShibG9ja19lbWJlZF9pbnB1dC50cmltKCkpO1xyXG4gICAgICAgIGlmKHRoaXMuc21hcnRfdmVjX2xpdGUuZ2V0X2hhc2goYmxvY2tfa2V5KSA9PT0gYmxvY2tfaGFzaCkge1xyXG4gICAgICAgICAgLy8gbG9nIHNraXBwaW5nIGZpbGVcclxuICAgICAgICAgIC8vIGNvbnNvbGUubG9nKFwic2tpcHBpbmcgYmxvY2sgKGhhc2gpXCIpO1xyXG4gICAgICAgICAgY29udGludWU7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyBjcmVhdGUgcmVxX2JhdGNoIGZvciBiYXRjaGluZyByZXF1ZXN0c1xyXG4gICAgICAgIHJlcV9iYXRjaC5wdXNoKFtibG9ja19rZXksIGJsb2NrX2VtYmVkX2lucHV0LCB7XHJcbiAgICAgICAgICAvLyBvbGRtdGltZTogY3Vycl9maWxlLnN0YXQubXRpbWUsXHJcbiAgICAgICAgICAvLyBnZXQgY3VycmVudCBkYXRldGltZSBhcyB1bml4IHRpbWVzdGFtcFxyXG4gICAgICAgICAgbXRpbWU6IERhdGUubm93KCksXHJcbiAgICAgICAgICBoYXNoOiBibG9ja19oYXNoLFxyXG4gICAgICAgICAgcGFyZW50OiBjdXJyX2ZpbGVfa2V5LFxyXG4gICAgICAgICAgcGF0aDogbm90ZV9zZWN0aW9uc1tqXS5wYXRoLFxyXG4gICAgICAgICAgc2l6ZTogYmxvY2tfZW1iZWRfaW5wdXQubGVuZ3RoLFxyXG4gICAgICAgIH1dKTtcclxuICAgICAgICBpZihyZXFfYmF0Y2gubGVuZ3RoID4gOSkge1xyXG4gICAgICAgICAgLy8gYWRkIGJhdGNoIHRvIGJhdGNoX3Byb21pc2VzXHJcbiAgICAgICAgICBhd2FpdCB0aGlzLmdldF9lbWJlZGRpbmdzX2JhdGNoKHJlcV9iYXRjaCk7XHJcbiAgICAgICAgICBwcm9jZXNzZWRfc2luY2VfbGFzdF9zYXZlICs9IHJlcV9iYXRjaC5sZW5ndGg7XHJcbiAgICAgICAgICAvLyBsb2cgZW1iZWRkaW5nXHJcbiAgICAgICAgICAvLyBjb25zb2xlLmxvZyhcImVtYmVkZGluZzogXCIgKyBjdXJyX2ZpbGUucGF0aCk7XHJcbiAgICAgICAgICBpZiAocHJvY2Vzc2VkX3NpbmNlX2xhc3Rfc2F2ZSA+PSAzMCkge1xyXG4gICAgICAgICAgICAvLyB3cml0ZSBlbWJlZGRpbmdzIEpTT04gdG8gZmlsZVxyXG4gICAgICAgICAgICBhd2FpdCB0aGlzLnNhdmVfZW1iZWRkaW5nc190b19maWxlKCk7XHJcbiAgICAgICAgICAgIC8vIHJlc2V0IHByb2Nlc3NlZF9zaW5jZV9sYXN0X3NhdmVcclxuICAgICAgICAgICAgcHJvY2Vzc2VkX3NpbmNlX2xhc3Rfc2F2ZSA9IDA7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgICAvLyByZXNldCByZXFfYmF0Y2hcclxuICAgICAgICAgIHJlcV9iYXRjaCA9IFtdO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgfVxyXG4gICAgLy8gaWYgcmVxX2JhdGNoIGlzIG5vdCBlbXB0eVxyXG4gICAgaWYocmVxX2JhdGNoLmxlbmd0aCA+IDApIHtcclxuICAgICAgLy8gcHJvY2VzcyByZW1haW5pbmcgcmVxX2JhdGNoXHJcbiAgICAgIGF3YWl0IHRoaXMuZ2V0X2VtYmVkZGluZ3NfYmF0Y2gocmVxX2JhdGNoKTtcclxuICAgICAgcmVxX2JhdGNoID0gW107XHJcbiAgICAgIHByb2Nlc3NlZF9zaW5jZV9sYXN0X3NhdmUgKz0gcmVxX2JhdGNoLmxlbmd0aDtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIEJFR0lOIEZpbGUgXCJmdWxsIG5vdGVcIiBlbWJlZGRpbmdcclxuICAgICAqL1xyXG5cclxuICAgIC8vIGlmIGZpbGUgbGVuZ3RoIGlzIGxlc3MgdGhhbiB+ODAwMCB0b2tlbnMgdXNlIGZ1bGwgZmlsZSBjb250ZW50c1xyXG4gICAgLy8gZWxzZSBpZiBmaWxlIGxlbmd0aCBpcyBncmVhdGVyIHRoYW4gODAwMCB0b2tlbnMgYnVpbGQgZmlsZV9lbWJlZF9pbnB1dCBmcm9tIGZpbGUgaGVhZGluZ3NcclxuICAgIGZpbGVfZW1iZWRfaW5wdXQgKz0gYDpcXG5gO1xyXG4gICAgLyoqXHJcbiAgICAgKiBUT0RPOiBpbXByb3ZlL3JlZmFjdG9yIHRoZSBmb2xsb3dpbmcgXCJsYXJnZSBmaWxlIHJlZHVjZSB0byBoZWFkaW5nc1wiIGxvZ2ljXHJcbiAgICAgKi9cclxuICAgIGlmKG5vdGVfY29udGVudHMubGVuZ3RoIDwgTUFYX0VNQkVEX1NUUklOR19MRU5HVEgpIHtcclxuICAgICAgZmlsZV9lbWJlZF9pbnB1dCArPSBub3RlX2NvbnRlbnRzXHJcbiAgICB9ZWxzZXtcclxuICAgICAgY29uc3Qgbm90ZV9tZXRhX2NhY2hlID0gdGhpcy5hcHAubWV0YWRhdGFDYWNoZS5nZXRGaWxlQ2FjaGUoY3Vycl9maWxlKTtcclxuICAgICAgLy8gZm9yIGVhY2ggaGVhZGluZyBpbiBmaWxlXHJcbiAgICAgIGlmKHR5cGVvZiBub3RlX21ldGFfY2FjaGUuaGVhZGluZ3MgPT09IFwidW5kZWZpbmVkXCIpIHtcclxuICAgICAgICAvLyBjb25zb2xlLmxvZyhcIm5vIGhlYWRpbmdzIGZvdW5kLCB1c2luZyBmaXJzdCBjaHVuayBvZiBmaWxlIGluc3RlYWRcIik7XHJcbiAgICAgICAgZmlsZV9lbWJlZF9pbnB1dCArPSBub3RlX2NvbnRlbnRzLnN1YnN0cmluZygwLCBNQVhfRU1CRURfU1RSSU5HX0xFTkdUSCk7XHJcbiAgICAgIH1lbHNle1xyXG4gICAgICAgIGxldCBub3RlX2hlYWRpbmdzID0gXCJcIjtcclxuICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IG5vdGVfbWV0YV9jYWNoZS5oZWFkaW5ncy5sZW5ndGg7IGorKykge1xyXG4gICAgICAgICAgLy8gZ2V0IGhlYWRpbmcgbGV2ZWxcclxuICAgICAgICAgIGNvbnN0IGhlYWRpbmdfbGV2ZWwgPSBub3RlX21ldGFfY2FjaGUuaGVhZGluZ3Nbal0ubGV2ZWw7XHJcbiAgICAgICAgICAvLyBnZXQgaGVhZGluZyB0ZXh0XHJcbiAgICAgICAgICBjb25zdCBoZWFkaW5nX3RleHQgPSBub3RlX21ldGFfY2FjaGUuaGVhZGluZ3Nbal0uaGVhZGluZztcclxuICAgICAgICAgIC8vIGJ1aWxkIG1hcmtkb3duIGhlYWRpbmdcclxuICAgICAgICAgIGxldCBtZF9oZWFkaW5nID0gXCJcIjtcclxuICAgICAgICAgIGZvciAobGV0IGsgPSAwOyBrIDwgaGVhZGluZ19sZXZlbDsgaysrKSB7XHJcbiAgICAgICAgICAgIG1kX2hlYWRpbmcgKz0gXCIjXCI7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgICAvLyBhZGQgaGVhZGluZyB0byBub3RlX2hlYWRpbmdzXHJcbiAgICAgICAgICBub3RlX2hlYWRpbmdzICs9IGAke21kX2hlYWRpbmd9ICR7aGVhZGluZ190ZXh0fVxcbmA7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIC8vY29uc29sZS5sb2cobm90ZV9oZWFkaW5ncyk7XHJcbiAgICAgICAgZmlsZV9lbWJlZF9pbnB1dCArPSBub3RlX2hlYWRpbmdzXHJcbiAgICAgICAgaWYoZmlsZV9lbWJlZF9pbnB1dC5sZW5ndGggPiBNQVhfRU1CRURfU1RSSU5HX0xFTkdUSCkge1xyXG4gICAgICAgICAgZmlsZV9lbWJlZF9pbnB1dCA9IGZpbGVfZW1iZWRfaW5wdXQuc3Vic3RyaW5nKDAsIE1BWF9FTUJFRF9TVFJJTkdfTEVOR1RIKTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgIH1cclxuICAgIC8vIHNraXAgZW1iZWRkaW5nIGZ1bGwgZmlsZSBpZiBibG9ja3MgaXMgbm90IGVtcHR5IGFuZCBhbGwgaGFzaGVzIGFyZSBwcmVzZW50IGluIGVtYmVkZGluZ3NcclxuICAgIC8vIGJldHRlciB0aGFuIGhhc2hpbmcgZmlsZV9lbWJlZF9pbnB1dCBiZWNhdXNlIG1vcmUgcmVzaWxpZW50IHRvIGluY29uc2VxdWVudGlhbCBjaGFuZ2VzICh3aGl0ZXNwYWNlIGJldHdlZW4gaGVhZGluZ3MpXHJcbiAgICBjb25zdCBmaWxlX2hhc2ggPSBtZDUoZmlsZV9lbWJlZF9pbnB1dC50cmltKCkpO1xyXG4gICAgY29uc3QgZXhpc3RpbmdfaGFzaCA9IHRoaXMuc21hcnRfdmVjX2xpdGUuZ2V0X2hhc2goY3Vycl9maWxlX2tleSk7XHJcbiAgICBpZihleGlzdGluZ19oYXNoICYmIChmaWxlX2hhc2ggPT09IGV4aXN0aW5nX2hhc2gpKSB7XHJcbiAgICAgIC8vIGNvbnNvbGUubG9nKFwic2tpcHBpbmcgZmlsZSAoaGFzaCk6IFwiICsgY3Vycl9maWxlLnBhdGgpO1xyXG4gICAgICB0aGlzLnVwZGF0ZV9yZW5kZXJfbG9nKGJsb2NrcywgZmlsZV9lbWJlZF9pbnB1dCk7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH07XHJcblxyXG4gICAgLy8gaWYgbm90IGFscmVhZHkgc2tpcHBpbmcgYW5kIGJsb2NrcyBhcmUgcHJlc2VudFxyXG4gICAgY29uc3QgZXhpc3RpbmdfYmxvY2tzID0gdGhpcy5zbWFydF92ZWNfbGl0ZS5nZXRfY2hpbGRyZW4oY3Vycl9maWxlX2tleSk7XHJcbiAgICBsZXQgZXhpc3RpbmdfaGFzX2FsbF9ibG9ja3MgPSB0cnVlO1xyXG4gICAgaWYoZXhpc3RpbmdfYmxvY2tzICYmIEFycmF5LmlzQXJyYXkoZXhpc3RpbmdfYmxvY2tzKSAmJiAoYmxvY2tzLmxlbmd0aCA+IDApKSB7XHJcbiAgICAgIC8vIGlmIGFsbCBibG9ja3MgYXJlIGluIGV4aXN0aW5nX2Jsb2NrcyB0aGVuIHNraXAgKGFsbG93cyBkZWxldGlvbiBvZiBzbWFsbCBibG9ja3Mgd2l0aG91dCB0cmlnZ2VyaW5nIGZ1bGwgZmlsZSBlbWJlZGRpbmcpXHJcbiAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgYmxvY2tzLmxlbmd0aDsgaisrKSB7XHJcbiAgICAgICAgaWYoZXhpc3RpbmdfYmxvY2tzLmluZGV4T2YoYmxvY2tzW2pdKSA9PT0gLTEpIHtcclxuICAgICAgICAgIGV4aXN0aW5nX2hhc19hbGxfYmxvY2tzID0gZmFsc2U7XHJcbiAgICAgICAgICBicmVhaztcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgIH1cclxuICAgIC8vIGlmIGV4aXN0aW5nIGhhcyBhbGwgYmxvY2tzIHRoZW4gY2hlY2sgZmlsZSBzaXplIGZvciBkZWx0YVxyXG4gICAgaWYoZXhpc3RpbmdfaGFzX2FsbF9ibG9ja3Mpe1xyXG4gICAgICAvLyBnZXQgY3VycmVudCBub3RlIGZpbGUgc2l6ZVxyXG4gICAgICBjb25zdCBjdXJyX2ZpbGVfc2l6ZSA9IGN1cnJfZmlsZS5zdGF0LnNpemU7XHJcbiAgICAgIC8vIGdldCBmaWxlIHNpemUgZnJvbSBlbWJlZGRpbmdzXHJcbiAgICAgIGNvbnN0IHByZXZfZmlsZV9zaXplID0gdGhpcy5zbWFydF92ZWNfbGl0ZS5nZXRfc2l6ZShjdXJyX2ZpbGVfa2V5KTtcclxuICAgICAgaWYgKHByZXZfZmlsZV9zaXplKSB7XHJcbiAgICAgICAgLy8gaWYgY3VyciBmaWxlIHNpemUgaXMgbGVzcyB0aGFuIDEwJSBkaWZmZXJlbnQgZnJvbSBwcmV2IGZpbGUgc2l6ZVxyXG4gICAgICAgIGNvbnN0IGZpbGVfZGVsdGFfcGN0ID0gTWF0aC5yb3VuZCgoTWF0aC5hYnMoY3Vycl9maWxlX3NpemUgLSBwcmV2X2ZpbGVfc2l6ZSkgLyBjdXJyX2ZpbGVfc2l6ZSkgKiAxMDApO1xyXG4gICAgICAgIGlmKGZpbGVfZGVsdGFfcGN0IDwgMTApIHtcclxuICAgICAgICAgIC8vIHNraXAgZW1iZWRkaW5nXHJcbiAgICAgICAgICAvLyBjb25zb2xlLmxvZyhcInNraXBwaW5nIGZpbGUgKHNpemUpIFwiICsgY3Vycl9maWxlLnBhdGgpO1xyXG4gICAgICAgICAgdGhpcy5yZW5kZXJfbG9nLnNraXBwZWRfbG93X2RlbHRhW2N1cnJfZmlsZS5uYW1lXSA9IGZpbGVfZGVsdGFfcGN0ICsgXCIlXCI7XHJcbiAgICAgICAgICB0aGlzLnVwZGF0ZV9yZW5kZXJfbG9nKGJsb2NrcywgZmlsZV9lbWJlZF9pbnB1dCk7XHJcbiAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgICBsZXQgbWV0YSA9IHtcclxuICAgICAgbXRpbWU6IGN1cnJfZmlsZS5zdGF0Lm10aW1lLFxyXG4gICAgICBoYXNoOiBmaWxlX2hhc2gsXHJcbiAgICAgIHBhdGg6IGN1cnJfZmlsZS5wYXRoLFxyXG4gICAgICBzaXplOiBjdXJyX2ZpbGUuc3RhdC5zaXplLFxyXG4gICAgICBjaGlsZHJlbjogYmxvY2tzLFxyXG4gICAgfTtcclxuICAgIC8vIGJhdGNoX3Byb21pc2VzLnB1c2godGhpcy5nZXRfZW1iZWRkaW5ncyhjdXJyX2ZpbGVfa2V5LCBmaWxlX2VtYmVkX2lucHV0LCBtZXRhKSk7XHJcbiAgICByZXFfYmF0Y2gucHVzaChbY3Vycl9maWxlX2tleSwgZmlsZV9lbWJlZF9pbnB1dCwgbWV0YV0pO1xyXG4gICAgLy8gc2VuZCBiYXRjaCByZXF1ZXN0XHJcbiAgICBhd2FpdCB0aGlzLmdldF9lbWJlZGRpbmdzX2JhdGNoKHJlcV9iYXRjaCk7XHJcblxyXG4gICAgLy8gbG9nIGVtYmVkZGluZ1xyXG4gICAgLy8gY29uc29sZS5sb2coXCJlbWJlZGRpbmc6IFwiICsgY3Vycl9maWxlLnBhdGgpO1xyXG4gICAgaWYgKHNhdmUpIHtcclxuICAgICAgLy8gd3JpdGUgZW1iZWRkaW5ncyBKU09OIHRvIGZpbGVcclxuICAgICAgYXdhaXQgdGhpcy5zYXZlX2VtYmVkZGluZ3NfdG9fZmlsZSgpO1xyXG4gICAgfVxyXG5cclxuICB9XHJcblxyXG4gIHVwZGF0ZV9yZW5kZXJfbG9nKGJsb2NrcywgZmlsZV9lbWJlZF9pbnB1dCkge1xyXG4gICAgaWYgKGJsb2Nrcy5sZW5ndGggPiAwKSB7XHJcbiAgICAgIC8vIG11bHRpcGx5IGJ5IDIgYmVjYXVzZSBpbXBsaWVzIHdlIHNhdmVkIHRva2VuIHNwZW5kaW5nIG9uIGJsb2NrcyhzZWN0aW9ucyksIHRvb1xyXG4gICAgICB0aGlzLnJlbmRlcl9sb2cudG9rZW5zX3NhdmVkX2J5X2NhY2hlICs9IGZpbGVfZW1iZWRfaW5wdXQubGVuZ3RoIC8gMjtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIC8vIGNhbGMgdG9rZW5zIHNhdmVkIGJ5IGNhY2hlOiBkaXZpZGUgYnkgNCBmb3IgdG9rZW4gZXN0aW1hdGVcclxuICAgICAgdGhpcy5yZW5kZXJfbG9nLnRva2Vuc19zYXZlZF9ieV9jYWNoZSArPSBmaWxlX2VtYmVkX2lucHV0Lmxlbmd0aCAvIDQ7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBhc3luYyBnZXRfZW1iZWRkaW5nc19iYXRjaChyZXFfYmF0Y2gpIHtcclxuICAgIGNvbnNvbGUubG9nKFwiZ2V0X2VtYmVkZGluZ3NfYmF0Y2hcIik7XHJcbiAgICAvLyBpZiByZXFfYmF0Y2ggaXMgZW1wdHkgdGhlbiByZXR1cm5cclxuICAgIGlmKHJlcV9iYXRjaC5sZW5ndGggPT09IDApIHJldHVybjtcclxuICAgIC8vIGNyZWF0ZSBhcnJhcnkgb2YgZW1iZWRfaW5wdXRzIGZyb20gcmVxX2JhdGNoW2ldWzFdXHJcbiAgICBjb25zdCBlbWJlZF9pbnB1dHMgPSByZXFfYmF0Y2gubWFwKChyZXEpID0+IHJlcVsxXSk7XHJcbiAgICAvLyByZXF1ZXN0IGVtYmVkZGluZ3MgZnJvbSBlbWJlZF9pbnB1dHNcclxuICAgIGNvbnN0IHJlcXVlc3RSZXN1bHRzID0gYXdhaXQgdGhpcy5yZXF1ZXN0X2VtYmVkZGluZ19mcm9tX2lucHV0KGVtYmVkX2lucHV0cyk7XHJcbiAgICAvLyBpZiByZXF1ZXN0UmVzdWx0cyBpcyBudWxsIHRoZW4gcmV0dXJuXHJcbiAgICBpZighcmVxdWVzdFJlc3VsdHMpIHtcclxuICAgICAgY29uc29sZS5sb2coXCJmYWlsZWQgZW1iZWRkaW5nIGJhdGNoXCIpO1xyXG4gICAgICAvLyBsb2cgZmFpbGVkIGZpbGUgbmFtZXMgdG8gcmVuZGVyX2xvZ1xyXG4gICAgICB0aGlzLnJlbmRlcl9sb2cuZmFpbGVkX2VtYmVkZGluZ3MgPSBbLi4udGhpcy5yZW5kZXJfbG9nLmZhaWxlZF9lbWJlZGRpbmdzLCAuLi5yZXFfYmF0Y2gubWFwKChyZXEpID0+IHJlcVsyXS5wYXRoKV07XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuICAgIC8vIGlmIHJlcXVlc3RSZXN1bHRzIGlzIG5vdCBudWxsXHJcbiAgICBpZihyZXF1ZXN0UmVzdWx0cyl7XHJcbiAgICAgIHRoaXMuaGFzX25ld19lbWJlZGRpbmdzID0gdHJ1ZTtcclxuICAgICAgLy8gYWRkIGVtYmVkZGluZyBrZXkgdG8gcmVuZGVyX2xvZ1xyXG4gICAgICBpZih0aGlzLnNldHRpbmdzLmxvZ19yZW5kZXIpe1xyXG4gICAgICAgIGlmKHRoaXMuc2V0dGluZ3MubG9nX3JlbmRlcl9maWxlcyl7XHJcbiAgICAgICAgICB0aGlzLnJlbmRlcl9sb2cuZmlsZXMgPSBbLi4udGhpcy5yZW5kZXJfbG9nLmZpbGVzLCAuLi5yZXFfYmF0Y2gubWFwKChyZXEpID0+IHJlcVsyXS5wYXRoKV07XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRoaXMucmVuZGVyX2xvZy5uZXdfZW1iZWRkaW5ncyArPSByZXFfYmF0Y2gubGVuZ3RoO1xyXG4gICAgICAgIC8vIGFkZCB0b2tlbiB1c2FnZSB0byByZW5kZXJfbG9nXHJcbiAgICAgICAgdGhpcy5yZW5kZXJfbG9nLnRva2VuX3VzYWdlICs9IHJlcXVlc3RSZXN1bHRzLnVzYWdlLnRvdGFsX3Rva2VucztcclxuICAgICAgfVxyXG4gICAgICAvLyBjb25zb2xlLmxvZyhyZXF1ZXN0UmVzdWx0cy5kYXRhLmxlbmd0aCk7XHJcbiAgICAgIC8vIGxvb3AgdGhyb3VnaCByZXF1ZXN0UmVzdWx0cy5kYXRhXHJcbiAgICAgIGZvcihsZXQgaSA9IDA7IGkgPCByZXF1ZXN0UmVzdWx0cy5kYXRhLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgY29uc3QgdmVjID0gcmVxdWVzdFJlc3VsdHMuZGF0YVtpXS5lbWJlZGRpbmc7XHJcbiAgICAgICAgY29uc3QgaW5kZXggPSByZXF1ZXN0UmVzdWx0cy5kYXRhW2ldLmluZGV4O1xyXG4gICAgICAgIGlmKHZlYykge1xyXG4gICAgICAgICAgY29uc3Qga2V5ID0gcmVxX2JhdGNoW2luZGV4XVswXTtcclxuICAgICAgICAgIGNvbnN0IG1ldGEgPSByZXFfYmF0Y2hbaW5kZXhdWzJdO1xyXG4gICAgICAgICAgdGhpcy5zbWFydF92ZWNfbGl0ZS5zYXZlX2VtYmVkZGluZyhrZXksIHZlYywgbWV0YSk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBhc3luYyByZXF1ZXN0X2VtYmVkZGluZ19mcm9tX2lucHV0KGVtYmVkX2lucHV0LCByZXRyaWVzID0gMCkge1xyXG4gICAgLy8gKEZPUiBURVNUSU5HKSB0ZXN0IGZhaWwgcHJvY2VzcyBieSBmb3JjaW5nIGZhaWxcclxuICAgIC8vIHJldHVybiBudWxsO1xyXG4gICAgLy8gY2hlY2sgaWYgZW1iZWRfaW5wdXQgaXMgYSBzdHJpbmdcclxuICAgIC8vIGlmKHR5cGVvZiBlbWJlZF9pbnB1dCAhPT0gXCJzdHJpbmdcIikge1xyXG4gICAgLy8gICBjb25zb2xlLmxvZyhcImVtYmVkX2lucHV0IGlzIG5vdCBhIHN0cmluZ1wiKTtcclxuICAgIC8vICAgcmV0dXJuIG51bGw7XHJcbiAgICAvLyB9XHJcbiAgICAvLyBjaGVjayBpZiBlbWJlZF9pbnB1dCBpcyBlbXB0eVxyXG4gICAgaWYoZW1iZWRfaW5wdXQubGVuZ3RoID09PSAwKSB7XHJcbiAgICAgIGNvbnNvbGUubG9nKFwiZW1iZWRfaW5wdXQgaXMgZW1wdHlcIik7XHJcbiAgICAgIHJldHVybiBudWxsO1xyXG4gICAgfVxyXG4gICAgY29uc3QgdXNlZFBhcmFtcyA9IHtcclxuICAgICAgbW9kZWw6IFwidGV4dC1lbWJlZGRpbmctYWRhLTAwMlwiLFxyXG4gICAgICBpbnB1dDogZW1iZWRfaW5wdXQsXHJcbiAgICB9O1xyXG4gICAgLy8gY29uc29sZS5sb2codGhpcy5zZXR0aW5ncy5hcGlfa2V5KTtcclxuICAgIGNvbnN0IHJlcVBhcmFtcyA9IHtcclxuICAgICAgdXJsOiBgaHR0cHM6Ly9hcGkub3BlbmFpLmNvbS92MS9lbWJlZGRpbmdzYCxcclxuICAgICAgbWV0aG9kOiBcIlBPU1RcIixcclxuICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkodXNlZFBhcmFtcyksXHJcbiAgICAgIGhlYWRlcnM6IHtcclxuICAgICAgICBcIkNvbnRlbnQtVHlwZVwiOiBcImFwcGxpY2F0aW9uL2pzb25cIixcclxuICAgICAgICBcIkF1dGhvcml6YXRpb25cIjogYEJlYXJlciAke3RoaXMuc2V0dGluZ3MuYXBpX2tleX1gXHJcbiAgICAgIH1cclxuICAgIH07XHJcbiAgICBsZXQgcmVzcDtcclxuICAgIHRyeSB7XHJcbiAgICAgIHJlc3AgPSBhd2FpdCAoMCwgT2JzaWRpYW4ucmVxdWVzdCkocmVxUGFyYW1zKVxyXG4gICAgICByZXR1cm4gSlNPTi5wYXJzZShyZXNwKTtcclxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgIC8vIHJldHJ5IHJlcXVlc3QgaWYgZXJyb3IgaXMgNDI5XHJcbiAgICAgIGlmKChlcnJvci5zdGF0dXMgPT09IDQyOSkgJiYgKHJldHJpZXMgPCAzKSkge1xyXG4gICAgICAgIHJldHJpZXMrKztcclxuICAgICAgICAvLyBleHBvbmVudGlhbCBiYWNrb2ZmXHJcbiAgICAgICAgY29uc3QgYmFja29mZiA9IE1hdGgucG93KHJldHJpZXMsIDIpO1xyXG4gICAgICAgIGNvbnNvbGUubG9nKGByZXRyeWluZyByZXF1ZXN0ICg0MjkpIGluICR7YmFja29mZn0gc2Vjb25kcy4uLmApO1xyXG4gICAgICAgIGF3YWl0IG5ldyBQcm9taXNlKHIgPT4gc2V0VGltZW91dChyLCAxMDAwICogYmFja29mZikpO1xyXG4gICAgICAgIHJldHVybiBhd2FpdCB0aGlzLnJlcXVlc3RfZW1iZWRkaW5nX2Zyb21faW5wdXQoZW1iZWRfaW5wdXQsIHJldHJpZXMpO1xyXG4gICAgICB9XHJcbiAgICAgIC8vIGxvZyBmdWxsIGVycm9yIHRvIGNvbnNvbGVcclxuICAgICAgY29uc29sZS5sb2cocmVzcCk7XHJcbiAgICAgIC8vIGNvbnNvbGUubG9nKFwiZmlyc3QgbGluZSBvZiBlbWJlZDogXCIgKyBlbWJlZF9pbnB1dC5zdWJzdHJpbmcoMCwgZW1iZWRfaW5wdXQuaW5kZXhPZihcIlxcblwiKSkpO1xyXG4gICAgICAvLyBjb25zb2xlLmxvZyhcImVtYmVkIGlucHV0IGxlbmd0aDogXCIrIGVtYmVkX2lucHV0Lmxlbmd0aCk7XHJcbiAgICAgIC8vIGlmKEFycmF5LmlzQXJyYXkoZW1iZWRfaW5wdXQpKSB7XHJcbiAgICAgIC8vICAgY29uc29sZS5sb2coZW1iZWRfaW5wdXQubWFwKChpbnB1dCkgPT4gaW5wdXQubGVuZ3RoKSk7XHJcbiAgICAgIC8vIH1cclxuICAgICAgLy8gY29uc29sZS5sb2coXCJlcnJvbmVvdXMgZW1iZWQgaW5wdXQ6IFwiICsgZW1iZWRfaW5wdXQpO1xyXG4gICAgICBjb25zb2xlLmxvZyhlcnJvcik7XHJcbiAgICAgIC8vIGNvbnNvbGUubG9nKHVzZWRQYXJhbXMpO1xyXG4gICAgICAvLyBjb25zb2xlLmxvZyh1c2VkUGFyYW1zLmlucHV0Lmxlbmd0aCk7XHJcbiAgICAgIHJldHVybiBudWxsO1xyXG4gICAgfVxyXG4gIH1cclxuICBhc3luYyB0ZXN0X2FwaV9rZXkoKSB7XHJcbiAgICBjb25zdCBlbWJlZF9pbnB1dCA9IFwiVGhpcyBpcyBhIHRlc3Qgb2YgdGhlIE9wZW5BSSBBUEkuXCI7XHJcbiAgICBjb25zdCByZXNwID0gYXdhaXQgdGhpcy5yZXF1ZXN0X2VtYmVkZGluZ19mcm9tX2lucHV0KGVtYmVkX2lucHV0KTtcclxuICAgIGlmKHJlc3AgJiYgcmVzcC51c2FnZSkge1xyXG4gICAgICBjb25zb2xlLmxvZyhcIkFQSSBrZXkgaXMgdmFsaWRcIik7XHJcbiAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgfWVsc2V7XHJcbiAgICAgIGNvbnNvbGUubG9nKFwiQVBJIGtleSBpcyBpbnZhbGlkXCIpO1xyXG4gICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuXHJcbiAgb3V0cHV0X3JlbmRlcl9sb2coKSB7XHJcbiAgICAvLyBpZiBzZXR0aW5ncy5sb2dfcmVuZGVyIGlzIHRydWVcclxuICAgIGlmKHRoaXMuc2V0dGluZ3MubG9nX3JlbmRlcikge1xyXG4gICAgICBpZiAodGhpcy5yZW5kZXJfbG9nLm5ld19lbWJlZGRpbmdzID09PSAwKSB7XHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgICB9ZWxzZXtcclxuICAgICAgICAvLyBwcmV0dHkgcHJpbnQgdGhpcy5yZW5kZXJfbG9nIHRvIGNvbnNvbGVcclxuICAgICAgICBjb25zb2xlLmxvZyhKU09OLnN0cmluZ2lmeSh0aGlzLnJlbmRlcl9sb2csIG51bGwsIDIpKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8vIGNsZWFyIHJlbmRlcl9sb2dcclxuICAgIHRoaXMucmVuZGVyX2xvZyA9IHt9O1xyXG4gICAgdGhpcy5yZW5kZXJfbG9nLmRlbGV0ZWRfZW1iZWRkaW5ncyA9IDA7XHJcbiAgICB0aGlzLnJlbmRlcl9sb2cuZXhjbHVzaW9uc19sb2dzID0ge307XHJcbiAgICB0aGlzLnJlbmRlcl9sb2cuZmFpbGVkX2VtYmVkZGluZ3MgPSBbXTtcclxuICAgIHRoaXMucmVuZGVyX2xvZy5maWxlcyA9IFtdO1xyXG4gICAgdGhpcy5yZW5kZXJfbG9nLm5ld19lbWJlZGRpbmdzID0gMDtcclxuICAgIHRoaXMucmVuZGVyX2xvZy5za2lwcGVkX2xvd19kZWx0YSA9IHt9O1xyXG4gICAgdGhpcy5yZW5kZXJfbG9nLnRva2VuX3VzYWdlID0gMDtcclxuICAgIHRoaXMucmVuZGVyX2xvZy50b2tlbnNfc2F2ZWRfYnlfY2FjaGUgPSAwO1xyXG4gIH1cclxuXHJcbiAgLy8gZmluZCBjb25uZWN0aW9ucyBieSBtb3N0IHNpbWlsYXIgdG8gY3VycmVudCBub3RlIGJ5IGNvc2luZSBzaW1pbGFyaXR5XHJcbiAgYXN5bmMgZmluZF9ub3RlX2Nvbm5lY3Rpb25zKGN1cnJlbnRfbm90ZT1udWxsKSB7XHJcbiAgICAvLyBtZDUgb2YgY3VycmVudCBub3RlIHBhdGhcclxuICAgIGNvbnN0IGN1cnJfa2V5ID0gbWQ1KGN1cnJlbnRfbm90ZS5wYXRoKTtcclxuICAgIC8vIGlmIGluIHRoaXMubmVhcmVzdF9jYWNoZSB0aGVuIHNldCB0byBuZWFyZXN0XHJcbiAgICAvLyBlbHNlIGdldCBuZWFyZXN0XHJcbiAgICBsZXQgbmVhcmVzdCA9IFtdO1xyXG4gICAgaWYodGhpcy5uZWFyZXN0X2NhY2hlW2N1cnJfa2V5XSkge1xyXG4gICAgICBuZWFyZXN0ID0gdGhpcy5uZWFyZXN0X2NhY2hlW2N1cnJfa2V5XTtcclxuICAgICAgLy8gY29uc29sZS5sb2coXCJuZWFyZXN0IGZyb20gY2FjaGVcIik7XHJcbiAgICB9ZWxzZXtcclxuICAgICAgLy8gc2tpcCBmaWxlcyB3aGVyZSBwYXRoIGNvbnRhaW5zIGFueSBleGNsdXNpb25zXHJcbiAgICAgIGZvcihsZXQgaiA9IDA7IGogPCB0aGlzLmZpbGVfZXhjbHVzaW9ucy5sZW5ndGg7IGorKykge1xyXG4gICAgICAgIGlmKGN1cnJlbnRfbm90ZS5wYXRoLmluZGV4T2YodGhpcy5maWxlX2V4Y2x1c2lvbnNbal0pID4gLTEpIHtcclxuICAgICAgICAgIHRoaXMubG9nX2V4Y2x1c2lvbih0aGlzLmZpbGVfZXhjbHVzaW9uc1tqXSk7XHJcbiAgICAgICAgICAvLyBicmVhayBvdXQgb2YgbG9vcCBhbmQgZmluaXNoIGhlcmVcclxuICAgICAgICAgIHJldHVybiBcImV4Y2x1ZGVkXCI7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICAgIC8vIGdldCBhbGwgZW1iZWRkaW5nc1xyXG4gICAgICAvLyBhd2FpdCB0aGlzLmdldF9hbGxfZW1iZWRkaW5ncygpO1xyXG4gICAgICAvLyB3cmFwIGdldCBhbGwgaW4gc2V0VGltZW91dCB0byBhbGxvdyBmb3IgVUkgdG8gdXBkYXRlXHJcbiAgICAgIHNldFRpbWVvdXQoKCkgPT4ge1xyXG4gICAgICAgIHRoaXMuZ2V0X2FsbF9lbWJlZGRpbmdzKClcclxuICAgICAgfSwgMzAwMCk7XHJcbiAgICAgIC8vIGdldCBmcm9tIGNhY2hlIGlmIG10aW1lIGlzIHNhbWUgYW5kIHZhbHVlcyBhcmUgbm90IGVtcHR5XHJcbiAgICAgIGlmKHRoaXMuc21hcnRfdmVjX2xpdGUubXRpbWVfaXNfY3VycmVudChjdXJyX2tleSwgY3VycmVudF9ub3RlLnN0YXQubXRpbWUpKSB7XHJcbiAgICAgICAgLy8gc2tpcHBpbmcgZ2V0IGZpbGUgZW1iZWRkaW5ncyBiZWNhdXNlIG5vdGhpbmcgaGFzIGNoYW5nZWRcclxuICAgICAgICAvLyBjb25zb2xlLmxvZyhcImZpbmRfbm90ZV9jb25uZWN0aW9ucyAtIHNraXBwaW5nIGZpbGUgKG10aW1lKVwiKTtcclxuICAgICAgfWVsc2V7XHJcbiAgICAgICAgLy8gZ2V0IGZpbGUgZW1iZWRkaW5nc1xyXG4gICAgICAgIGF3YWl0IHRoaXMuZ2V0X2ZpbGVfZW1iZWRkaW5ncyhjdXJyZW50X25vdGUpO1xyXG4gICAgICB9XHJcbiAgICAgIC8vIGdldCBjdXJyZW50IG5vdGUgZW1iZWRkaW5nIHZlY3RvclxyXG4gICAgICBjb25zdCB2ZWMgPSB0aGlzLnNtYXJ0X3ZlY19saXRlLmdldF92ZWMoY3Vycl9rZXkpO1xyXG4gICAgICBpZighdmVjKSB7XHJcbiAgICAgICAgcmV0dXJuIFwiRXJyb3IgZ2V0dGluZyBlbWJlZGRpbmdzIGZvcjogXCIrY3VycmVudF9ub3RlLnBhdGg7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIC8vIGNvbXB1dGUgY29zaW5lIHNpbWlsYXJpdHkgYmV0d2VlbiBjdXJyZW50IG5vdGUgYW5kIGFsbCBvdGhlciBub3RlcyB2aWEgZW1iZWRkaW5nc1xyXG4gICAgICBuZWFyZXN0ID0gdGhpcy5zbWFydF92ZWNfbGl0ZS5uZWFyZXN0KHZlYywge1xyXG4gICAgICAgIHNraXBfa2V5OiBjdXJyX2tleSxcclxuICAgICAgICBza2lwX3NlY3Rpb25zOiB0aGlzLnNldHRpbmdzLnNraXBfc2VjdGlvbnMsXHJcbiAgICAgIH0pO1xyXG5cclxuICAgICAgLy8gc2F2ZSB0byB0aGlzLm5lYXJlc3RfY2FjaGVcclxuICAgICAgdGhpcy5uZWFyZXN0X2NhY2hlW2N1cnJfa2V5XSA9IG5lYXJlc3Q7XHJcbiAgICB9XHJcblxyXG4gICAgLy8gcmV0dXJuIGFycmF5IHNvcnRlZCBieSBjb3NpbmUgc2ltaWxhcml0eVxyXG4gICAgcmV0dXJuIG5lYXJlc3Q7XHJcbiAgfVxyXG5cclxuICAvLyBjcmVhdGUgcmVuZGVyX2xvZyBvYmplY3Qgb2YgZXhsdXNpb25zIHdpdGggbnVtYmVyIG9mIHRpbWVzIHNraXBwZWQgYXMgdmFsdWVcclxuICBsb2dfZXhjbHVzaW9uKGV4Y2x1c2lvbikge1xyXG4gICAgLy8gaW5jcmVtZW50IHJlbmRlcl9sb2cgZm9yIHNraXBwZWQgZmlsZVxyXG4gICAgdGhpcy5yZW5kZXJfbG9nLmV4Y2x1c2lvbnNfbG9nc1tleGNsdXNpb25dID0gKHRoaXMucmVuZGVyX2xvZy5leGNsdXNpb25zX2xvZ3NbZXhjbHVzaW9uXSB8fCAwKSArIDE7XHJcbiAgfVxyXG5cclxuXHJcbiAgYmxvY2tfcGFyc2VyKG1hcmtkb3duLCBmaWxlX3BhdGgpe1xyXG4gICAgLy8gaWYgdGhpcy5zZXR0aW5ncy5za2lwX3NlY3Rpb25zIGlzIHRydWUgdGhlbiByZXR1cm4gZW1wdHkgYXJyYXlcclxuICAgIGlmKHRoaXMuc2V0dGluZ3Muc2tpcF9zZWN0aW9ucykge1xyXG4gICAgICByZXR1cm4gW107XHJcbiAgICB9XHJcbiAgICAvLyBzcGxpdCB0aGUgbWFya2Rvd24gaW50byBsaW5lc1xyXG4gICAgY29uc3QgbGluZXMgPSBtYXJrZG93bi5zcGxpdCgnXFxuJyk7XHJcbiAgICAvLyBpbml0aWFsaXplIHRoZSBibG9ja3MgYXJyYXlcclxuICAgIGxldCBibG9ja3MgPSBbXTtcclxuICAgIC8vIGN1cnJlbnQgaGVhZGVycyBhcnJheVxyXG4gICAgbGV0IGN1cnJlbnRIZWFkZXJzID0gW107XHJcbiAgICAvLyByZW1vdmUgLm1kIGZpbGUgZXh0ZW5zaW9uIGFuZCBjb252ZXJ0IGZpbGVfcGF0aCB0byBicmVhZGNydW1iIGZvcm1hdHRpbmdcclxuICAgIGNvbnN0IGZpbGVfYnJlYWRjcnVtYnMgPSBmaWxlX3BhdGgucmVwbGFjZSgnLm1kJywgJycpLnJlcGxhY2UoL1xcLy9nLCAnID4gJyk7XHJcbiAgICAvLyBpbml0aWFsaXplIHRoZSBibG9jayBzdHJpbmdcclxuICAgIGxldCBibG9jayA9ICcnO1xyXG4gICAgbGV0IGJsb2NrX2hlYWRpbmdzID0gJyc7XHJcbiAgICBsZXQgYmxvY2tfcGF0aCA9IGZpbGVfcGF0aDtcclxuXHJcbiAgICBsZXQgbGFzdF9oZWFkaW5nX2xpbmUgPSAwO1xyXG4gICAgbGV0IGkgPSAwO1xyXG4gICAgbGV0IGJsb2NrX2hlYWRpbmdzX2xpc3QgPSBbXTtcclxuICAgIC8vIGxvb3AgdGhyb3VnaCB0aGUgbGluZXNcclxuICAgIGZvciAoaSA9IDA7IGkgPCBsaW5lcy5sZW5ndGg7IGkrKykge1xyXG4gICAgICAvLyBnZXQgdGhlIGxpbmVcclxuICAgICAgY29uc3QgbGluZSA9IGxpbmVzW2ldO1xyXG4gICAgICAvLyBpZiBsaW5lIGRvZXMgbm90IHN0YXJ0IHdpdGggI1xyXG4gICAgICAvLyBvciBpZiBsaW5lIHN0YXJ0cyB3aXRoICMgYW5kIHNlY29uZCBjaGFyYWN0ZXIgaXMgYSB3b3JkIG9yIG51bWJlciBpbmRpY2F0aW5nIGEgXCJ0YWdcIlxyXG4gICAgICAvLyB0aGVuIGFkZCB0byBibG9ja1xyXG4gICAgICBpZiAoIWxpbmUuc3RhcnRzV2l0aCgnIycpIHx8IChbJyMnLCcgJ10uaW5kZXhPZihsaW5lWzFdKSA8IDApKXtcclxuICAgICAgICAvLyBza2lwIGlmIGxpbmUgaXMgZW1wdHlcclxuICAgICAgICBpZihsaW5lID09PSAnJykgY29udGludWU7XHJcbiAgICAgICAgLy8gc2tpcCBpZiBsaW5lIGlzIGVtcHR5IGJ1bGxldCBvciBjaGVja2JveFxyXG4gICAgICAgIGlmKFsnLSAnLCAnLSBbIF0gJ10uaW5kZXhPZihsaW5lKSA+IC0xKSBjb250aW51ZTtcclxuICAgICAgICAvLyBpZiBjdXJyZW50SGVhZGVycyBpcyBlbXB0eSBza2lwIChvbmx5IGJsb2NrcyB3aXRoIGhlYWRlcnMsIG90aGVyd2lzZSBibG9jay5wYXRoIGNvbmZsaWN0cyB3aXRoIGZpbGUucGF0aClcclxuICAgICAgICBpZihjdXJyZW50SGVhZGVycy5sZW5ndGggPT09IDApIGNvbnRpbnVlO1xyXG4gICAgICAgIC8vIGFkZCBsaW5lIHRvIGJsb2NrXHJcbiAgICAgICAgYmxvY2sgKz0gXCJcXG5cIiArIGxpbmU7XHJcbiAgICAgICAgY29udGludWU7XHJcbiAgICAgIH1cclxuICAgICAgLyoqXHJcbiAgICAgICAqIEJFR0lOIEhlYWRpbmcgcGFyc2luZ1xyXG4gICAgICAgKiAtIGxpa2VseSBhIGhlYWRpbmcgaWYgbWFkZSBpdCB0aGlzIGZhclxyXG4gICAgICAgKi9cclxuICAgICAgbGFzdF9oZWFkaW5nX2xpbmUgPSBpO1xyXG4gICAgICAvLyBwdXNoIHRoZSBjdXJyZW50IGJsb2NrIHRvIHRoZSBibG9ja3MgYXJyYXkgdW5sZXNzIGxhc3QgbGluZSB3YXMgYSBhbHNvIGEgaGVhZGVyXHJcbiAgICAgIGlmKGkgPiAwICYmIChsYXN0X2hlYWRpbmdfbGluZSAhPT0gKGktMSkpICYmIChibG9jay5pbmRleE9mKFwiXFxuXCIpID4gLTEpICYmIHRoaXMudmFsaWRhdGVfaGVhZGluZ3MoYmxvY2tfaGVhZGluZ3MpKSB7XHJcbiAgICAgICAgb3V0cHV0X2Jsb2NrKCk7XHJcbiAgICAgIH1cclxuICAgICAgLy8gZ2V0IHRoZSBoZWFkZXIgbGV2ZWxcclxuICAgICAgY29uc3QgbGV2ZWwgPSBsaW5lLnNwbGl0KCcjJykubGVuZ3RoIC0gMTtcclxuICAgICAgLy8gcmVtb3ZlIGFueSBoZWFkZXJzIGZyb20gdGhlIGN1cnJlbnQgaGVhZGVycyBhcnJheSB0aGF0IGFyZSBoaWdoZXIgdGhhbiB0aGUgY3VycmVudCBoZWFkZXIgbGV2ZWxcclxuICAgICAgY3VycmVudEhlYWRlcnMgPSBjdXJyZW50SGVhZGVycy5maWx0ZXIoaGVhZGVyID0+IGhlYWRlci5sZXZlbCA8IGxldmVsKTtcclxuICAgICAgLy8gYWRkIGhlYWRlciBhbmQgbGV2ZWwgdG8gY3VycmVudCBoZWFkZXJzIGFycmF5XHJcbiAgICAgIC8vIHRyaW0gdGhlIGhlYWRlciB0byByZW1vdmUgXCIjXCIgYW5kIGFueSB0cmFpbGluZyBzcGFjZXNcclxuICAgICAgY3VycmVudEhlYWRlcnMucHVzaCh7aGVhZGVyOiBsaW5lLnJlcGxhY2UoLyMvZywgJycpLnRyaW0oKSwgbGV2ZWw6IGxldmVsfSk7XHJcbiAgICAgIC8vIGluaXRpYWxpemUgdGhlIGJsb2NrIGJyZWFkY3J1bWJzIHdpdGggZmlsZS5wYXRoIHRoZSBjdXJyZW50IGhlYWRlcnNcclxuICAgICAgYmxvY2sgPSBmaWxlX2JyZWFkY3J1bWJzO1xyXG4gICAgICBibG9jayArPSBcIjogXCIgKyBjdXJyZW50SGVhZGVycy5tYXAoaGVhZGVyID0+IGhlYWRlci5oZWFkZXIpLmpvaW4oJyA+ICcpO1xyXG4gICAgICBibG9ja19oZWFkaW5ncyA9IFwiI1wiK2N1cnJlbnRIZWFkZXJzLm1hcChoZWFkZXIgPT4gaGVhZGVyLmhlYWRlcikuam9pbignIycpO1xyXG4gICAgICAvLyBpZiBibG9ja19oZWFkaW5ncyBpcyBhbHJlYWR5IGluIGJsb2NrX2hlYWRpbmdzX2xpc3QgdGhlbiBhZGQgYSBudW1iZXIgdG8gdGhlIGVuZFxyXG4gICAgICBpZihibG9ja19oZWFkaW5nc19saXN0LmluZGV4T2YoYmxvY2tfaGVhZGluZ3MpID4gLTEpIHtcclxuICAgICAgICBsZXQgY291bnQgPSAxO1xyXG4gICAgICAgIHdoaWxlKGJsb2NrX2hlYWRpbmdzX2xpc3QuaW5kZXhPZihgJHtibG9ja19oZWFkaW5nc317JHtjb3VudH19YCkgPiAtMSkge1xyXG4gICAgICAgICAgY291bnQrKztcclxuICAgICAgICB9XHJcbiAgICAgICAgYmxvY2tfaGVhZGluZ3MgPSBgJHtibG9ja19oZWFkaW5nc317JHtjb3VudH19YDtcclxuICAgICAgfVxyXG4gICAgICBibG9ja19oZWFkaW5nc19saXN0LnB1c2goYmxvY2tfaGVhZGluZ3MpO1xyXG4gICAgICBibG9ja19wYXRoID0gZmlsZV9wYXRoICsgYmxvY2tfaGVhZGluZ3M7XHJcbiAgICB9XHJcbiAgICAvLyBoYW5kbGUgcmVtYWluaW5nIGFmdGVyIGxvb3BcclxuICAgIGlmKChsYXN0X2hlYWRpbmdfbGluZSAhPT0gKGktMSkpICYmIChibG9jay5pbmRleE9mKFwiXFxuXCIpID4gLTEpICYmIHRoaXMudmFsaWRhdGVfaGVhZGluZ3MoYmxvY2tfaGVhZGluZ3MpKSBvdXRwdXRfYmxvY2soKTtcclxuICAgIC8vIHJlbW92ZSBhbnkgYmxvY2tzIHRoYXQgYXJlIHRvbyBzaG9ydCAobGVuZ3RoIDwgNTApXHJcbiAgICBibG9ja3MgPSBibG9ja3MuZmlsdGVyKGIgPT4gYi5sZW5ndGggPiA1MCk7XHJcbiAgICAvLyBjb25zb2xlLmxvZyhibG9ja3MpO1xyXG4gICAgLy8gcmV0dXJuIHRoZSBibG9ja3MgYXJyYXlcclxuICAgIHJldHVybiBibG9ja3M7XHJcblxyXG4gICAgZnVuY3Rpb24gb3V0cHV0X2Jsb2NrKCkge1xyXG4gICAgICAvLyBicmVhZGNydW1icyBsZW5ndGggKGZpcnN0IGxpbmUgb2YgYmxvY2spXHJcbiAgICAgIGNvbnN0IGJyZWFkY3J1bWJzX2xlbmd0aCA9IGJsb2NrLmluZGV4T2YoXCJcXG5cIikgKyAxO1xyXG4gICAgICBjb25zdCBibG9ja19sZW5ndGggPSBibG9jay5sZW5ndGggLSBicmVhZGNydW1ic19sZW5ndGg7XHJcbiAgICAgIC8vIHRyaW0gYmxvY2sgdG8gbWF4IGxlbmd0aFxyXG4gICAgICBpZiAoYmxvY2subGVuZ3RoID4gTUFYX0VNQkVEX1NUUklOR19MRU5HVEgpIHtcclxuICAgICAgICBibG9jayA9IGJsb2NrLnN1YnN0cmluZygwLCBNQVhfRU1CRURfU1RSSU5HX0xFTkdUSCk7XHJcbiAgICAgIH1cclxuICAgICAgYmxvY2tzLnB1c2goeyB0ZXh0OiBibG9jay50cmltKCksIHBhdGg6IGJsb2NrX3BhdGgsIGxlbmd0aDogYmxvY2tfbGVuZ3RoIH0pO1xyXG4gICAgfVxyXG4gIH1cclxuICAvLyByZXZlcnNlLXJldHJpZXZlIGJsb2NrIGdpdmVuIHBhdGhcclxuICBhc3luYyBibG9ja19yZXRyaWV2ZXIocGF0aCwgbGltaXRzPXt9KSB7XHJcbiAgICBsaW1pdHMgPSB7XHJcbiAgICAgIGxpbmVzOiBudWxsLFxyXG4gICAgICBjaGFyc19wZXJfbGluZTogbnVsbCxcclxuICAgICAgbWF4X2NoYXJzOiBudWxsLFxyXG4gICAgICAuLi5saW1pdHNcclxuICAgIH1cclxuICAgIC8vIHJldHVybiBpZiBubyAjIGluIHBhdGhcclxuICAgIGlmIChwYXRoLmluZGV4T2YoJyMnKSA8IDApIHtcclxuICAgICAgY29uc29sZS5sb2coXCJub3QgYSBibG9jayBwYXRoOiBcIitwYXRoKTtcclxuICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgfVxyXG4gICAgbGV0IGJsb2NrID0gW107XHJcbiAgICBsZXQgYmxvY2tfaGVhZGluZ3MgPSBwYXRoLnNwbGl0KCcjJykuc2xpY2UoMSk7XHJcbiAgICAvLyBpZiBwYXRoIGVuZHMgd2l0aCBudW1iZXIgaW4gY3VybHkgYnJhY2VzXHJcbiAgICBsZXQgaGVhZGluZ19vY2N1cnJlbmNlID0gMDtcclxuICAgIGlmKGJsb2NrX2hlYWRpbmdzW2Jsb2NrX2hlYWRpbmdzLmxlbmd0aC0xXS5pbmRleE9mKCd7JykgPiAtMSkge1xyXG4gICAgICAvLyBnZXQgdGhlIG9jY3VycmVuY2UgbnVtYmVyXHJcbiAgICAgIGhlYWRpbmdfb2NjdXJyZW5jZSA9IHBhcnNlSW50KGJsb2NrX2hlYWRpbmdzW2Jsb2NrX2hlYWRpbmdzLmxlbmd0aC0xXS5zcGxpdCgneycpWzFdLnJlcGxhY2UoJ30nLCAnJykpO1xyXG4gICAgICAvLyByZW1vdmUgdGhlIG9jY3VycmVuY2UgZnJvbSB0aGUgbGFzdCBoZWFkaW5nXHJcbiAgICAgIGJsb2NrX2hlYWRpbmdzW2Jsb2NrX2hlYWRpbmdzLmxlbmd0aC0xXSA9IGJsb2NrX2hlYWRpbmdzW2Jsb2NrX2hlYWRpbmdzLmxlbmd0aC0xXS5zcGxpdCgneycpWzBdO1xyXG4gICAgfVxyXG4gICAgbGV0IGN1cnJlbnRIZWFkZXJzID0gW107XHJcbiAgICBsZXQgb2NjdXJyZW5jZV9jb3VudCA9IDA7XHJcbiAgICBsZXQgYmVnaW5fbGluZSA9IDA7XHJcbiAgICBsZXQgaSA9IDA7XHJcbiAgICAvLyBnZXQgZmlsZSBwYXRoIGZyb20gcGF0aFxyXG4gICAgY29uc3QgZmlsZV9wYXRoID0gcGF0aC5zcGxpdCgnIycpWzBdO1xyXG4gICAgLy8gZ2V0IGZpbGVcclxuICAgIGNvbnN0IGZpbGUgPSB0aGlzLmFwcC52YXVsdC5nZXRBYnN0cmFjdEZpbGVCeVBhdGgoZmlsZV9wYXRoKTtcclxuICAgIGlmKCEoZmlsZSBpbnN0YW5jZW9mIE9ic2lkaWFuLlRGaWxlKSkge1xyXG4gICAgICBjb25zb2xlLmxvZyhcIm5vdCBhIGZpbGU6IFwiK2ZpbGVfcGF0aCk7XHJcbiAgICAgIHJldHVybiBmYWxzZTtcclxuICAgIH1cclxuICAgIC8vIGdldCBmaWxlIGNvbnRlbnRzXHJcbiAgICBjb25zdCBmaWxlX2NvbnRlbnRzID0gYXdhaXQgdGhpcy5hcHAudmF1bHQuY2FjaGVkUmVhZChmaWxlKTtcclxuICAgIC8vIHNwbGl0IHRoZSBmaWxlIGNvbnRlbnRzIGludG8gbGluZXNcclxuICAgIGNvbnN0IGxpbmVzID0gZmlsZV9jb250ZW50cy5zcGxpdCgnXFxuJyk7XHJcbiAgICAvLyBsb29wIHRocm91Z2ggdGhlIGxpbmVzXHJcbiAgICBsZXQgaXNfY29kZSA9IGZhbHNlO1xyXG4gICAgZm9yIChpID0gMDsgaSA8IGxpbmVzLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgIC8vIGdldCB0aGUgbGluZVxyXG4gICAgICBjb25zdCBsaW5lID0gbGluZXNbaV07XHJcbiAgICAgIC8vIGlmIGxpbmUgYmVnaW5zIHdpdGggdGhyZWUgYmFja3RpY2tzIHRoZW4gdG9nZ2xlIGlzX2NvZGVcclxuICAgICAgaWYobGluZS5pbmRleE9mKCdgYGAnKSA9PT0gMCkge1xyXG4gICAgICAgIGlzX2NvZGUgPSAhaXNfY29kZTtcclxuICAgICAgfVxyXG4gICAgICAvLyBpZiBpc19jb2RlIGlzIHRydWUgdGhlbiBhZGQgbGluZSB3aXRoIHByZWNlZGluZyB0YWIgYW5kIGNvbnRpbnVlXHJcbiAgICAgIGlmKGlzX2NvZGUpIHtcclxuICAgICAgICBjb250aW51ZTtcclxuICAgICAgfVxyXG4gICAgICAvLyBza2lwIGlmIGxpbmUgaXMgZW1wdHkgYnVsbGV0IG9yIGNoZWNrYm94XHJcbiAgICAgIGlmKFsnLSAnLCAnLSBbIF0gJ10uaW5kZXhPZihsaW5lKSA+IC0xKSBjb250aW51ZTtcclxuICAgICAgLy8gaWYgbGluZSBkb2VzIG5vdCBzdGFydCB3aXRoICNcclxuICAgICAgLy8gb3IgaWYgbGluZSBzdGFydHMgd2l0aCAjIGFuZCBzZWNvbmQgY2hhcmFjdGVyIGlzIGEgd29yZCBvciBudW1iZXIgaW5kaWNhdGluZyBhIFwidGFnXCJcclxuICAgICAgLy8gdGhlbiBjb250aW51ZSB0byBuZXh0IGxpbmVcclxuICAgICAgaWYgKCFsaW5lLnN0YXJ0c1dpdGgoJyMnKSB8fCAoWycjJywnICddLmluZGV4T2YobGluZVsxXSkgPCAwKSl7XHJcbiAgICAgICAgY29udGludWU7XHJcbiAgICAgIH1cclxuICAgICAgLyoqXHJcbiAgICAgICAqIEJFR0lOIEhlYWRpbmcgcGFyc2luZ1xyXG4gICAgICAgKiAtIGxpa2VseSBhIGhlYWRpbmcgaWYgbWFkZSBpdCB0aGlzIGZhclxyXG4gICAgICAgKi9cclxuICAgICAgLy8gZ2V0IHRoZSBoZWFkaW5nIHRleHRcclxuICAgICAgY29uc3QgaGVhZGluZ190ZXh0ID0gbGluZS5yZXBsYWNlKC8jL2csICcnKS50cmltKCk7XHJcbiAgICAgIC8vIGNvbnRpbnVlIGlmIGhlYWRpbmcgdGV4dCBpcyBub3QgaW4gYmxvY2tfaGVhZGluZ3NcclxuICAgICAgY29uc3QgaGVhZGluZ19pbmRleCA9IGJsb2NrX2hlYWRpbmdzLmluZGV4T2YoaGVhZGluZ190ZXh0KTtcclxuICAgICAgaWYgKGhlYWRpbmdfaW5kZXggPCAwKSBjb250aW51ZTtcclxuICAgICAgLy8gaWYgY3VycmVudEhlYWRlcnMubGVuZ3RoICE9PSBoZWFkaW5nX2luZGV4IHRoZW4gd2UgaGF2ZSBhIG1pc21hdGNoXHJcbiAgICAgIGlmIChjdXJyZW50SGVhZGVycy5sZW5ndGggIT09IGhlYWRpbmdfaW5kZXgpIGNvbnRpbnVlO1xyXG4gICAgICAvLyBwdXNoIHRoZSBoZWFkaW5nIHRleHQgdG8gdGhlIGN1cnJlbnRIZWFkZXJzIGFycmF5XHJcbiAgICAgIGN1cnJlbnRIZWFkZXJzLnB1c2goaGVhZGluZ190ZXh0KTtcclxuICAgICAgLy8gaWYgY3VycmVudEhlYWRlcnMubGVuZ3RoID09PSBibG9ja19oZWFkaW5ncy5sZW5ndGggdGhlbiB3ZSBoYXZlIGEgbWF0Y2hcclxuICAgICAgaWYgKGN1cnJlbnRIZWFkZXJzLmxlbmd0aCA9PT0gYmxvY2tfaGVhZGluZ3MubGVuZ3RoKSB7XHJcbiAgICAgICAgLy8gaWYgaGVhZGluZ19vY2N1cnJlbmNlIGlzIGRlZmluZWQgdGhlbiBpbmNyZW1lbnQgb2NjdXJyZW5jZV9jb3VudFxyXG4gICAgICAgIGlmKGhlYWRpbmdfb2NjdXJyZW5jZSA9PT0gMCkge1xyXG4gICAgICAgICAgLy8gc2V0IGJlZ2luX2xpbmUgdG8gaSArIDFcclxuICAgICAgICAgIGJlZ2luX2xpbmUgPSBpICsgMTtcclxuICAgICAgICAgIGJyZWFrOyAvLyBicmVhayBvdXQgb2YgbG9vcFxyXG4gICAgICAgIH1cclxuICAgICAgICAvLyBpZiBvY2N1cnJlbmNlX2NvdW50ICE9PSBoZWFkaW5nX29jY3VycmVuY2UgdGhlbiBjb250aW51ZVxyXG4gICAgICAgIGlmKG9jY3VycmVuY2VfY291bnQgPT09IGhlYWRpbmdfb2NjdXJyZW5jZSl7XHJcbiAgICAgICAgICBiZWdpbl9saW5lID0gaSArIDE7XHJcbiAgICAgICAgICBicmVhazsgLy8gYnJlYWsgb3V0IG9mIGxvb3BcclxuICAgICAgICB9XHJcbiAgICAgICAgb2NjdXJyZW5jZV9jb3VudCsrO1xyXG4gICAgICAgIC8vIHJlc2V0IGN1cnJlbnRIZWFkZXJzXHJcbiAgICAgICAgY3VycmVudEhlYWRlcnMucG9wKCk7XHJcbiAgICAgICAgY29udGludWU7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICAgIC8vIGlmIG5vIGJlZ2luX2xpbmUgdGhlbiByZXR1cm4gZmFsc2VcclxuICAgIGlmIChiZWdpbl9saW5lID09PSAwKSByZXR1cm4gZmFsc2U7XHJcbiAgICAvLyBpdGVyYXRlIHRocm91Z2ggbGluZXMgc3RhcnRpbmcgYXQgYmVnaW5fbGluZVxyXG4gICAgaXNfY29kZSA9IGZhbHNlO1xyXG4gICAgLy8gY2hhcmFjdGVyIGFjY3VtdWxhdG9yXHJcbiAgICBsZXQgY2hhcl9jb3VudCA9IDA7XHJcbiAgICBmb3IgKGkgPSBiZWdpbl9saW5lOyBpIDwgbGluZXMubGVuZ3RoOyBpKyspIHtcclxuICAgICAgaWYoKHR5cGVvZiBsaW5lX2xpbWl0ID09PSBcIm51bWJlclwiKSAmJiAoYmxvY2subGVuZ3RoID4gbGluZV9saW1pdCkpe1xyXG4gICAgICAgIGJsb2NrLnB1c2goXCIuLi5cIik7XHJcbiAgICAgICAgYnJlYWs7IC8vIGVuZHMgd2hlbiBsaW5lX2xpbWl0IGlzIHJlYWNoZWRcclxuICAgICAgfVxyXG4gICAgICBsZXQgbGluZSA9IGxpbmVzW2ldO1xyXG4gICAgICBpZiAoKGxpbmUuaW5kZXhPZignIycpID09PSAwKSAmJiAoWycjJywnICddLmluZGV4T2YobGluZVsxXSkgIT09IC0xKSl7XHJcbiAgICAgICAgYnJlYWs7IC8vIGVuZHMgd2hlbiBlbmNvdW50ZXJpbmcgbmV4dCBoZWFkZXJcclxuICAgICAgfVxyXG4gICAgICAvLyBERVBSRUNBVEVEOiBzaG91bGQgYmUgaGFuZGxlZCBieSBuZXdfbGluZStjaGFyX2NvdW50IGNoZWNrIChoYXBwZW5zIGluIHByZXZpb3VzIGl0ZXJhdGlvbilcclxuICAgICAgLy8gaWYgY2hhcl9jb3VudCBpcyBncmVhdGVyIHRoYW4gbGltaXQubWF4X2NoYXJzLCBza2lwXHJcbiAgICAgIGlmIChsaW1pdHMubWF4X2NoYXJzICYmIGNoYXJfY291bnQgPiBsaW1pdHMubWF4X2NoYXJzKSB7XHJcbiAgICAgICAgYmxvY2sucHVzaChcIi4uLlwiKTtcclxuICAgICAgICBicmVhaztcclxuICAgICAgfVxyXG4gICAgICAvLyBpZiBuZXdfbGluZSArIGNoYXJfY291bnQgaXMgZ3JlYXRlciB0aGFuIGxpbWl0Lm1heF9jaGFycywgc2tpcFxyXG4gICAgICBpZiAobGltaXRzLm1heF9jaGFycyAmJiAoKGxpbmUubGVuZ3RoICsgY2hhcl9jb3VudCkgPiBsaW1pdHMubWF4X2NoYXJzKSkge1xyXG4gICAgICAgIGNvbnN0IG1heF9uZXdfY2hhcnMgPSBsaW1pdHMubWF4X2NoYXJzIC0gY2hhcl9jb3VudDtcclxuICAgICAgICBsaW5lID0gbGluZS5zbGljZSgwLCBtYXhfbmV3X2NoYXJzKSArIFwiLi4uXCI7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICAgIH1cclxuICAgICAgLy8gdmFsaWRhdGUvZm9ybWF0XHJcbiAgICAgIC8vIGlmIGxpbmUgaXMgZW1wdHksIHNraXBcclxuICAgICAgaWYgKGxpbmUubGVuZ3RoID09PSAwKSBjb250aW51ZTtcclxuICAgICAgLy8gbGltaXQgbGVuZ3RoIG9mIGxpbmUgdG8gTiBjaGFyYWN0ZXJzXHJcbiAgICAgIGlmIChsaW1pdHMuY2hhcnNfcGVyX2xpbmUgJiYgbGluZS5sZW5ndGggPiBsaW1pdHMuY2hhcnNfcGVyX2xpbmUpIHtcclxuICAgICAgICBsaW5lID0gbGluZS5zbGljZSgwLCBsaW1pdHMuY2hhcnNfcGVyX2xpbmUpICsgXCIuLi5cIjtcclxuICAgICAgfVxyXG4gICAgICAvLyBpZiBsaW5lIGlzIGEgY29kZSBibG9jaywgc2tpcFxyXG4gICAgICBpZiAobGluZS5zdGFydHNXaXRoKFwiYGBgXCIpKSB7XHJcbiAgICAgICAgaXNfY29kZSA9ICFpc19jb2RlO1xyXG4gICAgICAgIGNvbnRpbnVlO1xyXG4gICAgICB9XHJcbiAgICAgIGlmIChpc19jb2RlKXtcclxuICAgICAgICAvLyBhZGQgdGFiIHRvIGJlZ2lubmluZyBvZiBsaW5lXHJcbiAgICAgICAgbGluZSA9IFwiXFx0XCIrbGluZTtcclxuICAgICAgfVxyXG4gICAgICAvLyBhZGQgbGluZSB0byBibG9ja1xyXG4gICAgICBibG9jay5wdXNoKGxpbmUpO1xyXG4gICAgICAvLyBpbmNyZW1lbnQgY2hhcl9jb3VudFxyXG4gICAgICBjaGFyX2NvdW50ICs9IGxpbmUubGVuZ3RoO1xyXG4gICAgfVxyXG4gICAgLy8gY2xvc2UgY29kZSBibG9jayBpZiBvcGVuXHJcbiAgICBpZiAoaXNfY29kZSkge1xyXG4gICAgICBibG9jay5wdXNoKFwiYGBgXCIpO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIGJsb2NrLmpvaW4oXCJcXG5cIikudHJpbSgpO1xyXG4gIH1cclxuXHJcbiAgLy8gcmV0cmlldmUgYSBmaWxlIGZyb20gdGhlIHZhdWx0XHJcbiAgYXN5bmMgZmlsZV9yZXRyaWV2ZXIobGluaywgbGltaXRzPXt9KSB7XHJcbiAgICBsaW1pdHMgPSB7XHJcbiAgICAgIGxpbmVzOiBudWxsLFxyXG4gICAgICBtYXhfY2hhcnM6IG51bGwsXHJcbiAgICAgIGNoYXJzX3Blcl9saW5lOiBudWxsLFxyXG4gICAgICAuLi5saW1pdHNcclxuICAgIH07XHJcbiAgICBjb25zdCB0aGlzX2ZpbGUgPSB0aGlzLmFwcC52YXVsdC5nZXRBYnN0cmFjdEZpbGVCeVBhdGgobGluayk7XHJcbiAgICAvLyBpZiBmaWxlIGlzIG5vdCBmb3VuZCwgc2tpcFxyXG4gICAgaWYgKCEodGhpc19maWxlIGluc3RhbmNlb2YgT2JzaWRpYW4uVEFic3RyYWN0RmlsZSkpIHJldHVybiBmYWxzZTtcclxuICAgIC8vIHVzZSBjYWNoZWRSZWFkIHRvIGdldCB0aGUgZmlyc3QgMTAgbGluZXMgb2YgdGhlIGZpbGVcclxuICAgIGNvbnN0IGZpbGVfY29udGVudCA9IGF3YWl0IHRoaXMuYXBwLnZhdWx0LmNhY2hlZFJlYWQodGhpc19maWxlKTtcclxuICAgIGNvbnN0IGZpbGVfbGluZXMgPSBmaWxlX2NvbnRlbnQuc3BsaXQoXCJcXG5cIik7XHJcbiAgICBsZXQgZmlyc3RfdGVuX2xpbmVzID0gW107XHJcbiAgICBsZXQgaXNfY29kZSA9IGZhbHNlO1xyXG4gICAgbGV0IGNoYXJfYWNjdW0gPSAwO1xyXG4gICAgY29uc3QgbGluZV9saW1pdCA9IGxpbWl0cy5saW5lcyB8fCBmaWxlX2xpbmVzLmxlbmd0aDtcclxuICAgIGZvciAobGV0IGkgPSAwOyBmaXJzdF90ZW5fbGluZXMubGVuZ3RoIDwgbGluZV9saW1pdDsgaSsrKSB7XHJcbiAgICAgIGxldCBsaW5lID0gZmlsZV9saW5lc1tpXTtcclxuICAgICAgLy8gaWYgbGluZSBpcyB1bmRlZmluZWQsIGJyZWFrXHJcbiAgICAgIGlmICh0eXBlb2YgbGluZSA9PT0gJ3VuZGVmaW5lZCcpXHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICAgIC8vIGlmIGxpbmUgaXMgZW1wdHksIHNraXBcclxuICAgICAgaWYgKGxpbmUubGVuZ3RoID09PSAwKVxyXG4gICAgICAgIGNvbnRpbnVlO1xyXG4gICAgICAvLyBsaW1pdCBsZW5ndGggb2YgbGluZSB0byBOIGNoYXJhY3RlcnNcclxuICAgICAgaWYgKGxpbWl0cy5jaGFyc19wZXJfbGluZSAmJiBsaW5lLmxlbmd0aCA+IGxpbWl0cy5jaGFyc19wZXJfbGluZSkge1xyXG4gICAgICAgIGxpbmUgPSBsaW5lLnNsaWNlKDAsIGxpbWl0cy5jaGFyc19wZXJfbGluZSkgKyBcIi4uLlwiO1xyXG4gICAgICB9XHJcbiAgICAgIC8vIGlmIGxpbmUgaXMgXCItLS1cIiwgc2tpcFxyXG4gICAgICBpZiAobGluZSA9PT0gXCItLS1cIilcclxuICAgICAgICBjb250aW51ZTtcclxuICAgICAgLy8gc2tpcCBpZiBsaW5lIGlzIGVtcHR5IGJ1bGxldCBvciBjaGVja2JveFxyXG4gICAgICBpZiAoWyctICcsICctIFsgXSAnXS5pbmRleE9mKGxpbmUpID4gLTEpXHJcbiAgICAgICAgY29udGludWU7XHJcbiAgICAgIC8vIGlmIGxpbmUgaXMgYSBjb2RlIGJsb2NrLCBza2lwXHJcbiAgICAgIGlmIChsaW5lLmluZGV4T2YoXCJgYGBcIikgPT09IDApIHtcclxuICAgICAgICBpc19jb2RlID0gIWlzX2NvZGU7XHJcbiAgICAgICAgY29udGludWU7XHJcbiAgICAgIH1cclxuICAgICAgLy8gaWYgY2hhcl9hY2N1bSBpcyBncmVhdGVyIHRoYW4gbGltaXQubWF4X2NoYXJzLCBza2lwXHJcbiAgICAgIGlmIChsaW1pdHMubWF4X2NoYXJzICYmIGNoYXJfYWNjdW0gPiBsaW1pdHMubWF4X2NoYXJzKSB7XHJcbiAgICAgICAgZmlyc3RfdGVuX2xpbmVzLnB1c2goXCIuLi5cIik7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICAgIH1cclxuICAgICAgaWYgKGlzX2NvZGUpIHtcclxuICAgICAgICAvLyBpZiBpcyBjb2RlLCBhZGQgdGFiIHRvIGJlZ2lubmluZyBvZiBsaW5lXHJcbiAgICAgICAgbGluZSA9IFwiXFx0XCIgKyBsaW5lO1xyXG4gICAgICB9XHJcbiAgICAgIC8vIGlmIGxpbmUgaXMgYSBoZWFkaW5nXHJcbiAgICAgIGlmIChsaW5lX2lzX2hlYWRpbmcobGluZSkpIHtcclxuICAgICAgICAvLyBsb29rIGF0IGxhc3QgbGluZSBpbiBmaXJzdF90ZW5fbGluZXMgdG8gc2VlIGlmIGl0IGlzIGEgaGVhZGluZ1xyXG4gICAgICAgIC8vIG5vdGU6IHVzZXMgbGFzdCBpbiBmaXJzdF90ZW5fbGluZXMsIGluc3RlYWQgb2YgbG9vayBhaGVhZCBpbiBmaWxlX2xpbmVzLCBiZWNhdXNlLi5cclxuICAgICAgICAvLyAuLi5uZXh0IGxpbmUgbWF5IGJlIGV4Y2x1ZGVkIGZyb20gZmlyc3RfdGVuX2xpbmVzIGJ5IHByZXZpb3VzIGlmIHN0YXRlbWVudHNcclxuICAgICAgICBpZiAoKGZpcnN0X3Rlbl9saW5lcy5sZW5ndGggPiAwKSAmJiBsaW5lX2lzX2hlYWRpbmcoZmlyc3RfdGVuX2xpbmVzW2ZpcnN0X3Rlbl9saW5lcy5sZW5ndGggLSAxXSkpIHtcclxuICAgICAgICAgIC8vIGlmIGxhc3QgbGluZSBpcyBhIGhlYWRpbmcsIHJlbW92ZSBpdFxyXG4gICAgICAgICAgZmlyc3RfdGVuX2xpbmVzLnBvcCgpO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgICAvLyBhZGQgbGluZSB0byBmaXJzdF90ZW5fbGluZXNcclxuICAgICAgZmlyc3RfdGVuX2xpbmVzLnB1c2gobGluZSk7XHJcbiAgICAgIC8vIGluY3JlbWVudCBjaGFyX2FjY3VtXHJcbiAgICAgIGNoYXJfYWNjdW0gKz0gbGluZS5sZW5ndGg7XHJcbiAgICB9XHJcbiAgICAvLyBmb3IgZWFjaCBsaW5lIGluIGZpcnN0X3Rlbl9saW5lcywgYXBwbHkgdmlldy1zcGVjaWZpYyBmb3JtYXR0aW5nXHJcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGZpcnN0X3Rlbl9saW5lcy5sZW5ndGg7IGkrKykge1xyXG4gICAgICAvLyBpZiBsaW5lIGlzIGEgaGVhZGluZ1xyXG4gICAgICBpZiAobGluZV9pc19oZWFkaW5nKGZpcnN0X3Rlbl9saW5lc1tpXSkpIHtcclxuICAgICAgICAvLyBpZiB0aGlzIGlzIHRoZSBsYXN0IGxpbmUgaW4gZmlyc3RfdGVuX2xpbmVzXHJcbiAgICAgICAgaWYgKGkgPT09IGZpcnN0X3Rlbl9saW5lcy5sZW5ndGggLSAxKSB7XHJcbiAgICAgICAgICAvLyByZW1vdmUgdGhlIGxhc3QgbGluZSBpZiBpdCBpcyBhIGhlYWRpbmdcclxuICAgICAgICAgIGZpcnN0X3Rlbl9saW5lcy5wb3AoKTtcclxuICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgIH1cclxuICAgICAgICAvLyByZW1vdmUgaGVhZGluZyBzeW50YXggdG8gaW1wcm92ZSByZWFkYWJpbGl0eSBpbiBzbWFsbCBzcGFjZVxyXG4gICAgICAgIGZpcnN0X3Rlbl9saW5lc1tpXSA9IGZpcnN0X3Rlbl9saW5lc1tpXS5yZXBsYWNlKC8jKy8sIFwiXCIpO1xyXG4gICAgICAgIGZpcnN0X3Rlbl9saW5lc1tpXSA9IGBcXG4ke2ZpcnN0X3Rlbl9saW5lc1tpXX06YDtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gICAgLy8gam9pbiBmaXJzdCB0ZW4gbGluZXMgaW50byBzdHJpbmdcclxuICAgIGZpcnN0X3Rlbl9saW5lcyA9IGZpcnN0X3Rlbl9saW5lcy5qb2luKFwiXFxuXCIpO1xyXG4gICAgcmV0dXJuIGZpcnN0X3Rlbl9saW5lcztcclxuICB9XHJcblxyXG4gIC8vIGl0ZXJhdGUgdGhyb3VnaCBibG9ja3MgYW5kIHNraXAgaWYgYmxvY2tfaGVhZGluZ3MgY29udGFpbnMgdGhpcy5oZWFkZXJfZXhjbHVzaW9uc1xyXG4gIHZhbGlkYXRlX2hlYWRpbmdzKGJsb2NrX2hlYWRpbmdzKSB7XHJcbiAgICBsZXQgdmFsaWQgPSB0cnVlO1xyXG4gICAgaWYgKHRoaXMuaGVhZGVyX2V4Y2x1c2lvbnMubGVuZ3RoID4gMCkge1xyXG4gICAgICBmb3IgKGxldCBrID0gMDsgayA8IHRoaXMuaGVhZGVyX2V4Y2x1c2lvbnMubGVuZ3RoOyBrKyspIHtcclxuICAgICAgICBpZiAoYmxvY2tfaGVhZGluZ3MuaW5kZXhPZih0aGlzLmhlYWRlcl9leGNsdXNpb25zW2tdKSA+IC0xKSB7XHJcbiAgICAgICAgICB2YWxpZCA9IGZhbHNlO1xyXG4gICAgICAgICAgdGhpcy5sb2dfZXhjbHVzaW9uKFwiaGVhZGluZzogXCIrdGhpcy5oZWFkZXJfZXhjbHVzaW9uc1trXSk7XHJcbiAgICAgICAgICBicmVhaztcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgIH1cclxuICAgIHJldHVybiB2YWxpZDtcclxuICB9XHJcbiAgLy8gcmVuZGVyIFwiU21hcnQgQ29ubmVjdGlvbnNcIiB0ZXh0IGZpeGVkIGluIHRoZSBib3R0b20gcmlnaHQgY29ybmVyXHJcbiAgcmVuZGVyX2JyYW5kKGNvbnRhaW5lciwgbG9jYXRpb249XCJkZWZhdWx0XCIpIHtcclxuICAgIC8vIGlmIGxvY2F0aW9uIGlzIGFsbCB0aGVuIGdldCBPYmplY3Qua2V5cyh0aGlzLnNjX2JyYW5kaW5nKSBhbmQgY2FsbCB0aGlzIGZ1bmN0aW9uIGZvciBlYWNoXHJcbiAgICBpZiAoY29udGFpbmVyID09PSBcImFsbFwiKSB7XHJcbiAgICAgIGNvbnN0IGxvY2F0aW9ucyA9IE9iamVjdC5rZXlzKHRoaXMuc2NfYnJhbmRpbmcpO1xyXG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxvY2F0aW9ucy5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgIHRoaXMucmVuZGVyX2JyYW5kKHRoaXMuc2NfYnJhbmRpbmdbbG9jYXRpb25zW2ldXSwgbG9jYXRpb25zW2ldKTtcclxuICAgICAgfVxyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcbiAgICAvLyBicmFuZCBjb250YWluZXJcclxuICAgIHRoaXMuc2NfYnJhbmRpbmdbbG9jYXRpb25dID0gY29udGFpbmVyO1xyXG4gICAgLy8gaWYgdGhpcy5zY19icmFuZGluZ1tsb2NhdGlvbl0gY29udGFpbnMgY2hpbGQgd2l0aCBjbGFzcyBcInNjLWJyYW5kXCIsIHJlbW92ZSBpdFxyXG4gICAgaWYgKHRoaXMuc2NfYnJhbmRpbmdbbG9jYXRpb25dLnF1ZXJ5U2VsZWN0b3IoXCIuc2MtYnJhbmRcIikpIHtcclxuICAgICAgdGhpcy5zY19icmFuZGluZ1tsb2NhdGlvbl0ucXVlcnlTZWxlY3RvcihcIi5zYy1icmFuZFwiKS5yZW1vdmUoKTtcclxuICAgIH1cclxuICAgIGNvbnN0IGJyYW5kX2NvbnRhaW5lciA9IHRoaXMuc2NfYnJhbmRpbmdbbG9jYXRpb25dLmNyZWF0ZUVsKFwiZGl2XCIsIHsgY2xzOiBcInNjLWJyYW5kXCIgfSk7XHJcbiAgICAvLyBhZGQgdGV4dFxyXG4gICAgLy8gYWRkIFNWRyBzaWduYWwgaWNvbiB1c2luZyBnZXRJY29uXHJcbiAgICBPYnNpZGlhbi5zZXRJY29uKGJyYW5kX2NvbnRhaW5lciwgXCJzbWFydC1jb25uZWN0aW9uc1wiKTtcclxuICAgIGNvbnN0IGJyYW5kX3AgPSBicmFuZF9jb250YWluZXIuY3JlYXRlRWwoXCJwXCIpO1xyXG4gICAgbGV0IHRleHQgPSBcIlNtYXJ0IENvbm5lY3Rpb25zXCI7XHJcbiAgICBsZXQgYXR0ciA9IHt9O1xyXG4gICAgLy8gaWYgdXBkYXRlIGF2YWlsYWJsZSwgY2hhbmdlIHRleHQgdG8gXCJVcGRhdGUgQXZhaWxhYmxlXCJcclxuICAgIGlmICh0aGlzLnVwZGF0ZV9hdmFpbGFibGUpIHtcclxuICAgICAgdGV4dCA9IFwiVXBkYXRlIEF2YWlsYWJsZVwiO1xyXG4gICAgICBhdHRyID0ge1xyXG4gICAgICAgIHN0eWxlOiBcImZvbnQtd2VpZ2h0OiA3MDA7XCJcclxuICAgICAgfTtcclxuICAgIH1cclxuICAgIGJyYW5kX3AuY3JlYXRlRWwoXCJhXCIsIHtcclxuICAgICAgY2xzOiBcIlwiLFxyXG4gICAgICB0ZXh0OiB0ZXh0LFxyXG4gICAgICBocmVmOiBcImh0dHBzOi8vZ2l0aHViLmNvbS9icmlhbnBldHJvL29ic2lkaWFuLXNtYXJ0LWNvbm5lY3Rpb25zL2Rpc2N1c3Npb25zXCIsXHJcbiAgICAgIHRhcmdldDogXCJfYmxhbmtcIixcclxuICAgICAgYXR0cjogYXR0clxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuXHJcbiAgLy8gY3JlYXRlIGxpc3Qgb2YgbmVhcmVzdCBub3Rlc1xyXG4gIGFzeW5jIHVwZGF0ZV9yZXN1bHRzKGNvbnRhaW5lciwgbmVhcmVzdCkge1xyXG4gICAgbGV0IGxpc3Q7XHJcbiAgICAvLyBjaGVjayBpZiBsaXN0IGV4aXN0c1xyXG4gICAgaWYoKGNvbnRhaW5lci5jaGlsZHJlbi5sZW5ndGggPiAxKSAmJiAoY29udGFpbmVyLmNoaWxkcmVuWzFdLmNsYXNzTGlzdC5jb250YWlucyhcInNjLWxpc3RcIikpKXtcclxuICAgICAgbGlzdCA9IGNvbnRhaW5lci5jaGlsZHJlblsxXTtcclxuICAgIH1cclxuICAgIC8vIGlmIGxpc3QgZXhpc3RzLCBlbXB0eSBpdFxyXG4gICAgaWYgKGxpc3QpIHtcclxuICAgICAgbGlzdC5lbXB0eSgpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgLy8gY3JlYXRlIGxpc3QgZWxlbWVudFxyXG4gICAgICBsaXN0ID0gY29udGFpbmVyLmNyZWF0ZUVsKFwiZGl2XCIsIHsgY2xzOiBcInNjLWxpc3RcIiB9KTtcclxuICAgIH1cclxuICAgIGxldCBzZWFyY2hfcmVzdWx0X2NsYXNzID0gXCJzZWFyY2gtcmVzdWx0XCI7XHJcbiAgICAvLyBpZiBzZXR0aW5ncyBleHBhbmRlZF92aWV3IGlzIGZhbHNlLCBhZGQgc2MtY29sbGFwc2VkIGNsYXNzXHJcbiAgICBpZighdGhpcy5zZXR0aW5ncy5leHBhbmRlZF92aWV3KSBzZWFyY2hfcmVzdWx0X2NsYXNzICs9IFwiIHNjLWNvbGxhcHNlZFwiO1xyXG5cclxuICAgIC8vIFRPRE86IGFkZCBvcHRpb24gdG8gZ3JvdXAgbmVhcmVzdCBieSBmaWxlXHJcbiAgICBpZighdGhpcy5zZXR0aW5ncy5ncm91cF9uZWFyZXN0X2J5X2ZpbGUpIHtcclxuICAgICAgLy8gZm9yIGVhY2ggbmVhcmVzdCBub3RlXHJcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbmVhcmVzdC5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIEJFR0lOIEVYVEVSTkFMIExJTksgTE9HSUNcclxuICAgICAgICAgKiBpZiBsaW5rIGlzIGFuIG9iamVjdCwgaXQgaW5kaWNhdGVzIGV4dGVybmFsIGxpbmtcclxuICAgICAgICAgKi9cclxuICAgICAgICBjb25zb2xlLmxvZyh0aGlzKTtcclxuICAgICAgICBpZiAodHlwZW9mIG5lYXJlc3RbaV0ubGluayA9PT0gXCJvYmplY3RcIikge1xyXG4gICAgICAgICAgY29uc3QgaXRlbSA9IGxpc3QuY3JlYXRlRWwoXCJkaXZcIiwgeyBjbHM6IFwic2VhcmNoLXJlc3VsdFwiIH0pO1xyXG4gICAgICAgICAgY29uc3QgbGluayA9IGl0ZW0uY3JlYXRlRWwoXCJhXCIsIHtcclxuICAgICAgICAgICAgY2xzOiBcInNlYXJjaC1yZXN1bHQtZmlsZS10aXRsZSBpcy1jbGlja2FibGVcIixcclxuICAgICAgICAgICAgaHJlZjogbmVhcmVzdFtpXS5saW5rLnBhdGgsXHJcbiAgICAgICAgICAgIHRpdGxlOiBuZWFyZXN0W2ldLmxpbmsudGl0bGUsXHJcbiAgICAgICAgICB9KTtcclxuICAgICAgICAgIGxpbmsuaW5uZXJIVE1MID0gdGhpcy5yZW5kZXJfZXh0ZXJuYWxfbGlua19lbG0obmVhcmVzdFtpXS5saW5rKTtcclxuICAgICAgICAgIGl0ZW0uc2V0QXR0cignZHJhZ2dhYmxlJywgJ3RydWUnKVxyXG4gICAgICAgICAgY29udGludWU7IC8vIGVuZHMgaGVyZSBmb3IgZXh0ZXJuYWwgbGlua3NcclxuICAgICAgICB9XHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogQkVHSU4gSU5URVJOQUwgTElOSyBMT0dJQ1xyXG4gICAgICAgICAqIGlmIGxpbmsgaXMgYSBzdHJpbmcsIGl0IGluZGljYXRlcyBpbnRlcm5hbCBsaW5rXHJcbiAgICAgICAgICovXHJcbiAgICAgICAgbGV0IGZpbGVfbGlua190ZXh0O1xyXG4gICAgICAgIGNvbnN0IGZpbGVfc2ltaWxhcml0eV9wY3QgPSBNYXRoLnJvdW5kKG5lYXJlc3RbaV0uc2ltaWxhcml0eSAqIDEwMCkgKyBcIiVcIjtcclxuICAgICAgICBpZih0aGlzLnNldHRpbmdzLnNob3dfZnVsbF9wYXRoKSB7XHJcbiAgICAgICAgICBjb25zdCBwY3MgPSBuZWFyZXN0W2ldLmxpbmsuc3BsaXQoXCIvXCIpO1xyXG4gICAgICAgICAgZmlsZV9saW5rX3RleHQgPSBwY3NbcGNzLmxlbmd0aCAtIDFdO1xyXG4gICAgICAgICAgY29uc3QgcGF0aCA9IHBjcy5zbGljZSgwLCBwY3MubGVuZ3RoIC0gMSkuam9pbihcIi9cIik7XHJcbiAgICAgICAgICAvLyBmaWxlX2xpbmtfdGV4dCA9IGA8c21hbGw+JHtwYXRofSB8ICR7ZmlsZV9zaW1pbGFyaXR5X3BjdH08L3NtYWxsPjxicj4ke2ZpbGVfbGlua190ZXh0fWA7XHJcbiAgICAgICAgICBmaWxlX2xpbmtfdGV4dCA9IGA8c21hbGw+JHtmaWxlX3NpbWlsYXJpdHlfcGN0fSB8ICR7cGF0aH0gfCAke2ZpbGVfbGlua190ZXh0fTwvc21hbGw+YDtcclxuICAgICAgICB9ZWxzZXtcclxuICAgICAgICAgIGZpbGVfbGlua190ZXh0ID0gJzxzbWFsbD4nICsgZmlsZV9zaW1pbGFyaXR5X3BjdCArIFwiIHwgXCIgKyBuZWFyZXN0W2ldLmxpbmsuc3BsaXQoXCIvXCIpLnBvcCgpICsgJzwvc21hbGw+JztcclxuICAgICAgICB9XHJcbiAgICAgICAgLy8gc2tpcCBjb250ZW50cyByZW5kZXJpbmcgaWYgaW5jb21wYXRpYmxlIGZpbGUgdHlwZVxyXG4gICAgICAgIC8vIGV4LiBub3QgbWFya2Rvd24gZmlsZSBvciBjb250YWlucyBubyAnLmV4Y2FsaWRyYXcnXHJcbiAgICAgICAgaWYoIXRoaXMucmVuZGVyYWJsZV9maWxlX3R5cGUobmVhcmVzdFtpXS5saW5rKSl7XHJcbiAgICAgICAgICBjb25zdCBpdGVtID0gbGlzdC5jcmVhdGVFbChcImRpdlwiLCB7IGNsczogXCJzZWFyY2gtcmVzdWx0XCIgfSk7XHJcbiAgICAgICAgICBjb25zdCBsaW5rID0gaXRlbS5jcmVhdGVFbChcImFcIiwge1xyXG4gICAgICAgICAgICBjbHM6IFwic2VhcmNoLXJlc3VsdC1maWxlLXRpdGxlIGlzLWNsaWNrYWJsZVwiLFxyXG4gICAgICAgICAgICBocmVmOiBuZWFyZXN0W2ldLmxpbmssXHJcbiAgICAgICAgICB9KTtcclxuICAgICAgICAgIGxpbmsuaW5uZXJIVE1MID0gZmlsZV9saW5rX3RleHQ7XHJcbiAgICAgICAgICAvLyBkcmFnIGFuZCBkcm9wXHJcbiAgICAgICAgICBpdGVtLnNldEF0dHIoJ2RyYWdnYWJsZScsICd0cnVlJylcclxuICAgICAgICAgIC8vIGFkZCBsaXN0ZW5lcnMgdG8gbGlua1xyXG4gICAgICAgICAgdGhpcy5hZGRfbGlua19saXN0ZW5lcnMobGluaywgbmVhcmVzdFtpXSwgaXRlbSk7XHJcbiAgICAgICAgICBjb250aW51ZTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vIHJlbW92ZSBmaWxlIGV4dGVuc2lvbiBpZiAubWQgYW5kIG1ha2UgIyBpbnRvID5cclxuICAgICAgICBmaWxlX2xpbmtfdGV4dCA9IGZpbGVfbGlua190ZXh0LnJlcGxhY2UoXCIubWRcIiwgXCJcIikucmVwbGFjZSgvIy9nLCBcIiA+IFwiKTtcclxuICAgICAgICAvLyBjcmVhdGUgaXRlbVxyXG4gICAgICAgIGNvbnN0IGl0ZW0gPSBsaXN0LmNyZWF0ZUVsKFwiZGl2XCIsIHsgY2xzOiBzZWFyY2hfcmVzdWx0X2NsYXNzIH0pO1xyXG4gICAgICAgIC8vIGNyZWF0ZSBzcGFuIGZvciB0b2dnbGVcclxuICAgICAgICBjb25zdCB0b2dnbGUgPSBpdGVtLmNyZWF0ZUVsKFwic3BhblwiLCB7IGNsczogXCJpcy1jbGlja2FibGVcIiB9KTtcclxuICAgICAgICAvLyBpbnNlcnQgcmlnaHQgdHJpYW5nbGUgc3ZnIGFzIHRvZ2dsZVxyXG4gICAgICAgIE9ic2lkaWFuLnNldEljb24odG9nZ2xlLCBcInJpZ2h0LXRyaWFuZ2xlXCIpOyAvLyBtdXN0IGNvbWUgYmVmb3JlIGFkZGluZyBvdGhlciBlbG1zIHRvIHByZXZlbnQgb3ZlcndyaXRlXHJcbiAgICAgICAgY29uc3QgbGluayA9IHRvZ2dsZS5jcmVhdGVFbChcImFcIiwge1xyXG4gICAgICAgICAgY2xzOiBcInNlYXJjaC1yZXN1bHQtZmlsZS10aXRsZVwiLFxyXG4gICAgICAgICAgdGl0bGU6IG5lYXJlc3RbaV0ubGluayxcclxuICAgICAgICB9KTtcclxuICAgICAgICBsaW5rLmlubmVySFRNTCA9IGZpbGVfbGlua190ZXh0O1xyXG4gICAgICAgIC8vIGFkZCBsaXN0ZW5lcnMgdG8gbGlua1xyXG4gICAgICAgIHRoaXMuYWRkX2xpbmtfbGlzdGVuZXJzKGxpbmssIG5lYXJlc3RbaV0sIGl0ZW0pO1xyXG4gICAgICAgIHRvZ2dsZS5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKGV2ZW50KSA9PiB7XHJcbiAgICAgICAgICAvLyBmaW5kIHBhcmVudCBjb250YWluaW5nIHNlYXJjaC1yZXN1bHQgY2xhc3NcclxuICAgICAgICAgIGxldCBwYXJlbnQgPSBldmVudC50YXJnZXQucGFyZW50RWxlbWVudDtcclxuICAgICAgICAgIHdoaWxlICghcGFyZW50LmNsYXNzTGlzdC5jb250YWlucyhcInNlYXJjaC1yZXN1bHRcIikpIHtcclxuICAgICAgICAgICAgcGFyZW50ID0gcGFyZW50LnBhcmVudEVsZW1lbnQ7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgICAvLyB0b2dnbGUgc2MtY29sbGFwc2VkIGNsYXNzXHJcbiAgICAgICAgICBwYXJlbnQuY2xhc3NMaXN0LnRvZ2dsZShcInNjLWNvbGxhcHNlZFwiKTtcclxuICAgICAgICB9KTtcclxuICAgICAgICBjb25zdCBjb250ZW50cyA9IGl0ZW0uY3JlYXRlRWwoXCJ1bFwiLCB7IGNsczogXCJcIiB9KTtcclxuICAgICAgICBjb25zdCBjb250ZW50c19jb250YWluZXIgPSBjb250ZW50cy5jcmVhdGVFbChcImxpXCIsIHtcclxuICAgICAgICAgIGNsczogXCJzZWFyY2gtcmVzdWx0LWZpbGUtdGl0bGUgaXMtY2xpY2thYmxlXCIsXHJcbiAgICAgICAgICB0aXRsZTogbmVhcmVzdFtpXS5saW5rLFxyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIGlmKG5lYXJlc3RbaV0ubGluay5pbmRleE9mKFwiI1wiKSA+IC0xKXsgLy8gaXMgYmxvY2tcclxuICAgICAgICAgIE9ic2lkaWFuLk1hcmtkb3duUmVuZGVyZXIucmVuZGVyTWFya2Rvd24oKGF3YWl0IHRoaXMuYmxvY2tfcmV0cmlldmVyKG5lYXJlc3RbaV0ubGluaywge2xpbmVzOiAxMCwgbWF4X2NoYXJzOiAxMDAwfSkpLCBjb250ZW50c19jb250YWluZXIsIG5lYXJlc3RbaV0ubGluaywgbmV3IE9ic2lkaWFuLkNvbXBvbmVudCgpKTtcclxuICAgICAgICB9ZWxzZXsgLy8gaXMgZmlsZVxyXG4gICAgICAgICAgY29uc3QgZmlyc3RfdGVuX2xpbmVzID0gYXdhaXQgdGhpcy5maWxlX3JldHJpZXZlcihuZWFyZXN0W2ldLmxpbmssIHtsaW5lczogMTAsIG1heF9jaGFyczogMTAwMH0pO1xyXG4gICAgICAgICAgaWYoIWZpcnN0X3Rlbl9saW5lcykgY29udGludWU7IC8vIHNraXAgaWYgZmlsZSBpcyBlbXB0eVxyXG4gICAgICAgICAgT2JzaWRpYW4uTWFya2Rvd25SZW5kZXJlci5yZW5kZXJNYXJrZG93bihmaXJzdF90ZW5fbGluZXMsIGNvbnRlbnRzX2NvbnRhaW5lciwgbmVhcmVzdFtpXS5saW5rLCBuZXcgT2JzaWRpYW4uQ29tcG9uZW50KCkpO1xyXG4gICAgICAgIH1cclxuICAgICAgICB0aGlzLmFkZF9saW5rX2xpc3RlbmVycyhjb250ZW50cywgbmVhcmVzdFtpXSwgaXRlbSk7XHJcbiAgICAgIH1cclxuICAgICAgdGhpcy5yZW5kZXJfYnJhbmQoY29udGFpbmVyLCBcImJsb2NrXCIpO1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcblxyXG4gICAgLy8gZ3JvdXAgbmVhcmVzdCBieSBmaWxlXHJcbiAgICBjb25zdCBuZWFyZXN0X2J5X2ZpbGUgPSB7fTtcclxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbmVhcmVzdC5sZW5ndGg7IGkrKykge1xyXG4gICAgICBjb25zdCBjdXJyID0gbmVhcmVzdFtpXTtcclxuICAgICAgY29uc3QgbGluayA9IGN1cnIubGluaztcclxuICAgICAgLy8gc2tpcCBpZiBsaW5rIGlzIGFuIG9iamVjdCAoaW5kaWNhdGVzIGV4dGVybmFsIGxvZ2ljKVxyXG4gICAgICBpZiAodHlwZW9mIGxpbmsgPT09IFwib2JqZWN0XCIpIHtcclxuICAgICAgICBuZWFyZXN0X2J5X2ZpbGVbbGluay5wYXRoXSA9IFtjdXJyXTtcclxuICAgICAgICBjb250aW51ZTtcclxuICAgICAgfVxyXG4gICAgICBpZiAobGluay5pbmRleE9mKFwiI1wiKSA+IC0xKSB7XHJcbiAgICAgICAgY29uc3QgZmlsZV9wYXRoID0gbGluay5zcGxpdChcIiNcIilbMF07XHJcbiAgICAgICAgaWYgKCFuZWFyZXN0X2J5X2ZpbGVbZmlsZV9wYXRoXSkge1xyXG4gICAgICAgICAgbmVhcmVzdF9ieV9maWxlW2ZpbGVfcGF0aF0gPSBbXTtcclxuICAgICAgICB9XHJcbiAgICAgICAgbmVhcmVzdF9ieV9maWxlW2ZpbGVfcGF0aF0ucHVzaChuZWFyZXN0W2ldKTtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICBpZiAoIW5lYXJlc3RfYnlfZmlsZVtsaW5rXSkge1xyXG4gICAgICAgICAgbmVhcmVzdF9ieV9maWxlW2xpbmtdID0gW107XHJcbiAgICAgICAgfVxyXG4gICAgICAgIC8vIGFsd2F5cyBhZGQgdG8gZnJvbnQgb2YgYXJyYXlcclxuICAgICAgICBuZWFyZXN0X2J5X2ZpbGVbbGlua10udW5zaGlmdChuZWFyZXN0W2ldKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gICAgLy8gZm9yIGVhY2ggZmlsZVxyXG4gICAgY29uc3Qga2V5cyA9IE9iamVjdC5rZXlzKG5lYXJlc3RfYnlfZmlsZSk7XHJcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGtleXMubGVuZ3RoOyBpKyspIHtcclxuICAgICAgY29uc3QgZmlsZSA9IG5lYXJlc3RfYnlfZmlsZVtrZXlzW2ldXTtcclxuICAgICAgLyoqXHJcbiAgICAgICAqIEJlZ2luIGV4dGVybmFsIGxpbmsgaGFuZGxpbmdcclxuICAgICAgICovXHJcbiAgICAgIC8vIGlmIGxpbmsgaXMgYW4gb2JqZWN0IChpbmRpY2F0ZXMgdjIgbG9naWMpXHJcbiAgICAgIGlmICh0eXBlb2YgZmlsZVswXS5saW5rID09PSBcIm9iamVjdFwiKSB7XHJcbiAgICAgICAgY29uc3QgY3VyciA9IGZpbGVbMF07XHJcbiAgICAgICAgY29uc3QgbWV0YSA9IGN1cnIubGluaztcclxuICAgICAgICBpZiAobWV0YS5wYXRoLnN0YXJ0c1dpdGgoXCJodHRwXCIpKSB7XHJcbiAgICAgICAgICBjb25zdCBpdGVtID0gbGlzdC5jcmVhdGVFbChcImRpdlwiLCB7IGNsczogXCJzZWFyY2gtcmVzdWx0XCIgfSk7XHJcbiAgICAgICAgICBjb25zdCBsaW5rID0gaXRlbS5jcmVhdGVFbChcImFcIiwge1xyXG4gICAgICAgICAgICBjbHM6IFwic2VhcmNoLXJlc3VsdC1maWxlLXRpdGxlIGlzLWNsaWNrYWJsZVwiLFxyXG4gICAgICAgICAgICBocmVmOiBtZXRhLnBhdGgsXHJcbiAgICAgICAgICAgIHRpdGxlOiBtZXRhLnRpdGxlLFxyXG4gICAgICAgICAgfSk7XHJcbiAgICAgICAgICBsaW5rLmlubmVySFRNTCA9IHRoaXMucmVuZGVyX2V4dGVybmFsX2xpbmtfZWxtKG1ldGEpO1xyXG4gICAgICAgICAgaXRlbS5zZXRBdHRyKCdkcmFnZ2FibGUnLCAndHJ1ZScpO1xyXG4gICAgICAgICAgY29udGludWU7IC8vIGVuZHMgaGVyZSBmb3IgZXh0ZXJuYWwgbGlua3NcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgICAgLyoqXHJcbiAgICAgICAqIEhhbmRsZXMgSW50ZXJuYWxcclxuICAgICAgICovXHJcbiAgICAgIGxldCBmaWxlX2xpbmtfdGV4dDtcclxuICAgICAgY29uc3QgZmlsZV9zaW1pbGFyaXR5X3BjdCA9IE1hdGgucm91bmQoZmlsZVswXS5zaW1pbGFyaXR5ICogMTAwKSArIFwiJVwiO1xyXG4gICAgICBpZiAodGhpcy5zZXR0aW5ncy5zaG93X2Z1bGxfcGF0aCkge1xyXG4gICAgICAgIGNvbnN0IHBjcyA9IGZpbGVbMF0ubGluay5zcGxpdChcIi9cIik7XHJcbiAgICAgICAgZmlsZV9saW5rX3RleHQgPSBwY3NbcGNzLmxlbmd0aCAtIDFdO1xyXG4gICAgICAgIGNvbnN0IHBhdGggPSBwY3Muc2xpY2UoMCwgcGNzLmxlbmd0aCAtIDEpLmpvaW4oXCIvXCIpO1xyXG4gICAgICAgIGZpbGVfbGlua190ZXh0ID0gYDxzbWFsbD4ke3BhdGh9IHwgJHtmaWxlX3NpbWlsYXJpdHlfcGN0fTwvc21hbGw+PGJyPiR7ZmlsZV9saW5rX3RleHR9YDtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICBmaWxlX2xpbmtfdGV4dCA9IGZpbGVbMF0ubGluay5zcGxpdChcIi9cIikucG9wKCk7XHJcbiAgICAgICAgLy8gYWRkIHNpbWlsYXJpdHkgcGVyY2VudGFnZVxyXG4gICAgICAgIGZpbGVfbGlua190ZXh0ICs9ICcgfCAnICsgZmlsZV9zaW1pbGFyaXR5X3BjdDtcclxuICAgICAgfVxyXG5cclxuXHJcblxyXG4gICAgICAvLyBza2lwIGNvbnRlbnRzIHJlbmRlcmluZyBpZiBpbmNvbXBhdGlibGUgZmlsZSB0eXBlXHJcbiAgICAgIC8vIGV4LiBub3QgbWFya2Rvd24gb3IgY29udGFpbnMgJy5leGNhbGlkcmF3J1xyXG4gICAgICBpZighdGhpcy5yZW5kZXJhYmxlX2ZpbGVfdHlwZShmaWxlWzBdLmxpbmspKSB7XHJcbiAgICAgICAgY29uc3QgaXRlbSA9IGxpc3QuY3JlYXRlRWwoXCJkaXZcIiwgeyBjbHM6IFwic2VhcmNoLXJlc3VsdFwiIH0pO1xyXG4gICAgICAgIGNvbnN0IGZpbGVfbGluayA9IGl0ZW0uY3JlYXRlRWwoXCJhXCIsIHtcclxuICAgICAgICAgIGNsczogXCJzZWFyY2gtcmVzdWx0LWZpbGUtdGl0bGUgaXMtY2xpY2thYmxlXCIsXHJcbiAgICAgICAgICB0aXRsZTogZmlsZVswXS5saW5rLFxyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIGZpbGVfbGluay5pbm5lckhUTUwgPSBmaWxlX2xpbmtfdGV4dDtcclxuICAgICAgICAvLyBhZGQgbGluayBsaXN0ZW5lcnMgdG8gZmlsZSBsaW5rXHJcbiAgICAgICAgdGhpcy5hZGRfbGlua19saXN0ZW5lcnMoZmlsZV9saW5rLCBmaWxlWzBdLCBpdGVtKTtcclxuICAgICAgICBjb250aW51ZTtcclxuICAgICAgfVxyXG5cclxuXHJcbiAgICAgIC8vIHJlbW92ZSBmaWxlIGV4dGVuc2lvbiBpZiAubWRcclxuICAgICAgZmlsZV9saW5rX3RleHQgPSBmaWxlX2xpbmtfdGV4dC5yZXBsYWNlKFwiLm1kXCIsIFwiXCIpLnJlcGxhY2UoLyMvZywgXCIgPiBcIik7XHJcbiAgICAgIGNvbnN0IGl0ZW0gPSBsaXN0LmNyZWF0ZUVsKFwiZGl2XCIsIHsgY2xzOiBzZWFyY2hfcmVzdWx0X2NsYXNzIH0pO1xyXG4gICAgICBjb25zdCB0b2dnbGUgPSBpdGVtLmNyZWF0ZUVsKFwic3BhblwiLCB7IGNsczogXCJpcy1jbGlja2FibGVcIiB9KTtcclxuICAgICAgLy8gaW5zZXJ0IHJpZ2h0IHRyaWFuZ2xlIHN2ZyBpY29uIGFzIHRvZ2dsZSBidXR0b24gaW4gc3BhblxyXG4gICAgICBPYnNpZGlhbi5zZXRJY29uKHRvZ2dsZSwgXCJyaWdodC10cmlhbmdsZVwiKTsgLy8gbXVzdCBjb21lIGJlZm9yZSBhZGRpbmcgb3RoZXIgZWxtcyBlbHNlIG92ZXJ3cml0ZXNcclxuICAgICAgY29uc3QgZmlsZV9saW5rID0gdG9nZ2xlLmNyZWF0ZUVsKFwiYVwiLCB7XHJcbiAgICAgICAgY2xzOiBcInNlYXJjaC1yZXN1bHQtZmlsZS10aXRsZVwiLFxyXG4gICAgICAgIHRpdGxlOiBmaWxlWzBdLmxpbmssXHJcbiAgICAgIH0pO1xyXG4gICAgICBmaWxlX2xpbmsuaW5uZXJIVE1MID0gZmlsZV9saW5rX3RleHQ7XHJcbiAgICAgIC8vIGFkZCBsaW5rIGxpc3RlbmVycyB0byBmaWxlIGxpbmtcclxuICAgICAgdGhpcy5hZGRfbGlua19saXN0ZW5lcnMoZmlsZV9saW5rLCBmaWxlWzBdLCB0b2dnbGUpO1xyXG4gICAgICB0b2dnbGUuYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIChldmVudCkgPT4ge1xyXG4gICAgICAgIC8vIGZpbmQgcGFyZW50IGNvbnRhaW5pbmcgY2xhc3Mgc2VhcmNoLXJlc3VsdFxyXG4gICAgICAgIGxldCBwYXJlbnQgPSBldmVudC50YXJnZXQ7XHJcbiAgICAgICAgd2hpbGUgKCFwYXJlbnQuY2xhc3NMaXN0LmNvbnRhaW5zKFwic2VhcmNoLXJlc3VsdFwiKSkge1xyXG4gICAgICAgICAgcGFyZW50ID0gcGFyZW50LnBhcmVudEVsZW1lbnQ7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHBhcmVudC5jbGFzc0xpc3QudG9nZ2xlKFwic2MtY29sbGFwc2VkXCIpO1xyXG4gICAgICAgIC8vIFRPRE86IGlmIGJsb2NrIGNvbnRhaW5lciBpcyBlbXB0eSwgcmVuZGVyIG1hcmtkb3duIGZyb20gYmxvY2sgcmV0cmlldmVyXHJcbiAgICAgIH0pO1xyXG4gICAgICBjb25zdCBmaWxlX2xpbmtfbGlzdCA9IGl0ZW0uY3JlYXRlRWwoXCJ1bFwiKTtcclxuICAgICAgLy8gZm9yIGVhY2ggbGluayBpbiBmaWxlXHJcbiAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgZmlsZS5sZW5ndGg7IGorKykge1xyXG4gICAgICAgIC8vIGlmIGlzIGEgYmxvY2sgKGhhcyAjIGluIGxpbmspXHJcbiAgICAgICAgaWYoZmlsZVtqXS5saW5rLmluZGV4T2YoXCIjXCIpID4gLTEpIHtcclxuICAgICAgICAgIGNvbnN0IGJsb2NrID0gZmlsZVtqXTtcclxuICAgICAgICAgIGNvbnN0IGJsb2NrX2xpbmsgPSBmaWxlX2xpbmtfbGlzdC5jcmVhdGVFbChcImxpXCIsIHtcclxuICAgICAgICAgICAgY2xzOiBcInNlYXJjaC1yZXN1bHQtZmlsZS10aXRsZSBpcy1jbGlja2FibGVcIixcclxuICAgICAgICAgICAgdGl0bGU6IGJsb2NrLmxpbmssXHJcbiAgICAgICAgICB9KTtcclxuICAgICAgICAgIC8vIHNraXAgYmxvY2sgY29udGV4dCBpZiBmaWxlLmxlbmd0aCA9PT0gMSBiZWNhdXNlIGFscmVhZHkgYWRkZWRcclxuICAgICAgICAgIGlmKGZpbGUubGVuZ3RoID4gMSkge1xyXG4gICAgICAgICAgICBjb25zdCBibG9ja19jb250ZXh0ID0gdGhpcy5yZW5kZXJfYmxvY2tfY29udGV4dChibG9jayk7XHJcbiAgICAgICAgICAgIGNvbnN0IGJsb2NrX3NpbWlsYXJpdHlfcGN0ID0gTWF0aC5yb3VuZChibG9jay5zaW1pbGFyaXR5ICogMTAwKSArIFwiJVwiO1xyXG4gICAgICAgICAgICBibG9ja19saW5rLmlubmVySFRNTCA9IGA8c21hbGw+JHtibG9ja19jb250ZXh0fSB8ICR7YmxvY2tfc2ltaWxhcml0eV9wY3R9PC9zbWFsbD5gO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgICAgY29uc3QgYmxvY2tfY29udGFpbmVyID0gYmxvY2tfbGluay5jcmVhdGVFbChcImRpdlwiKTtcclxuICAgICAgICAgIC8vIFRPRE86IG1vdmUgdG8gcmVuZGVyaW5nIG9uIGV4cGFuZGluZyBzZWN0aW9uICh0b2dnbGUgY29sbGFwc2VkKVxyXG4gICAgICAgICAgT2JzaWRpYW4uTWFya2Rvd25SZW5kZXJlci5yZW5kZXJNYXJrZG93bigoYXdhaXQgdGhpcy5ibG9ja19yZXRyaWV2ZXIoYmxvY2subGluaywge2xpbmVzOiAxMCwgbWF4X2NoYXJzOiAxMDAwfSkpLCBibG9ja19jb250YWluZXIsIGJsb2NrLmxpbmssIG5ldyBPYnNpZGlhbi5Db21wb25lbnQoKSk7XHJcbiAgICAgICAgICAvLyBhZGQgbGluayBsaXN0ZW5lcnMgdG8gYmxvY2sgbGlua1xyXG4gICAgICAgICAgdGhpcy5hZGRfbGlua19saXN0ZW5lcnMoYmxvY2tfbGluaywgYmxvY2ssIGZpbGVfbGlua19saXN0KTtcclxuICAgICAgICB9ZWxzZXtcclxuICAgICAgICAgIC8vIGdldCBmaXJzdCB0ZW4gbGluZXMgb2YgZmlsZVxyXG4gICAgICAgICAgY29uc3QgZmlsZV9saW5rX2xpc3QgPSBpdGVtLmNyZWF0ZUVsKFwidWxcIik7XHJcbiAgICAgICAgICBjb25zdCBibG9ja19saW5rID0gZmlsZV9saW5rX2xpc3QuY3JlYXRlRWwoXCJsaVwiLCB7XHJcbiAgICAgICAgICAgIGNsczogXCJzZWFyY2gtcmVzdWx0LWZpbGUtdGl0bGUgaXMtY2xpY2thYmxlXCIsXHJcbiAgICAgICAgICAgIHRpdGxlOiBmaWxlWzBdLmxpbmssXHJcbiAgICAgICAgICB9KTtcclxuICAgICAgICAgIGNvbnN0IGJsb2NrX2NvbnRhaW5lciA9IGJsb2NrX2xpbmsuY3JlYXRlRWwoXCJkaXZcIik7XHJcbiAgICAgICAgICBsZXQgZmlyc3RfdGVuX2xpbmVzID0gYXdhaXQgdGhpcy5maWxlX3JldHJpZXZlcihmaWxlWzBdLmxpbmssIHtsaW5lczogMTAsIG1heF9jaGFyczogMTAwMH0pO1xyXG4gICAgICAgICAgaWYoIWZpcnN0X3Rlbl9saW5lcykgY29udGludWU7IC8vIGlmIGZpbGUgbm90IGZvdW5kLCBza2lwXHJcbiAgICAgICAgICBPYnNpZGlhbi5NYXJrZG93blJlbmRlcmVyLnJlbmRlck1hcmtkb3duKGZpcnN0X3Rlbl9saW5lcywgYmxvY2tfY29udGFpbmVyLCBmaWxlWzBdLmxpbmssIG5ldyBPYnNpZGlhbi5Db21wb25lbnQoKSk7XHJcbiAgICAgICAgICB0aGlzLmFkZF9saW5rX2xpc3RlbmVycyhibG9ja19saW5rLCBmaWxlWzBdLCBmaWxlX2xpbmtfbGlzdCk7XHJcblxyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgfVxyXG4gICAgdGhpcy5yZW5kZXJfYnJhbmQoY29udGFpbmVyLCBcImZpbGVcIik7XHJcbiAgfVxyXG5cclxuICBhZGRfbGlua19saXN0ZW5lcnMoaXRlbSwgY3VyciwgbGlzdCkge1xyXG4gICAgaXRlbS5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgYXN5bmMgKGV2ZW50KSA9PiB7XHJcbiAgICAgIGF3YWl0IHRoaXMub3Blbl9ub3RlKGN1cnIsIGV2ZW50KTtcclxuICAgIH0pO1xyXG4gICAgLy8gZHJhZy1vblxyXG4gICAgLy8gY3VycmVudGx5IG9ubHkgd29ya3Mgd2l0aCBmdWxsLWZpbGUgbGlua3NcclxuICAgIGl0ZW0uc2V0QXR0cignZHJhZ2dhYmxlJywgJ3RydWUnKTtcclxuICAgIGl0ZW0uYWRkRXZlbnRMaXN0ZW5lcignZHJhZ3N0YXJ0JywgKGV2ZW50KSA9PiB7XHJcbiAgICAgIGNvbnN0IGRyYWdNYW5hZ2VyID0gdGhpcy5hcHAuZHJhZ01hbmFnZXI7XHJcbiAgICAgIGNvbnN0IGZpbGVfcGF0aCA9IGN1cnIubGluay5zcGxpdChcIiNcIilbMF07XHJcbiAgICAgIGNvbnN0IGZpbGUgPSB0aGlzLmFwcC5tZXRhZGF0YUNhY2hlLmdldEZpcnN0TGlua3BhdGhEZXN0KGZpbGVfcGF0aCwgJycpO1xyXG4gICAgICBjb25zdCBkcmFnRGF0YSA9IGRyYWdNYW5hZ2VyLmRyYWdGaWxlKGV2ZW50LCBmaWxlKTtcclxuICAgICAgLy8gY29uc29sZS5sb2coZHJhZ0RhdGEpO1xyXG4gICAgICBkcmFnTWFuYWdlci5vbkRyYWdTdGFydChldmVudCwgZHJhZ0RhdGEpO1xyXG4gICAgfSk7XHJcbiAgICAvLyBpZiBjdXJyLmxpbmsgY29udGFpbnMgY3VybHkgYnJhY2VzLCByZXR1cm4gKGluY29tcGF0aWJsZSB3aXRoIGhvdmVyLWxpbmspXHJcbiAgICBpZiAoY3Vyci5saW5rLmluZGV4T2YoXCJ7XCIpID4gLTEpIHJldHVybjtcclxuICAgIC8vIHRyaWdnZXIgaG92ZXIgZXZlbnQgb24gbGlua1xyXG4gICAgaXRlbS5hZGRFdmVudExpc3RlbmVyKFwibW91c2VvdmVyXCIsIChldmVudCkgPT4ge1xyXG4gICAgICB0aGlzLmFwcC53b3Jrc3BhY2UudHJpZ2dlcihcImhvdmVyLWxpbmtcIiwge1xyXG4gICAgICAgIGV2ZW50LFxyXG4gICAgICAgIHNvdXJjZTogU01BUlRfQ09OTkVDVElPTlNfVklFV19UWVBFLFxyXG4gICAgICAgIGhvdmVyUGFyZW50OiBsaXN0LFxyXG4gICAgICAgIHRhcmdldEVsOiBpdGVtLFxyXG4gICAgICAgIGxpbmt0ZXh0OiBjdXJyLmxpbmssXHJcbiAgICAgIH0pO1xyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICAvLyBnZXQgdGFyZ2V0IGZpbGUgZnJvbSBsaW5rIHBhdGhcclxuICAvLyBpZiBzdWItc2VjdGlvbiBpcyBsaW5rZWQsIG9wZW4gZmlsZSBhbmQgc2Nyb2xsIHRvIHN1Yi1zZWN0aW9uXHJcbiAgYXN5bmMgb3Blbl9ub3RlKGN1cnIsIGV2ZW50PW51bGwpIHtcclxuICAgIGxldCB0YXJnZXRGaWxlO1xyXG4gICAgbGV0IGhlYWRpbmc7XHJcbiAgICBpZiAoY3Vyci5saW5rLmluZGV4T2YoXCIjXCIpID4gLTEpIHtcclxuICAgICAgLy8gcmVtb3ZlIGFmdGVyICMgZnJvbSBsaW5rXHJcbiAgICAgIHRhcmdldEZpbGUgPSB0aGlzLmFwcC5tZXRhZGF0YUNhY2hlLmdldEZpcnN0TGlua3BhdGhEZXN0KGN1cnIubGluay5zcGxpdChcIiNcIilbMF0sIFwiXCIpO1xyXG4gICAgICAvLyBjb25zb2xlLmxvZyh0YXJnZXRGaWxlKTtcclxuICAgICAgY29uc3QgdGFyZ2V0X2ZpbGVfY2FjaGUgPSB0aGlzLmFwcC5tZXRhZGF0YUNhY2hlLmdldEZpbGVDYWNoZSh0YXJnZXRGaWxlKTtcclxuICAgICAgLy8gY29uc29sZS5sb2codGFyZ2V0X2ZpbGVfY2FjaGUpO1xyXG4gICAgICAvLyBnZXQgaGVhZGluZ1xyXG4gICAgICBsZXQgaGVhZGluZ190ZXh0ID0gY3Vyci5saW5rLnNwbGl0KFwiI1wiKS5wb3AoKTtcclxuICAgICAgLy8gaWYgaGVhZGluZyB0ZXh0IGNvbnRhaW5zIGEgY3VybHkgYnJhY2UsIGdldCB0aGUgbnVtYmVyIGluc2lkZSB0aGUgY3VybHkgYnJhY2VzIGFzIG9jY3VyZW5jZVxyXG4gICAgICBsZXQgb2NjdXJlbmNlID0gMDtcclxuICAgICAgaWYgKGhlYWRpbmdfdGV4dC5pbmRleE9mKFwie1wiKSA+IC0xKSB7XHJcbiAgICAgICAgLy8gZ2V0IG9jY3VyZW5jZVxyXG4gICAgICAgIG9jY3VyZW5jZSA9IHBhcnNlSW50KGhlYWRpbmdfdGV4dC5zcGxpdChcIntcIilbMV0uc3BsaXQoXCJ9XCIpWzBdKTtcclxuICAgICAgICAvLyByZW1vdmUgb2NjdXJlbmNlIGZyb20gaGVhZGluZyB0ZXh0XHJcbiAgICAgICAgaGVhZGluZ190ZXh0ID0gaGVhZGluZ190ZXh0LnNwbGl0KFwie1wiKVswXTtcclxuICAgICAgfVxyXG4gICAgICAvLyBnZXQgaGVhZGluZ3MgZnJvbSBmaWxlIGNhY2hlXHJcbiAgICAgIGNvbnN0IGhlYWRpbmdzID0gdGFyZ2V0X2ZpbGVfY2FjaGUuaGVhZGluZ3M7XHJcbiAgICAgIC8vIGdldCBoZWFkaW5ncyB3aXRoIHRoZSBzYW1lIGRlcHRoIGFuZCB0ZXh0IGFzIHRoZSBsaW5rXHJcbiAgICAgIGZvcihsZXQgaSA9IDA7IGkgPCBoZWFkaW5ncy5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgIGlmIChoZWFkaW5nc1tpXS5oZWFkaW5nID09PSBoZWFkaW5nX3RleHQpIHtcclxuICAgICAgICAgIC8vIGlmIG9jY3VyZW5jZSBpcyAwLCBzZXQgaGVhZGluZyBhbmQgYnJlYWtcclxuICAgICAgICAgIGlmKG9jY3VyZW5jZSA9PT0gMCkge1xyXG4gICAgICAgICAgICBoZWFkaW5nID0gaGVhZGluZ3NbaV07XHJcbiAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgICAgb2NjdXJlbmNlLS07IC8vIGRlY3JlbWVudCBvY2N1cmVuY2VcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgICAgLy8gY29uc29sZS5sb2coaGVhZGluZyk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICB0YXJnZXRGaWxlID0gdGhpcy5hcHAubWV0YWRhdGFDYWNoZS5nZXRGaXJzdExpbmtwYXRoRGVzdChjdXJyLmxpbmssIFwiXCIpO1xyXG4gICAgfVxyXG4gICAgbGV0IGxlYWY7XHJcbiAgICBpZihldmVudCkge1xyXG4gICAgICAvLyBwcm9wZXJseSBoYW5kbGUgaWYgdGhlIG1ldGEvY3RybCBrZXkgaXMgcHJlc3NlZFxyXG4gICAgICBjb25zdCBtb2QgPSBPYnNpZGlhbi5LZXltYXAuaXNNb2RFdmVudChldmVudCk7XHJcbiAgICAgIC8vIGdldCBtb3N0IHJlY2VudCBsZWFmXHJcbiAgICAgIGxlYWYgPSB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0TGVhZihtb2QpO1xyXG4gICAgfWVsc2V7XHJcbiAgICAgIC8vIGdldCBtb3N0IHJlY2VudCBsZWFmXHJcbiAgICAgIGxlYWYgPSB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0TW9zdFJlY2VudExlYWYoKTtcclxuICAgIH1cclxuICAgIGF3YWl0IGxlYWYub3BlbkZpbGUodGFyZ2V0RmlsZSk7XHJcbiAgICBpZiAoaGVhZGluZykge1xyXG4gICAgICBsZXQgeyBlZGl0b3IgfSA9IGxlYWYudmlldztcclxuICAgICAgY29uc3QgcG9zID0geyBsaW5lOiBoZWFkaW5nLnBvc2l0aW9uLnN0YXJ0LmxpbmUsIGNoOiAwIH07XHJcbiAgICAgIGVkaXRvci5zZXRDdXJzb3IocG9zKTtcclxuICAgICAgZWRpdG9yLnNjcm9sbEludG9WaWV3KHsgdG86IHBvcywgZnJvbTogcG9zIH0sIHRydWUpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgcmVuZGVyX2Jsb2NrX2NvbnRleHQoYmxvY2spIHtcclxuICAgIGNvbnN0IGJsb2NrX2hlYWRpbmdzID0gYmxvY2subGluay5zcGxpdChcIi5tZFwiKVsxXS5zcGxpdChcIiNcIik7XHJcbiAgICAvLyBzdGFydGluZyB3aXRoIHRoZSBsYXN0IGhlYWRpbmcgZmlyc3QsIGl0ZXJhdGUgdGhyb3VnaCBoZWFkaW5nc1xyXG4gICAgbGV0IGJsb2NrX2NvbnRleHQgPSBcIlwiO1xyXG4gICAgZm9yIChsZXQgaSA9IGJsb2NrX2hlYWRpbmdzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XHJcbiAgICAgIGlmKGJsb2NrX2NvbnRleHQubGVuZ3RoID4gMCkge1xyXG4gICAgICAgIGJsb2NrX2NvbnRleHQgPSBgID4gJHtibG9ja19jb250ZXh0fWA7XHJcbiAgICAgIH1cclxuICAgICAgYmxvY2tfY29udGV4dCA9IGJsb2NrX2hlYWRpbmdzW2ldICsgYmxvY2tfY29udGV4dDtcclxuICAgICAgLy8gaWYgYmxvY2sgY29udGV4dCBpcyBsb25nZXIgdGhhbiBOIGNoYXJhY3RlcnMsIGJyZWFrXHJcbiAgICAgIGlmIChibG9ja19jb250ZXh0Lmxlbmd0aCA+IDEwMCkge1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgICAvLyByZW1vdmUgbGVhZGluZyA+IGlmIGV4aXN0c1xyXG4gICAgaWYgKGJsb2NrX2NvbnRleHQuc3RhcnRzV2l0aChcIiA+IFwiKSkge1xyXG4gICAgICBibG9ja19jb250ZXh0ID0gYmxvY2tfY29udGV4dC5zbGljZSgzKTtcclxuICAgIH1cclxuICAgIHJldHVybiBibG9ja19jb250ZXh0O1xyXG5cclxuICB9XHJcblxyXG4gIHJlbmRlcmFibGVfZmlsZV90eXBlKGxpbmspIHtcclxuICAgIHJldHVybiAobGluay5pbmRleE9mKFwiLm1kXCIpICE9PSAtMSkgJiYgKGxpbmsuaW5kZXhPZihcIi5leGNhbGlkcmF3XCIpID09PSAtMSk7XHJcbiAgfVxyXG5cclxuICByZW5kZXJfZXh0ZXJuYWxfbGlua19lbG0obWV0YSl7XHJcbiAgICBpZihtZXRhLnNvdXJjZSkge1xyXG4gICAgICBpZihtZXRhLnNvdXJjZSA9PT0gXCJHbWFpbFwiKSBtZXRhLnNvdXJjZSA9IFwiXHVEODNEXHVEQ0U3IEdtYWlsXCI7XHJcbiAgICAgIHJldHVybiBgPHNtYWxsPiR7bWV0YS5zb3VyY2V9PC9zbWFsbD48YnI+JHttZXRhLnRpdGxlfWA7XHJcbiAgICB9XHJcbiAgICAvLyByZW1vdmUgaHR0cChzKTovL1xyXG4gICAgbGV0IGRvbWFpbiA9IG1ldGEucGF0aC5yZXBsYWNlKC8oXlxcdys6fF4pXFwvXFwvLywgXCJcIik7XHJcbiAgICAvLyBzZXBhcmF0ZSBkb21haW4gZnJvbSBwYXRoXHJcbiAgICBkb21haW4gPSBkb21haW4uc3BsaXQoXCIvXCIpWzBdO1xyXG4gICAgLy8gd3JhcCBkb21haW4gaW4gPHNtYWxsPiBhbmQgYWRkIGxpbmUgYnJlYWtcclxuICAgIHJldHVybiBgPHNtYWxsPlx1RDgzQ1x1REYxMCAke2RvbWFpbn08L3NtYWxsPjxicj4ke21ldGEudGl0bGV9YDtcclxuICB9XHJcbiAgLy8gZ2V0IGFsbCBmb2xkZXJzXHJcbiAgYXN5bmMgZ2V0X2FsbF9mb2xkZXJzKCkge1xyXG4gICAgaWYoIXRoaXMuZm9sZGVycyB8fCB0aGlzLmZvbGRlcnMubGVuZ3RoID09PSAwKXtcclxuICAgICAgdGhpcy5mb2xkZXJzID0gYXdhaXQgdGhpcy5nZXRfZm9sZGVycygpO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIHRoaXMuZm9sZGVycztcclxuICB9XHJcbiAgLy8gZ2V0IGZvbGRlcnMsIHRyYXZlcnNlIG5vbi1oaWRkZW4gc3ViLWZvbGRlcnNcclxuICBhc3luYyBnZXRfZm9sZGVycyhwYXRoID0gXCIvXCIpIHtcclxuICAgIGxldCBmb2xkZXJzID0gKGF3YWl0IHRoaXMuYXBwLnZhdWx0LmFkYXB0ZXIubGlzdChwYXRoKSkuZm9sZGVycztcclxuICAgIGxldCBmb2xkZXJfbGlzdCA9IFtdO1xyXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBmb2xkZXJzLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgIGlmIChmb2xkZXJzW2ldLnN0YXJ0c1dpdGgoXCIuXCIpKSBjb250aW51ZTtcclxuICAgICAgZm9sZGVyX2xpc3QucHVzaChmb2xkZXJzW2ldKTtcclxuICAgICAgZm9sZGVyX2xpc3QgPSBmb2xkZXJfbGlzdC5jb25jYXQoYXdhaXQgdGhpcy5nZXRfZm9sZGVycyhmb2xkZXJzW2ldICsgXCIvXCIpKTtcclxuICAgIH1cclxuICAgIHJldHVybiBmb2xkZXJfbGlzdDtcclxuICB9XHJcblxyXG5cclxuICBhc3luYyBzeW5jX25vdGVzKCkge1xyXG4gICAgLy8gaWYgbGljZW5zZSBrZXkgaXMgbm90IHNldCwgcmV0dXJuXHJcbiAgICBpZighdGhpcy5zZXR0aW5ncy5saWNlbnNlX2tleSl7XHJcbiAgICAgIG5ldyBPYnNpZGlhbi5Ob3RpY2UoXCJTbWFydCBDb25uZWN0aW9uczogU3VwcG9ydGVyIGxpY2Vuc2Uga2V5IGlzIHJlcXVpcmVkIHRvIHN5bmMgbm90ZXMgdG8gdGhlIENoYXRHUFQgUGx1Z2luIHNlcnZlci5cIik7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuICAgIGNvbnNvbGUubG9nKFwic3luY2luZyBub3Rlc1wiKTtcclxuICAgIC8vIGdldCBhbGwgZmlsZXMgaW4gdmF1bHRcclxuICAgIGNvbnN0IGZpbGVzID0gdGhpcy5hcHAudmF1bHQuZ2V0TWFya2Rvd25GaWxlcygpLmZpbHRlcigoZmlsZSkgPT4ge1xyXG4gICAgICAvLyBmaWx0ZXIgb3V0IGZpbGUgcGF0aHMgbWF0Y2hpbmcgYW55IHN0cmluZ3MgaW4gdGhpcy5maWxlX2V4Y2x1c2lvbnNcclxuICAgICAgZm9yKGxldCBpID0gMDsgaSA8IHRoaXMuZmlsZV9leGNsdXNpb25zLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgaWYoZmlsZS5wYXRoLmluZGV4T2YodGhpcy5maWxlX2V4Y2x1c2lvbnNbaV0pID4gLTEpIHtcclxuICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICB9KTtcclxuICAgIGNvbnN0IG5vdGVzID0gYXdhaXQgdGhpcy5idWlsZF9ub3Rlc19vYmplY3QoZmlsZXMpO1xyXG4gICAgY29uc29sZS5sb2coXCJvYmplY3QgYnVpbHRcIik7XHJcbiAgICAvLyBzYXZlIG5vdGVzIG9iamVjdCB0byAuc21hcnQtY29ubmVjdGlvbnMvbm90ZXMuanNvblxyXG4gICAgYXdhaXQgdGhpcy5hcHAudmF1bHQuYWRhcHRlci53cml0ZShcIi5zbWFydC1jb25uZWN0aW9ucy9ub3Rlcy5qc29uXCIsIEpTT04uc3RyaW5naWZ5KG5vdGVzLCBudWxsLCAyKSk7XHJcbiAgICBjb25zb2xlLmxvZyhcIm5vdGVzIHNhdmVkXCIpO1xyXG4gICAgY29uc29sZS5sb2codGhpcy5zZXR0aW5ncy5saWNlbnNlX2tleSk7XHJcbiAgICAvLyBQT1NUIG5vdGVzIG9iamVjdCB0byBzZXJ2ZXJcclxuICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgKDAsIE9ic2lkaWFuLnJlcXVlc3RVcmwpKHtcclxuICAgICAgdXJsOiBcImh0dHBzOi8vc3luYy5zbWFydGNvbm5lY3Rpb25zLmFwcC9zeW5jXCIsXHJcbiAgICAgIG1ldGhvZDogXCJQT1NUXCIsXHJcbiAgICAgIGhlYWRlcnM6IHtcclxuICAgICAgICBcIkNvbnRlbnQtVHlwZVwiOiBcImFwcGxpY2F0aW9uL2pzb25cIixcclxuICAgICAgfSxcclxuICAgICAgY29udGVudFR5cGU6IFwiYXBwbGljYXRpb24vanNvblwiLFxyXG4gICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7XHJcbiAgICAgICAgbGljZW5zZV9rZXk6IHRoaXMuc2V0dGluZ3MubGljZW5zZV9rZXksXHJcbiAgICAgICAgbm90ZXM6IG5vdGVzXHJcbiAgICAgIH0pXHJcbiAgICB9KTtcclxuICAgIGNvbnNvbGUubG9nKHJlc3BvbnNlKTtcclxuXHJcbiAgfVxyXG5cclxuICBhc3luYyBidWlsZF9ub3Rlc19vYmplY3QoZmlsZXMpIHtcclxuICAgIGxldCBvdXRwdXQgPSB7fTtcclxuXHJcbiAgICBmb3IobGV0IGkgPSAwOyBpIDwgZmlsZXMubGVuZ3RoOyBpKyspIHtcclxuICAgICAgbGV0IGZpbGUgPSBmaWxlc1tpXTtcclxuICAgICAgbGV0IHBhcnRzID0gZmlsZS5wYXRoLnNwbGl0KFwiL1wiKTtcclxuICAgICAgbGV0IGN1cnJlbnQgPSBvdXRwdXQ7XHJcblxyXG4gICAgICBmb3IgKGxldCBpaSA9IDA7IGlpIDwgcGFydHMubGVuZ3RoOyBpaSsrKSB7XHJcbiAgICAgICAgbGV0IHBhcnQgPSBwYXJ0c1tpaV07XHJcblxyXG4gICAgICAgIGlmIChpaSA9PT0gcGFydHMubGVuZ3RoIC0gMSkge1xyXG4gICAgICAgICAgLy8gVGhpcyBpcyBhIGZpbGVcclxuICAgICAgICAgIGN1cnJlbnRbcGFydF0gPSBhd2FpdCB0aGlzLmFwcC52YXVsdC5jYWNoZWRSZWFkKGZpbGUpO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAvLyBUaGlzIGlzIGEgZGlyZWN0b3J5XHJcbiAgICAgICAgICBpZiAoIWN1cnJlbnRbcGFydF0pIHtcclxuICAgICAgICAgICAgY3VycmVudFtwYXJ0XSA9IHt9O1xyXG4gICAgICAgICAgfVxyXG5cclxuICAgICAgICAgIGN1cnJlbnQgPSBjdXJyZW50W3BhcnRdO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiBvdXRwdXQ7XHJcbiAgfVxyXG5cclxufVxyXG5cclxuY29uc3QgU01BUlRfQ09OTkVDVElPTlNfVklFV19UWVBFID0gXCJzbWFydC1jb25uZWN0aW9ucy12aWV3XCI7XHJcbmNsYXNzIFNtYXJ0Q29ubmVjdGlvbnNWaWV3IGV4dGVuZHMgT2JzaWRpYW4uSXRlbVZpZXcge1xyXG4gIGNvbnN0cnVjdG9yKGxlYWYsIHBsdWdpbikge1xyXG4gICAgc3VwZXIobGVhZik7XHJcbiAgICB0aGlzLnBsdWdpbiA9IHBsdWdpbjtcclxuICAgIHRoaXMubmVhcmVzdCA9IG51bGw7XHJcbiAgICB0aGlzLmxvYWRfd2FpdCA9IG51bGw7XHJcbiAgfVxyXG4gIGdldFZpZXdUeXBlKCkge1xyXG4gICAgcmV0dXJuIFNNQVJUX0NPTk5FQ1RJT05TX1ZJRVdfVFlQRTtcclxuICB9XHJcblxyXG4gIGdldERpc3BsYXlUZXh0KCkge1xyXG4gICAgcmV0dXJuIFwiU21hcnQgQ29ubmVjdGlvbnMgRmlsZXNcIjtcclxuICB9XHJcblxyXG4gIGdldEljb24oKSB7XHJcbiAgICByZXR1cm4gXCJzbWFydC1jb25uZWN0aW9uc1wiO1xyXG4gIH1cclxuXHJcblxyXG4gIHNldF9tZXNzYWdlKG1lc3NhZ2UpIHtcclxuICAgIGNvbnN0IGNvbnRhaW5lciA9IHRoaXMuY29udGFpbmVyRWwuY2hpbGRyZW5bMV07XHJcbiAgICAvLyBjbGVhciBjb250YWluZXJcclxuICAgIGNvbnRhaW5lci5lbXB0eSgpO1xyXG4gICAgLy8gaW5pdGlhdGUgdG9wIGJhclxyXG4gICAgdGhpcy5pbml0aWF0ZV90b3BfYmFyKGNvbnRhaW5lcik7XHJcbiAgICAvLyBpZiBtZXNhZ2UgaXMgYW4gYXJyYXksIGxvb3AgdGhyb3VnaCBhbmQgY3JlYXRlIGEgbmV3IHAgZWxlbWVudCBmb3IgZWFjaCBtZXNzYWdlXHJcbiAgICBpZiAoQXJyYXkuaXNBcnJheShtZXNzYWdlKSkge1xyXG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG1lc3NhZ2UubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICBjb250YWluZXIuY3JlYXRlRWwoXCJwXCIsIHsgY2xzOiBcInNjX21lc3NhZ2VcIiwgdGV4dDogbWVzc2FnZVtpXSB9KTtcclxuICAgICAgfVxyXG4gICAgfWVsc2V7XHJcbiAgICAgIC8vIGNyZWF0ZSBwIGVsZW1lbnQgd2l0aCBtZXNzYWdlXHJcbiAgICAgIGNvbnRhaW5lci5jcmVhdGVFbChcInBcIiwgeyBjbHM6IFwic2NfbWVzc2FnZVwiLCB0ZXh0OiBtZXNzYWdlIH0pO1xyXG4gICAgfVxyXG4gIH1cclxuICByZW5kZXJfbGlua190ZXh0KGxpbmssIHNob3dfZnVsbF9wYXRoPWZhbHNlKSB7XHJcbiAgICAvKipcclxuICAgICAqIEJlZ2luIGludGVybmFsIGxpbmtzXHJcbiAgICAgKi9cclxuICAgIC8vIGlmIHNob3cgZnVsbCBwYXRoIGlzIGZhbHNlLCByZW1vdmUgZmlsZSBwYXRoXHJcbiAgICBpZiAoIXNob3dfZnVsbF9wYXRoKSB7XHJcbiAgICAgIGxpbmsgPSBsaW5rLnNwbGl0KFwiL1wiKS5wb3AoKTtcclxuICAgIH1cclxuICAgIC8vIGlmIGNvbnRhaW5zICcjJ1xyXG4gICAgaWYgKGxpbmsuaW5kZXhPZihcIiNcIikgPiAtMSkge1xyXG4gICAgICAvLyBzcGxpdCBhdCAubWRcclxuICAgICAgbGluayA9IGxpbmsuc3BsaXQoXCIubWRcIik7XHJcbiAgICAgIC8vIHdyYXAgZmlyc3QgcGFydCBpbiA8c21hbGw+IGFuZCBhZGQgbGluZSBicmVha1xyXG4gICAgICBsaW5rWzBdID0gYDxzbWFsbD4ke2xpbmtbMF19PC9zbWFsbD48YnI+YDtcclxuICAgICAgLy8gam9pbiBiYWNrIHRvZ2V0aGVyXHJcbiAgICAgIGxpbmsgPSBsaW5rLmpvaW4oXCJcIik7XHJcbiAgICAgIC8vIHJlcGxhY2UgJyMnIHdpdGggJyBcdTAwQkIgJ1xyXG4gICAgICBsaW5rID0gbGluay5yZXBsYWNlKC9cXCMvZywgXCIgXHUwMEJCIFwiKTtcclxuICAgIH1lbHNle1xyXG4gICAgICAvLyByZW1vdmUgJy5tZCdcclxuICAgICAgbGluayA9IGxpbmsucmVwbGFjZShcIi5tZFwiLCBcIlwiKTtcclxuICAgIH1cclxuICAgIHJldHVybiBsaW5rO1xyXG4gIH1cclxuXHJcblxyXG4gIHNldF9uZWFyZXN0KG5lYXJlc3QsIG5lYXJlc3RfY29udGV4dD1udWxsLCByZXN1bHRzX29ubHk9ZmFsc2UpIHtcclxuICAgIC8vIGdldCBjb250YWluZXIgZWxlbWVudFxyXG4gICAgY29uc3QgY29udGFpbmVyID0gdGhpcy5jb250YWluZXJFbC5jaGlsZHJlblsxXTtcclxuICAgIC8vIGlmIHJlc3VsdHMgb25seSBpcyBmYWxzZSwgY2xlYXIgY29udGFpbmVyIGFuZCBpbml0aWF0ZSB0b3AgYmFyXHJcbiAgICBpZighcmVzdWx0c19vbmx5KXtcclxuICAgICAgLy8gY2xlYXIgY29udGFpbmVyXHJcbiAgICAgIGNvbnRhaW5lci5lbXB0eSgpO1xyXG4gICAgICB0aGlzLmluaXRpYXRlX3RvcF9iYXIoY29udGFpbmVyLCBuZWFyZXN0X2NvbnRleHQpO1xyXG4gICAgfVxyXG4gICAgLy8gdXBkYXRlIHJlc3VsdHNcclxuICAgIHRoaXMucGx1Z2luLnVwZGF0ZV9yZXN1bHRzKGNvbnRhaW5lciwgbmVhcmVzdCk7XHJcbiAgfVxyXG5cclxuICBpbml0aWF0ZV90b3BfYmFyKGNvbnRhaW5lciwgbmVhcmVzdF9jb250ZXh0PW51bGwpIHtcclxuICAgIGxldCB0b3BfYmFyO1xyXG4gICAgLy8gaWYgdG9wIGJhciBhbHJlYWR5IGV4aXN0cywgZW1wdHkgaXRcclxuICAgIGlmICgoY29udGFpbmVyLmNoaWxkcmVuLmxlbmd0aCA+IDApICYmIChjb250YWluZXIuY2hpbGRyZW5bMF0uY2xhc3NMaXN0LmNvbnRhaW5zKFwic2MtdG9wLWJhclwiKSkpIHtcclxuICAgICAgdG9wX2JhciA9IGNvbnRhaW5lci5jaGlsZHJlblswXTtcclxuICAgICAgdG9wX2Jhci5lbXB0eSgpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgLy8gaW5pdCBjb250YWluZXIgZm9yIHRvcCBiYXJcclxuICAgICAgdG9wX2JhciA9IGNvbnRhaW5lci5jcmVhdGVFbChcImRpdlwiLCB7IGNsczogXCJzYy10b3AtYmFyXCIgfSk7XHJcbiAgICB9XHJcbiAgICAvLyBpZiBoaWdobGlnaHRlZCB0ZXh0IGlzIG5vdCBudWxsLCBjcmVhdGUgcCBlbGVtZW50IHdpdGggaGlnaGxpZ2h0ZWQgdGV4dFxyXG4gICAgaWYgKG5lYXJlc3RfY29udGV4dCkge1xyXG4gICAgICB0b3BfYmFyLmNyZWF0ZUVsKFwicFwiLCB7IGNsczogXCJzYy1jb250ZXh0XCIsIHRleHQ6IG5lYXJlc3RfY29udGV4dCB9KTtcclxuICAgIH1cclxuICAgIC8vIGFkZCBjaGF0IGJ1dHRvblxyXG4gICAgY29uc3QgY2hhdF9idXR0b24gPSB0b3BfYmFyLmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHsgY2xzOiBcInNjLWNoYXQtYnV0dG9uXCIgfSk7XHJcbiAgICAvLyBhZGQgaWNvbiB0byBjaGF0IGJ1dHRvblxyXG4gICAgT2JzaWRpYW4uc2V0SWNvbihjaGF0X2J1dHRvbiwgXCJtZXNzYWdlLXNxdWFyZVwiKTtcclxuICAgIC8vIGFkZCBjbGljayBsaXN0ZW5lciB0byBjaGF0IGJ1dHRvblxyXG4gICAgY2hhdF9idXR0b24uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHtcclxuICAgICAgLy8gb3BlbiBjaGF0XHJcbiAgICAgIHRoaXMucGx1Z2luLm9wZW5fY2hhdCgpO1xyXG4gICAgfSk7XHJcbiAgICAvLyBhZGQgc2VhcmNoIGJ1dHRvblxyXG4gICAgY29uc3Qgc2VhcmNoX2J1dHRvbiA9IHRvcF9iYXIuY3JlYXRlRWwoXCJidXR0b25cIiwgeyBjbHM6IFwic2Mtc2VhcmNoLWJ1dHRvblwiIH0pO1xyXG4gICAgLy8gYWRkIGljb24gdG8gc2VhcmNoIGJ1dHRvblxyXG4gICAgT2JzaWRpYW4uc2V0SWNvbihzZWFyY2hfYnV0dG9uLCBcInNlYXJjaFwiKTtcclxuICAgIC8vIGFkZCBjbGljayBsaXN0ZW5lciB0byBzZWFyY2ggYnV0dG9uXHJcbiAgICBzZWFyY2hfYnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiB7XHJcbiAgICAgIC8vIGVtcHR5IHRvcCBiYXJcclxuICAgICAgdG9wX2Jhci5lbXB0eSgpO1xyXG4gICAgICAvLyBjcmVhdGUgaW5wdXQgZWxlbWVudFxyXG4gICAgICBjb25zdCBzZWFyY2hfY29udGFpbmVyID0gdG9wX2Jhci5jcmVhdGVFbChcImRpdlwiLCB7IGNsczogXCJzZWFyY2gtaW5wdXQtY29udGFpbmVyXCIgfSk7XHJcbiAgICAgIGNvbnN0IGlucHV0ID0gc2VhcmNoX2NvbnRhaW5lci5jcmVhdGVFbChcImlucHV0XCIsIHtcclxuICAgICAgICBjbHM6IFwic2Mtc2VhcmNoLWlucHV0XCIsXHJcbiAgICAgICAgdHlwZTogXCJzZWFyY2hcIixcclxuICAgICAgICBwbGFjZWhvbGRlcjogXCJUeXBlIHRvIHN0YXJ0IHNlYXJjaC4uLlwiLFxyXG4gICAgICB9KTtcclxuICAgICAgLy8gZm9jdXMgaW5wdXRcclxuICAgICAgaW5wdXQuZm9jdXMoKTtcclxuICAgICAgLy8gYWRkIGtleWRvd24gbGlzdGVuZXIgdG8gaW5wdXRcclxuICAgICAgaW5wdXQuYWRkRXZlbnRMaXN0ZW5lcihcImtleWRvd25cIiwgKGV2ZW50KSA9PiB7XHJcbiAgICAgICAgLy8gaWYgZXNjYXBlIGtleSBpcyBwcmVzc2VkXHJcbiAgICAgICAgaWYgKGV2ZW50LmtleSA9PT0gXCJFc2NhcGVcIikge1xyXG4gICAgICAgICAgdGhpcy5jbGVhcl9hdXRvX3NlYXJjaGVyKCk7XHJcbiAgICAgICAgICAvLyBjbGVhciB0b3AgYmFyXHJcbiAgICAgICAgICB0aGlzLmluaXRpYXRlX3RvcF9iYXIoY29udGFpbmVyLCBuZWFyZXN0X2NvbnRleHQpO1xyXG4gICAgICAgIH1cclxuICAgICAgfSk7XHJcblxyXG4gICAgICAvLyBhZGQga2V5dXAgbGlzdGVuZXIgdG8gaW5wdXRcclxuICAgICAgaW5wdXQuYWRkRXZlbnRMaXN0ZW5lcihcImtleXVwXCIsIChldmVudCkgPT4ge1xyXG4gICAgICAgIC8vIGlmIHRoaXMuc2VhcmNoX3RpbWVvdXQgaXMgbm90IG51bGwgdGhlbiBjbGVhciBpdCBhbmQgc2V0IHRvIG51bGxcclxuICAgICAgICB0aGlzLmNsZWFyX2F1dG9fc2VhcmNoZXIoKTtcclxuICAgICAgICAvLyBnZXQgc2VhcmNoIHRlcm1cclxuICAgICAgICBjb25zdCBzZWFyY2hfdGVybSA9IGlucHV0LnZhbHVlO1xyXG4gICAgICAgIC8vIGlmIGVudGVyIGtleSBpcyBwcmVzc2VkXHJcbiAgICAgICAgaWYgKGV2ZW50LmtleSA9PT0gXCJFbnRlclwiICYmIHNlYXJjaF90ZXJtICE9PSBcIlwiKSB7XHJcbiAgICAgICAgICB0aGlzLnNlYXJjaChzZWFyY2hfdGVybSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIC8vIGlmIGFueSBvdGhlciBrZXkgaXMgcHJlc3NlZCBhbmQgaW5wdXQgaXMgbm90IGVtcHR5IHRoZW4gd2FpdCA1MDBtcyBhbmQgbWFrZV9jb25uZWN0aW9uc1xyXG4gICAgICAgIGVsc2UgaWYgKHNlYXJjaF90ZXJtICE9PSBcIlwiKSB7XHJcbiAgICAgICAgICAvLyBjbGVhciB0aW1lb3V0XHJcbiAgICAgICAgICBjbGVhclRpbWVvdXQodGhpcy5zZWFyY2hfdGltZW91dCk7XHJcbiAgICAgICAgICAvLyBzZXQgdGltZW91dFxyXG4gICAgICAgICAgdGhpcy5zZWFyY2hfdGltZW91dCA9IHNldFRpbWVvdXQoKCkgPT4ge1xyXG4gICAgICAgICAgICB0aGlzLnNlYXJjaChzZWFyY2hfdGVybSwgdHJ1ZSk7XHJcbiAgICAgICAgICB9LCA3MDApO1xyXG4gICAgICAgIH1cclxuICAgICAgfSk7XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIC8vIHJlbmRlciBidXR0b25zOiBcImNyZWF0ZVwiIGFuZCBcInJldHJ5XCIgZm9yIGxvYWRpbmcgZW1iZWRkaW5ncy5qc29uIGZpbGVcclxuICByZW5kZXJfZW1iZWRkaW5nc19idXR0b25zKCkge1xyXG4gICAgLy8gZ2V0IGNvbnRhaW5lciBlbGVtZW50XHJcbiAgICBjb25zdCBjb250YWluZXIgPSB0aGlzLmNvbnRhaW5lckVsLmNoaWxkcmVuWzFdO1xyXG4gICAgLy8gY2xlYXIgY29udGFpbmVyXHJcbiAgICBjb250YWluZXIuZW1wdHkoKTtcclxuICAgIC8vIGNyZWF0ZSBoZWFkaW5nIHRoYXQgc2F5cyBcIkVtYmVkZGluZ3MgZmlsZSBub3QgZm91bmRcIlxyXG4gICAgY29udGFpbmVyLmNyZWF0ZUVsKFwiaDJcIiwgeyBjbHM6IFwic2NIZWFkaW5nXCIsIHRleHQ6IFwiRW1iZWRkaW5ncyBmaWxlIG5vdCBmb3VuZFwiIH0pO1xyXG4gICAgLy8gY3JlYXRlIGRpdiBmb3IgYnV0dG9uc1xyXG4gICAgY29uc3QgYnV0dG9uX2RpdiA9IGNvbnRhaW5lci5jcmVhdGVFbChcImRpdlwiLCB7IGNsczogXCJzY0J1dHRvbkRpdlwiIH0pO1xyXG4gICAgLy8gY3JlYXRlIFwiY3JlYXRlXCIgYnV0dG9uXHJcbiAgICBjb25zdCBjcmVhdGVfYnV0dG9uID0gYnV0dG9uX2Rpdi5jcmVhdGVFbChcImJ1dHRvblwiLCB7IGNsczogXCJzY0J1dHRvblwiLCB0ZXh0OiBcIkNyZWF0ZSBlbWJlZGRpbmdzLmpzb25cIiB9KTtcclxuICAgIC8vIG5vdGUgdGhhdCBjcmVhdGluZyBlbWJlZGRpbmdzLmpzb24gZmlsZSB3aWxsIHRyaWdnZXIgYnVsayBlbWJlZGRpbmcgYW5kIG1heSB0YWtlIGEgd2hpbGVcclxuICAgIGJ1dHRvbl9kaXYuY3JlYXRlRWwoXCJwXCIsIHsgY2xzOiBcInNjQnV0dG9uTm90ZVwiLCB0ZXh0OiBcIldhcm5pbmc6IENyZWF0aW5nIGVtYmVkZGluZ3MuanNvbiBmaWxlIHdpbGwgdHJpZ2dlciBidWxrIGVtYmVkZGluZyBhbmQgbWF5IHRha2UgYSB3aGlsZVwiIH0pO1xyXG4gICAgLy8gY3JlYXRlIFwicmV0cnlcIiBidXR0b25cclxuICAgIGNvbnN0IHJldHJ5X2J1dHRvbiA9IGJ1dHRvbl9kaXYuY3JlYXRlRWwoXCJidXR0b25cIiwgeyBjbHM6IFwic2NCdXR0b25cIiwgdGV4dDogXCJSZXRyeVwiIH0pO1xyXG4gICAgLy8gdHJ5IHRvIGxvYWQgZW1iZWRkaW5ncy5qc29uIGZpbGUgYWdhaW5cclxuICAgIGJ1dHRvbl9kaXYuY3JlYXRlRWwoXCJwXCIsIHsgY2xzOiBcInNjQnV0dG9uTm90ZVwiLCB0ZXh0OiBcIklmIGVtYmVkZGluZ3MuanNvbiBmaWxlIGFscmVhZHkgZXhpc3RzLCBjbGljayAnUmV0cnknIHRvIGxvYWQgaXRcIiB9KTtcclxuXHJcbiAgICAvLyBhZGQgY2xpY2sgZXZlbnQgdG8gXCJjcmVhdGVcIiBidXR0b25cclxuICAgIGNyZWF0ZV9idXR0b24uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIGFzeW5jIChldmVudCkgPT4ge1xyXG4gICAgICAvLyBjcmVhdGUgZW1iZWRkaW5ncy5qc29uIGZpbGVcclxuICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc21hcnRfdmVjX2xpdGUuaW5pdF9lbWJlZGRpbmdzX2ZpbGUoKTtcclxuICAgICAgLy8gcmVsb2FkIHZpZXdcclxuICAgICAgYXdhaXQgdGhpcy5yZW5kZXJfY29ubmVjdGlvbnMoKTtcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIGFkZCBjbGljayBldmVudCB0byBcInJldHJ5XCIgYnV0dG9uXHJcbiAgICByZXRyeV9idXR0b24uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIGFzeW5jIChldmVudCkgPT4ge1xyXG4gICAgICBjb25zb2xlLmxvZyhcInJldHJ5aW5nIHRvIGxvYWQgZW1iZWRkaW5ncy5qc29uIGZpbGVcIik7XHJcbiAgICAgIC8vIHJlbG9hZCBlbWJlZGRpbmdzLmpzb24gZmlsZVxyXG4gICAgICBhd2FpdCB0aGlzLnBsdWdpbi5pbml0X3ZlY3MoKTtcclxuICAgICAgLy8gcmVsb2FkIHZpZXdcclxuICAgICAgYXdhaXQgdGhpcy5yZW5kZXJfY29ubmVjdGlvbnMoKTtcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgYXN5bmMgb25PcGVuKCkge1xyXG4gICAgY29uc3QgY29udGFpbmVyID0gdGhpcy5jb250YWluZXJFbC5jaGlsZHJlblsxXTtcclxuICAgIGNvbnRhaW5lci5lbXB0eSgpO1xyXG4gICAgLy8gcGxhY2Vob2xkZXIgdGV4dFxyXG4gICAgY29udGFpbmVyLmNyZWF0ZUVsKFwicFwiLCB7IGNsczogXCJzY1BsYWNlaG9sZGVyXCIsIHRleHQ6IFwiT3BlbiBhIG5vdGUgdG8gZmluZCBjb25uZWN0aW9ucy5cIiB9KTtcclxuXHJcbiAgICAvLyBydW5zIHdoZW4gZmlsZSBpcyBvcGVuZWRcclxuICAgIHRoaXMucGx1Z2luLnJlZ2lzdGVyRXZlbnQodGhpcy5hcHAud29ya3NwYWNlLm9uKCdmaWxlLW9wZW4nLCAoZmlsZSkgPT4ge1xyXG4gICAgICAvLyBpZiBubyBmaWxlIGlzIG9wZW4sIHJldHVyblxyXG4gICAgICBpZighZmlsZSkge1xyXG4gICAgICAgIC8vIGNvbnNvbGUubG9nKFwibm8gZmlsZSBvcGVuLCByZXR1cm5pbmdcIik7XHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgICB9XHJcbiAgICAgIC8vIHJldHVybiBpZiBmaWxlIHR5cGUgaXMgbm90IHN1cHBvcnRlZFxyXG4gICAgICBpZihTVVBQT1JURURfRklMRV9UWVBFUy5pbmRleE9mKGZpbGUuZXh0ZW5zaW9uKSA9PT0gLTEpIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5zZXRfbWVzc2FnZShbXHJcbiAgICAgICAgICBcIkZpbGU6IFwiK2ZpbGUubmFtZVxyXG4gICAgICAgICAgLFwiVW5zdXBwb3J0ZWQgZmlsZSB0eXBlIChTdXBwb3J0ZWQ6IFwiK1NVUFBPUlRFRF9GSUxFX1RZUEVTLmpvaW4oXCIsIFwiKStcIilcIlxyXG4gICAgICAgIF0pO1xyXG4gICAgICB9XHJcbiAgICAgIC8vIHJ1biByZW5kZXJfY29ubmVjdGlvbnMgYWZ0ZXIgMSBzZWNvbmQgdG8gYWxsb3cgZm9yIGZpbGUgdG8gbG9hZFxyXG4gICAgICBpZih0aGlzLmxvYWRfd2FpdCl7XHJcbiAgICAgICAgY2xlYXJUaW1lb3V0KHRoaXMubG9hZF93YWl0KTtcclxuICAgICAgfVxyXG4gICAgICB0aGlzLmxvYWRfd2FpdCA9IHNldFRpbWVvdXQoKCkgPT4ge1xyXG4gICAgICAgIHRoaXMucmVuZGVyX2Nvbm5lY3Rpb25zKGZpbGUpO1xyXG4gICAgICAgIHRoaXMubG9hZF93YWl0ID0gbnVsbDtcclxuICAgICAgfSwgMTAwMCk7XHJcblxyXG4gICAgfSkpO1xyXG5cclxuICAgIHRoaXMuYXBwLndvcmtzcGFjZS5yZWdpc3RlckhvdmVyTGlua1NvdXJjZShTTUFSVF9DT05ORUNUSU9OU19WSUVXX1RZUEUsIHtcclxuICAgICAgICBkaXNwbGF5OiAnU21hcnQgQ29ubmVjdGlvbnMgRmlsZXMnLFxyXG4gICAgICAgIGRlZmF1bHRNb2Q6IHRydWUsXHJcbiAgICB9KTtcclxuICAgIHRoaXMuYXBwLndvcmtzcGFjZS5yZWdpc3RlckhvdmVyTGlua1NvdXJjZShTTUFSVF9DT05ORUNUSU9OU19DSEFUX1ZJRVdfVFlQRSwge1xyXG4gICAgICAgIGRpc3BsYXk6ICdTbWFydCBDaGF0IExpbmtzJyxcclxuICAgICAgICBkZWZhdWx0TW9kOiB0cnVlLFxyXG4gICAgfSk7XHJcblxyXG4gICAgdGhpcy5hcHAud29ya3NwYWNlLm9uTGF5b3V0UmVhZHkodGhpcy5pbml0aWFsaXplLmJpbmQodGhpcykpO1xyXG5cclxuICB9XHJcblxyXG4gIGFzeW5jIGluaXRpYWxpemUoKSB7XHJcbiAgICB0aGlzLnNldF9tZXNzYWdlKFwiTG9hZGluZyBlbWJlZGRpbmdzIGZpbGUuLi5cIik7XHJcbiAgICBjb25zdCB2ZWNzX2ludGlhdGVkID0gYXdhaXQgdGhpcy5wbHVnaW4uaW5pdF92ZWNzKCk7XHJcbiAgICBpZih2ZWNzX2ludGlhdGVkKXtcclxuICAgICAgdGhpcy5zZXRfbWVzc2FnZShcIkVtYmVkZGluZ3MgZmlsZSBsb2FkZWQuXCIpO1xyXG4gICAgICBhd2FpdCB0aGlzLnJlbmRlcl9jb25uZWN0aW9ucygpO1xyXG4gICAgfWVsc2V7XHJcbiAgICAgIHRoaXMucmVuZGVyX2VtYmVkZGluZ3NfYnV0dG9ucygpO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogRVhQRVJJTUVOVEFMXHJcbiAgICAgKiAtIHdpbmRvdy1iYXNlZCBBUEkgYWNjZXNzXHJcbiAgICAgKiAtIGNvZGUtYmxvY2sgcmVuZGVyaW5nXHJcbiAgICAgKi9cclxuICAgIHRoaXMuYXBpID0gbmV3IFNtYXJ0Q29ubmVjdGlvbnNWaWV3QXBpKHRoaXMuYXBwLCB0aGlzLnBsdWdpbiwgdGhpcyk7XHJcbiAgICAvLyByZWdpc3RlciBBUEkgdG8gZ2xvYmFsIHdpbmRvdyBvYmplY3RcclxuICAgICh3aW5kb3dbXCJTbWFydENvbm5lY3Rpb25zVmlld0FwaVwiXSA9IHRoaXMuYXBpKSAmJiB0aGlzLnJlZ2lzdGVyKCgpID0+IGRlbGV0ZSB3aW5kb3dbXCJTbWFydENvbm5lY3Rpb25zVmlld0FwaVwiXSk7XHJcblxyXG4gIH1cclxuXHJcbiAgYXN5bmMgb25DbG9zZSgpIHtcclxuICAgIGNvbnNvbGUubG9nKFwiY2xvc2luZyBzbWFydCBjb25uZWN0aW9ucyB2aWV3XCIpO1xyXG4gICAgdGhpcy5hcHAud29ya3NwYWNlLnVucmVnaXN0ZXJIb3ZlckxpbmtTb3VyY2UoU01BUlRfQ09OTkVDVElPTlNfVklFV19UWVBFKTtcclxuICAgIHRoaXMucGx1Z2luLnZpZXcgPSBudWxsO1xyXG4gIH1cclxuXHJcbiAgYXN5bmMgcmVuZGVyX2Nvbm5lY3Rpb25zKGNvbnRleHQ9bnVsbCkge1xyXG4gICAgY29uc29sZS5sb2coXCJyZW5kZXJpbmcgY29ubmVjdGlvbnNcIik7XHJcbiAgICAvLyBpZiBBUEkga2V5IGlzIG5vdCBzZXQgdGhlbiB1cGRhdGUgdmlldyBtZXNzYWdlXHJcbiAgICBpZighdGhpcy5wbHVnaW4uc2V0dGluZ3MuYXBpX2tleSkge1xyXG4gICAgICB0aGlzLnNldF9tZXNzYWdlKFwiQW4gT3BlbkFJIEFQSSBrZXkgaXMgcmVxdWlyZWQgdG8gbWFrZSBTbWFydCBDb25uZWN0aW9uc1wiKTtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG4gICAgaWYoIXRoaXMucGx1Z2luLmVtYmVkZGluZ3NfbG9hZGVkKXtcclxuICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uaW5pdF92ZWNzKCk7XHJcbiAgICB9XHJcbiAgICAvLyBpZiBlbWJlZGRpbmcgc3RpbGwgbm90IGxvYWRlZCwgcmV0dXJuXHJcbiAgICBpZighdGhpcy5wbHVnaW4uZW1iZWRkaW5nc19sb2FkZWQpIHtcclxuICAgICAgY29uc29sZS5sb2coXCJlbWJlZGRpbmdzIGZpbGVzIHN0aWxsIG5vdCBsb2FkZWQgb3IgeWV0IHRvIGJlIGNyZWF0ZWRcIik7XHJcbiAgICAgIHRoaXMucmVuZGVyX2VtYmVkZGluZ3NfYnV0dG9ucygpO1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcbiAgICB0aGlzLnNldF9tZXNzYWdlKFwiTWFraW5nIFNtYXJ0IENvbm5lY3Rpb25zLi4uXCIpO1xyXG4gICAgLyoqXHJcbiAgICAgKiBCZWdpbiBoaWdobGlnaHRlZC10ZXh0LWxldmVsIHNlYXJjaFxyXG4gICAgICovXHJcbiAgICBpZih0eXBlb2YgY29udGV4dCA9PT0gXCJzdHJpbmdcIikge1xyXG4gICAgICBjb25zdCBoaWdobGlnaHRlZF90ZXh0ID0gY29udGV4dDtcclxuICAgICAgLy8gZ2V0IGVtYmVkZGluZyBmb3IgaGlnaGxpZ2h0ZWQgdGV4dFxyXG4gICAgICBhd2FpdCB0aGlzLnNlYXJjaChoaWdobGlnaHRlZF90ZXh0KTtcclxuICAgICAgcmV0dXJuOyAvLyBlbmRzIGhlcmUgaWYgY29udGV4dCBpcyBhIHN0cmluZ1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQmVnaW4gZmlsZS1sZXZlbCBzZWFyY2hcclxuICAgICAqL1xyXG4gICAgdGhpcy5uZWFyZXN0ID0gbnVsbDtcclxuICAgIHRoaXMuaW50ZXJ2YWxfY291bnQgPSAwO1xyXG4gICAgdGhpcy5yZW5kZXJpbmcgPSBmYWxzZTtcclxuICAgIHRoaXMuZmlsZSA9IGNvbnRleHQ7XHJcbiAgICAvLyBpZiB0aGlzLmludGVydmFsIGlzIHNldCB0aGVuIGNsZWFyIGl0XHJcbiAgICBpZih0aGlzLmludGVydmFsKSB7XHJcbiAgICAgIGNsZWFySW50ZXJ2YWwodGhpcy5pbnRlcnZhbCk7XHJcbiAgICAgIHRoaXMuaW50ZXJ2YWwgPSBudWxsO1xyXG4gICAgfVxyXG4gICAgLy8gc2V0IGludGVydmFsIHRvIGNoZWNrIGlmIG5lYXJlc3QgaXMgc2V0XHJcbiAgICB0aGlzLmludGVydmFsID0gc2V0SW50ZXJ2YWwoKCkgPT4ge1xyXG4gICAgICBpZighdGhpcy5yZW5kZXJpbmcpe1xyXG4gICAgICAgIGlmKHRoaXMuZmlsZSBpbnN0YW5jZW9mIE9ic2lkaWFuLlRGaWxlKSB7XHJcbiAgICAgICAgICB0aGlzLnJlbmRlcmluZyA9IHRydWU7XHJcbiAgICAgICAgICB0aGlzLnJlbmRlcl9ub3RlX2Nvbm5lY3Rpb25zKHRoaXMuZmlsZSk7XHJcbiAgICAgICAgfWVsc2V7XHJcbiAgICAgICAgICAvLyBnZXQgY3VycmVudCBub3RlXHJcbiAgICAgICAgICB0aGlzLmZpbGUgPSB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0QWN0aXZlRmlsZSgpO1xyXG4gICAgICAgICAgLy8gaWYgc3RpbGwgbm8gY3VycmVudCBub3RlIHRoZW4gcmV0dXJuXHJcbiAgICAgICAgICBpZighdGhpcy5maWxlICYmIHRoaXMuY291bnQgPiAxKSB7XHJcbiAgICAgICAgICAgIGNsZWFySW50ZXJ2YWwodGhpcy5pbnRlcnZhbCk7XHJcbiAgICAgICAgICAgIHRoaXMuc2V0X21lc3NhZ2UoXCJObyBhY3RpdmUgZmlsZVwiKTtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgfWVsc2V7XHJcbiAgICAgICAgaWYodGhpcy5uZWFyZXN0KSB7XHJcbiAgICAgICAgICBjbGVhckludGVydmFsKHRoaXMuaW50ZXJ2YWwpO1xyXG4gICAgICAgICAgLy8gaWYgbmVhcmVzdCBpcyBhIHN0cmluZyB0aGVuIHVwZGF0ZSB2aWV3IG1lc3NhZ2VcclxuICAgICAgICAgIGlmICh0eXBlb2YgdGhpcy5uZWFyZXN0ID09PSBcInN0cmluZ1wiKSB7XHJcbiAgICAgICAgICAgIHRoaXMuc2V0X21lc3NhZ2UodGhpcy5uZWFyZXN0KTtcclxuICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIC8vIHNldCBuZWFyZXN0IGNvbm5lY3Rpb25zXHJcbiAgICAgICAgICAgIHRoaXMuc2V0X25lYXJlc3QodGhpcy5uZWFyZXN0LCBcIkZpbGU6IFwiICsgdGhpcy5maWxlLm5hbWUpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgICAgLy8gaWYgcmVuZGVyX2xvZy5mYWlsZWRfZW1iZWRkaW5ncyB0aGVuIHVwZGF0ZSBmYWlsZWRfZW1iZWRkaW5ncy50eHRcclxuICAgICAgICAgIGlmICh0aGlzLnBsdWdpbi5yZW5kZXJfbG9nLmZhaWxlZF9lbWJlZGRpbmdzLmxlbmd0aCA+IDApIHtcclxuICAgICAgICAgICAgdGhpcy5wbHVnaW4uc2F2ZV9mYWlsZWRfZW1iZWRkaW5ncygpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgICAgLy8gZ2V0IG9iamVjdCBrZXlzIG9mIHJlbmRlcl9sb2dcclxuICAgICAgICAgIHRoaXMucGx1Z2luLm91dHB1dF9yZW5kZXJfbG9nKCk7XHJcbiAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfWVsc2V7XHJcbiAgICAgICAgICB0aGlzLmludGVydmFsX2NvdW50Kys7XHJcbiAgICAgICAgICB0aGlzLnNldF9tZXNzYWdlKFwiTWFraW5nIFNtYXJ0IENvbm5lY3Rpb25zLi4uXCIrdGhpcy5pbnRlcnZhbF9jb3VudCk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICB9LCAxMCk7XHJcbiAgfVxyXG5cclxuICBhc3luYyByZW5kZXJfbm90ZV9jb25uZWN0aW9ucyhmaWxlKSB7XHJcbiAgICB0aGlzLm5lYXJlc3QgPSBhd2FpdCB0aGlzLnBsdWdpbi5maW5kX25vdGVfY29ubmVjdGlvbnMoZmlsZSk7XHJcbiAgfVxyXG5cclxuICBjbGVhcl9hdXRvX3NlYXJjaGVyKCkge1xyXG4gICAgaWYgKHRoaXMuc2VhcmNoX3RpbWVvdXQpIHtcclxuICAgICAgY2xlYXJUaW1lb3V0KHRoaXMuc2VhcmNoX3RpbWVvdXQpO1xyXG4gICAgICB0aGlzLnNlYXJjaF90aW1lb3V0ID0gbnVsbDtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIGFzeW5jIHNlYXJjaChzZWFyY2hfdGV4dCwgcmVzdWx0c19vbmx5PWZhbHNlKSB7XHJcbiAgICBjb25zdCBuZWFyZXN0ID0gYXdhaXQgdGhpcy5wbHVnaW4uYXBpLnNlYXJjaChzZWFyY2hfdGV4dCk7XHJcbiAgICAvLyByZW5kZXIgcmVzdWx0cyBpbiB2aWV3IHdpdGggZmlyc3QgMTAwIGNoYXJhY3RlcnMgb2Ygc2VhcmNoIHRleHRcclxuICAgIGNvbnN0IG5lYXJlc3RfY29udGV4dCA9IGBTZWxlY3Rpb246IFwiJHtzZWFyY2hfdGV4dC5sZW5ndGggPiAxMDAgPyBzZWFyY2hfdGV4dC5zdWJzdHJpbmcoMCwgMTAwKSArIFwiLi4uXCIgOiBzZWFyY2hfdGV4dH1cImA7XHJcbiAgICB0aGlzLnNldF9uZWFyZXN0KG5lYXJlc3QsIG5lYXJlc3RfY29udGV4dCwgcmVzdWx0c19vbmx5KTtcclxuICB9XHJcblxyXG59XHJcbmNsYXNzIFNtYXJ0Q29ubmVjdGlvbnNWaWV3QXBpIHtcclxuICBjb25zdHJ1Y3RvcihhcHAsIHBsdWdpbiwgdmlldykge1xyXG4gICAgdGhpcy5hcHAgPSBhcHA7XHJcbiAgICB0aGlzLnBsdWdpbiA9IHBsdWdpbjtcclxuICAgIHRoaXMudmlldyA9IHZpZXc7XHJcbiAgfVxyXG4gIGFzeW5jIHNlYXJjaChzZWFyY2hfdGV4dCkge1xyXG4gICAgcmV0dXJuIGF3YWl0IHRoaXMucGx1Z2luLmFwaS5zZWFyY2goc2VhcmNoX3RleHQpO1xyXG4gIH1cclxuICAvLyB0cmlnZ2VyIHJlbG9hZCBvZiBlbWJlZGRpbmdzIGZpbGVcclxuICBhc3luYyByZWxvYWRfZW1iZWRkaW5nc19maWxlKCkge1xyXG4gICAgYXdhaXQgdGhpcy5wbHVnaW4uaW5pdF92ZWNzKCk7XHJcbiAgICBhd2FpdCB0aGlzLnZpZXcucmVuZGVyX2Nvbm5lY3Rpb25zKCk7XHJcbiAgfVxyXG4gIGFzeW5jIGluaXRfdmVjcygpIHtcclxuICAgIHRoaXMuc21hcnRfdmVjX2xpdGUgPSBuZXcgVmVjTGl0ZSh7XHJcbiAgICAgIGZvbGRlcl9wYXRoOiBcIi5zbWFydC1jb25uZWN0aW9uc1wiLFxyXG4gICAgICBleGlzdHNfYWRhcHRlcjogdGhpcy5hcHAudmF1bHQuYWRhcHRlci5leGlzdHMuYmluZChcclxuICAgICAgICB0aGlzLmFwcC52YXVsdC5hZGFwdGVyXHJcbiAgICAgICksXHJcbiAgICAgIG1rZGlyX2FkYXB0ZXI6IHRoaXMuYXBwLnZhdWx0LmFkYXB0ZXIubWtkaXIuYmluZCh0aGlzLmFwcC52YXVsdC5hZGFwdGVyKSxcclxuICAgICAgcmVhZF9hZGFwdGVyOiB0aGlzLmFwcC52YXVsdC5hZGFwdGVyLnJlYWQuYmluZCh0aGlzLmFwcC52YXVsdC5hZGFwdGVyKSxcclxuICAgICAgcmVuYW1lX2FkYXB0ZXI6IHRoaXMuYXBwLnZhdWx0LmFkYXB0ZXIucmVuYW1lLmJpbmQoXHJcbiAgICAgICAgdGhpcy5hcHAudmF1bHQuYWRhcHRlclxyXG4gICAgICApLFxyXG4gICAgICBzdGF0X2FkYXB0ZXI6IHRoaXMuYXBwLnZhdWx0LmFkYXB0ZXIuc3RhdC5iaW5kKHRoaXMuYXBwLnZhdWx0LmFkYXB0ZXIpLFxyXG4gICAgICB3cml0ZV9hZGFwdGVyOiB0aGlzLmFwcC52YXVsdC5hZGFwdGVyLndyaXRlLmJpbmQodGhpcy5hcHAudmF1bHQuYWRhcHRlciksXHJcbiAgICB9KTtcclxuICAgIHRoaXMuZW1iZWRkaW5nc19sb2FkZWQgPSBhd2FpdCB0aGlzLnNtYXJ0X3ZlY19saXRlLmxvYWQoKTtcclxuICAgIHJldHVybiB0aGlzLmVtYmVkZGluZ3NfbG9hZGVkO1xyXG4gIH1cclxufVxyXG5jbGFzcyBTY1NlYXJjaEFwaSB7XHJcbiAgY29uc3RydWN0b3IoYXBwLCBwbHVnaW4pIHtcclxuICAgIHRoaXMuYXBwID0gYXBwO1xyXG4gICAgdGhpcy5wbHVnaW4gPSBwbHVnaW47XHJcbiAgfVxyXG4gIGFzeW5jIHNlYXJjaCAoc2VhcmNoX3RleHQsIGZpbHRlcj17fSkge1xyXG4gICAgZmlsdGVyID0ge1xyXG4gICAgICBza2lwX3NlY3Rpb25zOiB0aGlzLnBsdWdpbi5zZXR0aW5ncy5za2lwX3NlY3Rpb25zLFxyXG4gICAgICAuLi5maWx0ZXJcclxuICAgIH1cclxuICAgIGxldCBuZWFyZXN0ID0gW107XHJcbiAgICBjb25zdCByZXNwID0gYXdhaXQgdGhpcy5wbHVnaW4ucmVxdWVzdF9lbWJlZGRpbmdfZnJvbV9pbnB1dChzZWFyY2hfdGV4dCk7XHJcbiAgICBpZiAocmVzcCAmJiByZXNwLmRhdGEgJiYgcmVzcC5kYXRhWzBdICYmIHJlc3AuZGF0YVswXS5lbWJlZGRpbmcpIHtcclxuICAgICAgbmVhcmVzdCA9IHRoaXMucGx1Z2luLnNtYXJ0X3ZlY19saXRlLm5lYXJlc3QocmVzcC5kYXRhWzBdLmVtYmVkZGluZywgZmlsdGVyKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIC8vIHJlc3AgaXMgbnVsbCwgdW5kZWZpbmVkLCBvciBtaXNzaW5nIGRhdGFcclxuICAgICAgbmV3IE9ic2lkaWFuLk5vdGljZShcIlNtYXJ0IENvbm5lY3Rpb25zOiBFcnJvciBnZXR0aW5nIGVtYmVkZGluZ1wiKTtcclxuICAgIH1cclxuICAgIHJldHVybiBuZWFyZXN0O1xyXG4gIH1cclxufVxyXG5cclxuY2xhc3MgU21hcnRDb25uZWN0aW9uc1NldHRpbmdzVGFiIGV4dGVuZHMgT2JzaWRpYW4uUGx1Z2luU2V0dGluZ1RhYiB7XHJcbiAgY29uc3RydWN0b3IoYXBwLCBwbHVnaW4pIHtcclxuICAgIHN1cGVyKGFwcCwgcGx1Z2luKTtcclxuICAgIHRoaXMucGx1Z2luID0gcGx1Z2luO1xyXG4gIH1cclxuICBkaXNwbGF5KCkge1xyXG4gICAgY29uc3Qge1xyXG4gICAgICBjb250YWluZXJFbFxyXG4gICAgfSA9IHRoaXM7XHJcbiAgICBjb250YWluZXJFbC5lbXB0eSgpO1xyXG4gICAgY29udGFpbmVyRWwuY3JlYXRlRWwoXCJoMlwiLCB7XHJcbiAgICAgIHRleHQ6IFwiU3VwcG9ydGVyIFNldHRpbmdzXCJcclxuICAgIH0pO1xyXG4gICAgLy8gbGlzdCBzdXBwb3J0ZXIgYmVuZWZpdHNcclxuICAgIGNvbnRhaW5lckVsLmNyZWF0ZUVsKFwicFwiLCB7XHJcbiAgICAgIHRleHQ6IFwiQXMgYSBTbWFydCBDb25uZWN0aW9ucyBcXFwiU3VwcG9ydGVyXFxcIiwgZmFzdC10cmFjayB5b3VyIFBLTSBqb3VybmV5IHdpdGggcHJpb3JpdHkgcGVya3MgYW5kIHBpb25lZXJpbmcgaW5ub3ZhdGlvbnMuXCJcclxuICAgIH0pO1xyXG4gICAgLy8gdGhyZWUgbGlzdCBpdGVtc1xyXG4gICAgY29uc3Qgc3VwcG9ydGVyX2JlbmVmaXRzX2xpc3QgPSBjb250YWluZXJFbC5jcmVhdGVFbChcInVsXCIpO1xyXG4gICAgc3VwcG9ydGVyX2JlbmVmaXRzX2xpc3QuY3JlYXRlRWwoXCJsaVwiLCB7XHJcbiAgICAgIHRleHQ6IFwiRW5qb3kgc3dpZnQsIHRvcC1wcmlvcml0eSBzdXBwb3J0LlwiXHJcbiAgICB9KTtcclxuICAgIHN1cHBvcnRlcl9iZW5lZml0c19saXN0LmNyZWF0ZUVsKFwibGlcIiwge1xyXG4gICAgICB0ZXh0OiBcIkdhaW4gZWFybHkgYWNjZXNzIHRvIHZlcnNpb24gMiAoaW5jbHVkZXMgbG9jYWwgZW1iZWRkaW5nIG1vZGVsKS5cIlxyXG4gICAgfSk7XHJcbiAgICBzdXBwb3J0ZXJfYmVuZWZpdHNfbGlzdC5jcmVhdGVFbChcImxpXCIsIHtcclxuICAgICAgdGV4dDogXCJTdGF5IGluZm9ybWVkIGFuZCBlbmdhZ2VkIHdpdGggZXhjbHVzaXZlIHN1cHBvcnRlci1vbmx5IGNvbW11bmljYXRpb25zLlwiXHJcbiAgICB9KTtcclxuICAgIC8vIGFkZCBhIHRleHQgaW5wdXQgdG8gZW50ZXIgc3VwcG9ydGVyIGxpY2Vuc2Uga2V5XHJcbiAgICBuZXcgT2JzaWRpYW4uU2V0dGluZyhjb250YWluZXJFbCkuc2V0TmFtZShcIlN1cHBvcnRlciBMaWNlbnNlIEtleVwiKS5zZXREZXNjKFwiTm90ZTogdGhpcyBpcyBub3QgcmVxdWlyZWQgdG8gdXNlIFNtYXJ0IENvbm5lY3Rpb25zLlwiKS5hZGRUZXh0KCh0ZXh0KSA9PiB0ZXh0LnNldFBsYWNlaG9sZGVyKFwiRW50ZXIgeW91ciBsaWNlbnNlX2tleVwiKS5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5saWNlbnNlX2tleSkub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XHJcbiAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLmxpY2Vuc2Vfa2V5ID0gdmFsdWUudHJpbSgpO1xyXG4gICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3ModHJ1ZSk7XHJcbiAgICB9KSk7XHJcbiAgICAvLyBidXR0b24gXCJnZXQgdjJcIlxyXG4gICAgbmV3IE9ic2lkaWFuLlNldHRpbmcoY29udGFpbmVyRWwpLnNldE5hbWUoXCJHZXQgdjJcIikuc2V0RGVzYyhcIkdldCB2MiAod2FybmluZzogdmVyeSBlYXJseSBiZXRhIHJlbGVhc2UsIGxpa2VseSB0byBjcmFzaCwgcGxlYXNlIHNlbmQgaXNzdWVzIGRpcmVjdGx5IHRvIHRoZSBzdXBwb3J0ZXIgZW1haWwgZm9yIHF1aWNrIHJlc3BvbnNlKVwiKS5hZGRCdXR0b24oKGJ1dHRvbikgPT4gYnV0dG9uLnNldEJ1dHRvblRleHQoXCJHZXQgdjIgKHVuc3RhYmxlKVwiKS5vbkNsaWNrKGFzeW5jICgpID0+IHtcclxuICAgICAgYXdhaXQgdGhpcy5wbHVnaW4udXBkYXRlX3RvX3YyKCk7XHJcbiAgICB9KSk7XHJcbiAgICAvLyBhZGQgYnV0dG9uIHRvIHRyaWdnZXIgc3luYyBub3RlcyB0byB1c2Ugd2l0aCBDaGF0R1BUXHJcbiAgICBuZXcgT2JzaWRpYW4uU2V0dGluZyhjb250YWluZXJFbCkuc2V0TmFtZShcIlN5bmMgTm90ZXNcIikuc2V0RGVzYyhcIk1ha2Ugbm90ZXMgYXZhaWxhYmxlIHZpYSB0aGUgU21hcnQgQ29ubmVjdGlvbnMgQ2hhdEdQVCBQbHVnaW4uIFJlc3BlY3RzIGV4Y2x1c2lvbiBzZXR0aW5ncyBjb25maWd1cmVkIGJlbG93LlwiKS5hZGRCdXR0b24oKGJ1dHRvbikgPT4gYnV0dG9uLnNldEJ1dHRvblRleHQoXCJTeW5jIE5vdGVzXCIpLm9uQ2xpY2soYXN5bmMgKCkgPT4ge1xyXG4gICAgICAvLyBzeW5jIG5vdGVzXHJcbiAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnN5bmNfbm90ZXMoKTtcclxuICAgIH0pKTtcclxuICAgIC8vIGFkZCBidXR0b24gdG8gYmVjb21lIGEgc3VwcG9ydGVyXHJcbiAgICBuZXcgT2JzaWRpYW4uU2V0dGluZyhjb250YWluZXJFbCkuc2V0TmFtZShcIkJlY29tZSBhIFN1cHBvcnRlclwiKS5zZXREZXNjKFwiQmVjb21lIGEgU3VwcG9ydGVyXCIpLmFkZEJ1dHRvbigoYnV0dG9uKSA9PiBidXR0b24uc2V0QnV0dG9uVGV4dChcIkJlY29tZSBhIFN1cHBvcnRlclwiKS5vbkNsaWNrKGFzeW5jICgpID0+IHtcclxuICAgICAgY29uc3QgcGF5bWVudF9wYWdlcyA9IFtcclxuICAgICAgICBcImh0dHBzOi8vYnV5LnN0cmlwZS5jb20vOUFRNWtPNVFuYkFXZ0dBYklZXCIsXHJcbiAgICAgICAgXCJodHRwczovL2J1eS5zdHJpcGUuY29tLzlBUTdzV2VtVDQ4dTFMR2NONFwiXHJcbiAgICAgIF07XHJcbiAgICAgIGlmKCF0aGlzLnBsdWdpbi5wYXltZW50X3BhZ2VfaW5kZXgpe1xyXG4gICAgICAgIHRoaXMucGx1Z2luLnBheW1lbnRfcGFnZV9pbmRleCA9IE1hdGgucm91bmQoTWF0aC5yYW5kb20oKSk7XHJcbiAgICAgIH1cclxuICAgICAgLy8gb3BlbiBzdXBwb3J0ZXIgcGFnZSBpbiBicm93c2VyXHJcbiAgICAgIHdpbmRvdy5vcGVuKHBheW1lbnRfcGFnZXNbdGhpcy5wbHVnaW4ucGF5bWVudF9wYWdlX2luZGV4XSk7XHJcbiAgICB9KSk7XHJcblxyXG5cclxuICAgIGNvbnRhaW5lckVsLmNyZWF0ZUVsKFwiaDJcIiwge1xyXG4gICAgICB0ZXh0OiBcIk9wZW5BSSBTZXR0aW5nc1wiXHJcbiAgICB9KTtcclxuICAgIC8vIGFkZCBhIHRleHQgaW5wdXQgdG8gZW50ZXIgdGhlIEFQSSBrZXlcclxuICAgIG5ldyBPYnNpZGlhbi5TZXR0aW5nKGNvbnRhaW5lckVsKS5zZXROYW1lKFwiT3BlbkFJIEFQSSBLZXlcIikuc2V0RGVzYyhcIlJlcXVpcmVkOiBhbiBPcGVuQUkgQVBJIGtleSBpcyBjdXJyZW50bHkgcmVxdWlyZWQgdG8gdXNlIFNtYXJ0IENvbm5lY3Rpb25zLlwiKS5hZGRUZXh0KCh0ZXh0KSA9PiB0ZXh0LnNldFBsYWNlaG9sZGVyKFwiRW50ZXIgeW91ciBhcGlfa2V5XCIpLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmFwaV9rZXkpLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xyXG4gICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5hcGlfa2V5ID0gdmFsdWUudHJpbSgpO1xyXG4gICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3ModHJ1ZSk7XHJcbiAgICB9KSk7XHJcbiAgICAvLyBhZGQgYSBidXR0b24gdG8gdGVzdCB0aGUgQVBJIGtleSBpcyB3b3JraW5nXHJcbiAgICBuZXcgT2JzaWRpYW4uU2V0dGluZyhjb250YWluZXJFbCkuc2V0TmFtZShcIlRlc3QgQVBJIEtleVwiKS5zZXREZXNjKFwiVGVzdCBBUEkgS2V5XCIpLmFkZEJ1dHRvbigoYnV0dG9uKSA9PiBidXR0b24uc2V0QnV0dG9uVGV4dChcIlRlc3QgQVBJIEtleVwiKS5vbkNsaWNrKGFzeW5jICgpID0+IHtcclxuICAgICAgLy8gdGVzdCBBUEkga2V5XHJcbiAgICAgIGNvbnN0IHJlc3AgPSBhd2FpdCB0aGlzLnBsdWdpbi50ZXN0X2FwaV9rZXkoKTtcclxuICAgICAgaWYocmVzcCkge1xyXG4gICAgICAgIG5ldyBPYnNpZGlhbi5Ob3RpY2UoXCJTbWFydCBDb25uZWN0aW9uczogQVBJIGtleSBpcyB2YWxpZFwiKTtcclxuICAgICAgfWVsc2V7XHJcbiAgICAgICAgbmV3IE9ic2lkaWFuLk5vdGljZShcIlNtYXJ0IENvbm5lY3Rpb25zOiBBUEkga2V5IGlzIG5vdCB3b3JraW5nIGFzIGV4cGVjdGVkIVwiKTtcclxuICAgICAgfVxyXG4gICAgfSkpO1xyXG4gICAgLy8gYWRkIGRyb3Bkb3duIHRvIHNlbGVjdCB0aGUgbW9kZWxcclxuICAgIG5ldyBPYnNpZGlhbi5TZXR0aW5nKGNvbnRhaW5lckVsKS5zZXROYW1lKFwiU21hcnQgQ2hhdCBNb2RlbFwiKS5zZXREZXNjKFwiU2VsZWN0IGEgbW9kZWwgdG8gdXNlIHdpdGggU21hcnQgQ2hhdC5cIikuYWRkRHJvcGRvd24oKGRyb3Bkb3duKSA9PiB7XHJcbiAgICAgIGRyb3Bkb3duLmFkZE9wdGlvbihcImdwdC0zLjUtdHVyYm8tMTZrXCIsIFwiZ3B0LTMuNS10dXJiby0xNmtcIik7XHJcbiAgICAgIGRyb3Bkb3duLmFkZE9wdGlvbihcImdwdC00XCIsIFwiZ3B0LTQgKGxpbWl0ZWQgYWNjZXNzLCA4aylcIik7XHJcbiAgICAgIGRyb3Bkb3duLmFkZE9wdGlvbihcImdwdC0zLjUtdHVyYm9cIiwgXCJncHQtMy41LXR1cmJvICg0aylcIik7XHJcbiAgICAgIGRyb3Bkb3duLmFkZE9wdGlvbihcImdwdC00LTExMDYtcHJldmlld1wiLCBcImdwdC00LXR1cmJvICgxMjhrKVwiKTtcclxuICAgICAgZHJvcGRvd24ub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XHJcbiAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3Muc21hcnRfY2hhdF9tb2RlbCA9IHZhbHVlO1xyXG4gICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xyXG4gICAgICB9KTtcclxuICAgICAgZHJvcGRvd24uc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3Muc21hcnRfY2hhdF9tb2RlbCk7XHJcbiAgICB9KTtcclxuICAgIC8vIGxhbmd1YWdlXHJcbiAgICBuZXcgT2JzaWRpYW4uU2V0dGluZyhjb250YWluZXJFbCkuc2V0TmFtZShcIkRlZmF1bHQgTGFuZ3VhZ2VcIikuc2V0RGVzYyhcIkRlZmF1bHQgbGFuZ3VhZ2UgdG8gdXNlIGZvciBTbWFydCBDaGF0LiBDaGFuZ2VzIHdoaWNoIHNlbGYtcmVmZXJlbnRpYWwgcHJvbm91bnMgd2lsbCB0cmlnZ2VyIGxvb2t1cCBvZiB5b3VyIG5vdGVzLlwiKS5hZGREcm9wZG93bigoZHJvcGRvd24pID0+IHtcclxuICAgICAgLy8gZ2V0IE9iamVjdCBrZXlzIGZyb20gcHJvbm91c1xyXG4gICAgICBjb25zdCBsYW5ndWFnZXMgPSBPYmplY3Qua2V5cyhTTUFSVF9UUkFOU0xBVElPTik7XHJcbiAgICAgIGZvcihsZXQgaSA9IDA7IGkgPCBsYW5ndWFnZXMubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICBkcm9wZG93bi5hZGRPcHRpb24obGFuZ3VhZ2VzW2ldLCBsYW5ndWFnZXNbaV0pO1xyXG4gICAgICB9XHJcbiAgICAgIGRyb3Bkb3duLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xyXG4gICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLmxhbmd1YWdlID0gdmFsdWU7XHJcbiAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XHJcbiAgICAgICAgc2VsZl9yZWZfcHJvbm91bnNfbGlzdC5zZXRUZXh0KHRoaXMuZ2V0X3NlbGZfcmVmX2xpc3QoKSk7XHJcbiAgICAgICAgLy8gaWYgY2hhdCB2aWV3IGlzIG9wZW4gdGhlbiBydW4gbmV3X2NoYXQoKVxyXG4gICAgICAgIGNvbnN0IGNoYXRfdmlldyA9IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRMZWF2ZXNPZlR5cGUoU01BUlRfQ09OTkVDVElPTlNfQ0hBVF9WSUVXX1RZUEUpLmxlbmd0aCA+IDAgPyB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0TGVhdmVzT2ZUeXBlKFNNQVJUX0NPTk5FQ1RJT05TX0NIQVRfVklFV19UWVBFKVswXS52aWV3IDogbnVsbDtcclxuICAgICAgICBpZihjaGF0X3ZpZXcpIHtcclxuICAgICAgICAgIGNoYXRfdmlldy5uZXdfY2hhdCgpO1xyXG4gICAgICAgIH1cclxuICAgICAgfSk7XHJcbiAgICAgIGRyb3Bkb3duLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmxhbmd1YWdlKTtcclxuICAgIH0pO1xyXG4gICAgLy8gbGlzdCBjdXJyZW50IHNlbGYtcmVmZXJlbnRpYWwgcHJvbm91bnNcclxuICAgIGNvbnN0IHNlbGZfcmVmX3Byb25vdW5zX2xpc3QgPSBjb250YWluZXJFbC5jcmVhdGVFbChcInNwYW5cIiwge1xyXG4gICAgICB0ZXh0OiB0aGlzLmdldF9zZWxmX3JlZl9saXN0KClcclxuICAgIH0pO1xyXG4gICAgbmV3IE9ic2lkaWFuLlNldHRpbmcoY29udGFpbmVyRWwpLnNldE5hbWUoXCJDdXQgb2ZmIGZyb250bWF0dGVyXCIpLnNldERlc2MoXCJDdXQgb2ZmIGZyb250bWF0dGVyIGluIHRoZSBwcm9tcHQgdG8gZ2FpbiBjaGFyYWN0ZXJzIGluIHJlcGx5IGdlbmVyYXRpb25cIikuYWRkVG9nZ2xlKCh0b2dnbGUpID0+IHsgdG9nZ2xlLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmN1dF9vZmZfZnJvbnRtYXR0ZXIpLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4geyB0aGlzLnBsdWdpbi5zZXR0aW5ncy5jdXRfb2ZmX2Zyb250bWF0dGVyID0gdmFsdWU7IGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpOyB9KTsgfSk7XHJcbiAgICBjb250YWluZXJFbC5jcmVhdGVFbChcImgyXCIsIHtcclxuICAgICAgdGV4dDogXCJFeGNsdXNpb25zXCJcclxuICAgIH0pO1xyXG4gICAgLy8gbGlzdCBmaWxlIGV4Y2x1c2lvbnNcclxuICAgIG5ldyBPYnNpZGlhbi5TZXR0aW5nKGNvbnRhaW5lckVsKS5zZXROYW1lKFwiZmlsZV9leGNsdXNpb25zXCIpLnNldERlc2MoXCInRXhjbHVkZWQgZmlsZScgbWF0Y2hlcnMgc2VwYXJhdGVkIGJ5IGEgY29tbWEuXCIpLmFkZFRleHQoKHRleHQpID0+IHRleHQuc2V0UGxhY2Vob2xkZXIoXCJkcmF3aW5ncyxwcm9tcHRzL2xvZ3NcIikuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MuZmlsZV9leGNsdXNpb25zKS5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcclxuICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MuZmlsZV9leGNsdXNpb25zID0gdmFsdWU7XHJcbiAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xyXG4gICAgfSkpO1xyXG4gICAgLy8gbGlzdCBmb2xkZXIgZXhjbHVzaW9uc1xyXG4gICAgbmV3IE9ic2lkaWFuLlNldHRpbmcoY29udGFpbmVyRWwpLnNldE5hbWUoXCJmb2xkZXJfZXhjbHVzaW9uc1wiKS5zZXREZXNjKFwiJ0V4Y2x1ZGVkIGZvbGRlcicgbWF0Y2hlcnMgc2VwYXJhdGVkIGJ5IGEgY29tbWEuXCIpLmFkZFRleHQoKHRleHQpID0+IHRleHQuc2V0UGxhY2Vob2xkZXIoXCJkcmF3aW5ncyxwcm9tcHRzL2xvZ3NcIikuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MuZm9sZGVyX2V4Y2x1c2lvbnMpLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xyXG4gICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5mb2xkZXJfZXhjbHVzaW9ucyA9IHZhbHVlO1xyXG4gICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcclxuICAgIH0pKTtcclxuICAgIC8vIGxpc3QgcGF0aCBvbmx5IG1hdGNoZXJzXHJcbiAgICBuZXcgT2JzaWRpYW4uU2V0dGluZyhjb250YWluZXJFbCkuc2V0TmFtZShcInBhdGhfb25seVwiKS5zZXREZXNjKFwiJ1BhdGggb25seScgbWF0Y2hlcnMgc2VwYXJhdGVkIGJ5IGEgY29tbWEuXCIpLmFkZFRleHQoKHRleHQpID0+IHRleHQuc2V0UGxhY2Vob2xkZXIoXCJkcmF3aW5ncyxwcm9tcHRzL2xvZ3NcIikuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MucGF0aF9vbmx5KS5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcclxuICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MucGF0aF9vbmx5ID0gdmFsdWU7XHJcbiAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xyXG4gICAgfSkpO1xyXG4gICAgLy8gbGlzdCBoZWFkZXIgZXhjbHVzaW9uc1xyXG4gICAgbmV3IE9ic2lkaWFuLlNldHRpbmcoY29udGFpbmVyRWwpLnNldE5hbWUoXCJoZWFkZXJfZXhjbHVzaW9uc1wiKS5zZXREZXNjKFwiJ0V4Y2x1ZGVkIGhlYWRlcicgbWF0Y2hlcnMgc2VwYXJhdGVkIGJ5IGEgY29tbWEuIFdvcmtzIGZvciAnYmxvY2tzJyBvbmx5LlwiKS5hZGRUZXh0KCh0ZXh0KSA9PiB0ZXh0LnNldFBsYWNlaG9sZGVyKFwiZHJhd2luZ3MscHJvbXB0cy9sb2dzXCIpLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmhlYWRlcl9leGNsdXNpb25zKS5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcclxuICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MuaGVhZGVyX2V4Y2x1c2lvbnMgPSB2YWx1ZTtcclxuICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XHJcbiAgICB9KSk7XHJcbiAgICBjb250YWluZXJFbC5jcmVhdGVFbChcImgyXCIsIHtcclxuICAgICAgdGV4dDogXCJEaXNwbGF5XCJcclxuICAgIH0pO1xyXG4gICAgLy8gdG9nZ2xlIHNob3dpbmcgZnVsbCBwYXRoIGluIHZpZXdcclxuICAgIG5ldyBPYnNpZGlhbi5TZXR0aW5nKGNvbnRhaW5lckVsKS5zZXROYW1lKFwic2hvd19mdWxsX3BhdGhcIikuc2V0RGVzYyhcIlNob3cgZnVsbCBwYXRoIGluIHZpZXcuXCIpLmFkZFRvZ2dsZSgodG9nZ2xlKSA9PiB0b2dnbGUuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3Muc2hvd19mdWxsX3BhdGgpLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xyXG4gICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5zaG93X2Z1bGxfcGF0aCA9IHZhbHVlO1xyXG4gICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3ModHJ1ZSk7XHJcbiAgICB9KSk7XHJcbiAgICAvLyB0b2dnbGUgZXhwYW5kZWQgdmlldyBieSBkZWZhdWx0XHJcbiAgICBuZXcgT2JzaWRpYW4uU2V0dGluZyhjb250YWluZXJFbCkuc2V0TmFtZShcImV4cGFuZGVkX3ZpZXdcIikuc2V0RGVzYyhcIkV4cGFuZGVkIHZpZXcgYnkgZGVmYXVsdC5cIikuYWRkVG9nZ2xlKCh0b2dnbGUpID0+IHRvZ2dsZS5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5leHBhbmRlZF92aWV3KS5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcclxuICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MuZXhwYW5kZWRfdmlldyA9IHZhbHVlO1xyXG4gICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3ModHJ1ZSk7XHJcbiAgICB9KSk7XHJcbiAgICAvLyB0b2dnbGUgZ3JvdXAgbmVhcmVzdCBieSBmaWxlXHJcbiAgICBuZXcgT2JzaWRpYW4uU2V0dGluZyhjb250YWluZXJFbCkuc2V0TmFtZShcImdyb3VwX25lYXJlc3RfYnlfZmlsZVwiKS5zZXREZXNjKFwiR3JvdXAgbmVhcmVzdCBieSBmaWxlLlwiKS5hZGRUb2dnbGUoKHRvZ2dsZSkgPT4gdG9nZ2xlLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmdyb3VwX25lYXJlc3RfYnlfZmlsZSkub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XHJcbiAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLmdyb3VwX25lYXJlc3RfYnlfZmlsZSA9IHZhbHVlO1xyXG4gICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3ModHJ1ZSk7XHJcbiAgICB9KSk7XHJcbiAgICAvLyB0b2dnbGUgdmlld19vcGVuIG9uIE9ic2lkaWFuIHN0YXJ0dXBcclxuICAgIG5ldyBPYnNpZGlhbi5TZXR0aW5nKGNvbnRhaW5lckVsKS5zZXROYW1lKFwidmlld19vcGVuXCIpLnNldERlc2MoXCJPcGVuIHZpZXcgb24gT2JzaWRpYW4gc3RhcnR1cC5cIikuYWRkVG9nZ2xlKCh0b2dnbGUpID0+IHRvZ2dsZS5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy52aWV3X29wZW4pLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xyXG4gICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy52aWV3X29wZW4gPSB2YWx1ZTtcclxuICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKHRydWUpO1xyXG4gICAgfSkpO1xyXG4gICAgLy8gdG9nZ2xlIGNoYXRfb3BlbiBvbiBPYnNpZGlhbiBzdGFydHVwXHJcbiAgICBuZXcgT2JzaWRpYW4uU2V0dGluZyhjb250YWluZXJFbCkuc2V0TmFtZShcImNoYXRfb3BlblwiKS5zZXREZXNjKFwiT3BlbiB2aWV3IG9uIE9ic2lkaWFuIHN0YXJ0dXAuXCIpLmFkZFRvZ2dsZSgodG9nZ2xlKSA9PiB0b2dnbGUuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MuY2hhdF9vcGVuKS5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcclxuICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MuY2hhdF9vcGVuID0gdmFsdWU7XHJcbiAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncyh0cnVlKTtcclxuICAgIH0pKTtcclxuICAgIC8vIG9wZW4gaW4gYmlnIHZpZXcgb3Igc21hbGwgdmlld1xyXG4gICAgbmV3IE9ic2lkaWFuLlNldHRpbmcoY29udGFpbmVyRWwpLnNldE5hbWUoXCJvcGVuX2luX2JpZ192aWV3XCIpLnNldERlc2MoXCJPcGVuIGluIGJpZyB2aWV3IG9yIHNtYWxsIHZpZXcuXCIpLmFkZERyb3Bkb3duKChkcm9wZG93bikgPT4ge1xyXG4gICAgICBkcm9wZG93bi5hZGRPcHRpb24oZmFsc2UsIFwiUmlnaHQgcGFuZSAoc21hbGwpXCIpO1xyXG4gICAgICBkcm9wZG93bi5hZGRPcHRpb24odHJ1ZSwgXCJNYWluIHBhbmUgKGJpZylcIik7XHJcbiAgICAgIGRyb3Bkb3duLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLm9wZW5faW5fYmlnX3ZpZXcpO1xyXG4gICAgICBkcm9wZG93bi5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcclxuICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5vcGVuX2luX2JpZ192aWV3ID0gSlNPTi5wYXJzZSh2YWx1ZSk7XHJcbiAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKHRydWUpO1xyXG4gICAgICAgIHRoaXMucGx1Z2luLm9wZW5fY2hhdCgpO1xyXG5cclxuICAgICAgfSk7XHJcbiAgICB9KTtcclxuICAgIGNvbnRhaW5lckVsLmNyZWF0ZUVsKFwiaDJcIiwge1xyXG4gICAgICB0ZXh0OiBcIkFkdmFuY2VkXCJcclxuICAgIH0pO1xyXG4gICAgLy8gdG9nZ2xlIGxvZ19yZW5kZXJcclxuICAgIG5ldyBPYnNpZGlhbi5TZXR0aW5nKGNvbnRhaW5lckVsKS5zZXROYW1lKFwibG9nX3JlbmRlclwiKS5zZXREZXNjKFwiTG9nIHJlbmRlciBkZXRhaWxzIHRvIGNvbnNvbGUgKGluY2x1ZGVzIHRva2VuX3VzYWdlKS5cIikuYWRkVG9nZ2xlKCh0b2dnbGUpID0+IHRvZ2dsZS5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5sb2dfcmVuZGVyKS5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcclxuICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MubG9nX3JlbmRlciA9IHZhbHVlO1xyXG4gICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3ModHJ1ZSk7XHJcbiAgICB9KSk7XHJcbiAgICAvLyB0b2dnbGUgZmlsZXMgaW4gbG9nX3JlbmRlclxyXG4gICAgbmV3IE9ic2lkaWFuLlNldHRpbmcoY29udGFpbmVyRWwpLnNldE5hbWUoXCJsb2dfcmVuZGVyX2ZpbGVzXCIpLnNldERlc2MoXCJMb2cgZW1iZWRkZWQgb2JqZWN0cyBwYXRocyB3aXRoIGxvZyByZW5kZXIgKGZvciBkZWJ1Z2dpbmcpLlwiKS5hZGRUb2dnbGUoKHRvZ2dsZSkgPT4gdG9nZ2xlLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmxvZ19yZW5kZXJfZmlsZXMpLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xyXG4gICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5sb2dfcmVuZGVyX2ZpbGVzID0gdmFsdWU7XHJcbiAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncyh0cnVlKTtcclxuICAgIH0pKTtcclxuICAgIC8vIHRvZ2dsZSBza2lwX3NlY3Rpb25zXHJcbiAgICBuZXcgT2JzaWRpYW4uU2V0dGluZyhjb250YWluZXJFbCkuc2V0TmFtZShcInNraXBfc2VjdGlvbnNcIikuc2V0RGVzYyhcIlNraXBzIG1ha2luZyBjb25uZWN0aW9ucyB0byBzcGVjaWZpYyBzZWN0aW9ucyB3aXRoaW4gbm90ZXMuIFdhcm5pbmc6IHJlZHVjZXMgdXNlZnVsbmVzcyBmb3IgbGFyZ2UgZmlsZXMgYW5kIHJlcXVpcmVzICdGb3JjZSBSZWZyZXNoJyBmb3Igc2VjdGlvbnMgdG8gd29yayBpbiB0aGUgZnV0dXJlLlwiKS5hZGRUb2dnbGUoKHRvZ2dsZSkgPT4gdG9nZ2xlLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLnNraXBfc2VjdGlvbnMpLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xyXG4gICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5za2lwX3NlY3Rpb25zID0gdmFsdWU7XHJcbiAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncyh0cnVlKTtcclxuICAgIH0pKTtcclxuICAgIC8vIHRlc3QgZmlsZSB3cml0aW5nIGJ5IGNyZWF0aW5nIGEgdGVzdCBmaWxlLCB0aGVuIHdyaXRpbmcgYWRkaXRpb25hbCBkYXRhIHRvIHRoZSBmaWxlLCBhbmQgcmV0dXJuaW5nIGFueSBlcnJvciB0ZXh0IGlmIGl0IGZhaWxzXHJcbiAgICBjb250YWluZXJFbC5jcmVhdGVFbChcImgzXCIsIHtcclxuICAgICAgdGV4dDogXCJUZXN0IEZpbGUgV3JpdGluZ1wiXHJcbiAgICB9KTtcclxuICAgIC8vIG1hbnVhbCBzYXZlIGJ1dHRvblxyXG4gICAgY29udGFpbmVyRWwuY3JlYXRlRWwoXCJoM1wiLCB7XHJcbiAgICAgIHRleHQ6IFwiTWFudWFsIFNhdmVcIlxyXG4gICAgfSk7XHJcbiAgICBsZXQgbWFudWFsX3NhdmVfcmVzdWx0cyA9IGNvbnRhaW5lckVsLmNyZWF0ZUVsKFwiZGl2XCIpO1xyXG4gICAgbmV3IE9ic2lkaWFuLlNldHRpbmcoY29udGFpbmVyRWwpLnNldE5hbWUoXCJtYW51YWxfc2F2ZVwiKS5zZXREZXNjKFwiU2F2ZSBjdXJyZW50IGVtYmVkZGluZ3NcIikuYWRkQnV0dG9uKChidXR0b24pID0+IGJ1dHRvbi5zZXRCdXR0b25UZXh0KFwiTWFudWFsIFNhdmVcIikub25DbGljayhhc3luYyAoKSA9PiB7XHJcbiAgICAgIC8vIGNvbmZpcm1cclxuICAgICAgaWYgKGNvbmZpcm0oXCJBcmUgeW91IHN1cmUgeW91IHdhbnQgdG8gc2F2ZSB5b3VyIGN1cnJlbnQgZW1iZWRkaW5ncz9cIikpIHtcclxuICAgICAgICAvLyBzYXZlXHJcbiAgICAgICAgdHJ5e1xyXG4gICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZV9lbWJlZGRpbmdzX3RvX2ZpbGUodHJ1ZSk7XHJcbiAgICAgICAgICBtYW51YWxfc2F2ZV9yZXN1bHRzLmlubmVySFRNTCA9IFwiRW1iZWRkaW5ncyBzYXZlZCBzdWNjZXNzZnVsbHkuXCI7XHJcbiAgICAgICAgfWNhdGNoKGUpe1xyXG4gICAgICAgICAgbWFudWFsX3NhdmVfcmVzdWx0cy5pbm5lckhUTUwgPSBcIkVtYmVkZGluZ3MgZmFpbGVkIHRvIHNhdmUuIEVycm9yOiBcIiArIGU7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICB9KSk7XHJcblxyXG4gICAgLy8gbGlzdCBwcmV2aW91c2x5IGZhaWxlZCBmaWxlc1xyXG4gICAgY29udGFpbmVyRWwuY3JlYXRlRWwoXCJoM1wiLCB7XHJcbiAgICAgIHRleHQ6IFwiUHJldmlvdXNseSBmYWlsZWQgZmlsZXNcIlxyXG4gICAgfSk7XHJcbiAgICBsZXQgZmFpbGVkX2xpc3QgPSBjb250YWluZXJFbC5jcmVhdGVFbChcImRpdlwiKTtcclxuICAgIHRoaXMuZHJhd19mYWlsZWRfZmlsZXNfbGlzdChmYWlsZWRfbGlzdCk7XHJcblxyXG4gICAgLy8gZm9yY2UgcmVmcmVzaCBidXR0b25cclxuICAgIGNvbnRhaW5lckVsLmNyZWF0ZUVsKFwiaDNcIiwge1xyXG4gICAgICB0ZXh0OiBcIkZvcmNlIFJlZnJlc2hcIlxyXG4gICAgfSk7XHJcbiAgICBuZXcgT2JzaWRpYW4uU2V0dGluZyhjb250YWluZXJFbCkuc2V0TmFtZShcImZvcmNlX3JlZnJlc2hcIikuc2V0RGVzYyhcIldBUk5JTkc6IERPIE5PVCB1c2UgdW5sZXNzIHlvdSBrbm93IHdoYXQgeW91IGFyZSBkb2luZyEgVGhpcyB3aWxsIGRlbGV0ZSBhbGwgb2YgeW91ciBjdXJyZW50IGVtYmVkZGluZ3MgZnJvbSBPcGVuQUkgYW5kIHRyaWdnZXIgcmVwcm9jZXNzaW5nIG9mIHlvdXIgZW50aXJlIHZhdWx0IVwiKS5hZGRCdXR0b24oKGJ1dHRvbikgPT4gYnV0dG9uLnNldEJ1dHRvblRleHQoXCJGb3JjZSBSZWZyZXNoXCIpLm9uQ2xpY2soYXN5bmMgKCkgPT4ge1xyXG4gICAgICAvLyBjb25maXJtXHJcbiAgICAgIGlmIChjb25maXJtKFwiQXJlIHlvdSBzdXJlIHlvdSB3YW50IHRvIEZvcmNlIFJlZnJlc2g/IEJ5IGNsaWNraW5nIHllcyB5b3UgY29uZmlybSB0aGF0IHlvdSB1bmRlcnN0YW5kIHRoZSBjb25zZXF1ZW5jZXMgb2YgdGhpcyBhY3Rpb24uXCIpKSB7XHJcbiAgICAgICAgLy8gZm9yY2UgcmVmcmVzaFxyXG4gICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLmZvcmNlX3JlZnJlc2hfZW1iZWRkaW5nc19maWxlKCk7XHJcbiAgICAgIH1cclxuICAgIH0pKTtcclxuXHJcbiAgfVxyXG4gIGdldF9zZWxmX3JlZl9saXN0KCkge1xyXG4gICAgcmV0dXJuIFwiQ3VycmVudDogXCIgKyBTTUFSVF9UUkFOU0xBVElPTlt0aGlzLnBsdWdpbi5zZXR0aW5ncy5sYW5ndWFnZV0ucHJvbm91cy5qb2luKFwiLCBcIik7XHJcbiAgfVxyXG5cclxuICBkcmF3X2ZhaWxlZF9maWxlc19saXN0KGZhaWxlZF9saXN0KSB7XHJcbiAgICBmYWlsZWRfbGlzdC5lbXB0eSgpO1xyXG4gICAgaWYodGhpcy5wbHVnaW4uc2V0dGluZ3MuZmFpbGVkX2ZpbGVzLmxlbmd0aCA+IDApIHtcclxuICAgICAgLy8gYWRkIG1lc3NhZ2UgdGhhdCB0aGVzZSBmaWxlcyB3aWxsIGJlIHNraXBwZWQgdW50aWwgbWFudWFsbHkgcmV0cmllZFxyXG4gICAgICBmYWlsZWRfbGlzdC5jcmVhdGVFbChcInBcIiwge1xyXG4gICAgICAgIHRleHQ6IFwiVGhlIGZvbGxvd2luZyBmaWxlcyBmYWlsZWQgdG8gcHJvY2VzcyBhbmQgd2lsbCBiZSBza2lwcGVkIHVudGlsIG1hbnVhbGx5IHJldHJpZWQuXCJcclxuICAgICAgfSk7XHJcbiAgICAgIGxldCBsaXN0ID0gZmFpbGVkX2xpc3QuY3JlYXRlRWwoXCJ1bFwiKTtcclxuICAgICAgZm9yIChsZXQgZmFpbGVkX2ZpbGUgb2YgdGhpcy5wbHVnaW4uc2V0dGluZ3MuZmFpbGVkX2ZpbGVzKSB7XHJcbiAgICAgICAgbGlzdC5jcmVhdGVFbChcImxpXCIsIHtcclxuICAgICAgICAgIHRleHQ6IGZhaWxlZF9maWxlXHJcbiAgICAgICAgfSk7XHJcbiAgICAgIH1cclxuICAgICAgLy8gYWRkIGJ1dHRvbiB0byByZXRyeSBmYWlsZWQgZmlsZXMgb25seVxyXG4gICAgICBuZXcgT2JzaWRpYW4uU2V0dGluZyhmYWlsZWRfbGlzdCkuc2V0TmFtZShcInJldHJ5X2ZhaWxlZF9maWxlc1wiKS5zZXREZXNjKFwiUmV0cnkgZmFpbGVkIGZpbGVzIG9ubHlcIikuYWRkQnV0dG9uKChidXR0b24pID0+IGJ1dHRvbi5zZXRCdXR0b25UZXh0KFwiUmV0cnkgZmFpbGVkIGZpbGVzIG9ubHlcIikub25DbGljayhhc3luYyAoKSA9PiB7XHJcbiAgICAgICAgLy8gY2xlYXIgZmFpbGVkX2xpc3QgZWxlbWVudFxyXG4gICAgICAgIGZhaWxlZF9saXN0LmVtcHR5KCk7XHJcbiAgICAgICAgLy8gc2V0IFwicmV0cnlpbmdcIiB0ZXh0XHJcbiAgICAgICAgZmFpbGVkX2xpc3QuY3JlYXRlRWwoXCJwXCIsIHtcclxuICAgICAgICAgIHRleHQ6IFwiUmV0cnlpbmcgZmFpbGVkIGZpbGVzLi4uXCJcclxuICAgICAgICB9KTtcclxuICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5yZXRyeV9mYWlsZWRfZmlsZXMoKTtcclxuICAgICAgICAvLyByZWRyYXcgZmFpbGVkIGZpbGVzIGxpc3RcclxuICAgICAgICB0aGlzLmRyYXdfZmFpbGVkX2ZpbGVzX2xpc3QoZmFpbGVkX2xpc3QpO1xyXG4gICAgICB9KSk7XHJcbiAgICB9ZWxzZXtcclxuICAgICAgZmFpbGVkX2xpc3QuY3JlYXRlRWwoXCJwXCIsIHtcclxuICAgICAgICB0ZXh0OiBcIk5vIGZhaWxlZCBmaWxlc1wiXHJcbiAgICAgIH0pO1xyXG4gICAgfVxyXG4gIH1cclxufVxyXG5cclxuZnVuY3Rpb24gbGluZV9pc19oZWFkaW5nKGxpbmUpIHtcclxuICByZXR1cm4gKGxpbmUuaW5kZXhPZihcIiNcIikgPT09IDApICYmIChbJyMnLCAnICddLmluZGV4T2YobGluZVsxXSkgIT09IC0xKTtcclxufVxyXG5cclxuY29uc3QgU01BUlRfQ09OTkVDVElPTlNfQ0hBVF9WSUVXX1RZUEUgPSBcInNtYXJ0LWNvbm5lY3Rpb25zLWNoYXQtdmlld1wiO1xyXG5cclxuY2xhc3MgU21hcnRDb25uZWN0aW9uc0NoYXRWaWV3IGV4dGVuZHMgT2JzaWRpYW4uSXRlbVZpZXcge1xyXG4gIGNvbnN0cnVjdG9yKGxlYWYsIHBsdWdpbikge1xyXG4gICAgc3VwZXIobGVhZik7XHJcbiAgICB0aGlzLnBsdWdpbiA9IHBsdWdpbjtcclxuICAgIHRoaXMuYWN0aXZlX2VsbSA9IG51bGw7XHJcbiAgICB0aGlzLmFjdGl2ZV9zdHJlYW0gPSBudWxsO1xyXG4gICAgdGhpcy5icmFja2V0c19jdCA9IDA7XHJcbiAgICB0aGlzLmNoYXQgPSBudWxsO1xyXG4gICAgdGhpcy5jaGF0X2JveCA9IG51bGw7XHJcbiAgICB0aGlzLmNoYXRfY29udGFpbmVyID0gbnVsbDtcclxuICAgIHRoaXMuY3VycmVudF9jaGF0X21sID0gW107XHJcbiAgICB0aGlzLmZpbGVzID0gW107XHJcbiAgICB0aGlzLmxhc3RfZnJvbSA9IG51bGw7XHJcbiAgICB0aGlzLm1lc3NhZ2VfY29udGFpbmVyID0gbnVsbDtcclxuICAgIHRoaXMucHJldmVudF9pbnB1dCA9IGZhbHNlO1xyXG4gIH1cclxuICBnZXREaXNwbGF5VGV4dCgpIHtcclxuICAgIHJldHVybiBcIlNtYXJ0IENvbm5lY3Rpb25zIENoYXRcIjtcclxuICB9XHJcbiAgZ2V0SWNvbigpIHtcclxuICAgIHJldHVybiBcIm1lc3NhZ2Utc3F1YXJlXCI7XHJcbiAgfVxyXG4gIGdldFZpZXdUeXBlKCkge1xyXG4gICAgcmV0dXJuIFNNQVJUX0NPTk5FQ1RJT05TX0NIQVRfVklFV19UWVBFO1xyXG4gIH1cclxuICBvbk9wZW4oKSB7XHJcbiAgICB0aGlzLm5ld19jaGF0KCk7XHJcbiAgICB0aGlzLnBsdWdpbi5nZXRfYWxsX2ZvbGRlcnMoKTsgLy8gc2V0cyB0aGlzLnBsdWdpbi5mb2xkZXJzIG5lY2Vzc2FyeSBmb3IgZm9sZGVyLWNvbnRleHRcclxuICB9XHJcbiAgb25DbG9zZSgpIHtcclxuICAgIHRoaXMuY2hhdC5zYXZlX2NoYXQoKTtcclxuICAgIHRoaXMuYXBwLndvcmtzcGFjZS51bnJlZ2lzdGVySG92ZXJMaW5rU291cmNlKFNNQVJUX0NPTk5FQ1RJT05TX0NIQVRfVklFV19UWVBFKTtcclxuICB9XHJcbiAgcmVuZGVyX2NoYXQoKSB7XHJcbiAgICB0aGlzLmNvbnRhaW5lckVsLmVtcHR5KCk7XHJcbiAgICB0aGlzLmNoYXRfY29udGFpbmVyID0gdGhpcy5jb250YWluZXJFbC5jcmVhdGVEaXYoXCJzYy1jaGF0LWNvbnRhaW5lclwiKTtcclxuICAgIC8vIHJlbmRlciBwbHVzIHNpZ24gZm9yIGNsZWFyIGJ1dHRvblxyXG4gICAgdGhpcy5yZW5kZXJfdG9wX2JhcigpO1xyXG4gICAgLy8gcmVuZGVyIGNoYXQgbWVzc2FnZXMgY29udGFpbmVyXHJcbiAgICB0aGlzLnJlbmRlcl9jaGF0X2JveCgpO1xyXG4gICAgLy8gcmVuZGVyIGNoYXQgaW5wdXRcclxuICAgIHRoaXMucmVuZGVyX2NoYXRfaW5wdXQoKTtcclxuICAgIHRoaXMucGx1Z2luLnJlbmRlcl9icmFuZCh0aGlzLmNvbnRhaW5lckVsLCBcImNoYXRcIik7XHJcbiAgfVxyXG4gIC8vIHJlbmRlciBwbHVzIHNpZ24gZm9yIGNsZWFyIGJ1dHRvblxyXG4gIHJlbmRlcl90b3BfYmFyKCkge1xyXG4gICAgLy8gY3JlYXRlIGNvbnRhaW5lciBmb3IgY2xlYXIgYnV0dG9uXHJcbiAgICBsZXQgdG9wX2Jhcl9jb250YWluZXIgPSB0aGlzLmNoYXRfY29udGFpbmVyLmNyZWF0ZURpdihcInNjLXRvcC1iYXItY29udGFpbmVyXCIpO1xyXG4gICAgLy8gcmVuZGVyIHRoZSBuYW1lIG9mIHRoZSBjaGF0IGluIGFuIGlucHV0IGJveCAocG9wIGNvbnRlbnQgYWZ0ZXIgbGFzdCBoeXBoZW4gaW4gY2hhdF9pZClcclxuICAgIGxldCBjaGF0X25hbWUgPXRoaXMuY2hhdC5uYW1lKCk7XHJcbiAgICBsZXQgY2hhdF9uYW1lX2lucHV0ID0gdG9wX2Jhcl9jb250YWluZXIuY3JlYXRlRWwoXCJpbnB1dFwiLCB7XHJcbiAgICAgIGF0dHI6IHtcclxuICAgICAgICB0eXBlOiBcInRleHRcIixcclxuICAgICAgICB2YWx1ZTogY2hhdF9uYW1lXHJcbiAgICAgIH0sXHJcbiAgICAgIGNsczogXCJzYy1jaGF0LW5hbWUtaW5wdXRcIlxyXG4gICAgfSk7XHJcbiAgICBjaGF0X25hbWVfaW5wdXQuYWRkRXZlbnRMaXN0ZW5lcihcImNoYW5nZVwiLCB0aGlzLnJlbmFtZV9jaGF0LmJpbmQodGhpcykpO1xyXG5cclxuICAgIC8vIGNyZWF0ZSBidXR0b24gdG8gU21hcnQgVmlld1xyXG4gICAgbGV0IHNtYXJ0X3ZpZXdfYnRuID0gdGhpcy5jcmVhdGVfdG9wX2Jhcl9idXR0b24odG9wX2Jhcl9jb250YWluZXIsIFwiU21hcnQgVmlld1wiLCBcInNtYXJ0LWNvbm5lY3Rpb25zXCIpO1xyXG4gICAgc21hcnRfdmlld19idG4uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIHRoaXMub3Blbl9zbWFydF92aWV3LmJpbmQodGhpcykpO1xyXG4gICAgLy8gY3JlYXRlIGJ1dHRvbiB0byBzYXZlIGNoYXRcclxuICAgIGxldCBzYXZlX2J0biA9IHRoaXMuY3JlYXRlX3RvcF9iYXJfYnV0dG9uKHRvcF9iYXJfY29udGFpbmVyLCBcIlNhdmUgQ2hhdFwiLCBcInNhdmVcIik7XHJcbiAgICBzYXZlX2J0bi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgdGhpcy5zYXZlX2NoYXQuYmluZCh0aGlzKSk7XHJcbiAgICAvLyBjcmVhdGUgYnV0dG9uIHRvIG9wZW4gY2hhdCBoaXN0b3J5IG1vZGFsXHJcbiAgICBsZXQgaGlzdG9yeV9idG4gPSB0aGlzLmNyZWF0ZV90b3BfYmFyX2J1dHRvbih0b3BfYmFyX2NvbnRhaW5lciwgXCJDaGF0IEhpc3RvcnlcIiwgXCJoaXN0b3J5XCIpO1xyXG4gICAgaGlzdG9yeV9idG4uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIHRoaXMub3Blbl9jaGF0X2hpc3RvcnkuYmluZCh0aGlzKSk7XHJcbiAgICAvLyBjcmVhdGUgYnV0dG9uIHRvIHN0YXJ0IG5ldyBjaGF0XHJcbiAgICBjb25zdCBuZXdfY2hhdF9idG4gPSB0aGlzLmNyZWF0ZV90b3BfYmFyX2J1dHRvbih0b3BfYmFyX2NvbnRhaW5lciwgXCJOZXcgQ2hhdFwiLCBcInBsdXNcIik7XHJcbiAgICBuZXdfY2hhdF9idG4uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIHRoaXMubmV3X2NoYXQuYmluZCh0aGlzKSk7XHJcbiAgfVxyXG4gIGFzeW5jIG9wZW5fY2hhdF9oaXN0b3J5KCkge1xyXG4gICAgY29uc3QgZm9sZGVyID0gYXdhaXQgdGhpcy5hcHAudmF1bHQuYWRhcHRlci5saXN0KFwiLnNtYXJ0LWNvbm5lY3Rpb25zL2NoYXRzXCIpO1xyXG4gICAgdGhpcy5maWxlcyA9IGZvbGRlci5maWxlcy5tYXAoKGZpbGUpID0+IHtcclxuICAgICAgcmV0dXJuIGZpbGUucmVwbGFjZShcIi5zbWFydC1jb25uZWN0aW9ucy9jaGF0cy9cIiwgXCJcIikucmVwbGFjZShcIi5qc29uXCIsIFwiXCIpO1xyXG4gICAgfSk7XHJcbiAgICAvLyBvcGVuIGNoYXQgaGlzdG9yeSBtb2RhbFxyXG4gICAgaWYgKCF0aGlzLm1vZGFsKVxyXG4gICAgICB0aGlzLm1vZGFsID0gbmV3IFNtYXJ0Q29ubmVjdGlvbnNDaGF0SGlzdG9yeU1vZGFsKHRoaXMuYXBwLCB0aGlzKTtcclxuICAgIHRoaXMubW9kYWwub3BlbigpO1xyXG4gIH1cclxuXHJcbiAgY3JlYXRlX3RvcF9iYXJfYnV0dG9uKHRvcF9iYXJfY29udGFpbmVyLCB0aXRsZSwgaWNvbj1udWxsKSB7XHJcbiAgICBsZXQgYnRuID0gdG9wX2Jhcl9jb250YWluZXIuY3JlYXRlRWwoXCJidXR0b25cIiwge1xyXG4gICAgICBhdHRyOiB7XHJcbiAgICAgICAgdGl0bGU6IHRpdGxlXHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG4gICAgaWYoaWNvbil7XHJcbiAgICAgIE9ic2lkaWFuLnNldEljb24oYnRuLCBpY29uKTtcclxuICAgIH1lbHNle1xyXG4gICAgICBidG4uaW5uZXJIVE1MID0gdGl0bGU7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gYnRuO1xyXG4gIH1cclxuICAvLyByZW5kZXIgbmV3IGNoYXRcclxuICBuZXdfY2hhdCgpIHtcclxuICAgIHRoaXMuY2xlYXJfY2hhdCgpO1xyXG4gICAgdGhpcy5yZW5kZXJfY2hhdCgpO1xyXG4gICAgLy8gcmVuZGVyIGluaXRpYWwgbWVzc2FnZSBmcm9tIGFzc2lzdGFudCAoZG9uJ3QgdXNlIHJlbmRlcl9tZXNzYWdlIHRvIHNraXAgYWRkaW5nIHRvIGNoYXQgaGlzdG9yeSlcclxuICAgIHRoaXMubmV3X21lc3NzYWdlX2J1YmJsZShcImFzc2lzdGFudFwiKTtcclxuICAgIHRoaXMuYWN0aXZlX2VsbS5pbm5lckhUTUwgPSAnPHA+JyArIFNNQVJUX1RSQU5TTEFUSU9OW3RoaXMucGx1Z2luLnNldHRpbmdzLmxhbmd1YWdlXS5pbml0aWFsX21lc3NhZ2UrJzwvcD4nO1xyXG4gIH1cclxuICAvLyBvcGVuIGEgY2hhdCBmcm9tIHRoZSBjaGF0IGhpc3RvcnkgbW9kYWxcclxuICBhc3luYyBvcGVuX2NoYXQoY2hhdF9pZCkge1xyXG4gICAgdGhpcy5jbGVhcl9jaGF0KCk7XHJcbiAgICBhd2FpdCB0aGlzLmNoYXQubG9hZF9jaGF0KGNoYXRfaWQpO1xyXG4gICAgdGhpcy5yZW5kZXJfY2hhdCgpO1xyXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLmNoYXQuY2hhdF9tbC5sZW5ndGg7IGkrKykge1xyXG4gICAgICBhd2FpdCB0aGlzLnJlbmRlcl9tZXNzYWdlKHRoaXMuY2hhdC5jaGF0X21sW2ldLmNvbnRlbnQsIHRoaXMuY2hhdC5jaGF0X21sW2ldLnJvbGUpO1xyXG4gICAgfVxyXG4gIH1cclxuICAvLyBjbGVhciBjdXJyZW50IGNoYXQgc3RhdGVcclxuICBjbGVhcl9jaGF0KCkge1xyXG4gICAgaWYgKHRoaXMuY2hhdCkge1xyXG4gICAgICB0aGlzLmNoYXQuc2F2ZV9jaGF0KCk7XHJcbiAgICB9XHJcbiAgICB0aGlzLmNoYXQgPSBuZXcgU21hcnRDb25uZWN0aW9uc0NoYXRNb2RlbCh0aGlzLnBsdWdpbik7XHJcbiAgICAvLyBpZiB0aGlzLmRvdGRvdGRvdF9pbnRlcnZhbCBpcyBub3QgbnVsbCwgY2xlYXIgaW50ZXJ2YWxcclxuICAgIGlmICh0aGlzLmRvdGRvdGRvdF9pbnRlcnZhbCkge1xyXG4gICAgICBjbGVhckludGVydmFsKHRoaXMuZG90ZG90ZG90X2ludGVydmFsKTtcclxuICAgIH1cclxuICAgIC8vIGNsZWFyIGN1cnJlbnQgY2hhdCBtbFxyXG4gICAgdGhpcy5jdXJyZW50X2NoYXRfbWwgPSBbXTtcclxuICAgIC8vIHVwZGF0ZSBwcmV2ZW50IGlucHV0XHJcbiAgICB0aGlzLmVuZF9zdHJlYW0oKTtcclxuICB9XHJcblxyXG4gIHJlbmFtZV9jaGF0KGV2ZW50KSB7XHJcbiAgICBsZXQgbmV3X2NoYXRfbmFtZSA9IGV2ZW50LnRhcmdldC52YWx1ZTtcclxuICAgIHRoaXMuY2hhdC5yZW5hbWVfY2hhdChuZXdfY2hhdF9uYW1lKTtcclxuICB9XHJcblxyXG4gIC8vIHNhdmUgY3VycmVudCBjaGF0XHJcbiAgc2F2ZV9jaGF0KCkge1xyXG4gICAgdGhpcy5jaGF0LnNhdmVfY2hhdCgpO1xyXG4gICAgbmV3IE9ic2lkaWFuLk5vdGljZShcIltTbWFydCBDb25uZWN0aW9uc10gQ2hhdCBzYXZlZFwiKTtcclxuICB9XHJcblxyXG4gIG9wZW5fc21hcnRfdmlldygpIHtcclxuICAgIHRoaXMucGx1Z2luLm9wZW5fdmlldygpO1xyXG4gIH1cclxuICAvLyByZW5kZXIgY2hhdCBtZXNzYWdlcyBjb250YWluZXJcclxuICByZW5kZXJfY2hhdF9ib3goKSB7XHJcbiAgICAvLyBjcmVhdGUgY29udGFpbmVyIGZvciBjaGF0IG1lc3NhZ2VzXHJcbiAgICB0aGlzLmNoYXRfYm94ID0gdGhpcy5jaGF0X2NvbnRhaW5lci5jcmVhdGVEaXYoXCJzYy1jaGF0LWJveFwiKTtcclxuICAgIC8vIGNyZWF0ZSBjb250YWluZXIgZm9yIG1lc3NhZ2VcclxuICAgIHRoaXMubWVzc2FnZV9jb250YWluZXIgPSB0aGlzLmNoYXRfYm94LmNyZWF0ZURpdihcInNjLW1lc3NhZ2UtY29udGFpbmVyXCIpO1xyXG4gIH1cclxuICAvLyBvcGVuIGZpbGUgc3VnZ2VzdGlvbiBtb2RhbFxyXG4gIG9wZW5fZmlsZV9zdWdnZXN0aW9uX21vZGFsKCkge1xyXG4gICAgLy8gb3BlbiBmaWxlIHN1Z2dlc3Rpb24gbW9kYWxcclxuICAgIGlmKCF0aGlzLmZpbGVfc2VsZWN0b3IpIHRoaXMuZmlsZV9zZWxlY3RvciA9IG5ldyBTbWFydENvbm5lY3Rpb25zRmlsZVNlbGVjdE1vZGFsKHRoaXMuYXBwLCB0aGlzKTtcclxuICAgIHRoaXMuZmlsZV9zZWxlY3Rvci5vcGVuKCk7XHJcbiAgfVxyXG4gIC8vIG9wZW4gZm9sZGVyIHN1Z2dlc3Rpb24gbW9kYWxcclxuICBhc3luYyBvcGVuX2ZvbGRlcl9zdWdnZXN0aW9uX21vZGFsKCkge1xyXG4gICAgLy8gb3BlbiBmb2xkZXIgc3VnZ2VzdGlvbiBtb2RhbFxyXG4gICAgaWYoIXRoaXMuZm9sZGVyX3NlbGVjdG9yKXtcclxuICAgICAgdGhpcy5mb2xkZXJfc2VsZWN0b3IgPSBuZXcgU21hcnRDb25uZWN0aW9uc0ZvbGRlclNlbGVjdE1vZGFsKHRoaXMuYXBwLCB0aGlzKTtcclxuICAgIH1cclxuICAgIHRoaXMuZm9sZGVyX3NlbGVjdG9yLm9wZW4oKTtcclxuICB9XHJcbiAgLy8gaW5zZXJ0X3NlbGVjdGlvbiBmcm9tIGZpbGUgc3VnZ2VzdGlvbiBtb2RhbFxyXG4gIGluc2VydF9zZWxlY3Rpb24oaW5zZXJ0X3RleHQpIHtcclxuICAgIC8vIGdldCBjYXJldCBwb3NpdGlvblxyXG4gICAgbGV0IGNhcmV0X3BvcyA9IHRoaXMudGV4dGFyZWEuc2VsZWN0aW9uU3RhcnQ7XHJcbiAgICAvLyBnZXQgdGV4dCBiZWZvcmUgY2FyZXRcclxuICAgIGxldCB0ZXh0X2JlZm9yZSA9IHRoaXMudGV4dGFyZWEudmFsdWUuc3Vic3RyaW5nKDAsIGNhcmV0X3Bvcyk7XHJcbiAgICAvLyBnZXQgdGV4dCBhZnRlciBjYXJldFxyXG4gICAgbGV0IHRleHRfYWZ0ZXIgPSB0aGlzLnRleHRhcmVhLnZhbHVlLnN1YnN0cmluZyhjYXJldF9wb3MsIHRoaXMudGV4dGFyZWEudmFsdWUubGVuZ3RoKTtcclxuICAgIC8vIGluc2VydCB0ZXh0XHJcbiAgICB0aGlzLnRleHRhcmVhLnZhbHVlID0gdGV4dF9iZWZvcmUgKyBpbnNlcnRfdGV4dCArIHRleHRfYWZ0ZXI7XHJcbiAgICAvLyBzZXQgY2FyZXQgcG9zaXRpb25cclxuICAgIHRoaXMudGV4dGFyZWEuc2VsZWN0aW9uU3RhcnQgPSBjYXJldF9wb3MgKyBpbnNlcnRfdGV4dC5sZW5ndGg7XHJcbiAgICB0aGlzLnRleHRhcmVhLnNlbGVjdGlvbkVuZCA9IGNhcmV0X3BvcyArIGluc2VydF90ZXh0Lmxlbmd0aDtcclxuICAgIC8vIGZvY3VzIG9uIHRleHRhcmVhXHJcbiAgICB0aGlzLnRleHRhcmVhLmZvY3VzKCk7XHJcbiAgfVxyXG5cclxuICAvLyByZW5kZXIgY2hhdCB0ZXh0YXJlYSBhbmQgYnV0dG9uXHJcbiAgcmVuZGVyX2NoYXRfaW5wdXQoKSB7XHJcbiAgICAvLyBjcmVhdGUgY29udGFpbmVyIGZvciBjaGF0IGlucHV0XHJcbiAgICBsZXQgY2hhdF9pbnB1dCA9IHRoaXMuY2hhdF9jb250YWluZXIuY3JlYXRlRGl2KFwic2MtY2hhdC1mb3JtXCIpO1xyXG4gICAgLy8gY3JlYXRlIHRleHRhcmVhXHJcbiAgICB0aGlzLnRleHRhcmVhID0gY2hhdF9pbnB1dC5jcmVhdGVFbChcInRleHRhcmVhXCIsIHtcclxuICAgICAgY2xzOiBcInNjLWNoYXQtaW5wdXRcIixcclxuICAgICAgYXR0cjoge1xyXG4gICAgICAgIHBsYWNlaG9sZGVyOiBTTUFSVF9UUkFOU0xBVElPTlt0aGlzLnBsdWdpbi5zZXR0aW5ncy5sYW5ndWFnZV0udHJ5X3BsYWNlaG9sZGVyXHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG4gICAgLy8gdXNlIGNvbnRlbnRlZGl0YWJsZSBpbnN0ZWFkIG9mIHRleHRhcmVhXHJcbiAgICAvLyB0aGlzLnRleHRhcmVhID0gY2hhdF9pbnB1dC5jcmVhdGVFbChcImRpdlwiLCB7Y2xzOiBcInNjLWNoYXQtaW5wdXRcIiwgYXR0cjoge2NvbnRlbnRlZGl0YWJsZTogdHJ1ZX19KTtcclxuICAgIC8vIGFkZCBldmVudCBsaXN0ZW5lciB0byBsaXN0ZW4gZm9yIHNoaWZ0K2VudGVyXHJcbiAgICBjaGF0X2lucHV0LmFkZEV2ZW50TGlzdGVuZXIoXCJrZXl1cFwiLCAoZSkgPT4ge1xyXG4gICAgICBpZihbXCJbXCIsIFwiL1wiXS5pbmRleE9mKGUua2V5KSA9PT0gLTEpIHJldHVybjsgLy8gc2tpcCBpZiBrZXkgaXMgbm90IFsgb3IgL1xyXG4gICAgICBjb25zdCBjYXJldF9wb3MgPSB0aGlzLnRleHRhcmVhLnNlbGVjdGlvblN0YXJ0O1xyXG4gICAgICAvLyBpZiBrZXkgaXMgb3BlbiBzcXVhcmUgYnJhY2tldFxyXG4gICAgICBpZiAoZS5rZXkgPT09IFwiW1wiKSB7XHJcbiAgICAgICAgLy8gaWYgcHJldmlvdXMgY2hhciBpcyBbXHJcbiAgICAgICAgaWYodGhpcy50ZXh0YXJlYS52YWx1ZVtjYXJldF9wb3MgLSAyXSA9PT0gXCJbXCIpe1xyXG4gICAgICAgICAgLy8gb3BlbiBmaWxlIHN1Z2dlc3Rpb24gbW9kYWxcclxuICAgICAgICAgIHRoaXMub3Blbl9maWxlX3N1Z2dlc3Rpb25fbW9kYWwoKTtcclxuICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcbiAgICAgIH1lbHNle1xyXG4gICAgICAgIHRoaXMuYnJhY2tldHNfY3QgPSAwO1xyXG4gICAgICB9XHJcbiAgICAgIC8vIGlmIC8gaXMgcHJlc3NlZFxyXG4gICAgICBpZiAoZS5rZXkgPT09IFwiL1wiKSB7XHJcbiAgICAgICAgLy8gZ2V0IGNhcmV0IHBvc2l0aW9uXHJcbiAgICAgICAgLy8gaWYgdGhpcyBpcyBmaXJzdCBjaGFyIG9yIHByZXZpb3VzIGNoYXIgaXMgc3BhY2VcclxuICAgICAgICBpZiAodGhpcy50ZXh0YXJlYS52YWx1ZS5sZW5ndGggPT09IDEgfHwgdGhpcy50ZXh0YXJlYS52YWx1ZVtjYXJldF9wb3MgLSAyXSA9PT0gXCIgXCIpIHtcclxuICAgICAgICAgIC8vIG9wZW4gZm9sZGVyIHN1Z2dlc3Rpb24gbW9kYWxcclxuICAgICAgICAgIHRoaXMub3Blbl9mb2xkZXJfc3VnZ2VzdGlvbl9tb2RhbCgpO1xyXG4gICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG5cclxuICAgIH0pO1xyXG5cclxuICAgIGNoYXRfaW5wdXQuYWRkRXZlbnRMaXN0ZW5lcihcImtleWRvd25cIiwgKGUpID0+IHtcclxuICAgICAgaWYgKGUua2V5ID09PSBcIkVudGVyXCIgJiYgZS5zaGlmdEtleSkge1xyXG4gICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcclxuICAgICAgICBpZih0aGlzLnByZXZlbnRfaW5wdXQpe1xyXG4gICAgICAgICAgY29uc29sZS5sb2coXCJ3YWl0IHVudGlsIGN1cnJlbnQgcmVzcG9uc2UgaXMgZmluaXNoZWRcIik7XHJcbiAgICAgICAgICBuZXcgT2JzaWRpYW4uTm90aWNlKFwiW1NtYXJ0IENvbm5lY3Rpb25zXSBXYWl0IHVudGlsIGN1cnJlbnQgcmVzcG9uc2UgaXMgZmluaXNoZWRcIik7XHJcbiAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG4gICAgICAgIC8vIGdldCB0ZXh0IGZyb20gdGV4dGFyZWFcclxuICAgICAgICBsZXQgdXNlcl9pbnB1dCA9IHRoaXMudGV4dGFyZWEudmFsdWU7XHJcbiAgICAgICAgLy8gY2xlYXIgdGV4dGFyZWFcclxuICAgICAgICB0aGlzLnRleHRhcmVhLnZhbHVlID0gXCJcIjtcclxuICAgICAgICAvLyBpbml0aWF0ZSByZXNwb25zZSBmcm9tIGFzc2lzdGFudFxyXG4gICAgICAgIHRoaXMuaW5pdGlhbGl6ZV9yZXNwb25zZSh1c2VyX2lucHV0KTtcclxuICAgICAgfVxyXG4gICAgICB0aGlzLnRleHRhcmVhLnN0eWxlLmhlaWdodCA9ICdhdXRvJztcclxuICAgICAgdGhpcy50ZXh0YXJlYS5zdHlsZS5oZWlnaHQgPSAodGhpcy50ZXh0YXJlYS5zY3JvbGxIZWlnaHQpICsgJ3B4JztcclxuICAgIH0pO1xyXG4gICAgLy8gYnV0dG9uIGNvbnRhaW5lclxyXG4gICAgbGV0IGJ1dHRvbl9jb250YWluZXIgPSBjaGF0X2lucHV0LmNyZWF0ZURpdihcInNjLWJ1dHRvbi1jb250YWluZXJcIik7XHJcbiAgICAvLyBjcmVhdGUgaGlkZGVuIGFib3J0IGJ1dHRvblxyXG4gICAgbGV0IGFib3J0X2J1dHRvbiA9IGJ1dHRvbl9jb250YWluZXIuY3JlYXRlRWwoXCJzcGFuXCIsIHsgYXR0cjoge2lkOiBcInNjLWFib3J0LWJ1dHRvblwiLCBzdHlsZTogXCJkaXNwbGF5OiBub25lO1wifSB9KTtcclxuICAgIE9ic2lkaWFuLnNldEljb24oYWJvcnRfYnV0dG9uLCBcInNxdWFyZVwiKTtcclxuICAgIC8vIGFkZCBldmVudCBsaXN0ZW5lciB0byBidXR0b25cclxuICAgIGFib3J0X2J1dHRvbi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4ge1xyXG4gICAgICAvLyBhYm9ydCBjdXJyZW50IHJlc3BvbnNlXHJcbiAgICAgIHRoaXMuZW5kX3N0cmVhbSgpO1xyXG4gICAgfSk7XHJcbiAgICAvLyBjcmVhdGUgYnV0dG9uXHJcbiAgICBsZXQgYnV0dG9uID0gYnV0dG9uX2NvbnRhaW5lci5jcmVhdGVFbChcImJ1dHRvblwiLCB7IGF0dHI6IHtpZDogXCJzYy1zZW5kLWJ1dHRvblwifSwgY2xzOiBcInNlbmQtYnV0dG9uXCIgfSk7XHJcbiAgICBidXR0b24uaW5uZXJIVE1MID0gXCJTZW5kXCI7XHJcbiAgICAvLyBhZGQgZXZlbnQgbGlzdGVuZXIgdG8gYnV0dG9uXHJcbiAgICBidXR0b24uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHtcclxuICAgICAgaWYodGhpcy5wcmV2ZW50X2lucHV0KXtcclxuICAgICAgICBjb25zb2xlLmxvZyhcIndhaXQgdW50aWwgY3VycmVudCByZXNwb25zZSBpcyBmaW5pc2hlZFwiKTtcclxuICAgICAgICBuZXcgT2JzaWRpYW4uTm90aWNlKFwiV2FpdCB1bnRpbCBjdXJyZW50IHJlc3BvbnNlIGlzIGZpbmlzaGVkXCIpO1xyXG4gICAgICAgIHJldHVybjtcclxuICAgICAgfVxyXG4gICAgICAvLyBnZXQgdGV4dCBmcm9tIHRleHRhcmVhXHJcbiAgICAgIGxldCB1c2VyX2lucHV0ID0gdGhpcy50ZXh0YXJlYS52YWx1ZTtcclxuICAgICAgLy8gY2xlYXIgdGV4dGFyZWFcclxuICAgICAgdGhpcy50ZXh0YXJlYS52YWx1ZSA9IFwiXCI7XHJcbiAgICAgIC8vIGluaXRpYXRlIHJlc3BvbnNlIGZyb20gYXNzaXN0YW50XHJcbiAgICAgIHRoaXMuaW5pdGlhbGl6ZV9yZXNwb25zZSh1c2VyX2lucHV0KTtcclxuICAgIH0pO1xyXG4gIH1cclxuICBhc3luYyBpbml0aWFsaXplX3Jlc3BvbnNlKHVzZXJfaW5wdXQpIHtcclxuICAgIHRoaXMuc2V0X3N0cmVhbWluZ191eCgpO1xyXG4gICAgLy8gcmVuZGVyIG1lc3NhZ2VcclxuICAgIGF3YWl0IHRoaXMucmVuZGVyX21lc3NhZ2UodXNlcl9pbnB1dCwgXCJ1c2VyXCIpO1xyXG4gICAgdGhpcy5jaGF0Lm5ld19tZXNzYWdlX2luX3RocmVhZCh7XHJcbiAgICAgIHJvbGU6IFwidXNlclwiLFxyXG4gICAgICBjb250ZW50OiB1c2VyX2lucHV0XHJcbiAgICB9KTtcclxuICAgIGF3YWl0IHRoaXMucmVuZGVyX2RvdGRvdGRvdCgpO1xyXG5cclxuICAgIC8vIGlmIGNvbnRhaW5zIGludGVybmFsIGxpbmsgcmVwcmVzZW50ZWQgYnkgW1tsaW5rXV1cclxuICAgIGlmKHRoaXMuY2hhdC5jb250YWluc19pbnRlcm5hbF9saW5rKHVzZXJfaW5wdXQpKSB7XHJcbiAgICAgIHRoaXMuY2hhdC5nZXRfcmVzcG9uc2Vfd2l0aF9ub3RlX2NvbnRleHQodXNlcl9pbnB1dCwgdGhpcyk7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuICAgIC8vIC8vIGZvciB0ZXN0aW5nIHB1cnBvc2VzXHJcbiAgICAvLyBpZih0aGlzLmNoYXQuY29udGFpbnNfZm9sZGVyX3JlZmVyZW5jZSh1c2VyX2lucHV0KSkge1xyXG4gICAgLy8gICBjb25zdCBmb2xkZXJzID0gdGhpcy5jaGF0LmdldF9mb2xkZXJfcmVmZXJlbmNlcyh1c2VyX2lucHV0KTtcclxuICAgIC8vICAgY29uc29sZS5sb2coZm9sZGVycyk7XHJcbiAgICAvLyAgIHJldHVybjtcclxuICAgIC8vIH1cclxuICAgIC8vIGlmIGNvbnRhaW5zIHNlbGYgcmVmZXJlbnRpYWwga2V5d29yZHMgb3IgZm9sZGVyIHJlZmVyZW5jZVxyXG4gICAgaWYodGhpcy5jb250YWluc19zZWxmX3JlZmVyZW50aWFsX2tleXdvcmRzKHVzZXJfaW5wdXQpIHx8IHRoaXMuY2hhdC5jb250YWluc19mb2xkZXJfcmVmZXJlbmNlKHVzZXJfaW5wdXQpKSB7XHJcbiAgICAgIC8vIGdldCBoeWRlXHJcbiAgICAgIGNvbnN0IGNvbnRleHQgPSBhd2FpdCB0aGlzLmdldF9jb250ZXh0X2h5ZGUodXNlcl9pbnB1dCk7XHJcbiAgICAgIC8vIGdldCB1c2VyIGlucHV0IHdpdGggYWRkZWQgY29udGV4dFxyXG4gICAgICAvLyBjb25zdCBjb250ZXh0X2lucHV0ID0gdGhpcy5idWlsZF9jb250ZXh0X2lucHV0KGNvbnRleHQpO1xyXG4gICAgICAvLyBjb25zb2xlLmxvZyhjb250ZXh0X2lucHV0KTtcclxuICAgICAgY29uc3QgY2hhdG1sID0gW1xyXG4gICAgICAgIHtcclxuICAgICAgICAgIHJvbGU6IFwic3lzdGVtXCIsXHJcbiAgICAgICAgICAvLyBjb250ZW50OiBjb250ZXh0X2lucHV0XHJcbiAgICAgICAgICBjb250ZW50OiBjb250ZXh0XHJcbiAgICAgICAgfSxcclxuICAgICAgICB7XHJcbiAgICAgICAgICByb2xlOiBcInVzZXJcIixcclxuICAgICAgICAgIGNvbnRlbnQ6IHVzZXJfaW5wdXRcclxuICAgICAgICB9XHJcbiAgICAgIF07XHJcbiAgICAgIHRoaXMucmVxdWVzdF9jaGF0Z3B0X2NvbXBsZXRpb24oe21lc3NhZ2VzOiBjaGF0bWwsIHRlbXBlcmF0dXJlOiAwfSk7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuICAgIC8vIGNvbXBsZXRpb24gd2l0aG91dCBhbnkgc3BlY2lmaWMgY29udGV4dFxyXG4gICAgdGhpcy5yZXF1ZXN0X2NoYXRncHRfY29tcGxldGlvbigpO1xyXG4gIH1cclxuXHJcbiAgYXN5bmMgcmVuZGVyX2RvdGRvdGRvdCgpIHtcclxuICAgIGlmICh0aGlzLmRvdGRvdGRvdF9pbnRlcnZhbClcclxuICAgICAgY2xlYXJJbnRlcnZhbCh0aGlzLmRvdGRvdGRvdF9pbnRlcnZhbCk7XHJcbiAgICBhd2FpdCB0aGlzLnJlbmRlcl9tZXNzYWdlKFwiLi4uXCIsIFwiYXNzaXN0YW50XCIpO1xyXG4gICAgLy8gaWYgaXMgJy4uLicsIHRoZW4gaW5pdGlhdGUgaW50ZXJ2YWwgdG8gY2hhbmdlIHRvICcuJyBhbmQgdGhlbiB0byAnLi4nIGFuZCB0aGVuIHRvICcuLi4nXHJcbiAgICBsZXQgZG90cyA9IDA7XHJcbiAgICB0aGlzLmFjdGl2ZV9lbG0uaW5uZXJIVE1MID0gJy4uLic7XHJcbiAgICB0aGlzLmRvdGRvdGRvdF9pbnRlcnZhbCA9IHNldEludGVydmFsKCgpID0+IHtcclxuICAgICAgZG90cysrO1xyXG4gICAgICBpZiAoZG90cyA+IDMpXHJcbiAgICAgICAgZG90cyA9IDE7XHJcbiAgICAgIHRoaXMuYWN0aXZlX2VsbS5pbm5lckhUTUwgPSAnLicucmVwZWF0KGRvdHMpO1xyXG4gICAgfSwgNTAwKTtcclxuICAgIC8vIHdhaXQgMiBzZWNvbmRzIGZvciB0ZXN0aW5nXHJcbiAgICAvLyBhd2FpdCBuZXcgUHJvbWlzZShyID0+IHNldFRpbWVvdXQociwgMjAwMCkpO1xyXG4gIH1cclxuXHJcbiAgc2V0X3N0cmVhbWluZ191eCgpIHtcclxuICAgIHRoaXMucHJldmVudF9pbnB1dCA9IHRydWU7XHJcbiAgICAvLyBoaWRlIHNlbmQgYnV0dG9uXHJcbiAgICBpZihkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcInNjLXNlbmQtYnV0dG9uXCIpKVxyXG4gICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcInNjLXNlbmQtYnV0dG9uXCIpLnN0eWxlLmRpc3BsYXkgPSBcIm5vbmVcIjtcclxuICAgIC8vIHNob3cgYWJvcnQgYnV0dG9uXHJcbiAgICBpZihkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcInNjLWFib3J0LWJ1dHRvblwiKSlcclxuICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJzYy1hYm9ydC1idXR0b25cIikuc3R5bGUuZGlzcGxheSA9IFwiYmxvY2tcIjtcclxuICB9XHJcbiAgdW5zZXRfc3RyZWFtaW5nX3V4KCkge1xyXG4gICAgdGhpcy5wcmV2ZW50X2lucHV0ID0gZmFsc2U7XHJcbiAgICAvLyBzaG93IHNlbmQgYnV0dG9uLCByZW1vdmUgZGlzcGxheSBub25lXHJcbiAgICBpZihkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcInNjLXNlbmQtYnV0dG9uXCIpKVxyXG4gICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcInNjLXNlbmQtYnV0dG9uXCIpLnN0eWxlLmRpc3BsYXkgPSBcIlwiO1xyXG4gICAgLy8gaGlkZSBhYm9ydCBidXR0b25cclxuICAgIGlmKGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwic2MtYWJvcnQtYnV0dG9uXCIpKVxyXG4gICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcInNjLWFib3J0LWJ1dHRvblwiKS5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCI7XHJcbiAgfVxyXG5cclxuXHJcbiAgLy8gY2hlY2sgaWYgaW5jbHVkZXMga2V5d29yZHMgcmVmZXJyaW5nIHRvIG9uZSdzIG93biBub3Rlc1xyXG4gIGNvbnRhaW5zX3NlbGZfcmVmZXJlbnRpYWxfa2V5d29yZHModXNlcl9pbnB1dCkge1xyXG4gICAgY29uc3QgbWF0Y2hlcyA9IHVzZXJfaW5wdXQubWF0Y2godGhpcy5wbHVnaW4uc2VsZl9yZWZfa3dfcmVnZXgpO1xyXG4gICAgaWYobWF0Y2hlcykgcmV0dXJuIHRydWU7XHJcbiAgICByZXR1cm4gZmFsc2U7XHJcbiAgfVxyXG5cclxuICAvLyByZW5kZXIgbWVzc2FnZVxyXG4gIGFzeW5jIHJlbmRlcl9tZXNzYWdlKG1lc3NhZ2UsIGZyb209XCJhc3Npc3RhbnRcIiwgYXBwZW5kX2xhc3Q9ZmFsc2UpIHtcclxuICAgIC8vIGlmIGRvdGRvdGRvdCBpbnRlcnZhbCBpcyBzZXQsIHRoZW4gY2xlYXIgaXRcclxuICAgIGlmKHRoaXMuZG90ZG90ZG90X2ludGVydmFsKSB7XHJcbiAgICAgIGNsZWFySW50ZXJ2YWwodGhpcy5kb3Rkb3Rkb3RfaW50ZXJ2YWwpO1xyXG4gICAgICB0aGlzLmRvdGRvdGRvdF9pbnRlcnZhbCA9IG51bGw7XHJcbiAgICAgIC8vIGNsZWFyIGxhc3QgbWVzc2FnZVxyXG4gICAgICB0aGlzLmFjdGl2ZV9lbG0uaW5uZXJIVE1MID0gJyc7XHJcbiAgICB9XHJcbiAgICBpZihhcHBlbmRfbGFzdCkge1xyXG4gICAgICB0aGlzLmN1cnJlbnRfbWVzc2FnZV9yYXcgKz0gbWVzc2FnZTtcclxuICAgICAgaWYobWVzc2FnZS5pbmRleE9mKCdcXG4nKSA9PT0gLTEpIHtcclxuICAgICAgICB0aGlzLmFjdGl2ZV9lbG0uaW5uZXJIVE1MICs9IG1lc3NhZ2U7XHJcbiAgICAgIH1lbHNle1xyXG4gICAgICAgIHRoaXMuYWN0aXZlX2VsbS5pbm5lckhUTUwgPSAnJztcclxuICAgICAgICAvLyBhcHBlbmQgdG8gbGFzdCBtZXNzYWdlXHJcbiAgICAgICAgYXdhaXQgT2JzaWRpYW4uTWFya2Rvd25SZW5kZXJlci5yZW5kZXJNYXJrZG93bih0aGlzLmN1cnJlbnRfbWVzc2FnZV9yYXcsIHRoaXMuYWN0aXZlX2VsbSwgJz9uby1kYXRhdmlldycsIG5ldyBPYnNpZGlhbi5Db21wb25lbnQoKSk7XHJcbiAgICAgIH1cclxuICAgIH1lbHNle1xyXG4gICAgICB0aGlzLmN1cnJlbnRfbWVzc2FnZV9yYXcgPSAnJztcclxuICAgICAgaWYoKHRoaXMuY2hhdC50aHJlYWQubGVuZ3RoID09PSAwKSB8fCAodGhpcy5sYXN0X2Zyb20gIT09IGZyb20pKSB7XHJcbiAgICAgICAgLy8gY3JlYXRlIG1lc3NhZ2VcclxuICAgICAgICB0aGlzLm5ld19tZXNzc2FnZV9idWJibGUoZnJvbSk7XHJcbiAgICAgIH1cclxuICAgICAgLy8gc2V0IG1lc3NhZ2UgdGV4dFxyXG4gICAgICB0aGlzLmFjdGl2ZV9lbG0uaW5uZXJIVE1MID0gJyc7XHJcbiAgICAgIGF3YWl0IE9ic2lkaWFuLk1hcmtkb3duUmVuZGVyZXIucmVuZGVyTWFya2Rvd24obWVzc2FnZSwgdGhpcy5hY3RpdmVfZWxtLCAnP25vLWRhdGF2aWV3JywgbmV3IE9ic2lkaWFuLkNvbXBvbmVudCgpKTtcclxuICAgICAgLy8gZ2V0IGxpbmtzXHJcbiAgICAgIHRoaXMuaGFuZGxlX2xpbmtzX2luX21lc3NhZ2UoKTtcclxuICAgICAgLy8gcmVuZGVyIGJ1dHRvbihzKVxyXG4gICAgICB0aGlzLnJlbmRlcl9tZXNzYWdlX2FjdGlvbl9idXR0b25zKG1lc3NhZ2UpO1xyXG4gICAgfVxyXG4gICAgLy8gc2Nyb2xsIHRvIGJvdHRvbVxyXG4gICAgdGhpcy5tZXNzYWdlX2NvbnRhaW5lci5zY3JvbGxUb3AgPSB0aGlzLm1lc3NhZ2VfY29udGFpbmVyLnNjcm9sbEhlaWdodDtcclxuICB9XHJcbiAgcmVuZGVyX21lc3NhZ2VfYWN0aW9uX2J1dHRvbnMobWVzc2FnZSkge1xyXG4gICAgaWYgKHRoaXMuY2hhdC5jb250ZXh0ICYmIHRoaXMuY2hhdC5oeWQpIHtcclxuICAgICAgLy8gcmVuZGVyIGJ1dHRvbiB0byBjb3B5IGh5ZCBpbiBzbWFydC1jb25uZWN0aW9ucyBjb2RlIGJsb2NrXHJcbiAgICAgIGNvbnN0IGNvbnRleHRfdmlldyA9IHRoaXMuYWN0aXZlX2VsbS5jcmVhdGVFbChcInNwYW5cIiwge1xyXG4gICAgICAgIGNsczogXCJzYy1tc2ctYnV0dG9uXCIsXHJcbiAgICAgICAgYXR0cjoge1xyXG4gICAgICAgICAgdGl0bGU6IFwiQ29weSBjb250ZXh0IHRvIGNsaXBib2FyZFwiIC8qIHRvb2x0aXAgKi9cclxuICAgICAgICB9XHJcbiAgICAgIH0pO1xyXG4gICAgICBjb25zdCB0aGlzX2h5ZCA9IHRoaXMuY2hhdC5oeWQ7XHJcbiAgICAgIE9ic2lkaWFuLnNldEljb24oY29udGV4dF92aWV3LCBcImV5ZVwiKTtcclxuICAgICAgY29udGV4dF92aWV3LmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiB7XHJcbiAgICAgICAgLy8gY29weSB0byBjbGlwYm9hcmRcclxuICAgICAgICBuYXZpZ2F0b3IuY2xpcGJvYXJkLndyaXRlVGV4dChcImBgYHNtYXJ0LWNvbm5lY3Rpb25zXFxuXCIgKyB0aGlzX2h5ZCArIFwiXFxuYGBgXFxuXCIpO1xyXG4gICAgICAgIG5ldyBPYnNpZGlhbi5Ob3RpY2UoXCJbU21hcnQgQ29ubmVjdGlvbnNdIENvbnRleHQgY29kZSBibG9jayBjb3BpZWQgdG8gY2xpcGJvYXJkXCIpO1xyXG4gICAgICB9KTtcclxuICAgIH1cclxuICAgIGlmKHRoaXMuY2hhdC5jb250ZXh0KSB7XHJcbiAgICAgIC8vIHJlbmRlciBjb3B5IGNvbnRleHQgYnV0dG9uXHJcbiAgICAgIGNvbnN0IGNvcHlfcHJvbXB0X2J1dHRvbiA9IHRoaXMuYWN0aXZlX2VsbS5jcmVhdGVFbChcInNwYW5cIiwge1xyXG4gICAgICAgIGNsczogXCJzYy1tc2ctYnV0dG9uXCIsXHJcbiAgICAgICAgYXR0cjoge1xyXG4gICAgICAgICAgdGl0bGU6IFwiQ29weSBwcm9tcHQgdG8gY2xpcGJvYXJkXCIgLyogdG9vbHRpcCAqL1xyXG4gICAgICAgIH1cclxuICAgICAgfSk7XHJcbiAgICAgIGNvbnN0IHRoaXNfY29udGV4dCA9IHRoaXMuY2hhdC5jb250ZXh0LnJlcGxhY2UoL1xcYFxcYFxcYC9nLCBcIlxcdGBgYFwiKS50cmltTGVmdCgpO1xyXG4gICAgICBPYnNpZGlhbi5zZXRJY29uKGNvcHlfcHJvbXB0X2J1dHRvbiwgXCJmaWxlc1wiKTtcclxuICAgICAgY29weV9wcm9tcHRfYnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiB7XHJcbiAgICAgICAgLy8gY29weSB0byBjbGlwYm9hcmRcclxuICAgICAgICBuYXZpZ2F0b3IuY2xpcGJvYXJkLndyaXRlVGV4dChcImBgYHByb21wdC1jb250ZXh0XFxuXCIgKyB0aGlzX2NvbnRleHQgKyBcIlxcbmBgYFxcblwiKTtcclxuICAgICAgICBuZXcgT2JzaWRpYW4uTm90aWNlKFwiW1NtYXJ0IENvbm5lY3Rpb25zXSBDb250ZXh0IGNvcGllZCB0byBjbGlwYm9hcmRcIik7XHJcbiAgICAgIH0pO1xyXG4gICAgfVxyXG4gICAgLy8gcmVuZGVyIGNvcHkgYnV0dG9uXHJcbiAgICBjb25zdCBjb3B5X2J1dHRvbiA9IHRoaXMuYWN0aXZlX2VsbS5jcmVhdGVFbChcInNwYW5cIiwge1xyXG4gICAgICBjbHM6IFwic2MtbXNnLWJ1dHRvblwiLFxyXG4gICAgICBhdHRyOiB7XHJcbiAgICAgICAgdGl0bGU6IFwiQ29weSBtZXNzYWdlIHRvIGNsaXBib2FyZFwiIC8qIHRvb2x0aXAgKi9cclxuICAgICAgfVxyXG4gICAgfSk7XHJcbiAgICBPYnNpZGlhbi5zZXRJY29uKGNvcHlfYnV0dG9uLCBcImNvcHlcIik7XHJcbiAgICBjb3B5X2J1dHRvbi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4ge1xyXG4gICAgICAvLyBjb3B5IG1lc3NhZ2UgdG8gY2xpcGJvYXJkXHJcbiAgICAgIG5hdmlnYXRvci5jbGlwYm9hcmQud3JpdGVUZXh0KG1lc3NhZ2UudHJpbUxlZnQoKSk7XHJcbiAgICAgIG5ldyBPYnNpZGlhbi5Ob3RpY2UoXCJbU21hcnQgQ29ubmVjdGlvbnNdIE1lc3NhZ2UgY29waWVkIHRvIGNsaXBib2FyZFwiKTtcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgaGFuZGxlX2xpbmtzX2luX21lc3NhZ2UoKSB7XHJcbiAgICBjb25zdCBsaW5rcyA9IHRoaXMuYWN0aXZlX2VsbS5xdWVyeVNlbGVjdG9yQWxsKFwiYVwiKTtcclxuICAgIC8vIGlmIHRoaXMgYWN0aXZlIGVsZW1lbnQgY29udGFpbnMgYSBsaW5rXHJcbiAgICBpZiAobGlua3MubGVuZ3RoID4gMCkge1xyXG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxpbmtzLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgY29uc3QgbGluayA9IGxpbmtzW2ldO1xyXG4gICAgICAgIGNvbnN0IGxpbmtfdGV4dCA9IGxpbmsuZ2V0QXR0cmlidXRlKFwiZGF0YS1ocmVmXCIpO1xyXG4gICAgICAgIC8vIHRyaWdnZXIgaG92ZXIgZXZlbnQgb24gbGlua1xyXG4gICAgICAgIGxpbmsuYWRkRXZlbnRMaXN0ZW5lcihcIm1vdXNlb3ZlclwiLCAoZXZlbnQpID0+IHtcclxuICAgICAgICAgIHRoaXMuYXBwLndvcmtzcGFjZS50cmlnZ2VyKFwiaG92ZXItbGlua1wiLCB7XHJcbiAgICAgICAgICAgIGV2ZW50LFxyXG4gICAgICAgICAgICBzb3VyY2U6IFNNQVJUX0NPTk5FQ1RJT05TX0NIQVRfVklFV19UWVBFLFxyXG4gICAgICAgICAgICBob3ZlclBhcmVudDogbGluay5wYXJlbnRFbGVtZW50LFxyXG4gICAgICAgICAgICB0YXJnZXRFbDogbGluayxcclxuICAgICAgICAgICAgLy8gZXh0cmFjdCBsaW5rIHRleHQgZnJvbSBhLmRhdGEtaHJlZlxyXG4gICAgICAgICAgICBsaW5rdGV4dDogbGlua190ZXh0XHJcbiAgICAgICAgICB9KTtcclxuICAgICAgICB9KTtcclxuICAgICAgICAvLyB0cmlnZ2VyIG9wZW4gbGluayBldmVudCBvbiBsaW5rXHJcbiAgICAgICAgbGluay5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKGV2ZW50KSA9PiB7XHJcbiAgICAgICAgICBjb25zdCBsaW5rX3RmaWxlID0gdGhpcy5hcHAubWV0YWRhdGFDYWNoZS5nZXRGaXJzdExpbmtwYXRoRGVzdChsaW5rX3RleHQsIFwiL1wiKTtcclxuICAgICAgICAgIC8vIHByb3Blcmx5IGhhbmRsZSBpZiB0aGUgbWV0YS9jdHJsIGtleSBpcyBwcmVzc2VkXHJcbiAgICAgICAgICBjb25zdCBtb2QgPSBPYnNpZGlhbi5LZXltYXAuaXNNb2RFdmVudChldmVudCk7XHJcbiAgICAgICAgICAvLyBnZXQgbW9zdCByZWNlbnQgbGVhZlxyXG4gICAgICAgICAgbGV0IGxlYWYgPSB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0TGVhZihtb2QpO1xyXG4gICAgICAgICAgbGVhZi5vcGVuRmlsZShsaW5rX3RmaWxlKTtcclxuICAgICAgICB9KTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgbmV3X21lc3NzYWdlX2J1YmJsZShmcm9tKSB7XHJcbiAgICBsZXQgbWVzc2FnZV9lbCA9IHRoaXMubWVzc2FnZV9jb250YWluZXIuY3JlYXRlRGl2KGBzYy1tZXNzYWdlICR7ZnJvbX1gKTtcclxuICAgIC8vIGNyZWF0ZSBtZXNzYWdlIGNvbnRlbnRcclxuICAgIHRoaXMuYWN0aXZlX2VsbSA9IG1lc3NhZ2VfZWwuY3JlYXRlRGl2KFwic2MtbWVzc2FnZS1jb250ZW50XCIpO1xyXG4gICAgLy8gc2V0IGxhc3QgZnJvbVxyXG4gICAgdGhpcy5sYXN0X2Zyb20gPSBmcm9tO1xyXG4gIH1cclxuXHJcbiAgYXN5bmMgcmVxdWVzdF9jaGF0Z3B0X2NvbXBsZXRpb24ob3B0cz17fSkge1xyXG4gICAgY29uc3QgY2hhdF9tbCA9IG9wdHMubWVzc2FnZXMgfHwgb3B0cy5jaGF0X21sIHx8IHRoaXMuY2hhdC5wcmVwYXJlX2NoYXRfbWwoKTtcclxuICAgIGNvbnNvbGUubG9nKFwiY2hhdF9tbFwiLCBjaGF0X21sKTtcclxuICAgIGNvbnN0IG1heF90b3RhbF90b2tlbnMgPSBNYXRoLnJvdW5kKGdldF9tYXhfY2hhcnModGhpcy5wbHVnaW4uc2V0dGluZ3Muc21hcnRfY2hhdF9tb2RlbCkgLyA0KTtcclxuICAgIGNvbnNvbGUubG9nKFwibWF4X3RvdGFsX3Rva2Vuc1wiLCBtYXhfdG90YWxfdG9rZW5zKTtcclxuICAgIGNvbnN0IGN1cnJfdG9rZW5fZXN0ID0gTWF0aC5yb3VuZChKU09OLnN0cmluZ2lmeShjaGF0X21sKS5sZW5ndGggLyAzKTtcclxuICAgIGNvbnNvbGUubG9nKFwiY3Vycl90b2tlbl9lc3RcIiwgY3Vycl90b2tlbl9lc3QpO1xyXG4gICAgbGV0IG1heF9hdmFpbGFibGVfdG9rZW5zID0gbWF4X3RvdGFsX3Rva2VucyAtIGN1cnJfdG9rZW5fZXN0O1xyXG4gICAgLy8gaWYgbWF4X2F2YWlsYWJsZV90b2tlbnMgaXMgbGVzcyB0aGFuIDAsIHNldCB0byAyMDBcclxuICAgIGlmKG1heF9hdmFpbGFibGVfdG9rZW5zIDwgMCkgbWF4X2F2YWlsYWJsZV90b2tlbnMgPSAyMDA7XHJcbiAgICBlbHNlIGlmKG1heF9hdmFpbGFibGVfdG9rZW5zID4gNDA5NikgbWF4X2F2YWlsYWJsZV90b2tlbnMgPSA0MDk2O1xyXG4gICAgY29uc29sZS5sb2coXCJtYXhfYXZhaWxhYmxlX3Rva2Vuc1wiLCBtYXhfYXZhaWxhYmxlX3Rva2Vucyk7XHJcbiAgICBvcHRzID0ge1xyXG4gICAgICBtb2RlbDogdGhpcy5wbHVnaW4uc2V0dGluZ3Muc21hcnRfY2hhdF9tb2RlbCxcclxuICAgICAgbWVzc2FnZXM6IGNoYXRfbWwsXHJcbiAgICAgIC8vIG1heF90b2tlbnM6IDI1MCxcclxuICAgICAgbWF4X3Rva2VuczogbWF4X2F2YWlsYWJsZV90b2tlbnMsXHJcbiAgICAgIHRlbXBlcmF0dXJlOiAwLjMsXHJcbiAgICAgIHRvcF9wOiAxLFxyXG4gICAgICBwcmVzZW5jZV9wZW5hbHR5OiAwLFxyXG4gICAgICBmcmVxdWVuY3lfcGVuYWx0eTogMCxcclxuICAgICAgc3RyZWFtOiB0cnVlLFxyXG4gICAgICBzdG9wOiBudWxsLFxyXG4gICAgICBuOiAxLFxyXG4gICAgICAvLyBsb2dpdF9iaWFzOiBsb2dpdF9iaWFzLFxyXG4gICAgICAuLi5vcHRzXHJcbiAgICB9XHJcbiAgICAvLyBjb25zb2xlLmxvZyhvcHRzLm1lc3NhZ2VzKTtcclxuICAgIGlmKG9wdHMuc3RyZWFtKSB7XHJcbiAgICAgIGNvbnN0IGZ1bGxfc3RyID0gYXdhaXQgbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAvLyBjb25zb2xlLmxvZyhcInN0cmVhbVwiLCBvcHRzKTtcclxuICAgICAgICAgIGNvbnN0IHVybCA9IFwiaHR0cHM6Ly9hcGkub3BlbmFpLmNvbS92MS9jaGF0L2NvbXBsZXRpb25zXCI7XHJcbiAgICAgICAgICB0aGlzLmFjdGl2ZV9zdHJlYW0gPSBuZXcgU2NTdHJlYW1lcih1cmwsIHtcclxuICAgICAgICAgICAgaGVhZGVyczoge1xyXG4gICAgICAgICAgICAgIFwiQ29udGVudC1UeXBlXCI6IFwiYXBwbGljYXRpb24vanNvblwiLFxyXG4gICAgICAgICAgICAgIEF1dGhvcml6YXRpb246IGBCZWFyZXIgJHt0aGlzLnBsdWdpbi5zZXR0aW5ncy5hcGlfa2V5fWBcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgbWV0aG9kOiBcIlBPU1RcIixcclxuICAgICAgICAgICAgcGF5bG9hZDogSlNPTi5zdHJpbmdpZnkob3B0cylcclxuICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgbGV0IHR4dCA9IFwiXCI7XHJcbiAgICAgICAgICB0aGlzLmFjdGl2ZV9zdHJlYW0uYWRkRXZlbnRMaXN0ZW5lcihcIm1lc3NhZ2VcIiwgKGUpID0+IHtcclxuICAgICAgICAgICAgaWYgKGUuZGF0YSAhPSBcIltET05FXVwiKSB7XHJcbiAgICAgICAgICAgICAgY29uc3QgcGF5bG9hZCA9IEpTT04ucGFyc2UoZS5kYXRhKTtcclxuICAgICAgICAgICAgICBjb25zdCB0ZXh0ID0gcGF5bG9hZC5jaG9pY2VzWzBdLmRlbHRhLmNvbnRlbnQ7XHJcbiAgICAgICAgICAgICAgaWYgKCF0ZXh0KSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgIHR4dCArPSB0ZXh0O1xyXG4gICAgICAgICAgICAgIHRoaXMucmVuZGVyX21lc3NhZ2UodGV4dCwgXCJhc3Npc3RhbnRcIiwgdHJ1ZSk7XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgdGhpcy5lbmRfc3RyZWFtKCk7XHJcbiAgICAgICAgICAgICAgcmVzb2x2ZSh0eHQpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICB9KTtcclxuICAgICAgICAgIHRoaXMuYWN0aXZlX3N0cmVhbS5hZGRFdmVudExpc3RlbmVyKFwicmVhZHlzdGF0ZWNoYW5nZVwiLCAoZSkgPT4ge1xyXG4gICAgICAgICAgICBpZiAoZS5yZWFkeVN0YXRlID49IDIpIHtcclxuICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcIlJlYWR5U3RhdGU6IFwiICsgZS5yZWFkeVN0YXRlKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgfSk7XHJcbiAgICAgICAgICB0aGlzLmFjdGl2ZV9zdHJlYW0uYWRkRXZlbnRMaXN0ZW5lcihcImVycm9yXCIsIChlKSA9PiB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoZSk7XHJcbiAgICAgICAgICAgIG5ldyBPYnNpZGlhbi5Ob3RpY2UoXCJTbWFydCBDb25uZWN0aW9ucyBFcnJvciBTdHJlYW1pbmcgUmVzcG9uc2UuIFNlZSBjb25zb2xlIGZvciBkZXRhaWxzLlwiKTtcclxuICAgICAgICAgICAgdGhpcy5yZW5kZXJfbWVzc2FnZShcIipBUEkgRXJyb3IuIFNlZSBjb25zb2xlIGxvZ3MgZm9yIGRldGFpbHMuKlwiLCBcImFzc2lzdGFudFwiKTtcclxuICAgICAgICAgICAgdGhpcy5lbmRfc3RyZWFtKCk7XHJcbiAgICAgICAgICAgIHJlamVjdChlKTtcclxuICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgdGhpcy5hY3RpdmVfc3RyZWFtLnN0cmVhbSgpO1xyXG4gICAgICAgIH0gY2F0Y2ggKGVycikge1xyXG4gICAgICAgICAgY29uc29sZS5lcnJvcihlcnIpO1xyXG4gICAgICAgICAgbmV3IE9ic2lkaWFuLk5vdGljZShcIlNtYXJ0IENvbm5lY3Rpb25zIEVycm9yIFN0cmVhbWluZyBSZXNwb25zZS4gU2VlIGNvbnNvbGUgZm9yIGRldGFpbHMuXCIpO1xyXG4gICAgICAgICAgdGhpcy5lbmRfc3RyZWFtKCk7XHJcbiAgICAgICAgICByZWplY3QoZXJyKTtcclxuICAgICAgICB9XHJcbiAgICAgIH0pO1xyXG4gICAgICAvLyBjb25zb2xlLmxvZyhmdWxsX3N0cik7XHJcbiAgICAgIGF3YWl0IHRoaXMucmVuZGVyX21lc3NhZ2UoZnVsbF9zdHIsIFwiYXNzaXN0YW50XCIpO1xyXG4gICAgICB0aGlzLmNoYXQubmV3X21lc3NhZ2VfaW5fdGhyZWFkKHtcclxuICAgICAgICByb2xlOiBcImFzc2lzdGFudFwiLFxyXG4gICAgICAgIGNvbnRlbnQ6IGZ1bGxfc3RyXHJcbiAgICAgIH0pO1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9ZWxzZXtcclxuICAgICAgdHJ5e1xyXG4gICAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgKDAsIE9ic2lkaWFuLnJlcXVlc3RVcmwpKHtcclxuICAgICAgICAgIHVybDogYGh0dHBzOi8vYXBpLm9wZW5haS5jb20vdjEvY2hhdC9jb21wbGV0aW9uc2AsXHJcbiAgICAgICAgICBtZXRob2Q6IFwiUE9TVFwiLFxyXG4gICAgICAgICAgaGVhZGVyczoge1xyXG4gICAgICAgICAgICBBdXRob3JpemF0aW9uOiBgQmVhcmVyICR7dGhpcy5wbHVnaW4uc2V0dGluZ3MuYXBpX2tleX1gLFxyXG4gICAgICAgICAgICBcIkNvbnRlbnQtVHlwZVwiOiBcImFwcGxpY2F0aW9uL2pzb25cIlxyXG4gICAgICAgICAgfSxcclxuICAgICAgICAgIGNvbnRlbnRUeXBlOiBcImFwcGxpY2F0aW9uL2pzb25cIixcclxuICAgICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KG9wdHMpLFxyXG4gICAgICAgICAgdGhyb3c6IGZhbHNlXHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgLy8gY29uc29sZS5sb2cocmVzcG9uc2UpO1xyXG4gICAgICAgIHJldHVybiBKU09OLnBhcnNlKHJlc3BvbnNlLnRleHQpLmNob2ljZXNbMF0ubWVzc2FnZS5jb250ZW50O1xyXG4gICAgICB9Y2F0Y2goZXJyKXtcclxuICAgICAgICBuZXcgT2JzaWRpYW4uTm90aWNlKGBTbWFydCBDb25uZWN0aW9ucyBBUEkgRXJyb3IgOjogJHtlcnJ9YCk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICB9XHJcblxyXG4gIGVuZF9zdHJlYW0oKSB7XHJcbiAgICBpZih0aGlzLmFjdGl2ZV9zdHJlYW0pe1xyXG4gICAgICB0aGlzLmFjdGl2ZV9zdHJlYW0uY2xvc2UoKTtcclxuICAgICAgdGhpcy5hY3RpdmVfc3RyZWFtID0gbnVsbDtcclxuICAgIH1cclxuICAgIHRoaXMudW5zZXRfc3RyZWFtaW5nX3V4KCk7XHJcbiAgICBpZih0aGlzLmRvdGRvdGRvdF9pbnRlcnZhbCl7XHJcbiAgICAgIGNsZWFySW50ZXJ2YWwodGhpcy5kb3Rkb3Rkb3RfaW50ZXJ2YWwpO1xyXG4gICAgICB0aGlzLmRvdGRvdGRvdF9pbnRlcnZhbCA9IG51bGw7XHJcbiAgICAgIC8vIHJlbW92ZSBwYXJlbnQgb2YgYWN0aXZlX2VsbVxyXG4gICAgICB0aGlzLmFjdGl2ZV9lbG0ucGFyZW50RWxlbWVudC5yZW1vdmUoKTtcclxuICAgICAgdGhpcy5hY3RpdmVfZWxtID0gbnVsbDtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIGFzeW5jIGdldF9jb250ZXh0X2h5ZGUodXNlcl9pbnB1dCkge1xyXG4gICAgdGhpcy5jaGF0LnJlc2V0X2NvbnRleHQoKTtcclxuICAgIC8vIGNvdW50IGN1cnJlbnQgY2hhdCBtbCBtZXNzYWdlcyB0byBkZXRlcm1pbmUgJ3F1ZXN0aW9uJyBvciAnY2hhdCBsb2cnIHdvcmRpbmdcclxuICAgIGNvbnN0IGh5ZF9pbnB1dCA9IGBBbnRpY2lwYXRlIHdoYXQgdGhlIHVzZXIgaXMgc2Vla2luZy4gUmVzcG9uZCBpbiB0aGUgZm9ybSBvZiBhIGh5cG90aGV0aWNhbCBub3RlIHdyaXR0ZW4gYnkgdGhlIHVzZXIuIFRoZSBub3RlIG1heSBjb250YWluIHN0YXRlbWVudHMgYXMgcGFyYWdyYXBocywgbGlzdHMsIG9yIGNoZWNrbGlzdHMgaW4gbWFya2Rvd24gZm9ybWF0IHdpdGggbm8gaGVhZGluZ3MuIFBsZWFzZSByZXNwb25kIHdpdGggb25lIGh5cG90aGV0aWNhbCBub3RlIGFuZCBhYnN0YWluIGZyb20gYW55IG90aGVyIGNvbW1lbnRhcnkuIFVzZSB0aGUgZm9ybWF0OiBQQVJFTlQgRk9MREVSIE5BTUUgPiBDSElMRCBGT0xERVIgTkFNRSA+IEZJTEUgTkFNRSA+IEhFQURJTkcgMSA+IEhFQURJTkcgMiA+IEhFQURJTkcgMzogSFlQT1RIRVRJQ0FMIE5PVEUgQ09OVEVOVFMuYDtcclxuICAgIC8vIGNvbXBsZXRlXHJcbiAgICBjb25zdCBjaGF0bWwgPSBbXHJcbiAgICAgIHtcclxuICAgICAgICByb2xlOiBcInN5c3RlbVwiLFxyXG4gICAgICAgIGNvbnRlbnQ6IGh5ZF9pbnB1dFxyXG4gICAgICB9LFxyXG4gICAgICB7XHJcbiAgICAgICAgcm9sZTogXCJ1c2VyXCIsXHJcbiAgICAgICAgY29udGVudDogdXNlcl9pbnB1dFxyXG4gICAgICB9XHJcbiAgICBdO1xyXG4gICAgY29uc3QgaHlkID0gYXdhaXQgdGhpcy5yZXF1ZXN0X2NoYXRncHRfY29tcGxldGlvbih7XHJcbiAgICAgIG1lc3NhZ2VzOiBjaGF0bWwsXHJcbiAgICAgIHN0cmVhbTogZmFsc2UsXHJcbiAgICAgIHRlbXBlcmF0dXJlOiAwLFxyXG4gICAgICBtYXhfdG9rZW5zOiAxMzcsXHJcbiAgICB9KTtcclxuICAgIHRoaXMuY2hhdC5oeWQgPSBoeWQ7XHJcbiAgICAvLyBjb25zb2xlLmxvZyhoeWQpO1xyXG4gICAgbGV0IGZpbHRlciA9IHt9O1xyXG4gICAgLy8gaWYgY29udGFpbnMgZm9sZGVyIHJlZmVyZW5jZSByZXByZXNlbnRlZCBieSAvZm9sZGVyL1xyXG4gICAgaWYodGhpcy5jaGF0LmNvbnRhaW5zX2ZvbGRlcl9yZWZlcmVuY2UodXNlcl9pbnB1dCkpIHtcclxuICAgICAgLy8gZ2V0IGZvbGRlciByZWZlcmVuY2VzXHJcbiAgICAgIGNvbnN0IGZvbGRlcl9yZWZzID0gdGhpcy5jaGF0LmdldF9mb2xkZXJfcmVmZXJlbmNlcyh1c2VyX2lucHV0KTtcclxuICAgICAgLy8gY29uc29sZS5sb2coZm9sZGVyX3JlZnMpO1xyXG4gICAgICAvLyBpZiBmb2xkZXIgcmVmZXJlbmNlcyBhcmUgdmFsaWQgKHN0cmluZyBvciBhcnJheSBvZiBzdHJpbmdzKVxyXG4gICAgICBpZihmb2xkZXJfcmVmcyl7XHJcbiAgICAgICAgZmlsdGVyID0ge1xyXG4gICAgICAgICAgcGF0aF9iZWdpbnNfd2l0aDogZm9sZGVyX3JlZnNcclxuICAgICAgICB9O1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgICAvLyBzZWFyY2ggZm9yIG5lYXJlc3QgYmFzZWQgb24gaHlkXHJcbiAgICBsZXQgbmVhcmVzdCA9IGF3YWl0IHRoaXMucGx1Z2luLmFwaS5zZWFyY2goaHlkLCBmaWx0ZXIpO1xyXG4gICAgY29uc29sZS5sb2coXCJuZWFyZXN0XCIsIG5lYXJlc3QubGVuZ3RoKTtcclxuICAgIG5lYXJlc3QgPSB0aGlzLmdldF9uZWFyZXN0X3VudGlsX25leHRfZGV2X2V4Y2VlZHNfc3RkX2RldihuZWFyZXN0KTtcclxuICAgIGNvbnNvbGUubG9nKFwibmVhcmVzdCBhZnRlciBzdGQgZGV2IHNsaWNlXCIsIG5lYXJlc3QubGVuZ3RoKTtcclxuICAgIG5lYXJlc3QgPSB0aGlzLnNvcnRfYnlfbGVuX2FkanVzdGVkX3NpbWlsYXJpdHkobmVhcmVzdCk7XHJcblxyXG4gICAgcmV0dXJuIGF3YWl0IHRoaXMuZ2V0X2NvbnRleHRfZm9yX3Byb21wdChuZWFyZXN0KTtcclxuICB9XHJcblxyXG5cclxuICBzb3J0X2J5X2xlbl9hZGp1c3RlZF9zaW1pbGFyaXR5KG5lYXJlc3QpIHtcclxuICAgIC8vIHJlLXNvcnQgYnkgcXVvdGllbnQgb2Ygc2ltaWxhcml0eSBkaXZpZGVkIGJ5IGxlbiBERVNDXHJcbiAgICBuZWFyZXN0ID0gbmVhcmVzdC5zb3J0KChhLCBiKSA9PiB7XHJcbiAgICAgIGNvbnN0IGFfc2NvcmUgPSBhLnNpbWlsYXJpdHkgLyBhLmxlbjtcclxuICAgICAgY29uc3QgYl9zY29yZSA9IGIuc2ltaWxhcml0eSAvIGIubGVuO1xyXG4gICAgICAvLyBpZiBhIGlzIGdyZWF0ZXIgdGhhbiBiLCByZXR1cm4gLTFcclxuICAgICAgaWYgKGFfc2NvcmUgPiBiX3Njb3JlKVxyXG4gICAgICAgIHJldHVybiAtMTtcclxuICAgICAgLy8gaWYgYSBpcyBsZXNzIHRoYW4gYiwgcmV0dXJuIDFcclxuICAgICAgaWYgKGFfc2NvcmUgPCBiX3Njb3JlKVxyXG4gICAgICAgIHJldHVybiAxO1xyXG4gICAgICAvLyBpZiBhIGlzIGVxdWFsIHRvIGIsIHJldHVybiAwXHJcbiAgICAgIHJldHVybiAwO1xyXG4gICAgfSk7XHJcbiAgICByZXR1cm4gbmVhcmVzdDtcclxuICB9XHJcblxyXG4gIGdldF9uZWFyZXN0X3VudGlsX25leHRfZGV2X2V4Y2VlZHNfc3RkX2RldihuZWFyZXN0KSB7XHJcbiAgICAvLyBnZXQgc3RkIGRldiBvZiBzaW1pbGFyaXR5XHJcbiAgICBjb25zdCBzaW0gPSBuZWFyZXN0Lm1hcCgobikgPT4gbi5zaW1pbGFyaXR5KTtcclxuICAgIGNvbnN0IG1lYW4gPSBzaW0ucmVkdWNlKChhLCBiKSA9PiBhICsgYikgLyBzaW0ubGVuZ3RoO1xyXG4gICAgbGV0IHN0ZF9kZXYgPSBNYXRoLnNxcnQoc2ltLm1hcCgoeCkgPT4gTWF0aC5wb3coeCAtIG1lYW4sIDIpKS5yZWR1Y2UoKGEsIGIpID0+IGEgKyBiKSAvIHNpbS5sZW5ndGgpO1xyXG4gICAgLy8gc2xpY2Ugd2hlcmUgbmV4dCBpdGVtIGRldmlhdGlvbiBpcyBncmVhdGVyIHRoYW4gc3RkX2RldlxyXG4gICAgbGV0IHNsaWNlX2kgPSAwO1xyXG4gICAgd2hpbGUgKHNsaWNlX2kgPCBuZWFyZXN0Lmxlbmd0aCkge1xyXG4gICAgICBjb25zdCBuZXh0ID0gbmVhcmVzdFtzbGljZV9pICsgMV07XHJcbiAgICAgIGlmIChuZXh0KSB7XHJcbiAgICAgICAgY29uc3QgbmV4dF9kZXYgPSBNYXRoLmFicyhuZXh0LnNpbWlsYXJpdHkgLSBuZWFyZXN0W3NsaWNlX2ldLnNpbWlsYXJpdHkpO1xyXG4gICAgICAgIGlmIChuZXh0X2RldiA+IHN0ZF9kZXYpIHtcclxuICAgICAgICAgIGlmKHNsaWNlX2kgPCAzKSBzdGRfZGV2ID0gc3RkX2RldiAqIDEuNTtcclxuICAgICAgICAgIGVsc2UgYnJlYWs7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICAgIHNsaWNlX2krKztcclxuICAgIH1cclxuICAgIC8vIHNlbGVjdCB0b3AgcmVzdWx0c1xyXG4gICAgbmVhcmVzdCA9IG5lYXJlc3Quc2xpY2UoMCwgc2xpY2VfaSsxKTtcclxuICAgIHJldHVybiBuZWFyZXN0O1xyXG4gIH1cclxuICAvLyB0aGlzLnRlc3RfZ2V0X25lYXJlc3RfdW50aWxfbmV4dF9kZXZfZXhjZWVkc19zdGRfZGV2KCk7XHJcbiAgLy8gLy8gdGVzdCBnZXRfbmVhcmVzdF91bnRpbF9uZXh0X2Rldl9leGNlZWRzX3N0ZF9kZXZcclxuICAvLyB0ZXN0X2dldF9uZWFyZXN0X3VudGlsX25leHRfZGV2X2V4Y2VlZHNfc3RkX2RldigpIHtcclxuICAvLyAgIGNvbnN0IG5lYXJlc3QgPSBbe3NpbWlsYXJpdHk6IDAuOTl9LCB7c2ltaWxhcml0eTogMC45OH0sIHtzaW1pbGFyaXR5OiAwLjk3fSwge3NpbWlsYXJpdHk6IDAuOTZ9LCB7c2ltaWxhcml0eTogMC45NX0sIHtzaW1pbGFyaXR5OiAwLjk0fSwge3NpbWlsYXJpdHk6IDAuOTN9LCB7c2ltaWxhcml0eTogMC45Mn0sIHtzaW1pbGFyaXR5OiAwLjkxfSwge3NpbWlsYXJpdHk6IDAuOX0sIHtzaW1pbGFyaXR5OiAwLjc5fSwge3NpbWlsYXJpdHk6IDAuNzh9LCB7c2ltaWxhcml0eTogMC43N30sIHtzaW1pbGFyaXR5OiAwLjc2fSwge3NpbWlsYXJpdHk6IDAuNzV9LCB7c2ltaWxhcml0eTogMC43NH0sIHtzaW1pbGFyaXR5OiAwLjczfSwge3NpbWlsYXJpdHk6IDAuNzJ9XTtcclxuICAvLyAgIGNvbnN0IHJlc3VsdCA9IHRoaXMuZ2V0X25lYXJlc3RfdW50aWxfbmV4dF9kZXZfZXhjZWVkc19zdGRfZGV2KG5lYXJlc3QpO1xyXG4gIC8vICAgaWYocmVzdWx0Lmxlbmd0aCAhPT0gMTApe1xyXG4gIC8vICAgICBjb25zb2xlLmVycm9yKFwiZ2V0X25lYXJlc3RfdW50aWxfbmV4dF9kZXZfZXhjZWVkc19zdGRfZGV2IGZhaWxlZFwiLCByZXN1bHQpO1xyXG4gIC8vICAgfVxyXG4gIC8vIH1cclxuXHJcbiAgYXN5bmMgZ2V0X2NvbnRleHRfZm9yX3Byb21wdChuZWFyZXN0KSB7XHJcbiAgICBsZXQgY29udGV4dCA9IFtdO1xyXG4gICAgY29uc3QgTUFYX1NPVVJDRVMgPSAodGhpcy5wbHVnaW4uc2V0dGluZ3Muc21hcnRfY2hhdF9tb2RlbCA9PT0gJ2dwdC00LTExMDYtcHJldmlldycpID8gNDIgOiAyMDtcclxuICAgIGNvbnN0IE1BWF9DSEFSUyA9IGdldF9tYXhfY2hhcnModGhpcy5wbHVnaW4uc2V0dGluZ3Muc21hcnRfY2hhdF9tb2RlbCkgLyAyO1xyXG4gICAgbGV0IGNoYXJfYWNjdW0gPSAwO1xyXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBuZWFyZXN0Lmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgIGlmIChjb250ZXh0Lmxlbmd0aCA+PSBNQVhfU09VUkNFUylcclxuICAgICAgICBicmVhaztcclxuICAgICAgaWYgKGNoYXJfYWNjdW0gPj0gTUFYX0NIQVJTKVxyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICBpZiAodHlwZW9mIG5lYXJlc3RbaV0ubGluayAhPT0gJ3N0cmluZycpXHJcbiAgICAgICAgY29udGludWU7XHJcbiAgICAgIC8vIGdlbmVyYXRlIGJyZWFkY3J1bWJzXHJcbiAgICAgIGNvbnN0IGJyZWFkY3J1bWJzID0gbmVhcmVzdFtpXS5saW5rLnJlcGxhY2UoLyMvZywgXCIgPiBcIikucmVwbGFjZShcIi5tZFwiLCBcIlwiKS5yZXBsYWNlKC9cXC8vZywgXCIgPiBcIik7XHJcbiAgICAgIGxldCBuZXdfY29udGV4dCA9IGAke2JyZWFkY3J1bWJzfTpcXG5gO1xyXG4gICAgICAvLyBnZXQgbWF4IGF2YWlsYWJsZSBjaGFycyB0byBhZGQgdG8gY29udGV4dFxyXG4gICAgICBjb25zdCBtYXhfYXZhaWxhYmxlX2NoYXJzID0gTUFYX0NIQVJTIC0gY2hhcl9hY2N1bSAtIG5ld19jb250ZXh0Lmxlbmd0aDtcclxuICAgICAgaWYgKG5lYXJlc3RbaV0ubGluay5pbmRleE9mKFwiI1wiKSAhPT0gLTEpIHsgLy8gaXMgYmxvY2tcclxuICAgICAgICBuZXdfY29udGV4dCArPSBhd2FpdCB0aGlzLnBsdWdpbi5ibG9ja19yZXRyaWV2ZXIobmVhcmVzdFtpXS5saW5rLCB7IG1heF9jaGFyczogbWF4X2F2YWlsYWJsZV9jaGFycyB9KTtcclxuICAgICAgfSBlbHNlIHsgLy8gaXMgZmlsZVxyXG4gICAgICAgIG5ld19jb250ZXh0ICs9IGF3YWl0IHRoaXMucGx1Z2luLmZpbGVfcmV0cmlldmVyKG5lYXJlc3RbaV0ubGluaywgeyBtYXhfY2hhcnM6IG1heF9hdmFpbGFibGVfY2hhcnMgfSk7XHJcbiAgICAgIH1cclxuICAgICAgLy8gYWRkIHRvIGNoYXJfYWNjdW1cclxuICAgICAgY2hhcl9hY2N1bSArPSBuZXdfY29udGV4dC5sZW5ndGg7XHJcbiAgICAgIC8vIGFkZCB0byBjb250ZXh0XHJcbiAgICAgIGNvbnRleHQucHVzaCh7XHJcbiAgICAgICAgbGluazogbmVhcmVzdFtpXS5saW5rLFxyXG4gICAgICAgIHRleHQ6IG5ld19jb250ZXh0XHJcbiAgICAgIH0pO1xyXG4gICAgfVxyXG4gICAgLy8gY29udGV4dCBzb3VyY2VzXHJcbiAgICBjb25zb2xlLmxvZyhcImNvbnRleHQgc291cmNlczogXCIgKyBjb250ZXh0Lmxlbmd0aCk7XHJcbiAgICAvLyBjaGFyX2FjY3VtIGRpdmlkZWQgYnkgNCBhbmQgcm91bmRlZCB0byBuZWFyZXN0IGludGVnZXIgZm9yIGVzdGltYXRlZCB0b2tlbnNcclxuICAgIGNvbnNvbGUubG9nKFwidG90YWwgY29udGV4dCB0b2tlbnM6IH5cIiArIE1hdGgucm91bmQoY2hhcl9hY2N1bSAvIDMuNSkpO1xyXG4gICAgLy8gYnVpbGQgY29udGV4dCBpbnB1dFxyXG4gICAgdGhpcy5jaGF0LmNvbnRleHQgPSBgQW50aWNpcGF0ZSB0aGUgdHlwZSBvZiBhbnN3ZXIgZGVzaXJlZCBieSB0aGUgdXNlci4gSW1hZ2luZSB0aGUgZm9sbG93aW5nICR7Y29udGV4dC5sZW5ndGh9IG5vdGVzIHdlcmUgd3JpdHRlbiBieSB0aGUgdXNlciBhbmQgY29udGFpbiBhbGwgdGhlIG5lY2Vzc2FyeSBpbmZvcm1hdGlvbiB0byBhbnN3ZXIgdGhlIHVzZXIncyBxdWVzdGlvbi4gQmVnaW4gcmVzcG9uc2VzIHdpdGggXCIke1NNQVJUX1RSQU5TTEFUSU9OW3RoaXMucGx1Z2luLnNldHRpbmdzLmxhbmd1YWdlXS5wcm9tcHR9Li4uXCJgO1xyXG4gICAgZm9yKGxldCBpID0gMDsgaSA8IGNvbnRleHQubGVuZ3RoOyBpKyspIHtcclxuICAgICAgdGhpcy5jaGF0LmNvbnRleHQgKz0gYFxcbi0tLUJFR0lOICMke2krMX0tLS1cXG4ke2NvbnRleHRbaV0udGV4dH1cXG4tLS1FTkQgIyR7aSsxfS0tLWA7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gdGhpcy5jaGF0LmNvbnRleHQ7XHJcbiAgfVxyXG5cclxuXHJcbn1cclxuXHJcbmZ1bmN0aW9uIGdldF9tYXhfY2hhcnMobW9kZWw9XCJncHQtMy41LXR1cmJvXCIpIHtcclxuICBjb25zdCBNQVhfQ0hBUl9NQVAgPSB7XHJcbiAgICBcImdwdC0zLjUtdHVyYm8tMTZrXCI6IDQ4MDAwLFxyXG4gICAgXCJncHQtNFwiOiAyNDAwMCxcclxuICAgIFwiZ3B0LTMuNS10dXJib1wiOiAxMjAwMCxcclxuICAgIFwiZ3B0LTQtMTEwNi1wcmV2aWV3XCI6IDIwMDAwMCxcclxuICB9O1xyXG4gIHJldHVybiBNQVhfQ0hBUl9NQVBbbW9kZWxdO1xyXG59XHJcbi8qKlxyXG4gKiBTbWFydENvbm5lY3Rpb25zQ2hhdE1vZGVsXHJcbiAqIC0tLVxyXG4gKiAtICd0aHJlYWQnIGZvcm1hdDogQXJyYXlbQXJyYXlbT2JqZWN0e3JvbGUsIGNvbnRlbnQsIGh5ZGV9XV1cclxuICogIC0gW1R1cm5bdmFyaWF0aW9ue31dLCBUdXJuW3ZhcmlhdGlvbnt9LCB2YXJpYXRpb257fV0sIC4uLl1cclxuICogLSBTYXZlcyBpbiAndGhyZWFkJyBmb3JtYXQgdG8gSlNPTiBmaWxlIGluIC5zbWFydC1jb25uZWN0aW9ucyBmb2xkZXIgdXNpbmcgY2hhdF9pZCBhcyBmaWxlbmFtZVxyXG4gKiAtIExvYWRzIGNoYXQgaW4gJ3RocmVhZCcgZm9ybWF0IEFycmF5W0FycmF5W09iamVjdHtyb2xlLCBjb250ZW50LCBoeWRlfV1dIGZyb20gSlNPTiBmaWxlIGluIC5zbWFydC1jb25uZWN0aW9ucyBmb2xkZXJcclxuICogLSBwcmVwYXJlcyBjaGF0X21sIHJldHVybnMgaW4gJ0NoYXRNTCcgZm9ybWF0XHJcbiAqICAtIHN0cmlwcyBhbGwgYnV0IHJvbGUgYW5kIGNvbnRlbnQgcHJvcGVydGllcyBmcm9tIE9iamVjdCBpbiBDaGF0TUwgZm9ybWF0XHJcbiAqIC0gQ2hhdE1MIEFycmF5W09iamVjdHtyb2xlLCBjb250ZW50fV1cclxuICogIC0gW0N1cnJlbnRfVmFyaWF0aW9uX0Zvcl9UdXJuXzF7fSwgQ3VycmVudF9WYXJpYXRpb25fRm9yX1R1cm5fMnt9LCAuLi5dXHJcbiAqL1xyXG5jbGFzcyBTbWFydENvbm5lY3Rpb25zQ2hhdE1vZGVsIHtcclxuICBjb25zdHJ1Y3RvcihwbHVnaW4pIHtcclxuICAgIHRoaXMuYXBwID0gcGx1Z2luLmFwcDtcclxuICAgIHRoaXMucGx1Z2luID0gcGx1Z2luO1xyXG4gICAgdGhpcy5jaGF0X2lkID0gbnVsbDtcclxuICAgIHRoaXMuY2hhdF9tbCA9IFtdO1xyXG4gICAgdGhpcy5jb250ZXh0ID0gbnVsbDtcclxuICAgIHRoaXMuaHlkID0gbnVsbDtcclxuICAgIHRoaXMudGhyZWFkID0gW107XHJcbiAgfVxyXG4gIGFzeW5jIHNhdmVfY2hhdCgpIHtcclxuICAgIC8vIHJldHVybiBpZiB0aHJlYWQgaXMgZW1wdHlcclxuICAgIGlmICh0aGlzLnRocmVhZC5sZW5ndGggPT09IDApIHJldHVybjtcclxuICAgIC8vIHNhdmUgY2hhdCB0byBmaWxlIGluIC5zbWFydC1jb25uZWN0aW9ucyBmb2xkZXJcclxuICAgIC8vIGNyZWF0ZSAuc21hcnQtY29ubmVjdGlvbnMvY2hhdHMvIGZvbGRlciBpZiBpdCBkb2Vzbid0IGV4aXN0XHJcbiAgICBpZiAoIShhd2FpdCB0aGlzLmFwcC52YXVsdC5hZGFwdGVyLmV4aXN0cyhcIi5zbWFydC1jb25uZWN0aW9ucy9jaGF0c1wiKSkpIHtcclxuICAgICAgYXdhaXQgdGhpcy5hcHAudmF1bHQuYWRhcHRlci5ta2RpcihcIi5zbWFydC1jb25uZWN0aW9ucy9jaGF0c1wiKTtcclxuICAgIH1cclxuICAgIC8vIGlmIGNoYXRfaWQgaXMgbm90IHNldCwgc2V0IGl0IHRvIFVOVElUTEVELSR7dW5peCB0aW1lc3RhbXB9XHJcbiAgICBpZiAoIXRoaXMuY2hhdF9pZCkge1xyXG4gICAgICB0aGlzLmNoYXRfaWQgPSB0aGlzLm5hbWUoKSArIFwiXHUyMDE0XCIgKyB0aGlzLmdldF9maWxlX2RhdGVfc3RyaW5nKCk7XHJcbiAgICB9XHJcbiAgICAvLyB2YWxpZGF0ZSBjaGF0X2lkIGlzIHNldCB0byB2YWxpZCBmaWxlbmFtZSBjaGFyYWN0ZXJzIChsZXR0ZXJzLCBudW1iZXJzLCB1bmRlcnNjb3JlcywgZGFzaGVzLCBlbSBkYXNoLCBhbmQgc3BhY2VzKVxyXG4gICAgaWYgKCF0aGlzLmNoYXRfaWQubWF0Y2goL15bYS16QS1aMC05X1x1MjAxNFxcLSBdKyQvKSkge1xyXG4gICAgICBjb25zb2xlLmxvZyhcIkludmFsaWQgY2hhdF9pZDogXCIgKyB0aGlzLmNoYXRfaWQpO1xyXG4gICAgICBuZXcgT2JzaWRpYW4uTm90aWNlKFwiW1NtYXJ0IENvbm5lY3Rpb25zXSBGYWlsZWQgdG8gc2F2ZSBjaGF0LiBJbnZhbGlkIGNoYXRfaWQ6ICdcIiArIHRoaXMuY2hhdF9pZCArIFwiJ1wiKTtcclxuICAgIH1cclxuICAgIC8vIGZpbGVuYW1lIGlzIGNoYXRfaWRcclxuICAgIGNvbnN0IGNoYXRfZmlsZSA9IHRoaXMuY2hhdF9pZCArIFwiLmpzb25cIjtcclxuICAgIHRoaXMuYXBwLnZhdWx0LmFkYXB0ZXIud3JpdGUoXHJcbiAgICAgIFwiLnNtYXJ0LWNvbm5lY3Rpb25zL2NoYXRzL1wiICsgY2hhdF9maWxlLFxyXG4gICAgICBKU09OLnN0cmluZ2lmeSh0aGlzLnRocmVhZCwgbnVsbCwgMilcclxuICAgICk7XHJcbiAgfVxyXG4gIGFzeW5jIGxvYWRfY2hhdChjaGF0X2lkKSB7XHJcbiAgICB0aGlzLmNoYXRfaWQgPSBjaGF0X2lkO1xyXG4gICAgLy8gbG9hZCBjaGF0IGZyb20gZmlsZSBpbiAuc21hcnQtY29ubmVjdGlvbnMgZm9sZGVyXHJcbiAgICAvLyBmaWxlbmFtZSBpcyBjaGF0X2lkXHJcbiAgICBjb25zdCBjaGF0X2ZpbGUgPSB0aGlzLmNoYXRfaWQgKyBcIi5qc29uXCI7XHJcbiAgICAvLyByZWFkIGZpbGVcclxuICAgIGxldCBjaGF0X2pzb24gPSBhd2FpdCB0aGlzLmFwcC52YXVsdC5hZGFwdGVyLnJlYWQoXHJcbiAgICAgIFwiLnNtYXJ0LWNvbm5lY3Rpb25zL2NoYXRzL1wiICsgY2hhdF9maWxlXHJcbiAgICApO1xyXG4gICAgLy8gcGFyc2UganNvblxyXG4gICAgdGhpcy50aHJlYWQgPSBKU09OLnBhcnNlKGNoYXRfanNvbik7XHJcbiAgICAvLyBsb2FkIGNoYXRfbWxcclxuICAgIHRoaXMuY2hhdF9tbCA9IHRoaXMucHJlcGFyZV9jaGF0X21sKCk7XHJcbiAgICAvLyByZW5kZXIgbWVzc2FnZXMgaW4gY2hhdCB2aWV3XHJcbiAgICAvLyBmb3IgZWFjaCB0dXJuIGluIGNoYXRfbWxcclxuICAgIC8vIGNvbnNvbGUubG9nKHRoaXMudGhyZWFkKTtcclxuICAgIC8vIGNvbnNvbGUubG9nKHRoaXMuY2hhdF9tbCk7XHJcbiAgfVxyXG4gIC8vIHByZXBhcmUgY2hhdF9tbCBmcm9tIGNoYXRcclxuICAvLyBnZXRzIHRoZSBsYXN0IG1lc3NhZ2Ugb2YgZWFjaCB0dXJuIHVubGVzcyB0dXJuX3ZhcmlhdGlvbl9vZmZzZXRzPVtbdHVybl9pbmRleCx2YXJpYXRpb25faW5kZXhdXSBpcyBzcGVjaWZpZWQgaW4gb2Zmc2V0XHJcbiAgcHJlcGFyZV9jaGF0X21sKHR1cm5fdmFyaWF0aW9uX29mZnNldHM9W10pIHtcclxuICAgIC8vIGlmIG5vIHR1cm5fdmFyaWF0aW9uX29mZnNldHMsIGdldCB0aGUgbGFzdCBtZXNzYWdlIG9mIGVhY2ggdHVyblxyXG4gICAgaWYodHVybl92YXJpYXRpb25fb2Zmc2V0cy5sZW5ndGggPT09IDApe1xyXG4gICAgICB0aGlzLmNoYXRfbWwgPSB0aGlzLnRocmVhZC5tYXAodHVybiA9PiB7XHJcbiAgICAgICAgcmV0dXJuIHR1cm5bdHVybi5sZW5ndGggLSAxXTtcclxuICAgICAgfSk7XHJcbiAgICB9ZWxzZXtcclxuICAgICAgLy8gY3JlYXRlIGFuIGFycmF5IGZyb20gdHVybl92YXJpYXRpb25fb2Zmc2V0cyB0aGF0IGluZGV4ZXMgdmFyaWF0aW9uX2luZGV4IGF0IHR1cm5faW5kZXhcclxuICAgICAgLy8gZXguIFtbMyw1XV0gPT4gW3VuZGVmaW5lZCwgdW5kZWZpbmVkLCB1bmRlZmluZWQsIDVdXHJcbiAgICAgIGxldCB0dXJuX3ZhcmlhdGlvbl9pbmRleCA9IFtdO1xyXG4gICAgICBmb3IobGV0IGkgPSAwOyBpIDwgdHVybl92YXJpYXRpb25fb2Zmc2V0cy5sZW5ndGg7IGkrKyl7XHJcbiAgICAgICAgdHVybl92YXJpYXRpb25faW5kZXhbdHVybl92YXJpYXRpb25fb2Zmc2V0c1tpXVswXV0gPSB0dXJuX3ZhcmlhdGlvbl9vZmZzZXRzW2ldWzFdO1xyXG4gICAgICB9XHJcbiAgICAgIC8vIGxvb3AgdGhyb3VnaCBjaGF0XHJcbiAgICAgIHRoaXMuY2hhdF9tbCA9IHRoaXMudGhyZWFkLm1hcCgodHVybiwgdHVybl9pbmRleCkgPT4ge1xyXG4gICAgICAgIC8vIGlmIHRoZXJlIGlzIGFuIGluZGV4IGZvciB0aGlzIHR1cm4sIHJldHVybiB0aGUgdmFyaWF0aW9uIGF0IHRoYXQgaW5kZXhcclxuICAgICAgICBpZih0dXJuX3ZhcmlhdGlvbl9pbmRleFt0dXJuX2luZGV4XSAhPT0gdW5kZWZpbmVkKXtcclxuICAgICAgICAgIHJldHVybiB0dXJuW3R1cm5fdmFyaWF0aW9uX2luZGV4W3R1cm5faW5kZXhdXTtcclxuICAgICAgICB9XHJcbiAgICAgICAgLy8gb3RoZXJ3aXNlIHJldHVybiB0aGUgbGFzdCBtZXNzYWdlIG9mIHRoZSB0dXJuXHJcbiAgICAgICAgcmV0dXJuIHR1cm5bdHVybi5sZW5ndGggLSAxXTtcclxuICAgICAgfSk7XHJcbiAgICB9XHJcbiAgICAvLyBzdHJpcCBhbGwgYnV0IHJvbGUgYW5kIGNvbnRlbnQgcHJvcGVydGllcyBmcm9tIGVhY2ggbWVzc2FnZVxyXG4gICAgdGhpcy5jaGF0X21sID0gdGhpcy5jaGF0X21sLm1hcChtZXNzYWdlID0+IHtcclxuICAgICAgcmV0dXJuIHtcclxuICAgICAgICByb2xlOiBtZXNzYWdlLnJvbGUsXHJcbiAgICAgICAgY29udGVudDogbWVzc2FnZS5jb250ZW50XHJcbiAgICAgIH07XHJcbiAgICB9KTtcclxuICAgIHJldHVybiB0aGlzLmNoYXRfbWw7XHJcbiAgfVxyXG4gIGxhc3QoKSB7XHJcbiAgICAvLyBnZXQgbGFzdCBtZXNzYWdlIGZyb20gY2hhdFxyXG4gICAgcmV0dXJuIHRoaXMudGhyZWFkW3RoaXMudGhyZWFkLmxlbmd0aCAtIDFdW3RoaXMudGhyZWFkW3RoaXMudGhyZWFkLmxlbmd0aCAtIDFdLmxlbmd0aCAtIDFdO1xyXG4gIH1cclxuICBsYXN0X2Zyb20oKSB7XHJcbiAgICByZXR1cm4gdGhpcy5sYXN0KCkucm9sZTtcclxuICB9XHJcbiAgLy8gcmV0dXJucyB1c2VyX2lucHV0IG9yIGNvbXBsZXRpb25cclxuICBsYXN0X21lc3NhZ2UoKSB7XHJcbiAgICByZXR1cm4gdGhpcy5sYXN0KCkuY29udGVudDtcclxuICB9XHJcbiAgLy8gbWVzc2FnZT17fVxyXG4gIC8vIGFkZCBuZXcgbWVzc2FnZSB0byB0aHJlYWRcclxuICBuZXdfbWVzc2FnZV9pbl90aHJlYWQobWVzc2FnZSwgdHVybj0tMSkge1xyXG4gICAgLy8gaWYgdHVybiBpcyAtMSwgYWRkIHRvIG5ldyB0dXJuXHJcbiAgICBpZih0aGlzLmNvbnRleHQpe1xyXG4gICAgICBtZXNzYWdlLmNvbnRleHQgPSB0aGlzLmNvbnRleHQ7XHJcbiAgICAgIHRoaXMuY29udGV4dCA9IG51bGw7XHJcbiAgICB9XHJcbiAgICBpZih0aGlzLmh5ZCl7XHJcbiAgICAgIG1lc3NhZ2UuaHlkID0gdGhpcy5oeWQ7XHJcbiAgICAgIHRoaXMuaHlkID0gbnVsbDtcclxuICAgIH1cclxuICAgIGlmICh0dXJuID09PSAtMSkge1xyXG4gICAgICB0aGlzLnRocmVhZC5wdXNoKFttZXNzYWdlXSk7XHJcbiAgICB9ZWxzZXtcclxuICAgICAgLy8gb3RoZXJ3aXNlIGFkZCB0byBzcGVjaWZpZWQgdHVyblxyXG4gICAgICB0aGlzLnRocmVhZFt0dXJuXS5wdXNoKG1lc3NhZ2UpO1xyXG4gICAgfVxyXG4gIH1cclxuICByZXNldF9jb250ZXh0KCl7XHJcbiAgICB0aGlzLmNvbnRleHQgPSBudWxsO1xyXG4gICAgdGhpcy5oeWQgPSBudWxsO1xyXG4gIH1cclxuICBhc3luYyByZW5hbWVfY2hhdChuZXdfbmFtZSl7XHJcbiAgICAvLyBjaGVjayBpZiBjdXJyZW50IGNoYXRfaWQgZmlsZSBleGlzdHNcclxuICAgIGlmICh0aGlzLmNoYXRfaWQgJiYgYXdhaXQgdGhpcy5hcHAudmF1bHQuYWRhcHRlci5leGlzdHMoXCIuc21hcnQtY29ubmVjdGlvbnMvY2hhdHMvXCIgKyB0aGlzLmNoYXRfaWQgKyBcIi5qc29uXCIpKSB7XHJcbiAgICAgIG5ld19uYW1lID0gdGhpcy5jaGF0X2lkLnJlcGxhY2UodGhpcy5uYW1lKCksIG5ld19uYW1lKTtcclxuICAgICAgLy8gcmVuYW1lIGZpbGUgaWYgaXQgZXhpc3RzXHJcbiAgICAgIGF3YWl0IHRoaXMuYXBwLnZhdWx0LmFkYXB0ZXIucmVuYW1lKFxyXG4gICAgICAgIFwiLnNtYXJ0LWNvbm5lY3Rpb25zL2NoYXRzL1wiICsgdGhpcy5jaGF0X2lkICsgXCIuanNvblwiLFxyXG4gICAgICAgIFwiLnNtYXJ0LWNvbm5lY3Rpb25zL2NoYXRzL1wiICsgbmV3X25hbWUgKyBcIi5qc29uXCJcclxuICAgICAgKTtcclxuICAgICAgLy8gc2V0IGNoYXRfaWQgdG8gbmV3X25hbWVcclxuICAgICAgdGhpcy5jaGF0X2lkID0gbmV3X25hbWU7XHJcbiAgICB9ZWxzZXtcclxuICAgICAgdGhpcy5jaGF0X2lkID0gbmV3X25hbWUgKyBcIlx1MjAxNFwiICsgdGhpcy5nZXRfZmlsZV9kYXRlX3N0cmluZygpO1xyXG4gICAgICAvLyBzYXZlIGNoYXRcclxuICAgICAgYXdhaXQgdGhpcy5zYXZlX2NoYXQoKTtcclxuICAgIH1cclxuXHJcbiAgfVxyXG5cclxuICBuYW1lKCkge1xyXG4gICAgaWYodGhpcy5jaGF0X2lkKXtcclxuICAgICAgLy8gcmVtb3ZlIGRhdGUgYWZ0ZXIgbGFzdCBlbSBkYXNoXHJcbiAgICAgIHJldHVybiB0aGlzLmNoYXRfaWQucmVwbGFjZSgvXHUyMDE0W15cdTIwMTRdKiQvLFwiXCIpO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIFwiVU5USVRMRURcIjtcclxuICB9XHJcblxyXG4gIGdldF9maWxlX2RhdGVfc3RyaW5nKCkge1xyXG4gICAgcmV0dXJuIG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKS5yZXBsYWNlKC8oVHw6fFxcLi4qKS9nLCBcIiBcIikudHJpbSgpO1xyXG4gIH1cclxuICAvLyBnZXQgcmVzcG9uc2UgZnJvbSB3aXRoIG5vdGUgY29udGV4dFxyXG4gIGFzeW5jIGdldF9yZXNwb25zZV93aXRoX25vdGVfY29udGV4dCh1c2VyX2lucHV0LCBjaGF0X3ZpZXcpIHtcclxuICAgIGxldCBzeXN0ZW1faW5wdXQgPSBcIkltYWdpbmUgdGhlIGZvbGxvd2luZyBub3RlcyB3ZXJlIHdyaXR0ZW4gYnkgdGhlIHVzZXIgYW5kIGNvbnRhaW4gdGhlIG5lY2Vzc2FyeSBpbmZvcm1hdGlvbiB0byBzeW50aGVzaXplIGEgdXNlZnVsIGFuc3dlciB0aGUgdXNlcidzIHF1ZXJ5OlxcblwiO1xyXG4gICAgLy8gZXh0cmFjdCBpbnRlcm5hbCBsaW5rc1xyXG4gICAgY29uc3Qgbm90ZXMgPSB0aGlzLmV4dHJhY3RfaW50ZXJuYWxfbGlua3ModXNlcl9pbnB1dCk7XHJcbiAgICAvLyBnZXQgY29udGVudCBvZiBpbnRlcm5hbCBsaW5rcyBhcyBjb250ZXh0XHJcbiAgICBsZXQgbWF4X2NoYXJzID0gZ2V0X21heF9jaGFycyh0aGlzLnBsdWdpbi5zZXR0aW5ncy5zbWFydF9jaGF0X21vZGVsKTtcclxuICAgIGZvcihsZXQgaSA9IDA7IGkgPCBub3Rlcy5sZW5ndGg7IGkrKyl7XHJcbiAgICAgIC8vIG1heCBjaGFycyBmb3IgdGhpcyBub3RlIGlzIG1heF9jaGFycyBkaXZpZGVkIGJ5IG51bWJlciBvZiBub3RlcyBsZWZ0XHJcbiAgICAgIGNvbnN0IHRoaXNfbWF4X2NoYXJzID0gKG5vdGVzLmxlbmd0aCAtIGkgPiAxKSA/IE1hdGguZmxvb3IobWF4X2NoYXJzIC8gKG5vdGVzLmxlbmd0aCAtIGkpKSA6IG1heF9jaGFycztcclxuICAgICAgLy8gY29uc29sZS5sb2coXCJmaWxlIGNvbnRleHQgbWF4IGNoYXJzOiBcIiArIHRoaXNfbWF4X2NoYXJzKTtcclxuICAgICAgY29uc3Qgbm90ZV9jb250ZW50ID0gYXdhaXQgdGhpcy5nZXRfbm90ZV9jb250ZW50cyhub3Rlc1tpXSwge2NoYXJfbGltaXQ6IHRoaXNfbWF4X2NoYXJzfSk7XHJcbiAgICAgIGNvbnNvbGUubG9nKG5vdGVfY29udGVudCk7XHJcbiAgICAgIHN5c3RlbV9pbnB1dCArPSBgLS0tQkVHSU4gTk9URTogW1ske25vdGVzW2ldLmJhc2VuYW1lfV1dLS0tXFxuYFxyXG4gICAgICBzeXN0ZW1faW5wdXQgKz0gbm90ZV9jb250ZW50O1xyXG4gICAgICBzeXN0ZW1faW5wdXQgKz0gYC0tLUVORCBOT1RFLS0tXFxuYFxyXG4gICAgICBtYXhfY2hhcnMgLT0gbm90ZV9jb250ZW50Lmxlbmd0aDtcclxuICAgICAgaWYobWF4X2NoYXJzIDw9IDApIGJyZWFrO1xyXG4gICAgfVxyXG4gICAgdGhpcy5jb250ZXh0ID0gc3lzdGVtX2lucHV0O1xyXG4gICAgY29uc3QgY2hhdG1sID0gW1xyXG4gICAgICB7XHJcbiAgICAgICAgcm9sZTogXCJzeXN0ZW1cIixcclxuICAgICAgICBjb250ZW50OiBzeXN0ZW1faW5wdXRcclxuICAgICAgfSxcclxuICAgICAge1xyXG4gICAgICAgIHJvbGU6IFwidXNlclwiLFxyXG4gICAgICAgIGNvbnRlbnQ6IHVzZXJfaW5wdXRcclxuICAgICAgfVxyXG4gICAgXTtcclxuICAgIGNoYXRfdmlldy5yZXF1ZXN0X2NoYXRncHRfY29tcGxldGlvbih7bWVzc2FnZXM6IGNoYXRtbCwgdGVtcGVyYXR1cmU6IDB9KTtcclxuICB9XHJcbiAgLy8gY2hlY2sgaWYgY29udGFpbnMgaW50ZXJuYWwgbGlua1xyXG4gIGNvbnRhaW5zX2ludGVybmFsX2xpbmsodXNlcl9pbnB1dCkge1xyXG4gICAgaWYodXNlcl9pbnB1dC5pbmRleE9mKFwiW1tcIikgPT09IC0xKSByZXR1cm4gZmFsc2U7XHJcbiAgICBpZih1c2VyX2lucHV0LmluZGV4T2YoXCJdXVwiKSA9PT0gLTEpIHJldHVybiBmYWxzZTtcclxuICAgIHJldHVybiB0cnVlO1xyXG4gIH1cclxuICAvLyBjaGVjayBpZiBjb250YWlucyBmb2xkZXIgcmVmZXJlbmNlIChleC4gL2ZvbGRlci8sIG9yIC9mb2xkZXIvc3ViZm9sZGVyLylcclxuICBjb250YWluc19mb2xkZXJfcmVmZXJlbmNlKHVzZXJfaW5wdXQpIHtcclxuICAgIGlmKHVzZXJfaW5wdXQuaW5kZXhPZihcIi9cIikgPT09IC0xKSByZXR1cm4gZmFsc2U7XHJcbiAgICBpZih1c2VyX2lucHV0LmluZGV4T2YoXCIvXCIpID09PSB1c2VyX2lucHV0Lmxhc3RJbmRleE9mKFwiL1wiKSkgcmV0dXJuIGZhbHNlO1xyXG4gICAgcmV0dXJuIHRydWU7XHJcbiAgfVxyXG4gIC8vIGdldCBmb2xkZXIgcmVmZXJlbmNlcyBmcm9tIHVzZXIgaW5wdXRcclxuICBnZXRfZm9sZGVyX3JlZmVyZW5jZXModXNlcl9pbnB1dCkge1xyXG4gICAgLy8gdXNlIHRoaXMuZm9sZGVycyB0byBleHRyYWN0IGZvbGRlciByZWZlcmVuY2VzIGJ5IGxvbmdlc3QgZmlyc3QgKGV4LiAvZm9sZGVyL3N1YmZvbGRlci8gYmVmb3JlIC9mb2xkZXIvKSB0byBhdm9pZCBtYXRjaGluZyAvZm9sZGVyL3N1YmZvbGRlci8gYXMgL2ZvbGRlci9cclxuICAgIGNvbnN0IGZvbGRlcnMgPSB0aGlzLnBsdWdpbi5mb2xkZXJzLnNsaWNlKCk7IC8vIGNvcHkgZm9sZGVycyBhcnJheVxyXG4gICAgY29uc3QgbWF0Y2hlcyA9IGZvbGRlcnMuc29ydCgoYSwgYikgPT4gYi5sZW5ndGggLSBhLmxlbmd0aCkubWFwKGZvbGRlciA9PiB7XHJcbiAgICAgIC8vIGNoZWNrIGlmIGZvbGRlciBpcyBpbiB1c2VyX2lucHV0XHJcbiAgICAgIGlmKHVzZXJfaW5wdXQuaW5kZXhPZihmb2xkZXIpICE9PSAtMSl7XHJcbiAgICAgICAgLy8gcmVtb3ZlIGZvbGRlciBmcm9tIHVzZXJfaW5wdXQgdG8gcHJldmVudCBtYXRjaGluZyAvZm9sZGVyL3N1YmZvbGRlci8gYXMgL2ZvbGRlci9cclxuICAgICAgICB1c2VyX2lucHV0ID0gdXNlcl9pbnB1dC5yZXBsYWNlKGZvbGRlciwgXCJcIik7XHJcbiAgICAgICAgcmV0dXJuIGZvbGRlcjtcclxuICAgICAgfVxyXG4gICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICB9KS5maWx0ZXIoZm9sZGVyID0+IGZvbGRlcik7XHJcbiAgICBjb25zb2xlLmxvZyhtYXRjaGVzKTtcclxuICAgIC8vIHJldHVybiBhcnJheSBvZiBtYXRjaGVzXHJcbiAgICBpZihtYXRjaGVzKSByZXR1cm4gbWF0Y2hlcztcclxuICAgIHJldHVybiBmYWxzZTtcclxuICB9XHJcblxyXG5cclxuICAvLyBleHRyYWN0IGludGVybmFsIGxpbmtzXHJcbiAgZXh0cmFjdF9pbnRlcm5hbF9saW5rcyh1c2VyX2lucHV0KSB7XHJcbiAgICBjb25zdCBtYXRjaGVzID0gdXNlcl9pbnB1dC5tYXRjaCgvXFxbXFxbKC4qPylcXF1cXF0vZyk7XHJcbiAgICBjb25zb2xlLmxvZyhtYXRjaGVzKTtcclxuICAgIC8vIHJldHVybiBhcnJheSBvZiBURmlsZSBvYmplY3RzXHJcbiAgICBpZihtYXRjaGVzKSByZXR1cm4gbWF0Y2hlcy5tYXAobWF0Y2ggPT4ge1xyXG4gICAgICByZXR1cm4gdGhpcy5hcHAubWV0YWRhdGFDYWNoZS5nZXRGaXJzdExpbmtwYXRoRGVzdChtYXRjaC5yZXBsYWNlKFwiW1tcIiwgXCJcIikucmVwbGFjZShcIl1dXCIsIFwiXCIpLCBcIi9cIik7XHJcbiAgICB9KTtcclxuICAgIHJldHVybiBbXTtcclxuICB9XHJcbiAgLy8gZ2V0IGNvbnRleHQgZnJvbSBpbnRlcm5hbCBsaW5rc1xyXG4gIGFzeW5jIGdldF9ub3RlX2NvbnRlbnRzKG5vdGUsIG9wdHM9e30pIHtcclxuICAgIG9wdHMgPSB7XHJcbiAgICAgIGNoYXJfbGltaXQ6IDEwMDAwLFxyXG4gICAgICAuLi5vcHRzXHJcbiAgICB9XHJcbiAgICAvLyByZXR1cm4gaWYgbm90ZSBpcyBub3QgYSBmaWxlXHJcbiAgICBpZighKG5vdGUgaW5zdGFuY2VvZiBPYnNpZGlhbi5URmlsZSkpIHJldHVybiBcIlwiO1xyXG4gICAgLy8gZ2V0IGZpbGUgY29udGVudFxyXG4gICAgbGV0IGZpbGVfY29udGVudCA9IGF3YWl0IHRoaXMuYXBwLnZhdWx0LmNhY2hlZFJlYWQobm90ZSk7XHJcbiAgICAvL2N1dCBvZmYgZnJvbnQgbWF0dGVyXHJcbiAgICBpZiAodGhpcy5wbHVnaW4uc2V0dGluZ3MuY3V0X29mZl9mcm9udG1hdHRlcikge1xyXG4gICAgICBmaWxlX2NvbnRlbnQgPSBmaWxlX2NvbnRlbnQucmVwbGFjZSgvXFxzKi0tLVtcXHNcXFNdKj8tLS0vLFwiXCIpO1xyXG4gICAgfVxyXG4gICAgLy8gY2hlY2sgaWYgY29udGFpbnMgZGF0YXZpZXcgY29kZSBibG9ja1xyXG4gICAgaWYoZmlsZV9jb250ZW50LmluZGV4T2YoXCJgYGBkYXRhdmlld1wiKSA+IC0xKXtcclxuICAgICAgLy8gaWYgY29udGFpbnMgZGF0YXZpZXcgY29kZSBibG9jayBnZXQgYWxsIGRhdGF2aWV3IGNvZGUgYmxvY2tzXHJcbiAgICAgIGZpbGVfY29udGVudCA9IGF3YWl0IHRoaXMucmVuZGVyX2RhdGF2aWV3X3F1ZXJpZXMoZmlsZV9jb250ZW50LCBub3RlLnBhdGgsIG9wdHMpO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIGZpbGVfY29udGVudC5zdWJzdHJpbmcoMCwgb3B0cy5jaGFyX2xpbWl0KTtcclxuICB9XHJcblxyXG5cclxuICBhc3luYyByZW5kZXJfZGF0YXZpZXdfcXVlcmllcyhmaWxlX2NvbnRlbnQsIG5vdGVfcGF0aCwgb3B0cz17fSkge1xyXG4gICAgb3B0cyA9IHtcclxuICAgICAgY2hhcl9saW1pdDogbnVsbCxcclxuICAgICAgLi4ub3B0c1xyXG4gICAgfTtcclxuICAgIC8vIHVzZSB3aW5kb3cgdG8gZ2V0IGRhdGF2aWV3IGFwaVxyXG4gICAgY29uc3QgZGF0YXZpZXdfYXBpID0gd2luZG93W1wiRGF0YXZpZXdBUElcIl07XHJcbiAgICAvLyBza2lwIGlmIGRhdGF2aWV3IGFwaSBub3QgZm91bmRcclxuICAgIGlmKCFkYXRhdmlld19hcGkpIHJldHVybiBmaWxlX2NvbnRlbnQ7XHJcbiAgICBjb25zdCBkYXRhdmlld19jb2RlX2Jsb2NrcyA9IGZpbGVfY29udGVudC5tYXRjaCgvYGBgZGF0YXZpZXcoLio/KWBgYC9ncyk7XHJcbiAgICAvLyBmb3IgZWFjaCBkYXRhdmlldyBjb2RlIGJsb2NrXHJcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGRhdGF2aWV3X2NvZGVfYmxvY2tzLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgIC8vIGlmIG9wdHMgY2hhcl9saW1pdCBpcyBsZXNzIHRoYW4gaW5kZXhPZiBkYXRhdmlldyBjb2RlIGJsb2NrLCBicmVha1xyXG4gICAgICBpZihvcHRzLmNoYXJfbGltaXQgJiYgb3B0cy5jaGFyX2xpbWl0IDwgZmlsZV9jb250ZW50LmluZGV4T2YoZGF0YXZpZXdfY29kZV9ibG9ja3NbaV0pKSBicmVhaztcclxuICAgICAgLy8gZ2V0IGRhdGF2aWV3IGNvZGUgYmxvY2tcclxuICAgICAgY29uc3QgZGF0YXZpZXdfY29kZV9ibG9jayA9IGRhdGF2aWV3X2NvZGVfYmxvY2tzW2ldO1xyXG4gICAgICAvLyBnZXQgY29udGVudCBvZiBkYXRhdmlldyBjb2RlIGJsb2NrXHJcbiAgICAgIGNvbnN0IGRhdGF2aWV3X2NvZGVfYmxvY2tfY29udGVudCA9IGRhdGF2aWV3X2NvZGVfYmxvY2sucmVwbGFjZShcImBgYGRhdGF2aWV3XCIsIFwiXCIpLnJlcGxhY2UoXCJgYGBcIiwgXCJcIik7XHJcbiAgICAgIC8vIGdldCBkYXRhdmlldyBxdWVyeSByZXN1bHRcclxuICAgICAgY29uc3QgZGF0YXZpZXdfcXVlcnlfcmVzdWx0ID0gYXdhaXQgZGF0YXZpZXdfYXBpLnF1ZXJ5TWFya2Rvd24oZGF0YXZpZXdfY29kZV9ibG9ja19jb250ZW50LCBub3RlX3BhdGgsIG51bGwpO1xyXG4gICAgICAvLyBpZiBxdWVyeSByZXN1bHQgaXMgc3VjY2Vzc2Z1bCwgcmVwbGFjZSBkYXRhdmlldyBjb2RlIGJsb2NrIHdpdGggcXVlcnkgcmVzdWx0XHJcbiAgICAgIGlmIChkYXRhdmlld19xdWVyeV9yZXN1bHQuc3VjY2Vzc2Z1bCkge1xyXG4gICAgICAgIGZpbGVfY29udGVudCA9IGZpbGVfY29udGVudC5yZXBsYWNlKGRhdGF2aWV3X2NvZGVfYmxvY2ssIGRhdGF2aWV3X3F1ZXJ5X3Jlc3VsdC52YWx1ZSk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICAgIHJldHVybiBmaWxlX2NvbnRlbnQ7XHJcbiAgfVxyXG59XHJcblxyXG5jbGFzcyBTbWFydENvbm5lY3Rpb25zQ2hhdEhpc3RvcnlNb2RhbCBleHRlbmRzIE9ic2lkaWFuLkZ1enp5U3VnZ2VzdE1vZGFsIHtcclxuICBjb25zdHJ1Y3RvcihhcHAsIHZpZXcsIGZpbGVzKSB7XHJcbiAgICBzdXBlcihhcHApO1xyXG4gICAgdGhpcy5hcHAgPSBhcHA7XHJcbiAgICB0aGlzLnZpZXcgPSB2aWV3O1xyXG4gICAgdGhpcy5zZXRQbGFjZWhvbGRlcihcIlR5cGUgdGhlIG5hbWUgb2YgYSBjaGF0IHNlc3Npb24uLi5cIik7XHJcbiAgfVxyXG4gIGdldEl0ZW1zKCkge1xyXG4gICAgaWYgKCF0aGlzLnZpZXcuZmlsZXMpIHtcclxuICAgICAgcmV0dXJuIFtdO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIHRoaXMudmlldy5maWxlcztcclxuICB9XHJcbiAgZ2V0SXRlbVRleHQoaXRlbSkge1xyXG4gICAgLy8gaWYgbm90IFVOVElUTEVELCByZW1vdmUgZGF0ZSBhZnRlciBsYXN0IGVtIGRhc2hcclxuICAgIGlmKGl0ZW0uaW5kZXhPZihcIlVOVElUTEVEXCIpID09PSAtMSl7XHJcbiAgICAgIGl0ZW0ucmVwbGFjZSgvXHUyMDE0W15cdTIwMTRdKiQvLFwiXCIpO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIGl0ZW07XHJcbiAgfVxyXG4gIG9uQ2hvb3NlSXRlbShzZXNzaW9uKSB7XHJcbiAgICB0aGlzLnZpZXcub3Blbl9jaGF0KHNlc3Npb24pO1xyXG4gIH1cclxufVxyXG5cclxuLy8gRmlsZSBTZWxlY3QgRnV6enkgU3VnZ2VzdCBNb2RhbFxyXG5jbGFzcyBTbWFydENvbm5lY3Rpb25zRmlsZVNlbGVjdE1vZGFsIGV4dGVuZHMgT2JzaWRpYW4uRnV6enlTdWdnZXN0TW9kYWwge1xyXG4gIGNvbnN0cnVjdG9yKGFwcCwgdmlldykge1xyXG4gICAgc3VwZXIoYXBwKTtcclxuICAgIHRoaXMuYXBwID0gYXBwO1xyXG4gICAgdGhpcy52aWV3ID0gdmlldztcclxuICAgIHRoaXMuc2V0UGxhY2Vob2xkZXIoXCJUeXBlIHRoZSBuYW1lIG9mIGEgZmlsZS4uLlwiKTtcclxuICB9XHJcbiAgZ2V0SXRlbXMoKSB7XHJcbiAgICAvLyBnZXQgYWxsIG1hcmtkb3duIGZpbGVzXHJcbiAgICByZXR1cm4gdGhpcy5hcHAudmF1bHQuZ2V0TWFya2Rvd25GaWxlcygpLnNvcnQoKGEsIGIpID0+IGEuYmFzZW5hbWUubG9jYWxlQ29tcGFyZShiLmJhc2VuYW1lKSk7XHJcbiAgfVxyXG4gIGdldEl0ZW1UZXh0KGl0ZW0pIHtcclxuICAgIHJldHVybiBpdGVtLmJhc2VuYW1lO1xyXG4gIH1cclxuICBvbkNob29zZUl0ZW0oZmlsZSkge1xyXG4gICAgdGhpcy52aWV3Lmluc2VydF9zZWxlY3Rpb24oZmlsZS5iYXNlbmFtZSArIFwiXV0gXCIpO1xyXG4gIH1cclxufVxyXG4vLyBGb2xkZXIgU2VsZWN0IEZ1enp5IFN1Z2dlc3QgTW9kYWxcclxuY2xhc3MgU21hcnRDb25uZWN0aW9uc0ZvbGRlclNlbGVjdE1vZGFsIGV4dGVuZHMgT2JzaWRpYW4uRnV6enlTdWdnZXN0TW9kYWwge1xyXG4gIGNvbnN0cnVjdG9yKGFwcCwgdmlldykge1xyXG4gICAgc3VwZXIoYXBwKTtcclxuICAgIHRoaXMuYXBwID0gYXBwO1xyXG4gICAgdGhpcy52aWV3ID0gdmlldztcclxuICAgIHRoaXMuc2V0UGxhY2Vob2xkZXIoXCJUeXBlIHRoZSBuYW1lIG9mIGEgZm9sZGVyLi4uXCIpO1xyXG4gIH1cclxuICBnZXRJdGVtcygpIHtcclxuICAgIHJldHVybiB0aGlzLnZpZXcucGx1Z2luLmZvbGRlcnM7XHJcbiAgfVxyXG4gIGdldEl0ZW1UZXh0KGl0ZW0pIHtcclxuICAgIHJldHVybiBpdGVtO1xyXG4gIH1cclxuICBvbkNob29zZUl0ZW0oZm9sZGVyKSB7XHJcbiAgICB0aGlzLnZpZXcuaW5zZXJ0X3NlbGVjdGlvbihmb2xkZXIgKyBcIi8gXCIpO1xyXG4gIH1cclxufVxyXG5cclxuXHJcbi8vIEhhbmRsZSBBUEkgcmVzcG9uc2Ugc3RyZWFtaW5nXHJcbmNsYXNzIFNjU3RyZWFtZXIge1xyXG4gIC8vIGNvbnN0cnVjdG9yXHJcbiAgY29uc3RydWN0b3IodXJsLCBvcHRpb25zKSB7XHJcbiAgICAvLyBzZXQgZGVmYXVsdCBvcHRpb25zXHJcbiAgICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcclxuICAgIHRoaXMudXJsID0gdXJsO1xyXG4gICAgdGhpcy5tZXRob2QgPSBvcHRpb25zLm1ldGhvZCB8fCAnR0VUJztcclxuICAgIHRoaXMuaGVhZGVycyA9IG9wdGlvbnMuaGVhZGVycyB8fCB7fTtcclxuICAgIHRoaXMucGF5bG9hZCA9IG9wdGlvbnMucGF5bG9hZCB8fCBudWxsO1xyXG4gICAgdGhpcy53aXRoQ3JlZGVudGlhbHMgPSBvcHRpb25zLndpdGhDcmVkZW50aWFscyB8fCBmYWxzZTtcclxuICAgIHRoaXMubGlzdGVuZXJzID0ge307XHJcbiAgICB0aGlzLnJlYWR5U3RhdGUgPSB0aGlzLkNPTk5FQ1RJTkc7XHJcbiAgICB0aGlzLnByb2dyZXNzID0gMDtcclxuICAgIHRoaXMuY2h1bmsgPSAnJztcclxuICAgIHRoaXMueGhyID0gbnVsbDtcclxuICAgIHRoaXMuRklFTERfU0VQQVJBVE9SID0gJzonO1xyXG4gICAgdGhpcy5JTklUSUFMSVpJTkcgPSAtMTtcclxuICAgIHRoaXMuQ09OTkVDVElORyA9IDA7XHJcbiAgICB0aGlzLk9QRU4gPSAxO1xyXG4gICAgdGhpcy5DTE9TRUQgPSAyO1xyXG4gIH1cclxuICAvLyBhZGRFdmVudExpc3RlbmVyXHJcbiAgYWRkRXZlbnRMaXN0ZW5lcih0eXBlLCBsaXN0ZW5lcikge1xyXG4gICAgLy8gY2hlY2sgaWYgdGhlIHR5cGUgaXMgaW4gdGhlIGxpc3RlbmVyc1xyXG4gICAgaWYgKCF0aGlzLmxpc3RlbmVyc1t0eXBlXSkge1xyXG4gICAgICB0aGlzLmxpc3RlbmVyc1t0eXBlXSA9IFtdO1xyXG4gICAgfVxyXG4gICAgLy8gY2hlY2sgaWYgdGhlIGxpc3RlbmVyIGlzIGFscmVhZHkgaW4gdGhlIGxpc3RlbmVyc1xyXG4gICAgaWYodGhpcy5saXN0ZW5lcnNbdHlwZV0uaW5kZXhPZihsaXN0ZW5lcikgPT09IC0xKSB7XHJcbiAgICAgIHRoaXMubGlzdGVuZXJzW3R5cGVdLnB1c2gobGlzdGVuZXIpO1xyXG4gICAgfVxyXG4gIH1cclxuICAvLyByZW1vdmVFdmVudExpc3RlbmVyXHJcbiAgcmVtb3ZlRXZlbnRMaXN0ZW5lcih0eXBlLCBsaXN0ZW5lcikge1xyXG4gICAgLy8gY2hlY2sgaWYgbGlzdGVuZXIgdHlwZSBpcyB1bmRlZmluZWRcclxuICAgIGlmICghdGhpcy5saXN0ZW5lcnNbdHlwZV0pIHtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG4gICAgbGV0IGZpbHRlcmVkID0gW107XHJcbiAgICAvLyBsb29wIHRocm91Z2ggdGhlIGxpc3RlbmVyc1xyXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLmxpc3RlbmVyc1t0eXBlXS5sZW5ndGg7IGkrKykge1xyXG4gICAgICAvLyBjaGVjayBpZiB0aGUgbGlzdGVuZXIgaXMgdGhlIHNhbWVcclxuICAgICAgaWYgKHRoaXMubGlzdGVuZXJzW3R5cGVdW2ldICE9PSBsaXN0ZW5lcikge1xyXG4gICAgICAgIGZpbHRlcmVkLnB1c2godGhpcy5saXN0ZW5lcnNbdHlwZV1baV0pO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgICAvLyBjaGVjayBpZiB0aGUgbGlzdGVuZXJzIGFyZSBlbXB0eVxyXG4gICAgaWYgKHRoaXMubGlzdGVuZXJzW3R5cGVdLmxlbmd0aCA9PT0gMCkge1xyXG4gICAgICBkZWxldGUgdGhpcy5saXN0ZW5lcnNbdHlwZV07XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICB0aGlzLmxpc3RlbmVyc1t0eXBlXSA9IGZpbHRlcmVkO1xyXG4gICAgfVxyXG4gIH1cclxuICAvLyBkaXNwYXRjaEV2ZW50XHJcbiAgZGlzcGF0Y2hFdmVudChldmVudCkge1xyXG4gICAgLy8gaWYgbm8gZXZlbnQgcmV0dXJuIHRydWVcclxuICAgIGlmICghZXZlbnQpIHtcclxuICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICB9XHJcbiAgICAvLyBzZXQgZXZlbnQgc291cmNlIHRvIHRoaXNcclxuICAgIGV2ZW50LnNvdXJjZSA9IHRoaXM7XHJcbiAgICAvLyBzZXQgb25IYW5kbGVyIHRvIG9uICsgZXZlbnQgdHlwZVxyXG4gICAgbGV0IG9uSGFuZGxlciA9ICdvbicgKyBldmVudC50eXBlO1xyXG4gICAgLy8gY2hlY2sgaWYgdGhlIG9uSGFuZGxlciBoYXMgb3duIHByb3BlcnR5IG5hbWVkIHNhbWUgYXMgb25IYW5kbGVyXHJcbiAgICBpZiAodGhpcy5oYXNPd25Qcm9wZXJ0eShvbkhhbmRsZXIpKSB7XHJcbiAgICAgIC8vIGNhbGwgdGhlIG9uSGFuZGxlclxyXG4gICAgICB0aGlzW29uSGFuZGxlcl0uY2FsbCh0aGlzLCBldmVudCk7XHJcbiAgICAgIC8vIGNoZWNrIGlmIHRoZSBldmVudCBpcyBkZWZhdWx0IHByZXZlbnRlZFxyXG4gICAgICBpZiAoZXZlbnQuZGVmYXVsdFByZXZlbnRlZCkge1xyXG4gICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gICAgLy8gY2hlY2sgaWYgdGhlIGV2ZW50IHR5cGUgaXMgaW4gdGhlIGxpc3RlbmVyc1xyXG4gICAgaWYgKHRoaXMubGlzdGVuZXJzW2V2ZW50LnR5cGVdKSB7XHJcbiAgICAgIHJldHVybiB0aGlzLmxpc3RlbmVyc1tldmVudC50eXBlXS5ldmVyeShmdW5jdGlvbihjYWxsYmFjaykge1xyXG4gICAgICAgIGNhbGxiYWNrKGV2ZW50KTtcclxuICAgICAgICByZXR1cm4gIWV2ZW50LmRlZmF1bHRQcmV2ZW50ZWQ7XHJcbiAgICAgIH0pO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIHRydWU7XHJcbiAgfVxyXG4gIC8vIF9zZXRSZWFkeVN0YXRlXHJcbiAgX3NldFJlYWR5U3RhdGUoc3RhdGUpIHtcclxuICAgIC8vIHNldCBldmVudCB0eXBlIHRvIHJlYWR5U3RhdGVDaGFuZ2VcclxuICAgIGxldCBldmVudCA9IG5ldyBDdXN0b21FdmVudCgncmVhZHlTdGF0ZUNoYW5nZScpO1xyXG4gICAgLy8gc2V0IGV2ZW50IHJlYWR5U3RhdGUgdG8gc3RhdGVcclxuICAgIGV2ZW50LnJlYWR5U3RhdGUgPSBzdGF0ZTtcclxuICAgIC8vIHNldCByZWFkeVN0YXRlIHRvIHN0YXRlXHJcbiAgICB0aGlzLnJlYWR5U3RhdGUgPSBzdGF0ZTtcclxuICAgIC8vIGRpc3BhdGNoIGV2ZW50XHJcbiAgICB0aGlzLmRpc3BhdGNoRXZlbnQoZXZlbnQpO1xyXG4gIH1cclxuICAvLyBfb25TdHJlYW1GYWlsdXJlXHJcbiAgX29uU3RyZWFtRmFpbHVyZShlKSB7XHJcbiAgICAvLyBzZXQgZXZlbnQgdHlwZSB0byBlcnJvclxyXG4gICAgbGV0IGV2ZW50ID0gbmV3IEN1c3RvbUV2ZW50KCdlcnJvcicpO1xyXG4gICAgLy8gc2V0IGV2ZW50IGRhdGEgdG8gZVxyXG4gICAgZXZlbnQuZGF0YSA9IGUuY3VycmVudFRhcmdldC5yZXNwb25zZTtcclxuICAgIC8vIGRpc3BhdGNoIGV2ZW50XHJcbiAgICB0aGlzLmRpc3BhdGNoRXZlbnQoZXZlbnQpO1xyXG4gICAgdGhpcy5jbG9zZSgpO1xyXG4gIH1cclxuICAvLyBfb25TdHJlYW1BYm9ydFxyXG4gIF9vblN0cmVhbUFib3J0KGUpIHtcclxuICAgIC8vIHNldCB0byBhYm9ydFxyXG4gICAgbGV0IGV2ZW50ID0gbmV3IEN1c3RvbUV2ZW50KCdhYm9ydCcpO1xyXG4gICAgLy8gY2xvc2VcclxuICAgIHRoaXMuY2xvc2UoKTtcclxuICB9XHJcbiAgLy8gX29uU3RyZWFtUHJvZ3Jlc3NcclxuICBfb25TdHJlYW1Qcm9ncmVzcyhlKSB7XHJcbiAgICAvLyBpZiBub3QgeGhyIHJldHVyblxyXG4gICAgaWYgKCF0aGlzLnhocikge1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcbiAgICAvLyBpZiB4aHIgc3RhdHVzIGlzIG5vdCAyMDAgcmV0dXJuXHJcbiAgICBpZiAodGhpcy54aHIuc3RhdHVzICE9PSAyMDApIHtcclxuICAgICAgLy8gb25TdHJlYW1GYWlsdXJlXHJcbiAgICAgIHRoaXMuX29uU3RyZWFtRmFpbHVyZShlKTtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG4gICAgLy8gaWYgcmVhZHkgc3RhdGUgaXMgQ09OTkVDVElOR1xyXG4gICAgaWYgKHRoaXMucmVhZHlTdGF0ZSA9PT0gdGhpcy5DT05ORUNUSU5HKSB7XHJcbiAgICAgIC8vIGRpc3BhdGNoIGV2ZW50XHJcbiAgICAgIHRoaXMuZGlzcGF0Y2hFdmVudChuZXcgQ3VzdG9tRXZlbnQoJ29wZW4nKSk7XHJcbiAgICAgIC8vIHNldCByZWFkeSBzdGF0ZSB0byBPUEVOXHJcbiAgICAgIHRoaXMuX3NldFJlYWR5U3RhdGUodGhpcy5PUEVOKTtcclxuICAgIH1cclxuICAgIC8vIHBhcnNlIHRoZSByZWNlaXZlZCBkYXRhLlxyXG4gICAgbGV0IGRhdGEgPSB0aGlzLnhoci5yZXNwb25zZVRleHQuc3Vic3RyaW5nKHRoaXMucHJvZ3Jlc3MpO1xyXG4gICAgLy8gdXBkYXRlIHByb2dyZXNzXHJcbiAgICB0aGlzLnByb2dyZXNzICs9IGRhdGEubGVuZ3RoO1xyXG4gICAgLy8gc3BsaXQgdGhlIGRhdGEgYnkgbmV3IGxpbmUgYW5kIHBhcnNlIGVhY2ggbGluZVxyXG4gICAgZGF0YS5zcGxpdCgvKFxcclxcbnxcXHJ8XFxuKXsyfS9nKS5mb3JFYWNoKGZ1bmN0aW9uKHBhcnQpe1xyXG4gICAgICBpZihwYXJ0LnRyaW0oKS5sZW5ndGggPT09IDApIHtcclxuICAgICAgICB0aGlzLmRpc3BhdGNoRXZlbnQodGhpcy5fcGFyc2VFdmVudENodW5rKHRoaXMuY2h1bmsudHJpbSgpKSk7XHJcbiAgICAgICAgdGhpcy5jaHVuayA9ICcnO1xyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIHRoaXMuY2h1bmsgKz0gcGFydDtcclxuICAgICAgfVxyXG4gICAgfS5iaW5kKHRoaXMpKTtcclxuICB9XHJcbiAgLy8gX29uU3RyZWFtTG9hZGVkXHJcbiAgX29uU3RyZWFtTG9hZGVkKGUpIHtcclxuICAgIHRoaXMuX29uU3RyZWFtUHJvZ3Jlc3MoZSk7XHJcbiAgICAvLyBwYXJzZSB0aGUgbGFzdCBjaHVua1xyXG4gICAgdGhpcy5kaXNwYXRjaEV2ZW50KHRoaXMuX3BhcnNlRXZlbnRDaHVuayh0aGlzLmNodW5rKSk7XHJcbiAgICB0aGlzLmNodW5rID0gJyc7XHJcbiAgfVxyXG4gIC8vIF9wYXJzZUV2ZW50Q2h1bmtcclxuICBfcGFyc2VFdmVudENodW5rKGNodW5rKSB7XHJcbiAgICAvLyBpZiBubyBjaHVuayBvciBjaHVuayBpcyBlbXB0eSByZXR1cm5cclxuICAgIGlmICghY2h1bmsgfHwgY2h1bmsubGVuZ3RoID09PSAwKSB7XHJcbiAgICAgIHJldHVybiBudWxsO1xyXG4gICAgfVxyXG4gICAgLy8gaW5pdCBlXHJcbiAgICBsZXQgZSA9IHtpZDogbnVsbCwgcmV0cnk6IG51bGwsIGRhdGE6ICcnLCBldmVudDogJ21lc3NhZ2UnfTtcclxuICAgIC8vIHNwbGl0IHRoZSBjaHVuayBieSBuZXcgbGluZVxyXG4gICAgY2h1bmsuc3BsaXQoLyhcXHJcXG58XFxyfFxcbikvKS5mb3JFYWNoKGZ1bmN0aW9uKGxpbmUpIHtcclxuICAgICAgbGluZSA9IGxpbmUudHJpbVJpZ2h0KCk7XHJcbiAgICAgIGxldCBpbmRleCA9IGxpbmUuaW5kZXhPZih0aGlzLkZJRUxEX1NFUEFSQVRPUik7XHJcbiAgICAgIGlmKGluZGV4IDw9IDApIHtcclxuICAgICAgICByZXR1cm47XHJcbiAgICAgIH1cclxuICAgICAgLy8gZmllbGRcclxuICAgICAgbGV0IGZpZWxkID0gbGluZS5zdWJzdHJpbmcoMCwgaW5kZXgpO1xyXG4gICAgICBpZighKGZpZWxkIGluIGUpKSB7XHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgICB9XHJcbiAgICAgIC8vIHZhbHVlXHJcbiAgICAgIGxldCB2YWx1ZSA9IGxpbmUuc3Vic3RyaW5nKGluZGV4ICsgMSkudHJpbUxlZnQoKTtcclxuICAgICAgaWYoZmllbGQgPT09ICdkYXRhJykge1xyXG4gICAgICAgIGVbZmllbGRdICs9IHZhbHVlO1xyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIGVbZmllbGRdID0gdmFsdWU7XHJcbiAgICAgIH1cclxuICAgIH0uYmluZCh0aGlzKSk7XHJcbiAgICAvLyByZXR1cm4gZXZlbnRcclxuICAgIGxldCBldmVudCA9IG5ldyBDdXN0b21FdmVudChlLmV2ZW50KTtcclxuICAgIGV2ZW50LmRhdGEgPSBlLmRhdGE7XHJcbiAgICBldmVudC5pZCA9IGUuaWQ7XHJcbiAgICByZXR1cm4gZXZlbnQ7XHJcbiAgfVxyXG4gIC8vIF9jaGVja1N0cmVhbUNsb3NlZFxyXG4gIF9jaGVja1N0cmVhbUNsb3NlZCgpIHtcclxuICAgIGlmKCF0aGlzLnhocikge1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcbiAgICBpZih0aGlzLnhoci5yZWFkeVN0YXRlID09PSBYTUxIdHRwUmVxdWVzdC5ET05FKSB7XHJcbiAgICAgIHRoaXMuX3NldFJlYWR5U3RhdGUodGhpcy5DTE9TRUQpO1xyXG4gICAgfVxyXG4gIH1cclxuICAvLyBzdHJlYW1cclxuICBzdHJlYW0oKSB7XHJcbiAgICAvLyBzZXQgcmVhZHkgc3RhdGUgdG8gY29ubmVjdGluZ1xyXG4gICAgdGhpcy5fc2V0UmVhZHlTdGF0ZSh0aGlzLkNPTk5FQ1RJTkcpO1xyXG4gICAgLy8gc2V0IHhociB0byBuZXcgWE1MSHR0cFJlcXVlc3RcclxuICAgIHRoaXMueGhyID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XHJcbiAgICAvLyBzZXQgeGhyIHByb2dyZXNzIHRvIF9vblN0cmVhbVByb2dyZXNzXHJcbiAgICB0aGlzLnhoci5hZGRFdmVudExpc3RlbmVyKCdwcm9ncmVzcycsIHRoaXMuX29uU3RyZWFtUHJvZ3Jlc3MuYmluZCh0aGlzKSk7XHJcbiAgICAvLyBzZXQgeGhyIGxvYWQgdG8gX29uU3RyZWFtTG9hZGVkXHJcbiAgICB0aGlzLnhoci5hZGRFdmVudExpc3RlbmVyKCdsb2FkJywgdGhpcy5fb25TdHJlYW1Mb2FkZWQuYmluZCh0aGlzKSk7XHJcbiAgICAvLyBzZXQgeGhyIHJlYWR5IHN0YXRlIGNoYW5nZSB0byBfY2hlY2tTdHJlYW1DbG9zZWRcclxuICAgIHRoaXMueGhyLmFkZEV2ZW50TGlzdGVuZXIoJ3JlYWR5c3RhdGVjaGFuZ2UnLCB0aGlzLl9jaGVja1N0cmVhbUNsb3NlZC5iaW5kKHRoaXMpKTtcclxuICAgIC8vIHNldCB4aHIgZXJyb3IgdG8gX29uU3RyZWFtRmFpbHVyZVxyXG4gICAgdGhpcy54aHIuYWRkRXZlbnRMaXN0ZW5lcignZXJyb3InLCB0aGlzLl9vblN0cmVhbUZhaWx1cmUuYmluZCh0aGlzKSk7XHJcbiAgICAvLyBzZXQgeGhyIGFib3J0IHRvIF9vblN0cmVhbUFib3J0XHJcbiAgICB0aGlzLnhoci5hZGRFdmVudExpc3RlbmVyKCdhYm9ydCcsIHRoaXMuX29uU3RyZWFtQWJvcnQuYmluZCh0aGlzKSk7XHJcbiAgICAvLyBvcGVuIHhoclxyXG4gICAgdGhpcy54aHIub3Blbih0aGlzLm1ldGhvZCwgdGhpcy51cmwpO1xyXG4gICAgLy8gaGVhZGVycyB0byB4aHJcclxuICAgIGZvciAobGV0IGhlYWRlciBpbiB0aGlzLmhlYWRlcnMpIHtcclxuICAgICAgdGhpcy54aHIuc2V0UmVxdWVzdEhlYWRlcihoZWFkZXIsIHRoaXMuaGVhZGVyc1toZWFkZXJdKTtcclxuICAgIH1cclxuICAgIC8vIGNyZWRlbnRpYWxzIHRvIHhoclxyXG4gICAgdGhpcy54aHIud2l0aENyZWRlbnRpYWxzID0gdGhpcy53aXRoQ3JlZGVudGlhbHM7XHJcbiAgICAvLyBzZW5kIHhoclxyXG4gICAgdGhpcy54aHIuc2VuZCh0aGlzLnBheWxvYWQpO1xyXG4gIH1cclxuICAvLyBjbG9zZVxyXG4gIGNsb3NlKCkge1xyXG4gICAgaWYodGhpcy5yZWFkeVN0YXRlID09PSB0aGlzLkNMT1NFRCkge1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcbiAgICB0aGlzLnhoci5hYm9ydCgpO1xyXG4gICAgdGhpcy54aHIgPSBudWxsO1xyXG4gICAgdGhpcy5fc2V0UmVhZHlTdGF0ZSh0aGlzLkNMT1NFRCk7XHJcbiAgfVxyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IFNtYXJ0Q29ubmVjdGlvbnNQbHVnaW47Il0sCiAgIm1hcHBpbmdzIjogIjtBQUFBLElBQU0sV0FBVyxRQUFRLFVBQVU7QUFDbkMsSUFBTSxVQUFVLE1BQU07QUFBQSxFQUNwQixZQUFZLFFBQVE7QUFDbEIsU0FBSyxTQUFTO0FBQUEsTUFDWixXQUFXO0FBQUEsTUFDWCxhQUFhO0FBQUEsTUFDYixnQkFBZ0I7QUFBQSxNQUNoQixlQUFlO0FBQUEsTUFDZixjQUFjO0FBQUEsTUFDZCxnQkFBZ0I7QUFBQSxNQUNoQixjQUFjO0FBQUEsTUFDZCxlQUFlO0FBQUEsTUFDZixHQUFHO0FBQUEsSUFDTDtBQUNBLFNBQUssWUFBWSxLQUFLLE9BQU87QUFDN0IsU0FBSyxjQUFjLE9BQU87QUFDMUIsU0FBSyxZQUFZLEtBQUssY0FBYyxNQUFNLEtBQUs7QUFDL0MsU0FBSyxhQUFhO0FBQUEsRUFDcEI7QUFBQSxFQUNBLE1BQU0sWUFBWSxNQUFNO0FBQ3RCLFFBQUksS0FBSyxPQUFPLGdCQUFnQjtBQUM5QixhQUFPLE1BQU0sS0FBSyxPQUFPLGVBQWUsSUFBSTtBQUFBLElBQzlDLE9BQU87QUFDTCxZQUFNLElBQUksTUFBTSx3QkFBd0I7QUFBQSxJQUMxQztBQUFBLEVBQ0Y7QUFBQSxFQUNBLE1BQU0sTUFBTSxNQUFNO0FBQ2hCLFFBQUksS0FBSyxPQUFPLGVBQWU7QUFDN0IsYUFBTyxNQUFNLEtBQUssT0FBTyxjQUFjLElBQUk7QUFBQSxJQUM3QyxPQUFPO0FBQ0wsWUFBTSxJQUFJLE1BQU0sdUJBQXVCO0FBQUEsSUFDekM7QUFBQSxFQUNGO0FBQUEsRUFDQSxNQUFNLFVBQVUsTUFBTTtBQUNwQixRQUFJLEtBQUssT0FBTyxjQUFjO0FBQzVCLGFBQU8sTUFBTSxLQUFLLE9BQU8sYUFBYSxJQUFJO0FBQUEsSUFDNUMsT0FBTztBQUNMLFlBQU0s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QUVqRSxTQUFLLElBQUksaUJBQWlCLG9CQUFvQixLQUFLLG1CQUFtQixLQUFLLElBQUksQ0FBQztBQUVoRixTQUFLLElBQUksaUJBQWlCLFNBQVMsS0FBSyxpQkFBaUIsS0FBSyxJQUFJLENBQUM7QUFFbkUsU0FBSyxJQUFJLGlCQUFpQixTQUFTLEtBQUssZUFBZSxLQUFLLElBQUksQ0FBQztBQUVqRSxTQUFLLElBQUksS0FBSyxLQUFLLFFBQVEsS0FBSyxHQUFHO0FBRW5DLGFBQVMsVUFBVSxLQUFLLFNBQVM7QUFDL0IsV0FBSyxJQUFJLGlCQUFpQixRQUFRLEtBQUssUUFBUSxNQUFNLENBQUM7QUFBQSxJQUN4RDtBQUVBLFNBQUssSUFBSSxrQkFBa0IsS0FBSztBQUVoQyxTQUFLLElBQUksS0FBSyxLQUFLLE9BQU87QUFBQSxFQUM1QjtBQUFBO0FBQUEsRUFFQSxRQUFRO0FBQ04sUUFBRyxLQUFLLGVBQWUsS0FBSyxRQUFRO0FBQ2xDO0FBQUEsSUFDRjtBQUNBLFNBQUssSUFBSSxNQUFNO0FBQ2YsU0FBSyxNQUFNO0FBQ1gsU0FBSyxlQUFlLEtBQUssTUFBTTtBQUFBLEVBQ2pDO0FBQ0Y7QUFFQSxPQUFPLFVBQVU7IiwKICAibmFtZXMiOiBbImxpbmVfbGltaXQiLCAiaXRlbSIsICJsaW5rIiwgImZpbGVfbGluayIsICJmaWxlX2xpbmtfbGlzdCJdCn0K
