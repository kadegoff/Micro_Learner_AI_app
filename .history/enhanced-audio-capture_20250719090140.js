// enhanced-audio-capture-fixed.js
// CRASH-SAFE Enhanced System Audio Capture Module for Memoria
// Fixes IPC message validation errors that cause renderer crashes

if ($DebugTestMode) {
  console.log("🎵 [001] Loading CRASH-SAFE Enhanced Audio Capture Module...");
}

class CrashSafeAudioCapture {
  constructor() {
    if ($DebugTestMode) {
      console.log("🎵 [002] Starting CrashSafeAudioCapture constructor...");
    }

    this.audioContext = null;
    this.systemStream = null;
    this.micStream = null;
    this.finalStream = null;
    this.isCapturing = false;
    this.currentMethod = null;
    this.destroyed = false;

    // IPC safety limits to prevent crashes
    this.maxAudioChunkSize = 8192; // Smaller chunks
    this.maxIPCRetries = 3;
    this.ipcTimeout = 2000; // 2 second timeout

    // Track all resources for cleanup
    this.resources = {
      streams: new Set(),
      contexts: new Set(),
      timers: new Set(),
    };

    // Audio mixer components
    this.mixer = {
      context: null,
      systemSource: null,
      micSource: null,
      systemGain: null,
      micGain: null,
      destination: null,
    };

    if ($DebugTestMode) {
      console.log("🎵 [004] Starting platform detection...");
    }

    // Platform detection
    this.platform = this.detectPlatform();

    if ($DebugTestMode) {
      console.log(
        "🎵 [005] CrashSafeAudioCapture initialized for platform:",
        this.platform
      );
    }
  }

  // Add resource tracking methods
  trackStream(stream) {
    this.resources.streams.add(stream);
    return stream;
  }

  trackContext(context) {
    this.resources.contexts.add(context);
    return context;
  }

  trackTimer(timer) {
    this.resources.timers.add(timer);
    return timer;
  }

  detectPlatform() {
    if ($DebugTestMode) {
      console.log("🎵 [006] Detecting platform...");
    }

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
    if ($DebugTestMode) {
      const timestamp = new Date().toISOString().split("T")[1].slice(0, -1);
      console.log(
        `[${timestamp}] 🎵 ${level.toUpperCase()}: ${message}`,
        ...args
      );
    }
  }

