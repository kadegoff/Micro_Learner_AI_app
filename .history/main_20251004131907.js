// main.js - Enhanced version with improved window management

// Debug mode control - set to false to disable all console logging
const $DebugTestMode = true;

const {
  app,
  BrowserWindow,
  ipcMain,
  screen,
  globalShortcut,
  desktopCapturer,
  shell,
} = require("electron");
const path = require("path");
const fs = require("fs");
const nlp = require("compromise");

const BASE_DIR = path.join(process.cwd(), "user_files");

console.log("testing where these console logs go");

const logPath = path.join(app.getPath("userData"), "logs");
if (!fs.existsSync(logPath)) {
  fs.mkdirSync(logPath, { recursive: true });
}

const logFile = path.join(logPath, "main.log");

function logToFile(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  fs.appendFileSync(logFile, logMessage);
  console.log(message); // Also keep console log for development
}

function getSafePath(conversationId, fileName) {
  if (!/^[a-zA-Z0-9_-]+$/.test(conversationId)) {
    throw new Error("Invalid conversationId");
  }

  // Debug: Show exactly what characters are in the filename
  if (!/^[a-zA-Z0-9_.-]+$/.test(fileName)) {
    console.log("Problematic filename:", JSON.stringify(fileName));
    console.log(
      "Character codes:",
      Array.from(fileName).map((c) => c.charCodeAt(0))
    );
    throw new Error("Invalid fileName");
  }

  const parts = [BASE_DIR, conversationId, fileName];
  const fullPath = path.resolve(path.join(...parts));

  if (!fullPath.startsWith(path.resolve(BASE_DIR))) {
    throw new Error("Invalid path");
  }

  return fullPath;
}

// IPC handler for saving a file
ipcMain.handle(
  "save-file",
  async (event, fileName, content, conversationId) => {
    try {
      const safePath = getSafePath(conversationId, fileName);
      const dir = path.dirname(safePath);

      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Convert content to a string if it's an object
      let dataToWrite = content;
      if (typeof content === "object" && content !== null) {
        dataToWrite = JSON.stringify(content, null, 2); // Pretty-print with indentation
      }

      fs.writeFileSync(safePath, dataToWrite, "utf8");
      return { success: true, path: safePath };
    } catch (error) {
      console.error("Save file error:", error);
      return { success: false, error: error.message };
    }
  }
);

// IPC handler for getting a file
ipcMain.handle("get-file", async (event, fileName, conversationId) => {
  try {
    const safePath = getSafePath(conversationId, fileName);

    if (!fs.existsSync(safePath)) {
      return {
        success: true,
        content: "",
        message: "File not found",
        path: safePath,
      };
    }

    const content = fs.readFileSync(safePath, "utf8");
    return { success: true, content, path: safePath };
  } catch (error) {
    console.error("Get file error:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("get-file-preview", async (event, fileName, conversationId) => {
  try {
    const safePath = getSafePath(conversationId, fileName);

    if (!fs.existsSync(safePath)) {
      return {
        success: true,
        content: "",
        message: "File not found",
        path: safePath,
      };
    }

    const content = fs.readFileSync(safePath, "utf8").slice(0, 1000);
    return { success: true, content, path: safePath };
  } catch (error) {
    console.error("Get file preview error:", error);
    return { success: false, error: error.message };
  }
});

// 🔧 NEW: Import LanguageTool manager
const LanguageToolManager = require("./languagetool-manager");

app.commandLine.appendSwitch("ignore-certificate-errors");
app.commandLine.appendSwitch(
  "enable-features",
  "MediaStreamTrackAudioSourceNode,DesktopCaptureAudio,WebRTC"
);
app.commandLine.appendSwitch("disable-features", "AudioServiceOutOfProcess");
app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");
app.commandLine.appendSwitch("allow-running-insecure-content");
app.commandLine.appendSwitch("disable-web-security");
app.commandLine.appendSwitch("disable-background-timer-throttling");
app.commandLine.appendSwitch("disable-renderer-backgrounding");
app.commandLine.appendSwitch("enable-hardware-acceleration");
app.commandLine.appendSwitch("allow-file-access-from-files");

// ✅ FIXED: Critical switches for system audio (fixed duplicates)
app.commandLine.appendSwitch("enable-webrtc-capture-all-screens");
app.commandLine.appendSwitch(
  "enable-webrtc-capture-all-screens-for-any-origin"
);
app.commandLine.appendSwitch("enable-system-audio-capture");

app.commandLine.appendSwitch("enable-usermedia-screen-capture");
app.commandLine.appendSwitch("enable-experimental-web-platform-features");
app.commandLine.appendSwitch("enable-features", "GetDisplayMedia");

if ($DebugTestMode) {
  app.commandLine.appendSwitch("enable-logging");
  app.commandLine.appendSwitch("log-level", "0");
  app.commandLine.appendSwitch("vmodule", "media*=3");
}

// Try to load PythonShell with error handling
let PythonShell;
try {
  PythonShell = require("python-shell").PythonShell;
  if ($DebugTestMode) {
    console.log("PythonShell loaded successfully");
  }
} catch (error) {
  if ($DebugTestMode) {
    console.error("Failed to load python-shell:", error);
  }
}

// Windows
let controlWindow;
let transcriptWindow;
let aiWindow;
let authWindow;
let settingsWindow;

// NEW: Window management variables
let windowsReady = false;
let startupComplete = false;
let authStateUpdateInProgress = false;
let saveStateTimeout = null;

// Python process for Vosk
let voskProcess = null;
let voskReady = false;

// Compromise NLP instance ready flag
let nlpReady = false;

// 🔧 NEW: LanguageTool manager instance
let languageToolManager = null;
let languageToolReady = false;
let languageToolInstalled = false; // Track installation status

// Auth state
let authState = {
  isAuthenticated: false,
  user: null,
  token: null,
};

// Window state management - Updated for quarter-screen top-corner layout
let windowStates = {
  // Control bar stays small and at top - unchanged
  control: { x: 0, y: 0, width: 300, height: 50 },

  // Transcript window - top-left corner, will be calculated as 1/4 screen width
  transcript: { x: 10, y: 70, width: 300, height: 400 }, // These will be overridden for corner layout

  // AI window - top-right corner, will be calculated as 1/4 screen width
  ai: { x: 0, y: 70, width: 350, height: 500 }, // These will be overridden for corner layout
};

// 🔧 NEW: Initialize LanguageTool manager

async function downloadLanguageToolOnStartup() {
  if (!languageToolManager) {
    if ($DebugTestMode) {
      console.error("❌ LanguageTool manager not initialized");
    }
    return false;
  }

  // 🔧 FIXED: Double-check the actual installation status
  const actualStatus = languageToolManager.getStatus();
  const isActuallyInstalled = actualStatus.installed;

  if ($DebugTestMode) {
    console.log("🔍 Double-checking LanguageTool installation status:");
    console.log("  - languageToolInstalled flag:", languageToolInstalled);
    console.log("  - actualStatus.installed:", isActuallyInstalled);
    console.log("  - Full status:", actualStatus);
  }

  // Use the actual status, not just the flag
  if (isActuallyInstalled) {
    if ($DebugTestMode) {
      console.log("✅ LanguageTool already installed, skipping download");
    }
    languageToolInstalled = true; // Update flag to match reality
    return true;
  }

  try {
    if ($DebugTestMode) {
      console.log("📥 Starting LanguageTool download during app startup...");
    }

    // Send progress updates to all windows
    const progressCallback = (progress) => {
      if ($DebugTestMode) {
        console.log("📊 LanguageTool download progress:", progress);
      }

      // Broadcast progress to all windows that exist
      [controlWindow, transcriptWindow, aiWindow].forEach((win) => {
        if (win && !win.isDestroyed()) {
          win.webContents.send("languagetool-progress", progress);
        }
      });
    };

    // Download and install LanguageTool
    await languageToolManager.installLanguageTool(progressCallback);
    languageToolInstalled = true; // ✅ Update flag after successful installation

    if ($DebugTestMode) {
      console.log("✅ LanguageTool download and installation completed");
    }

    // Notify all windows that download is complete
    [controlWindow, transcriptWindow, aiWindow].forEach((win) => {
      if (win && !win.isDestroyed()) {
        win.webContents.send("languagetool-installed", {
          installed: true,
          status: languageToolManager.getStatus(),
        });
      }
    });

    return true;
  } catch (error) {
    if ($DebugTestMode) {
      console.error("❌ LanguageTool download failed:", error);
    }

    // Notify windows of download failure
    [controlWindow, transcriptWindow, aiWindow].forEach((win) => {
      if (win && !win.isDestroyed()) {
        win.webContents.send("languagetool-error", {
          error: error.message,
          installed: false,
        });
      }
    });

    return false;
  }
}

async function startLanguageToolServer() {
  if (!languageToolManager) {
    if ($DebugTestMode) {
      console.error("❌ LanguageTool manager not initialized");
    }
    return false;
  }

  if (!languageToolInstalled) {
    if ($DebugTestMode) {
      console.warn("⚠️ LanguageTool not installed, cannot start server");
    }
    return false;
  }

  if (languageToolReady) {
    if ($DebugTestMode) {
      console.log("✅ LanguageTool server already running");
    }
    return true;
  }

  try {
    if ($DebugTestMode) {
      console.log("🚀 Starting LanguageTool server...");
    }

    // Start the server
    await languageToolManager.startServer();
    languageToolReady = true;

    if ($DebugTestMode) {
      console.log("✅ LanguageTool server started successfully");
    }

    // Test connection to make sure it's working
    const connectionOk = await languageToolManager.testConnection();
    if ($DebugTestMode) {
      console.log(
        "🔗 LanguageTool connection test:",
        connectionOk ? "✅ OK" : "❌ Failed"
      );
    }

    // Notify all windows that server is ready
    [controlWindow, transcriptWindow, aiWindow].forEach((win) => {
      if (win && !win.isDestroyed()) {
        win.webContents.send("languagetool-ready", {
          ready: true,
          status: languageToolManager.getStatus(),
        });
      }
    });

    return true;
  } catch (error) {
    if ($DebugTestMode) {
      console.error("❌ LanguageTool server start failed:", error);
    }

    // Notify windows of server start failure
    [controlWindow, transcriptWindow, aiWindow].forEach((win) => {
      if (win && !win.isDestroyed()) {
        win.webContents.send("languagetool-error", {
          error: error.message,
          ready: false,
        });
      }
    });

    return false;
  }
}

// 🔧 NEW: Enhanced text correction with LanguageTool integration
async function correctTextWithLanguageTool(text) {
  if (!languageToolManager || !languageToolReady) {
    if ($DebugTestMode) {
      console.log("⚠️ LanguageTool not ready, using basic correction");
    }
    return correctText(text); // Fallback to existing NLP correction
  }

  try {
    const response = await fetch("http://localhost:8010/v2/check", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        text: text,
        language: "en-US",
        enabledOnly: "false",
        level: "picky",
      }),
    });

    if (response.ok) {
      const data = await response.json();
      let correctedText = text;

      // Apply LanguageTool corrections in reverse order to maintain positions
      if (data.matches && Array.isArray(data.matches)) {
        data.matches.reverse().forEach((match) => {
          if (
            match.replacements &&
            match.replacements.length > 0 &&
            match.replacements[0].value
          ) {
            correctedText =
              correctedText.substring(0, match.offset) +
              match.replacements[0].value +
              correctedText.substring(match.offset + match.length);
          }
        });
      }

      if ($DebugTestMode && text !== correctedText) {
        console.log(
          `🔤 LanguageTool correction: "${text}" -> "${correctedText}"`
        );
      }

      return correctedText;
    } else {
      if ($DebugTestMode) {
        console.warn(
          "⚠️ LanguageTool API error, falling back to NLP correction"
        );
      }
      return correctText(text);
    }
  } catch (error) {
    if ($DebugTestMode) {
      console.warn(
        "⚠️ LanguageTool connection failed, using NLP fallback:",
        error.message
      );
    }
    return correctText(text);
  }
}

// Initialize compromise with custom plugins and terms
async function initializeCompromise() {
  return new Promise((resolve) => {
    if ($DebugTestMode) {
      console.log("Initializing compromise NLP...");
    }

    try {
      // Add custom terms and patterns to compromise
      nlp.plugin({
        words: {
          vosk: "Noun",
          api: "Noun",
          backend: "Noun",
          frontend: "Noun",
          javascript: "Noun",
          electron: "Noun",
          github: "Noun",
          gitlab: "Noun",
          zoom: "Noun",
          teams: "Noun",
          slack: "Noun",
          transcription: "Noun",
          screenshot: "Noun",
          xampp: "Noun",
          wamp: "Noun",
          localhost: "Noun",
          ai: "Noun",
          claude: "Noun",
          openai: "Noun",
          gpt: "Noun",
          llm: "Noun",
          npm: "Noun",
          node: "Noun",
          nodejs: "Noun",
          hello: "Interjection",
          hey: "Interjection",
          ok: "Interjection",
          okay: "Interjection",
          yeah: "Interjection",
          yep: "Interjection",
          nope: "Interjection",
          hmm: "Interjection",
          uh: "Interjection",
          um: "Interjection",
        },
        patterns: {
          "#Adjective (your|you're)": "you're",
          "(its|it's) #Gerund": "it's",
          "(lets|let's) #Verb": "let's",
        },
      });

      nlpReady = true;
      if ($DebugTestMode) {
        console.log("Compromise NLP initialized in main process");
      }
      resolve(true);
    } catch (error) {
      if ($DebugTestMode) {
        console.error("Failed to initialize compromise:", error);
      }
      resolve(false);
    }
  });
}

async function initializeLanguageTool() {
  if ($DebugTestMode) {
    console.log("🔧 Initializing LanguageTool manager...");
  }

  try {
    languageToolManager = new LanguageToolManager();

    // Set memory limit based on system RAM (you can adjust this)
    const totalMemMB = Math.round(require("os").totalmem() / 1024 / 1024);
    let memoryLimit = "512m"; // Default

    if (totalMemMB > 8000) {
      memoryLimit = "1024m"; // 1GB for systems with >8GB RAM
    } else if (totalMemMB < 4000) {
      memoryLimit = "256m"; // 256MB for systems with <4GB RAM
    }

    languageToolManager.setMemoryLimit(memoryLimit);

    if ($DebugTestMode) {
      console.log(
        `💾 Set LanguageTool memory limit to ${memoryLimit} (System RAM: ${totalMemMB}MB)`
      );
    }

    // 🔧 FIXED: Check actual installation status from the manager
    const status = languageToolManager.getStatus();
    languageToolInstalled = status.installed; // ✅ Set from actual status
    languageToolReady = status.running;

    if ($DebugTestMode) {
      console.log("🔍 LanguageTool actual status:", status);
      console.log(
        "🔧 languageToolInstalled flag set to:",
        languageToolInstalled
      );
      console.log("🔧 languageToolReady flag set to:", languageToolReady);
    }

    return true;
  } catch (error) {
    if ($DebugTestMode) {
      console.error("❌ Failed to initialize LanguageTool manager:", error);
    }
    return false;
  }
}

