// Handle API response streaming
class ScStreamer {
  // constructor
  constructor(url, options) {
    // set default options
    options = options || {};
    this.url = url;
    this.method = options.method || 'GET';
    this.headers = options.headers || {};
    this.body = options.body || null;
    this.withCredentials = options.withCredentials || false;
    this.listeners = {};
    this.readyState = this.CONNECTING;
    this.progress = 0;
    this.chunk = '';
    this.xhr = null;
    this.FIELD_SEPARATOR = ':';
    this.INITIALIZING = -1;
    this.CONNECTING = 0;
    this.OPEN = 1;
    this.CLOSED = 2;
  }
  // addEventListener
  addEventListener(type, listener) {
    // check if the type is in the listeners
    if (!this.listeners[type]) {
      this.listeners[type] = [];
    }
    // check if the listener is already in the listeners
    if (this.listeners[type].indexOf(listener) === -1) {
      this.listeners[type].push(listener);
    }
  }
  // removeEventListener
  removeEventListener(type, listener) {
    // check if listener type is undefined
    if (!this.listeners[type]) {
      return;
    }
    let filtered = [];
    // loop through the listeners
    for (let i = 0; i < this.listeners[type].length; i++) {
      // check if the listener is the same
      if (this.listeners[type][i] !== listener) {
        filtered.push(this.listeners[type][i]);
      }
    }
    // check if the listeners are empty
    if (this.listeners[type].length === 0) {
      delete this.listeners[type];
    } else {
      this.listeners[type] = filtered;
    }
  }
  // dispatchEvent
  dispatchEvent(event) {
    // if no event return true
    if (!event) {
      return true;
    }
    // set event source to this
    event.source = this;
    // set onHandler to on + event type
    let onHandler = 'on' + event.type;
    // check if the onHandler has own property named same as onHandler
    if (this.hasOwnProperty(onHandler)) {
      // call the onHandler
      this[onHandler].call(this, event);
      // check if the event is default prevented
      if (event.defaultPrevented) {
        return false;
      }
    }
    // check if the event type is in the listeners
    if (this.listeners[event.type]) {
      return this.listeners[event.type].every(function (callback) {
        callback(event);
        return !event.defaultPrevented;
      });
    }
    return true;
  }
  // _setReadyState
  _setReadyState(state) {
    // set event type to readyStateChange
    let event = new CustomEvent('readyStateChange');
    // set event readyState to state
    event.readyState = state;
    // set readyState to state
    this.readyState = state;
    // dispatch event
    this.dispatchEvent(event);
  }
  // _onStreamFailure
  _onStreamFailure(e) {
    // set event type to error
    let event = new CustomEvent('error');
    // set event data to e
    event.data = e.currentTarget.response;
    // dispatch event
    this.dispatchEvent(event);
    this.close();
  }
  // _onStreamAbort
  _onStreamAbort(e) {
    // set to abort
    let event = new CustomEvent('abort');
    // close
    this.close();
  }
  // _onStreamProgress
  _onStreamProgress(e) {
    // if not xhr return
    if (!this.xhr) {
      return;
    }
    // if xhr status is not 200 return
    if (this.xhr.status !== 200) {
      // onStreamFailure
      this._onStreamFailure(e);
      return;
    }
    // if ready state is CONNECTING
    if (this.readyState === this.CONNECTING) {
      // dispatch event
      this.dispatchEvent(new CustomEvent('open'));
      // set ready state to OPEN
      this._setReadyState(this.OPEN);
    }
    // parse the received data.
    let data = this.xhr.responseText.substring(this.progress);
    // update progress
    this.progress += data.length;
    // split the data by new line and parse each line
    data.split(/(\r\n|\r|\n){2}/g).forEach(function (part) {
      if (part.trim().length === 0) {
        this.dispatchEvent(this._parseEventChunk(this.chunk.trim()));
        this.chunk = '';
      } else {
        this.chunk += part;
      }
    }.bind(this));
  }
  // _onStreamLoaded
  _onStreamLoaded(e) {
    this._onStreamProgress(e);
    // parse the last chunk
    this.dispatchEvent(this._parseEventChunk(this.chunk));
    this.chunk = '';
  }
  // _parseEventChunk
  _parseEventChunk(chunk) {
    // if no chunk or chunk is empty return
    if (!chunk || chunk.length === 0) {
      return null;
    }
    // init e
    let e = { id: null, retry: null, data: '', event: 'message' };
    // split the chunk by new line
    chunk.split(/(\r\n|\r|\n)/).forEach(function (line) {
      line = line.trimRight();
      let index = line.indexOf(this.FIELD_SEPARATOR);
      if (index <= 0) {
        return;
      }
      // field
      let field = line.substring(0, index);
      if (!(field in e)) {
        return;
      }
      // value
      let value = line.substring(index + 1).trimLeft();
      if (field === 'data') {
        e[field] += value;
      } else {
        e[field] = value;
      }
    }.bind(this));
    // return event
    let event = new CustomEvent(e.event);
    event.data = e.data;
    event.id = e.id;
    return event;
  }
  // _checkStreamClosed
  _checkStreamClosed() {
    if (!this.xhr) {
      return;
    }
    if (this.xhr.readyState === XMLHttpRequest.DONE) {
      this._setReadyState(this.CLOSED);
    }
  }
  // stream
  stream() {
    // set ready state to connecting
    this._setReadyState(this.CONNECTING);
    // set xhr to new XMLHttpRequest
    this.xhr = new XMLHttpRequest();
    // set xhr progress to _onStreamProgress
    this.xhr.addEventListener('progress', this._onStreamProgress.bind(this));
    // set xhr load to _onStreamLoaded
    this.xhr.addEventListener('load', this._onStreamLoaded.bind(this));
    // set xhr ready state change to _checkStreamClosed
    this.xhr.addEventListener('readystatechange', this._checkStreamClosed.bind(this));
    // set xhr error to _onStreamFailure
    this.xhr.addEventListener('error', this._onStreamFailure.bind(this));
    // set xhr abort to _onStreamAbort
    this.xhr.addEventListener('abort', this._onStreamAbort.bind(this));
    // open xhr
    this.xhr.open(this.method, this.url);
    // headers to xhr
    for (let header in this.headers) {
      this.xhr.setRequestHeader(header, this.headers[header]);
    }
    // credentials to xhr
    this.xhr.withCredentials = this.withCredentials;
    // send xhr
    this.xhr.send(this.body);
  }
  // close
  close() {
    if (this.readyState === this.CLOSED) {
      return;
    }
    this.xhr.abort();
    this.xhr = null;
    this._setReadyState(this.CLOSED);
  }
}
exports.ScStreamer = ScStreamer;
