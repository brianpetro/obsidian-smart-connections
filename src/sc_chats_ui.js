const { SmartChatsUI } = require("smart-chats/smart_chats_ui");
const { ScChatView } = require("./sc_chat_view");
const { FuzzySuggestModal, } = require("obsidian");
const { SmartChatSettings } = require("./smart_chat_settings");

class ScChatsUI extends SmartChatsUI {
  get view_context() {
    return {
      attribution: this.templates.attribution,
      get_icon: this.env.plugin.chat_view.get_icon.bind(this.env.plugin.chat_view),
    };
  }
  get obsidian() { return this.env.plugin.obsidian; }
  show_notice(message) { this.env.plugin.show_notice(message); }
  add_listeners() {
    // chat name input
    const chat_name_input = this.container.querySelector(".sc-chat-name-input");
    chat_name_input.addEventListener("change", (event) => { this.env.chats.current.rename(event.target.value); });
    // open conversation in note button
    const open_in_note_btn = this.container.querySelector("button[title='Open Conversation Note']");
    open_in_note_btn.addEventListener("click", () => {
      const link_path = this.env.chats.current.file_path;
      const link_tfile = this.env.plugin.app.metadataCache.getFirstLinkpathDest(link_path, "/");
      let leaf = this.env.plugin.app.workspace.getLeaf(true);
      leaf.openFile(link_tfile);
    });
    // settings button
    const settings_btn = this.container.querySelector("button[title='Settings']");
    settings_btn.addEventListener("click", async () => {
      const settings_container = this.container.querySelector("#settings");
      // if has contents, clear
      if(settings_container.innerHTML) return settings_container.innerHTML = "";
      // if no settings, create
      if(!this.chat_settings) this.chat_settings = new SmartChatSettings(this.env, settings_container);
      else this.chat_settings.container = settings_container;
      this.chat_settings.render();
      // Enhanced transition: smooth background color change with ease-in-out effect
      settings_container.style.transition = "background-color 0.5s ease-in-out";
      settings_container.style.backgroundColor = "var(--bold-color)";
      setTimeout(() => { settings_container.style.backgroundColor = ""; }, 500);
    });
    // chat history button
    const history_btn = this.container.querySelector("button[title='Chat History']");
    history_btn.addEventListener("click", () => { this.env.chats.open_modal(); });
    // new chat button
    const new_chat_btn = this.container.querySelector("button[title='New Chat']");
    new_chat_btn.addEventListener("click", () => { this.env.chats.new(); });
    // add chat input listeners
    this.add_chat_input_listeners();
  }
  async message_post_process(msg_elm) {
    await this.render_md_as_html(msg_elm);
    this.handle_links_in_message(msg_elm);
    this.add_message_listeners(msg_elm);
  }
  async render_md_as_html(msg_elm) {
    const text_elm = msg_elm.querySelector("span:not(.sc-msg-button)");
    // get from data-content or textContent
    const text = msg_elm.getAttribute("data-content") || text_elm.textContent;
    text_elm.innerHTML = '';
    // await this.obsidian.MarkdownRenderer.renderMarkdown(text, text_elm, '?no-dataview', new this.obsidian.Component());
    await this.obsidian.MarkdownRenderer.render(this.env.plugin.app, text, text_elm, '?no-dataview', new this.obsidian.Component());
  }
  handle_links_in_message(msg_elm) {
    const links = msg_elm.querySelectorAll("a");
    // if this active element contains a link
    if (links.length > 0) {
      for (let i = 0; i < links.length; i++) {
        const link = links[i];
        const link_text = link.getAttribute("data-href");
        // trigger hover event on link
        link.addEventListener("mouseover", (event) => {
          this.env.plugin.app.workspace.trigger("hover-link", {
            event,
            source: ScChatView.view_type,
            hoverParent: link.parentElement,
            targetEl: link,
            // extract link text from a.data-href
            linktext: link_text
          });
        });
        // trigger open link event on link
        link.addEventListener("click", (event) => {
          const link_tfile = this.env.plugin.app.metadataCache.getFirstLinkpathDest(link_text, "/");
          // properly handle if the meta/ctrl key is pressed
          const mod = this.obsidian.Keymap.isModEvent(event);
          // get most recent leaf
          let leaf = this.env.plugin.app.workspace.getLeaf(mod);
          leaf.openFile(link_tfile);
        });
      }
    }
  }
  add_message_listeners(msg_elm) {
    const copy_button = msg_elm.querySelector("span.sc-msg-button[title='Copy message to clipboard']");
    copy_button?.addEventListener("click", (e) => {
      console.log("copy message to clipboard");
      const msg_content_elm = e.target.closest(".sc-message-content");
      console.log(msg_content_elm);
      const msg_content = msg_content_elm.getAttribute("data-content") || msg_content_elm.querySelector("span:not(.sc-msg-button)").textContent;
      console.log(msg_content);
      navigator.clipboard.writeText(msg_content);
      this.env.plugin.show_notice("Message copied to clipboard");
    });
  }
  // open file suggestion modal
  open_file_suggestion_modal() {
    // open file suggestion modal
    if (!this.file_selector) this.file_selector = new ScFileSelectModal(this.env.plugin.app, this.env);
    this.file_selector.open();
  }
  // open folder suggestion modal
  async open_folder_suggestion_modal() {
    if (!this.folder_selector) {
      const folders = await this.env.plugin.get_folders();
      this.folder_selector = new ScFolderSelectModal(this.env.plugin.app, this.env, folders); // create folder suggestion modal
    }
    this.folder_selector.open(); // open folder suggestion modal
  }
  async open_system_prompt_modal() {
    if (!this.system_prompt_selector) this.system_prompt_selector = new ScSystemPromptSelectModal(this.env.plugin.app, this.env);
    this.system_prompt_selector.open();
  }
  add_chat_input_listeners(){
    // register default events in super
    super.add_chat_input_listeners();
    // register custom events
    const chat_input = this.container.querySelector(".sc-chat-form");
    this.brackets_ct = 0;
    this.prevent_input = false;
    chat_input.addEventListener("keyup", this.key_up_handler.bind(this));
  }
  key_down_handler(e) {
    if (e.key === "Enter" && this.is_mod_key) {
      e.preventDefault();
      this.handle_send();
    }
    this.is_mod_key = this.env.plugin.obsidian.Keymap.isModifier(e, "Mod");
  }
  handle_send() {
    const chat_input = this.container.querySelector(".sc-chat-form");
    const textarea = chat_input.querySelector("textarea");
    if (this.prevent_input) {
      this.show_notice("Wait until current response is finished.");
      return;
    }
    // get text from textarea
    let user_input = textarea.value;
    if(!user_input.trim()) return this.env.plugin.notices.show("empty chat input", "Chat input is empty.");
    // clear textarea
    textarea.value = "";
    // initiate response from assistant
    this.env.chats.current.new_user_message(user_input);
    textarea.style.height = 'auto';
    textarea.style.height = (textarea.scrollHeight) + 'px';
  }
  key_up_handler(e){
    this.is_mod_key = false;
    const textarea = this.container.querySelector(".sc-chat-form textarea");
    if(!["/", "@", "["].includes(e.key)) return;
    const caret_pos = textarea.selectionStart;
    // if key is open square bracket
    if (e.key === "[") {
      // if previous char is [
      if (textarea.value[caret_pos - 2] === "[") {
        // open file suggestion modal
        this.open_file_suggestion_modal();
        return;
      }
    } else {
      this.brackets_ct = 0;
    }
    // if / is pressed
    if (e.key === "/") {
      // get caret position
      // if this is first char or previous char is space
      if (textarea.value.length === 1 || textarea.value[caret_pos - 2] === " ") {
        // open folder suggestion modal
        this.open_folder_suggestion_modal();
        return;
      }
    }
    // if @ is pressed
    if (e.key === "@") {
      // console.log("caret_pos", caret_pos);
      // get caret position
      // if this is first char or previous char is space
      if (textarea.value.length === 1 || textarea.value[caret_pos - 2] === " ") {
        // open system prompt suggestion modal
        this.open_system_prompt_modal();
        return;
      }
    }
  }
}
exports.ScChatsUI = ScChatsUI;

