// utils.js - Utility functions
"use strict";

if (typeof $DebugTestMode === "undefined") {
  $DebugTestMode = false;
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

function autoResizeTextarea() {
  const chatInput = document.getElementById("chatInput");
  if (!chatInput) return;

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

  // Handle maximize state detection
  if (aiWindowState && aiWindowState.handleResize) {
    aiWindowState.handleResize();
  }
}

// Update the global sendMessage function to work with the new system
function sendMessage() {
  if (window.chatInputManager) {
    window.chatInputManager.sendMessage(); // Uses enhanced method with attachments
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

// Make sendChatMessageDirect available globally for web compatibility
window.sendChatMessageDirect = function (data) {
  chatManager.sendChatMessageDirect(data);
};

// Enhanced activity monitoring
document.addEventListener("mousemove", () => {
  aiWindowState.resetInactivityTimer();
});

document.addEventListener("click", () => {
  aiWindowState.resetInactivityTimer();
});

document.addEventListener("keydown", () => {
  aiWindowState.resetInactivityTimer();
});

document.addEventListener("scroll", () => {
  aiWindowState.resetInactivityTimer();
});

// Screenshot attachment checking
const checkScreenshotAttachments = () => {
  try {
    const screenshotData = localStorage.getItem("screenshot_attachment");
    if (screenshotData) {
      if ($DebugTestMode) {
        console.log(
          "📸 Found screenshot data in localStorage, length:",
          screenshotData.length
        );
      }

      const message = JSON.parse(screenshotData);
      if ($DebugTestMode) {
        console.log(
          "📸 Parsed screenshot message:",
          message.type,
          "timestamp:",
          message.timestamp
        );
      }

      const timeDiff = Date.now() - message.timestamp;
      if ($DebugTestMode) {
        console.log("📸 Time difference:", timeDiff, "ms");
      }

      if (
        timeDiff < 10000 && // Increased to 10 seconds for debugging
        message.type === "ADD_SCREENSHOT_ATTACHMENT"
      ) {
        if ($DebugTestMode) {
          console.log("📸 Processing screenshot attachment");
        }

        // Clear the message
        localStorage.removeItem("screenshot_attachment");

        // Ensure chatInputManager exists
        if (!window.chatInputManager) {
          if ($DebugTestMode) {
            console.error(
              "📸 chatInputManager not available, creating basic version"
            );
          }
          window.chatInputManager = {
            addScreenshotAttachment: function (attachment) {
              if ($DebugTestMode) {
                console.log("📸 Basic screenshot handler called:", attachment);
              }
              alert("Screenshot received: " + attachment.filename);
            },
          };
        }

        // Add to chat input
        if ($DebugTestMode) {
          console.log(
            "📸 Calling addScreenshotAttachment with:",
            message.attachment
          );
        }
        window.chatInputManager.addScreenshotAttachment(message.attachment);
      } else {
        if ($DebugTestMode) {
          console.log("📸 Screenshot message too old or wrong type, ignoring");
        }
      }
    }
  } catch (error) {
    if ($DebugTestMode) {
      console.error("📸 Error checking screenshot attachments:", error);
    }
  }
};

// ENHANCED: More frequent checking and better error handling
let screenshotCheckInterval = null;

function startScreenshotChecking() {
  if (screenshotCheckInterval) {
    clearInterval(screenshotCheckInterval);
  }

  if ($DebugTestMode) {
    console.log("📸 Starting screenshot attachment checking...");
  }
  screenshotCheckInterval = setInterval(checkScreenshotAttachments, 200); // Check every 200ms

  // Also check immediately
  checkScreenshotAttachments();
}

// Start checking when the script loads
startScreenshotChecking();

// Check for screenshot attachments every 500ms
setInterval(checkScreenshotAttachments, 500);

// Also listen for postMessage
window.addEventListener("message", (event) => {
  if (event.data && event.data.type === "ADD_SCREENSHOT_ATTACHMENT") {
    if ($DebugTestMode) {
      console.log("📸 Received screenshot via postMessage");
    }
    chatInputManager.addScreenshotAttachment(event.data.attachment);
  }
});

function preventWindowGlitching() {
  let isMoving = false;
  let moveTimeout;
  let preventMaximize = false;

  if ($DebugTestMode) {
    console.log("🔄 Window glitching prevention initialized");
  }

  // Don't prevent minimize operations at all
  window.preventMinimize = false;
  if ($DebugTestMode) {
    console.log("✅ Minimize operations are allowed");
  }

  window.addEventListener("resize", (e) => {
    const currentWidth = window.innerWidth;
    const currentHeight = window.innerHeight;

    if ($DebugTestMode) {
      console.log(`📏 Window resized to: ${currentWidth}x${currentHeight}`);
      console.log(`📊 Screen dimensions: ${screen.width}x${screen.height}`);
    }

    // Only prevent maximize if window is being dragged to screen edges
    if (
      currentWidth >= screen.width - 50 &&
      currentHeight >= screen.height - 50
    ) {
      if ($DebugTestMode) {
        console.log(
          "🎯 Window approaching screen edges - checking for maximize prevention"
        );
      }

      preventMaximize = true;
      if ($DebugTestMode) {
        console.log("🚫 Preventing auto-maximize during window move");
      }

      // Clear this after a short time
      clearTimeout(moveTimeout);
      if ($DebugTestMode) {
        console.log("⏰ Setting timeout to clear maximize prevention");
      }

      moveTimeout = setTimeout(() => {
        preventMaximize = false;
        if ($DebugTestMode) {
          console.log("✅ Auto-maximize prevention cleared");
        }
        if ($DebugTestMode) {
          console.log(
            "🔄 Maximize prevention timeout completed - allow maximize again"
          );
        }
      }, 1000);

      if ($DebugTestMode) {
        console.log(
          `⏱️ Timeout set for 1000ms, preventMaximize: ${preventMaximize}`
        );
      }
    } else {
      if ($DebugTestMode) {
        console.log("📱 Window not near screen edges - maximize allowed");
      }
    }
  });

  // Make preventMaximize accessible globally
  Object.defineProperty(window, "preventMaximize", {
    get: () => {
      if ($DebugTestMode) {
        console.log(`🔍 Getting preventMaximize value: ${preventMaximize}`);
      }
      return preventMaximize;
    },
    set: (value) => {
      if ($DebugTestMode) {
        console.log(`✏️ Setting preventMaximize to: ${value}`);
      }
      preventMaximize = value;
    },
  });

  if ($DebugTestMode) {
    console.log("✅ Global preventMaximize property defined");
  }
}

// Add debug code to see what's happening
function debugMinimizeIssue() {
  if ($DebugTestMode) {
    console.log("🔍 Setting up minimize debug...");
  }

  const minimizeBtn = document.getElementById("minimizeBtn");

  if (!minimizeBtn) {
    if ($DebugTestMode) {
      console.error("❌ Minimize button not found!");
    }
    return;
  }

  if ($DebugTestMode) {
    console.log("✅ Minimize button found:", minimizeBtn);
    console.log("🔍 Button onclick:", minimizeBtn.onclick);
    console.log("🔍 Button classList:", minimizeBtn.classList.toString());
  }

  // Add a capture-phase listener to see if events are being stopped
  minimizeBtn.addEventListener(
    "click",
    function (e) {
      if ($DebugTestMode) {
        console.log("🔍 CAPTURE PHASE: Minimize clicked");
        console.log("🔍 Event defaultPrevented:", e.defaultPrevented);
        console.log("🔍 Event cancelBubble:", e.cancelBubble);
        console.log("🔍 preventMaximize:", window.preventMaximize);
        console.log("🔍 preventMinimize:", window.preventMinimize);
      }
    },
    { capture: true }
  );

  // Add a bubble-phase listener
  minimizeBtn.addEventListener(
    "click",
    function (e) {
      if ($DebugTestMode) {
        console.log("🔍 BUBBLE PHASE: Minimize clicked");
      }
    },
    { capture: false }
  );

  // Test direct minimize call
  if ($DebugTestMode) {
    console.log("🔍 Testing direct minimize call...");
  }
  window.testMinimize = function () {
    if ($DebugTestMode) {
      console.log("🔍 Direct minimize test called");
    }
    aiWindowState.minimizeToControl();
  };

  if ($DebugTestMode) {
    console.log(
      "🔍 Debug setup complete. Try clicking minimize or run testMinimize()"
    );
  }
}

// Call this after DOM is loaded
setTimeout(debugMinimizeIssue, 1000);

// Make debug function globally available
window.debugAIRestore = function () {
  if (window.aiWindowState) {
    window.aiWindowState.debugAndResetState();
  } else {
    if ($DebugTestMode) {
      console.error("❌ aiWindowState not found for debugAIRestore");
    }
  }
};

window.forceAIRestore = function () {
  if (window.aiWindowState) {
    window.aiWindowState.restoreInProgress = false;
    window.aiWindowState.isMinimized = true;
    window.aiWindowState.restoreFromMinimized();
  }
};

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

// Export utility functions if using modules
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    addToChat,
    autoResizeTextarea,
    handleResize,
    sendMessage,
    checkScreenshotAttachments,
    startScreenshotChecking,
    preventWindowGlitching,
    debugMinimizeIssue,
  };
}
