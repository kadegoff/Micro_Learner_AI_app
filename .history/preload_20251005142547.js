// preload.js - Enhanced version with LanguageTool integration

const { contextBridge, ipcRenderer } = require("electron");

// ========== ADD THESE MEDIA API FUNCTIONS ==========

// Check if media APIs are available
const checkMediaAPIs = () => {
  const capabilities = {
    navigator: typeof navigator !== "undefined",
    mediaDevices: typeof navigator?.mediaDevices !== "undefined",
    getUserMedia: typeof navigator?.mediaDevices?.getUserMedia === "function",
    getDisplayMedia:
      typeof navigator?.mediaDevices?.getDisplayMedia === "function",
    webkitGetUserMedia: typeof navigator?.webkitGetUserMedia === "function",
    mozGetUserMedia: typeof navigator?.mozGetUserMedia === "function",
  };

  console.log("🎤 Media API Availability Check:", capabilities);
  return capabilities;
};

// Polyfill for older Electron versions
const setupMediaPolyfills = () => {
  console.log("🔧 Setting up media API polyfills...");

  // Ensure navigator.mediaDevices exists
  if (typeof navigator !== "undefined" && !navigator.mediaDevices) {
    navigator.mediaDevices = {};
    console.log("🔧 Created navigator.mediaDevices object");
  }

  // Polyfill getUserMedia
  if (navigator.mediaDevices && !navigator.mediaDevices.getUserMedia) {
    console.log("🔧 Adding getUserMedia polyfill");
    navigator.mediaDevices.getUserMedia = function (constraints) {
      console.log(
        "🎤 Using polyfilled getUserMedia with constraints:",
        constraints
      );

      const getUserMedia =
        navigator.getUserMedia ||
        navigator.webkitGetUserMedia ||
        navigator.mozGetUserMedia ||
        navigator.msGetUserMedia;

      if (!getUserMedia) {
        return Promise.reject(
          new Error("getUserMedia is not implemented in this browser")
        );
      }

      return new Promise((resolve, reject) => {
        getUserMedia.call(navigator, constraints, resolve, reject);
      });
    };
  }

  // Polyfill getDisplayMedia if not available
  if (navigator.mediaDevices && !navigator.mediaDevices.getDisplayMedia) {
    console.log("🔧 Adding getDisplayMedia polyfill");
    navigator.mediaDevices.getDisplayMedia = function (constraints) {
      console.log(
        "🖥️ Using polyfilled getDisplayMedia with constraints:",
        constraints
      );

      // For Electron, we can use getUserMedia with chromeMediaSource
      if (constraints && constraints.video !== false) {
        const modifiedConstraints = {
          audio: constraints.audio || false,
          video: {
            mandatory: {
              chromeMediaSource: "desktop",
              maxWidth: 1920,
              maxHeight: 1080,
              maxFrameRate: 30,
            },
          },
        };

        return navigator.mediaDevices.getUserMedia(modifiedConstraints);
      } else if (constraints && constraints.audio) {
        const audioConstraints = {
          audio: {
            mandatory: {
              chromeMediaSource: "desktop",
            },
          },
          video: false,
        };

        return navigator.mediaDevices.getUserMedia(audioConstraints);
      }

      return Promise.reject(
        new Error("getDisplayMedia not supported - no valid constraints")
      );
    };
  }

  console.log("✅ Media API polyfills setup complete");
};

// Enhanced getUserMedia with better error handling
const enhancedGetUserMedia = async (constraints) => {
  console.log("🎤 Enhanced getUserMedia called with:", constraints);

  try {
    if (navigator.mediaDevices?.getUserMedia) {
      console.log("🎤 Using native getUserMedia");
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log("✅ Native getUserMedia successful:", stream);
      return stream;
    }

    throw new Error("No getUserMedia method available after polyfills");
  } catch (error) {
    console.error("❌ Enhanced getUserMedia failed:", error);
    throw error;
  }
};

// Enhanced getDisplayMedia with better error handling
const enhancedGetDisplayMedia = async (constraints) => {
  console.log("🖥️ Enhanced getDisplayMedia called with:", constraints);

  try {
    if (navigator.mediaDevices?.getDisplayMedia) {
      console.log("🖥️ Using native getDisplayMedia");
      const stream = await navigator.mediaDevices.getDisplayMedia(constraints);
      console.log("✅ Native getDisplayMedia successful:", stream);
      return stream;
    }

    throw new Error("No getDisplayMedia method available after polyfills");
  } catch (error) {
    console.error("❌ Enhanced getDisplayMedia failed:", error);
    throw error;
  }
};

// ========== END OF MEDIA API FUNCTIONS ==========

