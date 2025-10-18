// enhanced-audio-capture.js
// Enhanced System Audio Capture Module for Memoria
// Usage: Include this file before main-renderer.js

if ($DebugTestMode) {
  console.log("🎵 [001] Loading Enhanced Audio Capture Module...");
}

class EnhancedAudioCapture {
  constructor() {
    if ($DebugTestMode) {
      console.log("🎵 [002] Starting EnhancedAudioCapture constructor...");
    }

    this.audioContext = null;
    this.systemStream = null;
    this.micStream = null;
    this.finalStream = null;
    this.isCapturing = false;
    this.currentMethod = null;
    this.destroyed = false;

    if ($DebugTestMode) {
      console.log("🎵 [003] Initializing audio mixer components...");
    }

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
        "🎵 [005] EnhancedAudioCapture initialized for platform:",
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

    if ($DebugTestMode) {
      console.log("🎵 [007] User agent:", userAgent);
      console.log("🎵 [008] Platform:", platform);
    }

    if (platform.includes("win") || userAgent.includes("windows")) {
      if ($DebugTestMode) {
        console.log("🎵 [009] Platform detected: Windows");
      }
      return "windows";
    } else if (platform.includes("mac") || userAgent.includes("mac")) {
      if ($DebugTestMode) {
        console.log("🎵 [010] Platform detected: macOS");
      }
      return "macos";
    } else if (platform.includes("linux") || userAgent.includes("linux")) {
      if ($DebugTestMode) {
        console.log("🎵 [011] Platform detected: Linux");
      }
      return "linux";
    }

    if ($DebugTestMode) {
      console.log("🎵 [012] Platform detected: Unknown");
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

  // CRASH-SAFE: Ultra-safe display media capture
  async safeCaptureDisplayMedia() {
    if ($DebugTestMode) {
      console.log("🎵 [013] METHOD 1: Ultra-safe getDisplayMedia starting...");
    }

    try {
      if ($DebugTestMode) {
        console.log("🎵 [014] Creating safe constraints for display media...");
      }

      // CRITICAL: Use only the safest constraints - NO Chrome-specific options
      const safeConstraints = {
        video: false, // Video OFF to prevent crashes
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 16000,
          channelCount: 1,
          // ❌ REMOVED ALL CRASH-CAUSING OPTIONS:
          // - No chromeMediaSource
          // - No chromeMediaSourceId
          // - No systemAudio
          // - No suppressLocalAudioPlayback
          // - No mandatory constraints
          // - No advanced constraints
          // - No googXXX options
        },
      };

      if ($DebugTestMode) {
        console.log("🎵 [015] Safe constraints created:", safeConstraints);
        console.log(
          "🎵 [016] Calling navigator.mediaDevices.getDisplayMedia..."
        );
      }

      const stream = await navigator.mediaDevices.getDisplayMedia(
        safeConstraints
      );

      if ($DebugTestMode) {
        console.log(
          "🎵 [017] getDisplayMedia call completed, checking stream..."
        );
        console.log("🎵 [018] Stream object:", stream);
      }

      if (stream && stream.getAudioTracks().length > 0) {
        if ($DebugTestMode) {
          console.log(
            "🎵 [019] ✅ Safe display media successful - has audio tracks"
          );
          console.log(
            "🎵 [020] Audio tracks count:",
            stream.getAudioTracks().length
          );
        }
        return stream;
      }

      if ($DebugTestMode) {
        console.log("🎵 [021] ⚠️ Display media has no audio tracks");
        console.log("🎵 [022] Stopping stream and returning null...");
      }
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      return null;
    } catch (error) {
      if ($DebugTestMode) {
        console.log("🎵 [023] ❌ Safe display media failed:", error.message);
        console.log("🎵 [024] Error details:", error);
      }
      return null;
    }
  }

  // Enhanced display media capture
  async captureSystemAudioEnhanced() {
    if ($DebugTestMode) {
      console.log("🎵 [025] METHOD 1: Enhanced Display Media starting...");
    }

    // Try ultra-safe method first
    if ($DebugTestMode) {
      console.log("🎵 [026] Attempting ultra-safe display media capture...");
    }

    let stream = await this.safeCaptureDisplayMedia();
    if (stream) {
      if ($DebugTestMode) {
        console.log("🎵 [027] Ultra-safe method succeeded, returning stream");
      }
      return stream;
    }

    if ($DebugTestMode) {
      console.log(
        "🎵 [028] Ultra-safe method failed, trying enhanced method..."
      );
    }

    // Try with more permissive constraints
    try {
      if ($DebugTestMode) {
        console.log("🎵 [029] Creating enhanced constraints...");
      }

      stream = await navigator.mediaDevices.getDisplayMedia({
        video: false,
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: { ideal: 16000 },
          channelCount: { ideal: 1 },
        },
      });

      if ($DebugTestMode) {
        console.log("🎵 [030] Enhanced getDisplayMedia call completed");
        console.log("🎵 [031] Checking enhanced stream for audio tracks...");
      }

      if (stream && stream.getAudioTracks().length > 0) {
        if ($DebugTestMode) {
          console.log("🎵 [032] ✅ Enhanced display media successful");
          console.log(
            "🎵 [033] Enhanced audio tracks count:",
            stream.getAudioTracks().length
          );
        }
        return stream;
      }

      if ($DebugTestMode) {
        console.log("🎵 [034] Enhanced stream has no audio tracks");
      }
    } catch (error) {
      if ($DebugTestMode) {
        console.log(
          "🎵 [035] ❌ Enhanced display media failed:",
          error.message
        );
        console.log("🎵 [036] Enhanced error details:", error);
      }
    }

    if ($DebugTestMode) {
      console.log("🎵 [037] All display media methods failed, returning null");
    }
    return null;
  }

