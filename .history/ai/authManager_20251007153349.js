// authManager.js - Authentication Manager - SIMPLIFIED
"use strict";

var authManager = {
  initialize: function () {
    try {
      if ($DebugTestMode) {
        console.log("Initializing auth state...");
      }

      if (Environment.isWeb) {
        return this.initializeWebAuth();
      }

      /*if (window.electronAPI?.getAuthState) {
        return window.electronAPI.getAuthState().then(function (authState) {
          if ($DebugTestMode) {
            console.log("Auth state loaded:", authState);
          }
          appState.updateAuth(authState);
          return true;
        });
      }*/

      if ($DebugTestMode) {
        console.error("electronAPI.getAuthState not available");
      }
      // Initialize live preview handlers
      if (chatManager && chatManager.setupLivePreviewHandlers) {
        chatManager.setupLivePreviewHandlers();
        console.log("✅ Live preview handlers initialized");
      }
      return Promise.resolve(false);
    } catch (error) {
      if ($DebugTestMode) {
        console.error("Failed to get auth state:", error);
      }
      return this.initializeWebAuth();
    }
  },

  initializeWebAuth: function () {
    if ($DebugTestMode) {
      console.log("🌐 Web environment: Loading auth from localStorage");
    }
    const token = localStorage.getItem(CONFIG.STORAGE_KEYS.TOKEN);
    const userData = localStorage.getItem(CONFIG.STORAGE_KEYS.USER);

    if (token && userData) {
      appState.updateAuth({
        isAuthenticated: true,
        token: token,
        user: JSON.parse(userData),
      });
      if ($DebugTestMode) {
        console.log(
          "✅ Auth loaded from localStorage:",
          appState.currentUser.email
        );
      }
      return true;
    } else {
      if ($DebugTestMode) {
        console.log("❌ No auth data in localStorage");
      }
      appState.updateAuth({
        isAuthenticated: false,
        token: null,
        user: null,
      });
      return false;
    }
  },

  checkAuthFromStorage: async function () {
    const token = localStorage.getItem(CONFIG.STORAGE_KEYS.TOKEN);
    const userData = localStorage.getItem(CONFIG.STORAGE_KEYS.USER);

    if ($DebugTestMode) {
      console.log("🔍 Starting auth check from storage...");
      console.log("Token exists:", !!token);
      console.log("User data exists:", !!userData);
      if (token) {
        console.log("Token preview:", token.substring(0, 20) + "...");
      }
      if (userData) {
        console.log("User data preview:", userData.substring(0, 100) + "...");
      }
    }

    if (!token || !userData) {
      if ($DebugTestMode) {
        console.log("❌ No token or user data in localStorage");
      }
      console.log("3 CALLING resetAuthentication");
      appState.resetAuth();
      return false;
    }

    try {
      const user = JSON.parse(userData);

      if ($DebugTestMode) {
        console.log("🔐 Validating stored token with server...");
        console.log("Parsed user:", user);
      }

      // Get the backend URL - same directory as the main app
      const BACKEND_URL = "http://localhost/Memoria/backend/auth";

      if ($DebugTestMode) {
        console.log("Backend URL:", BACKEND_URL);
        console.log("Request payload:", {
          token: token.substring(0, 20) + "...",
          user_id: user,
        });
      }

      // Validate token with server
      const response = await fetch(`${BACKEND_URL}/auto_login_for_app.php`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token: token,
          user_id: user,
        }),
      });

      if ($DebugTestMode) {
        console.log("📡 Auto-login response received:");
        console.log("Status:", response.status);
        console.log("Status text:", response.statusText);
        console.log("Response ok:", response.ok);
        console.log(
          "Response headers:",
          Object.fromEntries(response.headers.entries())
        );
      }

      const responseText = await response.text();

      if ($DebugTestMode) {
        console.log("📄 Raw response text:");
        console.log("Response length:", responseText.length);
        console.log("Response preview:", responseText);
        console.log(
          "Response type check - starts with '<':",
          responseText.trim().startsWith("<")
        );
      }

      // Check if response looks like HTML (common server error indicator)
      if (responseText.trim().startsWith("<")) {
        if ($DebugTestMode) {
          console.error("🚫 Server returned HTML instead of JSON:");
          console.error("Full HTML response:", responseText);
        }
        throw new Error("Server returned HTML error page instead of JSON");
      }

      let data;
      try {
        data = JSON.parse(responseText);
        if ($DebugTestMode) {
          console.log("✅ Successfully parsed JSON response:");
          console.log("Parsed data:", data);
          console.log("Data.success:", data.success);
          console.log("Data.token exists:", !!data.token);
          console.log("Data.user exists:", !!data.user);
          console.log("Data.message:", data.message);
        }
      } catch (parseError) {
        if ($DebugTestMode) {
          console.error("🚫 Failed to parse auto-login response:");
          console.error("Parse error:", parseError);
          console.error("Raw response that failed to parse:", responseText);
        }
        throw new Error(
          `Invalid JSON response from server: ${responseText.substring(0, 100)}`
        );
      }

      if (response.ok && data.success) {
        if ($DebugTestMode) {
          console.log("🎉 Token validation successful!");
          console.log(
            "Using token:",
            data.token ? "new from server" : "existing"
          );
          console.log(
            "Using user data:",
            data.user ? "new from server" : "existing"
          );
        }

        // Token is valid, update auth state
        appState.updateAuth({
          isAuthenticated: true,
          token: data.token || token, // Use updated token if provided
          user: data.user || user, // Use updated user data if provided
        });

        // Update localStorage with any new data from server
        if (data.token && data.token !== token) {
          localStorage.setItem(CONFIG.STORAGE_KEYS.TOKEN, data.token);
          if ($DebugTestMode) {
            console.log("🔄 Updated token in localStorage");
          }
        }
        if (data.user && JSON.stringify(data.user) !== userData) {
          localStorage.setItem(
            CONFIG.STORAGE_KEYS.USER,
            JSON.stringify(data.user)
          );
          if ($DebugTestMode) {
            console.log("🔄 Updated user data in localStorage");
          }
        }

        if ($DebugTestMode) {
          console.log(
            "✅ Token validated successfully for user:",
            appState.currentUser.email
          );
        }
        return true;
      } else {
        // Token is invalid or expired
        if ($DebugTestMode) {
          console.log("❌ Token validation failed:");
          console.log("Response ok:", response.ok);
          console.log("Data success:", data.success);
          console.log("Error message:", data.message || "Unknown error");
          console.log("Full response data:", data);
        }
        console.log("2 CALLING resetAuthentication");
        appState.resetAuth();
        return false;
      }
    } catch (error) {
      if ($DebugTestMode) {
        console.error("💥 Exception caught during token validation:");
        console.error("Error type:", error.constructor.name);
        console.error("Error message:", error.message);
        console.error("Error stack:", error.stack);
        console.error("Full error object:", error);
      }

      // Check if it's a network error vs server error
      if (error.message.includes("HTML") || error.message.includes("JSON")) {
        // Server is responding but with errors - don't use cached data
        if ($DebugTestMode) {
          console.log(
            "🔥 Server error detected (HTML/JSON issue), clearing auth data"
          );
        }
        console.log("1 CALLING resetAuthentication");
        appState.resetAuth();
        return false;
      }

      if ($DebugTestMode) {
        console.log("🌐 Network error detected, attempting to use cached data");
      }

      // On network error, still try to use cached data but mark it as potentially stale
      try {
        const user = JSON.parse(userData);
        appState.updateAuth({
          isAuthenticated: true,
          token: token,
          user: user,
        });
        if ($DebugTestMode) {
          console.log("⚠️ Using cached auth data (server unavailable)");
          console.log("Cached user:", user);
          console.log("Cached token preview:", token.substring(0, 20) + "...");
        }
        return true;
      } catch (parseError) {
        if ($DebugTestMode) {
          console.error("💥 Failed to parse cached user data:");
          console.error("Parse error:", parseError);
          console.error("Cached user data that failed:", userData);
        }
        console.log("0 CALLING resetAuthentication");
        appState.resetAuth();
        return false;
      }
    }
  },

  resetAuthentication: function (reason = "Authentication failed") {
    if ($DebugTestMode) {
      console.log("🔐 Resetting authentication:", reason);

      console.log("CALLING resetAuthentication");
    }
    appState.resetAuth();
    updateAuthDropdown();
    messageManager.createMessage(
      "Your session has expired. Please sign in to continue using the AI assistant.",
      "ai",
      "Auth Required"
    );
  },

  setupEventListeners: function () {
    if (!window.electronAPI) return;

    /* if (window.electronAPI.onAuthStateUpdated) {
      window.electronAPI.onAuthStateUpdated(function (newAuthState) {
        if ($DebugTestMode) {
          console.log("🔐 Auth state updated via electronAPI:", newAuthState);
        }

        // Debug logs to understand the auth state
        console.log(
          "🔍 DEBUG: Full newAuthState object:",
          JSON.stringify(newAuthState, null, 2)
        );
        console.log("🔍 DEBUG: isAuthenticated:", newAuthState.isAuthenticated);
        console.log("🔍 DEBUG: token exists:", !!newAuthState.token);
        console.log(
          "🔍 DEBUG: token value:",
          newAuthState.token ? "***EXISTS***" : "MISSING"
        );
        console.log("🔍 DEBUG: user exists:", !!newAuthState.user);
        console.log(
          "🔍 DEBUG: user value:",
          newAuthState.user
            ? JSON.stringify(newAuthState.user, null, 2)
            : "MISSING"
        );

        appState.updateAuth(newAuthState);

        if (
          newAuthState.isAuthenticated &&
          newAuthState.token &&
          newAuthState.user
        ) {
          console.log("✅ DEBUG: All auth conditions met, storing auth data");
          localStorage.setItem(CONFIG.STORAGE_KEYS.TOKEN, newAuthState.token);
          localStorage.setItem(
            CONFIG.STORAGE_KEYS.USER,
            JSON.stringify(newAuthState.user)
          );
        } else {
          console.log(
            "❌ DEBUG: Auth conditions NOT met, calling resetAuthentication"
          );
          console.log("❌ DEBUG: Condition breakdown:");
          console.log(
            "   - isAuthenticated:",
            newAuthState.isAuthenticated,
            typeof newAuthState.isAuthenticated
          );
          console.log(
            "   - token truthy:",
            !!newAuthState.token,
            typeof newAuthState.token
          );
          console.log(
            "   - user truthy:",
            !!newAuthState.user,
            typeof newAuthState.user
          );

          if (!newAuthState.isAuthenticated) {
            console.log("❌ DEBUG: REASON - isAuthenticated is false/falsy");
          }
          if (!newAuthState.token) {
            console.log("❌ DEBUG: REASON - token is missing/falsy");
          }
          if (!newAuthState.user) {
            console.log("❌ DEBUG: REASON - user is missing/falsy");
          }

          console.log("4 CALLING resetAuthentication");
          appState.resetAuth();
        }
        updateAuthDropdown();
      });
    }*/

    if (window.electronAPI.onAuthSuccess) {
      window.electronAPI.onAuthSuccess(function (userData) {
        if ($DebugTestMode) {
          console.log("🔐 Auth success received:", userData);
        }
        appState.updateAuth({
          isAuthenticated: true,
          token: userData.token,
          user: userData.user,
        });

        localStorage.setItem(CONFIG.STORAGE_KEYS.TOKEN, userData.token);
        localStorage.setItem(
          CONFIG.STORAGE_KEYS.USER,
          JSON.stringify(userData.user)
        );

        updateAuthDropdown();
      });
    }
  },
};
