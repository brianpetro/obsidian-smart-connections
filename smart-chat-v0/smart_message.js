// import { SmartBlock } from "smart-sources";
import { SmartBlock } from "smart-blocks";
import { render as message_template } from "./components/message";
import { render as context_template } from "./components/context";
import { render as tool_calls_template } from "./components/tool_calls";
import { render as system_message_template } from "./components/system_message";
import { get_translated_context_suffix_prompt, get_translated_context_prefix_prompt } from "./utils/self_referential_keywords";

/**
 * @class SmartMessage
 * @extends SmartBlock
 * @description Represents a single message in a chat thread. Handles content parsing, context extraction,
 * and integration with various data sources including folders, internal links, and system prompts.
 * Supports both text and image content types.
 */
export class SmartMessage extends SmartBlock {
  /**
   * @static
   * @property {Object} defaults - Default data object for a new message
   * @returns {Object}
   */
  static get defaults() {
    return {
      data: {
        thread_key: null,
        content: null,
        role: null,
        tool_calls: null,
        tool_call_id: null,
        msg_i: null,
        id: null,
        context: {},
        tool_call_output: null,
      }
    };
  }

  /**
   * Returns a unique message key based on the thread key and message ID.
   * @returns {string} Unique message identifier.
   */
  get_key() { return `${this.data.thread_key}#${this.id}`; }

  get msg_i() {
    if (!this.data.msg_i) {
      const msg_i = Object.keys(this.thread.data.messages || {}).length + 1;
      this.data.msg_i = msg_i;
    }
    return this.data.msg_i;
  }

  get branch_i() {
    if (!this.data.branch_i) {
      const branch_i = Date.now() + '-' + ((this.thread.data.branches?.[this.msg_i] || []).length + 1);
      this.data.branch_i = branch_i;
    }
    return this.data.branch_i;
  }

  get id() {
    if (!this.data.id) {
      this.data.id = `${this.role}-${this.msg_i}-${this.branch_i}`;
    }
    return this.data.id;
  }

  /**
   * Initializes the message. If the message is from the user, triggers thread completion.
   * If the message represents a tool output and no review is needed, triggers thread completion.
   *
   * @async
   */
  async init() {
    while (!this.thread) await new Promise(resolve => setTimeout(resolve, 100));

    if (!this.thread.data.messages[this.id]) {
      this.thread.data.messages[this.id] = this.msg_i;
      await new Promise(resolve => setTimeout(resolve, 30));
    }

    await this.render();

    if (this.role === 'user') {
      await this.thread.complete();
    } else if (this.role === 'tool' && !this.settings.review_context) {
      this.thread.complete();
    }

    this.queue_save();
  }

  /**
   * Queues the message for saving via the thread.
   */
  queue_save() {
    this._queue_save = true;
    this.thread?.queue_save();
  }

  /**
   * Renders the message interface in the thread UI.
   * Chooses different templates based on message role and presence of tool calls.
   *
   * @async
   * @param {HTMLElement} [container=this.thread.messages_container] - The container element.
   * @returns {Promise<DocumentFragment>} Rendered message fragment.
   */
  async render(container = this.thread.messages_container) {
    let frag;

    if (this.role === 'system') {
      frag = await system_message_template.call(this.smart_view, this);
    } else if (this.tool_calls?.length > 0) {
      frag = await tool_calls_template.call(this.smart_view, this);
    } else if (this.role === 'tool') {
      frag = await this.context_template.call(this.smart_view, this);
    } else {
      frag = await message_template.call(this.smart_view, this);
    }

    if (container) {
      this.elm = container.querySelector(`#${this.data.id}`);
      if (this.elm) {
        this.elm.replaceWith(frag);
      } else {
        container.appendChild(frag);
        await new Promise(resolve => setTimeout(resolve, 30));
      }
    }

    return frag;
  }

  get context_template() {
    return this.env.opts.components.lookup_context
      || context_template;
  }

  /**
   * Converts the message into a request payload that can be sent to the AI model.
   * This involves reading and embedding any referenced content (text or images),
   * and including tool calls or tool call outputs as necessary.
   *
   * @async
   * @returns {Promise<Object>} A request-ready message object.
   */
  async to_request() {
    const this_message = { role: this.role, content: [] };

    // Add contextual internal link content if present
    await this.#append_internal_link_context(this_message);

    // Add main message content (text and images)
    await this.#append_message_content(this_message);

    // Handle tool calls and outputs
    if (this.tool_calls?.length) {
      this_message.tool_calls = this.tool_calls;
      delete this_message.content; 
      // Note: Removing content here due to potential issues in upstream processing
    }

    if (this.tool_call_id) {
      this_message.tool_call_id = this.tool_call_id;
    }

    if (this.tool_call_output?.length) {
      const output_content = await this.tool_call_output_to_request();
      this_message.content = [{ type: 'text', text: output_content }];
    }

    return this_message;
  }

