const { ItemView } = require("obsidian");
const views = require("../build/views.json");
const ejs = require("../ejs.min");

// handle rendering EJS views
class SmartObsidianView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.app = plugin.app;
    this.plugin = plugin;
    this.settings = plugin.settings;
    this.templates = views;
    this.ejs = ejs;
  }
  get env() { return this.plugin.env; }
  get config() { return this.plugin.settings; }
  render_template(template_name, data) {
    // console.log("rendering template", template_name);
    if (!this.templates[template_name]) throw new Error(`Template '${template_name}' not found.`);
    return ejs.render(this.templates[template_name], data, { context: this.view_context });
  }
  get view_context() {
    return {
      // app: this.plugin.app,
      attribution: this.templates.attribution,
      get_icon: this.get_icon.bind(this),
      settings: this.plugin.settings,
    };
  }
  async wait_for_env_to_load() {
    if (!this.env?.entities_loaded) {
      // set loading message
      this.containerEl.children[1].innerHTML = "Loading Smart Connections...";
      // wait for entities to be initialized
      while (!this.env?.entities_loaded){
        await new Promise(r => setTimeout(r, 2000));
      }
    }
  }
  get_icon(name) { return this.plugin.obsidian.getIcon(name).outerHTML; }
  static get view_type() { }
  static get_leaf(workspace) { return workspace.getLeavesOfType(this.view_type)?.find((leaf) => leaf.view instanceof this); }
  static get_view(workspace) { return this.get_leaf(workspace)?.view; }
  static open(workspace, active = true) {
    if (this.get_leaf(workspace)) this.get_leaf(workspace).setViewState({ type: this.view_type, active });
    else workspace.getRightLeaf(false).setViewState({ type: this.view_type, active });
    if(workspace.rightSplit.collapsed) workspace.rightSplit.toggle();
  }
  static is_open(workspace) { return this.get_leaf(workspace)?.view instanceof this; }
  get container() { return this.containerEl.children[1]; }
}
exports.SmartObsidianView = SmartObsidianView;
