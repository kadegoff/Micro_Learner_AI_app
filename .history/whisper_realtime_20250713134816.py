#!/usr/bin/env python3
"""
Real-time Whisper transcription using CTranslate2
Optimized for better speech segmentation and quality
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
        
        # Initialize the model with optimizations
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
            raise
        
        # Audio settings
        self.sample_rate = 16000
        self.chunk_duration = 3.0  # Process 3-second chunks for better quality
        self.min_audio_length = 1.0  # Minimum 1 second before processing
        
        # Audio buffer for accumulating longer segments
        self.audio_buffer = np.array([], dtype=np.float32)
        self.buffer_lock = threading.Lock()
        self.last_process_time = time.time()
        
        # Processing queue
        self.audio_queue = queue.Queue(maxsize=10)  # Limit queue size
        self.is_running = True
        self.model_ready = True
        
        # Silence detection
        self.silence_threshold = 0.01  # Threshold for silence
        self.silence_duration = 1.5    # Wait 1.5s of silence before processing
        self.last_audio_time = time.time()
        
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
                # Check if we should process accumulated audio
                current_time = time.time()
                
                with self.buffer_lock:
                    buffer_duration = len(self.audio_buffer) / self.sample_rate
                    time_since_last_audio = current_time - self.last_audio_time
                    
                    # Process if we have enough audio and there's been silence
                    should_process = (
                        len(self.audio_buffer) > 0 and
                        (
                            buffer_duration >= self.chunk_duration or  # Buffer is full
                            (buffer_duration >= self.min_audio_length and 
                             time_since_last_audio >= self.silence_duration)  # Silence detected
                        )
                    )
                    
                    if should_process:
                        # Take audio to process
                        audio_to_process = self.audio_buffer.copy()
                        self.audio_buffer = np.array([], dtype=np.float32)
                        
                        # Process in background
                        if len(audio_to_process) > 0:
                            self._transcribe_chunk(audio_to_process)
                
                # Small delay to prevent busy loop
                time.sleep(0.1)
                
            except Exception as e:
                print(f"Error in processing loop: {e}", file=sys.stderr)
    
    def _transcribe_chunk(self, audio_data):
        """Transcribe a chunk of audio data"""
        try:
            # Skip very quiet audio
            if np.max(np.abs(audio_data)) < self.silence_threshold:
                return
            
            # Ensure minimum length for Whisper
            if len(audio_data) < self.sample_rate * 0.5:  # Less than 0.5 seconds
                return
            
            print(f"Transcribing {len(audio_data)/self.sample_rate:.1f}s of audio", file=sys.stderr)
            
            # Transcribe with Whisper - better settings for speech
            segments, info = self.model.transcribe(
                audio_data,
                language="en",
                beam_size=5,
                condition_on_previous_text=False,  # Better for real-time
                vad_filter=True,  # Voice activity detection
                vad_parameters=dict(
                    min_silence_duration_ms=500,  # Less aggressive silence detection
                    threshold=0.5,  # Threshold for voice detection
                    min_speech_duration_ms=250,  # Minimum speech duration
                    max_speech_duration_s=30  # Max speech duration
                ),
                word_timestamps=False,  # Disable word-level timestamps for speed
                initial_prompt="The following is a clear speech recording."  # Help with context
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
                    "end": len(audio_data) / self.sample_rate
                }
                print(json.dumps(result), flush=True)
                print(f"Transcribed: {full_text}", file=sys.stderr)
        
        except Exception as e:
            error_result = {
                "type": "error",
                "error": str(e)
            }
            print(json.dumps(error_result), flush=True)
            print(f"Transcription error: {e}", file=sys.stderr)
    
    def add_audio_chunk(self, audio_data):
        """Add audio chunk to processing buffer"""
        try:
            if not self.model_ready:
                return
                
            # Convert bytes to float32 audio
            if isinstance(audio_data, bytes):
                audio_array = np.frombuffer(audio_data, dtype=np.int16).astype(np.float32) / 32768.0
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
                    # Keep only the most recent audio
                    self.audio_buffer = self.audio_buffer[-max_buffer_samples:]
                    
        except Exception as e:
            print(f"Error adding audio chunk: {e}", file=sys.stderr)
    
    def cleanup(self):
        """Clean up resources"""
        self.is_running = False
        if self.processing_thread.is_alive():
            self.processing_thread.join(timeout=2.0)

def main():
    """Main function - matches your current interface"""
    print("Starting Whisper real-time transcription", file=sys.stderr)
    
    # Initialize Whisper
    try:
        whisper = WhisperRealtime(
            model_size="large-v3",  # Back to large model for quality
            device="cpu",
            compute_type="int8"
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
            
            # Add to processing buffer
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