async function render_dataview_codeblocks(file_content, note_path, opts = {}) {
  opts = {
    char_limit: null,
    ...opts
  };
  const dataview_api = window?.["DataviewAPI"]; // use window to get dataview api
  if (!dataview_api) return file_content; // skip if dataview api not found
  if(!file_content) return file_content; // skip if file_content is empty
  const dataview_code_blocks = file_content.match(/```dataview(.*?)```/gs);
  if(!dataview_code_blocks) return file_content; // skip if no dataview code blocks found
  // for each dataview code block
  for (let i = 0; i < dataview_code_blocks.length; i++) {
    // if opts char_limit is less than indexOf dataview code block, break
    if (opts.char_limit && opts.char_limit < file_content.indexOf(dataview_code_blocks[i])) break;
    // get dataview code block
    const dataview_code_block = dataview_code_blocks[i];
    // get content of dataview code block
    const dataview_code_block_content = dataview_code_block.replace("```dataview", "").replace("```", "");
    // get dataview query result
    const dataview_query_result = await dataview_api.queryMarkdown(dataview_code_block_content, note_path, null);
    // if query result is successful, replace dataview code block with query result
    if (dataview_query_result.successful) {
      file_content = file_content.replace(dataview_code_block, dataview_query_result.value);
    }
  }
  return file_content;
}
exports.render_dataview_codeblocks = render_dataview_codeblocks;