class SmartSocket {
  constructor(port) {
    this.port = port;
  }
  async connect_to_websocket() {
    try {
      await new Promise((resolve, reject) => {
        this.ws = new WebSocket(`ws://localhost:${this.port}`);
        this.ws.onopen = () => {
          this.on_open();
          resolve();
        };
        this.ws.onclose = () => {
          const error = new Error('WebSocket closed');
          reject(error);
          this.on_close();
        };
        this.ws.onerror = (err) => {
          reject(err);
          this.on_error(err);
        };
        this.ws.onmessage = this.handle_message.bind(this);
      });
      console.log("WebSocket connected successfully.");
    } catch (err) {
      console.error("Failed to connect to WebSocket:", err);
      // Handle the error appropriately
    }
  }
  on_error(err) {
    console.error("Websocket error", err);
    // this.reconnect_to_websocket();
  }
  on_close() {
    console.log("Disconnected from websocket", event.reason);
    // this.reconnect_to_websocket();
  }
  on_open() {
    console.log("Connected to websocket");
  }
  async reconnect_to_websocket() {
    if (this.ws && this.ws.readyState === 1) return; // If the websocket is still open, no need to reconnect
    if (this.ws_retries && this.ws_retries > 10) {
      console.error("Failed to reconnect after 10 attempts");
      return;
    }
    this.ws_retries = this.ws_retries ? this.ws_retries + 1 : 1; // Initialize or increment retries
    const backoffTime = Math.pow(2, this.ws_retries) * 1000; // Exponential backoff
    console.log(`Reconnecting in ${backoffTime / 1000} seconds...`);
    this.ws_reconnect_interval = setInterval(async () => {
      try {
        clearInterval(this.ws_reconnect_interval); // Clear the interval once connected
        await this.connect_to_websocket();
        this.ws_retries = 0; // Reset retries
      } catch (err) {
        console.error("Failed to reconnect, retrying...", err);
      }
    }, backoffTime);
  }
  handle_message(event) {
    console.log("Message from server ", event.data);
  }
}
exports.SmartSocket = SmartSocket;