async function correctText(text) {
  if (!nlpReady || !text || typeof text !== "string") {
    return String(text || "");
  }

  try {
    let correctedText = String(text).trim();

    if ($DebugTestMode) {
      console.log("🔤 Original text:", correctedText);
    }

    // STEP 1: Basic cleanup and speech-to-text corrections
    const commonCorrections = {
      "there going": "they're going",
      "there coming": "they're coming",
      "there house": "their house",
      "your going": "you're going",
      "your coming": "you're coming",
      "its going": "it's going",
      "to much": "too much",
      "to many": "too many",
      "to late": "too late",
      "could of": "could have",
      "would of": "would have",
      "should of": "should have",
      "I seen": "I saw",
      "we seen": "we saw",
      "he seen": "he saw",
      "she seen": "she saw",
      "they seen": "they saw",
      alot: "a lot",
      "different than": "different from",
      "try and": "try to",
      "I are": "I am",
      "he are": "he is",
      "she are": "she is",
      "they is": "they are",
      "we is": "we are",
      "you is": "you are",
      // Add more speech-to-text specific corrections
      gonna: "going to",
      wanna: "want to",
      gotta: "got to",
      shoulda: "should have",
      coulda: "could have",
      woulda: "would have",
    };

    // Apply basic corrections
    for (const [wrong, right] of Object.entries(commonCorrections)) {
      const regex = new RegExp(`\\b${wrong}\\b`, "gi");
      correctedText = correctedText.replace(regex, right);
    }

    // STEP 2: Advanced punctuation detection based on speech patterns
    correctedText = addIntelligentPunctuation(correctedText);

    // STEP 3: Smart capitalization
    correctedText = addSmartCapitalization(correctedText);

    // STEP 4: Apply LanguageTool for final grammar polish
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // Increased timeout

      const response = await fetch("http://localhost:8010/v2/check", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          text: correctedText,
          language: "en-US",
          enabledOnly: "false", // Enable all rules
          level: "picky", // More thorough checking
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();

        // Apply LanguageTool corrections in reverse order to maintain positions
        if (data.matches && Array.isArray(data.matches)) {
          data.matches.reverse().forEach((match) => {
            if (
              match.replacements &&
              match.replacements.length > 0 &&
              match.replacements[0].value
            ) {
              correctedText =
                correctedText.substring(0, match.offset) +
                match.replacements[0].value +
                correctedText.substring(match.offset + match.length);
            }
          });
        }
      }
    } catch (ltError) {
      if ($DebugTestMode && !ltError.name?.includes("Abort")) {
        console.warn("LanguageTool not available:", ltError.message);
      }
    }

    // STEP 5: Final cleanup
    correctedText = finalCleanup(correctedText);

    const finalText = String(correctedText || text || "");

    if (text !== finalText && $DebugTestMode) {
      console.log(`🔤 Text correction: "${text}" -> "${finalText}"`);
    }

    return finalText;
  } catch (error) {
    if ($DebugTestMode) {
      console.error("Text correction error:", error);
    }
    return String(text || "");
  }
}

// NEW: Intelligent punctuation based on speech patterns
function addIntelligentPunctuation(text) {
  let result = text;

  // Question words that indicate questions
  const questionStarters =
    /\b(what|when|where|who|why|how|which|whose|whom|can|could|would|should|will|do|does|did|is|are|was|were|have|has|had|may|might|must)\b/gi;

  // Split into sentences based on natural pauses (longer gaps in speech)
  const sentences = result
    .split(/\s{2,}|\band\b|\bbut\b|\bso\b|\bthen\b/)
    .filter((s) => s.trim());

  result = sentences
    .map((sentence) => {
      sentence = sentence.trim();
      if (!sentence) return sentence;

      // Remove existing punctuation first
      sentence = sentence.replace(/[.!?]+$/g, "");

      // Check if it's a question
      if (questionStarters.test(sentence)) {
        return sentence + "?";
      }

      // Check for exclamatory words
      if (
        /\b(wow|amazing|great|terrible|awful|fantastic|incredible|unbelievable|oh|ah|hey|hello|hi|goodbye|bye|thanks|thank you|please|sorry|oops|ouch)\b/i.test(
          sentence
        )
      ) {
        return sentence + "!";
      }

      // Default to period
      return sentence + ".";
    })
    .join(" ");

  // Handle common question patterns that might be missed
  result = result.replace(
    /\b(tell me|explain|describe|show me|help me|can you|could you|would you|will you)\b([^.!?]*)[.]/gi,
    "$1$2?"
  );

  return result;
}

// NEW: Smart capitalization
function addSmartCapitalization(text) {
  let result = text.toLowerCase();

  // Capitalize first letter
  result = result.charAt(0).toUpperCase() + result.slice(1);

  // Capitalize after sentence endings
  result = result.replace(/([.!?]\s+)([a-z])/g, (match, punct, letter) => {
    return punct + letter.toUpperCase();
  });

  // Capitalize "I"
  result = result.replace(/\bi\b/g, "I");

  // Capitalize proper nouns and common abbreviations
  const properNouns = [
    // Days and months
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
    "january",
    "february",
    "march",
    "april",
    "may",
    "june",
    "july",
    "august",
    "september",
    "october",
    "november",
    "december",

    // Common proper nouns
    "google",
    "microsoft",
    "apple",
    "amazon",
    "facebook",
    "twitter",
    "linkedin",
    "youtube",
    "instagram",
    "tiktok",
    "netflix",
    "zoom",
    "teams",
    "slack",
    "github",
    "gitlab",
    "stackoverflow",
    "reddit",
    "wikipedia",

    // Places
    "america",
    "canada",
    "england",
    "france",
    "germany",
    "japan",
    "china",
    "california",
    "texas",
    "florida",
    "new york",
    "chicago",
    "los angeles",

    // Programming/Tech terms
    "javascript",
    "python",
    "java",
    "html",
    "css",
    "react",
    "node",
    "electron",
    "windows",
    "mac",
    "linux",
    "ios",
    "android",
    "chrome",
    "firefox",
    "safari",
  ];

  properNouns.forEach((noun) => {
    const regex = new RegExp(`\\b${noun}\\b`, "gi");
    result = result.replace(regex, (match) => {
      return match.charAt(0).toUpperCase() + match.slice(1).toLowerCase();
    });
  });

  // Handle "New York" style multi-word proper nouns
  result = result.replace(/\bnew york\b/gi, "New York");
  result = result.replace(/\blos angeles\b/gi, "Los Angeles");
  result = result.replace(/\bsan francisco\b/gi, "San Francisco");

  return result;
}

// NEW: Final cleanup
function finalCleanup(text) {
  let result = text;

  // Fix spacing around punctuation
  result = result.replace(/\s+([.!?])/g, "$1");
  result = result.replace(/([.!?])\s*([.!?])/g, "$1");

  // Ensure space after punctuation
  result = result.replace(/([.!?])([A-Z])/g, "$1 $2");

  // Remove duplicate spaces
  result = result.replace(/\s+/g, " ");

  // Trim
  result = result.trim();

  return result;
}

function loadWindowStates() {
  try {
    const statesPath = path.join(app.getPath("userData"), "window-states.json");
    if (fs.existsSync(statesPath)) {
      const savedStates = JSON.parse(fs.readFileSync(statesPath, "utf8"));

      // Remove timestamp before merging
      delete savedStates._timestamp;

      // Validate and merge with defaults
      Object.keys(savedStates).forEach((key) => {
        if (savedStates[key] && typeof savedStates[key] === "object") {
          // Ensure required properties exist and are numbers
          const state = savedStates[key];
          if (
            typeof state.x === "number" &&
            typeof state.y === "number" &&
            typeof state.width === "number" &&
            typeof state.height === "number"
          ) {
            windowStates[key] = { ...windowStates[key], ...state };
          } else {
            if ($DebugTestMode) {
              console.log(`Invalid saved state for ${key}, will use defaults`);
            }
          }
        }
      });

      if ($DebugTestMode) {
        console.log("Window states loaded successfully:", windowStates);
      }
    } else {
      if ($DebugTestMode) {
        console.log("No saved window states found, will use defaults");
      }
    }
  } catch (error) {
    if ($DebugTestMode) {
      console.error("Failed to load window states:", error);
      console.log("Will use default window positions");
    }
  }
}

// NEW: Debounced window state saving
function debouncedSaveWindowStates() {
  if (saveStateTimeout) {
    clearTimeout(saveStateTimeout);
  }
  saveStateTimeout = setTimeout(() => {
    saveWindowStates();
  }, 1000); // Wait 1 second before saving
}

function saveWindowStates() {
  try {
    const statesPath = path.join(app.getPath("userData"), "window-states.json");

    // Update current window states with validation
    const updatedStates = {};

    if (controlWindow && !controlWindow.isDestroyed()) {
      const bounds = controlWindow.getBounds();
      updatedStates.control = {
        ...bounds,
        isMaximized: controlWindow.isMaximized(),
      };
    }

    if (transcriptWindow && !transcriptWindow.isDestroyed()) {
      const bounds = transcriptWindow.getBounds();
      updatedStates.transcript = {
        ...bounds,
        isMaximized: transcriptWindow.isMaximized(),
      };
    }

    if (aiWindow && !aiWindow.isDestroyed()) {
      const bounds = aiWindow.getBounds();
      updatedStates.ai = {
        ...bounds,
        isMaximized: aiWindow.isMaximized(),
      };
    }

    // Merge with existing states (preserve any states we couldn't update)
    const finalStates = { ...windowStates, ...updatedStates };

    // Add timestamp for debugging
    finalStates._timestamp = new Date().toISOString();

    fs.writeFileSync(statesPath, JSON.stringify(finalStates, null, 2));
    if ($DebugTestMode) {
      console.log("Window states saved successfully:", finalStates);
    }
  } catch (error) {
    if ($DebugTestMode) {
      console.error("Failed to save window states:", error);
    }
  }
}

// Detect platform
function getPlatform() {
  switch (process.platform) {
    case "darwin":
      return "mac";
    case "win32":
      return "windows";
    default:
      return "linux";
  }
}