// Expose APIs to renderer process
contextBridge.exposeInMainWorld("electronAPI", {
  saveFile: async (fileName, content, conversationId) => {
    console.log("saveFile function called", {
      fileName,
      contentLength: content?.length || 0,
      contentType: typeof content,
      conversationId,
    });

    try {
      console.log('Invoking IPC renderer with "save-file" command');

      const result = await ipcRenderer.invoke(
        "save-file",
        fileName,
        content,
        conversationId
      );

      console.log("IPC renderer invocation successful", { result });
      return result;
    } catch (error) {
      console.error("Error in saveFile function:", {
        error: error.message,
        fileName,
        conversationId,
      });
      throw error; // Re-throw to maintain original error handling
    }
  },
  getFile: async (fileName, conversationId) => {
    return await ipcRenderer.invoke("get-file", fileName, conversationId);
  },

  getFilePreview: async (fileName, conversationId) => {
    return await ipcRenderer.invoke(
      "get-file-preview",
      fileName,
      conversationId
    );
  },
  getTranscriptWords: async () => {
    console.log("🎵 RENDERER: Requesting transcript words via IPC...");

    try {
      const result = await ipcRenderer.invoke("get-transcript-words");

      console.log(
        "🎵 RENDERER: Successfully received transcript words response"
      );
      console.log("🎵 RENDERER: Success:", result.success);
      console.log("🎵 RENDERER: Word count:", result.wordCount);

      if (result.words && result.words.length > 0) {
        console.log("🎵 RENDERER: Sample words:", result.words.slice(0, 5));
      } else {
        console.log("🎵 RENDERER: No words found or empty array");
      }

      return result;
    } catch (error) {
      console.error(
        "🎵 RENDERER: ❌ Error invoking get-transcript-words:",
        error
      );
      console.error("🎵 RENDERER: Error details:", error.message);

      // Return a fallback response similar to the IPC handler's error format
      return {
        success: false,
        error: error.message,
        words: [],
        wordCount: 0,
      };
    }
  },

  sendWordsToAIWindow: async (words) => {
    console.log("Starting sendWordsToAIWindow function");
    console.log("Words to be sent:", words);
    try {
      const result = await ipcRenderer.invoke("send-words-to-ai", words);
      console.log("Successfully sent words to AI:", result);
      return result;
    } catch (error) {
      console.error("Error sending words to AI:", error);
      throw error;
    }
  },
  // ========== EXISTING APIS (keep all) ==========
  captureSystemAudio: async (constraints = {}) => {
    console.log(
      "🎵 ENHANCED: System audio capture requested with NATIVE support"
    );

    // Method 1: Try NATIVE desktop capturer first
    try {
      console.log("🎵 METHOD 1: NATIVE desktop capturer");

      const nativeResult = await ipcRenderer.invoke(
        "captureSystemAudioNative",
        constraints
      );

      if (nativeResult && nativeResult.success) {
        console.log("🎵 ✅ NATIVE method successful:", nativeResult.method);

        // ✅ CRITICAL FIX: Return the source info, not a stream
        // The renderer will use this info to create the stream with getUserMedia
        return {
          success: true,
          source: nativeResult.source,
          method: nativeResult.method,
          // ✅ DON'T return a stream object here - let the renderer handle it
        };
      } else {
        console.log("🎵 ❌ NATIVE method failed:", nativeResult?.error);
      }
    } catch (error) {
      console.log("🎵 NATIVE method exception:", error.message);
    }

    // Method 2: Try traditional desktop capturer
    try {
      console.log("🎵 METHOD 2: Traditional desktop capturer");

      const result = await ipcRenderer.invoke("capture-system-audio");

      if (result && result.success) {
        console.log("🎵 Traditional desktop capturer result:", result);

        // ✅ RETURN: Source information for renderer to use
        return {
          success: true,
          sources: result.sources,
          method: "traditional-desktop-capturer",
        };
      }
    } catch (error) {
      console.log("🎵 Traditional desktop capturer failed:", error.message);
    }

    // Method 3: ULTRA-SAFE getDisplayMedia fallback
    try {
      console.log("🎵 METHOD 3: ULTRA-SAFE getDisplayMedia fallback");

      const ultraSafeConstraints = {
        video: {
          width: { ideal: 1 },
          height: { ideal: 1 },
          frameRate: { ideal: 1 },
        },
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 16000,
          channelCount: 1,
        },
      };

      const stream = await navigator.mediaDevices.getDisplayMedia(
        ultraSafeConstraints
      );

      if (stream && stream.getAudioTracks().length > 0) {
        console.log("✅ ULTRA-SAFE getDisplayMedia successful");

        // ✅ IMPORTANT: Stop video tracks immediately
        stream.getVideoTracks().forEach((track) => track.stop());

        // ✅ RETURN: The actual stream for this method since it's direct
        return {
          success: true,
          stream: stream,
          method: "ultra-safe-display-fallback",
        };
      } else {
        console.log("⚠️ Display media has no audio");
        if (stream) {
          stream.getTracks().forEach((track) => track.stop());
        }
      }
    } catch (error) {
      console.log("🎵 ULTRA-SAFE getDisplayMedia failed:", error.message);
    }

    // All methods failed
    console.log("🎵 ❌ ALL METHODS FAILED");
    return {
      success: false,
      error: "No audio capture methods available",
      stream: null,
    };
  },

  // ALSO UPDATE the captureSystemAudioViaDisplay method:
  captureSystemAudioViaDisplay: async (constraints = {}) => {
    console.log("🎵 CRASH-SAFE: Using getDisplayMedia for system audio");

    try {
      const safeDisplayConstraints = {
        video: {
          width: { ideal: 1 },
          height: { ideal: 1 },
        },
        audio: true,
      };
      const stream = await navigator.mediaDevices.getDisplayMedia(
        safeDisplayConstraints
      );

      if (stream && stream.getAudioTracks().length > 0) {
        console.log("🎵 ✅ CRASH-SAFE Display media system audio successful");
        return stream;
      } else {
        console.log("🎵 ⚠️ No audio tracks in display stream");
        return null;
      }
    } catch (error) {
      console.error(
        "🎵 ❌ CRASH-SAFE Display media system audio failed:",
        error.message
      );
      return null; // Return null instead of throwing
    }
  },

  // Enhanced getDisplayMedia with system audio priority
  getDisplayMediaEnhanced: async (constraints) => {
    console.log("🎵 Enhanced getDisplayMedia called from preload");

    try {
      // Get enhanced display media info from main process
      const displayInfo = await ipcRenderer.invoke(
        "get-display-media-enhanced",
        constraints
      );

      if (!displayInfo.success) {
        throw new Error(
          displayInfo.error || "Failed to get display media info"
        );
      }

      console.log("🎵 Display media info:", displayInfo);

      // Use the provided constraints to capture with system audio
      const stream = await navigator.mediaDevices.getUserMedia(
        displayInfo.constraints
      );

      if (stream && stream.getAudioTracks().length > 0) {
        console.log("🎵 ✅ Enhanced getDisplayMedia successful");
        return stream;
      }

      throw new Error("No audio tracks in display stream");
    } catch (error) {
      console.error("🎵 ❌ Enhanced getDisplayMedia failed:", error);
      throw error;
    }
  },

  // Add this to the electronAPI object in preload.js
  sendAudioToVosk: (audioData) => {
    ipcRenderer.send("send-audio-to-vosk", audioData);
  },

  enumerateAudioSources: async () => {
    console.log("🎵 Enumerating audio sources from preload");

    try {
      const sources = await ipcRenderer.invoke("enumerate-audio-sources");
      console.log("🎵 Audio sources:", sources);
      return sources;
    } catch (error) {
      console.error("🎵 Error enumerating audio sources:", error);
      return [];
    }
  },

  // Test if stream has actual audio signal
  testStreamForAudio: async (stream, duration = 1000) => {
    return new Promise((resolve) => {
      try {
        const audioContext = new (window.AudioContext ||
          window.webkitAudioContext)();
        const analyser = audioContext.createAnalyser();
        const source = audioContext.createMediaStreamSource(stream);

        analyser.fftSize = 256;
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        source.connect(analyser);

        let maxLevel = 0;
        let sampleCount = 0;

        const checkLevels = () => {
          analyser.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
          maxLevel = Math.max(maxLevel, average);
          sampleCount++;

          if (sampleCount < duration / 100) {
            setTimeout(checkLevels, 100);
          } else {
            // Clean up
            source.disconnect();
            audioContext.close();

            const hasAudio = maxLevel > 3; // Lower threshold for system audio
            console.log(
              `🎵 Audio test result: maxLevel=${maxLevel}, hasAudio=${hasAudio}`
            );

            resolve(hasAudio);
          }
        };

        checkLevels();
      } catch (error) {
        console.error("🎵 Audio test error:", error);
        resolve(false);
      }
    });
  },

  // 🔧 NEW: Add crash recovery handler
  onRendererCrash: (callback) => {
    ipcRenderer.on("renderer-crash", callback);
  },

  // 🔧 NEW: Add process monitoring
  getProcessInfo: () => ipcRenderer.invoke("get-process-info"),

  // Test system audio capabilities
  testSystemAudioCapabilities: async () => {
    console.log("🧪 Testing system audio capabilities");

    try {
      const systemAudioInfo = await ipcRenderer.invoke("capture-system-audio");
      return {
        success: true,
        hasSystemAudio: systemAudioInfo.success,
        sourceName: systemAudioInfo.sourceName,
        sourceId: systemAudioInfo.sourceId,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  },

  // Existing Vosk and transcription APIs
  testIPC: () => ipcRenderer.invoke("test-ipc"),
  initVosk: () => ipcRenderer.invoke("init-vosk"),
  startVoskSession: () => ipcRenderer.invoke("start-vosk-session"),
  transcribeWithVosk: (audioData) =>
    ipcRenderer.invoke("transcribe-with-vosk", audioData),
  cleanupVosk: () => ipcRenderer.invoke("cleanup-vosk"),

  // NLP and text correction
  nlpReady: () => ipcRenderer.invoke("nlp-ready"),
  correctText: (text) => ipcRenderer.invoke("correct-text", text),

  // Enhanced window controls
  minimizeWindow: () => ipcRenderer.invoke("minimize-window"),
  maximizeWindow: () => ipcRenderer.invoke("maximize-window"),
  restoreWindow: () => ipcRenderer.invoke("restore-window"),
  closeWindow: () => ipcRenderer.invoke("close-window"),
  toggleAlwaysOnTop: () => ipcRenderer.invoke("toggle-always-on-top"),

  // Legacy window controls (for compatibility)
  minimizeAll: () => ipcRenderer.send("minimize-all"),
  closeAll: () => ipcRenderer.send("close-all"),
  openSignIn: () => ipcRenderer.send("open-sign-in"),
  // === NEW: Enhanced settings window control ===
  // Communication between windows
  broadcastTranscript: (data) => ipcRenderer.send("broadcast-transcript", data),
  broadcastAIResponse: (data) =>
    ipcRenderer.send("broadcast-ai-response", data),
  sendChatMessage: (data) => ipcRenderer.send("send-chat-message", data),
  sendTranscriptQuestion: (question) =>
    ipcRenderer.send("transcript-question", question),

  // Authentication APIs
  getAuthState: () => ipcRenderer.invoke("get-auth-state"),
  logout: () => ipcRenderer.invoke("logout"),

  // Audio monitoring
  sendAudioLevel: (level) => ipcRenderer.send("audio-level", level),

  // Event listeners
  onVoskTranscription: (callback) => {
    ipcRenderer.on("vosk-transcription", (event, data) => callback(data));
  },

  onNewTranscript: (callback) => {
    ipcRenderer.on("new-transcript", (event, data) => callback(data));
  },

  onNewAIResponse: (callback) => {
    ipcRenderer.on("new-ai-response", (event, data) => callback(data));
  },

  onAIThinking: (callback) => {
    ipcRenderer.on("ai-thinking", (event, data) => callback(data));
  },

  onProcessChatMessage: (callback) => {
    ipcRenderer.on("process-chat-message", (event, data) => callback(data));
  },

  onTakeScreenshot: (callback) => {
    ipcRenderer.on("take-screenshot", () => callback());
  },

  onTranscriptQuestion: (callback) => {
    ipcRenderer.on("transcript-question", (event, question) =>
      callback(question)
    );
  },

  onAuthSuccess: (callback) => {
    ipcRenderer.on("auth-success", (event, userData) => callback(userData));
  },

  onAuthStateUpdated: (callback) => {
    console.log("Registering auth state update listener");
    ipcRenderer.on("auth-state-updated", (event, authState) => {
      console.log("Auth state updated:", authState);
      callback(authState);
      console.log("Callback executed for auth state update");
    });
  },

  onAuthStateChanged: (callback) => {
    ipcRenderer.on("auth-state-changed", (event, authState) =>
      callback(authState)
    );
  },

  // Audio level monitoring
  onAudioLevel: (callback) => {
    ipcRenderer.on("audio-level", (event, level) => callback(level));
  },

  // 🔧 NEW: Control window visibility methods
  ensureControlWindowVisible: () =>
    ipcRenderer.invoke("ensure-control-window-visible"),
  setControlWindowAlwaysOnTop: (alwaysOnTop) =>
    ipcRenderer.invoke("set-control-window-always-on-top", alwaysOnTop),

  // 🔧 NEW: Window state monitoring
  onWindowStateChanged: (callback) => {
    ipcRenderer.on("window-state-changed", callback);
  },

  // 🔧 NEW: Focus/blur monitoring
  onWindowFocus: (callback) => {
    ipcRenderer.on("window-focus", callback);
  },

  onWindowBlur: (callback) => {
    ipcRenderer.on("window-blur", callback);
  },

  onWindowMove: (callback) => {
    ipcRenderer.on("window-move", (event, bounds) => callback(bounds));
  },

  onWindowResize: (callback) => {
    ipcRenderer.on("window-resize", (event, bounds) => callback(bounds));
  },
  onAIThinking: (callback) => {
    ipcRenderer.on("ai-thinking", (event) => callback());
  },

  // 🔧 NEW: LanguageTool APIs
  getLanguageToolStatus: () => ipcRenderer.invoke("get-languagetool-status"),
  startLanguageTool: () => ipcRenderer.invoke("start-languagetool"),
  stopLanguageTool: () => ipcRenderer.invoke("stop-languagetool"),
  testLanguageTool: () => ipcRenderer.invoke("test-languagetool"),
  correctTextWithLanguageTool: (text) =>
    ipcRenderer.invoke("correct-text-with-languagetool", text),
  correctTextWithLanguageToolSafe: (text) =>
    ipcRenderer.invoke("correct-text-with-languagetool-safe", text), // ADD THIS LINE
  installLanguageTool: () => ipcRenderer.invoke("install-languagetool"),
  // 🔧 NEW: LanguageTool event listeners
  onLanguageToolProgress: (callback) => {
    ipcRenderer.on("languagetool-progress", (event, progress) =>
      callback(progress)
    );
  },
  onLanguageToolReady: (callback) => {
    ipcRenderer.on("languagetool-ready", (event, status) => callback(status));
  },
  onLanguageToolError: (callback) => {
    ipcRenderer.on("languagetool-error", (event, error) => callback(error));
  },
  onLanguageToolInstallProgress: (callback) => {
    ipcRenderer.on("languagetool-install-progress", (event, progress) =>
      callback(progress)
    );
  },

  // Screenshot capture
  captureScreenshot: () => ipcRenderer.invoke("capture-screenshot"),
  broadcastAIThinking: () => ipcRenderer.send("broadcast-ai-thinking"),

  onLanguageToolInstalled: (callback) => {
    ipcRenderer.on("languagetool-installed", (event, status) =>
      callback(status)
    );
  },

  onWindowMaximizedChanged: (callback) => {
    console.log(
      "[onWindowMaximizedChanged] Initializing listener for window maximization events"
    );

    ipcRenderer.on("window-maximized-changed", (event, status) => {
      console.log("[WindowMaximized] Event received - Status:", status);
      console.log(
        "[WindowMaximized] Event timestamp:",
        new Date().toISOString()
      );
      console.log("[WindowMaximized] Event object:", {
        type: event.type,
        sender: event.sender ? "present" : "null",
      });

      try {
        callback(status);
        console.log("[WindowMaximized] Callback executed successfully");
      } catch (error) {
        console.error("[WindowMaximized] Error in callback:", error);
      }
    });

    console.log("[onWindowMaximizedChanged] Listener registered successfully");
  },

  // Corner snap handler
  snapToCorner: (windowName, corner) =>
    ipcRenderer.invoke("snap-to-corner", windowName, corner),

  // 🔧 NEW: Open external URL handler
  openExternalUrl: (url) => ipcRenderer.invoke("open-external-url", url),

  // ADD THESE TWO LINES:
  expandControlWindow: async () => {
    console.log("Attempting to expand control window...");
    try {
      const result = await ipcRenderer.invoke("expand-control-window");
      console.log("Control window expanded successfully", result);
      return result;
    } catch (error) {
      console.error("Failed to expand control window:", error);
      throw error;
    }
  },
  collapseControlWindow: async () => {
    console.log("Sending collapse-control-window request to main process...");
    try {
      const result = await ipcRenderer.invoke("collapse-control-window");
      console.log("Control window collapse successful:", result);
      return result;
    } catch (error) {
      console.error("Error collapsing control window:", error);
      throw error;
    }
  },

  // Remove event listeners
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  },

  // Platform detection
  getPlatform: () => process.platform,

  // System information
  getSystemInfo: () => ({
    platform: process.platform,
    arch: process.arch,
    versions: process.versions,
  }),

  // Window management helpers
  isMaximized: () => ipcRenderer.invoke("is-maximized"),
  isMinimized: () => ipcRenderer.invoke("is-minimized"),
  isFullscreen: () => ipcRenderer.invoke("is-fullscreen"),

  // Enhanced window positioning
  centerWindow: () => ipcRenderer.invoke("center-window"),
  moveToScreen: (screenIndex) =>
    ipcRenderer.invoke("move-to-screen", screenIndex),

  // Window opacity control
  setWindowOpacity: (opacity) =>
    ipcRenderer.invoke("set-window-opacity", opacity),

  // Window always on top management
  setAlwaysOnTop: (flag) => ipcRenderer.invoke("set-always-on-top", flag),

  // Window visibility
  showWindow: () => ipcRenderer.invoke("show-window"),
  hideWindow: () => ipcRenderer.invoke("hide-window"),

  // Focus management
  focusWindow: () => ipcRenderer.invoke("focus-window"),
  blurWindow: () => ipcRenderer.invoke("blur-window"),

  // Media API helpers
  checkMediaSupport: () => {
    return checkMediaAPIs();
  },

  setupMediaAPIs: () => {
    setupMediaPolyfills();
    return checkMediaAPIs();
  },

  // Enhanced media methods with error handling
  getUserMedia: enhancedGetUserMedia,
  getDisplayMedia: enhancedGetDisplayMedia,

  // Direct media API access (alternative methods)
  requestMicrophone: async (constraints = { audio: true }) => {
    console.log("🎤 requestMicrophone called");
    return enhancedGetUserMedia(constraints);
  },

  requestScreenCapture: async (constraints = { audio: true, video: false }) => {
    console.log("🖥️ requestScreenCapture called");
    return enhancedGetDisplayMedia(constraints);
  },

  // Media device enumeration
  enumerateDevices: async () => {
    console.log("🔍 Enumerating media devices...");
    try {
      if (navigator.mediaDevices?.enumerateDevices) {
        const devices = await navigator.mediaDevices.enumerateDevices();
        console.log("✅ Found devices:", devices.length);
        return devices;
      } else {
        throw new Error("enumerateDevices not available");
      }
    } catch (error) {
      console.error("❌ Device enumeration failed:", error);
      throw error;
    }
  },

  // ========== ADD THIS ENTIRE SECTION ==========

  // 🔥 NEW: Native screen capture source API
  getScreenCaptureSource: () => ipcRenderer.invoke("get-screen-capture-source"),

  // 🔥 NEW: Enhanced native system audio capture
  captureSystemAudioNative: async (constraints = {}) => {
    console.log("🎵 NATIVE: System audio capture requested via preload");

    try {
      // Method 1: Get screen capture source from main process
      const source = await ipcRenderer.invoke("get-screen-capture-source");

      if (!source) {
        throw new Error("No screen capture source available");
      }

      console.log("🎵 NATIVE: Screen source obtained:", source.name, source.id);

      // Method 2: Use the source with getUserMedia
      const stream = await navigator.mediaDevices.getUserMedia({
        video: false,
        audio: true,
      });

      if (stream && stream.getAudioTracks().length > 0) {
        console.log("🎵 NATIVE: ✅ Native system audio capture successful!");
        console.log("🎵 NATIVE: Audio tracks:", stream.getAudioTracks().length);

        // Log audio track details
        const audioTrack = stream.getAudioTracks()[0];
        console.log("🎵 NATIVE: Audio track label:", audioTrack.label);
        console.log(
          "🎵 NATIVE: Audio track settings:",
          audioTrack.getSettings()
        );

        return {
          success: true,
          source: {
            id: source.id,
            name: source.name,
          },
          method: "native-desktop-capturer",
          message: "Source provided for renderer-side capture",
        };
      }

      throw new Error("No audio tracks in native stream");
    } catch (error) {
      console.error("🎵 NATIVE: ❌ Native system audio capture failed:", error);
      return {
        success: false,
        error: error.message,
        stream: null,
      };
    }
  },

  // 🔥 NEW: Test native audio capture capability
  testNativeAudioCapture: async () => {
    console.log("🧪 NATIVE: Testing native audio capture capability");

    try {
      const source = await ipcRenderer.invoke("get-screen-capture-source");

      if (!source) {
        return {
          success: false,
          error: "No screen capture source available",
          hasNativeSupport: false,
        };
      }

      console.log(
        "🧪 NATIVE: Test successful - source available:",
        source.name
      );

      return {
        success: true,
        hasNativeSupport: true,
        sourceName: source.name,
        sourceId: source.id,
      };
    } catch (error) {
      console.error("🧪 NATIVE: Test failed:", error);
      return {
        success: false,
        error: error.message,
        hasNativeSupport: false,
      };
    }
  },

  // 🔥 NEW: Get all available screen sources
  getScreenSources: () => ipcRenderer.invoke("get-screen-sources"),

  // 🔥 NEW: Enhanced desktop capturer info
  getDesktopCapturerInfo: () => ipcRenderer.invoke("get-desktop-capturer-info"),

  // ========== END OF NEW SECTION ==========

  // Add these for auth window:
  openExternal: (url) => {
    const { shell } = require("electron");
    return shell.openExternal(url);
  },

  sendAuthSuccess: (userData) => {
    ipcRenderer.send("auth-success", userData);
  },

  // Alternative methods for auth window
  openWebsite: () => {
    const { shell } = require("electron");
    return shell.openExternal(
      "http://localhost/Memoria/public/html/Micro_Learner.html"
    );
  },

  createNewAccount: () => {
    const { shell } = require("electron");
    return shell.openExternal(
      "http://localhost/Memoria/public/html/Micro_Learner.html"
    );
  },
});

