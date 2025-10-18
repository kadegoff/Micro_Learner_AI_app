#!/usr/bin/env python3
"""
Real-time Whisper transcription using CTranslate2
Fixed version with proper ready signaling and error handling
"""

import sys
import json
import struct
import numpy as np
from faster_whisper import WhisperModel
import threading
import queue
import time

class WhisperRealtime:
    def __init__(self, model_size="large-v3", device="cpu", compute_type="int8"):
        """Initialize Whisper model with optimized settings"""
        print("Loading Whisper model...", file=sys.stderr)
        
        try:
            self.model = WhisperModel(
                model_size, 
                device=device, 
                compute_type=compute_type,
                cpu_threads=4,
                num_workers=1
            )
            print("Model loaded successfully", file=sys.stderr)
        except Exception as e:
            print(f"Error loading model: {e}", file=sys.stderr)
            # Send error to main process
            error_result = {
                "type": "error",
                "error": f"Failed to load Whisper model: {e}"
            }
            print(json.dumps(error_result), flush=True)
            raise
        
        # Audio settings
        self.sample_rate = 16000
        self.chunk_duration = 3.0
        self.min_audio_length = 1.0
        
        # Audio buffer for accumulating longer segments
        self.audio_buffer = np.array([], dtype=np.float32)
        self.buffer_lock = threading.Lock()
        self.last_process_time = time.time()
        
        # Processing queue
        self.audio_queue = queue.Queue(maxsize=10)
        self.is_running = True
        self.model_ready = True
        
        # Silence detection
        self.silence_threshold = 0.01
        self.silence_duration = 1.5
        self.last_audio_time = time.time()
        
        # Start processing thread
        self.processing_thread = threading.Thread(target=self._process_audio_loop, daemon=True)
        self.processing_thread.start()
        
        # CRITICAL: Signal that we're ready AFTER everything is initialized
        print("Whisper model loaded successfully", file=sys.stderr)
        print("WHISPER_READY", flush=True)
        print("Ready to receive audio data", file=sys.stderr)
    
    def _process_audio_loop(self):
        """Background thread for processing audio chunks"""
        print("Audio processing loop started", file=sys.stderr)
        
        while self.is_running:
            try:
                current_time = time.time()
                
                with self.buffer_lock:
                    buffer_duration = len(self.audio_buffer) / self.sample_rate
                    time_since_last_audio = current_time - self.last_audio_time
                    
                    should_process = (
                        len(self.audio_buffer) > 0 and
                        (
                            buffer_duration >= self.chunk_duration or
                            (buffer_duration >= self.min_audio_length and 
                             time_since_last_audio >= self.silence_duration)
                        )
                    )
                    
                    if should_process:
                        audio_to_process = self.audio_buffer.copy()
                        self.audio_buffer = np.array([], dtype=np.float32)
                        
                        if len(audio_to_process) > 0:
                            self._transcribe_chunk(audio_to_process)
                
                time.sleep(0.1)
                
            except Exception as e:
                print(f"Error in processing loop: {e}", file=sys.stderr)
                error_result = {
                    "type": "error",
                    "error": f"Processing loop error: {e}"
                }
                print(json.dumps(error_result), flush=True)
    
    def _transcribe_chunk(self, audio_data):
        """Transcribe a chunk of audio data"""
        try:
            # Skip very quiet audio
            if np.max(np.abs(audio_data)) < self.silence_threshold:
                return
            
            # Ensure minimum length for Whisper
            if len(audio_data) < self.sample_rate * 0.5:
                return
            
            duration = len(audio_data) / self.sample_rate
            print(f"Transcribing {duration:.1f}s of audio", file=sys.stderr)
            
            # Transcribe with Whisper - better settings for speech
            segments, info = self.model.transcribe(
                audio_data,
                language="en",
                beam_size=5,
                condition_on_previous_text=False,
                vad_filter=True,
                vad_parameters=dict(
                    min_silence_duration_ms=500,
                    threshold=0.5,
                    min_speech_duration_ms=250,
                    max_speech_duration_s=30
                ),
                word_timestamps=False,
                initial_prompt="The following is a clear speech recording."
            )
            
            # Collect all text from segments
            full_text = ""
            confidence_scores = []
            
            for segment in segments:
                text = segment.text.strip()
                if text:
                    full_text += text + " "
                    confidence_scores.append(segment.avg_logprob)
            
            full_text = full_text.strip()
            
            if full_text:
                # Calculate average confidence
                avg_confidence = np.mean(confidence_scores) if confidence_scores else -1.0
                
                # Output final result
                result = {
                    "type": "final",
                    "text": full_text,
                    "confidence": avg_confidence,
                    "start": 0.0,
                    "end": duration
                }
                print(json.dumps(result), flush=True)
                print(f"Transcribed: {full_text}", file=sys.stderr)
        
        except Exception as e:
            error_result = {
                "type": "error",
                "error": f"Transcription error: {e}"
            }
            print(json.dumps(error_result), flush=True)
            print(f"Transcription error: {e}", file=sys.stderr)
    
    def add_audio_chunk(self, audio_data):
        """Add audio chunk to processing buffer"""
        try:
            if not self.model_ready:
                print("Model not ready, skipping audio chunk", file=sys.stderr)
                return
                
            # Convert bytes to float32 audio
            if isinstance(audio_data, bytes):
                try:
                    audio_array = np.frombuffer(audio_data, dtype=np.int16).astype(np.float32) / 32768.0
                except Exception as e:
                    print(f"Error converting audio data: {e}", file=sys.stderr)
                    return
            else:
                audio_array = audio_data
            
            # Check if this chunk has audio (not silence)
            max_amplitude = np.max(np.abs(audio_array))
            
            with self.buffer_lock:
                # Always add to buffer, but track when we last heard audio
                self.audio_buffer = np.concatenate([self.audio_buffer, audio_array])
                
                # Update last audio time if we detected speech
                if max_amplitude > self.silence_threshold:
                    self.last_audio_time = time.time()
                
                # Prevent buffer from getting too large (max 10 seconds)
                max_buffer_samples = self.sample_rate * 10
                if len(self.audio_buffer) > max_buffer_samples:
                    self.audio_buffer = self.audio_buffer[-max_buffer_samples:]
                    
        except Exception as e:
            print(f"Error adding audio chunk: {e}", file=sys.stderr)
            error_result = {
                "type": "error",
                "error": f"Audio processing error: {e}"
            }
            print(json.dumps(error_result), flush=True)
    
    def cleanup(self):
        """Clean up resources"""
        print("Cleaning up Whisper resources...", file=sys.stderr)
        self.is_running = False
        if self.processing_thread.is_alive():
            self.processing_thread.join(timeout=2.0)
        print("Whisper cleanup complete", file=sys.stderr)

