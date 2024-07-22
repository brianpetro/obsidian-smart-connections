// check if contains folder reference (ex. /folder/, or /folder/subfolder/)
export function contains_folder_reference(user_input) {
  const first_slash = user_input.indexOf("/");
  if (first_slash === -1) return false;
  const last_slash = user_input.lastIndexOf("/");
  if (last_slash - first_slash <= 1) return false; // if slashes are the same or JavaScript-style comment
  const first_open_parentheses = user_input.indexOf("(");
  const first_close_parentheses = user_input.indexOf(")");
  if (first_open_parentheses > first_slash && first_close_parentheses < last_slash) return true; // folder path contains parentheses

  // returns false if slash is wrapped in parentheses
  if (first_open_parentheses !== -1 && first_close_parentheses !== -1) {
    const start = user_input.indexOf("(");
    const end = user_input.indexOf(")");
    // remove content in parentheses
    const without_content_in_parentheses = user_input.slice(0, start) + user_input.slice(end + 1);
    if (without_content_in_parentheses.indexOf("/") !== -1) return false;
    if (without_content_in_parentheses.indexOf("/") === without_content_in_parentheses.lastIndexOf("/")) return false;
  }
  return true;
}
