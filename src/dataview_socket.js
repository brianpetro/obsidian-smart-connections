const { SmartSocket } = require("./smart_socket");

class DataviewSocket extends SmartSocket {
  constructor(env, port) {
    super(port);
    this.env = env;
    this.brain = this.env; // DEPRECATED
    this.dataview_api = null;
  }
  static async create(env, port) {
    const smart_socket = new DataviewSocket(env, port);
    env.dv_ws = smart_socket;
    await smart_socket.init();
    return smart_socket;
  }
  async init() {
    await this.get_dataview_api();
    await this.connect();
    // console.log("DataviewSocket initialized");
  }
  async is_server_running(){
    try{
      const sc_local = await this.env.main.obsidian?.requestUrl({url: 'http://localhost:37421/', method: 'GET'});
      console.log(sc_local);
      return sc_local?.status === 200;
    }catch(err){
      // console.error(err);
      return false;
    }
  }
  async get_dataview_api(retries = 0) {
    this.dataview_api = window["DataviewAPI"];
    if (!this.dataview_api) {
      if (retries < 10) {
        await new Promise(resolve => setTimeout(resolve, retries * 1000));
        return this.get_dataview_api(retries + 1);
      } else {
        this.brain.main.show_notice("Dataview API not found");
      }
    }
  }
  async handle_message(event) {
    console.log("Message from server ", event.data);
    console.log(typeof event.data);
    const data = JSON.parse(event.data);
    if(data.fx === 'full_render'){
      const rendered = await this.full_render(data.markdown, data.rel_path);
      this.ws.send(JSON.stringify({ status: "ok", rendered: rendered }));
      return;
    }
    if(data.fx === 'current_note'){
      const current = await this.current_note();
      this.ws.send(JSON.stringify(current));
      return;
    }
    try {
      const resp = await this.dataview_api.queryMarkdown(data.query, data.rel_path, null);
      console.log(resp);
      this.ws.send(JSON.stringify(resp));
    } catch (err) {
      console.error(err);
      this.ws.send(JSON.stringify({ status: "error", message: err }));
    }
  }
  async current_note(){
    const curr_file = this.env.plugin.app.workspace.getActiveFile();
    if(!curr_file) return {path: null, content: null};
    let content = await this.env.cached_read(curr_file);
    return {
      path: curr_file.path,
      content: content,
    };
  }
  async full_render(markdown, rel_path){
    const html_elm = document.createElement("div");
    const { MarkdownRenderer, htmlToMarkdown, Component } = this.env.plugin.obsidian;
    await MarkdownRenderer.render(this.env.plugin.app, markdown, html_elm, rel_path, new Component());
    // wait for no more changes to the html_elm
    let html = html_elm.innerHTML;
    await new Promise(resolve => setTimeout(resolve, 200));
    while(html !== html_elm.innerHTML){
      html = html_elm.innerHTML;
      await new Promise(resolve => setTimeout(resolve, 200));
      console.log("waiting for changes");
    }
    // note: htmlToMarkdown returns markdown links instead of wiki links
    // would have expected it to be consistent with Obsidian wikilinks usage since it's an Obsidian method
    return htmlToMarkdown(html_elm.innerHTML);
  }
}
exports.DataviewSocket = DataviewSocket;