def main():
    """Main function with better error handling"""
    print("Starting Whisper real-time transcription", file=sys.stderr)
    
    # Initialize Whisper
    try:
        whisper = WhisperRealtime(
            model_size="large-v3",
            device="cpu",
            compute_type="int8"
        )
    except Exception as e:
        error_result = {
            "type": "error", 
            "error": f"Failed to initialize Whisper: {e}"
        }
        print(json.dumps(error_result), flush=True)
        print(f"Failed to initialize Whisper: {e}", file=sys.stderr)
        return
    
    try:
        print("Waiting for audio data...", file=sys.stderr)
        
        while True:
            try:
                # Read length of incoming audio data (4 bytes)
                length_data = sys.stdin.buffer.read(4)
                if len(length_data) != 4:
                    print("No more data to read, exiting", file=sys.stderr)
                    break
                
                length = struct.unpack('<I', length_data)[0]
                
                # Sanity check on length
                if length > 1024 * 1024:  # 1MB max
                    print(f"Received suspicious data length: {length}, skipping", file=sys.stderr)
                    continue
                
                # Read the audio data
                audio_data = sys.stdin.buffer.read(length)
                if len(audio_data) != length:
                    print(f"Expected {length} bytes, got {len(audio_data)}, exiting", file=sys.stderr)
                    break
                
                # Add to processing buffer
                whisper.add_audio_chunk(audio_data)
                
            except Exception as e:
                print(f"Error reading audio data: {e}", file=sys.stderr)
                error_result = {
                    "type": "error",
                    "error": f"Data reading error: {e}"
                }
                print(json.dumps(error_result), flush=True)
                break
    
    except KeyboardInterrupt:
        print("Interrupted by user", file=sys.stderr)
    except Exception as e:
        error_result = {
            "type": "error",
            "error": f"Main loop error: {e}"
        }
        print(json.dumps(error_result), flush=True)
        print(f"Main loop error: {e}", file=sys.stderr)
    
    finally:
        whisper.cleanup()
        print("Whisper cleanup completed", file=sys.stderr)

if __name__ == "__main__":
    main()