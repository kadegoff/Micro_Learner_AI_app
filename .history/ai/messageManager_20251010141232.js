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
      console.log(
        "🏗️ Message HTML before innerHTML inserted",
        message.outerHTML
      );
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
        console.log(
          `[History] Converted files to string: ${historyEntry.files}`
        );
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
          console.log(
            "🎨 🤖 Extracting file extension from filename:",
            fileName
          );
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
          console.error(
            `🎨 🤖 ❌ Error processing AI file ${index + 1}:`,
            error
          );
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
      console.log(
        "🔢   - Total message versions found:",
        messageVersions.length
      );
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
      console.log(
        "🔢 🎯 HTML starts with div:",
        htmlTrimmed.startsWith("<div")
      );
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
                console.error(
                  "📎 ❌ Error triggering edit file dialog:",
                  error
                );
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
            console.error(
              "📎 Attachments disabled due to existing attachments"
            );
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
        console.log(
          "📝 Setting up paste handler for edit textarea:",
          messageId
        );
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
          console.log(
            `📎 === PROCESSING FILE ${index + 1}/${files.length} ===`
          );
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
            console.log(
              `📄 Content preview:`,
              content.substring(0, 200) + "..."
            );
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
            console.log(
              "🔴 Using message element as search context:",
              messageEl
            );
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
              console.log(
                "✅ Replaced content of existing attachment container"
              );
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
        console.error(
          "💾 ❌ AUTH FAILURE: Not authenticated, cannot save edit"
        );
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
      console.log(
        "💾 🔍 STEP 4: Getting message version and metadata from HTML"
      );
    }
    const messageEl = document.querySelector(
      `[data-message-id="${messageId}"]`
    );
    if ($DebugTestMode) {
      console.log("💾 🔍 Message element:", messageEl);
    }

    if (!messageEl) {
      if ($DebugTestMode) {
        console.error("💾 ❌ CRITICAL ERROR: Message element not found");
        console.error(
          "💾 ❌ Expected selector:",
          `[data-message-id="${messageId}"]`
        );
      }
      return;
    }

    const messageElements = document.querySelectorAll(
      `[data-message-id="${messageId}"][data-version]`
    );
    if ($DebugTestMode) {
      console.log("💾 🔍 Found message versions:", messageElements.length);
    }

    const newVersion = messageElements.length + 1;
    const pastVersion = this.getDataVersion(messageId);
    const originalContent =
      messageEl.getAttribute("data-original-content") || "";
    if ($DebugTestMode) {
      console.log("💾 🔍 Past version:", pastVersion);
      console.log("💾 🔍 New version will be:", newVersion);
      console.log("💾 🔍 Original content:", originalContent.substring(0, 100));
    }

    // STEP 5: Process attachments from this.editAttachments
    if ($DebugTestMode) {
      console.log(
        "💾 📎 STEP 5: Processing attachments from this.editAttachments"
      );
    }
    let newVersionFiles = [];
    if (this.editAttachments) {
      newVersionFiles = this.editAttachments
        .filter((att) => att.messageId === messageId)
        .map((att, index) => {
          if ($DebugTestMode) {
            console.log(`💾 📎 Processing attachment ${index + 1}:`, {
              id: att.id,
              filename: att.filename,
              contentLength: att.content?.length,
              contentSample: att.content?.substring(0, 200),
            });
          }

          const attachmentData = {
            id: att.id,
            filename: att.filename || `attachment_${att.id}.txt`,
            content: att.content || "",
            type: "large_content",
            size: att.content?.length || 0,
            line_count: att.content ? att.content.split("\n").length : 0,
            created_at: att.created_at || new Date().toISOString(),
            language: att.language || "javascript",
            mime_type: att.mime_type || "text/plain",
            word_count: att.content ? att.content.split(/\s+/).length : 0,
            is_executable: att.is_executable || false,
          };

          if ($DebugTestMode) {
            console.log(`💾 📎 Created attachment data:`, {
              id: attachmentData.id,
              filename: attachmentData.filename,
              contentLength: attachmentData.content.length,
              contentSample: attachmentData.content.substring(0, 200),
            });
          }

          return JSON.parse(JSON.stringify(attachmentData));
        });

      if ($DebugTestMode) {
        console.log("💾 📎 Final newVersionFiles array:", newVersionFiles);
        console.log(
          "💾 📎 newVersionFiles content lengths:",
          newVersionFiles.map((file) => ({
            id: file.id,
            filename: file.filename,
            contentLength: file.content?.length,
            contentSample: file.content?.substring(0, 200),
          }))
        );
      }

      // Clear attachments for this messageId
      this.editAttachments = this.editAttachments.filter(
        (att) => att.messageId !== messageId
      );
      if ($DebugTestMode) {
        console.log("💾 📎 Cleared editAttachments for messageId:", messageId);
        console.log(
          "💾 📎 Remaining editAttachments count:",
          this.editAttachments.length
        );
      }
    }

    // STEP 7: Hide responses for the displayed version
    if ($DebugTestMode) {
      console.log("💾 🙈 STEP 7: Hiding responses for displayed version");
    }
    try {
      this.hideResponsesForVersion(messageId, pastVersion);
      if ($DebugTestMode) {
        console.log("💾 🙈 ✅ Successfully hid responses");
      }
    } catch (error) {
      if ($DebugTestMode) {
        console.error("💾 🙈 ❌ Error hiding responses:", error);
      }
    }

    // STEP 8: Create new version entry
    if ($DebugTestMode) {
      console.log("💾 🔄 STEP 8: Creating new version entry");
      console.log(
        `💾 🔄 Creating version ${newVersion} while preserving version ${pastVersion}`
      );
    }

    const newVersionHistoryEntry = {
      id: messageId,
      text: newText,
      type: "user",
      messageType: "text",
      model: appState.selectedAIModel || "deepseek-chat",
      timestamp: new Date().toISOString(),
      lastEditedAt: new Date().toISOString(),
      files: newVersionFiles,
      version: newVersion,
      conversation_id: appState.currentConversationId || null,
      parent_message_id: null,
      isEditedVersion: true,
      originalVersion: pastVersion,
    };

    // Add the new version to history
    try {
      this.addMessageToHistory(newVersionHistoryEntry);
      if ($DebugTestMode) {
        console.log("💾 📚 ✅ New version added to history successfully");
      }
    } catch (error) {
      if ($DebugTestMode) {
        console.error("💾 📚 ❌ Error adding new version to history:", error);
      }
    }

    if ($DebugTestMode) {
      console.log("💾 🔄 Original message preserved, new version created:", {
        originalText: originalContent.substring(0, 50) + "...",
        newVersionText: newText.substring(0, 50) + "...",
        oldVersion: pastVersion,
        newVersion: newVersion,
      });
    }

    // STEP 9: Save state
    if ($DebugTestMode) {
      console.log("💾 💾 STEP 9: Saving state");
    }
    try {
      appState.saveToStorage();
      if ($DebugTestMode) {
        console.log("💾 💾 ✅ State saved successfully");
      }
    } catch (error) {
      if ($DebugTestMode) {
        console.error("💾 💾 ❌ Error saving state:", error);
      }
    }

    // STEP 10: Get edit interface settings
    if ($DebugTestMode) {
      console.log("💾 ⚙️ STEP 10: Getting edit interface settings");
    }
    const editContextToggle = document.getElementById(
      `editContextPlusToggle_${messageId}`
    );
    const editAiDropdown = document.getElementById(
      `editAiDropdownContainer_${messageId}`
    );

    if ($DebugTestMode) {
      console.log("💾 ⚙️ Edit interface elements:", {
        contextToggle: !!editContextToggle,
        contextToggleActive: editContextToggle?.classList.contains("active"),
        aiDropdown: !!editAiDropdown,
      });
    }

    const isContextPlusEnabled = editContextToggle
      ? editContextToggle.classList.contains("active")
      : false;
    let selectedModel = appState.selectedAIModel;

    if (editAiDropdown) {
      const modelButton = editAiDropdown.querySelector(".ai-dropdown-button");
      if (modelButton && modelButton.dataset.modelId) {
        selectedModel = modelButton.dataset.modelId;
        if ($DebugTestMode) {
          console.log("💾 ⚙️ Selected model from dropdown:", selectedModel);
        }
      }
    }

    if ($DebugTestMode) {
      console.log("💾 ⚙️ Final settings:", {
        contextPlus: isContextPlusEnabled,
        model: selectedModel,
        filesCount: newVersionFiles.length,
      });
    }

    // STEP 11: Sync global state
    if ($DebugTestMode) {
      console.log("💾 🔄 STEP 11: Syncing global state");
    }
    const globalContextToggle = document.getElementById("contextPlusToggle");
    if (globalContextToggle) {
      if (isContextPlusEnabled) {
        globalContextToggle.classList.add("active");
        appState.contextPlusEnabled = true;
      } else {
        globalContextToggle.classList.remove("active");
        appState.contextPlusEnabled = false;
      }
      if ($DebugTestMode) {
        console.log("💾 🔄 Global context+ synced:", isContextPlusEnabled);
      }
    }

    if (selectedModel !== appState.selectedAIModel) {
      appState.selectedAIModel = selectedModel;
      if ($DebugTestMode) {
        console.log("💾 🔄 Global AI model updated:", selectedModel);
      }
    }

    // STEP 13: Process attachments for sending
    if ($DebugTestMode) {
      console.log("💾 📤 STEP 13: Processing attachments for sending");
    }
    const processedAttachments = newVersionFiles.map((file, index) => {
      const processed = {
        type: "large_content",
        filename: file.filename,
        content: file.content,
        size: file.size || file.content?.length || 0,
        contentType: file.language || "text",
        extension: file.extension || this.getFileExtension(file.filename),
        language: file.language || "plaintext",
        id: file.id,
        word_count:
          file.word_count ||
          (file.content ? file.content.split(/\s+/).length : 0),
        line_count:
          file.line_count ||
          (file.content ? file.content.split("\n").length : 0),
        is_executable: file.is_executable || false,
        mime_type: file.mime_type || "text/plain",
        created_at: file.created_at || new Date().toISOString(),
      };

      if ($DebugTestMode) {
        console.log(`💾 📤 Processed attachment ${index + 1}:`, {
          id: processed.id,
          filename: processed.filename,
          contentLength: processed.content?.length,
          contentSample: processed.content?.substring(0, 200),
          type: processed.type,
        });
      }

      return processed;
    });

    if ($DebugTestMode) {
      console.log(
        "💾 📤 All processed attachments:",
        processedAttachments.length
      );
      console.log(
        "💾 📤 Processed attachments content lengths:",
        processedAttachments.map((att, idx) => ({
          id: att.id,
          filename: att.filename,
          contentLength: att.content?.length,
          contentSample: att.content?.substring(0, 200),
        }))
      );
    }

    // STEP 14: Clear editing state
    if ($DebugTestMode) {
      console.log("💾 🧹 STEP 14: Clearing editing state");
    }
    this.editingMessageId = null;
    if ($DebugTestMode) {
      console.log("💾 🧹 ✅ Editing state cleared");
    }

    // STEP 15: Send the message
    if ($DebugTestMode) {
      console.log("💾 🚀 STEP 15: Sending edited message");
    }
    try {
      if ($DebugTestMode) {
        console.log("💾 🚀 Calling chatManager.sendMessage...");
      }
      chatManager.sendMessage(
        newText,
        processedAttachments,
        newVersion,
        true, // isEditedMessage
        messageId // messageId to update
      );
      if ($DebugTestMode) {
        console.log("💾 🚀 ✅ Edit sent successfully via chatManager");
      }
    } catch (error) {
      if ($DebugTestMode) {
        console.error("💾 🚀 ❌ Error sending edited message:", error);
        console.error("💾 🚀 ❌ Error stack:", error.stack);
      }

      if (typeof chatManager !== "undefined") {
        chatManager.setProcessingState(false);
      }
    }

    if ($DebugTestMode) {
      console.log("💾 ✅ === SAVE EDIT COMPLETED ===");
      console.log(
        `💾 ✅ Message updated from version ${pastVersion} to ${newVersion}`
      );
      console.log(
        "💾 ✅ Total processing time:",
        Date.now() - performance.now(),
        "ms"
      );
    }
  },

  getDataVersion: function (messageId) {
    if ($DebugTestMode) {
      console.log(`Starting search for messageId: ${messageId}`);
    }

    // Find ALL elements with the specified data-message-id
    const elements = document.querySelectorAll(
      `[data-message-id="${messageId}"]`
    );

    if ($DebugTestMode) {
      console.log(
        `Found ${elements.length} elements with data-message-id="${messageId}"`
      );
    }

    // Loop through all matching elements
    for (const element of elements) {
      if ($DebugTestMode) {
        console.log(`Checking element:`, element);
      }

      // Check if element has data-version attribute first
      const dataVersion = element.getAttribute("data-version");

      if (dataVersion === null) {
        if ($DebugTestMode) {
          console.log(`Element has no data-version attribute, skipping`);
        }
        continue;
      }

      // Check if element doesn't have display: none
      const style = window.getComputedStyle(element);
      const displayValue = style.display;

      if ($DebugTestMode) {
        console.log(
          `Element display style: ${displayValue}, data-version: ${dataVersion}`
        );
      }

      if (displayValue !== "none") {
        if ($DebugTestMode) {
          console.log(
            `Found valid visible element! data-version: ${dataVersion}`
          );
        }

        // Return the data-version value of the visible element
        return dataVersion;
      } else {
        if ($DebugTestMode) {
          console.log(
            `Element is hidden (display: none), continuing to next element`
          );
        }
      }
    }

    if ($DebugTestMode) {
      console.log(`No visible elements found, returning null`);
    }
    // Return null if no visible element found
    return null;
  },
  navigateVersion: function (messageId, direction) {
    if ($DebugTestMode) {
      console.log("🧭 === NAVIGATE VERSION (SIMPLIFIED) ===");
      console.log("🧭 📍 Message ID:", messageId);
      console.log("🧭 📍 Direction:", direction);
    }

    if (chatManager.currentStreamMessageId) {
      if ($DebugTestMode) {
        console.log("🧭 ❌ Cannot navigate while processing a message");
      }
      return;
    }

    // STEP 1: Get current displaying version
    const currentDisplayingVersionRaw = this.getDataVersion(messageId);
    const currentDisplayingVersion = Number(currentDisplayingVersionRaw);
    if ($DebugTestMode) {
      console.log(
        "🧭 📊 Currently displaying version:",
        currentDisplayingVersion
      );
    }

    // STEP 2: Calculate target version directly
    const targetVersion = currentDisplayingVersion + direction;
    if ($DebugTestMode) {
      console.log("🧭 🎯 Target version:", targetVersion);
    }

    // STEP 3: Check if target version is valid (must be >= 1)
    if (targetVersion < 1) {
      if ($DebugTestMode) {
        console.log("🧭 ❌ Cannot go below version 1");
      }
      return;
    }

    // STEP 4: Get ALL versions of this message from history
    const currentConversation = this.getCurrentConversation();
    if ($DebugTestMode) {
      console.log(
        "🧭 📋 Total conversation messages:",
        currentConversation.length
      );
    }

    const allVersions = currentConversation.filter(
      (msg) => msg.id === messageId
    );

    if ($DebugTestMode) {
      console.log("🧭 📊 All versions found:", allVersions.length);
    }

    // STEP 5: Find the target version in history
    const targetMessage = allVersions.find(
      (msg) => (msg.version || 1) === targetVersion
    );

    if (!targetMessage) {
      if ($DebugTestMode) {
        console.log("🧭 ❌ Target version not found in history");
        console.log("🧭 🔍 AVAILABLE VERSIONS:");
        allVersions.forEach((msg, index) => {
          console.log(
            `🧭   Available version ${index + 1}: ${msg.version || 1}`
          );
        });
      }
      return;
    }

    if ($DebugTestMode) {
      console.log("🧭 ✅ Found target message:", {
        id: targetMessage.id,
        version: targetMessage.version || 1,
        text: targetMessage.text.substring(0, 50) + "...",
      });

      console.log(
        `🧭 🚀 NAVIGATION: v${currentDisplayingVersion} → v${targetVersion}`
      );
    }

    // STEP 6: Call showVersion with just the version number (not the entire object)
    this.showVersion(messageId, targetVersion, targetMessage);

    if ($DebugTestMode) {
      console.log("🧭 🎉 === VERSION NAVIGATION COMPLETED ===");
    }
  },

  showVersion: function (messageId, targetVersion, historyEntry) {
    if ($DebugTestMode) {
      console.log("🧭 🔄 STEP 5: Showing target version");
    }

    // Hide all versions of this message first (only valid message elements)
    const allVersions = document.querySelectorAll(
      `[data-message-id="${messageId}"][data-version]`
    );
    allVersions.forEach((element) => {
      element.style.display = "none";
    });

    // Show only the target version
    const targetElement = document.querySelector(
      `[data-message-id="${messageId}"][data-version="${targetVersion}"]`
    );
    if (targetElement) {
      targetElement.style.display = "";
      if ($DebugTestMode) {
        console.log("🧭 ✅ Target version element shown");
      }
    } else {
      if ($DebugTestMode) {
        console.error("🧭 ❌ Target version element not found");
      }
    }

    // Handle subsequent messages based on version
    if ($DebugTestMode) {
      console.log("🧭 🔄 STEP 7: Updating messages after this version");
    }
    this.updateMessagesAfterVersion(messageId, targetVersion);
    if ($DebugTestMode) {
      console.log("🧭 ✅ Subsequent messages updated");
    }

    // Save state
    if ($DebugTestMode) {
      console.log("🧭 💾 STEP 8: Saving state");
    }
    appState.saveToStorage();
    if ($DebugTestMode) {
      console.log("🧭 ✅ State saved");
    }
  },

  updateMessagesAfterVersion: function (
    userMessageId,
    targetVersion,
    userDisplayVersionFromLoadConversation = null
  ) {
    if ($DebugTestMode) {
      console.log(
        "🔄 === UPDATE MESSAGES AFTER VERSION (VERSION-AWARE CHAIN) ==="
      );
      console.log("🔄 📍 ENTRY PARAMETERS:");
      console.log("🔄   - User message ID:", userMessageId);
      console.log("🔄   - Target version:", targetVersion);
      console.log("🔄   - Timestamp:", new Date().toISOString());
    }

    if (!userMessageId || !targetVersion) {
      if ($DebugTestMode) {
        console.error("🔄 ❌ CRITICAL: Invalid parameters");
      }
      return;
    }

    // Enhanced helper function with better debugging and more robust searching
    const getMessageElementByVersion = (messageId, version) => {
      if ($DebugTestMode) {
        console.log(
          `🔄 🔍 [SEARCH INITIATED] messageId="${messageId}" version="${version}"`
        );
      }

      // Detailed element logger
      const logElementDetails = (el, prefix = "") => {
        if (!el) return "Element not found";
        return {
          node: `${el.tagName}${el.id ? `#${el.id}` : ""}${
            el.className ? `.${el.className.split(" ").join(".")}` : ""
          }`,
          dataAttrs: {
            messageId: el.getAttribute("data-message-id"),
            version: el.getAttribute("data-version"),
            type: el.getAttribute("data-type"),
          },
          visibility: window.getComputedStyle(el).display,
          parent: el.parentElement
            ? `${el.parentElement.tagName}${
                el.parentElement.id ? `#${el.parentElement.id}` : ""
              }`
            : "None",
          htmlSnippet: el.outerHTML
            ? el.outerHTML.substring(0, 120) + "..."
            : "N/A",
        };
      };

      // 1. Exact attribute match
      const exactSelector = `[data-message-id="${messageId}"][data-version="${version}"]`;
      if ($DebugTestMode) {
        console.log(`🔄 🔍 [STRATEGY 1] Exact selector: ${exactSelector}`);
      }
      const exactMatch = document.querySelector(exactSelector);
      if ($DebugTestMode) {
        console.log(
          `🔄 🔍 [STRATEGY 1] Result:`,
          logElementDetails(exactMatch)
        );
      }
      if (exactMatch) return exactMatch;

      // 2. ID match with version check
      if ($DebugTestMode) {
        console.log(`🔄 🔍 [STRATEGY 2] getElementById("${messageId}")`);
      }
      const elementById = document.getElementById(messageId);
      if ($DebugTestMode) {
        console.log(
          `🔄 🔍 [STRATEGY 2] Found:`,
          logElementDetails(elementById)
        );
      }

      if (elementById) {
        const foundVersion = elementById.getAttribute("data-version");
        if ($DebugTestMode) {
          console.log(
            `🔄 🔍 [STRATEGY 2] Version check: found "${foundVersion}" vs required "${version}"`
          );
        }
        if (foundVersion === String(version)) return elementById;
      }

      // 3. Comprehensive DOM scan
      const selector = `[data-message-id="${messageId}"]`;
      if ($DebugTestMode) {
        console.log(`🔄 🔍 [STRATEGY 3] QuerySelectorAll("${selector}")`);
      }
      const allElements = document.querySelectorAll(selector);
      if ($DebugTestMode) {
        console.log(`🔄 🔍 [STRATEGY 3] Found ${allElements.length} elements`);
      }

      allElements.forEach((el, i) => {
        const elVersion = el.getAttribute("data-version");
        if ($DebugTestMode) {
          console.log(`🔄 🔍 [STRATEGY 3] Element #${i + 1}:`, {
            match:
              elVersion === String(version) ? "POSSIBLE MATCH" : "NO MATCH",
            requiredVersion: version,
            foundVersion: elVersion,
            ...logElementDetails(el),
          });
        }
      });

      for (let el of allElements) {
        if (el.getAttribute("data-version") === String(version)) return el;
      }

      if ($DebugTestMode) {
        console.log(
          `🔄 ❌ [SEARCH FAILED] NO ELEMENT FOUND for messageId="${messageId}" version="${version}"`
        );
      }
      return null;
    };

    // Helper function to get all message elements by ID (all versions)
    /*const getAllMessageElements = (messageId) => {
      return document.querySelectorAll(
        `[data-message-id="${messageId}"][data-version]`
      );
    };*/

    // Find the user message
    if ($DebugTestMode) {
      console.log("🔄 🔍 STEP 1: FINDING USER MESSAGE");
    }
    const currentConversation = this.getCurrentConversation();

    // DEBUG: Essential info only
    if ($DebugTestMode) {
      console.log("🔄 Looking for:", userMessageId, typeof userMessageId);
      console.log(
        "🔄 Available IDs:",
        currentConversation.map((msg) => msg.id)
      );
    }

    const userMessage = currentConversation.find(
      (msg) => msg.id === userMessageId
    );

    if (!userMessage) {
      if ($DebugTestMode) {
        console.error("🔄 ❌ CRITICAL: User message not found in history");
      }
      return;
    }
    const userMessageIndex = currentConversation.findIndex(
      (msg) => msg.id === userMessageId
    );
    if ($DebugTestMode) {
      console.log("🔄   - User message index in history:", userMessageIndex);
    }

    // ✅ CRITICAL IMPROVEMENT: VERSION-AWARE MESSAGE FILTERING
    if ($DebugTestMode) {
      console.log("🔄 🔍 STEP 2: GETTING VERSION-AWARE SUBSEQUENT MESSAGES");
    }

    // Get all subsequent messages (but exclude any with the same ID as our main user message)
    const allSubsequentMessages = currentConversation
      .slice(userMessageIndex + 1)
      .filter((msg) => {
        const isMainUserMessage = msg.id === userMessageId;
        if (isMainUserMessage) {
          if ($DebugTestMode) {
            console.log(
              `🔄   - 🚫 EXCLUDING: Message ${msg.id} v${
                msg.version || 1
              } (same ID as main message)`
            );
          }
        }
        return !isMainUserMessage;
      });

    if ($DebugTestMode) {
      console.log(
        `🔄   - Total subsequent messages: ${allSubsequentMessages.length}`
      );
    }

    // ✅ NEW: BUILD VERSION-AWARE VISIBILITY MAP
    if ($DebugTestMode) {
      console.log("🔄 🔗 STEP 3: BUILDING VERSION-AWARE MESSAGE CHAIN");
    }

    // Track which specific message versions should be visible
    const visibleMessageVersions = new Set();
    const messagesToCheck = [`${userMessageId}.v${targetVersion}`]; // Start with the versioned parent

    if ($DebugTestMode) {
      console.log(
        "🔄 🔗 Starting chain with parent:",
        `${userMessageId}.v${targetVersion}`
      );
    }

    // ✅ IMPROVED: Build the chain of messages that should be visible (LATEST VERSION ONLY)
    while (messagesToCheck.length > 0) {
      const currentParentId = messagesToCheck.shift();
      if ($DebugTestMode) {
        console.log(
          `🔄 🔗 Looking for messages with parent_message_id: "${currentParentId}"`
        );
      }

      // Find all messages that have this exact versioned parent ID
      const childMessages = allSubsequentMessages.filter((msg) => {
        const hasMatchingParent = msg.parent_message_id === currentParentId;
        if (hasMatchingParent) {
          if ($DebugTestMode) {
            console.log(
              `🔄 🔗   Found child: ${msg.id} v${msg.version || 1} (${
                msg.type
              }) -> parent: ${currentParentId}`
            );
          }
        }
        return hasMatchingParent;
      });

      // ✅ NEW: Group child messages by ID and only keep the latest version of each
      const latestVersionsByMessageId = new Map();

      childMessages.forEach((msg) => {
        const msgVersion = msg.version || 1;
        const existingMsg = latestVersionsByMessageId.get(msg.id);

        if (!existingMsg || msgVersion > (existingMsg.version || 1)) {
          if ($DebugTestMode) {
            console.log(
              `🔄 🔗   Setting latest version for ${msg.id}: v${msgVersion} (${msg.type})`
            );
          }
          latestVersionsByMessageId.set(msg.id, msg);
        } else {
          if ($DebugTestMode) {
            console.log(
              `🔄 🔗   Skipping older version ${
                msg.id
              }: v${msgVersion} (keeping v${existingMsg.version || 1})`
            );
          }
        }
      });

      // Add only the latest versions to visibility set
      latestVersionsByMessageId.forEach((msg) => {
        const msgVersion = msg.version || 1;
        const versionKey = `${msg.id}.v${msgVersion}`;

        if (!visibleMessageVersions.has(versionKey)) {
          visibleMessageVersions.add(versionKey);
          if ($DebugTestMode) {
            console.log(
              `🔄 🔗   Added LATEST VERSION to visible: ${versionKey}`
            );
          }

          // Add this specific versioned message to check for its children
          messagesToCheck.push(versionKey);
          if ($DebugTestMode) {
            console.log(
              `🔄 🔗   Will check for children of LATEST VERSION: ${versionKey}`
            );
          }
        }
      });
    }

    if ($DebugTestMode) {
      console.log(
        `🔄 🔗 Final visible message versions:`,
        Array.from(visibleMessageVersions)
      );
    }

    // ✅ STEP 4: PROCESS ALL SUBSEQUENT MESSAGES WITH VERSION AWARENESS
    if ($DebugTestMode) {
      console.log("🔄 🎯 STEP 4: PROCESSING MESSAGES WITH VERSION AWARENESS");
    }

    let shownCount = 0;
    let hiddenCount = 0;

    // Group messages by ID to handle multiple versions properly
    const messagesByID = new Map();
    allSubsequentMessages.forEach((msg) => {
      if (!messagesByID.has(msg.id)) {
        messagesByID.set(msg.id, []);
      }
      messagesByID.get(msg.id).push(msg);
    });

    // Process each message ID group
    messagesByID.forEach((versions, messageId) => {
      if ($DebugTestMode) {
        console.log(`🔄 🔍 === PROCESSING MESSAGE ID: ${messageId} ===`);
        console.log(`🔄   - Found ${versions.length} version(s)`);
      }

      // Sort versions by version number (highest first)
      versions.sort((a, b) => (b.version || 1) - (a.version || 1));

      versions.forEach((msg, versionIndex) => {
        const msgVersion = msg.version || 1;
        const versionKey = `${msg.id}.v${msgVersion}`;
        const shouldShow = visibleMessageVersions.has(versionKey);

        if ($DebugTestMode) {
          console.log(`🔄   - Version ${msgVersion}:`);
          console.log(`🔄     - Type: ${msg.type}`);
          console.log(`🔄     - Parent: "${msg.parent_message_id}"`);
          console.log(`🔄     - Should show: ${shouldShow}`);
          console.log(`🔄     - Version key: ${versionKey}`);
        }

        // Get DOM element for this specific version
        const msgEl = getMessageElementByVersion(msg.id, msgVersion);

        if (msgEl) {
          if (shouldShow) {
            if ($DebugTestMode) {
              console.log(`🔄 🎯 SHOWING: ${msg.type} ${versionKey}`);
            }
            msgEl.style.display = "";
            shownCount++;
          } else {
            if ($DebugTestMode) {
              console.log(
                `🔄 🎯 HIDING: ${msg.type} ${versionKey} (not in visible chain)`
              );
            }
            msgEl.style.display = "none";
            hiddenCount++;
          }
        } else {
          if ($DebugTestMode) {
            console.log(`🔄   - 👁️ DOM element not found for ${versionKey}`);
          }

          // Try to recreate if it should be shown
          if (shouldShow) {
            if ($DebugTestMode) {
              console.log(`🔄   - 🔧 Attempting to recreate ${versionKey}`);
            }
            try {
              this.recreateMessageElement(msg, userMessageId);
              shownCount++;
            } catch (error) {
              if ($DebugTestMode) {
                console.error(`🔄   - ❌ Recreation failed:`, error);
              }
            }
          }
        }
      });
    });

    if ($DebugTestMode) {
      console.log("🔄 📊 === FINAL SUMMARY ===");
      console.log(`🔄   - Target version: ${targetVersion}`);
      console.log(`🔄   - Messages shown: ${shownCount}`);
      console.log(`🔄   - Messages hidden: ${hiddenCount}`);
      console.log(`🔄   - Visible versions: ${visibleMessageVersions.size}`);
      console.log(`🔄   - Message IDs processed: ${messagesByID.size}`);
      console.log("🔄 ✅ === VERSION-AWARE UPDATE COMPLETE ===");
    }
  },

  // FIXED: Enhanced isChildOfVersionMessages function with proper version filtering
  isChildOfVersionMessages: function (
    msg,
    userMessageId,
    targetVersion,
    trackedResponses
  ) {
    if ($DebugTestMode) {
      console.log(`🔄 🔍 === CHECKING CHILD RELATIONSHIP (SUPER DEBUG) ===`);
      console.log(
        `🔄 🔍 🎯 ENTRY: Checking if ${msg.id} is child of version ${targetVersion} messages`
      );
      console.log(`🔄 🔍 📍 User message ID: ${userMessageId}`);
      console.log(`🔄 🔍 📍 Target version: ${targetVersion}`);
      console.log(
        `🔄 🔍 📍 Tracked responses: [${trackedResponses.join(", ")}]`
      );
      console.log(`🔄 🔍 📍 Message being analyzed:`, {
        id: msg.id,
        type: msg.type,
        parent_message_id: msg.parent_message_id,
        text: msg.text.substring(0, 50) + "...",
        timestamp: msg.timestamp,
      });
    }

    // Traverse up the parent chain
    let currentMsg = msg;
    let chainDepth = 0;
    const maxChainDepth = 10;
    const parentChain = [];

    if ($DebugTestMode) {
      console.log(`🔄 🔍 🔗 STARTING PARENT CHAIN TRAVERSAL`);
    }

    while (currentMsg && chainDepth < maxChainDepth) {
      chainDepth++;
      const chainEntry = {
        depth: chainDepth,
        id: currentMsg.id,
        parent_message_id: currentMsg.parent_message_id,
        type: currentMsg.type,
        text: currentMsg.text.substring(0, 30) + "...",
      };
      parentChain.push(chainEntry);

      if ($DebugTestMode) {
        console.log(
          `🔄 🔍 📊 DEPTH ${chainDepth}: Analyzing message ${currentMsg.id} (${currentMsg.type})`
        );
        console.log(`🔄 🔍   💾 Message details:`, {
          id: currentMsg.id,
          type: currentMsg.type,
          parent_message_id: currentMsg.parent_message_id,
          response_to_version: currentMsg.response_to_version,
          text: currentMsg.text.substring(0, 50) + "...",
          timestamp: currentMsg.timestamp,
        });
        console.log(
          `🔄 🔍   🔗 Raw parent ID: "${currentMsg.parent_message_id}"`
        );
      }

      if (!currentMsg.parent_message_id) {
        if ($DebugTestMode) {
          console.log(
            `🔄 🔍   ❌ NO PARENT: Chain ends at depth ${chainDepth}`
          );
          console.log(`🔄 🔍   📈 Final chain length: ${parentChain.length}`);
        }
        break;
      }

      // ===== ENHANCED PARENT ID ANALYSIS =====
      if ($DebugTestMode) {
        console.log(
          `🔄 🔍 🧬 === PARENT ID ANALYSIS (DEPTH ${chainDepth}) ===`
        );
      }
      let searchParentId = currentMsg.parent_message_id;
      let requiredParentVersion = null;
      let isVersionedParentId = false;

      if ($DebugTestMode) {
        console.log(`🔄 🔍 🧬 Original parent ID: "${searchParentId}"`);
        console.log(`🔄 🔍 🧬 Contains '.v': ${searchParentId.includes(".v")}`);
        console.log(`🔄 🔍 🧬 Parent ID length: ${searchParentId.length}`);
        console.log(`🔄 🔍 🧬 Parent ID type: ${typeof searchParentId}`);
      }

      // Enhanced version-specific parent ID handling
      if (searchParentId.includes(".v")) {
        isVersionedParentId = true;
        const parts = searchParentId.split(".v");
        const baseId = parts[0];
        const versionPart = parts[1];

        if ($DebugTestMode) {
          console.log(`🔄 🔍 🧬 VERSIONED PARENT ID DETECTED:`);
          console.log(`🔄 🔍 🧬   Split parts:`, parts);
          console.log(`🔄 🔍 🧬   Base ID: "${baseId}"`);
          console.log(`🔄 🔍 🧬   Version part: "${versionPart}"`);
          console.log(`🔄 🔍 🧬   Version part type: ${typeof versionPart}`);
        }

        searchParentId = baseId;
        requiredParentVersion = parseInt(versionPart);

        if ($DebugTestMode) {
          console.log(
            `🔄 🔍 🧬   Parsed required version: ${requiredParentVersion}`
          );
          console.log(
            `🔄 🔍 🧬   Is valid number: ${!isNaN(requiredParentVersion)}`
          );
          console.log(`🔄 🔍 🧬   Final search ID: "${searchParentId}"`);
        }
      } else {
        if ($DebugTestMode) {
          console.log(`🔄 🔍 🧬 NON-VERSIONED PARENT ID`);
          console.log(`🔄 🔍 🧬   Will search for: "${searchParentId}"`);
        }
      }

      if ($DebugTestMode) {
        console.log(`🔄 🔍 🧬 === VERSION MATCHING ANALYSIS ===`);
        console.log(`🔄 🔍 🧬 Is versioned parent: ${isVersionedParentId}`);
        console.log(
          `🔄 🔍 🧬 Required parent version: ${requiredParentVersion}`
        );
        console.log(`🔄 🔍 🧬 Target version we're viewing: ${targetVersion}`);
        console.log(`🔄 🔍 🧬 Search parent ID: "${searchParentId}"`);
        console.log(`🔄 🔍 🧬 User message ID: "${userMessageId}"`);
        console.log(
          `🔄 🔍 🧬 Is parent the user message: ${
            searchParentId === userMessageId
          }`
        );
      }

      // ✅ ENHANCED: Version check with detailed logging
      if (requiredParentVersion && searchParentId === userMessageId) {
        if ($DebugTestMode) {
          console.log(`🔄 🔍 🧬 🎯 CRITICAL VERSION CHECK:`);
          console.log(
            `🔄 🔍 🧬   Message requires parent version: ${requiredParentVersion}`
          );
          console.log(`🔄 🔍 🧬   Currently viewing version: ${targetVersion}`);
          console.log(
            `🔄 🔍 🧬   Versions match: ${
              targetVersion === requiredParentVersion
            }`
          );
          console.log(
            `🔄 🔍 🧬   Version comparison: ${requiredParentVersion} === ${targetVersion} = ${
              requiredParentVersion === targetVersion
            }`
          );
        }

        if (targetVersion === requiredParentVersion) {
          if ($DebugTestMode) {
            console.log(
              `🔄 🔍 🧬 ✅ EXACT VERSION MATCH: Message should be shown`
            );
            console.log(
              `🔄 🔍 🧬   Message ${currentMsg.id} requires version ${requiredParentVersion}`
            );
            console.log(
              `🔄 🔍 🧬   Currently viewing version ${targetVersion}`
            );
            console.log(`🔄 🔍 🧬   RESULT: SHOW this message (return true)`);
            console.log(
              `🔄 🔍 🧬   Parent chain: ${parentChain
                .map((p) => `${p.id}(d${p.depth})`)
                .join(" -> ")}`
            );
          }
          return true;
        } else {
          if ($DebugTestMode) {
            console.log(
              `🔄 🔍 🧬 ❌ VERSION MISMATCH: Message should be hidden`
            );
            console.log(
              `🔄 🔍 🧬   Message ${currentMsg.id} requires version ${requiredParentVersion}`
            );
            console.log(
              `🔄 🔍 🧬   Currently viewing version ${targetVersion}`
            );
            console.log(
              `🔄 🔍 🧬   Mismatch type: ${
                requiredParentVersion > targetVersion
                  ? "FUTURE VERSION"
                  : "PAST VERSION"
              }`
            );
            console.log(
              `🔄 🔍 🧬   STRICT VERSIONING: Hide any version mismatch`
            );
            console.log(`🔄 🔍 🧬   RESULT: HIDE this message (return false)`);
            console.log(
              `🔄 🔍 🧬   Parent chain: ${parentChain
                .map((p) => `${p.id}(d${p.depth})`)
                .join(" -> ")}`
            );
          }
          return false;
        }
      } else if (isVersionedParentId) {
        if ($DebugTestMode) {
          console.log(`🔄 🔍 🧬 📝 VERSIONED PARENT (NOT USER MESSAGE):`);
          console.log(`🔄 🔍 🧬   Parent is not the user message being edited`);
          console.log(
            `🔄 🔍 🧬   Will continue traversal to find actual relationship`
          );
        }
      } else {
        if ($DebugTestMode) {
          console.log(`🔄 🔍 🧬 📝 NON-VERSIONED PARENT:`);
          console.log(
            `🔄 🔍 🧬   Standard parent relationship, no version requirements`
          );
        }
      }

      if ($DebugTestMode) {
        console.log(`🔄 🔍 🔍 === FINDING PARENT MESSAGE ===`);
        console.log(`🔄 🔍 🔍 Searching for parent ID: "${searchParentId}"`);
        console.log(
          `🔄 🔍 🔍 In ${appState.chatHistory.length} messages in history`
        );
      }

      const currentConversation = this.getCurrentConversation();
      const parentMsg = currentConversation.find(
        (m) => m.id === searchParentId
      );
      if (!parentMsg) {
        if ($DebugTestMode) {
          console.log(`🔄 🔍 🔍 ❌ PARENT NOT FOUND:`);
          console.log(
            `🔄 🔍 🔍   Original parent ID: ${currentMsg.parent_message_id}`
          );
          console.log(`🔄 🔍 🔍   Searched for: ${searchParentId}`);
          console.log(`🔄 🔍 🔍   Available message IDs in history:`);
        }

        // Show first 10 message IDs for debugging
        const availableIds = appState.chatHistory.slice(0, 10).map((m) => ({
          id: m.id,
          type: m.type,
          text: m.text.substring(0, 20) + "...",
        }));
        if ($DebugTestMode) {
          console.log(`🔄 🔍 🔍   Sample IDs:`, availableIds);
          console.log(
            `🔄 🔍 🔍   CHAIN TERMINATION: Cannot continue traversal`
          );
        }
        break;
      }

      // ===== RELATIONSHIP ANALYSIS =====
      if ($DebugTestMode) {
        console.log(
          `🔄 🔍 🎯 === RELATIONSHIP ANALYSIS (DEPTH ${chainDepth}) ===`
        );
      }

      // Check if parent is the target user message
      const isTargetUserMessage = parentMsg.id === userMessageId;
      if ($DebugTestMode) {
        console.log(
          `🔄 🔍 🎯 Is parent the target user message: ${isTargetUserMessage}`
        );
      }

      if (isTargetUserMessage) {
        if ($DebugTestMode) {
          console.log(`🔄 🔍 🎯 ✅ FOUND CONNECTION TO USER MESSAGE:`);
          console.log(
            `🔄 🔍 🎯   Chain leads back to user message ${userMessageId}`
          );
          console.log(`🔄 🔍 🎯   Chain depth: ${chainDepth}`);
        }

        if (requiredParentVersion) {
          if ($DebugTestMode) {
            console.log(
              `🔄 🔍 🎯   Had version requirement: ${requiredParentVersion}`
            );
            console.log(`🔄 🔍 🎯   Viewing version: ${targetVersion}`);
            console.log(
              `🔄 🔍 🎯   Version requirement satisfied in earlier check`
            );
          }
        } else {
          if ($DebugTestMode) {
            console.log(`🔄 🔍 🎯   No specific version requirement`);
          }
        }

        if ($DebugTestMode) {
          console.log(
            `🔄 🔍 🎯   FINAL PARENT CHAIN: ${parentChain
              .map((p) => `${p.id}(d${p.depth})`)
              .join(" -> ")}`
          );
          console.log(`🔄 🔍 🎯   RESULT: SHOW this message (return true)`);
        }
        return true;
      }

      // Check if parent is in tracked responses for this version
      const isInTrackedResponses = trackedResponses.includes(parentMsg.id);
      if ($DebugTestMode) {
        console.log(
          `🔄 🔍 🎯 Is parent in tracked responses: ${isInTrackedResponses}`
        );
      }

      if (isInTrackedResponses) {
        if ($DebugTestMode) {
          console.log(`🔄 🔍 🎯 ✅ PARENT IN TRACKED RESPONSES:`);
          console.log(
            `🔄 🔍 🎯   Parent ${parentMsg.id} is tracked for version ${targetVersion}`
          );
          console.log(`🔄 🔍 🎯   This creates a valid relationship chain`);
          console.log(
            `🔄 🔍 🎯   FINAL PARENT CHAIN: ${parentChain
              .map((p) => `${p.id}(d${p.depth})`)
              .join(" -> ")}`
          );
          console.log(`🔄 🔍 🎯   RESULT: SHOW this message (return true)`);
        }
        return true;
      }

      // Check if parent responds to the correct version
      const parentRespondsToUser =
        parentMsg.parent_message_id === userMessageId;
      if ($DebugTestMode) {
        console.log(
          `🔄 🔍 🎯 Parent responds directly to user: ${parentRespondsToUser}`
        );
      }

      if (parentRespondsToUser) {
        const parentResponseVersion =
          parentMsg.response_to_version || parentMsg.responds_to_version || 1;
        if ($DebugTestMode) {
          console.log(`🔄 🔍 🎯 PARENT VERSION ANALYSIS:`);
          console.log(
            `🔄 🔍 🎯   Parent responds to version: ${parentResponseVersion}`
          );
          console.log(`🔄 🔍 🎯   Target version: ${targetVersion}`);
          console.log(
            `🔄 🔍 🎯   Versions match: ${
              parentResponseVersion === targetVersion
            }`
          );
        }

        if (parentResponseVersion === targetVersion) {
          if ($DebugTestMode) {
            console.log(`🔄 🔍 🎯 ✅ PARENT RESPONDS TO CORRECT VERSION:`);
            console.log(
              `🔄 🔍 🎯   Parent ${parentMsg.id} responds to version ${targetVersion}`
            );
            console.log(
              `🔄 🔍 🎯   This creates a valid version-specific relationship`
            );
            console.log(
              `🔄 🔍 🎯   FINAL PARENT CHAIN: ${parentChain
                .map((p) => `${p.id}(d${p.depth})`)
                .join(" -> ")}`
            );
            console.log(`🔄 🔍 🎯   RESULT: SHOW this message (return true)`);
          }
          return true;
        } else {
          if ($DebugTestMode) {
            console.log(`🔄 🔍 🎯 ❌ PARENT VERSION MISMATCH:`);
            console.log(
              `🔄 🔍 🎯   Parent responds to version ${parentResponseVersion}, not ${targetVersion}`
            );
            console.log(
              `🔄 🔍 🎯   Will continue traversal to check further up the chain`
            );
          }
        }
      }

      if ($DebugTestMode) {
        console.log(`🔄 🔍 🔄 CONTINUING TRAVERSAL:`);
        console.log(
          `🔄 🔍 🔄   Moving from ${currentMsg.id} to ${parentMsg.id}`
        );
        console.log(`🔄 🔍 🔄   Next depth will be: ${chainDepth + 1}`);
      }

      // Continue up the chain
      currentMsg = parentMsg;
    }

    // ===== FINAL ANALYSIS =====
    if ($DebugTestMode) {
      console.log(`🔄 🔍 ❌ === TRAVERSAL COMPLETE - NO MATCH FOUND ===`);
      console.log(
        `🔄 🔍 ❌ Message ${msg.id} is NOT a child of version ${targetVersion} messages`
      );
      console.log(`🔄 🔍 ❌ Final analysis:`);
      console.log(`🔄 🔍 ❌   Chain depth reached: ${chainDepth}`);
      console.log(`🔄 🔍 ❌   Max depth limit: ${maxChainDepth}`);
      console.log(
        `🔄 🔍 ❌   Max depth reached: ${chainDepth >= maxChainDepth}`
      );
      console.log(`🔄 🔍 ❌   User message ID: ${userMessageId}`);
      console.log(`🔄 🔍 ❌   Target version: ${targetVersion}`);
      console.log(
        `🔄 🔍 ❌   Complete parent chain: ${parentChain
          .map((p) => `${p.id}(d${p.depth},${p.type})`)
          .join(" -> ")}`
      );
      console.log(`🔄 🔍 ❌   RESULT: HIDE this message (return false)`);
    }

    return false;
  },
  recreateMessageElement: function (messageData, insertAfterId) {
    if ($DebugTestMode) {
      console.log("🔧 Recreating message element:", messageData.id);
    }

    const content = document.getElementById("aiContent");
    if (!content) {
      if ($DebugTestMode) {
        console.error("🔧 ❌ aiContent not found");
      }
      return;
    }

    // Create message element
    const message = document.createElement("div");
    message.id = messageData.id;
    message.className =
      messageData.type === "ai"
        ? "message ai-response"
        : "message user-message";
    message.dataset.messageId = messageData.id;

    // Create message data object for HTML generation
    const msgData = {
      id: messageData.id,
      text: messageData.text,
      type: messageData.type,
      messageType: messageData.messageType,
      model: messageData.model,
      timestamp: messageData.timestamp,
      files: messageData.files || [],
      conversation_id: messageData.conversation_id,
      version: messageData.version,
    };

    // Generate HTML
    const shouldIncludeFiles = msgData.files && msgData.files.length > 0;
    message.innerHTML = this.createMessageHTML(msgData, shouldIncludeFiles);

    // Find insertion point
    const insertAfterEl = document.getElementById(insertAfterId);
    if (insertAfterEl) {
      insertAfterEl.insertAdjacentElement("afterend", message);
      if ($DebugTestMode) {
        console.log(
          "🔧 ✅ Message recreated and inserted after:",
          insertAfterId
        );
      }
    } else {
      content.appendChild(message);
      if ($DebugTestMode) {
        console.log("🔧 ✅ Message recreated and appended to content");
      }
    }

    // Setup attachment handlers if needed
    if (shouldIncludeFiles) {
      setTimeout(() => {
        this.setupAttachmentClickHandlers(message, msgData.files);
      }, 10);
    }

    return message;
  },

  // Enhanced rateMessage function with version support
  rateMessage: function (messageId, rating) {
    if ($DebugTestMode) {
      console.log("👍👎 === RATE MESSAGE (VERSION-AWARE) ===");
      console.log("👍👎 Message ID:", messageId);
      console.log("👍👎 Rating:", rating);
    }

    // STEP 1: Find the currently visible version of this message
    let messageEl = null;

    // Method 1: Use getDataVersion to find the currently displayed version
    const currentVersion = this.getDataVersion(messageId);
    if ($DebugTestMode) {
      console.log("👍👎 Currently displayed version:", currentVersion);
    }

    if (currentVersion) {
      // Find the specific version element
      messageEl = document.querySelector(
        `[data-message-id="${messageId}"][data-version="${currentVersion}"]`
      );
      if ($DebugTestMode) {
        console.log("👍👎 Found versioned element:", !!messageEl);
      }
    }

    if (!messageEl) {
      if ($DebugTestMode) {
        console.error("👍👎 ❌ No message element found for ID:", messageId);
      }
      return;
    }

    if ($DebugTestMode) {
      console.log("👍👎 Using message element:", {
        id: messageEl.id,
        dataMessageId: messageEl.getAttribute("data-message-id"),
        dataVersion: messageEl.getAttribute("data-version"),
        isVisible: window.getComputedStyle(messageEl).display !== "none",
      });
    }

    // STEP 2: Get both thumb buttons from the found element
    const thumbsUpBtn = messageEl.querySelector(".thumbs-up-btn");
    const thumbsDownBtn = messageEl.querySelector(".thumbs-down-btn");

    if (!thumbsUpBtn || !thumbsDownBtn) {
      if ($DebugTestMode) {
        console.error("👍👎 ❌ Thumb buttons not found in message element");
      }
      return;
    }

    // STEP 3: Get the SVG elements inside the buttons
    const thumbsUpSvg = thumbsUpBtn.querySelector("svg");
    const thumbsDownSvg = thumbsDownBtn.querySelector("svg");

    if (!thumbsUpSvg || !thumbsDownSvg) {
      if ($DebugTestMode) {
        console.error("👍👎 ❌ SVG elements not found in thumb buttons");
      }
      return;
    }

    // STEP 4: Apply the rating logic
    if (rating === "up") {
      // Toggle thumbs up
      if (thumbsUpSvg.style.fill === "white") {
        // Already selected, deselect
        thumbsUpSvg.style.fill = "";
        if ($DebugTestMode) {
          console.log("👍👎 Deselected thumbs up");
        }
      } else {
        // Select thumbs up
        thumbsUpSvg.style.fill = "white";
        if ($DebugTestMode) {
          console.log("👍👎 Selected thumbs up");
        }

        // Deselect thumbs down
        thumbsDownSvg.style.fill = "";
      }
    } else if (rating === "down") {
      // Toggle thumbs down
      if (thumbsDownSvg.style.fill === "white") {
        // Already selected, deselect
        thumbsDownSvg.style.fill = "";
        if ($DebugTestMode) {
          console.log("👍👎 Deselected thumbs down");
        }
      } else {
        // Select thumbs down
        thumbsDownSvg.style.fill = "white";
        if ($DebugTestMode) {
          console.log("👍👎 Selected thumbs down");
        }

        // Deselect thumbs up
        thumbsUpSvg.style.fill = "";
      }
    }

    if ($DebugTestMode) {
      console.log("👍👎 ✅ Rating applied successfully");
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

  retryMessage: function (messageId) {
    if ($DebugTestMode) {
      console.log(`Retry function called for message ID: ${messageId}`);
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

    // Get the AI message element
    const aiMessage = document.getElementById(messageId);

    if (!aiMessage) {
      if ($DebugTestMode) {
        console.error(`AI message element with ID ${messageId} not found`);
      }
      return;
    }

    if ($DebugTestMode) {
      console.log(`Found AI message element:`, aiMessage);
    }

    // Find the previous sibling that is a user message with display flex
    let prevElement = aiMessage.previousElementSibling;
    if ($DebugTestMode) {
      console.log(`Starting search for previous user message...`);
    }

    // Traverse backwards until we find a user message
    let iteration = 0;
    while (prevElement) {
      if ($DebugTestMode) {
        console.log(`Checking element #${iteration}:`, prevElement);
        console.log(`Class list:`, prevElement.classList);
        console.log(`Display style:`, prevElement.style.display);
      }

      if (
        prevElement.classList.contains("user-message") &&
        prevElement.style.display !== "none"
      ) {
        if ($DebugTestMode) {
          console.log(`✅ Found valid user message element:`, prevElement);
        }

        // Get the message ID from the data attribute
        const userMessageId = prevElement.getAttribute("data-message-id");
        if ($DebugTestMode) {
          console.log(`Extracted user message ID: ${userMessageId}`);
        }

        if (!userMessageId) {
          if ($DebugTestMode) {
            console.error(
              "No data-message-id attribute found on user message element"
            );
          }
          return;
        }

        // Call the methods with the user message ID
        if ($DebugTestMode) {
          console.log(`Calling startEdit with ID: ${userMessageId}`);
        }
        this.startEdit(userMessageId);

        if ($DebugTestMode) {
          console.log(`Calling saveEdit with ID: ${userMessageId}`);
        }
        this.saveEdit(userMessageId);

        if ($DebugTestMode) {
          console.log(`Retry process completed successfully`);
        }
        return;
      }

      prevElement = prevElement.previousElementSibling;
      iteration++;
    }

    if ($DebugTestMode) {
      console.error("❌ No user message found above the AI message");
      console.log(
        "Search completed - no suitable user message element was found"
      );
    }
  },

  // NEW: Send/Stop button management
  setSendButtonToStop: function (buttonElement) {
    if (!buttonElement) return;

    // Store original send button content
    if (!buttonElement.dataset.originalContent) {
      buttonElement.dataset.originalContent = buttonElement.innerHTML;
    }

    // Change to stop button
    buttonElement.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <rect x="6" y="6" width="12" height="12" rx="2" ry="2"></rect>
    </svg>
  `;
    buttonElement.title = "Stop generation";
    buttonElement.classList.add("stop-mode");

    // Update click handler
    const newHandler = () => this.stopCurrentGeneration();
    buttonElement.onclick = newHandler;

    this.isCurrentlySending = true;
  },

  setSendButtonToSend: function (buttonElement) {
    if (!buttonElement) return;

    // Restore original send button content
    if (buttonElement.dataset.originalContent) {
      buttonElement.innerHTML = buttonElement.dataset.originalContent;
    } else {
      // Fallback default send icon
      buttonElement.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
      </svg>
    `;
    }

    buttonElement.title = "Send message";
    buttonElement.classList.remove("stop-mode");

    // Restore original send functionality (this would need to be set by the chat manager)
    // For now, we'll just remove the stop handler
    buttonElement.onclick = null;

    this.isCurrentlySending = false;
    this.currentRequestController = null;
  },

  stopCurrentGeneration: function () {
    if ($DebugTestMode) {
      console.log("🛑 Stopping current generation...");
    }

    // FIRST, STOP ANY STREAMING IN CHATMANAGER
    if (typeof chatManager !== "undefined" && chatManager.stopStreaming) {
      chatManager.stopStreaming();
    }

    if (this.currentRequestController) {
      this.currentRequestController.abort();
      this.currentRequestController = null;
    }

    // FORCE HIDE THINKING INDICATOR
    this.hideThinking(true);

    // FIND AND RESTORE ALL SEND BUTTONS
    const allSendButtons = document.querySelectorAll(
      ".send-button, #sendButton, [id^='editSendButton_']"
    );
    allSendButtons.forEach((button) => {
      this.setSendButtonToSend(button);
    });

    // RESET ALL STATES
    this.isCurrentlySending = false;
    this.isRetrying = false;

    if (typeof chatManager !== "undefined" && chatManager.onGenerationStopped) {
      chatManager.onGenerationStopped();
    }

    if ($DebugTestMode) {
      console.log("🛑 Generation stopped successfully");
    }
  },

  // NEW: Set abort controller for current request
  setCurrentRequestController: function (controller) {
    this.currentRequestController = controller;
  },

  createAIResponseWithFiles: function (responseData) {
    // Clear retry state when we start receiving a response
    this.onResponseStart();

    if ($DebugTestMode) {
      console.log("🗂️ createAIResponseWithFiles called with:", responseData);
      console.log("🗂️ Files in response:", responseData.files);
      console.log(
        "🗂️ File count:",
        responseData.files ? responseData.files.length : 0
      );
    }

    // Simple duplicate check based on content and timing
    const currentTime = Date.now();
    const responseText = responseData.response || responseData.text || "";

    if (
      responseText === this.lastProcessedMessageText &&
      currentTime - this.lastProcessedMessageTime < this.duplicateThresholdMs
    ) {
      if ($DebugTestMode) {
        console.log(
          "🔄 Duplicate message detected based on content + timing, skipping"
        );
      }
      return;
    }

    // Update tracking
    this.lastProcessedMessageText = responseText;
    this.lastProcessedMessageTime = currentTime;

    // Restore send buttons when response is received
    const mainSendButton = document.getElementById("sendButton");
    if (mainSendButton && this.isCurrentlySending) {
      this.setSendButtonToSend(mainSendButton);
    }

    // Restore any edit send buttons
    const editSendButtons = document.querySelectorAll(
      '[id^="editSendButton_"]'
    );
    editSendButtons.forEach((button) => {
      if (button.classList.contains("stop-mode")) {
        this.setSendButtonToSend(button);
      }
    });

    const content = document.getElementById("aiContent");
    if (!content) {
      if ($DebugTestMode) {
        console.error("❌ aiContent element not found");
      }
      return;
    }

    // Remove empty state and hide thinking
    const emptyState = content.querySelector(".empty-state");
    if (emptyState) emptyState.remove();
    this.hideThinking();

    const message = document.createElement("div");
    const messageId = `msg_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    message.id = messageId;
    message.className = "message ai-response";
    message.dataset.messageId = messageId;
    message.dataset.version = data.version || 1;

    const hasFiles = responseData.has_files === true;
    const filesArray = responseData.files;
    const isValidFilesArray = Array.isArray(filesArray);
    const fileCount = isValidFilesArray ? filesArray.length : 0;

    if ($DebugTestMode) {
      console.log("🗂️ Processing files for display:", {
        hasFiles,
        isValidFilesArray,
        fileCount,
        filesArray: filesArray,
      });
    }

    // FIXED: Create message data object with proper file structure
    const msgData = {
      id: messageId,
      text: responseText,
      type: "ai",
      messageType: "AI Response",
      model: responseData.model_used || appState.selectedAIModel,
      timestamp: new Date().toISOString(),
      files: isValidFilesArray
        ? filesArray.map((file) => ({
            ...file,
            extension: file.extension || this.getFileExtension(file.filename),
          }))
        : [],
    };

    try {
      // FIXED: Use consistent createMessageHTML approach
      const shouldIncludeFiles = msgData.files && msgData.files.length > 0;
      message.innerHTML = this.createMessageHTML(msgData, shouldIncludeFiles);

      // FIXED: Setup click handlers for attachments
      if (shouldIncludeFiles) {
        setTimeout(() => {
          this.setupAttachmentClickHandlers(message, msgData.files);
        }, 10);
      }

      content.appendChild(message);
      content.scrollTop = content.scrollHeight;

      if ($DebugTestMode) {
        console.log("🗂️ ✅ AI response message created with attachments");
      }
    } catch (error) {
      if ($DebugTestMode) {
        console.error("🗂️ Error setting message innerHTML:", error);
      }
      // Fallback without files
      message.innerHTML = this.createMessageHTML(
        { ...msgData, files: [] },
        false
      );
      content.appendChild(message);
    }

    // CRITICAL: Get the correct parent message ID with version
    let parentMessageId = null;
    if ($DebugTestMode) {
      console.log(
        "getParentMessageId GETTING CALLED IN CREATE AI RESPONSE WITH FILES"
      );
    }
    if (typeof chatManager !== "undefined" && chatManager.currentSendContext) {
      if (
        chatManager.currentSendContext.isEdit &&
        chatManager.currentSendContext.explicitParentMessageId
      ) {
        // For edits, use the explicit parent with version
        parentMessageId =
          chatManager.currentSendContext.explicitParentMessageId;
      } else {
        // For normal messages, get parent normally
        parentMessageId = chatManager.getParentMessageId(messageId) || null;
      }
    } else {
      parentMessageId = chatManager.getParentMessageId(messageId) || null;
    }

    // CRITICAL: Create history entry with proper version tracking
    const historyEntry = {
      id: messageId,
      text: responseText,
      type: "ai",
      messageType: "AI Response",
      model: responseData.model_used || appState.selectedAIModel,
      timestamp: new Date().toISOString(),
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
      has_files: hasFiles,
      file_count: fileCount,
      version: version,
      conversation_id: appState.currentConversationId,
      parent_message_id: parentMessageId, // ← NOW USES THE FIXED PARENT ID
    };

    try {
      this.addMessageToHistory(historyEntry);

      appState.saveToStorage();

      if ($DebugTestMode) {
        console.log("🗂️ ✅ AI response with files saved to history:", {
          id: historyEntry.id,
          type: historyEntry.type,
          fileCount: historyEntry.files.length,
        });
      }
    } catch (error) {
      if ($DebugTestMode) {
        console.error("🗂️ ❌ Error saving to history:", error);
      }
    }
  },

  formatMessage: function (text, isAI = false) {
    if ($DebugTestMode) {
      console.log("Input text:", text);
      console.log("isAI flag:", isAI);
    }

    let formatted = text
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\n- /g, "\n• ")
      .replace(/\n/g, "<br>");

    if ($DebugTestMode) {
      console.log("After initial formatting:", formatted);
    }

    if (isAI) {
      if ($DebugTestMode) {
        console.log("Processing AI text, splitting into sentences...");
      }
      const sentences = formatted.split(/(?<=[.!?])\s+/);
      formatted = sentences
        .map(function (sentence, index) {
          if (sentence.trim()) {
            const escapedSentence = sentence
              .replace(/'/g, "\\'")
              .replace(/"/g, '\\"');
            if ($DebugTestMode) {
              console.log(
                `Sentence ${index + 1}:`,
                sentence,
                "Escaped:",
                escapedSentence
              );
            }
            return `<span class="hoverable-segment" data-sentence="${escapedSentence}">${sentence}</span>`;
          }
          return sentence;
        })
        .join(" ");
      if ($DebugTestMode) {
        console.log("Final AI formatted text:", formatted);
      }
    }

    return formatted;
  },

  // ENHANCED: Show thinking with minimum display time tracking
  showThinking: function () {
    const content = document.getElementById("aiContent");
    if ($DebugTestMode) {
      console.log("🤔 showThinking called, aiContent:", content);
    }

    if (!content) {
      if ($DebugTestMode) {
        console.error("❌ aiContent element not found!");
      }
      return;
    }

    const emptyState = content.querySelector(".empty-state");
    if (emptyState) emptyState.remove();

    const existingThinking = content.querySelector(".thinking");
    if (existingThinking) existingThinking.remove();

    const thinking = document.createElement("div");
    thinking.className = "thinking";
    thinking.innerHTML = ` 
    <div class="wave-bounce-container">
      <div class="bounce-item">
          <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="100 100 200 200"
          width="50"
          height="50"
          style="display: flex; position: relative"
        >
          <!-- Define the gradient -->
          <defs>
            <linearGradient
              id="blueGradient"
              x1="0%"
              y1="0%"
              x2="100%"
              y2="100%"
              gradientUnits="objectBoundingBox"
            >
              <stop offset="0%" style="stop-color: #4facfe; stop-opacity: 1" />
              <stop
                offset="100%"
                style="stop-color: #00f2fe; stop-opacity: 1"
              />
            </linearGradient>
          </defs>

          <!-- BLACK SVGs (underneath layer) -->
          <g transform="translate(200, 200)">
            <!-- First SVG: 19,151 x 19,151 with 22° rotation (largest, scaled to 191) -->
            <svg width="191" height="191" viewBox="0 0 256 256" x="-95" y="-95">
              <g transform="rotate(22 128 128)">
                <rect width="256" height="256" fill="none" />
                <path
                  d="M54.46,201.54c-9.2-9.2-3.1-28.53-7.78-39.85C41.82,150,24,140.5,24,128s17.82-22,22.68-33.69C51.36,83,45.26,63.66,54.46,54.46S83,51.36,94.31,46.68C106.05,41.82,115.5,24,128,24S150,41.82,161.69,46.68c11.32,4.68,30.65-1.42,39.85,7.78s3.1,28.53,7.78,39.85C214.18,106.05,232,115.5,232,128S214.18,150,209.32,161.69c-4.68,11.32,1.42,30.65-7.78,39.85s-28.53,3.1-39.85,7.78C150,214.18,140.5,232,128,232s-22-17.82-33.69-22.68C83,204.64,63.66,210.74,54.46,201.54Z"
                  fill="none"
                  stroke="white"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="8"
                />
              </g>
            </svg>

            <!-- Second SVG: 15,135 x 15,135 with no rotation (medium, scaled to 151) -->
            <svg width="151" height="151" viewBox="0 0 256 256" x="-75" y="-75">
              <rect width="256" height="256" fill="none" />
              <path
                d="M54.46,201.54c-9.2-9.2-3.1-28.53-7.78-39.85C41.82,150,24,140.5,24,128s17.82-22,22.68-33.69C51.36,83,45.26,63.66,54.46,54.46S83,51.36,94.31,46.68C106.05,41.82,115.5,24,128,24S150,41.82,161.69,46.68c11.32,4.68,30.65-1.42,39.85,7.78s3.1,28.53,7.78,39.85C214.18,106.05,232,115.5,232,128S214.18,150,209.32,161.69c-4.68,11.32,1.42,30.65-7.78,39.85s-28.53,3.1-39.85,7.78C150,214.18,140.5,232,128,232s-22-17.82-33.69-22.68C83,204.64,63.66,210.74,54.46,201.54Z"
                fill="none"
                stroke="white"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="8"
              />
            </svg>

            <!-- Third SVG: 11,808 x 11,808 with 22° rotation (smallest, scaled to 118) -->
            <svg width="118" height="118" viewBox="0 0 256 256" x="-59" y="-59">
              <g transform="rotate(22 128 128)">
                <rect width="256" height="256" fill="none" />
                <path
                  d="M54.46,201.54c-9.2-9.2-3.1-28.53-7.78-39.85C41.82,150,24,140.5,24,128s17.82-22,22.68-33.69C51.36,83,45.26,63.66,54.46,54.46S83,51.36,94.31,46.68C106.05,41.82,115.5,24,128,24S150,41.82,161.69,46.68c11.32,4.68,30.65-1.42,39.85,7.78s3.1,28.53,7.78,39.85C214.18,106.05,232,115.5,232,128S214.18,150,209.32,161.69c-4.68,11.32,1.42,30.65-7.78,39.85s-28.53,3.1-39.85,7.78C150,214.18,140.5,232,128,232s-22-17.82-33.69-22.68C83,204.64,63.66,210.74,54.46,201.54Z"
                  fill="none"
                  stroke="white"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="8"
                />
              </g>
            </svg>
          </g>

          <!-- COLORED SVGs (on top layer) -->
          <g transform="translate(200, 200)">
            <!-- First SVG: 19,151 x 19,151 with NO rotation (largest, scaled to 191) -->
            <svg width="191" height="191" viewBox="0 0 256 256" x="-95" y="-95">
              <rect width="256" height="256" fill="none" />
              <path
                d="M54.46,201.54c-9.2-9.2-3.1-28.53-7.78-39.85C41.82,150,24,140.5,24,128s17.82-22,22.68-33.69C51.36,83,45.26,63.66,54.46,54.46S83,51.36,94.31,46.68C106.05,41.82,115.5,24,128,24S150,41.82,161.69,46.68c11.32,4.68,30.65-1.42,39.85,7.78s3.1,28.53,7.78,39.85C214.18,106.05,232,115.5,232,128S214.18,150,209.32,161.69c-4.68,11.32,1.42,30.65-7.78,39.85s-28.53,3.1-39.85,7.78C150,214.18,140.5,232,128,232s-22-17.82-33.69-22.68C83,204.64,63.66,210.74,54.46,201.54Z"
                fill="none"
                stroke="url(#blueGradient)"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="8"
              />
            </svg>

            <!-- Second SVG: 15,135 x 15,135 with 22° rotation (medium, scaled to 151) -->
            <svg width="151" height="151" viewBox="0 0 256 256" x="-75" y="-75">
              <g transform="rotate(22 128 128)">
                <rect width="256" height="256" fill="none" />
                <path
                  d="M54.46,201.54c-9.2-9.2-3.1-28.53-7.78-39.85C41.82,150,24,140.5,24,128s17.82-22,22.68-33.69C51.36,83,45.26,63.66,54.46,54.46S83,51.36,94.31,46.68C106.05,41.82,115.5,24,128,24S150,41.82,161.69,46.68c11.32,4.68,30.65-1.42,39.85,7.78s3.1,28.53,7.78,39.85C214.18,106.05,232,115.5,232,128S214.18,150,209.32,161.69c-4.68,11.32,1.42,30.65-7.78,39.85s-28.53,3.1-39.85,7.78C150,214.18,140.5,232,128,232s-22-17.82-33.69-22.68C83,204.64,63.66,210.74,54.46,201.54Z"
                fill="none"
                stroke="url(#blueGradient)"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="8"
              />
              </g>
            </svg>

            <!-- Third SVG: 11,808 x 11,808 with NO rotation (smallest, scaled to 118) -->
            <svg width="118" height="118" viewBox="0 0 256 256" x="-59" y="-59">
              <rect width="256" height="256" fill="none" />
              <path
                d="M54.46,201.54c-9.2-9.2-3.1-28.53-7.78-39.85C41.82,150,24,140.5,24,128s17.82-22,22.68-33.69C51.36,83,45.26,63.66,54.46,54.46S83,51.36,94.31,46.68C106.05,41.82,115.5,24,128,24S150,41.82,161.69,46.68c11.32,4.68,30.65-1.42,39.85,7.78s3.1,28.53,7.78,39.85C214.18,106.05,232,115.5,232,128S214.18,150,209.32,161.69c-4.68,11.32,1.42,30.65-7.78,39.85s-28.53,3.1-39.85,7.78C150,214.18,140.5,232,128,232s-22-17.82-33.69-22.68C83,204.64,63.66,210.74,54.46,201.54Z"
                fill="none"
                stroke="url(#blueGradient)"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="8"
              />
            </svg>
          </g>
        </svg>
      </div>
      <div class="bounce-item">
          <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="100 100 200 200"
          width="50"
          height="50"
          style="display: flex; position: relative"
        >
          <!-- Define the gradient -->
          <defs>
            <linearGradient
              id="blueGradient"
              x1="0%"
              y1="0%"
              x2="100%"
              y2="100%"
              gradientUnits="objectBoundingBox"
            >
              <stop offset="0%" style="stop-color: #4facfe; stop-opacity: 1" />
              <stop
                offset="100%"
                style="stop-color: #00f2fe; stop-opacity: 1"
              />
            </linearGradient>
          </defs>

          <!-- BLACK SVGs (underneath layer) -->
          <g transform="translate(200, 200)">
            <!-- First SVG: 19,151 x 19,151 with 22° rotation (largest, scaled to 191) -->
            <svg width="191" height="191" viewBox="0 0 256 256" x="-95" y="-95">
              <g transform="rotate(22 128 128)">
                <rect width="256" height="256" fill="none" />
                <path
                  d="M54.46,201.54c-9.2-9.2-3.1-28.53-7.78-39.85C41.82,150,24,140.5,24,128s17.82-22,22.68-33.69C51.36,83,45.26,63.66,54.46,54.46S83,51.36,94.31,46.68C106.05,41.82,115.5,24,128,24S150,41.82,161.69,46.68c11.32,4.68,30.65-1.42,39.85,7.78s3.1,28.53,7.78,39.85C214.18,106.05,232,115.5,232,128S214.18,150,209.32,161.69c-4.68,11.32,1.42,30.65-7.78,39.85s-28.53,3.1-39.85,7.78C150,214.18,140.5,232,128,232s-22-17.82-33.69-22.68C83,204.64,63.66,210.74,54.46,201.54Z"
                  fill="none"
                  stroke="white"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="8"
                />
              </g>
            </svg>

            <!-- Second SVG: 15,135 x 15,135 with no rotation (medium, scaled to 151) -->
            <svg width="151" height="151" viewBox="0 0 256 256" x="-75" y="-75">
              <rect width="256" height="256" fill="none" />
              <path
                d="M54.46,201.54c-9.2-9.2-3.1-28.53-7.78-39.85C41.82,150,24,140.5,24,128s17.82-22,22.68-33.69C51.36,83,45.26,63.66,54.46,54.46S83,51.36,94.31,46.68C106.05,41.82,115.5,24,128,24S150,41.82,161.69,46.68c11.32,4.68,30.65-1.42,39.85,7.78s3.1,28.53,7.78,39.85C214.18,106.05,232,115.5,232,128S214.18,150,209.32,161.69c-4.68,11.32,1.42,30.65-7.78,39.85s-28.53,3.1-39.85,7.78C150,214.18,140.5,232,128,232s-22-17.82-33.69-22.68C83,204.64,63.66,210.74,54.46,201.54Z"
                fill="none"
                stroke="white"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="8"
              />
            </svg>

            <!-- Third SVG: 11,808 x 11,808 with 22° rotation (smallest, scaled to 118) -->
            <svg width="118" height="118" viewBox="0 0 256 256" x="-59" y="-59">
              <g transform="rotate(22 128 128)">
                <rect width="256" height="256" fill="none" />
                <path
                  d="M54.46,201.54c-9.2-9.2-3.1-28.53-7.78-39.85C41.82,150,24,140.5,24,128s17.82-22,22.68-33.69C51.36,83,45.26,63.66,54.46,54.46S83,51.36,94.31,46.68C106.05,41.82,115.5,24,128,24S150,41.82,161.69,46.68c11.32,4.68,30.65-1.42,39.85,7.78s3.1,28.53,7.78,39.85C214.18,106.05,232,115.5,232,128S214.18,150,209.32,161.69c-4.68,11.32,1.42,30.65-7.78,39.85s-28.53,3.1-39.85,7.78C150,214.18,140.5,232,128,232s-22-17.82-33.69-22.68C83,204.64,63.66,210.74,54.46,201.54Z"
                  fill="none"
                  stroke="white"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="8"
                />
              </g>
            </svg>
          </g>

          <!-- COLORED SVGs (on top layer) -->
          <g transform="translate(200, 200)">
            <!-- First SVG: 19,151 x 19,151 with NO rotation (largest, scaled to 191) -->
            <svg width="191" height="191" viewBox="0 0 256 256" x="-95" y="-95">
              <rect width="256" height="256" fill="none" />
              <path
                d="M54.46,201.54c-9.2-9.2-3.1-28.53-7.78-39.85C41.82,150,24,140.5,24,128s17.82-22,22.68-33.69C51.36,83,45.26,63.66,54.46,54.46S83,51.36,94.31,46.68C106.05,41.82,115.5,24,128,24S150,41.82,161.69,46.68c11.32,4.68,30.65-1.42,39.85,7.78s3.1,28.53,7.78,39.85C214.18,106.05,232,115.5,232,128S214.18,150,209.32,161.69c-4.68,11.32,1.42,30.65-7.78,39.85s-28.53,3.1-39.85,7.78C150,214.18,140.5,232,128,232s-22-17.82-33.69-22.68C83,204.64,63.66,210.74,54.46,201.54Z"
                fill="none"
                stroke="url(#blueGradient)"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="8"
              />
            </svg>

            <!-- Second SVG: 15,135 x 15,135 with 22° rotation (medium, scaled to 151) -->
            <svg width="151" height="151" viewBox="0 0 256 256" x="-75" y="-75">
              <g transform="rotate(22 128 128)">
                <rect width="256" height="256" fill="none" />
                <path
                  d="M54.46,201.54c-9.2-9.2-3.1-28.53-7.78-39.85C41.82,150,24,140.5,24,128s17.82-22,22.68-33.69C51.36,83,45.26,63.66,54.46,54.46S83,51.36,94.31,46.68C106.05,41.82,115.5,24,128,24S150,41.82,161.69,46.68c11.32,4.68,30.65-1.42,39.85,7.78s3.1,28.53,7.78,39.85C214.18,106.05,232,115.5,232,128S214.18,150,209.32,161.69c-4.68,11.32,1.42,30.65-7.78,39.85s-28.53,3.1-39.85,7.78C150,214.18,140.5,232,128,232s-22-17.82-33.69-22.68C83,204.64,63.66,210.74,54.46,201.54Z"
                fill="none"
                stroke="url(#blueGradient)"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="8"
              />
              </g>
            </svg>

            <!-- Third SVG: 11,808 x 11,808 with NO rotation (smallest, scaled to 118) -->
            <svg width="118" height="118" viewBox="0 0 256 256" x="-59" y="-59">
              <rect width="256" height="256" fill="none" />
              <path
                d="M54.46,201.54c-9.2-9.2-3.1-28.53-7.78-39.85C41.82,150,24,140.5,24,128s17.82-22,22.68-33.69C51.36,83,45.26,63.66,54.46,54.46S83,51.36,94.31,46.68C106.05,41.82,115.5,24,128,24S150,41.82,161.69,46.68c11.32,4.68,30.65-1.42,39.85,7.78s3.1,28.53,7.78,39.85C214.18,106.05,232,115.5,232,128S214.18,150,209.32,161.69c-4.68,11.32,1.42,30.65-7.78,39.85s-28.53,3.1-39.85,7.78C150,214.18,140.5,232,128,232s-22-17.82-33.69-22.68C83,204.64,63.66,210.74,54.46,201.54Z"
                fill="none"
                stroke="url(#blueGradient)"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="8"
              />
            </svg>
          </g>
        </svg>
      </div>
      <div class="bounce-item">
       <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="100 100 200 200"
          width="50"
          height="50"
          style="display: flex; position: relative"
        >
          <!-- Define the gradient -->
          <defs>
            <linearGradient
              id="blueGradient"
              x1="0%"
              y1="0%"
              x2="100%"
              y2="100%"
              gradientUnits="objectBoundingBox"
            >
              <stop offset="0%" style="stop-color: #4facfe; stop-opacity: 1" />
              <stop
                offset="100%"
                style="stop-color: #00f2fe; stop-opacity: 1"
              />
            </linearGradient>
          </defs>

          <!-- BLACK SVGs (underneath layer) -->
          <g transform="translate(200, 200)">
            <!-- First SVG: 19,151 x 19,151 with 22° rotation (largest, scaled to 191) -->
            <svg width="191" height="191" viewBox="0 0 256 256" x="-95" y="-95">
              <g transform="rotate(22 128 128)">
                <rect width="256" height="256" fill="none" />
                <path
                  d="M54.46,201.54c-9.2-9.2-3.1-28.53-7.78-39.85C41.82,150,24,140.5,24,128s17.82-22,22.68-33.69C51.36,83,45.26,63.66,54.46,54.46S83,51.36,94.31,46.68C106.05,41.82,115.5,24,128,24S150,41.82,161.69,46.68c11.32,4.68,30.65-1.42,39.85,7.78s3.1,28.53,7.78,39.85C214.18,106.05,232,115.5,232,128S214.18,150,209.32,161.69c-4.68,11.32,1.42,30.65-7.78,39.85s-28.53,3.1-39.85,7.78C150,214.18,140.5,232,128,232s-22-17.82-33.69-22.68C83,204.64,63.66,210.74,54.46,201.54Z"
                  fill="none"
                  stroke="white"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="8"
                />
              </g>
            </svg>

            <!-- Second SVG: 15,135 x 15,135 with no rotation (medium, scaled to 151) -->
            <svg width="151" height="151" viewBox="0 0 256 256" x="-75" y="-75">
              <rect width="256" height="256" fill="none" />
              <path
                d="M54.46,201.54c-9.2-9.2-3.1-28.53-7.78-39.85C41.82,150,24,140.5,24,128s17.82-22,22.68-33.69C51.36,83,45.26,63.66,54.46,54.46S83,51.36,94.31,46.68C106.05,41.82,115.5,24,128,24S150,41.82,161.69,46.68c11.32,4.68,30.65-1.42,39.85,7.78s3.1,28.53,7.78,39.85C214.18,106.05,232,115.5,232,128S214.18,150,209.32,161.69c-4.68,11.32,1.42,30.65-7.78,39.85s-28.53,3.1-39.85,7.78C150,214.18,140.5,232,128,232s-22-17.82-33.69-22.68C83,204.64,63.66,210.74,54.46,201.54Z"
                fill="none"
                stroke="white"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="8"
              />
            </svg>

            <!-- Third SVG: 11,808 x 11,808 with 22° rotation (smallest, scaled to 118) -->
            <svg width="118" height="118" viewBox="0 0 256 256" x="-59" y="-59">
              <g transform="rotate(22 128 128)">
                <rect width="256" height="256" fill="none" />
                <path
                  d="M54.46,201.54c-9.2-9.2-3.1-28.53-7.78-39.85C41.82,150,24,140.5,24,128s17.82-22,22.68-33.69C51.36,83,45.26,63.66,54.46,54.46S83,51.36,94.31,46.68C106.05,41.82,115.5,24,128,24S150,41.82,161.69,46.68c11.32,4.68,30.65-1.42,39.85,7.78s3.1,28.53,7.78,39.85C214.18,106.05,232,115.5,232,128S214.18,150,209.32,161.69c-4.68,11.32,1.42,30.65-7.78,39.85s-28.53,3.1-39.85,7.78C150,214.18,140.5,232,128,232s-22-17.82-33.69-22.68C83,204.64,63.66,210.74,54.46,201.54Z"
                  fill="none"
                  stroke="white"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="8"
                />
              </g>
            </svg>
          </g>

          <!-- COLORED SVGs (on top layer) -->
          <g transform="translate(200, 200)">
            <!-- First SVG: 19,151 x 19,151 with NO rotation (largest, scaled to 191) -->
            <svg width="191" height="191" viewBox="0 0 256 256" x="-95" y="-95">
              <rect width="256" height="256" fill="none" />
              <path
                d="M54.46,201.54c-9.2-9.2-3.1-28.53-7.78-39.85C41.82,150,24,140.5,24,128s17.82-22,22.68-33.69C51.36,83,45.26,63.66,54.46,54.46S83,51.36,94.31,46.68C106.05,41.82,115.5,24,128,24S150,41.82,161.69,46.68c11.32,4.68,30.65-1.42,39.85,7.78s3.1,28.53,7.78,39.85C214.18,106.05,232,115.5,232,128S214.18,150,209.32,161.69c-4.68,11.32,1.42,30.65-7.78,39.85s-28.53,3.1-39.85,7.78C150,214.18,140.5,232,128,232s-22-17.82-33.69-22.68C83,204.64,63.66,210.74,54.46,201.54Z"
                fill="none"
                stroke="url(#blueGradient)"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="8"
              />
            </svg>

            <!-- Second SVG: 15,135 x 15,135 with 22° rotation (medium, scaled to 151) -->
            <svg width="151" height="151" viewBox="0 0 256 256" x="-75" y="-75">
              <g transform="rotate(22 128 128)">
                <rect width="256" height="256" fill="none" />
                <path
                  d="M54.46,201.54c-9.2-9.2-3.1-28.53-7.78-39.85C41.82,150,24,140.5,24,128s17.82-22,22.68-33.69C51.36,83,45.26,63.66,54.46,54.46S83,51.36,94.31,46.68C106.05,41.82,115.5,24,128,24S150,41.82,161.69,46.68c11.32,4.68,30.65-1.42,39.85,7.78s3.1,28.53,7.78,39.85C214.18,106.05,232,115.5,232,128S214.18,150,209.32,161.69c-4.68,11.32,1.42,30.65-7.78,39.85s-28.53,3.1-39.85,7.78C150,214.18,140.5,232,128,232s-22-17.82-33.69-22.68C83,204.64,63.66,210.74,54.46,201.54Z"
                fill="none"
                stroke="url(#blueGradient)"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="8"
              />
              </g>
            </svg>

            <!-- Third SVG: 11,808 x 11,808 with NO rotation (smallest, scaled to 118) -->
            <svg width="118" height="118" viewBox="0 0 256 256" x="-59" y="-59">
              <rect width="256" height="256" fill="none" />
              <path
                d="M54.46,201.54c-9.2-9.2-3.1-28.53-7.78-39.85C41.82,150,24,140.5,24,128s17.82-22,22.68-33.69C51.36,83,45.26,63.66,54.46,54.46S83,51.36,94.31,46.68C106.05,41.82,115.5,24,128,24S150,41.82,161.69,46.68c11.32,4.68,30.65-1.42,39.85,7.78s3.1,28.53,7.78,39.85C214.18,106.05,232,115.5,232,128S214.18,150,209.32,161.69c-4.68,11.32,1.42,30.65-7.78,39.85s-28.53,3.1-39.85,7.78C150,214.18,140.5,232,128,232s-22-17.82-33.69-22.68C83,204.64,63.66,210.74,54.46,201.54Z"
                fill="none"
                stroke="url(#blueGradient)"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="8"
              />
            </svg>
          </g>
        </svg>
      </div>
    </div>
  `;
    content.appendChild(thinking);
    content.scrollTop = content.scrollHeight;

    // Record when we started showing the thinking indicator
    this.thinkingStartTime = Date.now();

    if ($DebugTestMode) {
      console.log(
        "🤔 Thinking indicator shown at",
        new Date(this.thinkingStartTime).toISOString()
      );
    }
  },

  hideThinking: function (force = false) {
    const thinking = document.querySelector(".thinking");
    if (!thinking) {
      if ($DebugTestMode) {
        console.log("🤔 No thinking indicator to hide");
      }
      return;
    }

    // IF FORCE IS TRUE, HIDE IMMEDIATELY
    if (force) {
      thinking.remove();
      if ($DebugTestMode) {
        console.log("🤔 Thinking indicator force hidden");
      }
      this.thinkingStartTime = null;
      return;
    }

    // Don't hide thinking during retry unless explicitly forced
    if (this.isRetrying) {
      if ($DebugTestMode) {
        console.log("🤔 Preventing thinking hide during retry");
      }
      return;
    }

    const elapsedTime = this.thinkingStartTime
      ? Date.now() - this.thinkingStartTime
      : 0;
    const remainingTime = Math.max(0, this.minimumThinkingTime - elapsedTime);

    if (remainingTime > 0) {
      setTimeout(() => {
        const thinkingElement = document.querySelector(".thinking");
        if (thinkingElement && !this.isRetrying) {
          thinkingElement.remove();
        }
      }, remainingTime);
    } else {
      thinking.remove();
    }

    this.thinkingStartTime = null;
  },

  // ✅ NEW: Function to clear retry state when response starts
  onResponseStart: function () {
    if (this.isRetrying) {
      if ($DebugTestMode) {
        console.log("🤔 Response started, clearing retry state");
      }
      this.isRetrying = false;
    }
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

  updateAttachmentContainer: function (messageId) {
    if ($DebugTestMode) {
      console.log("📎 === UPDATING ATTACHMENT CONTAINER (EDIT MODE) ===");
      console.log("📎 Message ID:", messageId);
    }

    // ✅ FIX: Always find the correct message context
    let contextElement = null;
    if (messageId) {
      const currentVersion = this.getDataVersion(messageId);

      contextElement = document.querySelector(
        `[data-message-id="${messageId}"][data-version="${currentVersion}"]`
      );
      if ($DebugTestMode) {
        console.log("📎 Found message context:", !!contextElement);
      }
    }

    if (!contextElement && this.editingMessageId) {
      contextElement = document.getElementById(this.editingMessageId);
      if ($DebugTestMode) {
        console.log("📎 Using editingMessageId context:", !!contextElement);
      }
    }

    if (!contextElement) {
      if ($DebugTestMode) {
        console.error("📎 ❌ Could not find message context element");
      }
      return null;
    }

    // ✅ FIX: Look for existing attachment container at the MESSAGE LEVEL (not inside edit interface)
    let container = contextElement.querySelector(".attachment-previews");

    if ($DebugTestMode) {
      console.log("📎 Found existing container at message level:", !!container);
    }

    if (!container) {
      // Create container at message level (before message-wrapper)
      container = document.createElement("div");
      container.className = "attachment-previews";
      container.style.display = "flex";
      container.style.flexWrap = "wrap";
      container.style.gap = "10px";
      container.style.marginLeft = "0px";
      container.style.marginBottom = "10px";

      // Insert at the beginning of the message (before message-wrapper)
      const messageWrapper = contextElement.querySelector(".message-wrapper");
      if (messageWrapper) {
        contextElement.insertBefore(container, messageWrapper);
        if ($DebugTestMode) {
          console.log("📎 Created new container at message level");
        }
      } else {
        // Fallback: insert at beginning of message
        contextElement.insertBefore(container, contextElement.firstChild);
        if ($DebugTestMode) {
          console.log("📎 Created new container at message beginning");
        }
      }
    }

    // ✅ FIX: Count attachments in the existing container
    const currentAttachments = container.querySelectorAll(
      ".attachment-item, .attachment-preview"
    );
    const attachmentCount = currentAttachments.length;

    if (attachmentCount > 0) {
      container.style.display = "flex";
      if ($DebugTestMode) {
        console.log(`📎 Container visible with ${attachmentCount} attachments`);
      }
    } else {
      container.style.display = "none";
      if ($DebugTestMode) {
        console.log("📎 Container hidden - no attachments");
      }
    }

    return container;
  },

  addAttachmentToContainer: function (attachment, messageId) {
    if ($DebugTestMode) {
      console.log("📎 === ADDING ATTACHMENT TO CONTAINER (EDIT MODE) ===");
      console.log("📎 Attachment:", attachment);
      console.log("📎 Attachment ID:", attachment.id);
      console.log("📎 Attachment type:", attachment.type);
      console.log("📎 Attachment content length:", attachment.content?.length);
      console.log("📎 Message ID:", messageId);
    }

    // ✅ CRITICAL: Validate attachment object first
    if (!attachment || !attachment.id) {
      if ($DebugTestMode) {
        console.error("📎 ❌ Invalid attachment object - missing ID");
        console.error("📎 Attachment object:", attachment);
      }
      return;
    }

    // ✅ FIX: Get the correct container for this specific message
    const container = this.updateAttachmentContainer(
      messageId || this.editingMessageId
    );

    if (!container) {
      if ($DebugTestMode) {
        console.error("📎 ❌ Could not find attachment container");
      }
      return;
    }

    if ($DebugTestMode) {
      console.log("📎 Valid container found:", container);
    }

    // ✅ CHECK: Don't add if attachment already exists
    const existingAttachment = container.querySelector(
      `[data-attachment-id="${attachment.id}"]`
    );
    if (existingAttachment) {
      if ($DebugTestMode) {
        console.log("📎 Attachment already exists, skipping:", attachment.id);
      }
      return existingAttachment;
    }

    try {
      // ✅ FIX: Create attachment element manually to ensure proper structure
      const attachmentElement = document.createElement("div");
      attachmentElement.className = `attachment-item ${attachment.type}`;
      attachmentElement.id = `attachment_${attachment.id}`;
      attachmentElement.setAttribute("data-attachment-id", attachment.id);
      attachmentElement.setAttribute("data-file-name-id", attachment.filename);
      attachmentElement.style.cssText = `
      padding-top: 0px !important;
      margin-left: 0px !important;
      position: relative;
    `;

      // ✅ FIX: Create proper content preview
      const content = attachment.content || "";
      const contentPreview =
        content.length > 1000 ? content.substring(0, 1000) + "..." : content;

      attachmentElement.innerHTML = `
      <div class="attachment-preview" onclick="messageManager.enlargeAttachment('${
        attachment.id
      }')">
        <div class="attachment-content">
          <code>${this.escapeHtml(contentPreview)}</code>
        </div>
      </div>
    `;

      if ($DebugTestMode) {
        console.log("📎 Created attachment element with ID:", attachment.id);
        console.log(
          "📎 Onclick will call: messageManager.enlargeAttachment('" +
            attachment.id +
            "')"
        );
      }

      // Add custom remove button
      const copyBtn = document.createElement("button");
      copyBtn.className = "copy-attachment";
      copyBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>`;
      copyBtn.title = "copy attachment";
      copyBtn.style.cssText = `
      position: absolute;
      top: 5px;
      left: 5px;
      background: rgba(249, 249, 249, 0.8);
      color: black;
      border: none;
      border-radius: 50%;
      width: 20px;
      height: 20px;
      font-size: 12px;
      cursor: pointer;
      z-index: 1000;
    `;

      // Add custom remove button
      const removeBtn = document.createElement("button");
      removeBtn.className = "remove-attachment";
      removeBtn.innerHTML = "✕";
      removeBtn.title = "Remove attachment";
      removeBtn.style.cssText = `
      position: absolute;
      top: 5px;
      right: 5px;
      background: rgba(255, 0, 0, 0.8);
      color: white;
      border: none;
      border-radius: 50%;
      width: 20px;
      height: 20px;
      font-size: 12px;
      cursor: pointer;
      z-index: 1000;
    `;

      const self = this;
      removeBtn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        if ($DebugTestMode) {
          console.log("🗑️ Remove clicked for:", attachment.id);
        }
        self.removeAttachment(
          attachment.id,
          messageId || self.editingMessageId
        );
      });

      copyBtn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        if ($DebugTestMode) {
          console.log("copyBtn clicked for:", attachment.id);
        }
        self.copySentAttachmentOrEditAttachment(
          attachment.id,
          attachment.filename,
          messageId || self.editingMessageId
        );
      });

      attachmentElement.appendChild(removeBtn);
      attachmentElement.appendChild(copyBtn);

      // Add to container
      container.appendChild(attachmentElement);
      container.style.display = "flex";

      if ($DebugTestMode) {
        console.log("📎 ✅ Attachment added successfully");
      }

      return attachmentElement;
    } catch (error) {
      if ($DebugTestMode) {
        console.error("📎 ❌ Error adding attachment:", error);
        console.error("📎 Error stack:", error.stack);
      }
    }
  },

  getFileExtension: function (filename) {
    if (!filename) return "";
    const parts = filename.split(".");
    return parts.length > 1 ? "." + parts[parts.length - 1] : "";
  },

  getFileIcon: function (attachment, filename = null) {
    const ext =
      attachment.extension ||
      this.getFileExtension(attachment.filename || filename);

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

  escapeHtml: function (text) {
    if ($DebugTestMode) {
      console.log("Input text:", text); // Log the input text
      console.log("Created div element:", document.createElement("div")); // Log the created div element
    }
    if (!text) return "";
    const div = document.createElement("div");
    div.textContent = text;
    const result = div.innerHTML;
    if ($DebugTestMode) {
      console.log("Escaped HTML output:", result); // Log the final output
    }
    return result;
  },

  formatFileSize: function (bytes) {
    if (!bytes) return "0 B";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + " KB";
    return Math.round(bytes / (1024 * 1024)) + " MB";
  },

  removeAttachment: function (attachmentId, messageId) {
    if ($DebugTestMode) {
      console.log("🗑️ Removing attachment (EDIT MODE):", attachmentId);
      console.log("🗑️ Message ID:", messageId);
    }

    // ✅ SOLUTION: Find the message element to scope our search
    let contextElement = null;
    if (messageId) {
      const currentVersion = this.getDataVersion(messageId);

      contextElement = document.querySelector(
        `[data-message-id="${messageId}"][data-version="${currentVersion}"]`
      );
    }

    // Find and remove the attachment element from DOM
    let element = null;
    if (contextElement) {
      element = contextElement.querySelector(
        `[data-attachment-id="${attachmentId}"]`
      );
    }
    if (!element) {
      element = document.querySelector(
        `[data-attachment-id="${attachmentId}"]`
      );
    }

    if (element) {
      element.remove();
      if ($DebugTestMode) {
        console.log("🗑️ Removed attachment element from DOM");
      }
    } else {
      if ($DebugTestMode) {
        console.warn("🗑️ Attachment element not found in DOM:", attachmentId);
      }
    }

    // Update the container display
    this.updateAttachmentContainer(contextElement);
    this.updateInputPlaceholder(contextElement);

    this.removeIndividualFromEditAttachments(attachmentId);

    // ✅ SOLUTION: Check DOM for remaining attachments instead of array
    const container = contextElement
      ? contextElement.querySelector(".attachment-previews")
      : document.querySelector(".attachment-previews");

    if (container) {
      const remainingAttachments =
        container.querySelectorAll(".attachment-item");
      if (remainingAttachments.length === 0) {
        container.style.display = "none";
        if ($DebugTestMode) {
          console.log("🗑️ Container hidden - no attachments remaining");
        }
      }
    }
  },

  copySentAttachmentOrEditAttachment: async function (
    attachmentId,
    fileName,
    messageId
  ) {
    if ($DebugTestMode) {
      console.log("📋 Starting copy history attachment to clipboard");
      console.log("📋 attachmentId:", attachmentId);
      console.log("📋 fileName:", fileName);
      console.log("📋 messageId:", messageId);
    }

    let contentToCopy = null;

    // First try to get it from this.editAttachments
    if ($DebugTestMode) {
      console.log(
        "🔍 Checking this.editAttachments exists:",
        !!this.editAttachments
      );
      console.log("🔍 this.editAttachments type:", typeof this.editAttachments);
      console.log("🔍 this.editAttachments value:", this.editAttachments);
    }

    if (this.editAttachments && Array.isArray(this.editAttachments)) {
      const attachment = this.editAttachments.find(
        (att) => att.id === attachmentId
      );

      if (attachment && attachment.content) {
        if ($DebugTestMode) {
          console.log(
            "✅ Found attachment in editAttachments with content:",
            attachment.filename
          );
        }
        contentToCopy = attachment.content;
      } else {
        if ($DebugTestMode) {
          console.log(
            "⚠️ Attachment found in editAttachments but no content, will fallback to getFile"
          );
        }
      }
    } else {
      if ($DebugTestMode) {
        console.log(
          "⚠️ No editAttachments array found, will fallback to getFile"
        );
      }
    }

    // Fallback: use historyManager.getFile
    if (!contentToCopy) {
      try {
        if ($DebugTestMode) {
          console.log(
            "📂 Fallback: Calling historyManager.getFile with:",
            fileName,
            appState.currentConversationId
          );
        }

        const fileData = await historyManager.getFile(
          fileName,
          appState.currentConversationId
        );

        if (!fileData) {
          if ($DebugTestMode) {
            console.log("❌ Failed to get file data from historyManager");
          }
          return false;
        }

        if ($DebugTestMode) {
          console.log("📦 File data received from historyManager:", fileData);
        }

        let parsedContent;

        // Check if fileData is a JSON string that needs parsing
        if (typeof fileData === "string") {
          try {
            parsedContent = JSON.parse(fileData);
            if ($DebugTestMode) {
              console.log(
                "✅ Successfully parsed JSON string from historyManager"
              );
            }
          } catch (parseError) {
            if ($DebugTestMode) {
              console.log(
                "⚠️ File data is string but not JSON, using as raw content"
              );
            }
            contentToCopy = fileData;
            if ($DebugTestMode) {
              console.log(
                "✅ Using raw string content from historyManager, length:",
                contentToCopy.length
              );
            }
          }
        } else {
          // If it's already an object, use it directly
          parsedContent = fileData;
          if ($DebugTestMode) {
            console.log("✅ Using object data directly from historyManager");
          }
        }

        // If we have parsed content, extract the actual file content
        if (parsedContent) {
          if (parsedContent.content) {
            // If the parsed object has a content property
            contentToCopy = this.constructFileContent(parsedContent.content);
            if ($DebugTestMode) {
              console.log(
                "✅ Constructed file content from parsed data, length:",
                contentToCopy.length
              );
            }
          } else {
            // If the parsed object doesn't have content property, use the whole object
            contentToCopy = this.constructFileContent(parsedContent);
            if ($DebugTestMode) {
              console.log(
                "✅ Constructed content from full parsed object, length:",
                contentToCopy.length
              );
            }
          }
        }
      } catch (error) {
        if ($DebugTestMode) {
          console.error("❌ Failed to get file from historyManager:", error);
        }
        return false;
      }
    }

    try {
      // Copy the content to clipboard
      navigator.clipboard
        .writeText(contentToCopy)
        .then(() => {
          if ($DebugTestMode) {
            console.log("📋 Successfully copied to clipboard:", fileName);
          }

          // Optional: Show a toast or notification
          if (window.showToast) {
            window.showToast(`Copied ${fileName} to clipboard`);
          }
        })
        .catch((err) => {
          if ($DebugTestMode) {
            console.error("❌ Failed to copy to clipboard:", err);
          }

          // Fallback method for older browsers
          const textArea = document.createElement("textarea");
          textArea.value = contentToCopy;
          document.body.appendChild(textArea);
          textArea.select();
          document.execCommand("copy");
          document.body.removeChild(textArea);

          if ($DebugTestMode) {
            console.log("📋 Copied using fallback method");
          }
        });

      return true;
    } catch (error) {
      if ($DebugTestMode) {
        console.error("❌ Copy history attachment operation failed:", error);
      }
      return false;
    }
  },

  // Clear all attachments (simplified - no chatInputManager dependency)
  clearAllAttachments: function (contextElement) {
    if ($DebugTestMode) {
      console.log("🧹 === CLEARING ALL ATTACHMENTS (MESSAGE) ===");
      console.log("🧹 Context element:", contextElement);
    }

    // Find and clear container within context
    const container = contextElement
      ? contextElement.querySelector(".attachment-previews")
      : document.querySelector(".attachment-previews");

    if (container) {
      container.style.display = "none";
      container.innerHTML = ""; // Clear all child elements
      if ($DebugTestMode) {
        console.log("🧹 ✅ Container hidden and cleared");
      }
    }

    // Remove old-style preview if it exists (backward compatibility)
    const oldPreview = contextElement
      ? contextElement.querySelector("#screenshotPreview")
      : document.getElementById("screenshotPreview");
    if (oldPreview) {
      oldPreview.remove();
      if ($DebugTestMode) {
        console.log("🧹 Removed old-style preview");
      }
    }

    // Reset input placeholder
    this.updateInputPlaceholder(contextElement);

    if ($DebugTestMode) {
      console.log("🧹 === CLEARING COMPLETE ===");
    }
  },

  updateInputPlaceholder: function (messageId) {
    let chatInput = null;

    // ✅ FIX: Find the correct textarea for this message
    if (messageId) {
      chatInput = document.getElementById(`edit_${messageId}`);
    }

    if (!chatInput && this.editingMessageId) {
      chatInput = document.getElementById(`edit_${this.editingMessageId}`);
    }

    if (!chatInput) {
      chatInput = document.querySelector(".message-edit-input");
    }

    if (!chatInput) {
      if ($DebugTestMode) {
        console.warn("💬 No edit input found for placeholder update");
      }
      return;
    }

    const currentVersion = this.getDataVersion(messageId);

    // ✅ FIX: Count attachments in the correct container
    const contextElement = messageId
      ? document.querySelector(
          `[data-message-id="${messageId}"][data-version="${currentVersion}"]`
        )
      : this.editingMessageId
      ? document.getElementById(this.editingMessageId)
      : null;

    let attachmentCount = 0;
    if (contextElement) {
      const container = contextElement.querySelector(".attachment-previews");
      if (container) {
        attachmentCount = container.querySelectorAll(".attachment-item").length;
      }
    }

    if (attachmentCount > 0) {
      chatInput.placeholder = `Attachments ready (${attachmentCount}) - add your message...`;
    } else {
      chatInput.placeholder = "Edit your message...";
    }

    if ($DebugTestMode) {
      console.log("💬 Updated input placeholder for edit mode");
    }
  },

  hideResponsesForVersion: function (messageId, version) {
    if ($DebugTestMode) {
      console.log(
        `Hiding responses for message ID: ${messageId}, version: ${version}`
      );
    }

    // Find the specific message element with the given ID and version
    const targetMessageEl = document.querySelector(
      `[data-message-id="${messageId}"][data-version="${version}"]`
    );

    if (!targetMessageEl) {
      if ($DebugTestMode) {
        console.warn(
          `Message with ID ${messageId} and version ${version} not found`
        );
      }
      return;
    }

    if ($DebugTestMode) {
      console.log("Target message found:", targetMessageEl);
    }

    // Get the container that holds all messages
    const container =
      targetMessageEl.closest("#aiContent") || targetMessageEl.parentElement;

    if (!container) {
      if ($DebugTestMode) {
        console.warn("Could not find message container");
      }
      return;
    }

    // Get all message elements in the container
    const allMessages = container.querySelectorAll(".message");
    if ($DebugTestMode) {
      console.log(`Total messages found: ${allMessages.length}`);
    }

    // Find the index of the target message in the DOM
    let targetIndex = -1;
    for (let i = 0; i < allMessages.length; i++) {
      if (allMessages[i] === targetMessageEl) {
        targetIndex = i;
        break;
      }
    }

    if (targetIndex === -1) {
      if ($DebugTestMode) {
        console.warn("Could not find target message in container");
      }
      return;
    }

    if ($DebugTestMode) {
      console.log(`Target message index: ${targetIndex}`);
    }

    // Hide all messages that come after the target message in the DOM
    let hiddenCount = 0;
    for (let i = targetIndex + 1; i < allMessages.length; i++) {
      const messageEl = allMessages[i];
      const messageId = messageEl.getAttribute("data-message-id");
      const messageVersion = messageEl.getAttribute("data-version");

      if ($DebugTestMode) {
        console.log(
          `Checking message at index ${i}: ID=${messageId}, version=${messageVersion}, currently visible=${
            messageEl.style.display !== "none"
          }`
        );
      }

      // Only hide if it's currently visible (not already hidden)
      if (messageEl.style.display !== "none") {
        messageEl.style.display = "none";
        hiddenCount++;
        if ($DebugTestMode) {
          console.log(
            `Hidden message at index ${i}: ID=${messageId}, version=${messageVersion}`
          );
        }
      }
    }

    if ($DebugTestMode) {
      console.log(`Total messages hidden: ${hiddenCount}`);
    }
  },

  createAttachmentContainer: function (contextElement) {
    const container = document.createElement("div");
    container.className = "attachment-previews";
    container.style.display = "none"; // Hidden by default

    // Insert into context element
    if (contextElement) {
      if (contextElement.firstChild) {
        contextElement.insertBefore(container, contextElement.firstChild);
      } else {
        contextElement.appendChild(container);
      }
    }

    return container;
  },

  // Find attachment data from various sources (no chatInputManager dependency)
  findAttachmentData: function (attachmentId) {
    if ($DebugTestMode) {
      console.log("🔍 Looking for attachment data:", attachmentId);
    }

    // Try to get from DOM element attributes (fallback)
    const attachmentElement = document.querySelector(
      `[data-attachment-id="${attachmentId}"]`
    );
    if (attachmentElement) {
      try {
        // Try to extract data from stored attributes or content
        const filename =
          attachmentElement.dataset.filename ||
          attachmentElement.dataset.fileNameId ||
          "unknown_file";
        const content =
          attachmentElement.querySelector(".attachment-content code")
            ?.textContent || "";

        // Find the message ID by traversing up the DOM tree
        let messageId = null;
        let currentElement = attachmentElement;

        // Look for common message container patterns
        while (currentElement && currentElement !== document.body) {
          // Check for message ID in various possible formats
          if (currentElement.id && currentElement.id.includes("message")) {
            messageId = currentElement.id;
            break;
          }

          // Check for data attributes that might contain message ID
          if (currentElement.dataset.messageId) {
            messageId = currentElement.dataset.messageId;
            break;
          }

          // Check for common message container classes
          if (
            currentElement.classList.contains("message") ||
            currentElement.classList.contains("message-item") ||
            currentElement.classList.contains("chat-message")
          ) {
            messageId = currentElement.id || currentElement.dataset.id;
            break;
          }

          currentElement = currentElement.parentElement;
        }

        // If no specific message ID found, try to extract from attachment ID
        // (assuming pattern like "large_content_1_1755180242798" where middle number might be message related)
        if (!messageId && attachmentId.includes("_")) {
          const parts = attachmentId.split("_");
          if (parts.length >= 3) {
            // Try to construct a potential message ID from the attachment ID pattern
            messageId = `message_${parts[2]}` || `msg_${parts[1]}_${parts[2]}`;
          }
        }

        if ($DebugTestMode) {
          console.log("🔍 Found basic data from DOM element");
          console.log("📧 Associated message ID:", messageId);
        }

        return {
          id: attachmentId,
          messageId: messageId,
          filename: filename,
          content: content,
          type: "large_content",
          size: content.length,
          line_count: content.split("\n").length,
        };
      } catch (error) {
        if ($DebugTestMode) {
          console.error("🔍 Error extracting from DOM:", error);
        }
      }
    }

    if ($DebugTestMode) {
      console.error("🔍 ❌ Attachment not found:", attachmentId);
    }
    return null;
  },

  // Enlarge any attachment
  enlargeAttachment: async function (attachmentId) {
    if ($DebugTestMode) {
      console.log("🔍 Enlarging attachment:", attachmentId);
    }

    // Find the attachment
    const attachment = this.findAttachmentData(attachmentId);
    if (!attachment) {
      if ($DebugTestMode) {
        console.error("🔍 ❌ Attachment not found:", attachmentId);
      }
      return;
    }

    if (
      attachment &&
      attachment.content &&
      attachment.content.trim().endsWith("...")
    ) {
      try {
        const fileContent = await historyManager.getFile(
          attachment.filename,
          appState.currentConversationId
        );

        if (fileContent) {
          attachment.content = fileContent;
          if ($DebugTestMode) {
            console.log(
              "📎 ✅ Full content loaded for attachment",
              attachment.content
            );
          }
        }
      } catch (error) {
        if ($DebugTestMode) {
          console.error("📎 ❌ Error fetching full content:", error);
        }
      }
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
          <button class="fullscreen-close-btn" onclick="messageManager.closeEnlargedAttachment('${attachmentId}')">✕</button>
        </div>
      `;
    } else if (
      attachment.type === "large_content" ||
      (attachment.content && attachment.content.length > 0)
    ) {
      const content = attachment.content || "";
      // Show ALL content instead of truncating
      const fullContent = content;

      if ($DebugTestMode) {
        console.log("this is the full content ", fullContent);
      }

      contentHTML = `
        <div class="fullscreen-wrapper" style="position: relative;">
          <div class="fullscreen-preview-content">
            <div class="fullscreen-file-info">
              📄 ${this.escapeHtml(attachment.filename)}
              <span style="opacity: 0.7; margin-left: 10px;">
                ${this.formatFileSize(attachment.size)} • 
                ${attachment.line_count || content.split("\n").length} lines
              </span>
            </div>
            <div class="fullscreen-text-preview" style="max-height: 80vh; overflow-y: auto; white-space: pre-wrap;">${this.escapeHtml(
              fullContent
            )}</div>
          </div>
          <button class="fullscreen-close-btn" onclick="messageManager.closeEnlargedAttachment('${attachmentId}')">✕</button>
        </div>
      `;
    } else {
      // Generic file preview
      const icon = this.getFileIcon(attachment);
      contentHTML = `
        <div class="fullscreen-wrapper" style="position: relative;">
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
          <button class="fullscreen-close-btn" onclick="messageManager.closeEnlargedAttachment('${attachmentId}')">✕</button>
        </div>
      `;
    }

    overlay.innerHTML = contentHTML;

    // Add to DOM
    document.body.appendChild(overlay);

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

  // Close enlarged attachment
  closeEnlargedAttachment: function (attachmentId) {
    const overlay = document.getElementById(`fullscreen_${attachmentId}`);
    if (overlay) {
      overlay.remove();
      if ($DebugTestMode) {
        console.log("🔍 Closed enlarged attachment:", attachmentId);
      }
    }
  },

  // Setup click handlers for attachments (simplified)
  setupAttachmentClickHandlers: function (messageElement, files) {
    if (!messageElement || !files || !Array.isArray(files)) {
      if ($DebugTestMode) {
        console.log("📎 No files to setup click handlers for");
      }
      return;
    }

    if ($DebugTestMode) {
      console.log("📎 Setting up click handlers for", files.length, "files");
    }

    // Find all attachment elements in this message
    const attachmentElements = messageElement.querySelectorAll(
      ".attachment-preview[data-attachment-id]"
    );

    attachmentElements.forEach((element) => {
      const attachmentId = element.getAttribute("data-attachment-id");
      if (attachmentId) {
        // Ensure the click handler is set up
        element.onclick = () => this.enlargeAttachment(attachmentId);
        if ($DebugTestMode) {
          console.log(`📎 Setup click handler for attachment: ${attachmentId}`);
        }
      }
    });
  },

  findMessageInHistory: function (messageId) {
    if ($DebugTestMode) {
      console.log("🔍 findMessageInHistory called with messageId:", messageId);
      console.log("🔍 appState.chatHistory type:", typeof appState.chatHistory);
      console.log(
        "🔍 appState.chatHistory is array:",
        Array.isArray(appState.chatHistory)
      );
      console.log("🔍 appState.chatHistory structure:", appState.chatHistory);
    }

    // Handle both array and object formats
    if (Array.isArray(appState.chatHistory)) {
      if ($DebugTestMode) {
        console.log(
          "🔍 Searching in array format, length:",
          appState.chatHistory.length
        );
      }
      const found = appState.chatHistory.find((msg) => msg.id === messageId);
      if ($DebugTestMode) {
        console.log("🔍 Found in array:", found);
      }
      return found;
    }

    // Object format - search through all conversations
    if (
      typeof appState.chatHistory === "object" &&
      appState.chatHistory !== null
    ) {
      if ($DebugTestMode) {
        console.log(
          "🔍 Searching in object format, keys:",
          Object.keys(appState.chatHistory)
        );
      }
      for (const conversationId of Object.keys(appState.chatHistory)) {
        const conversation = appState.chatHistory[conversationId];
        if ($DebugTestMode) {
          console.log(
            `🔍 Checking conversation ${conversationId}, is array:`,
            Array.isArray(conversation)
          );
        }

        if (Array.isArray(conversation)) {
          const message = conversation.find(
            (msg) => msg && msg.id === messageId
          );
          if (message) {
            if ($DebugTestMode) {
              console.log(
                "🔍 Found in conversation",
                conversationId,
                ":",
                message
              );
            }
            return message;
          }
        }
      }
    }

    if ($DebugTestMode) {
      console.log("🔍 Message not found, returning null");
    }
    return null;
  },
  getCurrentConversation: function () {
    if (
      appState.currentConversationId &&
      appState.chatHistory[appState.currentConversationId]
    ) {
      return Array.isArray(appState.chatHistory[appState.currentConversationId])
        ? appState.chatHistory[appState.currentConversationId] // Legacy support
        : appState.chatHistory[appState.currentConversationId].messages || [];
    } else if (Array.isArray(appState.chatHistory)) {
      return appState.chatHistory; // Legacy support
    }
    return [];
  },
};
