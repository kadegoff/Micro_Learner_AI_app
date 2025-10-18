// main-renderer.js - NATIVE SYSTEM AUDIO VERSION

if ($DebugTestMode) {
  console.log("main-renderer.js loading started - NATIVE AUDIO MODE");
}

/**
 * Core Configuration Variables
 * These variables define the application's fundamental settings
 */
let backendUrl = "http://localhost/Memoria/backend";
let transcriptBuffer = "";
let audioContext = null;
let audioWorker = null;
let voskReady = false;
let lastTranscript = "";
let lastTranscriptTime = 0;
let currentPartialTranscriptId = null;

/**
 * LanguageTool Integration State
 * Manages the grammar checking service status
 */
let languageToolReady = false;
let languageToolInstalled = false;
let languageToolDownloading = false;
let languageToolStarting = false;
let languageToolStopping = false;

/**
 * Authentication Management
 * Handles user authentication tokens and session data
 */
let authToken = localStorage.getItem("memoria_token");
let currentUser = null;

// Try to parse user data immediately
try {
  const userData = localStorage.getItem("memoria_user");
  if (userData) {
    currentUser = JSON.parse(userData);
    if ($DebugTestMode) {
      console.log("LOOK AT THIS USER DATA", currentUser);
    }
  }
} catch (error) {
  if ($DebugTestMode) {
    console.error("Failed to parse stored user data:", error);
    console.log(
      "10🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨THE TOKEN AND USER JUST GOT RESET FOR THE LOGIN SYSTEM THIS SHOULD ONLY HAPPEN ON ERROR OR LOGOUT WHICH ISNT EVEN A THING YET🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨"
    );
  }
  localStorage.removeItem("memoria_user");
}

// Log initial auth state
if ($DebugTestMode) {
  console.log("ON LOOOOAADDD memoria_token", authToken);
  console.log("ON LOOOOAADDD currentUser", currentUser);
  console.log("🔐 Initial auth state in main-renderer:");
  console.log(
    "🔐 authToken:",
    authToken ? `[${authToken.length} chars]` : "NULL"
  );
  console.log("🔐 currentUser:", currentUser ? currentUser.email : "NULL");
}

// Add these variables for improved question detection
let recentTranscripts = [];
let TRANSCRIPT_HISTORY_SIZE = 5;
const CONTEXT_WINDOW_MS = 10000;

// Add silence detection variables
let potentialQuestion = null;
let silenceTimer = null;
const SILENCE_THRESHOLD_MS = 2000;

// MediaRecorder for audio chunks
let mediaRecorder = null;

// Add maximum transcript buffer size control
const MAX_TRANSCRIPT_BUFFER_SIZE = 1000;

if ($DebugTestMode) {
  console.log("Variables initialized");
  console.log("Backend URL:", backendUrl);
}

function resetAuthentication(reason = "Authentication failed") {
  if ($DebugTestMode) {
    console.log("🔐 === RESETTING AUTHENTICATION ===");
    console.log("🔐 Reason:", reason);
    console.log(
      "9🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨THE TOKEN AND USER JUST GOT RESET FOR THE LOGIN SYSTEM THIS SHOULD ONLY HAPPEN ON ERROR OR LOGOUT WHICH ISNT EVEN A THING YET🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨"
    );
  }

  authToken = null;
  currentUser = null;
  localStorage.removeItem("memoria_token");
  localStorage.removeItem("memoria_user");

  if ($DebugTestMode) {
    console.log("🔐 ✅ Authentication reset complete");
  }
}

function checkAuthentication() {
  if ($DebugTestMode) {
    console.log("🔐 === CHECKING AUTHENTICATION ===");
  }

  if (authToken && currentUser) {
    if ($DebugTestMode) {
      console.log(
        "✅ Auth found in variables:",
        currentUser.email,
        "Token length:",
        authToken.length
      );
    }
    return true;
  }

  if ($DebugTestMode) {
    console.log("❌ Variables missing auth, checking localStorage...");
    console.log("❌ authToken variable:", authToken ? "present" : "missing");
    console.log(
      "❌ currentUser variable:",
      currentUser ? "present" : "missing"
    );
  }

  const storageToken = localStorage.getItem("memoria_token");
  const userData = localStorage.getItem("memoria_user");

  if ($DebugTestMode) {
    console.log(
      "🔐 localStorage token:",
      storageToken ? `[${storageToken.length} chars]` : "MISSING"
    );
    console.log("🔐 localStorage user:", userData ? "PRESENT" : "MISSING");
  }

  if (storageToken && userData) {
    try {
      authToken = storageToken;
      currentUser = JSON.parse(userData);
      if ($DebugTestMode) {
        console.log(
          "✅ Auth loaded from localStorage and updated globals:",
          currentUser.email
        );
        console.log("✅ Updated authToken length:", authToken.length);
        console.log("✅ Token preview:", authToken.substring(0, 50) + "...");
      }
      return true;
    } catch (error) {
      if ($DebugTestMode) {
        console.error("❌ Failed to parse user data from localStorage:", error);
        console.log(
          "8🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨THE TOKEN AND USER JUST GOT RESET FOR THE LOGIN SYSTEM THIS SHOULD ONLY HAPPEN ON ERROR OR LOGOUT WHICH ISNT EVEN A THING YET🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨"
        );
      }
      localStorage.removeItem("memoria_token");
      localStorage.removeItem("memoria_user");
      authToken = null;
      currentUser = null;
    }
  }

  if ($DebugTestMode) {
    console.log("❌ No valid authentication found");
  }
  return false;
}

function refreshAuthFromStorage() {
  if ($DebugTestMode) {
    console.log("🔐 === FORCE REFRESH AUTH FROM STORAGE ===");
  }

  const storageToken = localStorage.getItem("memoria_token");
  const userData = localStorage.getItem("memoria_user");

  if ($DebugTestMode) {
    console.log(
      "🔐 Storage token:",
      storageToken ? `[${storageToken.length} chars]` : "MISSING"
    );
    console.log("🔐 Storage user:", userData ? "PRESENT" : "MISSING");
  }

  if (storageToken && userData) {
    try {
      authToken = storageToken;
      currentUser = JSON.parse(userData);
      if ($DebugTestMode) {
        console.log("🔐 ✅ Auth refreshed successfully:", currentUser.email);
        console.log("🔐 ✅ Token length:", authToken.length);
      }
      return true;
    } catch (error) {
      if ($DebugTestMode) {
        console.error("🔐 ❌ Failed to refresh auth:", error);
      }
      authToken = null;
      currentUser = null;
      return false;
    }
  }

  if ($DebugTestMode) {
    console.log("🔐 ❌ No auth data to refresh from");
  }
  authToken = null;
  currentUser = null;
  return false;
}

async function getBackendSettings() {
  if ($DebugTestMode) {
    console.log("getBackendSettings", authToken);
  }
  try {
    const response = await fetch(
      `${backendUrl}/api/index.php?endpoint=settings`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token: authToken,
        }),
      }
    );

    const responseText = await response.text();
    if ($DebugTestMode) {
      console.log("Backend settings raw response:", responseText);
      console.log("Response status:", response.status);
      console.log("Response headers:", [...response.headers.entries()]);
    }

    if (response.ok) {
      try {
        const data = JSON.parse(responseText);
        if ($DebugTestMode) {
          console.log("Parsed settings data:", data);
        }

        if (data.transcript_history_size) {
          TRANSCRIPT_HISTORY_SIZE = data.transcript_history_size;
          if ($DebugTestMode) {
            console.log(
              "Updated TRANSCRIPT_HISTORY_SIZE:",
              TRANSCRIPT_HISTORY_SIZE
            );
          }
        }
      } catch (parseError) {
        if ($DebugTestMode) {
          console.error(
            "Failed to parse settings response as JSON:",
            parseError
          );
          console.error("Response was:", responseText);

          // Keep the PHP error detection
          if (responseText.includes("<br") || responseText.includes("<b>")) {
            console.error("Backend returned PHP error HTML instead of JSON");
            console.error("This usually means there's a PHP error in api.php");
            console.error(
              "Check your PHP error logs or enable error display in PHP"
            );
          }
        }
      }
    } else {
      if ($DebugTestMode) {
        console.error(
          "Backend settings request failed with status:",
          response.status
        );
        console.error("Response body:", responseText);
      }
    }
  } catch (error) {
    if ($DebugTestMode) {
      console.error("Failed to get backend settings:", error);
      console.error(
        "This might mean the backend is not accessible at:",
        `${backendUrl}/api/index.php?endpoint=settings`
      );
    }
  }
}

async function waitForNLP() {
  try {
    const isReady = await window.electronAPI.nlpReady();
    if ($DebugTestMode) {
      console.log("Compromise NLP ready:", isReady);
    }
    return isReady;
  } catch (error) {
    if ($DebugTestMode) {
      console.error("Failed to check NLP status:", error);
    }
    return false;
  }
}

