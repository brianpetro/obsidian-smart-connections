import { SmartObsidianView } from "./smart_view.obsidian.js";

export class SmartChatGPTView extends SmartObsidianView {
  static get view_type() { return 'smart-chatgpt-view'; }
  static get display_text() { return "Smart ChatGPT"; }
  static get icon_name() { return "bot"; }
  getViewType() { return this.constructor.view_type; }
  getDisplayText() { return this.constructor.display_text; }
  getIcon() { return this.constructor.icon_name; }
  static get_leaf(workspace) { return workspace.getLeavesOfType(this.view_type)?.find((leaf) => leaf.view instanceof this); }
  static open(workspace, active = true) {
    if (this.get_leaf(workspace)) this.get_leaf(workspace).setViewState({ type: this.view_type, active });
    else workspace.getRightLeaf(false).setViewState({ type: this.view_type, active });
    if(workspace.rightSplit.collapsed) workspace.rightSplit.toggle();
  }
  onload() {
    console.log("loading view");
    this.initialize();
  }
  initialize() {
    this.containerEl.empty();
    // Create button container for inline layout
    const buttonContainer = this.containerEl.createEl("div", {
      cls: "button-container",
    });
    buttonContainer.style.display = "flex";
    buttonContainer.style.gap = "8px";
    buttonContainer.style.marginBottom = "8px";

    // insert button to refresh
    const refreshButton = buttonContainer.createEl("button", {
      text: "Refresh",
    });
    refreshButton.addEventListener("click", () => {
      this.initialize();
    });

    // insert button to copy URL
    const copyUrlButton = buttonContainer.createEl("button", {
      text: "Copy URL",
    });
    copyUrlButton.addEventListener("click", () => {
      const current_url = this.frame?.getAttribute("src");
      if (current_url) {
        navigator.clipboard.writeText(current_url);
        // Optional: Show a notice that URL was copied
        if (this.plugin) {
          this.plugin.notices.show("copied_chatgpt_url_to_clipboard");
        }
      }
    });

    // insert ChatGPT
    this.containerEl.appendChild(this.create());
  }

  create() {
    this.frame = document.createElement("webview");
    this.frame.setAttribute("partition", "persist:smart-chatgpt");
    this.frame.setAttribute("nodeintegration", "");
    this.frame.setAttribute("contextisolation", "");
    this.frame.setAttribute("allowpopups", "");
    this.frame.style.width = "100%";
    this.frame.style.height = "100%";
    this.frame.setAttribute("src", "https://chatgpt.com");
    return this.frame;
  }
}