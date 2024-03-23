class SmartSocket {
  constructor(port) {
    this.port = port;
    this.is_reconnecting = false; // Add a flag to track reconnection status
  }
  async connect_to_websocket() {
    // Check if already connected or in the process of reconnecting
    if (this.is_reconnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
      console.log("WebSocket is either already connected or reconnecting. Aborting new connection attempt.");
      return;
    }
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
      console.log("WebSocket connected successfully on port " + this.port);
      this.is_reconnecting = false; // Reset reconnection flag on successful connection
    } catch (err) {
      console.error("Failed to connect to WebSocket:", err);
      // Handle the error appropriately
    }
  }
  on_error(err) {
    console.error("Websocket error", err);
    this.reconnect_to_websocket(); // Call reconnect when an error occurs
  }
  on_close() {
    console.log("Disconnected from websocket");
    this.reconnect_to_websocket();
  }
  on_open() { console.log("Connected to websocket on port " + this.port); }
  async reconnect_to_websocket() {
    if (this.is_reconnecting) return; // Prevent multiple concurrent reconnection attempts
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return; // Check if the websocket is already open
    this.is_reconnecting = true; // Set reconnection flag
    if (this.ws_retries > 10) {
      console.error("Failed to reconnect after 10 attempts");
      this.is_reconnecting = false; // Reset reconnection flag if retries exceed limit
      this.on_fail_to_reconnect();
      return;
    }
    this.ws_retries = (this.ws_retries || 0) + 1;
    const backoffTime = Math.min(1000 * Math.pow(2, this.ws_retries), 30000);
    console.log(`Attempting to reconnect in ${backoffTime / 1000} seconds...`);
    setTimeout(async () => {
      try {
        await this.connect_to_websocket();
        this.ws_retries = 0; // Reset retry counter after successful connection
      } catch (err) {
        console.error("Reconnection attempt failed, will retry...", err);
        this.reconnect_to_websocket(); // Retry reconnecting
      }
    }, backoffTime);
  }
  handle_message(event) {
    console.log("Message from server ", event.data);
  }
  on_fail_to_reconnect() { console.log("Failed to reconnect, will not retry..."); }
}
exports.SmartSocket = SmartSocket;

