import { ThreadSourceAdapter } from "./_adapter.js";

/**
 * @class EnvJsonThreadSourceAdapter
 * @extends ThreadSourceAdapter
 * @description for persisting OpenAI chat completion responses to JSON files
 */
export class EnvJsonThreadSourceAdapter extends ThreadSourceAdapter {
  static extensions = ['json'];
  static extension = 'json';
  extension = 'json';
  to_source_data(){
    const all_block_keys = [...Object.keys(this.data.messages)];
    if(Object.keys(this.data.branches).length){
      const branches = Object.values(this.data.branches);
      const branch_block_keys = {};
      branches.forEach(branch => {
        branch.forEach(branch_messages => {
          Object.keys(branch_messages).forEach(key => {
            branch_block_keys[key] = true;
          });
        });
      });
      all_block_keys.push(...Object.keys(branch_block_keys));
    }
    const blocks = all_block_keys.map(sub_key => {
      const block_key = this.item.key + '#' + sub_key;
      const block = this.item.env.smart_messages.get(block_key);
      if(!block) {
        console.warn('block not found', block_key);
        return null;
      }
      return {
        ...block.data,
        key: block_key,
      };
    }).filter(block => block);
    return JSON.stringify({
      ...this.item.data,
      blocks,
    }, null, 2);
  }
  from_source_data(source_data) {
    const parsed_data = JSON.parse(source_data);
    this.item.data = {...parsed_data, blocks: undefined};
    parsed_data.blocks.forEach(block => {
      this.item.env.smart_messages.items[block.key] = new this.item.env.smart_messages.item_type(
        this.item.env,
        block
      );
    });
  }
}