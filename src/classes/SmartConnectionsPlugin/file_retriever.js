// set module export to be a function to support dependency injection
module.exports = function injectMethod( Obsidian, modifyMe ){

  // inject this method: 
  modifyMe.prototype.file_retriever = async function(link, limits={}) {
    limits = {
      lines: null,
      max_chars: null,
      chars_per_line: null,
      ...limits
    };
    const this_file = this.app.vault.getAbstractFileByPath(link);
    // if file is not found, skip
    if (!(this_file instanceof Obsidian.TAbstractFile)) return false;
    // use cachedRead to get the first 10 lines of the file
    const file_content = await this.app.vault.cachedRead(this_file);
    const file_lines = file_content.split("\n");
    let first_ten_lines = [];
    let is_code = false;
    let char_accum = 0;
    const line_limit = limits.lines || file_lines.length;
    for (let i = 0; first_ten_lines.length < line_limit; i++) {
      let line = file_lines[i];
      // if line is undefined, break
      if (typeof line === 'undefined')
        break;
      // if line is empty, skip
      if (line.length === 0)
        continue;
      // limit length of line to N characters
      if (limits.chars_per_line && line.length > limits.chars_per_line) {
        line = line.slice(0, limits.chars_per_line) + "...";
      }
      // if line is "---", skip
      if (line === "---")
        continue;
      // skip if line is empty bullet or checkbox
      if (['- ', '- [ ] '].indexOf(line) > -1)
        continue;
      // if line is a code block, skip
      if (line.indexOf("```") === 0) {
        is_code = !is_code;
        continue;
      }
      // if char_accum is greater than limit.max_chars, skip
      if (limits.max_chars && char_accum > limits.max_chars) {
        first_ten_lines.push("...");
        break;
      }
      if (is_code) {
        // if is code, add tab to beginning of line
        line = "\t" + line;
      }
      // if line is a heading
      if (line_is_heading(line)) {
        // look at last line in first_ten_lines to see if it is a heading
        // note: uses last in first_ten_lines, instead of look ahead in file_lines, because..
        // ...next line may be excluded from first_ten_lines by previous if statements
        if ((first_ten_lines.length > 0) && line_is_heading(first_ten_lines[first_ten_lines.length - 1])) {
          // if last line is a heading, remove it
          first_ten_lines.pop();
        }
      }
      // add line to first_ten_lines
      first_ten_lines.push(line);
      // increment char_accum
      char_accum += line.length;
    }
    // for each line in first_ten_lines, apply view-specific formatting
    for (let i = 0; i < first_ten_lines.length; i++) {
      // if line is a heading
      if (line_is_heading(first_ten_lines[i])) {
        // if this is the last line in first_ten_lines
        if (i === first_ten_lines.length - 1) {
          // remove the last line if it is a heading
          first_ten_lines.pop();
          break;
        }
        // remove heading syntax to improve readability in small space
        first_ten_lines[i] = first_ten_lines[i].replace(/#+/, "");
        first_ten_lines[i] = `\n${first_ten_lines[i]}:`;
      }
    }
    // join first ten lines into string
    first_ten_lines = first_ten_lines.join("\n");
    return first_ten_lines;
  }
    
  // inject function returns nothing, it just modifies the class

}