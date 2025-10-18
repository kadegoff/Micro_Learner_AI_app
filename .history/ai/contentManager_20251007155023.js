"use strict";

if (typeof $DebugTestMode === "undefined") {
  $DebugTestMode = true;
}

var contentManager = {
  blocks: new Map(),
  blockCounter: 0,

  init: function () {
    this.setupEventDelegation();
  },

  setupEventDelegation: function () {
    if ($DebugTestMode) {
      console.log("🎯 Setting up event delegation for content blocks");
    }

    document.addEventListener(
      "click",
      function (event) {
        const target = event.target;

        if ($DebugTestMode) {
          console.log("🎯 === CLICK EVENT DEBUG ===");
          console.log("🎯 Target:", target);
          console.log("🎯 Target class:", target.className);
          console.log("🎯 Target tag:", target.tagName);
          console.log("🎯 Target text:", target.textContent?.substring(0, 20));
          console.log(
            "🎯 Event path:",
            event
              .composedPath()
              .map(
                (el) => el.tagName + (el.className ? "." + el.className : "")
              )
          );

          // Check if we can find ANY buttons in the clicked area
          const nearbyButtons = target
            .closest(".block-header")
            ?.querySelectorAll(".block-btn");
          if (nearbyButtons) {
            console.log("🎯 Found buttons in header:", nearbyButtons.length);
            nearbyButtons.forEach((btn, idx) => {
              console.log(
                `🎯 Button ${idx}:`,
                btn.textContent,
                "Action:",
                btn.dataset.action,
                "File ID:",
                btn.dataset.fileId
              );
            });
          }

          // Check if target or parents have block-btn class
          let checkEl = target;
          let depth = 0;
          while (checkEl && depth < 5) {
            console.log(
              `🎯 Level ${depth}:`,
              checkEl.tagName,
              checkEl.className
            );
            if (checkEl.classList && checkEl.classList.contains("block-btn")) {
              console.log("🎯 Found block-btn at level", depth);
            }
            checkEl = checkEl.parentElement;
            depth++;
          }
        }

        // CRITICAL FIX: Check for button FIRST and with higher priority
        let button = target.closest(".block-btn");

        // Also check if target itself is the button
        if (
          !button &&
          target.classList &&
          target.classList.contains("block-btn")
        ) {
          button = target;
        }

        // Last resort - check if we clicked on block-actions
        if (!button && target.closest(".block-actions")) {
          const actionsEl = target.closest(".block-actions");
          button = actionsEl.querySelector(".block-btn");
          if ($DebugTestMode && button) {
            console.log("🎯 Found button via block-actions:", button);
          }
        }

        if (button) {
          if ($DebugTestMode) {
            console.log("🎯 ✅ BUTTON DETECTED!");
            console.log("🎯 Button:", button);
            console.log("🎯 Action:", button.dataset.action);
            console.log("🎯 File ID:", button.dataset.fileId);
            console.log(
              "🎯 Is streaming block:",
              button.closest(".streaming") ? true : false
            );
          }
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation(); // Stop ALL other handlers

          const blockElement =
            button.closest(".content-block") || button.closest(".file-block");
          if ($DebugTestMode) {
            console.log("🎯 Block element found:", blockElement);
            console.log("🎯 Block element ID:", blockElement?.id);
          }

          if (!blockElement) {
            if ($DebugTestMode) {
              console.warn("🎯 No content-block parent found for button");
            }
            return;
          }

          // Handle file IDs during streaming
          let blockId = blockElement.id;
          let fileId = button.dataset.fileId;

          // For streaming blocks, we need to handle the ID carefully
          if (!fileId && blockId.startsWith("file_file_")) {
            fileId = blockId.replace("block_", "");
          } else if (!fileId) {
            fileId = blockId;
          }

          const action = button.dataset.action;

          if ($DebugTestMode) {
            console.log(
              "🎯 Block ID:",
              blockId,
              "Action:",
              action,
              "File ID:",
              fileId
            );
            console.log(
              "🎯 ContentManager blocks keys:",
              Array.from(contentManager.blocks.keys())
            );
            console.log(
              "🎯 ChatManager streaming files keys:",
              chatManager.streamingFiles
                ? Array.from(chatManager.streamingFiles.keys())
                : []
            );
            console.log(
              "🎯 Streaming file exists:",
              chatManager.streamingFiles.has(fileId)
            );
          }

          switch (action) {
            case "preview":
              if ($DebugTestMode) {
                console.log("🎯 CALLING previewContent with fileId:", fileId);
              }
              // For streaming files, get content from chatManager first
              if (
                blockElement.classList.contains("streaming") &&
                chatManager.streamingFiles
              ) {
                const streamingFile = chatManager.streamingFiles.get(fileId);
                if (streamingFile) {
                  if ($DebugTestMode) {
                    console.log("🎯 Streaming file found:", streamingFile);
                  }
                  contentManager.previewStreamingContent(fileId, streamingFile);
                  return;
                } else {
                  if ($DebugTestMode) {
                    console.warn(
                      "🎯 No streaming file found for fileId:",
                      fileId
                    );
                  }
                }
              }
              contentManager.previewContent(fileId);
              break;
            case "download":
              if ($DebugTestMode) {
                console.log("🎯 CALLING downloadContent");
              }
              contentManager.downloadContent(fileId);
              break;
            case "copy":
              if ($DebugTestMode) {
                console.log("🎯 CALLING copyContent");
              }
              contentManager.copyContent(fileId);
              break;
            case "view-code":
              if ($DebugTestMode) {
                console.log("🎯 CALLING showCode");
              }
              contentManager.showCode(fileId);
              break;
            // NEW UPDATE ACTIONS
            case "preview-updates":
              if ($DebugTestMode) {
                console.log("🎯 CALLING handleUpdateAction - preview");
              }
              contentManager.handleUpdateAction("preview-updates", fileId);
              break;
            case "apply-updates":
              if ($DebugTestMode) {
                console.log("🎯 CALLING handleUpdateAction - apply");
              }
              contentManager.handleUpdateAction("apply-updates", fileId);
              break;
            default:
              if ($DebugTestMode) {
                console.warn("🎯 Unknown action:", action);
              }
          }
          return; // Important: return here to prevent further processing
        }

        // Other click handlers (unchanged)
        if (
          target.closest(".block-header") &&
          !target.closest(".block-btn") &&
          !target.closest(".block-actions")
        ) {
          const blockElement =
            target.closest(".content-block") || target.closest(".file-block");
          if (blockElement) {
            const blockId = blockElement.id;
            contentManager.toggleBlock(blockId);
          }
          return;
        }

        if (target.closest(".hoverable-segment")) {
          const sentence = target.dataset.sentence;
          if (sentence) {
            addToChat(sentence);
          }
          return;
        }
      },
      true
    );
  },
  findOrCreateBlock: function (fileData) {
    if (!fileData.id) {
      if ($DebugTestMode) {
        console.error(
          "❌ findOrCreateBlock requires a fileData object with an id."
        );
      }
      return null;
    }

    // Use the provided ID as the single source of truth for the map key
    const blockId = fileData.id;

    // Check if the block already exists
    if (this.blocks.has(blockId)) {
      if ($DebugTestMode) {
        console.log(
          `🔄 Block with ID ${blockId} already exists. Returning existing block.`
        );
      }
      // Optional: Update existing block with new data if necessary
      const existingBlock = this.blocks.get(blockId);
      Object.assign(existingBlock, fileData); // Merge new data
      return existingBlock;
    }

    // If it doesn't exist, create and add it
    if ($DebugTestMode) {
      console.log(`✅ Block with ID ${blockId} not found. Creating new block.`);
    }
    const newBlock = {
      ...fileData, // Use all provided data
      id: blockId,
      content: fileData.content || "",
      originalContent: fileData.originalContent || fileData.content || "",
      extension: fileData.extension || this.getFileExtension(fileData.filename),
      language: fileData.language || "plaintext",
      size: fileData.content?.length || 0,
      wordCount: fileData.content?.split(/\s+/).length || 0,
      collapsed: true,
    };

    this.blocks.set(blockId, newBlock);
    return newBlock;
  },

  getBlockContent: function (blockId) {
    if ($DebugTestMode) {
      console.log("📄 getBlockContent called with blockId:", blockId);
    }
    const blockData = this.blocks.get(blockId);
    if (blockData) {
      // Check if we have JSON storage format
      if (blockData.originalJSON && blockData.parsedData) {
        if ($DebugTestMode) {
          console.log("📄 Found JSON storage format, returning display content");
        }
        // For display purposes, return the reconstructed content
        if (blockData.content && blockData.content.length > 0) {
          return blockData.content;
        }

        // If no display content, reconstruct from JSON
        return this.reconstructContentFromJSON(blockData.parsedData);
      }

      // Regular content storage
      if (blockData.content && blockData.content.length > 0) {
        return blockData.content;
      }
    }

    // Fallback to DOM
    const blockElement = document.getElementById(blockId);
    if (blockElement) {
      const codeElement = blockElement.querySelector(
        ".streaming-code, code, pre code"
      );
      if (codeElement && codeElement.textContent) {
        return codeElement.textContent;
      }
    }

    return "";
  },

  // NEW: Reconstruct content from JSON format
  reconstructContentFromJSON: function (parsedData) {
    if (!parsedData || !parsedData.sections) return "";

    const sections = parsedData.sections;
    const sortedSections = Object.entries(sections).sort((a, b) => {
      const aStart = a[1].start_line || 0;
      const bStart = b[1].start_line || 0;
      return aStart - bStart;
    });

    return sortedSections.map(([name, section]) => section.content).join("\n");
  },

  // NEW: Get original JSON for a file
  getOriginalJSON: function (blockId) {
    const blockData = this.blocks.get(blockId);
    return blockData?.originalJSON || null;
  },

  // NEW: Get parsed JSON data for a file
  getParsedData: function (blockId) {
    const blockData = this.blocks.get(blockId);
    return blockData?.parsedData || null;
  },

  // NEW: Get specific section from JSON
  getSection: function (blockId, sectionName) {
    const parsedData = this.getParsedData(blockId);
    return parsedData?.sections?.[sectionName] || null;
  },

  // NEW: Check if file has JSON storage format
  hasJSONStorage: function (blockId) {
    const blockData = this.blocks.get(blockId);
    return !!(blockData?.originalJSON && blockData?.parsedData);
  },

  // Update preview method similarly
  preview: function (blockId) {
    const content = this.getBlockContent(blockId);
    const blockData = this.blocks.get(blockId) || {};

    if (!content) {
      if ($DebugTestMode) {
        console.error("No content available for preview:", blockId);
      }
      alert("No content available for preview");
      return;
    }

    if ($DebugTestMode) {
      console.log("📄 Previewing content, length:", content.length);
      console.log("📄 First 200 chars:", content.substring(0, 200));
    }

    const previewWindow = window.open("", "_blank");
    if (previewWindow) {
      previewWindow.document.write(content);
      previewWindow.document.close();
    } else {
      alert(
        "Unable to open preview window. Please check your popup blocker settings."
      );
    }
  },
  // Update the viewCode method to use getBlockContent
  viewCode: function (blockId) {
    const content = this.getBlockContent(blockId);
    const blockData = this.blocks.get(blockId) || {};
    const filename = blockData.filename || "code.txt";
    const language = blockData.language || "plaintext";

    if (!content) {
      if ($DebugTestMode) {
        console.error("No content available for block:", blockId);
      }
      return;
    }

    const modal = document.createElement("div");
    modal.className = "code-modal";
    modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3>${this.escapeHtml(filename)}</h3>
        <div class="modal-actions">
          <button class="modal-btn" data-action="copy">📋 Copy</button>
          <button class="modal-btn" data-action="download">⬇️ Download</button>
          <button class="modal-btn close" data-action="close">✕</button>
        </div>
      </div>
      <div class="modal-body">
        <pre><code class="language-${language}">${this.escapeHtml(
      content
    )}</code></pre>
      </div>
    </div>
  `;

    document.body.appendChild(modal);

    // Apply syntax highlighting if available
    if (typeof hljs !== "undefined") {
      modal.querySelectorAll("pre code").forEach((block) => {
        hljs.highlightElement(block);
      });
    }

    // Add event listeners
    modal.addEventListener("click", (e) => {
      if (
        e.target.classList.contains("close") ||
        e.target.classList.contains("code-modal")
      ) {
        modal.remove();
      } else if (e.target.dataset.action === "copy") {
        navigator.clipboard.writeText(content);
        e.target.textContent = "✓ Copied!";
        setTimeout(() => (e.target.textContent = "📋 Copy"), 2000);
      } else if (e.target.dataset.action === "download") {
        this.downloadFile(filename, content);
      }
    });
  },

  createFileBlock: function (fileData, allFiles = []) {
    const blockId = `block_${fileData.id}`;

    if ($DebugTestMode) {
      console.log("🗂️ Creating file block with data:", {
        filename: fileData.filename,
        type: fileData.type,
        size: fileData.size,
        extension: fileData.extension,
        language: fileData.language,
        hasContent: !!fileData.content,
        contentLength: fileData.content ? fileData.content.length : 0,
      });
    }

    // ENHANCED: Create linked content for HTML files
    let finalContent = fileData.content;
    let linkedFiles = [];

    // ENHANCED: Ensure language is properly detected and stored
    let detectedLanguage = fileData.language;

    // If no language provided, detect from extension
    if (
      !detectedLanguage ||
      detectedLanguage === "text" ||
      detectedLanguage === "plaintext"
    ) {
      const extension =
        fileData.extension || this.getFileExtension(fileData.filename);
      detectedLanguage = this.getLanguageFromExtension(extension);
    }

    // If still no language, detect from content
    if (!detectedLanguage || detectedLanguage === "plaintext") {
      detectedLanguage = this.detectLanguageFromContent(fileData.content);
    }

    if ($DebugTestMode) {
      console.log("🗂️ Detected language for file:", detectedLanguage);
    }

    // Link HTML files with CSS/JS
    if (
      (fileData.extension === ".html" || fileData.extension === ".htm") &&
      allFiles.length > 0
    ) {
      if ($DebugTestMode) {
        console.log("🔗 HTML file detected, checking for related CSS/JS files");
      }

      const cssFiles = allFiles.filter(
        (f) =>
          f.extension === ".css" ||
          (f.filename && f.filename.toLowerCase().endsWith(".css"))
      );
      const jsFiles = allFiles.filter(
        (f) =>
          f.extension === ".js" ||
          (f.filename && f.filename.toLowerCase().endsWith(".js"))
      );

      if (cssFiles.length > 0 || jsFiles.length > 0) {
        if ($DebugTestMode) {
          console.log(
            `🔗 Found ${cssFiles.length} CSS and ${jsFiles.length} JS files to link`
          );
        }
        finalContent = this.linkFilesToHTML(
          fileData.content,
          cssFiles,
          jsFiles
        );
        linkedFiles = [...cssFiles, ...jsFiles];
      }
    }

    // ENHANCED: Ensure all metadata is present
    const block = {
      id: blockId,
      filename: fileData.filename || "untitled.txt",
      content: finalContent,
      originalContent: fileData.content,
      extension:
        fileData.extension ||
        this.getFileExtension(fileData.filename) ||
        ".txt",
      language: detectedLanguage || "plaintext", // Use detected language
      type: fileData.type || "text",
      size: fileData.size || (fileData.content ? fileData.content.length : 0),
      wordCount:
        fileData.word_count ||
        (fileData.content ? fileData.content.split(/\s+/).length : 0),
      isExecutable:
        fileData.is_executable ||
        fileData.extension === ".html" ||
        fileData.extension === ".htm",
      mimeType:
        fileData.mime_type || this.getMimeType(fileData.extension || ".txt"),
      collapsed: true,
      linkedFiles: linkedFiles,
      allFiles: allFiles,
    };

    if ($DebugTestMode) {
      console.log("🗂️ Created block with metadata:", {
        id: block.id,
        filename: block.filename,
        type: block.type,
        size: block.size,
        wordCount: block.wordCount,
        isExecutable: block.isExecutable,
        extension: block.extension,
        language: block.language,
      });
    }

    this.blocks.set(blockId, block);
    return this.renderFileBlock(block);
  },
  // Enhanced previewStreamingContent function for contentManager.js
  // This version properly updates CSS in real-time as it streams

  previewStreamingContent: function (fileId, streamingFile) {
    if ($DebugTestMode) {
      console.log(
        "🔍 previewStreamingContent called with fileId:",
        fileId,
        "Streaming File:",
        streamingFile
      );
    }

    // Fallback to contentManager.blocks if streamingFile is missing
    if (!streamingFile) {
      streamingFile = contentManager.blocks.get(fileId);
      if ($DebugTestMode) {
        console.warn(
          "🔍 No streaming file found in streamingFiles, falling back to blocks:",
          streamingFile
        );
      }
    }

    if (!streamingFile || !streamingFile.content) {
      if ($DebugTestMode) {
        console.error("No streaming content available for fileId:", fileId);
      }
      alert(
        "No streaming content available for preview. Please wait for streaming to start."
      );
      return;
    }

    const block = {
      id: fileId,
      filename: streamingFile.filename || "untitled.txt",
      content: streamingFile.content,
      originalContent: streamingFile.content,
      extension: streamingFile.extension || ".txt",
      language: streamingFile.language || "plaintext",
      type: streamingFile.type || "text",
      size: streamingFile.content.length,
      wordCount: streamingFile.content.split(/\s+/).length,
      isExecutable: streamingFile.is_executable || false,
      mimeType:
        streamingFile.mime_type ||
        this.getMimeType(streamingFile.extension || ".txt"),
      linkedFiles: streamingFile.linkedFiles || [],
      allFiles: streamingFile.allFiles || [],
      isRenderable: this.isRenderableContent(
        streamingFile.content,
        streamingFile.extension
      ),
      isStreaming: streamingFile.isStreaming || true,
    };

    if ($DebugTestMode) {
      console.log("🔍 Created temporary block for streaming preview:", block);
    }

    // Create the fullscreen preview
    const overlay = this.createFullscreenPreview(block);
    if (!overlay) {
      if ($DebugTestMode) {
        console.error("Failed to create fullscreen preview for fileId:", fileId);
      }
      return;
    }

    const previewContainer = overlay.querySelector(
      ".preview-content-container"
    );
    if (!previewContainer) {
      if ($DebugTestMode) {
        console.error("Preview container not found for live streaming");
      }
      return;
    }

    // Track current view mode
    let isCodeView = false;
    const viewCodeButton = overlay.querySelector("#viewCodeBtn");
    if (viewCodeButton) {
      viewCodeButton.addEventListener("click", () => {
        isCodeView = !isCodeView;
        updateViewMode();
        updatePreview();
      });
    }

    // Track last applied content to avoid unnecessary updates
    let lastAppliedHtml = "";
    let lastLinkedCssContent = {};
    let lastLinkedJsContent = {};

    // Function to update the view based on mode
    const updateViewMode = () => {
      const iframe = previewContainer.querySelector(".preview-iframe");
      const codeContainer = previewContainer.querySelector(
        ".code-view, .code-view-enhanced"
      );

      if (isCodeView) {
        if (iframe) iframe.style.display = "none";
        if (codeContainer) codeContainer.style.display = "block";
      } else {
        if (iframe) iframe.style.display = "block";
        if (codeContainer) codeContainer.style.display = "none";
      }
    };

    // Function to get current content of all streaming files
    const getCurrentStreamingFiles = () => {
      const currentFiles = [];

      // Get from chatManager.streamingResponseFiles first
      if (
        chatManager.streamingResponseFiles &&
        chatManager.streamingResponseFiles.length > 0
      ) {
        chatManager.streamingResponseFiles.forEach((file) => {
          // Get the latest content from streamingFiles
          const streamingFile =
            chatManager.streamingFiles.get(file.id) ||
            chatManager.streamingFiles.get(`file_${file.id}`);

          currentFiles.push({
            id: file.id,
            filename: file.filename,
            content: streamingFile ? streamingFile.content : file.content,
            extension: file.extension,
            type: file.type,
            language: file.language,
          });
        });
      }

      // Also check all streamingFiles in case some aren't in streamingResponseFiles yet
      chatManager.streamingFiles.forEach((file, key) => {
        if (
          !currentFiles.find((f) => f.id === file.backendId || f.id === file.id)
        ) {
          currentFiles.push({
            id: file.backendId || file.id,
            filename: file.filename,
            content: file.content,
            extension: file.extension,
            type: file.type,
            language: file.language,
          });
        }
      });

      return currentFiles;
    };

    // Function to check if linked content has changed
    const hasLinkedContentChanged = (cssFiles, jsFiles) => {
      // Check CSS changes
      for (const cssFile of cssFiles) {
        if (lastLinkedCssContent[cssFile.filename] !== cssFile.content) {
          return true;
        }
      }

      // Check JS changes
      for (const jsFile of jsFiles) {
        if (lastLinkedJsContent[jsFile.filename] !== jsFile.content) {
          return true;
        }
      }

      return false;
    };

    // Function to update the preview
    const updatePreview = () => {
      const updatedFile =
        chatManager.streamingFiles.get(fileId) ||
        chatManager.streamingFiles.get(fileId.replace("file_", "")) ||
        chatManager.streamingFiles.get(`file_${fileId}`) ||
        contentManager.blocks.get(fileId);

      if (!updatedFile || !updatedFile.content) return;

      // Update block content
      block.content = updatedFile.content;
      block.originalContent = updatedFile.content;
      block.size = updatedFile.content.length;
      block.wordCount = updatedFile.content.split(/\s+/).length;

      // Get ALL current streaming files
      const allCurrentFiles = getCurrentStreamingFiles();
      block.allFiles = allCurrentFiles;

      if ($DebugTestMode) {
        console.log(
          "🔄 Update preview - Total streaming files:",
          allCurrentFiles.length
        );
        allCurrentFiles.forEach((f) => {
          console.log(
            `🔄 File: ${f.filename} (${f.extension}) - Content length: ${
              f.content ? f.content.length : 0
            }`
          );
        });
      }

      // Update rendered view if not in code view
      if (!isCodeView && (block.isExecutable || block.isRenderable)) {
        const iframe = previewContainer.querySelector(".preview-iframe");
        if (iframe) {
          // Get current CSS and JS files
          const cssFiles = allCurrentFiles.filter(
            (f) =>
              f.extension === ".css" ||
              (f.filename && f.filename.toLowerCase().endsWith(".css"))
          );
          const jsFiles = allCurrentFiles.filter(
            (f) =>
              f.extension === ".js" ||
              (f.filename && f.filename.toLowerCase().endsWith(".js"))
          );

          // Check if we need to update (HTML changed OR linked files changed)
          const htmlChanged = block.content !== lastAppliedHtml;
          const linkedContentChanged = hasLinkedContentChanged(
            cssFiles,
            jsFiles
          );

          if (htmlChanged || linkedContentChanged) {
            if ($DebugTestMode) {
              console.log(
                "🔄 Updating preview - HTML changed:",
                htmlChanged,
                "Linked content changed:",
                linkedContentChanged
              );
              if (linkedContentChanged) {
                console.log(
                  "🔄 CSS files:",
                  cssFiles.map(
                    (f) => `${f.filename}: ${f.content.length} chars`
                  )
                );
              }
            }

            let fullHtml = block.content;

            // Link CSS and JS files
            if (
              (block.extension === ".html" || block.extension === ".htm") &&
              (cssFiles.length > 0 || jsFiles.length > 0)
            ) {
              // Create a proper HTML structure if needed
              if (!fullHtml.includes("<html") && !fullHtml.includes("<HTML")) {
                fullHtml = `<!DOCTYPE html>
<html>
<head>
</head>
<body>
${fullHtml}
</body>
</html>`;
              }

              // Link the files
              fullHtml = this.linkFilesToHTML(fullHtml, cssFiles, jsFiles);

              if ($DebugTestMode) {
                console.log(
                  "🔄 Linked files - CSS:",
                  cssFiles.length,
                  "JS:",
                  jsFiles.length
                );
              }
            }

            // Add navigation script
            const navigationScript = `
          <script>
            console.log('🔍 Preview loaded with linked content');
            // Navigation script content here...
          </script>
          `;

            if (fullHtml.includes("</body>")) {
              fullHtml = fullHtml.replace(
                "</body>",
                navigationScript + "</body>"
              );
            } else if (fullHtml.includes("</html>")) {
              fullHtml = fullHtml.replace(
                "</html>",
                navigationScript + "</html>"
              );
            } else {
              fullHtml = fullHtml + navigationScript;
            }

            const safeHtml = this.sanitizeHTML(fullHtml);
            iframe.srcdoc = this.escapeAttribute(safeHtml);

            // Update tracking variables
            lastAppliedHtml = block.content;
            cssFiles.forEach((css) => {
              lastLinkedCssContent[css.filename] = css.content;
            });
            jsFiles.forEach((js) => {
              lastLinkedJsContent[js.filename] = js.content;
            });

            if ($DebugTestMode) {
              console.log(
                "🔄 Preview updated with fresh content and linked files"
              );
            }
          }
        }
      }

      // Update code view if in code view
      if (isCodeView) {
        const codeContainer = previewContainer.querySelector(
          ".code-view, .code-view-enhanced"
        );
        if (codeContainer) {
          const codeElement = codeContainer.querySelector("pre code");
          if (codeElement) {
            codeElement.textContent = block.content;
            if (typeof hljs !== "undefined") {
              hljs.highlightElement(codeElement);
            }
            // Auto-scroll to bottom for streaming content
            codeContainer.scrollTop = codeContainer.scrollHeight;
          }
        }
      }
    };

    // Set up polling for live updates
    if (
      streamingFile.isStreaming ||
      (streamingFile.element &&
        streamingFile.element.classList.contains("streaming"))
    ) {
      if ($DebugTestMode) {
        console.log(
          "🔄 Setting up polling for live streaming with dynamic file linking"
        );
      }

      // Faster polling for better responsiveness
      const pollInterval = setInterval(() => {
        // Check if main file is still streaming
        const stillStreaming =
          chatManager.streamingFiles.has(fileId) ||
          chatManager.streamingFiles.has(fileId.replace("file_", "")) ||
          chatManager.streamingFiles.has(`file_${fileId}`);

        // Also check if ANY file is still streaming (for linked files)
        const anyFileStreaming = chatManager.streamingFiles.size > 0;

        if (!stillStreaming && !anyFileStreaming) {
          if ($DebugTestMode) {
            console.log("🔄 All streaming completed");
          }
          clearInterval(pollInterval);

          // Final update with all content
          updatePreview();

          // Remove streaming indicator
          const streamingIndicator = previewContainer.querySelector(
            ".streaming-indicator"
          );
          if (streamingIndicator) streamingIndicator.remove();
        } else {
          // Continue updating while any file is streaming
          updatePreview();
        }
      }, 250); // Faster polling (250ms instead of 500ms) for smoother updates

      // Initial update
      updatePreview();

      // Clean up on overlay close
      const closeButton = overlay.querySelector(
        ".close-preview, #closePreviewBtn"
      );
      if (closeButton) {
        closeButton.addEventListener(
          "click",
          () => {
            clearInterval(pollInterval);
            if ($DebugTestMode) {
              console.log("🔄 Cleaned up polling for preview");
            }
          },
          { once: true }
        );
      }

      // Also clean up if overlay is removed
      const observer = new MutationObserver((mutations) => {
        if (!document.body.contains(overlay)) {
          clearInterval(pollInterval);
          observer.disconnect();
          if ($DebugTestMode) {
            console.log("🔄 Cleaned up polling - overlay removed");
          }
        }
      });
      observer.observe(document.body, { childList: true });
    } else {
      // Not streaming, just do initial update
      updatePreview();
    }
  },

  sendFileChunk: function (fileId, chunk) {
    if ($DebugTestMode) {
      console.debug(
        "[sendFileChunk] Received chunk for file:",
        fileId,
        "Chunk size:",
        chunk.length
      );
    }

    const file =
      this.streamingFiles.get(fileId) ||
      this.streamingFiles.get(`file_${fileId}`);
    if (!file) {
      if ($DebugTestMode) {
        console.error(
          "[sendFileChunk] File not found in streamingFiles:",
          fileId
        );
      }
      return;
    }

    file.content += chunk;

    // Update the streamingResponseFiles array
    const responseFile = this.streamingResponseFiles.find(
      (f) => f.id === fileId
    );
    if (responseFile) {
      responseFile.content = file.content;
    }

    const codeElement = file.element.querySelector(".streaming-code");
    if (codeElement) {
      codeElement.textContent = file.content;
      if (typeof hljs !== "undefined") {
        hljs.highlightElement(codeElement);
      }
    }

    // Update contentManager block
    const normalizedFileId = `file_${file.backendId}`;
    const block = contentManager.blocks.get(normalizedFileId);
    if (block) {
      block.content = file.content;
      block.originalContent = file.content;
      block.size = file.content.length;
      block.wordCount = file.content.split(/\s+/).length;

      // ✅ FIXED LOGIC: Use the persistent streamingResponseFiles array
      // This ensures the complete list of files is always present.
      block.allFiles = this.streamingResponseFiles.map((f) => ({
        id: f.id,
        filename: f.filename,
        content: f.content,
        extension: f.extension,
        type: f.type,
        language: f.language,
      }));

      contentManager.blocks.set(normalizedFileId, block);

      if ($DebugTestMode) {
        console.log(
          "[sendFileChunk] Updated block with all streaming files:",
          block.allFiles.length
        );
      }
    }

    const content = document.getElementById("aiContent");
    if (content && this.isNearBottom(content)) {
      content.scrollTop = content.scrollHeight;
    }

    const loadingDots = file.element.querySelector(".loading-dots");
    if (loadingDots) {
      loadingDots.style.display = "block";
    }
  },

  linkFilesToHTML: function (htmlContent, cssFiles, jsFiles) {
    if ($DebugTestMode) {
      console.log("🔗 Running Inject-and-Clean linking for preview...");
    }
    let processedHtml = htmlContent;

    // 1. Ensure a proper HTML structure exists
    if (!/<head\b/i.test(processedHtml)) {
      processedHtml = `<!DOCTYPE html><html><head></head><body>${processedHtml}</body></html>`;
    }

    // 2. Inject all CSS content directly into the <head>
    if (cssFiles.length > 0) {
      const allCssContent = cssFiles
        .map(
          (file) =>
            `\n/*-- Injected from ${this.escapeHtml(file.filename)} --*/\n${
              file.content
            }`
        )
        .join("\n");
      processedHtml = processedHtml.replace(
        /<\/head>/i,
        `<style>${allCssContent}</style></head>`
      );
    }

    // 3. Inject all JS content directly before the closing </body>
    if (jsFiles.length > 0) {
      const allJsContent = jsFiles
        .map(
          (file) =>
            `\n/*-- Injected from ${this.escapeHtml(file.filename)} --*/\n${
              file.content
            }`
        )
        .join("\n");
      if (!/<\/body\b/i.test(processedHtml)) {
        processedHtml += "</body>"; // Ensure body tag exists
      }
      processedHtml = processedHtml.replace(
        /<\/body>/i,
        `<script>${allJsContent}</script></body>`
      );
    }

    // 4. Clean up: Remove the original <link> and <script> tags
    const allFiles = [...cssFiles, ...jsFiles];
    allFiles.forEach((file) => {
      const linkTagRegex = new RegExp(
        `<link[^>]+href\\s*=\\s*["'](?:\\.\\/|\\/)?${file.filename}["'][^>]*>`,
        "gi"
      );
      const scriptTagRegex = new RegExp(
        `<script[^>]+src\\s*=\\s*["'](?:\\.\\/|\\/)?${file.filename}["'][^>]*>\\s*<\\/script>`,
        "gi"
      );
      processedHtml = processedHtml.replace(linkTagRegex, ``);
      processedHtml = processedHtml.replace(scriptTagRegex, ``);
    });

    return processedHtml;
  },

  renderFileBlock: function (block) {
    const fileIcon = this.getFileIcon(block.type, block.extension);
    const previewText =
      block.originalContent.length > 200
        ? block.originalContent.substring(0, 200) + "..."
        : block.originalContent;

    // Show linked files info if available
    let linkedFilesInfo = "";
    if (block.linkedFiles && block.linkedFiles.length > 0) {
      linkedFilesInfo = `<div class="linked-files-info">
            <small>🔗 Linked: ${block.linkedFiles
              .map((f) => f.filename)
              .join(", ")}</small>
        </div>`;
    }

    // Add executable badge
    const executableBadge = block.isExecutable
      ? '<span class="executable-badge" title="This file can run standalone">⚡ Executable</span>'
      : "";
    // A helper to ensure the ID has the correct 'file_' prefix exactly once
    const ensureFileIdPrefix = (id) => {
      return id.startsWith("file_") ? id : `file_${id}`;
    };

    // Then in your create block function:
    const finalFileId = ensureFileIdPrefix(fileData.id);

    const html = `
        <div class="content-block file-block" id="${block.id}" data-type="${
      block.type
    }">
            <div class="block-header ${block.collapsed ? "collapsed" : ""}">
                <div class="block-info">
                    <div class="block-icon">${fileIcon}</div>
                    <div class="block-details">
                        <h4 class="filename">${this.escapeHtml(
                          block.filename
                        )}</h4>
                        <div class="block-meta">
                            <span class="file-size">${this.formatFileSize(
                              block.size
                            )}</span>
                            <span class="word-count">${
                              block.wordCount
                            } words</span>
                            <span class="file-type">${block.type}</span>
                            <span class="language">${block.language}</span>
                            ${executableBadge}
                        </div>
                        ${linkedFilesInfo}
                    </div>
                </div>
                <div class="block-actions">
                    ${
                      block.isExecutable
                        ? `<button class="block-btn primary" data-action="preview">👁️ Preview</button>`
                        : `<button class="block-btn" data-action="view-code">📝 View</button>`
                    }
                    <button class="block-btn" data-action="download">⬇️ Download</button>
                    <button class="block-btn" data-action="copy">📋 Copy</button>
                    <span class="collapse-indicator">▼</span>
                </div>
            </div>
            <div class="block-content ${
              block.collapsed ? "collapsed" : ""
            }" id="${block.id}_content">
                <div class="preview-content">
                    <pre><code class="language-${
                      block.language
                    }">${this.escapeHtml(previewText)}</code></pre>
                </div>
            </div>
        </div>
    `;

    return html;
  },

  previewContent: function (blockId) {
    if ($DebugTestMode) {
      console.log("🔍 previewContent called with blockId:", blockId);
      console.log("🔍 Blocks in Map:", Array.from(this.blocks));
    }

    const block = this.blocks.get(blockId);
    if ($DebugTestMode) {
      console.log("🔍 Block data:", block);
    }

    if (!block) {
      if ($DebugTestMode) {
        console.error("❌ Block not found for ID:", blockId);
      }
      return;
    }

    // CRITICAL FIX: Re-evaluate executability and renderability
    // Sometimes the initial detection might be wrong
    const isHtmlFile =
      block.extension === ".html" || block.extension === ".htm";
    const hasHtmlContent =
      block.content &&
      /<(html|head|body|div|script|style|p|h[1-6])/i.test(block.content);
    const shouldBeExecutable = isHtmlFile || hasHtmlContent;
    const shouldBeRenderable = shouldBeExecutable;

    if ($DebugTestMode) {
      console.log("🔍 Block analysis:", {
        type: block.type,
        extension: block.extension,
        isExecutable: block.isExecutable,
        isRenderable: block.isRenderable,
        isHtmlFile,
        hasHtmlContent,
        shouldBeExecutable,
        shouldBeRenderable,
        contentPreview: block.content
          ? block.content.substring(0, 100)
          : "NO CONTENT",
      });
    }

    // Update block properties if needed
    if (shouldBeExecutable && !block.isExecutable) {
      if ($DebugTestMode) {
        console.log("🔍 Updating block to be executable");
      }
      block.isExecutable = true;
    }

    if (shouldBeRenderable && !block.isRenderable) {
      if ($DebugTestMode) {
        console.log("🔍 Updating block to be renderable");
      }
      block.isRenderable = true;
    }

    // Decide what to do based on updated properties
    if (block.isExecutable || block.isRenderable || shouldBeExecutable) {
      if ($DebugTestMode) {
        console.log("🔍 Creating fullscreen preview");
      }
      this.createFullscreenPreview(block);
    } else {
      if ($DebugTestMode) {
        console.log("🔍 Showing code preview");
      }
      this.createFullscreenPreview(block, true);
    }
  },

  createFullscreenPreview: function (block, startInCodeView = false) {
    if ($DebugTestMode) {
      console.log("🔍 DEBUG: createFullscreenPreview called");
      console.log("🔍 DEBUG: Block data:", {
        id: block.id,
        filename: block.filename,
        hasContent: !!block.content,
        contentLength: block.content ? block.content.length : 0,
        isExecutable: block.isExecutable,
        isRenderable: block.isRenderable,
      });
    }
    const overlay = document.createElement("div");
    overlay.className = "fullscreen-preview";
    if ($DebugTestMode) {
      console.log("🔍 DEBUG: Overlay created");
    }
    // Store reference to contentManager for use in event handlers
    const self = this;

    overlay.addEventListener("click", function (e) {
      e.stopPropagation();
      if (e.target === overlay) {
        closePreview();
      }
    });

    const canRender = block.isExecutable || block.isRenderable;
    if ($DebugTestMode) {
      console.log("🔍 DEBUG: Can render:", canRender);
    }

    // This will only be true if the file can be rendered AND we haven't been asked to start in code view.
    const shouldShowIframeFirst = canRender && !startInCodeView;
    if ($DebugTestMode) {
      console.log("🔍 DEBUG: Should show iframe first:", shouldShowIframeFirst);
    }

    let iframeContent = "";
    let blobUrl = null;

    if (canRender) {
      let htmlContent = block.content;
      if ($DebugTestMode) {
        console.log("🔍 DEBUG: Original content length:", htmlContent.length);
        console.log(
          "🔍 DEBUG: Original content first 200 chars:",
          htmlContent.substring(0, 200)
        );
      }
      if (
        (block.extension === ".html" || block.extension === ".htm") &&
        block.allFiles
      ) {
        if ($DebugTestMode) {
          console.log("🔗 Regenerating file links for preview");
        }
        const cssFiles = block.allFiles.filter(
          (f) =>
            f.extension === ".css" ||
            (f.filename && f.filename.toLowerCase().endsWith(".css"))
        );
        const jsFiles = block.allFiles.filter(
          (f) =>
            f.extension === ".js" ||
            (f.filename && f.filename.toLowerCase().endsWith(".js"))
        );
        htmlContent = this.linkFilesToHTML(
          block.originalContent,
          cssFiles,
          jsFiles
        );
      }

      // CRITICAL DEBUG SECTION - Let's trace exactly what happens to the HTML
      if ($DebugTestMode) {
        console.log(
          "🔍 DEBUG: Before sanitization - HTML length:",
          htmlContent.length
        );
        console.log(
          "🔍 DEBUG: Before sanitization - HTML type:",
          typeof htmlContent
        );
        console.log(
          "🔍 DEBUG: Before sanitization - HTML preview:",
          htmlContent.substring(0, 300)
        );
      }
      const safeHtml = this.sanitizeHTML(htmlContent);
      if ($DebugTestMode) {
        console.log("🔍 DEBUG: After sanitization - length:", safeHtml.length);
        console.log("🔍 DEBUG: After sanitization - type:", typeof safeHtml);
        console.log(
          "🔍 DEBUG: After sanitization - preview:",
          safeHtml.substring(0, 300)
        );
      }
      // Check if sanitizeHTML is destroying the content
      if (!safeHtml || safeHtml.length === 0) {
        if ($DebugTestMode) {
          console.error("🔍 CRITICAL: sanitizeHTML returned empty content!");
          console.log("🔍 DEBUG: Using original content instead");
        }
        // Fallback to original content if sanitization fails
        const fallbackHtml = htmlContent;
        if ($DebugTestMode) {
          console.log("🔍 DEBUG: Fallback HTML length:", fallbackHtml.length);
        }
      }

      const navigationScript = `
    <script>
      console.log('🔍 DEBUG: Navigation script starting to load');
      
      try {
        window.addEventListener('load', function() {
          console.log('🔍 DEBUG: Window load event fired');
          console.log('🔍 DEBUG: Document readyState:', document.readyState);
          console.log('🔍 DEBUG: Document URL:', document.URL);
          console.log('🔍 DEBUG: Document title:', document.title);
          console.log('🔍 DEBUG: Body element exists:', !!document.body);
          console.log('🔍 DEBUG: Body innerHTML length:', document.body ? document.body.innerHTML.length : 0);
          
          // Log any existing errors
          window.onerror = function(msg, url, lineNo, columnNo, error) {
            console.error('🔍 DEBUG: JavaScript error detected:', {
              message: msg,
              source: url,
              line: lineNo,
              column: columnNo,
              error: error
            });
            return false;
          };
        });
      } catch (error) {
        console.error('🔍 DEBUG: Error in navigation script:', error);
        console.error('🔍 DEBUG: Error stack:', error.stack);
      }
      
      console.log('🔍 DEBUG: Navigation script definition complete');
    </script>
  `;

      // Build final HTML with navigation script
      let finalHtml;
      if (safeHtml && safeHtml.length > 0) {
        if (safeHtml.includes("</body>")) {
          finalHtml = safeHtml.replace("</body>", navigationScript + "</body>");
        } else if (safeHtml.includes("</html>")) {
          finalHtml = safeHtml.replace("</html>", navigationScript + "</html>");
        } else {
          finalHtml = safeHtml + navigationScript;
        }
      } else {
        if ($DebugTestMode) {
          console.warn(
            "🔍 DEBUG: Using original content due to sanitization failure"
          );
        }
        finalHtml = htmlContent + navigationScript;
      }

      if ($DebugTestMode) {
        console.log("🔍 DEBUG: Final HTML length:", finalHtml.length);
        console.log(
          "🔍 DEBUG: Final HTML preview (first 400 chars):",
          finalHtml.substring(0, 400)
        );
      }

      // CRITICAL: Debug the escapeAttribute function
      if ($DebugTestMode) {
        console.log("🔍 DEBUG: About to escape attribute...");
        console.log(
          "🔍 DEBUG: Input to escapeAttribute length:",
          finalHtml.length
        );
        console.log("🔍 DEBUG: Input contains quotes:", finalHtml.includes('"'));
        console.log(
          "🔍 DEBUG: Input contains single quotes:",
          finalHtml.includes("'")
        );
      }

      const escapedContent = this.escapeAttribute(finalHtml);
      if ($DebugTestMode) {
        console.log("🔍 DEBUG: Escaped content length:", escapedContent.length);
        console.log(
          "🔍 DEBUG: Escaped content preview (first 400 chars):",
          escapedContent.substring(0, 400)
        );
      }

      // Check if escaping broke the content
      if (escapedContent.length === 0) {
        if ($DebugTestMode) {
          console.error("🔍 CRITICAL: escapeAttribute returned empty string!");
          console.log("🔍 DEBUG: Original finalHtml:", finalHtml);
        }
      }

      // Create iframe with detailed debugging
      if ($DebugTestMode) {
        console.log("🔍 DEBUG: Creating iframe HTML...");
      }
      iframeContent = `
    <iframe 
      class="preview-iframe" 
      srcdoc="${escapedContent}"
      style="width: 100%; height: 100%; border: none;"
      sandbox="allow-scripts"
      data-filename="${this.escapeHtml(block.filename)}"
      data-debug-content-length="${escapedContent.length}"
    ></iframe>
  `;

      if ($DebugTestMode) {
        console.log(
          "🔍 DEBUG: iframeContent created, length:",
          iframeContent.length
        );
        console.log(
          "🔍 DEBUG: iframeContent preview:",
          iframeContent.substring(0, 200)
        );
      }

      // Verify the srcdoc attribute is actually in the HTML
      const srcdocMatch = iframeContent.match(/srcdoc="([^"]*)/);
      if (srcdocMatch) {
        if ($DebugTestMode) {
          console.log(
            "🔍 DEBUG: Found srcdoc in iframe HTML, length:",
            srcdocMatch[1].length
          );
          console.log(
            "🔍 DEBUG: srcdoc preview:",
            srcdocMatch[1].substring(0, 100)
          );
        }
      } else {
        if ($DebugTestMode) {
          console.error("🔍 CRITICAL: No srcdoc found in iframe HTML!");
        }
      }
    } else {
      iframeContent = `<div class="code-view-wrapper" style="height: 100%; overflow: auto;"></div>`;
      if ($DebugTestMode) {
        console.log("🔍 DEBUG: Created code view wrapper instead of iframe");
      }
    }

    // Create overlay HTML with debugging
    if ($DebugTestMode) {
      console.log("🔍 DEBUG: Creating overlay innerHTML...");
    }
    overlay.innerHTML = `
  <div class="preview-header">
    <span class="preview-title">${this.escapeHtml(block.filename)}</span>
    <div class="preview-controls">
      ${
        canRender
          ? `<button class="preview-btn" id="viewCodeBtn">📝 View Code</button>`
          : ""
      }
      ${
        block.linkedFiles && block.linkedFiles.length > 0
          ? `<button class="preview-btn" id="showLinkedBtn">🔗 Show Linked Files</button>`
          : ""
      }
      <button class="preview-btn close-preview" id="closePreviewBtn">✕ Close</button>
    </div>
  </div>
  <div class="preview-content-container">
    ${iframeContent}
  </div>
`;
    if ($DebugTestMode) {
      console.log("🔍 DEBUG: Overlay innerHTML set");
      console.log("🔍 DEBUG: Overlay HTML length:", overlay.innerHTML.length);
    }

    // Check if body exists before appending
    if (!document.body) {
      if ($DebugTestMode) {
        console.error("🔍 DEBUG: document.body is null!");
      }
      return;
    }

    document.body.appendChild(overlay);
    document.body.classList.add("preview-open");
    if ($DebugTestMode) {
      console.log("🔍 DEBUG: Overlay appended to body");
    }

    // Verify the overlay was added
    const addedOverlay = document.querySelector(".fullscreen-preview");
    if ($DebugTestMode) {
      console.log("🔍 DEBUG: Overlay found in DOM:", !!addedOverlay);
    }

    // ENHANCED: Check iframe creation with multiple verification methods
    setTimeout(() => {
      if ($DebugTestMode) {
        console.log("🔍 DEBUG: === IFRAME VERIFICATION (100ms) ===");
      }

      const container = overlay.querySelector(".preview-content-container");
      if ($DebugTestMode) {
        console.log("🔍 DEBUG: Preview container found:", !!container);
      }

      if (container) {
        if ($DebugTestMode) {
          console.log(
            "🔍 DEBUG: Container innerHTML length:",
            container.innerHTML.length
          );
          console.log("🔍 DEBUG: Container innerHTML:", container.innerHTML);
        }
      }

      const iframe = overlay.querySelector(".preview-iframe");
      if ($DebugTestMode) {
        console.log("🔍 DEBUG: Iframe element found:", !!iframe);
      }

      if (iframe) {
        if ($DebugTestMode) {
          console.log("🔍 DEBUG: === IFRAME DETAILED ANALYSIS ===");
          console.log("  - tagName:", iframe.tagName);
          console.log("  - className:", iframe.className);
          console.log("  - id:", iframe.id);
        }

        // Check all attributes
        const attributes = {};
        for (let i = 0; i < iframe.attributes.length; i++) {
          const attr = iframe.attributes[i];
          attributes[attr.name] =
            attr.value.length > 100
              ? `${attr.value.substring(0, 100)}... (${
                  attr.value.length
                } total)`
              : attr.value;
        }
        if ($DebugTestMode) {
          console.log("  - all attributes:", attributes);
        }

        // Specifically check srcdoc
        const srcdocValue = iframe.getAttribute("srcdoc");
        if ($DebugTestMode) {
          console.log("  - srcdoc via getAttribute exists:", !!srcdocValue);
          console.log(
            "  - srcdoc via getAttribute length:",
            srcdocValue ? srcdocValue.length : 0
          );
          console.log("  - srcdoc via property exists:", !!iframe.srcdoc);
          console.log(
            "  - srcdoc via property length:",
            iframe.srcdoc ? iframe.srcdoc.length : 0
          );
        }
        if (srcdocValue) {
          if ($DebugTestMode) {
            console.log(
              "  - srcdoc content preview:",
              srcdocValue.substring(0, 200)
            );
          }

          // Check if it's properly HTML
          if (
            srcdocValue.includes("<html") ||
            srcdocValue.includes("<body") ||
            srcdocValue.includes("<div")
          ) {
            if ($DebugTestMode) {
              console.log("  - ✅ srcdoc contains HTML tags");
            }
          } else {
            if ($DebugTestMode) {
              console.warn("  - ⚠️ srcdoc does not contain expected HTML tags");
            }
          }
        } else {
          if ($DebugTestMode) {
            console.error("  - ❌ srcdoc is completely missing!");
          }

          // Try to manually set it for debugging
          if ($DebugTestMode) {
            console.log("  - Attempting manual srcdoc set...");
          }
          iframe.setAttribute(
            "srcdoc",
            "<html><body><h1>Manual Test</h1><p>This is a manual test to see if srcdoc works at all.</p></body></html>"
          );

          setTimeout(() => {
            if ($DebugTestMode) {
              console.log(
                "  - After manual set, srcdoc exists:",
                !!iframe.srcdoc
              );
              console.log(
                "  - After manual set, srcdoc length:",
                iframe.srcdoc ? iframe.srcdoc.length : 0
              );
            }
          }, 100);
        }

        // Check iframe state
        if ($DebugTestMode) {
          console.log("  - contentWindow exists:", !!iframe.contentWindow);
          console.log("  - contentDocument exists:", !!iframe.contentDocument);
        }

        // Try to access content
        try {
          if (iframe.contentDocument) {
            if ($DebugTestMode) {
              console.log(
                "  - contentDocument.readyState:",
                iframe.contentDocument.readyState
              );
              console.log(
                "  - contentDocument.documentElement exists:",
                !!iframe.contentDocument.documentElement
              );
              console.log(
                "  - contentDocument.body exists:",
                !!iframe.contentDocument.body
              );
            }

            if (iframe.contentDocument.body) {
              if ($DebugTestMode) {
                console.log(
                  "  - contentDocument.body.innerHTML length:",
                  iframe.contentDocument.body.innerHTML.length
                );
              }
            }
          }
        } catch (e) {
          if ($DebugTestMode) {
            console.error("  - Error accessing iframe content:", e.message);
          }
        }
      } else {
        if ($DebugTestMode) {
          console.error("🔍 DEBUG: NO IFRAME FOUND!");
        }

        // Check what's actually in the container
        if (container) {
          const allElements = container.querySelectorAll("*");
          if ($DebugTestMode) {
            console.log("🔍 DEBUG: Elements in container:", allElements.length);
          }
          allElements.forEach((el, i) => {
            if ($DebugTestMode) {
              console.log(`  - Element ${i}: ${el.tagName}.${el.className}`);
            }
          });

          // Check raw HTML
          if ($DebugTestMode) {
            console.log("🔍 DEBUG: Raw container HTML:", container.innerHTML);
          }
        }
      }
    }, 100);

    // Check again after longer delay
    setTimeout(() => {
      if ($DebugTestMode) {
        console.log("🔍 DEBUG: === FINAL IFRAME CHECK (2000ms) ===");
      }
      const iframe = overlay.querySelector(".preview-iframe");
      if (iframe) {
        if ($DebugTestMode) {
          console.log("🔍 DEBUG: Final iframe status:");
          console.log(
            "  - srcdoc length:",
            iframe.srcdoc ? iframe.srcdoc.length : 0
          );
          console.log("  - contentDocument exists:", !!iframe.contentDocument);
        }

        if (iframe.contentDocument && iframe.contentDocument.body) {
          if ($DebugTestMode) {
            console.log(
              "  - body content exists:",
              iframe.contentDocument.body.innerHTML.length > 0
            );
            console.log(
              "  - body background:",
              getComputedStyle(iframe.contentDocument.body).backgroundColor
            );
          }
        }
      } else {
        if ($DebugTestMode) {
          console.error("🔍 DEBUG: Still no iframe after 2 seconds!");
        }
      }
    }, 2000);

    if (!shouldShowIframeFirst) {
      setTimeout(() => {
        // This re-uses the existing function that the "View Code" button calls
        showEnhancedCodeView();
      }, 50); // A small delay ensures the modal is in the DOM first
    }

    function closePreview() {
      // Clean up any streaming intervals
      const container = overlay.querySelector(".preview-content-container");
      if (container && container.streamingInterval) {
        clearInterval(container.streamingInterval);
      }

      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
      document.body.classList.remove("preview-open");
      document.body.style.overflow = "";
      try {
        if (document.body.contains(overlay)) {
          document.body.removeChild(overlay);
        }
      } catch (error) {
        if ($DebugTestMode) {
          console.error("Error removing overlay:", error);
        }
      }
      document.removeEventListener("keydown", escapeHandler);
    }

    function showEnhancedCodeView() {
      const container = overlay.querySelector(".preview-content-container");
      if (!window.chatInputManager) {
        if ($DebugTestMode) {
          console.error(
            "chatInputManager not available, falling back to simple view"
          );
        }
        showSimpleCodeView();
        return;
      }

      const tempPreviewId = `preview_code_${block.id}_${Date.now()}`;
      if (!window.chatInputManager.largeContentStore) {
        if ($DebugTestMode) {
          console.log("🔍 Creating largeContentStore");
        }
        window.chatInputManager.largeContentStore = new Map();
      }

      let language = block.language;
      if (!language && block.extension) {
        language = self.getLanguageFromExtension(block.extension);
      }
      if (!language && block.type) {
        language = self.getLanguageFromType(block.type);
      }

      window.chatInputManager.largeContentStore.set(tempPreviewId, {
        content: block.content || block.originalContent,
        originalContent: block.originalContent,
        filename: block.filename,
        type: block.type,
        extension: block.extension,
        language: language || "plaintext",
      });

      if (typeof hljs === "undefined") {
        const script = document.createElement("script");
        script.src =
          "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js";
        script.onload = function () {
          const link = document.createElement("link");
          link.rel = "stylesheet";
          link.href =
            "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/vs2015.min.css";
          document.head.appendChild(link);
          setTimeout(() => {
            displayEnhancedCode();
          }, 50);
        };
        document.head.appendChild(script);
      } else {
        displayEnhancedCode();
      }

      function displayEnhancedCode() {
        const contentData =
          window.chatInputManager.largeContentStore.get(tempPreviewId);
        if (!contentData) return;

        container.innerHTML = `
        <div class="code-view-enhanced" style="background-color: #1e1e1e; color: #d4d4d4; height: 100%; overflow: auto; padding: 20px 0;">
          <div class="loading-code">Preparing code view...</div>
        </div>
      `;

        setTimeout(() => {
          const codeContainer = container.querySelector(".code-view-enhanced");
          if (codeContainer && window.chatInputManager.createHighlightedCode) {
            codeContainer.innerHTML =
              window.chatInputManager.createHighlightedCode(
                contentData.content,
                contentData.language
              );
            setupCodeFoldHandlers();
            if ($DebugTestMode) {
              console.log(
                "🔍 Displayed enhanced code view for block:",
                block.id,
                "Language:",
                contentData.language
              );
            }
          }
        }, 50);
      }
    }

    function showSimpleCodeView() {
      const container = overlay.querySelector(".preview-content-container");
      container.innerHTML = `
      <div class="code-view" style="background: #1e1e1e; color: #d4d4d4; padding: 20px; height: 100%; overflow: auto;">
        <pre style="margin: 0;"><code class="language-${
          block.language || "text"
        }">${self.escapeHtml(block.content)}</code></pre>
      </div>
    `;
      if (typeof hljs !== "undefined") {
        const codeElement = container.querySelector("code");
        if (codeElement) {
          hljs.highlightElement(codeElement);
          if ($DebugTestMode) {
            console.log(
              "🔍 Applied highlighting to simple code view:",
              block.id
            );
          }
        }
      }
    }

    function setupCodeFoldHandlers() {
      overlay.addEventListener("click", (e) => {
        if (
          e.target.classList.contains("fold-marker") ||
          e.target.classList.contains("fold-placeholder")
        ) {
          const foldId = e.target.dataset.foldId;
          if (window.chatInputManager && window.chatInputManager.toggleFold) {
            window.chatInputManager.toggleFold(foldId);
          }
        }
      });
    }

    const closeBtn = overlay.querySelector("#closePreviewBtn");
    const viewCodeBtn = overlay.querySelector("#viewCodeBtn");
    const showLinkedBtn = overlay.querySelector("#showLinkedBtn");

    closeBtn?.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      closePreview();
    });

    if (viewCodeBtn && canRender) {
      viewCodeBtn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        const container = overlay.querySelector(".preview-content-container");
        const isShowingCode = container.querySelector(
          ".code-view-enhanced, .code-view"
        );

        if (isShowingCode) {
          // Switch back to iframe view
          let regeneratedHTML = block.content;
          if (
            (block.extension === ".html" || block.extension === ".htm") &&
            block.allFiles
          ) {
            const cssFiles = block.allFiles.filter(
              (f) =>
                f.extension === ".css" ||
                (f.filename && f.filename.toLowerCase().endsWith(".css"))
            );
            const jsFiles = block.allFiles.filter(
              (f) =>
                f.extension === ".js" ||
                (f.filename && f.filename.toLowerCase().endsWith(".js"))
            );
            regeneratedHTML = contentManager.linkFilesToHTML(
              block.originalContent,
              cssFiles,
              jsFiles
            );
          }
          const safeHtml = contentManager.sanitizeHTML(regeneratedHTML);
          container.innerHTML = `
          <iframe 
            class="preview-iframe" 
            srcdoc="${contentManager.escapeAttribute(safeHtml)}"
            style="width: 100%; height: 100%; border: none;"
            sandbox="allow-scripts"
          ></iframe>
        `;
          viewCodeBtn.innerHTML = "📝 View Code";

          // Clear any streaming interval if exists
          if (container.streamingInterval) {
            clearInterval(container.streamingInterval);
            container.streamingInterval = null;
          }

          if ($DebugTestMode) {
            console.log("🔍 Switched to iframe view for block:", block.id);
          }
        } else {
          // Switch to code view
          const isStreaming =
            block.isStreaming ||
            (chatManager.streamingFiles &&
              (chatManager.streamingFiles.has(block.id) ||
                chatManager.streamingFiles.has(
                  block.id.replace("block_", "")
                ) ||
                chatManager.streamingFiles.has(`file_${block.id}`)));

          if (isStreaming) {
            // Create enhanced streaming code view with line numbers
            container.innerHTML = `
            <div class="code-view-enhanced streaming-enhanced" style="background-color: #1e1e1e; color: #d4d4d4; height: 100%; overflow: auto; padding: 20px 0; position: relative;">
              <div class="code-lines-container" style="display: flex; font-family: 'Consolas', 'Monaco', monospace; font-size: 14px; line-height: 1.5;">
                <div class="line-numbers" style="user-select: none; text-align: right; padding-right: 5px; padding-left: 20px; color: #858585; background: #1e1e1e; position: sticky; left: 0; z-index: 1;"></div>
                <div class="code-content" style="flex: 1; white-space: pre;">
                  <pre style="margin: 0;"><code class="language-${
                    block.language || "text"
                  }" style="display: block;"></code></pre>
                </div>
              </div>
            </div>
          `;

            const codeContainer = container.querySelector(
              ".code-view-enhanced"
            );
            const lineNumbersContainer =
              container.querySelector(".line-numbers");
            const codeElement = container.querySelector("pre code");

            // Initialize state tracking
            let lastLineCount = 0;
            let isUserScrolling = false;
            let userScrollTimeout = null;

            // Track user scrolling
            codeContainer.addEventListener("scroll", () => {
              isUserScrolling = true;
              clearTimeout(userScrollTimeout);
              userScrollTimeout = setTimeout(() => {
                isUserScrolling = false;
              }, 1000); // Consider user done scrolling after 1 second
            });

            // Function to update line numbers efficiently
            function updateLineNumbers(content) {
              const lines = content.split("\n");
              const newLineCount = lines.length;

              // Only update if line count changed
              if (newLineCount !== lastLineCount) {
                // Generate line numbers HTML
                const lineNumbersHtml = [];
                for (let i = 1; i <= newLineCount; i++) {
                  lineNumbersHtml.push(
                    `<div class="line-number" style="padding: 0 10px; height: 1.5em;">${i}</div>`
                  );
                }
                lineNumbersContainer.innerHTML = lineNumbersHtml.join("");
                lastLineCount = newLineCount;
              }
            }

            // Function to apply syntax highlighting with minimal DOM impact
            function applySyntaxHighlighting(codeElement, content) {
              // Store current selection if any
              const selection = window.getSelection();
              const hadSelection = selection.rangeCount > 0;
              let selectionRange = null;

              if (hadSelection) {
                selectionRange = selection.getRangeAt(0).cloneRange();
              }

              // Update content
              codeElement.textContent = content;

              // Apply highlighting if available
              if (typeof hljs !== "undefined") {
                hljs.highlightElement(codeElement);

                // Add fold markers for functions, classes, etc.
                if (
                  window.chatInputManager &&
                  window.chatInputManager.addFoldMarkers
                ) {
                  // This would need to be implemented to add fold markers without full recreation
                  addStreamingFoldMarkers(codeElement, block.language);
                }
              }

              // Restore selection if it existed
              if (hadSelection && selectionRange) {
                try {
                  selection.removeAllRanges();
                  selection.addRange(selectionRange);
                } catch (e) {
                  // Selection restoration might fail if content changed significantly
                }
              }
            }

            // Function to add fold markers for streaming
            function addStreamingFoldMarkers(codeElement, language) {
              // This is a simplified version - you'd need to implement based on your folding logic
              const codeText = codeElement.textContent;
              const lines = codeText.split("\n");

              // Define patterns for foldable regions based on language
              const foldPatterns = {
                javascript: [
                  /^[\s]*(?:function|class|if|for|while|switch|try)\s*\(/,
                  /^[\s]*(?:const|let|var)\s+\w+\s*=\s*(?:function|\()/,
                  /^[\s]*\w+\s*:\s*function/,
                ],
                python: [
                  /^[\s]*(?:def|class|if|for|while|try|with)\s+/,
                  /^[\s]*@\w+/, // decorators
                ],
                java: [
                  /^[\s]*(?:public|private|protected)?\s*(?:static)?\s*(?:class|interface|enum)\s+/,
                  /^[\s]*(?:public|private|protected)?\s*(?:static)?\s*\w+\s+\w+\s*\(/,
                ],
                // Add more languages as needed
              };

              const patterns = foldPatterns[language] || [];

              // This would need more sophisticated implementation to actually insert fold markers
              // without disrupting the highlighting
            }

            // Enhanced update function
            const updateStreamingCodeView = () => {
              const updatedFile =
                chatManager.streamingFiles.get(block.id) ||
                chatManager.streamingFiles.get(
                  block.id.replace("block_", "")
                ) ||
                chatManager.streamingFiles.get(`file_${block.id}`) ||
                contentManager.blocks.get(block.id);

              if (updatedFile && updatedFile.content) {
                // Update block content
                block.content = updatedFile.content;
                block.originalContent = updatedFile.content;

                // Update line numbers
                updateLineNumbers(block.content);

                // Apply syntax highlighting with minimal disruption
                applySyntaxHighlighting(codeElement, block.content);

                // Smart scrolling - only auto-scroll if user isn't actively scrolling
                if (!isUserScrolling && codeContainer) {
                  // Check if we're near the bottom before update
                  const wasNearBottom =
                    codeContainer.scrollTop + codeContainer.clientHeight >=
                    codeContainer.scrollHeight - 100;

                  if (wasNearBottom) {
                    // Smooth scroll to bottom
                    requestAnimationFrame(() => {
                      codeContainer.scrollTo({
                        top: codeContainer.scrollHeight,
                        behavior: "smooth",
                      });
                    });
                  }
                }
              }
            };

            // Add CSS for enhanced styling
            const enhancedStyles = document.createElement("style");
            enhancedStyles.textContent = `
            .streaming-enhanced .line-number {
              border-right: 1px solid #3e3e3e;
              transition: background-color 0.2s;
            }
            
            .streaming-enhanced .line-number:hover {
              background-color: rgba(255, 255, 255, 0.05);
              cursor: pointer;
            }
            
            /* Fold indicators (if implementing folding) */
            .streaming-enhanced .fold-marker {
              display: inline-block;
              width: 12px;
              height: 12px;
              margin-right: 4px;
              cursor: pointer;
              user-select: none;
              color: #858585;
            }
            
            .streaming-enhanced .fold-marker:hover {
              color: #d4d4d4;
            }
            
            /* Highlight animation for new content */
            @keyframes highlight-new {
              from { background-color: rgba(255, 255, 0, 0.1); }
              to { background-color: transparent; }
            }
            
            .streaming-enhanced .new-line {
              animation: highlight-new 1s ease-out;
            }
            
            /* Better syntax highlighting theme integration */
            .streaming-enhanced pre code {
              background: transparent !important;
              padding: 0 !important;
            }
          `;

            if (!document.querySelector("#streaming-enhanced-styles")) {
              enhancedStyles.id = "streaming-enhanced-styles";
              document.head.appendChild(enhancedStyles);
            }

            // Initial update
            updateStreamingCodeView();

            // Set up polling interval
            container.streamingInterval = setInterval(() => {
              if (
                !chatManager.streamingFiles.has(block.id) &&
                !chatManager.streamingFiles.has(
                  block.id.replace("block_", "")
                ) &&
                !chatManager.streamingFiles.has(`file_${block.id}`)
              ) {
                clearInterval(container.streamingInterval);
                container.streamingInterval = null;

                // Add a visual indicator that streaming is complete
                const statusIndicator = document.createElement("div");
                statusIndicator.className = "streaming-complete";
                statusIndicator.textContent = "✓ Streaming complete";
                statusIndicator.style.cssText =
                  "position: absolute; top: 10px; right: 10px; color: #4caf50; font-size: 12px;";
                codeContainer.appendChild(statusIndicator);

                setTimeout(() => statusIndicator.remove(), 3000);
              } else {
                updateStreamingCodeView();
              }
            }, 500);

            viewCodeBtn.innerHTML = "👁️ View Preview";
          } else {
            // Non-streaming code view
            showEnhancedCodeView();
          }
          viewCodeBtn.innerHTML = "👁️ View Preview";
        }
      });
    }

    if (showLinkedBtn && block.linkedFiles && block.linkedFiles.length > 0) {
      showLinkedBtn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        const linkedFilesInfo = block.linkedFiles
          .map((file