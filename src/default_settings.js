export function default_settings() {
  return {
    settings: {
      new_user: true,
      // v2.2
      legacy_transformers: false,
      actions: {
        "lookup": true
      },
      smart_notices: {},
      // v2.1
      system_prompts_folder: "smart prompts",
      chat_model_platform_key: "open_router",
      open_router: {},
      // V1
      api_key: "",
      excluded_headings: "",
      folder_exclusions: "",
      show_full_path: false,
      expanded_view: true,
      language: "en",
      version: "",
    },
  };
}