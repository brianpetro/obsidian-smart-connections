async function build_html(env, opts = {}) {
  let html = `<div class="muted-notice-container" style="display: flex; flex-direction: column; gap: 10px;">
    <h2>Muted notices</h2>
  `;
  
  if (Object.keys(env.notices.settings?.muted || {}).length) {
    for (const notice in env.notices.settings?.muted) {
      html += `<div class="muted-notice" data-notice="${notice}" style="display: flex; align-items: center; justify-content: space-between; gap: 10px;">
        <span>${notice}</span>
        <button class="unmute-button">Remove</button>
      </div>`;
    }
  } else {
    html += `<p>No muted notices.</p>`;
  }
  html += `</div>`;
  return html;
}

export async function render(env, opts = {}) {
  let html = await build_html.call(this, env, opts);
  const frag = this.create_doc_fragment(html);
  post_process.call(this, env, frag, opts);
  return frag;
}

async function post_process(env, frag, opts = {}) {
  const unmute_buttons = frag.querySelectorAll('.unmute-button');
  unmute_buttons.forEach(button => {
    button.addEventListener('click', () => {
      const notice = button.parentElement.dataset.notice;
      env.notices.settings.muted[notice] = false;
      delete env.notices.settings.muted[notice];
      button.parentElement.remove();
    });
  });
}
