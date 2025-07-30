export function create_deep_proxy(obj, callback, _proxied = new WeakSet()) {
  if (obj === null || typeof obj !== 'object' || _proxied.has(obj)) return obj;
  _proxied.add(obj);
  return new Proxy(obj, {
    set(target, prop, value) {
      target[prop] = create_deep_proxy(value, callback, _proxied);
      callback(obj);
      return true;
    },
    get(target, prop) {
      const value = target[prop];
      return create_deep_proxy(value, callback, _proxied);
    }
  });
}