  // FIXED: Crash-safe display media capture
  async safeCaptureDisplayMedia() {
    if ($DebugTestMode) {
      console.log("🎵 [013] CRASH-SAFE display media starting...");
    }

    try {
      // Method 1: Minimal constraints to avoid crashes
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: false, // ✅ CRITICAL: No video to avoid complexity
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 16000,
          channelCount: 1,
        },
      });

      if (stream && stream.getAudioTracks().length > 0) {
        if ($DebugTestMode) {
          console.log("🎵 [015] ✅ Safe display media successful");
        }
        return stream;
      }
    } catch (error) {
      if ($DebugTestMode) {
        console.log("🎵 [016] Safe display media failed:", error.message);
      }
    }

    return null;
  }

  // FIXED: Crash-safe system audio capture
  async captureSystemAudioEnhanced() {
    if ($DebugTestMode) {
      console.log("🎵 [025] CRASH-SAFE system audio starting...");
    }

    // Method 1: Ultra-safe display media
    try {
      const stream = await this.safeCaptureDisplayMedia();
      if (stream) {
        if ($DebugTestMode) {
          console.log("🎵 [027] ✅ Safe display media successful");
        }
        return stream;
      }
    } catch (error) {
      if ($DebugTestMode) {
        console.log("🎵 [028] Safe display media failed:", error.message);
      }
    }

    return null;
  }

  // FIXED: Crash-safe Electron capturer
  async captureSystemAudioElectron() {
    if ($DebugTestMode) {
      console.log("🎵 [096] CRASH-SAFE Electron capturer starting...");
    }

    // Check if electronAPI exists
    if (!window.electronAPI) {
      if ($DebugTestMode) {
        console.log("🎵 [098] ⚠️ Not running in Electron environment");
      }
      return null;
    }

    try {
      if ($DebugTestMode) {
        console.log("🎵 [100] Calling SAFE electronAPI...");
      }

      // ✅ CRITICAL FIX: Use timeout to prevent IPC hangs
      const result = await Promise.race([
        window.electronAPI.getScreenCaptureSource(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("IPC timeout")), this.ipcTimeout)
        ),
      ]);

      if (!result) {
        throw new Error("No screen capture source available");
      }

      if ($DebugTestMode) {
        console.log("🎵 [102] Screen source obtained:", result.name);
      }

      // ✅ CRITICAL FIX: Use safe constraints to prevent crashes
      const safeConstraints = {
        audio: {
          mandatory: {
            chromeMediaSource: "desktop",
            chromeMediaSourceId: result.id,
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          },
        },
        video: false, // ✅ CRITICAL: No video
      };

      // ✅ CRITICAL FIX: Wrap getUserMedia in timeout to prevent hangs
      const stream = await Promise.race([
        navigator.mediaDevices.getUserMedia(safeConstraints),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("getUserMedia timeout")), 3000)
        ),
      ]);

      if (stream && stream.getAudioTracks().length > 0) {
        if ($DebugTestMode) {
          console.log("🎵 [110] ✅ CRASH-SAFE Electron successful");
        }
        return stream;
      }

      throw new Error("No audio tracks in stream");
    } catch (error) {
      if ($DebugTestMode) {
        console.log("🎵 [113] ❌ CRASH-SAFE Electron failed:", error.message);
      }
      return null;
    }
  }

  // FIXED: Safe audio processing that won't crash IPC
  async setupSafeAudioProcessing(stream) {
    if ($DebugTestMode) {
      console.log("🎵 [200] Setting up CRASH-SAFE audio processing...");
    }

    try {
      // Create audio context with safety limits
      const audioContext = new (window.AudioContext ||
        window.webkitAudioContext)({
        sampleRate: 16000,
        latencyHint: "interactive",
      });

      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }

      const source = audioContext.createMediaStreamSource(stream);
      const gainNode = audioContext.createGain();
      gainNode.gain.value = 1.5; // Moderate gain

      // ✅ CRITICAL: Use smaller buffer to prevent IPC crashes
      const processor = audioContext.createScriptProcessor(512, 1, 1); // Much smaller!

      source.connect(gainNode);
      gainNode.connect(processor);
      processor.connect(audioContext.destination);

      let audioBuffer = [];
      let isProcessing = false;
      let ipcErrors = 0;
      const maxIPCErrors = 5;

      // ✅ CRITICAL FIX: Safe audio processing with IPC protection
      processor.onaudioprocess = (e) => {
        if (!this.isCapturing || ipcErrors >= maxIPCErrors) return;

        try {
          const inputData = e.inputBuffer.getChannelData(0);
          const maxValue = Math.max(...inputData.map(Math.abs));

          if (maxValue > 0.001) {
            audioBuffer.push(...inputData);

            // ✅ CRITICAL: Limit buffer size to prevent memory crashes
            if (audioBuffer.length > 16000) {
              // 1 second at 16kHz
              audioBuffer = audioBuffer.slice(-8000); // Keep only 0.5 seconds
            }
          }
        } catch (error) {
          if ($DebugTestMode) {
            console.warn("🎵 Audio processing error:", error.message);
          }
        }
      };

      // ✅ CRITICAL FIX: Safe IPC communication with retries and timeouts
      const processingInterval = setInterval(async () => {
        if (!this.isCapturing || isProcessing || audioBuffer.length < 2000)
          return;

        isProcessing = true;

        try {
          // ✅ CRITICAL: Limit chunk size to prevent IPC message size violations
          const chunkSize = Math.min(
            audioBuffer.length,
            this.maxAudioChunkSize
          );
          const audioToProcess = new Float32Array(
            audioBuffer.splice(0, chunkSize)
          );

          // ✅ CRITICAL: Safe conversion with bounds checking
          const int16Array = new Int16Array(audioToProcess.length);
          for (let i = 0; i < audioToProcess.length; i++) {
            const s = Math.max(-1, Math.min(1, audioToProcess[i]));
            int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
          }

          // ✅ CRITICAL: Safe IPC call with timeout and retry logic
          let retryCount = 0;
          while (retryCount < this.maxIPCRetries) {
            try {
              const result = await Promise.race([
                window.electronAPI.transcribeWithVosk(int16Array),
                new Promise((_, reject) =>
                  setTimeout(
                    () => reject(new Error("IPC timeout")),
                    this.ipcTimeout
                  )
                ),
              ]);

              if (result?.error) {
                throw new Error(result.error);
              }

              // Reset error count on success
              ipcErrors = 0;
              break;
            } catch (ipcError) {
              retryCount++;
              ipcErrors++;

              if ($DebugTestMode) {
                console.warn(
                  `🎵 IPC error ${retryCount}/${this.maxIPCRetries}:`,
                  ipcError.message
                );
              }

              if (retryCount >= this.maxIPCRetries) {
                throw new Error(
                  `IPC failed after ${this.maxIPCRetries} retries`
                );
              }

              // Wait before retry
              await new Promise((resolve) => setTimeout(resolve, 100));
            }
          }
        } catch (error) {
          if ($DebugTestMode) {
            console.warn("🎵 ⚠️ Audio chunk processing error:", error.message);
          }

          if (ipcErrors >= maxIPCErrors) {
            if ($DebugTestMode) {
              console.error("🎵 ❌ Too many IPC errors, stopping processing");
            }
            this.stop();
          }
        } finally {
          isProcessing = false;
        }
      }, 300); // Slightly longer interval for safety

      // Store references for cleanup
      window.audioProcessor = processor;
      window.processingInterval = processingInterval;
      window.audioContext = audioContext;
      window.gainNode = gainNode;

      if ($DebugTestMode) {
        console.log("🎵 [201] ✅ CRASH-SAFE audio processing started");
      }
    } catch (error) {
      if ($DebugTestMode) {
        console.error("🎵 [202] ❌ Audio processing setup failed:", error);
      }
      throw error;
    }
  }

  // Main capture method with crash prevention
  async captureSystemAudio() {
    if ($DebugTestMode) {
      console.log("🎵 [170] === STARTING CRASH-SAFE SYSTEM AUDIO CAPTURE ===");
    }

    if (this.isCapturing) {
      if ($DebugTestMode) {
        console.log("🎵 [171] ⚠️ Capture already in progress");
      }
      return this.systemStream;
    }

    this.isCapturing = true;

    // ✅ CRITICAL FIX: Reorder methods to try safest first
    const methods = [
      {
        name: "Enhanced Display Media (Safe)",
        fn: () => this.captureSystemAudioEnhanced(),
      },
      {
        name: "Electron Desktop Capturer (Crash-Safe)",
        fn: () => this.captureSystemAudioElectron(),
      },
      {
        name: "Platform-Specific Audio",
        fn: () => this.captureSystemAudioPlatformSpecific(),
      },
    ];

    if ($DebugTestMode) {
      console.log("🎵 [174] Total crash-safe methods to try:", methods.length);
    }

    for (let i = 0; i < methods.length; i++) {
      const method = methods[i];
      if ($DebugTestMode) {
        console.log(`🎵 [175.${i}] Trying CRASH-SAFE method: ${method.name}`);
      }

      try {
        // ✅ CRITICAL: Wrap each method in timeout to prevent hangs
        const stream = await Promise.race([
          method.fn(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Method timeout")), 5000)
          ),
        ]);

        if (stream && stream.getAudioTracks().length > 0) {
          const tracks = stream.getAudioTracks();
          const track = tracks[0];

          if ($DebugTestMode) {
            console.log(
              `🎵 [178.${i}] ✅ CRASH-SAFE ${method.name} succeeded!`
            );
            console.log(`🎵 [179.${i}] Audio track label: ${track.label}`);
          }

          // Check if this looks like a microphone (reject if so)
          const isLikelyMicrophone =
            track.label.toLowerCase().includes("microphone") ||
            track.label.toLowerCase().includes("mic") ||
            track.label.toLowerCase().includes("input");

          if (isLikelyMicrophone) {
            if ($DebugTestMode) {
              console.log(
                `🎵 [180.${i}] ⚠️ Rejecting microphone: ${track.label}`
              );
            }
            stream.getTracks().forEach((track) => track.stop());
            continue;
          }

          this.systemStream = stream;
          this.currentMethod = method.name;
          this.isCapturing = false;
          return stream;
        }
      } catch (error) {
        if ($DebugTestMode) {
          console.log(
            `🎵 [182.${i}] ❌ CRASH-SAFE ${method.name} failed:`,
            error.message
          );
        }
      }
    }

    if ($DebugTestMode) {
      console.log("🎵 [183] ❌ All crash-safe methods failed");
    }
    this.isCapturing = false;
    return null;
  }

  // FIXED: Crash-safe mixed stream creation
  async getBestAudioStream() {
    if ($DebugTestMode) {
      console.log(
        "🎵 [185] Getting best available audio stream (CRASH-SAFE)..."
      );
    }

    try {
      // Try to get system audio first
      const systemStream = await this.captureSystemAudio();

      if (systemStream) {
        try {
          // Try to get microphone
          const micStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
              sampleRate: 16000,
              channelCount: 1,
            },
          });

          if (micStream) {
            // Create mixed stream safely
            const mixedStream = await this.createSafeMixedStream(
              systemStream,
              micStream
            );

            if (mixedStream) {
              this.systemStream = systemStream;
              this.micStream = micStream;
              this.finalStream = mixedStream;

              return {
                stream: mixedStream,
                type: "mixed",
                method: this.currentMethod + " + Microphone",
              };
            }
          }
        } catch (micError) {
          if ($DebugTestMode) {
            console.log(
              "🎵 [187] Microphone failed, using system audio only:",
              micError.message
            );
          }
        }

        // Return system audio only
        this.systemStream = systemStream;
        this.finalStream = systemStream;

        return {
          stream: systemStream,
          type: "system",
          method: this.currentMethod,
        };
      }

      // Fallback to microphone only
      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000,
          channelCount: 1,
        },
      });

      this.micStream = micStream;
      this.finalStream = micStream;

      return {
        stream: micStream,
        type: "microphone",
        method: "Microphone Fallback",
      };
    } catch (error) {
      if ($DebugTestMode) {
        console.log("🎵 [191] ❌ All audio capture failed:", error.message);
      }
      throw error;
    }
  }

  // FIXED: Safe mixed stream creation
  async createSafeMixedStream(systemStream, micStream) {
    try {
      const audioContext = new (window.AudioContext ||
        window.webkitAudioContext)({
        sampleRate: 16000,
        latencyHint: "interactive",
      });

      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }

      const systemSource = audioContext.createMediaStreamSource(systemStream);
      const micSource = audioContext.createMediaStreamSource(micStream);

      const systemGain = audioContext.createGain();
      const micGain = audioContext.createGain();

      // Balanced levels
      systemGain.gain.value = 0.6;
      micGain.gain.value = 0.8;

      const destination = audioContext.createMediaStreamDestination();

      systemSource.connect(systemGain);
      micSource.connect(micGain);
      systemGain.connect(destination);
      micGain.connect(destination);

      // Store mixer for cleanup
      this.mixer = {
        context: audioContext,
        systemSource,
        micSource,
        systemGain,
        micGain,
        destination,
      };

      return destination.stream;
    } catch (error) {
      if ($DebugTestMode) {
        console.error("🎵 Safe mixed stream creation failed:", error);
      }
      return null;
    }
  }

  // Platform-specific capture (simplified for safety)
  async captureSystemAudioPlatformSpecific() {
    if ($DebugTestMode) {
      console.log("🎵 [038] SAFE platform-specific audio capture...");
    }

    // For Windows, try safe getUserMedia with microphone
    if (this.platform === "windows") {
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
        return stream;
      } catch (error) {
        if ($DebugTestMode) {
          console.log("🎵 Windows safe capture failed:", error.message);
        }
      }
    }

    return null;
  }

  // FIXED: Safe cleanup
  async stop() {
    if (this.destroyed) return;
    this.isCapturing = false;
    this.destroyed = true;

    try {
      // Stop processing interval
      if (window.processingInterval) {
        clearInterval(window.processingInterval);
        window.processingInterval = null;
      }

      // Stop all streams
      [this.systemStream, this.micStream, this.finalStream].forEach(
        (stream) => {
          if (stream) {
            stream.getTracks().forEach((track) => track.stop());
          }
        }
      );

      // Close mixer context
      if (this.mixer.context && this.mixer.context.state !== "closed") {
        await this.mixer.context.close();
      }

      // Close main audio context
      if (window.audioContext && window.audioContext.state !== "closed") {
        await window.audioContext.close();
      }

      if ($DebugTestMode) {
        console.log("🎵 ✅ CRASH-SAFE cleanup completed");
      }
    } catch (error) {
      console.error("🎵 Cleanup error:", error);
    }
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
      destroyed: this.destroyed,
    };
  }
}

