// ai.js - ENHANCED VERSION with Message Editing, Version History, and Context+
"use strict";

// Constants and Configuration
const CONFIG = {
  BACKEND_URL: "http://localhost/memoria/backend",
  MAX_MESSAGES_DISPLAY: 20,
  LONG_MESSAGE_THRESHOLD: 250,
  LARGE_CONTENT_THRESHOLD: 1500,
  AUTO_RESIZE_MAX_HEIGHT: 100,
  MAX_CONTEXT_MESSAGES: 10,
  STORAGE_KEYS: {
    TOKEN: "memoria_token",
    USER: "memoria_user",
    CHAT_HISTORY: "chatHistory",
    TOPICS: "topics",
    SELECTED_MODEL: "selectedAIModel",
    CONTEXT_PLUS: "contextPlusEnabled",
  },
};

// AI Models configuration
const AI_MODELS = {
  basic: [
    { id: "chatgpt", name: "ChatGPT(Recommended)", category: "basic" },
    {
      id: "claude-3.5",
      name: "Claude 3.5(Creative Writing)",
      category: "basic",
    },
    { id: "deepseek-chat", name: "DeepSeek Chat", category: "basic" },
  ],
  advanced: [
    { id: "claude-4.0", name: "Claude 4.0", category: "advanced" },
    {
      id: "deepseek-r1",
      name: "DeepSeek R1(Math/Coding)",
      category: "advanced",
      default: true,
    },
  ],
  fast: [
    { id: "gemini-flash-2.5", name: "Gemini Flash 2.5", category: "fast" },
  ],
};