window.toggleListeningMain = function () {
  if ($DebugTestMode) {
    console.log("🎯 toggleListeningMain called, current state:", isListening);
  }

  try {
    if (!isListening) {
      if (typeof startListening === "function") {
        startListening();
      } else {
        throw new Error("startListening function not available");
      }
    } else {
      if (typeof stopListening === "function") {
        stopListening();
      } else {
        throw new Error("stopListening function not available");
      }
    }
  } catch (error) {
    if ($DebugTestMode) {
      console.error("❌ Error in toggleListeningMain:", error);
    }
    isListening = false;
    window.isListening = isListening;
  }
};
async function handleChatMessage(data) {
  if ($DebugTestMode) {
    console.log("💬 === HANDLING CHAT MESSAGE ===");
    console.log("💬 Message data:", data);
    console.log("💬 Message:", data.message);
    console.log("💬 Model:", data.model);

    // Keep all the auth checking logic
    console.log("💬 🔐 Pre-check auth state:");
    console.log(
      "💬 🔐 Current authToken:",
      authToken ? `[${authToken.length} chars]` : "NULL"
    );
    console.log("💬 🔐 Current user:", currentUser?.email || "NULL");
  }

  refreshAuthFromStorage();

  if ($DebugTestMode) {
    console.log("💬 🔐 Post-refresh auth state:");
    console.log(
      "💬 🔐 Updated authToken:",
      authToken ? `[${authToken.length} chars]` : "NULL"
    );
    console.log("💬 🔐 Updated user:", currentUser?.email || "NULL");
  }

  if (!checkAuthentication()) {
    if ($DebugTestMode) {
      console.log("💬 ❌ User not authenticated");
    }
    window.electronAPI.broadcastAIResponse({
      text: "Please sign in to use the AI assistant.",
      type: "Auth Required",
    });
    return;
  }

  if ($DebugTestMode) {
    console.log("💬 ✅ User authenticated, processing chat message");
    console.log(
      "💬 ✅ Final authToken being used:",
      authToken
        ? `[${authToken.length} chars] ${authToken.substring(0, 30)}...`
        : "NULL"
    );
    console.log("💬 Sending thinking indicator");
  }
  // FIXED: Check if there's a specific method for thinking
  if (window.electronAPI.broadcastAIThinking) {
    if ($DebugTestMode) {
      console.log("💬 Using broadcastAIThinking method");
    }
    window.electronAPI.broadcastAIThinking();
  } else {
    if ($DebugTestMode) {
      console.log("💬 Using broadcastAIResponse with thinking flag");
    }
    window.electronAPI.broadcastAIResponse({ thinking: true });
  }

  try {
    if ($DebugTestMode) {
      console.log("💬 Preparing request to backend...");
    }

    // CHANGED: Remove 'action' and 'token' from body, update URL
    // In handleChatMessage function
    const requestBody = {
      message: data.message,
      model: data.model,
      context: data.context || "",
      contextMessages: data.contextMessages || [],
      topicId: data.topicId,
      subtopicId: data.subtopicId,
      token: authToken,
    };

    if ($DebugTestMode) {
      console.log("💬 Request body (with context info):", {
        // Remove: action: requestBody.action,
        messageLength: requestBody.message.length,
        model: requestBody.model,
        contextLength: requestBody.context.length,
        contextMessagesCount: requestBody.contextMessages.length,
        contextPreview: requestBody.contextMessages.map(
          (m) => `${m.role}: ${m.content.substring(0, 50)}...`
        ),
        topicId: requestBody.topicId,
        // Update: token: requestBody.token ? `[TOKEN_PRESENT: ${requestBody.token.substring(0, 20)}...]` : "[NO_TOKEN]",
      });

      // CHANGED: Update URL and add auth header
      console.log(
        "💬 Calling backend API:",
        `${backendUrl}/api/index.php?endpoint=chat`
      );
    }
    const response = await fetch(`${backendUrl}/api/index.php?endpoint=chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(requestBody),
    });

    if ($DebugTestMode) {
      console.log("💬 Backend response status:", response.status);
      console.log("💬 Response headers:", [...response.headers.entries()]);
    }

    // Keep ALL the existing error handling
    if (response.status === 401) {
      if ($DebugTestMode) {
        console.log("💬 ❌ Auth expired, clearing credentials");
      }
      if ($DebugTestMode) {
        console.log(
          "7🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨THE TOKEN AND USER JUST GOT RESET FOR THE LOGIN SYSTEM THIS SHOULD ONLY HAPPEN ON ERROR OR LOGOUT WHICH ISNT EVEN A THING YET🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨"
        );
      }
      localStorage.removeItem("memoria_token");
      localStorage.removeItem("memoria_user");
      authToken = null;
      currentUser = null;
      window.electronAPI.broadcastAIResponse({
        text: "Your session has expired. Please sign in again.",
        type: "Auth Required",
      });
      return;
    }

    if (!response.ok) {
      const errorText = await response.text();
      if ($DebugTestMode) {
        console.error("💬 ❌ Backend error:", response.status, errorText);
      }
      throw new Error(`Backend error: ${response.status} - ${errorText}`);
    }

    const responseText = await response.text();
    if ($DebugTestMode) {
      console.log("💬 Raw response text:", responseText);
      console.log("💬 Response length:", responseText.length);
    }

    let result;
    try {
      result = JSON.parse(responseText);
      if ($DebugTestMode) {
        console.log("💬 Parsed response:", result);

        // Keep ALL the extensive logging
        console.log("💬 🔍 COMPLETE BACKEND RESPONSE ANALYSIS:");
        console.log("  - success:", result.success);
        console.log(
          "  - response text length:",
          result.response ? result.response.length : 0
        );
        console.log("  - has_files:", result.has_files);
        console.log("  - files array:", result.files);
        console.log("  - files is array:", Array.isArray(result.files));
        console.log("  - file_count:", result.file_count);
        console.log("  - model_used:", result.model_used);
        console.log("  - timestamp:", result.timestamp);
        console.log("  - usage_stats:", result.usage_stats);
        console.log("  - debug_info:", result.debug_info);

        if (result.files && Array.isArray(result.files)) {
          result.files.forEach((file, index) => {
            console.log(`  - File ${index + 1}:`, {
              id: file.id,
              filename: file.filename,
              type: file.type,
              size: file.size,
              extension: file.extension,
              contentPreview: file.content
                ? file.content.substring(0, 50) + "..."
                : "NO CONTENT",
            });
          });
        }
      }

      if (result.auth_failure === true) {
        if ($DebugTestMode) {
          console.log("❌ Backend returned auth_failure: true");
        }
        resetAuthentication("Backend authentication failure");
        window.electronAPI.broadcastAIResponse({
          text: "Your session has expired. Please sign in again.",
          type: "Auth Required",
        });
        return;
      }
    } catch (parseError) {
      if ($DebugTestMode) {
        console.error("💬 ❌ Failed to parse JSON:", parseError);
      }
      throw new Error("Invalid JSON response from backend");
    }

    // Keep ALL the response handling logic
    if (
      result.success &&
      (result.response || (result.files && result.files.length > 0))
    ) {
      if ($DebugTestMode) {
        console.log(
          "💬 ✅ Broadcasting COMPLETE AI response with ALL backend data"
        );
      }

      const completeResponse = {
        success: result.success,
        conversation_id: result.conversation_id,
        response: result.response || "",
        model_used: result.model_used || data.model,
        timestamp: result.timestamp || Math.floor(Date.now() / 1000),
        has_files: result.has_files || false,
        files: result.files || [],
        file_count: result.file_count || 0,
        title: result.title || null,
        generateTitle:
          result.generateTitle !== undefined ? result.generateTitle : true,
        new_topic: result.new_topic || false,
        new_subtopic: result.new_subtopic || false,
        message: result.message || {
          role: "assistant",
          content: result.response || "",
          timestamp: result.timestamp || Math.floor(Date.now() / 1000),
        },
        context: result.context || {
          memories_used: 0,
          memories_with_confidence: [],
          file_nodes_used: 0,
          context_plus_enabled: data.context_plus_enabled || false,
          suggested_keywords: [],
        },
        usage: result.usage || {
          tokens_used: 0,
          context_plus_tokens: 0,
          model: data.model,
          total_cost: 0,
          context_plus_cost: 0,
        },
        usage_recorded: result.usage_recorded || null,
        context_plus_cost: result.context_plus_cost || 0,
        memory_created: result.memory_created || null,
        usage_stats: result.usage_stats || null,
        type: "Chat Response",
        text: result.response || "",
      };
      if ($DebugTestMode) {
        console.log("💬 🚀 Final response being broadcast:", {
          hasText: !!completeResponse.text,
          textLength: completeResponse.text.length,
          hasFiles: completeResponse.has_files,
          fileCount: completeResponse.file_count,
          hasTitle: !!completeResponse.title,
          generateTitle: completeResponse.generateTitle,
          newTopic: completeResponse.newTopic,
          newSubtopic: completeResponse.newSubtopic,
        });

        console.log("💬 🚀 About to broadcast this complete response:");
        console.log("💬 🚀 Response keys:", Object.keys(completeResponse));
        console.log("💬 🚀 Has files:", completeResponse.has_files);
        console.log("💬 🚀 File count:", completeResponse.file_count);
        console.log(
          "💬 🚀 Files array length:",
          completeResponse.files ? completeResponse.files.length : 0
        );
      }

      if (window.electronAPI && window.electronAPI.broadcastAIResponse) {
        if ($DebugTestMode) {
          console.log("💬 ✅ broadcastAIResponse function exists");
        }
        window.electronAPI.broadcastAIResponse(completeResponse);
        if ($DebugTestMode) {
          console.log("💬 ✅ broadcastAIResponse called successfully");
        }
      } else {
        if ($DebugTestMode) {
          console.error("💬 ❌ broadcastAIResponse function missing!");
        }
      }
    } else if (result.error) {
      if ($DebugTestMode) {
        console.error("💬 ❌ Backend returned error:", result.error);
      }
      window.electronAPI.broadcastAIResponse({
        text: `Backend error: ${result.error}`,
        type: "Error",
      });
    } else {
      if ($DebugTestMode) {
        console.error("💬 ❌ Unexpected response format:", result);
        console.error(
          "💬 ❌ Missing required fields. Expected: success=true and (response or files)"
        );
      }
      window.electronAPI.broadcastAIResponse({
        text: "Received unexpected response format from backend",
        type: "Error",
      });
    }
  } catch (error) {
    if ($DebugTestMode) {
      console.error("💬 ❌ === CHAT MESSAGE ERROR ===");
      console.error("💬 Error type:", error.name);
      console.error("💬 Error message:", error.message);
      console.error("💬 Error stack:", error.stack);
    }

    let errorMessage = "Sorry, I couldn't process your message right now.";
    if (error.message.includes("Failed to fetch")) {
      errorMessage += "\n\nCannot connect to backend.";
    } else if (error.message.includes("Invalid JSON")) {
      errorMessage += "\n\nBackend returned invalid response.";
    } else {
      errorMessage += "\n\nError: " + error.message;
    }

    window.electronAPI.broadcastAIResponse({
      text: errorMessage,
      type: "Error",
    });
  }

  if ($DebugTestMode) {
    console.log("💬 === END HANDLING CHAT MESSAGE ===");
  }
}

// Initialize everything when the page loads
window.addEventListener("load", async () => {
  if ($DebugTestMode) {
    console.log("🚀 Window loaded, initializing enhanced audio and services");
  }

  refreshAuthFromStorage();
  await getBackendSettings();
  await waitForNLP();

  // Set up LanguageTool event listeners
  if (window.electronAPI?.onLanguageToolProgress) {
    window.electronAPI.onLanguageToolProgress((progress) => {
      if ($DebugTestMode) {
        console.log("📊 LanguageTool progress:", progress);
      }
    });
  }

  if (window.electronAPI?.onLanguageToolReady) {
    window.electronAPI.onLanguageToolReady((status) => {
      if ($DebugTestMode) {
        console.log("✅ LanguageTool ready:", status);
      }
      languageToolReady = true;
    });
  }

  if (window.electronAPI?.onLanguageToolError) {
    window.electronAPI.onLanguageToolError((error) => {
      if ($DebugTestMode) {
        console.error("❌ LanguageTool error:", error);
      }
    });
  }

  if (window.electronAPI?.onLanguageToolInstalled) {
    window.electronAPI.onLanguageToolInstalled((status) => {
      if ($DebugTestMode) {
        console.log("✅ LanguageTool installed:", status);
      }
      languageToolInstalled = true;
    });
  }

  // Check initial LanguageTool status
  if (window.electronAPI?.getLanguageToolStatus) {
    try {
      const status = await window.electronAPI.getLanguageToolStatus();
      if ($DebugTestMode) {
        console.log("🔍 Initial LanguageTool status:", status);
      }
      languageToolInstalled = status.installed;
      languageToolReady = status.running;
    } catch (error) {
      if ($DebugTestMode) {
        console.error("Failed to get initial LanguageTool status:", error);
      }
    }
  }

  // More frequent check for localStorage changes
  setInterval(() => {
    const currentStorageToken = localStorage.getItem("memoria_token");
    const currentStorageUser = localStorage.getItem("memoria_user");

    const tokenChanged = currentStorageToken !== authToken;
    const userChanged =
      currentStorageUser !== (currentUser ? JSON.stringify(currentUser) : null);

    if (tokenChanged || userChanged) {
      if ($DebugTestMode) {
        console.log("🔐 Detected auth update from other window, refreshing");
      }
      refreshAuthFromStorage();
    }
  }, 1000);

  // Create audio worker
  try {
    audioWorker = new Worker("audio-worker.js");
    window.audioWorker = audioWorker;
    if ($DebugTestMode) {
      console.log("🚀 Audio worker created");
    }
  } catch (error) {
    if ($DebugTestMode) {
      console.error("🚀 ❌ Failed to create audio worker:", error);
    }
  }

  // Test backend connectivity first
  //testBackendConnection();

  try {
    // Test IPC first
    if ($DebugTestMode) {
      console.log("🚀 Testing IPC communication...");
    }
    try {
      const testResult = await window.electronAPI.testIPC();
      if ($DebugTestMode) {
        console.log("🚀 IPC test result:", testResult);
      }
    } catch (testError) {
      if ($DebugTestMode) {
        console.error("🚀 ❌ IPC test failed:", testError);
      }
    }

    audioContext = new (window.AudioContext || window.webkitAudioContext)({
      sampleRate: 16000,
    });
    if ($DebugTestMode) {
      console.log("🚀 Audio context created");
    }

    // Initialize Vosk but don't block on it
    initializeVosk()
      .then(() => {
        if ($DebugTestMode) {
          console.log(
            "🚀 Vosk initialization completed, voskReady:",
            voskReady
          );
        }
      })
      .catch((error) => {
        if ($DebugTestMode) {
          console.error("🚀 ❌ Vosk initialization failed:", error);
        }
      });

    // Set up Vosk transcription listener
    if (window.electronAPI?.onVoskTranscription) {
      if ($DebugTestMode) {
        console.log("🚀 Setting up Vosk transcription listener");
      }
      // ADD/FIX this in main-renderer.js window.addEventListener("load") section:
      window.electronAPI.onVoskTranscription((data) => {
        if ($DebugTestMode) {
          console.log("🎵 VOSK RESULT RECEIVED:", data.type, data.text);
          console.log("🎵 Full Vosk data:", data); // ✅ ADD THIS LINE
        }

        if (data.text && data.text.trim().length > 0) {
          // ✅ CRITICAL: Make sure this calls handleTranscript
          if (data.type === "partial") {
            if (!currentPartialTranscriptId) {
              currentPartialTranscriptId = Date.now().toString();
              handleTranscript(data.text, true, currentPartialTranscriptId);
            } else {
              updateTranscript(currentPartialTranscriptId, data.text);
            }
          } else if (data.type === "final") {
            if ($DebugTestMode) {
              console.log("🎵 ✅ FINAL TRANSCRIPT:", data.text); // ✅ ADD THIS
            }
            currentPartialTranscriptId = null; // Reset partial ID
            handleTranscript(data.text, false); // ✅ This sends to transcript window
          }
        }
      });
    } else {
      if ($DebugTestMode) {
        console.error("🚀 ❌ onVoskTranscription not available in electronAPI");
      }
    }

    // Set up the chat message listener
    if ($DebugTestMode) {
      console.log("🚀 Setting up chat message listener");
    }
    if (window.electronAPI?.onProcessChatMessage) {
      window.electronAPI.onProcessChatMessage((data) => {
        if ($DebugTestMode) {
          console.log("💬 Chat message received from IPC:", data);
        }
        handleChatMessage(data);
      });
      if ($DebugTestMode) {
        console.log("🚀 ✅ Chat message listener set up successfully");
      }
    } else {
      if ($DebugTestMode) {
        console.error(
          "🚀 ❌ onProcessChatMessage not available in electronAPI"
        );
      }
    }

    // FIXED: Set up enhanced auth listeners
    if ($DebugTestMode) {
      console.log("🚀 Setting up auth listeners");
    }

    // Listen for auth state changes
    if (window.electronAPI?.onAuthStateChanged) {
      window.electronAPI.onAuthStateChanged((authData) => {
        if ($DebugTestMode) {
          console.log("🔐 Auth state changed in main-renderer:", authData);
        }
        if (authData.isAuthenticated) {
          authToken = authData.token;
          currentUser = authData.user;
          localStorage.setItem("memoria_token", authData.token);
          localStorage.setItem("memoria_user", JSON.stringify(authData.user));
          if ($DebugTestMode) {
            console.log(
              "🔐 ✅ Updated auth in main-renderer:",
              currentUser.email
            );
          }
        } else {
          authToken = null;
          currentUser = null;
          if ($DebugTestMode) {
            console.log(
              "6🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨THE TOKEN AND USER JUST GOT RESET FOR THE LOGIN SYSTEM THIS SHOULD ONLY HAPPEN ON ERROR OR LOGOUT WHICH ISNT EVEN A THING YET🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨"
            );
          }
          localStorage.removeItem("memoria_token");
          localStorage.removeItem("memoria_user");
          if ($DebugTestMode) {
            console.log("🔐 ❌ Cleared auth in main-renderer");
          }
        }
      });
    }

    if (window.electronAPI?.onAuthSuccess) {
      window.electronAPI.onAuthSuccess((userData) => {
        if ($DebugTestMode) {
          console.log("🔐 Auth success received:", userData);
        }
        authToken = userData.token;
        currentUser = userData.user;
        localStorage.setItem("memoria_token", userData.token);
        localStorage.setItem("memoria_user", JSON.stringify(userData.user));
        if ($DebugTestMode) {
          console.log(
            "🔐 ✅ Auth success processed in main-renderer:",
            currentUser.email
          );
        }
      });
    }

    /* if (window.electronAPI?.onAuthStateUpdated) {
      window.electronAPI.onAuthStateUpdated((authState) => {
        if ($DebugTestMode) {
          console.log("🔐 Auth state updated:", authState);
          console.log(
            "🔐 Auth state isAuthenticated:",
            authState.isAuthenticated
          );
          console.log(
            "🔐 Auth state token length:",
            authState.token ? `[${authState.token.length} chars]` : "NULL"
          );
          console.log("this is the authState.token:", authState.token);
          console.log(
            "🔐 Auth state user:",
            authState.user ? authState.user.email : "NULL"
          );
          console.log("this is the authState.user:", authState.user);
        }
        if (authState.isAuthenticated) {
          authToken = authState.token;
          currentUser = authState.user;
          localStorage.setItem("memoria_token", authState.token);
          localStorage.setItem("memoria_user", JSON.stringify(authState.user));
          if ($DebugTestMode) {
            console.log(
              "🔐 ✅ Auth state updated in main-renderer:",
              currentUser.email
            );
          }
        } else {
          authToken = null;
          currentUser = null;
          console.log(
            "5🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨THE TOKEN AND USER JUST GOT RESET FOR THE LOGIN SYSTEM THIS SHOULD ONLY HAPPEN ON ERROR OR LOGOUT WHICH ISNT EVEN A THING YET🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨"
          );
          localStorage.removeItem("memoria_token");
          localStorage.removeItem("memoria_user");
          if ($DebugTestMode) {
            console.log(
              "🔐 ❌ Auth cleared from state update in main-renderer"
            );
          }
        }
      });
    }*/

    window.startListening = startListening;
    window.stopListening = stopListening;
    window.processScreenshot = processScreenshot;
    window.isListening = isListening;

    if ($DebugTestMode) {
      console.log("🚀 ✅ All functions ready");
    }
  } catch (error) {
    if ($DebugTestMode) {
      console.error("🚀 ❌ Init error:", error);
    }
  }
});

// Enhanced localStorage listener
window.addEventListener("storage", (e) => {
  if (e.key === "memoria_token" || e.key === "memoria_user") {
    if ($DebugTestMode) {
      console.log("🔐 Storage change detected in main-renderer, key:", e.key);
      console.log(
        "🔐 Old value:",
        e.oldValue
          ? e.key === "memoria_token"
            ? `[${e.oldValue.length} chars]`
            : "USER_DATA"
          : "NULL"
      );
      console.log(
        "🔐 New value:",
        e.newValue
          ? e.key === "memoria_token"
            ? `[${e.newValue.length} chars]`
            : "USER_DATA"
          : "NULL"
      );
    }

    // Force refresh
    refreshAuthFromStorage();
  }
});

// Test backend connection
async function testBackendConnection() {
  if ($DebugTestMode) {
    console.log("🌐 Testing backend connection to:", `${backendUrl}/api.php`);
  }

  try {
    const response = await fetch(`${backendUrl}/api.php`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "test",
      }),
    });

    if (!response.ok) {
      if ($DebugTestMode) {
        console.error(
          "🌐 ❌ Backend test failed - HTTP status:",
          response.status
        );
        console.error("🌐 Response text:", await response.text());
      }
      alert(
        `Backend connection failed! Status: ${response.status}\nMake sure api.php is accessible at: ${backendUrl}/api.php`
      );
      return;
    }

    const data = await response.json();
    if ($DebugTestMode) {
      console.log("🌐 ✅ Backend test successful:", data);
    }
  } catch (error) {
    if ($DebugTestMode) {
      console.error("🌐 ❌ Backend connection test error:", error);
    }
    alert(
      `Cannot connect to backend at ${backendUrl}/api.php\nError: ${error.message}\n\nMake sure:\n1. Your web server (XAMPP/WAMP) is running\n2. api.php is in the correct location\n3. The URL is correct`
    );
  }
}

// Initialize Vosk
async function initializeVosk() {
  try {
    if ($DebugTestMode) {
      console.log("Initializing Vosk via Python bridge...");
      console.log("electronAPI available?", !!window.electronAPI);
      console.log(
        "initVosk function available?",
        typeof window.electronAPI?.initVosk
      );
    }

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error("Vosk initialization timeout after 10s")),
        10000
      )
    );

    const initPromise = window.electronAPI.initVosk();
    const result = await Promise.race([initPromise, timeoutPromise]);

    if ($DebugTestMode) {
      console.log("Vosk init result:", result);
    }

    if (result && result.success) {
      voskReady = true;
      if ($DebugTestMode) {
        console.log("Vosk initialized successfully");
      }
      //document.getElementById("statusText").textContent = "Ready";
    } else {
      throw new Error(result?.error || "Unknown error");
    }
  } catch (error) {
    if ($DebugTestMode) {
      console.error("Failed to initialize Vosk:", error);
      console.error("Error details:", error.message, error.stack);
    }
    //document.getElementById("statusText").textContent = "Vosk init failed";
    voskReady = false;

    // Show more helpful error message
    if (error.message.includes("Python")) {
      alert(
        "Python is not installed or not in PATH. Please install Python 3.x"
      );
    } else if (error.message.includes("vosk")) {
      alert("Vosk Python module not installed. Please run: pip install vosk");
    } else if (error.message.includes("model")) {
      alert(
        "Vosk model not found. Please download vosk-model-small-en-us-0.15 and extract to models/ folder"
      );
    }
  }
}

// FIXED: Replace these functions in your main-renderer.js (keeping original names)

async function startListening() {
  if ($DebugTestMode) {
    console.log("🎯 CRASH-SAFE startListening starting...");
  }

  // ✅ GUARD: Prevent multiple concurrent starts
  if (window.audioStarting || isListening) {
    if ($DebugTestMode) {
      console.warn("⚠️ Audio already starting or active - aborting");
    }
    return;
  }

  // ✅ SET FLAG: Prevent concurrent starts
  window.audioStarting = true;

  // ✅ TIMEOUT: Force cleanup if hanging
  const emergencyTimeout = setTimeout(() => {
    if ($DebugTestMode) {
      console.error(
        "❌ EMERGENCY: Audio startup hung for 15 seconds - force cleanup"
      );
    }
    window.audioStarting = false;
    isListening = false;
    window.isListening = false;
    emergencyCleanup();
    broadcastListeningState(false, "❌ Startup timeout");
  }, 15000);

  try {
    broadcastListeningState(false, "🔧 Initializing...");

    // ✅ STEP 1: Clean slate
    await emergencyCleanup();
    if ($DebugTestMode) {
      console.log("✅ Step 1: Emergency cleanup completed");
    }

    broadcastListeningState(false, "🎵 Getting enhanced audio...");

    // ✅ STEP 2: Get enhanced audio stream (system + microphone)
    if ($DebugTestMode) {
      console.log(
        "🎤 Using captureSystemAudioFixed for enhanced audio capture..."
      );
    }

    let audioStream = null;
    let audioMethod = "Enhanced Audio (System + Microphone)";

    try {
      // Use the enhanced audio capture function
      audioStream = await Promise.race([
        captureSystemAudioFixed(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Enhanced audio timeout")), 10000)
        ),
      ]);

      if (audioStream && audioStream.getAudioTracks().length > 0) {
        if ($DebugTestMode) {
          console.log("✅ Enhanced audio capture successful");
          console.log("🎵 Audio tracks:", audioStream.getAudioTracks().length);

          // Log details about the captured audio
          const audioTrack = audioStream.getAudioTracks()[0];
          console.log("🎵 Audio track label:", audioTrack.label);
          console.log("🎵 Audio track state:", audioTrack.readyState);
        }
      } else {
        throw new Error("Enhanced audio capture returned no valid stream");
      }
    } catch (enhancedError) {
      if ($DebugTestMode) {
        console.error(
          "❌ Enhanced audio capture failed:",
          enhancedError.message
        );
      }
      throw new Error(
        `Enhanced audio capture failed: ${enhancedError.message}`
      );
    }

    // ✅ VALIDATE: Ensure we have a valid stream
    if (!audioStream || audioStream.getTracks().length === 0) {
      throw new Error("No valid audio stream obtained from enhanced capture");
    }

    if ($DebugTestMode) {
      console.log("✅ Step 2: Enhanced audio stream obtained");
    }
    broadcastListeningState(false, "🔧 Setting up processing...");

    // ✅ STEP 3: Setup audio processing with crash protection
    try {
      await setupSimpleAudioProcessing(audioStream);
      if ($DebugTestMode) {
        console.log("✅ Step 3: Audio processing setup completed");
      }
    } catch (processingError) {
      if ($DebugTestMode) {
        console.error("❌ Audio processing setup failed:", processingError);
      }

      // ✅ CLEANUP: Stop stream before throwing
      audioStream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (e) {
          if ($DebugTestMode) {
            console.warn("Error stopping track during cleanup:", e);
          }
        }
      });

      throw new Error(
        `Audio processing setup failed: ${processingError.message}`
      );
    }

    // ✅ STEP 4: Ensure Vosk is properly initialized and ready
    try {
      if ($DebugTestMode) {
        console.log("🎵 Ensuring Vosk is ready for transcription...");
      }

      // First ensure Vosk is initialized
      if (!voskReady) {
        if ($DebugTestMode) {
          console.log("🎵 Initializing Vosk first...");
        }
        const initResult = await Promise.race([
          window.electronAPI.initVosk(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Vosk init timeout")), 10000)
          ),
        ]);

        if (initResult && initResult.success) {
          voskReady = true;
          if ($DebugTestMode) {
            console.log("✅ Vosk initialized successfully");
          }
        } else {
          throw new Error(initResult?.error || "Vosk initialization failed");
        }
      }

      // Then start the session
      if (window.electronAPI?.startVoskSession) {
        if ($DebugTestMode) {
          console.log("🎵 Starting Vosk transcription session...");
        }
        const voskResult = await Promise.race([
          window.electronAPI.startVoskSession(),
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error("Vosk session start timeout")),
              5000
            )
          ),
        ]);

        if (voskResult && voskResult.success) {
          if ($DebugTestMode) {
            console.log("✅ Vosk session started successfully");
          }
        } else {
          throw new Error(voskResult?.error || "Vosk session start failed");
        }
      } else {
        throw new Error("startVoskSession not available in electronAPI");
      }
    } catch (voskError) {
      if ($DebugTestMode) {
        console.warn("⚠️ Vosk setup failed (non-critical):", voskError.message);
        if (voskError.message.includes("timeout")) {
          console.warn(
            "⚠️ This might be due to Python/Vosk not being installed properly"
          );
        }
      }
      // Don't fail the entire startup for Vosk issues
    }

    // ✅ SUCCESS: Clear timeout and set flags
    clearTimeout(emergencyTimeout);
    window.audioStarting = false;
    isListening = true;
    window.isListening = true;

    if ($DebugTestMode) {
      console.log("🎉 CRASH-SAFE startup completed successfully!");
    }
    broadcastListeningState(true, `🎵 ${audioMethod} active`);
  } catch (error) {
    if ($DebugTestMode) {
      console.error("❌ CRASH-SAFE startup failed:", error);
    }

    // ✅ CLEANUP: Ensure all cleanup happens
    clearTimeout(emergencyTimeout);
    window.audioStarting = false;
    isListening = false;
    window.isListening = false;

    await emergencyCleanup();
    broadcastListeningState(false, `❌ Error: ${error.message}`);

    // ✅ USER FEEDBACK: Show appropriate error messages
    if (error.message.includes("Permission denied")) {
      alert(
        "❌ Audio permission denied. Please allow audio access and try again."
      );
    } else if (error.message.includes("NotFoundError")) {
      alert(
        "❌ No audio devices found. Please connect audio devices and try again."
      );
    } else if (error.message.includes("timeout")) {
      alert("❌ Audio startup timed out. Please try again.");
    } else {
      alert(`❌ Failed to start listening: ${error.message}`);
    }
  }
}

// 🔧 CRITICAL FIX: Audio format for Vosk in main-renderer.js
// Replace your setupSimpleAudioProcessing function with this one

async function setupSimpleAudioProcessing(inputStream) {
  if ($DebugTestMode) {
    console.log("🔧 Setting up VOSK-COMPATIBLE audio processing...");
  }

  if (!inputStream || inputStream.getTracks().length === 0) {
    throw new Error("Invalid input stream provided");
  }

  let audioContext = null;
  let source = null;
  let processor = null;
  let gainNode = null;

  try {
    // ✅ CRITICAL FIX: Create audio context with EXACT Vosk requirements
    if ($DebugTestMode) {
      console.log("🔧 Creating audio context with Vosk-compatible settings...");
    }
    audioContext = new (window.AudioContext || window.webkitAudioContext)({
      sampleRate: 16000, // ✅ VOSK REQUIREMENT: 16kHz
      latencyHint: "interactive",
    });

    // ✅ CRITICAL: Force audio context to 16kHz if it's not already
    if (audioContext.sampleRate !== 16000) {
      if ($DebugTestMode) {
        console.warn(
          `⚠️ Audio context sample rate is ${audioContext.sampleRate}, not 16000. This may cause Vosk issues.`
        );
      }
    } else if ($DebugTestMode) {
      console.log("✅ Audio context sample rate: 16000 Hz (Vosk compatible)");
    }

    // Audio context state management
    audioContext.onstatechange = () => {
      if ($DebugTestMode) {
        console.log("🔧 Audio context state changed to:", audioContext.state);
      }
      if (audioContext.state === "suspended") {
        if ($DebugTestMode) {
          console.log("🔧 Audio context suspended, resuming...");
        }
        audioContext
          .resume()
          .then(() => {
            if ($DebugTestMode) {
              console.log("✅ Audio context resumed successfully");
            }
          })
          .catch((err) => {
            if ($DebugTestMode) {
              console.error("❌ Failed to resume audio context:", err);
            }
          });
      }
    };

    if (audioContext.state === "suspended") {
      if ($DebugTestMode) {
        console.log("🔧 Resuming suspended audio context...");
      }
      await audioContext.resume();
    }

    // ✅ CRITICAL: Keep audio tracks active
    inputStream.getAudioTracks().forEach((track) => {
      if ($DebugTestMode) {
        console.log(
          "🔧 Audio track state:",
          track.readyState,
          "enabled:",
          track.enabled
        );
        console.log("🔧 Audio track label:", track.label);
        console.log("🔧 Audio track settings:", track.getSettings());
      }

      // Prevent track from being stopped
      track.onended = () => {
        if ($DebugTestMode) {
          console.error("❌ CRITICAL: Audio track ended unexpectedly!");
          console.error("❌ Track state:", track.readyState);
          console.error("❌ Track enabled:", track.enabled);
        }
        setTimeout(() => {
          if ($DebugTestMode) {
            console.log("🔄 Attempting to restart audio after track end...");
          }
          startListening();
        }, 1000);
      };

      if ($DebugTestMode) {
        track.onmute = () => console.warn("⚠️ Audio track muted");
        track.onunmute = () => console.log("✅ Audio track unmuted");
      }
    });

    // Create media stream source
    if ($DebugTestMode) {
      console.log("🔧 Creating media stream source...");
    }
    source = audioContext.createMediaStreamSource(inputStream);

    // ✅ CRITICAL FIX: Create MONO audio processing for Vosk
    if ($DebugTestMode) {
      console.log("🔧 Creating MONO audio processing chain for Vosk...");
    }

    // Create script processor - MONO output for Vosk
    processor = audioContext.createScriptProcessor(4096, 1, 1); // ✅ 1 input, 1 output (mono)
    gainNode = audioContext.createGain();
    gainNode.gain.value = 1.0;

    // ✅ ENHANCED: Vosk-compatible audio processing
    let processedSamples = 0;
    let lastProcessTime = Date.now();
    let successfulSends = 0;
    let failedSends = 0;
    let silentSamples = 0;

    processor.onaudioprocess = function (audioProcessingEvent) {
      try {
        const inputBuffer = audioProcessingEvent.inputBuffer;
        const inputData = inputBuffer.getChannelData(0); // Float32Array

        // ✅ CRITICAL FIX: Proper resampling from 48kHz to 16kHz
        const inputSampleRate = audioContext.sampleRate;
        const outputSampleRate = 16000;

        let resampledData;
        if (inputSampleRate !== outputSampleRate) {
          const ratio = inputSampleRate / outputSampleRate;
          const outputLength = Math.floor(inputData.length / ratio);
          resampledData = new Float32Array(outputLength);

          for (let i = 0; i < outputLength; i++) {
            const inputIndex = Math.floor(i * ratio);
            resampledData[i] = inputData[inputIndex];
          }
        } else {
          resampledData = inputData;
        }

        // ✅ CRITICAL FIX: Convert Float32 to Int16 PCM
        const pcmData = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const sample = Math.max(-1, Math.min(1, inputData[i]));
          pcmData[i] = sample < 0 ? sample * 32768 : sample * 32767;
        }

        // ✅ CRITICAL FIX: Send as ArrayBuffer, not Array
        if (window.electronAPI?.sendAudioToVosk) {
          // Send the ArrayBuffer directly
          window.electronAPI.sendAudioToVosk(pcmData.buffer);
        }

        // Enhanced logging
        if ($DebugTestMode) {
          const audioLevel = Math.sqrt(
            resampledData.reduce((sum, sample) => sum + sample * sample, 0) /
              resampledData.length
          );

          if (audioLevel > 0.001) {
            console.log(
              `🎤 ${
                window.currentAudioSourceType || "UNKNOWN"
              } AUDIO: Level=${audioLevel.toFixed(6)}, PCM16_Length=${
                pcmData.length
              }, Max_PCM=${Math.max(...pcmData.map(Math.abs))}`
            );
          }
        }
      } catch (error) {
        if ($DebugTestMode) {
          console.error("❌ Audio processing error:", error);
        }
      }
    };

    // Connect the processing chain
    source.connect(gainNode);
    gainNode.connect(processor);
    processor.connect(audioContext.destination); // Keep processor active

    // ✅ CRITICAL: Add keep-alive mechanisms
    window.audioKeepAliveInterval = setInterval(() => {
      if (audioContext && audioContext.state !== "closed") {
        if (audioContext.state === "suspended") {
          if ($DebugTestMode) {
            console.log("🔄 Resuming suspended audio context (keep-alive)");
          }
          audioContext.resume();
        }
      }
    }, 1000);

    window.trackKeepAliveInterval = setInterval(() => {
      inputStream.getAudioTracks().forEach((track, index) => {
        if (track.readyState !== "live") {
          if ($DebugTestMode) {
            console.error(
              `❌ Keep-alive check: Track ${index} is ${track.readyState}`
            );
          }
        } else {
          track.enabled = track.enabled; // Touch the property
        }
      });
    }, 2000);

    // Store references for cleanup
    window.audioContext = audioContext;
    window.audioProcessor = processor;
    window.audioSource = source;
    window.audioGain = gainNode;
    window.currentAudioStream = inputStream;

    if ($DebugTestMode) {
      console.log(
        "✅ Vosk-compatible MONO PCM16 audio processing created successfully"
      );
    }
  } catch (error) {
    if ($DebugTestMode) {
      console.error("❌ Vosk audio processing setup failed:", error);
    }

    // Cleanup on error
    if (processor) {
      try {
        processor.disconnect();
        processor.onaudioprocess = null;
      } catch (e) {}
    }
    if (gainNode) {
      try {
        gainNode.disconnect();
      } catch (e) {}
    }
    if (source) {
      try {
        source.disconnect();
      } catch (e) {}
    }
    if (audioContext && audioContext.state !== "closed") {
      try {
        await audioContext.close();
      } catch (e) {}
    }

    throw error;
  }
}
async function emergencyCleanup() {
  if ($DebugTestMode) {
    console.log("🛑 ENHANCED emergency cleanup...");
  }

  // Reset flags
  isListening = false;
  window.isListening = false;

  // ✅ CRITICAL: Clear keep-alive intervals
  if (window.audioKeepAliveInterval) {
    clearInterval(window.audioKeepAliveInterval);
    window.audioKeepAliveInterval = null;
    if ($DebugTestMode) {
      console.log("🛑 Cleared audio keep-alive interval");
    }
  }

  if (window.trackKeepAliveInterval) {
    clearInterval(window.trackKeepAliveInterval);
    window.trackKeepAliveInterval = null;
    if ($DebugTestMode) {
      console.log("🛑 Cleared track keep-alive interval");
    }
  }

  // Stop processing interval
  if (window.processingInterval) {
    clearInterval(window.processingInterval);
    window.processingInterval = null;
  }

  // Disconnect processor
  if (window.audioProcessor) {
    try {
      window.audioProcessor.disconnect();
      window.audioProcessor.onaudioprocess = null;
    } catch (e) {
      if ($DebugTestMode) {
        console.warn("⚠️ Processor cleanup error:", e);
      }
    }
    window.audioProcessor = null;
  }

  // Disconnect gain node
  if (window.audioGain) {
    try {
      window.audioGain.disconnect();
    } catch (e) {
      if ($DebugTestMode) {
        console.warn("⚠️ Gain node cleanup error:", e);
      }
    }
    window.audioGain = null;
  }

  // Disconnect source
  if (window.audioSource) {
    try {
      window.audioSource.disconnect();
    } catch (e) {
      if ($DebugTestMode) {
        console.warn("⚠️ Source cleanup error:", e);
      }
    }
    window.audioSource = null;
  }

  // Close audio context
  if (window.audioContext) {
    try {
      if (window.audioContext.state !== "closed") {
        await window.audioContext.close();
      }
    } catch (e) {
      if ($DebugTestMode) {
        console.warn("⚠️ Audio context cleanup error:", e);
      }
    }
    window.audioContext = null;
  }

  // Stop streams
  if (window.currentAudioStream) {
    try {
      window.currentAudioStream.getTracks().forEach((track) => {
        try {
          if ($DebugTestMode) {
            console.log(
              `🛑 Stopping track: ${track.label} (${track.readyState})`
            );
          }
          track.stop();
        } catch (trackError) {
          if ($DebugTestMode) {
            console.warn(`⚠️ Track stop error:`, trackError);
          }
        }
      });
    } catch (e) {
      if ($DebugTestMode) {
        console.warn("⚠️ Stream cleanup error:", e);
      }
    }
    window.currentAudioStream = null;
  }

  if ($DebugTestMode) {
    console.log("✅ Enhanced emergency cleanup completed");
  }
}
// In the main Electron process, it would probably:
async function startVoskSession() {
  try {
    if ($DebugTestMode) {
      console.log("Creating new Vosk recognizer instance...");
    }

    // Create a new Vosk recognizer instance for this session
    const recognizer = new vosk.Recognizer({
      model: voskModel,
      sampleRate: 16000,
    });

    if ($DebugTestMode) {
      console.log("Recognizer created. Resetting session state...");
    }

    // Reset any previous session state
    recognizer.reset();

    const sessionId = generateSessionId();

    if ($DebugTestMode) {
      console.log("Session started successfully. Session ID:", sessionId);
    }

    return { success: true, sessionId };
  } catch (error) {
    if ($DebugTestMode) {
      console.error("Error in Vosk session initialization:", error.message);
    }
    return { success: false, error: error.message };
  }
}

function broadcastListeningState(newState, status = null) {
  if ($DebugTestMode) {
    console.log("📡 Broadcasting state:", newState, "Status:", status);
  }

  isListening = newState;
  window.isListening = newState;

  // Update control bar UI immediately
  const btn = document.getElementById("listenBtn");
  //const statusDot = document.getElementById("statusDot");
  // const statusText = document.getElementById("statusText");

  if (btn) {
    if (newState) {
      btn.textContent = "⏸ Stop";
      btn.classList.add("active");

      if ($DebugTestMode) {
        console.log("UI: Button updated to STOP state");
      }
    } else {
      btn.textContent = "▶ Listen";
      btn.classList.remove("active");

      if ($DebugTestMode) {
        console.log("UI: Button updated to LISTEN state");
      }
    }
  } else if ($DebugTestMode) {
    console.warn("UI: Listen button not found");
  }

  /*if (statusDot) {
    if (newState) {
      statusDot.classList.add("active");

      if ($DebugTestMode) {
        console.log("UI: Status dot activated");
      }
    } else {
      statusDot.classList.remove("active");

      if ($DebugTestMode) {
        console.log("UI: Status dot deactivated");
      }
    }
  } else if ($DebugTestMode) {
    console.warn("UI: Status dot not found");
  }

  if (statusText) {
    const displayStatus = status || (newState ? "🎤 Listening..." : "Ready");
    statusText.textContent = displayStatus;

    if ($DebugTestMode) {
      console.log(`UI: Status text set to "${displayStatus}"`);
    }
  } else if ($DebugTestMode) {
    console.warn("UI: Status text element not found");
  }*/

  // Broadcast to other windows
  const event = new CustomEvent("listeningStateChanged", {
    detail: {
      isListening: newState,
      status: status || (newState ? "🎤 Listening..." : "Ready"),
      timestamp: Date.now(),
    },
  });

  if ($DebugTestMode) {
    console.log("Dispatching listeningStateChanged event:", event.detail);
  }

  window.dispatchEvent(event);
}

// CRASH-SAFE cleanup function
async function crashSafeCleanup() {
  if ($DebugTestMode) {
    console.log("🛑 Starting crash-safe cleanup...");
  }

  try {
    // Stop processing interval
    if (window.processingInterval) {
      clearInterval(window.processingInterval);
      window.processingInterval = null;
    }

    // Disconnect audio processor
    if (window.audioProcessor) {
      try {
        window.audioProcessor.disconnect();
      } catch (error) {
        if ($DebugTestMode) {
          console.warn("⚠️ Error disconnecting processor:", error);
        }
      }
      window.audioProcessor = null;
    }

    // Close audio context
    if (window.audioContext) {
      try {
        if (window.audioContext.state !== "closed") {
          await window.audioContext.close();
        }
      } catch (error) {
        if ($DebugTestMode) {
          console.warn("⚠️ Error closing audio context:", error);
        }
      }
      window.audioContext = null;
    }

    if (window.currentStream) {
      try {
        window.currentStream.getTracks().forEach((track) => {
          try {
            if ($DebugTestMode) {
              console.log(`🛑 Stopping track: ${track.label}`);
            }
            track.stop();
          } catch (trackError) {
            if ($DebugTestMode) {
              console.warn(`Error stopping track ${track.label}:`, trackError);
            }
          }
        });
      } catch (error) {
        if ($DebugTestMode) {
          console.warn("⚠️ Error stopping streams:", error);
        }
      }
      window.currentStream = null; // FIXED: Correct variable name
    }
    // Enhanced audio capture cleanup
    if (globalAudioCapture) {
      try {
        globalAudioCapture.stop();
      } catch (error) {
        if ($DebugTestMode) {
          console.warn("⚠️ Error stopping enhanced capture:", error);
        }
      }
    }

    // Cleanup Vosk
    if (window.electronAPI?.cleanupVosk) {
      try {
        await window.electronAPI.cleanupVosk();
      } catch (error) {
        if ($DebugTestMode) {
          console.warn("⚠️ Error cleaning up Vosk:", error);
        }
      }
    }

    if ($DebugTestMode) {
      console.log("✅ Crash-safe cleanup completed");
    }
  } catch (error) {
    if ($DebugTestMode) {
      console.error("❌ Cleanup error:", error);
    }
  }
}

async function stopListening() {
  if ($DebugTestMode) {
    console.log("🛑 CRASH-SAFE stopListening");
  }

  await emergencyCleanup();
  broadcastListeningState(false, "Ready");

  if ($DebugTestMode) {
    console.log("✅ Listening stopped safely");
  }
}

// Helper function to reset listening button state
function resetListeningButton() {
  const btn = document.getElementById("listenBtn");
  //const statusDot = document.getElementById("statusDot");
  //  const statusText = document.getElementById("statusText");

  if (btn) {
    isListening = false;
    btn.textContent = "▶ Listen";
    btn.classList.remove("active");
    window.isListening = isListening;
  }

  /*if (statusDot) {
    statusDot.classList.remove("active");
  }

 if (statusText) {
    statusText.textContent = "Ready";
  }*/

  if ($DebugTestMode) {
    console.log("info", "Listening button reset");
  }
}

function isQuestionWithContext(currentText, recentHistory = []) {
  const normalizedCurrent = normalizePunctuation(currentText);

  // First check current text alone
  if (isQuestion(normalizedCurrent)) {
    return true;
  }

  // Skip context analysis for very short current text
  if (normalizedCurrent.split(/\s+/).length < 2) {
    return false;
  }

  // Create sliding window of recent context (last 3 segments)
  const contextWindow = recentHistory
    .slice(-3)
    .filter((item) => item && item.text && item.text.trim().length > 0)
    .map((item) => normalizePunctuation(item.text));

  if (contextWindow.length === 0) {
    return false;
  }

  // Test different combinations
  const testCombinations = [
    // Just current with immediate previous
    contextWindow.slice(-1).concat(normalizedCurrent).join(" "),
    // Current with last 2 segments
    contextWindow.slice(-2).concat(normalizedCurrent).join(" "),
    // Full window if available
    contextWindow.length >= 2
      ? contextWindow.concat(normalizedCurrent).join(" ")
      : null,
  ].filter(Boolean);

  for (const combined of testCombinations) {
    const combinedWords = combined.split(/\s+/).filter((w) => w.length > 0);

    // Need reasonable length for context questions
    if (combinedWords.length >= 5 && combinedWords.length <= 25) {
      if (isQuestion(combined)) {
        if ($DebugTestMode) {
          console.log("🔍 Context question detected:", combined);
        }
        return true;
      }
    }
  }

  return false;
}

// ✅ ADD: Rate limiting for IPC messages
const ipcRateLimiter = {
  lastSent: {},
  minInterval: 100, // Minimum 100ms between same message types

  canSend(messageType) {
    const now = Date.now();
    const lastTime = this.lastSent[messageType] || 0;

    if (now - lastTime >= this.minInterval) {
      this.lastSent[messageType] = now;
      return true;
    }
    return false;
  },
};

function handleTranscript(transcript, isPartial = false, transcriptId = null) {
  if ($DebugTestMode) {
    console.log("=== HANDLE TRANSCRIPT ===");
    console.log("Original transcript:", transcript);
    console.log("Is partial:", isPartial);
    console.log("Transcript ID:", transcriptId);
  }

  // Rate limiting for partials
  if (isPartial && !ipcRateLimiter.canSend("partial-transcript")) {
    return;
  }

  if (transcript && transcript.trim().length > 0) {
    const currentTime = Date.now();

    // Clear silence timer
    if (silenceTimer) {
      clearTimeout(silenceTimer);
      silenceTimer = null;
    }

    // Duplicate filtering for finals only
    if (!isPartial) {
      if (
        window.lastTranscript === transcript &&
        currentTime - window.lastTranscriptTime < 2000
      ) {
        if ($DebugTestMode) {
          console.log("Duplicate transcript ignored:", transcript);
        }
        return;
      }
    }

    // Rate limiting for broadcasts
    if (!ipcRateLimiter.canSend("broadcast-transcript")) {
      return;
    }

    // Apply punctuation normalization
    let processedTranscript = normalizePunctuation(transcript);
    let originalTranscript = transcript;

    // Enhanced question detection using recent context
    let isQuestionResult = false;
    if (!isPartial) {
      // Build recent context from last few transcripts
      const recentContext = recentTranscripts
        .filter((t) => currentTime - t.timestamp < CONTEXT_WINDOW_MS)
        .slice(-TRANSCRIPT_HISTORY_SIZE);

      isQuestionResult = isQuestionWithContext(
        processedTranscript,
        recentContext
      );

      // Add current to recent history
      recentTranscripts.push({
        text: processedTranscript,
        timestamp: currentTime,
        isQuestion: isQuestionResult,
      });

      // Keep recent history manageable
      if (recentTranscripts.length > TRANSCRIPT_HISTORY_SIZE * 2) {
        recentTranscripts = recentTranscripts.slice(-TRANSCRIPT_HISTORY_SIZE);
      }
    }

    // Broadcast the processed transcript
    try {
      if ($DebugTestMode) {
        console.log("Broadcasting processed transcript:", {
          original: originalTranscript,
          processed: processedTranscript,
          isQuestion: isQuestionResult,
          isPartial: isPartial,
        });
      }

      window.electronAPI.broadcastTranscript({
        text: processedTranscript,
        originalText:
          originalTranscript !== processedTranscript
            ? originalTranscript
            : undefined,
        isQuestion: isQuestionResult,
        isPartial: isPartial,
        transcriptId: transcriptId,
      });
    } catch (ipcError) {
      if ($DebugTestMode) {
        console.error("❌ IPC broadcast failed:", ipcError);
      }
    }

    // Update tracking for finals
    if (!isPartial) {
      window.lastTranscript = processedTranscript;
      window.lastTranscriptTime = currentTime;
    }
  }
}

function createAudioErrorBoundary() {
  const originalError = window.onerror;
  const originalUnhandledRejection = window.onunhandledrejection;

  window.onerror = function (message, source, lineno, colno, error) {
    if ($DebugTestMode) {
      console.error("🚨 Global error caught:", {
        message,
        source,
        lineno,
        colno,
        error,
      });
    }

    // If it's an audio-related error, try to recover
    if (
      message &&
      (message.includes("audio") ||
        message.includes("AudioContext") ||
        message.includes("MediaStream") ||
        message.includes("getUserMedia"))
    ) {
      if ($DebugTestMode) {
        console.log("🔄 Audio error detected, attempting recovery...");
      }
      emergencyCleanup().then(() => {
        broadcastListeningState(false, "❌ Audio error - ready to restart");
      });
    }

    // Call original handler if it exists
    if (originalError) {
      return originalError.apply(this, arguments);
    }

    return true; // Prevent default browser error handling
  };

  window.onunhandledrejection = function (event) {
    if ($DebugTestMode) {
      console.error("🚨 Unhandled promise rejection:", event.reason);
    }

    // If it's an audio-related promise rejection, try to recover
    if (
      event.reason &&
      (event.reason.message?.includes("audio") ||
        event.reason.message?.includes("AudioContext") ||
        event.reason.message?.includes("MediaStream"))
    ) {
      if ($DebugTestMode) {
        console.log(
          "🔄 Audio promise rejection detected, attempting recovery..."
        );
      }
      emergencyCleanup().then(() => {
        broadcastListeningState(false, "❌ Audio error - ready to restart");
      });
    }

    // Call original handler if it exists
    if (originalUnhandledRejection) {
      return originalUnhandledRejection.apply(this, arguments);
    }

    event.preventDefault(); // Prevent default browser handling
  };
}

// ✅ ADD: Memory monitoring to prevent crashes
function startMemoryMonitoring() {
  if (!performance.memory) return; // Not available in all browsers

  setInterval(() => {
    const memory = performance.memory;
    const usedMB = Math.round(memory.usedJSHeapSize / 1024 / 1024);
    const totalMB = Math.round(memory.totalJSHeapSize / 1024 / 1024);
    const limitMB = Math.round(memory.jsHeapSizeLimit / 1024 / 1024);

    if ($DebugTestMode && usedMB > 100) {
      // Log if using more than 100MB
      console.log(
        `🧠 Memory usage: ${usedMB}MB / ${totalMB}MB (limit: ${limitMB}MB)`
      );
    }

    // If memory usage is very high, trigger cleanup
    if (usedMB > limitMB * 0.8) {
      // 80% of limit
      if ($DebugTestMode) {
        console.warn("⚠️ High memory usage detected, triggering cleanup");
      }
      emergencyCleanup();
    }
  }, 10000); // Check every 10 seconds
}

// ✅ ADD: Initialize error boundaries and monitoring when page loads
window.addEventListener("load", () => {
  createAudioErrorBoundary();
  startMemoryMonitoring();
  if ($DebugTestMode) {
    console.log("✅ Error boundaries and memory monitoring initialized");
  }
});

// ✅ ADD: Periodic cleanup to prevent memory leaks
setInterval(() => {
  // Clean up any orphaned timers or intervals
  if (window.audioBuffer && window.audioBuffer.length > 10000) {
    if ($DebugTestMode) {
      console.log("🧹 Cleaning up large audio buffer");
    }
    window.audioBuffer = window.audioBuffer.slice(-1000); // Keep only last 1000 entries
  }

  // Garbage collection hint (if available)
  if (window.gc) {
    window.gc();
  }
}, 30000); // Every 30 seconds

// Add this new function to update existing transcripts
function updateTranscript(transcriptId, newText, isFinal = false) {
  if ($DebugTestMode) {
    console.log(
      "Updating transcript with ID:",
      transcriptId,
      "to:",
      newText,
      "isFinal:",
      isFinal
    );
  }

  // Apply text correction if available
  let correctedText = newText;
  let originalText = newText;

  if (
    window.lastVoskResult &&
    window.lastVoskResult.originalText &&
    window.lastVoskResult.text
  ) {
    correctedText = window.lastVoskResult.text;
    originalText = window.lastVoskResult.originalText;
  }

  // Send update to transcript window
  window.electronAPI.broadcastTranscript({
    text: correctedText,
    originalText: originalText !== correctedText ? originalText : undefined,
    isUpdate: true,
    transcriptId: transcriptId,
    isPartial: !isFinal,
  });
}

function normalizePunctuation(text) {
  return text
    .trim()
    .replace(/[.]{2,}/g, ".") // Multiple periods -> single period
    .replace(/[?]{2,}/g, "?") // Multiple question marks -> single
    .replace(/[!]{2,}/g, "!") // Multiple exclamations -> single
    .replace(/\s+([.!?])/g, "$1") // Remove space before punctuation
    .replace(/([.!?])\s*$/, "$1") // Ensure punctuation at end
    .replace(/\s+/g, " "); // Normalize whitespace
}

// Enhanced question detection with better patterns
function isQuestion(text) {
  const cleanText = normalizePunctuation(text);
  const wordCount = cleanText.split(/\s+/).filter((w) => w.length > 0).length;

  // Explicit question mark = definitely a question
  if (/\?$/.test(cleanText)) {
    return true;
  }

  // Very short phrases need question marks
  if (wordCount < 3) {
    return false;
  }

  // Improved incomplete starters detection
  const incompleteStarters = [
    /^(how do|what is|what are|where is|who is|when is|why is|can you|could you|would you|should i|how can|what about|what if)$/i,
  ];

  if (incompleteStarters.some((pattern) => pattern.test(cleanText))) {
    return false;
  }

  // Enhanced question patterns with better word boundaries
  const questionPatterns = [
    // Interrogative word patterns (more specific)
    /^(what|when|where|who|why|how)\s+\w+.*\w+/i,
    /^(can|could|would|should|will|did|does|do|are|is)\s+\w+.*\w+/i,

    // Command-style questions
    /\b(tell me|explain|describe|show me|help me understand|clarify|define)\s+\w+/i,

    // Indirect questions
    /\b(wondering|curious about|need to know|want to know)\s+\w+/i,
    /\b(anyone know|somebody know|does anyone)\s+\w+/i,

    // Specific constructions
    /^how (do|can|should|would|will)\s+\w+/i,
    /^what (are|is|was|were|will)\s+the\s+\w+/i,
    /^(where|when|why|who)\s+(is|are|was|were|will|would|can|could)\s+\w+/i,
  ];

  return questionPatterns.some((pattern) => pattern.test(cleanText));
}

// Process general transcript with backend
async function processWithBackend(text) {
  if ($DebugTestMode) {
    console.log("Processing transcript with backend, length:", text.length);
  }

  refreshAuthFromStorage();
  if (!checkAuthentication()) {
    if ($DebugTestMode) {
      console.log("User not authenticated, skipping transcript processing");
    }
    return;
  }

  try {
    const response = await fetch(
      `${backendUrl}/api/index.php?endpoint=transcript`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "process_transcript",
          transcript: text,
          token: authToken,
        }),
      }
    );

    if ($DebugTestMode) {
      console.log("Backend response status:", response.status);
    }

    if (!response.ok) {
      if (response.status === 401) {
        if ($DebugTestMode) {
          console.log(
            "4🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨THE TOKEN AND USER JUST GOT RESET FOR THE LOGIN SYSTEM THIS SHOULD ONLY HAPPEN ON ERROR OR LOGOUT WHICH ISNT EVEN A THING YET🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨"
          );
        }
        localStorage.removeItem("memoria_token");
        localStorage.removeItem("memoria_user");
        authToken = null;
        currentUser = null;
      }
      throw new Error(`Backend error: ${response.status}`);
    }

    const data = await response.json();
    if ($DebugTestMode) {
      console.log("Backend response:", data);
    }

    if (data.response) {
      window.electronAPI.broadcastAIResponse({
        text: data.response,
        type: "Meeting Analysis",
        model: data.model_used,
        title: data.title,
        generateTitle: !data.title,
      });
    }
  } catch (error) {
    if ($DebugTestMode) {
      console.error("Backend error:", error);
    }
  }
}

// Process screenshot
async function processScreenshot(screenshot) {
  refreshAuthFromStorage();
  if (!checkAuthentication()) {
    window.electronAPI.broadcastAIResponse({
      text: "Please sign in to use the AI assistant.",
      type: "Auth Required",
    });
    return;
  }

  window.electronAPI.broadcastTranscript({
    text: "📸 Screenshot captured",
    isQuestion: false,
  });

  window.electronAPI.broadcastAIResponse({ thinking: true });

  try {
    const response = await fetch(
      `${backendUrl}/api/index.php?endpoint=transcript`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "process_transcript",
          transcript: "User captured a screenshot",
          query: "Please analyze what's visible in the screenshot",
          screenshot: screenshot,
          token: authToken,
        }),
      }
    );

    const data = await response.json();

    if (data.response) {
      window.electronAPI.broadcastAIResponse({
        text: data.response,
        type: "Screenshot Analysis",
        model: data.model_used,
        title: data.title,
        generateTitle: !data.title,
      });
    }
  } catch (error) {
    if ($DebugTestMode) {
      console.error("Backend error:", error);
    }
  }
}

// Test system audio capture
window.testSystemAudio = async function () {
  if ($DebugTestMode) {
    console.log("🧪 Testing system audio capture...");
  }
  try {
    const stream = await captureSystemAudioFixed();
    if (stream) {
      if ($DebugTestMode) {
        console.log("✅ System audio capture successful");
      }

      // Test audio levels
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      let maxLevel = 0;
      let sampleCount = 0;

      const testInterval = setInterval(() => {
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        maxLevel = Math.max(maxLevel, average);
        sampleCount++;

        if ($DebugTestMode) {
          console.log(
            `Audio test sample ${sampleCount}: ${average.toFixed(2)}`
          );
        }

        if (sampleCount >= 10) {
          clearInterval(testInterval);
          if ($DebugTestMode) {
            console.log(`Max audio level detected: ${maxLevel.toFixed(2)}`);
          }

          // Clean up
          source.disconnect();
          audioContext.close();
          stream.getTracks().forEach((track) => track.stop());

          if (maxLevel > 5) {
            if ($DebugTestMode) {
              console.log("✅ System audio is working - detected audio signal");
            }
          } else {
            if ($DebugTestMode) {
              console.log("⚠️ System audio may not be working - low signal");
            }
          }
        }
      }, 200);

      return true;
    } else {
      if ($DebugTestMode) {
        console.log("❌ System audio capture failed");
      }
      return false;
    }
  } catch (error) {
    if ($DebugTestMode) {
      console.error("❌ System audio test error:", error);
    }
    return false;
  }
};

// Test microphone
async function testMicrophone() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    const microphone = audioContext.createMediaStreamSource(stream);
    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    analyser.smoothingTimeConstant = 0.8;
    analyser.fftSize = 1024;

    microphone.connect(analyser);

    let checkCount = 0;
    const checkInterval = setInterval(() => {
      analyser.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b) / dataArray.length;

      if ($DebugTestMode) {
        console.log(
          `Mic test #${checkCount}: Average level = ${average.toFixed(2)}`
        );
      }

      checkCount++;
      if (checkCount > 10) {
        clearInterval(checkInterval);
        stream.getTracks().forEach((track) => track.stop());
        audioContext.close();
      }
    }, 100);
  } catch (error) {
    if ($DebugTestMode) {
      console.error("Microphone test failed:", error);
    }
  }
}

