// environment.js - Environment Detection - SIMPLIFIED
"use strict";

var Environment = {
  isElectron: typeof window !== "undefined" && window.electronAPI,
  isWeb: true,

  init: function () {
    this.isWeb = !this.isElectron;
    if ($DebugTestMode) {
      console.log("🔍 Environment:", this.isElectron ? "Electron" : "Web Browser");
    }

    if (this.isWeb) {
      this.setupWebCompatibility();
    }
  },

  setupWebCompatibility: function () {
    if ($DebugTestMode) {
      console.log("🌐 Setting up web compatibility layer");
    }

    if (!window.electronAPI) {
      window.electronAPI = this.createMockElectronAPI();
    }
  },

  createMockElectronAPI: function () {
    const mockCallbacks = {};

    return {
      getAuthState: function () {
        const token = localStorage.getItem(CONFIG.STORAGE_KEYS.TOKEN);
        const userData = localStorage.getItem(CONFIG.STORAGE_KEYS.USER);

        if (token && userData) {
          return Promise.resolve({
            isAuthenticated: true,
            token: token,
            user: JSON.parse(userData),
          });
        }

        return Promise.resolve({
          isAuthenticated: false,
          user: null,
          token: null,
        });
      },

      onNewAIResponse: function (callback) {
        mockCallbacks.onNewAIResponse = callback;
      },

      onAIThinking: function (callback) {
        mockCallbacks.onAIThinking = callback;
      },

      onAuthStateUpdated: function (callback) {
        mockCallbacks.onAuthStateUpdated = callback;
      },

      onAuthStateChanged: function (callback) {
        mockCallbacks.onAuthStateChanged = callback;
      },

      onTranscriptQuestion: function (callback) {
        mockCallbacks.onTranscriptQuestion = callback;
      },

      onAuthSuccess: function (callback) {
        mockCallbacks.onAuthSuccess = callback;
      },

      sendChatMessage: function (data) {
        if (window.sendChatMessageDirect) {
          window.sendChatMessageDirect(data);
        }
      },

      broadcastAIResponse: function (data) {
        if (mockCallbacks.onNewAIResponse) {
          mockCallbacks.onNewAIResponse(data);
        }
      },

      sendTranscriptQuestion: function (question) {
        const chatInput = document.getElementById("chatInput");
        if (chatInput) {
          chatInput.value = question;
          autoResizeTextarea();
        }
      },

      sendAuthSuccess: function (userData) {
        if (mockCallbacks.onAuthSuccess) {
          mockCallbacks.onAuthSuccess(userData);
        }
      },
    };
  },
};
