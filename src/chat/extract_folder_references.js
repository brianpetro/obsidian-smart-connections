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
  }).filter(folder => folder);
  // return array of matches
  if (matches) return matches;
  return false;
}
