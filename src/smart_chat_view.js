import { SmartObsidianView2 } from "./smart_obsidian_view2.js";
import { FuzzySuggestModal } from "obsidian";

export class SmartChatsView extends SmartObsidianView2 {
  static get view_type() { return "smart-chat-view"; }
  static get display_text() { return "Smart Chat"; }
  static get icon_name() { return "message-square"; }

  /**
   * Registers plugin-specific events such as file opening and active leaf changes.
   */
  register_plugin_events() {
  }

  /**
   * Renders the chat view for a specific entity (chat thread).
   * @param {string|null} entity - The path or key of the chat thread to render.
   */
  async render_view(thread_key=null) {
    this.container.innerHTML = 'Loading...';
    await this.env.smart_threads.render(this.container, {
      attribution: this.attribution,
      thread_key,
      // callbacks
      open_chat_history: this.open_chat_history.bind(this),
      open_conversation_note: this.open_conversation_note.bind(this),
      open_file_suggestion_modal: this.open_file_suggestion_modal.bind(this),
      open_folder_suggestion_modal: this.open_folder_suggestion_modal.bind(this),
      open_system_prompt_modal: this.open_system_prompt_modal.bind(this),
      open_image_suggestion_modal: this.open_image_suggestion_modal.bind(this),
    });

  }

  /**
   * Opens the chat history view.
   */
  async open_chat_history() {
    // Logic to open chat history
    if (!this._chat_history_selector) this._chat_history_selector = new ScChatHistoryModal(this.plugin.app, this);
    this._chat_history_selector.open();
  }
  open_thread(thread_name) {
    // get full key
    const thread_key = Object.keys(this.env.smart_threads.items).find(key => this.thread_key_to_name(key) === thread_name);
    this.render_view(thread_key);
  }
  thread_key_to_name(thread_key) {
    return thread_key.split('/').pop().split('.').shift();
  }


  /**
   * Opens the conversation note associated with the current chat thread.
   */
  async open_conversation_note() {
    // Logic to open the conversation note
    const current_thread = this.env.smart_threads.get(this.current_context);
    if(current_thread){
      this.plugin.open_note(current_thread.conversation_note_path, { active: true });
    } else {
      this.plugin.notices.show("No Conversation Note Found", "Unable to locate the conversation note for the current chat.");
    }
  }

  /**
   * Handles click events on messages, such as copying to clipboard.
   * @param {Event} event - The click event.
   */
  handle_message_click(event) {
    event.preventDefault();
    event.stopPropagation();
    const message = event.target.classList.contains("sc-message-content") ? event.target : event.target.closest(".sc-message-content");
    
    if (event.target.classList.contains("sc-msg-button")) {
      this.copy_message_to_clipboard(message);
    }
    // TODO: Handle other button clicks (e.g., copy context, copy prompt)
  }

  /**
   * Copies the message content to the clipboard.
   * @param {HTMLElement} message - The message element containing the content.
   */
  copy_message_to_clipboard(message) {
    const content = message.dataset.content;
    navigator.clipboard.writeText(content).then(() => {
      this.plugin.notices.show("Copied to Clipboard", `Message: "${content}" copied successfully.`, { timeout: 2000 });
    }).catch(err => {
      console.error("Failed to copy message: ", err);
      this.plugin.notices.show("Copy Failed", "Unable to copy message to clipboard.", { timeout: 2000 });
    });
  }

