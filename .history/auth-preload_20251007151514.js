// auth-preload.js
const { contextBridge, ipcRenderer } = require("electron");

if (typeof $DebugTestMode === "undefined") {
  $DebugTestMode = true;
}

// Expose API for auth window
contextBridge.exposeInMainWorld("electronAPI", {
  // Send auth success to main process
  sendAuthSuccess: (authData) => {
    console.log("Sending auth success to main process:", authData);
    ipcRenderer.send("auth-success", authData);
  },

  // Listen for auth-related events
  onAuthStateUpdate: (callback) => {
    ipcRenderer.on("auth-state-updated", (event, authState) => {
      callback(authState);
    });
  },

  // Get current auth state
  getAuthState: () => {
    return ipcRenderer.invoke("get-auth-state");
  },

  // Close auth window
  closeWindow: () => {
    window.close();
  },
});

// Monitor for successful authentication
window.addEventListener("DOMContentLoaded", () => {
  console.log("Auth window DOM loaded");

  // Set up storage listener
  let lastToken = localStorage.getItem("memoria_token");

  const checkAuthChange = () => {
    const currentToken = localStorage.getItem("memoria_token");
    const userData = localStorage.getItem("memoria_user");

    if (currentToken && currentToken !== lastToken && userData) {
      console.log("Auth token detected in auth window");

      // Send auth data to main process
      window.electronAPI.sendAuthSuccess({
        token: currentToken,
        user: JSON.parse(userData),
      });

      lastToken = currentToken;
    }
  };

  // Check for auth changes periodically
  setInterval(checkAuthChange, 1000);

  // Also listen for storage events
  window.addEventListener("storage", checkAuthChange);

  // Override console methods to also log to electron
  const originalLog = console.log;
  console.log = (...args) => {
    originalLog.apply(console, args);
    // You can send logs to main process if needed
  };
});
