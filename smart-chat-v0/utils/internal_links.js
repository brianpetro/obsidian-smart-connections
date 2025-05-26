// check if contains internal link
export function contains_internal_link(user_input) {
  if (user_input.indexOf("[[") === -1) return false;
  if (user_input.indexOf("]]") === -1) return false;
  return true;
}

export function extract_internal_links(user_input) {
  const matches = [];
  const regex = /\[\[(.*?)\]\]/g;
  let match;
  while ((match = regex.exec(user_input)) !== null) {
    matches.push(match[1]);
  }
  return matches;
}

export function contains_internal_embedded_link(user_input) {
  if (user_input.indexOf("![") === -1) return false;
  if (user_input.indexOf("]") === -1) return false;
  return true;
}
export function extract_internal_embedded_links(user_input) {
  const matches = [];
  const regex = /[!]\[\[(.*?)\]\]/g;
  let match;
  while ((match = regex.exec(user_input)) !== null) {
    matches.push(match);
  }
  return matches;
}

// slower
export function extract_internal_links2(user_input) {
  const matches = user_input.match(/\[\[(.*?)\]\]/g);
  if (matches) return matches.map(match => match.replace("[[", "").replace("]]", ""));
  return [];
}