// Enhanced Global State Management with Edit History and Context+
var appState = {
  isAuthenticated: false,
  currentUser: null,
  selectedAIModel: "deepseek-r1",
  chatHistory: [],
  currentTopicId: null,
  currentSubtopicId: null,
  topics: {},
  authState: {
    isAuthenticated: false,
    user: null,
    token: null,
  },
  currentConversationId: null, // Add this
  // Track edit history and visibility
  editHistory: {}, // messageId -> array of versions
  hiddenMessages: new Set(), // Set of message IDs that should be hidden
  messageResponses: {}, // messageId -> { version -> [responseMessageIds] }

  // Context+ State
  contextPlusEnabled: false,
  contextPlusMemories: [],
  contextPlusLoading: false,

  updateAuth: function (authData) {
    this.isAuthenticated = authData.isAuthenticated;
    this.currentUser = authData.user;
    this.authState = authData;
  },

  // In appState object:
  saveToStorage: function () {
    try {
      localStorage.setItem(
        CONFIG.STORAGE_KEYS.CHAT_HISTORY,
        JSON.stringify(this.chatHistory)
      );
      localStorage.setItem(
        CONFIG.STORAGE_KEYS.TOPICS,
        JSON.stringify(this.topics)
      );
      localStorage.setItem(
        CONFIG.STORAGE_KEYS.SELECTED_MODEL,
        this.selectedAIModel
      );

      // CRITICAL: Save current topic/subtopic IDs
      localStorage.setItem("currentTopicId", this.currentTopicId || "");
      localStorage.setItem("currentSubtopicId", this.currentSubtopicId || "");

      // Save edit history
      localStorage.setItem("editHistory", JSON.stringify(this.editHistory));
      localStorage.setItem(
        "hiddenMessages",
        JSON.stringify([...this.hiddenMessages])
      );

      // Save message responses tracking
      localStorage.setItem(
        "messageResponses",
        JSON.stringify(this.messageResponses)
      );

      // Save Context+ preference
      localStorage.setItem(
        CONFIG.STORAGE_KEYS.CONTEXT_PLUS,
        this.contextPlusEnabled
      );
      localStorage.setItem(
        "currentConversationId",
        this.currentConversationId || ""
      );

      console.log("App state saved to storage, including topic IDs:", {
        currentTopicId: this.currentTopicId,
        currentSubtopicId: this.currentSubtopicId,
      });
    } catch (error) {
      console.error("Failed to save app state:", error);
    }
  },

  loadFromStorage: function () {
    try {
      const token = localStorage.getItem(CONFIG.STORAGE_KEYS.TOKEN);
      const userData = localStorage.getItem(CONFIG.STORAGE_KEYS.USER);

      if (token && userData) {
        this.updateAuth({
          isAuthenticated: true,
          token: token,
          user: JSON.parse(userData),
        });
      }

      const savedHistory = localStorage.getItem(
        CONFIG.STORAGE_KEYS.CHAT_HISTORY
      );
      const savedTopics = localStorage.getItem(CONFIG.STORAGE_KEYS.TOPICS);
      const savedModel = localStorage.getItem(
        CONFIG.STORAGE_KEYS.SELECTED_MODEL
      );
      const savedConversationId = localStorage.getItem("currentConversationId");
      if (savedConversationId) this.currentConversationId = savedConversationId;

      // CRITICAL: Load current topic/subtopic IDs
      const savedTopicId = localStorage.getItem("currentTopicId");
      const savedSubtopicId = localStorage.getItem("currentSubtopicId");

      // Load edit history
      const savedEditHistory = localStorage.getItem("editHistory");
      const savedHiddenMessages = localStorage.getItem("hiddenMessages");

      // Load message responses tracking
      const savedMessageResponses = localStorage.getItem("messageResponses");

      // Load Context+ preference
      const savedContextPlus = localStorage.getItem(
        CONFIG.STORAGE_KEYS.CONTEXT_PLUS
      );

      if (savedHistory) this.chatHistory = JSON.parse(savedHistory);
      if (savedTopics) this.topics = JSON.parse(savedTopics);
      if (savedModel) this.selectedAIModel = savedModel;

      // Restore current topic/subtopic
      if (savedTopicId) this.currentTopicId = savedTopicId;
      if (savedSubtopicId) this.currentSubtopicId = savedSubtopicId;

      if (savedEditHistory) this.editHistory = JSON.parse(savedEditHistory);
      if (savedHiddenMessages)
        this.hiddenMessages = new Set(JSON.parse(savedHiddenMessages));
      if (savedContextPlus === "true") this.contextPlusEnabled = true;

      // Load message responses
      if (savedMessageResponses) {
        this.messageResponses = JSON.parse(savedMessageResponses);
      } else {
        this.messageResponses = {};
      }

      console.log("App state loaded from storage");
      console.log("Context+ enabled:", this.contextPlusEnabled);
      console.log("Current topic ID:", this.currentTopicId);
      console.log("Current subtopic ID:", this.currentSubtopicId);
    } catch (error) {
      console.error("Failed to load app state:", error);
      // Initialize empty state on error
      this.messageResponses = {};
      this.contextPlusEnabled = false;
      this.currentTopicId = null;
      this.currentSubtopicId = null;
    }
  },
  resetAuth: function () {
    this.isAuthenticated = false;
    this.currentUser = null;
    this.authState = { isAuthenticated: false, user: null, token: null };

    localStorage.removeItem(CONFIG.STORAGE_KEYS.TOKEN);
    localStorage.removeItem(CONFIG.STORAGE_KEYS.USER);
  },

  // Add message edit history
  addEditHistory: function (messageId, editData) {
    if (!this.editHistory[messageId]) {
      this.editHistory[messageId] = [];
    }
    this.editHistory[messageId].push(editData);
    this.saveToStorage();
  },

  // Track responses for each message version
  addResponseToVersion: function (userMessageId, responseMessageId, version) {
    if (!this.messageResponses[userMessageId]) {
      this.messageResponses[userMessageId] = {};
    }
    if (!this.messageResponses[userMessageId][version]) {
      this.messageResponses[userMessageId][version] = [];
    }
    this.messageResponses[userMessageId][version].push(responseMessageId);
    this.saveToStorage();
  },

  // Get edit history for a message
  getEditHistory: function (messageId) {
    return this.editHistory[messageId] || [];
  },

  // Update hidden messages based on version
  updateHiddenMessages: function (editedMessageId, versionTimestamp) {
    this.hiddenMessages.clear();

    // Find the edited message index
    const messageIndex = this.chatHistory.findIndex(
      (msg) => msg.id === editedMessageId
    );
    if (messageIndex === -1) return;

    // Get the current version of the edited message
    const editedMessage = this.chatHistory[messageIndex];
    const currentVersion = editedMessage.currentVersion || 1;

    // Store which messages belong to the previous version
    const previousVersion = currentVersion - 1;
    if (!this.messageResponses[editedMessageId]) {
      this.messageResponses[editedMessageId] = {};
    }
    if (!this.messageResponses[editedMessageId][previousVersion]) {
      this.messageResponses[editedMessageId][previousVersion] = [];
    }

    // Collect all messages after the edited one as belonging to the previous version
    for (let i = messageIndex + 1; i < this.chatHistory.length; i++) {
      const msg = this.chatHistory[i];
      this.hiddenMessages.add(msg.id);

      // Track this message as belonging to the previous version
      if (
        !this.messageResponses[editedMessageId][previousVersion].includes(
          msg.id
        )
      ) {
        this.messageResponses[editedMessageId][previousVersion].push(msg.id);
      }
    }

    // Update UI immediately
    const allMessages = document.querySelectorAll(".message");
    let foundEdited = false;

    allMessages.forEach((msg) => {
      if (msg.id === editedMessageId) {
        foundEdited = true;
        msg.style.display = ""; // Ensure edited message is visible
      } else if (foundEdited) {
        // Hide all messages after the edited one
        msg.style.display = "none";
      }
    });

    this.saveToStorage();
  },

  // Get messages for a specific version
  getMessagesForVersion: function (userMessageId, version) {
    if (
      !this.messageResponses[userMessageId] ||
      !this.messageResponses[userMessageId][version]
    ) {
      return [];
    }
    return this.messageResponses[userMessageId][version];
  },

  // Get context for AI including Context+ handling
  getContextForAI: function () {
    console.log("🧠 === GETTING CONTEXT FOR AI (WITH FILES) ===");
    console.log("🧠 Total chat history length:", this.chatHistory.length);
    console.log("🧠 Current topic ID:", this.currentTopicId);
    console.log("🧠 Hidden messages:", this.hiddenMessages.size);
    console.log("🧠 Context+ enabled:", this.contextPlusEnabled);

    // Get messages for current topic (or all if no topic)
    const currentTopicMessages = this.chatHistory.filter((msg) => {
      const matchesTopic =
        msg.topicId === this.currentTopicId ||
        (!msg.topicId && !this.currentTopicId);

      // Filter out error messages and hidden messages
      const isErrorMessage =
        msg.text &&
        (msg.text.includes("usage limit") ||
          msg.text.includes("Your usage will reset") ||
          msg.text.includes("session has expired") ||
          msg.text.includes("Please sign in") ||
          msg.messageType === "Auth Required" ||
          msg.messageType === "Error");

      // Filter out hidden messages
      const isHidden = this.hiddenMessages.has(msg.id);

      if (isHidden) {
        console.log(
          "🧠 Filtering out hidden message:",
          msg.id,
          msg.text.substring(0, 50)
        );
      }

      return matchesTopic && !isErrorMessage && !isHidden;
    });

    console.log(
      "🧠 Current topic messages after filtering:",
      currentTopicMessages.length
    );

    // Take the most recent messages up to the limit
    const recentMessages = currentTopicMessages.slice(
      -CONFIG.MAX_CONTEXT_MESSAGES
    );

    console.log("🧠 Recent messages for context:");
    recentMessages.forEach((msg, index) => {
      // Add more detailed logging
      console.log(`🧠 Message ${index}:`, {
        id: msg.id,
        type: msg.type,
        hasFiles: !!msg.files,
        filesLength: msg.files ? msg.files.length : 0,
        files: msg.files,
      });

      const fileInfo =
        msg.files && msg.files.length
          ? `+ ${msg.files.length} files`
          : "no files";
      console.log(
        `  ${index}: ${msg.type} - "${msg.text.substring(
          0,
          50
        )}..." ${fileInfo}`
      );
    });

    // Convert to OpenAI format - Include BOTH text and files
    const contextMessages = recentMessages.map((msg) => {
      let role;
      if (msg.type === "user") {
        role = "user";
      } else if (msg.type === "ai") {
        role = "assistant";
      } else {
        role = "user"; // Default fallback
      }

      // Start with the main text content
      let content = msg.text;

      // If this message has files, include them in the context
      if (msg.files && Array.isArray(msg.files) && msg.files.length > 0) {
        console.log(
          `🧠 Including ${msg.files.length} files in context for message ${msg.id}`
        );

        // Add file information to the content
        content += "\n\n[Files created in this response:]\n";

        msg.files.forEach((file, index) => {
          if (file && file.filename && file.content) {
            // FIXED: Include FULL file content, not just preview
            content += `\n**File ${index + 1}: ${file.filename}** (${
              file.type || "unknown type"
            })\n`;
            content += `\`\`\`${
              file.language || file.extension?.replace(".", "") || "text"
            }\n`;
            content += file.content; // ← FULL CONTENT
            content += `\n\`\`\`\n`;

            console.log(
              `🧠   - File: ${file.filename} (${file.content.length} chars, ${file.type})`
            );
          }
        });

        content += "\n[End of files]\n";
      }

      const contextMessage = {
        role: role,
        content: content, // This should now include the files
        timestamp: msg.timestamp,
        // Keep original file reference for debugging
        originalFiles: msg.files || [],
      };

      console.log(
        `🧠 Context message: ${role} - "${msg.text.substring(0, 50)}..."${
          msg.files && msg.files.length ? ` + ${msg.files.length} files` : ""
        }`
      );
      return contextMessage;
    });

    // Right before returning contextMessages, add this enhanced debugging:
    console.log("🧠 === DETAILED CONTEXT CHECK ===");
    contextMessages.forEach((msg, idx) => {
      console.log(`🧠 Message ${idx}:`);
      console.log(`  Role: ${msg.role}`);
      console.log(`  Content length: ${msg.content.length} chars`);

      // Check for file markers
      const hasFileStart = msg.content.includes(
        "[Files created in this response:]"
      );
      const hasFileEnd = msg.content.includes("[End of files]");
      const codeBlockCount = (msg.content.match(/```/g) || []).length;

      console.log(
        `  Has file markers: start=${hasFileStart}, end=${hasFileEnd}`
      );
      console.log(
        `  Code blocks: ${codeBlockCount / 2} (${codeBlockCount} markers)`
      );

      // Show a longer preview if it contains files
      if (hasFileStart) {
        console.log(`  Content preview with files:`);
        console.log(msg.content.substring(0, 500) + "...[truncated]");

        // Also show the end to verify files are complete
        console.log(`  Content end:`);
        console.log("..." + msg.content.substring(msg.content.length - 200));
      } else {
        console.log(`  Content preview: ${msg.content.substring(0, 200)}...`);
      }
    });

    return contextMessages;
  },
};

// Environment Detection - SIMPLIFIED
var Environment = {
  isElectron: typeof window !== "undefined" && window.electronAPI,
  isWeb: true,

  init: function () {
    this.isWeb = !this.isElectron;
    console.log(
      "🔍 Environment:",
      this.isElectron ? "Electron" : "Web Browser"
    );

    if (this.isWeb) {
      this.setupWebCompatibility();
    }
  },

  setupWebCompatibility: function () {
    console.log("🌐 Setting up web compatibility layer");

    if (!window.electronAPI) {
      window.electronAPI = this.createMockElectronAPI();
    }

    document.addEventListener("DOMContentLoaded", function () {
      const content = document.getElementById("aiContent");
      const emptyState = content?.querySelector(".empty-state");
      if (emptyState) {
        emptyState.innerHTML = `
          <div class="web-notice">
            🌐 Running in web mode with enhanced file handling
          </div>
          AI insights will appear here...
        `;
      }
    });
  },

  createMockElectronAPI: function () {
    const mockCallbacks = {};

    return {
      getAuthState: function () {
        const token = localStorage.getItem(CONFIG.STORAGE_KEYS.TOKEN);
        const userData = localStorage.getItem(CONFIG.STORAGE_KEYS.USER);

        if (token && userData) {
          return Promise.resolve({
            isAuthenticated: true,
            token: token,
            user: JSON.parse(userData),
          });
        }

        return Promise.resolve({
          isAuthenticated: false,
          user: null,
          token: null,
        });
      },

      onNewAIResponse: function (callback) {
        mockCallbacks.onNewAIResponse = callback;
      },

      onAIThinking: function (callback) {
        mockCallbacks.onAIThinking = callback;
      },

      onAuthStateUpdated: function (callback) {
        mockCallbacks.onAuthStateUpdated = callback;
      },

      onAuthStateChanged: function (callback) {
        mockCallbacks.onAuthStateChanged = callback;
      },

      onTranscriptQuestion: function (callback) {
        mockCallbacks.onTranscriptQuestion = callback;
      },

      onAuthSuccess: function (callback) {
        mockCallbacks.onAuthSuccess = callback;
      },

      sendChatMessage: function (data) {
        if (window.sendChatMessageDirect) {
          window.sendChatMessageDirect(data);
        }
      },

      broadcastAIResponse: function (data) {
        if (mockCallbacks.onNewAIResponse) {
          mockCallbacks.onNewAIResponse(data);
        }
      },

      sendTranscriptQuestion: function (question) {
        const chatInput = document.getElementById("chatInput");
        if (chatInput) {
          chatInput.value = question;
          autoResizeTextarea();
        }
      },

      sendAuthSuccess: function (userData) {
        if (mockCallbacks.onAuthSuccess) {
          mockCallbacks.onAuthSuccess(userData);
        }
      },
    };
  },
};

// Enhanced File Block Manager - FIXED VERSION with proper file linking
var contentManager = {
  blocks: new Map(),
  blockCounter: 0,

  init: function () {
    this.setupEventDelegation();
  },

  setupEventDelegation: function () {
    console.log("🎯 Setting up event delegation for content blocks");

    document.addEventListener("click", function (event) {
      console.log(
        "🎯 CLICK DETECTED:",
        event.target.className,
        event.target.tagName
      );
      const target = event.target;

      if (target.classList.contains("block-btn")) {
        console.log("🎯 BLOCK BUTTON CLICKED!");
        event.preventDefault();
        event.stopPropagation();

        const blockElement =
          target.closest(".content-block") || target.closest(".file-block");
        console.log("🎯 Block element found:", blockElement);

        if (!blockElement) {
          console.warn("🎯 No content-block parent found for button");
          return;
        }

        const blockId = blockElement.id;
        const action = target.dataset.action;
        console.log("🎯 Block ID:", blockId, "Action:", action);

        switch (action) {
          case "preview":
            console.log("🎯 CALLING previewContent");
            contentManager.previewContent(blockId);
            break;
          case "download":
            console.log("🎯 CALLING downloadContent");
            contentManager.downloadContent(blockId);
            break;
          case "copy":
            console.log("🎯 CALLING copyContent");
            contentManager.copyContent(blockId);
            break;
          case "view-code":
            console.log("🎯 CALLING showCode");
            contentManager.showCode(blockId);
            break;
          default:
            console.warn("🎯 Unknown action:", action);
        }
        return;
      }

      if (target.closest(".block-header") && !target.closest(".block-btn")) {
        const blockElement = target.closest(".content-block");
        if (blockElement) {
          const blockId = blockElement.id;
          contentManager.toggleBlock(blockId);
        }
        return;
      }

      if (target.closest(".hoverable-segment")) {
        const sentence = target.dataset.sentence;
        if (sentence) {
          addToChat(sentence);
        }
        return;
      }
    });
  },

  createFileBlock: function (fileData, allFiles = []) {
    const blockId = `block_${++this.blockCounter}`;

    console.log("🗂️ Creating file block with data:", {
      filename: fileData.filename,
      type: fileData.type,
      size: fileData.size,
      extension: fileData.extension,
      language: fileData.language,
      hasContent: !!fileData.content,
      contentLength: fileData.content ? fileData.content.length : 0,
    });

    // ENHANCED: Create linked content for HTML files
    let finalContent = fileData.content;
    let linkedFiles = [];

    // ENHANCED: Ensure language is properly detected and stored
    let detectedLanguage = fileData.language;

    // If no language provided, detect from extension
    if (
      !detectedLanguage ||
      detectedLanguage === "text" ||
      detectedLanguage === "plaintext"
    ) {
      const extension =
        fileData.extension || this.getFileExtension(fileData.filename);
      detectedLanguage = this.getLanguageFromExtension(extension);
    }

    // If still no language, detect from content
    if (!detectedLanguage || detectedLanguage === "plaintext") {
      detectedLanguage = this.detectLanguageFromContent(fileData.content);
    }

    console.log("🗂️ Detected language for file:", detectedLanguage);

    // Link HTML files with CSS/JS
    if (
      (fileData.extension === ".html" || fileData.extension === ".htm") &&
      allFiles.length > 0
    ) {
      console.log("🔗 HTML file detected, checking for related CSS/JS files");

      const cssFiles = allFiles.filter(
        (f) =>
          f.extension === ".css" ||
          (f.filename && f.filename.toLowerCase().endsWith(".css"))
      );
      const jsFiles = allFiles.filter(
        (f) =>
          f.extension === ".js" ||
          (f.filename && f.filename.toLowerCase().endsWith(".js"))
      );

      if (cssFiles.length > 0 || jsFiles.length > 0) {
        console.log(
          `🔗 Found ${cssFiles.length} CSS and ${jsFiles.length} JS files to link`
        );
        finalContent = this.linkFilesToHTML(
          fileData.content,
          cssFiles,
          jsFiles
        );
        linkedFiles = [...cssFiles, ...jsFiles];
      }
    }

    // ENHANCED: Ensure all metadata is present
    const block = {
      id: blockId,
      filename: fileData.filename || "untitled.txt",
      content: finalContent,
      originalContent: fileData.content,
      extension:
        fileData.extension ||
        this.getFileExtension(fileData.filename) ||
        ".txt",
      language: detectedLanguage || "plaintext", // Use detected language
      type: fileData.type || "text",
      size: fileData.size || (fileData.content ? fileData.content.length : 0),
      wordCount:
        fileData.word_count ||
        (fileData.content ? fileData.content.split(/\s+/).length : 0),
      isExecutable:
        fileData.is_executable ||
        fileData.extension === ".html" ||
        fileData.extension === ".htm",
      mimeType:
        fileData.mime_type || this.getMimeType(fileData.extension || ".txt"),
      collapsed: true,
      linkedFiles: linkedFiles,
      allFiles: allFiles,
    };

    console.log("🗂️ Created block with metadata:", {
      id: block.id,
      filename: block.filename,
      type: block.type,
      size: block.size,
      wordCount: block.wordCount,
      isExecutable: block.isExecutable,
      extension: block.extension,
      language: block.language,
    });

    this.blocks.set(blockId, block);
    return this.renderFileBlock(block);
  },

  // NEW: Enhanced HTML file linking function
  linkFilesToHTML: function (htmlContent, cssFiles, jsFiles) {
    console.log("🔗 Linking files to HTML");

    let linkedHTML = htmlContent;

    // Link CSS files
    cssFiles.forEach((cssFile) => {
      console.log("🔗 Linking CSS file:", cssFile.filename);

      // Look for external CSS references and replace them
      const cssLinkPatterns = [
        new RegExp(
          `<link[^>]*href\\s*=\\s*["']${cssFile.filename}["'][^>]*>`,
          "gi"
        ),
        new RegExp(
          `<link[^>]*href\\s*=\\s*["'].*${cssFile.filename.replace(
            ".css",
            ""
          )}.*\\.css["'][^>]*>`,
          "gi"
        ),
        // Common generic names
        /<link[^>]*href\s*=\s*["']styles?\.css["'][^>]*>/gi,
        /<link[^>]*href\s*=\s*["']style\.css["'][^>]*>/gi,
        /<link[^>]*href\s*=\s*["']main\.css["'][^>]*>/gi,
      ];

      let replaced = false;
      cssLinkPatterns.forEach((pattern) => {
        if (pattern.test(linkedHTML)) {
          linkedHTML = linkedHTML.replace(
            pattern,
            `<style>\n${cssFile.content}\n</style>`
          );
          replaced = true;
          console.log("🔗 ✅ Replaced CSS link with inline styles");
        }
      });

      // If no external link found, inject CSS into head
      if (!replaced && linkedHTML.includes("<head>")) {
        linkedHTML = linkedHTML.replace(
          "<head>",
          `<head>\n<style>\n/* Injected CSS from ${cssFile.filename} */\n${cssFile.content}\n</style>`
        );
        console.log("🔗 ✅ Injected CSS into head");
      }
    });

    // Link JavaScript files
    jsFiles.forEach((jsFile) => {
      console.log("🔗 Linking JS file:", jsFile.filename);

      // Look for external JS references and replace them
      const jsScriptPatterns = [
        new RegExp(
          `<script[^>]*src\\s*=\\s*["']${jsFile.filename}["'][^>]*></script>`,
          "gi"
        ),
        new RegExp(
          `<script[^>]*src\\s*=\\s*["'].*${jsFile.filename.replace(
            ".js",
            ""
          )}.*\\.js["'][^>]*></script>`,
          "gi"
        ),
        // Common generic names
        /<script[^>]*src\s*=\s*["']scripts?\.js["'][^>]*><\/script>/gi,
        /<script[^>]*src\s*=\s*["']script\.js["'][^>]*><\/script>/gi,
        /<script[^>]*src\s*=\s*["']main\.js["'][^>]*><\/script>/gi,
        /<script[^>]*src\s*=\s*["']app\.js["'][^>]*><\/script>/gi,
      ];

      let replaced = false;
      jsScriptPatterns.forEach((pattern) => {
        if (pattern.test(linkedHTML)) {
          linkedHTML = linkedHTML.replace(
            pattern,
            `<script>\n${jsFile.content}\n</script>`
          );
          replaced = true;
          console.log("🔗 ✅ Replaced JS script tag with inline script");
        }
      });

      // If no external script found, inject JS before closing body
      if (!replaced && linkedHTML.includes("</body>")) {
        linkedHTML = linkedHTML.replace(
          "</body>",
          `<script>\n/* Injected JavaScript from ${jsFile.filename} */\n${jsFile.content}\n</script>\n</body>`
        );
        console.log("🔗 ✅ Injected JS before closing body");
      }
    });

    return linkedHTML;
  },

  renderFileBlock: function (block) {
    const fileIcon = this.getFileIcon(block.type, block.extension);
    const previewText =
      block.originalContent.length > 200
        ? block.originalContent.substring(0, 200) + "..."
        : block.originalContent;

    // Show linked files info if available
    let linkedFilesInfo = "";
    if (block.linkedFiles && block.linkedFiles.length > 0) {
      linkedFilesInfo = `<div class="linked-files-info">
            <small>🔗 Linked: ${block.linkedFiles
              .map((f) => f.filename)
              .join(", ")}</small>
        </div>`;
    }

    // Add executable badge
    const executableBadge = block.isExecutable
      ? '<span class="executable-badge" title="This file can run standalone">⚡ Executable</span>'
      : "";

    const html = `
        <div class="content-block file-block" id="${block.id}" data-type="${
      block.type
    }">
            <div class="block-header ${block.collapsed ? "collapsed" : ""}">
                <div class="block-info">
                    <div class="block-icon">${fileIcon}</div>
                    <div class="block-details">
                        <h4 class="filename">${this.escapeHtml(
                          block.filename
                        )}</h4>
                        <div class="block-meta">
                            <span class="file-size">${this.formatFileSize(
                              block.size
                            )}</span>
                            <span class="word-count">${
                              block.wordCount
                            } words</span>
                            <span class="file-type">${block.type}</span>
                            <span class="language">${block.language}</span>
                            ${executableBadge}
                        </div>
                        ${linkedFilesInfo}
                    </div>
                </div>
                <div class="block-actions">
                    ${
                      block.isExecutable
                        ? `<button class="block-btn primary" data-action="preview">👁️ Preview</button>`
                        : `<button class="block-btn" data-action="view-code">📝 View</button>`
                    }
                    <button class="block-btn" data-action="download">⬇️ Download</button>
                    <button class="block-btn" data-action="copy">📋 Copy</button>
                    <span class="collapse-indicator">▼</span>
                </div>
            </div>
            <div class="block-content ${
              block.collapsed ? "collapsed" : ""
            }" id="${block.id}_content">
                <div class="preview-content">
                    <pre><code class="language-${
                      block.language
                    }">${this.escapeHtml(previewText)}</code></pre>
                </div>
            </div>
        </div>
    `;

    return html;
  },

  previewContent: function (blockId) {
    console.log("🔍 previewContent called with blockId:", blockId);

    const block = this.blocks.get(blockId);
    console.log("🔍 Block data:", block);

    if (!block) {
      console.error("❌ Block not found for ID:", blockId);
      return;
    }

    console.log(
      "🔍 Block type:",
      block.type,
      "isExecutable:",
      block.isExecutable,
      "isRenderable:",
      block.isRenderable
    );

    if (block.isExecutable || block.isRenderable) {
      console.log("🔍 Creating fullscreen preview");
      this.createFullscreenPreview(block);
    } else {
      console.log("🔍 Showing code preview");
      this.showCodePreview(blockId);
    }
  },

  createFullscreenPreview: function (block) {
    const overlay = document.createElement("div");
    overlay.className = "fullscreen-preview";

    // Store reference to contentManager for use in event handlers
    const self = this;

    overlay.addEventListener("click", function (e) {
      e.stopPropagation();
      if (e.target === overlay) {
        closePreview();
      }
    });

    const canRender = block.isExecutable || block.isRenderable;

    let iframeContent = "";
    let blobUrl = null;

    if (canRender) {
      // ENHANCED: Regenerate linked HTML with fresh file linking
      let htmlContent = block.content;

      // If this is an HTML file with linked files, regenerate the linking
      if (
        (block.extension === ".html" || block.extension === ".htm") &&
        block.allFiles
      ) {
        console.log("🔗 Regenerating file links for preview");

        const cssFiles = block.allFiles.filter(
          (f) =>
            f.extension === ".css" ||
            (f.filename && f.filename.toLowerCase().endsWith(".css"))
        );
        const jsFiles = block.allFiles.filter(
          (f) =>
            f.extension === ".js" ||
            (f.filename && f.filename.toLowerCase().endsWith(".js"))
        );

        htmlContent = this.linkFilesToHTML(
          block.originalContent,
          cssFiles,
          jsFiles
        );
      }

      // Sanitize the HTML content
      const safeHtml = this.sanitizeHTML(htmlContent);

      const navigationScript = `
      <script>
        window.addEventListener('load', function() {
          console.log('🔗 Linked HTML loaded successfully');
          
          document.addEventListener('click', function(e) {
            const link = e.target.closest('a');
            if (link) {
              const href = link.getAttribute('href');
              
              if (href && href.startsWith('#')) {
                return; // Allow internal links
              }
              
              e.preventDefault();
              e.stopPropagation();
              
              if (href && (href.startsWith('http') || href.startsWith('//'))) {
                if (confirm('Open external link in new tab?\\n' + href)) {
                  window.parent.open(href, '_blank');
                }
              }
              
              return false;
            }
          });
          
          document.addEventListener('submit', function(e) {
            e.preventDefault();
            alert('Form submissions are disabled in preview mode');
            return false;
          });
        });
      </script>
    `;

      if (safeHtml.includes("</body>")) {
        htmlContent = safeHtml.replace("</body>", navigationScript + "</body>");
      } else if (safeHtml.includes("</html>")) {
        htmlContent = safeHtml.replace("</html>", navigationScript + "</html>");
      } else {
        htmlContent = safeHtml + navigationScript;
      }

      // Use srcdoc for better security
      iframeContent = `
      <iframe 
        class="preview-iframe" 
        srcdoc="${this.escapeAttribute(htmlContent)}"
        style="width: 100%; height: 100%; border: none;"
        sandbox="allow-scripts"
        data-filename="${this.escapeHtml(block.filename)}"
      ></iframe>
    `;
    } else {
      // For non-renderable content, show the enhanced code view directly
      iframeContent = `<div class="code-view-wrapper" style="height: 100%; overflow: auto;"></div>`;
    }

    overlay.innerHTML = `
    <div class="preview-header">
      <span class="preview-title">${this.escapeHtml(block.filename)}</span>
      <div class="preview-controls">
        ${
          canRender
            ? `<button class="preview-btn" id="viewCodeBtn">📝 View Code</button>`
            : ""
        }
        ${
          block.linkedFiles && block.linkedFiles.length > 0
            ? `<button class="preview-btn" id="showLinkedBtn">🔗 Show Linked Files</button>`
            : ""
        }
        <button class="preview-btn close-preview" id="closePreviewBtn">✕ Close</button>
      </div>
    </div>
    <div class="preview-content-container">
      ${iframeContent}
    </div>
  `;

    document.body.appendChild(overlay);
    document.body.classList.add("preview-open");

    // If not renderable, show code view immediately
    if (!canRender) {
      setTimeout(() => {
        showEnhancedCodeView();
      }, 50);
    }

    function closePreview() {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }

      document.body.classList.remove("preview-open");
      document.body.style.overflow = "";

      try {
        if (document.body.contains(overlay)) {
          document.body.removeChild(overlay);
        }
      } catch (error) {
        console.error("Error removing overlay:", error);
      }

      document.removeEventListener("keydown", escapeHandler);
    }

    // FIXED: Enhanced code view function that includes line numbers and folding
    function showEnhancedCodeView() {
      const container = overlay.querySelector(".preview-content-container");

      // Ensure we have chatInputManager available
      if (!window.chatInputManager) {
        console.error(
          "chatInputManager not available, falling back to simple view"
        );
        showSimpleCodeView();
        return;
      }

      // Create a temporary preview ID and store the content
      const tempPreviewId = `preview_code_${block.id}_${Date.now()}`;

      if (!window.chatInputManager.largeContentStore) {
        window.chatInputManager.largeContentStore = new Map();
      }

      // Detect language
      let language = block.language;
      if (!language && block.extension) {
        language = self.getLanguageFromExtension(block.extension);
      }
      if (!language && block.type) {
        language = self.getLanguageFromType(block.type);
      }

      // Store the content data
      window.chatInputManager.largeContentStore.set(tempPreviewId, {
        content: block.content || block.originalContent,
        originalContent: block.originalContent,
        filename: block.filename,
        type: block.type,
        extension: block.extension,
        language: language || "plaintext",
      });

      // Load highlight.js if needed
      if (typeof hljs === "undefined") {
        const script = document.createElement("script");
        script.src =
          "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js";
        script.onload = function () {
          const link = document.createElement("link");
          link.rel = "stylesheet";
          link.href =
            "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/vs2015.min.css";
          document.head.appendChild(link);

          setTimeout(() => {
            displayEnhancedCode();
          }, 50);
        };
        document.head.appendChild(script);
      } else {
        displayEnhancedCode();
      }

      function displayEnhancedCode() {
        const contentData =
          window.chatInputManager.largeContentStore.get(tempPreviewId);
        if (!contentData) return;

        // Apply enhanced code view styles
        container.innerHTML = `
        <div class="code-view-enhanced" style="background-color: #1e1e1e; color: #d4d4d4; height: 100%; overflow: auto; padding: 20px 0;">
          <div class="loading-code">Preparing code view...</div>
        </div>
      `;

        setTimeout(() => {
          const codeContainer = container.querySelector(".code-view-enhanced");
          if (codeContainer && window.chatInputManager.createHighlightedCode) {
            codeContainer.innerHTML =
              window.chatInputManager.createHighlightedCode(
                contentData.content,
                contentData.language
              );

            // Set up fold event handlers
            setupCodeFoldHandlers();
          }
        }, 50);
      }
    }

    // Simple fallback code view
    function showSimpleCodeView() {
      const container = overlay.querySelector(".preview-content-container");
      container.innerHTML = `
      <div class="code-view" style="background: #1e1e1e; color: #d4d4d4; padding: 20px; height: 100%; overflow: auto;">
        <pre style="margin: 0;"><code class="language-${
          block.language || "text"
        }">${self.escapeHtml(block.content)}</code></pre>
      </div>
    `;
    }

    // Set up fold event handlers
    function setupCodeFoldHandlers() {
      overlay.addEventListener("click", (e) => {
        if (
          e.target.classList.contains("fold-marker") ||
          e.target.classList.contains("fold-placeholder")
        ) {
          const foldId = e.target.dataset.foldId;
          if (window.chatInputManager && window.chatInputManager.toggleFold) {
            window.chatInputManager.toggleFold(foldId);
          }
        }
      });
    }

    const closeBtn = overlay.querySelector("#closePreviewBtn");
    const viewCodeBtn = overlay.querySelector("#viewCodeBtn");
    const showLinkedBtn = overlay.querySelector("#showLinkedBtn");

    closeBtn?.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      closePreview();
    });

    // FIXED: Enhanced toggle between preview and code view
    if (viewCodeBtn && canRender) {
      viewCodeBtn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();

        const container = overlay.querySelector(".preview-content-container");
        const isShowingCode = container.querySelector(
          ".code-view-enhanced, .code-view"
        );

        if (isShowingCode) {
          // Switch back to preview
          let regeneratedHTML = block.content;

          // Regenerate linking if needed
          if (
            (block.extension === ".html" || block.extension === ".htm") &&
            block.allFiles
          ) {
            const cssFiles = block.allFiles.filter(
              (f) =>
                f.extension === ".css" ||
                (f.filename && f.filename.toLowerCase().endsWith(".css"))
            );
            const jsFiles = block.allFiles.filter(
              (f) =>
                f.extension === ".js" ||
                (f.filename && f.filename.toLowerCase().endsWith(".js"))
            );
            regeneratedHTML = contentManager.linkFilesToHTML(
              block.originalContent,
              cssFiles,
              jsFiles
            );
          }

          const safeHtml = contentManager.sanitizeHTML(regeneratedHTML);

          container.innerHTML = `
          <iframe 
            class="preview-iframe" 
            srcdoc="${contentManager.escapeAttribute(safeHtml)}"
            style="width: 100%; height: 100%; border: none;"
            sandbox="allow-scripts"
          ></iframe>
        `;
          viewCodeBtn.innerHTML = "📝 View Code";
        } else {
          // Switch to enhanced code view
          showEnhancedCodeView();
          viewCodeBtn.innerHTML = "👁️ View Preview";
        }
      });
    }

    // Show linked files info
    if (showLinkedBtn && block.linkedFiles && block.linkedFiles.length > 0) {
      showLinkedBtn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();

        const linkedFilesInfo = block.linkedFiles
          .map((file) => `• ${file.filename} (${file.type || file.extension})`)
          .join("\n");

        alert(
          `Linked Files:\n\n${linkedFilesInfo}\n\nThese files are automatically embedded when previewing the HTML.`
        );
      });
    }

    const escapeHandler = function (e) {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        closePreview();
      }
    };

    document.addEventListener("keydown", escapeHandler);
  },

  // Add these helper methods to contentManager if they don't exist:
  getLanguageFromExtension: function (extension) {
    const extMap = {
      ".html": "html",
      ".htm": "html",
      ".css": "css",
      ".js": "javascript",
      ".jsx": "javascript",
      ".ts": "typescript",
      ".tsx": "typescript",
      ".json": "json",
      ".xml": "xml",
      ".py": "python",
      ".php": "php",
      ".java": "java",
      ".cpp": "cpp",
      ".c": "c",
      ".cs": "csharp",
      ".rb": "ruby",
      ".go": "go",
      ".rs": "rust",
      ".sql": "sql",
      ".sh": "bash",
      ".yaml": "yaml",
      ".yml": "yaml",
      ".md": "markdown",
    };

    return extMap[extension?.toLowerCase()] || "plaintext";
  },

  getLanguageFromType: function (type) {
    const typeMap = {
      web: "html",
      code: "javascript",
      style: "css",
      data: "json",
    };

    return typeMap[type] || "plaintext";
  },

  // Add HTML sanitization method
  sanitizeHTML: function (html) {
    // Remove potentially dangerous elements
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    // Remove dangerous elements
    const dangerous = doc.querySelectorAll(
      'script[src], link[href^="http"], iframe'
    );
    dangerous.forEach((el) => el.remove());

    return doc.documentElement.innerHTML;
  },

  escapeAttribute: function (str) {
    return str.replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  },

  getFileIcon: function (type, extension) {
    const icons = {
      web: "🌐",
      code: "💻",
      data: "📊",
      document: "📄",
      database: "🗄️",
      other: "📄",
    };

    if (extension === ".html" || extension === ".htm") return "🌐";
    if (extension === ".css") return "🎨";
    if (extension === ".js") return "⚡";
    if (extension === ".py") return "🐍";
    if (extension === ".json") return "🔧";
    if (extension === ".md") return "📝";

    return icons[type] || "📄";
  },

  toggleBlock: function (blockId) {
    const block = this.blocks.get(blockId);
    if (!block) return;

    block.collapsed = !block.collapsed;

    const header = document.querySelector(`#${blockId} .block-header`);
    const content = document.querySelector(`#${blockId}_content`);
    const indicator = header?.querySelector(".collapse-indicator");

    if (block.collapsed) {
      header?.classList.add("collapsed");
      content?.classList.add("collapsed");
      if (indicator) indicator.textContent = "▼";
    } else {
      header?.classList.remove("collapsed");
      content?.classList.remove("collapsed");
      if (indicator) indicator.textContent = "▲";
    }
  },

  showCodePreview: function (blockId) {
    const block = this.blocks.get(blockId);
    if (!block) return;

    const content = document.querySelector(`#${blockId}_content`);
    if (!content) return;

    const language = block.language || "text";
    content.innerHTML = `
      <div class="code-preview">
        <pre><code class="language-${language}">${this.escapeHtml(
      block.content
    )}</code></pre>
      </div>
    `;

    if (block.collapsed) {
      this.toggleBlock(blockId);
    }
  },

  showCode: function (blockId) {
    console.log("🔍 showCode called with blockId:", blockId);

    const block = this.blocks.get(blockId);
    console.log("🔍 Block found:", !!block);

    if (window.chatInputManager && block) {
      console.log("🔍 Transferring to chatInputManager");

      if (!window.chatInputManager.largeContentStore) {
        console.log("🔍 Creating largeContentStore");
        window.chatInputManager.largeContentStore = new Map();
      }

      const previewId = `code_view_${blockId}`;
      console.log("🔍 Creating preview with ID:", previewId);

      // ENHANCED: More robust language detection
      let language = block.language;

      // First, try to detect from content if no language is set
      if (!language || language === "text" || language === "plaintext") {
        language = this.detectLanguageFromContent(
          block.content || block.originalContent
        );
        console.log("🔍 Detected language from content:", language);
      }

      // If still no language, try extension
      if (!language || language === "plaintext") {
        const extMap = {
          ".html": "html",
          ".htm": "html",
          ".css": "css",
          ".js": "javascript",
          ".jsx": "javascript",
          ".ts": "typescript",
          ".tsx": "typescript",
          ".json": "json",
          ".xml": "xml",
          ".py": "python",
          ".php": "php",
          ".java": "java",
          ".cpp": "cpp",
          ".c": "c",
          ".cs": "csharp",
          ".rb": "ruby",
          ".go": "go",
          ".rs": "rust",
          ".sql": "sql",
          ".sh": "bash",
          ".yaml": "yaml",
          ".yml": "yaml",
          ".md": "markdown",
          ".txt": "plaintext",
        };

        if (block.extension) {
          language = extMap[block.extension.toLowerCase()] || "plaintext";
        }
      }

      // If still no language, try type mapping
      if (!language || language === "plaintext") {
        const typeMap = {
          web: "html",
          code: "javascript",
          style: "css",
          data: "json",
          document: "plaintext",
        };

        if (block.type) {
          language = typeMap[block.type] || "plaintext";
        }
      }

      console.log("🔍 Final detected language:", language);

      // Transfer ALL block data with proper language
      window.chatInputManager.largeContentStore.set(previewId, {
        content: block.content || block.originalContent,
        originalContent: block.originalContent,
        filename: block.filename,
        type: block.type,
        extension: block.extension,
        language: language, // Ensure language is set
        linkedFiles: block.linkedFiles,
        allFiles: block.allFiles,
        isExecutable: block.isExecutable,
        mimeType: block.mimeType,
      });

      console.log(
        "🔍 Calling chatInputManager.viewFullContent with language:",
        language
      );
      window.chatInputManager.viewFullContent(previewId);
    } else {
      console.log("🔍 Fallback to previewContent");
      this.previewContent(blockId);
    }
  },

  // Add this method to your contentManager object:
  detectLanguageFromContent: function (content) {
    if (!content) return "plaintext";

    const firstLines = content.split("\n").slice(0, 10).join("\n");

    // HTML detection
    if (/<(!DOCTYPE|html|head|body|div|script|style)/i.test(firstLines)) {
      return "html";
    }

    // CSS detection
    if (
      /^(\.|#|@media|@import|:root|\*\s*{)/m.test(firstLines) ||
      /{\s*(color|background|margin|padding|font|display|position):/i.test(
        firstLines
      )
    ) {
      return "css";
    }

    // JavaScript detection
    if (
      /^(import|export|const|let|var|function|class|if|for|while)\s/m.test(
        firstLines
      ) ||
      /\b(console\.log|document\.|window\.|require\(|module\.exports)/i.test(
        firstLines
      )
    ) {
      return "javascript";
    }

    // Python detection
    if (
      /^(import|from|def|class|if|elif|else:|for|while|with|try:|except:|print\()/m.test(
        firstLines
      )
    ) {
      return "python";
    }

    // JSON detection
    if (
      /^[\s]*[{\[]/.test(content.trim()) &&
      /[}\]][\s]*$/.test(content.trim())
    ) {
      try {
        JSON.parse(content);
        return "json";
      } catch (e) {
        // Not valid JSON
      }
    }

    // SQL detection
    if (
      /^(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|FROM|WHERE|JOIN)\s/im.test(
        firstLines
      )
    ) {
      return "sql";
    }

    // XML detection
    if (
      /^<\?xml/.test(content.trim()) ||
      /<[^>]+>[^<]*<\/[^>]+>/s.test(firstLines)
    ) {
      return "xml";
    }

    // PHP detection
    if (/<\?php|\$[a-zA-Z_]/.test(firstLines)) {
      return "php";
    }

    // Java detection
    if (
      /^(package|import|public\s+class|private\s+class|public\s+static\s+void\s+main)/m.test(
        firstLines
      )
    ) {
      return "java";
    }

    // Shell/Bash detection
    if (
      /^#!/.test(firstLines) ||
      /^(echo|cd|ls|mkdir|rm|cp|mv|chmod|export)\s/m.test(firstLines)
    ) {
      return "bash";
    }

    // YAML detection
    if (/^---\s*$|^[a-zA-Z_-]+:\s/m.test(firstLines)) {
      return "yaml";
    }

    // Markdown detection
    if (/^#{1,6}\s|^\*{3,}$|^-{3,}$|^```|^\|.*\|/m.test(firstLines)) {
      return "markdown";
    }

    return "plaintext";
  },

  downloadContent: function (blockId) {
    const block = this.blocks.get(blockId);
    if (!block) {
      console.error("Block not found:", blockId);
      return;
    }

    try {
      const mimeType =
        block.mimeType || this.getMimeType(block.extension || ".txt");
      const filename = block.filename || "download.txt";

      const contentToDownload = block.originalContent || block.content;

      const blob = new Blob([contentToDownload], {
        type: mimeType + ";charset=utf-8",
      });

      const url = window.URL.createObjectURL(blob);
      const downloadLink = document.createElement("a");
      downloadLink.href = url;
      downloadLink.download = filename;
      downloadLink.style.display = "none";

      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);

      window.URL.revokeObjectURL(url);

      this.showButtonFeedback(blockId, "download", "✅ Downloaded", "success");
    } catch (error) {
      console.error("Download failed:", error);
      this.showButtonFeedback(blockId, "download", "❌ Failed", "error");
    }
  },

  getMimeType: function (extension) {
    const mimeTypes = {
      ".html": "text/html",
      ".htm": "text/html",
      ".css": "text/css",
      ".js": "application/javascript",
      ".json": "application/json",
      ".py": "text/x-python",
      ".php": "text/x-php",
      ".md": "text/markdown",
      ".sql": "application/sql",
      ".xml": "application/xml",
      ".yaml": "text/yaml",
      ".yml": "text/yaml",
      ".sh": "application/x-sh",
      ".txt": "text/plain",
    };

    return mimeTypes[extension.toLowerCase()] || "text/plain";
  },

  copyContent: function (blockId) {
    const block = this.blocks.get(blockId);
    if (!block) return;

    navigator.clipboard
      .writeText(block.content)
      .then(function () {
        contentManager.showButtonFeedback(
          blockId,
          "copy",
          "✅ Copied",
          "success"
        );
      })
      .catch(function (err) {
        console.error("Failed to copy:", err);
        contentManager.showButtonFeedback(
          blockId,
          "copy",
          "❌ Failed",
          "error"
        );
      });
  },

  showButtonFeedback: function (blockId, action, message, type) {
    const button = document.querySelector(
      `#${blockId} [data-action="${action}"]`
    );
    if (!button) return;

    const originalText = button.innerHTML;
    const originalStyle = {
      background: button.style.background,
      borderColor: button.style.borderColor,
    };

    button.innerHTML = message;

    if (type === "success") {
      button.style.background = "rgba(52, 211, 153, 0.3)";
      button.style.borderColor = "rgba(52, 211, 153, 0.5)";
    } else if (type === "error") {
      button.style.background = "rgba(239, 68, 68, 0.3)";
      button.style.borderColor = "rgba(239, 68, 68, 0.5)";
    }

    setTimeout(function () {
      button.innerHTML = originalText;
      button.style.background = originalStyle.background;
      button.style.borderColor = originalStyle.borderColor;
    }, 2000);
  },

  formatFileSize: function (bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + " KB";
    return Math.round(bytes / (1024 * 1024)) + " MB";
  },

  escapeHtml: function (text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  },

  // Additional helper methods for the legacy content blocks
  createContentBlock: function (
    content,
    type = "text",
    filename = "",
    fileExtension = ""
  ) {
    const blockId = `block_${++this.blockCounter}`;
    const wordCount = content.split(/\s+/).length;
    const charCount = content.length;

    const shouldCollapse = wordCount > 250 || charCount > 1500;

    if (!shouldCollapse && type === "text") {
      return content;
    }

    const isRenderableContent = this.isRenderableContent(
      content,
      fileExtension
    );
    const generatedFilename =
      filename || this.generateSmartFilename(content, type, fileExtension);

    const block = {
      id: blockId,
      content: content,
      type: type,
      filename: generatedFilename,
      extension: fileExtension,
      wordCount: wordCount,
      charCount: charCount,
      collapsed: true,
      isRenderable: isRenderableContent,
    };

    this.blocks.set(blockId, block);
    return this.renderLegacyBlock(block);
  },

  renderLegacyBlock: function (block) {
    const previewText =
      block.content.length > 200
        ? block.content.substring(0, 200) + "..."
        : block.content;

    return `
      <div class="content-block" id="${block.id}">
        <div class="block-header ${block.collapsed ? "collapsed" : ""}">
          <div class="block-info">
            <div class="block-icon">📄</div>
            <div class="block-details">
              <h4>${this.escapeHtml(block.filename)}</h4>
              <div class="block-meta">${
                block.wordCount
              } words • ${this.formatFileSize(block.charCount)}</div>
            </div>
          </div>
          <div class="block-actions">
            <button class="block-btn primary" data-action="preview">👁️ Preview</button>
            <button class="block-btn" data-action="download">⬇️ Download</button>
            <button class="block-btn" data-action="copy">📋 Copy</button>
            <span class="collapse-indicator">▼</span>
          </div>
        </div>
        <div class="block-content ${block.collapsed ? "collapsed" : ""}" id="${
      block.id
    }_content">
          <div class="preview-content">${this.escapeHtml(previewText)}</div>
        </div>
      </div>
    `;
  },

  isRenderableContent: function (content, extension) {
    const webExtensions = [".html", ".htm"];
    const hasWebTags = /<(html|head|body|div|script|style)/i.test(content);
    return webExtensions.includes(extension.toLowerCase()) || hasWebTags;
  },

  generateSmartFilename: function (content, type, extension) {
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, "-");
    let baseName = "untitled";

    if (extension === ".html" || extension === ".htm") {
      const titleMatch = content.match(/<title[^>]*>([^<]*)<\/title>/i);
      if (titleMatch && titleMatch[1].trim()) {
        baseName = titleMatch[1]
          .trim()
          .replace(/[^a-zA-Z0-9\s-]/g, "")
          .replace(/\s+/g, "_")
          .toLowerCase();
      } else {
        baseName = "webpage";
      }
    } else if (extension === ".css") {
      baseName = "stylesheet";
    } else if (extension === ".js") {
      const classMatch = content.match(/class\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/);
      const functionMatch = content.match(
        /function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/
      );
      if (classMatch) {
        baseName = classMatch[1].toLowerCase();
      } else if (functionMatch) {
        baseName = functionMatch[1].toLowerCase();
      } else {
        baseName = "script";
      }
    }

    return `${baseName}_${timestamp}${extension || ".txt"}`;
  },

  // Helper method to get file extension
  getFileExtension: function (filename) {
    if (!filename) return ".txt";
    const parts = filename.split(".");
    return parts.length > 1 ? "." + parts[parts.length - 1] : ".txt";
  },
};

// ENHANCED Message Manager with Edit Support and Improved Thinking Indicator
var messageManager = {
  // FIXED: Single duplicate tracking system at the message manager level
  lastProcessedMessageText: "",
  lastProcessedMessageTime: 0,
  duplicateThresholdMs: 3000, // 3 seconds

  // Track current edit states
  editingMessageId: null,

  // Enhanced thinking indicator properties
  thinkingStartTime: null,
  minimumThinkingTime: 500, // Minimum 500ms display time

  // In messageManager object, find the createMessage function
  createMessage: function (
    text,
    type = "ai",
    messageType = "",
    model = null,
    addToHistory = true,
    timestamp = null,
    messageId = null,
    parentMessageId = null
  ) {
    const content = document.getElementById("aiContent");
    if (!content) return;

    const emptyState = content.querySelector(".empty-state");
    if (emptyState) emptyState.remove();
    this.hideThinking();

    const message = document.createElement("div");
    const id =
      messageId ||
      `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    message.id = id;
    message.className =
      type === "ai" ? "message ai-response" : "message user-message";
    message.dataset.messageId = id;

    const time = timestamp
      ? new Date(timestamp).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })
      : new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });

    const modelLabel =
      model && type === "ai"
        ? `<span class="model-label">${this.getModelName(model)}</span>`
        : "";

    // Check if this message has edit history
    const editHistory = appState.getEditHistory(id);
    const currentVersion = editHistory.length;
    const versionNav =
      editHistory.length > 0
        ? this.createVersionNav(id, currentVersion + 1, currentVersion + 1)
        : "";

    message.innerHTML = `
        <div class="message-header">
            <span class="message-type">${
              type === "ai" ? messageType || "AI" : "You"
            }</span>
            <span class="message-time">${time}</span>
            ${modelLabel}
        </div>
        <div class="message-content">${this.formatMessage(
          text,
          type === "ai"
        )}</div>
        <div class="message-footer">
            ${
              type === "user"
                ? `
            <button class="message-edit-btn" onclick="messageManager.startEdit('${id}')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
            </button>
            `
                : ""
            }
            ${versionNav}
        </div>
    `;

    content.appendChild(message);
    content.scrollTop = content.scrollHeight;

    // CHANGE THIS LINE - replace responseText with text
    const isErrorMessage =
      text.includes("usage limit") ||
      text.includes("Your usage will reset") ||
      messageType === "Auth Required" ||
      messageType === "Error";

    if (addToHistory && !isErrorMessage) {
      if (!appState.currentTopicId) {
        console.warn(
          "⚠️ No current topic ID when creating message - creating new topic"
        );
        const newTopicId = Date.now().toString();
        appState.currentTopicId = newTopicId;
        appState.currentSubtopicId = "main";
        appState.topics[newTopicId] = {
          title: "New Conversation",
          createdAt: new Date().toISOString(),
          subtopics: { main: "Main Conversation" },
        };
      }

      const historyEntry = {
        id: id,
        text: text, // Use 'text' here, not 'responseText'
        type: type,
        messageType: messageType,
        model: model || appState.selectedAIModel,
        timestamp: timestamp || new Date().toISOString(),
        topicId: appState.currentTopicId,
        subtopicId: appState.currentSubtopicId,
        currentVersion: currentVersion + 1,
        parentMessageId: parentMessageId,
      };

      appState.chatHistory.push(historyEntry);

      // ENHANCED: If this is an AI response, track it for the parent message's current version
      if (type === "ai" && parentMessageId) {
        const parentMessage = appState.chatHistory.find(
          (msg) => msg.id === parentMessageId
        );
        if (parentMessage) {
          const parentVersion = parentMessage.currentVersion || 1;
          appState.addResponseToVersion(parentMessageId, id, parentVersion);
        }
      }

      appState.saveToStorage();
    }

    const messages = content.querySelectorAll(".message");
    if (messages.length > CONFIG.MAX_MESSAGES_DISPLAY) {
      messages[0].remove();
    }

    return id; // Return the message ID for tracking
  },

  // Create version navigation UI
  createVersionNav: function (messageId, currentVersion, totalVersions) {
    return `
      <div class="version-nav" data-message-id="${messageId}">
        <button class="version-nav-btn prev" onclick="messageManager.navigateVersion('${messageId}', -1)" ${
      currentVersion <= 1 ? "disabled" : ""
    }>‹</button>
        <span class="version-indicator">${currentVersion}/${totalVersions}</span>
        <button class="version-nav-btn next" onclick="messageManager.navigateVersion('${messageId}', 1)" ${
      currentVersion >= totalVersions ? "disabled" : ""
    }>›</button>
      </div>
    `;
  },

  // Start editing a message
  startEdit: function (messageId) {
    // Cancel any ongoing edit
    if (this.editingMessageId) {
      this.cancelEdit(this.editingMessageId);
    }

    const messageEl = document.getElementById(messageId);
    if (!messageEl) return;

    const contentEl = messageEl.querySelector(".message-content");
    if (!contentEl) return;

    // Get the current text (remove HTML formatting)
    const currentText = this.getPlainText(contentEl);

    // Store the original content
    messageEl.dataset.originalContent = contentEl.innerHTML;

    // Check for attachments/files
    const historyEntry = appState.chatHistory.find(
      (msg) => msg.id === messageId
    );
    const hasAttachments =
      historyEntry && (historyEntry.files || historyEntry.attachments);

    // Create edit UI with chat input manager support
    contentEl.innerHTML = `
      <div class="message-edit-container">
        <textarea class="message-edit-input" id="edit_${messageId}">${currentText}</textarea>
        ${
          hasAttachments
            ? '<div class="edit-attachments-notice">Note: Files and attachments from the original message will be preserved</div>'
            : ""
        }
        <div class="message-edit-actions">
          <button class="edit-save-btn" onclick="messageManager.saveEdit('${messageId}')">Save & Send</button>
          <button class="edit-cancel-btn" onclick="messageManager.cancelEdit('${messageId}')">Cancel</button>
        </div>
      </div>
    `;

    // Set up the textarea with auto-resize
    const textarea = document.getElementById(`edit_${messageId}`);
    textarea.style.height = "auto";
    textarea.style.height = textarea.scrollHeight + "px";

    textarea.addEventListener("input", function () {
      this.style.height = "auto";
      this.style.height = Math.min(this.scrollHeight, 300) + "px";
    });

    // Handle paste events for large content/images
    textarea.addEventListener("paste", (e) => {
      // If chatInputManager exists, use its paste handling
      if (window.chatInputManager && window.chatInputManager.handlePaste) {
        // Create a temporary context for the edit
        const tempContext = {
          input: textarea,
          messageId: messageId,
          isEdit: true,
        };
        window.chatInputManager.handlePaste.call(tempContext, e);
      }
    });

    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);

    this.editingMessageId = messageId;
  },

  // Cancel editing
  cancelEdit: function (messageId) {
    const messageEl = document.getElementById(messageId);
    if (!messageEl) return;

    const contentEl = messageEl.querySelector(".message-content");
    const originalContent = messageEl.dataset.originalContent;

    if (contentEl && originalContent) {
      contentEl.innerHTML = originalContent;
      delete messageEl.dataset.originalContent;
    }

    if (this.editingMessageId === messageId) {
      this.editingMessageId = null;
    }
  },

  // Save edit and resend with Context+
  saveEdit: function (messageId) {
    const textarea = document.getElementById(`edit_${messageId}`);
    if (!textarea) return;

    const newText = textarea.value.trim();
    if (!newText) {
      this.cancelEdit(messageId);
      return;
    }

    // Get the original message data
    const historyIndex = appState.chatHistory.findIndex(
      (msg) => msg.id === messageId
    );
    if (historyIndex === -1) return;

    const originalMessage = appState.chatHistory[historyIndex];
    const currentTimestamp = originalMessage.timestamp;

    // Save current version to edit history
    appState.addEditHistory(messageId, {
      version: originalMessage.currentVersion || 1,
      text: originalMessage.text,
      timestamp: currentTimestamp,
      editedAt: new Date().toISOString(),
    });

    // Update the message in history
    originalMessage.text = newText;
    originalMessage.currentVersion = (originalMessage.currentVersion || 1) + 1;
    originalMessage.lastEditedAt = new Date().toISOString();

    // Hide all messages after this one
    appState.updateHiddenMessages(messageId, new Date().toISOString());

    // Update the UI
    const messageEl = document.getElementById(messageId);
    const contentEl = messageEl.querySelector(".message-content");
    contentEl.innerHTML = this.formatMessage(newText, false);

    // Update version navigation
    const footerEl = messageEl.querySelector(".message-footer");
    const editHistory = appState.getEditHistory(messageId);
    const versionNav = this.createVersionNav(
      messageId,
      originalMessage.currentVersion,
      editHistory.length + 1
    );

    // Update footer
    footerEl.innerHTML = `
      <button class="message-edit-btn" onclick="messageManager.startEdit('${messageId}')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
        </svg>
      </button>
      ${versionNav}
    `;

    // Hide subsequent messages in the UI
    const allMessages = document.querySelectorAll(".message");
    let foundEdited = false;
    allMessages.forEach((msg) => {
      if (foundEdited && appState.hiddenMessages.has(msg.id)) {
        msg.style.display = "none";
      }
      if (msg.id === messageId) {
        foundEdited = true;
      }
    });

    // Save state
    appState.saveToStorage();

    // FIXED: Pass true for skipUserMessage parameter to prevent duplicate
    const attachments = originalMessage.attachments || [];
    chatManager.sendMessage(newText, attachments, true); // CHANGED: Added true parameter

    this.editingMessageId = null;
  },

  // Navigate through edit versions with proper response handling
  navigateVersion: function (messageId, direction) {
    const historyEntry = appState.chatHistory.find(
      (msg) => msg.id === messageId
    );
    if (!historyEntry) return;

    const editHistory = appState.getEditHistory(messageId);
    const totalVersions = editHistory.length + 1;
    const currentVersion =
      historyEntry.displayVersion ||
      historyEntry.currentVersion ||
      totalVersions;
    const newVersion = Math.max(
      1,
      Math.min(totalVersions, currentVersion + direction)
    );

    if (newVersion === currentVersion) return;

    // Get the text for this version
    let versionText, versionTimestamp;
    if (newVersion === totalVersions) {
      // Current version
      versionText = historyEntry.text;
      versionTimestamp = historyEntry.lastEditedAt || historyEntry.timestamp;
    } else {
      // Historical version
      const historicalVersion = editHistory[newVersion - 1];
      versionText = historicalVersion.text;
      versionTimestamp = historicalVersion.timestamp;
    }

    // Update display
    const messageEl = document.getElementById(messageId);
    const contentEl = messageEl.querySelector(".message-content");
    contentEl.innerHTML = this.formatMessage(versionText, false);

    // Update version indicator
    const versionIndicator = messageEl.querySelector(".version-indicator");
    versionIndicator.textContent = `${newVersion}/${totalVersions}`;

    // Update button states
    const prevBtn = messageEl.querySelector(".version-nav-btn.prev");
    const nextBtn = messageEl.querySelector(".version-nav-btn.next");
    prevBtn.disabled = newVersion <= 1;
    nextBtn.disabled = newVersion >= totalVersions;

    // Store display version
    historyEntry.displayVersion = newVersion;

    // ENHANCED: Show/hide responses based on version
    this.updateVisibleResponses(messageId, newVersion);
  },

  // Update which responses are visible based on version
  updateVisibleResponses: function (userMessageId, version) {
    // First, hide all messages after this user message
    const messageIndex = appState.chatHistory.findIndex(
      (msg) => msg.id === userMessageId
    );
    if (messageIndex === -1) return;

    // Get all message elements
    const allMessages = document.querySelectorAll(".message");
    const messageEl = document.getElementById(userMessageId);

    if (!messageEl) return;

    // Find the position of this message in the DOM
    let foundUserMessage = false;
    let subsequentMessages = [];

    allMessages.forEach((msg) => {
      if (msg.id === userMessageId) {
        foundUserMessage = true;
      } else if (foundUserMessage) {
        subsequentMessages.push(msg);
      }
    });

    // Hide all subsequent messages first
    subsequentMessages.forEach((msg) => {
      msg.style.display = "none";
    });

    // Now show only the responses for this version
    const responsesForVersion = appState.getMessagesForVersion(
      userMessageId,
      version
    );

    responsesForVersion.forEach((responseId) => {
      const responseEl = document.getElementById(responseId);
      if (responseEl) {
        responseEl.style.display = "";
      }
    });

    // If showing the current version, also show any new messages not yet tracked
    const editHistory = appState.getEditHistory(userMessageId);
    const totalVersions = editHistory.length + 1;

    if (version === totalVersions) {
      // This is the current version, show all untracked subsequent messages
      let showRemaining = false;

      for (let i = messageIndex + 1; i < appState.chatHistory.length; i++) {
        const msg = appState.chatHistory[i];

        // Check if this message is tracked for any version
        let isTracked = false;
        for (let v = 1; v <= totalVersions; v++) {
          const trackedMessages = appState.getMessagesForVersion(
            userMessageId,
            v
          );
          if (trackedMessages.includes(msg.id)) {
            isTracked = true;
            break;
          }
        }

        // If not tracked and it's after our responses, show it
        if (!isTracked || showRemaining) {
          const msgEl = document.getElementById(msg.id);
          if (msgEl) {
            msgEl.style.display = "";
          }

          // Once we find an untracked message, show all remaining
          if (!isTracked) {
            showRemaining = true;
          }
        }
      }
    }
  },

  // Get plain text from HTML content
  getPlainText: function (element) {
    // Create a temporary element
    const temp = document.createElement("div");
    temp.innerHTML = element.innerHTML;

    // Replace <br> with newlines
    temp.querySelectorAll("br").forEach((br) => br.replaceWith("\n"));

    // Get text content
    return temp.textContent || temp.innerText || "";
  },

  // FIXED: Enhanced createAIResponseWithFiles with data standardization
  createAIResponseWithFiles: function (responseData) {
    console.log("🗂️ createAIResponseWithFiles called with:", responseData);
    console.log("🗂️ Files in response:", responseData.files);
    console.log(
      "🗂️ File count:",
      responseData.files ? responseData.files.length : 0
    );

    // Simple duplicate check based on content and timing
    const currentTime = Date.now();
    const responseText = responseData.response || responseData.text || "";

    if (
      responseText === this.lastProcessedMessageText &&
      currentTime - this.lastProcessedMessageTime < this.duplicateThresholdMs
    ) {
      console.log(
        "🔄 Duplicate message detected based on content + timing, skipping"
      );
      return;
    }

    // Update tracking
    this.lastProcessedMessageText = responseText;
    this.lastProcessedMessageTime = currentTime;

    const content = document.getElementById("aiContent");
    if (!content) {
      console.error("❌ aiContent element not found");
      return;
    }

    const emptyState = content.querySelector(".empty-state");
    if (emptyState) {
      emptyState.remove();
    }

    this.hideThinking();

    const message = document.createElement("div");
    const messageId = `msg_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    message.id = messageId;
    message.className = "message ai-response";
    message.dataset.messageId = messageId;

    const time = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    const modelLabel = responseData.model_used
      ? `<span class="model-label">${this.getModelName(
          responseData.model_used
        )}</span>`
      : "";

    const hasFiles = responseData.has_files === true;
    const filesArray = responseData.files;
    const isValidFilesArray = Array.isArray(filesArray);
    const fileCount = isValidFilesArray ? filesArray.length : 0;

    console.log("🗂️ Processing files for display:", {
      hasFiles,
      isValidFilesArray,
      fileCount,
      filesArray: filesArray,
    });

    // Debug log all files
    if (filesArray) {
      filesArray.forEach((file, index) => {
        console.log(`🗂️ File ${index + 1}:`, {
          filename: file.filename,
          extension: file.extension,
          type: file.type,
          hasContent: !!file.content,
          contentPreview: file.content
            ? file.content.substring(0, 100)
            : "no content",
        });
      });
    }

    let messageContent = `
  <div class="message-header">
    <span class="message-type">AI</span>
    <span class="message-time">${time}</span>
    ${modelLabel}
  </div>
  <div class="message-content">
    ${this.formatMessage(responseText, true)}
  </div>
`;

    if (hasFiles && isValidFilesArray && fileCount > 0) {
      messageContent += '<div class="message-files">';

      // FIXED: Standardize file objects before processing
      const standardizedFiles = filesArray.map((file) => ({
        ...file,
        extension:
          file.extension || contentManager.getFileExtension(file.filename),
        filename: file.filename,
        content: file.content,
        type: file.type,
      }));

      // CRITICAL: Pass ALL standardized files to each createFileBlock call
      standardizedFiles.forEach(function (fileData, index) {
        if (!fileData || typeof fileData !== "object") {
          console.warn(
            `🗂️ Skipping invalid file data at index ${index}:`,
            fileData
          );
          return;
        }

        try {
          // Pass the entire standardized files array so HTML files can find CSS/JS files
          const fileBlockHtml = contentManager.createFileBlock(
            fileData,
            standardizedFiles
          );
          if (fileBlockHtml && typeof fileBlockHtml === "string") {
            messageContent += fileBlockHtml;
          }
        } catch (error) {
          console.error(
            `🗂️ Error creating file block for file ${index + 1}:`,
            error
          );
        }
      });

      messageContent += "</div>";
    }

    // Add footer (AI messages don't have edit button)
    messageContent += '<div class="message-footer"></div>';

    try {
      message.innerHTML = messageContent;
      content.appendChild(message);
      content.scrollTop = content.scrollHeight;
    } catch (error) {
      console.error("🗂️ Error setting message innerHTML:", error);
      message.innerHTML = `
    <div class="message-header">
      <span class="message-type">AI</span>
      <span class="message-time">${time}</span>
    </div>
    <div class="message-content">
      ${this.formatMessage(responseText, true)}
      <div class="error-notice">Error displaying files - check console for details</div>
    </div>
    <div class="message-footer"></div>
  `;
      content.appendChild(message);
    }

    // CRITICAL: Create history entry with complete file information
    console.log("🗂️ Preparing to save message with files to history");
    console.log("🗂️ Files to save:", filesArray);

    const historyEntry = {
      id: messageId,
      text: responseText,
      type: "ai",
      messageType: "AI Response",
      model: responseData.model_used || appState.selectedAIModel,
      timestamp: new Date().toISOString(),
      topicId: appState.currentTopicId,
      subtopicId: appState.currentSubtopicId,
      currentVersion: 1,

      // CRITICAL: Save complete file information to history
      files: isValidFilesArray
        ? filesArray.map((file) => ({
            id: file.id,
            filename: file.filename,
            content: file.content,
            type: file.type,
            extension: file.extension,
            language: file.language,
            size: file.size,
            word_count: file.word_count,
            is_executable: file.is_executable,
            mime_type: file.mime_type,
          }))
        : [],

      // Additional metadata
      has_files: hasFiles,
      file_count: fileCount,
    };

    console.log("🗂️ History entry prepared:", {
      id: historyEntry.id,
      type: historyEntry.type,
      textLength: historyEntry.text.length,
      fileCount: historyEntry.files.length,
      topicId: historyEntry.topicId,
    });

    console.log("🗂️ Files being saved to history:");
    historyEntry.files.forEach((file, index) => {
      console.log(
        `  ${index + 1}: ${file.filename} (${file.type}, ${
          file.content?.length || 0
        } chars)`
      );
    });

    try {
      // CRITICAL: Add to history immediately
      appState.chatHistory.push(historyEntry);

      // CRITICAL: Save to storage immediately
      appState.saveToStorage();

      console.log("🗂️ ✅ AI response with files saved to history:", {
        id: historyEntry.id,
        type: historyEntry.type,
        fileCount: historyEntry.files.length,
        historyLength: appState.chatHistory.length,
      });

      // Verify the files were saved correctly
      const savedEntry = appState.chatHistory[appState.chatHistory.length - 1];
      console.log(
        "🗂️ ✅ Verification - saved entry has files:",
        savedEntry.files ? savedEntry.files.length : 0
      );
    } catch (error) {
      console.error("🗂️ ❌ Error saving to history:", error);
    }

    // Clean up old messages
    const messages = content.querySelectorAll(".message");
    if (messages.length > CONFIG.MAX_MESSAGES_DISPLAY) {
      try {
        messages[0].remove();
      } catch (error) {
        console.error("🗑️ Error removing old message:", error);
      }
    }
  },

  formatMessage: function (text, isAI = false) {
    let formatted = text
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\n- /g, "\n• ")
      .replace(/\n/g, "<br>");

    if (isAI) {
      const sentences = formatted.split(/(?<=[.!?])\s+/);
      formatted = sentences
        .map(function (sentence) {
          if (sentence.trim()) {
            const escapedSentence = sentence
              .replace(/'/g, "\\'")
              .replace(/"/g, '\\"');
            return `<span class="hoverable-segment" data-sentence="${escapedSentence}">${sentence}</span>`;
          }
          return sentence;
        })
        .join(" ");
    }

    return formatted;
  },

  // ENHANCED: Show thinking with minimum display time tracking
  showThinking: function () {
    const content = document.getElementById("aiContent");
    console.log("🤔 showThinking called, aiContent:", content);

    if (!content) {
      console.error("❌ aiContent element not found!");
      return;
    }

    const emptyState = content.querySelector(".empty-state");
    if (emptyState) emptyState.remove();

    const existingThinking = content.querySelector(".thinking");
    if (existingThinking) existingThinking.remove();

    const thinking = document.createElement("div");
    thinking.className = "thinking";
    thinking.innerHTML = `
      <div class="thinking-dots">
        <span></span>
        <span></span>
        <span></span>
      </div>
      <span style="font-size: 12px; color: #a78bfa;">AI is thinking...</span>
    `;
    content.appendChild(thinking);
    content.scrollTop = content.scrollHeight;

    // Record when we started showing the thinking indicator
    this.thinkingStartTime = Date.now();

    console.log(
      "🤔 Thinking indicator shown at",
      new Date(this.thinkingStartTime).toISOString()
    );
  },

  // ENHANCED: Hide thinking with minimum display time
  hideThinking: function () {
    const thinking = document.querySelector(".thinking");
    if (!thinking) {
      console.log("🤔 No thinking indicator to hide");
      return;
    }

    // Calculate how long the thinking indicator has been shown
    const elapsedTime = this.thinkingStartTime
      ? Date.now() - this.thinkingStartTime
      : 0;
    const remainingTime = Math.max(0, this.minimumThinkingTime - elapsedTime);

    console.log(
      `🤔 hideThinking called - elapsed: ${elapsedTime}ms, remaining: ${remainingTime}ms`
    );

    // If we haven't shown it long enough, delay hiding
    if (remainingTime > 0) {
      console.log(`🤔 Delaying thinking hide for ${remainingTime}ms`);
      setTimeout(() => {
        const thinkingElement = document.querySelector(".thinking");
        if (thinkingElement) {
          thinkingElement.remove();
          console.log("🤔 Thinking indicator hidden (after delay)");
        }
      }, remainingTime);
    } else {
      thinking.remove();
      console.log("🤔 Thinking indicator hidden (immediately)");
    }

    this.thinkingStartTime = null;
  },

  getModelName: function (modelId) {
    const allModels = AI_MODELS.basic.concat(
      AI_MODELS.advanced,
      AI_MODELS.fast
    );
    const model = allModels.find(function (m) {
      return m.id === modelId;
    });
    return model ? model.name : "Unknown";
  },
};

// Authentication Manager - SIMPLIFIED
var authManager = {
  initialize: function () {
    try {
      console.log("Initializing auth state...");

      if (Environment.isWeb) {
        return this.initializeWebAuth();
      }

      if (window.electronAPI?.getAuthState) {
        return window.electronAPI.getAuthState().then(function (authState) {
          console.log("Auth state loaded:", authState);
          appState.updateAuth(authState);
          return true;
        });
      }

      console.error("electronAPI.getAuthState not available");
      return Promise.resolve(false);
    } catch (error) {
      console.error("Failed to get auth state:", error);
      return this.initializeWebAuth();
    }
  },

  initializeWebAuth: function () {
    console.log("🌐 Web environment: Loading auth from localStorage");
    const token = localStorage.getItem(CONFIG.STORAGE_KEYS.TOKEN);
    const userData = localStorage.getItem(CONFIG.STORAGE_KEYS.USER);

    if (token && userData) {
      appState.updateAuth({
        isAuthenticated: true,
        token: token,
        user: JSON.parse(userData),
      });
      console.log(
        "✅ Auth loaded from localStorage:",
        appState.currentUser.email
      );
      return true;
    } else {
      console.log("❌ No auth data in localStorage");
      appState.updateAuth({
        isAuthenticated: false,
        token: null,
        user: null,
      });
      return false;
    }
  },

  checkAuthFromStorage: function () {
    const token = localStorage.getItem(CONFIG.STORAGE_KEYS.TOKEN);
    const userData = localStorage.getItem(CONFIG.STORAGE_KEYS.USER);

    if (token && userData) {
      try {
        const user = JSON.parse(userData);
        appState.updateAuth({
          isAuthenticated: true,
          token: token,
          user: user,
        });
        return true;
      } catch (error) {
        console.error("Failed to parse user data:", error);
        localStorage.removeItem(CONFIG.STORAGE_KEYS.TOKEN);
        localStorage.removeItem(CONFIG.STORAGE_KEYS.USER);
      }
    }

    appState.resetAuth();
    return false;
  },

  resetAuthentication: function (reason = "Authentication failed") {
    console.log("🔐 Resetting authentication:", reason);
    appState.resetAuth();
    updateAuthDropdown();
    messageManager.createMessage(
      "Your session has expired. Please sign in to continue using the AI assistant.",
      "ai",
      "Auth Required"
    );
  },

  setupEventListeners: function () {
    if (!window.electronAPI) return;

    if (window.electronAPI.onAuthStateUpdated) {
      window.electronAPI.onAuthStateUpdated(function (newAuthState) {
        console.log("🔐 Auth state updated via electronAPI:", newAuthState);
        appState.updateAuth(newAuthState);

        if (
          newAuthState.isAuthenticated &&
          newAuthState.token &&
          newAuthState.user
        ) {
          localStorage.setItem(CONFIG.STORAGE_KEYS.TOKEN, newAuthState.token);
          localStorage.setItem(
            CONFIG.STORAGE_KEYS.USER,
            JSON.stringify(newAuthState.user)
          );
        } else {
          localStorage.removeItem(CONFIG.STORAGE_KEYS.TOKEN);
          localStorage.removeItem(CONFIG.STORAGE_KEYS.USER);
        }

        updateAuthDropdown();
      });
    }

    if (window.electronAPI.onAuthSuccess) {
      window.electronAPI.onAuthSuccess(function (userData) {
        console.log("🔐 Auth success received:", userData);
        appState.updateAuth({
          isAuthenticated: true,
          token: userData.token,
          user: userData.user,
        });

        localStorage.setItem(CONFIG.STORAGE_KEYS.TOKEN, userData.token);
        localStorage.setItem(
          CONFIG.STORAGE_KEYS.USER,
          JSON.stringify(userData.user)
        );

        updateAuthDropdown();
      });
    }
  },
};

// Enhanced Chat Manager with Context+
var chatManager = {
  sendMessage: function (
    messageText,
    attachments = [],
    skipUserMessage = false
  ) {
    console.log("🔄 === CHAT MANAGER SEND MESSAGE ===");
    console.log("🔄 Message text:", messageText);
    console.log("🔄 Attachments:", attachments);
    console.log("🔄 Skip user message:", skipUserMessage);
    console.log("🔄 Context+ Enabled:", appState.contextPlusEnabled);
    console.log("🔄 Current topic ID before:", appState.currentTopicId);
    console.log("🔄 Chat history length before:", appState.chatHistory.length);

    if (!authManager.checkAuthFromStorage()) {
      console.log("❌ Not authenticated, redirecting to sign in");
      handleSignIn();
      return;
    }

    this.checkMessageLength(messageText);

    // Initialize topic if needed
    if (!appState.currentTopicId) {
      appState.currentTopicId = Date.now().toString();
      appState.currentSubtopicId = "main";
      appState.topics[appState.currentTopicId] = {
        title: "New Conversation",
        createdAt: new Date().toISOString(),
        subtopics: {},
      };
      appState.saveToStorage();
      console.log("🔄 Created initial topic:", appState.currentTopicId);
    }

    // Process attachments...
    let finalMessage = messageText;
    let processedAttachments = [];

    if (attachments && attachments.length > 0) {
      attachments.forEach((attachment, index) => {
        if (attachment.type === "large_content") {
          console.log("🔄 Processing large content attachment:", attachment);

          // Add text content to message
          finalMessage += `\n\n--- Attachment ${index + 1}: ${
            attachment.filename
          } ---\n`;
          finalMessage += attachment.content;
          finalMessage += `\n--- End of ${attachment.filename} ---\n`;

          processedAttachments.push({
            type: "large_content",
            filename: attachment.filename,
            contentType: attachment.contentType,
            size: attachment.size || attachment.content.length,
            word_count:
              attachment.word_count || attachment.content.split(/\s+/).length,
            extension:
              attachment.extension ||
              this.getFileExtension(attachment.filename),
            language: attachment.language || attachment.contentType,
            is_executable: attachment.is_executable || false,
            mime_type:
              attachment.mime_type ||
              this.getMimeType(
                attachment.extension ||
                  this.getFileExtension(attachment.filename)
              ),
            content_preview: attachment.content.substring(0, 200) + "...",
            full_content_length: attachment.content.length,
          });

          console.log(
            "🔄 Processed large content attachment:",
            processedAttachments[processedAttachments.length - 1]
          );
        } else if (attachment.type === "image") {
          finalMessage += `\n\n[Image attachment: ${attachment.filename}]`;

          processedAttachments.push({
            type: "image",
            filename: attachment.filename,
            size: attachment.size,
            data_preview: attachment.data.substring(0, 100) + "...",
          });
        } else if (attachment.type === "file") {
          finalMessage += `\n\n[File attachment: ${attachment.file.name}]`;

          processedAttachments.push({
            type: "file",
            filename: attachment.file.name,
            size: attachment.file.size,
            mime_type: attachment.file.type,
          });
        }
      });
    }

    console.log("🔄 Final message length:", finalMessage.length);
    console.log("🔄 Processed attachments:", processedAttachments);

    // Only create user message if not skipping
    if (!skipUserMessage) {
      console.log("🔄 Creating user message...");

      // Create a display message that shows attachments nicely
      let displayMessage = messageText;
      if (processedAttachments.length > 0) {
        displayMessage +=
          "\n\n" +
          processedAttachments
            .map((att) => {
              const icon = this.getAttachmentIcon(att.type);
              return `${icon} ${att.filename} (${this.formatFileSize(
                att.size
              )})`;
            })
            .join("\n");
      }

      messageManager.createMessage(displayMessage, "user");
    } else {
      console.log("🔄 Skipping user message creation (edit mode)");
    }

    // Context+ - Show loading if enabled
    if (appState.contextPlusEnabled) {
      this.showContextPlusLoading();
    }

    // Wait a tiny bit to ensure the message is fully added to history
    setTimeout(() => {
      console.log(
        "🔄 Chat history length after user message:",
        appState.chatHistory.length
      );
      console.log(
        "🔄 Current topic ID after user message:",
        appState.currentTopicId
      );

      // NOW get context (which should include the user message)
      console.log("🧠 Preparing context for AI");
      const contextMessages = appState.getContextForAI();

      // Add this debugging
      console.log("📤 === CONTEXT BEING SENT TO BACKEND ===");
      console.log("📤 Total context messages:", contextMessages.length);
      contextMessages.forEach((msg, idx) => {
        console.log(`📤 Message ${idx}: ${msg.role}`);
        console.log(`📤   Content length: ${msg.content.length} chars`);
        console.log(
          `📤   Has files: ${msg.content.includes(
            "[Files created in this response:]"
          )}`
        );
      });
      // CRITICAL: Create conversation ID on frontend if needed
      if (!appState.currentConversationId) {
        appState.currentConversationId =
          "conv_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
        console.log(
          "📝 Created new conversation ID:",
          appState.currentConversationId
        );
        appState.saveToStorage();
      }

      const messageData = {
        message: finalMessage,
        model: appState.selectedAIModel,
        conversation_id: appState.currentConversationId,
        topicId: appState.currentTopicId,
        subtopicId: appState.currentSubtopicId,
        context: JSON.stringify(contextMessages),
        contextMessages: contextMessages,
        attachments: processedAttachments,
        largeContentAttachments: attachments.filter(
          (a) => a.type === "large_content"
        ),
        // NEW: Context+ parameters
        context_plus_enabled: appState.contextPlusEnabled,
        retrieve_memories: appState.contextPlusEnabled,
        search_keywords: appState.contextPlusEnabled
          ? this.extractKeywords(messageText)
          : [],
      };
      console.log("📤 === FINAL MESSAGE DATA ===");
      console.log("📤 Message length:", messageData.message.length);
      console.log("📤 Model:", messageData.model);
      console.log("📤 Topic ID:", messageData.topicId);
      console.log(
        "📤 Context messages count:",
        messageData.contextMessages.length
      );
      console.log(
        "📤 Processed attachments count:",
        messageData.attachments.length
      );
      console.log(
        "📤 Large content attachments count:",
        messageData.largeContentAttachments.length
      );
      console.log("📤 Context+ enabled:", messageData.context_plus_enabled);
      console.log("📤 Search keywords:", messageData.search_keywords);

      if (Environment.isElectron) {
        console.log("🖥️ Using Electron API");
        window.electronAPI.sendChatMessage(messageData);
      } else {
        console.log("🌐 Using direct web API");
        this.sendChatMessageDirect(messageData);
      }
    }, 10); // Small delay to ensure message is in history
  },

  // Context+ Loading indicator
  showContextPlusLoading: function () {
    const toggle = document.getElementById("contextPlusToggle");
    if (toggle) {
      toggle.classList.add("loading");

      // Show memory indicator
      let indicator = document.querySelector(".context-memory-indicator");
      if (!indicator) {
        indicator = document.createElement("div");
        indicator.className = "context-memory-indicator";
        toggle.appendChild(indicator);
      }
      indicator.textContent = "Retrieving memories...";
      indicator.classList.add("show");
    }
  },

  hideContextPlusLoading: function () {
    const toggle = document.getElementById("contextPlusToggle");
    if (toggle) {
      toggle.classList.remove("loading");

      const indicator = document.querySelector(".context-memory-indicator");
      if (indicator) {
        indicator.classList.remove("show");
        setTimeout(() => {
          if (indicator.parentNode) {
            indicator.remove();
          }
        }, 300);
      }
    }
  },

  // Extract keywords for memory search
  extractKeywords: function (text) {
    const words = text.toLowerCase().split(/\W+/);
    const stopWords = [
      "the",
      "is",
      "at",
      "which",
      "on",
      "a",
      "an",
      "as",
      "are",
      "was",
      "were",
      "been",
      "be",
      "have",
      "has",
      "had",
      "do",
      "does",
      "did",
      "will",
      "would",
      "could",
      "should",
      "may",
      "might",
      "must",
      "can",
      "this",
      "that",
      "these",
      "those",
      "i",
      "you",
      "he",
      "she",
      "it",
      "we",
      "they",
      "them",
      "their",
      "what",
      "when",
      "where",
      "who",
      "why",
      "how",
    ];

    const keywords = words.filter(
      (word) =>
        word.length > 3 && !stopWords.includes(word) && !word.match(/^\d+$/)
    );

    // Get unique keywords
    return [...new Set(keywords)].slice(0, 10);
  },

  sendChatMessageDirect: function (data) {
    console.log("🌐 sendChatMessageDirect called with:", data);

    if (!authManager.checkAuthFromStorage()) {
      console.log("❌ Auth check failed in sendChatMessageDirect");
      messageManager.createMessage(
        "Please sign in to use the AI assistant.",
        "ai",
        "Auth Required"
      );
      return;
    }

    const token = localStorage.getItem(CONFIG.STORAGE_KEYS.TOKEN);
    if (!token) {
      console.log("❌ No token found");
      authManager.resetAuthentication("No authentication token found");
      return;
    } else {
    }

    console.log("🔑 Token found, making request...");
    messageManager.showThinking();

    // Process large content attachments for backend
    let processedLargeContent = [];
    if (
      data.largeContentAttachments &&
      data.largeContentAttachments.length > 0
    ) {
      processedLargeContent = data.largeContentAttachments.map(
        (attachment) => ({
          filename: attachment.filename,
          content: attachment.content,
          type: attachment.type || attachment.contentType,
          size: attachment.size || attachment.content.length,
          word_count:
            attachment.word_count || attachment.content.split(/\s+/).length,
          extension: attachment.extension,
          language: attachment.language,
          is_executable: attachment.is_executable || false,
          mime_type: attachment.mime_type,
        })
      );
      console.log(
        "🔄 Processed large content for backend:",
        processedLargeContent.length,
        "files"
      );
    }

    const requestBody = {
      message: data.message,
      model: data.model,
      context: data.context || "",
      contextMessages: data.contextMessages || [],
      topicId: data.topicId,
      subtopicId: data.subtopicId,
      // CRITICAL: Include conversation_id if we have one
      conversation_id: appState.currentConversationId || null,
      attachments: data.attachments || [],
      large_content_files: processedLargeContent,
      token: token,
      // NEW: Context+ parameters
      context_plus_enabled: data.context_plus_enabled || false,
      retrieve_memories: data.retrieve_memories || false,
      search_keywords: data.search_keywords || [],
    };

    console.log(
      "📡 Making jQuery AJAX request to:",
      `${CONFIG.BACKEND_URL}/api/index.php?endpoint=chat`
    );
    console.log("📡 Request body summary:", {
      messageLength: requestBody.message.length,
      model: requestBody.model,
      contextLength: requestBody.context.length,
      contextMessagesCount: requestBody.contextMessages.length,
      attachmentsCount: requestBody.attachments.length,
      largeContentFilesCount: requestBody.large_content_files.length,
      contextPlusEnabled: requestBody.context_plus_enabled,
      searchKeywords: requestBody.search_keywords,
    });

    $.ajax({
      url: `${CONFIG.BACKEND_URL}/api/index.php?endpoint=chat`,
      type: "POST",
      dataType: "json",
      contentType: "application/json",
      data: JSON.stringify(requestBody),
      timeout: 60000,
      beforeSend: function (xhr) {
        xhr.setRequestHeader("Accept", "application/json");
        xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      },
      success: function (response) {
        console.log("✅ jQuery AJAX response received:", response);
        if (response.conversation_id) {
          appState.currentConversationId = response.conversation_id;
          appState.saveToStorage();
          console.log("📝 Saved conversation ID:", response.conversation_id);
        }
        // In the success handler, after processing the response:
        if (response.new_topic === true) {
          console.log("🆕 New topic detected - clearing conversation ID");
          appState.currentConversationId = null;
        }
        if (response.debug_log) {
          console.log("🐛 Backend Debug Log:", response.debug_log);
        }

        if (response.auth_failure === true) {
          console.log("❌ Backend auth failure");
          messageManager.hideThinking();
          authManager.resetAuthentication("Backend authentication failure");
          return;
        }

        messageManager.hideThinking();

        // Hide Context+ loading if enabled
        if (appState.contextPlusEnabled) {
          chatManager.hideContextPlusLoading();
        }

        // Handle Context+ memories in response
        if (response.context_plus_info) {
          console.log("🧠 Context+ Info received:", response.context_plus_info);
          if (response.context_plus_info.memories_retrieved) {
            appState.contextPlusMemories = response.context_plus_info.memories;
            console.log(
              "🧠 Memories retrieved:",
              response.context_plus_info.memories.length
            );

            // Show memory count indicator
            const toggle = document.getElementById("contextPlusToggle");
            if (toggle) {
              let indicator = document.querySelector(
                ".context-memory-indicator"
              );
              if (!indicator) {
                indicator = document.createElement("div");
                indicator.className = "context-memory-indicator";
                toggle.appendChild(indicator);
              }
              indicator.textContent = `${response.context_plus_info.memories.length} memories used`;
              indicator.classList.add("show");

              setTimeout(() => {
                indicator.classList.remove("show");
              }, 3000);
            }
          }
        }

        if (
          response.success &&
          (response.response || (response.files && response.files.length > 0))
        ) {
          console.log("✅ Got AI response with success=true");

          if (
            response.has_files &&
            response.files &&
            Array.isArray(response.files) &&
            response.files.length > 0
          ) {
            console.log("🗂️ Using createAIResponseWithFiles method");
            console.log("🗂️ Files in response:", response.files.length);

            // Log each file's metadata for debugging
            response.files.forEach((file, index) => {
              console.log(`🗂️ File ${index + 1} metadata:`, {
                id: file.id,
                filename: file.filename,
                type: file.type,
                size: file.size,
                extension: file.extension,
                language: file.language,
                word_count: file.word_count,
                is_executable: file.is_executable,
                mime_type: file.mime_type,
                hasContent: !!file.content,
                contentLength: file.content ? file.content.length : 0,
              });
            });

            messageManager.createAIResponseWithFiles(response);
          } else {
            console.log(
              "📝 No files detected, using standard message creation"
            );
            messageManager.createMessage(
              response.response,
              "ai",
              "Chat Response",
              response.model_used || data.model
            );
          }

          // Handle usage stats with Context+ info
          if (response.usage_recorded) {
            console.log("📊 Usage recorded:", response.usage_recorded);
            if (response.context_plus_tokens) {
              console.log(
                "🧠 Context+ tokens used:",
                response.context_plus_tokens
              );
              console.log("💰 Context+ cost:", response.context_plus_cost);
            }
          }
        } else if (response.error) {
          console.error("❌ Backend returned error:", response.error);
          messageManager.createMessage(
            `Backend error: ${response.error}`,
            "ai",
            "Error"
          );
        } else {
          console.error("❌ Unexpected response format:", response);
          messageManager.createMessage(
            "Received unexpected response format from backend",
            "ai",
            "Error"
          );
        }
      },
      error: function (xhr, status, error) {
        console.error("🌐 jQuery AJAX error:", xhr, status, error);
        messageManager.hideThinking();

        // Hide Context+ loading if enabled
        if (appState.contextPlusEnabled) {
          chatManager.hideContextPlusLoading();
        }

        let errorMessage = "Sorry, I couldn't process your message right now.";

        if (xhr.status === 401) {
          console.log("❌ 401 Unauthorized response");
          authManager.resetAuthentication("Session expired (401)");
          return;
        } else if (xhr.status === 0) {
          errorMessage += `\n\nCannot connect to backend. Please ensure:\n1. Your web server is running\n2. api.php is accessible at: ${CONFIG.BACKEND_URL}/api/index.php?endpoint=chat\n3. CORS is properly configured`;
        } else if (xhr.status >= 500) {
          errorMessage += "\n\nServer error. Check PHP error logs for details.";
        } else if (status === "timeout") {
          errorMessage +=
            "\n\nRequest timed out. The server may be busy processing large content.";
        } else if (xhr.responseText) {
          try {
            const errorResponse = JSON.parse(xhr.responseText);
            if (errorResponse.error) {
              errorMessage += "\n\nBackend error: " + errorResponse.error;
            } else {
              errorMessage +=
                "\n\nBackend returned: " + xhr.responseText.substring(0, 200);
            }
          } catch (parseError) {
            errorMessage +=
              "\n\nBackend returned invalid response: " +
              xhr.responseText.substring(0, 200);
          }
        } else {
          errorMessage +=
            "\n\nError: " + (xhr.statusText || error || "Unknown error");
        }

        messageManager.createMessage(errorMessage, "ai", "Error");
      },
    });
  },

  checkMessageLength: function (text) {
    const wordCount = text.trim().split(/\s+/).length;
    const opusBadge = document.getElementById("opusBadge");

    if (wordCount > 200) {
      opusBadge?.classList.add("show");
    } else {
      opusBadge?.classList.remove("show");
    }
  },

  // Helper functions for metadata processing
  getFileExtension: function (filename) {
    if (!filename) return ".txt";
    const parts = filename.split(".");
    return parts.length > 1 ? "." + parts[parts.length - 1] : ".txt";
  },

  getMimeType: function (extension) {
    const mimeTypes = {
      ".html": "text/html",
      ".htm": "text/html",
      ".css": "text/css",
      ".js": "application/javascript",
      ".json": "application/json",
      ".py": "text/x-python",
      ".php": "text/x-php",
      ".md": "text/markdown",
      ".sql": "application/sql",
      ".xml": "application/xml",
      ".yaml": "text/yaml",
      ".yml": "text/yaml",
      ".sh": "application/x-sh",
      ".txt": "text/plain",
    };
    return mimeTypes[extension?.toLowerCase()] || "text/plain";
  },

  getAttachmentIcon: function (type) {
    const icons = {
      large_content: "📄",
      image: "🖼️",
      file: "📎",
    };
    return icons[type] || "📎";
  },

  formatFileSize: function (bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + " KB";
    return Math.round(bytes / (1024 * 1024)) + " MB";
  },
};

// Update the global sendMessage function to work with the new system
function sendMessage() {
  if (window.chatInputManager) {
    window.chatInputManager.sendMessage();
  } else {
    // Fallback to old method
    const input = document.getElementById("chatInput");
    if (input?.value.trim()) {
      chatManager.sendMessage(input.value.trim());
      input.value = "";
      autoResizeTextarea();
    }
  }
}

// UI Manager functions
function updateAuthDropdown() {
  const container = document.getElementById("aiDropdownContainer");
  if (!container) return;

  if (!appState.isAuthenticated) {
    container.innerHTML = `<button class="sign-in-button" id="signInButton">Sign In</button>`;

    const signInButton = document.getElementById("signInButton");
    if (signInButton) {
      signInButton.addEventListener("click", function () {
        handleSignIn();
      });
    }
  } else {
    const currentModel =
      AI_MODELS.basic
        .concat(AI_MODELS.advanced, AI_MODELS.fast)
        .find(function (m) {
          return m.id === appState.selectedAIModel;
        }) || AI_MODELS.advanced[1];

    container.innerHTML = generateDropdownHTML(currentModel);
  }
}

function generateDropdownHTML(currentModel) {
  return `
    <div class="ai-dropdown-button" id="dropdownButton">
      <span class="model-name">${currentModel.name}</span>
      <span class="chevron">▼</span>
    </div>
    <div class="ai-dropdown-menu" id="dropdownMenu">
      ${generateModelCategories()}
      <div class="dropdown-divider"></div>
      <button class="debug-button">Test Chat Flow</button>
      <button class="settings-button">Settings</button>
    </div>
  `;
}

function generateModelCategories() {
  const categories = [
    { name: "Basic Models", models: AI_MODELS.basic },
    { name: "Advanced Models", models: AI_MODELS.advanced },
    { name: "Fast Action Models", models: AI_MODELS.fast },
  ];

  return categories
    .map(function (category) {
      return `
        <div class="ai-category">
          <div class="ai-category-title">${category.name}</div>
          ${category.models
            .map(function (model) {
              return `
                <div class="ai-model-item ${
                  model.id === appState.selectedAIModel ? "selected" : ""
                }" 
                     data-model-id="${model.id}">
                  <span>${model.name}</span>
                  <span class="check">✓</span>
                </div>
            `;
            })
            .join("")}
        </div>
      `;
    })
    .join("");
}

function toggleDropdown() {
  const button = document.getElementById("dropdownButton");
  const menu = document.getElementById("dropdownMenu");

  if (button && menu) {
    button.classList.toggle("active");
    menu.classList.toggle("show");
  }
}

function selectAIModel(modelId) {
  appState.selectedAIModel = modelId;
  localStorage.setItem(CONFIG.STORAGE_KEYS.SELECTED_MODEL, modelId);
  updateAuthDropdown();

  const button = document.getElementById("dropdownButton");
  const menu = document.getElementById("dropdownMenu");
  if (button) button.classList.remove("active");
  if (menu) menu.classList.remove("show");

  messageManager.createMessage(
    `AI model changed to ${messageManager.getModelName(modelId)}`,
    "ai",
    "System",
    modelId
  );
}

function handleSignIn() {
  if (Environment.isWeb) {
    console.log("🌐 Web environment: Opening sign-in page");
    const currentUrl = window.location.href;
    const baseUrl = currentUrl.split("#")[0].split("?")[0];

    if (currentUrl.includes("memoria.html")) {
      if (typeof showLogin === "function") {
        showLogin();
      } else {
        window.location.hash = "signin";
        window.location.reload();
      }
    } else {
      window.location.href = baseUrl.replace(
        /\/[^\/]*$/,
        "/memoria.html#signin"
      );
    }
    return;
  }

  if (window.electronAPI?.openSignIn) {
    window.electronAPI.openSignIn();
  } else {
    console.error("Unable to open sign-in window");
  }
}

function openSettings() {
  if (Environment.isWeb) {
    const currentUrl = window.location.href;
    const baseUrl = currentUrl.split("#")[0].split("?")[0];
    window.location.href = baseUrl.replace(
      /\/[^\/]*$/,
      "/memoria.html#settings"
    );
  } else {
    if (window.electronAPI?.openSettings) {
      window.electronAPI.openSettings();
    }
  }
}

function testChatFlow() {
  console.log("🧪 Testing chat flow");
  console.log("🧪 Auth state:", {
    isAuthenticated: appState.isAuthenticated,
    currentUser: appState.currentUser,
  });

  if (!appState.isAuthenticated) {
    messageManager.createMessage(
      "❌ Test failed: Not authenticated",
      "ai",
      "Debug Test"
    );
    return;
  }

  messageManager.createMessage(
    "🧪 Starting test chat message...",
    "ai",
    "Debug Test"
  );

  const testMessage = {
    message: "Hello, this is a test message from the debug function.",
    model: appState.selectedAIModel,
    topicId: appState.currentTopicId,
    subtopicId: appState.currentSubtopicId,
  };

  console.log("🧪 Sending test message:", testMessage);

  if (Environment.isElectron) {
    window.electronAPI.sendChatMessage(testMessage);
    console.log("🧪 Test message sent via Electron IPC");
  } else {
    chatManager.sendChatMessageDirect(testMessage);
    console.log("🧪 Test message sent directly to backend");
  }

  messageManager.createMessage(
    "🧪 Test message sent. Check console for details.",
    "ai",
    "Debug Test"
  );
}

// History Manager - ENHANCED with delete functionality
var historyManager = {
  init: function () {
    this.setupEventDelegation();
  },

  setupEventDelegation: function () {
    console.log("🎯 Setting up event delegation for history panel");

    const historyPanel = document.getElementById("historyPanel");
    if (!historyPanel) {
      console.error("History panel not found");
      return;
    }

    historyPanel.addEventListener("click", function (event) {
      const target = event.target;

      // Handle delete subtopic clicks
      if (target.closest(".delete-subtopic-btn")) {
        event.preventDefault();
        event.stopPropagation();
        const btn = target.closest(".delete-subtopic-btn");
        const topicId = btn.dataset.topicId;
        const subtopicId = btn.dataset.subtopicId;
        console.log("🗑️ Delete subtopic clicked:", topicId, subtopicId);
        historyManager.deleteSubtopic(topicId, subtopicId);
        return;
      }

      // Handle clear all history
      if (target.closest("#clearHistoryBtn")) {
        event.preventDefault();
        event.stopPropagation();
        historyManager.clearAllHistory();
        return;
      }

      // Handle topic header clicks (expand/collapse topics)
      const topicHeader = target.closest(".topic-header");
      if (topicHeader && !target.closest(".subtopic-header")) {
        event.preventDefault();
        event.stopPropagation();
        const topicId = topicHeader.dataset.topicId;
        console.log("🎯 Topic header clicked:", topicId);
        historyManager.toggleTopic(topicId);
        return;
      }

      // Handle subtopic clicks (load subtopic conversation)
      const subtopicItem = target.closest(".subtopic-item");
      if (subtopicItem && !target.closest(".delete-subtopic-btn")) {
        event.preventDefault();
        event.stopPropagation();
        const topicId = subtopicItem.dataset.topicId;
        const subtopicId = subtopicItem.dataset.subtopicId;
        console.log("🎯 Subtopic clicked:", topicId, subtopicId);
        historyManager.loadConversation(topicId, subtopicId);
        return;
      }
    });
  },

  deleteSubtopic: function (topicId, subtopicId) {
    const subtopicTitle =
      appState.topics[topicId]?.subtopics?.[subtopicId] || "this conversation";

    if (
      confirm(
        `Are you sure you want to delete "${subtopicTitle}"? This cannot be undone.`
      )
    ) {
      console.log("🗑️ Deleting subtopic:", topicId, subtopicId);

      // Remove all messages for this subtopic
      appState.chatHistory = appState.chatHistory.filter((msg) => {
        return !(
          msg.topicId === topicId && (msg.subtopicId || "main") === subtopicId
        );
      });

      // Remove the subtopic from topics
      if (appState.topics[topicId] && appState.topics[topicId].subtopics) {
        delete appState.topics[topicId].subtopics[subtopicId];

        // If this was the last subtopic, remove the entire topic
        if (Object.keys(appState.topics[topicId].subtopics).length === 0) {
          delete appState.topics[topicId];
        }
      }

      // If we just deleted the current conversation, reset current IDs
      if (
        appState.currentTopicId === topicId &&
        appState.currentSubtopicId === subtopicId
      ) {
        appState.currentTopicId = null;
        appState.currentSubtopicId = null;
        appState.currentConversationId = null; // Add this

        // Clear the content area
        const content = document.getElementById("aiContent");
        if (content) {
          content.innerHTML =
            '<div class="empty-state">AI insights will appear here...</div>';
        }
      }

      // Save the updated state
      appState.saveToStorage();

      // Reload the history panel
      this.loadHistory();

      console.log("🗑️ Subtopic deleted successfully");
    }
  },

  clearAllHistory: function () {
    if (
      confirm(
        "Are you sure you want to clear all chat history? This cannot be undone."
      )
    ) {
      console.log("🗑️ Clearing all history");

      // Clear all chat messages
      appState.chatHistory = [];

      // Clear all topics
      appState.topics = {};

      // Clear edit history and hidden messages
      appState.editHistory = {};
      appState.hiddenMessages.clear();
      appState.messageResponses = {};

      // Reset current topic/subtopic
      appState.currentTopicId = null;
      appState.currentSubtopicId = null;
      appState.currentConversationId = null; // Add this
      // Save the cleared state
      appState.saveToStorage();

      // Clear the content area
      const content = document.getElementById("aiContent");
      if (content) {
        content.innerHTML =
          '<div class="empty-state">AI insights will appear here...</div>';
      }

      // Reload the history panel
      this.loadHistory();

      console.log("🗑️ All history cleared successfully");
    }
  },

  toggleTopic: function (topicId) {
    const topicElement = document.querySelector(
      `.topic-item[data-topic-id="${topicId}"]`
    );
    if (!topicElement) return;

    const isExpanded = topicElement.classList.contains("expanded");
    topicElement.classList.toggle("expanded");

    const subtopics = topicElement.querySelector(".subtopics");
    const indicator = topicElement.querySelector(".expand-indicator");

    if (subtopics) {
      subtopics.style.display = isExpanded ? "none" : "block";
    }

    if (indicator) {
      indicator.textContent = isExpanded ? "▶" : "▼";
    }
  },

  loadHistory: function () {
    console.log("📚 Loading history");
    const historyContent = document.getElementById("historyContent");
    if (!historyContent) return;

    if (Object.keys(appState.topics).length === 0) {
      historyContent.innerHTML =
        '<div class="empty-history">No conversations yet</div>';
      return;
    }

    let html = "";
    const sortedTopics = Object.entries(appState.topics).sort((a, b) => {
      return new Date(b[1].createdAt) - new Date(a[1].createdAt);
    });

    sortedTopics.forEach(([topicId, topic]) => {
      const isCurrentTopic = topicId === appState.currentTopicId;
      const subtopics = topic.subtopics || { main: "Main Conversation" };

      html += `
        <div class="topic-item ${
          isCurrentTopic ? "active" : ""
        }" data-topic-id="${topicId}">
          <div class="topic-header" data-topic-id="${topicId}">
            <span class="expand-indicator">▶</span>
            <span class="topic-title">${
              topic.title || "Untitled Conversation"
            }</span>
            <span class="topic-date">${new Date(
              topic.createdAt
            ).toLocaleDateString()}</span>
          </div>
          <div class="subtopics" style="display: none;">
      `;

      Object.entries(subtopics).forEach(([subtopicId, subtopicTitle]) => {
        const isCurrentSubtopic =
          isCurrentTopic && subtopicId === appState.currentSubtopicId;
        html += `
          <div class="subtopic-item ${isCurrentSubtopic ? "active" : ""}" 
               data-topic-id="${topicId}" 
               data-subtopic-id="${subtopicId}">
            <span class="subtopic-title">${subtopicTitle}</span>
            <button class="delete-subtopic-btn" 
                    data-topic-id="${topicId}" 
                    data-subtopic-id="${subtopicId}"
                    title="Delete this conversation">
              🗑️
            </button>
          </div>
        `;
      });

      html += `
          </div>
        </div>
      `;
    });

    historyContent.innerHTML = html;
  },

  loadConversation: function (topicId, subtopicId) {
    console.log("📖 Loading conversation:", topicId, subtopicId);

    // Update current topic/subtopic
    appState.currentTopicId = topicId;
    appState.currentSubtopicId = subtopicId;
    appState.saveToStorage();

    // Clear current content
    const content = document.getElementById("aiContent");
    if (!content) return;

    content.innerHTML = "";

    // Filter and load messages for this conversation
    const conversationMessages = appState.chatHistory.filter((msg) => {
      return (
        msg.topicId === topicId && (msg.subtopicId || "main") === subtopicId
      );
    });

    // Recreate messages in the UI
    conversationMessages.forEach((msg) => {
      // Check if message should be hidden
      if (appState.hiddenMessages.has(msg.id)) {
        return;
      }

      const message = document.createElement("div");
      message.id = msg.id;
      message.className =
        msg.type === "ai" ? "message ai-response" : "message user-message";
      message.dataset.messageId = msg.id;

      const time = new Date(msg.timestamp).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });

      const modelLabel =
        msg.model && msg.type === "ai"
          ? `<span class="model-label">${messageManager.getModelName(
              msg.model
            )}</span>`
          : "";

      // Check for edit history
      const editHistory = appState.getEditHistory(msg.id);
      const currentVersion = msg.currentVersion || 1;
      const versionNav =
        editHistory.length > 0
          ? messageManager.createVersionNav(
              msg.id,
              msg.displayVersion || currentVersion,
              editHistory.length + 1
            )
          : "";

      // Handle files if present
      let messageContent = messageManager.formatMessage(
        msg.text,
        msg.type === "ai"
      );

      if (msg.files && msg.files.length > 0) {
        console.log(`📖 Message ${msg.id} has ${msg.files.length} files`);
        messageContent += '<div class="message-files">';

        msg.files.forEach((fileData) => {
          const fileBlockHtml = contentManager.createFileBlock(
            fileData,
            msg.files
          );
          if (fileBlockHtml) {
            messageContent += fileBlockHtml;
          }
        });

        messageContent += "</div>";
      }

      message.innerHTML = `
        <div class="message-header">
          <span class="message-type">${
            msg.type === "ai" ? msg.messageType || "AI" : "You"
          }</span>
          <span class="message-time">${time}</span>
          ${modelLabel}
        </div>
        <div class="message-content">${messageContent}</div>
        <div class="message-footer">
          ${
            msg.type === "user"
              ? `
            <button class="message-edit-btn" onclick="messageManager.startEdit('${msg.id}')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
            </button>
          `
              : ""
          }
          ${versionNav}
        </div>
      `;

      content.appendChild(message);
    });

    // Update history panel to show active conversation
    this.updateHistoryActiveState(topicId, subtopicId);

    // Close history panel on mobile
    if (window.innerWidth < 768) {
      this.toggleHistoryPanel(false);
    }

    content.scrollTop = content.scrollHeight;
  },

  updateHistoryActiveState: function (topicId, subtopicId) {
    // Remove all active states
    document.querySelectorAll(".topic-item, .subtopic-item").forEach((el) => {
      el.classList.remove("active");
    });

    // Add active state to current topic and subtopic
    const topicElement = document.querySelector(
      `.topic-item[data-topic-id="${topicId}"]`
    );
    if (topicElement) {
      topicElement.classList.add("active");

      const subtopicElement = topicElement.querySelector(
        `.subtopic-item[data-topic-id="${topicId}"][data-subtopic-id="${subtopicId}"]`
      );
      if (subtopicElement) {
        subtopicElement.classList.add("active");
      }
    }
  },

  toggleHistoryPanel: function (show) {
    const panel = document.getElementById("historyPanel");
    const button = document.getElementById("historyButton");

    if (show === undefined) {
      panel?.classList.toggle("show");
      button?.classList.toggle("active");
    } else {
      panel?.classList.toggle("show", show);
      button?.classList.toggle("active", show);
    }
  },

  searchHistory: function (query) {
    if (!query) {
      this.loadHistory();
      return;
    }

    const lowerQuery = query.toLowerCase();
    const matchingMessages = appState.chatHistory.filter((msg) => {
      return msg.text.toLowerCase().includes(lowerQuery);
    });

    // Group by topic/subtopic
    const grouped = {};
    matchingMessages.forEach((msg) => {
      const key = `${msg.topicId}_${msg.subtopicId || "main"}`;
      if (!grouped[key]) {
        grouped[key] = {
          topicId: msg.topicId,
          subtopicId: msg.subtopicId || "main",
          topic: appState.topics[msg.topicId],
          messages: [],
        };
      }
      grouped[key].messages.push(msg);
    });

    // Render search results
    const historyContent = document.getElementById("historyContent");
    if (!historyContent) return;

    if (Object.keys(grouped).length === 0) {
      historyContent.innerHTML =
        '<div class="empty-history">No matching conversations found</div>';
      return;
    }

    let html = '<div class="search-results">';
    Object.values(grouped).forEach((group) => {
      const topic = group.topic;
      const subtopicTitle =
        topic?.subtopics?.[group.subtopicId] || "Main Conversation";

      html += `
        <div class="search-result-group">
          <div class="search-result-header" 
               data-topic-id="${group.topicId}" 
               data-subtopic-id="${group.subtopicId}">
            <strong>${topic?.title || "Untitled"}</strong> › ${subtopicTitle}
            <span class="match-count">${group.messages.length} matches</span>
          </div>
          <div class="search-result-messages">
      `;

      group.messages.slice(0, 3).forEach((msg) => {
        const excerpt = this.highlightSearchTerm(msg.text, query);
        html += `
          <div class="search-result-message ${msg.type}-message">
            <span class="message-type-indicator">${
              msg.type === "ai" ? "AI" : "You"
            }</span>
            <span class="message-excerpt">${excerpt}</span>
          </div>
        `;
      });

      if (group.messages.length > 3) {
        html += `<div class="more-results">...and ${
          group.messages.length - 3
        } more</div>`;
      }

      html += `
          </div>
        </div>
      `;
    });
    html += "</div>";

    historyContent.innerHTML = html;
  },

  highlightSearchTerm: function (text, searchTerm) {
    const regex = new RegExp(`(${searchTerm})`, "gi");
    let excerpt = text;

    // Find the position of the search term
    const matchIndex = text.toLowerCase().indexOf(searchTerm.toLowerCase());
    if (matchIndex > 50) {
      excerpt = "..." + text.substring(matchIndex - 50);
    }

    if (excerpt.length > 150) {
      excerpt = excerpt.substring(0, 150) + "...";
    }

    return excerpt.replace(regex, "<mark>$1</mark>");
  },
};
// Add this function to handle starting a new chat
function startNewChat() {
  console.log("🆕 Starting new chat");

  // Reset current conversation tracking
  appState.currentTopicId = null;
  appState.currentSubtopicId = null;
  appState.currentConversationId = null;

  // Clear hidden messages and edit history for clean slate
  appState.hiddenMessages.clear();
  appState.messageResponses = {};

  // Save the state
  appState.saveToStorage();

  // Clear the AI content area
  const content = document.getElementById("aiContent");
  if (content) {
    content.innerHTML =
      '<div class="empty-state">AI insights will appear here...</div>';
  }

  // Clear the chat input
  const chatInput = document.getElementById("chatInput");
  if (chatInput) {
    chatInput.value = "";
    autoResizeTextarea();
  }

  // Optionally, you can create a system message
  messageManager.createMessage(
    "New conversation started. How can I help you today?",
    "ai",
    "System"
  );

  // Update the history panel to reflect no active conversation
  const allActiveElements = document.querySelectorAll(
    ".topic-item.active, .subtopic-item.active"
  );
  allActiveElements.forEach((el) => el.classList.remove("active"));

  console.log("🆕 New chat initialized");
}

