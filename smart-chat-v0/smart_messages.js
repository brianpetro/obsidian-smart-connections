// import { SmartBlocks } from "smart-sources";
import { SmartBlocks } from "smart-blocks";

/**
 * @class SmartMessages
 * @extends SmartBlocks
 * @description Collection class for managing chat messages
 */
export class SmartMessages extends SmartBlocks {
  /**
   * Override for processing load queue
   * @override
   */
  process_load_queue() { }

  /**
   * Override for processing import queue
   * @override
   */
  process_source_import_queue() { }

  /**
   * @property {string} data_folder - Path to message storage
   * @readonly
   */
  get data_folder() { return this.env.opts.env_path + (this.env.opts.env_path ? "/" : "") + "multi" + "/" + "chats"; }

  /**
   * Override for initialization
   * @override
   */
  init() { }
  
  // disable embed_model for SmartMessages
  get embed_model() { return null; }
  async process_embed_queue() {
    console.log("skipping embed queue processing for SmartMessages");
  }
}
