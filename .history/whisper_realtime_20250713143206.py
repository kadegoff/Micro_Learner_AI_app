#!/usr/bin/env python3
"""
Real-time Whisper transcription with improved error handling
"""

import sys
import json
import struct
import numpy as np
from faster_whisper import WhisperModel
import threading
import queue
import time

def safe_print(message, file=sys.stdout):
    """Safely print messages with null checks"""
    try:
        if message is not None:
            if isinstance(message, dict):
                # Ensure all values in dict are not None
                clean_message = {k: v for k, v in message.items() if v is not None}
                print(json.dumps(clean_message), file=file, flush=True)
            else:
                print(str(message), file=file, flush=True)
    except Exception as e:
        print(f"Error printing message: {e}", file=sys.stderr, flush=True)

def safe_print_error(message):
    """Safely print error messages"""
    safe_print(message, file=sys.stderr)

class WhisperRealtime:
    def __init__(self, model_size="large-v3", device="cpu", compute_type="int8"):
        """Initialize Whisper model with enhanced error handling"""
        safe_print_error("Loading Whisper model...")
        
        try:
            self.model = WhisperModel(
                model_size, 
                device=device, 
                compute_type=compute_type,
                cpu_threads=4,
                num_workers=1
            )
            safe_print_error("Model loaded successfully")
        except Exception as e:
            safe_print_error(f"Error loading model: {e}")
            # Send error to main process safely
            error_result = {
                "type": "error",
                "error": f"Failed to load Whisper model: {str(e)}"
            }
            safe_print(error_result)
            raise
        
        # Initialize all instance variables
        self.sample_rate = 16000
        self.chunk_duration = 3.0
        self.min_audio_length = 1.0
        self.audio_buffer = np.array([], dtype=np.float32)
        self.buffer_lock = threading.Lock()
        self.last_process_time = time.time()
        self.audio_queue = queue.Queue(maxsize=10)
        self.is_running = True
        self.model_ready = True
        self.silence_threshold = 0.01
        self.silence_duration = 1.5
        self.last_audio_time = time.time()
        
        # Start processing thread with error handling
        try:
            self.processing_thread = threading.Thread(target=self._process_audio_loop, daemon=True)
            self.processing_thread.start()
            safe_print_error("Audio processing thread started")
        except Exception as e:
            safe_print_error(f"Failed to start processing thread: {e}")
            raise
        
        # Signal ready state safely
        safe_print_error("Whisper model loaded successfully")
        safe_print("WHISPER_READY")
        safe_print_error("Ready to receive audio data")
    
    def _process_audio_loop(self):
        """Background thread for processing audio chunks with error handling"""
        safe_print_error("Audio processing loop started")
        
        while self.is_running:
            try:
                current_time = time.time()
                
                with self.buffer_lock:
                    if len(self.audio_buffer) == 0:
                        time.sleep(0.1)
                        continue
                        
                    buffer_duration = len(self.audio_buffer) / self.sample_rate
                    time_since_last_audio = current_time - self.last_audio_time
                    
                    should_process = (
                        buffer_duration >= self.chunk_duration or
                        (buffer_duration >= self.min_audio_length and 
                         time_since_last_audio >= self.silence_duration)
                    )
                    
                    if should_process:
                        audio_to_process = self.audio_buffer.copy()
                        self.audio_buffer = np.array([], dtype=np.float32)
                        
                        if len(audio_to_process) > 0:
                            self._transcribe_chunk(audio_to_process)
                
                time.sleep(0.1)
                
            except Exception as e:
                safe_print_error(f"Error in processing loop: {e}")
                error_result = {
                    "type": "error",
                    "error": f"Processing loop error: {str(e)}"
                }
                safe_print(error_result)
                # Don't break the loop, just continue
                time.sleep(1)
    
    def _transcribe_chunk(self, audio_data):
        """Transcribe a chunk of audio data with enhanced error handling"""
        try:
            # Validate input
            if audio_data is None or len(audio_data) == 0:
                return
                
            # Skip very quiet audio
            if np.max(np.abs(audio_data)) < self.silence_threshold:
                return
            
            # Ensure minimum length for Whisper
            if len(audio_data) < self.sample_rate * 0.5:
                return
            
            duration = len(audio_data) / self.sample_rate
            safe_print_error(f"Transcribing {duration:.1f}s of audio")
            
            # Transcribe with Whisper
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
                if segment and hasattr(segment, 'text') and segment.text:
                    text = segment.text.strip()
                    if text:
                        full_text += text + " "
                        if hasattr(segment, 'avg_logprob'):
                            confidence_scores.append(segment.avg_logprob)
            
            full_text = full_text.strip()
            
            if full_text:
                # Calculate average confidence safely
                avg_confidence = (np.mean(confidence_scores) 
                                if confidence_scores else -1.0)
                
                # Create result with all non-null values
                result = {
                    "type": "final",
                    "text": full_text,
                    "confidence": float(avg_confidence),
                    "start": 0.0,
                    "end": float(duration)
                }
                safe_print(result)
                safe_print_error(f"Transcribed: {full_text}")
        
        except Exception as e:
            safe_print_error(f"Transcription error: {e}")
            error_result = {
                "type": "error",
                "error": f"Transcription error: {str(e)}"
            }
            safe_print(error_result)
    
    def add_audio_chunk(self, audio_data):
        """Add audio chunk to processing buffer with validation"""
        try:
            if not self.model_ready:
                safe_print_error("Model not ready, skipping audio chunk")
                return
                
            if audio_data is None:
                safe_print_error("Received null audio data")
                return
                
            # Convert bytes to float32 audio
            if isinstance(audio_data, bytes):
                try:
                    audio_array = np.frombuffer(audio_data, dtype=np.int16).astype(np.float32) / 32768.0
                except Exception as e:
                    safe_print_error(f"Error converting audio data: {e}")
                    return
            else:
                audio_array = audio_data
            
            if audio_array is None or len(audio_array) == 0:
                return
            
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
            safe_print_error(f"Error adding audio chunk: {e}")
            error_result = {
                "type": "error",
                "error": f"Audio processing error: {str(e)}"
            }
            safe_print(error_result)
    
    def cleanup(self):
        """Clean up resources safely"""
        safe_print_error("Cleaning up Whisper resources...")
        self.is_running = False
        if hasattr(self, 'processing_thread') and self.processing_thread.is_alive():
            self.processing_thread.join(timeout=2.0)
        safe_print_error("Whisper cleanup complete")

