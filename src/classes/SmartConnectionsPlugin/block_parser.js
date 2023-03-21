const { MAX_EMBED_STRING_LENGTH } = require( "./json/constants.json" );

// set module export to be a function to support dependency injection
module.exports = function injectMethod( modifyMe ){

  // inject this method: 
  modifyMe.prototype.block_parser = function(markdown, file_path){
    // if this.settings.skip_sections is true then return empty array
    if(this.settings.skip_sections) {
      return [];
    }
    // split the markdown into lines
    const lines = markdown.split('\n');
    // initialize the blocks array
    let blocks = [];
    // current headers array
    let currentHeaders = [];
    // remove .md file extension and convert file_path to breadcrumb formatting
    const file_breadcrumbs = file_path.replace('.md', '').replace(/\//g, ' > ');
    // initialize the block string
    let block = '';
    let block_headings = '';
    let block_path = file_path;

    let last_heading_line = 0;
    let i = 0;
    let block_headings_list = [];
    // loop through the lines
    for (i = 0; i < lines.length; i++) {
      // get the line
      const line = lines[i];
      // if line does not start with #
      // or if line starts with # and second character is a word or number indicating a "tag"
      // then add to block
      if (!line.startsWith('#') || (['#',' '].indexOf(line[1]) < 0)){
        // skip if line is empty
        if(line === '') continue;
        // skip if line is empty bullet or checkbox
        if(['- ', '- [ ] '].indexOf(line) > -1) continue;
        // if currentHeaders is empty skip (only blocks with headers, otherwise block.path conflicts with file.path)
        if(currentHeaders.length === 0) continue;
        // add line to block
        block += "\n" + line;
        continue;
      }
      /**
       * BEGIN Heading parsing
       * - likely a heading if made it this far
       */
      last_heading_line = i;
      // push the current block to the blocks array unless last line was a also a header
      if(i > 0 && (last_heading_line !== (i-1)) && (block.indexOf("\n") > -1) && this.validate_headings(block_headings)) {
        output_block();
      }
      // get the header level
      const level = line.split('#').length - 1;
      // remove any headers from the current headers array that are higher than the current header level
      currentHeaders = currentHeaders.filter(header => header.level < level);
      // add header and level to current headers array
      // trim the header to remove "#" and any trailing spaces
      currentHeaders.push({header: line.replace(/#/g, '').trim(), level: level});
      // initialize the block breadcrumbs with file.path the current headers
      block = file_breadcrumbs;
      block += ": " + currentHeaders.map(header => header.header).join(' > ');
      block_headings = "#"+currentHeaders.map(header => header.header).join('#');
      // if block_headings is already in block_headings_list then add a number to the end
      if(block_headings_list.indexOf(block_headings) > -1) {
        let count = 1;
        while(block_headings_list.indexOf(`${block_headings}{${count}}`) > -1) {
          count++;
        }
        block_headings = `${block_headings}{${count}}`;
      }
      block_headings_list.push(block_headings);
      block_path = file_path + block_headings;
    }
    // handle remaining after loop
    if((last_heading_line !== (i-1)) && (block.indexOf("\n") > -1) && this.validate_headings(block_headings)) output_block();
    // remove any blocks that are too short (length < 50)
    blocks = blocks.filter(b => b.length > 50);
    // console.log(blocks);
    // return the blocks array
    return blocks;

    function output_block() {
      // breadcrumbs length (first line of block)
      const breadcrumbs_length = block.indexOf("\n") + 1;
      const block_length = block.length - breadcrumbs_length;
      // trim block to max length
      if (block.length > MAX_EMBED_STRING_LENGTH) {
        block = block.substring(0, MAX_EMBED_STRING_LENGTH);
      }
      blocks.push({ text: block.trim(), path: block_path, length: block_length });
    }
  }
    
  // inject function returns nothing, it just modifies the class

}