import ScTranslations from "./ScTranslations.json" assert { type: "json" };
import { contains_folder_reference } from "./contains_folder_reference.js";
import { contains_internal_link } from "./contains_internal_link.js";
import { extract_internal_links } from "./extract_internal_links.js";
import { extract_folder_references } from "./extract_folder_references.js";
import { contains_system_prompt_ref, extract_system_prompt_ref } from "./contains_system_prompt_ref.js";

// check if includes keywords referring to one's own notes
export async function contains_self_referential_keywords(env, user_input, language) {
  const language_settings = ScTranslations[language];
  if (!language_settings) return false;
  let check_str = `${user_input}`;
  if(contains_internal_link(check_str)){
    const extracted_links = extract_internal_links({}, check_str);
    for(const link of extracted_links){
      check_str = check_str.replace(link, '');
    }
  }
  if(contains_folder_reference(check_str)){
    const folders = await env.smart_connections_plugin.get_folders(); // get folder references
    const extracted_folder_references = extract_folder_references(folders, check_str);
    for(const folder_reference of extracted_folder_references){
      check_str = check_str.replace(folder_reference, '');
    }
  }
  if(contains_system_prompt_ref(check_str)){
    const {mention, mention_pattern} = extract_system_prompt_ref(check_str);
    check_str = check_str.replace(mention_pattern, '');
  }

  if (check_str.match(new RegExp(`\\b(${language_settings.pronouns.join("|")})\\b`, "gi"))) return true;
  return false;
}
