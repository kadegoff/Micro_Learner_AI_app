// uiManager.js - UI utilities and event handlers
"use strict";

// UI Manager functions
function updateAuthDropdown() {
  const container = document.querySelector(".chat-controls");
  if (!container) return;

  console.log(
    "Updating auth dropdown - isAuthenticated:",
    appState.isAuthenticated
  );

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

    const aiSection = generateDropdownHTML(currentModel);

    container.innerHTML = `<div class="chat-controls">
              ${aiSection}
              <button class="send-button processing" id="sendButton" title="Stop processing">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"></path>
                </svg>
              </button>
            </div>`;

    const sendButton = document.getElementById("sendButton");

    sendButton?.addEventListener("click", function () {
      // Reset activity timer on send
      aiWindowState.resetInactivityTimer();

      if (chatManager.currentStreamMessageId) {
        console.log("🧭 ❌ Cannot send message while processing a message");

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

      sendMessage();

      if (chatInput) {
        chatInput.style.height = "40px";
        chatInput.style.overflowY = "hidden";
        chatInput.value = "";
      }
    });
  }
}

function getCleanModelName(fullName) {
  // Extract text before the first opening parenthesis
  const match = fullName.match(/^([^(]+)/);
  return match ? match[1].trim() : fullName;
}

// Updated generateDropdownHTML function
function generateDropdownHTML(currentModel) {
  // Get clean name for button display
  const cleanName = getCleanModelName(currentModel.name);

  return `
    <div class="ai-dropdown-button dropdownButton" id="dropdownButton">
      <span class="model-name">${cleanName}</span>
      <span class="chevron">▼</span>
    </div>
    <div class="ai-dropdown-menu dropdownMenu" id="dropdownMenu">
      ${generateModelCategories()}
    </div>
  `;
}

// Updated generateModelCategories function (keep full names in dropdown)
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
  const buttons = document.querySelectorAll("#dropdownButton");
  const menus = document.querySelectorAll("#dropdownMenu");

  buttons.forEach((button) => {
    menus.forEach((menu) => {
      button.classList.toggle("active");
      menu.classList.toggle("show");
    });
  });
}
function selectAIModel(modelId) {
  appState.selectedAIModel = modelId;
  localStorage.setItem(CONFIG.STORAGE_KEYS.SELECTED_MODEL, modelId);
  console.log("calling updateAuthDropdown 1");
  updateAuthDropdown();

  // Use querySelectorAll to handle multiple elements
  const buttons = document.querySelectorAll("#dropdownButton");
  const menus = document.querySelectorAll("#dropdownMenu");

  buttons.forEach((button) => button.classList.remove("active"));
  menus.forEach((menu) => menu.classList.remove("show"));

  // Get the selected model and show clean name in notification
  const allModels = AI_MODELS.basic.concat(AI_MODELS.advanced, AI_MODELS.fast);
  const selectedModel = allModels.find((m) => m.id === modelId);
  const cleanName = selectedModel
    ? getCleanModelName(selectedModel.name)
    : "Unknown";

  // Show subtle notification with clean name
  showSystemNotification(`Model changed to ${cleanName}`);
}
// Add this new function anywhere in your ai.js file:
function showSystemNotification(text) {
  const content = document.getElementById("aiContent");
  if (!content) return;

  // Check and clear for first message using chatManager
  if (
    chatManager &&
    typeof chatManager.checkAndClearForFirstMessage === "function"
  ) {
    chatManager.checkAndClearForFirstMessage();
  }

  // Remove empty state if it exists
  const emptyState = content.querySelector(".empty-state");
  if (emptyState) emptyState.remove();

  // Create the notification element
  const notification = document.createElement("div");
  notification.className = "system-notification";
  notification.innerHTML = `
    <div class="system-notification-content">
      <span class="system-notification-text">${text}</span>
    </div>
  `;

  // Add to content - it will stay permanently
  content.appendChild(notification);

  // Scroll to show the notification
  content.scrollTop = content.scrollHeight;
}

function handleSignIn() {
  if (Environment.isWeb) {
    if ($DebugTestMode) {
      console.log("🌐 Web environment: Opening sign-in page");
    }
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
    if ($DebugTestMode) {
      console.error("Unable to open sign-in window");
    }
  }
}

