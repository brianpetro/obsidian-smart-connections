import { SmartSource } from "smart-sources";
import { render as thread_template } from "./components/thread.js";
import { contains_folder_reference, extract_folder_references } from "./utils/folder_references.js";
import {
  contains_internal_link,
  extract_internal_links,
  contains_internal_embedded_link,
  extract_internal_embedded_links
} from "./utils/internal_links.js";
import { contains_self_referential_keywords } from "./utils/self_referential_keywords.js";
import { render as error_template } from "./components/error.js";

/**
 * @class SmartThread
 * @extends SmartSource
 * @description Represents a single chat thread. It manages message history, handles user interactions,
 * integrates with AI models, and maintains the thread state. It supports real-time UI updates,
 * message context management, and tool calls.
 */
export class SmartThread extends SmartSource {
  /**
   * @static
   * @property {Object} defaults - Default configuration for a new thread
   */
  static get defaults() {
    return {
      data: {
        created_at: null,
        responses: {},
        messages: {},
        branches: {},
        path: null,
      }
    };
  }

  // Define available tools
  tools = {
    lookup: {
      type: "function",
      function: {
        name: "lookup",
        description: "Performs a semantic search of the user's data to surface relevant content.",
        parameters: {
          type: "object",
          properties: {
            hypotheticals: {
              type: "object",
              description: "Predicted relevant notes in markdown format. Provide at least three.",
              properties: {
                "1": { type: "string" },
                "2": { type: "string" },
                "3": { type: "string" },
              },
              required: ["1", "2", "3"]
            }
          },
          required: ["hypotheticals"]
        }
      }
    }
  };

  /**
   * Imports the SmartSource by checking for updates and parsing content.
   * @async
   */
  async import() {
    this._queue_import = false;
    try {
      await this.source_adapter.import();
    } catch (err) {
      this.queue_import();
      console.error(err, err.stack);
    }
  }

  /**
   * Renders the thread UI.
   * @async
   * @param {HTMLElement} [container=this.container] - The container element to render into.
   * @param {Object} [opts={}] - Additional rendering options.
   * @returns {Promise<DocumentFragment>} The rendered thread interface.
   */
  async render(container = this.container, opts = {}) {
    const frag = await this.env.render_component('thread', this, opts);
    if (container) {
      container.empty();
      if (container.classList.contains('sc-thread')) {
        container.replaceWith(frag);
      } else {
        container.appendChild(frag);
      }
    }
    return frag;
  }

  /**
   * Handles a new user message by creating a corresponding SmartMessage.
   * This involves parsing the message content for inline references, folder references,
   * and self-referential keywords.
   *
   * @async
   * @param {string} content - The raw text content of the user's message.
   */
  async handle_message_from_user(content) {
    try {
      const new_msg_data = this.#prepare_new_user_message_data(content);
      this.#process_inline_embedded_links(new_msg_data);
      this.#extract_context_from_message_content(new_msg_data);

      await this.env.smart_messages.create_or_update(new_msg_data);
    } catch (error) {
      console.error("Error in handle_message_from_user:", error);
    }
  }

  /**
   * Creates a new system message or updates the last existing system message.
   * Useful for adding guidance or instructions from the system to the user.
   *
   * @async
   * @param {string|Object} system_message - The system message as text or a content object.
   */
  async add_system_message(system_message) {
    if (typeof system_message === 'string') {
      system_message = { type: 'text', text: system_message };
    }
    if (!system_message.type) system_message.type = 'text';

    const last_msg = this.messages[this.messages.length - 1];
    if (last_msg?.role === 'system') {
      // Append to the last system message if it exists
      last_msg.content.push(system_message);
      last_msg.render();
    } else {
      // Otherwise, create a new system message
      await this.env.smart_messages.create_or_update({
        role: 'system',
        content: [system_message],
        thread_key: this.key,
      });
    }
  }

