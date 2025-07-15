/**
  * Build raw HTML container. The detailed content for each block
  * will be appended in post_process (because block.read() is async).
  * @param {Object} source
  * @param {Object} [opts]
  * @returns {string}
  */
export function build_html(source, opts = {}) {
  return `<div>
    <div class="source-inspector-source-info">
      <button class="source-inspector-show-data-btn" type="button">Show source data</button>
      <div class="source-inspector-source-data" style="display:none; margin: 0.5em 0;">
        <pre style="max-height:300px; overflow:auto; background:#222; color:#fff; padding:0.5em; border-radius:4px;"></pre>
      </div>
    </div>
    <div class="smart-chat-message source-inspector">
      <h2>Blocks</h2>
      <div class="source-inspector-blocks-container"></div>
    </div>
  </div>`;
}

import inspector_css from './source_inspector.css' with { type: 'css' };

/**
 * Render the component by:
 *   1. building the container HTML
 *   2. creating a DocumentFragment
 *   3. calling post_process to append each block
 *
 * @param {Object} data - expected to have data.note
 * @param {Object} [opts]
 * @returns {Promise<DocumentFragment>}
 */
export async function render(source, opts = {}) {
  const html = build_html(source, opts);
  const frag = this.create_doc_fragment(html);
  this.apply_style_sheet(inspector_css);
  await post_process.call(this, source, frag, opts);
  return frag;
}

/**
 * Post-process: build the actual block listing, read each block, and inject.
 * This replicates the EJS logic:
 *   for each block => a short info line, plus a blockquote with escaped content.
 *
 * @param {Object} source - must have data.note
 * @param {DocumentFragment} frag
 * @param {Object} opts
 * @returns {Promise<DocumentFragment>}
 */
export async function post_process(source, frag, opts = {}) {
  const container = frag.querySelector('.source-inspector .source-inspector-blocks-container');
  if (!container) return frag;
  const source_info = frag.querySelector('.source-inspector-source-info');

  // Add show/hide source data button logic
  const btn = frag.querySelector('.source-inspector-show-data-btn');
  const data_div = frag.querySelector('.source-inspector-source-data');
  const pre = data_div?.querySelector('pre');
  if (btn && data_div && pre) {
    btn.addEventListener('click', () => {
      if (data_div.style.display === 'none') {
        pre.textContent = JSON.stringify(source.data, null, 2);
        data_div.style.display = '';
        btn.textContent = 'Hide source data';
      } else {
        data_div.style.display = 'none';
        btn.textContent = 'Show source data';
      }
    });
  }

  // added source-level should_embed/vectorize checks
  const source_should_embed = source.should_embed
    ? `<span style="color: green;">should embed</span>`
    : `<span style="color: orange;">embedding skipped</span>`
  ;
  const source_embed_status = source.vec
    ? `<span style="color: green;">vectorized</span>`
    : `<span style="color: orange;">not vectorized</span>`
  ;
  const source_info_frag = this.create_doc_fragment(`<p>${source_should_embed} | ${source_embed_status}</p>`);
  source_info.appendChild(source_info_frag);

  if (!source || !source.blocks || source.blocks.length === 0) {
    this.safe_inner_html(container, `<p>No blocks</p>`);
    return frag;
  }

  // Sort blocks
  const sorted_blocks = source.blocks.sort((a, b) => a.line_start - b.line_start);

  for (const block of sorted_blocks) {
    // Build the short info line
    const sub_key_display = block.sub_key.split('#').join(' > ');
    const block_info = `${sub_key_display} (${block.size} chars; lines: ${block.line_start}-${block.line_end})`;

    // Flag
    const should_embed = block.should_embed
      ? `<span style="color: green;">should embed</span>`
      : `<span style="color: orange;">embedding skipped</span>`;
    const embed_status = block.vec
      ? `<span style="color: green;">vectorized</span>`
      : `<span style="color: orange;">not vectorized</span>`;

    // Read and sanitize content
    let block_content = '';
    try {
      const raw = await block.read();
      block_content = raw
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>')
        .replace(/\t/g, '&nbsp;&nbsp;');
    } catch (err) {
      console.error('[source_inspector] Error reading block:', err);
      block_content = `<em style="color:red;">Error reading block content</em>`;
    }

    // Append to container
    const block_frag = this.create_doc_fragment(`
      <p>
        ${block_info}<br>
        ${should_embed} | ${embed_status}
      </p>
      <blockquote>${block_content}</blockquote>
      <hr>
    `);
    container.appendChild(block_frag);
  }

  return frag;
}
