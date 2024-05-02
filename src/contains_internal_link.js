// check if contains internal link
function contains_internal_link(user_input) {
  if (user_input.indexOf("[[") === -1) return false;
  if (user_input.indexOf("]]") === -1) return false;
  return true;
}
exports.contains_internal_link = contains_internal_link;
