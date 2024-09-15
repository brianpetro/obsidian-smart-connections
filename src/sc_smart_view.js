import { SmartObsidianView } from "./smart_obsidian_view.js";
import { SmartEmbedSettings } from "./smart_embed_settings.js";
const SUPPORTED_FILE_TYPES = ["md", "canvas"];

export class ScSmartView extends SmartObsidianView {
  static get view_type() { return "smart-connections-view"; }
  // Obsidian
  getViewType() { return this.constructor.view_type; }
  getDisplayText() { return "Smart Connections Files"; }
  getIcon() { return "smart-connections"; }
  async onOpen() { this.app.workspace.onLayoutReady(this.initialize.bind(this)); }
  get template_name() { return "smart_connections"; }
  async initialize() {
    await this.wait_for_env_to_load();
    this.last_parent_id = this.constructor.get_leaf(this.app.workspace)?.parent.id;
    this.container.empty();
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
  }
  // used in brain.save timeout to reset if recent activity (prevent saving blocking UX during user activity)
  update_last_user_activity_timestamp() { this.last_user_activity = Date.now(); }
  // Smart Connections Views
  get view_context() {
    return {
      ...super.view_context,
      blocks_ct: this.env.smart_blocks?.keys.length,
      notes_ct: this.env.smart_sources?.keys.length,
    };
  }
  async prepare_to_render_nearest(container) {
    if (this.overlay_container?.innerHTML) this.overlay_container.innerHTML = "";
    if (!this.env?.collections_loaded) {
      // wait for entities to be initialized
      while (!this.env?.collections_loaded){
        const loading_msg = this.env?.smart_connections_plugin?.obsidian_is_syncing ? "Waiting for Obsidian Sync to finish..." : "Loading Smart Connections...";
        // set loading message
        if(container.innerHTML !== loading_msg){
          container.innerHTML = loading_msg;
        }
        await new Promise(r => setTimeout(r, 2000));
      }
    }
  }
  async render_nearest(context, container = this.container) {
    console.log("render_nearest", context);
    await this.prepare_to_render_nearest(container);
    if (typeof context === "string"){
      const entity = this.env.smart_sources.get(context) || this.env.smart_blocks.get(context);
      if(entity) return this.render_nearest(entity, container); // if entity is found, re render nearest with entity as context
      const results = await this.plugin.api.search(context);
      this.render_results(container, results, { context_key: context });
    }
    if (typeof context === "undefined") context = this.app.workspace.getActiveFile();
    let context_key;
    if (context instanceof this.plugin.obsidian.TFile) {
      context_key = context.path;
      // return if file type is not supported
      if (SUPPORTED_FILE_TYPES.indexOf(context.extension) === -1) return this.plugin.notices.show('unsupported file type', [
        "File: " + context.name,
        "Unsupported file type (Supported: " + SUPPORTED_FILE_TYPES.join(", ") + ")"
      ]);
      if (this.should_import_context(context)) {
        if(this.env.connections_cache?.[context_key]) delete this.env.connections_cache[context_key];
        // check if excluded
        if(this.env.fs.is_excluded(context.path)){
          return this.plugin.notices.show('excluded file', "File is excluded: " + context.path, {timeout: 3000});
        }else{
          await this.env.smart_sources.import_file(context);
        }
      }
      // wait for context.vec (prevent infinite loop)
      while (!context?.vec){
        if(!(context instanceof this.env?.opts.item_types?.SmartSource)){
          const source = this.env.smart_sources.get(context.path)
          if(source) context = source;
        }
        await new Promise(r => setTimeout(r, 1000));
      }
    }
    if(!context?.key) return this.plugin.notices.show('no context', "No context found for rendering Smart Connections.");
    context_key = context.key;
    // Get results
    if (context && (context instanceof this.env.opts.item_types.SmartBlock || context instanceof this.env.opts.item_types.SmartSource)){
      const results = context.find_connections();
      if(results?.length) this.render_results(container, results, { context_key });
      else this.render_results(container, [], { context_key });
      // v2.2
      const {
        re_rank,
        cohere_api_key,
      } = this.smart_connections_view_settings;
      console.log("re-rank", re_rank);
      if(re_rank && typeof this.plugin.re_rank_connections === "function"){
        console.log("re-ranking");
        const re_ranked_results = await this.plugin.re_rank_connections({
          context_entity: context,
          entities: results,
          model: {
            api_key: cohere_api_key,
            model_key: "cohere-rerank-english-v3.0", // $2 per 1k
          }
        });
        if(re_ranked_results?.length){
          this.render_results(container, re_ranked_results, { context_key, re_ranked: true });
        }else console.warn("no re-rank results", context_key, re_ranked_results);
      }
    }
  }
  get smart_connections_view_settings() { return this.env.settings?.smart_view_filter || {}; }
  should_import_context(context) {
    const entity = this.env.smart_sources.get(context.path);
    return !entity || entity.meta_changed;
  }

  render_results(container, results, opts={}) {
    const {
      context_key,
      re_ranked,
    } = opts;
    this.last_note = this.app.workspace.getActiveFile()?.path; // for checking if results are already rendered (ex: on active-leaf-change)
    container.innerHTML = this.render_template(this.template_name, {
      results,
      context_key,
      current_path: context_key,
      re_ranked: re_ranked || false,
    });
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
    const collection_key = elm.dataset.collection;
    const entity = this.env[collection_key].get(entity_key);
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
        this.env.smart_sources.prune();
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
      if (entity.source?.is_canvas) return true;
      if (entity.source?.is_excalidraw) return true;
      return false;
    }
  }
  add_link_listeners(elm, item) {
    elm.addEventListener("click", this.handle_search_result_click.bind(this));
    if(item.path){
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