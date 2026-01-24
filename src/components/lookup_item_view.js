import styles_css from './lookup_item_view.css';
const DEFAULT_DEBOUNCE_MS = 300;
const REQUIRED_MESSAGE = 'Enter a lookup query to continue.';
const PLACEHOLDER = 'Describe the idea, topic, or question you want to explore…';
const INFO = 'Use semantic (embeddings) search to surface relevant notes. Results are sorted by similarity to your query. Note: returns different results than lexical (keyword) search.';

export async function build_html(view, params = {}) {
  return `<div><div class="lookup-item-view sc-connections-view connections-view-early">
    <form class="lookup-query-form" novalidate>
      <label class="lookup-query-label" for="lookup-query-input" title="${INFO}">Smart Lookup</label>
      <textarea
        class="lookup-query-input"
        id="lookup-query-input"
        name="lookup-query"
        rows="4"
        placeholder="${PLACEHOLDER}"
        required
      ></textarea>
    </form>
    <div class="lookup-list-container">
      <p>${INFO}</p>
    </div>
  </div></div>`;
}

export async function render(view, params = {}) {
  this.apply_style_sheet(styles_css);
  const html = await build_html.call(this, view, params);
  const frag = this.create_doc_fragment(html);
  const container = frag.querySelector('.lookup-item-view');
  post_process.call(this, view, container, params);
  return container;
}

export async function post_process(view, container, params = {}) {
  const query_input = container.querySelector('.lookup-query-input');
  const query_form = container.querySelector('.lookup-query-form');
  const list_container = container.querySelector('.lookup-list-container');
  const state = { last_query: null };
  const submit_query = async (raw_query) => {
    const query = sanitize_query(raw_query);
    update_query_validity({ input_el: query_input, query });
    if (!query) {
      this.empty(list_container);
      list_container.innerHTML = `<p>${INFO}</p>`;
      return;
    };
    if (query === state.last_query) return;
    state.last_query = query;
    const next_params = { ...params, query };
    const lookup_list = view.env.lookup_lists.new_item(next_params);
    const rendered_list = await view.env.render_component('lookup_list', lookup_list, next_params);
    this.empty(list_container);
    list_container.appendChild(rendered_list);
  };

  const debounced_submit = create_debounced_submit(submit_query);

  query_input.addEventListener('input', () => {
    debounced_submit(query_input.value);
  });

  query_form.addEventListener('submit', (event) => {
    event.preventDefault();
    debounced_submit.cancel?.();
    submit_query(query_input.value);
  });

  return container;
}

export function create_debounced_submit(handler, delay = DEFAULT_DEBOUNCE_MS) {
  let timeout_id;
  const schedule = (value) => {
    if (timeout_id) clearTimeout(timeout_id);
    timeout_id = setTimeout(() => {
      timeout_id = undefined;
      handler(value);
    }, delay);
  };
  schedule.cancel = () => {
    if (timeout_id) {
      clearTimeout(timeout_id);
      timeout_id = undefined;
    }
  };
  return schedule;
}

function sanitize_query(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function update_query_validity({ input_el, query }) {
  if (!input_el?.setCustomValidity) return;
  if (!query) input_el.setCustomValidity(REQUIRED_MESSAGE);
  else input_el.setCustomValidity('');
}