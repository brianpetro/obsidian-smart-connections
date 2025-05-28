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
 * @param {Object} result_scope - The result object containing component data.
 * @param {Object} [opts={}] - Optional parameters.
 * @returns {Promise<DocumentFragment>} A promise that resolves to the processed document fragment.
 */
export async function render(result_scope, opts = {}) {
  let html = await build_html.call(this, result_scope, opts);
  const frag = this.create_doc_fragment(html);
  return await post_process.call(this, result_scope, frag, opts);
}

/**
 * Post-processes the rendered document fragment by adding event listeners and rendering entity details.
 * @param {DocumentFragment} frag - The document fragment to be post-processed.
 * @param {Object} [opts={}] - Optional parameters.
 * @returns {Promise<DocumentFragment>} A promise that resolves to the post-processed document fragment.
 */
export async function post_process(result_scope, frag, opts = {}) {
  const { item, score } = result_scope;
  const env = item.env;
  const plugin = env.smart_connections_plugin;
  const app = plugin.app;
  const filter_settings = env.settings.smart_view_filter;
  const result_elm = frag.querySelector('.sc-result');
  if(!filter_settings.render_markdown) result_elm.classList.add('sc-result-plaintext');
  
  const render_result = async (_result_elm) => {
    // if li contents is empty, render it
    if(!_result_elm.querySelector("li").innerHTML){
      const collection_key = _result_elm.dataset.collection;
      const entity = env[collection_key].get(_result_elm.dataset.path);
      let markdown;
      if (should_render_embed(entity)) markdown = `${entity.embed_link}\n\n${await entity.read()}`;
      else markdown = process_for_rendering(await entity.read());
      let entity_frag;
      if (filter_settings.render_markdown) entity_frag = await this.render_markdown(markdown, entity);
      else entity_frag = this.create_doc_fragment(markdown);
      result_elm.querySelector("li").appendChild(entity_frag);
    }
  }
  const toggle_result = async (_result_elm) => {
    _result_elm.classList.toggle("sc-collapsed");
    await render_result(_result_elm);
  }
  const handle_result_click = (event) => {
    event.preventDefault();
    event.stopPropagation();
    const target = event.target;
    const _result_elm = target.closest(".sc-result");
    if (target.classList.contains("svg-icon")) {
      toggle_result(_result_elm);
      return;
    }
    
    const link = _result_elm.dataset.link || _result_elm.dataset.path;
    if(_result_elm.classList.contains("sc-collapsed")){
      if (Keymap.isModEvent(event)) {
        plugin.open_note(link, event);
      } else {
        toggle_result(_result_elm);
      }
    } else {
      plugin.open_note(link, event);
    }
  }
  result_elm.addEventListener("click", handle_result_click.bind(plugin));
  const path = result_elm.querySelector("li").dataset.key;
  result_elm.addEventListener('dragstart', (event) => {
    const drag_manager = app.dragManager;
    const file_path = path.split("#")[0];
    const file = app.metadataCache.getFirstLinkpathDest(file_path, '');
    const drag_data = drag_manager.dragFile(event, file);
    drag_manager.onDragStart(event, drag_data);
  });

  if (path.indexOf("{") === -1) {
    result_elm.addEventListener("mouseover", (event) => {
      app.workspace.trigger("hover-link", {
        event,
        source: "smart-connections-view",
        hoverParent: result_elm.parentElement,
        targetEl: result_elm,
        linktext: path,
      });
    });
  }
  // listen for class changes on result_elm
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.attributeName === 'class' && !result_elm.classList.contains("sc-collapsed")) {
        render_result(result_elm);
      }
    });
  });
  observer.observe(result_elm, { attributes: true });


  
  if(!env.settings.expanded_view) return result_elm;
  
  // render if already expanded
  await render_result(result_elm);
  return result_elm;

}

export function should_render_embed(entity) {
  if (!entity) return false;
  if (entity.is_media) return true;
  return false;
}
export function process_for_rendering(content) {
  // prevent dataview rendering
  if(content.includes('```dataview')) content = content.replace(/```dataview/g, '```\\dataview');
  if(content.includes('```smart-context')) content = content.replace(/```smart-context/g, '```\\smart-context');
  if(content.includes('```smart-chatgpt')) content = content.replace(/```smart-chatgpt/g, '```\\smart-chatgpt');
  // prevent link embedding
  if(content.includes('![[')) content = content.replace(/\!\[\[/g, '! [[');
  return content;
}