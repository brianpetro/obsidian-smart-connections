import { cos_sim } from "smart-entities/utils/cos_sim.js";
import { register_connections_score_command } from "./connections_score_column_modal.js";
export function register_bases_integration(plugin) {
	if (plugin.app.internalPlugins.plugins.bases?.enabled) {
		plugin.registerInstanceFunc({type: 'File'}, SmartCosSim);
		plugin.app.workspace.registerOperatorFuncConfigs("bases", [
			...plugin.app.workspace.operatorFuncConfigs?.bases || [],
			{
				funcName: "cos_sim",
				display: "Embedding similarity",
				inverseDisplay: "Embedding dissimilarity",
			}
		]);
		// this.app.internalPlugins.plugins.bases?.instance?.registerFunction(new SmartCosSim(this.app));
		plugin.register(() => {
			console.log("unregistering Smart Cos Sim");
			plugin.app.workspace?.unregisterOperatorFuncConfigs("bases", ['cos_sim']);
		});
		register_connections_score_command(plugin);
	}
}
export class SmartCosSim {
	constructor(app){
		this.app = app;
	}
	name = "cos_sim";
	params = [
		{
			name: "file",
			type: ["self"]
		},
		{
			name: "compared_to",
			type: ["file"]
		}
	];
	apply(a, b){
    try{
			if(!smart_env || smart_env.state !== 'loaded') return "Loading...";
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