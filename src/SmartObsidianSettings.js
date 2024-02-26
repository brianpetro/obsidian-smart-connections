const { PluginSettingTab, Setting } = require("obsidian");
// const ejs = require("ejs");
const ejs = require("../ejs.min");

class SmartObsidianSettings extends PluginSettingTab {
  constructor(app, plugin, template_name = "smart_settings") {
    super(app, plugin);
    this.plugin = plugin;
    this.config = plugin.settings;
    this.container = this.containerEl;
    this.template_name = template_name;
  }
  display() { return this.render(); }
  render() {
    this.render_template();
    this.render_components();
  }
  render_template() {
    if (!this.template) throw new Error(`Settings template not found.`);
    this.container.empty();
    this.container.innerHTML = ejs.render(this.template, this.view_data, { context: this });
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
          if (elm.dataset.button) {
            setting_elm.addButton(button => {
              button.setButtonText(elm.dataset.button);
              button.onClick(async () => this.handle_on_change(setting, text.getValue(), elm));
            });
          } else {
            text.onChange(async (value) => this.handle_on_change(setting, value, elm));
          }
        });
      } else if (elm.dataset.type === "number") {
        setting_elm.addText(number => {
          number.inputEl.type = "number";
          number.setPlaceholder(elm.dataset.placeholder || "");
          number.inputEl.value = parseInt(this.get_setting(setting));
          number.inputEl.min = elm.dataset.min || 0;
          if (elm.dataset.max) number.inputEl.max = elm.dataset.max;
          number.onChange(async (value) => this.handle_on_change(setting, parseInt(value), elm));
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
          dropdown.setValue(this.plugin.settings[setting]);
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
          toggle.setValue(this.plugin.settings[setting]);
          toggle.onChange(async (value) => this.handle_on_change(setting, value, elm));
        });
      }
      if (elm.dataset.disabled) setting_elm.setDisabled(true);
    });
  }
  handle_on_change(setting, value, elm) {
    this.update(setting, value);
    if (elm.dataset.callback) this[elm.dataset.callback](setting, value, elm);
  }
  get_setting(setting) { return this.plugin.settings[setting] || this.plugin.constructor.defaults[setting]; }
  async update(setting, value) {
    console.log("saving setting: " + setting);
    this.plugin.settings[setting] = (typeof value === "string") ? value.trim() : value;
    await this.plugin.save_settings(true);
    console.log("saved settings");
    console.log(this.plugin.settings);
  }
  // override in subclass (required)
  get template() { return ""; } // ejs template string
  get view_data() { return {}; } // object properties available in template
}
exports.SmartObsidianSettings = SmartObsidianSettings;