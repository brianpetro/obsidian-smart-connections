// check if contains internal link
export function contains_internal_link(user_input) {
  if (user_input.indexOf("[[") === -1) return false;
  if (user_input.indexOf("]]") === -1) return false;
  return true;
}