// Enhanced window management utilities
const windowUtils = {
  // Detect if running in Electron
  isElectron: () => {
    return (
      typeof window !== "undefined" &&
      window.process &&
      window.process.type === "renderer"
    );
  },

  // Get window bounds
  getBounds: () => {
    return {
      x: window.screenX,
      y: window.screenY,
      width: window.innerWidth,
      height: window.innerHeight,
    };
  },

  // Detect platform
  getPlatform: () => {
    const userAgent = navigator.userAgent.toLowerCase();
    if (userAgent.includes("mac")) return "mac";
    if (userAgent.includes("win")) return "windows";
    if (userAgent.includes("linux")) return "linux";
    return "unknown";
  },

  // Check if window is maximized (approximation for web)
  isMaximized: () => {
    return (
      window.innerWidth === screen.width && window.innerHeight === screen.height
    );
  },

  // Enhanced drag detection
  setupDragHandlers: (dragElement, onDragStart, onDragEnd) => {
    let isDragging = false;
    let startPos = { x: 0, y: 0 };

    dragElement.addEventListener("mousedown", (e) => {
      isDragging = true;
      startPos = { x: e.clientX, y: e.clientY };
      if (onDragStart) onDragStart(e);
    });

    document.addEventListener("mousemove", (e) => {
      if (isDragging) {
        const deltaX = e.clientX - startPos.x;
        const deltaY = e.clientY - startPos.y;

        // Detect drag to edges for auto-maximize
        if (e.clientY <= 5) {
          // Dragged to top edge
          if (window.electronAPI && window.electronAPI.maximizeWindow) {
            window.electronAPI.maximizeWindow();
          }
        }
      }
    });

    document.addEventListener("mouseup", (e) => {
      if (isDragging) {
        isDragging = false;
        if (onDragEnd) onDragEnd(e);
      }
    });
  },

  // Enhanced resize detection
  setupResizeHandlers: (resizeElement, onResizeStart, onResizeEnd) => {
    let isResizing = false;

    resizeElement.addEventListener("mousedown", (e) => {
      isResizing = true;
      e.preventDefault();
      if (onResizeStart) onResizeStart(e);
    });

    document.addEventListener("mousemove", (e) => {
      if (isResizing) {
        // Handle resize logic
        e.preventDefault();
      }
    });

    document.addEventListener("mouseup", (e) => {
      if (isResizing) {
        isResizing = false;
        if (onResizeEnd) onResizeEnd(e);
      }
    });
  },

  // Keyboard shortcut management
  setupKeyboardShortcuts: (shortcuts) => {
    document.addEventListener("keydown", (e) => {
      const key = e.key.toLowerCase();
      const ctrl = e.ctrlKey || e.metaKey;
      const shift = e.shiftKey;
      const alt = e.altKey;

      for (const shortcut of shortcuts) {
        if (
          shortcut.key === key &&
          shortcut.ctrl === ctrl &&
          shortcut.shift === shift &&
          shortcut.alt === alt
        ) {
          e.preventDefault();
          shortcut.callback(e);
          break;
        }
      }
    });
  },

  // Activity detection
  setupActivityDetection: (callback, timeout = 5000) => {
    let activityTimer;
    let isActive = false;

    const resetTimer = () => {
      if (activityTimer) clearTimeout(activityTimer);

      if (!isActive) {
        isActive = true;
        callback(true);
      }

      activityTimer = setTimeout(() => {
        isActive = false;
        callback(false);
      }, timeout);
    };

    // Listen for various activity events
    ["mousedown", "mousemove", "keydown", "scroll", "touchstart"].forEach(
      (event) => {
        document.addEventListener(event, resetTimer, true);
      }
    );

    // Initial call
    resetTimer();
  },

  // Enhanced fade mode management
  setupFadeMode: (fadeClass = "fade-mode", timeout = 5000) => {
    let fadeTimer;

    const enterFadeMode = () => {
      document.body.classList.add(fadeClass);

      if (fadeTimer) clearTimeout(fadeTimer);

      fadeTimer = setTimeout(() => {
        document.body.classList.remove(fadeClass);
      }, timeout);
    };

    const exitFadeMode = () => {
      document.body.classList.remove(fadeClass);
      if (fadeTimer) clearTimeout(fadeTimer);
    };

    return { enterFadeMode, exitFadeMode };
  },

  // Window state persistence
  saveWindowState: (windowId, state) => {
    try {
      const windowStates = JSON.parse(
        localStorage.getItem("windowStates") || "{}"
      );
      windowStates[windowId] = {
        ...state,
        timestamp: Date.now(),
      };
      localStorage.setItem("windowStates", JSON.stringify(windowStates));
    } catch (error) {
      console.error("Failed to save window state:", error);
    }
  },

  loadWindowState: (windowId) => {
    try {
      const windowStates = JSON.parse(
        localStorage.getItem("windowStates") || "{}"
      );
      const state = windowStates[windowId];

      if (state && Date.now() - state.timestamp < 24 * 60 * 60 * 1000) {
        return state;
      }
    } catch (error) {
      console.error("Failed to load window state:", error);
    }
    return null;
  },
};

