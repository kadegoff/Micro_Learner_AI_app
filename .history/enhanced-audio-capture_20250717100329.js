// enhanced-audio-capture.js
// Enhanced System Audio Capture Module for Memoria
// Usage: Include this file before main-renderer.js

if (typeof window !== "undefined" && window.$DebugTestMode) {
  console.log("🎵 Loading Enhanced Audio Capture Module...");
}

class EnhancedAudioCapture {
  constructor() {
    this.audioContext = null;
    this.systemStream = null;
    this.micStream = null;
    this.finalStream = null;
    this.isCapturing = false;
    this.currentMethod = null;
    this.debugMode = window.$DebugTestMode || false;

    // Audio mixer components
    this.mixer = {
      context: null,
      systemSource: null,
      micSource: null,
      systemGain: null,
      micGain: null,
      destination: null,
    };

    // Platform detection
    this.platform = this.detectPlatform();

    if (this.debugMode) {
      console.log(
        "🎵 EnhancedAudioCapture initialized for platform:",
        this.platform
      );
    }
  }

  detectPlatform() {
    const userAgent = navigator.userAgent.toLowerCase();
    const platform = navigator.platform.toLowerCase();

    if (platform.includes("win") || userAgent.includes("windows")) {
      return "windows";
    } else if (platform.includes("mac") || userAgent.includes("mac")) {
      return "macos";
    } else if (platform.includes("linux") || userAgent.includes("linux")) {
      return "linux";
    }
    return "unknown";
  }

  log(level, message, ...args) {
    if (this.debugMode) {
      const timestamp = new Date().toISOString().split("T")[1].slice(0, -1);
      console.log(
        `[${timestamp}] 🎵 ${level.toUpperCase()}: ${message}`,
        ...args
      );
    }
  }