  /**
   * Returns the tool call output as a request-ready string.
   * For the 'lookup' tool, it either returns JSON or formatted text depending on settings.
   *
   * @async
   * @returns {Promise<string>} The tool call output content as a string.
   */
  async tool_call_output_to_request() {
    if (this.tool_name === 'lookup') {
      if (this.settings.tool_call_output_as_json) {
        // Return lookup results as JSON
        const lookup_collection = this.tool_call_output[0]?.key.includes('#')
          ? this.env.smart_blocks
          : this.env.smart_sources;

        const detailed_results = await Promise.all(this.tool_call_output.map(async (result) => ({
          ...result,
          content: (await lookup_collection.get(result.key).read())
        })));
        return JSON.stringify(detailed_results);
      }

      // Return lookup results as formatted text
      const prefix_prompt = get_translated_context_prefix_prompt(this.thread.language);
      let lookup_output = `${prefix_prompt}\n`;
      const lookup_content = await this.fetch_content(this.tool_call_output.map(r => r.key));

      this.tool_call_output.forEach((result, index) => {
        if (lookup_content[index]?.type === 'text') {
          lookup_output += `-----------------------\n`;
          lookup_output += `/${result.key} (relevance score: ${result.score})\n`;
          lookup_output += `---\n${lookup_content[index].content}\n`;
          lookup_output += `-----------------------\n\n`;
        }
      });

      const suffix_prompt = get_translated_context_suffix_prompt(this.thread.language);
      return lookup_output + suffix_prompt;
    }
    return '';
  }

