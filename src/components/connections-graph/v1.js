import styles_css from './v1.css';
import { get_item_display_name } from '../../utils/get_item_display_name.js';
import { cos_sim } from 'smart-utils/cos_sim.js';
import { register_item_drag } from 'obsidian-smart-env/src/utils/register_item_drag.js';
import { register_item_hover_popover } from 'obsidian-smart-env/src/utils/register_item_hover_popover.js';
import {
  build_prefixed_connection_key,
  is_connection_hidden,
  is_connection_pinned,
} from '../../utils/connections_list_item_state.js';
import {
  hash_to_unit,
  seeded_angle,
  normalize_scores,
  score_to_radius,
  is_vec,
  to_unit,
  kmeans_cosine_unit,
  quadrant_anchors,
  radial_strength_for,
  compute_radii,
  truncate_middle,
  label_anchor_offset,
  project_anchor_to_ring,
  is_hover_preview_eligible,
  resolve_drag_item,
} from './v1.util.js';

/**
 * Builds a Set of prefixed keys for the provided results.
 * @param {Array<{item?: {collection_key?: string, key?: string}}>} results
 * @returns {Set<string>}
 */
export function build_prefixed_key_set(results = []) {
  const prefixed_keys = new Set();
  for (const result of results) {
    const prefixed = prefixed_key_for_item(result?.item);
    if (prefixed) prefixed_keys.add(prefixed);
  }
  return prefixed_keys;
}

/**
 * Computes the prefixed key for a result item.
 * @param {{collection_key?: string, key?: string}} item
 * @returns {string|undefined}
 */
export function prefixed_key_for_item(item) {
  if (!item) return undefined;
  return build_prefixed_connection_key(item.collection_key, item.key);
}

/**
 * Collects hidden connection entries so they can be rendered as nodes.
 * @param {object} options
 * @param {Record<string, {hidden?: number, pinned?: number}>} [options.connections_state]
 * @param {Set<string>} [options.existing_keys]
 * @param {(collection_key: string, item_key: string) => any} options.resolve_item
 * @returns {Array<{item: any, score: null, is_hidden: true, prefixed_key: string}>}
 */
export function collect_hidden_entries({
  connections_state = {},
  existing_keys = new Set(),
  resolve_item,
} = {}) {
  if (typeof resolve_item !== 'function') return [];
  const hidden_entries = [];
  for (const [prefixed_key, state] of Object.entries(connections_state)) {
    if (!state?.hidden || state?.pinned) continue;
    if (existing_keys.has(prefixed_key)) continue;
    const parsed = parse_prefixed_key(prefixed_key);
    if (!parsed) continue;
    const item = resolve_item(parsed.collection_key, parsed.item_key);
    if (!item) continue;
    existing_keys.add(prefixed_key);
    hidden_entries.push({
      item,
      score: null,
      is_hidden: true,
      prefixed_key,
    });
  }
  return hidden_entries;
}

/**
 * Builds className for a graph node based on state flags.
 * @param {{is_center?: boolean, is_hidden?: boolean, is_pinned?: boolean}} flags
 * @returns {string}
 */
export function build_node_classname({ is_center = false, is_hidden = false, is_pinned = false } = {}) {
  const classes = ['sc-graph-node'];
  if (is_center) classes.push('sc-graph-node-center');
  if (is_pinned) classes.push('sc-result-pinned');
  if (is_hidden) classes.push('sc-result-hidden');
  return classes.join(' ').trim();
}

function parse_prefixed_key(prefixed_key) {
  if (typeof prefixed_key !== 'string' || !prefixed_key.includes(':')) return null;
  const [collection_key, ...rest] = prefixed_key.split(':');
  if (!collection_key || !rest.length) return null;
  return { collection_key, item_key: rest.join(':') };
}


/**
 * CDN settings for D3 used by the graph component.
 * D3_INTEGRITY_SHA256 is intentionally left empty by default so builds or
 * plugin code can inject the correct SHA for the chosen d3.min.js asset.
 */
const D3_CDN_URL = 'https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js';
const D3_EXPECTED_MAJOR = '7.';
const D3_INTEGRITY_SHA256 =
  (typeof globalThis !== 'undefined' && globalThis.SC_D3_INTEGRITY_SHA256) ||
  '';

/**
 * Validate a candidate d3 instance and log if it looks unexpected.
 * @param {any} d3
 */
