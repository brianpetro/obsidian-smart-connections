/**
 * @class SmartChatDataAdapter
 * @description Base adapter class for chat data format conversions.
 * Provides interface for converting between internal format and various chat formats.
 */
export class ThreadSourceAdapter {
  /**
   * @constructor
   * @param {SmartThread} item - The SmartThread instance this adapter is attached to
   */
  constructor(item) {
    this.item = item;
  }

  /**
   * @property {Object} data - The underlying data of the SmartThread
   * @readonly
   */
  get data() { return this.item.data; }
  get fs() { return this.item.collection.fs; }
  get created_at() { return this.item.created_at; }
  get file_path() { return this.item.path; }

  /**
   * @property {Object} env - The environment configuration
   * @readonly
   */
  get env() { return this.item.env; }

  /**
   * Converts adapter file format to `item.source_data{}` format
   * @abstract
   * @throws {Error} Must be implemented by subclasses
   */
  to_source_data() { throw new Error('to_source_data() not implemented'); }

  /**
   * Converts `item.source_data{}` format to adapter file format
   * @abstract
   * @throws {Error} Must be implemented by subclasses
   */
  from_source_data(source_data) { throw new Error('from_source_data() not implemented'); }

  async import() {
    const source_data = await this.read();
    if(!source_data) return console.warn('no source data found for', this);
    this.from_source_data(source_data);
  }

  async read() {
    return await this.fs.read(this.file_path);
  }
  async save(){
    if(Object.keys(this.data.messages).length){
      this.fs.write(this.file_path, this.to_source_data());
    }
  }
  async rename(new_name) {
    const old_key = this.item.key;
    const old_file_path = this.file_path;
    // update message keys
    this.item.messages.forEach(msg => {
      msg.data.key = msg.key.replace(old_key, new_name);
      msg.data.thread_key = new_name;
      this.item.env.smart_messages.items[msg.key] = msg;
    });
    // update item data after messages are updated
    this.data.path = null;
    this.data.key = new_name;
    this.item.collection.items[new_name] = this.item;
    delete this.item.collection.items[old_key];
    // save and remove old file
    await this.save();
    await this.fs.remove(old_file_path);
    // re-render item
    this.item.render();
  }

}