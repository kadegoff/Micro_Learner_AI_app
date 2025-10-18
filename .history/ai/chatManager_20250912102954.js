// chatManager.js - Enhanced with extensive debugging for file handling
"use strict";

var chatManager = {
  activeEventSource: null,
  streamingFiles: new Map(), // Track files being streamed
  streamingTextBuffer: "", // Buffer for text chunks
  currentStreamMessageId: null,
  streamingEnabled: true,
  abortController: null,
  isProcessing: false,
  inCodeBlock: false,
  pendingTextBeforeCode: "",
  codeBlockState: {
    active: false,
    language: "",
    filename: "",
    content: "",
  },
  aiFilesFromThisResponse: [],
  lastCodeBlockCheckPosition: 0,
  $DebugTestMode: true,
  streamingResponseFiles: [], // Track all files in current streaming response

  // Track originally enabled buttons
  originallyEnabledButtons: [],

  setupRealtimeTokenChecker: async function () {
    const messageInput = document.getElementById("messageInput");
    const tokenLimitIndicator = document.getElementById(
      "token-limit-indicator"
    );

    if (!messageInput || !tokenLimitIndicator) {
      console.error(
        "Required elements for real-time token checker are missing (e.g., #messageInput, #token-limit-indicator)."
      );
      return;
    }

    const TOKEN_LIMIT = 856000;
    const APPROCHING_LIMIT_THRESHOLD = 0.8; // 80%

    const estimateTokens = (text) => Math.ceil((text || "").length / 4);

    const updateTokenCount = async () => {
      const messageText = messageInput.value;
      const contextMessages = await appState.getContextForAI(
        appState.currentConversationId
      );
      // NOTE: Replace with your actual attachment management logic.
      const attachments =
        typeof attachmentManager !== "undefined"
          ? attachmentManager.getStagedAttachments()
          : [];

      let totalTokens = 0;
      totalTokens += estimateTokens(messageText);
      contextMessages.forEach(
        (msg) => (totalTokens += estimateTokens(msg.text))
      );
      attachments.forEach((attachment) => {
        if (attachment.type === "large_content" && attachment.content) {
          totalTokens += estimateTokens(attachment.content);
        }
      });

      const sendButton = document.getElementById("sendButton");
      if (totalTokens > TOKEN_LIMIT) {
        const percentageOver = (
          ((totalTokens - TOKEN_LIMIT) / TOKEN_LIMIT) *
          100
        ).toFixed(1);
        tokenLimitIndicator.innerHTML = `<span style="color: #D32F2F; font-weight: bold;">⚠️ Limit exceeded by ${percentageOver}%</span>`;
        tokenLimitIndicator.style.display = "block";
        if (sendButton) sendButton.disabled = true;
      } else if (totalTokens >= TOKEN_LIMIT * APPROCHING_LIMIT_THRESHOLD) {
        const percentageUsed = ((totalTokens / TOKEN_LIMIT) * 100).toFixed(1);
        tokenLimitIndicator.innerHTML = `<span style="color: #F57C00;">${percentageUsed}% of context limit used</span>`;
        tokenLimitIndicator.style.display = "block";
        if (sendButton) sendButton.disabled = false;
      } else {
        tokenLimitIndicator.style.display = "none";
        if (sendButton) sendButton.disabled = false;
      }
    };

    messageInput.addEventListener("input", updateTokenCount);
    console.log("✅ Real-time token checker has been activated.");
  },

  // Add detailed file debugging
  debugFileState: function (context = "") {
    console.log(`🔍 === FILE STATE DEBUG [${context}] ===`);
    console.log(`🔍 streamingFiles.size:`, this.streamingFiles.size);
    console.log(
      `🔍 streamingResponseFiles.length:`,
      this.streamingResponseFiles.length
    );
    console.log(`🔍 currentStreamMessageId:`, this.currentStreamMessageId);

    // Log all streaming files
    if (this.streamingFiles.size > 0) {
      console.log(`🔍 === STREAMING FILES MAP ===`);
      for (const [key, file] of this.streamingFiles.entries()) {
        console.log(`🔍 Key: ${key}`);
        console.log(`🔍   - filename: ${file.filename}`);
        console.log(`🔍   - extension: ${file.extension}`);
        console.log(`🔍   - content length: ${file.content?.length || 0}`);
        console.log(`🔍   - element exists: ${!!file.element}`);
        console.log(`🔍   - isStreaming: ${file.isStreaming}`);
      }
    }

    // Log streaming response files
    if (this.streamingResponseFiles.length > 0) {
      console.log(`🔍 === STREAMING RESPONSE FILES ===`);
      this.streamingResponseFiles.forEach((file, index) => {
        console.log(`🔍 File ${index + 1}:`);
        console.log(`🔍   - id: ${file.id}`);
        console.log(`🔍   - filename: ${file.filename}`);
        console.log(`🔍   - extension: ${file.extension}`);
        console.log(`🔍   - content length: ${file.content?.length || 0}`);
      });
    }

    // Check DOM elements
    const message = document.getElementById(this.currentStreamMessageId);
    if (message) {
      const filesContainer = message.querySelector(".message-files");
      const fileBlocks = message.querySelectorAll(".file-block");
      console.log(`🔍 DOM: filesContainer exists: ${!!filesContainer}`);
      console.log(`🔍 DOM: fileBlocks count: ${fileBlocks.length}`);

      fileBlocks.forEach((block, index) => {
        console.log(
          `🔍 DOM Block ${index + 1}: id=${block.id}, visible=${
            block.style.display !== "none"
          }`
        );
      });
    }
    console.log(`🔍 === END FILE STATE DEBUG ===`);
  },
  getParentMessageId: function (currentMessageId) {
    console.log("🔍 === GET PARENT MESSAGE ID WITH VERSION ===");
    console.log("🔍 Current message ID:", currentMessageId);

    console.log(document.getElementById("aiContent"));

    try {
      // Get all message elements from the DOM
      const allMessages = document.querySelectorAll("[data-message-id]");
      console.log(`🔍 📄 Found ${allMessages.length} messages in DOM`);

      // Convert to array and find current message
      const messageArray = Array.from(allMessages);
      const currentMessageIndex = messageArray.findIndex(
        (el) => el.getAttribute("data-message-id") === currentMessageId
      );

      if (currentMessageIndex === -1) {
        console.warn(
          `🔍 📄 ❌ Current message ${currentMessageId} not found in DOM`
        );
        return null;
      }

      console.log(
        `🔍 📄 Current message found at index ${currentMessageIndex}`
      );

      // Determine message type from DOM
      const currentElement = messageArray[currentMessageIndex];
      const isUserMessage = currentElement.classList.contains("user-message");
      const isAiMessage =
        currentElement.classList.contains("ai-response") ||
        currentElement.classList.contains("ai-message");

      console.log(
        `🔍 📄 Current message type: ${
          isUserMessage ? "user" : isAiMessage ? "ai" : "unknown"
        }`
      );

      // Helper function to check if a message element is visible/displayed
      const isMessageVisible = (element) => {
        const messageId = element.getAttribute("data-message-id");
        const computedStyle = window.getComputedStyle(element);
        const isDisplayNone = computedStyle.display === "none";
        const isVisibilityHidden = computedStyle.visibility === "hidden";
        const isHidden = isDisplayNone || isVisibilityHidden;

        console.log(
          `🔍 👁️ Message ${messageId} visibility check:`,
          `display: "${computedStyle.display}", visibility: "${computedStyle.visibility}", hidden: ${isHidden}`
        );

        return !isHidden;
      };

      // Helper function to get the display version of a message FROM DOM ONLY
      const getMessageVersion = (element) => {
        console.log(`🔍 📊 Getting display version for element`, element);

        // Use the passed element instead of document.getElementById
        const dataVersion = element.getAttribute("data-version");
        if (dataVersion) {
          const version = parseInt(dataVersion);
          if (!isNaN(version)) {
            console.log(`🔍 📊 DOM data-version: ${version}`);
            return version;
          }
        }

        // Rest of the function remains the same...
        const versionNav = element.querySelector(".version-nav");
        if (versionNav) {
          const currentVersionSpan =
            versionNav.querySelector(".version-indicator");
          if (currentVersionSpan) {
            const versionText = currentVersionSpan.textContent; // e.g., "2/3"
            const currentVersion = parseInt(versionText.split("/")[0]);
            if (!isNaN(currentVersion)) {
              console.log(`🔍 📊 DOM navigation version: ${currentVersion}`);
              return currentVersion;
            }
          }
        }

        console.log("🔍 📊 No version found in DOM, defaulting to 1");
        return 1;
      };

      // Helper function to create versioned message ID
      const createVersionedId = (baseMessageId, version) => {
        const versionedId = `${baseMessageId}.v${version}`;
        console.log(`🔍 🏷️ Created versioned ID: ${versionedId}`);
        return versionedId;
      };

      // For AI messages, find the most recent VISIBLE user message
      if (isAiMessage) {
        console.log("🔍 📄 Looking for parent user message (visible only)...");

        // Go backwards from the current AI message to find the most recent visible user message
        for (let i = currentMessageIndex - 1; i >= 0; i--) {
          const element = messageArray[i];

          if (element.classList.contains("user-message")) {
            const messageId = element.getAttribute("data-message-id");
            console.log(
              `🔍 📄 Checking user message: ${messageId} at index ${i}`
            );

            // CHECK IF THIS MESSAGE IS ACTUALLY VISIBLE
            if (isMessageVisible(element)) {
              console.log(`🔍 📄 ✅ Found visible user message: ${messageId}`);

              // Get the display version of the parent message FROM DOM - FIXED: pass element instead of messageId
              const parentVersion = getMessageVersion(element);

              // Create versioned parent ID
              const versionedParentId = createVersionedId(
                messageId,
                parentVersion
              );

              console.log(
                `🔍 📄 ✅ Final parent with version: ${versionedParentId}`
              );
              return versionedParentId;
            } else {
              console.log(
                `🔍 📄 ❌ User message ${messageId} is hidden (display:none), skipping`
              );
            }
          }
        }

        console.log(
          "🔍 📄 No visible parent user message found for AI message"
        );
        return null;
      }

      // For user messages, find the previous VISIBLE USER message only (skip AI messages)
      if (isUserMessage) {
        console.log("🔍 📄 Looking for previous visible user message...");

        // Look through DOM for previous VISIBLE user message
        for (let i = currentMessageIndex - 1; i >= 0; i--) {
          const prevElement = messageArray[i];
          if (prevElement.classList.contains("user-message")) {
            const parentId = prevElement.getAttribute("data-message-id");
            console.log(
              `🔍 📄 Found potential parent user message: ${parentId} at index ${i}`
            );

            // CHECK IF THIS USER MESSAGE IS VISIBLE
            if (isMessageVisible(prevElement)) {
              console.log(
                `🔍 📄 ✅ Found visible parent user message: ${parentId}`
              );

              // Get the display version of the parent message FROM DOM - FIXED: pass element instead of messageId
              const parentVersion = getMessageVersion(prevElement);

              // Create versioned parent ID
              const versionedParentId = createVersionedId(
                parentId,
                parentVersion
              );

              console.log(
                `🔍 📄 ✅ Final parent with version: ${versionedParentId}`
              );
              return versionedParentId;
            } else {
              console.log(
                `🔍 📄 ❌ User message ${parentId} is hidden (display:none), skipping`
              );
            }
          }
        }
        console.log("🔍 📄 No visible previous user message found");
        return null;
      }

      console.log("🔍 📄 ❌ Unknown message type, cannot determine parent");
      return null;
    } catch (error) {
      console.error("🔍 📄 ❌ Error parsing DOM:", error);
      console.error("🔍 📄 Error details:", error.stack);
      return null;
    }
  },

  addVersionNavToPreviousMessages: function (messageId, notVersionId) {
    console.log("🔄 === ADD VERSION NAV TO PREVIOUS MESSAGES ===");
    console.log("🔄 Target message ID:", messageId);
    console.log("🔄 Excluding version ID:", notVersionId);

    // Find all DOM elements with the specified message ID
    const allMessageElements = document.querySelectorAll(
      `[data-message-id="${messageId}"]`
    );
    console.log("🔄 Found message elements:", allMessageElements.length);

    // Get all versions from conversation history for version counting
    const currentConversation = messageManager.getCurrentConversation();
    const allVersions = currentConversation.filter(
      (msg) => msg.id === messageId
    );
    const totalVersions =
      allVersions.length > 0
        ? Math.max(...allVersions.map((msg) => msg.version || 1))
        : 1;

    console.log("🔄 Total versions available:", totalVersions);

    // Process each message element
    allMessageElements.forEach((messageElement, index) => {
      const elementVersion = messageElement.getAttribute("data-version");
      console.log(
        `🔄 Processing element ${index + 1}: version ${elementVersion}`
      );

      // Skip if this is the version we want to exclude
      if (elementVersion === String(notVersionId)) {
        console.log(`🔄 Skipping excluded version: ${elementVersion}`);
        return;
      }

      // Only proceed if we have multiple versions
      if (totalVersions <= 1) {
        console.log("🔄 Only 1 version total, no version nav needed");
        return;
      }

      // Find the message footer in this element
      const messageFooter = messageElement.querySelector(".message-footer");
      if (!messageFooter) {
        console.log(`🔄 No footer found in element version ${elementVersion}`);
        return;
      }

      // Check if version nav already exists
      const existingVersionNav = messageFooter.querySelector(".version-nav");
      if (existingVersionNav) {
        console.log(
          `🔄 Version nav already exists in version ${elementVersion}, removing old one`
        );
        existingVersionNav.remove();
      }

      // Create version navigation HTML using the existing function
      const currentVersion = parseInt(elementVersion) || 1;
      const versionNavHTML = messageManager.createVersionNav(
        messageId,
        currentVersion,
        totalVersions
      );

      if (versionNavHTML && versionNavHTML.trim() !== "") {
        console.log(`🔄 ✅ Adding version nav to version ${elementVersion}`);

        // Append the version navigation to the footer
        messageFooter.insertAdjacentHTML("beforeend", versionNavHTML);
      } else {
        console.log(
          `🔄 No version nav HTML generated for version ${elementVersion}`
        );
      }
    });

    console.log("🔄 ✅ === ADD VERSION NAV COMPLETED ===");
  },

  // Handle JSON-wrapped file updates (add this to chatManager.js)
  processFileUpdate: function (fileData, originalJSON) {
    console.log("🔄 === PROCESSING FILE UPDATE ===");
    console.log("🔄 Update type:", fileData.update_type);
    console.log("🔄 Target filename:", fileData.filename);

    if (fileData.update_type === "partial") {
      return this.handlePartialFileUpdate(fileData, originalJSON);
    } else {
      // Handle full file updates as before
      return this.processJSONWrappedFile(fileData, originalJSON);
    }
  },

  handlePartialFileUpdate: function (updateData, originalJSON) {
    console.log("🔄 === HANDLING PARTIAL FILE UPDATE ===");
    console.log("🔄 Update data:", updateData);
    console.log("🔄 Filename:", updateData.filename);

    if (!updateData.filename) {
      console.error("🔄 ❌ No filename in update data");
      return;
    }

    // Find existing file by filename in current streaming response
    const existingFile = this.findExistingFileInCurrentResponse(
      updateData.filename
    );

    if (!existingFile) {
      console.error(
        "🔄 ❌ Cannot find existing file to update:",
        updateData.filename
      );
      console.log(
        "🔄 Available streaming files:",
        this.streamingResponseFiles.map((f) => f.filename)
      );
      return;
    }

    console.log("🔄 ✅ Found existing file to update:", {
      id: existingFile.id,
      filename: existingFile.filename,
      currentContentLength: existingFile.content
        ? existingFile.content.length
        : 0,
      source: existingFile.source,
    });

    // Apply the updates using section-based updating
    const updatedContent = this.applyPartialUpdates(existingFile, updateData);

    if (!updatedContent) {
      console.error("🔄 ❌ Failed to apply updates");
      return;
    }

    // Create new file entry for the updated version
    const updatedFileId = `updated_${existingFile.id}_${Date.now()}`;
    const updatedFile = {
      id: updatedFileId,
      filename: updateData.filename,
      content: updatedContent,
      extension: existingFile.extension,
      language: existingFile.language,
      type: existingFile.type,
      size: updatedContent.length,
      is_executable: existingFile.is_executable,
      mime_type: existingFile.mime_type,
      originalFileId: existingFile.id,
      isUpdate: true,
      updateType: "partial",
      updateData: updateData,
      originalJSON: originalJSON,
      metadata: {
        ...existingFile.metadata,
        lastUpdate: new Date().toISOString(),
        updateSummary: this.generateUpdateSummary(updateData),
      },
    };

    // Add to streaming response files
    this.streamingResponseFiles.push(updatedFile);

    // Create and display the updated file block
    this.createAndDisplayUpdatedFile(updatedFile);

    console.log("🔄 ✅ Partial update applied and displayed");
  },
  findExistingFile: function (filename) {
    // Search in streamingResponseFiles
    let file = this.streamingResponseFiles.find((f) => f.filename === filename);
    if (file) return file;

    // Search in streamingFiles map
    for (const [key, streamingFile] of this.streamingFiles.entries()) {
      if (streamingFile.filename === filename) {
        return streamingFile;
      }
    }

    return null;
  },

  displayFileUpdateSections: function (file, updateInfo) {
    console.log("🔄 Displaying update sections for:", file.filename);

    const fileElement =
      file.element || document.getElementById(`block_${file.id}`);
    if (!fileElement) {
      console.error("🔄 No file element found for:", file.filename);
      return;
    }

    // Find or create updates container
    let updatesContainer = fileElement.querySelector(".file-updates");
    if (!updatesContainer) {
      updatesContainer = document.createElement("div");
      updatesContainer.className = "file-updates";
      updatesContainer.style.cssText = `
      margin-top: 15px;
      border-top: 1px solid #e0e0e0;
      padding-top: 15px;
    `;
      fileElement.appendChild(updatesContainer);
    }

    // Create update section HTML
    const updateHtml = this.createUpdateSectionHTML(updateInfo);
    updatesContainer.insertAdjacentHTML("beforeend", updateHtml);

    // Add apply/preview buttons to file header if not already there
    this.addUpdateControlsToFileHeader(fileElement, file);
  },

  createUpdateSectionHTML: function (updateInfo) {
    const { sections_modified, sections_added } = updateInfo;
    let html = `<div class="update-section" data-timestamp="${updateInfo.timestamp}">`;

    html += `<div class="update-header">
    <span class="update-badge">📝 Update Available</span>
    <span class="update-time">${new Date(
      updateInfo.timestamp
    ).toLocaleTimeString()}</span>
  </div>`;

    // Show modified sections
    if (Object.keys(sections_modified).length > 0) {
      html += `<div class="modified-sections">
      <h5>📝 Modified Sections:</h5>`;

      for (const [sectionName, sectionData] of Object.entries(
        sections_modified
      )) {
        html += `
        <div class="section-change">
          <div class="section-info">
            <strong>${sectionName}</strong> 
            <span class="section-type">(${sectionData.type})</span>
          </div>
          <div class="change-summary">${sectionData.change_summary}</div>
          <div class="section-preview">
            <code class="section-code">${this.escapeHtml(
              sectionData.content.substring(0, 150)
            )}${sectionData.content.length > 150 ? "..." : ""}</code>
          </div>
        </div>
      `;
      }
      html += `</div>`;
    }

    // Show added sections
    if (Object.keys(sections_added).length > 0) {
      html += `<div class="added-sections">
      <h5>➕ New Sections:</h5>`;

      for (const [sectionName, sectionData] of Object.entries(sections_added)) {
        html += `
        <div class="section-change new">
          <div class="section-info">
            <strong>${sectionName}</strong> 
            <span class="section-type">(${sectionData.type})</span>
          </div>
          <div class="change-summary">${sectionData.change_summary}</div>
          <div class="section-preview">
            <code class="section-code">${this.escapeHtml(
              sectionData.content.substring(0, 150)
            )}${sectionData.content.length > 150 ? "..." : ""}</code>
          </div>
        </div>
      `;
      }
      html += `</div>`;
    }

    html += `</div>`;
    return html;
  },

  addUpdateControlsToFileHeader: function (fileElement, file) {
    const actionsContainer = fileElement.querySelector(".block-actions");
    if (!actionsContainer) return;

    // Check if controls already exist
    if (actionsContainer.querySelector(".update-controls")) return;

    const updateControls = document.createElement("div");
    updateControls.className = "update-controls";
    updateControls.style.cssText =
      "margin-left: 10px; display: inline-flex; gap: 5px;";

    updateControls.innerHTML = `
    <button class="block-btn update-btn" data-action="preview-updates" data-file-id="${file.id}" 
            style="background: #e3f2fd; border-color: #2196f3; color: #1976d2;">
      👁️ Preview Updates
    </button>
    <button class="block-btn apply-btn" data-action="apply-updates" data-file-id="${file.id}"
            style="background: #e8f5e8; border-color: #4caf50; color: #2e7d32;">
      ✅ Apply Updates
    </button>
  `;

    actionsContainer.appendChild(updateControls);
  },
  // Handle preview and apply updates actions
  handleUpdateAction: function (action, fileId) {
    console.log("🔄 Update action:", action, "for file:", fileId);

    const file = this.findFileForUpdates(fileId);
    if (!file || !file.updateSections) {
      console.error("🔄 No file or updates found for:", fileId);
      return;
    }

    switch (action) {
      case "preview-updates":
        this.previewFileWithUpdates(file);
        break;
      case "apply-updates":
        this.applyFileUpdates(file);
        break;
    }
  },

  findFileForUpdates: function (fileId) {
    // Check chatManager streaming files first
    if (chatManager.streamingFiles) {
      for (const [key, file] of chatManager.streamingFiles.entries()) {
        if (file.id === fileId || file.backendId === fileId) {
          return file;
        }
      }
    }

    // Check streamingResponseFiles
    if (chatManager.streamingResponseFiles) {
      const file = chatManager.streamingResponseFiles.find(
        (f) => f.id === fileId
      );
      if (file) return file;
    }

    // Check contentManager blocks
    const block = this.blocks.get(fileId);
    return block;
  },

  previewFileWithUpdates: function (file) {
    console.log("🔄 Previewing file with updates:", file.filename);

    // Create merged content for preview
    const mergedContent = this.mergeFileUpdates(file, false); // false = don't apply permanently

    // Create temporary file object for preview
    const previewFile = {
      ...file,
      content: mergedContent,
      isPreview: true,
      originalContent: file.content, // Keep original
      hasUpdates: true,
    };

    // Create enhanced fullscreen preview with version switcher
    this.createVersionComparisonPreview(previewFile);
  },

  mergeFileUpdates: function (file, applyPermanently = false) {
    console.log("🔄 Merging updates for:", file.filename);

    if (!file.updateSections || file.updateSections.length === 0) {
      return file.content;
    }

    let mergedContent = file.content || file.originalContent || "";

    // Apply each update in chronological order
    for (const updateInfo of file.updateSections) {
      mergedContent = this.applySectionUpdates(
        mergedContent,
        updateInfo.updateData
      );
    }

    if (applyPermanently) {
      file.content = mergedContent;
      file.originalContent = mergedContent;
      file.updateSections = []; // Clear applied updates
    }

    return mergedContent;
  },

  applySectionUpdates: function (currentContent, updateData) {
    console.log("🔄 Applying section updates to content");

    const { sections_modified, sections_added } = updateData;
    let updatedContent = currentContent;

    // For CSS/JS files, we need to be smart about section replacement
    if (updateData.filename.endsWith(".css")) {
      updatedContent = this.applyCSSUpdates(
        currentContent,
        sections_modified,
        sections_added
      );
    } else if (updateData.filename.endsWith(".js")) {
      updatedContent = this.applyJSUpdates(
        currentContent,
        sections_modified,
        sections_added
      );
    } else if (updateData.filename.endsWith(".html")) {
      updatedContent = this.applyHTMLUpdates(
        currentContent,
        sections_modified,
        sections_added
      );
    } else {
      // Generic text replacement
      updatedContent = this.applyGenericUpdates(
        currentContent,
        sections_modified,
        sections_added
      );
    }

    return updatedContent;
  },

  applyCSSUpdates: function (content, modified, added) {
    let result = content;

    // Apply modified sections
    for (const [sectionName, sectionData] of Object.entries(modified || {})) {
      // For CSS, try to replace similar content or append
      if (sectionName.includes("base_styles")) {
        // Replace body and header styles
        result = result.replace(
          /body\s*{[^}]*}/s,
          sectionData.content.match(/body\s*{[^}]*}/s)?.[0] || ""
        );
        result = result.replace(
          /header\s*{[^}]*}/s,
          sectionData.content.match(/header\s*{[^}]*}/s)?.[0] || ""
        );
      } else {
        // Append new content
        result += "\n\n" + sectionData.content;
      }
    }

    // Apply added sections
    for (const [sectionName, sectionData] of Object.entries(added || {})) {
      result += "\n\n/* " + sectionName + " */\n" + sectionData.content;
    }

    return result;
  },

  applyJSUpdates: function (content, modified, added) {
    let result = content;

    // Apply modified sections
    for (const [sectionName, sectionData] of Object.entries(modified || {})) {
      if (sectionName.includes("counter")) {
        // Replace the counter function
        result = sectionData.content;
      } else {
        result += "\n\n" + sectionData.content;
      }
    }

    // Apply added sections
    for (const [sectionName, sectionData] of Object.entries(added || {})) {
      result += "\n\n// " + sectionName + "\n" + sectionData.content;
    }

    return result;
  },

  applyHTMLUpdates: function (content, modified, added) {
    let result = content;

    // Apply modified sections
    for (const [sectionName, sectionData] of Object.entries(modified || {})) {
      if (sectionName.includes("body")) {
        // Replace body content
        result = result.replace(/<body>[\s\S]*<\/body>/i, sectionData.content);
      } else {
        // Append or replace other sections
        result += "\n" + sectionData.content;
      }
    }

    // Apply added sections
    for (const [sectionName, sectionData] of Object.entries(added || {})) {
      // Insert before closing body or append
      if (result.includes("</body>")) {
        result = result.replace("</body>", sectionData.content + "\n</body>");
      } else {
        result += "\n" + sectionData.content;
      }
    }

    return result;
  },

  applyGenericUpdates: function (content, modified, added) {
    let result = content;

    // Simply append modified and added sections
    for (const [sectionName, sectionData] of Object.entries(modified || {})) {
      result += "\n\n// Modified: " + sectionName + "\n" + sectionData.content;
    }

    for (const [sectionName, sectionData] of Object.entries(added || {})) {
      result += "\n\n// Added: " + sectionName + "\n" + sectionData.content;
    }

    return result;
  },

  createVersionComparisonPreview: function (file) {
    console.log("🔄 Creating version comparison preview for:", file.filename);

    const overlay = document.createElement("div");
    overlay.className = "fullscreen-preview version-preview";

    overlay.innerHTML = `
    <div class="preview-header">
      <span class="preview-title">${this.escapeHtml(
        file.filename
      )} - Version Comparison</span>
      <div class="preview-controls">
        <div class="version-switcher">
          <button class="version-btn active" data-version="original">📄 Original</button>
          <button class="version-btn" data-version="updated">✨ With Updates</button>
        </div>
        <button class="preview-btn apply-updates-btn">✅ Apply Updates</button>
        <button class="preview-btn close-preview">✕ Close</button>
      </div>
    </div>
    <div class="preview-content-container">
      <div class="version-content original-content">
        <div class="code-view" style="background: #1e1e1e; color: #d4d4d4; padding: 20px; height: 100%; overflow: auto;">
          <pre><code class="language-${
            file.language || "text"
          }">${this.escapeHtml(
      file.originalContent || file.content
    )}</code></pre>
        </div>
      </div>
      <div class="version-content updated-content" style="display: none;">
        <div class="code-view" style="background: #1e1e1e; color: #d4d4d4; padding: 20px; height: 100%; overflow: auto;">
          <pre><code class="language-${
            file.language || "text"
          }">${this.escapeHtml(file.content)}</code></pre>
        </div>
      </div>
    </div>
  `;

    document.body.appendChild(overlay);
    document.body.classList.add("preview-open");

    overlay.querySelectorAll("pre code").forEach((block) => {
      console.log("highlighting code element number 7");
      this.highlightElementCode(block);
    });

    this.setupVersionSwitcher(overlay, file);
  },

  setupVersionSwitcher: function (overlay, file) {
    const versionButtons = overlay.querySelectorAll(".version-btn");
    const originalContent = overlay.querySelector(".original-content");
    const updatedContent = overlay.querySelector(".updated-content");
    const applyButton = overlay.querySelector(".apply-updates-btn");
    const closeButton = overlay.querySelector(".close-preview");

    versionButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const version = btn.dataset.version;

        // Update button states
        versionButtons.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");

        // Show appropriate content
        if (version === "original") {
          originalContent.style.display = "block";
          updatedContent.style.display = "none";
        } else {
          originalContent.style.display = "none";
          updatedContent.style.display = "block";
        }
      });
    });

    applyButton.addEventListener("click", () => {
      this.applyFileUpdates(file);
      overlay.remove();
      document.body.classList.remove("preview-open");
    });

    closeButton.addEventListener("click", () => {
      overlay.remove();
      document.body.classList.remove("preview-open");
    });
  },

  applyFileUpdates: function (file) {
    console.log("🔄 Applying updates permanently to:", file.filename);

    // Merge updates permanently
    const mergedContent = this.mergeFileUpdates(file, true);

    // Update file element display
    this.updateFileElementAfterApply(file);

    // Update contentManager block if it exists
    const blockId = file.id.startsWith("file_") ? file.id : `file_${file.id}`;
    const block = this.blocks.get(blockId);
    if (block) {
      block.content = mergedContent;
      block.originalContent = mergedContent;
      block.size = mergedContent.length;
      block.wordCount = mergedContent.split(/\s+/).length;
    }

    console.log("🔄 ✅ Updates applied successfully");
  },

  updateFileElementAfterApply: function (file) {
    const fileElement =
      file.element || document.getElementById(`block_${file.id}`);
    if (!fileElement) return;

    // Remove update sections
    const updatesContainer = fileElement.querySelector(".file-updates");
    if (updatesContainer) {
      updatesContainer.remove();
    }

    // Remove update controls
    const updateControls = fileElement.querySelector(".update-controls");
    if (updateControls) {
      updateControls.remove();
    }

    // Update code display with new content
    const codeElement = fileElement.querySelector("code");
    if (codeElement) {
      codeElement.textContent = file.content;
      console.log("highlighting code element number 8");
      this.highlightElementCode(codeElement);
    }
  },
  addUpdateAnimation: function (filename, sectionName) {
    setTimeout(() => {
      const element = document.querySelector(
        `[data-file="${filename}"] [data-section="${sectionName}"]`
      );
      if (element) {
        element.classList.add("section-updating");
        setTimeout(() => element.classList.remove("section-updating"), 1000);
      }
    }, 300);
  },

  addNewElementAnimation: function (filename, sectionName) {
    setTimeout(() => {
      const element = document.querySelector(
        `[data-file="${filename}"] [data-section="${sectionName}"]`
      );
      if (element) {
        element.classList.add("new-element");
        setTimeout(() => element.classList.remove("new-element"), 1000);
      }
    }, 300);
  },
  isNearBottom: function (element, threshold = 100) {
    if (!element) return false;
    const scrollPosition = element.scrollTop + element.clientHeight;
    const scrollHeight = element.scrollHeight;
    return scrollPosition >= scrollHeight - threshold;
  },

  checkAndClearForFirstMessage: function () {
    if ($DebugTestMode) {
      console.log("🔍 === CHECKING FOR WELCOME HEADER ===");
    }

    const aiContent = document.getElementById("aiContent");
    if (aiContent) {
      const welcomeHeader = aiContent.querySelector(".welcome-header");
      if (welcomeHeader) {
        welcomeHeader.remove();
        if ($DebugTestMode) {
          console.log("🧹 Welcome header removed");
        }
        return true;
      }
    }

    if ($DebugTestMode) {
      console.log("🔍 No welcome header found to remove");
    }

    return false;
  },

  sendMessage: async function (
    messageText,
    attachments = [],
    version = 1,
    isEditedMessage = false,
    updateMessageId = null
  ) {
    if (chatManager.currentStreamMessageId) {
      console.log("🧭 ❌ Cannot send message while processing a message");
      return;
    }
    console.log("setProcessingState CALLED 2");
    this.setProcessingState(false);
    console.log("🔄 === CHAT MANAGER SEND MESSAGE (ENHANCED DEBUG) ===");
    console.log("🔄 🎯 ENTRY POINT - Function called");
    console.log("🔄 🎯 Timestamp:", new Date().toISOString());

    console.log("🔄 📋 PARAMETERS:");
    console.log("🔄 📋 Message text length:", messageText?.length || 0);
    console.log("🔄 📋 Message text preview:", messageText?.substring(0, 100));
    console.log("🔄 📋 Attachments count:", attachments?.length || 0);
    console.log("🔄 📋 Skip user message:", isEditedMessage);

    // **CRITICAL FIX: Filter out undefined/null attachments at the very beginning**
    const validAttachments = attachments ? attachments.filter(Boolean) : [];
    console.log("🔄 📋 Valid attachments count:", validAttachments.length);

    const currentConversation = messageManager.getCurrentConversation();
    if (this.isProcessing) {
      console.log("🔄 ⚠️ EARLY EXIT: Already processing a message");
      return;
    }

    const authResult = authManager.checkAuthFromStorage();
    if (!authResult) {
      console.log(
        "🔄 ❌ AUTH FAILURE: Not authenticated, redirecting to sign in"
      );
      handleSignIn();
      return;
    }
    // Conversation ID
    if (!appState.currentConversationId) {
      appState.currentConversationId =
        "conv_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
      console.log(
        "🔄 🚀 Created conversation ID:",
        appState.currentConversationId
      );
    }
    const currentDisplayingVersion = this.getCurrentDisplayingVersion();
    this.currentSendContext = {
      displayingVersion: currentDisplayingVersion,
      timestamp: new Date().toISOString(),
      isEdit: !!isEditedMessage,
    };

    const clearResult = this.checkAndClearForFirstMessage();
    console.log("🔄 🧹 Clear result:", clearResult);
    if (isEditedMessage) {
      console.log("🔄 ⏭️ SKIPPING CLEAR (this is an edit)");

      // Cancel any existing edit mode
      messageManager.cancelEdit(updateMessageId);

      const oldMessageElements = document.querySelectorAll(
        `[id="${updateMessageId}"][data-version]:not([data-version="${version}"])`
      );

      console.log(
        "🔍 DEBUG: Found old message elements:",
        oldMessageElements.length
      );

      oldMessageElements.forEach((element, index) => {
        console.log(`🔍 DEBUG: Hiding element ${index + 1}:`, {
          id: element.id,
          dataVersion: element.getAttribute("data-version"),
          tagName: element.tagName,
        });
        element.style.display = "none";
      });
    }

    this.checkMessageLength(messageText);
    console.log("setProcessingState CALLED 1");
    this.setProcessingState(true);
    this.abortController = new AbortController();

    // Process attachments
    let finalMessage = messageText;
    let processedAttachments = [];

    // **FIX: Use validAttachments instead of filtering again**
    if (validAttachments && validAttachments.length > 0) {
      console.log("🔄 📎 Processing", validAttachments.length, "attachments");

      // **FIX: Use the sanitized 'validAttachments' array for the map operation.**
      processedAttachments = validAttachments.map((attachment, index) => {
        console.log(`🔄 📎 Processing attachment ${index + 1}:`, {
          type: attachment.type,
          filename: attachment.filename,
        });

        if (attachment.type === "large_content") {
          console.log(
            `🔄 📎 Large content attachment detected:`,
            attachment.filename
          );
          /*
          finalMessage += `\n\n--- Document ${index + 1}: ${attachment.filename} ---\n`;
          finalMessage += `Type: ${attachment.contentType || "document"} | Language: ${attachment.language || "plaintext"} | Size: ${attachment.size} bytes\n`;
          finalMessage += attachment.content;
          finalMessage += `\n--- End of ${attachment.filename} ---\n`;
          */
          return {
            ...attachment,
            type: "large_content",
            filename: attachment.filename,
            contentType: attachment.contentType || "document",
            size: attachment.size || attachment.content?.length || 0,
            word_count:
              attachment.word_count ||
              attachment.content?.split(/\s+/).length ||
              0,
            line_count:
              attachment.line_count ||
              attachment.content?.split("\n").length ||
              0,
            extension:
              attachment.extension ||
              this.getFileExtension(attachment.filename),
            language:
              attachment.language || attachment.contentType || "plaintext",
            is_executable: attachment.is_executable || false,
            mime_type:
              attachment.mime_type ||
              this.getMimeType(
                attachment.extension ||
                  this.getFileExtension(attachment.filename)
              ),
            content_preview: attachment.content?.substring(0, 200) + "...",
            full_content_length: attachment.content?.length || 0,
            created_at: attachment.created_at || new Date().toISOString(),
            document_id: attachment.document_id || `doc_${Date.now()}_${index}`,
          };
        } else {
          // Standardize other types like 'image', 'file', etc.
          console.log(
            `🔄 📎 Standardizing attachment of type:`,
            attachment.type
          );
          const extension = this.getFileExtension(attachment.filename);
          const mimeType = attachment.mimeType || this.getMimeType(extension);
          return {
            ...attachment,
            id: attachment.id || `att_${Date.now()}_${index}`,
            type: attachment.type,
            filename: attachment.filename,
            contentType: mimeType,
            size: attachment.size || 0,
            word_count: 0,
            line_count: 0,
            extension: extension,
            language: "N/A",
            is_executable: false,
            mime_type: mimeType,
            content_preview: `[${attachment.type}: ${attachment.filename}]`,
            full_content_length: attachment.size || 0,
            created_at: attachment.created_at || new Date().toISOString(),
            document_id: attachment.id || `att_${Date.now()}_${index}`,
          };
        }
      });
      console.log(
        `🔄 📎 ✅ Processed and standardized all ${processedAttachments.length} attachments.`
      );
    }
    // --- END OF FIX ---

    // Declare variables for message and parent IDs
    let userMessageId = null;
    let parentMessageId = null;

    if (!isEditedMessage) {
      console.log("🔄 👤 CREATING NEW USER MESSAGE:");

      let displayMessage = messageText;

      console.log("🔄 👤 Display message:", displayMessage.substring(0, 100));

      const messageResult = messageManager.createMessage(
        displayMessage,
        "user",
        version,
        processedAttachments
      );

      userMessageId = messageResult.messageId;
      parentMessageId = messageResult.parentMessageId;

      console.log("🔄 👤 User message created with ID:", userMessageId);
      console.log("🔄 👤 Parent message ID:", parentMessageId);

      if (userMessageId && processedAttachments.length > 0) {
        console.log("🔄 👤 Linking attachments to user message...");
        const messageEntry = messageManager.findMessageInHistory(
          (msg) => msg.id === userMessageId
        );

        // This block attempts to save the attachment data to the history.
        // It will still likely fail, but we won't let it block the UI update.
        if (messageEntry) {
          messageEntry.attachments = processedAttachments;
          messageEntry.has_attachments = true;
          messageEntry.attachment_count = processedAttachments.length;

          appState.saveToStorage();
          console.log(
            "🔄 👤 ✅ Attachments successfully linked to message in history."
          );
        } else {
          console.warn(
            "❌ Could not find message in history to link attachments. Attachments may not persist after a reload."
          );
        }
      }
    } else if (updateMessageId) {
      // 🔍 DEBUG: Log entry into update block
      console.log("🔍 DEBUG: Entered updateMessageId block");
      console.log("🔍 DEBUG: updateMessageId value:", updateMessageId);
      console.log("🔍 DEBUG: updateMessageId type:", typeof updateMessageId);
      console.log("🔍 DEBUG: updateMessageId truthy?", !!updateMessageId);

      // ✅ FIX: Handle message updates for edits
      console.log("🔄 👤 CREATING NEW MESSAGE FOR UPDATE:", updateMessageId);

      // Set userMessageId to the message being updated
      userMessageId = updateMessageId;

      // Get parent message ID for the update case
      console.log("=== getParentMessageId Debug (Update Case) ===");
      console.log("updateMessageId:", updateMessageId);
      console.log("getParentMessageId GETTING CALLED IN SENDMESSAGE");
      parentMessageId = this.getParentMessageId(updateMessageId);
      console.log("getParentMessageId returned:", parentMessageId);
      console.log("=== End getParentMessageId Debug (Update Case) ===");

      // ✅ FIX: Find the message using the correct approach
      const currentConversation = messageManager.getCurrentConversation();
      console.log("🔍 DEBUG: currentConversation:", currentConversation);
      console.log(
        "🔍 DEBUG: currentConversation length:",
        currentConversation?.length
      );

      const messageToUpdate = currentConversation.find(
        (msg) => msg.id === updateMessageId
      );

      console.log("🔍 DEBUG: messageToUpdate found:", !!messageToUpdate);
      console.log("🔍 DEBUG: messageToUpdate:", messageToUpdate);

      if (messageToUpdate) {
        console.log("🔍 DEBUG: Entered messageToUpdate block");

        // Get the content container
        const content = document.getElementById("aiContent");
        if (!content) {
          console.error("❌ aiContent element not found!");
          return;
        }
        console.log("✅ aiContent element found");

        // Create new message div (similar to createMessage function)
        const message = document.createElement("div");

        message.id = updateMessageId;
        message.className =
          messageToUpdate.type === "ai"
            ? "message ai-response"
            : "message user-message";
        message.dataset.messageId = updateMessageId;
        message.dataset.version = version;
        console.log(
          "📝 New message element created with class:",
          message.className
        );

        // Create updated message data for HTML generation
        const updatedMsgData = {
          id: messageToUpdate.id,
          text: messageText,
          type: messageToUpdate.type,
          messageType: messageToUpdate.messageType,
          model: messageToUpdate.model,
          timestamp: messageToUpdate.timestamp,
          files: processedAttachments,
          version: version,
        };

        console.log("🔍 DEBUG: updatedMsgData:", updatedMsgData);

        this.addVersionNavToPreviousMessages(userMessageId, version);

        // Create the HTML content using messageManager.createMessageHTML
        const shouldIncludeFiles =
          processedAttachments && processedAttachments.length > 0;
        console.log("📎 Should include files:", shouldIncludeFiles);

        const newHTML = messageManager.createMessageHTML(
          updatedMsgData,
          shouldIncludeFiles
        );

        console.log("🔍 DEBUG: newHTML length:", newHTML.length);

        // Set the HTML content
        message.innerHTML = newHTML;
        console.log("🏗️ Message HTML created and assigned");

        // Append the new message to content
        content.appendChild(message);
        content.scrollTop = content.scrollHeight;
        console.log("📍 New message appended to content and scrolled");

        this.disableVersionNavButtons();

        // Setup attachment handlers if needed
        if (processedAttachments.length > 0) {
          console.log("🔍 DEBUG: Setting up attachment handlers");
          messageManager.setupAttachmentClickHandlers(
            message,
            processedAttachments
          );
        }

        // Ensure footer is visible
        const footerEl = message.querySelector(".message-footer");
        if (footerEl) {
          console.log("🔍 DEBUG: Footer element found, showing it");
          footerEl.style.display = "flex";
        } else {
          console.log("🔍 DEBUG: Footer element not found");
        }

        console.log("🔄 👤 ✅ New message created successfully");
      } else {
        console.error(
          "🔄 👤 ❌ Message not found in conversation:",
          updateMessageId
        );
        console.error("🔍 DEBUG: Available message IDs in conversation:");
        currentConversation.forEach((msg, index) => {
          console.error(`🔍 DEBUG: Message ${index} ID:`, msg.id);
        });
      }
    } else {
      console.log("🔄 👤 ⏭️ SKIPPING user message creation (this is an edit)");
    }

    // Get the user message element and log its HTML
    const userMessageElement = document.getElementById(userMessageId);
    if (userMessageElement) {
      console.log(
        "THIS IS THE NEWLY CREATED USER MESSAGE HTMHIS IS THE NEWLY CREATED USER MESSAGE HTML",
        userMessageElement.outerHTML
      );
    }

    // Context+ loading
    if (appState.contextPlusEnabled) {
      console.log("🔄 🧠 Showing Context+ loading...");
      this.showContextPlusLoading();
    }

    console.log("🔄 🚀 TIMEOUT CALLBACK EXECUTED");
    const finalConversation =
      appState.chatHistory[appState.currentConversationId] || {};
    console.log("🔄 🚀 Final conversation length:", finalConversation.length);

    if (userMessageElement) {
      console.log(
        "THIS IS THE NEWLY CREATED USER MESSAGE HTMHIS IS THE NEWLY CREATED USER MESSAGE HTML BEFORE CONTEXT FETCH",
        userMessageElement.outerHTML
      );
    }

    const contextMessages = await (async function () {
      try {
        return await appState.getContextForAI(userMessageId);
      } catch (error) {
        console.error("Failed to get context messages:", error);
        return []; // or whatever fallback you prefer
      }
    })();
    console.log(
      "THIS IS THE CONTEXT FROM THE CURRENT CONVERSATION THAT IS BEING SENT TO THE AI:",

      contextMessages
    );
    console.log("🔄 🚀 Context messages prepared:", contextMessages.length);
    if (userMessageElement) {
      console.log(
        "THIS IS THE NEWLY CREATED USER MESSAGE HTMHIS IS THE NEWLY CREATED USER MESSAGE HTML AFTER CONTEXT FETCH",
        userMessageElement.outerHTML
      );
    }

    // Prepare message data
    const messageData = {
      message: finalMessage,
      model: appState.selectedAIModel,
      conversation_id: appState.currentConversationId,
      version: version,
      message_id: userMessageId || updateMessageId,
      parent_message_id: parentMessageId,
      context: JSON.stringify(contextMessages),
      contextMessages: contextMessages,
      attachments: processedAttachments,
      THEtimestamp: new Date().toISOString(),
      largeContentAttachments: processedAttachments.filter(
        (a) => a.type === "large_content"
      ),
      imageAttachments: processedAttachments.filter((a) => a.type === "image"),
      fileAttachments: processedAttachments.filter((a) => a.type === "file"),
      attachment_summary: {
        total_count: processedAttachments.length,
        types: [...new Set(processedAttachments.map((a) => a.type))],
        total_size: processedAttachments.reduce(
          (sum, a) => sum + (a.size || 0),
          0
        ),
        has_code: processedAttachments.some(
          (a) =>
            a.type === "large_content" &&
            ["javascript", "python", "html", "css", "java", "cpp"].includes(
              a.language
            )
        ),
        has_documents: processedAttachments.some(
          (a) => a.type === "large_content"
        ),
        has_images: processedAttachments.some((a) => a.type === "image"),
      },
      context_plus_enabled: appState.contextPlusEnabled,
      retrieve_memories: appState.contextPlusEnabled
        ? this.extractKeywords(messageText)
        : [],
    };

    if (userMessageElement) {
      console.log(
        "THIS IS THE NEWLY CREATED USER MESSAGE HTML BEFORE SENDING TO AI",
        userMessageElement.outerHTML
      );
    }

    console.log("🔄 🚀 FINAL MESSAGE DATA PREPARED:", messageData);
    console.log("🔄 🚀 Message length:", messageData.message.length);
    console.log("🔄 🚀 Model:", messageData.model);
    console.log("🔄 🚀 Context messages:", messageData.contextMessages.length);
    console.log("🔄 🚀 Attachments:", messageData.attachments.length);
    console.log("🔄 🚀 Context+ enabled:", messageData.context_plus_enabled);
    console.log("🔄 🚀 Is edit:", isEditedMessage);
    try {
      this.sendChatMessageStreaming(messageData, this.abortController.signal);
      console.log("🔄 🚀 🌊 ✅ Streaming request initiated");
    } catch (error) {
      console.error("🔄 🚀 🌊 ❌ Streaming error:", error);
      console.error("🔄 🚀 🌊 ❌ Error stack:", error.stack);
    }

    console.log("🔄 ✅ === CHAT MANAGER SEND MESSAGE COMPLETED ===");
  },

  disableVersionNavButtons: function () {
    this.originallyEnabledButtons = [];
    const buttons = document.querySelectorAll(".version-nav-btn");

    buttons.forEach((button) => {
      // Store reference to originally enabled buttons
      if (!button.disabled) {
        this.originallyEnabledButtons.push(button);
      }

      // Disable all buttons
      button.disabled = true;
      button.style.opacity = "0.6";
      button.style.cursor = "not-allowed";
    });
  },

  enableVersionNavButtons: function () {
    const buttons = document.querySelectorAll(".version-nav-btn");

    buttons.forEach((button) => {
      // Only enable buttons that were originally enabled
      if (this.originallyEnabledButtons.includes(button)) {
        button.disabled = false;
        button.style.opacity = "";
        button.style.cursor = "";
      }
    });

    this.originallyEnabledButtons = [];
  },

  getCurrentDisplayingVersion: function () {
    const currentConversation = messageManager.getCurrentConversation();

    const recentUserMessages = currentConversation
      .filter((msg) => msg.type === "user")
      .slice(-5);

    for (const msg of recentUserMessages.reverse()) {
      if (msg.displayVersion) {
        return msg.displayVersion;
      }
    }

    const lastUserMessage = currentConversation
      .filter((msg) => msg.type === "user")
      .pop();
    if (lastUserMessage) {
      return lastUserMessage.currentVersion || 1;
    }

    return 1;
  },

  findMostRecentUserMessage: function () {
    for (let i = appState.chatHistory.length - 1; i >= 0; i--) {
      if (appState.chatHistory[i].type === "user") {
        return appState.chatHistory[i];
      }
    }
    return null;
  },

  abortRequest: function () {
    if (this.abortController) {
      this.abortController.abort();
      if ($DebugTestMode) {
        console.log("Request aborted by user");
      }
      this.cleanupAfterAbort();
    }
  },

  setProcessingState: function (isProcessing) {
    console.log("setProcessingState called with:", isProcessing);
    this.isProcessing = isProcessing;
    console.log("this.isProcessing set to:", this.isProcessing);

    const button = document.getElementById("sendButton");
    console.log("Button element found:", button ? "Yes" : "No");

    if (!button) {
      console.warn("sendButton not found in DOM");
      return;
    }

    if (isProcessing) {
      console.log("Adding processing state to button");
      button.classList.add("processing", "stop-mode"); // ADD stop-mode HERE
      button.title = "Stop processing";
      console.log("Button classes:", button.classList.toString());
      console.log("Button title set to:", button.title);
    } else {
      console.log("Removing processing state from button");
      button.classList.remove("processing", "stop-mode"); // REMOVE stop-mode HERE
      button.title = "Send message";
      this.abortController = null;
      console.log("Button classes:", button.classList.toString());
      console.log("Button title set to:", button.title);
      console.log("Abort controller reset to null");
    }

    console.log("setProcessingState completed");
  },

  cleanupAfterAbort: function () {
    console.log("setProcessingState CALLED 6");
    this.setProcessingState(false);
    messageManager.hideThinking();

    if (appState.contextPlusEnabled) {
      this.hideContextPlusLoading();
    }

    messageManager.createMessage("Request canceled by user", "ai", "Aborted");

    if (this.currentStreamMessageId) {
      const messageEl = document.getElementById(this.currentStreamMessageId);
      if (messageEl) {
        messageEl.remove();
      }
      this.currentStreamMessageId = null;
      console.log("setting currentStreamMessageId to null 2:");
    }
  },

  sendChatMessageStreaming: function (data) {
    console.log("🌊 === STARTING SSE STREAMING REQUEST ===");
    console.log("🌊 Context+ enabled:", data.context_plus_enabled);
    console.log("🌊 Search keywords:", data.search_keywords);

    // ADD THIS LOG TO SEE INITIAL DATA
    console.log(
      "🌊 Initial data received:",
      JSON.stringify(data, null, 2).substring(0, 500) + "..."
    );

    if (!authManager.checkAuthFromStorage()) {
      console.log("❌ Auth check failed");
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
    }

    // Clean up any existing stream
    if (this.activeEventSource) {
      this.activeEventSource.close();
      this.activeEventSource = null;
    }

    // CRITICAL: Reset streaming state completely
    console.log("🌊 🧹 RESETTING STREAMING STATE:");
    // this.streamingFiles.clear();
    this.streamingTextBuffer = "";
    this.currentStreamMessageId = null;
    console.log("setting currentStreamMessageId to null 1:");
    //this.streamingResponseFiles = []; // Reset this array
    this.inCodeBlock = false;
    this.currentFileInfo = null; // Reset current file info
    this.codeBlockBuffer = "";
    this.completeCalled = false; // Reset completion flag
    console.log("🌊 🧹 ✅ Streaming state completely reset");

    // Debug state after reset
    this.debugFileState("After Reset");

    // Show thinking indicator
    messageManager.showThinking();

    // Process data for size limits
    const MAX_CONTENT_SIZE = 500000; // 500KB per chunk

    // FIRST DEFINITION OF processedData
    let processedData = { ...data };
    console.log(
      "🌊 processedData created (shallow copy):",
      Object.keys(processedData),
      "message length:",
      processedData.message?.length || 0
    );

    if (
      processedData.message &&
      processedData.message.length > MAX_CONTENT_SIZE
    ) {
      const originalLength = processedData.message.length;
      processedData.message =
        processedData.message.substring(0, MAX_CONTENT_SIZE) +
        `\n\n[Message truncated from ${originalLength} to ${MAX_CONTENT_SIZE} characters for streaming]`;

      console.log(
        "🌊 Message truncated:",
        `from ${originalLength} to ${processedData.message.length} characters`
      );
    }

    // Process attachments
    if (processedData.attachments && processedData.attachments.length > 0) {
      console.log(
        "🌊 Processing attachments:",
        processedData.attachments.length
      );
      processedData.attachments = processedData.attachments.map(
        (attachment, idx) => {
          if (
            attachment.type === "large_content" &&
            attachment.content &&
            attachment.content.length > MAX_CONTENT_SIZE
          ) {
            const truncated = {
              ...attachment,
              content: attachment.content.substring(0, MAX_CONTENT_SIZE),
              original_size: attachment.content.length,
              truncated: true,
            };

            if ($DebugTestMode) {
              console.log(
                `🌊 Attachment ${idx} truncated:`,
                `from ${attachment.content.length} to ${MAX_CONTENT_SIZE}`
              );
            }

            return truncated;
          }
          return attachment;
        }
      );
    }

    // Also handle largeContentAttachments
    if (
      processedData.largeContentAttachments &&
      processedData.largeContentAttachments.length > 0
    ) {
      console.log(
        "🌊 Processing largeContentAttachments:",
        processedData.largeContentAttachments.length
      );
      processedData.largeContentAttachments =
        processedData.largeContentAttachments.map((attachment, idx) => {
          if (
            attachment.content &&
            attachment.content.length > MAX_CONTENT_SIZE
          ) {
            const truncated = {
              ...attachment,
              content: attachment.content.substring(0, MAX_CONTENT_SIZE),
              original_size: attachment.content.length,
              truncated: true,
            };

            console.log(
              `🌊 Large content ${idx} truncated:`,
              `from ${attachment.content.length} to ${MAX_CONTENT_SIZE}`
            );

            return truncated;
          }
          return attachment;
        });
    }

    // FINAL CHECK OF processedData
    console.log(
      "🌊 Final processedData structure:",
      Object.keys(processedData)
    );
    console.log("🌊 Final message length:", processedData.message?.length || 0);
    console.log(
      "🌊 Attachments count:",
      processedData.attachments?.length || 0
    );
    console.log(
      "🌊 LargeContentAttachments count:",
      processedData.largeContentAttachments?.length || 0
    );

    // Prepare request body with streaming flag
    const requestBody = {
      ...processedData,
      stream: true, // Enable streaming
      token: token,
    };

    // Log final size
    if ($DebugTestMode) {
      const totalSize = JSON.stringify(requestBody).length;
      console.log("🌊 Final request size:", totalSize, "bytes");
      if (totalSize > 1000000) {
        console.warn(
          "🌊 Request still large:",
          (totalSize / 1024 / 1024).toFixed(2),
          "MB"
        );
      }
    }

    // Start streaming with processed data
    console.log("🌊 Starting streaming request with processed data");
    this.startStreamingRequest(requestBody, token);
  },

  startStreamingRequest: async function (requestBody, token, signal) {
    console.log("🌊 === STARTING STREAMING REQUEST ===");
    console.log("🌊 Request body keys:", Object.keys(requestBody));
    console.log(
      "🌊 Request body size:",
      JSON.stringify(requestBody).length,
      "bytes"
    );

    try {
      const fullUrl = `${CONFIG.BACKEND_URL}/api/index.php?endpoint=chat`;
      console.log("🌊 Full request URL:", fullUrl);

      const headers = {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
        Authorization: `Bearer ${token}`,
        Connection: "keep-alive",
      };

      const bodyStr = JSON.stringify(requestBody);
      console.log("🌊 Making fetch request...");
      const fetchStartTime = Date.now();

      console.log("this is the headers", headers);
      console.log("this is the bodyStr", bodyStr);
      console.log("this is the signal", signal);

      const response = await fetch(fullUrl, {
        method: "POST",
        headers: headers,
        body: bodyStr,
        signal: signal,
      });

      const fetchEndTime = Date.now();
      console.log("🌊 Fetch completed in", fetchEndTime - fetchStartTime, "ms");

      console.log("🌊 === RESPONSE DETAILS ===", response);
      console.log("🌊 Response status:", response.status);
      console.log("🌊 Response statusText:", response.statusText);
      console.log("🌊 Response ok:", response.ok);

      const responseHeaders = {};
      for (const [key, value] of response.headers.entries()) {
        responseHeaders[key] = value;
      }
      console.log("🌊 Response headers:", responseHeaders);

      if (!response.ok) {
        console.error("🔴 === NON-OK RESPONSE DETAILS ===");

        let rawText;
        try {
          rawText = await response.text();
          console.error("🔴 Raw response text:", rawText);

          try {
            const jsonResponse = JSON.parse(rawText);
            console.error("🔴 Parsed JSON response:", jsonResponse);
          } catch (jsonError) {
            console.error("🔴 Response is not valid JSON:", jsonError.message);
          }
        } catch (textError) {
          console.error("🔴 Failed to read response text:", textError);
          rawText = `Failed to read response: ${textError.message}`;
        }

        if (response.status === 401) {
          throw new Error("Unauthorized");
        } else if (response.status === 0) {
          throw new Error("NetworkError");
        } else if (response.status >= 500) {
          throw new Error(`Server error (${response.status}): ${rawText}`);
        } else {
          throw new Error(`HTTP error ${response.status}: ${rawText}`);
        }
      }

      console.log("🌊 === RESPONSE OK - STARTING STREAM PROCESSING ===");

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("text/event-stream")) {
        console.warn("🌊 Not a streaming response, reading as regular JSON");
        const jsonData = await response.json();
        this.handleStreamComplete(jsonData);
        return { success: true };
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let eventCount = 0;

      console.log("🌊 Stream reader created successfully");

      let lastEventTime = Date.now();
      const timeoutCheck = setInterval(() => {
        if (Date.now() - lastEventTime > 360000) {
          console.error("🌊 Stream timeout - no events for 30 seconds");
          reader.cancel();
          clearInterval(timeoutCheck);
          this.handleStreamError({ error: "Stream timeout" });
        }
      }, 5000);

      console.log("🌊 Starting stream read loop...");

      // Process the stream
      while (true) {
        console.log("🌊 Reading next chunk...");
        const readStartTime = Date.now();

        const { done, value } = await reader.read();

        const readEndTime = Date.now();
        console.log(
          "🌊 Chunk read completed in",
          readEndTime - readStartTime,
          "ms"
        );
        console.log(
          "🌊 Chunk done:",
          done,
          "value length:",
          value ? value.length : 0
        );

        if (done) {
          console.log("🌊 === STREAM READER DONE ===");
          console.log("🌊 Total events processed:", eventCount);
          console.log("🌊 Final buffer length:", buffer.length);
          console.log(
            "🌊 Streaming text buffer length:",
            this.streamingTextBuffer?.length || 0,
            "chars"
          );

          clearInterval(timeoutCheck);

          // Debug final file state
          this.debugFileState("Stream Done");

          // If we haven't received a proper complete event, synthesize one
          if (this.currentStreamMessageId && !this.completeCalled) {
            console.log(
              "🌊 ⚠️ Stream ended without complete event - calling handleStreamComplete manually"
            );
            this.handleStreamComplete({
              response: this.streamingTextBuffer,
              complete: true,
              model_used: requestBody.model,
              files: Array.from(this.streamingFiles.values()).map((file) => ({
                id: file.id,
                filename: file.filename,
                content: file.content,
                extension: file.extension,
                language: file.language,
                type: file.type,
                size: file.content ? file.content.length : 0,
                is_executable: file.is_executable,
              })),
            });
          }
          break;
        }

        lastEventTime = Date.now();
        const chunkText = decoder.decode(value, { stream: true });
        console.log("🌊 Decoded chunk length:", chunkText.length);
        console.log("🌊 Decoded chunk preview:", chunkText.substring(0, 200));
        console.log("FULL chunkText chunkText chunkText ", chunkText);

        if (chunkText.includes('"stage":"memory_creation"')) {
          console.log(
            "🌊 Memory creation stage detected, calling endMessageVisually"
          );
          this.endMessageVisually();
        } else {
          console.log(
            "🌊 Current streamMessageId is still streaming:",
            this.currentStreamMessageId
          );
        }

        buffer += chunkText;
        console.log("🌊 Buffer length after chunk:", buffer.length);

        // Process complete events in the buffer
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        console.log("🌊 Processing", lines.length, "complete lines");

        for (const line of lines) {
          if (line.trim()) {
            eventCount++;
            console.log(
              "🌊 Processing SSE line #" + eventCount + ":",
              line.substring(0, 100)
            );
            console.log(
              "🌊 line being passed to processSSELine",
              line,
              requestBody.version
            );
            this.processSSELine(line, requestBody.version);
          }
        }
      }

      console.log("🌊 === STREAMING COMPLETE ===");
      return { success: true };
    } catch (error) {
      console.error("🌊 === STREAMING ERROR DETAILS ===");
      console.error("🌊 Error type:", error.name);
      console.error("🌊 Error message:", error.message);
      console.error("🌊 Error stack:", error.stack);

      if (error.name === "AbortError") {
        console.log("🌊 Streaming aborted by user");
        return { success: false, aborted: true };
      }

      console.error("🌊 Final streaming error:", error);
      this.handleStreamError({ error: error.message });
      return { success: false, error: error.message };
    }
  },

  changeTopicForConversation: function (data) {
    // Check if data has the expected structure and contains a title
    if (!data || typeof data !== "string" || data.trim() === "") {
      console.warn("Invalid title data for changeTopicForConversation");
      return null;
    }

    const extractedTitle = data.trim();

    // Check if we have a valid current conversation
    if (
      appState.currentConversationId &&
      appState.chatHistory[appState.currentConversationId]
    ) {
      // Ensure the conversation object structure exists
      if (Array.isArray(appState.chatHistory[appState.currentConversationId])) {
        // Convert legacy array format to object format
        appState.chatHistory[appState.currentConversationId] = {
          messages: appState.chatHistory[appState.currentConversationId],
          topic: extractedTitle,
        };
      } else {
        // Set the topic on the existing conversation object
        appState.chatHistory[appState.currentConversationId].topic =
          extractedTitle;
      }

      console.log(
        `Topic updated to: "${extractedTitle}" for conversation ${appState.currentConversationId}`
      );
      return extractedTitle;
    } else {
      console.warn("No current conversation found to update topic");
    }

    return null;
  },

  processSSELine: function (line, version) {
    console.log("🌊 === processSSELine CALLED ==="),
      this.currentStreamMessageId;
    // Safety check - ensure buffers are initialized
    if (this.streamingTextBuffer === undefined) {
      this.streamingTextBuffer = "";
    }
    if (this.codeBlockBuffer === undefined) {
      this.codeBlockBuffer = "";
    }

    console.log("🌊 [processSSELine] Raw line:", line);
    console.log("🌊 [processSSELine] Line length:", line.length);
    console.log(
      "🌊 [processSSELine] Current event type:",
      this.currentEventType
    );

    if (line.startsWith("event: ")) {
      this.currentEventType = line.substring(7).trim();
      console.log(
        "🌊 [processSSELine] ✅ Event type detected:",
        this.currentEventType
      );
      return;
    }

    if (!this.currentStreamMessageId) {
      // Create initial message container
      const messageId = `msg_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`;
      console.log("setting currentStreamMessageId to:", messageId);
      this.currentStreamMessageId = messageId;
    }

    if (line.startsWith("data: ")) {
      const rawData = line.substring(6).trim();
      console.log(
        "🌊 [processSSELine] Data received for event:",
        this.currentEventType
      );
      console.log(
        "🌊 [processSSELine] Raw data:",
        rawData.substring(0, 100) + "..."
      );

      if (rawData === "[DONE]") {
        console.log("🌊 [processSSELine] Received [DONE] signal");
        this.handleStreamComplete({});
        return;
      }

      try {
        const data = JSON.parse(rawData);
        console.log("🌊 [processSSELine] Parsed data:", data);

        // Enhanced event handling with more debugging
        switch (this.currentEventType) {
          case "text_chunk":
            console.log("🌊 [processSSELine] 📝 Handling text_chunk");
            this.handleTextChunk(data, version);
            break;
          case "file_start":
            console.log("🌊 [processSSELine] 📁 Handling file_start");
            this.debugFileState("Before file_start");
            this.handleFileStart(data);
            this.debugFileState("After file_start");
            break;
          case "file_chunk":
            console.log("🌊 [processSSELine] 📄 Handling file_chunk");
            this.handleFileChunk(data);
            break;
          case "stream_complete":
          case "complete":
            console.log(
              "🌊 [processSSELine] 🎯 CALLING handleStreamComplete",
              this.currentStreamMessageId
            );
            this.debugFileState("Before stream_complete");
            this.handleStreamComplete(data);
            break;
          case "done":
            console.log("🌊 [processSSELine] Stream done signal received");
            this.handleStreamDone();
            break;
          case "error":
            console.log("🌊 [processSSELine] ❌ Handling error");
            this.handleStreamError(data);
            break;
          case "progress":
            console.log("🌊 [processSSELine] 📊 Handling progress");
            this.handleProgressEvent?.(data);
            break;
          default:
            console.log(
              "🌊 [processSSELine] Unknown event type:",
              this.currentEventType
            );
            // Try to detect completion by data content
            if (data.complete || data.done || data.finished) {
              console.log(
                "🌊 [processSSELine] Detected completion flag in data"
              );
              this.handleStreamComplete(data);
            }
        }
      } catch (e) {
        console.error("🌊 [processSSELine] Failed to parse JSON:", e.message);
        console.error("🌊 [processSSELine] Raw data was:", rawData);
      }
    }
  },

  handleFileStart: function (data) {
    console.log("📁 === FILE START (ENHANCED DEBUG) ===");
    console.log("📁 🎯 ENTRY POINT - Function called");
    console.log("📁 🎯 File data received:", data);
    console.log("📁 🎯 File details:", data.file);

    const message = document.getElementById(this.currentStreamMessageId);
    if (!message) {
      console.error("📁 ❌ CRITICAL: No current message for file!");
      console.error(
        "📁 ❌ currentStreamMessageId:",
        this.currentStreamMessageId
      );
      return;
    }

    console.log("📁 ✅ Message element found:", message.id);

    // Find or create files container
    let filesContainer = message.querySelector(".message-files");
    if (!filesContainer) {
      console.log("📁 🏗️ Creating new files container");
      filesContainer = document.createElement("div");
      filesContainer.className = "message-files";
      filesContainer.style.display = "block";
      filesContainer.style.visibility = "visible";
      filesContainer.style.opacity = "1";
      message.appendChild(filesContainer);
      console.log("📁 ✅ Files container created and added to message");
    } else {
      console.log("📁 ✅ Files container already exists");
      // Ensure it's visible
      filesContainer.style.display = "block";
      filesContainer.style.visibility = "visible";
      filesContainer.style.opacity = "1";
    }

    const fileData = data.file;
    console.log("📁 📋 Processing file data:", {
      id: fileData.id,
      filename: fileData.filename,
      extension: fileData.extension,
      language: fileData.language,
      type: fileData.type,
      is_executable: fileData.is_executable,
    });

    // CRITICAL: Register this file in the streaming response files
    const responseFile = {
      id: fileData.id,
      filename: fileData.filename,
      extension: fileData.extension,
      language: fileData.language,
      type: fileData.type,
      content: "", // Will be filled during streaming
      is_executable: fileData.is_executable,
      mime_type: fileData.mime_type,
    };

    this.streamingResponseFiles.push(responseFile);
    console.log("📁 ✅ File registered in streamingResponseFiles");
    console.log(
      "📁 📊 Total streamingResponseFiles:",
      this.streamingResponseFiles.length
    );

    // Create the file block HTML
    console.log("📁 🏗️ Creating file block HTML");
    const fileBlockHtml = this.createStreamingFileBlock(fileData);
    console.log("📁 ✅ File block HTML created, length:", fileBlockHtml.length);

    // Insert the HTML
    filesContainer.insertAdjacentHTML("beforeend", fileBlockHtml);
    console.log("📁 ✅ File block HTML inserted into container");

    // Find the created element
    const fileElement = document.getElementById(`block_${fileData.id}`);
    if (!fileElement) {
      console.error("📁 ❌ CRITICAL: File element not found after insertion!");
      console.error("📁 ❌ Expected ID: block_" + fileData.id);
      console.error(
        "📁 ❌ Container children:",
        filesContainer.children.length
      );
      // List all children for debugging
      for (let i = 0; i < filesContainer.children.length; i++) {
        console.error("📁 ❌ Child", i, "ID:", filesContainer.children[i].id);
      }
      return;
    }

    console.log("📁 ✅ File element found:", fileElement.id);

    // Ensure element is visible
    fileElement.style.display = "block";
    fileElement.style.visibility = "visible";
    fileElement.style.opacity = "1";
    console.log("📁 ✅ File element visibility set");

    // Create and store streaming file info
    const normalizedFileId = `file_${fileData.id}`;
    const streamingFile = {
      ...fileData,
      content: "",
      element: fileElement,
      frontendId: `block_${fileData.id}`,
      backendId: fileData.id,
      isStreaming: true,
    };

    // Store in multiple ways for different lookup patterns
    this.streamingFiles.set(fileData.id, streamingFile);
    this.streamingFiles.set(normalizedFileId, streamingFile);
    this.streamingFiles.set(fileData.filename, streamingFile); // Also by filename

    console.log("📁 ✅ Streaming file stored in streamingFiles map");
    console.log("📁 📊 streamingFiles size:", this.streamingFiles.size);
    console.log("📁 📊 Keys:", Array.from(this.streamingFiles.keys()));

    // Store in contentManager with reference to all files
    if (typeof contentManager !== "undefined") {
      console.log("📁 🏗️ Registering with contentManager");

      const blockDataToAdd = {
        id: normalizedFileId,
        filename: fileData.filename || "untitled.txt",
        content: "",
        originalContent: "",
        extension: fileData.extension || ".txt",
        language: fileData.language || "plaintext",
        type: fileData.type || "text",
        size: 0,
        wordCount: 0,
        isExecutable: fileData.is_executable || false,
        mimeType: contentManager.getMimeType(fileData.extension || ".txt"),
        linkedFiles: [], // Will be updated when streaming completes
        allFiles: this.streamingResponseFiles, // Reference to all files
        isStreaming: true,
      };

      console.log("📁 📊 ADDBLOCK DATA BEING SENT:");
      console.log("📁 📊   - id:", blockDataToAdd.id);
      console.log("📁 📊   - filename:", blockDataToAdd.filename);
      console.log("📁 📊   - extension:", blockDataToAdd.extension);
      console.log("📁 📊   - language:", blockDataToAdd.language);
      console.log("📁 📊   - type:", blockDataToAdd.type);
      console.log("📁 📊   - isExecutable:", blockDataToAdd.isExecutable);
      console.log("📁 📊   - mimeType:", blockDataToAdd.mimeType);
      console.log("📁 📊   - isStreaming:", blockDataToAdd.isStreaming);
      console.log("📁 📊   - allFiles.length:", blockDataToAdd.allFiles.length);
      console.log("📁 📊   - allFiles contents:", blockDataToAdd.allFiles);
      console.log(
        "📁 📊   - contentManager.blocks.size BEFORE:",
        contentManager.blocks.size
      );

      contentManager.findOrCreateBlock(blockDataToAdd);

      console.log(
        "📁 📊   - contentManager.blocks.size AFTER:",
        contentManager.blocks.size
      );
      console.log(
        "📁 📊   - Block successfully added with ID:",
        normalizedFileId
      );

      // Verify the block was actually stored
      const storedBlock = contentManager.blocks.get(normalizedFileId);
      if (storedBlock) {
        console.log(
          "📁 ✅ VERIFICATION: Block found in contentManager.blocks:"
        );
        console.log("📁 ✅   - stored id:", storedBlock.id);
        console.log("📁 ✅   - stored filename:", storedBlock.filename);
        console.log(
          "📁 ✅   - stored allFiles.length:",
          storedBlock.allFiles ? storedBlock.allFiles.length : "UNDEFINED"
        );
      } else {
        console.error(
          "📁 ❌ VERIFICATION FAILED: Block NOT found in contentManager.blocks with ID:",
          normalizedFileId
        );
      }

      console.log("📁 ✅ Registered with contentManager");
    } else {
      console.warn("📁 ⚠️ contentManager not available");
    }

    // Enable Live Preview for HTML files immediately
    const previewButton = fileElement.querySelector(
      ".block-btn[data-action='preview']"
    );
    if (
      previewButton &&
      (fileData.extension === ".html" || fileData.extension === ".htm")
    ) {
      console.log("📁 🌐 Enabling Live Preview for HTML file");
      previewButton.disabled = false;
      previewButton.style.pointerEvents = "auto";
      previewButton.style.cursor = "pointer";
      previewButton.style.opacity = "1";
      console.log("📁 ✅ Live Preview enabled");
    } else if (previewButton) {
      console.log(
        "📁 ℹ️ Preview button found but not HTML file, extension:",
        fileData.extension
      );
    } else {
      console.log("📁 ℹ️ No preview button found in file element");
    }

    // Auto-scroll to show new content
    const content = document.getElementById("aiContent");
    if (content && this.isNearBottom(content)) {
      content.scrollTop = content.scrollHeight;
    }

    // Debug final state
    this.debugFileState("After file_start complete");

    console.log("📁 ✅ === FILE START COMPLETED ===");
  },
  getFileTypeClass: function (extension) {
    const classMap = {
      ".html": "file-block-html",
      ".htm": "file-block-html",
      ".css": "file-block-css",
      ".js": "file-block-js",
      ".json": "file-block-json",
      ".py": "file-block-python",
      ".php": "file-block-php",
      ".java": "file-block-java",
      ".cpp": "file-block-cpp",
      ".c": "file-block-c",
      ".md": "file-block-markdown",
      ".txt": "file-block-text",
      ".xml": "file-block-xml",
      ".sql": "file-block-sql",
      ".yml": "file-block-yaml",
      ".yaml": "file-block-yaml",
    };

    return classMap[extension?.toLowerCase()] || "file-block-generic";
  },

  createStreamingFileBlock: function (fileData) {
    console.log("🏗️ === CREATING STREAMING FILE BLOCK ===");
    console.log("🏗️ File data:", fileData);

    if (typeof contentManager === "undefined") {
      console.warn("🏗️ ⚠️ contentManager not available, using fallback icon");
    }

    const fileIcon =
      typeof contentManager !== "undefined"
        ? contentManager.getFileIcon(fileData.type, fileData.extension)
        : this.getFallbackFileIcon(fileData.extension);

    // Get proper file type class based on extension
    const fileTypeClass = this.getFileTypeClass(fileData.extension);
    const languageClass =
      fileData.language || this.getLanguageFromExtension(fileData.filename);
    console.log(
      `[DEBUG] createStreamingFileBlock: Final languageClass='${languageClass}'`
    );

    console.log("🏗️ File icon:", fileIcon);
    console.log("🏗️ File type class:", fileTypeClass);
    console.log("🏗️ Language class:", languageClass);
    // Default to the ID from the fileData object.
    let displayId = fileData.id;

    // Check if the content is a JSON string with a nested 'id'.
    if (
      typeof fileData.content === "string" &&
      fileData.content.trim().startsWith("{")
    ) {
      try {
        const innerData = JSON.parse(fileData.content);
        if (innerData.id) {
          // If a nested ID is found, use it for the HTML block.
          displayId = innerData.id;
        }
      } catch (e) {
        // Content is not parsable JSON, so we'll use the default displayId.
      }
    }
    const blockHtml = `
  <div class="content-block file-block ${fileTypeClass} streaming" 
       id="block_${displayId}" 
       data-type="${fileData.type}" 
       data-extension="${fileData.extension}"
       data-language="${languageClass}"
       data-file-id="${
         displayId.startsWith("file_") ? displayId : `file_${displayId}`
       }"
       style="display: block !important; visibility: visible !important; opacity: 1 !important;">
    <div class="block-header">
      <div class="block-info">
        <div class="block-icon">${fileIcon}</div>
        <div class="block-details">
          <h4 class="filename">${this.escapeHtml(fileData.filename)}</h4>
        </div>
      </div>
      <div class="block-actions" style="position: relative; z-index: 10;">
        <button class="block-btn primary" 
                data-action="preview" 
                data-file-id="${
                  displayId.startsWith("file_")
                    ? displayId
                    : `file_${displayId}`
                }"
                ${
                  fileData.extension === ".html" ||
                  fileData.extension === ".htm"
                    ? ""
                    : "disabled"
                }
                style="${
                  fileData.extension === ".html" ||
                  fileData.extension === ".htm"
                    ? "pointer-events: auto !important; cursor: pointer !important; opacity: 1;"
                    : "pointer-events: none !important; cursor: not-allowed !important; opacity: 0.5;"
                }">
          👁️ Live Preview
        </button>
        <button class="block-btn" data-action="download" disabled>⬇️ Download</button>
        <button class="block-btn" data-action="copy" disabled>📋 Copy</button>
        <span class="collapse-indicator">▼</span>
      </div>
    </div>
    <div class="block-content" style="display: block !important;">
      <div class="streaming-preview">
      <pre><code class="language-${languageClass} streaming-code" data-file-id="${
      displayId.startsWith("file_") ? displayId : `file_${displayId}`
    }"></code></pre>
        <div class="loading-dots" style="text-align: center; padding: 10px;">
          <span style="animation: pulse 1.5s infinite;">●</span>
          <span style="animation: pulse 1.5s infinite 0.5s;">●</span>
          <span style="animation: pulse 1.5s infinite 1s;">●</span>
        </div>
      </div>
    </div>
  </div>
  `;

    console.log("🏗️ Block HTML created, length:", blockHtml.length);
    return blockHtml;
  },

  getFallbackFileIcon: function (extension) {
    const iconMap = {
      ".html": "🌐",
      ".htm": "🌐",
      ".css": "🎨",
      ".js": "⚡",
      ".json": "🔧",
      ".py": "🐍",
      ".txt": "📄",
      ".md": "📝",
    };
    return iconMap[extension] || "📄";
  },

  // Fixed handleFileChunk function in chatManager.js
  handleFileChunk: function (data) {
    console.log("📄 === FILE CHUNK (ENHANCED DEBUG) ===");
    console.log("📄 🎯 ENTRY POINT - Function called");
    console.log("📄 🎯 Chunk data:", {
      file_id: data.file_id,
      chunk_length: data.chunk ? data.chunk.length : 0,
      is_complete: data.is_complete,
      chunk_preview: data.chunk ? data.chunk.substring(0, 200) : "NO CHUNK",
    });

    // Debug current state
    this.debugFileState("Before file_chunk");

    const fileId = data.file_id;
    if (!fileId) {
      console.error("📄 ❌ CRITICAL: No file_id in chunk data");
      return;
    }

    // Try multiple lookup strategies
    let file = this.streamingFiles.get(fileId);
    if (!file) {
      console.log(
        "📄 🔍 File not found with direct ID, trying alternatives..."
      );
      file = this.streamingFiles.get(`file_${fileId}`);
      if (!file) {
        // Try looking by backend ID pattern
        for (const [key, streamingFile] of this.streamingFiles.entries()) {
          if (
            streamingFile.id === fileId ||
            streamingFile.backendId === fileId
          ) {
            file = streamingFile;
            console.log("📄 ✅ Found file by backend ID match:", key);
            break;
          }
        }
      } else {
        console.log("📄 ✅ Found file with file_ prefix");
      }
    } else {
      console.log("📄 ✅ Found file with direct ID");
    }

    if (!file) {
      console.error(
        "📄 ❌ CRITICAL: File not found in streamingFiles for ID:",
        fileId
      );
      console.error(
        "📄 ❌ Available keys:",
        Array.from(this.streamingFiles.keys())
      );
      return;
    }

    console.log("📄 ✅ File found:", {
      filename: file.filename,
      current_content_length: file.content ? file.content.length : 0,
      element_exists: !!file.element,
    });

    // CRITICAL FIX: Check if this chunk contains JSON-wrapped file data
    if (data.chunk && typeof data.chunk === "string") {
      console.log("📄 🔍 Checking if chunk contains JSON file data...");

      const trimmedChunk = data.chunk.trim();

      // Check if the chunk looks like JSON-wrapped file data
      try {
        // Try to parse as JSON and see if it has our file structure
        if (
          trimmedChunk.startsWith("{") &&
          (trimmedChunk.includes('"filename"') ||
            trimmedChunk.includes('"language"') ||
            trimmedChunk.includes('"sections"'))
        ) {
          console.log("📄 🎯 DETECTED JSON-WRAPPED FILE DATA!");

          const fileData = JSON.parse(trimmedChunk);
          console.log("📄 ✅ Parsed JSON file data:", {
            filename: fileData.filename,
            language: fileData.language,
            hasSections: !!fileData.sections,
            hasMetadata: !!fileData.metadata,
            updateType: fileData.update_type,
            sectionsCount: Object.keys(fileData.sections || {}).length,
          });

          // CRITICAL FIX: Handle update types properly
          if (fileData.update_type === "partial") {
            console.log("📄 🔄 Processing as partial update");

            // Route to file update handler
            if (typeof fileUpdateHandler !== "undefined") {
              fileUpdateHandler.handleFileUpdate(fileData);
            } else {
              // Fallback to chatManager update handling
              this.handlePartialFileUpdate(fileData, trimmedChunk);
            }

            // IMPORTANT: Return here to prevent further processing
            return;
          } else if (fileData.filename && fileData.sections) {
            // This is a complete file JSON data
            console.log("📄 🔄 Processing as complete JSON-wrapped file");

            // Reconstruct the actual file content from sections
            let reconstructedContent = "";
            const sections = fileData.sections || {};

            // Sort sections by start_line if available
            const sortedSections = Object.entries(sections).sort((a, b) => {
              const aStart = a[1].start_line || 0;
              const bStart = b[1].start_line || 0;
              return aStart - bStart;
            });

            // Reconstruct the full file content with proper line breaks
            for (const [sectionName, sectionData] of sortedSections) {
              if (sectionData.content) {
                // Ensure the content has proper line breaks
                let sectionContent = sectionData.content;

                // If content contains escaped newlines, convert them to actual newlines
                if (sectionContent.includes("\\n")) {
                  sectionContent = sectionContent.replace(/\\n/g, "\n");
                }

                reconstructedContent += sectionContent;

                // Add newlines between sections if not already present
                if (
                  !reconstructedContent.endsWith("\n") &&
                  sectionName !== sortedSections[sortedSections.length - 1][0]
                ) {
                  reconstructedContent += "\n";
                }
              }
            }

            console.log("📄 ✅ Reconstructed file content:", {
              originalLength: trimmedChunk.length,
              reconstructedLength: reconstructedContent.length,
              filename: fileData.filename,
              language: fileData.language,
              contentPreview: reconstructedContent.substring(0, 200),
            });

            // CRITICAL: Update file with reconstructed content AND correct file type information
            file.content = reconstructedContent;
            file.language = fileData.language || file.language;
            file.filename = fileData.filename || file.filename;
            file.extension =
              this.getFileExtension(fileData.filename) || file.extension;
            file.type = this.detectFileType(fileData.language) || file.type;
            file.metadata = fileData.metadata;
            file.sections = fileData.sections;
            file.originalJSON = trimmedChunk;

            // Update streamingResponseFiles array
            const responseFile = this.streamingResponseFiles.find(
              (f) => f.id === fileId
            );
            if (responseFile) {
              responseFile.content = reconstructedContent;
              responseFile.language =
                fileData.language || responseFile.language;
              responseFile.filename =
                fileData.filename || responseFile.filename;
              responseFile.extension =
                this.getFileExtension(fileData.filename) ||
                responseFile.extension;
              responseFile.type =
                this.detectFileType(fileData.language) || responseFile.type;
              responseFile.metadata = fileData.metadata;
              responseFile.sections = fileData.sections;
              responseFile.originalJSON = trimmedChunk;
            }

            // Update DOM element and content
            this.updateFileElementWithJSONData(
              file,
              reconstructedContent,
              fileData
            );

            // Update contentManager block
            this.updateContentManagerBlock(
              file,
              reconstructedContent,
              fileData
            );

            // Handle file completion if marked as complete
            if (data.is_complete) {
              console.log("📄 🏁 File streaming completed:", file.filename);
              this.finalizeFileBlock(file);
            }

            // Auto-scroll if near bottom
            const content = document.getElementById("aiContent");
            if (content && this.isNearBottom(content)) {
              content.scrollTop = content.scrollHeight;
            }

            // Debug final state
            this.debugFileState("After JSON file_chunk");

            console.log("📄 ✅ === JSON FILE CHUNK COMPLETED ===");

            // IMPORTANT: Return here to skip regular file processing
            return;
          }
        }
      } catch (jsonError) {
        console.log(
          "📄 ℹ️ Chunk is not JSON file data, processing as regular content:",
          jsonError.message
        );
        // Fall through to regular file processing
      }
    }

    // REGULAR FILE PROCESSING (for non-JSON files)
    console.log("📄 📝 Processing as regular file content");

    // Append chunk to file content
    if (data.chunk) {
      if (!file.content) {
        file.content = "";
      }
      file.content += data.chunk;
      console.log(
        "📄 ✅ Chunk added, new content length:",
        file.content.length
      );
    }

    // Update the streamingResponseFiles array
    const responseFile = this.streamingResponseFiles.find(
      (f) => f.id === fileId
    );
    if (responseFile) {
      responseFile.content = file.content;
      console.log("📄 ✅ Updated streamingResponseFiles entry");
    }

    // Update DOM element
    if (file.element) {
      const codeElement = file.element.querySelector(".streaming-code, code");
      if (codeElement) {
        codeElement.textContent = file.content;
        console.log("📄 ✅ Updated DOM code element");

        console.log("highlighting code element number 9");
        this.highlightElementCode(codeElement);
        console.log("📄 ✅ Syntax highlighting applied");
      }

      // Show loading animation
      const loadingDots = file.element.querySelector(".loading-dots");
      if (loadingDots) {
        loadingDots.style.display = "block";
      }
    }

    const baseId = file.backendId || file.id;
    const normalizedFileId = baseId.startsWith("file_")
      ? baseId
      : `file_${baseId}`;
    if (typeof contentManager !== "undefined") {
      const block = contentManager.blocks.get(normalizedFileId);
      if (block) {
        block.content = file.content;
        block.originalContent = file.content;
        block.size = file.content.length;
        block.wordCount = file.content.split(/\s+/).length;
        block.allFiles = this.streamingResponseFiles;
        contentManager.blocks.set(normalizedFileId, block);
        console.log("📄 ✅ Updated contentManager block");
      }
    }

    // Handle file completion
    if (data.is_complete) {
      console.log("📄 🏁 File streaming completed:", file.filename);
      this.finalizeFileBlock(file);
    }

    // Auto-scroll if near bottom
    const content = document.getElementById("aiContent");
    if (content && this.isNearBottom(content)) {
      content.scrollTop = content.scrollHeight;
    }

    // Debug final state
    this.debugFileState("After file_chunk");

    console.log("📄 ✅ === FILE CHUNK COMPLETED ===");
  },

  // Helper method to update file element with JSON data
  updateFileElementWithJSONData: function (
    file,
    reconstructedContent,
    fileData
  ) {
    console.log("📄 Starting updateFileElementWithJSONData", {
      fileId: file.id || file.backendId,
      filename: file.filename,
      extension: file.extension,
      hasElement: !!file.element,
    });

    if (!file.element) {
      console.warn("📄 ⚠️ No file element found, skipping update");
      return;
    }

    // Update the file block classes and attributes based on actual file type
    const newFileTypeClass = this.getFileTypeClass(file.extension);
    const newLanguageClass =
      file.language || this.getLanguageFromExtension(file.filename);

    console.log("📄 File type detection", {
      extension: file.extension,
      newFileTypeClass,
      newLanguageClass,
      originalLanguage: file.language,
    });

    // Update element classes
    const oldClassName = file.element.className;
    file.element.className = file.element.className.replace(
      /file-block-\w+/g,
      newFileTypeClass
    );
    file.element.setAttribute("data-extension", file.extension);
    file.element.setAttribute("data-language", newLanguageClass);
    file.element.setAttribute("data-type", file.type);

    console.log("📄 Updated element attributes", {
      oldClassName,
      newClassName: file.element.className,
      dataExtension: file.extension,
      dataLanguage: newLanguageClass,
      dataType: file.type,
    });

    // Update filename in UI if it changed
    const filenameEl = file.element.querySelector(".filename");
    if (filenameEl && fileData.filename !== file.originalFilename) {
      console.log("📄 Updating filename", {
        from: file.originalFilename,
        to: fileData.filename,
      });
      filenameEl.textContent = fileData.filename;
    }

    // Update the block icon based on actual file type
    const blockIconEl = file.element.querySelector(".block-icon");
    if (blockIconEl) {
      const correctIcon =
        typeof contentManager !== "undefined"
          ? contentManager.getFileIcon(file.type, file.extension)
          : this.getFallbackFileIcon(file.extension);
      blockIconEl.innerHTML = correctIcon;
      console.log("📄 Updated block icon", {
        fileType: file.type,
        extension: file.extension,
        hasContentManager: typeof contentManager !== "undefined",
      });
    }

    // Update language display
    const languageEl = file.element.querySelector(".language");
    if (languageEl) {
      const oldLanguageText = languageEl.textContent;
      const oldLanguageClass = languageEl.className;
      languageEl.textContent = file.language;
      languageEl.className = `language ${newLanguageClass}`;
      console.log("📄 Updated language display", {
        from: { text: oldLanguageText, class: oldLanguageClass },
        to: { text: file.language, class: `language ${newLanguageClass}` },
      });
    }

    // Update file type display
    const fileTypeEl = file.element.querySelector(".file-type");
    if (fileTypeEl) {
      const oldFileTypeText = fileTypeEl.textContent;
      const oldFileTypeClass = fileTypeEl.className;
      fileTypeEl.textContent = file.type;
      fileTypeEl.className = `file-type ${newFileTypeClass}`;
      console.log("📄 Updated file type display", {
        from: { text: oldFileTypeText, class: oldFileTypeClass },
        to: { text: file.type, class: `file-type ${newFileTypeClass}` },
      });
    }

    // Update code element with reconstructed content and correct language
    const codeElement = file.element.querySelector(".streaming-code, code");
    if (codeElement) {
      const contentLength = reconstructedContent.length;
      codeElement.textContent = reconstructedContent;
      codeElement.className = `language-${newLanguageClass}`;

      console.log("📄 Updated code element", {
        contentLength,
        newLanguageClass,
        elementType: codeElement.tagName,
      });

      // Ensure proper CSS for code display
      codeElement.style.whiteSpace = "pre";
      codeElement.style.fontFamily = "monospace";
      codeElement.style.display = "block";
      codeElement.style.overflow = "auto";

      console.log("highlighting code element number 10");
      this.highlightElementCode(codeElement);
      console.log("📄 ✅ Syntax highlighting applied successfully");
    } else {
      console.warn("📄 ⚠️ Code element not found");
    }

    // Enable preview button for HTML files
    const previewButton = file.element.querySelector(
      ".block-btn[data-action='preview']"
    );
    if (
      previewButton &&
      (file.extension === ".html" || file.extension === ".htm")
    ) {
      previewButton.disabled = false;
      previewButton.removeAttribute("disabled");
      previewButton.style.pointerEvents = "auto";
      previewButton.style.cursor = "pointer";
      previewButton.style.opacity = "1";
      console.log("📄 ✅ Enabled preview button for HTML file");
    } else if (previewButton) {
      console.log("📄 ℹ️ Preview button found but file is not HTML", {
        extension: file.extension,
      });
    }

    console.log("📄 ✅ Completed updateFileElementWithJSONData");
  },

  updateContentManagerBlock: function (file) {
    if (typeof contentManager === "undefined") return;

    const blockId = file.id.startsWith("file_") ? file.id : `file_${file.id}`;
    const block = contentManager.blocks.get(blockId);

    if (block) {
      block.content = file.content;
      block.originalContent = file.content;
      block.sections = file.sections;
      block.size = file.content.length;
      block.wordCount = file.content.split(/\s+/).length;
      block.lastUpdate = file.lastUpdate;

      contentManager.blocks.set(blockId, block);
      console.log("🔄 ✅ ContentManager block updated");
    }
  },
  // Helper function to finalize file blocks
  finalizeFileBlock: function (file) {
    if (!file || !file.element) return;

    // Remove streaming indicators
    file.element.classList.remove("streaming");

    const streamingBadge = file.element.querySelector(".streaming-badge");
    if (streamingBadge) {
      streamingBadge.remove();
      console.log("📄 ✅ Removed streaming badge");
    }

    const loadingDots = file.element.querySelector(".loading-dots");
    if (loadingDots) {
      loadingDots.remove();
      console.log("📄 ✅ Removed loading dots");
    }

    // Apply syntax highlighting now that the file is complete
    const codeElement = file.element.querySelector("pre code");
    if (codeElement) {
      try {
        console.log(
          `[DEBUG] finalizeFileBlock: Highlighting element for ${file.filename}. Class: '${codeElement.className}'`
        );

        console.log("highlighting code element number 11");
        this.highlightElementCode(codeElement);
        console.log(
          "🎨 Syntax highlighting applied to completed file:",
          file.filename
        );
      } catch (hlErr) {
        console.warn("🎨 Syntax highlighting failed on finalization:", hlErr);
      }
    }

    // Enable all buttons
    const allButtons = file.element.querySelectorAll(".block-btn");
    allButtons.forEach((button) => {
      button.disabled = false;
      button.removeAttribute("disabled");
      button.style.pointerEvents = "auto";
      button.style.cursor = "pointer";
      button.style.opacity = "1";

      if (!button.dataset.fileId) {
        button.dataset.fileId = `file_${file.id}`;
      }
    });
    console.log("📄 ✅ Enabled all buttons");

    // Update element ID for contentManager compatibility
    const blockId = file.element.id.replace("file_", "block_");
    file.element.id = blockId;
    console.log("📄 ✅ Updated element ID to:", blockId);

    // Mark as no longer streaming
    file.isStreaming = false;
    console.log("📄 ✅ Marked file as completed");
  },

  // In chatManager.js, replace the handleTextChunk function with this fixed version:

  handleTextChunk: function (data, version = 1) {
    console.log("🌊 === TEXT CHUNK HANDLER ===", data, version);
    // Ensure streamingTextBuffer is initialized
    if (
      this.streamingTextBuffer === undefined ||
      this.streamingTextBuffer === null
    ) {
      this.streamingTextBuffer = "";
    }

    // Ensure codeBlockBuffer is initialized
    if (this.codeBlockBuffer === undefined || this.codeBlockBuffer === null) {
      this.codeBlockBuffer = "";
    }

    // SAFETY CHECK: Ensure data.chunk exists and is a string
    const chunkContent =
      data && data.chunk && typeof data.chunk === "string" ? data.chunk : "";

    // ADD ENHANCED DEBUGGING
    if ($DebugTestMode) {
      console.log(
        "🌊 [handleTextChunk] Raw chunk:",
        chunkContent.substring(0, 100)
      );
      console.log("🌊 [handleTextChunk] Chunk length:", chunkContent.length);
      console.log(
        "🌊 [handleTextChunk] streamingTextBuffer length:",
        this.streamingTextBuffer ? this.streamingTextBuffer.length : "undefined"
      );
      console.log(
        "🌊 [handleTextChunk] data.accumulated exists:",
        !!data.accumulated
      );
      console.log(
        "🌊 [handleTextChunk] data.accumulated length:",
        data.accumulated ? data.accumulated.length : "N/A"
      );
    }

    // Hide thinking indicator on first chunk
    console.log("STREAM STATE", this.streamMessageCreated);
    if (!this.streamMessageCreated) {
      this.streamMessageCreated = true;
      if ($DebugTestMode)
        console.log("[INIT] First chunk - creating message container");
      messageManager.hideThinking();

      if (!this.streamingTextBuffer) {
        this.streamingTextBuffer = "";
      }

      const messageId = this.currentStreamMessageId;

      if ($DebugTestMode)
        console.log("[UI] Creating message container:", messageId);

      const content = document.getElementById("aiContent");
      if (!content) return;

      const message = document.createElement("div");
      message.id = messageId;
      message.className = "message ai-response streaming";
      message.dataset.messageId = messageId;

      message.dataset.version = version || 1;

      const time = new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });

      message.innerHTML = `
      <div class="message-header">
          <span class="message-type">AI</span>
      </div>
      <div class="message-content"></div>
      <div class="message-files"></div>
    `;

      content.appendChild(message);
      content.scrollTop = content.scrollHeight;

      // CRITICAL FIX: Use accumulated text for first chunk if available
      if (data.accumulated && typeof data.accumulated === "string") {
        if ($DebugTestMode) {
          console.log(
            "🌊 [handleTextChunk] Using accumulated text for initialization:",
            data.accumulated.length,
            "chars"
          );
        }
        this.streamingTextBuffer = data.accumulated;
      } else {
        // Fallback to chunk if no accumulated data
        if ($DebugTestMode) {
          console.log(
            "🌊 [handleTextChunk] No accumulated data, using chunk for initialization"
          );
        }
        this.streamingTextBuffer = chunkContent;
      }
    } else {
      // For subsequent chunks, use the accumulated text if available (more reliable)
      // Otherwise append the chunk
      if (data.accumulated && typeof data.accumulated === "string") {
        if ($DebugTestMode) {
          console.log(
            "🌊 [handleTextChunk] Updating with accumulated text:",
            data.accumulated.length,
            "chars"
          );
        }
        this.streamingTextBuffer = data.accumulated;
      } else {
        // Fallback: append chunk to existing buffer
        if ($DebugTestMode) {
          console.log("🌊 [handleTextChunk] Appending chunk to buffer");
        }
        if (chunkContent) {
          this.streamingTextBuffer += chunkContent;
        }
      }
    }

    // SAFETY CHECK: Create bufferForDetection with proper fallbacks
    let bufferForDetection = "";

    if (data && typeof data.accumulated === "string") {
      bufferForDetection = data.accumulated;
    } else if (
      this.streamingTextBuffer &&
      typeof this.streamingTextBuffer === "string"
    ) {
      bufferForDetection = this.streamingTextBuffer;
    } else {
      bufferForDetection = "";
      if ($DebugTestMode) {
        console.warn(
          "🌊 [SAFETY] Both data.accumulated and streamingTextBuffer are invalid, using empty string"
        );
      }
    }

    if ($DebugTestMode) {
      console.log(
        "🌊 [SAFETY] bufferForDetection length:",
        bufferForDetection.length
      );
      console.log(
        "🌊 [SAFETY] Last 200 chars:",
        bufferForDetection.substring(
          Math.max(0, bufferForDetection.length - 200)
        )
      );
    }

    // NEW: Check for JSON-wrapped files in streaming text EVERY chunk
    // This ensures we catch files as soon as they're complete
    if (bufferForDetection.length > 0) {
      console.log("🔍 Checking buffer for JSON files on chunk...");
      this.detectAndProcessJSONFiles(bufferForDetection);
    }

    // Update message content
    this.updateMessageContent();
  },
  renderFile: function (file) {
    // Your file rendering implementation here
    console.log("🖥️ Rendering file:", file.filename);

    // Example:
    const fileElement = document.createElement("div");
    fileElement.classList.add("file");
    fileElement.dataset.file = file.filename;

    // Add sections
    file.sections.forEach((section) => {
      const sectionEl = document.createElement("div");
      sectionEl.classList.add("section");
      sectionEl.dataset.section = section.name;
      sectionEl.textContent = section.content;
      fileElement.appendChild(sectionEl);
    });

    // Add to DOM
    document.getElementById("file-container").appendChild(fileElement);
  },
  detectAndProcessJSONFiles: function (buffer) {
    if (!buffer || typeof buffer !== "string") {
      console.log("🛑 Invalid buffer input:", buffer);
      return;
    }

    console.log("🔍 === DETECTING JSON FILES ===");

    // Initialize files array if missing
    if (!Array.isArray(this.files)) {
      console.warn("⚠️ this.files not initialized - creating empty array");
      this.files = [];
    }

    // Track processed files and JSON strings to remove
    const processedFilenames = new Set();
    const jsonStringsToRemove = new Set();
    let processedAnyFiles = false;

    // Look for JSON code blocks first
    const jsonCodeBlockRegex = /```json\s*\n([\s\S]*?)\n```/g;
    let match;
    let jsonBlockCount = 0;

    while ((match = jsonCodeBlockRegex.exec(buffer)) !== null) {
      jsonBlockCount++;
      const fullMatch = match[0];
      const jsonContent = match[1].trim();

      console.log(`🔧 Found JSON code block #${jsonBlockCount}`);
      try {
        const fileData = JSON.parse(jsonContent);
        console.log("🧩 Parsed JSON 1:", fileData);

        // Check if file with same ID already exists
        const alreadyExists = this.aiFilesFromThisResponse.some(
          (file) => file.id === fileData.id
        );

        if (!alreadyExists) {
          this.aiFilesFromThisResponse.push(fileData);
        }

        // Check if this is a partial update
        if (fileData.update_type === "partial") {
          console.log("🔄 Processing partial update:", fileData.filename);
          this.handlePartialFileUpdate(fileData, jsonContent);
          processedAnyFiles = true;
          jsonStringsToRemove.add(fullMatch); // Remove the JSON from display
        } else if (
          this.processFileData(fileData, jsonContent, processedFilenames)
        ) {
          console.log("✅ Processed file:", fileData.filename);
          processedAnyFiles = true;
          processedFilenames.add(fileData.filename);
          jsonStringsToRemove.add(fullMatch); // Remove the JSON from display
        }
      } catch (e) {
        console.log("🔍 JSON block parse error:", e.message);
      }
    }

    // If no ```json blocks found, look for raw JSON objects
    if (!processedAnyFiles) {
      console.log("🔎 No JSON blocks found. Scanning for raw JSON...");

      const jsonPatterns = [
        // Pattern for partial updates specifically
        /\{\s*"filename":\s*"[^"]+",[\s\S]*?"update_type":\s*"partial"[\s\S]*?\}\s*(?=\n\n|\n```|\n$|$)/gm,
        // Pattern for complete files
        /\{\s*"filename":\s*"[^"]+",[\s\S]*?"sections"[\s\S]*?\}\s*(?=\n\n|\n```|\n$|$)/gm,
        // General file pattern
        /\{\s*"filename":\s*"[^"]+",[\s\S]*?\}/gm,
      ];

      for (let i = 0; i < jsonPatterns.length; i++) {
        const pattern = jsonPatterns[i];
        console.log(`🧪 Trying JSON pattern ${i + 1}`);
        pattern.lastIndex = 0;
        let matchCount = 0;

        while ((match = pattern.exec(buffer)) !== null) {
          matchCount++;
          const jsonContent = match[0].trim();
          console.log(`🔧 Found raw JSON candidate #${matchCount}`);

          try {
            const fileData = JSON.parse(jsonContent);
            console.log("🧩 Parsed JSON:", fileData);

            // CRITICAL: Handle partial updates vs complete files
            if (fileData.update_type === "partial") {
              console.log(
                "🔄 Processing partial update for:",
                fileData.filename
              );
              this.handlePartialFileUpdate(fileData, jsonContent);
              processedAnyFiles = true;
              jsonStringsToRemove.add(jsonContent); // Remove from display
            } else if (
              this.processFileData(fileData, jsonContent, processedFilenames)
            ) {
              console.log("✅ Processed complete file:", fileData.filename);
              processedAnyFiles = true;
              processedFilenames.add(fileData.filename);
              jsonStringsToRemove.add(jsonContent); // Remove from display
            }
          } catch (e) {
            console.log("🔍 Raw JSON parse error:", e.message);
          }
        }

        if (processedAnyFiles) {
          console.log("✅ Processed files, stopping further regex checks.");
          break;
        }
      }
    }

    // CRITICAL: Remove JSON from display text to prevent showing raw JSON
    if (jsonStringsToRemove.size > 0) {
      console.log(
        `🧹 Removing ${jsonStringsToRemove.size} JSON strings from display buffer...`
      );
      let filteredText = buffer;

      jsonStringsToRemove.forEach((jsonStr) => {
        // Remove the JSON string and any surrounding whitespace
        filteredText = filteredText
          .replace(jsonStr, "")
          .replace(/\n\s*\n/g, "\n");
      });

      // Update the display buffer to exclude JSON
      this.displayTextBuffer = filteredText.trim();
      console.log("🔍 ✅ Removed JSON from display text");
      console.log("🔍 Display buffer length:", this.displayTextBuffer.length);
    } else {
      console.log("🛑 No JSON strings removed from buffer.");
    }

    console.log("🏁 Finished JSON detection.");
    return processedAnyFiles;
  },

  processFileData: function (fileData, rawJSON, processedFilenames) {
    if (!fileData.filename) return false;

    console.log(
      `🔍 Processing ${fileData.update_type || "full"} update for:`,
      fileData.filename
    );
    console.log("THIS IS THE FILE DATA ", fileData);

    if (fileData.update_type === "partial") {
      this.processFileUpdate(fileData);
      return true;
    }

    // Handle new file creation - FIXED LOGIC
    if (fileData.sections) {
      // Check if filename is new OR exists but hasn't been processed yet
      const fileExists = this.files.some(
        (f) => f.filename === fileData.filename
      );

      if (!fileExists || !processedFilenames.has(fileData.filename)) {
        console.log("📁 Creating new file:", fileData.filename);

        const fileId = fileData.id;
        console.log("fileId", fileId);
        const fileBlockData = {
          id: fileId.startsWith("file_") ? fileId : `file_${fileId}`,
          filename: fileData.filename,
          content: this.constructFileContent(fileData),
          language: fileData.language,
          type: "file",
          sections: fileData.sections,
          allFiles: this.files,
        };

        contentManager.findOrCreateBlock(fileBlockData);

        return true;
      }
      console.log("🔍 ⚠️ Skipping duplicate file:", fileData.filename);
    }
    return false;
  },
  // Helper to construct full file content from sections
  constructFileContent: function (fileData) {
    console.log("Starting constructFileContent with fileData:", fileData);

    if (fileData.content) {
      console.log("Returning direct content:", fileData.content);
      return fileData.content;
    }

    console.log("No direct content, constructing from sections");
    let content = "";
    for (const [sectionName, section] of Object.entries(fileData.sections)) {
      console.log(`Processing section: ${sectionName}`, section);
      content += section.content + "\n";
    }

    console.log("Final constructed content:", content);
    return content;
  },

  applyBasicFileUpdate: function (existingFile, updateData, originalJSON) {
    console.log("🔄 Applying basic file update for plain text");

    let updatedContent = existingFile.content || "";

    // For plain text updates, append the changes with clear markers
    if (updateData.sections_modified) {
      for (const [sectionName, sectionData] of Object.entries(
        updateData.sections_modified
      )) {
        updatedContent += `\n\n// Modified section: ${sectionName}\n`;
        updatedContent += sectionData.content;
      }
    }

    if (updateData.sections_added) {
      for (const [sectionName, sectionData] of Object.entries(
        updateData.sections_added
      )) {
        updatedContent += `\n\n// Added section: ${sectionName}\n`;
        updatedContent += sectionData.content;
      }
    }

    // Update the file
    existingFile.content = updatedContent;
    existingFile.originalContent = updatedContent;
    existingFile.size = updatedContent.length;
    existingFile.wordCount = updatedContent.split(/\s+/).length;

    // Update DOM and contentManager
    this.updateFileElementContent(existingFile);
    this.updateContentManagerBlock(existingFile);

    return true;
  },
  addUpdateIndicator: function (fileElement) {
    // Remove existing indicator
    const existingIndicator = fileElement.querySelector(".update-indicator");
    if (existingIndicator) {
      existingIndicator.remove();
    }

    // Add new indicator
    const indicator = document.createElement("div");
    indicator.className = "update-indicator";
    indicator.innerHTML = "🔄 Updated";
    indicator.style.cssText = `
    position: absolute;
    top: 10px;
    right: 10px;
    background: #4caf50;
    color: white;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    z-index: 10;
    animation: fadeInOut 3s forwards;
  `;

    // Add CSS animation if not exists
    if (!document.querySelector("#update-indicator-styles")) {
      const styles = document.createElement("style");
      styles.id = "update-indicator-styles";
      styles.textContent = `
      @keyframes fadeInOut {
        0% { opacity: 0; transform: translateY(-10px); }
        20% { opacity: 1; transform: translateY(0); }
        80% { opacity: 1; transform: translateY(0); }
        100% { opacity: 0; transform: translateY(-10px); }
      }
    `;
      document.head.appendChild(styles);
    }

    const header = fileElement.querySelector(".block-header");
    if (header) {
      header.style.position = "relative";
      header.appendChild(indicator);

      // Remove after animation
      setTimeout(() => {
        if (indicator.parentNode) {
          indicator.remove();
        }
      }, 3000);
    }
  },
  addSectionUpdateAnimation: function (filename, sectionName, action) {
    // This could be enhanced to highlight specific sections in the code
    console.log(
      `🔄 Animation: ${action} section ${sectionName} in ${filename}`
    );

    // For now, just log - could be enhanced with more sophisticated UI updates
    setTimeout(() => {
      const fileElements = document.querySelectorAll(
        `[data-filename="${filename}"]`
      );
      fileElements.forEach((element) => {
        element.classList.add(`section-${action}`);
        setTimeout(() => {
          element.classList.remove(`section-${action}`);
        }, 1000);
      });
    }, 100);
  },
  // NEW: Apply sectional updates to preserve JSON structure
  applySectionalUpdates: function (originalSections, updateData) {
    console.log("🔄 Applying sectional updates");
    console.log("🔄 Original sections:", Object.keys(originalSections));

    // Start with a copy of original sections
    const updatedSections = JSON.parse(JSON.stringify(originalSections));

    // Apply modified sections
    if (updateData.sections_modified) {
      for (const [sectionName, sectionData] of Object.entries(
        updateData.sections_modified
      )) {
        console.log(`🔄 Modifying section: ${sectionName}`);
        updatedSections[sectionName] = sectionData;

        // Add visual update marker for UI
        this.addSectionUpdateAnimation(
          updateData.filename,
          sectionName,
          "modified"
        );
      }
    }

    // Apply added sections
    if (updateData.sections_added) {
      for (const [sectionName, sectionData] of Object.entries(
        updateData.sections_added
      )) {
        console.log(`🔄 Adding section: ${sectionName}`);
        updatedSections[sectionName] = sectionData;

        // Add visual animation for new section
        this.addSectionUpdateAnimation(
          updateData.filename,
          sectionName,
          "added"
        );
      }
    }

    // Remove sections
    if (updateData.sections_removed && updateData.sections_removed.length > 0) {
      for (const sectionName of updateData.sections_removed) {
        console.log(`🔄 Removing section: ${sectionName}`);
        delete updatedSections[sectionName];
      }
    }

    console.log("🔄 Updated sections:", Object.keys(updatedSections));
    return updatedSections;
  },

  // NEW: Reconstruct file content from sections (preserving order)
  reconstructFileFromSections: function (sections) {
    console.log("🔄 Reconstructing file from sections");

    // Convert sections object to array and sort by start_line
    const sectionArray = Object.entries(sections).map(([name, section]) => ({
      name,
      ...section,
    }));

    // Sort by start_line if available, otherwise maintain original order
    sectionArray.sort((a, b) => {
      const aStart = a.start_line || 0;
      const bStart = b.start_line || 0;
      return aStart - bStart;
    });

    // Reconstruct content
    const reconstructedContent = sectionArray
      .map((section) => section.content)
      .join("\n");

    console.log(
      "🔄 Reconstructed content length:",
      reconstructedContent.length
    );
    return reconstructedContent;
  },

  // NEW: Update existing file in place (preserving references)
  updateExistingFileInPlace: function (
    existingFile,
    newContent,
    newSections,
    updateData,
    originalJSON
  ) {
    console.log("🔄 Updating existing file in place");

    // Update the file object properties
    existingFile.content = newContent;
    existingFile.originalContent = newContent;
    existingFile.sections = newSections;
    existingFile.size = newContent.length;
    existingFile.wordCount = newContent.split(/\s+/).length;

    // Store update metadata
    existingFile.lastUpdate = {
      timestamp: new Date().toISOString(),
      updateType: updateData.update_type,
      sectionsModified: Object.keys(updateData.sections_modified || {}),
      sectionsAdded: Object.keys(updateData.sections_added || {}),
      sectionsRemoved: updateData.sections_removed || [],
      originalJSON: originalJSON,
    };

    // Update the DOM element if it exists
    this.updateFileElementContent(existingFile);

    // Update contentManager block if it exists
    this.updateContentManagerBlock(existingFile);

    console.log("🔄 ✅ File updated in place");
  },
  updateFileElementContent: function (file) {
    const fileElement =
      file.element ||
      document.getElementById(`block_${file.id}`) ||
      document.querySelector(`[data-file-id="${file.id}"]`);

    if (!fileElement) {
      console.warn("🔄 ⚠️ No file element found for update");
      return;
    }

    // Find the code element
    const codeElement = fileElement.querySelector("code, .streaming-code");
    if (codeElement) {
      codeElement.textContent = file.content;

      console.log("highlighting code element number 1");
      this.highlightElementCode(codeElement);

      // Add update indicator
      this.addUpdateIndicator(fileElement);

      console.log("🔄 ✅ DOM element updated");
    }
  },
  // NEW: Find existing file in current streaming response specifically
  findExistingFileInCurrentResponse: function (filename) {
    console.log("🔍 === SEARCHING FOR EXISTING FILE ===");
    console.log("🔍 Target filename:", filename);

    // STRATEGY 1: Check current message's DOM elements directly
    if (this.currentStreamMessageId) {
      const message = document.getElementById(this.currentStreamMessageId);
      if (message) {
        console.log(
          "🔍 Searching in current message:",
          this.currentStreamMessageId
        );

        // Find all file blocks in current message
        const fileBlocks = message.querySelectorAll(".file-block");
        console.log("🔍 Found file blocks:", fileBlocks.length);

        for (const block of fileBlocks) {
          const blockFilename = block.querySelector(".filename")?.textContent;
          console.log("🔍 Checking block filename:", blockFilename);

          if (blockFilename === filename) {
            console.log("🔍 ✅ FOUND MATCHING FILENAME IN DOM");

            // Extract IDs from the DOM element
            const blockId = block.id; // e.g., "block_block_688d5efaa30a6"
            const dataFileId = block.getAttribute("data-file-id"); // e.g., "file_file_688d5efaa30a6"

            console.log("🔍 Block ID:", blockId);
            console.log("🔍 Data File ID:", dataFileId);

            // Try to find in contentManager using various ID patterns
            const possibleContentManagerIds = [
              blockId, // "block_block_688d5efaa30a6"
              blockId.replace("block_block_", "file_"), // "file_688d5efaa30a6"
              blockId.replace("block_", "file_"), // "file_block_688d5efaa30a6"
              dataFileId, // "file_file_688d5efaa30a6"
              dataFileId.replace("file_file_", "file_"), // "file_688d5efaa30a6"
              dataFileId.replace("file_", ""), // "file_688d5efaa30a6" -> "688d5efaa30a6"
            ];

            console.log(
              "🔍 Trying contentManager IDs:",
              possibleContentManagerIds
            );

            for (const cmId of possibleContentManagerIds) {
              const contentBlock = contentManager.blocks.get(cmId);
              if (contentBlock) {
                console.log("🔍 ✅ FOUND IN CONTENTMANAGER with ID:", cmId);
                return {
                  ...contentBlock,
                  domElement: block,
                  domId: blockId,
                  dataFileId: dataFileId,
                  source: "contentManager",
                };
              }
            }

            // If not in contentManager, create file info from DOM
            console.log("🔍 Not in contentManager, extracting from DOM");
            const codeElement = block.querySelector("code");
            const content = codeElement ? codeElement.textContent : "";

            return {
              id: dataFileId || blockId,
              filename: filename,
              content: content,
              originalContent: content,
              extension: block.getAttribute("data-extension") || ".js",
              language: block.getAttribute("data-language") || "javascript",
              type: block.getAttribute("data-type") || "javascript",
              domElement: block,
              domId: blockId,
              dataFileId: dataFileId,
              source: "dom",
            };
          }
        }
      }
    }

    // STRATEGY 2: Check streamingResponseFiles (for current streaming)
    if (this.streamingResponseFiles && this.streamingResponseFiles.length > 0) {
      console.log(
        "🔍 Checking streamingResponseFiles:",
        this.streamingResponseFiles.length
      );
      const responseFile = this.streamingResponseFiles.find(
        (f) => f.filename === filename
      );
      if (responseFile) {
        console.log("🔍 ✅ FOUND IN STREAMING RESPONSE FILES");
        return {
          ...responseFile,
          source: "streamingResponse",
        };
      }
    }

    // STRATEGY 3: Check streamingFiles map with all possible key patterns
    if (this.streamingFiles && this.streamingFiles.size > 0) {
      console.log("🔍 Checking streamingFiles map");
      console.log(
        "🔍 StreamingFiles keys:",
        Array.from(this.streamingFiles.keys())
      );

      // Direct filename lookup
      for (const [key, streamingFile] of this.streamingFiles.entries()) {
        if (streamingFile.filename === filename) {
          console.log("🔍 ✅ FOUND IN STREAMING FILES by filename");
          return {
            ...streamingFile,
            source: "streamingFiles",
          };
        }
      }
    }

    // STRATEGY 4: Global search in contentManager blocks
    console.log("🔍 Global search in contentManager blocks");
    for (const [blockId, block] of contentManager.blocks) {
      if (block.filename === filename) {
        console.log("🔍 ✅ FOUND IN CONTENTMANAGER GLOBAL SEARCH");
        return {
          ...block,
          source: "contentManagerGlobal",
        };
      }
    }

    console.log("🔍 ❌ NO EXISTING FILE FOUND");
    return null;
  },

  // New method to find files globally (current streaming + previous messages)
  findExistingFileGlobally: function (filename) {
    // First check current streaming files
    for (const [key, file] of this.streamingFiles.entries()) {
      if (file.filename === filename) {
        return file;
      }
    }

    // Check current streaming response files
    const streamingFile = this.streamingResponseFiles.find(
      (f) => f.filename === filename
    );
    if (streamingFile) {
      return streamingFile;
    }

    // Check contentManager blocks
    if (typeof contentManager !== "undefined") {
      for (const [blockId, block] of contentManager.blocks.entries()) {
        if (block.filename === filename) {
          return block;
        }
      }
    }

    // Check recent chat history for files with same name
    if (typeof appState !== "undefined" && appState.chatHistory) {
      for (let i = appState.chatHistory.length - 1; i >= 0; i--) {
        const message = appState.chatHistory[i];
        if (message.files && message.files.length > 0) {
          const historyFile = message.files.find(
            (f) => f.filename === filename
          );
          if (historyFile) {
            return historyFile;
          }
        }
      }
    }

    return null;
  },
  // Apply updates to existing content
  applyUpdatesToContent: function (originalContent, updateData) {
    console.log("🔄 Applying updates to content");

    let updatedContent = originalContent;

    // For now, implement a simple approach
    // In a more sophisticated system, you'd parse the content into sections
    // and apply precise updates

    // Apply modified sections
    if (updateData.sections_modified) {
      for (const [sectionName, sectionData] of Object.entries(
        updateData.sections_modified
      )) {
        console.log(`🔄 Modifying section: ${sectionName}`);

        // For JavaScript files, try to replace function definitions
        if (sectionName === "add_task" || sectionName.includes("addTask")) {
          // Replace the addTask function
          const functionRegex =
            /function\s+addTask\s*\([^)]*\)\s*\{[^}]*(?:\{[^}]*\}[^}]*)*\}/;
          if (functionRegex.test(updatedContent)) {
            updatedContent = updatedContent.replace(
              functionRegex,
              sectionData.content
            );
          } else {
            // If no existing function found, prepend the new one
            updatedContent = sectionData.content + "\n" + updatedContent;
          }
        } else {
          // Generic replacement - append the new content
          updatedContent += "\n\n// Updated section: " + sectionName + "\n";
          updatedContent += sectionData.content;
        }
      }
    }

    // Apply added sections
    if (updateData.sections_added) {
      for (const [sectionName, sectionData] of Object.entries(
        updateData.sections_added
      )) {
        console.log(`🔄 Adding section: ${sectionName}`);
        updatedContent += "\n\n// New section: " + sectionName + "\n";
        updatedContent += sectionData.content;
      }
    }

    // Handle removed sections (simplified)
    if (updateData.sections_removed && updateData.sections_removed.length > 0) {
      console.log(
        `🔄 Removing sections: ${updateData.sections_removed.join(", ")}`
      );
      // In a real implementation, you'd locate and remove these sections
    }

    return updatedContent;
  },

  // Generate a summary of changes
  generateChangesSummary: function (updateData) {
    const changes = [];

    if (updateData.sections_modified) {
      const modified = Object.keys(updateData.sections_modified);
      if (modified.length > 0) {
        changes.push(
          `Modified ${modified.length} section(s): ${modified.join(", ")}`
        );
      }
    }

    if (updateData.sections_added) {
      const added = Object.keys(updateData.sections_added);
      if (added.length > 0) {
        changes.push(`Added ${added.length} section(s): ${added.join(", ")}`);
      }
    }

    if (updateData.sections_removed && updateData.sections_removed.length > 0) {
      changes.push(
        `Removed ${
          updateData.sections_removed.length
        } section(s): ${updateData.sections_removed.join(", ")}`
      );
    }

    return changes.join("; ");
  },

  // Create display for updated file
  createUpdatedFileDisplay: function (updatedFile) {
    console.log("🏗️ Creating display for updated file:", updatedFile.filename);

    const message = document.getElementById(this.currentStreamMessageId);
    if (!message) {
      console.error("🏗️ ❌ No current message element");
      return;
    }

    // Find or create files container
    let filesContainer = message.querySelector(".message-files");
    if (!filesContainer) {
      filesContainer = document.createElement("div");
      filesContainer.className = "message-files";
      filesContainer.style.display = "block";
      filesContainer.style.visibility = "visible";
      filesContainer.style.opacity = "1";
      message.appendChild(filesContainer);
    }

    // Create enhanced file block with update indicators
    console.log("id check:createUpdatedFileBlock creation", updatedFile.id);
    const fileBlockHtml = this.createUpdatedFileBlock(updatedFile);
    filesContainer.insertAdjacentHTML("beforeend", fileBlockHtml);

    // Find the created element
    const fileElement = document.getElementById(`block_${updatedFile.id}`);
    if (!fileElement) {
      console.error("🏗️ ❌ File element not created");
      return;
    }

    // ADD THIS: Apply syntax highlighting
    const codeElement = fileElement.querySelector("pre code");
    if (codeElement) {
      console.log("highlighting code element number 2");
      this.highlightElementCode(codeElement);
    }

    // Update the streaming file reference
    const streamingFile = this.streamingFiles.get(updatedFile.id);
    if (streamingFile) {
      streamingFile.element = fileElement;
    }

    // Store in contentManager
    if (typeof contentManager !== "undefined") {
      console.log("id check:contentManager array creation", updatedFile.id);
      contentManager.findOrCreateBlock(blockData);
      console.log("🏗️ ✅ Updated file registered with contentManager");
    }

    // Auto-scroll
    const content = document.getElementById("aiContent");
    if (content && this.isNearBottom(content)) {
      content.scrollTop = content.scrollHeight;
    }

    console.log("🏗️ ✅ Updated file displayed");
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

  // Replace the entire old function with this new one.
  detectFileType: function (language) {
    // Return a general category based on the specific language.
    if (!language) {
      return "text";
    }
    const langStr = String(language).toLowerCase();

    // Mapping from specific language to a general file type category
    const typeMap = {
      javascript: "code",
      js: "code",
      python: "code",
      py: "code",
      java: "code",
      c: "code",
      cpp: "code",
      csharp: "code",
      go: "code",
      rust: "code",
      php: "code",
      ruby: "code",
      html: "web",
      htm: "web",
      css: "style",
      json: "data",
      sql: "data",
      xml: "data",
      yaml: "data",
      markdown: "document",
      md: "document",
    };

    // Default to 'code' for unrecognized languages, as they are often code-based.
    return typeMap[langStr] || "code";
  },
  // Create file block HTML with update indicators
  createUpdatedFileBlock: function (fileData) {
    const fileIcon =
      typeof contentManager !== "undefined"
        ? contentManager.getFileIcon(fileData.type, fileData.extension)
        : this.getFallbackFileIcon(fileData.extension);
    // Default to the fileId from the block object.
    let displayId = block.fileId;

    // Check if the content is a JSON string with a nested 'id'.
    if (
      typeof block.originalContent === "string" &&
      block.originalContent.trim().startsWith("{")
    ) {
      try {
        const innerData = JSON.parse(block.originalContent);
        if (innerData.id) {
          // If a nested ID is found, use it for the HTML block.
          displayId = innerData.id;
        }
      } catch (e) {
        // Content is not parsable JSON, so we'll use the default displayId.
      }
    }
    const fileTypeClass = this.getFileTypeClass(fileData.extension);
    const languageClass =
      fileData.language || this.getLanguageFromExtension(fileData.filename);

    // Create update badge
    const updateBadge = fileData.updateInfo
      ? `<span class="update-badge" title="${fileData.updateInfo.changesSummary}">🔄 Updated</span>`
      : "";

    return `
    <div class="content-block file-block ${fileTypeClass} updated-file" 
         id="block_${displayId}" 
         data-type="${fileData.type}" 
         data-extension="${fileData.extension}"
         data-language="${languageClass}"
         data-file-id="${
           displayId.startsWith("file_") ? displayId : `file_${displayId}`
         }"
         data-is-update="true"
         style="display: block !important; visibility: visible !important; opacity: 1 !important;">
      
      <div class="block-header">
        <div class="block-info">
          <div class="block-icon">${fileIcon}</div>
          <div class="block-details">
            <h4 class="filename">${this.escapeHtml(fileData.filename)}</h4>
          </div>
        </div>
        
        <div class="block-actions" style="position: relative; z-index: 10;">
          <button class="block-btn primary" 
                  data-action="preview" 
                  data-file-id="${
                    displayId.startsWith("file_")
                      ? displayId
                      : `file_${displayId}`
                  }"
                  ${
                    fileData.extension === ".html" ||
                    fileData.extension === ".htm"
                      ? ""
                      : "disabled"
                  }
                  style="${
                    fileData.extension === ".html" ||
                    fileData.extension === ".htm"
                      ? "pointer-events: auto !important; cursor: pointer !important; opacity: 1;"
                      : "pointer-events: none !important; cursor: not-allowed !important; opacity: 0.5;"
                  }">
            👁️ Live Preview
          </button>
          <button class="block-btn" data-action="download" data-file-id="${
            displayId.startsWith("file_") ? displayId : `file_${displayId}`
          }">⬇️ Download</button>
          <button class="block-btn" data-action="copy" data-file-id="${
            displayId.startsWith("file_") ? displayId : `file_${displayId}`
          }">📋 Copy</button>
          <span class="collapse-indicator">▼</span>
        </div>
      </div>
      
      <div class="block-content" style="display: block !important;">
        <div class="code-preview">
          <code class="language-${languageClass}" data-file-id="${
      displayId.startsWith("file_") ? displayId : `file_${displayId}`
    }">${this.escapeHtml(fileData.content)}</code>
        </div>
      </div>
    </div>
  `;
  },
  applySectionAnimation: function (filename, sectionName, action) {
    // Use a timeout to allow DOM updates to complete
    setTimeout(() => {
      const element = this.findSectionElement(filename, sectionName);
      if (!element) {
        console.log(`⚠️ Element not found: ${filename} > ${sectionName}`);
        return;
      }

      // Apply appropriate animation
      if (action === "update") {
        element.classList.add("section-updating");
        setTimeout(() => {
          element.classList.remove("section-updating");
        }, 1000);
      } else if (action === "add") {
        element.classList.add("new-section");
        setTimeout(() => {
          element.classList.remove("new-section");
        }, 1500);
      }
    }, 300);
  },

  findSectionElement: function (filename, sectionName) {
    // This is a simplified selector - adjust based on your actual DOM structure
    return document.querySelector(
      `[data-file="${filename}"] [data-section="${sectionName}"]`
    );
  },
  processJSONWrappedFile: function (fileData, originalJSON) {
    console.log("📁 === PROCESSING JSON WRAPPED FILE (Nested ID Fix) ===");
    console.log("📁 Outer file data received:", fileData);

    let trueFileData = fileData;
    let trueContent = "";

    // --- FIX: Check for and parse nested JSON in the 'content' field ---
    // This is where we find the REAL file data, as you specified.
    if (
      typeof fileData.content === "string" &&
      fileData.content.trim().startsWith("{")
    ) {
      try {
        const innerData = JSON.parse(fileData.content);
        if (innerData.id && innerData.filename) {
          // The inner JSON is the real file data
          trueFileData = innerData;
          console.log(
            "📁 ✅ Parsed nested JSON. Using inner data as source of truth.",
            trueFileData
          );
        }
      } catch (e) {
        console.warn(
          "📁 ⚠️ Content looked like JSON but failed to parse. Proceeding with outer data.",
          e
        );
      }
    }

    // Reconstruct the visible content from the 'sections' of the true file data.
    if (trueFileData.sections) {
      trueContent = this.constructFileContent(trueFileData);
    } else {
      // Fallback for older formats that might just have content directly
      trueContent = trueFileData.content || "";
    }

    // --- Use the definitive ID from the true file data ---
    const fileId = trueFileData.id;
    if (!fileId) {
      console.error(
        `CRITICAL: No definitive ID found for file ${trueFileData.filename}. Aborting file creation.`
      );
      return;
    }

    // Check if a file with this ID or filename already exists to prevent duplicates
    const existingInMap = Array.from(this.streamingFiles.values()).find(
      (f) => f.id === fileId || f.filename === trueFileData.filename
    );
    if (existingInMap) {
      console.log(
        "📁 ⚠️ File already exists, skipping:",
        trueFileData.filename
      );
      return;
    }

    // --- Proceed using the definitive ID and content ---
    const displayFileData = {
      id: fileId,
      filename: trueFileData.filename,
      extension: this.getFileExtension(trueFileData.filename),
      language:
        trueFileData.language ||
        this.getLanguageFromExtension(trueFileData.filename),
      content: trueContent,
      type: this.detectFileType(
        trueFileData.language ||
          this.getLanguageFromExtension(trueFileData.filename)
      ),
      is_executable: this.isExecutableFile(trueFileData.filename),
      mime_type: this.getMimeType(this.getFileExtension(trueFileData.filename)),
      size: trueContent.length,
      metadata: trueFileData.metadata,
      originalJSON: originalJSON, // Store the original outer JSON for debugging
      sections: trueFileData.sections,
    };

    console.log("📁 Display file data created with definitive ID:", {
      id: displayFileData.id,
      filename: displayFileData.filename,
    });

    if (!this.streamingFiles.has(fileId)) {
      this.streamingFiles.set(fileId, {
        ...displayFileData,
        element: null,
        isStreaming: false,
        frontendId: `block_${fileId}`,
        backendId: fileId,
      });
    }

    if (
      !this.streamingResponseFiles.find(
        (f) => f.filename === trueFileData.filename
      )
    ) {
      this.streamingResponseFiles.push(displayFileData);
    }

    // Create the file element
    const fileElement = this.createFileFromJSONData(displayFileData);

    // Update the streaming file reference with the created element
    const streamingFile = this.streamingFiles.get(displayFileData.id);
    if (streamingFile && fileElement) {
      streamingFile.element = fileElement;
    }

    // Store in contentManager
    if (typeof contentManager !== "undefined") {
      // Collect linked files (CSS/JS for HTML files)
      const linkedFiles = [];
      if (
        displayFileData.extension === ".html" ||
        displayFileData.extension === ".htm"
      ) {
        // Find CSS and JS files in current response
        const cssFiles = this.streamingResponseFiles.filter(
          (f) => f.extension === ".css"
        );
        const jsFiles = this.streamingResponseFiles.filter(
          (f) => f.extension === ".js"
        );
        linkedFiles.push(...cssFiles, ...jsFiles);
      }

      const blockData = {
        id: `file_${displayFileData.id}`,
        filename: displayFileData.filename,
        content: displayFileData.content,
        originalContent: displayFileData.content,
        extension: displayFileData.extension,
        language: displayFileData.language,
        type: displayFileData.type,
        size: displayFileData.content.length,
        wordCount: displayFileData.content.split(/\s+/).length,
        isExecutable: displayFileData.is_executable,
        mimeType: displayFileData.mime_type,
        collapsed: false,
        linkedFiles: linkedFiles,
        allFiles: this.streamingResponseFiles,
        metadata: displayFileData.metadata,
        originalJSON: displayFileData.originalJSON,
        sections: displayFileData.sections,
      };

      contentManager.blocks.set(`file_${displayFileData.id}`, blockData);
      console.log("🏗️ ✅ Registered with contentManager");
    }

    // Auto-scroll
    const content = document.getElementById("aiContent");
    if (content && this.isNearBottom(content)) {
      content.scrollTop = content.scrollHeight;
    }

    console.log(
      "📁 ✅ JSON wrapped file processed and displayed:",
      trueFileData.filename
    );
  },

  createFileFromJSONData: function (fileData) {
    console.log("🏗️ === CREATING FILE FROM JSON DATA ===");
    console.log("🏗️ Creating file:", fileData.filename);

    const message = document.getElementById(this.currentStreamMessageId);
    if (!message) {
      console.error("🏗️ ❌ No current message element");
      return null;
    }

    // Find or create files container
    let filesContainer = message.querySelector(".message-files");
    if (!filesContainer) {
      console.log("🏗️ Creating files container");
      filesContainer = document.createElement("div");
      filesContainer.className = "message-files";
      filesContainer.style.display = "block";
      filesContainer.style.visibility = "visible";
      filesContainer.style.opacity = "1";
      message.appendChild(filesContainer);
    }

    // Create file block HTML
    const fileBlockHtml = this.createCompletedFileBlock(fileData);
    filesContainer.insertAdjacentHTML("beforeend", fileBlockHtml);

    // Find the created element
    const fileElement = document.getElementById(`block_${fileData.id}`);
    if (!fileElement) {
      console.error("🏗️ ❌ File element not created");
      return null;
    }

    // ADD THIS: Apply syntax highlighting
    const codeElement = fileElement.querySelector("pre code");
    if (codeElement) {
      console.log("highlighting code element number 3");
      this.highlightElementCode(codeElement);
    }

    console.log("🏗️ ✅ File element created");
    return fileElement;
  },

  createCompletedFileBlock: function (fileData) {
    console.log("🏗️ === CREATING COMPLETED FILE BLOCK ===", fileData);
    console.log("🏗️ Creating completed file block for:", fileData.filename);

    const fileIcon =
      typeof contentManager !== "undefined"
        ? contentManager.getFileIcon(fileData.type, fileData.extension)
        : this.getFallbackFileIcon(fileData.extension);
    // Default to the fileId from the block object.
    let displayId = fileData.id;

    // Check if the content is a JSON string with a nested 'id'.
    if (
      typeof fileData.content === "string" &&
      fileData.content.trim().startsWith("{")
    ) {
      try {
        const innerData = JSON.parse(fileData.content);
        if (innerData.id) {
          // If a nested ID is found, use it for the HTML block.
          displayId = innerData.id;
        }
      } catch (e) {
        // Content is not parsable JSON, so we'll use the default displayId.
      }
    }
    // Get proper file type class based on extension
    const fileTypeClass = this.getFileTypeClass(fileData.extension);
    const languageClass =
      fileData.language || this.getLanguageFromExtension(fileData.filename);

    return `
  <div class="content-block file-block ${fileTypeClass}" 
       id="block_${displayId}" 
       data-type="${fileData.type}" 
       data-extension="${fileData.extension}"
       data-language="${languageClass}"
       data-file-id="${
         displayId.startsWith("file_") ? displayId : `file_${displayId}`
       }"
       style="display: block !important; visibility: visible !important; opacity: 1 !important;">
    <div class="block-header">
      <div class="block-info">
        <div class="block-icon">${fileIcon}</div>
        <div class="block-details">
          <h4 class="filename">${this.escapeHtml(fileData.filename)}</h4>

        </div>
      </div>
      <div class="block-actions" style="position: relative; z-index: 10;">
        <button class="block-btn primary" 
                data-action="preview" 
                data-file-id="${
                  displayId.startsWith("file_")
                    ? displayId
                    : `file_${displayId}`
                }"
                ${
                  fileData.extension === ".html" ||
                  fileData.extension === ".htm"
                    ? ""
                    : "disabled"
                }
                style="${
                  fileData.extension === ".html" ||
                  fileData.extension === ".htm"
                    ? "pointer-events: auto !important; cursor: pointer !important; opacity: 1;"
                    : "pointer-events: none !important; cursor: not-allowed !important; opacity: 0.5;"
                }">
          👁️ Live Preview
        </button>
        <button class="block-btn" data-action="download" data-file-id="${
          displayId.startsWith("file_") ? displayId : `file_${displayId}`
        }">⬇️ Download</button>
        <button class="block-btn" data-action="copy" data-file-id="${
          displayId.startsWith("file_") ? displayId : `file_${displayId}`
        }">📋 Copy</button>
        <span class="collapse-indicator">▼</span>
      </div>
    </div>
    <div class="block-content" style="display: block !important;">
      <div class="code-preview">
      <pre><code class="language-${languageClass}" data-file-id="${
      displayId.startsWith("file_") ? displayId : `file_${displayId}`
    }">${this.escapeHtml(fileData.content)}</code></pre>
      </div>
    </div>
  </div>
  `;
  },

  // In chatManager.js
  getLanguageFromExtension: function (filename) {
    const ext = this.getFileExtension(filename).toLowerCase();
    const languageMap = {
      ".html": "html",
      ".htm": "html",
      ".css": "css",
      ".js": "javascript",
      ".json": "json",
      ".py": "python",
      ".php": "php",
      ".java": "java",
      ".cpp": "cpp",
      ".c": "c",
      ".md": "markdown",
      ".xml": "xml",
      ".sql": "sql",
      ".sh": "bash",
      ".yml": "yaml",
      ".yaml": "yaml",
    };
    const lang = languageMap[ext] || "plaintext";
    console.log(
      `[DEBUG] chatManager.getLanguageFromExtension: input='${ext}', output='${lang}'`
    );
    return lang;
  },

  isExecutableFile: function (filename, extension, content) {
    if (!extension && filename) {
      extension = this.getFileExtension(filename);
    }

    const ext = extension?.toLowerCase();

    // Define executable extensions
    const executableExts = [
      ".html",
      ".htm",
      ".js",
      ".py",
      ".php",
      ".sh",
      ".bat",
    ];

    // Check by extension first
    if (executableExts.includes(ext)) {
      return true;
    }

    // Check by content for HTML
    if (
      content &&
      /<(!DOCTYPE|html|head|body|div|script|style)/i.test(content)
    ) {
      return true;
    }

    return false;
  },

  updateMessageContent: function () {
    const message = document.getElementById(this.currentStreamMessageId);
    if (message) {
      const contentEl = message.querySelector(".message-content");

      // Use a clear buffer variable
      let buffer = this.displayTextBuffer || this.streamingTextBuffer;

      // Find the starting position of the metadata block
      const metadataIndex = buffer.indexOf("[METADATA]");

      // If [METADATA] is found, truncate the buffer to exclude it and everything after.
      // Otherwise, use the whole buffer.
      let displayText =
        metadataIndex !== -1 ? buffer.substring(0, metadataIndex) : buffer;

      // The existing logic to remove raw JSON definitions from the text is still useful.
      // This prevents file data from being displayed in the chat bubble after it's
      // been processed into a file block.

      // Remove JSON code blocks (```json ... ```)
      displayText = displayText.replace(/```json\s*\n[\s\S]*?\n```/g, "");

      // Remove standalone JSON objects that look like file data
      displayText = displayText.replace(
        /\{\s*"filename":\s*"[^"]+",[\s\S]*?"language":\s*"[^"]*",[\s\S]*?"sections":\s*\{[\s\S]*?\}\s*\}/g,
        ""
      );

      // Remove any remaining isolated JSON that occupies a full line
      displayText = displayText.replace(
        /^\s*\{[\s\S]*?\}\s*$/gm,
        function (match) {
          // Only remove if it looks like file data
          if (match.includes('"filename"') && match.includes('"sections"')) {
            return "";
          }
          return match; // Keep other legitimate JSON
        }
      );

      // Clean up any remaining whitespace
      displayText = displayText.trim();

      // Render the cleaned text to the DOM
      if (
        typeof messageManager !== "undefined" &&
        messageManager.formatMessage
      ) {
        contentEl.innerHTML = messageManager.formatMessage(displayText, true);
      } else {
        // Fallback formatting for plain text
        contentEl.innerHTML = displayText
          .replace(/\n\n/g, "</p><p>")
          .replace(/\n/g, "<br>")
          .replace(/^/, "<p>")
          .replace(/$/, "</p>")
          .replace("<p></p>", "");
      }

      // Ensure the files container is always visible for consistency
      const filesContainer = message.querySelector(".message-files");
      if (filesContainer) {
        filesContainer.style.display = "block";
        filesContainer.style.visibility = "visible";
        filesContainer.style.opacity = "1";
      }

      // Auto-scroll the chat window if the user is near the bottom
      const content = document.getElementById("aiContent");
      if (content && this.isNearBottom(content)) {
        content.scrollTop = content.scrollHeight;
      }
    }
  },

  createMessageFooter: function (msg, versionNav, callbacks = {}) {
    // Set default callbacks or use provided ones
    const {
      onEdit = (msgId) => messageManager.startEdit(msgId),
      onCopy = (msgId) => messageManager.copyMessage(msgId),
      onRate = (msgId, rating) => messageManager.rateMessage(msgId, rating),
      onRetry = (msgId) => messageManager.retryMessage(msgId),
    } = callbacks;

    // Generate unique function names to avoid conflicts
    const editFn = `editMsg_${msg.id}`;
    const copyFn = `copyMsg_${msg.id}`;
    const rateFn = `rateMsg_${msg.id}`;
    const retryFn = `retryMsg_${msg.id}`;

    // Attach functions to window for onclick handlers
    window[editFn] = () => onEdit(msg.id);
    window[copyFn] = () => onCopy(msg.id);
    window[rateFn] = (rating) => onRate(msg.id, rating);
    window[retryFn] = () => onRetry(msg.id);

    const footerContent =
      msg.type === "user"
        ? `             <button class="copy-btn" onclick="${copyFn}()" title="Copy">
               <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                 <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                 <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
               </svg>
             </button>
             <button class="message-edit-btn" onclick="${editFn}()">
           Edit
         </button>`
        : `<div class="ai-message-controls">
           <div class="button-row">
             <button class="copy-btn" onclick="${copyFn}()" title="Copy">
               <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                 <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                 <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
               </svg>
             </button>
             
             <button class="thumbs-up-btn" onclick="${rateFn}('up')" title="Good response">
               <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                 <path d="M7 10v12"></path>
                 <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2h0a3.13 3.13 0 0 1 3 3.88Z"></path>
               </svg>
             </button>
             
             <button class="thumbs-down-btn" onclick="${rateFn}('down')" title="Poor response">
               <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                 <path d="M17 14V2"></path>
                 <path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22h0a3.13 3.13 0 0 1-3-3.88Z"></path>
               </svg>
             </button>
             
             <button class="retry-btn" onclick="${retryFn}()" title="Retry">
               <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                 <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path>
                 <path d="M21 3v5h-5"></path>
                 <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"></path>
                 <path d="M3 21v-5h5"></path>
               </svg>
             </button>
           </div>
           
           <div class="ai-warning">
             Micro Learner<span class="ai-text">AI</span> can make mistakes. Please double-check responses.
           </div>
         </div>`;

    return `
      <div class="message-footer">
        ${footerContent}
        ${versionNav}
      </div>
    `;
  },

  highlightElementCode: function (codeElement) {
    console.log("🎉 Highlighting code element:", codeElement);
    if (typeof hljs !== "undefined") {
      console.log(
        "🎉 hljs is defined, applying syntax highlighting!!!!!!!!!!!!!!!!!!!"
      );
      hljs.highlightElement(codeElement);
    } else {
      console.warn("🎉 ⚠️ hljs not defined, skipping syntax highlighting");
    }
  },

  updateLocalStoredUserFilesToJsonFormat: function (data) {
    try {
      // Check if data is provided
      if (data === undefined || data === null) {
        console.warn(
          "No data provided to updateLocalStoredUserFilesToJsonFormat"
        );
        return;
      }

      let filesData = null;
      let conversationId = data.conversation_id;

      // If data is already a string, try to parse it as JSON
      if (typeof data === "string") {
        try {
          const parsedData = JSON.parse(data);
          // Extract user_files from parsed data
          filesData = parsedData.user_files;
          console.log("Parsed JSON data and extracted user_files:", filesData);
        } catch (parseError) {
          console.log("Raw string data (not JSON):", data);
          return data;
        }
      }
      // If data is an object, extract user_files property
      else if (typeof data === "object") {
        // Extract user_files from the data object
        filesData = data.user_files;
        console.log(
          "Extracted user_files from object data:",
          JSON.stringify(filesData, null, 2)
        );
      }
      // For other data types (number, boolean, etc.)
      else {
        console.log("Data:", data);
        return data;
      }

      // Check if filesData contains files (could be array or single file object)
      if (!filesData) {
        console.warn("No user_files data found in the provided data");
        return;
      }

      // Convert single file to array for consistent processing
      const files = Array.isArray(filesData) ? filesData : [filesData];

      if (files.length === 0) {
        console.warn("No files to process in user_files");
        return;
      }

      // Get the AI message element using currentStreamMessageId
      const aiMessage = document.getElementById(this.currentStreamMessageId);

      if (!aiMessage) {
        console.error(
          `AI message element with ID ${this.currentStreamMessageId} not found`
        );
        return;
      }

      console.log(`Found AI message element:`, aiMessage);

      // Find the previous sibling that is a user message with display flex
      let prevElement = aiMessage.previousElementSibling;
      console.log(`Starting search for previous user message...`);

      let userMessageId = null;
      let iteration = 0;

      // Traverse backwards until we find a user message
      while (prevElement) {
        console.log(`Checking element #${iteration}:`, prevElement);
        console.log(`Class list:`, prevElement.classList);
        console.log(`Display style:`, prevElement.style.display);

        if (
          prevElement.classList.contains("user-message") &&
          prevElement.style.display !== "none"
        ) {
          console.log(`✅ Found valid user message element:`, prevElement);

          // Get the message ID from the data attribute
          userMessageId = prevElement.getAttribute("data-message-id");
          console.log(`Extracted user message ID: ${userMessageId}`);

          if (!userMessageId) {
            console.error(
              "No data-message-id attribute found on user message element"
            );
            return;
          }
          break;
        }

        prevElement = prevElement.previousElementSibling;
        iteration++;
      }

      if (!userMessageId) {
        console.error("Could not find a valid user message element");
        return;
      }

      // Process each file and save it
      files.forEach((file) => {
        if (file && file.filename) {
          console.log(`Saving file: ${file.filename}`);
          console.log("CALLING SAVING FILE 1");
          historyManager.saveFile(file.filename, file, conversationId);
        } else {
          console.warn("Invalid file object encountered:", file);
        }
      });

      return filesData;
    } catch (error) {
      console.error(
        "Error processing data in updateLocalStoredUserFilesToJsonFormat:",
        error
      );
      console.log("Raw data that caused error:", data);
      return null;
    }
  },

  endMessageVisually: function () {
    console.log("endMessageVisually called");

    const message = document.getElementById(this.currentStreamMessageId);
    console.log("Message element:", message);
    console.log("Message ID:", this.currentStreamMessageId);

    if (!message) {
      console.error(
        "Message element not found with ID:",
        this.currentStreamMessageId
      );
      return;
    }

    console.log(
      "Before removing 'streaming' class:",
      message.classList.contains("streaming")
    );
    message.classList.remove("streaming");
    console.log(
      "After removing 'streaming' class:",
      message.classList.contains("streaming")
    );

    // Create the footer using your method
    console.log("Creating footer...");
    const footerHTML = this.createMessageFooter(
      { id: this.currentStreamMessageId, type: "ai" },
      ""
    );
    console.log("Footer HTML:", footerHTML);

    // Convert HTML string to DOM elements and append
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = footerHTML;
    console.log("Temp div children count:", tempDiv.children.length);

    // Append all children from tempDiv to the message
    let appendedCount = 0;
    while (tempDiv.firstChild) {
      message.appendChild(tempDiv.firstChild);
      appendedCount++;
    }
    console.log("Appended", appendedCount, "children to message");

    console.log("endMessageVisually completed");
  },

  handleStreamComplete: function (data) {
    console.log("🎉 === STREAM COMPLETE (ENHANCED DEBUG) ===");
    console.log("🎉 🎯 ENTRY POINT - Function called");
    console.log("🎉 🎯 Complete data received:", data);

    this.updateLocalStoredUserFilesToJsonFormat(data);

    //reset stream state
    console.log("RESETING STREAM STATE");
    this.streamMessageCreated = false;

    // Mark as completed to prevent duplicate calls
    this.completeCalled = true;

    // CRITICAL: Always reset processing state and UI
    messageManager.hideThinking(true);
    console.log("🎉 🔄 ✅ Processing state reset, thinking hidden");

    // Restore send buttons
    const mainSendButton = document.getElementById("sendButton");
    if (mainSendButton) {
      messageManager.setSendButtonToSend(mainSendButton);
      console.log("🎉 🔄 ✅ Main send button restored");
    } else {
      console.warn("🎉 🔄 ⚠️ Main send button not found");
    }

    // Early exit checks
    if (data.status === "done" && Object.keys(data).length === 1) {
      console.log("🎉 ⏭️ EARLY EXIT: Just a done signal, ignoring");
      return;
    }

    this.isProcessing = false;

    // Find message element
    const message = document.getElementById(this.currentStreamMessageId);
    console.log("🎉 🔍 Message element exists:", !!message);

    if (message) {
      const indicator = message.querySelector(".streaming-indicator");
      if (indicator) {
        indicator.remove();
      }

      // CRITICAL FIX: Check for files in the complete response data
      console.log("🎉 🔍 Checking for files in complete data...");
      console.log("🎉 🔍 data.files:", data.files);
      console.log("🎉 🔍 data.has_files:", data.has_files);
      console.log("🎉 🔍 data.file_count:", data.file_count);

      // Check for files in multiple possible locations
      let filesToProcess = [];

      // Method 1: Direct files array
      if (data.files && Array.isArray(data.files) && data.files.length > 0) {
        console.log("🎉 📁 Found files in data.files:", data.files.length);
        filesToProcess = data.files;
      }

      // Method 2: Check if files are embedded in response text
      else if (data.response && typeof data.response === "string") {
        console.log("🎉 🔍 Checking response text for embedded files...");
        this.detectAndProcessJSONFiles(data.response);
      }

      console.log("this is the data.files 1", data.files);

      // Method 3: Check streaming buffer for any missed files
      if (filesToProcess.length === 0 && this.streamingTextBuffer) {
        console.log("🎉 🔍 Checking streaming buffer for files...");
        this.detectAndProcessJSONFiles(this.streamingTextBuffer);
      }

      console.log("this is the data.files", data.files);

      // Process found files - FIXED VERSION
      if (filesToProcess.length > 0) {
        console.log("🎉 📁 Processing", filesToProcess.length, "files");

        // Process each file
        filesToProcess.forEach((file, index) => {
          try {
            console.log(`🎉 📁 Processing file ${index + 1}:`, file.filename);

            // CRITICAL FIX: Check if this is an update vs a new file
            if (file.update_type === "partial") {
              console.log("🔄 Processing partial update for:", file.filename);
              this.handleFileUpdate(file);
            }
            // Handle memory files (JSON-wrapped complete files)
            else if (
              file.from_memory ||
              (file.content && file.content.startsWith("{"))
            ) {
              this.processMemoryFile(file, index);
            }
            // Handle direct file data (complete files)
            else {
              this.processDirectFile(file, index);
            }
          } catch (error) {
            console.error("🎉 ❌ Error processing file:", error);
          }
        });
      }

      console.log("this is the data.files 2", data.files);

      // Apply syntax highlighting to all code elements
      const codeElements = message.querySelectorAll('code[class*="language-"]');
      if (codeElements.length > 0) {
        codeElements.forEach((codeEl) => {
          this.highlightElementCode(codeEl);
        });
      }

      // Ensure all files are visible and functional
      const fileBlocks = message.querySelectorAll(".file-block");
      fileBlocks.forEach((block) => {
        block.style.display = "block";
        block.style.visibility = "visible";
        block.style.opacity = "1";

        const buttons = block.querySelectorAll(".block-btn");
        buttons.forEach((btn) => {
          if (!btn.disabled) {
            btn.style.pointerEvents = "auto";
            btn.style.cursor = "pointer";
            btn.style.opacity = "1";
          }
        });
      });

      // Ensure files container is visible
      const filesContainer = message.querySelector(".message-files");
      if (filesContainer && this.streamingResponseFiles.length > 0) {
        filesContainer.style.display = "block";
        filesContainer.style.visibility = "visible";
        filesContainer.style.opacity = "1";
      }
    }

    // Prepare files for history entry
    const filesForHistory = this.streamingResponseFiles.map((file) => ({
      id: file.id,
      filename: file.filename,
      content: file.content,
      extension: file.extension,
      language: file.language,
      type: file.type,
      size: file.content ? file.content.length : 0,
      is_executable: file.is_executable,
      mime_type: file.mime_type,
      from_memory: file.from_memory || false,
      memory_id: file.memory_id,
      originalJSON: file.originalJSON,
      sections: file.sections,
      metadata: file.metadata,
    }));

    console.log("🎉 📁 Prepared", filesForHistory.length, "files for history");
    console.log(
      "getParentMessageId GETTING CALLED IN handleStreamComplete with ",
      this.currentStreamMessageId
    );
    const parent_message_id = this.getParentMessageId(
      this.currentStreamMessageId
    );

    // Debug version number extraction
    console.log("🔍 [DEBUG] Parent Message ID:", parent_message_id);
    const versionParts = parent_message_id.split(".v");
    console.log("🔍 [DEBUG] Split result:", versionParts);
    const versionNumber = versionParts[1]; // Keep original logic

    console.log("🔍 [DEBUG] Extracted version number:", versionNumber);
    console.log("🔍 [DEBUG] Using version:", versionNumber || 1);

    // Before saving data.response, extract content from code blocks
    let cleanedResponse = data.response;

    // Remove everything between triple backticks (including the backticks)
    cleanedResponse = cleanedResponse.replace(/```[\s\S]*?```/g, "");

    // Create history entry with cleaned response
    const historyEntry = {
      id: this.currentStreamMessageId,
      text: cleanedResponse || null,
      type: "ai",
      messageType: "AI Response",
      model: data.model_used || appState.selectedAIModel,
      timestamp: new Date().toISOString(),
      conversation_id: appState.currentConversationId,
      parent_message_id: parent_message_id,
      version: versionNumber || 1,
      files: this.aiFilesFromThisResponse,
      has_files: data.has_files,
      file_count: data.file_count,
    };
    console.log("this is the historyEntry3", historyEntry);

    console.log("🎉 📚 History entry created:", {
      id: historyEntry.id,
      type: historyEntry.type,
      filesCount: historyEntry.files?.length || 0,
      version: historyEntry.version, // Added version to output
    });

    console.log("this is the data.files 5", data.files);

    console.log("this is the historyEntry.files 3", historyEntry.files);

    messageManager.addMessageToHistory(historyEntry);
    /*if (typeof appState !== "undefined") {
      appState.chatHistory.push(historyEntry);

      // Register response with correct version
      const recentUserMessage = this.findMostRecentUserMessage();
      if (recentUserMessage) {
        const targetVersion =
          this.currentSendContext?.displayingVersion ||
          recentUserMessage.currentVersion ||
          1;
        appState.addResponseToVersion(
          recentUserMessage.id,
          historyEntry.id,
          targetVersion
        );
      }
    }*/

    // Handle conversation ID, topics, etc.
    if (data.conversation_id) {
      appState.currentConversationId = data.conversation_id;
      appState.saveToStorage();
    }

    if (data.title || data.new_topic) {
      this.handleTopicGeneration(data);
    }

    if (appState.contextPlusEnabled) {
      this.hideContextPlusLoading();
    }

    // Get the element
    const processingBanner = document.querySelector(".processing-banner");

    // Check if it exists and remove it
    if (processingBanner) {
      processingBanner.remove();
    }

    console.log("setProcessingState CALLED 5");

    // Reset streaming state
    this.setProcessingState(false);
    this.streamingTextBuffer = "";
    this.displayTextBuffer = "";
    console.log("setting currentStreamMessageId to null 5:");
    this.currentStreamMessageId = null;
    this.aiFilesFromThisResponse = [];
    this.currentSendContext = null;
    this.enableVersionNavButtons();

    console.log("🎉 ✅ === STREAM COMPLETION FINISHED ===");
  },

  // NEW METHOD: Handle file updates specifically
  handleFileUpdate: function (updateData) {
    console.log("🔄 === HANDLING FILE UPDATE ===");
    console.log("🔄 Update data:", updateData);

    if (!updateData.filename) {
      console.error("🔄 ❌ No filename in update data");
      return;
    }

    // Find the existing file by filename
    const existingFile = this.findExistingFileByName(updateData.filename);

    if (!existingFile) {
      console.error(
        "🔄 ❌ Cannot find existing file to update:",
        updateData.filename
      );
      console.log(
        "🔄 Available files:",
        this.streamingResponseFiles.map((f) => f.filename)
      );
      return;
    }

    console.log("🔄 ✅ Found existing file to update:", {
      id: existingFile.id,
      filename: existingFile.filename,
      currentContentLength: existingFile.content
        ? existingFile.content.length
        : 0,
    });

    // Use the file update handler if available
    if (typeof fileUpdateHandler !== "undefined") {
      console.log("✅ Routing to fileUpdateHandler.js");
      fileUpdateHandler.handleFileUpdate(updateData);
    } else {
      // The manual application is a fallback and should only be used
      // if the primary handler is missing.
      console.error(
        "❌ fileUpdateHandler.js is not available. Using manual fallback."
      );
      const existingFile = this.findExistingFileByName(updateData.filename);
      if (!existingFile) {
        console.error(
          "🔄 ❌ Cannot find existing file to update:",
          updateData.filename
        );
        return;
      }
      this.applyFileUpdateManually(existingFile, updateData);
    }
  },

  // Helper method to find existing file by name
  findExistingFileByName: function (filename) {
    // Check streamingResponseFiles first
    let file = this.streamingResponseFiles.find((f) => f.filename === filename);
    if (file) return file;

    // Check streamingFiles map
    for (const [key, streamingFile] of this.streamingFiles.entries()) {
      if (streamingFile.filename === filename) {
        return streamingFile;
      }
    }

    // Check contentManager blocks
    if (typeof contentManager !== "undefined") {
      for (const [blockId, block] of contentManager.blocks.entries()) {
        if (block.filename === filename) {
          return block;
        }
      }
    }

    return null;
  },

  // Manual update application as fallback
  applyFileUpdateManually: function (existingFile, updateData) {
    console.log("🔄 Applying manual file update for:", existingFile.filename);

    let updatedContent = existingFile.content || "";

    // Apply section modifications
    if (updateData.sections_modified) {
      for (const [sectionName, sectionData] of Object.entries(
        updateData.sections_modified
      )) {
        console.log(`🔄 Updating section: ${sectionName}`);

        // For now, append the updated content
        // TODO: Implement more sophisticated section replacement
        if (sectionData.content) {
          updatedContent += "\n\n/* Updated Section: " + sectionName + " */\n";
          updatedContent += sectionData.content;
        }
      }
    }

    // Apply section additions
    if (updateData.sections_added) {
      for (const [sectionName, sectionData] of Object.entries(
        updateData.sections_added
      )) {
        console.log(`🔄 Adding section: ${sectionName}`);

        if (sectionData.content) {
          updatedContent += "\n\n/* New Section: " + sectionName + " */\n";
          updatedContent += sectionData.content;
        }
      }
    }

    // Update the file content
    existingFile.content = updatedContent;
    existingFile.originalContent = updatedContent;

    // Update the DOM element if it exists
    const fileElement =
      existingFile.element ||
      document.getElementById(`block_${existingFile.id}`);
    if (fileElement) {
      const codeElement = fileElement.querySelector("code, .streaming-code");
      if (codeElement) {
        codeElement.textContent = updatedContent;
        console.log("highlighting code element number 5");
        this.highlightElementCode(codeElement);
      }
    }

    // Update contentManager block if it exists
    if (typeof contentManager !== "undefined") {
      const blockId = `file_${existingFile.id}`;
      const block = contentManager.blocks.get(blockId);
      if (block) {
        block.content = updatedContent;
        block.originalContent = updatedContent;
        block.size = updatedContent.length;
        block.wordCount = updatedContent.split(/\s+/).length;
      }
    }

    console.log("🔄 ✅ Manual file update applied");
  },

  processMemoryFile: function (file, index) {
    console.log("🔮 Processing memory file:", file.filename);

    try {
      // Parse the JSON content to get the actual, definitive file data
      const actualFileData = JSON.parse(file.content);
      console.log("🔮 Parsed memory file data:", actualFileData.filename);

      if (actualFileData.update_type === "partial") {
        console.log("🔮 Memory file is an update, routing to update handler");
        this.handleFileUpdate(actualFileData);
        return;
      }

      // Reconstruct the displayable content from the inner 'sections'
      let reconstructedContent = "";
      if (actualFileData.sections) {
        const sortedSections = Object.entries(actualFileData.sections).sort(
          (a, b) => {
            const aStart = a[1].start_line || 0;
            const bStart = b[1].start_line || 0;
            return aStart - bStart;
          }
        );

        for (const [sectionName, sectionData] of sortedSections) {
          if (sectionData.content) {
            reconstructedContent += sectionData.content;
            if (
              !reconstructedContent.endsWith("\n") &&
              sectionName !== sortedSections[sortedSections.length - 1][0]
            ) {
              reconstructedContent += "\n";
            }
          }
        }
      }

      // --- FIX: Use the ID from the INNER JSON data (`actualFileData.id`) ---
      const fileInfo = {
        id: actualFileData.id, // Use the correct ID from the parsed content
        filename: actualFileData.filename,
        extension: this.getFileExtension(actualFileData.filename),
        language:
          actualFileData.language ||
          this.getLanguageFromExtension(
            this.getFileExtension(actualFileData.filename)
          ) ||
          "plaintext",
        content: reconstructedContent,
        type: this.detectFileType(
          actualFileData.language ||
            this.getLanguageFromExtension(
              this.getFileExtension(actualFileData.filename)
            ) ||
            "plaintext"
        ),
        is_executable: this.isExecutableFile(actualFileData.filename),
        mime_type: this.getMimeType(
          this.getFileExtension(actualFileData.filename)
        ),
        size: reconstructedContent.length,
        from_memory: true,
        memory_id: file.memory_id,
        sections: actualFileData.sections,
        metadata: actualFileData.metadata,
      };

      this.createAndDisplayFile(fileInfo);
    } catch (error) {
      console.error("🔮 ❌ Error processing memory file:", error);
      console.error(
        "🔮 ❌ File content that failed:",
        file.content?.substring(0, 200)
      );
    }
  },

  processDirectFile: function (file, index) {
    console.log("📁 Processing direct file:", file.filename);

    const fileInfo = {
      id: file.id,
      filename: file.filename,
      extension: file.extension || this.getFileExtension(file.filename),
      language: file.language,
      content: file.content,
      type: file.type || this.detectFileType(file.language),
      is_executable: file.is_executable,
      mime_type: file.mime_type,
      size: file.size || (file.content ? file.content.length : 0),
      from_memory: false,
    };

    this.createAndDisplayFile(fileInfo);
  },

  createAndDisplayFile: function (fileInfo) {
    console.log("🏗️ Creating and displaying file:", fileInfo.filename);

    let definitiveFileInfo = { ...fileInfo };

    // --- FIX: Check for and use the ID from the nested JSON content ---
    if (
      typeof fileInfo.content === "string" &&
      fileInfo.content.trim().startsWith("{")
    ) {
      try {
        const innerData = JSON.parse(fileInfo.content);
        if (innerData.id && innerData.filename) {
          const reconstructedContent = this.constructFileContent(innerData);

          definitiveFileInfo = {
            ...fileInfo, // Keep some outer data like memory_id
            id: innerData.id, // USE THE CORRECT ID
            filename: innerData.filename,
            content: reconstructedContent,
            sections: innerData.sections,
            metadata: innerData.metadata,
            language: innerData.language,
            type: this.detectFileType(innerData.language),
            size: reconstructedContent.length,
          };
        }
      } catch (e) {
        console.warn(
          "📝 Content looked like JSON but failed to parse during display.",
          e
        );
      }
    }
    // --- End of Fix ---

    if (
      !this.streamingResponseFiles.some((f) => f.id === definitiveFileInfo.id)
    ) {
      this.streamingResponseFiles.push(definitiveFileInfo);
    }
    this.streamingFiles.set(definitiveFileInfo.id, {
      ...definitiveFileInfo,
      element: null,
      isStreaming: false,
    });

    // Create file block HTML using the DEFINITIVE file info
    const fileBlockHtml = this.createCompletedFileBlock(definitiveFileInfo);

    const message = document.getElementById(this.currentStreamMessageId);
    if (!message) {
      console.error("🏗️ ❌ No message element found");
      return;
    }

    let container = message.querySelector(".message-files");
    if (!container) {
      container = document.createElement("div");
      container.className = "message-files";
      container.style.display = "block";
      message.appendChild(container);
    }

    container.insertAdjacentHTML("beforeend", fileBlockHtml);

    // ✅ THIS IS THE CRITICAL SECTION THAT SAVES THE DATA FOR THE PREVIEW
    if (typeof contentManager !== "undefined") {
      const blockId = `file_${definitiveFileInfo.id}`;
      const blockData = {
        id: blockId,
        filename: definitiveFileInfo.filename,
        content: definitiveFileInfo.content,
        originalContent: definitiveFileInfo.content,
        extension:
          definitiveFileInfo.extension ||
          this.getFileExtension(definitiveFileInfo.filename),
        language: definitiveFileInfo.language,
        type: definitiveFileInfo.type,
        size: definitiveFileInfo.size,
        isExecutable:
          definitiveFileInfo.is_executable ||
          this.isExecutableFile(definitiveFileInfo.filename),
        mimeType:
          definitiveFileInfo.mime_type ||
          this.getMimeType(definitiveFileInfo.extension),
        // This line is essential. It tells the HTML file about all other
        // files in the same response, including the CSS and JS.
        allFiles: this.streamingResponseFiles,
        wordCount: definitiveFileInfo.content.split(/\s+/).length,
        collapsed: false,
        metadata: definitiveFileInfo.metadata,
        sections: definitiveFileInfo.sections,
      };
      contentManager.blocks.set(blockId, blockData);
      console.log(
        "✅ Registered file with contentManager, including allFiles:",
        blockId
      );
    }
  },
  handleTopicGeneration: function (response) {
    if ($DebugTestMode) {
      console.log("🏷️ === TOPIC GENERATION HANDLER ===");
      console.log("🏷️ Response data:", response);
    }

    // Handle title generation
    if (response.title) {
      if ($DebugTestMode) {
        console.log("🏷️ Title received from backend:", response.title);
      }

      this.changeTopicForConversation(response.title);

      // Force save to storage
      appState.saveToStorage();

      // Force reload history with a small delay to ensure state is saved
      setTimeout(() => {
        if (
          typeof historyManager !== "undefined" &&
          historyManager.loadHistory
        ) {
          if ($DebugTestMode) {
            console.log("🏷️ Reloading history panel...");
          }
          historyManager.loadHistory();

          // Also update the active state to ensure highlighting
          historyManager.updateHistoryActiveState(
            appState.currentConversationId
          );
        }
      }, 100);
    }

    // Handle new topic flag (shouldn't usually happen in streaming)
    if (response.new_topic) {
      if ($DebugTestMode) {
        console.log("🏷️ Creating missing topic...");
      }

      appState.saveToStorage();

      setTimeout(() => {
        historyManager.loadHistory();
      }, 100);
    }
  },

  handleProgressEvent: function (data) {
    if ($DebugTestMode) {
      console.log(`📊 Progress: ${data.stage} - ${data.message}`);
    }

    // Update UI based on progress stage
    switch (data.stage) {
      case "memory_retrieval":
      case "memory_search":
        if (appState.contextPlusEnabled) {
          const toggle = document.getElementById("contextPlusToggle");
          if (toggle) {
            toggle.classList.add("loading");

            let indicator = document.querySelector(".context-memory-indicator");
            if (!indicator) {
              indicator = document.createElement("div");
              indicator.className = "context-memory-indicator";
              toggle.appendChild(indicator);
            }
            indicator.textContent = data.message;
            indicator.classList.add("show");
          }
        }
        break;

      case "ai_processing":
      case "ai_thinking":
        // The thinking indicator should already be shown
        break;

      case "files_start":
        // Prepare UI for file generation
        if ($DebugTestMode) {
          console.log(`📁 Preparing to receive ${data.data.count} files`);
        }
        break;
    }
  },

  handleStreamError: function (data) {
    console.error("❌ === STREAM ERROR ===");
    console.error("❌ Error data:", data);

    messageManager.hideThinking();

    if (appState.contextPlusEnabled) {
      this.hideContextPlusLoading();
    }

    // Clean up any partial message
    if (this.currentStreamMessageId) {
      const message = document.getElementById(this.currentStreamMessageId);
      if (message) message.remove();
    }

    console.log("setProcessingState CALLED 4");

    // CRITICAL: Reset processing state
    this.setProcessingState(false);

    // CRITICAL: Clean up streaming state
    //this.streamingFiles.clear();
    this.streamingTextBuffer = "";
    this.currentStreamMessageId = null;
    console.log("setting currentStreamMessageId to null 4:");
    // this.streamingResponseFiles = [];
    this.inCodeBlock = false;
    this.pendingTextBeforeCode = "";
    this.codeBlockState = {
      active: false,
      language: "",
      filename: "",
      content: "",
    };

    // CRITICAL: Close event source if exists
    if (this.activeEventSource) {
      this.activeEventSource.close();
      this.activeEventSource = null;
    }

    if (typeof messageManager !== "undefined") {
      messageManager.createMessage(
        data.error || "An error occurred during streaming",
        "ai",
        "Error"
      );
    }
  },

  handleStreamDone: function () {
    if ($DebugTestMode) {
      console.log("✅ Stream done");
    }

    // Clean up
    // this.streamingFiles.clear();
    this.streamingTextBuffer = "";
    this.currentStreamMessageId = null;
    console.log("setting currentStreamMessageId to null 3:");
    //this.streamingResponseFiles = [];

    if (this.activeEventSource) {
      this.activeEventSource.close();
      this.activeEventSource = null;
    }
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

  getAttachmentIcon: function (attachment) {
    // Handle both old attachment format and new format
    const filename = attachment.filename || attachment.name || "unknown";
    const type = attachment.type;

    if (type === "image") {
      return "🖼️";
    }

    const ext = this.getFileExtension(filename);

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
      ".zip": "📦",
      ".rar": "📦",
      ".tar": "📦",
      ".gz": "📦",
    };

    return iconMap[ext.toLowerCase()] || "📎";
  },
};

function monitorRecentUserMessage() {
  setInterval(() => {
    const userMessages = document.querySelectorAll(".message.user-message");
    if (userMessages.length > 0) {
      const mostRecentMessage = userMessages[userMessages.length - 1];
      console.log(
        "THIS IS THE MOST RECENT USER MESSAGE",
        mostRecentMessage.outerHTML
      );
    }
  }, 2);
}

// Start monitoring
//monitorRecentUserMessage();

// Export for use in main module
if (typeof module !== "undefined" && module.exports) {
  module.exports = chatManager;
}
