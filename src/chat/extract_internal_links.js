export function extract_internal_links(env, user_input) {
  const matches = user_input.match(/\[\[(.*?)\]\]/g);
  console.log(matches);
  // return array of TFile objects
  if (matches && env.smart_connections_plugin) return matches.map(match => {
    const tfile = env.smart_connections_plugin.app.metadataCache.getFirstLinkpathDest(match.replace("[[", "").replace("]]", ""), "/");
    return tfile;
  });
  if (matches) return matches;
  return [];
}
