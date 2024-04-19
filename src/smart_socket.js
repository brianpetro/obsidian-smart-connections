class SmartSocket {
  /**
   * Creates an instance of SmartSocket.
   * @param {number} port The port number to connect to.
   */
  constructor(port) {
    this.port = port;
    this.ws_retries = 0;
    // Initialize ws as null to indicate no active WebSocket connection initially
    this.ws = null;
    this.retry = false;
  }

  /**
   * Initiates the connection process, with optional retry logic.
   * @param {boolean} [retry=false] Whether to attempt a reconnection.
   */
  async connect(retry = false) {
    this.retry = retry;
    if (!this.can_attempt_connection(retry)) return;

    if(retry) await this.calculate_backoff(retry);
    if(typeof this.is_server_running === 'function'){
      const is_running = await this.is_server_running();
      if(!is_running){
        console.log("Smart Connect is not running, will try to connect again later");
        this.connect(true);
        return;
      }
    }
    
    try {
      await this.initialize_websocket();
    } catch (err) {
      // console.error(`WebSocket connection error on retry ${this.ws_retries}: ${err.message}`);
      if (retry && ((this.ws_retries < 10) || (typeof this.is_server_running === 'function'))) {
        await this.handle_connection_error(true, err);
      } else {
        this.on_fail_to_reconnect();
      }
    }
  }

  /**
   * Checks if a new connection attempt can be made.
   * @param {boolean} retry Indicates if this is a retry attempt.
   * @returns {boolean} True if a connection attempt can be made, false otherwise.
   */
  can_attempt_connection(retry) {
    retry = retry || this.retry;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log("WebSocket is already connected. Aborting new connection attempt.");
      return false;
    }
    if (retry && this.ws_retries >= 10) {
      console.error("Failed to reconnect after 10 attempts");
      this.on_fail_to_reconnect();
      return false;
    }
    return true;
  }

  /**
   * Calculates and applies a backoff delay for reconnection attempts.
   * @param {boolean} retry Indicates if this is a retry attempt.
   * @returns {Promise<void>} A promise that resolves after the backoff delay.
   */
  calculate_backoff(retry) {
    if (retry || this.retry) {
      this.ws_retries += 1;
      const backoff_time = Math.min(1000 * Math.pow(2, this.ws_retries), 60000);
      console.log(`Attempting to reconnect in ${backoff_time / 1000} seconds...`);
      return new Promise(resolve => setTimeout(resolve, backoff_time));
    }
    return Promise.resolve();
  }

  /**
   * Initializes the WebSocket connection.
   * @returns {Promise<void>} A promise that resolves when the WebSocket is successfully opened.
   */
  async initialize_websocket() {
    // Clean up any existing WebSocket connection before initializing a new one
    this.cleanup_websocket();

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
        this.ws_retries = 0; // Reset retries on successful connection
        this.retry = true; // set retry since we know connection is available
        resolve();
      };
      this.ws.onclose = (event) => {
        this.cleanup_websocket(); // Ensure cleanup when the WebSocket is closed
        reject(new Error('WebSocket closed'));
        this.on_close();
      };
      this.ws.onerror = (err) => {
        this.cleanup_websocket(); // Ensure cleanup on error
        reject(err);
        this.on_error(err);
      };
      this.ws.onmessage = this.handle_message.bind(this);
    });
  }

  cleanup_websocket() {
    if (this.ws) {
      // Remove all event listeners to prevent memory leaks
      this.ws.onopen = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.onmessage = null;
      // Close the WebSocket if it's not already closed
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close();
      }
      this.ws = null; // Clear the reference to facilitate garbage collection
    }
  }

  /**
   * Handles connection errors and decides whether to retry.
   * @param {boolean} retry Indicates if this is a retry attempt.
   * @param {Error} err The error that occurred during connection.
   */
  async handle_connection_error(retry, err) {
    console.log("Handling WebSocket connection error on port " + this.port);
    if (retry && this.ws_retries < 10) {
      await this.connect(true); // Retry with backoff
    } else if (!retry || this.ws_retries >= 10) {
      console.error("Failed to connect to WebSocket after retries:");
      console.log(err);
      this.on_fail_to_reconnect();
    }
  }
  

  /**
   * Placeholder for error handling logic.
   * @param {Error} err The error encountered.
   */
  on_error(err) {
    // console.error("WebSocket error", err);
  }

  /**
   * Handles WebSocket closure and attempts reconnection.
   */
  on_close() {
    console.log("Disconnected from WebSocket");
  
    // Now, use the `should_attempt_reconnect` to decide whether to initiate a reconnection.
    if(this.retry && this.should_attempt_reconnect) {
      this.connect(true); // Attempt to reconnect with backoff
    } else {
      console.log("Reconnection not attempted due to policy (intentional disconnection or retry limit reached).");
      // Handle the case where no reconnection will be attempted, such as by informing the user.
    }
  }
  
  get should_attempt_reconnect() {
    return this.ws_retries < 10;
  }
  

  /**
   * Logs successful WebSocket connection.
   */
  on_open() {
    console.log(`Connected to WebSocket on port ${this.port}`);
  }

  /**
   * Handles incoming WebSocket messages.
   * @param {MessageEvent} event The message event.
   */
  handle_message(event) {
    console.log("Message from server", event.data);
  }

  /**
   * Handles failure to reconnect after multiple attempts.
   */
  on_fail_to_reconnect() {
    console.error("Failed to reconnect, will not retry...");
  }
  /**
   * Closes the WebSocket connection.
   */
  unload() {
    this.cleanup_websocket();
  }
}
exports.SmartSocket = SmartSocket;