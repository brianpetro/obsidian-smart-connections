import { SmartChats } from "smart-chats";
import { ScChat } from "./sc_chat.js";
import { FuzzySuggestModal } from "obsidian";

export class ScChats extends SmartChats {
  constructor(env, opts = {}) {
    super(env, opts);
    this.plugin = this.env.plugin;
    this.folder = this.env.settings.smart_chat_folder || this.folder;
    this.chat_class = ScChat;
  }
  async new_user_message(message) {
    // notify users of limited 
    if(this.env.settings.chat_model_platform_key === 'open_router' && !this.env.settings.open_router?.api_key) {
      const free_chat_uses = this.plugin.settings.free_chat_uses ? (this.plugin.settings.free_chat_uses + 1) : 1;
      this.plugin.settings.free_chat_uses = free_chat_uses;
      await this.plugin.save_settings();
      if(free_chat_uses > 20) throw new Error("You have used up your free chat limit! Please add your own API key in the Smart Chat settings to enable unlimited personal usage and prevent exhausting the shared community account limit.");
      else if(free_chat_uses > 2) {
        this.env.plugin.notices.show("shared usage", "Your chats are currently using a community account with very limited usage. Please add your own API key in the Smart Chat settings to enable unlimited personal usage and prevent exhausting the shared account limit.", {immutable: true, timeout: 20000});
      }
    }
    return message;
  }
  // platform specific overrides
  open(key) {
    this.current = this.items[key];
    this.env.chat_ui.init();
  }
  async read(path) { return await this.plugin.app.vault.adapter.read(path); }
  normalize_path(path) { return this.plugin.obsidian.normalizePath(path); }
  async save(path, file_content) { await this.plugin.app.vault.adapter.write(this.normalize_path(path), file_content); }
  async delete(path) { await this.plugin.app.vault.adapter.remove(path); }
  async exists(path) { return await this.plugin.app.vault.adapter.exists(path); }
  async create_folder(path) { return await this.plugin.app.vault.adapter.mkdir(path); }
  async list(path) { return await this.plugin.app.vault.adapter.list(path); }
  // CUSTOM
  open_modal() {
    if (!this.modal) this.modal = new ScChatHistoryModal(this.plugin.app, this.env);
    this.modal.open();
  }
  // // backwords compatibility
  // async import_v1_chats() {
  //   const files = await this.list('.smart-connections/chats');
  //   console.log(files);
  //   for (let i = 0; i < files.files.length; i++) {
  //     const file = files.files[i];
  //     const chat_id = file.replace('.smart-connections/chats/', '').replace('.json', '');
  //     const messages = [];
  //     JSON.parse(await this.read(file))
  //       .map(msg => msg[0])
  //       .forEach(msg => {
  //         if (msg.role === "user") return messages.push({
  //           role: "user",
  //           content: msg.content,
  //         });
  //         if (msg.hyd) messages.push({
  //           role: "assistant",
  //           content: null,
  //           tool_calls: [{
  //             function: {
  //               name: "find_notes",
  //               args: JSON.stringify({ hypotheticals: [msg.hyd] })
  //             }
  //           }]
  //         });
  //         if (msg.context) {
  //           // const context_links = [];
  //           // msg.context.split('\n').forEach((line, i, arr) => {
  //           //   if(line.startsWith('---BEGIN') && arr[i+1]){
  //           //     const breadcrumbs = arr[i+1].replace(': ', '#').split(' > '); // remove last char (:) and split by ' > '
  //           //     const link_path = breadcrumbs.map(breadcrumb => breadcrumb.trim()).join('/');
  //           //     context_links.push(link_path);
  //           //   }
  //           // });
  //           // messages.push({
  //           //   role: "system",
  //           //   content: 'BEGIN NOTES AS CONTEXT:\n[['+context_links.join(']]\n[[')+']]'
  //           // });
  //           messages.push({
  //             role: "system",
  //             content: "```smart-connections\n" + msg.hyd + "\n```"
  //           });
  //           // // get last user message from messages and add again
  //           // const last_user_msg = messages[messages.findLastIndex(m => m.role === "user")];
  //           // messages.push(last_user_msg);
  //         }
  //         if (msg.role === "assistant") return messages.push({
  //           role: "assistant",
  //           content: msg.content,
  //         });
  //       });
  //     console.log(messages);
  //     const convo = this.conversation_format.create(this, chat_id, chat_ml_to_markdown({ messages }));
  //     await convo.save();
  //   }
  // }
}

export class ScChatHistoryModal extends FuzzySuggestModal {
  constructor(app, env) {
    super(app);
    this.app = app;
    this.env = env;
    // this.view = view;
    // this.files = files;
    this.setPlaceholder("Type the name of a chat session...");
  }
  // getItems() { return (this.view.files) ? this.view.files : []; }
  // sort alphabetically & then by startsWith UNITITLED
  getItems() { return Object.keys(this.env.chats.items).sort((a, b) => a.localeCompare(b)).sort((a, b) => b.startsWith("UNTITLED") ? -1 : 1); }
  // if not UNTITLED, remove date after last em dash
  getItemText(item) { return (item.indexOf("UNTITLED") === -1) ? item.replace(/—[^—]*$/, "") : item; }
  // onChooseItem(session) { this.view.open_chat(session); }
  onChooseItem(conversation_id) { this.env.chats.open(conversation_id); }
}