  /**
   * Fetches and processes content referenced by internal links.
   * Can return text or base64 image data depending on the file type.
   *
   * @async
   * @param {Array<string>} paths - Array of paths to fetch content from
   * @returns {Array<Object>} contents - Array of content objects:
   * @returns {string} contents[].type - Content type ('text' or 'image')
   * @returns {string} [contents[].content] - Text content if type is 'text'
   * @returns {string} [contents[].image_url] - Base64 image URL if type is 'image'
   * @throws {Error} When unable to fetch or process content
   */
  async fetch_content(paths) {
    try {
      const image_extensions = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'heic', 'heif', 'ico'];
      const contents = await Promise.all(paths.map(async (path) => {
        if (path) {
          try{
            const item = this.env.smart_blocks.get(path) || this.env.smart_sources.get(path);
            // Check if the link is an image
            const file_extension = path.split('.').pop().toLowerCase();
            if (image_extensions.includes(file_extension)) {
              // DO (future): may return already extracted text if exists in item.data.content
              const image_data = await this.env.smart_sources.fs.read(path, 'base64');
              const base64_image = `data:image/${file_extension};base64,${image_data}`;
              return { type: 'image', image_url: base64_image };
            } else {
              // If not an image, return the text content
              return { type: 'text', content: await item.read() };
            }
          }catch(e){
            console.warn(`Error fetching content for ${path}:`, e);
            return { type: 'error', content: 'Failed to fetch content' };
          }
        }
      }));
      return contents;
    } catch (error) {
      console.error(`Error fetching internal links content:`, error);
      return [];
    }
  }

  /*** Private Helpers ***/

  /**
   * Appends context content for internal links to the request message.
   * @private
   * @async
   * @param {Object} this_message - The message object being prepared for request.
   */
  async #append_internal_link_context(this_message) {
    if (this.context.internal_links?.length > 0) {
      const internal_links_content = await this.fetch_content(this.context.internal_links);

      let context_text = '';
      this.context.internal_links.forEach((link, index) => {
        const content_item = internal_links_content[index];
        if (content_item.type === 'text') {
          if (!context_text.length) context_text += `Context specified in message:\n`;
          context_text += `-----------------------\n`;
          context_text += `/${link}\n---\n${content_item.content}\n`;
          context_text += `-----------------------\n`;
        } else if (content_item.type === 'image') {
          // If image in context, add as image_url
          this_message.content.push({
            type: 'image_url',
            image_url: { url: content_item.image_url },
          });
        } else if (content_item.type === 'unsupported') {
          context_text += `Unsupported content in link: ${link}\n`;
        } else if (content_item.type === 'error') {
          context_text += `Error retrieving content for: ${link}\n`;
        }
      });

      if (context_text.length > 0) {
        this_message.content.push({ type: 'text', text: context_text });
      }
    }
  }

  /**
   * Appends the main message content (user or assistant text and images) to the request message.
   * @private
   * @async
   * @param {Object} this_message - The message object being prepared for request.
   */
  async #append_message_content(this_message) {
    if (typeof this.content === 'string') {
      // Simple text content
      this_message.content.push({ type: 'text', text: this.content });
    } else if (Array.isArray(this.content)) {
      for (const part of this.content) {
        if (part.type === 'text') {
          let text = part.text || '';
          // If text not provided, try reading from provided key
          if (!text && part.input?.key) {
            text = await this.#safe_read_content(part.input.key);
          }
          this_message.content.push({ type: 'text', text });
        } else if (part.type === 'image_url') {
          const base64_img = await this.#safe_read_image(part.input.image_path);
          if (base64_img) {
            this_message.content.push({
              type: 'image_url',
              image_url: { url: base64_img },
            });
          } else {
            this_message.content.push({
              type: 'text',
              text: `Image not found: ${part.input.image_path}`,
            });
          }
        }
      }
    }
  }

  /**
   * Safely reads text content from a given key. Returns an empty string if not found.
   * @private
   * @async
   * @param {string} key - The key to read content from.
   * @returns {Promise<string>} The content read, or an empty string if not found.
   */
  async #safe_read_content(key) {
    let text = await this.env.smart_sources.get(key)?.read() || '';
    if (!text) {
      text = await this.env.smart_sources.fs.read(key) || '';
    }
    return text;
  }

  /**
   * Safely reads and base64-encodes an image from a given path.
   * @private
   * @async
   * @param {string} image_path - The path to the image file.
   * @returns {Promise<string|null>} The base64 data URI if successful, else null.
   */
  async #safe_read_image(image_path) {
    try {
      const extension = image_path.split('.').pop();
      const base64_img = await this.env.smart_sources.fs.read(image_path, 'base64');
      return `data:image/${extension};base64,${base64_img}`;
    } catch {
      return null;
    }
  }

  /**
   * @property {string} content - Message content
   */
  get content() { return this.data.content; }
  set content(value) { this.data.content = value; }

  /**
   * @property {string} role - Message sender role ('user' or 'assistant')
   */
  get role() { return this.data.role; }
  set role(value) { this.data.role = value; }

  /**
   * @property {Object} tool_calls - Tool calls
   */
  get tool_calls() { return this.data.tool_calls; }
  set tool_calls(value) { this.data.tool_calls = value; }

  /**
   * @property {string} tool_call_id - Tool call ID
   */
  get tool_call_id() { return this.data.tool_call_id; }
  set tool_call_id(value) { this.data.tool_call_id = value; }

  /**
   * @property {Array<Object>} tool_call_output - Tool call output
   */
  get tool_call_output() { return this.data.tool_call_output; }
  set tool_call_output(value) { this.data.tool_call_output = value; }

  /**
   * @property {string} tool_name - Tool name
   */
  get tool_name() { return this.data.tool_name; }
  set tool_name(value) { this.data.tool_name = value; }

  /**
   * @property {Object} context - Message context data
   */
  get context() { return this.data.context; }
  set context(value) { this.data.context = value; }


  /**
   * @property {SmartThread} thread - Parent thread reference
   * @readonly
   */
  get thread() { return this.source; }


  /**
   * @property {SmartMessage} next_message - Next message reference
   * @readonly
   */
  get next_message() { return this.thread.messages[this.msg_i]; }

  /**
   * @property {SmartMessage} previous_message - Previous message reference
   * @readonly
   */
  get previous_message() { return this.thread.messages[this.msg_i - 2]; }

  /**
   * @property {boolean} is_last_message - Whether the message is the last message in the thread
   * @readonly
   */
  get is_last_message() { return this.msg_i === Object.keys(this.thread.messages).length; }

  /**
   * @property {string} source_key - Key for source reference
   * @readonly
   */
  get source_key() { return this.data.thread_key; }

  /**
   * @property {SmartThreads} source_collection - Collection reference
   * @readonly
   */
  get source_collection() { return this.env.smart_threads; }

  /**
   * @property {string} path - Path identifier for the message
   * @readonly
   */
  get path() { return this.data.thread_key; }
  get settings() { return this.thread.settings; }
  get has_image() {
    return Array.isArray(this.content) && this.content.some(part => part.type === 'image_url');
  }
}