// Also make it globally available
window.startNewChat = startNewChat;
// Initialize event listeners
function setupEventListeners() {
  // Chat input and send button
  const chatInput = document.getElementById("chatInput");
  const sendButton = document.getElementById("sendButton");

  // ENHANCED: Better auto-resize for input box only
  if (chatInput) {
    // Enhanced input event for dynamic height
    chatInput.addEventListener("input", function (e) {
      const textarea = e.target;

      // Reset height to calculate proper scrollHeight
      textarea.style.height = "auto";

      // Calculate new height (min 40px, max 300px)
      const scrollHeight = textarea.scrollHeight;
      const newHeight = Math.max(40, Math.min(scrollHeight + 8, 300));

      // Apply the new height
      textarea.style.height = newHeight + "px";

      // Handle overflow if content exceeds max height
      if (scrollHeight > 300) {
        textarea.style.overflowY = "auto";
        textarea.scrollTop = textarea.scrollHeight;
      } else {
        textarea.style.overflowY = "hidden";
      }

      // Update word count for Opus badge
      const wordCount = textarea.value
        .trim()
        .split(/\s+/)
        .filter((word) => word.length > 0).length;
      const opusBadge = document.getElementById("opusBadge");
      if (wordCount > 200) {
        opusBadge?.classList.add("show");
      } else {
        opusBadge?.classList.remove("show");
      }
    });

    // Enhanced keydown handler
    chatInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();

        // Reset textarea height after sending
        setTimeout(() => {
          this.style.height = "40px";
          this.style.overflowY = "hidden";
          this.value = "";
        }, 10);
      } else if (e.key === "Enter" && e.shiftKey) {
        // Allow Shift+Enter for new lines, then resize
        setTimeout(() => {
          this.style.height = "auto";
          const newHeight = Math.max(40, Math.min(this.scrollHeight + 8, 300));
          this.style.height = newHeight + "px";
        }, 10);
      }
    });

    // Handle paste events
    chatInput.addEventListener("paste", function (e) {
      setTimeout(() => {
        this.style.height = "auto";
        const newHeight = Math.max(40, Math.min(this.scrollHeight + 8, 300));
        this.style.height = newHeight + "px";

        if (this.scrollHeight > 300) {
          this.style.overflowY = "auto";
          this.scrollTop = this.scrollHeight;
        } else {
          this.style.overflowY = "hidden";
        }
      }, 10);
    });

    // Set initial height and properties
    chatInput.style.height = "40px";
    chatInput.style.resize = "none";
    chatInput.style.overflowY = "hidden";
  }

  sendButton?.addEventListener("click", function () {
    sendMessage();

    // Reset textarea after sending
    if (chatInput) {
      chatInput.style.height = "40px";
      chatInput.style.overflowY = "hidden";
      chatInput.value = "";
    }
  });

  // New Chat button
  const newChatButton = document.getElementById("newChatButton");
  newChatButton?.addEventListener("click", function () {
    startNewChat();
  });

  // History panel
  const historyButton = document.getElementById("historyButton");
  const closeHistoryButton = document.getElementById("closeHistoryButton");
  const historySearch = document.getElementById("historySearch");

  historyButton?.addEventListener("click", function () {
    historyManager.toggleHistoryPanel();
    historyManager.loadHistory();
  });

  closeHistoryButton?.addEventListener("click", function () {
    historyManager.toggleHistoryPanel(false);
  });

  historySearch?.addEventListener("input", function (e) {
    const query = e.target.value.trim();
    historyManager.searchHistory(query);
  });

  // Dropdown menu
  document.addEventListener("click", function (e) {
    const dropdownButton = e.target.closest("#dropdownButton");
    const dropdownMenu = document.getElementById("dropdownMenu");

    if (dropdownButton) {
      toggleDropdown();
    } else if (dropdownMenu && !e.target.closest("#dropdownMenu")) {
      dropdownButton?.classList.remove("active");
      dropdownMenu?.classList.remove("show");
    }

    // Model selection
    const modelItem = e.target.closest(".ai-model-item");
    if (modelItem) {
      const modelId = modelItem.dataset.modelId;
      selectAIModel(modelId);
    }

    // Debug and settings buttons
    if (e.target.closest(".debug-button")) {
      testChatFlow();
    }

    if (e.target.closest(".settings-button")) {
      openSettings();
    }

    // Search result clicks
    const searchResult = e.target.closest(".search-result-header");
    if (searchResult) {
      const topicId = searchResult.dataset.topicId;
      const subtopicId = searchResult.dataset.subtopicId;
      historyManager.loadConversation(topicId, subtopicId);
    }
  });

  // Window resize handler
  window.addEventListener("resize", handleResize);

  // Global keyboard shortcuts
  document.addEventListener("keydown", function (e) {
    // Cmd/Ctrl + K for new chat
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault();
      startNewChat();
    }
  });

  // ElectronAPI event listeners
  if (window.electronAPI) {
    window.electronAPI.onNewAIResponse(function (data) {
      console.log("📨 Received AI response:", data);

      // CRITICAL: Check for thinking indicator FIRST
      if (data && data.thinking === true) {
        console.log("🤔 Received thinking indicator - showing thinking UI");
        messageManager.showThinking();
        return; // Don't process anything else
      }

      // If we get here, it's a real response, so hide thinking
      messageManager.hideThinking();

      if (appState.contextPlusEnabled) {
        chatManager.hideContextPlusLoading();
      }

      // Handle actual responses
      if (data.error) {
        messageManager.createMessage(data.error, "ai", "Error");
      } else if (data.has_files && data.files) {
        messageManager.createAIResponseWithFiles(data);
      } else if (data.response || data.text) {
        // Added data.text as fallback
        const responseText = data.response || data.text;
        messageManager.createMessage(
          responseText,
          "ai",
          "Chat Response",
          data.model_used
        );
      } else {
        console.error("📨 Unexpected response format:", data);
        messageManager.createMessage(
          "Received unexpected response format",
          "ai",
          "Error"
        );
      }
    });

    window.electronAPI.onAIThinking(function () {
      console.log("🤔 onAIThinking listener triggered!");
      messageManager.showThinking();
    });

    window.electronAPI.onTranscriptQuestion(function (question) {
      const chatInput = document.getElementById("chatInput");
      if (chatInput) {
        chatInput.value = question;
        // Trigger the enhanced auto-resize after setting the value
        chatInput.style.height = "auto";
        const newHeight = Math.max(
          40,
          Math.min(chatInput.scrollHeight + 8, 300)
        );
        chatInput.style.height = newHeight + "px";
        chatInput.focus();
      }
    });
  }

  // Context+ Toggle
  const contextPlusToggle = document.getElementById("contextPlusToggle");
  if (contextPlusToggle) {
    contextPlusToggle.addEventListener("click", function () {
      appState.contextPlusEnabled = !appState.contextPlusEnabled;
      appState.saveToStorage();

      // Update UI
      this.classList.toggle("active", appState.contextPlusEnabled);

      // Show feedback
      const status = this.querySelector(".context-plus-status");
      status.textContent = appState.contextPlusEnabled ? "ON" : "OFF";
      status.classList.add("show");

      setTimeout(() => {
        status.classList.remove("show");
      }, 2000);

      // Log state change
      console.log("🧠 Context+ toggled:", appState.contextPlusEnabled);

      // Create system message
      const statusMessage = appState.contextPlusEnabled
        ? "Context+ enabled - I will now use enhanced memory and context for better responses"
        : "Context+ disabled - Using standard context mode";

      messageManager.createMessage(statusMessage, "ai", "System");
    });

    // Set initial state
    contextPlusToggle.classList.toggle("active", appState.contextPlusEnabled);
  }
}

