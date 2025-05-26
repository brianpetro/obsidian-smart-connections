// check if contains folder reference (ex. /folder/, or /folder/subfolder/)
export function contains_folder_reference(user_input) {
  const first_slash = user_input.indexOf("/");
  if (first_slash === -1) return false;
  const last_slash = user_input.lastIndexOf("/");
  if (last_slash - first_slash <= 1) return false; // if slashes are the same or JavaScript-style comment
  
  // Check for parentheses
  const first_open_parentheses = user_input.indexOf("(");
  const first_close_parentheses = user_input.indexOf(")");
  if (first_open_parentheses > first_slash && first_close_parentheses < last_slash) return true; // folder path contains parentheses

  // Check for wiki-style links [[...]]
  const first_wiki_open = user_input.indexOf("[[");
  const first_wiki_close = user_input.indexOf("]]");
  if (first_wiki_open !== -1 && first_wiki_close !== -1) {
    if (first_slash > first_wiki_open && last_slash < first_wiki_close) return false;
  }

  // Check for regular parentheses
  if (first_open_parentheses !== -1 && first_close_parentheses !== -1) {
    if (first_slash > first_open_parentheses && last_slash < first_close_parentheses) return false;
    const without_content_in_parentheses = user_input.slice(0, first_open_parentheses) + user_input.slice(first_close_parentheses + 1);
    if (without_content_in_parentheses.indexOf("/") !== -1) return false;
    if (without_content_in_parentheses.indexOf("/") === without_content_in_parentheses.lastIndexOf("/")) return false;
  }
  return true;
}
// get folder references from user input
export function extract_folder_references(folders, user_input) {
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
  }).filter(folder => folder && folder !== '/');
  // return array of matches
  if (matches) return matches;
  return false;
}