/*function testChatFlow() {
  if ($DebugTestMode) {
    console.log("🧪 Testing chat flow");
    console.log("🧪 Auth state:", {
      isAuthenticated: appState.isAuthenticated,
      currentUser: appState.currentUser,
    });
  }

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
  };

  if ($DebugTestMode) {
    console.log("🧪 Sending test message:", testMessage);
  }

  if (Environment.isElectron) {
    window.electronAPI.sendChatMessage(testMessage);
    if ($DebugTestMode) {
      console.log("🧪 Test message sent via Electron IPC");
    }
  } else {
    chatManager.sendChatMessageDirect(testMessage);
    if ($DebugTestMode) {
      console.log("🧪 Test message sent directly to backend");
    }
  }

  messageManager.createMessage(
    "🧪 Test message sent. Check console for details.",
    "ai",
    "Debug Test"
  );
}*/

// Function to show the welcome header
function showWelcomeHeader(message = "How can I help you today?") {
  const content = document.getElementById("aiContent");
  if (content) {
    content.innerHTML = `
      <div class="welcome-header">
        <h1>${message}</h1>
      </div>
    `;
  }
}

// Add this function to handle starting a new chat
function startNewChat() {
  if ($DebugTestMode) {
    console.log("🆕 Starting new chat");
  }

  if (chatManager.currentStreamMessageId) {
    console.log(
      "Still in the middle of a message stream. Cannot start a new chat."
    );

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
      headerControls.insertBefore(processingBanner, newChatButton);

      // Store timeout ID in data attribute for later clearing
      processingBanner.dataset.timeoutId = setTimeout(() => {
        if (processingBanner.parentNode === headerControls) {
          headerControls.removeChild(processingBanner);
        }
      }, 3000);
    }

    return; // Exit the function to prevent starting a new chat
  }

  // Reset current conversation tracking
  appState.currentConversationId = null;

  // Save the state
  appState.saveToStorage();

  // Show welcome header
  showWelcomeHeader();

  // Update the history panel to reflect no active conversation
  const allActiveElements = document.querySelectorAll(
    ".topic-item.active, .subtopic-item.active"
  );
  allActiveElements.forEach((el) => el.classList.remove("active"));

  // ADDED: Focus on the chat input box
  const chatInput = document.getElementById("chatInput");
  if (chatInput) {
    // Use setTimeout to ensure DOM updates are complete before focusing
    setTimeout(() => {
      chatInput.focus();
    }, 10);
  }

  if ($DebugTestMode) {
    console.log("🆕 New chat initialized - input focused");
  }
}

// Also make it globally available
window.startNewChat = startNewChat;