// Helper functions
function addToChat(text) {
  const chatInput = document.getElementById("chatInput");
  if (chatInput) {
    chatInput.value = text;
    autoResizeTextarea();
    chatInput.focus();
  }
}

// Replace your existing autoResizeTextarea function with this enhanced version:

function autoResizeTextarea() {
  const chatInput = document.getElementById("chatInput");
  if (!chatInput) return;

  // Reset height to calculate proper scrollHeight
  chatInput.style.height = "auto";

  // Calculate new height (min 40px, max 300px)
  const scrollHeight = chatInput.scrollHeight;
  const newHeight = Math.max(40, Math.min(scrollHeight + 8, 300));

  // Apply the new height
  chatInput.style.height = newHeight + "px";

  // Handle overflow if content exceeds max height
  if (scrollHeight > 300) {
    chatInput.style.overflowY = "auto";
    chatInput.scrollTop = chatInput.scrollHeight;
  } else {
    chatInput.style.overflowY = "hidden";
  }
}

function handleResize() {
  const content = document.getElementById("aiContent");
  if (content) {
    content.scrollTop = content.scrollHeight;
  }
}

// Make sendChatMessageDirect available globally for web compatibility
window.sendChatMessageDirect = function (data) {
  chatManager.sendChatMessageDirect(data);
};

