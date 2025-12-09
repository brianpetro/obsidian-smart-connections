import { StoryModal } from 'obsidian-smart-env/src/modals/story.js';
import { open_url_externally } from 'obsidian-smart-env/utils/open_url_externally.js';
async function build_html(scope_plugin) {
  return `
    <div>
      <div data-user-agreement></div>
      <div class="actions-container">
        <button class="sc-getting-started-button">Getting started guide</button>
        <button class="sc-report-bug-button">Report a bug</button>
        <button class="sc-request-feature-button">Request a feature</button>
        <button class="sc-share-workflow-button">Share workflow ⭐</button>
      </div>
    </div>
  `;
}

export async function render(scope_plugin) {
  const html = await build_html.call(this, scope_plugin);
  const frag = this.create_doc_fragment(html);
  const container = frag.firstElementChild;
  post_process.call(this, scope_plugin, container);
  return container;
}

export async function post_process(scope_plugin, frag) {
  /* user agreement & env settings */
  const user_agreement_container = frag.querySelector('[data-user-agreement]');
  if (user_agreement_container) {
    const user_agreement = await scope_plugin.env.render_component(
      'user_agreement_callout',
      scope_plugin
    );
    user_agreement_container.appendChild(user_agreement);
  }

  /* header external links */
  const header_link = frag.querySelector('#header-callout a');
  if (header_link) {
    header_link.addEventListener('click', (e) => {
      e.preventDefault();
      open_url_externally(scope_plugin, header_link.href);
    });
  }

  /* buttons */
  frag.querySelector('.sc-getting-started-button')?.addEventListener('click', () => {
    StoryModal.open(scope_plugin, {
      title: 'Getting Started With Smart Connections',
      url: 'https://smartconnections.app/story/smart-connections-getting-started/?utm_source=sc-op-settings'
    });
  });

  frag.querySelector('.sc-report-bug-button')?.addEventListener('click', () => {
    open_url_externally(
      scope_plugin,
      'https://github.com/brianpetro/obsidian-smart-connections/issues/new?template=bug_report.yml'
    );
  });

  frag.querySelector('.sc-request-feature-button')?.addEventListener('click', () => {
    open_url_externally(
      scope_plugin,
      'https://github.com/brianpetro/obsidian-smart-connections/issues/new?template=feature_request.yml'
    );
  });

  frag.querySelector('.sc-share-workflow-button')?.addEventListener('click', () => {
    open_url_externally(
      scope_plugin,
      'https://github.com/brianpetro/obsidian-smart-connections/discussions/new?category=showcase'
    );
  });

  return frag;
}