// File Select Fuzzy Suggest Modal
class ScFileSelectModal extends FuzzySuggestModal {
  constructor(app, env) {
    super(app);
    this.app = app;
    this.env = env;
    // this.view = view;
    this.setPlaceholder("Type the name of a file...");
  }
  // get all markdown files
  getItems() { return this.app.vault.getMarkdownFiles().sort((a, b) => a.basename.localeCompare(b.basename)); }
  getItemText(item) { return item.basename; }
  onChooseItem(file) { this.env.chat_ui.insert_selection(file.basename + "]] "); }
}
// Folder Select Fuzzy Suggest Modal
class ScFolderSelectModal extends FuzzySuggestModal {
  constructor(app, env, folders) {
    super(app);
    this.app = app;
    this.env = env;
    this.folders = folders;
    // this.view = view;
    this.setPlaceholder("Type the name of a folder...");
  }
  getItems() { return this.folders; }
  getItemText(item) { return item; }
  onChooseItem(folder) { this.env.chat_ui.insert_selection(folder + "/ "); }
}
class ScSystemPromptSelectModal extends FuzzySuggestModal {
  constructor(app, env) {
    super(app);
    this.app = app;
    this.env = env;
    this.setPlaceholder("Type the name of a system prompt...");
  }
  // getItems() { return this.env.system_prompts; }
  getItems() { return this.env.system_prompts; }
  getItemText(item) { return item.basename; }
  onChooseItem(prompt) { this.env.chat_ui.insert_selection('"' + prompt.basename + '"'); }
}