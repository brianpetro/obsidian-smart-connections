import { SmartSettings } from 'smart-settings';
import { CollectionItem } from 'smart-collections';
import { cos_sim } from 'smart-utils/cos_sim.js';
import { create_feedback_fixture } from './connections_feedback.js';
import { load_component } from './presentation_surface.js';
import * as graph_utils from '../../src/components/connections-graph/v1.util.js';
import * as feedback_utils from '../../src/utils/connections_list_item_state.js';

/** Small SVG/D3 host for exercising the actual graph lifecycle, not force physics. */
function create_element(tag_name = 'div') {
  const classes = new Set();
  const element = {
    tag_name, children: [], attributes: {}, dataset: {}, style: {}, listeners: {}, clientWidth: 320,
    classList: {
      contains: name => classes.has(name),
      add: (...names) => names.forEach(name => classes.add(name)),
      remove: (...names) => names.forEach(name => classes.delete(name)),
      toggle(name, enabled = !classes.has(name)) {
        if (enabled) classes.add(name); else classes.delete(name);
        return enabled;
      },
    },
    setAttribute(key, value) {
      this.attributes[key] = String(value);
      if (key === 'class') { classes.clear(); String(value).split(' ').filter(Boolean).forEach(name => classes.add(name)); }
    },
    getAttribute(key) { return this.attributes[key] ?? null; },
    removeAttribute(key) { delete this.attributes[key]; },
    addEventListener(key, callback) { this.listeners[key] = callback; },
    appendChild(child) { child.parent = this; this.children.push(child); return child; },
    insertBefore(child, next) {
      child.parent = this;
      const index = this.children.indexOf(next);
      if (index < 0) this.children.push(child); else this.children.splice(index, 0, child);
      return child;
    },
    remove() { this.parent.children = this.parent.children.filter(child => child !== this); },
    matches(selector) {
      const [tag, ...names] = selector.split('.');
      const [type, id] = tag.split('#');
      return (!type || this.tag_name === type) && (!id || this.getAttribute('id') === id)
        && names.every(name => classes.has(name));
    },
    querySelectorAll(selector) {
      return this.children.flatMap(child => [
        ...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector),
      ]);
    },
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; },
    closest(selector) { return this.matches(selector) ? this : this.parent?.closest(selector); },
  };
  return element;
}

class Selection {
  constructor(nodes = [], parent = null) { this.nodes = nodes; this.parent = parent; }
  select(selector) {
    return new Selection(this.nodes.map(node => {
      const child = node.querySelector(selector);
      if (child) child.datum = node.datum;
      return child;
    }).filter(Boolean));
  }
  selectAll(selector) { return new Selection(this.nodes.flatMap(node => node.querySelectorAll(selector)), this.nodes[0]); }
  data(values, key) { this.values = values; this.key = key; return this; }
  join(on_enter) {
    const matched = [];
    const missing = [];
    for (const datum of this.values) {
      const node = this.nodes.find(node => this.key(node.datum) === this.key(datum));
      if (node) { node.datum = datum; matched.push(node); } else missing.push(datum);
    }
    this.nodes.filter(node => !matched.includes(node)).forEach(node => node.remove());
    const enter = new Selection(missing.map(datum => ({ datum })), this.parent);
    enter.enter = true;
    const added = on_enter(enter);
    return new Selection([...matched, ...added.nodes], this.parent);
  }
  append(tag_name) {
    return new Selection(this.nodes.map(node => {
      const child = create_element(tag_name.replace('xhtml:', ''));
      child.datum = node.datum;
      (this.enter ? this.parent : node).appendChild(child);
      return child;
    }));
  }
  attr(key, value) {
    this.nodes.forEach(node => {
      const resolved = typeof value === 'function' ? value(node.datum) : value;
      if (resolved == null) node.removeAttribute(key); else node.setAttribute(key, resolved);
    });
    return this;
  }
  classed(name, value) { this.nodes.forEach(node => node.classList.toggle(name, value)); return this; }
  text(value) { this.nodes.forEach(node => { node.textContent = typeof value === 'function' ? value(node.datum) : value; }); return this; }
  filter(callback) { return new Selection(this.nodes.filter(node => callback(node.datum))); }
  each(callback) { this.nodes.forEach(node => callback.call(node, node.datum)); return this; }
  on(key, callback) { this.nodes.forEach(node => node.addEventListener(key, event => callback.call(node, event, node.datum))); return this; }
  remove() { this.nodes.forEach(node => node.remove()); return this; }
}

