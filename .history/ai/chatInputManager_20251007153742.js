// chatInputManager.js - Input handling and attachments
"use strict";

if (typeof $DebugTestMode === "undefined") {
  $DebugTestMode = true;
}

// RESTORED: Enhanced chat input manager with syntax highlighting
var chatInputManager = {
  // ... (other properties and methods unchanged)

  receiveTranscriptWordsAndSend(words) {
    if ($DebugTestMode) {
      console.log("Received transcript words:", words);
    }
    if (chatManager.currentStreamMessageId) {
      if ($DebugTestMode) {
        console.log("🧭 ❌ Cannot send message while processing a message");
      }

      // Get header controls element first
      const headerControls = document.querySelector(".header-controls");

      // Check if processing banner already exists
      let processingBanner = document.querySelector(".processing-banner");

      if (processingBanner) {
        // Banner exists, just reset the timeout
        clearTimeout(parseInt(processingBanner.dataset.timeoutId));
        processingBanner.dataset.timeoutId = setTimeout(() => {
          if (processingBanner.parentNode === headerControls) {
            headerControls.removeChild(processingBanner);
          }
        }, 3000);
      } else {
        // Create and display new processing banner
        processingBanner = document.createElement("div");
        processingBanner.className = "processing-banner";
        processingBanner.textContent = "Processing memory, please wait";
        processingBanner.style.cssText = `
    background-color: rgb(54, 73, 74);
    color: rgb(255, 255, 255);
    padding: 5px;
    border-radius: 4px;
    position: absolute;
    z-index: 1000;
    top: 50px;
    left: 50%;
    transform: translateX(-50%);
    width: 230px;
    font-weight: bold;
    font-size: 14px;
  `;

        // Add the banner before the new chat button
        const newChatButton = document.querySelector(".new-chat-button");
        headerControls.insertBefore(processingBanner, newChatButton);

        // Store timeout ID in data attribute for later clearing
        processingBanner.dataset.timeoutId = setTimeout(() => {
          if (processingBanner.parentNode === headerControls) {
            headerControls.removeChild(processingBanner);
          }
        }, 3000);
      }

      return; // Exit the function to prevent sending message
    }
    // ... (rest of the function unchanged)
  },

  copyAttachment: async function (attachmentId) {
    if ($DebugTestMode) {
      console.log("📋 Starting copy to clipboard with ID:", attachmentId);
      console.log("📋 Current attachments:", this.attachments);
    }

    if (!this.attachments || !Array.isArray(this.attachments)) {
      if ($DebugTestMode) {
        console.log("❌ No attachments array found");
      }
      return false;
    }

    const attachment = this.attachments.find((att) => att.id === attachmentId);

    if (!attachment) {
      if ($DebugTestMode) {
        console.log("❌ Attachment not found:", attachmentId);
      }
      return false;
    }

    if ($DebugTestMode) {
      console.log("✅ Found attachment:", attachment.filename);
      console.log("📊 Attachment type:", attachment.type);
      console.log("📊 Content type:", typeof attachment.content);
      console.log("📊 Has data property:", !!attachment.data);
    }

    try {
      // Check if it's an image attachment
      if (
        attachment.type === "image" ||
        (attachment.filename &&
          attachment.filename.match(/\.(png|jpg|jpeg|gif|webp)$/i))
      ) {
        if ($DebugTestMode) {
          console.log("🖼️ Processing as image attachment");
        }

        // Check if we have data (base64) or content
        let imageData = attachment.data || attachment.content;

        if (!imageData || typeof imageData !== "string") {
          if ($DebugTestMode) {
            console.log("❌ Invalid image content:", imageData);
          }
          return false;
        }

        // Clean the data URL if needed (remove data:image/png;base64, prefix if already present)
        if (imageData.startsWith("data:")) {
          // Extract just the base64 part
          const commaIndex = imageData.indexOf(",");
          if (commaIndex !== -1) {
            imageData = imageData.substring(commaIndex + 1);
          }
        }

        try {
          // Convert base64 to blob
          const mimeType = "image/png"; // Default to png, or extract from filename if needed

          if ($DebugTestMode) {
            console.log("📊 Base64 data length:", imageData.length);
            console.log("📊 MIME type:", mimeType);
          }

          // Fetch the base64 data as a blob
          const response = await fetch(`data:${mimeType};base64,${imageData}`);
          const blob = await response.blob();

          if ($DebugTestMode) {
            console.log("✅ Blob created:", blob.type, blob.size);
          }

          // Copy image to clipboard
          const item = new ClipboardItem({ [blob.type]: blob });
          await navigator.clipboard.write([item]);

          if ($DebugTestMode) {
            console.log(
              "📋 Successfully copied image to clipboard:",
              attachment.filename
            );
          }

          // Optional: Show a toast or notification
          if (window.showToast) {
            window.showToast(`Copied ${attachment.filename} to clipboard`);
          }
        } catch (imageError) {
          if ($DebugTestMode) {
            console.error("❌ Failed to process image:", imageError);
          }

          // Provide user guidance
          if (window.showToast) {
            window.showToast("Right-click the image and select 'Copy Image'");
          }
        }
      } else {
        if ($DebugTestMode) {
          console.log("📝 Processing as text attachment");
        }
        // Handle text content as before
        await navigator.clipboard.writeText(attachment.content);

        if ($DebugTestMode) {
          console.log(
            "📋 Successfully copied to clipboard:",
            attachment.filename
          );
        }

        // Optional: Show a toast or notification
        if (window.showToast) {
          window.showToast(`Copied ${attachment.filename} to clipboard`);
        }
      }

      return true;
    } catch (error) {
      if ($DebugTestMode) {
        console.error("❌ Copy operation failed:", error);
      }

      // Fallback for text content
      if (!attachment.type || attachment.type !== "image") {
        try {
          const textArea = document.createElement("textarea");
          textArea.value = attachment.content;
          document.body.appendChild(textArea);
          textArea.select();
          document.execCommand("copy");
          document.body.removeChild(textArea);
          if ($DebugTestMode) {
            console.log("📋 Copied using fallback method");
          }
        } catch (fallbackError) {
          if ($DebugTestMode) {
            console.error("❌ Fallback method also failed:", fallbackError);
          }
        }
      }

      return false;
    }
  },

  sendMessage: function () {
    if (chatManager.currentStreamMessageId) {
      if ($DebugTestMode) {
        console.log("🧭 ❌ Cannot send message while processing a message");
      }

      // Get header controls element first
      const headerControls = document.querySelector(".header-controls");

      // Check if processing banner already exists
      let processingBanner = document.querySelector(".processing-banner");

      if (processingBanner) {
        // Banner exists, just reset the timeout
        clearTimeout(parseInt(processingBanner.dataset.timeoutId));
        processingBanner.dataset.timeoutId = setTimeout(() => {
          if (processingBanner.parentNode === headerControls) {
            headerControls.removeChild(processingBanner);
          }
        }, 3000);
      } else {
        // Create and display new processing banner
        processingBanner = document.createElement("div");
        processingBanner.className = "processing-banner";
        processingBanner.textContent = "Processing memory, please wait";
        processingBanner.style.cssText = `
  background-color: rgb(54, 73, 74);
  color: rgb(255, 255, 255);
  padding: 5px;
  border-radius: 4px;
  position: absolute;
  z-index: 1000;
  top: 50px;
  left: 50%;
  transform: translateX(-50%);
  width: 230px;
  font-weight: bold;
  font-size: 14px;
`;

        // Add the banner before the new chat button
        const newChatButton = document.querySelector(".new-chat-button");
        headerControls.insertBefore(processingBanner, newChatButton);

        // Store timeout ID in data attribute for later clearing
        processingBanner.dataset.timeoutId = setTimeout(() => {
          if (processingBanner.parentNode === headerControls) {
            headerControls.removeChild(processingBanner);
          }
        }, 3000);
      }

      return; // Exit the function to prevent sending message
    }
    // ... (rest of the function unchanged)
  },

  handleLargeContentFromFile: function (file, content, attachmentId) {
    if ($DebugTestMode) {
      console.log("Handling large content from file:", file.name);
      console.log("Content called with handleLargeContentFromFile", content);
    }
    // ... (rest of the function unchanged)
  },

  // ... (rest of the chatInputManager object unchanged)
};

// Export for use in main module
if (typeof module !== "undefined" && module.exports) {
  module.exports = chatInputManager;
}