// RESTORED: Enhanced chat input manager with syntax highlighting
var chatInputManager = {
  maxDisplayLength: 500,
  maxDirectInput: 200,
  largeContentStore: new Map(), // Initialize the store

  init: function () {
    this.setupEventListeners();
    this.setupPasteHandler();
    this.loadHighlightJS(); // Load highlight.js first
    this.setupEnhancedSyntaxHighlighting();
    this.autoResizeTextarea();
  },

  // Add method to load highlight.js
  loadHighlightJS: function () {
    if (typeof hljs === "undefined") {
      // Load highlight.js from CDN
      const script = document.createElement("script");
      script.src =
        "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js";
      script.onload = () => {
        console.log("✅ Highlight.js loaded");
      };
      document.head.appendChild(script);

      // Load highlight.js CSS
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href =
        "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/vs2015.min.css";
      document.head.appendChild(link);
    }
  },

  autoResizeTextarea: function () {
    const textarea = document.getElementById("chatInput");
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height =
        Math.min(textarea.scrollHeight, CONFIG.AUTO_RESIZE_MAX_HEIGHT) + "px";
    }
  },

  setupEnhancedSyntaxHighlighting: function () {
    const style = document.createElement("style");
    style.textContent = `
      /* Base code view styles */
      .code-view-enhanced {
        background-color: #1e1e1e !important;
        color: #d4d4d4 !important;
        font-family: 'Consolas', 'Monaco', 'Courier New', monospace !important;
        font-size: 14px !important;
        line-height: 1.5 !important;
        padding: 20px 0 !important;
        overflow: auto !important;
        height: 100% !important;
      }
      
      /* Override highlight.js theme for consistency */
      .code-view-enhanced .hljs {
        background: transparent !important;
        color: #d4d4d4 !important;
      }
      
      /* VS Code Dark+ token colors */
      .hljs-keyword,
      .hljs-selector-tag,
      .hljs-literal,
      .hljs-section,
      .hljs-link { color: #569cd6 !important; }
      
      .hljs-string,
      .hljs-meta-string { color: #ce9178 !important; }
      
      .hljs-comment,
      .hljs-quote { color: #6a9955 !important; font-style: italic !important; }
      
      .hljs-number,
      .hljs-regexp,
      .hljs-literal { color: #b5cea8 !important; }
      
      .hljs-function .hljs-title,
      .hljs-title.function_ { color: #dcdcaa !important; }
      
      .hljs-class .hljs-title,
      .hljs-title.class_ { color: #4ec9b0 !important; }
      
      .hljs-attr,
      .hljs-attribute,
      .hljs-property { color: #9cdcfe !important; }
      
      .hljs-built_in,
      .hljs-type { color: #4ec9b0 !important; }
      
      .hljs-selector-class { color: #d7ba7d !important; }
      .hljs-selector-id { color: #d7ba7d !important; }
      
      .hljs-variable,
      .hljs-params { color: #9cdcfe !important; }
      
      .hljs-meta { color: #c586c0 !important; }
      
      /* Line number styles */
      .code-line {
        position: relative !important;
        padding-left: 60px !important;
        min-height: 21px !important;
        white-space: pre !important;
        display: block !important;
      }
      
      .code-line::before {
        content: attr(data-line) !important;
        position: absolute !important;
        left: 0 !important;
        width: 50px !important;
        text-align: right !important;
        color: #858585 !important;
        padding-right: 16px !important;
        user-select: none !important;
        font-size: 12px !important;
      }
      
      /* Folding styles */
      .fold-marker {
        display: inline-block !important;
        width: 11px !important;
        height: 11px !important;
        margin-right: 4px !important;
        cursor: pointer !important;
        user-select: none !important;
        color: #c5c5c5 !important;
        font-size: 11px !important;
        line-height: 11px !important;
        text-align: center !important;
        transition: transform 0.15s ease !important;
        position: relative !important;
        top: -1px !important;
      }
      
      .fold-marker:hover {
        color: #e0e0e0 !important;
        background: rgba(90, 90, 90, 0.3) !important;
        border-radius: 2px !important;
      }
      
      .fold-marker.collapsed {
        transform: rotate(-90deg) !important;
      }
      
      .fold-content {
        overflow: hidden !important;
        transition: none !important;
      }
      
      .fold-content.collapsed {
        display: none !important;
      }
      
      .fold-placeholder {
        display: none !important;
        color: #858585 !important;
        background: rgba(255, 255, 255, 0.04) !important;
        padding: 0 4px !important;
        margin-left: 4px !important;
        border-radius: 3px !important;
        font-size: 11px !important;
        cursor: pointer !important;
      }
      
      .foldable-block.collapsed .fold-placeholder {
        display: inline-block !important;
      }
    `;
    document.head.appendChild(style);
  },

  viewFullContent: function (previewId) {
    const contentData = this.largeContentStore?.get(previewId);
    if (!contentData) {
      console.error("No content data found for preview:", previewId);
      return;
    }

    const overlay = document.createElement("div");
    overlay.className = "fullscreen-preview";

    overlay.innerHTML = `
      <div class="preview-header">
        <span class="preview-title">${this.escapeHtml(
          contentData.filename || "Code View"
        )}</span>
        <div class="preview-controls">
          <button class="preview-btn" id="copyCodeBtn">
            <span class="btn-icon">📋</span> Copy
          </button>
          <button class="preview-btn close-preview" id="closeCodeViewBtn">✕ Close</button>
        </div>
      </div>
      <div class="preview-content-container">
        <div class="code-view-enhanced" id="codeViewContent">
          <div class="loading-code">Preparing code view...</div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Process code after DOM is ready
    setTimeout(() => {
      const codeContainer = document.getElementById("codeViewContent");
      if (codeContainer) {
        const language =
          contentData.language ||
          this.detectLanguage(contentData.extension) ||
          "plaintext";
        codeContainer.innerHTML = this.createHighlightedCode(
          contentData.content,
          language
        );
        this.setupCodeViewEventHandlers(overlay, contentData);
      }
    }, 50);
  },

  detectLanguage: function (extension) {
    const extMap = {
      ".js": "javascript",
      ".javascript": "javascript",
      ".jsx": "javascript",
      ".ts": "typescript",
      ".tsx": "typescript",
      ".py": "python",
      ".java": "java",
      ".cpp": "cpp",
      ".c": "c",
      ".cs": "csharp",
      ".php": "php",
      ".rb": "ruby",
      ".go": "go",
      ".rs": "rust",
      ".swift": "swift",
      ".kt": "kotlin",
      ".scala": "scala",
      ".r": "r",
      ".m": "matlab",
      ".sql": "sql",
      ".sh": "bash",
      ".bash": "bash",
      ".ps1": "powershell",
      ".html": "html",
      ".htm": "html",
      ".xml": "xml",
      ".css": "css",
      ".scss": "scss",
      ".sass": "sass",
      ".less": "less",
      ".json": "json",
      ".yaml": "yaml",
      ".yml": "yaml",
      ".toml": "toml",
      ".ini": "ini",
      ".md": "markdown",
      ".tex": "latex",
      ".dockerfile": "dockerfile",
      ".docker": "dockerfile",
      ".makefile": "makefile",
      ".cmake": "cmake",
    };

    return extMap[extension?.toLowerCase()] || null;
  },

  createHighlightedCode: function (code, language) {
    const lines = code.split("\n");
    const foldableRegions = this.detectFoldableRegions(lines, language);

    // First, highlight the entire code if highlight.js is available
    let highlightedCode = code;
    if (typeof hljs !== "undefined") {
      try {
        if (hljs.getLanguage(language)) {
          highlightedCode = hljs.highlight(code, { language }).value;
        } else {
          highlightedCode = hljs.highlightAuto(code).value;
        }
      } catch (e) {
        console.warn("Highlight.js error:", e);
        highlightedCode = this.escapeHtml(code);
      }
    } else {
      highlightedCode = this.escapeHtml(code);
    }

    // Split highlighted code back into lines while preserving HTML
    const highlightedLines = this.splitHighlightedCode(highlightedCode);

    let html = "";
    let i = 0;

    while (i < lines.length) {
      const lineNumber = i + 1;
      const foldRegion = foldableRegions.find((r) => r.start === i);

      if (foldRegion) {
        const blockId = `fold_${Date.now()}_${i}`;
        const blockLines = highlightedLines.slice(
          foldRegion.start,
          foldRegion.end + 1
        );

        html += `<div class="foldable-block" data-fold-id="${blockId}">`;
        html += `<div class="code-line" data-line="${lineNumber}">`;
        html += `<span class="fold-marker" data-fold-id="${blockId}">▼</span>`;
        html += blockLines[0];
        html += `<span class="fold-placeholder" data-fold-id="${blockId}">${foldRegion.preview}</span>`;
        html += `</div>`;

        if (blockLines.length > 1) {
          html += `<div class="fold-content" data-fold-id="${blockId}">`;
          for (let j = 1; j < blockLines.length; j++) {
            html += `<div class="code-line" data-line="${i + j + 1}">${
              blockLines[j]
            }</div>`;
          }
          html += `</div>`;
        }
        html += `</div>`;

        i = foldRegion.end + 1;
      } else {
        html += `<div class="code-line" data-line="${lineNumber}">${
          highlightedLines[i] || ""
        }</div>`;
        i++;
      }
    }

    return html;
  },

  splitHighlightedCode: function (highlightedCode) {
    // This is a bit tricky - we need to split by newlines but preserve HTML tags
    const lines = [];
    let currentLine = "";
    let inTag = false;

    for (let i = 0; i < highlightedCode.length; i++) {
      const char = highlightedCode[i];

      if (char === "<") inTag = true;
      if (char === ">") inTag = false;

      if (char === "\n" && !inTag) {
        lines.push(currentLine);
        currentLine = "";
      } else {
        currentLine += char;
      }
    }

    if (currentLine) lines.push(currentLine);

    return lines;
  },

  detectFoldableRegions: function (lines, language) {
    const regions = [];

    // Helper function to check if a line should start a foldable region
    const shouldStartRegion = (line, trimmed, language) => {
      // CSS/SCSS/LESS
      if (language === "css" || language === "scss" || language === "less") {
        // CSS selectors, at-rules, and nested rules
        return (
          trimmed.match(/^[.#]?[\w-:]+.*{/) ||
          trimmed.match(
            /@(media|keyframes|supports|font-face|import|charset|namespace|document|page|viewport|counter-style|font-feature-values|swash|ornaments|annotation|stylistic|styleset|character-variant).*{/
          ) ||
          trimmed.match(/^&.*{/) || // SCSS/LESS nested selectors
          trimmed.match(/^\$[\w-]+:.*{/) || // SCSS maps
          trimmed.match(/^\.[\w-]+\(.*\).*{/)
        ); // SCSS/LESS mixins
      }

      // HTML/XML
      if (language === "html" || language === "xml") {
        const openTag = trimmed.match(/^<([\w-]+)(?:\s|>)/);
        return (
          openTag &&
          !trimmed.match(/\/>/) &&
          ![
            "br",
            "hr",
            "img",
            "input",
            "meta",
            "link",
            "area",
            "base",
            "col",
            "embed",
            "source",
            "track",
            "wbr",
          ].includes(openTag[1])
        );
      }

      // JavaScript/TypeScript
      if (
        language === "javascript" ||
        language === "typescript" ||
        language === "jsx" ||
        language === "tsx"
      ) {
        return (
          // Function declarations
          trimmed.match(/^(async\s+)?function\s+\w+.*{/) ||
          trimmed.match(/^(export\s+)?(default\s+)?(async\s+)?function.*{/) ||
          // Arrow functions assigned to variables
          trimmed.match(
            /^(const|let|var)\s+\w+\s*=\s*(async\s*)?\(.*\)\s*=>\s*{/
          ) ||
          trimmed.match(
            /^(const|let|var)\s+\w+\s*=\s*(async\s*)?\w+\s*=>\s*{/
          ) ||
          // Object methods
          trimmed.match(/^\w+\s*:\s*(async\s+)?function.*{/) ||
          trimmed.match(/^\w+\s*:\s*(async\s*)?\(.*\)\s*=>\s*{/) ||
          trimmed.match(/^(async\s+)?\w+\s*\(.*\)\s*{/) || // Method shorthand
          // Classes
          trimmed.match(/^(export\s+)?(default\s+)?class\s+.*{/) ||
          // Control structures
          trimmed.match(
            /^(if|else if|else|for|while|do|switch|try|catch|finally)\s*.*{/
          ) ||
          trimmed.match(
            /^(if|else if|for|while|switch|try|catch)\s*\(.*\)\s*{/
          ) ||
          // Object literals
          trimmed.match(/^(const|let|var)\s+\w+\s*=\s*{/) ||
          trimmed.match(/^return\s*{/) ||
          // Immediately invoked functions
          trimmed.match(/^\(function.*{/) ||
          trimmed.match(/^\(\s*\(.*\)\s*=>\s*{/)
        );
      }

      // Python
      if (language === "python") {
        return (
          trimmed.match(
            /^(def|class|if|elif|else|for|while|with|try|except|finally)\s*.*:/
          ) ||
          trimmed.match(/^@\w+/) || // Decorators
          trimmed.match(/^async\s+def\s+.*:/)
        );
      }

      // Java/C#/C++
      if (
        language === "java" ||
        language === "csharp" ||
        language === "cpp" ||
        language === "c"
      ) {
        return (
          trimmed.match(
            /^(public|private|protected|static|final|abstract|virtual|override)*\s*(class|interface|struct|enum)\s+.*{/
          ) ||
          trimmed.match(
            /^(public|private|protected|static|final|abstract|virtual|override)*\s*\w+\s+\w+\s*\(.*\)\s*{/
          ) || // Methods
          trimmed.match(
            /^(if|else if|else|for|while|do|switch|try|catch|finally)\s*.*{/
          ) ||
          trimmed.match(/^namespace\s+.*{/)
        );
      }

      // Generic patterns for unknown languages
      if (!language || language === "plaintext") {
        return trimmed.endsWith("{") || trimmed.endsWith(":");
      }

      return false;
    };

    // Process all lines to find foldable regions
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      if (!trimmed) continue;

      if (shouldStartRegion(line, trimmed, language)) {
        // Find the end of this region
        let endIndex = this.findRegionEnd(lines, i, language);

        if (endIndex > i + 1) {
          // Only create region if it spans more than 1 line
          const preview = this.getRegionPreview(lines, i, endIndex, language);
          regions.push({
            start: i,
            end: endIndex,
            preview: preview,
          });
        }
      }
    }

    // Sort regions by start index and remove overlapping ones (keep the innermost)
    regions.sort((a, b) => a.start - b.start);

    const finalRegions = [];
    for (let i = 0; i < regions.length; i++) {
      const region = regions[i];
      let isValid = true;

      // Check if this region is inside another region
      for (let j = 0; j < finalRegions.length; j++) {
        const existing = finalRegions[j];
        if (
          region.start >= existing.start &&
          region.end <= existing.end &&
          !(region.start === existing.start && region.end === existing.end)
        ) {
          // This region is inside another, which is fine for nested folding
          break;
        }
        if (region.start === existing.start && region.end === existing.end) {
          isValid = false; // Duplicate region
          break;
        }
      }

      if (isValid) {
        finalRegions.push(region);
      }
    }

    return finalRegions;
  },

  findRegionEnd: function (lines, startIndex, language) {
    const startLine = lines[startIndex];
    const startIndent = startLine.match(/^\s*/)[0].length;

    // For brace-based languages
    if (startLine.includes("{")) {
      let bracketCount = 0;

      for (let i = startIndex; i < lines.length; i++) {
        const line = lines[i];

        // Count brackets
        for (const char of line) {
          if (char === "{") bracketCount++;
          if (char === "}") bracketCount--;

          if (bracketCount === 0 && i > startIndex) {
            return i;
          }
        }
      }

      // If we didn't find a closing bracket, return end of file
      return lines.length - 1;
    }

    // For indentation-based languages (Python)
    if (language === "python" || startLine.endsWith(":")) {
      for (let i = startIndex + 1; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        if (trimmed === "") continue; // Skip empty lines

        const currentIndent = line.match(/^\s*/)[0].length;

        // If we're back to the same or lower indentation level, we've found the end
        if (currentIndent <= startIndent) {
          return i - 1;
        }
      }

      return lines.length - 1;
    }

    // For HTML/XML
    if (language === "html" || language === "xml") {
      const tagMatch = startLine.match(/<([\w-]+)/);
      if (tagMatch) {
        const tagName = tagMatch[1];
        let depth = 1;

        for (let i = startIndex + 1; i < lines.length; i++) {
          const line = lines[i];

          // Check for opening tags
          const openMatches = line.match(
            new RegExp(`<${tagName}(?:\\s|>)`, "g")
          );
          if (openMatches) depth += openMatches.length;

          // Check for closing tags
          const closeMatches = line.match(new RegExp(`</${tagName}>`, "g"));
          if (closeMatches) depth -= closeMatches.length;

          if (depth === 0) {
            return i;
          }
        }
      }
    }

    // Default: look for the next line with same or lower indentation
    for (let i = startIndex + 1; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      if (trimmed === "") continue;

      const currentIndent = line.match(/^\s*/)[0].length;
      if (currentIndent <= startIndent) {
        return i - 1;
      }
    }

    return lines.length - 1;
  },

  getRegionPreview: function (lines, start, end, language) {
    const startLine = lines[start].trim();

    // CSS-style preview
    if (startLine.includes("{") && lines[end].trim().includes("}")) {
      return " }";
    }

    // HTML-style preview
    if (language === "html" || language === "xml") {
      const tagMatch = startLine.match(/<([\w-]+)/);
      if (tagMatch) {
        return ` </${tagMatch[1]}>`;
      }
    }

    // Python function/class preview
    if (language === "python") {
      if (startLine.startsWith("def ") || startLine.startsWith("async def ")) {
        return " ...";
      }
      if (startLine.startsWith("class ")) {
        return " ...";
      }
    }

    // Count lines in the folded region
    const lineCount = end - start;
    if (lineCount > 10) {
      return ` ... (${lineCount} lines)`;
    }

    return " ...";
  },

  setupCodeViewEventHandlers: function (overlay, contentData) {
    // Copy button
    const copyBtn = overlay.querySelector("#copyCodeBtn");
    if (copyBtn) {
      copyBtn.addEventListener("click", () => {
        navigator.clipboard
          .writeText(contentData.content)
          .then(() => {
            const originalHTML = copyBtn.innerHTML;
            copyBtn.innerHTML = '<span class="btn-icon">✅</span> Copied!';
            setTimeout(() => {
              copyBtn.innerHTML = originalHTML;
            }, 2000);
          })
          .catch((err) => {
            console.error("Failed to copy:", err);
          });
      });
    }

    // Fold functionality
    overlay.addEventListener("click", (e) => {
      if (
        e.target.classList.contains("fold-marker") ||
        e.target.classList.contains("fold-placeholder")
      ) {
        const foldId = e.target.dataset.foldId;
        this.toggleFold(foldId);
      }
    });

    // Close button
    const closeBtn = overlay.querySelector("#closeCodeViewBtn");
    if (closeBtn) {
      closeBtn.addEventListener("click", () => {
        overlay.remove();
      });
    }

    // Escape key to close
    const escapeHandler = (e) => {
      if (e.key === "Escape") {
        overlay.remove();
        document.removeEventListener("keydown", escapeHandler);
      }
    };
    document.addEventListener("keydown", escapeHandler);
  },

  toggleFold: function (foldId) {
    const block = document.querySelector(
      `.foldable-block[data-fold-id="${foldId}"]`
    );
    if (!block) return;

    const marker = block.querySelector(
      `.fold-marker[data-fold-id="${foldId}"]`
    );
    const content = block.querySelector(
      `.fold-content[data-fold-id="${foldId}"]`
    );
    const placeholder = block.querySelector(
      `.fold-placeholder[data-fold-id="${foldId}"]`
    );

    if (marker && content) {
      const isCollapsed = content.classList.contains("collapsed");

      if (isCollapsed) {
        content.classList.remove("collapsed");
        block.classList.remove("collapsed");
        marker.textContent = "▼";
      } else {
        content.classList.add("collapsed");
        block.classList.add("collapsed");
        marker.textContent = "▶";
      }
    }
  },

  escapeHtml: function (text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  },

  // Add these missing methods that your code references
  setupEventListeners: function () {
    // Add your event listener setup code here
    console.log("Setting up event listeners...");
  },

  setupPasteHandler: function () {
    // Add your paste handler setup code here
    console.log("Setting up paste handler...");
  },

  sendMessage: function () {
    // Implement the sendMessage functionality
    const input = document.getElementById("chatInput");
    if (input?.value.trim()) {
      chatManager.sendMessage(input.value.trim());
      input.value = "";
      this.autoResizeTextarea();
    }
  },
};

// RESTORED: Window glitch prevention function
function preventWindowGlitching() {
  let isMoving = false;
  let moveTimeout;

  // CRITICAL: Prevent auto-maximize behavior
  let preventMaximize = false;

  // Detect window movement/resize
  window.addEventListener("resize", (e) => {
    const currentWidth = window.innerWidth;
    const currentHeight = window.innerHeight;

    // Add window-moving class during resize
    document.body.classList.add("window-moving");

    // CRITICAL: Don't auto-maximize during window moves
    if (
      currentWidth >= screen.width - 50 &&
      currentHeight >= screen.height - 50
    ) {
      preventMaximize = true;
      console.log("🚫 Preventing auto-maximize during window move");
    }

    clearTimeout(moveTimeout);
    moveTimeout = setTimeout(() => {
      document.body.classList.remove("window-moving");
      preventMaximize = false;
    }, 1000); // Longer timeout to prevent rapid changes
  });

  // Override any maximize attempts during moves
  const originalMaximize = window.maximize;
  if (originalMaximize) {
    window.maximize = function () {
      if (preventMaximize) {
        console.log("🚫 Blocked maximize during window operation");
        return;
      }
      return originalMaximize.apply(this, arguments);
    };
  }

  // Monitor for monitor changes
  let lastScreenX = window.screenX;
  let lastScreenY = window.screenY;

  setInterval(() => {
    const currentScreenX = window.screenX;
    const currentScreenY = window.screenY;

    if (
      Math.abs(currentScreenX - lastScreenX) > 50 ||
      Math.abs(currentScreenY - lastScreenY) > 50
    ) {
      console.log("🖥️ Monitor change detected - applying stabilization");
      document.body.classList.add("window-moving");
      document.body.style.backdropFilter = "blur(3px)";

      setTimeout(() => {
        document.body.classList.remove("window-moving");
        document.body.style.backdropFilter = "blur(8px)";
      }, 2000);
    }

    lastScreenX = currentScreenX;
    lastScreenY = currentScreenY;
  }, 500);
}

// Main initialization
document.addEventListener("DOMContentLoaded", function () {
  console.log("🚀 AI Assistant initializing...");

  // Call window glitch prevention
  preventWindowGlitching();

  // Initialize environment
  Environment.init();

  // Load app state
  appState.loadFromStorage();

  // Initialize content manager
  contentManager.init();

  // Initialize history manager
  historyManager.init();

  // Initialize chat input manager
  if (window.chatInputManager) {
    chatInputManager.init();
  }

  // Initialize authentication
  authManager.initialize().then(function (isAuthenticated) {
    console.log("✅ Auth initialized, authenticated:", isAuthenticated);
    updateAuthDropdown();

    if (isAuthenticated) {
      console.log("🎉 Welcome back,", appState.currentUser?.email || "User");
    }
  });

  // Set up auth event listeners
  authManager.setupEventListeners();

  // Set up UI event listeners
  setupEventListeners();

  // Restore conversation if there's history
  if (appState.chatHistory.length > 0 && appState.currentTopicId) {
    historyManager.loadConversation(
      appState.currentTopicId,
      appState.currentSubtopicId || "main"
    );
  }

  console.log("✅ AI Assistant ready!");
});

// Export for debugging
window.appDebug = {
  appState: appState,
  messageManager: messageManager,
  chatManager: chatManager,
  authManager: authManager,
  historyManager: historyManager,
  contentManager: contentManager,
  Environment: Environment,
  clearAllData: function () {
    if (
      confirm("This will clear ALL data including authentication. Continue?")
    ) {
      localStorage.clear();
      window.location.reload();
    }
  },
};

// Make contentManager globally available for onclick handlers
window.contentManager = contentManager;

// Make chatInputManager globally available
window.chatInputManager = chatInputManager;

console.log(
  "✅ COMPLETE AI Assistant with Context+, enhanced file handling, and syntax highlighting loaded!"
);
