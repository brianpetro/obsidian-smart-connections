/**
 * Builds the HTML string for the result component.
 * .temp-container is used so listeners can be added to .search-result (otherwise does not persist) 
 * @param {Object} scope - The scopes a <Result> object 
 * @param {Object} [opts={}] - Optional parameters.
 * @returns {Promise<string>} A promise that resolves to the HTML string.
 */
export async function build_html(scope, opts = {}) {
  const item = scope.item;
  const score = scope.score; // Extract score from opts
  const expanded_view = item.env.settings.expanded_view;
  
  return `<div class="temp-container">
    <div
      class="search-result${expanded_view ? '' : ' sc-collapsed'}"
      data-path="${item.path.replace(/"/g, '&quot;')}"
      data-collection="${item.collection_key}"
      data-score="${score}"
      draggable="true"
    >
      <span class="header">
        ${this.get_icon_html('right-triangle')}
        <a class="search-result-file-title" href="#" title="${item.path.replace(/"/g, '&quot;')}" draggable="true">
          <small>${[score?.toFixed(2), item.name].join(' | ')}</small>
        </a>
      </span>
      <ul draggable="true">
        <li class="search-result-file-title" title="${item.path.replace(/"/g, '&quot;')}" data-collection="${item.collection_key}" data-key="${item.key}"></li>
      </ul>
    </div>
  </div>`;
}

/**
 * Renders the result component by building the HTML and post-processing it.
 * @param {Object} scope - The scope object containing component data.
 * @param {Object} [opts={}] - Optional parameters.
 * @returns {Promise<DocumentFragment>} A promise that resolves to the processed document fragment.
 */
export async function render(scope, opts = {}) {
  let html = await build_html.call(this, scope, opts);
  const frag = this.create_doc_fragment(html);
  return await post_process.call(this, scope, frag, opts);
}

/**
 * Post-processes the rendered document fragment by adding event listeners and rendering entity details.
 * @param {DocumentFragment} frag - The document fragment to be post-processed.
 * @param {Object} [opts={}] - Optional parameters.
 * @returns {Promise<DocumentFragment>} A promise that resolves to the post-processed document fragment.
 */
export async function post_process(scope, frag, opts = {}) {
  const search_result = frag.querySelector('.search-result');
  
  // Add event listeners specific to the search result
  if(typeof opts.add_result_listeners === 'function') opts.add_result_listeners(search_result);
  
  if(!scope.item.env.settings.expanded_view) return search_result;
  // Render entity details
  const li = search_result.querySelector('li');
  const collection_key = li.dataset.collection;
  const entity_key = li.dataset.key;
  const entity = scope.item.env[collection_key].get(entity_key);
  
  if (entity) {
    await entity.render_item(li, opts);
  } else {
    li.innerHTML = "<p>Entity not found.</p>";
  }

  return search_result;
}