  // Platform-specific capture
  async captureSystemAudioPlatformSpecific() {
    if ($DebugTestMode) {
      console.log(
        "🎵 [038] METHOD 2: Platform-specific audio capture starting..."
      );
      console.log("🎵 [039] Current platform:", this.platform);
    }

    switch (this.platform) {
      case "windows":
        if ($DebugTestMode) {
          console.log("🎵 [040] Delegating to Windows system audio capture...");
        }
        return await this.captureWindowsSystemAudio();
      case "macos":
        if ($DebugTestMode) {
          console.log("🎵 [041] Delegating to macOS system audio capture...");
        }
        return await this.captureMacSystemAudio();
      case "linux":
        if ($DebugTestMode) {
          console.log("🎵 [042] Delegating to Linux system audio capture...");
        }
        return await this.captureLinuxSystemAudio();
      default:
        if ($DebugTestMode) {
          console.log(
            "🎵 [043] Unknown platform, using generic system audio capture..."
          );
        }
        return await this.captureGenericSystemAudio();
    }
  }

  async captureWindowsSystemAudio() {
    try {
      // Method 1: Try display media first (much safer)
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: false,
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 16000,
          channelCount: 1,
        },
      });

      if (stream && stream.getAudioTracks().length > 0) {
        return stream;
      }
    } catch (error) {
      console.warn("Display media failed:", error.message);
    }

    // Method 2: Fallback to microphone (no Chrome constraints)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 16000,
          channelCount: 1,
          // NO mandatory or advanced constraints
        },
      });
      return stream;
    } catch (error) {
      console.warn("Microphone fallback failed:", error.message);
      return null;
    }
  }

  async captureMacSystemAudio() {
    if ($DebugTestMode) {
      console.log("🎵 [055] Trying macOS Core Audio...");
      console.log("🎵 [056] Enumerating audio devices for virtual devices...");
    }

    try {
      // macOS often requires virtual audio devices like Soundflower or BlackHole
      const devices = await navigator.mediaDevices.enumerateDevices();

      if ($DebugTestMode) {
        console.log("🎵 [057] Total devices found:", devices.length);
        console.log("🎵 [058] Filtering for virtual audio devices...");
      }

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
        if ($DebugTestMode) {
          console.log(
            "🎵 [059] Found " + virtualDevices.length + " virtual audio devices"
          );
          virtualDevices.forEach((device, index) => {
            console.log(
              "🎵 [060." + index + "] Virtual device:",
              device.label,
              device.deviceId
            );
          });
        }

        for (let i = 0; i < virtualDevices.length; i++) {
          const device = virtualDevices[i];
          try {
            if ($DebugTestMode) {
              console.log(
                "🎵 [061." + i + "] Trying virtual device: " + device.label
              );
              console.log(
                "🎵 [062." +
                  i +
                  "] Creating getUserMedia constraints for device..."
              );
            }

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

            if ($DebugTestMode) {
              console.log(
                "🎵 [063." +
                  i +
                  "] Stream obtained, testing for system audio..."
              );
            }

            const hasAudio = await this.testStreamForSystemAudio(stream);

            if (hasAudio) {
              if ($DebugTestMode) {
                console.log(
                  "🎵 [064." +
                    i +
                    "] ✅ macOS virtual device " +
                    device.label +
                    " successful"
                );
              }
              return stream;
            } else {
              if ($DebugTestMode) {
                console.log(
                  "🎵 [065." +
                    i +
                    "] Virtual device " +
                    device.label +
                    " has no audio signal"
                );
              }
              stream.getTracks().forEach((track) => track.stop());
            }
          } catch (deviceError) {
            if ($DebugTestMode) {
              console.log(
                "🎵 [066." +
                  i +
                  "] ⚠️ Virtual device " +
                  device.label +
                  " failed:",
                deviceError.message
              );
            }
          }
        }

        if ($DebugTestMode) {
          console.log(
            "🎵 [067] All virtual devices failed, trying fallback..."
          );
        }
      } else {
        if ($DebugTestMode) {
          console.log("🎵 [068] No virtual devices found, trying fallback...");
        }
      }

      // Fallback: Try default system approach
      if ($DebugTestMode) {
        console.log("🎵 [069] Creating macOS fallback constraints...");
      }

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

      if ($DebugTestMode) {
        console.log("🎵 [070] macOS default method attempted");
        console.log(
          "🎵 [071] macOS fallback stream tracks:",
          stream.getTracks().length
        );
      }
      return stream;
    } catch (error) {
      if ($DebugTestMode) {
        console.log("🎵 [072] ❌ macOS system audio failed:", error.message);
        console.log("🎵 [073] macOS error details:", error);
      }
      return null;
    }
  }

  async captureLinuxSystemAudio() {
    if ($DebugTestMode) {
      console.log("🎵 [074] Trying Linux PulseAudio/ALSA...");
      console.log("🎵 [075] Enumerating devices for monitor devices...");
    }

    try {
      // Look for monitor devices (PulseAudio loopback)
      const devices = await navigator.mediaDevices.enumerateDevices();

      if ($DebugTestMode) {
        console.log("🎵 [076] Total Linux devices found:", devices.length);
        console.log("🎵 [077] Filtering for monitor/loopback devices...");
      }

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
        if ($DebugTestMode) {
          console.log(
            "🎵 [078] Found " + monitorDevices.length + " monitor devices"
          );
          monitorDevices.forEach((device, index) => {
            console.log(
              "🎵 [079." + index + "] Monitor device:",
              device.label,
              device.deviceId
            );
          });
        }

        for (let i = 0; i < monitorDevices.length; i++) {
          const device = monitorDevices[i];
          try {
            if ($DebugTestMode) {
              console.log(
                "🎵 [080." + i + "] Trying monitor device: " + device.label
              );
              console.log(
                "🎵 [081." + i + "] Creating constraints for monitor device..."
              );
            }

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

            if ($DebugTestMode) {
              console.log(
                "🎵 [082." +
                  i +
                  "] Monitor stream obtained, testing for audio..."
              );
            }

            const hasAudio = await this.testStreamForSystemAudio(stream);

            if (hasAudio) {
              if ($DebugTestMode) {
                console.log(
                  "🎵 [083." +
                    i +
                    "] ✅ Linux monitor device " +
                    device.label +
                    " successful"
                );
              }
              return stream;
            } else {
              if ($DebugTestMode) {
                console.log(
                  "🎵 [084." +
                    i +
                    "] Monitor device " +
                    device.label +
                    " has no audio signal"
                );
              }
              stream.getTracks().forEach((track) => track.stop());
            }
          } catch (deviceError) {
            if ($DebugTestMode) {
              console.log(
                "🎵 [085." +
                  i +
                  "] ⚠️ Monitor device " +
                  device.label +
                  " failed:",
                deviceError.message
              );
            }
          }
        }

        if ($DebugTestMode) {
          console.log("🎵 [086] All monitor devices failed");
        }
      } else {
        if ($DebugTestMode) {
          console.log("🎵 [087] No monitor devices found");
        }
      }

      throw new Error("No suitable monitor devices found");
    } catch (error) {
      if ($DebugTestMode) {
        console.log("🎵 [088] ❌ Linux system audio failed:", error.message);
        console.log("🎵 [089] Linux error details:", error);
      }
      return null;
    }
  }

  async captureGenericSystemAudio() {
    if ($DebugTestMode) {
      console.log("🎵 [090] Trying generic system audio approach...");
      console.log("🎵 [091] Creating generic constraints...");
    }

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

      if ($DebugTestMode) {
        console.log("🎵 [092] Generic system audio method attempted");
        console.log(
          "🎵 [093] Generic stream tracks:",
          stream.getTracks().length
        );
      }
      return stream;
    } catch (error) {
      if ($DebugTestMode) {
        console.log("🎵 [094] ❌ Generic system audio failed:", error.message);
        console.log("🎵 [095] Generic error details:", error);
      }
      return null;
    }
  }

  // Method 3: Electron Desktop Capturer (Enhanced)
  async captureSystemAudioElectron() {
    if ($DebugTestMode) {
      console.log(
        "🎵 [096] METHOD 3: Electron desktop capturer approach starting..."
      );
      console.log("🎵 [097] Checking for Electron environment...");
    }

    if (!window.electronAPI) {
      if ($DebugTestMode) {
        console.log(
          "🎵 [098] ⚠️ Not running in Electron environment - window.electronAPI not found"
        );
      }
      return null;
    }

    if ($DebugTestMode) {
      console.log("🎵 [099] Electron environment detected, proceeding...");
    }

    try {
      if ($DebugTestMode) {
        console.log(
          "🎵 [100] Calling window.electronAPI.captureSystemAudio()..."
        );
      }

      // Get available desktop sources
      const result = await window.electronAPI.captureSystemAudio();

      if ($DebugTestMode) {
        console.log("🎵 [101] Electron API call completed");
        console.log("🎵 [102] Result:", result);
      }

      if (!result || !result.success) {
        throw new Error(result?.error || "Failed to get desktop sources");
      }

      if (!result.sources || result.sources.length === 0) {
        throw new Error("No desktop sources available");
      }

      if ($DebugTestMode) {
        console.log(
          "🎵 [103] Found " + result.sources.length + " desktop sources"
        );
        console.log("🎵 [104] Filtering for audio-capable sources...");
      }

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

      if ($DebugTestMode) {
        console.log(
          "🎵 [105] Found " + audioSources.length + " potential audio sources"
        );
        audioSources.forEach((source, index) => {
          console.log(
            "🎵 [106." + index + "] Audio source:",
            source.name,
            source.type,
            source.id
          );
        });
      }

      // Try each audio source
      for (let i = 0; i < audioSources.length; i++) {
        const source = audioSources[i];
        try {
          if ($DebugTestMode) {
            console.log(
              "🎵 [107." + i + "] Trying Electron source: " + source.name
            );
            console.log(
              "🎵 [108." +
                i +
                "] Creating getUserMedia constraints for Electron source..."
            );
          }

          const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              mandatory: {
                chromeMediaSource: "desktop",
                chromeMediaSourceId: source.id,
              },
            },
            video: false,
          });

          if ($DebugTestMode) {
            console.log(
              "🎵 [109." +
                i +
                "] Electron stream obtained, testing for system audio..."
            );
          }

          const hasAudio = await this.testStreamForSystemAudio(stream);

          if (hasAudio) {
            if ($DebugTestMode) {
              console.log(
                "🎵 [110." +
                  i +
                  "] ✅ Electron source " +
                  source.name +
                  " successful"
              );
            }
            return stream;
          } else {
            if ($DebugTestMode) {
              console.log(
                "🎵 [111." +
                  i +
                  "] ⚠️ Source " +
                  source.name +
                  " has no audio signal"
              );
            }
            stream.getTracks().forEach((track) => track.stop());
          }
        } catch (sourceError) {
          if ($DebugTestMode) {
            console.log(
              "🎵 [112." + i + "] ⚠️ Source " + source.name + " failed:",
              sourceError.message
            );
          }
        }
      }

      throw new Error("No working audio sources found");
    } catch (error) {
      if ($DebugTestMode) {
        console.log(
          "🎵 [113] ❌ Electron desktop capturer failed:",
          error.message
        );
        console.log("🎵 [114] Electron error details:", error);
      }
      return null;
    }
  }

  // Method 4: System Audio Device Enumeration
  async captureSystemAudioDeviceEnum() {
    if ($DebugTestMode) {
      console.log(
        "🎵 [115] METHOD 4: System audio device enumeration starting..."
      );
      console.log("🎵 [116] Enumerating all media devices...");
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();

      if ($DebugTestMode) {
        console.log("🎵 [117] Total devices enumerated:", devices.length);
        console.log("🎵 [118] Looking for system audio devices...");
      }

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

      if ($DebugTestMode) {
        console.log(
          "🎵 [119] Found " +
            systemDevices.length +
            " potential system audio devices"
        );
        systemDevices.forEach((device, index) => {
          console.log(
            "🎵 [120." + index + "] System device:",
            device.label || "No label",
            device.deviceId
          );
        });
      }

      if (systemDevices.length === 0) {
        throw new Error("No system audio devices found");
      }

      // Try each system audio device
      for (let i = 0; i < systemDevices.length; i++) {
        const device = systemDevices[i];
        try {
          if ($DebugTestMode) {
            console.log(
              "🎵 [121." +
                i +
                "] Trying device: " +
                (device.label || device.deviceId)
            );
            console.log(
              "🎵 [122." + i + "] Creating constraints for system device..."
            );
          }

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

          if ($DebugTestMode) {
            console.log(
              "🎵 [123." +
                i +
                "] System device stream obtained, testing for audio..."
            );
          }

          const hasAudio = await this.testStreamForSystemAudio(stream);

          if (hasAudio) {
            if ($DebugTestMode) {
              console.log(
                "🎵 [124." +
                  i +
                  "] ✅ Device " +
                  (device.label || device.deviceId) +
                  " successful"
              );
            }
            return stream;
          } else {
            if ($DebugTestMode) {
              console.log(
                "🎵 [125." +
                  i +
                  "] ⚠️ Device " +
                  (device.label || device.deviceId) +
                  " has no audio signal"
              );
            }
            stream.getTracks().forEach((track) => track.stop());
          }
        } catch (deviceError) {
          if ($DebugTestMode) {
            console.log(
              "🎵 [126." +
                i +
                "] ⚠️ Device " +
                (device.label || device.deviceId) +
                " failed:",
              deviceError.message
            );
          }
        }
      }

      throw new Error("No working system audio devices");
    } catch (error) {
      if ($DebugTestMode) {
        console.log("🎵 [127] ❌ Device enumeration failed:", error.message);
        console.log("🎵 [128] Device enumeration error details:", error);
      }
      return null;
    }
  }

  // Test if stream contains actual system audio
  async testStreamForSystemAudio(stream, duration = 2000) {
    if ($DebugTestMode) {
      console.log(
        "🎵 [129] Testing stream for system audio - duration:",
        duration + "ms"
      );
    }

    return new Promise((resolve) => {
      try {
        if ($DebugTestMode) {
          console.log("🎵 [130] Creating audio context for testing...");
        }

        const audioContext = new (window.AudioContext ||
          window.webkitAudioContext)();
        const analyser = audioContext.createAnalyser();
        const source = audioContext.createMediaStreamSource(stream);

        if ($DebugTestMode) {
          console.log("🎵 [131] Setting up analyser configuration...");
        }

        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.3;
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        source.connect(analyser);

        if ($DebugTestMode) {
          console.log(
            "🎵 [132] Audio analyser connected, starting audio detection..."
          );
        }

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

          if ($DebugTestMode && totalSamples % 5 === 0) {
            console.log(
              "🎵 [133." + totalSamples + "] Audio sample - avg:",
              average.toFixed(2),
              "peak:",
              peak,
              "variance:",
              variance.toFixed(2)
            );
          }

          if (totalSamples < maxChecks) {
            setTimeout(checkAudio, checkInterval);
          } else {
            if ($DebugTestMode) {
              console.log("🎵 [134] Audio testing completed, cleaning up...");
            }

            // Cleanup
            source.disconnect();
            audioContext.close();

            // Determine if this is real system audio
            const hasRealAudio =
              maxLevel > 8 && // Sufficient overall level
              significantSamples > totalSamples * 0.15; // At least 15% significant samples

            if ($DebugTestMode) {
              console.log("🎵 [135] Audio test results:");
              console.log("🎵 [136] - Max level: " + maxLevel.toFixed(2));
              console.log(
                "🎵 [137] - Significant samples: " +
                  significantSamples +
                  "/" +
                  totalSamples
              );
              console.log("🎵 [138] - Has real audio: " + hasRealAudio);
            }
            resolve(hasRealAudio);
          }
        };

        checkAudio();
      } catch (error) {
        if ($DebugTestMode) {
          console.log("🎵 [139] ❌ Audio test failed:", error);
          console.log("🎵 [140] Audio test error details:", error);
        }
        resolve(false);
      }
    });
  }

  // Get microphone stream
  async getMicrophoneStream() {
    if ($DebugTestMode) {
      console.log("🎵 [141] Getting microphone stream...");
      console.log("🎵 [142] Creating microphone constraints...");
    }

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

      if ($DebugTestMode) {
        console.log("🎵 [143] ✅ Microphone stream obtained");
        console.log("🎵 [144] Microphone tracks:", stream.getTracks().length);
      }
      return stream;
    } catch (error) {
      if ($DebugTestMode) {
        console.log("🎵 [145] ❌ Failed to get microphone:", error.message);
        console.log("🎵 [146] Microphone error details:", error);
      }
      throw error;
    }
  }

  // Create mixed stream (system + microphone)
  async createMixedStream() {
    try {
      // Close existing context first
      if (this.mixer.context && this.mixer.context.state !== "closed") {
        await this.mixer.context.close();
      }

      // Create new context with error handling
      this.mixer.context = new (window.AudioContext ||
        window.webkitAudioContext)({
        sampleRate: 16000,
        latencyHint: "interactive",
      });

      // Resume if suspended
      if (this.mixer.context.state === "suspended") {
        await this.mixer.context.resume();
      }

      this.mixer.systemSource =
        this.mixer.context.createMediaStreamSource(systemStream);
      this.mixer.micSource =
        this.mixer.context.createMediaStreamSource(micStream);
      // ... rest of mixing code
    } catch (error) {
      // Clean up on error
      if (this.mixer.context) {
        await this.mixer.context.close();
        this.mixer.context = null;
      }
      throw error;
    }
  }
  // Main capture method - tries all approaches
  async captureSystemAudio() {
    if ($DebugTestMode) {
      console.log(
        "🎵 [170] === STARTING COMPREHENSIVE SYSTEM AUDIO CAPTURE ==="
      );
    }

    if (this.isCapturing) {
      if ($DebugTestMode) {
        console.log(
          "🎵 [171] ⚠️ Capture already in progress, returning existing stream"
        );
      }
      return this.systemStream;
    }

    if ($DebugTestMode) {
      console.log("🎵 [172] Setting capture flag to true...");
    }

    this.isCapturing = true;

    if ($DebugTestMode) {
      console.log(
        "🎵 [173] Defining capture methods in order of preference..."
      );
    }

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

    if ($DebugTestMode) {
      console.log("🎵 [174] Total methods to try:", methods.length);
    }

    for (let i = 0; i < methods.length; i++) {
      const method = methods[i];
      if ($DebugTestMode) {
        console.log(
          "🎵 [175." +
            i +
            "] Trying method " +
            (i + 1) +
            "/" +
            methods.length +
            ": " +
            method.name
        );
      }

      try {
        const stream = await method.fn();

        if ($DebugTestMode) {
          console.log(
            "🎵 [176." + i + "] Method " + method.name + " completed"
          );
          console.log(
            "🎵 [177." + i + "] Stream result:",
            stream ? "✅ Success" : "❌ No stream"
          );
        }

        if (stream && stream.getAudioTracks().length > 0) {
          if ($DebugTestMode) {
            console.log("🎵 [178." + i + "] ✅ " + method.name + " succeeded!");
            console.log(
              "🎵 [179." + i + "] Audio tracks in successful stream:",
              stream.getAudioTracks().length
            );
          }
          this.systemStream = stream;
          this.currentMethod = method.name;
          this.isCapturing = false;
          return stream;
        } else {
          if ($DebugTestMode) {
            console.log(
              "🎵 [180." +
                i +
                "] Method " +
                method.name +
                " returned no usable stream"
            );
          }
        }
      } catch (error) {
        if ($DebugTestMode) {
          console.log(
            "🎵 [181." + i + "] ❌ " + method.name + " failed:",
            error.message
          );
          console.log("🎵 [182." + i + "] Method error details:", error);
        }
      }
    }

    if ($DebugTestMode) {
      console.log("🎵 [183] ❌ All system audio capture methods failed");
      console.log("🎵 [184] Resetting capture flag...");
    }
    this.isCapturing = false;
    return null;
  }

  // Get the best available audio stream
  async getBestAudioStream() {
    if ($DebugTestMode) {
      console.log("🎵 [185] Getting best available audio stream...");
      console.log("🎵 [186] Attempting to create mixed stream...");
    }

    try {
      // Try to create mixed stream (system + mic)
      const mixedStream = await this.createMixedStream();

      if (mixedStream) {
        if ($DebugTestMode) {
          console.log("🎵 [187] ✅ Best audio stream obtained");
          console.log(
            "🎵 [188] Stream type:",
            this.systemStream
              ? this.micStream
                ? "mixed"
                : "system"
              : "microphone"
          );
          console.log("🎵 [189] Method used:", this.currentMethod || "Mixed");
          console.log(
            "🎵 [190] Final stream tracks:",
            mixedStream.getTracks().length
          );
        }
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
      if ($DebugTestMode) {
        console.log(
          "🎵 [191] ❌ Failed to get best audio stream:",
          error.message
        );
        console.log("🎵 [192] Best audio stream error details:", error);
      }
      throw error;
    }
  }

  // Adjust audio mix levels
  adjustMixLevels(systemLevel = 0.6, micLevel = 1.0) {
    if ($DebugTestMode) {
      console.log("🎵 [193] Adjusting audio mix levels...");
      console.log("🎵 [194] New system level:", systemLevel);
      console.log("🎵 [195] New mic level:", micLevel);
    }

    if (this.mixer.systemGain && this.mixer.micGain) {
      this.mixer.systemGain.gain.value = systemLevel;
      this.mixer.micGain.gain.value = micLevel;
      if ($DebugTestMode) {
        console.log(
          "🎵 [196] ✅ Audio mix adjusted - System: " +
            systemLevel +
            ", Mic: " +
            micLevel
        );
      }
    } else {
      if ($DebugTestMode) {
        console.log("🎵 [197] ⚠️ Cannot adjust mix - gain nodes not available");
      }
    }
  }

  // Stop all audio capture and cleanup
  stop() {
    if ($DebugTestMode) {
      console.log("🎵 [198] Stopping enhanced audio capture...");
      console.log("🎵 [199] Resetting capture flag...");
    }

    this.isCapturing = false;

    if ($DebugTestMode) {
      console.log("🎵 [200] Stopping all audio streams...");
    }

    // Stop all streams
    [this.systemStream, this.micStream, this.finalStream].forEach(
      (stream, index) => {
        if (stream) {
          if ($DebugTestMode) {
            console.log(
              "🎵 [201." +
                index +
                "] Stopping stream " +
                index +
                " with " +
                stream.getTracks().length +
                " tracks"
            );
          }
          stream.getTracks().forEach((track, trackIndex) => {
            if ($DebugTestMode) {
              console.log(
                "🎵 [202." +
                  index +
                  "." +
                  trackIndex +
                  "] Stopping track: " +
                  track.label
              );
            }
            track.stop();
          });
        }
      }
    );

    if ($DebugTestMode) {
      console.log("🎵 [203] Cleaning up audio mixer...");
    }

    // Cleanup audio mixer
    if (this.mixer.context) {
      try {
        if ($DebugTestMode) {
          console.log("🎵 [204] Closing audio context...");
        }
        this.mixer.context.close();
      } catch (error) {
        if ($DebugTestMode) {
          console.log(
            "🎵 [205] ⚠️ Error closing audio context:",
            error.message
          );
        }
      }
    }

    if ($DebugTestMode) {
      console.log("🎵 [206] Resetting all references...");
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

    if ($DebugTestMode) {
      console.log("🎵 [207] ✅ Enhanced audio capture stopped and cleaned up");
    }
  }

  // Get status information
  getStatus() {
    if ($DebugTestMode) {
      console.log("🎵 [208] Getting audio capture status...");
    }

    const status = {
      isCapturing: this.isCapturing,
      hasSystemAudio: !!this.systemStream,
      hasMicrophone: !!this.micStream,
      hasMixed: !!this.finalStream,
      currentMethod: this.currentMethod,
      platform: this.platform,
    };

    if ($DebugTestMode) {
      console.log("🎵 [209] Status report:", status);
    }

    return status;
  }
}

// Initialize the enhanced audio capture
async function initializeEnhancedAudioCapture() {
  if ($DebugTestMode) {
    console.log("🎵 [210] Initializing Enhanced Audio Capture...");
  }

  try {
    if ($DebugTestMode) {
      console.log("🎵 [211] Creating new EnhancedAudioCapture instance...");
    }

    const audioCapture = new EnhancedAudioCapture();

    if ($DebugTestMode) {
      console.log(
        "🎵 [212] ✅ Enhanced Audio Capture initialized successfully"
      );
    }

    return audioCapture;
  } catch (error) {
    if ($DebugTestMode) {
      console.error(
        "🎵 [213] ❌ Failed to initialize Enhanced Audio Capture:",
        error
      );
    }
    return null;
  }
}

// Enhanced system audio capture using the new module
async function captureSystemAudioFixed() {
  if ($DebugTestMode) {
    console.log("🎵 [214] === ENHANCED SYSTEM AUDIO CAPTURE ===");
    console.log("🎵 [215] Checking global audio capture instance...");
  }

  if (!globalAudioCapture) {
    if ($DebugTestMode) {
      console.log("🎵 [216] No global audio capture, initializing...");
    }
    globalAudioCapture = await initializeEnhancedAudioCapture();
  }

  if (!globalAudioCapture) {
    if ($DebugTestMode) {
      console.error("🎵 [217] ❌ No audio capture available");
    }
    return null;
  }

  if ($DebugTestMode) {
    console.log("🎵 [218] Getting best audio stream from global capture...");
  }

  try {
    const result = await globalAudioCapture.getBestAudioStream();

    if ($DebugTestMode) {
      console.log("🎵 [219] getBestAudioStream completed");
      console.log("🎵 [220] Result:", result);
    }

    if (result && result.stream) {
      if ($DebugTestMode) {
        console.log("🎵 [221] ✅ Enhanced audio capture successful");
        console.log("🎵 [222] Stream type:", result.type);
        console.log("🎵 [223] Method used:", result.method);
        console.log("🎵 [224] Track count:", result.stream.getTracks().length);
      }
      return result.stream;
    } else {
      if ($DebugTestMode) {
        console.warn("🎵 [225] ⚠️ Enhanced audio capture returned no stream");
      }
      return null;
    }
  } catch (error) {
    if ($DebugTestMode) {
      console.error("🎵 [226] ❌ Enhanced audio capture failed:", error);
      console.error("🎵 [227] Error details:", error);
    }
    return null;
  }
}

// Add this function to your main-renderer.js
async function testAudioSources() {
  if ($DebugTestMode) {
    console.log("🎵 [228] 🧪 Testing audio sources...");
    console.log("🎵 [229] Creating test audio capture instance...");
  }

  const audioCapture = new EnhancedAudioCapture();

  try {
    if ($DebugTestMode) {
      console.log("🎵 [230] Testing system audio capture...");
    }

    const systemAudio = await audioCapture.captureSystemAudio();
    if ($DebugTestMode) {
      console.log(
        "🎵 [231] System audio test result:",
        systemAudio ? "✅ Available" : "❌ Not available"
      );
    }

    if ($DebugTestMode) {
      console.log("🎵 [232] Testing microphone capture...");
    }

    const micAudio = await audioCapture.getMicrophoneStream();
    if ($DebugTestMode) {
      console.log(
        "🎵 [233] Microphone test result:",
        micAudio ? "✅ Available" : "❌ Not available"
      );
    }

    if ($DebugTestMode) {
      console.log("🎵 [234] Getting final status report...");
    }

    const status = audioCapture.getStatus();
    if ($DebugTestMode) {
      console.log("🎵 [235] 📊 Final audio status:", status);
    }

    if ($DebugTestMode) {
      console.log("🎵 [236] Cleaning up test instance...");
    }

    audioCapture.stop();

    if ($DebugTestMode) {
      console.log("🎵 [237] ✅ Audio source testing completed");
    }
  } catch (error) {
    if ($DebugTestMode) {
      console.error("🎵 [238] 🧪 Audio test failed:", error);
      console.error("🎵 [239] Test error details:", error);
    }
  }
}

// Export compatibility function
if (typeof window !== "undefined") {
  if ($DebugTestMode) {
    console.log("🎵 [240] Exporting functions to window object...");
  }

  window.captureSystemAudioFixed = captureSystemAudioFixed;
  window.testAudioSources = testAudioSources;
  window.EnhancedAudioCapture = EnhancedAudioCapture;

  if ($DebugTestMode) {
    console.log(
      "🎵 [241] ✅ Enhanced Audio Capture Module loaded successfully"
    );
    console.log(
      "🎵 [242] 📝 Usage: const audioCapture = new EnhancedAudioCapture();"
    );
    console.log(
      "🎵 [243] 📝 Usage: const stream = await audioCapture.getBestAudioStream();"
    );
  }
}

// Also export as module if needed
if (typeof module !== "undefined" && module.exports) {
  if ($DebugTestMode) {
    console.log("🎵 [244] Exporting as CommonJS module...");
  }
  module.exports = { EnhancedAudioCapture, captureSystemAudioFixed };
}

if ($DebugTestMode) {
  console.log(
    "🎵 [245] 🎉 Enhanced Audio Capture Module fully loaded with extensive debugging!"
  );
}
