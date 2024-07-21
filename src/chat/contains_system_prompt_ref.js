function contains_system_prompt_ref(content) {
  return content.includes("@\"");
}
function extract_system_prompt_ref(content) {
  const mention_pattern = /@\"([^"]+)\"/;
  const mention = content.match(mention_pattern)[1];
  return { mention, mention_pattern };
}

exports.contains_system_prompt_ref = contains_system_prompt_ref;
exports.extract_system_prompt_ref = extract_system_prompt_ref;