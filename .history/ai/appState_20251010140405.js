// appState.js - Enhanced Global State Management with Context+
"use strict";

if (typeof $DebugTestMode === "undefined") {
  $DebugTestMode = true;
}

var appState = {
  isAuthenticated: false,
  currentUser: null,
  selectedAIModel: "deepseek-r1",
  chatHistory: [],
  authState: {
    isAuthenticated: false,
    user: null,
    token: null,
  },
  currentConversationId: null,

  // Context+ State
  contextPlusEnabled: false,
  contextPlusMemories: [],
  contextPlusLoading: false,

  updateAuth: function (authData) {
    if ($DebugTestMode) {
      console.log(
        "Updating auth state 🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍:",
        authData
      );
    }
    this.isAuthenticated = authData.isAuthenticated;
    this.currentUser = authData.user;
    this.authState = authData;
  },

  saveToStorage: function () {
    try {
      localStorage.setItem(
        CONFIG.STORAGE_KEYS.CHAT_HISTORY,
        JSON.stringify(this.chatHistory)
      );
      localStorage.setItem(
        CONFIG.STORAGE_KEYS.SELECTED_MODEL,
        this.selectedAIModel
      );

      // Save Context+ preference
      localStorage.setItem(
        CONFIG.STORAGE_KEYS.CONTEXT_PLUS,
        this.contextPlusEnabled
      );
    } catch (error) {
      if ($DebugTestMode) {
        console.error("Failed to save app state:", error);
      }
    }
  },

  loadFromStorage: function () {
    try {
      const token = localStorage.getItem(CONFIG.STORAGE_KEYS.TOKEN);
      const userData = localStorage.getItem(CONFIG.STORAGE_KEYS.USER);

      if (token && userData) {
        if ($DebugTestMode) {
          console.log("Restoring auth state from local storage", {
            token,
            userData,
          });
        }
        this.updateAuth({
          isAuthenticated: true,
          token: token,
          user: JSON.parse(userData),
        });
      }

      const savedHistory = localStorage.getItem(
        CONFIG.STORAGE_KEYS.CHAT_HISTORY
      );
      const savedModel = localStorage.getItem(
        CONFIG.STORAGE_KEYS.SELECTED_MODEL
      );

      // Load Context+ preference
      const savedContextPlus = localStorage.getItem(
        CONFIG.STORAGE_KEYS.CONTEXT_PLUS
      );

      // Debug chat history loading
      if ($DebugTestMode) {
        console.log("🔍 Chat History Debug - Raw saved history:", savedHistory);
        console.log(
          "🔍 Chat History Debug - Saved history exists:",
          !!savedHistory
        );
      }

      if (savedHistory) {
        this.chatHistory = JSON.parse(savedHistory);
        if ($DebugTestMode) {
          console.log(
            "🔍 Chat History Debug - Parsed chat history:",
            this.chatHistory
          );

          // Fix: Check object keys instead of array length
          const historyKeys = Object.keys(this.chatHistory || {});
          console.log(
            "🔍 Chat History Debug - Chat history keys count:",
            historyKeys.length
          );
          console.log(
            "🔍 Chat History Debug - Chat history keys:",
            historyKeys
          );
        }
      } else {
        if ($DebugTestMode) {
          console.log(
            "🔍 Chat History Debug - No saved history found, chatHistory will remain:",
            this.chatHistory
          );
        }
      }

      if (savedModel) this.selectedAIModel = savedModel;

      if (savedContextPlus === "true") this.contextPlusEnabled = true;

      if ($DebugTestMode) {
        console.log(
          "chat history restored from local storage!!!",
          this.chatHistory
        );
        console.log("App state loaded from storage");
        console.log("Context+ enabled:", this.contextPlusEnabled);
      }
    } catch (error) {
      if ($DebugTestMode) {
        console.error("Failed to load app state:", error);
      }
      // Initialize empty state on error
      this.contextPlusEnabled = false;
    }

    if ($DebugTestMode) {
      console.log("📥 === LOAD FROM STORAGE DEBUG COMPLETE ===");

      // Simplified Debug - Essential Info Only
      console.log("chatHistory:", this.chatHistory);
      console.log("isAuthenticated:", this.isAuthenticated);
      console.log(
        "Prototype properties:",
        Object.keys(Object.getPrototypeOf(this.chatHistory))
      );
      const hasProperties =
        Object.getOwnPropertyNames(this.chatHistory).length > 0 ||
        Object.keys(this.chatHistory).length > 0 ||
        Object.getOwnPropertySymbols(this.chatHistory).length > 0 ||
        Object.keys(Object.getPrototypeOf(this.chatHistory)).length > 0;

      console.log("Is chatHistory empty?", !hasProperties);
      console.log("Enumerable keys:", Object.keys(this.chatHistory));
      console.log(
        "All property names:",
        Object.getOwnPropertyNames(this.chatHistory)
      );
      console.log(
        "Object.getOwnPropertyNames(chatHistory):",
        Object.getOwnPropertyNames(this.chatHistory)
      );
      console.log(
        "Object.keys(this.chatHistory)",
        Object.keys(this.chatHistory)
      );
      console.log(
        "Object.keys(this.chatHistory).length",
        Object.keys(this.chatHistory).length
      );
      for (let key in this.chatHistory) {
        console.log("Property:", key);
      }
      // Get all property descriptors
      console.log(
        "All descriptors:",
        Object.getOwnPropertyDescriptors(this.chatHistory)
      );
      console.log(
        "Symbol keys:",
        Object.getOwnPropertySymbols(this.chatHistory)
      );

      // Test 1: Check if it's actually a string pretending to be an object
      console.log("1. Type check:", typeof this.chatHistory);
      console.log("2. Constructor:", this.chatHistory.constructor.name);
      console.log("3. Is it a string?", typeof this.chatHistory === "string");

      // Test 2: Check if it's a primitive with weird toString
      console.log("4. String conversion:", String(this.chatHistory));
      console.log("5. JSON.stringify:", JSON.stringify(this.chatHistory));

      // Test 3: Check if someone messed with toString/valueOf
      console.log(
        "6. Has custom toString?",
        this.chatHistory.toString !== Object.prototype.toString
      );
      console.log("7. toString result:", this.chatHistory.toString());

      // Test 4: Check if it's an object with weird property descriptors
      console.log(
        "8. Property descriptors:",
        Object.getOwnPropertyDescriptors(this.chatHistory)
      );
    }

    if (
      (Object.getOwnPropertyNames(this.chatHistory).length < 30 ||
        Object.keys(this.chatHistory).length < 30) &&
      this.isAuthenticated
    ) {
      if ($DebugTestMode) {
        console.log("🚨 FALLBACK WILL BE TRIGGERED BECAUSE:", this.chatHistory);
      }
      this.fallbackchatHistoryPull();
    } else {
      if ($DebugTestMode) {
        console.log(
          "✅ Fallback chat history pull skipped - conversations exist"
        );
      }

      historyManager.loadHistory();
    }
  },

  fallbackchatHistoryPull: async function (specificConversationId = null) {
    if ($DebugTestMode) {
      console.log("📚 === FALLBACK CHAT HISTORY PULL (SIMPLIFIED VERSION) ===");
      console.log("📚 Starting simplified fallback chat history retrieval...");
    }

    // Check authentication first
    if (!this.isAuthenticated || !this.authState.token) {
      if ($DebugTestMode) {
        console.warn(
          "📚 ⚠️ Not authenticated - skipping fallback history pull"
        );
      }
      return Promise.reject(new Error("Not authenticated"));
    }

    const token = localStorage.getItem(CONFIG.STORAGE_KEYS.TOKEN);
    if (!token) {
      if ($DebugTestMode) {
        console.warn("📚 ⚠️ No token found - skipping fallback history pull");
      }
      return Promise.reject(new Error("No token found"));
    }

    if ($DebugTestMode) {
      console.log("📚 🔑 Token found, making fallback request...");
    }
    const requestUrl = `${CONFIG.BACKEND_URL}/api/index.php?endpoint=chat_history`;

    // Get list of conversation IDs already in chatHistory to exclude
    const excludedConversations = Object.keys(this.chatHistory || {});
    if ($DebugTestMode) {
      console.log(
        "📚 🚫 Excluding existing conversations:",
        excludedConversations
      );
    }

    // Calculate limit: 30 minus excluded conversations count
    const limit = 30 - excludedConversations.length;
    if ($DebugTestMode) {
      console.log(
        "📚 📊 Setting limit to:",
        limit,
        "(30 -",
        excludedConversations.length,
        "excluded conversations)"
      );
    }

    const requestBody = {
      token: token,
      include_messages: true,
      include_files: true,
      include_attachments: true,
      include_conversation_data: true,
      include_response_metadata: true,
      sort_order: "desc",
      include_metadata: true,
      detailed_responses: true,
      excluded_conversations: excludedConversations, // Add excluded conversations list
      limit: limit > 0 ? limit : 1, // Ensure at least 1 limit
    };

    // Add specific conversation ID if provided
    if (specificConversationId) {
      if ($DebugTestMode) {
        console.log(
          "📚 🎯 Specific conversation ID requested:",
          specificConversationId
        );
      }
      requestBody.specificConversationId = specificConversationId;
      // Override limit and exclusions for specific conversation
      requestBody.limit = 1;
      requestBody.excluded_conversations = [];
    }

    return fetch(requestUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(requestBody),
    })
      .then(async (response) => {
        if ($DebugTestMode) {
          console.log(
            "📚 ✅ Fetch response received, status:",
            response.status
          );
        }

        // First, get the response text regardless of content type
        const responseText = await response.text();

        // Try to parse as JSON first - if it succeeds, it's valid regardless of content
        try {
          const jsonData = JSON.parse(responseText);

          // Even if it parsed successfully, check if it's actually an error response
          if (jsonData && jsonData.success === false && response.ok) {
            if ($DebugTestMode) {
              console.error(
                "📚 ❌ Server returned error with 200 status:",
                jsonData
              );
            }
            throw new Error(`Server error: ${JSON.stringify(jsonData)}`);
          }

          return jsonData;
        } catch (e) {
          // If JSON parsing failed, then check if it's HTML/error content
          const isLikelyErrorHtml =
            responseText.trim().startsWith("<") ||
            responseText.includes("<br />") ||
            responseText.includes("<b>") ||
            responseText.includes("Error:") ||
            responseText.includes("Exception:");

          if (isLikelyErrorHtml && response.ok) {
            if ($DebugTestMode) {
              console.error(
                "📚 ❌ Server returned HTML/error content with 200 status:",
                responseText
              );
            }
            throw new Error(
              `Server error: ${responseText.substring(0, 200)}...`
            );
          }

          // Check for regular HTTP errors (4xx, 5xx)
          if (!response.ok) {
            if ($DebugTestMode) {
              console.error(
                "📚 ❌ Non-OK response status:",
                response.status,
                "Content:",
                responseText
              );
            }
            throw new Error(
              `HTTP error ${response.status}: ${responseText.substring(
                0,
                200
              )}...`
            );
          }

          // If we get here, it's neither JSON nor obvious HTML, but has 200 status
          if ($DebugTestMode) {
            console.error(
              "📚 ❌ Failed to parse response as JSON:",
              responseText
            );
          }
          throw new Error(
            `Invalid response: ${responseText.substring(0, 200)}...`
          );
        }
      })
      .then((data) => {
        if ($DebugTestMode) {
          console.log("📚 ✅ JSON response received:", data);
        }

        if (
          data.success &&
          data.conversations &&
          Array.isArray(data.conversations)
        ) {
          if ($DebugTestMode) {
            console.log("📚 🔄 Processing conversations...");
          }

          let totalMessagesLoaded = 0;
          let totalAIMessages = 0;
          let totalUserMessages = 0;

          // Process each conversation
          data.conversations.forEach((conversation, index) => {
            if ($DebugTestMode) {
              console.log(`📚 📝 === PROCESSING CONVERSATION ${index + 1} ===`);
            }

            if (!conversation.conversation_id) {
              if ($DebugTestMode) {
                console.warn(
                  "📚 ⚠️ Conversation missing conversation_id, skipping"
                );
              }
              return;
            }

            const conversationKey = conversation.conversation_id;

            // Check if this is the specific conversation we want to replace
            const isSpecificConversation =
              conversationKey === specificConversationId;

            // If it's the specific conversation, remove the existing one
            if (isSpecificConversation && this.chatHistory[conversationKey]) {
              if ($DebugTestMode) {
                console.log(
                  `📚 🔄 Replacing existing conversation: ${conversationKey}`
                );
              }
              delete this.chatHistory[conversationKey];
            }

            // Skip if conversation already exists (unless it's the specific one we're replacing)
            if (this.chatHistory[conversationKey] && !isSpecificConversation) {
              if ($DebugTestMode) {
                console.log(
                  `📚 ⚠️ Conversation ${conversationKey} already exists, skipping`
                );
              }
              return;
            }

            // Group memories by message_id and sort by version
            const memoriesByMessageId = new Map();

            if (conversation.memories && Array.isArray(conversation.memories)) {
              if ($DebugTestMode) {
                console.log(
                  `📚 💭 Found ${conversation.memories.length} memories, grouping by message_id...`
                );
              }

              conversation.memories.forEach((memory) => {
                const messageId = memory.message_id;
                const version = memory.version || 1;

                if (!memoriesByMessageId.has(messageId)) {
                  memoriesByMessageId.set(messageId, []);
                }

                memoriesByMessageId.get(messageId).push({
                  ...memory,
                  version: version,
                });

                if ($DebugTestMode) {
                  console.log(
                    `📚 💭 Grouped memory version ${version} for message ${messageId}, parent_message_id: ${memory.parent_message_id}`
                  );
                }
              });

              // Sort memories by version within each message group
              memoriesByMessageId.forEach((memories, messageId) => {
                memories.sort((a, b) => a.version - b.version);
                if ($DebugTestMode) {
                  console.log(
                    `📚 📊 Message ${messageId} has ${
                      memories.length
                    } versions: ${memories.map((m) => m.version).join(", ")}`
                  );
                }
              });
            }

            if (memoriesByMessageId.size === 0) {
              if ($DebugTestMode) {
                console.log(
                  `📚 ⚠️ No memories found for conversation ${conversationKey}`
                );
              }
              return;
            }

            // Initialize conversation object with messages array
            if (!this.chatHistory[conversationKey]) {
              this.chatHistory[conversationKey] = {
                messages: [],
                topic: null, // Will be set from the last message's title
                timestamp: null, // Will be set from the last message's timestamp
              };
              if ($DebugTestMode) {
                console.log(
                  `📚 ✅ Created conversation object: ${conversationKey}`
                );
              }
            }

            let conversationMessages = [];
            let aiResponseCount = 0;
            let lastMessageTimestamp = 0;
            let lastMemoryWithTitle = null;
            let conversationTimestamp = null; // Store the latest timestamp for the conversation

            // Process each message group
            memoriesByMessageId.forEach((memories, baseMessageId) => {
              if ($DebugTestMode) {
                console.log(`📚 🔄 Processing message group: ${baseMessageId}`);
              }

              memories.forEach((memory, versionIndex) => {
                const version = memory.version;
                const isFirstVersion = versionIndex === 0;
                const memoryParent_message_id = memory.parent_message_id || "";

                if ($DebugTestMode) {
                  console.log(
                    `📚 ⏰ Memory ${memory.id} has conversation_data timestamp: ${memory.conversation_data?.timestamp}`
                  );
                  console.log(
                    `📚 👥 Memory ${memory.id} has parent_message_id: "${memoryParent_message_id}"`
                  );
                }

                if (
                  memory.conversation_data?.messages &&
                  Array.isArray(memory.conversation_data.messages)
                ) {
                  if ($DebugTestMode) {
                    console.log(
                      `📚 💬 Processing version ${version} with ${memory.conversation_data.messages.length} messages`
                    );
                  }

                  memory.conversation_data.messages.forEach(
                    (message, msgIndex) => {
                      const isAIMessage =
                        message.role === "assistant" || message.role === "ai";
                      let messageId;
                      let parent_message_id = null;

                      // Check if this memory has the latest timestamp (only check once per memory, not per message)
                      if (versionIndex === 0 && msgIndex === 0) {
                        const currentTimestamp =
                          memory.conversation_data.timestamp || 0;
                        if ($DebugTestMode) {
                          console.log(
                            `📚 ⏰ Checking timestamp for memory ${memory.id}: ${currentTimestamp} vs current best: ${lastMessageTimestamp}`
                          );
                        }
                        if (currentTimestamp > lastMessageTimestamp) {
                          lastMessageTimestamp = currentTimestamp;
                          lastMemoryWithTitle = memory;
                          conversationTimestamp = currentTimestamp; // Set conversation timestamp
                          if ($DebugTestMode) {
                            console.log(
                              `📚 ⏰ ✅ NEW BEST! Updated to memory with timestamp: ${currentTimestamp}, title: "${memory.title}"`
                            );
                          }
                        } else {
                          if ($DebugTestMode) {
                            console.log(
                              `📚 ⏰ ❌ Not newer than current best timestamp`
                            );
                          }
                        }
                      }

                      if (isAIMessage) {
                        // Generate unique ID for AI message
                        messageId = `msg_${Date.now()}_${Math.random()
                          .toString(36)
                          .substr(2, 9)}`;

                        // AI message's parent is the user message with version suffix
                        // The memory's message_id is the user message ID, so we use that + version
                        parent_message_id = `${baseMessageId}.v${version}`;

                        if ($DebugTestMode) {
                          console.log(
                            `📚 🤖 AI message ${messageId} for version ${version}, parent: ${parent_message_id}`
                          );
                        }
                        aiResponseCount++;
                        totalAIMessages++;
                      } else {
                        // User message ID handling
                        if (isFirstVersion) {
                          messageId = baseMessageId;
                          // User message's parent comes from memory's parent_message_id
                          parent_message_id = memoryParent_message_id || null;
                          if ($DebugTestMode) {
                            console.log(
                              `📚 👤 User message (v${version}): ${messageId}, parent: ${parent_message_id}`
                            );
                          }
                        } else {
                          messageId = baseMessageId;
                          // For subsequent versions, parent is still the same
                          parent_message_id = memoryParent_message_id || null;
                          if ($DebugTestMode) {
                            console.log(
                              `📚 👤 User message (v${version}): ${messageId} (version ${version}), parent: ${parent_message_id}`
                            );
                          }
                        }
                        totalUserMessages++;
                      }

                      // Extract clean content and metadata
                      let cleanContent = message.content || "";
                      let extractedMetadata = {};

                      if (isAIMessage && cleanContent.includes("[METADATA]")) {
                        const metadataMatch = cleanContent.match(
                          /\[METADATA\](.*?)\[\/METADATA\]/s
                        );
                        if (metadataMatch) {
                          const metadataSection = metadataMatch[1];
                          cleanContent = cleanContent
                            .replace(/\[METADATA\].*?\[\/METADATA\]/s, "")
                            .trim();

                          // Parse metadata fields
                          const titleMatch =
                            metadataSection.match(/TITLE:\s*(.+)/);
                          const newTopicMatch = metadataSection.match(
                            /NEW_TOPIC:\s*(true|false)/
                          );

                          if (titleMatch)
                            extractedMetadata.title = titleMatch[1].trim();
                          if (newTopicMatch)
                            extractedMetadata.newTopic =
                              newTopicMatch[1] === "true";
                        }
                      }

                      // Convert Unix timestamp to ISO 8601 format
                      let isoTimestamp;
                      if (memory.timestamp) {
                        const date = new Date(memory.timestamp * 1000); // Convert to MILLISECONDS
                        isoTimestamp = date.toISOString();
                      } else if (message.timestamp) {
                        const date = new Date(message.timestamp * 1000); // Convert to MILLISECONDS
                        isoTimestamp = date.toISOString();
                      } else if (conversation.created_at) {
                        const date = new Date(conversation.created_at * 1000); // Convert to MILLISECONDS
                        isoTimestamp = date.toISOString();
                      } else {
                        isoTimestamp = new Date().toISOString();
                      }

                      // Create message entry
                      const messageEntry = {
                        id: messageId,
                        text: cleanContent,
                        type: isAIMessage ? "ai" : "user",
                        messageType: isAIMessage ? "AI Response" : "",
                        timestamp: isoTimestamp,

                        // Parent-child relationship
                        parent_message_id: parent_message_id,

                        conversation_id: conversation.conversation_id,

                        version: version,

                        // Model and other properties
                        model:
                          message.model ||
                          this.selectedAIModel ||
                          "deepseek-chat",
                        files: [],
                        has_files: false,
                        file_count: 0,
                        isEdited: false,
                        editedAt: null,
                        originalText: null,
                        isRetry: false,
                        retryOf: null,

                        // Metadata
                        ...extractedMetadata,
                      };

                      conversationMessages.push(messageEntry);
                      totalMessagesLoaded++;

                      if ($DebugTestMode) {
                        console.log(
                          `📚 ✅ Added message: ${messageEntry.id} (${messageEntry.type}) v${messageEntry.version}, parent: ${messageEntry.parent_message_id}, timestamp: ${messageEntry.timestamp}`
                        );
                      }
                    }
                  );
                }
              });
            });

            // Sort messages by timestamp to maintain conversation flow
            conversationMessages.sort((a, b) => {
              const timeA = new Date(a.timestamp).getTime();
              const timeB = new Date(b.timestamp).getTime();
              if (timeA !== timeB) return timeA - timeB;

              // If same timestamp, sort by message type (user first, then ai)
              if (a.type !== b.type) {
                return a.type === "user" ? -1 : 1;
              }

              // If same type and timestamp, sort by version
              return a.version - b.version;
            });

            // Extract topic title from the most recent memory's title field
            let topicTitle = null;
            if ($DebugTestMode) {
              console.log(
                `📚 🏆 FINAL: Selected memory for topic title - timestamp: ${lastMessageTimestamp}, memory ID: ${lastMemoryWithTitle?.id}`
              );
            }
            if (lastMemoryWithTitle && lastMemoryWithTitle.title) {
              topicTitle = lastMemoryWithTitle.title;
              if ($DebugTestMode) {
                console.log(
                  `📚 📋 ✅ Extracted topic title from memory: "${topicTitle}"`
                );
              }
            } else {
              if ($DebugTestMode) {
                console.log(
                  `📚 📋 ❌ No memory with title found, using fallback`
                );
              }
            }

            // Convert conversation timestamp to ISO format if it exists
            let conversationIsoTimestamp;
            if (conversationTimestamp) {
              const date = new Date(conversationTimestamp * 1000); // Convert to MILLISECONDS
              conversationIsoTimestamp = date.toISOString();
            } else if (conversation.created_at) {
              const date = new Date(conversation.created_at * 1000); // Convert to MILLISECONDS
              conversationIsoTimestamp = date.toISOString();
            } else {
              conversationIsoTimestamp = new Date().toISOString();
            }

            // Store messages and topic in the conversation structure
            if (conversationMessages.length > 0) {
              this.chatHistory[conversationKey] = {
                messages: conversationMessages,
                topic: topicTitle || `Conversation ${conversationKey}`, // Fallback title
                timestamp: conversationIsoTimestamp, // Set conversation timestamp in ISO format
              };
              if ($DebugTestMode) {
                console.log(
                  `📚 ✅ Stored ${conversationMessages.length} messages for conversation: ${conversationKey} with topic: "${this.chatHistory[conversationKey].topic}" and timestamp: ${this.chatHistory[conversationKey].timestamp}`
                );
              }
            }

            if ($DebugTestMode) {
              console.log(
                `📚 📝 === END PROCESSING CONVERSATION ${index + 1} ===\n`
              );
            }
          });

          // Save state and update UI
          this.saveToStorage();
          if ($DebugTestMode) {
            console.log("📚 ✅ State saved to storage");
          }

          // Update UI components
          if (
            typeof historyManager !== "undefined" &&
            historyManager.loadHistory
          ) {
            if ($DebugTestMode) {
              console.log("📚 🔄 Refreshing history panel...");
            }
            setTimeout(() => {
              historyManager.loadHistory();
            }, 100);
          }

          if ($DebugTestMode) {
            console.log("📚 ✅ === FALLBACK CHAT HISTORY PULL COMPLETED ===");
            console.log("📚 📊 === FINAL STATISTICS ===");
            console.log(
              "📚 📊 Total conversations loaded:",
              Object.keys(this.chatHistory).length
            );
            console.log("📚 📊 Total messages loaded:", totalMessagesLoaded);
            console.log("📚 📊 AI messages:", totalAIMessages);
            console.log("📚 📊 User messages:", totalUserMessages);
            console.log(
              "📚 📊 Current conversation ID:",
              this.currentConversationId
            );
            console.log("📚 🗂️ === COMPLETE CHAT HISTORY DUMP ===");
            console.log("📚 🗂️ Full chatHistory object:", this.chatHistory);

            // Log each conversation separately for better readability
            Object.keys(this.chatHistory).forEach((conversationId, index) => {
              const conversation = this.chatHistory[conversationId];
              console.log(
                `📚 🗂️ === CONVERSATION ${index + 1}: ${conversationId} ===`
              );
              console.log(`📚 🗂️ Topic: "${conversation.topic}"`);
              console.log(`📚 🗂️ Timestamp: ${conversation.timestamp}`);
              console.log(
                `📚 🗂️ Message count: ${conversation.messages.length}`
              );
              console.log(`📚 🗂️ Messages:`, conversation.messages);

              // Log parent-child relationships for debugging
              conversation.messages.forEach((msg, idx) => {
                console.log(
                  `📚 🔗 Message ${idx + 1}: ${msg.id} (${
                    msg.type
                  }) -> parent: ${
                    msg.parent_message_id || "none"
                  }, timestamp: ${msg.timestamp}`
                );
              });

              console.log(`📚 🗂️ === END CONVERSATION ${index + 1} ===\n`);
            });
          }

          return {
            success: true,
            conversationsLoaded: data.conversations.length,
            messagesLoaded: totalMessagesLoaded,
            aiMessagesLoaded: totalAIMessages,
            userMessagesLoaded: totalUserMessages,
          };
        } else {
          if ($DebugTestMode) {
            console.warn("📚 ⚠️ No conversations array in response");
          }
          return {
            success: true,
            conversationsLoaded: 0,
            messagesLoaded: 0,
          };
        }
      })
      .catch((error) => {
        if ($DebugTestMode) {
          console.error("📚 ❌ Fallback chat history pull failed:", error);
        }
        throw error;
      });
  },

  getUserFilesFallback: async function (fileName, conversationId) {
    if ($DebugTestMode) {
      console.log("📁 === USER FILES FALLBACK RETRIEVAL ===");
      console.log(
        `📁 Starting user files retrieval for file: ${fileName}, conversation: ${conversationId}`
      );
    }

    // Check authentication first
    if (!this.isAuthenticated || !this.authState.token) {
      if ($DebugTestMode) {
        console.warn("📁 ⚠️ Not authenticated - skipping user files retrieval");
      }
      return Promise.reject(new Error("Not authenticated"));
    }

    const token = localStorage.getItem(CONFIG.STORAGE_KEYS.TOKEN);
    if (!token) {
      if ($DebugTestMode) {
        console.warn("📁 ⚠️ No token found - skipping user files retrieval");
      }
      return Promise.reject(new Error("No token found"));
    }

    // Validate required parameters
    if (!fileName || !conversationId) {
      if ($DebugTestMode) {
        console.error(
          "📁 ❌ Missing required parameters: fileName, conversationId"
        );
      }
      return Promise.reject(
        new Error("Missing required parameters: fileName, conversationId")
      );
    }

    if ($DebugTestMode) {
      console.log("📁 🔑 Token found, making user files request...");
    }
    const requestUrl = `${CONFIG.BACKEND_URL}/api/index.php?endpoint=user_files`;

    const requestBody = {
      token: token,
      file_id: fileName,
      conversation_id: conversationId,
      include_file_data: true,
      include_metadata: true,
      include_thumbnails: true,
      detailed_response: true,
    };

    try {
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
        console.log("📁 ✅ Fetch response received, status:", response.status);
      }

      if (!response.ok) {
        if ($DebugTestMode) {
          console.error("📁 ❌ Non-OK response status:", response.status);
        }
        throw new Error(`HTTP error ${response.status}`);
      }

      const text = await response.text();
      let data;

      try {
        data = JSON.parse(text);
      } catch (e) {
        if ($DebugTestMode) {
          console.error("📁 ❌ Response is not JSON:", text);
        }
        throw new Error(`Invalid JSON response: ${text.substring(0, 100)}...`);
      }

      if ($DebugTestMode) {
        console.log("📁 ✅ JSON response received:", data);
      }

      // Handle the response structure - extract the file directly
      if (data.success && data.file_found && data.file) {
        if ($DebugTestMode) {
          console.log("📁 ✅ File found, returning file object");
        }

        // Create a preview of the file content
        const fileContent = JSON.stringify(data.file);
        const preview = fileContent.substring(0, 100);
        if ($DebugTestMode) {
          console.log(
            `📖 🔍 File content preview (first 100 chars): ${preview}`
          );
        }

        return fileContent;
      } else if (
        data.success &&
        data.files &&
        Array.isArray(data.files) &&
        data.files.length > 0
      ) {
        if ($DebugTestMode) {
          console.warn("📁 ⚠️Files array found, SHOULD ONLY BE ONE FILE");
        }
        throw new Error(
          data.message || "Files array found, SHOULD ONLY BE ONE FILE"
        );
      } else {
        if ($DebugTestMode) {
          console.warn("📁 ⚠️ No valid file data in response");
        }
        throw new Error(data.message || "No files found");
      }
    } catch (error) {
      if ($DebugTestMode) {
        console.error("📁 ❌ User files fallback retrieval failed:", error);
        console.error("📁 ❌ Parameters were:", {
          fileName,
          conversationId,
        });
      }
      throw error;
    }
  },

  // Helper functions for file type detection
  isImageFile: function (mimeType) {
    if (!mimeType) return false;
    return mimeType.startsWith("image/");
  },

  isDocumentFile: function (mimeType) {
    if (!mimeType) return false;
    const documentTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "text/plain",
      "text/csv",
    ];
    return documentTypes.includes(mimeType);
  },

  isAudioFile: function (mimeType) {
    if (!mimeType) return false;
    return mimeType.startsWith("audio/");
  },

  // Helper function to format file sizes
  formatFileSize: function (bytes) {
    if (!bytes || bytes === 0) return "0 B";

    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));

    return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + " " + sizes[i];
  },

  // Helper functions for enhanced processing
  getFileExtension: function (filename) {
    if (!filename || typeof filename !== "string") return "";
    const lastDot = filename.lastIndexOf(".");
    return lastDot !== -1 ? filename.substring(lastDot) : "";
  },

  getMimeType: function (extension) {
    const mimeTypes = {
      ".txt": "text/plain",
      ".js": "text/javascript",
      ".json": "application/json",
      ".html": "text/html",
      ".css": "text/css",
      ".pdf": "application/pdf",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".gif": "image/gif",
      ".csv": "text/csv",
    };
    return mimeTypes[extension?.toLowerCase()] || "application/octet-stream";
  },

  resetAuth: function () {
    this.isAuthenticated = false;
    this.currentUser = null;
    this.authState = { isAuthenticated: false, user: null, token: null };
    if ($DebugTestMode) {
      console.log(
        "2🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨THE TOKEN AND USER JUST GOT RESET FOR THE LOGIN SYSTEM THIS SHOULD ONLY HAPPEN ON ERROR OR LOGOUT WHICH ISNT EVEN A THING YET🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨"
      );
    }

    localStorage.removeItem(CONFIG.STORAGE_KEYS.TOKEN);
    localStorage.removeItem(CONFIG.STORAGE_KEYS.USER);
    updateAuthDropdown();
  },

  getContextForAI: async function (currentMessageId) {
    if ($DebugTestMode) {
      console.log(
        "🧠 === GETTING CONTEXT FOR AI (WITH ENHANCED FILE DETECTION) ==="
      );
      console.log("🧠 Current message ID:", currentMessageId);
      console.log(
        "🧠 Current conversation ID:",
        appState.currentConversationId
      );
      console.log(
        "🧠 Total chat history length:",
        Object.keys(this.chatHistory).length
      );
    }

    // Ensure chatHistory exists and is valid
    if (!this.chatHistory) {
      if ($DebugTestMode) {
        console.error("🧠 ❌ CRITICAL: chatHistory is null/undefined");
        console.log(
          "🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵RESETTT[History] Initializing chatHistory as new object",
          this.chatHistory
        );
      }
      this.chatHistory = {};
    } else if (typeof this.chatHistory !== "object") {
      if ($DebugTestMode) {
        console.error("🧠 ❌ CRITICAL: chatHistory is not an object");
        console.log(
          "🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵RESETTT[History] Initializing chatHistory as new object",
          this.chatHistory
        );
      }
      this.chatHistory = {};
    }

    // ENHANCED DEBUG: Get all visible message elements from the DOM
    if ($DebugTestMode) {
      console.log("🧠 === ENHANCED VISIBLE MESSAGE DETECTION DEBUG ===");
    }

    // Get all message elements with data-message-id attribute
    const messageElements = document.querySelectorAll(
      ".message[data-message-id]"
    );

    if ($DebugTestMode) {
      console.log(
        "🧠 Total message elements found with .message[data-message-id]:",
        messageElements.length
      );
    }

    // Log all found elements for debugging
    if ($DebugTestMode && messageElements.length > 0) {
      console.log("🧠 All found message elements:");
      messageElements.forEach((element, index) => {
        const messageId = element.getAttribute("data-message-id");
        const computedStyle = window.getComputedStyle(element);
        const display = computedStyle.display;
        const visibility = computedStyle.visibility;
        const opacity = computedStyle.opacity;
        const classList = element.classList.toString();

        console.log(`🧠   Element ${index + 1}:`, {
          id: messageId,
          display: display,
          visibility: visibility,
          opacity: opacity,
          classes: classList,
          isCurrent: messageId === currentMessageId,
          isFlex: display === "flex",
          isVisible:
            display !== "none" && visibility !== "hidden" && opacity !== "0",
        });
      });
    }

    const visibleMessageIds = [];
    let hiddenMessageCount = 0;
    let nonFlexDisplayCount = 0;
    let currentMessageCount = 0;

    // Collect all message IDs that are visible (display: flex) and not the current message
    messageElements.forEach((element) => {
      const messageId = element.getAttribute("data-message-id");
      const computedStyle = window.getComputedStyle(element);

      // Enhanced visibility checking
      const isDisplayFlex = computedStyle.display === "flex";
      const isDisplayBlock = computedStyle.display === "block";
      const isDisplayNone = computedStyle.display === "none";
      const isVisibilityHidden = computedStyle.visibility === "hidden";
      const isOpacityZero = computedStyle.opacity === "0";
      const isHidden = isDisplayNone || isVisibilityHidden || isOpacityZero;
      const isCurrentMessage = messageId === currentMessageId;

      if (isCurrentMessage) {
        currentMessageCount++;
        if ($DebugTestMode) {
          console.log(`🧠   Skipping current message: ${messageId}`);
        }
        return;
      }

      if (isHidden) {
        hiddenMessageCount++;
        if ($DebugTestMode) {
          console.log(`🧠   Hidden message skipped: ${messageId}`, {
            display: computedStyle.display,
            visibility: computedStyle.visibility,
            opacity: computedStyle.opacity,
          });
        }
        return;
      }

      if (!isDisplayFlex && !isDisplayBlock) {
        nonFlexDisplayCount++;
        if ($DebugTestMode) {
          console.log(
            `🧠   Non-flex display skipped: ${messageId} (display: ${computedStyle.display})`
          );
        }
        return;
      }

      // If we get here, the message is visible and not the current message
      visibleMessageIds.push(messageId);

      if ($DebugTestMode) {
        console.log(`🧠   ✅ Visible message added: ${messageId}`, {
          display: computedStyle.display,
          visibility: computedStyle.visibility,
          opacity: computedStyle.opacity,
        });
      }
    });

    // Enhanced debug output for visibility detection
    if ($DebugTestMode) {
      console.log("🧠 === VISIBILITY DETECTION SUMMARY ===");
      console.log("🧠 Total message elements found:", messageElements.length);
      console.log("🧠 Current messages excluded:", currentMessageCount);
      console.log(
        "🧠 Hidden messages (display:none, visibility:hidden, opacity:0):",
        hiddenMessageCount
      );
      console.log("🧠 Non-flex display messages:", nonFlexDisplayCount);
      console.log(
        "🧠 Visible flex messages (included):",
        visibleMessageIds.length
      );
      console.log("🧠 Visible message IDs:", visibleMessageIds);

      if (visibleMessageIds.length === 0 && messageElements.length > 0) {
        console.warn(
          "🧠 ⚠️ WARNING: No visible messages found despite having message elements!"
        );
        console.warn("🧠 This could indicate:");
        console.warn(
          "🧠   - All messages are hidden (display: none, visibility: hidden, opacity: 0)"
        );
        console.warn(
          "🧠   - All messages have non-flex display (block, inline, etc.)"
        );
        console.warn("🧠   - The current message is the only one visible");
        console.warn("🧠   - CSS classes or DOM structure has changed");

        // Additional diagnostic: check if we're in a conversation view
        const conversationContainer = document.querySelector(
          ".conversation-container, .chat-container, .messages-container"
        );
        if (conversationContainer) {
          const containerStyle = window.getComputedStyle(conversationContainer);
          console.log("🧠 Conversation container visibility:", {
            display: containerStyle.display,
            visibility: containerStyle.visibility,
            opacity: containerStyle.opacity,
          });
        }
      }
    }

    // Get messages from current conversation
    let conversationMessages = [];
    if (
      appState.currentConversationId &&
      this.chatHistory[appState.currentConversationId]
    ) {
      conversationMessages =
        this.chatHistory[appState.currentConversationId].messages || [];

      if ($DebugTestMode) {
        console.log(
          "🧠 Messages in current conversation:",
          conversationMessages.length
        );
        console.log(
          "🧠 Current conversation ID:",
          appState.currentConversationId
        );
      }
    } else {
      if ($DebugTestMode) {
        console.warn(
          "🧠 ⚠️ No current conversation found, using empty messages array"
        );
      }
    }

    // Filter messages to only include those that are visible in the UI
    const visibleMessages = conversationMessages.filter(
      (msg) => msg && msg.id && visibleMessageIds.includes(msg.id)
    );

    if ($DebugTestMode) {
      console.log(
        "🧠 Visible messages after filtering:",
        visibleMessages.length
      );
      console.log(
        "🧠 Visible message IDs from chat history:",
        visibleMessages.map((msg) => msg.id)
      );

      // Check for mismatches between DOM and chat history
      const domOnlyIds = visibleMessageIds.filter(
        (id) => !visibleMessages.some((msg) => msg.id === id)
      );
      const historyOnlyIds = visibleMessages
        .map((msg) => msg.id)
        .filter((id) => !visibleMessageIds.includes(id));

      if (domOnlyIds.length > 0) {
        console.warn(
          "🧠 ⚠️ Messages in DOM but not in chat history:",
          domOnlyIds
        );
      }
      if (historyOnlyIds.length > 0) {
        console.warn(
          "🧠 ⚠️ Messages in chat history but not in DOM:",
          historyOnlyIds
        );
      }
    }

    // Filter out error messages
    const filteredMessages = visibleMessages.filter((msg) => {
      if (!msg || typeof msg !== "object") {
        if ($DebugTestMode) {
          console.warn("🧠 ⚠️ Invalid message object:", msg);
        }
        return false;
      }

      // Filter out error messages
      const isErrorMessage =
        msg.text &&
        (msg.text.includes("usage limit") ||
          msg.text.includes("Your usage will reset") ||
          msg.text.includes("session has expired") ||
          msg.text.includes("Please sign in") ||
          msg.messageType === "Auth Required" ||
          msg.messageType === "Error");

      return !isErrorMessage;
    });

    if ($DebugTestMode) {
      console.log(
        "🧠 Filtered messages after error removal:",
        filteredMessages.length
      );
    }

    // Take the most recent messages up to the limit
    const recentMessages = filteredMessages.slice(-CONFIG.MAX_CONTEXT_MESSAGES);

    if ($DebugTestMode) {
      console.log("🧠 Recent messages for context:", recentMessages.length);
      recentMessages.forEach((msg, index) => {
        console.log(`🧠 Message ${index}:`, {
          id: msg.id,
          type: msg.type,
          hasFiles: !!msg.files,
          filesLength: msg.files ? msg.files.length : 0,
        });
      });
    }

    // Convert to OpenAI format - Include BOTH structured files AND embedded file content
    const contextMessages = await Promise.all(
      recentMessages.map(async (msg) => {
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

        // Inline file detection - check if this message has embedded files
        const hasCodeBlocks = content && /```[\s\S]*?```/.test(content);
        const hasSourceBlocks =
          content && /<source>[\s\S]*?<\/antml:document_content>/.test(content);
        const hasFilePatterns =
          content &&
          (/File \d+:.*\n```/.test(content) ||
            /\*\*File \d+:.*\*\*/.test(content) ||
            /--- Document \d+:/.test(content) ||
            /```(javascript|html|css|python|php|json|xml|markdown)/i.test(
              content
            ));
        const hasEmbeddedFiles =
          hasCodeBlocks || hasSourceBlocks || hasFilePatterns;
        const hasStructuredFiles =
          msg.files &&
          ((Array.isArray(msg.files) && msg.files.length > 0) ||
            (typeof msg.files === "string" && msg.files.trim().length > 0));

        if ($DebugTestMode) {
          console.log(`🧠 Processing message ${msg.id}:`, {
            role,
            hasStructuredFiles,
            hasEmbeddedFiles,
            hasCodeBlocks,
            hasSourceBlocks,
            hasFilePatterns,
            contentLength: content.length,
            structuredFileCount: hasStructuredFiles ? msg.files.length : 0,
          });
        }

        // CRITICAL FIX: Enhanced file extraction from blocks
        let extractedFiles = [];

        if ($DebugTestMode) {
          console.log(`🧠 === FILE EXTRACTION DEBUG FOR MESSAGE ${msg.id} ===`);
          console.log(`🧠 hasStructuredFiles: ${hasStructuredFiles}`);
          console.log(`🧠 msg.files:`, msg.files);
          console.log(
            `🧠 msg.files length: ${msg.files ? msg.files.length : 0}`
          );

          if (typeof contentManager !== "undefined") {
            console.log(
              `🧠 contentManager available, blocks count: ${contentManager.blocks.size}`
            );
            console.log(
              `🧠 contentManager block keys:`,
              Array.from(contentManager.blocks.keys())
            );
          } else {
            console.log(`🧠 ❌ contentManager NOT available`);
          }

          if (
            typeof chatManager !== "undefined" &&
            chatManager.streamingResponseFiles
          ) {
            console.log(
              `🧠 chatManager.streamingResponseFiles length: ${chatManager.streamingResponseFiles.length}`
            );
            console.log(
              `🧠 streamingResponseFiles filenames:`,
              chatManager.streamingResponseFiles.map((f) => f.filename)
            );
          } else {
            console.log(
              `🧠 ❌ chatManager.streamingResponseFiles NOT available`
            );
          }
        }

        if (hasStructuredFiles) {
          // Handle case where msg.files might be a string instead of array
          let filesArray = [];

          if (Array.isArray(msg.files)) {
            filesArray = msg.files;
          } else if (typeof msg.files === "string") {
            // If it's a string, try to parse it as JSON or handle appropriately
            try {
              filesArray = JSON.parse(msg.files);
              if (!Array.isArray(filesArray)) {
                // If parsing doesn't yield an array, treat it as a single filename
                filesArray = [{ filename: msg.files }];
              }
            } catch (e) {
              // If parsing fails, treat the string as a single filename
              filesArray = [{ filename: msg.files }];
            }
          }

          if ($DebugTestMode) {
            console.log(
              `🧠 📁 Processing ${filesArray.length} structured files for message ${msg.id}`
            );
            console.log(`🧠 📁 filesArray:`, filesArray);
          }

          // Check if files are already embedded in text to avoid duplication
          const hasFileMarkers =
            content.includes("[Files created in this response:]") ||
            content.includes("[Files in this message:]");

          if ($DebugTestMode) {
            console.log(`🧠 📁 hasFileMarkers: ${hasFileMarkers}`);
          }

          if (!hasFileMarkers) {
            // Add file information to the content
            content += "\n\n[Files created in this response:]\n";

            // Process each file using historyManager and messageManager
            for (let index = 0; index < filesArray.length; index++) {
              const file = filesArray[index];

              if ($DebugTestMode) {
                console.log(
                  `🧠 📁 === PROCESSING FILE ${index + 1}: ${file.filename} ===`
                );
                console.log(`🧠 📁 File object:`, {
                  filename: file.filename,
                  hasContent: !!file.content,
                  contentLength: file.content ? file.content.length : 0,
                  type: file.type,
                  language: file.language,
                  extension: file.extension,
                  id: file.id,
                });
              }

              if (file && file.filename) {
                let fileContent = file.content;

                if ($DebugTestMode) {
                  console.log(
                    `🧠 📁 Initial file.content length: ${
                      fileContent ? fileContent.length : 0
                    }`
                  );
                }

                // If no content in file object, try to get from historyManager
                if (!fileContent && typeof historyManager !== "undefined") {
                  if ($DebugTestMode) {
                    console.log(
                      `🧠 📁 Getting file content from historyManager for: ${file.filename}`
                    );
                  }

                  try {
                    const fileData = await historyManager.getFile(
                      file.filename,
                      appState.currentConversationId
                    );

                    if (fileData && typeof messageManager !== "undefined") {
                      if ($DebugTestMode) {
                        console.log("this is the file data", fileData);
                        console.log("fileData type:", typeof fileData);
                      }

                      // Parse the JSON string into an object
                      let parsedFileData;
                      try {
                        parsedFileData = JSON.parse(fileData);
                        if ($DebugTestMode) {
                          console.log(
                            "Successfully parsed fileData:",
                            parsedFileData
                          );
                        }
                      } catch (error) {
                        if ($DebugTestMode) {
                          console.error(
                            "Failed to parse fileData as JSON:",
                            error
                          );
                        }
                        parsedFileData = { content: fileData }; // Fallback: treat the string as content
                      }

                      if (parsedFileData.sections) {
                        if ($DebugTestMode) {
                          console.log(
                            "Entering sections branch - calling constructFileContent"
                          );
                        }
                        fileContent =
                          messageManager.constructFileContent(parsedFileData);
                      } else {
                        if ($DebugTestMode) {
                          console.log(
                            "Entering else branch - using content property"
                          );
                          console.log(
                            "parsedFileData.content value:",
                            parsedFileData.content
                          );
                        }
                        fileContent = parsedFileData.content || "";
                      }

                      if ($DebugTestMode) {
                        console.log(
                          "this is the file content after processing",
                          fileContent
                        );
                        console.log(
                          "Final fileContent length:",
                          fileContent.length
                        );
                        console.log(
                          `🧠 📁 ✅ Successfully retrieved file content via historyManager`
                        );
                        console.log(
                          `🧠 📁 Constructed content length: ${fileContent.length}`
                        );
                        console.log(
                          `🧠 📁 Content preview: ${fileContent.substring(
                            0,
                            100
                          )}...`
                        );
                      }
                    } else if ($DebugTestMode) {
                      console.log(
                        `🧠 📁 ❌ No file data returned from historyManager for ${file.filename}`
                      );
                    }
                  } catch (error) {
                    if ($DebugTestMode) {
                      console.error(
                        `🧠 📁 ❌ Error getting file from historyManager:`,
                        error
                      );
                    }
                  }
                }

                if (fileContent) {
                  // Include FULL file content
                  content += `\n**File ${index + 1}: ${file.filename}** (${
                    file.type || "unknown type"
                  })\n`;
                  content += `\`\`\`${
                    file.language || file.extension?.replace(".", "") || "text"
                  }\n`;
                  content += fileContent; // ← FULL CONTENT
                  content += `\n\`\`\`\n`;

                  // Add to extracted files for metadata
                  const extractedFile = {
                    filename: file.filename,
                    content: fileContent,
                    type: file.type,
                    language: file.language,
                    extension: file.extension,
                    size: fileContent.length,
                  };

                  extractedFiles.push(extractedFile);

                  if ($DebugTestMode) {
                    console.log(
                      `🧠 📁 ✅ Added structured file to context: ${file.filename}`
                    );
                    console.log(
                      `🧠 📁   - Content length: ${fileContent.length} chars`
                    );
                    console.log(`🧠 📁   - File type: ${file.type}`);
                    console.log(`🧠 📁   - Language: ${file.language}`);
                    console.log(
                      `🧠 📁   - Extracted file object:`,
                      extractedFile
                    );
                  }
                } else {
                  // File reference without content
                  content += `\n**File ${index + 1}: ${file.filename}** (${
                    file.type || "unknown type"
                  }) - [Content not available]\n`;

                  if ($DebugTestMode) {
                    console.log(
                      `🧠 📁 ⚠️ No content found for ${file.filename} from any source`
                    );
                    console.log(
                      `🧠 📁   - Checked: file.content, contentManager.blocks, streamingResponseFiles`
                    );
                  }
                }
              } else if ($DebugTestMode) {
                console.log(
                  `🧠 📁 ❌ Invalid file object at index ${index}:`,
                  file
                );
              }
            } // ← End of for loop

            content += "\n[End of files]\n";

            if ($DebugTestMode) {
              console.log(`🧠 📁 === FILE PROCESSING COMPLETE ===`);
              console.log(
                `🧠 📁 Total extracted files: ${extractedFiles.length}`
              );
              console.log(
                `🧠 📁 Extracted files summary:`,
                extractedFiles.map((f) => ({
                  filename: f.filename,
                  contentLength: f.content?.length || 0,
                }))
              );
            }
          } else if ($DebugTestMode) {
            console.log(
              `🧠 📁 Files already embedded in text for message ${msg.id}, skipping duplication`
            );
          }
        }

        // If message has embedded files but no structured files, enhance the context
        else if (hasEmbeddedFiles && role === "assistant") {
          if ($DebugTestMode) {
            console.log(
              `🧠 Detected embedded files in assistant message ${msg.id}`
            );

            // Count code blocks for debugging
            const codeBlocks = content.match(/```[\s\S]*?```/g) || [];
            const sourceBlocks =
              content.match(/<source>[\s\S]*?<\/antml:document_content>/g) ||
              [];

            console.log(`🧠   - Code blocks found: ${codeBlocks.length}`);
            console.log(`🧠   - Source blocks found: ${sourceBlocks.length}`);

            // Show a preview of detected content
            if (codeBlocks.length > 0) {
              console.log(
                `🧠   - First code block preview:`,
                codeBlocks[0].substring(0, 100) + "..."
              );
            }
          }

          // Enhance embedded file context by adding metadata markers
          if (!content.includes("[Files displayed in this response:]")) {
            // Add a marker to help the AI understand this message contains file content
            const fileCount = (content.match(/```/g) || []).length / 2;
            const sourceCount = (content.match(/<source>/g) || []).length;

            if (fileCount > 0 || sourceCount > 0) {
              const fileInfo = [];
              if (fileCount > 0) fileInfo.push(`${fileCount} code file(s)`);
              if (sourceCount > 0)
                fileInfo.push(`${sourceCount} source document(s)`);

              content =
                `[Files displayed in this response: ${fileInfo.join(
                  ", "
                )}]\n\n` + content;

              if ($DebugTestMode) {
                console.log(
                  `🧠   - Added file context marker: ${fileInfo.join(", ")}`
                );
              }
            }
          }
        }

        // If this is a user message asking about files, enhance context (inline detection)
        else if (role === "user" && content) {
          // Inline file-related query detection
          const fileQueryPatterns = [
            /make it better/i,
            /improve (the|this|these) (file|code|script)/i,
            /fix (the|this|these) (file|code|script)/i,
            /update (the|this|these) (file|code|script)/i,
            /modify (the|this|these) (file|code|script)/i,
            /change (the|this|these) (file|code|script)/i,
            /enhance (the|this|these) (file|code|script)/i,
            /optimize (the|this|these) (file|code|script)/i,
            /refactor (the|this|these) (file|code|script)/i,
            /in the (above|previous) (file|code|script)/i,
            /from the (file|code|script) (above|before|shown)/i,
            /the (file|code|script) you (showed|displayed|created)/i,
            /(add|remove|delete) (to|from) the (file|code|script)/i,
          ];

          const isFileRelatedQuery = fileQueryPatterns.some((pattern) =>
            pattern.test(content)
          );

          if (isFileRelatedQuery) {
            if ($DebugTestMode) {
              console.log(
                `🧠 Detected file-related user query in message ${msg.id}`
              );
            }

            // Add context marker to help AI understand this is about previous files
            if (
              !content.includes(
                "[Context: User asking about previously shown files]"
              )
            ) {
              content = `[Context: User asking about previously shown files]\n${content}`;
            }
          }
        }

        const contextMessage = {
          role: role,
          content: content, // This includes files if present
          timestamp: msg.timestamp,
          // FIXED: Use extracted files instead of just msg.files
          originalFiles:
            extractedFiles.length > 0 ? extractedFiles : msg.files || [],
          messageVersion: msg.currentVersion || 1,
          respondsToVersion: msg.respondsToVersion,
          hasEmbeddedFiles: hasEmbeddedFiles,
          hasStructuredFiles: hasStructuredFiles,
        };

        if ($DebugTestMode) {
          console.log(`🧠 === CONTEXT MESSAGE CREATION DEBUG ===`);
          console.log(`🧠 Message ID: ${msg.id}`);
          console.log(`🧠 Role: ${role}`);
          console.log(
            `🧠 Original msg.files count: ${msg.files ? msg.files.length : 0}`
          );
          console.log(`🧠 Extracted files count: ${extractedFiles.length}`);
          console.log(
            `🧠 Final originalFiles count: ${contextMessage.originalFiles.length}`
          );

          const fileStatus = [];
          if (hasStructuredFiles)
            fileStatus.push(`${extractedFiles.length} structured`);
          if (hasEmbeddedFiles) fileStatus.push("embedded");

          console.log(
            `🧠 Context message summary: ${role} - "${msg.text.substring(
              0,
              50
            )}..."${
              fileStatus.length ? ` [${fileStatus.join(", ")} files]` : ""
            } [v${contextMessage.messageVersion}${
              contextMessage.respondsToVersion
                ? `/r${contextMessage.respondsToVersion}`
                : ""
            }] (${content.length} chars)`
          );
        }

        if ($DebugTestMode) {
          console.log("🧠 === CONTEXT MESSAGE CREATED ===", contextMessage);
        }
        return contextMessage;
      })
    );

    // Enhanced debugging for version-aware context with file detection
    if ($DebugTestMode) {
      console.log("🧠 === ENHANCED VERSION-AWARE CONTEXT CHECK ===");
      let totalFilesDetected = 0;
      let totalContentLength = 0;
      let totalOriginalFiles = 0;

      contextMessages.forEach((msg, idx) => {
        console.log(`🧠 === Context Message ${idx} Analysis ===`);
        console.log(`  Role: ${msg.role}`);
        console.log(`  Content length: ${msg.content.length} chars`);
        console.log(`  Message version: ${msg.messageVersion}`);
        console.log(`  Responds to version: ${msg.respondsToVersion || "N/A"}`);
        console.log(`  Has structured files: ${msg.hasStructuredFiles}`);
        console.log(`  Has embedded files: ${msg.hasEmbeddedFiles}`);
        console.log(`  Original files count: ${msg.originalFiles.length}`);

        totalContentLength += msg.content.length;
        totalOriginalFiles += msg.originalFiles.length;

        // Check for file markers and content
        const hasFileStart =
          msg.content.includes("[Files created in this response:]") ||
          msg.content.includes("[Files displayed in this response:]");
        const hasFileEnd = msg.content.includes("[End of files]");
        const codeBlockCount = (msg.content.match(/```/g) || []).length;
        const sourceBlockCount = (msg.content.match(/<source>/g) || []).length;

        console.log(`  File markers: start=${hasFileStart}, end=${hasFileEnd}`);
        console.log(
          `  Code blocks: ${codeBlockCount / 2} (${codeBlockCount} markers)`
        );
        console.log(`  Source blocks: ${sourceBlockCount}`);

        if (msg.hasStructuredFiles) {
          totalFilesDetected += msg.originalFiles.length;
        }
        if (msg.hasEmbeddedFiles) {
          totalFilesDetected +=
            Math.floor(codeBlockCount / 2) + sourceBlockCount;
        }

        if (hasFileStart || msg.hasEmbeddedFiles) {
          console.log(`  Content preview with files:`);
          console.log(
            "    " +
              msg.content.substring(0, 200).replace(/\n/g, "\\n") +
              "...[truncated]"
          );
        } else {
          console.log(
            `  Content preview: ${msg.content
              .substring(0, 150)
              .replace(/\n/g, "\\n")}...`
          );
        }
      });

      console.log(`🧠 === FINAL CONTEXT SUMMARY ===`);
      console.log(`  Total messages: ${contextMessages.length}`);
      console.log(`  Total content length: ${totalContentLength} chars`);
      console.log(
        `  Total originalFiles across all messages: ${totalOriginalFiles}`
      );
      console.log(
        `  Total files detected (including embedded): ${totalFilesDetected}`
      );
      console.log(`  Context+ enabled: ${this.contextPlusEnabled}`);

      if (totalOriginalFiles === 0) {
        console.log(
          `🧠 ❌ WARNING: No files found in originalFiles across all context messages!`
        );
        console.log(
          `🧠 This might indicate an issue with file extraction from blocks.`
        );
      }

      console.log("🧠 === ENHANCED VERSION-AWARE CONTEXT COMPLETE ===");
    }

    return contextMessages;
  },

  resetAll: function () {
    // Clear state
    this.chatHistory = {};

    // Clear localStorage
    localStorage.removeItem("chatHistory");

    if ($DebugTestMode) {
      console.log("🔥 All history reset");
    }
  },
};
appState.resetAll();

function inspectchatHistory() {
  console.log("🔥 CHAT DUMP START 🔥");
  console.log("appState.chatHistory:", appState.chatHistory);
  console.log("localStorage chatHistory:", localStorage.getItem("chatHistory"));
  console.log(
    "localStorage CONFIG key:",
    localStorage.getItem(CONFIG?.STORAGE_KEYS?.CHAT_HISTORY)
  );
  console.log("All localStorage keys:", Object.keys(localStorage));
  Object.keys(localStorage)
    .filter(
      (k) =>
        k.includes("chat") ||
        k.includes("history") ||
        k.includes("conv") ||
        k.includes("message")
    )
    .forEach((k) => console.log(`${k}:`, localStorage.getItem(k)));
  if (
    typeof messageManager !== "undefined" &&
    messageManager.getCurrentConversation
  )
    console.log(
      "messageManager current:",
      messageManager.getCurrentConversation()
    );
  console.log("🔥 CHAT DUMP END 🔥");
}