export function create_graph_fixture(component_url, globals = {}) {
  const fixture = create_feedback_fixture();
  const listeners = new Map();
  fixture.env.events = {
    on(key, callback) {
      if (!listeners.has(key)) listeners.set(key, new Set());
      listeners.get(key).add(callback);
      return () => listeners.get(key).delete(callback);
    },
    emit(key, event) {
      fixture.events.push([key, event]);
      for (const callback of listeners.get(key) || []) callback(event);
    },
  };
  fixture.target.emit_event = CollectionItem.prototype.emit_event;
  fixture.collection.settings.components = { connections_graph_v1: { render_links: true } };
  const smart_settings = new SmartSettings(fixture.env);
  smart_settings.settings = { connections_lists: fixture.collection.settings };
  smart_settings.schedule_save = () => { fixture.saves++; };
  fixture.saves = 0;
  fixture.collection.settings = smart_settings.settings.connections_lists;
  fixture.env.obsidian_app = {};

  const container = create_element();
  container.setAttribute('class', 'connections-graph sc-graph');
  const svg = container.appendChild(create_element('svg'));
  svg.setAttribute('class', 'sc-graph-svg');
  const viewport = svg.appendChild(create_element('g'));
  viewport.setAttribute('class', 'sc-graph-viewport');
  const nodes = viewport.appendChild(create_element('g'));
  nodes.setAttribute('class', 'nodes');
  const fragment = create_element();
  fragment.appendChild(container);
  const disposers = [];
  const observers = [];
  const simulations = [];
  const errors = [];
  const menus = [];
  const force = () => ({ strength() { return this; }, iterations() { return this; }, distanceMax() { return this; } });
  const d3 = {
    select: node => new Selection([node]),
    forceRadial: force, forceCollide: force, forceManyBody: force,
    forceSimulation(nodes) {
      const simulation = {
        values: nodes, stopped: 0, restarted: 0,
        alpha() { return this; }, alphaDecay() { return this; }, force() { return this; },
        nodes(values) { this.values = values; return this; },
        on(key, callback) { this[key] = callback; return this; },
        restart() { this.restarted++; return this; }, stop() { this.stopped++; return this; },
      };
      simulations.push(simulation);
      return simulation;
    },
  };
  const document = { createElement: create_element, createElementNS: (_, tag) => create_element(tag) };
  const graph = load_component(component_url, ['render', 'post_process', 'display_name', 'description'], {
    ...graph_utils, ...feedback_utils, cos_sim, styles_css: '',
    get_item_display_name: item => item.key,
    register_item_drag() {}, register_item_hover_popover() {},
    document, activeDocument: document, activeWindow: { d3 }, d3,
    console: { ...console, error: (...args) => errors.push(args) },
    ResizeObserver: class {
      constructor(callback) { this.callback = callback; this.disconnected = 0; observers.push(this); }
      observe(node) { this.node = node; }
      disconnect() { this.disconnected++; }
    },
    Menu: class {
      constructor(app) { this.app = app; this.items = []; menus.push(this); }
      addItem(callback) {
        const item = {
          setTitle(value) { this.title = value; return this; },
          setIcon(value) { this.icon = value; return this; },
          setDisabled(value) { this.disabled = value; return this; },
          onClick(callback) { this.click = callback; return this; },
        };
        this.items.push(item);
        callback(item);
      }
      showAtMouseEvent(event) { this.event = event; }
    },
    ...globals,
  });
  const view = {
    apply_style_sheet() {}, create_doc_fragment() { return fragment; },
    attach_disposer(node, callback) { disposers.push(callback); },
  };
  return Object.assign(fixture, {
    graph, view, container, listeners, observers, simulations, errors, menus, d3, smart_settings,
    node(key) { return container.querySelectorAll('g.sc-graph-node').find(node => node.datum.item.key === key); },
    dispose() { disposers.splice(0).forEach(dispose => dispose()); },
    async mount(params = {}) {
      const results = await fixture.list.get_results({});
      await graph.post_process.call(view, fixture.list, container, { results, ...params });
      return results;
    },
  });
}