  /**
   * Processes and adds the AI model's response to the thread.
   * If the model's response includes tool calls, they are handled accordingly.
   *
   * @async
   * @param {Object} response - The raw response object from the AI model.
   * @param {Object} [opts={}] - Additional options.
   * @returns {Promise<Array>} Array of created or updated message objects.
   */
  async handle_message_from_chat_model(response, opts = {}) {
    const response_id = response.id;
    if (!response_id) return [];

    const new_messages = [];
    for (const choice of (response.choices || [])) {
      const msg_data = { ...(choice?.message || choice), thread_key: this.key, response_id };
      const existing_msg = this.messages.find(m => m.data.response_id === response_id);
      if (existing_msg) msg_data.key = existing_msg.key; // Reuse key if message already exists

      const new_msg = await this.env.smart_messages.create_or_update(msg_data);
      new_messages.push(new_msg);

      // If there are tool calls in the message, handle them
      if (msg_data.tool_calls?.length > 0) {
        await this.handle_tool_calls(msg_data.tool_calls, msg_data);
        // Initialize the message after handling tool calls to trigger follow-up logic
        await new_msg.init();
      }
    }

    return new_messages;
  }

  /**
   * Handles the execution of detected tool calls from a message.
   * This is a base implementation that should be overridden by subclasses
   * to provide specific tool handling logic.
   * 
   * @async
   * @param {Array<Object>} tool_calls - Array of tool call objects found in the message
   * @param {Object} msg_data - Data of the message that triggered these tool calls
   */
  async handle_tool_calls(tool_calls, msg_data) {
    console.warn('handle_tool_calls() not implemented in base class');
    // Subclasses should override this method to implement specific tool handling logic
  }

  /**
   * Converts the entire thread state into a request payload for the AI model.
   * This involves collecting all messages and optionally adding tool definitions and choices.
   *
   * @async
   * @returns {Promise<Object>} The request object ready to be sent to the AI model.
   */
  async to_request() {
    const request = { messages: [] };

    for (let i = 0; i < this.messages.length; i++) {
      const msg = this.messages[i];
      // If configured, handle tool output inclusion before adding the message
      if (this.settings.send_tool_output_in_user_message){
        if (this.#should_include_tool_output(msg)) {
          // Insert the next tool output message into the user message content
          const combined_msg = await this.#combine_user_and_tool_output(msg);
          request.messages.push(combined_msg);
          continue;
        }
        if(msg.role === 'assistant' && msg.tool_calls?.length){
          // skip when sending tool output in user message
          continue;
        }
        if(msg.role === 'tool'){
          // skip when sending tool output in user message
          continue;
        }
      }


      // Normal case: push the message as is
      request.messages.push(await msg.to_request());

      // If the message context requires tool usage, define tools
      if (msg.context?.has_self_ref || msg.context?.folder_refs) {
        request.tools = [this.tools['lookup']];
        if (msg.is_last_message && msg.role === 'user') {
          request.tool_choice = { type: "function", function: { name: "lookup" } };
        }
      }
    }
    // if last message role is tool and send_tool_output_in_user_message is true, remove tools
    if(this.last_message_is_tool && this.settings.send_tool_output_in_user_message){
      request.tools = null;
    }
    if(this.last_message_is_tool){
      // request.tool_choice = 'none';
      delete request.tool_choice;
    }

    // Set default AI model parameters
    request.temperature = 0.3;
    request.top_p = 1;
    request.presence_penalty = 0;
    request.frequency_penalty = 0;

    // If the last message is a tool_call_output, ensure the last user message is at the end
    this.#reorder_last_user_message_if_needed(request);

    return request;
  }

  get last_message_is_tool(){
    const last_msg = this.messages[this.messages.length - 1];
    return last_msg?.role === 'tool';
  }

