const { SmartSocket } = require("./smart_socket");

class DataviewSocket extends SmartSocket {
  constructor(brain, port) {
    super(port);
    this.brain = brain;
    this.dataview_api = null;
  }
  static async create(brain, port) {
    const smartSocket = new DataviewSocket(brain, port);
    await smartSocket.init();
    return smartSocket;
  }
  async init() {
    await this.get_dataview_api();
    await this.connect_to_websocket();
    console.log("DataviewSocket initialized");
  }
  unload() {
    if (this.ws) this.ws.close();
    this.ws = null;
  }
  async get_dataview_api(retries = 0) {
    this.dataview_api = window["DataviewAPI"];
    if (!this.dataview_api) {
      if (retries < 10) {
        await new Promise(resolve => setTimeout(resolve, retries * 1000));
        return this.get_dataview_api(retries + 1);
      } else {
        this.brain.main.notices.show("Dataview API not found", "Dataview API not found");
      }
    }
  }
  async handle_message(event) {
    console.log("Message from server ", event.data);
    console.log(typeof event.data);
    const data = JSON.parse(event.data);
    try {
      const resp = await this.dataview_api.queryMarkdown(data.query, data.rel_path, null);
      console.log(resp);
      this.ws.send(JSON.stringify(resp));
    } catch (err) {
      console.error(err);
      this.ws.send(JSON.stringify({ status: "error", message: err }));
    }
  }
  on_open() {
    console.log("Connected to websocket");
    this.brain.local_model_type = "websocket";
    // this.brain.reload();
  }
  on_close() {
    console.log("Disconnected from websocket", event.reason);
    this.brain.local_model_type = "Web";
    // this.brain.reload();
    // this.reconnect_to_websocket();
  }
}
exports.DataviewSocket = DataviewSocket;
