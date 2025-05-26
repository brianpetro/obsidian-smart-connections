const { add_content_to_message } = require("./add_content_to_message");

function canvas_to_chatml(canvas) {
  if(typeof canvas === 'string' && canvas.trim()) canvas = JSON.parse(canvas);
  const chat_ml = { messages: [] };

  canvas.nodes?.forEach(node => {
    let current_role = node.id.split('-')[0]; // Assuming the role is the prefix of the id
    let curr_msg = {
      role: current_role,
    };

    const lines = node.text.split('\n');
    let is_code_block = false;
    let tool_name = null;

    lines.forEach(line => {
      if (line.startsWith('```')) {
        is_code_block = !is_code_block;
        if (is_code_block) {
          tool_name = line.substring(3).trim();
          console.log(tool_name + ' ' + curr_msg.role);
          if (is_tool_call(curr_msg.role, tool_name)) {
            console.log('tool call');
            if (!curr_msg.tool_calls) {
              curr_msg.tool_calls = [];
            }
            curr_msg.tool_calls.push({
              id: tool_name,
              type: 'function',
              function: {
                name: tool_name,
                arguments: ''
              }
            });
          }else{
            if(curr_msg.role === 'tool' && line.trim() !== ''){
              curr_msg.tool_call_id = tool_name;
            }else {
              add_content_to_message(curr_msg, line);
            }
          }
        } else {
          if(curr_msg.role !== 'tool' && !curr_msg.tool_calls?.length){
            add_content_to_message(curr_msg, line);
          }
          tool_name = null;
        }
      } else if (is_code_block && is_tool_call(curr_msg.role, tool_name)) {
        console.log(line);
        const last_tool_call = curr_msg.tool_calls[curr_msg.tool_calls.length - 1];
        if(last_tool_call.function.arguments) {
          last_tool_call.function.arguments += '\n';
        }
        last_tool_call.function.arguments += line;
      } else if (line.match(/^!\[(.*?)\]\((.*?)\)$/)) {
        const content = [];
        const match = line.match(/^!\[(.*?)\]\((.*?)\)$/);
        const caption = match[1];
        const imageUrl = match[2];
        content.push({ type: 'image_url', image_url: { url: imageUrl } });
        if(caption) {
          content.push({ type: 'text', text: `Image caption: ${caption}` });
        }
        add_content_to_message(curr_msg, content);
      } else {
        add_content_to_message(curr_msg, line);
      }
    });

    if (Array.isArray(curr_msg.content) && curr_msg.content.length === 1 && curr_msg.content[0].type === 'text') {
      curr_msg.content = curr_msg.content[0].text;
    }

    chat_ml.messages.push(curr_msg);
  });

  return chat_ml;
}
exports.canvas_to_chatml = canvas_to_chatml;

function is_tool_call(role, tool_name) {
  if(role === 'tool') return false;
  if([
    'sc-context',
    'sc-system',
    'js',
    'javascript',
    'dataview',
    'dataviewjs',
    'html', 
    'css', 
    'scss', 
    'less',
    'md'
  ].includes(tool_name)) return false;
  return true;
}

