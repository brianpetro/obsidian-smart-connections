import { Modal } from 'obsidian';

/**
 * Modal to render connections filter settings.
 */
export class ConnectionsFilterModal extends Modal {
  constructor(app, env, connections_filter = {}) {
    super(app);
    this.env = env;
    this.connections_filter = connections_filter;
  }

  async onOpen() {
    this.titleEl.setText('Connections Filter');
    this.contentEl.empty();
    console.log('Opening ConnectionsFilterModal with codeblock_ctx:', this.connections_filter);
    const connections_settings_frag = await this.env.smart_view.render_settings(
      this.env.smart_sources.connections_filter_config,
      { scope: { settings: { smart_view_filter: this.connections_filter } } }
    );
    this.contentEl.appendChild(connections_settings_frag);
  }
}
