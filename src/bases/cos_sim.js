import { cos_sim } from "smart-entities/utils/cos_sim.js";
export class SmartCosSim {
	constructor(app){
		this.app = app;
	}
	isOperator = false;
	returnType = "number";
	name = "cos_sim";
	args = [
		{
			name: "file",
			type: ["this_file"]
		},
		{
			name: "compared_to",
			type: ["file"]
		}
	];
	getDisplayName() {
		return "embedding similarity"
	}
	apply(a, b){
    try{
      const a_key = a?.path ?? a;
      const b_key = b?.path ?? b;
			if(!a_key || !b_key) return 0;
      const item_a = smart_env.smart_sources.get(a_key);
      let item_b = smart_env.smart_sources.get(b_key);
      if(!item_b){
        const tfile_b = this.app.metadataCache.getFirstLinkpathDest(b_key, a_key)
        item_b = smart_env.smart_sources.get(tfile_b.path);
      }
      if(!item_a?.vec || !item_b?.vec){
        return 0;
      }
      return Math.round(cos_sim(item_a.vec, item_b.vec) * 1000) / 1000
    }catch(e){
      console.error(e);
      return 0;
    }
	}
}