// You can call this function from the console to test your mic:
window.testMicrophone = testMicrophone;

// AudioDebugger class
class AudioDebugger {
  constructor() {
    this.logs = [];
    this.maxLogs = 100;
  }

  log(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const entry = { timestamp, level, message, data };

    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    if ($DebugTestMode) {
      const colors = {
        error: "\x1b[31m%s\x1b[0m",
        warn: "\x1b[33m%s\x1b[0m",
        info: "\x1b[36m%s\x1b[0m",
        success: "\x1b[32m%s\x1b[0m",
      };
      console.log(
        colors[level] || "\x1b[37m%s\x1b[0m",
        `[${level.toUpperCase()}] ${message}`
      );
      if (data) console.log("Data:", data);
    }

    // Update UI status
    /*const statusEl = document.getElementById("statusText");
    if (statusEl) {
      if (level === "error") {
        statusEl.textContent = `❌ ${message}`;
        statusEl.style.color = "#ff6b6b";
      } else if (level === "success") {
        statusEl.textContent = `✅ ${message}`;
        statusEl.style.color = "#51cf66";
      } else if (level === "warn") {
        statusEl.textContent = `⚠️ ${message}`;
        statusEl.style.color = "#ffd43b";
      } else {
        statusEl.textContent = message;
        statusEl.style.color = "#74c0fc";
      }
    }*/
  }

