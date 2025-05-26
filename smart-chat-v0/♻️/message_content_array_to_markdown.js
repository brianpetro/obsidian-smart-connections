function message_content_array_to_markdown(content) {
  let markdown = '';
  content.forEach((c, i) => {
    if (c.type === 'text') {
      if (c.text.startsWith('Image caption: ')) {
        // if last content is image_url, add the image_url to the markdown
        if (content[i - 1]?.type === 'image_url') {
          markdown = markdown.split('\n').slice(0, -2).join('\n');
          markdown += `\n![${c.text.split(':')[1].trim()}](${content[i - 1].image_url.url})`;
        } else {
          markdown += `${c.text}`;
        }
      } else {
        markdown += `${c.text}`;
      }
    } else if (c.type === 'image_url') markdown += `![](${c.image_url.url})`;
    markdown += '\n';
  });
  return markdown.trim();
}
exports.message_content_array_to_markdown = message_content_array_to_markdown;
