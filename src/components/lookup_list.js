export async function build_html(lookup_list, opts = {}) {
  return `<div><div class="lookup-list connections-list sc-list" data-key="${lookup_list.item.key}"></div></div>`;
}
export async function render(lookup_list, opts = {}) {
  const html = await build_html.call(this, lookup_list, opts);
  const frag = this.create_doc_fragment(html);
  const container = frag.querySelector('.lookup-list');
  post_process.call(this, lookup_list, container, opts);
  return container;
}
export async function post_process(lookup_list, container, opts = {}) {
  container.dataset.key = lookup_list.key;
  const results = await lookup_list.get_results(opts);
  if(!results || !Array.isArray(results) || results.length === 0) {
    const no_results = this.create_doc_fragment(`<p class="sc-no-results">No results found</p>`);
    container.appendChild(no_results);
    return container;
  }
  const smart_components = lookup_list.env.smart_components;
  // const list_item_component_key = opts.lookup_list_item
  //   || lookup_list.lookup_list_item_component_key
  // ;
  const result_frags = await Promise.all(results.map(result => {
    // return smart_components.render_component(`lookup_list_item.${list_item_component_key}`, result, {...opts});
    return smart_components.render_component(`connections_list_item_v3`, result, {...opts});
  }));
  result_frags.forEach(result_frag => container.appendChild(result_frag));
  // Add any necessary post-processing here
  return container;
}