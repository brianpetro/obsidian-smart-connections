import { SmartObsidianView } from "../smart_obsidian_view.js";

export class ScChatView extends SmartObsidianView {
  static get view_type() { return "smart-connections-chat-view"; }
  static get display_text() { return "Smart Chat Conversation View"; }
  static get icon_name() { return "message-square"; }
  async onOpen() { this.app.workspace.onLayoutReady(this.initialize.bind(this)); }
  async initialize() {
    await this.wait_for_env_to_load();
    if(this.env.chat_ui) this.env.chat_ui.container = this.container; // set new container if chat_ui exists
    // wait for chats to be initialized
    while (!this.env?.chats) await new Promise(r => setTimeout(r, 300));
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