  // Method 1: Enhanced Display Media with System Audio Priority
  async captureSystemAudioEnhanced() {
    this.log(
      "info",
      "METHOD 1: Enhanced Display Media with system audio priority"
    );

    try {
      const constraints = {
        video: {
          mediaSource: "screen",
          width: { max: 1 },
          height: { max: 1 },
          frameRate: { max: 1 },
        },
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 16000,
          channelCount: 1,
          advanced: [
            {
              autoGainControl: false,
              echoCancellation: false,
              googEchoCancellation: false,
              googAutoGainControl: false,
              googNoiseSuppression: false,
              googTypingNoiseDetection: false,
              googHighpassFilter: false,
            },
          ],
        },
        preferCurrentTab: false,
      };

      // Try with systemAudio hint if supported
      try {
        constraints.systemAudio = "include";
        constraints.suppressLocalAudioPlayback = false;
      } catch (e) {
        this.log("warn", "Browser doesn't support systemAudio hint");
      }

      this.log(
        "debug",
        "Requesting display media with constraints:",
        constraints
      );

      const stream = await navigator.mediaDevices.getDisplayMedia(constraints);

      const audioTracks = stream.getAudioTracks();
      this.log(
        "debug",
        `Got ${audioTracks.length} audio tracks from display media`
      );

      if (audioTracks.length > 0) {
        // Remove video tracks to save resources
        stream.getVideoTracks().forEach((track) => {
          this.log("debug", "Stopping video track:", track.label);
          track.stop();
        });

        // Create audio-only stream
        const audioOnlyStream = new MediaStream();
        audioTracks.forEach((track) => {
          this.log("debug", "Adding audio track:", track.label);
          audioOnlyStream.addTrack(track);
        });

        // Test if this stream actually has system audio
        const hasSystemAudio = await this.testStreamForSystemAudio(
          audioOnlyStream
        );

        if (hasSystemAudio) {
          this.log(
            "success",
            "Enhanced display media captured system audio successfully"
          );
          return audioOnlyStream;
        } else {
          this.log("warn", "Display media stream has no system audio signal");
          audioOnlyStream.getTracks().forEach((track) => track.stop());
          return null;
        }
      }

      throw new Error("No audio tracks in display stream");
    } catch (error) {
      this.log("error", "Enhanced display media failed:", error.message);
      return null;
    }
  }

  // Method 2: Platform-Specific System Audio
  async captureSystemAudioPlatformSpecific() {
    this.log(
      "info",
      `METHOD 2: Platform-specific system audio for ${this.platform}`
    );

    switch (this.platform) {
      case "windows":
        return await this.captureWindowsSystemAudio();
      case "macos":
        return await this.captureMacSystemAudio();
      case "linux":
        return await this.captureLinuxSystemAudio();
      default:
        this.log("warn", "Unknown platform, trying generic approach");
        return await this.captureGenericSystemAudio();
    }
  }

  async captureWindowsSystemAudio() {
    this.log("info", "Trying Windows WASAPI loopback");

    try {
      // Method 1: Direct system audio
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          mandatory: {
            chromeMediaSource: "system",
            chromeMediaSourceId: "default",
          },
          optional: [
            { sourceId: "default" },
            { autoGainControl: false },
            { echoCancellation: false },
            { noiseSuppression: false },
          ],
        },
      });

      this.log("success", "Windows WASAPI loopback successful");
      return stream;
    } catch (error) {
      this.log("warn", "Windows WASAPI method 1 failed:", error.message);

      // Method 2: Try with different constraints
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            deviceId: "default",
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
            sampleRate: 16000,
            channelCount: 1,
            // Windows-specific
            advanced: [
              {
                chromeMediaSource: "system",
              },
            ],
          },
        });

        this.log("success", "Windows method 2 successful");
        return stream;
      } catch (error2) {
        this.log("error", "All Windows methods failed:", error2.message);
        return null;
      }
    }
  }

  async captureMacSystemAudio() {
    this.log("info", "Trying macOS Core Audio");

    try {
      // macOS often requires virtual audio devices like Soundflower or BlackHole
      const devices = await navigator.mediaDevices.enumerateDevices();
      const virtualDevices = devices.filter((device) => {
        if (device.kind !== "audioinput") return false;
        const label = device.label.toLowerCase();
        return (
          label.includes("soundflower") ||
          label.includes("blackhole") ||
          label.includes("loopback") ||
          label.includes("virtual")
        );
      });

      if (virtualDevices.length > 0) {
        this.log(
          "info",
          `Found ${virtualDevices.length} virtual audio devices`
        );

        for (const device of virtualDevices) {
          try {
            this.log("debug", `Trying virtual device: ${device.label}`);

            const stream = await navigator.mediaDevices.getUserMedia({
              audio: {
                deviceId: { exact: device.deviceId },
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false,
                sampleRate: 16000,
                channelCount: 1,
              },
            });

            const hasAudio = await this.testStreamForSystemAudio(stream);
            if (hasAudio) {
              this.log(
                "success",
                `macOS virtual device ${device.label} successful`
              );
              return stream;
            } else {
              stream.getTracks().forEach((track) => track.stop());
            }
          } catch (deviceError) {
            this.log(
              "warn",
              `Virtual device ${device.label} failed:`,
              deviceError.message
            );
          }
        }
      }

      // Fallback: Try default system approach
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 16000,
          channelCount: 1,
          latency: 0.01,
          volume: 1.0,
        },
      });

      this.log("info", "macOS default method attempted");
      return stream;
    } catch (error) {
      this.log("error", "macOS system audio failed:", error.message);
      return null;
    }
  }

  async captureLinuxSystemAudio() {
    this.log("info", "Trying Linux PulseAudio/ALSA");

    try {
      // Look for monitor devices (PulseAudio loopback)
      const devices = await navigator.mediaDevices.enumerateDevices();
      const monitorDevices = devices.filter((device) => {
        if (device.kind !== "audioinput") return false;
        const label = device.label.toLowerCase();
        return (
          label.includes("monitor") ||
          label.includes("loopback") ||
          label.includes("pulse") ||
          label.includes("alsa loopback")
        );
      });

      if (monitorDevices.length > 0) {
        this.log("info", `Found ${monitorDevices.length} monitor devices`);

        for (const device of monitorDevices) {
          try {
            this.log("debug", `Trying monitor device: ${device.label}`);

            const stream = await navigator.mediaDevices.getUserMedia({
              audio: {
                deviceId: { exact: device.deviceId },
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false,
                sampleRate: 16000,
                channelCount: 1,
              },
            });

            const hasAudio = await this.testStreamForSystemAudio(stream);
            if (hasAudio) {
              this.log(
                "success",
                `Linux monitor device ${device.label} successful`
              );
              return stream;
            } else {
              stream.getTracks().forEach((track) => track.stop());
            }
          } catch (deviceError) {
            this.log(
              "warn",
              `Monitor device ${device.label} failed:`,
              deviceError.message
            );
          }
        }
      }

      throw new Error("No suitable monitor devices found");
    } catch (error) {
      this.log("error", "Linux system audio failed:", error.message);
      return null;
    }
  }

  async captureGenericSystemAudio() {
    this.log("info", "Trying generic system audio approach");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 16000,
          channelCount: 1,
        },
      });

      this.log("info", "Generic system audio method attempted");
      return stream;
    } catch (error) {
      this.log("error", "Generic system audio failed:", error.message);
      return null;
    }
  }

  // Method 3: Electron Desktop Capturer (Enhanced)
  async captureSystemAudioElectron() {
    this.log("info", "METHOD 3: Electron desktop capturer approach");

    if (!window.electronAPI) {
      this.log("warn", "Not running in Electron environment");
      return null;
    }

    try {
      // Get available desktop sources
      const result = await window.electronAPI.captureSystemAudio();

      if (!result || !result.success) {
        throw new Error(result?.error || "Failed to get desktop sources");
      }

      if (!result.sources || result.sources.length === 0) {
        throw new Error("No desktop sources available");
      }

      this.log("debug", `Found ${result.sources.length} desktop sources`);

      // Filter for audio-capable sources
      const audioSources = result.sources.filter((source) => {
        const name = source.name.toLowerCase();
        return (
          name.includes("screen") ||
          name.includes("system audio") ||
          name.includes("speakers") ||
          name.includes("headphones") ||
          source.type === "screen"
        );
      });

      this.log("debug", `Found ${audioSources.length} potential audio sources`);

      // Try each audio source
      for (const source of audioSources) {
        try {
          this.log("debug", `Trying Electron source: ${source.name}`);

          const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              mandatory: {
                chromeMediaSource: "desktop",
                chromeMediaSourceId: source.id,
              },
            },
            video: false,
          });

          const hasAudio = await this.testStreamForSystemAudio(stream);
          if (hasAudio) {
            this.log("success", `Electron source ${source.name} successful`);
            return stream;
          } else {
            this.log("warn", `Source ${source.name} has no audio signal`);
            stream.getTracks().forEach((track) => track.stop());
          }
        } catch (sourceError) {
          this.log(
            "warn",
            `Source ${source.name} failed:`,
            sourceError.message
          );
        }
      }

      throw new Error("No working audio sources found");
    } catch (error) {
      this.log("error", "Electron desktop capturer failed:", error.message);
      return null;
    }
  }

  // Method 4: System Audio Device Enumeration
  async captureSystemAudioDeviceEnum() {
    this.log("info", "METHOD 4: System audio device enumeration");

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();

      // Look for system audio devices
      const systemDevices = devices.filter((device) => {
        if (device.kind !== "audioinput") return false;

        const label = device.label.toLowerCase();
        const deviceId = device.deviceId.toLowerCase();

        return (
          label.includes("stereo mix") ||
          label.includes("wave out mix") ||
          label.includes("loopback") ||
          label.includes("monitor") ||
          label.includes("soundflower") ||
          label.includes("blackhole") ||
          label.includes("system audio") ||
          label.includes("virtual audio") ||
          deviceId.includes("system") ||
          deviceId.includes("loopback")
        );
      });

      this.log(
        "debug",
        `Found ${systemDevices.length} potential system audio devices`
      );

      if (systemDevices.length === 0) {
        throw new Error("No system audio devices found");
      }

      // Try each system audio device
      for (const device of systemDevices) {
        try {
          this.log(
            "debug",
            `Trying device: ${device.label || device.deviceId}`
          );

          const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              deviceId: { exact: device.deviceId },
              echoCancellation: false,
              noiseSuppression: false,
              autoGainControl: false,
              sampleRate: 16000,
              channelCount: 1,
            },
          });

          const hasAudio = await this.testStreamForSystemAudio(stream);
          if (hasAudio) {
            this.log(
              "success",
              `Device ${device.label || device.deviceId} successful`
            );
            return stream;
          } else {
            this.log(
              "warn",
              `Device ${device.label || device.deviceId} has no audio signal`
            );
            stream.getTracks().forEach((track) => track.stop());
          }
        } catch (deviceError) {
          this.log(
            "warn",
            `Device ${device.label || device.deviceId} failed:`,
            deviceError.message
          );
        }
      }

      throw new Error("No working system audio devices");
    } catch (error) {
      this.log("error", "Device enumeration failed:", error.message);
      return null;
    }
  }

  // Test if stream contains actual system audio
  async testStreamForSystemAudio(stream, duration = 2000) {
    return new Promise((resolve) => {
      try {
        const audioContext = new (window.AudioContext ||
          window.webkitAudioContext)();
        const analyser = audioContext.createAnalyser();
        const source = audioContext.createMediaStreamSource(stream);

        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.3;
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        source.connect(analyser);

        let maxLevel = 0;
        let significantSamples = 0;
        let totalSamples = 0;
        const checkInterval = 100;
        const maxChecks = duration / checkInterval;

        const checkAudio = () => {
          analyser.getByteFrequencyData(dataArray);

          const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
          const peak = Math.max(...dataArray);
          const variance =
            dataArray.reduce(
              (sum, val) => sum + Math.pow(val - average, 2),
              0
            ) / dataArray.length;

          maxLevel = Math.max(maxLevel, average);
          totalSamples++;

          // Look for actual signal patterns (not just noise)
          if (average > 3 && variance > 5) {
            significantSamples++;
          }

          if (totalSamples < maxChecks) {
            setTimeout(checkAudio, checkInterval);
          } else {
            // Cleanup
            source.disconnect();
            audioContext.close();

            // Determine if this is real system audio
            const hasRealAudio =
              maxLevel > 8 && // Sufficient overall level
              significantSamples > totalSamples * 0.15; // At least 15% significant samples

            this.log(
              "debug",
              `Audio test: max=${maxLevel.toFixed(
                2
              )}, significant=${significantSamples}/${totalSamples}, hasReal=${hasRealAudio}`
            );
            resolve(hasRealAudio);
          }
        };

        checkAudio();
      } catch (error) {
        this.log("error", "Audio test failed:", error);
        resolve(false);
      }
    });
  }

  // Get microphone stream
  async getMicrophoneStream() {
    this.log("info", "Getting microphone stream");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000,
          channelCount: 1,
        },
      });

      this.log("success", "Microphone stream obtained");
      return stream;
    } catch (error) {
      this.log("error", "Failed to get microphone:", error.message);
      throw error;
    }
  }

  // Create mixed stream (system + microphone)
  async createMixedStream() {
    this.log("info", "Creating mixed audio stream (system + microphone)");

    try {
      // Get system audio using all available methods
      const systemStream = await this.captureSystemAudio();

      // Get microphone
      const micStream = await this.getMicrophoneStream();

      if (!systemStream && !micStream) {
        throw new Error("Neither system audio nor microphone available");
      }

      if (!systemStream) {
        this.log("warn", "No system audio available, using microphone only");
        this.micStream = micStream;
        return micStream;
      }

      if (!micStream) {
        this.log("warn", "No microphone available, using system audio only");
        this.systemStream = systemStream;
        return systemStream;
      }

      // Create audio mixer
      this.mixer.context = new (window.AudioContext ||
        window.webkitAudioContext)({
        sampleRate: 16000,
        latencyHint: "interactive",
      });

      this.mixer.systemSource =
        this.mixer.context.createMediaStreamSource(systemStream);
      this.mixer.micSource =
        this.mixer.context.createMediaStreamSource(micStream);

      this.mixer.systemGain = this.mixer.context.createGain();
      this.mixer.micGain = this.mixer.context.createGain();

      // Balance audio levels
      this.mixer.systemGain.gain.value = 0.6; // System audio slightly lower
      this.mixer.micGain.gain.value = 1.0; // Microphone at full volume

      this.mixer.destination =
        this.mixer.context.createMediaStreamDestination();

      // Connect audio graph
      this.mixer.systemSource.connect(this.mixer.systemGain);
      this.mixer.micSource.connect(this.mixer.micGain);
      this.mixer.systemGain.connect(this.mixer.destination);
      this.mixer.micGain.connect(this.mixer.destination);

      this.systemStream = systemStream;
      this.micStream = micStream;
      this.finalStream = this.mixer.destination.stream;

      this.log("success", "Mixed audio stream created successfully");
      return this.finalStream;
    } catch (error) {
      this.log("error", "Failed to create mixed stream:", error.message);

      // Fallback to microphone only
      try {
        const micStream = await this.getMicrophoneStream();
        this.log("warn", "Fallback: Using microphone only");
        this.micStream = micStream;
        return micStream;
      } catch (micError) {
        this.log("error", "Even microphone fallback failed:", micError.message);
        throw micError;
      }
    }
  }

  // Main capture method - tries all approaches
  async captureSystemAudio() {
    this.log("info", "=== STARTING COMPREHENSIVE SYSTEM AUDIO CAPTURE ===");

    if (this.isCapturing) {
      this.log("warn", "Capture already in progress");
      return this.systemStream;
    }

    this.isCapturing = true;

    // Define capture methods in order of preference
    const methods = [
      {
        name: "Enhanced Display Media",
        fn: () => this.captureSystemAudioEnhanced(),
      },
      {
        name: "Electron Desktop Capturer",
        fn: () => this.captureSystemAudioElectron(),
      },
      {
        name: "Platform-Specific Audio",
        fn: () => this.captureSystemAudioPlatformSpecific(),
      },
      {
        name: "Device Enumeration",
        fn: () => this.captureSystemAudioDeviceEnum(),
      },
    ];

    for (let i = 0; i < methods.length; i++) {
      const method = methods[i];
      this.log(
        "info",
        `Trying method ${i + 1}/${methods.length}: ${method.name}`
      );

      try {
        const stream = await method.fn();

        if (stream && stream.getAudioTracks().length > 0) {
          this.log("success", `${method.name} succeeded!`);
          this.systemStream = stream;
          this.currentMethod = method.name;
          this.isCapturing = false;
          return stream;
        }
      } catch (error) {
        this.log("error", `${method.name} failed:`, error.message);
      }
    }

    this.log("error", "All system audio capture methods failed");
    this.isCapturing = false;
    return null;
  }

  // Get the best available audio stream
  async getBestAudioStream() {
    this.log("info", "Getting best available audio stream");

    try {
      // Try to create mixed stream (system + mic)
      const mixedStream = await this.createMixedStream();

      if (mixedStream) {
        this.log(
          "success",
          "Best audio stream obtained:",
          this.currentMethod || "Mixed"
        );
        return {
          stream: mixedStream,
          type: this.systemStream
            ? this.micStream
              ? "mixed"
              : "system"
            : "microphone",
          method: this.currentMethod,
        };
      }

      throw new Error("No audio streams available");
    } catch (error) {
      this.log("error", "Failed to get best audio stream:", error.message);
      throw error;
    }
  }

  // Adjust audio mix levels
  adjustMixLevels(systemLevel = 0.6, micLevel = 1.0) {
    if (this.mixer.systemGain && this.mixer.micGain) {
      this.mixer.systemGain.gain.value = systemLevel;
      this.mixer.micGain.gain.value = micLevel;
      this.log(
        "info",
        `Audio mix adjusted - System: ${systemLevel}, Mic: ${micLevel}`
      );
    }
  }

  // Stop all audio capture and cleanup
  stop() {
    this.log("info", "Stopping enhanced audio capture");

    this.isCapturing = false;

    // Stop all streams
    [this.systemStream, this.micStream, this.finalStream].forEach((stream) => {
      if (stream) {
        stream.getTracks().forEach((track) => {
          this.log("debug", `Stopping track: ${track.label}`);
          track.stop();
        });
      }
    });

    // Cleanup audio mixer
    if (this.mixer.context) {
      try {
        this.mixer.context.close();
      } catch (error) {
        this.log("warn", "Error closing audio context:", error.message);
      }
    }

    // Reset all references
    this.systemStream = null;
    this.micStream = null;
    this.finalStream = null;
    this.currentMethod = null;
    this.mixer = {
      context: null,
      systemSource: null,
      micSource: null,
      systemGain: null,
      micGain: null,
      destination: null,
    };

    this.log("success", "Enhanced audio capture stopped and cleaned up");
  }

  // Get status information
  getStatus() {
    return {
      isCapturing: this.isCapturing,
      hasSystemAudio: !!this.systemStream,
      hasMicrophone: !!this.micStream,
      hasMixed: !!this.finalStream,
      currentMethod: this.currentMethod,
      platform: this.platform,
    };
  }
}

