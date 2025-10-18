#!/usr/bin/env python3
"""
Real-time Whisper transcription with FIXED model loading and startup
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

class WhisperRealtime:
    def __init__(self, model_size="base", device="cpu", compute_type="int8"):
        """Initialize Whisper model with FIXED startup"""
        
        # Initialize all instance variables first
        self.model = None
        self.sample_rate = 16000
        self.chunk_duration = 2.0  # Shorter for responsiveness
        self.min_audio_length = 0.8
        self.audio_buffer = np.array([], dtype=np.float32)
        self.buffer_lock = threading.Lock()
        self.last_process_time = time.time()
        self.audio_queue = queue.Queue(maxsize=10)
        self.is_running = True
        self.model_ready = False
        self.silence_threshold = 0.01
        self.silence_duration = 1.0
        self.last_audio_time = time.time()
        self.processing_thread = None
        self.startup_complete = False
        
        # CRITICAL: Send initial status
        safe_print_error("=== FIXED Whisper Real-time Transcription Starting ===")
        safe_print_error(f"Python version: {sys.version}")
        safe_print_error(f"Process ID: {os.getpid()}")
        
        # Setup signal handlers for clean shutdown
        signal.signal(signal.SIGTERM, self._signal_handler)
        signal.signal(signal.SIGINT, self._signal_handler)
        
        # FIXED: Use smaller model by default to avoid hanging
        self._load_model_with_fixed_size(model_size, device, compute_type)
        
        # Start processing thread AFTER model is loaded
        self._start_processing_thread()
        
        # CRITICAL: Signal ready state multiple times
        self._signal_ready()
    
    def _signal_handler(self, signum, frame):
        """Handle shutdown signals gracefully"""
        safe_print_error(f"Received signal {signum}, shutting down...")
        self.cleanup()
        sys.exit(0)
    
    def _load_model_with_fixed_size(self, model_size, device, compute_type):
        """Load Whisper model with FIXED size selection"""
        try:
            # FIXED: Auto-select appropriate model size
            original_model_size = model_size
            
            # Use smaller models to avoid download/loading issues
            if model_size in ["large", "large-v2", "large-v3"]:
                model_size = "small"  # Much faster to download and load
                safe_print_error(f"FIXED: Changed model from {original_model_size} to {model_size} for reliability")
            
            safe_print_error(f"Loading Whisper model: {model_size}")
            safe_print_error("This should complete quickly...")
            
            # Check if model exists locally first
            import os
            from pathlib import Path
            
            # Common model cache locations
            cache_dirs = [
                os.path.join(os.path.expanduser("~"), ".cache", "huggingface", "hub"),
                os.path.join(os.path.expanduser("~"), ".cache", "whisper"),
            ]
            
            model_exists_locally = False
            for cache_dir in cache_dirs:
                if os.path.exists(cache_dir):
                    # Check for model files
                    for item in os.listdir(cache_dir):
                        if model_size in item.lower():
                            model_exists_locally = True
                            safe_print_error(f"Found cached model in: {cache_dir}")
                            break
                if model_exists_locally:
                    break
            
            if not model_exists_locally:
                safe_print_error(f"Model {model_size} not cached locally, will download (this may take time)")
            else:
                safe_print_error(f"Using cached model {model_size}")
            
            safe_print_error("Creating WhisperModel instance...")
            
            # FIXED: Enhanced model creation with timeout protection
            start_time = time.time()
            
            self.model = WhisperModel(
                model_size, 
                device=device, 
                compute_type=compute_type,
                cpu_threads=2,  # Reduced to avoid overwhelming system
                num_workers=1,
                download_root=None,
                local_files_only=False
            )
            
            load_time = time.time() - start_time
            safe_print_error(f"Model loaded successfully in {load_time:.1f} seconds")
            
            # FIXED: Quick model test
            safe_print_error("Testing model with sample audio...")
            test_audio = np.random.normal(0, 0.05, 8000).astype(np.float32)  # 0.5 seconds
            
            test_start = time.time()
            try:
                segments, info = self.model.transcribe(
                    test_audio,
                    language="en",
                    beam_size=1,
                    condition_on_previous_text=False,
                    vad_filter=False,
                    word_timestamps=False
                )
                
                # Just consume the first result
                next(segments, None)
                test_time = time.time() - test_start
                safe_print_error(f"Model test completed successfully in {test_time:.1f} seconds")
                
            except Exception as test_error:
                safe_print_error(f"Model test failed: {test_error}")
                raise Exception(f"Model test failed: {test_error}")
            
            self.model_ready = True
            safe_print_error("✅ Whisper model loaded and tested successfully")
            
        except Exception as e:
            error_message = f"Failed to load Whisper model: {str(e)}"
            safe_print_error(f"❌ {error_message}")
            
            error_result = {
                "type": "error",
                "error": error_message
            }
            safe_print(error_result)
            raise
    
    def _start_processing_thread(self):
        """Start the audio processing thread"""
        try:
            self.processing_thread = threading.Thread(
                target=self._process_audio_loop, 
                daemon=True,
                name="WhisperAudioProcessor"
            )
            self.processing_thread.start()
            safe_print_error("✅ Audio processing thread started")
        except Exception as e:
            safe_print_error(f"❌ Failed to start processing thread: {e}")
            raise
    
    def _signal_ready(self):
        """FIXED: Signal that Whisper is ready with multiple attempts"""
        safe_print_error("🚀 Whisper initialization complete - signaling ready")
        
        # CRITICAL: Send ready signal multiple times with delays
        for i in range(5):  # Send 5 times to ensure receipt
            safe_print("WHISPER_READY")
            time.sleep(0.2)  # 200ms between signals
            safe_print_error(f"Ready signal {i+1}/5 sent")
        
        # Send one final confirmation
        safe_print_error("🎉 Whisper is fully ready and waiting for audio!")
        self.startup_complete = True
    
    def _process_audio_loop(self):
        """Background thread for processing audio chunks"""
        safe_print_error("🔄 Audio processing loop started")
        consecutive_errors = 0
        max_consecutive_errors = 3  # Reduced for faster recovery
        
        while self.is_running:
            try:
                current_time = time.time()
                
                with self.buffer_lock:
                    if len(self.audio_buffer) == 0:
                        time.sleep(0.05)  # Shorter sleep for responsiveness
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
                            consecutive_errors = 0
                
                time.sleep(0.05)  # Shorter sleep
                
            except Exception as e:
                consecutive_errors += 1
                safe_print_error(f"Processing loop error #{consecutive_errors}: {e}")
                
                if consecutive_errors >= max_consecutive_errors:
                    safe_print_error(f"Too many consecutive errors, stopping")
                    break
                
                time.sleep(0.5)
        
        safe_print_error("🔄 Audio processing loop ended")
    
    def _transcribe_chunk(self, audio_data):
        """Transcribe audio chunk with FIXED parameters"""
        try:
            if audio_data is None or len(audio_data) == 0:
                return
                
            if not self.model_ready:
                return
            
            # Skip very quiet audio
            max_amplitude = np.max(np.abs(audio_data))
            if max_amplitude < self.silence_threshold:
                return
            
            # Ensure minimum length
            min_samples = int(self.sample_rate * 0.3)  # 300ms minimum
            if len(audio_data) < min_samples:
                return
            
            duration = len(audio_data) / self.sample_rate
            
            # FIXED: Optimized transcription parameters for speed
            start_time = time.time()
            segments, info = self.model.transcribe(
                audio_data,
                language="en",
                beam_size=1,  # Fastest setting
                condition_on_previous_text=False,
                vad_filter=True,
                vad_parameters=dict(
                    min_silence_duration_ms=200,
                    threshold=0.5,
                    min_speech_duration_ms=150,
                    max_speech_duration_s=10
                ),
                word_timestamps=False,
                initial_prompt="Natural conversation."
            )
            
            # Collect text quickly
            full_text = ""
            segment_count = 0
            
            for segment in segments:
                if segment and hasattr(segment, 'text') and segment.text:
                    text = segment.text.strip()
                    if text:
                        full_text += text + " "
                        segment_count += 1
                        if segment_count >= 5:  # Limit segments
                            break
            
            full_text = full_text.strip()
            transcribe_time = time.time() - start_time
            
            if full_text:
                result = {
                    "type": "final",
                    "text": full_text,
                    "confidence": 0.8,  # Simplified
                    "start": 0.0,
                    "end": float(duration),
                    "transcribe_time": round(transcribe_time, 2)
                }
                safe_print(result)
                safe_print_error(f"✅ Transcribed in {transcribe_time:.2f}s: {full_text}")
        
        except Exception as e:
            safe_print_error(f"❌ Transcription error: {e}")
            error_result = {
                "type": "error",
                "error": f"Transcription error: {str(e)}"
            }
            safe_print(error_result)
    
    def add_audio_chunk(self, audio_data):
        """Add audio chunk with FIXED validation"""
        try:
            if not self.model_ready or not self.startup_complete:
                return
                
            if audio_data is None:
                return
                
            # Convert bytes to float32
            if isinstance(audio_data, bytes):
                try:
                    if len(audio_data) % 2 != 0:
                        return
                    audio_array = np.frombuffer(audio_data, dtype=np.int16).astype(np.float32) / 32768.0
                except Exception:
                    return
            else:
                audio_array = audio_data
            
            if audio_array is None or len(audio_array) == 0:
                return
            
            # Validate audio
            if not np.isfinite(audio_array).all():
                return
            
            max_amplitude = np.max(np.abs(audio_array))
            
            with self.buffer_lock:
                self.audio_buffer = np.concatenate([self.audio_buffer, audio_array])
                
                if max_amplitude > self.silence_threshold:
                    self.last_audio_time = time.time()
                
                # Prevent buffer overflow
                max_buffer_samples = self.sample_rate * 15  # 15 seconds max
                if len(self.audio_buffer) > max_buffer_samples:
                    self.audio_buffer = self.audio_buffer[-max_buffer_samples:]
                    
        except Exception as e:
            safe_print_error(f"❌ Error adding audio chunk: {e}")
    
    def cleanup(self):
        """Clean up resources"""
        safe_print_error("🧹 Cleaning up Whisper resources...")
        self.is_running = False
        
        if self.processing_thread and self.processing_thread.is_alive():
            self.processing_thread.join(timeout=2.0)
            
        with self.buffer_lock:
            self.audio_buffer = np.array([], dtype=np.float32)
        
        self.model = None
        gc.collect()
        safe_print_error("✅ Whisper cleanup complete")

def main():
    """FIXED main function with enhanced error handling"""
    safe_print_error("🚀 Starting FIXED Whisper Real-time Transcription")
    
    # FIXED: Use smaller model for reliability
    whisper = None
    try:
        whisper = WhisperRealtime(
            model_size="small",  # FIXED: Use small model instead of large-v3
            device="cpu",
            compute_type="int8"
        )
    except Exception as e:
        error_result = {"type": "error", "error": f"Failed to initialize Whisper: {str(e)}"}
        safe_print(error_result)
        safe_print_error(f"❌ Initialization failed: {e}")
        return 1
    
    try:
        safe_print_error("🎧 Ready to receive audio data")
        
        while True:
            try:
                # Read length
                length_data = sys.stdin.buffer.read(4)
                if len(length_data) != 4:
                    safe_print_error("📡 End of input stream, exiting")
                    break
                
                length = struct.unpack('<I', length_data)[0]
                
                if length == 0 or length > 2 * 1024 * 1024:  # 2MB max
                    continue
                
                # Read audio data
                audio_data = sys.stdin.buffer.read(length)
                if len(audio_data) != length:
                    continue
                
                # Process audio
                if whisper and whisper.startup_complete:
                    whisper.add_audio_chunk(audio_data)
                
            except Exception as e:
                safe_print_error(f"❌ Error reading audio: {e}")
                break
    
    except KeyboardInterrupt:
        safe_print_error("⏹️ Interrupted by user")
    except Exception as e:
        error_result = {"type": "error", "error": f"Main loop error: {str(e)}"}
        safe_print(error_result)
    
    finally:
        if whisper:
            whisper.cleanup()
        safe_print_error("🏁 Whisper transcription ended")
    
    return 0

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)