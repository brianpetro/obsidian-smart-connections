export function default_settings() {
  return {
    settings: {
      env_data_dir: ".smart-env",
      new_user: true,
      // v2.2
      legacy_transformers: false,
      enable_mobile: false,
      actions: {
        "lookup": true
      },
      // v2.1
      system_prompts_folder: "smart prompts",
      smart_chat_folder: "smart-chats",
      smart_chat_folder_last: "smart-chats",
      chat_model_platform_key: "open_router",
      open_router: {},
      // V1
      api_key: "",
      excluded_headings: "",
      file_exclusions: "Untitled",
      folder_exclusions: "smart-chats",
      show_full_path: false,
      expanded_view: true,
      language: "en",
      version: "",
    },
  };
}