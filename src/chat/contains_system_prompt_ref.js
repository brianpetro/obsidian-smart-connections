export function contains_system_prompt_ref(content) {
  return content.includes("@\"");
}
export function extract_system_prompt_ref(content) {
  const mention_pattern = /@\"([^"]+)\"/;
  const mention = content.match(mention_pattern)[1];
  return { mention, mention_pattern };
}