function validate_d3_instance(d3) {
  if (!d3) return;
  const version = String(d3.version || '');
  if (version && !version.startsWith(D3_EXPECTED_MAJOR)) {
    console.warn(
      `[connections_graph] Loaded d3 version "${version}" but expected v${D3_EXPECTED_MAJOR}x`
    );
  }
}

/**
 * Lazy-loads D3 from CDN once with optional SRI validation.
 * If a global d3 already exists it is reused.
 * @returns {Promise<typeof import('d3')>}
 */
async function load_d3() {
  const g = typeof globalThis !== 'undefined' ? globalThis : window;

  if (g.d3) {
    validate_d3_instance(g.d3);
    return g.d3;
  }

  const existing =
    typeof document !== 'undefined'
      ? document.querySelector('script[data-sc-d3]')
      : null;
  if (existing && g.d3) {
    validate_d3_instance(g.d3);
    return g.d3;
  }

  const d3 = await new Promise((resolve, reject) => {
    if (typeof document === 'undefined' || !document.head) {
      reject(new Error('D3 loader: document.head not available'));
      return;
    }

    const script = document.createElement('script');
    script.src = D3_CDN_URL;
    script.async = true;
    script.setAttribute('data-sc-d3', 'true');

    const integrity = String(D3_INTEGRITY_SHA256 || '').trim();
    if (integrity) {
      script.integrity = integrity;
      script.crossOrigin = 'anonymous';
    }

    script.onload = () => {
      if (!g.d3) {
        reject(new Error('D3 loader: script loaded but window.d3 is missing'));
        return;
      }
      resolve(g.d3);
    };

    script.onerror = () => {
      reject(new Error('D3 loader: failed to load d3 from CDN'));
    };

    document.head.appendChild(script);
  });

  validate_d3_instance(d3);
  return d3;
}

/**
 * Build HTML container for the graph. Thin function returning an unattached element via render().
 */
async function build_html(connections_list, params = {}) {
  const to_item = params?.to_item || connections_list?.item;
  const width = params.width ?? 100;
  const height = params.height ?? 100;
  return `
    <div class="connections-graph sc-graph"
         data-center-key="${to_item?.key || ''}"
         data-center-collection="${to_item?.collection_key || ''}">
      <svg class="sc-graph-svg"
           width="${width}" height="${height}"
           viewBox="0 0 ${width} ${height}"
           preserveAspectRatio="xMidYMid meet">
        <g class="sc-graph-viewport">
          <g class="nodes"></g>
        </g>
      </svg>
      <div class="sc-graph-details" aria-live="polite"></div>
    </div>
  `;
}

/**
 * Render method (thin): returns unattached DOM element.
 */
export async function render(connections_list, params = {}) {
  this.apply_style_sheet(styles_css);
  const html = await build_html.call(this, connections_list, params);
  const frag = this.create_doc_fragment(html);
  const container = frag.querySelector('.connections-graph');
  post_process.call(this, connections_list, container, params); // not awaited
  return container;
}

/* -------------------------------------------------------------------------- */
/*                                Post-process                                */
/* -------------------------------------------------------------------------- */

