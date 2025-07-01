import { Modal } from "obsidian";

export class SmartNoteInspectModal extends Modal {
  constructor(smart_connections_plugin, entity) {
    super(smart_connections_plugin.app);
    this.smart_connections_plugin = smart_connections_plugin;
    this.entity = entity;
  }
  get env() {
    return this.smart_connections_plugin.env;
  }
  onOpen() {
    this.titleEl.innerText = this.entity.key;
    this.render();
  }
  async render() {
    this.contentEl.empty();

    const frag = await this.env.render_component('source_inspector', this.entity);

    this.contentEl.appendChild(frag);
  }

}
