// enhanced-audio-capture.js
// Enhanced System Audio Capture Module for Memoria
// Usage: Include this file before main-renderer.js

if ($DebugTestMode) {
  console.log("🎵 [001] Loading Enhanced Audio Capture Module...");
}

let globalAudioCapture = null;

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
      sampleRate: 16000, // ADD THIS
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

  async safeCaptureDisplayMedia() {
    if ($DebugTestMode) {
      console.log(
        "🎵 [013] SAFE display media starting - will try multiple approaches..."
      );
    }

    // Method 1: Try with minimal video track that we'll immediately stop
    try {
      if ($DebugTestMode) {
        console.log("🎵 [014] Trying minimal video + audio approach...");
      }

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1 },
          height: { ideal: 1 },
          frameRate: { ideal: 1 },
        },
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });

      if (stream && stream.getAudioTracks().length > 0) {
        if ($DebugTestMode) {
          console.log(
            "🎵 [015] ✅ Minimal video + audio successful, stopping video track"
          );
        }
        // Stop video track immediately to save resources
        stream.getVideoTracks().forEach((track) => track.stop());
        return stream;
      }
    } catch (error) {
      if ($DebugTestMode) {
        console.log("🎵 [016] Minimal video + audio failed:", error.message);
      }
    }

    // Method 2: Try different video constraints
    try {
      if ($DebugTestMode) {
        console.log("🎵 [017] Trying alternative video constraints...");
      }

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          mediaSource: "screen",
          cursor: "never",
        },
        audio: true,
      });

      if (stream && stream.getAudioTracks().length > 0) {
        if ($DebugTestMode) {
          console.log("🎵 [018] ✅ Alternative video constraints successful");
        }
        stream.getVideoTracks().forEach((track) => track.stop());
        return stream;
      }
    } catch (error) {
      if ($DebugTestMode) {
        console.log(
          "🎵 [019] Alternative video constraints failed:",
          error.message
        );
      }
    }

    if ($DebugTestMode) {
      console.log("🎵 [020] ❌ All safe display media approaches failed");
    }

    return null;
  }

  // Method 1: Electron Desktop Capturer - FIXED VERSION
  // Method 1: Electron Desktop Capturer - COMPLETELY FIXED VERSION
  async captureWithDesktopCapturer() {
    if ($DebugTestMode) {
      console.log("🎵 [013] SAFE METHOD 1: Desktop Capturer starting...");
    }

    // Check for Electron environment
    const isElectron = !!(
      window.electronAPI ||
      window.process?.type === "renderer" ||
      navigator.userAgent.includes("Electron") ||
      window.require ||
      typeof process !== "undefined"
    );

    if (!isElectron) {
      if ($DebugTestMode) {
        console.log("🎵 [015] ⚠️ Not in Electron environment");
      }
      return null;
    }

    if ($DebugTestMode) {
      console.log("🎵 [015] ✅ Electron environment detected");
    }

    try {
      if (!window.electronAPI || !window.electronAPI.captureSystemAudio) {
        if ($DebugTestMode) {
          console.log(
            "🎵 [016] ⚠️ electronAPI.captureSystemAudio not available"
          );
        }
        return null;
      }

      if ($DebugTestMode) {
        console.log("🎵 [017] Getting desktop sources via electronAPI...");
      }

      // Get the source from electronAPI
      const result = await Promise.race([
        window.electronAPI.captureSystemAudio(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Desktop capturer timeout")), 5000)
        ),
      ]);

      if (!result || !result.success) {
        if ($DebugTestMode) {
          console.log(
            "🎵 [018] ⚠️ electronAPI returned failure:",
            result?.error
          );
        }
        return null;
      }

      if ($DebugTestMode) {
        console.log("🎵 [019] electronAPI result:", result);
      }

      // ✅ CRITICAL FIX: Use getDisplayMedia instead of getUserMedia with chromeMediaSource
      if (result.method === "native-desktop-capturer" && result.source) {
        if ($DebugTestMode) {
          console.log(
            "🎵 [020] SAFE APPROACH: Using getDisplayMedia instead of getUserMedia"
          );
          console.log("🎵 [021] This avoids the chromeMediaSource crash");
        }

        try {
          // ✅ SAFE APPROACH: Use getDisplayMedia which is more stable
          if ($DebugTestMode) {
            console.log(
              "🎵 [022] Calling getDisplayMedia with safe constraints..."
            );
          }

          const stream = await Promise.race([
            navigator.mediaDevices.getDisplayMedia({
              video: {
                mediaSource: "screen",
                width: { ideal: 1 },
                height: { ideal: 1 },
                frameRate: { ideal: 1 },
              },
              audio: {
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false,
                sampleRate: 16000,
              },
            }),
            new Promise((_, reject) =>
              setTimeout(
                () => reject(new Error("getDisplayMedia timeout")),
                5000
              )
            ),
          ]);

          if ($DebugTestMode) {
            console.log("🎵 [023] getDisplayMedia completed successfully");
          }

          // Validate stream has audio tracks
          if (stream && stream.getAudioTracks().length > 0) {
            const audioTrack = stream.getAudioTracks()[0];

            if ($DebugTestMode) {
              console.log("🎵 [024] ✅ Safe desktop capturer successful!");
              console.log("🎵 [025] Audio track label:", audioTrack.label);
              console.log(
                "🎵 [026] Total audio tracks:",
                stream.getAudioTracks().length
              );
            }

            // Stop video track to save resources
            stream.getVideoTracks().forEach((track) => track.stop());

            // Check if this looks like actual system audio, not microphone
            /*const isLikelyMicrophone =
              audioTrack.label.toLowerCase().includes("microphone") ||
              audioTrack.label.toLowerCase().includes("mic") ||
              audioTrack.label.toLowerCase().includes("input");

            if (isLikelyMicrophone) {
              if ($DebugTestMode) {
                console.log(
                  "🎵 [027] ⚠️ Rejecting - appears to be microphone:",
                  audioTrack.label
                );
              }
              stream.getTracks().forEach((track) => track.stop());
              return null;
            }*/

            // ✅ SUCCESS: Return the validated stream
            this.systemStream = stream;
            this.currentMethod = "Safe Desktop Capturer";
            return stream;
          } else {
            if ($DebugTestMode) {
              console.log("🎵 [028] ⚠️ Stream has no audio tracks");
            }
            if (stream) {
              stream.getTracks().forEach((track) => track.stop());
            }
            return null;
          }
        } catch (streamError) {
          if ($DebugTestMode) {
            console.log(
              "🎵 [029] ❌ Safe getDisplayMedia failed:",
              streamError.message
            );
            console.log("🎵 [030] Error details:", streamError);
          }
          return null;
        }
      }

      // Handle other result formats if needed
      else {
        if ($DebugTestMode) {
          console.log("🎵 [040] ❌ Unexpected result format:", result);
        }
        return null;
      }
    } catch (error) {
      if ($DebugTestMode) {
        console.log(
          "🎵 [042] ❌ Desktop capturer method failed:",
          error.message
        );
        console.log("🎵 [043] Full error:", error);
      }
      return null;
    }
  }

  async captureSystemAudioEnhanced() {
    if ($DebugTestMode) {
      console.log(
        "🎵 [025] ENHANCED system audio starting - trying ALL display media methods..."
      );
    }

    // Method 1: Try display media with video (most compatible)
    try {
      if ($DebugTestMode) {
        console.log("🎵 [026] Trying display media with video + audio...");
      }

      const streamWithVideo = await navigator.mediaDevices.getDisplayMedia({
        video: {
          mediaSource: "screen",
          width: { ideal: 1 },
          height: { ideal: 1 },
        },
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 16000,
        },
      });

      if (streamWithVideo && streamWithVideo.getAudioTracks().length > 0) {
        if ($DebugTestMode) {
          console.log("🎵 [027] ✅ Display media with video successful");
        }
        // Stop video track to save resources, keep audio
        streamWithVideo.getVideoTracks().forEach((track) => track.stop());
        return streamWithVideo;
      }
    } catch (error) {
      if ($DebugTestMode) {
        console.log("🎵 [028] Display media with video failed:", error.message);
      }
    }

    // Method 2: Try Chrome-specific constraints
    // Method 2: Try Chrome-specific constraints
    try {
      if ($DebugTestMode) {
        console.log("🎵 [029] Trying Chrome-specific display media...");
      }
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1 },
          height: { ideal: 1 },
          frameRate: { ideal: 1 },
        },
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });

      // Stop video track immediately after getting stream
      if (stream && stream.getAudioTracks().length > 0) {
        stream.getVideoTracks().forEach((track) => track.stop());
        return stream;
      }
    } catch (error) {
      if ($DebugTestMode) {
        console.log(
          "🎵 [031] Chrome-specific display media failed:",
          error.message
        );
      }
    }

    // Method 3: Try screen capture with audio
    try {
      if ($DebugTestMode) {
        console.log("🎵 [032] Trying screen capture with system audio...");
      }

      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: false,
        audio: true,
      });

      if (screenStream && screenStream.getAudioTracks().length > 0) {
        if ($DebugTestMode) {
          console.log(
            "🎵 [033] ✅ Screen capture with system audio successful"
          );
        }
        screenStream.getVideoTracks().forEach((track) => track.stop());
        return screenStream;
      }
    } catch (error) {
      if ($DebugTestMode) {
        console.log(
          "🎵 [034] Screen capture with system audio failed:",
          error.message
        );
      }
    }

    // Method 4: Try application capture
    try {
      if ($DebugTestMode) {
        console.log("🎵 [035] Trying application window capture...");
      }

      const appStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          mediaSource: "application",
          width: { ideal: 1 },
          height: { ideal: 1 },
        },
        audio: true,
      });

      if (appStream && appStream.getAudioTracks().length > 0) {
        if ($DebugTestMode) {
          console.log("🎵 [036] ✅ Application window capture successful");
        }
        appStream.getVideoTracks().forEach((track) => track.stop());
        return appStream;
      }
    } catch (error) {
      if ($DebugTestMode) {
        console.log(
          "🎵 [037] Application window capture failed:",
          error.message
        );
      }
    }

    if ($DebugTestMode) {
      console.log(
        "🎵 [038] ❌ All display media methods failed - NO FALLBACK TO MICROPHONE"
      );
    }

    // DO NOT fall back to microphone here - return null so other methods can be tried
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
    if ($DebugTestMode) {
      console.log("🎵 [044] Windows SAFE system audio capture...");
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: false,
        audio: true,
      });

      if (stream && stream.getAudioTracks().length > 0) {
        return stream;
      }
    } catch (error) {
      if ($DebugTestMode) {
        console.warn("🎵 [048] Windows safe capture failed:", error.message);
      }
    }

    return null; // Don't fallback to microphone automatically
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

    // Check if electronAPI exists and has the right methods
    if (!window.electronAPI || !window.electronAPI.captureSystemAudio) {
      if ($DebugTestMode) {
        console.log(
          "🎵 [098] ⚠️ Not running in Electron environment - window.electronAPI not found or incomplete"
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
        throw new Error(result?.error || "Electron API call failed");
      }

      // Handle direct stream return - DON'T use result.stream directly
      if (result.streamId || result.sourceId) {
        if ($DebugTestMode) {
          console.log("🎵 [102.1] ✅ Stream ID returned from Electron API");
        }
        // Use the sourceId to create getUserMedia stream instead
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            width: { ideal: 1 },
            height: { ideal: 1 },
          },
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          },
        });

        // Stop video immediately
        if (stream && stream.getAudioTracks().length > 0) {
          stream.getVideoTracks().forEach((track) => track.stop());
        }
        return stream;
      }

      // Handle multiple sources array (traditional desktop capturer response)
      if (
        result.sources &&
        Array.isArray(result.sources) &&
        result.sources.length > 0
      ) {
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
            name.includes("entire screen") ||
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
              video: {
                width: { ideal: 1 },
                height: { ideal: 1 },
                frameRate: { ideal: 1 },
              },
              audio: {
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false,
                sampleRate: 16000,
              },
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

        if ($DebugTestMode) {
          console.log("🎵 [112.5] All sources from array failed");
        }
      }

      // Handle single source return (your current preload.js format)
      else if (result.source && result.source.id) {
        if ($DebugTestMode) {
          console.log(
            `🎵 [102.2] Single source returned:`,
            result.source?.name || result.source?.id || "Unknown"
          );
        }

        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: 1 },
              height: { ideal: 1 },
              frameRate: { ideal: 1 },
            },
            audio: {
              echoCancellation: false,
              noiseSuppression: false,
              autoGainControl: false,
              sampleRate: 16000,
            },
          });

          if ($DebugTestMode) {
            console.log("🎵 [102.3] Single source stream obtained, testing...");
          }

          const hasAudio = await this.testStreamForSystemAudio(stream);

          if (hasAudio) {
            if ($DebugTestMode) {
              console.log("🎵 [102.4] ✅ Single source successful");
            }
            return stream;
          } else {
            if ($DebugTestMode) {
              console.log("🎵 [102.5] ⚠️ Single source has no audio signal");
            }
            stream.getTracks().forEach((track) => track.stop());
          }
        } catch (singleSourceError) {
          if ($DebugTestMode) {
            console.log(
              "🎵 [102.6] ⚠️ Single source failed:",
              singleSourceError.message
            );
          }
        }
      }

      // If we get here, no sources worked
      throw new Error("No working audio sources found from Electron API");
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

          if (average > 0.5 || peak > 5) {
            // ✅ Much more sensitive
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

            const hasRealAudio =
              maxLevel > 0.5 || // Your max level was 0.80, so this will work
              significantSamples > 2; // You had 3 samples, so lower threshold

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

  // FIXED: Create mixed stream WITHOUT echo/feedback
  async createMixedStream() {
    if ($DebugTestMode) {
      console.log("🎵 Creating ECHO-FREE mixed stream...");
    }

    try {
      // Get system audio and microphone
      if ($DebugTestMode) {
        console.log("🎵 Attempting to capture system audio...");
      }

      let systemStream = await this.captureSystemAudio();
      if ($DebugTestMode) {
        console.log(
          "🎵 System audio result:",
          systemStream ? "✅ Available" : "❌ Not available"
        );
      }

      if ($DebugTestMode) {
        console.log("🎵 [150] Attempting to capture microphone...");
      }

      let micStream = null;
      try {
        micStream = await this.getMicrophoneStream();
        if ($DebugTestMode) {
          console.log(
            "🎵 Microphone result:",
            micStream ? "✅ Available" : "❌ Not available"
          );
        }
      } catch (micError) {
        if ($DebugTestMode) {
          console.log("🎵 ⚠️ Microphone capture failed:", micError.message);
        }
      }

      // If we have both streams, create a mixed stream
      if (systemStream && micStream) {
        if ($DebugTestMode) {
          console.log(
            "🎵 Both streams available, creating SILENT mixed audio..."
          );
        }

        try {
          // Clean up existing context
          if (this.mixer.context && this.mixer.context.state !== "closed") {
            try {
              await this.mixer.context.close();
            } catch (e) {
              console.warn("Error closing existing context:", e);
            }
          }

          // Create new AudioContext
          this.mixer.context = new (window.AudioContext ||
            window.webkitAudioContext)({
            sampleRate: 16000,
            latencyHint: "interactive",
          });

          // Resume if suspended
          if (this.mixer.context.state === "suspended") {
            await this.mixer.context.resume();
          }

          // Create audio sources
          this.mixer.systemSource =
            this.mixer.context.createMediaStreamSource(systemStream);
          this.mixer.micSource =
            this.mixer.context.createMediaStreamSource(micStream);

          if ($DebugTestMode) {
            console.log("🎵 Creating gain nodes...");
          }

          // Create gain nodes for volume control
          this.mixer.systemGain = this.mixer.context.createGain();
          this.mixer.micGain = this.mixer.context.createGain();

          // Set volume levels
          this.mixer.systemGain.gain.value = 0.6; // System audio
          this.mixer.micGain.gain.value = 1.0; // Microphone

          if ($DebugTestMode) {
            console.log(
              "🎵 Creating MediaStreamDestination (SILENT - no speakers)..."
            );
          }

          // ✅ CRITICAL: MediaStreamDestination does NOT output to speakers
          this.mixer.destination =
            this.mixer.context.createMediaStreamDestination();

          if ($DebugTestMode) {
            console.log(
              "🎵 Connecting SILENT audio graph (no echo possible)..."
            );
          }

          // ✅ ECHO-FREE: Connect to MediaStreamDestination ONLY (never to speakers)
          this.mixer.systemSource.connect(this.mixer.systemGain);
          this.mixer.micSource.connect(this.mixer.micGain);
          this.mixer.systemGain.connect(this.mixer.destination);
          this.mixer.micGain.connect(this.mixer.destination);
          // Store streams
          this.systemStream = systemStream;
          this.micStream = micStream;
          this.finalStream = this.mixer.destination.stream;

          // Track resources for cleanup
          this.trackStream(systemStream);
          this.trackStream(micStream);
          this.trackStream(this.finalStream);
          this.trackContext(this.mixer.context);

          if ($DebugTestMode) {
            console.log(
              "🎵 ✅ ECHO-FREE mixed audio stream created successfully"
            );
            console.log(
              "🎵 Final stream tracks:",
              this.finalStream.getTracks().length
            );
            console.log(
              "🎵 🔇 NO AUDIO OUTPUT TO SPEAKERS - only for processing"
            );
          }

          return this.finalStream; // Return the mixed stream for Vosk
        } catch (mixError) {
          if ($DebugTestMode) {
            console.log(
              "🎵 ❌ Mixed stream creation failed:",
              mixError.message
            );
          }
          // Clean up on error
          if (this.mixer.context) {
            await this.mixer.context.close();
            this.mixer.context = null;
          }
          throw mixError;
        }
      }

      // If we only have system audio, use that
      else if (systemStream) {
        if ($DebugTestMode) {
          console.log(
            "🎵 Only system audio available, using system stream (SILENT)"
          );
        }
        this.systemStream = systemStream;
        this.finalStream = systemStream;
        this.trackStream(systemStream);
        return systemStream;
      }

      // If we only have microphone, use that
      else if (micStream) {
        if ($DebugTestMode) {
          console.log("🎵 Only microphone available, using microphone stream");
        }
        this.micStream = micStream;
        this.finalStream = micStream;
        this.trackStream(micStream);
        return micStream;
      }

      // If we have neither, throw an error
      else {
        throw new Error(
          "No audio sources available - neither system audio nor microphone could be captured"
        );
      }
    } catch (error) {
      if ($DebugTestMode) {
        console.log("🎵 ❌ createMixedStream failed:", error.message);
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

    this.isCapturing = true;

    // Define capture methods in order of preference
    const methods = [
      {
        name: "Desktop Capturer",
        fn: () => this.captureWithDesktopCapturer(),
      },
      {
        name: "Enhanced Display Media",
        fn: () => this.captureSystemAudioEnhanced(),
      },
      {
        name: "Platform-Specific Audio",
        fn: () => this.captureSystemAudioPlatformSpecific(),
      },
      {
        name: "Electron Desktop Capturer (Legacy)",
        fn: () => this.captureSystemAudioElectron(),
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
          `🎵 [175.${i}] Trying method ${i + 1}/${methods.length}: ${
            method.name
          }`
        );
      }

      try {
        const stream = await method.fn();

        if ($DebugTestMode) {
          console.log(`🎵 [176.${i}] Method ${method.name} completed`);
          console.log(
            `🎵 [177.${i}] Stream result:`,
            stream ? "✅ Success" : "❌ No stream"
          );
        }

        if (stream && stream.getAudioTracks().length > 0) {
          const tracks = stream.getAudioTracks();
          const track = tracks[0];

          if ($DebugTestMode) {
            console.log(`🎵 [178.${i}] ✅ ${method.name} succeeded!`);
            console.log(`🎵 [179.${i}] Audio track label: ${track.label}`);
            console.log(`🎵 [180.${i}] STOPPING HERE - SUCCESS ACHIEVED`);
          }

          /*const isLikelyMicrophone =
            track.label.toLowerCase().includes("microphone") &&
            !track.label.toLowerCase().includes("stereo mix") &&
            !track.label.toLowerCase().includes("system") &&
            !track.label.toLowerCase().includes("loopback") &&
            !track.label.toLowerCase().includes("default") && // Allow "Default - Microphone" for system audio
            maxLevel < 1.0; // Only reject if also very low signal

          if (isLikelyMicrophone) {
            if ($DebugTestMode) {
              console.log(
                `🎵 [181.${i}] ⚠️ Rejecting ${method.name} - appears to be microphone: ${track.label}`
              );
            }
            stream.getTracks().forEach((track) => track.stop());
            continue; // Try next method
          }*/

          // ✅ SUCCESS: Set values and RETURN immediately
          this.systemStream = stream;
          this.currentMethod = method.name;
          this.isCapturing = false;

          if ($DebugTestMode) {
            console.log(
              `🎵 [182.${i}] 🎉 CAPTURE COMPLETE - RETURNING SUCCESSFUL STREAM`
            );
          }

          return stream; // ✅ STOP HERE - Don't try more methods!
        } else {
          if ($DebugTestMode) {
            console.log(
              `🎵 [183.${i}] Method ${method.name} returned no usable stream`
            );
          }
        }
      } catch (error) {
        if ($DebugTestMode) {
          console.log(`🎵 [184.${i}] ❌ ${method.name} failed:`, error.message);
        }
      }
    }

    // Only reach here if ALL methods failed
    if ($DebugTestMode) {
      console.log("🎵 [185] ❌ All system audio capture methods failed");
    }
    this.isCapturing = false;
    return null;
  }

  // Get the best available audio stream - FIXED VERSION
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
          method: this.currentMethod || "Audio Mixing",
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
  async stop() {
    if (this.destroyed) return;
    this.isCapturing = false;
    this.destroyed = true;

    try {
      // Stop all streams
      [this.systemStream, this.micStream, this.finalStream].forEach(
        (stream) => {
          if (stream) {
            stream.getTracks().forEach((track) => track.stop());
          }
        }
      );

      // Close audio context
      if (this.mixer.context && this.mixer.context.state !== "closed") {
        await this.mixer.context.close();
      }
      this.systemStream = null;
      this.micStream = null;
      this.finalStream = null;
    } catch (error) {
      console.error("Stop error:", error);
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
