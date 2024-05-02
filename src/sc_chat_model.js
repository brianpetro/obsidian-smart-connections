const ScTranslations = require("./ScTranslations");
const { SmartChatModel } = require("smart-chat-model");
class ScChatModel extends SmartChatModel {
  async done_handler(full_str) {
    await this.env.chat_ui.new_message(full_str, "assistant");
    this.env.chats.current.add_message({ role: "assistant", content: full_str });
    this.env.chat_ui.clear_streaming_ux(); // redundant when streaming, for completion testing
  }
  async chunk_handler(text_chunk) {
    await this.env.chat_ui.new_message(text_chunk, "assistant", true);
  }
  async request_middlewares(opts) {
    // convert context codeblocks to prompt context
    await Promise.all(opts.messages.map(async (msg, i) => {
      const context_start = "```sc-context";
      // replace lookup tool call with context codeblock (prior to rendering context codeblock as prompt context)
      if (msg.role === "tool" && msg.tool_call_id === "lookup") {
        msg.role = "system";
        msg.content = context_start + "\n" + JSON.parse(msg.content).map(c => c.path).join('\n') + "\n```";
      }
      if (msg.role === "system" && msg.content.includes(context_start)) {
        const context_start_i = msg.content.indexOf(context_start) + context_start.length;
        const context_end_i = msg.content.substring(context_start_i).indexOf("```");
        const raw_contents = msg.content.substring(context_start_i, context_start_i + context_end_i);
        const entities = this.env.plugin.get_entities_from_context_codeblock(raw_contents);
        let context = [];
        let tokens = [];
        await Promise.all(entities.map(async (entity, i) => {
          if (!entity?.get_as_context) return console.log(entity);
          context[i] = await entity.get_as_context({ i });
          tokens[i] = await this.count_tokens(context[i]);
        }));
        let total_tokens = 0;
        let ct = 0;
        context = context
          .reduce((acc, c, i) => {
            if (!c) return acc;
            if (total_tokens + tokens[i] > this.max_input_tokens) return acc;
            total_tokens += tokens[i];
            ct++;
            if (acc) acc += '\n';
            return acc + c;
          }, '');
        msg.content = this.get_prompt_context_prefix({ ct }) + '\n' + context;
      }
      const sys_start = "```sc-system";
      if (msg.role === "system" && msg.content.includes(sys_start)) {
        const sys_start_i = msg.content.indexOf(sys_start) + sys_start.length;
        const sys_end_i = msg.content.substring(sys_start_i).indexOf("```");
        const sys_prompts = msg.content.substring(sys_start_i, sys_start_i + sys_end_i).split('\n').filter(ln => ln.trim());
        console.log(sys_prompts);
        msg.content = "";
        for (const sys_prompt of sys_prompts) {
          const tfile = this.env.system_prompts.find(file => file.basename === sys_prompt);
          const note_content = await this.env.plugin.brain.cached_read(tfile);
          if (msg.content) msg.content += '\n';
          msg.content += note_content;
        }
      }
      return msg;
    }));
    // remove assistant messages without content (including tool calls)
    opts.messages = opts.messages.filter(msg => msg.role !== "assistant" || msg.content);
    console.log(opts.messages);
    return opts;
  }
  get_prompt_context_prefix(params = {}) {
    return `Anticipate the type of answer desired by the user.`
      + ` Imagine the following${params.ct ? " " + params.ct : ""} notes were written by the user and contain all the necessary information to answer the user's question.`
      + ` Begin responses with "${ScTranslations[this.env.plugin.settings.language].prompt}..."`;
  }
}
exports.ScChatModel = ScChatModel;