async function post_process(connections_list, container, params = {}) {
  const results = await connections_list.get_results(params);

  try {
    const d3 = await load_d3();

    const to_item = params.to_item || connections_list?.item;
    if (!to_item) throw new Error('connections_graph: could not resolve center item.');

    const env = to_item.env;
    const connections_settings = params.connections_settings ?? env.connections_lists.settings;
    const connection_state = to_item?.data?.connections || {};
    const event_key_domain = params.event_key_domain || 'connections';
    const drag_event_key = `${event_key_domain}:drag_result`;
    const base_prefixed_keys = build_prefixed_key_set(results);
    const hidden_entries = collect_hidden_entries({
      connections_state: connection_state,
      existing_keys: base_prefixed_keys,
      resolve_item: (collection_key, item_key) => connections_list?.env?.[collection_key]?.get(item_key),
    });
    const result_entries = [...results, ...hidden_entries];

    const svg = container.querySelector('svg.sc-graph-svg');
    const viewport = svg.querySelector('g.sc-graph-viewport');
    const g_nodes = viewport.querySelector('g.nodes');

    // Visual constants
    const CENTER_R = 8;
    const NODE_R = 5;
    const PADDING = 24;
    const LABEL_MARGIN = 10;

    let sim = null;
    let node_sel = null;

    const build_label_text = (item) => {
      const display = get_item_display_name(item, {show_full_path: false}) || item?.key || '';
      return truncate_middle(display, 70);
    };

    let view_width = +svg.getAttribute('width') || 100;

    const layout = () => {
      const width = container.clientWidth || +svg.getAttribute('width') || 100;
      const height = width; // square aspect
      view_width = width;
      svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
      svg.setAttribute('width', width);
      svg.setAttribute('height', height);

      const center_x = Math.round(width * 0.5);
      const center_y = Math.round(height * 0.5);

      const { min_r, outer_r, half_min } = compute_radii(width, height, PADDING);

      // resolve center vec (unit)
      const center_vec = is_vec(to_item?.vec) ? to_unit(to_item.vec) : null;

      // --- radial placement uses true similarity-to-center (not result.score) ---
      const non_center_vecs = result_entries.map((r) => is_vec(r?.item?.vec) ? to_unit(r.item.vec) : null);
      const sims_to_center_raw = non_center_vecs.map((v) => (center_vec && v) ? Math.max(0, Math.min(1, cos_sim(center_vec, v))) : null);
      const { norm: sims_center_norm } = normalize_scores(sims_to_center_raw);

      // --- build nodes: center (fixed) + others ---
      const center_node = {
        id: '__center__',
        item: to_item,
        score: 1,
        radius: CENTER_R,
        isCenter: true,
        x: center_x,
        y: center_y,
        fx: center_x,
        fy: center_y,
      };

      // k-means over vectors to get 4 cluster centers
      const seed = Math.floor(hash_to_unit(result_entries.map((r) => r?.item?.key || '').join('|')) * 1e9);
      const { centers, assign } = kmeans_cosine_unit(non_center_vecs, 4, 300, seed);

      // similarity between cluster-centers and the main center
      const center_to_cluster_sims = (centers.length ? centers : [null, null, null, null])
        .slice(0, 4)
        .map((c) => (center_vec && c) ? Math.max(0, Math.min(1, cos_sim(center_vec, c))) : 0.5);

      // anchor radii: clusters more similar to the center sit closer to it
      const cluster_anchor_radii = center_to_cluster_sims.map((s) => score_to_radius(s, min_r, outer_r));
      while (cluster_anchor_radii.length < 4) cluster_anchor_radii.push(cluster_anchor_radii[cluster_anchor_radii.length - 1] || Math.round((min_r + outer_r) / 2));
      const anchors = quadrant_anchors(center_x, center_y, cluster_anchor_radii);

      const nodes_non_center = result_entries.map((res, i) => {
        const r_item = res?.item;
        if (!r_item) return null;

        // node’s desired ring radius from similarity-to-center (normalized)
        const t = sims_center_norm[i] ?? 0.5;
        const rr = score_to_radius(t, min_r, outer_r); // 0-sim => outer_r == 45% width

        const angle = seeded_angle(r_item.key || String(i), -Math.PI / 2);
        const x0 = Math.round(center_x + rr * Math.cos(angle));
        const y0 = Math.round(center_y + rr * Math.sin(angle));

        const cluster = Number.isInteger(assign[i]) ? assign[i] : Math.floor(hash_to_unit(r_item.key || String(i)) * 4);
        const v = non_center_vecs[i];
        const cluster_vec = centers[cluster] || null;
        const node_to_cluster_sim = (v && cluster_vec) ? Math.max(0, Math.min(1, cos_sim(v, cluster_vec))) : 0;

        const prefixed_key = prefixed_key_for_item(r_item);
        const isPinned = prefixed_key ? is_connection_pinned(connection_state, prefixed_key) : false;
        const isHidden = Boolean(res?.is_hidden) || (prefixed_key ? is_connection_hidden(connection_state, prefixed_key) : false);

        return {
          id: r_item.key,
          item: r_item,
          score: Number.isFinite(res?.score) ? +res.score : (center_vec && v ? cos_sim(center_vec, v) : null), // display only
          ring_r: rr,
          angle,
          radius: NODE_R,
          isCenter: false,
          x: x0,
          y: y0,
          cluster,
          node_to_cluster_sim,
          label_text: build_label_text(r_item),
          prefixed_key,
          isPinned,
          isHidden,
        };
      }).filter(Boolean);

      const nodes = [center_node, ...nodes_non_center];

      // draw nodes
      node_sel = d3.select(g_nodes)
        .selectAll('g.sc-graph-node')
        .data(nodes, (d) => d.id)
        .join((enter) => {
          const g = enter.append('g')
            .attr('class', (d) => build_node_classname({
              is_center: d.isCenter,
              is_hidden: d.isHidden,
              is_pinned: d.isPinned,
            }))
            .attr('title', (d) => (d.item.path || '').replace(/"/g, '&quot;'))
            .attr('data-collection', (d) => d.item.collection_key)
            .attr('data-key', (d) => d.item.key)
            .attr('data-path', (d) => (d.item.path || '').replace(/"/g, '&quot;'))
            .attr('data-link', (d) => (d.item.link || '').replace(/"/g, '&quot;'))
            .attr('data-score', (d) => `${d.score ?? ''}`)
            .attr('data-cluster', (d) => (d.isCenter ? '' : String(d.cluster)))
            .attr('data-hidden', (d) => (d.isHidden ? 'true' : null))
            .attr('data-pinned', (d) => (d.isPinned ? 'true' : null))
            .attr('data-prefixed-key', (d) => d.prefixed_key || '');

          g.append('circle')
            .attr('r', (d) => d.radius)
            .attr('class', 'sc-graph-node-dot');

          // small score text for non-center only
          g.append('text')
            .attr('class', 'sc-score-text')
            .attr('y', -NODE_R - 6)
            .attr('text-anchor', 'middle')
            .attr('alignment-baseline', 'baseline')
            .text((d) => (typeof d.score === 'number' && !d.isCenter) ? d.score.toFixed(2) : '');

          g.filter((d) => !d.isCenter)
            .append('text')
            .attr('class', 'sc-node-label')
            .attr('y', -NODE_R - 6)
            .attr('text-anchor', 'middle')
            .attr('alignment-baseline', 'baseline')
            .text((d) => d.label_text.replace('.md',''));

          const drag_handle_size = (NODE_R + 6) * 2;
          const drag_handle = g.append('foreignObject')
            .attr('class', 'sc-node-drag-handle')
            .attr('x', -(drag_handle_size / 2))
            .attr('y', -(drag_handle_size / 2))
            .attr('width', drag_handle_size)
            .attr('height', drag_handle_size);

          drag_handle.append('xhtml:div')
            .attr('class', 'sc-node-drag-handle-inner');

          return g;
        });

      node_sel
        .attr('class', (d) => build_node_classname({
          is_center: d.isCenter,
          is_hidden: d.isHidden,
          is_pinned: d.isPinned,
        }))
        .attr('data-hidden', (d) => (d.isHidden ? 'true' : null))
        .attr('data-pinned', (d) => (d.isPinned ? 'true' : null))
        .attr('data-prefixed-key', (d) => d.prefixed_key || '')
        .attr('transform', (d) => `translate(${d.x},${d.y})`);

      const clear_hover = () => {
        node_sel.classed('sc-graph-node-hover', false);
      };

      const set_hover = (node) => {
        if (!node) return;
        clear_hover();
        node.classList.add('sc-graph-node-hover');
      };

      node_sel.on('mouseenter', function () {
        clear_hover();
        d3.select(this).classed('sc-graph-node-hover', true);
      }).on('mouseleave', function () {
        d3.select(this).classed('sc-graph-node-hover', false);
      }).on('click', function (event, datum) {
        handle_node_click({
          node: datum,
          container,
          env,
          center_item: to_item,
        });
      });

      node_sel.select('foreignObject.sc-node-drag-handle')
        .select('div.sc-node-drag-handle-inner')
        .each(function (datum) {
          if (this.dataset.scDragBound === 'true') return;
          this.dataset.scDragBound = 'true';
          const drag_item = resolve_drag_item(datum);
          if (drag_item) register_item_drag(this, drag_item, { drag_event_key });
          if (
            this.getAttribute('data-sc-hover-preview-bound') !== 'true'
            && is_hover_preview_eligible(datum)
          ) {
            this.setAttribute('data-sc-hover-preview-bound', 'true');
            register_item_hover_popover(this, datum.item, { event_key_domain });
          }
          const node = this.closest('g.sc-graph-node');
          this.addEventListener('mouseenter', () => set_hover(node));
          this.addEventListener('mouseleave', () => {
            if (node) node.classList.remove('sc-graph-node-hover');
          });
          this.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            handle_node_click({
              node: datum,
              container,
              env,
              center_item: to_item,
            });
          });
        });

      // forces (tuned for reduced cluster density and stable rings)
      const radial_force = d3.forceRadial(
        (d) => d.isCenter ? 0 : d.ring_r,
        center_x,
        center_y
      ).strength((d) => d.isCenter ? 1 : radial_strength_for(d.ring_r, min_r, outer_r));

      const collide_force = d3.forceCollide((d) => d.radius + 16)
        .strength(0.9)
        .iterations(2);

      const charge_force = d3.forceManyBody()
        .strength(-80)
        .distanceMax(half_min);

      // cluster attraction strength: gentler baseline with similarity scaling
      const cluster_strength_fn = (d) => {
        if (d.isCenter) return 0;
        const base = 0.04;
        const node_c = Math.max(0, Math.min(1, d.node_to_cluster_sim || 0));
        const center_c = center_to_cluster_sims[(d.cluster ?? 0) % 4] || 0.5;
        return base + 0.28 * node_c * (0.5 + 0.5 * center_c);
      };

      // Custom cluster attraction projected onto each node's target ring.
      function force_cluster(anchors_in = [], strength_fn = () => 0.2, cx = 0, cy = 0) {
        let nodes_f = [];
        function force(alpha) {
          for (let i = 0; i < nodes_f.length; i++) {
            const d = nodes_f[i];
            if (d.isCenter) continue;
            const idx = Number.isInteger(d.cluster) ? (d.cluster % anchors_in.length) : 0;
            const a = anchors_in[idx];
            const s = Math.max(0, Math.min(1, strength_fn(d)));
            if (!a || s <= 0) continue;
            const pr = project_anchor_to_ring(cx, cy, a.x, a.y, d.ring_r);
            d.vx += (pr.x - d.x) * s * alpha;
            d.vy += (pr.y - d.y) * s * alpha;
          }
        }
        force.initialize = function (_nodes) { nodes_f = _nodes; };
        return force;
      }
      const cluster_force = force_cluster(anchors, cluster_strength_fn, center_x, center_y);

      if (!sim) {
        sim = d3.forceSimulation(nodes)
          .alpha(0.95)
          .alphaDecay(0.08)
          .force('radial', radial_force)
          .force('cluster', cluster_force)
          .force('collide', collide_force)
          .force('charge', charge_force)
          .on('tick', () => {
            nodes[0].fx = center_x; // keep center locked
            nodes[0].fy = center_y;

            // update node positions
          node_sel.attr('transform', (d) => `translate(${d.x},${d.y})`);

          node_sel.select('text.sc-node-label')
            .each(function (d) {
              if (d.isCenter) return;
              const node = this;
              const label_width = typeof node.getComputedTextLength === 'function'
                ? node.getComputedTextLength()
                : 0;
              const { anchor, offset } = label_anchor_offset(d.x, {
                center_x,
                label_width,
                view_width,
                radius: d.radius,
                margin: LABEL_MARGIN,
              });
              d3.select(node)
                .attr('text-anchor', anchor)
                .attr('x', offset);
            });
          });
      } else {
        sim.nodes(nodes);
        sim.force('radial', radial_force);
        sim.force('cluster', cluster_force);
        sim.force('collide', collide_force);
        sim.force('charge', charge_force);
        nodes[0].fx = center_x;
        nodes[0].fy = center_y;
        sim.alpha(0.8).restart();
      }

    };

    layout();
    const ro = new ResizeObserver(() => layout());
    ro.observe(container);

  } catch (err) {
    console.error('[connections_graph] post_process error:', err);
    const fallback = document.createElement('p');
    fallback.className = 'sc-no-results';
    fallback.textContent = 'Unable to render graph. See console for details.';
    container.appendChild(fallback);
  }

  return container;
}

function handle_node_click({ node, container, env, center_item }) {
  if (!node?.item) return;
  const detail = build_result_detail(node, center_item);
  if (!detail) return;
  if (typeof CustomEvent === 'function' && container?.dispatchEvent) {
    container.dispatchEvent(new CustomEvent('connections:result', {
      detail,
      bubbles: true,
    }));
  }
  env?.events?.emit?.('connections:result', detail);
  node.item.emit_event?.('connections:result', detail);
  node.item.emit_event?.('connections:open_result', detail);
}

function build_result_detail(node, center_item) {
  const collection_key = node?.item?.collection_key;
  const item_key = node?.item?.key;
  if (!collection_key || !item_key) return null;
  return {
    collection_key,
    item_key,
    prefixed_key: node.prefixed_key || prefixed_key_for_item(node.item) || build_prefixed_connection_key(collection_key, item_key),
    score: typeof node.score === 'number' ? node.score : null,
    is_hidden: Boolean(node.isHidden),
    is_pinned: Boolean(node.isPinned),
    event_source: 'connections-graph-v1',
    center_key: center_item?.key,
  };
}
