#!/usr/bin/env python3
"""
Real-time Whisper transcription using the BEST model (large-v3)
Assumes model is already downloaded via download_model.py
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

class WhisperRealtimeBest:
    def __init__(self, model_size="large-v3", device="cpu", compute_type="int8"):
        """Initialize with the BEST Whisper model"""
        
        # Initialize all instance variables
        self.model = None
        self.sample_rate = 16000
        self.chunk_duration = 3.0  # Longer chunks for better quality
        self.min_audio_length = 1.0  # Minimum 1 second
        self.audio_buffer = np.array([], dtype=np.float32)
        self.buffer_lock = threading.Lock()
        self.last_process_time = time.time()
        self.audio_queue = queue.Queue(maxsize=20)
        self.is_running = True
        self.model_ready = False
        self.silence_threshold = 0.008  # Lower threshold for better sensitivity
        self.silence_duration = 1.5
        self.last_audio_time = time.time()
        self.processing_thread = None
        self.startup_complete = False
        
        # Enhanced transcription settings for best quality
        self.transcribe_settings = {
            "language": "en",
            "beam_size": 5,  # Higher beam size for better quality
            "best_of": 5,    # Multiple candidates for best result
            "temperature": [0.0, 0.2, 0.4],  # Multiple temperatures
            "condition_on_previous_text": True,  # Better context
            "compression_ratio_threshold": 2.4,
            "log_prob_threshold": -1.0,
            "no_speech_threshold": 0.6,
            "vad_filter": True,
            "vad_parameters": dict(
                min_silence_duration_ms=300,
                threshold=0.5,
                min_speech_duration_ms=200,
                max_speech_duration_s=30
            ),
            "word_timestamps": False,  # Faster without word timestamps
            "initial_prompt": "This is a natural conversation with clear speech."
        }
        
        safe_print_error("🚀 Starting BEST Quality Whisper Real-time Transcription")
        safe_print_error(f"Python version: {sys.version}")
        safe_print_error(f"Process ID: {os.getpid()}")
        safe_print_error(f"Target model: {model_size} (HIGHEST QUALITY)")
        
        # Setup signal handlers
        signal.signal(signal.SIGTERM, self._signal_handler)
        signal.signal(signal.SIGINT, self._signal_handler)
        
        # Load the best model (should be pre-downloaded)
        self._load_best_model(model_size, device, compute_type)
        
        # Start processing thread
        self._start_processing_thread()
        
        # Signal ready
        self._signal_ready()
    
    def _signal_handler(self, signum, frame):
        """Handle shutdown signals gracefully"""
        safe_print_error(f"Received signal {signum}, shutting down...")
        self.cleanup()
        sys.exit(0)
    
    def _load_best_model(self, model_size, device, compute_type):
        """Load the BEST Whisper model (should already be downloaded)"""
        try:
            safe_print_error(f"Loading BEST model: {model_size}")
            safe_print_error("Model should be pre-downloaded for instant loading...")
            
            start_time = time.time()
            
            # Create model instance - should be fast if pre-downloaded
            self.model = WhisperModel(
                model_size,
                device=device,
                compute_type=compute_type,
                cpu_threads=4,  # More threads for better performance
                num_workers=1,
                download_root=None,
                local_files_only=True  # Don't download - should already exist
            )
            
            load_time = time.time() - start_time
            safe_print_error(f"✅ BEST model loaded in {load_time:.1f} seconds")
            
            # Quick model test with longer audio
            safe_print_error("🧪 Testing BEST model with sample audio...")
            test_audio = np.random.normal(0, 0.02, 16000).astype(np.float32)  # 1 second
            
            test_start = time.time()
            segments, info = self.model.transcribe(
                test_audio,
                **{k: v for k, v in self.transcribe_settings.items() 
                   if k not in ['vad_parameters']}  # Skip vad_parameters for test
            )
            
            # Consume results
            list(segments)
            test_time = time.time() - test_start
            
            safe_print_error(f"✅ BEST model test completed in {test_time:.1f}s")
            safe_print_error(f"🎯 Language detection: {info.language}")
            safe_print_error(f"🎯 Language probability: {info.language_probability:.3f}")
            
            self.model_ready = True
            safe_print_error("🎉 BEST QUALITY WHISPER MODEL READY!")
            
        except Exception as e:
            error_message = f"Failed to load BEST model: {str(e)}"
            safe_print_error(f"❌ {error_message}")
            
            # Provide helpful error message
            if "local_files_only" in str(e) or "not found" in str(e).lower():
                safe_print_error("💡 Model not found locally!")
                safe_print_error("💡 Please run: python download_model.py large-v3")
                safe_print_error("💡 This will download the best model first")
            
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
                name="BestWhisperProcessor"
            )
            self.processing_thread.start()
            safe_print_error("✅ BEST quality processing thread started")
        except Exception as e:
            safe_print_error(f"❌ Failed to start processing thread: {e}")
            raise
    
    def _signal_ready(self):
        """Signal that BEST Whisper is ready"""
        safe_print_error("🎉 BEST WHISPER INITIALIZATION COMPLETE")
        
        # Send ready signal multiple times
        for i in range(10):
            safe_print("WHISPER_READY")
            time.sleep(0.1)
            safe_print_error(f"Ready signal {i+1}/10 sent")
        
        safe_print_error("🚀 BEST QUALITY WHISPER IS READY FOR AUDIO!")
        self.startup_complete = True
    
    def _process_audio_loop(self):
        """Background processing with BEST quality settings"""
        safe_print_error("🔄 BEST quality audio processing loop started")
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
                    
                    # Use longer chunks for better quality
                    should_process = (
                        buffer_duration >= self.chunk_duration or
                        (buffer_duration >= self.min_audio_length and 
                         time_since_last_audio >= self.silence_duration)
                    )
                    
                    if should_process:
                        audio_to_process = self.audio_buffer.copy()
                        self.audio_buffer = np.array([], dtype=np.float32)
                        
                        if len(audio_to_process) > 0:
                            # Process in separate thread for responsiveness
                            threading.Thread(
                                target=self._transcribe_chunk_best,
                                args=(audio_to_process,),
                                daemon=True
                            ).start()
                            consecutive_errors = 0
                
                time.sleep(0.05)
                
            except Exception as e:
                consecutive_errors += 1
                safe_print_error(f"Processing loop error #{consecutive_errors}: {e}")
                
                if consecutive_errors >= max_consecutive_errors:
                    safe_print_error("Too many consecutive errors, stopping")
                    break
                
                time.sleep(0.5)
        
        safe_print_error("🔄 BEST quality processing loop ended")
    
    def _transcribe_chunk_best(self, audio_data):
        """Transcribe with BEST quality settings"""
        try:
            if audio_data is None or len(audio_data) == 0:
                return
            
            if not self.model_ready:
                return
            
            # Enhanced audio validation
            max_amplitude = np.max(np.abs(audio_data))
            if max_amplitude < self.silence_threshold:
                return
            
            # Ensure good chunk size for best quality
            min_samples = int(self.sample_rate * 0.5)  # 500ms minimum
            if len(audio_data) < min_samples:
                return
            
            duration = len(audio_data) / self.sample_rate
            safe_print_error(f"🎯 Transcribing {duration:.1f}s with BEST quality...")
            
            start_time = time.time()
            
            # Use BEST quality settings
            segments, info = self.model.transcribe(
                audio_data,
                **self.transcribe_settings
            )
            
            # Collect all text with confidence scoring
            full_text = ""
            segment_count = 0
            total_confidence = 0
            
            for segment in segments:
                if segment and hasattr(segment, 'text') and segment.text:
                    text = segment.text.strip()
                    if text:
                        full_text += text + " "
                        segment_count += 1
                        
                        # Add confidence if available
                        if hasattr(segment, 'avg_logprob'):
                            total_confidence += segment.avg_logprob
                        
                        if segment_count >= 10:  # Reasonable limit
                            break
            
            full_text = full_text.strip()
            transcribe_time = time.time() - start_time
            
            if full_text:
                # Calculate average confidence
                avg_confidence = 0.85  # Default
                if segment_count > 0 and total_confidence != 0:
                    avg_confidence = max(0.0, min(1.0, 
                        (total_confidence / segment_count + 5) / 10))  # Normalize
                
                result = {
                    "type": "final",
                    "text": full_text,
                    "confidence": round(avg_confidence, 3),
                    "start": 0.0,
                    "end": float(duration),
                    "transcribe_time": round(transcribe_time, 2),
                    "model": "large-v3",
                    "quality": "best",
                    "language": info.language if hasattr(info, 'language') else "en",
                    "language_probability": round(info.language_probability, 3) if hasattr(info, 'language_probability') else 0.9
                }
                
                safe_print(result)
                safe_print_error(f"✅ BEST: '{full_text}' (conf:{avg_confidence:.2f}, {transcribe_time:.1f}s)")
            else:
                safe_print_error(f"🔇 No speech detected in {duration:.1f}s audio")
        
        except Exception as e:
            safe_print_error(f"❌ BEST transcription error: {e}")
            error_result = {
                "type": "error",
                "error": f"BEST transcription error: {str(e)}"
            }
            safe_print(error_result)
    
    def add_audio_chunk(self, audio_data):
        """Add audio chunk for BEST quality processing"""
        try:
            if not self.model_ready or not self.startup_complete:
                return
            
            if audio_data is None:
                return
            
            # Convert bytes to float32
            if isinstance(audio_data, bytes):
                try:
                    if len(audio_data) % 2 != 0:
                        audio_data = audio_data[:-1]  # Remove odd byte
                    audio_array = np.frombuffer(audio_data, dtype=np.int16).astype(np.float32) / 32768.0
                except Exception:
                    return
            else:
                audio_array = audio_data
            
            if audio_array is None or len(audio_array) == 0:
                return
            
            # Enhanced audio validation
            if not np.isfinite(audio_array).all():
                return
            
            max_amplitude = np.max(np.abs(audio_array))
            
            with self.buffer_lock:
                self.audio_buffer = np.concatenate([self.audio_buffer, audio_array])
                
                if max_amplitude > self.silence_threshold:
                    self.last_audio_time = time.time()
                
                # Prevent buffer overflow - longer buffer for better quality
                max_buffer_samples = self.sample_rate * 20  # 20 seconds max
                if len(self.audio_buffer) > max_buffer_samples:
                    self.audio_buffer = self.audio_buffer[-max_buffer_samples:]
        
        except Exception as e:
            safe_print_error(f"❌ Error adding audio chunk: {e}")
    
    def cleanup(self):
        """Clean up resources"""
        safe_print_error("🧹 Cleaning up BEST Whisper resources...")
        self.is_running = False
        
        if self.processing_thread and self.processing_thread.is_alive():
            self.processing_thread.join(timeout=3.0)
        
        with self.buffer_lock:
            self.audio_buffer = np.array([], dtype=np.float32)
        
        self.model = None
        gc.collect()
        safe_print_error("✅ BEST Whisper cleanup complete")

def main():
    """Main function for BEST quality Whisper"""
    safe_print_error("🚀 BEST Quality Whisper Real-time Transcription")
    
    whisper = None
    try:
        # Use the BEST model
        whisper = WhisperRealtimeBest(model_size="large-v3")
        
        safe_print_error("🎧 Ready for audio input (BEST QUALITY)")
        
        while True:
            try:
                # Read length
                length_data = sys.stdin.buffer.read(4)
                if len(length_data) != 4:
                    safe_print_error("📡 End of input stream")
                    break
                
                length = struct.unpack('<I', length_data)[0]
                
                if length == 0 or length > 2 * 1024 * 1024:  # 2MB max
                    continue
                
                # Read audio data
                audio_data = sys.stdin.buffer.read(length)
                if len(audio_data) != length:
                    continue
                
                # Process with BEST quality
                if whisper and whisper.startup_complete:
                    whisper.add_audio_chunk(audio_data)
            
            except Exception as e:
                safe_print_error(f"❌ Error reading audio: {e}")
                break
    
    except KeyboardInterrupt:
        safe_print_error("⏹️ Interrupted by user")
    except Exception as e:
        error_result = {"type": "error", "error": f"BEST main error: {str(e)}"}
        safe_print(error_result)
        safe_print_error(f"❌ BEST Whisper fatal error: {e}")
    
    finally:
        if whisper:
            whisper.cleanup()
        safe_print_error("🏁 BEST Quality Whisper ended")
    
    return 0

if __name__ == "__main__":
    sys.exit(main())