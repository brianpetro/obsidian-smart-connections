export function default_settings() {
  return {
    settings: {
      env_data_dir: ".smart-env",
      new_user: true,
      chat_folder: "smart chat",
      legacy_transformers: false,
      system_prompts_folder: "smart prompts",
      smart_chat_folder: "smart-chats",
      smart_chat_folder_last: "smart-chats",
      local_embedding_max_tokens: 2048,
      chat_model_platform_key: "open_router",
      open_router: {},
      // v2.2
      enable_mobile: false,
      actions: {
        "lookup": true
      },
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