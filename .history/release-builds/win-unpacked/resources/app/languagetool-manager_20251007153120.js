// languagetool-manager.js - Auto-download and manage LanguageTool
const fs = require("fs");
const path = require("path");
const https = require("https");
const { spawn } = require("child_process");
const { app } = require("electron");

if (typeof $DebugTestMode === "undefined") {
  $DebugTestMode = false;
}

class LanguageToolManager {
  constructor() {
    this.ltVersion = "6.6"; // Latest stable version
    this.ltUrl = `https://languagetool.org/download/LanguageTool-${this.ltVersion}.zip`;
    this.ltDir = path.join(app.getPath("userData"), "LanguageTool");
    this.ltExtractedDir = path.join(
      this.ltDir,
      `LanguageTool-${this.ltVersion}`
    );
    this.ltJarPath = path.join(this.ltExtractedDir, "languagetool-server.jar");
    this.ltZipPath = path.join(
      this.ltDir,
      `LanguageTool-${this.ltVersion}.zip`
    );
    this.ltProcess = null;
    this.isRunning = false;
    this.isDownloading = false;
    this.downloadProgress = 0;
    this.port = 8010;
    this.maxMemory = "512m"; // Default memory limit

    if ($DebugTestMode) {
      console.log("🔧 LanguageToolManager initialized");
      console.log("📁 LT Directory:", this.ltDir);
      console.log("📁 LT Extracted:", this.ltExtractedDir);
      console.log("📄 LT JAR Path:", this.ltJarPath);
    }
  }

  // Check if LanguageTool is already installed
  isInstalled() {
    const exists = fs.existsSync(this.ltJarPath);
    if ($DebugTestMode) {
      console.log("🔍 LanguageTool installed:", exists);
    }
    return exists;
  }

  // Check if LanguageTool server is running
  async isServerRunning() {
    return new Promise((resolve) => {
      const testUrl = `http://localhost:${this.port}/v2/languages`;

      const req = require("http").get(testUrl, (res) => {
        resolve(res.statusCode === 200);
      });

      req.on("error", () => {
        resolve(false);
      });

      req.setTimeout(2000, () => {
        req.destroy();
        resolve(false);
      });
    });
  }

