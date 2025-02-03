import { Keymap } from "obsidian";
/**
 * Builds the HTML string for the result component.
 * .temp-container is used so listeners can be added to .sc-result (otherwise does not persist) 
 * @param {Object} result - The results a <Result> object 
 * @param {Object} [opts={}] - Optional parameters.
 * @returns {Promise<string>} A promise that resolves to the HTML string.
 */
export async function build_html(result, opts = {}) {
  const item = result.item;
  const score = result.score; // Extract score from opts
  const expanded_view = item.env.settings.expanded_view;
  
  return `<div class="temp-container">
    <div
      class="sc-result${expanded_view ? '' : ' sc-collapsed'}"
      data-path="${item.path.replace(/"/g, '&quot;')}"
      data-link="${item.link?.replace(/"/g, '&quot;') || ''}"
      data-collection="${item.collection_key}"
      data-score="${score}"
      draggable="true"
    >
      <span class="header">
        ${this.get_icon_html('right-triangle')}
        <a class="sc-result-file-title" href="#" title="${item.path.replace(/"/g, '&quot;')}" draggable="true">
          <small>${[score?.toFixed(2), item.name].join(' | ')}</small>
        </a>
      </span>
      <ul draggable="true">
        <li class="sc-result-file-title" title="${item.path.replace(/"/g, '&quot;')}" data-collection="${item.collection_key}" data-key="${item.key}"></li>
      </ul>
    </div>
  </div>`;
}

/**
 * Renders the result component by building the HTML and post-processing it.
 * @param {Object} result - The result object containing component data.
 * @param {Object} [opts={}] - Optional parameters.
 * @returns {Promise<DocumentFragment>} A promise that resolves to the processed document fragment.
 */
export async function render(result, opts = {}) {
  let html = await build_html.call(this, result, opts);
  const frag = this.create_doc_fragment(html);
  return await post_process.call(this, result, frag, opts);
}

/**
 * Post-processes the rendered document fragment by adding event listeners and rendering entity details.
 * @param {DocumentFragment} frag - The document fragment to be post-processed.
 * @param {Object} [opts={}] - Optional parameters.
 * @returns {Promise<DocumentFragment>} A promise that resolves to the post-processed document fragment.
 */
export async function post_process(result, frag, opts = {}) {
  const { item, score } = result;
  const env = item.env;
  const plugin = env.smart_connections_plugin;
  const app = plugin.app;
  const filter_settings = env.settings.smart_view_filter;
  const elm = frag.querySelector('.sc-result');
  if(!filter_settings.render_markdown) elm.classList.add('sc-result-plaintext');
  
  const toggle_result = async (result) => {
    result.classList.toggle("sc-collapsed");
    // if li contents is empty, render it
    if(!result.querySelector("li").innerHTML){
      const collection_key = result.dataset.collection;
      const entity = env[collection_key].get(result.dataset.path);
      await entity.render_item(result.querySelector("li"));
    }
  }
  const handle_result_click = (event) => {
    event.preventDefault();
    event.stopPropagation();
    const target = event.target;
    const result = target.closest(".sc-result");
    if (target.classList.contains("svg-icon")) {
      toggle_result(result);
      return;
    }
    
    const link = result.dataset.link || result.dataset.path;
    if(result.classList.contains("sc-collapsed")){
      if (Keymap.isModEvent(event)) {
        console.log("open_note", link, this);
        plugin.open_note(link, event);
      } else {
        toggle_result(result);
      }
    } else {
      console.log("open_note", link);
      plugin.open_note(link, event);
    }
  }
  elm.addEventListener("click", handle_result_click.bind(plugin));
  const path = elm.querySelector("li").dataset.key;
  elm.addEventListener('dragstart', (event) => {
    const drag_manager = app.dragManager;
    const file_path = path.split("#")[0];
    const file = app.metadataCache.getFirstLinkpathDest(file_path, '');
    const drag_data = drag_manager.dragFile(event, file);
    drag_manager.onDragStart(event, drag_data);
  });

  if (path.indexOf("{") === -1) {
    elm.addEventListener("mouseover", (event) => {
      app.workspace.trigger("hover-link", {
        event,
        source: "smart-connections-view",
        hoverParent: elm.parentElement,
        targetEl: elm,
        linktext: path,
      });
    });
  }
  
  if(!filter_settings.expanded_view) return elm;
  // Render entity details
  const li = elm.querySelector('li');
  if (item) {
    await item.render_item(li, opts);
  } else {
    li.innerHTML = "<p>Entity not found.</p>";
  }

  return elm;
}