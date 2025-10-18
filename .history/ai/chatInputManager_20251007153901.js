// chatInputManager.js - Input handling and attachments
"use strict";

if (typeof $DebugTestMode === "undefined") {
  $DebugTestMode = true;
}

// RESTORED: Enhanced chat input manager with syntax highlighting
var chatInputManager = {
  maxDisplayLength: 500,
  maxDirectInput: 2000,
  largeContentStore: new Map(),
  attachments: [],
  attachmentCounter: 0,

  largeContentUIThreshold: 1000,
  lastPastedContent: "",
  lastPasteTime: 0,
  duplicateThreshold: 300,

  init: function () {
    chatInputManager.setupEventListeners();
    chatInputManager.setupPasteHandler();
    chatInputManager.loadHighlightJS();
    chatInputManager.setupEnhancedSyntaxHighlighting();
    chatInputManager.autoResizeTextarea();
  },

  // Add method to load highlight.js
  loadHighlightJS: function () {
    if (typeof hljs === "undefined") {
      // Load highlight.js from CDN
      const script = document.createElement("script");
      script.src =
        "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js";
      script.onload = () => {
        if ($DebugTestMode) {
          console.log("✅ Highlight.js loaded");
        }
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

  receiveTranscriptWordsAndSend(words) {
    if ($DebugTestMode) {
      console.log("Received transcript words:", words);
    }
    if (chatManager.currentStreamMessageId) {
      if ($DebugTestMode) {
        console.log("🧭 ❌ Cannot send message while processing a message");
      }

      // Get header controls element first
      const headerControls = document.querySelector(".header-controls");

      // Check if processing banner already exists
      let processingBanner = document.querySelector(".processing-banner");

      if (processingBanner) {
        // Banner exists, just reset the timeout
        clearTimeout(parseInt(processingBanner.dataset.timeoutId));
        processingBanner.dataset.timeoutId = setTimeout(() => {
          if (processingBanner.parentNode === headerControls) {
            headerControls.removeChild(processingBanner);
          }
        }, 3000);
      } else {
        // Create and display new processing banner
        processingBanner = document.createElement("div");
        processingBanner.className = "processing-banner";
        processingBanner.textContent = "Processing memory, please wait";
        processingBanner.style.cssText = `
    background-color: rgb(54, 73, 74);
    color: rgb(255, 255, 255);
    padding: 5px;
    border-radius: 4px;
    position: absolute;
    z-index: 1000;
    top: 50px;
    left: 50%;
    transform: translateX(-50%);
    width: 230px;
    font-weight: bold;
    font-size: 14px;
  `;

        // Add the banner before the new chat button
        const newChatButton = document.querySelector(".new-chat-button");
        headerControls.insertBefore(processingBanner, newChatButton);

        // Store timeout ID in data attribute for later clearing
        processingBanner.dataset.timeoutId = setTimeout(() => {
          if (processingBanner.parentNode === headerControls) {
            headerControls.removeChild(processingBanner);
          }
        }, 3000);
      }

      return; // Exit the function to prevent sending message
    }
    // Clear chat input first and get attachment container
    const chatInput = document.getElementById("chatInput");
    const container = document.getElementById("attachmentPreviews");

    if (chatInput) {
      // Empty the chat input first
      chatInput.value = "";
      container.innerHTML = "";

      // Then set the processed text
      chatInput.value = words;

      // Create and dispatch a paste event
      const pasteEvent = new ClipboardEvent("paste", {
        bubbles: true,
        cancelable: true,
        clipboardData: new DataTransfer(),
      });

      // Add the processed text to clipboard data
      pasteEvent.clipboardData.setData("text/plain", words);

      // Dispatch the paste event
      chatInput.dispatchEvent(pasteEvent);
    }

    this.sendMessage();
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

  // NEW UNIFIED ATTACHMENT DISPLAY FUNCTION
  createUnifiedAttachmentDisplay: function (attachment) {
    if ($DebugTestMode) {
      console.log("🎨 === CREATING UNIFIED ATTACHMENT DISPLAY ===");
      console.log("🎨 Attachment:", attachment);
    }

    const attachmentElement = document.createElement("div");
    attachmentElement.className = `attachment-item ${attachment.type}`;
    attachmentElement.id = `attachment_${attachment.id}`;
    attachmentElement.setAttribute("data-attachment-id", attachment.id);

    // Create the preview content based on attachment type
    let previewContent = "";

    switch (attachment.type) {
      case "image":
        let imageData = attachment.data;
        if (!imageData.startsWith("data:")) {
          imageData = `data:image/png;base64,${attachment.data}`;
        }
        previewContent = `<div class="attachment-content">
              <img style="height: 100%" src="${imageData}" alt="${this.escapeHtml(
          attachment.filename
        )}" />
          </div>`;
        break;

      case "large_content":
        // ✅ Enhanced: Try both attachment.content and attachment.content_preview
        const content = attachment.content || attachment.content_preview || "";
        const contentPreview =
          content.length > 1000 ? content.substring(0, 1000) + "..." : content;
        previewContent = `<div class="attachment-content">
                <code>${this.escapeHtml(contentPreview)}</code>
          </div>`;
        break;

      case "file":
        // ✅ Enhanced: Try both attachment.content and attachment.content_preview
        const filecontent =
          attachment.content || attachment.content_preview || "";
        const filecontentPreview =
          filecontent.length > 1000
            ? filecontent.substring(0, 1000) + "..."
            : filecontent;
        previewContent = `<div class="attachment-content">
                <code>${this.escapeHtml(filecontentPreview)}</code>
          </div>`;
        break;
      default:
        const icon = this.getFileIcon(attachment);
        console.log("THIS IS THE ATTACHEMNT DEFUALT", attachment);
        previewContent = `<div class="attachment-content">
              <div class="file-icon">${icon}</div>
              <div class="file-info">${this.escapeHtml(
                attachment.filename
              )}</div>
              <div class="file-size">${this.formatFileSize(
                attachment.size
              )}</div>
          </div>`;
        break;
    }

    // Combine everything
    attachmentElement.innerHTML = `<div class="attachment-preview" onclick="chatInputManager.enlargeAttachment('${attachment.id}')">
      ${previewContent}
  </div>
  <button class="remove-attachment" onclick="event.stopPropagation(); chatInputManager.removeAttachment('${attachment.id}')" title="Remove attachment">✕</button>
   <button class="copy-attachment" onclick="event.stopPropagation(); chatInputManager.copyAttachment('${attachment.id}')" title="Copy attachment"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg></button>`;

    if ($DebugTestMode) {
      console.log("🎨 ✅ Unified attachment display created");
    }

    return attachmentElement;
  },

  shouldReadAsText: function (file) {
    // Expanded list of text-readable extensions
    const textExtensions = [
      // Code files
      ".js",
      ".jsx",
      ".ts",
      ".tsx",
      ".javascript",
      ".py",
      ".python",
      ".java",
      ".cpp",
      ".c",
      ".h",
      ".hpp",
      ".cs",
      ".php",
      ".rb",
      ".go",
      ".rs",
      ".swift",
      ".kt",
      ".scala",
      ".r",
      ".m",
      ".sql",
      ".sh",
      ".bash",
      ".ps1",

      // Web files
      ".html",
      ".htm",
      ".css",
      ".scss",
      ".sass",
      ".less",
      ".xml",
      ".xhtml",
      ".svg",

      // Data/Config files
      ".json",
      ".yaml",
      ".yml",
      ".toml",
      ".ini",
      ".cfg",
      ".conf",
      ".config",
      ".env",
      ".properties",

      // Documentation
      ".md",
      ".markdown",
      ".txt",
      ".text",
      ".rtf",
      ".tex",
      ".latex",
      ".rst",
      ".asciidoc",

      // Data files
      ".csv",
      ".tsv",
      ".log",
      ".logs",

      // Build/Project files
      ".dockerfile",
      ".docker",
      ".makefile",
      ".cmake",
      ".gradle",
      ".maven",
      ".pom",
      ".sbt",
      ".mix",
      ".package",
      ".lock",
      ".sum",

      // Other text formats
      ".gitignore",
      ".gitattributes",
      ".editorconfig",
      ".eslintrc",
      ".prettierrc",
      ".babelrc",
    ];

    // MIME types that should be treated as text
    const textMimeTypes = [
      "text/",
      "application/json",
      "application/javascript",
      "application/xml",
      "application/x-yaml",
      "application/x-python-code",
      "application/x-sh",
      "application/x-sql",
    ];

    const fileName = file.name.toLowerCase();
    const fileType = file.type.toLowerCase();

    // Check by extension
    const hasTextExtension = textExtensions.some((ext) =>
      fileName.endsWith(ext.toLowerCase())
    );

    // Check by MIME type
    const hasTextMimeType = textMimeTypes.some((type) =>
      fileType.startsWith(type)
    );

    // Check for files without extensions that are commonly text
    const commonTextFiles = [
      "readme",
      "license",
      "changelog",
      "authors",
      "contributors",
      "dockerfile",
      "makefile",
      "gemfile",
      "rakefile",
      "gruntfile",
      "gulpfile",
      "webpack",
      "rollup",
      "tsconfig",
      "jsconfig",
    ];

    const hasCommonTextName = commonTextFiles.some((name) =>
      fileName.includes(name)
    );

    // Default to text if file is small and has no clear binary indicators
    const isSmallFile = file.size < 1024 * 1024; // 1MB

    // Binary extensions - ADD PDF HERE
    const binaryExtensions = [
      ".exe",
      ".dll",
      ".so",
      ".dylib",
      ".bin",
      ".dat",
      ".jpg",
      ".jpeg",
      ".png",
      ".gif",
      ".bmp",
      ".webp",
      ".mp3",
      ".mp4",
      ".avi",
      ".mov",
      ".wmv",
      ".flv",
      ".pdf", // ← ADD THIS LINE
      ".zip",
      ".rar",
      ".7z",
      ".tar",
      ".gz",
      // Add other binary formats
      ".doc",
      ".docx",
      ".xls",
      ".xlsx",
      ".ppt",
      ".pptx",
      ".odt",
      ".ods",
      ".odp",
      ".epub",
      ".mobi",
    ];

    // Check for binary extensions FIRST
    const hasBinaryExtension = binaryExtensions.some((ext) =>
      fileName.endsWith(ext.toLowerCase())
    );

    if ($DebugTestMode) {
      console.log(`📎 Text readability check for ${file.name}:`, {
        hasTextExtension,
        hasTextMimeType,
        hasCommonTextName,
        isSmallFile,
        hasBinaryExtension, // ← Check this value
        shouldRead:
          ((hasTextExtension || hasTextMimeType || hasCommonTextName) &&
            !hasBinaryExtension) || // ← Add this condition
          (isSmallFile && !hasBinaryExtension),
      });
    }

    return (
      ((hasTextExtension || hasTextMimeType || hasCommonTextName) &&
        !hasBinaryExtension) || // ← PDFs will be excluded here
      (isSmallFile && !hasBinaryExtension)
    );
  },

  // Enhanced screenshot attachment function
  addScreenshotAttachment: function (attachment) {
    if ($DebugTestMode) {
      console.log("📸 Adding screenshot attachment:", attachment);
    }

    if (
      !attachment ||
      !attachment.data ||
      typeof attachment.data !== "string"
    ) {
      if ($DebugTestMode) {
        console.error("📸 Invalid attachment data");
      }
      this.showErrorNotification("Invalid screenshot data");
      return;
    }

    // 🆕 Generate unique ID for this attachment
    const attachmentId = `screenshot_${++this.attachmentCounter}_${Date.now()}`;

    // 🆕 Enhanced attachment object with unique ID
    const enhancedAttachment = {
      ...attachment,
      id: attachmentId,
      type: "image",
      filename: attachment.filename || `screenshot_${Date.now()}.png`,
      size: attachment.size || Math.round((attachment.data.length * 3) / 4),
      timestamp: Date.now(),
    };

    // Initialize attachments array if not exists
    if (!this.attachments) {
      this.attachments = [];
    }

    // 🆕 Add to attachments array (don't replace)
    this.attachments.push(enhancedAttachment);
    if ($DebugTestMode) {
      console.log("📸 Added to attachments, total:", this.attachments.length);
    }

    // 🆕 Create or update the attachment container
    this.updateAttachmentContainer();

    // 🆕 Add this specific screenshot to the container using unified display
    this.addAttachmentToContainer(enhancedAttachment);

    // 🆕 Update input placeholder
    this.updateInputPlaceholder();
  },

  updateAttachmentContainer: function () {
    if ($DebugTestMode) {
      console.log("📎 === UPDATING ATTACHMENT CONTAINER ===");
      console.log("📎 Current attachments:", this.attachments);
      console.log(
        "📎 Attachments length:",
        this.attachments ? this.attachments.length : 0
      );
    }

    let container = document.getElementById("attachmentPreviews");
    if ($DebugTestMode) {
      console.log("📎 Existing container found:", !!container);
    }

    if (!container) {
      if ($DebugTestMode) {
        console.log("📎 Creating new attachment container...");
      }

      const chatContainer =
        document.querySelector(".chat-input-container") ||
        document.querySelector("#chatContainer") ||
        document.body;

      if ($DebugTestMode) {
        console.log("📎 Chat container for insertion:", chatContainer);
      }

      container = document.createElement("div");
      container.className = "attachment-previews";
      container.id = "attachmentPreviews";

      if (chatContainer.className.includes("chat-input")) {
        chatContainer.insertBefore(container, chatContainer.firstChild);
        if ($DebugTestMode) {
          console.log(
            "📎 Inserted container at beginning of chat-input-container"
          );
        }
      } else {
        chatContainer.appendChild(container);
        if ($DebugTestMode) {
          console.log("📎 Appended container to chat container");
        }
      }

      if ($DebugTestMode) {
        console.log("📎 ✅ Created attachment container");
      }
    }

    if (this.attachments && this.attachments.length > 0) {
      container.style.display = "flex";
      if ($DebugTestMode) {
        console.log(
          `📎 Container made visible with ${this.attachments.length} attachments`
        );
      }
    } else {
      container.style.display = "none";
      if ($DebugTestMode) {
        console.log("📎 Container hidden - no attachments");
      }
    }

    if ($DebugTestMode) {
      console.log("📎 === CONTAINER UPDATE COMPLETE ===");
    }
  },

  addAttachmentToContainer: function (attachment) {
    if ($DebugTestMode) {
      console.log("📎 === ADDING ATTACHMENT TO CONTAINER ===");
      console.log("📎 Attachment:", attachment);
    }

    const container = document.getElementById("attachmentPreviews");
    if (!container) {
      if ($DebugTestMode) {
        console.error(
          "📎 ❌ Attachment container not found when adding attachment"
        );
      }
      return;
    }

    if ($DebugTestMode) {
      console.log("📎 Container found, creating attachment element...");
    }

    try {
      // Use the new unified display function
      const attachmentElement = this.createUnifiedAttachmentDisplay(attachment);

      if ($DebugTestMode) {
        console.log("📎 Attachment element created, adding to container...");
      }

      container.appendChild(attachmentElement);

      if ($DebugTestMode) {
        console.log("📎 ✅ Attachment element added to container");
      }

      // Verify it was added
      const addedElement = document.getElementById(
        `attachment_${attachment.id}`
      );
      if ($DebugTestMode) {
        console.log("📎 Verification - element found in DOM:", !!addedElement);
      }
    } catch (error) {
      if ($DebugTestMode) {
        console.error("📎 ❌ Error creating attachment element:", error);
        console.error("📎 Error stack:", error.stack);
      }
    }

    if ($DebugTestMode) {
      console.log("📎 === ATTACHMENT ELEMENT CREATION COMPLETE ===");
    }
  },

  removeAttachment: function (attachmentId) {
    if ($DebugTestMode) {
      console.log("🗑️ Removing attachment:", attachmentId);
      console.log("🗑️ Current attachments array:", this.attachments);
    }

    if (!this.attachments) {
      if ($DebugTestMode) {
        console.warn("🗑️ No attachments array found");
        console.warn("🗑️ this.attachments is:", this.attachments);
      }
      return;
    }

    console.log("🗑️ Current attachments before removal:", this.attachments);
    const index = this.attachments.findIndex((att) => {
      const match = att.id === attachmentId;
      if ($DebugTestMode && !match) {
        console.log(
          "🗑️ Checking attachment:",
          att.id,
          "type:",
          typeof att.id,
          "vs target:",
          attachmentId,
          "type:",
          typeof attachmentId
        );
      }
      return match;
    });

    console.log("🗑️ Found index:", index);

    if (index !== -1) {
      const removed = this.attachments.splice(index, 1)[0];
      if ($DebugTestMode) {
        console.log("🗑️ Removed attachment:", removed.filename);
        console.log("🗑️ Attachments after removal:", this.attachments);
      }
    } else {
      if ($DebugTestMode) {
        console.warn("🗑️ Attachment not found in array:", attachmentId);
        console.warn(
          "🗑️ Available attachment IDs:",
          this.attachments.map((a) => a.id)
        );
      }
    }

    // Only search for elements within chatInput
    const chatInput = document.querySelector(".chat-input-container");
    console.log("🗑️ chatInput element found:", !!chatInput);

    if (chatInput) {
      const selector = `#attachment_${attachmentId}`;
      console.log("🗑️ Searching for element with selector:", selector);

      const element = chatInput.querySelector(selector);
      console.log("🗑️ DOM element found:", !!element);

      if (element) {
        element.remove();
        if ($DebugTestMode) {
          console.log("🗑️ Removed attachment element from DOM");
        }
      } else {
        if ($DebugTestMode) {
          console.warn("🗑️ DOM element not found for selector:", selector);
          console.warn(
            "🗑️ Available attachment elements in chatInput:",
            Array.from(chatInput.querySelectorAll('[id^="attachment_"]')).map(
              (el) => el.id
            )
          );
        }
      }
    }

    this.updateAttachmentContainer();
    this.updateInputPlaceholder();

    // Hide container if no attachments left
    if (this.attachments.length === 0) {
      const chatInput = document.getElementById("chatInput");
      if (chatInput) {
        const container = chatInput.querySelector("#attachmentPreviews");
        if (container) {
          container.style.display = "none";
          if ($DebugTestMode) {
            console.log("🗑️ Hid attachment container");
          }
        }
      }
    }

    const sendButton = document.getElementById("sendButton");
    console.log("🗑️ sendButton found:", !!sendButton);
    console.log("🗑️ Current attachments length:", this.attachments.length);

    if (sendButton && this.attachments.length === 0) {
      sendButton.classList.remove("has-attachment");
      if ($DebugTestMode) {
        console.log("🗑️ Removed 'has-attachment' class from send button");
      }
    }
  },

  copyAttachment: async function (attachmentId) {
    if ($DebugTestMode) {
      console.log("📋 Starting copy to clipboard with ID:", attachmentId);
      console.log("📋 Current attachments:", this.attachments);
    }

    if (!this.attachments || !Array.isArray(this.attachments)) {
      if ($DebugTestMode) {
        console.log("❌ No attachments array found");
      }
      return false;
    }

    const attachment = this.attachments.find((att) => att.id === attachmentId);

    if (!attachment) {
      if ($DebugTestMode) {
        console.log("❌ Attachment not found:", attachmentId);
      }
      return false;
    }

    if ($DebugTestMode) {
      console.log("✅ Found attachment:", attachment.filename);
      console.log("📊 Attachment type:", attachment.type);
      console.log("📊 Content type:", typeof attachment.content);
      console.log("📊 Has data property:", !!attachment.data);
    }

    try {
      // Check if it's an image attachment
      if (
        attachment.type === "image" ||
        (attachment.filename &&
          attachment.filename.match(/\.(png|jpg|jpeg|gif|webp)$/i))
      ) {
        if ($DebugTestMode) {
          console.log("🖼️ Processing as image attachment");
        }

        // Check if we have data (base64) or content
        let imageData = attachment.data || attachment.content;

        if (!imageData || typeof imageData !== "string") {
          if ($DebugTestMode) {
            console.log("❌ Invalid image content:", imageData);
          }
          return false;
        }

        // Clean the data URL if needed (remove data:image/png;base64, prefix if already present)
        if (imageData.startsWith("data:")) {
          // Extract just the base64 part
          const commaIndex = imageData.indexOf(",");
          if (commaIndex !== -1) {
            imageData = imageData.substring(commaIndex + 1);
          }
        }

        try {
          // Convert base64 to blob
          const mimeType = "image/png"; // Default to png, or extract from filename if needed

          if ($DebugTestMode) {
            console.log("📊 Base64 data length:", imageData.length);
            console.log("📊 MIME type:", mimeType);
          }

          // Fetch the base64 data as a blob
          const response = await fetch(`data:${mimeType};base64,${imageData}`);
          const blob = await response.blob();

          if ($DebugTestMode) {
            console.log("✅ Blob created:", blob.type, blob.size);
          }

          // Copy image to clipboard
          const item = new ClipboardItem({ [blob.type]: blob });
          await navigator.clipboard.write([item]);

          if ($DebugTestMode) {
            console.log(
              "📋 Successfully copied image to clipboard:",
              attachment.filename
            );
          }

          // Optional: Show a toast or notification
          if (window.showToast) {
            window.showToast(`Copied ${attachment.filename} to clipboard`);
          }
        } catch (imageError) {
          if ($DebugTestMode) {
            console.error("❌ Failed to process image:", imageError);
          }

          // Provide user guidance
          if (window.showToast) {
            window.showToast("Right-click the image and select 'Copy Image'");
          }
        }
      } else {
        if ($DebugTestMode) {
          console.log("📝 Processing as text attachment");
        }
        // Handle text content as before
        await navigator.clipboard.writeText(attachment.content);

        if ($DebugTestMode) {
          console.log(
            "📋 Successfully copied to clipboard:",
            attachment.filename
          );
        }

        // Optional: Show a toast or notification
        if (window.showToast) {
          window.showToast(`Copied ${attachment.filename} to clipboard`);
        }
      }

      return true;
    } catch (error) {
      if ($DebugTestMode) {
        console.error("❌ Copy operation failed:", error);
      }

      // Fallback for text content
      if (!attachment.type || attachment.type !== "image") {
        try {
          const textArea = document.createElement("textarea");
          textArea.value = attachment.content;
          document.body.appendChild(textArea);
          textArea.select();
          document.execCommand("copy");
          document.body.removeChild(textArea);
          if ($DebugTestMode) {
            console.log("📋 Copied using fallback method");
          }
        } catch (fallbackError) {
          if ($DebugTestMode) {
            console.error("❌ Fallback method also failed:", fallbackError);
          }
        }
      }

      return false;
    }
  },

  // New function to enlarge any attachment
  enlargeAttachment: function (attachmentId) {
    if ($DebugTestMode) {
      console.log("🔍 Enlarging attachment:", attachmentId);
    }

    // Find the attachment
    const attachment = this.attachments.find((att) => att.id === attachmentId);
    if (!attachment) {
      if ($DebugTestMode) {
        console.error("🔍 ❌ Attachment not found:", attachmentId);
      }
      return;
    }

    // Create overlay
    const overlay = document.createElement("div");
    overlay.className = "attachment-fullscreen-overlay";
    overlay.id = `fullscreen_${attachmentId}`;

    // Create content based on attachment type
    let contentHTML = "";

    if (attachment.type === "image") {
      let imageData = attachment.data;
      if (!imageData.startsWith("data:")) {
        imageData = `data:image/png;base64,${attachment.data}`;
      }

      contentHTML = `
<div class="fullscreen-wrapper" style="position: relative !important;">
  <div class="fullscreen-preview-content">
    <div class="fullscreen-file-info">
      📷 ${this.escapeHtml(attachment.filename)} 
      <span style="opacity: 0.7; margin-left: 10px;">${this.formatFileSize(
        attachment.size
      )}</span>
    </div>
    <img src="${imageData}" alt="${this.escapeHtml(
        attachment.filename
      )}" class="fullscreen-image-preview">
  </div>
  <button class="fullscreen-close-btn" onclick="chatInputManager.closeEnlargedAttachment('${attachmentId}')">✕</button>
</div>
`;
    } else if (
      attachment.type === "large_content" ||
      attachment.type === "file" ||
      (attachment.content && attachment.content.length > 0)
    ) {
      // Handle both large_content and file types with content
      const content = attachment.content || "";
      const contentType =
        attachment.contentType || this.detectContentType(content);
      const language =
        attachment.language ||
        this.detectLanguage(attachment.extension) ||
        contentType;

      // Create syntax-highlighted version
      const highlightedContent = this.createHighlightedCode(content, language);

      contentHTML = `
<div class="fullscreen-wrapper" style="position: relative !important;">
  <div class="fullscreen-preview-content">
    <div class="fullscreen-file-info">
      ${this.getFileIcon(attachment)} ${this.escapeHtml(attachment.filename)}
      <span style="opacity: 0.7; margin-left: 10px;">
        ${this.formatFileSize(attachment.size)} • 
        ${attachment.line_count || content.split("\n").length} lines
        ${contentType !== "document" ? ` • ${contentType}` : ""}
      </span>
    </div>
    <div class="code-view-enhanced" style="max-height: 80vh; overflow-y: auto;">
      ${highlightedContent}
    </div>
  </div>
  <button class="fullscreen-close-btn" onclick="chatInputManager.closeEnlargedAttachment('${attachmentId}')">✕</button>
</div>
`;
    } else {
      // Generic file preview for binary files
      const icon = this.getFileIcon(attachment);
      contentHTML = `
<div class="fullscreen-wrapper" style="position: relative !important;">
  <div class="fullscreen-preview-content">
    <div class="fullscreen-file-info">
      ${icon} ${this.escapeHtml(attachment.filename)}
    </div>
    <div class="fullscreen-generic-preview">
      <div class="file-icon">${icon}</div>
      <div class="file-details">
        <div style="font-size: 18px; font-weight: bold; margin-bottom: 10px;">
          ${this.escapeHtml(attachment.filename)}
        </div>
        <div>Size: ${this.formatFileSize(attachment.size)}</div>
        <div>Type: ${attachment.mimeType || "Unknown"}</div>
        ${
          attachment.extension
            ? `<div>Extension: ${attachment.extension}</div>`
            : ""
        }
        <div style="margin-top: 15px; opacity: 0.7;">
          This file type cannot be previewed directly.
        </div>
      </div>
    </div>
  </div>
  <button class="fullscreen-close-btn" onclick="chatInputManager.closeEnlargedAttachment('${attachmentId}')">✕</button>
</div>
`;
    }

    overlay.innerHTML = contentHTML;

    // Add to DOM
    document.body.appendChild(overlay);

    // Setup folding if it's a code view
    if (overlay.querySelector(".code-view-enhanced")) {
      this.setupCodeViewEventHandlers(overlay, {
        content: attachment.content || "",
      });
    }

    // Close on overlay click (but not on content click)
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        this.closeEnlargedAttachment(attachmentId);
      }
    });

    // Close on escape key
    const escapeHandler = (e) => {
      if (e.key === "Escape") {
        this.closeEnlargedAttachment(attachmentId);
        document.removeEventListener("keydown", escapeHandler);
      }
    };
    document.addEventListener("keydown", escapeHandler);

    if ($DebugTestMode) {
      console.log("🔍 ✅ Attachment enlarged successfully");
    }
  },

  // Function to close enlarged attachment
  closeEnlargedAttachment: function (attachmentId) {
    if ($DebugTestMode) {
      console.log("🔍 Closing enlarged attachment:", attachmentId);
    }

    const overlay = document.getElementById(`fullscreen_${attachmentId}`);
    if (overlay) {
      // Add fade out animation
      overlay.style.animation = "fadeOut 0.2s ease-out forwards";

      // Remove after animation
      setTimeout(() => {
        if (overlay.parentNode) {
          overlay.parentNode.removeChild(overlay);
        }
      }, 200);
    }

    if ($DebugTestMode) {
      console.log("🔍 ✅ Enlarged attachment closed");
    }
  },

  updateInputPlaceholder: function () {
    const chatInput = document.getElementById("chatInput");
    if (!chatInput) return;

    if (this.attachments && this.attachments.length > 0) {
      const types = [...new Set(this.attachments.map((att) => att.type))];
      const typeText = types.join(", ");
    } else {
      chatInput.placeholder = "Type your message...";
    }

    if ($DebugTestMode) {
      console.log("💬 Updated input placeholder");
    }
  },

  // ✅ ADD: Error notification method
  showErrorNotification: function (message) {
    if ($DebugTestMode) {
      console.error("📎 === ERROR NOTIFICATION ===");
      console.error("📎 Error message:", message);
      console.error("📎 Call stack:", new Error().stack);
    }

    const notification = document.createElement("div");
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #ff4444;
      color: white;
      padding: 12px 16px;
      border-radius: 6px;
      z-index: 10000;
      font-family: Arial, sans-serif;
      font-size: 14px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      max-width: 300px;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);

    if ($DebugTestMode) {
      console.log("📎 Error notification displayed:", message);
    }

    setTimeout(() => {
      if (document.body.contains(notification)) {
        document.body.removeChild(notification);
        if ($DebugTestMode) {
          console.log("📎 Error notification removed");
        }
      }
    }, 5000);
  },

  // Fallback preview for when image fails
  showFallbackPreview: function (attachment) {
    const previewContainer = document.createElement("div");
    previewContainer.className = "screenshot-preview-container fallback";
    previewContainer.id = "screenshotPreview";

    let imageData = attachment.data;
    if (!imageData.startsWith("data:")) {
      imageData = `data:image/png;base64,${attachment.data}`;
    }

    // SIMPLIFIED: Only image and X button for fallback too
    previewContainer.innerHTML = `
    <div style="position: relative; display: inline-block;">
      <img src="${imageData}" 
           alt="Screenshot preview" 
           style="max-width: 200px; max-height: 150px; border-radius: 8px; display: block;"
           onload="if ($DebugTestMode) { console.log('📸 ✅ Image loaded successfully'); }"
           onerror="if ($DebugTestMode) { console.error('📸 ❌ Image failed to load'); } this.style.display='none'; this.parentNode.innerHTML='<div style=&quot;width: 200px; height: 150px; border-radius: 8px; background: #f0f0f0; display: flex; align-items: center; justify-content: center; color: #666;&quot;>📷 Preview failed</div>';" />
      <button class="remove-screenshot-btn" 
              onclick="chatInputManager.removeScreenshotPreview()"
              style="position: absolute; top: -8px; right: -8px; width: 24px; height: 24px; border-radius: 50%; background: #ff4444; color: white; border: 2px solid white; cursor: pointer; font-size: 14px; font-weight: bold; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">✕</button>
    </div>
  `;

    // Insert into DOM
    const chatContainer =
      document.querySelector(".chat-input-container, #chatContainer") ||
      document.body;

    if (chatContainer === document.body) {
      previewContainer.style.position = "fixed";
      previewContainer.style.top = "20px";
      previewContainer.style.right = "20px";
      previewContainer.style.zIndex = "10000";
    }

    chatContainer.appendChild(previewContainer);
  },

  showScreenshotPreview: function (attachment) {
    if ($DebugTestMode) {
      console.log("📸 Creating screenshot preview for:", attachment.filename);
    }

    // Remove any existing preview
    const existing = document.getElementById("screenshotPreview");
    if (existing) {
      existing.remove();
    }

    // CREATE the preview container element
    const previewContainer = document.createElement("div");
    previewContainer.className = "screenshot-preview-container";
    previewContainer.id = "screenshotPreview";

    // ✅ ADD CRITICAL STYLES TO PREVENT CLIPPING
    previewContainer.style.cssText = `
    position: relative;
    display: inline-block;
    margin: 10px;
    z-index: 1000;
    overflow: visible !important;
  `;

    // PREPARE IMAGE DATA WITH PROPER FORMAT
    let imageData = attachment.data;
    if (!imageData.startsWith("data:")) {
      imageData = `data:image/png;base64,${attachment.data}`;
    }

    // ✅ IMPROVED: Better positioning and z-index for button
    previewContainer.innerHTML = `
    <div style="position: relative; display: inline-block; overflow: visible;">
      <img src="${imageData}" 
           alt="Screenshot preview" 
           style="max-width: 200px; max-height: 150px; border-radius: 8px; display: block;"
           onload="if ($DebugTestMode) { console.log('📸 ✅ Image loaded successfully'); }"
           onerror="if ($DebugTestMode) { console.error('📸 ❌ Image failed to load'); } this.style.display='none';" />
      <button class="remove-screenshot-btn" 
              onclick="chatInputManager.removeScreenshotPreview()"
              style="position: absolute; 
                     top: -12px; 
                     right: -12px; 
                     width: 28px; 
                     height: 28px; 
                     border-radius: 50%; 
                     background: #ff4444; 
                     color: white; 
                     border: 3px solid white; 
                     cursor: pointer; 
                     font-size: 16px; 
                     font-weight: bold; 
                     display: flex; 
                     align-items: center; 
                     justify-content: center; 
                     box-shadow: 0 4px 8px rgba(0,0,0,0.4);
                     z-index: 1001 !important;
                     overflow: visible !important;">✕</button>
    </div>
  `;

    // ✅ IMPROVED: Better container selection and insertion
    let chatContainer = document.querySelector(".chat-input-container");

    if (!chatContainer) {
      chatContainer = document.querySelector("#chatContainer");
    }

    if (!chatContainer) {
      chatContainer = document.body;
      // For body insertion, use fixed positioning
      previewContainer.style.position = "fixed";
      previewContainer.style.top = "20px";
      previewContainer.style.right = "20px";
      previewContainer.style.zIndex = "10000";
    }

    // ✅ ENSURE CONTAINER HAS PROPER OVERFLOW SETTINGS
    if (chatContainer !== document.body) {
      chatContainer.style.overflow = "visible";

      // Insert at the beginning to avoid being hidden
      if (chatContainer.firstChild) {
        chatContainer.insertBefore(previewContainer, chatContainer.firstChild);
      } else {
        chatContainer.appendChild(previewContainer);
      }
    } else {
      document.body.appendChild(previewContainer);
    }

    if ($DebugTestMode) {
      console.log("📸 ✅ Screenshot preview created and inserted");
    }

    // Update the chat input placeholder
    const chatInput = document.getElementById("chatInput");
    if (chatInput) {
      chatInput.placeholder = "Screenshot attached - add your message...";
    }

    // Add visual feedback to send button
    const sendButton = document.getElementById("sendButton");
    if (sendButton) {
      sendButton.classList.add("has-attachment");
    }
  },

  removeScreenshotPreview: function () {
    // Find and remove image attachments (for backward compatibility)
    if (this.attachments) {
      const imageAttachments = this.attachments.filter(
        (att) => att.type === "image"
      );
      imageAttachments.forEach((att) => this.removeAttachment(att.id)); // ✅ Now this will work
    }

    // Also remove old-style preview if it exists
    const existing = document.getElementById("screenshotPreview");
    if (existing) {
      existing.remove();
    }

    // Reset input placeholder
    const chatInput = document.getElementById("chatInput");
    if (chatInput) {
      chatInput.placeholder = "Type your message...";
    }

    // Reset send button
    const sendButton = document.getElementById("sendButton");
    if (sendButton) {
      sendButton.classList.remove("has-attachment");
    }
  },

  formatFileSize: function (bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + " KB";
    return Math.round(bytes / (1024 * 1024)) + " MB";
  },

  // 5. MODIFY the sendMessage function in chatInputManager to include attachments:

  sendMessage: function () {
    if (chatManager.currentStreamMessageId) {
      if ($DebugTestMode) {
        console.log("🧭 ❌ Cannot send message while processing a message");
      }

      // Get header controls element first
      const headerControls = document.querySelector(".header-controls");

      // Check if processing banner already exists
      let processingBanner = document.querySelector(".processing-banner");

      if (processingBanner) {
        // Banner exists, just reset the timeout
        clearTimeout(parseInt(processingBanner.dataset.timeoutId));
        processingBanner.dataset.timeoutId = setTimeout(() => {
          if (processingBanner.parentNode === headerControls) {
            headerControls.removeChild(processingBanner);
          }
        }, 3000);
      } else {
        // Create and display new processing banner
        processingBanner = document.createElement("div");
        processingBanner.className = "processing-banner";
        processingBanner.textContent = "Processing memory, please wait";
        processingBanner.style.cssText = `
  background-color: rgb(54, 73, 74);
  color: rgb(255, 255, 255);
  padding: 5px;
  border-radius: 4px;
  position: absolute;
  z-index: 1000;
  top: 50px;
  left: 50%;
  transform: translateX(-50%);
  width: 230px;
  font-weight: bold;
  font-size: 14px;
`;

        // Add the banner before the new chat button
        const newChatButton = document.querySelector(".new-chat-button");
        headerControls.insertBefore(processingBanner, newChatButton);

        // Store timeout ID in data attribute for later clearing
        processingBanner.dataset.timeoutId = setTimeout(() => {
          if (processingBanner.parentNode === headerControls) {
            headerControls.removeChild(processingBanner);
          }
        }, 3000);
      }

      return; // Exit the function to prevent sending message
    }

    const input = document.getElementById("chatInput");
    const messageText = input?.value.trim();

    // Get attachments if any
    const attachments = this.attachments || [];

    if (!messageText && attachments.length === 0) {
      return; // Nothing to send
    }

    // Send with attachments
    chatManager.sendMessage(messageText || "", attachments);

    // Clear input and attachments
    if (input) {
      input.value = "";
      input.placeholder = "Type your message...";
      this.autoResizeTextarea();
    }

    // Remove preview and clear attachments
    this.removeScreenshotPreview();
    this.clearAllAttachments();

    // Reset send button
    const sendButton = document.getElementById("sendButton");
    if (sendButton) {
      sendButton.classList.remove("has-attachment");
    }
  },

  // ✅ NEW: Helper function to clear all attachments
  clearAllAttachments: function () {
    if ($DebugTestMode) {
      console.log("🧹 === CLEARING ALL ATTACHMENTS ===");
    }

    // Clear attachments array
    this.attachments = [];

    // Hide and clear container
    const container = document.getElementById("attachmentPreviews");
    if (container) {
      container.style.display = "none";
      container.innerHTML = ""; // Clear all child elements
      if ($DebugTestMode) {
        console.log("🧹 ✅ Container hidden and cleared");
      }
    }

    // Remove old-style preview if it exists (backward compatibility)
    const oldPreview = document.getElementById("screenshotPreview");
    if (oldPreview) {
      oldPreview.remove();
      if ($DebugTestMode) {
        console.log("🧹 Removed old-style preview");
      }
    }

    // Reset input placeholder
    this.updateInputPlaceholder();

    if ($DebugTestMode) {
      console.log("🧹 === CLEARING COMPLETE ===");
    }
  },

  viewFullContent: function (previewId) {
    const contentData = this.largeContentStore?.get(previewId);
    if (!contentData) {
      if ($DebugTestMode) {
        console.error("No content data found for preview:", previewId);
      }
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
        if ($DebugTestMode) {
          console.warn("Highlight.js error:", e);
        }
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
            if ($DebugTestMode) {
              console.error("Failed to copy:", err);
            }
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

  setupEventListeners: function () {
    if ($DebugTestMode) {
      console.log("🔧 Setting up chat input event listeners...");
    }

    // Send button
    const sendButton = document.getElementById("sendButton");
    if (sendButton) {
      sendButton.addEventListener("click", () => this.sendMessage());
      if ($DebugTestMode) {
        console.log("✅ Send button listener attached");
      }
    } else {
      if ($DebugTestMode) {
        console.error("❌ Send button not found!");
      }
    }

    // Chat input enter key
    const chatInput = document.getElementById("chatInput");
    if (chatInput) {
      chatInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          this.sendMessage();
        }
      });
      if ($DebugTestMode) {
        console.log("✅ Chat input keydown listener attached");
      }
    } else {
      if ($DebugTestMode) {
        console.error("❌ Chat input not found!");
      }
    }

    // Attachment button - ENHANCED DEBUGGING
    const attachmentButton = document.getElementById("attachmentButton");
    const attachmentInput = document.getElementById("attachmentInput");

    if ($DebugTestMode) {
      console.log("📎 === ATTACHMENT SETUP DEBUG ===");
      console.log("📎 Attachment button found:", !!attachmentButton);
      console.log("📎 Attachment input found:", !!attachmentInput);
    }

    if (attachmentButton) {
      if ($DebugTestMode) {
        console.log("📎 Attachment button element:", attachmentButton);
        console.log(
          "📎 Button classes:",
          attachmentButton.classList.toString()
        );
        console.log("📎 Button parent:", attachmentButton.parentElement);
      }
    }

    if (attachmentInput) {
      if ($DebugTestMode) {
        console.log("📎 Attachment input element:", attachmentInput);
        console.log("📎 Input type:", attachmentInput.type);
        console.log("📎 Input accept:", attachmentInput.accept);
        console.log("📎 Input multiple:", attachmentInput.multiple);
      }
    }

    if (attachmentButton && attachmentInput) {
      if ($DebugTestMode) {
        console.log("📎 Setting up attachment event listeners...");
      }

      // FIXED: Remove existing listeners to prevent conflicts
      const newAttachmentButton = attachmentButton.cloneNode(true);
      const newAttachmentInput = attachmentInput.cloneNode(true);

      attachmentButton.parentNode.replaceChild(
        newAttachmentButton,
        attachmentButton
      );
      attachmentInput.parentNode.replaceChild(
        newAttachmentInput,
        attachmentInput
      );

      if ($DebugTestMode) {
        console.log(
          "📎 Cloned and replaced attachment elements to prevent conflicts"
        );
      }

      // Get fresh references
      const freshAttachmentButton = document.getElementById("attachmentButton");
      const freshAttachmentInput = document.getElementById("attachmentInput");

      if ($DebugTestMode) {
        console.log("📎 Fresh button found:", !!freshAttachmentButton);
        console.log("📎 Fresh input found:", !!freshAttachmentInput);
      }

      // ENHANCED: Button click handler with extensive logging
      freshAttachmentButton.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        if ($DebugTestMode) {
          console.log("📎 === ATTACHMENT BUTTON CLICKED ===");
          console.log("📎 Click event:", e);
          console.log("📎 Event target:", e.target);
          console.log("📎 Button disabled:", freshAttachmentButton.disabled);
          console.log("📎 Input element exists:", !!freshAttachmentInput);
          console.log(
            "📎 Input value before reset:",
            freshAttachmentInput.value
          );
        }

        // Reset value BEFORE opening dialog
        freshAttachmentInput.value = "";
        if ($DebugTestMode) {
          console.log("📎 Reset input value to empty string");
          console.log(
            "📎 Input value after reset:",
            freshAttachmentInput.value
          );
        }

        // Small delay ensures value is cleared
        setTimeout(() => {
          if ($DebugTestMode) {
            console.log("📎 About to trigger file dialog...");
            console.log(
              "📎 Input element at trigger time:",
              freshAttachmentInput
            );
          }

          try {
            freshAttachmentInput.click();
            if ($DebugTestMode) {
              console.log("📎 ✅ File dialog triggered successfully");
            }
          } catch (error) {
            if ($DebugTestMode) {
              console.error("📎 ❌ Error triggering file dialog:", error);
            }
          }
        }, 10);
      });

      if ($DebugTestMode) {
        console.log("📎 ✅ Button click listener attached");
      }

      // ENHANCED: File change handler with extensive logging
      freshAttachmentInput.addEventListener("change", (e) => {
        if ($DebugTestMode) {
          console.log("📎 === FILE INPUT CHANGE EVENT ===");
          console.log("📎 Change event:", e);
          console.log("📎 Event target:", e.target);
          console.log("📎 Input files property:", e.target.files);
          console.log(
            "📎 Files length:",
            e.target.files ? e.target.files.length : "null"
          );
        }

        e.preventDefault();
        e.stopPropagation();

        const files = e.target.files;

        if (!files) {
          if ($DebugTestMode) {
            console.error("📎 ❌ No files property on input element");
          }
          return;
        }

        if (files.length === 0) {
          if ($DebugTestMode) {
            console.log("📎 ⚠️ No files selected (user probably canceled)");
          }
          return;
        }

        if ($DebugTestMode) {
          console.log("📎 Files selected:", files.length);
        }

        // Log each file
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          if ($DebugTestMode) {
            console.log(`📎 File ${i + 1}:`, {
              name: file.name,
              size: file.size,
              type: file.type,
              lastModified: file.lastModified,
            });
          }
        }

        try {
          if ($DebugTestMode) {
            console.log("📎 About to call handleFileAttachments...");
          }
          this.handleFileAttachments(files);
          if ($DebugTestMode) {
            console.log("📎 ✅ handleFileAttachments completed successfully");
          }
        } catch (error) {
          if ($DebugTestMode) {
            console.error("📎 ❌ Error in handleFileAttachments:", error);
            console.error("📎 Error stack:", error.stack);
          }
          this.showErrorNotification(
            "Failed to process selected files: " + error.message
          );
        }
      });

      if ($DebugTestMode) {
        console.log("📎 ✅ File change listener attached");
      }
    } else {
      if ($DebugTestMode) {
        console.error("📎 ❌ Missing attachment button or input elements!");
      }
      if (!attachmentButton && $DebugTestMode) {
        console.error("📎 Missing: attachmentButton");
      }
      if (!attachmentInput && $DebugTestMode) {
        console.error("📎 Missing: attachmentInput");
      }
    }

    if ($DebugTestMode) {
      console.log("📎 === ATTACHMENT SETUP COMPLETE ===");
    }
  },

  setupPasteHandler: function () {
    if ($DebugTestMode) {
      console.log("Setting up paste handler...");
    }

    const chatInput = document.getElementById("chatInput");
    if (!chatInput) {
      if ($DebugTestMode) {
        console.error("Chat input not found for paste handler");
      }
      return;
    }

    chatInput.addEventListener("paste", (e) => {
      if ($DebugTestMode) {
        console.log("📋 Paste event detected");
      }
      this.handlePaste(e);
    });

    if ($DebugTestMode) {
      console.log("✅ Paste handler attached to chat input");
    }
  },

  handlePaste: function (e) {
    const clipboardData = e.clipboardData || window.clipboardData;
    if (!clipboardData) return;

    // Check for image/screenshot data first
    if (clipboardData.items) {
      for (let i = 0; i < clipboardData.items.length; i++) {
        const item = clipboardData.items[i];
        if (item.type.indexOf("image") !== -1) {
          // Handle screenshot/image paste
          const blob = item.getAsFile();
          const reader = new FileReader();

          reader.onload = (event) => {
            const base64Data = event.target.result;
            this.addScreenshotAttachment({
              data: base64Data,
              filename: `screenshot_${Date.now()}.png`,
              type: "image/png",
              size: blob.size,
            });
          };

          reader.readAsDataURL(blob);
          e.preventDefault();
          return;
        }
      }
    }

    // If no image found, proceed with text handling
    const pastedText = clipboardData.getData("text");
    const currentTime = Date.now();

    // ✅ ADD DEDUPLICATION CHECK
    if (
      pastedText === this.lastPastedContent &&
      currentTime - this.lastPasteTime < this.duplicateThreshold
    ) {
      if ($DebugTestMode) {
        console.log("📋 🔄 Duplicate paste detected, ignoring");
      }
      e.preventDefault();
      return;
    }

    // Update tracking
    this.lastPastedContent = pastedText;
    this.lastPasteTime = currentTime;

    if ($DebugTestMode) {
      console.log("📋 Pasted text length:", pastedText.length);
    }

    if (pastedText.length > this.maxDirectInput) {
      if ($DebugTestMode) {
        console.log("📋 🚨 LARGE CONTENT DETECTED - Preventing default paste");
      }
      e.preventDefault();
      this.handleLargeContent(pastedText);
      return;
    }

    if ($DebugTestMode) {
      console.log("📋 Normal paste - allowing default behavior");
    }
  },

  // ✅ ADD THIS FUNCTION:
  handleLargeContent: function (content) {
    if ($DebugTestMode) {
      console.log("📄 Processing large content:", content.length, "characters");
    }

    // 🆕 Generate unique ID for this attachment
    const attachmentId = `large_content_${++this
      .attachmentCounter}_${Date.now()}`;

    // Detect content type and language
    const contentType = this.detectContentType(content);
    const language = this.detectLanguageFromContent
      ? this.detectLanguageFromContent(content)
      : contentType;
    const filename = this.generateSmartFilename(content, contentType);

    // 🆕 Create attachment object with unique ID
    const attachment = {
      id: attachmentId,
      type: "large_content",
      filename: filename,
      content: content,
      contentType: contentType,
      language: language,
      size: content.length,
      word_count: content.split(/\s+/).filter((w) => w.length > 0).length,
      line_count: content.split("\n").length,
      extension: this.getExtensionFromType(contentType),
      created_at: new Date().toISOString(),
      timestamp: Date.now(),
      is_complete: true,
      is_chunked: false,
      chunk_count: 1,
      total_size: content.length,
    };

    // Initialize attachments array if needed
    if (!this.attachments) {
      this.attachments = [];
    }

    // 🆕 Add to attachments (don't replace)
    this.attachments.push(attachment);
    if ($DebugTestMode) {
      console.log(
        "📄 Added large content attachment, total attachments:",
        this.attachments.length
      );
    }

    // 🆕 Create or update the attachment container
    this.updateAttachmentContainer();

    // 🆕 Add this specific attachment to the container using unified display
    this.addAttachmentToContainer(attachment);

    // 🆕 Update input placeholder
    this.updateInputPlaceholder();
  },

  detectContentType: function (content) {
    if ($DebugTestMode) {
      console.log("🔍 Detecting content type...", content);
    }

    if (content instanceof ArrayBuffer) {
      return "binary";
    }

    // If content is not a string, return unknown type
    if (typeof content !== "string") {
      return "unknown";
    }

    // Try JavaScript first
    if (this.looksLikeJavaScript(content)) {
      if ($DebugTestMode) {
        console.log("🔍 Detected: JavaScript");
      }
      return "javascript";
    }

    // HTML detection
    if (this.looksLikeHTML(content)) {
      if ($DebugTestMode) {
        console.log("🔍 Detected: HTML");
      }
      return "html";
    }

    // CSS detection
    if (this.looksLikeCSS(content)) {
      if ($DebugTestMode) {
        console.log("🔍 Detected: CSS");
      }
      return "css";
    }

    // Python detection
    if (this.looksLikePython(content)) {
      if ($DebugTestMode) {
        console.log("🔍 Detected: Python");
      }
      return "python";
    }

    // JSON detection
    if (this.looksLikeJSON(content)) {
      if ($DebugTestMode) {
        console.log("🔍 Detected: JSON");
      }
      return "json";
    }

    if ($DebugTestMode) {
      console.log("🔍 Detected: Generic document");
    }
    return "document";
  },

  looksLikeJavaScript: function (content) {
    const jsPatterns = [
      /function\s+\w+\s*\(/,
      /const\s+\w+\s*=/,
      /let\s+\w+\s*=/,
      /var\s+\w+\s*=/,
      /=>\s*\{/,
      /console\.log/,
      /document\./,
      /window\./,
      /import\s+.*from/,
      /export\s+/,
      /\.addEventListener/,
      /getElementById/,
    ];

    const matchCount = jsPatterns.filter((pattern) =>
      pattern.test(content)
    ).length;
    return matchCount >= 2; // Need at least 2 JS patterns
  },

  looksLikeHTML: function (content) {
    return (
      /<\/?[a-zA-Z][^>]*>/g.test(content) &&
      (content.includes("<!DOCTYPE") ||
        content.includes("<html") ||
        content.includes("<head") ||
        content.includes("<body"))
    );
  },

  looksLikeCSS: function (content) {
    const cssPatterns = [
      /[.#][\w-]+\s*\{/,
      /\w+\s*:\s*[^;]+;/,
      /@media\s+/,
      /@import\s+/,
      /color\s*:\s*#[0-9a-fA-F]{3,6}/,
    ];

    const matchCount = cssPatterns.filter((pattern) =>
      pattern.test(content)
    ).length;
    return matchCount >= 2;
  },

  looksLikePython: function (content) {
    const pythonPatterns = [
      /^def\s+\w+\s*\(/m,
      /^class\s+\w+/m,
      /^import\s+\w+/m,
      /^from\s+\w+\s+import/m,
      /if\s+__name__\s*==\s*['"']__main__['"']/,
      /print\s*\(/,
    ];

    const matchCount = pythonPatterns.filter((pattern) =>
      pattern.test(content)
    ).length;
    return matchCount >= 2;
  },

  looksLikeJSON: function (content) {
    const trimmed = content.trim();
    if (
      (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
      (trimmed.startsWith("[") && trimmed.endsWith("]"))
    ) {
      try {
        JSON.parse(content);
        return true;
      } catch (e) {
        return false;
      }
    }
    return false;
  },

  getExtensionFromType: function (contentType) {
    const extensions = {
      javascript: ".js",
      html: ".html",
      css: ".css",
      python: ".py",
      json: ".json",
      document: ".txt",
    };
    return extensions[contentType] || ".txt";
  },

  generateSmartFilename: function (content, contentType) {
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, "-");
    const extension = this.getExtensionFromType(contentType);

    // Try to extract meaningful names from content
    let baseName = "pasted_content";

    if (contentType === "javascript") {
      // Look for function names or class names
      const funcMatch = content.match(/function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/);
      const classMatch = content.match(/class\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/);
      if (classMatch) {
        baseName = classMatch[1].toLowerCase();
      } else if (funcMatch) {
        baseName = funcMatch[1].toLowerCase();
      } else {
        baseName = "javascript_code";
      }
    } else if (contentType === "html") {
      const titleMatch = content.match(/<title[^>]*>([^<]*)<\/title>/i);
      if (titleMatch && titleMatch[1].trim()) {
        baseName = titleMatch[1]
          .trim()
          .replace(/[^a-zA-Z0-9\s]/g, "")
          .replace(/\s+/g, "_")
          .toLowerCase();
      } else {
        baseName = "html_document";
      }
    } else if (contentType === "css") {
      baseName = "stylesheet";
    } else if (contentType === "python") {
      baseName = "python_script";
    }

    return `${baseName}_${timestamp}${extension}`;
  },

  handleFileAttachments: function (files) {
    if ($DebugTestMode) {
      console.log("📎 === HANDLING FILE ATTACHMENTS ===");
      console.log("📎 Function called with files:", files);
      console.log(
        "📎 Files is array-like:",
        Array.isArray(files) || (files && typeof files.length === "number")
      );
      console.log("📎 Files length:", files ? files.length : "null");
      console.log("📎 Current attachments array:", this.attachments);
      console.log("📎 Current attachment counter:", this.attachmentCounter);
    }

    if (!files || files.length === 0) {
      if ($DebugTestMode) {
        console.warn("📎 ⚠️ No files provided to handleFileAttachments");
      }
      return;
    }

    // Initialize attachments array if needed
    if (!this.attachments) {
      if ($DebugTestMode) {
        console.log("📎 Initializing attachments array");
      }
      this.attachments = [];
    }

    if ($DebugTestMode) {
      console.log("📎 Processing", files.length, "files...");
    }

    // Process each file
    Array.from(files).forEach((file, index) => {
      if ($DebugTestMode) {
        console.log(`📎 === PROCESSING FILE ${index + 1}/${files.length} ===`);
        console.log(`📎 File name: ${file.name}`);
        console.log(`📎 File size: ${file.size} bytes`);
        console.log(`📎 File type: ${file.type}`);
      }

      // Generate unique ID
      const attachmentId = `file_${++this
        .attachmentCounter}_${Date.now()}_${index}`;
      if ($DebugTestMode) {
        console.log(`📎 Generated attachment ID: ${attachmentId}`);
      }

      try {
        if (this.isImageFile(file)) {
          if ($DebugTestMode) {
            console.log(`📎 File ${index + 1} identified as IMAGE`);
          }
          this.processImageFile(file, attachmentId);
        } else if (this.isTextFile(file)) {
          if ($DebugTestMode) {
            console.log(`📎 File ${index + 1} identified as TEXT`);
          }
          this.processTextFile(file, attachmentId);
        } else if (this.isBinaryFile(file)) {
          if ($DebugTestMode) {
            console.log(`📎 File ${index + 1} identified as Binary`);
          }
          this.processBinaryFileWithMammoth(file, attachmentId);
        } else {
          if ($DebugTestMode) {
            console.log(`📎 File ${index + 1} identified as GENERIC`);
          }
          this.processGenericFile(file, attachmentId);
        }
      } catch (error) {
        if ($DebugTestMode) {
          console.error(`📎 ❌ Error processing file ${file.name}:`, error);
          console.error(`📎 Error stack:`, error.stack);
        }
        this.showErrorNotification(
          `Failed to process ${file.name}: ${error.message}`
        );
      }
    });

    if ($DebugTestMode) {
      console.log("📎 === FILE PROCESSING COMPLETE ===");
      console.log(
        "📎 Total attachments now:",
        this.attachments ? this.attachments.length : 0
      );
    }
  },

  processGenericFile: function (file, attachmentId) {
    if ($DebugTestMode) {
      console.log(`📎 === PROCESSING GENERIC FILE ===`);
      console.log(`📎 File: ${file.name}, ID: ${attachmentId}`);
    }

    // Check if this is a text-readable file that we should try to read as content
    if (this.shouldReadAsText(file)) {
      if ($DebugTestMode) {
        console.log(
          `📎 Generic file appears to be text-readable, processing as text...`
        );
      }
      this.processTextFile(file, attachmentId);
      return;
    }

    // For truly binary files, create a file attachment
    try {
      const attachment = {
        id: attachmentId,
        type: "file",
        filename: file.name,
        size: file.size,
        mimeType: file.type,
        extension: this.getFileExtension(file.name),
        created_at: new Date().toISOString(),
        timestamp: Date.now(),
        originalFile: file,
      };

      if ($DebugTestMode) {
        console.log(`📎 Created generic attachment:`, attachment);
      }
      this.addProcessedAttachment(attachment);
    } catch (error) {
      if ($DebugTestMode) {
        console.error(`📎 ❌ Error creating generic attachment:`, error);
      }
      this.showErrorNotification(`Failed to process file ${file.name}`);
    }
  },

  processTextFile: function (file, attachmentId) {
    if ($DebugTestMode) {
      console.log(`📄 === PROCESSING TEXT FILE ===`, file);
      console.log(`📄 File: ${file.name}, ID: ${attachmentId}`);
    }

    const reader = new FileReader();

    reader.onload = (e) => {
      if ($DebugTestMode) {
        console.log(`📄 FileReader onload triggered for ${file.name}`);
        console.log(`📄 Result type:`, typeof e.target.result);
        console.log(
          `📄 Content length:`,
          e.target.result ? e.target.result.length : 0
        );
      }

      try {
        const content = e.target.result;
        if ($DebugTestMode) {
          console.log(`📄 Content preview:`, content.substring(0, 200) + "...");
        }

        if (content.length > this.maxDirectInput) {
          if ($DebugTestMode) {
            console.log(
              `📄 Large content detected (${content.length} > ${this.maxDirectInput}), creating large content attachment`
            );
          }
          this.handleLargeContentFromFile(file, content, attachmentId);
        } else {
          if ($DebugTestMode) {
            console.log(
              `📄 Normal sized content, creating regular file attachment`
            );
          }
          this.createRegularFileAttachment(file, content, attachmentId);
        }
      } catch (error) {
        if ($DebugTestMode) {
          console.error(`📄 ❌ Error processing text content:`, error);
        }
        this.showErrorNotification(`Failed to process text file ${file.name}`);
      }
    };

    reader.onerror = (e) => {
      if ($DebugTestMode) {
        console.error(`📄 ❌ FileReader error for ${file.name}:`, e);
      }
      this.showErrorNotification(`Failed to read file ${file.name}`);
    };

    if ($DebugTestMode) {
      console.log(`📄 Starting to read file as text...`);
    }
    reader.readAsText(file);
  },

  // Helper function to handle the actual processing
  processBinaryFileWithMammoth: function (file, attachmentId) {
    if ($DebugTestMode) {
      console.log(`🔒 === PROCESSING BINARY FILE ===`, file);
      console.log(`🔒 File: ${file.name}, ID: ${attachmentId}`);
      console.log(`🔒 File type: ${file.type}, Size: ${file.size} bytes`);
      console.log(`🔒 Mammoth available:`, typeof mammoth !== "undefined");
    }

    const reader = new FileReader();

    reader.onload = async (e) => {
      if ($DebugTestMode) {
        console.log(`🔒 FileReader onload triggered for ${file.name}`);
        console.log(`🔒 Result type:`, typeof e.target.result);
        console.log(
          `🔒 Content length:`,
          e.target.result ? e.target.result.byteLength : 0
        );
        console.log(
          `🔒 Is ArrayBuffer:`,
          e.target.result instanceof ArrayBuffer
        );
      }

      try {
        const content = e.target.result;
        if ($DebugTestMode) {
          console.log(`🔒 Binary content loaded successfully`);
          console.log(
            `🔒 First few bytes:`,
            new Uint8Array(content).subarray(0, 16)
          );
        }

        // Check if this is a DOCX file that we can try to extract text from
        const isDocxFile =
          file.type.includes("wordprocessingml.document") ||
          file.name.toLowerCase().endsWith(".docx");

        // Check if this is a PDF file that we can try to extract text from
        const isPdfFile =
          file.type.includes("pdf") || file.name.toLowerCase().endsWith(".pdf");

        // Handle DOCX files with mammoth.js
        if (isDocxFile && typeof mammoth !== "undefined") {
          if ($DebugTestMode) {
            console.log(`🔒 DOCX file detected, attempting text extraction...`);
          }

          try {
            const result = await mammoth.extractRawText({
              arrayBuffer: content,
            });
            const extractedText = result.value;

            if ($DebugTestMode) {
              console.log(`🔒 ✅ Successfully extracted text from DOCX`);
              console.log(`🔒 Extracted text length:`, extractedText.length);
              console.log(
                `🔒 Text preview:`,
                extractedText.substring(0, 200) + "..."
              );
            }

            // Create a text attachment using the existing handleLargeContentFromFile flow
            const textAttachment = {
              id: attachmentId,
              type: "text",
              filename: file.name,
              content: extractedText,
              contentType: "text/plain",
              extension: ".txt",
              language: "text",
              size: extractedText.length,
              line_count: extractedText.split("\n").length,
              word_count: extractedText
                .split(/\s+/)
                .filter((word) => word.length > 0).length,
              created_at: new Date().toISOString(),
              timestamp: Date.now(),
              originalFile: file,
            };

            // Use the existing method to handle this as "large content"
            this.handleLargeContentFromFile(file, extractedText, attachmentId);
            return;
          } catch (docxError) {
            if ($DebugTestMode) {
              console.warn(
                `🔒 ❌ DOCX extraction failed, falling back to binary:`,
                docxError
              );
            }
            // Fall through to normal binary processing
          }
        } else if (isDocxFile && $DebugTestMode) {
          console.log(
            `🔒 DOCX file detected but Mammoth.js not available for text extraction`
          );
        }

        // Handle PDF files with pdf.js (unchanged from original)
        else if (isPdfFile) {
          if ($DebugTestMode) {
            console.log(`🔒 PDF file detected, attempting text extraction...`);
          }

          try {
            // Try to extract text using pdf.js if available
            if (typeof pdfjsLib !== "undefined") {
              // Set up the PDF.js worker
              pdfjsLib.GlobalWorkerOptions.workerSrc =
                "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

              // Load the PDF document
              const pdfDoc = await pdfjsLib.getDocument({ data: content })
                .promise;
              let extractedText = "";

              // Extract text from each page
              for (let i = 1; i <= pdfDoc.numPages; i++) {
                const page = await pdfDoc.getPage(i);
                const textContent = await page.getTextContent();
                const pageText = textContent.items
                  .map((item) => item.str)
                  .join(" ");
                extractedText += pageText + "\n";

                // Limit extraction for very large documents in debug mode
                if ($DebugTestMode && i >= 5) {
                  extractedText += `\n[Content truncated after 5 pages for preview]`;
                  break;
                }
              }

              if ($DebugTestMode) {
                console.log(`🔒 ✅ Successfully extracted text from PDF`);
                console.log(`🔒 Extracted text length:`, extractedText.length);
                console.log(
                  `🔒 Text preview:`,
                  extractedText.substring(0, 200) + "..."
                );
              }

              // Create a text attachment using the existing handleLargeContentFromFile flow
              const textAttachment = {
                id: attachmentId,
                type: "text",
                filename: file.name,
                content: extractedText,
                contentType: "text/plain",
                extension: ".txt",
                language: "text",
                size: extractedText.length,
                line_count: extractedText.split("\n").length,
                word_count: extractedText
                  .split(/\s+/)
                  .filter((word) => word.length > 0).length,
                created_at: new Date().toISOString(),
                timestamp: Date.now(),
                originalFile: file,
              };

              // Use the existing method to handle this as "large content"
              this.handleLargeContentFromFile(
                file,
                extractedText,
                attachmentId
              );
              return;
            } else {
              if ($DebugTestMode) {
                console.log(
                  `🔒 PDF.js not available, falling back to binary processing`
                );
              }
            }
          } catch (pdfError) {
            if ($DebugTestMode) {
              console.warn(
                `🔒 ❌ PDF extraction failed, falling back to binary:`,
                pdfError
              );
            }
            // Fall through to normal binary processing
          }
        }

        // Default binary processing for unsupported files or failed extraction
        if (content.byteLength > this.maxDirectInput) {
          if ($DebugTestMode) {
            console.log(
              `🔒 Large binary content detected (${content.byteLength} > ${this.maxDirectInput}), creating large content attachment`
            );
          }
          this.handleLargeContentFromFile(file, content, attachmentId);
        } else {
          if ($DebugTestMode) {
            console.log(
              `🔒 Normal sized binary content, creating regular file attachment`
            );
          }
          this.createRegularFileAttachment(file, content, attachmentId);
        }
      } catch (error) {
        if ($DebugTestMode) {
          console.error(`🔒 ❌ Error processing binary content:`, error);
        }
        this.showErrorNotification(
          `Failed to process binary file ${file.name}`
        );
      }
    };

    reader.onerror = (e) => {
      if ($DebugTestMode) {
        console.error(`🔒 ❌ FileReader error for ${file.name}:`, e);
      }
      this.showErrorNotification(`Failed to read binary file ${file.name}`);
    };

    if ($DebugTestMode) {
      console.log(`🔒 Starting to read file as ArrayBuffer...`);
    }
    reader.readAsArrayBuffer(file);
  },

  processImageFile: function (file, attachmentId) {
    if ($DebugTestMode) {
      console.log(`🖼️ === PROCESSING IMAGE FILE ===`);
      console.log(`🖼️ File: ${file.name}, ID: ${attachmentId}`);
    }

    const reader = new FileReader();

    reader.onload = (e) => {
      if ($DebugTestMode) {
        console.log(`🖼️ FileReader onload triggered for ${file.name}`);
        console.log(`🖼️ Result type:`, typeof e.target.result);
        console.log(
          `🖼️ Result length:`,
          e.target.result ? e.target.result.length : 0
        );
      }

      try {
        const imageData = e.target.result;

        // Convert to base64 if needed
        let base64Data = imageData;
        if (imageData.startsWith("data:")) {
          base64Data = imageData.split(",")[1];
        }

        if ($DebugTestMode) {
          console.log(`🖼️ Base64 data length:`, base64Data.length);
        }

        const attachment = {
          id: attachmentId,
          type: "image",
          filename: file.name,
          data: imageData, // Keep full data URL
          size: file.size,
          mimeType: file.type,
          created_at: new Date().toISOString(),
          timestamp: Date.now(),
          originalFile: file,
        };

        if ($DebugTestMode) {
          console.log(`🖼️ Created image attachment:`, attachment);
        }
        this.addProcessedAttachment(attachment);
      } catch (error) {
        if ($DebugTestMode) {
          console.error(`🖼️ ❌ Error creating image attachment:`, error);
        }
        this.showErrorNotification(`Failed to process image ${file.name}`);
      }
    };

    reader.onerror = (e) => {
      if ($DebugTestMode) {
        console.error(`🖼️ ❌ FileReader error for ${file.name}:`, e);
      }
      this.showErrorNotification(`Failed to read image ${file.name}`);
    };

    if ($DebugTestMode) {
      console.log(`🖼️ Starting to read file as data URL...`);
    }
    reader.readAsDataURL(file);
  },

  addProcessedAttachment: function (attachment) {
    if ($DebugTestMode) {
      console.log("📎 === ADDING PROCESSED ATTACHMENT ===");
      console.log("📎 Attachment to add:", attachment);
      console.log("📎 Current attachments array before:", this.attachments);
    }

    if (!this.attachments) {
      if ($DebugTestMode) {
        console.log("📎 Creating new attachments array");
      }
      this.attachments = [];
    }

    this.attachments.push(attachment);
    if ($DebugTestMode) {
      console.log("📎 Attachment added to array");
      console.log("📎 New attachments array:", this.attachments);
      console.log("📎 Total attachments:", this.attachments.length);
    }

    if ($DebugTestMode) {
      console.log("📎 Calling updateAttachmentContainer...");
    }
    this.updateAttachmentContainer();

    if ($DebugTestMode) {
      console.log("📎 Calling addAttachmentToContainer...");
    }
    this.addAttachmentToContainer(attachment);

    if ($DebugTestMode) {
      console.log("📎 Calling updateInputPlaceholder...");
    }
    this.updateInputPlaceholder();

    // Ensure container is visible when attachment is added
    const container = document.getElementById("attachmentPreviews");
    if (container) {
      container.style.display = "flex";
    }

    if ($DebugTestMode) {
      console.log("📎 === ATTACHMENT PROCESSING COMPLETE ===");
    }
  },

  createRegularFileAttachment: function (file, content, attachmentId) {
    const attachment = {
      id: attachmentId,
      type: "file",
      filename: file.name,
      content: content,
      size: file.size,
      mimeType: file.type,
      extension: this.getFileExtension(file.name),
      created_at: new Date().toISOString(),
      timestamp: Date.now(),
      originalFile: file,
    };

    this.addProcessedAttachment(attachment);
  },

  handleLargeContentFromFile: function (file, content, attachmentId) {
    if ($DebugTestMode) {
      console.log("Handling large content from file:", file.name);
      console.log("Content called with handleLargeContentFromFile", content);
    }
    // For binary files, don't try to detect content type from the binary data
    let contentType = "binary";
    let language = "binary";

    // Only attempt text-based detection if content is a string
    if (typeof content === "string") {
      contentType = this.detectContentType(content);
      language = this.detectLanguageFromContent
        ? this.detectLanguageFromContent(content)
        : contentType;
    } else if (content instanceof ArrayBuffer) {
      // For binary files, use file extension to determine type
      const extension = this.getFileExtension(file.name).toLowerCase();
      contentType = this.getContentTypeFromExtension(extension);
      language = "binary";
    }

    const attachment = {
      id: attachmentId,
      type: "large_content",
      filename: file.name,
      content: content,
      contentType: contentType,
      language: language,
      size: content.byteLength || content.length,
      word_count:
        typeof content === "string"
          ? content.split(/\s+/).filter((w) => w.length > 0).length
          : 0,
      line_count: typeof content === "string" ? content.split("\n").length : 0,
      extension: this.getFileExtension(file.name),
      created_at: new Date().toISOString(),
      timestamp: Date.now(),
      originalFile: file,
    };

    this.addProcessedAttachment(attachment);
  },

  // Add this helper function to detect content type from file extension
  getContentTypeFromExtension: function (extension) {
    const extensionMap = {
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      doc: "application/msword",
      pdf: "application/pdf",
      xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      xls: "application/vnd.ms-excel",
      pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      ppt: "application/vnd.ms-powerpoint",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      gif: "image/gif",
      zip: "application/zip",
      rar: "application/x-rar-compressed",
    };

    return extensionMap[extension] || "application/octet-stream";
  },

  getFileExtension: function (filename) {
    if (!filename) return "";
    const parts = filename.split(".");
    return parts.length > 1 ? "." + parts[parts.length - 1] : "";
  },
  isTextFile: function (file) {
    const textTypes = [
      "text/",
      "application/json",
      "application/javascript",
      "application/xml",
      "application/xhtml+xml",
      "application/x-httpd-php",
      "application/x-sh",
      "application/x-python-code",
      "application/x-csh",
      "application/x-perl",
      "application/x-ruby",
      "application/x-java-source",
      "application/sql",
      "application/x-sql",
      "application/x-csv",
      "application/x-yaml",
      "application/x-toml",
      "application/rtf", // RTF is often text-based, but can be complex
      // "application/pdf", // REMOVED: Binary format
      "application/x-latex",
      "application/x-tex",
      "application/x-markdown",
      "application/x-typescript",
      "application/x-coffeescript",
      "application/x-scss",
      "application/x-sass",
      "application/x-less",
      "application/x-stylus",
      // "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // REMOVED: This is the DOCX MIME type
    ];

    const textExtensions = [
      // Programming languages
      ".js",
      ".jsx",
      ".ts",
      ".tsx",
      ".coffee",
      ".java",
      ".class",
      ".py",
      ".pyc",
      ".pyo",
      ".pyw",
      ".pyz",
      ".pyzw",
      ".c",
      ".cpp",
      ".cc",
      ".cxx",
      ".h",
      ".hpp",
      ".hh",
      ".cs",
      ".vb",
      ".fs",
      ".fsx",
      ".fsi",
      ".fsproj",
      ".go",
      ".rs",
      ".swift",
      ".kt",
      ".kts",
      ".scala",
      ".php",
      ".php3",
      ".php4",
      ".php5",
      ".phtml",
      ".rb",
      ".erb",
      ".rake",
      ".pl",
      ".pm",
      ".t",
      ".lua",
      ".r",
      ".dart",
      ".elm",
      ".clj",
      ".cljs",
      ".cljc",
      ".edn",
      ".ex",
      ".exs",
      ".ml",
      ".mli",
      ".hs",
      ".lhs",
      ".erl",
      ".hrl",
      ".pro",
      ".asm",

      // Web technologies
      ".html",
      ".htm",
      ".xhtml",
      ".xml",
      ".xsl",
      ".xslt",
      ".css",
      ".scss",
      ".sass",
      ".less",
      ".styl",
      ".vue",
      ".svelte",
      ".astro",

      // Data formats
      ".json",
      ".json5",
      ".jsonl",
      ".jsonc",
      ".yaml",
      ".yml",
      ".toml",
      ".ini",
      ".cfg",
      ".conf",
      ".csv",
      ".tsv",
      ".psv",
      ".xml",
      ".rss",
      ".atom",

      // Documentation
      ".md",
      ".markdown",
      ".rst",
      ".tex",
      ".ltx",
      ".texinfo",
      ".org",
      ".asciidoc",
      ".adoc",
      ".pod",
      ".txt",
      ".text",
      ".rtf", // Caution: RTF can be binary, but is often treated as text
      // ".doc",  // REMOVED: Binary format (older Word)
      // ".docx", // REMOVED: Binary format (ZIP archive)
      // ".odt",  // REMOVED: Binary format (ZIP archive)

      // Scripts and configs
      ".sh",
      ".bash",
      ".zsh",
      ".fish",
      ".csh",
      ".tcsh",
      ".ps1",
      ".psm1",
      ".psd1",
      ".bat",
      ".cmd",
      ".config",
      ".properties",
      ".env",
      ".gitignore",
      ".dockerignore",
      ".editorconfig",
      ".eslintrc",
      ".prettierrc",
      ".babelrc",
      ".npmrc",
      ".yarnrc",

      // Database
      ".sql",
      ".ddl",
      ".dml",
      ".pgsql",
      ".mysql",
      ".plsql",

      // Build and dependency files
      ".xml",
      ".gradle",
      ".pom",
      ".makefile",
      ".mk",
      ".cmake",
      ".gnumakefile",
      ".rake",
      ".gemfile",
      ".cabal",
      ".cargo",
      ".mix",
      ".rebar",
      ".bowerrc",

      // ".pdf", // REMOVED: Binary format

      // Other text-based formats
      ".log",
      ".out",
      ".err",
      ".diff",
      ".patch",
      ".svg", // SVG is XML-based
      ".graphql",
      ".gql",
      ".proto",
      ".thrift",
      ".haml",
      ".pug",
      ".jade",
      ".ejs",
      ".njk",
      ".mustache",
      ".handlebars",
      ".hbs",
    ];

    return (
      textTypes.some((type) => file.type && file.type.startsWith(type)) ||
      textExtensions.some((ext) => file.name.toLowerCase().endsWith(ext))
    );
  },

  isBinaryFile: function (file) {
    const binaryTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // DOCX
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // XLSX
      "application/vnd.openxmlformats-officedocument.presentationml.presentation", // PPTX
      "application/vnd.ms-excel", // XLS
      "application/vnd.ms-powerpoint", // PPT
      "application/msword", // DOC
      "application/vnd.oasis.opendocument.text", // ODT
      "application/vnd.oasis.opendocument.spreadsheet", // ODS
      "application/vnd.oasis.opendocument.presentation", // ODP
      "application/zip",
      "application/x-zip-compressed",
      "application/x-rar-compressed",
      "application/x-tar",
      "application/gzip",
      "application/x-7z-compressed",
      "application/x-bzip2",
      "audio/",
      "font/",
      "application/octet-stream",
      "application/x-msdownload", // EXE files
      "application/x-dosexec", // EXE files
      "application/x-shockwave-flash",
      "application/x-silverlight-app",
      "application/java-archive", // JAR files
      "application/x-apple-diskimage", // DMG files
      "application/vnd.android.package-archive", // APK files
      "application/x-deb", // DEB packages
      "application/x-rpm", // RPM packages
      "application/x-iso9660-image", // ISO files
      "application/x-msi", // MSI installer
      "application/x-pkcs12", // PKCS#12 certificates
      "application/x-pem-file", // PEM certificates
      "application/x-der", // DER certificates
      "application/x-x509-ca-cert", // X509 certificates
      "application/pkix-cert", // PKIX certificates
    ];

    const binaryExtensions = [
      // Document formats
      ".pdf",
      ".doc",
      ".docx",
      ".xls",
      ".xlsx",
      ".ppt",
      ".pptx",
      ".odt",
      ".ods",
      ".odp",
      ".rtf", // Can be binary in some cases

      // Archive formats
      ".zip",
      ".rar",
      ".tar",
      ".gz",
      ".7z",
      ".bz2",
      ".xz",
      ".tgz",
      ".tbz2",

      // Audio formats
      ".mp3",
      ".wav",
      ".flac",
      ".aac",
      ".ogg",
      ".wma",
      ".m4a",
      ".aiff",
      ".ape",
      ".alac",

      // Font formats
      ".ttf",
      ".otf",
      ".woff",
      ".woff2",
      ".eot",

      // Executable and binary files
      ".exe",
      ".dll",
      ".so",
      ".dylib",
      ".bin",
      ".app",
      ".apk",
      ".ipa",
      ".deb",
      ".rpm",
      ".msi",
      ".jar",
      ".war",
      ".ear",
      ".class",

      // Database and data files
      ".mdb",
      ".accdb",
      ".sqlite",
      ".db",
      ".dbf",

      // Virtual machine and disk images
      ".iso",
      ".vmdk",
      ".vdi",
      ".vhd",
      ".vhdx",
      ".dmg",

      // Certificate and security files
      ".pfx",
      ".p12",
      ".pem",
      ".der",
      ".crt",
      ".cer",
      ".key",

      // Other binary formats
      ".chm",
      ".hlp",
      ".cab",
      ".dat",
      ".bin",
    ];

    return (
      binaryTypes.some(
        (type) =>
          file.type &&
          (type.endsWith("/") ? file.type.startsWith(type) : file.type === type)
      ) || binaryExtensions.some((ext) => file.name.toLowerCase().endsWith(ext))
    );
  },

  isImageFile: function (file) {
    return file.type.startsWith("image/");
  },

  getFileIcon: function (attachment) {
    const ext =
      attachment.extension || this.getFileExtension(attachment.filename);

    const iconMap = {
      ".pdf": "📄",
      ".doc": "📝",
      ".docx": "📝",
      ".txt": "📄",
      ".csv": "📊",
      ".json": "🔧",
      ".js": "⚡",
      ".javascript": "⚡",
      ".html": "🌐",
      ".htm": "🌐",
      ".css": "🎨",
      ".py": "🐍",
      ".java": "☕",
      ".cpp": "⚙️",
      ".c": "⚙️",
      ".xml": "📋",
      ".yaml": "📋",
      ".yml": "📋",
      ".md": "📝",
      ".sql": "🗄️",
    };

    if (attachment.type === "image") return "🖼️";

    return iconMap[ext.toLowerCase()] || "📎";
  },
};

// Export for use in main module
if (typeof module !== "undefined" && module.exports) {
  module.exports = chatInputManager;
}
