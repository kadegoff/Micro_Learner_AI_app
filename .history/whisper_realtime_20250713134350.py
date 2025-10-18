#!/usr/bin/env python3
"""
Real-time Whisper transcription using CTranslate2
Drop-in replacement for vosk_realtime.py
"""

import sys
import json
import struct
import io
import wave
import numpy as np
from faster_whisper import WhisperModel
import threading
import queue
import time

class WhisperRealtime:
    def __init__(self, model_size="base", device="cpu", compute_type="int8"):  # Changed to "base" for faster startup
        """Initialize Whisper model with optimized settings"""
        print("Loading Whisper model...", file=sys.stderr)
        
        # Initialize the model with optimizations
        try:
            self.model = WhisperModel(
                model_size, 
                device=device, 
                compute_type=compute_type,  # Quantized for speed
                cpu_threads=4,
                num_workers=1
            )
            print("Model loaded successfully", file=sys.stderr)
        except Exception as e:
            print(f"Error loading model: {e}", file=sys.stderr)
            raise
        
        # Audio settings to match your current setup
        self.sample_rate = 16000
        self.chunk_duration = 1.0  # Process 1-second chunks
        self.chunk_samples = int(self.sample_rate * self.chunk_duration)
        
        # Audio buffer for accumulating chunks
        self.audio_buffer = np.array([], dtype=np.float32)
        self.buffer_lock = threading.Lock()
        
        # Processing queue
        self.audio_queue = queue.Queue()
        self.is_running = True
        self.model_ready = True  # Mark as ready after successful load
        
        # Start processing thread
        self.processing_thread = threading.Thread(target=self._process_audio_loop)
        self.processing_thread.daemon = True
        self.processing_thread.start()
        
        print("WHISPER_READY", flush=True)
        print("Whisper model loaded successfully", file=sys.stderr)
    
    def _process_audio_loop(self):
        """Background thread for processing audio chunks"""
        while self.is_running:
            try:
                # Get audio chunk from queue (with timeout)
                audio_chunk = self.audio_queue.get(timeout=1.0)
                
                if audio_chunk is None:  # Shutdown signal
                    break
                
                # Process the audio chunk
                self._transcribe_chunk(audio_chunk)
                
            except queue.Empty:
                continue
            except Exception as e:
                print(f"Error in processing loop: {e}", file=sys.stderr)
    
    def _transcribe_chunk(self, audio_data):
        """Transcribe a chunk of audio data"""
        try:
            # Convert to numpy array if needed
            if isinstance(audio_data, bytes):
                audio_array = np.frombuffer(audio_data, dtype=np.int16).astype(np.float32) / 32768.0
            else:
                audio_array = audio_data
            
            # Skip very quiet audio
            if np.max(np.abs(audio_array)) < 0.01:
                return
            
            # Ensure minimum length for Whisper
            if len(audio_array) < self.sample_rate * 0.5:  # Less than 0.5 seconds
                return
            
            # Transcribe with Whisper
            segments, info = self.model.transcribe(
                audio_array,
                language="en",  # Set to None for auto-detection
                beam_size=5,
                condition_on_previous_text=False,  # Better for real-time
                vad_filter=True,  # Voice activity detection
                vad_parameters=dict(min_silence_duration_ms=500)
            )
            
            # Process segments
            for segment in segments:
                text = segment.text.strip()
                if text:
                    # Output final result
                    result = {
                        "type": "final",
                        "text": text,
                        "confidence": segment.avg_logprob,  # Whisper confidence
                        "start": segment.start,
                        "end": segment.end
                    }
                    print(json.dumps(result), flush=True)
        
        except Exception as e:
            error_result = {
                "type": "error",
                "error": str(e)
            }
            print(json.dumps(error_result), flush=True)
            print(f"Transcription error: {e}", file=sys.stderr)
    
    def add_audio_chunk(self, audio_data):
        """Add audio chunk to processing queue"""
        try:
            # Only add audio if model is ready
            if not hasattr(self, 'model_ready') or not self.model_ready:
                print("Model not ready, skipping audio chunk", file=sys.stderr)
                return
                
            # Add to queue for background processing
            if not self.audio_queue.full():
                self.audio_queue.put(audio_data, block=False)
        except queue.Full:
            print("Audio queue full, dropping chunk", file=sys.stderr)
    
    def cleanup(self):
        """Clean up resources"""
        self.is_running = False
        self.audio_queue.put(None)  # Shutdown signal
        if self.processing_thread.is_alive():
            self.processing_thread.join(timeout=2.0)

def main():
    """Main function - matches your current Vosk interface"""
    print("Starting Whisper real-time transcription", file=sys.stderr)
    
    # Initialize Whisper
    try:
        whisper = WhisperRealtime(
            model_size="base",      # Use base model for faster startup (you can change to "large-v3" later)
            device="cpu",           # Change to "cuda" if you have GPU
            compute_type="int8"     # Quantized for speed
        )
    except Exception as e:
        error_result = {
            "type": "error", 
            "error": f"Failed to initialize Whisper: {e}"
        }
        print(json.dumps(error_result), flush=True)
        return
    
    try:
        print("Waiting for audio data...", file=sys.stderr)
        
        while True:
            # Read length of incoming audio data (4 bytes)
            length_data = sys.stdin.buffer.read(4)
            if len(length_data) != 4:
                break
            
            length = struct.unpack('<I', length_data)[0]
            
            # Read the audio data
            audio_data = sys.stdin.buffer.read(length)
            if len(audio_data) != length:
                break
            
            # Add to processing queue
            whisper.add_audio_chunk(audio_data)
    
    except KeyboardInterrupt:
        print("Interrupted by user", file=sys.stderr)
    except Exception as e:
        error_result = {
            "type": "error",
            "error": str(e)
        }
        print(json.dumps(error_result), flush=True)
        print(f"Main loop error: {e}", file=sys.stderr)
    
    finally:
        whisper.cleanup()
        print("Whisper cleanup completed", file=sys.stderr)

if __name__ == "__main__":
    main()