def main():
    """Main function with comprehensive error handling"""
    safe_print_error("Starting Whisper real-time transcription")
    
    # Initialize Whisper
    whisper = None
    try:
        whisper = WhisperRealtime(
            model_size="large-v3",
            device="cpu",
            compute_type="int8"
        )
    except Exception as e:
        error_result = {
            "type": "error", 
            "error": f"Failed to initialize Whisper: {str(e)}"
        }
        safe_print(error_result)
        safe_print_error(f"Failed to initialize Whisper: {e}")
        return
    
    try:
        safe_print_error("Waiting for audio data...")
        
        while True:
            try:
                # Read length of incoming audio data (4 bytes)
                length_data = sys.stdin.buffer.read(4)
                if len(length_data) != 4:
                    safe_print_error("No more data to read, exiting")
                    break
                
                length = struct.unpack('<I', length_data)[0]
                
                # Sanity check on length
                if length > 1024 * 1024:  # 1MB max
                    safe_print_error(f"Received suspicious data length: {length}, skipping")
                    continue
                
                # Read the audio data
                audio_data = sys.stdin.buffer.read(length)
                if len(audio_data) != length:
                    safe_print_error(f"Expected {length} bytes, got {len(audio_data)}, exiting")
                    break
                
                # Add to processing buffer
                if whisper:
                    whisper.add_audio_chunk(audio_data)
                
            except Exception as e:
                safe_print_error(f"Error reading audio data: {e}")
                error_result = {
                    "type": "error",
                    "error": f"Data reading error: {str(e)}"
                }
                safe_print(error_result)
                break
    
    except KeyboardInterrupt:
        safe_print_error("Interrupted by user")
    except Exception as e:
        error_result = {
            "type": "error",
            "error": f"Main loop error: {str(e)}"
        }
        safe_print(error_result)
        safe_print_error(f"Main loop error: {e}")
    
    finally:
        if whisper:
            whisper.cleanup()
        safe_print_error("Whisper cleanup completed")

if __name__ == "__main__":
    main()