// FIXED: Crash-safe initialization
async function initializeCrashSafeAudioCapture() {
  if ($DebugTestMode) {
    console.log("🎵 [210] Initializing CRASH-SAFE Audio Capture...");
  }

  try {
    const audioCapture = new CrashSafeAudioCapture();
    if ($DebugTestMode) {
      console.log(
        "🎵 [212] ✅ CRASH-SAFE Audio Capture initialized successfully"
      );
    }
    return audioCapture;
  } catch (error) {
    if ($DebugTestMode) {
      console.error(
        "🎵 [213] ❌ Failed to initialize CRASH-SAFE Audio Capture:",
        error
      );
    }
    return null;
  }
}

// FIXED: Crash-safe system audio capture function
async function captureSystemAudioCrashSafe() {
  if ($DebugTestMode) {
    console.log("🎵 [214] === CRASH-SAFE SYSTEM AUDIO CAPTURE ===");
  }

  if (!globalAudioCapture) {
    globalAudioCapture = await initializeCrashSafeAudioCapture();
  }

  if (!globalAudioCapture) {
    if ($DebugTestMode) {
      console.error("🎵 [217] ❌ No crash-safe audio capture available");
    }
    return null;
  }

  try {
    const result = await Promise.race([
      globalAudioCapture.getBestAudioStream(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Overall timeout")), 10000)
      ),
    ]);

    if (result && result.stream) {
      if ($DebugTestMode) {
        console.log("🎵 [221] ✅ CRASH-SAFE audio capture successful");
        console.log("🎵 [222] Stream type:", result.type);
        console.log("🎵 [223] Method used:", result.method);
      }
      return result.stream;
    }

    return null;
  } catch (error) {
    if ($DebugTestMode) {
      console.error("🎵 [226] ❌ CRASH-SAFE audio capture failed:", error);
    }
    return null;
  }
}

// Export functions
if (typeof window !== "undefined") {
  window.captureSystemAudioCrashSafe = captureSystemAudioCrashSafe;
  window.CrashSafeAudioCapture = CrashSafeAudioCapture;
  window.initializeCrashSafeAudioCapture = initializeCrashSafeAudioCapture;

  if ($DebugTestMode) {
    console.log(
      "🎵 [241] ✅ CRASH-SAFE Enhanced Audio Capture Module loaded successfully"
    );
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { CrashSafeAudioCapture, captureSystemAudioCrashSafe };
}

if ($DebugTestMode) {
  console.log(
    "🎵 [245] 🎉 CRASH-SAFE Enhanced Audio Capture Module fully loaded!"
  );
}
