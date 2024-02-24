const { setIcon } = require("obsidian");
class SmartNotices {
  constructor(main) {
    this.main = main; // main plugin instance
    this.active = {};
  }
  show(id, message, opts = {}) {
    // if notice is muted, return
    if (this.main.settings.muted_notices?.[id]) {
      console.log("Notice is muted");
      if (opts.confirm) opts.confirm.callback(); // if confirm callback, run it
      return;
    }
    const content = this.build(id, message, opts);
    // if notice is already active, update message
    if (this.active[id] && this.active[id].noticeEl?.parentElement) {
      // console.log("updating notice");
      return this.active[id].setMessage(content, opts.timeout);
    }
    console.log("showing notice");
    return this.render(id, content, opts);
  }
  render(id, content, opts) {
    this.active[id] = new this.main.obsidian.Notice(content, opts.timeout);
    return this.active[id];
  }
  build(id, message, opts = {}) {
    const frag = document.createDocumentFragment();
    const head = frag.createEl("p", { cls: "sc-notice-head", text: "[Smart Connections]" });
    const content = frag.createEl("p", { cls: "sc-notice-content" });
    const actions = frag.createEl("div", { cls: "sc-notice-actions" });
    if (typeof message === 'string') content.innerText = message;
    else if (Array.isArray(message)) content.innerHTML = message.join("<br>");
    if (opts.confirm) this.add_btn(opts.confirm, actions);
    if (opts.button) this.add_btn(opts.button, actions);
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
      if (!this.main.settings.muted_notices) this.main.settings.muted_notices = {};
      this.main.settings.muted_notices[id] = true;
      this.main.save_settings();
      this.main.show_notice("Notice muted");
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
}
exports.SmartNotices = SmartNotices;