// Expose window utilities
contextBridge.exposeInMainWorld("windowUtils", windowUtils);

// Add some debugging helpers
window.addEventListener("DOMContentLoaded", () => {
  console.log("Enhanced preload script loaded for window");
  console.log("Platform:", windowUtils.getPlatform());
  console.log("Is Electron:", windowUtils.isElectron());

  // ========== ADD THESE MEDIA API SETUP LINES ==========

  // Setup media API polyfills immediately
  console.log("🚀 Setting up media API polyfills on DOMContentLoaded...");
  setupMediaPolyfills();

  // Check media API availability
  const capabilities = checkMediaAPIs();
  if (!capabilities.getUserMedia) {
    console.warn("⚠️ getUserMedia still not available after polyfills");
    console.warn("⚠️ Check Electron configuration and permissions");
  } else {
    console.log("✅ getUserMedia is available");
  }

  if (!capabilities.getDisplayMedia) {
    console.warn(
      "⚠️ getDisplayMedia not available - screen capture may not work"
    );
  } else {
    console.log("✅ getDisplayMedia is available");
  }

  // Test basic media API access (optional - for debugging)
  if (capabilities.getUserMedia) {
    console.log("🧪 Testing media permissions...");
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        console.log("✅ Basic microphone test successful");
        stream.getTracks().forEach((track) => track.stop()); // Clean up
      })
      .catch((error) => {
        console.warn("⚠️ Basic microphone test failed:", error.message);
        console.warn(
          "⚠️ This may be normal if no microphone permission granted yet"
        );
      });
  }

  // ========== END OF MEDIA API SETUP ==========

  // Enhanced auth state handling (your existing code continues unchanged)
  if (window.electronAPI && window.electronAPI.getAuthState) {
    window.electronAPI
      .getAuthState()
      .then((authState) => {
        console.log("Current auth state:", authState);

        // Dispatch custom event with auth state
        window.dispatchEvent(
          new CustomEvent("auth-state-loaded", {
            detail: authState,
          })
        );
      })
      .catch((error) => {
        console.error("Failed to get auth state:", error);
      });
  } else {
    console.warn(
      "electronAPI.getAuthState not available - running in web context?"
    );
  }

  // Setup activity detection for all windows (your existing code continues unchanged)
  windowUtils.setupActivityDetection((isActive) => {
    document.body.classList.toggle("user-active", isActive);
  });

  // Setup fade mode for better readability (your existing code continues unchanged)
  const { enterFadeMode, exitFadeMode } = windowUtils.setupFadeMode();

  // Enter fade mode on user activity (your existing code continues unchanged)
  ["mousedown", "mousemove", "keydown", "focus"].forEach((event) => {
    document.addEventListener(event, enterFadeMode);
  });

  // Exit fade mode on blur (your existing code continues unchanged)
  window.addEventListener("blur", exitFadeMode);
});

