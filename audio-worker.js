// audio-worker.js - Web Worker for audio processing
self.onmessage = function (e) {
  const { audioData } = e.data;

  try {
    // Convert Float32Array to Int16Array
    const int16Array = new Int16Array(audioData.length);
    for (let i = 0; i < audioData.length; i++) {
      const s = Math.max(-1, Math.min(1, audioData[i]));
      int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }

    // Send back the converted buffer
    self.postMessage(
      {
        success: true,
        int16Array: int16Array.buffer,
      },
      [int16Array.buffer]
    ); // Transfer ownership for performance
  } catch (error) {
    self.postMessage({
      success: false,
      error: error.message,
    });
  }
};