function setupEventListeners() {
  // Chat input and send button
  const chatInput = document.getElementById("chatInput");
  const sendButton = document.getElementById("sendButton");

  window.addEventListener("resize", handleResize);

  // ENHANCED: Better auto-resize for input box only
  if (chatInput) {
    chatInput.addEventListener("input", function (e) {
      const textarea = e.target;

      // Reset activity timer on input
      aiWindowState.resetInactivityTimer();

      textarea.style.height = "auto";
      const scrollHeight = textarea.scrollHeight;
      const newHeight = Math.max(40, Math.min(scrollHeight + 8, 300));
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
      aiWindowState.resetInactivityTimer();

      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();

        if (chatManager.currentStreamMessageId) {
          console.log("🧭 ❌ Cannot send message while processing a message");

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

    // Set initial height and properties
    chatInput.style.height = "40px";
    chatInput.style.resize = "none";
    chatInput.style.overflowY = "hidden";
  }

  sendButton?.addEventListener("click", function () {
    // Reset activity timer on send
    aiWindowState.resetInactivityTimer();

    if (chatManager.currentStreamMessageId) {
      console.log("🧭 ❌ Cannot send message while processing a message");

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

    sendMessage();

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

  // FIXED: History panel setup - consolidated and with debugging
  setupHistoryPanel();

  // Dropdown menu
  document.addEventListener("click", function (e) {
    // Reset activity timer on any click
    aiWindowState.resetInactivityTimer();

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
    /*if (e.target.closest(".debug-button")) {
      testChatFlow();
    }*/

    // Search result clicks
    const searchResult = e.target.closest(".search-result-header");
    if (searchResult) {
      const conversationId = searchResult.dataset.conversationId;
      historyManager.loadConversation(conversationId);
    }
  });

  // Global keyboard shortcuts
  document.addEventListener("keydown", function (e) {
    // Cmd/Ctrl + K for new chat
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault();
      aiWindowState.resetInactivityTimer();
      startNewChat();
    }

    // ADDED: Cmd/Ctrl + H for history panel
    /* if ((e.metaKey || e.ctrlKey) && e.key === "h") {
      e.preventDefault();
      if ($DebugTestMode) {
        console.log("🎯 Keyboard shortcut triggered - toggling history");
      }
      aiWindowState.resetInactivityTimer();
      historyManager.toggleHistoryPanel();
      historyManager.loadHistory();
    }*/
  });

  // ElectronAPI event listeners
  if (window.electronAPI) {
    window.electronAPI.onNewAIResponse(function (data) {
      // Reset activity timer on new AI response
      aiWindowState.resetInactivityTimer();
      if ($DebugTestMode) {
        console.log("📨 Received AI response:", data);
      }

      // CRITICAL: Check for thinking indicator FIRST
      if (data && data.thinking === true) {
        if ($DebugTestMode) {
          console.log("🤔 Received thinking indicator - showing thinking UI");
        }
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
        if ($DebugTestMode) {
          console.error("📨 Unexpected response format:", data);
        }
        messageManager.createMessage(
          "Received unexpected response format",
          "ai",
          "Error"
        );
      }
    });

    window.electronAPI.onAIThinking(function () {
      if ($DebugTestMode) {
        console.log("🤔 onAIThinking listener triggered!");
      }
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

      // Log state change
      if ($DebugTestMode) {
        console.log("🧠 Context+ toggled:", appState.contextPlusEnabled);
      }

      // Show subtle notification like model changes
      const statusMessage = appState.contextPlusEnabled
        ? "Context+ enabled"
        : "Context+ disabled";

      showSystemNotification(statusMessage);
    });

    // Set initial state
    contextPlusToggle.classList.toggle("active", appState.contextPlusEnabled);
  }
}

function setupHistoryPanel() {
  if ($DebugTestMode) {
    console.log("📚 === SETTING UP HISTORY PANEL ===");
  }

  const historyButton = document.getElementById("historyButton");
  const closeHistoryButton = document.getElementById("closeHistoryButton");
  const historySearch = document.getElementById("historySearch");
  const historyPanel = document.getElementById("historyPanel");

  if ($DebugTestMode) {
    console.log("📚 Elements found:", {
      historyButton: !!historyButton,
      closeHistoryButton: !!closeHistoryButton,
      historySearch: !!historySearch,
      historyPanel: !!historyPanel,
    });
  }

  if (!historyButton) {
    if ($DebugTestMode) {
      console.error("❌ History button not found! Check your HTML.");
    }
    return;
  }

  if (!historyPanel) {
    if ($DebugTestMode) {
      console.error("❌ History panel not found! Check your HTML.");
    }
    return;
  }

  // FIXED: Remove existing listeners without cloning
  if (historyButton._historyClickHandler) {
    historyButton.removeEventListener(
      "click",
      historyButton._historyClickHandler
    );
  }

  // Create and store the handler
  historyButton._historyClickHandler = function (e) {
    e.preventDefault();
    e.stopPropagation();

    if ($DebugTestMode) {
      console.log("📚 🎯 HISTORY BUTTON CLICKED!");
      console.log("📚 Current panel state:", {
        hasShowClass: historyPanel.classList.contains("show"),
        display: getComputedStyle(historyPanel).display,
        visibility: getComputedStyle(historyPanel).visibility,
      });
    }

    // Force toggle the panel
    historyManager.toggleHistoryPanel();
    historyManager.loadHistory();

    // Check if there's text in the search bar and trigger search
    if (historySearch && historySearch.value.trim()) {
      const query = historySearch.value.trim();
      if ($DebugTestMode) {
        console.log("📚 Found existing search query:", query);
      }
      historyManager.searchHistory(query);
    }

    if ($DebugTestMode) {
      console.log("📚 After toggle - panel state:", {
        hasShowClass: historyPanel.classList.contains("show"),
        display: getComputedStyle(historyPanel).display,
        visibility: getComputedStyle(historyPanel).visibility,
      });
    }
  };

  if ($DebugTestMode) {
    console.log("📚 Setting up history button click listener...");
  }
  historyButton.addEventListener("click", historyButton._historyClickHandler);

  // Close button
  if (closeHistoryButton) {
    if (closeHistoryButton._closeClickHandler) {
      closeHistoryButton.removeEventListener(
        "click",
        closeHistoryButton._closeClickHandler
      );
    }

    closeHistoryButton._closeClickHandler = function (e) {
      e.preventDefault();
      e.stopPropagation();
      if ($DebugTestMode) {
        console.log("📚 Close button clicked");
      }
      historyManager.toggleHistoryPanel(false);
    };

    closeHistoryButton.addEventListener(
      "click",
      closeHistoryButton._closeClickHandler
    );
  }

  // Search input
  if (historySearch) {
    if (historySearch._searchInputHandler) {
      historySearch.removeEventListener(
        "input",
        historySearch._searchInputHandler
      );
    }

    historySearch._searchInputHandler = function (e) {
      const query = e.target.value.trim();
      if ($DebugTestMode) {
        console.log("📚 Search query:", query);
      }
      historyManager.searchHistory(query);
    };

    historySearch.addEventListener("input", historySearch._searchInputHandler);
  }

  // Click outside to close - FIXED
  if (!document._historyOutsideClickHandler) {
    document._historyOutsideClickHandler = function (e) {
      const historyPanel = document.getElementById("historyPanel");
      const historyButton = document.getElementById("historyButton"); // Get fresh reference

      if (historyPanel && historyPanel.classList.contains("show")) {
        const isOutsidePanel = !historyPanel.contains(e.target);
        const isNotHistoryButton =
          !historyButton || !historyButton.contains(e.target);

        if (isOutsidePanel && isNotHistoryButton) {
          if ($DebugTestMode) {
            console.log("📚 Click outside detected - closing panel");
          }
          historyManager.toggleHistoryPanel(false);
        }
      }
    };

    document.addEventListener("click", document._historyOutsideClickHandler);
  }

  if ($DebugTestMode) {
    console.log("📚 ✅ History panel setup complete");
  }
}

// FIXED: Enhanced toggleHistoryPanel with debugging
historyManager.toggleHistoryPanel = function (show) {
  if ($DebugTestMode) {
    console.log("📚 === TOGGLE HISTORY PANEL ===");
  }

  const panel = document.getElementById("historyPanel");
  const button = document.getElementById("historyButton");

  if (!panel) {
    if ($DebugTestMode) {
      console.error("❌ History panel element not found!");
    }
    return;
  }

  const isCurrentlyShown = panel.classList.contains("show");

  if (show === undefined) {
    show = !isCurrentlyShown;
  }

  if ($DebugTestMode) {
    console.log("📚 Setting panel visibility to:", show);
  }

  if (show) {
    panel.classList.add("show");
    button?.classList.add("active");

    // Ensure panel is visible
    panel.style.display = ""; // Let CSS handle it
    panel.style.visibility = "";

    // Force reflow to ensure styles are applied
    panel.offsetHeight;
  } else {
    panel.classList.remove("show");
    button?.classList.remove("active");

    document.getElementById("historySearch").innerHTML = "";
  }

  // Log final state for debugging
  if ($DebugTestMode) {
    console.log("📚 Final panel state:", {
      hasShowClass: panel.classList.contains("show"),
      computedDisplay: getComputedStyle(panel).display,
      computedVisibility: getComputedStyle(panel).visibility,
    });
  }
};

console.log("calling updateAuthDropdown 2");

// Export UI functions if using modules
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    getCleanModelName,
    generateDropdownHTML,
    generateModelCategories,
    toggleDropdown,
    selectAIModel,
    showSystemNotification,
    handleSignIn,
    startNewChat,
    setupEventListeners,
    setupHistoryPanel,
  };
}
