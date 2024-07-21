function extract_internal_links(env, user_input) {
  const matches = user_input.match(/\[\[(.*?)\]\]/g);
  console.log(matches);
  // return array of TFile objects
  if (matches && env.plugin) return matches.map(match => {
    const tfile = env.plugin.app.metadataCache.getFirstLinkpathDest(match.replace("[[", "").replace("]]", ""), "/");
    return tfile;
  });
  if (matches) return matches;
  return [];
}
exports.extract_internal_links = extract_internal_links;