// Enhanced error handling
window.addEventListener("error", (event) => {
  console.error("Window error:", event.error);

  // Send error to main process if needed
  if (window.electronAPI && window.electronAPI.reportError) {
    window.electronAPI.reportError({
      message: event.error.message,
      stack: event.error.stack,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
  }
});

// Enhanced unhandled promise rejection handling
window.addEventListener("unhandledrejection", (event) => {
  console.error("Unhandled promise rejection:", event.reason);

  // Send to main process if needed
  if (window.electronAPI && window.electronAPI.reportError) {
    window.electronAPI.reportError({
      type: "unhandledrejection",
      reason: event.reason,
    });
  }
});

// Make enhanced Electron APIs available globally for easier debugging
window.electron = {
  ipcRenderer: {
    invoke: (channel, data) => ipcRenderer.invoke(channel, data),
    send: (channel, data) => ipcRenderer.send(channel, data),
    on: (channel, callback) => ipcRenderer.on(channel, callback),
    removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
  },
  platform: process.platform,
  versions: process.versions,
};

// ========== ADD THESE DEBUG FUNCTIONS ==========

// Make media debugging available globally
window.debugMediaAPIs = async function () {
  console.log("🔍 === MEDIA API DEBUG ANALYSIS ===");

  // 1. Basic environment check
  console.log("Environment:");
  console.log("  - User Agent:", navigator.userAgent);
  console.log("  - Platform:", navigator.platform);
  console.log("  - Protocol:", window.location.protocol);
  console.log("  - Host:", window.location.host);
  console.log("  - isSecureContext:", window.isSecureContext);
  console.log("  - Process type:", process?.type || "unknown");

  // 2. Navigator object check
  console.log("\nNavigator object:");
  console.log("  - navigator exists:", typeof navigator !== "undefined");
  console.log("  - navigator.mediaDevices exists:", !!navigator.mediaDevices);

  if (navigator.mediaDevices) {
    console.log(
      "  - getUserMedia exists:",
      typeof navigator.mediaDevices.getUserMedia === "function"
    );
    console.log(
      "  - getDisplayMedia exists:",
      typeof navigator.mediaDevices.getDisplayMedia === "function"
    );
    console.log(
      "  - enumerateDevices exists:",
      typeof navigator.mediaDevices.enumerateDevices === "function"
    );
  }

  // 3. ElectronAPI check
  console.log("\nElectron API:");
  console.log("  - window.electronAPI exists:", !!window.electronAPI);
  if (window.electronAPI) {
    console.log(
      "  - electronAPI.getUserMedia:",
      typeof window.electronAPI.getUserMedia === "function"
    );
    console.log(
      "  - electronAPI.getDisplayMedia:",
      typeof window.electronAPI.getDisplayMedia === "function"
    );
    console.log(
      "  - electronAPI.checkMediaSupport:",
      typeof window.electronAPI.checkMediaSupport === "function"
    );
    console.log(
      "  - electronAPI.setupMediaAPIs:",
      typeof window.electronAPI.setupMediaAPIs === "function"
    );
  }

  // 4. Try to enumerate devices
  if (navigator.mediaDevices?.enumerateDevices) {
    try {
      console.log("\nTrying to enumerate devices...");
      const devices = await navigator.mediaDevices.enumerateDevices();
      console.log("  - Total devices:", devices.length);
      console.log(
        "  - Audio inputs:",
        devices.filter((d) => d.kind === "audioinput").length
      );
      console.log(
        "  - Audio outputs:",
        devices.filter((d) => d.kind === "audiooutput").length
      );
      console.log(
        "  - Video inputs:",
        devices.filter((d) => d.kind === "videoinput").length
      );
    } catch (error) {
      console.error("  - Device enumeration failed:", error.message);
    }
  }

  // 5. Try basic getUserMedia test
  if (navigator.mediaDevices?.getUserMedia) {
    try {
      console.log("\nTesting getUserMedia...");
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, sampleRate: 16000 },
      });
      console.log("  ✅ getUserMedia SUCCESS");
      console.log("  - Tracks:", stream.getTracks().length);
      stream.getTracks().forEach((track) => {
        console.log(
          `    - ${track.kind}: ${track.label}, enabled: ${track.enabled}`
        );
        track.stop(); // Clean up
      });
    } catch (error) {
      console.error("  ❌ getUserMedia FAILED:", error.message);
      console.error("  - Error name:", error.name);
      console.error("  - Error code:", error.code);
    }
  }

  console.log("\n🔍 === DEBUG ANALYSIS COMPLETE ===");

  return {
    hasNavigator: typeof navigator !== "undefined",
    hasMediaDevices: !!navigator.mediaDevices,
    hasGetUserMedia: !!navigator.mediaDevices?.getUserMedia,
    hasGetDisplayMedia: !!navigator.mediaDevices?.getDisplayMedia,
    hasElectronAPI: !!window.electronAPI,
    isSecureContext: window.isSecureContext,
    protocol: window.location.protocol,
  };
};