function createWindows() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  const platform = getPlatform();

  // Load saved window states FIRST
  loadWindowStates();

  // Calculate corner dimensions for DEFAULT positioning only
  const cornerWidth = Math.floor(width / 4); // Quarter screen width
  const cornerHeight = Math.floor(height / 3); // Third of screen height for corners
  const margin = 5; // Small margin from screen edges

  // Only set default positions if no saved state exists or saved state is invalid
  function getValidWindowState(windowName, defaultState) {
    const saved = windowStates[windowName];

    // If no saved state, use default
    if (!saved || typeof saved.x !== "number" || typeof saved.y !== "number") {
      if ($DebugTestMode) {
        console.log(`No saved state for ${windowName}, using default position`);
      }
      return defaultState;
    }

    // Validate saved position is within current screen bounds
    const validX = Math.max(
      0,
      Math.min(saved.x, width - (saved.width || defaultState.width))
    );
    const validY = Math.max(
      0,
      Math.min(saved.y, height - (saved.height || defaultState.height))
    );

    // If saved position is too far off-screen, use default
    if (Math.abs(saved.x - validX) > 100 || Math.abs(saved.y - validY) > 100) {
      if ($DebugTestMode) {
        console.log(
          `Saved state for ${windowName} is off-screen, using default position`
        );
      }
      return defaultState;
    }

    if ($DebugTestMode) {
      console.log(`Using saved state for ${windowName}:`, saved);
    }
    return {
      x: validX,
      y: validY,
      width: saved.width || defaultState.width,
      height: saved.height || defaultState.height,
      isMaximized: saved.isMaximized || false,
    };
  }

  // Define DEFAULT positions (only used if no saved state)
  const defaultStates = {
    control: {
      x: Math.floor(width / 2 - 150), // Center horizontally
      y: 0, // Top of screen
      width: 300,
      height: 50,
    },
    transcript: {
      x: 0, // Top-left corner
      y: 0,
      width: cornerWidth,
      height: cornerHeight,
    },
    ai: {
      x: width - cornerWidth, // Top-right corner
      y: 0,
      width: cornerWidth,
      height: cornerHeight,
    },
  };

  // Get actual window states (saved or default)
  const controlState = getValidWindowState("control", defaultStates.control);
  const transcriptState = getValidWindowState(
    "transcript",
    defaultStates.transcript
  );
  const aiState = getValidWindowState("ai", defaultStates.ai);

  // Update windowStates with the states we'll actually use
  windowStates.control = controlState;
  console.log("Width:", controlState.width);
  console.log("Height:", controlState.height);
  windowStates.transcript = transcriptState;
  windowStates.ai = aiState;

  // Control Bar
  // Create windows with show: false to prevent flickering
  controlWindow = new BrowserWindow({
    width: controlState.width,
    height: controlState.height,
    maxHeight: 50,
    minHeight: 50,
    x: controlState.x,
    y: controlState.y,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    hasShadow: false,
    roundedCorners: true,
    vibrancy: "dark",
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      preload: path.join(__dirname, "preload.js"),
      allowRunningInsecureContent: true,
      experimentalFeatures: true,
      partition: "persist:main",
      spellcheck: false,
      backgroundThrottling: false,

      // ✅ NEW: Audio-specific settings
      enableWebRTC: true,
      enableMediaStream: true,
      enableBlinkFeatures: "MediaRecorder,MediaStreamTrack",

      // ✅ NEW: Screen capture settings
      enableDesktopCapture: true,
      enableSystemAudio: true,

      // ✅ NEW: Performance settings for audio
      zoomFactor: 1.0,
      webgl: false,
      images: true,
      textAreasAreResizable: false,

      // ✅ NEW: Security settings that don't break audio
      enableRemoteModule: false,
      plugins: false,
      java: false,
    },
    icon: path.join(__dirname, "assets/icon.png"), // Just use PNG
  });

  // 🔧 NEW: Log control window dimensions on creation
  if ($DebugTestMode) {
    console.log("🎛️ === CONTROL WINDOW CREATED ===");
    console.log(`🎛️ Width: ${controlState.width}px`);
    console.log(`🎛️ Height: ${controlState.height}px`);
    console.log(`🎛️ Position: (${controlState.x}, ${controlState.y})`);
    console.log(`🎛️ Size: ${controlState.width}x${controlState.height}`);
    console.log("🎛️ ================================");
  }

  // Transcript Window
  transcriptWindow = new BrowserWindow({
    width: transcriptState.width,
    height: transcriptState.height,
    x: transcriptState.x,
    y: transcriptState.y,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: true,
    minWidth: 200,
    minHeight: 200,
    skipTaskbar: true,
    titleBarStyle: platform === "mac" ? "hiddenInset" : "hidden",
    hasShadow: false,
    roundedCorners: true,
    vibrancy: "dark",
    show: false, // Prevent initial flash
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      preload: path.join(__dirname, "preload.js"),
      allowRunningInsecureContent: true,
      experimentalFeatures: true,
      partition: "persist:main",
      spellcheck: false,
      backgroundThrottling: false,
    },
    icon: path.join(__dirname, "assets/icon.png"), // Just use PNG
  });

  // AI Response Window
  aiWindow = new BrowserWindow({
    width: aiState.width,
    height: aiState.height,
    x: aiState.x,
    y: aiState.y,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: true,
    minWidth: 375,
    minHeight: 400,
    skipTaskbar: true,
    hasShadow: false,
    roundedCorners: true,
    vibrancy: "dark",
    titleBarStyle: platform === "mac" ? "hiddenInset" : "hidden",
    show: false, // Prevent initial flash
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      preload: path.join(__dirname, "preload.js"),
      allowRunningInsecureContent: true,
      experimentalFeatures: true,
      partition: "persist:main",
      spellcheck: false,
      backgroundThrottling: false,
    },
    icon: path.join(__dirname, "assets/icon.png"), // Just use PNG
  });

  // Load HTML files
  controlWindow.loadFile("control.html");
  transcriptWindow.loadFile("transcript.html");
  aiWindow.loadFile("ai.html");

  // Setup ready-to-show handlers to prevent flickering
  let windowsReadyCount = 0;
  const totalWindows = 3;

  function onWindowReady() {
    windowsReadyCount++;
    if (windowsReadyCount === totalWindows) {
      // All windows are ready, show them all at once
      setTimeout(() => {
        // Set always on top with hierarchy
        controlWindow.setAlwaysOnTop(true, "pop-up-menu");
        controlWindow.setVisibleOnAllWorkspaces(true);

        [transcriptWindow, aiWindow].forEach((win) => {
          win.setAlwaysOnTop(true, "floating");
          win.setVisibleOnAllWorkspaces(true);
        });

        // Setup window event listeners
        setupWindowEventListeners();

        // Setup window hierarchy to keep control panel on top
        setupWindowHierarchy();

        // Show all windows
        controlWindow.show();
        transcriptWindow.show();
        aiWindow.show();

        // Restore maximized state after showing
        if (transcriptState.isMaximized) {
          setTimeout(() => transcriptWindow.maximize(), 50);
        }
        if (aiState.isMaximized) {
          setTimeout(() => aiWindow.maximize(), 50);
        }

        windowsReady = true;
        startupComplete = true; // Mark startup as complete

        if ($DebugTestMode) {
          console.log("All windows ready and shown");
        }
      }, 100); // Small delay to ensure everything is ready
    }
  }

  // Wait for all windows to be ready
  // Enhanced ready-to-show handler for control window with logging
  controlWindow.once("ready-to-show", () => {
    if ($DebugTestMode) {
      const actualBounds = controlWindow.getBounds();
      console.log("🎛️ === CONTROL WINDOW READY-TO-SHOW ===");
      console.log(`🎛️ Actual Width: ${actualBounds.width}px`);
      console.log(`🎛️ Actual Height: ${actualBounds.height}px`);
      console.log(`🎛️ Actual Position: (${actualBounds.x}, ${actualBounds.y})`);
      console.log(
        `🎛️ Actual Size: ${actualBounds.width}x${actualBounds.height}`
      );
      console.log("🎛️ ====================================");
    }
    onWindowReady(); // Call the existing ready handler
  });

  // Add show event logging for control window
  controlWindow.once("show", () => {
    if ($DebugTestMode) {
      const showBounds = controlWindow.getBounds();
      console.log("🎛️ === CONTROL WINDOW SHOWN ===");
      console.log(`🎛️ Final Width: ${showBounds.width}px`);
      console.log(`🎛️ Final Height: ${showBounds.height}px`);
      console.log(`🎛️ Final Position: (${showBounds.x}, ${showBounds.y})`);
      console.log(`🎛️ Final Size: ${showBounds.width}x${showBounds.height}`);
      console.log("🎛️ ==============================");
    }
  });

  // Keep existing handlers for other windows
  transcriptWindow.once("ready-to-show", onWindowReady);
  aiWindow.once("ready-to-show", () => {
    // Your check when AI window is ready to show
    if ($DebugTestMode) {
      console.log("✅ AI Window ready to show");
      const bounds = aiWindow.getBounds();
      console.log(
        `✅ AI Window configured size: ${bounds.width}x${bounds.height}`
      );
    }

    onWindowReady(); // Call the existing ready handler

    // Check if window is maximized compared to screen size
    checkAndNotifyMaximizedState();
  });

  // Open dev tools AFTER showing to prevent interference
  setTimeout(() => {
    if ($DebugTestMode) {
      controlWindow.webContents.openDevTools({ mode: "detach" });
      aiWindow.webContents.openDevTools({ mode: "detach" });
      transcriptWindow.webContents.openDevTools({ mode: "detach" });
    }
  }, 2000);

  // Send auth state when windows are ACTUALLY ready
  [controlWindow, transcriptWindow, aiWindow].forEach((win) => {
    win.webContents.once("dom-ready", () => {
      if (windowsReady && !authStateUpdateInProgress) {
        if ($DebugTestMode) {
          console.log("Window DOM ready, sending auth state");
        }
        authStateUpdateInProgress = true;
        win.webContents.send("auth-state-updated", {
          isAuthenticated: authState.isAuthenticated,
          user: authState.user,
          token: authState.token,
        });
        authStateUpdateInProgress = false;
      }
    });
  });

  // Register global shortcuts
  registerGlobalShortcuts();

  // Setup IPC handlers
  setupIpcHandlers();

  if ($DebugTestMode) {
    console.log("Windows created with preserved positions:");
    console.log(
      `Control: ${controlState.width}x${controlState.height} at (${controlState.x}, ${controlState.y})`
    );
    console.log(
      `Transcript: ${transcriptState.width}x${transcriptState.height} at (${transcriptState.x}, ${transcriptState.y})`
    );
    console.log(
      `AI: ${aiState.width}x${aiState.height} at (${aiState.x}, ${aiState.y})`
    );
  }
}

function setupWindowEventListeners() {
  const { width: screenWidth, height: screenHeight } =
    screen.getPrimaryDisplay().workAreaSize;

  // Calculate corner zones
  const cornerZoneWidth = Math.floor(screenWidth / 4);
  const centerZoneStart = cornerZoneWidth;
  const centerZoneEnd = screenWidth - cornerZoneWidth;

  if ($DebugTestMode) {
    console.log(
      `Corner zones: 0-${cornerZoneWidth} and ${centerZoneEnd}-${screenWidth}`
    );
    console.log(
      `Center zone for auto-maximize: ${centerZoneStart}-${centerZoneEnd}`
    );
  }

  // Handle window movement and resize with DEBOUNCED saving
  [controlWindow, transcriptWindow, aiWindow].forEach((win, index) => {
    const windowName = ["control", "transcript", "ai"][index];

    // ONLY save state when startup is complete
    win.on("moved", () => {
      if (!win.isDestroyed() && startupComplete) {
        // ✅ SNAP FIRST, THEN GET BOUNDS AND SAVE STATE
        if (windowName === "transcript" || windowName === "ai") {
          const wasSnapped = snapIfNearCorner(win, windowName);

          if ($DebugTestMode && wasSnapped) {
            console.log(
              `✅ ${windowName} was snapped, getting final bounds...`
            );
          }
        }

        // ✅ GET BOUNDS AFTER POTENTIAL SNAPPING
        const bounds = win.getBounds();
        windowStates[windowName] = { ...windowStates[windowName], ...bounds };

        debouncedSaveWindowStates();
      }
    });

    win.on("resized", () => {
      if (!win.isDestroyed() && startupComplete) {
        const bounds = win.getBounds();
        windowStates[windowName] = { ...windowStates[windowName], ...bounds };
        debouncedSaveWindowStates(); // Use debounced version
      }
    });

    win.on("maximize", () => {
      if (startupComplete) {
        windowStates[windowName].isMaximized = true;
        debouncedSaveWindowStates();
      }
    });

    win.on("unmaximize", () => {
      if (startupComplete) {
        windowStates[windowName].isMaximized = false;
        debouncedSaveWindowStates();
      }
    });

    // Handle drag to top for Windows (only after startup)
    if (process.platform === "win32" && windowName !== "control") {
      win.on("will-move", (event, bounds) => {
        if (!startupComplete) return; // Ignore during startup

        if (bounds.y <= 0 && !win.isMaximized()) {
          const windowCenterX = bounds.x + bounds.width / 2;
          const isInCenterZone =
            windowCenterX >= centerZoneStart && windowCenterX <= centerZoneEnd;

          if (isInCenterZone) {
            if ($DebugTestMode) {
              console.log(
                `${windowName} window dragged to center-top, maximizing`
              );
            }
            win.maximize();
          }
        }
      });
    }
  });

  // Save window states when closing
  app.on("before-quit", () => {
    if ($DebugTestMode) {
      console.log("App closing, saving final window states...");
    }
    saveWindowStates();
  });
}

// Add this function to ensure control panel stays on top when other windows are focused
function ensureControlPanelOnTop() {
  if (controlWindow && !controlWindow.isDestroyed()) {
    controlWindow.setAlwaysOnTop(true, "pop-up-menu");
    controlWindow.moveTop(); // Force it to the very top
  }
}

// Add event listeners to maintain hierarchy when other windows are focused
function setupWindowHierarchy() {
  if (transcriptWindow && !transcriptWindow.isDestroyed()) {
    transcriptWindow.on("focus", () => {
      setTimeout(ensureControlPanelOnTop, 10); // Small delay to ensure it works
    });

    transcriptWindow.on("show", () => {
      setTimeout(ensureControlPanelOnTop, 10);
    });
  }

  if (aiWindow && !aiWindow.isDestroyed()) {
    aiWindow.on("focus", () => {
      setTimeout(ensureControlPanelOnTop, 10);
    });

    aiWindow.on("show", () => {
      setTimeout(ensureControlPanelOnTop, 10);
    });
  }
}

// Alternative approach: Add a method to manually snap windows to corners
function snapWindowToCorner(windowName, corner) {
  const { width: screenWidth, height: screenHeight } =
    screen.getPrimaryDisplay().workAreaSize;
  const cornerWidth = Math.floor(screenWidth / 4);
  const cornerHeight = Math.floor(screenHeight / 3);

  let window;
  switch (windowName) {
    case "transcript":
      window = transcriptWindow;
      break;
    case "ai":
      window = aiWindow;
      break;
    default:
      return;
  }

  if (!window || window.isDestroyed()) return;

  let newBounds;
  switch (corner) {
    case "top-left":
      newBounds = { x: 0, y: 0, width: cornerWidth, height: cornerHeight };
      break;
    case "top-right":
      newBounds = {
        x: screenWidth - cornerWidth,
        y: 0,
        width: cornerWidth,
        height: cornerHeight,
      };
      break;
    default:
      return;
  }

  // Unmaximize first if maximized
  if (window.isMaximized()) {
    window.unmaximize();
  }

  // Set new bounds
  window.setBounds(newBounds);
  if ($DebugTestMode) {
    console.log(`Snapped ${windowName} to ${corner}`);
  }
}

// Add IPC handlers for manual corner snapping (optional)
function setupCornerSnapHandlers() {
  ipcMain.handle("snap-to-corner", (event, windowName, corner) => {
    try {
      snapWindowToCorner(windowName, corner);
      return { success: true };
    } catch (error) {
      if ($DebugTestMode) {
        console.error("Error snapping to corner:", error);
      }
      return { success: false, error: error.message };
    }
  });

  // Add global shortcuts for quick corner snapping (optional)
  try {
    globalShortcut.register("Control+Alt+1", () => {
      snapWindowToCorner("transcript", "top-left");
    });

    globalShortcut.register("Control+Alt+2", () => {
      snapWindowToCorner("ai", "top-right");
    });

    if ($DebugTestMode) {
      console.log(
        "Corner snap shortcuts registered: Ctrl+Alt+1 (transcript left), Ctrl+Alt+2 (AI right)"
      );
    }
  } catch (error) {
    if ($DebugTestMode) {
      console.error("Error registering corner snap shortcuts:", error);
    }
  }
}

function registerGlobalShortcuts() {
  try {
    // Register global shortcut for screenshot
    globalShortcut.register("Control+Enter", () => {
      safeSendToWindow(controlWindow, "take-screenshot");
    });

    // Register global shortcut for toggle listening
    globalShortcut.register("Control+Space", () => {
      safeExecuteInWindow(controlWindow, "toggleListening()");
    });

    // Register global shortcut for showing all windows
    globalShortcut.register("Control+Shift+M", () => {
      [transcriptWindow, aiWindow].forEach((win, index) => {
        if (win && !win.isDestroyed()) {
          try {
            win.show();
            win.focus();
          } catch (error) {
            if ($DebugTestMode) {
              console.error(`Error showing window ${index}:`, error);
            }
          }
        }
      });

      // Show control window last and ensure it's on top
      if (controlWindow && !controlWindow.isDestroyed()) {
        try {
          controlWindow.show();
          controlWindow.focus();
          ensureControlPanelOnTop();
        } catch (error) {
          if ($DebugTestMode) {
            console.error("Error showing control window:", error);
          }
        }
      }
    });

    if ($DebugTestMode) {
      console.log("Global shortcuts registered successfully");
    }
  } catch (error) {
    if ($DebugTestMode) {
      console.error("Error registering global shortcuts:", error);
    }
  }
}

function safeSendToWindow(window, channel, data = null) {
  if (!window || window.isDestroyed()) {
    if ($DebugTestMode) {
      console.log(`Window is destroyed, cannot send ${channel}`);
    }
    return false;
  }

  if (!window.webContents || window.webContents.isDestroyed()) {
    if ($DebugTestMode) {
      console.log(`WebContents is destroyed, cannot send ${channel}`);
    }
    return false;
  }

  try {
    // Create a completely clean object for IPC
    let cleanData = null;

    if (data !== null && data !== undefined) {
      // Deep clean the data to ensure it's serializable
      cleanData = JSON.parse(
        JSON.stringify(data, (key, value) => {
          // Remove any non-serializable values
          if (typeof value === "function") return undefined;
          if (typeof value === "undefined") return null;
          if (typeof value === "symbol") return null;
          if (value instanceof Error) return value.message;
          return value;
        })
      );

      // Additional safety check
      JSON.stringify(cleanData); // This will throw if still not serializable
    }

    if (cleanData !== null) {
      window.webContents.send(channel, cleanData);
    } else {
      window.webContents.send(channel);
    }
    return true;
  } catch (error) {
    if ($DebugTestMode) {
      console.error(`Error sending ${channel} to window:`, error.message);
      console.error("Original data:", data);
      console.error("Data type:", typeof data);
      if (data && typeof data === "object") {
        console.error("Object keys:", Object.keys(data));
      }
    }
    return false;
  }
}