  /**
   * Sends the current thread state to the AI model for completion.
   * Handles streaming and non-streaming responses, as well as errors.
   *
   * @async
   */
  async complete() {
    this.show_typing_indicator();
    const request = await this.to_request();

    // Use streaming if available and no immediate tool calls are requested
    const should_stream = this.chat_model.can_stream && (!request.tool_choice || request.tool_choice === 'none');
    if (should_stream) {
      await this.chat_model.stream(request, {
        chunk: this.chunk_handler.bind(this),
        done: this.done_handler.bind(this),
        error: this.error_handler.bind(this),
      });
    } else {
      // Non-streaming fallback
      const response = await this.chat_model.complete(request);
      if (response.error) {
        return this.error_handler(response);
      }
      this.data.responses[response.id] = response;
      await this.handle_message_from_chat_model(response);
    }

    this.hide_typing_indicator();
  }

  /**
   * Handles partial chunks of a streaming response from the model.
   * @async
   * @param {Object} response - The partial response chunk from the model.
   */
  async chunk_handler(response) {
    const msg_items = await this.handle_message_from_chat_model(response);
    if (msg_items?.length > 0) await msg_items[0].render();
  }

  /**
   * Handles the final event of a streaming response from the model.
   * @async
   * @param {Object} response - The final response object from the model.
   */
  async done_handler(response) {
    const msg_items = await this.handle_message_from_chat_model(response);
    this.data.responses[response.id] = response;
    if (msg_items.length > 0) await msg_items[0].init();
  }

  /**
   * Handles error responses from the model, rendering an error message in the thread.
   * @param {Object} response - The error response object.
   */
  error_handler(response) {
    this.hide_typing_indicator();
    this.render_error(response);
    console.error('error_handler', response);
  }

  /**
   * Renders an error message in the UI.
   * @async
   * @param {Object} response - The error response object.
   * @param {HTMLElement} [container=this.messages_container] - Container element for the error.
   * @returns {Promise<DocumentFragment>}
   */
  async render_error(response, container = this.messages_container) {
    const frag = await error_template.call(this.smart_view, response);
    if (container) container.appendChild(frag);
    return frag;
  }

  /**
   * @deprecated temp handling until SmartThreads/SmartChats v2
   */
  get file_type(){
    return 'json';
  }

  /*** Private Helpers ***/

