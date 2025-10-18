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

  // FIXED: Proper device filtering with correct priority
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

        // Log ALL audio input devices for debugging
        devices
          .filter((d) => d.kind === "audioinput")
          .forEach((device, i) => {
            console.log(
              `🎵 Device ${i}: "${device.label}" | ID: ${device.deviceId}`
            );
          });
      }

      // ✅ ENHANCED: Better system audio device detection
      const systemDevices = devices.filter((device) => {
        if (device.kind !== "audioinput") return false;

        const label = device.label.toLowerCase();
        const deviceId = device.deviceId.toLowerCase();

        // ✅ HIGHEST PRIORITY: Stereo Mix (perfect for system audio)
        const isStereoMix =
          label.includes("stereo mix") || label.includes("wave out mix");

        // ✅ HIGH PRIORITY: Other known system audio devices
        const isSystemAudio =
          label.includes("loopback") ||
          label.includes("monitor") ||
          label.includes("soundflower") ||
          label.includes("blackhole") ||
          label.includes("system audio") ||
          label.includes("virtual audio") ||
          deviceId.includes("system") ||
          deviceId.includes("loopback");

        // ✅ MEDIUM PRIORITY: Default devices (might work)
        const isDefaultDevice =
          label.includes("default") && !label.includes("microphone"); // Exclude "Default Microphone"

        // ❌ EXCLUDE: Pure microphone devices
        const isPureMicrophone =
          label.includes("microphone") &&
          !label.includes("stereo mix") &&
          !label.includes("system") &&
          !label.includes("monitor") &&
          !label.includes("default") &&
          !label.includes("loopback");

        if (isPureMicrophone) {
          if ($DebugTestMode) {
            console.log(`🎵 Excluding pure microphone: ${device.label}`);
          }
          return false;
        }

        return isStereoMix || isSystemAudio || isDefaultDevice;
      });

      // ✅ SMART SORTING: Stereo Mix first, then others
      systemDevices.sort((a, b) => {
        const aLabel = a.label.toLowerCase();
        const bLabel = b.label.toLowerCase();

        // Stereo Mix gets absolute highest priority
        if (aLabel.includes("stereo mix")) return -1;
        if (bLabel.includes("stereo mix")) return 1;

        // Wave out mix second
        if (aLabel.includes("wave out mix")) return -1;
        if (bLabel.includes("wave out mix")) return 1;

        // Other system audio devices third
        const aIsSystemAudio =
          aLabel.includes("loopback") ||
          aLabel.includes("monitor") ||
          aLabel.includes("system");
        const bIsSystemAudio =
          bLabel.includes("loopback") ||
          bLabel.includes("monitor") ||
          bLabel.includes("system");

        if (aIsSystemAudio && !bIsSystemAudio) return -1;
        if (bIsSystemAudio && !aIsSystemAudio) return 1;

        return 0;
      });

      if ($DebugTestMode) {
        console.log(
          `🎵 [119] Found ${systemDevices.length} potential system audio devices (prioritized):`
        );
        systemDevices.forEach((device, index) => {
          console.log(
            `🎵 [120.${index}] System device: ${device.label || "No label"} | ${
              device.deviceId
            }`
          );
        });
      }

      if (systemDevices.length === 0) {
        throw new Error("No system audio devices found");
      }

      // Try each system audio device in priority order
      for (let i = 0; i < systemDevices.length; i++) {
        const device = systemDevices[i];
        try {
          if ($DebugTestMode) {
            console.log(
              `🎵 [121.${i}] Trying device: ${device.label || device.deviceId}`
            );
            console.log(
              `🎵 [122.${i}] Creating constraints for system device...`
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
              `🎵 [123.${i}] System device stream obtained, testing for audio...`
            );
          }

          // ✅ CRITICAL: Use the fixed test function
          const hasAudio = await this.testStreamForSystemAudio(stream, 1500);

          if (hasAudio) {
            if ($DebugTestMode) {
              console.log(
                `✅ Found working system audio device: ${device.label}`
              );
            }
            return stream;
          } else {
            if ($DebugTestMode) {
              console.log(
                `🎵 [125.${i}] Device ${device.label} rejected by audio test, trying next...`
              );
            }
            // Stop stream and try next device
            stream.getTracks().forEach((track) => track.stop());
          }
        } catch (deviceError) {
          if ($DebugTestMode) {
            console.log(
              `🎵 [126.${i}] ⚠️ Device ${
                device.label || device.deviceId
              } failed:`,
              deviceError.message
            );
          }
        }
      }

      throw new Error("No working system audio devices with signal");
    } catch (error) {
      if ($DebugTestMode) {
        console.log("🎵 [127] ❌ Device enumeration failed:", error.message);
        console.log("🎵 [128] Device enumeration error details:", error);
      }
      return null;
    }
  }

  // FIXED: Proper system audio testing function
  async testStreamForSystemAudio(stream, duration = 1500) {
    if ($DebugTestMode) {
      console.log("🎵 Testing stream for ACTUAL AUDIO SIGNAL...");
    }

    try {
      if (
        !stream ||
        !stream.getAudioTracks ||
        stream.getAudioTracks().length === 0
      ) {
        if ($DebugTestMode) {
          console.log("🎵 ❌ Stream has no audio tracks");
        }
        return false;
      }

      const audioTrack = stream.getAudioTracks()[0];

      // First check if track is active
      if (audioTrack.readyState !== "live" || audioTrack.muted) {
        if ($DebugTestMode) {
          console.log("🎵 ❌ Audio track not live or is muted");
          console.log("🎵 Track state:", audioTrack.readyState);
          console.log("🎵 Track muted:", audioTrack.muted);
        }
        return false;
      }

      if ($DebugTestMode) {
        console.log("🎵 Track is live, now testing for actual audio signal...");
        console.log("🎵 Track label:", audioTrack.label);
      }

      // ✅ CRITICAL FIX: Smart detection for Stereo Mix and system audio devices
      const trackLabel = audioTrack.label.toLowerCase();
      const isKnownSystemAudio =
        trackLabel.includes("stereo mix") ||
        trackLabel.includes("wave out mix") ||
        trackLabel.includes("loopback") ||
        trackLabel.includes("monitor") ||
        trackLabel.includes("soundflower") ||
        trackLabel.includes("blackhole") ||
        trackLabel.includes("system audio") ||
        trackLabel.includes("virtual audio") ||
        (trackLabel.includes("default") && trackLabel.includes("stereo mix"));

      // ✅ FOR KNOWN SYSTEM AUDIO DEVICES: Accept them even if silent at startup
      if (isKnownSystemAudio) {
        if ($DebugTestMode) {
          console.log(
            "🎵 ✅ ACCEPTING known system audio device without signal test:",
            audioTrack.label
          );
          console.log(
            "🎵 ✅ This is correct - system audio can be silent at startup!"
          );
        }
        return true; // Accept Stereo Mix even if no audio is playing
      }

      // ✅ FOR OTHER DEVICES: Test for actual audio signal
      const audioContext = new (window.AudioContext ||
        window.webkitAudioContext)({
        sampleRate: 16000,
      });
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);

      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.3;
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      return new Promise((resolve) => {
        let maxLevel = 0;
        let samples = 0;
        const sampleInterval = 50; // Check every 50ms
        const maxSamples = Math.floor(duration / sampleInterval);

        if ($DebugTestMode) {
          console.log(
            `🎵 Testing non-system device for ${duration}ms (${maxSamples} samples)...`
          );
        }

        const testInterval = setInterval(() => {
          analyser.getByteFrequencyData(dataArray);

          // Calculate average amplitude
          const average =
            dataArray.reduce((sum, value) => sum + value, 0) / bufferLength;
          maxLevel = Math.max(maxLevel, average);
          samples++;

          if ($DebugTestMode && samples % 5 === 0) {
            console.log(
              `🎵 Sample ${samples}/${maxSamples}: ${average.toFixed(
                2
              )} (max: ${maxLevel.toFixed(2)})`
            );
          }

          if (samples >= maxSamples) {
            clearInterval(testInterval);

            // Cleanup
            source.disconnect();
            audioContext.close();

            // ✅ LOWERED THRESHOLD: Be more sensitive
            const threshold = 1.0; // Lowered threshold
            const hasSignal = maxLevel > threshold;

            if ($DebugTestMode) {
              console.log(`🎵 Audio test complete:`);
              console.log(`🎵 - Max level: ${maxLevel.toFixed(2)}`);
              console.log(`🎵 - Threshold: ${threshold}`);
              console.log(`🎵 - Has signal: ${hasSignal ? "✅ YES" : "❌ NO"}`);
              console.log(`🎵 - Track label: ${audioTrack.label}`);
            }

            // ✅ REJECT only obvious microphone-only devices with very low signal
            const isProbablyMicrophone =
              trackLabel.includes("microphone") &&
              !trackLabel.includes("stereo mix") &&
              !trackLabel.includes("system") &&
              !trackLabel.includes("monitor") &&
              !trackLabel.includes("loopback") &&
              !trackLabel.includes("default") &&
              maxLevel < 5.0; // Very low signal

            if (isProbablyMicrophone) {
              if ($DebugTestMode) {
                console.log(
                  `🎵 ❌ Rejecting: Appears to be microphone-only device with low signal`
                );
              }
              resolve(false);
              return;
            }

            resolve(hasSignal);
          }
        }, sampleInterval);
      });
    } catch (error) {
      if ($DebugTestMode) {
        console.log("🎵 ❌ Stream audio test failed:", error.message);
      }
      return false;
    }
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
  // FIXED: Create mixed stream WITH BOTH audio sources
  async createMixedStream() {
    if ($DebugTestMode) {
      console.log(
        "🎵 Creating REAL mixed stream with BOTH system + microphone..."
      );
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
        console.log("🎵 Attempting to capture microphone...");
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

      // ✅ FIXED: Prefer microphone when both available
      if (systemStream && micStream) {
        console.log("🎵 ✅ MIXING BOTH: System audio + Microphone!");

        // Create audio context for mixing
        const audioContext = new (window.AudioContext ||
          window.webkitAudioContext)({
          sampleRate: 16000,
        });

        const systemSource = audioContext.createMediaStreamSource(systemStream);
        const micSource = audioContext.createMediaStreamSource(micStream);
        const systemGain = audioContext.createGain();
        const micGain = audioContext.createGain();

        // ✅ FIXED: Give microphone higher priority
        systemGain.gain.value = 0.2; // System audio at 20%
        micGain.gain.value = 1.0; // Microphone at 100%

        const destination = audioContext.createMediaStreamDestination();

        systemSource.connect(systemGain);
        micSource.connect(micGain);
        systemGain.connect(destination);
        micGain.connect(destination);

        // Store references for cleanup
        this.mixer.context = audioContext;
        this.mixer.systemSource = systemSource;
        this.mixer.micSource = micSource;
        this.mixer.systemGain = systemGain;
        this.mixer.micGain = micGain;
        this.mixer.destination = destination;

        this.systemStream = systemStream;
        this.micStream = micStream;
        this.finalStream = destination.stream;

        return destination.stream;
      }

      // ✅ FIXED: Prefer microphone over system audio
      else if (micStream) {
        console.log("🎵 ✅ Using microphone only (preferred)");
        this.finalStream = micStream;
        return micStream;
      } else if (systemStream) {
        console.log("🎵 ⚠️ Using system audio only (fallback)");
        this.finalStream = systemStream;
        return systemStream;
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

    // ✅ PRIORITIZE: Device enumeration (Stereo Mix) first since it's most reliable
    const methods = [
      {
        name: "Device Enumeration (Stereo Mix)", // ✅ NOW FIRST!
        fn: () => this.captureSystemAudioDeviceEnum(),
      },
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
  // Stop all audio capture and cleanup
  async stop() {
    if (this.destroyed) return;
    this.isCapturing = false;
    this.destroyed = true;

    try {
      // ✅ NEW: Clean up mixer components
      if (this.mixer.systemSource) {
        this.mixer.systemSource.disconnect();
        this.mixer.systemSource = null;
      }
      if (this.mixer.micSource) {
        this.mixer.micSource.disconnect();
        this.mixer.micSource = null;
      }
      if (this.mixer.systemGain) {
        this.mixer.systemGain.disconnect();
        this.mixer.systemGain = null;
      }
      if (this.mixer.micGain) {
        this.mixer.micGain.disconnect();
        this.mixer.micGain = null;
      }
      if (this.mixer.destination) {
        this.mixer.destination.disconnect();
        this.mixer.destination = null;
      }

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
      this.mixer.context = null;

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

// Simple microphone stream monitor - tests every 100ms
function startMicMonitor(stream, onMicLost = null) {
  if (!stream) {
    console.log("🎤 ❌ No stream provided to mic monitor");
    return null;
  }

  console.log("🎤 Starting microphone monitor...");

  let monitorInterval = setInterval(() => {
    // Check if stream still exists and has active audio tracks
    if (
      !stream ||
      !stream.getAudioTracks ||
      stream.getAudioTracks().length === 0
    ) {
      console.log("🎤 ⚠️ Mic monitor: Stream lost - no audio tracks");
      clearInterval(monitorInterval);
      if (onMicLost) onMicLost("no_tracks");
      return;
    }

    // Check if the first audio track is still live
    const audioTrack = stream.getAudioTracks()[0];
    if (audioTrack.readyState !== "live") {
      console.log(
        "🎤 ⚠️ Mic monitor: Audio track not live -",
        audioTrack.readyState
      );
      clearInterval(monitorInterval);
      if (onMicLost) onMicLost("track_ended");
      return;
    }

    // Log that mic is still good every 10 seconds
    if (!startMicMonitor.checkCount) startMicMonitor.checkCount = 0;
    startMicMonitor.checkCount++;

    if (startMicMonitor.checkCount % 100 === 0) {
      console.log(
        "🎤 ✅ Mic monitor: Microphone still active (" +
          startMicMonitor.checkCount +
          " checks)"
      );
      console.log("🎤 Track label:", audioTrack.label);
      console.log("🎤 Track state:", audioTrack.readyState);
      console.log("🎤 Track muted:", audioTrack.muted);
    }
  }, 100); // Every 100ms

  return monitorInterval;
}

// Simple audio stream monitor - tests every 100ms
function startStreamMonitor(stream, onStreamLost = null) {
  if (!stream) return null;

  let monitorInterval = setInterval(() => {
    // Check if stream still exists and has active audio tracks
    if (
      !stream ||
      !stream.getAudioTracks ||
      stream.getAudioTracks().length === 0
    ) {
      if ($DebugTestMode) {
        console.log("🎵 ⚠️ Stream monitor: Stream lost - no audio tracks");
      }

      clearInterval(monitorInterval);
      if (onStreamLost) onStreamLost("no_tracks");
      return;
    }

    // Check if the first audio track is still live
    const audioTrack = stream.getAudioTracks()[0];
    if (audioTrack.readyState !== "live") {
      if ($DebugTestMode) {
        console.log(
          "🎵 ⚠️ Stream monitor: Audio track not live -",
          audioTrack.readyState
        );
      }

      clearInterval(monitorInterval);
      if (onStreamLost) onStreamLost("track_ended");
      return;
    }

    // Log that stream is still good every 10 seconds to avoid spam
    if ($DebugTestMode) {
      // Only log every 100 checks (10 seconds at 100ms intervals)
      if (!startStreamMonitor.checkCount) startStreamMonitor.checkCount = 0;
      startStreamMonitor.checkCount++;

      if (startStreamMonitor.checkCount % 100 === 0) {
        console.log(
          "🎵 ✅ Stream monitor: Stream still active (" +
            startStreamMonitor.checkCount +
            " checks)"
        );
      }
    }
  }, 100); // Every 100ms

  // Return the interval ID so it can be cleared manually if needed
  return monitorInterval;
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

      // ✅ ADD STREAM MONITOR HERE
      const monitorId = startStreamMonitor(result.stream, (reason) => {
        if ($DebugTestMode) {
          console.log("🎵 ❌ Stream lost:", reason);
        }
      });

      if ($DebugTestMode) {
        console.log("🎵 ✅ Stream monitor started with ID:", monitorId);
      }

      // ✅ ADD MIC MONITOR RIGHT HERE - Check if this is a microphone stream
      if (result.type === "microphone" || result.type === "mixed") {
        const micMonitorId = startMicMonitor(result.stream, (reason) => {
          if ($DebugTestMode) {
            console.log("🎤 ❌ Microphone lost:", reason);
          }
          // Optional: You could trigger a re-capture attempt here
          // globalAudioCapture = null; // Reset to force re-initialization
        });

        if ($DebugTestMode) {
          console.log(
            "🎤 ✅ Microphone monitor started with ID:",
            micMonitorId
          );
        }
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
// Test function to verify computer audio capture
window.testComputerAudio = async function () {
  console.log("🧪 === COMPUTER AUDIO TEST ===");
  console.log(
    "📢 IMPORTANT: Play some music/video NOW, then watch the results..."
  );

  try {
    // Get current audio stream
    const stream = window.currentAudioStream;

    if (!stream) {
      console.log("❌ No active audio stream. Start listening first!");
      return false;
    }

    const audioTrack = stream.getAudioTracks()[0];
    console.log("🎵 Testing audio track:", audioTrack.label);

    // Create audio analysis
    const audioContext = new AudioContext({ sampleRate: 16000 });
    const analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(stream);

    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.3;
    source.connect(analyser);

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    let sampleCount = 0;
    let maxLevel = 0;
    let totalLevel = 0;

    console.log("🎵 Analyzing audio for 10 seconds...");
    console.log("🔊 Make sure computer audio is playing!");

    return new Promise((resolve) => {
      const testInterval = setInterval(() => {
        analyser.getByteFrequencyData(dataArray);

        const average =
          dataArray.reduce((sum, value) => sum + value, 0) / bufferLength;
        maxLevel = Math.max(maxLevel, average);
        totalLevel += average;
        sampleCount++;

        // Real-time feedback
        const bars = "█".repeat(Math.floor(average / 5));
        console.log(
          `Sample ${sampleCount.toString().padStart(2)}: ${average
            .toFixed(1)
            .padStart(5)} ${bars}`
        );

        if (sampleCount >= 20) {
          // 10 seconds at 500ms intervals
          clearInterval(testInterval);

          // Cleanup
          source.disconnect();
          audioContext.close();

          const avgLevel = totalLevel / sampleCount;

          console.log("\n🎵 === TEST RESULTS ===");
          console.log(`📊 Max level: ${maxLevel.toFixed(2)}`);
          console.log(`📊 Average level: ${avgLevel.toFixed(2)}`);
          console.log(`🎤 Track: ${audioTrack.label}`);

          // Analysis
          if (maxLevel > 20) {
            console.log(
              "✅ COMPUTER AUDIO IS WORKING! Strong signal detected."
            );
            resolve(true);
          } else if (maxLevel > 5) {
            console.log(
              "⚠️ Weak audio signal. Computer audio might be working but quiet."
            );
            console.log(
              "💡 Try increasing system volume or playing louder content."
            );
            resolve(true);
          } else {
            console.log("❌ NO COMPUTER AUDIO DETECTED!");
            console.log(
              "🔧 This suggests you're only capturing microphone, not computer audio."
            );
            console.log("💡 Solutions:");
            console.log("   - Enable 'Stereo Mix' in Windows sound settings");
            console.log("   - Try a different audio capture method");
            console.log("   - Check if computer audio is actually playing");
            resolve(false);
          }
        }
      }, 500); // Sample every 500ms
    });
  } catch (error) {
    console.error("❌ Test failed:", error);
    return false;
  }
};
