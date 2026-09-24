/**
 * Prepare Connections result content for preview rendering without executing
 * embedded dynamic codeblocks or Obsidian embeds.
 * @param {string} content
 * @returns {string}
 */
export function process_for_rendering(content) {
  // prevent dataview rendering
  if (content.includes('```dataview')) content = content.replace(/```dataview/g, '```\\dataview');
  if (content.includes('```smart-context')) content = content.replace(/```smart-context/g, '```\\smart-context');
  if (content.includes('```smart-chatgpt')) content = content.replace(/```smart-chatgpt/g, '```\\smart-chatgpt');
  if (content.includes('```smart-connections')) content = content.replace(/```smart-connections/g, '```\\smart-connections');
  // prevent link embedding
  if (content.includes('![[')) content = content.replace(/!\[\[/g, '! [[');
  return content;
}
