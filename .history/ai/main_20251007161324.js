"use strict";

if (typeof $DebugTestMode === "undefined") {
  $DebugTestMode = true;
}

// Initialize everything when DOM is ready
document.addEventListener("DOMContentLoaded", function () {
  if ($DebugTestMode) {
    console.log("🚀 AI Assistant initializing...");
  }

  // STEP 1: Platform detection
  const platform = aiWindowState.detectPlatform();
  document.body.classList.add(`platform-${platform}`);
  if ($DebugTestMode) {
    console.log("🖥️ Detected platform:", platform);
  }
  // Activate the real-time token checker
  chatManager.setupRealtimeTokenChecker();
  // STEP 2: Initialize enhanced AI window state
  aiWindowState.init();

  // STEP 3: Environment and state
  Environment.init();
  appState.loadFromStorage();
  historyManager.setupHistoryInfiniteScroll();

  // STEP 4: Set up content manager (with fixed click handler)
  contentManager.init();

  // STEP 5: FIXED - Set up window controls AFTER buttons exist
  aiWindowState.setupEventListeners();

  // STEP 6: Initialize window glitch prevention
  //preventWindowGlitching();

  // STEP 7: Set up communication
  aiWindowState.setupCommunication();

  // Initialize chat input manager with proper error handling
  if (window.chatInputManager && typeof chatInputManager.init === "function") {
    try {
      chatInputManager.init();
      if ($DebugTestMode) {
        console.log("✅ ChatInputManager initialized successfully");
      }
    } catch (error) {
      if ($DebugTestMode) {
        console.error("❌ Failed to initialize ChatInputManager:", error);
      }
    }
  }

  if ($DebugTestMode) {
    console.log("calling updateAuthDropdown 4");
  }
  updateAuthDropdown();

  // Set up auth event listeners
  authManager.setupEventListeners();

  // Create attachment previews area if it doesn't exist
  const chatContainer = document.querySelector(".chat-input-container");
  if (chatContainer && !document.getElementById("attachmentPreviews")) {
    const attachmentArea = document.createElement("div");
    attachmentArea.className = "attachment-previews";
    attachmentArea.id = "attachmentPreviews";

    chatContainer.insertBefore(attachmentArea, chatContainer.firstChild);
    if ($DebugTestMode) {
      console.log("✅ Attachment previews area created");
    }
  }

  // Set up UI event listeners
  setupEventListeners();

  // Set up content change detection for activity
  const aiContent = document.getElementById("aiContent");
  if (aiContent) {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
          if ($DebugTestMode) {
            console.log("🔄 Content changed - resetting inactivity timer");
          }
          aiWindowState.resetInactivityTimer();
        }
      });
    });

    observer.observe(aiContent, {
      childList: true,
      subtree: true,
    });

    if ($DebugTestMode) {
      console.log("✅ Content change detection set up");
    }
  }

  /*document.addEventListener("click", function (event) {
    if ($DebugTestMode) {
      console.log("Click event triggered", event.target);
    }
    // Check if the click was outside the app
    if (!app.contains(event.target)) {
      if ($DebugTestMode) {
        console.log("Clicked outside the app");
      }
      document.body.classList.add("inactive");
    } else {
      if ($DebugTestMode) {
        console.log("Clicked inside the app");
      }
    }
  });*/

  // Load streaming preference
  const savedPref = localStorage.getItem("streamingEnabled");
  if (savedPref !== null) {
    chatManager.streamingEnabled = savedPref === "true";
  }

  // 🔧 NEW: Check if AI should be hidden on startup
  const shouldBeMinimized = localStorage.getItem("control_ai_minimized");
  if (shouldBeMinimized === "true") {
    if ($DebugTestMode) {
      console.log("🤖 AI window starting minimized - hiding immediately");
    }
    document.body.style.display = "none";
    // Don't start heartbeat if minimized
    /*if (aiManager && aiManager.heartbeatInterval) {
      clearInterval(aiManager.heartbeatInterval);
      aiManager.heartbeatInterval = null;
    }*/
  } else {
    if ($DebugTestMode) {
      console.log("🤖 AI window starting normally");
    }
    // Clear any stale minimized flags
    localStorage.removeItem("control_ai_minimized");
    localStorage.removeItem("ai_minimized");
  }

  if ($DebugTestMode) {
    console.log("✅ AI Assistant ready!");
  }
});

// Export for debugging
window.appDebug = {
  appState: appState,
  aiWindowState: aiWindowState,
  resetInactivityTimer: function () {
    aiWindowState.resetInactivityTimer();
  },

  clearAllData: function () {
    if (
      confirm("This will clear ALL data including authentication. Continue?")
    ) {
      localStorage.clear();
      window.location.reload();
    }
  },
};

// Make managers globally available for onclick handlers
window.contentManager = contentManager;
window.chatInputManager = chatInputManager;
window.messageManager = messageManager;

if ($DebugTestMode) {
  console.log("✅ COMPLETE AI Assistant loaded!");
}