  // open file suggestion modal
  open_file_suggestion_modal() {
    // open file suggestion modal
    if (!this.file_selector) this.file_selector = new ScFileSelectModal(this.plugin.app, this);
    this.file_selector.open();
  }
  // open folder suggestion modal
  async open_folder_suggestion_modal() {
    if (!this.folder_selector) {
      const folders = await this.plugin.get_folders();
      this.folder_selector = new ScFolderSelectModal(this.plugin.app, this, folders); // create folder suggestion modal
    }
    this.folder_selector.open(); // open folder suggestion modal
  }
  async open_system_prompt_modal() {
    if (!this.system_prompt_selector) this.system_prompt_selector = new ScSystemPromptSelectModal(this.plugin.app, this);
    this.system_prompt_selector.open();
  }
  async open_image_suggestion_modal() {
    if (!this.image_selector) {
      this.image_selector = new ScImageSelectModal(this.plugin.app, this);
    }
    this.image_selector.open();
  }
  /**
   * Inserts selected text from a suggestion modal into the chat input.
   * @param {string} insert_text - The text to insert.
   */
  insert_selection(insert_text) {
    const textarea = this.container.querySelector(".sc-chat-form textarea");
    let caret_pos = textarea.selectionStart;
    let text_before = textarea.value.substring(0, caret_pos);
    let text_after = textarea.value.substring(caret_pos, textarea.value.length);
    textarea.value = text_before + insert_text + text_after;
    textarea.selectionStart = caret_pos + insert_text.length;
    textarea.selectionEnd = caret_pos + insert_text.length;
    textarea.focus();
  }

}


// File Select Fuzzy Suggest Modal
class ScFileSelectModal extends FuzzySuggestModal {
  constructor(app, view) {
    super(app);
    this.app = app;
    this.view = view;
    this.setPlaceholder("Type the name of a file...");
  }
  // get all markdown files
  getItems() { return this.app.vault.getMarkdownFiles().sort((a, b) => a.basename.localeCompare(b.basename)); }
  getItemText(item) { return item.basename; }
  onChooseItem(file) { this.view.insert_selection(file.basename + "]] "); }
}
// Folder Select Fuzzy Suggest Modal
class ScFolderSelectModal extends FuzzySuggestModal {
  constructor(app, view, folders) {
    super(app);
    this.app = app;
    this.folders = folders;
    this.view = view;
    this.setPlaceholder("Type the name of a folder...");
  }
  getItems() { return this.folders; }
  getItemText(item) { return item; }
  onChooseItem(folder) { this.view.insert_selection(folder + "/ "); }
}
class ScSystemPromptSelectModal extends FuzzySuggestModal {
  constructor(app, view) {
    super(app);
    this.app = app;
    this.view = view;
    this.setPlaceholder("Type the name of a system prompt...");
  }
  getItems() { return this.view.plugin.system_prompts; }
  getItemText(item) { return item.basename; }
  onChooseItem(prompt) { this.view.insert_selection('"' + prompt.path + '"'); }
}
class ScImageSelectModal extends FuzzySuggestModal {
  constructor(app, view) {
    super(app);
    this.app = app;
    this.view = view;
    this.setPlaceholder("Type the name of an image...");
  }

  get image_extensions() {
    return [
      "gif",
      "heic", 
      "heif",
      "jpeg",
      "jpg", 
      "png",
      "webp"
    ];
  }

  getItems() {
    return this.app.vault.getFiles()
      .filter((file) => this.image_extensions.includes(file.extension))
      .sort((a, b) => a.basename.localeCompare(b.basename));
  }

  getItemText(item) { return item.path; }
  
  onChooseItem(image) {
    this.view.insert_selection(`[${image.basename}](${image.path}) `);
  }
}
class ScChatHistoryModal extends FuzzySuggestModal {
  constructor(app, view) {
    super(app);
    this.app = app;
    this.view = view;
    this.setPlaceholder("Type the name of a chat session...");
  }
  // getItems() { return (this.view.files) ? this.view.files : []; }
  // sort alphabetically & then by startsWith UNITITLED
  getItems() {
    return Object.keys(this.view.env.smart_threads.items)
      .map(key => this.view.thread_key_to_name(key))
      .sort((a, b) => a.localeCompare(b))
      .sort((a, b) => b.startsWith("UNTITLED") ? -1 : 1);
  }
  // if not UNTITLED, remove date after last em dash
  getItemText(item) { return (item.indexOf("UNTITLED") === -1) ? item.replace(/—[^—]*$/, "") : item; }
  // onChooseItem(session) { this.view.open_chat(session); }
  onChooseItem(thread_name) { this.view.open_thread(thread_name); }
}