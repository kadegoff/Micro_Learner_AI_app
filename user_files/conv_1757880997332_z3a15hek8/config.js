{
  "id": "68c722a5a19cb_1757880997",
  "filename": "config.js",
  "language": "javascript",
  "executable": false,
  "sections": {
    "debug_mode_declaration": {
      "type": "variables",
      "name": "Debug Mode Declaration",
      "start_line": 3,
      "end_line": 3,
      "content": "const $DebugTestMode = true;",
      "relevance": "indirect"
    },
    "config_constants": {
      "type": "variables",
      "name": "Configuration Constants",
      "start_line": 6,
      "end_line": 16,
      "content": "const CONFIG = {\n  BACKEND_URL: \"http://localhost/memoria/backend\",\n  MAX_MESSAGES_DISPLAY: 600,\n  LONG_MESSAGE_THRESHOLD: 250,\n  LARGE_CONTENT_THRESHOLD: 1500,\n  AUTO_RESIZE_MAX_HEIGHT: 100,\n  MAX_CONTEXT_MESSAGES: 10,\n  STORAGE_KEYS: {\n    TOKEN: \"memoria_token\",\n    USER: \"memoria_user\",\n    CHAT_HISTORY: \"chatHistory\",\n    TOPICS: \"topics\",\n    SELECTED_MODEL: \"selectedAIModel\",\n    CONTEXT_PLUS: \"contextPlusEnabled\",\n  },\n};",
      "relevance": "direct"
    },
    "ai_models_configuration": {
      "type": "variables",
      "name": "AI Models Configuration",
      "start_line": 19,
      "end_line": 41,
      "content": "const AI_MODELS = {\n  basic: [\n    { id: \"chatgpt\", name: \"ChatGPT(Recommended)\", category: \"basic\" },\n    { id: \"chatgpt-5-nano\", name: \"ChatGPT 5 nano\", category: \"basic\" },\n    {\n      id: \"claude-3.5\",\n      name: \"Claude 3.5(Creative Writing)\",\n      category: \"basic\",\n    },\n    { id: \"deepseek-chat\", name: \"DeepSeek Chat\", category: \"basic\" },\n  ],\n  advanced: [\n    { id: \"claude-4.0\", name: \"Claude 4.0\", category: \"advanced\" },\n    { id: \"chatgpt-5\", name: \"ChatGPT 5\", category: \"advanced\" },\n    { id: \"grok-4\", name: \"Grok 4\", category: \"advanced\" },\n    {\n      id: \"deepseek-r1\",\n      name: \"DeepSeek R1(Math/Coding)\",\n      category: \"advanced\",\n      default: true,\n    },\n  ],\n  fast: [\n    { id: \"gemini-flash-2.5\", name: \"Gemini Flash 2.5\", category: \"fast\" },\n  ],\n};",
      "relevance": "direct"
    }
  }
}