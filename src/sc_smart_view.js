const { SmartObsidianView } = require("./smart_obsidian_view.js");
const { SmartEmbedSettings } = require("./smart_embed_settings.js");
const SUPPORTED_FILE_TYPES = ["md", "canvas"];

class ScSmartView extends SmartObsidianView {
  static get view_type() { return "smart-connections-view"; }
  // Obsidian
  getViewType() { return this.constructor.view_type; }
  getDisplayText() { return "Smart Connections Files"; }
  getIcon() { return "smart-connections"; }
  async onOpen() { this.app.workspace.onLayoutReady(this.initialize.bind(this)); }
  get template_name() { return "smart_connections"; }
  async initialize() {
    this.brain = this.env; // DEPRECATED
    await this.wait_for_env_to_load();
    this.last_parent_id = this.constructor.get_leaf(this.app.workspace)?.parent.id;
    this.container.empty();
    this.nearest_cache = {}; // cache nearest results
    // await this.load_brain(); // moved to main plugin initialization
    this.plugin.smart_connections_view = this;
    this.register_plugin_events();
    this.app.workspace.registerHoverLinkSource(this.constructor.view_type, { display: 'Smart Connections Files', defaultMod: true });
    this.container.innerHTML = this.render_template(this.template_name, { current_path: "", results: [] });
    this.add_top_bar_listeners();
  }
  async onClose() {
    console.log("closing smart connections view");
    this.app.workspace.unregisterHoverLinkSource(this.constructor.view_type);
  }
  onResize() {
    if (this.constructor.get_leaf(this.app.workspace).parent.id !== this.last_parent_id) {
      console.log("Parent changed, reloading");
      // this.load_brain();
      this.initialize();
    }
  }
  // getters
  // DEPRECATED
  // get path_only() { return (this.settings.path_only?.length) ? this.settings.path_only.split(",").map((path) => path.trim()) : []; }
  // Smart Connections
  register_plugin_events() {
    // on file-open
    this.plugin.registerEvent(this.app.workspace.on('file-open', (file) => {
      // console.log("file-open");
      this.update_last_user_activity_timestamp();
      if (!file) return; // if no file is open, return

      // check if this view is visible
      if (this.container.checkVisibility() === false) return console.log("View inactive, skipping render nearest");
      this.render_nearest(file);
    }));
    // on active-leaf-change
    this.plugin.registerEvent(this.app.workspace.on('active-leaf-change', (leaf) => {
      this.update_last_user_activity_timestamp();
      // if leaf is this view
      if (leaf.view instanceof this.constructor) {
        if (leaf.view.container.querySelectorAll(".search-result").length && (leaf.view.last_note === this.app.workspace.getActiveFile()?.path)) return; // if search results are already rendered, return
        return this.render_nearest();
      }
    }));
    // on editor-change
    this.plugin.registerEvent(this.app.workspace.on('editor-change', (editor) => {
      // console.log("editor-change");
      this.update_last_user_activity_timestamp();
    }));
    // on quit
    this.plugin.registerEvent(this.app.workspace.on('quit', async () => {
      // console.log("quit");
      // save if this.env.save_timeout is set (currently failing to save on quit)
      if (this.env.save_timeout) {
        clearTimeout(this.env.save_timeout);
        await this.env._save();
        console.log("Smart Connections saved");
      }
    }));
  }
  // used in brain.save timeout to reset if recent activity (prevent saving blocking UX during user activity)
  update_last_user_activity_timestamp() { this.last_user_activity = Date.now(); }
  // Smart Connections Views
  get view_context() {
    return {
      ...super.view_context,
      blocks: this.env.smart_blocks?.keys.length,
      notes: this.env.smart_notes?.keys.length,
    };
  }
  async render_nearest(context, container = this.container) {
    if(!this.env?.entities_loaded){
      // render loading message
      container.innerHTML = "Loading Smart Connections...";
      // wait for entities to load
      while(!this.env?.entities_loaded) await new Promise(r => setTimeout(r, 2000));
    }
    let results;
    if (typeof context === "string") results = await this.plugin.api.search(context);
    if (typeof context === "undefined") context = this.app.workspace.getActiveFile();
    if (context instanceof this.plugin.obsidian.TFile) {
      // return if file type is not supported
      if (SUPPORTED_FILE_TYPES.indexOf(context.extension) === -1) return this.plugin.notices.show('unsupported file type', [
        "File: " + context.name,
        "Unsupported file type (Supported: " + SUPPORTED_FILE_TYPES.join(", ") + ")"
      ]);
      if (!this.env.smart_notes.get(context.path)) {
        // check if excluded
        if(this.env.is_included(context.path)){
          await this.env.smart_notes.import(this.env.files);
        }else{
          return this.plugin.notices.show('excluded file', "File is excluded: " + context.path, {timeout: 3000});
        }
      }
      results = this.env.smart_notes.get(context.path)?.find_connections();
    }
    if (context instanceof this.env.item_types.SmartBlock) results = context.find_connections();
    if (context instanceof this.env.item_types.SmartNote) results = context.find_connections();
    if (!results) return this.plugin.notices.show('no smart connections found', "No Smart Connections found.");
    if (typeof context === "object") context = context.key || context.path;
    this.last_note = this.app.workspace.getActiveFile().path; // for checking if results are already rendered (ex: on active-leaf-change)

    // console.log(results);
    container.innerHTML = this.render_template(this.template_name, { current_path: context, results });
    this.add_top_bar_listeners(container);
    container.querySelectorAll(".search-result").forEach((elm, i) => this.add_link_listeners(elm, results[i]));
    container.querySelectorAll(".search-result:not(.sc-collapsed) ul li").forEach(this.render_result.bind(this));
  }
  async render_result(elm, i = 0) {
    // if already rendered, return
    if (elm.innerHTML) return console.log("already rendered");
    await new Promise(r => setTimeout(r, 20 * i)); // wait 100ms between each render


    // only render visible results
    // if not visible, set listener to render when it is
    if (!isElementVisible(elm)) {
      // if closest .search-result has sc-collapsed class, return
      const parent = elm.closest(".search-result");
      if (parent.classList.contains("sc-collapsed")) return;
      // if parent is not visible, set listener to render when it is
      if (!isElementVisible(parent)) {
        const observer = new IntersectionObserver((entries, observer) => {
          if (entries[0].isIntersecting) {
            this.render_result(elm);
            observer.unobserve(parent);
          }
        }, { threshold: 0.5 });
        observer.observe(parent);
        return; // if not visible, return
      }
    }
    console.log("rendering result");
    const entity_key = elm.title;
    const collection_name = elm.dataset.collection;
    const entity = this.env[collection_name].get(entity_key);
    if (should_render_embed()) return this.plugin.obsidian.MarkdownRenderer.render(this.app, entity.embed_link, elm, entity_key, new this.plugin.obsidian.Component());
    const content = (await entity?.get_content())?.replace(/```dataview/g, '```\\dataview'); // prevent rendering dataview code blocks (DO: make toggle-able)
    if (!entity || !content) {
      // add not found message <p>
      elm.createEl("p", { text: "Block not found: " + entity_key });
      // add refresh button
      const refresh_button = elm.createEl("button", { text: "Refresh embeddings" });
      refresh_button.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.env.smart_notes.import(this.env.files, { reset: true });
      });
    }
    this.plugin.obsidian.MarkdownRenderer.render(this.app, content, elm, entity_key, new this.plugin.obsidian.Component());
    function isElementVisible(elem) {
      const rect = elem.getBoundingClientRect();
      return (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
        rect.right <= (window.innerWidth || document.documentElement.clientWidth)
      );
    }
    function should_render_embed() {
      if (!entity) return false;
      if (entity.is_canvas) return true;
      if (entity.is_excalidraw) return true;
      if (entity.note?.is_canvas) return true;
      if (entity.note?.is_excalidraw) return true;
      return false;
    }
  }
  add_link_listeners(elm, item) {
    elm.addEventListener("click", this.handle_search_result_click.bind(this));
    // drag-on
    // currently only works with full-file links
    elm.setAttr('draggable', 'true');
    elm.addEventListener('dragstart', (event) => {
      const dragManager = this.app.dragManager;
      const file_path = item.path.split("#")[0];
      const file = this.app.metadataCache.getFirstLinkpathDest(file_path, '');
      const dragData = dragManager.dragFile(event, file);
      // console.log(dragData);
      dragManager.onDragStart(event, dragData);
    });
    // if curr.link contains curly braces, return (incompatible with hover-link)
    if (item.path.indexOf("{") > -1) return;
    // trigger hover event on link
    elm.addEventListener("mouseover", (event) => {
      this.app.workspace.trigger("hover-link", {
        event,
        source: this.constructor.view_type,
        hoverParent: elm.parentElement,
        targetEl: elm,
        linktext: item.path,
      });
    });
  }
  handle_search_result_click(event) {
    event.preventDefault(); // prevent default click behavior
    event.stopPropagation(); // prevent event from bubbling up
    const search_result = event.target.classList.contains(".search-result") ? event.target : event.target.closest(".search-result"); // find parent containing search-result class
    if (event.target instanceof SVGElement) return this.toggle_search_result_visibility(search_result); // if event target element is svg, toggle sc-collapsed class
    // if sc-collapsed class is removed, add click listener to search-result
    if (search_result.classList.contains("sc-collapsed")){
      if(this.plugin.obsidian.Keymap.isModEvent(event)) this.plugin.open_note(search_result.dataset.path, event);
      else this.toggle_search_result_visibility(search_result);
    }else this.plugin.open_note(search_result.dataset.path, event);
  }
  toggle_search_result_visibility(search_result_elm) {
    search_result_elm.classList.toggle("sc-collapsed"); // toggle sc-collapsed class
    this.render_result(search_result_elm.querySelector("li"));
  }

  add_top_bar_listeners(container = this.container) {
    // const top_bar = container.querySelector(".sc-top-bar");
    // const search_button = container.querySelector(".sc-search-button"); // get search button
    // search_button.addEventListener("click", () => {
    //   const og_top_bar = top_bar.innerHTML;
    //   top_bar.empty(); // empty top bar

    //   // create input element
    //   const search_container = top_bar.createEl("div", { cls: "search-input-container" });
    //   const input = search_container.createEl("input", {
    //     cls: "sc-search-input",
    //     type: "search",
    //     placeholder: "Type to start search...",
    //   });
    //   input.focus();
    //   // add keydown listener to input
    //   input.addEventListener("keydown", (event) => {
    //     // if escape key is pressed
    //     if (event.key === "Escape") {
    //       if (this.search_timeout) clearTimeout(this.search_timeout);
    //       top_bar.innerHTML = og_top_bar;
    //       this.add_top_bar_listeners(container);
    //     }
    //   });
    //   // add keyup listener to input
    //   input.addEventListener("keyup", (event) => {
    //     if (this.search_timeout) clearTimeout(this.search_timeout);
    //     const search_term = input.value; // get search term
    //     if (event.key === "Enter" && search_term !== "") this.render_nearest(search_term); // if enter key is pressed

    //     // if any other key is pressed and input is not empty then wait 500ms
    //     else if (search_term !== "") {
    //       if (this.search_timeout) clearTimeout(this.search_timeout);
    //       this.search_timeout = setTimeout(() => this.render_nearest(search_term), 700);
    //     }
    //   });
    // });
    const fold_all_button = container.querySelector(".sc-fold-all"); // get fold all button
    fold_all_button.addEventListener("click", (e) => {
      container.querySelectorAll(".search-result").forEach((elm) => elm.classList.add("sc-collapsed"));
      this.plugin.settings.expanded_view = false;
      this.plugin.save_settings();
    });
    const unfold_all_button = container.querySelector(".sc-unfold-all"); // get unfold all button
    unfold_all_button.addEventListener("click", () => {
      container.querySelectorAll(".search-result").forEach((elm) => {
        elm.classList.remove("sc-collapsed");
        this.render_result(elm.querySelector("li"));
      });
      this.plugin.settings.expanded_view = true;
      this.plugin.save_settings();
    });

    // settings button
    const settings_btn = this.container.querySelector("button[title='Settings']");
    settings_btn.addEventListener("click", async () => {
      const settings_container = this.container.querySelector("#settings");
      // if has contents, clear
      if(settings_container.innerHTML) return settings_container.innerHTML = "";
      // if no settings, create
      if(!this.embed_settings) this.embed_settings = new SmartEmbedSettings(this.env, settings_container);
      else this.embed_settings.container = settings_container;
      this.embed_settings.render();
      // Enhanced transition: smooth background color change with ease-in-out effect
      settings_container.style.transition = "background-color 0.5s ease-in-out";
      settings_container.style.backgroundColor = "var(--bold-color)";
      setTimeout(() => { settings_container.style.backgroundColor = ""; }, 500);
    });
  }
}
exports.ScSmartView = ScSmartView;