// Utility function to safely execute JavaScript in windows
function safeExecuteInWindow(window, script) {
  if (!window || window.isDestroyed()) {
    if ($DebugTestMode) {
      console.log("Window is destroyed, cannot execute script");
    }
    return false;
  }

  if (!window.webContents || window.webContents.isDestroyed()) {
    if ($DebugTestMode) {
      console.log("WebContents is destroyed, cannot execute script");
    }
    return false;
  }

  try {
    window.webContents.executeJavaScript(script);
    return true;
  } catch (error) {
    if ($DebugTestMode) {
      console.error("Error executing script in window:", error.message);
    }
    return false;
  }
}

// Updated IPC handlers with safe communication
function setupIpcHandlers() {
  // Helper function to safely register handlers
  function safeRegisterHandler(channel, handler) {
    try {
      ipcMain.handle(channel, handler);
    } catch (error) {
      if (error.message.includes("second handler")) {
        console.log(
          `${channel} handler already registered, removing and re-registering...`
        );
        ipcMain.removeHandler(channel);
        ipcMain.handle(channel, handler);
      } else {
        throw error;
      }
    }
  }

  // Helper function to safely register event listeners (for ipcMain.on)
  function safeRegisterListener(channel, handler) {
    try {
      // Remove existing listeners first
      ipcMain.removeAllListeners(channel);
      ipcMain.on(channel, handler);
    } catch (error) {
      console.error(`Error registering listener for ${channel}:`, error);
    }
  }

  // =============================================================================
  // EVENT LISTENERS (ipcMain.on)
  // =============================================================================

  // Handle AI thinking notification
  safeRegisterListener("broadcast-ai-thinking", (event) => {
    if ($DebugTestMode) {
      console.log("Broadcasting AI thinking...");
    }
    safeSendToWindow(aiWindow, "ai-thinking");
  });

  // Handle transcript broadcasting
  safeRegisterListener("broadcast-transcript", (event, data) => {
    if ($DebugTestMode) {
      console.log("Broadcasting transcript:", data);
    }
    safeSendToWindow(transcriptWindow, "new-transcript", data);
  });

  // Handle AI response broadcasting
  safeRegisterListener("broadcast-ai-response", (event, data) => {
    if ($DebugTestMode) {
      console.log("Broadcasting AI response:", data);
    }
    safeSendToWindow(aiWindow, "new-ai-response", data);
  });

  // Handle chat messages with model selection
  safeRegisterListener("send-chat-message", (event, data) => {
    if ($DebugTestMode) {
      console.log("Chat message received in main:", data);
    }
    safeSendToWindow(controlWindow, "process-chat-message", data);
  });

  // Handle minimize all with safe communication
  safeRegisterListener("minimize-all", () => {
    if ($DebugTestMode) {
      console.log("Minimizing all windows...");
    }
    [controlWindow, transcriptWindow, aiWindow].forEach((win, index) => {
      if (win && !win.isDestroyed()) {
        try {
          win.minimize();
          if ($DebugTestMode) {
            console.log(`Window ${index} minimized successfully`);
          }
        } catch (error) {
          if ($DebugTestMode) {
            console.error(`Error minimizing window ${index}:`, error);
          }
        }
      }
    });
  });

  // Enhanced close all with proper cleanup
  safeRegisterListener("close-all", () => {
    if ($DebugTestMode) {
      console.log("Close all windows requested");
    }

    // First, save window states
    try {
      saveWindowStates();
    } catch (error) {
      if ($DebugTestMode) {
        console.error("Error saving window states:", error);
      }
    }

    // Clean up Vosk if running
    if (voskProcess) {
      try {
        voskProcess.terminate();
        voskProcess = null;
        if ($DebugTestMode) {
          console.log("Vosk process terminated");
        }
      } catch (error) {
        if ($DebugTestMode) {
          console.error("Error terminating Vosk:", error);
        }
      }
    }

    // Close all windows gracefully with proper error handling
    const windows = [
      { window: controlWindow, name: "control" },
      { window: transcriptWindow, name: "transcript" },
      { window: aiWindow, name: "ai" },
      { window: authWindow, name: "auth" },
      { window: settingsWindow, name: "settings" },
    ];

    windows.forEach(({ window, name }) => {
      if (window && !window.isDestroyed()) {
        try {
          // Remove all listeners to prevent issues
          window.removeAllListeners();
          // Close the window
          window.close();
          if ($DebugTestMode) {
            console.log(`${name} window closed successfully`);
          }
        } catch (error) {
          if ($DebugTestMode) {
            console.error(`Error closing ${name} window:`, error);
          }
        }
      }
    });

    // Force quit after a short delay to ensure cleanup
    setTimeout(() => {
      try {
        app.quit();
      } catch (error) {
        if ($DebugTestMode) {
          console.error("Error quitting app:", error);
        }
        process.exit(0); // Force exit if normal quit fails
      }
    }, 500);
  });

  // Handle authentication with safe communication
  safeRegisterListener("open-sign-in", () => {
    try {
      createAuthWindow();
    } catch (error) {
      if ($DebugTestMode) {
        console.error("Error opening sign-in window:", error);
      }
    }
  });

  // Handle transcript questions with safe communication
  safeRegisterListener("transcript-question", (event, question) => {
    if ($DebugTestMode) {
      console.log("Transcript question received:", question);
    }
    safeSendToWindow(aiWindow, "transcript-question", question);
  });

  // Audio level monitoring with safe communication
  safeRegisterListener("audio-level", (event, level) => {
    safeSendToWindow(controlWindow, "audio-level", level);
  });

  // Add this BEFORE the existing safeRegisterListener("send-audio-to-vosk")
  console.log("🎵 REGISTERING send-audio-to-vosk listener");

  // Then REPLACE the existing listener with this enhanced version:
  safeRegisterListener("send-audio-to-vosk", (event, audioBuffer) => {
    try {
      // ✅ CRITICAL FIX: Handle ArrayBuffer correctly
      if (!audioBuffer || !(audioBuffer instanceof ArrayBuffer)) {
        console.error(
          "❌ MAIN: Expected ArrayBuffer, got:",
          typeof audioBuffer
        );
        return;
      }

      if (audioBuffer.byteLength === 0) {
        console.error("❌ MAIN: Empty ArrayBuffer received");
        return;
      }

      // ✅ CRITICAL: Check process health before writing
      if (
        !voskProcess ||
        !voskProcess.childProcess ||
        !voskProcess.childProcess.stdin ||
        voskProcess.childProcess.killed ||
        !voskProcess.childProcess.stdin.writable
      ) {
        console.error("❌ MAIN: Vosk process not healthy");
        return;
      }

      // ✅ Convert ArrayBuffer to Buffer for Python
      const buffer = Buffer.from(audioBuffer);

      // ✅ Validate it's the right size (should be even number for Int16)
      if (buffer.length % 2 !== 0) {
        console.error(
          "❌ MAIN: Invalid buffer length for Int16 PCM:",
          buffer.length
        );
        return;
      }

      // ✅ SUCCESS: Send to Python with length header
      const lengthBuffer = Buffer.allocUnsafe(4);
      lengthBuffer.writeUInt32LE(buffer.length, 0);

      voskProcess.childProcess.stdin.write(lengthBuffer);
      voskProcess.childProcess.stdin.write(buffer);

      // ✅ Success logging (remove the "Invalid audio data type" error)
      console.log(`✅ MAIN: Sent ${buffer.length} bytes to Vosk`);
    } catch (error) {
      console.error("❌ MAIN: Error processing audio:", error);
    }
  });

  // =============================================================================
  // HANDLE REQUESTS (ipcMain.handle)
  // =============================================================================

  // System audio capture - FIXED VERSION
  safeRegisterHandler(
    "capture-system-audio",
    async (event, constraints = {}) => {
      console.log("🎵 SAFE: System audio capture requested in main process");

      try {
        // Get available sources safely
        const sources = await desktopCapturer.getSources({
          types: ["screen"],
          fetchWindowIcons: false,
          thumbnailSize: { width: 1, height: 1 },
        });

        console.log(`🎵 Found ${sources.length} screen sources`);

        if (sources.length === 0) {
          return {
            success: false,
            error: "No screen sources available",
            sources: [],
          };
        }

        // Return source info WITHOUT trying to create streams here
        const sourceList = sources.map((source) => ({
          id: source.id,
          name: source.name,
          type: "screen",
        }));

        console.log("🎵 Returning source list to renderer");

        return {
          success: true,
          sources: sourceList,
          // Don't include preferredSource with chromeMediaSourceId - this causes crashes
        };
      } catch (error) {
        console.error("🎵 Main process system audio error:", error);
        return {
          success: false,
          error: error.message,
          sources: [],
        };
      }
    }
  );

  // Handle hover expand - SMOOTH VERSION
  safeRegisterHandler("expand-control-window", async () => {
    if (controlWindow && !controlWindow.isDestroyed()) {
      try {
        // Set constraints FIRST to prevent visual jumps
        controlWindow.setMaximumSize(500, 80);
        controlWindow.setMinimumSize(500, 80);

        const currentBounds = controlWindow.getBounds();

        // Calculate center position for smooth transition
        const currentCenterX = currentBounds.x + currentBounds.width / 2;
        const newX = Math.round(currentCenterX - 250); // 500/2 = 250

        // Animate the transition
        await animateWindowResize(
          controlWindow,
          {
            x: newX,
            y: currentBounds.y,
            width: 500,
            height: 80,
          },
          200
        ); // 200ms animation

        if ($DebugTestMode) {
          console.log("🎛️ Control window smoothly expanded to 80px (centered)");
        }

        return { success: true };
      } catch (error) {
        if ($DebugTestMode) {
          console.error("❌ Error expanding control window:", error);
        }
        return { success: false, error: error.message };
      }
    }

    console.warn("⚠️ Control window not available or already destroyed");
    console.log("🔍 Window status:", {
      exists: !!controlWindow,
      destroyed: controlWindow?.isDestroyed?.() ?? "unknown",
    });

    return { success: false, error: "Control window not available" };
  });

  // Handle hover collapse - SMOOTH VERSION
  safeRegisterHandler("collapse-control-window", async () => {
    if (controlWindow && !controlWindow.isDestroyed()) {
      try {
        // Set constraints FIRST to prevent visual jumps
        controlWindow.setMaximumSize(450, 50);
        controlWindow.setMinimumSize(450, 50);

        const currentBounds = controlWindow.getBounds();

        // Calculate center position for smooth transition
        const currentCenterX = currentBounds.x + currentBounds.width / 2;
        const newX = Math.round(currentCenterX - 225); // 450/2 = 225

        // Animate the transition
        await animateWindowResize(
          controlWindow,
          {
            x: newX,
            y: currentBounds.y,
            width: 450,
            height: 50,
          },
          200
        ); // 200ms animation

        if ($DebugTestMode) {
          console.log("🎛️ Control window smoothly collapsed to 50px");
        }

        return { success: true };
      } catch (error) {
        if ($DebugTestMode) {
          console.error("❌ Error collapsing control window:", error);
          console.error("Error details:", {
            message: error.message,
            stack: error.stack,
            name: error.name,
          });
        }
        return { success: false, error: error.message };
      }
    }

    if ($DebugTestMode) {
      console.warn("⚠️ Control window not available for collapsing");
      console.log("Control window state:", {
        exists: !!controlWindow,
        destroyed: controlWindow ? controlWindow.isDestroyed() : "n/a",
      });
    }

    return { success: false, error: "Control window not available" };
  });

  function animateWindowResize(window, targetBounds, duration = 200) {
    return new Promise((resolve) => {
      const startBounds = window.getBounds();
      const startTime = Date.now();

      function animate() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Easing function for smooth animation
        const ease =
          progress < 0.5
            ? 2 * progress * progress
            : -1 + (4 - 2 * progress) * progress;

        const newBounds = {
          x: Math.round(
            startBounds.x + (targetBounds.x - startBounds.x) * ease
          ),
          y: Math.round(
            startBounds.y + (targetBounds.y - startBounds.y) * ease
          ),
          width: Math.round(
            startBounds.width + (targetBounds.width - startBounds.width) * ease
          ),
          height: Math.round(
            startBounds.height +
              (targetBounds.height - startBounds.height) * ease
          ),
        };

        window.setBounds(newBounds);

        if (progress < 1) {
          setTimeout(animate, 16); // ~60fps
        } else {
          // Ensure final bounds are exact
          window.setBounds(targetBounds);
          resolve();
        }
      }

      animate();
    });
  }

  // Enumerate audio sources
  safeRegisterHandler("enumerate-audio-sources", async (event) => {
    console.log("🎵 Enumerating audio sources...");

    try {
      const { desktopCapturer } = require("electron");

      // Get both screen and window sources
      const sources = await desktopCapturer.getSources({
        types: ["screen", "window"],
        fetchWindowIcons: false,
        thumbnailSize: { width: 1, height: 1 },
      });

      // Convert to a format similar to media device enumeration
      const audioSources = sources.map((source, index) => ({
        deviceId: source.id,
        kind: "audioinput", // These are input sources for system audio
        label: `${source.name} (System Audio)`,
        groupId: source.id.startsWith("screen:") ? "screen" : "window",
        sourceType: source.id.startsWith("screen:") ? "screen" : "window",
        originalName: source.name,
      }));

      // Add some default system audio options for Windows
      if (process.platform === "win32") {
        audioSources.push(
          {
            deviceId: "default",
            kind: "audiooutput",
            label: "System Audio (Default)",
            groupId: "system",
            sourceType: "system",
          },
          {
            deviceId: "speakers",
            kind: "audiooutput",
            label: "Speakers (System Audio)",
            groupId: "system",
            sourceType: "system",
          }
        );
      }

      console.log(`🎵 Found ${audioSources.length} audio sources`);
      return audioSources;
    } catch (error) {
      console.error("🎵 Error enumerating audio sources:", error);
      return [];
    }
  });

  // Enhanced display media
  safeRegisterHandler(
    "get-display-media-enhanced",
    async (event, constraints) => {
      console.log("🎵 Enhanced getDisplayMedia requested");
      console.log("🎵 Constraints:", constraints);

      try {
        const { desktopCapturer } = require("electron");

        // Get screen sources specifically for audio
        const sources = await desktopCapturer.getSources({
          types: ["screen"],
          fetchWindowIcons: false,
          thumbnailSize: { width: 1, height: 1 },
        });

        if (sources.length === 0) {
          throw new Error("No screen sources available");
        }

        // Return the primary screen source for audio capture
        const primaryScreen = sources[0];

        return {
          success: true,
          sourceId: primaryScreen.id,
          sourceName: primaryScreen.name,
          constraints: {
            video: false,
            audio: {
              mandatory: {
                chromeMediaSource: "desktop",
                chromeMediaSourceId: primaryScreen.id,
                echoCancellation: false,
                googEchoCancellation: false,
                googAutoGainControl: false,
                googNoiseSuppression: false,
                googHighpassFilter: false,
                googTypingNoiseDetection: false,
              },
            },
          },
        };
      } catch (error) {
        console.error("🎵 Enhanced getDisplayMedia failed:", error);
        return {
          success: false,
          error: error.message,
        };
      }
    }
  );

  // Process info monitoring
  safeRegisterHandler("get-process-info", async () => {
    return {
      pid: process.pid,
      platform: process.platform,
      version: process.version,
      electron: process.versions.electron,
      chrome: process.versions.chrome,
    };
  });

  // Enhanced window controls with error handling
  safeRegisterHandler("minimize-window", (event) => {
    try {
      const win = BrowserWindow.fromWebContents(event.sender);
      if (win && !win.isDestroyed()) {
        win.minimize();
        return { success: true };
      }
      return { success: false, error: "Window not found or destroyed" };
    } catch (error) {
      if ($DebugTestMode) {
        console.error("Error minimizing window:", error);
      }
      return { success: false, error: error.message };
    }
  });

  safeRegisterHandler("maximize-window", (event) => {
    try {
      const win = BrowserWindow.fromWebContents(event.sender);
      if (win && !win.isDestroyed()) {
        if (win.isMaximized()) {
          win.unmaximize();
        } else {
          win.maximize();
        }
        return { success: true, isMaximized: win.isMaximized() };
      }
      return { success: false, error: "Window not found or destroyed" };
    } catch (error) {
      if ($DebugTestMode) {
        console.error("Error maximizing window:", error);
      }
      return { success: false, error: error.message };
    }
  });

  safeRegisterHandler("restore-window", (event) => {
    try {
      const win = BrowserWindow.fromWebContents(event.sender);
      if (win && !win.isDestroyed()) {
        win.unmaximize();
        return { success: true };
      }
      return { success: false, error: "Window not found or destroyed" };
    } catch (error) {
      if ($DebugTestMode) {
        console.error("Error restoring window:", error);
      }
      return { success: false, error: error.message };
    }
  });

  safeRegisterHandler("close-window", (event) => {
    try {
      const win = BrowserWindow.fromWebContents(event.sender);
      if (win && !win.isDestroyed()) {
        win.close();
        return { success: true };
      }
      return { success: false, error: "Window not found or destroyed" };
    } catch (error) {
      if ($DebugTestMode) {
        console.error("Error closing window:", error);
      }
      return { success: false, error: error.message };
    }
  });

  safeRegisterHandler("toggle-always-on-top", (event) => {
    try {
      const win = BrowserWindow.fromWebContents(event.sender);
      if (win && !win.isDestroyed()) {
        const isAlwaysOnTop = win.isAlwaysOnTop();
        win.setAlwaysOnTop(!isAlwaysOnTop);
        return { success: true, isAlwaysOnTop: !isAlwaysOnTop };
      }
      return { success: false, error: "Window not found or destroyed" };
    } catch (error) {
      if ($DebugTestMode) {
        console.error("Error toggling always on top:", error);
      }
      return { success: false, error: error.message };
    }
  });

  // Vosk transcription handler
  safeRegisterHandler("transcribe-with-vosk", async (event, audioData) => {
    if ($DebugTestMode) {
      console.log(
        "transcribe-with-vosk called with audio data length:",
        audioData.length
      );
    }

    try {
      if (!voskReady) {
        throw new Error("Vosk not initialized");
      }

      if (!voskProcess) {
        voskProcess = startVoskProcess();
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      const arrayBuffer = audioData.buffer.slice(
        audioData.byteOffset,
        audioData.byteOffset + audioData.byteLength
      );
      const buffer = Buffer.from(arrayBuffer);

      const lengthBuffer = Buffer.allocUnsafe(4);
      lengthBuffer.writeUInt32LE(buffer.length, 0);

      if ($DebugTestMode) {
        console.log(
          `Sending ${buffer.length} bytes (${audioData.length} samples) to Vosk process`
        );
      }

      if (
        voskProcess &&
        voskProcess.childProcess &&
        voskProcess.childProcess.stdin
      ) {
        voskProcess.childProcess.stdin.write(lengthBuffer);
        voskProcess.childProcess.stdin.write(buffer);
      } else {
        throw new Error("Vosk process not available");
      }

      return { text: "" };
    } catch (error) {
      if ($DebugTestMode) {
        console.error("Vosk transcription error:", error);
      }
      return { text: "", error: error.message };
    }
  });

  // Test IPC handler
  safeRegisterHandler("test-ipc", async () => {
    if ($DebugTestMode) {
      console.log("Main: test-ipc called");
    }
    return { success: true, message: "IPC working" };
  });

  // Initialize Vosk handler
  safeRegisterHandler("init-vosk", async () => {
    if ($DebugTestMode) {
      console.log("Main: init-vosk IPC handler called");
    }
    try {
      const result = await initializeVosk();
      if ($DebugTestMode) {
        console.log("Main: init-vosk returning:", result);
      }
      return result;
    } catch (error) {
      if ($DebugTestMode) {
        console.error("Main: init-vosk handler error:", error);
      }
      return {
        success: false,
        error: error.message || "Unknown error in init-vosk handler",
      };
    }
  });

  // Start Vosk session handler
  safeRegisterHandler("start-vosk-session", async () => {
    try {
      if (!voskReady) {
        await initializeVosk();
      }
      voskProcess = startVoskProcess();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Cleanup Vosk handler
  safeRegisterHandler("cleanup-vosk", async () => {
    try {
      if (voskProcess) {
        voskProcess.terminate();
        voskProcess = null;
      }
      if ($DebugTestMode) {
        console.log("Vosk cleaned up");
      }
    } catch (error) {
      if ($DebugTestMode) {
        console.error("Vosk cleanup error:", error);
      }
    }
  });

  // Capture screenshot handler
  safeRegisterHandler("capture-screenshot", async () => {
    const sources = await desktopCapturer.getSources({
      types: ["screen"],
      thumbnailSize: { width: 1920, height: 1080 },
    });

    if (sources.length > 0) {
      return sources[0].thumbnail.toDataURL();
    }
    return null;
  });

  safeRegisterHandler("get-transcript-words", async () => {
    try {
      if ($DebugTestMode) {
        console.log("🎵 MAIN: Getting transcript words...");
      }

      const transcriptWindow = BrowserWindow.getAllWindows().find(
        (win) =>
          win.getTitle().includes("Transcript") ||
          win.webContents.getURL().includes("transcript")
      );

      if (!transcriptWindow) {
        throw new Error("Transcript window not found");
      }

      // Execute JavaScript directly in the transcript window
      const words = await transcriptWindow.webContents.executeJavaScript(`
      (async () => {
        try {
          return getTranscriptWords();
        } catch (error) {
          console.error("Error in getTranscriptWords:", error);
          throw error;
        }
      })()
    `);

      if ($DebugTestMode) {
        console.log(
          "🎵 MAIN: Transcript words retrieved:",
          words.length,
          "words"
        );
        if (words.length > 0) {
          console.log("🎵 MAIN: Sample words:", words.slice(0, 5));
        }
      }

      return {
        success: true,
        words: words,
        wordCount: words.length,
      };
    } catch (error) {
      if ($DebugTestMode) {
        console.error("🎵 MAIN: ❌ Error getting transcript words:", error);
      }
      return {
        success: false,
        error: error.message,
        words: [],
        wordCount: 0,
      };
    }
  });

  safeRegisterHandler("send-words-to-ai", async (event, words) => {
    try {
      if ($DebugTestMode) {
        console.log("🎵 MAIN: Sending transcript words to AI...");
        console.log("🎵 MAIN: Words received:", words);
      }

      const aiWindow = BrowserWindow.getAllWindows().find(
        (win) =>
          win.getTitle().includes("AI") ||
          win.webContents.getURL().includes("ai") ||
          win.getTitle().includes("Chat") ||
          win.webContents.getURL().includes("chat")
      );

      if (!aiWindow) {
        throw new Error("AI window not found");
      }

      // Execute JavaScript directly in the AI window, passing the words
      const result = await aiWindow.webContents.executeJavaScript(`
      (async () => {
        try {
          // Pass the words to the function
          return await chatInputManager.receiveTranscriptWordsAndSend(${JSON.stringify(
            words
          )});
        } catch (error) {
          console.error("Error in receiveTranscriptWordsAndSend:", error);
          throw error;
        }
      })()
    `);

      if ($DebugTestMode) {
        console.log("🎵 MAIN: Transcript words sent to AI successfully");
        console.log("🎵 MAIN: AI response:", result);
      }

      return {
        success: true,
        aiResponse: result,
        message: "Transcript words successfully sent to AI",
      };
    } catch (error) {
      if ($DebugTestMode) {
        console.error(
          "🎵 MAIN: ❌ Error sending transcript words to AI:",
          error
        );
      }
      return {
        success: false,
        error: error.message,
        aiResponse: null,
        message: "Failed to send transcript words to AI",
      };
    }
  });

  // NLP ready handler
  safeRegisterHandler("nlp-ready", async () => {
    return nlpReady;
  });

  // Correct text handler
  safeRegisterHandler("correct-text", async (event, text) => {
    if (!nlpReady) return text;
    return correctText(text);
  });

  // Get auth state handler
  safeRegisterHandler("get-auth-state", async () => {
    if ($DebugTestMode) {
      console.log("get-auth-state called, returning:", {
        isAuthenticated: authState.isAuthenticated,
        user: authState.user,
        token: authState.token,
      });
    }
    return {
      isAuthenticated: authState.isAuthenticated,
      user: authState.user,
      token: authState.token,
    };
  });

  // Logout handler
  safeRegisterHandler("logout", async () => {
    authState.isAuthenticated = false;
    authState.user = null;
    console.log(
      "THIS SHOULD NEVER BE RUNNING 🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨"
    );
    authState.token = null;

    try {
      const authFilePath = path.join(app.getPath("userData"), "user-auth.json");
      if (fs.existsSync(authFilePath)) {
        fs.unlinkSync(authFilePath);
      }
    } catch (error) {
      if ($DebugTestMode) {
        console.error("Failed to remove auth file:", error);
      }
    }

    updateWindowsWithAuthState();

    if ($DebugTestMode) {
      console.log("User logged out");
    }
    return { success: true };
  });

  // Control window visibility handler
  safeRegisterHandler("ensure-control-window-visible", async () => {
    if (controlWindow && !controlWindow.isDestroyed()) {
      try {
        if (controlWindow.isMinimized()) {
          controlWindow.restore();
        }

        controlWindow.show();
        controlWindow.focus();
        controlWindow.setAlwaysOnTop(true, "pop-up-menu");
        controlWindow.moveTop();

        // Ensure it's visible on screen
        const bounds = controlWindow.getBounds();
        const { width, height } = screen.getPrimaryDisplay().workAreaSize;

        if (
          bounds.x < 0 ||
          bounds.y < 0 ||
          bounds.x > width ||
          bounds.y > height
        ) {
          controlWindow.center();
        }

        if ($DebugTestMode) {
          console.log("Control window restored and made visible");
        }

        return { success: true };
      } catch (error) {
        if ($DebugTestMode) {
          console.error("Error ensuring control window visible:", error);
        }
        return { success: false, error: error.message };
      }
    }
    return { success: false, error: "Control window not available" };
  });

  // Set control window always on top handler
  safeRegisterHandler(
    "set-control-window-always-on-top",
    async (event, alwaysOnTop) => {
      if (controlWindow && !controlWindow.isDestroyed()) {
        try {
          if (alwaysOnTop) {
            controlWindow.setAlwaysOnTop(true, "pop-up-menu");
            controlWindow.setVisibleOnAllWorkspaces(true);
          } else {
            controlWindow.setAlwaysOnTop(true, "floating"); // Still on top, but lower priority
          }
          return { success: true };
        } catch (error) {
          return { success: false, error: error.message };
        }
      }
      return { success: false, error: "Control window not available" };
    }
  );

  // Corner snap handler
  safeRegisterHandler("snap-to-corner", (event, windowName, corner) => {
    try {
      snapWindowToCorner(windowName, corner);
      return { success: true };
    } catch (error) {
      if ($DebugTestMode) {
        console.error("Error snapping to corner:", error);
      }
      return { success: false, error: error.message };
    }
  });

  // 🔧 NEW: IPC handler for opening external URLs
  safeRegisterHandler("open-external-url", async (event, url) => {
    if ($DebugTestMode) {
      console.log("🔗 Opening external URL:", url);
    }

    try {
      // Validate URL
      if (!url || typeof url !== "string") {
        throw new Error("Invalid URL provided");
      }

      // Basic URL validation
      const urlPattern = /^https?:\/\//i;
      if (!urlPattern.test(url)) {
        throw new Error("URL must start with http:// or https://");
      }

      // Open the URL in the default browser
      await shell.openExternal(url);

      if ($DebugTestMode) {
        console.log("✅ Successfully opened external URL:", url);
      }

      return { success: true, url: url };
    } catch (error) {
      if ($DebugTestMode) {
        console.error("❌ Failed to open external URL:", error);
      }
      return { success: false, error: error.message };
    }
  });

  // =============================================================================
  // APP EVENT HANDLERS
  // =============================================================================

  // Handle renderer crashes
  app.on("renderer-process-crashed", (event, webContents, killed) => {
    console.error("Renderer process crashed:", { killed });

    // Find which window crashed
    const crashedWindow = BrowserWindow.fromWebContents(webContents);
    if (crashedWindow) {
      console.log("Crashed window:", crashedWindow.id);

      // If it's the control window, restart it
      if (crashedWindow === controlWindow) {
        console.log("Control window crashed, restarting...");
        setTimeout(() => {
          createWindows();
        }, 1000);
      }
    }
  });

  // Handle unresponsive renderer
  app.on("renderer-process-unresponsive", (event, webContents) => {
    console.warn("Renderer process unresponsive");
    const unresponsiveWindow = BrowserWindow.fromWebContents(webContents);
    if (unresponsiveWindow) {
      console.log("Unresponsive window:", unresponsiveWindow.id);
    }
  });

  // Handle authentication success from login window
  safeRegisterListener("auth-success", (event, userData) => {
    if ($DebugTestMode) {
      console.log("🔐 Received auth success from login window:", userData);
    }
    handleSuccessfulAuth(userData);
  });

  safeRegisterHandler("get-languagetool-status", async () => {
    if (!languageToolManager) {
      return {
        installed: false,
        running: false,
        ready: false,
        error: "Manager not initialized",
      };
    }
    return languageToolManager.getStatus();
  });

  safeRegisterHandler("start-languagetool", async () => {
    if ($DebugTestMode) {
      console.log("🔧 IPC: Start LanguageTool server requested");
    }

    if (!languageToolManager) {
      return {
        success: false,
        error: "LanguageTool manager not initialized",
      };
    }

    // Check if already running
    if (languageToolReady) {
      if ($DebugTestMode) {
        console.log("✅ LanguageTool server already running");
      }
      return {
        success: true,
        message: "Already running",
        status: languageToolManager.getStatus(),
      };
    }

    // Check if not installed
    if (!languageToolInstalled) {
      if ($DebugTestMode) {
        console.log("❌ LanguageTool not installed, cannot start server");
      }
      return {
        success: false,
        error:
          "LanguageTool not installed. Please wait for installation to complete.",
      };
    }

    try {
      if ($DebugTestMode) {
        console.log("🚀 Starting LanguageTool server...");
      }

      // Start the server
      await languageToolManager.startServer();
      languageToolReady = true;

      if ($DebugTestMode) {
        console.log("✅ LanguageTool server started successfully");
      }

      // Test connection
      const connectionOk = await languageToolManager.testConnection();
      if ($DebugTestMode) {
        console.log(
          "🔗 LanguageTool connection test:",
          connectionOk ? "✅ OK" : "❌ Failed"
        );
      }

      // Notify all windows that server is ready
      [controlWindow, transcriptWindow, aiWindow].forEach((win) => {
        if (win && !win.isDestroyed()) {
          win.webContents.send("languagetool-ready", {
            ready: true,
            status: languageToolManager.getStatus(),
          });
        }
      });

      return {
        success: true,
        status: languageToolManager.getStatus(),
        connectionTest: connectionOk,
      };
    } catch (error) {
      if ($DebugTestMode) {
        console.error("❌ LanguageTool server start failed:", error);
      }

      // Notify windows of server start failure
      [controlWindow, transcriptWindow, aiWindow].forEach((win) => {
        if (win && !win.isDestroyed()) {
          win.webContents.send("languagetool-error", {
            error: error.message,
            ready: false,
          });
        }
      });

      return {
        success: false,
        error: error.message,
      };
    }
  });

  // Enhanced LanguageTool server stop
  safeRegisterHandler("stop-languagetool", async () => {
    if ($DebugTestMode) {
      console.log("🛑 IPC: Stop LanguageTool server requested");
    }

    if (!languageToolManager) {
      return {
        success: false,
        error: "LanguageTool manager not initialized",
      };
    }

    // Check if not running
    if (!languageToolReady) {
      if ($DebugTestMode) {
        console.log("✅ LanguageTool server already stopped");
      }
      return {
        success: true,
        message: "Already stopped",
      };
    }

    try {
      if ($DebugTestMode) {
        console.log("🛑 Stopping LanguageTool server...");
      }

      languageToolManager.stopServer();
      languageToolReady = false;

      if ($DebugTestMode) {
        console.log("✅ LanguageTool server stopped successfully");
      }

      // Notify all windows that server is stopped
      [controlWindow, transcriptWindow, aiWindow].forEach((win) => {
        if (win && !win.isDestroyed()) {
          win.webContents.send("languagetool-stopped", {
            ready: false,
            status: languageToolManager.getStatus(),
          });
        }
      });

      return {
        success: true,
      };
    } catch (error) {
      if ($DebugTestMode) {
        console.error("❌ LanguageTool server stop failed:", error);
      }

      return {
        success: false,
        error: error.message,
      };
    }
  });

  safeRegisterHandler(
    "correct-text-with-languagetool-safe",
    async (event, text) => {
      try {
        // If LanguageTool is not ready, return original text
        if (!languageToolReady || !languageToolManager) {
          if ($DebugTestMode) {
            console.log("🔧 LanguageTool not ready, returning original text");
          }
          return {
            success: true,
            text: text,
            corrected: false,
            reason: "LanguageTool server not ready",
          };
        }

        // Test connection first
        const connectionOk = await languageToolManager.testConnection();
        if (!connectionOk) {
          if ($DebugTestMode) {
            console.log(
              "🔧 LanguageTool connection failed, returning original text"
            );
          }
          return {
            success: true,
            text: text,
            corrected: false,
            reason: "LanguageTool server not responding",
          };
        }

        // Perform correction
        const correctedText = await correctTextWithLanguageTool(text);

        return {
          success: true,
          text: correctedText,
          corrected: correctedText !== text,
          originalText: text !== correctedText ? text : undefined,
        };
      } catch (error) {
        if ($DebugTestMode) {
          console.warn(
            "⚠️ LanguageTool correction failed, returning original text:",
            error
          );
        }
        return {
          success: true,
          text: text,
          corrected: false,
          error: error.message,
          reason: "Correction failed",
        };
      }
    }
  );

  // Test connection
  safeRegisterHandler("test-languagetool", async () => {
    if (!languageToolManager) {
      return { success: false, error: "Manager not initialized" };
    }

    try {
      const connectionOk = await languageToolManager.testConnection();
      return { success: connectionOk };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Correct text with LanguageTool
  safeRegisterHandler("correct-text-with-languagetool", async (event, text) => {
    try {
      const correctedText = await correctTextWithLanguageTool(text);
      return { success: true, text: correctedText };
    } catch (error) {
      return { success: false, error: error.message, text: text };
    }
  });

  // Install LanguageTool
  safeRegisterHandler("install-languagetool", async () => {
    try {
      if (!languageToolManager) {
        throw new Error("Manager not initialized");
      }

      if (languageToolInstalled) {
        return { success: true, message: "Already installed" };
      }

      const progressCallback = (progress) => {
        [controlWindow, transcriptWindow, aiWindow].forEach((win) => {
          if (win && !win.isDestroyed()) {
            win.webContents.send("languagetool-install-progress", progress);
          }
        });
      };

      await languageToolManager.installLanguageTool(progressCallback);
      languageToolInstalled = true;

      return { success: true, message: "Installation completed" };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // ========== NATIVE SYSTEM AUDIO IPC HANDLERS ==========
  // In main.js - Fix the IPC handler registration (around line 1200+)

  // 🔥 FIXED: Get screen capture source for native system audio
  safeRegisterHandler("get-screen-capture-source", async () => {
    try {
      if ($DebugTestMode) {
        console.log(
          "🎵 MAIN: Getting screen capture source for system audio..."
        );
      }

      const sources = await desktopCapturer.getSources({
        types: ["screen"],
        thumbnailSize: { width: 0, height: 0 }, // No thumbnails needed
        fetchWindowIcons: false,
      });

      if ($DebugTestMode) {
        console.log("🎵 MAIN: Found", sources.length, "screen sources");
      }

      // Find the primary screen source
      const primarySource =
        sources.find(
          (source) =>
            source.name === "Entire Screen" ||
            source.name.includes("Screen 1") ||
            source.name.includes("Screen") ||
            source.id.includes("screen:0") ||
            source.id.includes("screen:1")
        ) || sources[0]; // Fallback to first source

      if (primarySource) {
        if ($DebugTestMode) {
          console.log(
            "🎵 MAIN: ✅ Primary screen source found:",
            primarySource.name
          );
          console.log("🎵 MAIN: Source ID:", primarySource.id);
        }

        return {
          success: true,
          id: primarySource.id,
          name: primarySource.name,
          display_id: primarySource.display_id,
        };
      } else {
        if ($DebugTestMode) {
          console.log("🎵 MAIN: ❌ No suitable screen source found");
        }
        return {
          success: false,
          error: "No screen sources available",
        };
      }
    } catch (error) {
      if ($DebugTestMode) {
        console.error(
          "🎵 MAIN: ❌ Error getting screen capture source:",
          error
        );
      }
      return {
        success: false,
        error: error.message,
      };
    }
  });

  // 🔥 FIXED: Get all screen sources
  safeRegisterHandler("get-screen-sources", async () => {
    try {
      if ($DebugTestMode) {
        console.log("🎵 MAIN: Getting all screen sources...");
      }

      const sources = await desktopCapturer.getSources({
        types: ["screen", "window"],
        thumbnailSize: { width: 150, height: 150 },
      });

      if ($DebugTestMode) {
        console.log("🎵 MAIN: Found", sources.length, "total sources");
      }

      return {
        success: true,
        sources: sources.map((source) => ({
          id: source.id,
          name: source.name,
          display_id: source.display_id,
          thumbnail: source.thumbnail ? source.thumbnail.toDataURL() : null,
        })),
      };
    } catch (error) {
      if ($DebugTestMode) {
        console.error("🎵 MAIN: ❌ Error getting screen sources:", error);
      }
      return {
        success: false,
        error: error.message,
      };
    }
  });

  // 🔥 FIXED: Native system audio capture handler
  safeRegisterHandler(
    "captureSystemAudioNative",
    async (event, constraints = {}) => {
      try {
        if ($DebugTestMode) {
          console.log("🎵 MAIN: Native system audio capture requested");
          console.log("🎵 MAIN: Constraints:", constraints);
        }

        // Get screen sources
        const sources = await desktopCapturer.getSources({
          types: ["screen"],
          thumbnailSize: { width: 0, height: 0 },
        });

        if (sources.length === 0) {
          throw new Error("No screen sources available");
        }

        // Find primary screen
        const primarySource =
          sources.find(
            (source) =>
              source.name === "Entire Screen" ||
              source.name.includes("Screen 1") ||
              source.name.includes("Screen") ||
              source.id.includes("screen:0")
          ) || sources[0];

        if ($DebugTestMode) {
          console.log("🎵 MAIN: Using source:", primarySource.name);
          console.log("🎵 MAIN: Source ID:", primarySource.id);
        }

        // Return the source info - the renderer will handle the actual capture
        return {
          success: true,
          source: {
            id: primarySource.id,
            name: primarySource.name,
            display_id: primarySource.display_id,
          },
          method: "native-desktop-capturer",
          message: "Source provided for renderer-side capture",
        };
      } catch (error) {
        if ($DebugTestMode) {
          console.error("🎵 MAIN: ❌ Native capture failed:", error);
        }
        return {
          success: false,
          error: error.message,
        };
      }
    }
  );

  // 🔥 FIXED: Get desktop capturer info
  safeRegisterHandler("get-desktop-capturer-info", async () => {
    try {
      if ($DebugTestMode) {
        console.log("🎵 MAIN: Getting desktop capturer info...");
      }

      const sources = await desktopCapturer.getSources({
        types: ["screen", "window"],
        thumbnailSize: { width: 0, height: 0 },
      });

      const info = {
        success: true,
        totalSources: sources.length,
        screenSources: sources.filter((s) => s.id.startsWith("screen:")).length,
        windowSources: sources.filter((s) => s.id.startsWith("window:")).length,
        primaryScreen: sources.find(
          (s) =>
            s.name === "Entire Screen" ||
            s.name.includes("Screen 1") ||
            s.id.includes("screen:0")
        ),
        allScreens: sources
          .filter((s) => s.id.startsWith("screen:"))
          .map((s) => ({
            id: s.id,
            name: s.name,
            display_id: s.display_id,
          })),
      };

      if ($DebugTestMode) {
        console.log("🎵 MAIN: Desktop capturer info:", info);
      }
      return info;
    } catch (error) {
      if ($DebugTestMode) {
        console.error(
          "🎵 MAIN: ❌ Error getting desktop capturer info:",
          error
        );
      }
      return {
        success: false,
        error: error.message,
      };
    }
  });

  // 🔥 FIXED: Test desktop capturer availability
  safeRegisterHandler("test-desktop-capturer", async () => {
    try {
      if ($DebugTestMode) {
        console.log("🧪 MAIN: Testing desktop capturer...");
      }

      const sources = await desktopCapturer.getSources({
        types: ["screen"],
        thumbnailSize: { width: 0, height: 0 },
      });

      const result = {
        success: true,
        available: true,
        sourceCount: sources.length,
        hasPrimaryScreen: sources.some(
          (s) => s.name === "Entire Screen" || s.name.includes("Screen")
        ),
        sources: sources.map((s) => ({
          id: s.id,
          name: s.name,
        })),
      };

      if ($DebugTestMode) {
        console.log("🧪 MAIN: Desktop capturer test result:", result);
      }
      return result;
    } catch (error) {
      if ($DebugTestMode) {
        console.error("🧪 MAIN: ❌ Desktop capturer test failed:", error);
      }
      return {
        success: false,
        available: false,
        error: error.message,
      };
    }
  });

  // 🔥 FIXED: Debug function to test all desktop capturer features
  safeRegisterHandler("debug-desktop-capturer", async () => {
    try {
      if ($DebugTestMode) {
        console.log("🔍 === DESKTOP CAPTURER DEBUG INFO ===");
      }

      // Test basic availability
      const sources = await desktopCapturer.getSources({
        types: ["screen", "window"],
        thumbnailSize: { width: 100, height: 100 },
      });

      if ($DebugTestMode) {
        console.log("🔍 Total sources found:", sources.length);

        // Log all sources
        sources.forEach((source, index) => {
          console.log(`🔍 Source ${index + 1}:`, {
            id: source.id,
            name: source.name,
            display_id: source.display_id,
            thumbnail_size: source.thumbnail
              ? `${source.thumbnail.getSize().width}x${
                  source.thumbnail.getSize().height
                }`
              : "none",
          });
        });
      }

      // Identify screen sources
      const screenSources = sources.filter((s) => s.id.startsWith("screen:"));
      if ($DebugTestMode) {
        console.log("🔍 Screen sources:", screenSources.length);
      }

      // Find primary screen
      const primaryScreen = screenSources.find(
        (s) =>
          s.name === "Entire Screen" ||
          s.name.includes("Screen 1") ||
          s.id.includes("screen:0")
      );

      if ($DebugTestMode) {
        console.log(
          "🔍 Primary screen:",
          primaryScreen ? primaryScreen.name : "Not found"
        );
      }

      const debugInfo = {
        success: true,
        totalSources: sources.length,
        screenSources: screenSources.length,
        windowSources: sources.filter((s) => s.id.startsWith("window:")).length,
        primaryScreen: primaryScreen
          ? {
              id: primaryScreen.id,
              name: primaryScreen.name,
              display_id: primaryScreen.display_id,
            }
          : null,
        allScreens: screenSources.map((s) => ({
          id: s.id,
          name: s.name,
          display_id: s.display_id,
        })),
        platform: process.platform,
        electronVersion: process.versions.electron,
      };

      if ($DebugTestMode) {
        console.log("🔍 === END DEBUG INFO ===");
      }
      return debugInfo;
    } catch (error) {
      if ($DebugTestMode) {
        console.error("🔍 ❌ Desktop capturer debug failed:", error);
      }
      return {
        success: false,
        error: error.message,
      };
    }
  });
  // ========== END OF NATIVE SYSTEM AUDIO IPC HANDLERS ==========

  if ($DebugTestMode) {
    console.log(
      "IPC handlers setup completed with enhanced error handling and safe registration"
    );
  }
}

function monitorVoskProcess() {
  setInterval(() => {
    if (voskProcess && voskProcess.childProcess) {
      const isHealthy =
        !voskProcess.childProcess.killed &&
        voskProcess.childProcess.stdin &&
        voskProcess.childProcess.stdin.writable;

      console.log(`🏥 VOSK HEALTH: ${isHealthy ? "HEALTHY" : "UNHEALTHY"}`);

      if (!isHealthy) {
        console.log("🔄 VOSK: Restarting unhealthy process...");
        try {
          if (voskProcess) {
            voskProcess.terminate();
          }
          voskProcess = startVoskProcess();
          console.log("✅ VOSK: Process restarted");
        } catch (error) {
          console.error("❌ VOSK: Restart failed:", error);
        }
      }
    } else {
      console.log("⚠️ VOSK HEALTH: No process running");
    }
  }, 15000); // Check every 15 seconds
}
// CREATE DEDICATED LOGIN POPUP WINDOW
function createAuthWindow() {
  if (authWindow && !authWindow.isDestroyed()) {
    authWindow.focus();
    return;
  }

  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  // Create authentication window
  authWindow = new BrowserWindow({
    width: 450,
    height: 600,
    x: Math.floor(width / 2 - 225),
    y: Math.floor(height / 2 - 300),
    frame: true,
    resizable: false,
    alwaysOnTop: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      preload: path.join(__dirname, "preload.js"),
      allowRunningInsecureContent: true,
    },
    icon: path.join(__dirname, "assets/icon.png"), // Just use PNG
  });

  const loginHtmlPath = path.join(__dirname, "login.html");
  authWindow.loadFile(loginHtmlPath);

  authWindow.webContents.on("dom-ready", () => {
    if ($DebugTestMode) {
      console.log("Auth window loaded successfully");
      // Open DevTools (built-in inspect console) for auth window
      authWindow.webContents.openDevTools({ mode: "detach" });
    }
  });

  authWindow.on("closed", () => {
    authWindow = null;
  });

  // Create console window (only in debug mode) - if you still want a separate console
  if ($DebugTestMode) {
    createConsoleWindow();
  }
}

// Handle successful authentication from the login window
function handleSuccessfulAuth(userData) {
  if ($DebugTestMode) {
    console.log("🔐 === HANDLING SUCCESSFUL AUTH ===");
    console.log("🔐 Auth data received:", userData);
  }

  // Update app auth state
  authState.isAuthenticated = true;
  console.log(
    "this is setting the token🔐🔐🔐🔐🔐🔐🔐🔐🔐🔐🔐🔐 TO",
    userData.token
  );
  authState.token = userData.token;
  authState.user = userData.user;

  if ($DebugTestMode) {
    console.log("🔐 Updated authState:", {
      isAuthenticated: authState.isAuthenticated,
      hasToken: !!authState.token,
      tokenLength: authState.token ? authState.token.length : 0,
      userEmail: authState.user ? authState.user.email : null,
    });
  }

  // Save auth data locally
  saveAuthData(authState);

  // Update all windows with auth state
  updateWindowsWithAuthState();

  // Send auth-success event to ALL windows with FULL auth data
  const fullAuthData = {
    token: userData.token,
    user: userData.user,
  };

  const windows = [controlWindow, transcriptWindow, aiWindow];
  windows.forEach((window, index) => {
    if (window && !window.isDestroyed()) {
      try {
        if ($DebugTestMode) {
          console.log(`🔐 Sending auth-success to window ${index}:`, {
            hasToken: !!fullAuthData.token,
            tokenLength: fullAuthData.token ? fullAuthData.token.length : 0,
            userEmail: fullAuthData.user ? fullAuthData.user.email : null,
          });
        }
        window.webContents.send("auth-success", fullAuthData);
      } catch (error) {
        if ($DebugTestMode) {
          console.error(
            `🔐 Failed to send auth-success to window ${index}:`,
            error
          );
        }
      }
    }
  });

  // Close auth window
  if (authWindow && !authWindow.isDestroyed()) {
    authWindow.close();
  }

  if ($DebugTestMode) {
    console.log("🔐 === AUTH SUCCESS HANDLING COMPLETE ===");
  }
}

function checkAndNotifyMaximizedState() {
  console.log("🔍 checkAndNotifyMaximizedState called");

  try {
    // Get screen and window dimensions
    const screenSize = screen.getPrimaryDisplay().workAreaSize;
    console.log(
      `🖥️ Screen work area: ${screenSize.width}x${screenSize.height}`
    );

    if (!aiWindow) {
      console.error("❌ aiWindow is null or undefined");
      return;
    }

    if (aiWindow.isDestroyed()) {
      console.warn("⚠️ aiWindow is destroyed");
      return;
    }

    const windowBounds = aiWindow.getBounds();
    console.log(
      `📋 Window bounds: ${windowBounds.width}x${windowBounds.height} at (${windowBounds.x},${windowBounds.y})`
    );

    // Allow for a small margin (5px) to account for window borders/chrome
    const margin = 5;
    const widthDiff = Math.abs(windowBounds.width - screenSize.width);
    const heightDiff = Math.abs(windowBounds.height - screenSize.height);

    console.log(
      `📐 Dimension differences - Width: ${widthDiff}px, Height: ${heightDiff}px`
    );
    console.log(`📏 Margin tolerance: ${margin}px`);

    const isMaximized = widthDiff <= margin && heightDiff <= margin;

    if (isMaximized) {
      console.log("✅ Window detected as maximized");
      if ($DebugTestMode) {
        console.log("📊 Debug details:");
        console.log(`Screen: ${screenSize.width}x${screenSize.height}`);
        console.log(`Window: ${windowBounds.width}x${windowBounds.height}`);
        console.log(`Width difference: ${widthDiff}px (<= ${margin}px)`);
        console.log(`Height difference: ${heightDiff}px (<= ${margin}px)`);
      }

      // Notify AI window that it's maximized
      console.log("📤 Calling notifyAIWindowMaximized(true)");
      notifyAIWindowMaximized(true);
    } else {
      console.log("❌ Window is not maximized");
      if ($DebugTestMode) {
        console.log("📊 Debug details:");
        console.log(`Screen: ${screenSize.width}x${screenSize.height}`);
        console.log(`Window: ${windowBounds.width}x${windowBounds.height}`);
        console.log(
          `Width difference: ${widthDiff}px (${
            widthDiff <= margin ? "✓" : "✗"
          } <= ${margin}px)`
        );
        console.log(
          `Height difference: ${heightDiff}px (${
            heightDiff <= margin ? "✓" : "✗"
          } <= ${margin}px)`
        );
      }
    }
  } catch (error) {
    console.error("💥 Error in checkAndNotifyMaximizedState:", error);
  }

  console.log("🏁 checkAndNotifyMaximizedState execution completed");
}

function notifyAIWindowMaximized(isMaximized) {
  console.log(
    `notifyAIWindowMaximized called with isMaximized: ${isMaximized}`
  );

  try {
    if (aiWindow && !aiWindow.isDestroyed()) {
      console.log("Sending window-maximized-changed message to AI window");
      aiWindow.webContents.send("window-maximized-changed", isMaximized);
    } else {
      if (!aiWindow) {
        console.warn("aiWindow is null or undefined");
      } else if (aiWindow.isDestroyed()) {
        console.warn("aiWindow is destroyed");
      }
    }
  } catch (error) {
    console.error("Error in notifyAIWindowMaximized:", error);
  }

  console.log("notifyAIWindowMaximized execution completed");
}

function saveAuthData(authData) {
  try {
    const authFilePath = path.join(app.getPath("userData"), "user-auth.json");
    fs.writeFileSync(
      authFilePath,
      JSON.stringify(
        {
          token: authData.token,
          user: authData.user,
          timestamp: Date.now(),
        },
        null,
        2
      )
    );
    if ($DebugTestMode) {
      console.log("Auth data saved locally");
    }
  } catch (error) {
    if ($DebugTestMode) {
      console.error("Failed to save auth data:", error);
    }
  }
}

function loadAuthData() {
  try {
    const authFilePath = path.join(app.getPath("userData"), "user-auth.json");
    if (fs.existsSync(authFilePath)) {
      const authData = JSON.parse(fs.readFileSync(authFilePath, "utf8"));

      // Check if auth data is not too old (1 day)
      const oneDayAgo = Date.now() - 1 * 24 * 60 * 60 * 1000;
      if (authData.timestamp > oneDayAgo) {
        authState.isAuthenticated = true;
        console.log(
          "this is setting the token🔐🔐🔐🔐🔐🔐🔐🔐🔐🔐🔐🔐 TO",
          authData.token
        );
        authState.token = authData.token;
        authState.user = authData.user;
        if ($DebugTestMode) {
          console.log("Loaded cached auth data for:", authState.user.email);
        }
        return true;
      } else {
        if ($DebugTestMode) {
          console.log("Cached auth data expired, removing...");
        }
        fs.unlinkSync(authFilePath);
      }
    }
  } catch (error) {
    if ($DebugTestMode) {
      console.error("Failed to load auth data:", error);
    }
  }
  return false;
}

function updateWindowsWithAuthState() {
  if (authStateUpdateInProgress || !windowsReady) {
    if ($DebugTestMode) {
      console.log(
        "Skipping auth state update - already in progress or windows not ready"
      );
    }
    return;
  }

  authStateUpdateInProgress = true;

  const authData = {
    isAuthenticated: authState.isAuthenticated,
    user: authState.user,
    token: authState.token,
  };

  if ($DebugTestMode) {
    console.log("🔐 === UPDATING ALL WINDOWS WITH AUTH STATE ===");
    console.log("🔐 Auth data being sent:", {
      isAuthenticated: authData.isAuthenticated,
      hasToken: !!authData.token,
      tokenLength: authData.token ? authData.token.length : 0,
      userEmail: authData.user ? authData.user.email : null,
    });
  }

  const windows = [
    { window: controlWindow, name: "control" },
    { window: transcriptWindow, name: "transcript" },
    { window: aiWindow, name: "ai" },
  ];

  windows.forEach(({ window, name }) => {
    if (window && !window.isDestroyed()) {
      try {
        if (window.webContents && !window.webContents.isDestroyed()) {
          if (window.webContents.isLoading()) {
            window.webContents.once("dom-ready", () => {
              if ($DebugTestMode) {
                console.log(
                  `🔐 Sending auth-state-updated to ${name} window (after dom-ready)`
                );
              }
              safeSendToWindow(window, "auth-state-updated", authData);
            });
          } else {
            if ($DebugTestMode) {
              console.log(
                `🔐 Sending auth-state-updated to ${name} window (immediately)`
              );
            }
            safeSendToWindow(window, "auth-state-updated", authData);
          }
        }
      } catch (error) {
        if ($DebugTestMode) {
          console.error(
            `🔐 Failed to send auth state to ${name} window:`,
            error
          );
        }
      }
    }
  });

  if ($DebugTestMode) {
    console.log("🔐 === FINISHED UPDATING ALL WINDOWS ===");
  }

  authStateUpdateInProgress = false;
}

// Vosk and other existing functions remain the same as in the original file...
// (Including initializeVosk, startVoskProcess, IPC handlers for Vosk, etc.)

async function initializeVosk() {
  if ($DebugTestMode) {
    console.log("Main process: initializeVosk() called");
  }

  try {
    if ($DebugTestMode) {
      console.log(
        "Main process: Starting Python-Vosk bridge initialization..."
      );
      console.log("__dirname:", __dirname);
    }

    const modelsPath = path.join(__dirname, "models");
    const modelPath = path.join(modelsPath, "vosk-model-small-en-us-0.15");

    if ($DebugTestMode) {
      console.log("Checking models directory:", modelsPath);
      console.log("Models directory exists?", fs.existsSync(modelsPath));
      console.log("Vosk model exists?", fs.existsSync(modelPath));
    }

    if (!fs.existsSync(modelPath)) {
      return {
        success: false,
        error: `Vosk model not found. Please download vosk-model-small-en-us-0.15 extract to: ${modelPath}`,
      };
    }

    if ($DebugTestMode) {
      console.log("Checking if PythonShell is available...");
      console.log("PythonShell type:", typeof PythonShell);
    }

    if (!PythonShell) {
      if ($DebugTestMode) {
        console.error("PythonShell not available");
      }
      return {
        success: false,
        error: "python-shell module not loaded properly",
      };
    }

    // ✅ FIXED: Only create test_python.py if it doesn't exist
    const testScriptPath = path.join(__dirname, "test_python.py");
    if (!fs.existsSync(testScriptPath)) {
      const testScript =
        'import sys\nprint("Python version:", sys.version)\nprint("Python OK")';
      fs.writeFileSync(testScriptPath, testScript);
      if ($DebugTestMode) {
        console.log("Test script created at:", testScriptPath);
      }
    } else {
      if ($DebugTestMode) {
        console.log("Test script already exists at:", testScriptPath);
      }
    }

    if ($DebugTestMode) {
      console.log("Testing Python installation...");
    }

    return new Promise((resolve) => {
      const pythonProcess = new PythonShell("test_python.py", {
        mode: "text",
        pythonOptions: ["-u"],
        scriptPath: __dirname,
        pythonPath: "python",
      });

      let output = [];
      let errorOutput = [];

      pythonProcess.on("message", function (message) {
        if ($DebugTestMode) {
          console.log("Python output:", message);
        }
        output.push(message);
      });

      pythonProcess.on("error", function (err) {
        if ($DebugTestMode) {
          console.error("Python error:", err);
        }
        errorOutput.push(err.message);
      });

      pythonProcess.on("close", function () {
        if ($DebugTestMode) {
          console.log("Python process closed");
        }

        if (errorOutput.length > 0) {
          resolve({
            success: false,
            error: `Python error: ${errorOutput.join(
              ", "
            )}. Make sure Python is in your PATH.`,
          });
          return;
        }

        if (output.length === 0) {
          resolve({
            success: false,
            error:
              "Python script produced no output. Python might not be installed correctly.",
          });
          return;
        }

        if ($DebugTestMode) {
          console.log("Python works, testing Vosk import...");
        }

        // ✅ FIXED: Only create test_vosk.py if it doesn't exist
        const testVoskPath = path.join(__dirname, "test_vosk.py");
        if (!fs.existsSync(testVoskPath)) {
          const voskTestScript = `
try:
    import vosk
    print("Vosk import successful")
    print("Vosk version:", vosk.__version__ if hasattr(vosk, '__version__') else 'unknown')
except ImportError as e:
    print("Vosk import failed:", str(e))
except Exception as e:
    print("Unexpected error:", str(e))
`;
          fs.writeFileSync(testVoskPath, voskTestScript);
          if ($DebugTestMode) {
            console.log("Vosk test script created at:", testVoskPath);
          }
        } else {
          if ($DebugTestMode) {
            console.log("Vosk test script already exists at:", testVoskPath);
          }
        }

        const voskProcess = new PythonShell("test_vosk.py", {
          mode: "text",
          pythonOptions: ["-u"],
          scriptPath: __dirname,
          pythonPath: "python",
        });

        let voskOutput = [];
        let voskError = false;

        voskProcess.on("message", function (message) {
          if ($DebugTestMode) {
            console.log("Vosk test output:", message);
          }
          voskOutput.push(message);
          if (message.includes("failed")) {
            voskError = true;
          }
        });

        voskProcess.on("error", function (err) {
          if ($DebugTestMode) {
            console.error("Vosk test error:", err);
          }
          voskError = true;
        });

        voskProcess.on("close", function () {
          if (voskError || voskOutput.some((msg) => msg.includes("failed"))) {
            resolve({
              success: false,
              error:
                "Vosk Python module not installed. Please run: pip install vosk",
            });
            return;
          }

          if ($DebugTestMode) {
            console.log("All tests passed, Vosk is ready");
          }
          voskReady = true;

          // ✅ ALSO FIXED: Only create realtime script if it doesn't exist
          const realtimeScriptPath = path.join(
            __dirname,
            "vosk_realtime_generated.py"
          );
          if (!fs.existsSync(realtimeScriptPath)) {
            const realtimeScript = fs.readFileSync(
              path.join(__dirname, "vosk_realtime.py"),
              "utf8"
            );
            fs.writeFileSync(realtimeScriptPath, realtimeScript);
            if ($DebugTestMode) {
              console.log("Realtime script created at:", realtimeScriptPath);
            }
          } else {
            if ($DebugTestMode) {
              console.log(
                "Realtime script already exists at:",
                realtimeScriptPath
              );
            }
          }

          resolve({ success: true });
        });
      });
    });
  } catch (error) {
    if ($DebugTestMode) {
      console.error("Main process: Error in initializeVosk:", error);
    }
    return { success: false, error: `Initialization error: ${error.message}` };
  }
}

// Add these variables at the top of main.js with other global variables
let lastVoskFinal = "";
let lastVoskTime = 0;

function startVoskProcess() {
  if ($DebugTestMode) {
    console.log("startVoskProcess called");
  }

  if (voskProcess) {
    if ($DebugTestMode) {
      console.log("Terminating existing Vosk process");
    }
    try {
      voskProcess.terminate();
    } catch (error) {
      if ($DebugTestMode) {
        console.error("Error terminating existing Vosk process:", error);
      }
    }
  }

  const modelPath = path.join(
    __dirname,
    "models",
    "vosk-model-small-en-us-0.15"
  );
  if ($DebugTestMode) {
    console.log("Starting Vosk with model:", modelPath);
  }

  try {
    voskProcess = new PythonShell("vosk_realtime.py", {
      mode: "text",
      pythonOptions: ["-u"],
      scriptPath: __dirname,
      args: [modelPath],
    });

    voskProcess.on("message", async (message) => {
      if ($DebugTestMode) {
        console.log("Vosk message received:", message);
      }

      if (message === "VOSK_READY") {
        if ($DebugTestMode) {
          console.log("Vosk process ready");
        }
        return;
      }

      try {
        const result = JSON.parse(message);

        // Add duplicate check at Vosk level using module variables
        if (result.type === "final") {
          if (
            lastVoskFinal === result.text &&
            Date.now() - lastVoskTime < 1000
          ) {
            if ($DebugTestMode) {
              console.log("Duplicate Vosk result ignored:", result.text);
            }
            return; // Skip duplicate
          }
          lastVoskFinal = result.text;
          lastVoskTime = Date.now();
        }

        if ($DebugTestMode) {
          console.log("Parsed Vosk result:", result);
        }

        if (result.type === "final" || result.type === "partial") {
          // Start with basic text
          let originalText = String(result.text || "");
          let correctedText = originalText;

          // Apply text correction if available
          if (nlpReady && originalText.trim()) {
            try {
              correctedText = await correctText(originalText);
            } catch (correctionError) {
              if ($DebugTestMode) {
                console.error("Error in text correction:", correctionError);
              }
              correctedText = originalText; // Fallback to original
            }
          }

          // Create completely clean, serializable object
          const cleanResult = {
            type: String(result.type),
            text: String(correctedText),
            originalText:
              originalText !== correctedText ? String(originalText) : undefined,
            confidence:
              typeof result.confidence === "number" ? result.confidence : 0,
            timestamp: Date.now(),
          };

          // Remove undefined values
          Object.keys(cleanResult).forEach((key) => {
            if (cleanResult[key] === undefined) {
              delete cleanResult[key];
            }
          });

          if ($DebugTestMode) {
            console.log(
              `Sending ${cleanResult.type} transcription:`,
              cleanResult.text
            );
            console.log("Clean result object:", cleanResult);
          }

          // Send with error handling
          const success = safeSendToWindow(
            controlWindow,
            "vosk-transcription",
            cleanResult
          );
          if (!success && $DebugTestMode) {
            console.error(
              "Failed to send Vosk transcription to control window"
            );
          }
        } else if (result.type === "error") {
          // Create clean error object
          const cleanError = {
            type: "error",
            error: String(result.error || "Unknown Vosk error"),
            timestamp: Date.now(),
          };

          if ($DebugTestMode) {
            console.error("Vosk error:", cleanError.error);
          }

          const success = safeSendToWindow(
            controlWindow,
            "vosk-transcription",
            cleanError
          );
          if (!success && $DebugTestMode) {
            console.error("Failed to send Vosk error to control window");
          }
        }
      } catch (parseError) {
        if ($DebugTestMode) {
          console.error("Failed to parse Vosk output:", parseError);
          console.error("Raw message was:", message);
        }

        // Send a clean error object
        const cleanParseError = {
          type: "error",
          error: "Failed to parse Vosk output",
          timestamp: Date.now(),
        };

        const success = safeSendToWindow(
          controlWindow,
          "vosk-transcription",
          cleanParseError
        );
        if (!success && $DebugTestMode) {
          console.error("Failed to send parse error to control window");
        }
      }
    });

    voskProcess.on("error", (err) => {
      if ($DebugTestMode) {
        console.error("Vosk process error:", err);
      }
    });

    voskProcess.on("close", () => {
      if ($DebugTestMode) {
        console.log("Vosk process closed");
      }
      voskProcess = null;
    });

    voskProcess.on("stderr", (stderr) => {
      if ($DebugTestMode) {
        console.log("Vosk stderr:", stderr);
      }
    });
  } catch (error) {
    if ($DebugTestMode) {
      console.error("Error starting Vosk process:", error);
    }
    voskProcess = null;
  }

  return voskProcess;
}

app.whenReady().then(async () => {
  const { session } = require("electron");

  // ✅ CRITICAL: Enhanced permission handler for audio capture
  session.defaultSession.setPermissionRequestHandler(
    (webContents, permission, callback) => {
      console.log("🔐 Permission requested:", permission);

      // ✅ Allow ALL audio/video permissions
      const allowedPermissions = [
        "microphone",
        "camera",
        "media",
        "audioCapture",
        "videoCapture",
        "displayCapture",
        "desktopCapture",
        "screen",
        "audio",
        "notifications",
        "geolocation",
        "midi",
        "midiSysex",
        "pointerLock",
        "fullscreen",
        "openExternal",
      ];

      if (allowedPermissions.includes(permission)) {
        callback(true);
        console.log(`✅ GRANTED permission: ${permission}`);
      } else {
        console.log(`❌ DENIED permission: ${permission}`);
        callback(false);
      }
    }
  );

  // ✅ CRITICAL: Enhanced device permission handler
  session.defaultSession.setDevicePermissionHandler((details) => {
    console.log("🔐 Device permission requested:", details);

    const allowedDevices = [
      "microphone",
      "camera",
      "speaker",
      "audioinput",
      "audiooutput",
      "videoinput",
    ];

    if (allowedDevices.includes(details.deviceType)) {
      console.log(`✅ GRANTED device permission: ${details.deviceType}`);
      return true;
    }

    console.log(`❌ DENIED device permission: ${details.deviceType}`);
    return false;
  });

  // ✅ CRITICAL: Enhanced display media handler
  session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
    console.log("🖥️ Display media requested:", request);

    // ✅ ALWAYS allow with both video and audio
    callback({
      video: true,
      audio: true,
    });

    console.log("✅ GRANTED display media with audio");
  });

  // ✅ NEW: Permission check handler
  session.defaultSession.setPermissionCheckHandler(
    (webContents, permission, requestingOrigin) => {
      console.log(
        "🔍 Permission check:",
        permission,
        "from:",
        requestingOrigin
      );

      // Allow all media permissions
      const mediaPermissions = [
        "microphone",
        "camera",
        "media",
        "audioCapture",
        "videoCapture",
        "displayCapture",
        "desktopCapture",
        "screen",
        "audio",
      ];

      if (mediaPermissions.includes(permission)) {
        console.log(`✅ ALLOWED permission check: ${permission}`);
        return true;
      }

      return false;
    }
  );

  await initializeCompromise();
  await initializeLanguageTool();

  loadAuthData();
  createWindows();

  // THEN do heavy initialization AFTER windows are stable
  setTimeout(async () => {
    if (!languageToolInstalled) {
      if ($DebugTestMode) {
        console.log(
          "🔧 LanguageTool not installed, starting background download..."
        );
      }
      downloadLanguageToolOnStartup().catch((error) => {
        if ($DebugTestMode) {
          console.error("❌ Background LanguageTool download failed:", error);
        }
      });
    } else {
      if ($DebugTestMode) {
        console.log("🔧 LanguageTool already installed, skipping download");
      }
    }

    updateWindowsWithAuthState(); // Do this after windows are stable
  }, 2000); // Wait 2 seconds after window creation

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindows();
    }
  });

  // Start Vosk process monitoring (after windows are ready)
  setTimeout(() => {
    monitorVoskProcess();
    console.log("🏥 Started Vosk process monitoring");
  }, 8000); // Increased delay

  // Save window states periodically (but only after startup)
  setInterval(() => {
    if (startupComplete) {
      saveWindowStates();
    }
  }, 30000);
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("will-quit", () => {
  // Save window states before quitting
  saveWindowStates();

  // Unregister all global shortcuts
  globalShortcut.unregisterAll();

  // Clean up Vosk process
  if (voskProcess) {
    voskProcess.terminate();
  }

  // 🔧 NEW: Clean up LanguageTool
  if (languageToolManager) {
    languageToolManager.cleanup();
  }
});

// Handle app activation (macOS)
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindows();
  } else {
    // Show all windows when activated
    [controlWindow, transcriptWindow, aiWindow].forEach((win) => {
      if (win && !win.isDestroyed()) {
        win.show();
      }
    });
  }
});

// Handle second instance
app.on("second-instance", () => {
  // Focus windows when second instance is attempted
  [controlWindow, transcriptWindow, aiWindow].forEach((win) => {
    if (win && !win.isDestroyed()) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
});

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

if ($DebugTestMode) {
  console.log("Enhanced main.js loaded with improved window management");
}

// Add this helper function to calculate distance to corners
function getDistanceToCorners(bounds, screenSize) {
  return {
    topLeft: Math.sqrt(Math.pow(bounds.x, 2) + Math.pow(bounds.y, 2)),
    topRight: Math.sqrt(
      Math.pow(screenSize.width - (bounds.x + bounds.width), 2) +
        Math.pow(bounds.y, 2)
    ),
  };
}

// Add this snapping function
function snapIfNearCorner(win, windowName) {
  if (!win || win.isDestroyed()) return false; // ✅ RETURNS BOOLEAN

  const screenSize = screen.getPrimaryDisplay().workAreaSize;
  const bounds = win.getBounds();
  const threshold = 50;
  const corners = getDistanceToCorners(bounds, screenSize);

  let wasSnapped = false; // ✅ TRACK WHETHER SNAPPING OCCURRED

  // Top-left corner snapping
  if (corners.topLeft < threshold) {
    win.setBounds({
      x: 0, // ✅ MOVES TO CORNER
      y: 0,
      width: bounds.width,
      height: bounds.height,
    });
    if ($DebugTestMode) {
      console.log(`${windowName} snapped to top-left corner (0, 0)`);
    }
    wasSnapped = true; // ✅ MARK AS SNAPPED
  }
  // Top-right corner snapping
  else if (corners.topRight < threshold) {
    win.setBounds({
      x: screenSize.width - bounds.width, // ✅ MOVES TO CORNER
      y: 0,
      width: bounds.width,
      height: bounds.height,
    });
    if ($DebugTestMode) {
      console.log(
        `${windowName} snapped to top-right corner (${
          screenSize.width - bounds.width
        }, 0)`
      );
    }
    wasSnapped = true; // ✅ MARK AS SNAPPED
  }

  return wasSnapped; // ✅ RETURN WHETHER SNAPPING OCCURRED
}
ipcMain.handle("ensure-control-window-visible", async () => {
  if (controlWindow && !controlWindow.isDestroyed()) {
    try {
      if (controlWindow.isMinimized()) {
        controlWindow.restore();
      }

      controlWindow.show();
      controlWindow.focus();
      controlWindow.setAlwaysOnTop(true, "pop-up-menu");
      controlWindow.moveTop();

      // Ensure it's visible on screen
      const bounds = controlWindow.getBounds();
      const { width, height } = screen.getPrimaryDisplay().workAreaSize;

      if (
        bounds.x < 0 ||
        bounds.y < 0 ||
        bounds.x > width ||
        bounds.y > height
      ) {
        controlWindow.center();
      }

      if ($DebugTestMode) {
        console.log("Control window restored and made visible");
      }

      return { success: true };
    } catch (error) {
      if ($DebugTestMode) {
        console.error("Error ensuring control window visible:", error);
      }
      return { success: false, error: error.message };
    }
  }
  return { success: false, error: "Control window not available" };
});

ipcMain.handle(
  "set-control-window-always-on-top",
  async (event, alwaysOnTop) => {
    if (controlWindow && !controlWindow.isDestroyed()) {
      try {
        if (alwaysOnTop) {
          controlWindow.setAlwaysOnTop(true, "pop-up-menu");
          controlWindow.setVisibleOnAllWorkspaces(true);
        } else {
          controlWindow.setAlwaysOnTop(true, "floating"); // Still on top, but lower priority
        }
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    }
    return { success: false, error: "Control window not available" };
  }
);