// Quick media test function
window.quickMediaTest = async function () {
  try {
    console.log("🧪 Running quick media test...");
    const result = await debugMediaAPIs();
    if (result.hasGetUserMedia) {
      console.log("✅ Basic media APIs are available!");
      return true;
    } else {
      console.log("❌ Media APIs are NOT available!");
      return false;
    }
  } catch (error) {
    console.error("❌ Quick media test failed:", error);
    return false;
  }
};

// Test electronAPI media methods
window.testElectronMediaAPIs = async function () {
  console.log("🧪 Testing electronAPI media methods...");

  if (!window.electronAPI) {
    console.error("❌ electronAPI not available");
    return false;
  }

  try {
    // Test checkMediaSupport
    if (window.electronAPI.checkMediaSupport) {
      const support = window.electronAPI.checkMediaSupport();
      console.log("📊 Media support check:", support);
    }

    // Test setupMediaAPIs
    if (window.electronAPI.setupMediaAPIs) {
      const setup = window.electronAPI.setupMediaAPIs();
      console.log("🔧 Setup result:", setup);
    }

    // Test getUserMedia
    if (window.electronAPI.getUserMedia) {
      console.log("🎤 Testing electronAPI.getUserMedia...");
      try {
        const stream = await window.electronAPI.getUserMedia({ audio: true });
        console.log("✅ electronAPI.getUserMedia SUCCESS");
        stream.getTracks().forEach((track) => track.stop());
      } catch (error) {
        console.error("❌ electronAPI.getUserMedia failed:", error.message);
      }
    }

    return true;
  } catch (error) {
    console.error("❌ electronAPI media test failed:", error);
    return false;
  }
};

