#!/usr/bin/env python3
"""
Real-time Whisper transcription using the BASE model
Fast and reliable for most use cases
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

class WhisperRealtimeBase:
    def __init__(self, model_size="base", device="cpu", compute_type="int8"):
        """Initialize with the base Whisper model"""
        
        # Initialize all instance variables
        self.model = None
        self.sample_rate = 16000
        self.chunk_duration = 2.0  # Shorter chunks for faster response
        self.min_audio_length = 0.8  # Minimum 800ms
        self.audio_buffer = np.array([], dtype=np.float32)
        self.buffer_lock = threading.Lock()
        self.last_process_time = time.time()
        self.audio_queue = queue.Queue(maxsize=15)
        self.is_running = True
        self.model_ready = False
        self.silence_threshold = 0.01
        self.silence_duration = 1.2
        self.last_audio_time = time.time()
        self.processing_thread = None
        self.startup_complete = False
        
        # Optimized transcription settings for base model
        self.transcribe_settings = {
            "language": "en",
            "beam_size": 2,  # Smaller beam for speed
            "best_of": 1,    # Single candidate for speed
            "temperature": [0.0],  # Single temperature
            "condition_on_previous_text": True,
            "compression_ratio_threshold": 2.4,
            "log_prob_threshold": -1.0,
            "no_speech_threshold": 0.6,
            "vad_filter": True,
            "vad_parameters": dict(
                min_silence_duration_ms=250,
                threshold=0.5,
                min_speech_duration_ms=150,
                max_speech_duration_s=15
            ),
            "word_timestamps": False,
            "initial_prompt": "This is a conversation."
        }
        
        safe_print_error("🚀 Starting Base Model Whisper Real-time Transcription")
        safe_print_error(f"Python version: {sys.version}")
        safe_print_error(f"Process ID: {os.getpid()}")
        safe_print_error(f"Target model: {model_size} (FAST & RELIABLE)")
        
        # Setup signal handlers
        signal.signal(signal.SIGTERM, self._signal_handler)
        signal.signal(signal.SIGINT, self._signal_handler)
        
        # Load the base model
        self._load_base_model(model_size, device, compute_type)
        
        # Start processing thread
        self._start_processing_thread()
        
        # Signal ready
        self._signal_ready()
    
    def _signal_handler(self, signum, frame):
        """Handle shutdown signals gracefully"""
        safe_print_error(f"Received signal {signum}, shutting down...")
        self.cleanup()
        sys.exit(0)
    
    def _load_base_model(self, model_size, device, compute_type):
        """Load the base Whisper model"""
        try:
            safe_print_error(f"Loading base model: {model_size}")
            safe_print_error("Fast loading expected...")
            
            start_time = time.time()
            
            # Create model instance - should be very fast
            self.model = WhisperModel(
                model_size,
                device=device,
                compute_type=compute_type,
                cpu_threads=2,  # Fewer threads for base model
                num_workers=1,
                download_root=None,
                local_files_only=True
            )
            
            load_time = time.time() - start_time
            safe_print_error(f"✅ Base model loaded in {load_time:.1f} seconds")
            
            # Quick model test
            safe_print_error("🧪 Testing base model...")
            test_audio = np.random.normal(0, 0.01, 8000).astype(np.float32)  # 0.5 second
            
            test_start = time.time()
            segments, info = self.model.transcribe(
                test_audio,
                beam_size=1,
                best_of=1,
                temperature=[0.0]
            )
            
            # Consume results
            list(segments)
            test_time = time.time() - test_start
            
            safe_print_error(f"✅ Base model test completed in {test_time:.1f}s")
            safe_print_error(f"🎯 Language detection: {info.language}")
            
            self.model_ready = True
            safe_print_error("🎉 BASE MODEL WHISPER READY!")
            
        except Exception as e:
            error_message = f"Failed to load base model: {str(e)}"
            safe_print_error(f"❌ {error_message}")
            
            if "local_files_only" in str(e) or "not found" in str(e).lower():
                safe_print_error("💡 Base model not found locally!")
                safe_print_error("💡 Please run: python download_model.py base")
            
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
                name="BaseWhisperProcessor"
            )
            self.processing_thread.start()
            safe_print_error("✅ Base model processing thread started")
        except Exception as e:
            safe_print_error(f"❌ Failed to start processing thread: {e}")
            raise
    
    def _signal_ready(self):
        """Signal that base Whisper is ready"""
        safe_print_error("🎉 BASE WHISPER INITIALIZATION COMPLETE")
        
        # Send ready signal
        for i in range(5):  # Fewer signals needed
            safe_print("WHISPER_READY")
            time.sleep(0.05)
        
        safe_print_error("🚀 BASE MODEL WHISPER IS READY FOR AUDIO!")
        self.startup_complete = True
    
    def _process_audio_loop(self):
        """Background processing optimized for base model"""
        safe_print_error("🔄 Base model audio processing loop started")
        consecutive_errors = 0
        max_consecutive_errors = 3
        
        while self.is_running:
            try:
                current_time = time.time()
                
                with self.buffer_lock:
                    if len(self.audio_buffer) == 0:
                        time.sleep(0.05)
                        continue
                    
                    buffer_duration = len(self.audio_buffer) / self.sample_rate
                    time_since_last_audio = current_time - self.last_audio_time
                    
                    # Faster processing for base model
                    should_process = (
                        buffer_duration >= self.chunk_duration or
                        (buffer_duration >= self.min_audio_length and 
                         time_since_last_audio >= self.silence_duration)
                    )
                    
                    if should_process:
                        audio_to_process = self.audio_buffer.copy()
                        self.audio_buffer = np.array([], dtype=np.float32)
                        
                        if len(audio_to_process) > 0:
                            # Process immediately for speed
                            self._transcribe_chunk_base(audio_to_process)
                            consecutive_errors = 0
                
                time.sleep(0.05)
                
            except Exception as e:
                consecutive_errors += 1
                safe_print_error(f"Processing loop error #{consecutive_errors}: {e}")
                
                if consecutive_errors >= max_consecutive_errors:
                    safe_print_error("Too many consecutive errors, stopping")
                    break
                
                time.sleep(0.5)
        
        safe_print_error("🔄 Base model processing loop ended")
    
    def _transcribe_chunk_base(self, audio_data):
        """Transcribe with base model (optimized for speed)"""
        try:
            if audio_data is None or len(audio_data) == 0:
                return
            
            if not self.model_ready:
                return
            
            # Quick audio validation
            max_amplitude = np.max(np.abs(audio_data))
            if max_amplitude < self.silence_threshold:
                return
            
            # Minimum chunk size
            min_samples = int(self.sample_rate * 0.3)  # 300ms minimum
            if len(audio_data) < min_samples:
                return
            
            duration = len(audio_data) / self.sample_rate
            
            start_time = time.time()
            
            # Use fast settings for base model
            segments, info = self.model.transcribe(
                audio_data,
                **self.transcribe_settings
            )
            
            # Collect text
            full_text = ""
            segment_count = 0
            
            for segment in segments:
                if segment and hasattr(segment, 'text') and segment.text:
                    text = segment.text.strip()
                    if text:
                        full_text += text + " "
                        segment_count += 1
                        
                        if segment_count >= 5:  # Limit for speed
                            break
            
            full_text = full_text.strip()
            transcribe_time = time.time() - start_time
            
            if full_text:
                result = {
                    "type": "final",
                    "text": full_text,
                    "confidence": 0.8,  # Estimated for base model
                    "start": 0.0,
                    "end": float(duration),
                    "transcribe_time": round(transcribe_time, 2),
                    "model": "base",
                    "quality": "fast_reliable",
                    "language": info.language if hasattr(info, 'language') else "en"
                }
                
                safe_print(result)
                safe_print_error(f"✅ BASE: '{full_text}' ({transcribe_time:.1f}s)")
        
        except Exception as e:
            safe_print_error(f"❌ Base transcription error: {e}")
            error_result = {
                "type": "error",
                "error": f"Base transcription error: {str(e)}"
            }
            safe_print(error_result)
    
    def add_audio_chunk(self, audio_data):
        """Add audio chunk for base model processing"""
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
                
                # Smaller buffer for base model
                max_buffer_samples = self.sample_rate * 10  # 10 seconds max
                if len(self.audio_buffer) > max_buffer_samples:
                    self.audio_buffer = self.audio_buffer[-max_buffer_samples:]
        
        except Exception as e:
            safe_print_error(f"❌ Error adding audio chunk: {e}")
    
    def cleanup(self):
        """Clean up resources"""
        safe_print_error("🧹 Cleaning up base Whisper resources...")
        self.is_running = False
        
        if self.processing_thread and self.processing_thread.is_alive():
            self.processing_thread.join(timeout=2.0)
        
        with self.buffer_lock:
            self.audio_buffer = np.array([], dtype=np.float32)
        
        self.model = None
        gc.collect()
        safe_print_error("✅ Base Whisper cleanup complete")

def main():
    """Main function for base model Whisper"""
    safe_print_error("🚀 Base Model Whisper Real-time Transcription")
    
    whisper = None
    try:
        # Use the base model
        whisper = WhisperRealtimeBase(model_size="base")
        
        safe_print_error("🎧 Ready for audio input (BASE MODEL)")
        
        while True:
            try:
                # Read length
                length_data = sys.stdin.buffer.read(4)
                if len(length_data) != 4:
                    safe_print_error("📡 End of input stream")
                    break
                
                length = struct.unpack('<I', length_data)[0]
                
                if length == 0 or length > 1024 * 1024:  # 1MB max
                    continue
                
                # Read audio data
                audio_data = sys.stdin.buffer.read(length)
                if len(audio_data) != length:
                    continue
                
                # Process with base model
                if whisper and whisper.startup_complete:
                    whisper.add_audio_chunk(audio_data)
            
            except Exception as e:
                safe_print_error(f"❌ Error reading audio: {e}")
                break
    
    except KeyboardInterrupt:
        safe_print_error("⏹️ Interrupted by user")
    except Exception as e:
        error_result = {"type": "error", "error": f"Base main error: {str(e)}"}
        safe_print(error_result)
        safe_print_error(f"❌ Base Whisper fatal error: {e}")
    
    finally:
        if whisper:
            whisper.cleanup()
        safe_print_error("🏁 Base Model Whisper ended")
    
    return 0

if __name__ == "__main__":
    sys.exit(main())