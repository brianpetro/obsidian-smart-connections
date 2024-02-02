const { getIcon, ItemView } = require("obsidian");
const views = require("../build/views.json");
const ejs = require("ejs");

// handle rendering EJS views
class SmartObsidianView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.app = plugin.app;
    this.plugin = plugin;
    this.settings = plugin.settings;
    this.templates = views;
  }
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
  get_icon(name) { return getIcon(name).outerHTML; }
  static get view_type() { }
  static get_leaf(workspace) { return workspace.getLeavesOfType(this.view_type)?.find((leaf) => leaf.view instanceof this); }
  static get_view(workspace) { return this.get_leaf(workspace)?.view; }
  static open(workspace, active = true) {
    if (this.get_leaf(workspace)) this.get_leaf(workspace).setViewState({ type: this.view_type, active });
    else workspace.getRightLeaf(false).setViewState({ type: this.view_type, active });
  }
  static is_open(workspace) { return this.get_leaf(workspace)?.view instanceof this; }
}
exports.SmartObsidianView = SmartObsidianView;
