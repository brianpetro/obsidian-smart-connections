import { SmartThread as SmartThreadBase } from "./index.js";

export class SmartThread extends SmartThreadBase {
  /**
   * Handles the execution of detected tool calls from a message.
   * Currently supports 'lookup' tool calls. Additional tools can be integrated similarly.
   *
   * @async
   * @param {Array<Object>} tool_calls - Array of tool call objects found in the message.
   * @param {Object} msg_data - Data of the message that triggered these tool calls.
   */
  async handle_tool_calls(tool_calls, msg_data) {
    for (const tool_call of tool_calls) {
      try {
        switch (tool_call.function.name) {
          case 'lookup':
            await this.handle_lookup_tool_call(tool_call, msg_data);
            break;
          default:
            console.warn(`Unhandled tool call: ${tool_call.function.name}`);
            // Optionally, add a system message or inform the user about the unhandled tool
            await this.render_error({ message: `No handler for tool: ${tool_call.function.name}` });
        }
      } catch (error) {
        console.error(`Error handling tool call ${tool_call.function.name}:`, error);
        await this.render_error({ message: `Failed to execute tool: ${tool_call.function.name}`, error });
      }
    }
  }

  /**
   * Handles a 'lookup' tool call by performing a semantic search and storing the results.
   * The results are then added as a tool message in the thread.
   *
   * @async
   * @param {Object} tool_call - The tool call object with function name and arguments.
   * @param {Object} msg_data - The message data that triggered the tool call.
   */
  async handle_lookup_tool_call(tool_call, msg_data) {
    const previous_message = this.messages[this.messages.length - 2];
    const params = this.#build_lookup_params(tool_call.function.arguments, previous_message);

    // Determine lookup collection (blocks or sources)
    const lookup_collection = this.env.smart_blocks.settings.embed_blocks
      ? this.env.smart_blocks
      : this.env.smart_sources;

    const lookup_results = (await lookup_collection.lookup(params)).map(result => ({
      key: result.item.key,
      score: result.score,
    }));

    const msg_i = Object.keys(this.data.messages || {}).length + 1;
    const branch_i = (this.data.branches?.[msg_i] || []).length + 1;

    await this.env.smart_messages.create_or_update({
      thread_key: this.key,
      tool_call_id: tool_call.id,
      tool_name: tool_call.function.name,
      tool_call_output: lookup_results,
      role: 'tool',
      response_id: tool_call.id,
      id: `tool-${msg_i}-${branch_i}`,
    });
  }

  /**
   * Builds parameters for the 'lookup' tool call.
   * @private
   * @param {Object|string} args - Tool call arguments, possibly JSON stringified.
   * @param {Object} previous_message - The previous message in the thread (if any).
   * @returns {Object} Formatted lookup parameters.
   */
  #build_lookup_params(args, previous_message) {
    args = typeof args === 'string' ? JSON.parse(args) : args;
    const params = {};

    params.hypotheticals = this.#normalize_hypotheticals(args, previous_message);
    params.filter = this.#build_lookup_filter(previous_message);

    return params;
  }

  /**
   * Normalizes 'hypotheticals' argument into an array of strings.
   * @private
   * @param {Object} args - Tool call arguments.
   * @param {Object} previous_message - The previous message in the thread (if any).
   * @returns {Array<string>} Normalized hypotheticals.
   */
  #normalize_hypotheticals(args, previous_message) {
    let hypotheticals;

    if (Array.isArray(args.hypotheticals)) {
      hypotheticals = args.hypotheticals;
    } else if (typeof args.hypotheticals === 'object' && args.hypotheticals !== null) {
      hypotheticals = Object.values(args.hypotheticals);
    } else if (typeof args.hypotheticals === 'string') {
      hypotheticals = [args.hypotheticals];
    } else {
      console.warn('Invalid hypotheticals. Using fallback content.');
      const fallback_content = previous_message?.content || 'No context';
      hypotheticals = [fallback_content];
    }

    return hypotheticals.map(h => typeof h === 'string' ? h : JSON.stringify(h));
  }

  /**
   * Builds a filter object for the lookup tool call based on the previous message context.
   * Uses 'key_starts_with' if there is exactly one folder reference.
   * Uses 'key_starts_with_any' if multiple folder references exist.
   * @private
   * @param {Object} previous_message - The previous message in the thread (if any).
   * @returns {Object} The filter object for the lookup.
   */
  #build_lookup_filter(previous_message) {
    const filter = { limit: this.settings.lookup_limit || 10 };
    const folder_refs = previous_message?.context?.folder_refs;

    // If folder references are found in the user's message, use them as filters.
    if (folder_refs && folder_refs.length > 0) {
      if (folder_refs.length === 1) {
        // If exactly one folder reference is found, use key_starts_with
        filter.key_starts_with = folder_refs[0];
      } else {
        // If multiple folder references exist, use key_starts_with_any
        filter.key_starts_with_any = folder_refs;
      }
    }

    console.log('filter', filter);
    return filter;
  }
}
