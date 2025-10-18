// fileUpdateHandler.js - Memory-efficient update handling with version switching
"use strict";

if (typeof $DebugTestMode === "undefined") {
  $DebugTestMode = true;
}

var fileUpdateHandler = {
  // Track file versions efficiently - only store deltas
  fileVersions: new Map(), // fileId -> { versions: Map(version -> {sections, metadata}), currentVersion: number }
  updateBuffer: new Map(), // Temporary storage for streaming updates

  init: function () {
    console.log("🔄 FileUpdateHandler initialized");
  },
  formatFileSize: function (bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + " KB";
    return Math.round(bytes / (1024 * 1024)) + " MB";
  },
  // Handle incoming file updates from backend
  handleFileUpdate: function (updateData) {
    console.log("🔄 === HANDLING FILE UPDATE ===");
    console.log("🔄 Update data:", updateData);

    const filename = updateData.filename;
    const updateType = updateData.update_type;

    if (!filename) {
      console.error("🔄 ❌ No filename in update data");
      return;
    }

    // Find existing file by filename
    const existingFileId = this.findFileByName(filename);

    if (updateType === "partial" && existingFileId) {
      console.log("🔄 Processing partial update for existing file:", filename);
      this.handlePartialUpdate(existingFileId, updateData);
    } else {
      console.log("🔄 Processing as new file or complete update:", filename);
      this.handleCompleteFile(updateData);
    }
  },

  // Find file by filename in current streaming files or content blocks
  findFileByName: function (filename) {
    // Check streaming files first
    if (chatManager.streamingResponseFiles) {
      const streamingFile = chatManager.streamingResponseFiles.find(
        (f) => f.filename === filename
      );
      if (streamingFile) return streamingFile.id;
    }

    // Check content manager blocks
    for (const [blockId, block] of contentManager.blocks) {
      if (block.filename === filename) return blockId;
    }

    return null;
  },

  handlePartialUpdate: function (fileId, updateData) {
    console.log("🔄 === PARTIAL UPDATE PROCESSING ===");
    console.log("🔄 File ID:", fileId);
    console.log(
      "🔄 Update sections:",
      Object.keys(updateData.sections_modified || {})
    );

    let versionData = this.fileVersions.get(fileId);
    let previousSections;
    let newVersionNumber;

    if (!versionData) {
      // --- CASE 1: FIRST UPDATE (Creating Version 1) ---
      console.log(
        "File has no version history. Creating Version 1 from initial content + update."
      );

      // --- FIX STARTS HERE ---
      // Get the original sections (which is likely a plain object)
      const rawInitialSections =
        this.getCurrentFileContent(fileId)?.sections || {};
      // Convert the plain object into a proper Map, which is iterable
      const initialSections = new Map(Object.entries(rawInitialSections));
      // --- FIX ENDS HERE ---

      // Initialize the version tracking structure.
      versionData = {
        versions: new Map(),
        currentVersion: 0, // Will become 1 after the update.
        filename: updateData.filename,
      };
      this.fileVersions.set(fileId, versionData);

      // For the first version, the "previous" state is the initial, unmodified content.
      previousSections = initialSections;
      newVersionNumber = 1;
    } else {
      // --- CASE 2: SUBSEQUENT UPDATE (Creating Version N+1) ---
      console.log(
        `File has existing versions. Creating new version from v${versionData.currentVersion}.`
      );

      // Get the sections from the most recent version.
      const previousVersion = versionData.versions.get(
        versionData.currentVersion
      );
      previousSections = previousVersion.sections;
      newVersionNumber = versionData.currentVersion + 1;
    }

    // --- COMMON LOGIC: APPLY UPDATE, STORE NEW VERSION, AND UPDATE FILE ---

    // 1. Create a mutable copy of the sections from the previous state.
    const newSections = new Map(previousSections);

    // 2. Apply the incoming changes (modified, added, removed) to this new copy.
    this.applySectionChanges(newSections, updateData);

    // 3. Assemble the data packet for our new version.
    const newVersionData = {
      sections: newSections,
      metadata: {
        timestamp: new Date().toISOString(),
        isOriginal: newVersionNumber === 1, // Only true for the very first version created.
        changeCount:
          Object.keys(updateData.sections_modified || {}).length +
          Object.keys(updateData.sections_added || {}).length +
          (updateData.sections_removed || []).length,
      },
      changes: {
        // Record what changed in this version
        modified: updateData.sections_modified || {},
        added: updateData.sections_added || {},
        removed: updateData.sections_removed || [],
      },
    };

    // 4. Store the new version in our version map and update the main pointer.
    versionData.versions.set(newVersionNumber, newVersionData);
    versionData.currentVersion = newVersionNumber;

    // 5. Reconstruct the full text content from the updated sections map.
    console.log(
      "⚙️ Input to reconstructContent (newVersionData.sections):",
      newVersionData.sections
    );
    const newContent = this.reconstructContent(newVersionData.sections);
    console.log(
      `➡️ [${newVersionNumber}. HPU] newContent created. Length:`,
      newContent.length
    );

    // 6. Update the actual file on disk and refresh the UI.
    this.updateFileContent(fileId, newContent);
    this.updateFileUI(fileId, newVersionData, newContent);

    console.log(
      `🔄 ✅ Partial update applied. File is now at version ${newVersionNumber}.`
    );
  },

  // Apply section changes to the sections map
  applySectionChanges: function (sectionsMap, updateData) {
    // Apply modified sections
    for (const [sectionName, sectionData] of Object.entries(
      updateData.sections_modified || {}
    )) {
      sectionsMap.set(sectionName, sectionData);
      console.log("🔄 Modified section:", sectionName);
    }

    // Apply added sections
    for (const [sectionName, sectionData] of Object.entries(
      updateData.sections_added || {}
    )) {
      sectionsMap.set(sectionName, sectionData);
      console.log("🔄 Added section:", sectionName);
    }

    // Remove sections
    for (const sectionName of updateData.sections_removed || []) {
      sectionsMap.delete(sectionName);
      console.log("🔄 Removed section:", sectionName);
    }
  },

  // Reconstruct full content from sections
  reconstructContent: function (sectionsMap) {
    const sections = Array.from(sectionsMap.values());

    // Sort by start_line if available
    sections.sort((a, b) => (a.start_line || 0) - (b.start_line || 0));

    return sections.map((section) => section.content).join("\n");
  },

  // Parse content into sections (for version 1)
  parseContentIntoSections: function (content) {
    if (!content) return new Map();

    const sections = new Map();
    const lines = content.split("\n");

    // Simple parsing - could be enhanced based on file type
    sections.set("main_content", {
      type: "content",
      content: content,
      start_line: 1,
      end_line: lines.length,
    });

    return sections;
  },

  // Get current file content
  getCurrentFileContent: function (fileId) {
    // Try streaming files first
    const streamingFile = chatManager.streamingFiles?.get(fileId);
    if (streamingFile) return streamingFile;

    // Try content manager
    const block = contentManager.blocks.get(fileId);
    if (block) return block;

    return null;
  },

  // Update actual file content
  updateFileContent: function (fileId, newContent) {
    // Update streaming file if exists
    const streamingFile = chatManager.streamingFiles?.get(fileId);
    if (streamingFile) {
      streamingFile.content = newContent;
      streamingFile.originalContent = newContent;

      // Update corresponding response file
      const responseFile = chatManager.streamingResponseFiles?.find(
        (f) => f.id === fileId
      );
      if (responseFile) {
        responseFile.content = newContent;
      }
    }

    // Update content manager block
    const block = contentManager.blocks.get(fileId);
    if (block) {
      block.content = newContent;
      block.originalContent = newContent;
      block.size = newContent.length;
      block.wordCount = newContent.split(/\s+/).length;
    }

    console.log("🔄 ✅ File content updated, new length:", newContent.length);
  },

  // Update file UI by creating a new file block in the current message
  updateFileUI: function (fileId, versionData, newContent) {
    console.log("🔧 updateFileUI called with:", { fileId, versionData });
    // --- FIX: Use the passed 'newContent' instead of re-fetching ---
    if (!newContent) {
      console.error("🔄 ❌ updateFileUI was called without newContent.");
      // As a fallback, try to get it, but this should not happen
      const updatedFile = this.getCurrentFileContent(fileId);
      if (!updatedFile) {
        console.error("🔄 ❌ Could not get updated file content for:", fileId);
        return;
      }
      newContent = updatedFile.content;
    }
    // Get the updated file content
    const updatedFile = this.getCurrentFileContent(fileId);
    if (!updatedFile) {
      console.error("🔄 ❌ Could not get updated file content for:", fileId);
      return;
    }

    // Find the current streaming message
    const currentMessageId = chatManager.currentStreamMessageId;
    if (!currentMessageId) {
      console.error("🔄 ❌ No current streaming message found");
      return;
    }

    const message = document.getElementById(currentMessageId);
    if (!message) {
      console.error(
        "🔄 ❌ Current message element not found:",
        currentMessageId
      );
      return;
    }

    // Find or create files container in the current message
    let filesContainer = message.querySelector(".message-files");
    if (!filesContainer) {
      console.log("🔄 Creating new files container in current message");
      filesContainer = document.createElement("div");
      filesContainer.className = "message-files";
      filesContainer.style.display = "block";
      filesContainer.style.visibility = "visible";
      filesContainer.style.opacity = "1";
      message.appendChild(filesContainer);
    }

    // Create new file data for the updated version
    const newFileId = `updated_${fileId}_v${
      versionData ? this.fileVersions.get(fileId)?.currentVersion || 1 : 1
    }_${Date.now()}`;
    const updatedFileData = {
      id: newFileId,
      filename: updatedFile.filename,
      content: newContent,
      extension:
        updatedFile.extension ||
        chatManager.getFileExtension(updatedFile.filename),
      language:
        updatedFile.language ||
        chatManager.getLanguageFromExtension(updatedFile.filename),
      type:
        updatedFile.type || chatManager.detectFileType(updatedFile.language),
      size: updatedFile.content.length,
      is_executable:
        updatedFile.is_executable ||
        chatManager.isExecutableFile(updatedFile.filename),
      mime_type:
        updatedFile.mime_type || chatManager.getMimeType(updatedFile.extension),
      metadata: updatedFile.metadata || {},
      isUpdate: true,
      originalFileId: fileId,
      version: versionData
        ? this.fileVersions.get(fileId)?.currentVersion || 1
        : 1,
    };

    console.log("🔄 Creating new file block for updated version:", {
      newFileId,
      filename: updatedFileData.filename,
      version: updatedFileData.version,
      contentLength: updatedFileData.content.length,
    });

    // Create the updated file block HTML
    const fileBlockHtml = this.createUpdatedFileBlock(updatedFileData);
    filesContainer.insertAdjacentHTML("beforeend", fileBlockHtml);

    // Find the created element and add version switcher
    const newFileElement = document.getElementById(`block_${newFileId}`);
    if (newFileElement) {
      console.log("🔄 ✅ New file element created:", newFileElement.id);

      // Update streaming files tracking
      if (chatManager.streamingFiles) {
        chatManager.streamingFiles.set(newFileId, {
          ...updatedFileData,
          element: newFileElement,
          isStreaming: false,
          frontendId: `block_${newFileId}`,
          backendId: newFileId,
        });
      }

      // Update streaming response files
      if (chatManager.streamingResponseFiles) {
        const existingIndex = chatManager.streamingResponseFiles.findIndex(
          (f) => f.id === fileId
        );
        if (existingIndex !== -1) {
          // Replace the old entry with updated one
          chatManager.streamingResponseFiles[existingIndex] = updatedFileData;
        } else {
          // Add new entry
          chatManager.streamingResponseFiles.push(updatedFileData);
        }
      }

      // Add version switcher if we have version data
      if (versionData && this.fileVersions.has(fileId)) {
        console.log("🧩 Adding version switcher to new file block");
        this.addVersionSwitcher(newFileElement, fileId, newFileId);
      }

      // Apply syntax highlighting
      const codeElement = newFileElement.querySelector("pre code"); // Corrected selector
      if (codeElement && typeof hljs !== "undefined") {
        console.log(
          `[DEBUG] updateFileUI: Highlighting element. Class: '${codeElement.className}'`
        );

        hljs.highlightElement(codeElement);
      }

      // Update contentManager if needed
      if (typeof contentManager !== "undefined") {
        const blockData = {
          id: `file_${newFileId}`,
          filename: updatedFileData.filename,
          content: updatedFileData.content,
          originalContent: updatedFileData.content,
          extension: updatedFileData.extension,
          language: updatedFileData.language,
          type: updatedFileData.type,
          size: updatedFileData.size,
          wordCount: updatedFileData.content.split(/\s+/).length,
          isExecutable: updatedFileData.is_executable,
          mimeType: updatedFileData.mime_type,
          linkedFiles: [],
          allFiles: chatManager.streamingResponseFiles || [],
          isUpdate: true,
          originalFileId: fileId,
          version: updatedFileData.version,
        };

        contentManager.blocks.set(`file_${newFileId}`, blockData);
        console.log("🔄 ✅ Updated file registered with contentManager");
      }

      console.log("🔄 ✅ New updated file block created and configured");
    } else {
      console.error("🔄 ❌ Failed to create new file element");
    }
  },
  // file: fileUpdateHandler.js
  createUpdatedFileBlock: function (fileData) {
    console.log(
      "🏗️ Creating UPDATED file block for:",
      fileData.filename,
      "v" + fileData.version
    );

    // The helper functions exist on chatManager, not 'this' (fileUpdateHandler)
    const fileIcon =
      typeof contentManager !== "undefined"
        ? contentManager.getFileIcon(fileData.type, fileData.extension)
        : chatManager.getFallbackFileIcon(fileData.extension);

    const fileTypeClass = chatManager.getFileTypeClass(fileData.extension);
    const languageClass =
      fileData.language ||
      chatManager.getLanguageFromExtension(fileData.filename);

    // Create update badge
    const updateBadge = fileData.updateInfo
      ? `<span class="update-badge" title="${fileData.updateInfo.changesSummary}">🔄 Updated</span>`
      : "";

    return `
    <div class="content-block file-block ${fileTypeClass} updated-file" 
         id="block_${fileData.id}" 
         data-type="${fileData.type}" 
         data-extension="${fileData.extension}"
         data-language="${languageClass}"
         data-file-id="file_${fileData.id}"
         data-original-file-id="${fileData.originalFileId || ""}"
         data-version="${fileData.version || 1}"
         data-is-update="true"
         style="display: block !important; visibility: visible !important; opacity: 1 !important;">
      
      <div class="block-header">
        <div class="block-info">
          <div class="block-icon">${fileIcon}</div>
          <div class="block-details">
            <div class="filename-container">
              <h4 class="filename">${chatManager.escapeHtml(
                fileData.filename
              )}</h4>
              <span class="update-badge">Updated v${
                fileData.version || 1
              }</span>
            </div>
            <div class="block-meta">
              <span class="language ${languageClass}">${languageClass}</span>
              <span class="file-size">${chatManager.formatFileSize(
                fileData.size
              )}</span>
              ${
                fileData.metadata
                  ? `<span class="complexity">Complexity: ${fileData.metadata.complexity}</span>`
                  : ""
              }
              ${updateBadge}
            </div>
            ${
              fileData.updateInfo
                ? `
              <div class="update-summary">
                <small>📝 ${fileData.updateInfo.changesSummary}</small>
              </div>
            `
                : ""
            }
          </div>
        </div>
        
        <div class="block-actions" style="position: relative; z-index: 10;">
          <button class="block-btn primary" 
                  data-action="preview" 
                  data-file-id="file_${fileData.id}"
                  ${
                    fileData.extension === ".html" ||
                    fileData.extension === ".htm"
                      ? ""
                      : "disabled"
                  }
                  style="${
                    fileData.extension === ".html" ||
                    fileData.extension === ".htm"
                      ? "pointer-events: auto !important; cursor: pointer !important; opacity: 1;"
                      : "pointer-events: none !important; cursor: not-allowed !important; opacity: 0.5;"
                  }">
            👁️ Live Preview
          </button>
          <button class="block-btn" data-action="download" data-file-id="file_${
            fileData.id
          }">⬇️ Download</button>
          <button class="block-btn" data-action="copy" data-file-id="file_${
            fileData.id
          }">📋 Copy</button>
          <span class="collapse-indicator">▼</span>
        </div>
      </div>
      
      <div class="block-content" style="display: block !important;">
        <div class="code-preview">
<pre><code class="language-${languageClass}" data-file-id="file_${
      fileData.id
    }">${chatManager.escapeHtml(fileData.content)}</code></pre>
        </div>
      </div>
    </div>
  `;
  },

  // Helper function for file icons (if needed)
  getFallbackFileIcon: function (extension) {
    const icons = {
      ".js": "📄",
      ".py": "🐍",
      ".html": "🌐",
      ".css": "🎨",
      ".json": "🔣",
      ".md": "📝",
    };
    return icons[extension] || "📁";
  },

  // Helper function for file type classes
  getFileTypeClass: function (extension) {
    return extension.substring(1); // Remove dot: .js -> js
  },
  // Add version switcher to file header
  addVersionSwitcher: function (fileElement, fileId) {
    const versionData = this.fileVersions.get(fileId);
    if (!versionData || versionData.versions.size <= 1) return;

    let versionSwitcher = fileElement.querySelector(".version-switcher");
    if (!versionSwitcher) {
      versionSwitcher = document.createElement("div");
      versionSwitcher.className = "version-switcher";

      const header = fileElement.querySelector(".block-header");
      if (header) {
        header.appendChild(versionSwitcher);
      }
    }

    const versions = Array.from(versionData.versions.keys()).sort(
      (a, b) => b - a
    );

    versionSwitcher.innerHTML = `
      <div class="version-controls">
        <label class="version-label">Version:</label>
        <select class="version-select" data-file-id="${fileId}">
          ${versions
            .map(
              (v) => `
            <option value="${v}" ${
                v === versionData.currentVersion ? "selected" : ""
              }>
              v${v} ${
                v === 1
                  ? "(Original)"
                  : `(${
                      versionData.versions.get(v).metadata.changeCount
                    } changes)`
              }
            </option>
          `
            )
            .join("")}
        </select>
        <button class="show-diff-btn" data-file-id="${fileId}" title="Show differences">
          📋 Diff
        </button>
      </div>
    `;

    // Add event listeners
    const select = versionSwitcher.querySelector(".version-select");
    select.addEventListener("change", (e) => {
      this.switchToVersion(fileId, parseInt(e.target.value));
    });

    const diffBtn = versionSwitcher.querySelector(".show-diff-btn");
    diffBtn.addEventListener("click", () => {
      this.showVersionDiff(fileId);
    });
  },

  // Add changes display below file content
  addChangesDisplay: function (fileElement, fileId, versionData) {
    if (!versionData.changes) return;

    let changesContainer = fileElement.querySelector(".changes-display");
    if (!changesContainer) {
      changesContainer = document.createElement("div");
      changesContainer.className = "changes-display";

      const blockContent = fileElement.querySelector(".block-content");
      if (blockContent) {
        blockContent.appendChild(changesContainer);
      }
    }

    const changes = versionData.changes;
    const hasChanges =
      Object.keys(changes.modified).length > 0 ||
      Object.keys(changes.added).length > 0 ||
      changes.removed.length > 0;

    if (!hasChanges) {
      changesContainer.style.display = "none";
      return;
    }

    changesContainer.innerHTML = `
      <div class="changes-header">
        <h4>📝 Changes in Version ${
          this.fileVersions.get(fileId).currentVersion
        }</h4>
        <button class="toggle-changes-btn">▼ Show Details</button>
      </div>
      <div class="changes-details" style="display: none;">
        ${this.renderChanges(changes)}
      </div>
    `;

    // Add toggle functionality
    const toggleBtn = changesContainer.querySelector(".toggle-changes-btn");
    const details = changesContainer.querySelector(".changes-details");

    toggleBtn.addEventListener("click", () => {
      const isVisible = details.style.display !== "none";
      details.style.display = isVisible ? "none" : "block";
      toggleBtn.textContent = isVisible ? "▼ Show Details" : "▲ Hide Details";
    });

    changesContainer.style.display = "block";
  },

  // Render changes HTML
  renderChanges: function (changes) {
    let html = "";

    // Modified sections
    if (Object.keys(changes.modified).length > 0) {
      html += `
        <div class="change-group modified">
          <h5>🔄 Modified Sections</h5>
          <div class="change-list">
            ${Object.entries(changes.modified)
              .map(
                ([name, section]) => `
              <div class="change-item">
                <span class="section-name">${name}</span>
                <span class="section-type">${section.type || "content"}</span>
                <div class="section-summary">${
                  section.change_summary || "Modified content"
                }</div>
                <div class="section-preview">
                  <code>${this.escapeHtml(section.content.substring(0, 100))}${
                  section.content.length > 100 ? "..." : ""
                }</code>
                </div>
              </div>
            `
              )
              .join("")}
          </div>
        </div>
      `;
    }

    // Added sections
    if (Object.keys(changes.added).length > 0) {
      html += `
        <div class="change-group added">
          <h5>➕ Added Sections</h5>
          <div class="change-list">
            ${Object.entries(changes.added)
              .map(
                ([name, section]) => `
              <div class="change-item">
                <span class="section-name">${name}</span>
                <span class="section-type">${section.type || "content"}</span>
                <div class="section-summary">${
                  section.change_summary || "New content"
                }</div>
                <div class="section-preview">
                  <code>${this.escapeHtml(section.content.substring(0, 100))}${
                  section.content.length > 100 ? "..." : ""
                }</code>
                </div>
              </div>
            `
              )
              .join("")}
          </div>
        </div>
      `;
    }

    // Removed sections
    if (changes.removed.length > 0) {
      html += `
        <div class="change-group removed">
          <h5>➖ Removed Sections</h5>
          <div class="change-list">
            ${changes.removed
              .map(
                (name) => `
              <div class="change-item">
                <span class="section-name">${name}</span>
                <span class="section-type">removed</span>
              </div>
            `
              )
              .join("")}
          </div>
        </div>
      `;
    }

    return html;
  },

  // Switch to a specific version
  switchToVersion: function (fileId, version) {
    console.log("🔄 Switching to version", version, "for file", fileId);

    const versionData = this.fileVersions.get(fileId);
    if (!versionData || !versionData.versions.has(version)) {
      console.error("🔄 ❌ Version not found:", version);
      return;
    }

    const targetVersion = versionData.versions.get(version);

    // Update file content
    this.updateFileContent(fileId, targetVersion.sections);

    // Update current version
    versionData.currentVersion = version;

    // Update content display
    const fileElement =
      document.getElementById(`block_${fileId}`) ||
      document.getElementById(fileId) ||
      document.querySelector(`[data-file-id="${fileId}"]`);

    if (fileElement) {
      this.updateContentDisplay(fileElement, fileId);

      // Update changes display
      if (targetVersion.changes) {
        this.addChangesDisplay(fileElement, fileId, targetVersion);
      } else {
        // Hide changes for original version
        const changesDisplay = fileElement.querySelector(".changes-display");
        if (changesDisplay) {
          changesDisplay.style.display = "none";
        }
      }
    }

    console.log("🔄 ✅ Switched to version", version);
  },

  // Update content display in the file element
  updateContentDisplay: function (fileElement, fileId) {
    const codeElement = fileElement.querySelector("code, .streaming-code");
    if (!codeElement) return;

    const currentFile = this.getCurrentFileContent(fileId);
    if (!currentFile) return;

    codeElement.textContent = currentFile.content;

    // Apply syntax highlighting
    if (typeof hljs !== "undefined") {
      hljs.highlightElement(codeElement);
    }
  },

  // Show version diff
  showVersionDiff: function (fileId) {
    const versionData = this.fileVersions.get(fileId);
    if (!versionData || versionData.versions.size < 2) return;

    const currentVersion = versionData.currentVersion;
    const previousVersion = Math.max(1, currentVersion - 1);

    const current = this.reconstructContent(
      versionData.versions.get(currentVersion).sections
    );
    const previous = this.reconstructContent(
      versionData.versions.get(previousVersion).sections
    );

    this.createDiffModal(
      fileId,
      versionData.filename,
      {
        version: previousVersion,
        content: previous,
      },
      {
        version: currentVersion,
        content: current,
      }
    );
  },

  // Create diff modal
  createDiffModal: function (fileId, filename, oldVersion, newVersion) {
    const modal = document.createElement("div");
    modal.className = "diff-modal";
    modal.innerHTML = `
      <div class="diff-modal-content">
        <div class="diff-header">
          <h3>📋 Changes: ${this.escapeHtml(filename)}</h3>
          <div class="version-comparison">
            <span class="old-version">v${oldVersion.version}</span>
            <span class="arrow">→</span>
            <span class="new-version">v${newVersion.version}</span>
          </div>
          <button class="close-diff-btn">✕</button>
        </div>
        <div class="diff-content">
          <div class="diff-side old">
            <h4>Version ${oldVersion.version}</h4>
            <pre><code>${this.escapeHtml(oldVersion.content)}</code></pre>
          </div>
          <div class="diff-side new">
            <h4>Version ${newVersion.version}</h4>
            <pre><code>${this.escapeHtml(newVersion.content)}</code></pre>
          </div>
        </div>
      </div>
    `;

    // Add event listeners
    modal.addEventListener("click", (e) => {
      if (e.target === modal || e.target.classList.contains("close-diff-btn")) {
        modal.remove();
      }
    });

    document.body.appendChild(modal);
  },

  // Handle complete file (non-partial update)
  handleCompleteFile: function (updateData) {
    console.log("🔄 Processing complete file:", updateData.filename);

    // This would be handled by the existing streaming system
    // Just ensure we initialize version tracking if this becomes a versioned file
    const fileId = this.findFileByName(updateData.filename);
    if (fileId && !this.fileVersions.has(fileId)) {
      this.fileVersions.set(fileId, {
        versions: new Map(),
        currentVersion: 1,
        filename: updateData.filename,
        baseContent: updateData.content || "",
      });
    }
  },

  // Utility function to escape HTML
  escapeHtml: function (text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  },

  // Clean up old versions to save memory
  cleanupOldVersions: function (fileId, keepVersions = 5) {
    const versionData = this.fileVersions.get(fileId);
    if (!versionData || versionData.versions.size <= keepVersions) return;

    const versions = Array.from(versionData.versions.keys()).sort(
      (a, b) => a - b
    );
    const toRemove = versions.slice(0, -keepVersions);

    for (const version of toRemove) {
      if (version !== 1) {
        // Always keep original version
        versionData.versions.delete(version);
        console.log(
          "🔄 🗑️ Cleaned up old version",
          version,
          "for file",
          fileId
        );
      }
    }
  },

  // Get memory usage statistics
  getMemoryStats: function () {
    let totalVersions = 0;
    let totalFiles = 0;

    for (const [fileId, versionData] of this.fileVersions) {
      totalFiles++;
      totalVersions += versionData.versions.size;
    }

    return {
      totalFiles,
      totalVersions,
      averageVersionsPerFile:
        totalFiles > 0 ? (totalVersions / totalFiles).toFixed(1) : 0,
    };
  },
};

// Initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => fileUpdateHandler.init());
} else {
  fileUpdateHandler.init();
}
