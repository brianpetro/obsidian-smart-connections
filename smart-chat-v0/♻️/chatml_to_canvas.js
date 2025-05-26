function chatml_to_canvas(chat_ml) {
  const canvas = {
    nodes: [],
    edges: []
  };

  let y_position = 30;
  const x_position = 30;
  const width = 600;
  const height = 300;
  const vertical_spacing = 150;

  chat_ml.messages.forEach((message, index) => {
    const node_id = `${message.role}-${index + 1}`;
    let node_text = '';

    if (message.role === 'tool' && message.tool_call_id) {
      node_text += `\`\`\`${message.tool_call_id}\n${message.content}\n\`\`\``;
    } else if (message.role === 'assistant' && message.tool_calls) {
        message.tool_calls.forEach(tool_call => {
          node_text += `\`\`\`${tool_call.function.name}\n`;
          try {
            node_text += `${JSON.stringify(JSON.parse(tool_call.function.arguments))}\n`;
          } catch (err) {
            node_text += `${tool_call.function.arguments}\n`;
          }
          node_text += `\`\`\`\n`;
        });

    } else if (Array.isArray(message.content)) {
      message.content.forEach(contentPart => {
        if (contentPart.type === 'image_url') {
          node_text += `![${contentPart.image_url.caption ? contentPart.image_url.caption : ''}](${contentPart.image_url.url})\n`;
        } else if (contentPart.type === 'text') {
          node_text += `${contentPart.text}\n`;
        }
      });
    } else if (typeof message.content === 'string') {
      node_text += message.content;
    }

    canvas.nodes.push({
      id: node_id,
      type: 'text',
      x: x_position,
      y: y_position,
      width: width,
      height: height,
      text: node_text.trim()
    });

    if (index > 0) {
      const from_node_id = `${chat_ml.messages[index - 1].role}-${index}`;
      const to_node_id = node_id;
      canvas.edges.push({
        id: `${from_node_id}-to-${to_node_id}`,
        fromNode: from_node_id,
        fromSide: 'bottom',
        toNode: to_node_id,
        toSide: 'top'
      });
    }

    y_position += height + vertical_spacing;
  });

  return canvas;
}

exports.chatml_to_canvas = chatml_to_canvas;