  exportLogs() {
    return JSON.stringify(this.logs, null, 2);
  }

  clear() {
    this.logs = [];
  }
}

// Global debugger instance
const audioDebugger = new AudioDebugger();

// Quick microphone test
async function testMicrophoneQuick() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    // Quick level test
    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    let maxLevel = 0;

    // Test for 500ms
    for (let i = 0; i < 5; i++) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      analyser.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
      maxLevel = Math.max(maxLevel, average);
    }

    // Cleanup
    stream.getTracks().forEach((track) => track.stop());
    audioContext.close();

    return { success: true, maxLevel };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Export debug functions for console access
window.audioDebugger = audioDebugger;
window.testMicrophoneQuick = testMicrophoneQuick;

// Quick diagnostic function
window.quickDiagnostic = async function () {
  if ($DebugTestMode) {
    console.log("🔍 === QUICK DIAGNOSTIC ===");
  }

  const capabilities = {
    getUserMedia: !!navigator.mediaDevices?.getUserMedia,
    getDisplayMedia: !!navigator.mediaDevices?.getDisplayMedia,
    audioContext: !!(window.AudioContext || window.webkitAudioContext),
    electronAPI: !!window.electronAPI,
    voskReady: window.voskReady,
    isListening: window.isListening,
    captureSystemAudioFixed: !!window.captureSystemAudioFixed, // ✅ SIMPLE CHECK
  };

  if ($DebugTestMode) {
    console.log("Browser capabilities:", capabilities);
  }

  if (window.electronAPI && $DebugTestMode) {
    console.log("Vosk functions available:", {
      initVosk: !!window.electronAPI.initVosk,
      startVoskSession: !!window.electronAPI.startVoskSession,
      transcribeWithVosk: !!window.electronAPI.transcribeWithVosk,
    });
  }

  if ($DebugTestMode) {
    console.log("✅ Quick diagnostic complete");
  }
  return capabilities;
};
// Debug media APIs
window.debugMediaAPIs = async function () {
  if ($DebugTestMode) {
    console.log("🔍 === MEDIA API DEBUG ANALYSIS ===");
  }

  // Basic environment check
  if ($DebugTestMode) {
    console.log("Environment:");
    console.log("  - User Agent:", navigator.userAgent);
    console.log("  - Platform:", navigator.platform);
    console.log("  - Protocol:", window.location.protocol);
    console.log("  - Host:", window.location.host);
    console.log("  - isSecureContext:", window.isSecureContext);
  }

  // Navigator object check
  if ($DebugTestMode) {
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

    // Enhanced Audio Capture check
    console.log("\nEnhanced Audio Capture:");
    console.log("  - globalAudioCapture exists:", !!globalAudioCapture);
    if (globalAudioCapture) {
      console.log("  - Platform detected:", globalAudioCapture.platform);
      console.log("  - Status:", globalAudioCapture.getStatus());
    }

    // ElectronAPI check
    console.log("\nElectron API:");
    console.log("  - window.electronAPI exists:", !!window.electronAPI);
  }

  // Try basic getUserMedia test
  if (navigator.mediaDevices?.getUserMedia) {
    try {
      if ($DebugTestMode) {
        console.log("\nTesting getUserMedia...");
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, sampleRate: 16000 },
      });
      if ($DebugTestMode) {
        console.log("  ✅ getUserMedia SUCCESS");
        console.log("  - Tracks:", stream.getTracks().length);
        stream.getTracks().forEach((track) => {
          console.log(
            `    - ${track.kind}: ${track.label}, enabled: ${track.enabled}`
          );
        });
      }
      stream.getTracks().forEach((track) => track.stop());
    } catch (error) {
      if ($DebugTestMode) {
        console.error("  ❌ getUserMedia FAILED:", error.message);
      }
    }
  }

  if ($DebugTestMode) {
    console.log("\n🔍 === DEBUG ANALYSIS COMPLETE ===");
  }

  return {
    hasNavigator: typeof navigator !== "undefined",
    hasMediaDevices: !!navigator.mediaDevices,
    hasGetUserMedia: !!navigator.mediaDevices?.getUserMedia,
    hasGetDisplayMedia: !!navigator.mediaDevices?.getDisplayMedia,
    hasElectronAPI: !!window.electronAPI,
    hasGlobalAudioCapture: !!globalAudioCapture,
    isSecureContext: window.isSecureContext,
    protocol: window.location.protocol,
  };
};