// Export for global use
if (typeof window !== "undefined") {
  window.EnhancedAudioCapture = EnhancedAudioCapture;

  if (window.$DebugTestMode) {
    console.log("✅ Enhanced Audio Capture Module loaded successfully");
    console.log("📝 Usage: const audioCapture = new EnhancedAudioCapture();");
    console.log(
      "📝 Usage: const stream = await audioCapture.getBestAudioStream();"
    );
  }
}

// Compatibility function for existing code
async function captureSystemAudioFixed() {
  if (typeof window !== "undefined" && window.$DebugTestMode) {
    console.log("🎵 Using Enhanced Audio Capture for captureSystemAudioFixed");
  }

  const audioCapture = new EnhancedAudioCapture();
  try {
    const result = await audioCapture.getBestAudioStream();
    return result.stream;
  } catch (error) {
    if (typeof window !== "undefined" && window.$DebugTestMode) {
      console.error("🎵 Enhanced audio capture failed:", error);
    }
    return null;
  }
}

// Export compatibility function
if (typeof window !== "undefined") {
  window.captureSystemAudioFixed = captureSystemAudioFixed;
}

// Also export as module if needed
if (typeof module !== "undefined" && module.exports) {
  module.exports = { EnhancedAudioCapture, captureSystemAudioFixed };
}
