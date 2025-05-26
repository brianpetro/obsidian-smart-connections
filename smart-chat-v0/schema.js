const smart_threads_schema = {
  "title": "SmartThreads",
  "type": "object",
  "description": "Schema for SmartThreads Collection extending SmartSources",
  "extends": "smart_sources_schema",
  "properties": {
    "container": {
      "type": "string",
      "description": "HTML container used to render the chat view"
    },
    "methods": {
      "type": "object",
      "description": "Methods for SmartThreads collection",
      "properties": {
        "init": {
          "description": "Initializes the chat model and renders the chat view",
          "type": "function"
        },
        "load_chat_model": {
          "description": "Initiates the SmartChatModel",
          "type": "function"
        },
        "add_message": {
          "description": "Adds a message to the chat",
          "type": "function"
        },
        "handle_smart_action": {
          "description": "Checks for tool calls and routes them to the appropriate endpoint",
          "type": "function"
        },
        "new_user_message": {
          "description": "Adds a user message to the chat and triggers a new response",
          "type": "function"
        },
        "new_response": {
          "description": "Processes the response from the assistant and appends it to the chat",
          "type": "function"
        },
        "to_request": {
          "description": "Prepares the message sequence for submission to SmartChatModel",
          "type": "function"
        },
        "render": {
          "description": "Outputs the chat sequence to the UI",
          "type": "function"
        }
      }
    },
    "post_process": {
      "type": "array",
      "items": {
        "type": "function"
      },
      "description": "Array of functions for additional rendering logic"
    }
  },
  "required": ["container", "methods"]
};


const smart_message_schema = {
  "title": "SmartMessage",
  "type": "object",
  "description": "Schema for SmartMessage CollectionItem extending SmartBlock",
  "properties": {
    "role": {
      "type": "string",
      "description": "Role of the message sender (user/assistant)"
    },
    "content": {
      "type": "string",
      "description": "Content of the message"
    },
    "tool_calls": {
      "type": "array",
      "items": { "type": "object" },
      "description": "Array of tool calls associated with the message"
    },
    "methods": {
      "type": "object",
      "description": "Methods for SmartMessage",
      "properties": {
        "init": {
          "description": "Initializes the message and handles API interactions",
          "type": "function"
        },
        "render": {
          "description": "Renders the message in the chat view",
          "type": "function"
        },
        "to_request_message": {
          "description": "Converts the message to the format for SmartChatModel",
          "type": "function"
        },
        "re_render": {
          "description": "Re-renders the message in the UI",
          "type": "function"
        },
        "post_process": {
          "description": "Applies additional rendering logic to the message",
          "type": "function"
        }
      }
    }
  },
  "required": ["role", "content", "methods"]
};

const smart_messages_schema = {
  "title": "SmartMessages",
  "type": "object",
  "description": "Schema for SmartMessages Collection",
  "properties": {
    "methods": {
      "type": "object",
      "description": "Methods for SmartMessages collection",
      "properties": {
        "add_message": {
          "description": "Adds a new message, either from the user or assistant",
          "type": "function"
        }
      }
    }
  },
  "required": ["methods"]
};

const smart_chats_settings_config_schema = {
  "title": "SmartChatsSettingsConfig",
  "type": "object",
  "description": "Configuration settings for Smart Chats environment.",
  "properties": {
    "chat_model": {
      "type": "object",
      "description": "Settings related to the chat model.",
      "properties": {
        "platform_key": {
          "type": "string",
          "description": "Key representing the platform (e.g., OpenAI, GPT-4)."
        },
        "model_key": {
          "type": "string",
          "description": "Key representing the specific model version."
        },
        "[PLATFORM_KEY]": {
          "type": "object",
          "description": "Platform-specific settings for the chat model.",
          "additionalProperties": {
            "type": "object",
            "description": "Additional platform-specific settings.",
            "properties": {
              "api_key": {
                "type": "string",
                "description": "API key for accessing the platform."
              },
              "endpoint_url": {
                "type": "string",
                "description": "The base URL of the platform API."
              }
            },
            "required": ["api_key", "endpoint_url"]
          }
        }
      },
      "required": ["platform_key", "model_key"]
    },
    "verify_lookup_context": {
      "type": "boolean",
      "description": "Toggle to prevent sending function call response back to model without manual submit"
    },
    "alignment_notes": {
      "type": "object",
      "properties": {
        "folder": {
          "type": "string",
          "description": "Folder path for alignment notes"
        },
        "selected": {
          "type": "string",
          "description": "Currently selected alignment note"
        }
      }
    },
    "exclusions": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "description": "List of folders to exclude from 'My Context' queries"
    }
  },
  "required": ["chat_model"],
  "additionalProperties": true
};