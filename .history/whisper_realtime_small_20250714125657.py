#!/usr/bin/env python3
"""
Real-time Whisper transcription using the SMALL model
Optimized for SPEED and real-time performance!
"""

import sys
import json
import struct
import numpy as np
from faster_whisper import WhisperModel
import threading
import queue
import time
import os
import gc
import signal
import re

def safe_print(message, file=sys.stdout):
    """Safely print messages"""
    try:
        if message is not None:
            if isinstance(message, dict):
                clean_message = {k: v for k, v in message.items() if v is not None}
                print(json.dumps(clean_message), file=file, flush=True)
            else:
                print(str(message), file=file, flush=True)
    except Exception as e:
        try:
            print(f"Error printing message: {e}", file=sys.stderr, flush=True)
        except:
            pass

def safe_print_error(message):
    """Safely print error messages"""
    safe_print(message, file=sys.stderr)

class WhisperRealtimeSmall:
    def __init__(self, model_size="small", device="cpu", compute_type="int8"):
        """Initialize with SMALL model for SPEED"""
        
        # Initialize all instance variables
        self.model = None
        self.sample_rate = 16000
        
        # 🚀 OPTIMIZED FOR SMALL MODEL - MUCH FASTER!
        self.chunk_duration = 0.5    # 🚀 SUPER FAST: 0.5s chunks
        self.min_audio_length = 0.2  # 🚀 LIGHTNING: 0.2s minimum
        self.silence_duration = 0.3  # 🚀 RAPID: 0.3s silence detection
        
        self.audio_buffer = np.array([], dtype=np.float32)
        self.buffer_lock = threading.Lock()
        self.last_process_time = time.time()
        self.audio_queue = queue.Queue(maxsize=3)  # 🚀 TINY queue for speed
        self.is_running = True
        self.model_ready = False
        self.silence_threshold = 0.003  # 🚀 More sensitive for faster detection
        self.last_audio_time = time.time()
        self.processing_thread = None
        self.startup_complete = False
        
        # Sentence tracking for complete results
        self.sentence_id = int(time.time() * 1000)
        
        # 🚀 SMALL MODEL SPEED SETTINGS - MAXIMUM PERFORMANCE
        self.transcribe_settings = {
            "language": "en",
            "beam_size": 1,              # 🚀 FASTEST: Single beam
            "best_of": 1,                # 🚀 FASTEST: Single candidate
            "temperature": 0.0,          # 🚀 FASTEST: No temperature sampling
            "condition_on_previous_text": False,  # 🚀 FASTER: No context
            "vad_filter": False,         # 🚀 FASTER: No VAD overhead
            "word_timestamps": False,    # 🚀 FASTER: No word timing
            "compression_ratio_threshold": 2.4,
            "log_prob_threshold": -1.0,
            "no_speech_threshold": 0.8,  # 🚀 Higher for speed
            "vad_parameters": dict(
                min_silence_duration_ms=300,  # 🚀 FAST silence detection
                threshold=0.5,
                min_speech_duration_ms=200,   # 🚀 FAST speech detection
                max_speech_duration_s=15      # 🚀 Shorter max duration
            ),
            "initial_prompt": None
        }
        
        safe_print_error("🚀 Starting SMALL Model Whisper - OPTIMIZED FOR SPEED!")
        safe_print_error(f"🏃‍♂️ Target model: {model_size} (SMALL = FAST MODE)")
        
        # Setup signal handlers
        signal.signal(signal.SIGTERM, self._signal_handler)
        signal.signal(signal.SIGINT, self._signal_handler)
        
        # Load the model
        self._load_model(model_size, device, compute_type)
        
        # Start processing thread
        self._start_processing_thread()
        
        # Signal ready
        self._signal_ready()
    
    def _signal_handler(self, signum, frame):
        """Handle shutdown signals gracefully"""
        safe_print_error(f"Received signal {signum}, shutting down...")
        self.cleanup()
        sys.exit(0)
    
    def _load_model(self, model_size, device, compute_type):
        """Load the SMALL Whisper model for maximum speed"""
        try:
            safe_print_error(f"🏃‍♂️ Loading SMALL model: {model_size}")
            
            start_time = time.time()
            
            # Create model instance with speed optimizations
            self.model = WhisperModel(
                model_size,
                device=device,
                compute_type=compute_type,
                cpu_threads=2,  # 🚀 FASTER: Fewer threads for small model
                num_workers=1,
                download_root=None,
                local_files_only=True
            )
            
            load_time = time.time() - start_time
            safe_print_error(f"⚡ SMALL model loaded in {load_time:.1f} seconds")
            
            # Quick test
            safe_print_error("🧪 Testing SMALL model speed...")
            test_audio = np.random.normal(0, 0.01, 8000).astype(np.float32)  # 🚀 Smaller test
            
            segments, info = self.model.transcribe(
                test_audio,
                beam_size=1,
                word_timestamps=False  # 🚀 No timestamps for speed
            )
            
            list(segments)  # Consume results
            safe_print_error("⚡ SMALL model test completed - READY FOR SPEED!")
            
            self.model_ready = True
            safe_print_error("🎉 SMALL MODEL WHISPER READY - MAXIMUM SPEED MODE!")
            
        except Exception as e:
            error_message = f"Failed to load SMALL model: {str(e)}"
            safe_print_error(f"❌ {error_message}")
            raise
    
    def _start_processing_thread(self):
        """Start the FAST audio processing thread"""
        try:
            self.processing_thread = threading.Thread(
                target=self._process_audio_loop,
                daemon=True,
                name="SmallModelSpeedProcessor"
            )
            self.processing_thread.start()
            safe_print_error("⚡ SMALL model SPEED processing thread started")
        except Exception as e:
            safe_print_error(f"❌ Failed to start processing thread: {e}")
            raise
    
    def _signal_ready(self):
        """Signal that SMALL Whisper is ready"""
        safe_print_error("🎉 SMALL MODEL INITIALIZATION COMPLETE")
        
        # Send ready signal multiple times for reliability
        for i in range(3):
            safe_print("WHISPER_READY")
            time.sleep(0.02)  # 🚀 Even shorter delay
        
        safe_print_error("🚀 READY FOR LIGHTNING-FAST TRANSCRIPTION!")
        self.startup_complete = True
    
    def _process_audio_loop(self):
        """🚀 LIGHTNING-FAST processing loop optimized for SMALL model"""
        safe_print_error("🔄 SMALL model SPEED processing loop started")
        consecutive_errors = 0
        max_consecutive_errors = 3
        last_process_time = time.time()
        
        while self.is_running:
            try:
                current_time = time.time()
                
                with self.buffer_lock:
                    if len(self.audio_buffer) == 0:
                        time.sleep(0.005)   # 🚀 ULTRA-SHORT sleep for speed
                        continue
                    
                    buffer_duration = len(self.audio_buffer) / self.sample_rate
                    time_since_last_audio = current_time - self.last_audio_time
                    time_since_last_process = current_time - last_process_time
                    
                    # 🚀 SUPER AGGRESSIVE processing for SMALL model
                    should_process = (
                        buffer_duration >= self.chunk_duration or
                        (buffer_duration >= self.min_audio_length and 
                         time_since_last_audio >= self.silence_duration) or
                        (buffer_duration >= 0.3 and time_since_last_process >= 0.8) or  # 🚀 Force every 0.8s
                        (buffer_duration >= 0.6)  # 🚀 Never let buffer get too big
                    )
                    
                    if should_process:
                        audio_to_process = self.audio_buffer.copy()
                        self.audio_buffer = np.array([], dtype=np.float32)  # 🚀 Clear everything
                        last_process_time = current_time
                        
                        if len(audio_to_process) > 0:
                            self._transcribe_chunk_complete(audio_to_process)
                            consecutive_errors = 0
                
                time.sleep(0.005)  # 🚀 ULTRA-SHORT sleep
                
            except Exception as e:
                consecutive_errors += 1
                safe_print_error(f"Processing loop error #{consecutive_errors}: {e}")
                
                if consecutive_errors >= max_consecutive_errors:
                    safe_print_error("Too many consecutive errors, stopping")
                    break
                
                time.sleep(0.05)  # 🚀 Quick error recovery
        
        safe_print_error("🔄 SMALL model processing loop ended")
    
    def _transcribe_chunk_complete(self, audio_data):
        """🚀 LIGHTNING transcription with SMALL model"""
        try:
            if audio_data is None or len(audio_data) == 0:
                return
            
            if not self.model_ready:
                return
            
            # Quick audio validation
            max_amplitude = np.max(np.abs(audio_data))
            if max_amplitude < self.silence_threshold:
                return
            
            # 🚀 SMALLER minimum chunk for faster response
            min_samples = int(self.sample_rate * 0.3)  # 300ms minimum
            if len(audio_data) < min_samples:
                return
            
            start_time = time.time()
            
            # 🚀 TRANSCRIBE with SMALL model SPEED settings
            segments, info = self.model.transcribe(
                audio_data,
                **self.transcribe_settings
            )
            
            # Process segments into complete sentences
            full_text = ""
            word_data = []
            
            for segment in segments:
                if hasattr(segment, 'text') and segment.text:
                    segment_text = segment.text.strip()
                    if segment_text:
                        full_text += segment_text + " "
            
            full_text = full_text.strip()
            
            if full_text:
                # Create complete sentence result
                result = {
                    "type": "complete_sentence",
                    "text": full_text,
                    "sentence_id": str(self.sentence_id),
                    "words": word_data,
                    "word_count": len(full_text.split()),
                    "confidence": 0.9,  # 🚀 Fixed confidence for speed
                    "model": "small",
                    "quality": "fast_accuracy",
                    "language": info.language if hasattr(info, 'language') else 'en',
                    "language_probability": getattr(info, 'language_probability', 0.9)
                }
                
                safe_print(result)
                
                # Increment sentence ID for next
                self.sentence_id = int(time.time() * 1000)
                
                transcribe_time = time.time() - start_time
                safe_print_error(f"⚡ SMALL: '{full_text}' ({transcribe_time:.2f}s)")
        
        except Exception as e:
            safe_print_error(f"❌ SMALL model transcription error: {e}")
            error_result = {
                "type": "error",
                "error": f"SMALL model transcription error: {str(e)}"
            }
            safe_print(error_result)
    
    def add_audio_chunk(self, audio_data):
        """🚀 SPEED-optimized audio chunk processing"""
        try:
            if not self.model_ready or not self.startup_complete:
                return
            
            if audio_data is None:
                return
            
            # Convert bytes to float32
            if isinstance(audio_data, bytes):
                try:
                    if len(audio_data) % 2 != 0:
                        audio_data = audio_data[:-1]
                    audio_array = np.frombuffer(audio_data, dtype=np.int16).astype(np.float32) / 32768.0
                except Exception:
                    return
            else:
                audio_array = audio_data
            
            if audio_array is None or len(audio_array) == 0:
                return
            
            if not np.isfinite(audio_array).all():
                return
            
            max_amplitude = np.max(np.abs(audio_array))
            
            with self.buffer_lock:
                self.audio_buffer = np.concatenate([self.audio_buffer, audio_array])
                
                if max_amplitude > self.silence_threshold:
                    self.last_audio_time = time.time()
                
                # 🚀 MUCH smaller buffer for SMALL model - SPEED!
                max_buffer_samples = self.sample_rate * 2  # 🚀 Only 2 seconds max!
                if len(self.audio_buffer) > max_buffer_samples:
                    # 🚀 Keep only most recent audio for speed
                    self.audio_buffer = self.audio_buffer[-max_buffer_samples//2:]
        
        except Exception as e:
            safe_print_error(f"❌ Error adding audio chunk: {e}")
    
    def cleanup(self):
        """Clean up SMALL model resources"""
        safe_print_error("🧹 Cleaning up SMALL model Whisper resources...")
        self.is_running = False
        
        if self.processing_thread and self.processing_thread.is_alive():
            self.processing_thread.join(timeout=1.0)  # 🚀 Faster timeout
        
        with self.buffer_lock:
            self.audio_buffer = np.array([], dtype=np.float32)
        
        self.model = None
        gc.collect()
        safe_print_error("⚡ SMALL model cleanup complete")

def main():
    """Main function for SMALL model Whisper - MAXIMUM SPEED"""
    safe_print_error("🚀 SMALL Model Whisper Real-time Transcription - SPEED MODE!")
    
    whisper = None
    try:
        # Initialize SMALL model processor
        whisper = WhisperRealtimeSmall(model_size="small")
        
        safe_print_error("🎧 Ready for LIGHTNING-FAST audio input")
        
        while True:
            try:
                # Read length
                length_data = sys.stdin.buffer.read(4)
                if len(length_data) != 4:
                    safe_print_error("📡 End of input stream")
                    break
                
                length = struct.unpack('<I', length_data)[0]
                
                # 🚀 Smaller max for faster processing
                if length == 0 or length > 256 * 1024:  # 🚀 256KB max for speed
                    continue
                
                # Read audio data
                audio_data = sys.stdin.buffer.read(length)
                if len(audio_data) != length:
                    continue
                
                # Process with SMALL model for SPEED
                if whisper and whisper.startup_complete:
                    whisper.add_audio_chunk(audio_data)
            
            except Exception as e:
                safe_print_error(f"❌ Error reading audio: {e}")
                break
    
    except KeyboardInterrupt:
        safe_print_error("⏹️ Interrupted by user")
    except Exception as e:
        error_result = {"type": "error", "error": f"SMALL model main error: {str(e)}"}
        safe_print(error_result)
        safe_print_error(f"❌ SMALL model Whisper fatal error: {e}")
    
    finally:
        if whisper:
            whisper.cleanup()
        safe_print_error("🏁 SMALL Model Whisper ended")
    
    return 0

if __name__ == "__main__":
    sys.exit(main())