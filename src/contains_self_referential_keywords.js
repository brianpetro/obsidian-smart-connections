const ScTranslations = require("./ScTranslations");
const { contains_folder_reference } = require("./contains_folder_reference");
const { contains_internal_link } = require("./contains_internal_link");
const { extract_internal_links } = require("./extract_internal_links");
const { extract_folder_references } = require("./extract_folder_references");
const { contains_system_prompt_ref, extract_system_prompt_ref } = require("./contains_system_prompt_ref");

// check if includes keywords referring to one's own notes
async function contains_self_referential_keywords(env, user_input, language) {
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
    const folders = await env.plugin.get_folders(); // get folder references
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
exports.contains_self_referential_keywords = contains_self_referential_keywords;
