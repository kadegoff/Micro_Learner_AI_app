#!/usr/bin/env python3
"""
Real-time Whisper transcription using the MEDIUM model
Returns complete sentences for word-by-word display animation
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

class WhisperRealtimeMedium:
    def __init__(self, model_size="medium", device="cpu", compute_type="int8"):
        """Initialize with medium model for better accuracy"""
        
        # Initialize all instance variables
        self.model = None
        self.sample_rate = 16000
        self.chunk_duration = 3.0  # Longer chunks for better accuracy with medium model
        self.min_audio_length = 1.0  # Minimum audio length
        self.audio_buffer = np.array([], dtype=np.float32)
        self.buffer_lock = threading.Lock()
        self.last_process_time = time.time()
        self.audio_queue = queue.Queue(maxsize=15)
        self.is_running = True
        self.model_ready = False
        self.silence_threshold = 0.01  # Adjusted for medium model
        self.silence_duration = 1.5  # Longer silence for better sentence detection
        self.last_audio_time = time.time()
        self.processing_thread = None
        self.startup_complete = False
        
        # Sentence tracking for complete results
        self.sentence_id = int(time.time() * 1000)
        
        # Enhanced transcription settings for medium model
        self.transcribe_settings = {
            "language": "en",
            "beam_size": 5,  # Higher beam size for better accuracy
            "best_of": 5,    # More candidates for better results
            "temperature": [0.0, 0.2, 0.4, 0.6, 0.8, 1.0],  # Temperature fallback
            "condition_on_previous_text": True,
            "compression_ratio_threshold": 2.4,
            "log_prob_threshold": -1.0,
            "no_speech_threshold": 0.6,
            "vad_filter": True,
            "vad_parameters": dict(
                min_silence_duration_ms=500,  # Better for sentence detection
                threshold=0.5,
                min_speech_duration_ms=250,
                max_speech_duration_s=30
            ),
            "word_timestamps": True,  # Still get word timestamps for metadata
            "initial_prompt": "This is a conversation with clear speech. Use proper punctuation and capitalization."
        }
        
        safe_print_error("🚀 Starting Medium Model Whisper Transcription")
        safe_print_error(f"Target model: {model_size} (MEDIUM QUALITY MODE)")
        
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
        """Load the medium Whisper model"""
        try:
            safe_print_error(f"Loading medium model: {model_size}")
            
            start_time = time.time()
            
            # Create model instance
            self.model = WhisperModel(
                model_size,
                device=device,
                compute_type=compute_type,
                cpu_threads=4,  # More threads for medium model
                num_workers=1,
                download_root=None,
                local_files_only=True
            )
            
            load_time = time.time() - start_time
            safe_print_error(f"✅ Medium model loaded in {load_time:.1f} seconds")
            
            # Quick test
            safe_print_error("🧪 Testing medium model transcription...")
            test_audio = np.random.normal(0, 0.01, 16000).astype(np.float32)
            
            segments, info = self.model.transcribe(
                test_audio,
                beam_size=1,
                word_timestamps=True
            )
            
            list(segments)  # Consume results
            safe_print_error("✅ Medium model test completed")
            
            self.model_ready = True
            safe_print_error("🎉 MEDIUM MODEL WHISPER READY!")
            
        except Exception as e:
            error_message = f"Failed to load medium model: {str(e)}"
            safe_print_error(f"❌ {error_message}")
            raise
    
    def _start_processing_thread(self):
        """Start the audio processing thread"""
        try:
            self.processing_thread = threading.Thread(
                target=self._process_audio_loop,
                daemon=True,
                name="MediumModelProcessor"
            )
            self.processing_thread.start()
            safe_print_error("✅ Medium model processing thread started")
        except Exception as e:
            safe_print_error(f"❌ Failed to start processing thread: {e}")
            raise
    
    def _signal_ready(self):
        """Signal that Whisper is ready"""
        safe_print_error("🎉 MEDIUM MODEL INITIALIZATION COMPLETE")
        
        # Send ready signal
        for i in range(3):
            safe_print("WHISPER_READY")
            time.sleep(0.05)
        
        safe_print_error("🚀 READY FOR MEDIUM QUALITY TRANSCRIPTION!")
        self.startup_complete = True
    
    def _process_audio_loop(self):
        """Background processing optimized for medium model"""
        safe_print_error("🔄 Medium model processing loop started")
        consecutive_errors = 0
        max_consecutive_errors = 3
        
        while self.is_running:
            try:
                current_time = time.time()
                
                with self.buffer_lock:
                    if len(self.audio_buffer) == 0:
                        time.sleep(0.1)  # Longer polling interval for medium model
                        continue
                    
                    buffer_duration = len(self.audio_buffer) / self.sample_rate
                    time_since_last_audio = current_time - self.last_audio_time
                    
                    # Process when we have enough audio or after silence
                    should_process = (
                        buffer_duration >= self.chunk_duration or
                        (buffer_duration >= self.min_audio_length and 
                         time_since_last_audio >= self.silence_duration)
                    )
                    
                    if should_process:
                        audio_to_process = self.audio_buffer.copy()
                        self.audio_buffer = np.array([], dtype=np.float32)
                        
                        if len(audio_to_process) > 0:
                            self._transcribe_chunk_complete(audio_to_process)
                            consecutive_errors = 0
                
                time.sleep(0.1)  # Longer sleep for medium model
                
            except Exception as e:
                consecutive_errors += 1
                safe_print_error(f"Processing loop error #{consecutive_errors}: {e}")
                
                if consecutive_errors >= max_consecutive_errors:
                    safe_print_error("Too many consecutive errors, stopping")
                    break
                
                time.sleep(0.5)
        
        safe_print_error("🔄 Medium model processing loop ended")
    
    def _transcribe_chunk_complete(self, audio_data):
        """Transcribe with medium model and return complete results"""
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
            min_samples = int(self.sample_rate * 0.5)  # 500ms minimum
            if len(audio_data) < min_samples:
                return
            
            start_time = time.time()
            
            # Transcribe with medium model settings
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
                        
                        # Extract word-level data if available
                        if hasattr(segment, 'words') and segment.words:
                            for word_info in segment.words:
                                if hasattr(word_info, 'word') and word_info.word:
                                    word_data.append({
                                        'word': word_info.word.strip(),
                                        'start': getattr(word_info, 'start', 0.0),
                                        'end': getattr(word_info, 'end', 0.0),
                                        'confidence': getattr(word_info, 'probability', 0.8)
                                    })
            
            full_text = full_text.strip()
            
            if full_text:
                # Create complete sentence result
                result = {
                    "type": "complete_sentence",
                    "text": full_text,
                    "sentence_id": str(self.sentence_id),
                    "words": word_data,
                    "word_count": len(word_data),
                    "confidence": sum(w['confidence'] for w in word_data) / len(word_data) if word_data else 0.8,
                    "model": "medium",
                    "quality": "high_accuracy",
                    "language": info.language if hasattr(info, 'language') else 'en',
                    "language_probability": getattr(info, 'language_probability', 0.9)
                }
                
                safe_print(result)
                
                # Increment sentence ID for next
                self.sentence_id = int(time.time() * 1000)
                
                transcribe_time = time.time() - start_time
                safe_print_error(f"✅ MEDIUM: '{full_text}' ({transcribe_time:.2f}s, {len(word_data)} words)")
        
        except Exception as e:
            safe_print_error(f"❌ Medium model transcription error: {e}")
            error_result = {
                "type": "error",
                "error": f"Medium model transcription error: {str(e)}"
            }
            safe_print(error_result)
    
    def add_audio_chunk(self, audio_data):
        """Add audio chunk for processing"""
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
                
                # Larger buffer for medium model (better context)
                max_buffer_samples = self.sample_rate * 15  # 15 seconds max
                if len(self.audio_buffer) > max_buffer_samples:
                    self.audio_buffer = self.audio_buffer[-max_buffer_samples:]
        
        except Exception as e:
            safe_print_error(f"❌ Error adding audio chunk: {e}")
    
    def cleanup(self):
        """Clean up resources"""
        safe_print_error("🧹 Cleaning up medium model Whisper resources...")
        self.is_running = False
        
        if self.processing_thread and self.processing_thread.is_alive():
            self.processing_thread.join(timeout=2.0)
        
        with self.buffer_lock:
            self.audio_buffer = np.array([], dtype=np.float32)
        
        self.model = None
        gc.collect()
        safe_print_error("✅ Medium model cleanup complete")

def main():
    """Main function for medium model Whisper"""
    safe_print_error("🚀 Medium Model Whisper Real-time Transcription")
    
    whisper = None
    try:
        # Initialize medium model processor
        whisper = WhisperRealtimeMedium(model_size="medium")
        
        safe_print_error("🎧 Ready for medium quality audio input")
        
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
                
                # Process with medium model
                if whisper and whisper.startup_complete:
                    whisper.add_audio_chunk(audio_data)
            
            except Exception as e:
                safe_print_error(f"❌ Error reading audio: {e}")
                break
    
    except KeyboardInterrupt:
        safe_print_error("⏹️ Interrupted by user")
    except Exception as e:
        error_result = {"type": "error", "error": f"Medium model main error: {str(e)}"}
        safe_print(error_result)
        safe_print_error(f"❌ Medium model Whisper fatal error: {e}")
    
    finally:
        if whisper:
            whisper.cleanup()
        safe_print_error("🏁 Medium Model Whisper ended")
    
    return 0

if __name__ == "__main__":
    sys.exit(main())