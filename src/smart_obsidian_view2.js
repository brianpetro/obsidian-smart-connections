import { ItemView } from "obsidian";
export class SmartObsidianView2 extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.app = plugin.app;
    this.plugin = plugin;
  }
  // static
  static get view_type() { throw new Error("view_type must be implemented in subclass"); }
  static get display_text() { throw new Error("display_text must be implemented in subclass"); }
  static get icon_name() { return "smart-connections"; }
  static get_leaf(workspace) { return workspace.getLeavesOfType(this.view_type)?.find((leaf) => leaf.view instanceof this); }
  static get_view(workspace) { return this.get_leaf(workspace)?.view; }
  static open(workspace, active = true) {
    if (this.get_leaf(workspace)) this.get_leaf(workspace).setViewState({ type: this.view_type, active });
    else workspace.getRightLeaf(false).setViewState({ type: this.view_type, active });
    if(workspace.rightSplit.collapsed) workspace.rightSplit.toggle();
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
      // wait for entities to be initialized
      while (!this.env?.collections_loaded){
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