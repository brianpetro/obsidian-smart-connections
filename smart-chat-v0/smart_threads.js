import { SmartSources } from "smart-sources";
import { render as chat_template } from "./components/threads.js";
import { get_language_options, get_initial_message } from "./utils/self_referential_keywords.js";
/**
 * @class SmartThreads
 * @extends SmartSources
 * @description Collection class for managing chat threads. Handles thread creation,
 * rendering, chat model integration, and settings management. Provides centralized
 * control for all chat-related operations.
 */
export class SmartThreads extends SmartSources {
  // /**
  //  * Initializes the file system and preloads chat models
  //  * @async
  //  */
  // async init() {
  //   await this.fs.init();
  // }

  /**
   * Initializes items by setting up the file system and loading sources.
   * @async
   * @returns {Promise<void>}
   */
  async init_items() {
    // ensure source_dir exists
    if(!(await this.fs.exists(this.source_dir))) await this.fs.mkdir(this.source_dir);
    (await this.fs.list(this.source_dir))
      .filter(file => this.source_adapters?.[file.extension]) // Skip files without source adapter
      .forEach(file => {
        const key = file.path.replace(this.source_dir + '/', '').replace('.' + file.extension, '');
        this.items[key] = new this.item_type(this.env, { path: file.path, key });
        this.items[key].source_adapter.import();
      })
    ;
  }

  /**
   * Renders the chat interface
   * @async
   * @param {HTMLElement} [container] - Container element to render into
   * @param {Object} [opts={}] - Rendering options
   * @returns {DocumentFragment} Rendered chat interface
   */
  async render(container=this.container, opts={}) {
    if(Object.keys(opts).length > 0) this.render_opts = opts; // persist render options for future renders (not ideal, but required since declaring render_opts outside of this class)
    if(container && (!this.container || this.container !== container)) this.container = container;
    const frag = await this.env.render_component('smart_chat', this, this.render_opts);
    this.env.smart_view.empty(container);
    container.appendChild(frag);
    return frag;
  }

  get chat_model_settings() {
    if(!this.settings.chat_model) this.settings.chat_model = {};
    return this.settings.chat_model;
  }
  /**
   * @property {Object} chat_model - The AI chat model instance
   * @readonly
   */
  get chat_model() {
    if (!this._chat_model) {
      this._chat_model = this.env.init_module('smart_chat_model', {
        model_config: {},
        settings: this.chat_model_settings,
        env: this.env,
        reload_model: this.reload_chat_model.bind(this),
        re_render_settings: this.re_render_settings.bind(this),
      });
    }
    return this._chat_model;
  }
  reload_chat_model() {
    console.log("reload_chat_model");
    this.chat_model.unload();
    this._chat_model = null;
  }

  get container() { return this._container; }
  set container(container) { this._container = container; }


  /**
   * @property {Object} default_settings - Default configuration for models
   * @readonly
   * @returns {Object} settings - Default settings object containing:
   * @returns {Object} settings.chat_model - Chat model configuration
   * @returns {string} settings.chat_model.adapter - Default adapter
   * @returns {Object} settings.chat_model.openai - OpenAI-specific settings
   * @returns {Object} settings.embed_model - Embedding model configuration
   */
  get default_settings() {
    return {
      chat_model: {
        adapter: 'openai',
        openai: {
          model_key: 'gpt-4o',
          // Allow users to set a custom OpenAI-compatible endpoint and API key
          endpoint_url: '',
          api_key: '',
        },
        // Allow users to configure Ollama host and key (for privately hosted Ollama/OpenAI-compatible servers)
        ollama: {
          endpoint_url: '',
          api_key: '',
        },
      },
      embed_model: {
        model_key: 'None',
      },
    };
  }
  re_render_settings() {
    this.env.smart_view.empty(this.settings_container);
    this.render_settings();
  }

  async render_settings(container=this.settings_container, opts={}) {
    container = await this.render_collection_settings(container, opts);
    const chat_model_frag = await this.env.render_component('settings', this.chat_model, opts);
    container.appendChild(chat_model_frag);
    return container;
  }

  /**
   * @property {Object} settings_config - Processed settings configuration
   * @readonly
   */
  get settings_config() {
    return {
      "language": {
        name: "Language",
        type: "dropdown",
        options_callback: 'get_language_options',
        description: "The language to use for the chat.",
        default: 'en'
      },
      "review_context": {
        name: "Review Context",
        type: "toggle",
        default: false,
        description: "Whether to review the retrieved context before the AI completes the message.",
      },
      "lookup_limit": {
        name: "Lookup Limit",
        type: "number",
        default: 10,
        description: "The maximum number of context items to retrieve via lookup.",
      },
      "send_tool_output_in_user_message": {
        name: "Send Tool Output in User Message",
        type: "toggle",
        default: false,
        description: "Whether to send tool output in the user message.",
      }
    };
  }
  get_language_options() {
    return get_language_options();
  }
  get initial_message() {
    return get_initial_message(this.language);
  }
  get language() { return this.settings.language || 'en'; }

  /**
   * Gets the currently active thread based on the chat box data-thread-key
   * @returns {SmartThread} The active thread
   */
  get_active_thread() {
    const chat_box = this.container?.querySelector('.sc-thread');
    if (!chat_box) return null;
    
    const thread_key = chat_box.getAttribute('data-thread-key');
    if (!thread_key) return null;
    
    return this.get(thread_key);
  }


  queue_save() {
    if(this._queue_process_save) {
      clearTimeout(this._queue_process_save);
      this._queue_process_save = null;
    }
    this._queue_process_save = setTimeout(async () => {
      await this.process_save_queue();
      this._queue_process_save = null;
    }, 3000);
  }
  /**
   * @property {string} data_folder - Path to chat history storage
   * @readonly
   */
  get data_folder() { return this.env.opts.env_path + (this.env.opts.env_path ? "/" : "") + ".smart-env"; }
  get source_dir() { return this.data_folder + "/" + this.collection_key; }

  get fs(){
    if(!this._fs){
      this._fs = super.fs;
      this._fs.excluded_patterns = []; // Clear exclusions to prevent using them
    }
    return this._fs;
  }

  // disable embed_model for SmartThreads
  get embed_model() { return null; }
  async process_embed_queue() {
    console.log("skipping embed queue processing for SmartThreads");
  }
  async process_load_queue() {
    console.log("skipping load queue processing for SmartThreads");
  }
}