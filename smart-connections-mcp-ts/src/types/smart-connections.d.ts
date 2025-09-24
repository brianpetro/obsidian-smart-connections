// Type declarations for Smart Connections libraries
declare module 'obsidian-smart-env' {
  export class SmartEnv {
    static create(config: any): Promise<SmartEnv>;
    smart_sources: any;
    smart_blocks: any;
  }
}

declare module 'smart-collections/adapters/ajson_multi_file.js' {
  export class AjsonMultiFileCollectionDataAdapter {
    constructor(config?: any);
  }
}

declare module 'smart-utils' {
  export function cos_sim(vecA: number[], vecB: number[]): number;
  export function get_nearest_until_next_dev_exceeds_std_dev(results: any[]): any[];
}

declare module 'smart-embed-model' {
  export class SmartEmbedModel {
    constructor(config: any);
    load(): Promise<void>;
    embed(content: string): Promise<{ vec: number[] } | number[]>;
  }
}