// Quick test function
window.quickMediaTest = async function () {
  try {
    const result = await debugMediaAPIs();
    if (result.hasGetUserMedia) {
      if ($DebugTestMode) {
        console.log("✅ Enhanced media APIs are available!");
      }
      return true;
    } else {
      if ($DebugTestMode) {
        console.log("❌ Media APIs are NOT available!");
      }
      return false;
    }
  } catch (error) {
    if ($DebugTestMode) {
      console.error("❌ Debug test failed:", error);
    }
    return false;
  }
};

// Safe window exposure
if (typeof audioDebugger !== "undefined") {
  window.audioDebugger = audioDebugger;
}

// Add this at the very end to confirm the file loads
if ($DebugTestMode) {
  console.log(
    "🚀 ✅ main-renderer.js fully loaded with Enhanced Audio Capture integration"
  );
  console.log(
    "🚀 Current window.toggleListeningMain:",
    typeof window.toggleListeningMain
  );
  console.log(
    "🚀 captureSystemAudioFixed available:",
    !!window.captureSystemAudioFixed
  );
}
async function emergencyAudioStop(reason = "Emergency stop") {
  if ($DebugTestMode) {
    console.log("🛑 EMERGENCY STOP:", reason);
  }

  isListening = false;
  window.isListening = false;

  // Force stop all processing
  if (window.processingInterval) {
    clearInterval(window.processingInterval);
    window.processingInterval = null;
  }

  // Force stop all streams
  if (window.currentStream) {
    try {
      window.currentStream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (e) {}
      });
    } catch (e) {}
    window.currentStream = null;
  }

  // Force close audio context
  if (window.audioContext) {
    try {
      await window.audioContext.close();
    } catch (e) {}
    window.audioContext = null;
  }

  // Reset UI
  broadcastListeningState(false, "Emergency stop");

  if ($DebugTestMode) {
    console.log("✅ Emergency stop completed");
  }
}
async function forceStopEverything() {
  if ($DebugTestMode) {
    console.log("🛑 FORCE STOPPING EVERYTHING");
  }

  // Stop all intervals
  if (window.processingInterval) {
    clearInterval(window.processingInterval);
    window.processingInterval = null;
  }

  // Stop audio processor
  if (window.audioProcessor) {
    try {
      window.audioProcessor.disconnect();
    } catch (e) {
      window.audioProcessor.onaudioprocess = null;
    }
    window.audioProcessor = null;
  }

  // Close audio context
  if (window.audioContext) {
    try {
      if (window.audioContext.state !== "closed") {
        await window.audioContext.close();
      }
    } catch (e) {}
    window.audioContext = null;
  }

  // Stop current stream
  if (window.currentAudioStream) {
    try {
      window.currentAudioStream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (e) {}
      });
    } catch (e) {}
    window.currentAudioStream = null;
  }

  // Clear audio buffer
  if (window.audioBuffer) {
    window.audioBuffer = [];
  }

  // Enhanced audio capture cleanup
  if (globalAudioCapture) {
    try {
      await globalAudioCapture.stop();
    } catch (e) {}
  }

  if ($DebugTestMode) {
    console.log("✅ Force stop completed");
  }
}
// Add to window.addEventListener("load", ...)
window.addEventListener("beforeunload", async () => {
  await emergencyCleanup();
});

