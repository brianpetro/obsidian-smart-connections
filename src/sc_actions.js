const ScTranslations = require("./ScTranslations");
const openapi_spec = require('../build/actions_openapi.json');
const handlers = require('./actions/_actions');
const { lookup } = require('./actions/lookup');
const { json_ref_resolve } = require('./json_ref_resolve');

class ScActions {
  constructor(env, opts = {}) {
    this.env = env;
    this.plugin = this.env.plugin;
    this.app = this.plugin.app;
    this.config = this.plugin.settings;
    this.actions = {};
  }
  init(){
    this.parse_actions_from_openapi(openapi_spec)
  }
  prepare_request_body(body) {
    if(this.env.chats?.current.tool_choice) {
      const tool_choice = this.env.chats.current.tool_choice;
      if(body.tool_choice !== 'auto'){
        const tool_json = this.actions[tool_choice]?.json;
        if(tool_json){
          body.tool_choice = {
            type: 'function',
            function: { name: tool_choice },
          };
          body.tools = [tool_json];
        } 
      }else{
        body.tool_choice = 'auto';
        body.tools = this.env.actions.actions.map(t => t.json);
      }
    }
    console.log(body);
    return body;
  }
  // v2.1
  // DO: decided: rename to parse_user_message?
  async new_user_message(user_input) {
    // DO: decided: replace this with og_content input in chat.new_user_message?
    if(Array.isArray(user_input)){
      for(let i = 0; i < user_input.length; i++){
        if(user_input[i].type === "text"){
          await this.new_user_message(user_input[i].text);
        }
      }
      return;
    }
    // if contains self referential keywords or folder reference
    if (this.should_trigger_retrieval(user_input)) {
      console.log("should trigger retrieval");
      if(this.actions.lookup && this.env.chat_model.config.actions){
        // sets current.tool_choice to lookup
        this.env.chats.current.tool_choice = "lookup";
        // adds lookup to body.tools in prepare_request_body
      }else{
        await this.get_context_hyde(user_input); // get hyde
      }
    }
  }
  should_trigger_retrieval(user_input) {
    // if(!this.plugin?.brain?.smart_blocks?.keys.length) return false; // if no smart blocks, return false
    if (this.contains_self_referential_keywords(user_input)) return true;
    if (this.env.chats.current.scope.key_starts_with_any) return true; // if scope.key_starts_with_any is set, return true (has folder reference)
    return false;
  }
  // check if includes keywords referring to one's own notes
  contains_self_referential_keywords(user_input) {
    if (user_input.match(new RegExp(`\\b(${ScTranslations[this.config.language].pronouns.join("|")})\\b`, "gi"))) return true;
    return false;
  }
  // BACKWARD COMPATIBILITY for non-function-calling models (DEPRECATED)
  async get_context_hyde(user_input) {
    console.log("get_context_hyde");
    // count current chat ml messages to determine 'question' or 'chat log' wording
    const hyd_input = `Anticipate what the user is seeking. Respond in the form of a hypothetical note written by the user. The note may contain statements as paragraphs, lists, or checklists in markdown format with no headings. Please respond with one hypothetical note and abstain from any other commentary. Use the format: PARENT FOLDER NAME > CHILD FOLDER NAME > FILE NAME > HEADING 1 > HEADING 2 > HEADING 3: HYPOTHETICAL NOTE CONTENTS.`;
    // complete
    const chatml = [
      { role: "system", content: hyd_input },
      { role: "user", content: user_input }
    ];
    const hyd = await this.env.chat_model.complete(
      {
        messages: chatml,
        stream: false,
        temperature: 0,
        max_tokens: 420,
        // n: 3, // DO: multiple completions (unavailable in Anthropic Claude)
      }, 
      false, // skip render
    );
    this.env.chats.current.add_message({
      role: "assistant",
      tool_calls: [{
        function: {
          name: "lookup",
          arguments: JSON.stringify({ hypotheticals: [hyd] })
        }
      }]
    });
    const results = await lookup(this.env, { hypotheticals: [hyd] });
    await this.env.chats.current.add_tool_output("lookup", results);
    return;
  }
  parse_tool_output(tool_name, tool_output) {
    if(tool_name === "lookup") return parse_lookup_tool_output(tool_output);
  }
  parse_actions_from_openapi(openapi_spec) {
    openapi_spec = json_ref_resolve(openapi_spec);
    Object.entries(openapi_spec.paths)
      .flatMap(([path, methods]) => Object.entries(methods)
        .forEach(([method, spec]) => {
          const { operationId, requestBody, description } = spec;
          this.actions[operationId] = {
            json: {
              type: 'function',
              function: {
                name: operationId,
                description,
                parameters: {
                  type: 'object',
                  properties: requestBody?.content['application/json']?.schema?.properties,
                }
              }
            },
            handler: this.get_handler(operationId, path, method, spec),
            enabled: (operationId === 'lookup' || operationId === 'create_note')
          };
        })
      )
    ;
  }
  get_handler(operationId, path, method, spec) {
    return handlers[operationId];
  }
}
exports.ScActions = ScActions;


/**
 * Parse lookup tool output
 * @param {*} tool_output
 * @description Convert lookup tool output to sc-context markdown code block to prevent duplicating retrieved context in the chat history
 * @returns {object}
 */
function parse_lookup_tool_output(tool_output) {
  let content = "```sc-context\n";
  tool_output.forEach((note, i) => {
    content += `${note.path}\n`;
  });
  content += "```";
  return { role: "system", content };
}