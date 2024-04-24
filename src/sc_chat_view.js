const { SmartObsidianView } = require("./smart_obsidian_view");
class ScChatView extends SmartObsidianView {
  constructor(leaf, plugin) {
    super(leaf, plugin);
    this.plugin = plugin;
    this.env = this.plugin.env;
    this.config = this.plugin.settings;
  }
  static get view_type() { return "smart-connections-chat-view"; }
  getDisplayText() { return "Smart Connections Chat"; }
  getIcon() { return "message-square"; }
  getViewType() { return ScChatView.view_type; }
  async onOpen() { this.app.workspace.onLayoutReady(this.initialize.bind(this)); }
  async initialize() {
    if(!this.env.entities_loaded){
      // set loading message
      this.containerEl.innerHTML = "Loading Smart Connections...";
      // wait for entities to be initialized
      while (!this.env.entities_loaded) await new Promise(r => setTimeout(r, 2000));
    }
    if(this.env.chat_ui) this.env.chat_ui.container = this.containerEl; // set new container if chat_ui exists
    // wait for chats to be initialized
    while (!this.env.chats) await new Promise(r => setTimeout(r, 300));
    await this.env.chats.new();
    this.app.workspace.registerHoverLinkSource(ScChatView.view_type, {
      display: 'Smart Chat Links',
      defaultMod: true,
    });
  }
  onClose() {
    this.app.workspace.unregisterHoverLinkSource(ScChatView.view_type);
  }
}

// EXPORTS
exports.ScChatView = ScChatView;