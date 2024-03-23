class SmartSocket {
  constructor(port) {
    this.port = port;
    this.is_connecting = false;
    this.ws_retries = 0;
  }

  async connect(retry = false) {
    if (!this.can_attempt_connection(retry)) return;

    this.is_connecting = true;
    await this.calculate_backoff(retry);

    try {
      await this.initialize_websocket();
      this.ws_retries = 0; // Reset retries on successful connection
    } catch (err) {
      this.handle_connection_error(retry, err);
    } finally {
      this.is_connecting = false;
    }
  }

  can_attempt_connection(retry) {
    if (this.is_connecting) {
      console.log("WebSocket is currently connecting/reconnecting. Aborting new connection attempt.");
      return false;
    }
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log("WebSocket is already connected. Aborting new connection attempt.");
      return false;
    }
    if (retry && this.ws_retries > 10) {
      console.error("Failed to reconnect after 10 attempts");
      this.is_connecting = false;
      this.on_fail_to_reconnect();
      return false;
    }
    return true;
  }

  calculate_backoff(retry) {
    if (retry) {
      this.ws_retries += 1;
      const backoff_time = Math.min(1000 * Math.pow(2, this.ws_retries), 30000);
      console.log(`Attempting to reconnect in ${backoff_time / 1000} seconds...`);
      return new Promise(resolve => setTimeout(resolve, backoff_time));
    }
  }

  async initialize_websocket() {
    await new Promise((resolve, reject) => {
      const timeout_id = setTimeout(() => {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
          this.ws?.close();
          reject(new Error('WebSocket failed to connect'));
        }
      }, 10000);

      this.ws = new WebSocket(`ws://localhost:${this.port}`);
      this.ws.onopen = () => {
        clearTimeout(timeout_id);
        this.on_open();
        resolve();
      };
      this.ws.onclose = () => {
        reject(new Error('WebSocket closed'));
        this.on_close();
      };
      this.ws.onerror = (err) => {
        reject(err);
        this.on_error(err);
      };
      this.ws.onmessage = this.handle_message.bind(this);
    });
  }

  handle_connection_error(retry, err) {
    if (this.ws_retries < 10) {
      this.connect(true); // Retry with backoff
    } else {
      console.error("Failed to connect to WebSocket:", err);
    }
  }

  on_error(err) {
    // console.error("WebSocket error", err);
  }

  on_close() {
    console.log("Disconnected from WebSocket");
    this.connect(true); // Attempt to reconnect with backoff
  }

  on_open() {
    console.log(`Connected to WebSocket on port ${this.port}`);
  }

  handle_message(event) {
    console.log("Message from server", event.data);
  }

  on_fail_to_reconnect() {
    console.error("Failed to reconnect, will not retry...");
  }
}
exports.SmartSocket = SmartSocket;
