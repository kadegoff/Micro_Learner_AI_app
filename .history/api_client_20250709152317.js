// api-client.js
const ApiClient = {
  baseUrl: CONFIG.BACKEND_URL || "http://localhost/memoria/backend",

  // Helper to build headers
  getHeaders: function (includeAuth = true) {
    const headers = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    if (includeAuth) {
      const token = localStorage.getItem("memoria_token");
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
    }

    return headers;
  },

  // Helper to add token to request body
  addTokenToBody: function (data = {}) {
    const token = localStorage.getItem("memoria_token");
    if (token) {
      data.token = token;
    }
    return data;
  },

  // Chat endpoint
  chat: async function (data) {
    const response = await fetch(`${this.baseUrl}/api/index.php?endpoint=chat`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(this.addTokenToBody(data)),
    });

    if (!response.ok) {
      if (response.status === 401) {
        this.handleAuthError();
      }
      throw new Error(`HTTP ${response.status}`);
    }

    return response.json();
  },

  // Transcript endpoint
  processTranscript: async function (data) {
    const response = await fetch(`${this.baseUrl}/api/index.php?endpoint=transcript`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(this.addTokenToBody(data)),
    });

    if (!response.ok) {
      if (response.status === 401) {
        this.handleAuthError();
      }
      throw new Error(`HTTP ${response.status}`);
    }

    return response.json();
  },

  // Settings endpoint - Convert GET to POST to send token in body
  getSettings: async function () {
    const response = await fetch(`${this.baseUrl}/api/index.php?endpoint=settings`, {
      method: "POST", // Changed from GET to POST
      headers: this.getHeaders(),
      body: JSON.stringify(this.addTokenToBody({})), // Send empty object with token
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return response.json();
  },

  // Usage endpoint - Convert GET to POST to send token in body
  getUsage: async function () {
    const response = await fetch(`${this.baseUrl}/api/index.php?endpoint=usage`, {
      method: "POST", // Changed from GET to POST
      headers: this.getHeaders(),
      body: JSON.stringify(this.addTokenToBody({})), // Send empty object with token
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return response.json();
  },

  // Auth endpoint
  verifyAuth: async function () {
    const response = await fetch(`${this.baseUrl}/api/index.php?endpoint=auth&action=verify`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(this.addTokenToBody({})), // Send empty object with token
    });

    return response.ok;
  },

  // Handle auth errors centrally
  handleAuthError: function () {
    localStorage.removeItem("memoria_token");
    localStorage.removeItem("memoria_user");

    // Dispatch auth failure event
    window.dispatchEvent(new CustomEvent("auth-failed"));

    // Redirect or show login
    if (typeof authManager !== "undefined") {
      authManager.resetAuthentication("Session expired");
    }
  },
};

// Make it available globally
window.ApiClient = ApiClient;
