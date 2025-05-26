const { add_content_to_message } = require("./add_content_to_message");

/**
 * Converts a markdown string to a ChatML object. It converts markdown code blocks to tool calls.
 * @param {string} markdown - The markdown string to convert.
 * @returns {Object} The ChatML object representing the markdown.
 */
function markdown_to_chat_ml(markdown) {
  const lines = markdown.split('\n');
  const chat_ml = { messages: [] };
  let current_role = '';
  let tool_name = null;
  let curr_msg = null;
  let is_code_block = false;
  lines.forEach(line => {
    if (tool_name && curr_msg.role === "tool") curr_msg.tool_call_id = tool_name;
    if (line.startsWith('##### ') && !is_code_block) {
      tool_name = null;
      if (curr_msg) chat_ml.messages.push({ ...curr_msg });
      current_role = line.substring(6).trim();
      curr_msg = {
        role: current_role,
      };
    } else if (line.startsWith('```')) {
      is_code_block = !is_code_block;
      if (line.trim().length > 5 && line.trim().indexOf(' ') < 0) {
        tool_name = line.substring(3).trim();
        // return early if tool_name is not a valid tool
        if (tool_name === 'md') return;
        if (['js', 'javascript', 'dataview', 'dataviewjs'].includes(tool_name)) return add_content_to_message(curr_msg, line);
        if (['sc-context', 'sc-system'].includes(tool_name)) return add_content_to_message(curr_msg, line);
        if (curr_msg.role === 'tool') return;
        // add tool call to current message
        if (!curr_msg.tool_calls) curr_msg.tool_calls = [];
        curr_msg.tool_calls.push({
          id: tool_name,
          type: 'function',
          function: {
            name: tool_name,
            arguments: ''
          }
        });
      } else if (['sc-context', 'sc-system', 'md', 'javascript', 'js', 'dataview', 'dataviewjs'].includes(tool_name)) {
        add_content_to_message(curr_msg, line);
      }
    } else if ((line.trim() !== '') && curr_msg) {
      if (tool_name && curr_msg.tool_calls) curr_msg.tool_calls[curr_msg.tool_calls.length - 1].function.arguments += line;
      else if (line.match(/!\[.*?\]\((.*?)\)/)) {
        // Extract image URLs and descriptions from markdown image syntax
        const image_matches = line.matchAll(/^!\[(?<caption>[^\]]*?)\]\((?<imageUrl>[^\)]*?)\)/g);
        const content = [];
        for (const match of image_matches) {
          const caption = match.groups.caption || match.groups.obsidianCaption;
          const imageUrl = match.groups.imageUrl || match.groups.obsidianLink;
          content.push({ type: 'image_url', image_url: { url: imageUrl } });
          if (caption) content.push({ type: 'text', text: `Image caption: ${caption}` });
        }
        add_content_to_message(curr_msg, content);
      }
      else add_content_to_message(curr_msg, line);
    }
  });
  if (curr_msg) chat_ml.messages.push({ ...curr_msg });
  return chat_ml;
}
exports.markdown_to_chat_ml = markdown_to_chat_ml;