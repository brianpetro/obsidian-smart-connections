(() => {
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
    get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
  }) : x)(function(x) {
    if (typeof require !== "undefined")
      return require.apply(this, arguments);
    throw new Error('Dynamic require of "' + x + '" is not supported');
  });
  var __commonJS = (cb, mod) => function __require2() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };

  // src/index.js
  var require_src = __commonJS({
    "src/index.js"(exports, module) {
      var Obsidian = __require("obsidian");
      var crypto = __require("crypto");
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
        results_count: 30,
        skip_sections: false,
        smart_chat_model: "gpt-3.5-turbo",
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
      var SmartConnectionsPlugin = class extends Obsidian.Plugin {
        // constructor
        constructor() {
          super(...arguments);
          this.api = null;
          this.embeddings = null;
          this.embeddings_external = null;
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
          const curr_key = this.get_file_key(curr_file);
          if (typeof this.nearest_cache[curr_key] === "undefined") {
            new Obsidian.Notice("[Smart Connections] No Smart Connections found. Open a note to get Smart Connections.");
            return;
          }
          const rand = Math.floor(Math.random() * this.nearest_cache[curr_key].length / 2);
          const random_file = this.nearest_cache[curr_key][rand];
          this.open_note(random_file);
        }
        async open_view() {
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
        async open_chat() {
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
          this.render_log.total_files = files.length;
          this.clean_up_embeddings(files);
          let batch_promises = [];
          for (let i = 0; i < files.length; i++) {
            if (files[i].path.indexOf("#") > -1) {
              this.log_exclusion("path contains #");
              continue;
            }
            const curr_key = crypto.createHash("md5").update(files[i].path).digest("hex");
            if (this.embeddings[curr_key] && this.embeddings[curr_key].meta.mtime >= files[i].stat.mtime) {
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
            }, 6e4);
            return;
          }
          const embeddings = JSON.stringify(this.embeddings);
          const embeddings_file_exists = await this.app.vault.adapter.exists(".smart-connections/embeddings-2.json");
          if (embeddings_file_exists) {
            const new_file_size = embeddings.length;
            const existing_file_size = await this.app.vault.adapter.stat(".smart-connections/embeddings-2.json").then((stat) => stat.size);
            if (new_file_size > existing_file_size * 0.5) {
              await this.app.vault.adapter.write(".smart-connections/embeddings-2.json", embeddings);
              this.has_new_embeddings = false;
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
              await this.app.vault.adapter.write(".smart-connections/unsaved-embeddings.json", embeddings);
              new Obsidian.Notice("Smart Connections: Warning: New embeddings file size is significantly smaller than existing embeddings file size. Aborting to prevent possible loss of embeddings data. See Smart Connections view for more details.");
              throw new Error("Error: New embeddings file size is significantly smaller than existing embeddings file size. Aborting to prevent possible loss of embeddings data.");
            }
          } else {
            await this.init_embeddings_file();
            await this.save_embeddings_to_file();
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
        // check if key from embeddings exists in files
        clean_up_embeddings(files) {
          for (let key in this.embeddings) {
            const path = this.embeddings[key].meta.path;
            if (!files.find((file) => path.startsWith(file.path))) {
              delete this.embeddings[key];
              this.render_log.deleted_embeddings++;
              continue;
            }
            if (path.indexOf("#") > -1) {
              const file_key = this.embeddings[key].meta.file;
              if (!this.embeddings[file_key]) {
                delete this.embeddings[key];
                this.render_log.deleted_embeddings++;
                continue;
              }
              if (!this.embeddings[file_key].meta) {
                delete this.embeddings[key];
                this.render_log.deleted_embeddings++;
                continue;
              }
              if (this.embeddings[file_key].meta.blocks && this.embeddings[file_key].meta.blocks.indexOf(key) < 0) {
                delete this.embeddings[key];
                this.render_log.deleted_embeddings++;
                continue;
              }
              if (this.embeddings[file_key].meta.mtime && this.embeddings[key].meta.mtime && this.embeddings[file_key].meta.mtime > this.embeddings[key].meta.mtime) {
                delete this.embeddings[key];
                this.render_log.deleted_embeddings++;
              }
            }
          }
        }
        async init_embeddings_file() {
          if (!await this.app.vault.adapter.exists(".smart-connections")) {
            await this.app.vault.adapter.mkdir(".smart-connections");
            console.log("created folder: .smart-connections");
            await this.add_to_gitignore();
          } else {
            console.log("folder already exists: .smart-connections");
          }
          if (!await this.app.vault.adapter.exists(".smart-connections/embeddings-2.json")) {
            await this.app.vault.adapter.write(".smart-connections/embeddings-2.json", "{}");
            console.log("created embeddings file: .smart-connections/embeddings-2.json");
          } else {
            console.log("embeddings file already exists: .smart-connections/embeddings-2.json");
          }
        }
        /**
         * migrate embeddings.json to embeddings-2.json
         * - embeddings-2.json is a new file format that uses a different method to store embeddings
         * - move key to meta.source
         * - replace key with md5(meta.source)
         * - move values to vec
        */
        // if embeddings.json exists then use it to create embeddings-2.json
        async migrate_embeddings_to_v2() {
          const embeddings = await this.app.vault.adapter.read(".smart-connections/embeddings.json");
          const embeddings_json = JSON.parse(embeddings);
          const embeddings_2_json = {};
          for (let key in embeddings_json) {
            const new_key = crypto.createHash("md5").update(key).digest("hex");
            embeddings_2_json[new_key] = {
              "vec": embeddings_json[key].values,
              "meta": {
                "path": key,
                "hash": embeddings_json[key].hash,
                "mtime": embeddings_json[key].mtime,
                "tokens": embeddings_json[key].tokens
              }
            };
            if (embeddings_json[key].hashes) {
              embeddings_2_json[new_key].meta.blocks = [];
              for (let hash of embeddings_json[key].hashes) {
                for (let key2 in embeddings_json) {
                  if (embeddings_json[key2].hash == hash) {
                    const hash_key = crypto.createHash("md5").update(key2).digest("hex");
                    embeddings_2_json[new_key].meta.blocks.push(hash_key);
                  }
                }
              }
              embeddings_2_json[new_key].meta.blocks.sort();
            }
            if (key.indexOf("#") > -1) {
              const file_key = crypto.createHash("md5").update(key.split("#")[0]).digest("hex");
              embeddings_2_json[new_key].meta.file = file_key;
            }
            embeddings_2_json[new_key] = JSON.parse(JSON.stringify(embeddings_2_json[new_key]));
          }
          await this.app.vault.adapter.write(".smart-connections/embeddings-2.json", JSON.stringify(embeddings_2_json));
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
          let current_datetime = Math.floor(Date.now() / 1e3);
          await this.app.vault.adapter.rename(".smart-connections/embeddings-2.json", ".smart-connections/embeddings-" + current_datetime + ".json");
          await this.app.vault.adapter.write(".smart-connections/embeddings-2.json", "{}");
          new Obsidian.Notice("Smart Connections: embeddings file Force Refreshed, making new connections...");
          this.embeddings = null;
          this.embeddings = {};
          await this.get_all_embeddings();
          this.output_render_log();
          new Obsidian.Notice("Smart Connections: embeddings file Force Refreshed, new connections made.");
        }
        // get embeddings for embed_input
        async get_file_embeddings(curr_file, save = true) {
          let req_batch = [];
          let blocks = [];
          const curr_file_key = this.get_file_key(curr_file);
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
              const block_key = crypto.createHash("md5").update(note_sections[j].path).digest("hex");
              blocks.push(block_key);
              let block_hash;
              if (this.embeddings[block_key] && this.embeddings[block_key].meta) {
                if (block_embed_input.length === this.embeddings[block_key].meta.len) {
                  continue;
                }
                if (this.embeddings[block_key].meta.mtime >= curr_file.stat.mtime) {
                  continue;
                }
                block_hash = this.get_embed_hash(block_embed_input);
                if (this.embeddings[block_key].meta.hash === block_hash) {
                  continue;
                }
              }
              req_batch.push([block_key, block_embed_input, {
                // oldmtime: curr_file.stat.mtime, 
                // get current datetime as unix timestamp
                mtime: Date.now(),
                hash: block_hash,
                file: curr_file_key,
                path: note_sections[j].path,
                len: block_embed_input.length
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
          const file_hash = this.get_embed_hash(file_embed_input);
          const existing_hash = this.embeddings[curr_file_key] && this.embeddings[curr_file_key].meta ? this.embeddings[curr_file_key].meta.hash : null;
          if (existing_hash && file_hash === existing_hash) {
            this.update_render_log(blocks, file_embed_input);
            return;
          }
          ;
          const existing_blocks = this.embeddings[curr_file_key] && this.embeddings[curr_file_key].meta ? this.embeddings[curr_file_key].meta.blocks : null;
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
            let prev_file_size = 0;
            if (this.embeddings[curr_file_key] && this.embeddings[curr_file_key].meta && this.embeddings[curr_file_key].meta.size) {
              prev_file_size = this.embeddings[curr_file_key].meta.size;
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
            blocks
          };
          req_batch.push([curr_file_key, file_embed_input, meta]);
          await this.get_embeddings_batch(req_batch);
          if (save) {
            await this.save_embeddings_to_file();
          }
        }
        get_file_key(curr_file) {
          return crypto.createHash("md5").update(curr_file.path).digest("hex");
        }
        update_render_log(blocks, file_embed_input) {
          if (blocks.length > 0) {
            this.render_log.tokens_saved_by_cache += file_embed_input.length / 2;
          } else {
            this.render_log.tokens_saved_by_cache += file_embed_input.length / 4;
          }
        }
        // async get_embeddings(key, embed_input, meta={}) {
        //   const requestResults = await this.request_embedding_from_input(embed_input);
        //   // if requestResults is null then return
        //   if(!requestResults) {
        //     console.log("failed embedding: " + meta.path);
        //     // log failed file names to render_log
        //     this.render_log.failed_embeddings.push(meta.path);
        //     return;
        //   }
        //   // if requestResults is not null
        //   if(requestResults){
        //     // add embedding key to render_log
        //     if(this.settings.log_render){
        //       if(this.settings.log_render_files){
        //         this.render_log.files.push(meta);
        //       }
        //       this.render_log.new_embeddings++;
        //       // add token usage to render_log
        //       this.render_log.token_usage += requestResults.usage.total_tokens;
        //     }
        //     const vec = requestResults.data[0].embedding;
        //     if(vec) {
        //       this.embeddings[key] = {};
        //       this.embeddings[key].vec = vec;
        //       this.embeddings[key].meta = meta;
        //       this.embeddings[key].meta.tokens = requestResults.usage.total_tokens;
        //     }
        //   }
        // }
        async get_embeddings_batch(req_batch) {
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
                this.embeddings[key] = {};
                this.embeddings[key].vec = vec;
                this.embeddings[key].meta = meta;
              }
            }
          }
        }
        // md5 hash of embed_input using built in crypto module
        get_embed_hash(embed_input) {
          embed_input = embed_input.trim();
          return crypto.createHash("md5").update(embed_input).digest("hex");
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
        find_nearest_embedding(to_vec, filter = {}) {
          let nearest = [];
          const from_keys = Object.keys(this.embeddings);
          this.render_log.total_embeddings = from_keys.length;
          for (let i = 0; i < from_keys.length; i++) {
            if (this.settings.skip_sections) {
              const from_path = this.embeddings[from_keys[i]].meta.path;
              if (from_path.indexOf("#") > -1)
                continue;
            }
            if (filter.skip_key) {
              if (filter.skip_key === from_keys[i])
                continue;
              if (filter.skip_key === this.embeddings[from_keys[i]].meta.file)
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
              similarity: this.computeCosineSimilarity(to_vec, this.embeddings[from_keys[i]].vec),
              len: this.embeddings[from_keys[i]].meta.len || this.embeddings[from_keys[i]].meta.size
            });
          }
          if (this.embeddings_external) {
            for (let i = 0; i < this.embeddings_external.length; i++) {
              nearest.push({
                link: this.embeddings_external[i].meta,
                similarity: this.computeCosineSimilarity(to_vec, this.embeddings_external[i].vec)
              });
            }
          }
          nearest.sort(function(a, b) {
            return b.similarity - a.similarity;
          });
          nearest = nearest.slice(0, this.settings.results_count);
          return nearest;
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
          const curr_key = crypto.createHash("md5").update(current_note.path).digest("hex");
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
            let current_note_embedding_vec = [];
            if (!this.embeddings[curr_key] || !(this.embeddings[curr_key].meta.mtime >= current_note.stat.mtime) || !this.embeddings[curr_key].vec || !Array.isArray(this.embeddings[curr_key].vec) || !(this.embeddings[curr_key].vec.length > 0)) {
              await this.get_file_embeddings(current_note);
            } else {
            }
            if (!this.embeddings[curr_key] || !this.embeddings[curr_key].vec) {
              return "Error getting embeddings for: " + current_note.path;
            }
            current_note_embedding_vec = this.embeddings[curr_key].vec;
            nearest = this.find_nearest_embedding(current_note_embedding_vec, { skip_key: curr_key });
            this.nearest_cache[curr_key] = nearest;
          }
          return nearest;
        }
        // create render_log object of exlusions with number of times skipped as value
        log_exclusion(exclusion) {
          this.render_log.exclusions_logs[exclusion] = (this.render_log.exclusions_logs[exclusion] || 0) + 1;
        }
        onunload() {
          this.output_render_log();
          console.log("unloading plugin");
          this.app.workspace.detachLeavesOfType(SMART_CONNECTIONS_VIEW_TYPE);
          this.app.workspace.detachLeavesOfType(SMART_CONNECTIONS_CHAT_VIEW_TYPE);
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
            await this.plugin.init_embeddings_file();
            await this.render_connections();
          });
          retry_button.addEventListener("click", async (event) => {
            await this.plugin.load_embeddings_file();
          });
        }
        async onOpen() {
          const container = this.containerEl.children[1];
          container.empty();
          container.createEl("p", { cls: "scPlaceholder", text: "Open a note to find connections." });
          this.registerEvent(this.app.workspace.on("file-open", (file) => {
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
          await this.load_embeddings_file();
          await this.render_connections();
          this.api = new SmartConnectionsViewApi(this.app, this.plugin, this);
          (window["SmartConnectionsViewApi"] = this.api) && this.register(() => delete window["SmartConnectionsViewApi"]);
        }
        async onClose() {
          this.app.workspace.unregisterHoverLinkSource(SMART_CONNECTIONS_VIEW_TYPE);
          this.plugin.view = null;
        }
        async render_connections(context = null) {
          if (!this.plugin.settings.api_key) {
            this.set_message("An OpenAI API key is required to make Smart Connections");
            return;
          }
          if (!this.plugin.embeddings) {
            await this.load_embeddings_file();
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
        async load_embeddings_file(retries = 0) {
          this.set_message("Loading embeddings file...");
          try {
            if (retries === 3) {
              if (await this.app.vault.adapter.exists(".smart-connections/embeddings.json")) {
                this.set_message("Migrating embeddings.json to embeddings-2.json...");
                await this.plugin.migrate_embeddings_to_v2();
                await this.load_embeddings_file();
                return;
              }
            }
            const embeddings_file = await this.app.vault.adapter.read(".smart-connections/embeddings-2.json");
            this.plugin.embeddings = JSON.parse(embeddings_file);
            this.set_message("Embeddings file loaded.");
          } catch (error) {
            if (retries < 3) {
              console.log("retrying load_embeddings_file()");
              await new Promise((r) => setTimeout(r, 1e3 + 1e3 * retries));
              await this.load_embeddings_file(retries + 1);
            } else {
              console.log("failed to load embeddings file, prompting user to bulk embed");
              this.render_embeddings_buttons();
              throw new Error("Error: Prompting user to create a new embeddings file or retry.");
            }
          }
          const files_list = await this.app.vault.adapter.list(".smart-connections");
          if (files_list.files) {
            console.log("loading external embeddings");
            const external_files = files_list.files.filter((file) => file.indexOf("embeddings-external") !== -1);
            for (let i = 0; i < external_files.length; i++) {
              const embeddings_file = await this.app.vault.adapter.read(external_files[i]);
              if (this.plugin.embeddings_external) {
                this.plugin.embeddings_external = [...this.plugin.embeddings_external, ...JSON.parse(embeddings_file).embeddings];
              } else {
                this.plugin.embeddings_external = JSON.parse(embeddings_file).embeddings;
              }
              console.log("loaded " + external_files[i]);
            }
          }
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
          await this.view.load_embeddings_file();
          await this.view.render_connections();
        }
      };
      var ScSearchApi = class {
        constructor(app, plugin) {
          this.app = app;
          this.plugin = plugin;
        }
        async search(search_text, filter = {}) {
          let nearest = [];
          const resp = await this.plugin.request_embedding_from_input(search_text);
          if (resp && resp.data && resp.data[0] && resp.data[0].embedding) {
            nearest = this.plugin.find_nearest_embedding(resp.data[0].embedding, filter);
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
            dropdown.addOption("gpt-3.5-turbo", "gpt-3.5-turbo");
            dropdown.addOption("gpt-4", "gpt-4 (limited access)");
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
          opts = {
            model: this.plugin.settings.smart_chat_model,
            messages: this.chat.prepare_chat_ml(),
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
          const MAX_CHARS = 1e4;
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
          console.log("total context tokens: ~" + Math.round(char_accum / 4));
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
          let max_chars = 1e4;
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
    }
  });
  require_src();
})();
