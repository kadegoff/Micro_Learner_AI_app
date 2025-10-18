const https = require("https");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");

const modelUrl =
  "https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip";
const modelDir = path.join(__dirname, "models");
const modelPath = path.join(modelDir, "vosk-model-small-en-us-0.15.zip");

// Create models directory if it doesn't exist
if (!fs.existsSync(modelDir)) {
  fs.mkdirSync(modelDir, { recursive: true });
}

console.log("Downloading Vosk model...");

const file = fs.createWriteStream(modelPath);
https.get(modelUrl, (response) => {
  response.pipe(file);
  file.on("finish", () => {
    file.close();
    console.log("Model downloaded! Extracting...");

    // Extract the zip file
    exec(`unzip -o ${modelPath} -d ${modelDir}`, (error) => {
      if (error) {
        console.error("Error extracting model:", error);
        return;
      }
      console.log("Model ready!");
      // Optionally delete the zip file
      fs.unlinkSync(modelPath);
    });
  });
});