  // Download LanguageTool
  async downloadLanguageTool(progressCallback) {
    if (this.isDownloading) {
      if ($DebugTestMode) {
        console.log("📥 Download already in progress");
      }
      return;
    }

    if ($DebugTestMode) {
      console.log("📥 Starting LanguageTool download...");
    }
    this.isDownloading = true;
    this.downloadProgress = 0;

    // Create directory if it doesn't exist
    if (!fs.existsSync(this.ltDir)) {
      fs.mkdirSync(this.ltDir, { recursive: true });
    }

    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(this.ltZipPath);

      https
        .get(this.ltUrl, (response) => {
          if (response.statusCode !== 200) {
            reject(
              new Error(`Download failed with status ${response.statusCode}`)
            );
            return;
          }

          const totalSize = parseInt(response.headers["content-length"], 10);
          let downloadedSize = 0;

          response.on("data", (chunk) => {
            downloadedSize += chunk.length;
            this.downloadProgress = Math.round(
              (downloadedSize / totalSize) * 100
            );

            if (progressCallback) {
              progressCallback({
                type: "download",
                progress: this.downloadProgress,
                downloaded: downloadedSize,
                total: totalSize,
              });
            }

            if ($DebugTestMode) {
              console.log(`📥 Download progress: ${this.downloadProgress}%`);
            }
          });

          response.pipe(file);

          file.on("finish", () => {
            file.close();
            if ($DebugTestMode) {
              console.log("✅ Download completed");
            }
            this.isDownloading = false;
            resolve();
          });

          file.on("error", (err) => {
            fs.unlink(this.ltZipPath, () => {}); // Delete partial file
            this.isDownloading = false;
            reject(err);
          });
        })
        .on("error", (err) => {
          this.isDownloading = false;
          reject(err);
        });
    });
  }

  // Extract LanguageTool zip file
  async extractLanguageTool(progressCallback) {
    if ($DebugTestMode) {
      console.log("📦 Extracting LanguageTool...");
    }

    return new Promise((resolve, reject) => {
      // Use PowerShell on Windows to extract
      if (process.platform === "win32") {
        const powershellCommand = `Expand-Archive -Path '${this.ltZipPath}' -DestinationPath '${this.ltDir}' -Force`;

        const psProcess = spawn("powershell", ["-Command", powershellCommand], {
          stdio: ["pipe", "pipe", "pipe"],
        });

        let output = "";
        let errorOutput = "";

        psProcess.stdout.on("data", (data) => {
          output += data.toString();
        });

        psProcess.stderr.on("data", (data) => {
          errorOutput += data.toString();
        });

        psProcess.on("close", (code) => {
          if (code === 0) {
            if ($DebugTestMode) {
              console.log("✅ Extraction completed");
            }
            // Clean up zip file
            fs.unlink(this.ltZipPath, () => {});
            resolve();
          } else {
            if ($DebugTestMode) {
              console.error("❌ Extraction failed:", errorOutput);
            }
            reject(new Error(`Extraction failed: ${errorOutput}`));
          }
        });

        if (progressCallback) {
          progressCallback({
            type: "extract",
            progress: 50,
            message: "Extracting files...",
          });
        }
      } else {
        // Use unzip on Unix-like systems
        const unzipProcess = spawn("unzip", [
          "-o",
          this.ltZipPath,
          "-d",
          this.ltDir,
        ]);

        unzipProcess.on("close", (code) => {
          if (code === 0) {
            if ($DebugTestMode) {
              console.log("✅ Extraction completed");
            }
            fs.unlink(this.ltZipPath, () => {});
            resolve();
          } else {
            reject(new Error(`Extraction failed with code ${code}`));
          }
        });
      }
    });
  }

  // Install LanguageTool (download + extract)
  async installLanguageTool(progressCallback) {
    try {
      if ($DebugTestMode) {
        console.log("🔧 Installing LanguageTool...");
      }

      if (progressCallback) {
        progressCallback({
          type: "install",
          progress: 0,
          message: "Starting installation...",
        });
      }

      // Download
      await this.downloadLanguageTool(progressCallback);

      if (progressCallback) {
        progressCallback({
          type: "install",
          progress: 80,
          message: "Extracting...",
        });
      }

      // Extract
      await this.extractLanguageTool(progressCallback);

      if (progressCallback) {
        progressCallback({
          type: "install",
          progress: 100,
          message: "Installation complete!",
        });
      }

      if ($DebugTestMode) {
        console.log("✅ LanguageTool installation completed");
      }
      return true;
    } catch (error) {
      if ($DebugTestMode) {
        console.error("❌ LanguageTool installation failed:", error);
      }
      throw error;
    }
  }

  // Start LanguageTool server
  async startServer(memoryLimit = null) {
    if (this.isRunning) {
      if ($DebugTestMode) {
        console.log("✅ LanguageTool server already running");
      }
      return true;
    }

    if (await this.isServerRunning()) {
      if ($DebugTestMode) {
        console.log(
          "✅ LanguageTool server already running on port",
          this.port
        );
      }
      this.isRunning = true;
      return true;
    }

    if (!this.isInstalled()) {
      throw new Error(
        "LanguageTool is not installed. Please install it first."
      );
    }

    if ($DebugTestMode) {
      console.log("🚀 Starting LanguageTool server...");
    }

    const memory = memoryLimit || this.maxMemory;
    const javaArgs = [
      `-Xmx${memory}`,
      `-Xms${Math.round(parseInt(memory) / 2)}m`,
      "-cp",
      this.ltJarPath,
      "org.languagetool.server.HTTPServer",
      "--port",
      this.port.toString(),
      "--allow-origin",
      "*",
    ];

    if ($DebugTestMode) {
      console.log("☕ Java command:", "java", javaArgs.join(" "));
    }

    return new Promise((resolve, reject) => {
      this.ltProcess = spawn("java", javaArgs, {
        cwd: this.ltExtractedDir,
        stdio: ["pipe", "pipe", "pipe"],
      });

      let startupOutput = "";
      let hasStarted = false;

      this.ltProcess.stdout.on("data", (data) => {
        const output = data.toString();
        startupOutput += output;
        if ($DebugTestMode) {
          console.log("🔤 LT Output:", output.trim());
        }

        // Check for successful startup
        if (output.includes("Server started")) {
          if (!hasStarted) {
            hasStarted = true;
            this.isRunning = true;
            if ($DebugTestMode) {
              console.log("✅ LanguageTool server started successfully");
            }
            resolve(true);
          }
        }
      });

      this.ltProcess.stderr.on("data", (data) => {
        const error = data.toString();
        if ($DebugTestMode) {
          console.log("🔤 LT Error:", error.trim());
        }

        // Check for specific errors
        if (error.includes("Address already in use")) {
          if ($DebugTestMode) {
            console.log(
              "⚠️ Port already in use, checking if it's our server..."
            );
          }
          this.isServerRunning().then((running) => {
            if (running) {
              this.isRunning = true;
              resolve(true);
            }
          });
        }
      });

      this.ltProcess.on("close", (code) => {
        if ($DebugTestMode) {
          console.log(`🔚 LanguageTool process exited with code ${code}`);
        }
        this.isRunning = false;
        this.ltProcess = null;

        if (!hasStarted) {
          reject(
            new Error(`LanguageTool failed to start (exit code: ${code})`)
          );
        }
      });

      this.ltProcess.on("error", (error) => {
        if ($DebugTestMode) {
          console.error("❌ LanguageTool process error:", error);
        }
        this.isRunning = false;
        this.ltProcess = null;

        if (!hasStarted) {
          reject(error);
        }
      });

      // Timeout after 30 seconds
      setTimeout(() => {
        if (!hasStarted) {
          if ($DebugTestMode) {
            console.error("❌ LanguageTool startup timeout");
          }
          this.stopServer();
          reject(new Error("LanguageTool startup timeout"));
        }
      }, 30000);
    });
  }

  // Stop LanguageTool server
  stopServer() {
    if (this.ltProcess) {
      if ($DebugTestMode) {
        console.log("🛑 Stopping LanguageTool server...");
      }
      this.ltProcess.kill("SIGTERM");

      // Force kill after 5 seconds if not stopped
      setTimeout(() => {
        if (this.ltProcess) {
          this.ltProcess.kill("SIGKILL");
        }
      }, 5000);

      this.ltProcess = null;
    }

    this.isRunning = false;
    if ($DebugTestMode) {
      console.log("✅ LanguageTool server stopped");
    }
  }

  // Get server status
  getStatus() {
    return {
      installed: this.isInstalled(),
      running: this.isRunning,
      downloading: this.isDownloading,
      downloadProgress: this.downloadProgress,
      port: this.port,
      serverUrl: `http://localhost:${this.port}`,
      version: this.ltVersion,
      memoryLimit: this.maxMemory,
    };
  }

  // Set memory limit
  setMemoryLimit(limit) {
    this.maxMemory = limit;
    if ($DebugTestMode) {
      console.log("💾 Memory limit set to:", limit);
    }
  }

  // Auto-setup: install if needed, then start
  async autoSetup(progressCallback) {
    try {
      if ($DebugTestMode) {
        console.log("🔄 Auto-setup LanguageTool...");
      }

      // Check if already running
      if (await this.isServerRunning()) {
        if ($DebugTestMode) {
          console.log("✅ LanguageTool already running");
        }
        this.isRunning = true;
        return true;
      }

      // Install if not installed
      if (!this.isInstalled()) {
        if ($DebugTestMode) {
          console.log("📥 LanguageTool not found, installing...");
        }
        await this.installLanguageTool(progressCallback);
      }

      // Start server
      if ($DebugTestMode) {
        console.log("🚀 Starting LanguageTool server...");
      }
      await this.startServer();

      return true;
    } catch (error) {
      if ($DebugTestMode) {
        console.error("❌ Auto-setup failed:", error);
      }
      throw error;
    }
  }

  // Test server connection
  async testConnection() {
    try {
      const response = await fetch(`http://localhost:${this.port}/v2/check`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          text: "This is a test.",
          language: "en-US",
        }),
      });

      if (response.ok) {
        const result = await response.json();
        if ($DebugTestMode) {
          console.log("✅ LanguageTool connection test successful");
        }
        return true;
      } else {
        if ($DebugTestMode) {
          console.error(
            "❌ LanguageTool connection test failed:",
            response.status
          );
        }
        return false;
      }
    } catch (error) {
      if ($DebugTestMode) {
        console.error("❌ LanguageTool connection error:", error);
      }
      return false;
    }
  }

  // Cleanup on app exit
  cleanup() {
    this.stopServer();
  }
}

module.exports = LanguageToolManager;
