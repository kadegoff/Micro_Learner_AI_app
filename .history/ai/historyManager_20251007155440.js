// historyManager.js - Chat history management
"use strict";

if (typeof $DebugTestMode === "undefined") {
  $DebugTestMode = true;
}

// History Manager - ENHANCED with delete functionality and attachment display
var historyManager = {
  // Add this function to your historyManager object
  setupHistoryInfiniteScroll: function () {
    const historyContent = document.getElementById("historyContent");
    if (!historyContent) {
      if ($DebugTestMode) {
        console.warn("History content element not found for infinite scroll");
      }
      return;
    }

    if ($DebugTestMode) {
      console.log("Starting infinite scroll setup for history content");
    }

    // Track loading state to prevent multiple simultaneous requests
    let isLoading = false;
    let hasMoreConversations = true; // Track if there are more conversations to load

    // Add event listener to reset the flag when search query changes
    const searchInput = document.getElementById("historySearch");
    if (searchInput) {
      searchInput.addEventListener("input", () => {
        hasMoreConversations = true;
        // Remove any existing status indicators
        this.manageStatusIndicators();
      });
    }

    historyContent.addEventListener("scroll", async () => {
      // Check if user has scrolled to bottom (within 50px) and not currently loading
      // Also check if there are more conversations to load
      if (isLoading || !hasMoreConversations) {
        if ($DebugTestMode) {
          console.log(
            "Exiting scroll handler: isLoading or no more conversations"
          );
        }
        return;
      }

      const scrollPosition =
        historyContent.scrollTop + historyContent.clientHeight;
      const scrollThreshold = historyContent.scrollHeight - 50;

      if ($DebugTestMode) {
        console.log(
          `Scroll position: ${scrollPosition}, Threshold: ${scrollThreshold}, ScrollTop: ${historyContent.scrollTop}, ClientHeight: ${historyContent.clientHeight}, ScrollHeight: ${historyContent.scrollHeight}`
        );
      }

      if (scrollPosition >= scrollThreshold) {
        if ($DebugTestMode) {
          console.log("Scroll threshold reached, loading more conversations");
        }
        isLoading = true;

        // Remove any existing status indicators
        this.manageStatusIndicators();

        // Show loading indicator
        this.manageStatusIndicators("loading");

        try {
          // Get search query if any
          const searchInput = document.getElementById("historySearch");
          const searchQuery = searchInput ? searchInput.value.trim() : "";
          if ($DebugTestMode) {
            console.log(`Search query: "${searchQuery}"`);
          }

          // Pull more conversations (limit of 10 per scroll)
          if ($DebugTestMode) {
            console.log("Calling pullConversationsBackup...");
          }
          const newConversations = await this.pullConversationsBackup(
            3,
            searchQuery
          );

          if ($DebugTestMode) {
            console.log(`Received ${newConversations.length} new conversations`);
          }

          if (newConversations.length === 0) {
            if ($DebugTestMode) {
              console.log("No more conversations available");
            }
            hasMoreConversations = false; // Set flag to prevent future loads

            // Show "no more conversations" message
            if ($DebugTestMode) {
              console.log("Showing 'no more conversations' indicator");
            }
            this.manageStatusIndicators("no-more");
          } else {
            if ($DebugTestMode) {
              console.log("Adding new conversations to DOM");
            }
            // Add new conversations to DOM
            newConversations.forEach((conversation, index) => {
              if ($DebugTestMode) {
                console.log(
                  `Adding conversation ${index + 1}: ${
                    conversation.id || conversation.title || "untitled"
                  }`
                );
              }
              const topicItemHTML = this.createTopicItemHTML(conversation);
              historyContent.insertAdjacentHTML("beforeend", topicItemHTML);
            });

            // Re-setup event delegation for new items
            if ($DebugTestMode) {
              console.log("Setting up event delegation for new items");
            }
            this.setupEventDelegation();

            // Remove loading indicator
            this.manageStatusIndicators();
          }
        } catch (error) {
          if ($DebugTestMode) {
            console.error("Error loading more conversations:", error);
          }
          // On error, assume there might be more conversations
          hasMoreConversations = true;
          // Remove loading indicator on error
          this.manageStatusIndicators();
        } finally {
          isLoading = false;
          if ($DebugTestMode) {
            console.log("Loading complete, reset isLoading to false");
          }
        }
      }
    });

    if ($DebugTestMode) {
      console.log("Infinite scroll setup complete");
    }
  },

  setupEventDelegation: function () {
    if ($DebugTestMode) {
      console.log("🎯 Setting up direct event listeners for topic headers");
    }

    const topicHeaders = document.querySelectorAll(".topic-header");

    if (topicHeaders.length === 0) {
      if ($DebugTestMode) {
        console.error("No topic headers found");
      }
      return;
    }

    topicHeaders.forEach(function (topicHeader) {
      topicHeader.addEventListener("click", function (event) {
        if ($DebugTestMode) {
          console.log(
            "🎯 Clicked element:",
            event.target,
            "Topic header:",
            topicHeader
          );
        }
        const ConversationId = topicHeader.dataset.conversationId;

        if (ConversationId) {
          event.preventDefault();
          event.stopPropagation();
          if ($DebugTestMode) {
            console.log("🎯 clicked:", ConversationId);
          }
          if (!chatManager.currentStreamMessageId) {
            historyManager.loadConversation(ConversationId);
          } else {
            if ($DebugTestMode) {
              console.log(
                "🎯 ❌ Cannot load conversation while processing a message"
              );
            }
          }
        }
      });
    });
  },

  getTimeAgo: function (timestamp) {
    if ($DebugTestMode) {
      console.log("Input timestamp:", timestamp);
      console.log("Input timestamp type:", typeof timestamp);
    }

    if (!timestamp) {
      if ($DebugTestMode) {
        console.log('No timestamp provided, returning "Unknown"');
      }
      return "Unknown";
    }

    const now = new Date();
    if ($DebugTestMode) {
      console.log("Current local time:", now);
    }

    let messageTime;

    // Handle numeric timestamps (Unix timestamps in seconds)
    if (typeof timestamp === "number") {
      // Convert seconds to milliseconds for Date object
      messageTime = new Date(timestamp * 1000);
    }
    // Handle string timestamps
    else if (typeof timestamp === "string") {
      // Detect timestamp format
      if (
        timestamp.includes("T") &&
        (timestamp.includes("Z") ||
          timestamp.includes("+") ||
          timestamp.includes("-"))
      ) {
        // ISO format with timezone
        messageTime = new Date(timestamp);
      } else if (timestamp.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/)) {
        // MySQL/DB format without timezone - assume UTC
        messageTime = new Date(timestamp + "Z");
      } else {
        // Fallback - try to parse as is
        messageTime = new Date(timestamp);
      }
    }
    // Handle Date objects
    else if (timestamp instanceof Date) {
      messageTime = timestamp;
    }
    // Invalid type
    else {
      if ($DebugTestMode) {
        console.log("Invalid timestamp type, returning 'Unknown'");
      }
      return "Unknown";
    }

    if ($DebugTestMode) {
      console.log("Parsed message time:", messageTime);
    }

    // Calculate difference using UTC timestamps
    const nowUTC = Date.now();
    const messageUTC = messageTime.getTime();

    // Handle invalid dates
    if (isNaN(messageUTC)) {
      if ($DebugTestMode) {
        console.log("Invalid date, returning 'Unknown'");
      }
      return "Unknown";
    }

    const diffInSeconds = Math.floor((nowUTC - messageUTC) / 1000);
    if ($DebugTestMode) {
      console.log("Difference in seconds:", diffInSeconds);
    }

    if (diffInSeconds < 60) {
      return "Just now";
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes} minute${minutes !== 1 ? "s" : ""} ago`;
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours} hour${hours !== 1 ? "s" : ""} ago`;
    } else if (diffInSeconds < 2592000) {
      const days = Math.floor(diffInSeconds / 86400);
      return `${days} day${days !== 1 ? "s" : ""} ago`;
    } else if (diffInSeconds < 31536000) {
      const months = Math.floor(diffInSeconds / 2592000);
      return `${months} month${months !== 1 ? "s" : ""} ago`;
    } else {
      const years = Math.floor(diffInSeconds / 31536000);
      return `${years} year${years !== 1 ? "s" : ""} ago`;
    }
  },

  loadHistory: function () {
    if ($DebugTestMode) {
      console.log("📚 === LOADING HISTORY ===");
    }

    const historyContent = document.getElementById("historyContent");
    if (!historyContent) {
      if ($DebugTestMode) {
        console.warn("📚 ⚠️ historyContent element not found!");
      }
      return;
    }

    // Remove any existing status indicators
    this.manageStatusIndicators();

    if ($DebugTestMode) {
      console.log("📚 ✅ historyContent element found");
      console.log("this is the appState.chatHistory", appState.chatHistory);
      console.log(
        "this is the appState.isAuthenticated",
        appState.isAuthenticated
      );
    }

    if (
      !appState.chatHistory ||
      Object.keys(appState.chatHistory).length === 0 ||
      !appState.isAuthenticated
    ) {
      if ($DebugTestMode) {
        console.log("📚 No chat history found, showing empty state");
      }
      this.manageStatusIndicators("empty");
      return;
    }

    let html = "";

    // Convert chatHistory to array of conversations with metadata
    const conversations = Object.entries(appState.chatHistory).map(
      ([convId, conversationData]) => {
        // Handle both array of messages and object with messages property
        const messages = Array.isArray(conversationData)
          ? conversationData
          : conversationData.messages || [];

        // Get the first and last messages
        const firstMessage = messages.length > 0 ? messages[0] : null;
        const lastMessage =
          messages.length > 0 ? messages[messages.length - 1] : null;

        // Extract topic - prioritize conversation-level topic, then message-level
        let topic = "Untitled Conversation";
        let createdAt = new Date().toISOString();

        // First, check if the conversation object itself has a topic
        if (conversationData.topic) {
          topic = conversationData.topic;
        } else if (firstMessage) {
          // Fallback to extracting from first message
          topic =
            firstMessage.topic ||
            firstMessage.title ||
            (firstMessage.content
              ? firstMessage.content.substring(0, 50) + "..."
              : "Untitled Conversation");
        }

        // Get creation timestamp
        if (conversationData.createdAt) {
          createdAt = conversationData.createdAt;
        } else if (firstMessage) {
          createdAt =
            firstMessage.timestamp || firstMessage.createdAt || createdAt;
        }

        // Use conversation-level timestamp as the primary timestamp for sorting
        const conversationTimestamp = conversationData.timestamp || createdAt;

        return {
          id: convId,
          topic: topic,
          createdAt: createdAt,
          messageCount: messages.length,
          // This is the key field for sorting - use conversation timestamp
          conversationTimestamp: conversationTimestamp,
        };
      }
    );

    // Sort conversations by conversation timestamp (most recent first)
    const sortedConversations = conversations.sort((a, b) => {
      return (
        new Date(b.conversationTimestamp) - new Date(a.conversationTimestamp)
      );
    });

    if ($DebugTestMode) {
      console.log(
        "📚 Sorted conversations by conversationTimestamp:",
        sortedConversations.map((conv) => ({
          id: conv.id,
          topic: conv.topic,
          conversationTimestamp: conv.conversationTimestamp,
          messageCount: conv.messageCount,
        }))
      );
    }

    sortedConversations.forEach((conversation, index) => {
      const isCurrentConversation =
        conversation.id === appState.currentConversationId;

      if ($DebugTestMode) {
        console.log(
          `📚 [${index + 1}/${
            sortedConversations.length
          }] Rendering conversation ${conversation.id}:`,
          conversation.topic,
          "Timestamp:",
          conversation.conversationTimestamp,
          "Is current:",
          isCurrentConversation
        );
      }

      html += `
    <div class="topic-item ${
      isCurrentConversation ? "active" : ""
    }" data-conversation-id="${conversation.id}">
      <div class="topic-header" data-topic-id="${
        conversation.id
      }" data-conversation-id="${conversation.id}">
        <span class="topic-title">${conversation.topic}</span>
        <div class="topic-meta">
          <span class="topic-date" style="font-size: 12px;">Last message sent ${this.getTimeAgo(
            conversation.conversationTimestamp
          )}</span>
        </div>
      </div>
    </div>
  `;

      if ($DebugTestMode) {
        console.log(`📚   ✅ Conversation ${conversation.id} HTML generated`);
      }
    });

    if ($DebugTestMode) {
      console.log("📚 Final HTML length:", html.length, "characters");
      console.log("📚 Setting innerHTML...");
    }

    historyContent.innerHTML = html;

    if ($DebugTestMode) {
      console.log("📚 ✅ History HTML updated successfully");
      console.log(
        "📚 Final DOM children count:",
        historyContent.children.length
      );

      // Verify rendered elements
      const renderedConversations =
        historyContent.querySelectorAll(".topic-item");
      console.log(
        "📚 Rendered conversations in DOM:",
        renderedConversations.length
      );

      // Log active elements
      const activeConversations =
        historyContent.querySelectorAll(".topic-item.active");
      console.log("📚 Active conversations:", activeConversations.length);

      console.log("📚 === HISTORY LOADING COMPLETE ===");
    }

    this.setupEventDelegation();
  },

  // 🔧 UPDATED: getAllMessagesForConversation helper method
  getAllMessagesForConversation: function (conversationId) {
    const allMessages = [];

    // 🔧 UPDATED: Access messages from conversation object or legacy array
    const conversation = appState.chatHistory[conversationId];
    if (Array.isArray(conversation)) {
      // Legacy support - conversation is stored as direct array
      allMessages.push(...conversation);
    } else if (conversation && Array.isArray(conversation.messages)) {
      // New structure - conversation is object with messages array
      allMessages.push(...conversation.messages);
    }

    if ($DebugTestMode) {
      console.log(
        `📖 🔍 Found ${allMessages.length} messages in conversation ${conversationId}`
      );
      console.log(
        `📖 🔍 Conversation arrays in chatHistory:`,
        Object.keys(appState.chatHistory).length
      );
    }

    return allMessages;
  },

  // Define saveFile function (async but called in a non-blocking way)
  saveFile: async function (fileName, content, conversationId) {
    if ($DebugTestMode) {
      console.log("saveFile function called with parameters:", {
        fileName: fileName,
        contentLength: content?.length || 0,
        contentType: typeof content,
        conversationId: conversationId,
      });
    }

    try {
      if ($DebugTestMode) {
        console.log("Making IPC call to electronAPI.saveFile...");
      }

      window.electronAPI
        .saveFile(fileName, content, conversationId)
        .then((result) => {
          if ($DebugTestMode) {
            console.log("Received response from electronAPI:", result);
          }

          if (result.success) {
            if ($DebugTestMode) {
              console.log("✅ File saved successfully at:", result.path);
              console.log("📁 File name:", fileName);
              console.log(
                "💾 Content length:",
                content?.length || 0,
                "characters"
              );
            }
          } else {
            if ($DebugTestMode) {
              console.error("❌ Failed to save file:", result.error);
              console.error("Error details:", {
                fileName: fileName,
                conversationId: conversationId,
                errorType: typeof result.error,
              });
            }
          }
        })
        .catch((error) => {
          if ($DebugTestMode) {
            console.error("🔥 Promise rejection in electronAPI call:", error);
            console.error("Error stack:", error.stack);
            console.error("Error occurred with parameters:", {
              fileName: fileName,
              conversationId: conversationId,
            });
          }
        });

      if ($DebugTestMode) {
        console.log("IPC call initiated successfully, waiting for response...");
      }
    } catch (error) {
      if ($DebugTestMode) {
        console.error("💥 Unexpected error in saveFile function:", error);
        console.error("Error stack:", error.stack);
      }
    }
  },

  // Define getFilePreview function for retrieving first 1000 chars of file content
  getFilePreview: async function (fileName, conversationId) {
    if ($DebugTestMode) {
      console.log(`📖 🔍 GETFILEPREVIEW CALLED:`, {
        fileName,
        conversationId,
      });
    }

    try {
      const result = await window.electronAPI.getFilePreview(
        fileName,
        conversationId
      );
      if ($DebugTestMode) {
        console.log(`📖 🔍 GETFILEPREVIEW RESULT for ${fileName}:`, result);
      }

      if (result.success) {
        // Check if file was not found but operation was successful
        if (result.message === "File not found") {
          if ($DebugTestMode) {
            console.log(
              `📖 🔍 File not found, calling fallback for: ${fileName}`
            );
          }
          // Call fallback when file is not found
          const file = await appState.getUserFilesFallback(
            fileName,
            conversationId
          );

          if ($DebugTestMode) {
            console.log("this is the file from fallback 1", file);
          }

          // Only save if fallback returned a valid file
          if (file) {
            if ($DebugTestMode) {
              console.log("CALLING SAVING FILE 3");
            }
            this.saveFile(fileName, file, conversationId);
            return file;
          } else {
            if ($DebugTestMode) {
              console.log(
                `📖 🔍 Fallback also returned no file for: ${fileName}`
              );
            }
            return ""; // Return empty string if fallback also fails
          }
        } else {
          if ($DebugTestMode) {
            console.log(`📖 ✅ File preview retrieved successfully: ${fileName}`);
            console.log(
              `📖 🔍 File content preview (first 100 chars):`,
              result.content?.substring(0, 100)
            );
          }
          return result.content;
        }
      } else {
        if ($DebugTestMode) {
          console.error(
            `📖 ❌ Failed to get file preview ${fileName}:`,
            result.error
          );
        }
        throw new Error(result.error || "Failed to get file preview");
      }
    } catch (error) {
      if ($DebugTestMode) {
        console.error(`📖 ❌ Get file preview error for ${fileName}:`, error);
      }
      throw error; // Re-throw for caller to handle
    }
  },

  // Define getFile function for retrieving file content
  getFile: async function (fileName, conversationId) {
    if ($DebugTestMode) {
      console.log(`📖 🔍 GETFILE CALLED:`, {
        fileName,
        conversationId,
      });
    }

    try {
      const result = await window.electronAPI.getFile(fileName, conversationId);
      if ($DebugTestMode) {
        console.log(`📖 🔍 GETFILE RESULT for ${fileName}:`, result);
      }

      if (result.success) {
        // Check if file was not found but operation was successful
        if (result.message === "File not found") {
          if ($DebugTestMode) {
            console.log(
              `📖 🔍 File not found, calling fallback for: ${fileName}`
            );
          }
          // Call fallback when file is not found
          const file = await appState.getUserFilesFallback(
            fileName,
            conversationId
          );

          if ($DebugTestMode) {
            console.log("this is the file from fallback", file);
          }

          // Only save if fallback returned a valid file
          if (file) {
            if ($DebugTestMode) {
              console.log("CALLING SAVING FILE 4");
            }
            this.saveFile(fileName, file, conversationId);
            return file;
          } else {
            if ($DebugTestMode) {
              console.log(
                `📖 🔍 Fallback also returned no file for: ${fileName}`
              );
            }
            return ""; // Return empty string if fallback also fails
          }
        } else {
          if ($DebugTestMode) {
            console.log(`📖 ✅ File retrieved successfully: ${fileName}`);
            console.log(
              `📖 🔍 File content preview (first 100 chars):`,
              result.content?.substring(0, 100)
            );
          }
          return result.content;
        }
      } else {
        if ($DebugTestMode) {
          console.error(`📖 ❌ Failed to get file ${fileName}:`, result.error);
        }
        throw new Error(result.error || "Failed to get file");
      }
    } catch (error) {
      if ($DebugTestMode) {
        console.error(`📖 ❌ Get file error for ${fileName}:`, error);
      }
      throw error; // Re-throw for caller to handle
    }
  },

  loadConversation: async function (ConversationId) {
    if ($DebugTestMode) {
      console.log(
        "📖 === UPDATED LOAD CONVERSATION (USING updateMessagesAfterVersion) ===",
        ConversationId
      );
    }

    try {
      // Store the original title and add loading spinner
      if ($DebugTestMode) {
        console.log(
          `Starting spinner process for conversation ID: ${ConversationId}`
        );
      }

      const conversationElement = document.querySelector(
        `.topic-header[data-conversation-id="${ConversationId}"]`
      );
      if ($DebugTestMode) {
        console.log("Conversation element found:", conversationElement);
      }

      let originalTitleHTML = "";

      if (conversationElement) {
        const titleElement = conversationElement.querySelector(".topic-title");
        if ($DebugTestMode) {
          console.log("Title element found:", titleElement);
        }

        if (titleElement) {
          originalTitleHTML = titleElement.innerHTML;
          if ($DebugTestMode) {
            console.log("Original title HTML stored:", originalTitleHTML);
          }

          titleElement.innerHTML =
            '<div class="loading-spinner" style="display: inline-block; width: 16px; height: 16px; border: 2px solid #f3f3f3; border-top: 2px solid #3498db; border-radius: 50%; animation: spin 1s linear infinite;"></div>';
          if ($DebugTestMode) {
            console.log("Loading spinner added to title element");
          }

          // Add spin animation if not already in styles
          if (!document.querySelector("style#spinner-animation")) {
            if ($DebugTestMode) {
              console.log("Adding spin animation styles");
            }
            const style = document.createElement("style");
            style.id = "spinner-animation";
            style.textContent = `
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `;
            document.head.appendChild(style);
            if ($DebugTestMode) {
              console.log("Spin animation styles added to document head");
            }
          } else {
            if ($DebugTestMode) {
              console.log("Spin animation styles already exist");
            }
          }
        } else {
          if ($DebugTestMode) {
            console.log("No title element found within conversation element");
          }
        }
      } else {
        if ($DebugTestMode) {
          console.log("No conversation element found with the specified ID");
        }
      }

      if ($DebugTestMode) {
        console.log("Spinner process completed");
      }

      appState.currentConversationId = ConversationId;
      appState.saveToStorage();

      // Clear current content
      const content = document.getElementById("aiContent");
      if (!content) {
        // Restore title if content not found
        if (conversationElement && originalTitleHTML) {
          const titleElement =
            conversationElement.querySelector(".topic-title");
          if (titleElement) titleElement.innerHTML = originalTitleHTML;
        }
        return;
      }
      content.innerHTML = "";

      // Get ALL messages for this conversation
      let conversationMessages =
        this.getAllMessagesForConversation(ConversationId);

      if ($DebugTestMode) {
        console.log("📖 Found total messages:", conversationMessages.length);
        console.log(
          "📖 🔍 RAW MESSAGES FROM getAllMessagesForConversation:",
          conversationMessages
        );
      }

      // === NEW: Check if no messages are found and call fallbackchatHistoryPull ===
      if (conversationMessages.length === 0) {
        if ($DebugTestMode) {
          console.log(
            "📖 ❌ No messages found in appState.chatHistory, attempting fallbackchatHistoryPull"
          );
        }
        try {
          await appState.fallbackchatHistoryPull(ConversationId);
          if ($DebugTestMode) {
            console.log(
              "📖 ✅ Fallback fetch successful, re-fetching messages from chatHistory"
            );
          }

          // === NEW: Re-execute the initial setup and message retrieval ===
          appState.currentConversationId = ConversationId;
          appState.saveToStorage();

          // Clear current content (again, to ensure clean state)
          const content = document.getElementById("aiContent");
          if (!content) {
            // Restore title if content not found
            if (conversationElement && originalTitleHTML) {
              const titleElement =
                conversationElement.querySelector(".topic-title");
              if (titleElement) titleElement.innerHTML = originalTitleHTML;
            }
            return;
          }
          content.innerHTML = "";

          // Get ALL messages for this conversation again
          conversationMessages =
            this.getAllMessagesForConversation