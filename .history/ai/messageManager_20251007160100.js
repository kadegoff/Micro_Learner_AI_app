// messageManager.js - ENHANCED Message Manager with Edit Support and Improved Thinking Indicator
"use strict";

if (typeof $DebugTestMode === "undefined") {
  $DebugTestMode = true;
}

var messageManager = {
  // FIXED: Single duplicate tracking system at the message manager level
  lastProcessedMessageText: "",
  lastProcessedMessageTime: 0,
  duplicateThresholdMs: 3000, // 3 seconds

  // Track current edit states
  editingMessageId: null,

  editAttachments: [],

  // Enhanced thinking indicator properties
  thinkingStartTime: null,
  minimumThinkingTime: 500, // Minimum 500ms display time

  isCurrentlySending: false,
  currentRequestController: null,

  // Push attachment content and message ID to editAttachments
  pushToEditAttachments: function (attachmentId, attachmentContent, messageId) {
    if (!this.editAttachments) {
      this.editAttachments = [];
    }

    this.editAttachments.push({
      id: attachmentId || NULL,
      content: attachmentContent,
      messageId: messageId || NULL,
    });
  },

  removeFromEditAttachments: function (messageId) {
    if (!this.editAttachments) {
      this.editAttachments = [];
    }
    this.editAttachments = this.editAttachments.filter(
      (att) => att.messageId !== messageId
    );
  },

  removeIndividualFromEditAttachments: function (id) {
    if (!this.editAttachments) {
      this.editAttachments = [];
    }
    this.editAttachments = this.editAttachments.filter((att) => att.id !== id);
  },

  createMessage: function (
    text,
    type = "ai",
    version = 1,
    files = null,
    messageType = "",
    model = null,
    addToHistory = true,
    timestamp = null,
    messageId = null,
    parentMessageId = null
  ) {
    if ($DebugTestMode) {
      console.log("🚀 createMessage called with parameters:", {
        text: text?.substring(0, 100) + (text?.length > 100 ? "..." : ""),
        type,
        version,
        messageType,
        model,
        addToHistory,
        timestamp,
        messageId,
        parentMessageId,
        files: files ? `${files.length} files` : null,
      });
    }

    const content = document.getElementById("aiContent");
    if (!content) {
      if ($DebugTestMode) {
        console.error("❌ aiContent element not found!");
      }
      if ($DebugTestMode) {
        console.error("❌ aiContent element not found!");
      }
      return;
    }
    if ($DebugTestMode) {
      console.log("✅ aiContent element found");
    }

    // Force remove ALL empty states
    const emptyStates = content.querySelectorAll(".empty-state");
    if ($DebugTestMode) {
      console.log(`🧹 Removing ${emptyStates.length} empty states`);
    }
    emptyStates.forEach((state) => state.remove());
    this.hideThinking();

    const message = document.createElement("div");
    const id =
      messageId ||
      `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    if ($DebugTestMode) {
      console.log("🆔 Generated message ID:", id);
    }

    message.id = id;
    message.className =
      type === "ai" ? "message ai-response" : "message user-message";
    message.dataset.messageId = id;
    message.dataset.version = version; // Add this line to set data-version
    if ($DebugTestMode) {
      console.log("📝 Message element created with class:", message.className);
    }

    // Create message data object for centralized HTML generation
    const msgData = {
      id: id,
      text: text,
      type: type,
      messageType: messageType,
      model: model,
      timestamp: timestamp || new Date().toISOString(),
      files: files || [],
    };
    if ($DebugTestMode) {
      console.log("📊 Message data object created:", {
        id: msgData.id,
        type: msgData.type,
        messageType: msgData.messageType,
        model: msgData.model,
        timestamp: msgData.timestamp,
        filesCount: msgData.files.length,
      });
    }

    // FIXED: Always include files when creating message HTML and setup handlers
    const shouldIncludeFiles = msgData.files && msgData.files.length > 0;
    if ($DebugTestMode) {
      console.log("📎 Should include files:", shouldIncludeFiles);
    }

    if ($DebugTestMode) {
      console.log("🏗️ Message HTML before innerHTML inserted", message.outerHTML);
    }
    message.innerHTML = this.createMessageHTML(msgData, shouldIncludeFiles);
    if ($DebugTestMode) {
      console.log("🏗️ Message HTML created:", message.innerHTML);
    }
    if ($DebugTestMode) {
      console.log("🏗️ Message HTML created and assigned", message.outerHTML);
    }

    content.appendChild(message);
    if ($DebugTestMode) {
      console.log("Message appended to content:", message.outerHTML);
    }

    content.scrollTop = content.scrollHeight;
    if ($DebugTestMode) {
      console.log("📍 Message appended to content and scrolled");
    }

    const isErrorMessage =
      text.includes("usage limit") ||
      text.includes("Your usage will reset") ||
      messageType === "Auth Required" ||
      messageType === "Error";
    if ($DebugTestMode) {
      console.log("❌ Is error message:", isErrorMessage);
    }

    if ($DebugTestMode) {
      console.log("getParentMessageId GETTING CALLED IN CREATE MESSAGE");
    }

    // Get parent message ID using chatManager
    const calculatedParentMessageId =
      chatManager.getParentMessageId(id) || parentMessageId || null;
    if ($DebugTestMode) {
      console.log("👨‍👦 Parent message ID:", {
        provided: parentMessageId,
        calculated: calculatedParentMessageId,
        final: calculatedParentMessageId,
      });
    }

    if (addToHistory && !isErrorMessage) {
      if ($DebugTestMode) {
        console.log("📚 Adding message to history...");
      }

      const historyEntry = {
        id: id,
        text: text,
        type: type,
        messageType: messageType,
        model: model || appState.selectedAIModel,
        timestamp: timestamp || new Date().toISOString(),
        files: files ? [...files] : [],
        version: version,
        conversation_id: appState.currentConversationId,
        parent_message_id: calculatedParentMessageId,
      };
      if ($DebugTestMode) {
        console.log("📋 History entry created:", {
          id: historyEntry.id,
          type: historyEntry.type,
          conversationId: historyEntry.conversation_id,
          parentMessageId: historyEntry.parent_message_id,
          filesCount: historyEntry.files.length,
        });
      }

      this.addMessageToHistory(historyEntry);
      if ($DebugTestMode) {
        console.log("✅ Message added to history");
      }

      appState.saveToStorage();
      if ($DebugTestMode) {
        console.log("💾 App state saved to storage");
      }
    } else {
      if ($DebugTestMode) {
        console.log("⏭️ Skipping history addition:", {
          addToHistory,
          isErrorMessage,
        });
      }
    }

    const result = {
      messageId: id,
      parentMessageId: calculatedParentMessageId,
    };
    if ($DebugTestMode) {
      console.log("🎯 createMessage returning:", result);
    }

    // Return both messageId and parentMessageId
    return result;
  },

  addMessageToHistory: function (historyEntry) {
    if ($DebugTestMode) {
      console.log("[History] Adding message to history:", historyEntry);
    }

    // Initialize chatHistory as an object if it doesn't exist
    if (!appState.chatHistory) {
      if ($DebugTestMode) {
        console.log(
          "🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵RESETTT[History] Initializing chatHistory as new object",
          appState.chatHistory
        );
      }
      appState.chatHistory = {};
    }

    const conversationId =
      historyEntry.conversation_id || appState.currentConversationId;
    if ($DebugTestMode) {
      console.log(`[History] Using conversation ID: ${conversationId}`);
    }

    // Configuration
    const MAX_CONVERSATIONS_WITH_MESSAGES = 30; // Keep ALL messages for recent 30 conversations
    const MAX_TOTAL_CONVERSATIONS = 100; // Total conversations limit

    const currentConversationCount = Object.keys(appState.chatHistory).length;
    if ($DebugTestMode) {
      console.log(
        `[History] Current conversation count: ${currentConversationCount}`
      );
    }

    // First, remove excess conversations if over total limit
    if (currentConversationCount >= MAX_TOTAL_CONVERSATIONS) {
      const conversationsToRemove =
        currentConversationCount - MAX_TOTAL_CONVERSATIONS + 1; // +1 to make room for new conversation

      if (conversationsToRemove > 0) {
        if ($DebugTestMode) {
          console.log(
            `[History] ${currentConversationCount} conversations detected, removing ${conversationsToRemove} oldest conversation(s)`
          );
        }

        // Create an array of conversations with their IDs and timestamps for sorting
        const conversationsWithTimestamps = [];

        for (const [id, conversation] of Object.entries(appState.chatHistory)) {
          if (id === conversationId) {
            // Skip current conversation (might be new)
            if ($DebugTestMode) {
              console.log(
                `[History] Skipping current conversation ${id} for deletion`
              );
            }
            continue;
          }

          let timestampValue = conversation.timestamp
            ? new Date(conversation.timestamp).getTime()
            : 0;

          conversationsWithTimestamps.push({
            id,
            timestamp: timestampValue,
            conversation,
          });
        }

        // Sort conversations by timestamp (oldest first)
        conversationsWithTimestamps.sort((a, b) => a.timestamp - b.timestamp);

        // Remove the oldest conversations
        const conversationsToDelete = conversationsWithTimestamps.slice(
          0,
          conversationsToRemove
        );

        for (const conversationData of conversationsToDelete) {
          if ($DebugTestMode) {
            console.log(
              `[History] Removing old conversation: ${conversationData.id}`
            );
          }
          delete appState.chatHistory[conversationData.id];
        }

        if ($DebugTestMode) {
          console.log(
            `[History] Removed ${
              conversationsToDelete.length
            } conversation(s). New total: ${
              Object.keys(appState.chatHistory).length
            }`
          );
        }
      }
    }

    // Initialize or update the conversation
    if (!appState.chatHistory[conversationId]) {
      if ($DebugTestMode) {
        console.log(
          `[History] Creating new conversation object for ID: ${conversationId}`
        );
      }
      appState.chatHistory[conversationId] = {
        messages: [],
        timestamp: historyEntry.timestamp,
      };
    } else {
      // Update the conversation timestamp with the latest message's timestamp
      appState.chatHistory[conversationId].timestamp = historyEntry.timestamp;
      if ($DebugTestMode) {
        console.log(
          `[History] Updated conversation timestamp to: ${historyEntry.timestamp}`
        );
      }
    }

    // Determine if this conversation should keep messages
    const allConversations = Object.entries(appState.chatHistory)
      .filter(([id]) => id !== conversationId) // Exclude current conversation
      .map(([id, conv]) => ({
        id,
        timestamp: conv.timestamp ? new Date(conv.timestamp).getTime() : 0,
      }))
      .sort((a, b) => b.timestamp - a.timestamp); // Sort by timestamp (newest first)

    // Current conversation position (will be added to the top after adding message)
    const recentConversationCount = Math.min(
      allConversations.length,
      MAX_CONVERSATIONS_WITH_MESSAGES
    );

    // Add the message to the conversation
    appState.chatHistory[conversationId].messages.push(historyEntry);
    if ($DebugTestMode) {
      console.log(
        `[History] Message added to conversation ${conversationId}. Current length: ${appState.chatHistory[conversationId].messages.length}`
      );
    }

    // After adding the message, check if this conversation should have messages trimmed
    const conversation = appState.chatHistory[conversationId];

    // Re-evaluate conversation position after adding the new message
    const updatedAllConversations = Object.entries(appState.chatHistory)
      .map(([id, conv]) => ({
        id,
        timestamp: conv.timestamp ? new Date(conv.timestamp).getTime() : 0,
        messageCount: conv.messages ? conv.messages.length : 0,
      }))
      .sort((a, b) => b.timestamp - a.timestamp); // Sort by timestamp (newest first)

    // Find current conversation's position
    const currentConversationIndex = updatedAllConversations.findIndex(
      (conv) => conv.id === conversationId
    );

    if (currentConversationIndex >= MAX_CONVERSATIONS_WITH_MESSAGES) {
      // This conversation is NOT in the top 30 most recent - remove ALL messages
      if ($DebugTestMode) {
        console.log(
          `[History] Conversation ${conversationId} is position ${
            currentConversationIndex + 1
          }, removing all messages (keeping only metadata)`
        );
      }
      conversation.messages = []; // Remove all messages, keep only metadata
    } else {
      // This conversation is in the top 30 most recent - keep ALL messages
      if ($DebugTestMode) {
        console.log(
          `[History] Conversation ${conversationId} is position ${
            currentConversationIndex + 1
          }, keeping all ${conversation.messages.length} messages`
        );
      }
      // No need to trim messages for recent conversations
    }

    // Save files locally if they exist in the history entry
    if (historyEntry.files && Array.isArray(historyEntry.files)) {
      if ($DebugTestMode) {
        console.log(
          `[History] Processing ${historyEntry.files.length} file(s) for message ${historyEntry.id} of type: ${historyEntry.type}`
        );
      }

      const savedFileIds = [];

      historyEntry.files.forEach((file) => {
        if (file.id) {
          if (historyEntry.type === "user" && file.content) {
            if ($DebugTestMode) {
              console.log(
                `[History] Saving file content only for USER: ${file.id}`
              );
            }
            if ($DebugTestMode) {
              console.log("CALLING SAVING FILE 5");
            }
            historyManager.saveFile(file.id, file.content, conversationId);
          } else if (historyEntry.type === "ai") {
            if ($DebugTestMode) {
              console.log(
                `[History] Saving whole file object for AI: ${file.id}`
              );
            }
            if ($DebugTestMode) {
              console.log("CALLING SAVING FILE 6");
            }
            historyManager.saveFile(file.id, file, conversationId);
          }
          savedFileIds.push(file.id);
        } else {
          if ($DebugTestMode) {
            console.log(`[History] File missing ID, skipping save`);
          }
        }
      });

      // Convert files array to a string of file IDs
      historyEntry.files = savedFileIds.join(", ");
      if ($DebugTestMode) {
        console.log(`[History] Converted files to string: ${historyEntry.files}`);
      }
    }

    return historyEntry;
  },

  createMessageHTML: function (msg, includeFiles = false) {
    if ($DebugTestMode) {
      console.log("🎨 === CREATE MESSAGE HTML (ENHANCED DEBUG) ===");
    }
    if ($DebugTestMode) {
      console.log("🎨 Message ID:", msg.id);
    }
    if ($DebugTestMode) {
      console.log("🎨 Message type:", msg.type);
    }
    if ($DebugTestMode) {
      console.log("🎨 Message version:", msg.version);
    }
    if ($DebugTestMode) {
      console.log("🎨 Include files flag:", includeFiles);
    }
    if ($DebugTestMode) {
      console.log("🎨 Message files:", msg.files);
    }
    if ($DebugTestMode) {
      console.log("🎨 Files count:", msg.files ? msg.files.length : 0);
    }
    if ($DebugTestMode) {
      console.log("🎨 Files is array:", Array.isArray(msg.files));
    }

    if (msg.files && Array.isArray(msg.files)) {
      if ($DebugTestMode) {
        console.log("🎨 Files detailed info:");
      }
      msg.files.forEach((file, index) => {
        if ($DebugTestMode) {
          console.log(`🎨   File ${index + 1}:`, {
            id: file.id,
            filename: file.filename,
            type: file.type,
            hasContent: !!file.content,
            contentLength: file.content?.length,
          });
        }
      });
    }

    const time = new Date(msg.timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    const modelLabel =
      msg.model && msg.type === "ai"
        ? `<span class="model-label">${this.getModelName(msg.model)}</span>`
        : "";

    // ✅ FIXED VERSION DEBUGGING
    if ($DebugTestMode) {
      console.log("🎨 🔢 === VERSION NAVIGATION DEBUG ===");
    }
    if ($DebugTestMode) {
      console.log("🎨 🔢 Current message ID:", msg.id);
    }
    if ($DebugTestMode) {
      console.log("🎨 🔢 Current message version:", msg.version);
    }

    // Check for versions in chatHistory
    const currentConversation = this.getCurrentConversation();
    if ($DebugTestMode) {
      console.log(
        "🎨 🔢 Current conversation length:",
        currentConversation.length
      );
    }

    // ✅ FIXED: Filter logic is actually correct, but need better validation
    if ($DebugTestMode) {
      console.log("🎨 🔢 Filtering versions for message ID:", msg.id);
    }
    const messageVersions = currentConversation.filter((m) => {
      const matches = m.id === msg.id;
      if ($DebugTestMode) {
        console.log(
          `🎨 🔢   Checking message ${m.id}: matches=${matches}, version=${m.version}`
        );
      }
      return matches;
    });

    if ($DebugTestMode) {
      console.log("🎨 🔢 Found message versions:", messageVersions.length);
    }

    // ✅ FIXED: Better version calculation with validation
    let versionNumbers = messageVersions.map((m) => m.version || 1);
    let totalVersions =
      versionNumbers.length > 0 ? Math.max(...versionNumbers) : 1;
    let currentVersion = msg.version || 1;

    // ✅ CRITICAL FIX: Validate that we actually have multiple distinct versions
    const hasMultipleVersions = messageVersions.length > 1;
    const hasValidVersions = versionNumbers.some((v) => v > 1);

    if ($DebugTestMode) {
      console.log("🎨 🔢 Version calculations:", {
        versionNumbers,
        totalVersions,
        currentVersion,
        hasMultipleVersions,
        hasValidVersions,
        shouldShowVersionNav: hasMultipleVersions && hasValidVersions,
      });
    }

    // ✅ FIXED: Only create version nav when we actually have multiple versions
    const versionNav =
      hasMultipleVersions && hasValidVersions
        ? this.createVersionNav(msg.id, currentVersion, totalVersions)
        : "";

    if ($DebugTestMode) {
      console.log(
        "🎨 🔢 Version nav HTML:",
        versionNav ? "CREATED" : "NOT CREATED"
      );
    }
    if (versionNav && $DebugTestMode) {
      console.log("🎨 🔢 Version nav preview:", versionNav.substring(0, 200));
    }

    if ($DebugTestMode) {
      console.log("🎨 🔢 msg.text:", msg.text);
    }

    let messageContent = "";

    if (msg.text) {
      messageContent = this.formatMessage(msg.text, msg.type === "ai");
    }

    // ===== SEPARATE FILE HANDLING FOR USER vs AI =====
    let userFilesHtml = "";
    let aiFilesHtml = "";

    if (
      includeFiles &&
      msg.files &&
      Array.isArray(msg.files) &&
      msg.files.length > 0
    ) {
      if ($DebugTestMode) {
        console.log("🎨 🗂️ === PROCESSING FILES BY MESSAGE TYPE ===");
      }
      if ($DebugTestMode) {
        console.log("🎨 🗂️ Message type:", msg.type);
      }
      if ($DebugTestMode) {
        console.log("🎨 🗂️ Files to process:", msg.files.length);
      }

      if (msg.type === "user") {
        // USER FILES - Go on top, different styling
        if ($DebugTestMode) {
          console.log("🎨 🗂️ === CREATING USER FILE ATTACHMENTS ===");
        }
        userFilesHtml = this.createUserFileAttachments(msg.files, msg.id);
      } else if (msg.type === "ai") {
        // AI FILES - Go on bottom, different styling
        if ($DebugTestMode) {
          console.log("🎨 🗂️ === CREATING AI FILE ATTACHMENTS ===");
        }
        aiFilesHtml = this.createAIFileAttachments(msg.files, msg.id);
        if ($DebugTestMode) {
          console.log("AI Files HTML created,", aiFilesHtml);
        }
      }
    }

    // Footer content (edit buttons, etc.)
    const footerContent =
      msg.type === "user"
        ? `          <button class="copy-btn" onclick="messageManager.copyMessage('${msg.id}')" title="Copy">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
          </button><button class="message-edit-btn" onclick="messageManager.startEdit('${msg.id}')">Edit</button>`
        : `<div class="ai-message-controls">
        <div class="button-row">
          <button class="copy-btn" onclick="messageManager.copyMessage('${msg.id}')" title="Copy">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
          </button>
          <button class="thumbs-up-btn" onclick="messageManager.rateMessage('${msg.id}', 'up')" title="Good response">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M7 10v12"></path>
              <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2h0a3.13 3.13 0 0 1 3 3.88Z"></path>
            </svg>
          </button>
          <button class="thumbs-down-btn" onclick="messageManager.rateMessage('${msg.id}', 'down')" title="Poor response">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M17 14V2"></path>
              <path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22h0a3.13 3.13 0 0 1-3-3.88Z"></path>
            </svg>
          </button>
          <button class="retry-btn" onclick="messageManager.retryMessage('${msg.id}')" title="Retry">
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

    if ($DebugTestMode) {
      console.log("🎨 📝 === ASSEMBLING FINAL HTML ===");
    }
    if ($DebugTestMode) {
      console.log("🎨 📝 Message type:", msg.type);
    }
    if ($DebugTestMode) {
      console.log("🎨 📝 Has user files:", userFilesHtml.length > 0);
    }
    if ($DebugTestMode) {
      console.log("🎨 📝 Has AI files:", aiFilesHtml.length > 0);
    }
    if ($DebugTestMode) {
      console.log("🎨 📝 AI files:", aiFilesHtml);
    }

    let finalHTML;
    if (msg.type === "user") {
      // USER MESSAGES: Files go at the TOP
      finalHTML = `
${userFilesHtml}
<div class="message-wrapper">
  <div class="message-header">
    <span class="message-type">You</span>
  </div>
  <div class="message-content">${messageContent}</div>
  <div class="message-footer">
    ${footerContent}
    ${versionNav}
  </div>
</div>
`;
    } else {
      // AI MESSAGES: Files go at the BOTTOM
      finalHTML = `
<div class="message-header">
  <span class="message-type">${modelLabel || "AI"}</span>
</div>
<div class="message-content">${messageContent}</div>
${aiFilesHtml}
<div class="message-footer">
  ${footerContent}
  ${versionNav}
</div>
`;
    }

    if ($DebugTestMode) {
      console.log("🎨 📝 Final HTML:", finalHTML);
    }
    if ($DebugTestMode) {
      console.log("🎨 📝 Final HTML length:", finalHTML.length);
    }
    if ($DebugTestMode) {
      console.log(
        "🎨 📝 Final HTML contains user files:",
        finalHTML.includes("user-file")
      );
    }
    if ($DebugTestMode) {
      console.log(
        "🎨 📝 Final HTML contains AI files:",
        finalHTML.includes("ai-file")
      );
    }
    if ($DebugTestMode) {
      console.log(
        "🎨 📝 Final HTML contains version-nav:",
        finalHTML.includes('class="version-nav"')
      );
    }
    if ($DebugTestMode) {
      console.log(
        "🎨 📝 Final HTML preview:",
        finalHTML.substring(0, 400) + "..."
      );
    }

    if ($DebugTestMode) {
      console.log("🎨 ✅ === CREATE MESSAGE HTML COMPLETED ===", finalHTML);
    }
    return finalHTML;
  },

  constructFileContent: function (fileData) {
    if ($DebugTestMode) {
      console.log("Starting constructFileContent with fileData:", fileData);
    }

    // If we get a complete string that's valid JSON, parse it normally
    if (typeof fileData === "string") {
      try {
        // First try parsing as complete JSON
        const parsedData = JSON.parse(fileData);
        if ($DebugTestMode) {
          console.log("Parsed complete JSON successfully");
        }
        return this.extractCodeFromValidJSON(parsedData);
      } catch (fullJsonError) {
        if ($DebugTestMode) {
          console.log(
            "Failed to parse as complete JSON, trying partial extraction"
          );
        }
        return this.extractCodeFromPartialJSON(fileData);
      }
    }
    // If we already have an object, process normally
    else if (typeof fileData === "object" && fileData !== null) {
      return this.extractCodeFromValidJSON(fileData);
    }

    if ($DebugTestMode) {
      console.error("Invalid fileData format", fileData);
    }
    return "";
  },

  // Helper for complete JSON objects
  extractCodeFromValidJSON: function (parsedData) {
    if (!parsedData.sections || typeof parsedData.sections !== "object") {
      if ($DebugTestMode) {
        console.error("Missing or invalid sections", parsedData);
      }
      return "";
    }

    let content = "";
    for (const [sectionName, section] of Object.entries(parsedData.sections)) {
      if (section && typeof section.content === "string") {
        content += section.content.trim() + "\n\n";
      }
    }
    return content.trim();
  },

  // Special handling for partial JSON
  extractCodeFromPartialJSON: function (jsonString) {
    if ($DebugTestMode) {
      console.log("Attempting partial JSON extraction");
    }

    // Try to find code content even in broken JSON
    let content = "";

    // Look for all "content": "..." patterns in the string
    const contentPattern = /"content"\s*:\s*"([^"]*)"/g;
    let match;

    while ((match = contentPattern.exec(jsonString)) !== null) {
      const codeContent = match[1];
      if (codeContent) {
        // Unescape any escaped characters
        const unescapedContent = codeContent
          .replace(/\\n/g, "\n")
          .replace(/\\t/g, "\t")
          .replace(/\\"/g, '"')
          .replace(/\\\\/g, "\\");

        content += unescapedContent + "\n\n";
        if ($DebugTestMode) {
          console.log("Extracted partial content:", unescapedContent);
        }
      }
    }

    // Fallback - look for any code-looking segments between quotes
    if (!content) {
      if ($DebugTestMode) {
        console.log("Trying fallback extraction");
      }
      const codePattern = /"(?:content|code)"\s*:\s*"([\s\S]*?)"(?=\s*[,}])/g;
      while ((match = codePattern.exec(jsonString)) !== null) {
        const potentialCode = match[1];
        if (potentialCode && potentialCode.trim().length > 0) {
          content += potentialCode + "\n\n";
        }
      }
    }

    return content.trim() || jsonString; // Return original if no code found
  },

  createUserFileAttachments: function (files, messageId) {
    if ($DebugTestMode) {
      console.log("🎨 👤 === CREATING USER FILE ATTACHMENTS ===", files);
    }
    if ($DebugTestMode) {
      console.log("🎨 👤 Files to process:", files.length);
    }

    let userFilesHtml =
      '<div class="attachment-previews" style="display: flex; flex-wrap: wrap; gap: 10px; margin: 10px 0;">';

    files.forEach((fileData, index) => {
      // Handle both parsed objects and string content
      let fileContent;
      if (typeof fileData.content === "string") {
        try {
          fileContent = JSON.parse(fileData.content) || {};
        } catch (e) {
          // If parsing fails, treat it as raw content
          fileContent = {
            content: fileData.content,
            filename: fileData.filename || `file_${index}.txt`,
            type: fileData.type || "text",
          };
        }
      } else {
        // Content is already an object
        fileContent = fileData.content || fileData;
      }

      // Ensure we have proper filename and content structure
      const fileName =
        fileContent.filename ||
        fileContent.content?.filename ||
        `file_${index}`;
      const fileId = fileContent.id || `file_${Date.now()}_${index}`;
      const fileType =
        fileContent.type || (fileName.endsWith(".json") ? "json" : "text");
      const mimeType = fileContent.mime_type || fileContent.contentType || "";

      if ($DebugTestMode) {
        console.log(`🎨 👤 Processing user file ${index + 1}:`, fileName);
      }

      try {
        // Determine if this is an image file
        const isImage =
          mimeType.startsWith("image/") ||
          /\.(png|jpg|jpeg|gif|webp|bmp|svg)$/i.test(fileName);

        // Get the actual content (could be base64 data)
        const rawContent =
          fileContent.data ||
          fileContent.content ||
          (typeof fileContent === "string" ? fileContent : "");

        let displayContent;
        let contentHtml;

        if (isImage && rawContent) {
          // Handle image files - display the actual image
          const imageSrc = rawContent.startsWith("data:")
            ? rawContent
            : `data:${mimeType};base64,${rawContent}`;

          contentHtml = `
            <div class="attachment-content">
              <img style="height: 100%; max-height: 150px; object-fit: contain;" 
                   src="${imageSrc}" 
                   alt="${fileName}">
            </div>
          `;
        } else {
          // Handle non-image files as before
          if (fileType === "json" || fileName.endsWith(".json")) {
            displayContent = this.constructFileContent(
              fileContent.content || fileContent
            );
          } else {
            displayContent =
              fileContent.content_preview ||
              fileContent.content ||
              (typeof fileContent === "string"
                ? fileContent
                : JSON.stringify(fileContent));
          }

          contentHtml = `
            <div class="attachment-content">
              <code>${this.escapeHtml(displayContent)}</code>
            </div>
          `;
        }

        // Create attachment HTML using the same structure as createMessageHTML
        const userFileHtml = `
<div class="attachment-item ${isImage ? "image" : fileType}" 
     id="attachment_${fileId}" 
     data-attachment-id="${fileId}"
     data-file-name-id="${fileName}"
     style="padding-top: 0px !important; margin-left: 0px !important; position: relative;">
    <div class="attachment-preview" 
         data-attachment-id="${fileId}"
         data-file-name-id="${fileName}"
         onclick="messageManager.enlargeAttachment('${fileId}')"
         style="cursor: pointer; ${isImage ? "height: 150px;" : ""}">
        ${contentHtml}
    </div>
    <button class="copy-attachment" 
            onclick="event.stopPropagation(); messageManager.copySentAttachmentOrEditAttachment('${fileId}', '${fileName}', '${messageId}')" 
            title="Copy attachment">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        </svg>
    </button>
</div>
`;

        userFilesHtml += userFileHtml;
        if ($DebugTestMode) {
          console.log(`🎨 👤 ✅ Created user file HTML for: ${fileName}`);
        }
      } catch (error) {
        if ($DebugTestMode) {
          console.error(
            `🎨 👤 ❌ Error processing user file ${index + 1}:`,
            error
          );
        }
      }
    });

    userFilesHtml += "</div>";
    if ($DebugTestMode) {
      console.log("🎨 👤 ✅ User file attachments completed");
    }
    return userFilesHtml;
  },

  createAIFileAttachments: function (files, messageId) {
    if ($DebugTestMode) {
      console.log("🎨 🤖 === CREATING AI FILE ATTACHMENTS ===", files);
    }
    if ($DebugTestMode) {
      console.log("🎨 🤖 Files to process:", files.length);
    }
    if ($DebugTestMode) {
      console.log("🎨 🤖 Input files:", JSON.stringify(files, null, 2));
    }

    let aiFilesHtml =
      '<div class="message-files" style="display: block; visibility: visible; opacity: 1;">';

    files.forEach((fileData, index) => {
      // Check if fileData is already an object or needs parsing
      let fileContent;
      if (typeof fileData === "string") {
        try {
          fileContent = JSON.parse(fileData);
          if ($DebugTestMode) {
            console.log("Parsed JSON string successfully");
          }
        } catch (error) {
          if ($DebugTestMode) {
            console.error("Failed to parse fileData as JSON:", error);
          }
          return;
        }
      } else if (typeof fileData === "object" && fileData !== null) {
        fileContent = fileData;
        if ($DebugTestMode) {
          console.log("File data is already an object");
        }
      } else {
        if ($DebugTestMode) {
          console.error("Invalid file data type:", typeof fileData);
        }
        return;
      }

      if ($DebugTestMode) {
        console.log(
          `🎨 🤖 Processing AI file ${index + 1}:`,
          fileContent.filename || `file_${index + 1}`
        );
      }
      if ($DebugTestMode) {
        console.log("🎨 🤖 File data:", JSON.stringify(fileContent, null, 2));
      }

      try {
        // Ensure file has proper structure
        if (!fileContent.id) {
          fileContent.id = `ai_file_${Date.now()}_${Math.random()
            .toString(36)
            .substr(2, 9)}`;
          if ($DebugTestMode) {
            console.log("🎨 🤖 Generated missing file ID:", fileContent.id);
          }
        }

        // Handle content extraction from the object structure
        let fileContentData = fileContent;
        let fileName = fileContent.filename || `ai_generated_${index + 1}`;

        // Extract the actual content from sections or use the whole structure
        let contentString = "";
        if (fileContent.sections) {
          // If we have sections, concatenate all section content
          Object.values(fileContent.sections).forEach((section) => {
            if (section.content) {
              contentString += section.content + "\n";
            }
          });
        } else if (fileContent.content) {
          contentString =
            typeof fileContent.content === "string"
              ? fileContent.content
              : JSON.stringify(fileContent.content, null, 2);
        } else {
          contentString = JSON.stringify(fileContent, null, 2);
        }

        if ($DebugTestMode) {
          console.log("🎨 🤖 Extracted content length:", contentString.length);
        }

        // Get file icon and classes with fallbacks
        let fileIcon = "📄";
        let fileTypeClass = "unknown";
        let languageClass = fileContent.language || "text";

        if ($DebugTestMode) {
          console.log("🎨 🤖 Extracting file extension from filename:", fileName);
        }
        let extension = fileName.split(".").pop() || "txt";
        if ($DebugTestMode) {
          console.log("🎨 🤖 Detected file extension:", extension);
        }

        if (extension) {
          if ($DebugTestMode) {
            console.log("🎨 🤖 File extension found:", extension);
          }

          if (typeof contentManager !== "undefined") {
            if ($DebugTestMode) {
              console.log(
                "🎨 🤖 contentManager available, getting file icon and type"
              );
            }
            const originalFileIcon = fileIcon;
            fileIcon = this.getFileIcon(fileName) || fileIcon;
            if ($DebugTestMode) {
              console.log(`🎨 🤖 File icon: ${originalFileIcon} → ${fileIcon}`);
            }

            const originalFileTypeClass = fileTypeClass;
            fileTypeClass =
              chatManager.getFileTypeClass(extension) || fileTypeClass;
            if ($DebugTestMode) {
              console.log(
                `🎨 🤖 File type class: ${originalFileTypeClass} → ${fileTypeClass}`
              );
            }
          } else {
            if ($DebugTestMode) {
              console.warn(
                "🎨 🤖 ⚠️ contentManager not available, using fallback icon"
              );
            }
            const originalFileIcon = fileIcon;
            fileIcon = chatManager.getFallbackFileIcon(extension) || fileIcon;
            if ($DebugTestMode) {
              console.log(
                `🎨 🤖 Fallback file icon: ${originalFileIcon} → ${fileIcon}`
              );
            }

            const originalFileTypeClass = fileTypeClass;
            fileTypeClass =
              chatManager.getFileTypeClass(extension) || fileTypeClass;
            if ($DebugTestMode) {
              console.log(
                `🎨 🤖 File type class: ${originalFileTypeClass} → ${fileTypeClass}`
              );
            }
          }
        } else {
          if ($DebugTestMode) {
            console.warn(
              "🎨 🤖 ⚠️ No file extension provided, using fallback values",
              "\nFilename:",
              fileName,
              "\nCurrent fileIcon:",
              fileIcon,
              "\nCurrent fileTypeClass:",
              fileTypeClass
            );
          }
        }

        // Calculate file size
        const fileSize = new TextEncoder().encode(contentString).length;
        const sizeLabel =
          fileSize < 1000
            ? `${fileSize} B`
            : `${(fileSize / 1000).toFixed(1)} KB`;
        if ($DebugTestMode) {
          console.log("🎨 🤖 File size:", sizeLabel);
        }

        // Determine complexity
        const complexity =
          fileContent.metadata?.complexity ||
          (contentString.length < 500
            ? "basic"
            : contentString.length < 2000
            ? "intermediate"
            : "complex");
        if ($DebugTestMode) {
          console.log("🎨 🤖 File complexity:", complexity);
        }

        const displayContent = this.escapeHtml(contentString);
        if ($DebugTestMode) {
          console.log("DISPLAY displayContent length:", displayContent.length);
        }

        // AI FILE HTML
        const aiFileHtml = `
<div class="content-block file-block file-block-${
          extension?.replace(".", "") || "unknown"
        } ai-generated" 
     id="ai_block_${fileContent.id}" 
     data-type="${fileContent.type || "unknown"}" 
     data-extension="${extension || ""}"
     data-language="${languageClass}"
     data-file-id="ai_file_${fileContent.id}"
     style="display: block; visibility: visible; opacity: 1;">
  <div class="block-header">
    <div class="block-info">
      <div class="block-icon">${fileIcon}</div>
      <div class="block-details">
        <h4 class="filename">${this.escapeHtml(fileName)}</h4>
        <div class="block-meta">
          <span class="file-type file-block-${
            extension?.replace(".", "") || "unknown"
          }">${extension || "generated"}</span>
          <span class="language ${languageClass}">${languageClass}</span>
          <span class="file-size">${sizeLabel}</span>
          <span class="complexity">Complexity: ${complexity}</span>
          <span class="ai-file-badge" style="margin-left: 8px; background: #10b981; color: white; padding: 1px 6px; border-radius: 3px; font-size: 10px;">AI Generated</span>
        </div>
      </div>
    </div>
    <div class="block-actions" style="position: relative; z-index: 10;">
      <button class="block-btn primary" 
              data-action="preview" 
              data-file-id="ai_file_${fileContent.id}"
              title="Live Preview">
        👁️ Live Preview
      </button>
      <button class="block-btn" 
              data-action="download" 
              data-file-id="ai_file_${fileContent.id}"
              style="pointer-events: auto; cursor: pointer; opacity: 1;"
              title="Download file">
        ⬇️ Download
      </button>
      <button class="block-btn" 
              data-action="copy" 
              data-file-id="ai_file_${fileContent.id}"
              style="pointer-events: auto; cursor: pointer; opacity: 1;"
              title="Copy content">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg> Copy
      </button>
      <span class="collapse-indicator">▼</span>
    </div>
  </div>
  <div class="block-content" style="display: block !important;">
    <div class="code-preview">
      <pre><code class="language-${languageClass} hljs language-${languageClass} ai-generated-code" data-file-id="ai_file_${
          fileContent.id
        }">${displayContent}</code></pre>
    </div>
  </div>
</div>
`;

        aiFilesHtml += aiFileHtml;
        if ($DebugTestMode) {
          console.log(`🎨 🤖 ✅ Created AI file HTML for: ${fileName}`);
        }
      } catch (error) {
        if ($DebugTestMode) {
          console.error(`🎨 🤖 ❌ Error processing AI file ${index + 1}:`, error);
        }
        aiFilesHtml += `
<div class="content-block file-block error ai-generated" 
     id="ai_block_error_${index}"
     style="display: block; visibility: visible; opacity: 1;">
  <div class="block-header">
    <div class="block-info">
      <div class="block-icon">❌</div>
      <div class="block-details">
        <h4 class="filename">Error: ${this.escapeHtml(
          fileContent?.filename || `file_${index + 1}`
        )}</h4>
        <div class="block-meta">
          <span class="file-type error">Failed to process</span>
          <span class="ai-file-badge" style="margin-left: 8px; background: #ef4444; color: white; padding: 1px 6px; border-radius: 3px; font-size: 10px;">Error</span>
        </div>
      </div>
    </div>
  </div>
</div>
`;
      }
    });

    aiFilesHtml += "</div>";
    if ($DebugTestMode) {
      console.log("🎨 🤖 ✅ AI file attachments completed");
    }
    if ($DebugTestMode) {
      console.log("🎨 🤖 Final HTML output length:", aiFilesHtml.length);
    }
    return aiFilesHtml;
  },

  // Copy message content to clipboard
  copyMessage: function (messageId) {
    const currentVersion = this.getDataVersion(messageId);

    const messageEl = document.querySelector(
      `[data-message-id="${messageId}"][data-version="${currentVersion}"]`
    );
    if (!messageEl) return;

    const contentEl = messageEl.querySelector(".message-content");
    if (!contentEl) return;

    // Get plain text from the message content
    const plainText = this.getPlainText(contentEl);

    // Copy to clipboard
    navigator.clipboard
      .writeText(plainText)
      .then(() => {
        // Show visual feedback
        const copyBtn = messageEl.querySelector(".copy-btn");
        if (copyBtn) {
          const originalTitle = copyBtn.title;
          copyBtn.title = "Copied!";
          copyBtn.style.color = "#4CAF50";

          setTimeout(() => {
            copyBtn.title = originalTitle;
            copyBtn.style.color = "";
          }, 2000);
        }
      })
      .catch((err) => {
        if ($DebugTestMode) {
          console.error("Failed to copy message:", err);
        }
        // Fallback for older browsers
        const textArea = document.createElement("textarea");
        textArea.value = plainText;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      });
  },

  createVersionNav: function (messageId, displayVersion, totalVersions) {
    if ($DebugTestMode) {
      console.log("🔢 === CREATE VERSION NAV (FIXED VERSION CALCULATION) ===");
    }
    if ($DebugTestMode) {
      console.log("🔢 📍 ENTRY PARAMETERS:");
    }
    if ($DebugTestMode) {
      console.log("🔢   - messageId:", messageId);
    }
    if ($DebugTestMode) {
      console.log("🔢   - displayVersion (param):", displayVersion);
    }
    if ($DebugTestMode) {
      console.log("🔢   - totalVersions (param):", totalVersions);
    }

    // Get current conversation
    const currentConversation = this.getCurrentConversation();
    if ($DebugTestMode) {
      console.log(
        "🔢   - Current conversation length:",
        currentConversation.length
      );
    }

    // Find ALL versions of this message ID correctly
    const messageVersions = currentConversation.filter((m) => {
      const matches = m.id === messageId;
      if (matches && $DebugTestMode) {
        console.log(
          `🔢   - Found message version: id=${m.id}, version=${
            m.version || 1
          }, text="${m.text.substring(0, 30)}..."`
        );
      }
      return matches;
    });

    if ($DebugTestMode) {
      console.log("🔢   - Total message versions found:", messageVersions.length);
    }

    // Extract version numbers and find the highest
    const versionNumbers = messageVersions.map((msg) => {
      const version = msg.version || 1;
      if ($DebugTestMode) {
        console.log(`🔢   - Message ${msg.id} has version: ${version}`);
      }
      return version;
    });

    if ($DebugTestMode) {
      console.log("🔢   - All version numbers:", versionNumbers);
    }

    // ✅ CRITICAL FIX: Use the maximum of all found versions OR the provided totalVersions
    let calculatedTotalVersions;

    if (versionNumbers.length === 0) {
      calculatedTotalVersions = totalVersions || 1;
    } else {
      // Use the maximum version number found, but also consider the provided totalVersions
      const maxFoundVersion = Math.max(...versionNumbers);
      calculatedTotalVersions = Math.max(maxFoundVersion, totalVersions || 1);
    }

    if ($DebugTestMode) {
      console.log(
        "🔢   - Final calculatedTotalVersions:",
        calculatedTotalVersions
      );
    }

    // Ensure displayVersion is valid
    const currentDisplayVersion = Math.max(
      1,
      Math.min(calculatedTotalVersions, displayVersion || 1)
    );
    if ($DebugTestMode) {
      console.log("🔢   - Final currentDisplayVersion:", currentDisplayVersion);
    }

    // ✅ CRITICAL FIX: Only show version nav if we actually have multiple versions
    if (calculatedTotalVersions <= 1) {
      if ($DebugTestMode) {
        console.log("🔢   - Only 1 version total, not showing version nav");
      }
      if ($DebugTestMode) {
        console.log("🔢 📤 RETURNING EMPTY STRING - NO VERSION NAV NEEDED");
      }
      if ($DebugTestMode) {
        console.log("🔢 ✅ === CREATE VERSION NAV COMPLETE (EMPTY) ===");
      }
      return "";
    }

    // Calculate button states
    const prevDisabled = currentDisplayVersion <= 1;
    const nextDisabled = currentDisplayVersion >= calculatedTotalVersions;

    if ($DebugTestMode) {
      console.log(
        "🔢   - Button states: prev disabled =",
        prevDisabled,
        ", next disabled =",
        nextDisabled
      );
    }
    if ($DebugTestMode) {
      console.log(
        "🔢   - Will display:",
        `${currentDisplayVersion}/${calculatedTotalVersions}`
      );
    }

    // Create the version navigation HTML
    const htmlResult = `
    <div class="version-nav" data-message-id="${messageId}" data-current-version="${currentDisplayVersion}">
      <button class="version-nav-btn prev" onclick="messageManager.navigateVersion('${messageId}', -1)" ${
      prevDisabled ? "disabled" : ""
    }>‹</button>
      <span class="version-indicator">${currentDisplayVersion}/${calculatedTotalVersions}</span>
      <button class="version-nav-btn next" onclick="messageManager.navigateVersion('${messageId}', 1)" ${
      nextDisabled ? "disabled" : ""
    }>›</button>
    </div>
  `;

    // 🐛 NEW DEBUG LOGS FOR HTML OUTPUT
    if ($DebugTestMode) {
      console.log("🔢 🔍 === HTML DEBUG ANALYSIS ===");
    }
    if ($DebugTestMode) {
      console.log("🔢 📋 Generated HTML structure:");
    }
    if ($DebugTestMode) {
      console.log("🔢 " + htmlResult);
    }
    if ($DebugTestMode) {
      console.log("🔢 📏 HTML length:", htmlResult.length);
    }
    if ($DebugTestMode) {
      console.log(
        "🔢 🏷️  HTML contains 'version-nav' class:",
        htmlResult.includes('class="version-nav"')
      );
    }
    if ($DebugTestMode) {
      console.log(
        "🔢 🔢 HTML contains version indicator:",
        htmlResult.includes("version-indicator")
      );
    }
    if ($DebugTestMode) {
      console.log(
        "🔢 ⬅️  HTML contains prev button:",
        htmlResult.includes('class="version-nav-btn prev"')
      );
    }
    if ($DebugTestMode) {
      console.log(
        "🔢 ➡️  HTML contains next button:",
        htmlResult.includes('class="version-nav-btn next"')
      );
    }
    if ($DebugTestMode) {
      console.log(
        "🔢 🆔 HTML data-message-id:",
        htmlResult.match(/data-message-id="([^"]*)"/)?.[1]
      );
    }
    if ($DebugTestMode) {
      console.log(
        "🔢 🔢 HTML data-current-version:",
        htmlResult.match(/data-current-version="([^"]*)"/)?.[1]
      );
    }
    if ($DebugTestMode) {
      console.log(
        "🔢 🚫 Prev button disabled:",
        htmlResult.includes("disabled") &&
          htmlResult.indexOf("disabled") < htmlResult.indexOf("next")
      );
    }
    if ($DebugTestMode) {
      console.log(
        "🔢 🚫 Next button disabled:",
        htmlResult.includes("disabled") &&
          htmlResult.lastIndexOf("disabled") > htmlResult.indexOf("next")
      );
    }

    // Check for any potential HTML issues
    const htmlTrimmed = htmlResult.trim();
    if ($DebugTestMode) {
      console.log("🔢 ✂️  HTML after trim length:", htmlTrimmed.length);
    }
    if ($DebugTestMode) {
      console.log("🔢 🎯 HTML starts with div:", htmlTrimmed.startsWith("<div"));
    }
    if ($DebugTestMode) {
      console.log("🔢 🎯 HTML ends with div:", htmlTrimmed.endsWith("</div>"));
    }

    // Extract and log the actual display text
    const versionDisplayMatch = htmlResult.match(
      /class="version-indicator">([^<]*)</
    );
    if ($DebugTestMode) {
      console.log(
        "🔢 📊 Extracted version display text:",
        versionDisplayMatch?.[1]
      );
    }

    if ($DebugTestMode) {
      console.log("🔢 🔍 === END HTML DEBUG ANALYSIS ===");
    }

    if ($DebugTestMode) {
      console.log(
        "🔢 📤 FINAL RESULT: Version nav created with",
        `${currentDisplayVersion}/${calculatedTotalVersions}`
      );
    }
    if ($DebugTestMode) {
      console.log("🔢 ✅ === CREATE VERSION NAV COMPLETE ===");
    }

    return htmlResult;
  },

  startEdit: function (messageId) {
    // Cancel any ongoing edit
    if (this.editingMessageId) {
      this.cancelEdit(this.editingMessageId);
    }

    const currentVersion = this.getDataVersion(messageId);

    const messageEl = document.querySelector(
      `[data-message-id="${messageId}"][data-version="${currentVersion}"]`
    );
    if (!messageEl) return;

    const contentEl = messageEl.querySelector(".message-content");
    const footerEl = messageEl.querySelector(".message-footer");

    if (!contentEl || !footerEl) return;

    // EXPLICITLY hide the edit button immediately
    const editButton = footerEl.querySelector(".message-edit-btn");
    if (editButton) {
      editButton.style.display = "none";
      editButton.disabled = true;
    }

    // Get the current text (remove HTML formatting)
    const currentText = this.getPlainText(contentEl);

    // Store the original content AND footer content
    messageEl.dataset.originalContent = contentEl.innerHTML;
    messageEl.dataset.originalFooter = footerEl.innerHTML;

    // Store the original attachment container state
    const attachmentContainer = messageEl.querySelector(".attachment-previews");
    if (attachmentContainer) {
      messageEl.dataset.originalAttachments = attachmentContainer.outerHTML;
      messageEl.dataset.hadAttachments = "true";
    } else {
      messageEl.dataset.hadAttachments = "false";
    }

    const currentConversation = this.getCurrentConversation();
    if ($DebugTestMode) {
      console.log("currentConversation:", currentConversation);
    }
    if ($DebugTestMode) {
      console.log("messageId:", messageId);
    }
    if ($DebugTestMode) {
      console.log("currentVersion:", currentVersion);
    }
    if ($DebugTestMode) {
      console.log(
        "Searching for messageId:",
        messageId,
        "with currentVersion:",
        currentVersion,
        "type:",
        typeof currentVersion
      );
    }
    const historyEntry = currentConversation.find((msg) => {
      if ($DebugTestMode) {
        console.log(
          "Checking message:",
          msg.id,
          "version:",
          msg.version,
          "type:",
          typeof msg.version
        );
      }
      return (
        msg.id === messageId && String(msg.version) === String(currentVersion)
      );
    });
    if ($DebugTestMode) {
      console.log("historyEntry:", historyEntry);
    }
    if ($DebugTestMode) {
      console.log("historyEntry.files:", historyEntry?.files);
    }
    if ($DebugTestMode) {
      console.log("historyEntry.attachments:", historyEntry?.attachments);
    }
    const hasAttachments =
      historyEntry && (historyEntry.files || historyEntry.attachments);
    if ($DebugTestMode) {
      console.log("hasAttachments:", hasAttachments);
    }

    // Create edit UI with full chat input wrapper structure
    contentEl.innerHTML = `
<div class="message-edit-container">
  <div class="chat-input-wrapper">
    <textarea
      class="chat-input message-edit-input"
      id="edit_${messageId}"
      placeholder="Edit your message..."
      rows="1"
    >${currentText}</textarea>
    <div class="ai_chat_box_row">
      <!-- Left side controls -->
      <div class="left-controls">
        <!-- Attachment Button -->
        <button
          class="attachment-button"
          id="editAttachmentButton_${messageId}"
          title="Attach files or images"
          ${hasAttachments ? "disabled" : ""}
        >
          <svg
            class="attachment-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
        <!-- Context+ Toggle 
        <div
          class="context-plus-toggle"
          id="editContextPlusToggle_${messageId}"
          title="Toggle Context+ for enhanced memory and context"
        >
          <span class="context-plus-label">Context+</span>
        </div>-->

     <!-- Hidden file input -->
        <input
          type="file"
          id="editAttachmentInput_${messageId}"
          class="attachment-input"
          multiple
  accept=".txt,.js,.py,.html,.css,.json,.md,.csv,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,image/png,image/jpeg,image/webp,image/gif,audio/*,video/*" // <-- REVISED
        />
      </div>

      <!-- Right side controls -->
      <div class="chat-controls">
        <div class="ai-dropdown-container" id="editAiDropdownContainer_${messageId}">
          <!-- This will be populated by JavaScript based on auth state -->
        </div>
        <div class="message-edit-actions">
          <button class="edit-cancel-btn" onclick="messageManager.cancelEdit('${messageId}')">Cancel</button>
          <button class="edit-save-btn" onclick="messageManager.saveEdit('${messageId}')">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"></path>
                </svg>
              </button>
        </div>
      </div>
    </div>
  </div>
  ${
    hasAttachments
      ? '<div class="edit-attachments-notice">Note: Editing this message will create a new conversation branch. You can switch between branches using the arrow navigation buttons.</div>'
      : ""
  }
</div>
`;

    // Clear the footer content (since buttons are now in the main content)
    footerEl.innerHTML = "";
    footerEl.style.display = "none";

    this.addRedXToAttachments(messageId);

    // Set up the textarea with auto-resize
    const textarea = document.getElementById(`edit_${messageId}`);
    textarea.style.height = "auto";
    textarea.style.height = textarea.scrollHeight + "px";

    textarea.addEventListener("input", function () {
      this.style.height = "auto";
      this.style.height = Math.min(this.scrollHeight, 300) + "px";
    });

    // Handle Enter key for quick save
    textarea.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        messageManager.saveEdit(messageId);
      }
    });

    // Set up paste handler for edit textarea
    this.setupEditPasteHandler(textarea, messageId);

    // Set up attachment functionality for edit mode (adapted from setupEventListeners)
    const editAttachmentButton = document.getElementById(
      `editAttachmentButton_${messageId}`
    );
    const editAttachmentInput = document.getElementById(
      `editAttachmentInput_${messageId}`
    );

    if ($DebugTestMode) {
      if ($DebugTestMode) {
        console.log("📎 === EDIT ATTACHMENT SETUP DEBUG ===");
      }
      if ($DebugTestMode) {
        console.log("📎 Edit attachment button found:", !!editAttachmentButton);
      }
      if ($DebugTestMode) {
        console.log("📎 Edit attachment input found:", !!editAttachmentInput);
      }
    }

    if (editAttachmentButton && $DebugTestMode) {
      if ($DebugTestMode) {
        console.log("📎 Edit attachment button element:", editAttachmentButton);
      }
      if ($DebugTestMode) {
        console.log(
          "📎 Button classes:",
          editAttachmentButton.classList.toString()
        );
      }
      if ($DebugTestMode) {
        console.log("📎 Button parent:", editAttachmentButton.parentElement);
      }
    }

    if (editAttachmentInput && $DebugTestMode) {
      if ($DebugTestMode) {
        console.log("📎 Edit attachment input element:", editAttachmentInput);
      }
      if ($DebugTestMode) {
        console.log("📎 Input type:", editAttachmentInput.type);
      }
      if ($DebugTestMode) {
        console.log("📎 Input accept:", editAttachmentInput.accept);
      }
      if ($DebugTestMode) {
        console.log("📎 Input multiple:", editAttachmentInput.multiple);
      }
    }

    if (editAttachmentButton && editAttachmentInput) {
      if ($DebugTestMode) {
        if ($DebugTestMode) {
          console.log("📎 Setting up edit attachment event listeners...");
        }
      }

      // Clone elements to prevent event listener conflicts
      const newAttachmentButton = editAttachmentButton.cloneNode(true);
      const newAttachmentInput = editAttachmentInput.cloneNode(true);

      editAttachmentButton.parentNode.replaceChild(
        newAttachmentButton,
        editAttachmentButton
      );
      editAttachmentInput.parentNode.replaceChild(
        newAttachmentInput,
        editAttachmentInput
      );

      if ($DebugTestMode) {
        if ($DebugTestMode) {
          console.log(
            "📎 Cloned and replaced edit attachment elements to prevent conflicts"
          );
        }
      }

      // Get fresh references
      const freshAttachmentButton = document.getElementById(
        `editAttachmentButton_${messageId}`
      );
      const freshAttachmentInput = document.getElementById(
        `editAttachmentInput_${messageId}`
      );

      if ($DebugTestMode) {
        if ($DebugTestMode) {
          console.log("📎 Fresh edit button found:", !!freshAttachmentButton);
        }
        if ($DebugTestMode) {
          console.log("📎 Fresh edit input found:", !!freshAttachmentInput);
        }
      }

      // Button click handler with extensive logging
      freshAttachmentButton.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        if ($DebugTestMode) {
          if ($DebugTestMode) {
            console.log("📎 === EDIT ATTACHMENT BUTTON CLICKED ===");
          }
          if ($DebugTestMode) {
            console.log("📎 Click event:", e);
          }
          if ($DebugTestMode) {
            console.log("📎 Event target:", e.target);
          }
          if ($DebugTestMode) {
            console.log("📎 Button disabled:", freshAttachmentButton.disabled);
          }
          if ($DebugTestMode) {
            console.log("📎 Input element exists:", !!freshAttachmentInput);
          }
          if ($DebugTestMode) {
            console.log(
              "📎 Input value before reset:",
              freshAttachmentInput.value
            );
          }
        }

        // Reset value BEFORE opening dialog
        freshAttachmentInput.value = "";
        if ($DebugTestMode) {
          if ($DebugTestMode) {
            console.log("📎 Reset input value to empty string");
          }
          if ($DebugTestMode) {
            console.log(
              "📎 Input value after reset:",
              freshAttachmentInput.value
            );
          }
        }

        // Small delay ensures value is cleared
        setTimeout(() => {
          if ($DebugTestMode) {
            if ($DebugTestMode) {
              console.log("📎 About to trigger edit file dialog...");
            }
            if ($DebugTestMode) {
              console.log(
                "📎 Input element at trigger time:",
                freshAttachmentInput
              );
            }
          }

          try {
            freshAttachmentInput.click();
            if ($DebugTestMode) {
              if ($DebugTestMode) {
                console.log("📎 ✅ Edit file dialog triggered successfully");
              }
            }
          } catch (error) {
            if ($DebugTestMode) {
              if ($DebugTestMode) {
                console.error("📎 ❌ Error triggering edit file dialog:", error);
              }
            }
          }
        }, 10);
      });

      if ($DebugTestMode) {
        if ($DebugTestMode) {
          console.log("📎 ✅ Edit button click listener attached");
        }
      }

      // File change handler with extensive logging
      freshAttachmentInput.addEventListener("change", (e) => {
        if ($DebugTestMode) {
          if ($DebugTestMode) {
            console.log("📎 === EDIT FILE INPUT CHANGE EVENT ===");
          }
          if ($DebugTestMode) {
            console.log("📎 Change event:", e);
          }
          if ($DebugTestMode) {
            console.log("📎 Event target:", e.target);
          }
          if ($DebugTestMode) {
            console.log("📎 Input files property:", e.target.files);
          }
          if ($DebugTestMode) {
            console.log(
              "📎 Files length:",
              e.target.files ? e.target.files.length : "null"
            );
          }
        }

        e.preventDefault();
        e.stopPropagation();

        const files = e.target.files;

        if (!files) {
          if ($DebugTestMode) {
            if ($DebugTestMode) {
              console.error("📎 ❌ No files property on edit input element");
            }
          }
          return;
        }

        if (files.length === 0) {
          if ($DebugTestMode) {
            if ($DebugTestMode) {
              console.log(
                "📎 ⚠️ No files selected in edit mode (user probably canceled)"
              );
            }
          }
          return;
        }

        if ($DebugTestMode) {
          if ($DebugTestMode) {
            console.log("📎 Files selected in edit mode:", files.length);
          }
        }

        // Log each file
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          if ($DebugTestMode) {
            if ($DebugTestMode) {
              console.log(`📎 File ${i + 1}:`, {
                name: file.name,
                size: file.size,
                type: file.type,
                lastModified: file.lastModified,
              });
            }
          }
        }

        try {
          if ($DebugTestMode) {
            if ($DebugTestMode) {
              console.log(
                "📎 About to call handleFileAttachments for edit mode..."
              );
            }
          }
          this.handleFileAttachments(files);
          if ($DebugTestMode) {
            if ($DebugTestMode) {
              console.log(
                "📎 ✅ handleFileAttachments completed successfully for edit mode"
              );
            }
          }
        } catch (error) {
          if ($DebugTestMode) {
            if ($DebugTestMode) {
              console.error(
                "📎 ❌ Error in handleFileAttachments for edit mode:",
                error
              );
            }
            if ($DebugTestMode) {
              console.error("📎 Error stack:", error.stack);
            }
            this.showErrorNotification(
              "Failed to process selected files: " + error.message
            );
          }
        }
      });

      if ($DebugTestMode) {
        if ($DebugTestMode) {
          console.log("📎 ✅ Edit file change listener attached");
        }
      }
    } else {
      if ($DebugTestMode) {
        if ($DebugTestMode) {
          console.error(
            "📎 ❌ Missing edit attachment button or input elements, or attachments already exist!"
          );
        }
        if (!editAttachmentButton && $DebugTestMode) {
          if ($DebugTestMode) {
            console.error("📎 Missing: editAttachmentButton");
          }
        }
        if (!editAttachmentInput && $DebugTestMode) {
          if ($DebugTestMode) {
            console.error("📎 Missing: editAttachmentInput");
          }
        }
        if (hasAttachments && $DebugTestMode) {
          if ($DebugTestMode) {
            console.error("📎 Attachments disabled due to existing attachments");
          }
        }
      }
    }

    if ($DebugTestMode) {
      if ($DebugTestMode) {
        console.log("📎 === EDIT ATTACHMENT SETUP COMPLETE ===");
      }
    }

    // Set up Context+ toggle for edit mode
    const editContextToggle = document.getElementById(
      `editContextPlusToggle_${messageId}`
    );
    if (editContextToggle) {
      const isContextPlusEnabled =
        document
          .getElementById("contextPlusToggle")
          ?.classList.contains("active") || false;
      if (isContextPlusEnabled) {
        editContextToggle.classList.add("active");
      }

      editContextToggle.addEventListener("click", () => {
        editContextToggle.classList.toggle("active");
      });
    }

    // Initialize AI dropdown for edit mode
    const editAiDropdown = document.getElementById(
      `editAiDropdownContainer_${messageId}`
    );
    const currentModel =
      AI_MODELS.basic
        .concat(AI_MODELS.advanced, AI_MODELS.fast)
        .find(function (m) {
          return m.id === appState.selectedAIModel;
        }) || AI_MODELS.advanced[1];

    editAiDropdown.innerHTML = generateDropdownHTML(currentModel);

    if ($DebugTestMode) {
      console.log("hasAttachments:", hasAttachments);
    }
    if ($DebugTestMode) {
      console.log("historyEntry:", historyEntry);
    }
    if ($DebugTestMode) {
      console.log("historyEntry.files:", historyEntry?.files);
    }

    if (hasAttachments && historyEntry && historyEntry.files) {
      if ($DebugTestMode) {
        console.log(
          `📎 🔧 FETCHING FILES for edit mode, message: ${messageId}, version: ${currentVersion}`
        );
      }

      // Ensure files is always treated as an array
      const filesToProcess = Array.isArray(historyEntry.files)
        ? historyEntry.files
        : [historyEntry.files];

      if ($DebugTestMode) {
        console.log(`📎 🔧 Files to fetch for editing:`, filesToProcess);
      }

      // Process each file
      filesToProcess.forEach(async (fileName, fileIndex) => {
        if ($DebugTestMode) {
          console.log(`📎 🔧 Fetching file ${fileIndex} for edit: ${fileName}`);
        }

        if (typeof fileName === "string") {
          try {
            // Get the file content using getFile
            const fileContent = await historyManager.getFile(
              fileName,
              appState.currentConversationId
            );

            if ($DebugTestMode) {
              console.log(`📎 🔧 File content fetched for ${fileName}:`, {
                hasContent: !!fileContent,
                contentLength: fileContent ? fileContent.length : 0,
              });
            }

            // Add to edit attachments using your existing method
            this.pushToEditAttachments(fileName, fileContent, messageId);

            if ($DebugTestMode) {
              console.log(`📎 ✅ Added ${fileName} to edit attachments`);
            }
          } catch (error) {
            if ($DebugTestMode) {
              console.error(`📎 ❌ Error fetching file ${fileName}:`, error);
            }
          }
        }
      });
    }

    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);

    this.editingMessageId = messageId;
  },

  // ✅ NEW: Set up paste handler specifically for edit textareas
  setupEditPasteHandler: function (textarea, messageId) {
    if ($DebugTestMode) {
      if ($DebugTestMode) {
        console.log("📝 Setting up paste handler for edit textarea:", messageId);
      }
    }

    textarea.addEventListener("paste", (e) => {
      if ($DebugTestMode) {
        if ($DebugTestMode) {
          console.log("📝 📋 Paste event in edit mode for:", messageId);
        }
      }

      // Use the same paste handling logic as the main chat input
      const clipboardData = e.clipboardData || window.clipboardData;
      if (!clipboardData) return;

      const pastedText = clipboardData.getData("text");
      const currentTime = Date.now();

      if ($DebugTestMode) {
        if ($DebugTestMode) {
          console.log("📝 📋 Pasted text length:", pastedText.length);
        }
      }

      // Simple large content check (use hardcoded threshold instead of chatInputManager)
      const maxDirectInput = 5000; // 5000 characters threshold

      if (pastedText.length > maxDirectInput) {
        if ($DebugTestMode) {
          if ($DebugTestMode) {
            console.log(
              "📝 📋 🚨 LARGE CONTENT DETECTED in edit mode - Preventing default paste"
            );
          }
        }
        e.preventDefault();

        // Create a large content attachment specifically for edit mode
        this.handleLargeContentInEdit(pastedText, messageId);
        return;
      }

      if ($DebugTestMode) {
        if ($DebugTestMode) {
          console.log(
            "📝 📋 Normal paste in edit mode - allowing default behavior"
          );
        }
      }
    });
  },

  handleLargeContentInEdit: function (content, messageId) {
    if ($DebugTestMode) {
      console.log(
        "📝 📄 Processing large content in edit mode:",
        content.length,
        "characters"
      );
    }
    if ($DebugTestMode) {
      console.log("📝 📄 Target message ID:", messageId);
    }

    // Generate unique ID for this attachment
    const attachmentId = `edit_large_content_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    if ($DebugTestMode) {
      console.log("📝 📄 Generated attachment ID:", attachmentId);
    }

    // Simple content type detection
    const detectContentType = (content) => {
      if (content.includes("function") && content.includes("{"))
        return "javascript";
      if (content.includes("<html") || content.includes("<!DOCTYPE"))
        return "html";
      if (content.includes("import") || content.includes("export"))
        return "javascript";
      return "text";
    };

    const contentType = detectContentType(content);
    const filename = contentManager.generateSmartFilename(content, contentType);

    // Create properly structured attachment object
    const attachment = {
      id: attachmentId,
      type: "large_content",
      filename: filename,
      content: content,
      contentType: contentType,
      size: content.length,
      word_count: content.split(/\s+/).filter((w) => w.length > 0).length,
      line_count: content.split("\n").length,
      extension: contentType === "javascript" ? ".js" : ".txt",
      created_at: new Date().toISOString(),
      timestamp: Date.now(),
      is_complete: true,
      is_chunked: false,
      chunk_count: 1,
      total_size: content.length,
      editModeId: messageId,
    };

    if ($DebugTestMode) {
      console.log("📝 📄 Created attachment object:", attachment);
    }

    // Add directly to the correct container
    try {
      this.addAttachmentToContainer(attachment, messageId);
      if ($DebugTestMode) {
        console.log("📝 📄 ✅ Attachment added to container successfully");
      }
    } catch (error) {
      if ($DebugTestMode) {
        console.error("📝 📄 ❌ Error adding attachment to container:", error);
      }
      return;
    }

    this.pushToEditAttachments(attachmentId, content, messageId);

    // Update input placeholder
    this.updateInputPlaceholder(messageId);

    // Show feedback to user
    const textarea = document.getElementById(`edit_${messageId}`);
    if (textarea) {
      const originalPlaceholder = textarea.placeholder;
      textarea.placeholder = `Large content (${content.length} chars) attached as ${filename}`;

      setTimeout(() => {
        textarea.placeholder = originalPlaceholder;
      }, 3000);
    }

    if ($DebugTestMode) {
      console.log("📝 📄 ✅ Large content attachment created for edit mode");
    }
  },

  handleFileAttachments: function (files) {
    if ($DebugTestMode) {
      if ($DebugTestMode) {
        console.log("📎 === HANDLING FILE ATTACHMENTS ===");
      }
      if ($DebugTestMode) {
        console.log("📎 Function called with files:", files);
      }
      if ($DebugTestMode) {
        console.log(
          "📎 Files is array-like:",
          Array.isArray(files) || (files && typeof files.length === "number")
        );
      }
      if ($DebugTestMode) {
        console.log("📎 Files length:", files ? files.length : "null");
      }
      if ($DebugTestMode) {
        console.log("📎 Current attachments array:", this.attachments);
      }
      if ($DebugTestMode) {
        console.log("📎 Current attachment counter:", this.attachmentCounter);
      }
    }

    if (!files || files.length === 0) {
      if ($DebugTestMode) {
        if ($DebugTestMode) {
          console.warn("📎 ⚠️ No files provided to handleFileAttachments");
        }
      }
      return;
    }

    // Initialize attachments array if needed
    if (!this.attachments) {
      if ($DebugTestMode) {
        if ($DebugTestMode) {
          console.log("📎 Initializing attachments array");
        }
      }
      this.attachments = [];
    }

    // Show processing feedback
    const attachmentButton = document.getElementById("attachmentButton");
    if (attachmentButton) {
      const originalText = attachmentButton.innerHTML;
      attachmentButton.innerHTML = "📎 Processing...";
      attachmentButton.disabled = true;
      if ($DebugTestMode) {
        if ($DebugTestMode) {
          console.log("📎 Set button to processing state");
        }
      }

      setTimeout(() => {
        attachmentButton.innerHTML = originalText;
        attachmentButton.disabled = false;
        if ($DebugTestMode) {
          if ($DebugTestMode) {
            console.log("📎 Reset button to normal state");
          }
        }
      }, 3000);
    }

    if ($DebugTestMode) {
      if ($DebugTestMode) {
        console.log("📎 Processing", files.length, "files...");
      }
    }

    // Process each file
    Array.from(files).forEach((file, index) => {
      if ($DebugTestMode) {
        if ($DebugTestMode) {
          console.log(`📎 === PROCESSING FILE ${index + 1}/${files.length} ===`);
        }
        if ($DebugTestMode) {
          console.log(`📎 File name: ${file.name}`);
        }
        if ($DebugTestMode) {
          console.log(`📎 File size: ${file.size} bytes`);
        }
        if ($DebugTestMode) {
          console.log(`📎 File type: ${file.type}`);
        }
      }

      // Generate unique ID
      const attachmentId = `file_${++this
        .attachmentCounter}_${Date.now()}_${index}`;
      if ($DebugTestMode) {
        if ($DebugTestMode) {
          console.log(`📎 Generated attachment ID: ${attachmentId}`);
        }
      }

      try {
        if (this.isImageFile(file)) {
          if ($DebugTestMode) {
            if ($DebugTestMode) {
              console.log(`📎 File ${index + 1} identified as IMAGE`);
            }
          }
          this.processImageFile(file, attachmentId);
        } else if (this.isTextFile(file)) {
          if ($DebugTestMode) {
            if ($DebugTestMode) {
              console.log(`📎 File ${index + 1} identified as TEXT`);
            }
          }
          this.processTextFile(file, attachmentId);
        } else {
          if ($DebugTestMode) {
            if ($DebugTestMode) {
              console.log(`📎 File ${index + 1} identified as GENERIC`);
            }
          }
          this.processGenericFile(file, attachmentId);
        }
      } catch (error) {
        if ($DebugTestMode) {
          if ($DebugTestMode) {
            console.error(`📎 ❌ Error processing file ${file.name}:`, error);
          }
          if ($DebugTestMode) {
            console.error(`📎 Error stack:`, error.stack);
          }
          this.showErrorNotification(
            `Failed to process ${file.name}: ${error.message}`
          );
        }
      }
    });

    if ($DebugTestMode) {
      if ($DebugTestMode) {
        console.log("📎 === FILE PROCESSING COMPLETE ===");
      }
      if ($DebugTestMode) {
        console.log(
          "📎 Total attachments now:",
          this.attachments ? this.attachments.length : 0
        );
      }
    }
  },

  processGenericFile: function (file, attachmentId) {
    if ($DebugTestMode) {
      if ($DebugTestMode) {
        console.log(`📎 === PROCESSING GENERIC FILE ===`);
      }
      if ($DebugTestMode) {
        console.log(`📎 File: ${file.name}, ID: ${attachmentId}`);
      }
    }

    // Check if this is a text-readable file that we should try to read as content
    if (this.shouldReadAsText(file)) {
      if ($DebugTestMode) {
        if ($DebugTestMode) {
          console.log(
            `📎 Generic file appears to be text-readable, processing as text...`
          );
        }
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
        if ($DebugTestMode) {
          console.log(`📎 Created generic attachment:`, attachment);
        }
      }
      this.addProcessedAttachment(attachment);
    } catch (error) {
      if ($DebugTestMode) {
        if ($DebugTestMode) {
          console.error(`📎 ❌ Error creating generic attachment:`, error);
        }
      }
      this.showErrorNotification(`Failed to process file ${file.name}`);
    }
  },

  processTextFile: function (file, attachmentId) {
    if ($DebugTestMode) {
      if ($DebugTestMode) {
        console.log(`📄 === PROCESSING TEXT FILE ===`);
      }
      if ($DebugTestMode) {
        console.log(`📄 File: ${file.name}, ID: ${attachmentId}`);
      }
    }

    const reader = new FileReader();

    reader.onload = (e) => {
      if ($DebugTestMode) {
        if ($DebugTestMode) {
          console.log(`📄 FileReader onload triggered for ${file.name}`);
        }
        if ($DebugTestMode) {
          console.log(`📄 Result type:`, typeof e.target.result);
        }
        if ($DebugTestMode) {
          console.log(
            `📄 Content length:`,
            e.target.result ? e.target.result.length : 0
          );
        }
      }

      try {
        const content = e.target.result;
        if ($DebugTestMode) {
          if ($DebugTestMode) {
            console.log(`📄 Content preview:`, content.substring(0, 200) + "...");
          }
        }

        if (content.length > this.maxDirectInput) {
          if ($DebugTestMode) {
            if ($DebugTestMode) {
              console.log(
                `📄 Large content detected (${content.length} > ${this.maxDirectInput}), creating large content attachment`
              );
            }
          }
          this.handleLargeContentFromFile(file, content, attachmentId);
        } else {
          if ($DebugTestMode) {
            if ($DebugTestMode) {
              console.log(
                `📄 Normal sized content, creating regular file attachment`
              );
            }
          }
          this.createRegularFileAttachment(file, content, attachmentId);
        }
      } catch (error) {
        if ($DebugTestMode) {
          if ($DebugTestMode) {
            console.error(`📄 ❌ Error processing text content:`, error);
          }
        }
        this.showErrorNotification(`Failed to process text file ${file.name}`);
      }
    };

    reader.onerror = (e) => {
      if ($DebugTestMode) {
        if ($DebugTestMode) {
          console.error(`📄 ❌ FileReader error for ${file.name}:`, e);
        }
      }
      this.showErrorNotification(`Failed to read file ${file.name}`);
    };

    if ($DebugTestMode) {
      if ($DebugTestMode) {
        console.log(`📄 Starting to read file as text...`);
      }
    }
    reader.readAsText(file);
  },

  processImageFile: function (file, attachmentId) {
    if ($DebugTestMode) {
      if ($DebugTestMode) {
        console.log(`🖼️ === PROCESSING IMAGE FILE ===`);
      }
      if ($DebugTestMode) {
        console.log(`🖼️ File: ${file.name}, ID: ${attachmentId}`);
      }
    }

    const reader = new FileReader();

    reader.onload = (e) => {
      if ($DebugTestMode) {
        if ($DebugTestMode) {
          console.log(`🖼️ FileReader onload triggered for ${file.name}`);
        }
        if ($DebugTestMode) {
          console.log(`🖼️ Result type:`, typeof e.target.result);
        }
        if ($DebugTestMode) {
          console.log(
            `🖼️ Result length:`,
            e.target.result ? e.target.result.length : 0
          );
        }
      }

      try {
        const imageData = e.target.result;

        // Convert to base64 if needed
        let base64Data = imageData;
        if (imageData.startsWith("data:")) {
          base64Data = imageData.split(",")[1];
        }

        if ($DebugTestMode) {
          if ($DebugTestMode) {
            console.log(`🖼️ Base64 data length:`, base64Data.length);
          }
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
          if ($DebugTestMode) {
            console.log(`🖼️ Created image attachment:`, attachment);
          }
        }
        this.addProcessedAttachment(attachment);
      } catch (error) {
        if ($DebugTestMode) {
          if ($DebugTestMode) {
            console.error(`🖼️ ❌ Error creating image attachment:`, error);
          }
        }
        this.showErrorNotification(`Failed to process image ${file.name}`);
      }
    };

    reader.onerror = (e) => {
      if ($DebugTestMode) {
        if ($DebugTestMode) {
          console.error(`🖼️ ❌ FileReader error for ${file.name}:`, e);
        }
      }
      this.showErrorNotification(`Failed to read image ${file.name}`);
    };

    if ($DebugTestMode) {
      if ($DebugTestMode) {
        console.log(`🖼️ Starting to read file as data URL...`);
      }
    }
    reader.readAsDataURL(file);
  },

  addProcessedAttachment: function (attachment) {
    if ($DebugTestMode) {
      if ($DebugTestMode) {
        console.log("📎 === ADDING PROCESSED ATTACHMENT ===");
      }
      if ($DebugTestMode) {
        console.log("📎 Attachment to add:", attachment);
      }
      if ($DebugTestMode) {
        console.log("📎 Current attachments array before:", this.attachments);
      }
    }

    if (!this.attachments) {
      if ($DebugTestMode) {
        if ($DebugTestMode) {
          console.log("📎 Creating new attachments array");
        }
      }
      this.attachments = [];
    }

    this.attachments.push(attachment);
    if ($DebugTestMode) {
      if ($DebugTestMode) {
        console.log("📎 Attachment added to array");
      }
      if ($DebugTestMode) {
        console.log("📎 New attachments array:", this.attachments);
      }
      if ($DebugTestMode) {
        console.log("📎 Total attachments:", this.attachments.length);
      }
    }

    if ($DebugTestMode) {
      if ($DebugTestMode) {
        console.log("📎 Calling updateAttachmentContainer...");
      }
    }
    this.updateAttachmentContainer();

    if ($DebugTestMode) {
      if ($DebugTestMode) {
        console.log("📎 Calling addAttachmentToContainer...");
      }
    }
    this.addAttachmentToContainer(attachment);

    if ($DebugTestMode) {
      if ($DebugTestMode) {
        console.log("📎 Calling updateInputPlaceholder...");
      }
    }
    this.updateInputPlaceholder();

    // Ensure container is visible when attachment is added
    const container = document.getElementById("attachmentPreviews");
    if (container) {
      container.style.display = "flex";
    }

    if ($DebugTestMode) {
      if ($DebugTestMode) {
        console.log("📎 === ATTACHMENT PROCESSING COMPLETE ===");
      }
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
    const contentType = this.detectContentType(content);
    const language = this.detectLanguageFromContent
      ? this.detectLanguageFromContent(content)
      : contentType;

    const attachment = {
      id: attachmentId,
      type: "large_content",
      filename: file.name,
      content: content,
      contentType: contentType,
      language: language,
      size: content.length,
      word_count: content.split(/\s+/).filter((w) => w.length > 0).length,
      line_count: content.split("\n").length,
      extension: this.getFileExtension(file.name),
      created_at: new Date().toISOString(),
      timestamp: Date.now(),
      originalFile: file,
    };

    this.addProcessedAttachment(attachment);
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
    ];

    const textExtensions = [
      ".txt",
      ".js",
      ".html",
      ".css",
      ".py",
      ".java",
      ".cpp",
      ".c",
      ".h",
      ".json",
      ".xml",
      ".yaml",
      ".yml",
      ".md",
      ".csv",
      ".sql",
      ".sh",
      ".bat",
    ];

    return (
      textTypes.some((type) => file.type.startsWith(type)) ||
      textExtensions.some((ext) => file.name.toLowerCase().endsWith(ext))
    );
  },

  isImageFile: function (file) {
    return file.type.startsWith("image/");
  },

  // FIXED: Enhanced addRedXToAttachments function with proper context and message ID detection
  addRedXToAttachments: function (messageId = null) {
    if ($DebugTestMode) {
      if ($DebugTestMode) {
        console.log("🔴 === ADDING RED X TO ATTACHMENTS ===");
      }
      if ($DebugTestMode) {
        console.log("🔴 Message ID context:", messageId);
      }
    }

    // If messageId is provided, scope the search to that message's edit container
    let searchContext = document;
    if (messageId) {
      const currentVersion = this.getDataVersion(messageId);

      const messageEl = document.querySelector(
        `[data-message-id="${messageId}"][data-version="${currentVersion}"]`
      );
      if (messageEl) {
        searchContext = messageEl;
        if ($DebugTestMode) {
          if ($DebugTestMode) {
            console.log("🔴 Using message element as search context:", messageEl);
          }
        }
      }
    }

    const attachmentPreviews = searchContext.querySelector(
      ".attachment-previews"
    );
    if (!attachmentPreviews) {
      if ($DebugTestMode) {
        if ($DebugTestMode) {
          console.log("🔴 No attachment-previews container found in context");
        }
      }
      return;
    }

    const attachmentItems =
      attachmentPreviews.querySelectorAll(".attachment-item");

    if ($DebugTestMode) {
      if ($DebugTestMode) {
        console.log("🔴 Found attachment items:", attachmentItems.length);
      }
    }

    attachmentItems.forEach((item, index) => {
      if ($DebugTestMode) {
        if ($DebugTestMode) {
          console.log(`🔴 Processing attachment item ${index + 1}:`, item);
        }
        if ($DebugTestMode) {
          console.log(`🔴 Item ID:`, item.id);
        }
        if ($DebugTestMode) {
          console.log(
            `🔴 Item data-attachment-id:`,
            item.getAttribute("data-attachment-id")
          );
        }
      }

      // Check if red X already exists to avoid duplicates
      if (item.querySelector(".remove-attachment")) {
        if ($DebugTestMode) {
          if ($DebugTestMode) {
            console.log(
              `🔴 Item ${index + 1} already has remove button, skipping`
            );
          }
        }
        return;
      }

      // Get attachment ID from the item
      const attachmentId = item.getAttribute("data-attachment-id");
      if (!attachmentId) {
        if ($DebugTestMode) {
          if ($DebugTestMode) {
            console.error(`🔴 ❌ No attachment ID found for item ${index + 1}`);
          }
        }
        return;
      }

      // FIXED: Determine the actual message ID for this attachment
      let targetMessageId = messageId;
      if (!targetMessageId) {
        // Try to find the message ID from the DOM hierarchy
        const messageElement = item.closest(".message");
        if (messageElement && messageElement.id) {
          targetMessageId = messageElement.id;
        } else if (this.editingMessageId) {
          targetMessageId = this.editingMessageId;
        }
      }

      if ($DebugTestMode) {
        if ($DebugTestMode) {
          console.log(
            `🔴 Target message ID for attachment ${attachmentId}:`,
            targetMessageId
          );
        }
      }

      // Create the red X button
      const removeBtn = document.createElement("button");
      removeBtn.className = "remove-attachment";
      removeBtn.innerHTML = "✕";
      removeBtn.title = "Remove attachment";

      // FIXED: Proper event handler with explicit context and message ID
      const self = this; // Capture the correct context
      removeBtn.addEventListener("click", function (e) {
        if ($DebugTestMode) {
          if ($DebugTestMode) {
            console.log(
              `🔴 Remove button clicked for attachment: ${attachmentId}`
            );
          }
          if ($DebugTestMode) {
            console.log(`🔴 Target message ID: ${targetMessageId}`);
          }
        }
        e.preventDefault();
        e.stopPropagation();

        // Call removal with explicit context and both IDs
        self.removeAttachment(attachmentId, targetMessageId);
      });

      // Make sure the item has relative positioning
      if (getComputedStyle(item).position === "static") {
        item.style.position = "relative";
        if ($DebugTestMode) {
          if ($DebugTestMode) {
            console.log(`🔴 Set item ${index + 1} position to relative`);
          }
        }
      }

      // Add the button to the item
      item.appendChild(removeBtn);

      if ($DebugTestMode) {
        if ($DebugTestMode) {
          console.log(`🔴 ✅ Remove button added to item ${index + 1}`);
        }
      }
    });

    if ($DebugTestMode) {
      if ($DebugTestMode) {
        console.log("🔴 === RED X ADDITION COMPLETE ===");
      }
    }
  },

  removeRedXFromAttachments: function (messageId = null) {
    // Scope to specific message if messageId provided
    let searchContext = document;
    if (messageId) {
      const currentVersion = this.getDataVersion(messageId);

      const messageEl = document.querySelector(
        `[data-message-id="${messageId}"][data-version="${currentVersion}"]`
      );
      if (messageEl) {
        searchContext = messageEl; // Only search within this message
      }
    }

    // Remove red X buttons only from the scoped context
    const removeButtonsBtn = searchContext.querySelectorAll(
      ".remove-attachment-btn"
    );
    const removeButtons = searchContext.querySelectorAll(".remove-attachment");

    removeButtonsBtn.forEach((btn) => btn.remove());
    removeButtons.forEach((btn) => btn.remove());
  },

  cancelEdit: function (messageId) {
    if ($DebugTestMode) {
      console.log("🔍 cancelEdit called for messageId:", messageId);
    }

    // Find all message elements with this messageId that have a data-version attribute
    const messageElements = document.querySelectorAll(
      `[data-message-id="${messageId}"][data-version]`
    );

    if (messageElements.length === 0) {
      if ($DebugTestMode) {
        console.log("❌ No message elements found for ID:", messageId);
      }
      return;
    }

    if ($DebugTestMode) {
      console.log(
        `📋 Found ${messageElements.length} message element(s) to cancel edit for`
      );
    }

    // Process each message element
    messageElements.forEach((messageEl, index) => {
      if ($DebugTestMode) {
        console.log(
          `🔄 Processing element ${index + 1}/${
            messageElements.length
          } (version: ${messageEl.dataset.version})`
        );
      }

      // ✅ FIRST: Clean up edit-specific attachments BEFORE restoring originals
      if ($DebugTestMode) {
        console.log("🧹 Cleaning up edit-specific attachments FIRST");
      }
      this.cleanupEditAttachments(messageId);

      const contentEl = messageEl.querySelector(".message-content");
      const footerEl = messageEl.querySelector(".message-footer");

      const originalContent = messageEl.dataset.originalContent;
      const originalFooter = messageEl.dataset.originalFooter;
      const originalAttachments = messageEl.dataset.originalAttachments;
      const hadAttachments = messageEl.dataset.hadAttachments === "true";

      if ($DebugTestMode) {
        console.log("📊 Dataset values:");
      }
      if ($DebugTestMode) {
        console.log("  - originalContent exists:", !!originalContent);
      }
      if ($DebugTestMode) {
        console.log("  - originalFooter exists:", !!originalFooter);
      }
      if ($DebugTestMode) {
        console.log("  - originalAttachments exists:", !!originalAttachments);
      }
      if ($DebugTestMode) {
        console.log("  - hadAttachments:", hadAttachments);
      }

      // Restore content
      if (contentEl && originalContent) {
        if ($DebugTestMode) {
          console.log("🔄 Restoring original content");
        }
        contentEl.innerHTML = originalContent;
        delete messageEl.dataset.originalContent;
      }

      // Restore footer
      if (footerEl && originalFooter) {
        if ($DebugTestMode) {
          console.log("🔄 Restoring original footer");
        }
        footerEl.innerHTML = originalFooter;
        footerEl.style.display = "flex";
        delete messageEl.dataset.originalFooter;

        // Ensure edit button is enabled
        const editButton = footerEl.querySelector(".message-edit-btn");
        if (editButton) {
          if ($DebugTestMode) {
            console.log("✅ Edit button found and restored");
          }
          editButton.style.display = "";
          editButton.disabled = false;
        }
      }

      // ✅ RESTORE ORIGINAL ATTACHMENTS (after cleanup)
      if (hadAttachments && originalAttachments) {
        if ($DebugTestMode) {
          console.log("🔄 Restoring original attachments");
        }
        if ($DebugTestMode) {
          console.log("📎 Original attachments HTML:", originalAttachments);
        }

        // Check if an attachment container already exists
        let existingContainer = messageEl.querySelector(".attachment-previews");

        // Create temp container to parse HTML
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = originalAttachments;
        const restoredContainer = tempDiv.querySelector(".attachment-previews");

        if (restoredContainer) {
          if (existingContainer) {
            // Replace content of existing container instead of creating new one
            existingContainer.innerHTML = restoredContainer.innerHTML;
            existingContainer.style.display = "flex";
            if ($DebugTestMode) {
              console.log("✅ Replaced content of existing attachment container");
            }
          } else {
            // Insert the restored container only if none exists
            const messageWrapper = messageEl.querySelector(".message-wrapper");
            if (messageWrapper) {
              messageEl.insertBefore(restoredContainer, messageWrapper);
            } else {
              messageEl.insertBefore(restoredContainer, messageEl.firstChild);
            }
            restoredContainer.style.display = "flex";
            if ($DebugTestMode) {
              console.log(
                "✅ Created new attachment container with original content"
              );
            }
          }
        }
      }

      // Clean up dataset
      if ($DebugTestMode) {
        console.log("🧹 Cleaning up dataset attributes");
      }
      delete messageEl.dataset.originalAttachments;
      delete messageEl.dataset.hadAttachments;

      // Final cleanup of any remaining red X buttons for this specific element
      if ($DebugTestMode) {
        console.log("🧹 Calling removeRedXFromAttachments");
      }
      this.removeRedXFromAttachments(messageId);

      // Final verification
      const finalContainer = messageEl.querySelector(".attachment-previews");
      if ($DebugTestMode) {
        console.log("🏁 Final state - attachment container:", finalContainer);
      }
      if (finalContainer && $DebugTestMode) {
        if ($DebugTestMode) {
          console.log("🏁 Final container HTML:", finalContainer.outerHTML);
        }
        if ($DebugTestMode) {
          console.log(
            "🏁 Final container children count:",
            finalContainer.children.length
          );
        }
      }
    });

    // Clear editing state (only once, outside the loop)
    if (this.editingMessageId === messageId) {
      if ($DebugTestMode) {
        console.log("🔄 Clearing editingMessageId");
      }
      this.editingMessageId = null;
    }

    if ($DebugTestMode) {
      console.log("✅ cancelEdit completed for messageId:", messageId);
    }
  },

  cleanupEditAttachments: function (messageId) {
    if ($DebugTestMode) {
      console.log("🧹 Cleaning up edit attachments for:", messageId);
    }

    const currentVersion = this.getDataVersion(messageId);

    const messageEl = document.querySelector(
      `[data-message-id="${messageId}"][data-version="${currentVersion}"]`
    );

    if (!messageEl) {
      if ($DebugTestMode) {
        console.warn("🧹 Message element not found for cleanup");
      }
      return;
    }

    // Find the attachment container within this message
    const container = messageEl.querySelector(".attachment-previews");
    if (!container) {
      if ($DebugTestMode) {
        console.log("🧹 No attachment container found");
      }
      return;
    }

    // ✅ FIX: Only remove edit-specific attachments, not restored originals
    // Look for attachments with edit-specific IDs (contain "edit_" prefix)
    const editAttachments = container.querySelectorAll(
      '.attachment-item[data-attachment-id^="edit_"]'
    );

    if ($DebugTestMode) {
      console.log(
        `🧹 Found ${editAttachments.length} edit-specific attachments to remove`
      );
    }

    let removedCount = 0;
    editAttachments.forEach((item) => {
      const attachmentId = item.getAttribute("data-attachment-id");
      if ($DebugTestMode) {
        console.log(`🧹 Removing edit attachment: ${attachmentId}`);
      }
      item.remove();
      removedCount++;
    });

    // Only hide container if NO attachments remain (including restored ones)
    const remainingAttachments = container.querySelectorAll(".attachment-item");
    if (remainingAttachments.length === 0) {
      container.style.display = "none";
      if ($DebugTestMode) {
        console.log("🧹 Container hidden - no attachments remaining");
      }
    } else {
      container.style.display = "flex";
      if ($DebugTestMode) {
        console.log(
          `🧹 Container visible - ${remainingAttachments.length} attachments remaining`
        );
      }
    }

    if (removedCount > 0 && $DebugTestMode) {
      console.log(
        `🧹 Removed ${removedCount} edit-specific attachments from DOM`
      );
    }
  },

  saveEdit: function (messageId) {
    if ($DebugTestMode) {
      console.log("💾 === SAVE EDIT DEBUG WITH EXTENSIVE LOGGING ===");
    }
    if ($DebugTestMode) {
      console.log("💾 🎯 ENTRY POINT - Message ID:", messageId);
    }
    if ($DebugTestMode) {
      console.log("💾 🎯 Current timestamp:", new Date().toISOString());
    }
    if ($DebugTestMode) {
      console.log("💾 🎯 Function call stack trace:");
    }
    if ($DebugTestMode) {
      console.trace();
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
        const newChatButton = document.querySelector(".new-chat-button"); // Make sure to define this
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

    // STEP 1: Validate textarea exists
    if ($DebugTestMode) {
      console.log("💾 🔍 STEP 1: Validating textarea existence");
    }
    const textarea = document.getElementById(`edit_${messageId}`);
    if ($DebugTestMode) {
      console.log("💾 🔍 Textarea element:", textarea);
    }
    if ($DebugTestMode) {
      console.log("💾 🔍 Textarea value:", textarea?.value);
    }
    if ($DebugTestMode) {
      console.log("💾 🔍 Textarea parent:", textarea?.parentElement);
    }

    if (!textarea) {
      if ($DebugTestMode) {
        console.error("💾 ❌ CRITICAL ERROR: Textarea not found");
      }
      if ($DebugTestMode) {
        console.error("💾 ❌ Expected ID:", `edit_${messageId}`);
      }
      if ($DebugTestMode) {
        console.error(
          "💾 ❌ All elements with 'edit_' prefix:",
          Array.from(document.querySelectorAll('[id^="edit_"]')).map(
            (el) => el.id
          )
        );
      }
      return;
    }

    // STEP 2: Get and validate edited text
    if ($DebugTestMode) {
      console.log("💾 📝 STEP 2: Getting edited text");
    }
    const newText = textarea.value.trim();
    if ($DebugTestMode) {
      console.log("💾 📝 Raw textarea value:", JSON.stringify(textarea.value));
    }
    if ($DebugTestMode) {
      console.log("💾 📝 Trimmed text:", JSON.stringify(newText));
    }
    if ($DebugTestMode) {
      console.log("💾 📝 Text length:", newText.length);
    }
    if ($DebugTestMode) {
      console.log("💾 📝 Text is empty:", !newText);
    }

    if (!newText) {
      if ($DebugTestMode) {
        console.log("💾 ⚠️ EARLY EXIT: Empty text, canceling edit");
      }
      if ($DebugTestMode) {
        console.log("💾 ⚠️ Calling cancelEdit...");
      }
      this.cancelEdit(messageId);
      return;
    }

    // STEP 3: Pre-check authentication
    if ($DebugTestMode) {
      console.log("💾 🔐 STEP 3: Authentication check");
    }
    const authResult = authManager.checkAuthFromStorage();
    if ($DebugTestMode) {
      console.log("💾 🔐 Auth result:", authResult);
    }
    if ($DebugTestMode) {
      console.log("💾 🔐 Auth manager state:", {
        isAuthenticated: authResult,
        token: localStorage.getItem(CONFIG.STORAGE_KEYS.TOKEN)
          ? "EXISTS"
          : "MISSING",
      });
    }

    if (!authResult) {
      if ($DebugTestMode) {
        console.error("💾 ❌ AUTH FAILURE: Not authenticated, cannot save edit");
      }
      if ($DebugTestMode) {
        console.error("💾 ❌ Calling cancelEdit and handleSignIn...");
      }
      this.cancelEdit(messageId);
      handleSignIn();
      return;
    }

    // STEP 4: Get message version and metadata from HTML
    if ($DebugTestMode) {
      console.log("💾 🔍