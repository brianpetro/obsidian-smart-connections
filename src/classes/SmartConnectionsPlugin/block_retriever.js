// set module export to be a function to support dependency injection
module.exports = function injectMethod( Obsidian, modifyMe ){

  // inject this method: 
  modifyMe.prototype.block_retriever = async function(path, limits={}) {
    limits = {
      lines: null,
      chars_per_line: null,
      max_chars: null,
      ...limits
    }
    // return if no # in path
    if (path.indexOf('#') < 0) {
      console.log("not a block path: "+path);
      return false;
    }
    let block = [];
    let block_headings = path.split('#').slice(1);
    // if path ends with number in curly braces
    let heading_occurrence = 0;
    if(block_headings[block_headings.length-1].indexOf('{') > -1) {
      // get the occurrence number
      heading_occurrence = parseInt(block_headings[block_headings.length-1].split('{')[1].replace('}', ''));
      // remove the occurrence from the last heading
      block_headings[block_headings.length-1] = block_headings[block_headings.length-1].split('{')[0];
    }
    let currentHeaders = [];
    let occurrence_count = 0;
    let begin_line = 0;
    let i = 0;
    // get file path from path
    const file_path = path.split('#')[0];
    // get file
    const file = this.app.vault.getAbstractFileByPath(file_path);
    if(!(file instanceof Obsidian.TFile)) {
      console.log("not a file: "+file_path);
      return false;
    }
    // get file contents
    const file_contents = await this.app.vault.cachedRead(file);
    // split the file contents into lines
    const lines = file_contents.split('\n');
    // loop through the lines
    let is_code = false;
    for (i = 0; i < lines.length; i++) {
      // get the line
      const line = lines[i];
      // if line begins with three backticks then toggle is_code
      if(line.indexOf('```') === 0) {
        is_code = !is_code;
      }
      // if is_code is true then add line with preceding tab and continue
      if(is_code) {
        continue;
      }
      // skip if line is empty bullet or checkbox
      if(['- ', '- [ ] '].indexOf(line) > -1) continue;
      // if line does not start with #
      // or if line starts with # and second character is a word or number indicating a "tag"
      // then continue to next line
      if (!line.startsWith('#') || (['#',' '].indexOf(line[1]) < 0)){
        continue;
      }
      /**
       * BEGIN Heading parsing
       * - likely a heading if made it this far
       */
      // get the heading text
      const heading_text = line.replace(/#/g, '').trim();
      // continue if heading text is not in block_headings
      const heading_index = block_headings.indexOf(heading_text);
      if (heading_index < 0) continue;
      // if currentHeaders.length !== heading_index then we have a mismatch
      if (currentHeaders.length !== heading_index) continue;
      // push the heading text to the currentHeaders array
      currentHeaders.push(heading_text);
      // if currentHeaders.length === block_headings.length then we have a match
      if (currentHeaders.length === block_headings.length) {
        // if heading_occurrence is defined then increment occurrence_count
        if(heading_occurrence === 0) {
          // set begin_line to i + 1
          begin_line = i + 1;
          break; // break out of loop
        }
        // if occurrence_count !== heading_occurrence then continue
        if(occurrence_count === heading_occurrence){
          begin_line = i + 1;
          break; // break out of loop
        }
        occurrence_count++;
        // reset currentHeaders
        currentHeaders.pop();
        continue;
      }
    }
    // if no begin_line then return false
    if (begin_line === 0) return false;
    // iterate through lines starting at begin_line
    is_code = false;
    // character accumulator
    let char_count = 0;
    for (i = begin_line; i < lines.length; i++) {
      if((typeof line_limit === "number") && (block.length > line_limit)){
        block.push("...");
        break; // ends when line_limit is reached
      }
      let line = lines[i];
      if ((line.indexOf('#') === 0) && (['#',' '].indexOf(line[1]) !== -1)){
        break; // ends when encountering next header
      }
      // DEPRECATED: should be handled by new_line+char_count check (happens in previous iteration)
      // if char_count is greater than limit.max_chars, skip
      if (limits.max_chars && char_count > limits.max_chars) {
        block.push("...");
        break;
      }
      // if new_line + char_count is greater than limit.max_chars, skip
      if (limits.max_chars && ((line.length + char_count) > limits.max_chars)) {
        const max_new_chars = limits.max_chars - char_count;
        line = line.slice(0, max_new_chars) + "...";
        break;
      }
      // validate/format
      // if line is empty, skip
      if (line.length === 0) continue;
      // limit length of line to N characters
      if (limits.chars_per_line && line.length > limits.chars_per_line) {
        line = line.slice(0, limits.chars_per_line) + "...";
      }
      // if line is a code block, skip
      if (line.startsWith("```")) {
        is_code = !is_code;
        continue;
      }
      if (is_code){
        // add tab to beginning of line
        line = "\t"+line;
      }
      // add line to block
      block.push(line);
      // increment char_count
      char_count += line.length;
    }
    // close code block if open
    if (is_code) {
      block.push("```");
    }
    return block.join("\n").trim();
  }
    
  // inject function returns nothing, it just modifies the class

}