  /**
   * Prepares initial data for a new user message.
   * @private
   * @param {string} content - The raw user-provided content.
   * @returns {Object} The data object for the new message.
   */
  #prepare_new_user_message_data(content) {
    return {
      thread_key: this.key,
      role: 'user',
      content: [{ type: 'text', text: content.trim() }],
      context: {},
    };
  }

  /**
   * Processes inline embedded links (e.g., ![[link]]) within the user message.
   * Replaces them with separate message parts (text or images).
   * @private
   * @param {Object} new_msg_data - The message data object to modify.
   */
  #process_inline_embedded_links(new_msg_data) {
    for (let i = 0; i < new_msg_data.content.length; i++) {
      const part = new_msg_data.content[i];
      if (part.type !== 'text' || !part.text) continue;

      if (contains_internal_embedded_link(part.text)) {
        const internal_links = extract_internal_embedded_links(part.text);

        for (const [full_match, link_path] of internal_links) {
          const [before, after] = part.text.split(full_match);
          const embedded_part = this.#create_embedded_part(link_path);

          part.text = after;
          // Insert before text and embedded content
          if (before?.trim()?.length) {
            new_msg_data.content.splice(i, 0,
              { type: 'text', text: before },
              embedded_part
            );
          } else {
            new_msg_data.content.splice(i, 0, embedded_part);
          }
        }
      }
    }
  }

  /**
   * Creates an embedded part object (image or text) from an embedded link path.
   * @private
   * @param {string} link_path - The path to the embedded content.
   * @returns {Object} The embedded part object.
   */
  #create_embedded_part(link_path) {
    const is_image = ['png', 'jpg', 'jpeg'].some(ext => link_path.endsWith(ext));
    if (is_image) {
      return { type: 'image_url', input: { image_path: link_path } };
    } else {
      const resolved_path = this.env.smart_sources.fs.get_link_target_path(link_path, '/');
      return { type: 'text', input: { key: resolved_path } };
    }
  }

  /**
   * Extracts and attaches relevant context from the message content.
   * @private
   * @param {Object} new_msg_data - The message data object to modify.
   */
  #extract_context_from_message_content(new_msg_data) {
    for (let i = 0; i < new_msg_data.content.length; i++) {
      const part = new_msg_data.content[i];
      if (part.type !== 'text' || !part.text) continue;

      // Extract internal links ([[link]])
      if (contains_internal_link(part.text)) {
        const internal_links = extract_internal_links(part.text);
        new_msg_data.context.internal_links = internal_links.map(
          link => this.env.smart_sources?.fs?.get_link_target_path(link, '/') || link
        );
      }

      // Extract folder references (/folder/subfolder/)
      if (contains_folder_reference(part.text)) {
        const folders = Object.keys(this.env.smart_sources.fs.folders);
        const folder_refs = extract_folder_references(folders, part.text);
        new_msg_data.context.folder_refs = folder_refs;
      }

      // Detect self-referential keywords
      if (contains_self_referential_keywords(part.text, this.language)) {
        new_msg_data.context.has_self_ref = true;
      }
    }
  }

  /**
   * Determines if we should include tool output in the user message based on configuration.
   * @private
   * @param {SmartMessage} msg - The current message being processed.
   * @returns {boolean} True if tool output should be included, false otherwise.
   */
  #should_include_tool_output(msg) {
    return msg.role === 'user' &&
      msg.next_message?.tool_calls?.length &&
      !msg.next_message.is_last_message &&
      msg.next_message.next_message?.role === 'tool';
  }

  /**
   * Combines the user message with the subsequent tool output, embedding the tool output
   * in the user message request.
   * @private
   * @param {SmartMessage} msg - The user message before the tool output.
   * @returns {Promise<Object>} A message object that includes the tool output followed by the user content.
   */
  async #combine_user_and_tool_output(msg) {
    const message = { role: 'user', content: [] };
    const tool_output = await msg.next_message.next_message.tool_call_output_to_request();
    message.content.push({ type: 'text', text: tool_output });
    const user_content = await msg.to_request();
    if (user_content.content) {
      message.content.push(...user_content.content);
    }
    return message;
  }

  /**
   * Ensures the last user message is placed at the end of the request if the last message is a tool output.
   * @private
   * @param {Object} request - The request object being built.
   */
  #reorder_last_user_message_if_needed(request) {
    if (request.messages[request.messages.length - 1]?.tool_call_id) {
      const last_user_msg_index = request.messages.findLastIndex(msg => msg.role === 'user');
      if (last_user_msg_index !== -1 && last_user_msg_index !== request.messages.length - 1) {
        const last_user_msg = request.messages.splice(last_user_msg_index, 1)[0];
        request.messages.push(last_user_msg);
        console.log('Moved last user message to the end of the request for better context handling.');
      }
    }
  }

  /**
   * Shows the typing indicator in the thread UI.
   */
  show_typing_indicator() {
    const indicator = this.container?.querySelector('.sc-typing-indicator');
    if (indicator) indicator.classList.add('visible');
  }

  /**
   * Hides the typing indicator in the thread UI.
   */
  hide_typing_indicator() {
    const indicator = this.container?.querySelector('.sc-typing-indicator');
    if (indicator) indicator.classList.remove('visible');
  }

  /*** Getters and Utility Properties ***/

  get chat_model() { return this.collection.chat_model; }

  get created_at() {
    if (!this.data.created_at) this.data.created_at = Date.now();
    return this.data.created_at;
  }

  /**
   * @property {HTMLElement} container - Container element for the thread UI
   */
  get container() {
    return this.collection.container?.querySelector('.sc-thread');
  }

  get messages_container() { return this.container?.querySelector('.sc-message-container'); }
  /**
   * @property {Array<SmartMessage>} messages - All messages in the thread
   * @readonly
   */
  get messages() {
    return Object.entries(this.data.messages || {})
      .sort((a, b) => a[1] - b[1])
      .map(([key]) => this.env.smart_messages.get(this.key + '#' + key));
  }
  /**
   * @alias {Array<SmartMessage>} messages
   * @readonly
   */
  get blocks() { return this.messages; }

  get_key() {
    if (!this.data.key) this.data.key = 'Untitled ' + this.created_at;
    return this.data.key;
  }
  /**
   * @property {string} path - Path identifier for the thread
   * @readonly
   */
  get path() {
    if (!this.data.path) {
      this.data.path = this.collection.source_dir + '/' + this.key + '.' + this.source_adapter.extension;
    }
    return this.data.path;
  }

  get language() { return this.settings.language || 'en'; }

  /**
   * Processes base64 encoding for image files
   * @async
   * @param {string} file_path - Path to the image file
   * @returns {string} Base64 encoded image data URL
   */
  async process_image_to_base64(file_path) {
    const file = this.env.smart_connections_plugin?.app.vault.getFileByPath(file_path);
    if (!file) return null;

    const base64 = await this.env.smart_sources.fs.read(file.path, 'base64');
    return `data:image/${file.extension};base64,${base64}`;
  }
  /**
   * Queues the thread for saving via the collection.
   * @returns {void}
   */
  queue_save() {
    if (this.messages.length === 0) return;
    this._queue_save = true;
    this.collection?.queue_save();
  }

  async save() {
    await this.source_adapter.save();
  }

  async rename(new_name) {
    await this.source_adapter.rename(new_name);
  }

  /**
   * Get all branches for a specific message index
   * @param {number} msg_i - Message index to get branches for
   * @returns {Array<Object>} Array of branch message objects
   */
  get_branches(msg_i) {
    return this.data.branches?.[msg_i] || [];
  }

  /**
   * Get the latest branch for a specific message index
   * @param {number} msg_i - Message index to get latest branch for
   * @returns {Object|null} Latest branch message object or null if no branches exist
   */
  get_latest_branch(msg_i) {
    const branches = this.get_branches(msg_i);
    return branches.length > 0 ? branches[branches.length - 1] : null;
  }

  /**
   * Create a new branch from a specific message index
   * @param {number} msg_i - Message index to branch from
   * @param {Object} branch_messages - Messages to store in the branch
   */
  create_branch(msg_i, branch_messages) {
    if (!this.data.branches) this.data.branches = {};
    if (!this.data.branches[msg_i]) this.data.branches[msg_i] = [];
    this.data.branches[msg_i].push(branch_messages);
    this.queue_save();
  }

  move_to_branch(msg_i, branch_messages) {
    this.create_branch(msg_i, branch_messages);
    Object.keys(branch_messages).forEach(id => delete this.data.messages[id]);
    this.queue_save();
  }

  /**
   * Cycles to the next branch for a given message index
   * @param {number} msg_i - Message index to cycle branches for
   * @returns {Promise<void>}
   */
  async cycle_branch(msg_i) {
    if (!this.data.branches) this.data.branches = {};
    if (!this.data.branches[msg_i]) this.data.branches[msg_i] = [];
    
    // Get current branch index (1 is main branch)
    const current_msg = this.messages.find(msg => this.data.messages[msg.id] === msg_i);
    if (!current_msg) return console.warn('no current message found for msg_i', msg_i);

    // Get current messages state including the message at msg_i
    const current_messages = Object.entries(this.data.messages)
      .filter(([_, _msg_i]) => _msg_i >= msg_i)
      .reduce((acc, [id, _msg_i]) => ({ ...acc, [id]: _msg_i }), {})
    ;

    this.move_to_branch(msg_i, current_messages);
    const branch = this.data.branches?.[msg_i]?.shift();
    this.data.messages = {
      ...this.data.messages,
      ...branch,
    };
    await this.render();
    this.queue_save();
  }
}
