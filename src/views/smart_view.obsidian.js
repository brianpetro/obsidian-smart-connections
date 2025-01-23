import { ItemView } from "obsidian";

/**
 * Represents a SmartObsidianView for extended functionality.
 * @extends ItemView
 */
export class SmartObsidianView extends ItemView {
  /**
   * Creates an instance of SmartObsidianView.
   * @param {any} leaf
   * @param {any} plugin
   */
  constructor(leaf, plugin) {
    super(leaf);
    this.app = plugin.app;
    this.plugin = plugin;
  }

  /**
   * The unique view type. Must be implemented in subclasses.
   * @returns {string}
   */
  static get view_type() {
    throw new Error("view_type must be implemented in subclass");
  }

  /**
   * The display text for this view. Must be implemented in subclasses.
   * @returns {string}
   */
  static get display_text() {
    throw new Error("display_text must be implemented in subclass");
  }

  /**
   * The icon name for this view.
   * @returns {string}
   */
  static get icon_name() {
    return "smart-connections";
  }

  /**
   * Retrieves the Leaf instance for this view type if it exists.
   * @param {import("obsidian").Workspace} workspace
   * @returns {import("obsidian").WorkspaceLeaf | undefined}
   */
  static get_leaf(workspace) {
    return workspace
      .getLeavesOfType(this.view_type)[0]
  }

  /**
   * Retrieves the view instance if it exists.
   * @param {import("obsidian").Workspace} workspace
   * @returns {SmartObsidianView | undefined}
   */
  static get_view(workspace) {
    const leaf = this.get_leaf(workspace);
    return leaf ? leaf.view : undefined;
  }

  /**
   * Opens the view. If `this.default_open_location` is `'root'`,
   * it will open (or reveal) in a "root" leaf; otherwise, it will
   * open (or reveal) in the right leaf.
   *
   * @param {import("obsidian").Workspace} workspace
   * @param {boolean} [active=true] - Whether the view should be focused when opened.
   */
  static open(workspace, active = true) {
    const existing_leaf = this.get_leaf(workspace);

    if (this.default_open_location === "root") {
      // If there's already a leaf with this view, just set it active.
      // Otherwise, create/open in a leaf in the root (left/main) area.
      if (existing_leaf) {
        existing_leaf.setViewState({ type: this.view_type, active });
      } else {
        workspace.getLeaf(false).setViewState({ type: this.view_type, active });
      }
    } else {
      // If there's already a leaf with this view, just set it active.
      // Otherwise, create/open in the right leaf.
      if (existing_leaf) {
        existing_leaf.setViewState({ type: this.view_type, active });
      } else {
        workspace.getRightLeaf(false).setViewState({
          type: this.view_type,
          active,
        });
      }

      // Reveal the right split if it's collapsed
      if (workspace.rightSplit?.collapsed) {
        workspace.rightSplit.toggle();
      }
    }
  }

  static is_open(workspace) { return this.get_leaf(workspace)?.view instanceof this; }
  // instance
  getViewType() { return this.constructor.view_type; }
  getDisplayText() { return this.constructor.display_text; }
  getIcon() { return this.constructor.icon_name; }
  async onOpen() {
    this.app.workspace.onLayoutReady(this.initialize.bind(this));
  }
  async initialize() {
    await this.wait_for_env_to_load();
    this.container.empty();
    // this.plugin[this.constructor.view_type.replace(/-/g, "_")] = this;
    this.register_plugin_events();
    this.app.workspace.registerHoverLinkSource(this.constructor.view_type, { display: this.getDisplayText(), defaultMod: true });
    this.render_view();
  }
  async wait_for_env_to_load() {
    if (!this.env?.collections_loaded) {
      while(!this.env) {
        // button to load env
        this.containerEl.children[1].innerHTML = '<button>Load Smart Environment</button>';
        this.containerEl.children[1].querySelector('button').addEventListener('click', () => {
          this.plugin.load_env();
        });
        await new Promise(r => setTimeout(r, 2000));
      }
      // wait for entities to be initialized
      while (!this.env.collections_loaded){
        const loading_msg = this.env?.smart_connections_plugin?.obsidian_is_syncing ? "Waiting for Obsidian Sync to finish..." : "Loading Smart Connections...";
        // set loading message
        if(this.containerEl.children[1].innerHTML !== loading_msg){
          this.containerEl.children[1].innerHTML = loading_msg;
        }
        await new Promise(r => setTimeout(r, 2000));
      }
    }
  }
  register_plugin_events() { /* OVERRIDE AS NEEDED */ }
  render_view() { throw new Error("render_view must be implemented in subclass"); }
  get container() { return this.containerEl.children[1]; }
  get env() { return this.plugin.env; }
  get smart_view() {
    if (!this._smart_view) this._smart_view = this.env.init_module('smart_view');
    return this._smart_view;
  }
  get attribution() {
    return `
      <div class="sc-brand">
        <svg viewBox="0 0 100 100" class="svg-icon smart-connections">
          <path d="M50,20 L80,40 L80,60 L50,100" stroke="currentColor" stroke-width="4" fill="none"></path>
          <path d="M30,50 L55,70" stroke="currentColor" stroke-width="5" fill="none"></path>
          <circle cx="50" cy="20" r="9" fill="currentColor"></circle>
          <circle cx="80" cy="40" r="9" fill="currentColor"></circle>
          <circle cx="80" cy="70" r="9" fill="currentColor"></circle>
          <circle cx="50" cy="100" r="9" fill="currentColor"></circle>
          <circle cx="30" cy="50" r="9" fill="currentColor"></circle>
        </svg>
        <p><a style="font-weight: 700;" href="https://smartconnections.app/">Smart Connections</a></p>
      </div>
    `;
  }
}