console.log("✅ Media API debug functions added to window object");
console.log("📝 Available debug functions:");
console.log("  - debugMediaAPIs() - Full diagnostic");
console.log("  - quickMediaTest() - Quick check");
console.log("  - testElectronMediaAPIs() - Test electronAPI methods");

// ========== END OF DEBUG FUNCTIONS ==========

console.log("Enhanced preload.js loaded with window management support");

function testStreamForAudio(stream, duration = 1000) {
  return new Promise((resolve) => {
    try {
      const audioContext = new (window.AudioContext ||
        window.webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);

      analyser.fftSize = 256;
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      source.connect(analyser);

      let maxLevel = 0;
      let sampleCount = 0;

      const checkLevels = () => {
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        maxLevel = Math.max(maxLevel, average);
        sampleCount++;

        if (sampleCount < duration / 100) {
          setTimeout(checkLevels, 100);
        } else {
          // Clean up
          source.disconnect();
          audioContext.close();

          const hasAudio = maxLevel > 3; // Lower threshold for system audio
          console.log(
            `🎵 Audio test result: maxLevel=${maxLevel}, hasAudio=${hasAudio}`
          );

          resolve(hasAudio);
        }
      };

      checkLevels();
    } catch (error) {
      console.error("🎵 Audio test error:", error);
      resolve(false);
    }
  });
}