window.addEventListener("error", async (event) => {
  if ($DebugTestMode) {
    console.error("🚨 Window error:", event.error);
  }
  await emergencyCleanup();
});
window.startAudioMonitor = function (intervalMs = 2000) {
  // Stop any existing monitor
  if (window.audioMonitorInterval) {
    clearInterval(window.audioMonitorInterval);
    if ($DebugTestMode) {
      console.log("🛑 Stopped existing audio monitor");
    }
  }

  if ($DebugTestMode) {
    console.log(
      `🔄 Starting continuous audio monitor (checking every ${intervalMs}ms)`
    );
    console.log("📝 Use stopAudioMonitor() to stop");
  }

  let consecutiveFailures = 0;
  let lastGoodState = null;
  let monitorCount = 0;

  window.audioMonitorInterval = setInterval(() => {
    monitorCount++;
    const timestamp = new Date().toLocaleTimeString();

    // Core checks for computer audio listening
    const checks = {
      isListening: !!window.isListening,
      hasActiveStream: !!window.currentAudioStream?.active,
      hasAudioTracks: window.currentAudioStream?.getAudioTracks().length > 0,
      audioContextRunning: window.audioContext?.state === "running",
      hasProcessor: !!window.audioProcessor,
      voskReady: !!window.voskReady,
      hasElectronAPI: !!window.electronAPI?.sendAudioToVosk,
    };

    // Calculate overall health
    const criticalChecks = [
      checks.isListening,
      checks.hasActiveStream,
      checks.hasAudioTracks,
      checks.audioContextRunning,
      checks.hasProcessor,
    ];

    const healthyCount = criticalChecks.filter(Boolean).length;
    const isHealthy = healthyCount >= 4; // At least 4 out of 5 critical checks

    // Detailed audio track analysis
    let trackDetails = "No tracks";
    let hasSystemAudio = false;

    if (window.currentAudioStream?.getAudioTracks().length > 0) {
      const tracks = window.currentAudioStream.getAudioTracks();
      trackDetails = tracks
        .map((track) => {
          const isLive = track.readyState === "live";
          const label = track.label || "Unknown";

          // Check if this looks like system audio (not just microphone)
          const looksLikeSystemAudio =
            label.toLowerCase().includes("stereo mix") ||
            label.toLowerCase().includes("system") ||
            label.toLowerCase().includes("speakers") ||
            label.toLowerCase().includes("monitor") ||
            label.toLowerCase().includes("loopback") ||
            label.toLowerCase().includes("desktop") ||
            label.toLowerCase().includes("screen") ||
            (label.toLowerCase().includes("default") &&
              !label.toLowerCase().includes("microphone"));

          if (looksLikeSystemAudio && isLive) {
            hasSystemAudio = true;
          }

          return `${label}(${isLive ? "LIVE" : "DEAD"})`;
        })
        .join(", ");
    }

    // Status determination
    let status, color, symbol;
    if (isHealthy && hasSystemAudio) {
      status = "🟢 COMPUTER AUDIO ACTIVE";
      color = "\x1b[32m"; // Green
      symbol = "✅";
      consecutiveFailures = 0;
    } else if (isHealthy && checks.hasAudioTracks) {
      status = "🟡 AUDIO ACTIVE (may be mic only)";
      color = "\x1b[33m"; // Yellow
      symbol = "⚠️";
      consecutiveFailures = 0;
    } else if (checks.isListening) {
      status = "🟠 LISTENING BUT ISSUES";
      color = "\x1b[33m"; // Yellow
      symbol = "⚠️";
      consecutiveFailures++;
    } else {
      status = "🔴 NOT LISTENING";
      color = "\x1b[31m"; // Red
      symbol = "❌";
      consecutiveFailures++;
    }

    // Log status (every check for critical issues, every 5th for good status)
    const shouldLog =
      !isHealthy || consecutiveFailures > 0 || monitorCount % 5 === 0;

    if (shouldLog && $DebugTestMode) {
      console.log(`${color}[${timestamp}] ${status}\x1b[0m`);
      console.log(
        `  ${symbol} Health: ${healthyCount}/5 | Tracks: ${trackDetails}`
      );

      // Show issues if any
      const issues = [];
      if (!checks.isListening) issues.push("Not listening");
      if (!checks.hasActiveStream) issues.push("No active stream");
      if (!checks.hasAudioTracks) issues.push("No audio tracks");
      if (!checks.audioContextRunning)
        issues.push(`AudioContext: ${window.audioContext?.state || "missing"}`);
      if (!checks.hasProcessor) issues.push("No audio processor");
      if (!checks.voskReady) issues.push("Vosk not ready");
      if (!checks.hasElectronAPI) issues.push("No Electron API");

      if (issues.length > 0) {
        console.log(`  🚨 Issues: ${issues.join(", ")}`);
      }

      if (!hasSystemAudio && checks.hasAudioTracks) {
        console.log(
          `  ⚠️ Warning: May only be capturing microphone, not computer audio`
        );
      }
    }

    // Auto-recovery for critical failures
    if (consecutiveFailures >= 3 && $DebugTestMode) {
      console.log(
        `🚨 ${consecutiveFailures} consecutive failures detected - attempting auto-recovery...`
      );

      // Try quick fixes
      if (window.audioContext?.state === "suspended") {
        window.audioContext
          .resume()
          .then(() => {
            if ($DebugTestMode) {
              console.log("🔧 Audio context resumed");
            }
          })
          .catch((err) => {
            if ($DebugTestMode) {
              console.log("❌ Failed to resume audio context:", err.message);
            }
          });
      }

      if (consecutiveFailures >= 5) {
        if ($DebugTestMode) {
          console.log("🚨 CRITICAL: 5+ failures - suggesting manual restart");
          console.log(
            "💡 Try: restartAudio() or stopAudioMonitor() then manually restart"
          );
        }
        consecutiveFailures = 0; // Reset to prevent spam
      }
    }

    // State change detection
    const currentStateKey = `${checks.isListening}-${checks.hasActiveStream}-${checks.hasAudioTracks}-${hasSystemAudio}`;
    if (lastGoodState && lastGoodState !== currentStateKey && $DebugTestMode) {
      console.log(`🔄 Audio state changed from previous check`);
    }
    if (isHealthy) {
      lastGoodState = currentStateKey;
    }
  }, intervalMs);

  // Also create a stop function
  window.stopAudioMonitor = function () {
    if (window.audioMonitorInterval) {
      clearInterval(window.audioMonitorInterval);
      window.audioMonitorInterval = null;
      if ($DebugTestMode) {
        console.log("🛑 Audio monitor stopped");
      }
    } else if ($DebugTestMode) {
      console.log("⚠️ No audio monitor was running");
    }
  };

  return window.audioMonitorInterval;
};

// Quick start with default settings
window.monitorAudio = () => window.startAudioMonitor(2000);
