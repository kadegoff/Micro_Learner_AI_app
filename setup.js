const { exec } = require("child_process");
const os = require("os");

if (typeof $DebugTestMode === "undefined") {
  $DebugTestMode = true;
}

if ($DebugTestMode) {
  console.log("Setting up AI Meeting Assistant...");
}

// Check if pip is installed
exec("pip --version", (error, stdout, stderr) => {
  if (error) {
    if ($DebugTestMode) {
      console.log("pip not found, attempting to install...");
    }
    installPip();
  } else {
    if ($DebugTestMode) {
      console.log("pip found:", stdout);
    }
    installDependencies();
  }
});

function installPip() {
  const platform = os.platform();

  if (platform === "win32") {
    // Windows: Download get-pip.py
    exec(
      "curl https://bootstrap.pypa.io/get-pip.py -o get-pip.py && python get-pip.py",
      (error) => {
        if (error) {
          if ($DebugTestMode) {
            console.error(
              "Failed to install pip. Please install Python and pip manually."
            );
          }
          process.exit(1);
        }
        installDependencies();
      }
    );
  } else {
    // macOS/Linux: Try with python3
    exec("python3 -m ensurepip", (error) => {
      if (error) {
        if ($DebugTestMode) {
          console.error(
            "Failed to install pip. Please install Python and pip manually."
          );
          console.error("Ubuntu/Debian: sudo apt-get install python3-pip");
          console.error("macOS: brew install python3");
        }
        process.exit(1);
      }
      installDependencies();
    });
  }
}

function installDependencies() {
  if ($DebugTestMode) {
    console.log("Installing vosk...");
  }
  exec("pip install vosk", (error, stdout, stderr) => {
    if (error) {
      if ($DebugTestMode) {
        console.error("Error installing vosk:", error);
      }
      return;
    }
    if ($DebugTestMode) {
      console.log("Vosk installed successfully!");
    }
    downloadModels();
  });
}

function downloadModels() {
  if ($DebugTestMode) {
    console.log("Downloading Vosk models...");
  }
  // Add your model download logic here
  require("./download-models.js");
}
