import { setIcon } from "obsidian";

export class SmartNotices {
  constructor(main) {
    this.main = main; // main plugin instance
    this.active = {};
  }
  get settings() {
    if(!this.main.env.settings.smart_notices) this.main.env.settings.smart_notices = {muted: {}};
    return this.main.env.settings.smart_notices;
  }
  get adapter() { return this.main.env.opts.modules.smart_notices.adapter; }
  show(id, message, opts = {}) {
    if(typeof opts.timeout === 'undefined') opts.timeout = 5000; // default timeout
    // if notice is muted, return
    if (this.settings.muted?.[id]) {
      // console.log("Notice is muted");
      if(opts.confirm && typeof opts.confirm.callback === 'function') opts.confirm.callback.call(); // if confirm callback, run it
      return;
    }
    const content = this.build(id, message, opts);
    // if notice is already active, update message
    if (this.active[id] && this.active[id].noticeEl?.parentElement) {
      // console.log("updating notice");
      return this.active[id].setMessage(content, opts.timeout);
    }
    // console.log("showing notice");
    return this.render(id, content, opts);
  }
  render(id, content, opts) {
    this.active[id] = new this.adapter(content, opts.timeout);
    return this.active[id];
  }
  build(id, message, opts = {}) {
    const frag = document.createDocumentFragment();
    const head = frag.createEl("p", { cls: "sc-notice-head", text: `[Smart Connections v${this.main.manifest.version}]` });
    const content = frag.createEl("p", { cls: "sc-notice-content" });
    const actions = frag.createEl("div", { cls: "sc-notice-actions" });
    if (typeof message === 'string') content.innerText = message;
    else if (Array.isArray(message)) content.innerHTML = message.join("<br>");
    if(opts.confirm) this.add_btn(opts.confirm, actions);
    if(opts.button) this.add_btn(opts.button, actions);
    if(!opts.immutable) this.add_mute_btn(id, actions);
    return frag;
  }
  add_btn(button, container) {
    const btn = document.createElement("button");
    btn.innerHTML = button.text;
    btn.addEventListener("click", (e) => {
      if (button.stay_open) {
        e.preventDefault();
        e.stopPropagation();
      }
      button.callback();
    });
    container.appendChild(btn);
  }
  add_mute_btn(id, container) {
    const btn = document.createElement("button");
    setIcon(btn, "bell-off");
    // btn.innerHTML = "Mute";
    btn.addEventListener("click", () => {
      if(!this.settings.muted) this.settings.muted = {};
      this.settings.muted[id] = true;
      this.show("Notice muted", "Notice muted", { timeout: 2000 });
    });
    container.appendChild(btn);
  }
  unload() {
    for (let id in this.active) {
      this.remove(id);
    }
  }
  remove(id) {
    this.active[id]?.hide();
    delete this.active[id];
  }
  // begin plugin specific methods
  show_requires_smart_view() {
    const btn = { text: "Open Smart View", callback: () => { this.main.open_view(false); } };
    const msg = "Smart View must be open to utilize all Smart Chat features. For example, asking things like \"Based on my notes...\" requires Smart View to be open.";
    this.show('requires smart view', msg, { button: btn, timeout: 0 });
  }
}