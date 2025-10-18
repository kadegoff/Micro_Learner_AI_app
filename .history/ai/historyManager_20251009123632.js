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
            console.log(
              `Received ${newConversations.length} new conversations`
            );
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
            console.log(
              `📖 ✅ File preview retrieved successfully: ${fileName}`
            );
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
            this.getAllMessagesForConversation(ConversationId);

          if ($DebugTestMode) {
            console.log(
              "📖 Found total messages after fallback:",
              conversationMessages.length
            );
            console.log(
              "📖 🔍 RAW MESSAGES FROM getAllMessagesForConversation after fallback:",
              conversationMessages
            );
          }

          if (conversationMessages.length === 0) {
            if ($DebugTestMode) {
              console.error(
                "📖 ❌ No messages found even after fallbackchatHistoryPull"
              );
            }
            // Restore original title
            if (conversationElement && originalTitleHTML) {
              const titleElement =
                conversationElement.querySelector(".topic-title");
              if (titleElement) titleElement.innerHTML = originalTitleHTML;
            }
            return;
          }
        } catch (error) {
          if ($DebugTestMode) {
            console.error("📖 ❌ Error in fallbackchatHistoryPull:", error);
          }
          // Restore original title on error
          if (conversationElement && originalTitleHTML) {
            const titleElement =
              conversationElement.querySelector(".topic-title");
            if (titleElement) titleElement.innerHTML = originalTitleHTML;
          }
          return;
        }
      }

      // Log each message's file property before any processing
      conversationMessages.forEach((msg, index) => {
        if ($DebugTestMode) {
          console.log(`📖 🔍 MESSAGE ${index} INITIAL STATE:`, {
            id: msg.id,
            type: msg.type,
            version: msg.version || 1,
            hasFiles: !!msg.files,
            filesType: typeof msg.files,
            filesIsArray: Array.isArray(msg.files),
            filesLength: msg.files ? msg.files.length : "N/A",
            filesContent: msg.files,
            allProperties: Object.keys(msg),
          });
        }
      });

      // Sort messages by timestamp
      conversationMessages.sort((a, b) => {
        return (
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );
      });

      if ($DebugTestMode) {
        console.log(
          "📖 🔍 AFTER SORTING - checking if files are still intact:"
        );
        conversationMessages.forEach((msg, index) => {
          console.log(`📖 🔍 SORTED MESSAGE ${index}:`, {
            id: msg.id,
            hasFiles: !!msg.files,
            filesContent: msg.files,
          });
        });
      }

      // ===== STEP 1: GROUP MESSAGES BY ID AND FIND LATEST VERSIONS =====
      if ($DebugTestMode) {
        console.log("📖 🔧 STEP 1: Finding latest versions of each message");
      }

      const messageGroups = new Map();
      conversationMessages.forEach((msg) => {
        if ($DebugTestMode) {
          console.log(`📖 🔍 GROUPING MESSAGE:`, {
            id: msg.id,
            hasFiles: !!msg.files,
            filesContent: msg.files,
          });
        }

        let baseId = msg.id;
        if (!messageGroups.has(baseId)) {
          messageGroups.set(baseId, []);
        }
        messageGroups.get(baseId).push(msg);
      });

      if ($DebugTestMode) {
        console.log(`📖 Found ${messageGroups.size} unique message groups`);
      }

      // Log each group's content
      messageGroups.forEach((versions, baseId) => {
        if ($DebugTestMode) {
          console.log(`📖 🔍 GROUP ${baseId}:`, {
            versionsCount: versions.length,
            versions: versions.map((v) => ({
              id: v.id,
              version: v.version || 1,
              hasFiles: !!v.files,
              filesContent: v.files,
            })),
          });
        }
      });

      // For each group, find the message with the highest version number
      const latestMessages = [];
      messageGroups.forEach((versions, baseId) => {
        if ($DebugTestMode) {
          console.log(
            `📖 🔍 PROCESSING GROUP ${baseId} with ${versions.length} versions`
          );
        }

        if (versions.length === 1) {
          if ($DebugTestMode) {
            console.log(`📖 🔍 Single version for ${baseId}:`, {
              hasFiles: !!versions[0].files,
              filesContent: versions[0].files,
            });
          }
          latestMessages.push(versions[0]);
        } else {
          // Multiple versions - find the one with the highest version number
          let highestVersion = 0;
          let latestMessage = versions[0];

          versions.forEach((msg) => {
            if ($DebugTestMode) {
              console.log(`📖 🔍 Checking version for ${msg.id}:`, {
                version: msg.version || 1,
                hasFiles: !!msg.files,
                filesContent: msg.files,
              });
            }

            const versionNum = msg.version || 1;
            if (versionNum > highestVersion) {
              highestVersion = versionNum;
              latestMessage = msg;
              if ($DebugTestMode) {
                console.log(`📖 🔍 NEW HIGHEST VERSION FOUND:`, {
                  version: versionNum,
                  hasFiles: !!latestMessage.files,
                  filesContent: latestMessage.files,
                });
              }
            }
          });

          if ($DebugTestMode) {
            console.log(`📖 🔍 FINAL LATEST MESSAGE for ${baseId}:`, {
              id: latestMessage.id,
              version: latestMessage.version || 1,
              hasFiles: !!latestMessage.files,
              filesContent: latestMessage.files,
            });
          }

          latestMessages.push(latestMessage);
        }
      });

      if ($DebugTestMode) {
        console.log(
          `📖 🔍 LATEST MESSAGES ARRAY (${latestMessages.length} messages):`
        );
        latestMessages.forEach((msg, index) => {
          console.log(`📖 🔍 LATEST MESSAGE ${index}:`, {
            id: msg.id,
            hasFiles: !!msg.files,
            filesContent: msg.files,
          });
        });
      }

      // Sort latest messages by timestamp to maintain conversation order
      latestMessages.sort(
        (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
      );

      if ($DebugTestMode) {
        console.log(
          "📖 🔍 AFTER FINAL SORTING - checking if files are still intact:"
        );
        latestMessages.forEach((msg, index) => {
          console.log(`📖 🔍 FINAL SORTED MESSAGE ${index}:`, {
            id: msg.id,
            hasFiles: !!msg.files,
            filesContent: msg.files,
          });
        });
      }

      if ($DebugTestMode) {
        console.log(`📖 Rendering ${latestMessages.length} latest messages`);
      }

      // ===== STEP 2: RENDER ALL MESSAGES FIRST (INCLUDING ALL VERSIONS) =====
      if ($DebugTestMode) {
        console.log("📖 🔧 STEP 2: Rendering ALL message versions to DOM");
      }

      // Create a complete timeline of all messages (all versions)
      const allMessagesTimeline = conversationMessages.sort(
        (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
      );

      if ($DebugTestMode) {
        console.log("📖 🔍 ALL MESSAGES TIMELINE:");
        allMessagesTimeline.forEach((msg, index) => {
          console.log(`📖 🔍 TIMELINE MESSAGE ${index}:`, {
            id: msg.id,
            hasFiles: !!msg.files,
            filesContent: msg.files,
          });
        });
      }

      // Process messages sequentially to handle async file loading
      const processMessages = async () => {
        if ($DebugTestMode) {
          console.log(
            `📖 🔧 STARTING ASYNC PROCESSING OF ${allMessagesTimeline.length} MESSAGES`
          );
        }

        for (let index = 0; index < allMessagesTimeline.length; index++) {
          const msg = allMessagesTimeline[index];

          if ($DebugTestMode) {
            console.log(
              `📖 🔧 Processing message ${index + 1}/${
                allMessagesTimeline.length
              }:`,
              {
                id: msg.id,
                type: msg.type,
                version: msg.version || 1,
                timestamp: msg.timestamp,
                hasFiles: !!msg.files,
                filesContent: msg.files,
              }
            );
          }

          // Create message element
          const message = document.createElement("div");
          message.id = msg.id;
          message.className =
            msg.type === "ai" ? "message ai-response" : "message user-message";
          message.dataset.messageId = msg.id;

          // Set version for all messages
          const version = msg.version || 1;
          message.dataset.version = version;
          msg.version = version; // Ensure it's set in the data

          if ($DebugTestMode) {
            console.log(`📖 🔍 CREATING messageData object for ${msg.id}`);
          }

          // Create message data for HTML generation
          const messageData = {
            ...msg,
            files: msg.files || [],
            version: version,
          };

          if ($DebugTestMode) {
            console.log(`📖 🔍 MESSAGEDATA CREATED:`, {
              id: messageData.id,
              hasFiles: !!messageData.files,
              filesIsArray: Array.isArray(messageData.files),
              filesLength: messageData.files ? messageData.files.length : "N/A",
              filesContent: messageData.files,
              originalMsgFiles: msg.files,
              filesEqual:
                JSON.stringify(messageData.files) === JSON.stringify(msg.files),
            });
          }

          // Handle file loading if files exist
          if (messageData.files) {
            if ($DebugTestMode) {
              console.log(
                `📖 🔧 ENTERING FILE LOADING BLOCK for message ${msg.id}`
              );
              console.log(`📖 🔍 Files to process:`, messageData.files);
            }

            let filesToProcess;
            if (Array.isArray(messageData.files)) {
              filesToProcess = messageData.files;
            } else if (
              typeof messageData.files === "string" &&
              messageData.files.includes(",")
            ) {
              // Parse comma-separated string into array
              filesToProcess = messageData.files
                .split(",")
                .map((file) => file.trim());
            } else {
              filesToProcess = [messageData.files];
            }

            if ($DebugTestMode) {
              console.log(`📖 🔧 Creating file promises...`);
              console.log(`📖 🔍 Files to process (parsed):`, filesToProcess);
            }
            const filePromises = filesToProcess.map(
              async (fileName, fileIndex) => {
                if ($DebugTestMode) {
                  console.log(
                    `📖 🔧 Processing file ${fileIndex}: ${fileName}`,
                    {
                      type: typeof fileName,
                      isString: typeof fileName === "string",
                      content: fileName,
                    }
                  );
                }

                if (typeof fileName === "string") {
                  if ($DebugTestMode) {
                    console.log(
                      `📖 🔧 Calling getFile/getFilePreview for: ${fileName}`
                    );
                  }

                  // DIFFERENTIATE BETWEEN AI AND USER MESSAGES
                  const fileContent =
                    msg.type === "ai" || fileName.endsWith(".png")
                      ? await this.getFile(fileName, ConversationId)
                      : await this.getFilePreview(fileName, ConversationId);

                  // NEW: Log the complete content length before any processing
                  if ($DebugTestMode) {
                    console.log(
                      `📖 🔍 COMPLETE FILE CONTENT LENGTH for ${fileName}:`,
                      fileContent ? fileContent.length : "null"
                    );
                  }

                  // NEW: Detect if content is JSON regardless of filename
                  const isLikelyJSON =
                    fileContent &&
                    (fileContent.trim().startsWith("{") ||
                      fileContent.trim().startsWith("["));

                  if ($DebugTestMode) {
                    console.log(
                      `📖 🔍 JSON DETECTION for ${fileName}:`,
                      isLikelyJSON,
                      `Starts with: ${
                        fileContent
                          ? fileContent.trim().substring(0, 10)
                          : "null"
                      }`
                    );
                  }

                  // PARSE THE FILE CONTENT BASED ON FILE TYPE OR CONTENT DETECTION
                  let parsedContent = fileContent;

                  if (fileContent) {
                    try {
                      // Parse JSON files - check both extension AND content
                      if (fileName.endsWith(".json") || isLikelyJSON) {
                        parsedContent = JSON.parse(fileContent);
                        if ($DebugTestMode) {
                          console.log(
                            `📖 ✅ Successfully parsed JSON file: ${fileName}`,
                            `Parsed type: ${typeof parsedContent}`,
                            `Is object: ${
                              typeof parsedContent === "object" &&
                              parsedContent !== null
                            }`
                          );
                        }
                      }
                      // Parse CSV files (simple implementation)
                      else if (fileName.endsWith(".csv")) {
                        const lines = fileContent.split("\n");
                        const headers = lines[0].split(",");
                        const data = lines.slice(1).map((line) => {
                          const values = line.split(",");
                          const obj = {};
                          headers.forEach((header, index) => {
                            obj[header.trim()] = values[index]
                              ? values[index].trim()
                              : "";
                          });
                          return obj;
                        });
                        parsedContent = data;
                        if ($DebugTestMode) {
                          console.log(
                            `📖 ✅ Successfully parsed CSV file: ${fileName}`,
                            `Array length: ${data.length}`,
                            `First item: ${JSON.stringify(data[0]).substring(
                              0,
                              100
                            )}...`
                          );
                        }
                      }
                      // Parse text files with specific formats
                      else if (fileName.endsWith(".txt")) {
                        if ($DebugTestMode) {
                          console.log(`📖 ℹ️  Text file detected: ${fileName}`);
                        }
                      }
                      // Handle image files differently
                      else if (
                        fileName.endsWith(".png") ||
                        fileName.endsWith(".jpg") ||
                        fileName.endsWith(".jpeg")
                      ) {
                        if ($DebugTestMode) {
                          console.log(
                            `📖 ℹ️  Image file detected: ${fileName}`
                          );
                        }
                      }
                    } catch (error) {
                      if ($DebugTestMode) {
                        console.error(
                          `📖 ❌ Error parsing file ${fileName}:`,
                          error
                        );
                      }
                      parsedContent = fileContent;
                    }
                  }

                  if ($DebugTestMode) {
                    console.log(
                      `📖 🔍 FINAL PARSED CONTENT for ${fileName}:`,
                      `Type: ${typeof parsedContent}`,
                      `Is object: ${
                        typeof parsedContent === "object" &&
                        parsedContent !== null
                      }`,
                      `Content preview: ${
                        typeof parsedContent === "string"
                          ? parsedContent.substring(0, 100) + "..."
                          : JSON.stringify(parsedContent).substring(0, 100) +
                            "..."
                      }`
                    );
                  }

                  return parsedContent;
                }

                if ($DebugTestMode) {
                  console.log(
                    `📖 🔧 File is already an object, returning as-is:`,
                    `Type: ${typeof fileName}`,
                    `Content: ${JSON.stringify(fileName).substring(0, 100)}...`
                  );
                }
                return fileName;
              }
            );

            if ($DebugTestMode) {
              console.log(
                `📖 🔧 Waiting for ${filePromises.length} file promises to resolve...`
              );
            }
            const resolvedFiles = await Promise.all(filePromises);

            // ADD THESE CRITICAL DEBUG LOGS:
            if ($DebugTestMode) {
              console.log(`📖 🔍 ALL FILES RESOLVED:`, {
                length: resolvedFiles.length,
                types: resolvedFiles.map((file) => typeof file),
                isArray: Array.isArray(resolvedFiles),
                contentPreview: resolvedFiles.map((file) =>
                  typeof file === "string"
                    ? file.substring(0, 50) + "..."
                    : typeof file === "object" && file !== null
                    ? JSON.stringify(file).substring(0, 50) + "..."
                    : file
                ),
              });
            }

            messageData.files = resolvedFiles;

            // LOG AFTER ASSIGNMENT TO VERIFY
            if ($DebugTestMode) {
              console.log(`📖 🔍 MESSAGE DATA AFTER FILE ASSIGNMENT:`, {
                hasFiles: messageData.hasOwnProperty("files"),
                filesLength: messageData.files ? messageData.files.length : 0,
                filesTypes: messageData.files
                  ? messageData.files.map((file) => typeof file)
                  : [],
                messageDataKeys: Object.keys(messageData),
              });
            }
          }

          const shouldIncludeFiles =
            messageData.files && messageData.files.length > 0;

          try {
            if ($DebugTestMode) {
              console.log(`📖 the messageData.files`, messageData.files);
            }

            message.innerHTML = messageManager.createMessageHTML(
              messageData,
              shouldIncludeFiles
            );

            // NEW: Log the generated HTML length
            if ($DebugTestMode) {
              console.log(
                `📖 🔍 Generated HTML length:`,
                message.innerHTML.length
              );
            }

            // NEW: Log a portion of the HTML to check for file content
            if ($DebugTestMode) {
              console.log(
                `📖 🔍 Sample of generated HTML (first 500 chars):`,
                message.innerHTML.substring(0, 500)
              );
            }

            content.appendChild(message);
            if ($DebugTestMode) {
              console.log("Message appended to content:", message);
            }

            if (shouldIncludeFiles) {
              const codeElements = message.querySelectorAll(
                'code[class*="language-"]'
              );
              if (codeElements.length > 0) {
                if ($DebugTestMode) {
                  console.log(
                    `📖 🔍 Found ${codeElements.length} code elements`
                  );
                }
                codeElements.forEach((codeElement) => {
                  // NEW: Log code element content before highlighting
                  if ($DebugTestMode) {
                    console.log(
                      `📖 🔍 Code element content (length ${codeElement.textContent.length}):`,
                      codeElement.textContent.substring(0, 100) + "..."
                    );
                  }
                  chatManager.highlightElementCode(codeElement);
                });
              } else {
                if ($DebugTestMode) {
                  console.log("No code elements found in message");
                }
              }
            }

            // Setup attachment handlers if needed
            if (shouldIncludeFiles) {
              setTimeout(() => {
                if ($DebugTestMode) {
                  console.log(
                    `📖 🔍 Setting up handlers for files in message ${msg.id}`
                  );
                }
                messageManager.setupAttachmentClickHandlers(
                  message,
                  messageData.files
                );
              }, 10);
            }
          } catch (error) {
            if ($DebugTestMode) {
              console.error(`📖 ❌ ERROR rendering message ${msg.id}:`, error);
            }
          }
        }

        if ($DebugTestMode) {
          console.log("📖 ✅ All messages rendered to DOM");
        }
        continueAfterMessageProcessing();
      };

      const continueAfterMessageProcessing = () => {
        // FIXED STEP 2.5: Hide older versions, show only latest
        if ($DebugTestMode) {
          console.log(
            "📖 🔧 STEP 2.5: Hiding older versions, showing only latest"
          );
        }

        // For each message group, hide all versions except the latest
        messageGroups.forEach((versions, baseId) => {
          if (versions.length > 1) {
            // Find the latest version number for this message
            let highestVersion = 0;
            let latestMessage = versions[0];

            versions.forEach((msg) => {
              const versionNum = msg.version || 1;
              if (versionNum > highestVersion) {
                highestVersion = versionNum;
                latestMessage = msg;
              }
            });

            if ($DebugTestMode) {
              console.log(
                `📖 🔧 Message ${baseId}: hiding older versions, showing v${highestVersion}`
              );
            }

            // ✅ CRITICAL FIX: Find ALL DOM elements with this message ID using the correct selector
            const allElementsWithThisId = document.querySelectorAll(
              `div[id="${baseId}"]`
            );

            if ($DebugTestMode) {
              console.log(
                `📖 🔧 Found ${allElementsWithThisId.length} DOM elements for message ${baseId}`
              );
            }

            // ✅ IMPROVED: Process each DOM element individually
            allElementsWithThisId.forEach((element, index) => {
              if ($DebugTestMode) {
                console.log(
                  `📖 🔧 Processing DOM element ${
                    index + 1
                  } for message ${baseId}`
                );
              }

              // Get the version from data-version attribute
              const elementVersion =
                parseInt(element.getAttribute("data-version")) || 1;

              if ($DebugTestMode) {
                console.log(
                  `📖 🔧   Element version: ${elementVersion}, Latest version: ${highestVersion}`
                );
              }

              if (elementVersion === highestVersion) {
                element.style.display = "";
                if ($DebugTestMode) {
                  console.log(
                    `📖 ✅ Showing ${baseId} v${elementVersion} (latest)`
                  );
                }
              } else {
                element.style.display = "none";
                if ($DebugTestMode) {
                  console.log(
                    `📖 🙈 Hiding ${baseId} v${elementVersion} (older version)`
                  );
                }
              }
            });

            // ✅ FALLBACK: If no DOM elements found, try alternative selectors
            if (allElementsWithThisId.length === 0) {
              if ($DebugTestMode) {
                console.log(
                  `📖 ⚠️ No DOM elements found with id="${baseId}", trying alternative selectors`
                );
              }

              // Try data-message-id selector
              const alternativeElements = document.querySelectorAll(
                `[data-message-id="${baseId}"]`
              );

              if ($DebugTestMode) {
                console.log(
                  `📖 🔧 Found ${alternativeElements.length} elements with data-message-id="${baseId}"`
                );
              }

              alternativeElements.forEach((element, index) => {
                const elementVersion =
                  parseInt(element.getAttribute("data-version")) || 1;

                if (elementVersion === highestVersion) {
                  element.style.display = "";
                  if ($DebugTestMode) {
                    console.log(
                      `📖 ✅ Showing ${baseId} v${elementVersion} (latest) - alternative selector`
                    );
                  }
                } else {
                  element.style.display = "none";
                  if ($DebugTestMode) {
                    console.log(
                      `📖 🙈 Hiding ${baseId} v${elementVersion} (older version) - alternative selector`
                    );
                  }
                }
              });
            }
          } else {
            // Only one version exists, make sure it's visible
            const singleVersionMessage = versions[0];
            const messageElement = document.getElementById(
              singleVersionMessage.id
            );

            if (messageElement) {
              messageElement.style.display = "";
              if ($DebugTestMode) {
                console.log(`📖 ✅ Showing ${baseId} (only version)`);
              }
            } else {
              if ($DebugTestMode) {
                console.log(
                  `📖 ⚠️ Could not find DOM element for single version message: ${baseId}`
                );
              }
            }
          }
        });

        if ($DebugTestMode) {
          console.log("📖 ✅ Older versions hidden, latest versions shown");
        }

        // ===== STEP 3: FIND ROOT USER MESSAGE (LATEST VERSION) AND UPDATE DISPLAY =====
        if ($DebugTestMode) {
          console.log(
            "📖 🔧 STEP 3: Finding ROOT user message (no parent) with latest version"
          );
        }

        // Find the ROOT user message (no parentMessageId) with the highest version
        const rootUserMessages = latestMessages.filter(
          (msg) =>
            msg.type === "user" &&
            (!msg.parentMessageId || msg.parentMessageId === null)
        );

        if ($DebugTestMode) {
          console.log("📖 Found root user messages:", rootUserMessages.length);
        }

        if (rootUserMessages.length > 0) {
          // If multiple root messages, get the one with the highest version
          let rootUserMessage = rootUserMessages[0];
          let highestVersion = rootUserMessage.version || 1;

          rootUserMessages.forEach((msg) => {
            const version = msg.version || 1;
            if (version > highestVersion) {
              highestVersion = version;
              rootUserMessage = msg;
            }
          });

          const userMessageId = rootUserMessage.id;
          const targetVersion = rootUserMessage.version || 1;

          if ($DebugTestMode) {
            console.log(
              "📖 🎯 Using ROOT user message for updateMessagesAfterVersion:",
              {
                userMessageId,
                targetVersion,
                hasParent: !!rootUserMessage.parentMessageId,
              }
            );
          }

          // Log the div id content before updating messages
          if ($DebugTestMode) {
            console.log(
              "AI Content Div:",
              document.getElementById("aiContent") || "Element not found"
            );
          }

          // Use messageManager's sophisticated version filtering
          messageManager.updateMessagesAfterVersion(
            userMessageId,
            targetVersion,
            targetVersion
          );

          if ($DebugTestMode) {
            console.log(
              "📖 ✅ messageManager.updateMessagesAfterVersion applied"
            );
          }
        } else {
          if ($DebugTestMode) {
            console.log(
              "📖 ⚠️ No root user message found, showing all latest messages"
            );
          }
          // If no root user message, ensure all latest versions are visible
          latestMessages.forEach((msg) => {
            const messageEl = document.getElementById(msg.id);
            if (messageEl) {
              messageEl.style.display = "";
            }
          });
        }

        // ===== STEP 4: FINAL CLEANUP =====
        if ($DebugTestMode) {
          console.log("📖 🔧 STEP 4: Final cleanup");
        }

        // Update history panel
        this.updateHistoryActiveState(ConversationId);

        // Close history panel on mobile
        if (window.innerWidth < 768) {
          this.toggleHistoryPanel(false);
        }

        // Scroll to bottom
        content.scrollTop = content.scrollHeight;

        if ($DebugTestMode) {
          console.log(
            "📖 ✅ CONVERSATION LOADED - Used ROOT user message with latest version"
          );
        }
      };

      // Start the async message processing
      processMessages().catch((error) => {
        if ($DebugTestMode) {
          console.error("📖 ❌ Error processing messages:", error);
        }
        // Fallback to continue without file content
        continueAfterMessageProcessing();
      });

      // At the very end of the function, after everything is done, restore the title
      if (conversationElement && originalTitleHTML) {
        const titleElement = conversationElement.querySelector(".topic-title");
        if (titleElement) titleElement.innerHTML = originalTitleHTML;
      }

      // Also add error handling to catch any unexpected errors
    } catch (error) {
      if ($DebugTestMode) {
        console.error("📖 ❌ Unexpected error in loadConversation:", error);
      }
      // Restore original title on error
      if (conversationElement && originalTitleHTML) {
        const titleElement = conversationElement.querySelector(".topic-title");
        if (titleElement) titleElement.innerHTML = originalTitleHTML;
      }
    }
  },

  updateHistoryActiveState: function (conversationId) {
    // Remove all active states
    document.querySelectorAll(".topic-item").forEach((el) => {
      el.classList.remove("active");
    });

    const topicElement = document.querySelector(
      `.topic-item[data-conversation-id="${conversationId}"]`
    );
    if (topicElement) {
      topicElement.classList.add("active");
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

  manageStatusIndicators: function (type, action = "add") {
    const historyContent = document.getElementById("historyContent");
    if (!historyContent) return;

    // Define all possible status indicator classes
    const statusTypes = [
      "scroll-loading",
      "no-more-conversations",
      "empty-search-state",
      "empty-history",
    ];

    // Remove ALL existing status indicators first
    statusTypes.forEach((statusClass) => {
      const existingIndicator = historyContent.querySelector(`.${statusClass}`);
      if (existingIndicator) {
        existingIndicator.remove();
      }
    });

    // If action is 'add', create the new indicator
    if (action === "add") {
      let indicator;

      switch (type) {
        case "loading":
          indicator = document.createElement("div");
          indicator.className = "scroll-loading loading";
          indicator.textContent = "Loading more conversations...";
          break;

        case "no-more":
          indicator = document.createElement("div");
          indicator.className = "no-more-conversations";
          indicator.textContent = "No more conversations";
          break;

        case "no-matches":
          indicator = document.createElement("div");
          indicator.className = "empty-search-state empty-history";
          indicator.textContent = "No matching conversations found";
          break;

        case "empty":
          indicator = document.createElement("div");
          indicator.className = "empty-history";
          indicator.textContent = "No conversations yet";
          break;
      }

      if (indicator) {
        historyContent.appendChild(indicator);
      }
    }
  },

  // Now update the searchHistory method to use the new helper
  searchHistory: async function (query) {
    if ($DebugTestMode) {
      console.log("searchHistory called with query:", query);
    }

    if (!query) {
      if ($DebugTestMode) {
        console.log("Empty query, loading full history");
      }
      this.loadHistory();
      return;
    }

    const lowerQuery = query.toLowerCase();
    if ($DebugTestMode) {
      console.log("Searching for:", lowerQuery);
    }

    const historyContent = document.getElementById("historyContent");
    if (!historyContent) {
      if ($DebugTestMode) {
        console.error("historyContent element not found");
      }
      return;
    }

    // Remove ALL existing status indicators
    this.manageStatusIndicators();

    // Get all existing topic items
    const existingTopicItems = historyContent.querySelectorAll(".topic-item");
    let visibleCount = 0;
    let matchingConversations = [];

    if ($DebugTestMode) {
      console.log("Filtering existing conversations...");
    }

    // First, filter existing conversations
    existingTopicItems.forEach((topicItem) => {
      const conversationId = topicItem.dataset.conversationId;
      const topicTitleElement = topicItem.querySelector(".topic-title");

      if (topicTitleElement && conversationId) {
        const topic = topicTitleElement.textContent || "Untitled";

        if (topic.toLowerCase().includes(lowerQuery)) {
          topicItem.style.display = "block";
          visibleCount++;

          // Add to matching conversations for potential backup search
          const conversation = appState.chatHistory[conversationId];
          if (conversation) {
            matchingConversations.push({
              id: conversationId,
              topic: topic,
              messages: conversation.messages || [],
            });
          }
        } else {
          topicItem.style.display = "none";
        }
      }
    });

    if ($DebugTestMode) {
      console.log(`${visibleCount} existing conversations match the search`);
    }

    const MIN_RESULTS = 13;
    const totalConversationsInState = Object.keys(appState.chatHistory).length;
    const MAX_CONVERSATIONS_IN_STATE = 30;

    let backupResultsFound = 0;
    let shouldCheckBackup = false;

    // Check if we need to search backup
    if (totalConversationsInState >= MAX_CONVERSATIONS_IN_STATE) {
      shouldCheckBackup = visibleCount < MIN_RESULTS;
    }

    // Search backup if needed
    if (shouldCheckBackup) {
      // Show loading indicator
      this.manageStatusIndicators("loading");

      try {
        const backupConversations = await this.pullConversationsBackup(
          visibleCount,
          lowerQuery
        );
        if ($DebugTestMode) {
          console.log(
            `Got ${backupConversations.length} matching conversations from backup`
          );
        }

        backupResultsFound = backupConversations.length;

        // Remove loading indicator
        this.manageStatusIndicators();

        // Add backup conversations that aren't already displayed
        backupConversations.forEach((conversation) => {
          // Check if this conversation is already in the DOM
          const existingItem = historyContent.querySelector(
            `[data-conversation-id="${conversation.conversation_id}"]`
          );

          if (!existingItem) {
            if ($DebugTestMode) {
              console.log("Adding backup conversation to DOM");
            }
            // Create new topic item for backup conversation
            const topicItem = this.createTopicItemHTML(conversation);
            historyContent.insertAdjacentHTML("beforeend", topicItem);
            visibleCount++;
            this.setupEventDelegation();
          }
        });
      } catch (error) {
        if ($DebugTestMode) {
          console.error("Failed to pull backup conversations:", error);
        }
        // Remove loading indicator on error
        this.manageStatusIndicators();
      }
    } else if (visibleCount < MIN_RESULTS) {
      if ($DebugTestMode) {
        console.log(
          `Only ${visibleCount} matches found, but user only has ${totalConversationsInState} total conversations, so no backup to search.`
        );
      }
    }

    // FIXED: Count actually visible conversation items
    const visibleItems = Array.from(
      historyContent.querySelectorAll(".topic-item")
    ).filter((item) => item.style.display !== "none").length;

    if ($DebugTestMode) {
      console.log(`Visible items count: ${visibleItems}`);
    }

    if (visibleItems === 0) {
      if ($DebugTestMode) {
        console.log("No matches found, showing empty state");
      }
      this.manageStatusIndicators("no-matches");
    } else if (shouldCheckBackup && backupResultsFound === 0) {
      // Only show "No more conversations" if we searched backup and found nothing
      this.manageStatusIndicators("no-more");
    }

    if ($DebugTestMode) {
      console.log(
        `Search completed. ${visibleItems} conversations visible. ${backupResultsFound} from backup.`
      );
    }
  },

  // Helper function to create topic item HTML (you may need to adjust this based on your existing structure)
  createTopicItemHTML: function (conversation) {
    if ($DebugTestMode) {
      console.log("Creating topic item HTML for conversation:", conversation);
    }

    const topic = conversation.topic || "Untitled";
    if ($DebugTestMode) {
      console.log("Topic:", topic);
    }

    const conversationId = conversation.conversation_id;
    if ($DebugTestMode) {
      console.log("Conversation ID:", conversationId);
    }

    const isCurrentConversation =
      conversationId === appState.currentConversationId;
    if ($DebugTestMode) {
      console.log("Is current conversation:", isCurrentConversation);
    }

    const timeAgo = this.getTimeAgo(conversation.timestamp);
    if ($DebugTestMode) {
      console.log("Time ago:", timeAgo);
    }

    const html = `
  <div class="topic-item ${
    isCurrentConversation ? "active" : ""
  }" data-conversation-id="${conversationId}">
    <div class="topic-header" data-topic-id="${conversationId}" data-conversation-id="${conversationId}">
      <span class="topic-title">${topic}</span>
      <div class="topic-meta">
        <span class="topic-date" style="font-size: 12px;">Last message sent ${timeAgo}</span>
      </div>
    </div>
  </div>
  `;

    if ($DebugTestMode) {
      console.log("Generated HTML:", html);
    }
    return html;
  },

  pullConversationsBackup: async function (visibleCount, query) {
    if ($DebugTestMode) {
      console.log(
        `Pulling up to ${visibleCount} backup conversations matching: ${query}`
      );
      console.log(
        "🔑 Checking authentication token...",
        appState.authState.token
      );
      console.log("🔑 Current authentication state:", appState.isAuthenticated);
    }

    // Check authentication first
    if (!appState.isAuthenticated || !appState.authState.token) {
      if ($DebugTestMode) {
        console.warn(
          "⚠️ Not authenticated - skipping backup conversations pull"
        );
      }
      return Promise.reject(new Error("Not authenticated"));
    }

    const token = localStorage.getItem(CONFIG.STORAGE_KEYS.TOKEN);
    if (!token) {
      if ($DebugTestMode) {
        console.warn("⚠️ No token found - skipping backup conversations pull");
      }
      return Promise.reject(new Error("No token found"));
    }

    try {
      if ($DebugTestMode) {
        console.log("🔑 Token found, making backup conversations request...");
      }

      // Extract existing conversation IDs
      const existingConversationIds = [];
      if (
        appState?.chatHistory &&
        typeof appState.chatHistory === "object" &&
        !Array.isArray(appState.chatHistory)
      ) {
        Object.keys(appState.chatHistory).forEach((conversationKey) => {
          if (conversationKey && conversationKey.startsWith("conv_")) {
            existingConversationIds.push(conversationKey);
          }
        });
        if ($DebugTestMode) {
          console.log(
            `🗂️ Found ${existingConversationIds.length} existing conversations to exclude`
          );
        }
      }

      // Make API request
      const requestUrl = `${CONFIG.BACKEND_URL}/api/index.php?endpoint=conversations_backup_search`;
      const requestBody = {
        token: token,
        visibleCount: visibleCount,
        query: query,
        exclude_conversation_ids: existingConversationIds,
      };

      const response = await fetch(requestUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
      });

      if ($DebugTestMode) {
        console.log("✅ Fetch response received, status:", response.status);
        console.log("✅ Fetch response:", response);
      }

      if (!response.ok) {
        const errorText = await response.text();
        if ($DebugTestMode) {
          console.error("❌ Server error response:", errorText);
        }
        throw new Error(
          `HTTP error ${response.status}: ${errorText.substring(0, 100)}`
        );
      }

      // Safely parse response with error handling for non-JSON responses
      const responseText = await response.text();
      let data;

      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        if ($DebugTestMode) {
          console.error("❌ Failed to parse JSON response:", parseError);
          console.error("Raw response:", responseText.substring(0, 200));
        }

        // Check if this looks like an HTML error page
        if (
          responseText.includes("<!DOCTYPE") ||
          responseText.includes("<html") ||
          responseText.includes("<br />")
        ) {
          throw new Error(
            "Server returned HTML instead of JSON. Check backend for PHP errors."
          );
        }

        throw new Error("Invalid JSON response from server");
      }

      if ($DebugTestMode) {
        console.log("✅ JSON response received:", data);
      }

      // Process results
      if (data.results && Array.isArray(data.results)) {
        let addedCount = 0;
        let skippedCount = 0;

        data.results.forEach((conversation) => {
          if (
            conversation.conversation_id &&
            conversation.topic &&
            conversation.timestamp
          ) {
            const convKey = conversation.conversation_id;

            // Convert timestamp to ISO 8601 format - handle both Unix timestamps and string formats
            let isoTimestamp;
            try {
              // Check if timestamp is a Unix timestamp (number or numeric string)
              if (/^\d+$/.test(conversation.timestamp)) {
                // Unix timestamp (seconds)
                const date = new Date(parseInt(conversation.timestamp) * 1000);
                isoTimestamp = date.toISOString();
              } else if (typeof conversation.timestamp === "string") {
                // String timestamp like "2025-09-10 18:15:52.000000"
                // Replace space with 'T' and add 'Z' to make it ISO 8601 compliant
                const isoString =
                  conversation.timestamp.replace(" ", "T") + "Z";
                const date = new Date(isoString);

                // Validate the date
                if (isNaN(date.getTime())) {
                  if ($DebugTestMode) {
                    console.warn(
                      `⚠️ Invalid timestamp format: ${conversation.timestamp}`
                    );
                  }
                  isoTimestamp = new Date().toISOString();
                } else {
                  isoTimestamp = date.toISOString();
                }
              } else {
                // Fallback to current time
                isoTimestamp = new Date().toISOString();
              }
            } catch (error) {
              if ($DebugTestMode) {
                console.warn(
                  `⚠️ Error parsing timestamp ${conversation.timestamp}:`,
                  error
                );
              }
              isoTimestamp = new Date().toISOString();
            }

            // Only add if the conversation ID doesn't already exist
            if (!appState.chatHistory[convKey]) {
              appState.chatHistory[convKey] = {
                messages: [],
                topic: conversation.topic,
                timestamp: isoTimestamp,
              };
              addedCount++;
            } else {
              skippedCount++;
            }
          }
        });

        if ($DebugTestMode) {
          console.log(
            `✅ Added ${addedCount} new conversations, skipped ${skippedCount} existing ones`
          );
        }
        return data.results;
      } else {
        if ($DebugTestMode) {
          console.warn("⚠️ No results array in response or invalid format");
        }
        return [];
      }
    } catch (error) {
      if ($DebugTestMode) {
        console.error("❌ Error pulling backup conversations:", error);
      }

      // Re-throw the error to maintain the Promise chain
      if (
        error.message.includes("HTTP error") ||
        error.message.includes("Invalid JSON")
      ) {
        throw error; // Re-throw server errors
      }

      return []; // Return empty array for other errors
    }
  },

  // Enhanced topic fetcher
  getConversationTopic: async function (conversationId) {
    if ($DebugTestMode) {
      console.log(
        `Starting to fetch topic for conversation ID: ${conversationId}`
      );
    }

    // First check in current chatHistory
    if ($DebugTestMode) {
      console.log(
        `Checking if topic exists in chatHistory for conversation ${conversationId}`
      );
    }
    if (appState.chatHistory[conversationId]?.topic) {
      if ($DebugTestMode) {
        console.log(
          `Topic found in chatHistory: ${appState.chatHistory[conversationId].topic.title}`
        );
        console.log(
          `Returning topic:`,
          appState.chatHistory[conversationId].topic
        );
      }
      return appState.chatHistory[conversationId].topic;
    } else {
      if ($DebugTestMode) {
        console.log(
          `No topic found in chatHistory for conversation ${conversationId}`
        );
      }
    }
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

// Export for use in main module
if (typeof module !== "undefined" && module.exports) {
  module.exports = historyManager;
}
