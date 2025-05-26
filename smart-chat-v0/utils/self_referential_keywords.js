import ScTranslations from "./ScTranslations.json" with { type: "json" };

// check if includes keywords referring to one's own notes
export function contains_self_referential_keywords(user_input, language) {
  const language_settings = ScTranslations[language];
  if (!language_settings) return false;
  let check_str = `${user_input}`;
  check_str = check_str
    .replace(/\[\[[^\]]+\]\]/g, '')
    .replace(/\/[^/]*?\//g, '')
    .replace(/@"[^"]+"/g, '');
  return new RegExp(`\\b(${language_settings.pronouns.join('|')})\\b`, 'i').test(check_str);
}

export function get_language_options(){
  return Object.entries(ScTranslations).map(([language, language_settings]) => ({ value: language, name: language_settings.name }));
}

export function get_initial_message(language) {
  const language_settings = ScTranslations[language];
  return language_settings.initial_message;
}

export function get_translated_context_suffix_prompt(language) {
  const language_settings = ScTranslations[language];
  return language_settings.context_suffix_prompt;
}
export function get_translated_context_prefix_prompt(language) {
  const language_settings = ScTranslations[language];
  return language_settings.context_prefix_prompt;
}