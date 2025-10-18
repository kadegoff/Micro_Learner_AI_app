const https = require("https");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");

const modelUrl =
  "https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip";
const modelDir = path.join(__dirname, "models");
const modelZipPath = path.join(modelDir, "vosk-model-small-en-us-0.15.zip");
const modelExtractedPath = path.join(modelDir, "vosk-model-small-en-us-0.15");

// Create models directory if it doesn't exist
if (!fs.existsSync(modelDir)) {
  fs.mkdirSync(modelDir, { recursive: true });
}

if (typeof $DebugTestMode === "undefined") {
  $DebugTestMode = true;
}

if ($DebugTestMode) {
  console.log("Downloading Vosk model...");
}

function extractModel() {
  if ($DebugTestMode) {
    console.log("Model downloaded! Extracting...");
  }

  // Cross-platform extraction
  if (process.platform === "win32") {
    // Windows: Use PowerShell
    const powerShellCommand = `powershell -command "Expand-Archive -Path '${modelZipPath}' -DestinationPath '${modelDir}' -Force"`;
    exec(powerShellCommand, (error) => {
      if (error) {
        if ($DebugTestMode) {
          console.error("Error extracting model with PowerShell:", error);
        }
        // Try fallback method
        fallbackExtraction();
        return;
      }
      if ($DebugTestMode) {
        console.log("Model extracted successfully with PowerShell!");
      }
      cleanup();
    });
  } else {
    // Linux/Mac: Use unzip
    exec(`unzip -o "${modelZipPath}" -d "${modelDir}"`, (error) => {
      if (error) {
        if ($DebugTestMode) {
          console.error("Error extracting model with unzip:", error);
        }
        // Try fallback method
        fallbackExtraction();
        return;
      }
      if ($DebugTestMode) {
        console.log("Model extracted successfully with unzip!");
      }
      cleanup();
    });
  }
}

function fallbackExtraction() {
  if ($DebugTestMode) {
    console.log("Trying fallback extraction with adm-zip...");
  }

  try {
    // Try to use adm-zip if available
    const AdmZip = require("adm-zip");
    const zip = new AdmZip(modelZipPath);
    zip.extractAllTo(modelDir, true);
    if ($DebugTestMode) {
      console.log("Model extracted successfully with adm-zip!");
    }
    cleanup();
  } catch (admError) {
    if ($DebugTestMode) {
      console.error("adm-zip extraction failed:", admError);

      // Final fallback: manual download instructions
      console.log("\n💡 Manual download required:");
      console.log("1. Download from: https://alphacephei.com/vosk/models");
      console.log("2. Download: vosk-model-small-en-us-0.15.zip");
      console.log("3. Extract it to:", modelExtractedPath);
      console.log("4. Delete the zip file:", modelZipPath);
    }
  }
}

function cleanup() {
  // Optionally delete the zip file after successful extraction
  if (fs.existsSync(modelZipPath)) {
    try {
      fs.unlinkSync(modelZipPath);
      if ($DebugTestMode) {
        console.log("Cleaned up zip file");
      }
    } catch (error) {
      if ($DebugTestMode) {
        console.log("Could not delete zip file:", error.message);
      }
    }
  }

  // Verify the model was extracted correctly
  if (fs.existsSync(modelExtractedPath)) {
    if ($DebugTestMode) {
      console.log("✅ Vosk model is ready at:", modelExtractedPath);
    }
  } else {
    if ($DebugTestMode) {
      console.log(
        "❌ Model extraction may have failed - expected path not found:",
        modelExtractedPath
      );
    }
  }
}

function downloadModel() {
  const file = fs.createWriteStream(modelZipPath);

  https
    .get(modelUrl, (response) => {
      // Check if download was successful
      if (response.statusCode !== 200) {
        if ($DebugTestMode) {
          console.error(
            `Download failed with status code: ${response.statusCode}`
          );
        }
        return;
      }

      response.pipe(file);

      file.on("finish", () => {
        file.close();
        extractModel();
      });
    })
    .on("error", (error) => {
      if ($DebugTestMode) {
        console.error("Download error:", error);
      }
      // Clean up partial download
      if (fs.existsSync(modelZipPath)) {
        fs.unlinkSync(modelZipPath);
      }
    });

  // Show download progress
  let downloadedBytes = 0;
  https.get(modelUrl, (response) => {
    const totalBytes = parseInt(response.headers["content-length"], 10);

    response.on("data", (chunk) => {
      downloadedBytes += chunk.length;
      if (totalBytes) {
        const percent = ((downloadedBytes / totalBytes) * 100).toFixed(1);
        process.stdout.write(
          `\rDownload progress: ${percent}% (${(
            downloadedBytes /
            1024 /
            1024
          ).toFixed(1)} MB)`
        );
      }
    });

    response.on("end", () => {
      process.stdout.write("\n");
    });
  });
}

// Check if model already exists
if (fs.existsSync(modelExtractedPath)) {
  if ($DebugTestMode) {
    console.log("✅ Vosk model already exists at:", modelExtractedPath);
  }
  process.exit(0);
}

// Install adm-zip if needed (for fallback extraction)
try {
  require("adm-zip");
} catch (error) {
  if ($DebugTestMode) {
    console.log("Installing adm-zip for fallback extraction...");
  }
  exec("npm install adm-zip --no-save", (installError) => {
    if (installError) {
      if ($DebugTestMode) {
        console.log(
          "Could not install adm-zip, will use manual extraction if needed"
        );
      }
    } else {
      if ($DebugTestMode) {
        console.log("adm-zip installed successfully");
      }
    }
    downloadModel();
  });
}

// If adm-zip is already available, start download immediately
if (require.resolve("adm-zip")) {
  downloadModel();
}
