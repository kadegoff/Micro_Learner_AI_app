// aiWindowState.js - Window state management (FIXED: Preserve minimized state on load)
"use strict";

if (typeof $DebugTestMode === "undefined") {
  $DebugTestMode = true;
}

var aiWindowState = {
  isMinimized: false,
  isMaximized: false,
  platform: "windows",

  // NEW: Transparency and focus management
  isWindowFocused: true,
  inactivityTimer: null,
  heartbeatInterval: null,

  // Disable auto-restore to prevent conflicts
  autoRestoreEnabled: false,

  // Track restore attempts to prevent loops
  restoreInProgress: false,

  // FIXED: Prevent rapid maximize toggle
  maximizeToggling: false,

  // 🔧 NEW: Track if we've already cleared flags to prevent multiple resets
  flagsAlreadyCleared: false,

  init: function () {
    if ($DebugTestMode) {
      console.log("🪟 Initializing enhanced AI window state...");
    }

    this.platform = this.detectPlatform();
    this.setupPlatformSpecificStyles();
    this.setupCommunication();
    this.setupFocusDetection(); // NEW
    this.setupTransparencyControl(); // NEW
    this.setupEventListeners();
    this.checkStartupState();

    if ($DebugTestMode) {
      console.log("✅ Enhanced AI window state initialized");
    }
  },

  // NEW: Setup focus detection for inactive transparency
  setupFocusDetection: function () {
    if ($DebugTestMode) {
      console.log("👁️ Setting up focus detection for inactive transparency...");
    }

    window.addEventListener("focus", () => {
      if ($DebugTestMode) {
        console.log("[Focus] Window focused - removing inactive class");
      }
      this.isWindowFocused = true;
      document.body.classList.remove("inactive");
    });

    window.addEventListener("blur", () => {
      if ($DebugTestMode) {
        console.log(
          "[Focus] Window blurred - will add inactive class after delay"
        );
      }
      this.isWindowFocused = false;
      //setTimeout(() => {
      if (!this.isWindowFocused && !this.isMaximized) {
        // FIXED: Don't add inactive when maximized
        if ($DebugTestMode) {
          console.log("[Focus] Window still unfocused - adding inactive class");
        }
        document.body.classList.add("inactive");
      }
      // }, 1000);
    });

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        if ($DebugTestMode) {
          console.log("[Visibility] Document hidden - adding inactive class");
        }
        this.isWindowFocused = false;
        // FIXED: Don't add inactive when maximized
        if (!this.isMaximized) {
          document.body.classList.add("inactive");
        }
      } else {
        if ($DebugTestMode) {
          console.log(
            "[Visibility] Document visible - removing inactive class"
          );
        }
        this.isWindowFocused = true;
        document.body.classList.remove("inactive");
        if (!this.heartbeatInterval && !this.isMinimized) {
          this.startHeartbeat();
        }
      }
    });

    if ($DebugTestMode) {
      console.log("✅ Focus detection setup complete");
    }
  },

  setupTransparencyControl: function () {
    if ($DebugTestMode) {
      console.log("🎨 Setting up transparency control...");
    }

    // Add fade-mode class for enhanced transparency
    document.body.classList.add("fade-mode");

    // Start the inactivity timer system
    this.startInactivityTimer();

    if ($DebugTestMode) {
      console.log("✅ Transparency control setup complete");
    }
  },

  // NEW: Start inactivity timer
  startInactivityTimer: function () {
    this.resetInactivityTimer();
  },

  // NEW: Reset inactivity timer on user activity
  resetInactivityTimer: function () {
    // Clear existing timer if present
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
    }

    // Always remove 'inactive' class when activity is detected
    if (document.body.classList.contains("inactive")) {
      if ($DebugTestMode) {
        console.log(
          "[UI] Removing 'inactive' class (making window less transparent)"
        );
      }
      document.body.classList.remove("inactive");
    }

    this.inactivityTimer = setTimeout(() => {
      if ($DebugTestMode) {
        console.log(
          "[Timer] Inactivity timeout reached (5 seconds without activity)"
        );
      }

      // FIXED: Don't add inactive when window is focused OR maximized
      if (!this.isWindowFocused && !this.isMaximized) {
        if ($DebugTestMode) {
          console.log("this.isWindowFocused:", this.isWindowFocused);
          console.log("this.isMaximized:", this.isMaximized);
          console.log(
            "[UI] Adding 'inactive' class (making window more transparent)"
          );
        }
        document.body.classList.add("inactive");
      } else {
        if ($DebugTestMode) {
          console.log(
            "[UI] Window is focused or maximized - not adding 'inactive' class"
          );
        }
      }
    }, 5000);
  },

  toggleMaximize: function () {
    // Prevent rapid toggle calls
    if (this.maximizeToggling) {
      if ($DebugTestMode) {
        console.log("🔼 Toggle maximize already in progress, ignoring");
      }
      return;
    }

    this.maximizeToggling = true;

    if ($DebugTestMode) {
      console.log(
        "🔼 Toggle maximize - current state before toggle:",
        this.isMaximized
      );
    }

    // Store the intended action
    const shouldMaximize = !this.isMaximized;

    if (shouldMaximize) {
      if ($DebugTestMode) {
        console.log("🔼 Executing MAXIMIZE");
      }
      this.maximizeWindow();
    } else {
      if ($DebugTestMode) {
        console.log("🔼 Executing RESTORE");
      }
      this.restoreWindow();
    }

    // FIXED: Extended delay to ensure Electron APIs complete
    setTimeout(() => {
      // Force button update after state change
      this.updateMaximizeButton();
      if ($DebugTestMode) {
        console.log("🔼 Final state after toggle:", this.isMaximized);
        console.log("🔼 Forced button update after toggle");
      }
    }, 150);

    // Clear the toggle lock after a longer delay to prevent resize interference
    setTimeout(() => {
      this.maximizeToggling = false;
      if ($DebugTestMode) {
        console.log("🔼 Toggle lock cleared");
      }
    }, 500); // Increased to 500ms
  },

  maximizeWindow: function () {
    if ($DebugTestMode) {
      console.log("🔼 Maximizing AI window - setting state to TRUE");
    }

    if ($DebugTestMode) {
      console.log("📝 Setting internal maximized state to true");
      console.log("🎨 Adding 'maximized' CSS class to body");
      console.log("🎨 Removing 'inactive' CSS class from body");
      console.log("🔄 Updating maximize button appearance");
      console.log("💾 Saving maximized state to localStorage");
    }

    // FIXED: Set state BEFORE calling Electron API to prevent race conditions
    this.isMaximized = true;

    document.body.classList.add("maximized");
    document.body.classList.remove("inactive"); // FIXED: Remove inactive when maximizing

    // Update button immediately with new state
    this.updateMaximizeButton();

    localStorage.setItem("ai_window_maximized", "true");

    // FIXED: Use proper Electron API calls AFTER setting internal state
    if (window.electronAPI) {
      if ($DebugTestMode) {
        console.log("🔌 Electron API detected, calling maximize functions");
      }

      if (window.electronAPI.maximizeWindow) {
        if ($DebugTestMode) {
          console.log("📞 Calling window.electronAPI.maximizeWindow()");
        }
        window.electronAPI.maximizeWindow();
      } else if (window.electronAPI.toggleMaximize) {
        if ($DebugTestMode) {
          console.log("📞 Calling window.electronAPI.toggleMaximize()");
        }
        window.electronAPI.toggleMaximize();
      } else {
        if ($DebugTestMode) {
          console.log("⚠️ No maximize functions found in electronAPI");
        }
      }
    } else {
      if ($DebugTestMode) {
        console.log(
          "❌ window.electronAPI not available (running in browser?)"
        );
      }
    }

    if ($DebugTestMode) {
      console.log("✅ Window maximized, state set to:", this.isMaximized);
      console.log("✅ Maximize process completed");
    }
  },

  restoreWindow: function () {
    if ($DebugTestMode) {
      console.log("🔽 Restoring AI window - setting state to FALSE");
      console.log(
        "🔽🔽🔽🔽🔽🔽🔽🔽🔽🔽🔽🔽REMOVING THE LOCALLY STORED ai_window_maximized 1"
      );
    }

    // FIXED: Set state BEFORE calling Electron API to prevent race conditions
    this.isMaximized = false;
    document.body.classList.remove("maximized");

    // Update button immediately with new state
    this.updateMaximizeButton();

    localStorage.removeItem("ai_window_maximized");

    // FIXED: Use proper Electron API calls AFTER setting internal state
    if (window.electronAPI) {
      if (window.electronAPI.restoreWindow) {
        window.electronAPI.restoreWindow();
      } else if (window.electronAPI.toggleMaximize) {
        window.electronAPI.toggleMaximize();
      }
    }

    // FIXED: Reset inactivity timer after restoring from maximize
    this.resetInactivityTimer();

    if ($DebugTestMode) {
      console.log("✅ Window restored, state set to:", this.isMaximized);
    }
  },

  updateMaximizeButton: function () {
    const maximizeBtn = document.getElementById("maximizeBtn");
    if (maximizeBtn) {
      const newTitle = this.isMaximized ? "Restore" : "Maximize";
      const newIcon = this.getMaximizeIcon();

      // Update both title and icon
      maximizeBtn.title = newTitle;
      maximizeBtn.innerHTML = newIcon;

      if ($DebugTestMode) {
        console.log(
          `🔘 Updated maximize button: ${newTitle} (${newIcon}) - isMaximized: ${this.isMaximized}`
        );
        console.log(`🔘 Button element:`, maximizeBtn);
        console.log(`🔘 Button innerHTML after update:`, maximizeBtn.innerHTML);
      }

      // Force a visual refresh
      maximizeBtn.offsetHeight; // Trigger reflow
    } else {
      if ($DebugTestMode) {
        console.error("❌ Maximize button not found! Cannot update icon.");
      }
    }
  },

  // FIXED: Separate function for getting the correct icon
  getMaximizeIcon: function () {
    return this.isMaximized ? "🗗" : "&#9634;";
  },

  // FIXED: Better resize handling with proper state management
  handleResize: function () {
    if ($DebugTestMode) {
      console.log("🔄 handleResize triggered");
      console.log(`   maximizeToggling: ${this.maximizeToggling}`);
      console.log(`   Current isMaximized: ${this.isMaximized}`);
      console.log(`   Window: ${window.innerWidth}x${window.innerHeight}`);
      console.log(`   Screen: ${screen.width}x${screen.height}`);
      console.log(
        `   Width comparison: ${window.innerWidth} === ${screen.width} = ${
          window.innerWidth === screen.width
        }`
      );
      console.log(
        `   Height comparison: ${window.innerHeight} === ${screen.height} = ${
          window.innerHeight === screen.height
        }`
      );
    }

    // Don't interfere if we're in the middle of a manual toggle
    if (this.maximizeToggling) {
      if ($DebugTestMode) {
        console.log("🔍 Resize detected but toggle in progress, ignoring");
        console.log("   Maximize toggling flag is true, exiting early");
      }
      return;
    }

    // Check if window is actually maximized using multiple indicators
    const isFullscreen =
      window.innerWidth === screen.width &&
      window.innerHeight === screen.height;

    const wasMaximized = this.isMaximized;

    if ($DebugTestMode) {
      console.log(`   Calculated isFullscreen: ${isFullscreen}`);
      console.log(`   Previous state (wasMaximized): ${wasMaximized}`);
      console.log(`   Body classes: ${document.body.classList.toString()}`);
      console.log(
        `   LocalStorage value: ${localStorage.getItem("ai_window_maximized")}`
      );
    }

    // Only update if there's a significant change and we're not manually toggling
    if (isFullscreen !== this.isMaximized) {
      if ($DebugTestMode) {
        console.log(
          `🔍 Resize state change detected: ${this.isMaximized} → ${isFullscreen}`
        );
      }

      this.isMaximized = isFullscreen;

      if (isFullscreen) {
        document.body.classList.add("maximized");
        document.body.classList.remove("inactive"); // Remove inactive when maximizing
        localStorage.setItem("ai_window_maximized", "true");
        if ($DebugTestMode) {
          console.log("🔼 Window detected as maximized via resize");
          console.log("   Added 'maximized' class, removed 'inactive' class");
          console.log("   Set localStorage: ai_window_maximized = true");
        }
      } else {
        document.body.classList.remove("maximized");
        if ($DebugTestMode) {
          console.log(
            "🔽🔽🔽🔽🔽🔽🔽🔽🔽🔽🔽🔽REMOVING THE LOCALLY STORED ai_window_maximized"
          );
          console.log("🔽 Window detected as restored via resize");
          console.log("   Removed 'maximized' class");
          console.log("   Removed localStorage: ai_window_maximized");
          console.log("   Reset inactivity timer");
        }
        localStorage.removeItem("ai_window_maximized");
        // Reset inactivity timer when unmaximizing
        this.resetInactivityTimer();
      }

      // Only update button if we're not in a manual toggle
      if (!this.maximizeToggling) {
        if ($DebugTestMode) {
          console.log("🔄 Updating maximize button (not in toggle mode)");
          console.log("   Calling updateMaximizeButton()");
        }
        this.updateMaximizeButton();
      }
    } else {
      if ($DebugTestMode) {
        console.log("⚡ No state change detected, skipping update");
        console.log(
          `   isFullscreen (${isFullscreen}) === this.isMaximized (${this.isMaximized})`
        );
      }
    }

    if ($DebugTestMode) {
      console.log("✅ handleResize completed\n");
      console.log(`   Final isMaximized state: ${this.isMaximized}`);
      console.log(
        `   Final body classes: ${document.body.classList.toString()}`
      );
    }
  },

  detectPlatform: function () {
    const userAgent = navigator.userAgent.toLowerCase();
    if (userAgent.includes("win")) return "windows";
    if (userAgent.includes("mac")) return "mac";
    return "other";
  },

  setupPlatformSpecificStyles: function () {
    this.platform = "windows";

    if ($DebugTestMode) {
      console.log("Detected platform:", this.platform);
      console.log("navigator.platform:", navigator.platform);
      console.log("Added class to body:", `platform-${this.platform}`);
      console.log("Body classes:", document.body.classList.toString());
    }

    // Add platform class to body
    document.body.classList.add(`platform-${this.platform}`);

    const windowControls = document.querySelector(".window-controls");
    if ($DebugTestMode) {
      console.log("Found windowControls element:", windowControls);
    }

    if (windowControls) {
      // Clear the container
      windowControls.innerHTML = "";
      if ($DebugTestMode) {
        console.log("Cleared windowControls innerHTML");
      }

      windowControls.classList.remove("platform-mac");

      // Get the maximize button icon using the getMaximizeIcon method
      const maximizeButtonContent = this.getMaximizeIcon();

      windowControls.innerHTML = `
      <button class="window-control-btn minimize-btn" id="minimizeBtn" title="Minimize to Control Center"></button>
      <button class="window-control-btn maximize-btn" id="maximizeBtn" title="Maximize">${maximizeButtonContent}</button>
      <button class="window-control-btn close-btn" id="closeBtn" title="Close"></button>
    `;

      if ($DebugTestMode) {
        console.log("Set window controls innerHTML");
        console.log("Platform:", this.platform);
        console.log("Maximize button content:", maximizeButtonContent);
        console.log(
          "windowControls innerHTML after setting:",
          windowControls.innerHTML
        );
        console.log(
          "windowControls classes:",
          windowControls.classList.toString()
        );
        console.log(
          "Window controls created, event listeners will be attached in setupEventListeners()"
        );
      }
    } else {
      if ($DebugTestMode) {
        console.error(
          "windowControls element not found! Make sure .window-controls exists in your HTML"
        );
      }
    }
  },

  setupCommunication: function () {
    if ($DebugTestMode) {
      console.log("🔧 Setting up AI window communication...");
    }

    // Core setup tasks
    this.platform = this.detectPlatform();
    window.addEventListener("resize", () => this.handleResize());

    // Restore maximized state from localStorage
    if ($DebugTestMode) {
      console.log("Checking if window was previously maximized...");
    }
    const wasMaximized = localStorage.getItem("ai_window_maximized") === "true";
    if ($DebugTestMode) {
      console.log("Maximized state from localStorage:", wasMaximized);
    }

    if (wasMaximized) {
      if ($DebugTestMode) {
        console.log(
          "Window was previously maximized, scheduling maximize in 100ms"
        );
        console.log("Executing maximizeWindow()");
      }
      setTimeout(() => {
        this.maximizeWindow();
      }, 100);
    } else {
      if ($DebugTestMode) {
        console.log("Window was not previously maximized, no action needed");
      }
    }

    // Unified message handling system
    this.setupMessageProcessor(); // Existing processor setup
    this.checkStartupState(); // Initial state check

    // Combined communication channels
    // 1. Window message listener (for real-time RESTORE_AI commands)
    window.addEventListener("message", (event) => {
      if (event.data?.type === "RESTORE_AI") {
        this.restoreFromMinimized();
      }
    });

    // 2. LocalStorage polling (for cross-tab/browser control)
    const checkControlMessages = () => {
      try {
        const restoreFlags = ["restore_ai", "show_ai_window"];
        restoreFlags.forEach((flag) => {
          if (localStorage.getItem(flag) === "true") {
            localStorage.removeItem(flag);
            this.restoreFromMinimized();
          }
        });
      } catch (e) {
        if ($DebugTestMode) {
          console.debug("LocalStorage message parse error:", e);
        }
      }
    };

    // Start polling
    setInterval(checkControlMessages, 500);

    if ($DebugTestMode) {
      console.log("✅ AI communication setup complete");
    }
  },

  setupMessageProcessor: function () {
    if ($DebugTestMode) {
      console.log("🤖 AI: Setting up communication listeners...");
    }

    // Listen for custom restore event (same as transcript)
    window.addEventListener("restoreAI", (event) => {
      if ($DebugTestMode) {
        console.log("🤖 AI: 🎯 restoreAI custom event received:", event.detail);
      }
      this.restoreFromMinimized();
    });

    // Listen for restore messages from control (same as transcript)
    window.addEventListener("message", (event) => {
      if (event.data && event.data.type === "RESTORE_AI") {
        if ($DebugTestMode) {
          console.log("🤖 AI: 🎯 RESTORE_AI message received:", event.data);
        }
        this.restoreFromMinimized();
      }
    });

    // Check for restore flag periodically (same as transcript)
    setInterval(() => {
      const restoreFlag = localStorage.getItem("ai_restore_request");
      const currentTime = Date.now();

      if (restoreFlag) {
        try {
          const parsedFlag = JSON.parse(restoreFlag);
          const messageAge = currentTime - parsedFlag.timestamp;

          if ($DebugTestMode) {
            console.log("🤖 AI: 🔔 Found restore request in localStorage:");
            console.log("  - Message:", parsedFlag);
            console.log("  - Age:", messageAge, "ms");
            console.log("  - From source:", parsedFlag.source);
          }

          // Only process recent messages (within 10 seconds)
          if (messageAge < 10000) {
            if ($DebugTestMode) {
              console.log("🤖 AI: 🔔 Processing restore request...");
            }
            localStorage.removeItem("ai_restore_request");
            this.restoreFromMinimized();
          } else {
            if ($DebugTestMode) {
              console.log(
                "🤖 AI: 🔔 Restore request too old, ignoring and cleaning up"
              );
            }
            localStorage.removeItem("ai_restore_request");
          }
        } catch (e) {
          if ($DebugTestMode) {
            console.log("🤖 AI: 🔔 Non-JSON restore flag found:", restoreFlag);
          }
          localStorage.removeItem("ai_restore_request");
          this.restoreFromMinimized();
        }
      }
    }, 500); // Check every 500ms for faster response

    // Send heartbeat every 2 seconds to let control window know we're visible
    setInterval(() => {
      if (!this.isMinimized && document.body.style.display !== "none") {
        localStorage.setItem("ai_heartbeat", Date.now().toString());
      }
    }, 2000);

    // Send initial heartbeat immediately
    localStorage.setItem("ai_heartbeat", Date.now().toString());

    if ($DebugTestMode) {
      console.log("🤖 AI: ✅ Communication setup complete");
    }
  },

  // 🔥 ENHANCED: Better restore message processing
  processRestoreMessage: function (messageData) {
    if ($DebugTestMode) {
      console.log("🔄 🎯 AI: ===== PROCESSING RESTORE MESSAGE =====");
      console.log("🔄 Message data:", messageData);
      console.log("🔄 Current state:", {
        isMinimized: this.isMinimized,
        restoreInProgress: this.restoreInProgress,
        bodyDisplay: document.body.style.display,
        bodyVisibility: document.body.style.visibility,
      });
    }

    // Prevent duplicate processing
    if (this.restoreInProgress) {
      if ($DebugTestMode) {
        console.log("🔄 ⚠️ AI: Restore already in progress, ignoring");
      }
      return;
    }

    // Set flag to prevent conflicts
    this.restoreInProgress = true;

    // Send acknowledgment FIRST
    if (messageData.restoreId) {
      const ackMessage = {
        type: "AI_RESTORING",
        timestamp: Date.now(),
        source: "ai",
        restoreId: messageData.restoreId,
      };

      // Send acknowledgment via multiple channels
      localStorage.setItem("ai_message", JSON.stringify(ackMessage));
      window.postMessage(ackMessage, "*");

      if ($DebugTestMode) {
        console.log("🔄 📤 AI: Sent AI_RESTORING acknowledgment:", ackMessage);
      }
    }

    // Execute restore after a small delay to ensure acknowledgment is sent
    setTimeout(() => {
      try {
        if ($DebugTestMode) {
          console.log("🔄 ⚡ AI: Executing restoreFromMinimized()");
        }

        this.restoreFromMinimized();

        // Send success confirmation
        if (messageData.restoreId) {
          const successMessage = {
            type: "AI_RESTORED",
            timestamp: Date.now(),
            source: "ai",
            restoreId: messageData.restoreId,
          };

          localStorage.setItem("ai_message", JSON.stringify(successMessage));
          window.postMessage(successMessage, "*");

          if ($DebugTestMode) {
            console.log(
              "🔄 ✅ AI: Sent AI_RESTORED confirmation:",
              successMessage
            );
          }
        }
      } catch (error) {
        if ($DebugTestMode) {
          console.error("🔄 ❌ AI: Restore failed:", error);
        }

        // Send failure notification
        if (messageData.restoreId) {
          const failMessage = {
            type: "AI_RESTORE_FAILED",
            timestamp: Date.now(),
            source: "ai",
            restoreId: messageData.restoreId,
            error: error.message,
          };

          localStorage.setItem("ai_message", JSON.stringify(failMessage));
          window.postMessage(failMessage, "*");
        }
      } finally {
        this.restoreInProgress = false;
      }
    }, 100);

    if ($DebugTestMode) {
      console.log("🔄 🎯 AI: ===== RESTORE MESSAGE PROCESSING COMPLETE =====");
    }
  },

  // Check startup state more carefully
  checkStartupState: function () {
    if ($DebugTestMode) {
      console.log("🔍 AI startup state check:");
      console.log(
        "  sessionMinimized:",
        sessionStorage.getItem("ai_minimized_this_session")
      );
      console.log(
        "  localMinimized:",
        localStorage.getItem("control_ai_minimized")
      );
      console.log("  aiMinimized:", localStorage.getItem("ai_minimized"));
    }

    // Check multiple state indicators
    const sessionMinimized = sessionStorage.getItem(
      "ai_minimized_this_session"
    );
    const localMinimized = localStorage.getItem("control_ai_minimized");
    const aiMinimized = localStorage.getItem("ai_minimized");

    // Only start minimized if ALL indicators agree
    const shouldStartMinimized =
      sessionMinimized === "true" &&
      localMinimized === "true" &&
      aiMinimized === "true";

    if (shouldStartMinimized) {
      if ($DebugTestMode) {
        console.log("🫥 AI starting minimized from stored state");
      }
      this.startMinimized();
    } else {
      if ($DebugTestMode) {
        console.log("👁️ AI starting normally");
      }
      this.startNormal();
    }
  },

  // NEW: Clean startup methods
  startMinimized: function () {
    if ($DebugTestMode) {
      console.log("[startMinimized] Function called - hiding AI window");
    }

    try {
      // Hide window visually
      document.body.style.display = "none";
      document.body.style.visibility = "hidden";
      if ($DebugTestMode) {
        console.log(
          "[startMinimized] Set body styles: display=none, visibility=hidden"
        );
      }

      this.isMinimized = true;
      if ($DebugTestMode) {
        console.log("[startMinimized] Set isMinimized flag to true");
        console.log("[startMinimized] Keeping existing minimized flags intact");
        console.log(
          "[startMinimized] Scheduling AI_MINIMIZED notification (500ms delay)"
        );
      }

      // 🔧 FIXED: Don't clear flags on startup - they're already set correctly

      // Notify control center
      setTimeout(() => {
        if ($DebugTestMode) {
          console.log("[startMinimized] Executing delayed notification");
        }
        try {
          this.notifyControlCenter("AI_MINIMIZED");
          if ($DebugTestMode) {
            console.log(
              "[startMinimized] Sent AI_MINIMIZED notification to control center"
            );
          }
        } catch (notificationError) {
          if ($DebugTestMode) {
            console.error(
              "[startMinimized] Error sending notification:",
              notificationError
            );
          }
        }
      }, 500);

      if ($DebugTestMode) {
        console.log("[startMinimized] Function completed successfully");
      }
    } catch (mainError) {
      if ($DebugTestMode) {
        console.error(
          "[startMinimized] Critical error in function:",
          mainError
        );
      }
    }
  },

  // 🔧 FIXED: Don't clear minimized flags on normal start if they should be preserved
  startNormal: function () {
    if ($DebugTestMode) {
      console.log("[DEBUG] startNormal function called");
    }

    // 🔧 FIXED: DON'T automatically clear flags if they indicate the window should be minimized
    // This preserves the minimized state across page reloads
    const controlMinimized = localStorage.getItem("control_ai_minimized");
    const aiMinimized = localStorage.getItem("ai_minimized");

    if ($DebugTestMode) {
      console.log("[DEBUG] Storage state check:", {
        controlMinimized,
        aiMinimized,
      });
    }

    // 🔧 NEW: Only clear flags if this is truly a fresh start (no minimized flags set)
    // If flags are set to "true", respect them and don't clear them
    if (controlMinimized !== "true" && aiMinimized !== "true") {
      if ($DebugTestMode) {
        console.log("[DEBUG] No minimized flags set - starting fresh");
        console.log("[DEBUG] Clearing stale non-true flags");
      }
      // Only clear if there are stale flags (not "true")
      if (controlMinimized || aiMinimized) {
        this.clearMinimizedFlags("startNormal");
      }
    } else {
      if ($DebugTestMode) {
        console.log(
          "[DEBUG] Minimized flags are set to 'true' - preserving them"
        );
        console.log(
          "[DEBUG] Window should stay minimized based on stored state"
        );
      }
      // Don't clear the flags - they indicate the window should be minimized
      // The checkStartupState() function will handle starting in minimized state
      return;
    }

    this.isMinimized = false;
    if ($DebugTestMode) {
      console.log("[DEBUG] Minimized state reset:", this.isMinimized);
    }

    // Ensure window is visible
    document.body.style.display = "flex";
    document.body.style.visibility = "visible";
    if ($DebugTestMode) {
      console.log("[DEBUG] Window visibility set to visible");
      console.log("[DEBUG] Scheduling control center notification...");
    }

    // Notify control center
    setTimeout(() => {
      if ($DebugTestMode) {
        console.log("[DEBUG] Sending AI_RESTORED notification");
      }
      this.notifyControlCenter("AI_RESTORED");
    }, 500);
  },

  // FIXED: Better minimize function
  minimizeToControl: function () {
    if ($DebugTestMode) {
      console.log("🔽 AI: minimizeToControl called");
    }

    // Stop heartbeat
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    // Remove heartbeat from storage
    localStorage.removeItem("ai_heartbeat");
    localStorage.removeItem("ai_heartbeat_debug");

    // Show notification and start animation
    this.showMinimizeNotification();
    document.body.classList.add("minimizing");
    this.notifyControlCenter("AI_MINIMIZING");

    document.body.style.display = "none";
    document.body.classList.remove("minimizing");
    this.isMinimized = true;

    // 🔧 FIXED: Use single function to set flags
    this.setMinimizedFlags("minimizeToControl");

    this.notifyControlCenter("AI_MINIMIZED");
  },

  // MODIFIED: Use the same restoration approach as Transcript window
  restoreFromMinimized: function () {
    if (this.restoreLock) return; // Prevent re-entry

    this.restoreLock = true;
    if ($DebugTestMode) {
      console.log("🔼 AI: restoreFromMinimized (LOCKED)");
    }

    // Show window and start animation (same as Transcript)
    document.body.style.display = "flex";
    document.body.classList.add("restoring");

    // 🔧 FIXED: Only clear flags if actually minimized
    const needsClearing =
      this.isMinimized ||
      localStorage.getItem("control_ai_minimized") === "true" ||
      localStorage.getItem("ai_minimized") === "true";

    if (needsClearing) {
      if ($DebugTestMode) {
        console.log(
          "🔼 AI: Clearing minimized flags (window was actually minimized)"
        );
      }
      this.clearMinimizedFlags("restoreFromMinimized");
    } else {
      if ($DebugTestMode) {
        console.log("🔼 AI: No need to clear flags (window was not minimized)");
      }
    }

    this.isMinimized = false;

    // After animation completes (same as Transcript)
    setTimeout(() => {
      document.body.classList.remove("restoring");

      // Use native focus() instead of Electron API (same as Transcript)
      window.focus();

      // Check if window should be maximized based on screen size
      this.checkAndSetWindowState();

      this.notifyControlCenter("AI_RESTORED");
      this.restoreLock = false;
    }, 400); // Same 400ms duration as Transcript
  },

  checkAndSetWindowState: function () {
    if ($DebugTestMode) {
      console.log("📱 checkAndSetWindowState() called");
      console.log(
        "📊 Screen dimensions:",
        window.screen.width + "x" + window.screen.height
      );
      console.log(
        "📊 Window dimensions:",
        (window.outerWidth || 800) + "x" + (window.outerHeight || 600)
      );
      console.log(
        "📈 Width ratio:",
        (window.outerWidth || 800) / window.screen.width
      );
      console.log(
        "📈 Height ratio:",
        (window.outerHeight || 600) / window.screen.height
      );
      console.log("📌 Current isMaximized state:", this.isMaximized);
      console.log(
        "📌 Threshold check:",
        (window.outerWidth || 800) / window.screen.width > 0.9 &&
          (window.outerHeight || 600) / window.screen.height > 0.9 &&
          !this.isMaximized
      );
    }

    // Get screen dimensions
    const screenWidth = window.screen.width;
    const screenHeight = window.screen.height;

    // Get window dimensions (you might need to adjust these based on your actual window size)
    const windowWidth = window.outerWidth || 800; // default fallback
    const windowHeight = window.outerHeight || 600; // default fallback

    // Check if window occupies most of the screen (e.g., 90% threshold)
    const widthRatio = windowWidth / screenWidth;
    const heightRatio = windowHeight / screenHeight;

    if (widthRatio > 0.9 && heightRatio > 0.9 && !this.isMaximized) {
      // Window occupies most of the screen, consider it maximized
      if ($DebugTestMode) {
        console.log("✅ Condition met - calling toggleMaximize()");
        console.log(
          "📱 Window detected as maximized (occupies most of screen)"
        );
      }
      this.isMaximized = true;
      this.updateMaximizeButton();
    } else {
      // Window doesn't occupy most of the screen
      if ($DebugTestMode) {
        console.log("❌ Condition not met - setting isMaximized to false");
        console.log("📱 Window detected as normal size");
      }
      this.isMaximized = false;
    }

    if ($DebugTestMode) {
      console.log("📱 Final isMaximized state:", this.isMaximized);
      console.log("----------------------------------------");
    }
  },

  // 🔧 NEW: Centralized function to set minimized flags (with logging)
  setMinimizedFlags: function (calledFrom) {
    if ($DebugTestMode) {
      console.log(`🔧 setMinimizedFlags called from: ${calledFrom}`);
      console.log("✅ Set all minimized flags to true");
    }

    sessionStorage.setItem("ai_minimized_this_session", "true");
    localStorage.setItem("ai_minimized", "true");
    localStorage.setItem("control_ai_minimized", "true");
  },

  // 🔧 NEW: Centralized function to clear minimized flags (with single alert)
  clearMinimizedFlags: function (calledFrom) {
    // 🔧 FIXED: Only show alert once per restore session
    if (!this.flagsAlreadyCleared) {
      if ($DebugTestMode) {
        console.log(
          "🚨✅🚨✅🚨✅🚨✅ 1 ALERT: CONTROL_AI_MINIMIZED HAS BEEN RESET!"
        );
      }
      this.flagsAlreadyCleared = true;

      // Reset the flag after a delay to allow future restores
      setTimeout(() => {
        this.flagsAlreadyCleared = false;
      }, 2000);
    }

    if ($DebugTestMode) {
      console.log(`🔧 clearMinimizedFlags called from: ${calledFrom}`);
      console.log("🧹 Cleared all minimized flags");
    }

    sessionStorage.removeItem("ai_minimized_this_session");
    localStorage.removeItem("ai_minimized");
    localStorage.removeItem("control_ai_minimized");
  },

  // 🔧 DEPRECATED: Remove this function to prevent multiple calls
  setMinimizedState: function (minimized) {
    if ($DebugTestMode) {
      console.log(
        "⚠️ setMinimizedState is DEPRECATED - use setMinimizedFlags/clearMinimizedFlags instead"
      );
    }

    if (minimized) {
      this.setMinimizedFlags("setMinimizedState_deprecated");
    } else {
      this.clearMinimizedFlags("setMinimizedState_deprecated");
    }
  },

  notifyControlCenter: function (messageType) {
    // Set simple flags based on message type (same as transcript)
    switch (messageType) {
      case "AI_MINIMIZING":
      case "AI_MINIMIZED":
        localStorage.setItem("ai_minimized", "true");
        localStorage.setItem("control_ai_minimized", "true");
        break;
      case "AI_RESTORING":
      case "AI_RESTORED":
        localStorage.removeItem("ai_minimized");
        localStorage.removeItem("control_ai_minimized");
        localStorage.setItem("ai_heartbeat", Date.now().toString());
        break;
    }
  },

  showMinimizeNotification: function () {
    const notification = document.getElementById("minimizeNotification");
    if (notification) {
      notification.classList.add("show");
      setTimeout(() => {
        notification.classList.remove("show");
      }, 1500);
    }
  },

  // ADD this new function to aiWindowState
  debugAndResetState: function () {
    if ($DebugTestMode) {
      console.log("🔧 === AI STATE DEBUG ===");
      console.log("Internal state:", {
        isMinimized: this.isMinimized,
        restoreInProgress: this.restoreInProgress,
        isMaximized: this.isMaximized,
      });
      console.log("Storage state:", {
        ai_minimized: localStorage.getItem("ai_minimized"),
        control_ai_minimized: localStorage.getItem("control_ai_minimized"),
        session_minimized: sessionStorage.getItem("ai_minimized_this_session"),
      });
      console.log("Window state:", {
        display: document.body.style.display,
        visibility: document.body.style.visibility,
        opacity: document.body.style.opacity,
      });
      console.log("🔧 Resetting all flags...");
    }

    this.restoreInProgress = false;

    // If window is hidden but should be visible, force restore
    if (
      document.body.style.display === "none" ||
      document.body.style.visibility === "hidden"
    ) {
      if ($DebugTestMode) {
        console.log("🔧 Window is hidden, forcing restore...");
      }
      this.isMinimized = true; // Set this so restore will work
      this.restoreFromMinimized();
    } else {
      // Window is visible, clear minimized state
      this.isMinimized = false;
      this.clearMinimizedFlags("debugAndResetState");
      this.notifyControlCenter("AI_RESTORED");
    }

    if ($DebugTestMode) {
      console.log("🔧 Reset complete");
    }
  },

  setupEventListeners: function () {
    const minimizeBtn = document.getElementById("minimizeBtn");
    const maximizeBtn = document.getElementById("maximizeBtn");
    const closeBtn = document.getElementById("closeBtn");

    if (minimizeBtn) {
      minimizeBtn.addEventListener("click", (e) => {
        e.stopImmediatePropagation(); // Critical addition
        e.preventDefault();
        if ($DebugTestMode) {
          console.log("🔽 AI Minimize button clicked!");
        }
        this.minimizeToControl();
      });
    }

    if (maximizeBtn) {
      // FIXED: Prevent double-click issues with debouncing
      let maximizeClickTimeout = null;
      maximizeBtn.addEventListener("click", (e) => {
        e.stopImmediatePropagation(); // Prevent event bubbling
        e.preventDefault();

        // Clear any pending click
        if (maximizeClickTimeout) {
          clearTimeout(maximizeClickTimeout);
        }

        // Debounce the click with a small delay
        maximizeClickTimeout = setTimeout(() => {
          if ($DebugTestMode) {
            console.log(
              "🔼 AI Maximize button clicked! Current state:",
              this.isMaximized
            );
          }
          this.toggleMaximize();
          maximizeClickTimeout = null;
        }, 50); // 50ms debounce
      });

      // Also prevent double-click events
      maximizeBtn.addEventListener("dblclick", (e) => {
        e.stopImmediatePropagation();
        e.preventDefault();
        if ($DebugTestMode) {
          console.log("🔼 AI Maximize double-click prevented");
        }
      });
    }

    // CHANGED: Close button now does exactly the same as minimize button
    if (closeBtn) {
      closeBtn.addEventListener("click", (e) => {
        e.stopImmediatePropagation(); // Same as minimize button
        e.preventDefault(); // Same as minimize button
        if ($DebugTestMode) {
          console.log("❌ AI Close button clicked - minimizing instead!");
        }
        this.minimizeToControl(); // EXACT SAME FUNCTION as minimize button
      });
    }

    // FIXED: Add user activity listeners to reset inactivity timer
    const activityEvents = [
      "mousedown",
      "mousemove",
      "keypress",
      "scroll",
      "touchstart",
    ];
    activityEvents.forEach((event) => {
      document.addEventListener(
        event,
        () => {
          // Only reset timer if window is not maximized
          if (!this.isMaximized) {
            this.resetInactivityTimer();
          }
        },
        { passive: true }
      );
    });

    // Handle click events separately to avoid conflicts with button clicks
    document.addEventListener(
      "click",
      (e) => {
        // Only reset timer for non-button clicks
        if (
          !e.target.classList.contains("window-control-btn") &&
          !this.isMaximized
        ) {
          this.resetInactivityTimer();
        }
      },
      { passive: true }
    );
  },

  startHeartbeat: function () {
    // Send heartbeat every 2 seconds to let control window know we're visible
    this.heartbeatInterval = setInterval(() => {
      if (!this.isMinimized && document.body.style.display !== "none") {
        localStorage.setItem("ai_heartbeat", Date.now().toString());

        // Enhanced heartbeat with debug info
        const heartbeatData = {
          timestamp: Date.now(),
          isMinimized: this.isMinimized,
          bodyDisplay: document.body.style.display,
          bodyVisibility: document.body.style.visibility,
          windowVisible: !document.hidden && document.body.offsetWidth > 0,
        };
        localStorage.setItem(
          "ai_heartbeat_debug",
          JSON.stringify(heartbeatData)
        );
      }
    }, 2000);

    // Send initial heartbeat immediately
    localStorage.setItem("ai_heartbeat", Date.now().toString());
    this.notifyControlCenter("AI_RESTORED");
  },
};

window.electronAPI.onWindowMaximizedChanged((isMaximized) => {
  handleWindowMaximizedChange(isMaximized);
});

function handleWindowMaximizedChange(isMaximized) {
  if ($DebugTestMode) {
    console.log("Window state changed:", isMaximized);
    console.log("Previous window state:", aiWindowState.isMaximized);
    console.log("Window is now maximized:", isMaximized ? "true" : "false");
    console.log("New window state:", isMaximized);
    console.log("Calling updateMaximizeButton...");
    console.log("Window state change handling completed");
  }

  aiWindowState.isMaximized = isMaximized;
  document.body.classList.toggle("maximized", isMaximized);
  localStorage.setItem("ai_window_maximized", isMaximized.toString());

  aiWindowState.updateMaximizeButton();
}

// Export for use in main module
if (typeof module !== "undefined" && module.exports) {
  module.exports = aiWindowState;
}
