const ScTranslations = require("./ScTranslations");
const openapi_spec = require('../build/actions_openapi.json');
const handlers = require('./actions/_actions');
const { lookup } = require('./actions/lookup');

class ScActions {
  constructor(env, opts = {}) {
    this.env = env;
    this.plugin = this.env.plugin;
    this.app = this.plugin.app;
    this.config = this.plugin.settings;
    this.actions = {};
  }
  init(){
    const actions = Object.entries(openapi_spec.paths)
      .flatMap(([path, methods]) => Object.entries(methods)
        .map(([method, {operationId, requestBody, description}]) => ({
          type: 'function',
          function: {
            name: operationId,
            description,
            parameters: {
              type: 'object',
              properties: requestBody?.content['application/json']?.schema?.properties,
            }
          }
        }))
      )
    ;
    actions.forEach(action => {
      // const { [action.function.name]: handler } = handlers[action.function.name];
      this.actions[action.function.name] = {
        json: action,
        handler: handlers[action.function.name].bind(null, this.env),
      }
    });
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
  async new_user_message(user_input) {
    this.env.chats.current.scope = {}; // reset scope
    // if contains internal link represented by [[link]]
    if (contains_internal_link(user_input)) {
      const notes = this.extract_internal_links(user_input);
      console.log(notes);
      if (notes.length) {
        const context = '```sc-context\n' + notes.map(n => `${n.path}`).join('\n') + '\n```';
        await this.env.chats.current.add_message({ role: "system", content: context });
      }
    }
    // if contains folder reference represented by /folder/
    if (contains_folder_reference(user_input)) { // tested
      const folders = await this.plugin.get_folders(); // get folder references
      const folder_refs = extract_folder_references(folders, user_input);
      // if folder references are valid (string or array of strings)
      if (folder_refs) this.env.chats.current.scope.key_starts_with_any = folder_refs;
    }
    // if contains self referential keywords or folder reference
    if (this.should_trigger_retrieval(user_input)) {
      console.log("should trigger retrieval");
      // DO: deprecated/removed SmartView open requirement
      if (!this.plugin.is_smart_view_open()) {
        const btn = { text: "Open Smart View", callback: () => this.plugin.open_view(false) };
        this.plugin.show_notice("Smart View must be open to utilize all Smart Chat features. For example, asking things like \"Based on my notes...\" requires Smart View to be open.", { button: btn, timeout: 0 });
      }
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
    if (contains_folder_reference(user_input)) return true;
    return false;
  }
  // check if includes keywords referring to one's own notes
  contains_self_referential_keywords(user_input) {
    if (user_input.match(new RegExp(`\\b(${ScTranslations[this.config.language].pronouns.join("|")})\\b`, "gi"))) return true;
    return false;
  }
  // extract internal links
  extract_internal_links(user_input) {
    const matches = user_input.match(/\[\[(.*?)\]\]/g);
    console.log(matches);
    // return array of TFile objects
    if (matches) return matches.map(match => {
      return this.plugin.app.metadataCache.getFirstLinkpathDest(match.replace("[[", "").replace("]]", ""), "/");
    });
    return [];
  }
  // BACKWARD COMPATIBILITY for non-function-calling models
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

// check if contains internal link
function contains_internal_link(user_input) {
  if (user_input.indexOf("[[") === -1) return false;
  if (user_input.indexOf("]]") === -1) return false;
  return true;
}
exports.contains_internal_link = contains_internal_link;

// check if contains folder reference (ex. /folder/, or /folder/subfolder/)
function contains_folder_reference(user_input) {
  if (user_input.indexOf("/") === -1) return false;
  if (user_input.indexOf("/") === user_input.lastIndexOf("/")) return false;
  // returns false if slash is wrapped in parentheses
  if (user_input.indexOf("(") !== -1 && user_input.indexOf(")") !== -1){
    const start = user_input.indexOf("(");
    const end = user_input.indexOf(")");
    // remove content in parentheses
    const without_content_in_parentheses = user_input.slice(0, start) + user_input.slice(end+1);
    if (without_content_in_parentheses.indexOf("/") !== -1) return false;
    if (without_content_in_parentheses.indexOf("/") === without_content_in_parentheses.lastIndexOf("/")) return false;
  }
  return true;
}
exports.contains_folder_reference = contains_folder_reference;

// get folder references from user input
function extract_folder_references(folders, user_input) {
  // use this.folders to extract folder references by longest first (ex. /folder/subfolder/ before /folder/) to avoid matching /folder/subfolder/ as /folder/
  folders = folders.slice(); // copy folders array
  const matches = folders.sort((a, b) => b.length - a.length).map(folder => {
    // check if folder is in user_input
    if (user_input.indexOf(folder) !== -1) {
      // remove folder from user_input to prevent matching /folder/subfolder/ as /folder/
      user_input = user_input.replace(folder, "");
      return folder;
    }
    return false;
  }).filter(folder => folder);
  console.log(matches);
  // return array of matches
  if (matches) return matches;
  return false;
}
exports.extract_folder_references = extract_folder_references;