// 🔧 NEW: LanguageTool utilities
const languageToolUtils = {
  // Check if LanguageTool is available
  isAvailable: async () => {
    try {
      const status = await window.electronAPI.getLanguageToolStatus();
      return status && status.running;
    } catch (error) {
      console.error("Failed to check LanguageTool status:", error);
      return false;
    }
  },

  // Test LanguageTool with sample text
  testWithSample: async () => {
    try {
      const result = await window.electronAPI.correctTextWithLanguageTool(
        "This are a test sentence with error."
      );
      console.log("LanguageTool test result:", result);
      return result.success;
    } catch (error) {
      console.error("LanguageTool test failed:", error);
      return false;
    }
  },

  // Auto-start LanguageTool if not running
  autoStart: async () => {
    try {
      const status = await window.electronAPI.getLanguageToolStatus();

      if (!status.installed) {
        console.log(
          "LanguageTool not installed, installation should happen automatically"
        );
        return false;
      }

      if (!status.running) {
        console.log("Starting LanguageTool server...");
        const result = await window.electronAPI.startLanguageTool();
        return result.success;
      }

      return true;
    } catch (error) {
      console.error("Failed to auto-start LanguageTool:", error);
      return false;
    }
  },
};

// Expose LanguageTool utilities
contextBridge.exposeInMainWorld("languageToolUtils", languageToolUtils);

// Add LanguageTool status monitoring when DOM loads
window.addEventListener("DOMContentLoaded", async () => {
  console.log("🔧 Setting up LanguageTool monitoring...");

  // Set up LanguageTool event listeners
  if (window.electronAPI?.onLanguageToolProgress) {
    window.electronAPI.onLanguageToolProgress((progress) => {
      console.log("📊 LanguageTool progress:", progress);

      // Update any progress indicators in the UI
      const progressElements = document.querySelectorAll(
        ".languagetool-progress"
      );
      progressElements.forEach((element) => {
        if (progress.type === "download") {
          element.textContent = `Downloading LanguageTool: ${progress.progress}%`;
        } else if (progress.type === "extract") {
          element.textContent = `Extracting LanguageTool: ${progress.progress}%`;
        } else if (progress.type === "install") {
          element.textContent = `Installing LanguageTool: ${progress.progress}%`;
        }
      });
    });
  }

  if (window.electronAPI?.onLanguageToolReady) {
    window.electronAPI.onLanguageToolReady((status) => {
      console.log("✅ LanguageTool ready:", status);
      languageToolUtils.updateStatusDisplay(status.status);

      // Dispatch custom event for other parts of the app
      window.dispatchEvent(
        new CustomEvent("languagetool-ready", {
          detail: status,
        })
      );
    });
  }

  if (window.electronAPI?.onLanguageToolError) {
    window.electronAPI.onLanguageToolError((error) => {
      console.error("❌ LanguageTool error:", error);
    });
  }

  // Check initial status
  try {
    if (window.electronAPI?.getLanguageToolStatus) {
      const status = await window.electronAPI.getLanguageToolStatus();
      console.log("🔍 Initial LanguageTool status:", status);
      languageToolUtils.updateStatusDisplay(status);
    }
  } catch (error) {
    console.error("Failed to get initial LanguageTool status:", error);
  }
});

console.log("✅ Enhanced preload.js loaded with LanguageTool support");
