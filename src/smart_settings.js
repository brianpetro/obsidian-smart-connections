const { Setting } = require("obsidian");
// const ejs = require("../ejs.min");
class SmartSettings {
  constructor(env, container, template_name = "smart_settings") {
    this.env = env;
    this.plugin = this.env.plugin;
    this.settings = this.plugin.settings;
    this.container = container;
    this.template_name = template_name;
    this.ejs = this.env.ejs;
    this.templates = this.env.templates;
  }
  async render() {
    const view_data = (typeof this.get_view_data === "function") ? await this.get_view_data() : this.view_data;
    this.render_template(view_data);
    this.render_components();
  }
  render_template(view_data = null) {
    if (!this.template) throw new Error(`Settings template not found.`);
    this.container.empty();
    this.container.innerHTML = this.ejs.render(this.template, view_data || this.view_data, { context: this });
  }
  async update(setting, value) {
    console.log("saving setting: " + setting);
    if (setting.includes(".")) {
      let parts = setting.split(".");
      let obj = this.plugin.settings;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!obj[parts[i]]) obj[parts[i]] = {};
        obj = obj[parts[i]];
      }
      obj[parts[parts.length - 1]] = (typeof value === "string") ? value.trim() : value;
    } else {
      this.plugin.settings[setting] = (typeof value === "string") ? value.trim() : value;
    }
    await this.plugin.save_settings(true);
    console.log("saved settings");
    console.log(this.plugin.settings);
  }
  render_components() {
    this.container.querySelectorAll(".setting-component").forEach(elm => {
      const setting_elm = new Setting(elm);
      if (elm.dataset.name) setting_elm.setName(elm.dataset.name);
      if (elm.dataset.description) setting_elm.setDesc(elm.dataset.description);
      const setting = elm.dataset.setting;
      if (elm.dataset.type === "text") {
        setting_elm.addText(text => {
          text.setPlaceholder(elm.dataset.placeholder || "");
          text.setValue(this.get_setting(setting));
          let debounceTimer;
          if (elm.dataset.button) {
            setting_elm.addButton(button => {
              button.setButtonText(elm.dataset.button);
              button.onClick(async () => this.handle_on_change(setting, text.getValue(), elm));
            });
          } else {
            text.onChange(async (value) => {
              clearTimeout(debounceTimer);
              debounceTimer = setTimeout(() => this.handle_on_change(setting, value, elm), 2000);
            });
          }
        });
      } else if (elm.dataset.type === "number") {
        setting_elm.addText(number => {
          number.inputEl.type = "number";
          number.setPlaceholder(elm.dataset.placeholder || "");
          number.inputEl.value = parseInt(this.get_setting(setting));
          number.inputEl.min = elm.dataset.min || 0;
          if (elm.dataset.max) number.inputEl.max = elm.dataset.max;
          let debounceTimer;
          number.onChange(async (value) => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => this.handle_on_change(setting, parseInt(value), elm), 2000);
          });
        });
      } else if (elm.dataset.type === "dropdown") {
        setting_elm.addDropdown(dropdown => {
          Object.entries(elm.dataset)
            .filter(([k, v]) => k.startsWith("option"))
            .forEach(([k, v]) => {
              const [value, name] = v.split("|");
              dropdown.addOption(value, name || value);
            });
          dropdown.onChange(async (value) => this.handle_on_change(setting, value, elm));
          dropdown.setValue(this.get_setting(setting));
        });
      } else if (elm.dataset.type === "button") {
        setting_elm.addButton(button => {
          button.setButtonText(elm.dataset.btnText || elm.dataset.name);
          button.onClick(async () => {
            if (elm.dataset.confirm) {
              const confirmation_message = elm.dataset.confirm;
              if (!confirm(confirmation_message)) return;
            }
            if (elm.dataset.href) window.open(elm.dataset.href);
            if (elm.dataset.callback) this[elm.dataset.callback](setting);
          });
        });
      } else if (elm.dataset.type === "toggle") {
        setting_elm.addToggle(toggle => {
          toggle.setValue(this.get_setting(setting));
          toggle.onChange(async (value) => this.handle_on_change(setting, value, elm));
        });
      }
      if (elm.dataset.disabled) setting_elm.setDisabled(true);
    });
  }
  async handle_on_change(setting, value, elm) {
    await this.update(setting, value);
    if (elm.dataset.callback) this[elm.dataset.callback](setting, value, elm);
  }
  get_setting(setting) {
    if (setting.includes(".")) {
      let parts = setting.split(".");
      let obj = this.plugin.settings;
      for (let part of parts.slice(0, -1)) {
        if (obj[part] === undefined) return this.plugin.constructor.defaults[setting]; // Fallback to default if path is broken
        obj = obj[part];
      }
      return obj[parts[parts.length - 1]] || this.plugin.constructor.defaults[setting];
    } else {
      return this.plugin.settings[setting] || this.plugin.constructor.defaults[setting];
    }
  }
  // override in subclass (required)
  get template() { return ""; } // ejs template string
  get view_data() { return {}; } // object properties available in template
}
exports.SmartSettings = SmartSettings;